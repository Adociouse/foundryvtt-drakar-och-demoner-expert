# Drakar och Demoner Expert — Foundry VTT-system

Ett fristående [Foundry Virtual Tabletop](https://foundryvtt.com/)-system för det svenska rollspelet **Drakar och Demoner Expert** (1991). Byggt från grunden mot Foundrys moderna DataModel/ApplicationV2-arkitektur — inget `template.json`, inget bundlingsteg för systemkoden.

**System-id:** `drakar-och-demoner-expert`
**Foundry-kompatibilitet:** minimum v12, verifierad mot v14

## Status

| Del | Status |
|---|---|
| Grundegenskaper, härledda värden (KP, skadebonus, förflyttning, ABS) | Klar |
| FV-baserade färdighetsslag (perfekt/fummel-bekräftelse) | Klar |
| Item-typer: ras, yrke, vapen, rustning, besvärjelse + kompendier | Klar (representativa urval, inte fullständiga — se nedan) |
| NPC/monster-actortyp + monsterkompendium | Klar |
| Guidad rollpersonsskapare v2 (13 steg, bokexakt BP/EP-ekonomi) | Klar (Fas 1–9 av 10 — se nedan) |
| Stridsintegration (skada, absorption) och magisystem (kastning, PSY-resurs) | Klar, med några medvetna förenklingar (se kodkommentarer) |

### Rollpersonsskaparen

En guidad, ApplicationV2-baserad rollpersonsskapare (`scripts/apps/character-wizard.mjs`) tar spelaren genom 13 steg i ordning:

1. **Nivå** — Vanlig (125 BP), Extraordinär (150 BP) eller Hjälte (175 BP). Slår ihop Krigarens Handboks och Hjältarnas Handboks BP-tabeller till en enda gradvis skala, för kampanjkontinuitet mellan de två bokserierna.
2. **Grunder** — namn, kön (styr vilken ras-/yrkesporträttvariant som visas och ärvs)
3. **Ras** — kostar BP ur nivåpoolen
4. **Yrke**
5. **Attribut** — 3T6 per grundegenskap
6. **Särskilda förmågor** — antal slots styrt av nivå (fritext, se begränsningar nedan)
7. **Socialt stånd** — 2T6 + valfri BP-spend (RP s.27–28, 9-ståndssystemet)
8. **Startkapital** — 2T6 + BP, kopplat till socialt stånd
9. **Ålder** — låser upp EP-budgeten, applicerar startkapitalets åldersmultiplikator (Ung/Mogen/Medelålders/Gammal)
10. **Färdigheter** — se tvålagersmodellen nedan
11. **Livsmål** — 21 fördefinierade alternativ + fritext
12. **Utrustning** — köp vapen/rustning mot startkapitalet
13. **Granska** — sammanfattning innan rollpersonen skapas

**BP/EP-ekonomi:** Varje nivå ger en pool av byggpoäng (BP) som spenderas på ras, socialt stånd och startkapital. Överbliven BP vid slutet av skapandet (`bp.remaining`) omvandlas ×5 till erfarenhetspoäng (EP), som spenderas i färdighetssteget (RP s.28: *"Kvarvarande BP × 5"*).

**Tvålagers färdighetsmodell:** Alla primära färdigheter (16 st, RP s.36) och yrkets matchade färdigheter tilldelas automatiskt sitt startvärde (FV = grundegenskapens grupp, "BC") vid respektive attributs/yrkets val — inget spelaren behöver slå fram själv. Därefter kan EP-poolen spenderas i färdighetssteget för att höja valfri färdighet över BC, enligt RP s.30:s kumulativa kostnadstabell, begränsat av yrkets maxstartvärde (KH s.3).

**Bakgrundsbild:** Karaktärsarket och guiden delar samma visuella identitet — en mörk läder-/trätextur (`assets/backgrounds/character-sheet-leather.png` som bakgrund, `imagen_20260719_201503_2.png` som träram via `border-image`), se `styles/dode.css`.

### Kompendier

| Kompendie | Innehåll |
|---|---|
| `raser` | 7 raser (Människa, Alv, Halvalv, Halvling/Halvlängdsman, Dvärg, Halvork, Anka) |
| `yrken` | 11 yrken (Bard, Helare, Krigare, Lärd man, Lönnmördare, Magiker, Munk, Riddare, Sjöfarare, Tjuv, Utbygdsjägare), varje yrke med strukturerad `professionSkills`-lista (namn + attribut) för den automatiska färdighetstilldelningen |
| `vapen-utrustning` | Representativt urval vapen och rustningar, köpbara i guidens utrustningssteg |
| `besvarjelser` | Representativt urval besvärjelser |
| `monster` | 14 varelser för NPC/monster-actortypen |

Kompendieinnehållet redigeras som JSON i `packs/<namn>/_source/`, och kompileras till det LevelDB-format Foundry faktiskt läser — se "Kompendiebyggnad" nedan.

### Kända begränsningar

- **Fas 10 av rollpersonsskaparen (Hjältarnas Handboks Öde-typer)** är opåbörjad — blockerad av en forskningslucka, ingen konkret Öde-typ-tabell hittad i källmaterialet än. Se `PLAN_WIZARD_V2.md`.
- **Åldersmodifikationer på grundegenskaper** är inte implementerade (infrastrukturen finns, tabellen är medvetet tom) — blockerad av samma typ av forskningslucka (exakt tabell från RP s.24–25 inte extraherad). Åldersmultiplikatorn på startkapital fungerar dock redan.
- **Särskilda förmågor** är fritext, inte en tärningstabell — ingen bok-tabell över konkreta förmågor har hittats än, bara antalet slots per nivå är källbelagt.
- Kompendierna är representativa urval, inte kompletta: en delmängd av vapen och besvärjelser, inga alv-subraser, inga klass-specialiseringar från Krigarens Handbok/Tjuvar och Lönnmördare.
- Yrkenas `professionSkills`-listor innehåller bara konkreta, namngivna färdigheter — val-baserade poster ("Tala språk, max 2") och breda kategorier ("Alla strid utom Judo och Karate") är medvetet uteslutna, inte gissade.
- Ingen engelsk lokalisering — bara `lang/sv.json`.
- Se kodkommentarer märkta `⚠` för specifika, medvetet flaggade regelavvikelser eller förenklingar.

## Installation

Lägg systemmappen i din Foundry-installations `Data/systems/`-katalog (eller installera via manifest-URL när paketet publicerats i Foundrys paketlista). Inget byggsteg krävs — systemet är rena ES-moduler som Foundry laddar direkt.

## Arkitektur

- **Ingen `template.json`.** Actor/Item-subtyper deklareras i `system.json`s `documentTypes`; datamodellerna binds i `scripts/dode.mjs` via `CONFIG.Actor.dataModels`/`CONFIG.Item.dataModels`.
- **Rena ES-moduler**, laddade direkt av Foundry via `esmodules` i `system.json`. `package.json` finns bara för kompendiebyggverktyget, inte för systemkoden.

```
scripts/
  dode.mjs              Entry point — registrerar datamodeller, sheets, hooks
  data/                  DataModel-scheman (actor-character.mjs, item-fardighet.mjs, ...)
  documents/             Document-subklasser (t.ex. actor.mjs — rollSkill(), castSpell())
  sheets/                ApplicationV2-baserade sheets
  apps/                  Fristående ApplicationV2-appar (character-wizard.mjs — rollpersonsskaparen)
  rolls/                 Tärningsmekanik (fv-roll.mjs, damage-roll.mjs)
  helpers/config.mjs     Speldatakonstanter, källciterade (CONFIG.DODE)
  build/                 Node-skript för kompendiebyggnad
templates/*.hbs          Handlebars-mallar för sheets, appar, chattkort
lang/sv.json             All UI-text
styles/dode.css
assets/backgrounds/      Bakgrundstextur + träram, delad mellan ark och guide
packs/<namn>/            Kompilerad kompendiedata (LevelDB) — det Foundry faktiskt läser
packs/<namn>/_source/    Kompendiekälla (JSON, git-diffbar) — redigera här
```

## Regelfilosofi

Källmaterialet är ett medvetet, kurerat mixsystem — reglerna hämtas från flera källböcker (grundreglerna, Expert-regler, Krigarens Handbok, Hjältarnas Handbok, med flera) snarare än en enda bok rakt av. Det är ett designval, inte ett misstag.

Där en implementation avviker från eller förenklar källmaterialet är det flaggat med ett `⚠` i en kodkommentar på beräkningsstället, med bokreferens där det är känt. Tanken är att andra ska kunna se och ifrågasätta en tolkning de inte håller med om, inte behöva gissa sig till den. Håll dig till samma princip i bidrag: cite källa, flagga avvikelser.

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

## Licens och rättigheter

Källkoden i det här repot (`scripts/`, `templates/`, `styles/`, byggverktygen) är licensierad under MIT — se [LICENSE](LICENSE).

MIT-licensen gäller **bara implementationen**, inte spelet den bygger på:

- **Foundry Virtual Tabletop** är en separat mjukvara med sin egen licens från Foundry Gaming, LLC. Det här repot innehåller inte Foundry själv och kräver en egen giltig Foundry-licens för att användas.
- **Drakar och Demoner Expert** — reglerna, namnen, ras-/yrkesbeskrivningarna och övrigt speldatainnehåll som återges i kompendierna (`packs/`) — tillhör sina respektive rättighetsinnehavare. Det här projektet är ett fan-/communityskapat kompatibilitetsverktyg och är inte officiellt anslutet till eller godkänt av rättighetsinnehavarna för Drakar och Demoner.
