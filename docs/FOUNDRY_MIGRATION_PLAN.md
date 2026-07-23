# Foundry v14 Native Architecture Migration Plan

> Generated: 2026-07-22. Based on a full audit of every file in `scripts/`, `templates/`, `styles/`, `lang/`, `system.json`, and all compendium source data.

---

## 1. Executive Summary

The DoDE Expert system is well-built on modern Foundry foundations — `TypeDataModel`, `ApplicationV2`/`HandlebarsApplicationMixin`, `ActorSheetV2`/`ItemSheetV2`, proper `prepareDerivedData()`, and the Foundry Roll API. The codebase is clean, well-commented, and correctly structured.

However, it rolls its own solutions for several things Foundry provides natively. As the system grows from a character-creation tool toward full play support (modifiers from race/yrke/spells/items/scenes/curses), adopting Foundry's native systems now — before more custom modifier code accumulates — will avoid a painful later rewrite.

### Top 3 Migration Priorities

1. **ActiveEffects** (HIGH — architectural foundation) — Zero usage today. This is the single most impactful migration: it replaces the planned custom `formaga[].modifierValue` array, enables spell/item/scene modifiers, and gives free duration tracking via the combat tracker. Every other modifier source (race abilities, profession abilities, enchanted items, curses, scene effects) should flow through this one system. **Must be decided before any modifier code is written.**

2. **Sidebar button injection** (HIGH — live v14 breakage risk) — `dode.mjs:74-86` queries the DOM with `querySelector(".directory-header .action-buttons")` inside `renderActorDirectory`. Foundry v14 changed sidebar rendering to ApplicationV2; the selector may silently fail (button never appears) or break on future minor updates. Concrete fix below.

3. **Game Settings** (MEDIUM — user-facing quality) — Zero `game.settings.register()` calls. Rule-profile toggles (which source books are active), optional rules (e.g. SB on NPC attacks, fummel-table automation level), and display preferences should use Foundry's native settings system rather than being hardcoded constants.

---

## 2. Per-System Assessment Table

| # | System | Current State | Foundry Native | Effort | Priority |
|---|--------|--------------|----------------|--------|----------|
| 1 | **ActiveEffects** | Zero usage — no `ActiveEffect` subclass, no `applyActiveEffects()`, no `prepareEmbeddedDocuments()`. Race mods are manual in `prepareDerivedData()`. Planned `formaga[].modifierValue` is a custom reinvention. | `ActiveEffect` documents with `changes[]` targeting DataModel paths, `transfer` from items to actors, `duration` integrated with combat tracker | HIGH | **P0** |
| 2 | **Embedded Items** | Race/yrke stored as embedded Items (correct). But `actor-character.mjs:121,151` finds them by scanning `this.parent.items` with `.find(i => i.type === "ras")` every `prepareDerivedData()` call | Already correct pattern; minor optimization possible | LOW | P3 |
| 3 | **Item DataModels** | All 6 types use `TypeDataModel` correctly. Only `prepareDerivedData()` used (on actor-character, actor-npc). No `prepareBaseData()` on any DataModel. | `prepareBaseData()` for source-data cleanup, `prepareDerivedData()` for computed values — both available on Item DataModels too | LOW | P3 |
| 4 | **Roll API** | `new Roll("1d20").evaluate()` + `ChatMessage.create()` with `rolls: [roll]` + `sound: CONFIG.sounds.dice`. Correct, clean pattern. No roll dialog. | Current usage is correct. Missing: no `Roll.toMessage()` shorthand, no interactive roll dialog for modifiers, no Dice So Nice explicit integration (works by default via `rolls` array) | LOW | P4 |
| 5 | **RollTable** | `DODE.hjaltedadTable` (1T20, 13 rows), `DODE.socialStandingTable`, `DODE.startCapitalTable`, `DODE.damageBonusTable`, `DODE.movementTable`, `DODE.groupTable` — all JS arrays in `config.mjs` | `RollTable` documents in compendium packs — rollable from chat, journal links, macros, drag-droppable | MEDIUM | P2 |
| 6 | **Settings** | Zero `game.settings.register()` calls. All configuration is hardcoded in `config.mjs` constants. | `game.settings.register()` for user-configurable options; `game.settings.registerMenu()` for settings UIs | MEDIUM | **P1** |
| 7 | **Hooks / Sidebar** | `renderActorDirectory` hook with raw DOM `querySelector` for button injection (`dode.mjs:74-86`). Fragile against v14 sidebar changes. | v14: `renderActorDirectory` callback receives ApplicationV2 context. Use `insertAdjacentHTML` on the correct container, or better: a dedicated header button via the hook's documented API | LOW | **P0** |
| 8 | **Localization** | `lang/sv.json` covers types, attributes, skills, derived values, roll outcomes. ~30 hardcoded Swedish strings in `character-wizard.mjs` (step labels, age categories, niva descriptions, UI text), ~10 in templates, ~5 in `actor.mjs`/`actor-npc-sheet.mjs` | All user-visible strings should go through `game.i18n.localize()` / `lang/sv.json` | MEDIUM | P2 |
| 9 | **Prototype Token** | No `prototypeToken` configuration in `system.json`. No custom token HUD. | `system.json` can set default token properties (disposition, display bars, vision). Important for NPC tokens. | LOW | P3 |
| 10 | **Scene/Macro** | No scene integration. No macro support. The "Dimön PSY ×2" use case has no implementation path. | Scene flags + ActiveEffects for scene-level modifiers. Macros for common operations (roll skills, cast spells). | MEDIUM | P2 (after AE) |

