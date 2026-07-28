# Design Decisions — DoDE Expert (Foundry VTT)

> Consolidated reference. Replaces the content previously spread across
> `FOUNDRY_MIGRATION_PLAN.md`, `ARCHITECTURE_RULE_AUDIT.md`,
> `PLAN_WIZARD_V2.md`, and `GITHUB_PUBLICATION_GUIDE.md`.
>
> Last verified against codebase: 2026-07-26.

---

## 1. Architecture — What Was Decided and Why

### Three-layer data model

Actor and Item data uses Foundry's `TypeDataModel` / `SchemaField` pattern. Each actor subtype (`character`, `npc`) and item subtype (`fardighet`, `ras`, `yrke`, `vapen`, `rustning`, `besvarjelse`) has its own DataModel class under `scripts/data/`. Types are declared in `system.json` `documentTypes` and bound via `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels` in `dode.mjs`. No `template.json` exists — this is the correct modern Foundry v12+ pattern.

### ActiveEffects as the modifier backbone

All attribute modifiers flow through Foundry's native `ActiveEffect` system. A custom subclass `DoDeActiveEffect` (`scripts/documents/dode-active-effect.mjs`) adds a `flags.<system.id>.condition` hook for conditional modifiers (currently all-pass — the extension point exists for future scene/context evaluation) **and** an equipment gate: `shouldApplyChange()` returns `false` when the source item has `system.equipped === false`, so unequipped gear contributes nothing. AE `changes` target `system.attributes.*.bonus` using `ACTIVE_EFFECT_MODES.ADD`. Foundry's pipeline applies effects between `prepareEmbeddedDocuments()` and `prepareDerivedData()`, so derived values (KP, SB, movement, grouping) always see the final bonus.

**Flag scope note (fixed 2026-07-26, see §6 for the general rule):** flags are namespaced under `game.system.id` (`"drakar-och-demoner-expert"`), not the short slug `"dode"` — Foundry's `Document#getFlag`/`setFlag` reject any scope that isn't `"core"`, `"world"`, an active module id, or `game.system.id`, and throw `Flag scope "..." is not valid or not currently active` otherwise. All flag reads/writes below use `game.system.id` (JS) accordingly; compendium JSON uses the literal string `"drakar-och-demoner-expert"` since JSON can't reference `game.system.id`.

**Override point note (fixed 2026-07-26, see §6):** the equipment gate and condition hook are implemented via `shouldApplyChange(change, {phase})`, not the legacy `apply(actor, change)` override — Foundry v14 no longer calls `apply()`/`_applyLegacy()` for changes targeting schema-resolvable fields (which `system.attributes.*.bonus` is), so an `apply()` override silently never ran.

The AE system now covers four modifier sources beyond race/age, each tagged with `flags.<system.id>.source` for identification:

- **Equipment** (`vapen`/`rustning`): an `equipped` boolean gates the item's transfer AEs via `shouldApplyChange()` (source flag = the item type). Note: derived ABS is still computed independently in `prepareDerivedData()` and is *not* gated by `equipped` — only AE bonuses are. **Two real compendium items now ship effects (2026-07-26, backlog 12a):** `Väktarklingan` (vapen, +2 STY while wielded) and `Alvskölden` (rustning, +2 FYS while worn), both `flags.<system.id>.{source:"item", magical:true}`. All 35 `vapen-utrustning` items (33 original + these 2) now explicitly set `system.equipped: false` as their compendium-source default — previously the field was simply absent and relied on the DataModel's `initial: true`, so freshly-purchased/dropped gear silently started "equipped." Not yet repacked into the compiled LevelDB pack (`npm run packs:pack` requires the Foundry server to be stopped first, per the workflow note below) or live-verified in a running world.
- **Förmåga** (`formaga` — a new Item type): carries transfer AEs that are always active while embedded (no `equipped` field → never gated). The structured counterpart to the free-text `system.specialAbilities[]` array.
- **Spell** (`besvarjelse`): a `spellEffect[]` (AE change definitions) + `spellDuration` (rounds) schema. `DoDEActor#applySpellEffect()` creates a temporary embedded AE (`duration.rounds`, `flags.<system.id>.source: "spell"`, `flags.<system.id>.spellName`). The cast→apply wiring is a deliberate stub — the method is callable but not auto-invoked from `castSpell()` yet (targeting/hit logic is combat, fas 6+).
- **Scene** (`scripts/utils/scene-effects.mjs`, `game.dode.SceneEffects`): `applyToScene(effectData)` / `removeFromScene(name)` apply/remove AEs across all actors with tokens on the active scene, tagged `flags.<system.id>.source: "scene"`.

Still **not** covered: skill modifiers (planned, requires `flags.<system.id>.skillModifiers` / `effectiveFv` on fardighet) and curse-specific tooling. A visual ActiveEffect editor on the custom item sheets is also not built — `formaga` AEs and spell `spellEffect[]` are authored via `_source` JSON / the API for now.

### Race and profession as embedded Items with transfer AEs

Race (`ras`) and profession (`yrke`) are embedded Items on the actor, enforced to at most one of each via `_onDrop` in the character sheet. Each race compendium entry carries an `effects[]` array with `transfer: true` — Foundry auto-applies these to the owning actor when the item is embedded. Reason: the modifier data travels with the actor (no broken references if the compendium changes), and the AE pipeline handles application automatically. 6 of 7 races have transfer AEs (Människa has no attribute modifiers, so no AE).

`prepareDerivedData()`'s legacy fallback (for characters whose embedded ras item predates the AE feature and has no `effects[]`) detects an active race AE via `actor.appliedEffects` — **not** `actor.effects`. Transfer effects owned by an embedded Item only ever surface through `Actor#appliedEffects` (which walks both actor-owned and item-transferred effects); `Actor#effects` is actor-owned effects only and will never contain them. Using the wrong collection here was a confirmed bug (fixed 2026-07-26) that caused the fallback to always run redundantly on top of the real AE, doubling the race bonus.

### Age modifiers as programmatic AEs

Age modifiers cannot live on an Item (there is no "age" Item). Instead, the character wizard (and a `updateActor` hook in `dode.mjs`, for edits after creation) creates an `ActiveEffect` directly on the actor, with `flags.<system.id>.source: "age"` and changes targeting `system.attributes.*.bonus`. Because this AE is actor-owned (not transferred), `actor.effects` (not `appliedEffects`) is the correct collection to search when looking for an existing one to update. The age modifier table (`DODE.ageAttributeModifiers`) has data for Ung and Gammal; Mogen and Medelålders are empty objects (zero mods) — this reflects a genuine source-material ambiguity (RP s.24–25 vs. Expert Regler s.8 disagree), not an implementation gap. Flagged with `⚠` in `config.mjs`.

### The value / bonus / total field pattern

Each attribute has three fields: `value` (the rolled 3d6 base, never modified by AEs), `bonus` (AE target, sum of all race + age + future modifiers), and `total` (computed as `value + bonus` in `prepareDerivedData()`). Reason: preserving the rolled base lets the UI show "Base: 10, Mod: +3, Total: 13" and makes it possible to remove/change an AE without losing the original roll. The sheet displays `bonusDisplay` (formatted sign string) alongside the total.

### Wizard architecture

The character wizard (`scripts/apps/character-wizard.mjs`) is a standalone `ApplicationV2` with `HandlebarsApplicationMixin` — not a `DocumentSheet`, because no actor exists until the final step. It has 14 steps: `kon`, `niva`, `grunder`, `ras`, `yrke`, `attribut`, `formagor`, `socialt`, `kapital`, `alder`, `fardigheter`, `livsmal`, `utrustning`, `granska`. Each step owns its state slice. Calculation formulas are deliberately duplicated between the wizard (for live preview without an actor) and the DataModel (for real computation post-creation). This dual-computation is the main "keep in sync by hand" liability. `#onCreateCharacter` calls `Actor.create()`, `createEmbeddedDocuments()` for skills/equipment, and creates the age AE.

