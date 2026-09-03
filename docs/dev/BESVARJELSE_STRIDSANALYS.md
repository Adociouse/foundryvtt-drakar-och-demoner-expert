# Besvärjelser i strid — analys och mekanisk implementationsplan

> Framtagen 2026-08-24 på Johans begäran: *"the selection of spells is working as it should in wizard. Then we need to analyze which spells could be used in combat or not and do a plan for how they will be mechanically implemented."*
>
> Underlaget är en fullständig genomläsning av samtliga 222 besvärjelser i `packs/besvarjelser/_source`, inte en nyckelordssökning. ⚠ Ett första försök med regex-klassificering taggade bara 95 av 222 och missade uppenbart stridsrelevanta besvärjelser som Blindhet, Förtrollad sömn, Orörlighet, Blixtnedslag och Stavprojektil — mönstren matchade inte källans faktiska formuleringar (`"1T6/E KP skada"` har inte "skada" direkt efter tärningen; `"Sövar"` är inte `"sömn"`; `"förlorar synförmågan"` är inte `"blind"`). Siffrorna nedan bygger därför på läsning, med regexen bara som sorteringshjälp.
>
> ⚠ **Katalogen har växt sedan detta skrevs (222 → 475 poster: hela katalogkompletteringen mot Formelboken + Kaos Väktares Demonologi-tillägg + den nya skolan Portalmagi).** Klassificeringssiffrorna nedan (≈85 stridsrelevanta, ≈137 icke-stridsrelevanta, m.fl.) är alltså ett **golv**, inte en aktuell exakt räkning — de beskriver bara de ursprungliga 222. Nya skolors/posters mekaniska behov bedöms vid respektive skolas kureringspass (se §0 nedan), inte genom att lita på att de redan ingår i denna analys.

---

## 0. Per-skola kureringsstatus — LÄS DETTA FÖRST, INNAN EN SKOLA PÅBÖRJAS

**Detta är den enda statustabellen för mekanisk besvärjelsekurering. Kontrollera den HÄR innan du börjar läsa/analysera en skola — annars finns risk för dubbelarbete.** "Kurerad" betyder: skolans alla besvärjelser (stora + mini) genomlästa mot HELA det mekaniska schemat (`instantEffect`/`damageType`/`statusEffect`/`resistedBy`/`saveAttribute`/`saveDifficulty`/`triggersFearTable`/`targetMode`/`battleRelevant`), och fälten satta där de faktiskt tillämpas — INTE bara "har fått en `battleRelevant`-flagga" eller "nämns i klassificeringen nedan". En skola kan bli "klar" utan att någon besvärjelse fick ett enda fält ändrat, om genomläsningen visar att inget i skolan mekaniskt passar schemat (se Allmänna) — "granskad, inget att göra" är ett giltigt, komplett slutresultat, inte ett ofärdigt.

