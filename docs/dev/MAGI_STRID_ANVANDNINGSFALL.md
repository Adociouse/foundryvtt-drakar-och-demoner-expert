# Magi, drycker och stridseffekter — 15 användningsfall (design-underlag, INTE byggt än)

> Skapad 2026-08-21. Syfte: samma sak som `STRID_FLERHAND_ANVANDNINGSFALL.md` gjorde för flerhandsstrid — ett käll-förankrat facit att bygga och regressionstesta den kommande besvärjelse-/drycksupplösningen mot, INNAN koden skrivs. Johan: *"get into the spells, potions, magical and maybe other effects in a fight... make sure we have some good use cases."*
>
> **Status på motorn idag** (`documents/actor.mjs`): `castSpell(item, effektgrad)` löser bara **CL-slaget och PSY-kostnaden** (MAG s.8-13: `CL = S − 2×(E−1)`, PSY = E vid lyckat/fummel, halva E vid perfekt). Den **applicerar ingen effekt alls** — ingen skada, ingen läkning, ingen statuseffekt, ingen måltilldelning. `applySpellEffect(item, target)` finns som en fristående, körbar STUB (skapar en riktig `ActiveEffect` av `item.system.spellEffect`, en lista `{key,mode,value}`-changes mot `.bonus`-fält) men är **medvetet inte** ihopkopplad med `castSpell()` — "måltilldelning/träfflogik är fas 6+", en kommentar skriven för flera sessioner sedan. `consumeItem(item)` (drycker/`utrustning.consumable`) fungerar identiskt — en riktig `ActiveEffect` av `system.effectChanges`, samma `.bonus`-begränsning.
>
> **Innehållsläget är den verkliga överraskningen.** `packs/besvarjelser` har **222 riktiga, sourcade besvärjelser** över alla 13 skolor — inklusive exakta träffar på varenda exempel Johan gav (se nedan) — men **INGEN enda av dem** har `spellDuration`/`spellEffect` ifyllt. Katalogen finns, den mekaniska datan gör det inte. Samma mönster som NPC-migreringen (backlog 75) och ras-/yrkesförmågorna (backlog 71/72) redan visat: innehåll som är "lat skapat", inte saknat.
>
> **Källa för alla siffror/citat nedan:** `docs/wiki/MAGI.md` (Roll20-projektet), självt sourcat mot `Formelboken` s.1-65 — läst i sin helhet för det här dokumentet, inte gissat.

---

## Vad som REDAN finns och är återanvändbart — läs detta innan något nytt föreslås

