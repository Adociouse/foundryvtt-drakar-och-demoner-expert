# PLAN_WIZARD_V2.md — Rollpersonsskaparen v2: mot bokexakt pipeline

> Genererad 2026-07-19, uppdaterad 2026-07-19 (samma dag, uppföljande session) efter att Fas 1 och Fas 2 implementerades och liveverifierades. Fasindelningen nedan omstrukturerades i denna uppdatering — se "Ändringslogg" — jämfört med den ursprungliga versionen. Bygger på källorna i Roll20-projektet: `docs/REGEL_Hjalte.md`, `docs/REGEL_SocialtStand.md`, `docs/wiki/REGLER_FARDIGHETER.md`, `docs/EXTRACT_Fardigheter_EP.md`, `docs/CHARACTERMANCER-WORKFLOW.md`, `docs/design/Dod Expert Character Generation Master Outline.md`.

---

## Ändringslogg

Ursprungsversionen av denna plan bakade in BP-ledgern i Fas 1 tillsammans med stegordning/nivåval, och lade Särskilda förmågor tidigt (Fas 2) och Öde-typer som en undernotis i Livsmål-fasen. Det visade sig i praktiken bättre att:

- Hålla Fas 1 smal (bara stegordning + nivåval) och ge BP-ekonomin en egen fas (nya Fas 2) — det gjorde båda lättare att liveverifiera isolerat.
- Slå ihop Socialt stånd och Startkapital till en fas (nya Fas 3) — de är matematiskt hopkopplade i RP s.27–28 (kapital-formeln refererar tillbaka till det sociala ståndsslaget) och går inte att verifiera meningsfullt var för sig.
- Dela upp gamla Fas 5 (Ålder) i två: attributmodifiering/kapitalmultiplikator (nya Fas 4) och EP-budget (nya Fas 5) — EP-poolen är ett tillräckligt separat delsystem för att förtjäna egen verifiering.
- Flytta Särskilda förmågor sent (nya Fas 8, inte gamla Fas 2) — den är blockerad av en forskningslucka (ingen tabell extraherad) och blockerar inget annat, så den vinner inget på att ligga tidigt.
- Ge HH Öde-typer en egen fas (nya Fas 10) istället för att gömmas som en undernotis i Livsmål — den är sitt eget källgap och sin egen leverabel.

Alla filreferenser och tekniska detaljer nedan är annars oförändrade från originalplanen där inte annat anges.

---

## Målbild

Slutgiltig stegordning i `character-wizard.mjs`s `STEPS`-array:

```js
const STEPS = [
  "niva",         // Hjälte-nivå: Vanlig / Extraordinär / Hjälte (+ ev. Öde-typ, se Fas 10)   — ✅ finns
  "grunder",      // Namn                                                                      — ✅ finns
  "ras",          //                                                                           — ✅ finns
  "yrke",         //                                                                           — ✅ finns
  "attribut",     //                                                                           — ✅ finns
  "formagor",     // Särskilda förmågor                                                        — Fas 8
  "socialt",      // Socialt stånd                                                             — ✅ finns
  "kapital",      // Startkapital (bas — åldersmultiplikator appliceras i nästa steg)           — ✅ finns
  "alder",        // Ålder: attributmod + kapitalmultiplikator + EP-budget låses upp            — ✅ steg finns, innehåll delvis (Fas 4/5)
  "fardigheter",  // BC-autotilldelning + EP-väljare                                            — Fas 6/7
  "livsmal",      // Livsmål                                                                    — Fas 9
  "utrustning",   // Utrustning (spenderar startkapital)                                        — Fas 9
  "granska"       //                                                                            — ✅ finns, byggs ut löpande varje fas
];
```

**Aktuellt läge (efter Fas 1+2+3):** `STEPS` i koden är `["niva", "grunder", "ras", "yrke", "attribut", "socialt", "kapital", "alder", "granska"]` — 9 steg. De återstående tre målstegen (`formagor`, `fardigheter`, `livsmal`/`utrustning`) läggs in av respektive fas nedan, i den ordning fasernas nummer anger (inte i STEPS-arrayens slutgiltiga inbördes ordning) — varje fas lägger in sitt steg på **rätt slutgiltiga position** direkt, inte som en stubb som flyttas senare. `formagor` (Fas 8) läggs in före `socialt` när den byggs, inte efter — den befintliga positionen av `socialt`/`kapital` ändras inte, bara skjuts ett steg bakåt i indexet.

