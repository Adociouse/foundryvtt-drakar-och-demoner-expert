# Återhämtningseffekter (HP/PSY) — 15 användningsfall

> Skapad 2026-08-05, svar på Johans fråga om recovery-mekanik för HP/PSY från föremål/besvärjelse/scen/värld. Följer samma Setup/Situation/Förväntat-mönster som `STRID_FLERHAND_ANVANDNINGSFALL.md` — facit för obyggd logik, inte en checklista mot körande kod.
>
> **Status: HP-hook + PSY-motor BYGGDA och liveverifierade 2026-08-05** (samma dag katalogen skrevs — se `docs/DESIGN_DECISIONS.md` backlog 37 för hela loggen). Ursprunglig analys, kvar som bakgrund:
> - **HP hade redan en riktig återhämtningsmotor** innan den här katalogen ens skrevs — `scripts/helpers/time.mjs#applyHealing()`, anropad från det redan byggda tidsfönstret (`apps/time-window.mjs`): 1 KP/vecka per skadat träffområde (SLB s.20), halverat för `resa`/`äventyr` via `TIME_KINDS[kind].healDivisor`. Bara en modifierarkrok saknades — nu byggd (`recoveryModifierTotals`).
> - **PSY hade ingen motsvarighet alls.** RP 22.6 ger takten (1 PSY/timme fullständig vila, 1 PSY/3 timmar kroppslig aktivitet) — nu byggd från grunden som `applyPsyRecovery()` med sin egen `PSY_RECOVERY_SECONDS`-tabell.
> - **Gott läkekött (rad 73) och God mental kontroll (rad 74)** — de två testfallen katalogen föreslog — är nu riktiga `formaga`-item via den befintliga `resolveGrants`/`applyResolvedAbility`-vägen, liveverifierat genom den faktiska slå-fram-förmåga-vägen.
> - **Grupp C nedan (UC-R16–R20, tillagd efter Johans uppföljningsfråga) testar återhämtning specifikt i en stridsmiljö** — hittade en verklig, obyggd lucka (UC-R20).

---

## Grupp A — HP-återhämtning (modifierarkrok på en BEFINTLIG motor)

### UC-R1 — Föremål/förmåga: Gott läkekött (passiv, alltid aktiv)
**Setup:** Rollperson med förmågan "Gott läkekött" (rad 73), skadad i en arm.
**Situation:** En vilovecka passerar via tidsfönstret (`kind: "vila"`).
**Förväntat:** Armen läker **2 KP** i stället för normala 1 (`applyHealing`s `kp`-beräkning multiplicerad med 2 INNAN den appliceras, inte en extra separat tick). Alltid aktiv, inget villkor.

### UC-R2 — Scen: en magisk läkekälla
**Setup:** En scen ("Helande källan") med en scen-effekt "×3 HP-återhämtning medan man vilar här".
**Situation:** Rollpersonen vilar en vecka MEDAN token står på den scenen.
**Förväntat:** 3 KP läker den veckan. Flyttar rollpersonen till en annan scen INNAN veckan är slut ska bara den TID som faktiskt spenderades på källscenen räkna ×3 — resten normal takt. Samma princip som Grupp-scope-diskussionen (`GM_EFFEKTFONSTER_ANALYS.md`): scen-effekter ska INTE följa med när token lämnar.

### UC-R3 — Värld: en förbannelse över hela kampanjen
**Setup:** SL sätter en världseffekt "All läkning halverad" (en pågående pest/förbannelse i kampanjen).
**Situation:** Alla rollpersoner vilar en vecka, var som helst.
**Förväntat:** Halverad läkning för ALLA, oavsett scen eller vilo-slag — världseffekten gäller överallt, till skillnad från UC-R2:s scenbundna effekt.

### UC-R4 — Aktiv färdighet: Läkekonst (inte passiv, kräver ett lyckat slag)
**Setup:** En vårdare med Läkekonst-färdigheten vårdar en patient en hel vecka.
**Situation:** Vårdaren slår ett färdighetsslag i slutet av veckan.
**Förväntat:** **Lyckat slag** → patienten läker DUBBELT den veckan. **Misslyckat slag** → normal takt, ingen bonus. Skiljer sig fundamentalt från UC-R1-R3 (passiva multiplikatorer): det här är en händelse som måste UTVÄRDERAS varje vecka, inte ett stående tillstånd — kan inte modelleras som en enkel `operation:"multiply"`-rad, kräver ett eget slag kopplat till tidsfönstrets veckotick.