- **`castSpell()`s CL/PSY-mekanik** (documents/actor.mjs) — färdig, oförändrad för alla 15 fallen nedan. Det som saknas är ALLTID "vad händer VID ett lyckat slag", aldrig slaget självt.
- **`applySpellEffect()`/`consumeItem()`s ActiveEffect-mönster** — täcker redan Grupp F (attributbuffar/-nedsättningar) rakt av, bara aldrig testat i strid eller kopplat till en riktig kastning.
- **Flermåls-loopen** (`attack-dialog.mjs`s `#targetTokens()`, byggd i Områdeseffekter del 1, 2026-08-19) — exakt samma mönster ett flermåls-besvärjelse (Grupp D) behöver: läs `game.user.targets`, loopa, ett resultat per mål.
- **Foundrys statuseffekt-toggling** (`actor.toggleStatusEffect()`) — redan använt för blind/sleep/paralysis/frozen/restrain i `PARRY_BLOCKING_STATUSES` (attack-dialog.mjs). En besvärjelse som "förlamar" behöver bara ANROPA samma primitiv — ingen ny statuskatalog.
- **Periodeffekt-systemet** (`config.mjs`s `addPeriodicEffect`/`removePeriodicEffect`, GM-effektfönstrets bulk-verktyg) — täcker redan skada-över-tid (gift). Ett "Neutralisera gift"-besvärjelse (UC-M4) blir ett ANROP till `removePeriodicEffect`, ingen ny datamodell.
- **Spelar-anfall-planens godkännande-mönster** (Fas A+B, samma session) — en spelare som kastar Blindhet på en SL-ägd NPC har EXAKT samma permission-problem som en spelare som anfaller en NPC med ett vapen: skriver `target.toggleStatusEffect(...)`/`target.update(...)` utan ägarskap. Samma "beräkna lokalt, posta direkt, SL godkänner skrivningen"-lösning gäller sannolikt rakt av — se Öppna frågor.
- **⚠ RÄTTELSE 2026-08-21, samma dag:** `packs/tabeller` har REDAN en riktig, fullt ifylld **Skräcktabell** (10 utfall, 1d20, sourcad mot Magi-regelboken s.25) — Grupp D:s ursprungliga påstående att den var "ej byggd" var fel. Ingen tabellkod saknas för UC-M10; det som saknas är bara ett ANROP (`RollTable#draw()`) från en lyckad skräck-besvärjelse. `Snedtändningstabellen` och en `Fummeltabellen`-motsvarighet för anfall/parering (`VERDICT_NOTE`, attack.mjs) saknas fortfarande på riktigt — bekräftat genom att faktiskt lista `packs/tabeller/_source`, inte anta.
- **⚠ RÄTTELSE, samma dag:** "Öppen fråga 2" nedan (opponerad-slag-mekanik) beskrev fel — `DODE.rollResistance(sg, attributeValue)`/Motståndstabellen (`config.mjs`, SL s.34/RP s.37-38) är REDAN byggd, sourcad och generell (gäller redan konceptuellt ~15 andra regler: Judo, Bola, Lasso, Piska, Härskri, Psykisk duell, gift, magiskt motstånd). Den har bara **noll anropare ännu** — UC-M7 (Förlamning, PSY vs PSY) blir alltså det FÖRSTA riktiga anropet, inte en ny mekanism. Funktionen är dessutom generell nog att täcka E-vs-E-mönster också (Blindskydd, Skicka bort elementar, Häva förstening) — vilket tal som helst kan skickas in som `sg`/`attributeValue`, den bryr sig inte om vad de FÖRESTÄLLER.

## Vad som INTE finns alls — de riktiga luckorna

1. **Ingen "applicera en engångs-HP-ändring" primitiv för magi.** `applyLocationDamage`/`applyAttackResult` (Spelar-anfall-planen) gör exakt detta för VAPENskada, men är inte generella — de är vävda in i `resolveAttack()`s hela anfalls-/pareringsstruktur. Läkning (UC-M3) och ren skademagi (UC-M11) behöver samma "dra av/lägg till X KP, härled effekt/totalAfter"-kärna, men UTAN anfalls-/pareringsslag runtomkring.
2. **Ingen bro mellan "besvärjelsen lyckades" och "sätt en Foundry-statuseffekt".** Verktyget (`toggleStatusEffect`) är gratis, kopplingen finns inte.
3. **Ingen opponerad-slag-mekanik.** `castSpell()`s CL-formel antar ALLTID en ren `1T20 ≤ CL`-kontroll. Flera besvärjelser (Förlamning, Chock, Andebeskydd) är i stället **PSY mot PSY** eller liknande motståndsslag — en annan formkurva än CL-slaget, som `resolveMatrix()` (vapenstrid) inte heller täcker.
4. **Ingen "vem är målet"-insamling för besvärjelser.** `castSpell(item, effektgrad)` tar bara kastaren och effektgraden — inget mål alls, varken enda eller flera.
5. **Drycker kan bara ge ActiveEffect-buffar, aldrig en engångseffekt.** `item-utrustning.mjs`s `effectChanges` har SAMMA form/begränsning som besvärjelsers `spellEffect` — en läkande dryck (UC-M1) är mekaniskt omöjlig att bygga med dagens schema, av samma skäl som lucka 1.
6. **Ingen skadetyp finns någonstans i motorn.** `resolveAttack()`s skada är ett rent tal — inget koncept av "eld"/"köld"/"projektil" som en resistansregel kan haka i. `item-vapen.mjs`/besvärjelsers `spellEffect` har ingen `damageType`. Johans egen påminnelse ("resistance against X fire/cold/arrows") kräver alltså att skadetyper införs FÖRST, innan någon resistansregel kan uttryckas — se Grupp I.

