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
| Synliga tärningsslag + slagläge för grundegenskaper | **Done (2026-07-28)** | ⚠ **Grundbugg: guidens tärningsslag syntes inte alls.** `new Roll("3d6").evaluate()` utvärderar tyst — inget chattkort, ingen animation, siffran bara dök upp. Rättat till husmönstret från `fv-roll.mjs`: `ChatMessage.create({ rolls: [roll], sound: CONFIG.sounds.dice })`. Det ger kärnans tärningskort direkt **och** är exakt vad Dice So Nice kopplar in sig på — modulen är inte installerad här, men samma rad ger 3D-tärningar den dag den är. Per-grundegenskapsknappen fanns redan, så spelaren kunde alltid slå själv; nu syns det också. **Tre nya SL-inställningar** (projektets FÖRSTA `game.settings.register`, stänger backlogpost 5:s "noll anrop någonstans"), alla `world`-scope + `restricted` eftersom det är bordsregler och inte personliga preferenser: `attributeRollMode` (standard / omslag tillåtet / tre kandidater att välja mellan), `allowRestartIfUnqualified` och `showAttributeRollsInChat`. I "tre kandidater"-läget slås tre värden per grundegenskap och `attributes[key]` lämnas `null` tills spelaren klickat — annars hade första kandidaten smugit in som ett val spelaren inte gjort. **Omstartsvägen:** när INGET av de 36 yrkena kan kvalificeras (mycket möjligt med 3T6, se raden nedan) visar yrkessteget en varningsruta med "Slå om alla grundegenskaper", som nollställer bara grundegenskaperna och hoppar tillbaka till attributsteget — kön/nivå/namn/ras behålls. Liveverifierat: standardläge postar chattkort med `rolls[0].formula === "3d6"` och tärningsljud; tre-kandidatläget gav 11/6/8 och valt värde landade rätt; 8 rakt igenom triggade varningen, 16 rakt igenom gav "26 av 36 yrken har uppfyllda krav". |
| Yrkestäckning redan på attributsteget | **Done (2026-07-28)** | Johan: siffran "26 av 36 yrken har uppfyllda krav" fanns bara på yrkessteget, "där den kunde vara användbar" är på slagsteget. Rätt — **beslutet fattas när kandidaterna väljs**, inte ett steg senare. Attributsteget visar nu samma tre tillstånd som yrkessteget: en väntetext innan alla slag är gjorda, en grön rad med antalet kvalificerade yrken, eller den röda varningsrutan med omslagsknapp när svaret är noll. Siffran räknas om vid varje omrendering, så den ändras medan spelaren klickar kandidater — vilket är hela poängen: man ser konsekvensen av ett val innan man går vidare. Liveverifierat över fyra tillstånd: oslaget → väntetext, 8 rakt igenom → röd varning, 16 → "26 av 36", 13 → "5 av 36". |
| Färgade kandidattärningar | **Done (2026-07-28)** | Johans fråga: kan de tre kandidatslagen få var sin färg? Ja — DSN läser `options.colorset` **per tärningsterm**, verifierat direkt i modulens `main.js` (`if(o.options.colorset) i=o.options.colorset`) och sedan live: en spion på `showForRoll` såg `["red","green","blue"]` på ett poolslag. Färgnamnen är hämtade ur DSN:s egen colorset-register (45 st i fyra kategorier — Colors, ThemesSoNice, AcquiredTaste, DamageTypes), inte gissade. `DODE.candidateColorsets` håller de tre och används på **tre ställen samtidigt**: tärningsfärgen i DSN, kantfärgen på kandidatknappen i guiden, och kolumnfärgen i chattkortets tabell. ⚠ Kopplingen till UI:t är hela poängen — tre färgade tärningsset utan matchande knappfärg hade bara varit dekoration, spelaren måste kunna se vilka tärningar som gav vilket värde. Fältet ignoreras tyst om DSN inte är installerat, så koden fungerar i båda fallen. |
| Dice So Nice + tärningshink för tre-kandidatläget | **Done (2026-07-28)** | DSN 6.2.9 installerat via Foundrys **egen paketinstallatör** (manifestet slogs upp med setup-anropet `getPackages` mot den officiella registern — inte en URL ur minnet) och aktiverat i världen. **Verifierat att GUIDENS slag faktiskt når modulen**, inte bara att modulen finns: en spion på `game.dice3d.showForRoll` fångade guidens slag med formeln `3d6`. Ingen extra kod behövdes — `ChatMessage.create({ rolls: [roll] })` är hela kopplingen. **Tärningshink (Johans idé):** tre-kandidatläget slår nu alla tre värdena i EN pool-formel `{3d6, 3d6, 3d6}` i stället för tre separata slag, och "Slå alla" postar **ett** samlat chattkort med en tabell (egenskap × tre kandidater × vald) i stället för ett kort per slag. Mätt: 1 chattkort, 7 Roll-objekt, **1 DSN-animation med 60 tärningar** — mot 21 kort och 21 animationer före. |
| ⚠ RÄTTAT: sömnklocka ersätter "stressigt läge" | **Done (2026-07-29)** | Johans beslut. **RP s.63 och REG s.45 säger ordagrant samma sak:** EP ges "varje gång som en rollperson använder en färdighet framgångsrikt **första gången efter en sovperiod om minst sex timmar** (⚠ **två timmar för alver**)", perfekt slag ger 1T3+1, och sedan kan färdigheten inte ge mer EP förrän rollpersonen sovit. Formuleringen "i ett stressigt läge (SL bedömer)" — som systemet byggde på — står inte i NÅGON bok; den kommer från den kurerade `REGLER_FARDIGHETER.md`. **Följden är att utdelningen blir AUTOMATISK:** EP-strecket (RP s.63:s egen term — samma ruta som på det fysiska rollformuläret) är något systemet kan avgöra självt, till skillnad från en stressbedömning. SL-knappen på slagkortet är därför **borttagen**, liksom hela `renderChatMessage`-hooken — kortet visar bara "+N EP" när utdelning skett. Fältet flyttades från `besvarjelse` till att gälla alla poster, och heter **`system.ep.ticked`** (döpt om 2026-07-29 från `awardedSinceRest` — "sömnklocka" var missvisande, RP:s sheet har bara en liten kryssruta per färdighet, ingen klocka). ⚠ **Kategori B tjänar aldrig EP genom äventyr** — "Detta gäller inte färdigheter kategori B, som endast kan förbättras genom träning" (RP s.63). Ny sovknapp (🌙) på arket kryssar ur strecken; den visar antalet färdigheter som redan har sitt EP-streck ikryssat. ⚠ Systemet spårar ingen speltid, så sovperiodens LÄNGD är SL:s bedömning — knappen kvitterar bara att den ägt rum. Live-verifierat: första lyckade slaget ger 1 EP automatiskt, andra ger 0, sovknappen öppnar igen, perfekt ger 1T3+1 (verifierat 2 EP på ett naturligt perfekt slag) med tärningen bifogad för Dice So Nice, och en kategori B-färdighet får 0. |
| Magiträning i ett EGET fönster | **Done (2026-07-29)** | Johans beslut. ⚠ Motivet är inte kosmetiskt: **SB s.7** ger magi andra EP-KÄLLOR än vanliga färdigheter, inte bara andra kostnader. "Att skaffa sig FV i magiskolor fungerar som för vanliga färdigheter, men man kan **endast** få erfarenhetspoäng genom träning med lärare; ej genom ensamträning eller erfarenhet." Besvärjelser däremot kan tränas ensam (kräver **magisk kodex**), med lärare, eller genom äventyr. Ett gemensamt fönster hade fyllts av villkor som gäller hälften av raderna. Gemensam bas i `apps/training-base.mjs` (grind, lägesväxel, EP-aritmetik, Träna/Höj); `apps/training.mjs` visar vanliga färdigheter, `apps/magic-training.mjs` skolor + besvärjelser. |
| Ensamträning av besvärjelse — INT-slag med straff | **Done (2026-07-29)** | ⚠ **Inte ett vanligt grundegenskapsslag.** SB s.7: man slår mot INT men får **+1 på tärningen för varje poäng INT under 19** — ett STRAFF. Effektivt måltal = **2×INT − 19**. Bokens eget exempel (magiker med INT 15 som lär sig PARALYSERING ur kodexen *Liber Necrosophicus*): +4 på tärningen, måste slå **11 eller lägre**. Verifierat live: måltal 11 vid INT 15. ⚠ Den kurerade `MAGI.md` återger modifikationen som "(lättare)", vilket är fel håll och hade gjort ensamträning enklare ju dummare magikern är. |
| Magisk kodex som förutsättning (`hasCodex`) | **Done (2026-07-29)** | SB s.7: för att lära sig en besvärjelse på egen hand krävs en **magisk kodex** för just den besvärjelsen — 20-30 sidor handskriven text som förklarar den psykiska kanaliseringen. Ensamträningsknappen är spärrad utan den. ⚠ Just nu en boolean på besvärjelsen; **bör bli ett ägt `utrustning`-föremål** som går att köpa, hitta och stjäla — se backlogpost 40. |
| ⚠ RÄTTAT: besvärjelser KAN ensamtränas | **Rättat (2026-07-29)** | Implementationen tidigare samma dag spärrade ensamträning av besvärjelser helt, med stöd i det ÄLDRE Magi-häftet: "Man kan inte lära sig en besvärjelse genom ensamträning, utan enbart genom träning med lärare." **SB s.7 (Expert, senare) säger motsatsen** och beskriver ensamträningsmekaniken i detalj med eget räkneexempel. Johan pekade på källkonflikten. Vi följer SB. Motsvarande: skolor spärrades INTE för ensamträning tidigare — nu gör de det, vilket är samma boks andra halva. |
| ⚠ RÄTTAT: takreglerna är TVÅ, inte en | **Rättat (2026-07-29)** | **RP s.63** skiljer på två tak som den första implementationen slog ihop: (a) **sekundära färdigheter och kategori B** — "kan man **aldrig** få högre FV än värdet i den grundegenskap den är baserad på", absolut tak oavsett metod; (b) **primära färdigheter och yrkesfärdigheter** — taket gäller bara TRÄNING, "skall man få högre FV i en sådan färdighet måste det ske genom **erfarenhet**". Kategori B är alltså inte undantagen från taket (som REG s.45 kan läsas) utan undantagen från *undantaget*: B kan inte förbättras genom äventyr alls. Den första implementationen gjorde kategori B helt taklös — precis fel håll. |
| Träning som EP-KÄLLA (veckoslag) | **Done (2026-07-29)** | ⚠ **Halva mekaniken saknades i första implementationen.** REG s.45 räknar upp TRE sätt att skaffa EP — ensamträning, träning med lärare, och erfarenhet under äventyr. Träning är alltså en *källa* till EP, inte bara tillfället då EP växlas in. Veckopasset slår ett **normalt grundegenskapsslag mot färdighetens grundegenskap** (inte mot FV): lyckat → 1 EP till just den färdigheten. **Ensamträning ger ett slag, träning med lärare två** — det är hela den mekaniska vinsten med att betala. Varje rad i fönstret har nu två skilda handlingar: **Träna** (tjänar EP) och **Höj** (spenderar EP). Besvärjelser slår mot INT. |
| Träningstak mot grundegenskapen | **Done (2026-07-29)** | REG s.45: "Genom träning kan man inte öka en färdighet till högre FV än vad man har för värde i dess grundegenskap." ⚠ "Lärdomsfärdigheterna och alla färdigheter av kategori B är undantagna." Kategori B känns igen på `system.category === "b"`; magiskolorna är i boken av typen LÄR och undantas därför också. Verifierat: FV 14 mot SMI 14 spärrar träning, samma färdighet som kategori B tränar vidare. |
| Besvärjelser kräver lärare | **Done (2026-07-29)** | ⚠ MAG, kapitlet *Att lära sig nya besvärjelser*: **"Man kan inte lära sig en besvärjelse genom ensamträning, utan enbart genom träning med lärare."** Ensamträningsläget spärrar därför besvärjelserader. ⚠ Detta **motsäger `docs/wiki/MAGI.md`**, som påstår att nya besvärjelser kan läras med ensamträning om man har en magisk kodex — se rättelsetabellen i det nya extraktet. |
| Träningsavgift (`trainingFeePerWeek`) | **Done (2026-07-29)** | **⚠ BESLUTAT AVSTEG — Johan 2026-07-29.** *Boken:* REG s.45 ger 150 sm/vecka som grundkostnad, 300 sm för magikerlärare, plus multiplikatorer (×1,5 elev av annan ras, ×2 liten klass, × lärarens INT för ensam elev), och MAG lägger på dubbel taxa för besvärjelser. *Vi:* en **fast avgift per pass**, standard **300 sm**, som världsinställning, och **ingen gräns för hur många färdigheter som kan tränas samma vecka**. *Skäl (Johans ord):* reglerna säger inte att man inte får träna flera färdigheter samma vecka, och vad pengarna går till — lärare, material, lokal — är SL:s beskrivning snarare än mekanik. En siffra SL kan ändra slår en multiplikatortrappa ingen slår upp vid bordet. Bokens riktiga tabell finns i det kurerade extraktet för den som vill räkna exakt. Ensamträning är alltid gratis. |
| Minibesvärjelser härledda ur ALLA skolor | **Done (2026-07-29)** | Johans beslut: en magiker som lär sig ytterligare en skola får också den skolans minimagi — "one to many". Minisarna läses ur kompendiet utifrån rollpersonens skolfärdigheter och **ägs inte** som poster: MAG s.23 ger minimagin med skolan, den behöver inte stå i formelsamlingen, och listan ska ändra sig av sig själv när magikern lär sig en ny skola. ⚠ MAG s.23:s mening "den tillhör automatiskt den skola där magikern har **högst FV**" handlar om magiker som inte tillhör NÅGON skola — direkt före står att "varje magiskola har sina egna minibesvärjelser". Den tidigare planen (bara högsta-FV-skolan) hade tystat en skola så fort magikern lärde sig en till. Åthävotrappan (FV <15 gester och ord, 15+ inga yttre åthävor, 25+ omedvetet) visas per rad. SL:s ad hoc-utdelade `minibesvarjelse`-Items läggs ovanpå och märks med gåvoikon. Verifierat: Animism FV 6 + Illusionism FV 16 → 11 minibesvärjelser i två grupper med rätt åthävonivå var. |
| EP i spel — intjänande + träningsfönster | **Done (2026-07-29)** | Tre ekonomier delar namnet "EP" i böckerna och hölls medvetet isär. **1. Skapandebudgeten** (`actor.system.ep.max/spent`) är HÄRLEDD ur nivå+ålder+kvarvarande BP×5 och räknas om vid varje `prepareDerivedData` — låg spelintjänad EP i samma pott hade en åldersändring i efterhand raderat spelad erfarenhet. **2. Färdighetens egen pott** (`item.system.ep.earned/spent`) — REG s.45: "noteras ett streck vid färdigheten", alltså BUNDET till just den färdigheten och aldrig flyttbart. **3. SL:s bonuspoäng** (`actor.system.ep.bonus/bonusSpent`) — REG s.46, "INTE bundna till en viss färdighet", max 10/äventyr (rådgivande, systemet vet inte var ett äventyr börjar). Intjänandet är en SL-knapp på slagkortet, inte en automatik: EP ges bara "i ett stressigt läge (SL bedömer)" och det kan systemet omöjligt avgöra. Perfekt ger 1T3+1. Omsättningen sker i ett EGET fönster (`apps/training.mjs`), inte som ett läge på arket — REG s.46 gör det till en händelse mellan äventyren (≥7 dagars sammanhängande vila, aldrig under pågående äventyr), och ett ständigt närvarande köpläge hade suddat ut den gränsen. Grinden är `system.rest.trainingUnlocked`, per rollperson (vila är individuell). Live-verifierat 2026-07-29: låst grind vägrar, öppen grind köper, egen pott dräneras före fria poäng, 0 konsolfel. |
| Magiskolans EP-särregler | **Done (2026-07-29)** | ⚠ MAG s.23: "FV i magiskolor förbättras BARA via träning, INTE via erfarenhet under äventyr." Skolraden i träningsfönstret kan därför **aldrig** betalas med bunden EP — verifierat med 99 EP i skolans egen pott, varav 0 gick att använda. En helt ny skola kräver dessutom lärare och kan inte läras ensam, så fönstret höjer bara skolor rollpersonen redan har. Besvärjelser tjänar EP på samma **EP-streck** som färdigheter (1 EP första gången besvärjelsen lyckas efter förra sömnen), inte per kastning — `system.ep.ticked` kryssas ur när vilan öppnas. |
| EP-kostnadsfunktioner för magi (`DODE.spellCost`/`magicSchoolCost`) | **Done (2026-07-29)** | ⚠ **Två olika indata, lätt att blanda ihop:** grundkostnaden kommer från magikerns FV i SKOLAN (2/4/6/8… för FV 1-3, 4-6, …), men multipeln (×1 ≤10, ×2 11-14, ×3 15-17, ×4 18-20, +1 var 3:e därefter) följer BESVÄRJELSENS eget S-värde. Min första implementation lade multipeln på skolans FV och gav 36 där boken säger 40. Bokens andra exempelhalva avslöjade felet: skolvärde 6 ger 8 EP/steg för S10→S14, vilket bara går ihop om ×2-bandet läses på S — skolans FV är 6 genom hela exemplet och hade gett ×1 rakt igenom. Båda halvorna stämmer nu exakt (40 och 32). ⚠ Bokens "från S1 till S10 = 40" räknar tio steg, alltså köpet av nivåerna 1-10 från noll; vi räknar differens, så `spellCost(6, 0, 10) = 40`. |
| Källkonflikt: besvärjelsernas EP-tabell | **Flaggad (2026-07-29)** | ⚠ `REGLER_FARDIGHETER.md` i Roll20-projektet återger tabellen som 1-3:**4**, 4-6:**6**, 7-9:6 — en dubblerad 6:a och ingen 2:a. `MAGI.md` (MAG s.13) ger 2/4/6/8/10/12/14/16, monotont och i linje med RP s.30. Vi följer MAG s.13; den andra bedöms vara en transkriberingsmiss där en rad fallit bort och nästa dubblerats. **Ej rättad i Roll20-projektet** — det är ett annat repo och `⚠`-flaggan bärs i stället i `config.mjs`. |
| `minibesvarjelse` som egen Item-typ (31 poster) | **Done (2026-07-28)** | Johans bedömning: minibesvärjelser behöver en egen datamodell, "as it's a special thing and automatically successful", och SL ska kunna dela ut en enskild ad hoc. Rätt — och det är samma slutsats som 14c kom fram till från regelhållet. ⚠ **Egen typ, inte en flagga på `besvarjelse`:** MAG s.23 ger dem **ingen CL-kontroll (lyckas alltid)**, fast **1 PSY** utan effektgradsskalning, **alltid Kvick**, och de behöver **inte stå i formelsamlingen**. Det finns alltså inget slag, ingen effektgrad, inget misslyckande och ingen snedtändning — vilket är merparten av vad `besvarjelse` och `castSpell()` finns till för. Delad typ hade lämnat halva schemat dött och gjort kastknappen fel. ⚠ **En Item-pack rymmer flera subtyper** (`type: "Item"` gäller dokumentklassen, inte subtypen — precis som `vapen-utrustning` bär vapen/rustning/utrustning), så minisarna ligger i `besvarjelser`-packet: 191 besvärjelser + 31 minibesvärjelser = 222. Nekromanti har flest (12), sedan Animism 6, Illusionism 5, Symbolism 4. **Kvar:** åtkomsten är i boken **härledd** — man har automatiskt minimagin i den skola där man har högst FV (MAG s.23 "Allmän minimagi") — så arket bör visa dem utifrån skolan i stället för att kräva ägda poster. Typen finns ändå som Item just för SL:s ad hoc-utdelning. |
| Magibehörighet per yrke (`system.magic`) | **Done (2026-07-28)** | Stänger backlogpost 12e. Guiden avgjorde tidigare med **namnregexen `/magiker/i`** om magiskolesteget skulle visas — den missade både **paladin** och **utbygdsjägare**, som båda har magi enligt böckerna. Nytt `magic`-fält på `yrke` med `access` (none/full/limited), `schools`, `maxSchoolValue`, `allowGeneralSpells`, `canLearnAtCreation` och `epShareMax`. Böckerna ger tre olika nivåer, och skillnaderna är inte kosmetiska: **Magiker** (RP) lär och kastar från dag ett, valfri skola, väljer 9 yrkesfärdigheter i stället för 12. **Paladin** (KH s.6) får bara **Mentalism**, skolvärde **≤12**, **inga allmänna besvärjelser**, och högst **1/3 av EP** på besvärjelser från start. **Utbygdsjägare** (RP) har **Animism** som yrkesfärdighet och skolvärde ≤12 men får **inte lära besvärjelser vid skapandet** — RP s.28 säger det uttryckligen ("Magiker kan lära sig besvärjelser från början, men inte utbygdsjägare"); skolan finns, besvärjelserna måste tränas fram. ⚠ Bara `access: "full"` räknas som magiker i RP:s mening, så `#professionSkillTarget` skiljer nu på `#isFullMagician` (9) och `#isMagicUser` (visar magiskolesteget). Liveverifierat: Paladin ser bara Mentalism, Utbygdsjägare bara Animism, Magiker alla 13, Krigare inget steg alls. |
| SL-utdelning av färdigheter och besvärjelser ("boon"-flödet) | **Done (2026-07-28)** | Johans poäng: guiden täcker skapandet, men rollpersoner lär sig saker **i spel** efter träning, och det behöver en egen väg in med en lång lista SL kan välja ur. Arkets "+ Ny färdighet" byggdes om till två SL-knappar: **Dela ut färdighet** och **Dela ut besvärjelse**. ⚠ **Nu SL-låst.** Knappen var öppen för spelaren, vilket gjorde hela kostnadsnivå-systemet meningslöst — man tog helt enkelt det man ville ha. ⚠ **Startvärdet är nu baschansen, inte 1.** Gamla koden satte `fv: 1` rakt av; RP s.29 säger att BC är det FV man får automatiskt, så varje färdighet vars grundegenskap låg över 3 fick fel värde. Listan omfattar nu **primära (16) · yrkets egna · vapenfärdigheter (18, från vapen-Items eftersom de inte har någon egen katalog) · de 13 magiskolorna · sekundära (64)** plus fritext. Besvärjelseknappen listar alla **191** besvärjelser grupperade per skola och sorterade på skolvärde. ⚠ **Besvärjelseutdelning kräver INTE att rollpersonen är magiker** — Johans exempel med en icke-magiker som får en gudomlig välsignelse mitt i kampanjen; mekaniskt är välsignelse och besvärjelse samma dokument, och skillnaden ligger i `grantedReason`. Varje utdelning stämplar `flags.<system.id>.grantedBy`/`grantedReason`, visas som ett litet examensmärke på färdighetsraden med anledningen i tooltip, och postar ett chattkort så bordet ser det. Liveverifierat: SMI 16 gav FV 3 (BC), märket och tooltipen renderade, båda knapparna dolda för spelare. |
| Yrkenas grundegenskapskrav i guiden | **Done (2026-07-28)** | Johans fråga: har guiden "tabell över grundegenskapskrav"? **Datat fanns och var komplett** — alla 36 yrken har `system.requirements` som matchar YRKEN.md:s Grundegenskapskrav (RP s.11), och `#checkRequirements` parsar "STY 14, FYS 12" korrekt. **Men funktionen var i praktiken dekoration**, av två skäl: (1) `yrke`-steget låg FÖRE `attribut`-steget, så vid valet var varje grundegenskap `null`, varje krav flaggades "overifierat" och `allMet` blev trivialt sant; (2) `#canAdvance("yrke")` kollade bara att ETT yrke valts, aldrig om kraven höll. Åtgärdat: **`attribut` flyttat före `yrke`** och varje yrkeskort visar nu krav mot faktiskt värde (`SMI 16 (10)`), grönt/rött per krav. ⚠ **Omött krav SPÄRRAR medvetet inte valet.** Uträknat på det faktiska datat: en rollperson med 10–11 i allt — helt normalt för 3T6 — kvalificerar för **0 av 36** yrken (lägsta tröskel i hela listan är 12, och bara Helare/Munk/Sjöfarare/Utbygdsjägare når dit vid 12). Hård spärr hade alltså låst ute spelare helt. Guiden visar tydligt vad som fattas och låter bordet avgöra, vilket också matchar att boken låter SL adjudicera. Stegräknaren rättades samtidigt från 0- till 1-baserad ("Steg 0/15" blev synligt när översiktssidan lades till, men var av-med-ett redan innan). |
| Guidens översiktssida (steg 1) | **Done (2026-07-28)** | Johans önskemål: en startsida som visar flödet och förklarar vad som går att ändra i efterhand. Tio punkter över de 15 stegen, plus en tydlig ruta: **kön/ras/yrke går inte att ändra efteråt** (de styr egenskapsmodifikationer, porträtt och yrkesfärdigheter, och en ändring skulle räkna om saker rollpersonen redan använt i spel), medan allt annat kan **låsas upp av SL** via hänglåset på arket → knappen "Redigera i guiden". Nämner också att inget sparas förrän sista steget, och visar en extra rad i redigeringsläge. |
| Källhänvisning på allt innehåll (`system.source`) | **Done (2026-07-28)** | Johan: "Kan inte komma ihåg hur många gånger vi har letat efter var en sak stod i böckerna." Alla innehållstyper (`ras`, `yrke`, `fardighet`, `vapen`, `rustning`, `utrustning`, `besvarjelse`, `formaga`, `npc`) har nu `system.source = { book, page }` via en delad `sourceField()` i `scripts/data/fields-source.mjs`. **Strukturerat, inte fritext** — dokumentet lagrar en kort nyckel och `CONFIG.DODE.books` håller den RIKTIGA boktiteln (aldrig PDF-filnamn), så en omdöpning rättas på ett ställe och innehåll går att filtrera per bok. `page` är en sträng eftersom källorna anger intervall. **560 dokument backfilladed, 0 utan källa**, med sidor hämtade ur de kurerade dokumentens egna Källa-rader (RASER.md RP s.9-10, YRKEN.md RP s.11-22/KH s.3-9/T&L s.7-16, MAGI.md per skola, UTRUSTNING.md REG s.49-62) plus PDF-arbetet i tidigare sessioner. Inget sidnummer är påhittat — okänd sida lämnas tom. Ett bok+sida-fält finns nu på alla åtta item-ark. ⚠ Två fällor: `utrustning.source` var en fri sträng och migrerades till strukturerad form, och `formaga` hade redan ett `source` som betydde något annat ("bas"/"ras"/"yrke") — det döptes om till `origin`, annars hade två fält med samma nyckel tyst skrivit över varandra. Inget kompendieinnehåll av typen `formaga` fanns, så omdöpningen kostade ingen migrering. |
| `handlare` Actor type + butiksark + börs | **Done (2026-07-28)** | Merchant NPC whose sheet is a shop counter: players double-click the token, see grouped stock with prices, and click Köp. ⚠ **Two premises had to be corrected first.** Foundry core has **no built-in Loot/Merchant sheet type** — that is a dnd5e-plus-module concept (Item Piles, Loot Sheet NPC), so in a custom system it must be built. And the character had **no spendable purse at all**: `startCapital` is a creation-time figure that never decreases, so there was nothing to subtract from. New `system.currency = {gm, sm, km}` with derived `totalKm`/`totalSm`/`label`, seeded by the wizard from whatever start capital is left after the equipment step. ⚠ **Purse arithmetic runs in copper as an integer**, never silver as a float — a 12.5 sm purchase from 3 gm + 2 sm must not produce 0.30000000000000004. ⚠ **Stock is a catalogue, not counted inventory:** `system.json` has `"socket": false` and players do not own merchant actors, so a player's click cannot write to the merchant document — only to their own character. Buying therefore never touches the merchant. Counted stock would need either a socket relay through the GM's client or giving players OWNER on every merchant (which also lets them edit prices). `limitedStock` exists as a GM-facing marker; see backlog 30. Includes `Lasslo Värdshusvärden` ("Den Trötta Draken") in a new GM-only `handlare` pack, stocked with the s.48 tavern price list plus general goods. ⚠ **Embedded items in a compendium Actor need their own `_key`** in the form `!actors.items!<actorId>.<itemId>` — without it `fvtt package pack` fails with the unhelpful "Key cannot be null or undefined". Live-verified: purse 1 gm 5 sm → bought 2× Köttstuvning (20 km) → 1 gm 3 sm, item in buyer's inventory, Bankett correctly disabled on insufficient funds, merchant stock unchanged at 36, 0 console errors. |
| `utrustning` Item type + Magi-regelbokens utrustningslistor | **Done (2026-07-28)** | New generic gear type — until now every Item type was specialised (`vapen`/`rustning`/…), so the ~270 mundane goods in Magi-regelboken s.43-48 had nowhere to live. `item-utrustning.mjs` carries `category` (12 values), `quantity`, `weight` (BEP), `price` + `priceUnit`, `priceNote`, `equipped`, `source`, `description`, and derives `priceSm`/`totalWeight`/`priceDisplay`. **271 items ported**, taking `vapen-utrustning` from 33 to 304. ⚠ **Prices are stored in the book's own coin** rather than converted on entry: the source tables mix denominations (the entire Kläder table is copper, drugs are largely gold), and converting at input would have destroyed the ability to check any price against the book. `priceSm` normalises for the shop. ⚠ **`priceNote` exists because ~30 prices are not numbers** — "4 per kagge", "5 sm/g", "×0,5", "2×grundkostnad per 100 ord". Those keep the source text, have `price: 0`, and are explicitly **blocked from purchase** in the wizard so they cannot be bought for nothing. The equipment step also gained category grouping (14 groups with counts) — 304 cards in the flat grid was unusable, the same problem that forced race/profession grouping at 13/36. Art is one icon per category (12 generated), matching the school-sigil precedent for spells. Live-verified: 304 documents load, derived values correct (Mantel 100 km → 10 sm), Saffran and Fältproviant correctly non-purchasable, item sheet and actor gear row both render, 0 console errors. |
| Content art (all compendium documents + magic schools) | **Done (2026-07-27)** | **Zero placeholder icons remain.** All 106 compendium documents plus the 13 magic schools carry generated 1024×1024 art in the house style (`docs/dev/ART_STYLE.md`). Coverage: 13 races + 36 professions (gendered `-man`/`-kvinna` variants, session earlier today), then this pass added 33 equipment items, 2 magic items, 14 monsters (`img` **and** `prototypeToken.texture.src`), 8 spells, 13 magic school symbols. Schools live in `DODE.magicSchoolSkills` rather than a pack, so they got an `img` field on the config row, passed through to the wizard card template and onto the `fardighet` item the `magiskola` step creates. ART_STYLE.md gained three non-portrait templates (object icon / bestiary creature / spell-arcane symbol) — forcing a sword through the `waist-up portrait` template does not work. Live-verified: 186 asset URLs HEAD-checked in a running world with 0 broken, all 13 school cards and all 33 equipment cards render (`naturalWidth > 0`), and an end-to-end Magiker creation produced an actor whose `img`/token came from the profession portrait and whose Nekromanti skill item carried the school symbol. 0 console errors. ⚠ One real trap found: the config key `rostmagi` is **Röstmagi** (voice magic) — the first icon was generated as metal *rust* and had to be redone. Check `lang/sv.json` for what a key actually means before describing a motif. The whole flow is now mandatory pipeline step 2b in `CLAUDE.md` ("Bildpipeline") so new content never ships with `icons/svg/item-bag.svg` again. |
| ⚠ KONFLIKT INOM SLB: rustning vid perfekt anfall | **Behöver beslut (2026-07-29)** | Johan pekade på **stridsdiagrammet SLB s.31**, som visar sig motsäga bokens egen textmatris på s.17. **s.17:** *"Perfekt ... Attacken gör automatiskt maximal skada. Försvararens rustningsabsorbering dras ej bort."* **s.31:** rutan `Maximal skada` flödar in i `Dra bort rustningens absorbering` precis som de två andra skadegrenarna. Praktisk skillnad mot Abs 8: ett perfekt hugg är antingen förödande eller nästan verkningslöst. Systemet följer tills vidare **texten** (ingen absorbering), eftersom den är ett uttryckligt påstående medan diagrammet kan vara en förenkling. |
| Svärdshand (`system.swordHand`) | **Done (2026-07-29)** | ⚠ **En hel rollpersonsegenskap som saknades i systemet**, hittad först när Johan fotograferade RP s.27. Varje rollperson har en **svärdshand** (den hand man normalt använder) och en **sköldhand** (den aviga). Slås med **2T6 + antal BP man väljer att lägga på det**, +1 per BP: **2-11 Höger · 12-14 Vänster · 15-18 Dubbelhänt · ≥19 Ambidextriös**. ⭐ **Detta är förklaringen till sköldhandens −10 CL** (SLB s.17): *"Sköldhanden är genomgående sämre än svärdshanden, **utom för färdigheterna Två vapen och Sköld**."* ⚠ **Dubbelhänt ≠ ambidextriös:** dubbelhänt kan använda båda händerna lika bra men **inte samtidigt**; ambidextriös kan använda dem **samtidigt till olika saker** ("skriva två olika saker samtidigt"). Ambidextriös är alltså ingen stridsförmåga utan en generell samtidighet — stridsvinsten är en följd. ⚠ Kan också fås som **särskild förmåga**, och då slår man inte på tabellen. **Guidesteg byggt samma dag** som steg 6 av 17, direkt efter Ras: 2T6-knapp, BP-insatsfält som räknas in i BP-huvudboken, och en rullgardin för den som fått handen som särskild förmåga och därför inte ska slå. ⭐ **Johans spelöppning inbyggd som tips i steget:** *"When I play DoDE I always pay 15 BP for the hand throw... It's a hidden gem in the ruleset."* 2T6+15 blir lägst 17 = garanterat minst Dubbelhänt, och Ambidextriös på 33/36. **Empiriskt verifierat över 60 slag: 92 % ambidextriös, 8 % dubbelhänt, aldrig under 17** — och BP-huvudboken drog korrekt 125 → 110. ⚠ Kvar: koppling till CL-motorn (sköldhandens −10). |
| Tidsmodellen — en klocka, tidsslag, vilosvit, läkning | **Done (2026-07-29)** | §10 byggd. **En `worldTime`, två drivare:** stridsrundan (+5 s, hook) och tidsfönstret (`game.dode.openTimeWindow()`). ⭐ **Tiden har ett SLAG**: `vila` bygger vilosviten och läker full takt, `resa`/`äventyr` **nollställer sviten** men kryssar ändå ur EP-strecken — man sover när man reser. ⭐ **Träningsgrinden är nu en SVIT, inte en boolean** (`rest.streakDays`), eftersom RP s.63 kräver *sammanhängande* vila; `trainingUnlocked` finns kvar som härlett fält så träningsfönstret inte behövde ändras. **Läkning enligt SLB s.20:** 1 KP per vecka per skadad kroppsdel vid vila, halva takten annars, och totala KP återställs automatiskt när alla kroppsdelar är hela. Liveverifierat: en vecka resa → svit 0, läkning 0; en vecka vila → svit 7, träning öppen, arm 1→2; ett äventyrsdygn → svit tillbaka till 0. Klockan flyttades 15 dygn totalt. ⚠ Kvar: proviant (ingen regel funnen), infektion (post 56), och att flytta grinden helt till `streakDays` i träningsfönstret. |
| Rustningstabellen från SB s.27 + täckning per kroppsdel | **Done (2026-07-29)** | Första tillämpningen av utgåveprecedensen (post 42). **38 rustningsdelar** ersätter RP s.52:s 15, och `rustning` har fått **`coverage`** — vilka träffområden delen faktiskt skyddar. ⭐ **Det stängde en riktig regelbugg:** fram till nu skyddade en hjälm benen, eftersom `armourFor()` bara läste aktörens samlade `abs`. Nu väljs den bästa buret plåten **över just det träffade området** (de staplas inte). Verifierat: hjälm + benskydd ger Abs 8 på huvudet, 2 på benet och **0 på armen**. Nytt i SB:s tabell och tidigare omöjligt att ha: **Härdat läder (4), Lamellerad (6), Laminerad (8)**, samt uppdelningen Brynja / Brynjehosor / Hauberk / Helrustning. ⚠ **Sköldarna fick SB s.38:s riktiga siffror** — de hade `price: 0, abs: 0`; nu 7 sköldar med STY-krav, **BV** och pris (Targ 500 → Scutata 1 100). Sköldar bär `abs: 0` med flit: de absorberar inte, de pareras med och slits. ⚠ **Bilder saknas** för de 45 posterna — bildpipelinen (CLAUDE.md steg 2b) är alltså inte uppfylld här; se backlogposten. |
| Räckvidd via Foundrys egen mätning | **Done (2026-07-29)** | Johan: *"But foundry has distance function, right?"* — ja, och stridssimuleringen använde felaktigt handskriven Chebyshev-geometri. `tokenDistance()` använder nu **`canvas.grid.measurePath()`**, som respekterar rutnätstypen (fyrkant/hex/rutnätslöst) och världens diagonalregel; egen geometri hade gett fel så fort någon byter rutnät. Returnerar både `spaces` (rutor — det DoDE räknar i) och `distance` (meter). `resolveAttack` tar nu valfria `attackerToken`/`targetToken` och returnerar `{outOfRange, reason}` i stället för att slå: **närstrid kräver `spaces <= vapnets räckvidd`** (SLB s.16: "rutan intill", längre med spjut/hillebard) och **avståndsvapen kräver minst en ruta emellan**. ⚠ Utan tokens görs ingen kontroll alls, så SL-fiat och tester fungerar som förr. ⚠ Räckvidden tolkas som `max(1, vapen.system.length)` — **ett antagande**, boken ger ingen tabell från vapenlängd till rutor. |
| ⚠ EP delades INTE ut i strid | **Åtgärdad (2026-07-29)** | Upptäckt i den fullständiga stridssimuleringen, nu fixad. `resolveAttack` slår sina egna tärningar via `classifiedRoll` i stället för `rollFV`, så EP-streckets utdelning triggades aldrig i strid — en rollperson kunde slåss en hel dag utan att kryssa i en enda ruta. **Ny hjälpfunktion `awardSkillEp()`** i `attack.mjs` anropar samma `canEarnFromUse`/`rollEpAward`/`awardItemEp` som `rollFV` redan använder, för **båda** slagen: ett lyckat ANFALL kryssar i vapenfärdighetens streck, en lyckad PARERING kryssar i pareringsfärdighetens (t.ex. Sköld) — RP s.63 ger EP för en lyckad användning av färdigheten, oavsett vad utfallsmatrisen sedan gör med hugget. Resultatet ligger i `out.attackEp`/`out.parryEp` och visas som egna rader på stridskortet (`.ep-tick-line`). Liveverifierat: ett samtidigt lyckat anfall+parering kryssade i BÅDA färdigheternas streck (1 EP var); 14 lyckade svärdshugg i rad utan vila gav fortfarande bara **1** EP totalt — det en-per-vila-taket håller även i strid. |
| Stridskort i chatten (`postAttackCard`) | **Done (2026-07-29)** | Följer **stridsdiagrammets ordning (SLB s.31)** uppifrån och ned, så bordet läser resultatet i samma sekvens som boken: CL-uppdelning → anfallsslag → pareringsslag → träffområde → skada → effekt. **CL visas uppdelat** (`CL 22 (15 +7 bakifran)`) så att ingen behöver fråga varför chansen blev som den blev — det är samma idé som dnd5e:s `parts`-array, se §9. Alla tärningar bifogas `rolls` så Dice So Nice animerar dem. Egna rader för BV-slitage (`skada 4 mot BV 9 — håller`) och för det rena utslaget. Liveverifierat: 12 kort över flera utfallsgrenar, 0 konsolfel. |
| Stridsupplösning (`rolls/attack.mjs`) | **Done — motor klar, dialog kvar (2026-07-29)** | ⚠ **RÄTTAD mot stridsdiagrammet SLB s.31** (Johans hänvisning): en genombruten parering ger **"−1 på skadan"** innan rustningen dras — textmatrisen på s.17 säger bara "den överskjutande skadan" utan avdraget. Diagrammet bekräftar också att en parering som HÅLLER (BV > 0 efter slitaget) avslutar anfallet helt: ingen skada går igenom, bara slitage. Diagrammet är den auktoritativa flödesordningen och finns transkriberat i `DODE_Spelledarboken_STRID.md`. | SLB s.16-18:s resultatmatris (9 rader anfall × parering), CL-modifikationer för när- och avståndsstrid, träffområde, rustningsavdrag och skada på både område och Totala KP. ⭐ **Träffområde slås ALLTID**, även i vanlig strid — Johans beslut: *"a generic attack always has a hidden riktad attack"*. Slaget är gratis, och genom att alltid ha det kan SL växla till detaljerad strid mitt i en strid utan att rekonstruera något; det som skiljer lägena är om området **visas och får effekt**. ⚠ **Vapnet bär inte FV** — `item-vapen.mjs` har damage/styGroup/baseValue men inget `fv`; färdigheten bär det. `resolveAttack` kastar nu ett tydligt fel i stället för att tyst slå mot FV 0, vilket var den första buggen i livetestet. ⚠ **BV fanns redan som `baseValue`** på vapenmodellen, oanvänt sedan tidigare — nu inkopplat: överstiger skadan BV sjunker BV med 1, och vid BV 0 går överskjutande skada igenom (verifierat 3 → 2). **Kvar:** chattkort, måldialog för riktade anfall, fummeltabeller, och att `vanlig`/`detaljerad` blir en världsinställning. |
| "Det rena utslaget" — perfekt bedövningsslag | **Done (2026-07-29)** | ⚠ **AVSTEG UTAN BOKSTÖD — creator decision, Johan 2026-07-29:** *"a non lethal critical hit would just knock them out perfectly, with no damage at all but severely unconscious for a couple of days and absolutely no trace how it was done."* Ett **perfekt** anfallsslag + **bedövande avsikt** + **riktat mot huvudet** ger noll skada och medvetslöshet i `1d3` dygn (världsinställning `cleanKnockoutDuration`). ⭐ **Nollan är hela poängen:** eftersom inga KP dras finns ingen sårskada att hitta — "inget spår" är mekaniskt sant, inte bara narrativt. Offret vaknar oskadat. ⚠ **Priset är inbyggt:** man måste rikta mot huvudet, vilket kostar −5 CL och alltså gör det perfekta slaget svårare att bekräfta — man betalar i träffchans för chansen till ett rent utslag. ⚠ Kräver medvetet BÅDE riktat huvudslag OCH bedövande avsikt; annars hade ett perfekt rapiestick "slagit ut" någon. Liveverifierat: skada 0, målets KP oförändrade, och ett perfekt slag utan riktning/avsikt gjorde fortfarande normal skada (6). |
| Icke-dödlig avsikt (`intent: "bedova"`) | **Done (2026-07-29)** | ⚠ **AVSTEG — boken har ingen icke-dödlig avsikt alls.** Johan 2026-07-29: *"A thief clubbing someone still could unintentionally unalive them."* Därför en HALV garanti: ett bedövningsslag som skulle dra Totala KP under noll stannar på **0** (medvetslös, SLB s.18), **men en kritisk träff följer bokens dödliga utfall ändå**. Man kan alltså fortfarande råka slå ihjäl någon. Liveverifierat i tre fall: 6 skada mot en arm med 4 KP kvar → stannar på 0 med `pulled: true`; samma slag med vanlig avsikt → −2; kritisk huvudträff med bedövningsavsikt → **−36 och död**. |
| Kroppsbyggnader och träffområden (`DODE.bodyPlans`) | **Done (2026-07-29)** | Grunden för riktade anfall. ⭐ **Nyckelinsikten: träffområdenas KP HÄRLEDS ur Totala KP** (RP s.48, Tabell 1-3). Därför behöver ingenting förberedas i en monsterpost — vilken varelse som helst kan få en kropp i samma ögonblick som någon siktar på den, vilket är exakt vad som krävs för Johans blandade läge (snabb strid som default, detaljer på begäran). `system.hitLocations` är ett tomt objekt tills första riktade anfallet. ⚠ **Kolumn A och B är olika TÄRNINGAR, inte bara olika tabeller** (RP s.49): A (`1T8` för humanoider) mot projektilvapen och mot någon som **inte försvarar sig**, B (`1T10`) mot någon som försvarar sig i närstrid. En försvarslös humanoid träffas i huvudet på **1/8**, en försvarande på **2/10** — det är den mekaniska belöningen för att smyga sig på någon. ⚠ **Under 5 Totala KP delas kroppen inte in alls**; över 30 ges **+1 per 5 KP**. Liveverifierat mot bokens tabeller i alla sex band, plus kentaurens och svanmöns egna band. |
| Kroppsbyggnad: fyrfotadjur | **Done — delvis konstruerad (2026-07-29)** | Johan: *"Kroppspoängtabell RP page 24 can be used for quad pedals as well."* ⚠ **KP-värdena är bokens** (RP s.24:s Kroppspoängstabell, samma som humanoiden) men **träfftabellen är konstruerad**: humanoidens två armar byts mot två extra ben och bröstkorg+mage slås ihop till en bål, med fördelningen speglad från humanoiden. Ett creator decision, inte en regel — ändras gärna. ⚠ Orm, fågel och amorfa varelser kvarstår okonstruerade (Johan: *"likely need to be constructed"*). |
| ⚠ Kroppsbyggnader som SAKNAS i källorna | **Blockerad — behöver beslut** | Johan 2026-07-29: *"All monsters and NPC need to have a hidden body type and hit areas. Bipedal, four pedal, snake, blob."* ⚠ **Boken har bara fyra:** Humanoid, Bevingad humanoid, Kentaur och Svan(mö) (RP s.48-50, Tabell 1-7). **Fyrfotadjur, ormar och amorfa varelser finns inte** — och merparten av de 14 monstren i `monster`-packet är just sådana. Får inte hittas på (CLAUDE.md). Tre vägar: (a) leta i Monsterboken/Monsterboxen efter fler tabeller, (b) härleda ur kentaurens hästkropp (som redan modellerar fyra ben + kropp), eller (c) uttalat skaparbeslut med egna tabeller. Tills dess faller alla varelser tillbaka på `humanoid`. |
| Initiativformel (`CONFIG.Combat.initiative`) | **Done (2026-07-29)** | `1d10 + @attributes.smi.total`, SLB s.16. ⚠ Innan detta var formeln **osatt**, så Foundry föll tillbaka på sitt eget `1d20` helt frikopplat från rollpersonen — vilket också drabbade moduler som Combat Carousel, som bara läser systemets formel. ⚠ NPC-datamodellen saknade `attributes.*.total` (bara `value`), så en enda formel hade kraschat för monster; `total` härleds nu även där, med kommentar om att NPC:er ännu inte har något bonuslager. Liveverifierat i en riktig `Combat`: rollperson SMI 14 slog 3 → 17, monster SMI 9 slog 10 → 19, och monstret gick först — tioan kan alltså vända ett SMI-övertag på 5, vilket är hela poängen med SLB:s variant. ⚠ Modifikationerna (Krigare +5, Karate +5, Hoppspark −2, Initiativbonus +5) ligger inte i formeln; de är situationsberoende och hör till stridslogiken. ⚠ REG:s konkurrerande regel (statisk SMI, 1T6 vid lika, vapenlängd först i SR 1) är INTE implementerad — se post 47 och regelprofilsfrågan. |
| Game Settings registration | **Partial (verifierat 2026-07-29)** | ⚠ Raden påstod "Zero `game.settings.register()` calls anywhere" — inaktuellt. Fyra finns nu: `attributeRollMode`, `allowRestartIfUnqualified`, `showAttributeRollsInChat`, `trainingFeePerWeek`. Needed for: active source books, NPC SB auto-apply, fumble table automation. |
| RollTable for hjältedådstabell | **Done (byggd 2026-07-28, raden rättad 2026-07-29)** | ⚠ Raden stod kvar som Not Started fast tabellen byggdes i §8.6-omgången. `packs/tabeller/_source/Hjältedådstabell_*.json` finns som RollTable (13 rader, 1T20) tillsammans med Skräcktabell och Särskilda förmågor. `DODE.hjaltedadTable` finns kvar i `config.mjs` för guidens skapandeslag — avsiktlig dubblering, inte en glömd migrering. Kvar: se backlogpost 46, hjältepoäng som spenderas efter skapandet. Ursprunglig text: `DODE.hjaltedadTable` remains a JS array in `config.mjs`. No `RollTable` document or compendium pack. |
| Localization sweep | **Not Started** | ~45 hardcoded Swedish strings in wizard, sheets, config. `lang/sv.json` covers types/attributes/skills but not UI labels. Gotcha found 2026-07-26: `system.json` only registers `sv`; a fresh Foundry world defaults Core Language to `en`, and since there's no `en.json` fallback every `{{localize "DODE...."}}` call then renders the raw key (e.g. `DODE.Actor.Ras`) instead of text. Not a code bug — just requires the GM to set Core Language to Svenska in Configure Settings on a new world. Worth a README/setup-guide callout. |
| `system.json` TODO URLs | **Done (2026-07-26, raden rättad 2026-07-29)** | ⚠ Raden var inaktuell — noll förekomster av `TODO` i `system.json` i dag. Se backlogpost 1. Ursprunglig text: `authors[0].url`, `url`, `manifest`, `download` are all `https://github.com/TODO/...` placeholders. |
| `CHANGELOG.md` | **Done (raden rättad 2026-07-29)** | ⚠ Raden var inaktuell — filen finns och hålls aktuell. Se backlogpost 2. |
| Niva schema migration (3→4 tier) | **Not Started** | Any actor created before the 4-tier `niva` change has a value not in the current `choices` list. No migration script. |
| Combat system (attack→damage, shield, backstab) | **Not Started** | Basic `rollSkill`/`rollAttack`/`rollWeaponDamage`/`castSpell` exist. No attack→damage chaining, shield parry/break, backstab mechanics, or distance modifiers. |

