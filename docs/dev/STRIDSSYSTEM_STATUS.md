# Stridssystemet — vad är faktiskt byggt vs. bara beskrivet

<!-- Läs detta INNAN du svarar på en regelfråga om strid, eller crediterar en yrkes-/rasförmågas
     text som levande spelbeteende. Rollpersonsguiden visar källciterad referenstext för MÅNGA
     förmågor som inte är kopplade till någon slag-/effektpipeline än. Att anta att beskriven text
     = byggd mekanik är ett upprepat felmönster (senast 2026-09-06, se ACTIVE_TASK.md/memory.md) —
     den här filen finns för att göra kollen snabb i stället för en backlog-dykning varje gång. -->

## Hur man kollar EN specifik förmåga snabbt

1. Hitta posten i `packs/yrken/_source/*.json` (`professionAbilities`) eller `packs/raser/_source/*.json`
   (`automaticAbilities`) eller `DODE.specialAbilitiesTable` (config.mjs).
2. Läs fältet `effect`. **`effect: null` = ren referenstext, ingenting i koden konsumerar den.**
3. Om `effect` är satt: matcha `effect.type` mot switch-satsen i `scripts/helpers/special-ability-effects.mjs`
   (`skillBonus` / `grantSecondary` / `yrkesUpgrade` / `costTierOverride` / `recoveryModifier` / `statModifier`).
   Det är HELA listan över effekttyper systemet kan verkställa idag — PSY-spend-vid-slag,
   skademultiplikatorer, initiativbonusar och situationella CL-bonusar finns INTE som en effekttyp alls än.

`docs/DESIGN_DECISIONS.md` backlog 70 gjorde redan en fullständig revision av alla 36 yrkens och 49
särskilda förmågors status (2026-08-17) — den här filen upprepar inte den genomgången, bara destillerar
den till en snabbtabell för stridsrelevanta mekaniker. Se backlog 70/71 för hela kategoriseringen och
`docs/dev/STRID_FLERHAND_ANVANDNINGSFALL.md` för Två vapen-designarbetet.

## Snabbtabell: implementerat vs. rent beskrivande

| Mekanik | Status | Var i koden / källa |
|---|---|---|
| Turordning (1T10+SMI) | **Implementerat** | `CONFIG.Combat.initiative` (`scripts/dode.mjs`). SLB s.15, fullt ersätter REG:s statiska SMI-jämförelse + vapenlängdsregel (CLAUDE.md avsteg-tabell, backlog 115). |
| Två vapen — "2 anfall" (atomär) | **Implementerat** | `scripts/rolls/dual-wield.mjs` (`resolveTwoAttacks`). RP s.59: svärdshand agerar först, sköldhand sist. |
| Två vapen — "anfall+parering" / "2 pareringar" | **Delvis** | Samma fil — själva slaget fungerar, men ingen handlingsekonomi-spärr håller reda på VILKEN handling som redan är förbrukad i rundan (backlog 32, ingen tracker byggd). |
| Ambidextriös skippar Två vapen-träning | **Implementerat** | `DODE.canDualWieldWithoutTraining` (config.mjs) — `swordHand === "ambidextrios"`. Se CLAUDE.md avsteg-tabell. |
| Dubbelhänt: ingen sämre hand (sköldhandens −10 CL slopas) | **Implementerat** (vid arkskapande) | `character-wizard.mjs` steg 6 (svärdshand-slaget). Dubbelhänt får INTE Ambidextriös genväg — måste fortfarande träna Två vapen. |
| Två vapen-kombinationens FV-tak / auto-BC | **Implementerat** | `DODE.twoWeaponCap`/`twoWeaponAutoBc` (config.mjs). |
| Perfekt anfall: rustningsabsorbering dras ej bort | **Implementerat** | Se "Strid"-regelsidan + CLAUDE.md avsteg-tabell (SLB s.17 text vs. s.31-diagrammet, texten valdes). |
| 3D-räckvidd (våningsplan/balkong) | **Implementerat** | `tokenDistance()` (anatomy.mjs) skickar äkta 3D-koordinater till `measurePath`; `attack.mjs`s räckviddskontroll nekar automatiskt närstrid mellan elevation-nivåer. |
| **Vapenmästarens "Spendera 5 PSY för en extra parering eller attack"** | **EJ implementerat** | `professionAbilities[0].effect: null` i `packs/yrken/_source/vapenmastare_dodeYkrigvapenma.json`. Ren referenstext i guiden. KH s.8-9. Ingen PSY-spend-kod finns i `attack.mjs`/`dual-wield.mjs` — inget hindrar eller beviljar det i spel, en SL måste döma det manuellt. |
| Krigare-linjens "+5 på alla initiativslag" | **EJ implementerat** | Samma `effect: null`-mönster. Skulle kräva att `CONFIG.Combat.initiative` blir per-aktör i stället för en global formel. |
| Övriga PSY-spend-vid-slag-förmågor (Tjuv/Fixare/Gillrare/Spelaren m.fl. CL-boostar) | **EJ implementerat** | Samma orsak — ingen effekttyp för "spendera resurs X för bonus Y vid ett specifikt slag" finns byggd. Backlog 70/71. |
| Bakhugg-skademultiplikatorer (Lönnmördare-linjen) | **EJ implementerat** | Ingen skademultiplikator-effekttyp i `attack.mjs`. Backlog 70. |
| Situationella CL-bonusar (~20 särskilda förmågor: Starka nypor, Stirrande blick, m.fl.) | **Medvetet oförändrat** | Kräver ett generellt "situationell CL-modifierare vid slagtillfället"-lager som aldrig byggts (skilt från det redan byggda GM-effekt-systemets `skillMod`/`clMod`/`recoveryMod`, som är tids-/scope-baserat, inte "vid just detta slag"). |

Tabellen är **inte** en fullständig revision — bara det jag stött på/verifierat medan jag byggde
Strid-regelsidan (backlog 115) plus det redan dokumenterade fyndet i backlog 70/71. Se backlog 70 för
den fulla genomgången av alla 36 yrken och 49 särskilda förmågor.

## Varför den här filen finns

2026-09-06: en fråga om hur många attacker en "multidextrös vapenspecialist som spenderar extra PSY"
kan utföra i en stridsrunda besvarades felaktigt — svaret ("PSY ger aldrig extra attacker") ignorerade
att Vapenmästarens egen, källciterade yrkesförmåga (synlig i guidens steg 9) uttryckligen säger motsatsen.
Boksvaret är **3 attacker** (2 via Ambidextriös dual-wield + 1 köpt för 5 PSY via Vapenmästaren) —
men **0 av dessa 3 är mekaniskt garanterade av systemet själv**, eftersom Vapenmästarens del av svaret
aldrig blivit kod. Två separata sanningar (vad boken säger, vad Foundry-arket faktiskt gör) blandades
ihop. Den här filen är till för att hålla dem isär snabbt, utan att behöva gräva i en 1800-radig
DESIGN_DECISIONS.md varje gång.