---

## Öppna frågor — flaggade, inte avgjorda

1. **Ska en spelares besvärjelse mot en SL-ägd NPC gå via SAMMA godkännande-flöde som Spelar-anfall-planen byggde för vapen?** Min bedömning: ja, sannolikt rakt av (samma permission-verklighet), men värt ett uttryckligt Johan-beslut innan det byggs — särskilt eftersom magi har FLER sorters skrivningar (statustoggling, ActiveEffect-skapande, periodeffekt-borttagning) än bara "KP/EP/slitage".
2. **Opponerade slag (PSY vs PSY m.fl.) — bygg en generell mekanism nu, eller punktlösning per besvärjelse när den faktiskt fylls i?** Given att bara ett fåtal av 222 besvärjelser använder mönstret (Förlamning, Chock, Andebeskydd, Andeslag, flera Spiritism-besvärjelser), kan en generell "opponerat slag"-hjälpfunktion vara för tidig — eller precis rätt tidpunkt att bygga den EN gång innan fem olika ad hoc-varianter uppstår.
3. **"Bedövad" (Röstmagi S6) — namnet antyder ett STUN-liknande stridseffekt, men källtexten säger "Dövar alla inom räckvidden ... i 1T4 timmar"** (dövhet, inte handlingsoförmåga). Antingen ett OCR-/tolkningsfel i det kurerade extraktet, eller boken menar bokstavligen dövhet. Bör verifieras mot originalsidan (Formelboken s.53-56) innan besvärjelsen fylls i — INTE gissad.
4. **Manipel-besvärjelserna** (Mentalisms "massformler": Fanatism, Demoralisering, Oordning, Moralförstärkning, Fruktan) **är krigföring i stor skala** (hela arméenheter, "PSY/manipel"-kostnader) — troligen helt utanför en enskild PC-strids skala. Föreslår att de explicit exkluderas från den första omgången (se Grupp H), men Johan bör bekräfta att det stämmer med kampanjens behov.
5. **Ritualer och besvärjelser med timmars/dagars castingtid** (Animera död, Skicka bort demon, magiska föremåls-tillverkning) hör hemma UTANFÖR "i en strid" per definition — de tar för lång tid. Bör de mekaniseras alls, eller förbli fritext/SL-fiat permanent?

---

## Grupp A — Drycker: instant effekt kontra buff

### UC-M1 — Dricka en läkande dryck mitt i strid
**Setup:** En `utrustning`-item, `consumable:true`, tänkt att ge tillbaka KP direkt (inte en tidsbegränsad buff).
**Situation:** En spelare med 4/20 KP dricker drycken som sin handling.
**Förväntat:** ❌ **Byggbar inte idag.** `consumeItem()`s `effectChanges` stödjer bara `{key,mode,value}`-ActiveEffect-changes mot `.bonus`-fält (kontinuerliga modifierare) — det finns inget sätt att uttrycka "lägg till 2T6 KP EN gång, sen är det klart". Kräver en ny effekttyp på `item-utrustning.mjs` (t.ex. `instantEffect: {kind:"heal"|"damage", formula}`) och en ny, generell "applicera engångs-HP-ändring"-funktion (lucka 1 ovan).

### UC-M2 — Dricka Drakpotion (regressionskontroll)
**Setup:** Den redan existerande, redan testade "Drakpotion" (magiskt föremål, +10 på valfri grundegenskap, `$CHOICE`-platshållare).
**Situation:** En spelare dricker den mitt i strid, precis som testat tidigare (backlogpost 7).
**Förväntat:** ✅ **Fungerar redan, oförändrat.** Ren regressionskontroll — inget nytt att bygga, bara bekräfta att den nya instant-effekt-grenen (UC-M1) inte råkar störa den befintliga buff-grenen.

---

## Grupp B — Beröringsräckvidd, ingen fientlig måltilldelning

