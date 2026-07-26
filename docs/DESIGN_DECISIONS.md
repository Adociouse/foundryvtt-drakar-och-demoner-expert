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
| ActiveEffects subclass (`DoDeActiveEffect`) | **Done** | Fixed and live-verified 2026-07-26 (bug found and fixed same session — see git history / memory.md session 8). Was broken: `flags.dode.source`/`flags.dode.condition` used flag scope `"dode"`, which Foundry rejects (`getFlag`/`setFlag` scope must equal `game.system.id`, a registered module id, or `"core"`) — every `getFlag("dode", ...)` call threw and aborted `prepareDerivedData()`. Fixed by switching all reads/writes to `game.system.id` (`"drakar-och-demoner-expert"`), and by migrating the equipment/condition gate from the Foundry v14-deprecated `apply(actor, change)` override to `shouldApplyChange(change, {phase})` (see §6). Re-verified via console: 0 console errors across race/age/equip flows post-fix. |
| Age modifier AEs (created at wizard completion) | **Done** | Fixed and live-verified 2026-07-26. Was broken: a second age change (e.g. Ung → Gammal) silently failed to update the existing AE because `dode.mjs`'s lookup (`actor.effects.find(e => e.getFlag(...,"source")==="age")`) threw on the invalid `"dode"` scope. Fixed alongside the flag-scope migration; re-verified via console that `Ung → Gammal` now correctly renames the effect and updates all four attribute bonuses to the Gammal table values. |
| Race AEs (`transfer:true` on compendium items) | **Done** | Fixed and live-verified 2026-07-26. Was broken: race bonuses were double-applied because `actor-character.mjs`'s legacy-fallback detector checked `actor.effects` (actor-owned only) instead of `actor.appliedEffects` (which also includes item-transferred effects), so the manual `rasItem.system.attributeMods` fallback always ran on top of the real AE. Fixed by switching the check to `actor.appliedEffects`; re-verified via console: fresh actor + Dvärg item → STY/FYS/PSY/KAR bonuses exactly +3/+2/+2/-3, no doubling. |
| `bonus`/`total` field pattern on attributes | **Done** | Schema field + `prepareDerivedData()` + sheet display (`bonusDisplay`). |
| `bonus`/`total` field pattern on skills | **Done (flat field only, 2026-07-26)** | `item-fardighet.mjs` `prepareDerivedData()` now computes `total = fv + bonus` and `bonusDisplay`, mirroring the attribute pattern exactly. `bonus` (already existed as a dead, unused schema field) is now exposed on the item sheet as a manual number input, and `rollSkill()` rolls against `total` instead of `fv`. Sheet shows "FV {fv} +{bonus} = {total}" when bonus ≠ 0, same convention as attributes. Live-verified: chat card showed "FV 20" for a skill with fv 15 + bonus 5. **This is deliberately scoped to the flat container/field pattern only** — it is *not* the full "Skill Modifier System" from `PLAN_WIZARD_V2.md` (automatic race/yrke/förmåga-sourced modifiers, conditional bonuses). See the row below and §3 backlog item 7 for why that's a separate, harder problem: `bonus` here is manually set (GM/player edits the item sheet), not populated by an ActiveEffect. |
| Base/Mod/Total display on character sheet | **Done** | `character-sheet.hbs:47` shows `bonusDisplay` per attribute. |
| Sidebar v14 selector fix | **Done** | `dode.mjs:79-81` — `.header-actions` fallback added alongside `.action-buttons`. |
| Character wizard 14-step flow | **Done** | All 14 steps implemented and live-verified (Fas 1–9 + Fas 10 korrigerad). |
| Öde-typer 4-level niva picker with images | **Done** | `vanlig` / `slumpens-hjalte` / `sann-hjalte` / `gudafodd`. Image cards in `assets/niva-*.png`. |
| Förmågor 4-source aggregation system | **Partial** | MVP: free-text slots (`specialAbilities[]`), count by niva. No structured ability table, no race/yrke ability aggregation. |
| HP-based hjälteförmågor (post-creation) | **Not Started** | HH describes 1T20+accumulated HP on a table (18 entries). No sheet UI for spending HP on abilities. |
| Skill modifier system (base FV vs. effective CL, auto-sourced from race/yrke/förmåga) | **Not Started** | Designed in `PLAN_WIZARD_V2.md` (SPEC, written 2026-07-22 before the AE system existed). The flat `bonus`/`total` container now exists (row above) but is manually set, not auto-populated. **Real blocker found 2026-07-26, not just "unbuilt":** the SPEC's own recommendation (line 677) was to use ActiveEffects targeting `system.skills.<name>.modifiers` — but skills are embedded `fardighet` **Items**, not an actor-level `system.skills{}` map, and an AE `change.key` can only resolve against the schema of the document the effect is applied to (the actor, for transfer effects) — it cannot address into a specific named embedded Item. So a race/yrke item cannot give "+10 CL Gömma sig" via the same transfer-AE mechanism used for attributes without either (a) restructuring skills to live in an actor-level schema map instead of embedded Items, or (b) a bespoke aggregation pass in `prepareDerivedData()` that reads a custom modifier list off race/yrke/förmåga items and matches it to fardighet items by name/key. Needs a decision (see `PLAN_WIZARD_V2.md`'s own "Prioritet: HÖG — måste beslutas innan implementation") before building further. |
| Universal modifier system (spells, items, scenes, curses) | **Partial** | Equipment/förmåga/spell/scene AEs built (see §1) and, as of 2026-07-26, live-verified working (flag-scope + `shouldApplyChange` fixes, see §6). New `formaga` Item type. `besvarjelse` gained `spellEffect[]`/`spellDuration` + `DoDEActor#applySpellEffect()` (cast→apply is stub). `SceneEffects` util at `game.dode.SceneEffects`. Two real compendium items (`Väktarklingan`, `Alvskölden`) now carry equip-gated attribute-bonus AEs (2026-07-26, see §1/backlog 12a) — **not yet repacked/live-verified**. Remaining: skill modifiers, curses, in-sheet AE editor. |
| Equipment AEs (`equipped` gate on vapen/rustning) | **Done** (gate logic); **needs repack + live-verify** (real content) | Gate logic fixed and live-verified 2026-07-26 against a synthetic item: bonus toggles 0/5/0 exactly tracking `equipped` true/false. Was broken: the gate was implemented via the Foundry v14-deprecated `apply(actor, change)` override, which is no longer invoked for changes targeting schema-resolvable fields — fixed by migrating to `shouldApplyChange(change, {phase})`. **Same session, later pass:** added two real compendium items with effects (`Väktarklingan` +2 STY, `Alvskölden` +2 FYS) and set `system.equipped: false` explicitly on all 35 `vapen-utrustning` _source_ items (was previously absent, relying on the DataModel's `initial: true` default). These _source_ JSON edits are **not yet packed into the compiled LevelDB pack** (`npm run packs:pack`, server must be stopped first) **and not yet live-verified in a running world** — do both before checking off backlog 12a for real. |
| Förmåga Item type (`formaga`) with transfer AEs | **Done** | New DataModel + sheet + `system.json`/`dode.mjs`/lang registration. Always-active while embedded. Droppable on character sheet, listed under Särskilda förmågor. No in-sheet AE editor yet. |
| Spell temporary AEs (`spellEffect[]`/`spellDuration`) | **Partial** | Schema on `besvarjelse` + `applySpellEffect()` on the actor (creates AE with `duration.rounds`, `flags.<system.id>.source:"spell"`). Cast→apply wiring intentionally stubbed. `spellEffect[]` authored via JSON/API. |
| Scene modifier utility (`SceneEffects`) | **Done** | `scripts/utils/scene-effects.mjs`, exposed as `game.dode.SceneEffects`. `applyToScene`/`removeFromScene` over active-scene token actors, `flags.<system.id>.source:"scene"`. |
| ~~Hjälteförmågor wizard step (0 slots currently)~~ | *(removed — see row below)* | This row conflated the "formagor" wizard step's slot count (`abilityRollsByNiva`, KH s.3, särskilda förmågor) with the unrelated HP-based hjälteförmågor mechanic (row above, HH s.20/46-48). A prior session zeroed `abilityRollsByNiva` based on that conflation, which broke the still-live Fas 8 MVP step. Fixed 2026-07-26: table restored (`vanlig:1, slumpens-hjalte:2, sann-hjalte:3, gudafodd:4`, KH s.3 + ⚠ extrapolation for gudafodd). See `scripts/helpers/config.mjs` comment. Live-verified 2026-07-26: wizard step 6/14 shows 2 förmåga rows for `slumpens-hjalte`, matching the table. |
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
3. **Niva schema migration (3→4 tier).** Actors created under the old `vanlig`/`extraordinar`/`hjalte` choices now hold a value not in the current 4-choice list. Needs a migration script or at minimum a documented manual fix.
4. **Verify/accept BP/EP/maxFV placeholder numbers.** `slumpens-hjalte` (150 BP), `sann-hjalte` (175), `gudafodd` (200) and their matching `epBudgetTable`/`maxStartFvTable` rows are unsourced extrapolations. Either find the real HH source or explicitly mark them as house rules.

### Important

4a. ~~**Check actor/NPC sheets for the same `.window-content: overflow:hidden` clipping risk as the wizard.**~~ **Done (2026-07-26).** Confirmed and fixed same session: `.dode.sheet.character .window-content` and `.dode.sheet.npc .window-content` now get `overflow-y: auto` in `dode.css`. Also discovered and fixed while there: the NPC sheet had never received the wood-frame border-image / leather background theme that the character sheet and wizard have (`.dode.sheet.npc` was simply missing from those CSS selectors) — added for visual consistency across all three windows.
5. **Game Settings registration.** At minimum: active source books (`world` scope, `Array<String>`), NPC damage bonus auto-apply (`Boolean`, default false — source inconsistency documented), fumble table automation level.
6. **Localization sweep.** Move ~45 hardcoded Swedish strings to `lang/sv.json`. Enables future English localization. No gameplay risk — purely additive.
7. **Skill modifier system (auto-sourced).** Flat `bonus`/`total` field pattern done (2026-07-26, see §2) — this item now specifically means the automatic race/yrke/förmåga-sourced `modifiers[]`/`effectiveFv` layer, required before ability bonuses like Skogsalv's +10 CL Gömma sig can be mechanically active. Blocked on an architecture decision (embedded-Item skills can't be targeted by transfer AEs the way actor attributes can — see §2 for the technical detail) before implementation.
8. **Hjältedådstabell as RollTable.** 13-row, 1d20 table. Natural fit for Foundry `RollTable` — rollable from chat, linkable in journals.
9. **Migrate deprecated Foundry API calls.** `renderTemplate` → `foundry.applications.handlebars.renderTemplate` (fv-roll.mjs, damage-roll.mjs). `TextEditor.getDragEventData` → namespaced v14 equivalent. **Partially done (2026-07-26):** `DoDeActiveEffect` migrated from the deprecated `apply(actor, change)`/`_applyLegacy` override to `shouldApplyChange(change, {phase})` — see §1/§6. `renderTemplate`/`getDragEventData` still outstanding.
10. ~~**Live-verify Fas 4 age attribute modifiers.**~~ **Done (2026-07-26).** Live-verified via console (not the wizard UI directly, but the same `updateActor` hook the wizard's age step exercises): Ung → SMI+1 and Ung → Gammal → STY-3/FYS-2/SMI-2/PSY+2 both confirmed correct, including the second-change case that was previously broken (see §2).
11. **Dual-computation drift test.** A small test harness asserting `wizard preview === DataModel prepareDerivedData()` across niva×age×race combinations. Highest-leverage single test for this architecture.

### Nice-to-have

12a. ~~**Give at least one real compendium weapon/armor an AE.**~~ **Source-level done, packing/live-verify still open (2026-07-26).** Added two: `Väktarklingan` (vapen, +2 STY) and `Alvskölden` (rustning, +2 FYS), both `flags.<system.id>.{source:"item", magical:true}` in `packs/vapen-utrustning/_source/`. Also set `system.equipped: false` explicitly on all 35 items in that pack (previously absent, defaulted `true` via the DataModel). **Still needed before this is a real regression fixture:** run `npm run packs:pack` (Foundry server stopped first) to compile these _source_ changes into the LevelDB pack Foundry actually reads, then live-verify in a running world (drop the item on an actor, toggle equipped, confirm the attribute bonus in the console per the usual AE-verification method).
12. **Förmågor full table.** Transcribe the 2d20+BP special abilities table from raw OCR into a curated doc, then replace the free-text MVP with a real rollable mechanic.
13. **"Choose 12 of N" profession skill selection.** Currently all matched skills get `yrkesfardighet` cost tier. RP s.30 says the player picks 12.
14. **Expand compendium coverage.** Weapons ~50%, spells <5%, races (0 subraces), professions (0 specializations), monsters (14 sample entries).
15. **Prototype token defaults.** Add `primaryTokenAttribute: "hp"` and `secondaryTokenAttribute: "resources.psy"` to `system.json`.
16. **English localization.** Low priority per project scope.

### Deferred

17. **RuleProfile metadata layer.** Per-table `ruleMeta` tracking source books and extrapolation status. Revisit when adding content from Alver, Tjuvar och Lönnmördare, or Magikerns Handbok.
18. **Combat refinements.** Attack→damage chaining, shield parry bonus + 1/20 break chance, assassin backstab (no-SB), distance/movement modifiers.
19. **Scene/macro modifier system.** AE-based scene-level effects (e.g., "Dimön PSY ×2"). Requires the universal modifier system.
20. **HP-based hjälteförmågor.** Post-creation mechanic: spend 5 HP to roll 1T20+HP on the hjälteförmåga table (18 entries). Sheet UI, not wizard.
21. **Automated Snedtändningstabell.** Magic fumble → currently a chat notice. Could become a RollTable.
22. **CI pipeline.** ESLint + JSON validation on push/PR. Set up when going public.

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

### General methodology for "is this Foundry behavior actually what I think it is?"

1. Don't trust a code comment's explanation of Foundry internals at face value, even one that looks confident and cites a version number — verify it against the actual running Foundry build before building further logic on top of it (this project's now-fixed `apply()` override had exactly such a comment).
2. Grep `resources/app/public/scripts/foundry.mjs` for the method/property name in question. Search for its definition (`methodName(` at the start of a line, appropriately indented) and read the surrounding class, not just the first match.
3. If behavior is still unclear from source, write a throwaway `page.evaluate()` script via Playwright MCP against a temporary `Actor.create()`/`createEmbeddedDocuments()` in a real running world, log the result, then delete the actor. This project's bug hunt used exactly this technique to distinguish "throws when called directly" from "is never called by the real pipeline" — a distinction `node --check` and static reading cannot reveal.
4. Watch the browser console for `logCompatibilityWarning` output (format: `"... is deprecated. Please use X instead.", {since, until}`) — these name the exact replacement API and the version by which the old one stops working entirely.
