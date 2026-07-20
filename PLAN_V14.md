# PLAN_V14.md — Foundry v13/v14 best-practice-audit av fas 1–6

> Genererad 2026-07-19. Granskar `system.json`, alla `.mjs`-filer i `scripts/`, samt `templates/*.hbs` mot Foundry v13/v14:s officiella API-dokumentation, release notes och community-migreringsguider (se källor i respektive avsnitt).

---

## Sammanfattning

**Nuvarande deklarerad kompatibilitet** (`system.json`): `"minimum": "12", "verified": "14"`.

Det goda nyheten först: **arkitekturen i fas 1–6 är redan i allt väsentligt v13/v14-idiomatisk.** DataModel-mönstret (`foundry.abstract.TypeDataModel` + `foundry.data.fields`), ApplicationV2-mönstret (`HandlebarsApplicationMixin`, `ActorSheetV2`/`ItemSheetV2`, `static PARTS`/`DEFAULT_OPTIONS`, `_prepareContext`, actions-objekt) och sheet-registreringen (`Actors.registerSheet`/`Items.registerSheet`) är exakt de mönster Foundrys egen boilerplate och community-wiki rekommenderar för v13/v14 idag. Det finns **inga kritiska kompatibilitetsbrott**.

Det som hittades är litet i omfång:

1. **Tre platser** använder globala funktioner/klasser (`renderTemplate`, `TextEditor`) som sedan v13 är deprecated-med-varning till förmån för sina namnrymdsplacerade motsvarigheter under `foundry.applications.*`. Fungerar fortfarande, men skriver ut deprecation-varningar i konsolen och riskerar att tas bort i en framtida major-version.
2. **En arkitektoniskt riskabel punkt**: injektionen av "Ny rollperson (guide)"-knappen i Actor Directory-sidopanelen bygger på manuell DOM-`querySelector` mot CSS-klasser (`.directory-header .action-buttons`) i en kärn-template. Sidopanelen skrevs om till ApplicationV2 i v13 (Prototype 2, build 13.333) — DOM-strukturen kan ha ändrats sedan mönstret skrevs, och bör liveverifieras.
3. **Inget** i DataModel- eller ApplicationV2-lagren behöver ändras.

Ingen av punkterna ovan är brådskande (systemet är redan live-verifierat mot v14 enligt `ACTIVE_TASK.md`), men de bör städas innan en publik release för att undvika konsolvarningar och för att inte stå på en API-yta som kan försvinna i v15+.

---

## Per-fas-audit

### Fas 0 — `system.json`
✅ **v14-korrekt.** `documentTypes`, `esmodules`, `packs`-manifestet (utan `template.json`) och `compatibility`-blocket följer det aktuella manifestschemat. Inget att ändra för v14 specifikt. (De kända platshållar-URL:erna under `authors[0].url`/`manifest`/`download`/`url` är redan flaggade i `ACTIVE_TASK.md` som ett distributionsspörsmål, inte ett v14-spörsmål.)

### Fas 1 — DataModels (`scripts/data/*.mjs`)
✅ **v14-korrekt, inget att ändra.** Alla sex Item-datamodeller och båda Actor-datamodellerna använder `foundry.abstract.TypeDataModel` + `foundry.data.fields.*` (`SchemaField`, `NumberField`, `StringField`, `BooleanField`, `HTMLField`, `ArrayField`) — detta är den stabila, oförändrade DataModel-arkitekturen sedan v10 och den rekommenderade vägen genom v14. `prepareDerivedData()` används korrekt för härledda värden (KP, skadebonus, förflyttning, ABS, PSY-resurs) och läser `this.parent?.items` för ras/yrke-kopplingen — inga föråldrade mönster (t.ex. `template.json`, gammal `Actor#data.data`-sökväg) förekommer någonstans.

### Fas 2 — Minimal rollpersonssheet + FV-slag
🟡 **Fungerar, men två deprecated globala referenser:**
- [scripts/rolls/fv-roll.mjs:31](scripts/rolls/fv-roll.mjs:31) — `renderTemplate(...)` global funktion.
- Se även fas 6 (`damage-roll.mjs`) för samma mönster.

`fv-roll.mjs`s slagmekanik i övrigt (`new Roll("1d20").evaluate()`, `ChatMessage.create` med `rolls:`-array, `CONFIG.sounds.dice`) är korrekt v13/v14-mönster — `Roll#evaluate` är async-only sedan länge och `{async: true}`-flaggan är redan korrekt utelämnad.