### UC-M3 — "Hela" på en skadad allierad
**Källa:** Animism S12, Beröring, Omedelbar. "Helar E KP hos offret" (MAGI.md, Formelboken s.3-16).
**Setup:** Magikern kastar Hela E2 (S12 → CL 10) på en allierad med 6/20 KP.
**Situation:** Lyckat slag.
**Förväntat:** Målet får +E KP (t.ex. E2 → +2 KP, klampat till max). SAMMA underliggande primitiv som UC-M1 (instant HP-delta), fast riktad mot ett ANNAT mål än kastaren — bekräftar att primitiven måste ta ett `target`-argument, inte anta `this`.

### UC-M4 — "Neutralisera gift" tar bort en pågående giftperiodeffekt
**Källa:** Animism S15, Beröring, Omedelbar. "Neutraliserar ett aktivt gift i offrets kropp."
**Setup:** Ett mål har en riktig `source:"poison"`-periodeffekt (redan byggd mekanik, Områdeseffekter del 2/GM-effektfönstret).
**Situation:** Magikern lyckas med slaget.
**Förväntat:** Periodeffekten (eller periodeffekterna, om flera) med `source:"poison"` tas bort via den REDAN byggda `DODE.removePeriodicEffect` — ingen ny datamodell, bara ett nytt ANROP från en lyckad kastning. Bra exempel på "besvärjelse konsumerar en redan byggd mekanik" i stället för att uppfinna en egen.

---

## Grupp C — Fientlig enmålsattack, statuseffekt

### UC-M5 — "Blindhet" mot en fiende
**Källa:** Nekromanti S6, Sx2 rutor räckvidd, Sx1 SR varaktighet. "Offret förlorar synförmågan under varaktigheten."
**Setup:** Magikern kastar Blindhet E1 mot en fiende inom räckvidd.
**Situation:** Lyckat slag, inget motståndsslag nämnt i källtexten (ren CL-kontroll).
**Förväntat:** `target.toggleStatusEffect("blind", {active:true})` — Foundrys egen `blind`-status, REDAN konsumerad av Anfallsdialogens `#morkerFor`/blind-hantering (byggd i "Stridsflödets smoothness"-passet). En besvärjelse som sätter blind-status FÅR ALLTSÅ GRATIS att nästa vapenanfall mot/från det målet redan hanterar Mörker-straffet korrekt — ingen extra kod i attack.mjs.

### UC-M6 — "Paralysering" med STO-skalad kostnad
**Källa:** Nekromanti S7, Sx2 rutor, Sx1 minuter. "Paralyserar offret (1 E per 20 STO); kan ej röra sig alls."
**Setup:** Magikern kastar mot ett mål med STO 14 (kräver E1) respektive ett troll med STO 45 (kräver E3).
**Förväntat:** Samma statusprimitiv som UC-M5 (`paralysis`), men effektgraden E måste räcka till målets STO INNAN kastningen ens tillåts/lyckas fullt ut — ett exempel på att "hur mycket E krävs" ibland beror på MÅLET, inte bara på kastarens val. Öppen fråga: ska UI:t räkna ut minsta E automatiskt (kräver att målet redan är valt INNAN E anges), eller lämnas det åt spelaren/SL att räkna själv (enklare, mer i linje med hur `castSpell(item, effektgrad)` redan tar E som ett fritt argument)?

### UC-M7 — "Förlamning" via opponerat PSY-slag (INTE en ren CL-kontroll)
**Källa:** Stavmagi S5, Beröring, Sx1 SR. "Paralyse vid beröring med staven (PSY vs PSY)."
**Setup:** En stavmagiker rör vid ett mål med staven.
**Situation:** Källan anger PSY vs PSY, INTE `1T20 ≤ CL`.
**Förväntat:** Kräver antingen en NY opponerad-slag-funktion (Öppen fråga 2) eller att `castSpell()`s CL-formel byggs om till att kunna ta ett "motståndarens PSY" som effektiv CL-motpart i stället för `S − 2×(E−1)`. Skiljer sig alltså STRUKTURELLT från UC-M5/UC-M6, inte bara i vilken status som sätts.

