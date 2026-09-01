# Drakar och Demoner Expert — Foundry VTT-system

🇸🇪 Svenska | [🇬🇧 English](README.en.md)

Ett fristående [Foundry Virtual Tabletop](https://foundryvtt.com/)-system för det svenska rollspelet **Drakar och Demoner Expert** (1991). Byggt från grunden mot Foundrys moderna DataModel/ApplicationV2-arkitektur — inget `template.json`, inget bundlingsteg för systemkoden.

**System-id:** `drakar-och-demoner-expert`
**Foundry-kompatibilitet:** minimum v12, verifierad mot v14
**Klientspråk:** svenska (`lang/sv.json`) och engelska (`lang/en.json`) — spelinnehållet (kompendier, regeltexter) är på svenska oavsett vald klientspråk.

## Kom igång

**Förutsättning:** en installerad Foundry VTT v12 eller senare (verifierad mot v14).

1. **Hämta systemet.** Klona repot direkt in i din Foundry-datamapps `systems/`-katalog:

   ```bash
   git clone https://github.com/Adociouse/foundryvtt-drakar-och-demoner-expert.git drakar-och-demoner-expert
   ```

   Mappen måste heta exakt `drakar-och-demoner-expert` (samma som system-id:t i `system.json`), annars hittar inte Foundry systemet. Var `systems/`-katalogen ligger ser du i Foundrys egen **Configuration → User Data Path** (typiskt `%LOCALAPPDATA%\FoundryVTT\Data\systems\` på Windows, `~/.local/share/FoundryVTT/Data/systems/` på Linux).

   *Alternativt:* ladda ner repot som ZIP och packa upp det på samma plats. Något byggsteg behövs inte — systemet är rena ES-moduler som Foundry laddar direkt. (`npm install` behövs bara om du tänker bygga om kompendierna, se [Kompendiebyggnad](#kompendiebyggnad).)

2. **Starta om Foundry** och skapa en ny värld (**Game Worlds → Create World**) med **Drakar och Demoner Expert** som system.

3. **Importera det innehåll du vill ha.** Kompendierna följer med systemet och syns direkt i världens kompendiefönster — inget behöver importeras för att spela, men allt går att dra in i världen.

> ⚠ **Scener måste importeras i två steg.** Foundry löser INTE automatiskt en importerad scens tokens: importerar du bara scenen `Värdshuset — Utkanten` får du en tom karta utan figurer. Importera **först** de aktörer scenen använder (från `handlare`- och `monster`-kompendierna), **sedan** själva scenen. Det här är en begränsning i Foundry, inte i systemet.

4. **Skapa en rollperson.** Skapa en Actor av typen `character` och klicka **Öppna rollpersonsskaparen** på arket — guiden tar dig genom alla 19 stegen (se nedan).

## Status

| Del | Status |
|---|---|
| Grundegenskaper, härledda värden (KP, PSY, skadebonus, förflyttning, bärförmåga) | Klar |
| FV-baserade färdighetsslag (perfekt/fummel-bekräftelse, Dice So Nice-stöd) | Klar |
| Guidad rollpersonsskapare (19 steg, bokexakt BP/EP-ekonomi, point-buy-attribut) | Klar, se detaljer nedan |
| Kompendier: 13 raser, 36 yrken, 339 vapen/utrustning, 442 besvärjelser, 241 monster | Klar (fortsatt luckor i bildtäckning och vapensortiment, samt i bestiary-täckningen mot källböckerna, besvärjelsekatalogens fullständighet och beskrivningstexternas kvalitet — se nedan) |
| Vapensystem: vapengrupper, Två vapen, Vapentekniker/Vapenakademier, Stridskonster | Klar, med en medveten förenkling på ett område (se nedan) |
| GM-effekter (person/scen/värld), DoDE-villkor, periodiska effekter (gift m.m.) | Klar, med eget GM-effektfönster (`scripts/apps/gm-effects.mjs`) |
| Träningsekonomi (post-skapande färdighetsköp), EP-intjäning i spel | Klar, egen `ApplicationV2`-vy |
| Magisystem (kastning, PSY-resurs, minimagi, magiskolor) | Klar, med några medvetna förenklingar (se kodkommentarer) |
| Språkmekanik (modersmål, främmande språk) | Klar |
| Schemaversionering + JSON export/import (aktörer, NPC:er, items) | Klar, bygger på Foundrys egna `TypeDataModel.migrateData`/`exportToJSON` |

### Rollpersonsskaparen

En guidad, ApplicationV2-baserad rollpersonsskapare (`scripts/apps/character-wizard.mjs`) tar spelaren genom 19 steg i ordning:

1. **Start** — introduktion
2. **Kön** — styr vilken ras-/yrkesporträttvariant som visas och ärvs
3. **Nivå** — Vanlig, Slumpens hjälte, Sann hjälte eller Gudafödd. Fyra nivåer, olika antal förmågeslots/hjältedådsslag/EP-budget (BP-poolen är i dagsläget 125 för alla fyra i väntan på ett regelbeslut, se `docs/DESIGN_DECISIONS.md`)
4. **Grunder** — namn
5. **Ras** — 13 raser (7 grundraser + 6 alvsläkten), kostar BP ur nivåpoolen
6. **Svärdshand** — höger/vänster/ambidextriös/dubbelhänt, med följdeffekter för Två vapen-mekaniken
7. **Ålder** — Ung/Mogen/Medelålders/Gammal, ger attributmodifikationer och en kapitalmultiplikator
8. **Attribut** — **point-buy**, inte tärningsslag (RP s.23 är en explicit köptabell, inte en slagmetod — en tidigare rättad felläsning)
9. **Yrke** — 36 yrken (11 grundyrken + 25 specialiseringar från Krigarens Handbok/Tjuvar och Lönnmördare)
10. **Magiskola** — bara för magianvändande yrken
11. **Särskilda förmågor** — antal slots styrt av nivå, en sourcad 49-rads slumptabell (`DODE.specialAbilitiesTable`) med en "Slå fram förmåga"-knapp; ras-/yrkesförmågor har egna, strukturerade mekaniska effekter där källmaterialet ger dem
12. **Socialt stånd** — 2T6 + valfri BP-spend (RP s.27–28, 9-ståndssystemet)
13. **Startkapital** — 2T6 + BP, kopplat till socialt stånd och ålder
14. **Språk** — modersmål (rasstyrt) + främmande språk
15. **Yrkesfärdigheter** — yrkets egna färdighetsval (namngivna, vapen-/språk-/stridskonstpooler)
16. **Färdigheter** — se tvålagersmodellen nedan
17. **Livsmål** — 21 fördefinierade alternativ + fritext
18. **Utrustning** — köp vapen/rustning/allmän utrustning mot startkapitalet
19. **Granska** — sammanfattning innan rollpersonen skapas

**BP/EP-ekonomi:** Varje nivå ger en pool av byggpoäng (BP) som spenderas på ras, svärdshand, socialt stånd och startkapital. Överbliven BP vid slutet av skapandet (`bp.remaining`) omvandlas ×5 till erfarenhetspoäng (EP), som spenderas i färdighetsstegen (RP s.28: *"Kvarvarande BP × 5"*).

**Tvålagers färdighetsmodell:** Alla primära färdigheter (16 st, RP s.36) och yrkets valda yrkesfärdigheter tilldelas automatiskt sitt startvärde (FV = grundegenskapens grupp, "BC") vid respektive val — inget spelaren behöver slå fram själv. Därefter kan EP-poolen spenderas för att höja valfri färdighet över BC, enligt RP s.30:s kumulativa kostnadstabell, begränsat av yrkets maxstartvärde och eventuella katalogspecifika grundkostnader (Vapentekniker, Stridskonster, Två vapen).

En färdig rollperson kan sedan tränas vidare i spel via en egen träningsvy (`scripts/apps/training.mjs`) och tjäna EP genom äventyr — post-skapande-ekonomi, skild från guiden.

**Bakgrundsbild:** Karaktärsarket och guiden delar samma visuella identitet — en mörk läder-/trätextur (`assets/backgrounds/character-sheet-leather.png` som bakgrund, `imagen_20260719_201503_2.png` som träram via `border-image`), se `styles/dode.css`.

### Kompendier

| Kompendie | Innehåll |
|---|---|
| `raser` | 13 raser: 7 grundraser (Människa, Alv, Halvalv, Halvlängdsman, Dvärg, Halvork, Anka) + 6 alvsläkten (Alver s.22) |
| `yrken` | 36 yrken: 11 grundyrken (Bard, Helare, Krigare, Lärd man, Lönnmördare, Magiker, Munk, Riddare, Sjöfarare, Tjuv, Utbygdsjägare) + 25 specialiseringar (Krigarens Handbok, Tjuvar och Lönnmördare), varje yrke med en strukturerad `professionSkills`-lista för den automatiska färdighetstilldelningen och (där källan ger det) mekaniskt kopplade yrkesförmågor |
| `vapen-utrustning` | 339 poster: 23 vapen, 45 rustningsdelar (per kroppsdel, SB s.27), 271 övrig utrustning — köpbara i guidens utrustningssteg |
| `besvarjelser` | 442 besvärjelser (401 besvärjelser + 41 minibesvärjelser, minibesvärjelserna samlade i en egen "Minimagi"-mapp) — Formelbokens katalogkomplettering pågår, bara Demonologi (~9 besvärjelser) kvarstår |
| `monster` | 241 varelser för NPC/monster-actortypen (hela Monsterboken 1 OCH 2, plus hela Monsterboxen II — inklusive stridsstatblock för de folkslag som också finns som spelbara raser) |
| `magiska-foremal` | Magiska föremål — GM-only pack, separat från den spelarsynliga butiken |
| `handlare` | Handlar-/butiksaktörer (egen `handlare`-actortyp) |
| `regler`, `sl-regler`, `tabeller` | Regeltext och slumptabeller som journal-/rolltable-dokument, sourcade ur källböckerna |
| `scener` | Färdiga scener, bl.a. rollpersonsskaparens egen bakgrundsscen |

Kompendieinnehållet redigeras som JSON i `packs/<namn>/_source/`, och kompileras till det LevelDB-format Foundry faktiskt läser — se "Kompendiebyggnad" nedan.

### Kända begränsningar

- **GM-effekternas skillMod/CL-mod/läkningstakt-lager syns inte som ikoner på token.** GM-effektfönstret (`scripts/apps/gm-effects.mjs`) redigerar person-/scen-/världseffekter lagrade som ren data i en Setting/flagga, inte som riktiga `ActiveEffect`-dokument (embedded färdighets-Items kan inte vara AE-mål, se kodkommentarer) — de påverkar rätt siffra i beräkningarna men ger ingen visuell markering på tokenet. Genuina `ActiveEffect`-baserade buffar (`game.dode.SceneEffects`, utrustning/förmågor) FÅR en ikon på tokenet om anroparen anger en `img`, och DoDE:s två registrerade villkor (Arm obrukbar/Hand upptagen) syns automatiskt via Foundrys egen Token HUD. Periodiska effekter (gift/eld/blödning) synkas automatiskt mot Foundrys motsvarande kärn-statusikoner (`poison`/`burning`/`bleeding`) på Token HUD — övriga periodeffekt-källor visas fortfarande bara som en rad i GM-effektfönstrets aktörssektion.
- **Vapensortimentet täcker 23 av Spelarbokens ~52 vapen.** Vapengruppssystemet (`DODE.weaponGroups`) är byggt för hela tabellen, men själva kompendieposterna är inte alla transkriberade än.
- **Bestiaryn täcker 241 varelser** ur Monsterboken 1, Monsterboken 2, Monsterboxen II och Svartfolk-supplementet — alla fyra KOMPLETTA, inklusive Svartfolks namngivna spelledarpersoner och färdiga svartfolks-arketyper att placera ut direkt. ⚠ Täckningsgraden mot det samlade källmaterialet är dock **inte** fastställd: utöver Monsterboxen IV (56 poster, inga byggda) finns ytterligare tre böcker med varelsestatblock som ännu inte reviderats — *Monster och Man i Ereb Altor*, *Drakar* och *Svartfolk*-supplementet (skilt från Monsterboxen II:s Svartfolk-kapitel, som är byggt).
- **Spelbara raser finns även som stridbara NPC:er.** Alv-släktena, dvärg, anka, halvlängdsman, halvalv och halvorch har både en `ras`-post i `raser` (rollpersonsbyggsten) och ett fullständigt stridsstatblock i `monster` — så ett högalvsgarde eller en dvärgpatrull kan placeras ut som motståndare direkt.
- **De flesta besvärjelser saknar egen bildikon** — 434 av 442 visar sin magiskolas symbol i stället för unik konst.
- **Besvärjelsekatalogen är inte fullständig mot Formelboken.** 12 av 13 skolor är kompletta (transkriberade skola för skola, se `docs/DESIGN_DECISIONS.md` §2) — bara **Demonologi** (~9 besvärjelser, sourcad till ungefär s.12–16 via bokens eget index men ännu inte direktläst) återstår.
- **~148 av 442 besvärjelser har bara en komprimerad en-radssammanfattning** i stället för bokens faktiska beskrivningstext (kvar från 2026-07-27-portens första omgång) — uppgraderas skola för skola i samma pass som katalogkompletteringen. Allmänna besvärjelser, Mentalism, Nekromanti, Röstmagi, Spiritism, Stavmagi och Symbolism är helt klara på den punkten; Animism, Elementarmagi, Harmonism, Häxkonster och Illusionism kvarstår (klara på spellista, inte på beskrivningskvalitet).
- **Stridskonster (obeväpnad strid, RP s.56-58/KH s.91-93) är byggt med en medveten förenkling.** Boken beskriver en spelarkomponerad teknikbunt med ett delat färdighetsvärde; den nuvarande implementationen ger i stället varje teknik ett eget, oberoende FV (samma modell som Vapentekniker) — ett uttryckligt, dokumenterat avsteg, inte en bugg.
- **Svartfolk-supplementet är inte påbörjat.**
- **Hjälteförmågor (HH s.20/46-48) går inte att spendera än.** Hjältedådstabellen (HH s.6-7) rullas redan i guiden vid skapandet och ackumulerar hjältepoäng korrekt — men den separata 18-rads tabell man spenderar den valutan mot, plus ett gränssnitt för att göra det, är inte byggda.
- Se kodkommentarer märkta `⚠` för specifika, medvetet flaggade regelavvikelser eller förenklingar.

## Arkitektur

- **Ingen `template.json`.** Actor/Item-subtyper (`character`/`npc`/`handlare`, samt `fardighet`/`ras`/`yrke`/`vapen`/`rustning`/`utrustning`/`besvarjelse`/`minibesvarjelse`/`formaga`) deklareras i `system.json`s `documentTypes`; datamodellerna binds i `scripts/dode.mjs` via `CONFIG.Actor.dataModels`/`CONFIG.Item.dataModels`.
- **Rena ES-moduler**, laddade direkt av Foundry via `esmodules` i `system.json`. `package.json` finns bara för kompendiebyggverktyget, inte för systemkoden.

```
scripts/
  dode.mjs               Entry point — registrerar datamodeller, sheets, hooks
  data/                   DataModel-scheman (actor-character.mjs, item-fardighet.mjs, ...)
  documents/              Document-subklasser (actor.mjs — rollSkill(), castSpell(); dode-active-effect.mjs)
  sheets/                 ApplicationV2-baserade sheets (character/npc/handlare/item)
  apps/                   Fristående ApplicationV2-appar (character-wizard.mjs, training.mjs, time-window.mjs, magic-training.mjs, gm-effects.mjs)
  rolls/                  Tärningsmekanik (fv-roll.mjs, damage-roll.mjs, attack.mjs, dual-wield.mjs)
  helpers/                Speldatakonstanter och delad logik (config.mjs — CONFIG.DODE, källciterat; special-ability-effects.mjs; schema-migrations.mjs; ep.mjs; time.mjs; anatomy.mjs)
  utils/                  Fristående verktyg (scene-effects.mjs — game.dode.SceneEffects)
  build/                  Node-skript för kompendiebyggnad
templates/*.hbs           Handlebars-mallar för sheets, appar, chattkort
lang/sv.json              All UI-text
styles/dode.css
assets/backgrounds/       Bakgrundstextur + träram, delad mellan ark och guide
packs/<namn>/             Kompilerad kompendiedata (LevelDB) — det Foundry faktiskt läser
packs/<namn>/_source/     Kompendiekälla (JSON, git-diffbar) — redigera här
```

## Regelfilosofi

Källmaterialet är ett medvetet, kurerat mixsystem — reglerna hämtas från flera källböcker (grundreglerna, Expert-regler, Krigarens Handbok, Hjältarnas Handbok, Alver, Svartfolk, Tjuvar och Lönnmördare, Magikerns Handbok, med flera) snarare än en enda bok rakt av. Det är ett designval, inte ett misstag. Vid en direkt sifferkonflikt mellan de yngre Expert-böckerna gäller precedensen RP > SL > SB > KH > REG (den yngre boken vinner).

Där en implementation avviker från eller förenklar källmaterialet är det flaggat med ett `⚠` i en kodkommentar på beräkningsstället, med bokreferens där det är känt — vad boken säger, vad koden gör i stället, och varför. Tanken är att andra ska kunna se och ifrågasätta en tolkning de inte håller med om, inte behöva gissa sig till den. Håll dig till samma princip i bidrag: cite källa, flagga avvikelser.

## Kompendiebyggnad

Kompendieinnehållet redigeras som JSON i `packs/<namn>/_source/`, sedan kompileras till det LevelDB-format Foundry läser.

```
npm install
npx fvtt configure set dataPath "<sökväg till din Foundry-installations rotmapp>"
npx fvtt package workon drakar-och-demoner-expert --type System
npm run packs:unpack   # LevelDB → packs/<namn>/_source/*.json
npm run packs:pack     # packs/<namn>/_source/*.json → LevelDB
```

**Kör aldrig `packs:unpack`/`packs:pack` medan Foundry-servern är igång** — LevelDB tillåter bara en skrivande klient åt gången.

Se [CHANGELOG.md](CHANGELOG.md) för versionshistorik och `docs/DESIGN_DECISIONS.md` för fullständig arkitektur-, status- och backlogdokumentation.

## Licens och rättigheter

Källkoden i det här repot (`scripts/`, `templates/`, `styles/`, byggverktygen) är licensierad under MIT — se [LICENSE](LICENSE).

MIT-licensen gäller **bara implementationen**, inte spelet den bygger på:

- **Foundry Virtual Tabletop** är en separat mjukvara med sin egen licens från Foundry Gaming, LLC. Det här repot innehåller inte Foundry själv och kräver en egen giltig Foundry-licens för att användas.
- **Drakar och Demoner Expert** — reglerna, namnen, ras-/yrkesbeskrivningarna och övrigt speldatainnehåll som återges i kompendierna (`packs/`) — tillhör sina respektive rättighetsinnehavare. Det här projektet är ett fan-/communityskapat kompatibilitetsverktyg och är inte officiellt anslutet till eller godkänt av rättighetsinnehavarna för Drakar och Demoner.
- **`assets/audio/the-iron-crown.mp3`** är genererat med [Suno](https://suno.com) på ett gratiskonto och delas här för icke-kommersiellt bruk, i enlighet med Sunos användarvillkor för den nivån — attributionen nedan krävs av de villkoren, inte valfri.

  > Musik: "The Iron Crown", genererad med Suno AI (gratis, icke-kommersiell nivå). Ej licensierad för kommersiellt bruk.