### Fas 3 — Item-typer + kompendier
🟡 **DataModeller och sheets är v14-korrekta** (se fas 1 och den generella ApplicationV2-sektionen nedan). En sak att liveverifiera:
- Samtliga sex item-sheet-mallar (`templates/item/*.hbs`) använder Handlebars-hjälparen `{{editor system.description target="system.description" button=true engine="prosemirror"}}` (t.ex. [templates/item/item-fardighet-sheet.hbs:25](templates/item/item-fardighet-sheet.hbs:25)). Syntaxen är oförändrad i v13/v14, men v14:s release-anteckningar nämner UX-förändringar i ProseMirror-editorn (kollapsbara sektioner, teckenstorlek/färg, bildtexter). Eftersom fas 3 redan är "live-verifierad" enligt `ACTIVE_TASK.md` är detta sannolikt redan okej — men ta en snabb runda i en riktig v14-klient och bekräfta att beskrivningsfält fortfarande öppnar editorn och sparar korrekt på alla sex itemtyper, som en del av denna revision.

### Fas 4 — NPC/monster-actortyp
✅ **v14-korrekt, inget att ändra.** `actor-npc-sheet.mjs` följer samma ApplicationV2-mönster som karaktärssheeten, inga globala deprecated-anrop.

### Fas 5 — Guidad rollpersonsskapare (`character-wizard.mjs`)
✅ **Arkitekturen är redan v13/v14-idiomatisk** — se dedikerad sektion nedan för detaljerad genomgång. Inga ändringar krävs.

### Fas 6 — Stridsintegration + magisystem
🟡 **Fungerar, deprecated globala referenser i två filer:**
- [scripts/rolls/damage-roll.mjs:12](scripts/rolls/damage-roll.mjs:12) — `renderTemplate(...)` global funktion.
- [scripts/sheets/actor-character-sheet.mjs:115](scripts/sheets/actor-character-sheet.mjs:115) — `TextEditor.getDragEventData(event)` global klass (denna metod används av dra-och-släpp-hanteringen som fas 3/6 bygger vidare på för vapen/rustning/besvärjelse-drag).

`documents/actor.mjs`s `castSpell()`/`rollWeaponDamage()`/`rollAttack()` innehåller ingen Foundry-API-yta som ändrats i v13/v14 — bara egen affärslogik ovanpå `rollFV`/`rollDamage`.

---

## Detaljerade fynd (fil:rad, orsak, åtgärd)

### 1. Global `renderTemplate` → `foundry.applications.handlebars.renderTemplate`
**Var:** [scripts/rolls/fv-roll.mjs:31](scripts/rolls/fv-roll.mjs:31), [scripts/rolls/damage-roll.mjs:12](scripts/rolls/damage-roll.mjs:12)

