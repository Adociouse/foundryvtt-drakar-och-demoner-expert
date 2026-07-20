/**
 * Central speldatakonstanter. Varje tabell citerar sin källa så att avvikelser
 * går att slå upp och rätta — se docs/wiki/REGLER_*.md i källprojektet
 * (Drakar och Demoner Expert Roll20) för fullständig kontext.
 */
export const DODE = {};

DODE.attributes = {
  sty: "DODE.Attribute.STY",
  sto: "DODE.Attribute.STO",
  fys: "DODE.Attribute.FYS",
  smi: "DODE.Attribute.SMI",
  int: "DODE.Attribute.INT",
  psy: "DODE.Attribute.PSY",
  kar: "DODE.Attribute.KAR"
};

DODE.skillCategories = {
  a: "DODE.SkillCategory.A",
  b: "DODE.SkillCategory.B"
};

DODE.weaponGrips = { "1H": "DODE.WeaponGrip.1H", "2H": "DODE.WeaponGrip.2H", "1-2H": "DODE.WeaponGrip.1-2H" };
DODE.weaponTypes = { latt: "DODE.WeaponType.Latt", tung: "DODE.WeaponType.Tung" };
DODE.weaponCategories = {
  narstrid: "DODE.WeaponCategory.Narstrid",
  projektil: "DODE.WeaponCategory.Projektil",
  kast: "DODE.WeaponCategory.Kast"
};
DODE.armorSlots = {
  kropp: "DODE.ArmorSlot.Kropp",
  huvud: "DODE.ArmorSlot.Huvud",
  skold: "DODE.ArmorSlot.Skold"
};

// De 13 magiskolorna — MAGI.md (MAG s.8-10)
DODE.magicSchools = {
  alkemi: "DODE.MagicSchool.Alkemi",
  animism: "DODE.MagicSchool.Animism",
  demonologi: "DODE.MagicSchool.Demonologi",
  elementarmagi: "DODE.MagicSchool.Elementarmagi",
  harmonism: "DODE.MagicSchool.Harmonism",
  haxkonster: "DODE.MagicSchool.Haxkonster",
  illusionism: "DODE.MagicSchool.Illusionism",
  mentalism: "DODE.MagicSchool.Mentalism",
  nekromanti: "DODE.MagicSchool.Nekromanti",
  rostmagi: "DODE.MagicSchool.Rostmagi",
  spiritism: "DODE.MagicSchool.Spiritism",
  stavmagi: "DODE.MagicSchool.Stavmagi",
  symbolism: "DODE.MagicSchool.Symbolism"
};

// Rollpersonsnivåer — REGEL_Hjalte.md, källa KH s.3. BP-pool per nivå (spenderas på
// ras/förmågor/socialt stånd/startkapital/färdigheter i senare faser — se PLAN_WIZARD_V2.md).
DODE.bpByNiva = {
  vanlig: 125,
  extraordinar: 150,
  hjalte: 175
};

// Socialt stånd — REGEL_SocialtStand.md, källa RP s.27. 2T6 + spenderade BP
// (1 BP = +1 på slaget). Källdokumentet drar självt slutsatsen att detta
// 9-ståndssystemet är auktoritativt för Expert — ersätter det tidigare
// oimplementerade 1T20/4-ståndssystemet, se REGLER_README.md.
DODE.socialStandingTable = [
  { max: 2, rank: "Egendomslös" }, { max: 4, rank: "Lägre underklass" },
  { max: 7, rank: "Högre underklass" }, { max: 11, rank: "Lägre medelklass" },
  { max: 16, rank: "Högre medelklass" }, { max: 22, rank: "Lägre överklass" },
  { max: 29, rank: "Högre överklass" }, { max: 37, rank: "Lågadel" },
  { max: Infinity, rank: "Högadel" }
];

DODE.socialStandingRank = function (total) {
  for (const row of DODE.socialStandingTable) {
    if (total <= row.max) return row.rank;
  }
  return DODE.socialStandingTable[DODE.socialStandingTable.length - 1].rank;
};

// Startkapital — REGEL_SocialtStand.md, källa RP s.27-28. Valuta = silvermynt (sm).
// Slutsumma = 2T6 + BP + halva socialt-stånd-BP:et (avrundat uppåt), takat vid
// (socialt stånd-slutsumma + 10) — se prepareDerivedData i actor-character.mjs.
DODE.startCapitalTable = [
  { max: 2, sm: 200 }, { max: 4, sm: 400 }, { max: 7, sm: 600 }, { max: 11, sm: 1000 },
  { max: 16, sm: 2000 }, { max: 22, sm: 3000 }, { max: 29, sm: 5000 },
  { max: 37, sm: 10000 }, { max: 46, sm: 20000 }, { max: 56, sm: 30000 },
  { max: Infinity, sm: 50000 }
];