---

## 3. Open Backlog

### Critical

1. ~~**Fix `system.json` placeholder URLs.**~~ **Done (2026-07-26).** `url` had already been fixed to the real repo in an earlier session, but `authors[0].url`, `manifest`, and `download` were still `https://github.com/TODO/...` — found during a backlog review and corrected to `github.com/Adociouse` / `github.com/Adociouse/foundryvtt-drakar-och-demoner-expert`.
2. ~~**Create `CHANGELOG.md`.**~~ **Done.** File exists and is kept current (see `[Unreleased]` section).
3. **Niva schema migration (3→4 tier).** Actors created under the old `vanlig`/`extraordinar`/`hjalte` choices now hold a value not in the current 4-choice list. Needs a migration script or at minimum a documented manual fix. **Broader framing added 2026-07-27:** both dnd5e and PF2e ship a dedicated `migration/` subsystem (PF2e additionally has `migration-summary` and `compendium-migration-status` UIs) because Foundry migrates *schema* but never your *world data* — see §7.6. This item is really "adopt a minimal migration framework", with `niva` as its first case; there will be more once `system.identified`, skill modifiers, etc. land.
4. **Verify/accept BP/EP/maxFV placeholder numbers.** *(Se även backlogpost 31C — Spelledarbokens skadebonus- och förflyttningstabeller krockar med `config.mjs`, samma sorts källkonflikt.)* **Source found 2026-07-27 — the numbers were right, the attribution was wrong.** The **Alver** supplement p.22 (*"Hur du skapar en alv"*) carries an explicit level table: BP **125 / 150 / 175**, ability rolls **1 / 2 / 3**, EP **150 / 200 / 250**, Max FV from start **15 / 17 / 19** for Vanlig / Extraordinär / Hjälte. That sources the 150/175 previously flagged as unsourced extrapolations, and confirms `abilityRollsByNiva`'s existing 1/2/3. Two things still block closing this:
   - `DODE.bpByNiva` currently hardcodes **125 for every tier** — directly contradicting the table. The misleading code comment ("no per-type BP differentiation exists in HH") has been corrected, but the values are deliberately unchanged: the book frames these as *regelförslag* for elf creation specifically, and changing them retroactively shifts every existing character's budget. **Needs a rules decision.**
   - Our `epBudgetTable`/`maxStartFvTable` have an **age dimension** the book's flat per-level numbers lack, so they can't simply be overwritten — the two models need reconciling first.
   - `gudafodd` (the 4th tier) remains an extrapolation either way; the book has only three levels.

