# Testfall och testfixturer

> Skapad 2026-07-27. Syftet är dubbelt: (1) ge en **reproducerbar uppsättning rollpersoner** att regressionstesta systemet mot, och (2) ge en checklista för att avgöra om en **extern modul** fungerar ihop med systemet (`DESIGN_DECISIONS.md` §3 backlog 15c).
>
> Systemet har inget automatiskt testramverk — allt verifieras live i Foundry (se `CLAUDE.md`s livetestregler). Den här filen är därför en manuell/konsoldriven checklista, inte en test suite.

---

## Kom igång

Fixturerna skapas av `docs/dev/seed-test-party.js`. Klistra in hela filen i Foundrys konsol (F12) som SL, i en värld som kör systemet:

```js
await DoDETestParty.seed();      // skapar allt som saknas (idempotent — hoppar över befintliga)
DoDETestParty.report();          // console.table över alla fixturer
await DoDETestParty.teardown();  // tar bort ALLA seedade fixturer
```

Alla fixturer taggas med `flags.drakar-och-demoner-expert.testFixture = true`, så `teardown()` städar exakt och rör inga riktiga rollpersoner.

**⚠ Fixturerna skapas via guidens egen skaparväg**, inte via `Actor.create` direkt. Det är avsiktligt — går seedningen igenom felfritt är hela skaparkedjan (färdighetsgenerering, ålders-AE, prototyptoken, utrustningsköp) därmed också regressionstestad. Seedningen **är** alltså testfall UC-1.

**⚠ Referenser är UUID-baserade, inte namnbaserade.** Namn är inte stabila identifierare — översättningsmoduler av Babele-typ döper om kompendiedokument vid körning, så en namnuppslagning skulle sluta fungera i en engelskspråkig värld. UUID:na byggs av `_id` i `packs/<namn>/_source/*.json` och ligger fast över både ompackning och översättning. Namnet finns kvar som läsbar fallback som loggar en varning om det används.

---

## Standardsällskapet

Fyra spelbara rollpersoner som täcker den mekaniska bredden. Attributen i tabellen är **slutvärden** (bas + ras + ålder).

| Fixtur | Ras / Yrke | Ålder, nivå | Täcker | Nyckelvärden |
|---|---|---|---|---|
| **Grimne Stenhammar** | Dvärg / Krigare | Mogen, vanlig | Närstridsgrundfallet. Rasbonus + buren rustning (ABS) — utgångsläget för strids- och tokenmoduler | STY 14, KP 13, 25 färdigheter, 2 utrustning |
| **Sylvie Månskir** | Alv / Magiker | Ung, slumpens-hjälte | Magiker. Hög PSY → testar PSY-baren (`bar2`) och besvärjelseflöden | PSY 14, KP 10, 19 färdigheter |
| **Rask Fingerfärdig** | Människa / Tjuv | Mogen, vanlig | **Människa = inga rasmodifikationer.** Isolerar buggar som annars döljs av rasbonusar | STY 10 (= bas), 20 färdigheter |
| **Bramla Rotfast** | Halvlängdsman / Utbygdsjägare | Medelålders, sann hjälte | **Negativ rasmod** (STY −4) + högre nivå (fler förmågeslots/BP/EP) | STY 6, PSY 14, 22 färdigheter |

## Kantfall

Medvetet udda aktörer — inte ett spelbart sällskap.

| Fixtur | Testar | Förväntat |
|---|---|---|
| **EDGE Tom rollperson** | Varken ras eller yrke | Arket renderar med tomma släppzoner, inga AE:er, bara de 16 primära färdigheterna, inga yrkesfärdigheter |
| **EDGE Gudafödd Gammal** | Högsta nivån mot sämsta ålderskategorin samtidigt | Flest förmågeslots/BP/EP, men STY−3/FYS−2/SMI−2/PSY+2 från åldern. Två motverkande ytterligheter |
| **EDGE Anka lågt KAR** | **Negativt attributvärde** (Anka har KAR −5, bas 4 → totalt −1) | Arket renderar utan krasch; `attributeToGroup(-1)` → grupp 0. ✅ Verifierat 2026-07-27 |

