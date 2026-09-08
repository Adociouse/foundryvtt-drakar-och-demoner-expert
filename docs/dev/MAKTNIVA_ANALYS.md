# Maktnivå-analys — varför DoDE-rollpersoner tenderar bli mer episka än D&D-rollpersoner

> Skriven 2026-09-08, som svar på Johans fråga efter hjältepoäng-spenderingsfönstrets bygge: *"Based on the rules so far it feels like DoDe is more powerful heroic charecters with much more potential than normal English D&D?"* **Ren reflektion — ingen kodändring, inget beslut att verkställa.** Sparad ändå, eftersom slutsatsen är grundad i konkreta mekanikjämförelser som är värda att ha kvar när frågan kommer upp igen (t.ex. vid balansdiskussioner eller när nytt HH/KH-innehåll portas).

## Slutsatsen, kort

Ja, iakttagelsen stämmer — men inte för att DoDE:s siffror i sig är större. Det är att **DoDE (1991, BRP/percentil-släkt, inte klass-och-nivå) aldrig byggde D&D:s balansspakar över huvud taget.** D&D:s maktnivå hålls nere av mekanismer som DoDE saknar helt; DoDE:s motsvarande tillväxt är kontinuerlig och SL-medierad i stället för stegvis och regelmässigt spärrad. Fyra konkreta observationer, alla direkt ur regeltexten (inte tolkning):

## 1. Grundegenskaperna har inget tak

`docs/DESIGN_DECISIONS.md` backlog 46 (HH s.20/46-48), ordagrant citerat: **"förbättra grundegenskaper — 5 HP per poäng (ej STO), obegränsat och permanent, bara mellan äventyr."** Just byggt i `apps/hero-points.mjs`#`onImproveAttribute` — koden har medvetet INGEN övre gräns, bara STO undantaget.

D&D: `20` är hårdtaket för de flesta rollpersoner, `24` med ett Epic Boon-feat som i sig är låst till nivå 20 (av 20). Ett hårt, regelmässigt satt tak som kräver att spelet först tar dig till den absoluta toppen innan taket ens går att röra.

## 2. Kraftfulla förmågor är slumptabellsresultat, inte nivålåsta unlocks

`CONFIG.DODE.specialAbilitiesTable` (RP s.25-27, 49 rader) ger redan vid ROLLPERSONSSKAPANDET saker som "Vapenmästare" (+5 CL med alla vapen), "Osårbarhet" (immun mot icke-magiska vapen) eller "Magisk immunitet" — bara ett lyckträff på tärningen bort, inte en funktion av hur långt man kommit i kampanjen.

De två NYA tabellerna som just byggdes i den här sessionen (`CONFIG.DODE.heroicAbilitiesTable`/`heroicAbilitiesTableDark`, HH s.10-15/45-51, 35+35 rader) lägger till ett HELT PARALLELLT lager av samma sort — köpbart repeterat genom hela kampanjen mot hjältepoäng, inte en engångsgrej.

D&D:s motsvarighet (legendariska föremål, epic boons, höga subclass-features) är strikt CR-/nivågaterad och sällsynt by design — hela poängen med bounded accuracy är att en sådan boost aldrig ska kunna dyka upp "för tidigt".

## 3. Handlingsekonomin kan staplas utan spärr

Avstegstabellens rad om Vapenmästarens PSY-köpta bonusattacker (KH s.8-9), Johans uttryckliga beslut 2026-09-06: **"Take it literally, 3 attacks, no restriction"** — och uttalat att stapling utöver det (10 PSY = 2 köpta) INTE är förbjudet av texten. `DODE.grantBonusAction`/`getBonusActions` (config.mjs) har inget hårdkodat tak; själva handlingsekonomin (backlog 32) är fortfarande obyggd, så ingenting i koden ens FÖRSÖKER spärra det.

D&D:s Extra Attack-progression (1→2→3→4 attacker) är strikt klasslåst till specifika nivåer (5/11/20) och kan bara nås av EN klass (Fighter) vid toppen. Handlingsekonomin (en Action, en Bonus Action, Reactions) är själva ryggraden i spelets balans — DoDE har ingen motsvarande spärr att bygga en balansmodell kring.

## 4. Färdigheter kan passera sitt eget "tak" genom spel, inte bara träning

RP s.63: primära färdigheter och yrkesfärdigheter kan passera sin grundegenskaps FV-tak, men BARA genom äventyrserfarenhet — aldrig genom ren träning (`apps/training.mjs`s `skillCap`, `hard`-flaggan). Det är i sig en spärr, men den är mjuk och SL-medierad, inte en global spelmekanisk broms — och när grundegenskapen SJÄLV kan höjas obegränsat (punkt 1), flyttar taket med.

## Nyansen — det handlar inte om att DoDE "är mäktigare"

D&D:s hela designfilosofi (bounded accuracy, CR-matematik, sällsynta feats, strikt klasslåst handlingsekonomi) finns för att en Dungeon Master ska kunna räkna ut en rimlig utmaning matematiskt. DoDE (och BRP-släkten i stort) bygger i stället på att SL:n själv modererar bordet — reglerna sätter sällan en hård, systemisk broms, för att systemet aldrig var designat kring en sådan broms i första läget. Effekten blir densamma vid bordet (rollpersoner kan bli väldigt episka väldigt "opredicerbart"), men orsaken är strukturell frånvaro av spärrar, inte att DoDE:s siffror i sig är tilltagna.

Och genretiteln säger det rakt ut: **Hjältarnas Handbok** — "Heroes' Handbook" — är den bok hela den här sessionens arbete (hjältepoäng, hjälteförmågor) kommer ifrån. Den döljer inte att den vill göra rollpersoner till legender; den är title-drop-explicit om det på ett sätt D&D:s kärnböcker (som håller episk makt till en enda, sen bok — Epic Boons i DMG) inte är.

## Källor

- `docs/DESIGN_DECISIONS.md` — avstegstabellen ("Vapenmästarens '5 PSY → extra attack/parering'…"), backlog 46/20 (hjältepoäng-grenarna)
- `scripts/apps/hero-points.mjs`, `scripts/helpers/config.mjs` (`heroicAbilitiesTable`/`heroicAbilitiesTableDark`/`specialAbilitiesTable`) — den här sessionens bygge
- Roll20-projektets `docs/extracts/HH_Hjaltarnas_Handbok_extract.md` §7/§8/§19 — HH:s egen hjältepoängs- och hjälteförmågetext