### Important

4b. ~~**Compendium visibility / spoiler leak.**~~ **Done (2026-07-27).** Audit found every pack — campaign adventure, Dimön test packs, all 14 monsters, and both magic items — readable by the Player-role account, because no manifest declared `ownership` and Foundry's default is `PLAYER: OBSERVER`. Fixed: `ownership` declared on all six system packs and the campaign module's `adventures` pack; `magiska-foremal` created as a GM-only pack and the two magic items moved out of the shoppable `vapen-utrustning`; the two `world.dimon-*` packs set GM-only via `pack.configure()`. Architecture written up as §7. Live-verified: player sees exactly `raser`/`yrken`/`besvarjelser`/`vapen-utrustning`, GM sees all nine.

4c. ~~**Wizard re-entry / character edit mode.**~~ **Done (2026-07-27)** — see §2. Two scope calls made during design and worth remembering: **race/yrke are read-only in edit mode** (Johan: *"most games don't allow changing these but require you to setup a new character"*) which conveniently eliminates the entire profession-swap skill-reconciliation minefield — no skill ever needs deleting, so edit mode structurally cannot destroy one; and **the equipment step is skipped** because once a character exists, inventory is play state and the wizard cannot tell a chargen purchase from dungeon loot. A GM who genuinely must change race/yrke still drags a replacement onto the sheet, which already swaps correctly.

4d. **Sköldar — utrett färdigt 2026-07-29, men blockerat på ett prisbeslut.**

   **`abs: 0` är RÄTT och ska inte ändras.** Sköldtabellen finns i **Spelarboken s.38** och har kolumnerna **STY-krav · BV · Vikt · Pris** — **ingen Absorbering-kolumn**. SB s.38 säger uttryckligen *"Sköldar har brytvärden precis som vapen. Brytvärdet sjunker också på samma sätt."* REG s.55:s formulering *"sköldens absorptionsförmåga"* är alltså lös ordning för samma sak som SB kallar **BV**. En sköld absorberar inte — den parerar, och går sönder när den tar för mycket.

   ⚠ **Vår `rustning`-modell saknar `bv` helt.** Det är det verkliga schemagapet, inte `abs`.

   **Sköldtabell (SB s.38):**

   | Sköldtyp | STY-krav | BV | Vikt (kg) | Pris (sm) |
   |---|---|---|---|---|
   | Targ (bucklare) | 1 | 9 | 1 | 500 |
   | Rundsköld, liten | 3 | 9 | 2 | 650 |
   | Vanlig sköld (trekantig) | 7 | 11 | 6 | 850 |
   | Långsköld (normandisk) | 7 | 11 | 6 | 900 |
   | Pavise (bågskyttesköld) | 18 | 11 | 16 | 900 |
   | Rundsköld, stor | 11 | 11 | 7 | 1 000 |
   | Scutata (romersk sköld) | 7 | 13 | 8 | 1 100 |
   | *Läderöverdrag* | +2 | +2 | +2 | +250 |
   | *Metallskoning* | +3 | +3 | +3 | +500 |

   ✅ **LÖST 2026-07-29 — SB är internt konsekvent, jag jämförde över utgåvor.** Johan visade SB:s närstridsvapentabell (s.35): **tvåhandssvärd 3 500 sm**, bredsvärd 1 000, kortsvärd 400. En liten rundsköld på 650 sm är alltså fullt rimlig *inom SB* — den kostar en bråkdel av ett tvåhandssvärd. Min invändning nedan jämförde SB:s sköld mot **REG:s** tvåhandssvärd (560) och skapade en motsägelse som inte finns. **Kvar är bara ett rent utgåveval:** REG:s prisskala eller SB:s (~6× högre, men konsekvent i sig). Ingen brådska — se post 42. Ursprunglig oro:

   ⚠ **PRISSKALORNA I REG OCH SB ÄR OFÖRENLIGA — hit går det inte att bara kopiera.** Vårt `vapen-utrustning`-pack ligger på **REG:s skala** (Kortsvärd 190, Bredsvärd 200, Tvåhandssvärd 560 = REG s.57 exakt). SB:s rustningstabell på s.37 prissätter samma sorts utrustning **ungefär 15-20× högre** (SB: läderrustning hela kroppen **1 300 sm**; REG: läder **25 sm/BEP** × ~3 BEP ≈ **75 sm**). Att importera SB:s sköldpriser rakt av skulle göra en liten rundsköld (650 sm) dyrare än ett tvåhandssvärd (560 sm). **Behöver Johans beslut:** skala om SB:s sköldpriser till REG-nivå, eller byta hela utrustningspacket till SB:s skala?

   **Två kurerade sköldregler är FEL** och rättade i `DODE_Regler_SKOLDAR.md`:
   - Projektilchansen (grundsystemet, REG s.55) är **1-6 / 1-4 / 1-2 på 1T20** för stor/medelstor/liten. `UTRUSTNING.md` anger 1/20 för stor och **"—" för de andra två**, alltså att medelstor och liten sköld inte skyddar mot pilar alls.
   - Förstörelsechansen gäller **per skadepoäng över sköldens tålighet**, inte 1/20 per lyckad parering som både `UTRUSTNING.md` och `REGLER_STRID.md` påstår — och slår inte alls om skölden klarar hela skadan.

   ⚠ **Sidofynd med samma rot:** rustningsraderna i packet har materialens **sm/BEP-taxa** inskriven som om den vore ett fast pris (Läder `price: 25`, Ringbrynja `175`, Metall `200`). REG s.53 säger *"Priset för en rustningsdel beräknas utifrån vikt och material"* — en lädderrustning kostar alltså 25 × sin BEP-vikt, inte 25 sm. Hjälmarna är rätt (de har egna fasta priser i boken). Egen post värd att lyfta när utrustningen görs om.

   Ursprunglig post: **`price: 0` on three shields.** Utrett 2026-07-29 mot REG s.52-55 (PDF, kurerat i `DODE_Regler_SKOLDAR.md`). Utredningen vände två gånger och slutar i en fråga till Johan:

   - **Först trodde jag `abs: 0` var en bugg.** Sedan visade `REGLER_STRID.md` att en sköld ger *"separat parering utöver vapnets"* — den absorberar inte som en rustning, så 0 såg riktigt ut.
   - **Men REG s.55 motsäger även det:** sköldförstörelseregeln lyder *"för varje skadepoäng som överstiger **sköldens absorptionsförmåga** ... 1/20 chans att skölden blir totalförstörd"*. En sköld HAR alltså en absorptionsförmåga.
   - ⚠ **Ingen tabell i grundregelboken ger den.** Genomsökt utan träff: s.52 `Rustningar` (kroppsdelar), s.53 `Rustningsvikter`+`Pris`, s.57 `Närstridsvapen`, s.58 `Projektil-/Kastvapen`, SB s.42-44 `Utrustningslistor`. Sköldar får mekanik men aldrig Abs/BEP/pris.

   **Behöver ett beslut** (CLAUDE.md: gissa inte, fråga): antingen hittas värdena i ett supplement, eller sätts de som ett uttalat skaparbeslut. Rustningar prissätts `material sm/BEP × vikt`, så samma modell skulle kunna gälla sköldar om vi väljer en BEP per storlek.

   **Två kurerade sköldregler är dessutom FEL** och rättade i extraktet:
   - Projektilchansen är **1-6 / 1-4 / 1-2 på 1T20** för stor/medelstor/liten. `UTRUSTNING.md` anger 1/20 för stor och **"—" för de andra två**.
   - Förstörelsechansen gäller **per skadepoäng över absorptionsförmågan**, inte 1/20 per lyckad parering som både `UTRUSTNING.md` och `REGLER_STRID.md` påstår — och slår inte alls om skölden absorberar hela skadan.

   Ursprunglig post: **`price: 0` on three shields.** ⚠ **Värre än posten sagt** (kontrollerat 2026-07-29): `Liten sköld`, `Medelstor sköld` och `Stor sköld` har inte bara pris 0 utan även **`abs: 0`** — de ger alltså inget skydd alls. En spelare som köper en sköld i guiden får ett gratis föremål utan effekt. Prisdelen är kosmetisk, absorptionsdelen är en regelbugg. Ursprunglig post: **`price: 0` on three shields.** `Liten sköld`, `Medelstor sköld`, `Stor sköld` are free in the wizard shop. Almost certainly a data gap rather than intent — check against `UTRUSTNING.md` during the equipment import. (The magic items had the same bug; that half is fixed.)

4a. ~~**Check actor/NPC sheets for the same `.window-content: overflow:hidden` clipping risk as the wizard.**~~ **Done (2026-07-26).** Confirmed and fixed same session: `.dode.sheet.character .window-content` and `.dode.sheet.npc .window-content` now get `overflow-y: auto` in `dode.css`. Also discovered and fixed while there: the NPC sheet had never received the wood-frame border-image / leather background theme that the character sheet and wizard have (`.dode.sheet.npc` was simply missing from those CSS selectors) — added for visual consistency across all three windows.
5. **Game Settings registration.** ⚠ *Delvis löst 2026-07-28* — de tre första inställningarna finns nu (`attributeRollMode`, `allowRestartIfUnqualified`, `showAttributeRollsInChat`, se §2). Kvarstår enligt ursprunglig post:  active source books (`world` scope, `Array<String>`), NPC damage bonus auto-apply (`Boolean`, default false — source inconsistency documented), fumble table automation level.
6. **Localization sweep.** Move ~45 hardcoded Swedish strings to `lang/sv.json`. Enables future English localization. No gameplay risk — purely additive.

6a. ~~**Name-based matching is a localization landmine.**~~ **Done (2026-07-27).** `fardighet` gained `system.skillKey`; `DODE.skillKey(name)` is the canonical slugifier (å/ä→a, ö→o, non-alphanumerics→`-`), and all 83 config entries now carry **explicit frozen `key` fields** so a display-name edit can never silently change identity. Every match point moved off names: `#skillPreview` dedupe, `#loadBoughtSkillFv`, `state.fardigheter` keys, `data-skill` in the template, buy/sell handlers, `#applyToActor` reconciliation, and the sheet's skill picker. Legacy skills without a key fall back to `DODE.skillKey(name)` and are **backfilled on the next wizard save**, so migration is self-healing — verified on a 25-skill character: 25 before → 25 after, 0 duplicates, 25 keys backfilled. Profession skills in compendium JSON still derive their key at runtime (they have no explicit `key` field yet) — fine, since both sides use the same function. Original analysis kept below for context.

   **Bug this uncovered:** wizard-created `ras`/`yrke` items had `_stats.compendiumSource === null`, because Foundry only populates that on real compendium *import*, not when creating from `toObject()`. Edit mode's source lookup relied on it, so race and profession silently failed to resolve — meaning base chance was computed **without race modifiers** and profession skills were never reconciled. Fixed by stamping our own `flags.<sysid>.sourceUuid` at creation, plus a name-match fallback (resolved async in `_prepareContext`) for characters made before the flag existed. Raised by Johan 2026-07-27 (*"is not UUID preferred for future English language implementation?"*) while reviewing the test fixtures — the concern generalises well beyond that script. Several places key off **display names** rather than stable identifiers:
   - `character-wizard.mjs` `#applyToActor` reconciles skills by `name.toLowerCase()`
   - `#skillPreview` de-duplicates profession skills against primary skills by name
   - `#loadBoughtSkillFv` keys `state.fardigheter` by skill name
   - `CONFIG.DODE.primarySkills` / `secondarySkills` carry Swedish names as their de-facto identity

   Today this is **safe**, because skill Items are created from the config table and always carry that exact name, so both sides of every comparison use the same string. It breaks the moment either (a) those config names get run through `game.i18n`, or (b) a Babele-style module renames compendium documents at runtime — a character created under one language and edited under another would fail to match and **silently create duplicate skills**. Fix when localizing: give `fardighet` a stable `system.skillKey` (e.g. `"smyga"`) separate from its display name, and match on that everywhere. Cheap now, expensive after real characters exist. The test fixtures already moved to UUID references for exactly this reason (`docs/dev/seed-test-party.js`).
7. **Skill modifier system (auto-sourced).** Flat `bonus`/`total` field pattern done (2026-07-26, see §2) — this item now specifically means the automatic race/yrke/förmåga-sourced `modifiers[]`/`effectiveFv` layer, required before ability bonuses like Skogsalv's +10 CL Gömma sig can be mechanically active. Blocked on an architecture decision (embedded-Item skills can't be targeted by transfer AEs the way actor attributes can — see §2 for the technical detail) before implementation.
8. ✅ ~~**Hjältedådstabell as RollTable.**~~ **Done 2026-07-28** (upptäckt oavslutat vid backloggenomgången 2026-07-29 — posten byggdes i §8.6-omgången men bockades aldrig av). Ligger i `packs/tabeller`. Ursprunglig text: 13-row, 1d20 table. Natural fit for Foundry `RollTable` — rollable from chat, linkable in journals.
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