### UC-M8 — "Förhäxad sömn" med en egen uppvaknande-regel
**Källa:** Häxkonster S4, Sx2 rutor, Sx1 timmar. "Försätter offret i djup sömn; vaknar ej förrän man försöker väcka/skada."
**Setup:** Magikern kastar mot ett sovande vaktvärn.
**Förväntat:** `target.toggleStatusEffect("sleep", {active:true})` — men källtexten anger EN EXPLICIT avbrytningsregel ("väcka/skada" avslutar sömnen omedelbart) som skiljer sig från en vanlig tidsbegränsad statuseffekt (som annars bara klingar av med `duration`). Är detta värt en egen "avbryts av skada"-koppling (t.ex. en hook på `preUpdateActor` som känner av ett HP-tapp och slår av `sleep`), eller ska SL manuellt klicka bort statusen när fiktionen kräver det (enklare, matchar "systemet möjliggör, SL avgör"-principen som redan används för `attackUnprepared`)?

---

## Grupp D — Fientlig flermålsattack (AOE) — återanvänder tonight's multi-target-loop

### UC-M9 — "Förtrollad sömn" mot en grupp fiender
**Källa:** Illusionism S11, Sx10 rutor, Sx1 timmar. "Sövar E varelser (1E/varelse, +1E/20 extra STO); kan ej väckas normalt."
**Setup:** Magikern målsätter 3 fiender (`game.user.targets`, EXAKT samma Foundry-mekanism Anfallsdialogens flermålsläge redan bygger på).
**Förväntat:** En loop över `targets` — samma statusprimitiv som UC-M8 applicerad per mål, med samma "1E per varelse (+ mer för stora varelser)"-skalning som UC-M6 redan introducerade. Om E inte räcker till alla mål: käll­texten antyder att bara DE FÖRSTA (eller SL-valda) målen somnar — ännu en öppen regel-tolkningsfråga, inte teknisk.

### UC-M10 — "Massfruktan" — alla i räckvidd slår på Skräcktabellen
**Källa:** Harmonism S15, Konc, Sx2 rutor. "Alla intelligenta slår på Skräcktabellen (max en gång per varaktighet)."
**Förväntat:** Skräcktabellen är UTTRYCKLIGEN "ej byggd än" (samma `VERDICT_NOTE`-flagga redan finns i `attack.mjs` för fummeltabellerna) — detta fall är alltså blockerat av en REDAN KÄND, redan flaggad lucka (fummel-/skräcktabeller), inte en ny. Bra bekräftelse på att UC-M10 inte kan färdigställas förrän den luckan täpps, oavsett hur besvärjelsesystemet i övrigt byggs.

---

## Grupp E — Ren skademagi (offensiv, ingen parering — mönster redan bevisat av testdraken)

### UC-M11 — "Eld" mot ett enda mål
**Källa:** Elementarmagi S6, Sx10 rutor, Omedelbar. "Temperaturhöjning i 1m sfär; 1T6/E skada."
**Förväntat:** Samma "ingen parering, bara skada"-mönster som testdrakens Eldandedräkt (`category:"projektil"`, redan liveverifierat i Områdeseffekter del 1) — men behöver INTE gå via `resolveAttack()`s hela anfalls-/pareringsapparat (ingen CL-anfallsslag i bokens mening, bara besvärjelsens EGEN CL-kontroll). Bekräftar lucka 1: skademagi behöver en LÄTTARE primitiv än vapenanfall, inte en till `resolveAttack()`-gren.

### UC-M12 — "Blixt" som ignorerar rustning helt
**Källa:** Elementarmagi S6, Sx10 rutor. "Blixt mot närmaste mål framför magikern; 1T6/E skada; ingen rustningsskydd."
**Förväntat:** Samma som UC-M11, men med en EXPLICIT källsourcad specialregel (ABS dras aldrig av) — skiljer sig från vapenstridens `verdict.ignoreArmour` (som bara gäller vid ett PERFEKT anfallsslag). En generell skademagi-primitiv behöver alltså en `ignoreArmour`-flagga PER BESVÄRJELSE, inte härledd från slagutfallet som i vapenstrid.

---

## Grupp F — Buff/debuff (redan mekaniskt möjligt, bara oprövat i strid)

