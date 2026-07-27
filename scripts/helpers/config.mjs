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
  attribute: "int"
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
DODE.specialAbilitiesTable = [
  { range: [3, 4], name: "", description: "+1 på FV på valfri sekundär färdighet (utom förbjudna)" },
  { range: [5, 6], name: "Sjöfararbakgrund", description: "+2 FV i Sjökunnighet och Navigera" },
  { range: [7, 8], name: "Starka vrister", description: "+3 på FV i Hoppa" },
  { range: [9, 10], name: "Bråkig uppväxt", description: "+3 på FV i Slagsmål" },
  { range: [11, 12], name: "Hantverkarbakgrund", description: "+3 FV i valfri hantverksfärdighet" },
  { range: [13, 14], name: "Smidig kropp", description: "+3 FV i Akrobatik" },
  { range: [15, 16], name: "Köpmannabakgrund", description: "+3 FV i Värdera" },
  { range: [17, 18], name: "God koordinationsförmåga", description: "+3 FV i Två vapen" },
  { range: [19, 20], name: "Hobbyist", description: "FV 3 i valfri sekundär färdighet du kan lära från början" },
  { range: [21, 22], name: "Starka nypor", description: "Alltid +3 på CL i Klättra" },
  { range: [23, 24], name: "Mottagligt medium", description: "Alltid +5 CL i Magisk kanalisering (passiv)" },
  { range: [25, 26], name: "Hängiven student", description: "+2 på valfritt FV; om FV-begränsning finns höjs den med 2" },
  { range: [27, 28], name: "Övertygande tonfall", description: "Alltid +3 CL i Övertala och Muta" },
  { range: [29, 30], name: "Sjätte sinne", description: "+1 på dina FV i Upptäcka fara och Finna dolda ting" },
  { range: [31, 32], name: "Stirrande blick", description: "Alltid +5 CL i Hypnotisera" },
  { range: [33, 34], name: "Magikänsla", description: "Alltid +5 CL i Känna magi" },
  { range: [35, 36], name: "Gott språksinne", description: "Automatiskt FV 20 (B5) i Tala och Läsa/Skriva ett valfritt språk" },
  { range: [37, 38], name: "Stort kunskapsområde", description: "Två ytterligare valfria sekundära färdigheter som yrkesfärdigheter" },
  { range: [39, 40], name: "God bågskytt", description: "Alla räckvidder för projektilvapen ökas med 25%" },
  { range: [41, 42], name: "Absolut gehör", description: "Grundkostnaden för Spela instrument och Sjunga är alltid 1" },
  { range: [43, 44], name: "Precisionssinne", description: "+1 CL på alla vapenfärdigheter" },
  { range: [45, 46], name: "Dubbelhänt", description: "Se rubriken \"Svärdshand\"" },
  { range: [47, 48], name: "God tidskänsla", description: "Mycket god känsla för tidens gång; vet alltid på 10 min när" },
  { range: [49, 51], name: "Absolut ögonmått", description: "Bedöma avstånd med 5% felmarginal" },
  { range: [52, 54], name: "Mycket uppmärksam", description: "Alltid +2 CL i Finna dolda ting och Upptäcka fara" },
  { range: [55, 55], name: "Blixtsnabba reflexer", description: "+3 på alla initiativslag" },
  { range: [56, 56], name: "Bärsärk", description: "+5 på ditt FV i Bärsärkagång" },
  { range: [57, 57], name: "Gott balanssinne", description: "+5 på SMI vid balansakter och landning efter fall" },
  { range: [58, 58], name: "Hästarnas herre", description: "+10 på FV i Rida; kan aldrig bli avkastad (men kan trilla av)" },
  { range: [59, 59], name: "Ambidextriös", description: "Se rubriken \"Svärdshand\"" },
  { range: [60, 60], name: "Djurvän", description: "Blir aldrig angripen av vanliga djur" },
  { range: [61, 61], name: "Turgubbe", description: "Kan alltid modifiera CL med +1 genom att spendera 1 PSY-poäng" },
  { range: [62, 62], name: "Magisk empati", description: "Med PSY kan du övervinna effektgrader lagrade i magiska föremål och identifiera besvärjelser" },
  { range: [63, 63], name: "Gudarnas gunstling", description: "Varje gång dina KP når noll: 25% chans att en gud griper in och återställer alla KP. Kritiska skador kan ej läkas på detta sätt" },
  { range: [64, 64], name: "Lättlärd", description: "Grundkostnaden för sekundära färdigheter minskas till 4" },
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