| Skola | Poster (besv+mini) | Status | Datum | Not |
|---|---|---|---|---|
| **Allmänna** | 15+12=27 | ✅ Klar | 2026-09-03 | Nästan uteslutande skydd/ritualer/verktyg, inte skade-/statusbesvärjelser. Bara `battleRelevant:true` på Antimagi/Skingra/Beskyddare. Se DESIGN_DECISIONS.md §2 (backlog 78-uppföljning) för hela resonemanget. |
| Alkemi | 0 | — Inget innehåll | — | Registrerad magiskola (`DODE.magicSchools.alkemi`) men INGA besvärjelser byggda i denna skola ännu — inget att kurera förrän innehåll finns. |
| Animism | 45+4=49 | ⬜ Ej påbörjad | | |
| Demonologi | 25+4=29 | ⬜ Ej påbörjad | | Inkluderar Kaos Väktare-tillägget (2026-09-02). |
| **Elementarmagi** | 51+1=52 | ✅ Klar | 2026-09-03 | 5 skadebesvärjelser (`instantEffect`, Blixt/Eld redan kurerade sedan 2026-08-21, Frost/Energistråle/Explosion nya), 3 räddningsslag (`resistedBy`), 3 statuseffekter (`statusEffect`), 26 till fick bara `battleRelevant:true` (vapenbuffar/item-BV/rörelse-immunitet/auto-parering — inget fält passar, se skriptets kommentarer), 16 rörda inte alls. Terse beskrivningar (backlog 86, ej ännu uppgraderade till full boktext) — kurering byggd på de befintliga kompakta raderna, korsverifierad mot §1.1:s tidigare full-textklassificering där de överlappar. |
| Harmonism | 44+4=48 | ⬜ Ej påbörjad | | §1.1 har redan Hetta klassificerad. |
| Häxkonster | 23+0=23 | ⬜ Ej påbörjad | | |
| Illusionism | 23+5=28 | ⬜ Ej påbörjad | | |
| Mentalism | 63+2=65 | ⬜ Ej påbörjad | | Störst skola. §1.1/§1.3/§1.5 har redan flera Mentalism-poster klassificerade (Elchock, Kontrollera person, Kommando, m.fl.) — börja där. |
| Nekromanti | 46+8=54 | ⬜ Ej påbörjad | | §1.1 har redan Dödshand/Livsuttömning klassificerade. |
| Portalmagi | 7+0=7 | ⬜ Ej påbörjad | | Ny skola (Kaos Väktare, 2026-09-02) — fanns inte när denna analys skrevs, ingår inte i §1-7:s klassificering alls. |
| Röstmagi | 18+0=18 | ⬜ Ej påbörjad | | §1.1 har redan Röstprojektil/Krossa odöd/Tryckvåg klassificerade. |
| Spiritism | 24+0=24 | ⬜ Ej påbörjad | | §1.1 har redan Andeslag/Själaförvittring/Mental projektil klassificerade. |
| **Stavmagi** | 20+0=20 | ✅ Klar | 2026-09-03 | 4 skadebesvärjelser (`instantEffect`: Stavprojektil, Blixtnedslag, Åskknall, Jordbävning), 3 räddningsslag (`resistedBy`: Ljusblixt/psy, Blodregn/psy, Jordbävning/smi — Jordbävning har BÅDE skada och räddningsslag), 1 status utan eget slag (Förlamning → `statusEffect:"paralysis"`), 1 `triggersFearTable` (Blodregn, kopplad till Skräcktabellen). 9 till fick bara `battleRelevant:true` (auto-parering/summon/item-buff/item-förstörelse/disarm/opponerade slag mot ett vapen — inget fält passar). 4 lämnade orörda (ren utility: Tändare/Stavrep/Stavflykt/Vattendelning). **Två genuina schemaluckor hittade och medvetet lämnade omekaniserade, flaggade i skriptets kommentarer:** (1) Spindelväv och delvis Blodregn har FORMELBASERADE svårighetsgrader ("14+E"/"15+E" vs ett attribut) som `saveDifficulty`s fasta nivåer inte fångar exakt — Blodregn fick ändå en `svart`-approximation (SG15-baslinjen) för att inte lämna Skräcktabell-kopplingen helt obyggd, Spindelväv lämnades omekaniserad. (2) Eldvirvel är per-SR-skada (periodeffektmotorn, inte `instantEffect` — samma klass som Hetta/Dödshand från §1.1), Förintelse är permanent STO-utarmning (inte en enkel skadeformel) — båda bara `battleRelevant:true`. Se `curate-stavmagi.mjs` (sessionens scratchpad, inte incheckad) för fullständiga anteckningar per beslut. |
| Symbolism | 27+4=31 | ⬜ Ej påbörjad | | |

**Arbetsordning:** Johan väljer skola för skola (se ACTIVE_TASK.md för senaste). Poster-antal ovan är från en live-räkning 2026-09-03 (`node`-skript mot `packs/besvarjelser/_source`) — räkna om om det känns fel, `_source` är alltid facit.

---

## Sammanfattning

