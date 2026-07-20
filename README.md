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
| Guidad rollpersonsskapare (nivå/kön/ras/yrke/attribut/socialt stånd/startkapital/ålder) | Under utveckling |
| Stridsintegration (skada, absorption) och magisystem (kastning, PSY-resurs) | Klar, med några medvetna förenklingar (se kodkommentarer) |

### Kända begränsningar

- Kompendierna är representativa urval, inte kompletta: en delmängd av vapen och besvärjelser, inga alv-subraser, inga klass-specialiseringar från Krigarens Handbok/Tjuvar och Lönnmördare.
- Färdigheter har ett direkt färdighetsvärde (FV) — det bokexakta erfarenhetspoäng-köpsystemet är inte implementerat än.
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
  apps/                  Fristående ApplicationV2-appar (t.ex. character-wizard.mjs)
  rolls/                 Tärningsmekanik (fv-roll.mjs, damage-roll.mjs)
  helpers/config.mjs     Speldatakonstanter, källciterade
  build/                 Node-skript för kompendiebyggnad
templates/*.hbs          Handlebars-mallar för sheets, appar, chattkort
lang/sv.json             All UI-text
styles/dode.css
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