**Not om ordningen:** yrke ligger före attribut (skiljer sig från Roll20-syskonprojektets `CHARACTERMANCER-WORKFLOW.md`). Det innebär att kravkontrollen i yrkessteget måste tåla att attributen ännu inte är slagna (löst i Fas 1, se nedan). Ålder ligger sent — direkt före färdigheter — eftersom ålder både låser upp EP-budgeten för färdighetsköpet OCH retroaktivt appliceras på attribut (redan slagna) och multiplicerar startkapitalet (redan grundberäknat). Medveten avvikelse, inte ett misstag.

---

## Genomgående principer för alla faser

1. **Varje fas är fristående skeppbar.** Wizarden ska gå att klicka igenom start-till-slut efter varje fas.
2. **Liveverifiera i en riktig Foundry-instans** innan en fas markeras klar (CLAUDE.md-arbetsflödet, steg 5). Fas 1 och 2 är liveverifierade genom hela klick-flödet, inklusive skapad Actor-data efteråt.
3. **Källciting i kod.** Varje ny tabell/formel får en kommentar med bokkälla (RP/REG/KH/HH + sidnummer). Där en fas bygger på en **förenkling eller olöst källkonflikt**, flagga det med `⚠` i koden, inte tyst gissning.
4. **Uppdatera `ACTIVE_TASK.md` och `memory.md`** efter varje fas, inte bara i slutet.

---

## Olöst källkonflikt som denna plan tar ställning till

**Socialt stånd:** `REGEL_SocialtStand.md` dokumenterar två oförenliga system — dagens (aldrig implementerade) 1T20/4-ståndssystem och RP s.27–28:s 2T6+BP/9-ståndssystem. Dokumentet drar själv slutsatsen: *"RP s.27–28 är auktoritativ för Expert."* **Denna plan väljer 2T6+BP-systemet (Fas 3)** och skriver bort 1T20-varianten.

---

## Öppna forskningsluckor — blockerar specifika faser

| Lucka | Blockerar | Var att slå upp |
|---|---|---|
| Exakt åldersmodifikationstabell på grundegenskaper | Fas 4 | RP s.24–25 (nämns som ⚠ i `config.mjs` redan för skadebonus/förflyttning) |
| HH "Öde-typer" (gudomligt öde/kosmisk relation) — ingen konkret tabell hittad | Fas 10 (hela fasen) | Hjältarnas Handbok, runt HH s.8/16/24 |
| Särskilda förmågor — fullständig tabell (bas + ras + yrke + magi) | Fas 8 | RP + REG, ospecificerat sidintervall — inte extraherat alls ännu |
| Strukturerade yrkesfärdighetslistor per yrke (12 / magiker 9) för alla yrken | Fas 6 | RP s.36 + KH — `CHARACTERMANCER-WORKFLOW.md:333-477` har 11 av dem, Expert-tilläggen (Gycklare/Jägare/Köpman/Pirat/Stråtrövare/Trollkarl) saknas |

---

# Fas 1 — Stegordning + Hjälte-nivåval ✅ KLAR

**Implementerat och liveverifierat.** Faktiskt byggd scope (smalare än originalplanens Fas 1 — BP-ledgern flyttades ut till Fas 2):

- [scripts/data/actor-character.mjs](scripts/data/actor-character.mjs): `niva`-fält (`StringField`, choices `vanlig`/`extraordinar`/`hjalte`, initial `vanlig`).
- [scripts/helpers/config.mjs](scripts/helpers/config.mjs): `DODE.bpByNiva = { vanlig: 125, extraordinar: 150, hjalte: 175 }` (KH s.3).
- [scripts/apps/character-wizard.mjs](scripts/apps/character-wizard.mjs): `STEPS` omordnad till `["niva","grunder","ras","yrke","attribut","alder","granska"]`; `NIVA_OPTIONS`-kortväljare; `#onSelectNiva`; `#checkRequirements` hanterar `null`-attribut som `unverified` (skiljt från `met`/`unmet`) eftersom yrke nu kommer före attribut.
- [templates/apps/character-wizard.hbs](templates/apps/character-wizard.hbs): nivå-steg, uppdaterad kravlista (tre tillstånd), Nivå-rad i granska.

