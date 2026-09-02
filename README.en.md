# Drakar och Demoner Expert — Foundry VTT System

[🇸🇪 Svenska](README.md) | 🇬🇧 English

A standalone [Foundry Virtual Tabletop](https://foundryvtt.com/) system for the Swedish tabletop RPG **Drakar och Demoner Expert** (1991). Built from scratch against Foundry's modern DataModel/ApplicationV2 architecture — no `template.json`, no bundling step for the system code.

**System id:** `drakar-och-demoner-expert`
**Foundry compatibility:** minimum v12, verified against v14
**Client language:** Swedish (`lang/sv.json`) and English (`lang/en.json`) UI translations are both available in Foundry's language picker.

> **Note:** the game content (compendiums, rules) is in Swedish only, regardless of the chosen client language — this is a translation of the project README, not of the system's game data. See "Known limitations" below.

## Getting started

**Prerequisite:** an installed Foundry VTT v12 or later (verified against v14).

1. **Get the system.** Clone the repository straight into your Foundry user data directory's `systems/` folder:

   ```bash
   git clone https://github.com/Adociouse/foundryvtt-drakar-och-demoner-expert.git drakar-och-demoner-expert
   ```

   The folder must be named exactly `drakar-och-demoner-expert` (matching the system id in `system.json`), or Foundry will not find the system. Foundry shows where `systems/` lives under **Configuration → User Data Path** (typically `%LOCALAPPDATA%\FoundryVTT\Data\systems\` on Windows, `~/.local/share/FoundryVTT/Data/systems/` on Linux).

   *Alternatively:* download the repository as a ZIP and extract it to the same place. No build step is needed — the system is plain ES modules that Foundry loads directly. (`npm install` is only required if you intend to rebuild the compendiums; see [Building compendiums](#building-compendiums).)

2. **Restart Foundry** and create a new world (**Game Worlds → Create World**) with **Drakar och Demoner Expert** as its system.

3. **Import whatever content you want.** The compendiums ship with the system and appear in the world's compendium sidebar immediately — nothing has to be imported in order to play, but everything can be dragged into the world.

> ⚠ **Scenes must be imported in two steps.** Foundry does NOT automatically resolve an imported scene's tokens: import only the `Värdshuset — Utkanten` scene and you get an empty map with no figures. Import **first** the actors the scene uses (from the `handlare` and `monster` compendiums), **then** the scene itself. This is a Foundry limitation, not a system one.

4. **Create a character.** Create an Actor of type `character` and click **Öppna rollpersonsskaparen** on its sheet — the wizard walks through all 19 steps (see below).

## Status

| Area | Status |
|---|---|
| Base attributes, derived values (HP, PSY, damage bonus, movement, carry capacity) | Done |
| Skill-value-based skill rolls (critical-success/fumble confirmation) | Done |
| Guided character wizard (19 steps, book-accurate BP/EP economy, point-buy attributes) | Done, see details below |
| Compendiums: 13 races, 39 professions, 339 weapons/equipment, 475 spells (14 magic schools), 241 monsters | Done (art coverage, weapon roster, bestiary coverage against the source books, and description text quality still have gaps — see below). The Formelboken catalogue-completion project is FULLY DONE; Kaos Väktare's demonology supplement (3 professions, Portal Magic as a 14th school) added 2026-09-02 |
| Weapon system: weapon groups, dual-wielding, weapon techniques/academies, unarmed combat styles | Done, with one deliberate simplification (see below) |
| GM effects (actor/scene/world), status conditions, periodic effects (poison etc.) | Done, with its own GM effects window (`scripts/apps/gm-effects.mjs`) |
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
9. **Profession** — 39 professions (11 base professions + 28 specializations from the Warrior's Handbook / Thieves and Assassins / Kaos Väktare supplements)
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
| `yrken` | 39 professions: 11 base professions (Bard, Healer, Warrior, Sage, Assassin, Mage, Monk, Knight, Seafarer, Thief, Frontier Scout) + 28 specializations (Warrior's Handbook, Thieves and Assassins, Kaos Väktare — Demonologist/Demon Hunter/Demon Warrior), each profession carrying a structured skill list for automatic skill assignment and, where the source material provides it, mechanically wired profession abilities |
| `vapen-utrustning` | 339 entries: 23 weapons, 45 armor pieces (per body part), 271 general equipment — purchasable in the wizard's equipment step |
| `besvarjelser` | 475 spells (431 spells + 44 mini-spells, mini-spells grouped in their own per-school "Minimagi" subfolder) — Formelboken catalogue completion is DONE (13 schools + general spells), plus Kaos Väktare's demonology supplement (Portal Magic as a 14th school, 7 spells + 14 new/3 replaced Demonology spells) |
| `monster` | 241 creatures for the NPC/monster actor type (all of Monsterboken 1 AND 2, plus all of Monsterboxen II — including combat statblocks for the peoples that also exist as playable races) |
| `magiska-foremal` | Magic items — GM-only pack, kept separate from the player-visible shop |
| `handlare` | Merchant/shop actors (own `handlare` actor type) |
| `regler`, `sl-regler`, `tabeller` | Rules text and random tables as journal/roll-table documents, sourced from the rulebooks. `regler` also holds a Races and a Professions overview page (all races/professions in table form) |
| `journaler` (shown as "Magiskolreferenser") | 14 auto-generated school reference pages (13 magic schools + General spells), one per school, with a spell/minor-spell table compiled from the `besvarjelser` compendium, plus real description text for 12 of 14 (Universalism/Alkemi/General spells still lack source text) |
| `scener` | Ready-made scenes, including the character wizard's own backdrop scene |

Compendium content is edited as JSON under `packs/<name>/_source/`, then compiled to the LevelDB format Foundry actually reads — see "Building compendiums" below.

### Known limitations

- **GM effects' skillMod/CL-mod/recovery-rate layer doesn't show as a token icon.** The GM effects window (`scripts/apps/gm-effects.mjs`) edits actor/scene/world effects stored as plain data in a Setting/flag, not as real `ActiveEffect` documents (embedded skill Items can't be AE targets, see code comments) — they affect the right number in calculations but carry no visual marker on the token. Genuine `ActiveEffect`-based buffs (`game.dode.SceneEffects`, equipment/abilities) DO get a token icon if the caller supplies an `img`, and DoDE's two registered conditions (Arm Disabled/Hand Occupied) show automatically via Foundry's own Token HUD. Periodic effects (poison/fire/bleeding) auto-sync to Foundry's matching core status icons (`poison`/`burning`/`bleeding`) on the Token HUD — other periodic-effect sources still only show as a row in the GM effects window's actor section.
- **The weapon roster covers 23 of the Player's Handbook's ~52 weapons.** The weapon-group system is built for the full table, but not every entry has been transcribed into the compendium yet.
- **The bestiary covers 241 creatures** from Monsterboken 1, Monsterboken 2, Monsterboxen II and the Svartfolk supplement — all four COMPLETE, including Svartfolk's named NPCs and its ready-to-drop svartfolk archetypes. ⚠ Coverage against the full source material is **not** established, however: besides Monsterboxen IV (56 entries, none built), three further books containing creature statblocks have not yet been audited — *Monster och Man i Ereb Altor*, *Drakar*, and the *Svartfolk* supplement (distinct from Monsterboxen II's Svartfolk chapter, which is built).
- **Playable races also exist as fightable NPCs.** The elf lineages, dwarf, duck, halfling, half-elf and half-orc each have both a `ras` entry in `raser` (character-creation building block) and a full combat statblock in `monster` — so a high-elf guard patrol or a dwarf warband can be fielded as opposition directly.
- **Most spells lack their own icon** — the vast majority show their magic school's symbol instead of unique art.
- **The spell catalogue's Formelboken catalogue completion is DONE.** All 13 playable magic schools + general spells are fully transcribed (see `docs/DESIGN_DECISIONS.md` §2). ⚠ Demonologi's four uniquely named demons (Gollog, Syreb, Ballouq, Nimum) are deliberately NOT built as spells — the source gives them full monster stat blocks, and they belong in a future `monster`-pack extension instead (see backlog 87).
- **~122 of 475 spells only have a compressed one-line summary** instead of the book's actual description text (left over from the first 2026-07-27 porting pass) — being upgraded school by school in the same pass as catalogue completion. General spells, Mentalism, Nekromanti, Röstmagi, Spiritism, Stavmagi, Symbolism, Demonologi, and Portal Magic are fully done; Animism, Elementarmagi, Harmonism, Häxkonster, and Illusionism remain (complete on the spell list, not on description quality).
- **Unarmed combat styles are built with a deliberate simplification.** The source material describes a player-composed bundle of techniques sharing a single skill value; the current implementation instead gives each technique its own, independent skill value (the same model used for weapon techniques) — an explicit, documented deviation, not a bug.
- **The Svartfolk (Dark Folk) supplement hasn't been started.**
- **Heroic abilities (HH p.20/46-48) can't be spent yet.** The heroic-deeds table (HH p.6-7) already rolls during character creation and correctly accumulates heroic points as a currency — but the separate 18-row table that currency is meant to be spent against, plus a UI for doing so, aren't built.
- The UI chrome has an English translation (`lang/en.json`), but the game content itself (compendiums, rules text) is Swedish-only regardless of the chosen client language.
- See code comments marked `⚠` for specific, deliberately flagged rule deviations or simplifications.

## Architecture

- **No `template.json`.** Actor/Item subtypes (`character`/`npc`/`handlare`, and `fardighet`/`ras`/`yrke`/`vapen`/`rustning`/`utrustning`/`besvarjelse`/`minibesvarjelse`/`formaga`) are declared in `system.json`'s `documentTypes`; the data models are bound in `scripts/dode.mjs` via `CONFIG.Actor.dataModels`/`CONFIG.Item.dataModels`.
- **Plain ES modules**, loaded directly by Foundry via `esmodules` in `system.json`. `package.json` exists only for the compendium-build tooling, not for the system code itself.

```
scripts/
  dode.mjs                Entry point — registers data models, sheets, hooks
  data/                    DataModel schemas (actor-character.mjs, item-fardighet.mjs, ...)
  documents/               Document subclasses (actor.mjs — rollSkill(), castSpell(); dode-active-effect.mjs)
  sheets/                  ApplicationV2-based sheets (character/npc/handlare/item)
  apps/                    Standalone ApplicationV2 apps (character-wizard.mjs, training.mjs, time-window.mjs, magic-training.mjs, gm-effects.mjs)
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
