/**
 * Genererar docs/dev/BESVARJELSE_REFERENSTABELL.md — en Markdown-tabell över
 * ALLA besvärjelser i packs/besvarjelser/_source, med kolumner för de nya
 * strids-/mekanikfälten (Magisystem-planen Fas 1-4, 2026-08-21).
 *
 * ⚠ Värdet är som KURATERINGSCHECKLISTA, inte ett färdigt facit — 209 av 222
 * poster har fortfarande tomma mekanikfält (samma "innehåll skapas lat"-
 * mönster som NPC-migreringen/ras-yrkesförmågorna). De 13 UC-M-poster Fas 5
 * kuraterade som bevis på konceptet är de enda ifyllda.
 *
 * Läser bara, skriver ALDRIG i _source/ — säker att köra när som helst, ingen
 * del av packs:pack-flödet. Kör med: node scripts/build/generate-spell-reference.mjs
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.join(__dirname, "..", "..", "packs", "besvarjelser", "_source");
const OUT_FILE = path.join(__dirname, "..", "..", "docs", "dev", "BESVARJELSE_REFERENSTABELL.md");

const SCHOOL_ORDER = [
  "alkemi", "animism", "demonologi", "elementarmagi", "harmonism", "haxkonster",
  "illusionism", "mentalism", "nekromanti", "rostmagi", "spiritism", "stavmagi", "symbolism"
];

function esc(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

async function main() {
  const files = (await readdir(SOURCE_DIR)).filter((f) => f.endsWith(".json") && !f.startsWith("__folder"));
  const spells = [];
  for (const f of files) {
    const raw = await readFile(path.join(SOURCE_DIR, f), "utf8");
    const doc = JSON.parse(raw);
    if (doc.type !== "besvarjelse") continue;
    spells.push({ file: f, ...doc });
  }

  spells.sort((a, b) => {
    const sa = SCHOOL_ORDER.indexOf(a.system.school), sb = SCHOOL_ORDER.indexOf(b.system.school);
    return sa !== sb ? sa - sb : a.name.localeCompare(b.name, "sv");
  });

  const rows = spells.map((d) => {
    const s = d.system;
    const ie = s.instantEffect?.kind && s.instantEffect.kind !== "none"
      ? `${s.instantEffect.kind}(${s.instantEffect.formula || "—"})` : "";
    const src = s.source?.book ? `${s.source.book} s.${s.source.page || "?"}` : "";
    return `| ${esc(d.name)} | ${esc(s.school)} | ${s.sValue ?? ""} | ${esc(s.range)} | ${esc(s.duration)} `
      + `| ${s.battleRelevant ? "✅" : ""} | ${esc(ie)} | ${s.damageType && s.damageType !== "none" ? s.damageType : ""} `
      + `| ${esc(s.statusEffect)} | ${s.resistedBy && s.resistedBy !== "none" ? s.resistedBy : ""} `
      + `| ${s.triggersFearTable ? "✅" : ""} | ${esc(s.targetMode)} | ${esc(src)} |`;
  });

  const curated = spells.filter((d) => d.system.battleRelevant).length;

  const md = `# Besvärjelse-referenstabell (genererad — redigera inte för hand)

<!-- Genererad av scripts/build/generate-spell-reference.mjs. Kör om skriptet
     efter att ha kuraterat fler poster i packs/besvarjelser/_source/*.json —
     redigera INTE den här filen direkt, ändringarna skrivs över. -->

Totalt **${spells.length}** besvärjelser. **${curated}** kuraterade med de nya Fas 1-4-fälten (2026-08-21) — resten väntar på framtida sessioner, samma "innehåll skapas lat"-mönster som övriga kompendiedelar.

⚠ Tomma \`instantEffect\`/\`statusEffect\`/\`resistedBy\`-kolumner betyder INTE att besvärjelsen saknar effekt i boken — bara att den mekaniska datan inte kuraterats än. Läs \`description\`-fältet (inte med i den här tabellen) för den faktiska boktexten.

| Namn | Skola | S | Räckvidd | Varaktighet | Strid? | Instant | Skadetyp | Status | Save | Skräck? | Mål | Källa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.join("\n")}
`;

  await writeFile(OUT_FILE, md, "utf8");
  console.log(`Skrev ${OUT_FILE} (${spells.length} besvärjelser, ${curated} kuraterade).`);
}

main();