| | Antal |
|---|---|
| Besvärjelser totalt | **222** (191 `besvarjelse` + 31 `minibesvarjelse`) |
| **Stridsrelevanta** (gör något mot mål, allierad eller sig själv i strid) | **≈ 85** |
| Utforskning / social / hantverk / resa | ≈ 137 |
| Ritualer (kan per definition inte kastas i strid) | 19 |
| `kvick` — snabbkastade | 40 |
| Poster med ifylld `spellEffect` | **0** |

**Kärnfyndet:** katalogen är komplett och beskrivningarna är påfallande mekaniska — de innehåller redan tärningsformler, motståndsslag och varaktigheter i klartext. Det som saknas är inte kunskap utan **strukturerade fält**. Och fyra av de primitiver som behövs **finns redan byggda i systemet, med noll anropare**:

| Redan byggt | Var | Antal besvärjelser det låser upp |
|---|---|---|
| **Skräcktabellen** (9-rads RollTable, sourcad) | `packs/tabeller` | **8** |
| **`DODE.rollResistance` / `resistanceTarget`** (Motståndstabellen) | `config.mjs` | **≈ 30** |
| **`DODE.addPeriodicEffect`** (skada per SR/minut) | `config.mjs` | **6** |
| **`resistances[]`** (immunitet/reduktion per skadetyp) | `fields-resistances.mjs` | ~10 |

Det gör att den första implementationsfasen är ovanligt billig i förhållande till vad den ger: mycket av arbetet är **inkoppling**, inte nybyggnation.

---

## 1. Klassificering — vad besvärjelserna faktiskt gör

### 1.1 Direkt skada (≈ 22)

Behöver ett `instantEffect`-fält med tärningsformel. ⚠ **Rustningsinteraktionen skiljer sig per besvärjelse och är utskriven i källan** — den kan alltså inte antas:

| Besvärjelse | Skola | Skada | Rustning |
|---|---|---|---|
| Blixt | elementarmagi | 1T6/E | ⚠ **ingen rustning skyddar** |
| Eld | elementarmagi | 1T6/E | (ej angivet) |
| Energistråle | elementarmagi | 1T6/E | rustning + Skydd absorberar |
| Frost | elementarmagi | 1T6/E | rustning + Skydd absorberar |
| Elchock | mentalism | 1T4/E | ⚠ **metallrustning absorberar bara hälften** |
| Viggfångare | elementarmagi | 5T6 | — |
| Blixtnedslag | stavmagi | 1T6/E, allt inom 1 ruta | — |
| Åskknall | stavmagi | 2T6 | ⚠ **0–2 rutor immuna**, upp till 10 rutor träffas |
| Stavprojektil | stavmagi | 1T6/E | — |
| Jordbävning | stavmagi | 1T4+E + SMI-slag för att inte falla | — |
| Förintelse | stavmagi | KP = uttorkad STO (4 STO/E) | — |
| Röstprojektil | rostmagi | 1T6+E | ⚠ **auto-träff** |
| Krossa odöd | rostmagi | 1T10×E | ⚠ endast **korporala odöda** |
| Hetta | harmonism | 1 KP/SR eskalerande | ⚠ **rustningar hjälper ej** |
| Eldvirvel | stavmagi | 1 KP/SR i 3 m radie | — |
| Dödshand | nekromanti | 1T6 per SR | — |
| Flammande hand | elementarmagi | +1T3/E på närstridsslag | vapenbuff |
| Andeslag | spiritism | −1 PSY permanent/E | ⚠ endast andar/gastar |
| Livsuttömning | nekromanti | −2 PSY/E, **överförs till magikern** | — |
| Själaförvittring | spiritism | −1T3+E PSY **permanent** | — |
| Mental projektil | spiritism | (Mental attack, längre räckvidd) | — |
| Tryckvåg | rostmagi | ingen skada — **knockback** 10×E STY | — |

