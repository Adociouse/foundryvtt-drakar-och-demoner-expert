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
  // ⚠ RÄTTAD 2026-08-22: nyckeln "mb2" hade fel label ("Monsterboxen II —
  // De humanoida raserna") trots att nyckeln själv antyder "Monsterboken 2" —
  // två helt olika böcker. Grep bekräftade 0 källposter använde "mb2" innan
  // rättelsen, så ingen befintlig data behövde migreras. mbx2/mbx4 är de
  // riktiga Monsterboxen-nycklarna, konsekvent med mb1/mb2 = Monsterboken-serien.
  mb2:         { label: "Monsterboken 2", short: "MB2" },
  mbx2:        { label: "Monsterboxen II — De humanoida raserna", short: "MBX2" },
  mbx4:        { label: "Monsterboxen IV — Legendariska varelser", short: "MBX4" },
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
 * Tolkar `system.priceNote` (Magi-regelbokens s.43-48-import, backlog 41) —
 * poster utan ett rent styckpris fick i stället en fritextnot som "20 sm/g",
 * "320 gm/dos", "4 per kagge". Johan 2026-08-08: dessa är i grunden köpbara
 * — "en köpbar/brukbar mängd-entitet" — de saknade bara ett UI för att välja
 * MÄNGD. Matchar `<tal> [myntslag]/<enhet>` eller `<tal> per <enhet>`.
 *
 * Returnerar `null` för notar som INTE är ett mängdpris (t.ex. "×0,5"/"×10"
 * på ridjursraderna Otämjd/Stridstränad — de är prismultiplikatorer på ett
 * ANNAT föremåls grundpris, inte en egen köpbar mängd, och ska förbli
 * "Referens"-märkta i guiden).
 *
 * @returns {{amountPerUnit:number, currency:string, unitLabel:string}|null}
 */
