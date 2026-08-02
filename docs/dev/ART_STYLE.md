# Bildstil för porträtt (raser, yrken, ikoner)

> Kanonisk promptmall, given av Johan 2026-07-27. **Använd den ordagrant som grund** när nya ras-/yrkesporträtt genereras, annars glider stilen isär mellan gamla och nya kort i rollpersonsskaparens rutnät.

## Referensprompt (alv)

```
Fantasy RPG character portrait icon of a graceful elf adventurer with pointed
ears and fine sharp features, wearing forest-toned leather and cloth, painterly
digital fantasy art in the style of a moody atmospheric oil painting, muted
earthy color palette with warm amber highlights, dramatic side lighting, dark
blurred background, centered square composition, waist-up portrait, highly
detailed
```

## Mall

Byt bara ut **motivdelen** (de två första leden). Stilsvansen ska stå kvar oförändrad:

```
Fantasy RPG character portrait icon of <MOTIV — kön, släkte/yrke, kroppstyp,
ansiktsdrag>, wearing <KLÄDSEL/UTRUSTNING som säger något om yrket eller
släktet>, painterly digital fantasy art in the style of a moody atmospheric oil
painting, muted earthy color palette with warm amber highlights, dramatic side
lighting, dark blurred background, centered square composition, waist-up
portrait, highly detailed
```

## Regler som är lätta att missa

- **`dark blurred background`** — bakgrunden ska vara mörk och suddig, INTE en detaljerad miljöbild. Ett första försök 2026-07-27 genererade ljusa, detaljrika miljöer (solbelyst skog, öppet hav) som stack ut kraftigt mot de befintliga porträtten och fick göras om. Antyd gärna miljön i färgtonen, men rendera den aldrig skarpt.
- **`muted earthy color palette with warm amber highlights`** — varm dämpad jordton är husstilen. Kalla/blå paletter bara när motivet kräver det (mörkeralv, frostmiljö), och även då dämpat.
- **`waist-up portrait` + `centered square composition`** — midjebild, centrerad, 1:1.
- **`portrait icon`** — orden spelar roll; de ger den inramade ikonkänslan snarare än en scen.
- **Ingen dekorativ bildram/kant** — Johan hittade 2026-08-02 att flera porträtt (bl.a. `morkeralv-man.png`) fått en vit, rundad "polaroid"-ram runt hela bilden trots att `dark blurred background` följdes ordagrant — bakgrunden i sig var mörk, men modellen la ändå på en ljus inramning runt kanten. Pixelsampling i fyra hörn missar detta (rundade hörn faller utanför själva ramen och samplar svart/transparent), så sampla ALLTID flera punkter längs alla fyra kanterna (inte bara hörnen) när porträtt verifieras. Lägg till `no border, no frame, edge-to-edge image, full bleed` i slutet av prompten för att motverka det.

## Andra motivtyper

Porträttmallen ovan gäller **personer** (raser, yrken). Föremål, varelser och besvärjelser behöver egna mallar — att tvinga in ett svärd i "waist-up portrait"-mallen ger fel resultat. Stilsvansen (oljemålning, dämpad jordton, varma bärnstensdagrar, dramatiskt sidoljus) är gemensam för allt, så helheten hänger ihop.

### Föremålsikon (vapen, rustning, utrustning)

```
Fantasy RPG inventory item icon of <FÖREMÅL, material och form>, a single object
centered on a dark neutral background, painterly digital fantasy art in the style
of a moody atmospheric oil painting, muted earthy color palette with warm amber
highlights, dramatic side lighting, centered square composition, highly detailed
```

⚠ `a single object` och `centered on a dark neutral background` är det som skiljer den från porträttmallen — utan dem genererar modellen gärna en person som *bär* föremålet.

### Varelseikon (monster)

```
Fantasy RPG bestiary illustration of <VARELSE, kroppstyp och utmärkande drag>,
the full creature centered in frame, painterly digital fantasy art in the style of
a moody atmospheric oil painting, muted earthy color palette with warm amber
highlights, dramatic side lighting, dark blurred background, centered square
composition, highly detailed
```

⚠ `the full creature centered in frame` — annars blir det ett närbildsporträtt av ett djurhuvud, vilket fungerar dåligt som token på kartan.

### Besvärjelse- och magiskoleikon

