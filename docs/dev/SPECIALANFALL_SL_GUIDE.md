# Specialanfall — SL-guide för manuell upplösning

> Skapad 2026-08-04, del av GM-effekter/flerhandsstrid-planen (Part 6). Dessa specialanfall är fullt sourcade men **inte automatiserade** i systemet ännu — se `docs/DESIGN_DECISIONS.md` §3 för backlogpekaren. Tills vidare löser SL dem för hand enligt guiden nedan. Alla regler nedan är redan skrivna in i Roll20-projektets `docs/wiki/REGLER_STRID.md` under "Specialvapen — Regler"; den här filen är bara en spelbordsvänlig genomgång, inte en ny källa.

---

## Piska/Oxpiska — räckviddsavväpning (SB s.33)

En pisk-bärare kan försöka rycka ett enhandsvapen ur en motståndares hand på räckhåll, i stället för ett vanligt anfall.

1. **Måste uppges INNAN anfallsslaget** — spelaren deklarerar avväpningsförsöket, inte bara ett vanligt hugg.
2. Slå anfallsslaget som vanligt (kom ihåg: pareringsförsök mot piskan har CL halverat — samma Kättingvapen-regel).
3. Träffar anfallet **svärdsarmen**: slå **STY mot STY på Motståndstabellen**.
4. Försvararen förlorar: tappar sitt vapen, landar **1T4 rutor bort**.
5. Kom ihåg piskans egen självfummelrisk: ett anfallsslag på **18, 19 eller 20** är automatisk miss — slå 1T20, resultat högre än eget FV = fummel (ett rått 20 är alltid fummel).

## Bola — snärjning

1. Vid träff: slå normalt anfallsslag, sedan ett **FV-slag**.
2. **Lyckat FV-slag** → det avsedda händer:
   - Snärjd runt **ben** → målet faller omkull.
   - Snärjd runt **arm** → armen blir obrukbar (samma konsekvens som en skadad arm — tappar handens handling).
   - Snärjd runt **huvud** → omtumlad, **1T3 SR**.
3. **Misslyckat FV-slag** → 1T4 skada, ingen ytterligare effekt.
4. En snärjd arm/huvud tar **1T3 SR** att befria sig från.

## Lasso — omkullkastning

1. Vid träff: slå anfallsslag, sedan ett **FV-slag**.
2. **Lyckat FV-slag** → anfallaren slår **STY mot motståndarens medelvärde av STO och SMI** (Motståndstabellen) för att rycka omkull målet.
3. Lasso kastad kring **halsen** eller kring **två ben** dubblerar anfallarens STY i det slaget.
4. **Misslyckat FV-slag** → inget händer.

## Spjut mot springande varelser (RP)

- Ett spjut/långspjut kan "stoppas upp" mot en varelse som kommer springande — sätts i marken och spetsar varelsen på vapnet.
- Fungerar som ett vanligt anfall under **stridens FÖRSTA SR** — attacken gör vapnets normala skada plus målets skadebonus.
- Från och med SR 2 övergår man till att slåss som vanligt (ingen "uppstoppnings"-bonus längre).

## Spjutattack från galopperande häst (SB s.33)

*Generaliserad till ALLA kvalificerande vapen (inte bara spjut) av KH s.28, plus en fullständig mounted-combat-regeluppsättning (Rida-slag, avståndsvapenavdrag, slungas ur sadeln, manövrer, riddjurstabellen) — se den nya regelsidan **"Ridning &amp; riddjur"** i `regler`-kompendiet (backlog 118c, 2026-09-06) för hela bilden. Det här avsnittet står kvar som den ursprungliga, spjutspecifika SB-citeringen.*

- Kräver en ansats på **minst 15 meter**.
- Använd **hästens Skadebonus (SB)** i stället för ryttarens egen — hästens rörelseenergi driver stöten.
- Om skadan (inkl. hästens SB) övervinner den träffade ryttarens **STO** på Motståndstabellen: ryttaren vräks ur sadeln, kastas **1T4 meter**, och blir liggande.

## Drunkning (SLB s.22)

*Tillagd 2026-09-06, backlog 118 (Steg 2 av förflyttnings-/bördepasset). Fullt sourcad, MEDVETET inte automatiserad — se motiveringen nedan.*

Ordagrant, SLB s.22, "Skada av vatten":

> "Om man hamnar under vatten måste man försöka hålla andan tills man åter kan få luft. Efter cirka två minuter inträder medvetslöshet och efter ytterligare 1T3 minuter dör man av syrebrist. Om man räddas innan dess så drabbas man inte av några skador."

1. **~2 minuter under vatten:** inga skador alls, bara andhållning.
2. **Vid ~2 minuter:** medvetslös.
3. **+1T3 minuter till:** dör av syrebrist, om ingen räddar personen dessförinnan.
4. **Räddas personen när som helst innan döden inträffar:** noll skada, inga men.

Relaterat: **RP s.55** — man kan inte simma i NÅGON rustning (inte ens läder), oavsett buren vikt; i läderrustning håller man sig flytande i högst **FYS/2 minuter** innan den drar en under. ⚠ Boken ger ingen flyttid för tyngre rustningsklasser — outtalat, inte vår tolkning.

**Varför inte automatiserat:** till skillnad från gift/eld/blödning (som redan har en riktig periodeffekt-motor, `tickPeriodicEffect`, config.mjs) är drunkning ett sällsynt, SL-styrt narrativt förlopp snarare än något som normalt behöver tickas i bakgrunden under en pågående scen — samma "perfection is the enemy of the good"-avvägning som resten av förflyttningspasset. SL håller reda på tiden för hand med numren ovan; ingen egen Combat-/worldTime-krok byggd. **Byggd, mekaniskt genomdriven del:** `system.canSwim` (actor-character.mjs) visar redan en tydlig "Kan inte simma"-indikator på arket när rustning eller börda blockerar simning (se `docs/dev/SL_STRIDSGUIDE.md`) — bara själva UNDER VATTEN-nedräkningen är oautomatiserad.

---

> **Gift/periodiska effekter och HP/PSY-återhämtning utanför strid flyttat till `docs/dev/AATERHAMTNING_ANVANDNINGSFALL.md`** ("SL-rutin: Effekter och återhämtning utanför strid") — det är inte ett specialanfall, det är samma generella tidsflytt-mekanism som all annan återhämtning redan använder, så den hör hemma i återhämtningskatalogen i stället för här.

## Backlog — automatisering

Alla fem ovan är kandidater för att byggas in i `resolveAttack()`/en dedikerad handlingsekonomi den dag den finns (`docs/DESIGN_DECISIONS.md` §3, samma post som Vapentekniker-automatiseringen). Ingen av dem kräver ny källforskning — bara implementation.
