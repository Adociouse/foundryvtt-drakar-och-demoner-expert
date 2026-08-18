# Flerhandsstrid — 20 användningsfall (design-underlag, INTE byggt än)

> Skapad 2026-08-04. Syfte: ett käll-förankrat facit att bygga och regressionstesta den kommande stridshandlingsekonomin (`docs/DESIGN_DECISIONS.md` §3 backlog 32) mot, innan koden skrivs. Följer samma Setup/Situation/Förväntat-mönster som `docs/TEST_CASES.md`, men det här är **specifikation för ännu obyggd logik**, inte en checklista mot körande kod — flera fall kan inte köras i dagens Foundry-instans alls.
>
> **Status på motorn idag** (`rolls/attack.mjs`): `resolveAttack()` löser **ett anfall mot EN parering per anrop**. Inget begrepp om "hand", "handlingar per SR", eller flera samtidiga pareringar finns. `system.swordHand` (höger/vänster/dubbelhänt/ambidextriös) sparas men läses ingenstans i strid. `MELEE_MODS.skoldhand: -10` är definierad men aldrig applicerad av någon anropare. Två vapen-kombinationer (`twoWeaponCombo`, se `docs/DESIGN_DECISIONS.md` §2) har FV-tak/auto-BC men ingen körbar "2 anfall/anfall+parering/2 pareringar"-logik. Detta dokument är den lucka backlog 32 pekar på.

---

## Två regelfrågor — besvarade av Johan 2026-08-04

1. **Kräver Ambidextriös/Dubbelhänt fortfarande Två vapen-träning per vapenpar?** ✅ **Beslutat.** Ambidextriös hoppar över träningskravet helt — se `CLAUDE.md`s "Beslutade avsteg"-tabell för det fulla beslutet och motiveringen. **Dubbelhänt får INTE samma genväg** (RP s.27 definierar Dubbelhänt som uttryckligen "inte samtidigt" — precis den kvalitet Två vapen kräver). UC-F6/F7 nedan är uppdaterade i konsekvens; inget kvar att besluta här, bara att bygga (backlog 32).
2. **Finns en sourcead regel om att Morgonstjärna (eller något annat vapen) ignorerar sköldparering?** ⚠ **Fortfarande obekräftat — Johan minns att ha läst den men inte var.** Sökt igenom `REGLER_STRID.md`, `UTRUSTNING.md` och `DODE_Grundregelbok_fullextract.md` i Roll20-projektet utan träff (Morgonstjärna förekommer bara i råa skada/BV/vikt/pris-tabeller). Johans direktiv: bygg logiken så den KAN hantera det när källan hittas, men sätt inte flaggan på Morgonstjärna än. Se det nya kravet i "Arkitekturkrav" nedan och UC-F20b.

---

## Grupp A — Baslinje: en handling per SR, ingen komplikation

Syfte: bevisa att `swordHand`-värdet **inte** smyger in en oavsiktlig bonus/straff när bara EN vapenfärdighet är i spel. Alla fyra bör ge **identiskt** numeriskt utfall.

### UC-F1 — Höger, 1H-vapen + sköld
**Setup:** `swordHand: "hoger"`. Bredsvärd-färdighet FV12 i dominant hand, Rundsköld i den andra.
**Situation:** Vanligt anfall mot en generisk försvarare.
**Förväntat:** Fungerar redan med dagens `resolveAttack()` oförändrad — ett anrop, `weapon`=Bredsvärd, `parryItem`=försvararens eget vapen/sköld. Ingen kod saknas för det här fallet.

### UC-F2 — Vänster, samma uppställning
**Setup:** Identiskt mot UC-F1 förutom `swordHand: "vanster"`.
**Situation:** Samma anfall.
**Förväntat:** **Exakt samma resultat som UC-F1.** "Svärdshand" är en ROLL (den hand som bär huvudvapnet), inte en bokstavlig sida — en vänsterhänt karaktär med ett vapen i sin dominanta (vänstra) hand har inget straff. Bra regressionstest: koden ska aldrig råka straffa `vanster` som om det vore en avig hand.

### UC-F3 — Dubbelhänt, samma uppställning
**Setup:** `swordHand: "dubbelhant"`, i övrigt identiskt.
**Förväntat:** Samma som UC-F1/F2 — dubbelhänthet har inget att göra förrän en ANDRA aktiv handfärdighet är inblandad (se Grupp B/C). Ren "ingen oavsiktlig bonus"-kontroll.

