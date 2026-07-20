# ACTIVE_TASK.md — Drakar och Demoner Expert (Foundry-system)
<!-- Uppdateras vid varje session, alltid. Läs CLAUDE.md för arkitektur, memory.md för teknisk djupkontext. -->
Senast uppdaterad: 2026-07-19 (session 4)

---

## Snabbstatus — 8 faser

| Fas | Leverabel | Status |
|---|---|---|
| 0 | Repo-scaffold (`system.json`, `CLAUDE.md`, git init) | ✅ Klar |
| 1 | Datagrund: Actor/Item DataModels, `CONFIG.DODE`-konstanter, härledda värden | ✅ Klar, live-verifierad |
| 2 | Minimal rollpersonssheet + FV-slag med perfekt/fummel | ✅ Klar, live-verifierad |
| 3 | Item-typer (ras/yrke/vapen/rustning/besvärjelse) + kompendier | ✅ Klar, live-verifierad (delvis innehåll — se memory.md) |
| 4 | NPC/monster-actortyp + monsterkompendium (14 varelser) | ✅ Klar, live-verifierad |
| 5 | Guidad rollpersonsskapare (nu 10 steg, avgränsad — se memory.md) | 🟡 v2 pågår — Fas 1–3 klara + Fas 4 delvis (kapitalmultiplikator klar, attributmod blockerad) av 10, se `PLAN_WIZARD_V2.md`. Plus ett utökningssteg utanför fasplanen: kön (Man/Kvinna) som styr porträttbild för ras/yrke (session 4) |
| 6 | Stridsintegration (skada/ABS), magisystem (kastning/PSY) | ✅ Klar, live-verifierad (session 3, avgränsad — se memory.md) |
| 7 | Kampanjmodul "De brutna sigillens krönika" (eget repo: `Data/modules/de-brutna-sigillens-kronika`) | 🟡 Pågår — fas 7.1 (äventyret Dimön) klar, se modulens egen `ACTIVE_TASK.md`/`memory.md` |

---

## Kända begränsningar / medvetet avgränsat bort

Se `memory.md` för full motivering per punkt — det här är bara listan.

