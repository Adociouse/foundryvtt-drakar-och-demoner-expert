# Data Model & Architecture

> Living reference — regenerate/update this when the shape of the code changes, don't let it drift into fiction. Read `CLAUDE.md` first for the project's actual authoritative status source (`docs/DESIGN_DECISIONS.md`); this file exists purely to make the *shape* of the data model visible at a glance, since the code alone gets hard to hold in your head once two systems start looking similar but aren't.

Last drawn: 2026-07-31 (session 21, backlog 7 + 36). Covers the Actor/Item data model and, in particular, the two modifier pipelines that are easy to conflate: attribute bonuses (old, ActiveEffect-driven) and skill modifiers (new, plain-data and live-read).

---

## 1. Document classes

Three Foundry core documents are subclassed; everything else is a `TypeDataModel` registered against one of the two document classes. `DoDeItem` is the newest of the three, added in session 21 purely to time-box a bonus when equipment gets worn.

```mermaid
flowchart LR
  subgraph core["Foundry core"]
    Actor
    Item
    ActiveEffect
  end
  Actor --> DoDEActor["DoDEActor
scripts/documents/actor.mjs
rollSkill · consumeItem · castSpell"]
  Item --> DoDeItem["DoDeItem
scripts/documents/item.mjs
_preUpdate: equip-activation timing"]
  ActiveEffect --> DoDeActiveEffect["DoDeActiveEffect
scripts/documents/dode-active-effect.mjs
shouldApplyChange: equipped/condition gate"]
```

| Type key | DataModel | Registered on | Carries `skillModifiers`? |
|---|---|---|---|
| `character` | `actor-character.mjs` | `CONFIG.Actor.dataModels` | — |
| `npc` | `actor-npc.mjs` | `CONFIG.Actor.dataModels` | — |
| `handlare` | `actor-handlare.mjs` | `CONFIG.Actor.dataModels` | — |
| `fardighet` | `item-fardighet.mjs` | `CONFIG.Item.dataModels` | no — read target, never written |
| `formaga` | `item-formaga.mjs` | `CONFIG.Item.dataModels` | yes — always active |
| `utrustning` | `item-utrustning.mjs` | `CONFIG.Item.dataModels` | yes — equipped-gated, timed, consumable |
| `vapen` | `item-vapen.mjs` | `CONFIG.Item.dataModels` | shape ready, unused today |
| `rustning` | `item-rustning.mjs` | `CONFIG.Item.dataModels` | shape ready, unused today |
| `ras` / `yrke` | `item-ras.mjs` / `item-yrke.mjs` | `CONFIG.Item.dataModels` | attributeMods only, via AE |
| `besvarjelse` / `minibesvarjelse` | `item-besvarjelse(-mini).mjs` | `CONFIG.Item.dataModels` | spellEffect, own pipeline |

---

## 2. What an Actor owns

A `character` Actor embeds items of eight types, plus transient ActiveEffects. Race and profession are singular by convention (the sheet swaps them on drop, see `actor-character-sheet.mjs#onDropItem`); everything else can repeat. Fields shown are the ones relevant to this diagram, not the full schema — see each `item-*.mjs` for the rest.

```mermaid
erDiagram
  ACTOR {
    string documentType "character | npc | handlare"
    object attributes "sty fys smi int psy kar sto"
    array specialAbilities "name source description slotId"
    object skillModifierTotals "GETTER, summed on every read"
  }
  RAS {
    object attributeMods "per-attribute delta"
    array effects "transfer AE, gated on nothing"
  }
  YRKE {
    array professionSkills "named or choiceCount slots"
    string baseProfession "groups specialisations"
  }
  FARDIGHET {
    string skillKey
    number fv "EP-bought base"
    number bonus "manual, player-edited"
    number total "fv + bonus, derived only"
    string costTier "primar | yrkesfardighet | sekundar"
  }
  FORMAGA {
    string origin "bas | ras | yrke | hjalte"
    array skillModifiers "skillKey,value pairs"
    string specialAbilitySlot "flag: stable slotId tag"
  }
  VAPEN {
    boolean equipped
    string damage
    array skillModifiers "unused today"
  }
  RUSTNING {
    boolean equipped
    number abs
    array skillModifiers "unused today"
  }
  UTRUSTNING {
    boolean equipped
    array skillModifiers "NEW 2026-07-31"
    number chargesRemaining "null = unlimited"
    number activationSeconds "null = permanent while worn"
    boolean consumable
    array effectChanges "AE defs, dollar-CHOICE placeholder"
  }
  BESVARJELSE {
    array spellEffect
    number spellDuration
  }

  ACTOR ||--o| RAS : "embeds 0..1"
  ACTOR ||--o| YRKE : "embeds 0..1"
  ACTOR ||--o{ FARDIGHET : "embeds many"
  ACTOR ||--o{ FORMAGA : "embeds many"
  ACTOR ||--o{ VAPEN : "embeds many"
  ACTOR ||--o{ RUSTNING : "embeds many"
  ACTOR ||--o{ UTRUSTNING : "embeds many"
  ACTOR ||--o{ BESVARJELSE : "embeds many"
```

