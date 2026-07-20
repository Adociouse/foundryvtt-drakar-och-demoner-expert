# Drakar och Demoner Expert — Foundry-systemets projektguide för agenter

> Läs detta först. Läs sedan `ACTIVE_TASK.md` för nuläge och nästa steg.

Uppdaterad: 2026-07-18

---

## Vad är det här?

Ett Foundry VTT-**system** (inte modul) för det svenska rollspelet **Drakar och Demoner Expert (1991)**. System-id: `drakar-och-demoner-expert`. Byggs i Foundrys egen `Data/systems/`-mapp, alltså direkt testbart i en lokal Foundry-installation.

Detta är en **greenfield-implementation** — ingen legacy-kod i det här repot. All spellogik och alla regeltolkningar hämtas från två systerprojekt:

| Projekt | Sökväg | Innehåll |
|---------|--------|----------|
| **Roll20-projektet** | `D:\OneDrive\Dokument\ClaudeCode\Drakar och Demoner Expert Roll20` | Källsanning: alla originalböcker (PDF + OCR-extrakt), kurerade regeldokument (`docs/wiki/REGLER_*.md`, `docs/REGEL_*.md`, `docs/SPELDATA.md`) med bok+sidhänvisningar, samt en tidig ej färdigbyggd Foundry-scaffold (`dode-foundry-scaffolding/`) |
| **Chargen-projektet** | `D:\OneDrive\Dokument\ClaudeCode\dode-chargen` | Fungerande Roll20-liknande fristående HTML-karaktärsgenerator (14-stegs guide). Fas 5 portade en avgränsad delmängd (6 steg — se `memory.md`) som en egen Foundry `ApplicationV2`, inte en rak port av Roll20:s ATTRS/shim-API. |

## Regelfilosofi — VIKTIGT

Regeldokumenten i Roll20-projektet är **inte en bugg att fixa**. De representerar en medveten, kurerad blandning av flera källböcker (Bok I–III, Krigarens Handbok, Hjältarnas Handbok, Alver, Svartfolk, Tjuvar och Lönnmördare, Magikerns Handbok) — se `docs/REGLER_README.md`s avsnitt "Medvetet modulärt blandsystem". Bygg mot dessa dokument som facit.

**Där dokumenten själva flaggar en avvikelse eller förenkling (`⚠` i texten)** — bär med den flaggan in i koden som en kommentar på beräkningsstället. Systemet blir publikt på GitHub; andra ska kunna se och ändra tolkningar de inte håller med om, inte gissa sig till dem.

## Arkitektur

- **Foundry-version:** minimum 12, verifierad mot 14. Modern DataModel/ApplicationV2-arkitektur — **inget `template.json`**. Actor/Item-subtyper deklareras i `system.json`s `documentTypes`, datamodeller binds i `scripts/dode.mjs` via `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels`.
- **Inget bundlingsteg för systemkoden.** Rena `.mjs`-ES-moduler, laddas direkt av Foundry via `esmodules` i `system.json`. Foundry-systemet självt kräver ingen `npm run build`.
- **`package.json` finns**, men bara för kompendiebyggverktyg (`@foundryvtt/foundryvtt-cli`) — se `ACTIVE_TASK.md`s "Kompendiebyggnad"-avsnitt och `memory.md`s CLI-migrationslogg för hela historien och kända fallgropar.
- **Struktur:**
  ```
  ACTIVE_TASK.md            ← Snabb statuskoll — LÄS FÖRST varje session
  memory.md                 ← Teknisk djupkontext — fas-för-fas-motivering, gotchas
  CLAUDE.md                 ← Denna fil
  package.json               ← Bara kompendiebyggverktyg (foundryvtt-cli), inte systemet självt
  scripts/
    dode.mjs                ← Entry point (init-hook, registrerar allt)
    data/                   ← DataModel-scheman (actor-character.mjs, item-fardighet.mjs, ...)
    documents/               ← Document-subklasser (actor.mjs — actor.rollSkill() m.m.)
    sheets/                  ← ApplicationV2-baserade Document-sheets
    apps/                    ← Fristående ApplicationV2 utan eget dokument (character-wizard.mjs)
    rolls/                   ← fv-roll.mjs, damage-roll.mjs — tärningsmekanik
    helpers/config.mjs       ← CONFIG.DODE-konstanter, källciterade
    build/                   ← Node-skript som kör foundryvtt-cli (packs:unpack/packs:pack)
  templates/*.hbs            ← Handlebars-mallar för sheets, appar, chattkort
  lang/sv.json                ← All UI-text (svenska är primärspråk)
  styles/dode.css
  packs/<namn>/               ← Kompilerad kompendiedata (LevelDB) — det Foundry faktiskt läser, committas
  packs/<namn>/_source/       ← Kompendiekälla (JSON, git-diffbar) — redigera HÄR, kör sedan `npm run packs:pack`
  ```

## Arbetsflöde vid varje sessionstart

> **KRITISKT:** Läs alltid `ACTIVE_TASK.md` först — oavsett om sessionen är ny, återupptagen efter avbrott, eller handoff från en annan agent. Det förhindrar dubbelarbete och gissningar om vad som redan är byggt.

1. **Läs `ACTIVE_TASK.md`** — vilken fas pågår, vad är klart, vilka kända begränsningar finns? *(alltid, utan undantag)*
2. Läs detta `CLAUDE.md` om du behöver orientera dig i arkitekturen
3. Läs `memory.md` vid tekniska frågor — fas-för-fas-motivering, gotchas, källcitat, arkitekturbeslut
4. Vid regelfrågor: slå upp i Roll20-projektets `docs/wiki/REGLER_*.md` / `docs/REGEL_*.md` — gissa inte, och bär vidare eventuella `⚠`-flaggor som kodkommentarer
5. Verifiera ändringar i en riktig Foundry-instans (lokal Node-server) innan en fas markeras klar

## Projektets tre statusfiler — håll ALLA tre uppdaterade

Detta projekt speglar medvetet mönstret från Roll20-syskonprojektet (`ACTIVE_TASK.md`/`CLAUDE.md`/`memory.md`), eftersom det redan är validerat att fungera bra över flera sessioner där.

| Fil | Syfte | Uppdatera när |
|-----|-------|----------------|
| `ACTIVE_TASK.md` | Snabb statuskoll — fastabell, kända begränsningar, "nästa steg" | **Varje session**, utan undantag: när en fas påbörjas, avslutas, eller sessionen bryts mitt i arbete |
| `CLAUDE.md` (denna fil) | Arkitektur, regelfilosofi, mappstruktur | När arkitekturen faktiskt ändras (ny mappstruktur, nytt designmönster, ny extern källa) — inte varje session |
| `memory.md` | Djup teknisk motivering per fas: varför en lösning valdes, buggar som hittades och rättades, gotchas | **Varje session** som bygger eller ändrar något icke-trivialt — särskilt beslut som inte är självklara av koden själv |

**Innan en session avslutas:** uppdatera `ACTIVE_TASK.md`s statustabell och `memory.md`s fas-sektion för det som byggdes. Detta är inte valfritt — det är precis det som gjorde Roll20-projektet möjligt att fortsätta sömlöst över många sessioner, och samma disciplin gäller här.

## Minnesystem (Claude Code)

Utöver de tre statusfilerna ovan: viktiga beslut sparas även i Claude Code-minnet (`memory/`-katalogen, utanför detta repo) och läses in automatiskt i nya sessioner. Repofilerna är sanningskällan för PROJEKTET; Claude-minnet är för hur *arbetet* ska bedrivas (regelfilosofi, feedback, referenser till syskonprojekten).