### UC-R5 — Stapling: två samtidiga HP-multiplikatorer
**Setup:** Rollperson med Gott läkekött (UC-R1) som ÄVEN vilar vid läkekällan (UC-R2).
**Situation:** En vilovecka passerar på källscenen.
**Förväntat:** ⚠ **Öppen designfråga, inte facit.** Multiplicerar de (2× × 3× = 6×) eller adderas multiplikatorerna (2+3−1=4×)? Ingen bokkälla ger vägledning eftersom det här är ett samspel mellan en förmåga och en påhittad scen-effekt, inte en tryckt regel. Rekommendation: multiplicera (matchar hur `DODE.magicCostMultiplier` och andra flerfaktorberäkningar redan görs i config.mjs), men Johan bör bekräfta innan det låses.

### UC-R6 — Infektion blockerar läkning HELT (hård spärr, ingen multiplikator vinner över den)
**Setup:** Rollperson med Gott läkekött (UC-R1), men den skadade armen är infekterad (SLB s.20: "infekterad kroppsdel läker ingenting").
**Situation:** En vilovecka passerar.
**Förväntat:** **0 KP läkt i den armen**, oavsett hur många aktiva ×N-effekter rollpersonen har. Infektion är en BLOCKERING (typ 5, "villkor" i effekttaxonomin), inte ett negativt tal — måste kollas FÖRE multiplikatorerna appliceras, inte som `kp × 0`. ⚠ Infektionsmekaniken själv är inte byggd än (`DESIGN_DECISIONS.md` §10.3d) — det här facit-fallet gäller dagen den är det.

### UC-R7 — Multiplikator komponerar med det BEFINTLIGA resa/äventyr-avdraget, ersätter det inte
**Setup:** Rollperson med Gott läkekött (×2) reser (`kind:"resa"`, redan `healDivisor: 2` i `TIME_KINDS`).
**Situation:** En vecka på vägen.
**Förväntat:** Nettoeffekt = **normal takt** (2× förmåga × 0,5× resa-avdrag = 1×), INTE dubbel takt (vilket vore fallet om förmågan felaktigt ignorerade reseavdraget) och INTE halverad takt (vilket vore fallet om förmågan aldrig applicerades under resa). Bra regressionstest för att `applyHealing()`s befintliga `healDivisor`-logik och en ny modifierarkrok samverkar rätt, inte att den ena råkar skriva över den andra.

### UC-R8 — Tak vid max-KP, en multiplikator får inte overheala
**Setup:** Rollperson med Gott läkekött, ett träffområde 1 KP under sitt tak.
**Situation:** En vilovecka (skulle normalt läka 2 KP med förmågan).
**Förväntat:** Området läker bara till sitt EGET tak (1 KP i det här fallet), inte 2 KP över. Redan `Math.min(state.max, ...)`-skyddat i `applyHealing()` — verifierar bara att en tillagd multiplikator matas in FÖRE clamp:en, inte efter (annars klipps rätt tal av fel anledning).

---

## Grupp B — PSY-återhämtning (motorn finns inte alls — dessa fall kräver att den byggs FÖRST)

### UC-R9 — Föremål/förmåga: God mental kontroll (passiv, halverad tid = dubbel takt)
**Setup:** Magiker med förmågan "God mental kontroll" (rad 74).
**Situation:** En timmes fullständig vila passerar (hypotetiskt tidsfönster-stöd för timgranularitet, se UC-R13).
**Förväntat:** 2 PSY återvunna i stället för normala 1. ⚠ "Ej för icke-magiker" — förmågan har ALDRIG effekt på en karaktär utan PSY-resurs; bör vara ett no-op, inte ett fel, om den råkar hamna på en icke-magiker.

### UC-R10 — Föremål: en meditationsfokus (utrustningsbunden, kräver `equipped`)
**Setup:** Ett magiskt föremål "Meditationsstav" med `+50 % PSY-återhämtning medan buren`.
**Situation:** Karaktären bär staven under en vilotimme, tar sedan av den.
**Förväntat:** Bonusen gäller bara MEDAN buren — samma `equipped === true`-mönster som redan finns för `skillModifiers` på `utrustning`/`vapen`/`rustning` (§6). Tas staven av mitt i en pågående vilo-tick ska den ÅTERSTÅENDE tiden inte längre få bonusen.

