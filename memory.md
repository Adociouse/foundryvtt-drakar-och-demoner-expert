# memory.md — Teknisk djupkontext

<!-- Motivering, arkitekturbeslut och gotchas per fas. Läs ACTIVE_TASK.md för snabb statuskoll först;
     kom hit när du behöver VARFÖR något byggdes som det gjordes, inte bara VAD som är klart. -->

---

## Arkitekturbeslut: allt kompendieinnehåll ligger i systemet, inte i separata moduler

Frågan kom upp (session 2): varför är monsterkompendiet inte en egen installerbar Foundry-modul?

- Actor/Item-**typdefinitioner** (`documentTypes`, DataModels, sheets) måste ligga i systemet — en modul kan inte registrera nya dokumenttyper i Foundry, bara innehåll för typer systemet redan definierat.
- Kompendie**innehållet** (raser, yrken, vapen, besvärjelser, monster) SKULLE kunna flyttas till en separat modul senare — vanligt, väl stött mönster — men Johan valde uttryckligen att låta det ligga kvar i systemet **tills vidare**, av samma skäl som `dnd5e` skeppar sitt eget SRD-innehåll direkt i systemet: enklare att underhålla soloprojekt, en manifest, en version.
- **Kampanjmodulen (fas 7) är fortfarande tänkt som separat modul** — det gäller specifikt kampanjspecifikt material (äventyr, unika NPC:er, journaler), inte kärnregelboksinnehåll som raser/monster/vapen. Den gränsen kvarstår.

Om detta ska ändras är det en ren omflyttning av `packs/`-mappar + `system.json`s `packs`-array till en ny modul — ingen omarkitektur av datamodellerna krävs.

---

## Fas 0–2 (session 1, 2026-07-18)

### system.json
- `id`: `drakar-och-demoner-expert` (matchar mappnamnet — mappen döptes om från `dode`)
- Inget `template.json` — modern DataModel-arkitektur

### Datamodeller (`scripts/data/`)
- `actor-character.mjs` — 7 grundegenskaper, härledda värden i `prepareDerivedData()`:
  - **Grupp** per egenskap (REGLER_EGENSKAPER.md, REG s.5–6)
  - **KP** = round((STO+FYS)/2)
  - **Skadebonus** från STY+STO-tabell (RP s.25, ⚠ gränsvärden bör verifieras mot original)
  - **Förflyttning** = tabelluppslag på floor((SMI+FYS+STO)/3) (RP s.24–25, ⚠ bör verifieras)
  - **Bärförmåga** = STY kg
- `item-fardighet.mjs` — färdighet med grundegenskap, kategori A/B, FV (direktvärde, inte EP-kostnad)

### Regelmekanik (`scripts/rolls/fv-roll.mjs`)
1T20 ≤ FV. Slår man 1 eller 20 görs ett bekräftelseslag mot samma FV som avgör perfekt/fummel — REGLER_STRID.md "Anfallsslag" + REGLER_EGENSKAPER.md "Grundegenskapslag" (samma konvention: etta lyckas alltid, tjugo misslyckas alltid).

### ✅ Live-verifiering
- Härledda värden verifierade mot handräknat facit: attribut 10 → Grupp 2, KP 10/10, Skadebonus (STY10+STO10=20) → `+1d4`, Förflyttning → 8 rutor
- Perfekt/fummel-slag testade med kontrollerad tärningsmotor (`CONFIG.Dice.randomUniform`, INTE `Math.random` — Foundry använder MersenneTwister)
- Klientspråk måste stå på svenska (`game.settings.set("core","language","sv")`) — systemet skickar bara `lang/sv.json`

### 🐛 Bugg: ApplicationV2 kräver ETT rot-element per PARTS-mall
HandlebarsApplicationMixin kräver att varje `PARTS`-mall renderar ett enda rot-HTML-element. Flera sheets hade från början header + flera section som syskon på toppnivå → krasch ("Template part must render a single HTML element"). Fix: linda in allt i en `<div class="dode-*-sheet-body">`. **Kom ihåg detta för varje ny sheet/Application-mall.**

### Gotcha: samtidig GM-session blockerar
Om Claude verifierar via Browser-verktyget samtidigt som Johan är inloggad som Gamemaster i samma värld blockerar sessionerna varandra (Foundry tillåter inte två samtidiga GM-anslutningar). Lösning: `game.socket?.disconnect()` + navigera bort innan Johan loggar in, eller starta om Foundry-servern.

---

## Fas 3 (session 2, 2026-07-18) — ras/yrke/vapen/rustning/besvärjelse

### Nya Item-typer
- **ras** — `bpCost`, `attributeMods` (STY/FYS/SMI/INT/PSY/KAR — **STO medvetet exkluderad**: RASER.md är tydlig med att STO anges som ett intervall spelaren väljer inom, inte en additiv modifierare), `stoRange` {min,max,normal}, `automaticAbilities`
- **yrke** — `requirements` (fritext, t.ex. "STY 14, FYS 12"), `professionAbility`, `skillList` (referenstext)
- **vapen** — grip/styGroup/damage/length/weight/baseValue/weaponType/category/range/price (REG s.58-59)
- **rustning** — enhetlig typ för kropp/huvud/sköld via `slot`-fält, abs/weight/price (REG s.53-54)
- **besvarjelse** — school (13 skolor)/sValue/duration/range/ritual/kvick (MAG s.8-13)

### Rollperson-kopplingen
Ras/yrke är ägda Item-dokument (max en av vardera — släpper man en ny ersätts den gamla via `actor-character-sheet.mjs#_onDrop`). Varje attribut har `value` (bas), `mod` (från ras), `total` (bas+mod), `group` (av `total`). Alla härledda värden räknar på `total`.