⚠ Tre av dem (**Hetta, Eldvirvel, Dödshand**) är per-SR-skada och hör hemma i den **redan byggda** periodeffektmotorn, inte i ett nytt skadelager.

⚠ Fyra av dem drabbar **PSY**, inte KP (Andeslag, Livsuttömning, Själaförvittring, delvis Skrik). `instantEffect` måste alltså kunna rikta sig mot både `hp` och `resources.psy`, och Livsuttömning dessutom **överföra** det avdragna till kastaren.

### 1.2 Läkning och botande (≈ 10)

- **Direkt KP:** Hela (E KP, beröring) · Helande musik (1 KP/E per hel minut per koncentrerad lyssnare — ⚠ area + tidsbaserad, hör hemma i periodeffektmotorn)
- **Botar tillstånd:** Neutralisera gift · Kurera sjukdom · Bota fobi (×2, animism + mentalism) · Bota varulv · Häva förstening (×2) · Ta bort vårtor

⚠ Botandena förutsätter att tillstånden finns som data. Gift finns redan (`applyPoisonEffect` + periodeffekter); sjukdom, fobi och förstening gör det inte. **Botandet kan alltså inte byggas före det som ska botas** — de hör till en senare fas eller lämnas som SL-text.

### 1.3 Statuseffekter (≈ 17)

Behöver `statusEffect` — och de flesta mappar mot Foundrys **egna** kärnstatusar, som redan används av `PARRY_BLOCKING_STATUSES` i Anfallsdialogen:

| Källans effekt | Besvärjelser | Foundry-status |
|---|---|---|
| Blind | Blindhet | `blind` |
| Sömn | Förhäxad sömn, Förtrollad sömn | `sleep` |
| Förlamning | Paralysering, Förlamning, Halt, Orörlighet | `paralysis` |
| Handlingsförlamad | Smärta (×2), Skrik | `stun` |
| Fastklibbad | Spindelväv | `restrain` |
| Dövhet | Bedövad, Dövhet/Förstumma | ⚠ ingen kärnstatus — ny eller ren text |
| Stumhet/tystnad | Tystnad, Heshet | ⚠ ingen kärnstatus |
| Förvirring | Förvirra | ⚠ ingen kärnstatus |
| Klåda (SMI −3, −2 rutor) | Klåda | ren modifierare, ingen status |

⚠ **Fyra av statusarna finns inte i Foundrys kärna.** Systemet registrerar redan två egna (`armObrukbar`, `handUpptagen`), så mönstret finns — men varje ny status är en designfråga, inte en självklarhet.

### 1.4 Skräck — 8 besvärjelser, en enda inkopplingspunkt

**Rädsla · Panik · Terror · Massfruktan · Fruktan · Gästskrik · Blodregn · Skrik**

Alla slår på **Skräcktabellen**, som redan finns som en riktig, sourcad 9-rads `RollTable` i `packs/tabeller` — **med noll anropare**. Skillnaden mellan dem är bara vilket slag som föregår dragningen:

- Rädsla: normalt stridsmoralslag
- Panik: **svårt** stridsmoralslag
- Terror: alla inom räckvidden, kraftfullare
- Massfruktan: alla intelligenta, max en dragning per varaktighet
- Blodregn: PSY mot 15+E

**En helper (`DODE.rollFearTable()`) plus ett `resistedBy`-fält betjänar alltså alla åtta.** Detta är den enskilt högsta utväxlingen i hela planen.

### 1.5 Mental kontroll och tvång (≈ 17)

Alla bygger på ett **opponerat slag**, oftast PSY mot PSY eller KAR mot INT — exakt vad `DODE.rollResistance(sg, attribut)` redan implementerar (Motståndstabellen, SL s.34 / RP s.37–38) **utan en enda anropare i `scripts/`**.