### UC-R11 — Besvärjelse: en tillfällig PSY-återhämtningsbuff
**Setup:** En besvärjelse "Sinnesro" kastas på en karaktär, varar 4 timmar, dubblar PSY-återhämtning under tiden.
**Situation:** Karaktären vilar 2 av de 4 timmarna, reser sedan vidare (buffen är fortfarande aktiv, personbunden).
**Förväntat:** Till skillnad från UC-R2 (scenbunden) MÅSTE den här effekten vara **person-scopad med riktig `ActiveEffect#duration`** — den ska fortsätta gälla även om karaktären byter scen mitt i sina 4 timmar, exakt den distinktion Grupp-scope-diskussionen (`GM_EFFEKTFONSTER_ANALYS.md`) redan drog för välsignelser. En besvärjelse är i praktiken alltid person-scope, aldrig scen-scope, just för att den ska följa personen.

### UC-R12 — Scen: Dimön, den ursprungliga tvetydigheten upplöst
**Setup:** Dimön-scenen har en effekt "×2 PSY-återhämtning medan man befinner sig här" (den KORREKTA tolkningen av backlog 19:s "Dimön PSY×2", disambiguerad 2026-08-05 — se `GM_EFFEKTFONSTER_ANALYS.md` typ 6 vs. typ 3).
**Situation:** En grupp rollpersoner vilar en natt på Dimön.
**Förväntat:** Dubbel PSY-återhämtning för alla på scenen den natten, upphör när de lämnar ön — samma `SceneEffects`-liknande "presence-bound"-princip som UC-R2, fast för en helt annan resurs och en helt annan tidsgranularitet (timmar, inte veckor).

### UC-R13 — PSY:s egen takttabell skiljer sig från HP:s, kan inte återanvända `TIME_KINDS` rakt av
**Setup:** Ingen — ren mekanikjämförelse.
**Situation:** —
**Förväntat:** HP:s `TIME_KINDS.healDivisor` är `{vila: 1, resa: 2, äventyr: 2}` (RP-SLB s.20). PSY:s takt (RP 22.6) är **`{fullständig vila: 1/timme, kroppslig aktivitet: 1/3 timme}`** — en helt annan uppsättning kvoter OCH en annan tidsenhet (timmar, inte veckor). En framtida `applyPsyRecovery()` behöver sin EGEN tabell, inte en delad `TIME_KINDS`-rad — att tvinga in PSY i HP:s vecko-baserade `healDivisor`-modell hade gett fel svar även utan någon multiplikator inblandad.

### UC-R14 — Interaktion med sömnklockan (EP): oberoende spår, inte samma flagga
**Setup:** Karaktär vilar en timme (PSY-återhämtning-tick) och har samtidigt en pågående sömnklocka för EP-intjäning (`clearEpTicks`, redan byggd, ≥6 timmar).
**Situation:** En timmes vila passerar — för kort för att nollställa sömnklockan (kräver 6h), men tillräckligt för minst en PSY-tick.
**Förväntat:** PSY-återhämtningen sker OBEROENDE av sömnklockans 6-timmarströskel — en kortare vila ger fortfarande PSY tillbaka även om den inte är lång nog för att trigga EP-relaterade effekter. Två separata räknare som råkar drivas av samma klocka, inte en delad tröskel.

### UC-R15 — Negativ modifierare: ett förbannat föremål som HALVERAR PSY-återhämtning
**Setup:** Ett förbannat föremål, buret, `×0,5 PSY-återhämtning`.
**Situation:** Karaktären vilar en timme med föremålet på sig.
**Förväntat:** Bekräftar att modifierarschemat inte är hårdkodat till bara positiva buffar — samma `operation:"multiply"`-mekanism med `value < 1` ska fungera för nerskruvningar också, ingen separat "debuff"-kodväg behövs.

---

## Grupp C — Stridsmiljö (Johan 2026-08-05: testa återhämtning i strid)

Samma Setup/Situation/Förväntat-mönster som ovan, men här specificerat strikt som **Aktör(er) / Miljö / Förväntat resultat** per Johans uttryckliga krav — ett tydligare facit att köra live mot, inte bara läsa.