---

## 3. ActiveEffects Migration — Detailed Plan

### 3.1 What ActiveEffects Replace

| Current/Planned Custom Solution | ActiveEffect Replacement |
|---|----|
| `item-ras.mjs → attributeMods` (manual object, read in `prepareDerivedData`) | AE `changes` on the ras Item with `transfer: true` — auto-applied to owning actor |
| `DODE.ageAttributeModifiers` config lookup in `prepareDerivedData` | AE created programmatically when age is set, with changes targeting attribute paths |
| Planned `system.formaga[].modifierValue` array (SPEC in PLAN_WIZARD_V2.md) | AE on race/yrke/ability Items, each with its own `changes[]` |
| Future spell effects (buff/debuff) | AE with `duration` (rounds/seconds), applied to target actor |
| Future enchanted items | AE on the vapen/rustning Item with `transfer: true` |
| Future scene modifiers (Dimön PSY ×2) | AE applied via macro/module to all actors in scene, or stored in scene flags and applied via hook |
| Future curses | AE with custom `flags.dode.curse` metadata, no auto-expire |

### 3.2 DataModel Paths for AE `changes`

ActiveEffect `changes` are `{ key, mode, value }` tuples. The `key` is a dot-path into `actor.system`. Here are the paths DoDE needs:

```
// Attribute modifiers (race, age, spells, curses)
system.attributes.sty.value    // base attribute — but AE should target a MOD field, not base
system.attributes.sty.mod      // ← BETTER: add to mod, base stays clean
system.attributes.sto.mod
system.attributes.fys.mod
system.attributes.smi.mod
system.attributes.int.mod
system.attributes.psy.mod
system.attributes.kar.mod

// Derived values (spells, scene effects)
system.hp.max                  // override or add
system.resources.psy.max       // PSY pool (Dimön ×2 = MULTIPLY mode)
system.abs                     // armor bonus from enchanted items

// Skill modifiers (race abilities like Skogsalv +10 CL)
// AE can't easily target embedded Items by name. Two approaches:
// A) Store skill modifiers as actor-level data, not on the Item
// B) Use flags.dode.skillModifiers[] and read in prepareDerivedData
// Recommendation: approach B — see §3.4
```

### 3.3 Implementation Steps

**Step 1: Actor subclass — enable ActiveEffects pipeline**

In `scripts/documents/actor.mjs`, the `DoDEActor` class needs to participate in Foundry's AE pipeline. In Foundry v12+/v14, the pipeline is:

```js
// scripts/documents/actor.mjs
export default class DoDEActor extends Actor {
  // Foundry calls prepareData() → prepareBaseData() → prepareEmbeddedDocuments()
  // → prepareDerivedData(). ActiveEffects are applied between
  // prepareEmbeddedDocuments and prepareDerivedData by default in v12+.
  // 
  // The TypeDataModel's prepareDerivedData() already runs in the right phase.
  // What we need to ensure:
  // 1. ActiveEffects from owned Items with transfer:true are collected
  // 2. AE changes are applied to system data BEFORE prepareDerivedData runs
  //
  // In Foundry v12+, this happens automatically IF:
  // - We don't override prepareData() or applyActiveEffects() incorrectly
  // - Our DataModel paths match the AE change keys
  //
  // No override needed for the basic pipeline — Foundry handles it.
  // But we DO need to restructure how race mods work (see Step 2).

  // ... existing rollSkill, castSpell etc. stay unchanged ...
}
```

**Step 2: Restructure race/age modifiers from manual lookup → AE**

Current flow (`actor-character.mjs:118-148`):
```js
// CURRENT — manual lookup every prepareDerivedData
const rasItem = this.parent?.items?.find(i => i.type === "ras");
const mods = rasItem?.system?.attributeMods ?? {};
a[key].raceMod = mods[key] ?? 0;
a[key].mod = a[key].raceMod + a[key].ageMod;
a[key].total = a[key].value + a[key].mod;
```

Target flow — race attribute mods become AE `changes` on the ras Item:
```js
// In item-ras.mjs — add a method to generate AE changes from attributeMods
// OR: store them directly as an ActiveEffect on the ras compendium entries

// Compendium ras entry "Dvärg" would have an embedded ActiveEffect:
// {
//   name: "Rasmodifikationer (Dvärg)",
//   transfer: true,    // ← auto-transfers to owning actor
//   changes: [
//     { key: "system.attributes.sty.value", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "3" },
//     { key: "system.attributes.fys.value", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "1" },
//     // etc.
//   ]
// }
```

Then `prepareDerivedData` simplifies — `a[key].value` already includes the race mod because the AE applied it before `prepareDerivedData` ran:
```js
// AFTER migration — prepareDerivedData just reads the final value
prepareDerivedData() {
  const a = this.attributes;
  for (const key of Object.keys(DODE.attributes)) {
    a[key].total = a[key].value; // AE already applied mods to value
    a[key].group = DODE.attributeToGroup(a[key].total);
  }
  // ... rest of derived calculations use .total as before
}
```

**Wait — there's a subtlety.** If AEs modify `system.attributes.sty.value` directly, the base value (what the player rolled with 3d6) is lost — you can't show "Base: 10, Mod: +3, Total: 13" anymore. The standard Foundry pattern is:

**Option A: Override in AE, keep base visible via `overrides`**
- AE targets `system.attributes.sty.value` with ADD mode
- The `Actor.overrides` object shows what AEs changed
- `prepareDerivedData` can read `Actor.overrides` to reconstruct the breakdown

**Option B: Two-field pattern (recommended for DoDE)**
- Keep `system.attributes.sty.value` as the ROLLED base (never modified by AE)
- Add `system.attributes.sty.bonus` as the AE target (mode ADD)
- `prepareDerivedData` computes `total = value + bonus`
- AE `changes` target `system.attributes.sty.bonus`

Option B is cleaner for DoDE's UI (the sheet already shows Base/Mod/Total) and preserves the rolled value. The existing `raceMod`/`ageMod` fields become AE-driven rather than manually computed.

```js
// actor-character.mjs schema addition:
// Each attribute gets a `bonus` field that AEs target
const attribute = () => new fields.SchemaField({
  value: new fields.NumberField({ required: true, integer: true, initial: 10, min: 0 }),
  bonus: new fields.NumberField({ required: true, integer: true, initial: 0 })  // ← AE target
});

// prepareDerivedData:
a[key].total = a[key].value + a[key].bonus; // bonus is sum of all AEs
a[key].group = DODE.attributeToGroup(a[key].total);
```