**Liveverifiering (utförd):** klick-igenom alla 7 steg; nivå-val ändrar visad BP-siffra; kravkontroll visar `unverified` innan attribut slagits och `unmet`/`met` korrekt efteråt (testat med Tjuv/SMI 16-krav mot en rullad SMI 11 → "unmet", stämde).

---

# Fas 2 — BP-ekonomi (grundläggande ledger) ✅ KLAR

**Implementerat och liveverifierat.** Bygger BP-ledgern som senare faser (3, 8) hänger sina egna spend-kategorier på.

**Datamodell** ([scripts/data/actor-character.mjs](scripts/data/actor-character.mjs)):
```js
bp: new fields.SchemaField({
  spentRas: new fields.NumberField({ initial: 0, min: 0 }),
  spentFormagor: new fields.NumberField({ initial: 0, min: 0 }),
  spentSocialt: new fields.NumberField({ initial: 0, min: 0 }),
  spentKapital: new fields.NumberField({ initial: 0, min: 0 }),
  spentFardigheter: new fields.NumberField({ initial: 0, min: 0 })
})
```
`prepareDerivedData()` sätter `bp.start` (från `DODE.bpByNiva[niva]`), `bp.spent` (summan), `bp.remaining`.

**⚠ Medvetet beslut — inget "BP-köp av attribut":** RP:s källor (RP s.9, s.27–30) spenderar BP på ras, särskilda förmågor, socialt stånd och startkapital — **inte** på grundegenskaper, som slås fram med 3T6. Det finns ingen sourced BP-för-attribut-mekanik att bygga, så ingen sådan kategori finns i ledgern. Flaggat i kod (klassdokblock + schemakommentar i `actor-character.mjs`) ifall någon efterfrågar en alternativ attributgenereringsmetod senare (master outlinens "BP-buy attributes"-läge, som aldrig varit del av scopet här).

**Wizard** ([scripts/apps/character-wizard.mjs](scripts/apps/character-wizard.mjs)):
- `state.bp` med alla fem kategorier (bara `spentRas` skrivs till av något ännu).
- `#bpLedger()` — beräknar start/spent/remaining för visning, speglar DataModellens logik.
- `#onSelectRace` är nu `async` och sätter `state.bp.spentRas = raceDoc.system.bpCost` (ersätter, inte adderar — testat: byte Dvärg→Människa nollställer korrekt).
- Löpande BP-räknare i `.wizard-progress`-headern, synlig på **alla** steg.
- Granska-steget visar BP-nedbrytning (start per nivå / spenderat på ras / kvar).
- `#onCreateCharacter` skriver `system.bp` till den skapade Actor:en.

**Liveverifiering (utförd):** Vanlig→125 BP, Hjälte→175 BP; Dvärg (25 BP) → 150 kvar; omval till Människa (0 BP) → tillbaka till 175 (bekräftar icke-ackumulerande ersättning); granska-tabellen och header-räknaren stämde överens genom hela flödet; skapad Actor hade `system.bp = {spentRas:25, ..., start:175, spent:25, remaining:150}` — bekräftar att DataModellens egna `prepareDerivedData()`-beräkning (inte bara wizardens spegling) ger samma resultat. Inga konsolfel.

---

# Fas 3 — Socialt stånd + Startkapital (2T6+BP) ✅ KLAR

**Implementerat och liveverifierat.** Löser källkonflikten ovan — implementerar RP s.27–28:s 9-ståndssystem, inte 1T20-varianten.

**Datamodell** ([scripts/helpers/config.mjs](scripts/helpers/config.mjs), [scripts/data/actor-character.mjs](scripts/data/actor-character.mjs)):
- `DODE.socialStandingTable`/`DODE.socialStandingRank(total)` och `DODE.startCapitalTable`/`DODE.startCapitalLookup(total)` — exakt tabellerna från RP s.27–28.
- `socialStanding` (`roll`, `bpSpent`, härledda `total`/`rank`) och `startCapital` (`roll`, `bpSpent`, härledda `total`/`baseSm`; `finalSm` orörd, väntar på Fas 4).
- **Ändring mot originalplanen:** `bp.spentSocialt`/`bp.spentKapital` är INTE en separat skrivväg — `prepareDerivedData()` sätter dem varje gång från `socialStanding.bpSpent`/`startCapital.bpSpent`, så de två kan aldrig hamna i otakt (planens ord "kopplas till" tolkades som denna enkelriktade spegling, inte två oberoende fält som råkar hållas synkade manuellt).

