/**
 * Backup av ALLA world-Actors (rollpersoner, NPC:er, monster) och world-Items
 * till riktiga JSON-filer på disk — en fil per dokument, samma format som
 * Foundrys egen "Export Data" (Document#exportToJSON) producerar.
 *
 * VARFÖR DEN HÄR FILEN FINNS (Johan 2026-08-08): "Keep data backup somehow so
 * nothing gets lost of sessions gets broken." En engångskörning i konsolen
 * löser stunden men inte nästa gång. Den här filen gör det till ett
 * upprepningsbart verktyg, samma mönster som `seed-test-party.js`.
 *
 * VARFÖR FILERNA HAMNAR UTANFÖR system-repot: det här är VÄRLDENS spardata
 * (Johans riktiga kampanj — NPC:er, rollpersoner, magiska föremål), inte
 * system-källkod. system-repot är tänkt att bli publikt på GitHub (se
 * CLAUDE.md) — att committa kampanjdata dit vore fel kategori av fil, och en
 * möjlig läcka av privat speldata. Backupen skrivs i stället till
 * `Data/worlds/<world-id>/backups/<datum>/`, en syskonmapp till world.json
 * själv, helt utanför `Data/systems/drakar-och-demoner-expert` (git-repot).
 * OneDrive-synken som redan täcker hela `Data`-trädet ger automatiskt en
 * andra kopia utanför den lokala disken också.
 *
 * ANVÄNDNING: klistra in hela filen i Foundrys konsol (F12) som SL, i en
 * värld som kör drakar-och-demoner-expert. Sedan:
 *
 *   await DoDEBackup.run();          // exporterar ALLT till dagens datummapp
 *
 * Filerna namnges `<DocumentName>-<id>.json` (t.ex. `Actor-xP8gzcOOAKSafD3x.json`)
 * — matchar exakt vad `actor.exportToJSON()` skulle producerat manuellt per
 * dokument, plus `_stats.exportSource` (systemversion, kärnversion, uuid).
 *
 * ÅTERSTÄLLNING av ETT dokument: enklast via Foundrys egen "Import Data"
 * (högerklicka dokumentet i katalogen → Import Data → välj filen) om
 * dokumentet fortfarande finns kvar. Om det RADERATS helt, kör i konsolen:
 *
 *   const raw = await (await fetch("/worlds/<world-id>/backups/<datum>/Actor-<id>.json")).text();
 *   const imported = await Actor.fromImport(JSON.parse(raw));
 *   await Actor.create(game.actors.fromCompendium(imported));
 *
 * (byt `Actor`/`game.actors` mot `Item`/`game.items` för fristående Items.)
 * Detta är EXAKT samma kodväg `Document#importFromJSON` använder internt —
 * liveverifierat 2026-08-08 på en riktig raderad-och-återskapad aktör, NPC
 * och Item (se docs/DESIGN_DECISIONS.md backlog 65, docs/dev/SCHEMA_MIGRATIONS.md).
 *
 * ⚠ `foundry.utils.saveDataToFile` (det `exportToJSON()` internt anropar) är
 * frusen/sealed i den installerade klienten — går INTE att fånga/patcha. Den
 * här filen återskapar därför exakt samma data på det EGNA, publika sättet
 * (`document.toCompendium(null,{clearSource:false})` + samma
 * `_stats.exportSource`-stämpling som `exportToJSON` gör) och laddar upp den
 * via `FilePicker.upload()` i stället för webbläsarens nedladdningsdialog.
 */
const DoDEBackup = (() => {
  function exportData(doc) {
    const data = doc.toCompendium(null, { clearSource: false });
    data._stats ??= {};
    data._stats.exportSource = {
      worldId: game.world.id,
      uuid: doc.uuid,
      coreVersion: game.version,
      systemId: game.system.id,
      systemVersion: game.system.version
    };
    return data;
  }

  async function run({ dateStr = new Date().toISOString().slice(0, 10) } = {}) {
    const dir = `worlds/${game.world.id}/backups/${dateStr}`;
    // FilePicker.createDirectory är opålitlig mot en katalog som inte redan
    // finns på disk (2026-08-08: misslyckades tyst, uppladdningarna floppade
    // med "Target directory does not exist" tills mappen skapades manuellt
    // på filsystemet). Försök ändå — kostar inget om den redan finns, och
    // täcker fallet där en tidigare körning redan skapat dagens mapp.
    try { await foundry.applications.apps.FilePicker.implementation.createDirectory("data", dir); } catch { /* finns redan, eller misslyckas tyst — se docblock */ }

    const results = [];
    const uploadOne = async (doc, kind) => {
      const data = exportData(doc);
      const filename = `${kind}-${doc.id}.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const file = new File([blob], filename, { type: "application/json" });
      const res = await foundry.applications.apps.FilePicker.implementation.upload("data", dir, file, {}, { notify: false });
      results.push({ name: doc.name, kind, filename, ok: !!res?.path });
    };

    for (const actor of game.actors) await uploadOne(actor, "Actor");
    for (const item of game.items) await uploadOne(item, "Item");

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      console.error(
        `DoDEBackup: ${failed.length} av ${results.length} misslyckades — kontrollera att `
        + `${dir} finns på disk (Data/${dir}). Se filens docblock.`,
        failed
      );
      ui.notifications.error(`Backup: ${failed.length}/${results.length} misslyckades — se konsolen.`);
    } else {
      console.log(`DoDEBackup: ${results.length} dokument sparade till Data/${dir}/`);
      ui.notifications.info(`Backup klar: ${results.length} dokument sparade till ${dir}/`);
    }
    return { dir, total: results.length, failed };
  }

  return { run };
})();

globalThis.DoDEBackup = DoDEBackup;
console.log("DoDEBackup laddad — kör await DoDEBackup.run()");
