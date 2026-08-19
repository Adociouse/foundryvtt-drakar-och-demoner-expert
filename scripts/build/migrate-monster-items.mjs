/**
 * Engångsmigrering: lägger till riktiga vapen-/rustnings-/fardighet-Items på
 * de 14 pack-buggarna i packs/monster/_source, så deras attacks[]-rader och
 * abs-fält får en Item-baserad parallellrepresentation (naturliga klor/bett/
 * tjockt skinn räknas mekaniskt som vapen/rustning, se item-vapen.mjs).
 *
 * ADDITIV — rör aldrig system.attacks[]/system.abs, som förblir oförändrade.
 * Körs EN gång, sparas bara som referens (inte en del av packs:pack-flödet).
 * Kör med: node scripts/build/migrate-monster-items.mjs
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONSTER_DIR = path.join(__dirname, "..", "..", "packs", "monster", "_source");
const ICON_BASE = "systems/drakar-och-demoner-expert/assets/tokens/naturliga-vapen";

// Namn → återanvänd generisk ikon (bildpipeline, CLAUDE.md steg 2b) — ett
// fåtal delade ikoner i stället för 28 unika, en klo ser ut som en klo
// oavsett djurart. Nyckel = normaliserad attackrad-namn (utan "2 "-prefix).
const ICON_BY_NAME = {
  bett: "bett.png",
  klor: "klor.png",
  hovar: "hovar.png",
  svanssnart: "svanssnart.png",
  svansgadd: "svansgadd.png",
  navar: "navar.png",
  kram: "kram.png"
};

// Samma normalisering som DODE.skillKey (config.mjs) — koden körs utanför
// Foundry (rent Node-skript), så CONFIG.DODE finns inte här.
function skillKey(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function iconFor(attackName) {
  const key = skillKey(attackName).replace(/^2-/, "");
  return `${ICON_BASE}/${ICON_BY_NAME[key] ?? "klor.png"}`;
}

// Foundry-format ID: 16 tecken ur samma alfabet som foundry.utils.randomID().
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomId(length = 16) {
  let out = "";
  for (let i = 0; i < length; i++) out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  return out;
}

function nowStats() {
  const now = Date.now();
  return {
    coreVersion: "14.365",
    systemId: "drakar-och-demoner-expert",
    systemVersion: "0.1.0",
    createdTime: now,
    modifiedTime: now,
    lastModifiedBy: "MigrateMonsterItems00",
    compendiumSource: null,
    duplicateSource: null,
    exportSource: null
  };
}

function makeWeaponItem(actorId, attack, source) {
  const id = randomId();
  return {
    name: attack.name || "Namnlöst anfall",
    type: "vapen",
    _id: id,
    img: iconFor(attack.name),
    system: {
      schemaVersion: 1,
      equipped: true,
      grip: "1H",
      styGroup: 1,
      damage: attack.damage || "1d4",
      length: 0,
      weight: 0,
      baseValue: 0,
      weaponType: "latt",
      category: "narstrid",
      range: "",
      price: 0,
      hardToParry: false,
      natural: true,
      source: { book: source?.book ?? "", page: source?.page ?? "" },
      description: attack.note ? `<p>${attack.note}</p>` : ""
    },
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    _stats: nowStats(),
    _key: `!actors.items!${actorId}.${id}`
  };
}

function makeSkillItem(actorId, attack, source) {
  const id = randomId();
  return {
    name: attack.name || "Namnlöst anfall",
    type: "fardighet",
    _id: id,
    img: iconFor(attack.name),
    system: {
      schemaVersion: 1,
      attribute: "sty",
      category: "a",
      skillKey: skillKey(attack.name),
      weaponGroup: "",
      twoWeaponCombo: { primaryWeaponKey: "", offWeaponKey: "" },
      ep: { ticked: false, earned: 0, spent: 0 },
      fv: attack.fv ?? 0,
      bonus: 0,
      costTier: "primar",
      source: { book: source?.book ?? "", page: source?.page ?? "" },
      description: ""
    },
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    _stats: nowStats(),
    _key: `!actors.items!${actorId}.${id}`
  };
}

function makeArmourItem(actorId, abs, source) {
  const id = randomId();
  return {
    name: "Tjockt skinn",
    type: "rustning",
    _id: id,
    img: `${ICON_BASE}/naturlig-rustning.png`,
    system: {
      schemaVersion: 1,
      slot: "kropp",
      equipped: true,
      baseValue: 0,
      styGroup: 0,
      coverage: [],
      armourGroup: "",
      abs,
      weight: 0,
      price: 0,
      natural: true,
      source: { book: source?.book ?? "", page: source?.page ?? "" },
      description: ""
    },
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    _stats: nowStats(),
    _key: `!actors.items!${actorId}.${id}`
  };
}

async function migrateFile(filePath) {
  const raw = await readFile(filePath, "utf-8");
  const doc = JSON.parse(raw);
  if (doc.type !== "npc") return { file: filePath, skipped: "not-npc" };

  const actorId = doc._id;
  const source = doc.system.source;
  const attacks = doc.system.attacks ?? [];
  const abs = doc.system.abs ?? 0;

  const newItems = [];
  for (const attack of attacks) {
    newItems.push(makeWeaponItem(actorId, attack, source));
    newItems.push(makeSkillItem(actorId, attack, source));
  }
  if (abs > 0) newItems.push(makeArmourItem(actorId, abs, source));

  doc.items = [...(doc.items ?? []), ...newItems];
  await writeFile(filePath, JSON.stringify(doc, null, 2) + "\n", "utf-8");
  return { file: path.basename(filePath), added: newItems.length };
}

async function main() {
  const files = (await readdir(MONSTER_DIR)).filter((f) => f.endsWith(".json"));
  const results = [];
  for (const file of files) {
    results.push(await migrateFile(path.join(MONSTER_DIR, file)));
  }
  for (const r of results) {
    console.log(r.skipped ? `SKIP ${r.file} (${r.skipped})` : `OK   ${r.file}: +${r.added} items`);
  }
}

main();