### UC-F4 — Ambidextriös, samma uppställning
**Setup:** `swordHand: "ambidextrios"`, i övrigt identiskt.
**Förväntat:** Samma som ovan, av samma skäl.

---

## Grupp B — Otränad tvåvapensanvändning (regeln som stoppar "gratis" dubbla vapen)

### UC-F5 — Höger, två 1H-vapen UTAN tränad Två vapen-kombo
**Setup:** Svärd-fardighet FV12 + Dolk-fardighet FV10, båda `weaponGroup`-taggade. **Inget** `twoWeaponCombo`-item finns.
**Situation:** Spelaren vill anfalla med båda vapnen samma SR.
**Förväntat:** **Inte tillåtet.** SB s.33, ordagrant: *"man måste lära sig en speciell färdighet (Två vapen) för att kunna använda ett vapen i varje hand."* Utan kombo-färdigheten är dolken inert den här SR:n — bara svärdet fungerar. Detta är ett regelframtvingande-fall, inte ett tärningsfall: framtida UI/API måste vägra handlingen, inte tyst tillåta den.

### UC-F6 — Samma som UC-F5, men Ambidextriös
**Setup:** Identiskt mot UC-F5 förutom `swordHand: "ambidextrios"`.
**Situation:** Samma önskan.
**Förväntat:** ✅ **TILLÅTET, utan tränad kombo.** Beslutat av Johan 2026-08-04 (se `CLAUDE.md`s avsteg-tabell) — Ambidextriös hoppar över Två vapen-träningskravet helt. Anfaller med Svärd(FV12) och Dolk(FV10) samma SR, var sitt vapens EGNA FV används direkt (inget kombo-FV-tak/auto-BC, eftersom inget `twoWeaponCombo`-item behövs eller skapas). Skiljer sig från UC-F8 nedan på just den punkten — en tränad kombo har ett gemensamt FV-tak, en Ambidextriös utan kombo har det inte.

### UC-F7 — Samma som UC-F5, men Dubbelhänt
**Förväntat:** ❌ **Fortfarande INTE tillåtet utan tränad kombo.** RP s.27 definierar Dubbelhänt uttryckligen som "inte samtidigt" — precis den egenskap Två vapen-färdigheten representerar, så Dubbelhänt får ingen genväg. Måste träna en `twoWeaponCombo` som alla andra icke-Ambidextriösa karaktärer (se Grupp C).

---

## Grupp C — Tränad Två vapen-kombo, de tre stridsalternativen (RP s.59)

Förutsätter att UC-F5-liknande träning har skett och ett `twoWeaponCombo`-item finns (Svärd+Dolk, FV-tak `min(12,10)=10`, auto-BC 5, se `DODE.twoWeaponCap`/`twoWeaponAutoBc`).

### UC-F8 — "2 anfall"
**Setup:** Höger, tränad kombo Svärd(FV12)+Dolk(FV10→kombo-FV upp till taket 10).
**Situation:** Spelaren väljer RP s.59:s första alternativ: två anfall samma SR, ett per vapen.
**Förväntat:** Två separata anfallsslag (svärdshanden FÖRST i turordningen, sköldhanden SIST — RP s.59), mot samma eller olika mål. **Kräver ny kod:** dagens `resolveAttack()` gör ett anfall per anrop, vilket räcker rent tekniskt (anropa två gånger), men INGET spårar att en kombo-innehavare får göra det medan en otränad karaktär (UC-F5) inte får — den kontrollen finns inte än. Detta är kärnfallet för backlog 32.

### UC-F9 — "Anfall + parering"
**Situation:** Spelaren väljer det andra alternativet: anfaller med svärdet, håller dolken i beredskap som en EXTRA parering utöver den normala en-parering-per-SR-budgeten.
**Förväntat:** Ett anfallsslag (svärd) + försvararens vanliga försvar, PLUS att den här karaktären själv kan parera en inkommande attack senare samma SR med dolken — en riktig extra försvarsresurs, skild från den vanliga en-parering-per-SR-regeln (REGLER_STRID.md: "Man kan bara parera en attack per SR" — kombon är det uttalade undantaget).

### UC-F10 — "2 pareringar"
**Situation:** Rent defensivt SR, inga anfall. Båda vapnen hålls redo att parera TVÅ separata inkommande anfall (från en eller två motståndare).
**Förväntat:** Två oberoende pareringsslag mot två separata `resolveAttack()`-anrop riktade mot den här karaktären. Skiljer sig tydligt från UC-F5 (otränad) där ett andra vapen inte ger någon pareringsförmåga alls.

