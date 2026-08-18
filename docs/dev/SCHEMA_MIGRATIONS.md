# Schema-versionering, migration och JSON-export/import

> Byggd 2026-08-08, på Johans begäran: "make sure characters and NPCs, monster
> can be saved exported and imported with json format? Maybe with schema
> version not to cause crashes and keep schema versioning log". Stänger
> `docs/DESIGN_DECISIONS.md` §3 Critical #3 ("Niva schema migration").

## Export/import kräver ingen egen kod — det är redan inbyggt i Foundry

Innan något byggdes kontrollerades detta mot den installerade klienten
(CLAUDE.md-regeln "Kolla Foundrys inbyggda funktioner FÖRST"): varje
world-Document (Actor, Item — alltså rollpersoner, NPC:er/monster på en
scen/i katalogen, och fristående Item-dokument) har redan

- **`document.exportToJSON()`** — skriver en `.json`-fil till spelarens dator.
  Stämplar automatiskt `_stats.exportSource` med `systemId`/`systemVersion`/
  `coreVersion`/`worldId`/`uuid`.
- **`document.importFromJSON(json)`** / **`document.importFromJSONDialog()`**
  — läser en `.json`-fil och uppdaterar dokumentet.

Båda finns redan i **högerklicksmenyn i Actors-katalogen** ("Export Data" /
"Import Data") — ingen UI-kod, inga knappar, inget att bygga. Se
`client/documents/abstract/client-document.mjs` (`exportToJSON`/
`importFromJSON`) i den installerade Foundry-klienten.

## Vad som FAKTISKT behövde byggas: schema-versionering

Foundrys `importFromJSON`/världsuppstart kör redan `DataModel.migrateData(source)`
(en static hook varje `TypeDataModel`-subklass kan override:a, se
`common/abstract/data.mjs`) — men bara om SYSTEMET faktiskt talar om vilka
gamla fältformer som ska mappas om till nya. Foundry känner bara till sina
egna kärnfält, inte DoDE-specifika förändringar (t.ex. `niva`s gamla
3-nivåskala). Den delen fanns inte — `scripts/helpers/schema-migrations.mjs`
fyller precis det hålet, inget mer.

**Arkitektur:**

- `SCHEMA_VERSION` (heltal, höjs vid varje schemaförändring som kräver en
  migreringsgren) + `SCHEMA_LOG` (människoläsbar historik, en post per
  version) — båda i `scripts/helpers/schema-migrations.mjs`.
- Varje `TypeDataModel`-subklass (11 st: `actor-character.mjs`,
  `actor-npc.mjs`, och alla 9 `item-*.mjs`) har fått:
  1. Ett `schemaVersion`-fält i `defineSchema()` (`NumberField`, `initial: SCHEMA_VERSION`).
  2. En `static migrateData(source)` som kör eventuella migreringsfunktioner
     och stämplar `source.schemaVersion = SCHEMA_VERSION`, sedan `return super.migrateData(source)`.
- Foundry anropar `migrateData` **automatiskt** — vid världsuppstart för
  varje existerande dokument, OCH inuti `importFromJSON`/`Actor.fromImport`
  (samma kodväg). Ingen egen "kör migrering nu"-knapp behövs.

## Nuvarande migreringar (SCHEMA_LOG v1)

Bara **en** riktig gren hittills: `migrateCharacterNiva` i
`schema-migrations.mjs` mappar den gamla 3-nivå `niva`-skalan
(`vanlig`/`extraordinar`/`hjalte`, användes före 2026-08-02:s
point-buy-ombyggnad) till nuvarande 4-nivå-skala
(`vanlig`/`slumpens-hjalte`/`sann-hjalte`/`gudafodd`):

```
extraordinar → sann-hjalte
hjalte       → gudafodd
```

⚠ **Den här mappningen är ett RIMLIGHETSVAL, inte källbelagt eller
Johan-beslutat** — se `docs/DESIGN_DECISIONS.md` §3 Critical #3 för hela
resonemanget om varför BP-poolerna mellan skalorna inte är en ren
1-till-1-motsvarighet. Migreringen skriver därför en tydlig
`console.warn` varje gång den slår till, så en SL som importerar/laddar en
gammal rollperson vet att kontrollera BP-poolen manuellt i stället för att
tyst lita på den automatiska gissningen.

**Liveverifierat 2026-08-08 — två omgångar, den andra strängare på Johans begäran ("all NPC, characters and items exported as json? And tested clearing and importing?"):**

*Första omgången (in-memory-simulering):*
- En raw legacy-aktör (`niva:"extraordinar"`, inget `schemaVersion`-fält alls)
  skapades via `Actor.create()` utan att krascha — `niva` migrerades korrekt
  till `"sann-hjalte"`, konsolen loggade varningen, `schemaVersion` blev `1`.
- Full export→import-rundtur (`actor.toCompendium()` → `JSON.stringify` →
  `JSON.parse` → `Actor.fromImport()`, exakt samma kodväg som
  `exportToJSON`/`importFromJSON` använder internt) på en riktig rollperson
  (Grimne Stenhammar, 28 items) bevarade allt korrekt.
- Alla 14 monster i `packs/monster` och alla nio testfixturerna (se
  `docs/dev/seed-test-party.js`) laddar om utan konsolfel efter schemat lades
  till — `schemaVersion: 1` bekräftat på både aktörer och embeddade items.

