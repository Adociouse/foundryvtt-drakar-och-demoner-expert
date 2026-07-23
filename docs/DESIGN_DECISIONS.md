# Design Decisions — DoDE Expert (Foundry VTT)

> Consolidated reference. Replaces the content previously spread across
> `FOUNDRY_MIGRATION_PLAN.md`, `ARCHITECTURE_RULE_AUDIT.md`,
> `PLAN_WIZARD_V2.md`, and `GITHUB_PUBLICATION_GUIDE.md`.
>
> Last verified against codebase: 2026-07-23.

---

## 1. Architecture — What Was Decided and Why

### Three-layer data model

Actor and Item data uses Foundry's `TypeDataModel` / `SchemaField` pattern. Each actor subtype (`character`, `npc`) and item subtype (`fardighet`, `ras`, `yrke`, `vapen`, `rustning`, `besvarjelse`) has its own DataModel class under `scripts/data/`. Types are declared in `system.json` `documentTypes` and bound via `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels` in `dode.mjs`. No `template.json` exists — this is the correct modern Foundry v12+ pattern.

### ActiveEffects as the modifier backbone

All attribute modifiers flow through Foundry's native `ActiveEffect` system. A custom subclass `DoDeActiveEffect` (`scripts/documents/dode-active-effect.mjs`) adds a `flags.dode.condition` hook for conditional modifiers (currently all-pass — the extension point exists for future scene/context evaluation). AE `changes` target `system.attributes.*.bonus` using `ACTIVE_EFFECT_MODES.ADD`. Foundry's pipeline applies effects between `prepareEmbeddedDocuments()` and `prepareDerivedData()`, so derived values (KP, SB, movement, grouping) always see the final bonus. ActiveEffects do **not** currently cover: skill modifiers (planned, requires `flags.dode.skillModifiers`), spell duration tracking, enchanted item bonuses, or scene-level modifiers. Those are future extensions of the same AE system, not separate systems.

### Race and profession as embedded Items with transfer AEs

Race (`ras`) and profession (`yrke`) are embedded Items on the actor, enforced to at most one of each via `_onDrop` in the character sheet. Each race compendium entry carries an `effects[]` array with `transfer: true` — Foundry auto-applies these to the owning actor when the item is embedded. Reason: the modifier data travels with the actor (no broken references if the compendium changes), and the AE pipeline handles application automatically. 6 of 7 races have transfer AEs (Människa has no attribute modifiers, so no AE).

### Age modifiers as programmatic AEs

Age modifiers cannot live on an Item (there is no "age" Item). Instead, the character wizard creates an `ActiveEffect` on the actor at creation time, with `flags.dode.source: "age"` and changes targeting `system.attributes.*.bonus`. The age modifier table (`DODE.ageAttributeModifiers`) has data for Ung and Gammal; Mogen and Medelålders are empty objects (zero mods) — this reflects a genuine source-material ambiguity (RP s.24–25 vs. Expert Regler s.8 disagree), not an implementation gap. Flagged with `⚠` in `config.mjs`.

### The value / bonus / total field pattern

Each attribute has three fields: `value` (the rolled 3d6 base, never modified by AEs), `bonus` (AE target, sum of all race + age + future modifiers), and `total` (computed as `value + bonus` in `prepareDerivedData()`). Reason: preserving the rolled base lets the UI show "Base: 10, Mod: +3, Total: 13" and makes it possible to remove/change an AE without losing the original roll. The sheet displays `bonusDisplay` (formatted sign string) alongside the total.

### Wizard architecture

The character wizard (`scripts/apps/character-wizard.mjs`) is a standalone `ApplicationV2` with `HandlebarsApplicationMixin` — not a `DocumentSheet`, because no actor exists until the final step. It has 14 steps: `kon`, `niva`, `grunder`, `ras`, `yrke`, `attribut`, `formagor`, `socialt`, `kapital`, `alder`, `fardigheter`, `livsmal`, `utrustning`, `granska`. Each step owns its state slice. Calculation formulas are deliberately duplicated between the wizard (for live preview without an actor) and the DataModel (for real computation post-creation). This dual-computation is the main "keep in sync by hand" liability. `#onCreateCharacter` calls `Actor.create()`, `createEmbeddedDocuments()` for skills/equipment, and creates the age AE.

### Compendium source JSON vs. LevelDB

Both `packs/<name>/_source/*.json` (human-editable, git-diffable) and compiled LevelDB directories are committed. Reason: Foundry reads only the LevelDB at runtime, but the JSON sources are the authoritative editable format. Workflow: edit `_source/*.json`, run `npm run packs:pack` (requires `@foundryvtt/foundryvtt-cli`), commit both. The `package.json` exists only for this build tool, not for the system runtime.

### RuleProfile concept — deferred

The architecture audit proposed a `ruleMeta` metadata sidecar on config tables to track which source book each rule comes from and flag unsourced extrapolations. Decision: deferred. The system is still small enough that `⚠` code comments and the three status files provide adequate traceability. Revisit when adding content from additional supplements (Alver subraces, profession specializations) where silent book-mixing becomes harder to audit.

---