**Wizard** ([scripts/apps/character-wizard.mjs](scripts/apps/character-wizard.mjs), [templates/apps/character-wizard.hbs](templates/apps/character-wizard.hbs)):
- `"socialt"`- och `"kapital"`-steg inlagda i `STEPS` mellan `attribut` och `alder` (målpositionen — `formagor` finns inte än, se Fas 8, och läggs in före `socialt` när den byggs).
- `#onRollSocialStanding`/`#onRollStartCapital` (2T6 via `Roll`), BP-spend-fält bundna via `change`-lyssnare i `_onRender` (samma mönster som `ageSelect` — `change` inte `input`, för att slippa tappa fokus/re-rendera på varje knapptryckning).
- `#socialStandingResult()`/`#startCapitalResult()` speglar DataModellens formler exakt för wizardens live-förhandsvisning, inklusive takregeln.
- Granska-steget visar Socialt stånd/Startkapital-rader och BP-nedbrytningen utökad med socialt/kapital-posterna.

**Sheet:** [templates/actor/character-sheet.hbs](templates/actor/character-sheet.hbs) — `system.socialStanding.rank` visas som en liten badge i identity-raden bredvid Ålder, bara när ett stånd faktiskt slagits fram.

**Liveverifiering (utförd):** Dvärg (25 BP) + 2T6=6 socialt stånd + 3 BP → total 9 → "Lägre medelklass" (stämmer mot RP s.27-tabellen, 8–11-intervallet). Startkapital 2T6=6 + 2 BP + halva 3 BP (avrundat uppåt=2) → total 10 → 1000 sm (8–11-intervallet). **Takregeln testad explicit:** höjde kapital-BP till 20 i samma session → rå summa 28 klipptes korrekt till taket (socialt total 9 + 10 = 19) → 3000 sm (17–22-intervallet), inte den okapade summan. BP-ledger stämde genom hela flödet (125→97→95). Skapad Actors `system.socialStanding`/`system.startCapital`/`system.bp` matchade wizardens visning exakt — bekräftar att DataModellens egna `prepareDerivedData()` ger samma resultat oberoende, inklusive `bp.spentSocialt`/`spentKapital`-speglingen. Sheet-badgen renderade korrekt. Noll konsolfel.

---

# Fas 4 — Ålder: attributmodifikationer + kapitalmultiplikator ✅ KLAR (kapitalmultiplikatorn — attributdelen förblir blockerad)

**Implementerat och liveverifierat:** kapitalmultiplikator-halvan (RP s.28, känd tabell). **Fortsatt blockerad:** attributmodifikations-halvan (RP s.24-25, forskningslucka) — infrastrukturen är på plats men tabellen är medvetet tom, ingen gissning.

**Datamodell** ([scripts/helpers/config.mjs](scripts/helpers/config.mjs), [scripts/data/actor-character.mjs](scripts/data/actor-character.mjs)):
- `DODE.ageCapitalMultiplier = { Ung: 1, Mogen: 1.5, "Medelålders": 2, Gammal: 2.5 }` (RP s.28) — implementerad, i bruk.
- `DODE.ageAttributeModifiers = {}` — medvetet tomt objekt med utförlig kommentar om forskningsluckan. `?? {}`/`?? 0`-fallback i både `prepareDerivedData()` och wizarden gör att `ageMod` blir `0` för alla åldrar, aktiveras automatiskt utan kodändring den dag tabellen fylls i.
- `prepareDerivedData()`: attributens `mod` uppdelad i `raceMod`/`ageMod`/`mod` (summan) för sty/fys/smi/int/psy/kar. STO får varken race- eller ageMod (oförändrat sedan tidigare — källan anger STO som ett intervall, inte en additiv modifierare).
- `startCapital.finalSm = Math.round(baseSm × DODE.ageCapitalMultiplier[alder])` — slutgiltigt belopp, beräknas bara när `capital.roll > 0`.

