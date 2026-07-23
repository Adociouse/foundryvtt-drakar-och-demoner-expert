# Architecture & Rulebook-Traceability Audit — Drakar och Demoner Expert (Foundry System)

> Read-only audit. No implementation files were modified to produce this document.
> Audited state: working tree as of 2026-07-21 (includes uncommitted changes to `character-wizard.mjs`, `actor-character.mjs`, `config.mjs`, `character-wizard.hbs`, and four new `assets/niva-*.png` files — this is the Fas 10 "öde-typer" correction described in `PLAN_WIZARD_V2.md`).
> Cross-referenced against: `docs/wiki/REGLER_*.md`, `docs/REGEL_*.md`, `docs/SPELDATA.md`, `docs/REGLER_README.md` in the Roll20 sibling project, and the character-generation master outline in the `dode-chargen` sibling project.

---

## 1. Executive Summary

This is a small (≈3.5k LOC), architecturally clean Foundry v14 system built entirely on modern `DataModel`/`ApplicationV2` patterns with no bundler and no legacy `template.json`. Discipline is unusually high for a project this size: derived-value formulas are computed once in each `DataModel.prepareDerivedData()` and *deliberately re-derived* (not duplicated via copy-paste) in the character-creation wizard for live preview, rule deviations are marked with `⚠` comments pointing at book+page, and three living status files (`ACTIVE_TASK.md`, `memory.md`, `PLAN_WIZARD_V2.md`) track phase-by-phase provenance in a way that makes this audit possible at all.

The core open architectural question — *opinionated combined ruleset vs. configurable Expert engine* — is not yet a real fork in the road, because the system is still small enough that both paths remain open. Today the system is a **single opinionated ruleset with visible seams**: every deviation is flagged, but there is no data structure that lets a GM disable a supplement or that lets code branch on "is Krigarens Handbok active." The book-mixing is a *design decision recorded in prose* (`REGLER_README.md`), not yet a *queryable fact in the data model*. Section 8 below proposes a minimal `RuleProfile` layer to close that gap before more supplements (Alver, Magikerns Handbok, Tjuvar och Lönnmördare) are added, at which point silent mixing becomes much harder to audit than it is today.

The single largest correctness risk found is not architectural but factual: **the source project itself documents an unresolved two-book conflict on the BP economy and age-modifier tables** (RP/Bok I "Rollpersonen" vs. the older Expert/Zot "REG" system give materially different numbers for BP-per-age and attribute age-modifiers). The implementation has picked one side (RP) and flagged it, which is the right call, but three of the four "niva" tiers' BP/EP/max-FV numbers are explicitly unsourced extrapolations, not verified book values — see the traceability matrix (§4) and §5 for the full list.

No automated tests exist. No migration scripts exist. `system.json` still contains three placeholder `TODO` URLs and references a `CHANGELOG.md` that does not exist. These are all cheap to fix and are listed in the Critical/Important backlog (§9).

---

## 2. Architecture Diagram and Component Responsibilities

```
system.json ─── manifest: documentTypes, esmodules=[scripts/dode.mjs], packs[5], compatibility{min:12, verified:14}
     │
     └─→ scripts/dode.mjs (entry point)
           Hooks.once("init"): binds CONFIG.DODE, CONFIG.Actor/Item.dataModels, registers sheets
           Hooks.on("renderActorDirectory"): injects wizard-launch button (⚠ v13.333 sidebar risk, §7)
           exposes game.dode.openCharacterWizard()
              │
              ├─→ scripts/helpers/config.mjs — CONFIG.DODE constants (attributes, tables, costs)
              │     rulebook-sourced tables + inline ⚠-flagged deviations (single source of truth
              │     for every formula table used by both DataModels and the wizard)
              │
              ├─→ scripts/data/*.mjs — DataModel schemas (Actor: character, npc; Item: fardighet,
              │     ras, yrke, vapen, rustning, besvarjelse)
              │     prepareDerivedData() computes KP, ABS, damageBonus, movement, BP/EP ledgers,
              │     social standing, start capital — reads CONFIG.DODE tables
              │
              ├─→ scripts/documents/actor.mjs — DoDEActor: rollSkill/rollAttack/rollWeaponDamage/
              │     castSpell — thin orchestration, delegates dice logic to scripts/rolls/*
              │
              ├─→ scripts/rolls/fv-roll.mjs, damage-roll.mjs — pure dice mechanics
              │     (1d20≤FV roll-under, confirmation rolls on nat-1/nat-20, damage−ABS)
              │
              ├─→ scripts/sheets/*.mjs + templates/*.hbs — ApplicationV2 character/NPC/item sheets
              │     read-mostly views onto DataModel-computed values; BP/EP breakdowns are
              │     wizard-only, not shown post-creation (gap, §6)
              │
              ├─→ scripts/apps/character-wizard.mjs + templates/apps/character-wizard.hbs —
              │     standalone ApplicationV2 (not a document sheet), 14-step guided creation flow.
              │     Re-derives every DataModel formula in parallel (#bpLedger, #epResult,
              │     #effectiveAttributes, #skillPreview, #equipmentResult) for live preview
              │     before an Actor document exists to compute against.
              │
              └─→ packs/<name>/_source/*.json — compendium source (git-diffable), compiled via
                    npm run packs:pack (foundryvtt-cli, Node-only tooling, not part of system runtime)
```

