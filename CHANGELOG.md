# Changelog

## [Unreleased]

### Fixed
- **Damage bonus and movement were wrong for every character.** `DODE.damageBonusTable` and `DODE.movementTable` held values that appear in no source book — both carried their own "needs verifying" flag and turned out to be extrapolations. Corrected against Rollpersonen s.25, verified from the PDF and identical to Spelledarboken s.32. Movement also used `(SMI+FYS+STO)/3` where the rule sums the three attributes, and the race modifiers (Anka −2, Alv +1, Dvärg −2, Halvlängdsman −2) were missing entirely — now a `movementMod` field on `ras`. ⚠ This changes existing characters: 12/12/12 goes from 9 to 10 squares, and STY+STO 24 loses a phantom +1T4 damage bonus

### Added
- **Compendium organisation** (§8) — `packFolders` groups the ten packs into four sidebar folders (Rollpersoner · Utrustning & magi · Regler & tabeller · Spelledare), and the four large Item packs gained in-pack folders: races by origin, professions by base profession, equipment by category (14) and spells by magic school (12). All 544 entries placed
- **Three new packs**: `regler` (JournalEntry, players) with Bärförmåga, Värdshuspriser and the Animera död grade tables; `tabeller` (RollTable, players) with the Skräcktabell, Hjältedådstabellen and Särskilda förmågor; `sl-regler` (JournalEntry, GM) with the tavern generation table. Tables are now rollable from chat and `@UUID`-linkable
- ⚠ Note for anyone upgrading: `packFolders` only takes effect on a world's **first** load. Existing worlds keep their current sidebar and must be reorganised by hand

### Added
- **New `handlare` Actor type with a working shop sheet** — a merchant NPC whose sheet is a shop counter. Players double-click the token, see stock grouped by category with prices in the merchant's own coin, and click Köp; the cost is deducted and the item created on their own character. Note Foundry core has no built-in Loot/Merchant sheet type — that is a dnd5e-plus-module concept, so it is implemented in-system here
- **`system.currency` purse on characters** (`gm`/`sm`/`km`, with derived total and label) — the character previously had only a creation-time `startCapital` that never decreased, so there was nothing for a purchase to subtract from. The wizard seeds it from whatever start capital survives the equipment step
- `Lasslo Värdshusvärden` ("Den Trötta Draken") in a new GM-only `handlare` compendium, stocked with Magi-regelbokens tavern price list (s.48) plus general goods — a generic merchant to copy for any innkeeper, smith or herbalist
- `vardesaker` equipment category for gems, jewellery and exotic coins — treasure carries its value as an item price rather than being a spendable purse denomination
- Currency helpers on `CONFIG.DODE` (`purseToKm`, `kmToPurse`, `silverToKm`, `formatPurse`) that iterate the denomination table rather than hardcoding coins, so adding a denomination is a one-line config change

### Added
- **New `utrustning` Item type** — a generic gear type. Every Item type was previously specialised (`vapen`/`rustning`/`besvarjelse`/…), so ordinary equipment had nowhere to live. Carries category, quantity, weight (BEP), price + coin denomination, a free-text price note, equipped flag and source, and derives a silver-normalised price and total weight
- 271 equipment items ported from Magi-regelboken s.43–48 (tools, clothing, containers, cookware, camp gear, thieves' tools, instruments, drugs, food, mounts, vehicles, sundries), taking the `vapen-utrustning` pack from 33 to 304 entries
- `CONFIG.DODE.equipmentCategories` (12 categories) and `CONFIG.DODE.coinToSilver` / `DODE.toSilver()` for km/sm/gm conversion — note the exchange rate is an unsourced interpretation, see backlog 26
- Category grouping in the wizard's equipment step, with per-group counts — 304 cards in one flat grid was unusable
- The 15 Nekromanti spells from Magi-regelboken s.22–25

### Added
- Artwork for all remaining game content — 33 equipment items, 2 magic items, 14 monsters (both `img` and `prototypeToken.texture.src`), 8 spells and 13 magic school symbols. Together with the race and profession portraits this brings coverage to 100%: no compendium document ships with a `icons/svg/*` placeholder any more
- `img` on `CONFIG.DODE.magicSchoolSkills`, threaded through to the wizard's `magiskola` cards and onto the `fardighet` item the step creates — magic schools are config rows rather than compendium documents, so they had nowhere to hang art before
- `docs/dev/ART_STYLE.md`: three new prompt templates (inventory object, bestiary creature, spell/arcane symbol) alongside the existing portrait one, plus a per-category asset path table
- `CLAUDE.md`: mandatory pipeline step 2b ("Bildpipeline") — new game content ships with its art in the same pass

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