**Step 3: Convert compendium ras entries to include AE**

Each `packs/raser/_source/*.json` needs an `effects` array:
```json
{
  "name": "Dvärg",
  "type": "ras",
  "system": {
    "bpCost": 25,
    "attributeMods": { "sty": 3, "fys": 1, "smi": 0, "int": 0, "psy": 0, "kar": 0 }
  },
  "effects": [
    {
      "name": "Rasmodifikationer (Dvärg)",
      "transfer": true,
      "disabled": false,
      "changes": [
        { "key": "system.attributes.sty.bonus", "mode": 2, "value": "3" },
        { "key": "system.attributes.fys.bonus", "mode": 2, "value": "1" }
      ]
    }
  ]
}
```
`mode: 2` = `CONST.ACTIVE_EFFECT_MODES.ADD`.

The `attributeMods` field can be kept for backward compatibility / display, but the actual modifier application goes through the AE.

**Step 4: Age modifiers as programmatic AEs**

Age modifiers can't live on an Item (there's no "age" Item). Instead, create/update an AE on the actor when `system.alder` changes:

```js
// In actor.mjs or a hook:
Hooks.on("updateActor", (actor, changes) => {
  if (!("system.alder" in foundry.utils.flattenObject(changes))) return;
  // Remove old age AE, create new one from DODE.ageAttributeModifiers
  const ageMods = DODE.ageAttributeModifiers[actor.system.alder] ?? {};
  const aeChanges = Object.entries(ageMods)
    .filter(([, v]) => v !== 0)
    .map(([key, value]) => ({
      key: `system.attributes.${key}.bonus`,
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: String(value)
    }));
  // Find existing age AE by flag
  const existing = actor.effects.find(e => e.getFlag("dode", "isAgeMod"));
  if (existing) existing.update({ changes: aeChanges });
  else if (aeChanges.length) {
    actor.createEmbeddedDocuments("ActiveEffect", [{
      name: `Åldersmod (${actor.system.alder})`,
      changes: aeChanges,
      "flags.dode.isAgeMod": true
    }]);
  }
});
```

**Step 5: ActiveEffect config sheet**

Register a sheet so users (GM) can view/edit effects on items and actors:

```js
// In dode.mjs init hook:
// Foundry v14 provides a default AE sheet, but a custom one can show
// DoDE-specific fields (condition text, source display)
```

For MVP, Foundry's built-in AE sheet is sufficient. A custom one can come later.

### 3.4 Skill Modifiers via AE Flags (Conditional Bonuses)

Foundry AE `changes` can't target embedded Items by name. For skill modifiers like "Skogsalv: +10 CL on Gömma sig in forest", use AE flags:

```js
// AE on the ras Item "Skogsalv":
{
  name: "Skogsbonus",
  transfer: true,
  changes: [],  // no direct DataModel changes — this is conditional
  flags: {
    dode: {
      skillModifiers: [
        { skill: "Gömma sig", value: 10, condition: "i skog" },
        { skill: "Kamouflage", value: 10, condition: "i skog" }
      ]
    }
  }
}
```

In the character sheet and roll flow, collect all `flags.dode.skillModifiers` from active AEs:
```js
// In actor.mjs or the sheet:
getSkillModifiers(skillName) {
  return this.effects
    .filter(e => !e.disabled)
    .flatMap(e => e.getFlag("dode", "skillModifiers") ?? [])
    .filter(m => m.skill === skillName);
}
```

The roll dialog (future) can show "Gömma sig FV 8 (+10 i skog = 18?)" and let the player toggle conditionals.

### 3.5 Duration and Combat Integration

AEs with `duration` integrate with Foundry's combat tracker automatically:
```js
// Spell buff lasting 3 rounds:
{
  name: "Sköldbåge (E2)",
  duration: { rounds: 3 },
  changes: [{ key: "system.abs", mode: 2, value: "4" }],
  origin: "Item.spellUuid"
}
```

