/**
 * Central speldatakonstanter. Varje tabell citerar sin källa så att avvikelser
 * går att slå upp och rätta — se docs/wiki/REGLER_*.md i källprojektet
 * (Drakar och Demoner Expert Roll20) för fullständig kontext.
 */
export const DODE = {};

/**
 * Innehållsregister — vilka kompendier som matar rollpersonsskaparen.
 * Se docs/DESIGN_DECISIONS.md §7.5 för hela resonemanget. Kort version:
 *
 * 1. Koden ska ALDRIG hårdkoda pack-id:n (det gjorde character-wizard.mjs
 *    tidigare) — då kan varken paket-omstrukturering eller en kampanjmodul
 *    bidra med innehåll. En modul lägger till sitt eget pack i sin init-hook:
 *      CONFIG.DODE.contentPacks.races.push("min-modul.egna-raser");
 *
 * 2. ⚠ MEDLEMSKAP HÄR ÄR ÅTKOMSTSPÄRREN. Packs som inte ska kunna väljas vid
 *    rollpersonsskapande (`magiska-foremal`, `monster`) står medvetet INTE med.
 *    Att istället filtrera på behörighet räcker inte — en GM klarar varje
 *    behörighetskontroll (Document#testUserPermission kortsluter med
 *    `user.isGM → OWNER`), så en GM som kör guiden hade kunnat köpa magiska
 *    föremål till en ny rollperson. Lägg alltså inte till packs här "för att
 *    de ändå är dolda för spelare".
 *
 * 3. Packs som den aktuella användaren inte får läsa hoppas över vid
 *    upplösning (se #resolveContentPacks i character-wizard.mjs), så ett dolt
 *    pack degraderar tyst istället för att krascha guiden.
 */
DODE.contentPacks = {
  races: ["drakar-och-demoner-expert.raser"],
  professions: ["drakar-och-demoner-expert.yrken"],
  startingEquipment: ["drakar-och-demoner-expert.vapen-utrustning"],
  spells: ["drakar-och-demoner-expert.besvarjelser"]
};

/**
 * Källböcker — RIKTIGA boktitlar, aldrig PDF-filnamn.
 *
 * Johans önskemål 2026-07-28: "Kan inte komma ihåg hur många gånger vi har letat
 * efter var en sak stod i böckerna." Varje innehållsdokument bär därför ett
 * `system.source = { book, page }` där `book` är en nyckel härifrån.
 *
 * Nycklarna är korta av praktiska skäl (de lagras på varje dokument), men det som
 * VISAS är alltid `label`. `short` är förkortningen som används i de kurerade
 * regeldokumenten i Roll20-projektet, så att en citering går att slå upp åt båda hållen.
 */
DODE.books = {
  rp:          { label: "Drakar och Demoner Expert I — Rollpersonen", short: "RP" },
  sl:          { label: "Drakar och Demoner Expert II — Spelledarboken", short: "SL" },
  sb:          { label: "Drakar och Demoner Expert III — Spelarboken", short: "SB" },
  regler:      { label: "Drakar och Demoner Expert — Regler", short: "REG" },
  magi:        { label: "Drakar och Demoner Expert — Magi: Regelboken", short: "MAG" },
  formelboken: { label: "Drakar och Demoner Expert — Magi: Formelboken", short: "FB" },
  kh:          { label: "Krigarens Handbok", short: "KH" },
  hh:          { label: "Hjältarnas Handbok", short: "HH" },
  mh:          { label: "Magikerns Handbok", short: "MH" },
  alver:       { label: "Alver", short: "Alver" },
  svartfolk:   { label: "Svartfolk", short: "SF" },
  tl:          { label: "Tjuvar och Lönnmördare", short: "T&L" },
  mb1:         { label: "Monsterboken 1", short: "MB1" },
  mb2:         { label: "Monsterboxen II — De humanoida raserna", short: "MB2" },
  eget:        { label: "Eget innehåll (ingen bokkälla)", short: "—" }
};

/** "Alver s.22" — tom sträng om ingen källa är satt. Används av arken. */
DODE.formatSource = function (source) {
  if (!source?.book) return "";
  const book = DODE.books[source.book];
  if (!book) return source.book + (source.page ? ` s.${source.page}` : "");
  return book.label + (source.page ? ` s.${source.page}` : "");
};

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

/**
 * Myntslag. `km` = kopparmynt, `sm` = silvermynt, `gm` = guldmynt — förkortningarna
 * är belagda i Spelledarbokens förkortningsindex (SL s.62).
 *
 * ⚠ VÄXELKURSEN ÄR INTE BELAGD. Ingen av källböckerna eller de kurerade
 * regeldokumenten anger vad ett kopparmynt eller guldmynt är värt i silver —
 * UTRUSTNING.md säger bara "silvermynt är basvalutan". 1:10:100 nedan är alltså
 * en TOLKNING, vald för att den är intern konsistent med Magi-regelbokens egna
 * värdshuspriser (s.48): en god måltid 50 km mot en lyxmåltid 10 sm ger 2× med
 * den här kursen men 20× med 1:100:10000, och en sovsal 3 sm mot stallplats för
 * stor häst 15 km ger 2× respektive 20×. De lägre multiplarna är rimligare.
 *
 * Ändra här om en källa dyker upp — allt pris i silver går via toSilver().
 */
DODE.coinToSilver = { km: 0.1, sm: 1, gm: 10 };
DODE.coinLabels = { km: "DODE.Coin.Km", sm: "DODE.Coin.Sm", gm: "DODE.Coin.Gm" };

/** Pris i valfritt myntslag → silvermynt. Se ⚠-noten på DODE.coinToSilver. */
DODE.toSilver = function (value, unit = "sm") {
  const rate = DODE.coinToSilver[unit] ?? 1;
  return Math.round((Number(value) || 0) * rate * 100) / 100;
};

/**
 * Börsaritmetik räknas i KOPPARMYNT som atom, aldrig i silver som flyttal.
 * Ett köp på 12,5 sm som dras från 3 gm + 2 sm får inte bli 0.30000000000000004
 * silver — heltalskoppar gör varje summa exakt och jämförbar.
 */
DODE.purseToKm = function (purse = {}) {
  let total = 0;
  for (const [unit, rate] of Object.entries(DODE.coinToSilver)) {
    total += (purse[unit] ?? 0) * rate * 10;
  }
  return Math.round(total);
};

/**
 * Kopparmynt → börsobjekt, största valör först.
 *
 * Itererar DODE.coinToSilver i stället för att hårdkoda gm/sm/km, så att en ny
 * valör bara kräver en rad i den tabellen (plus ett fält i `currency`-schemat på
 * actor-character.mjs om den ska kunna bäras). Se backlogpost 28 om mithrilmynt.
 */
DODE.kmToPurse = function (totalKm) {
  let rest = Math.max(0, Math.round(totalKm));
  const units = Object.entries(DODE.coinToSilver).sort((a, b) => b[1] - a[1]);
  const purse = {};
  for (const [unit, rate] of units) {
    const worth = Math.round(rate * 10);
    purse[unit] = Math.floor(rest / worth);
    rest -= purse[unit] * worth;
  }
  return purse;
};

/** Silverpris (kan vara brutet, t.ex. 12,5) → kopparmynt som heltal. */
DODE.silverToKm = function (sm) {
  return Math.round((Number(sm) || 0) * 10);
};

/** "3 gm 2 sm 5 km" — tomma valörer utelämnas. Visar "0 km" för en tom börs. */
DODE.formatPurse = function (purse = {}) {
  const parts = Object.entries(DODE.coinToSilver)
    .sort((a, b) => b[1] - a[1])
    .filter(([unit]) => purse[unit])
    .map(([unit]) => `${purse[unit]} ${unit}`);
  return parts.length ? parts.join(" ") : "0 km";
};

/**
 * Färguppsättningar för de tre kandidatslagen i guidens "tre kandidater"-läge.
 *
 * Namnen är Dice So Nice-colorsets ur modulens egen [Colors]-kategori (verifierat
 * mot DSN 6.2.9:s `main.js` — den läser `DiceTerm.options.colorset` per tärningsterm,
 * så en poolformel kan ha olika färg per delslag). Utan modulen installerad är
 * fältet bara ignorerat, så koden fungerar oförändrat i båda fallen.
 *
 * `css` används för att färga motsvarande knapp i guiden, så att spelaren kan se
 * VILKA tärningar som gav vilket kandidatvärde. Utan den kopplingen är tre
 * färgade tärningsset bara dekoration.
 */
