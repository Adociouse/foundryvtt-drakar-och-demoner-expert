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

// Rollpersonsnivåer — HH s.37-39 (fyra nivåer: Vanlig / Slumpens hjälte / Sann
// hjälte / Gudafödd hjälte). BP-pool per nivå (spenderas på ras/förmågor/
// socialt stånd/startkapital/färdigheter i senare faser — se PLAN_WIZARD_V2.md).
// Source: HH p.6 — base 125 BP for ALL hero types ("läggs till de 125 man normalt får").
// No per-type BP differentiation exists in HH — all ödestyper start at 125 BP.
// Extra BP comes from hjältedåd rolls (see DODE.hjaltedadTable).
// DESIGN DECISION: fixed 125 for all tiers. To implement the full HH system,
// use hjältedådstabell rolls instead of fixed tiers.
DODE.bpByNiva = {
  vanlig: 125,
  "slumpens-hjalte": 125,
  "sann-hjalte": 125,
  gudafodd: 125
};

// Source: HH p.6 — "En nyskapad hjälte får slå 1T6 slag på tabellen"
DODE.hjaltedadRollCount = "1T6";

// Source: HH p.6-7, Hjältedådstabell (1T20)
// Hero creation: roll 1T6 to determine how many times to roll on this table.
// Each roll adds the listed bonus BP (and HP) to the hero's base 125 BP.
// Player may choose freely instead of rolling (HH p.6: "eller välja det man tycker passar bäst").
DODE.hjaltedadTable = [
  { range: [1,3],   name: "Torneringsseger",    bonusBP: 15,        bonusHP: 0,   notes: "5 hjältepoäng" },
  { range: [4,5],   name: "Duell",              bonusBP: "1T10+10", bonusHP: "1T10", notes: "" },
  { range: [6,7],   name: "Monsterbane",        bonusBP: "1T10+10", bonusHP: "1T10", notes: "" },
  { range: [8,9],   name: "Korsfarare",         bonusBP: 20,        bonusHP: 10,  notes: "" },
  { range: [10,11], name: "Upptäcktsresande",   bonusBP: 20,        bonusHP: 10,  notes: "" },
  { range: [12,13], name: "Monsterbane (stor)", bonusBP: "1T20+10", bonusHP: "1T10+5", notes: "" },
  { range: [14,14], name: "Gravplundrare",      bonusBP: 20,        bonusHP: 10,  notes: "+10 Startkapital" },
  { range: [15,15], name: "Vapenbärare",        bonusBP: 25,        bonusHP: 0,   notes: "Magiskt vapen" },
  { range: [16,16], name: "Rövare",             bonusBP: 20,        bonusHP: 10,  notes: "+10 Startkapital" },
  { range: [17,17], name: "Segerherre",         bonusBP: 30,        bonusHP: 0,   notes: "15 hjältepoäng" },
  { range: [18,18], name: "Drakdödare",         bonusBP: 35,        bonusHP: 20,  notes: "" },
  { range: [19,19], name: "Räddaren i nöden",   bonusBP: 30,        bonusHP: 10,  notes: "" },
  { range: [20,20], name: "SL Special",         bonusBP: 50,        bonusHP: 35,  notes: "SL bestämmer" },
];