**Wizard** ([scripts/apps/character-wizard.mjs](scripts/apps/character-wizard.mjs), [templates/apps/character-wizard.hbs](templates/apps/character-wizard.hbs)):
- `#effectiveAttributes` tar nu emot `ageCategory` och beräknar `raceMod`/`ageMod`/`mod`/`modLabel` (t.ex. `"3 ras"`, framtida `"3 ras + 2 ålder"` när tabellen fylls i — sammansatt i JS, inte nästlade Handlebars-if:ar).
- `#startCapitalResult` beräknar `finalSm`/`capitalMultiplier` med samma formel som DataModellen.
- `"alder"`-steget visar nu startkapitalets multiplikation live, uppdateras direkt vid ålderbyte (`ageSelect`-lyssnaren anropar nu `this.render()`, vilket den inte gjorde innan Fas 4 eftersom ålder inte påverkade något synligt då).
- Granska-steget visar `baseSm × multiplikator = finalSm` istället för "ej tillämpad".

**Sheet:** ingen ändring gjord — `raceMod`/`ageMod` är alltid `0`/`X` respektive `0` just nu (tom tabell), så en separat sheet-visning av något som alltid är noll gav inget värde idag. `mod` (summan) visas redan korrekt utan ändring. Görs om/när `DODE.ageAttributeModifiers` faktiskt innehåller data.

**Liveverifiering (utförd):** alla fyra åldersmultiplikatorer testade explicit mot samma baseSm (1000 sm): Ung → 1000, Mogen → 1500, Medelålders → 2000, Gammal → 2500 — matchar RP s.28 exakt. Bekräftat att bytet av åldersgrupp uppdaterar förhandsvisningen live utan att behöva byta steg. Skapad Actors `system.startCapital.finalSm` matchade wizardens visning exakt (DataModellens egen beräkning, oberoende). Attributens `raceMod`/`ageMod`/`mod`-uppdelning verifierad på en skapad Actor (`sty: {raceMod:3, ageMod:0, mod:3, total:10}`). Noll konsolfel (en ostört "lost connection, reconnecting"-varning från en samtidig world-omstart utanför denna sessions kontroll, inget kodrelaterat).

---

# Fas 5 — EP-pool

**Beroende:** Fas 4 (ålder måste vara vald för tabellslagningen) + Fas 2 (BP-ledger, för leftover×5-konverteringen).

**Datamodell:**
- [scripts/helpers/config.mjs](scripts/helpers/config.mjs):
  ```js
  DODE.epBudgetTable = { // KH s.3 / RP s.28
    vanlig:        { Ung: 150, Mogen: 200, "Medelålders": 250, Gammal: 300 },
    extraordinar:  { Ung: 175, Mogen: 225, "Medelålders": 275, Gammal: 325 },
    hjalte:        { Ung: 200, Mogen: 250, "Medelålders": 300, Gammal: 350 }
  };
  DODE.maxStartFvTable = { // KH s.3
    vanlig:        { Ung: 13, Mogen: 15, "Medelålders": 17, Gammal: 19 },
    extraordinar:  { Ung: 15, Mogen: 17, "Medelålders": 19, Gammal: 20 },
    hjalte:        { Ung: 17, Mogen: 19, "Medelålders": 20, Gammal: 20 }
  };
  ```
- [scripts/data/actor-character.mjs](scripts/data/actor-character.mjs): `ep: { max, spent, remaining }` och `maxStartFv`, satta i `prepareDerivedData()`:
  `ep.max = DODE.epBudgetTable[niva][alder] + Math.max(0, bp.remaining) * 5` (RP s.28: *"Kvarvarande BP × 5"*).

**Wizard:** beräkna och visa `state.ep.max` i `"alder"`-steget (låst från denna punkt framåt).

**Verifiering:** verifiera EP-budget-beräkningen mot `REGEL_Hjalte.md`s tabell för alla 3×4 kombinationer av nivå/ålder.

---

# Fas 6 — Färdigheter, lager 1: BC-autotilldelning

**Beroende:** Fas 4 (slutgiltiga attribut).
**Kräver kompendiearbete**, inte bara kod (se forskningslucka-tabellen).