The effect auto-disables when the combat round expires. No custom tracking code needed.

### 3.6 Wizard Impact

The character wizard creates the actor, then creates embedded Items. AEs on those Items with `transfer: true` will automatically apply to the actor after creation. The wizard does NOT need to manually compute race mods anymore — it can rely on Foundry's pipeline.

However, during the wizard flow (before the actor exists), the wizard still needs its own preview calculation. The wizard's `#effectiveAttributes()` should stay as a self-contained preview calculator. Only the final `#onCreateCharacter` output changes — it no longer needs to write `attributeMods` manually.

---

## 4. Embedded Items Migration — Race/Yrke

### Current State

Race and yrke ARE already embedded Items on the actor — this is correct. The system enforces "at most one of each" via `_onDrop` logic in `actor-character-sheet.mjs:144-149`.

### Assessment: Keep as Embedded Items (No Change Needed)

The current pattern is the right Foundry pattern. Embedded Items:
- Have their own DataModel and sheet
- Can carry ActiveEffects that `transfer` to the actor
- Are visible in the actor's Items tab
- Can be dragged from compendium packs

**Do NOT change to slug-based lookups.** The embedded Item approach is strictly better — it gives free AE transfer, and the data travels with the actor (no broken references if the compendium changes).

### Minor Improvements

1. **Remove the manual `this.parent?.items?.find(i => i.type === "ras")` scan** in `prepareDerivedData` once AEs handle attribute mods. The `race` and `profession` derived fields can stay as convenience references, but they no longer need to be the source of modifier data.

2. **Consider caching** the race/yrke lookup. Currently it runs every `prepareDerivedData` call (which can fire multiple times per update). A simple `get race()` getter on the DataModel would be cleaner:
```js
get race() {
  return this.parent?.items?.find(i => i.type === "ras") ?? null;
}
```

---

## 5. Sidebar Fix — Concrete Code

### The Bug

`dode.mjs:74-86`:
```js
Hooks.on("renderActorDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  const header = root?.querySelector(".directory-header .action-buttons")
    ?? root?.querySelector(".directory-header");
  if (!header) return;
  if (header.querySelector(".dode-open-wizard")) return;

  const button = document.createElement("button");
  // ...
  header.appendChild(button);
});
```

**Problem:** In Foundry v14, `renderActorDirectory`'s `html` parameter changed. The `html[0]` jQuery fallback and `.directory-header .action-buttons` selector work in v12 but are fragile. If Foundry's HTML structure changes (which it does between minor versions), the button silently disappears.

### The Fix

Use `getActorDirectoryEntryContext` or, simpler, use the `renderApplication` hook with the v14-stable approach:

```js
// scripts/dode.mjs — replace lines 74-86 with:
Hooks.on("renderActorDirectory", (app, html) => {
  // v14: html is the element. v12: html is jQuery-wrapped.
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  // v14 uses .directory-header > .header-actions or .action-buttons
  // Search broadly, fall back gracefully
  const header = root.querySelector(".directory-header .action-buttons")
    ?? root.querySelector(".directory-header .header-actions")
    ?? root.querySelector(".directory-header");
  if (!header) return;
  if (header.querySelector(".dode-open-wizard")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("dode-open-wizard");
  button.innerHTML = '<i class="fa-solid fa-hat-wizard"></i> Ny rollperson (guide)';
  button.addEventListener("click", () => game.dode.openCharacterWizard());
  header.appendChild(button);
});
```

The core issue is the CSS selector. The fix adds `.header-actions` as a v14 fallback. **But the real long-term fix** is to use Foundry's `getHeaderButtons` API if/when ActorDirectory supports it, or to register the wizard as a proper Application accessible from the sidebar menu.

**Lowest-risk immediate fix:** Add the `.header-actions` fallback selector (one line change). This is a 2-minute fix.

---

## 6. RollTable Migration

### Tables That Should Become Foundry RollTable Documents