### UC-M13 — "Fjällpansarhud" på sig själv
**Källa:** Mentalism S9, Personlig, Sx1 timmar. "Huden blir hård och fjällig; +4 abs; KAR −4 under varaktigheten."
**Förväntat:** ✅ **Redan mekaniskt byggbart** via `applySpellEffect()` — `spellEffect:[{key:"system.abs",mode:2,value:4×E},{key:"system.attributes.kar.bonus",mode:2,value:-4}]`, `spellDuration` i SR. Det ENDA som saknas är att fylla i besvärjelsens `spellEffect`/`spellDuration`-fält OCH koppla in ett anrop från `castSpell()` (som medvetet aldrig gjordes, se citatet överst). Lägsta risk av alla 15 fall — inget nytt att bygga, bara riktig data + en riktig kopplingsrad + ett liveverifieringspass.

### UC-M14 — "Stridsrop" på hela gruppen (AOE-buff, inte AOE-attack)
**Källa:** Röstmagi S6, Kvick, Sx1 SR, Sx2 rutor. "Allierade: +5 CL i strid, behöver ej slå moralslag under varaktigheten."
**Förväntat:** Samma `applySpellEffect()`-mönster som UC-M13, men i en loop över VÄNLIGA mål (`game.user.targets` som redan är allierade, eller en egen "markera mina allierade"-väljare) — riktningen (buff åt vänner) är den strukturella skillnaden mot Grupp D:s fientliga AOE, värt att hålla isär i UI:t (två olika knappar/lägen, inte samma "flermål"-kryssruta).

---

## Grupp G — Interaktion mellan en aktiv statuseffekt och en annan handling

### UC-M15 — Ett sovande offer väcks av en attack
**Källa:** Se UC-M8:s "vaknar ej förrän man försöker väcka/skada".
**Setup:** Ett mål har `sleep`-statusen (från UC-M8/UC-M9). En ANNAN karaktär anfaller det sovande målet (redan byggd `attackUnprepared`/parering-blockering, "Stridsflödets smoothness"-passet).
**Förväntat:** Anfallet i sig ÄR "skada"-triggern — sömnen bör upphöra SOM EN KONSEKVENS av att `resolveAttack()`/`applyAttackResult()` kör, inte en separat manuell SL-åtgärd. Det här är den tydligaste kopplingspunkten mellan magisystemet och det REDAN BYGGDA stridssystemet — värt att designa MED vapensystemet i åtanke, inte som ett fristående magisystem som råkar dela statusnamn.

---

## Grupp I — Motstånd/resistans mot skadetyp (tillagt efter Johans påminnelse "resistance against X fire/cold/arrows")

Tre STRUKTURELLT olika mönster hittade i källtexten, inte en enda mekanik:

### UC-M16 — "Motståndskraft" (flat skadereduktion per typ, tidsbegränsad)
**Källa:** Mentalism S3, Sx1 minuter. "Reducerar skada från hetta/kyla/Eld/Frost med E poäng per anfall per SR."
**Förväntat:** En ActiveEffect-liknande, tidsbegränsad modifierare — men riktad mot en SKADETYP, inte ett attribut/färdighets-`.bonus`-fält som `spellEffect` idag bara kan uttrycka. Kräver: (a) att skada FÅR en typ (lucka 6), (b) en ny sorts modifierare ("−E skada av typ X"), tillämpad i skadeberäkningen (`applyLocationDamage`/den nya instant-skade-primitiven, UC-M11/M12) EFTER `abs`-avdraget, inte i stället för det.

### UC-M17 — "Blindskydd" (villkorad immunitet, E vs E)
**Källa:** Elementarmagi S6, Sx1 minuter, Beröring. "Immunitet mot bländning; bländande besvärjelser måste övervinna med E."
**Förväntat:** INTE en flat reduktion — ett FÖRSÖK att blända målet måste först "vinna" ett E-vs-E-slag mot skyddets E, annars har blindhets-besvärjelsen (UC-M5) ingen effekt alls. Redan täckt mekaniskt av `DODE.rollResistance` (se rättelsen ovan — vilka tal som helst kan skickas in), men kräver att UC-M5:s implementation FRÅGAR efter en aktiv Blindskydd-effekt på målet innan `toggleStatusEffect("blind")` körs.