**Layout (fixed 2026-07-26):** the template wraps all per-step `{{#if showX}}` sections in a single `.wizard-step-container` div, separate from the `.wizard-progress` header and `.wizard-nav` footer. CSS gives the container `flex:1; min-height:0; overflow-y:auto` while header/footer are `flex:0 0 auto` — so a tall step (Färdigheter's two skill tables, at 640px window height, routinely exceeds 1000px) scrolls internally without ever hiding the "Föregående"/"Nästa" buttons. See §6 for why this wasn't the default behavior.

### Compendium source JSON vs. LevelDB

Both `packs/<name>/_source/*.json` (human-editable, git-diffable) and compiled LevelDB directories are committed. Reason: Foundry reads only the LevelDB at runtime, but the JSON sources are the authoritative editable format. Workflow: edit `_source/*.json`, run `npm run packs:pack` (requires `@foundryvtt/foundryvtt-cli`), commit both. The `package.json` exists only for this build tool, not for the system runtime.

### RuleProfile concept — deferred

The architecture audit proposed a `ruleMeta` metadata sidecar on config tables to track which source book each rule comes from and flag unsourced extrapolations. Decision: deferred. The system is still small enough that `⚠` code comments and the three status files provide adequate traceability. Revisit when adding content from additional supplements (Alver subraces, profession specializations) where silent book-mixing becomes harder to audit.

---

## 2. Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Wizard re-entry / edit mode | **Done (2026-07-27)** | `new DoDECharacterWizard({actor})` loads an existing character back into `state` and saves via `#applyToActor()` — never `Actor.create`. Access: GM toggles `flags.<sysid>.wizardUnlocked` on that specific actor (padlock button on the sheet, GM-only), the player then opens "Redigera i guiden"; the flag is cleared by the save, so each unlock is single-use. **Race/yrke are read-only** in edit mode (locked cards) and **the equipment step is skipped** — see §3 4c for the reasoning. Skill reconciliation keys off `costTier`: `primar`/`yrkesfardighet` are updated or created, `sekundar` (play-acquired) is never touched, and **nothing is ever deleted**. Age AE needs no code here — `dode.mjs`'s `updateActor` hook handles it. Live-verified on `Testrollperson`: after editing age→Gammal, exactly 1 ras item, 0 duplicate skill names, 1 age AE, `Smyga`/`Alkemi` preserved at FV 15/7, gear untouched, flag cleared; STY 10+3−3=10 and PSY 10+2+2=14 confirm race and age each applied exactly once. A second no-op save produced zero drift (idempotent). |
| Prototype token defaults | **Done (2026-07-27)** | `system.json` gained `primaryTokenAttribute: "hp"` / `secondaryTokenAttribute: "resources.psy"` — verified live to populate `bar1`/`bar2` on **every** actor (closes §3 backlog 15). The wizard additionally sets, on create, what it previously never set at all: actor `img` + `prototypeToken.texture.src` from the gendered race/profession art, `name`, `actorLink: true` (essential so a placed token and the sheet stay one document), `sight.enabled: true`, `disposition: FRIENDLY`, `displayName`/`displayBars: OWNER_HOVER`. ⚠ Manifest keys are read at **server start** — editing `system.json` requires a Foundry restart before they take effect (cost one confused verification round). |
| Content parity vs. the standalone HTML generator | **Verified (2026-07-27)** | Full diff of `docs/chargen/DoDE_Character_Generator.html` against our compendiums. **Exact match** on: 7 base races, 6 elf subraces, and all four specialisation groups (Krigare 8 — the HTML's 9th value `generell` is its "no specialisation" option, not a profession; Tjuv 8; Lönnmördare 5; Bard 4). **Only divergence:** the HTML has 14 base professions to our 11, adding `Jägare`, `Köpman` and `Trollkarl` (with requirements `—`, `INT 9+`, `INT 9+ · inträdessprov`). **Deliberately not added** — no book source found: `YRKEN.md` covers a *contiguous* RP s.12–22 with exactly 11 professions and no gap; in the raw extracts "Trollkarl" appears only in the Magi rules as a generic prose synonym for a spellcaster ("den maximala effektgrad en trollkarl får använda"), never as a profession chapter; `Jägare`/`Köpman` hits are monster and NPC usages; Spelarboken has no profession chapters for any of them, and the books' hunter profession is `Utbygdsjägare` — which the HTML lists *alongside* `jagare`, so it's an addition rather than a rename. Treat as HTML-only house rules (see `CLAUDE.md`'s warning that the generator is not canon). Revisit only if Johan identifies a source. |
| Elf lineages (alvsläkten) | **Done (2026-07-27)** | Six playable lineages from **Alver s.22** — Grottalv, Gråalv, Högalv, Injir, Mörkeralv, Skogsalv — as ordinary `ras` compendium items. The supplement's `Tabell över släktenas modifikationer på grundegenskaper` is already in `attributeMods` shape, so **no schema change was needed**; each carries a `transfer:true` race AE built exactly like Dvärg's. Högalv (65 BP) keeps the book's own GM-gate wording. Per-lineage särskilda förmågor (Alver s.23-24) are recorded as prose in `automaticAbilities`, not yet wired to the roll table — see §3. Live-verified: Skogsalv gives SMI+3/INT+3/PSY+1/KAR+2 with **exactly one** race AE. |
| Profession specialisations | **Done (2026-07-27)** | 25 new `yrke` items: Krigare 8 (KH s.4-9), Tjuv 8 (T&L s.12-16), Lönnmördare 5 (T&L s.9-12), Bard 4 (T&L s.7-9), all transcribed from `YRKEN.md` with their own `requirements` (parsed by the existing `#checkRequirements`) and a `professionAbility` combining base + own ability. New `baseProfession` field on `item-yrke.mjs` groups them in the wizard. ⚠ Barbar/Gladiator abilities carry the source doc's own "unverified" flag. |
| Magic school picker | **Done (2026-07-27)** | `MAGI.md` establishes a school **is a skill** ("Färdighetsvärde i magiskolan"), so `DODE.magicSchoolSkills` (13 schools, INT, frozen keys) feeds a `magiskola` wizard step that materialises the choice as a `fardighet` with `costTier: "yrkesfardighet"` — FV is then bought in the normal skill step, no new economy or character schema field. The step is **conditional**: shown only for Magiker, verified absent for a Barbar. The three ad-hoc `(magiskola)` entries were removed from `secondarySkills` so schools live in one place. |
| Compendium visibility / pack ownership | **Done (2026-07-27)** | `ownership` declared on all six system packs + the campaign module's `adventures`; `magiska-foremal` added as a GM-only pack (both magic items moved out of the shoppable `vapen-utrustning`, which is now 33 mundane items); `world.dimon-*` set GM-only via `pack.configure()`. Live-verified per-role: Player sees 4 packs, GM sees 9. Architecture in §7; the underlying Foundry constraint (visibility is per-pack, role-based, no per-document hiding) in §6. |
| Content registry (`CONFIG.DODE.contentPacks`) | **Done (2026-07-27)** | Replaces three hardcoded pack IDs in `character-wizard.mjs`. Maps a semantic key (`races`/`professions`/`startingEquipment`/`spells`) to a **list** of packs, so a campaign module can contribute chargen content from its own `init` hook. Resolver skips missing/unreadable packs so a hidden pack degrades instead of throwing. **Registry membership is the access guard** — `magiska-foremal`/`monster` are deliberately unregistered, which also blocks a *GM* from buying magic items in the wizard (permission checks alone would not, since GMs pass everything). Belt-and-braces: the equipment step also excludes any item with ActiveEffects. Live-verified: 7 races / 11 professions / 33 shop items, magic items absent for both roles. |
| ActiveEffects subclass (`DoDeActiveEffect`) | **Done** | Fixed and live-verified 2026-07-26 (bug found and fixed same session — see git history / memory.md session 8). Was broken: `flags.dode.source`/`flags.dode.condition` used flag scope `"dode"`, which Foundry rejects (`getFlag`/`setFlag` scope must equal `game.system.id`, a registered module id, or `"core"`) — every `getFlag("dode", ...)` call threw and aborted `prepareDerivedData()`. Fixed by switching all reads/writes to `game.system.id` (`"drakar-och-demoner-expert"`), and by migrating the equipment/condition gate from the Foundry v14-deprecated `apply(actor, change)` override to `shouldApplyChange(change, {phase})` (see §6). Re-verified via console: 0 console errors across race/age/equip flows post-fix. |
| Age modifier AEs (created at wizard completion) | **Done** | Fixed and live-verified 2026-07-26. Was broken: a second age change (e.g. Ung → Gammal) silently failed to update the existing AE because `dode.mjs`'s lookup (`actor.effects.find(e => e.getFlag(...,"source")==="age")`) threw on the invalid `"dode"` scope. Fixed alongside the flag-scope migration; re-verified via console that `Ung → Gammal` now correctly renames the effect and updates all four attribute bonuses to the Gammal table values. |
| Race AEs (`transfer:true` on compendium items) | **Done** | Fixed and live-verified 2026-07-26. Was broken: race bonuses were double-applied because `actor-character.mjs`'s legacy-fallback detector checked `actor.effects` (actor-owned only) instead of `actor.appliedEffects` (which also includes item-transferred effects), so the manual `rasItem.system.attributeMods` fallback always ran on top of the real AE. Fixed by switching the check to `actor.appliedEffects`; re-verified via console: fresh actor + Dvärg item → STY/FYS/PSY/KAR bonuses exactly +3/+2/+2/-3, no doubling. |
| `bonus`/`total` field pattern on attributes | **Done** | Schema field + `prepareDerivedData()` + sheet display (`bonusDisplay`). |
| `bonus`/`total` field pattern on skills | **Done (flat field only, 2026-07-26)** | `item-fardighet.mjs` `prepareDerivedData()` now computes `total = fv + bonus` and `bonusDisplay`, mirroring the attribute pattern exactly. `bonus` (already existed as a dead, unused schema field) is now exposed on the item sheet as a manual number input, and `rollSkill()` rolls against `total` instead of `fv`. Sheet shows "FV {fv} +{bonus} = {total}" when bonus ≠ 0, same convention as attributes. Live-verified: chat card showed "FV 20" for a skill with fv 15 + bonus 5. **This is deliberately scoped to the flat container/field pattern only** — it is *not* the full "Skill Modifier System" from `PLAN_WIZARD_V2.md` (automatic race/yrke/förmåga-sourced modifiers, conditional bonuses). See the row below and §3 backlog item 7 for why that's a separate, harder problem: `bonus` here is manually set (GM/player edits the item sheet), not populated by an ActiveEffect. |
| Base/Mod/Total display on character sheet | **Done** | `character-sheet.hbs:47` shows `bonusDisplay` per attribute. |
| Sidebar v14 selector fix | **Done** | `dode.mjs:79-81` — `.header-actions` fallback added alongside `.action-buttons`. |
| Character wizard 14-step flow | **Done** | All 14 steps implemented and live-verified (Fas 1–9 + Fas 10 korrigerad). |
| Öde-typer 4-level niva picker with images | **Done** | `vanlig` / `slumpens-hjalte` / `sann-hjalte` / `gudafodd`. Image cards in `assets/niva-*.png`. |
| Förmågor 4-source aggregation system | **Partial** | Slots (`specialAbilities[]`) count by niva, still free-text at the field level — but as of 2026-07-27 backed by a real, live-verified 49-row 2T20+BP table (`CONFIG.DODE.specialAbilitiesTable`, ported from the Roll20 project's already-transcribed extract, RP s.25-27) with a "Slå fram förmåga" button in both the wizard's `formagor` step and the character sheet, auto-filling name/description while leaving the fields hand-editable. Secondary färdigheter got the same treatment: `CONFIG.DODE.secondarySkills` (67 entries, ported from `REGLER_FARDIGHETER.md`) now backs a real pick-list dropdown (primär/yrkesfärdighet/sekundär, excluding already-owned) replacing the old blank-name "+ Ny färdighet" flow, with a free-text "Annat" fallback preserved. No race/yrke ability aggregation still — that's the separate, still-unbuilt Skill modifier system row below. |
| HP-based hjälteförmågor (post-creation) | **Not Started** | HH describes 1T20+accumulated HP on a table (18 entries). No sheet UI for spending HP on abilities. |
| Skill modifier system (base FV vs. effective CL, auto-sourced from race/yrke/förmåga) | **Not Started** | Designed in `PLAN_WIZARD_V2.md` (SPEC, written 2026-07-22 before the AE system existed). The flat `bonus`/`total` container now exists (row above) but is manually set, not auto-populated. **Real blocker found 2026-07-26, not just "unbuilt":** the SPEC's own recommendation (line 677) was to use ActiveEffects targeting `system.skills.<name>.modifiers` — but skills are embedded `fardighet` **Items**, not an actor-level `system.skills{}` map, and an AE `change.key` can only resolve against the schema of the document the effect is applied to (the actor, for transfer effects) — it cannot address into a specific named embedded Item. So a race/yrke item cannot give "+10 CL Gömma sig" via the same transfer-AE mechanism used for attributes without either (a) restructuring skills to live in an actor-level schema map instead of embedded Items, or (b) a bespoke aggregation pass in `prepareDerivedData()` that reads a custom modifier list off race/yrke/förmåga items and matches it to fardighet items by name/key. Needs a decision (see `PLAN_WIZARD_V2.md`'s own "Prioritet: HÖG — måste beslutas innan implementation") before building further. |
| Universal modifier system (spells, items, scenes, curses) | **Partial** | Equipment/förmåga/spell/scene AEs built (see §1) and, as of 2026-07-26, live-verified working (flag-scope + `shouldApplyChange` fixes, see §6). New `formaga` Item type. `besvarjelse` gained `spellEffect[]`/`spellDuration` + `DoDEActor#applySpellEffect()` (cast→apply is stub). `SceneEffects` util at `game.dode.SceneEffects`. Two real compendium items (`Väktarklingan`, `Alvskölden`) carry equip-gated attribute-bonus AEs, **live drag-to-actor verified 2026-07-26** (see §1/backlog 12a, now closed). Remaining: skill modifiers, curses, in-sheet AE editor. |
| Equipment AEs (`equipped` gate on vapen/rustning) | **Done** | Gate logic fixed and live-verified 2026-07-26 against a synthetic item: bonus toggles 0/5/0 exactly tracking `equipped` true/false. Was broken: the gate was implemented via the Foundry v14-deprecated `apply(actor, change)` override, which is no longer invoked for changes targeting schema-resolvable fields — fixed by migrating to `shouldApplyChange(change, {phase})`. Added two real compendium items with effects (`Väktarklingan` +2 STY, `Alvskölden` +2 FYS) and set `system.equipped: false` explicitly on all 35 `vapen-utrustning` _source_ items. Repacked via `npm run packs:pack` (session 10). **Drag-to-actor live-verified 2026-07-26 (session 11, Playwright):** both items dragged from the `vapen-utrustning` compendium onto a Dvärg test actor (Testrollperson, base STY 10/+3 race = 13, base FYS 10/+2 race = 12), defaulted to `equipped:false` on drop, then toggled: Väktarklingan equip → STY 15 (Bärförmåga 13→15 kg) → unequip → STY back to 13. Alvskölden equip → FYS 14 → unequip → FYS back to 12. 0 functional console errors (one unrelated pre-existing `Cannot set language sv` warning at boot, tracked separately under "Localization sweep"). Backlog 12a fully closed. |
| Förmåga Item type (`formaga`) with transfer AEs | **Done** | New DataModel + sheet + `system.json`/`dode.mjs`/lang registration. Always-active while embedded. Droppable on character sheet, listed under Särskilda förmågor. No in-sheet AE editor yet. |
| Spell temporary AEs (`spellEffect[]`/`spellDuration`) | **Partial** | Schema on `besvarjelse` + `applySpellEffect()` on the actor (creates AE with `duration.rounds`, `flags.<system.id>.source:"spell"`). Cast→apply wiring intentionally stubbed. `spellEffect[]` authored via JSON/API. |
| Scene modifier utility (`SceneEffects`) | **Done** | `scripts/utils/scene-effects.mjs`, exposed as `game.dode.SceneEffects`. `applyToScene`/`removeFromScene` over active-scene token actors, `flags.<system.id>.source:"scene"`. |
| ~~Hjälteförmågor wizard step (0 slots currently)~~ | *(removed — see row below)* | This row conflated the "formagor" wizard step's slot count (`abilityRollsByNiva`, KH s.3, särskilda förmågor) with the unrelated HP-based hjälteförmågor mechanic (row above, HH s.20/46-48). A prior session zeroed `abilityRollsByNiva` based on that conflation, which broke the still-live Fas 8 MVP step. Fixed 2026-07-26: table restored (`vanlig:1, slumpens-hjalte:2, sann-hjalte:3, gudafodd:4`, KH s.3 + ⚠ extrapolation for gudafodd). See `scripts/helpers/config.mjs` comment. Live-verified 2026-07-26: wizard step 6/14 shows 2 förmåga rows for `slumpens-hjalte`, matching the table. |
| Content art (all compendium documents + magic schools) | **Done (2026-07-27)** | **Zero placeholder icons remain.** All 106 compendium documents plus the 13 magic schools carry generated 1024×1024 art in the house style (`docs/dev/ART_STYLE.md`). Coverage: 13 races + 36 professions (gendered `-man`/`-kvinna` variants, session earlier today), then this pass added 33 equipment items, 2 magic items, 14 monsters (`img` **and** `prototypeToken.texture.src`), 8 spells, 13 magic school symbols. Schools live in `DODE.magicSchoolSkills` rather than a pack, so they got an `img` field on the config row, passed through to the wizard card template and onto the `fardighet` item the `magiskola` step creates. ART_STYLE.md gained three non-portrait templates (object icon / bestiary creature / spell-arcane symbol) — forcing a sword through the `waist-up portrait` template does not work. Live-verified: 186 asset URLs HEAD-checked in a running world with 0 broken, all 13 school cards and all 33 equipment cards render (`naturalWidth > 0`), and an end-to-end Magiker creation produced an actor whose `img`/token came from the profession portrait and whose Nekromanti skill item carried the school symbol. 0 console errors. ⚠ One real trap found: the config key `rostmagi` is **Röstmagi** (voice magic) — the first icon was generated as metal *rust* and had to be redone. Check `lang/sv.json` for what a key actually means before describing a motif. The whole flow is now mandatory pipeline step 2b in `CLAUDE.md` ("Bildpipeline") so new content never ships with `icons/svg/item-bag.svg` again. |
| Game Settings registration | **Not Started** | Zero `game.settings.register()` calls anywhere. Needed for: active source books, NPC SB auto-apply, fumble table automation. |
| RollTable for hjältedådstabell | **Not Started** | `DODE.hjaltedadTable` remains a JS array in `config.mjs`. No `RollTable` document or compendium pack. |
| Localization sweep | **Not Started** | ~45 hardcoded Swedish strings in wizard, sheets, config. `lang/sv.json` covers types/attributes/skills but not UI labels. Gotcha found 2026-07-26: `system.json` only registers `sv`; a fresh Foundry world defaults Core Language to `en`, and since there's no `en.json` fallback every `{{localize "DODE...."}}` call then renders the raw key (e.g. `DODE.Actor.Ras`) instead of text. Not a code bug — just requires the GM to set Core Language to Svenska in Configure Settings on a new world. Worth a README/setup-guide callout. |
| `system.json` TODO URLs | **Not Started** | `authors[0].url`, `url`, `manifest`, `download` are all `https://github.com/TODO/...` placeholders. |
| `CHANGELOG.md` | **Not Started** | `system.json` references it; file does not exist. |
| Niva schema migration (3→4 tier) | **Not Started** | Any actor created before the 4-tier `niva` change has a value not in the current `choices` list. No migration script. |
| Combat system (attack→damage, shield, backstab) | **Not Started** | Basic `rollSkill`/`rollAttack`/`rollWeaponDamage`/`castSpell` exist. No attack→damage chaining, shield parry/break, backstab mechanics, or distance modifiers. |

---

## 3. Open Backlog

### Critical

1. ~~**Fix `system.json` placeholder URLs.**~~ **Done (2026-07-26).** `url` had already been fixed to the real repo in an earlier session, but `authors[0].url`, `manifest`, and `download` were still `https://github.com/TODO/...` — found during a backlog review and corrected to `github.com/Adociouse` / `github.com/Adociouse/foundryvtt-drakar-och-demoner-expert`.
2. ~~**Create `CHANGELOG.md`.**~~ **Done.** File exists and is kept current (see `[Unreleased]` section).
3. **Niva schema migration (3→4 tier).** Actors created under the old `vanlig`/`extraordinar`/`hjalte` choices now hold a value not in the current 4-choice list. Needs a migration script or at minimum a documented manual fix. **Broader framing added 2026-07-27:** both dnd5e and PF2e ship a dedicated `migration/` subsystem (PF2e additionally has `migration-summary` and `compendium-migration-status` UIs) because Foundry migrates *schema* but never your *world data* — see §7.6. This item is really "adopt a minimal migration framework", with `niva` as its first case; there will be more once `system.identified`, skill modifiers, etc. land.
4. **Verify/accept BP/EP/maxFV placeholder numbers.** **Source found 2026-07-27 — the numbers were right, the attribution was wrong.** The **Alver** supplement p.22 (*"Hur du skapar en alv"*) carries an explicit level table: BP **125 / 150 / 175**, ability rolls **1 / 2 / 3**, EP **150 / 200 / 250**, Max FV from start **15 / 17 / 19** for Vanlig / Extraordinär / Hjälte. That sources the 150/175 previously flagged as unsourced extrapolations, and confirms `abilityRollsByNiva`'s existing 1/2/3. Two things still block closing this:
   - `DODE.bpByNiva` currently hardcodes **125 for every tier** — directly contradicting the table. The misleading code comment ("no per-type BP differentiation exists in HH") has been corrected, but the values are deliberately unchanged: the book frames these as *regelförslag* for elf creation specifically, and changing them retroactively shifts every existing character's budget. **Needs a rules decision.**
   - Our `epBudgetTable`/`maxStartFvTable` have an **age dimension** the book's flat per-level numbers lack, so they can't simply be overwritten — the two models need reconciling first.
   - `gudafodd` (the 4th tier) remains an extrapolation either way; the book has only three levels.

### Important

4b. ~~**Compendium visibility / spoiler leak.**~~ **Done (2026-07-27).** Audit found every pack — campaign adventure, Dimön test packs, all 14 monsters, and both magic items — readable by the Player-role account, because no manifest declared `ownership` and Foundry's default is `PLAYER: OBSERVER`. Fixed: `ownership` declared on all six system packs and the campaign module's `adventures` pack; `magiska-foremal` created as a GM-only pack and the two magic items moved out of the shoppable `vapen-utrustning`; the two `world.dimon-*` packs set GM-only via `pack.configure()`. Architecture written up as §7. Live-verified: player sees exactly `raser`/`yrken`/`besvarjelser`/`vapen-utrustning`, GM sees all nine.

4c. ~~**Wizard re-entry / character edit mode.**~~ **Done (2026-07-27)** — see §2. Two scope calls made during design and worth remembering: **race/yrke are read-only in edit mode** (Johan: *"most games don't allow changing these but require you to setup a new character"*) which conveniently eliminates the entire profession-swap skill-reconciliation minefield — no skill ever needs deleting, so edit mode structurally cannot destroy one; and **the equipment step is skipped** because once a character exists, inventory is play state and the wizard cannot tell a chargen purchase from dungeon loot. A GM who genuinely must change race/yrke still drags a replacement onto the sheet, which already swaps correctly.

4d. **`price: 0` on three shields.** `Liten sköld`, `Medelstor sköld`, `Stor sköld` are free in the wizard shop. Almost certainly a data gap rather than intent — check against `UTRUSTNING.md` during the equipment import. (The magic items had the same bug; that half is fixed.)

4a. ~~**Check actor/NPC sheets for the same `.window-content: overflow:hidden` clipping risk as the wizard.**~~ **Done (2026-07-26).** Confirmed and fixed same session: `.dode.sheet.character .window-content` and `.dode.sheet.npc .window-content` now get `overflow-y: auto` in `dode.css`. Also discovered and fixed while there: the NPC sheet had never received the wood-frame border-image / leather background theme that the character sheet and wizard have (`.dode.sheet.npc` was simply missing from those CSS selectors) — added for visual consistency across all three windows.
5. **Game Settings registration.** At minimum: active source books (`world` scope, `Array<String>`), NPC damage bonus auto-apply (`Boolean`, default false — source inconsistency documented), fumble table automation level.
6. **Localization sweep.** Move ~45 hardcoded Swedish strings to `lang/sv.json`. Enables future English localization. No gameplay risk — purely additive.

6a. ~~**Name-based matching is a localization landmine.**~~ **Done (2026-07-27).** `fardighet` gained `system.skillKey`; `DODE.skillKey(name)` is the canonical slugifier (å/ä→a, ö→o, non-alphanumerics→`-`), and all 83 config entries now carry **explicit frozen `key` fields** so a display-name edit can never silently change identity. Every match point moved off names: `#skillPreview` dedupe, `#loadBoughtSkillFv`, `state.fardigheter` keys, `data-skill` in the template, buy/sell handlers, `#applyToActor` reconciliation, and the sheet's skill picker. Legacy skills without a key fall back to `DODE.skillKey(name)` and are **backfilled on the next wizard save**, so migration is self-healing — verified on a 25-skill character: 25 before → 25 after, 0 duplicates, 25 keys backfilled. Profession skills in compendium JSON still derive their key at runtime (they have no explicit `key` field yet) — fine, since both sides use the same function. Original analysis kept below for context.

   **Bug this uncovered:** wizard-created `ras`/`yrke` items had `_stats.compendiumSource === null`, because Foundry only populates that on real compendium *import*, not when creating from `toObject()`. Edit mode's source lookup relied on it, so race and profession silently failed to resolve — meaning base chance was computed **without race modifiers** and profession skills were never reconciled. Fixed by stamping our own `flags.<sysid>.sourceUuid` at creation, plus a name-match fallback (resolved async in `_prepareContext`) for characters made before the flag existed. Raised by Johan 2026-07-27 (*"is not UUID preferred for future English language implementation?"*) while reviewing the test fixtures — the concern generalises well beyond that script. Several places key off **display names** rather than stable identifiers:
   - `character-wizard.mjs` `#applyToActor` reconciles skills by `name.toLowerCase()`
   - `#skillPreview` de-duplicates profession skills against primary skills by name
   - `#loadBoughtSkillFv` keys `state.fardigheter` by skill name
   - `CONFIG.DODE.primarySkills` / `secondarySkills` carry Swedish names as their de-facto identity

   Today this is **safe**, because skill Items are created from the config table and always carry that exact name, so both sides of every comparison use the same string. It breaks the moment either (a) those config names get run through `game.i18n`, or (b) a Babele-style module renames compendium documents at runtime — a character created under one language and edited under another would fail to match and **silently create duplicate skills**. Fix when localizing: give `fardighet` a stable `system.skillKey` (e.g. `"smyga"`) separate from its display name, and match on that everywhere. Cheap now, expensive after real characters exist. The test fixtures already moved to UUID references for exactly this reason (`docs/dev/seed-test-party.js`).
7. **Skill modifier system (auto-sourced).** Flat `bonus`/`total` field pattern done (2026-07-26, see §2) — this item now specifically means the automatic race/yrke/förmåga-sourced `modifiers[]`/`effectiveFv` layer, required before ability bonuses like Skogsalv's +10 CL Gömma sig can be mechanically active. Blocked on an architecture decision (embedded-Item skills can't be targeted by transfer AEs the way actor attributes can — see §2 for the technical detail) before implementation.
8. **Hjältedådstabell as RollTable.** 13-row, 1d20 table. Natural fit for Foundry `RollTable` — rollable from chat, linkable in journals.
9. **Migrate deprecated Foundry API calls.** `renderTemplate` → `foundry.applications.handlebars.renderTemplate` (fv-roll.mjs, damage-roll.mjs). `TextEditor.getDragEventData` → namespaced v14 equivalent. **Partially done (2026-07-26):** `DoDeActiveEffect` migrated from the deprecated `apply(actor, change)`/`_applyLegacy` override to `shouldApplyChange(change, {phase})` — see §1/§6. `renderTemplate`/`getDragEventData` still outstanding.
10. ~~**Live-verify Fas 4 age attribute modifiers.**~~ **Done (2026-07-26).** Live-verified via console (not the wizard UI directly, but the same `updateActor` hook the wizard's age step exercises): Ung → SMI+1 and Ung → Gammal → STY-3/FYS-2/SMI-2/PSY+2 both confirmed correct, including the second-change case that was previously broken (see §2).
11. **Dual-computation drift test.** A small test harness asserting `wizard preview === DataModel prepareDerivedData()` across niva×age×race combinations. Highest-leverage single test for this architecture.

### Nice-to-have

12a. ~~**Give at least one real compendium weapon/armor an AE.**~~ **Done (2026-07-26).** Added two: `Väktarklingan` (vapen, +2 STY) and `Alvskölden` (rustning, +2 FYS), both `flags.<system.id>.{source:"item", magical:true}` in `packs/vapen-utrustning/_source/`. Also set `system.equipped: false` explicitly on all 35 items in that pack (previously absent, defaulted `true` via the DataModel). Packed via `npm run packs:pack` (session 10). **Drag-to-actor live-verified 2026-07-26 (session 11, Playwright)** against the `Testrollperson` Dvärg test actor: both items drop as `equipped:false`, then correctly toggle the attribute bonus on/off (Väktarklingan: STY 13↔15; Alvskölden: FYS 12↔14), 0 functional console errors. See §1/§2 for full detail. Closed for real.
12. ~~**Förmågor full table.**~~ **Done (2026-07-27).** Ported (not re-transcribed from OCR — already existed curated in the Roll20 project's `docs/extracts/DODE_Grundregelbok_fullextract.md`) into `CONFIG.DODE.specialAbilitiesTable` + `CONFIG.DODE.rollSpecialAbility()`, wired to a "Slå fram förmåga" button in the wizard and on the character sheet. Live-verified. Note: this is only the RP-level base table (creation-time slots) — the separate Hjälteförmågor/Mörka hjälteförmågor tables (HH, post-creation Hjältepoäng-spending) are a different, still-unbuilt mechanic (see "HP-based hjälteförmågor (post-creation)" row in §2), already transcribed in the Roll20 project too but intentionally not pulled in this pass.
12d. **Per-lineage särskilda förmågor (Alver s.23-24).** Each elf lineage has its own entries on the särskilda förmågor table — Grottalv *Metallkänsla*/*Mörkerseende*, Gråalv *Uthållig simmare*/*Delfinernas vän*, Injir *Skicklig ryttare*/*Stålsättning*, Mörkeralv *Blodtörst*, Skogsalv *Utmärkt balanssinne* — plus general elf entries that override base-rule results (e.g. Baneman +10 instead of the standard bonus, Härdig mot element +15, or +20 for injir). Currently recorded as prose in each lineage's `automaticAbilities`; wiring them into `DODE.specialAbilitiesTable` needs a per-race table-override mechanism that doesn't exist yet. Alver s.22-23 also has **Syn-/Hörseltabeller** (1T6+3+BP → FV bonuses to Upptäcka fara / Finna dolda ting / Lyssna, cumulative) that are entirely unimplemented.

12e. **`yrke` needs a real "is a magic user" field.** The `magiskola` wizard step currently decides via a **name regex** (`/magiker/i`) because nothing on `item-yrke.mjs` marks a profession as spellcasting. Same localisation weakness as 6a, and it also means magic-using specialisations (Paladin's Mentalism, Fingerkonstnär's minimagi) are not detected. Add an explicit boolean/enum field and switch the check to it.

12b. **Item identification (identified/unidentified).** Not a Foundry feature — verified zero identification concept in core; dnd5e and PF2e each built their own (PF2e: `item/identification.ts`, see §7.6). Would give the "mysterious glowing sword" flow Johan described: a `system.identified` flag on `vapen`/`rustning`, name/description masking in the sheets, a GM reveal toggle. The existing `DoDeActiveEffect.shouldApplyChange()` gate (§1) is the natural place to also suppress the bonus until identified, so this is smaller than it looks. Pairs with §7.2's loot workflow.

12c. **Secret spells / environment effects pack for the campaign module.** Johan 2026-07-27: *"there will be spells and environment effects that should not be player visible."* Per §7.3's tier rule these belong in the campaign module (GM-only), not in the system's player-visible `besvarjelser`. No pack exists yet.

13. **"Choose 12 of N" profession skill selection.** Currently all matched skills get `yrkesfardighet` cost tier. RP s.30 says the player picks 12.
14. **Expand compendium coverage.** **Partially done (2026-07-27)** — races and professions are no longer the gap: 6 elf lineages (Alver s.22) brought races 7→13, and 25 specialisations (KH/T&L, via the Roll20 project's `docs/wiki/YRKEN.md`) brought professions 11→36. Still thin: **weapons ~50%**, **spells <5%** (8 of the full MAG list), **monsters** (14 sample entries). ⚠ Every future addition must also ship art in the same pass — see `CLAUDE.md`s "Bildpipeline" (pipeline step 2b); the current 106 documents are 100% covered and that state should not be allowed to regress. Note the spell gap is the awkward one: 13 magic schools are pickable in the wizard but only 8 spells exist across all of them.

   **14a. Spell source verified 2026-07-27 — the full catalogue exists, curated and book-cited.** The Roll20 project's `docs/wiki/MAGI.md` §"Besvärjelsetabeller per skola" holds **331 spells + 31 minibesvärjelser across all 13 schools**, each with S-värde / varaktighet / räckvidd / effect and sourced to Formelboken s.1–74. Fidelity spot-checked mechanically: **348 of its 363 spell names (95%) are verbatim-findable in the raw book OCR** (`docs/extracts/D&DE Magi_*.txt`, diacritic-folded match) — the misses look like OCR damage, not invention. So this is a *porting* job like the secondary-skills and särskilda-förmågor catalogues were, **not** an OCR transcription from scratch. Per-school counts: Mentalism 57, Elementarmagi 42, Harmonism 30, Animism 29, Symbolism 27, Spiritism 26, Nekromanti 25, Häxkonster 23, Illusionism 23, Stavmagi 20, Röstmagi 18, Demonologi 9, Allmänna 2. ⚠ Alkemi has **no ordinary spells at all** by design (the alchemist brews elixirs instead) — the wizard's magiskola step must not imply otherwise. ⚠ OCR uncertainty is unevenly distributed: Nekromanti (49 `⚠`), Symbolism (43), Animism (38), Harmonism (37), Elementarmagi (33) carry many flagged values; Illusionism (3) and Röstmagi (5) are nearly clean. Carry those flags into the item data, per the project's rules-fidelity stance.

   ⚠ **Do NOT port the standalone HTML chargen's spell list.** Verified same session: its 48 spells (a tidy 8 per school across only 6 schools) are largely **not book content** — only 13 appear anywhere in `MAGI.md` and only 22 in the raw book OCR, with whole schools fabricated (Symbolism 0/8 real: `Varningsruna`/`Skyddsruna`/`Sigillsköld`/`Eldssigill`/`Banruna`/`Bindningsruna`/`Kraftruna`/`Trollkorsruna` match nothing in the book's actual 27-spell Symbolism table; Nekromanti likewise). Its S-values are also a re-tiering (S1–S12, evenly spread) rather than the book's S2–S22 — e.g. it lists `BLIXT S8` and `ELD S2` where Formelboken says Blixt S6 and Eld S6. This is the mirror image of the elf-lineage case: the HTML was *right* about the Alver data and is *wrong* here, which is exactly why `CLAUDE.md` says to verify against the curated rules docs before porting anything from it.

   **14b. Verified spells ported 2026-07-27 — the compendium went 8 → 176.** Johan's call: port everything that passed the verification filter, leave the rest. Filter = the `MAGI.md` row carries **no `⚠` anywhere** AND the spell name is verbatim-findable (diacritic-folded) in the raw book OCR. Of 332 rows: 145 carried a `⚠`, 6 were unfindable, 25 were Nekromanti (skipped — Johan is sourcing that school manually from another book he recalls it being in), 6 were duplicates of what we already shipped → **168 new items**. Per school: Mentalism 36, Elementarmagi 30 (25 new), Illusionism 18, Spiritism 18, Häxkonster 17, Stavmagi 15, Röstmagi 14, Harmonism 13, Animism 9 (6 new), Symbolism 4, Demonologi 2. ⚠ Symbolism and Animism come out badly (4 of 27, 9 of 29) precisely because they are the most OCR-damaged schools — that is the filter working, not a porting bug. The two "Allmänna besvärjelser" (Permanens, Nexus — learnable from any school) have no school-agnostic value in the `school` enum, so they are filed under `elementarmagi` with a note in their description; **a proper `allmanna` school value is the cleaner fix** if the enum ever gets touched. No schema change was needed. Live-verified: 176 documents load with 0 console errors, every `sValue`/`school` valid, and a spell dragged onto a character renders with its cast button and effektgrad input.

   ⚠ **Spell art is deliberately the school symbol, not per-spell icons** (Johan's call, 2026-07-27). Each of the 168 new spells shows its magic school's sigil; the original 8 keep their bespoke icons. This is a design choice rather than a placeholder — a spell bearing its school's mark reads as intentional in a way `icons/svg/item-bag.svg` never did — but distinct per-spell art remains desirable. **New backlog item: generate 165 distinct spell icons.** Until then the "Bildpipeline" rule in `CLAUDE.md` is satisfied by the school-symbol fallback for spells specifically.

   **14c. Minibesvärjelser are a different mechanic and must NOT be modelled as `besvarjelse` items.** Johan flagged this while the port was running, and MAG s.23 (via `MAGI.md` §Minibesvärjelser) backs it: a minibesvärjelse **requires no CL check — it always succeeds**, costs a flat **1 PSY** (no effektgrad scaling), is **always Kvick** (resolves in the same SR), and **need not be written in the formelsamling** — the magician simply always has it. There is no roll, no failure case, no snedtändning and no effektgrad, which is most of what `besvarjelse` and `castSpell()` exist to model; a cast button that rolls would be actively wrong for them. They are flavour/utility ("Lugna", "Putsa/Smutsa", "Smaksätt", "Vindpust", "Bläckfinger", "Kritfinger"), explicitly meant for frequent out-of-combat use to build an aura of mystique — not battle magic. The 31 minibesvärjelser in `MAGI.md` were consequently **left out of the port** (the extractor only reads the 5-column spell tables; the mini tables are 2-column). Their access rule is also school-derived rather than per-item: a magician automatically has the minimagi of whichever school they have the **highest FV** in, and outward gestures stop being required at FV 15+, becoming near-unconscious at FV 25+. **New backlog item 25** covers building them as their own thing rather than shoehorning them in.

   **The remaining spell gap is now the `⚠` rows, not missing content.** 145 flagged rows + 25 Nekromanti rows are still unported. Closing them means resolving OCR damage against the PDFs (`Drakar och Demoner Expert Files/`) rather than porting — the `⚠` values are things like a missing varaktighet or an unreadable S-värde, not missing spells.

   **Our existing 8 spells are correct** — all 8 match `MAGI.md` exactly on school, S-värde, räckvidd and varaktighet (Låga S2, Sköld S3, Blixt S6, Eld S6, Förtrolla vapen S6, Kamouflage S7, Väderförutsägelse S8, Hela S12). `item-besvarjelse.mjs` already has every field the catalogue needs (`school`, `sValue`, `duration`, `range`, `ritual`, `kvick`, `description`), so a bulk port needs no schema change. One small defect: **`Eld` has an empty `duration`** where Formelboken says `Omedelbar` (`Kamouflage` and `Låga` are also empty, but there the source itself is `⚠`).
15. ~~**Prototype token defaults.**~~ **Done (2026-07-27)** — see §2. Both manifest keys added *and* the wizard now sets a full prototype token (actorLink, sight, disposition, portrait) that it previously never touched.

15a. **Store / merchant actor architecture.** Johan 2026-07-27, deciding the equipment question: *"Equipment likely should have its own architecture as you might want to open up different stores while playing afterward. There should probably be something like a default store actor where one can buy normal equipment."* This is where post-chargen buying lives, and it is the concrete implementation of §7.2's merchant-actor workflow (stock in an NPC actor, party granted `OBSERVER` while in town, revoked after). Would also give the magic-shop scenario a home without ever exposing the full `magiska-foremal` catalogue.

15b. **GM-granted out-of-profession learning.** Johan's scenarios: the whole party joins a knight school and learns basic jousting; a mage joins a guild — or a necromancer cult — and learns previously hidden spells from a module pack. This is a *GM grants content* flow, deliberately **not** wizard re-entry (which is locked to the character's own profession). The skill picker plus GM-only module packs (§7.5 registry) already cover much of the mechanism; what's missing is a deliberate GM-facing "teach this to these characters" action.

15d. ~~**Test fixtures / test-case catalogue.**~~ **Done (2026-07-27).** `docs/TEST_CASES.md` (catalogue + module-compatibility checklist + manual edge cases) and `docs/dev/seed-test-party.js` (console-pasteable seeder). Seven fixtures: a four-character party covering the mechanical range (race bonus, no-race-modifier baseline, negative race mod, caster) plus three edge cases (no race/profession, highest niva × worst age, negative attribute). Fixtures are created **through the wizard's own create path**, so seeding doubles as a wizard regression test, and are tagged `flags.<sysid>.testFixture` for exact teardown. Verified: all 7 seed cleanly, and the negative-attribute case (`Anka` KAR −1) renders without error at Grupp 0. Both files live under `docs/`, which is excluded from the runtime distribution zip.

15c. **Verify popular optional modules work with this system.** Johan 2026-07-27 (Carousel Combat Tracker looks especially desirable). Community modules commonly assume dnd5e/PF2e data paths, so each needs checking against ours — most relevant are the token/combat ones (Carousel Combat Tracker, Monk's Combat Marker, Dice So Nice, Dice Tray, Torch, Tokenizer, PopOut!). The `primaryTokenAttribute`/`secondaryTokenAttribute` work in 15 helps here: several combat/HUD modules read the token bar attributes rather than system-specific fields.
16. **English localization.** Low priority per project scope.

25. **Minibesvärjelser as their own mechanic (31 known).** See backlog 14c for why they cannot be `besvarjelse` items: no CL check, flat 1 PSY, always Kvick, no effektgrad, no formelsamling entry. Access is derived from the character's highest-FV school rather than owned per item, and the FV 15/25 thresholds change only the required åthävor, not the outcome. Likely shape: a config table keyed by school (like `DODE.magicSchoolSkills`) plus a small sheet section that spends 1 PSY and posts a chat card with **no roll** — deliberately not the `castSpell()` path. Source rules: MAG s.23; the per-school lists are already transcribed in `MAGI.md`'s school sections.

24. **Distinct per-spell icons (165).** The 168 spells ported 2026-07-27 all display their magic school's sigil rather than individual art (see backlog 14b for why that was chosen over a 165-image generation run). Not a placeholder, but per-spell icons would be better — `docs/dev/ART_STYLE.md`'s spell/arcane-symbol template and the slug already written into each item's `img` path make this a mechanical batch whenever it's worth the time. **Groundwork done 2026-07-27 (Johan's suggestion):** 13 per-school background plates now exist in `assets/backgrounds/magiskolor/<skolnyckel>.png` — an alchemist's bench for Alkemi, a fog-shrouded graveyard for Nekromanti, and so on. The intent is that every spell in a school shares its environment so the school is recognisable before the name is read; only the central motif changes. Template and the full list of environments are in `ART_STYLE.md` §Skolbakgrund.

### Deferred

17. **RuleProfile metadata layer.** Per-table `ruleMeta` tracking source books and extrapolation status. Revisit when adding content from Alver, Tjuvar och Lönnmördare, or Magikerns Handbok.
18. **Combat refinements.** Attack→damage chaining, shield parry bonus + 1/20 break chance, assassin backstab (no-SB), distance/movement modifiers.
19. **Scene/macro modifier system.** AE-based scene-level effects (e.g., "Dimön PSY ×2"). Requires the universal modifier system.
20. **HP-based hjälteförmågor.** Post-creation mechanic: spend HP to roll 1T20+HP on the hjälteförmåga table. Sheet UI, not wizard. **Source content located 2026-07-27** (previously just "18 entries" placeholder): 35 Hjälteförmågor + 35 Mörka hjälteförmågor already transcribed in the Roll20 project's `docs/extracts/HH_Hjaltarnas_Handbok_extract.md` (lines 218-245 and 671-698), same porting approach as backlog 12 above. Deliberately NOT pulled into this session's scope — a past session (see `memory.md` session 7) conflated this mechanic with the creation-time särskilda förmågor slots (backlog 12); keep them architecturally separate.
21. **Automated Snedtändningstabell.** Magic fumble → currently a chat notice. Could become a RollTable.
22. **CI pipeline.** ESLint + JSON validation on push/PR. Set up when going public.
23. **GM-only character-sheet lock + audit whisper.** Fully designed and verified against the actual installed Foundry build 2026-07-27, not yet implemented (paused in favor of backlog 12/skill-catalog work above, which it depends on being real data first). Scope: race/yrke/ålder/attribute-Bas become GM-only editable (players see disabled fields); skill/ability add-delete becomes GM-only (no EP-cost enforcement — GM grants/removes "as they see fit"); a `createItem` hook whispers a GM-only chat notice when an item is added to a `character` actor (skip when the acting user is GM, skip on wizard bulk-creation via a `dodeSkipAudit` create-option flag). Mechanism: `context.isGM = game.user.isGM` threaded through `actor-character-sheet.mjs` + `item-sheet.mjs` + templates (`{{#unless isGM}}disabled{{/unless}}`), guard clauses on the relevant `#onXxx` handlers, `ChatMessage.getWhisperRecipients("GM")` for the whisper. `createItem` fires once per connected client (guard: `if (userId !== game.user.id) return;` first line).

    **Role architecture — decided 2026-07-27 (Johan), after reviewing Foundry's 5-role model:** use native `game.user.isGM` (= role ≥ Assistant GM) as the single threshold; **Trusted Player is treated exactly as Player** (no middle tier) — so every gated control has exactly two states, locked or unlocked. Rejected alternatives: strict `hasRole(GAMEMASTER, {exact:true})` (diverges from Foundry convention, would surprise anyone used to other systems, and Assistant GM exists precisely to be a co-referee), and a Trusted middle tier that could self-manage skills (doubles the state count per control for no clear table-level need). No world setting for the threshold either — revisit only if an actual table needs it. See §6's "isGM means role ≥ Assistant GM" rule for the underlying verified API facts and the security caveat (this is a UX guardrail, not an enforcement boundary — say so in any player-facing docs).

    **Implementation note:** put the predicates in one place (e.g. `scripts/helpers/permissions.mjs` exporting `canEditCharacteristics()` / `canManageSkills()`) rather than scattering `game.user.isGM` across handlers and templates — same centralisation reasoning that produced `DoDeActiveEffect.isGateOpen()` (§1), so the threshold stays a one-line change.

    **Test user available:** Johan created a `Player11` account manually 2026-07-27 (role 1 = `PLAYER`, `isGM: false`, confirmed via console) in the `Ereb Altor` world — no need to `User.create(...)` one. To live-verify: grant it `OWNER` ownership on a test actor, set a password, join from a second browser session, and confirm locked controls render disabled/hidden there while the GM's own view stays fully interactive.

---

## 4. Source Rules Reference

| Source | Code | Coverage | Notes |
|--------|------|----------|-------|
| D&DE Grundreglerna / Bok I Rollpersonen (RP) | RP | **High** | Attribute generation (3d6/2d6+6), skill roll mechanic (1d20≤FV), EP cost curve, social standing, start capital, age multipliers — all exact. KP formula exact but page citation unverified. SB/movement table breakpoints flagged `⚠` per source doc. |
| Krigarens Handbok (KH) | KH | **Partial** | BP-per-niva (`vanlig: 125` sourced, other 3 tiers unsourced), EP budget table, max start FV table. No warrior specializations (8 documented). |
| Hjältarnas Handbok (HH) | HH | **Narrative only** | Öde-typer (3 narrative tiers) merged into niva picker. No mechanical effects — confirmed intentional per HH pp.37–39. Hjältedådstabell (13 rows) in `config.mjs` as JS array, not yet a RollTable. HP-based hjälteförmågor unbuilt. |
| D&DE Magi (MAG) | MAG | **Partial** | `castSpell()` implements CL=S−2×(E−1) with per-grade PSY cost. `⚠` CL uses tabulated school value, not personal skill value — flagged simplification. Snedtändningstabellen is a chat notice only. 8 of 150+ spells in compendium. |
| Alver / Svartfolk / Tjuvar och Lönnmördare | — | **Not started** | 0 alv subraces (11 documented), 0 profession specializations (~25 across Krigare/Tjuv/Lönnmördare/Bard). Base races and professions are complete. |

---

## 5. GitHub Publication Rules

**What's tracked:** `system.json`, `scripts/`, `templates/`, `lang/`, `styles/`, `assets/`, `packs/` (both LevelDB and `_source/` JSON), `LICENSE`, `README.md`, `package.json`, `package-lock.json`, and this `docs/` directory.

**What's gitignored:** AI working files at repo root (`CLAUDE.md`, `ACTIVE_TASK.md`, `memory.md`, `PLAN_*.md`) via `/*.md` + `!/README.md`. LevelDB lock/log files. `node_modules/`. `.claude/`. Editor config (`.vscode/`).

**Pre-push checklist:**
1. `README.md` reflects current feature set
2. `system.json` version bumped if this is a release
3. New `packs/*/_source/*.json` files committed alongside their LevelDB
4. No AI working files or OCR extracts included
5. `.gitignore` covers any new file types

---

## 6. Foundry Development Guidelines

> Distilled from a real bug hunt (2026-07-26, see §1/§2 and `memory.md` session 8): two ActiveEffect bugs shipped and passed `node --check` + static review because they relied on Foundry API assumptions that were never checked against the actual installed Foundry version. This section exists so the next agent doesn't repeat that mistake — Foundry's Document/ActiveEffect internals genuinely change between major versions (v10 → v14), and this project targets "minimum 12, verified against 14" (see `CLAUDE.md`), which is exactly the range where several relevant APIs moved.

### Rule: flag scopes must be `game.system.id`, never an invented namespace

Foundry's `Document#getFlag(scope, key)` / `setFlag` / `unsetFlag` validate `scope` against `ActiveEffect.CHANGE_TYPES`-adjacent logic in `DatabaseBackend#getFlagScopes()`: the only valid values are `"core"`, `"world"`, `game.system.id` (`"drakar-och-demoner-expert"` for this system), or the id of a currently-active module. **There is no mechanism to register a short custom alias like `"dode"`** — using one throws `Flag scope "X" is not valid or not currently active` on every read, always, not just sometimes. This project stored/read flags under `"dode"` for months before this was caught, because:
- The write side (`"flags.dode.source": "age"` in an `update()`/`createEmbeddedDocuments()` call) does **not** validate the scope — Foundry just writes whatever dotted path you give it. Only the *read* side (`getFlag`) validates. So bad data got persisted silently and only failed later, at read time.
- Foundry wraps `prepareDerivedData()` in a try/catch (`Document._safePrepareData`) that logs the error via `Hooks.onError` and continues with stale/partial data instead of crashing the browser tab — so the failure mode looks like "some values seem wrong" or "nothing happened," not an obvious crash.

**Practical rule:** always use `` `flags.${game.system.id}.yourKey` `` (JS) or the literal system id string (compendium JSON, which can't reference `game.system.id`) — never a short alias. When grepping for existing flag usage, search for the literal scope string being used, not just the word "flags", since a wrong-but-plausible-looking scope won't be caught by type checking or `node --check`.

### Rule: verify ActiveEffect override points against the *actual installed* Foundry version, not memory

This system's Foundry install lives at `C:\Program Files\Foundry Virtual Tabletop\resources\app\public\scripts\foundry.mjs` (a single bundled, non-minified-enough-to-grep file — line numbers are stable within a build). Before assuming any Foundry API behavior (an override point, a deprecation, a validation rule), grep this file directly rather than relying on training data or older docs — Foundry ships breaking changes to core Document/ActiveEffect internals across major versions with only a `logCompatibilityWarning` (visible in the browser console, `since`/`until` versions in the message) as a bridge.

Concretely for ActiveEffects in **v14**: overriding the instance method `apply(actor, change)` (the pre-v13 pattern, still shown in a lot of community code/tutorials) **does not work** for changes whose `key` resolves to a real DataModel schema field — which `system.attributes.*.bonus` is, since this system's data model registers it as a proper `NumberField`. `ActiveEffect.applyChange()`'s static pipeline (`foundry.mjs` ~line 50100+) resolves the field directly via `targetDoc.system.getFieldForProperty()` and calls `applyChangeField()`/`CHANGE_TYPES[change.type].handler` — it only falls back to the deprecated `_applyLegacy()`/`apply()` path when the field can't be resolved that way. The correct v14 hook for conditionally gating whether an effect's change applies at all is:

```js
/** @override */
shouldApplyChange(change, {phase} = {}) {
  if (/* your condition to suppress this change */) return false;
  return super.shouldApplyChange(change, {phase});
}
```

`Actor#applyActiveEffects(phase)` calls `effect.shouldApplyChange(change, {phase})` for every change on every effect returned by `Actor#allApplicableEffects()` — which includes both actor-owned effects and `transfer:true` effects on embedded Items. This is also the reason the next rule matters:

### Rule: `Actor#effects` vs `Actor#appliedEffects` — pick the right collection

- **`actor.effects`** — an `EmbeddedCollection` of ActiveEffects owned *directly* by the Actor document. Does **not** include transfer effects living on embedded Items, even though those effects are actively modifying the actor.
- **`actor.appliedEffects`** — a getter that walks `allApplicableEffects()` (actor-owned + every `transfer:true` effect on every embedded Item) and filters to `effect.active`. This is what you want when checking "does this actor currently have an effect from source X applied," regardless of whether it lives on the actor or an item.

In this codebase: race AEs are `transfer:true` effects on the embedded `ras` Item → check `appliedEffects`. Age AEs are created directly on the Actor (`transfer:false`) → `effects` is correct for those. Getting this backwards doesn't throw or warn — it just silently returns the wrong boolean, which is exactly what caused the race-bonus double-counting bug.

### Rule: `.window-content` does not scroll by default — you must opt in

Foundry's core CSS (`less2/applications/applications.less`) sets `.window-content { flex: 1; display: flex; flex-flow: column nowrap; overflow: hidden; }` for **every** ApplicationV2 window, with no exceptions. The `scrollable` array on a `PARTS` entry (`{ template: "...", scrollable: [""] }`) does **not** grant scrolling — despite the name, it only tells Foundry which selectors' `scrollTop`/`scrollLeft` to save and restore across re-renders (see `_preSyncPartState` in `foundry.mjs`). If your app's content can ever exceed the window's fixed height — which a multi-step wizard with variable-length content (skill tables, card grids, equipment lists) absolutely will — you must add your own CSS: give a wrapper around the variable content `overflow-y: auto` and `flex: 1; min-height: 0`, and give any fixed chrome (headers, nav footers) `flex: 0 0 auto`, all inside a `display: flex; flex-direction: column` ancestor. Without this, overflowing content is simply clipped with **no scrollbar and no way to reach it** — this is exactly what happened to the character wizard's nav buttons on the Färdigheter step (fixed 2026-07-26, see "Wizard architecture" above). This system's CSS (`styles/dode.css`) had zero `overflow` rules anywhere before that fix — worth checking any other custom `ApplicationV2` window (not just the wizard) for the same gap before assuming it's fine.

### Rule: stop/restart the Foundry server via its own executable — never a bare `node main.js`

Discovered session 10 (2026-07-26): asked to restart Foundry using only Bash (no PowerShell, no `fvtt` CLI), the obvious approach — `node "resources/app/main.js" --dataPath=...` — starts a working server (port 30000 responds, world data loads, `prepareDerivedData()` etc. all fine) but **drops the client into a License Key Activation screen** instead of the normal Setup/world-list page. The installed Electron app (`Foundry Virtual Tabletop.exe`) supplies the license during its own startup sequence; invoking `resources/app/main.js` directly with a bare system Node.js bypasses that, even though the server process itself is otherwise fully functional and `Data/Config/` is untouched.

**Correct stop/restart procedure (Bash, Windows, no PowerShell):**

```bash
# 1. Find the process listening on the Foundry port
netstat -ano | grep ":30000" | grep LISTENING
# -> note the PID in the last column

# 2. Stop it
taskkill //PID <pid> //F

# 3. Restart via the actual Electron executable — NOT node main.js
cd "/c/Program Files/Foundry Virtual Tabletop" && nohup ./"Foundry Virtual Tabletop.exe" > /tmp/foundry.log 2>&1 &
disown

# 4. Poll until it responds
for i in $(seq 1 24); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:30000 2>/dev/null)
  [ "$code" != "000" ] && [ -n "$code" ] && echo "up after $((i*5))s" && break
  sleep 5
done
```

No `--dataPath` argument is needed — the Electron app remembers the last-used data path from its own Electron `userData` config, independent of `Data/Config/options.json`. This matches the working directory Windows itself uses for the app's shortcut (`Start in: C:\Program Files\Foundry Virtual Tabletop`).

**Practical rule:** always stop Foundry with `taskkill` on the PID bound to port 30000, and always restart it via `Foundry Virtual Tabletop.exe`, never `node main.js` directly — even though the latter looks like it works (server responds, no console errors on the server side) until you actually load the client and hit the activation wall. This is unrelated to, and in addition to, the pre-existing rule of never running `packs:pack`/`packs:unpack` while the server holds the LevelDB packs open (§ "Kompendiebyggnad" in `ACTIVE_TASK.md`) — both rules apply on every restart cycle: stop fully → pack (if needed) → restart via the `.exe`.

### Rule: `isGM` means "role ≥ Assistant GM", and roles ≠ ownership

Verified against the installed v14 build 2026-07-27 (`foundry.mjs` line refs below), because the naming actively misleads:

- **`User#isGM` is `hasRole(USER_ROLES.ASSISTANT)`** (`:19381`) — i.e. `role >= 3`, so an **Assistant Gamemaster passes every `isGM` check**. `isGM` does *not* mean "is the Gamemaster". `hasRole(role)` is a `>=` comparison unless you pass `{exact: true}` (`:19450`) — that's the only way to gate strictly on role 4.
- Roles (`USER_ROLES`, `:4457`): `NONE:0, PLAYER:1, TRUSTED:2, ASSISTANT:3, GAMEMASTER:4`. Foundry's own defaults use `TRUSTED` for *tool* privileges (`DRAWING_CREATE`, `BROADCAST_AUDIO` — `:4529`/`:4511`), not for authority over other players' rules data. Treat Trusted as a Player for game-rules purposes unless there's a specific reason not to.
- **`USER_PERMISSIONS` is `deepFreeze`'d** (`:4504`) — a system **cannot** register its own entry into the core "Configure User Permissions" dialog. System-specific policy toggles must be a `game.settings.register()` world setting instead.
- **Roles and ownership are orthogonal axes.** Ownership is per-document (`DOCUMENT_OWNERSHIP_LEVELS`: `NONE:0, LIMITED:1, OBSERVER:2, OWNER:3`, `:3694`) and answers "is this actor mine". `Document#testUserPermission` (`:14791`) short-circuits with `if (user.isGM) level = OWNER` — GMs implicitly own everything, so never add a redundant `isGM` check alongside an ownership check.
- `ActorSheetV2#isEditable` (`:38070`) only consults ownership level and pack-locked state. **There is no built-in "GM vs. player-who-owns-this-actor" distinction anywhere in core** — if you need that split, `game.user.isGM` is the correct and only mechanism, not a reinvention of something Foundry already provides.

**Security caveat (design accordingly, and say so in the UI/docs):** role checks, `disabled` attributes, and `preUpdate*` hooks are **UX guardrails, not a security boundary**. The Foundry server validates ownership and schema but never executes system JS, so field-level rules cannot be enforced server-side — a player holding `OWNER` on their actor can set any field from the console. Layer defences by decreasing cost (template `disabled`/hidden → action-handler guard clause → optional `preUpdate*` hook returning `false`), and accept that a determined owner can bypass all three. The only true enforcement would be demoting players to `OBSERVER` and proxying every change through the GM — rejected as disproportionate for this project's home-game use case.

### Rule: compendium visibility is per-PACK and role-based — there is no per-document hiding

Verified 2026-07-27. `CompendiumCollection#getUserLevel` (`foundry.mjs:28012`) computes a user's access to a pack by iterating **only** the pack's own `ownership` map (a `USER_ROLES` → `DOCUMENT_OWNERSHIP_LEVELS` object) and taking the highest matching role's level; `CompendiumCollection#testUserPermission` (`:28032`) consults nothing else beyond a `user.isGM → OWNER` short-circuit. **Individual documents inside a compendium have no independent visibility.** If a player can see the pack, they can see and read every document in it, and can drag any Item from it straight onto their own character sheet.

Consequences that must drive design, not be discovered later:

- **A pack is a visibility unit.** Split packs by *audience* first and topic second. "One mundane-equipment pack + one GM-only magic-item pack" is not redundancy — it is the only mechanism Foundry offers.
- **Packs are visible by default.** `CompendiumOwnershipField`'s initial value is `{PLAYER: "OBSERVER", ASSISTANT: "OWNER"}` (`:82171`). Omitting `ownership` from a `system.json`/`module.json` pack entry means *players can read it* — including adventure and monster content. This project shipped exactly that mistake until 2026-07-27.
- **The world overrides the manifest, and it sticks.** `core.compendiumConfiguration` (`:27669`) is a world setting that wins over the manifest for any pack a GM has configured by hand. A manifest fix therefore reaches *new* worlds and untouched packs, but will **not** retroactively repair a world where someone already set that pack's ownership manually. When debugging "why is this still visible", read that setting before re-reading the manifest.
- **Items are not Scenes.** A compendium Scene must be imported by a GM before it can be activated or viewed, which incidentally gatekeeps it. Items have no such step — pack visibility is the *only* gate on an Item. Do not assume the scene workflow generalises.

### General methodology for "is this Foundry behavior actually what I think it is?"

1. Don't trust a code comment's explanation of Foundry internals at face value, even one that looks confident and cites a version number — verify it against the actual running Foundry build before building further logic on top of it (this project's now-fixed `apply()` override had exactly such a comment).
2. Grep `resources/app/public/scripts/foundry.mjs` for the method/property name in question. Search for its definition (`methodName(` at the start of a line, appropriately indented) and read the surrounding class, not just the first match.
3. If behavior is still unclear from source, write a throwaway `page.evaluate()` script via Playwright MCP against a temporary `Actor.create()`/`createEmbeddedDocuments()` in a real running world, log the result, then delete the actor. This project's bug hunt used exactly this technique to distinguish "throws when called directly" from "is never called by the real pipeline" — a distinction `node --check` and static reading cannot reveal.
4. Watch the browser console for `logCompatibilityWarning` output (format: `"... is deprecated. Please use X instead.", {since, until}`) — these name the exact replacement API and the version by which the old one stops working entirely.

---

## 7. Package, Content & Visibility Architecture

> Established 2026-07-27 after an audit found **every** compendium — including the campaign adventure pack and all monster stat blocks — readable by the world's Player-role account, and the two magic items sitting in the shoppable equipment pack at `price: 0` (free, unlimited, at character creation). Neither was a bug to patch; both were symptoms of having no package/visibility architecture. This section is the base that content and features are built on top of.

### 7.1 The two visibility layers

The single most important idea here: **visibility is not static.** A magic shop the party can browse for one town visit, loot they find mid-dungeon, an adventure that becomes relevant in session 4 — none of these can be expressed by compendium ownership alone (see §6: no per-document hiding, and toggling a whole pack would expose the entire catalogue at once). Two distinct layers are needed, and they do different jobs:

| | Layer 1 — static baseline | Layer 2 — dynamic, in-play |
|---|---|---|
| **Mechanism** | compendium pack `ownership` in the manifest | document `ownership` on **world** Actors/Items |
| **Granularity** | per pack, per role | per document, per user |
| **Changes** | set once, rarely revisited | constantly, by the GM, during play |
| **Answers** | "what may a player browse at any time?" | "what has the party found or been shown?" |

Layer 2 requires **no new code** — it is Foundry's native ownership model used as intended. What it requires is that the workflow be *written down* (below) instead of rediscovered each campaign.

### 7.1b Two claims worth getting right (both tested 2026-07-27)

Widely repeated summaries of Foundry's privacy model get one half right and one half wrong. Both halves were tested empirically in this world:

- ❌ **"Adventure compendiums are GM-only by default; players don't even see the title."** **False as an engine statement.** The default is `PLAYER: "OBSERVER"` (§6). Commercial adventure modules *look* like this because their authors declared `ownership` in the manifest — the engine does nothing for you. This project's own campaign module shipped without it and was fully readable by the Player account until 2026-07-27. Never rely on the default being safe.
- ✅ **"After importing, content is GM-private until revealed."** **True, and verified**: a freshly created world document gets `ownership = {default: 0}` (NONE) plus OWNER for its creator, and `testUserPermission(player, "LIMITED")` returns `false`. So Scenes, Actors and Journals imported from an adventure genuinely are GM-only until the GM activates the scene, grants ownership, or uses *Show to Players*. This is layer 2 (§7.1) working as designed — and it is the half you *can* rely on.

**Corollary for shipping a campaign module — assets do not travel with the import.** Importing an Adventure copies *documents* into the world, but every `img`/`background`/`texture` path still points into the module's own directory. Our `adventures` pack references 7 such paths (`modules/de-brutna-sigillens-kronika/assets/dimon/*.png`). Uninstalling or disabling the module after import therefore breaks every map and token image. Any player-facing install guide must say **keep the module installed and enabled**, contradicting the common "you can uninstall it afterwards, the content lives in the world now" advice.

### 7.2 The GM handoff workflows (layer 1 → layer 2)

All three follow the same shape: content lives hidden in a pack, the GM imports it into the world, ownership grants access.

- **Loot ("you find it")** — GM drags the item from the hidden pack directly onto the character sheet, or into a loot Actor the party holds `OBSERVER` on. The item becomes a world document the player owns.
- **Merchant / magic shop** — GM imports that shop's stock into a merchant NPC Actor (e.g. "Magiska boden i \<stad\>") and grants the party `OBSERVER` on that Actor while they're in town, then revokes it. **Only that shop's stock is ever exposed — never the whole magic catalogue.** This is why the answer is a merchant Actor and not "temporarily un-hide the magic pack".
- **Adventures** — already correct: the campaign module ships Foundry `Adventure` documents, a core type *designed* to be GM-imported into a world. Players never read the pack; they experience the imported result.
- **Lore / handouts (journals)** — ⚠ **"Show to Players" is a transient broadcast, not a permission grant.** Verified in source: `Journal.show()` (`foundry.mjs:44472`) only emits a `showEntry` socket event; it never writes `ownership`. Its own docstring states the document "will only be shown to players who have permission to observe it", and `force: true` merely displays it to everyone *at that moment*. So the common claim that Show-to-Players "updates the default permission to Observer so they can re-read it later" is **wrong** — close the popup and it's gone. To make a handout **persist** in a player's journal directory you must *also* set ownership (`OBSERVER`) via Configure Ownership. Use Show-to-Players for the dramatic reveal, ownership for the permanent record; they are independent, and a lasting handout needs both.

### 7.3 Three package tiers

| Tier | Package | Contains | Visibility posture |
|---|---|---|---|
| **System** | `drakar-och-demoner-expert` | rules engine + generic, non-spoiler rules content | player-visible **only** where character creation needs it |
| **Campaign module** | `de-brutna-sigillens-kronika` | adventure content, secret spells, environment effects, unique treasure | **GM-only, always** |
| **World** | the live world | instances actually in play + all of layer 2 | per-document |

**The rule, stated once:** *a pack is a visibility unit — if players must self-serve from it, it contains no secrets; everything else is GM-only and reaches players only through layer 2.*

A useful consequence: "should this secret spell go in the system's `besvarjelser` pack?" is answered by the tier boundary, not by taste. It's campaign content, so it goes in the campaign module.

### 7.4 Pack layout

| Pack | Package | `PLAYER` ownership | Rationale |
|---|---|---|---|
| `raser`, `yrken` | system | `OBSERVER` | the wizard reads them during chargen |
| `besvarjelser` | system | `OBSERVER` | ordinary spells; magic-users need them during *and after* chargen |
| `vapen-utrustning` | system | `OBSERVER` | wizard equipment shop — **mundane items only** |
| `magiska-foremal` | system | `NONE` | magic/unique treasure; home for future found items |
| `monster` | system | `NONE` | stat blocks; nothing at chargen reads this pack |
| `adventures` | campaign module | `NONE` | spoilers; reaches play via Adventure import |
| `dimon-*` | world (`dode-test`) | `NONE` | temporary test packs |

### 7.5 Content registry — packages contribute, code doesn't hardcode

`character-wizard.mjs` originally hardcoded three pack IDs, which both blocked the pack reorganisation above and made it impossible for a campaign module to add a race, profession or item to character creation. Following dnd5e's `registry.mjs` precedent, `CONFIG.DODE.contentPacks` maps a semantic key to a **list** of pack IDs:

```js
DODE.contentPacks = {
  races: [...], professions: [...], startingEquipment: [...], spells: [...]
};
```

Design rules for it:

- A module extends chargen by pushing its own pack ID onto the relevant array in its `init` hook — no system change required.
- **Membership in this registry is the primary access guard**, not permission-filtering. `magiska-foremal` and `monster` are deliberately absent, so they can never reach the chargen UI *even for a GM* running the wizard. Permission checks alone would fail here, because a GM passes every permission check.
- Packs the current user cannot read are skipped at resolve time, so a hidden pack degrades gracefully rather than throwing.
- Defence in depth: the equipment step additionally excludes any item carrying ActiveEffects, so a magical item mis-filed into a shoppable pack still cannot be bought.

### 7.6 What Foundry does not provide (and what mature systems built instead)

Surveyed from the dnd5e and PF2e repositories 2026-07-27, to distinguish "we haven't built this yet" from "the engine genuinely doesn't do this". Useful both as validation and as a roadmap.

| They built | The Foundry gap | Relevance here |
|---|---|---|
| PF2e `rules/` (Rules Elements) | AE `change.key` cannot target an embedded Item | **Validates §3 backlog 7** — our skill-modifier blocker is a known engine limit, not a mistake in our design. A bespoke aggregation layer is the accepted answer. |
| PF2e `item/identification.ts` | no identified/unidentified concept in core | the "mysterious glowing sword" flow, if we want it |
| PF2e `apps/compendium-browser/` | core compendium UI is weak for *finding* content | the wizard is already a partial, chargen-shaped version of this |
| dnd5e `registry.mjs` | no content-registration API | adopted as §7.5 |
| both: `migration/` | core migrates *schema*; your world data is your problem | §3 backlog 3 (`niva` 3→4) is exactly this |
| PF2e `treasure/`, `container/`, `physical/` | no loot/container primitives | §7.2's handoff workflows |
| dnd5e advancement | no character-progression lifecycle | the wizard re-entry feature |
| PF2e `pick-a-thing-prompt.ts` | no generic "choose one" prompt | we built one ad-hoc in the skill picker; worth generalising if a third use appears |
