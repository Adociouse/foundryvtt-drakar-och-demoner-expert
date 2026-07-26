# Changelog

## [Unreleased]

### Added
- Two magical compendium items in `vapen-utrustning`: Väktarklingan (sword, +2 STY while wielded) and Alvskölden (shield, +2 FYS while worn), both flagged `flags["drakar-och-demoner-expert"] = {source:"item", magical:true}` — first real content to exercise the equipment `equipped`-gate (previously only synthetic-item-tested)
- `system.equipped: false` set explicitly on all 35 items in `vapen-utrustning` (was previously absent from the compendium source, silently defaulting to `true` via the DataModel) — compendium weapons/armor now start unequipped until toggled on

### Added
- ActiveEffects architecture: `DoDeActiveEffect` subclass with conditional modifier support (`flags.<system.id>.condition`, gated via `shouldApplyChange()`)
- `bonus` and `total` fields on all actor attributes (sty, fys, smi, int, psy, kar, sto) and skill FV values
- Race ActiveEffects: transfer AEs on race items (Alv, Dvärg, Anka, Halvalv, Halvlängdsman, Halvorch)
- Age ActiveEffects: programmatic AEs created by character wizard at completion, targeting `system.attributes.*.bonus`
- Character sheet updated to show Base / +Mod / Total when a bonus is active
- Foundry v14 sidebar selector fix (`.header-actions` fallback alongside `.action-buttons`)

### Added
- `bonus`/`total` field pattern on skills (färdigheter), mirroring the existing attribute pattern: `item-fardighet.mjs` now derives `total = fv + bonus`; the previously-dead `bonus` schema field is exposed on the item sheet and rolls now use `total`. Manual/flat only — not yet auto-populated from race/yrke/förmåga sources (see backlog item 7)

### Fixed
- ActiveEffect flag scope corrected from the invalid `"dode"` namespace to `game.system.id` (Foundry only accepts `"core"`, `"world"`, an active module id, or the system id as a flag scope — `"dode"` was never valid and threw on every read, silently aborting `prepareDerivedData()` whenever a race or age AE was present)
- Race attribute bonuses no longer double-applied (the legacy-fallback detector now checks `Actor#appliedEffects`, which includes item-transferred AEs, instead of `Actor#effects`, which does not)
- A second age change (e.g. Ung → Gammal) now correctly updates the existing age AE instead of silently failing
- Equipment `equipped` gate now actually suppresses AE changes when unequipped — migrated from the Foundry v14-deprecated `apply(actor, change)` override to `shouldApplyChange(change, options)`, the hook Foundry's own AE pipeline actually calls for schema-resolvable fields
- Character wizard: "Föregående"/"Nästa" buttons were unreachable on content-heavy steps (e.g. Färdigheter's two skill tables) because Foundry's core `.window-content` defaults to `overflow: hidden` and nothing opted back into scrolling — the step content now scrolls in its own internal container while the progress header and nav footer stay fixed and always visible
- Character and NPC actor sheets now scroll (`overflow-y: auto` on `.window-content`) instead of silently clipping content taller than the fixed window height — same root cause as the wizard fix above
- NPC sheet now has the same wood-frame border and leather background as the character sheet and wizard — it had been left out of that theming entirely (visual-only inconsistency, not a functional bug)