### UC-M18 — "Syraskydd" (fullständig immunitet, inget slag alls)
**Källa:** Mentalism S10, Sx1 minuter. "Kroppen skadas ej av frätande syror/baser; skyddar ej utrustning."
**Förväntat:** Enklaste fallet — en ren boolesk "immun mot typ X"-flagga under effektens varaktighet, ingen tärning inblandad. Om skadetyper (lucka 6) och UC-M16:s modifierare-lager byggs generellt räcker "reduktion = oändlig/100%" för att uttrycka det här fallet UTAN en egen kodväg — värt att bekräfta i designen att UC-M16/17/18 kan dela SAMMA underliggande datastruktur (en lista av `{damageType, reduction: number|"immun", overcomeE: number|null}` snarare än tre separata fältfamiljer).

---

## Grupp H — Uttryckligen UTANFÖR scope för en första omgång

- **Manipel-/massstridsformler** (Fanatism, Demoralisering, Oordning, Moralförstärkning, Fruktan-Mentalism m.fl.) — hela arméenheter, en annan skala än PC-strid. Se Öppen fråga 4.
- **Ritualer och timmar-/dagarslånga besvärjelser** (Animera död, Skicka bort demon/elementar, magiska föremåls SIGILL/PERMANENS/NEXUS-tillverkning) — per definition inte "i en strid". Se Öppen fråga 5.
- **De ~150 rent narrativa/utility-besvärjelserna** (Karta, Levitation, Teleportera, Tala med död, Väderförutsägelse, m.fl.) — kräver ingen ny mekanik alls utöver den redan byggda CL/PSY-kontrollen; resten är SL-fiat/fritext, precis som `castSpell()`s befintliga chattmeddelande redan lämnar öppet.
- **Snedtändningstabellen och Skräcktabellen** — båda REDAN flaggade som obyggda (`VERDICT_NOTE` i attack.mjs), blockerar UC-M10 och alla fummel-utfall vid magi. Egna, avgränsade byggen, inte del av det här dokumentet.

---

## Sammanfattning — mekaniska primitiver som täcker samtliga 18 fall

1. **Instant HP-delta** (läkning/skademagi, riktad mot valfritt mål) — UC-M1, M3, M11, M12.
2. **Statuseffekt-koppling** (lyckad besvärjelse → `toggleStatusEffect`) — UC-M5, M6, M8, M9.
3. ~~Opponerat slag~~ **REDAN BYGGT** (`DODE.rollResistance`/Motståndstabellen, config.mjs) — bara noll anropare. UC-M7 blir första riktiga användningen, delvis M6/M17.
4. **Flermåls-loop för besvärjelser** (samma mönster som Anfallsdialogen) — UC-M9, M10, M14.
5. **`applySpellEffect()`-kopplingen till `castSpell()`** (redan byggd mekanik, bara aldrig ihopkopplad) — UC-M13, M14.
6. **Periodeffekt-interaktion** (ta bort, inte bara lägga till) — UC-M4.
7. **Statuseffekt-avbrytning vid extern händelse** (sömn bryts av skada) — UC-M15.
8. **Godkännande-flödet, om spelare kastar mot SL-ägda mål** — Öppen fråga 1, gäller potentiellt ALLA fall i Grupp C-E.
9. **Skadetyper + resistans/immunitet-lager** (NY, tillagd efter Johans påminnelse) — UC-M16, M17, M18. Beror på primitiv 1 (instant HP-delta måste känna till skadetyp för att kunna dra av resistans).
10. **Dolda dependent-tabeller** (Skräcktabellen REDAN byggd, bara okopplad; Snedtändningstabellen och Fummeltabellen för anfall/parering genuint saknade) — UC-M10 plus alla `VERDICT_NOTE`-flaggade fummelutfall i vapenstrid.

Inget av detta är byggt än. Nästa steg, när Johan är redo: en Plan Mode-session per primitiv (troligen 1-2 primitiver i taget, samma stegvisa riskhantering som Spelar-anfall-planens Fas A/B), med det här dokumentet som facit.