13. **"Choose 12 of N" yrkesfärdigheter — och det underliggande datagapet.** Utrett 2026-07-28 på Johans fråga om de tre kostnadskategorierna.

    **Det som FUNGERAR:** de tre kategorierna finns (`DODE.costTiers`: `primar`/`yrkesfardighet`/`sekundar`) med rätt grundkostnader **2 / 3 / 5** (RP s.30, bekräftat mot YRKEN.md), och EP-motorn är **verifierad mot bokens eget räkneexempel på RP s.30** — alla 7 delposter i Andreas-exemplet stämmer exakt (Långbåge 4→15 = 51 EP, Kortsvärd 2→11 = 30, Trästav 4→9 = 15, Smyga 4→10 = 12, Rida 4→11 = 16, Spåra 2→5 = 6, plus Klättra 4→10 = 12). `skillCostCumulative` reproducerar alltså bokens från×till-matris korrekt, och guiden sätter `primar` på alla 16 primärfärdigheter.

    **Tre gap kvarstår, i storleksordning:**
    - ⚠ **25 av 36 yrken har TOM `professionSkills`.** Samtliga specialiseringar (krigar-, tjuv-, lönnmördar- och bardyrken från KH/T&L) saknar färdighetslista helt — en rollperson med specialisering får alltså **inga yrkesfärdigheter alls**. Det är det största gapet och en ren dataluckor-fråga: listorna finns i KH s.4-9 och T&L s.7-16.
    - **4 yrken har FLER än 12** (Bard 24, Lärd man 22, Lönnmördare 20, Helare 19) och får i dag alla på `yrkesfardighet`-nivå. Det är här "välj 12"-mekaniken behövs — magiker väljer 9 enligt YRKEN.md.
    - **6 yrken har färre än 12** (3, 4, 6, 7, 9, 9) — underspecificerade mot boken.
    - **Sekundära färdigheter skapas aldrig vid rollpersonsskapandet** — de går bara att lägga till efteråt via arkets färdighetsväljare. Det är förmodligen rätt (RP:s EP-budget går till primära och yrkesfärdigheter), men bör bekräftas.

    **Delvis åtgärdat 2026-07-28 — Krigarens Handbok klar (8 av 25).** Lästa ur PDF:en (KH tryckt s.4-8), inte ur textextraktet: tvåspaltslayouten flätar ihop varje yrkes lista med grannens ("Maximalt fem valfria vapen- **det de får för grundegenskapen.** färdigheter …"), så extraktet är obrukbart här. Barbar 26, Gladiator 26, Krigarmunk 25, Paladin 31, Prisjägare 30, Soldat 33, Sprätthök 26, Vapenmästare 25 poster.

    ⚠ **Specialiseringar ÄRVER INTE grundyrkets lista** — KH s.4 ger var och en en egen komplett "Möjliga yrkesfärdigheter". Undantaget är **Riddare**, som är ett grundyrke där KH s.7 bara skriver "Se Grundreglerna, med följande tillägg" — där lades de 12 posterna TILL RP-listan (9 → 21). Ett första försök skrev över RP-listan i stället, vilket upptäcktes och rättades.

    ⚠ **Listorna innehåller platser, inte bara namn.** "Maximalt fem valfria vapenfärdigheter", "Tala maximalt två valfria främmande språk", "maximalt ett valfritt Hantverk", "en valfri Stridskonst" går varken att uttrycka som namn+grundegenskap eller att dela ut automatiskt. `professionSkills` fick därför **`choiceCount` + `choicePool`** (0 = vanlig namngiven färdighet). Barbar blir t.ex. 24 namngivna + "5× vapenfärdighet" + "1× främmande språk". **Guidens UI hanterar dem inte än** — den delar fortfarande ut alla poster rakt av, så valplatserna syns som rader utan att gå att fylla. Det hör ihop med "välj 12"-mekaniken.

    ⚠ **Två listor bryts av en sidbrytning** (Paladin efter "Vagnsförare", Prisjägare efter "Undre världen") — de eventuellt saknade svansarna är noterade i respektive items beskrivning i stället för att gissas.

    **✅ KLART 2026-07-28 — alla 36 yrken har nu yrkesfärdigheter, 0 tomma.** T&L-delen (tryckt s.6-14) gav 17 nya listor plus tillägg till tre grundyrken. Största listorna: Kunskapare 53, Spion 50, Gentlemannatjuv 43, Kultist 40.

    ⚠ **Felklassificering hittad och rättad: `Spelaren` låg som `lonnmordare`** men T&L s.8 listar **Spelare** under **BARDYRKEN** (bokens fem nya bardyrken är Bedragare, Gycklare, Kurtisan, Fingerkonstnär, Spelare). `baseProfession` ändrad till `bard`, vilket också flyttar kortet till rätt grupp i guiden. ⚠ Vårt item heter fortfarande `Spelaren`; boken skriver `Spelare` — ej omdöpt, eftersom namnbyte påverkar befintliga rollpersoners kompendiekoppling.

    ⚠ **Tre grundyrken fick TILLÄGG, inte ersättning** — Bard, Lönnmördare och Tjuv står som "Se Drakar och Demoners regelböcker, med följande tillägg" (Bard 24→33, Lönnmördare 20→39, Tjuv 4→19). Samma mönster som Riddare i KH.

    **Extraktet är skrivet tillbaka** som `docs/extracts/DODE_Yrkesfardigheter_KH_TL.md` i Roll20-projektet (403 rader, alla 25 specialiseringar + 4 tillägg, med sidoffset och valplatser dokumenterade) — enligt den nya extraktpipeline-regeln i `CLAUDE.md`, så nästa session slipper läsa om samma sidor.

    **✅ "Välj 12 av N" byggt 2026-07-28 — backlog 13 därmed stängd.** Nytt guidesteg `yrkesfardigheter` (efter yrke/magiskola) där spelaren väljer **12** ur yrkets lista, **9 för magiker** (RP s.11). Taket är `min(12, tillgängliga)` eftersom flera grundyrken listar färre än 12. Namngivna färdigheter är klickbara chips; **valfria platser** renderas som N textfält med `<datalist>`-förslag.

    ⚠ **Fritext, inte tvingande lista, för valplatserna.** Systemet har ingen katalog över vapenfärdigheter — vapnen är `vapen`-**Items**, och färdigheterna namnges efter vapnet. De 18 vapnen ur kompendiet erbjuds som förslag, men fältet är fritt: en tvingande rullgardin ur en ofullständig lista hade blockerat giltiga val (främmande språk och hantverk är dessutom världsspecifika).

    ⚠ **`#skillPreview` använder nu spelarens val, inte hela listan.** Tidigare fick en bard alla 24 posterna som yrkesfärdigheter i stället för 12 — det sprängde både regeln och EP-budgeten. Steget är dessutom spärrat tills målet är nått, och redigeringsläget återskapar valen ur rollpersonens befintliga `yrkesfardighet`-färdigheter så att en omöppnad guide inte nollställer dem.

    Liveverifierat end-to-end: Barbar med 2 fyllda platser (Långbåge, Alviska) + 10 chips gav **exakt 12** yrkesfärdigheter på arket och 16 primära — inget annat. Försök att välja en 13:e avvisas, Magiker visar 0/3 (`min(9, 3)`), Bard 0/12 av 33 möjliga.

    **✅ Grundyrkena kompletterade 2026-07-28.** Johan tog upp att en sjöfarare eller utbygdsjägare med för få yrkesfärdigheter borde få lägga EP någon annanstans. **Premissen visade sig vila på ett datafel, inte en regellucka:** YRKEN.md hade hela tiden de fullständiga listorna (RP s.11-22) — vårt pack hade bara fått trunkerade. Portade: Magiker 3→21, Utbygdsjägare 6→21, Sjöfarare 7→24, Krigare 9→14, Munk 12→33, Riddare 12→35, Tjuv 19→44, Helare 19→22, Lärd man 22→25, Bard 38, Lönnmördare 39→43. **Alla elva grundyrken når nu sitt tak** (Magiker 9, övriga 12) — ingen fallback-regel behövs. Supplementens tillägg bevarades vid sammanslagningen.

    ⚠ Detta bekräftar också YRKEN.md:s egen formulering "**(välj 12)**" respektive "**Magiker (välj 9)**" — samma tal som RP s.11 och som `#professionSkillTarget` använder.

    **13b. ⚠ Sekundära färdigheter ska INTE gå att välja i guiden — verifierat mot RP s.28-29 (2026-07-28).** Johans fråga var om sekundära borde vara en tredje valnivå i guiden. Boken säger uttryckligen nej, på tre ställen:

    - **RP s.28, STARTFÄRDIGHETER:** *"Dina startfärdigheter är lika med de primära färdigheterna … samt dina yrkesfärdigheter (de 12 som du redan valt). **Du kan aldrig lära dig en sekundär färdighet från början, utom ifall du fått det som särskild förmåga.** Magiker kan lära sig besvärjelser från början, men inte utbygdsjägare."*
    - **RP s.29, SPENDERA ERFARENHETSPOÄNGEN:** *"Du kan heller aldrig köpa FV i en sekundär färdighet från början, om du inte fått en Särskild förmåga som säger annat."*
    - **Bokens eget räkneexempel (s.29)** understryker det: Andreas har Låsdyrkning FV 3 via en särskild förmåga och *"skulle väldigt gärna vilja köpa några FV i Låsdyrkning, men det får han inte eftersom det fortfarande räknas som en sekundär färdighet."*

    Guiden gör alltså **rätt** som inte erbjuder dem — men av en slump snarare än av design, och hjälptexten i färdighetssteget nämner sekundärkostnaden 5 EP utan att förklara att den inte gäller vid skapandet. Kostnadsnivån `sekundar` är fortfarande korrekt och behövs — den används när färdigheter läggs till **efter** skapandet via arkets färdighetsväljare, och av `DODE.skillCost`.

    **Det verkliga gapet ligger i särskilda förmågor.** Enda lagliga vägen till en sekundär färdighet vid skapandet är en särskild förmåga som ger den — och **15 av de 49 posterna i `DODE.specialAbilitiesTable` ger färdighetsvärde**, varav flera uttryckligen sekundära:

    | Slag | Förmåga | Effekt |
    |---|---|---|
    | 3-4 | *(namnlös)* | +1 FV på valfri sekundär färdighet |
    | 11-12 | Hantverkarbakgrund | +3 FV i valfri hantverksfärdighet |
    | 19-20 | Hobbyist | **FV 3 i valfri sekundär färdighet** |
    | 37-38 | Stort kunskapsområde | Två valfria sekundära färdigheter **som yrkesfärdigheter** |
    | 64 | Lättlärd | Sekundärkostnaden sänks från 5 till 4 EP |

    I dag är förmågesteget ren fritext — det slår fram namn och beskrivning men **skapar inga färdigheter och ändrar inga kostnader**. Att bygga det innebär (a) en maskinläsbar effekt per tabellrad, (b) ett val-UI för "valfri sekundär färdighet" (samma mönster som `choiceCount`-platserna i yrkesfärdighetssteget), och (c) att `Lättlärd` och `Stort kunskapsområde` kan ändra `costTier`/grundkostnad för enskilda färdigheter. **Ny backlogpost 36.**

    ⚠ **Besvärjelser har en HELT ANNAN kostnadsbas** som inte är implementerad: RP s.30 ger grundkostnad efter besvärjelsens **skolvärde** (1-3:2 · 4-6:4 · 7-9:6 · 10-12:8 · 13-15:10 · 16-18:12 · 19-21:14 · +3:+2), inte efter kostnadskategori. Magiskolesteget skapar i dag skolan som en `fardighet` med `yrkesfardighet`-nivå, vilket är rätt för själva SKOLAN men det finns ingen mekanik för att köpa enskilda besvärjelser.
14. **Expand compendium coverage.** **Partially done (2026-07-27)** — races and professions are no longer the gap: 6 elf lineages (Alver s.22) brought races 7→13, and 25 specialisations (KH/T&L, via the Roll20 project's `docs/wiki/YRKEN.md`) brought professions 11→36. Still thin: **weapons ~50%**, **spells <5%** (8 of the full MAG list), **monsters** (14 sample entries). ⚠ Every future addition must also ship art in the same pass — see `CLAUDE.md`s "Bildpipeline" (pipeline step 2b); the current 106 documents are 100% covered and that state should not be allowed to regress. Note the spell gap is the awkward one: 13 magic schools are pickable in the wizard but only 8 spells exist across all of them.

   **14a. Spell source verified 2026-07-27 — the full catalogue exists, curated and book-cited.** The Roll20 project's `docs/wiki/MAGI.md` §"Besvärjelsetabeller per skola" holds **331 spells + 31 minibesvärjelser across all 13 schools**, each with S-värde / varaktighet / räckvidd / effect and sourced to Formelboken s.1–74. Fidelity spot-checked mechanically: **348 of its 363 spell names (95%) are verbatim-findable in the raw book OCR** (`docs/extracts/D&DE Magi_*.txt`, diacritic-folded match) — the misses look like OCR damage, not invention. So this is a *porting* job like the secondary-skills and särskilda-förmågor catalogues were, **not** an OCR transcription from scratch. Per-school counts: Mentalism 57, Elementarmagi 42, Harmonism 30, Animism 29, Symbolism 27, Spiritism 26, Nekromanti 25, Häxkonster 23, Illusionism 23, Stavmagi 20, Röstmagi 18, Demonologi 9, Allmänna 2. ⚠ Alkemi has **no ordinary spells at all** by design (the alchemist brews elixirs instead) — the wizard's magiskola step must not imply otherwise. ⚠ OCR uncertainty is unevenly distributed: Nekromanti (49 `⚠`), Symbolism (43), Animism (38), Harmonism (37), Elementarmagi (33) carry many flagged values; Illusionism (3) and Röstmagi (5) are nearly clean. Carry those flags into the item data, per the project's rules-fidelity stance.

   ⚠ **Do NOT port the standalone HTML chargen's spell list.** Verified same session: its 48 spells (a tidy 8 per school across only 6 schools) are largely **not book content** — only 13 appear anywhere in `MAGI.md` and only 22 in the raw book OCR, with whole schools fabricated (Symbolism 0/8 real: `Varningsruna`/`Skyddsruna`/`Sigillsköld`/`Eldssigill`/`Banruna`/`Bindningsruna`/`Kraftruna`/`Trollkorsruna` match nothing in the book's actual 27-spell Symbolism table; Nekromanti likewise). Its S-values are also a re-tiering (S1–S12, evenly spread) rather than the book's S2–S22 — e.g. it lists `BLIXT S8` and `ELD S2` where Formelboken says Blixt S6 and Eld S6. This is the mirror image of the elf-lineage case: the HTML was *right* about the Alver data and is *wrong* here, which is exactly why `CLAUDE.md` says to verify against the curated rules docs before porting anything from it.

   **14b. Verified spells ported 2026-07-27 — the compendium went 8 → 176.** Johan's call: port everything that passed the verification filter, leave the rest. Filter = the `MAGI.md` row carries **no `⚠` anywhere** AND the spell name is verbatim-findable (diacritic-folded) in the raw book OCR. Of 332 rows: 145 carried a `⚠`, 6 were unfindable, 25 were Nekromanti (skipped — Johan is sourcing that school manually from another book he recalls it being in), 6 were duplicates of what we already shipped → **168 new items**. Per school: Mentalism 36, Elementarmagi 30 (25 new), Illusionism 18, Spiritism 18, Häxkonster 17, Stavmagi 15, Röstmagi 14, Harmonism 13, Animism 9 (6 new), Symbolism 4, Demonologi 2. ⚠ Symbolism and Animism come out badly (4 of 27, 9 of 29) precisely because they are the most OCR-damaged schools — that is the filter working, not a porting bug. The two "Allmänna besvärjelser" (Permanens, Nexus — learnable from any school) have no school-agnostic value in the `school` enum, so they are filed under `elementarmagi` with a note in their description; **a proper `allmanna` school value is the cleaner fix** if the enum ever gets touched. No schema change was needed. Live-verified: 176 documents load with 0 console errors, every `sValue`/`school` valid, and a spell dragged onto a character renders with its cast button and effektgrad input.

   ⚠ **Spell art is deliberately the school symbol, not per-spell icons** (Johan's call, 2026-07-27). Each of the 168 new spells shows its magic school's sigil; the original 8 keep their bespoke icons. This is a design choice rather than a placeholder — a spell bearing its school's mark reads as intentional in a way `icons/svg/item-bag.svg` never did — but distinct per-spell art remains desirable. **New backlog item: generate 165 distinct spell icons.** Until then the "Bildpipeline" rule in `CLAUDE.md` is satisfied by the school-symbol fallback for spells specifically.

   **14c. Minibesvärjelser are a different mechanic and must NOT be modelled as `besvarjelse` items.** Johan flagged this while the port was running, and MAG s.23 (via `MAGI.md` §Minibesvärjelser) backs it: a minibesvärjelse **requires no CL check — it always succeeds**, costs a flat **1 PSY** (no effektgrad scaling), is **always Kvick** (resolves in the same SR), and **need not be written in the formelsamling** — the magician simply always has it. There is no roll, no failure case, no snedtändning and no effektgrad, which is most of what `besvarjelse` and `castSpell()` exist to model; a cast button that rolls would be actively wrong for them. They are flavour/utility ("Lugna", "Putsa/Smutsa", "Smaksätt", "Vindpust", "Bläckfinger", "Kritfinger"), explicitly meant for frequent out-of-combat use to build an aura of mystique — not battle magic. The 31 minibesvärjelser in `MAGI.md` were consequently **left out of the port** (the extractor only reads the 5-column spell tables; the mini tables are 2-column). Their access rule is also school-derived rather than per-item: a magician automatically has the minimagi of whichever school they have the **highest FV** in, and outward gestures stop being required at FV 15+, becoming near-unconscious at FV 25+. **New backlog item 25** covers building them as their own thing rather than shoehorning them in.

   **14d. Nekromanti ported 2026-07-28 from a second book — and the two books disagree.** Johan recalled the necromancy spells living elsewhere; he was right. **`D&DE 0_Magi.pdf` (Magi-regelboken) s.22–25** carries a complete, self-contained Nekromanti chapter of **15 spells**, all now in the compendium (total 191). Values were read **off the PDF pages**, not the OCR dump — see the trap note below. ⚠ **This is a different list from `MAGI.md`'s**, which is sourced to the *Formelbok*: Magi-regelboken has Besudla/Tala med död/Kontrollera andar/Smärta/Terror/Dödshand/Voodooritual, the Formelbok has Gasmoln/Spindelböld/Chock/Fobi/Ormskott/Klohand/Träorm/Sjukdom/Skendöd/Huggtänder/Epidemi/Krypande hand/Massa/Spökskepp/Förruttnelse/Frammana dödsriddare. Where they overlap the S-values mostly agree (Paralysering 7, Kontrollera lägre odöd 8, Rädsla 9, Animera död 12, Panik 13, Kontrollera högre odöd 17, Livsuttömning 18) **but Blindhet is S10 in Magi-regelboken and S6 in the Formelbok** — an unresolved conflict, flagged rather than silently picked. Only the Magi-regelbok list is shipped; merging the Formelbok's remaining ~16 is a separate decision about which book governs.

   ⚠ **The `_text.txt` OCR mangles exactly the fields that matter.** `Sxl` is `Sx1`, `SxlO` is `Sx10`, `LIVSUTTÖMNIMG` is `LIVSUTTÖMNING`, and the two-flag form `(R, F)` made a naive parser skip Voodooritual entirely (14 found instead of 15). Conversely `S/2 rutor` for Tala med död looks like an OCR error for `Sx2` but is **correct** — it really is division. Read the PDF pages for anything numeric.

   **The remaining spell gap is now the `⚠` rows, not missing content.** 145 flagged rows + 25 Nekromanti rows are still unported. Closing them means resolving OCR damage against the PDFs (`Drakar och Demoner Expert Files/`) rather than porting — the `⚠` values are things like a missing varaktighet or an unreadable S-värde, not missing spells.

   **Our existing 8 spells are correct** — all 8 match `MAGI.md` exactly on school, S-värde, räckvidd and varaktighet (Låga S2, Sköld S3, Blixt S6, Eld S6, Förtrolla vapen S6, Kamouflage S7, Väderförutsägelse S8, Hela S12). `item-besvarjelse.mjs` already has every field the catalogue needs (`school`, `sValue`, `duration`, `range`, `ritual`, `kvick`, `description`), so a bulk port needs no schema change. One small defect: **`Eld` has an empty `duration`** where Formelboken says `Omedelbar` (`Kamouflage` and `Låga` are also empty, but there the source itself is `⚠`).
15. ~~**Prototype token defaults.**~~ **Done (2026-07-27)** — see §2. Both manifest keys added *and* the wizard now sets a full prototype token (actorLink, sight, disposition, portrait) that it previously never touched.

15a. **Store / merchant actor architecture.** Johan 2026-07-27, deciding the equipment question: *"Equipment likely should have its own architecture as you might want to open up different stores while playing afterward. There should probably be something like a default store actor where one can buy normal equipment."* This is where post-chargen buying lives, and it is the concrete implementation of §7.2's merchant-actor workflow (stock in an NPC actor, party granted `OBSERVER` while in town, revoked after). Would also give the magic-shop scenario a home without ever exposing the full `magiska-foremal` catalogue.

15b. **GM-granted out-of-profession learning.** Johan's scenarios: the whole party joins a knight school and learns basic jousting; a mage joins a guild — or a necromancer cult — and learns previously hidden spells from a module pack. This is a *GM grants content* flow, deliberately **not** wizard re-entry (which is locked to the character's own profession). The skill picker plus GM-only module packs (§7.5 registry) already cover much of the mechanism; what's missing is a deliberate GM-facing "teach this to these characters" action.

15d. ~~**Test fixtures / test-case catalogue.**~~ **Done (2026-07-27).** `docs/TEST_CASES.md` (catalogue + module-compatibility checklist + manual edge cases) and `docs/dev/seed-test-party.js` (console-pasteable seeder). Seven fixtures: a four-character party covering the mechanical range (race bonus, no-race-modifier baseline, negative race mod, caster) plus three edge cases (no race/profession, highest niva × worst age, negative attribute). Fixtures are created **through the wizard's own create path**, so seeding doubles as a wizard regression test, and are tagged `flags.<sysid>.testFixture` for exact teardown. Verified: all 7 seed cleanly, and the negative-attribute case (`Anka` KAR −1) renders without error at Grupp 0. Both files live under `docs/`, which is excluded from the runtime distribution zip.

