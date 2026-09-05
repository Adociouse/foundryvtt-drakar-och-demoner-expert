#!/usr/bin/env node
// Regenererar journaler-kompendiets magiskole-sammanfattningssidor
// (Namn/Kostnad/Räckvidd/Varaktighet/"Effekt (kort)"-tabeller) från den
// aktuella besvärjelser-kompendiekällan. Ersätter det förlorade Python-
// skriptet från session 38 (scratchpad/gen_journals.py, aldrig committat)
// — se CLAUDE.md "Journal-sammanfattningssidor måste hållas synkade" och
// docs/DESIGN_DECISIONS.md backlog (2026-09-05, journaler var 18 spell-
// transkriberingsfixar + 8 nya Kaos Väktare-besvärjelser efter).
//
// Kör: node scripts/build/generate-journal-summaries.mjs
// Skriver bara till packs/journaler/_source/*.json — kör npm run packs:pack
// (inom en foundry-lock-cykel) efteråt för att kompilera om LevelDB-packen.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const spellDir = path.join(root, "packs", "besvarjelser", "_source");
const journalDir = path.join(root, "packs", "journaler", "_source");

// Skol-nyckel -> {file, journalId, pageId, displayName}. Filnamn/ID:n måste
// matcha de BEFINTLIGA dokumenten exakt så regenereringen blir en UPDATE,
// inte en duplicerad ny post. "Allmänna besvärjelser" (skol-lösa besvärjelser)
// rörs inte av detta skript — ingen av de spellar som föranledde detta bygge
// (Kaos Väktare-batchen) är skol-lös.
const SCHOOL_PAGES = {
  alkemi: { file: "Alkemi_QkyROyprgxHiNNoO.json", displayName: "Alkemi" },
  animism: { file: "Animism_hc5eHiogmGyB4O0o.json", displayName: "Animism" },
  demonologi: { file: "Demonologi_nmSXgAlvrvx4V8Ep.json", displayName: "Demonologi" },
  elementarmagi: { file: "Elementarmagi_7FZoh7BeYCEjAXXI.json", displayName: "Elementarmagi" },
  harmonism: { file: "Harmonism_v07WUq3zI78aDPIO.json", displayName: "Harmonism" },
  haxkonster: { file: "Häxkonster_ZgDauYanocsfdHww.json", displayName: "Häxkonster" },
  illusionism: { file: "Illusionism_rF2wPnzTP30PgLby.json", displayName: "Illusionism" },
  mentalism: { file: "Mentalism_KBzbipuB7fzcsezA.json", displayName: "Mentalism" },
  nekromanti: { file: "Nekromanti_bBS9H3cYGO4yClwC.json", displayName: "Nekromanti" },
  rostmagi: { file: "Röstmagi_RHOwEXaqJdskG1MH.json", displayName: "Röstmagi" },
  spiritism: { file: "Spiritism_WPhIhcPoaHcPuZgg.json", displayName: "Spiritism" },
  stavmagi: { file: "Stavmagi_wlYoiDdZS915tG0n.json", displayName: "Stavmagi" },
  symbolism: { file: "Symbolism_Z75O6A8QZhZ9WWQk.json", displayName: "Symbolism" },
  // Ny (2026-09-05) — se DESIGN_DECISIONS.md avstegstabellen "Portalmagi som
  // en 14:e magiskola". Fanns ingen sida alls tidigare eftersom skolan
  // tillkom EFTER session 38:s ursprungliga generering.
  portalmagi: { file: null, displayName: "Portalmagi" }
};

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&auml;/g, "ä").replace(/&Auml;/g, "Ä")
    .replace(/&ouml;/g, "ö").replace(/&Ouml;/g, "Ö")
    .replace(/&aring;/g, "å").replace(/&Aring;/g, "Å")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortEffect(html, maxLen = 80) {
  const text = stripHtml(html);
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLen)}…`;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function costLabel(item) {
  if (item.type === "minibesvarjelse") return `${item.system.psyCost ?? "?"} PSY`;
  const s = item.system.sValue;
  const sPart = s === null || s === undefined || s === "" ? "S⚠" : `S${s}`;
  return item.system.ritual ? `${sPart} (ritual)` : sPart;
}

function buildTable(items, columns) {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, "sv"));
  const head = `<tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr>`;
  const rows = sorted.map((item) => {
    const cells = [`<td>${escapeHtml(item.name)}</td>`, `<td>${escapeHtml(costLabel(item))}</td>`];
    if (columns.length === 5) {
      cells.push(`<td>${escapeHtml(item.system.range ?? "—")}</td>`);
      cells.push(`<td>${escapeHtml(item.system.duration ?? "—")}</td>`);
    }
    cells.push(`<td>${escapeHtml(shortEffect(item.system.description ?? ""))}</td>`);
    return `<tr>${cells.join("")}</tr>`;
  });
  return `<table><thead>${head}</thead><tbody>${rows.join("")}</tbody></table>`;
}

function buildSchoolBody(introHtml, besvarjelser, minibesvarjelser) {
  let html = introHtml;
  if (besvarjelser.length) {
    html += "<h3>Besvärjelser</h3>";
    html += buildTable(besvarjelser, ["Namn", "Kostnad", "Räckvidd", "Varaktighet", "Effekt (kort)"]);
  }
  if (minibesvarjelser.length) {
    html += "<h3>Minimagi</h3>";
    html += buildTable(minibesvarjelser, ["Namn", "Kostnad", "Effekt (kort)"]);
  }
  if (!besvarjelser.length && !minibesvarjelser.length) {
    html += "<h3>Besvärjelser</h3><p><em>Inga besvärjelser i denna skola i det aktuella kompendiet.</em></p>";
  }
  return html;
}

function randomId(len = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Fast, igenkännbart men GILTIGT 16-tecken alfanumeriskt "användar-ID" för
// _stats.lastModifiedBy på skriptgenererat innehåll — se anmärkningen vid
// användningsstället för varför formatet måste hållas exakt 16 tecken.
const SCRIPT_STATS_ID = "RegenJournalScr0";

// Introtexter — korta, källgrundade styckestexter. Befintliga sidors
// intro-text rörs INTE (bara Besvärjelser/Minimagi-tabellerna regenereras),
// Portalmagi är den enda som får en helt ny intro (ingen fanns tidigare).
const PORTALMAGI_INTRO =
  "<h2>Portalmagi</h2>" +
  "<p>Portalmagi är en egen magiskola, öppen för alla magiker — inte bara demonologer — som handlar om att öppna, forma och kontrollera portaler mellan denna värld och andra dimensioner. Skolan är nära besläktad med Demonologin men skild från den; en portalmagiker behöver inte alls syssla med demoner för att bemästra sina besvärjelser.</p>" +
  "<p>⚠ Avsteg (Johan, 2026-09-02): Portalmagi läggs till som en uttalad 14:e magiskola, utöver MAG s.8-10:s slutna 13-skole-canon, eftersom Kaos Väktare (s.49) uttryckligen kallar den en ny, fristående skola. Se docs/DESIGN_DECISIONS.md, avsnittet \"Beslutade avsteg\".</p>";

function main() {
  const spellFiles = readdirSync(spellDir).filter((f) => f.endsWith(".json"));
  const bySchool = {};
  for (const key of Object.keys(SCHOOL_PAGES)) bySchool[key] = { besvarjelser: [], minibesvarjelser: [] };

  for (const f of spellFiles) {
    const doc = JSON.parse(readFileSync(path.join(spellDir, f), "utf-8"));
    const school = doc.system?.school;
    if (!school || !(school in bySchool)) continue;
    if (doc.type === "minibesvarjelse") bySchool[school].minibesvarjelser.push(doc);
    else if (doc.type === "besvarjelse") bySchool[school].besvarjelser.push(doc);
  }

  const now = Date.now();
  const results = [];

  for (const [school, meta] of Object.entries(SCHOOL_PAGES)) {
    const { besvarjelser, minibesvarjelser } = bySchool[school];

    if (meta.file) {
      const filePath = path.join(journalDir, meta.file);
      const doc = JSON.parse(readFileSync(filePath, "utf-8"));
      const page = doc.pages[0];
      // Behåll pagens befintliga intro (allt före första <h3>), regenerera bara
      // tabellerna. Idempotent även om sidan saknar <h3> helt (0 besvärjelser
      // sedan tidigare) — då är HELA nuvarande innehållet introt, ingen tabell
      // att skala bort.
      const introMatch = page.text.content.match(/^([\s\S]*?)(?=<h3>Besv)/);
      const intro = introMatch ? introMatch[1] : page.text.content;
      page.text.content = buildSchoolBody(intro, besvarjelser, minibesvarjelser);
      page._stats.modifiedTime = now;
      // ⚠ _stats.lastModifiedBy MÅSTE vara ett giltigt 16-tecken alfanumeriskt
      // Foundry-ID (DataModel-validering, `new Document(data)`/`.create()` är
      // strikt även om `.update()` råkar vara mer tillåtande) — upptäckt
      // 2026-09-05 när Portalmagi-sidan tystnade misslyckades att skapas via
      // JournalEntry.create() med "RegenJournalScript0" (20 tecken).
      page._stats.lastModifiedBy = SCRIPT_STATS_ID;
      doc._stats.modifiedTime = now;
      doc._stats.lastModifiedBy = SCRIPT_STATS_ID;
      writeFileSync(filePath, JSON.stringify(doc, null, 2) + "\n", "utf-8");
      results.push(`UPDATED ${meta.file} — ${besvarjelser.length} besvärjelser, ${minibesvarjelser.length} minimagi`);
    } else {
      // Ny sida (Portalmagi) — bara skapa om den verkligen inte redan finns.
      const existing = readdirSync(journalDir).find((f) => f.startsWith("Portalmagi_"));
      if (existing) {
        results.push(`SKIPPED Portalmagi — ${existing} finns redan, radera manuellt om regenerering önskas`);
        continue;
      }
      const journalId = randomId();
      const pageId = randomId();
      const fileName = `Portalmagi_${journalId}.json`;
      const doc = {
        name: "Portalmagi — Besvärjelseförteckning",
        _id: journalId,
        pages: [
          {
            _id: pageId,
            name: "Portalmagi",
            type: "text",
            title: { show: true, level: 1 },
            image: {},
            text: {
              content: buildSchoolBody(PORTALMAGI_INTRO, besvarjelser, minibesvarjelser),
              format: 1
            },
            video: { controls: true, volume: 0.5 },
            src: null,
            system: {},
            sort: 0,
            ownership: { default: -1 },
            flags: {},
            _stats: {
              coreVersion: "14.365",
              systemId: "drakar-och-demoner-expert",
              systemVersion: "0.1.0",
              createdTime: now,
              modifiedTime: now,
              lastModifiedBy: SCRIPT_STATS_ID,
              compendiumSource: null,
              duplicateSource: null,
              exportSource: null
            },
            _key: `!journal.pages!${journalId}.${pageId}`
          }
        ],
        folder: null,
        categories: [],
        sort: 0,
        ownership: { default: 0 },
        flags: { "drakar-och-demoner-expert": { source: "school-reference" } },
        _stats: {
          coreVersion: "14.365",
          systemId: "drakar-och-demoner-expert",
          systemVersion: "0.1.0",
          createdTime: now,
          modifiedTime: now,
          lastModifiedBy: SCRIPT_STATS_ID,
          compendiumSource: null,
          duplicateSource: null,
          exportSource: null
        },
        _key: `!journal!${journalId}`
      };
      writeFileSync(path.join(journalDir, fileName), JSON.stringify(doc, null, 2) + "\n", "utf-8");
      results.push(`CREATED ${fileName} — ${besvarjelser.length} besvärjelser, ${minibesvarjelser.length} minimagi`);
    }
  }

  console.log(results.join("\n"));
}

main();
