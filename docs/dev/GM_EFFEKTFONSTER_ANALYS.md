# GM-effektfönster (person/scen/värld) — mekanisk analys

> Skapad 2026-08-04, som svar på Johans idé att samla flerhandsstridens lösa trådar (`docs/dev/STRID_FLERHAND_ANVANDNINGSFALL.md`) och den redan existerande backlog 19 ("Scene/macro modifier system... Requires the universal modifier system") under EN GM-vänd yta i stället för många punktlösningar. **Ren analys — inget byggt än.** Slutsatsen är att idén är rätt riktning, men att den inte blir EN datamodell — den blir EN författningsyta ovanpå TRE olika lagringsplatser och (minst) TRE olika konsumtionspunkter, för att det redan finns tre olika sorters "effekt" i systemet som inte beter sig likadant.

---

## Vad som redan finns — tre separata mekanismer, ingen av dem scen-/världsmedveten

| Mekanism | Var | Räckvidd idag | Hur den läses |
|---|---|---|---|
| **ActiveEffects** (`DoDeActiveEffect`, `shouldApplyChange`) | Ras-/utrustnings-AE:er på aktören | Bara aktörens EGNA schemafält (attribut, HP …) — kan INTE rikta ett embeddat Item | `Actor#appliedEffects`, Foundrys egen `prepareDerivedData()`-kedja |
| **`system.skillModifiers`** (`formaga`/`utrustning`/`vapen`/`rustning`-items) | Embeddade Items på aktören | Namngivna färdigheter (`skillKey`), bara ADDITIVT | Live getters `skillModifierTotals`/`skillModifierSources` (`actor-character.mjs`) — räknas om vid VARJE läsning, se §6-regeln om varför de är getters och inte cachade fält |
| **Situationella CL-modifierare** (`MELEE_MODS`/`RANGED_MODS`, `rolls/attack.mjs`) | Ett vanligt JS-objekt, satt av ANROPAREN till `resolveAttack()` | Bara det enskilda anropet — ingen persistens, ingen UI, ingen aktör äger dem | Summeras direkt i `resolveAttack()`, aldrig sparat |

**Ingen av de tre är scen- eller världsmedveten.** Backlog 19:s "Dimön PSY×2" går inte att uttrycka i någon av dem: AE:er är actor-scoped, `skillModifiers` är actor-scoped OCH bara additiv (×2 är multiplikativt), och CL-modifierarna är per-anrop och försvinner.

⚠ **Korrigering, hittad under implementationen 2026-08-04 — den här slutsatsen var fel.** Projektet har redan `scripts/utils/scene-effects.mjs` (`game.dode.SceneEffects`, klar och dokumenterad sedan tidigare i `DESIGN_DECISIONS.md` §1/§2): `applyToScene(effectData)` skapar en riktig `ActiveEffect` på VARJE aktör med en token på den just nu aktiva scenen, `removeFromScene(name)` tar bort dem igen, båda taggade `flags.<system.id>.source:"scene"`. Det HÄR är redan "Dimön PSY×2"s lagringslösning för attributnivå-fallet — bara utan ett GM-vänligt formulär framför sig (kräver idag ett handskrivet konsolanrop). Missades i den ursprungliga analysen eftersom jag grep:ade Foundrys KLIENT efter native primitiv men inte projektets EGEN kod efter tidigare scenarbete — samma "kolla vad som redan finns"-princip som resten av dokumentet argumenterar för, tillämpad på fel sökyta. Kvar att bygga: bara ett formulär i effektfönstret som anropar `SceneEffects` i stället för att SL skriver JS för hand, plus den fortsatt genuint saknade biten (namngivna färdighetsmodifierare på scen-/världsnivå, som `SceneEffects` INTE kan uttrycka eftersom AE:er bara kan rikta aktörens egna schemafält, inte embeddade `skillModifiers`-poster).

---

## Sex olika EFFEKTTYPER, inte fyra — reviderat 2026-08-05 efter Johans genomläsning av mockupen

