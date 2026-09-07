/**
 * Språkvalsgated journalsidor — backlog 6, "Del 6" (2026-09-07). Foundry har
 * ingen inbyggd per-språk-kompendiemekanism (kontrollerat mot den installerade
 * klientens `common/packages/_types.mjs`: `PackageCompendiumData` saknar helt
 * ett `language`-fält) — så i stället för att bygga två separata parallella
 * kompendiepack (dubbel underhållsyta för varje framtida regeländring) bär
 * varje regelsida i `regler`-kompendiet en ANDRA `JournalEntryPage` (samma
 * `JournalEntry`, alltså EN kompendiepost, EN plats i sidopanelen) taggad
 * `flags.<system>.lang: "en"` — den ursprungliga svenska sidan bär ingen
 * flagga alls (implicit `"sv"`).
 *
 * Denna sheet-subklass åsidosätter bara `isPageVisible()` för att filtrera
 * bort den sida som INTE matchar `game.i18n.lang` — Foundrys egen
 * `_preparePageData()`/`pageId`-upplösning (journal-entry-sheet.mjs, kärnan)
 * hanterar resten automatiskt: en ensidig journal (`viewMode` defaultar till
 * SINGLE om ingen `core.viewMode`-flagga satts) visar bara den kvarvarande
 * sidan direkt, ingen TOC-navigering dyker upp bara för att en andra,
 * DOLD sida finns i bakgrunden.
 *
 * ⚠ Fallback: saknas en engelsk sida för en given regelsida (inte alla 11
 * hann översättas i samma pass, eller framtida nytt innehåll läggs bara till
 * på svenska) visas den svenska sidan ändå — en tom journal hade varit värre
 * än en journal på fel språk.
 *
 * ⚠ Bara SIDANS INNEHÅLL byts — `JournalEntry.name` (kompendielistans egen
 * rubrik i sidopanelen) förblir svensk, medvetet konsekvent med att inget
 * annat kompendieinnehålls NAMN (vapen, besvärjelser, raser osv.) någonsin
 * översätts i det här systemet — bara UI-chrome (fältetiketter, knappar,
 * notiser) gör det. Att översätta dokumentnamn vore en annan, större uppgift.
 */
export default class DoDEJournalSheet extends foundry.applications.sheets.journal.JournalEntrySheet {
  isPageVisible(page) {
    if (!super.isPageVisible(page)) return false;
    const pageLang = page.getFlag(game.system.id, "lang") ?? "sv";
    if (pageLang === game.i18n.lang) return true;
    if (pageLang !== "sv") return false;
    // Den här sidan är den svenska originalsidan — visa den bara om INGEN
    // syskonsida på det aktuella klientspråket finns (fallback ovan).
    const hasTranslation = this.entry.pages.contents.some(
      (p) => p.id !== page.id && (p.getFlag(game.system.id, "lang") ?? "sv") === game.i18n.lang
    );
    return !hasTranslation;
  }
}