**Datamodell:**
- [scripts/data/item-yrke.mjs](scripts/data/item-yrke.mjs): nytt strukturerat fält `professionSkills: new fields.ArrayField(new fields.StringField())` vid sidan av den fria `skillList`-texten.
- **Kompendiedata:** uppdatera `packs/yrken/_source/*.json` per yrke med `system.professionSkills` — källa `CHARACTERMANCER-WORKFLOW.md`s `YRKEN`-objekt (11 av yrkena redan transkriberade där). Kör `npm run packs:pack` efteråt (Foundry nedstängd).
- [scripts/helpers/config.mjs](scripts/helpers/config.mjs): `DODE.primarySkills` — 16 poster `{ name, attribute }` från `REGLER_FARDIGHETER.md`.
- [scripts/data/item-fardighet.mjs](scripts/data/item-fardighet.mjs): `costTier: new fields.StringField({ choices: ["primar","yrkesfardighet","sekundar"] })` (ersätter/kompletterar dagens `yrkesfardighet`-boolean).

**Wizard:**
- Bygg ut `"fardigheter"`-steget: auto-generera primära (16 st) + yrkesfärdigheter vid `fv = DODE.attributeToGroup(effectiveAttribute)`.
- `#onCreateCharacter`: lägg de genererade färdigheterna i `itemsToCreate`.

**Sheet:** ingen strukturell ändring — dyker upp i befintlig färdighetslista.

**Verifiering:** skapa en Krigare med känd SMI/STY, bekräfta BC-värden manuellt.

---

# Fas 7 — Färdigheter, lager 2: EP-väljare ovanpå BC

**Beroende:** Fas 5 (EP-budget) + Fas 6 (BC-autotilldelning).

**Datamodell:**
- [scripts/helpers/config.mjs](scripts/helpers/config.mjs) (eller ny fil `scripts/helpers/skill-cost.mjs`):
  ```js
  // RP s.30 — verifierad mot bokens exempel (Klättra 4→10 = 12 EP)
  DODE.skillCostTierBase = { primar: 2, yrkesfardighet: 3, sekundar: 5 };
  DODE.skillCostCumulative = [0,1,2,3,4,5,6,7,8,9,10,12,14,16,18,21,24,27,31,35,39,44];
  DODE.skillCost = (costTier, fromFv, toFv) =>
    DODE.skillCostTierBase[costTier] * (DODE.skillCostCumulative[toFv] - DODE.skillCostCumulative[fromFv]);
  ```

**Wizard:** EP-köp-UI i `"fardigheter"`-steget: "+1 FV"-knapp per färdighet, grånad (inte hård spärr) om EP inte räcker eller FV skulle överstiga `maxStartFv`.

**Verifiering:** `DODE.skillCost("primar", 4, 10) === 12` (bokens exempel); max-FV-taket grånar knappen vid gränsen.

---

# Fas 8 — Särskilda förmågor (MVP)

**Beroende:** Fas 2 (BP-ledger — `spentFormagor` finns redan i schemat).
**Blockerad av forskningslucka:** ingen fullständig källtabell extraherad. MVP, inte den fullständiga bok-tabellen.

**Datamodell:**
```js
specialAbilities: new fields.ArrayField(
  new fields.SchemaField({
    name: new fields.StringField({ required: true, initial: "" }),
    source: new fields.StringField({ initial: "" }), // "bas"/"ras"/"yrke"/"hjalte"
    description: new fields.HTMLField({ initial: "" })
  })
)
```

**Wizard:** `"formagor"`-steg — fritext-lista, antal tillåtna slag styrs av nivå (`DODE.abilityRollsByNiva = { vanlig: 1, extraordinar: 2, hjalte: 3 }`, källa `REGEL_Hjalte.md`).

**Sheet:** ny sektion i `character-sheet.hbs` som listar `system.specialAbilities`.

**Verifiering:** Hjälte-karaktär kan lägga till 3 förmågerader.

---

# Fas 9 — Livsmål + Utrustning

**Beroende:** Fas 1 (nivå) för livsmål; Fas 3/4 (`finalSm`) för utrustning.

**Datamodell:**
```js
lifeGoal: new fields.StringField({ initial: "" })
```
(`destinyNote` hör till Fas 10, inte hit.) Ingen ny schema för utrustning — `vapen`/`rustning`-items har redan `price`.