---

## Användningsfall

### UC-1 — Skapa rollperson via guiden
Körs automatiskt av `DoDETestParty.seed()`. Godkänt när alla sju fixturer skapas utan konsolfel.

Kontrollera på en nyskapad fixtur:
- [ ] `img` och `prototypeToken.texture.src` är satta till den **könade** ras-/yrkesbilden
- [ ] `prototypeToken.actorLink === true` (annars blir varje utplacerad token en fristående kopia)
- [ ] `prototypeToken.bar1.attribute === "hp"`, `bar2.attribute === "resources.psy"`
- [ ] `prototypeToken.sight.enabled === true`, `disposition === 1` (FRIENDLY)
- [ ] 16 primära färdigheter + yrkets färdigheter finns, ingen dubblett
- [ ] Ålders-AE finns om ålderskategorin har modifikationer

### UC-2 — Redigera befintlig rollperson (guidens redigeringsläge)
Det viktigaste regressionstestet — här kan data faktiskt förstöras.

1. Notera utgångsläget: `DoDETestParty.report()` + antal färdigheter och ras-items på **Grimne**.
2. Lägg till en `sekundar`-färdighet manuellt på arket ("+ Ny färdighet" → valfri sekundär) och höj dess FV.
3. Som SL: klicka hänglåset på arket → flaggan `wizardUnlocked` sätts.
4. Klicka "Redigera i guiden". Ändra **ålder** och ett **attribut**, köp +1 FV på en färdighet. Spara.
5. Assertera:

```js
const a = game.actors.getName("Grimne Stenhammar");
const sk = a.items.filter(i => i.type === "fardighet");
const names = sk.map(s => s.name);
console.table({
  rasItems: a.items.filter(i => i.type === "ras").length,          // ska vara 1
  dubbletter: names.filter((n,i) => names.indexOf(n) !== i).length, // ska vara 0
  aldersAE: a.effects.filter(e => e.getFlag(game.system.id,"source") === "age").length, // ska vara 1
  unlockFlag: a.getFlag(game.system.id, "wizardUnlocked"),          // ska vara false
  utrustning: a.items.filter(i => ["vapen","rustning"].includes(i.type)).length // oförändrat
});
```

- [ ] Exakt **1** ras-item (en dubblett skulle dubbla rasbonusen — buggklassen från session 8)
- [ ] **0** dubbletter bland färdighetsnamnen
- [ ] Exakt **1** ålders-AE, uppdaterad och inte dubblerad
- [ ] Den manuellt tillagda `sekundar`-färdigheten finns kvar **med sitt FV orört**
- [ ] Utrustningen orörd (utrustningssteget hoppas över i redigeringsläge)
- [ ] `wizardUnlocked` är `false` efteråt (engångsnyckel)
- [ ] Attributmatten stämmer: varje källa (ras, ålder) applicerad **exakt en gång** — kontrollera via Mod-tooltipen på arket
- [ ] Ras- och yrkeskorten är gråade/oklickbara i redigeringsläge

### UC-3 — Idempotens
Öppna redigeringsläget igen på samma rollperson och spara **utan att ändra något**.
- [ ] Antal färdigheter, ras-items, AE:er och attributvärden är exakt oförändrade (noll drift)

### UC-4 — Behörighet
- [ ] En spelare utan `wizardUnlocked` ser **varken** hänglåset (SL-only) **eller** "Redigera i guiden"
- [ ] SL ser båda knapparna alltid
- [ ] Direktanrop `game.dode.openCharacterWizard(actor)` som låst spelare ska nekas av knappens vakt (`#onOpenWizardEdit`)

---

## Vapenfärdighetsval (yrkesfärdighetssteget) — UC-W1 till UC-W12