**Data flow for character creation** (the most complex path in the system): wizard state (`state.*`, in-memory only) → wizard's own re-derivation functions compute preview values identical in formula to the DataModel → on "granska"/finish, `#onCreateCharacter` calls `Actor.create()` with `system.*` fields and `createEmbeddedDocuments()` for skills/equipment → the real `DataModel.prepareDerivedData()` runs independently server-side and (per `PLAN_WIZARD_V2.md`'s live-verification logs) has been repeatedly checked to produce identical numbers to the wizard's preview. This dual-computation is a deliberate, documented tradeoff (class doc-block in `character-wizard.mjs`) rather than an oversight — it exists because `ApplicationV2` wizards have no backing document to read derived data from until creation completes. It is also the single largest "keep these two formulas in sync by hand" liability in the codebase; see §7.

---

## 3. Dependency and Data-Flow Analysis

- **No external runtime dependencies.** `package.json`'s only dependency is `@foundryvtt/foundryvtt-cli`, used exclusively by `scripts/build/*.mjs` for `packs:unpack`/`packs:pack`. The system itself loads as raw ES modules via Foundry's `esmodules`, confirmed against `system.json`.
- **Internal coupling is centralized correctly through `CONFIG.DODE`.** Every table (BP by tier, EP budget, max start FV, skill cost curve, age modifiers, damage bonus, movement) lives once in `config.mjs` and is read by both the DataModel and the wizard — there is no second copy of table *data*, only of the *formulas that consume it* (previous paragraph).
- **Actor → Item coupling**: `ras`/`yrke` are enforced single-embed via custom `_onDrop` (max one of each) rather than a schema constraint — this is sheet-layer enforcement, not data-layer, so a document created via macro/API could still embed two `ras` items without validation. Not a bug today (no such path exists in the UI) but a latent gap if compendium-driven automation is added later.
- **Compendium → DataModel coupling**: `item-yrke.professionSkills` and `item-ras.attributeMods` are read into wizard state at selection time and copied into the created Actor's embedded skill items — there is no live reference back to the compendium after character creation (correct behavior for a snapshot-style character sheet, but means compendium edits never retroactively affect existing characters, worth noting for anyone expecting "linked" items semantics).
- **Cross-project dependency**: the system's rules are sourced from a sibling repo (`Drakar och Demoner Expert Roll20`) that is *not* part of this git repository and not vendored in any form (no submodule, no copied doc snapshot). Traceability today depends entirely on inline `⚠`/citation comments in this repo plus tribal knowledge of where the sibling repo lives. If that sibling repo moves, is renamed, or becomes unavailable, the citations in this codebase become unverifiable without the audit trail this document now provides.

---

## 4. Rulebook-to-Code Traceability Matrix

Book codes: **RP** = Bok I Rollpersonen, **REG** = D&DE Regler (older Expert/Zot system), **KH** = Krigarens Handbok, **HH** = Hjältarnas Handbok, **MAG** = D&DE Magi.