**Wizard:**
- `"livsmal"`-steg: dropdown över `DODE.lifeGoals` (21 poster från `CHARACTERMANCER-WORKFLOW.md`) + fritext.
- `"utrustning"`-steg: kort-rutnät över `vapen-utrustning`/`rustning`-kompendierna, drar `price` från `state.startCapital.finalSm`.

**Sheet:** `lifeGoal` i biografisektionen. Utrustning dyker upp i befintlig Gear-lista.

**Verifiering:** listan har alla 21 livsmål; kapitalet minskar korrekt per köp, grånar vid otillräckligt kapital.

---

# Fas 10 — HH Öde-typer

**Beroende:** Fas 1 (nivåväljaren som denna fas utökar).
**Helt blockerad av forskningslucka:** ingen konkret Öde-typ-tabell hittad i `REGEL_Hjalte.md` — bara omnämnt som fritext-bullet ("gudomligt öde/kosmisk relation"). Denna fas kan inte byggas förrän HH s.8/16/24-området extraherats.

**Datamodell (när luckan är löst):**
```js
destinyType: new fields.StringField({ initial: "" }) // fritext tills tabellen finns, ⚠
```

**Wizard:** utöka `"niva"`-steget — när `state.niva === "hjalte"`, visa ett Öde-typ-val (Slumpens/Sann/Gudafödd eller vad källan faktiskt anger). Tills luckan är löst: håll som fritextfält, inte en påhittad lista.

**Verifiering:** kräver att forskningsluckan är löst först — ingen kod skrivs blint mot en gissad tabell.

---

## Beroendegraf (sammanfattning)

```
Fas 1 ✅ (stegordning + nivåval)
 └─→ Fas 2 ✅ (BP-ekonomi)
      ├─→ Fas 3 ✅ (socialt stånd + kapital) ──→ Fas 4 🟡 (kapitalmultiplikator klar, attributmod blockerad)
      │                                              │
      │                                              ├─→ Fas 5 (EP-pool) ──┬─→ Fas 6 (BC) ──→ Fas 7 (EP-väljare)
      │                                              │                     │
      │                                              └─→ Fas 9 (utrustning, kräver finalSm)
      ├─→ Fas 8 (särskilda förmågor)
      └─→ Fas 10 (HH Öde-typer, utökar nivåväljaren)

Fas 9 (livsmål-delen) kräver bara Fas 1.
Granska-steget byggs ut löpande i varje fas, inte som en separat slutfas.
```

## Fasöversikt (snabbtabell)

| Fas | Namn | Status | Nytt wizard-steg | Nya datamodellfält | Kompendiearbete? | Forskningslucka? |
|---|---|---|---|---|---|---|
| 1 | Stegordning + nivåval | ✅ Klar | `niva` | `niva` | Nej | Nej |
| 2 | BP-ekonomi | ✅ Klar | — (header-badge) | `bp.*` | Nej | Nej |
| 3 | Socialt stånd + startkapital | ✅ Klar | `socialt`, `kapital` | `socialStanding.*`, `startCapital.*` | Nej | Nej (löser konflikten) |
| 4 | Ålder: attributmod + kapitalmultiplikator | 🟡 Kapitalmultiplikator klar, attributmod blockerad | `alder` (byggs ut) | `raceMod`/`ageMod`, `startCapital.finalSm` | Nej | Ja (åldersmod-tabell, attributdelen) |
| 5 | EP-pool | Planerad | `alder` (byggs ut vidare) | `ep.*`, `maxStartFv` | Nej | Nej |
| 6 | Färdigheter lager 1 (BC) | Planerad | `fardigheter` | `item-yrke.professionSkills`, `item-fardighet.costTier` | Ja (yrken-kompendiet) | Delvis (Expert-yrken saknas) |
| 7 | Färdigheter lager 2 (EP) | Planerad | `fardigheter` (byggs ut) | — | Nej | Nej |
| 8 | Särskilda förmågor | Planerad | `formagor` | `specialAbilities[]` | Nej | Ja (full tabell) |
| 9 | Livsmål + utrustning | Planerad | `livsmal`, `utrustning` | `lifeGoal` | Nej | Nej |
| 10 | HH Öde-typer | Planerad | `niva` (byggs ut) | `destinyType` | Nej | Ja (hela fasen) |