Att bygga fönstret är enkelt (ett ApplicationV2 med flikar). Det som behöver bestämmas är vad en rad i listan FAKTISKT gör och VILKEN mekanism den ska drivas av — och listan var fortfarande fel så sent som i mockupraden "Dimön — PSY×2 · skillMod × · PSY, ×2" (Johan, 2026-08-05): PSY är en grundegenskap, aldrig en `skillMod`, oavsett operation. Sex typer, inte fyra:

1. **Namngiven färdighetsbonus, additiv** — det `skillModifiers` redan gör (+5 Smyga medan buren). Scen-/världsversionen är samma sak riktad mot "alla på scenen"/"alla i världen" — den NYA `DODE.namedSkillModEffects`-lagringen (config.mjs).
2. **Namngiven färdighetsbonus, MULTIPLIKATIV** — samma lagring, `operation:"multiply"`.
3. **Grundegenskapsbonus (attribut), add/multiply** — ⚠ **INTE samma sak som 1/2, en helt annan mekanism.** Attribut kan vara ett riktigt AE-mål (till skillnad från namngivna färdigheter, §6), så det här går via en RIKTIG `ActiveEffect` — `game.dode.SceneEffects` på scennivå, ett vanligt Person-scope-AE annars. **Dimön PSY×2 hör hemma HÄR om innebörden är "PSY-attributets värde/bonus dubbleras"** — inte i `skillMod`-lagret, som bara känner till namngivna färdigheter.
4. **Situationell slagmodifierare (CL)** — `MELEE_MODS`-mönstret (skymning −5, sköldhand −10 …). Ett tillägg till ETT slag, inte en stående bonus. `DODE.situationalClMods`.
5. **Villkor/spärr (boolskt, inget tal alls)** — "armen obrukbar", "handen upptagen". Ingen summering, bara ett sant/falskt en framtida handlingsekonomi frågar. `CONFIG.statusEffects`/`DODE.actorConditions`.
6. **Återhämtningstakt (recovery rate) — NY, genuint obyggd** (Johan, 2026-08-05). **Om Dimön PSY×2 i stället betyder "PSY återhämtas dubbelt så fort" är det VARKEN typ 3 (ett engångsvärde) ELLER en periodisk skadetick (`kind:"periodic"`, byggd 2026-08-05 för GIFT — den drar bara, den återställer aldrig).** Det finns i dagsläget INGEN återhämtningsmekanism i kodbasen alls att modifiera — RP:s regel (1 PSY/timme fullständig vila, 1 PSY/3 timmar kroppslig aktivitet, ur `DODE_Grundregelbok_fullextract.md` 22.6) är sourcead men aldrig automatiserad, ingen koppling till vilo-/tidsfönstret (`apps/time-window.mjs`) finns. Att bygga en `×N`-modifierare på recovery FÖRUTSÄTTER att recovery-tick-motorn byggs först — en egen, separat funktionsyta, inte en rad i effektschemat. Loggat i `docs/DESIGN_DECISIONS.md` backlog.

**Konsekvens:** effektfönstrets datarad för typ 1/2/4 (de tre som saknar en Foundry-egen hemvist) behöver formen `{scope, kind: "skillMod"|"clMod", operation, skillKey, value, duration, källa}`. Typ 3 (attribut) skrivs INTE till den här raden alls — den är ett formulärläge som skapar/ändrar en riktig `ActiveEffect` i stället. Typ 5 (villkor) är `CONFIG.statusEffects`/Token HUD, inte heller en rad här. Typ 6 (recovery) kan inte byggas förrän en helt annan motor finns.

---

## Grupp-scope (en välsignelse över flera veckor) — Johans fråga 2026-08-05

**Scen-scope är fel verktyg för det här, och det är avsiktligt, inte en bugg.** `SceneEffects` applicerar uttryckligen på "vem som råkar ha en token på den AKTIVA scenen just nu" och glömmer den kopplingen så fort token lämnar scenen (`removeFromScene` städar, men ingenting FÖLJER MED till en ny scen automatiskt). En välsignelse som ska hålla i veckor MÅSTE alltså överleva scenbyten — vilket betyder att den inte kan bo på scenen alls, den måste bo på VARJE PERSON.