---

## 3. The two modifier pipelines

This is the part that got complex enough to need drawing. Both pipelines end up adding a number to something on the Actor, but they get there by completely different means, and neither writes into the other's territory.

```mermaid
flowchart TD
  subgraph A["PIPELINE A — attribute bonus (ActiveEffect-driven)"]
    direction TB
    A1["ras / vapen / rustning item
owns a transfer:true ActiveEffect"]
    A2["DoDeActiveEffect.shouldApplyChange()
gate: equipped, condition flag"]
    A3["Foundry's own AE pipeline writes
actor.system.attributes.X.bonus"]
    A4["prepareDerivedData()
total = value + bonus
group = attributeToGroup(total)"]
    A1 --> A2 --> A3 --> A4
  end

  subgraph B["PIPELINE B — skill modifier (plain data, live-read)"]
    direction TB
    B1["formaga / utrustning item
system.skillModifiers[] — plain data, no AE"]
    B2["skillModifierTotals GETTER
formaga: always on
equipment: equipped AND worldTime lt activeUntil"]
    B3["consumed at read time only:
rollSkill() adds it to item.total
sheet shows skill.effectiveTotal"]
    B1 --> B2 --> B3
  end
```

> **The one rule that matters:** `fardighet.total` (`fv + bonus`) never changes because of a skill modifier. The two numbers are only ever added together at the moment something is rolled or displayed — not stored, not merged, not written back.

> **Why B is a getter, not a field:** a value written during `prepareDerivedData()` only updates when that document is itself created, updated, or deleted. It does not update when `game.time.worldTime` advances on its own. A cached "does Duntofflor's 30-minute window still apply" would go stale the moment nobody touched the actor. Core's own `ActiveEffect#duration`/`#active` avoid this by being real getters too — Pipeline B copies that pattern deliberately. See `DESIGN_DECISIONS.md` §6 for the full write-up of the bug this fixed.

Backlog 7 is only half-closed by this: `formaga` and `utrustning` are wired into Pipeline B because they're the two source types that actually have content today. `ras`/`yrke` could carry the same `skillModifiers` field the day something like Skogsalv's +10 CL Gömma sig needs it — no further architecture required, just the field and the content.

⚠ Not yet diagrammed as its own pipeline (pre-existing gap, not new tonight): a **parallel, structurally-identical** mechanism, `statModifiers` (`{stat: "hp.max"|"psy.max", operation, value}`), consumed by `actor-character.mjs`'s `#applyStatModifiers` — same item-scan-plus-`equipped`/`activationSeconds`-gate shape as Pipeline B above, just targeting a derived resource field instead of a named skill's total. `item-formaga.mjs` has carried it since the ras/yrke abilities pass (backlog 70/71); `item-utrustning.mjs` gained it 2026-08-22 (a wearable "+3 PSY" staff, live-demo loot) — the consumer already scanned `utrustning`-typed items, only the schema field was missing.

---

## 4. From table row to formaga item

A särskild förmåga starts as one row in `DODE.specialAbilitiesTable` (`config.mjs`). Rows with an `effect` resolve into a `formaga` item feeding Pipeline B; the other 34 of 49 rows are still pure flavor text.