- **Ingen engelsk lokalisering** — bara `lang/sv.json`. Världens klientspråk måste stå på svenska.
- **Ras/yrke-kompendier är representativa urval, inte kompletta:** 18/~60 vapen, 8/~150+ besvärjelser, inga alv-subraser, inga krigar-/tjuv-/lönnmördar-/bardspecialiseringar från Krigarens Handbok/Tjuvar och Lönnmördare.
- **Färdigheter har flat FV**, inte EP-köpsystemet (RP s.28) — planerat i `PLAN_WIZARD_V2.md` Fas 6/7.
- **Yrke har inget yrkesfärdighetsval** (12/9 färdigheter), ingen automatisk EP-koppling — planerat i `PLAN_WIZARD_V2.md` Fas 6 (kräver även kompendiearbete i `packs/yrken/_source/`).
- **Hjälte-nivåer** — nivåval (Vanlig/Extraordinär/Hjälte) finns nu i guiden och styr BP-poolen (`PLAN_WIZARD_V2.md` Fas 1+2, klara), men Hjältarnas Handboks fulla överlagring (hjältedåd, hjältepoäng, rykte, Öde-typer) är opåbörjad — se Fas 10.
- **Socialt stånd/startkapital** (löst, session 4) — implementerat med 2T6+BP-systemet (RP s.27–28), guidens `socialt`/`kapital`-steg. Startkapitalets **slutgiltiga** belopp (`finalSm`, efter åldersmultiplikator RP s.28) beräknas nu korrekt i `alder`-steget.
- **Åldersmodifikationer på attribut** — ålderskategori sparas som text, påverkar inte attributvärden ännu (`raceMod`/`ageMod`-infrastrukturen finns, `ageMod` är alltid 0). Blockerad av en forskningslucka (exakt tabell från RP s.24-25 inte extraherad) — se `PLAN_WIZARD_V2.md` Fas 4.
- **BP-ekonomi** (session 4) — BP-ledger finns (`system.bp`, nivåstyrd pool). Ras, socialt stånd och startkapital drar/kopplar BP. Särskilda förmågor och färdigheter har egna spend-kategorier förberedda i schemat men inget spenderar dem än.
- **Kön** (nytt, session 4) — `system.kon` (man/kvinna), valt som guidens första steg (Font Awesome mars/venus-ikoner, inte porträttbilder). Ingen regelmekanik kopplad — styr bara vilken `imgMan`/`imgKvinna`-variant av ras-/yrkesporträtt som visas i guiden och ärvs av de embeddade items vid rollpersonsskapande.
- ~~Kompendier byggda utan Foundry CLI~~ — **löst (session 3):** Node.js installerat, `@foundryvtt/foundryvtt-cli` migrerat in. Kompendiekällan är nu `packs/<namn>/_source/*.json` (git-diffbar), kompilerad via `npm run packs:pack`. Se memory.md för fullständig migrationslogg och gotchas (dataPath-formatet, stale PATH, m.m.).
- **Active Effects** — ras/yrkesbonusar räknas manuellt i `prepareDerivedData()`, inte via Foundrys ActiveEffect-system. Fungerar, men är inte den "inbyggda" vägen — omprövas om fler bonuskällor (utrustning, besvärjelser) börjar behöva stapla effekter.
- **Fas 6-avgränsningar (session 3):** ingen automatisk anfallsslag→skaderullning-kedja (två separata klick — anfall och skada rullas var för sig, ingen "vid träff"-logik); rustning staplar inte (tar högsta Abs bland kroppsrustningar, inte summa — korrekt enligt REGLER_STRID.md); besvärjelsers "S" i CL-formeln är spelets tabellerade skolvärde, inte kastarens personliga skicklighetsvärde (de är egentligen olika saker, se memory.md); Snedtändningstabellen (fummel vid magi) är inte automatiserad, bara flaggad i chatten; lönnmördarens bakhugg (ingen SB) är inte specialhanterat; inget stöd för avstånds-/rörelsemodifikationer på anfallsslag.

---

## Externa resurser tillgängliga i sessionen

- **Gemini-bildgenerering via lokal MCP-server** (`gemini_imagen_mcp.py`, körs av Johan): verktyget `mcp__gemini-imagen__generate_image` (prompt → 1-4 bilder, sparas till `~/gemini-images` som default). Användbart för token-/ikonkonst till kompendieitems. Inte kopplat till något automatiskt flöde ännu — måste anropas manuellt och bilden sedan importeras till Foundry för hand.
- **Node.js v24 installerat** (session 3, `winget install OpenJS.NodeJS.LTS`) — möjliggör `npm`/`npx` och därmed den officiella Foundry-CLI:n. **OBS:** nya skal-processer som öppnats innan installationen ser inte det uppdaterade PATH; referera full sökväg (`C:\Program Files\nodejs\node.exe` osv.) eller sätt `$env:PATH` manuellt i det anropet om `node`/`npm`/`npx` inte hittas.

## Kompendiebyggnad — npm-kommandon

```
npm install                  # en gång per maskin (installerar @foundryvtt/foundryvtt-cli)
npx fvtt configure set dataPath "<Foundry-installationens ROTMAPP>"   # en gång per maskin, se memory.md
npx fvtt package workon drakar-och-demoner-expert --type System       # en gång per maskin
npm run packs:unpack         # LevelDB → packs/<namn>/_source/*.json (redigerbar källa)
npm run packs:pack           # packs/<namn>/_source/*.json → LevelDB (det Foundry läser)
```

**KRITISKT:** kör aldrig `packs:unpack`/`packs:pack` medan Foundry-servern är igång — se memory.md:s LevelDB-cache-gotcha (fas 4) och verktygsmigrationsloggen (session 3). Stäng ner Foundry-processen helt först.