**Goda nyheter: mekanismen finns redan, ingen ny lagring behövs.** Person-scope-effekter är redan riktiga `ActiveEffect`s med Foundrys egen `duration` (dagar/timmar fungerar precis som rundor). "Grupp" är alltså bara **person-scope applicerat på flera aktörer i EN handling** — ett multi-val ovanpå den redan befintliga per-aktör-vägen, inte en fjärde lagringsplats. Foundry har inget eget "Party"-dokument att haka i (ingen sådan konceptuell nivå finns i kärnan), så väljaren blir en enkel checklista — partymappens innehåll, eller just nu markerade tokens på canvasen — som skapar samma `ActiveEffect`-data som EN individuell handling, bara N gånger i rad.

**Vägledning för vilket scope som är rätt, för att undvika samma missförstånd igen:**
- **Scen** = "gäller medan man är HÄR", ska sluta gälla när man lämnar (Dimöns omgivningsmagi).
- **Person/Grupp** = "gäller DEN HÄR PERSONEN oavsett var de går", precis som en riktig välsignelse eller förbannelse ska bete sig.
- **Värld** = "gäller alla, överallt, tills SL tar bort det".

Ingen ny kod skriven för det här ännu — men fönstrets Person-flik bör få ett multi-välj-läge ("applicera på flera") i stället för att bara ta en aktör i taget, när fönstret väl byggs.

---

## Lagring per scope — Foundry ger oss inte en enda naturlig plats

- **Person:** redan löst i grunden (typ 1/2 → `skillModifiers`-liknande fält; typ 4 → en ny lättviktig `conditions`-lista, se nedan). Effektfönstrets person-flik är bara en GM-genväg till att skapa/ta bort dessa poster utan att gå via ett riktigt Item.
- **Scen:** `Scene#flags.<system.id>.effects` — ett nytt flaggfält, ingen befintlig mekanism täcker det. ⚠ Värt att kolla om Foundry v12+ **Regions** (`SceneRegion`) är en bättre naturlig hemvist än en platt flagga — Regions är byggda för "något gäller inom det här området", men deras inbyggda triggers är rörelse-/händelsebaserade, inte "gäller passivt för alla här". Troligen enklare att bara läsa `canvas.scene.getFlag(...)` när ett slag löses och kolla om den agerande tokenens scen matchar, snarare än att pressa in det i Regions-modellen.
- **Värld:** ingen Document-typ passar naturligt (jämför `trainingFeePerWeek`, som är EN inställning, inte en lista GM:en kan lägga till/ta bort ur mitt i spelet). Behöver ett nytt `game.settings.register(..., {scope:"world", type: Array})`-baserat register, med egna GM-API-metoder (`addWorldEffect`/`removeWorldEffect`) snarare än att GM:en redigerar råa Settings-JSON.

**Slutsats:** "ett universellt system" blir i praktiken **en gemensam radform + ETT fönster som skriver till tre olika bakänder**, plus en fjärde, ny lagringsplats för villkor (typ 4) som inte har någon nuvarande motsvarighet ens på personnivå.

### Rättelse — typ 4 (villkor) på personnivå har troligen INTE en tom lagringsplats, Foundry ger oss en gratis

Johans observation (2026-08-04): Foundrys egna Actor-ark visar redan statusikoner (sovande, brinner, m.fl.) via `CONFIG.statusEffects`. **DoDE rör aldrig `CONFIG.statusEffects` idag** (verifierat, ingen sökträff i `scripts/`) — systemet kör på Foundrys OFÖRÄNDRADE kärnlista (Blinded/Dead/Deafened/Fly/Hidden/Invisible/Paralysis/Poisoned/Prone/Restrained/Stunned/Unconscious). Det är en gratis vinst att bygga typ 4 (villkor) OVANPÅ det här i stället för en helt egen lista:

- Lägg till DoDE-specifika poster (`handUpptagen`, `armObrukbar`, …) i `CONFIG.statusEffects` via `Hooks.once("init")`, med egna ikoner (samma bildpipeline som allt annat spelinnehåll).
- Varje post blir en riktig `ActiveEffect` med `statuses: [id]` när den slås PÅ — vilket ger ikon-på-token, `Combat`-integrering och `actor.toggleStatusEffect(id)`-API:t GRATIS, utan att uppfinna ett eget lagringsformat.
- Effektfönstrets person-flik blir då till stor del en trevligare yta ovanpå `token.toggleStatusEffect()` + en duration, inte en ny datamodell.
- ⚠ En sak att verifiera innan det låses: om statusikoner är synliga för SPELARE som standard (troligen ja, Foundry-kärnbeteende) — relevant för öppen fråga 3 nedan.

Det här slår ihop typ 4:s lagringsfråga med den redan existerande AE-mekanismen (rad 1 i tabellen ovan) i stället för att bli en fjärde, helt separat plats — en riktig förenkling av analysen ovan, inte bara en ny idé på sidan om.

---

## Tre konsumtionspunkter — var koden faktiskt måste fråga

1. **Stående bonusar (typ 1/2):** utöka de BEFINTLIGA `skillModifierTotals`/`weaponGroupBonusTotals`-gettrarna att, utöver aktörens egna items, också läsa `canvas.scene.getFlag(...)` och det nya världsregistret. Minimal ändring — samma summeringsmönster, fler källor.
2. **Situationella CL-mods (typ 3):** `resolveAttack()`s `mods`-parameter byggs redan upp av ANROPAREN idag (ren JS, ingen persistens). Den framtida anropskoden (dialogen/handlingsekonomin) behöver hämta scen-/världseffekter av typ 3 och lägga till dem i `mods` INNAN anropet — `resolveAttack()` själv behöver inte ändras alls, bara den kod som fyller i `mods`.
3. **Villkor (typ 4):** helt ny konsument — den obyggda handlingsekonomin (backlog 32) måste fråga "har den här aktören ett aktivt `handOccupied`/`armObrukbar`-villkor?" innan den tillåter en Två vapen-handling. Det här är den enda av de tre som inte kan hänga på en BEFINTLIG kodväg, eftersom ingen kodväg frågar efter villkor idag.

---

## Vad det HÄR fönstret specifikt löser i flerhandskatalogen

| Flerhandsfall | Löses av effektfönstret? | Typ |
|---|---|---|
| UC-F17 (handen upptagen, ingen skada) | ✅ Ja — exakt den lucka som redan flaggades ("nytt datafält saknas helt") | 4 (villkor), person-scope |
| UC-F20b (Morgonstjärna negerar sköld) | ⚠ Delvis — det här är en VAPENEGENSKAP (`negatesParryType` på `item-vapen.mjs`), inte en GM-satt effekt. Fönstret är fel verktyg; datamodellen (redan planerad) är rätt. | — (hör inte hemma här) |
| UC-F15/F16 (armen obrukbar av skada) | ⚠ Ja, men som en GENVÄG, inte en dubblett — se nästa rad | — (redan byggt, annan väg) |
| **Johans nya fall: "SLP stympar en spelares arm för berättelsen"** | ✅ Ja — och det här ÄNDRAR slutsatsen ovan. En SL som vill tvinga fram "armen obrukbar" NARRATIVT (inte via ett uträknat skadeslag) behöver en snabb väg in i `hitLocations` — annars måste hen räkna ut och slå in exakt rätt skada för hand. Effektfönstrets person-flik bör alltså ha en **genväg som sätter `hitLocations.<del>.value` direkt** (samma `locationEffect()`-konsekvens som ett vanligt slag skulle ge), INTE ett parallellt villkor som konkurrerar med skademodellen. Skillnaden mot ursprungsslutsatsen: fönstret får äga en INMATNINGSYTA till `hitLocations`, men inte en egen sanning vid sidan om den. |
| Backlog 19 (Dimön PSY×2 + lättare att göra besvärjelser) | ✅ Ja — men **två samtidiga effekttyper på samma scen/modul**, inte en. "PSY×2" (troligen läkningstakt/återhämtning) är typ 2 (multiplikativ). "Lättare besvärjelser" är sannolikt typ 3 (en CL-bonus på besvärjelseslag, motsvarande `MELEE_MODS`-mönstret men för magi i stället för strid) — de får inte klumpas ihop till en rad. | 2 OCH 3 samtidigt, scen-scope |
| Skymning/mörker-CL, generell dimma | ✅ Ja | 3, scen-scope |
| Tillfällig "ambidextriös av en förbannelse" | ✅ Troligen — men se öppen fråga nedan | 4 (nu: `CONFIG.statusEffects`), person-scope |