---

## Grupp D — Tvåhandsvapen

### UC-F11 — Tvåhandssvärd, ingen ledig hand
**Setup:** Tvåhandssvärd-fardighet, `weaponGroup: "tvahandsvapen"`.
**Situation:** Spelaren frågar om en dolk kan hållas i en "extra" grepp samtidigt.
**Förväntat:** **Nej, under inga omständigheter** — RP s.59 utesluter uttryckligen tvåhandsvapen ur Två vapen-kombinationer, och det gäller ALLA handstyper (även Ambidextriös trollar inte fram en tredje hand). Hård regel, inget undantag.

⚠ **Verklig lucka hittad under research för det här dokumentet:** `#onAddTwoWeaponCombo`s dialogtext (`actor-character-sheet.mjs`) SÄGER "Tvåhandsvapen kan inte kombineras", men dropdownens `weaponSkills`-filter (rad ~466) filtrerar bara på `system.weaponGroup` överhuvudtaget satt — den utesluter INTE gruppen `tvahandsvapen` specifikt. En SL kan alltså i praktiken skapa en ogiltig kombo idag. Värt en egen litet fix, inte del av det här dokumentet.

### UC-F12 — Tvåhandssvärd mot sköld+vapen-försvarare
**Situation:** Ren matchning, ingen flerhandskomplikation på ANFALLARENS sida.
**Förväntat:** Fungerar redan med dagens kod oförändrad — bra "inget nytt behövs här"-kontroll.

---

## Grupp E — Anfallare vs. försvarare med olika uppställning

### UC-F13 — Tränad Två vapen-anfallare mot sköldbärande försvarare
**Situation:** Anfallaren gör "2 anfall" (UC-F8). Försvararen har VAPEN + SKÖLD, ingen Två vapen-träning.
**Förväntat:** Försvararen är INTE hjälplös mot det andra anfallet — REGLER_STRID.md: *"Sköld ger separat parering utöver vapnets"*, alltså har sköldbäraren REDAN två pareringar per SR (vapen + sköld) utan att någonsin ha tränat Två vapen. Bägge sidor kan alltså försvara sig mot upp till två träffar den här SR:n — värt att uttryckligen testa så att implementationen inte råkar göra Två vapen till den ENDA vägen till dubbel parering.

### UC-F14 — Tränad Två vapen-anfallare mot otränad enkelvapen-försvarare (ingen sköld)
**Förväntat:** Här är asymmetrin verklig — försvararen har bara EN parering den här SR:n. Anfallets andra träff går igenom oparerad (eller kräver ett annat undanmanöver, om sådant finns). Det här är själva poängen med subsystemet — bra "payoff"-fall att visa upp.

---

## Grupp F — Skadad/upptagen arm

### Sidofråga (Johan 2026-08-04): fördelas ett stort slag över flera kroppsdelar i vanlig strid, eller blir en enda kroppsdel obrukbar av det?

**Svar, verifierat mot befintlig kod och källtext: ingen fördelning sker någonstans — och i vanligt (icke-detaljerat) läge finns kroppsdelar inte alls än.**

- **Vanlig strid:** `resolveAttack()` slår träffområde **alltid** (Johans egna beslut 2026-07-29, "tänk att ett vanligt anfall alltid har en dold riktad attack"), men `ensureHitLocations()` — funktionen som faktiskt SKAPAR kroppsdelarnas egna KP-fack — anropas bara `if (detailed)`. I vanligt läge finns alltså `system.hitLocations` aldrig befolkat, och skadan drar bara av **Totala KP** som en klump. Ett stort slag "sprids" inte i vanligt läge av den enkla anledningen att det inte finns några delar att sprida DET på — exakt vad REGLER_STRID.md:s egen "Grundsystemet vs. Alternativa"-tabell säger ("En samlad KP" vs. "Tillgång till individuella kroppsdels-KP").
- **Detaljerad strid:** `applyLocationDamage()` drar HELA skadan från BÅDA spåren samtidigt — träffområdets egna KP OCH Totala KP (SLB s.18: "skadan räknas BÅDE från Totala KP och från den träffade kroppsdelen"). Det finns INGEN överspillslogik till andra kroppsdelar. Ett 40-skadeslag mot en arm med 8 i eget KP-tak går rakt av: armen blir kritisk (severed, `damageTaken >= max*2`) OCH Totala KP faller med hela 40, vilket normalt slår ut/dödar via den vanliga KP-tabellen. **Ingen källa hittad** (varken REGLER_STRID.md eller `anatomy.mjs`s befintliga kommentarer) som beskriver att överskjutande skada "smittar" till andra kroppsdelar — dubbelspårs-modellen (lokal + total) verkar vara bokens egna svar på samma problem, inte en lucka som behöver täckas separat. Flaggar detta som **redan korrekt** snarare än en ny sak att bygga, men noterar det tydligt eftersom frågan är rimlig att ställa och lätt att anta fel om.