```
Fantasy RPG spell icon depicting <EFFEKT eller SYMBOL>, a glowing arcane symbol
on a dark background, no text and no lettering, painterly digital fantasy art in
the style of a moody atmospheric oil painting, muted earthy color palette with
warm amber highlights, dramatic lighting, centered square composition, highly
detailed
```

⚠ `no text and no lettering` — bildmodeller lägger annars gärna in pseudo-runor som ser ut som obegriplig text.

### Skolbakgrund (bakgrundsplatta per magiskola)

Färdiga plattor finns i `assets/backgrounds/magiskolor/<skolnyckel>.png` (13 st, 1024×1024). **Tanken:** när distinkta besvärjelseikoner en dag genereras (backlogpost 24) ska varje skolas besvärjelser dela samma miljö, så att en Nekromanti-formel känns igen som nekromanti redan innan man läst namnet. Motivet i mitten byts, bakgrunden står kvar.

```
Empty background plate for a fantasy RPG spell icon: <MILJÖ som säger vad skolan
handlar om>, seen slightly out of focus, the centre of the image left uncluttered
and open, painterly digital fantasy art in the style of a moody atmospheric oil
painting, muted earthy color palette with warm amber highlights, dramatic side
lighting, dark shadowed edges, no text and no lettering, no characters, square
composition
```

⚠ `the centre of the image left uncluttered and open` + `seen slightly out of focus` är det som gör plattan användbar — utan dem blir det en färdig scen som konkurrerar med sigillen i mitten i stället för att bära den. `no characters` behövs också; modellen sätter annars gärna dit en magiker.

Miljöerna som användes (2026-07-27): alkemi = alkemistbänk med retorter · animism = urskogsglänta · demonologi = kryptagolv med besvärjelsecirkel · elementarmagi = klippkant där hav, storm, glöd och sten möts · harmonism = tempelsal med spegelblank damm · häxkonster = häxstuga med kittel och örtknippen · illusionism = spegelsal i dis · mentalism = nattlig studerkammare med orrery · nekromanti = dimhöljd kyrkogård · röstmagi = valvsal byggd för eko, med luta och horn · spiritism = seansrum med rökelse · stavmagi = träsnidarverkstad med stavar · symbolism = runristad stenvägg.

## Filkonvention

- 1024×1024 PNG, RGB.
- Slug = gemener, `å/ä→a`, `ö→o`, bindestreck i stället för mellanslag (samma mönster som `DODE.skillKey`).

| Mapp | Innehåll | Kopplas in via |
|------|----------|----------------|
| `assets/tokens/raser/` | `<slug>.png`, `<slug>-man.png`, `<slug>-kvinna.png` | `img` + `system.imgMan` / `system.imgKvinna` |
| `assets/tokens/yrken/` | `<slug>.png`, `<slug>-man.png`, `<slug>-kvinna.png` | `img` + `system.imgMan` / `system.imgKvinna` |
| `assets/tokens/utrustning/` | `<slug>.png` | `img` i `packs/vapen-utrustning/_source/` |
| `assets/tokens/magiska-foremal/` | `<slug>.png` | `img` i `packs/magiska-foremal/_source/` |
| `assets/tokens/besvarjelser/` | `<slug>.png` | `img` i `packs/besvarjelser/_source/` |
| `assets/tokens/monster/` | `<slug>.png` | `img` **och** `prototypeToken.texture.src` |
| `assets/tokens/magiskolor/` | `<skolnyckel>.png` | `img` på posten i `DODE.magicSchoolSkills` (ingen kompendiepost) |

- Sökvägen skrivs alltid med systemprefix: `systems/drakar-och-demoner-expert/assets/tokens/<mapp>/<slug>.png`.
- Guiden väljer man-/kvinnavariant utifrån könssteget (`#genderedImg` i `character-wizard.mjs`).

⚠ **Kontrollera vad namnet betyder innan du skriver motivet.** Nyckeln är inte alltid samma ord som etiketten — `rostmagi` är **Röstmagi** (röst/ljud), inte metallrost. Slå upp i `lang/sv.json`.

## Verktyg

Lokal MCP-server (`mcp__gemini-imagen__generate_image`), som Johan kör. Parametrar: `prompt`, `count`, `output_dir`. Parallella anrop fungerar — 4 åt gången är en rimlig takt.