**⚠ `workon`-kontexten är global för hela maskinen, inte per repo** (session 4-upptäckt): om du någon gång kör `npx fvtt package workon <annat-paket>` i t.ex. kampanjmodulens repo, pekar `npm run packs:pack` här om du inte kör `npx fvtt package workon drakar-och-demoner-expert --type System` igen först — annars packar den in i FEL katalog (`Data/modules/<annat-paket>/packs/...`) och kraschar med `ENOENT`. Kolla/återställ workon-kontexten om `packs:pack` klagar på en sökväg som inte är den här systemmappen.

---

## Hur man fortsätter — ny session

1. **Läs denna fil först** — vad pågår, vad är klart, vad är känt begränsat
2. Läs `CLAUDE.md` för arkitektur och regelfilosofi
3. Läs `memory.md` vid tekniska frågor — fas-för-fas-motivering, gotchas, källcitat
4. Vid regelfrågor: slå upp i Roll20-projektets `docs/wiki/REGLER_*.md` / `docs/REGEL_*.md` — gissa inte
5. Verifiera ändringar i en riktig Foundry-instans innan en fas markeras klar
6. **Uppdatera denna fil OCH `memory.md` innan sessionen avslutas** — se CLAUDE.md:s "Minnesystem och sessionskontinuitet"

## Nästa steg

1. **Rollpersonsskaparen v2** — `PLAN_WIZARD_V2.md` Fas 5 (EP-pool). Fas 1–3 klara, Fas 4 delvis (kapitalmultiplikator klar, attributmodifikationer väntar på att RP s.24-25 extraherats). Se planfilen för hela den återstående vägen (Fas 5–10) inklusive beroendegraf och forskningsluckor.
2. **Kompendieikonkonst** (session 4) — ✅ **Klar, inklusive ompaketering.** 54 porträttbilder genererade via Gemini-MCP totalt: 18 könsneutrala bas-bilder (7 raser, 11 yrken) + 36 explicita man/kvinna-varianter (18×2), sparade i `assets/tokens/raser/` och `assets/tokens/yrken/`. Alla `packs/{raser,yrken}/_source/*.json` har `img` (bas), `system.imgMan`, `system.imgKvinna` ifyllda, och `npm run packs:pack` har körts (Foundry-servern nedstängd av Johan först) — verifierat direkt mot de kompilerade LevelDB-packarna via `classic-level` (inte `grep`, som gav falska negativ p.g.a. Snappy-komprimering — se memory.md) att alla 7 raser + 11 yrken har korrekta `img`/`imgMan`/`imgKvinna`. Gendrad bildväxling live-verifierad i guiden innan ompaketeringen (temporär, återställd testuppdatering på ett kompendieitem — se memory.md).
3. Fas 7: Kampanjmodulen "De brutna sigillens krönika" — fas 7.1 (Dimön) klar, fas 7.2+ (fler äventyr) pågår i modulens eget repo (`Data/modules/de-brutna-sigillens-kronika`, se dess `ACTIVE_TASK.md`)
4. Eller bredda tidigare faser: fler vapen/besvärjelser/monster, alv-subraser, krigar-/tjuv-specialiseringar — nu enklare att lägga till/redigera tack vare JSON-källan
5. Overväg Active Effects-refaktorering om utrustning/besvärjelser börjar behöva stapla bonusar
6. Engelsk lokalisering (lågprioriterat, inte efterfrågat)
7. **Distributionspipeline för slutanvändare** (beslutat inriktning, session 3: GitHub-repot ska primärt tjäna en Foundry-*användare* som vill installera/spela DoDE, inte bara utvecklare) — GitHub Actions-workflow som vid varje versionstagg zippar bara runtime-filer (system.json, scripts/, templates/, lang/, styles/, kompilerade packs/ — INTE package.json/node_modules/packs/*/_source/.claude/dev-tooling) och bifogar som Release-asset; ersätt `system.json`s platshållar-`manifest`/`download`-URL:er (nu `TODO`) med riktiga `releases/latest/download/...`-länkar; överväg att sedan registrera manifestet i Foundrys paketlista (foundryvtt.com/packages) för sökbarhet i Foundrys eget installationsgränssnitt. Inte påbörjat — vänta med detta tills närmare en faktisk första release.