| Rule area | Source book | Source page | Implementation file | Status | Notes |
|---|---|---|---|---|---|
| Skill/attribute roll mechanic | RP/REG | RP s.28-30, REG s.15-43/47-63 | [fv-roll.mjs:11](scripts/rolls/fv-roll.mjs) | **Exact** | 1d20≤FV; nat-1 forces perfekt (re-roll ≤FV), nat-20 forces fummel (re-roll >FV). Matches curated doc exactly. |
| KP (hit points) formula | RP | not page-cited in curated doc; `SPELDATA.md:301` flags itself "★ verifiera" | [actor-character.mjs:192](scripts/data/actor-character.mjs) | **Exact formula, unverified citation** | `KP = round((STO+FYS)/2)`. The *formula* matches the curated doc verbatim, but neither the curated doc nor SPELDATA.md pins an exact RP page for it — the page citation itself is the gap, not the number. |
| Damage bonus (SB) | RP | RP s.25 (⚠ "exakta gränsvärden bör verifieras") | [config.mjs](scripts/helpers/config.mjs) `damageBonusTable`/`damageBonus()`; [actor-character.mjs:198](scripts/data/actor-character.mjs) | **To verify** | STY+STO table-driven; source doc itself flags exact breakpoints as unverified against the original book — this flag was correctly carried into the code comment. |
| Movement | RP | RP s.24-25 (⚠ "exakta gränsvärden") | [config.mjs](scripts/helpers/config.mjs) `movementTable`/`movement()` | **To verify** | `floor((SMI+FYS+STO)/3)` table lookup; same unverified-breakpoints caveat as above, correctly flagged in code. |
| Armour absorption (ABS) | REG (combat) | REG s.47-63, table REG s.53 | [actor-character.mjs:216-217](scripts/data/actor-character.mjs), [damage-roll.mjs:10](scripts/rolls/damage-roll.mjs) | **Exact (whole-body variant)** | ABS = max (not sum) of equipped body armor, explicitly matches "grundsystem" in `REGLER_STRID.md` (per-body-part is the documented "alternativa" system, not implemented — correct choice, but worth naming in-code that the alternate system was consciously not built). Damage = weapon+SB−ABS, floored at 0: matches. |
| BP economy (flat 125, tiers 150/175/200) | KH vs. REG (**two-book conflict**) | KH s.3 (vanlig=125 only); REG/Expert Regler s.8 gives an *age-dependent* 160/220/280/340 model instead | [config.mjs:56-63](scripts/helpers/config.mjs) `bpByNiva` | **Partial / Confirmed unsourced for 3 of 4 tiers** | Only `vanlig:125` is a confirmed KH s.3 citation. `slumpens-hjalte:150`, `sann-hjalte:175`, `gudafodd:200` are explicitly commented as placeholders from merging HH's narrative öde-typer onto KH's numeric BP scale — **this merge is a project decision with no book basis for the resulting numbers**, not a simplification of an existing table. The REG age-dependent BP model (160/220/280/340) was not adopted at all and is not referenced anywhere in code — worth an explicit note that it was considered and rejected, not missed. |
| EP conversion (unspent BP × 5) | RP | RP s.28 | [actor-character.mjs:182-189](scripts/data/actor-character.mjs) `ep.max` calc | **Exact** | `ep.max = epBudgetTable[niva][alder] + max(0, bp.remaining) * 5`. Matches curated doc's explicit "Kvarvarande BP × 5" line verbatim. Live-verified against 12 niva×alder combinations per `PLAN_WIZARD_V2.md` Fas 5. |
| EP budget table (niva × age) | KH/RP | KH s.3 / RP s.28 | [config.mjs:132-139](scripts/helpers/config.mjs) `epBudgetTable` | **Partial** | Same issue as BP: only the `vanlig` row is sourced; the other 3 tiers are placeholders inherited from the same unsourced merge. |
| Max start FV (skill cap) | KH | KH s.3 | [config.mjs:156-162](scripts/helpers/config.mjs) `maxStartFvTable` | **Partial** | `gudafodd` row is an explicit unsourced extrapolation per in-code comment; other three rows presumed sourced (not independently re-verified by this audit). |
| Skill EP cost curve | RP | RP s.30, verified against book example (Klättra 4→10 = 12 EP) | [config.mjs:207-212](scripts/helpers/config.mjs) `skillCostCumulative`/`skillCost()` | **Exact** | Cumulative-cost table with per-tier base multiplier (primar×2, yrkesfardighet×3, sekundar×5); the book's own worked example was used as a unit-test-equivalent check and passed exactly. Highest-confidence formula in the codebase. |
| Age → attribute modifiers | RP vs. REG (**two-book conflict**) | RP s.24-25 curated variant vs. Expert Regler s.8 variant; `REGLER_README.md` itself states "arkets siffror matchar inte RP s.28" | [config.mjs] `ageAttributeModifiers`, [actor-character.mjs] `ageMod` | **Unverified / ambiguous at the source level** | Only Ung and Gammal rows are filled (`sty:-1,sto:-1,smi:1,psy:1` / `sty:-2,sto:-1,int:1,psy:2,smi:-1`); Mogen and Medelålders are empty objects (→ always `ageMod:0`). Per `PLAN_WIZARD_V2.md` Fas 4, the source project's own two candidate tables (RP-curated vs. Expert-Regler-curated) disagree with each other, and the README flags neither as fully matching RP s.28. This is a **source-material gap**, not an implementation shortcut — code cannot be more correct than the ambiguous source. Flag for the project owner to resolve via physical book, not further OCR grep. |
| Start capital (2d6+BP, social standing) | RP | RP s.27-28 | [config.mjs] `socialStandingTable`/`startCapitalTable`, [actor-character.mjs:150-169](scripts/data/actor-character.mjs) | **Exact** | Includes the "+10 over social total" cap rule, live-verified explicitly including the cap-triggering edge case (`PLAN_WIZARD_V2.md` Fas 3). Deliberately chose the RP 2d6+BP/9-tier system over an older, never-implemented 1d20/4-tier system per `REGEL_SocialtStand.md`'s own conclusion that RP is authoritative — correctly documented decision, not a coin flip. |
| Start capital age multiplier | RP | RP s.28 | [actor-character.mjs] `startCapital.finalSm` | **Exact** | ×1/1.5/2/2.5 for Ung/Mogen/Medelålders/Gammal, live-verified against baseSm=1000 for all four ages, matches exactly. |
| Öde-typer (fate/hero tiers) | HH | HH pp.37-39 ("Hjältens roll" / "Öden och livsmål") | [config.mjs] `niva` choices, [character-wizard.mjs] `NIVA_OPTIONS`, [actor-character.mjs] `niva` field | **Exact (narrative), Missing (mechanical), Confirmed error in book has only 3 tiers not 4** | HH describes **three** narrative tiers (Slumpens hjälte / Sann hjälte / Gudafödd hjälte) with **no mechanical effect** — confirmed independently by both source-material research in this audit and the project's own `memory.md`/`PLAN_WIZARD_V2.md` Fas 10 log. The implementation merges this 3-tier *narrative* axis with KH's separate 3-tier *numeric* BP axis (vanlig/extraordinär/hjälte) into a single 4-slug UI picker (`vanlig`/`slumpens-hjalte`/`sann-hjalte`/`gudafodd`) — **this is a project-invented 4th mechanical tier with no book basis**, clearly flagged in-code and in `PLAN_WIZARD_V2.md`'s "Korrigering 2026-07-21" section. Note: an earlier same-day implementation attempt fabricated actual mechanical effects (rerolls, elemental resistance, "heroic stand at 1 HP") under a non-book term "Slumpens Leksakare" — this was caught and fully reverted before commit; the current working tree reflects the corrected version. The 1d10 random-tier-selection table (60/30/10% per HH) exists in source material but is **not implemented** — tier is always player-chosen, no dice option offered. |
| Magic cost / PSY | MAG | MAG/REG s.63-66 (casting), SPELDATA.md:302 (PSY=raw attribute) | [documents/actor.mjs:48-69](scripts/documents/actor.mjs) `castSpell()` | **Simplification, explicitly flagged** | CL = S − 2×(E−1) where **S is the spell's tabulated school value, not the caster's personal skill value** — the in-code comment (actor.mjs:42-47) explicitly names this as a known simplification, and this audit's source research confirms these are genuinely different quantities in the books. Cost: perfect→max(1,floor(E/2)), success/fumble→E, failure→0 — matches MAG s.63-66's per-effect-grade PSY cost model. PSY-max = raw PSY attribute: matches SPELDATA.md:302 exactly. Snedtändningstabellen (magic fumble table) triggers only a chat notice, is not mechanically automated — documented gap, not silent. |
| Attribute generation | RP/REG | RP s.9, REG s.5-6 | [character-wizard.mjs] "attribut" step | **Exact** | 3d6 per attribute (STY/FYS/SMI/INT/PSY/KAR), 2d6+6 for STO — matches both curated sources, which agree with each other here (unlike the age-modifier and BP tables above). |
| Special abilities | RP/REG (formal table exists) | RP+REG, table found only in raw OCR (`docs/extracts/D&DE I_-_Rollpersonen_w_text.txt`), not yet in any curated `docs/wiki/` doc | [actor-character.mjs] `specialAbilities` ArrayField, [character-wizard.mjs] "formagor" step | **Missing (MVP freetext, confirmed gap)** | A real 2d20+BP random-table mechanic with named abilities *does exist in the source material* (this audit located it in the raw OCR — see §6), but was never transcribed into a curated doc, so the implementation correctly could not build against it and instead ships free-text slots (count only, by tier — `abilityRollsByNiva`). This is the right call given the state of the source docs, but it is now actionable: the table exists and could be transcribed in a future session. |
| Weapon/armor/spell/race/profession compendium coverage | RP/KH/MAG/Alver/Tjuvar och Lönnmördare | various | `packs/*/_source/*.json` | **Missing (partial, by design)** | See §6 for exact counts. Confirmed representative-sample status, matches `ACTIVE_TASK.md`'s own claims exactly (verified by direct file count in this audit, not just trusting the doc). |
| Shield-specific combat mechanics (extra parry, 1/20 break chance) | REG combat | REGLER_STRID.md | [item-rustning.mjs] | **Missing** | Shield items exist as a slot type but the parry-bonus and break-chance mechanics referenced in the combat doc are not modeled anywhere in code. |