### Kompendier — byggda UTAN Foundry CLI
`node`/`npm`/`npx` finns inte på PATH i den här miljön (även om Foundrys egen server kör via `node main.js`), så `@foundryvtt/foundryvtt-cli`s `package pack` går inte att använda. Arbetsteknik som fungerar:
1. Skapa world-kompendium via `CompendiumCollection.createCompendium()` + `Item.createDocuments(data, {pack})` (körs live via Browser-verktyget)
2. Kopiera LevelDB-mappen `Data/worlds/<world>/packs/<name>/` → `Data/systems/<system>/packs/<name>/` (LOCK-filen går inte att kopiera — upptagen — men det är ofarligt, LevelDB återskapar den)
3. Registrera i `system.json`s `packs`-array
4. Relaunch världen (POST `/setup` → worldLaunch → join) för att Foundry ska läsa om manifestet
5. Verifiera med `pack.getDocuments()`, ta sedan bort det nu överflödiga world-kompendiet

**⚠ KRITISK REGEL (lärdom från fas 4, se nedan): lägg ALDRIG till en pack i `system.json` förrän mappen redan har sitt färdiga, kopierade innehåll.**

### Innehåll (59 items)
Alla 7 raser, alla 11 yrken, 18 vapen + 15 rustningsdelar (representativt urval — inte hela REG s.58-59), 8 exempelbesvärjelser (5 Elementarmagi + 3 Animism — inte hela formelboken).

### ✅ Live-verifiering
Dra-släpp testad med riktig `DragEvent`/`DataTransfer`: Dvärg-ras från skeppat kompendium släppt på testrollperson gav STY 10+3=13→Grupp 3, KP=11, Skadebonus→`+1d4` — stämde mot handräknat facit.

---

## Fas 4 (session 2, 2026-07-18) — NPC/monster

### Ny Actor-typ: npc
Enklare än rollpersonen — inga ras/yrke-item, inga färdighets-item. Fält: `attributes` (bara value+group), `hp`, `abs`, `damageBonus` (fritext, se nedan), `movement` (fritext), `moral`, `count`/`habitat`/`rarity`, `attacks` (ArrayField {name, fv, damage, note}), `skills` (fritext), `special`+`biography`.

### Designbeslut: Skadebonus är manuellt fält för NPC
KP-formeln (STO+FYS)/2 höll konsekvent mot alla kontrollerade MONSTER.md-block. Skadebonus gjorde INTE det: Krokodil (STY38+STO38=76) skulle enligt PC-tabellen ge `+3T6`, källan anger uttryckligen `2T6`. Samma avvikelse för Grottbjörn. Monster följer tydligen inte samma SB-progression som rollpersoner. Löst genom manuellt textfält istället för en formel som bevisligen är fel för stora varelser.

### Källans "GC XX%"-notation
T.ex. "Bett GC 50%" skiljer sig från 1T20≤FV-konventionen — troligen ett äldre percentilbaserat delsystem i Monsterboken 1 (1984). Värdena har lagts in rakt av som `fv` med källans procentsiffra bevarad i `note` snarare än att gissa en omvandling (t.ex. FV=GC/5).

### 🐛 KRITISK GOTCHA: stale LevelDB-cache vid för tidig pack-deklaration
Om en compendium-path deklareras i `system.json` INNAN mappen har riktigt innehåll öppnar Foundrys serverprocess en tom LevelDB-databas där — och **håller den öppen i processminnet resten av processens livstid**. Ingen mängd world-relaunch eller `system.json`-redigering hjälper. Skriva över filerna på disk fungerar inte heller (processen ser inte ändringen, kan t.o.m. trigga kompaktering som skriver över den nya datan igen).

**Enda fixen:** fullständig omstart av Foundry-processen. Sekvens:
1. Ta bort pack-deklarationen ur `system.json`
2. Full omstart av Foundry-processen (be Johan göra det)
3. Efter omstart: mappen är låsbar, kopiera in korrekt data
4. Lägg tillbaka deklarationen i `system.json`
5. Vanlig relaunch räcker nu (processen har aldrig öppnat den pathen förut)

**Regel framåt: bygg och kopiera kompendiedata FÄRDIGT INNAN den någonsin deklareras i `system.json`.**

### Innehåll: 14 varelser
Varg, Ulv, Brunbjörn, Grottbjörn, Tiger, Lejon, Krokodil, Giftorm, Gorilla, Grottlejon, Bevingad Mantikora, Bäckahäst, Alfin (Alvkatt), Allosaurus. Representativt urval — MONSTER.md har 2701 rader, hundratals varelser inkl. drakar.

---

## Fas 5 (session 2, 2026-07-18) — guidad rollpersonsskapare

### Avgränsning: 6 steg, inte chargens 14
Färdigheter och utrustning har redan bra lösningar direkt på arket (fas 2/3: "Ny färdighet"-knapp, dra-släpp från kompendier) — guiden täcker bara det som är obekvämt manuellt: sekventiella val med kravkontroll (ras, yrke) och tärningsslag (attribut). 6 steg: **Namn & Nivå → Ras → Ålder → Grundegenskaper → Yrke → Granska** + "Skapa rollperson".

**Medvetet uteslutet:** Hjälte-nivåer (bara "Vanlig"), Socialt stånd/startkapital (källorna motsäger sig själva om 1T20 vs 2T6+BP — se REGLER_README.md, medvetet olöst), EP-köp av färdigheter, Livsmål/Särskilda förmågor/Identitet-detaljer, åldersmodifikationer på attribut.

