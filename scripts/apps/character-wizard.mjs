const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// ⚠ `attribut` ligger FÖRE `yrke` sedan 2026-07-28. Yrkenas grundegenskapskrav
// (YRKEN.md "Grundegenskapskrav", RP s.11) går annars inte att kontrollera vid
// valet — alla värden är null då, varje krav blir "overifierat" och kravkollen
// blir dekoration. Se DESIGN_DECISIONS.md §2-raden om yrkeskrav.
const ALL_STEPS = ["start", "kon", "niva", "grunder", "ras", "hand", "attribut", "yrke", "magiskola", "yrkesfardigheter", "formagor", "socialt", "kapital", "alder", "fardigheter", "livsmal", "utrustning", "granska"];
// Steg som hoppas över i redigeringsläge (befintlig rollperson). Utrustning är
// spelläge så fort rollpersonen finns — guiden kan inte skilja ett köp vid
// skapandet från ett fynd i en grotta, så att köra butiken igen skulle antingen
// dubblera utrustning eller radera loot. Köp efter skapandet hör hemma i en
// handlar-/butiksaktör istället, se DESIGN_DECISIONS.md §7.2 + backlogposten om
// butiksarkitektur.
const EDIT_MODE_SKIPPED_STEPS = ["utrustning"];
const STEP_LABELS = {
  start: "Översikt",
  kon: "Kön",
  niva: "Nivå",
  grunder: "Namn",
  ras: "Ras",
  hand: "Svärdshand",
  yrke: "Yrke",
  magiskola: "Magiskola",
  yrkesfardigheter: "Yrkesfärdigheter",
  attribut: "Grundegenskaper",
  formagor: "Särskilda förmågor",
  socialt: "Socialt stånd",
  kapital: "Startkapital",
  alder: "Ålder",
  fardigheter: "Färdigheter",
  livsmal: "Livsmål",
  utrustning: "Utrustning",
  granska: "Granska"
};
const AGE_CATEGORIES = ["Ung", "Mogen", "Medelålders", "Gammal"];
const ROLLABLE_ATTRIBUTES = ["sty", "fys", "smi", "int", "psy", "kar"];
// Kön — styr vilken imgMan/imgKvinna-variant som visas för ras/yrke i guiden
// (se #genderedImg). Ingen regelmekanik kopplad till valet i sig.
const KON_OPTIONS = [
  { value: "man", label: "Man", icon: "fa-mars" },
  { value: "kvinna", label: "Kvinna", icon: "fa-venus" }
];
// Rollpersonsnivåer — HH s.37-39 (fyra nivåer, narrativa kategorier utan egen
// mekanisk effekt utöver BP/EP-poolen — se DODE.bpByNiva i config.mjs).
// Bildsökvägarna pekar på assets/niva-<slug>.png (kopierade in för guiden).
const NIVA_OPTIONS = [
  { value: "vanlig", label: "Vanlig", description: "Ingen guds redskap. Ditt öde är ditt eget.", img: "systems/drakar-och-demoner-expert/assets/niva-vanlig.png" },
  { value: "slumpens-hjalte", label: "Slumpens hjälte", description: "Ödet grep in mitt i livet. Gudarnas redskap — men med fri vilja.", img: "systems/drakar-och-demoner-expert/assets/niva-slumpens-hjalte.png" },
  { value: "sann-hjalte", label: "Sann hjälte", description: "Vald vid första andetaget. Livet format av gudarna.", img: "systems/drakar-och-demoner-expert/assets/niva-sann-hjalte.png" },
  { value: "gudafodd", label: "Gudafödd", description: "Son eller dotter av en gud. Mäktigast. Sällsyntast. Ödets barn.", img: "systems/drakar-och-demoner-expert/assets/niva-gudafodd.png" }
];

/**
 * Guidad rollpersonsskapare — portning av mancer-flödet från dode-chargen (Roll20),
 * men bara de steg som är obekväma att göra direkt på arket: nivå/ras/yrke-val med
 * kravkontroll, och attributslag. Färdigheter och utrustning läggs till EFTER
 * guiden via arkets befintliga drag-släpp/"Ny färdighet"-funktioner (fas 2/3) —
 * ingen anledning att duplicera det flödet här.
 *
 * Kön (Man/Kvinna) väljs i steg 1, före nivå — styr bara vilken av item-ras/
 * item-yrkes `imgMan`/`imgKvinna`-porträttbilder som visas i ras-/yrkesstegen
 * och ärvs av de embeddade items när rollpersonen skapas (#genderedImg). Ingen
 * regelmekanik är kopplad till valet.
 *
 * Rollpersonsnivå (Vanlig/Slumpens hjälte/Sann hjälte/Gudafödd, HH s.37-39)
 * väljs i steg 2 och driver BP-poolen (125/150/175/200 — DODE.bpByNiva). En
 * löpande BP-räknare visas på alla steg (PLAN_WIZARD_V2.md Fas 2). Ras,
 * socialt stånd och startkapital drar/ger BP (Fas 2+3); särskilda förmågor och
 * färdigheter har egna ledger-fält förberedda i DataModel:en men spenderas
 * inte än — deras wizard-steg byggs i senare faser, se PLAN_WIZARD_V2.md.
 * De fyra nivåerna ÄR ödestypen — HH pp.37-39 anger ingen mekanisk effekt
 * kopplad till Öde-typen utöver KH:s BP/EP-nivåskala, så nivåvalet gör dubbel
 * tjänst istället för att vara en separat wizard-sektion.
 *
 * ⚠ Grundegenskaper spenderar INTE BP i den bokexakta modellen (de slås fram med
 * 3T6, RP s.9) — bara ras, särskilda förmågor, socialt stånd, startkapital och
 * (indirekt via EP) färdigheter gör det (RP s.27-30). Ingen BP-köp-attribut-väg
 * är därför byggd, medvetet — se PLAN_WIZARD_V2.md Fas 2.
 *
 * Socialt stånd/startkapital (Fas 3) implementerar RP s.27–28:s 2T6+BP/9-
 * ståndssystem — källdokumentet REGEL_SocialtStand.md drar själv slutsatsen att
 * det är auktoritativt för Expert, till skillnad från det tidigare aldrig
 * implementerade 1T20/4-ståndssystemet.
 *
 * Ålder (Fas 4) applicerar startkapitalets åldersmultiplikator (RP s.28, känd
 * tabell — `startCapital.finalSm` är nu slutgiltigt). Åldersmodifikationer på
 * grundegenskaper (RP s.24-25) är däremot en olöst forskningslucka — se
 * DODE.ageAttributeModifiers i config.mjs. Infrastrukturen (raceMod/ageMod-
 * uppdelning) finns och aktiveras automatiskt den dagen tabellen fylls i, men
 * ger `ageMod: 0` för alla åldrar tills dess. Gissa inte fram värden.
 *
 * EP-budgeten (Fas 5) räknas fram i `"alder"`-steget — nivå×ålder-tabell
 * (KH s.3/RP s.28) + kvarvarande BP × 5 (RP s.28) — och visas där, men inget
 * spenderar den ännu. `maxStartFv` (KH s.3, max FV en färdighet får ha vid
 * skapande) beräknas samtidigt, redo för Fas 6/7:s färdighetsköp.
 *
 * Färdigheter (Fas 6) auto-genereras i `"fardigheter"`-steget: de 16 primära
 * färdigheterna (RP s.36) + yrkets `professionSkills` (item-yrke.mjs), båda vid
 * bas-FV = BC (grupp av grundegenskapen, samma `DODE.attributeToGroup` som
 * DataModellens egen beräkning).
 *
 * EP-köp (Fas 7) sker i samma `"fardigheter"`-steg: varje färdighet har en
 * "+1 FV"/"−1 FV"-kontroll, kostnad enligt `DODE.skillCost` (RP s.30, kumulativ
 * tabell, INTE grundkostnad × antal steg). Knappen grånas (inte hård spärr på
 * något annat än sig själv) om EP inte räcker eller `maxStartFv` (KH s.3) är
 * nådd. `state.fardigheter[namn]` lagrar bara den köpta delen ovanpå BC — se
 * `#skillPreview`.
 *
 * Särskilda förmågor (Fas 8, MVP) — `"formagor"`-steget mellan `attribut` och
 * `socialt`. Antalet fritext-slots styrs av nivå (`DODE.abilityRollsByNiva`,
 * KH s.3 — samma tabell som BP), men VAD spelaren skriver i varje slot är fri
 * text, inte en tabellslagning — ingen komplett förmågetabell är extraherad
 * (forskningslucka, se item-yrke.mjs-liknande kommentar i actor-character.mjs).
 *
 * Livsmål (Fas 9) — `"livsmal"`-steget: dropdown över `DODE.lifeGoals` (21
 * poster) + ett fritextfält som skriver över listvalet om ifyllt. Utrustning
 * (Fas 9) — `"utrustning"`-steget: kort-rutnät över `vapen-utrustning`-
 * kompendiet (vapen+rustning i samma pack), köp/sälj drar `state.startCapital
 * .finalSm` ner mot 0, grånad "Köp" när priset överstiger kvarvarande kapital.
 * Ingen ny Item-schema behövdes — `vapen`/`rustning` hade redan `price`.
 *
 */