### UC-F15 — Sköldhandens/off-hand-vapnets ARM blir obrukbar mitt i striden
**Setup:** Tränad Två vapen-kombo. Ett träffområdesslag mot armen drar dess KP till ≤0.
**Situation:** `anatomy.mjs`s `locationEffect()` returnerar redan idag `{level:"obrukbar", text:"Kroppsdelen obrukbar..."}` för det här fallet — maskineriet finns, bara inte konsumerat av strid.
**Förväntat:** Kombo-vapnet faller ur spel omedelbart, OAVSETT handstyp (även Ambidextriös förlorar handlingsförmågan — det här är en FYSISK skada, inte en fingerfärdighetsfråga). Karaktären faller tillbaka till enkelvapensekonomin (Grupp A) resten av striden, eller tills läkning. **Verklig lucka:** ingen befintlig kod läser `hitLocations`-tillståndet innan den tillåter en kombo-handling — det är den konkreta kopplingen som saknas mellan `anatomy.mjs` (byggt) och den framtida handlingsekonomin (obyggd).

### UC-F16 — SköldARMEN (inte vapenarmen) blir obrukbar
**Situation:** Samma skademaskineri, men träffområdet är den arm som bär SKÖLDEN.
**Förväntat:** Förlorar sköldens separata parering (tillbaka till 1 parering/SR, vapenhanden opåverkad). ⚠ Öppen detaljfråga att lösa vid byggnation: faller skölden av helt (måste tas upp/spännas om) eller hänger den kvar obrukbar på armen? Ingen bokkälla hittad än — flagga, gissa inte.

### UC-F17 — Handen är upptagen (bär en fackla/en räddad NPC/en kista), INTE skadad
**Setup:** Ingen `hitLocations`-skada alls — rent fiktionsdrivet/positionellt.
**Förväntat:** Funktionellt samma resultat som UC-F15/F16 (förlorar den handens handling), men **det finns inget datafält för det här idag.** `hitLocations`-skademodellen är fel verktyg (ingen skada har skett). Behöver troligen en lättviktig markör (t.ex. en GM-satt flagga eller ett kort ActiveEffect-liknande tillstånd, "händerna upptagna") separat från skademodellen — ny design, inte återanvändning av anatomy.mjs.

**→ Det här är exakt det fall Johans GM-effektfönster-idé (`docs/dev/GM_EFFEKTFONSTER_ANALYS.md`) löser** — ett "villkor"-typat, person-scopat, tillfälligt tillstånd utan numeriskt värde, precis den lucka analysen identifierar att ingen befintlig mekanism täcker.

---

## Grupp G — Specialvapen

### UC-F18 — Kättingvapen (Stridsslaga) mot sköldbärande försvarare
**Källa:** ✅ SB s.33, fullt transkriberad 2026-08-04 (Johan skickade sidan) — se `REGLER_STRID.md` "Specialvapen — Regler" i Roll20-projektet.
**Setup:** Anfallare med Stridsslaga (kättingvapen), försvarare med vapen+sköld.
**Förväntat:** Försvararens **pareringsförsök (vapen ELLER sköld) får CL halverad** — kättingen slår runt båda. Oberoende av det: om anfallaren själv slår **18, 19 eller 20** på sitt anfallsslag räknas det automatiskt som miss, och ett extra 1T20-slag avgör fummel (högre än eget FV → fumlat, ett rått 20 är alltid fummel). Två separata, oberoende kontroller — den ena drabbar försvararen, den andra anfallaren själv.