### Arkitektur (`scripts/apps/character-wizard.mjs`)
Vanlig `ApplicationV2` (inte DocumentSheet — äger inget dokument förrän sista steget). State i `this.state`-instansvariabel, `this.render()` anropas explicit efter varje handling.

**Mallstrategi:** `_prepareContext()` beräknar sex booleska flaggor (`showGrunder`, `showRas`, ...) i JS istf att jämföra i Handlebars — undviker en `eq`-liknande helper jag inte litade på efter fas 2s erfarenheter.

**Kravkontroll:** regex (`/(STY|STO|...)\s*(\d+)/gi`) plockar ut krav-par ur yrkets fritext-`requirements`, jämför mot ras-modifierade attributtotaler.

**Åtkomst:** `game.dode.openCharacterWizard()` (global) + injicerad knapp i Actors-sidopanelen via `renderActorDirectory`-hooken.

### ✅ Live-verifiering
Full körning med riktiga knapptryckningar: Alv+Magiker vald, kravkontroll visade korrekt "INT 12 (du har 10)" (7 bas + 3 Alv-mod), skapad rollperson fick korrekt embeddade ras/yrke-items och rätt härledda värden (KP=12, SB=`+1d6`).

---

## Externa resurser

- **Gemini-bildgenerering:** lokal MCP-server (`C:\Users\johan\mcp-servers\gemini_imagen_mcp.py`, Python, körs av Johan separat). Exponerar `mcp__gemini-imagen__generate_image` (prompt, count 1-4, output_dir). Sparar till `~/gemini-images` som default. Användbart för token-/ikonkonst — men import till Foundry är manuellt, inget automatiskt pipeline ännu.

---

## Fas 6 (session 3, 2026-07-18) — skada/ABS + magikastning

### Skaderullning (`scripts/rolls/damage-roll.mjs`)
`rollDamage({actor, label, formula})`: slår formeln, läser `game.user.targets.first()` för ett eventuellt Foundry-mål, drar av målets `system.abs` (samma fältnamn på `character` och `npc` — se nedan), golvar på 0. Postar `templates/chat/damage-card.hbs`.

**Två separata klick, inte en kedja:** anfallsslag (FV, avgör träff/miss) och skaderullning är fortfarande separata knappar — SL/spelaren avgör själv om anfallet träffade innan skadan rullas. Ingen automatisk "vid träff → rulla skada"-logik. Medvetet enkelt för fas 6; kan automatiseras senare om det känns tungrott i spel.

### ABS på rollpersoner (nytt derived-fält, `actor-character.mjs`)
`this.abs` = högsta `abs` bland ägda `rustning`-items med `slot === "kropp"` (inte summa — REGLER_STRID.md: "Abs gäller för HELA kroppen i grundsystemet", rustning staplar inte). Samma fältnamn (`system.abs`) som NPC:er redan hade sedan fas 4 → `rollDamage` kan läsa `target.actor.system.abs` rakt av oavsett actor-typ.

### Skadeformel-kombination (`combineDamageFormula`)
Rollpersoner: vapnets `damage` + rollpersonens `damageBonus` (t.ex. `"1d4+1"` + `"+1d6"` → `"1d4+1+1d6"`), SB läggs alltid på (REGLER_STRID.md huvudregel; lönnmördarens bakhugg-undantag är INTE specialhanterat).

**NPC-anfall lägger INTE till `system.damageBonus` automatiskt** — medveten skillnad mot rollpersoner. Källans attack-notes är inkonsekventa om SB tillämpas (t.ex. Brunbjörns Bett har "halvSB", Kram är "spec"/fast skada utan SB, Klor får uppenbarligen full SB men det står inte explicit). Att auto-lägga till full SB på alla NPC-anfall hade gett fel resultat för attacker markerade halv/ingen SB. Källans `damage`-fält an­vänds därför rakt av; SB visas separat i huvudet för SL att applicera manuellt vid behov.

### PSY-resurs (`actor-character.mjs`)
Nytt fält `resources.psy.value` (nullable, samma clamp-mönster som `hp.value`), `resources.psy.max` = `attributes.psy.total`. Existerade inte innan — rollpersonens PSY-attribut var bara ett grundegenskapsvärde, ingen spenderbar pool.

### Besvärjelsekastning (`DoDEActor#castSpell`, MAGI.md)
`CL = S - 2*(E-1)`, slås via samma `fv-roll.mjs` som allt annat (nu returnerar `{outcome, result, message}` istf bara `ChatMessage` — bakåtkompatibelt, ingen befintlig anropare läste returvärdet). PSY-kostnad beror på utfall:
- **Perfekt:** `max(1, floor(E/2))` — "halva kostnaden, avrundat till magikerns fördel" (MAGI.md)
- **Lyckat (normalt):** `E`
- **Fummel:** `E` (full kostnad) + textnotis om Snedtändningstabellen (ej automatiserad — bara flaggad i chatten)
- **Misslyckat (normalt):** `0` — inget PSY förbrukas vid ett vanligt missat kast

**Förenkling, medvetet flaggad i kod:** `item.system.sValue` (besvärjelsens tabellerade skolvärde) används som skicklighetsvärde S i CL-formeln. MAGI.md skiljer egentligen på skolvärde (besvärjelsens svårighet) och skicklighetsvärde S (kastarens personliga skicklighet i just den besvärjelsen, som kan höjas separat via erfarenhet). Ingen per-besvärjelse-träningsmekanik är byggd — detta är en direkt, dokumenterad förenkling, inte en gissning som gömts undan.

**Effektgrad (E):** inmatas via ett litet sifferfält på besvärjelseraden på arket (default 1), läses av `castSpell`-actionen vid klicktillfället.