*Andra omgången — RIKTIGA filer på disk, RIKTIG radering, RIKTIG återimport från de sparade filerna (inte data kvar i minnet):*
- `foundry.utils.saveDataToFile` (som `exportToJSON()` anropar internt) visade
  sig vara `Object.freeze`:ad i den installerade klienten — går inte att fånga
  nedladdningen direkt. Löst genom att bekräfta att den RIKTIGA `exportToJSON()`
  ändå går att anropa felfritt på alla 25 world-dokument (23 aktörer inkl.
  13 riktiga kampanj-NPC:er, 2 magiska vapen-items) — 0 fel — och separat
  återskapa exakt samma data via samma publika metod (`toCompendium`) för att
  faktiskt kunna spara och läsa tillbaka den, se `docs/dev/backup-world.js`.
- **En riktig radera-och-återskapa-cykel**, inte en simulering: `EDGE Tom
  rollperson` (en av testfixturerna) raderades RIKTIGT (`Actor#delete()`),
  bekräftat borta (`game.actors.getName(...)` → `undefined`), sedan hämtad
  TILLBAKA från den faktiska sparade filen på disk via ett riktigt `fetch()`
  mot Foundrys egen filserver (inte data kvar i webbläsarminnet), och återskapad
  via `Actor.create(game.actors.fromCompendium(await Actor.fromImport(parsed)))`
  — exakt kodvägen `importFromJSON` använder internt. Ny dokument-id (som
  förväntat vid en riktig återskapning), alla 16 färdigheter, `niva`,
  `schemaVersion` — allt bevarat. `testFixture`-flaggan (som
  `seed-test-party.js` sätter) överlevde rundturen intakt.
- **Samma rundtur körd på en NPC och ett fristående Item** — men med
  ENGÅNGS-testdokument ("ZZTEST NPC", "ZZTEST Vapen"), INTE Johans riktiga
  kampanj-NPC:er (AKRAE, KHAA, m.fl.) eller riktiga magiska vapen
  (Drakdödaren, Dödsbringaren) — en medveten säkerhetsavvägning: mekanismen
  bevisas lika bra på engångsdata, och en riktig kampanj-NPC ska inte raderas
  för ett tests skull när risken går att undvika helt. Båda passerade samma
  radera→hämta→återskapa-cykel felfritt, städades bort efteråt (de var bara
  till för testet).
- 0 konsolfel utöver kvarvarande buffrade loggrader från INNAN
  backup-katalogen fanns fysiskt på disk (se `docs/dev/backup-world.js`s
  docblock om `FilePicker.createDirectory`s opålitlighet).

## Repeterbar backup — `docs/dev/backup-world.js`

Johan, samma session: "Keep data backup somehow so nothing gets lost of
sessions gets broken." En engångskörning i konsolen räcker för STUNDEN, inte
för nästa session. `docs/dev/backup-world.js` gör det till ett upprepningsbart
verktyg (samma "klistra in i konsolen"-mönster som `seed-test-party.js`):

```js
await DoDEBackup.run();   // exporterar ALLA world-Actors + world-Items till dagens datummapp
```

Filerna hamnar i `Data/worlds/<world-id>/backups/<datum>/`, EN nivå under
själva världsmappen — alltså **utanför** `Data/systems/drakar-och-demoner-expert`
(det här git-repot, som är tänkt att bli publikt, se CLAUDE.md). Kampanjdata
(riktiga NPC:er, rollpersoner, magiska föremål) hör inte hemma i ett publikt
system-repo, både av kategoriskäl och integritet. OneDrive-synken som redan
täcker hela `Data`-trädet ger en andra kopia på köpet.

Se filens eget docblock för hur man återställer ETT specifikt dokument (via
Foundrys inbyggda "Import Data" om dokumentet finns kvar, eller via
`fetch`+`Actor.fromImport`+`Actor.create` om det raderats helt — den exakta
sekvensen som liveverifierades ovan).

## Så här lägger du till en ny migrering

1. Höj `SCHEMA_VERSION` med 1.
2. Lägg till en post i `SCHEMA_LOG` (version, datum, `affects`, `summary`
   — VAD ändrades och VARFÖR, inte bara "fixade fält X").
3. Skriv en ren funktion `migrateXyz(source)` som muterar och returnerar
   `source` (samma konvention som `migrateCharacterNiva`).
4. Anropa den från rätt datamodells `static migrateData(source)`, FÖRE
   `source.schemaVersion = SCHEMA_VERSION`.
5. **Ta aldrig bort en gammal migreringsgren** — en värld som inte laddats
   på länge måste fortfarande kunna hoppa förbi alla mellanliggande steg.
6. Ett NYTT fält med bara ett `initial`-värde behöver INGEN migreringsgren
   — gamla dokument får automatiskt defaultvärdet. Migreringsgrenar behövs
   bara när ett fält byter FORM eller NAMN, eller ett gammalt värde inte
   längre är giltigt (som `niva`s `choices`-lista).

## Vad som INTE byggdes (medvetet avgränsat)

- **Ingen egen export/import-UI** — den inbyggda katalogmenyn räcker, se ovan.
- **Ingen batch-migrering av HELA världen på en gång** (typ dnd5e/PF2e:s
  "Run Migration"-knapp) — `migrateData` körs redan per-dokument automatiskt
  vid världsuppstart, så det finns inget läge där en aktör förblir omigrerad
  efter att världen laddats en gång. En framtida batch-verktygslåda (typ
  PF2e:s `compendium-migration-status`) är fortfarande värdefull för att
  se STATUS över en stor värld, men är ett separat, större UI-projekt.
- **Ingen migrering av ActiveEffects, Scenes eller andra dokumenttyper** —
  bara Actor + Item-typerna som Johan efterfrågade (rollpersoner, NPC:er,
  monster, och alla itemtyper de bär).