**Viktig avgränsning:** fönstret ska INTE bli en tredje väg att sätta fysisk skada (typ 4-villkor som redan har en väg via `hitLocations` ska förbli där) och INTE bli hemvisten för vapenspecifika regler som `negatesParryType` (det är data på vapnet, inte något en GM "lägger på" en scen). Fönstrets rätta område är: **GM-improviserade, tillfälliga, narrativt motiverade förhållanden som inte redan har en mekanisk hemvist** — väder, förbannelser, scenspecifika regler, en NPC som håller en fackla. Allt som redan har en datamodell (skada, utrustning, tränade färdigheter) ska fortsätta gå den vägen.

---

## Öppna frågor innan det här kan bli en plan

1. **Ska en tillfällig "ambidextriös av effekt" verkligen trigga samma träningsundantag som det permanenta `swordHand`-fältet** (CLAUDE.md:s nya avsteg)? Om ja, blir konsumtionen av typ 4-villkoret mer invasiv än bara ett UI-flagga — det måste läsas av precis samma kod som läser `actor.system.swordHand` idag.
2. **Duration-modellen för scen/värld** — Foundry har inbyggt `ActiveEffect#duration` (rundor/sekunder/turer), och nu (se ovan) även gratis åt person-scope-villkor via `CONFIG.statusEffects`. Scen-/världsnivån har fortfarande INGEN motsvarande inbyggd urblekning. Behöver antingen (a) fästa en riktig `ActiveEffect` på en dold "scen-aktör"/world-level dokument bara för dess duration-maskineri, eller (b) en egen `game.time.worldTime`-baserad utgångskontroll, samma mönster som redan finns för `activationSeconds` på utrustning.
3. **Vem får se fönstret — och är statusikoner (typ 4) synliga för spelare som standard?** Fönstret rent GM-only är troligen rätt (som `training.mjs`/`#onAddSkill`-mönstret), men Foundrys `CONFIG.statusEffects`-ikoner syns normalt PÅ TOKEN för alla vid bordet — vilket sannolikt är önskat för "armen obrukbar" (spelaren ska se sitt eget handikapp) men kanske INTE för en dold SL-notering. Kan behöva två lägen (synligt villkor vs. tyst SL-anteckning), inte bara ett.
4. **Modul-/äventyrsscope, utöver person/scen/värld** — Johans Dimön-exempel väcker frågan om ett fjärde nivå behövs: en effekt som ska gälla för ALLA scener i en specifik kampanjmodul (`de-brutna-sigillens-kronika`), inte bara en enskild scen och inte hela världen. Troligen inget nytt lager behövs rent tekniskt — bara att GM:en applicerar samma scen-effekt på flera scener i följd, eller att en modul vid import sätter samma scen-flagga på alla sina scener — men värt att besluta explicit innan fönstret byggs, annars uppfinns en fjärde datamodell i onödan.

Inget av ovanstående är byggt. Rekommendationen är att **backlog 19 uppdateras för att peka hit**, och att en riktig Plan-mode-session körs för själva byggnationen (samma mönster som vapensystemet) den dag Johan vill gå vidare — det här dokumentet är underlaget, inte planen.