// DEPRECATED — no HH basis. Source: HH — hjälteförmågor are HP-based (5 HP per
// roll on 1T20+HP table), not slot-based. This table has no HH basis.
// Kept (rather than removed) because character-wizard.mjs still reads it to
// gate the "formagor"-stegets fritext-slots (context.abilitySlots,
// #specialAbilitySlots()) — zeroed out until that step is rebuilt around the
// HP-based roll mechanic (forskningslucka, PLAN_WIZARD_V2.md Fas 8).
DODE.abilityRollsByNiva = {
  vanlig: 0,
  "slumpens-hjalte": 0,
  "sann-hjalte": 0,
  gudafodd: 0
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

// EP-budget vid rollpersonsskapande — HH, Erfarenhetspoäng-tabellen (verifierad
// mot fysisk bok 2026-07-21). Beror på nivå × ålder. "Kvarvarande BP × 5" läggs
// till separat, se prepareDerivedData i actor-character.mjs.
// Källtabellen har tre kolumner (Vanlig/Slump | Sann | Gudafödd) — "vanlig" och
// "slumpens-hjalte" delar samma kolumn i källan.
// Source: D&DE Hjältarnas Handbok, Erfarenhetspoäng table (verified from physical book 2026-07-21)
DODE.epBudgetTable = {
  vanlig: { Ung: 200, Mogen: 250, "Medelålders": 300, Gammal: 350 },
  "slumpens-hjalte": { Ung: 200, Mogen: 250, "Medelålders": 300, Gammal: 350 },
  "sann-hjalte": { Ung: 225, Mogen: 275, "Medelålders": 325, Gammal: 375 },
  gudafodd: { Ung: 250, Mogen: 300, "Medelålders": 350, Gammal: 400 }
};

// Livsmål — CHARACTERMANCER-WORKFLOW.md, källa "Expert Regler" (21 poster).
// Guiden erbjuder dessa i en dropdown + fritextalternativ ("Annat") — se
// character-wizard.mjs "livsmal"-steget.
DODE.lifeGoals = [
  "Anarkism", "Berömmelse", "Den starkes rätt", "Egoism", "Finess",
  "Frihet", "Harmoni & Barmhärtighet", "Jämlikhet", "Kärlek",
  "Konservatism", "Kunskap", "Lag & Ordning", "Makt", "Naturvän",
  "Ridderlighet", "Rikedom", "Rättvisa–Hämnd", "Skämt", "Stolthet",
  "Stridsära", "Upptäckarlust"
];

// Max FV en färdighet får ha vid rollpersonsskapande — HH, Erfarenhetspoäng-
// tabellen (verifierad mot fysisk bok 2026-07-21). Konsumeras av EP-
// färdighetsköpet (PLAN_WIZARD_V2.md Fas 6/7).
// Källtabellen har tre kolumner (Vanlig/Slump | Sann | Gudafödd) — "vanlig" och
// "slumpens-hjalte" delar samma kolumn i källan.
// Source: D&DE Hjältarnas Handbok, Erfarenhetspoäng table (verified from physical book 2026-07-21)
DODE.maxStartFvTable = {
  vanlig: { Ung: 21, Mogen: 23, "Medelålders": 25, Gammal: 27 },
  "slumpens-hjalte": { Ung: 21, Mogen: 23, "Medelålders": 25, Gammal: 27 },
  "sann-hjalte": { Ung: 23, Mogen: 25, "Medelålders": 27, Gammal: 29 },
  gudafodd: { Ung: 25, Mogen: 27, "Medelålders": 29, Gammal: 31 }
};

// Primära färdigheter — REGLER_FARDIGHETER.md, källa RP s.36. Alla rollpersoner
// börjar med dessa (grundkostnad 2 EP/FV-steg vid EP-köp, se DODE.skillCost
// nedan). Auto-genereras av rollpersonsskaparen (PLAN_WIZARD_V2.md Fas 6) vid
// fv = grupp av grundegenskapen (baschans/BC, REGLER_EGENSKAPER.md).
DODE.primarySkills = [
  { name: "Bluffa", attribute: "kar" },
  { name: "Finna dolda ting", attribute: "int" },
  { name: "Första hjälpen", attribute: "int" },
  { name: "Gömma sig", attribute: "int" },
  { name: "Hoppa", attribute: "smi" },
  { name: "Klättra", attribute: "smi" },
  { name: "Köpslå", attribute: "kar" },
  { name: "Lyssna", attribute: "int" },
  { name: "Läsa/skriva modersmål", attribute: "int" },
  { name: "Rida", attribute: "smi" },
  { name: "Spåra", attribute: "int" },
  { name: "Stjäla föremål", attribute: "smi" },
  { name: "Tala modersmål", attribute: "int" },
  { name: "Upptäcka fara", attribute: "psy" },
  { name: "Värdera", attribute: "int" },
  { name: "Övertala", attribute: "kar" }
];

// Färdighetens EP-kostnadskategori — RP s.30: primär/yrkesfärdighet/sekundär
// ger olika grundkostnad (2/3/5 EP per FV-steg) vid EP-köp. Konsumeras av
// DODE.skillCost nedan (PLAN_WIZARD_V2.md Fas 7).
DODE.costTiers = {
  primar: "DODE.CostTier.Primar",
  yrkesfardighet: "DODE.CostTier.Yrkesfardighet",
  sekundar: "DODE.CostTier.Sekundar"
};

// EP-kostnad för att höja en färdighets FV — RP s.30. Grundkostnad per
// kostnadskategori × skillnaden i kumulativt C-värde mellan start- och
// slut-FV (inte grundkostnad × antal steg rakt av — kostnaden per steg ökar
// med FV, se kumulativa tabellen). Verifierad mot bokens exempel: Klättra
// (primär) FV 4→10 ska ge 12 EP (PLAN_WIZARD_V2.md Fas 7, testat nedan).
DODE.skillCostTierBase = { primar: 2, yrkesfardighet: 3, sekundar: 5 };
DODE.skillCostCumulative = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 21, 24, 27, 31, 35, 39, 44];
DODE.skillCost = function (costTier, fromFv, toFv) {
  const base = DODE.skillCostTierBase[costTier] ?? DODE.skillCostTierBase.sekundar;
  const from = DODE.skillCostCumulative[fromFv] ?? DODE.skillCostCumulative.at(-1);
  const to = DODE.skillCostCumulative[toFv] ?? DODE.skillCostCumulative.at(-1);
  return base * (to - from);
};

// Åldersmodifikationer på grundegenskaper.
// Source: D&DE Grundreglerboken s.8 (verified from physical book 2026-07-21)
// STO är 0 i alla åldersgrupper (ingen modifiering). KON förekommer inte i denna
// tabell. Nycklarna matchar DODE.attributes (lowercase) och actor.system.alder /
// wizard.state.ageCategory.
DODE.ageAttributeModifiers = {
  Ung:          { smi: 1 },
  Mogen:        { smi: -1, psy: 1 },
  "Medelålders": { sty: -2, fys: -1, smi: -1, int: 1, psy: 1, kar: 1 },
  Gammal:       { sty: -3, fys: -2, smi: -2, psy: 2 }
};

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
