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

## Filkonvention

- 1024×1024 PNG, RGB.
- `assets/tokens/raser/<slug>.png`, `<slug>-man.png`, `<slug>-kvinna.png`
- `assets/tokens/yrken/<slug>.png`, `<slug>-man.png`, `<slug>-kvinna.png`
- Slug = gemener, `å/ä→a`, `ö→o`, inga mellanslag (samma mönster som `DODE.skillKey`).
- Kopplas in via `system.img` (fallback), `system.imgMan`, `system.imgKvinna` på ras-/yrkesitemet. Guiden väljer variant utifrån könssteget (`#genderedImg` i `character-wizard.mjs`).

## Verktyg

Lokal MCP-server (`mcp__gemini-imagen__generate_image`), som Johan kör. Parametrar: `prompt`, `count`, `output_dir`. Parallella anrop fungerar — 4 åt gången är en rimlig takt.