| Config Table | Rows | Dice | Good Fit for RollTable? | Rationale |
|---|---|---|---|---|
| `DODE.hjaltedadTable` | 13 | 1T20 | **YES — top candidate** | Players/GMs roll on it during char creation and play. A native RollTable is rollable from chat (`/roll`), linkable in journals, and shows results in chat with proper formatting |
| `DODE.socialStandingTable` | 9 | 2T6+BP | No | Not a straight dice→result table — involves arithmetic (roll + BP + half-social-BP, capped). Better as code. |
| `DODE.startCapitalTable` | 11 | 2T6+BP | No | Same reason — arithmetic, not a simple lookup |
| `DODE.damageBonusTable` | 7 | — | No | Derived from STY+STO sum, not a dice roll. Pure lookup table, fine in config. |
| `DODE.movementTable` | 12 | — | No | Derived from attribute average, not a dice roll |
| `DODE.groupTable` | 22 | — | No | Pure lookup table |
| `DODE.epBudgetTable` | 4×4 | — | No | Matrix lookup, not a roll |
| `DODE.ageAttributeModifiers` | 4 | — | No | Keyed by age category, not a roll |

### Migration Plan for hjaltedadTable

1. Create `packs/tabeller/_source/hjaltedadstabell.json` as a `RollTable` document
2. 13 `TableResult` entries matching the current array
3. Formula: `1d20`
4. Register in `system.json` as a new pack: `{ name: "tabeller", label: "Tabeller", type: "RollTable" }`
5. Add a "Roll Hjältedåd" button on the character sheet (for hero-level characters)
6. The `DODE.hjaltedadTable` array in config.mjs can be removed once the RollTable is in place

**Future candidates:** A "Snedtändningstabell" (spell fumble table) would also be a natural RollTable, once the fumble table data is extracted from the source books.

---

## 7. Settings Migration

### What Belongs in `game.settings`

| Setting | Type | Scope | Current State |
|---|---|---|---|
| **Active source books** | `Array<String>` (checkboxes) | `world` | Hardcoded — all books always active. Some users may want to play without HH (no hero levels), without KH (simpler char creation), etc. |
| **NPC damage bonus auto-apply** | `Boolean` | `world` | Hardcoded `false` — NPC attacks don't add `system.damageBonus` (documented design decision in memory.md due to source inconsistency). A GM setting to toggle this would resolve the ambiguity per-table. |
| **Fumble table automation** | `String` (choices: `"none"`, `"notify"`, `"auto-roll"`) | `world` | Hardcoded `"notify"` — fummel just shows a chat message. Once the Snedtändningstabell exists as a RollTable, a setting controls whether to auto-roll it. |
| **Spell S-value interpretation** | `String` (choices: `"school-value"`, `"personal-skill"`) | `world` | Hardcoded to use school value as S. A setting lets GMs who track per-spell skill values switch to personal skill mode. |
| **Character creation point-buy variant** | `Boolean` | `world` | Not implemented. The codebase documents that some sources mention BP-buy for attributes (master outline). A setting could enable this optional mode. |
| **Default language** | Already handled by Foundry core | — | N/A |

### Implementation

```js
// In dode.mjs, inside the init hook:
game.settings.register("drakar-och-demoner-expert", "activeBooks", {
  name: "Aktiva regelböcker",
  hint: "Välj vilka tilläggsböcker som är aktiva. Påverkar nivåval, tabeller och kompendieinnehåll.",
  scope: "world",
  config: true,
  type: Array,
  default: ["RP", "REG", "KH", "HH", "MAG"],
  // Custom settings menu for checkboxes (registerMenu)
});

game.settings.register("drakar-och-demoner-expert", "npcAutoSB", {
  name: "NPC skadebonus automatiskt",
  hint: "Lägg automatiskt till NPC:ns skadebonus på alla anfallsskador. Av som standard — källorna är inkonsekventa.",
  scope: "world",
  config: true,
  type: Boolean,
  default: false
});
```

---

## 8. Migration Sequence

Dependencies dictate order. Here's the recommended implementation sequence:

```
Phase 1 — Foundation (no gameplay changes, reduces future risk)
├── 1a. Sidebar fix (dode.mjs:74-86)                          [30 min]
│      Zero risk, fixes a live v14 fragility
├── 1b. game.settings skeleton (register 2-3 settings)         [1 hour]
│      No behavior change — just makes future toggles possible
└── 1c. Localize hardcoded strings (character-wizard.mjs)       [2 hours]
       Move ~30 Swedish strings to lang/sv.json

Phase 2 — ActiveEffects Core (the big one)
├── 2a. Add `bonus` field to attribute schema                   [1 hour]
│      Schema migration: add system.attributes.*.bonus = 0
│      prepareDerivedData: total = value + bonus
│      Sheet: show bonus breakdown
├── 2b. Create AEs on ras compendium entries                   [2 hours]
│      Each ras gets an effects[] array with transfer:true
│      changes target system.attributes.*.bonus
│      Repack compendia
├── 2c. Remove manual race-mod code from prepareDerivedData    [1 hour]
│      Delete the rasItem lookup + manual mod application
│      AE pipeline now handles it
│      VERIFY: created actors still get correct attribute totals
├── 2d. Age modifiers as programmatic AEs                      [2 hours]
│      Hook on updateActor for system.alder changes
│      Create/update AE with flags.dode.isAgeMod
│      Delete ageAttributeModifiers manual code
├── 2e. AE config sheet (or use Foundry default)               [1 hour]
│      Add "Effects" tab to character sheet
│      Show active effects with source, duration, toggle
└── 2f. Skill modifier flags on AEs                            [2 hours]
       flags.dode.skillModifiers on race AEs
       Display on character sheet skill list
       Feed into roll flow

Phase 3 — RollTable + Polish
├── 3a. Hjältedådstabell as RollTable compendium entry         [1 hour]
├── 3b. "Roll Hjältedåd" button on character sheet             [30 min]
├── 3c. Prototype token defaults in system.json                [30 min]
└── 3d. Scene modifier macro/UI (using AEs from Phase 2)       [2 hours]

Total estimated effort: ~16-18 hours of focused work
```

### Critical Dependencies

- **Phase 2c depends on 2a + 2b** — don't remove manual code until AE pipeline is proven
- **Phase 2d depends on 2a** — age AEs target the same `bonus` field
- **Phase 2f depends on 2e** — need AE visibility before adding skill-specific flags
- **Phase 3d depends on Phase 2 complete** — scene modifiers ARE ActiveEffects
- **Phase 1 is independent** — can be done in any order, at any time

### Wizard Impact (cross-cutting)

The character wizard (`character-wizard.mjs`) must keep its own independent calculation path for the preview (it has no actor to apply AEs to). But `#onCreateCharacter` simplifies: when it creates the actor and embeds the ras Item, the AE on the ras Item auto-transfers. No manual `attributeMods` application needed at actor creation time.

**Test protocol for Phase 2:** After each sub-phase, create a character through the wizard and verify:
1. Attribute totals match (raceMod correctly applied via AE, not manual code)
2. KP, SB, movement derived correctly
3. Existing characters load without errors (schema migration for `bonus` field)
4. Removing then re-adding a race item correctly removes then re-adds the AE

---

## 9. What NOT to Migrate

These are fine as custom solutions — Foundry has no better native alternative:

| Thing | Why It's Fine As-Is |
|---|---|
| **BP/EP ledger in `prepareDerivedData`** | Unique to DoDE's chargen system. No Foundry equivalent. Well-implemented with single-source-of-truth pattern. |
| **Character wizard as standalone ApplicationV2** | Correct architecture — a wizard is not a DocumentSheet (it has no document until the final step). No Foundry built-in wizard framework. |
| **3T6 attribute rolling** | Simple `new Roll("3d6").evaluate()` is the correct API. No need for a custom Roll subclass. |
| **FV-roll mechanic (fv-roll.mjs)** | Clean implementation of 1d20≤FV with confirmation rolls. The `rolls: [roll]` pattern on ChatMessage is correct for Dice So Nice integration. |
| **Damage roll + ABS deduction (damage-roll.mjs)** | Target-reading from `game.user.targets` is the standard Foundry pattern. |
| **Item type DataModels** (all 6) | All use `TypeDataModel` correctly. No `prepareBaseData` needed — there's nothing to clean up in the source data before AEs apply. |
| **The "one ras/yrke at a time" drop constraint** | Correct — enforced in `_onDrop`, which is the right place. |
| **Compendium build pipeline** (`npm run packs:pack`) | Standard Foundry CLI workflow. No change needed. |
| **CSS theming** (leather background, wood frame border-image) | Visual identity, not architecture. No Foundry system to migrate to. |
| **`specialAbilities` as ArrayField on actor** | These are narrative text entries, not mechanically-active effects. Until a proper ability table exists, ArrayField is simpler than creating a new Item type for what are currently just name+description pairs. When abilities gain mechanical effects, they should become Items with ActiveEffects — but that's a future phase, not a migration of something broken. |
| **`DODE.socialStandingTable` / `startCapitalTable` / etc. as JS arrays** | These involve arithmetic (roll + BP + caps), not simple dice→result lookups. RollTable can't express "2T6 + BP spent + half of social BP spent, capped at social total + 10". Keep as code. |

---

## Appendix A: Hardcoded Swedish Strings to Localize

These strings are user-visible but not in `lang/sv.json`:

**`scripts/apps/character-wizard.mjs`:**
- `STEP_LABELS` object (14 entries): "Kön", "Nivå", "Namn", "Ras", "Yrke", etc.
- `AGE_CATEGORIES` array: "Ung", "Mogen", "Medelålders", "Gammal"
- `KON_OPTIONS` labels: "Man", "Kvinna"
- `NIVA_OPTIONS` labels + descriptions (4 entries)
- Window title: `"Ny rollperson"` (line 114)
- Default actor name: `"Ny rollperson"` (line 659)
- Warning messages: `"Fyll i det här steget..."`, `"Inte tillräckligt med EP kvar..."`, `"Inte tillräckligt med startkapital kvar."`

**`scripts/documents/actor.mjs`:**
- Fallback attack name: `"Anfall"` (lines 15, 22)

**`scripts/sheets/actor-npc-sheet.mjs`:**
- Default attack: `"Nytt anfall"` (line 47)

**`scripts/helpers/config.mjs`:**
- `socialStandingTable` rank names (9 entries)
- `hjaltedadTable` names and notes (13 entries)
- `lifeGoals` (21 entries)
- `primarySkills` names (16 entries)

**Templates (`.hbs`):**
- `character-sheet.hbs`: "Färdigheter", "Ny färdighet", "Särskilda förmågor", "Ny förmåga", "Ålder", "Livsmål", "Ingen utrustning ännu...", etc.
- `npc-sheet.hbs`: "Namn", "SB", "Förfl.", "Moral", "Antal", "Hemvist", "Vanlighet", "Anfall", "Nytt anfall", "Färdigheter (fritext)", "Speciellt", "Beskrivning"
- `character-wizard.hbs`: extensive hardcoded Swedish in step descriptions, hints, labels, button text
- `damage-card.hbs`: "Inget mål valt — bruttoskada visad..."

**Impact:** This is a medium effort (~2 hours) with no gameplay risk. It's purely additive — add keys to `lang/sv.json`, replace strings with `game.i18n.localize()` calls. Enables future English localization.

---

## Appendix B: Prototype Token Defaults

Add to `system.json`:

```json
{
  "primaryTokenAttribute": "hp",
  "secondaryTokenAttribute": "resources.psy"
}
```

This tells Foundry which bars to display on tokens by default. `hp` shows the KP bar, `resources.psy` shows the PSY pool bar. Without this, tokens show no bars until manually configured per actor.

No `prototypeToken` block is needed in `system.json` for Foundry v12+; the `primaryTokenAttribute` / `secondaryTokenAttribute` fields handle it.