DODE.startCapitalLookup = function (total) {
  for (const row of DODE.startCapitalTable) {
    if (total <= row.max) return row.sm;
  }
  return DODE.startCapitalTable[DODE.startCapitalTable.length - 1].sm;
};

// Åldersmultiplikator på startkapital — REGEL_SocialtStand.md, källa RP s.28.
// Appliceras på startCapital.baseSm → startCapital.finalSm.
DODE.ageCapitalMultiplier = {
  Ung: 1,
  Mogen: 1.5,
  "Medelålders": 2,
  Gammal: 2.5
};

// ⚠ FORSKNINGSLUCKA (PLAN_WIZARD_V2.md Fas 4) — åldersmodifikationer på
// grundegenskaper (RP s.24-25) är INTE extraherade ännu. Tomt tills vidare, INTE
// gissade värden — actor-character.mjs och character-wizard.mjs läser detta
// objekt med `?? 0`-fallback, så ageMod blir 0 (ingen effekt) för alla åldrar
// tills tabellen fylls i här. Infrastrukturen (raceMod/ageMod-uppdelning i
// prepareDerivedData, wizardens förhandsvisning) är på plats och aktiveras
// automatiskt så fort raderna nedan fylls i — ingen kodändring ska behövas då.
DODE.ageAttributeModifiers = {};

// Grupp-tabell — REGLER_EGENSKAPER.md, källa REG s.5-6. Grupp-värdet ger BC (baschans) i färdigheter.
DODE.groupTable = [
  { max: 3, group: 0 }, { max: 8, group: 1 }, { max: 12, group: 2 }, { max: 16, group: 3 },
  { max: 20, group: 4 }, { max: 25, group: 5 }, { max: 30, group: 6 }, { max: 40, group: 7 },
  { max: 50, group: 8 }, { max: 60, group: 9 }, { max: 70, group: 10 }, { max: 80, group: 11 },
  { max: 90, group: 12 }, { max: 100, group: 13 }, { max: 110, group: 14 }, { max: 120, group: 15 },
  { max: 130, group: 16 }, { max: 140, group: 17 }, { max: 150, group: 18 }, { max: 160, group: 19 },
  { max: 170, group: 20 }, { max: 180, group: 21 }
];

/** Egenskapsvärde → Grupp. Tabellen fortsätter uppåt (+1 grupp per ~10 poäng) efter 180 — REG s.6. */
DODE.attributeToGroup = function (value) {
  for (const row of DODE.groupTable) {
    if (value <= row.max) return row.group;
  }
  const last = DODE.groupTable[DODE.groupTable.length - 1];
  return last.group + Math.ceil((value - last.max) / 10);
};

// Skadebonus från STY+STO — REGLER_EGENSKAPER.md, RP s.25. ⚠ Exakta gränsvärden bör verifieras mot original.
DODE.damageBonusTable = [
  { max: 12, formula: "-1d4" },
  { max: 16, formula: "+0" },
  { max: 24, formula: "+1d4" },
  { max: 32, formula: "+1d6" },
  { max: 40, formula: "+2d4" },
  { max: 48, formula: "+2d6" },
  { max: Infinity, formula: "+3d6" }
];

DODE.damageBonus = function (styPlusSto) {
  for (const row of DODE.damageBonusTable) {
    if (styPlusSto <= row.max) return row.formula;
  }
  return "+3d6";
};

// Förflyttning: (SMI+FYS+STO)/3 avrundat nedåt, sedan denna tabell — RP s.24-25. ⚠ Exakta tabellvärden bör verifieras.
DODE.movementTable = [
  { max: 4, squares: 5 }, { max: 6, squares: 6 }, { max: 8, squares: 7 }, { max: 10, squares: 8 },
  { max: 12, squares: 9 }, { max: 14, squares: 10 }, { max: 16, squares: 11 }, { max: 18, squares: 12 },
  { max: 20, squares: 13 }, { max: 22, squares: 14 }, { max: 24, squares: 15 }
];

DODE.movement = function (sum) {
  for (const row of DODE.movementTable) {
    if (sum <= row.max) return row.squares;
  }
  const last = DODE.movementTable[DODE.movementTable.length - 1];
  return last.squares + Math.ceil((sum - last.max) / 2);
};
