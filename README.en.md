# Drakar och Demoner Expert — Foundry VTT System

[🇸🇪 Svenska](README.md) | 🇬🇧 English

A standalone [Foundry Virtual Tabletop](https://foundryvtt.com/) system for the Swedish tabletop RPG **Drakar och Demoner Expert** (1991). Built from scratch against Foundry's modern DataModel/ApplicationV2 architecture — no `template.json`, no bundling step for the system code.

**System id:** `drakar-och-demoner-expert`
**Foundry compatibility:** minimum v12, verified against v14

> **Note:** the game content (compendiums, rules) is in Swedish only — this is a translation of the project README, not of the system itself. See "Known limitations" below.

## Status

| Area | Status |
|---|---|
| Base attributes, derived values (HP, PSY, damage bonus, movement, carry capacity) | Done |
| Skill-value-based skill rolls (critical-success/fumble confirmation) | Done |
| Guided character wizard (19 steps, book-accurate BP/EP economy, point-buy attributes) | Done, see details below |
| Compendiums: 13 races, 36 professions, 339 weapons/equipment, 222 spells, 14 monsters | Done (art coverage and weapon roster still have gaps — see below) |
| Weapon system: weapon groups, dual-wielding, weapon techniques/academies, unarmed combat styles | Done, with one deliberate simplification (see below) |
| GM effects (actor/scene/world), status conditions, periodic effects (poison etc.) | Backend done and live-verified — no dedicated window UI yet, driven from the console |
| Training economy (post-creation skill purchases), earning XP in play | Done, own `ApplicationV2` view |
| Magic system (casting, PSY resource, cantrips, magic schools) | Done, with a few deliberate simplifications (see code comments) |
| Language mechanics (mother tongue, foreign languages) | Done |
| Schema versioning + JSON export/import (actors, NPCs, items) | Done, built on Foundry's own `TypeDataModel.migrateData`/`exportToJSON` |

### The character wizard

A guided, ApplicationV2-based character wizard (`scripts/apps/character-wizard.mjs`) walks the player through 19 steps in order:

1. **Start** — introduction
2. **Gender** — determines which race/profession portrait variant is shown and inherited
3. **Tier** — Ordinary, Random Hero, True Hero, or Godborn. Four tiers, differing in number of special-ability rolls / heroic-deed rolls / XP budget (the build-point pool is currently 125 for all four pending a rules decision — see `docs/DESIGN_DECISIONS.md`)
4. **Basics** — name
5. **Race** — 13 races (7 base races + 6 elf lineages), costs build points from the tier's pool
6. **Sword hand** — right/left/ambidextrous/two-handed, with knock-on effects for the dual-wielding mechanic
7. **Age** — Young/Adult/Middle-aged/Old, grants attribute modifiers and a starting-capital multiplier
8. **Attributes** — **point-buy**, not dice rolls (the rulebook's attribute chapter turned out to be an explicit purchase table, not a rolling method — a previously corrected misreading of the source)
9. **Profession** — 36 professions (11 base professions + 25 specializations from the Warrior's Handbook / Thieves and Assassins supplements)
10. **Magic school** — spellcasting professions only
11. **Special abilities** — number of slots set by tier, a sourced 49-row random table with a "Roll ability" button; race/profession abilities carry their own structured mechanical effects where the source material supports it
12. **Social standing** — 2d6 + optional build-point spend (a 9-tier social-class system)
13. **Starting capital** — 2d6 + build points, tied to social standing and age
14. **Languages** — mother tongue (race-determined) + foreign languages
15. **Profession skills** — the profession's own skill picks (named skills, weapon/language/unarmed-technique pools)
16. **Skills** — see the two-tier skill model below
17. **Life goal** — 21 predefined options + free text
18. **Equipment** — buy weapons/armor/general gear against starting capital
19. **Review** — summary before the character is created

**Build-point / experience-point economy:** Each tier grants a pool of build points (BP) spent on race, sword hand, social standing, and starting capital. Leftover BP at the end of character creation is converted ×5 into experience points (XP), spent across the skill steps.

**Two-tier skill model:** All base skills (16 of them) and the profession's chosen skills are automatically assigned their starting value (skill value = the relevant attribute's group bracket, the "base chance") the moment the attribute/profession choice is made — nothing the player needs to roll themselves. The XP pool can then be spent to raise any skill above its base chance, following the rulebook's cumulative cost table, capped by the profession's max starting value and any catalog-specific base costs (weapon techniques, unarmed-combat techniques, dual-wielding).

A finished character can keep training in play through a dedicated training view (`scripts/apps/training.mjs`) and earn XP through adventures — a post-creation economy, separate from the wizard.

**Background art:** the character sheet and the wizard share the same visual identity — a dark leather/wood texture (`assets/backgrounds/character-sheet-leather.png` as the background, `imagen_20260719_201503_2.png` as a wood-frame `border-image`), see `styles/dode.css`.

### Compendiums

| Compendium | Contents |
|---|---|
| `raser` | 13 races: 7 base races (Human, Elf, Half-elf, Halfling, Dwarf, Half-orc, Duck) + 6 elf lineages |
| `yrken` | 36 professions: 11 base professions (Bard, Healer, Warrior, Sage, Assassin, Mage, Monk, Knight, Seafarer, Thief, Frontier Scout) + 25 specializations, each profession carrying a structured skill list for automatic skill assignment and, where the source material provides it, mechanically wired profession abilities |
| `vapen-utrustning` | 339 entries: 23 weapons, 45 armor pieces (per body part), 271 general equipment — purchasable in the wizard's equipment step |
| `besvarjelser` | 222 spells |
| `monster` | 14 creatures for the NPC/monster actor type |
| `magiska-foremal` | Magic items — GM-only pack, kept separate from the player-visible shop |
| `handlare` | Merchant/shop actors (own `handlare` actor type) |
| `regler`, `sl-regler`, `tabeller` | Rules text and random tables as journal/roll-table documents, sourced from the rulebooks |
| `scener` | Ready-made scenes, including the character wizard's own backdrop scene |

Compendium content is edited as JSON under `packs/<name>/_source/`, then compiled to the LevelDB format Foundry actually reads — see "Building compendiums" below.

### Known limitations

- **No GM effects window yet.** The full backend for actor/scene/world effects, status conditions, and periodic effects (poison etc.) is done and live-verified, but without a dedicated `ApplicationV2` view a GM has to use the console (`game.dode.addWorldEffect(...)` etc.) to set them.
- **The weapon roster covers 23 of the Player's Handbook's ~52 weapons.** The weapon-group system is built for the full table, but not every entry has been transcribed into the compendium yet.
- **Most spells lack their own icon** — 214 of 222 show their magic school's symbol instead of unique art.
- **Unarmed combat styles are built with a deliberate simplification.** The source material describes a player-composed bundle of techniques sharing a single skill value; the current implementation instead gives each technique its own, independent skill value (the same model used for weapon techniques) — an explicit, documented deviation, not a bug.
- **The Svartfolk (Dark Folk) supplement hasn't been started.**
- **Heroic abilities (HH p.20/46-48) can't be spent yet.** The heroic-deeds table (HH p.6-7) already rolls during character creation and correctly accumulates heroic points as a currency — but the separate 18-row table that currency is meant to be spent against, plus a UI for doing so, aren't built.
- **The base number in the build-point table (`DODE.bpByNiva`) is flat 125 across all four tiers** despite a sourced 125/150/175 table — pending a rules decision, see `docs/DESIGN_DECISIONS.md`. The actual starting pool already differs in practice today, though: the hero tiers (Random Hero/True Hero/Godborn) get a build-point top-up from the heroic-deeds table that Ordinary never rolls for.
- No English localization of the game content itself — only `lang/sv.json` exists, so the system's UI and compendiums are Swedish-only regardless of this README's language.
- See code comments marked `⚠` for specific, deliberately flagged rule deviations or simplifications.

## Installation

Place the system folder in your Foundry installation's `Data/systems/` directory (or install via manifest URL once published to Foundry's package list). No build step required — the system is plain ES modules that Foundry loads directly.

## Architecture

- **No `template.json`.** Actor/Item subtypes (`character`/`npc`/`handlare`, and `fardighet`/`ras`/`yrke`/`vapen`/`rustning`/`utrustning`/`besvarjelse`/`minibesvarjelse`/`formaga`) are declared in `system.json`'s `documentTypes`; the data models are bound in `scripts/dode.mjs` via `CONFIG.Actor.dataModels`/`CONFIG.Item.dataModels`.
- **Plain ES modules**, loaded directly by Foundry via `esmodules` in `system.json`. `package.json` exists only for the compendium-build tooling, not for the system code itself.

```
scripts/
  dode.mjs                Entry point — registers data models, sheets, hooks
  data/                    DataModel schemas (actor-character.mjs, item-fardighet.mjs, ...)
  documents/               Document subclasses (actor.mjs — rollSkill(), castSpell(); dode-active-effect.mjs)
  sheets/                  ApplicationV2-based sheets (character/npc/handlare/item)
  apps/                    Standalone ApplicationV2 apps (character-wizard.mjs, training.mjs, time-window.mjs, magic-training.mjs)
  rolls/                   Dice mechanics (fv-roll.mjs, damage-roll.mjs, attack.mjs, dual-wield.mjs)
  helpers/                 Game-data constants and shared logic (config.mjs — CONFIG.DODE, source-cited; special-ability-effects.mjs; schema-migrations.mjs; ep.mjs; time.mjs; anatomy.mjs)
  utils/                   Standalone utilities (scene-effects.mjs — game.dode.SceneEffects)
  build/                   Node scripts for compendium building
templates/*.hbs            Handlebars templates for sheets, apps, chat cards
lang/sv.json               All UI text
styles/dode.css
assets/backgrounds/        Background texture + wood frame, shared between sheet and wizard
packs/<name>/               Compiled compendium data (LevelDB) — what Foundry actually reads
packs/<name>/_source/       Compendium source (JSON, git-diffable) — edit here
```

## Rules philosophy

The source material is a deliberate, curated mix system — rules are drawn from several source books (the base rules, the Expert-line supplements, the Warrior's Handbook, the Heroes' Handbook, and others) rather than a single book taken straight through. That's a design choice, not an oversight. Where the newer Expert-line books directly contradict each other on the same mechanic, the younger book wins, in a fixed precedence order.

Where an implementation deviates from or simplifies the source material, it's flagged with a `⚠` in a code comment at the calculation site, with a book reference where known — what the book says, what the code does instead, and why. The idea is that others can see and question an interpretation they disagree with, rather than having to guess at it. Contributions should follow the same principle: cite your source, flag your deviations.

## Building compendiums

Compendium content is edited as JSON under `packs/<name>/_source/`, then compiled to the LevelDB format Foundry reads.

```
npm install
npx fvtt configure set dataPath "<path to your Foundry installation's root folder>"
npx fvtt package workon drakar-och-demoner-expert --type System
npm run packs:unpack   # LevelDB → packs/<name>/_source/*.json
npm run packs:pack     # packs/<name>/_source/*.json → LevelDB
```

**Never run `packs:unpack`/`packs:pack` while the Foundry server is running** — LevelDB only allows one writing client at a time.

See [CHANGELOG.md](CHANGELOG.md) for version history and `docs/DESIGN_DECISIONS.md` (Swedish, internal project documentation) for full architecture, status, and backlog documentation.

## License and rights

The source code in this repo (`scripts/`, `templates/`, `styles/`, the build tooling) is licensed under MIT — see [LICENSE](LICENSE).

The MIT license covers **only the implementation**, not the game it's built on:

- **Foundry Virtual Tabletop** is separate software with its own license from Foundry Gaming, LLC. This repo does not contain Foundry itself and requires your own valid Foundry license to use.
- **Drakar och Demoner Expert** — the rules, names, race/profession descriptions, and other game content reproduced in the compendiums (`packs/`) — belong to their respective rights holders. This project is a fan-/community-made compatibility tool and is not officially affiliated with or endorsed by the rights holders of Drakar och Demoner.
- **`assets/audio/the-iron-crown.mp3`** was generated with [Suno](https://suno.com) on a free account and is shared here for non-commercial use, per Suno's terms of service for that tier — the attribution below is required by those terms, not optional.

  > Music: "The Iron Crown", generated with Suno AI (free, non-commercial tier). Not licensed for commercial use.
