# Drakar och Demoner Expert — Foundry VTT-system

🇸🇪 Svenska | [🇬🇧 English](README.en.md)

Ett fristående [Foundry Virtual Tabletop](https://foundryvtt.com/)-system för det svenska rollspelet **Drakar och Demoner Expert** (1991). Byggt från grunden mot Foundrys moderna DataModel/ApplicationV2-arkitektur — inget `template.json`, inget bundlingsteg för systemkoden.

**System-id:** `drakar-och-demoner-expert`
**Foundry-kompatibilitet:** minimum v12, verifierad mot v14
**Klientspråk:** svenska (`lang/sv.json`) och engelska (`lang/en.json`) för allt UI-chrome (fältetiketter, knappar, notiser, chattkort). `regler`-kompendiets 11 regelsidor är dessutom fullt översatta och växlar automatiskt med klientens språkval (en `JournalEntryPage` per språk i samma dokument — se "Kända begränsningar"). Övrigt kompendieinnehåll (vapen, besvärjelser, raser, yrken, monster, `sl-regler`/`journaler`) är på svenska oavsett klientspråk.

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
| Förflyttning & belastning på kartan — bördetabell (SPB s.44) som faktiskt påverkar förflyttning/SMI/CL, DoD-nivåer på dragningslinjalen (kan anfalla/full förflyttning/springa/sprinta), 3D-höjdmedveten närstridsräckvidd, terräng via Foundrys egna kartregioner, ryttare↔riddjur-länk | Klar, se detaljer nedan |
| FV-baserade färdighetsslag (perfekt/fummel-bekräftelse, Dice So Nice-stöd) | Klar |
| Guidad rollpersonsskapare (19 steg, bokexakt BP/EP-ekonomi, point-buy-attribut) | Klar, se detaljer nedan |
| Kompendier: 13 raser, 39 yrken, 375 vapen/utrustning, 475 besvärjelser (14 magiskolor), 242 monster | Klar (fortsatt luckor i bildtäckning, samt i bestiary-täckningen mot källböckerna och beskrivningstexternas kvalitet — se nedan). Besvärjelsekatalogens katalogkomplettering mot Formelboken är HELT KLAR; Kaos Väktares demonologitillägg (3 yrken, Portalmagi som 14:e skola) tillagt 2026-09-02 |
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
9. **Yrke** — 39 yrken (11 grundyrken + 28 specialiseringar från Krigarens Handbok/Tjuvar och Lönnmördare/Kaos Väktare)
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

### Förflyttning & belastning på kartan

Bördetabellen (`system.encumbrance`, Spelarboken s.44) summerar buren vikt (rustning räknas halvt om utrustad, kläder inte alls) och sätter en riktig konsekvens: vid tillräcklig börda minskar Förflyttningsförmåga, SMI och CL på alla SMI-baserade färdigheter samtidigt (golv 1), och en "Belastad"-statusikon syns automatiskt på tokenet. Under strid färgar en egen linjal (`CONFIG.Token.rulerClass`) draget i DoD:s egna nivåer — kan fortfarande anfalla (≤½×), full förflyttning (1×), Springa (2×), Sprinta (3×) — genom att läsa Foundrys egen `movementHistory`, som nollställs per stridsrunda i stället för Foundrys standard per tur. Rent visuellt/analytiskt, ingen spärr — SL dömer. Höjdskillnader (t.ex. en balkong) mäts nu äkta 3D, så en närstridsattack mellan olika nivåer nekas automatiskt om avståndet överstiger vapnets räckvidd. Terräng (träsk, djup snö) hanteras med Foundrys inbyggda kartregioner, inget eget system. Arket visar även en "Kan inte simma"-rad när rustning (oavsett vikt, Rollpersonen s.55) eller börda (Spelarboken s.44) blockerar simning — rent informativt, ingen spärr. Monster/NPC:er får sin egen rörelsebudget per rörelsetyp (gång/flyg/simning/…) tolkad live ur deras källtext ("F30/L26"), så linjalen färgar deras drag lika korrekt som en rollpersons. En ryttare kan monteras på ett riddjur (`game.dode.mountToken()`) och följer det sedan automatiskt varje gång riddjuret flyttas på kartan — se den paketerade NPC:n "Tung stridshäst" och regelsidan "Ridning & riddjur" (Krigarens Handbok s.27-29: Rida-slag, galoppanfall, avståndsvapen från hästryggen, slungas ur sadeln, manövrer till häst).

### Kompendier

| Kompendie | Innehåll |
|---|---|
| `raser` | 13 raser: 7 grundraser (Människa, Alv, Halvalv, Halvlängdsman, Dvärg, Halvork, Anka) + 6 alvsläkten (Alver s.22) |
| `yrken` | 39 yrken: 11 grundyrken (Bard, Helare, Krigare, Lärd man, Lönnmördare, Magiker, Munk, Riddare, Sjöfarare, Tjuv, Utbygdsjägare) + 28 specialiseringar (Krigarens Handbok, Tjuvar och Lönnmördare, Kaos Väktare — Demonolog/Demonjägare/Demonkrigare), varje yrke med en strukturerad `professionSkills`-lista för den automatiska färdighetstilldelningen och (där källan ger det) mekaniskt kopplade yrkesförmågor |
| `vapen-utrustning` | 375 poster: 53 vapen (inkl. Silverdolk, `material:"silver"`, 2026-09-03 — hela `DODE.weaponGroups`-tabellen fullt transkriberad 2026-09-08, inklusive Tornerlans från Krigarens Handbok), 45 rustningsdelar (per kroppsdel, SB s.27), 277 övrig utrustning (inkl. 6 ammunitionsposter — Pilar/Silverpilar/Armborstpilar/Silverbultar/Slungstenar/Silverkulor, `category:"ammunition"`, `material`-fält avgör resistanskontrollen i strid — "bågen är bara bågen, det är pilen som är av silver") — köpbara i guidens utrustningssteg. Vikt anges i kg (Spelarboken s.44/s.12, migrerad från Magi-regelbokens BEP-tabell 2026-09-06 — se Kända begränsningar) |
| `besvarjelser` | 475 besvärjelser (431 besvärjelser + 44 minibesvärjelser, minibesvärjelserna samlade i en egen "Minimagi"-undermapp per skola) — Formelbokens katalogkomplettering är KLAR (13 skolor + Allmänna), plus Kaos Väktares demonologitillägg (Portalmagi som 14:e skola, 7 besvärjelser + 14 nya/3 ersatta Demonologi-besvärjelser) |
| `monster` | 242 varelser för NPC/monster-actortypen (hela Monsterboken 1 OCH 2, plus hela Monsterboxen II — inklusive stridsstatblock för de folkslag som också finns som spelbara raser — samt ett fullt statblock för "Tung stridshäst", Krigarens Handbok s.27-28) |
| `magiska-foremal` | Magiska föremål — GM-only pack, separat från den spelarsynliga butiken |
| `handlare` | Handlar-/butiksaktörer (egen `handlare`-actortyp) |
| `regler`, `sl-regler`, `tabeller` | Regeltext och slumptabeller som journal-/rolltable-dokument, sourcade ur källböckerna. `regler` innehåller även en Raser- och en Yrken-översiktssida (samtliga raser/yrken i tabellform), samt fullständiga regelsidor för Förflyttning, Bärförmåga & belastning, Ridning & riddjur, Strid, Att använda magi, Skräck & fobier, Träffområden & skador och Vapen & rustning. Alla 11 sidor är fullt översatta till engelska och växlar automatiskt med klientens språkval (se "Kända begränsningar") — `sl-regler`/`tabeller` är fortfarande enbart svenska |
| `journaler` (visas som "Magiskolreferenser") | 15 auto-genererade skolreferenssidor (14 magiskolor, inklusive Portalmagi, + Allmänna besvärjelser), en per skola, med en besvärjelse-/minimagitabell sammanställd ur `besvarjelser`-kompendiet (regenereras via `scripts/build/generate-journal-summaries.mjs` varje gång besvärjelser ändras), plus riktig skolbeskrivningstext för 13 av 15 (Alkemi/Allmänna besvärjelser saknar ännu källtext) |
| `scener` | Färdiga scener, bl.a. rollpersonsskaparens egen bakgrundsscen |

Kompendieinnehållet redigeras som JSON i `packs/<namn>/_source/`, och kompileras till det LevelDB-format Foundry faktiskt läser — se "Kompendiebyggnad" nedan.

### Kända begränsningar

- **Föremålsvikternas BEP→kg-migration (×3) matchar inte Spelarbokens egna kg-prissatta utrustningslistor item-för-item.** Konverteringsfaktorn (1 BEP = 3 kg) är exakt vad Spelarbokens egen errata (s.12) föreskriver, men Magi-regelbokens och Spelarbokens utrustningslistor tycks vara oberoende viktsatta för samma föremål — ett stickprov av 19 poster visade bara 1 träff. Se `docs/DESIGN_DECISIONS.md` backlog 117 för en eventuell framtida post-för-post-avstämning.
- **GM-effekternas skillMod/CL-mod/läkningstakt-lager syns inte som ikoner på token.** GM-effektfönstret (`scripts/apps/gm-effects.mjs`) redigerar person-/scen-/världseffekter lagrade som ren data i en Setting/flagga, inte som riktiga `ActiveEffect`-dokument (embedded färdighets-Items kan inte vara AE-mål, se kodkommentarer) — de påverkar rätt siffra i beräkningarna men ger ingen visuell markering på tokenet. Genuina `ActiveEffect`-baserade buffar (`game.dode.SceneEffects`, utrustning/förmågor) FÅR en ikon på tokenet om anroparen anger en `img`, och DoDE:s två registrerade villkor (Arm obrukbar/Hand upptagen) syns automatiskt via Foundrys egen Token HUD. Periodiska effekter (gift/eld/blödning) synkas automatiskt mot Foundrys motsvarande kärn-statusikoner (`poison`/`burning`/`bleeding`) på Token HUD — övriga periodeffekt-källor visas fortfarande bara som en rad i GM-effektfönstrets aktörssektion.
- **Vapensortimentet täcker nu alla 49 poster i `DODE.weaponGroups`-tabellen (2026-09-08), plus Bola/Lasso/Oxpiska/Silverdolk som specialvapen — 53 vapen totalt.** Sourcat med RP&gt;SL&gt;SB&gt;KH&gt;REG-precedensen: 19 av de 29 nybyggda vapnen kommer från Spelarboken (där REG antingen saknar vapnet helt eller ger avvikande skadetärningar mot samma bokprecedensregel), 9 från REG (SB täcker inte vapnet alls), och den sista — **Tornerlans** — från Krigarens Handbok (varken REG eller SB har den; ingen av de fem böckerna konkurrerar om samma post, så precedensregeln avgör inget här). ⚠ Tornerlans egen källa (KH s.50) kör ett separat, valfritt skadesystem (kroppspoäng/smärtpoäng delat i två kolumner) som resten av kompendiet inte implementerar — vapnets `damage`-fält är satt till `"Spec (...)"` med en förklarande not, samma mönster som redan används för Bola/Lasso/Blåsrör; SL avgör smärtpoängseffekten manuellt. ⚠ Samma vapenpass hittade och rättade en genuin, tidigare osynlig bugg: 66 poster (i huvudsak rustningsdelar och sköldar) hade `source.book: "spelarboken"` — en ogiltig nyckel (rätt nyckel är `"sb"`) som `CONFIG.DODE.books`s enum tyst nollställde till tomt vid varje dokumentladdning, så källhänvisningen visade "okänd källa" i UI:t trots att `_source`-filen såg korrekt ut.
- **Bestiaryn täcker 242 varelser** ur Monsterboken 1, Monsterboken 2, Monsterboxen II och Svartfolk-supplementet — alla fyra KOMPLETTA, inklusive Svartfolks namngivna spelledarpersoner och färdiga svartfolks-arketyper att placera ut direkt. ⚠ Täckningsgraden mot det samlade källmaterialet är dock **inte** fastställd: utöver Monsterboxen IV (56 poster, inga byggda) finns ytterligare två böcker med varelsestatblock som ännu inte reviderats — *Monster och Man i Ereb Altor* och *Drakar*.
- **Spelbara raser finns även som stridbara NPC:er.** Alv-släktena, dvärg, anka, halvlängdsman, halvalv och halvorch har både en `ras`-post i `raser` (rollpersonsbyggsten) och ett fullständigt stridsstatblock i `monster` — så ett högalvsgarde eller en dvärgpatrull kan placeras ut som motståndare direkt.
- **De flesta besvärjelser saknar egen bildikon** — de allra flesta visar sin magiskolas symbol i stället för unik konst.
- **Besvärjelsekatalogens katalogkomplettering mot Formelboken är KLAR.** Samtliga 13 spelbara magiskolor + Allmänna är fullt transkriberade (se `docs/DESIGN_DECISIONS.md` §2). ⚠ Demonologis fyra unikt namngivna demoner (Gollog, Syreb, Ballouq, Nimum) är medvetet INTE byggda som besvärjelser — de har egna fullständiga monsterstatblock i källan och hör hemma i en framtida `monster`-pack-utökning i stället (se backlog 87).
- **~122 av 475 besvärjelser har bara en komprimerad en-radssammanfattning** i stället för bokens faktiska beskrivningstext (kvar från 2026-07-27-portens första omgång) — uppgraderas skola för skola i samma pass som katalogkompletteringen. Allmänna besvärjelser, Mentalism, Nekromanti, Röstmagi, Spiritism, Stavmagi, Symbolism, Demonologi och Portalmagi är helt klara på den punkten; Animism, Elementarmagi, Harmonism, Häxkonster och Illusionism kvarstår (klara på spellista, inte på beskrivningskvalitet).
- **Stridskonster (obeväpnad strid, RP s.56-58/KH s.91-93) är byggt med en medveten förenkling.** Boken beskriver en spelarkomponerad teknikbunt med ett delat färdighetsvärde; den nuvarande implementationen ger i stället varje teknik ett eget, oberoende FV (samma modell som Vapentekniker) — ett uttryckligt, dokumenterat avsteg, inte en bugg.
- **Svartfolk finns inte som ett spelbart rasval i rollpersonsguiden.** Svartfolk-supplementets NPC-/monsterinnehåll (SLP:er, arketyper) är byggt och ingår i bestiaryn ovan — men en spelbar Svartfolk-bas-ras med egna undersläkten (samma form som Alv/Alvsläkten) är inte påbörjad.
- **Bara `regler`-kompendiets 11 regelsidor är översatta till engelska** — allt annat kompendieinnehåll (vapen, besvärjelser, raser, yrken, monster, `sl-regler`, `journaler`) är fortfarande enbart svenska, oavsett klientspråk. Mekanismen (en engelsk `JournalEntryPage` per svensk sida, filtrerad mot `game.i18n.lang` med automatisk fallback till svenska om ingen översättning finns) är byggd för att generaliseras till fler kompendier om det efterfrågas. Rollpersonsguidens egna förklaringstexter (hintar, stegöversikten, granskningssidan) är däremot fullt översatta — se nästa punkt.
- **Färdighetsnamn, förmågenamn och guidens statiska stegetiketter (t.ex. "Kön", "Nivå", "Ras") är inte lokaliserade** — de är hårdkodade i `scripts/apps/character-wizard.mjs` (STEP_LABELS, kön-/nivåalternativ) respektive `scripts/helpers/config.mjs` (`DODE.skills`), skilt från de mallbaserade texterna. En engelsktalande spelare ser alltså ett engelskt UI-skal runt en handfull svenska sakord.
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