DODE.candidateColorsets = [
  // `label` står i plural eftersom den läses som "Röda tärningar" i knapparnas
  // titel — singularformen gav "Röd tärningar".
  { colorset: "red", label: "Röda", css: "#a8322d" },
  { colorset: "green", label: "Gröna", css: "#2f6b3a" },
  { colorset: "blue", label: "Blå", css: "#2d5a8a" }
];

// Kategorier för `utrustning`-Items — följer rubrikerna i Magi-regelbokens
// utrustningslistor (s.43-48), se docs/extracts/DODE_Magi_TABELLER.md i
// Roll20-projektet.
DODE.equipmentCategories = {
  verktyg: "DODE.EquipmentCategory.Verktyg",
  kladsel: "DODE.EquipmentCategory.Kladsel",
  behallare: "DODE.EquipmentCategory.Behallare",
  koksutrustning: "DODE.EquipmentCategory.Koksutrustning",
  lagerutrustning: "DODE.EquipmentCategory.Lagerutrustning",
  tjuvverktyg: "DODE.EquipmentCategory.Tjuvverktyg",
  instrument: "DODE.EquipmentCategory.Instrument",
  droger: "DODE.EquipmentCategory.Droger",
  mat: "DODE.EquipmentCategory.Mat",
  riddjur: "DODE.EquipmentCategory.Riddjur",
  fordon: "DODE.EquipmentCategory.Fordon",
  // Värdesaker — ädelstenar, smycken, tackor och exotiska mynt. Bärs som
  // föremål med ett pris, INTE som en valör i börsen: de är skatt att värdera
  // och sälja, inte något man betalar öl med. Johans observation 2026-07-28 om
  // mithrilmynt, se backlogpost 28.
  vardesaker: "DODE.EquipmentCategory.Vardesaker",
  diverse: "DODE.EquipmentCategory.Diverse"
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

/**
 * Magiskolorna som FÄRDIGHETER — MAGI.md (MAG s.8-10).
 *
 * En magiskola är i regelverket inte en egen mekanik utan ett färdighetsvärde:
 * MAGI.md kallar det uttryckligen "Färdighetsvärde i magiskolan", och FV i
 * skolan avgör vilka besvärjelser man kan lära sig och max effektgrad. En
 * magiker kan ha flera skolor; den med högst FV är den som allmän minimagi
 * räknas till.
 *
 * Därför modelleras skolor som vanliga `fardighet`-Items istället för ett eget
 * schemafält på rollpersonen — då fungerar EP-köp, FV-höjning, slagningar och
 * arkets färdighetslista utan en enda ny mekanism. Guidens `magiskola`-steg
 * skapar bara den valda skolan som en färdighet med costTier "yrkesfardighet".
 *
 * (Tre av skolorna låg tidigare som "(magiskola)"-poster i secondarySkills —
 * borttagna därifrån 2026-07-27 så att alla 13 bor på ett ställe.)
 */
DODE.magicSchoolSkills = Object.keys(DODE.magicSchools).map((school) => ({
  key: `magiskola-${school}`,
  // Namnet hämtas från samma lokaliseringsnyckel som DODE.magicSchools, så
  // skolan heter likadant överallt i UI:t.
  labelKey: DODE.magicSchools[school],
  school,
  attribute: "int",
  // Skolsymbolen ligger som en vanlig systemasset, inte i ett kompendium —
  // skolorna är ju inga dokument. Filnamnet är alltid skolnyckeln.
  img: `systems/drakar-och-demoner-expert/assets/tokens/magiskolor/${school}.png`
}));

// Rollpersonsnivåer — HH s.37-39 (fyra nivåer: Vanlig / Slumpens hjälte / Sann
// hjälte / Gudafödd hjälte). BP-pool per nivå (spenderas på ras/förmågor/
// socialt stånd/startkapital/färdigheter i senare faser — se PLAN_WIZARD_V2.md).
// Source: HH p.6 — base 125 BP for ALL hero types ("läggs till de 125 man normalt får").
// Extra BP comes from hjältedåd rolls (see DODE.hjaltedadTable).
// DESIGN DECISION: fixed 125 for all tiers. To implement the full HH system,
// use hjältedådstabell rolls instead of fixed tiers.
//
// ⚠ RÄTTELSE 2026-07-27: kommentaren här påstod tidigare att "no per-type BP
// differentiation exists" — det är FEL. Alver-supplementet s.22 ("Hur du skapar
// en alv") har en explicit nivåtabell:
//     Vanlig / Extraordinär / Hjälte
//     BP                125 / 150 / 200→175
//     Antal slag för förmågor  1 / 2 / 3
//     Erfarenhetspoäng  150 / 200 / 250
//     Max FV från start  15 / 17 / 19
// Det SOURCEAR de 150/175 som §3 backlogpost 4 hittills flaggat som "unsourced
// extrapolations" — talen var alltså rätt hela tiden, bara felaktigt attribuerade.
// Värdena här lämnas AVSIKTLIGT oförändrade tills ett regelbeslut tas: boken
// kallar dem "regelförslag" specifikt för alvskapande, och att ändra dem skulle
// retroaktivt flytta budgeten för varje befintlig rollperson. Se backlogpost 4.
// (DODE.abilityRollsByNiva nedan stämmer redan med bokens 1/2/3.)
DODE.bpByNiva = {
  vanlig: 125,
  "slumpens-hjalte": 125,
  "sann-hjalte": 125,
  gudafodd: 125
};

// Konverterar bokens svenska tärningsnotation ("1T10+10") till Foundrys Roll-
// syntax ("1d10+10") — tabelldata i böckerna (hjältedådstabell m.fl.) skrivs
// alltid med "T", aldrig "d". Delad helper istället för en inline regex på
// varje anropsställe, ifall fler tabeller med samma notation dyker upp.
DODE.swedishDiceToRoll = function (formula) {
  return String(formula ?? "").replace(/(\d+)\s*[Tt]\s*(\d+)/g, "$1d$2");
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

// Antal slag/slots för särskilda förmågor vid rollpersonsskapande — KH s.3,
// raden "Antal slag för särskilda förmågor" (Vanlig/Extraordinär/Hjälte =
// 1/2/3), se REGEL_Hjalte.md. Omnycklad till arkets 4-nivåskala (Fas 10):
// vanlig→Vanlig, slumpens-hjalte→Extraordinär, sann-hjalte→Hjälte.
// gudafodd: 4 är en ⚠ extrapolering (samma +1-mönster som övriga nivåtabeller)
// — KH s.3 har bara tre nivåer, ingen bokkälla för en fjärde.
//
// OBS: detta är INTE samma sak som hjälteförmågor (HH s.20/46-48) — de är en
// separat, HP-baserad post-creation-mekanik (5 HP per slag på en egen
// 1T20-tabell) och hanteras inte av denna tabell eller av wizardens
// "formagor"-steg. En tidigare session nollställde denna tabell av misstag
// genom att blanda ihop de två mekanikerna — se PLAN_WIZARD_V2.md "SPEC —
// Förmågor System Architecture" för den bredare (ännu inte byggda) förmåge-
// arkitekturen som ska ersätta detta MVP-fritextsteg.
DODE.abilityRollsByNiva = {
  vanlig: 1,
  "slumpens-hjalte": 2,
  "sann-hjalte": 3,
  gudafodd: 4
};

// Särskilda förmågor (RP s.25-27) — slås fram med 2T20 + spenderade BP (minst 1,
// max +40). Ett slag ger EN rad ur denna tabell; DODE.abilityRollsByNiva ovan styr
// bara HUR MÅNGA slag (slots) en rollperson får, inte innehållet i varje slag.
// Portat från Roll20-projektets docs/extracts/DODE_Grundregelbok_fullextract.md
// (rad 287-345) — redan en ren transkribering, inte fritt uppfunnet här. ⚠ Den
// underliggande RP-sidan (s.25) är enligt samma extraktionsarbete kraftigt
// OCR-skadad, så denna tabell är korsreferens-rekonstruerad snarare än en direkt
// sida-för-sida-transkribering — se DESIGN_DECISIONS.md §3 (backlogpost 12).
// Sista raden (78) fångar även högre resultat (2T20 max 40 + BP max 40 = 80 är
// teoretiskt möjligt men källan listar ingen egen rad över 78) — en rimlig
// tabellkonvention, inte en bekräftad regel.
// OBS: detta är INTE hjälteförmågor (HH s.20/46-48, se kommentaren ovan) — den
// mekaniken är en separat, ännu obyggd post-creation-funktion.
// ⚠ `effect` (backlogpost 7/36, tillagd 2026-07-31) finns bara på de ~15 rader
// som ger ett konkret färdighetsvärde — resten (CL-bonusar, attribut-/motstånds-
// /stridsändringar, ren text) är medvetet oförändrade, se DESIGN_DECISIONS.md
// backlog 36. Formerna: "skillBonus" lägger på ett värde (fast skill-lista via
// `skills`, eller spelarval via `pool`: "sekundar"/"hantverk"), "grantSecondary"
// SÄTTER ett absolut FV på en färdighet spelaren annars inte får ha (RP s.28-29,
// 13b) — `pool:"sprak"` med `labels` fanar ut EN spelartyped choice till FLERA
// färdigheter (Tala/Läsa-skriva). "yrkesUpgrade" skapar N valda sekundära som
// yrkesfärdighetsnivå i stället för sekundärnivå. "costTierOverride" sänker
// grundkostnaden i DODE.skillCost (se dess 4:e parameter). `count` (default 1)
// är hur många spelarval effekten kräver. Nycklarna slås upp/skapas av
// special-ability-effects.mjs, inte här.
DODE.specialAbilitiesTable = [
  { range: [3, 4], name: "", description: "+1 på FV på valfri sekundär färdighet (utom förbjudna)",
    effect: { type: "skillBonus", pool: "sekundar", value: 1 } },
  { range: [5, 6], name: "Sjöfararbakgrund", description: "+2 FV i Sjökunnighet och Navigera",
    effect: { type: "skillBonus", skills: ["sjokunnighet", "navigation"], value: 2 } },
  { range: [7, 8], name: "Starka vrister", description: "+3 på FV i Hoppa",
    effect: { type: "skillBonus", skills: ["hoppa"], value: 3 } },
  { range: [9, 10], name: "Bråkig uppväxt", description: "+3 på FV i Slagsmål",
    effect: { type: "skillBonus", skills: ["slagsmal"], value: 3 } },
  { range: [11, 12], name: "Hantverkarbakgrund", description: "+3 FV i valfri hantverksfärdighet",
    effect: { type: "skillBonus", pool: "hantverk", value: 3, namePrefix: "Hantverk: " } },
  { range: [13, 14], name: "Smidig kropp", description: "+3 FV i Akrobatik",
    effect: { type: "skillBonus", skills: ["akrobatik"], value: 3 } },
  { range: [15, 16], name: "Köpmannabakgrund", description: "+3 FV i Värdera",
    effect: { type: "skillBonus", skills: ["vardera"], value: 3 } },
  { range: [17, 18], name: "God koordinationsförmåga", description: "+3 FV i Två vapen",
    effect: { type: "skillBonus", skills: ["tva-vapen"], value: 3 } },
  { range: [19, 20], name: "Hobbyist", description: "FV 3 i valfri sekundär färdighet du kan lära från början",
    effect: { type: "grantSecondary", pool: "sekundar", fv: 3 } },
  { range: [21, 22], name: "Starka nypor", description: "Alltid +3 på CL i Klättra" },
  { range: [23, 24], name: "Mottagligt medium", description: "Alltid +5 CL i Magisk kanalisering (passiv)" },
  { range: [25, 26], name: "Hängiven student", description: "+2 på valfritt FV; om FV-begränsning finns höjs den med 2" },
  { range: [27, 28], name: "Övertygande tonfall", description: "Alltid +3 CL i Övertala och Muta" },
  { range: [29, 30], name: "Sjätte sinne", description: "+1 på dina FV i Upptäcka fara och Finna dolda ting",
    effect: { type: "skillBonus", skills: ["upptacka-fara", "finna-dolda-ting"], value: 1 } },
  { range: [31, 32], name: "Stirrande blick", description: "Alltid +5 CL i Hypnotisera" },
  { range: [33, 34], name: "Magikänsla", description: "Alltid +5 CL i Känna magi" },
  { range: [35, 36], name: "Gott språksinne", description: "Automatiskt FV 20 (B5) i Tala och Läsa/Skriva ett valfritt språk",
    effect: { type: "grantSecondary", pool: "sprak", fv: 20, labels: ["Tala", "Läsa/skriva"] } },
  { range: [37, 38], name: "Stort kunskapsområde", description: "Två ytterligare valfria sekundära färdigheter som yrkesfärdigheter",
    effect: { type: "yrkesUpgrade", count: 2, pool: "sekundar" } },
  { range: [39, 40], name: "God bågskytt", description: "Alla räckvidder för projektilvapen ökas med 25%" },
  { range: [41, 42], name: "Absolut gehör", description: "Grundkostnaden för Spela instrument och Sjunga är alltid 1" },
  { range: [43, 44], name: "Precisionssinne", description: "+1 CL på alla vapenfärdigheter" },
  { range: [45, 46], name: "Dubbelhänt", description: "Se rubriken \"Svärdshand\"" },
  { range: [47, 48], name: "God tidskänsla", description: "Mycket god känsla för tidens gång; vet alltid på 10 min när" },
  { range: [49, 51], name: "Absolut ögonmått", description: "Bedöma avstånd med 5% felmarginal" },
  { range: [52, 54], name: "Mycket uppmärksam", description: "Alltid +2 CL i Finna dolda ting och Upptäcka fara" },
  { range: [55, 55], name: "Blixtsnabba reflexer", description: "+3 på alla initiativslag" },
  { range: [56, 56], name: "Bärsärk", description: "+5 på ditt FV i Bärsärkagång",
    effect: { type: "skillBonus", skills: ["barsarkagang"], value: 5 } },
  { range: [57, 57], name: "Gott balanssinne", description: "+5 på SMI vid balansakter och landning efter fall" },
  { range: [58, 58], name: "Hästarnas herre", description: "+10 på FV i Rida; kan aldrig bli avkastad (men kan trilla av)",
    effect: { type: "skillBonus", skills: ["rida"], value: 10 } },
  { range: [59, 59], name: "Ambidextriös", description: "Se rubriken \"Svärdshand\"" },
  { range: [60, 60], name: "Djurvän", description: "Blir aldrig angripen av vanliga djur" },
  { range: [61, 61], name: "Turgubbe", description: "Kan alltid modifiera CL med +1 genom att spendera 1 PSY-poäng" },
  { range: [62, 62], name: "Magisk empati", description: "Med PSY kan du övervinna effektgrader lagrade i magiska föremål och identifiera besvärjelser" },
  { range: [63, 63], name: "Gudarnas gunstling", description: "Varje gång dina KP når noll: 25% chans att en gud griper in och återställer alla KP. Kritiska skador kan ej läkas på detta sätt" },
  { range: [64, 64], name: "Lättlärd", description: "Grundkostnaden för sekundära färdigheter minskas till 4",
    effect: { type: "costTierOverride", tier: "sekundar", base: 4 } },
  { range: [65, 65], name: "Extremt smärttålig", description: "Totala KP multipliceras med 1,5 (ändrar även träffområdenas KP)" },
  { range: [66, 66], name: "Snabbslående", description: "Slår alltid först i varje SR. Vid möte med annan med denna förmåga: normalt initiativslag" },
  { range: [67, 67], name: "Baneman", description: "Svurit att bekämpa en speciell ras/folkslag; +5 CL vid alla attacker mot denna" },
  { range: [68, 68], name: "God kroppskontroll", description: "Kontrollera adrenalin med normalt FYS-slag; höj STY och alla STY-baserade färdigheter med +5 under 3 SR. Max 2 gånger per dag" },
  { range: [69, 69], name: "Järnnäve", description: "Alltid maximal skada i obeväpnad strid" },
  { range: [70, 70], name: "Extremt orädd", description: "−5 på alla slag på Skräcktabellen" },
  { range: [71, 71], name: "Orubblig vilja", description: "+5 på PSY på alla slag PSY mot PSY på Motståndstabellen" },
  { range: [72, 72], name: "Härdig mot element", description: "+5 på FYS på alla Motståndslag mot eld, köld, vatten, vind, etc." },
  { range: [73, 73], name: "Gott läkekött", description: "KP-förluster av fysiskt våld eller elementarbesvärjelser läker dubbelt så fort" },
  { range: [74, 74], name: "God mental kontroll", description: "Återfår PSY-poäng förbrukade av besvärjelser på halva tiden. Ej för icke-magiker (räknas som resultat 73)" },
  { range: [75, 75], name: "Naturlig färdighet med vapen", description: "+5 FV på en valfri vapenfärdighet" },
  { range: [76, 76], name: "Kluven personlighet", description: "Förutom egen yrkesförmåga: välj även yrkesförmågan från valfritt annat yrke" },
  { range: [77, 77], name: "God känsla för yrket", description: "Kostnaden för att lära sig en besvärjelse eller en yrkesfärdighet halveras alltid (avrunda uppåt). Halvera efter multiplikation" },
  { range: [78, 999], name: "Hamnbytare", description: "Kan förvandla sig till ett djur (slå 1T6): 1 — varg, 2 — björn, 3 — hök, 4 — hjort, 5 — svan, 6 — katt. Verklig förvandling; övertar djurets egenskaper utom INT och INT-baserade färdigheter" }
];

// Slår fram en rad ur DODE.specialAbilitiesTable för ett givet 2T20+BP-resultat.
// Mirrorar DODE.skillCost's funktion-i-config-stil.
DODE.rollSpecialAbility = function (total) {
  return DODE.specialAbilitiesTable.find((row) => total >= row.range[0] && total <= row.range[1]) ?? null;
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

/**
 * Kanonisk, språkoberoende nyckel för en färdighet.
 *
 * ⚠ VARFÖR: visningsnamn är INTE stabila identifierare. Systemet matchade
 * tidigare färdigheter på namn (`name.toLowerCase()`) i guidens avstämning,
 * dedupning och EP-köp. Det fungerade bara så länge alla namn kom från samma
 * svenska konfigtabell — i samma stund som namnen körs genom `game.i18n`, eller
 * en Babele-liknande översättningsmodul döper om kompendiedokument, hade en
 * rollperson skapad på ett språk och redigerad på ett annat TYST fått
 * dubblerade färdigheter (backlogpost 6a, Johans observation 2026-07-27).
 *
 * Nyckeln utgår från det svenska namnet men fryses i tabellerna nedan som
 * explicita `key`-fält — funktionen används därefter bara som fallback för
 * data utan nyckel (äldre rollpersoner, yrkens `professionSkills`).
 */
DODE.skillKey = function (name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Primära färdigheter — REGLER_FARDIGHETER.md, källa RP s.36. Alla rollpersoner
// börjar med dessa (grundkostnad 2 EP/FV-steg vid EP-köp, se DODE.skillCost
// nedan). Auto-genereras av rollpersonsskaparen (PLAN_WIZARD_V2.md Fas 6) vid
// fv = grupp av grundegenskapen (baschans/BC, REGLER_EGENSKAPER.md).
DODE.primarySkills = [
  { key: "bluffa", name: "Bluffa", attribute: "kar" },
  { key: "finna-dolda-ting", name: "Finna dolda ting", attribute: "int" },
  { key: "forsta-hjalpen", name: "Första hjälpen", attribute: "int" },
  { key: "gomma-sig", name: "Gömma sig", attribute: "int" },
  { key: "hoppa", name: "Hoppa", attribute: "smi" },
  { key: "klattra", name: "Klättra", attribute: "smi" },
  { key: "kopsla", name: "Köpslå", attribute: "kar" },
  { key: "lyssna", name: "Lyssna", attribute: "int" },
  { key: "lasa-skriva-modersmal", name: "Läsa/skriva modersmål", attribute: "int" },
  { key: "rida", name: "Rida", attribute: "smi" },
  { key: "spara", name: "Spåra", attribute: "int" },
  { key: "stjala-foremal", name: "Stjäla föremål", attribute: "smi" },
  { key: "tala-modersmal", name: "Tala modersmål", attribute: "int" },
  { key: "upptacka-fara", name: "Upptäcka fara", attribute: "psy" },
  { key: "vardera", name: "Värdera", attribute: "int" },
  { key: "overtala", name: "Övertala", attribute: "kar" }
];

// Sekundära färdigheter — portat från Roll20-projektets docs/wiki/REGLER_FARDIGHETER.md
// (rad 184-265), inte fritt uppfunnet här. Källdoket flaggar själv: "⚠ Grundkostnader
// och BC — verifiera mot RP s.34–64 och REG s.19–43" — den flaggan bärs vidare hit
// (Regelfilosofin: kuraterade dokument är facit, inte något att tyst "rätta").
// Tio namn som redan finns i DODE.primarySkills ovan (Finna dolda ting, Gömma sig,
// Hoppa, Klättra, Köpslå, Lyssna, Spåra, Stjäla föremål, Värdera, Övertala) är
// medvetet uteslutna här — källtabellen listade dem även bland de sekundära, men en
// rollperson har redan dessa som primära från skapandet, så de ska inte dyka upp
// som ett nytt köpbart alternativ i färdighetsväljaren. "Uppfattningsfärdigheter"
// (rubrikrad utan egen kostnad/BC i källan) är också utesluten — det är en
// kategorirubrik, inte en enskild färdighet.
// ⚠ Källtabellens "Kostnad"-kolumn varierar per färdighet (2/3/4/6/8/"varierar"),
// men den nuvarande EP-köpsmekaniken (DODE.skillCostTierBase) använder en platt
// grundkostnad per kategori (sekundär = 5) — denna lista bär bara namn+grundegenskap
// vidare, ingen per-färdighet-kostnad. Se detta som en öppen avvikelse, inte tyst
// ignorerad (jfr DESIGN_DECISIONS.md §3).
DODE.secondarySkills = [
  { key: "akrobatik", name: "Akrobatik", attribute: "smi" },
  { key: "alkemi", name: "Alkemi", attribute: "int" },
  { key: "astrologi", name: "Astrologi", attribute: "int" },
  { key: "avvapna", name: "Avväpna", attribute: "smi" },
  { key: "barsarkagang", name: "Bärsärkagång", attribute: "psy" },
  { key: "buktala", name: "Buktala", attribute: "psy" },
  { key: "dans", name: "Dans", attribute: "smi" },
  { key: "djurhelning", name: "Djurhelning", attribute: "psy" },
  { key: "djurtraning", name: "Djurträning", attribute: "psy" },
  { key: "dolk", name: "Dolk", attribute: "smi" },
  { key: "dra-vapen", name: "Dra vapen", attribute: "smi" },
  { key: "drogkunskap", name: "Drogkunskap", attribute: "int" },
  { key: "forfalskning", name: "Förfalskning", attribute: "int" },
  { key: "geografi", name: "Geografi", attribute: "int" },
  { key: "geologi", name: "Geologi", attribute: "int" },
  { key: "giftkunskap", name: "Giftkunskap", attribute: "int" },
  { key: "gycklekonster", name: "Gycklekonster", attribute: "smi" },
  { key: "hantera-fallor", name: "Hantera fällor", attribute: "smi" },
  // Grundegenskap "varierar" i källan (beror på hantverkstyp) — smi vald som
  // rimlig standard (de flesta hantverk är handlagsbaserade), ⚠ approximation.
  { key: "hantverk-spec", name: "Hantverk (spec.)", attribute: "smi" },
  { key: "hasardspel", name: "Hasardspel", attribute: "int" },
  { key: "heraldik", name: "Heraldik", attribute: "int" },
  { key: "historia", name: "Historia", attribute: "int" },
  { key: "hypnotisera", name: "Hypnotisera", attribute: "psy" },
  { key: "judo", name: "Judo", attribute: "smi" },
  { key: "karate", name: "Karate", attribute: "smi" },
  { key: "knopar", name: "Knopar", attribute: "smi" },
  { key: "kulturkannedom", name: "Kulturkännedom", attribute: "int" },
  { key: "kunskap-om-demoner", name: "Kunskap om demoner", attribute: "int" },
  { key: "kunskap-om-magi", name: "Kunskap om magi", attribute: "int" },
  { key: "kunskap-om-ododa", name: "Kunskap om odöda", attribute: "int" },
  { key: "lasdyrkning", name: "Låsdyrkning", attribute: "smi" },
  { key: "lakekonst", name: "Läkekonst", attribute: "int" },
  { key: "lapplasning", name: "Läppläsning", attribute: "int" },
  { key: "lasa-skriva-sprak", name: "Läsa/Skriva språk", attribute: "int" },
  { key: "magisk-kanalisering", name: "Magisk kanalisering", attribute: "int" },
  { key: "massage", name: "Massage", attribute: "smi" },
  { key: "muta", name: "Muta", attribute: "kar" },
  { key: "malning", name: "Målning", attribute: "smi" },
  { key: "navigation", name: "Navigation", attribute: "int" },
  { key: "orientering", name: "Orientering", attribute: "int" },
  { key: "rakning", name: "Räkning", attribute: "int" },
  { key: "schack-bradspel", name: "Schack & Brädspel", attribute: "int" },
  { key: "simma", name: "Simma", attribute: "fys" },
  { key: "sjokunnighet", name: "Sjökunnighet", attribute: "int" },
  { key: "sjunga", name: "Sjunga", attribute: "kar" },
  { key: "skadespeleri", name: "Skådespeleri", attribute: "kar" },
  { key: "slagsmal", name: "Slagsmål", attribute: "sty" },
  { key: "smyga", name: "Smyga", attribute: "smi" },
  { key: "spela-instrument", name: "Spela instrument", attribute: "kar" },
  { key: "spa-vader", name: "Spå väder", attribute: "int" },
  { key: "sprakkunskap", name: "Språkkunskap", attribute: "int" },
  { key: "stavhopp", name: "Stavhopp", attribute: "smi" },
  { key: "stridskonster", name: "Stridskonster", attribute: "smi" },
  { key: "taktik", name: "Taktik", attribute: "int" },
  { key: "tala-sprak-kate-b", name: "Tala språk (Kate. B)", attribute: "int" },
  { key: "teckensprak", name: "Teckenspråk", attribute: "int" },
  { key: "trastav", name: "Trästav", attribute: "smi" },
  { key: "tva-vapen", name: "Två vapen", attribute: "smi" },
  { key: "undre-varlden", name: "Undre världen", attribute: "int" },
  { key: "vapenfardigheter", name: "Vapenfärdigheter", attribute: "smi" },
  { key: "zoologi", name: "Zoologi", attribute: "int" },
  { key: "anterhake", name: "Änterhake", attribute: "smi" },
  { key: "ortkunskap", name: "Örtkunskap", attribute: "int" },
  { key: "overlevnad", name: "Överlevnad", attribute: "int" }
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
// `baseOverride` (backlogpost 36, förmågan "Lättlärd") ersätter grundkostnaden
// för DEN HÄR aktören/beräkningen utan att röra DODE.skillCostTierBase globalt
// — se special-ability-effects.mjs för hur en costTierOverride-effekt hittas
// och skickas in här (training.mjs#describeRow, wizardens #skillPreview).
DODE.skillCost = function (costTier, fromFv, toFv, baseOverride) {
  const base = baseOverride ?? DODE.skillCostTierBase[costTier] ?? DODE.skillCostTierBase.sekundar;
  const from = DODE.skillCostCumulative[fromFv] ?? DODE.skillCostCumulative.at(-1);
  const to = DODE.skillCostCumulative[toFv] ?? DODE.skillCostCumulative.at(-1);
  return base * (to - from);
};

// Läser av en formaga-items costTierOverride-effekt (Lättlärd) för en given
// costTier — DODE.skillCost's 4:e parameter. Delad helper så training.mjs och
// wizardens kostnadsberäkning inte kan komma i otakt om logiken ändras.
DODE.skillCostOverrideFor = function (actor, costTier) {
  const formagor = actor?.items?.filter?.((i) => i.type === "formaga") ?? [];
  for (const item of formagor) {
    const eff = item.getFlag?.(game.system.id, "effect");
    if (eff?.type === "costTierOverride" && eff.tier === costTier) return eff.base;
  }
  return undefined;
};

// Grundegenskaper KÖPS — RP s.23 ("GRUNDEGENSKAPER"), inte ett slagsystem.
// ⚠ RÄTTELSE 2026-08-02 (Johans fynd): den kurerade REGLER_EGENSKAPER.md
// citerar "RP s.23-26" som källa för ett 3T6-slag, men RP s.23 självt är en
// uttalad köptabell — citatet blandar ihop RP med det äldre REG-systemets
// slagmetod (samma bok-mot-bok-konflikt som ARCHITECTURE_RULE_AUDIT.md redan
// flaggat på andra ställen). Se DESIGN_DECISIONS.md backlog. Tabellen nedan
// är transkriberad direkt ur PDF:en, inte ur den kurerade filen.
DODE.attributeBuyCumulative = {
  3: 0, 4: 1, 5: 2, 6: 3, 7: 5, 8: 7, 9: 9, 10: 10, 11: 11, 12: 12,
  13: 14, 14: 17, 15: 20, 16: 25, 17: 30, 18: 40
};
DODE.attributeBuyCost = function (fromValue, toValue) {
  const from = DODE.attributeBuyCumulative[fromValue] ?? 0;
  const to = DODE.attributeBuyCumulative[toValue] ?? DODE.attributeBuyCumulative[18];
  return to - from;
};

// STO köps som AVVIKELSE (delta) från rasens normalvärde (item-ras.mjs
// `stoRange.normal`), inte som ett fristående 3-18-värde — RP s.23 "STO".
// Positiv delta kostar BP; negativ delta GER BP tillbaka, uttryckt här som
// ett negativt "kumulativt kostnad"-tal så samma `to - from`-formel som
// DODE.attributeBuyCost fungerar rakt av utan specialfall.
DODE.stoBuyCumulative = {
  "-5": -7, "-4": -5, "-3": -3, "-2": -2, "-1": -1, "0": 0,
  "1": 2, "2": 4, "3": 6, "4": 8, "5": 10
};
DODE.stoBuyCost = function (fromDelta, toDelta) {
  const clamp = (d) => Math.max(-5, Math.min(5, d));
  const from = DODE.stoBuyCumulative[String(clamp(fromDelta))] ?? 0;
  const to = DODE.stoBuyCumulative[String(clamp(toDelta))] ?? 0;
  return to - from;
};

// EP-kostnad för magi — MAG s.13. Skiljer sig från DODE.skillCost på tre sätt
// och kan därför inte uttryckas med den:
//   1. Grundkostnaden kommer från MAGISKOLANS FV, inte från en kostnadskategori
//      (primär/yrkes/sekundär) — och gäller BÅDE när man höjer skolans eget FV
//      och när man höjer en enskild besvärjelses S-värde.
//   2. Skalningen är en trappa av multiplikatorer på FV-intervall, inte en
//      kumulativ C-tabell.
//   3. Skolan själv har en egen fast grundkostnad (5 EP/steg) som INTE följer
//      besvärjelsetabellen.
//
// ⚠ KÄLLKONFLIKT (hittad 2026-07-29, ej åtgärdad i Roll20-projektet): den
// kurerade `REGLER_FARDIGHETER.md` återger besvärjelsetabellen som
// 1-3:4, 4-6:6, 7-9:6 — med en dubblerad 6:a och utan 2:an. `MAGI.md` (MAG s.13)
// ger 2/4/6/8/10/12/14/16, en monoton följd som dessutom matchar RP s.30.
// Vi följer MAG s.13; REGLER_FARDIGHETER.md-tabellen bedöms vara en
// transkriberingsmiss (en rad har fallit bort och nästa dubblerats).
DODE.spellBaseCostBySchoolFv = [
  { max: 3, cost: 2 }, { max: 6, cost: 4 }, { max: 9, cost: 6 }, { max: 12, cost: 8 },
  { max: 15, cost: 10 }, { max: 18, cost: 12 }, { max: 21, cost: 14 }, { max: 24, cost: 16 }
];

// Multiplikatortrappa — MAG s.13. Gäller både skolans FV och besvärjelsers S.
// Över 20 ökar multipeln med +1 var tredje nivå ("Ytterligare +1 multiplikator
// var 3:e nivå").
DODE.magicCostMultiplier = function (schoolFv) {
  if (schoolFv <= 10) return 1;
  if (schoolFv <= 14) return 2;
  if (schoolFv <= 17) return 3;
  if (schoolFv <= 20) return 4;
  return 4 + Math.ceil((schoolFv - 20) / 3);
};

/** Grundkostnad per S-steg för en besvärjelse, given magikerns FV i skolan (MAG s.13). */
DODE.spellBaseCost = function (schoolFv) {
  for (const row of DODE.spellBaseCostBySchoolFv) if (schoolFv <= row.max) return row.cost;
  // Tabellen slutar vid 24; följden ökar med 2 per intervall om tre.
  const last = DODE.spellBaseCostBySchoolFv.at(-1);
  return last.cost + 2 * Math.ceil((schoolFv - last.max) / 3);
};

/**
 * EP för att höja en besvärjelses S-värde från `fromS` till `toS` (MAG s.13).
 *
 * ⚠ TVÅ OLIKA INDATA — lätt att blanda ihop, och bokens exempel avslöjar vilken
 * som är vilken:
 *   - **Grundkostnaden** kommer från magikerns FV i SKOLAN.
 *   - **Multipeln** kommer från BESVÄRJELSENS eget S-värde, steg för steg.
 *
 * Bokens exempel (MAG s.13), skolvärde 6 → grundkostnad 4:
 *   "S1 till S10 kostar 4 EP/steg = 40 EP"  — hela spannet ligger på S ≤ 10, ×1 → 4/steg
 *   "S10 till S14 kostar 8 EP/steg = 32 EP" — stegen till S11-14 ligger i ×2-bandet → 8/steg
 * Den andra halvan går bara ihop om multipeln följer S och inte skolans FV: skolans
 * FV är 6 i hela exemplet och skulle gett ×1 (4 EP/steg) rakt igenom.
 *
 * ⚠ Första halvan går ihop med 10 steg, inte 9 — boken skriver "från S1 till S10"
 * men räknar tio steg, alltså köpet av nivåerna 1-10 från noll. Vi räknar
 * differensen (`toS - fromS`): spellCost(6, 0, 10) = 40 stämmer med boken,
 * spellCost(6, 1, 10) = 36. Den andra halvan (10→14 = 32) stämmer exakt med
 * differensräkning, så det är formuleringen som är slarvig, inte regeln.
 */
DODE.spellCost = function (schoolFv, fromS, toS) {
  const base = DODE.spellBaseCost(schoolFv);
  let total = 0;
  for (let s = fromS; s < toS; s++) total += base * DODE.magicCostMultiplier(s + 1);
  return total;
};

/**
 * EP för att höja FV i en magiskola (MAG s.13). Fast grundkostnad 5 EP/steg,
 * samma multiplikatortrappa. Priset per steg ändras när man passerar en
 * intervallgräns, så vi summerar steg för steg i stället för att multiplicera.
 *
 * ⚠ Skolans FV kan ENDAST höjas genom TRÄNING (MAG s.23) — aldrig av EP intjänat
 * under äventyr. Den regeln lever i träningsfönstret, inte här.
 */
DODE.magicSchoolCost = function (fromFv, toFv) {
  let total = 0;
  for (let fv = fromFv; fv < toFv; fv++) total += 5 * DODE.magicCostMultiplier(fv + 1);
  return total;
};

// Är färdigheten en magiskola? Skolorna bor som vanliga `fardighet`-Items
// (se DODE.magicSchoolSkills ovan), så det är nyckelprefixet som skiljer dem.
DODE.isMagicSchoolKey = function (skillKey) {
  return typeof skillKey === "string" && skillKey.startsWith("magiskola-");
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

/**
 * Skadebonus från STY+STO — **Rollpersonen s.25**, verifierad ordagrant mot PDF-sidan
 * 2026-07-28 och identisk med Spelledarboken s.32 (samma tabell i båda böckerna).
 *
 * ⚠ RÄTTAD 2026-07-28. De tidigare värdena (≤12 −1T4 · ≤16 +0 · ≤24 +1T4 · ≤32 +1T6 ·
 * ≤40 +2T4 · ≤48 +2T6 · +3T6) fanns INTE i någon bok — de bar en egen
 * "bör verifieras"-flagga och visade sig vara fria extrapolationer. De hade både fel
 * brytpunkter och fel formler: ett −1T4-straff som regeln saknar, inga +1T2/+1T10, och
 * ett tak vid 48 trots att tabellen går till 180 (jättar). Se DESIGN_DECISIONS.md §3 31C.
 */
DODE.damageBonusTable = [
  { max: 26, formula: "+0" },
  { max: 29, formula: "+1" },
  { max: 32, formula: "+1d2" },
  { max: 40, formula: "+1d4" },
  { max: 50, formula: "+1d6" },
  { max: 60, formula: "+1d10" },
  { max: 80, formula: "+2d6" },
  { max: 100, formula: "+3d6" },
  { max: 140, formula: "+4d6" },
  { max: 180, formula: "+5d6" },
  { max: Infinity, formula: "+5d6" }
];

DODE.damageBonus = function (styPlusSto) {
  for (const row of DODE.damageBonusTable) {
    if (styPlusSto <= row.max) return row.formula;
  }
  return "+3d6";
};

/**
 * Förflyttning i rutor per stridsrunda — **Rollpersonen s.25**, verifierad mot PDF-sidan
 * 2026-07-28, identisk med Spelledarboken s.32. Uppslaget sker på **SUMMAN** STO+FYS+SMI.
 *
 * ⚠ RÄTTAD 2026-07-28. Koden slog tidigare upp (SMI+FYS+STO)/3 i en helt annan tabell
 * (≤4→5 … ≤24→15) som inte heller stod i någon bok. Både formeln och värdena var fel:
 * en rollperson med 12/12/12 fick 9 rutor i stället för 10, och skalorna divergerade
 * kraftigt i botten (medel 4 gav 5 rutor mot bokens 8). Se DESIGN_DECISIONS.md §3 31C.
 */
DODE.movementTable = [
  { max: 11, squares: 7 }, { max: 20, squares: 8 }, { max: 29, squares: 9 },
  { max: 38, squares: 10 }, { max: 47, squares: 11 }, { max: 56, squares: 12 },
  { max: 65, squares: 13 }, { max: 74, squares: 14 }, { max: 83, squares: 15 },
  { max: 92, squares: 16 }
];

/**
 * Rasmodifikationer på förflyttning — Rollpersonen s.25. Låg tidigare inte i koden alls.
 * Nyckeln är rasens namn i gemener; övriga raser ger ±0.
 */
DODE.movementRaceMod = { anka: -2, alv: 1, "dvärg": -2, "halvlängdsman": -2 };

DODE.movement = function (stoPlusFysPlusSmi) {
  for (const row of DODE.movementTable) {
    if (stoPlusFysPlusSmi <= row.max) return row.squares;
  }
  // "för varje ytterligare +8: +1" — Rollpersonen s.25
  return 16 + Math.ceil((stoPlusFysPlusSmi - 92) / 8);
};

/* -------------------------------------------------------------------------- */
/*  Kroppsbyggnad och träffområden — Rollpersonen s.48-50                      */
/* -------------------------------------------------------------------------- */

/**
 * ⚠ **Träffområdenas KP HÄRLEDS ur Totala KP** (RP s.48, Tabell 1-3). Det är
 * nyckeln till att kunna blanda vanlig och detaljerad strid: vilken varelse som
 * helst kan få en kropp i samma ögonblick som någon siktar på den, utan att
 * någonting behöver vara förberett i monsterposten.
 *
 * ⚠ **Under Totala KP 5 delas kroppen inte in i träffområden alls** — "Om Totala
 * KP är 1-4 delar man inte in kroppen i olika träffområden" (RP s.48). Riktade
 * anfall är alltså meningslösa mot mycket små varelser.
 *
 * ⚠ **Över 30 Totala KP: +1 på varje träffområde per 5 poäng.** RP s.24:s
 * `Kroppspoängstabell` skriver ut banden ända till 31-35 och 36-40 och anger
 * sedan "+5 → +1", vilket är samma sak. Verifierat: våra sex band plus regeln
 * ger identiska värden med bokens åtta utskrivna kolumner.
 *
 * ⚠ Totala KP självt är **(FYS+STO)/2, alltid uppåt** (RP s.24).
 */
DODE.hitLocationKpBands = [
  { max: 7, i: 0 }, { max: 11, i: 1 }, { max: 15, i: 2 },
  { max: 20, i: 3 }, { max: 25, i: 4 }, { max: 30, i: 5 }
];

/**
 * Kroppsbyggnader. `kp` är KP per träffområde för de sex Totala KP-banden ovan.
 * `hitA`/`hitB` är träfftabellerna (RP s.49-50, Tabell 4-7).
 *
 * ⚠ **KOLUMN A OCH B ÄR INTE SAMMA TÄRNING.** RP s.49: "Kolumn A används för
 * projektilvapen och närstridsanfall mot en motståndare som **inte försvarar
 * sig** (t.ex. vid anfall i ryggen). Kolumn B används mot motståndare som
 * **försvarar sig** i närstrid." För humanoider är A en 1T8 och B en 1T10 — en
 * försvarslös motståndare träffas alltså oftare i huvudet (1/8) än en som
 * försvarar sig (2/10), vilket är hela poängen med att smyga sig på någon.
 *
 * ⚠ **Bara fyra kroppsbyggnader finns i boken.** Humanoid, bevingad humanoid,
 * kentaur och svanmö. Fyrfotadjur, ormar och amorfa varelser saknas helt — se
 * DESIGN_DECISIONS.md backlogposten om kroppsbyggnader; de får inte hittas på
 * här utan ett uttalat beslut.
 */
DODE.bodyPlans = {
  humanoid: {
    label: "Humanoid",
    // RP s.48 Tabell 1 (delas med bevingad humanoid).
    kp: {
      "hoger-ben":    [3, 4, 5, 6, 7, 8],
      "vanster-ben":  [3, 4, 5, 6, 7, 8],
      mage:           [3, 4, 5, 6, 7, 8],
      brostkorg:      [4, 5, 6, 7, 8, 9],
      "hoger-arm":    [2, 3, 4, 5, 6, 7],
      "vanster-arm":  [2, 3, 4, 5, 6, 7],
      huvud:          [3, 4, 5, 6, 7, 8]
    },
    // RP s.49 Tabell 4.
    hitA: { die: "1d8", rows: [
      { max: 1, loc: "hoger-ben" }, { max: 2, loc: "vanster-ben" }, { max: 3, loc: "mage" },
      { max: 5, loc: "brostkorg" }, { max: 6, loc: "hoger-arm" }, { max: 7, loc: "vanster-arm" },
      { max: 8, loc: "huvud" }
    ] },
    hitB: { die: "1d10", rows: [
      { max: 1, loc: "hoger-ben" }, { max: 2, loc: "vanster-ben" }, { max: 3, loc: "mage" },
      { max: 4, loc: "brostkorg" }, { max: 6, loc: "hoger-arm" }, { max: 8, loc: "vanster-arm" },
      { max: 10, loc: "huvud" }
    ] }
  },

  // ⚠ **KONSTRUERAD KROPPSBYGGNAD — creator decision, Johan 2026-07-29.**
  // Böckerna har ingen fyrfotatabell. Johan: *"Kroppspoängtabell RP page 24 can
  // be used for quad pedals as well"* — KP-värdena är alltså bokens (samma
  // Kroppspoängstabell som humanoiden), medan **träfftabellen är påhittad**:
  // humanoidens två armar byts mot två extra ben, och bröstkorg+mage slås ihop
  // till en bål. Fördelningen speglar humanoidens (bålen störst, huvudet
  // minst). Ändra gärna — det här är en tolkning, inte en regel.
  fyrfota: {
    label: "Fyrfotadjur",
    kp: {
      "hoger-framben":  [2, 3, 4, 5, 6, 7],
      "vanster-framben":[2, 3, 4, 5, 6, 7],
      "hoger-bakben":   [3, 4, 5, 6, 7, 8],
      "vanster-bakben": [3, 4, 5, 6, 7, 8],
      kropp:            [4, 5, 6, 7, 8, 9],
      huvud:            [3, 4, 5, 6, 7, 8]
    },
    hitA: { die: "1d10", rows: [
      { max: 1, loc: "hoger-framben" }, { max: 2, loc: "vanster-framben" },
      { max: 3, loc: "hoger-bakben" }, { max: 4, loc: "vanster-bakben" },
      { max: 8, loc: "kropp" }, { max: 10, loc: "huvud" }
    ] },
    hitB: { die: "1d10", rows: [
      { max: 2, loc: "hoger-framben" }, { max: 4, loc: "vanster-framben" },
      { max: 5, loc: "hoger-bakben" }, { max: 6, loc: "vanster-bakben" },
      { max: 9, loc: "kropp" }, { max: 10, loc: "huvud" }
    ] }
  },

  "bevingad-humanoid": {
    label: "Bevingad humanoid",
    kp: {
      "hoger-ben":    [3, 4, 5, 6, 7, 8],
      "vanster-ben":  [3, 4, 5, 6, 7, 8],
      mage:           [3, 4, 5, 6, 7, 8],
      brostkorg:      [4, 5, 6, 7, 8, 9],
      "hoger-arm":    [2, 3, 4, 5, 6, 7],
      "vanster-arm":  [2, 3, 4, 5, 6, 7],
      huvud:          [3, 4, 5, 6, 7, 8],
      "hoger-vinge":  [2, 3, 4, 5, 6, 7],
      "vanster-vinge":[2, 3, 4, 5, 6, 7]
    },
    // RP s.49 Tabell 5. ⚠ Fotnot: "Om varelsen träffas i ryggen är 4 höger vinge
    // och 5 vänster vinge" — bröstkorgsträffen blir alltså vingträff bakifrån.
    hitA: { die: "1d10", rows: [
      { max: 1, loc: "hoger-ben" }, { max: 2, loc: "vanster-ben" }, { max: 3, loc: "mage" },
      { max: 5, loc: "brostkorg", fromBehind: { 4: "hoger-vinge", 5: "vanster-vinge" } },
      { max: 6, loc: "hoger-arm" }, { max: 7, loc: "vanster-arm" }, { max: 8, loc: "huvud" },
      { max: 9, loc: "hoger-vinge" }, { max: 10, loc: "vanster-vinge" }
    ] },
    hitB: { die: "1d10", rows: [
      { max: 1, loc: "hoger-ben" }, { max: 2, loc: "vanster-ben" }, { max: 3, loc: "mage" },
      { max: 4, loc: "brostkorg" }, { max: 6, loc: "hoger-arm" }, { max: 8, loc: "vanster-arm" },
      { max: 10, loc: "huvud" }
    ] }
  },

  kentaur: {
    label: "Kentaur",
    // RP s.48 Tabell 2. ⚠ Egna KP-band: 8-10, 11-15, 16-20, 21-25, 26-30 — fem
    // steg, inte sex, och de börjar högre än humanoidernas.
    kpBands: [{ max: 10, i: 0 }, { max: 15, i: 1 }, { max: 20, i: 2 }, { max: 25, i: 3 }, { max: 30, i: 4 }],
    kp: {
      "hoger-bakben":   [2, 3, 4, 5, 6],
      "vanster-bakben": [2, 3, 4, 5, 6],
      "hoger-framben":  [2, 3, 4, 5, 6],
      "vanster-framben":[2, 3, 4, 5, 6],
      hastkropp:        [8, 9, 10, 11, 12],
      manniskokropp:    [6, 7, 8, 9, 10],
      "hoger-arm":      [3, 4, 5, 6, 7],
      "vanster-arm":    [3, 4, 5, 6, 7],
      huvud:            [4, 5, 6, 7, 8]
    },
    // RP s.50 Tabell 6. ⚠ Fotnot: vilket ben som träffas beror på vilken sida
    // angriparen står — "Man kan inte träffa benen på motsatt sida."
    hitA: { die: "1d10", rows: [
      { max: 2, loc: "benen" }, { max: 5, loc: "hastkropp" }, { max: 7, loc: "manniskokropp" },
      { max: 8, loc: "hoger-arm" }, { max: 9, loc: "vanster-arm" }, { max: 10, loc: "huvud" }
    ] },
    hitB: { die: "1d10", rows: [
      { max: 2, loc: "benen" }, { max: 3, loc: "hastkropp" }, { max: 5, loc: "manniskokropp" },
      { max: 7, loc: "hoger-arm" }, { max: 9, loc: "vanster-arm" }, { max: 10, loc: "huvud" }
    ] }
  },

  svanmo: {
    label: "Svan(mö)",
    // RP s.48 Tabell 3. ⚠ Bara TVÅ band, och tabellen slutar vid 15 Totala KP.
    kpBands: [{ max: 10, i: 0 }, { max: 15, i: 1 }],
    kp: {
      kropp:          [5, 6],
      "hoger-vinge":  [4, 5],
      "vanster-vinge":[4, 5],
      "huvud-hals":   [3, 4]
    },
    // RP s.50 Tabell 7. ⚠ En enda kolumn: "A+B" — försvar spelar ingen roll.
    hitA: { die: "1d8", rows: [
      { max: 3, loc: "kropp" }, { max: 5, loc: "hoger-vinge" },
      { max: 7, loc: "vanster-vinge" }, { max: 8, loc: "huvud-hals" }
    ] },
    hitB: { die: "1d8", rows: [
      { max: 3, loc: "kropp" }, { max: 5, loc: "hoger-vinge" },
      { max: 7, loc: "vanster-vinge" }, { max: 8, loc: "huvud-hals" }
    ] }
  }
};

/** Visningsnamn per träffområdesnyckel. */
DODE.hitLocations = {
  "hoger-ben": "Höger ben", "vanster-ben": "Vänster ben", mage: "Mage",
  brostkorg: "Bröstkorg", "hoger-arm": "Höger arm", "vanster-arm": "Vänster arm",
  huvud: "Huvud", "hoger-vinge": "Höger vinge", "vanster-vinge": "Vänster vinge",
  "hoger-bakben": "Höger bakben", "vanster-bakben": "Vänster bakben",
  "hoger-framben": "Höger framben", "vanster-framben": "Vänster framben",
  hastkropp: "Hästkropp", manniskokropp: "Människokropp", benen: "Benen",
  kropp: "Kropp", "huvud-hals": "Huvud & hals"
};

/**
 * Träffområdenas KP för en varelse med givna Totala KP (RP s.48).
 *
 * ⚠ Returnerar `null` under 5 Totala KP — boken delar då inte in kroppen alls.
 * ⚠ Över tabellens sista band läggs **+1 per påbörjade 5 KP** på varje område.
 */
DODE.hitLocationKp = function (bodyPlanKey, totalKp) {
  const plan = DODE.bodyPlans[bodyPlanKey];
  if (!plan) return null;
  const bands = plan.kpBands ?? DODE.hitLocationKpBands;
  const first = bands[0];
  // Under första bandets undre gräns finns ingen indelning (RP s.48).
  if (totalKp < 5) return null;

  const last = bands[bands.length - 1];
  let index = bands.findIndex((b) => totalKp <= b.max);
  let bonus = 0;
  if (index === -1) {
    index = bands.length - 1;
    bonus = Math.ceil((totalKp - last.max) / 5);
  }
  // Under kentaur-/svantabellernas start används första bandet rakt av.
  if (totalKp <= first.max) index = 0;

  const out = {};
  for (const [loc, values] of Object.entries(plan.kp)) {
    out[loc] = values[index] + bonus;
  }
  return out;
};

/**
 * Slår fram vilket träffområde som träffas.
 *
 * ⚠ `defending` styr VILKEN TÄRNING som slås, inte bara tabellen — RP s.49:
 * kolumn A för projektilvapen och mot någon som inte försvarar sig, kolumn B mot
 * någon som försvarar sig i närstrid. En försvarslös humanoid träffas i huvudet
 * på 1/8, en försvarande på 2/10.
 */
DODE.rollHitLocation = async function (bodyPlanKey, { defending = true, fromBehind = false } = {}) {
  const plan = DODE.bodyPlans[bodyPlanKey] ?? DODE.bodyPlans.humanoid;
  const table = defending ? plan.hitB : plan.hitA;
  const roll = await new Roll(table.die).evaluate();
  const row = table.rows.find((r) => roll.total <= r.max) ?? table.rows[table.rows.length - 1];
  const location = (fromBehind && row.fromBehind?.[roll.total]) || row.loc;
  return { roll, location, label: DODE.hitLocations[location] ?? location, column: defending ? "B" : "A" };
};

/* -------------------------------------------------------------------------- */
/*  Svärdshand — Rollpersonen s.27                                             */
/* -------------------------------------------------------------------------- */

/**
 * ⚠ **Egen rollpersonsegenskap som saknades helt i systemet** (upptäckt via
 * Johans fotografi av RP s.27, 2026-07-29).
 *
 * "Den hand som du normalt använder (högerhanden för en högerhänt person) kommer
 * hädanefter alltid att kallas för **svärdshand**, medan den aviga handen kallas
 * **sköldhand**."
 *
 * ⚠ **Detta är förklaringen till sköldhandens −10 CL** (SLB s.17):
 * "Sköldhanden är genomgående sämre än svärdshanden, **utom för färdigheterna
 * Två vapen och Sköld**." Straffet gäller alltså all avig-handsanvändning — och
 * upphävs inte av att man håller två vapen i sig, utan av att man använder just
 * färdigheterna *Två vapen* eller *Sköld*.
 *
 * Slås med **2T6 + antalet BP man väljer att lägga på det** (+1 per BP).
 */
DODE.swordHandTable = [
  { max: 11, key: "hoger", label: "Höger" },
  { max: 14, key: "vanster", label: "Vänster" },
  { max: 18, key: "dubbelhant", label: "Dubbelhänt" },
  { max: Infinity, key: "ambidextrios", label: "Ambidextriös" }
];

/**
 * ⚠ **Dubbelhänt och ambidextriös är INTE samma sak** — RP s.27:
 *  - **Dubbelhänt:** "kan använda högerhanden och vänsterhanden lika bra,
 *    **dock inte samtidigt**."
 *  - **Ambidextriös:** kan använda "bägge händerna **samtidigt** till olika saker
 *    utan att ha några som helst problem. Du kan t.ex. skriva två olika saker
 *    samtidigt."
 *
 * Ambidextriös är alltså inte en stridsförmåga utan en generell samtidighet —
 * stridsvinsten är en följd, inte definitionen.
 */
DODE.swordHands = {
  hoger: "Höger", vanster: "Vänster",
  dubbelhant: "Dubbelhänt", ambidextrios: "Ambidextriös"
};

/** Har rollpersonen ingen sämre hand alls? Gäller dubbelhänt och ambidextriös. */
DODE.hasNoOffHandPenalty = function (swordHand) {
  return swordHand === "dubbelhant" || swordHand === "ambidextrios";
};

/** 2T6+BP → svärdshand (RP s.27). ⚠ Behövs inte om förmågan fåtts som särskild förmåga. */
DODE.swordHandFromRoll = function (total) {
  return DODE.swordHandTable.find((r) => total <= r.max);
};

/** Stridsrundans längd i sekunder — SLB s.15: "ungefär fem sekunder". */
DODE.SECONDS_PER_ROUND = 5;

/** Vanliga tidssteg för SL:s tidsfönster, i sekunder. Se DESIGN_DECISIONS.md §10. */
//
// ⚠ Johan 2026-07-29: *"Day/week/month button will likely suffice."* Kortare steg
// finns i fritextfältet, men behövs sällan — **äventyrstid mäts i stridsrundor**
// (5 s styck) och nedtid i dygn eller mer. Mellanskalan hade mest varit brus.
DODE.timeSteps = [
  { label: "1 dygn", seconds: 86400 },
  // ⚠ En vecka är den enhet som faktiskt betyder något: viloperioden öppnar
  // träningen (RP s.63) och naturlig läkning ger 1 KP per vecka (SLB s.20).
  { label: "1 vecka", seconds: 604800 },
  { label: "1 månad", seconds: 2592000 }
];

/**
 * Förbrukning som SL bör påminnas om när tid passerar.
 *
 * ⚠ **Ingen automatik — medvetet.** Johan 2026-07-29: *"Over days I think a note
 * to GM to request removal of supplies will suffice."* Böckerna ger ingen
 * dagsranson eller förbrukningstakt (letat i UTRUSTNING.md), så att dra föremål
 * automatiskt vore att hitta på en regel. Påminnelsen står i chattkortet i
 * stället, och SL drar det som faktiskt förbrukats.
 *
 * ⚠ **Facklor och lampolja är den verkliga bokföringen**, och de brinner i
 * ÄVENTYRSTID (minuter), inte i dygn — de hör alltså till stridsrundeklockan och
 * inte till det här fönstret. Se backlogposten om ljuskällor.
 */
DODE.supplyReminder = "⚠ Dra av förbrukning: proviant, vatten, facklor och lampolja.";