> Tillagd 2026-08-08 på Johans begäran: *"make sure we have test use cases for
> like 10-15 combos that we test properly... run in wizard with real clicks
> to make sure they work properly, is intuitive... I felt the weapon
> selection UI setup is weird and not natural."* Ledde till att den fria
> textrutan (autokomplettering mot `dode-weapon-suggestions`) byttes mot en
> riktig `<select>` ur den faktiska vapenkatalogen (samma mönster som
> språkpoolerna, med "redan valt"/"redan yrkesfärdighet"-utgråning och
> STY/SMI-attribut synligt per rad) — se `docs/DESIGN_DECISIONS.md` backlog
> 67 för hela motiveringen och fyndet.

**Täcker hela intervallet 1–6 valfria vapenfärdighetsplatser** (varje yrke i
`packs/yrken` som har en `vapenfärdighet`-choicePool, sorterat på antal):

| # | Ras | Yrke | Platser | Vad den isolerar |
|---|---|---|---|---|
| UC-W1 | Alv | Bard | 1 | "Elfenben-vapenspecialisten" — bara EN vapenfärdighet tillåten. Bard har DESSUTOM egna namngivna vapen (Dolk, Trästav) — testar att poolen inte erbjuder dubbletter av dem. |
| UC-W2 | Alv | Lönnmördare | 1 | Samma 1-plats-fall, annat yrke/bas — bekräftar mönstret inte är Bard-specifikt. |
| UC-W3 | Människa | Krigarmunk | 1 | Krigarspecialisering, inte bas-Krigare (som saknar egen vapenpool helt). |
| UC-W4 | Människa | Vapenmästare | 1 (+dualWieldAlt) | Samma pool som backlog 66:s Ambidextriös-fixtur — kryssrutan expanderar platsen till 2 utan att röra `<select>`-mekaniken. |
| UC-W5 | Halvorch | Giftmästare | 2 | Lönnmördarspecialisering, låg platsräkning. |
| UC-W6 | Människa | Fixare | 2 | Tjuvspecialisering, samma platsräkning som UC-W5 men annan bas. |
| UC-W7 | Dvärg | Sprätthök | 3 | Krigarspecialisering med udda namn — inget släktskap med vapenval i sig, bara ett tredje datapunkt på 3 platser. |
| UC-W8 | Människa | Stråtrövare | 3 | Tjuvspecialisering, samma platsräkning som UC-W7. |
| UC-W9 | Människa | Paladin | 4 | **Magianvändare** — testar att vapenpoolen fungerar OFÖRÄNDRAT när `steps`-arrayen också innehåller "magiskola". Hittade en test­metodik-fälla här (se nedan), inte en produktbugg. |
| UC-W10 | Dvärg | Barbar | 5 | "Krigaren som kan 6 olika vapentyper" nästan — en plats under taket. |
| UC-W11 | Människa | Soldat | 5 | Samma platsräkning som UC-W10, annan specialisering. |
| UC-W12 | Människa | Gladiator | 6 | **Johans "krigare som kan 6 olika vapentyper"** — flest platser i hela yrkeskatalogen. |

**Körning:** `docs/dev/seed-test-party.js`s `fillProfessionSkills` motsvarar
UC-W1–W12 programmatiskt vid varje `DoDETestParty.seed()`, men den FULLA
verifieringen (riktiga `<select>`-element, riktiga `change`-events, riktig
DOM-omläsning mellan varje rad) kördes en gång i konsolen 2026-08-08 mot
alla tolv samtidigt:

```js
// Öppna guiden, sätt ras/yrke/attribut, rendera EN gång (viktigt — se ⚠
// nedan), räkna om steps, hoppa till yrkesfardigheter, rendera igen.
// Klicka sedan igenom varje <select> i tur och ordning med RIKTIGA
// change-events, läs om DOM:en mellan varje rad (annars ser man en
// föråldrad "redan valt"-lista och missar riktiga dubbletter).
```