15c. **Verify popular optional modules work with this system.** Johan 2026-07-27 (Carousel Combat Tracker looks especially desirable). Community modules commonly assume dnd5e/PF2e data paths, so each needs checking against ours — most relevant are the token/combat ones (Carousel Combat Tracker, Monk's Combat Marker, Dice So Nice, Dice Tray, Torch, Tokenizer, PopOut!). The `primaryTokenAttribute`/`secondaryTokenAttribute` work in 15 helps here: several combat/HUD modules read the token bar attributes rather than system-specific fields.
47. **⚠ Initiativ är inte konfigurerat — och SLB motsäger REG om vad initiativ ens ÄR.** Upptäckt 2026-07-29 när Johan frågade om Combat Carousel. ⚠ **RÄTTAD SAMMA DAG:** min första slutsats ("DoDE:s turordning är inget tärningsslag") byggde på `REGLER_STRID.md`/REG. **Spelledarboken s.15 säger tvärtom:** *"Först i stridsrundan ska alla stridsdeltagare slå ett initiativslag, **1T10+SMI** (plus eventuella övriga modifikationer)... Om två deltagare får samma resultat låter man dem slå om... Turordningen är densamma hela stridsrundan ut."* Johans antagande om formeln stämde alltså — den kommer ur SLB, inte ur Foundry. **Kvarstår:** systemet rör aldrig `CONFIG.Combat.initiative`, så Foundry faller tillbaka på ett rent `1d20` utan koppling till rollpersonen — Combat Carousel inkluderad. Med SLB:s regel blir mappningen enkel: `CONFIG.Combat.initiative = { formula: "1d10 + @attributes.smi.total", decimals: 0 }`, och SL slår dolda slag för SLP (Foundrys egen dolda-initiativfunktion). ⚠ Två saker formeln inte rymmer: modifikationerna (Krigare +5, Karate +5, Hoppspark/Rundspark −2, stridskonsttekniken Initiativbonus +5) och **REG:s vapenlängdsregel för SR 1**, som SLB inte nämner — se konflikttabellen i `DODE_Spelledarboken_STRID.md`.

48. **Stridssystemet — hela kapitlet utrett 2026-07-29, redo att byggas.** Johan: *"vi behöver skärskåda det här kapitlet inför stridslogiken, det verkar rörigt."* Det var rörigt, och nu finns en kurerad genomgång: **`docs/extracts/DODE_Spelledarboken_STRID.md`** (SLB s.14-18). Det viktigaste för implementationen:
   - ⚠ **Två stridssystem, inte ett.** *Vanlig strid* för monster/djur/icke-humanoider (bara Totala KP, **inga pareringsslag, inga träffområden**) och *detaljerad strid* mellan personer. Parentesen "(gäller ej vanlig strid)" i pareringsavsnittet är en systemväxel, inte ett tryckfel. **Implementationen behöver en växel.**
   - ⭐ **Handlingar per SR — det här är vad en sköld är till för.** Ett vapen: attack **ELLER** parering. Vapen + sköld: attack **OCH** parering (eller parera med båda). Vapen i varje hand: två attacker, två pareringar, eller en av varje. Skölden köper alltså **en extra handling**. Vid flera attacker avverkas alla första attacker i turordning, sedan alla andra.
   - ⭐ **BV (brytvärde) är en slitagemätare, inte en absorbering.** Varje gång en parering tar emot ett hugg vars skada **överstiger** BV sjunker BV med **1**; vid **BV 0** går den överskjutande skadan igenom till försvararen. En parering där skadan ≤ BV kostar ingenting. ⚠ Vid **misslyckat anfall + lyckad parering** slits **anfallarens** vapen — ett vapen kan gå sönder av att bli parerat.
   - **Avståndsstrid:** projektilvapen (pilbåge, armborst, blåsrör, arbalest, bola, slunga) kan **aldrig** pareras; kastvapen (kastdolk, kastyxa) kan pareras **om försvararen har sköld och ser kastet**. Man kan aldrig parera med ett avståndsvapen i handen. Minst en ruta mellan skytt och mål; skjuta genom upptagna rutor ≈ 50 % risk att träffa fel.
   - **Att söka skydd:** kräver att man **handlar före skytten i turordningen**, kostar hela stridsrundan, och ger −differensvärdet på skyttens CL vid ett lyckat **Normalt SMI-slag**. Skytten måste ändå skjuta.
   - Resultatmatrisen (9 rader anfall × parering), båda CL-modifikationstabellerna, träfftabellen, skadeordningen och hela KP-/kroppsdelstabellen finns transkriberade i extraktet.
   - ⚠ **Fyra konflikter mot REG** listade sist i extraktet: initiativet, vapenlängd i SR 1, sköldars tålighet (SLB:s deterministiska BV-slitage mot REG:s 1/20-chans) och sköldars projektilskydd (REG:s 1T20-tabell mot SLB:s "söka skydd"). Samma gamla-mot-nya-utgåva-fråga som magi och priserna — se post 42. Upptäckt 2026-07-29 när Johan frågade om Combat Carousel. **Två fynd:**
   - Systemet rör aldrig `CONFIG.Combat.initiative`. Det finns noll referenser till `initiative` i `dode.mjs` och `system.json`. Foundry faller därför tillbaka på sin egen standard (`1d20`), vilket betyder att Combat Carousel — eller Foundrys egen stridsspårare — slår **ett rent 1T20 utan koppling till rollpersonen**. Johans antagande att formeln redan skulle vara förkonfigurerad till `@attributes.smi.bonus + 1d10` stämmer alltså inte för det här systemet; ingenting är satt.
   - ⚠ **DoDE:s turordning är ingen tärning.** REGLER_STRID.md (REG s.56): *"Turordningen baseras på **SMI** — högst SMI agerar först. Lika SMI: slå 1T6, högst slår först."* Alltså en **statisk SMI-jämförelse** med 1T6 enbart som skiljeslag. Ovanpå det: **vapenlängd slår ALLTID först i stridens första SR**, och sedan gäller normal turordning från SR 2. Initiativmodifikationer finns också — Krigare +5 (yrkesförmåga), Karate +5 på SMI, Hoppspark/Rundspark −2, stridskonsttekniken Initiativbonus +5.
   - **Rimlig Foundry-mappning:** `CONFIG.Combat.initiative = { formula: "@attributes.smi.total + (1d6)/10", decimals: 1 }` — SMI dominerar, tiondelen bryter lika utan att kunna kasta om ordningen. Vapenlängdsregeln för SR 1 går inte att uttrycka i en formel och behöver egen kod. Hör ihop med backlogposten om stridssystemet.

49. **⚠ Balansfråga: det rena utslaget mot sövande magi.** Uppkom när "det rena utslaget" infördes 2026-07-29. En tjuv med klubba kan nu slå ut en vakt i flera dygn utan spår, gratis, på ett perfekt slag. Sövande besvärjelser (SÖMN o.likn.) kostar PSY, kräver FV i skolan, och har sannolikt kortare varaktighet. **Risk:** magin blir det sämre alternativet för exakt den sak den borde vara bäst på. Att kontrollera när magikapitlets sömnbesvärjelser gås igenom — jämför varaktighet och kostnad, och överväg antingen att korta det rena utslaget eller att stärka besvärjelserna. Varaktigheten är redan en världsinställning, så justeringen är billig.

50. **Initiativ: Foundrys standardbeteende accepterat tills vidare.** Johan 2026-07-29: *"If foundry uses name/dex as default for prio if same throw, I think that's an ok mitigation for now... same thing with rerolls each round lets use default foundry until we get around to fix."* Två medvetna avvikelser från SLB s.16, båda uppskjutna: (a) **lika initiativ ska slås om mellan de inblandade** — Foundry sorterar i stället deterministiskt; (b) **turordningen ska slås om varje SR** — Foundry slår en gång per strid. Båda kräver en `Combat`-subklass (se §9.4). Praktiskt är Foundrys variant snällare mot bordet: färre slag, vilket är precis Johans invändning mot per-runda-slag.

51. ✅ **~~Ambidexteritet som "supervariant" av två vapen.~~ BESVARAT 2026-07-29 — och svaret var nej.** Johan fotograferade **RP s.27 (SVÄRDSHAND)**, som visar att ambidextriositet inte är en stridsförmåga alls utan en **rollpersonsegenskap som slås fram vid skapandet** (2T6+BP → Höger/Vänster/Dubbelhänt/Ambidextriös). ⚠ **Min formulering i går var därmed inte riktigt rätt:** jag skrev att "strid med vapen i varje hand tar bort sköldhandens −10". Boken säger i stället att sköldhanden är sämre **genomgående**, och att undantaget är **färdigheterna Två vapen och Sköld** — det är alltså färdigheten som upphäver straffet, inte det faktum att man håller två vapen. En otränad person med ett vapen i varje hand får fortfarande −10 med den aviga handen. Kvarstående arbete ligger i §2-raden om svärdshand. Ursprunglig post: Johan 2026-07-29 beslutade att **strid med vapen i varje hand tar bort sköldhandens −10 CL** (SLB s.17) — det är hela poängen med att träna Två vapen. ⚠ **Öppen fråga han själv reste:** *"Ambidextrous is like a dual weapon super ability?"* Ingen ambidexteritetsförmåga är belagd i källorna ännu; RP s.25:s "God koordinationsförmåga" ger +3 FV i Två vapen, vilket är något annat. Att leta efter i KH (Krigarens Handbok) innan handlingsekonomin byggs — se §9.5.

52. ✅ ~~**Guidesteg för svärdshand saknas.**~~ **Byggt 2026-07-29**, se §2-raden. Kvarstår bara kopplingen till CL-motorn. Ursprunglig post: `system.swordHand` finns nu med tabellen från RP s.27, men **rollpersonsguiden slår aldrig fram den** — alla nya rollpersoner blir högerhänta som default. Steget behöver: ett 2T6-slag, möjlighet att satsa BP för +1 per poäng (samma BP-pool som ras/förmågor/socialt stånd), och en genväg för den som fått dubbelhänt/ambidextriös som särskild förmåga och därför inte ska slå. ⚠ Hör ihop med backlogpost 44 (vapengrupper) och §9.5 (handlingsekonomi) — sköldhandens −10 kan inte beräknas korrekt förrän svärdshanden är känd.

53. **Bilder saknas för de 45 nya rustningsposterna.** SB s.27:s rustningstabell och s.38:s sköldtabell portades 2026-07-29 utan konst — `img` pekar på `assets/tokens/utrustning/<slug>.png` som inte finns. ⚠ Det bryter mot CLAUDE.md:s bildpipeline (steg 2b: nytt spelinnehåll får sin bild i samma arbetspass); noterat öppet i stället för tyst förbigått. ~45 ikoner: hjälmar, arm-/benskydd, harnesk, brynjor, hauberk, helrustning och 7 sköldar.

54. **Sköldar som `rustning` är fel typ på sikt.** De har `abs: 0` och bärs bara för att pareras med — SB s.38 ger dem STY-krav, BV, vikt och pris, precis som vapentabellen. Mekaniskt är en sköld ett **pareringsvapen** (SLB s.16: den köper en extra handling), inte en rustning. `vapen`-typen passar bättre; `rustning` fick nu `baseValue`/`styGroup` som en övergångslösning. Byte kräver migrering av befintliga rollpersoners utrustning.

55. ✅ ~~**Naturlig lakningstakt saknas i kallan.**~~ **LOST 2026-07-29** — Johan hanvisade till **SLB s.19-20**: **1 KP per vecka** per skadad kroppsdel vid liggande vila, **halften sa fort** annars. `REGLER_STRID.md`s platshallare ("normal takt per dag") var alltsa fel bade i skala och sida. Se §10.3d. Ursprunglig post: `REGLER_STRID.md` anger *"Total vila: Normal takt per dag (⚠ exakt varde — verifiera mot REG)"* — antalet KP per dygn ar aldrig transkriberat, bara att latt aktivitet halverar det. Maste lasas i **REG s.50-52** innan lakning kan automatiseras mot varldsklockan (§10.3d). Lakekonst ar daremot komplett: ett fardighetsslag per patient per hel vecka, lyckat slag ger dubbel lakning.

56. **Infektion, kallbrand och amputation (SLB s.20).** Fullstandig regeltext finns kurerad i §10.3d men ingen mekanik ar byggd. 1 % infektionsrisk per skadepoang (3 % for smutsiga eller djurs vapen), 5 % att en infektion ger kallbrand inom 1T4 veckor, kallbrand i huvud/mage/bal ar dodlig, infekterad kroppsdel laker inga KP, HELA E4 botar infektion men inte kallbrand. Amputation ger fyra veckors oformaga och **permanent FYS-sankning** med kroppsdelens KP. ⚠ Bygg efter tidsmodellen (§10) — utan klocka blir det handraknade veckor per sar.

57. **Ljuskällor som brinner i äventyrstid — facklor och lampolja.** ⚠ **Verifierat 2026-07-29:** v14-kärnan slutar tillämpa en utgången AE av sig själv (se §6-regeln), så **ingen modul behövs för att facklan ska sluta gälla** — *Times Up* skulle bara städa bort dokumenten och *Simple Calendar* behövs inte alls eftersom vi redan flyttar `worldTime` direkt. **Den verkliga luckan är ljuset:** AE-ändringar träffar aktörens systemdata, inte TokenDocumentets `light`, så en fackla som faktiskt lyser kräver egen kod (eller Active Token Effects) som tänder/släcker tokenljuset när effekten börjar och slutar. Ursprunglig post: Johan 2026-07-29: *"primary consumable is torches and lamp oil that needs to be tracked in adventure time."* ⚠ Till skillnad från proviant är detta **inte** dygnsskala — en fackla brinner i minuter, alltså på stridsrundeklockan (5 s per SR). Rätt form är sannolikt en **ActiveEffect med `duration.seconds`** på den tända faklan, precis som besvärjelser: då slocknar den av sig själv när klockan går, i strid såväl som vid korta framflyttningar. **Att göra:** brinntid per ljuskälla ur UTRUSTNING.md/REG, ett "tänd/släck"-läge på `utrustning`-typen, och synlig återstående tid. Proviant och vatten hanteras däremot som en **påminnelse** till SL (`DODE.supplyReminder`), eftersom böckerna inte ger någon förbrukningstakt.

16. **English localization.** Low priority per project scope.

40. **Magisk kodex som riktigt föremål.** `besvarjelse.system.hasCodex` är i dag en boolean på besvärjelsen. En kodex är i fiktionen ett fysiskt band (SB s.7: 20-30 sidor handskriven text per besvärjelse) som ska gå att **köpa, hitta i en skattkammare och bli av med**. Bör bli ett `utrustning`-föremål med en referens till vilken besvärjelse det beskriver, och magiträningsfönstret slå upp ägandet i stället för att läsa en bock. Hänger ihop med handlarna (Mirac/Lasslo) och med backlogpost 30.

41. **Utrustningstabeller ur Magi-regelboken och Spelarboken.** Johan 2026-07-29: `02-102_-_D&DE_Magi_HQJonas.pdf` **s.43-49** och `D&DE III_-_Spelarboken` **s.42-44** innehåller utrustningstabeller som ännu inte är importerade. `utrustning`-typen och `vapen-utrustning`-packet finns redan, så det är en extraherings- och porteringsuppgift, inte en modelleringsuppgift. ⚠ Följ extraktpipelinen — skriv tillbaka ett kurerat extrakt om råtexten är trasig.

42. ⭐ **UTGÅVEPRECEDENS — BESLUTAD 2026-07-29: Expertböckerna slår grundregelboken.** Johan: *"RP should win."* Uppstod kring rutstorlek men gäller generellt, och löser den återkommande frågan en gång för alla:

    **Rangordning när källor säger olika:** **RP / SB / SLB / MAG** (Expert-serien) **>** **REG** (grundregelboken) **>** kurerade `docs/wiki/`-dokument.

    ⚠ De kurerade wiki-dokumenten hamnar SIST med flit — de har visat sig fel fyra gånger på en dag (besvärjelsers ensamträning, INT-modifikationens tecken, besvärjelsetabellens dubblerade rad, "stressigt läge" som inte står i någon bok).

    **Redan avgjorda enligt den här ordningen:** magiträning (SB s.7 över det äldre Magi-häftet), initiativ (SLB 1T10+SMI över REG:s statiska SMI), sköldars tålighet (SLB:s BV-slitage över REG:s 1/20-chans), EP-strecket (RP s.63 + REG s.45 mot wiki-dokumentets "stressigt läge"). **Kvar att välja:** prisskalan (REG:s eller SB:s ~6× högre — se post 4d) och rustningstabellen (RP s.52:s korta lista mot SB s.27:s längre, som har Lamellerad och Laminerad upp till Abs 8).

    ⚠ **Rutstorleken var INGEN konflikt.** Johan misstänkte en avvikelse mellan REG och Foundry; kontrollerat och avfärdat — REG skriver *"1 ruta (1,5 m)"*, RP s.25 *"en ruta är 1,5 meter"*, SLB s.15 "rutor om 150 cm". Alla tre överens, och vårt scenrutnät (64 px = 1,5 m) stämmer. Det som faktiskt skavde var REG s.58:s **längdKOD**, som aldrig var ett rutmått.

42b. **⚠ Källförvirring: två olika Magi-böcker i filmappen.** Johan 2026-07-29: `02-102_-_D&DE_Magi_HQJonas.pdf` (äldre) säger på s.5 att man vid rollpersonsskapande lär sig besvärjelser som vanliga färdigheter, och har in-game-träning på s.37; `D&DE 0_Magi_text.txt` är det extrakt kod och dokument hittills utgått från, utan att någon avgjort vilken utgåva som gäller. Flera av dagens rättelser kommer ur just den förvirringen. **Att göra:** slå fast vilken Magi-utgåva som är kanon för systemet, dokumentera det i REGLER_README.md, och gå igenom `MAGI.md` mot den valda utgåvan. Tills dess gäller **SB s.7** för träning, eftersom den är Expert-seriens egen spelarbok.

43. **Referens­tabeller ur RP som saknas i kompendiet.** Johan 2026-07-29, tre stycken: **Färdighetstabellen** ("en gem"), **Svårighetstabellen** och **Motståndstabellen** (RP s.38). Hör hemma i `tabeller`/`regler`-packen tillsammans med backlogpost 27:s övriga tabeller.

44. **Vapenfärdigheter ska vara VAPENGRUPPER, inte enskilda vapen.** Johan 2026-07-29 (RP, kapitlet om vapenfärdigheter): det är gruppen (Svärd, Yxor, Armborst, Kastvapen …) som väljs och köps som färdighet, inte det enskilda vapnet — den fristående HTML-guiden gör fel här och listar enskilda vapentyper. ⚠ Dessutom: **Två vapen kräver att man lär sig den ANDRA vapengruppen separat**. Samma struktur gäller **stridskonster (RP s.56-57)**, som är en familj med tekniker som köps var för sig. `REGLER_FARDIGHETER.md` har redan gruppindelningen kurerad (REG s.25-28). Påverkar guidens yrkesfärdighetssteg och `DODE.primarySkills`.

45. **PSY-höjning efter äventyr (RP s.64).** Ingen mekanik finns. Efter varje avslutat äventyr slås **ett** slag om rollpersonen åstadkommit rätt sak: en **magiker** som besegrat ett offers motstånd i en kamp PSY mot PSY slår 1T20 och höjer PSY med 1 vid **(25 − nuvarande PSY)** eller lägre; en etta ger **1T3+1**. Över PSY 24 höjs den bara på en etta (+1), och två ettor i rad ger 1T3+1. För en **icke-magiker** som stått emot en magikers anfall är gränsen **(20 − nuvarande PSY)**, och över PSY 19 krävs en etta. ⚠ Kamperna måste vara verkliga, allvarliga situationer (SL:s bedömning) — boken varnar uttryckligen för spelargrupper som ägnar en vecka åt att träna PSY mot varandra. Höjningen sker gradvis under en vecka. Kräver en "efter äventyret"-knapp bredvid bonuspoängsutdelningen.

46. **Hjältedåd och hjältepoäng — eget SL-styrt fönster (RP s.64).** Johan 2026-07-29: behöver en egen guide som SL öppnar efter eller mitt i ett äventyr. **HP tjänas** enligt en dådtabell: uppnå FV 21/41/61 i någon färdighet 1T4 · vinna tornering med fler än 400 deltagare 5 · rädda prinsessa på kungens uppdrag 10 · döda fiendens härförare 10 · upptäcka ny kontinent 10 · leda belägring och erövring av fientlig borg 10 · stjäla skatt från monster utan att döda det 5-25 · döda monster 10-50 · rädda kungarike från undergång 50 · besegra annan hjälte = 10 % av dennes HP. SL får också **dra bort** HP för ohjältemodiga handlingar (överge vänner i faran, förråda, vägra duell). **HP spenderas** på tre saker: (a) **höja CL** — 1 HP före ett färdighetsslag gör fummel till vanligt misslyckande, misslyckande till lyckat, lyckat till perfekt, och ett perfekt slag ger poängen tillbaka; kan användas när som helst; (b) **skaffa särskild förmåga** — extra slag på förmågetabellen, +2 på tärningen per HP, min 1 max 40, bara mellan äventyr; (c) **förbättra grundegenskaper** — 5 HP per poäng (ej STO), obegränsat och permanent, bara mellan äventyr. ⚠ Igenkänningsrisken är [totalt insamlade HP i livet] % — hjältestatus har en baksida. `DODE.hjaltedadTable` finns redan i config.mjs men används bara vid skapandet.

39. ✅ **~~KÄLLKONFLIKT — hur tjänas äventyrs-EP egentligen in?~~** **AVGJORT 2026-07-29: sömnklockan gäller, "stressigt läge" borttaget.** Johans beslut sedan det visat sig att RP s.63 och REG s.45 säger samma sak och att stressvarianten inte står i någon bok. Se §2-raden. Historik: **UPPDATERAT 2026-07-29:** det är inte längre bok-mot-bok. **RP s.63 säger samma sak som REG s.45** — ordagrant "varje gång som en rollperson använder en färdighet framgångsrikt första gången efter en sovperiod om minst sex timmar (två timmar för alver)". Två oberoende böcker ger alltså sömnklockan, och formuleringen "i ett stressigt läge (SL bedömer)" står inte i någondera. Den kurerade `REGLER_FARDIGHETER.md` är helt enkelt fel på den punkten. ⚠ RP tillägger dessutom att kategori B **inte alls** kan förbättras genom äventyr. Kvarstår som Johans beslut eftersom koden i dag gör stressvarianten och de ger olika spelkänsla — men det är nu ett val att avvika, inte en tolkning. Ursprunglig post: Upptäckt 2026-07-29 vid läsningen av REG s.45. **Koden gör i dag** som `docs/wiki/REGLER_FARDIGHETER.md` säger: EP ges när man lyckas med en färdighet "i ett stressigt läge (SL bedömer)", vilket är varför utdelningen är en SL-knapp på slagkortet. **Boken säger något annat:** REG s.45 ger EP "varje gång en rollperson använder en färdighet framgångsrikt **första gången efter en sovperiod om minst sex timmar**" (⚠ **två timmar för älvfolk**) — en sömnklocka, precis som besvärjelser redan har, utan någon stressbedömning alls. De två reglerna ger helt olika spelkänsla: sömnklockan är automatiserbar och belönar bredd (använd många färdigheter en gång var), stressvarianten kräver ett SL-beslut per slag och belönar risk. **Ej ändrat** — CLAUDE.md säger att en konflikt mellan bok och kod ska läggas fram för Johan, inte rättas tyst. Om sömnklockan väljs kan `awardedSinceRest` generaliseras från `besvarjelse` till alla färdigheter och knappen bli automatisk. Se `DODE_Regler_TRANING_EP.md` i Roll20-projektet.

    ⚠ **Terminologirättelse 2026-07-29 (samma kväll):** Johan påpekade att "sömnklocka" är en egen abstraktion, inte bokens språk — RP:s rollformulär har bara en liten kryssruta ("streck") bredvid varje färdighet, ingen klocka. Fältet `system.ep.awardedSinceRest` döptes om till **`system.ep.ticked`**, och funktionen `clearAwardMarks` till **`clearEpTicks`**, för att matcha RP s.63:s eget ord och det fysiska formulärets faktiska mekanik.

38. ✅ **~~EP i spel — hela intjänandemekaniken saknas.~~** **Löst 2026-07-29** (se §2-raderna om EP i spel). Kvar av posten: träningens egna villkor är fortfarande SL-prosa — lärarkostnad 300 sm/vecka, INT-slag per veckas ensamträning, kodexkrav för nya besvärjelser (MAG s.23) — och taket på 10 bonuspoäng per äventyr är rådgivande, inte spärrat, eftersom systemet inte vet var ett äventyr börjar och slutar. Ursprunglig post: Johans fråga 2026-07-28: får en rollperson EP när hen lyckas med en färdighet? **Ja** — `REGLER_FARDIGHETER.md` (REG s.45-46) har regeln kurerad, och ingenting av den är byggt: varje gång man lyckas med en färdighet **i ett stressigt läge (SL bedömer)** noteras ett **streck** vid färdigheten, **1 lyckad användning = 1 EP**, **perfekt slag = 1T3+1 EP**. ⚠ EP är alltså **bundet till den enskilda färdigheten**, inte en gemensam pool. ⚠ EP kan **bara omsättas efter minst 7 dagars sammanhängande vila** — under ett äventyr sparas de. Utöver det delar SL ut **bonuspoäng** efter äventyret: 1-4 för uppdragsframgång, 1-2 för svåra gärningar, 1-4 för god rollspelning, **max 10 per äventyr**, och de är **inte** bundna till någon färdighet. Systemets `system.ep` har i dag bara `spent` (+ härledda `max`/`remaining`) för skapandet. Att bygga: streck/EP per `fardighet`-Item, en fri bonuspool på rollpersonen, viloperiodsgrinden, och en knapp på färdighetsraden för "lyckades i stressigt läge". Hänger ihop med backlogpost 37 (träningsekonomi) — tillsammans utgör de progressionen efter skapandet.

37. **Träningsekonomi för färdigheter som lärs i spel.** SL-utdelningen (§2) sätter färdigheten på BC och antecknar en anledning, men **ingen kostnad dras** — varken EP, tid eller silver. För magi finns reglerna redan kurerade i `MAGI.md` §"Lära sig magi": ensamträning 8 tim/dag 6 dagar/vecka med INT-slag för 1 EP per vecka, träning med lärare 300 sm/vecka med krav på lärarens FV/INT, och EP från framgångsrik användning under äventyr (1 EP första gången per sömnperiod, 1T3+1 vid perfekt) — plus regeln att **skolvärde bara höjs via träning, aldrig via äventyrserfarenhet**. Motsvarande allmänna färdighetsträningsregler finns INTE i de kurerade dokumenten och behöver letas upp i RP/REG innan detta byggs. Naturlig fortsättning: en dialog som drar EP och antecknar nedlagd tid/kostnad, samt EP-tilldelning vid framgångsrik användning.

36. **Särskilda förmågor med mekanisk effekt (15 av 49).** Förmågesteget slår fram namn och beskrivning som fritext; ingen förmåga gör något. 15 tabellrader ger färdighetsvärde och är den **enda** lagliga vägen till en sekundär färdighet vid rollpersonsskapandet (se 13b). Kräver tre saker: en maskinläsbar effekt per rad (`{ type: "skillBonus", skill, value }` eller `{ type: "grantSecondary", count }`), ett val-UI för "valfri sekundär/hantverksfärdighet" — samma mönster som `choiceCount` i yrkesfärdighetssteget — och stöd för de två som ändrar ekonomin snarare än ett värde (`Lättlärd` sänker sekundärkostnaden 5→4, `Stort kunskapsområde` flyttar två sekundära till yrkesnivå). Hänger ihop med backlogpost 7 (färdighetsmodifikatorsystemet), som har samma problem: en förmåga kan inte nå in i ett enskilt embeddat `fardighet`-Item via ActiveEffects.

32. **Apotekare/alkemist-handlaren "Mirac"** (Johan 2026-07-28). Ny `handlare` som Lasslo, med gifter, läkedroger och allmänna droger i lagret. **Beroende:** de 21 `droger`-posterna har i dag bara namn, tillgänglighetschans och pris — effekterna finns i Spelledarboken s.49–56 (se post 31) och bör portas FÖRST, annars säljer Mirac namn utan verkan. Både Lasslo och Mirac ska stå i Utkanten-scenen (post 33).

33. **Generisk Utkanten-by som systemscen** (Johan 2026-07-28). En by i utkanten med värdshus och apotek, **i systemet, utanför kampanjen** — "ger en grund för generiskt material" och en färdig plats att testa strider och effekter i. Klickbara ingångar till pub och apotek, med Lasslo respektive Mirac placerade. Underlag: `Äventyr/Dimön Bilder/Org_dimön_utkante.png` i Roll20-projektet (finns redan kopierad som `assets/dimon/utkante.png` i kampanjmodulen) — ska användas som **inspiration** för en egen VTT-karta, inte klippas in rakt av, eftersom Dimön är äventyrsinnehåll och scenen ska vara generisk. Kräver ett `Scene`-pack (`type: "Scene"`, ny post i `packs.config.mjs`). ⚠ Scener buntar inte media — kartbilden måste ligga i systemets `assets/`.

34. ✅ **Rollpersonsskapar-scen med egen bakgrund och ambient musik — byggd och liveverifierad 2026-07-30.** Scenen **"Rollpersonsguiden"** finns nu i `dode-test`-världen: 1920×1080 (Foundrys 16:9-standardformat), rutnätslös, tom marmorgolv-och-molnbakgrund med öppet utrymme i mitten (`assets/backgrounds/rollpersonsguiden.png`, genererad och beskuren från Gemini-verktygets fasta 1024×1024-utdata — se bildpipelinenoten nedan), kopplad till en `Playlist` med spåret `assets/audio/the-iron-crown.mp3` (Suno, gratisnivå, icke-kommersiellt — attribution krävd och tillagd i README.md). Liveverifierat: bakgrunden renderar korrekt i full 1920×1080, `scene.activate()` sätter `playlist.playing`/`sound.playing` till `true` (det enda som hindrar faktiskt ljud i en Playwright-session är webbläsarens ljudlås innan en riktig användarklick skett — inget systemfel).

    ⚠ **Byggandet avslöjade en Foundry v14-specifik fälla** — `Scene#background` är numera en läs-kompatibilitetsgetter, inte ett skrivbart fält; nya scener måste sätta bakgrunden via den embeddade `levels`-samlingen i stället. Se ny §6-regel.

    ⚠ **Bildpipelinen höll inte löftet om 16:9** — Gemini-verktyget ignorerade aspect-ratio-instruktioner i prompten och gav 1024×1024 två gånger i rad (samma beteende som sågs för `scener`-packet 2026-07-29). Löst med centrerad beskärning + LANCZOS-uppskalning till 1920×1080 i efterhand snarare än fler bortkastade genereringsförsök.

    ⚠ **Inte byggt än:** ingen kod kopplar guidens öppning till att faktiskt visa scenen för just den spelaren. Just nu är scenen och guide-fönstret två separata saker som råkar dela tema — att växla en enskild spelares vy till den här scenen när de öppnar `game.dode.openCharacterWizard()`, och växla tillbaka när guiden stängs, är nästa steg (kopplar an till "kan spelare vara i olika scener?"-frågan från 2026-07-28, samma bakgrund som denna post kom ur).

    ✅ **Och ja, spelare kan vara i olika scener samtidigt** (Johans följdfråga: en rollperson dör och spelaren ska skapa en ny mitt i äventyret). Verifierat i `client/documents/scene.mjs`: `Scene#view()` byter scen **bara för den egna klienten**, `Scene#activate({pullUsers})` sätter världens aktiva scen och drar valfritt med sig alla, och socket-eventet `pullToScene(sceneId, userId)` skickar **en enskild användare** till en scen. `user.viewedScene` spåras per användare. SL kan alltså skicka den drabbade spelaren till skaparscenen medan resten fortsätter äventyret.

35. **Resterande innehåll ur Spelledarboken** — se post 31 för hela utvärderingen. Prioriterat: (a) ~45 varelser s.23–47 till `monster` (vi har 14), (b) vapen/rustning s.32–34 efter schemabeslut om `bv`/`styKrav`, (c) Motståndstabellen till `regler`, (d) gift-/drogeffekter s.49–56 (blockerar post 32), (e) fummel- och träffområdestabellerna ur **Spelarboken** till `tabeller`.
31. **Utvärdering: Spelledarbokens tabeller (2026-07-28, på Johans begäran).** Genomgången gjordes mot **PDF-sidorna** (`D&DE II_-_Spelledarboken_HQJonas.pdf`, 66 sidor, **sidoffset +1** — tryckt sida N = fysisk N+1), inte mot textextraktet, som är svårt sammanslaget (`SLavgörasjälv,kanskegenom`). Bokens egen innehållsförteckning pekar ut ett samlat **TABELLER-avsnitt på tryckta s.31–34**.

    ⚠ **Huvudslutsatsen är att avsnittet till största delen INTE är SL-tabeller.** Det är fyra olika sorters innehåll, och bara en liten del hör hemma i `sl-regler`/`sl-tabeller`:

    **A. Föremålsdata förklädd till tabeller — den överlägset största vinsten.** Det här är inte tabeller att slå på utan vapen- och rustningskataloger, och de är **betydligt större än vad vi har**:

    | Tabell | Sida | Poster | Vi har i dag |
    |---|---|---|---|
    | Närstridsvapen | 33 | ~40 | 18 `vapen` totalt |
    | Projektilvapen | 32 | 10 | (ingår i de 18) |
    | Kastvapen | 32 | 3 | (ingår i de 18) |
    | Obeväpnade stridskonster | 32 | 7 | 0 |
    | Rustningstabell (per kroppsdel) | 34 | ~40 | 15 `rustning` totalt |
    | Hela rustningar | 33 | 9 | (ingår i de 15) |
    | Sköldtabell | 33 | 9 | (ingår i de 15) |

    Bokens tabeller har dessutom fält vi saknar helt: **BV (brytvärde)**, **STY-krav**, **längd** och **kroppsdel** per rustningsdel. Det här stänger backlogpost 14:s "vapen ~50%" på ett svep — men kräver först ett schemabeslut om `vapen`/`rustning` ska få `bv`/`styKrav`, och en avstämning mot de 33 föremål som redan finns (Magi-regelbokens lista) så att inget dubbleras.

    **B. Uppslagstabeller → `regler` (JournalEntry) — och de flesta är SPELARVÄNDA, inte SL-only.** Motståndstabellen är en kärnmekanik spelarna slår mot hela tiden; den hör inte hemma bakom SL-lås.

    - **Motståndstabellen** (s.34) — 21×21-rutnät, SG × grundegenskapsvärde → målvärde, plus `Problem→SG` (Mycket lätt 1 · Lätt 5 · Normalt 10 · Svårt 15 · Mycket svårt 20 · Extremt svårt 25). Klart störst pedagogiskt värde av allt i avsnittet.
    - **Kroppspoängstabell** (s.32) — träffområde × totala KP → KP per kroppsdel.
    - **Rustningsvikter** (s.33) — STO+STY+FYS → viktmodifikation −70% … +50%.
    - **Laddningstider** (s.32) — stavslunga 1 SR, lätt armborst 3, tungt 6, arbalest 12.
    - **Stridsdiagram** (s.31) — flödesschema över anfall→parering→skada. Blir bäst som en journalsida med bilden, inte som text.

    **C. ✅ LÖST 2026-07-28 — det var ingen editionskonflikt, koden var helt enkelt fel.** Johans hypotes var att gamla `D&DE_Regler` och nya Spelarboken/Spelledarboken kunde stå i konflikt. Det gick att testa: koden citerade **RP s.25**, och Rollpersonens eget register listar "Skadebonus 25". **Rollpersonen s.25 lästes ur PDF:en och visade sig innehålla EXAKT samma två tabeller som Spelledarboken s.32** — samma brytpunkter, samma formler, samma rasmodifikationer. Det finns alltså ingen konflikt mellan böckerna; båda säger samma sak, och det var `config.mjs` som avvek från båda. De gamla värdena bar redan en egen `⚠ bör verifieras mot original`-flagga och var fria extrapolationer som aldrig stått i någon bok. **Rättat i tre steg:**

    | Vad | Före | Efter (RP s.25 / SL s.32) |
    |---|---|---|
    | `damageBonusTable` | ≤12 −1T4 · ≤16 +0 · ≤24 +1T4 · ≤32 +1T6 · ≤40 +2T4 · ≤48 +2T6 · +3T6 | 1–26 +0 · 27–29 +1 · 30–32 +1T2 · 33–40 +1T4 · 41–50 +1T6 · 51–60 +1T10 · 61–80 +2T6 · 81–100 +3T6 · 101–140 +4T6 · 141–180 +5T6 |
    | Förflyttningsformel | `(SMI+FYS+STO)/3` → tabell | **summan** STO+FYS+SMI → tabell |
    | `movementTable` | ≤4→5 … ≤24→15 | 0–11→7 … 84–92→16, därefter +1 per ytterligare +8 |
    | Rasmod förflyttning | fanns inte | Anka −2 · Alv +1 · Dvärg −2 · Halvlängdsman −2 (nytt `movementMod`-fält på `ras`, satt explicit i `_source` med namnfallback som skydd) |

    ⚠ **Detta ÄNDRAR befintliga rollpersoner.** En rollperson med 12/12/12 gick från 9 till 10 rutors förflyttning, och STY+STO 24 gick från +1T4 skadebonus till ingen alls. Det är en rättning mot boken, inte ett balansbeslut — men värt att nämna för spelare med befintliga rollpersoner. Liveverifierat: Människa 36→10, Dvärg 38→8, Alv 39→12, Anka 34→8; SB 24→+0, 27→+1.

    **Lärdomen är generell:** när två källor verkar krocka, kontrollera först om koden faktiskt matchar NÅGON av dem. Här matchade den ingen, och "vilken bok gäller?" var därför fel fråga från början.

    **C-arkiv (ursprunglig formulering): ⚠ TVÅ TABELLER KROCKAR MED REDAN IMPLEMENTERAD KOD — porta dem INTE rakt av.**

    | Bokens tabell (SL s.32) | Vår kod | Krock |
    |---|---|---|
    | **Skadebonus** STY+STO: 1–26 ingen · 27–29 +1 · 30–32 +1T2 · 33–40 +1T4 · 41–50 +1T6 · 51–60 +1T10 · 61–80 +2T6 · 81–100 +3T6 · 101–140 +4T6 · 141–180 +5T6 | `DODE.damageBonusTable`: ≤12 −1T4 · ≤16 +0 · ≤24 +1T4 · ≤32 +1T6 · ≤40 +2T4 · ≤48 +2T6 · däröver +3T6 | Helt olika brytpunkter OCH formler. Koden har ett **−1T4-straff** som boken saknar; boken har **+1T2/+1T10** som koden saknar och sträcker sig till 180 (jättar). |
    | **Förflyttning** STO+FYS+SMI (summa): 0–11→7 … 84–92→16, +8→+1, med rasmod (Anka −2, Alv +1, Dvärg −2, Halvlängdsman −2) | `DODE.movementTable`: (SMI+FYS+STO)/3 (medel) → 4→5 … 24→15 | Summa mot medelvärde, olika skalor. Ex. medel 4: koden ger 5 rutor, boken 8. |

    Båda kodtabellerna bär redan en `⚠ bör verifieras`-flagga och är källhänvisade till **RP (Rollpersonen)** — grundreglerna — medan Spelledarboken beskriver det **detaljerade** stridssystemet (bokens eget avsnitt heter "Vanlig och detaljerad strid", s.15). Det här är alltså med all sannolikhet två avsedda regelnivåer, inte ett fel — precis det "medvetet modulära blandsystem" `REGLER_README.md` beskriver. **Att byta tabell tyst skulle ändra skadebonus och förflyttning för varje befintlig rollperson.** Kräver ett regelbeslut från Johan: kör vi grundreglernas eller den detaljerade bokens tabeller, eller ska nivån bli en `game.settings`-inställning (backlog 5)?

    **D. De faktiska tärningstabellerna ligger i en ANNAN bok.** Bokens korsregister (s.60–61) skriver `Fummeltabeller III-39`, `Träffområdestabell III-23`, `Rustningstabell III-37` — romerska **III = Spelarboken**. Bekräftat: `FUMMELTABELL` ger 4 träffar i Spelarbokens extrakt och 0 i Spelledarbokens. **De bästa RollTable-kandidaterna (fummel vid anfall/parering, träffområde) finns alltså inte i den här boken** utan i `D&DE III_-_Spelarboken`. Det är dit man ska gå för att fylla `tabeller`-packet vidare.

    **Vad boken DÄREMOT har som är stort och SL-relevant** (utanför TABELLER-avsnittet):

    - **VARELSER, s.23–47** — ~45 varelser med fullständiga statblock (djur: björnar, fladdermus, hov-/hund-/kattdjur, orm, skorpion, spindel, jättebläckfisk; legendariska: Demon, Enhörning, Harpya, Hydra, Jätte, Jättespindel, Kentaur, Mantikora, Minotaur, Mumie, Orch, Pegas, Reptilman, Rese, Sfinx, Skelett, Spöke, Svartalf, Troll, Vätte, Zombie). Vi har **14** monster. Statblocken har samma form som Dvärgs på s.35 (Hemvist, Vanlighet, Antal, grundegenskapsformler, KP, färdighets-FV, naturligt skydd) — direkt portabelt till `npc`-aktörer. **Detta är den enskilt största innehållsvinsten i boken.**
    - **ÖRTER OCH VÄXTER + gifter och droger, s.49–56** — effekter och beskrivningar för läkedroger, allmänna droger och gifter. Kopplar direkt till de **21 `droger`-poster** vi redan har från Magi-regelboken, som i dag bara har namn, tillgänglighetschans och pris men **ingen effekt**.
    - **Skador och läkning, s.18–22** — infektioner, amputation, läkning, stridsmoral, skada av fall/vatten/eld. Journalmaterial, och delvis mekanik som inte är byggd.

    **Rekommenderad ordning** (störst nytta först): (1) varelserna s.23–47 till `monster`, (2) vapen/rustning s.32–34 till `vapen-utrustning` efter schemabeslut om `bv`/`styKrav`, (3) Motståndstabellen + kroppspoäng/rustningsvikter till `regler`, (4) gift-/drogeffekterna s.49–56 på de befintliga drogposterna, (5) fummel-/träffområdestabellerna från **Spelarboken** till `tabeller`. Punkt C behöver ett regelbeslut innan något rörs.

    ⚠ **`sl-tabeller` blir fortfarande inte aktuellt av detta.** Ingenting i Spelledarbokens tabellavsnitt är en SL-hemlig tärningstabell — det närmaste är värdshusgenereringen som redan ligger i `sl-regler`. Packet skapas när första påhitts- eller lootabellen finns, precis som §8.6 sa.

30. **Räknat lager + återköp hos handlare.** Butiken är i dag en katalog: köp drar bara från köparens börs, handlarens lager är oändligt (se §2-raden för varför — `socket: false` plus att spelare inte äger handlaraktören). Två saker saknas: (a) **räknat lager**, som kräver ett socket-relä där spelarens köp skickas till SL:s klient som utför avdraget på handlaren, och (b) **återköp** — `system.buybackRate` finns på handlaren (default 50% av katalogpris) men är rent informativ, inget UI säljer tillbaka. Båda är samma mekanism: en skrivning mot ett dokument spelaren inte äger. Bygg dem tillsammans och sätt `"socket": true` i `system.json` när det görs.

29. **Äventyrsinnehåll och SL-katalogen behöver en struktur (Johan, 2026-07-28).** "Items från framtida äventyr kommer förvirra SL och spelare." Berättigat — i dag är allt innehåll platt i systemets packs, och när Dimön följs av tio äventyr till hamnar deras föremål, NPC:er och scener i samma listor som grundutrustningen. Två Foundry-mekanismer är gjorda för precis det här och används inte ännu:

    **(a) `Adventure`-dokumentet är den kanoniska lösningen.** Foundry har en egen dokumenttyp som buntar scener, aktörer, föremål, journaler, RollTables, makron och spellistor till ETT paket som SL importerar när äventyret ska spelas — och som inte syns i världen innan dess. Det är exakt Foundrys egen "best practice" för äventyrsmaterial, och rätt hem för Dimöns innehåll: ett `Adventure`-dokument i **kampanjmodulens** eget pack (`de-brutna-sigillens-kronika`), inte i systemets. Systemet ska bara innehålla det som gäller *alla* kampanjer (grundregelböckernas utrustning, besvärjelser, raser, yrken, monster). Det håller isär "regelverk" och "äventyr" — samma gräns §7.1 redan drar mellan system och modul.

    **(b) Mappar inuti kompendier.** Foundry stödjer folders i packs, så även systemets egna packs kan struktureras (`vapen-utrustning` har nu 304 poster i en enda platt lista — värt att dela i Vapen / Rustning / Verktyg / Kläder /… med samma kategorier som `DODE.equipmentCategories`). Mappar är `Folder`-dokument i `_source/` med `type: "Item"` och `folder`-fältet satt på posterna.

    **Utrett och designat i §8 (förslag, 2026-07-28)** tillsammans med backlog 27, eftersom båda är samma paketstrukturbeslut. Se §8.1 för vad Foundry faktiskt stöder (verifierat mot v14-källan och dnd5e), §8.2 för tre fällor — bl.a. att `packFolders` bara gäller vid en världs FÖRSTA laddning — och §8.5 för arbetsordning.

28. **Mithrilmynt (och andra valörer utöver km/sm/gm).** Johan (2026-07-28) minns en kampanj med ett mithrilmynt värt ~500 gm. **Inte belagt i någon D&DE-källa jag hittat** — sannolikt en kampanj- eller modulspecifik valör, inte kärnregler, så den är medvetet INTE tillagd i grundsystemet. Infrastrukturen finns dock: `DODE.kmToPurse`/`formatPurse`/`purseToKm` itererar `DODE.coinToSilver` i stället för att hårdkoda valörerna, så prissättning och visning av en ny valör kräver **bara en rad** (`DODE.coinToSilver.mm = 5000` för 500 gm). Verifierat: `{mm:1, gm:3, sm:2, km:5}` formateras korrekt som "1 mm 3 gm 2 sm 5 km". Ska myntet dessutom kunna **bäras som valör** krävs ett fält till i `currency`-schemat i `actor-character.mjs` plus en kolumn i arkets börsrad — och då även en migrering för befintliga rollpersoner (se backlog 3). En kampanjmodul kan registrera valören i sin `init`-hook utan att röra systemet.

    **Löst 2026-07-28 — och den bättre modellen var Johans egen:** "mithrilmynt kan vara inventarieföremål också, som ädelstenar och sånt." Just det. Ett mithrilmynt värt 500 gm är **skatt, inte växelmynt** — man värderar och säljer det, man betalar inte öl med det. Därför finns nu kategorin **`vardesaker`** på `utrustning` (ädelstenar, smycken, tackor, exotiska mynt): föremålet bär sitt värde i `price`/`priceUnit` som allt annat, syns i inventariet, kan säljas till en handlare och behöver **varken schemaändring eller migrering**. Börsen förblir de tre belagda valörerna. Vill man ändå ha en fjärde spenderbar valör står vägen ovan öppen, men för mithril och gems är föremålsvägen den rätta.

27. **Compendium to-do list — rules tables that still live only in code or in docs.** (Johan, 2026-07-28: "Skräcktabell and animate dead table should probably go into the compendium somewhere in some structure like a lot of other stuff.") Right now the only compendium packs are Item/Actor content; every *table* is either a JS array in `config.mjs` or prose in a doc, so a GM cannot roll it, link it in a journal, or show it to players. Foundry has two natural homes: **`RollTable`** for anything with a die (rollable straight from chat, `@UUID` linkable) and **`JournalEntry`** for lookup tables that are read rather than rolled. Candidates found so far, grouped by which they want:

    *RollTable:* Skräcktabell (1T20, Magi-regelboken s.25 — referenced by Rädsla/Panik/Terror, so those spells could `@UUID`-link straight to it), Snedtändningstabellen (also backlog 21), Hjältedådstabellen (also backlog 8, 13 rows 1T20), Särskilda förmågor 2T20+BP (49 rows, currently `DODE.specialAbilitiesTable`), HP-based hjälteförmågor + Mörka hjälteförmågor (35+35, see backlog 20), Värdshusets utseende och service (the 1T3/1T4/2T4 columns, s.48).

    *JournalEntry:* Animera död-gradtabellen (skelett/zombie/mumie multipliers, s.23 — referenced by the Animera död spell), Bärförmåga (s.43), Värdshuspriser + stallplats + underhållning (s.48), Effektgrader/CL-tabellen, EP-kostnader för magi, minnesgräns, the drug availability table's `Chans` column.

    All of the above are already transcribed — the Magi ones in `docs/extracts/DODE_Magi_TABELLER.md` (Roll20-projektet), the rest in `config.mjs` or `MAGI.md` — so this is packaging, not research. **Pack layout beslutad i §8 (förslag, 2026-07-28):** tre nya packs — `regler` (JournalEntry, spelare), `tabeller` (RollTable, spelare) och `sl-tabeller` (RollTable, SL). Splitten går efter *publik*, inte efter dokumenttyp, eftersom ownership sitter på pack-nivå. Se §8.3 för vilken tabell som hamnar var.

26. **⚠ Coin exchange rate is unsourced.** `CONFIG.DODE.coinToSilver` uses **1 gm = 10 sm = 100 km**, and *no source states this*. The abbreviations themselves are sourced (SL s.62's index gives `km` = kopparmynt) and `UTRUSTNING.md` says silver is the base currency, but no book found so far gives a rate. The 1:10:100 reading was chosen because it is internally consistent with Magi-regelbokens own tavern prices (s.48): a good meal at 50 km against a luxury meal at 10 sm is 2× at this rate but 20× at 1:100:10000, and a dorm bed at 3 sm against stabling a large horse at 15 km likewise. The lower multiples are the plausible ones. **Everything routes through `DODE.toSilver()`**, so correcting this is a one-line change if a source turns up — worth a look in Spelarboken or Rollpersonen's economy section.

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

### Rule: v14-karnan slutar tillampa utgangna ActiveEffects sjalv — men raderar dem inte

⚠ **Testat 2026-07-29**, foranlett av ett Gemini-rad om att installera *Times Up*.
En AE med `duration.seconds: 3600` och `startTime`, efter `game.time.advance(7200)`:

| Falt | Efter utgang |
|---|---|
| `duration.remaining` | **-3600** (karnan raknar) |
| `effect.active` | **false** ⭐ |
| `actor.appliedEffects` | **0** |
| Andringen pa aktoren | **borta** (bonus tillbaka till 0) |
| Dokumentet finns kvar | **ja** — `disabled` ar fortfarande `false` |

**Slutsats:** for var del racker karnan. En tand fackla slutar verka nar tiden gar,
utan modul. *Times Up* tillfor **stadning** (att faktiskt radera de utgangna
dokumenten) och extra triggers — trevligt, inte nodvandigt.

⚠ **Notera skillnaden mellan `active` och `disabled`.** En utgangen effekt har
`active: false` men `disabled: false`. Kod som filtrerar pa `disabled` for att
avgora om en effekt galler **far fel svar** — filtrera pa `active` eller anvand
`actor.appliedEffects`.

⚠ **Det Gemini-radet missar:** en AE kan inte andra en tokens ljusutstralning.
AE-andringar traffar aktorens systemdata, medan ljus bor pa TokenDocument. En
fackla som faktiskt LYSER kraver antingen *Active Token Effects* eller egen kod som
slar pa/av tokenljuset nar effekten borjar och slutar. Se backlogpost 57.

### Rule: Scene#background is deprecated — Foundry v14 moved to a `levels`-collection, and writing the old field name silently does nothing on NEW scenes

⚠ **Upptäckt 2026-07-30**, byggandet av rollpersonsguidens scen. `Scene.create({ background: { src } })` skapade ett dokument där `background.src` var **`null`**, trots att alla andra fält i objektet (tint, anchorX, fit, …) fanns med sina defaultvärden — inget felmeddelande, inget kastat undantag.

Orsaken: i den installerade Foundry-versionen (v14 build 365) har `Scene` fått ett **`levels`**-fält (en `EmbeddedCollectionField` av "Level"-dokument, vart och ett med egen `background`/`foreground`/`fog`/`textures`), och det gamla toppnivåfältet `background` är kvar bara som en **läs-kompatibilitetsgetter** — konsolen loggar uttryckligen *"Scene#background is deprecated. Use Level#background and Level#textures instead."* när man LÄSER det. Getter fungerar för **befintliga** scener (som redan har ett riktigt `_source.background.src` från när de packades under en äldre modell), men vid **skapande av en ny scen** initieras i stället en `levels`-array med ett `defaultLevel0000`-element vars `background.src` är `null` — och att skriva till det gamla fältnamnet, vare sig vid `Scene.create()` eller via `scene.update({"background.src": ...})` i efterhand, går rakt förbi utan att röra `levels[0]`.

**Rätt sätt att sätta en ny scens bakgrund i den här Foundry-versionen:**

```js
const scene = await Scene.create({ name, width, height, grid: {...}, /* INTE background här */ });
const levelId = scene._source.levels[0]._id;   // "defaultLevel0000"
await scene.updateEmbeddedDocuments("Level", [{
  _id: levelId,
  "background.src": "systems/.../din-bild.png",
  "background.color": "#c9c4bb"
}]);
// Den gamla gettern `scene.background.src` läser nu rätt värde igen.
```

⚠ **Kontrollera alltid `Scene.schema.fields` i den faktiskt installerade versionen** innan man antar ett fältnamn — se den allmänna metodiken i "General methodology for is this Foundry behavior actually what I think it is?" ovan. `packs/scener/_source/*.json` (Utkanten, Värdshuset) är opåverkade eftersom de redan var packade med det gamla flata `background`-fältet innan denna upptäckt; **nya scen-JSON-filer som skrivs för hand i framtiden behöver `levels`-formen** för att renderas korrekt i den här Foundry-versionen.

### Rule: document IDs must be EXACTLY 16 alphanumeric characters

⚠ **Snubblat på två gånger** (embeddade `_key`-former 2026-07-28, scen-`_id` 2026-07-29).
Foundry accepterar `_id` som är kortare eller längre utan att klaga vid packning —
`fvtt package pack` rapporterar "Packed" som vanligt — men dokumentet kommer
tillbaka **med `id: null` och alla fält tomma** när det läses.

```js
"dodeVardshus01"    // 14 tecken → tyst trasigt
"dodeUtkanten01x"   // 15 tecken → tyst trasigt
"dodeVardshusUtk1"  // 16 tecken → fungerar
```

⚠ **Symptomet ser ut som något annat.** En scen med ogiltigt `_id` visar
`background.src === null`, vilket läses som en trasig bildsökväg — man letar i
`assets/` i stället för på nyckeln. Samma sak för items: tomma `system`-fält
ser ut som ett schemafel.

**Kontrollera alltid `_id.length === 16` innan packning.** För embeddade dokument
gäller det både förälderns och barnets id i `_key`:

| Embeddat | Nyckelform |
|---|---|
| Items på en aktör | `!actors.items!<actorId>.<itemId>` |
| Resultat i en RollTable | `!tables.results!<tableId>.<resultId>` |
| Sidor i en JournalEntry | `!journal.pages!<journalId>.<pageId>` |
| Mappar | `!folders!<id>` |

`foundry.utils.randomID()` ger rätt längd; handskrivna läsbara id:n gör det sällan.

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

---

## 8. Pack Layout, Folders & Adventure Structure — design proposal (2026-07-28)

> **Status: STEG 1-3 IMPLEMENTERADE 2026-07-28 och liveverifierade** (steg 4 hör hemma i kampanjmodulens eget repo). Se §8.6 för utfall och den enda avvikelsen från förslaget. Ursprungligen skriven som:
>
> **PROPOSAL, not implemented.** Written on Johan's request to settle backlog 27 (rules tables into compendiums) and 29 (folders + adventure structure) together, since both are the same decision about package structure. Every capability below was verified against the **installed Foundry v14 source** and against **dnd5e as a shipped reference implementation** — not recalled from training data.

### 8.1 What Foundry actually gives us (verified, not assumed)

| Mechanism | Verified how | What it does |
|---|---|---|
| **One document type per pack** | `common/packages/base-package.mjs` — a pack's `type` is a single `StringField` constrained to `CONST.COMPENDIUM_DOCUMENT_TYPES` | RollTables and JournalEntries **cannot** share a pack with Items. New content types force new packs. Not a style choice — a schema constraint. |
| **`packFolders`** in the manifest | `base-package.mjs`: `packFolders: new fields.SetField(new PackageCompendiumFolder())`, where `PackageCompendiumFolder = {name, sorting, color, packs, folders}` nesting to **depth 4** | Groups *packs* into folders in the compendium sidebar. dnd5e ships two top-level folders ("D&D Modern Content", "D&D Legacy Content") with nested sub-folders inside. |
| **Folders *inside* a pack** | Read out of dnd5e's compiled `spells` pack: 10 `!folders!` keys alongside 319 `!items!` keys | A pack can carry `Folder` documents; each entry joins one via its `folder` field. dnd5e organises 319 spells by spell level this way. |
| **`Adventure` document** | `common/documents/adventure.mjs` — sets of `actors, combats, items, journal, scenes, tables, macros, cards, playlists`, **plus its own `folders` set** | The canonical bundle for adventure content. The GM double-clicks it inside a pack and gets an import dialog; folder structure is preserved on import. |

**Folder document shape** — taken from dnd5e, so this is a working example rather than a guess:

```json
{ "name": "6th Level", "type": "Item", "_id": "0pdesvXqKd55VOh2",
  "folder": null, "sorting": "a", "sort": 700000, "color": "#58366f",
  "flags": {}, "_stats": { } }
```

LevelDB key is `!folders!<id>`, and an entry joins it with `"folder": "<folderId>"`. In `_source/` that means one extra JSON file per folder — the same `_key` discipline that bit us with the merchant's embedded items (§2).

### 8.2 Three gotchas that shape the design

1. ⚠ **`packFolders` applies only on a world's FIRST load.** Foundry's own documentation: it generates the folders on first load, "and updates to this will NOT affect existing worlds." The sidebar layout therefore has to be right *before* the system is distributed — later changes silently do nothing for anyone who already has a world. This is the strongest argument for settling the layout now rather than after a release.
2. ⚠ **Adventure re-import overwrites by ID.** "Documents keep their unique IDs, so when they are imported later they will overwrite any existing copies with the same ID." Excellent for shipping fixes, dangerous for a GM who has customised an NPC — a re-import clobbers their edits. Must be called out in the campaign module's README.
3. ⚠ **Adventures do not bundle media.** Images and audio stay as paths into the package folder, so adventure art has to live in the *module's* folder, exactly as system art lives in the system's.

### 8.3 Proposed layout

**Principle 1 — audience is the primary split, because ownership is pack-level.** §7 already establishes this and nothing here changes it: a pack is the smallest unit that can be hidden from players, so anything GM-only needs its own pack even when its document type matches a player-facing one.

**Principle 2 — folders inside packs, not more packs.** dnd5e keeps 319 spells in one foldered pack. Our `vapen-utrustning` (304) and `besvarjelser` (191) are the same order of magnitude, so they stay single packs and gain folders. Splitting them would churn `DODE.contentPacks`, every `_source` path, and the wizard/merchant resolvers for no browsing benefit.

**Principle 3 — the system holds only what every campaign shares.** Adventure content never enters the system, regardless of how generally useful it looks.

#### System packs (6 player-facing, 4 GM-only)

| Pack | Type | Audience | In-pack folders |
|---|---|---|---|
| `raser` | Item | player | Grundraser · Alvsläkten |
| `yrken` | Item | player | Grundyrken · Krigar- · Tjuv- · Lönnmördar- · Bardspecialiseringar |
| `vapen-utrustning` | Item | player | Vapen · Rustning + the 13 `DODE.equipmentCategories` |
| `besvarjelser` | Item | player | one per magic school (13) |
| **`regler`** *(new)* | JournalEntry | player | Grundregler · Magi · Utrustning |
| **`tabeller`** *(new)* | RollTable | player | — |
| `magiska-foremal` | Item | **GM** | — |
| `monster` | Actor | **GM** | by type/habitat once it grows past ~30 |
| `handlare` | Actor | **GM** | — |
| **`sl-tabeller`** *(new)* | RollTable | **GM** | — |

Backlog 27's tables land like this. Note the split is by *audience*, which is exactly why one RollTable pack is not enough:

- **`tabeller`** (player-rollable): Skräcktabell — Rädsla/Panik/Terror can then `@UUID`-link straight to it — plus Snedtändningstabellen, Särskilda förmågor (2T20+BP), Hjältedådstabellen, HP-based hjälteförmågor.
- **`sl-tabeller`** (GM-only): Värdshusets utseende och service, and future encounter/loot tables — things that spoil a surprise if a player can roll them.
- **`regler`** (JournalEntry — read, not rolled): Bärförmåga, Animera död-gradtabellen, Värdshuspriser/stallplats/underhållning, Effektgrader & CL, EP-kostnader för magi, minnesgräns, drogtillgänglighet.

#### `packFolders` for the sidebar

```jsonc
"packFolders": [
  { "name": "Rollpersoner",      "sorting": "m", "color": "#6b4a2f",
    "packs": ["raser", "yrken"] },
  { "name": "Utrustning & magi", "sorting": "m", "color": "#7a5c3a",
    "packs": ["vapen-utrustning", "besvarjelser"] },
  { "name": "Regler & tabeller", "sorting": "m", "color": "#4a5c6b",
    "packs": ["regler", "tabeller"] },
  { "name": "Spelledare",        "sorting": "m", "color": "#5c2f2f",
    "packs": ["magiska-foremal", "monster", "handlare", "sl-tabeller"] }
]
```

The "Spelledare" folder is cosmetic grouping only — the real hiding is the per-pack `ownership` from §7. Both are wanted: ownership for access control, the folder so a GM's sidebar reads clearly.

#### Adventures — in the campaign module, never in the system

Dimön and every future adventure becomes **one `Adventure` document** in the campaign module's own `Adventure`-type pack, holding that adventure's scenes, NPCs, items, journals and tables. It stays invisible until the GM imports it, which directly answers the concern that "items from future adventures will confuse GM and players" — an unimported adventure contributes nothing to any sidebar.

```
de-brutna-sigillens-kronika/
  packs/aventyr/            <- type: "Adventure", GM-only ownership
    _source/dimon.json      <- scenes + actors + items + journal + tables
  assets/dimon/             <- media MUST live here (adventures do not bundle it)
```

Rule to carry forward: **if content is only meaningful inside one adventure, it belongs to that adventure, not to the system.** A tavern that appears only in Dimön is adventure content; the generic `Lasslo Värdshusvärden` that a GM copies for any inn is system content. That is the same line §7.1 already draws between system and module.

### 8.4 On copying dnd5e as a reference (Johan's question, 2026-07-28)

Checked rather than assumed: `Data/systems/dnd5e/LICENSE.txt` is the **MIT licence** verbatim, "Copyright 2021 Andrew Clayton" — permission to use, copy, modify, merge, publish, distribute, sublicense and sell, on the single condition that the copyright and permission notice travel with copies or substantial portions. Our own `system.json` already declares `"license": "MIT"`, so the licences are compatible.

Three distinctions worth keeping straight:

- **Reading it for structure and conventions carries no obligation at all.** API shapes, manifest fields and folder conventions are functional interfaces, not creative expression — and `packFolders`, `Folder` documents and `Adventure` are *Foundry core* features that dnd5e merely uses, as we now do.
- **Copying literal dnd5e code** is permitted by MIT but triggers the attribution condition: ship the notice alongside it. Worth avoiding casually, not because it is risky but because their code is shaped by D&D 5e mechanics we do not share.
- ⚠ **"We have a Foundry licence so it must be fine" is not the reason it is fine.** A Foundry licence grants use of Foundry, not rights over third-party packages — those come from each package's own licence. Here dnd5e's MIT is what makes it fine. The distinction matters for any package that turns out to be more restrictively licensed.

⚠ Also note that dnd5e's *game content* (SRD text in its packs) sits under separate terms (OGL/Creative Commons), not MIT. Irrelevant to us — we ship Swedish DoD content — but do not assume a package's code licence covers its content.

**On module compatibility, Johan's instinct is right but the mechanism is worth being precise about.** What makes third-party modules work is conformance to **Foundry core** APIs and document types, not resemblance to dnd5e. A module that manipulates RollTables, JournalEntries, Folders or Adventures works with us if we use those core documents — which is precisely what §8.3 proposes. Modules that reach into `actor.system.abilities.str.mod` are dnd5e-specific and will not work regardless of how we structure packs, because our data model is DoD's. So: adopt core documents and standard conventions (that is the real compatibility win, and it is free), but do not contort the data model toward 5e in the hope of inheriting its module ecosystem — see also §7.6 on what dnd5e and PF2e each had to invent.

### 8.5 Suggested order of work

1. `packFolders` in `system.json` — **first**, because it is inert for existing worlds (gotcha 1); the sooner it lands, the fewer worlds miss it.
2. In-pack folders for the four large Item packs: folder `_source` files plus a `folder` field on each entry, via the same script pattern as the existing `port_*.py` runs.
3. New `regler`, `tabeller` and `sl-tabeller` packs, then port backlog 27's content — all of it is already transcribed, so this is packaging rather than research.
4. Campaign module: `Adventure` pack, move Dimön's content in, and document the overwrite-on-reimport hazard in its README.

Steps 1–2 touch no game logic. Step 3 needs `RollTable`/`JournalEntry` handling in `packs.config.mjs`. Step 4 happens in the module's own repo.


### 8.6 Utfall — implementerat 2026-07-28

**Steg 1–3 klara och liveverifierade.** Steg 4 (Dimön som `Adventure`) hör hemma i kampanjmodulens repo; noterat att `dode-test`-världen redan har temporära världspacks `dimon-actors` och `dimon-adventure`, vilket är precis det material som ska flyttas dit.

| Vad | Utfall |
|---|---|
| `packFolders` | 4 mappar i sidopanelen. **Verifierat i en NYSKAPAD värld** — det är enda sättet att testa, eftersom de bara genereras vid en världs första laddning. Alla 10 packs hamnade i rätt mapp med rätt färg, 0 utanför. Testvärlden raderades efteråt. |
| Mappar i packs | `raser` 2 · `yrken` 5 · `vapen-utrustning` 14 · `besvarjelser` 12 mappar. **Samtliga 544 poster placerade, 0 föräldralösa.** |
| Nya packs | `regler` (3 journaler), `tabeller` (3 RollTables), `sl-regler` (1 journal). |
| RollTables | Skräcktabell 1T20 (9 rader), Hjältedåd 1T20 (13), Särskilda förmågor 2T20 (49). Slagning verifierad: 8→Flykt, 19→Hysteri, 11→Flykt. `@UUID`-länkbar. |

**⚠ Avvikelse från §8.3: `sl-tabeller` byggdes inte.** Det skulle ha blivit ett tomt pack — vi har inga SL-*slagbara* tabeller ännu (Värdshusets utseende är en uppslagstabell, inte en tärningstabell). Den hamnade i stället i `sl-regler` (JournalEntry, SL). Skapa `sl-tabeller` när första påhitts-/lootabellen finns; publikprincipen i §8.3 gäller fortfarande.

**⚠ Två upptäckter om `_key` för embeddade dokument.** Samma fälla som handlarens föremål, nu bekräftad för alla tre typerna — `fvtt package pack` failar med "Key cannot be null or undefined" utan dem:

| Embeddat | Nyckelform |
|---|---|
| Items på en aktör | `!actors.items!<actorId>.<itemId>` |
| Resultat i en RollTable | `!tables.results!<tableId>.<resultId>` |
| Sidor i en JournalEntry | `!journal.pages!<journalId>.<pageId>` |

Mappdokument använder `!folders!<id>` och posterna pekar på dem via sitt `folder`-fält. Alla former lästes ur dnd5e:s kompilerade packs, inte gissade.

**Kvar av backlog 27:** Snedtändningstabellen (ingen data i `config.mjs` ännu, se backlog 21) och de rent härledda tabellerna (socialt stånd, startkapital, grupp/skadebonus/förflyttning) som redan är automatiserade i koden och inte behöver journaler.

---

## 9. Stridssystemets arkitektur - designforslag (2026-07-29)

Johans fraga: *"check our complete battle system flow architecture and how we
build it to the desktop. How did d&d5 do it?"* Last ur **den faktiskt installerade
dnd5e 5.3.3** (`Data/systems/dnd5e/dnd5e.mjs`), inte ur minnet.

### 9.1 Vad dnd5e faktiskt gor

| Monster | Vad det ar | Kopiera? |
|---|---|---|
| **`RollProcessConfiguration`-trippeln** | Varje slag gar genom `(rollConfig, dialogConfig, messageConfig)` - *vad* som slas, *om anvandaren ska tillfragas*, *hur det rapporteras*. Forekommer **54 ganger** i koden. | ⭐ **Ja.** Enskilt viktigaste iden, och loser Johans punkt 3 direkt. |
| **`parts.push()` + `situational`** | Modifikationer samlas som en array formeldelar; dialogen har ett fritt situational-falt; aktorens `globalBonuses` vavs in. | ⭐ **Ja**, men se ⚠ om multiplikatorer nedan. |
| **pre/post-hooks per slagtyp** | `dnd5e.preRollAttack` / `postRollAttack`, `preConfigureInitiative` m.fl. | ⭐ **Ja.** Gor systemet modulvanligt utan monkey-patchning. |
| **Egna Roll-subklasser** | `D20Roll extends BasicRoll`, `DamageRoll extends BasicRoll` - slaget bar sin egen semantik (`isCritical`, `isFumble`). | **Ja, i liten form.** Var motsvarighet bar perfekt/lyckat/misslyckat/fummel. |
| **`Combat5e` / `Combatant5e`** via `CONFIG.Combat.documentClass` | Dokumentsubklasser for turordning och rundlogik. | ⭐ **Ja** - kravs for SLB:s omslag vid lika och for handlingsekonomin. |
| **Activity-systemet** (`AttackActivity extends ActivityMixin`) | Foremal har *aktiviteter* i stallet for inbyggda attacker. | ❌ **Nej.** Byggt for 5e:s enorma foremalsvariation. Vara `vapen` gor en sak. Overarkitektur har. |

### 9.2 Tre saker som INTE oversatts

⚠ **1. DoDE har multiplikativa modifikationer; dnd5e har bara additiva.**
`parts.push()` summerar. Men DoDE har *"CL halverad"* (KP <= 2, Smyga i
fjallpansar, parera kattingvapen) och *"CL x 1/3"* (otranad skoldhand). En ren
additiv array kan inte uttrycka det. **CL-motorn behover tva faser:** forst
additiva delar, sedan ordnade multiplikatorer. ⚠ REG antyder att ordningen ar
specificerad ("...modifikation efter addition och subtraktion") - maste belaggas.

⚠ **2. Ingen AC - allt ar opponerade slag.** 5e:s attack ar ett slag mot ett
statiskt tal. Var ar **tva slag** (anfall + parering) som mots i en 9-radersmatris.
Chattkortet maste alltsa kunna **vanta pa forsvararen**, vilket 5e aldrig behover.
Det ar den storsta UI-skillnaden.

⚠ **3. Traffomraden och BV har ingen 5e-motsvarighet alls.** Ingen forlaga att
kopiera - se `rolls/attack.mjs`, redan byggt.

### 9.3 Foreslagen arkitektur

```
scripts/
  documents/
    combat.mjs        <- Combat-subklass: initiativlage, omslag vid lika (SLB s.16)
    combatant.mjs     <- handlingsekonomi per SR (SLB s.16)
  rolls/
    cl.mjs            <- CL-motorn: additiva delar + multiplikatorer
    attack.mjs        <- finns; ska ta emot en CL-konfiguration i stallet for `mods`
  apps/
    attack-dialog.mjs <- maldialog: traffomrade, avsikt, situationsmodifikationer
  helpers/
    anatomy.mjs       <- finns
```

**CL-motorns form** (Johans punkt 3), medvetet lik dnd5e:s men med tva faser:

```js
DODE.buildCl({ actor, skill, weapon, target, situation }) -> {
  base: 18,
  parts: [ {label:"Anfall bakifran", value:+7, source:"situation"},
           {label:"Riktat mot huvud", value:-5, source:"aim"},
           {label:"Valsignelse", value:+2, source:"effect"} ],
  multipliers: [ {label:"KP <= 2", factor:0.5, source:"wounds"} ],
  situational: 0,
  total: 10
}
```

Kallor som matar in i `parts`: SLB s.17:s tva tabeller, ActiveEffects fran
foremal/besvarjelser/scener (finns redan), sarstatus, rustningens Smyga-avdrag,
och det riktade anfallets -5.

### 9.4 Initiativ (Johans punkt 1)

Johan: *"Each user should be option to roll their own initiative roll. Will
likely be removed quite quickly as it will be an insane amount of rolls."*

Han har ratt - och det ar varre an han tror: **SLB slar initiativ varje SR**, inte
en gang per strid. Sex ronder med atta deltagare = **48 slag**. Darfor en
varldsinstallning:

| Lage | Beteende |
|---|---|
| `spelare` | Varje spelare slar sjalv. Stamningsfullt, langsamt. |
| `sl-slar-alla` | SL trycker en knapp. ⭐ **Foreslagen standard.** |
| `automatiskt` | Slas nar en deltagare laggs till, utan prompt. |

⚠ **Tva DoDE-specifika krav pa `Combat`-subklassen:** SLB sager att lika resultat
ska **slas om mellan de inblandade** (Foundry sorterar i stallet pa namn/DEX), och
att turordningen slas **om varje SR** (Foundrys standard ar en gang per strid).

⚠ Combat Carousel laser bara systemets initiativformel och behover ingen
anpassning - den fungerar redan sedan formeln sattes (post 47).

### 9.5 Handlingsekonomi och tva vapen (Johans punkt 2)

SLB s.16:s regel ar en **budget per SR som beror pa vad man haller i handerna**:

| Utrustning | Handlingar |
|---|---|
| Ett vapen | attack **ELLER** parering |
| Vapen + skold | attack **OCH** parering |
| Vapen i varje hand | 2 attacker, 2 pareringar, eller en av varje |

Det hor hemma pa en **`Combatant`-subklass** (nollstalls vid rundbyte), inte pa
aktoren. ⚠ Oppna fragor innan bygget:
- **Skoldhandsanfall ar -10 CL** (SLB s.17). Finns en *ambidexterity*-formaga som
  tar bort det? RP s.25 har "God koordinationsformaga: +3 FV i Tva vapen", vilket
  inte ar samma sak. **Behover belaggas.**
- **`Tva vapen` som fardighet kraver ett vapenPAR vid kopet** (Johan 2026-07-29)
  och far inte overstiga nagon av de tva ingaende vapenfardigheterna - hor ihop
  med backlogpost 44 om vapengrupper. Ska in i guiden.

### 9.6 Foreslagen byggordning

1. **`rolls/cl.mjs`** - CL-motorn. Allt annat matar in i den, och den ar testbar utan UI.
2. **Chattkort for `resolveAttack`** - gor motorn synlig vid bordet. Storst nytta per rad kod.
3. **`apps/attack-dialog.mjs`** - maldialog med situationskryssrutor och situational-falt.
4. **`documents/combat.mjs`** - initiativlagen, omslag vid lika, omslag per SR.
5. **`documents/combatant.mjs`** - handlingsekonomin.
6. **Fummeltabeller** - matrisen pekar redan pa dem.
7. **Rustning per kroppsdel** - storsta kvarvarande regelavvikelsen (en hjalm skyddar i dag benen).

⚠ Steg 1-3 gor systemet spelbart. Steg 4-5 gor det korrekt. Steg 6-7 komplett.

---

## 10. Tidshantering — designforslag (2026-07-29)

Johan: *"Lets align so our time management aligns with foundry. This one feels
important to get right. Maybe some kind of time management window outside battle?
In battle use the foundry time?"*

### 10.1 Varfor det spelar roll

Fyra system i DoDE ar redan tidsberoende, och alla fyra bokfor tiden separat i dag:

| System | Tidsenhet | Var det bor i dag |
|---|---|---|
| Somnklockan (EP) | >= 6 timmar (2 for alver) | En boolean per Item |
| Traningsgrinden | >= 7 dygn | En boolean pa aktoren |
| Blodning vid 0 KP i traffomrade | 1 KP per 6:e SR (30 s) | Inte implementerat |
| Medvetsloshet | 1T100-FYS minuter | Bara text i chattkortet |
| Besvarjelsers varaktighet | SR / minuter / timmar | ActiveEffect `duration` |

⚠ **Bara det sista hanger redan ihop med Foundrys klocka.** ActiveEffects lagrar
`duration.seconds` plus en `startTime` fran `game.time.worldTime` och slutar galla
av sig sjalva nar klockan gar framat. De ovriga tre ar handbokforda flaggor som
inte vet nagot om tid alls.

### 10.2 Vad Foundry ger gratis

`game.time.worldTime` ar sekunder; `game.time.advance(sekunder)` flyttar den och
fyrar `updateWorldTime`. dnd5e 5.3.3 halter ingen egen kalender — den anropar
`advanceTime` pa nio stallen och later karnan aga klockan. **Vi bor gora likadant.**

⭐ **Foljden ar att en enda tidsaxel loser alla fem raderna ovan.** Flyttar vi
klockan i stallet for att vanda flaggor, sa expirerar besvarjelser, vaknar
medvetslosa och oppnas traningsgrinden av sig sjalva.

### 10.3 Foreslagen modell

**I strid: Foundry driver tiden.** En stridsrunda ar **5 sekunder** (SLB s.15).
Systemet hakar pa `Combat`s rundbyte och gor `game.time.advance(5)`. Da racknas
besvarjelser med `duration.rounds` ned av karnan, och blodningsregeln (1 KP per
6:e SR) blir en jamforelse mot `worldTime` i stallet for en egen raknare.

**Utanfor strid: ett tidsfonster for SL.** Knappar for *10 minuter · 1 timme ·
8 timmar (sovperiod) · 1 dygn · 7 dygn (viloperiod)*, plus ett fritt falt.
Fonstret ar det enda stallet dar tid flyttas manuellt, och det ersatter dagens
Viloperiod-dialog: i stallet for att fraga hur manga dygn man vilat **flyttar man
klockan**, och grindarna oppnas av att tiden passerat.

**Grindarna blir darmed harledda, inte satta:**

| Grind | Fran flagga till |
|---|---|
| Somnklockan | `worldTime - item.system.ep.lastAwardTime >= 6h` |
| Traningen | `worldTime - actor.system.rest.lastLongRest >= 7 dygn` |

⚠ **Migrering kravs** — befintliga rollpersoner har booleans, inte tidsstamplar.
Bada kan defaulta till 0 (= "lange sedan"), vilket ar ett ofarligt startlage.

### 10.3b ⭐ Tid har ett SLAG, inte bara en langd (Johan 2026-07-29)

Johan: *"time window probably also should have traveltime? Dont think that is
really rest time for training, but on the other hand I guess you sleep when
travelling for a week... and consume rations and water."*

⚠ **Det haller, och det andrar modellen i 10.3.** Traningsgrinden kan INTE vara
`worldTime - lastLongRest >= 7 dygn`, for RP s.63 kraver en *"sammanhangande
viloperiod om minst sju dagar"* — **sammanhangande VILA**. En vecka pa vagen ar
sju dygn av tid men noll dygn av vila.

**Grinden ar alltsa en SVIT, inte en tidsstampel.** Den ackumuleras av vilodygn
och **nollstalls** av allt annat.

| Tidsslag | Klockan gar | Somnklockan nollas | Vilosviten | Proviant |
|---|---|---|---|---|
| **Vila** | ja | ja | **+1 per dygn** | ja |
| **Resa** | ja | ja | ⚠ **nollstalls** | ja |
| **Aventyr / aktivitet** | ja | ja | ⚠ **nollstalls** | ja |
| **Strid** (5 s per SR) | ja | nej | orord | nej |

⚠ Johans andra iakttagelse ar lika viktig: **man sover aven nar man reser**. Resa
nollar alltsa somnklockan (EP kan tjanas igen nasta dag) men bygger ingen vilosvit.
Det ar precis skillnaden mellan de tva grindarna i 10.3 — och den forklarar varfor
de matte skiljas at fran borjan.

**Foljd for provianten:** varje dygn som passerar utanfor strid bor dra en
dagsranson mat och vatten. ⚠ **Ingen regel hittad an** — `docs/wiki/UTRUSTNING.md`
namner varken dagsranson eller marschtakt, sa forbrukningstakten behover antingen
letas upp i bockerna eller bli ett uttalat skaparbeslut. Tills dess: rakna dygnen,
dra ingenting automatiskt.

⚠ Detta gor ocksa `system.rest.trainingUnlocked` till fel form pa faltet. Det bor
bli `rest: { streakDays, lastAdvance }` — en raknare, inte en boolean.

### 10.3c ⚠ EN klocka, tva drivare — inte tva tidsaxlar

Johan: *"Seems like there is two time axis... in combat and out of combat."*

**Halva iakttagelsen ar ratt och viktig, men slutsatsen bor inte bli tva klockor.**

Det som verkligen ar tvadelat ar **bokforingen**, inte tiden: stridstid rakans i
sekunder och ror varken vilosvit, somnklocka eller proviant, medan nedtid rakans i
timmar och dygn och ror alla tre. Det ar tva *granulariteter* och tva uppsattningar
*foljder* — men samma tidslinje.

⭐ **Avgorande motexempel: besvarjelser som spanner over gransen.** En besvarjelse
med varaktighet "1 timme" kastas i strid och maste fortfarande ga nar striden ar
slut och sallskapet gatt tjugo minuter. Med tva separata axlar finns inget entydigt
svar pa hur mycket som aterstar — man skulle behova oversatta mellan dem vid varje
overgang, och den oversattningen ar exakt den bokforing vi vill bli av med.

⚠ Dessutom: Foundry HAR bara en `worldTime`. En andra axel skulle betyda en egen
kalender vid sidan om karnans — precis det dnd5e undviker (§9.1: noll egen
kalender, nio anrop till `advanceTime`).

**Ratt form pa modellen:**

```
EN worldTime
 ├─ drivare 1: stridsrundan   → +5 s      · kind = "strid"
 └─ drivare 2: tidsfonstret   → +min/dygn · kind = vila | resa | aventyr
```

`kind` avgor vilka raknare som ror sig (se tabellen i 10.3b) — **inte vilken klocka
som gar**. Det ger Johans tvadelning i praktiken, utan att skapa tva sanningar om
vad klockan ar.

### 10.3d Lakning och sjukdom — dygnsskalan som binder ihop det

Johan: *"some effects like sickness and healing happens over days."*

⭐ **Det ar det starkaste argumentet hittills for EN klocka.** Lakning ar
per-dygn, strid ar per-sekund, och en sarad rollperson gar genom bada utan att
lakningen far pausa. Med tva axlar skulle en skada lakas olika fort beroende pa
hur mycket av veckan som rakade tillbringas i strid — vilket ar uppenbart fel.

**Det gor ocksa `kind`-flaggan (10.3b) till mer an bokforing** — den ar
lakningstakten:

| Tidsslag | Naturlig lakning (**SLB s.20**) |
|---|---|
| **Vila** (liggande) | **1 KP per VECKA** |
| **Resa / aventyr** | ⚠ **halften sa fort** (1 KP per tva veckor) |
| **Strid** | ingen |

⚠ **Takten ar VECKOVIS, inte per dygn** — SLB s.20 ordagrant: *"Genom kroppens
naturliga lakningsprocesser aterfar en varelse normalt **en (1) forlorad KP per
vecka** i alla kroppsdelar som ar skadade, samt till totala KP... Detta forutsatter
att varelsen enbart tar det lugnt och vilar liggande. I annat fall laks skadorna
halften sa fort."*

⚠ Tva detaljer som annars gar forlorade: lakningen sker **per skadad kroppsdel
parallellt** (varje omrade far sin KP per vecka), och **nar alla kroppsdelar lakt
ihop aterstalls totala KP automatiskt** till ursprungsvardet — man behover alltsa
inte laka de tva spparen var for sig ner till noll.

⚠ Samma flagga styr alltsa tre saker samtidigt: vilosviten, provianten och
lakningstakten. Det ar ett gott tecken pa att modellen ar ratt skuren — en
markning, tre foljder.

⚠ **LUCKA I KALLAN:** `REGLER_STRID.md` skriver *"Normal takt per dag (⚠ exakt
varde — verifiera mot REG)"* — sjalva antalet KP per dygn ar alltsa **inte
transkriberat**. Det maste letas upp i REG s.50-52 innan lakning kan
automatiseras. **Lakekonst** ar daremot tydlig: ett fardighetsslag per patient per
**hel vecka** av vard, och ett lyckat slag ger **dubbel** lakning den veckan —
vilket ocksa ar en veckoskala som bara fungerar med en gemensam klocka.

⭐ **Infektion ar den sjukdomsmekanik Johan efterlyste — och den finns redan i
boken (SLB s.20).** Ett sar infekteras med **1 % per skadepoang** fran ett vanligt
eggvapen och **3 % per skadepoang** fran smutsiga vapen eller djurs naturliga vapen.
En adragen infektion har **5 % chans att utveckla kallbrand** inom **1T4 veckor**,
vilket leder till amputation; ⚠ **kallbrand i huvud, mage eller bal leder till
doden**. Medan infektionen varar kan kroppsdelen **inte laka nagra KP alls**, och
personen ar matt och febrig och kan inte gora nagot aktivt under de 1T4 veckorna.
**HELA E4** botar infektionen — men **kallbrand paverkas inte av HELA**.

**Amputation** (SLB s.20): oformogen att gora nagot aktivt i **fyra veckor**, och
**FYS minskar permanent** med det antal KP den amputerade kroppsdelen hade, vilket
i sin tur sanker totala KP.

⚠ Allt detta ar vecko-skala och passar `duration.seconds` perfekt. Det ar ocksa
argument for att bygga tidsmodellen fore infektioner — utan en klocka blir de
handraknade veckor per sar.

**Ovrig sjukdom och gift** har ingen mekanik an (se backlogpost 32 om Mirac och
Spelledarbokens drogregler). Nar de byggs bor de vara **ActiveEffects med
`duration.seconds`** — da kryper de framat av samma klocka och behover ingen egen
bokforing, precis som besvarjelser redan gor.

### 10.4 Foreslagen byggordning

1. **`game.time.advance(5)` per stridsrunda** — en hook, ingen migrering, och den
   gor genast att besvarjelser med rundvaraktighet expirerar ratt. ✅ **Byggt.**
2. **Tidsfonstret** med snabbknappar **och ett tidsSLAG** (vila / resa / aventyr)
   — se 10.3b. Ersatter Viloperiod-dialogen.
3. **Grindarna till en vilosvit** — `rest.streakDays` som vaxer av vilodygn och
   nollstalls av resa/aventyr. Den enda biten som kraver migrering.
4. **Blodning och medvetsloshet** som riktiga timers, nar 1-3 finns.

⚠ Steg 1-2 ar rent additiva. Steg 3 ar det som gor tiden till sanningskalla.