### ✅ Live-verifiering (session 3)
- Rollperson med Dolk (1d4+1) + Skadebonus (+1d6 från STY15+STO13=28): skaderullning gav totalt 7, mot ett riktigt Foundry-mål (token på scenen, `setTarget`) med ABS 3 → 4 i slutlig skada. Stämmer exakt.
- NPC (Brunbjörn) "2 Klor" (1d6): rullade 1, mot samma mål (ABS 3) → golvades korrekt till 0 (inte negativt).
- Besvärjelsekastning testad med kontrollerad tärningsmotor (`CONFIG.Dice.randomUniform`) i alla tre utfallslägen: normalt misslyckat (0 PSY förbrukat), tvingad perfekt (1 PSY, `max(1,floor(1/2))`), tvingad fummel (1 PSY + Snedtändnings-notis).
- Rollpersonens ABS uppdaterades korrekt vid utrustad Läder-rustning (Abs 2).
- PSY-resurs visar och clampar korrekt (max = PSY-attributets total, `null`→fylls till max vid första beräkning, precis som KP).
- Noll konsolfel genom hela verifieringen.

---

## Verktygsmigration: kompendiebyggnad via Foundry CLI (session 3, 2026-07-18)

Johan installerade Node.js (`winget install OpenJS.NodeJS.LTS`, v24.18.0), vilket gjorde `@foundryvtt/foundryvtt-cli` tillgängligt. All kompendieinnehåll migrerades från den improviserade world-kompendium-kopiera-tekniken (se fas 3/4 ovan) till riktig JSON-källa + CLI-kompilering.

### Praktiska hinder som löstes (i ordning)