### UC-R16 — Stridsrundor i sig ger ingen återhämtning
**Aktör(er):** En rollperson med 15/20 HP, en skadad arm (3/5 KP), inget aktivt recovery-relaterat föremål/förmåga.
**Miljö:** En riktig `Combat`-encounter, rollpersonen tillagd som combatant, **tre riktiga rundor** avancerade via `combat.nextRound()` (inte ett syntetiskt anrop till egna funktioner).
**Förväntat resultat:** HP och `hitLocations` är **helt oförändrade** efter alla tre rundorna. `applyHealing`/`applyPsyRecovery` anropas ALDRIG av `combatRound`-hooken — den gör bara `game.time.advance(5)` plus periodiska drain-tickar (gift m.m.). `TIME_KINDS` saknar helt en `"strid"`-nyckel, vilket är avsiktligt: återhämtning är en vilo-mekanik, inte en stridsmekanik.

### UC-R17 — Giftets periodiska drain fungerar i EN RIKTIG strid, inte bara i en manuell testloop
**Aktör(er):** En förgiftad rollperson (`kind:"periodic"`, `cadence:"round"`, `amount:2`, `ticksRemaining:3`).
**Miljö:** Samma `Combat`-encounter som UC-R16, tre riktiga rundor.
**Förväntat resultat:** HP minskar med 2 varje runda (−6 totalt efter tre rundor), `ticksRemaining` räknas ner till 0 och den periodiska effekten tas bort automatiskt efter tredje tick:en. Bekräftar att `Hooks.on("combatRound", ...)`-konsumenten (dode.mjs) verkligen kopplar till en RIKTIG `Combat`s rundbyte, inte bara till en direkt funktionsanrops-simulering (som redan testats tidigare, men aldrig i en genuin Combat-dokument-livscykel).

### UC-R18 — En recovery-modifierare överlever striden och gäller normalt för vilan EFTER
**Aktör(er):** Rollperson med Gott läkekött (×2 HP), skadad under striden.
**Miljö:** Strid pågår och avslutas (`combat.endCombat()`), därefter en vecka `vila` via det riktiga tidsfönstrets `advanceTime()`.
**Förväntat resultat:** Läkningen efter striden sker med den fulla ×2-takten, precis som om striden aldrig hänt — `recoveryModifierTotals` är helt okopplat från om `game.combat` existerar eller inte, det är bara en egenskap hos aktören själv.

### UC-R19 — Giftskada och en HP-recovery-multiplikator korsbesmittar INTE varandra
**Aktör(er):** En rollperson som är BÅDE förgiftad (periodisk drain) OCH bär Gott läkekött (×2 HP-återhämtning) samtidigt.
**Miljö:** Strid pågår (giftet tickar varje runda), följt av vila efter striden.
**Förväntat resultat:** Giftskadan per runda är **exakt 2 KP, opåverkad** av läkekötts-multiplikatorn — "Gott läkekött" gäller uttryckligen "fysiskt våld eller elementarbesvärjelser", inte gift, och `tickPeriodicEffect` läser aldrig `recoveryModifierTotals` över huvud taget (helt separata kodvägar som bara råkar dela samma `hp.value`-fält). Vilan efter striden läker däremot med sin fulla ×2-bonus som vanligt.

### UC-R20 — Striden tar slut medan giftet fortfarande har tickar kvar ✅ löst 2026-08-05
**Aktör(er):** Förgiftad rollperson, `ticksRemaining:5`.
**Miljö:** Striden avslutas (`combat.endCombat()`) efter bara 2 rundor — 3 tickar återstår. Rollpersonen är sedan strandsatt i öknen, ingen ny strid startar.
**Förväntat resultat:** Den periodiska effekten (en ren aktörsflagga, inte kopplad till själva `Combat`-dokumentet) **överlever** stridens slut med `ticksRemaining` nedräknat till 3. När SL sedan flyttar världsklockan via tidsfönstret (`kind:"aventyr"`, t.ex. några timmar av ökenvandring) tickar giftet KLART **utanför strid också** — `DODE.applyPeriodicTicksForElapsedTime()` (config.mjs) räknar om förfluten tid till hela stridsrundor (`Math.floor(seconds / SECONDS_PER_ROUND)`) och tickar alla `cadence:"round"`-effekter i en batch, wired in i `advanceTime()` (time.mjs) så det körs automatiskt varje gång SL flyttar tiden, ingen extra knapp behövs.
⚠ **HP klampas inte längre vid 0** (samma commit) — om giftets ackumulerade skada räcker kan offret faktiskt dö av exponering, konsekvent med `anatomy.mjs#applyLocationDamage`s dödsmodell (RP/SLB s.18-20: 0 till −FYS blöder, ≤−FYS dör). Ett tidigare `Math.max(0,...)`-klamp gjorde gift strukturellt oförmöget att döda; det var en bugg, inte ett designval.
**GM-rutin:** se "SL-rutin: Effekter och återhämtning utanför strid" nedan.