Kontrollera person (PSY vs PSY, E humanoider) · Kommando (ettordskommando, PSY vs PSY) · Kamplust (attackerar magikerns mål till sista) · Salamiras betvingare (KAR-baserad fascination) · Inbilla tanke · Falsktal (tvingas säga en mening) · Aura (PSY-grupp vs E för att kunna angripa bäraren) · Distraktion · Massdans / Massglädje / Massfrid / Massfölje (⚠ alla fyra **bryts vid anfall eller våld** — kräver en hook, inte bara en varaktighet) · Kontrollera lägre odöd · Kontrollera högre odöd · Kontrollera andar (×2) · Voodookontroll

### 1.6 Skydd (≈ 7) — och de två som rör vid stridsmotorn

| Besvärjelse | Effekt | Integrationspunkt |
|---|---|---|
| **Sköld** | Abs 4 (+2/E) och ⚠ **parerar automatiskt ett anfall** | `resolveAttack` pareringsgren |
| **Sfär** | Projektiler −3 CL/E, ⚠ **1 närstridsvapen/E pareras automatiskt** | `resolveAttack` pareringsgren |
| Elementarmantel | +1 abs/E | `armourFor` |
| Fjällpansarhud | +4 abs, KAR −4 | `armourFor` |
| Järnhud | +8 abs, KAR −6 | `armourFor` |
| Blindskydd | immunitet mot bländning, ⚠ övervinns **med E** (deterministisk tröskel) | `resolveResistance` |
| Andebeskydd | PSY vs andens PSY, −(5+E) på Skräcktabellen | `rollFearTable` |

⚠ **Sköld och Sfär är de enda besvärjelserna som griper direkt in i `resolveAttack`s pareringslogik.** De kan inte uttryckas som en ren ActiveEffect på ett attribut — de konsumerar ett inkommande anfall. Det är den mekaniskt svåraste posten i hela materialet och bör byggas sist, inte först.

### 1.7 Modifierare (≈ 9)

Jättestark (STY → rasmax) · Smidighet (SMI → rasmax) · Själskraft (+3 CL/E på alla egenskapskast) · Stridsrop (+5 CL för allierade, ⚠ **och inga moralslag**) · Kamouflage (+E×5 CL Gömma sig) · Halskinn (halverar chans att hållas fast) · Färglöshet (−5 CL på synbaserat) · **Förtrolla vapen** (+1 CL/E **och** +1 skada/E) · **Förbanna vapen** (−1 CL/E och −1 skada/E)

⚠ Förtrolla/Förbanna vapen modifierar ett **vapen-Item**, inte aktören — de behöver ett annat måldjup än övriga buffar.

---

## 2. Datakvalitetsfynd

Tre saker upptäcktes vid genomläsningen och bör åtgärdas innan fälten fylls i, eftersom de annars förs vidare in i mekaniken:

1. ⚠ **Sannolika OCR-fel i `range`.** `"Y2 rutor"` (7 poster) och `"½ rutor"` (8 poster) förekommer sida vid sida med det normala `"Sx2 rutor"` och `"S/2 rutor"`. Nästan säkert felläsningar av **S×2** respektive **S/2**. Måste verifieras mot Formelboken innan räckvidd blir en beräknad storhet.
2. ⚠ **En äkta dubblett:** **Besudla** finns två gånger i **samma** skola (nekromanti), en med S2 och en utan `sValue`. De övriga fem dubblettnamnen är legitima — samma besvärjelse i två skolor, ibland med olika S (Kontrollera andar är S2 i spiritism men S14 i nekromanti).
3. ⚠ **Minibesvärjelserna har ett helt annat schema** — `school, psyCost, source, description`, alltså **ingen** `sValue`, `range`, `duration`, `kvick` eller `ritual`. De 31 minisarna kan därför inte gå genom samma mekaniska väg som de 191 stora utan ett eget beslut.

---

## 3. Implementationsplan

Ordnad efter **utväxling per byggd rad**, inte efter skolordning. Varje fas är körbar och liveverifierbar för sig.

### Fas 1 — Schemat (ingen motorlogik)

Nya fält på `item-besvarjelse.mjs`:

```js
battleRelevant: BooleanField          // filter för en framtida spell-browser
instantEffect: { kind: "none"|"damage"|"heal", formula, target: "hp"|"psy",
                 armour: "normal"|"none"|"half"|"metal-half", transferToCaster: Boolean }
statusEffect:  StringField            // Foundry-status-id
resistedBy:    "none"|"attribute-save"|"opposed"
saveAttribute: StringField            // psy/int/fys …
fearTable:     BooleanField           // drar Skräcktabellen vid misslyckat slag
damageType:    StringField            // kopplar mot resistances[]
```

⚠ `armour`-fältet finns med **från början** just därför att källan uttryckligen skiljer på fyra fall (Blixt: ingen; Energistråle: normal; Elchock: metall halverar; Hetta: hjälper ej). Att lägga till det i efterhand hade krävt att alla skadeposter kurerades om.

**Verifiering:** rent additivt, `node --check` + ett arkrender räcker.

### Fas 2 — Koppla in det som redan finns (högst utväxling)

Ingen ny mekanik — bara anropare till fyra befintliga, oanvända primitiver:

1. `DODE.rollFearTable()` → **8 skräckbesvärjelser**
2. `DODE.rollResistance()` som `resistedBy:"opposed"` → **≈ 30 besvärjelser**
3. `DODE.addPeriodicEffect()` för per-SR-skada → **Hetta, Eldvirvel, Dödshand, Helande musik**
4. `resistances[]` via `resolveResistance()` → skadetypskontroll

**Verifiering:** en riktig Rädsla mot en riktig token drar faktiskt på Skräcktabellen; ett Kommando mot en NPC gör ett äkta PSY-mot-PSY-slag.

### Fas 3 — `scripts/rolls/spell.mjs`: skada, läkning, status

Samma uppdelning som `attack.mjs` redan bevisat: `resolveSpellCast()` (ren beräkning, inga skrivningar) + `applySpellResult()` (alla skrivningar) + `postSpellCard()`. Ger de **22 skade-**, **2 läke-** och **17 statusbesvärjelserna**.

⚠ Detta är också platsen där **spelarens besvärjelse mot en NPC hen inte äger** måste gå via samma väntar-på-SL-godkännande-flöde som anfall redan gör — annars återuppstår exakt den tysta permission-bugg som redan hittats och rättats en gång för vapenanfall.

### Fas 4 — Modifierare och skydd

`abs`-buffar (Elementarmantel, Fjällpansarhud, Järnhud) via `armourFor`; CL-buffar (Själskraft, Stridsrop, Kamouflage) via det redan byggda `skillModifiers`-lagret; **Förtrolla/Förbanna vapen** mot vapen-Item.

### Fas 5 — Sköld och Sfär (auto-parering)

Sist, medvetet. De två enda besvärjelserna som konsumerar ett inkommande anfall och därmed måste in i `resolveAttack`s pareringsgren. Bygg dem när allt annat är stabilt.

### Fas 6 — Kuratering

`scripts/build/generate-spell-reference.mjs` genererar `docs/dev/BESVARJELSE_REFERENSTABELL.md` ur `_source`; därefter fylls fälten i skolvis. **≈ 85 poster behöver kureras, inte 222** — resten får `battleRelevant:false` och rörs aldrig av stridsmotorn.

---

## 4. Uttryckligen utanför planen

- **De 137 utforsknings-/social-/hantverksbesvärjelserna.** De fungerar redan som beskrivande text på arket och behöver ingen mekanik för att vara användbara vid bordet.
- **Botande av tillstånd som inte finns som data** (sjukdom, fobi, förstening) — kan inte byggas före det som ska botas.
- **De 31 minibesvärjelserna**, tills deras avvikande schema fått ett eget beslut.
- **Frammaningsbesvärjelser** (Frammana elementar, Animera död, Animera stenstaty) — de skapar aktörer, vilket är ett eget spår som dessutom överlappar Monsterboken 2:s Demon-post (medvetet ej byggd, av samma skäl: allt skalar med E).
