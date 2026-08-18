/**
 * Schema-versionering för Actor-datamodellerna (character/npc).
 *
 * VARFÖR DEN HÄR FILEN FINNS (Johan 2026-08-08): "new features break legacy
 * artifacts... value building migration tools be rebuild items based on
 * requirements if needed" — samma princip som docs/dev/seed-test-party.js
 * följer för TESTFIXTURER (bygg om, migrera inte), men här gäller det
 * RIKTIGA rollpersoner/NPC:er i en riktig värld, som INTE kan byggas om från
 * grunden utan att spelaren tappar allt. De behöver en riktig migrationsväg.
 *
 * MEKANISMEN ÄR NATIV FOUNDRY, INTE EGENBYGGD (CLAUDE.md: "Kolla Foundrys
 * inbyggda funktioner FÖRST"): varje `foundry.abstract.TypeDataModel` har en
 * `static migrateData(source)`-hook (se common/abstract/data.mjs i den
 * installerade klienten) som Foundry redan anropar automatiskt — vid
 * världsuppstart för VARJE aktör, OCH vid `Document#importFromJSON` (den
 * inbyggda "Import Data"-menyn i Actors-katalogen, ingen egen kod behövs för
 * den delen — se CLAUDE.md/DESIGN_DECISIONS.md §om export/import). Det som
 * saknades var bara EN sak: en egen version-stämpel + de faktiska
 * mappningsfunktionerna, eftersom Foundry inte känner till DoDE-specifika
 * schemaförändringar (bara sina egna kärnfältnamn).
 *
 * ANVÄNDNING: varje `TypeDataModel`-subklass som vill migreras lägger till
 * `schemaVersion: new fields.NumberField({initial: SCHEMA_VERSION})` i sitt
 * schema, och en `static migrateData(source) { ...migrera...; source.schemaVersion
 * = SCHEMA_VERSION; return super.migrateData(source); }`. Se actor-character.mjs
 * och actor-npc.mjs för de två nuvarande exemplen.
 *
 * STÅENDE REGEL: när ett fält byter form eller namn (inte bara läggs till —
 * ett NYTT fält med ett `initial`-värde behöver ingen migrering, gamla
 * dokument får bara defaultvärdet), lägg till en rad i SCHEMA_LOG nedan OCH
 * en motsvarande gren i rätt migrateFn. Ta ALDRIG bort en gammal migrerings-
 * gren "för att den inte behövs längre" — en värld som inte laddats sedan
 * flera versioner tillbaka måste fortfarande kunna hoppa förbi alla steg.
 */

/** Höj vid varje schemaförändring som kräver en migreringsgren. */
export const SCHEMA_VERSION = 1;

/**
 * Människoläsbar logg — komplement till SCHEMA_VERSION-numret, som bara
 * säger ATT något ändrats, inte VAD eller VARFÖR. Håll den här i synk med
 * migrateFn-grenarna nedan; en post per SCHEMA_VERSION-höjning.
 */
export const SCHEMA_LOG = [
  {
    version: 1,
    date: "2026-08-08",
    affects: ["character", "npc"],
    summary: "Första versionerade schemat. Migrerar den gamla 3-nivå `niva`-skalan "
      + "(vanlig/extraordinar/hjalte, användes före 2026-08-02:s point-buy-ombyggnad) "
      + "till nuvarande 4-nivå-skalan (vanlig/slumpens-hjalte/sann-hjalte/gudafodd). "
      + "⚠ extraordinar→sann-hjalte och hjalte→gudafodd är ett RIMLIGHETSVAL, inte "
      + "bokbelagt eller Johan-beslutat (se DESIGN_DECISIONS.md §3 Critical #3) — "
      + "migreringen loggar en konsolvarning så SL kan dubbelkolla BP-poolen manuellt "
      + "på en migrerad aktör, i stället för att tyst byta nivå utan spår."
  }
];

const LEGACY_NIVA_MAP = { extraordinar: "sann-hjalte", hjalte: "gudafodd" };

/**
 * Rollpersonens `niva`-fält, 3-nivå → 4-nivå. Se SCHEMA_LOG v1 för
 * mappningens motivering och ⚠-flaggan om att den inte är bokbelagd.
 * @param {object} source Rå källdata (muteras och returneras, samma
 *   konvention som DataModel#migrateData förväntar sig).
 */
export function migrateCharacterNiva(source) {
  const mapped = source?.niva ? LEGACY_NIVA_MAP[source.niva] : null;
  if (mapped) {
    console.warn(
      `DoDE schema-migrering: niva "${source.niva}" → "${mapped}" (schema v${SCHEMA_VERSION}). `
      + "Mappningen är ett rimlighetsval, inte källbelagt — kontrollera BP-poolen manuellt "
      + "på den här rollpersonen. Se scripts/helpers/schema-migrations.mjs SCHEMA_LOG."
    );
    source.niva = mapped;
  }
  return source;
}