---

## Sammanfattning

⚠ **Uppdaterad 2026-08-05 efter implementation** — se `docs/DESIGN_DECISIONS.md` backlog 37 för hela byggloggen. Tabellen nedan beskrev ursprungligen vad som SKULLE krävas; kolumnerna är nu status, inte en plan.

| Fall | Status | Kvarstående/öppet |
|---|---|---|
| UC-R1–R3, R6–R8 | ✅ Byggt och liveverifierat (`applyHealing()` + `recoveryModifierTotals`) | UC-R6 (infektionsblockering) väntar på att infektionsmekaniken själv byggs, backlog 56 |
| UC-R4 (Läkekonst) | ❌ Inte byggt — kräver ett eget veckoslag kopplat till tidsfönstret, inte bara en modifierar-rad | |
| UC-R5 (stapling) | ✅ Löst strukturellt — sekventiell `multiply *=`-komposition, samma sak Foundrys egna AE-pipeline redan gör. Inget separat beslut behövdes. | |
| UC-R9–R15 (all PSY) | ✅ Byggt och liveverifierat — `applyPsyRecovery()` + egen `PSY_RECOVERY_SECONDS`-tabell | |
| UC-R16–R19 (stridsmiljö: ingen återhämtning i strid, gift tickar rätt, ingen korsbesmittning) | ✅ Liveverifierat 2026-08-05, **men om igen 2026-08-06 med en riktig canvas-token/`Combat`** efter att Johan påpekade att det första testets `Hooks.callAll`-genväg inte räknades som ett riktigt test (se raden nedan) — resultatet höll, men två separata, tidigare dolda buggar hittades och fixades under omtestet. | |
| UC-R20 (striden slutar med tickar kvar) | ✅ Byggt 2026-08-05, **omtestat och korrigerat 2026-08-06 efter Johans direktiv: "all characters should be on canvas with real test characters or it cannot be considered a real test. Hook tests are nice shortcuts, but is exactly usually the place where things break or are misled."** Det ursprungliga testet använde `Hooks.callAll("combatRound", fakeCombat, {}, {direction:1})` med ett handkonstruerat `{combatants:[{actor}]}` i stället för en riktig `Combat` — en genväg vald eftersom en `Combatant` utan riktig token/scen-placering kraschar Foundrys egen turordningskod. Ett omtest med en riktigt PLACERAD, `actorLink:true`-token, en riktig `Combat`/`Combatant`, och riktiga `combat.startCombat()`/`combat.nextRound()`-anrop (inklusive ett rapid-fire-pass utan konstgjord fördröjning) hittade **två riktiga buggar hook-genvägen aldrig kunde avslöja**: (1) en race condition i `tickPeriodicEffect` (config.mjs) — två snabbt påföljande `nextRound()`-anrop kunde läsa samma gamla hp/ticksRemaining-ögonblicksbild och tappa en tick helt tyst, utan konsolfel; fixat genom att slå ihop HP- och flagguppdateringen till EN atomär `actor.update()` och lägga en per-aktör-kö (`_queuePerActor`) som tvingar överlappande anrop att köra i tur och läsa färskt tillstånd. (2) `#computeSkillModifiers`/`#computeRecoveryModifiers` (`actor-character.mjs`) använde `actor.getActiveTokens(true)` utan andra argumentet `document:true` — det returnerar RITADE placeable Token-objekt (`.parent` = canvas-lagret), inte token-DOKUMENTET (`.parent` = Scenen), vilket kraschade `scene?.getFlag is not a function` för VARJE färdighetsslag/återhämtningsberäkning så fort en riktig token faktiskt stod synlig på den visade scenen — ett fel inget tidigare script-only-test kunde hitta eftersom `getActiveTokens(true)` returnerar `[]` (tyst fallback till `game.scenes.active`) om ingen token faktiskt är ritad på just den scenen som visas. Båda fixade och omverifierade: rapid-fire (3 riktiga rundor, ingen fördröjning) tickade nu korrekt exakt 3 gånger (6→0 HP), och 2 återstående tickar löstes klart via `advanceTime()` utanför strid ner till **−4 HP**, med `skillModifierTotals` bekräftat krasch-fritt på samma aktör. Se `CLAUDE.md`s "Livetestregler" för den nya stående regeln detta gav upphov till. Se SL-rutinen nedan. | |