Sedan v13 är åtkomst av flera tidigare globala hjälpfunktioner/klasser via `globalThis` (bl.a. `renderTemplate`, `TextEditor`) omklassade till namnrymden `foundry.applications.*`, med en bakåtkompatibel `globalThis`-alias som nu loggar en deprecation-varning (bekräftat via Foundrys egna GitHub-issues om "globalThis backwards compatibility references" i v13, t.ex. #12255, #12333). De globala namnen tas **inte** bort i v13/v14, men bör bytas ut för att (a) slippa konsolbrus och (b) inte bygga på en yta som kan försvinna i en framtida major-version.

**Åtgärd:**
```js
// Före
const content = await renderTemplate("systems/.../roll-card.hbs", { ... });

// Efter
const content = await foundry.applications.handlebars.renderTemplate(
  "systems/drakar-och-demoner-expert/templates/chat/roll-card.hbs",
  { ... }
);
```
Kan även importeras destrukturerat överst i filen för kortare anrop:
```js
const { renderTemplate } = foundry.applications.handlebars;
```

### 2. Global `TextEditor` → `foundry.applications.ux.TextEditor`
**Var:** [scripts/sheets/actor-character-sheet.mjs:115](scripts/sheets/actor-character-sheet.mjs:115)

Samma bakgrund som punkt 1. `TextEditor`-klassen (drag-släpp-hjälpare, enrichment m.m.) flyttades till `foundry.applications.ux.TextEditor` i v13; det globala namnet är en deprecated alias. Foundry har även introducerat `CONFIG.ux.TextEditor` för att låta system/moduler byta ut implementationen — den korrekta anropsvägen som respekterar det är `TextEditor.implementation`.

**Åtgärd:**
```js
// Före
const data = TextEditor.getDragEventData(event);

// Efter
const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
```

### 3. Sidebar-knappinjektion bygger på DOM-selektorer som kan ha ändrats i v13
**Var:** [scripts/dode.mjs:74-86](scripts/dode.mjs:74)

```js
Hooks.on("renderActorDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  const header = root?.querySelector(".directory-header .action-buttons") ?? root?.querySelector(".directory-header");
  ...
});
```

Sidopanelen (inklusive `ActorDirectory`) konverterades till ApplicationV2 i v13 Prototype 2 (build 13.333, bekräftat via Foundrys GitHub-issue #11391 "Convert Sidebar to ApplicationV2"). Koden hanterar redan defensivt både jQuery- och HTMLElement-formen av `html` (bra — det är precis rätt försvarslinje för denna övergång), men själva CSS-selektorn `.directory-header .action-buttons` pekar på en specifik DOM-struktur i kärnans directory-template som kan ha ändrats i samband med v13:s sidopanelsredesign (release notes nämner en bredare UI-iteration i v13/v14).

Eftersom `renderActorDirectory` fortfarande är den dokumenterade hook-konventionen för ApplicationV2-appar (`render<ApplicationId>`), kommer hooken sannolikt fortfarande att triggas korrekt — risken ligger enbart i om `header`-elementet hittas.

**Åtgärd (i prioritetsordning):**
1. **Liveverifiera** i en riktig v14-klient: öppna DevTools, inspektera Actor Directory-panelen, bekräfta att `.directory-header` och `.action-buttons` fortfarande existerar och att knappen faktiskt syns.
2. Om selektorn inte längre matchar: justera selektorn mot den faktiska v14-DOM:en (troligen enklast fix), **eller**
3. Överväg det mer robusta, officiellt dokumenterade mönstret för ApplicationV2-header-tillägg: hooken `getHeaderControls<ApplicationClassName>` (t.ex. `getHeaderControlsActorDirectory`, se Foundry GitHub-issue #11668) som ersätter AppV1:s `getActorSheetHeaderButtons`-familj. Observera att detta är avsett för **titelradens ikonknappar**, inte nödvändigtvis samma UI-yta som dagens "skapa ny"-knapprad — verifiera vilken yta som faktiskt matchar önskad placering innan ni byter mönster.

### 4. `Actors.registerSheet`/`unregisterSheet` — **ingen åtgärd, redan korrekt**
**Var:** [scripts/dode.mjs:42-69](scripts/dode.mjs:42)

Verifierat mot Foundrys officiella boilerplate-system (community-wikin, uppdaterad för v13) och API-dokumentationen: `Actors.registerSheet`/`unregisterSheet` och motsvarande `Items.*` är fortfarande det idiomatiska, dokumenterade mönstret i v13/v14 — de vidarebefordrar internt till `DocumentSheetConfig.registerSheet(Actor, ...)`. Ingen deprecation, inget behov av att byta till den mer explicita `DocumentSheetConfig`-formen. Lämna som den är.

### 5. `render(true)`-anrop — **ingen åtgärd**
**Var:** [scripts/dode.mjs:71](scripts/dode.mjs:71), [scripts/apps/character-wizard.mjs:223](scripts/apps/character-wizard.mjs:223), [scripts/sheets/actor-character-sheet.mjs:67,83](scripts/sheets/actor-character-sheet.mjs:67)

`Application#render(true)` (boolean-kortform för `{force: true}`) är fortfarande giltig signatur i ApplicationV2 genom v14. Inget att ändra.

### 6. `foundryvtt-cli`-baserad kompendiebyggnad — **ingen åtgärd**
**Var:** `package.json`, `scripts/build/*.mjs`

LevelDB-paketformatet som `@foundryvtt/foundryvtt-cli` läser/skriver är oförändrat genom v11–v14. Ingen v14-specifik åtgärd behövs här; se `memory.md` för den fullständiga CLI-migreringsloggen (session 3) om verktyget i sig behöver uppdateras.

---

## Fördjupning: rollpersonsskaparen (`character-wizard.mjs`) mot v14-praxis

Genomgången bekräftar att den valda arkitekturen redan **är** v14-best-practice för en flerstegsguide — det finns ingen dedikerad "wizard/stepper"-API i Foundrys kärna att migrera till (samma mönster — en enda ApplicationV2-subklass med internt stegindex och full omrendering per steg — används av t.ex. större system för sina flerstegsflöden). Specifikt:

- **`HandlebarsApplicationMixin(ApplicationV2)` + `static PARTS`/`DEFAULT_OPTIONS`** ([scripts/apps/character-wizard.mjs:1](scripts/apps/character-wizard.mjs:1), :28-49) — korrekt, oförändrat mönster v12→v14.
- **`actions`-objektet med privata statiska metoder** (`#onNextStep` m.fl., :36-43) — korrekt v2-actionshanterings-idiom; `this` binds automatiskt till applikationsinstansen av ramverket vid anrop, vilket koden redan förutsätter korrekt (t.ex. `this.stepIndex` i `#onNextStep`).
- **`_prepareContext(options)` som async och anropar `super._prepareContext(options)` först** (:61-62) — korrekt.
- **`_onRender(context, options)` för manuell DOM-eventbindning av namn-input och åldersselect** (:142-152) — ett rimligt undantag från det deklarativa `actions`-mönstret för fält som behöver reagera på varje tangenttryckning utan att trigga en full omrendering; detta är samma mönster kärnan själv använder på ställen där omrendering per tangenttryck vore för dyrt. Inget att ändra.
- **`form: { handler: () => {}, submitOnChange: true, closeOnSubmit: false }`** (:44) — en no-op-handler är korrekt givet att guiden skriver till egen `this.state`-instansdata snarare än direkt till ett Document via Foundrys automatiska formulär→data-bindning; `submitOnChange` triggar ändå omrendering vid ändringar (vilket guiden använder för live-uppdatering av t.ex. kravkontrollen).
- **Item-hämtning via `game.packs.get(...).getDocuments()`** (:65-68) — korrekt, oförändrad kompendie-API.

**Slutsats för fas 5:** inga v14-drivna arkitekturändringar rekommenderas. Om guiden byggs ut senare (Hjälte-nivåer, Socialt stånd, EP-köp — se `ACTIVE_TASK.md` "Nästa steg") kan samma mönster återanvändas rakt av.

---

## Prioriterad åtgärdslista

| # | Åtgärd | Fil(er) | Typ | Brådska |
|---|--------|---------|-----|---------|
| 1 | Byt globalt `renderTemplate(...)` → `foundry.applications.handlebars.renderTemplate(...)` | `scripts/rolls/fv-roll.mjs`, `scripts/rolls/damage-roll.mjs` | Deprecation-städning | Låg risk, billig fix — gör vid nästa tillfälle |
| 2 | Byt globalt `TextEditor.getDragEventData(...)` → `foundry.applications.ux.TextEditor.implementation.getDragEventData(...)` | `scripts/sheets/actor-character-sheet.mjs:115` | Deprecation-städning | Låg risk, billig fix |
| 3 | Liveverifiera "Ny rollperson (guide)"-knappens DOM-selektor i en riktig v14-klient; justera selektor eller migrera till `getHeaderControlsActorDirectory` om trasig | `scripts/dode.mjs:74-86` | Verifiering + ev. fix | Medel — enda punkten som kan vara faktiskt trasig just nu, testa först |
| 4 | Liveverifiera att ProseMirror-editorfälten (`{{editor ...}}`) fortfarande öppnar/sparar korrekt på alla sex itemtyper | `templates/item/*.hbs` (6 filer) | Verifiering | Låg — sannolikt redan okej, billig kontroll |
| 5 | Inget att göra: `Actors/Items.registerSheet`, `render(true)`, DataModel-lagret, ApplicationV2-sheets, `foundryvtt-cli`-paketbygget | — | — | — |

Rekommenderad ordning: kör åtgärd 3 och 4 (rena liveverifieringar, ingen kodändring om inget är trasigt) i samma Foundry-session som annan v14-verifiering ändå görs, och gör 1–2 som en liten fristående städ-commit eftersom de är mekaniska sök-och-ersätt utan beteendeförändring.

---

## Källor

- [DocumentSheetConfig — API v14](https://foundryvtt.com/api/classes/foundry.applications.apps.DocumentSheetConfig.html)
- [renderTemplate — API v13](https://foundryvtt.com/api/v13/functions/foundry.applications.handlebars.renderTemplate.html)
- [TextEditor — API v13](https://foundryvtt.com/api/v13/classes/foundry.applications.ux.TextEditor.html) / [v14](https://foundryvtt.com/api/classes/foundry.applications.ux.TextEditor.html)
- [Release 13.341](https://foundryvtt.com/releases/13.341) (default sheet-registrering, jQuery-avveckling pågår)
- [Release 14.359](https://foundryvtt.com/releases/14.359) (v14 stable, UI-iterationer)
- [ApplicationV2 Conversion Guide — Community Wiki](https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide)
- [System Development Tutorial (Boilerplate) — Community Wiki](https://foundryvtt.wiki/en/development/guides/SD-tutorial/SD05-Creating-your-main-JS-file)
- GitHub-issues: [#11391 Convert Sidebar to ApplicationV2](https://github.com/foundryvtt/foundryvtt/issues/11391), [#11668 getHeaderControls hook](https://github.com/foundryvtt/foundryvtt/issues/11668), [#12255](https://github.com/foundryvtt/foundryvtt/issues/12255) / [#12333](https://github.com/foundryvtt/foundryvtt/issues/12333) (globalThis-deprecationer v13)