### UC-F19 — Piska, räckviddsavväpning
**Källa:** ✅ SB s.33, samma transkription som UC-F18.
**Setup:** Anfallare med Piska mot en försvarare som bär ett enhandsvapen, på pisklängds räckhåll.
**Situation:** Anfallaren uppger avväpningsförsöket INNAN anfallsslaget (obligatoriskt enligt texten — kan inte bestämmas i efterhand).
**Förväntat:** Samma pareringsstraff/självfummelrisk som UC-F18 (Piska delar Kättingvapens regler). Vid ett lyckat anfall som träffar svärdsarmen: **STY mot STY på Motståndstabellen** — förlorar försvararen tappas vapnet, landar **1T4 rutor bort**.

### UC-F20 — Bola mot en enarmad/upptagen försvarare (verkligt sourceat specialvapen-exempel)
**Källa:** REGLER_STRID.md, avsnittet "Specialvapen": *"FV-slag lyckas → det avsedda händer (snor kring ben = fall; arm = obrukbar; huvud = omtumlad 1T3 SR)"*.
**Setup:** Anfallare med Bola siktar på försvararens vapenarm.
**Förväntat:** Vid träff + lyckat FV-slag blir armen obrukbar i **1T3 SR** (tidsbegränsat, till skillnad från UC-F15:s skademaskineri som är permanent tills läkning). Bra kontrastfall: två helt olika vägar till "obrukbar arm" (fysisk skada vs. tillfällig snärjning) som bör dela samma KONSEKVENS-logik (tappar handens handling) men olika VARAKTIGHET/återhämtning.

### UC-F20b — Morgonstjärna mot sköldbärande försvarare (uppdaterad efter att SB s.33 lästs i sin helhet — fortfarande inte samma sak)
**Källa:** ⚠ **Fortfarande inget belägg för Morgonstjärna specifikt.** Nu när hela SB s.33 faktiskt är transkriberad (UC-F18/F19 ovan): sidan nämner **aldrig Morgonstjärna vid namn**. Det Johan mindes verkar vara **Kättingvapen**-regeln (Stridsslaga/Stridsgissel) — den säger uttryckligen att kättingen "kan slå runt vapen OCH sköldar", alltså slår den både vapen- och sköldparering, inte bara sköldens. Morgonstjärna själv står katalogiserad i vapengruppen **Enhands krossvapen** (`DODE.weaponGroups`, config.mjs), inte Kättingvapen — så antingen (a) var det en minnesförväxling och regeln gäller Stridsslaga/Stridsgissel som redan täcks av UC-F18, eller (b) Morgonstjärna hör egentligen hemma i Kättingvapen-gruppen i just DoDE:s tolkning (vissa utgåvor avbildar en morgonstjärna som ett kedjevapen, inte ett stelt krossvapen) och katalogiseringen behöver rättas. **Öppen fråga till Johan, inte gissad:** vilket av de två? Tills dess: ingen ändring av Morgonstjärnas gruppdata.
**Arkitekturkrav kvarstår oavsett svar:** när `item-vapen.mjs` och stridsupplösningen designas, lägg en generisk, tom-som-standard flagga (t.ex. `system.halvedParryVs: "alla" | ""` — Kättingvapen-regeln är ju redan bekräftad och behöver den ändå) på vapenmodellen i stället för att hårdkoda ett specialfall per vapen. Samma mönster som `revealsRaceGroup`-flaggan (`CLAUDE.md` Del C) — bygg kroken generellt, fyll data per vapen.

---

## Sammanfattning — vad som redan går att köra vs. vad som är obyggt

| Fall | Körbart idag (enstaka `resolveAttack()`-anrop) | Kräver ny handlingsekonomi (backlog 32) | Kräver forskning/beslut innan byggnation |
|---|---|---|---|
| UC-F1–F4, F12 | ✅ | | |
| UC-F5, F7 | | | Regel klar (SB s.33 / RP s.27), redo att bygga som en ren spärr |
| UC-F6 | | ✅ | Regel klar (Johans avsteg 2026-08-04, se CLAUDE.md) |
| UC-F8–F10, F13–F16 | | ✅ | F15/F16 kräver hitLocations-koppling |
| UC-F11 | | | Dropdown-filterbugg hittad, se anteckning — liten fristående fix |
| UC-F17 | | ✅ | Nytt datafält saknas helt |
| UC-F18–F19 | | ✅ | — sourcead 2026-08-04, redo att bygga |
| UC-F20 | | ✅ | — sourcead, redo att bygga |
| UC-F20b | | ✅ | Morgonstjärna specifikt fortsatt obekräftad — öppen fråga om det egentligen var Kättingvapen (redan täckt av F18) |