---

## SL-rutin: Effekter och återhämtning utanför strid

> Tillagd 2026-08-05, svar på Johans fråga: "hur hanterar SL kvarvarande gifttickar när striden är slut, och hur får en rollperson dö av gift medan hen är strandsatt någonstans utan strid?" — generaliserad 2026-08-06 på Johans begäran ("The routine should be more generic. Like 'effects and recovery outside battle'") eftersom det ursprungliga skrivet bara pratade om gift, trots att mekanismen är exakt densamma för ALL återhämtning och ALLA periodiska effekter. Flyttad hit från `SPECIALANFALL_SL_GUIDE.md` — det där är specifikt manuella specialanfall, det här är den generella tidsflytt-motorn.

**Kärnprincipen: `advanceTime()` är den EN platsen SL flyttar klockan utanför strid** (Tidsfönstret, `apps/time-window.mjs` — samma verktyg för vila/resa/äventyr), och den löser **tre olika saker** för varje vald rollperson i samma anrop, ingen av dem kräver ett separat steg:

1. **HP-återhämtning** (`applyHealing()`) — naturlig läkning per skadat träffområde, SLB s.20.
2. **PSY-återhämtning** (`applyPsyRecovery()`) — RP 22.6.
3. **Periodiska effekter** (`DODE.applyPeriodicTicksForElapsedTime()`) — DRAR ihop, inte bara läker. I dag bara Gift (`DODE.applyPoisonEffect`), men mekanismen är generisk: **vilken som helst effekt med `cadence:"round"`** (frost, eld, blödning m.fl. — se `GM_EFFEKTFONSTER_ANALYS.md`s statuseffektaudit för vilka som väntar på egen sourcing) skulle ticka klart via samma väg utan kodändring, den dagen den effekten byggs.

Alla tre lagras som flaggor på AKTÖREN (inte på ett `Combat`-dokument eller scenen), så de **överlever** att striden tar slut oavsett vad som återstår. SL behöver inte göra något särskilt för att bevara dem.

**Så här löser SL ut väntande effekter/återhämtning när ingen strid pågår:**

1. Öppna **Tidsfönstret** och välj rätt tidsslag (t.ex. "Äventyr, 3 timmar" för en ökenvandring, eller "Vila, 1 vecka" för en läkningsperiod).
2. Flytta klockan som vanligt. Det är allt — `advanceTime()` kör alla tre stegen ovan automatiskt för varje vald rollperson. Chattkortet visar hur mycket som läkte/återficks/tickade, i klartext.
3. **Periodiska effekter räknas i hela stridsrundor** (5 sekunder/runda, `Math.floor(seconds / SECONDS_PER_ROUND)`) och löses i EN batch, inte en loop — en förflutning på flera dagar tickar alltså klart en flerveckorseffekt direkt i ett enda `advanceTime()`-anrop.
4. Om en dränerande effekts ackumulerade skada tar rollpersonen under 0 KP gäller samma dödsmodell som i strid (RP/SLB s.18-20): 0 till −FYS är "blöder" (kräver stabilisering), ≤−FYS är död. HP klampas INTE vid 0 — ett offer kan faktiskt dö av exponering (gift, eller en framtida periodisk effekt) utan att SL manuellt behöver döda karaktären.
5. **GM-avbrott/nödåtgärd:** en SL som vill avbryta en periodisk effekt i förtid (motgift, mirakel, etc.) tar bort den direkt: `CONFIG.DODE.removePeriodicEffect(actor, effectId)` i konsolen, eller via GM-effektfönstret när dess ApplicationV2-UI finns (just nu konsol-only — se `DESIGN_DECISIONS.md` §3 0g).
6. **Manuell KP-/PSY-återställning** (SL vill sätta en karaktär till fullt utan att gå via tidsflytt, t.ex. efter en överhoppad scen): sätt fältet direkt, `actor.update({"system.hp.value": actor.system.hp.max})` eller motsvarande för `system.resources.psy.value` — påverkar inte kvarvarande `ticksRemaining` på en aktiv periodisk effekt, den fortsätter ticka nästa gång tiden flyttas om den inte också tas bort separat enligt punkt 5.
