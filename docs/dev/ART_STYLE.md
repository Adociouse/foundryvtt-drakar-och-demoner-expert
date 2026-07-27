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