---

## 5. Exact Matches, Interpretations, Simplifications, and Confirmed Errors

**Exact matches (formula verified against book text/example, high confidence):**
- Skill/attribute roll-under-1d20 mechanic with nat-1/nat-20 confirmation rolls
- KP formula (though its page-citation is unverified — the *number* is right, the *citation* is soft)
- EP conversion ×5 rule
- Skill EP cost curve (validated against the book's own worked example)
- Social standing / start capital 2d6+BP system including the "+10 cap" edge case
- Start capital age multiplier
- Attribute generation dice (3d6, 2d6+6 for STO)
- Armour absorption model (max, not sum, matching the documented "grundsystem" not the "alternativa" per-body-part variant)

**Deliberate, correctly-flagged simplifications:**
- Spell CL uses tabulated school value instead of personal skill value (`actor.mjs:42-47`)
- Öde-typer collapsed into the niva picker as a project decision, not a book requirement (fully documented in `PLAN_WIZARD_V2.md`'s "Korrigering" section)
- Profession skills limited to concretely-named entries; choice-based/broad-category entries ("Tala språk (max 2)", "Alla strid utom Judo och Karate") excluded rather than guessed
- No "choose 12 of N" formal-profession-skill gate — MVP grants BC on every matched skill instead
- Snedtändningstabellen (magic fumble) is a chat notice only, not a resolved table roll
- NPC damage bonus/movement are free text, not formula-derived (correctly, since monster stat blocks don't follow the PC progression)

**Confirmed source-level ambiguities correctly surfaced, not silently resolved:**
- BP economy: RP/KH flat-with-tier model vs. REG age-dependent model — implementation picked RP/KH and flagged it
- Age attribute modifiers: two disagreeing curated candidate tables, README itself says neither matches RP s.28 cleanly — implementation ships a partial table (2 of 4 age rows) rather than guessing the other 2

**Confirmed project-introduced (not book-sourced) numbers, requiring owner attention:**
- `bpByNiva` for `slumpens-hjalte`/`sann-hjalte`/`gudafodd` (150/175/200) — invented by extrapolating KH's numeric scale onto HH's narrative tiers, no book basis
- `epBudgetTable` and `maxStartFvTable` rows for the same three tiers — same root cause
- `abilityRollsByNiva.gudafodd: 4` — explicit unsourced extrapolation

**A caught-and-reverted error worth naming explicitly** (not present in current code, but worth recording so it isn't reintroduced): an earlier same-session implementation attempt invented mechanical effects for öde-typer (reroll-once-per-session, spend-1-EP-to-stay-conscious-at-1KP, elemental resistance dropdown) under a fabricated term "Slumpens Leksakare" that does not appear in any source book. This was fully identified and removed before this audit. It is a useful case study for why the `⚠`-flagging convention and the "carry the flag, don't guess" rule in `CLAUDE.md` exist — the fabrication happened specifically in the one area where the source table was genuinely hard to find (OCR damage), and was caught by re-reading the source rather than by tests (there are none — see §7).

---

## 6. Missing Rules and Incomplete Compendia

Confirmed by direct file count against `packs/*/_source/`:

| Pack | Count in repo | Approx. book total | Coverage |
|---|---|---|---|
| `raser` | 7 | 7 base + 11 Alv subraces documented in source (Alver supplement) | Base races complete, zero subraces |
| `yrken` | 11 | 11 base + ~25 supplement specializations (Krigare×8, Tjuv×8, Lönnmördare×5, Bard×4, from KH/Tjuvar och Lönnmördare) | Base professions complete, zero specializations |
| `vapen-utrustning` | 33 (weapons + armor combined) | ~60 weapons alone per `ACTIVE_TASK.md` | ~30-50% depending on how armor is counted against the weapon-only estimate |
| `besvarjelser` | 8 | "150+" across 13 magic schools per source docs (one school alone, Elementarmagi, lists ~45 spells) | Low single-digit percent |
| `monster` | 14 | not enumerated in source docs reviewed | Unknown total, but 14 is clearly a curated sample, not a bestiary |

**Formally missing rule systems** (not partial — entirely unbuilt):
- Special abilities random table (2d20+BP mechanic located in raw OCR only, not yet in a curated doc — see §4)
- Choose-12-of-N formal profession skill selection (MVP grants all matched skills instead)
- Shield parry bonus / 1-in-20 break chance
- Snedtändningstabellen resolution (currently a chat notice, not a rollable table)
- Alv subraces (11), warrior/thief/assassin/bard specializations (~25 total)
- Automated attack→damage roll chaining (two independent clicks today)
- Distance/movement modifiers on attack rolls
- Assassin backstab (no-SB) special handling
- English localization (`lang/` has only `sv.json`)
- Active Effects integration — all bonuses computed manually in `prepareDerivedData()`; noted in `ACTIVE_TASK.md` as something to reconsider once equipment/spell bonus-stacking is needed

---

## 7. Foundry v14 Risks and Technical Debt

A prior internal audit (`PLAN_V14.md`, root) already covers this ground; this audit's independent grep confirms its findings rather than duplicating the search from scratch:

- **Confirmed clean**: no hits for `game.data`, `Actor.data.data`, unqualified `mergeObject`, sync `TextEditor.enrichHTML`, or `Application` (v1) base class anywhere in the codebase.
- **Confirmed deprecated-but-working**: global `renderTemplate` (should be `foundry.applications.handlebars.renderTemplate`) at [fv-roll.mjs:31](scripts/rolls/fv-roll.mjs) and [damage-roll.mjs:12](scripts/rolls/damage-roll.mjs); global `TextEditor.getDragEventData` (should be `foundry.applications.ux.TextEditor.implementation`) at `actor-character-sheet.mjs` (line number drifted since `PLAN_V14.md` was written — file has grown; re-grep before fixing). Both are namespace migrations, not functional breaks — low urgency but should be swept before the "verified" compatibility bump moves past 14.
- **Unresolved, not yet live-verified**: [dode.mjs:74-86](scripts/dode.mjs) manually queries `.directory-header .action-buttons` on the core Actor Directory DOM to inject the wizard-launch button. The sidebar was rewritten to `ApplicationV2` in v13.333; whether this selector still matches has not been confirmed in a live v14 client per this repo's own tracking docs. This is the single highest-risk item in the v14 compatibility surface because a silent failure here (button never appears) would not throw a console error — it would just quietly not work. Recommend migrating to the documented `getHeaderControlsActorDirectory` hook, which is the supported v13+ extension point for exactly this use case.
- **`.sheet.render(true)` and `Hooks.once("init", ...)` patterns**: confirmed still valid under ApplicationV2/v14, no action needed — flagged in `PLAN_V14.md` only for completeness, not as real risk.
- **No automated tests, no CI**: every "verified" claim in `PLAN_WIZARD_V2.md` is a manually-executed, manually-logged click-through session. This has worked so far because of unusually disciplined logging, but it does not scale, and it means a regression in, say, `#skillPreview`'s formula vs. `prepareDerivedData()`'s formula would only be caught by a human noticing a number looks wrong. Given that dual-computation is architecturally required (§3), a small unit-test suite asserting `wizard preview === DataModel result` for a matrix of niva×age×race combinations would directly target the one place this codebase is most likely to silently drift.
- **`system.json` hygiene**: `authors[0].url`, `url`, `manifest`, and `download` are all literal `https://github.com/TODO/...` placeholders despite the repo actually being hosted at `github.com/Adociouse/foundryvtt-drakar-och-demoner-expert` per `memory.md`. `changelog` points to a `CHANGELOG.md` that does not exist in the repo root. `compatibility.maximum` is unset. None of these affect runtime behavior today, but they will surface as broken links the moment this system is ever installed from a manifest URL by an end user (the project's own stated distribution goal, per `ACTIVE_TASK.md`'s "Nästa steg" §8).
- **No migration scripts**: `system.json`'s `version` is `0.1.0` and there is no `scripts/migrations/` directory. This is appropriate for pre-1.0 greenfield work but should be established before the first real-world save file exists, since two DataModel fields already changed shape mid-project (`item-fardighet.yrkesfardighet` boolean → `costTier` enum; `niva` choices going from 3 to 4 slugs in the current uncommitted diff) — anyone who created a character under the old 3-tier `niva` schema before this session's changes now has data that doesn't match the new `choices` list, with no migration to reconcile it.

---

## 8. Recommended Target Architecture — the RuleProfile Question

**Direct answer: today this is an opinionated combined ruleset, and that is the correct state for its current size — but it is approaching the point where an explicit `RuleProfile` layer would pay for itself.**

The case *against* building it right now: there are only two Actor subtypes, six Item subtypes, and one active supplement's worth of content (Krigarens/Hjältarnas Handbok material folded into the base game). Every rule-source decision so far has been resolvable with a single `⚠` comment and a line in `ACTIVE_TASK.md`. Building a configuration layer for a single fixed configuration is speculative generality the project's own stated engineering principles (see `CLAUDE.md`'s adjacent guidance against premature abstraction) would reasonably reject.

The case *for* building it soon: the project's own backlog (`ACTIVE_TASK.md` "Nästa steg" §5) explicitly names Alv subraces, warrior/thief/assassin/bard specializations, and (per `CLAUDE.md`) partial Magikerns Handbok/Alver/Tjuvar och Lönnmördare content as next expansion targets. Each of those is a genuine supplement with its own book-page provenance, and at least one (Krigarens Handbok's BP-tier table vs. Hjältarnas Handbok's narrative öde-typer) has *already* produced exactly the kind of silent-merge ambiguity a RuleProfile is meant to prevent — the four-tier `niva` picker **is** an undeclared book-mixing decision baked directly into a `StringField`'s `choices` list, with no record anywhere in the data model of which book each choice came from or that two books were merged to produce it. Today that provenance lives only in a markdown comment in `PLAN_WIZARD_V2.md`, which a future contributor has no obligation to read before adding a fifth tier.

**Minimal RuleProfile layer, sized to not overshoot the project's current scale:**

1. **A metadata sidecar, not a new document type.** Rather than wrapping every rule in a heavyweight system, attach a small metadata object to each rule *table* already living in `config.mjs` (BP tiers, EP budget, max FV, skill costs, age modifiers, etc.):
   ```js
   // Attached per-table, not per-value — keeps the win-to-effort ratio favorable
   DODE.ruleMeta.bpByNiva = {
     source: { vanlig: "KH s.3" }, // only keys with real citations present
     unsourced: ["slumpens-hjalte", "sann-hjalte", "gudafodd"],
     requiresModules: ["hjaltarnas-handbok"], // for tiers beyond "vanlig"
     replacesRule: null,
     implementationStatus: "partial" // "exact" | "partial" | "extrapolated" | "missing"
   };
   ```
   This alone would have made the BP/EP/maxFV extrapolation issue in §4 visible in `CONFIG.DODE` at runtime (inspectable in the console, surfaceable in a GM-facing settings UI) instead of only in a markdown file three folders away.

2. **A world-setting for active modules, warnings not hard locks** — matching the owner's stated preference. A single `game.settings.register("drakar-och-demoner-expert", "activeModules", {type: Array, default: ["expert","krigare"]})` (or similar) that the wizard and sheets *read* to decide which niva tiers, professions, and compendium packs to surface, defaulting to today's exact behavior. Selecting an inactive module's content (e.g. picking a Krigare specialization without Krigarens Handbok "enabled") should produce a visible UI warning banner, not a blocked action — this matches the explicit direction from the project owner and avoids building enforcement logic the project doesn't need yet.

3. **Compendium items carry the same metadata, cheaply.** `item-yrke.mjs`/`item-ras.mjs` already have room for one more optional field: `sourceBook` (KH/HH/RP/Alver/etc.) and `requiresModule`. This is a few lines per DataModel, not a redesign, and immediately makes "what would turning off Krigarens Handbok remove" a filterable query instead of a manual compendium audit.

4. **Explicitly do not build**: a rule-execution engine, a plugin/hook system for third-party supplements, or per-rule enable/disable toggles finer than "module." Those are the kind of speculative generality that would be premature at 6 Item subtypes and 5 packs. The goal of this layer is *traceability and warning surfacing*, not a general rules framework — if the project later grows to genuinely support mutually exclusive supplement combinations (e.g. two different combat systems active at once), that's a bigger redesign this minimal layer does not need to anticipate today.

**Where to start, concretely**: add `ruleMeta` to the four tables already flagged with `⚠` extrapolations in `config.mjs` (§4/§5's "confirmed project-introduced numbers" list) as the first slice — that's the exact set of values this audit found to be the highest-risk silent-mixing case already in production, so it's also the cheapest place to prove the pattern before deciding whether to roll it out further.

---

## 9. Prioritised Backlog

**Critical** (correctness/data-integrity risk, cheap to fix):
1. Fix `system.json` placeholder URLs (`authors[0].url`, `url`, `manifest`, `download`) to point at the real `github.com/Adociouse/foundryvtt-drakar-och-demoner-expert` repo, or remove them until a release pipeline exists.
2. Create `CHANGELOG.md` or remove the `changelog` key from `system.json` — currently a broken reference.
3. Add a data migration (or at minimum a documented manual-fix note) for the `niva` field's 3-tier→4-tier `choices` change — any Actor created before this session's uncommitted work has a `niva` value that may no longer be a valid choice.
4. Resolve or explicitly accept the BP/EP/maxFV placeholder numbers for `slumpens-hjalte`/`sann-hjalte`/`gudafodd` (§4, §5) — either find the real HH source, or mark them permanently as "house rule, not book rule" in a way visible outside code comments (first candidate for the RuleProfile metadata in §8).
5. Live-verify the `renderActorDirectory` DOM-selector risk (§7) in an actual v14 client — this is the one item in the v14 audit that could fail silently.

**Important** (real gaps, not urgent):
6. Migrate `renderTemplate`/`TextEditor.getDragEventData` to their namespaced v13+ equivalents (§7) — low urgency but easy, do it as one small PR.
7. Build a small assertion/test harness that checks `wizard preview === DataModel prepareDerivedData()` output across a matrix of niva×age×race, targeting the dual-computation drift risk named in §3/§7 — this is the highest-leverage single test given the architecture.
8. Live click-through verification of Fas 4 (age attribute modifiers) per `PLAN_WIZARD_V2.md`'s own open item — static review only has been done as of this audit.
9. Decide and document whether the REG age-dependent BP model (160/220/280/340) is permanently rejected or a future alternative — currently only implicitly abandoned.
10. Transcribe the special-abilities 2d20+BP table from the raw OCR (`docs/extracts/D&DE I_-_Rollpersonen_w_text.txt`) into a curated `docs/wiki/` doc in the sibling project — this unblocks turning the current free-text MVP into the real mechanic, and the table has now been located (§4/§6), which it wasn't before this audit.
11. Start the RuleProfile metadata sidecar (§8) on the four already-flagged tables before adding the next supplement (Alv subraces or profession specializations), since that's exactly the scenario that will make the current silent-merge pattern repeat.

**Optional** (deliberate scope, revisit opportunistically):
12. Expand compendium coverage (weapons, spells, races, professions) — already tracked in `ACTIVE_TASK.md`, no new finding here beyond the exact counts in §6.
13. Active Effects refactor for stacking equipment/spell bonuses, once a second bonus source beyond race/age exists (already flagged in `ACTIVE_TASK.md`).
14. English localization — explicitly low priority per the project's own docs, no reason to disagree.
15. Automated attack→damage roll chaining, shield parry/break mechanics, assassin backstab handling, distance/movement attack modifiers — all confirmed-missing combat refinements (§6), none blocking current playability.