1. **Stale PATH i den här sessionens skal.** `node`/`npm`/`npx` fanns installerade (`C:\Program Files\nodejs\`, bekräftat via `Test-Path`) men inte i PATH för redan öppna Bash/PowerShell-processer — miljövariabler snapshot:as vid processstart. Lösning: `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH` i varje PowerShell-anrop som behöver Node (miljön återställs mellan separata verktygsanrop, så detta måste upprepas — se Bash-verktygets egen dokumentation om att skalstate inte bevaras mellan anrop).
2. **`npm install` misslyckades första gången** — `classic-level`s `node-gyp-build`-installationsskript spawnar en subprocess som letar efter `node` på PATH, vilket ärver samma stale PATH. Löst genom att sätta PATH korrekt INNAN `npm install` kördes (inte bara innan `npx fvtt`).
3. **`npm warn allow-scripts`** — npm blockerade `classic-level`s install-script som en säkerhetsåtgärd. CLI:t fungerade ändå för `pack`/`unpack` (troligen fanns en fungerande prebuild), så detta ignorerades snarare än att tvinga fram scriptet — inget faktiskt problem uppstod.
4. **`fvtt package unpack -n <namn> --in packs/<namn>`-kombinationen gav `LEVEL_ITERATOR_NOT_OPEN`.** Felsökning visade att CLI:t bygger sökvägen som `--in` + `-n` sammanslaget, vilket dubblerade pathsegmentet. Rätt arbetsflöde är istället:
   - `npx fvtt package workon <system-id> --type System` (sätter aktiv paket-kontext, sparas i CLI:ts egen, maskinlokala config — INTE i repot)
   - `npx fvtt configure set dataPath "<sökväg till Foundrys ROT>"` — **inte** till `Data`-undermappen (samma dubbleringsmisstag: `dataPath` + `Data/systems/...` byggs ihop av CLI:t, så `dataPath` ska peka på mappen som INNEHÅLLER `Data/`, `Config/` etc., t.ex. `D:\OneDrive\Dokument\FoundryVTT`)
   - Sedan räcker `npx fvtt package unpack <namn> -t <Item|Actor> -v` resp. `pack` — inga `--in`/`--out` behövs, CLI:t använder sitt eget defaultmönster (se nedan)
5. **Default källmapp-konvention:** CLI:t lägger JSON-källan i `packs/<namn>/_source/*.json` (INTE `packs/_source/<namn>/` som jag först antog). Adopterat rakt av istf att tvinga en annan struktur via `--out`.
6. **Samma "kör aldrig medan Foundry har packen öppen"-regel som fas 4:s LevelDB-gotcha gäller CLI:t också** — `unpack`/`pack` är också bara en klient som öppnar samma LevelDB-fil. Full `unpack`/`pack`-cykel gjordes med Foundry-servern helt avstängd (Johan stoppade processen), inte bara world-relaunchad.

### Städning av källdata
Alla 73 unpackade JSON-filer hade `ownership.<Johans-test-world-user-id>: 3` inbakat (ett artefakt från att innehållet ursprungligen skapades via `Item.create()`/`Actor.create()` i en riktig världssession). Kört ett engångsscript som stripper allt utom `ownership.default` från samtliga filer före omkompilering — annars hade en publik GitHub-repo skeppat en främmande, meningslös user-ID-referens i varje kompendie-entry.

### Nya filer
- `package.json` — `devDependencies: @foundryvtt/foundryvtt-cli`, npm-scripts `packs:unpack`/`packs:pack`
- `scripts/build/packs.config.mjs` — delad lista över de 5 kompendierna + dokumenttyp (Item/Actor)
- `scripts/build/unpack-all.mjs` / `pack-all.mjs` — körs via `npm run packs:unpack` / `npm run packs:pack`, loopar `fvtt package unpack/pack` över alla 5
- `packs/<namn>/_source/*.json` — den nya källsanningen för kompendieinnehåll, git-diffbar
- `packs/<namn>/` (LevelDB, oförändrad plats) — fortfarande det kompilerade output Foundry faktiskt läser, committas fortfarande (så systemet fungerar direkt efter `git clone` utan byggsteg)

### ⚠ Maskinlokalt: `dataPath`/`workon`-konfiguration är INTE i repot
CLI:ts `configure set dataPath ...` och `package workon ...` sparas i en global, maskinlokal config (inte i projektmappen, inte i git). **Varje ny maskin/utvecklare måste köra dessa två kommandon en gång** innan `npm run packs:unpack`/`packs:pack` fungerar:
```
npx fvtt configure set dataPath "<sökväg till din Foundry-installations ROTMAPP, dvs. mappen som innehåller Data/>"
npx fvtt package workon drakar-och-demoner-expert --type System
```

### ✅ Live-verifiering
Full unpack → städa ownership → repack-cykel kördes med Foundry avstängd. Efter omstart: alla 5 kompendier laddade med exakt samma dokumenträkning som innan (7/11/33/8/14), Alv-rasens `attributeMods` verifierad oförändrad, `ownership` bekräftat rensat till bara `default`. En NPC-sheet (Varg) öppnad direkt från det ompaketerade kompendiet — renderade och beräknade KP korrekt. Noll konsolfel.

**Detta ersätter fas 3/4:s "byggd utan CLI"-begränsning** — kompendieinnehåll är nu git-diffbart JSON-källa + reproducerbar kompilering, inte opaka binärmappar skapade via en engångs-world-kopiera-teknik.

---

## Fas 7 — kampanjmodulen är nu ett eget repo

Kampanjmodulen "De brutna sigillens krönika" (fas 7.1 "Dimön" klar) byggs som ett separat sibling-repo på `Data/modules/de-brutna-sigillens-kronika`, inte i systemet. Den återanvänder systemets Actor/Item-datamodeller oförändrade (npc-typ för monster/NPC:er, `vapen`-typ för magiska vapen). Se modulens egen `ACTIVE_TASK.md`/`memory.md` för fullständig teknisk detalj — bland annat en Foundry v14-specifik Scene-schemaändring (Scene Levels ersätter det gamla top-level `background`-fältet) som inte gäller den här systeminstansens v12-baserade anteckningar ovan.

---

## Rollpersonsskaparen v2 — Fas 1+2+3+4 (session 4, 2026-07-19)

v14-best-practice-audit av fas 1–6 (`PLAN_V14.md`) och en separat wizard-audit mot den bokexakta rollpersonspipelinen ledde till `PLAN_WIZARD_V2.md`, en 10-fasplan för att lyfta guiden (`character-wizard.mjs`) från 6 steg (namn/ras/ålder/attribut/yrke/granska, ingen nivå, inga BP/EP, inget socialt stånd) mot bokens fulla flöde. Fas 1–3 är klara, Fas 4 delvis (kapitalmultiplikatorn klar, attributmodifikationerna blockerade av en forskningslucka); se `PLAN_WIZARD_V2.md` för fas 5–10.

### Fasindelningen omstrukturerades mitt i arbetet
Originalplanen bakade in BP-ledgern i Fas 1. I praktiken blev det tydligt att bara nivåval + stegordning redan var lagom stort för en fristående verifierbar fas — BP-ledgern fick en egen Fas 2. Samtidigt flyttades Särskilda förmågor (blockerad av en forskningslucka, blockerar inget annat) från tidig Fas 2 till sen Fas 8, och HH Öde-typer fick en egen Fas 10 istället för att vara en undernotis i Livsmål-fasen. `PLAN_WIZARD_V2.md` skrevs om i sin helhet för att matcha — se filens egen "Ändringslogg"-sektion.

### Fas 1 — nivåval + stegordning
- `DoDECharacterData` fick ett `niva`-fält (`vanlig`/`extraordinar`/`hjalte`, KH s.3).
- `STEPS` i `character-wizard.mjs` omordnades till `["niva","grunder","ras","yrke","attribut","alder","granska"]` — **yrke flyttades före attribut** (medveten avvikelse mot Roll20-syskonprojektets `CHARACTERMANCER-WORKFLOW.md`, som har attribut före yrke; user-instruerad ordning för just Foundry-guiden).
- Konsekvensen av yrke-före-attribut: `#checkRequirements` fick ett tredje tillstånd, `unverified` (attribut inte slagna än), skiljt från `met`/`unmet` — annars visade varje yrkeskrav ett falskt rött kryss innan spelaren ens nått attributsteget. Testat live: kravlistan gick korrekt från `unverified` → `unmet`/`met` när man bläddrade fram och tillbaka mellan yrke- och attributsteget.

### Fas 2 — BP-ekonomi
- Nytt `bp`-schemafält på `DoDECharacterData` med fem spend-kategorier (`spentRas`/`spentFormagor`/`spentSocialt`/`spentKapital`/`spentFardigheter`) + härledda `start`/`spent`/`remaining` i `prepareDerivedData()`.
- **Medvetet: ingen BP-kategori för attribut.** RP:s källor spenderar BP på ras/förmågor/socialt stånd/startkapital (RP s.27–30) — attribut slås fram med 3T6 (RP s.9), köps inte. En tidigare formulering av uppdraget nämnde "BP spent on attribute purchases", men det finns ingen sourced mekanik för det, så den byggdes inte — flaggat i både klassdokblock och schemakommentar istf att gissa fram en påhittad kostnadstabell.
- Rasval drar nu faktiskt `raceDoc.system.bpCost` från poolen (ersätter vid omval, ackumulerar inte) — **första gången** `item-ras.mjs`s `bpCost`-fält (funnits sedan fas 3) faktiskt konsumeras av något.
- En löpande "BP kvar: X / Y"-räknare syns i wizard-headern på alla steg, plus en nedbrytning i granska-steget.
- Live-testat: Vanlig→125, Hjälte→175; Dvärg (25 BP)→150 kvar; omval till Människa (0 BP)→175 kvar igen (bekräftar ersättning, inte ackumulering); skapad Actors `system.bp` matchade wizardens visning exakt, vilket bekräftar att DataModellens egen `prepareDerivedData()`-uträkning (inte bara wizardens spegling av samma tal) ger rätt resultat oberoende.

### Fas 3 — Socialt stånd + Startkapital (2T6+BP)
- Löser källkonflikten som `REGEL_SocialtStand.md` själv flaggar: valde 2T6+BP/9-ståndssystemet (RP s.27–28) över det aldrig implementerade 1T20/4-ståndssystemet, eftersom källdokumentet uttryckligen pekar ut RP s.27–28 som auktoritativt för Expert.
- `socialStanding`/`startCapital`-schemafält på `DoDECharacterData`. **Designbeslut som avvek lite från planens ordval:** planen sa att `bpSpent`-fälten skulle "kopplas till" `bp.spentSocialt`/`spentKapital`, vilket hade kunnat läsas som två oberoende fält som hålls synkade manuellt. Istället gjordes `bp.spentSocialt`/`spentKapital` till en **ren spegling** — `prepareDerivedData()` sätter dem varje gång från `socialStanding.bpSpent`/`startCapital.bpSpent`, så det finns bara en verklig skrivväg och de kan aldrig glida isär. Samma mönster upprepas i wizardens `#bpLedger()`, som läser BP-spend för dessa två kategorier direkt från `state.socialStanding`/`state.startCapital` istället för en separat kopia i `state.bp`.
- Startkapitalformelns takregel (RP s.27: "aldrig mer än 10 högre än" socialt stånds slutsumma) implementerad som `Math.min(rå_summa, socialt.total + 10)` — **testat explicit** genom att tvinga fram ett överskott (BP-spend högt nog att rå-summan skulle bli 28 mot ett tak på 19) och bekräfta att både wizardens förhandsvisning och den skapade Actor:ens `startCapital.total` klipptes till taket, inte den okapade summan.
- `finalSm` (efter åldersmultiplikator) rörs medvetet inte — förblir 0 tills Fas 4 finns.
- Ny sheet-yta: en liten badge (`system.socialStanding.rank`) i karaktärsarkets identity-rad, bredvid Ålder — bara synlig när ett stånd faktiskt slagits fram.
- Live-testat end-to-end med kända indata (2T6=6 socialt +3 BP → 9 → "Lägre medelklass", exakt 8–11-intervallet i tabellen; 2T6=6 kapital +2 BP +2 halva-socialt-BP → 10 → 1000 sm, exakt 8–11-intervallet). Skapad Actors samtliga fält matchade wizardens live-beräkning, inklusive BP-ledgerns spegling. Sheet-badgen renderade korrekt. Noll konsolfel.

### Fas 4 — Ålder: kapitalmultiplikator klar, attributmodifikationer blockerade
- `DODE.ageCapitalMultiplier` (RP s.28, känd tabell) implementerad och i bruk: `startCapital.finalSm = round(baseSm × multiplikator)`, beräknat både i `prepareDerivedData()` och wizardens `#startCapitalResult()`.
- `DODE.ageAttributeModifiers = {}` — medvetet tomt, RP s.24-25 inte extraherat. `attributes[key].mod` delades upp i `raceMod`/`ageMod`/`mod` (summan) i `prepareDerivedData()` och wizardens `#effectiveAttributes` — infrastrukturen är klar och `ageMod` faller tillbaka till `0` överallt via `?? 0`/`?? {}`, så funktionaliteten aktiveras automatiskt (ingen kodändring) den dag tabellen fylls i.
- **Sheet-visning av raceMod/ageMod separat skippades medvetet** (planen nämnde det som möjlig polish) — eftersom `ageMod` alltid är 0 just nu skulle en sådan UI-yta bara visa "0 ålder" överallt, noll värde för användaren idag. Görs om/när tabellen har data.
- `ageSelect`s change-lyssnare i `_onRender` fick ett nytt `this.render()`-anrop den här fasen — innan Fas 4 påverkade ålder inget synligt i UI:t så omrendering behövdes inte, nu behövs den för att kapitalmultiplikator-förhandsvisningen ska uppdateras live.
- Live-testat alla fyra multiplikatorer explicit mot samma `baseSm` (1000 sm): Ung→1000, Mogen→1500, Medelålders→2000, Gammal→2500 — matchar RP s.28 exakt, och verifierat att `finalSm` uppdateras direkt i UI:t vid ålderbyte utan att byta steg. Skapad Actors `system.startCapital.finalSm` och attributens `raceMod`/`ageMod`/`mod`-uppdelning matchade wizardens beräkning oberoende.

## Kompendieikonkonst — raser + yrken (session 4, 2026-07-19)

Genererade 18 porträttbilder (7 raser, 11 yrken) via `mcp__gemini-imagen__generate_image`, en per item, sparade i `assets/tokens/raser/<namn>.png` och `assets/tokens/yrken/<namn>.png` (ASCII-filnamn, t.ex. `dvarg.png` inte `dvärg.png` — undviker path-encoding-strul). `packs/{raser,yrken}/_source/*.json`s `img`-fält omskrivna från platshållaren `icons/svg/item-bag.svg` till `systems/drakar-och-demoner-expert/assets/tokens/<mapp>/<namn>.png` via ett engångs-Python-script (json.load/dump, `ensure_ascii=False`, UTF-8).

**Stilmall (för konsekvens om fler bilder genereras senare — monster/vapen/besvärjelser):** `"Fantasy RPG character portrait icon of a/an [beskrivning], painterly digital fantasy art in the style of a moody atmospheric oil painting, muted earthy color palette with warm amber highlights, dramatic side lighting, dark blurred background, centered square composition, waist-up portrait, highly detailed"` — vald för att matcha tonen i `assets/backgrounds/Ereb_Altor.png` (kampanjvärldens temabild). Kvalitet verifierad genom att faktiskt titta på bilderna (inte bara lita på att anropet lyckades) — testade "Alv" och det svåraste konceptet "Anka" (antropomorf and) innan resten kördes, båda höll god kvalitet och rätt tonläge.

**⚠ Falskt korruptionslarm under verifiering:** `Dvärg`/`Sjöfarare`/etc. visades som `Dv�rg`/`Sj�farare` när Python skrev ut namnen i Bash-terminalen — såg ut som att UTF-8-skrivningen hade trasat sönder å/ä/ö. Verifierat att detta var ett rent terminal-teckenkodningsartefakt (Git Bash-konsolens codepage, inte faktisk fildata) genom att läsa tillbaka `ord()`-kodpunkterna direkt (`0xe4` för "ä" — korrekt) istället för att lita på konsolutskriften. Filerna är korrekta; lita inte på hur icke-ASCII-tecken *ser ut* i den här miljöns Bash-terminal, verifiera med kodpunkter om det är osäkert.

**⚠ Inte klart än:** `npm run packs:pack` har INTE körts — Foundry-servern var Johans aktiva, levande session under hela den här sessionen, och att köra pack-kommandot medan servern är uppe är precis den situation LevelDB-cache-gotchan (fas 4, verktygsmigrationsloggen session 3) varnar för. Källfilerna (`_source/*.json`) är uppdaterade och redo, men de kompilerade `packs/{raser,yrken}/`-mapparna som Foundry faktiskt läser är oförändrade tills paketeringen körs med servern nedstängd.

### Live-miljö-gotcha: `computer`-verktygets screenshot/klick är opålitliga mot Foundrys join-skärm
Under liveverifieringen visade det sig att `computer{action:"screenshot"}` konsekvent timeoutar mot Foundrys inloggnings-/setup-vyer i den här sessionens Browser-pane (troligen canvas-relaterat), och att koordinatbaserade klick missar om fönstret är smalare än Foundrys minimibredd (1024px) — login-formulärets submit-knapp verkar då inte reagera på klick alls (troligen för att Foundrys egna JS avvisar interaktion under bredd-varningen). Lösning som fungerade upprepade gånger: `resize_window` till minst `1280x900` INNAN inloggning, välj GM-användaren explicit via `form_input` (default-valt alternativ i dropdownen är en tom platshållare, inte Gamemaster — måste sättas explicit varje gång sidan laddas om), och efter det gick `computer{action:"left_click", ref:...}` mot faktiska in-game-element (sidopanel, wizard-knappar) pålitligt. För verifiering INNE i wizarden fungerade det bättre att dispatcha riktiga DOM-`click`/`input`-events via `javascript_tool` mot de faktiska action-elementen (`[data-action="..."]`) än att lita på skärm-koordinater — samma kodväg som en musklick eftersom Foundrys ApplicationV2-actions är vanliga delegated click-listeners.

**Ytterligare två gotchas hittade senare samma session:**
1. **Foundry blockerar en andra GM-inloggning från en ny flik/session** medan en tidigare GM-session fortfarande är aktiv — join-formulärets Gamemaster-`<option>` blir `disabled` och submit gör ingenting (inget nätverksanrop alls, inga konsolfel). Lösning: återanvänd en redan inloggad flik (`tabs_context` → `tabs_select`) istället för att öppna en ny `preview_start`-flik varje gång.
2. **`World Configuration`s titel-fält kräver Foundrys serveradmin-lösenord**, inte bara en inloggad GM-session — ett submit-försök utan det gav `403 "You lack server administrator permission"`. Detta är en genuin behörighetsgräns (inte en UI-flakighet) — löstes av att Johan själv gjorde ändringen i sin egen, redan admin-autentiserade webbläsarsession. Efter att världen döptes om (till "Ereb Altor", med tillhörande logga/bakgrund som Johan också satte via samma dialog) startade Foundry om världen, vilket gjorde denna sessions tidigare inloggade flikar ogiltiga ("Critical Failure — no active game session") tills de laddades om och loggade in på nytt.

---

## Kön i guiden + bakgrund tillbaka till läder (session 4, samma dag, uppföljande runda)

Efter Ereb Altor-bakgrundsbytet (ovan) blev karaktärsarkets/guidens interiörbakgrund den detaljrika Ereb Altor-målningen. Johan flaggade att detta var fel håll — Ereb Altor-bilden hör till kampanjvärldens joinskärm/canvas, inte till arkets/guidens innertextur, som ska vara läderstrukturen. `.dode.sheet.character, .dode.sheet.character-wizard`s `background-image` bytt tillbaka till `character-sheet-leather.png` (overlay tillbaka till 0.4, den svagare ton som räcker för en mönsterfri textur). Trärams-`border-image`n (samma regel, delad selektor) var oförändrad genom hela detta — bara bakgrundslagret bytte.

**"Skrivbordsbakgrunden" Johan nämnde** (canvas/Scene-bakgrunden synlig runt sheet-fönstret i skärmdumpen) är INTE något jag har rört eller kan styra via CSS — det är Foundrys aktiva Scene-dokument (kampanjens egna "Dimön"-scener har alltid haft den eld-/grottbelysta stilen). Flaggat till Johan att detta ligger utanför CSS-lagret om han vill ändra det.

### Kön (Man/Kvinna) som guidens nya första steg
- `DoDECharacterData` fick ett `kon`-fält (`man`/`kvinna`, `initial: "man"`). Ingen regelmekanik kopplad — Johan var explicit att detta bara styr porträttbilder.
- `STEPS` fick `"kon"` som nytt index 0, före `"niva"` (10 steg totalt nu).
- Valdes med Font Awesome-ikoner (`fa-mars`/`fa-venus`), INTE genererade porträttbilder — matchar "använd ikonen för könen"-formuleringen och är billigare/snabbare än att generera ännu fler bilder för ett rent UI-val.
- `item-ras.mjs`/`item-yrke.mjs` fick `imgMan`/`imgKvinna`-strängfält (tomma som standard, faller tillbaka på itemets vanliga `img` om något saknas — ingen krasch, ingen håligt UI).
- Ny `#genderedImg(doc)`-hjälpmetod i wizarden väljer rätt variant utifrån `state.kon`; används både i ras-/yrkeskortens `img` i `_prepareContext` OCH när `#onCreateCharacter` embeddar ras-/yrkes-item på den nya Actor:en (så den skapade rollpersonens ras-/yrkesikon matchar valt kön, inte bara wizard-förhandsvisningen).

### 36 nya explicita man/kvinna-porträtt genererade
Regenererade ALLA 18 bas-bilderna (från förra rundan) som uttryckliga man/kvinna-par istället för att återanvända de befintliga (ofta kön-omarkerade) bilderna som en av två varianter — säkerställer konsekvent stil/ljussättning mellan paren, inte en blandning av gammal/ny generation. Samma stilmall som förra rundan (se ovan) med `"a male/female"` tillagt i beskrivningen. Sparade som `<namn>-man.png`/`<namn>-kvinna.png` i samma `assets/tokens/{raser,yrken}/`-mappar som bas-bilderna (inte separata mappar) — `packs/{raser,yrken}/_source/*.json` fick `system.imgMan`/`system.imgKvinna` ifyllda via samma Python-mönster som `img`-fältet förra rundan.

**Kvalitetskontroll:** tittade på `dvarg-kvinna.png` (kvinnlig dvärg utan skägg — ett rimligt, vanligt fantasy-konventionsval, inte ett misstag) och `krigare-kvinna.png` innan hela batchen godkändes.

### Live-verifiering av könsväxlingslogiken UTAN att kunna packa om
Eftersom `npm run packs:pack` fortfarande inte kan köras (servern aktiv, se gotchan ovan) fanns `imgMan`/`imgKvinna` bara i `_source/*.json`, inte i de kompilerade packs Foundry faktiskt serverar. För att verifiera `#genderedImg()`-logiken ändå: låste upp `raser`-kompendiet temporärt (`pack.configure({locked:false})`), satte `imgMan`/`imgKvinna` på ett enda livedokument (Dvärg) via `document.update()`, körde guiden fram till rasvalet i båda könslägena och läste av `<img src>` på rascortet — bekräftade `dvarg-man.png` vid Man och `dvarg-kvinna.png` vid Kvinna. Återställde fälten till tomma strängar och låste kompendiet igen efteråt (verifierat via en färsk `getDocument()`-hämtning, inte den cachade referensen — den cachade objektreferensen visade felaktigt kvar de gamla värdena direkt efter `update()`, ett timing-/cache-artefakt att känna till om samma verifieringsteknik återanvänds).

### Ompaketering (samma session, uppföljning efter att Johan stängt ner Foundry)

Johan stängde ner Foundry-servern och gav klartecken. Verifierade själv att servern faktiskt var nere (`curl` mot `localhost:30000` → ingen respons) innan `npm run packs:pack` kördes — kör aldrig blint på ett påstående, kolla.

**Ny gotcha: `workon`-kontexten är global för hela maskinen, inte per repo.** Första körningsförsöket kraschade med `ENOENT: no such file or directory, scandir 'D:\...\Data\modules\de-brutna-sigillens-kronika\packs\raser\_source'` — CLI:t försökte packa IN I kampanjmodulens repo, inte det här systemet. Orsak: `npx fvtt package workon` sparar sitt aktiva paket i en maskinlokal, global config (redan känt sedan tidigare, se "Verktygsmigration"-avsnittet ovan), och något tidigare arbete i kampanjmodul-repot hade bytt den globala kontexten dit utan att byta tillbaka. Löst med `npx fvtt package workon drakar-och-demoner-expert --type System` igen omedelbart före `packs:pack` — därefter packade alla 5 kompendier korrekt (raser 7, yrken 11, vapen-utrustning 33, besvarjelser 8, monster 14 — exakt de kända antalen).

**⚠ `grep` på kompilerade `.ldb`/`.log`-filer ger falska negativ — LevelDB komprimerar datablock (Snappy som standard).** Efter packningen verifierade jag först med `grep -a -o "dvarg[a-zA-Z.-]*\.png" packs/raser/*` och fick BARA `dvarg-man.png`, inte `dvarg-kvinna.png` — såg ut som att `imgKvinna` hade tappats bort under packningen. Detta var fel: en autentisk läsning direkt via `classic-level`-biblioteket (samma npm-paket CLI:t självt använder, `new ClassicLevel(path, {keyEncoding:'utf8', valueEncoding:'json'})` + `db.iterator()`) visade att `imgKvinna` fanns korrekt hela tiden — grep hade bara råkat träffa en okomprimerad del av datat för `imgMan` men inte `imgKvinna`. **Lärdom:** verifiera aldrig kompilerade LevelDB-packars innehåll med `grep`/textsökning på binärfilerna — läs alltid via en riktig LevelDB-klient (Node + `classic-level`, samma sätt som CLI:t själv läser/skriver) för ett tillförlitligt svar.