**Resultat, alla 12:** rätt antal platser fyllda, **noll dubbletter** i någon
kombo (bekräftar att "redan valt"/"redan yrkesfärdighet"-utgråningen
fungerar i en RIKTIG interaktionssekvens, inte bara i en statisk
ögonblicksbild), 0 konsolfel. En fullständig skapelserunda (UC-W1, Alv/Bard,
"Långbåge" valt) verifierade att den skapade `fardighet`-posten fick rätt
`attribute:"smi"`, `weaponGroup:"bagar"`, `costTier:"yrkesfardighet"` — exakt
vad den gamla fritextversionen skulle producerat vid en korrekt stavad
matchning, men nu utan möjligheten att stava fel.

**⚠ Testmetodik-fälla hittad under UC-W9 (Paladin), värd att komma ihåg:**
att sätta `app.stepIndex = app.steps.indexOf("yrkesfardigheter")` INNAN
`app.render()` någonsin körts på den nya ras/yrkes-kombinationen använder en
FÖRÅLDRAD `steps`-array (från förra kombinationens profession) — om det nya
yrket har magi (`isMagicUser`) läggs "magiskola" till i arrayen vid nästa
render, vilket SKIFTAR alla efterföljande index. Symptomet var förvirrande:
guiden hoppade tyst till "sprak"-steget i stället för "yrkesfardigheter"
efter ett enda klick, utan något konsolfel. Ingen bugg i själva guiden — bara
i testskriptets ordning. Fix: `await app.render()` EN gång direkt efter att
ras/yrke satts, LÄS OM `app.steps` efter den rendern, sätt `stepIndex` mot
den FÄRSKA arrayen, rendera sedan igen för att faktiskt visa steget.

---

## Modulkompatibilitet

Testfall för externa moduler (`DESIGN_DECISIONS.md` §3 backlog 15c). Förutsätter att standardsällskapet är seedat och utplacerat på en scen.

| Modul | Vad som ska testas | Beror på |
|---|---|---|
| **Carousel Combat Tracker** | Starta strid med alla fyra, slå initiativ, se att KP-baren visas per token | `prototypeToken.bar1/bar2`, `actorLink`, `disposition` |
| **Monk's Combat Marker** | Markör följer token vid tur | Token-placering, `actorLink` |
| **Dice So Nice / Dice Tray** | Slå en färdighet och en skada från arket — 3D-tärningar ska visas | `fv-roll.mjs`, `damage-roll.mjs` (använder `Roll`+`toMessage`) |
| **Tokenizer** | Sätt token-/porträttbild på en fixtur | `img`, `prototypeToken.texture.src` |
| **PopOut!** | Poppa ut ett karaktärsark i eget fönster | ApplicationV2-arket, `.window-content`-scroll (§6) |
| **Torch** | Ljuskälla på en token | `prototypeToken.light`, `sight.enabled` |

**Generell varning:** de flesta communitymoduler antar dnd5e:s eller PF2e:s datavägar (t.ex. `system.attributes.hp.value`). Vårt KP ligger på `system.hp.value` och PSY på `system.resources.psy.value`. Moduler som läser **token-barsen** i stället för systemspecifika fält fungerar oftast direkt — vilket är en av vinsterna med `primaryTokenAttribute`/`secondaryTokenAttribute` i `system.json`.

---

## Ytterligare kantfall att testa manuellt

Dessa har ingen fixtur (de är tillstånd, inte rollpersoner):

- [ ] **KP 0** — sätt `system.hp.value = 0` på Grimne. Stridsmoduler och KP-baren ska klara noll/negativt.
- [ ] **Utrustad vs ej utrustad** — växla equip-knappen på ett magiskt föremål och bekräfta att attributbonusen slås av/på (`shouldApplyChange`-grinden, §1).
- [ ] **Synlighet per roll** — logga in som `Player1` i en andra webbläsarsession och bekräfta att bara `raser`/`yrken`/`besvarjelser`/`vapen-utrustning` syns bland kompendierna (§7.4).
- [ ] **Ompackning** — kör `npm run packs:pack` med servern nedstängd och bekräfta att fixturseedningen fortfarande hittar alla UUID:n (fångar id-drift vid ombyggda packs).
- [ ] **Många färdigheter** — köp upp en rollperson till 30+ färdigheter och kontrollera att arket scrollar (`.window-content { overflow-y: auto }`, §6).
