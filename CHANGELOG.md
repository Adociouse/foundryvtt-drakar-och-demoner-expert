# Changelog

## [Unreleased]

### Added
- ActiveEffects architecture: `DoDeActiveEffect` subclass with conditional modifier support (`flags.dode.condition`)
- `bonus` and `total` fields on all actor attributes (sty, fys, smi, int, psy, kar, sto) and skill FV values
- Race ActiveEffects: transfer AEs on race items (Alv, Dvärg, Anka, Halvalv, Halvlängdsman, Halvorch)
- Age ActiveEffects: programmatic AEs created by character wizard at completion, targeting `system.attributes.*.bonus`
- Character sheet updated to show Base / +Mod / Total when a bonus is active
- Foundry v14 sidebar selector fix (`.header-actions` fallback alongside `.action-buttons`)