```mermaid
sequenceDiagram
  participant Table as specialAbilitiesTable
  participant UI as wizard step / "Slå fram"
  participant Resolver as special-ability-effects.mjs
  participant Actor

  UI->>UI: roll 2d20 + spent BP
  UI->>Table: match row by range
  Table-->>UI: name, description, effect?
  opt effect.pool is set
    UI->>UI: ask player for the choice(s)
  end
  UI->>Resolver: resolveGrants(effect, choices)
  Resolver-->>UI: skillModifiers[], fardighetSeeds[]
  UI->>Resolver: applyResolvedAbility(actor, slotId, ...)
  Resolver->>Actor: ensure each seed exists as fardighet (fv 0)
  Resolver->>Actor: create/update ONE formaga item, tagged flags.specialAbilitySlot = slotId
  Note over Actor: Pipeline B picks this up on the very next read — no further wiring needed
```

`slotId` — not the row's array index — is what ties a formaga item back to its slot, because both the wizard's slot list (shrinks on a level drop) and the sheet's ability list (grows/shrinks freely) can reorder. Re-rolling a slot replaces its formaga item in place; removing a slot prunes the orphan without ever touching the fardighet it seeded (`pruneOrphanedAbilityGrants`).

---

## 5. A timed, charge-limited bonus in practice

Runas Duntofflor (`packs/magiska-foremal/_source/`) was the test case for Pipeline B's hardest edge: a bonus that should fade a fixed time after equipping, without the item ever being taken off.

```mermaid
sequenceDiagram
  participant Player
  participant Item as utrustning item
  participant Hook as DoDeItem._preUpdate
  participant Getter as skillModifierTotals

  Player->>Item: update( equipped: true )
  Item->>Hook: intercepted before write
  alt chargesRemaining > 0
    Hook->>Item: flags.activeUntil = worldTime + activationSeconds
    Hook->>Item: chargesRemaining -= 1
  else chargesRemaining is 0
    Hook->>Item: no new window — still wearable, just inert
  end
  Note over Getter: every read compares worldTime to activeUntil — the bonus can lapse mid-wear, with nothing re-equipped
```

---

## 6. File map

| Path | What lives there |
|---|---|
| `scripts/data/actor-character.mjs` | the two skillModifier getters; attribute bonus aggregation; `effectiveResistances` getter (2026-09-05 — merges the actor's own rarely-used `system.resistances` with resistances carried by owned `formaga` items, same live-getter shape as `skillModifierTotals`) |
| `scripts/data/item-formaga.mjs` | `skillModifiers` field, "always active" source; `resistances` field (2026-09-05, backlog 88 — Kaos Väktare's magical tattoos, reuses `fields-resistances.mjs`'s shared shape rather than inventing a fourth modifier pipeline) |
| `scripts/data/item-utrustning.mjs` | `skillModifiers`, `statModifiers` (2026-08-22 — hp.max/psy.max add/multiply, same shape and consumer as `item-formaga.mjs`'s, see below), `chargesRemaining`, `activationSeconds`, `consumable`, `effectChanges` |
| `scripts/documents/item.mjs` | `DoDeItem` — equip-activation timing hook |
| `scripts/documents/dode-active-effect.mjs` | `DoDeActiveEffect` — Pipeline A's equip/condition gate |
| `scripts/documents/actor.mjs` | `rollSkill` (reads Pipeline B), `consumeItem`, `castSpell` |
| `scripts/helpers/special-ability-effects.mjs` | `resolveGrants` / `applyResolvedAbility` / `pruneOrphanedAbilityGrants` |
| `scripts/helpers/config.mjs` | `DODE.specialAbilitiesTable`, the 15 annotated `effect` rows |
| `packs/magiska-foremal/_source/` | Runas Duntofflor, Drakpotion — the two proof-of-concept items |

---

Drawn from the codebase as of commit `9519137` (backlog 7 + 36). If you're reading this after several more sessions of skill-modifier or ActiveEffect work, check `git log -- scripts/data/actor-character.mjs scripts/documents/item.mjs` before trusting the diagrams above — regenerate rather than patch piecemeal once the pipelines change shape again.