## 2. Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| ActiveEffects subclass (`DoDeActiveEffect`) | **Done** | Conditional evaluation hook via `flags.dode.condition`. Registered in `dode.mjs`. |
| Age modifier AEs (created at wizard completion) | **Done** | `character-wizard.mjs:728`. `flags.dode.source: "age"`. Not yet live-click-verified for all 4 age categories. |
| Race AEs (`transfer:true` on compendium items) | **Done** | 6 of 7 races (Människa excluded — no mods). All target `system.attributes.*.bonus`. |
| `bonus`/`total` field pattern on attributes | **Done** | Schema field + `prepareDerivedData()` + sheet display (`bonusDisplay`). |
| `bonus`/`total` field pattern on skills | **Not Started** | Skills have only `fv`. A `modifiers[]` array and `effectiveFv` derivation are designed (see PLAN_WIZARD_V2.md SPEC) but unbuilt. |
| Base/Mod/Total display on character sheet | **Done** | `character-sheet.hbs:47` shows `bonusDisplay` per attribute. |
| Sidebar v14 selector fix | **Done** | `dode.mjs:79-81` — `.header-actions` fallback added alongside `.action-buttons`. |
| Character wizard 14-step flow | **Done** | All 14 steps implemented and live-verified (Fas 1–9 + Fas 10 korrigerad). |
| Öde-typer 4-level niva picker with images | **Done** | `vanlig` / `slumpens-hjalte` / `sann-hjalte` / `gudafodd`. Image cards in `assets/niva-*.png`. |
| Förmågor 4-source aggregation system | **Partial** | MVP: free-text slots (`specialAbilities[]`), count by niva. No structured ability table, no race/yrke ability aggregation. |
| HP-based hjälteförmågor (post-creation) | **Not Started** | HH describes 1T20+accumulated HP on a table (18 entries). No sheet UI for spending HP on abilities. |
| Skill modifier system (base FV vs. effective CL) | **Not Started** | Designed in SPEC. Requires `modifiers[]` on fardighet + `effectiveFv` derivation. |
| Universal modifier system (spells, items, scenes, curses) | **Not Started** | AE infrastructure exists. No spell/item/scene/curse modifiers created yet. |
| Hjälteförmågor wizard step (0 slots currently) | **Not Started** | `abilityRollsByNiva` exists but the HP-based table mechanic is unbuilt. |
| Game Settings registration | **Not Started** | Zero `game.settings.register()` calls anywhere. Needed for: active source books, NPC SB auto-apply, fumble table automation. |
| RollTable for hjältedådstabell | **Not Started** | `DODE.hjaltedadTable` remains a JS array in `config.mjs`. No `RollTable` document or compendium pack. |
| Localization sweep | **Not Started** | ~45 hardcoded Swedish strings in wizard, sheets, config. `lang/sv.json` covers types/attributes/skills but not UI labels. |
| `system.json` TODO URLs | **Not Started** | `authors[0].url`, `url`, `manifest`, `download` are all `https://github.com/TODO/...` placeholders. |
| `CHANGELOG.md` | **Not Started** | `system.json` references it; file does not exist. |
| Niva schema migration (3→4 tier) | **Not Started** | Any actor created before the 4-tier `niva` change has a value not in the current `choices` list. No migration script. |
| Combat system (attack→damage, shield, backstab) | **Not Started** | Basic `rollSkill`/`rollAttack`/`rollWeaponDamage`/`castSpell` exist. No attack→damage chaining, shield parry/break, backstab mechanics, or distance modifiers. |

---

## 3. Open Backlog

### Critical

1. **Fix `system.json` placeholder URLs.** `authors[0].url`, `url`, `manifest`, `download` point at `https://github.com/TODO/...`. Broken links the moment the system is installed from a manifest. Real repo: `github.com/Adociouse/foundryvtt-drakar-och-demoner-expert`.
2. **Create `CHANGELOG.md`.** `system.json` references it; the file does not exist.
3. **Niva schema migration (3→4 tier).** Actors created under the old `vanlig`/`extraordinar`/`hjalte` choices now hold a value not in the current 4-choice list. Needs a migration script or at minimum a documented manual fix.
4. **Verify/accept BP/EP/maxFV placeholder numbers.** `slumpens-hjalte` (150 BP), `sann-hjalte` (175), `gudafodd` (200) and their matching `epBudgetTable`/`maxStartFvTable` rows are unsourced extrapolations. Either find the real HH source or explicitly mark them as house rules.

### Important

5. **Game Settings registration.** At minimum: active source books (`world` scope, `Array<String>`), NPC damage bonus auto-apply (`Boolean`, default false — source inconsistency documented), fumble table automation level.
6. **Localization sweep.** Move ~45 hardcoded Swedish strings to `lang/sv.json`. Enables future English localization. No gameplay risk — purely additive.
7. **Skill modifier system.** `modifiers[]` array + `effectiveFv` on färdighet items. Required before race/yrke ability bonuses (e.g., Skogsalv +10 CL Gömma sig) can be mechanically active.
8. **Hjältedådstabell as RollTable.** 13-row, 1d20 table. Natural fit for Foundry `RollTable` — rollable from chat, linkable in journals.
9. **Migrate deprecated Foundry API calls.** `renderTemplate` → `foundry.applications.handlebars.renderTemplate` (fv-roll.mjs, damage-roll.mjs). `TextEditor.getDragEventData` → namespaced v14 equivalent.
10. **Live-verify Fas 4 age attribute modifiers.** Ung and Gammal modifiers are coded but not click-through verified in a real wizard session per age category.
11. **Dual-computation drift test.** A small test harness asserting `wizard preview === DataModel prepareDerivedData()` across niva×age×race combinations. Highest-leverage single test for this architecture.

### Nice-to-have

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