DODE.parsePriceNote = function (priceNote, fallbackCurrency = "sm") {
  const match = String(priceNote ?? "").match(/^(\d+(?:[.,]\d+)?)\s*(km|sm|gm)?\s*(?:\/|per)\s*(\S+)$/i);
  if (!match) return null;
  const [, amountStr, currency, unitLabel] = match;
  return {
    amountPerUnit: Number(amountStr.replace(",", ".")),
    currency: currency ?? fallbackCurrency,
    unitLabel
  };
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
// Source: HH s.6 ("Hur du skapar en hjälte", Bakgrundspoäng), ordagrant: "De
// extra bakgrundspoängen man får här läggs till de 125 man normalt får." —
// alltså flat 125 för alla fyra nivåer, all skillnad mellan nivåerna kommer
// från hjältedådstabellens tärningsslag (DODE.hjaltedadTable/hjaltedadCountHouseRule),
// aldrig ur ett eget grundtal per nivå. Gudafödd (fjärde nivån) är själva
// projektets egen extrapolering av HH:s tre bok-nivåer (Slumpens/Sanna/
// Gudafödda hjältar, s.4-5) till en fjärde, mer implementerbar mekanisk
// skiktning — inte ett fjärde bok-nivå-namn.
//
// ⚠ BESLUT (Johan, 2026-08-18, docs/DESIGN_DECISIONS.md backlog 4): Alver-
// supplementet s.22 ("Hur du skapar en alv") har en EGEN nivåtabell
// (Vanlig/Extraordinär/Hjälte = 125/150/175 BP, plus egna EP/Max FV-tal utan
// åldersdimension) som tidigare flaggades som en möjlig konkurrerande källa
// för de här talen. Boken själv kallar den uttryckligen "regelförslag...
// specifikt [för] skapandet av en alv" (INTE ett obligatoriskt ersättande
// system) — Johans beslut: BP och hjältepoäng är SAMMA system för alla raser,
// inklusive alver. Alver s.22:s tabell är en inspirationskälla, inte en
// mekanisk override. Ingen kodändring krävdes — denna flata 125-tabell var
// redan korrekt implementerad, bara odokumenterad som ett medvetet beslut i
// stället för en öppen fråga. Samma beslut: ålderskategorins EP-skalning
// (DODE.epBudgetTable) förblir oförändrad för alla raser inkl. alver — ingen
// separat "längre livslängd ger mer EP"-mekanik läggs till (osourcad, och
// ålderskategorivalet ger redan samma spak till alla raser).
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

/**
 * REGEL (Johan 2026-08-02, se DESIGN_DECISIONS.md §6): varje kodställe som
 * postar en `ChatMessage` med `rolls` och sedan omedelbart avslöjar UTFALLET
 * i eget UI (ett state-fält, en sheet-uppdatering, en knapp som byter text)
 * MÅSTE `await` den här helpern mellan `ChatMessage.create()`/`Roll#toMessage()`
 * och den avslöjande koden. `ChatMessage.create()` löser ut så fort
 * meddelandet finns i databasen — INTE när Dice So Nice faktiskt hunnit
 * animera klart (~2s) — så utan denna väntan hinner spelaren se resultatet
 * innan tärningarna visuellt landat. Upptäckt och rättat först för
 * hjältedåd (character-wizard.mjs), sedan bekräftat som samma bugg på
 * svärdshanden — se den raden i DESIGN_DECISIONS.md för hela utredningen,
 * inklusive VARFÖR den kapslas i en 4s timeout (en bakgrundsflik pausar
 * DSN:s renderloop helt, så själva DSN-löftet kan hänga för evigt annars).
 * No-op om DSN inte är installerat.
 */
DODE.waitForDiceAnimation = async function (message) {
  if (!game.dice3d || !message?.id) return;
  await Promise.race([
    game.dice3d.waitFor3DAnimationByMessageID(message.id),
    new Promise((resolve) => setTimeout(resolve, 4000))
  ]);
};

// Source: HH p.6 — "En nyskapad hjälte får slå 1T6 slag på tabellen"
DODE.hjaltedadRollCount = "1T6";

// Source: HH p.6-7, Hjältedådstabell (1T20)
// Hero creation: roll 1T6 to determine how many times to roll on this table.
// Each roll adds the listed bonus BP AND bonus hjältepoäng to the hero's base
// 125 BP. Player may choose freely instead of rolling (HH p.6: "eller välja
// det man tycker passar bäst").
//
// ⚠ RÄTTAT 2026-08-02 (Johan): tabellens andra tal är HJÄLTEPOÄNG (HH s.20/
// 46-48 — spenderas post-creation på ett 1T20-slag mot en separat 18-radig
// hjälteförmågetabell, inte byggd än, se DESIGN_DECISIONS.md), INTE kroppspoäng.
// Boken skriver ut kolumnen som "HP" i de flesta raderna men som fulla ordet
// "hjältepoäng" i två (Torneringsseger, Segerherre) — SAMMA storhet, bara
// inkonsekvent förkortad i originaltexten (H·jälte-P·oäng, inte "hit points").
// Fältet hette tidigare `bonusHP` och laddades felaktigt rakt in i
// `system.hp.max` (kroppspoäng) — spelets EGEN förkortning för kroppspoäng är
// `KP`, aldrig `HP`, vilket var den tydliga tråden till felet. Döpt om till
// `bonusHjaltepoang` och kopplat till det nya `system.hjaltepoang`-fältet
// (ackumulerad pool, se actor-character.mjs) i stället för `hp.max`.
// `description` (tillagd 2026-08-02) är radens fulla flavour-text ur boken,
// transkriberad direkt ur PDF:en (s.7) — utan den avslutande BP/hjältepoäng-
// meningen, som visas separat via bonusBP/bonusHjaltepoang. Syns i guidens
// resultatlista OCH på den skapade rollpersonens rollformulär (se
// #onRollHjaltedad/state.hjaltedadAbilities i character-wizard.mjs).
DODE.hjaltedadTable = [
  { range: [1,3],   name: "Torneringsseger",    bonusBP: 15,        bonusHjaltepoang: 5,        notes: "",
    description: "Hjälten har vunnit minst en stor tornering (över 500 deltagare)." },
  { range: [4,5],   name: "Duell",              bonusBP: "1T10+10", bonusHjaltepoang: "1T10",   notes: "",
    description: "Hjälten har besegrat en annan hjälte i duell någon gång under sin karriär. Kanske var det fiendernas härförare som han utmanade på envig eller en mäktig mörkerhjälte eller någon annan känd hjälte." },
  { range: [6,7],   name: "Monsterbane",        bonusBP: "1T10+10", bonusHjaltepoang: "1T10",   notes: "",
    description: "Hjälten har under sin bana som äventyrare mött och nedkämpat ett fruktansvärt monster, dock inte någon unik varelse. Kanske en vampyr, varulv, ganska kraftig demon eller något liknande, men som ändå blivit vida känt. Förmodligen har hans hjältedåd gett honom ett epitet som Varulvsbane, Demondräparen, el. dyl." },
  { range: [8,9],   name: "Korsfarare",         bonusBP: 20,        bonusHjaltepoang: 10,       notes: "",
    description: "Hjälten har lett styrkor som, eller har ensam, nedkämpat och bränt städer, tempel och borgar i främmande riken. Han är en krigsveteran med ett stort rykte och kommer att omnämnas i historieböckerna." },
  { range: [10,11], name: "Upptäcktsresande",   bonusBP: 20,        bonusHjaltepoang: 10,       notes: "",
    description: "Hjälten har vid ett otal tillfällen varit på platser okända för den vanliga befolkningen. Det är mycket möjligt att han har upptäckt en ny kontinent eller ett nytt land. Kanske har han varit den förste att bestiga ett mytomspunnet berg eller forcera de mörka skogarna i öster." },
  { range: [12,13], name: "Monsterbane (stor)", bonusBP: "1T20+10", bonusHjaltepoang: "1T10+5", notes: "",
    description: "Hjälten har stått öga mot öga med en av de farligaste varelser som finns och gått segrande ur kraftmätningen. Kanske var det en svart hämnare eller en mycket kraftfull demon." },
  { range: [14,14], name: "Gravplundrare",      bonusBP: 20,        bonusHjaltepoang: 10,       notes: "+10 Startkapital",
    description: "Hjälten var den som lyckades ta sig in i en uråldrig konungagrav som alla trodde existerade enbart i legenderna (jfr. Tutanchamon). Där hittade han gott om guldmynt och annat som gjorde att han har kunnat leva gott sedan dess." },
  { range: [15,15], name: "Vapenbärare",        bonusBP: 25,        bonusHjaltepoang: 0,        notes: "Magiskt vapen",
    description: "Hjälten är ägaren till ett mycket känt magiskt vapen eller annat mäktigt föremål. Vapnets historia och exakta krafter avgörs av SL i samråd med spelaren. Hur hjälten fått tag i vapnet varierar kanske genom duell eller på äventyr." },
  { range: [16,16], name: "Rövare",             bonusBP: 20,        bonusHjaltepoang: 10,       notes: "+10 Startkapital",
    description: "Hjälten lyckades ensam eller tillsammans med några kumpaner stjäla ett farligt monsters (drake eller liknande) skatt utan att döda monstret. Visserligen har detta gett dem en farlig fiende, men också ganska gott om pengar." },
  { range: [17,17], name: "Segerherre",         bonusBP: 30,        bonusHjaltepoang: 15,       notes: "",
    description: "Hjälten var ansvarig för att ett stort hot mot fosterlandet avvärjdes. Kanske gjorde han det genom att i lönndom sänka fiendens invasionsflotta eller lockade deras huvudstyrka i ett bakhåll." },
  { range: [18,18], name: "Drakdödare",         bonusBP: 35,        bonusHjaltepoang: 20,       notes: "",
    description: "Hjälten är en av de få personer i Drakar och Demoners värld som kan titulera sig ”drakdödare”, eftersom han, troligtvis ensam, lyckades nedgöra en drake, en av skapelsens härskare och väktare." },
  { range: [19,19], name: "Räddaren i nöden",   bonusBP: 30,        bonusHjaltepoang: 10,       notes: "",
    description: "Någon gång under sin hjältebana har hjälten räddat kungen i sitt hemland eller någon annan extremt mäktig person undan döden, kanske prinsessan eller drottningen. Den vars liv hjälten räddade står i evig tacksamhetsskuld till honom." },
  { range: [20,20], name: "SL Special",         bonusBP: 50,        bonusHjaltepoang: 35,       notes: "SL bestämmer",
    description: "SL får göra sitt bästa för att hitta på något extra heroiskt värt att nedteckna i rullorna." },
];

// Källtaggen som skiljer hjältedåd-genererade specialAbilities-rader (se
// state.hjaltedadAbilities i character-wizard.mjs) från vanliga, fritt
// tillagda/framslagna särskilda förmågor — så guidens formagor-steg (som
// synkar sitt EGET fasta antal slots mot DODE.abilityRollsByNiva) aldrig
// blandar ihop de två och råkar trunkera hjältedåden vid nivåbyte.
DODE.hjaltedadAbilitySource = "Hjältedåd (HH s.6-7)";

// ⚠ HUSREGEL, INTE HH:s tryckta regel — se `hjaltedadTieredRollCount`-
// inställningen i dode.mjs för hela motiveringen (Johan, 2026-08-07). HH
// s.6-7 säger bara "slå 1T6" för hur många gånger man slår på
// DODE.hjaltedadTable, samma formel oavsett om man är Slumpens hjälte, Sann
// hjälte eller Gudafödd. Den här tabellen är den ALTERNATIVA, nivåstyrda
// formeln som `#onRollHjaltedadCount` (character-wizard.mjs) använder i
// stället för "1d6", men BARA om SL slagit på inställningen — annars
// används alltid det tryckta 1T6:et. Formlerna är Johans egna påhitt för sin
// kampanj, inte källbelagda — därför en egen tabell, inte en "rättelse" av
// hjaltedadTable ovan.
DODE.hjaltedadCountHouseRule = {
  "slumpens-hjalte": "1d2",
  "sann-hjalte": "2+1d2",
  gudafodd: "4+1d2"
};

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
  { range: [73, 73], name: "Gott läkekött", description: "KP-förluster av fysiskt våld eller elementarbesvärjelser läker dubbelt så fort",
    effect: { type: "recoveryModifier", resource: "hp", operation: "multiply", value: 2 } },
  // ⚠ "Ej för icke-magiker (räknas som resultat 73)" i beskrivningen ovan är
  // INTE hanterat av effekten här — resolveGrants/applyResolvedAbility
  // (special-ability-effects.mjs) har ingen aktörsmedveten substitutionslogik
  // som byter ut en förmåga mot en annan beroende på yrkets magic.access.
  // En icke-magiker som slår 74 får i dagsläget den här PSY-effekten rakt av
  // (ofarligt no-op — se AATERHAMTNING_ANVANDNINGSFALL.md UC-R9 — psy.max är 0
  // för en icke-magiker, så multipliceringen ger fortfarande 0 återvunnet),
  // snarare än att tyst bli Gott läkekött. Flaggat, inte byggt.
  { range: [74, 74], name: "God mental kontroll", description: "Återfår PSY-poäng förbrukade av besvärjelser på halva tiden. Ej för icke-magiker (räknas som resultat 73)",
    effect: { type: "recoveryModifier", resource: "psy", operation: "multiply", value: 2 } },
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

// Livsmål — REG s.12-14 "Bestäm rollpersonens livsmål" (21 poster, namn +
// ordagrann bokbeskrivning). Namnen kom ursprungligen från CHARACTERMANCER-
// WORKFLOW.md ("Expert Regler"); beskrivningarna transkriberade direkt ur
// PDF:en 2026-08-16 (Johan: "livsmål probably need to have a sub table
// explaining the contents, otherwise its hard to understand") eftersom
// rå-textextraktet har svår tvåspaltsbleed på just det avsnittet — se kurerad
// källa docs/extracts/DODE_Regler_LIVSMAL.md (Roll20-projektet).
// Guiden erbjuder dessa i en dropdown + fritextalternativ ("Annat") — se
// character-wizard.mjs "livsmal"-steget.
DODE.lifeGoals = [
  { name: "Anarkism", description: "All form av statsmakt är förkastlig och måste krossas. Staten förtrycker alltid medborgarna." },
  { name: "Berömmelse", description: "Stora och berömda namn bevaras till eftervärlden. De svaga och betydelselösa glöms snabbt bort." },
  { name: "Den starkes rätt", description: "De starka och dugliga har rätt, de svaga och odugliga har fel." },
  { name: "Egoism", description: "Jag är viktigast och bäst, och endast mina intressen spelar någon roll för mig." },
  { name: "Finess", description: "Alla handlingar ska utföras med stil och finess. Att göra någonting på ett klumpigt eller smaklöst sätt är förkastligt." },
  { name: "Frihet", description: "Var människa bestämmer över sig själv, och blandar sig inte oombedd i andras affärer." },
  { name: "Harmoni & Barmhärtighet", description: "Hjälp de svaga och behövande. Sträva efter fred och ordning." },
  { name: "Jämlikhet", description: "Alla intelligenta varelser har samma värde." },
  { name: "Kärlek", description: "Sök efter den stora kärleken i livet. När du har funnit honom eller henne, håll fast vid den personen för allt vad du är värd." },
  { name: "Konservatism", description: "Det som är gammalt och välbeprövat är gott. Nya påfund medför förändringar och instabilitet." },
  { name: "Kunskap", description: "Den som är vis kan utnyttja sin kunskap till nyttiga saker." },
  { name: "Lag & Ordning", description: "Lagar och förordningar är gjorda för att efterlevas till punkt och pricka. Den som bryter mot dem hotar samhället." },
  { name: "Makt", description: "Makt är viktigt, för med dess hjälp kan man förändra omvärlden till att bli sådan som man vill ha den. Godhjärtade mäktiga personer tänker förändra världen på ett sätt som gagnar alla; hårdhjärtade tänker mindre på hur makten drabbar andra." },
  { name: "Naturvän", description: "Naturen är vår moder och hon måste beskyddas mot missbruk och exploatering." },
  { name: "Ridderlighet", description: "Det traditionella västerländska riddaridealet (höviskhet, ärlighet, rättvisa, barmhärtighet, sportslighet) utgör det goda samhällets ryggrad." },
  { name: "Rikedom", description: "Med pengar når man sina mål. Pengarna är det viktigaste redskapet när man försöker göra något." },
  { name: "Rättvisa–Hämnd", description: "Rättvisa ska eftersträvas enligt principen öga för öga, tand för tand. På detta sätt kan man avskräcka folk från att skada andra." },
  { name: "Skämt", description: "Livet är ett skämt, så varför inte skratta åt det." },
  { name: "Stolthet", description: "Låt ingen befläcka din heder och ära på något sätt." },
  { name: "Stridsära", description: "Sann ära vinner man genom djärvhet i strid." },
  { name: "Upptäckarlust", description: "Det finns alltid spännande och okända saker som väntar runt hörnet." }
];

// Hantverk — EJ en sluten katalog (till skillnad från vapen/språk finns ingen
// uttömmande hantverkslista i grundreglerna, "Hantverkarbakgrund"/sekundär
// "Hantverk"-poolen är uttryckligen "valfri hantverksfärdighet"). De här är
// bara EXEMPEL, sourcade av Johan 2026-08-16 ur olika äventyr/världsböcker,
// för att ge en `<datalist>`-förslagslista i stället för ett tomt fritextfält
// — spelaren kan alltid skriva något annat, fältet förblir fritext.
// Smide/Snickeri/Stenslipning/Bokbinderi/Skomakeri: grundreglernas egna
// exempel på hantverkstyper. Sadelmakare/Gobelängvävare: Kandra (Ereb Altor-
// världsmaterial). Träsnideri och Gravyr, Magiskt material: Monster och Män
// (Gothmog), byborna i dalen under Zvuldos magiakademi. Skeppsbyggnad
// (Fartyg): Ereb Altor — Spelledarboken, dalkernas exportvara på Caddo.
// Bronsgjutarkonst: Ereb Altor — Kampanjboken, Golwyndakulturen.
DODE.craftSuggestions = [
  "Smide", "Snickeri", "Stenslipning", "Bokbinderi", "Skomakeri",
  "Sadelmakare", "Gobelängvävare", "Träsnideri och Gravyr",
  "Magiskt material", "Skeppsbyggnad (Fartyg)", "Bronsgjutarkonst"
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

/**
 * Vapengrupper — RP s.60 ("VAPENFÄRDIGHETER — Vapengrupper"), cross-referenced
 * mot SB s.34-35:s fullständiga 52-vapentabell (Spelarboken, Gothmog-scan
 * 2026-08-04). Varje vapen är en EGEN färdighet (inte gruppen som köps en gång
 * — se DESIGN_DECISIONS.md backlogpost 44, korrigerad: RP:s egen text säger
 * uttryckligen "Varje vapen är en separat färdighet", inte "köp gruppen").
 * Det gruppen ger är i stället automatisk deltäckning: känner man ETT vapen i
 * en grupp väl får man minst hälften (avrundat nedåt) av det högsta FV:t i
 * ALLA andra vapen i samma grupp — se #computeWeaponGroupBonus i
 * actor-character.mjs.
 *
 * ⚠ Ett fåtal medlemmar är inte uttryckligen namngivna av RP:s egen (icke
 * uttömmande) "urval"-lista utan placerade efter vapnets form/STY-krav i
 * SB:s tabell — flaggade i docs/DESIGN_DECISIONS.md:s "wise-herding-lemur"
 * planfil (mastertabellen), inte gissade tyst här. Korpnäbb (Enhands
 * krossvapen), Partisan/Glav (Stickvapen), Pik (Stångvapen) är sådana.
 *
 * Grundegenskap per grupp: STY för Enhandssvärd/Enhands krossvapen/
 * Enhandsyxor/Tvåhandsvapen, SMI för resten — RP s.60:s egen tabellkolumn.
 */
DODE.weaponGroups = [
  { key: "dolkar", name: "Dolkar", attribute: "smi",
    weapons: ["Dolk", "Parerdolk"] },
  { key: "enhandssvard", name: "Enhandssvärd", attribute: "sty",
    weapons: ["Kortsvärd", "Bredsvärd", "Kroksabel", "Bastardsvärd"] },
  { key: "enhands-krossvapen", name: "Enhands krossvapen", attribute: "sty",
    weapons: ["Klubba", "Spikklubba", "Stridshammare", "Morgonstjärna", "Hjälmkrossare",
      "Stor träklubba", "Stor spikklubba", "Korpnäbb"] },
  { key: "enhandsyxor", name: "Enhandsyxor", attribute: "sty",
    // Bredyxa (REG s.58, "1–2H | STY-gr 2") tillagd 2026-08-16 — samma
    // "placera efter vapnets form, inte fattningskolumnen" -princip som
    // redan gav Korpnäbb sin grupp (se filhuvudets ⚠), och samma exakta
    // precedens som Kroksabel (också "1–2H") redan fick i enhandssvard.
    weapons: ["Handyxa", "Stridsyxa", "Skäggyxa", "Bredyxa"] },
  { key: "tvahandsvapen", name: "Tvåhandsvapen", attribute: "sty",
    weapons: ["Tvåhandssvärd", "Tvåhandsyxa"] },
  { key: "stickvapen", name: "Stickvapen", attribute: "smi",
    weapons: ["Kortspjut", "Långspjut", "Tornerlans", "Lans", "Treudd", "Spetum", "Partisan", "Glav"] },
  { key: "kattingvapen", name: "Kättingvapen", attribute: "smi",
    weapons: ["Stridsslaga", "Stridsgissel"] },
  { key: "stangvapen", name: "Stångvapen", attribute: "smi",
    weapons: ["Trästav", "Hillebard", "Pålyxa", "Pik"] },
  { key: "bagar", name: "Bågar", attribute: "smi",
    weapons: ["Liten båge", "Kortbåge", "Långbåge", "Sammansatt båge"] },
  { key: "armborst", name: "Armborst", attribute: "smi",
    weapons: ["Lätt armborst", "Tungt armborst", "Arbalest"] },
  { key: "slunga", name: "Slunga", attribute: "smi",
    weapons: ["Slunga", "Stavslunga"] },
  { key: "kastvapen", name: "Kastvapen", attribute: "smi",
    // Kaststjärna (REG s.59, samma "Kastvapen"-tabell som Kastspjut/Kastkniv/
    // Kastyxa) tillagd 2026-08-16 — en genuin katalogslucka (fanns i
    // kompendiet men inte i den här gruppen), inte en tolkning: boken listar
    // dem tillsammans, till skillnad från Bola/Lasso i samma tabell som är
    // uttryckligen "Spec"-skada/specialvapen och medvetet står utanför.
    weapons: ["Kastspjut", "Kastkniv", "Kastyxa", "Kaststjärna"] },
  { key: "piska", name: "Piska", attribute: "smi",
    weapons: ["Piska"] },
  { key: "skoldar", name: "Sköldar", attribute: "smi",
    weapons: ["Targ", "Bucklare", "Rundsköld, liten", "Rundsköld, stor", "Långsköld",
      "Vanlig sköld", "Scutata", "Romersk sköld", "Pavise"] },
  { key: "blasror", name: "Blåsrör", attribute: "smi",
    weapons: ["Blåsrör"] }
];

/**
 * Slår upp vilken vapengrupp ett vapennamn tillhör (case/diakritik-okänsligt,
 * samma normalisering som DODE.skillKey). Returnerar hela gruppposten
 * ({key, name, attribute, weapons}) eller null om namnet inte matchar någon
 * grupp — anropande kod (guidens vapenfärdighetsväljare) ska då falla
 * tillbaka till fritext/SMI precis som innan denna tabell fanns, inte krascha.
 */
DODE.weaponGroupFor = function (weaponName) {
  const key = DODE.skillKey(weaponName);
  if (!key) return null;
  for (const group of DODE.weaponGroups) {
    if (group.weapons.some((w) => DODE.skillKey(w) === key)) return group;
  }
  return null;
};

/**
 * Vapentekniker — KH s.20 ("Vapentekniker", Typ Sekundär B, Barbar/Paladin/
 * Prisjägare/Riddare/Soldat/Vapenmästare) och KH s.38-40 ("Vapenakademier",
 * själva teknikkatalogen). Varje teknik är sin EGEN färdighet (KH s.38: "De
 * läggs inte ihop till samma färdighetsvärde... Eleven kan ha olika höga FV i
 * olika tekniker") — grundkostnad+grundegenskap ur den tabellen, inte den
 * platta sekundär-basen (se DODE.secondarySkillBaseOverrideFor).
 *
 * ⚠ **Dubbelhugg** har en fullständig teknikbeskrivning men ingen synlig rad
 * i kostnadstabellen (Johans scan av KH s.38-39) — `grundkostnad: null`
 * tills en fysisk boksida bekräftar siffran, i stället för att gissa.
 *
 * Post-skapande, ej wizard-integrerat (Johans beslut 2026-08-04): läggs till
 * via arkets befintliga "Dela ut färdighet"-knapp (SL-låst) precis som andra
 * sekundära färdigheter, inte via rollpersonsskaparen.
 */
DODE.vapentekniker = [
  { key: "anfall-bakifran-teknik", name: "Anfall bakifrån (teknik)", attribute: "smi", grundkostnad: 1,
    description: "Den anfallande kan glida förbi motståndaren vid ett anfall och hamna bakom dennes rygg. Inte möjlig mot en motståndare som är beredd och har sin fulla uppmärksamhet riktad mot angriparen, bara mot en som distraheras av annat." },
  { key: "avvapna-teknik", name: "Avväpna (teknik)", attribute: "smi", grundkostnad: 2,
    description: "En raffinerad variant av Avväpna — inget slag mot STY krävs. Lyckas tekniken flyger vapnet ur händerna på motståndaren och landar 1T3+1 meter bort. Ett perfekt slag innebär att man kan ta vapnet och använda det själv." },
  { key: "bryta-vapen", name: "Bryta vapen", attribute: "smi", grundkostnad: 1,
    description: "Kräver ett vapen med vapenbrytare. Mäter anfallarens STY+FV mot vapnets brytvärde (BV). Lyckas anfallet bryts vapnet av. Kan också användas för att hugga av skaftade vapen eller kröka/bryta klena svärd." },
  { key: "distrahera", name: "Distrahera", attribute: "smi", grundkostnad: 1,
    description: "Små knep — prata, blända med solen i vapnet, m.m. — som ger motståndaren -3 CL. Ett perfekt slag distraherar hela stridsrundan. Ingen egen handling, kan göras samtidigt med ett vanligt anfall." },
  { key: "dra-vapen-teknik", name: "Dra vapen (teknik)", attribute: "smi", grundkostnad: 3,
    description: "Dra vapnet och anfalla i samma handling. FV kan aldrig vara högre än FV i vapnet som anfallet görs med. Kräver att vapnet är lätt åtkomligt och bägge händerna fria." },
  { key: "dubbelhugg", name: "Dubbelhugg", attribute: "smi", grundkostnad: null,
    description: "⚠ Grundkostnad ej bekräftad — kontrollera mot fysisk bok innan detta fält fylls i. Tillåter anfall två gånger i samma handling mot samma motståndare, ett efter det andra. Bara en gång per stridsrunda. Kan göras med dolkar, enhandssvärd och enhandsyxor." },
  { key: "dodande-anfall", name: "Dödande anfall", attribute: "smi", grundkostnad: 2,
    description: "Ett anfall mot en särskilt känslig punkt. Lyckas det görs maximal skada för vapnet och maximal skadebonus. Bara en gång per stridsrunda. Ett perfekt dödande anfall ignorerar rustningens absorbering helt." },
  { key: "flygande-hugg", name: "Flygande hugg", attribute: "smi", grundkostnad: 2,
    description: "Ett hopp över motståndaren med ett skärande hugg mot huvud eller bröstkorg, inget avdrag för riktat anfall. Lyckas det landar angriparen 1T3+1 meter bort och gör +3 KP och SP. Kan inte göras mot metallrustning." },
  { key: "forutse-blotta", name: "Förutse blotta", attribute: "int", grundkostnad: 1,
    description: "Konsten att inse hur motståndaren kommer att reagera nästa handling — ger +5 CL vid anfall mot den förutsedda blottan. Tar ingen handling, bara en gång per stridsrunda." },
  { key: "hugg-teknik", name: "Hugg (teknik)", attribute: "sty", grundkostnad: 1,
    description: "Konsten att mätta ett våldsamt hugg mot punkten som gör mesta skadan — +2 KP och SP om anfallet lyckas. Ingen egen handling, används tillsammans med ett vanligt anfall. Bara en gång per stridsrunda." },
  { key: "harskri", name: "Härskri", attribute: "psy", grundkostnad: 2,
    description: "Jämförs mot motståndarens PSY på Motståndstabellen. Vinner angriparen förlorar motståndaren sin nästa handling. Bara en gång per stridsrunda." },
  { key: "kanes-manover", name: "Kanes manöver", attribute: "smi", grundkostnad: 2,
    description: "En raffinerad Dra vapen — man anfaller FÖRST i stridsrundan trots att vapnet satt i skidan innan striden började. Kan bara göras med svärd." },
  { key: "kasta-svard", name: "Kasta svärd", attribute: "smi", grundkostnad: 1,
    description: "Svärdet kastas upp till tre rutor mot en motståndare och gör normal skada." },
  { key: "knahugg", name: "Knähugg", attribute: "smi", grundkostnad: 1,
    description: "Angriparen går ned på knä och hugger mot motståndaren, som får -5 CL i Parera." },
  { key: "krossande-slag", name: "Krossande slag", attribute: "sty", grundkostnad: 2,
    description: "Om anfallet gör mer skada än kroppsdelens totala KP bryts/krossas ben och kroppsdelen blir obrukbar direkt (i stället för vid dubbel skada). Slag mot mage/bröst/huvud gör motståndaren medvetslös. Kan bara göras med krossvapen, kättingvapen och tvåhandsvapen." },
  { key: "lang-stot", name: "Lång stöt", attribute: "smi", grundkostnad: 2,
    description: "Ett utfall med hela kroppens kraft — +2 CL och +1 KP/SP skada. Motståndaren kan inte slå tillbaka i samma handling, bara parera. Bara en gång per stridsrunda. Kan bara göras med enhandssvärd och dolkar." },
  { key: "parering-teknik", name: "Parering (teknik)", attribute: "smi", grundkostnad: 1,
    description: "Konsten att parera med vilket föremål som helst — hattar, stolar, ölsejdlar m.m. — utan krav på högre brytvärde än det anfallande vapnet. Parera är en handling." },
  { key: "psykisk-duell", name: "Psykisk duell", attribute: "psy", grundkostnad: 3,
    description: "Jämförs mot motståndarens PSY på Motståndstabellen. Lyckas det viker motståndaren undan och kan inte anfalla på 1T10 stridsrundor. Effekten försvinner om den som använde tekniken själv anfaller." },
  { key: "skoldanfall", name: "Sköldanfall", attribute: "sty", grundkostnad: 1,
    description: "Anfall med skölden — stöts upp mot motståndaren eller svingas mot honom. En vanlig attack; skada för sköldar anges i vapentabellerna." },
  { key: "smartstot", name: "Smärtstöt", attribute: "smi", grundkostnad: 1,
    description: "Anfallet sätts in mot en särskild smärtsam punkt — -3 CL på anfallet, men lyckas det görs maximalt antal SP (bara så många KP som slaget anger)." },
  { key: "stot-teknik", name: "Stöt (teknik)", attribute: "smi", grundkostnad: 1,
    description: "En kortare variant av Lång stöt — +3 CL. Ingen egen handling, används tillsammans med ett vanligt anfall." },
  { key: "svepande-hugg", name: "Svepande hugg", attribute: "smi", grundkostnad: 3,
    description: "Ett hugg som sveper och kan träffa flera motståndare (FV5→2, FV10→3, FV15→4, FV20→5, över FV20→6 max). -3 CL på anfallet. Bara en gång per stridsrunda. Första motståndaren tar full skada, resten -3/-6/-9 osv." },
  { key: "tvinga-ur-balans", name: "Tvinga ur balans", attribute: "sty", grundkostnad: 1,
    description: "Pressar motståndaren med vapnet så hårt att denne tvingas retirera. Ger motståndaren -5 CL på både anfall och försvar resten av stridsrundan. Tar en handling." },
  { key: "undanmanover-teknik", name: "Undanmanöver (teknik)", attribute: "smi", grundkostnad: 1,
    description: "Differensvärdet för en lyckad undanmanöver dras från motståndarens CL för attacken. Tar en handling." },
  { key: "virvelvindsanfall", name: "Virvelvindsanfall", attribute: "smi", grundkostnad: 2,
    description: "En ström av hugg åt alla håll medan man rör sig framåt — -3 CL, men kan anfalla en ny motståndare varje handling utan att använda en handling för förflyttning (max 3 rutor mellan motståndarna)." },
  { key: "vrida-klinga", name: "Vrida klinga", attribute: "smi", grundkostnad: 1,
    description: "Tvingar ut motståndarens svärd från kroppen så att man kan anfalla hans hand och arm i stället. Lyckas tekniken ger den +5 CL för att anfalla armen." }
];

/**
 * Stridskonster (obeväpnad strid) — RP s.56-58 (grundregler, Krigare/
 * Lönnmördare/Munk) + KH s.91-93 (Österländska stridskonster-tillägget, 5
 * genuint nya tekniker + 7 återanvända vapentekniker-namn med egen, lägre
 * grundkostnad i stridskonst-sammanhang). Fullt sourcat kurerat extrakt:
 * Roll20-projektets `docs/extracts/DODE_Stridskonster.md` (rå-OCR:en för
 * båda källsidorna har kraftig tvåspaltsbleed, opålitlig för sökning).
 *
 * ⚠ **STRUKTURELLT ANNORLUNDA än DODE.vapentekniker ovan, trots samma
 * tabellform.** Detta är BARA teknikkatalogen (namn + grundkostnad +
 * beskrivning) — en ren datakälla, ingen `attribute`-nyckel per teknik
 * eftersom boken inte ger någon: hela stridskonsten delar EN grundegenskap
 * (SMI) och ETT FV över ALLA valda tekniker ("Det FV man har lärt sig i en
 * stridskonst gäller för samtliga tekniker i stridskonsten", RP s.58) — till
 * skillnad från Vapentekniker, där varje teknik är sin EGEN oberoende
 * färdighet med eget FV och egen grundegenskap. En rollperson KOMPONERAR
 * själv sin stridskonst genom att välja valfria tekniker ur listan nedan,
 * SUMMERAR deras grundkostnader (avrundat uppåt) till EN grundkostnad för
 * hela stridskonsten, och betalar 2 EP extra om den inte valts som
 * yrkesfärdighet. **Själva den köp-/inlärningsmekaniken (bundle-komponering,
 * summering, delat FV) är INTE byggd än** — bara katalogdata. Se extraktets
 * "Öppen implementationsfråga"-avsnitt och DESIGN_DECISIONS.md backlog 71/27.
 *
 * `vapenteknikRef` (bara satt på de 7 återanvända teknikerna): pekar på
 * motsvarande `DODE.vapentekniker`-nyckel för delad mekanisk beskrivning —
 * grundkostnaden här är MEDVETET en annan siffra än den nyckelns egen
 * (stridskonst-kontext är billigare än vapen-kontext för samma teknik,
 * bekräftat i källan, inte en avvikelse att rätta).
 */
DODE.stridskonster = [
  // RP s.57 — grundlistan (22 tekniker).
  { key: "sk-avvapning", name: "Avväpning", grundkostnad: 1,
    description: "Obeväpnad parering mot ett beväpnat anfall — lyckas motståndarens attack fungerar tekniken som en vanlig parering, misslyckas den far vapnet 1T3 rutor åt något håll. Ett perfekt slag: försvararen tar vapnet i egna händer." },
  { key: "sk-bakatspark", name: "Bakåtspark", grundkostnad: 0.5,
    description: "Spark mot en motståndare i rutan bakom angriparen. 1T6 skada." },
  { key: "sk-bedovningsslag", name: "Bedövningsslag", grundkostnad: 1,
    description: "⚠ Kan bara användas mot människoliknande motståndare (RP s.57). Knytnävs-/fingerslag mot nervknutar, 1T3 skada. Vid skada måste offret slå Svårt FYS eller bli tillfälligt bedövad och förlora nästa attack/parering. Icke-människotyp tar bara 1T3 skada totalt." },
  { key: "sk-blind-strid", name: "Blind strid", grundkostnad: 2,
    description: "Alltid påkopplad, inget färdighetsslag krävs. Kan slåss i beckmörker, men eftersom terrängen inte känns av kan det ändå vara besvärligt." },
  { key: "sk-dubbelslag", name: "Dubbelslag", grundkostnad: 1,
    description: "Två knytnävsattacker samtidigt mot OLIKA motståndare i samma SR (1T3 skada/attack, separata slag, offren får inte stå mer än 180° isär)." },
  { key: "sk-dubbelspark", name: "Dubbelspark", grundkostnad: 1.5,
    description: "Flygande hoppspark mot två olika motståndare, en per fot (1T6 skada/spark, separata slag, offren max 1 meter isär). Se även Hoppspark." },
  { key: "sk-fallteknik-rullning", name: "Fallteknik/Rullning", grundkostnad: 0.5,
    description: "Lyckat slag → halv fallskada. Lyckad rullning flyttar upp till 5 rutor i en SR (kan inte huggas med närstridsvapen på en rullande person). Misslyckad rullning ger bara halva sträckan och liggande." },
  { key: "sk-fint", name: "Fint", grundkostnad: 0.5,
    description: "Utförs samtidigt med ett anfall. Lyckas finten halveras motståndarens parerings-CL (avrunda nedåt). Kan göras med alla attacktyper utom avståndsvapen." },
  { key: "sk-hoppspark", name: "Hoppspark", grundkostnad: 1,
    description: "Rutas sats + hopp, spark mot huvud/bröstkorg, 1T8 skada. Missar → landar i målets ruta. Lyckat SMI-slag → landar på fötterna men gör inget annat nästa runda; misslyckat → liggande. −2 på initiativslaget." },
  { key: "sk-hogt-kast", name: "Högt kast", grundkostnad: 1,
    description: "⚠ Kan bara användas mot människoliknande motståndare (RP s.57). Utförs alltid sist i SR. Lyckas kastet kastas offret 1T3 rutor i valfri riktning och blir liggande — Svårt SMI-slag eller 1T3 skada." },
  { key: "sk-initiativbonus", name: "Initiativbonus", grundkostnad: 0.5,
    description: "Alltid påkopplad, inget slag krävs. +5 till SMI vid beräkning av turordning." },
  { key: "sk-krosslag", name: "Krosslag", grundkostnad: 1,
    description: "Knytnävsslag mot särskilt ömtåliga punkter (tinningar, struphuvud, solar plexus, njure m.m.). 1T6 skada." },
  { key: "sk-liggande-knastaende-strid", name: "Liggande/Knästående strid", grundkostnad: 1,
    description: "Alltid påkopplad, inget slag krävs. Kan anfalla/parera/utföra låga kast liggandes. Ingen anfallsbonus mot ett liggande mål för motståndare med denna teknik." },
  { key: "sk-lagt-kast", name: "Lågt kast", grundkostnad: 0.5,
    description: "⚠ Kan bara användas mot människoliknande motståndare (RP s.57). Lyckas kastet kastas försvararen omkull i sin egen ruta utan skada (kan pareras). Reser sig efter 1T2 SR." },
  { key: "sk-lasning-neddragning", name: "Låsning/Neddragning", grundkostnad: 1,
    description: "⚠ Kan bara användas mot människoliknande motståndare (RP s.57). Ett anfall — lyckas det låses motståndaren mot marken. Att ta sig ur greppet kräver att försvararen övervinner angriparens FV med sin egen halverade SMI (avrunda nedåt)." },
  { key: "sk-normalt-slag", name: "Normalt slag", grundkostnad: 0.5,
    description: "Knytnävsslag mot huvud/bröstkorg, 1T3 skada." },
  { key: "sk-normal-spark", name: "Normal spark", grundkostnad: 0.5,
    description: "Spark mot ben/bröstkorg/huvud, 1T6 skada." },
  { key: "sk-obevapnad-parering-av-vapen", name: "Obeväpnad parering av vapen", grundkostnad: 0.5,
    description: "Parerar alla närstridsattacker, även vapenanfall, trots att man är obeväpnad." },
  { key: "sk-rundspark", name: "Rundspark", grundkostnad: 1,
    description: "Snurr för extra fart, 1T8 skada. Missar → förlorar balansen, kan inte anfalla/parera nästa runda. −2 på initiativslaget." },
  { key: "sk-stalsattning", name: "Stålsättning", grundkostnad: 1,
    description: "Används varje gång kämpen tar skada. Lyckat slag → halv skada (avrunda). Kan inte användas mot slag mot huvudet." },
  { key: "sk-uppresning", name: "Uppresning", grundkostnad: 0.5,
    description: "Reser sig omedelbart efter att ha kastats omkull, förutsatt ett lyckat färdighetsslag — oavsett när i SR fallet inträffade." },
  { key: "sk-vidvinkelsyn", name: "Vidvinkelsyn", grundkostnad: 1,
    description: "Alltid påkopplad, inget slag krävs. Iakttagelsefältet vidgas till 270°." },

  // KH s.93 — Österländska stridskonster-tillägget, 5 genuint nya tekniker.
  { key: "sk-fallande-spark", name: "Fallande spark", grundkostnad: 1.5,
    description: "Flygande spark, båda fötterna riktas snett nedåt. 1T6 KP + 1T8 SP. Bara en gång per stridsrunda." },
  { key: "sk-forutse-anfall", name: "Förutse anfall", grundkostnad: 1,
    description: "Inse hur motståndaren kommer att anfalla i nästa handling. Lyckas tekniken: +2 CL på parering. Ingen egen handling." },
  { key: "sk-projektilparering", name: "Projektilparering", grundkostnad: 1.5,
    description: "Parera/undvika pilar, slungstenar, kastspjut m.fl. projektiler. Kan försöka undvika flera samtidigt: −5 CL för två, −10 för tre, −15 för fyra, −20 för fem." },
  { key: "sk-rullande-attack", name: "Rullande attack", grundkostnad: 1,
    description: "Mjukt framåtfall, utnyttjar rörelseenergin vid uppresning. +5 på initiativslaget, +1 på skadan. Kan INTE kombineras med tekniken Initiativbonus." },
  { key: "sk-rustad-strid", name: "Rustad strid", grundkostnad: 1,
    description: "Gör det möjligt att använda en stridskonst i rustning, upp till och med förstärkt ringbrynja (dubbel ringbrynja/hel lamellerad/laminerad/metallrustning utesluter en stridskonst helt). Gäller EN rustningstyp, specificerad när färdigheten skaffas — slås varje stridsrunda man slåss i rustning." },

  // KH s.93 — 7 återanvända vapenteknik-namn, egen (lägre) grundkostnad i
  // stridskonst-sammanhang. `vapenteknikRef` pekar på den delade beskrivningen.
  { key: "sk-anfall-bakifran", name: "Anfall bakifrån", grundkostnad: 0.5, vapenteknikRef: "anfall-bakifran-teknik",
    description: "Se DODE.vapentekniker → Anfall bakifrån (teknik)." },
  { key: "sk-dodande-anfall", name: "Dödande anfall", grundkostnad: 1.5, vapenteknikRef: "dodande-anfall",
    description: "Se DODE.vapentekniker → Dödande anfall. Kan i stridskonst-sammanhang bara kombineras med Normal spark och Normalt slag, inte andra specialtekniker." },
  { key: "sk-forutse-blotta", name: "Förutse blotta", grundkostnad: 0.5, vapenteknikRef: "forutse-blotta",
    description: "Se DODE.vapentekniker → Förutse blotta." },
  { key: "sk-kiai", name: "Kiai", grundkostnad: 1, vapenteknikRef: "harskri",
    description: "Se DODE.vapentekniker → Härskri (samma teknik, östligt namn)." },
  { key: "sk-psykisk-duell", name: "Psykisk duell", grundkostnad: 2, vapenteknikRef: "psykisk-duell",
    description: "Se DODE.vapentekniker → Psykisk duell." },
  { key: "sk-undanmanover", name: "Undanmanöver", grundkostnad: 0.5, vapenteknikRef: "undanmanover-teknik",
    description: "Se DODE.vapentekniker → Undanmanöver (teknik)." },
  { key: "sk-virvelvindsanfall", name: "Virvelvindsanfall", grundkostnad: 1, vapenteknikRef: "virvelvindsanfall",
    description: "Se DODE.vapentekniker → Virvelvindsanfall. Kan i stridskonst-sammanhang bara kombineras med Normal spark och Normalt slag, inte andra specialtekniker." }
];

/** Slår upp en DODE.stridskonster-post på namn (samma matchningsmönster som DODE.weaponGroupFor). */
DODE.stridskonstFor = function (name) {
  if (!name) return null;
  return DODE.stridskonster.find((t) => t.name === name) ?? null;
};

/**
 * Effektiv grundegenskap för en enskild stridskonstteknik — boken ger ingen
 * egen per-teknik-egenskap (hela familjen delar SMI, RP s.56), UTOM för de 7
 * teknikerna som återanvänder ett vapentekniker-namn (`vapenteknikRef`),
 * där den bakomliggande vapentekniken har en egen, mer specifik egenskap
 * (t.ex. Kiai/Härskri = PSY) som är mer korrekt att slå mot.
 */
DODE.stridskonstAttribute = function (entry) {
  if (!entry) return "smi";
  if (entry.vapenteknikRef) {
    const ref = DODE.vapentekniker.find((t) => t.key === entry.vapenteknikRef);
    if (ref?.attribute) return ref.attribute;
  }
  return "smi";
};

/**
 * Vapenakademier — KH s.41-45, tre namngivna skolor. Rent GM-referensmaterial
 * (mästare/plats/tröskel för antagning) plus de fält en SL faktiskt kan tänkas
 * vilja slå upp mekaniskt (kostnad/tid/EP-tak/vilka tekniker som lärs ut).
 * `techniquesTaught` pekar på DODE.vapentekniker-nycklar ovan.
 */
DODE.vapenakademier = [
  {
    key: "faktskolan-pa-beyural", name: "Fäktskolan på Beyural",
    master: "Eledain", location: "Gringul, Beyural (Erebos)",
    weaponsTaught: ["Långsvärd", "Bredsvärd", "Värja", "Stickvärja", "Dolk", "Njurdolk", "Stilett", "Parerdolk"],
    techniquesTaught: ["avvapna-teknik", "distrahera", "forutse-blotta", "hugg-teknik", "lang-stot",
      "parering-teknik", "smartstot", "stot-teknik", "undanmanover-teknik"],
    otherSkills: ["Akrobatik", "Etikett", "Flintlåspistol", "Två vapen"],
    costPerYear: 8000,
    discountTiers: "FV15+ i minst två lärda vapen: 4.000 sm/år. FV18+ i minst två: gratis (som lärare).",
    duration: "3 år (kan avbrytas/återupptas)",
    ledighet: "3 månader sommar + 1 månad vinter",
    maxEP: 216
  },
  {
    key: "kanes-orden", name: "Kanes orden",
    master: "Kane (alvisk krigarmunk, 300+ år)", location: "Dolt kloster i Cer-bergen",
    weaponsTaught: ["Alla enhandssvärd", "Alla sköldar"],
    techniquesTaught: ["bryta-vapen", "dubbelhugg", "dodande-anfall", "hugg-teknik", "kanes-manover",
      "parering-teknik", "skoldanfall", "stot-teknik", "svepande-hugg", "undanmanover-teknik"],
    otherSkills: ["Meditation", "Överlevnad i bergstrakter", "Etikett", "Munkorden"],
    costPerYear: 0,
    discountTiers: "Alltid gratis — men akademin måste hittas genom prövningar (ädelmod/självuppoffring/givmildhet/medlidande) och flyttar plats mellan besök.",
    duration: "3 år, ingen ledighet alls under träningen",
    ledighet: "Ingen",
    maxEP: 312
  },
  {
    key: "hauksheim", name: "Hauksheim",
    master: "Hauk (barbar, ~50 år, saknar vänster arm)", location: "Tarkens krök, Jorduashur (Sigsdal)",
    weaponsTaught: ["Bredyxa", "Handyxa", "Stridsyxa", "Skäggyxa"],
    techniquesTaught: ["dubbelhugg", "hugg-teknik", "krossande-slag", "parering-teknik", "svepande-hugg", "tvinga-ur-balans"],
    otherSkills: ["Överlevnad i tundra", "Jakt", "Fiske", "Simma"],
    costPerYear: 10000,
    discountTiers: "Inga officiella rabatter (Hauk kan enstaka gånger avstå avgiften för en elev han gillar).",
    duration: "3 år normalt (5 år om man bara tränar vintertid — samma EP-summa)",
    ledighet: "2 månader sommar + 2 månader vinter",
    maxEP: 216
  }
];

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
  // "Läsa/Skriva språk"/"Tala språk (Kate. B)" (RP s.58, källdokets rader 228/253)
  // fanns tidigare här som två oprecisa katalograder (BC "varierar" — ett
  // dokumenterat forskningshål). Ersatta 2026-08-06 med `DODE.languages` +
  // en riktig per-språk-rad i "+Ny färdighet"-dialogen (se
  // actor-character-sheet.mjs) sedan RP s.58 lästes direkt ur skanningen och
  // gav exakt Grundegenskap: INT (samma gruppformel som alla andra sekundära
  // färdigheter, ingen särregel) plus den fullständiga 0-5-nivåskalan. RP s.58
  // sourcar bara TALA — en parallell Läsa/Skriva-variant är en rimlig
  // spegling (samma mönster som modersmål har både en tal- och en läs/skriv-
  // färdighet), inte en gissad siffra, eftersom BC-formeln är identisk med
  // alla andra sekundära färdigheter.
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
  { key: "teckensprak", name: "Teckenspråk", attribute: "int" },
  { key: "trastav", name: "Trästav", attribute: "smi" },
  // baseOverride: RP s.59:s egen grundkostnad (4), inte den platta sekundär-
  // basen (5) — se DODE.secondarySkillBaseOverrideFor.
  { key: "tva-vapen", name: "Två vapen", attribute: "smi", baseOverride: 4 },
  { key: "undre-varlden", name: "Undre världen", attribute: "int" },
  { key: "vapenfardigheter", name: "Vapenfärdigheter", attribute: "smi" },
  { key: "zoologi", name: "Zoologi", attribute: "int" },
  { key: "anterhake", name: "Änterhake", attribute: "smi" },
  { key: "ortkunskap", name: "Örtkunskap", attribute: "int" },
  { key: "overlevnad", name: "Överlevnad", attribute: "int" },
  // Egen post, skild från den generiska "Överlevnad" ovan — källtexten
  // (T&L s.15, "De har alltid minst 10 i CL i Överleva i skogstrakter")
  // namnger den som en EGEN färdighet, separat från "Överlevnad" som redan
  // står med i Stråtrövarens egen yrkesfärdighetslista. Behövs för att
  // Stråtrövarens automatiska golv ska kunna uttryckas som ett vanligt,
  // OVILLKORAT `skillFloors`-golv (samma mönster som Prisjägares Upptäcka
  // fara-golv) UTAN att felaktigt ge bonusen överallt — se
  // packs/yrken/_source/stratrovare_dodeYtjuvstratro.json. Johan,
  // 2026-08-17: "We need a new skill. 'Överleva i skog'" — löser den öppna
  // beslutspunkten från backlog 71 genom att göra kontexten till FÄRDIGHETEN
  // själv i stället för en ny effekttyp.
  { key: "overleva-i-skogstrakter", name: "Överleva i skogstrakter", attribute: "int" }
];

// Språk (backlog, session 2026-08-06) — RP s.42/44/58 (docs/språk-i-ereb-altor.md
// i Roll20-projektet, transkriberat direkt ur skanningar samma session). Tre
// separata mekaniker delar den här språklistan:
//   1. Läsa/Skriva Modersmål (primär) — fast BC ur socialt stånd × INT, INTE
//      grupp-BC. Se DODE.motherTongueLasaSkrivaBc.
//   2. Tala Modersmål (primär) — fast BC ur socialt stånd ENSAMT (INT spelar
//      ingen roll att TALA sitt modersmål). Se DODE.motherTongueTalaBc.
//   3. Tala/Läsa-Skriva Främmande Språk (sekundär) — vanlig grupp-BC precis
//      som alla andra sekundära färdigheter (RP s.58: "Grundegenskap: INT",
//      samma formatering som varje annan sekundär färdighet i källan — ingen
//      särregel hittad). Varje språk är sin EGEN färdighet (RP s.58, ordagrant:
//      "Varje språk räknas som en separat färdighet") — se "+Ny färdighet"-
//      dialogen i actor-character-sheet.mjs, som erbjuder en rad per språk
//      här nedan, samma mönster som Vapenfärdigheter redan använder.
// `description` = "var talas det" (docs/språk-i-ereb-altor.md §1, Ereb Altor —
// Kampanjbok s.44), visad som en referenstabell under guidens språkval (Johan,
// 2026-08-07: "spelarna [ska] förstå vad de väljer och varför"). ⚠ "Västjori
// är ALLMÄNNA språket" är Johans egen kampanjramning, inte ett ordagrant citat
// ur källan — källan säger bara att Västjori talas i flest riken (den bredast
// spridda Jori-dialekten), vilket stödjer men inte bokstavligen SÄGER
// "allmänspråk". Flaggat här, inte tyst framställt som ett direkt citat.
DODE.languages = [
  { key: "vastjori", name: "Västjori (Jori)",
    description: "Allmänna språket i Ereb Altor — talas i Kardien, Felicien, Zorakin, Magilre, Mereld, Bzegusta, samt delar av Klomellien och Trakorien." },
  { key: "ostjori", name: "Östjori (Jori)",
    description: "Talas i Berendien, Hynsolge och de erebosiska öarna." },
  { key: "nyjori", name: "Nyjori (Jori)",
    description: "Talas i östra delarna av Zorakin, norra Berendien och vissa erebosiska småöar." },
  { key: "kejserlig-jori", name: "Kejserlig Jori (Jori)",
    description: "Utdött som folkspråk — används numera bara av lärda män och i diplomatisk korrespondens. Extremt högtidligt." },
  { key: "hamuriska", name: "Hamuriska (Sydnarguriska)",
    description: "Barbarspråk — talas i sydöstra Klomellien." },
  { key: "kaseni", name: "Kaseni (Sydnarguriska)",
    description: "Barbarspråk — talas på norra Aidne-halvön." },
  { key: "isbarbarernas-sprak", name: "Isbarbarernas språk (Tjugiska)",
    description: "Barbarspråk — talas av isbarbarerna i Orghin och Sanithsid." },
  { key: "barboskin", name: "Barboskin (Tjugiska)",
    description: "Barbarspråk — talas av ziddis-folket på ön Palamux." },
  { key: "alviska", name: "Alviska", description: "Alvernas eget språk." },
  { key: "dvargiska", name: "Dvärgiska", description: "Dvärgarnas eget språk." },
  { key: "svartiska", name: "Svartiska", description: "Svartfolkets (orchernas) eget språk." },
  { key: "erdir", name: "Erdir (Forntunga)",
    description: "Uråldrigt, utdött sedan innan Jorpagnas uppkomst. Används idag av uråldriga raser och i magiska ritualer. Skrivs med omkring 60 tecken." }
];

// "Ett människospråk" — poolen varje ras med den frasen väljer FRÅN (RP s.42/44).
// Erdir är uttryckligen ett utdött rituellt/uråldrigt språk (SPRÅK I EREB ALTOR,
// docs/språk-i-ereb-altor.md §1), inte ett levande människospråk — utesluten.
const HUMAN_LANGUAGE_KEYS = ["vastjori", "ostjori", "nyjori", "kejserlig-jori", "hamuriska", "kaseni", "isbarbarernas-sprak", "barboskin"];
DODE.humanLanguages = DODE.languages.filter((l) => HUMAN_LANGUAGE_KEYS.includes(l.key));

/**
 * Modersmål per ras — RP s.42 (Läsa/Skriva) och s.44 (Tala), lästa direkt ur
 * skanningen 2026-08-06 (inte den äldre, grövre sammanfattningen i
 * docs/språk-i-ereb-altor.md §2, som denna tabell nu är facit över).
 *
 * ⚠ **Dvärgar och Halvorch skiljer sig verkligen mellan Tala och Läsa/Skriva**
 * — inte en sidbrytnings-utelämning (en tidigare, ogrundad gissning i samma
 * dokument, rättad samma session): Dvärgar TALAR dvärgiska OCH ett
 * människospråk, men får bara BC i att LÄSA/SKRIVA dvärgiska. Halvorch TALAR
 * svartiska OCH ett människospråk, men får bara BC i att LÄSA/SKRIVA ett
 * människospråk (ingen svartiska). Halvalver har redan sedan tidigare samma
 * sorts skillnad (alviska OCH människospråk för Tala; alviska ELLER
 * människospråk — ett val — för Läsa/Skriva), nu bekräftat att mönstret är
 * bredare än bara halvalver.
 *
 * Varje rad-array är en lista SLOTS: en sträng = ett fast beviljat språk, den
 * bokstavliga strängen `"human"` = spelaren väljer ETT ur DODE.humanLanguages,
 * `{choice:[...]}` = spelaren väljer ETT ur den givna mixade listan (kan
 * innehålla `"human"` som utvidgas till hela människospråks-poolen).
 */
DODE.raceMotherTongues = {
  manniska: { tala: ["human"], lasaSkriva: ["human"] },
  alv: { tala: ["alviska", "human"], lasaSkriva: ["alviska", "human"] },
  dvarg: { tala: ["dvargiska", "human"], lasaSkriva: ["dvargiska"] },
  halvalv: { tala: ["alviska", "human"], lasaSkriva: [{ choice: ["human", "alviska"] }] },
  halvlangdsman: { tala: ["human"], lasaSkriva: ["human"] },
  halvorch: { tala: ["svartiska", "human"], lasaSkriva: ["human"] },
  anka: { tala: ["human"], lasaSkriva: ["human"] }
};

/**
 * Alvsläktena (Gråalv/Grottalv/Högalv/Injir/Mörkeralv/Skogsalv) ärver Alvs språk.
 * ⚠ `raceGroup` är en FLAGGA (`getFlag`), inte ett `system`-schemafält —
 * character-wizard.mjs sätter den via `r.getFlag(game.system.id, "raceGroup")`
 * (progressiv avslöjning, backlogpost 56/57). En tidigare version av den här
 * funktionen läste `raceDoc.system?.raceGroup`, som är odeklarerat i
 * item-ras.mjs:s schema och alltså ALLTID `undefined` — varje alvsläkte föll
 * tyst tillbaka på `DODE.skillKey(raceDoc.name)` ("skogsalv" osv, obefintlig
 * nyckel i DODE.raceMotherTongues) och därmed vidare på `["human"]`, så den
 * fasta Alviska-raden försvann helt så fort spelaren valde en SPECIFIK
 * alvsläkt-medlem i stället för bas-Alv. Hittad 2026-08-07 efter att en
 * tidigare liveverifiering mot BAS-Alv (som inte har flaggan alls, bara
 * skillKey "alv" — redan rätt) missat att testa en faktisk medlem.
 */
DODE.motherTongueRaceKey = function (raceDoc) {
  if (!raceDoc) return null;
  if (raceDoc.getFlag?.(game.system.id, "raceGroup") === "alvslakte") return "alv";
  return DODE.skillKey(raceDoc.name);
};

/** @returns {Array} Slot-listan (se DODE.raceMotherTongues) för en ras+färdighet. */
DODE.motherTongueSlots = function (raceDoc, kind) {
  const key = DODE.motherTongueRaceKey(raceDoc);
  return DODE.raceMotherTongues[key]?.[kind] ?? ["human"];
};

/**
 * Om en ras har en OKONSTRUERAD "human"-plats i BÅDA Tala och Läsa/Skriva
 * (den bokstavliga strängen "human", inte en `{choice:[...]}`-plats)
 * representerar de facto SAMMA modersmål — man kan inte TALA ett människospråk
 * och LÄSA/SKRIVA ett annat som modersmål. Johan 2026-08-07: "Om man väljer
 * väst jori som modersmål borde man nog inte kunna skriva ett annat språk som
 * modersmål. Borde bli samma automatiskt." Halvalvs Läsa/Skriva-plats är en
 * avsiktlig `{choice:["human","alviska"]}`-plats (en riktig valmöjlighet,
 * redan källbelagd) och räknas INTE hit — bara de rena "human"-fallen
 * (Människa, Alv, Halvlängdsman, Anka, Halvorch) synkas.
 * @returns {{talaIndex:number, lasaSkrivaIndex:number}|null}
 */
DODE.syncedHumanMotherTongueIndices = function (raceDoc) {
  const talaIndex = DODE.motherTongueSlots(raceDoc, "tala").indexOf("human");
  const lasaSkrivaIndex = DODE.motherTongueSlots(raceDoc, "lasaSkriva").indexOf("human");
  if (talaIndex === -1 || lasaSkrivaIndex === -1) return null;
  return { talaIndex, lasaSkrivaIndex };
};

/** @returns {Array|null} Valbara språk för en slot, eller null om slotten är FAST (inget val). */
DODE.motherTongueSlotOptions = function (slot) {
  if (slot === "human") return DODE.humanLanguages;
  if (slot && typeof slot === "object" && slot.choice) {
    return slot.choice.flatMap((c) => (c === "human" ? DODE.humanLanguages : [DODE.languages.find((l) => l.key === c)])).filter(Boolean);
  }
  return null;
};

/** @returns {string} Visningsnamn för en FAST slot (en sträng som inte är "human"). */
DODE.languageName = function (key) {
  return DODE.languages.find((l) => l.key === key)?.name ?? key;
};

// Socialt-stånds-bucket för språktabellerna (RP s.42/44) — DODE.socialStandingTable
// (RP s.27, REGEL_SocialtStand.md) har 9 rangordningar, språktabellerna bara 5.
// De fyra översta (Lägre/Högre överklass, Lågadel, Högadel) slås ihop till
// "Överklass el. adel"; de två understa (Egendomslös, Lägre underklass) till
// "Övriga" — en ren sammanslagning av en grövre till en finare befintlig
// bok-tabell, inte ett påhittat mellansteg.
DODE.languageSocialBucket = function (rank) {
  if (["Lägre överklass", "Högre överklass", "Lågadel", "Högadel"].includes(rank)) return "overklass-adel";
  if (rank === "Högre medelklass") return "hogre-medelklass";
  if (rank === "Lägre medelklass") return "lagre-medelklass";
  if (rank === "Högre underklass") return "hogre-underklass";
  return "ovriga"; // Egendomslös, Lägre underklass — samt okänt/ej slaget
};

/** Tala Modersmål — RP s.44: FV 20 (B5) för överklass/adel, FV 16 (B4) för alla andra. INT oväsentligt. */
DODE.motherTongueTalaBc = function (bucket) {
  return bucket === "overklass-adel" ? 20 : 16;
};

/** Läsa/Skriva Modersmål — RP s.42: 10-radig tabell, socialt stånd × INT (15+ vs 1-14). */
DODE.motherTongueLasaSkrivaBc = function (bucket, intValue) {
  const highInt = (intValue ?? 0) >= 15;
  const table = {
    "overklass-adel": highInt ? 20 : 16,
    "hogre-medelklass": highInt ? 16 : 11,
    "lagre-medelklass": highInt ? 11 : 5,
    "hogre-underklass": highInt ? 5 : 1,
    ovriga: highInt ? 1 : 0
  };
  return table[bucket] ?? 0;
};

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

/**
 * Två vapen — RP s.59: FV-taket för en tränad vapenkombination kan aldrig
 * överstiga det LÄGSTA av de två ingående vapenfärdigheternas FV, och
 * startvärdet (BC) blir automatiskt hälften (avrundat nedåt) av det lägsta.
 * Ordagrant: "Färdighetsvärdet att använda två vapen tillsammans kan aldrig
 * överstiga det lägsta av de enskilda FV:na... man får automatiskt hälften
 * (avrunda nedåt) av det lägsta FV:t som BC."
 */
DODE.twoWeaponCap = function (primaryFv, offFv) {
  return Math.min(primaryFv ?? 0, offFv ?? 0);
};
DODE.twoWeaponAutoBc = function (primaryFv, offFv) {
  return Math.floor(DODE.twoWeaponCap(primaryFv, offFv) / 2);
};

/**
 * Grundkostnad ur en namngiven färdighetskatalog (DODE.secondarySkills eller
 * DODE.vapentekniker) — backlogpost 36-liknande men KATALOG-nivå, inte
 * aktör-nivå (skilt från DODE.skillCostOverrideFor ovan, som läser en
 * "Lättlärd"-effekt på just DEN aktören). Katalogens egna grundkostnad (t.ex.
 * Två vapen=4, en vapenteknik=1-3, RP s.30/KH s.38-39) väger tyngre än den
 * platta kategori-basen (sekundär=5) — se DESIGN_DECISIONS.md backlog om
 * REGLER_FARDIGHETER.md:s "Kostnad varierar per färdighet, men koden använder
 * en platt grundkostnad" som denna funktion delvis stänger.
 *
 * Vapenmästarens halva pris för vapentekniker lärda SOM yrkesfärdighet
 * (KH s.38, "kostar det hälften så mycket som vanligt att lära sig en
 * vapenteknik, avrunda uppåt") hanteras HÄR, inte i en separat
 * costTierOverride — den är knuten till specifikt vapentekniker-katalogen,
 * inte till aktörens costTier i stort, så den generiska
 * skillCostOverrideFor-mekanismen (som gäller en hel costTier) passar inte.
 *
 * Krigarmunkens halva pris för Stridskonster-tekniker (KH s.5, "Räkna ut
 * totalsumman och halvera den") hanteras med SAMMA per-teknik-halvering som
 * Vapenmästarens — en MEDVETEN förenkling (Johan, 2026-08-17: "Simplified
 * for now with backlog"), inte bokens ordagranna mekanik. Boken beskriver
 * Stridskonster som en spelar-komponerad BUNDLE med ett DELAT FV över alla
 * valda tekniker (grundkostnaderna summeras FÖRST, halveras sedan EN gång
 * som en TOTAL) — se `docs/DESIGN_DECISIONS.md` backlog 71/72 och Roll20-
 * projektets `docs/extracts/DODE_Stridskonster.md`. Den här funktionen
 * halverar i stället VARJE teknik OBEROENDE (samma independent-FV-modell
 * som Vapentekniker), avrundat uppåt per teknik precis som Vapenmästaren.
 * Bygg om till bundle-modellen enligt extraktets "Öppen implementations-
 * fråga" innan denna kommentar tas bort.
 */
DODE.secondarySkillBaseOverrideFor = function (skillKey, actor) {
  const fromVapentekniker = DODE.vapentekniker?.find((t) => t.key === skillKey);
  if (fromVapentekniker?.grundkostnad != null) {
    const isVapenmastare = actor?.system?.profession?.name === "Vapenmästare";
    return isVapenmastare
      ? Math.ceil(fromVapentekniker.grundkostnad / 2)
      : fromVapentekniker.grundkostnad;
  }
  const fromStridskonster = DODE.stridskonster?.find((t) => t.key === skillKey);
  if (fromStridskonster?.grundkostnad != null) {
    const isKrigarmunk = actor?.system?.profession?.name === "Krigarmunk";
    return isKrigarmunk
      ? Math.ceil(fromStridskonster.grundkostnad / 2)
      : fromStridskonster.grundkostnad;
  }
  const fromSecondary = DODE.secondarySkills.find((s) => s.key === skillKey);
  return fromSecondary?.baseOverride;
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

/**
 * GM-effekter (person/scen/värld) — docs/dev/GM_EFFEKTFONSTER_ANALYS.md.
 *
 * ⚠ Bara den del av effektmodellen som INTE redan har en hemvist bor här:
 *  - Attributnivå-effekter på scennivå ("Dimön PSY×2") går via den BEFINTLIGA
 *    `game.dode.SceneEffects` (scripts/utils/scene-effects.mjs) — riktiga
 *    ActiveEffects, inte det här. Bygg inte om den.
 *  - Personnivå-villkor ("armObrukbar") går via CONFIG.statusEffects + Token
 *    HUD — riktiga ActiveEffects med `statuses:[id]`, inte det här heller.
 *  - Det HÄR täcker bara det tre sorters effekter som saknar en Foundry-egen
 *    hemvist: namngivna färdighetsmodifierare (skillMod) och situationella
 *    CL-modifierare (clMod) på scen-/världsnivå, samt periodiska HP-/
 *    färdighetstickar (periodic) — se GM_EFFEKTFONSTER_ANALYS.md "Fyra olika
 *    EFFEKTTYPER".
 *
 * Radform: {id, label, scope:"scene"|"world", kind:"skillMod"|"clMod"|"periodic",
 *   operation:"add"|"multiply", skillKey, value, cadence:"round"|"hour"|"day",
 *   duration:{mode:"timed"|"manual", expiresAt}, source, note}
 */
DODE.NAMED_EFFECTS_FLAG = "namedEffects";

/** Har en `timed`-effekt gått ut? `manual`-effekter går aldrig ut av sig själva. */
DODE.isEffectExpired = function (effect) {
  if (effect?.duration?.mode !== "timed") return false;
  const expiresAt = effect.duration.expiresAt ?? 0;
  return (game.time?.worldTime ?? 0) >= expiresAt;
};

/**
 * Världseffekter — lagras i en world-scoped Setting (ingen Document-typ täcker
 * "gäller för alla i världen" på samma sätt som en Scene/Region täcker ett
 * område). ⚠ Ingen inbyggd urblekning här (till skillnad från ActiveEffects'
 * egen `duration`) — `isEffectExpired` konsulteras av läsarna, inte av lagret.
 */
DODE.getWorldEffects = function ({ includeExpired = false } = {}) {
  const all = game.settings.get(game.system.id, "worldEffects") ?? [];
  return includeExpired ? all : all.filter((e) => !DODE.isEffectExpired(e));
};

DODE.addWorldEffect = async function (effect) {
  const all = game.settings.get(game.system.id, "worldEffects") ?? [];
  const record = { id: foundry.utils.randomID(), ...effect };
  await game.settings.set(game.system.id, "worldEffects", [...all, record]);
  return record;
};

DODE.removeWorldEffect = async function (id) {
  const all = game.settings.get(game.system.id, "worldEffects") ?? [];
  await game.settings.set(game.system.id, "worldEffects", all.filter((e) => e.id !== id));
};

/** Scen-effekter — en ren dataflagga på Scene-dokumentet, GM-only skrivning. */
DODE.getSceneEffects = function (scene, { includeExpired = false } = {}) {
  const all = scene?.getFlag(game.system.id, DODE.NAMED_EFFECTS_FLAG) ?? [];
  return includeExpired ? all : all.filter((e) => !DODE.isEffectExpired(e));
};

DODE.addSceneEffect = async function (scene, effect) {
  const all = scene.getFlag(game.system.id, DODE.NAMED_EFFECTS_FLAG) ?? [];
  const record = { id: foundry.utils.randomID(), ...effect };
  await scene.setFlag(game.system.id, DODE.NAMED_EFFECTS_FLAG, [...all, record]);
  return record;
};

DODE.removeSceneEffect = async function (scene, id) {
  const all = scene.getFlag(game.system.id, DODE.NAMED_EFFECTS_FLAG) ?? [];
  await scene.setFlag(game.system.id, DODE.NAMED_EFFECTS_FLAG, all.filter((e) => e.id !== id));
};

/**
 * Aktör-scopade GM-effekter — en aktörsflagga, samma form som scen/värld.
 * Tillkom 2026-08-05 för återhämtningseffekter: en besvärjelse måste kunna ge
 * en TIDSBEGRÄNSAD personlig bonus som överlever scenbyten (UC-R11,
 * AATERHAMTNING_ANVANDNINGSFALL.md) — skiljer sig från person-scope-villkor
 * (typ 4, CONFIG.statusEffects) genom att den bär ett VÄRDE (skillMod/clMod/
 * recoveryMod), inte bara ett sant/falskt.
 */
DODE.getActorEffects = function (actor, { includeExpired = false } = {}) {
  const all = actor?.getFlag(game.system.id, DODE.NAMED_EFFECTS_FLAG) ?? [];
  return includeExpired ? all : all.filter((e) => !DODE.isEffectExpired(e));
};

DODE.addActorEffect = async function (actor, effect) {
  const all = actor.getFlag(game.system.id, DODE.NAMED_EFFECTS_FLAG) ?? [];
  const record = { id: foundry.utils.randomID(), ...effect };
  await actor.setFlag(game.system.id, DODE.NAMED_EFFECTS_FLAG, [...all, record]);
  return record;
};

DODE.removeActorEffect = async function (actor, id) {
  const all = actor.getFlag(game.system.id, DODE.NAMED_EFFECTS_FLAG) ?? [];
  await actor.setFlag(game.system.id, DODE.NAMED_EFFECTS_FLAG, all.filter((e) => e.id !== id));
};

/**
 * Namngivna färdighetsmodifierare (skillMod) på scen-/världsnivå, för given
 * aktör. Samma add/multiply-semantik som `skillModifierTotals`
 * (actor-character.mjs) — den funktionen är den som faktiskt konsumerar detta,
 * det här är bara den delade uppslagslogiken.
 *
 * @param {Actor} actor
 * @param {Scene|null} scene Aktörens aktuella scen (null = ingen scenmatchning).
 * @returns {{totals: Record<string, number>, sources: Record<string, {label:string,value:number,operation:string}[]>}}
 */
DODE.namedSkillModEffects = function (actor, scene = null) {
  const effects = [
    ...(scene ? DODE.getSceneEffects(scene) : []),
    ...DODE.getWorldEffects()
  ].filter((e) => e.kind === "skillMod" && e.skillKey);
  const totals = {};
  const sources = {};
  for (const e of effects) {
    const op = e.operation === "multiply" ? "multiply" : "add";
    if (op === "add") {
      totals[e.skillKey] = (totals[e.skillKey] ?? 0) + (e.value ?? 0);
    } else {
      // Multiplikation appliceras på den ADDITIVA totalen så här långt —
      // ordningen (add sedan multiply) matchar hur DODE.magicCostMultiplier
      // och andra bonus×faktor-beräkningar redan görs i den här filen.
      totals[e.skillKey] = (totals[e.skillKey] ?? 0) * (e.value ?? 1);
    }
    (sources[e.skillKey] ??= []).push({ label: e.label ?? e.source ?? "Effekt", value: e.value, operation: op });
  }
  return { totals, sources };
};

/**
 * HP-/PSY-återhämtningsmodifierare (recoveryMod) från GM-effekter — person-,
 * scen- OCH världsscope, till skillnad från namedSkillModEffects ovan (bara
 * scen+värld). Se docs/dev/AATERHAMTNING_ANVANDNINGSFALL.md UC-R9–R15.
 *
 * @param {Actor} actor
 * @param {Scene|null} scene
 * @returns {{hp: {add:number, multiply:number}, psy: {add:number, multiply:number}}}
 */
DODE.recoveryModEffects = function (actor, scene = null) {
  const totals = { hp: { add: 0, multiply: 1 }, psy: { add: 0, multiply: 1 } };
  const effects = [
    ...(actor ? DODE.getActorEffects(actor) : []),
    ...(scene ? DODE.getSceneEffects(scene) : []),
    ...DODE.getWorldEffects()
  ].filter((e) => e.kind === "recoveryMod" && totals[e.resource]);
  for (const e of effects) {
    const bucket = totals[e.resource];
    if (e.operation === "multiply") bucket.multiply *= (e.value ?? 1);
    else bucket.add += (e.value ?? 0);
  }
  return totals;
};

/**
 * Situationella CL-modifierare (clMod) från scen+värld — för att blanda in i
 * `resolveAttack()`s `mods`-objekt (rolls/attack.mjs). Returnerar en enkel
 * summa, inte per-färdighet, eftersom CL-mods är slagspecifika snarare än
 * bundna till en namngiven färdighet.
 */
DODE.situationalClMods = function (actor, sceneId = null) {
  const scene = sceneId ? game.scenes?.get(sceneId) : (game.scenes?.active ?? canvas?.scene ?? null);
  const effects = [
    ...(scene ? DODE.getSceneEffects(scene) : []),
    ...DODE.getWorldEffects()
  ].filter((e) => e.kind === "clMod");
  return effects.reduce((sum, e) => sum + (e.value ?? 0), 0);
};

/**
 * Aktörens aktiva villkor (statuseffekter) — tunn wrapper runt Foundrys egen
 * `Actor#statuses` (ett Set av CONFIG.statusEffects-id:n med en aktiv
 * ActiveEffect just nu). Se DODE_conditions/Token HUD, inte ett eget lager.
 */
DODE.actorConditions = function (actor) {
  return actor?.statuses ?? new Set();
};

/**
 * Ambidextriös-undantaget — CLAUDE.md "Beslutade avsteg", Johan 2026-08-04:
 * en Ambidextriös rollperson hoppar över Två vapen-träningskravet helt (RP:s
 * egen definition av Ambidextriös — "bägge händerna samtidigt ... utan några
 * som helst problem" — tolkas som att redan uppfylla vad färdigheten
 * representerar). Dubbelhänt får INTE samma genväg (RP s.27: "dock inte
 * samtidigt", precis den kvalitet Två vapen kräver).
 */
DODE.canDualWieldWithoutTraining = function (actor) {
  return actor?.system?.swordHand === "ambidextrios";
};

/**
 * Periodiska effekter (kind:"periodic") — person-scopade, till skillnad från
 * skillMod/clMod ovan. En förgiftad karaktär är EN specifik aktörs problem,
 * inte scenens eller världens — så det här lagret är en flagga på AKTÖREN,
 * inte scen-/världseffekt-listorna. Se docs/dev/GM_EFFEKTFONSTER_ANALYS.md:
 * ingen inbyggd Foundry-mekanism gör "skada en gång per runda/timme/dygn,
 * sedan sluta" — ActiveEffect-lägen (ADD/MULTIPLY) är statiska/kontinuerliga.
 *
 * Radform: {id, label, cadence:"round"|"hour"|"day", target:"hp"|skillKey,
 *   amount, ticksRemaining, source, onsetAt (worldTime periodens aktivering)}
 */
DODE.PERIODIC_EFFECTS_FLAG = "periodicEffects";

// Bara de källor som redan har en tydlig Foundry-kärn-ikonmotsvarighet.
// Utökas efter behov, inte en fullständig katalog — se planen "Stridsflödets
// 'smoothness'" (Claude-planarkivet), Del 4.
const PERIODIC_STATUS_ICONS = { poison: "poison", eld: "burning", blodning: "bleeding" };

/**
 * Synkar en periodeffektkällas Foundry-statusikon mot FAKTISKT kvarvarande
 * effekter på aktören — anropas efter varje add/remove/utgång. Räknar alltid
 * om från grunden (i stället för att varje anropsplats själv ska hålla reda
 * på "gick just DEN HÄR till 0 nu") — skyddar mot att en andra giftkälla
 * tystnar ikonen när bara den FÖRSTA klingar av. `actor.toggleStatusEffect`
 * (Foundry-kärna) är idempotent, så ett onödigt anrop är ofarligt.
 *
 * ⚠ Bara riktningen periodeffekt → ikon byggs. Den omvända riktningen (SL
 * klickar ikonen manuellt → ska det SKAPA en periodeffekt?) skulle kräva att
 * gissa severity/ticks, precis den sortens gissning `applyPoisonEffect`
 * medvetet vägrar göra — medvetet utanför scope.
 */
async function syncPeriodicStatusIcon(actor, source) {
  const iconId = PERIODIC_STATUS_ICONS[source];
  if (!iconId || !actor) return;
  const stillActive = DODE.getPeriodicEffects(actor).some((e) => PERIODIC_STATUS_ICONS[e.source] === iconId);
  await actor.toggleStatusEffect(iconId, { active: stillActive });
}

DODE.getPeriodicEffects = function (actor) {
  return actor?.getFlag(game.system.id, DODE.PERIODIC_EFFECTS_FLAG) ?? [];
};

DODE.addPeriodicEffect = async function (actor, effect) {
  const all = DODE.getPeriodicEffects(actor);
  const record = { id: foundry.utils.randomID(), ...effect };
  await actor.setFlag(game.system.id, DODE.PERIODIC_EFFECTS_FLAG, [...all, record]);
  await syncPeriodicStatusIcon(actor, record.source);
  return record;
};

DODE.removePeriodicEffect = async function (actor, id) {
  const all = DODE.getPeriodicEffects(actor);
  const removed = all.find((e) => e.id === id);
  await actor.setFlag(game.system.id, DODE.PERIODIC_EFFECTS_FLAG, all.filter((e) => e.id !== id));
  if (removed) await syncPeriodicStatusIcon(actor, removed.source);
};

/**
 * Per-aktör kö för `tickPeriodicEffect` — se funktionens egen kommentar för
 * varför den här behövs. Modulnivå, inte på `DODE`, med avsikt: rent internt
 * synkroniseringstillstånd, inte en del av det publika `CONFIG.DODE`-API:t.
 */
const _periodicTickQueues = new Map();
function _queuePerActor(actorId, task) {
  const prev = _periodicTickQueues.get(actorId) ?? Promise.resolve();
  const next = prev.then(task, task);
  _periodicTickQueues.set(actorId, next.catch(() => {}));
  return next;
}

/**
 * Tickar EN periodisk effekt `count` gånger på en gång (default 1 — ett
 * enskilt stridsrunde-tick; ett större `count` används av `advanceTime()` för
 * att lösa upp flera dagars/rundors ackumulerad effekt i ETT hopp i stället
 * för en loop, t.ex. "3 dagar strandsatt i öknen" utan att en Combat behöver
 * existera — se docs/dev/AATERHAMTNING_ANVANDNINGSFALL.md UC-R20 och Johans
 * uttryckliga fråga 2026-08-05 om hur SL hanterar kvarvarande gifttickar
 * UTANFÖR strid.
 *
 * Drar `amount × count` från HP eller en namngiven färdighets `system.bonus`
 * (ett negativt bonusfält, samma fält "Färdigheters bonus/total-fältmönster"
 * § session 8 redan använder för manuella justeringar), minskar
 * `ticksRemaining` med `count` (aldrig under 0), tar bort effekten helt när
 * den når 0.
 *
 * ⚠ **HP klampas INTE vid 0** — RP/SLB s.18-20:s dödsmodell (0 till −FYS:
 * blöder, ≤ −FYS: dör) kräver att KP kan gå negativt. Ett tidigare
 * `Math.max(0, ...)`-klamp här gjorde gift OFÖRMÖGET att döda, i strid mot
 * `anatomy.mjs#applyLocationDamage`, som redan aldrig klampar. Rättat
 * 2026-08-05 efter Johans fråga om hur en SL kan låta ett förgiftat offer dö
 * av exponering i öknen — svaret ska vara "ja, om giftet är dödligt nog",
 * inte "nej, motorn stoppar vid 0 oavsett".
 *
 * ⚠ **Serialiserad per aktör OCH läser färskt tillstånd vid körning, inte
 * vid anrop.** Rättat 2026-08-06 efter ett RIKTIGT canvas/token-drivet test
 * (Johan: "all characters should be on canvas with real test characters or
 * it cannot be considered a real test... hook tests are exactly the place
 * where things break") avslöjade att två snabbt påföljande
 * `combat.nextRound()`-anrop kunde tappa en tick helt TYST, utan
 * konsolfel: `combatRound`-hooken (dode.mjs) väntar INTE in föregående
 * hookanrops `await actor.update(...)` innan Foundry tillåter nästa runda,
 * så två överlappande anrop kunde båda läsa SAMMA gamla hp/ticksRemaining
 * och skriva samma nya värde två gånger. En tidigare hook-genvägstest
 * (`Hooks.callAll(...)` med en handkonstruerad `{combatants:[{actor}]}`,
 * ETT anrop i taget) kunde aldrig avslöja detta — bara en riktig sekvens av
 * riktiga `combat.nextRound()`-anrop mot en riktigt placerad, länkad token
 * gjorde det. HP- och flagg-uppdateringen slås nu ihop till EN atomär
 * `actor.update()` (i stället för två separata dokumentuppdateringar), och
 * en modulnivå-kö (`_queuePerActor`) tvingar överlappande anrop för SAMMA
 * aktör att köra i tur och ordning, var och en läsandes det just då senaste
 * tillståndet — inte ett argument som kan vara inaktuellt.
 */
DODE.tickPeriodicEffect = async function (actor, effect, count = 1) {
  return _queuePerActor(actor.id, async () => {
    const latest = DODE.getPeriodicEffects(actor).find((e) => e.id === effect.id);
    if (!latest) return; // redan borttagen av en tidigare tick i samma kö
    const applied = Math.min(count, latest.ticksRemaining ?? 1);
    if (applied <= 0) return;

    const remaining = (latest.ticksRemaining ?? 1) - applied;
    const currentEffects = DODE.getPeriodicEffects(actor);
    const nextEffects = remaining <= 0
      ? currentEffects.filter((e) => e.id !== latest.id)
      : currentEffects.map((e) => (e.id === latest.id ? { ...e, ticksRemaining: remaining } : e));

    if (latest.target === "hp") {
      const hp = actor.system.hp ?? {};
      await actor.update({
        "system.hp.value": (hp.value ?? hp.max ?? 0) - latest.amount * applied,
        [`flags.${game.system.id}.${DODE.PERIODIC_EFFECTS_FLAG}`]: nextEffects
      });
    } else {
      const item = actor.items.find((i) => i.type === "fardighet" && i.system.skillKey === latest.target);
      if (item) await item.update({ "system.bonus": (item.system.bonus ?? 0) - latest.amount * applied });
      await actor.setFlag(game.system.id, DODE.PERIODIC_EFFECTS_FLAG, nextEffects);
    }
    // Ikonsynk EFTER skrivningen ovan, så getPeriodicEffects() inuti den ser
    // det uppdaterade (ev. borttagna) tillståndet — bara relevant om denna
    // tick tömde effekten helt, men ofarligt att köra varje gång (idempotent).
    await syncPeriodicStatusIcon(actor, latest.source);
  });
};

/**
 * Löser upp ackumulerad periodisk effekt (gift m.fl.) när tiden flyttas
 * UTANFÖR strid — SL:s tidsfönster (`apps/time-window.mjs`/`advanceTime()`)
 * är den enda platsen tiden rör sig när ingen `Combat` är igång, och fram
 * till nu tickade `cadence:"round"`-effekter ENDAST via `combatRound`-hooken
 * (dode.mjs) — en förgiftad karaktär som lämnar striden slutade alltså ta
 * skada helt, oavsett hur mycket speltid som gick. Johan, 2026-08-05: en SL
 * måste kunna låta en strandsatt, förgiftad rollperson dö av exponering i
 * öknen utan att först tvinga fram en påhittad stridssituation.
 *
 * Konverterar förfluten tid till hela stridsrundor (`SECONDS_PER_ROUND`,
 * avrundat nedåt — en påbörjad runda räknas inte) och tickar varje
 * `"round"`-kadens-effekt på aktören i EN batch (se `tickPeriodicEffect`s
 * `count`-parameter) i stället för en runda-för-runda-loop. `"hour"`/
 * `"day"`-kadens har ingen sourcad användning ännu (bara Gift finns byggt,
 * och Gift använder alltid `"round"`) — lämnas orört tills ett verkligt
 * fall dyker upp, se docs/dev/GM_EFFEKTFONSTER_ANALYS.md.
 */
DODE.applyPeriodicTicksForElapsedTime = async function (actor, seconds) {
  const rounds = Math.floor(seconds / DODE.SECONDS_PER_ROUND);
  if (rounds < 1) return [];
  const applied = [];
  for (const effect of DODE.getPeriodicEffects(actor).filter((e) => e.cadence === "round")) {
    await DODE.tickPeriodicEffect(actor, effect, rounds);
    applied.push({ label: effect.label, ticks: Math.min(rounds, effect.ticksRemaining ?? 1) });
  }
  return applied;
};

/**
 * Gift — SL-boken s.50-51 (REGLER_STRID.md "Gift"). ⚠ **Effektnivån
 * (lindrig/måttlig/allvarlig/dödlig) avgörs av offrets FYS mot giftets STY på
 * "Motståndstabellen" — den tabellen är refererad överallt i källmaterialet
 * (minst 15 olika regler, Judo/Bola/Lasso/Härskri/Psykisk duell m.fl.) men
 * ALDRIG faktiskt transkriberad någonstans i det kurerade materialet (bara
 * "se grundreglerna"). Den kan alltså inte byggas här utan att gissa siffror
 * — se DESIGN_DECISIONS.md backlog. `severity` är därför ett explicit
 * SL-angivet argument, inte något den här funktionen räknar fram.**
 *
 * Det som ÄR fullt sourcat och byggs här: tidsfördröjningen till debut per
 * effektnivå, med giftets STY dragen av (STY 15 → "20" blir "5").
 *
 * @param {Actor} actor Offret.
 * @param {object} o
 * @param {"lindrig"|"mattlig"|"allvarlig"|"dodlig"} o.severity
 * @param {number} o.poisonSty
 * @param {number} [o.amount=1] Skada per tick.
 * @param {"hp"|string} [o.target="hp"]
 * @param {number} o.ticks Antal tickar innan giftet klingar av. ⚠ Ingen
 *   bokkälla hittad för det här talet heller — SL anger det, funktionen
 *   gissar inte ett standardvärde.
 */
DODE.applyPoisonEffect = async function (actor, { severity, poisonSty, amount = 1, target = "hp", ticks }) {
  if (!Number.isInteger(ticks) || ticks < 1) {
    throw new Error("applyPoisonEffect: `ticks` måste anges explicit av SL — ingen bokkälla för ett standardvärde.");
  }
  const highSty = poisonSty >= 30;
  const onsetTable = highSty
    ? { lindrig: { value: 1, unit: "SR" }, mattlig: { value: 2, unit: "SR" }, allvarlig: { value: 3, unit: "SR" }, dodlig: { value: 1, unit: "minut" } }
    : { lindrig: { value: 20, unit: "SR" }, mattlig: { value: 20, unit: "minut" }, allvarlig: { value: 20, unit: "timme" }, dodlig: { value: 20, unit: "dygn" } };
  const onset = onsetTable[severity];
  if (!onset) throw new Error(`applyPoisonEffect: okänd effektnivå "${severity}".`);
  // ⚠ STY dras bara av inom SAMMA enhet på under-30-grenen (RP:s exempel:
  // STY 15 → 20 SR blir 5 SR). Över-30-grenen ger inget avdrag i källan.
  const value = highSty ? onset.value : Math.max(1, onset.value - poisonSty);

  return DODE.addPeriodicEffect(actor, {
    label: `Gift (${severity})`,
    cadence: "round",
    target,
    amount,
    ticksRemaining: ticks,
    source: "poison",
    onsetDelay: { value, unit: onset.unit }
  });
};

/**
 * Motståndstabellen — SL s.34 / RP s.37-38. Källan för "se grundreglerna" som
 * refereras av ~15 olika regler (Judo, Bola, Lasso, Piska, Härskri, Psykisk
 * duell, gift, magiskt motstånd m.fl., se docs/extracts/DODE_Regler_
 * MOTSTANDSTABELLEN.md i Roll20-projektet för fulla tabellen och sourcingen)
 * — hittad och transkriberad 2026-08-05 efter att ha saknats helt tidigare.
 *
 * Två användningssätt av samma tabell (RP s.37, ordagrant): antingen slår
 * man mot en FAST svårighetsgrad (DODE.difficultyGrades) för en generisk
 * situation, eller mot en ANNAN VARELSES relevanta grundegenskap som SG —
 * det är vad ett "motståndslag" (X mot Y på Motståndstabellen) egentligen är.
 *
 * ⚠ Formeln är avläst ur tabellens eget mönster, inte tryckt som formel i
 * boken — verifierad cell för cell mot den tryckta tabellen (SG 1-21,
 * grundegenskap 1-21) innan den ersatte en uppslagstabell. Extrapolerar
 * korrekt bortom tryckets SG 21/värde 21-gräns ("21 osv").
 */
DODE.difficultyGrades = {
  "mycket-latt": 1, latt: 5, normalt: 10, svart: 15, "mycket-svart": 20, "extremt-svart": 25
};

/** @returns {number|null} Måltal för 1T20, `null` = automatiskt misslyckande, `Infinity` = automatisk framgång. */
DODE.resistanceTarget = function (sg, attributeValue) {
  const raw = attributeValue - sg + 10;
  if (raw < 1) return null;
  if (raw >= 20) return Infinity;
  return raw;
};

/**
 * Slår ett motståndsslag/grundegenskapsslag mot Motståndstabellen.
 * @param {number} sg Svårighetsgrad — en fast DODE.difficultyGrades-nivå,
 *   eller en motståndares relevanta grundegenskapsvärde för ett riktigt
 *   motståndslag (t.ex. giftets STY).
 * @param {number} attributeValue Den agerandes lämpliga grundegenskapsvärde.
 */
DODE.rollResistance = async function (sg, attributeValue) {
  const target = DODE.resistanceTarget(sg, attributeValue);
  if (target === null) return { roll: null, success: false, target, autoResult: "auto-miss" };
  if (target === Infinity) return { roll: null, success: true, target, autoResult: "auto-success" };
  const roll = await new Roll("1d20").evaluate();
  return { roll, success: roll.total <= target, target, autoResult: null };
};

/**
 * Löser motstånd/immunitet mot en skadetyp för en instant-effekt
 * (scripts/rolls/spell.mjs, Fas 2) — se fields-resistances.mjs för de tre
 * bokmönstren (Motståndskraft/Syraskydd/Blindskydd) den tolkar.
 *
 * ⚠ `incomingE` (kastarens effektgrad) används bara för `overcomeE`-fallet,
 * och avgörs med en RAK TALJÄMFÖRELSE — inget slag. Det är medvetet skilt
 * från DODE.rollResistance ovan: boken säger "övervinna MED E" för Blindskydd,
 * inte "slå ett motståndsslag", så en slumpkomponent hade varit fel mekanik,
 * inte bara en annan implementation av samma mekanik.
 *
 * @param {Actor} actor Mottagaren — läser `actor.system.resistances`.
 * @param {string} damageType
 * @param {number} [incomingE=0]
 * @returns {{reduction:number, immune:boolean, blocked:boolean}} `blocked` är
 *   det fältet att kolla för "ska effekten utebli helt" — `immune` speglar
 *   samma sak, kvar som ett separat, mer läsbart namn för anroparen.
 */
DODE.resolveResistance = function (actor, damageType, incomingE = 0) {
  const entry = (actor?.system?.resistances ?? []).find((r) => r.damageType === damageType);
  if (!entry) return { reduction: 0, immune: false, blocked: false };
  if (entry.reduction === "immun") {
    const blocked = entry.overcomeE == null || incomingE <= entry.overcomeE;
    return { reduction: 0, immune: blocked, blocked };
  }
  return { reduction: Number(entry.reduction) || 0, immune: false, blocked: false };
};

/**
 * Slår upp en namngiven RollTable direkt ur `tabeller`-kompendiet, oavsett om
 * SL råkat importera den till världens `game.tables` eller inte. Delad av
 * `rollFearTable`/`rollSnedtandningstabell`/`rollFobiTable` nedan.
 * @returns {Promise<RollTable|null>}
 */
async function getTabellerTable(name) {
  const pack = game.packs.get(`${game.system.id}.tabeller`);
  return pack ? (await pack.getDocuments()).find((t) => t.name === name) ?? null : null;
}

/**
 * Drar från Skräcktabellen (packs/tabeller, sourcad Magi-regelboken s.25) —
 * tabellen fanns redan, bara utan en dragningspunkt (se
 * docs/dev/MAGI_STRID_ANVANDNINGSFALL.md ⚠ RÄTTELSE 2026-08-21).
 * ⚠ Returnerar `{roll, result}` (Fas 4-tillägg, 2026-08-21) — INTE bara
 * resultatet som tidigare, så `roll` kan bifogas chattkortets `rolls`-array
 * och Dice So Nice faktiskt animerar draget. Alla anropare uppdaterade i
 * samma pass (spell.mjs).
 * @returns {Promise<{roll:Roll, result:TableResult}|null>}
 */
DODE.rollFearTable = async function () {
  const table = await getTabellerTable("Skräcktabell");
  if (!table) return null;
  const draw = await table.draw({ displayChat: false });
  return draw.results[0] ? { roll: draw.roll, result: draw.results[0] } : null;
};

/**
 * Drar från Fobitabellen (1T10) — bara relevant via Snedtändningstabellens
 * 20+-resultat, se `rollSnedtandningstabell` nedan.
 * @returns {Promise<{roll:Roll, result:TableResult}|null>}
 */
DODE.rollFobiTable = async function () {
  const table = await getTabellerTable("Fobitabellen");
  if (!table) return null;
  const draw = await table.draw({ displayChat: false });
  return draw.results[0] ? { roll: draw.roll, result: draw.results[0] } : null;
};

/**
 * Drar från Snedtändningstabellen (packs/tabeller, sourcad D&DE 0_Magi.pdf
 * s.8 — se docs/extracts/DODE_Magi_SNEDTANDNINGSTABELL.md, Roll20-projektet,
 * för det fulla kurerade underlaget; den kurerade docs/wiki/MAGI.md hade bara
 * en osourcad placeholder-tabell innan detta). Vid ETT fumlat kastningsslag
 * (`castSpell()`/`resolveSpellCast()`).
 *
 * ⚠ Formeln är BOKENS EGEN, inte en fri tolkning: "Slå 1T20 och addera
 * besvärjelsens effektgrad till resultatet" — därför tar funktionen emot `E`
 * och bygger en egen `Roll("1d20 + @E", {E})` i stället för att använda
 * tabellens lagrade `formula`-fält (bara "1d20", en rimlig fallback för en
 * SL som drar manuellt ur kompendiesidan utan att komma ihåg att lägga på E
 * själv — se tabellens egen beskrivningstext).
 *
 * ⚠ Bara DRAR och returnerar texten — tillämpar INGET mekaniskt (KP-avdrag,
 * blindhet/stumhet/förlamning-status, INT-sänkning). Samma nivå av
 * automatisering som Skräcktabellen redan har (en beskrivande dragning SL
 * tolkar, inte en fullt mekaniserad effektkedja) — en framtida utökning,
 * flaggad i backlog, inte den här passets omfattning.
 *
 * @param {number} effektgrad
 * @returns {Promise<{roll:Roll, result:TableResult, fobi:{roll:Roll,result:TableResult}|null}|null>}
 *   `fobi` är satt bara när huvudresultatet är den översta bucketen (20+,
 *   "Total minnesförlust"), som boken hänvisar vidare till Fobitabellen.
 */
DODE.rollSnedtandningstabell = async function (effektgrad) {
  const table = await getTabellerTable("Snedtändningstabellen");
  if (!table) return null;
  const roll = new Roll("1d20 + @E", { E: Math.max(1, Math.floor(effektgrad) || 1) });
  const draw = await table.draw({ roll, displayChat: false });
  const result = draw.results[0] ?? null;
  const fobi = result?.name === "Total minnesförlust" ? await DODE.rollFobiTable() : null;
  return result ? { roll: draw.roll, result, fobi } : null;
};

/**
 * Vapenstridens fyra fummeltabeller (Sköldar/Närstridsvapen/Avståndsvapen/
 * Obeväpnad strid) — Magisystem-planens Fas 6, 2026-08-21. Sourcad
 * Spelarboken (D&DE III) s.39-41, se docs/extracts/DODE_Spelarboken_
 * FUMMELTABELLER.md (Roll20-projektet) för fulla underlaget och tolkningen
 * av vilken tabell som gäller när (vapentyp, inte anfall/parering — flera
 * rader nämner uttryckligen "attack ELLER parering", samma tabell täcker båda).
 *
 * ⚠ Bara DRAGET/visat, ingen mekanisk tillämpning av effekttexten (CL-
 * avdrag, vapentapp, skada m.m.) — samma automatiseringsnivå som Skräck-/
 * Snedtändningstabellen redan har, SL tolkar och applicerar manuellt.
 */
const FUMMEL_TABLE_NAMES = {
  narstrid: "Fummeltabell för Närstridsvapen",
  avstand: "Fummeltabell för Avståndsvapen",
  obevapnad: "Fummeltabell för Obeväpnad strid",
  skold: "Fummeltabell för Sköldar"
};

async function drawFummelRow(table, rollsOut) {
  const draw = await table.draw({ displayChat: false });
  rollsOut.push(draw.roll);
  return draw.results[0] ?? null;
}

/**
 * Används bara för de TVÅ EXTRA dragningarna rad 20 utlöser — boken: "Slå två
 * gånger på tabellen och slå om ifall du slår '20' EN GÅNG TILL". Skild från
 * själva PRIMÄRDRAGET, vars egen 20:a alltid rapporteras (dess text ÄR
 * regeln som utlöser de två extra dragningarna, inte ett resultat att kasta bort).
 */
async function drawFummelRowNoTwenty(table, rollsOut) {
  let result = await drawFummelRow(table, rollsOut);
  while (result?.range?.[0] === 20) result = await drawFummelRow(table, rollsOut);
  return result;
}

/**
 * @param {"narstrid"|"avstand"|"obevapnad"|"skold"} tableKey
 * @returns {Promise<{primary:TableResult, extra:TableResult[], rolls:Roll[]}|null>}
 *   `extra` har 0 poster normalt, 2 om `primary` var rad 20 ("Rejäl klantighet").
 */
DODE.rollWeaponFummelTable = async function (tableKey) {
  const table = await getTabellerTable(FUMMEL_TABLE_NAMES[tableKey]);
  if (!table) return null;
  const rolls = [];
  const primary = await drawFummelRow(table, rolls);
  const extra = [];
  if (primary?.range?.[0] === 20) {
    extra.push(await drawFummelRowNoTwenty(table, rolls));
    extra.push(await drawFummelRowNoTwenty(table, rolls));
  }
  return { primary, extra, rolls };
};