export default class DoDECharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dode-character-wizard",
    tag: "form",
    classes: ["dode", "sheet", "character-wizard"],
    position: { width: 640, height: 640 },
    window: { title: "Ny rollperson", resizable: true },
    actions: {
      nextStep: DoDECharacterWizard.#onNextStep,
      prevStep: DoDECharacterWizard.#onPrevStep,
      rollAttribute: DoDECharacterWizard.#onRollAttribute,
      pickAttributeCandidate: DoDECharacterWizard.#onPickAttributeCandidate,
      toggleProfessionSkill: DoDECharacterWizard.#onToggleProfessionSkill,
      clearProfessionSkills: DoDECharacterWizard.#onClearProfessionSkills,
      restartAttributes: DoDECharacterWizard.#onRestartAttributes,
      rollAllAttributes: DoDECharacterWizard.#onRollAllAttributes,
      selectKon: DoDECharacterWizard.#onSelectKon,
      selectNiva: DoDECharacterWizard.#onSelectNiva,
      selectRace: DoDECharacterWizard.#onSelectRace,
      selectProfession: DoDECharacterWizard.#onSelectProfession,
      selectMagicSchool: DoDECharacterWizard.#onSelectMagicSchool,
      rollSwordHand: DoDECharacterWizard.#onRollSwordHand,
      toggleHandGranted: DoDECharacterWizard.#onToggleHandGranted,
      rollSocialStanding: DoDECharacterWizard.#onRollSocialStanding,
      rollStartCapital: DoDECharacterWizard.#onRollStartCapital,
      buySkillFv: DoDECharacterWizard.#onBuySkillFv,
      sellSkillFv: DoDECharacterWizard.#onSellSkillFv,
      buyEquipment: DoDECharacterWizard.#onBuyEquipment,
      sellEquipment: DoDECharacterWizard.#onSellEquipment,
      rollFormaga: DoDECharacterWizard.#onRollFormaga,
      createCharacter: DoDECharacterWizard.#onSubmitWizard
    },
    form: { handler: () => {}, submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    form: { template: "systems/drakar-och-demoner-expert/templates/apps/character-wizard.hbs" }
  };

  /**
   * @param {object} [options]
   * @param {Actor} [options.actor]  Befintlig rollperson att redigera. Utelämnas
   *   vid nyskapande — `this.actor === null` är alltså skapaläget.
   */
  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    if (this.actor) this.#loadStateFromActor(this.actor);
  }

  get isEditMode() {
    return !!this.actor;
  }

  /**
   * Stegen som faktiskt visas. Två filter:
   *  - EDIT_MODE_SKIPPED_STEPS i redigeringsläge (utrustning).
   *  - `magiskola` bara för magikeryrken — en krigare ska inte tvingas igenom
   *    ett tomt magiskolesteg. Se #isMagicUser.
   */
  get steps() {
    let steps = ALL_STEPS;
    if (this.isEditMode) steps = steps.filter((s) => !EDIT_MODE_SKIPPED_STEPS.includes(s));
    if (!this.#isMagicUser) steps = steps.filter((s) => s !== "magiskola");
    return steps;
  }

  /**
   * Magikeryrke? Avgörs på yrkets namn eftersom magiskoletillhörighet inte är
   * ett schemafält på `yrke` — Magiker är det enda grundyrket med magiskolor
   * (MAGI.md), och specialiseringar som Paladin/Fingerkonstnär får sin magi via
   * sin yrkesförmåga, inte via en egen skola.
   * ⚠ Namnbaserat, och därmed samma lokaliseringsrisk som backlogpost 6a
   * beskriver — men här är namnet det enda vi har tills `yrke` får ett eget
   * fält. Noterat i backloggen.
   */
  /**
   * ⚠ Läser yrkets `system.magic.access`, INTE namnet. Fram till 2026-07-28
   * matchade detta på /magiker/i, vilket missade både **paladin** (Mentalism,
   * KH s.6) och **utbygdsjägare** (Animism, RP) — båda har magi. Se
   * backlogpost 12e och item-yrke.mjs för de tre behörighetsnivåerna.
   */
  get #magicAccess() {
    return this.#selectedProfessionDoc?.system?.magic ?? null;
  }

  get #isMagicUser() {
    return (this.#magicAccess?.access ?? "none") !== "none";
  }

  /** Bara "full" räknas som magiker i RP:s mening — 9 yrkesfärdigheter i stället för 12. */
  get #isFullMagician() {
    return (this.#magicAccess?.access ?? "none") === "full";
  }

  #selectedProfessionName = "";
  // Speglat av samma skäl som namnet ovan: yrkesfärdighetssteget behöver hela
  // dokumentet (professionSkills), men actions körs utanför _prepareContext.
  #selectedProfessionDoc = null;

  get title() {
    return this.isEditMode ? `Redigera: ${this.actor.name}` : "Ny rollperson";
  }

  stepIndex = 0;

  state = {
    kon: "man",
    niva: "vanlig",
    name: "",
    ageCategory: "Mogen",
    attributes: { sty: null, sto: null, fys: null, smi: null, int: null, psy: null, kar: null },
    // Tre framslagna kandidatvärden per grundegenskap när SL kört inställningen
    // "bestOfThree". Tomt i övriga lägen. Värdet i `attributes` sätts först när
    // spelaren klickat på en kandidat.
    attributeCandidates: { sty: [], sto: [], fys: [], smi: [], int: [], psy: [], kar: [] },
    raceUuid: null,
    professionUuid: null,
    // Vald magiskola (nyckel ur DODE.magicSchoolSkills) — materialiseras som en
    // vanlig `fardighet` vid skapandet, inte som ett eget fält på rollpersonen.
    magicSchoolKey: null,
    // Valda yrkesfärdigheter — RP s.11: spelaren väljer 12 av yrkets lista
    // (magiker 9). Varje post är { name, attribute, key, slotIndex }.
    // `slotIndex` !== null betyder att posten fyller en valfri plats
    // ("Maximalt fem valfria vapenfärdigheter"), annars är den en namngiven
    // färdighet ur listan.
    professionSkillPicks: [],
    // BP-ledger — se klassdokblocket. spentSocialt/spentKapital lever INTE här —
    // de härleds från socialStanding.bpSpent/startCapital.bpSpent nedan (samma
    // enda-källa-princip som DataModellens prepareDerivedData använder).
    bp: { spentRas: 0, spentFormagor: 0, spentFardigheter: 0 },
    // Svärdshand — RP s.27, samma 2T6+BP-mekanik som socialt stånd på samma sida.
    swordHand: { roll: 0, bpSpent: 0, granted: false },
    socialStanding: { roll: 0, bpSpent: 0 },
    startCapital: { roll: 0, bpSpent: 0 },
    // EP-köp (Fas 7) — namn på färdighet → antal FV köpta UTÖVER baschansen (BC).
    // Bara den köpta delen lagras här; BC self räknas alltid om från effektiva
    // attribut i #skillPreview, så ett omkastat attributslag eller rasbyte
    // aldrig lämnar en färdighet med en stale bas-FV.
    fardigheter: {},
    // Särskilda förmågor (Fas 8, MVP) — fritext-slots, storleken styrs av
    // DODE.abilityRollsByNiva[niva] och synkas i #specialAbilitySlots() varje
    // render (inte här vid init) eftersom den beror på ett värde som kan ändras.
    specialAbilities: [],
    // Livsmål (Fas 9) — lifeGoal är dropdown-valet (en av DODE.lifeGoals),
    // lifeGoalCustom är fritext som skriver över det om ifyllt (se
    // #onCreateCharacter). Två separata fält istf att skriva fritext direkt i
    // samma fält som dropdownen, så ett tidigare listval inte tyst skrivs över
    // av ett tomt fritextfält (bara ifyllt fritext vinner, se villkoret nedan).
    lifeGoal: "",
    lifeGoalCustom: "",
    // Utrustning (Fas 9) — uuid → antal köpta. Bara den köpta mängden lagras;
    // pris/kapital räknas om varje render i #equipmentResult, samma
    // enda-källa-princip som resten av guiden.
    equipment: {}
  };

  /**
   * Slår upp alla dokument för en nyckel i CONFIG.DODE.contentPacks (t.ex.
   * "races"), sammanslaget över samtliga registrerade packs — så att en
   * kampanjmodul kan bidra med eget innehåll utan systemändring. Se
   * config.mjs's kommentar vid DODE.contentPacks och DESIGN_DECISIONS.md §7.5.
   *
   * Packs som saknas (avinstallerad modul) eller som den aktuella användaren
   * inte får läsa hoppas tyst över — ett dolt pack ska degradera guiden, inte
   * krascha den.
   */
  static async #resolveContentPacks(key) {
    const packIds = CONFIG.DODE.contentPacks?.[key] ?? [];
    const docs = [];
    for (const packId of packIds) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      if (!pack.testUserPermission(game.user, "OBSERVER")) continue;
      docs.push(...(await pack.getDocuments()));
    }
    return docs;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const steps = this.steps;
    const stepId = steps[this.stepIndex];

    const races = await DoDECharacterWizard.#resolveContentPacks("races");
    const professions = await DoDECharacterWizard.#resolveContentPacks("professions");
    // Utrustningssteget filtrerar dessutom bort allt som bär ActiveEffects —
    // se #resolveContentPacks och DESIGN_DECISIONS.md §7.5.
    const equipmentDocs = (await DoDECharacterWizard.#resolveContentPacks("startingEquipment"))
      .filter((doc) => doc.effects.size === 0);

    // Redigeringsläge: koppla ihop embeddad ras/yrke med kompendiedokumentet
    // innan något annat räknas ut — annars beräknas baschansen utan rasbonus.
    this.#resolveMissingSources(races, professions);

    const selectedRace = this.state.raceUuid ? races.find((r) => r.uuid === this.state.raceUuid) : null;
    const selectedProfession = this.state.professionUuid
      ? professions.find((p) => p.uuid === this.state.professionUuid)
      : null;

    const effectiveAttributes = this.#effectiveAttributes(selectedRace, this.state.ageCategory);
    // Redigeringsläge: färdighetsladdningen behöver BC, som i sin tur behöver
    // det uppslagna rasdokumentet — därför först här, inte i #loadStateFromActor.
    this.#loadBoughtSkillFv(effectiveAttributes);
    const requirementCheck = selectedProfession
      ? DoDECharacterWizard.#checkRequirements(selectedProfession.system.requirements, effectiveAttributes)
      : null;

    context.stepId = stepId;
    // 1-baserat i UI:t. Låg tidigare rått (0-baserat), vilket gav "Steg 0/15"
    // så fort översiktssidan lades till och var av-med-ett även innan dess.
    context.stepIndex = this.stepIndex;
    context.stepNumber = this.stepIndex + 1;
    context.stepCount = steps.length;
    context.stepLabel = STEP_LABELS[stepId];
    context.isFirstStep = this.stepIndex === 0;
    context.isLastStep = this.stepIndex === steps.length - 1;
    // Redigeringsläge: ras/yrke visas men går inte att byta (se klassdokblocket
    // och DESIGN_DECISIONS.md backlog 4c) — byte sker via drag-släpp på arket.
    context.isEditMode = this.isEditMode;
    context.showStart = stepId === "start";
    // Slagläge + kandidater till attributsteget.
    context.rollMode = this.#rollModeSetting();
    context.isBestOfThree = context.rollMode === "bestOfThree";
    context.canReroll = context.rollMode !== "standard";
    context.attributeRows = [...ROLLABLE_ATTRIBUTES, "sto"].map((key) => ({
      key,
      label: key.toUpperCase(),
      formula: key === "sto" ? "2T6+6" : "3T6",
      value: this.state.attributes[key],
      rolled: this.state.attributes[key] !== null,
      candidates: (this.state.attributeCandidates?.[key] ?? []).map((v, i) => {
        const cs = CONFIG.DODE.candidateColorsets[i % CONFIG.DODE.candidateColorsets.length];
        return { value: v, chosen: v === this.state.attributes[key], color: cs.css, colorLabel: cs.label };
      })
    }));
    context.showKon = stepId === "kon";
    context.showNiva = stepId === "niva";
    context.showGrunder = stepId === "grunder";
    context.showRas = stepId === "ras";
    context.showAlder = stepId === "alder";
    context.showFardigheter = stepId === "fardigheter";
    context.showFormagor = stepId === "formagor";
    context.showLivsmal = stepId === "livsmal";
    context.showUtrustning = stepId === "utrustning";
    context.showAttribut = stepId === "attribut";
    context.showYrke = stepId === "yrke";
    context.showHand = stepId === "hand";
    context.showSocialt = stepId === "socialt";
    context.showKapital = stepId === "kapital";
    context.showGranska = stepId === "granska";
    context.showMagiskola = stepId === "magiskola";
    context.showYrkesfardigheter = stepId === "yrkesfardigheter";
    // Begränsa skolvalet till yrkets tillåtna skolor — paladinen får bara
    // Mentalism, utbygdsjägaren bara Animism. Tom lista = alla.
    const allowedSchools = this.#magicAccess?.schools ?? [];
    context.magicAccess = this.#magicAccess;
    context.magicSchools = CONFIG.DODE.magicSchoolSkills
      .filter((s) => !allowedSchools.length || allowedSchools.includes(s.school))
      .map((s) => ({
      key: s.key,
      label: game.i18n.localize(s.labelKey),
      img: s.img,
      selected: s.key === this.state.magicSchoolKey
    }));
    context.state = this.state;
    context.konOptions = KON_OPTIONS.map((option) => ({
      ...option,
      selected: option.value === this.state.kon
    }));
    context.nivaOptions = NIVA_OPTIONS.map((option) => ({
      ...option,
      bp: CONFIG.DODE.bpByNiva[option.value],
      selected: option.value === this.state.niva
    }));
    context.selectedNivaOption = context.nivaOptions.find((option) => option.selected) ?? null;
    const socialResult = this.#socialStandingResult();
    const capitalResult = this.#startCapitalResult(socialResult);
    context.socialStanding = socialResult;
    context.swordHand = this.#swordHandResult();
    context.swordHandOptions = CONFIG.DODE.swordHands;
    context.startCapital = capitalResult;
    context.bp = this.#bpLedger(socialResult, capitalResult);
    const epBudget = this.#epResult(context.bp);
    context.races = races.map((r) => ({
      uuid: r.uuid, name: r.name, img: this.#genderedImg(r), system: r.system,
      // Gruppmarkör från kompendiet, se grupperingen nedan.
      raceGroup: r.getFlag(game.system.id, "raceGroup") ?? "",
      selected: r.uuid === this.state.raceUuid
    }));
    context.professions = professions.map((p) => ({
      uuid: p.uuid, name: p.name, img: this.#genderedImg(p), system: p.system, selected: p.uuid === this.state.professionUuid
    }));
    // Gruppering — utan den blir 13 ras- och 36 yrkeskort ett oöverblickbart
    // platt rutnät.
    //
    // ⚠ Grupptillhörighet läses ur en FLAGGA på kompendieitemet, inte ur namnet.
    // Ett första försök matchade på namn (/alv$/) och drog med "Halvalv" — som
    // är en grundras från RP, inte ett alvsläkte ur Alver-supplementet. Samma
    // lärdom som backlogpost 6a: namn är inte identitet. Flaggan gör dessutom
    // att en kampanjmodul kan lägga sina egna raser i rätt grupp.
    const isElfLineage = (r) => r.raceGroup === "alvslakte";
    context.raceGroups = [
      { label: "Grundraser", races: context.races.filter((r) => !isElfLineage(r)) },
      { label: "Alvsläkten (Alver s.22)", races: context.races.filter(isElfLineage) }
    ].filter((g) => g.races.length);
    const PROFESSION_GROUPS = [
      ["", "Grundyrken"],
      ["krigare", "Krigarspecialiseringar (KH s.4-9)"],
      ["tjuv", "Tjuvspecialiseringar (T&L s.12-16)"],
      ["lonnmordare", "Lönnmördarspecialiseringar (T&L s.9-12)"],
      ["bard", "Bardspecialiseringar (T&L s.7-9)"]
    ];
    // Kravstatus per yrkeskort. Grundegenskaperna är slagna vid det här laget
    // (attribut-steget ligger före), så kontrollen är meningsfull.
    // ⚠ Ett omött krav SPÄRRAR inte valet, det märks bara upp. Med 3T6 landar en
    // rollperson ofta på 10-11 i allt, och då kvalificerar den för NOLL av de 36
    // yrkena — hård spärr hade låst spelaren ute helt. Boken låter SL avgöra;
    // guiden visar tydligt vad som inte är uppfyllt och låter bordet bestämma.
    const reqFor = (p) => DoDECharacterWizard.#checkRequirements(
      p.system.requirements, effectiveAttributes);
    context.professionGroups = PROFESSION_GROUPS
      .map(([base, label]) => ({
        label,
        professions: context.professions
          .filter((p) => (p.system.baseProfession ?? "") === base)
          .map((p) => {
            const check = reqFor(p);
            return { ...p, reqCheck: check, reqMet: check.allMet };
          })
      }))
      .filter((g) => g.professions.length);
    // Kan spelaren över huvud taget kvalificera sig för NÅGOT yrke? Med 3T6 och
    // lägsta krav 12 är svaret ibland nej — då erbjuds omslag i stället för
    // att spelaren kör fast (SL-inställning `allowRestartIfUnqualified`).
    const allProfessions = context.professionGroups.flatMap((g) => g.professions);
    context.attributesRolled = Object.values(this.state.attributes).every((v) => v !== null);
    context.noProfessionQualifies = context.attributesRolled
      && allProfessions.length > 0
      && !allProfessions.some((p) => p.reqMet);
    context.allowRestart = game.settings.get(game.system.id, "allowRestartIfUnqualified");
    context.qualifiedCount = allProfessions.filter((p) => p.reqMet).length;
    // Speglas till ett fält eftersom `steps` (som avgör om magiskolesteget
    // visas) är en synkron getter utan tillgång till de async-uppslagna yrkena.
    this.#selectedProfessionName = selectedProfession?.name ?? "";
    this.#selectedProfessionDoc = selectedProfession ?? null;
    context.professionSkillState = selectedProfession ? this.#professionSkillState() : null;
    // Förslagslista till de valfria platserna. Vapenfärdigheter har ingen egen
    // katalog i systemet — vapnen är Items — så vapennamnen ur kompendiet är
    // det närmaste en lista vi har. Fritext är tillåtet, listan är bara hjälp.
    context.weaponSuggestions = equipmentDocs
      .filter((d) => d.type === "vapen").map((d) => d.name).sort();
    context.selectedRace = selectedRace;
    context.selectedProfession = selectedProfession;
    context.ageCategories = AGE_CATEGORIES.map((c) => ({ value: c, selected: c === this.state.ageCategory }));
    context.rollableAttributes = ROLLABLE_ATTRIBUTES;
    context.attributes = CONFIG.DODE.attributes;
    context.effectiveAttributes = effectiveAttributes;
    context.requirementCheck = requirementCheck;
    const skillPreview = this.#skillPreview(effectiveAttributes, selectedProfession, epBudget);
    context.skillPreview = skillPreview;
    context.ep = {
      max: epBudget.max,
      maxStartFv: epBudget.maxStartFv,
      spent: skillPreview.epSpent,
      remaining: skillPreview.epRemaining
    };
    context.abilitySlots = CONFIG.DODE.abilityRollsByNiva[this.state.niva] ?? 1;
    context.specialAbilities = this.#specialAbilitySlots();
    context.specialAbilityNames = context.specialAbilities
      .map((a) => a.name.trim())
      .filter((name) => name.length > 0)
      .join(", ");
    context.lifeGoalOptions = CONFIG.DODE.lifeGoals.map((goal) => ({ value: goal, selected: goal === this.state.lifeGoal }));
    context.finalLifeGoal = this.state.lifeGoalCustom.trim() || this.state.lifeGoal;
    context.equipmentResult = this.#equipmentResult(equipmentDocs, capitalResult);
    context.canAdvance = this.#canAdvance(stepId);
    return context;
  }

  /**
   * Väljer ras/yrke-dokumentets porträttbild utifrån valt kön (steg 1).
   * `imgMan`/`imgKvinna` är valfria fält på item-ras.mjs/item-yrke.mjs — saknas
   * de (tomt fält) faller vi tillbaka på itemets vanliga `img`, inte ett kraschande
   * hål i UI:t.
   */
  #genderedImg(doc) {
    const variant = this.state.kon === "kvinna" ? doc.system?.imgKvinna : doc.system?.imgMan;
    return variant || doc.img;
  }

  /**
   * Fyller `state` från en befintlig rollperson (redigeringsläge). Motsatsen
   * till #onCreateCharacter — allt som skrivs där måste kunna läsas tillbaka
   * här, annars nollställs fältet tyst vid nästa sparning.
   *
   * ⚠ Utrustning laddas medvetet INTE (steget hoppas över, se
   * EDIT_MODE_SKIPPED_STEPS). `state.equipment` förblir tomt, och
   * #applyToActor rör aldrig aktörens föremål.
   */
  #loadStateFromActor(actor) {
    const sys = actor.system;
    this.state.name = actor.name ?? "";
    this.state.kon = sys.kon ?? "man";
    this.state.niva = sys.niva ?? "vanlig";
    this.state.ageCategory = sys.alder || "Mogen";
    this.state.lifeGoal = sys.lifeGoal ?? "";
    this.state.lifeGoalCustom = "";
    for (const key of Object.keys(this.state.attributes)) {
      // BAS-värdet, inte total — guiden lägger själv på ras-/åldersmod i sin
      // förhandsvisning (#effectiveAttributes). Att läsa `total` här skulle
      // baka in bonusen i basen och dubbla den vid varje sparning.
      this.state.attributes[key] = sys.attributes?.[key]?.value ?? null;
    }
    // Svärdshanden lagras bara som resultatet på aktören, inte som slag+insats —
    // vid redigering läses den därför tillbaka som en "given" hand, så guiden
    // inte ber om ett omslag av något som redan är bestämt.
    this.state.swordHand = { roll: 0, bpSpent: 0, granted: sys.swordHand ?? "hoger" };
    this.state.socialStanding = { roll: sys.socialStanding?.roll ?? 0, bpSpent: sys.socialStanding?.bpSpent ?? 0 };
    this.state.startCapital = { roll: sys.startCapital?.roll ?? 0, bpSpent: sys.startCapital?.bpSpent ?? 0 };
    this.state.bp = {
      spentRas: sys.bp?.spentRas ?? 0,
      spentFormagor: sys.bp?.spentFormagor ?? 0,
      spentFardigheter: sys.bp?.spentFardigheter ?? 0
    };
    this.state.specialAbilities = (sys.specialAbilities ?? []).map((a) => ({
      name: a.name ?? "", source: a.source ?? "", description: a.description ?? "",
      bpSpent: 1, rollResult: null
    }));

    // Ras/yrke: vi sätter en egen `flags.<sysid>.sourceUuid` när items skapas
    // (se #onCreateCharacter). ⚠ `_stats.compendiumSource` DUGER INTE ensamt —
    // Foundry fyller det bara vid riktig kompendieimport, inte när vi skapar ur
    // `toObject()`, så det är `null` på allt guiden själv byggt. Det ledde till
    // att redigeringsläget tappade ras/yrke helt (och därmed räknade baschansen
    // utan rasbonus). Sista utvägen är namnmatchning mot registret, vilket görs
    // asynkront i _prepareContext eftersom det kräver uppslagna packs.
    const raceItem = actor.items.find((i) => i.type === "ras");
    const yrkeItem = actor.items.find((i) => i.type === "yrke");
    this.state.raceUuid = raceItem?.getFlag(game.system.id, "sourceUuid")
      ?? raceItem?._stats?.compendiumSource ?? null;
    this.state.professionUuid = yrkeItem?.getFlag(game.system.id, "sourceUuid")
      ?? yrkeItem?._stats?.compendiumSource ?? null;
    this.#pendingSourceResolve = {
      race: this.state.raceUuid ? null : raceItem?.name ?? null,
      profession: this.state.professionUuid ? null : yrkeItem?.name ?? null
    };

    // Färdigheter: `state.fardigheter[namn]` är antal FV KÖPTA ÖVER baschansen.
    // Vi känner inte BC förrän attribut/ras är kända, så räkna om det här på
    // samma sätt som #skillPreview gör, och klampa till >= 0 (BC kan ha stigit
    // sedan skapandet, t.ex. via en rasändring på arket).
    this.state.fardigheter = {};
    this.#pendingSkillLoad = true;
  }

  /**
   * Andra halvan av färdighetsladdningen — kan först köras när ras-dokumentet
   * är uppslaget (async) och BC därmed går att räkna ut. Anropas från
   * _prepareContext första gången redigeringsläget renderas.
   */
  #loadBoughtSkillFv(effectiveAttributes) {
    if (!this.#pendingSkillLoad || !this.actor) return;
    const bc = (attribute) => {
      const total = effectiveAttributes[attribute]?.total;
      return total == null ? 0 : CONFIG.DODE.attributeToGroup(total);
    };
    for (const item of this.actor.items) {
      if (item.type !== "fardighet") continue;
      // Bara guidens egna kategorier laddas — "sekundar" (tillagda i spel,
      // via färdighetsväljaren eller av SL) ligger utanför guidens steg och
      // ska varken visas eller skrivas över. Se reconciliation-regeln i
      // DESIGN_DECISIONS.md backlog 4c.
      if (item.system.costTier === "sekundar") continue;
      // Magiskolan är en färdighet som skapades av magiskolesteget, inte av
      // #skillPreview — läs tillbaka valet så att steget visar rätt skola i
      // redigeringsläge, och hoppa över den i FV-laddningen nedan (den ingår
      // inte i skillPreview och skulle annars aldrig matcha).
      const schoolHit = CONFIG.DODE.magicSchoolSkills.find((s) => s.key === item.system.skillKey);
      if (schoolHit) {
        this.state.magicSchoolKey = schoolHit.key;
        continue;
      }
      const baseFv = bc(item.system.attribute);
      // Nyckel, inte namn (backlogpost 6a). Äldre färdigheter saknar
      // `skillKey` — härled den ur namnet så att de fortfarande matchar.
      const key = item.system.skillKey || CONFIG.DODE.skillKey(item.name);
      this.state.fardigheter[key] = Math.max(0, (item.system.fv ?? 0) - baseFv);
      // Redigeringsläge: återskapa yrkesfärdighetsvalen ur rollpersonens
      // befintliga färdigheter. Utan detta skulle steget öppnas tomt och
      // #skillPreview räkna om rollpersonen UTAN sina yrkesfärdigheter.
      // `slotIndex` sätts från yrkets lista när namnet inte är en namngiven
      // post — då fyllde färdigheten en valfri plats.
      if (item.system.costTier === "yrkesfardighet") {
        const list = this.#selectedProfessionDoc?.system?.professionSkills ?? [];
        const namedHit = list.findIndex(
          (e) => !e.choiceCount && (e.key || CONFIG.DODE.skillKey(e.name)) === key);
        const slot = namedHit >= 0 ? null : list.findIndex((e) => e.choiceCount);
        this.state.professionSkillPicks.push({
          key, name: item.name, attribute: item.system.attribute,
          slotIndex: namedHit >= 0 ? null : (slot >= 0 ? slot : null)
        });
      }
    }
    this.#pendingSkillLoad = false;
  }

  #pendingSkillLoad = false;
  #pendingSourceResolve = null;

  /**
   * Sista utvägen för att koppla en redan embeddad ras/yrke till sitt
   * kompendiedokument: matcha på namn. Körs bara när varken vår egen
   * `sourceUuid`-flagga eller `_stats.compendiumSource` finns — alltså för
   * rollpersoner skapade innan flaggan infördes.
   */
  #resolveMissingSources(races, professions) {
    if (!this.#pendingSourceResolve) return;
    const { race, profession } = this.#pendingSourceResolve;
    if (race && !this.state.raceUuid) {
      this.state.raceUuid = races.find((r) => r.name === race)?.uuid ?? null;
    }
    if (profession && !this.state.professionUuid) {
      this.state.professionUuid = professions.find((p) => p.name === profession)?.uuid ?? null;
    }
    this.#pendingSourceResolve = null;
  }

  /**
   * Standardvärden för rollpersonens porträtt + prototyptoken. Guiden satte
   * tidigare varken `img` eller `prototypeToken` alls, så varje skapad
   * rollperson fick Foundrys grå standardikon och en olänkad token utan syn.
   *
   * `actorLink: true` är det viktigaste fältet: för spelarrollpersoner ska
   * token och ark vara samma dokument, annars blir varje utplacerad token en
   * fristående kopia vars KP-ändringar inte syns på arket.
   *
   * bar1/bar2 sätts INTE här — de ärver `primaryTokenAttribute`/
   * `secondaryTokenAttribute` från system.json (hp respektive resources.psy),
   * vilket gäller alla aktörer och inte bara guidens.
   *
   * Porträttet ärvs från ras-/yrkesbilden (könsvarianten, se #genderedImg) —
   * yrket först eftersom det är mer utmärkande än rasen.
   */
  #tokenDefaults(raceDoc, professionDoc) {
    const portrait = professionDoc
      ? this.#genderedImg(professionDoc)
      : raceDoc
        ? this.#genderedImg(raceDoc)
        : null;
    const name = this.state.name || "Ny rollperson";
    const prototypeToken = {
      name,
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      sight: { enabled: true }
    };
    if (portrait) prototypeToken.texture = { src: portrait };
    return { img: portrait, prototypeToken };
  }

  /**
   * BP-pool efter vald nivå (KH s.3) minus det som spenderats hittills i guiden.
   * spentSocialt/spentKapital hämtas från socialStanding/startCapital-resultaten
   * (inte från state.bp) — samma enda-källa-princip som DataModellen använder.
   */
  #bpLedger(socialResult, capitalResult) {
    const spent = this.state.bp;
    const start = CONFIG.DODE.bpByNiva[this.state.niva] ?? CONFIG.DODE.bpByNiva.vanlig;
    // ⚠ Svärdshandens insats är också BP (RP s.27) och måste räknas med, annars
    // kan spelaren satsa 15 BP på handen och ändå ha kvar dem till startkapital.
    const handBp = this.state.swordHand.granted ? 0 : (Number(this.state.swordHand.bpSpent) || 0);
    const total = spent.spentRas + spent.spentFormagor + socialResult.bpSpent + capitalResult.bpSpent + spent.spentFardigheter + handBp;
    return { start, spent: total, remaining: start - total };
  }

  /**
   * EP-budget — RP s.28/KH s.3: nivå×ålder-tabell + kvarvarande BP × 5.
   * `maxStartFv` (KH s.3) är en ren tabellslagning, ingen persisterad ingång.
   * Speglar actor-character.mjs.
   */
  #epResult(bpLedger) {
    const budget = CONFIG.DODE.epBudgetTable[this.state.niva]?.[this.state.ageCategory] ?? 0;
    const max = budget + Math.max(0, bpLedger.remaining) * 5;
    const maxStartFv = CONFIG.DODE.maxStartFvTable[this.state.niva]?.[this.state.ageCategory] ?? null;
    return { max, maxStartFv };
  }

  /**
   * Svärdshand — RP s.27: 2T6 + spenderade BP → Höger/Vänster/Dubbelhänt/Ambidextriös.
   * ⚠ Fåtts handen som särskild förmåga slås inget alls.
   */
  #swordHandResult() {
    const { roll, bpSpent, granted } = this.state.swordHand;
    if (granted) {
      return { granted, key: granted, label: CONFIG.DODE.swordHands[granted],
        total: null, roll: 0, bpSpent: 0, noOffHandPenalty: CONFIG.DODE.hasNoOffHandPenalty(granted) };
    }
    const total = roll > 0 ? roll + (Number(bpSpent) || 0) : 0;
    const row = total > 0 ? CONFIG.DODE.swordHandFromRoll(total) : null;
    return {
      granted: false, roll, bpSpent: Number(bpSpent) || 0, total,
      key: row?.key ?? null, label: row?.label ?? null,
      noOffHandPenalty: row ? CONFIG.DODE.hasNoOffHandPenalty(row.key) : false
    };
  }

  /** Socialt stånd — RP s.27: 2T6 + spenderade BP. Speglar actor-character.mjs. */
  #socialStandingResult() {
    const { roll, bpSpent } = this.state.socialStanding;
    const total = roll > 0 ? roll + bpSpent : 0;
    const rank = roll > 0 ? CONFIG.DODE.socialStandingRank(total) : "";
    return { roll, bpSpent, total, rank };
  }

  /**
   * Startkapital — RP s.27-28: 2T6 + BP + halva socialt-stånd-BP:et, takat vid
   * (socialt ståndets slutsumma + 10), sedan multiplicerat med åldersmultiplikatorn
   * (RP s.28, känd tabell). Speglar actor-character.mjs.
   */
  #startCapitalResult(socialResult) {
    const { roll, bpSpent } = this.state.startCapital;
    const halfSocialBp = Math.ceil(socialResult.bpSpent / 2);
    const cap = socialResult.total + 10;
    const total = roll > 0 ? Math.min(roll + bpSpent + halfSocialBp, cap) : 0;
    const baseSm = roll > 0 ? CONFIG.DODE.startCapitalLookup(total) : 0;
    const capitalMultiplier = CONFIG.DODE.ageCapitalMultiplier[this.state.ageCategory] ?? 1;
    const finalSm = roll > 0 ? Math.round(baseSm * capitalMultiplier) : 0;
    return { roll, bpSpent, halfSocialBp, cap, total, baseSm, capitalMultiplier, finalSm };
  }

  /**
   * Beräknar attribut inkl. ras- och åldersmodifikation, för förhandsvisning
   * under guiden. `ageMod` blir 0 för alla åldrar tills DODE.ageAttributeModifiers
   * fylls i (forskningslucka, RP s.24-25) — se klassdokblocket.
   */
  #effectiveAttributes(selectedRace, ageCategory) {
    const raceMods = selectedRace?.system?.attributeMods ?? {};
    const ageMods = CONFIG.DODE.ageAttributeModifiers[ageCategory] ?? {};
    const result = {};
    for (const [key, value] of Object.entries(this.state.attributes)) {
      // STO: rasmoden är intervall-baserad (aldrig additiv), men åldersmoden appliceras.
      const raceMod = key === "sto" ? 0 : (raceMods[key] ?? 0);
      const ageMod = ageMods[key] ?? 0;
      const mod = raceMod + ageMod;
      const modParts = [];
      if (raceMod) modParts.push(`${raceMod} ras`);
      if (ageMod) modParts.push(`${ageMod} ålder`);
      result[key] = {
        base: value,
        raceMod,
        ageMod,
        mod,
        modLabel: modParts.join(" + "),
        total: value === null ? null : value + mod
      };
    }
    return result;
  }

  /**
   * Auto-tilldelade färdigheter — PLAN_WIZARD_V2.md Fas 6: de 16 primära
   * färdigheterna (RP s.36, DODE.primarySkills) + yrkets `professionSkills`
   * (item-yrke.mjs, se dess schemakommentar för forskningsluckan där inte alla
   * "tillåtna" färdigheter finns med). Bas-FV = BC = grupp av grundegenskapen
   * (REGLER_EGENSKAPER.md) — samma `DODE.attributeToGroup` som DataModellens
   * egna attributberäkning använder. Yrkesfärdigheter som redan är primära
   * hoppas över (annars skulle samma färdighetsnamn skapas två gånger på
   * samma rollperson) — filtrerat på namn, skiftlägesokänsligt.
   *
   * EP-köp (Fas 7): `state.fardigheter[namn]` är antal FV köpta UTÖVER BC.
   * Kostnaden att nå aktuell FV från BC räknas med `DODE.skillCost` (RP s.30,
   * kumulativ tabell — INTE grundkostnad × antal steg rakt av). `epSpent`
   * summeras över ALLA färdigheter samtidigt (delad EP-pool), så
   * `canIncrease` för en enskild färdighet alltid speglar den verkliga
   * kvarvarande poolen efter allt annat som redan köpts, inte en lokal
   * per-färdighet-budget.
   */
  #skillPreview(effectiveAttributes, selectedProfession, epBudget) {
    const bc = (attribute) => {
      const total = effectiveAttributes[attribute]?.total;
      return total == null ? 0 : CONFIG.DODE.attributeToGroup(total);
    };
    // ⚠ All matchning går på `skillKey`, aldrig på visningsnamnet — se
    // DODE.skillKey i config.mjs och backlogpost 6a. Yrkens `professionSkills`
    // (kompendiedata) saknar ännu explicita nycklar, så de härleds ur namnet;
    // konfigtabellernas nycklar är däremot frysta och överlever en omdöpning.
    const buildEntry = (key, name, attribute, costTier) => {
      const baseFv = bc(attribute);
      const bought = this.state.fardigheter[key] ?? 0;
      const fv = baseFv + bought;
      const cost = CONFIG.DODE.skillCost(costTier, baseFv, fv);
      return { key, name, attribute, costTier, baseFv, fv, cost };
    };
    const primaryKeys = new Set(CONFIG.DODE.primarySkills.map((s) => s.key));
    const primary = CONFIG.DODE.primarySkills.map((s) => buildEntry(s.key, s.name, s.attribute, "primar"));
    // ⚠ Bara de yrkesfärdigheter spelaren FAKTISKT valt (RP s.11: 12 av listan,
    // magiker 9) — inte hela yrkets lista. Före 2026-07-28 delades allt ut, vilket
    // gav en bard 24 yrkesfärdigheter i stället för 12 och sprängde EP-budgeten.
    // Valfria platser ("5× vapenfärdighet") bär spelarens inskrivna namn.
    const professionSkills = this.state.professionSkillPicks
      .map((s) => ({ ...s, key: s.key || CONFIG.DODE.skillKey(s.name) }))
      .filter((s) => s.name && !primaryKeys.has(s.key))
      .map((s) => buildEntry(s.key, s.name, s.attribute, "yrkesfardighet"));
    const all = [...primary, ...professionSkills];
    const epSpent = all.reduce((sum, entry) => sum + entry.cost, 0);
    const epRemaining = (epBudget?.max ?? 0) - epSpent;
    const maxStartFv = epBudget?.maxStartFv ?? null;
    for (const entry of all) {
      entry.canDecrease = entry.fv > entry.baseFv;
      entry.nextCost = maxStartFv != null && entry.fv < maxStartFv
        ? CONFIG.DODE.skillCost(entry.costTier, entry.fv, entry.fv + 1)
        : null;
      entry.canIncrease = entry.nextCost !== null && entry.nextCost <= epRemaining;
    }
    return { primary, professionSkills, total: all.length, epSpent, epRemaining, maxStartFv };
  }

  /**
   * Säkerställer att `state.specialAbilities` har exakt så många slots som
   * nivån ger rätt till (`DODE.abilityRollsByNiva`, KH s.3) — fyller på med
   * tomma poster om nivån höjts, kapar bakifrån (tar bort de senast tillagda,
   * inte godtyckliga) om nivån sänkts. Muterar `state.specialAbilities`
   * direkt (samma mönster som övriga state-synk i denna klass) så att
   * fält-bindningarna i _onRender pekar på samma array-referens som mallen
   * fick i sin context.
   */
  #specialAbilitySlots() {
    const n = CONFIG.DODE.abilityRollsByNiva[this.state.niva] ?? 1;
    const slots = this.state.specialAbilities;
    // bpSpent/rollResult är bara wizard-scratch för slå fram-knappen (se
    // #onRollFormaga) — actor.system.specialAbilities schemat (SchemaField)
    // har bara name/source/description, så extra nycklar rensas automatiskt
    // bort av Foundry vid #onCreateCharacter, ingen manuell strippning behövs.
    while (slots.length < n) slots.push({ name: "", source: "", description: "", bpSpent: 1, rollResult: null });
    if (slots.length > n) slots.length = n;
    return slots;
  }

  /**
   * Utrustning (Fas 9) — köp/sälj från `vapen-utrustning`-kompendiet (vapen+
   * rustning i samma pack), draget mot `state.startCapital.finalSm`. Ingen
   * `qty`-fält på Item-schemat (plan: "Ingen ny schema för utrustning") — antal
   * lagras bara i `state.equipment[uuid]`, materialiseras till N separata
   * embeddade kopior i #onCreateCharacter.
   */
  #equipmentResult(equipmentDocs, capitalResult) {
    const items = equipmentDocs.map((doc) => {
      const qty = this.state.equipment[doc.uuid] ?? 0;
      // `utrustning` prissätts i bokens eget myntslag och normaliseras till
      // silver i prepareDerivedData; vapen/rustning har ett rent sm-pris.
      // Startkapitalet är i silver, så allt jämförs i silver här.
      const price = doc.type === "utrustning" ? (doc.system.priceSm ?? 0) : (doc.system.price ?? 0);
      return {
        uuid: doc.uuid, name: doc.name, img: doc.img, type: doc.type, price, qty,
        category: doc.system.category ?? "",
        // Poster med fritextpris ("4 per kagge", "5 sm/g") har inget styckpris
        // och är referensdata — de får inte kunna köpas för 0 silver.
        priceLabel: doc.system.priceNote || `${price} sm`,
        purchasable: !doc.system.priceNote && price > 0
      };
    });
    const spent = items.reduce((sum, entry) => sum + entry.price * entry.qty, 0);
    const budget = capitalResult?.finalSm ?? 0;
    const remaining = budget - spent;
    for (const entry of items) {
      entry.canBuy = entry.purchasable !== false && entry.price <= remaining;
      entry.canSell = entry.qty > 0;
    }
    // Gruppering per kategori — utrustningssteget gick från 33 till 304 kort när
    // Magi-regelbokens listor portades (2026-07-28), och ett platt rutnät i den
    // storleken är obrukbart. Samma skäl som ras-/yrkesgrupperingen infördes för.
    // Vapen och rustning saknar `category` och samlas under egna rubriker först.
    const ORDER = ["vapen", "rustning", ...Object.keys(CONFIG.DODE.equipmentCategories)];
    const labelFor = (key) => {
      if (key === "vapen") return "Vapen";
      if (key === "rustning") return "Rustning";
      return game.i18n.localize(CONFIG.DODE.equipmentCategories[key] ?? key);
    };
    const buckets = new Map();
    for (const entry of items) {
      const key = entry.type === "utrustning" ? (entry.category || "diverse") : entry.type;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(entry);
    }
    const groups = ORDER
      .filter((key) => buckets.has(key))
      .map((key) => ({ key, label: labelFor(key), items: buckets.get(key) }));
    return { items, groups, budget, spent, remaining };
  }

  /**
   * Attributen är ofta null här — yrkessteget kommer före attributsteget i guidens
   * ordning (PLAN_WIZARD_V2.md Fas 1). Ett null-attribut betyder "inte kontrollerat
   * än", inte "kravet är brutet" — visa `unverified` separat från `met`/olyckat
   * `!met`, annars ser varje krav ut som ett rött kryss innan spelaren ens hunnit
   * slå tärningar.
   */
  static #checkRequirements(requirementText, effectiveAttributes) {
    if (!requirementText) return { text: "", entries: [], allMet: true };
    const re = /(STY|STO|FYS|SMI|INT|PSY|KAR)\s*(\d+)/gi;
    const entries = [];
    let match;
    while ((match = re.exec(requirementText))) {
      const key = match[1].toLowerCase();
      const required = Number(match[2]);
      const total = effectiveAttributes[key]?.total ?? null;
      const unverified = total === null;
      entries.push({ key: match[1], required, total, unverified, met: !unverified && total >= required });
    }
    return {
      text: requirementText,
      entries,
      allMet: entries.length === 0 || entries.every((e) => e.met || e.unverified)
    };
  }

  #canAdvance(stepId) {
    switch (stepId) {
      case "grunder": return this.state.name.trim().length > 0;
      case "ras": return !!this.state.raceUuid;
      case "hand": return !!this.state.swordHand.granted || this.state.swordHand.roll > 0;
      case "alder": return !!this.state.ageCategory;
      case "attribut": return Object.values(this.state.attributes).every((v) => v !== null);
      case "yrke": return !!this.state.professionUuid;
      case "magiskola": return !!this.state.magicSchoolKey;
      // Exakt så många som RP s.11 ger — annars går EP-budgeten inte ihop och
      // rollpersonen får fel antal yrkesfärdigheter.
      case "yrkesfardigheter": return this.state.professionSkillPicks.length >= this.#professionSkillTarget;
      case "socialt": return this.state.socialStanding.roll > 0;
      case "kapital": return this.state.startCapital.roll > 0;
      default: return true;
    }
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const nameInput = this.element.querySelector('[name="state.name"]');
    nameInput?.addEventListener("input", (ev) => {
      this.state.name = ev.target.value;
      const nextBtn = this.element.querySelector('[data-action="nextStep"]');
      if (nextBtn) nextBtn.disabled = !this.#canAdvance("grunder");
    });
    // Valfria platser i yrkesfärdighetssteget. Bindningen sker på `change`
    // (inte `input`) så att ett halvskrivet namn inte triggar en omrendering
    // mitt i skrivandet — samma skäl som färdighetsstegets fält.
    for (const field of this.element.querySelectorAll("[data-slot-index]")) {
      field.addEventListener("change", (ev) => {
        const slotIndex = Number(ev.target.dataset.slotIndex);
        const row = Number(ev.target.dataset.slotRow);
        const value = ev.target.value.trim();
        const picks = this.state.professionSkillPicks;
        const mine = picks.filter((p) => p.slotIndex === slotIndex);
        const existing = mine[row];
        if (!value) {
          if (existing) picks.splice(picks.indexOf(existing), 1);
        } else if (existing) {
          existing.name = value;
          existing.key = CONFIG.DODE.skillKey(value);
        } else {
          if (picks.length >= this.#professionSkillTarget) {
            ui.notifications.warn(`Du har redan valt ${this.#professionSkillTarget} yrkesfärdigheter.`);
            ev.target.value = "";
            return;
          }
          picks.push({
            key: CONFIG.DODE.skillKey(value), name: value,
            attribute: ev.target.dataset.slotAttribute || "int", slotIndex
          });
        }
        this.render();
      });
    }

    const ageSelect = this.element.querySelector('[name="state.ageCategory"]');
    ageSelect?.addEventListener("change", (ev) => {
      this.state.ageCategory = ev.target.value;
      this.render();
    });

    const socialBpInput = this.element.querySelector('[name="state.socialStanding.bpSpent"]');
    socialBpInput?.addEventListener("change", (ev) => {
      this.state.socialStanding.bpSpent = Math.max(0, Number(ev.target.value) || 0);
      this.render();
    });
    const capitalBpInput = this.element.querySelector('[name="state.startCapital.bpSpent"]');
    capitalBpInput?.addEventListener("change", (ev) => {
      this.state.startCapital.bpSpent = Math.max(0, Number(ev.target.value) || 0);
      this.render();
    });

    // Särskilda förmågor — fritext, ingen re-render vid varje tangenttryckning
    // (samma anledning som namnfältet ovan: skulle tappa fokus/markörposition).
    this.element.querySelectorAll("[data-ability-index]").forEach((el) => {
      el.addEventListener("input", (ev) => {
        const idx = Number(el.dataset.abilityIndex);
        const field = el.dataset.abilityField;
        if (this.state.specialAbilities[idx]) this.state.specialAbilities[idx][field] = ev.target.value;
      });
    });

    const lifeGoalSelect = this.element.querySelector('[name="state.lifeGoal"]');
    lifeGoalSelect?.addEventListener("change", (ev) => {
      this.state.lifeGoal = ev.target.value;
      this.render();
    });
    const lifeGoalCustomInput = this.element.querySelector('[name="state.lifeGoalCustom"]');
    lifeGoalCustomInput?.addEventListener("input", (ev) => {
      this.state.lifeGoalCustom = ev.target.value;
    });
  }

  static #onNextStep() {
    const steps = this.steps;
    if (!this.#canAdvance(steps[this.stepIndex])) {
      ui.notifications.warn("Fyll i det här steget innan du går vidare.");
      return;
    }
    this.stepIndex = Math.min(this.stepIndex + 1, steps.length - 1);
    this.render();
  }

  static #onPrevStep() {
    this.stepIndex = Math.max(this.stepIndex - 1, 0);
    this.render();
  }

  /**
   * Slår en grundegenskap och visar tärningarna.
   *
   * ⚠ Ett rent `new Roll(...).evaluate()` syns INTE någonstans — varken chattkort
   * eller 3D-tärningar. Fram till 2026-07-28 gjorde guiden precis det, så siffran
   * bara dök upp. `ChatMessage.create({ rolls: [roll] })` är husmönstret (samma som
   * fv-roll.mjs) och är dessutom det Dice So Nice kopplar in sig på — verifierat
   * mot DSN 6.2.9: guidens slag når `game.dice3d.showForRoll` med formeln "3d6".
   *
   * I tre-kandidatläget slås alla tre i EN pool-formel (`{3d6, 3d6, 3d6}`) i
   * stället för tre separata slag. Då ramlar alla nio tärningarna ner samtidigt
   * som en hink, vilket är både snabbare och det spelaren vill se — tre slag i
   * rad hade gett tre animationer efter varandra.
   */
  async #rollAttributeValues(key) {
    const die = key === "sto" ? "2d6+6" : "3d6";
    const best = this.#rollModeSetting() === "bestOfThree";
    const roll = await new Roll(best ? `{${die}, ${die}, ${die}}` : die).evaluate();
    if (best) {
      // Ett färgset per kandidat, så spelaren SER vilka tärningar som gav vilket
      // värde. Dice So Nice läser `options.colorset` per tärningsterm (verifierat
      // mot DSN 6.2.9); utan modulen ignoreras fältet helt.
      roll.terms[0].rolls.forEach((r, i) => {
        const cs = CONFIG.DODE.candidateColorsets[i % CONFIG.DODE.candidateColorsets.length];
        r.dice.forEach((d) => { d.options.colorset = cs.colorset; });
      });
    }
    const values = best
      ? roll.terms[0].rolls.map((r) => r.total)
      : [roll.total];
    return { values, roll };
  }

  #rollModeSetting() {
    return game.settings.get(game.system.id, "attributeRollMode");
  }

  /**
   * Ett samlat chattkort för en omgång slag, i stället för ett kort per
   * grundegenskap. "Slå alla" i tre-kandidatläget hade annars postat 21 kort.
   * `rolls` bär med alla Roll-objekt så att Dice So Nice animerar hela omgången.
   */
  async #postRollSummary(rows, rolls) {
    if (!game.settings.get(game.system.id, "showAttributeRollsInChat")) return;
    const best = this.#rollModeSetting() === "bestOfThree";
    const cols = CONFIG.DODE.candidateColorsets
      .map((c) => `<th style="color:${c.css}">${c.label}</th>`).join("");
    const head = best
      ? `<tr><th>Egenskap</th>${cols}<th>Vald</th></tr>`
      : "<tr><th>Egenskap</th><th>Slag</th></tr>";
    const body = rows.map((r) => {
      if (!best) return `<tr><td>${r.label}</td><td><strong>${r.values[0]}</strong></td></tr>`;
      const cells = r.values.map((v, i) => {
        const cs = CONFIG.DODE.candidateColorsets[i % CONFIG.DODE.candidateColorsets.length];
        return `<td style="color:${cs.css};font-weight:600">${v}</td>`;
      }).join("");
      return `<tr><td>${r.label}</td>${cells}<td>${r.chosen ?? "—"}</td></tr>`;
    }).join("");
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: this.state.name || "Ny rollperson" }),
      flavor: best ? "Grundegenskaper — tre kandidater per egenskap" : "Grundegenskaper",
      content: `<div class="dode-chat-card"><table class="dode-roll-table">${head}${body}</table></div>`,
      rolls,
      sound: CONFIG.sounds.dice
    });
  }

  static async #onRollAttribute(event, target) {
    const key = target.closest("[data-attr]")?.dataset.attr;
    if (!key) return;
    const { values, roll } = await this.#rollAttributeValues(key);
    if (values.length > 1) {
      // Värdet sätts först när spelaren klickat en kandidat — annars hade det
      // första slaget smugit in som ett val spelaren aldrig gjorde.
      this.state.attributeCandidates[key] = values;
      this.state.attributes[key] = null;
    } else {
      this.state.attributes[key] = values[0];
      this.state.attributeCandidates[key] = [];
    }
    await this.#postRollSummary([{ label: key.toUpperCase(), values, chosen: null }], [roll]);
    this.render();
  }

  /**
   * RP s.11: spelaren väljer **12** av yrkets möjliga yrkesfärdigheter — magiker
   * väljer **9**. Listar yrket färre än så tar man alla, så taket är
   * min(12, tillgängliga).
   */
  get #professionSkillTarget() {
    const doc = this.#selectedProfessionDoc;
    if (!doc) return 0;
    const list = doc.system.professionSkills ?? [];
    const available = list.reduce((n, s) => n + (s.choiceCount || 1), 0);
    return Math.min(this.#isFullMagician ? 9 : 12, available);
  }

  /** Byggd vy över yrkets lista + spelarens val. */
  #professionSkillState() {
    const doc = this.#selectedProfessionDoc;
    const list = doc?.system?.professionSkills ?? [];
    const picks = this.state.professionSkillPicks;
    const target = this.#professionSkillTarget;
    const named = [];
    const slots = [];
    list.forEach((entry, i) => {
      if (entry.choiceCount) {
        const filled = picks.filter((p) => p.slotIndex === i);
        slots.push({
          index: i, label: entry.name, pool: entry.choicePool,
          count: entry.choiceCount, attribute: entry.attribute,
          // En rad per plats: ifylld eller tom.
          rows: Array.from({ length: entry.choiceCount }, (_, n) => ({
            slotIndex: i, row: n, value: filled[n]?.name ?? ""
          }))
        });
      } else {
        const key = entry.key || CONFIG.DODE.skillKey(entry.name);
        named.push({
          key, name: entry.name, attribute: entry.attribute, index: i,
          picked: picks.some((p) => p.slotIndex === null && p.key === key)
        });
      }
    });
    return {
      named, slots, target,
      chosen: picks.length,
      remaining: Math.max(0, target - picks.length),
      complete: picks.length >= target,
      over: picks.length > target,
      isMagicUser: this.#isMagicUser
    };
  }

  static #onToggleProfessionSkill(event, target) {
    const key = target.dataset.key;
    if (!key) return;
    const picks = this.state.professionSkillPicks;
    const at = picks.findIndex((p) => p.slotIndex === null && p.key === key);
    if (at >= 0) {
      picks.splice(at, 1);
    } else {
      if (picks.length >= this.#professionSkillTarget) {
        ui.notifications.warn(`Du har redan valt ${this.#professionSkillTarget} yrkesfärdigheter — avmarkera en först.`);
        return;
      }
      picks.push({
        key, name: target.dataset.name, attribute: target.dataset.attribute, slotIndex: null
      });
    }
    this.render();
  }

  static #onClearProfessionSkills() {
    this.state.professionSkillPicks = [];
    this.render();
  }

  /** Väljer ett av de tre framslagna kandidatvärdena. */
  static #onPickAttributeCandidate(event, target) {
    const key = target.closest("[data-attr]")?.dataset.attr;
    const value = Number(target.dataset.value);
    if (!key || Number.isNaN(value)) return;
    this.state.attributes[key] = value;
    this.render();
  }

  static async #onRollAllAttributes() {
    const rows = [];
    const rolls = [];
    for (const key of [...ROLLABLE_ATTRIBUTES, "sto"]) {
      const { values, roll } = await this.#rollAttributeValues(key);
      rolls.push(roll);
      if (values.length > 1) {
        this.state.attributeCandidates[key] = values;
        this.state.attributes[key] = null;
      } else {
        this.state.attributes[key] = values[0];
        this.state.attributeCandidates[key] = [];
      }
      rows.push({ label: key.toUpperCase(), values, chosen: null });
    }
    await this.#postRollSummary(rows, rolls);
    this.render();
  }

  static async #onRestartAttributes() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Slå om alla grundegenskaper?" },
      content: "<p>Alla framslagna grundegenskaper nollställs och du slår om från början. "
        + "Övriga val (kön, nivå, namn, ras) behålls.</p>"
    });
    if (!ok) return;
    for (const key of [...ROLLABLE_ATTRIBUTES, "sto"]) {
      this.state.attributes[key] = null;
      this.state.attributeCandidates[key] = [];
    }
    this.stepIndex = this.steps.map((s) => s.id ?? s).indexOf("attribut");
    this.render();
  }

  static #onSelectKon(event, target) {
    this.state.kon = target.closest("[data-kon]")?.dataset.kon ?? this.state.kon;
    this.render();
  }

  static #onSelectNiva(event, target) {
    this.state.niva = target.closest("[data-niva]")?.dataset.niva ?? this.state.niva;
    this.render();
  }

  static async #onSelectRace(event, target) {
    this.state.raceUuid = target.closest("[data-uuid]")?.dataset.uuid ?? null;
    const raceDoc = this.state.raceUuid ? await fromUuid(this.state.raceUuid) : null;
    this.state.bp.spentRas = raceDoc?.system?.bpCost ?? 0;
    this.render();
  }

  static #onSelectProfession(event, target) {
    this.state.professionUuid = target.closest("[data-uuid]")?.dataset.uuid ?? null;
    this.render();
  }

  static #onSelectMagicSchool(event, target) {
    this.state.magicSchoolKey = target.closest("[data-school]")?.dataset.school ?? null;
    this.render();
  }

  /**
   * Svärdshand — RP s.27: 2T6 modifierat med antalet BP man väljer att spendera,
   * +1 per BP.
   *
   * ⚠ **Den dolda pärlan i regelverket** (Johan 2026-07-29): 15 BP ger 2T6+15 =
   * lägst 17, vilket garanterar minst **Dubbelhänt** och ger **Ambidextriös på
   * 33/36 ≈ 92 %**. Att köpa bort sin sämre hand tidigt sparar enormt mycket
   * senare, eftersom sköldhanden annars är genomgående sämre (SLB s.17: −10 CL).
   */
  static async #onRollSwordHand() {
    const bp = Math.max(0, Number(this.state.swordHand.bpSpent) || 0);
    const roll = await new Roll("2d6").evaluate();
    this.state.swordHand.roll = roll.total;
    if (game.settings.get(game.system.id, "showAttributeRollsInChat")) {
      await roll.toMessage({ flavor: `Svärdshand — 2T6 + ${bp} BP` });
    }
    this.render();
  }

  /**
   * ⚠ RP s.27: "Har du fått dubbelhänt eller ambidextriös som särskild förmåga
   * så behöver du inte slå på den här tabellen." Växeln hoppar över slaget helt.
   */
  static async #onToggleHandGranted(event, target) {
    this.state.swordHand.granted = target.dataset.value || false;
    this.state.swordHand.roll = 0;
    this.render();
  }

  static async #onRollSocialStanding() {
    const roll = await new Roll("2d6").evaluate();
    this.state.socialStanding.roll = roll.total;
    this.render();
  }

  static async #onRollStartCapital() {
    const roll = await new Roll("2d6").evaluate();
    this.state.startCapital.roll = roll.total;
    this.render();
  }

  /**
   * Slår fram en särskild förmåga — RP s.25-27, CONFIG.DODE.specialAbilitiesTable
   * (portad session 2026-07-27, se DESIGN_DECISIONS.md §3). "Du kan spendera
   * valfritt antal BP (minst 1, max +40). Slå 2T20 och addera spenderade BP."
   * BP-insatsen läses direkt från radens eget input (inte state-bunden via en
   * change-listener som övriga BP-fält) eftersom slaget bara ska ske vid
   * knapptryck, inte vid varje redigering av insatsen.
   */
  static async #onRollFormaga(event, target) {
    const idx = Number(target.dataset.index);
    const slot = this.state.specialAbilities[idx];
    if (!slot) return;
    const bpInput = this.element.querySelector(`[data-ability-bp-index="${idx}"]`);
    const bpSpent = Math.max(1, Math.min(40, Number(bpInput?.value) || 1));
    const roll = await new Roll(`2d20+${bpSpent}`).evaluate();
    const result = CONFIG.DODE.rollSpecialAbility(roll.total);

    slot.bpSpent = bpSpent;
    slot.rollResult = roll.total;
    if (result) {
      slot.name = result.name || `Förmåga (${roll.total})`;
      slot.description = result.description;
      slot.source = "bas"; // se schemakommentaren i actor-character.mjs — "bas" = grundboken (RP s.25-27)
    }

    this.state.bp.spentFormagor = this.state.specialAbilities.reduce(
      (sum, s) => sum + (s.bpSpent || 0),
      0
    );
    this.render();
  }

  /**
   * Köper +1 FV på en färdighet med EP — RP s.30. Knappen är redan `disabled`
   * i mallen när `skill.canIncrease` är falskt (inte nog EP kvar, eller
   * `maxStartFv` nådd), men `data-can-increase` speglas hit som en andra
   * spärr ifall action-anropet ändå triggas (t.ex. programmatisk klick vid
   * test) — ingen hård serverside-validering behövs för ett lokalt
   * wizard-state, men "lita inte blint på UI-disabled" är ändå god praxis.
   */
  static #onBuySkillFv(event, target) {
    const el = target.closest("[data-skill]");
    // `data-skill` bär färdighetens NYCKEL (skillKey), inte visningsnamnet.
    const key = el?.dataset.skill;
    if (!key || el.dataset.canIncrease !== "true") {
      ui.notifications.warn("Inte tillräckligt med EP kvar, eller max-FV vid skapande redan nådd.");
      return;
    }
    this.state.fardigheter[key] = (this.state.fardigheter[key] ?? 0) + 1;
    this.render();
  }

  /** Ångrar ett EP-köp på en färdighet (återbetalar EP:t implicit via omräkningen i #skillPreview). */
  static #onSellSkillFv(event, target) {
    const key = target.closest("[data-skill]")?.dataset.skill;
    if (!key) return;
    const current = this.state.fardigheter[key] ?? 0;
    if (current <= 0) return;
    this.state.fardigheter[key] = current - 1;
    this.render();
  }

  /** Köper 1 st av en utrustningspost — draget mot startCapital.finalSm, se #equipmentResult. */
  static #onBuyEquipment(event, target) {
    const el = target.closest("[data-uuid]");
    const uuid = el?.dataset.uuid;
    if (!uuid || el.dataset.canBuy !== "true") {
      ui.notifications.warn("Inte tillräckligt med startkapital kvar.");
      return;
    }
    this.state.equipment[uuid] = (this.state.equipment[uuid] ?? 0) + 1;
    this.render();
  }

  /** Säljer tillbaka 1 st (återbetalar kapitalet implicit via omräkningen i #equipmentResult). */
  static #onSellEquipment(event, target) {
    const uuid = target.closest("[data-uuid]")?.dataset.uuid;
    if (!uuid) return;
    const current = this.state.equipment[uuid] ?? 0;
    if (current <= 0) return;
    this.state.equipment[uuid] = current - 1;
    this.render();
  }

  /**
   * Guidens slutknapp. Skapaläge → #onCreateCharacter (oförändrad).
   * Redigeringsläge → #applyToActor, som ALDRIG skapar en ny aktör och aldrig
   * skapar om ras/yrke/utrustning (se klassdokblocket).
   */
  static async #onSubmitWizard() {
    if (this.isEditMode) return DoDECharacterWizard.#applyToActor.call(this);
    return DoDECharacterWizard.#onCreateCharacter.call(this);
  }

  /**
   * Sparar redigeringsläget tillbaka till en BEFINTLIG rollperson.
   *
   * ⚠ Kärnan i hela funktionen: ingenting får dubbleras. Att köra skaparvägen
   * igen hade gett en ANDRA ras-item — och eftersom rasbonusen är en
   * `transfer:true`-AE på det itemet hade rasbonusen applicerats två gånger
   * (exakt buggklassen som fixades i session 8). Därför:
   *   - Ras/yrke rörs inte alls (går inte att byta i redigeringsläge).
   *   - Utrustning rörs inte alls (steget hoppas över).
   *   - Ålders-AE:n rörs inte här — `updateActor`-hooken i dode.mjs sköter den
   *     automatiskt när `system.alder` ändras.
   *   - Färdigheter matchas på namn (skiftlägesokänsligt): uppdatera om de
   *     finns, skapa om de saknas, ta ALDRIG bort. "sekundar"-färdigheter
   *     (tillagda i spel) ligger utanför guidens steg och rörs aldrig.
   */
  static async #applyToActor() {
    const actor = this.actor;
    const raceDoc = this.state.raceUuid ? await fromUuid(this.state.raceUuid) : null;
    const professionDoc = this.state.professionUuid ? await fromUuid(this.state.professionUuid) : null;
    const effectiveAttributes = this.#effectiveAttributes(raceDoc, this.state.ageCategory);
    const socialResult = this.#socialStandingResult();
    const capitalResult = this.#startCapitalResult(socialResult);
    const bpLedger = this.#bpLedger(socialResult, capitalResult);
    const epBudget = this.#epResult(bpLedger);
    const skillPreview = this.#skillPreview(effectiveAttributes, professionDoc, epBudget);
    // Samma filtrerade lista som utrustningssteget använder (poster med
    // ActiveEffects är uteslutna där) — annars kan restkapitalet skilja sig
    // från det spelaren såg i steget.
    const shopDocs = (await DoDECharacterWizard.#resolveContentPacks("startingEquipment"))
      .filter((doc) => doc.effects.size === 0);
    const leftoverSm = this.#equipmentResult(shopDocs, capitalResult).remaining;

    await actor.update({
      name: this.state.name || actor.name,
      system: {
        kon: this.state.kon,
        niva: this.state.niva,
        bp: this.state.bp,
        swordHand: this.#swordHandResult().key ?? "hoger",
        socialStanding: this.state.socialStanding,
        startCapital: this.state.startCapital,
        // Kapitalet som blev över i utrustningssteget blir rollpersonens
        // faktiska börs. `startCapital` står kvar som skapandehistorik och
        // minskar aldrig; `currency` är det som spenderas i spel.
        currency: CONFIG.DODE.kmToPurse(CONFIG.DODE.silverToKm(Math.max(0, leftoverSm))),
        ep: { spent: skillPreview.epSpent },
        specialAbilities: this.state.specialAbilities
          .filter((a) => a.name.trim().length > 0)
          .map((a) => ({ name: a.name, source: a.source, description: a.description })),
        lifeGoal: this.state.lifeGoalCustom.trim() || this.state.lifeGoal,
        attributes: {
          sty: { value: this.state.attributes.sty },
          sto: { value: this.state.attributes.sto },
          fys: { value: this.state.attributes.fys },
          smi: { value: this.state.attributes.smi },
          int: { value: this.state.attributes.int },
          psy: { value: this.state.attributes.psy },
          kar: { value: this.state.attributes.kar }
        },
        alder: this.state.ageCategory
      },
      [`flags.${game.system.id}.wizardUnlocked`]: false
    });

    // Färdighetsavstämning — se dokblocket ovan.
    // ⚠ Matchning på NYCKEL, aldrig på visningsnamn (backlogpost 6a) — annars
    // skulle en rollperson skapad på ett språk och redigerad på ett annat tyst
    // få dubbletter. Äldre färdigheter utan `skillKey` får sin nyckel härledd
    // ur namnet, och backfillas nedan så att migreringen sker av sig själv.
    const existingByKey = new Map(
      actor.items
        .filter((i) => i.type === "fardighet")
        .map((i) => [i.system.skillKey || CONFIG.DODE.skillKey(i.name), i])
    );
    const toCreate = [];
    const toUpdate = [];
    for (const skill of [...skillPreview.primary, ...skillPreview.professionSkills]) {
      const existing = existingByKey.get(skill.key);
      if (existing) {
        const needsFv = existing.system.fv !== skill.fv;
        const needsTier = existing.system.costTier !== skill.costTier;
        const needsKey = existing.system.skillKey !== skill.key;
        if (needsFv || needsTier || needsKey) {
          toUpdate.push({
            _id: existing.id,
            "system.fv": skill.fv,
            "system.costTier": skill.costTier,
            "system.skillKey": skill.key
          });
        }
      } else {
        toCreate.push({
          name: skill.name,
          type: "fardighet",
          system: { skillKey: skill.key, attribute: skill.attribute, category: "a", fv: skill.fv, costTier: skill.costTier }
        });
      }
    }
    if (toUpdate.length) await actor.updateEmbeddedDocuments("Item", toUpdate);
    if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);

    ui.notifications.info(`${actor.name} uppdaterad via guiden.`);
    await this.close();
    actor.sheet.render(true);
  }

  static async #onCreateCharacter() {
    const raceDoc = this.state.raceUuid ? await fromUuid(this.state.raceUuid) : null;
    const professionDoc = this.state.professionUuid ? await fromUuid(this.state.professionUuid) : null;
    const effectiveAttributes = this.#effectiveAttributes(raceDoc, this.state.ageCategory);
    const socialResult = this.#socialStandingResult();
    const capitalResult = this.#startCapitalResult(socialResult);
    const bpLedger = this.#bpLedger(socialResult, capitalResult);
    const epBudget = this.#epResult(bpLedger);
    const skillPreview = this.#skillPreview(effectiveAttributes, professionDoc, epBudget);

    const { img, prototypeToken } = this.#tokenDefaults(raceDoc, professionDoc);

    const actor = await Actor.create({
      name: this.state.name || "Ny rollperson",
      type: "character",
      ...(img ? { img } : {}),
      prototypeToken,
      system: {
        kon: this.state.kon,
        niva: this.state.niva,
        bp: this.state.bp,
        swordHand: this.#swordHandResult().key ?? "hoger",
        socialStanding: this.state.socialStanding,
        startCapital: this.state.startCapital,
        ep: { spent: skillPreview.epSpent },
        // Bara ifyllda förmågerader sparas — tomma slots (spelaren lämnade en
        // eller flera outnyttjade) skräpar annars ner arkets kommande
        // förmågelista med tomma rader.
        specialAbilities: this.state.specialAbilities.filter((a) => a.name.trim().length > 0),
        lifeGoal: this.state.lifeGoalCustom.trim() || this.state.lifeGoal,
        attributes: {
          sty: { value: this.state.attributes.sty },
          sto: { value: this.state.attributes.sto },
          fys: { value: this.state.attributes.fys },
          smi: { value: this.state.attributes.smi },
          int: { value: this.state.attributes.int },
          psy: { value: this.state.attributes.psy },
          kar: { value: this.state.attributes.kar }
        },
        alder: this.state.ageCategory
      }
    });

    const itemsToCreate = [];
    // ⚠ `toObject()` bär INTE med sig `_stats.compendiumSource` — Foundry sätter
    // det bara vid riktig kompendieimport. Utan en egen källhänvisning kan
    // redigeringsläget inte koppla tillbaka den embeddade rasen/yrket till sitt
    // kompendiedokument (och räknar då baschansen utan rasbonus). Vi stämplar
    // därför en egen flagga; #loadStateFromActor läser den först.
    if (raceDoc) {
      const raceObj = raceDoc.toObject();
      raceObj.img = this.#genderedImg(raceDoc);
      foundry.utils.setProperty(raceObj, `flags.${game.system.id}.sourceUuid`, raceDoc.uuid);
      itemsToCreate.push(raceObj);
    }
    if (professionDoc) {
      const professionObj = professionDoc.toObject();
      professionObj.img = this.#genderedImg(professionDoc);
      foundry.utils.setProperty(professionObj, `flags.${game.system.id}.sourceUuid`, professionDoc.uuid);
      itemsToCreate.push(professionObj);
    }
    for (const skill of [...skillPreview.primary, ...skillPreview.professionSkills]) {
      itemsToCreate.push({
        name: skill.name,
        type: "fardighet",
        system: { skillKey: skill.key, attribute: skill.attribute, category: "a", fv: skill.fv, costTier: skill.costTier }
      });
    }
    // Magiskola — en skola ÄR en färdighet i regelverket (MAGI.md, se
    // DODE.magicSchoolSkills). FV höjs sedan med EP i färdighetssteget precis
    // som vilken annan yrkesfärdighet som helst.
    const school = CONFIG.DODE.magicSchoolSkills.find((s) => s.key === this.state.magicSchoolKey);
    if (school) {
      itemsToCreate.push({
        name: game.i18n.localize(school.labelKey),
        type: "fardighet",
        img: school.img,
        system: { skillKey: school.key, attribute: school.attribute, category: "a", fv: 1, costTier: "yrkesfardighet" }
      });
    }
    // Utrustning — en separat embeddad kopia per köpt enhet (Item-schemat har
    // inget `qty`-fält, se klassdokblocket). Låga MVP-kvantiteter förväntas
    // (vapen/rustning, inte staplade pilar), så detta är inget prestandaproblem.
    for (const [uuid, qty] of Object.entries(this.state.equipment)) {
      if (qty <= 0) continue;
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      // Varje köpt enhet måste bli ett eget embedded Item med eget _id — annars
      // kolliderar flera köp av samma kompendieföremål (samma _id från
      // toObject()) i en och samma createEmbeddedDocuments-anrop. `_id: null`
      // tvingar Foundry att generera ett nytt slumpat id per post.
      for (let i = 0; i < qty; i++) itemsToCreate.push({ ...doc.toObject(), _id: null });
    }
    if (itemsToCreate.length) await actor.createEmbeddedDocuments("Item", itemsToCreate);

    const ageMods = CONFIG.DODE.ageAttributeModifiers[this.state.ageCategory] ?? {};
    const ageAeChanges = Object.entries(ageMods)
      .filter(([, v]) => v !== 0)
      .map(([key, value]) => ({
        key: `system.attributes.${key}.bonus`,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: String(value)
      }));
    if (ageAeChanges.length) {
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        name: `Åldersmod (${this.state.ageCategory})`,
        changes: ageAeChanges,
        origin: "system.age",
        transfer: false,
        disabled: false,
        [`flags.${game.system.id}.source`]: "age"
      }]);
    }

    await this.close();
    actor.sheet.render(true);
  }
}
