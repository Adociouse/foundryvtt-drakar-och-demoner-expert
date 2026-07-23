const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const STEPS = ["kon", "niva", "grunder", "ras", "yrke", "attribut", "formagor", "socialt", "kapital", "alder", "fardigheter", "livsmal", "utrustning", "granska"];
const STEP_LABELS = {
  kon: "Kön",
  niva: "Nivå",
  grunder: "Namn",
  ras: "Ras",
  yrke: "Yrke",
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
      rollAllAttributes: DoDECharacterWizard.#onRollAllAttributes,
      selectKon: DoDECharacterWizard.#onSelectKon,
      selectNiva: DoDECharacterWizard.#onSelectNiva,
      selectRace: DoDECharacterWizard.#onSelectRace,
      selectProfession: DoDECharacterWizard.#onSelectProfession,
      rollSocialStanding: DoDECharacterWizard.#onRollSocialStanding,
      rollStartCapital: DoDECharacterWizard.#onRollStartCapital,
      buySkillFv: DoDECharacterWizard.#onBuySkillFv,
      sellSkillFv: DoDECharacterWizard.#onSellSkillFv,
      buyEquipment: DoDECharacterWizard.#onBuyEquipment,
      sellEquipment: DoDECharacterWizard.#onSellEquipment,
      createCharacter: DoDECharacterWizard.#onCreateCharacter
    },
    form: { handler: () => {}, submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    form: { template: "systems/drakar-och-demoner-expert/templates/apps/character-wizard.hbs" }
  };

  stepIndex = 0;

  state = {
    kon: "man",
    niva: "vanlig",
    name: "",
    ageCategory: "Mogen",
    attributes: { sty: null, sto: null, fys: null, smi: null, int: null, psy: null, kar: null },
    raceUuid: null,
    professionUuid: null,
    // BP-ledger — se klassdokblocket. spentSocialt/spentKapital lever INTE här —
    // de härleds från socialStanding.bpSpent/startCapital.bpSpent nedan (samma
    // enda-källa-princip som DataModellens prepareDerivedData använder).
    bp: { spentRas: 0, spentFormagor: 0, spentFardigheter: 0 },
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

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const stepId = STEPS[this.stepIndex];

    const racePack = game.packs.get("drakar-och-demoner-expert.raser");
    const professionPack = game.packs.get("drakar-och-demoner-expert.yrken");
    const equipmentPack = game.packs.get("drakar-och-demoner-expert.vapen-utrustning");
    const races = racePack ? await racePack.getDocuments() : [];
    const professions = professionPack ? await professionPack.getDocuments() : [];
    const equipmentDocs = equipmentPack ? await equipmentPack.getDocuments() : [];

    const selectedRace = this.state.raceUuid ? races.find((r) => r.uuid === this.state.raceUuid) : null;
    const selectedProfession = this.state.professionUuid
      ? professions.find((p) => p.uuid === this.state.professionUuid)
      : null;

    const effectiveAttributes = this.#effectiveAttributes(selectedRace, this.state.ageCategory);
    const requirementCheck = selectedProfession
      ? DoDECharacterWizard.#checkRequirements(selectedProfession.system.requirements, effectiveAttributes)
      : null;

    context.stepId = stepId;
    context.stepIndex = this.stepIndex;
    context.stepCount = STEPS.length;
    context.stepLabel = STEP_LABELS[stepId];
    context.isFirstStep = this.stepIndex === 0;
    context.isLastStep = this.stepIndex === STEPS.length - 1;
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
    context.showSocialt = stepId === "socialt";
    context.showKapital = stepId === "kapital";
    context.showGranska = stepId === "granska";
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
    context.startCapital = capitalResult;
    context.bp = this.#bpLedger(socialResult, capitalResult);
    const epBudget = this.#epResult(context.bp);
    context.races = races.map((r) => ({
      uuid: r.uuid, name: r.name, img: this.#genderedImg(r), system: r.system, selected: r.uuid === this.state.raceUuid
    }));
    context.professions = professions.map((p) => ({
      uuid: p.uuid, name: p.name, img: this.#genderedImg(p), system: p.system, selected: p.uuid === this.state.professionUuid
    }));
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
   * BP-pool efter vald nivå (KH s.3) minus det som spenderats hittills i guiden.
   * spentSocialt/spentKapital hämtas från socialStanding/startCapital-resultaten
   * (inte från state.bp) — samma enda-källa-princip som DataModellen använder.
   */
  #bpLedger(socialResult, capitalResult) {
    const spent = this.state.bp;
    const start = CONFIG.DODE.bpByNiva[this.state.niva] ?? CONFIG.DODE.bpByNiva.vanlig;
    const total = spent.spentRas + spent.spentFormagor + socialResult.bpSpent + capitalResult.bpSpent + spent.spentFardigheter;
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
    const buildEntry = (name, attribute, costTier) => {
      const baseFv = bc(attribute);
      const bought = this.state.fardigheter[name] ?? 0;
      const fv = baseFv + bought;
      const cost = CONFIG.DODE.skillCost(costTier, baseFv, fv);
      return { name, attribute, costTier, baseFv, fv, cost };
    };
    const primaryNames = new Set(CONFIG.DODE.primarySkills.map((s) => s.name.toLowerCase()));
    const primary = CONFIG.DODE.primarySkills.map((s) => buildEntry(s.name, s.attribute, "primar"));
    const professionSkills = (selectedProfession?.system?.professionSkills ?? [])
      .filter((s) => !primaryNames.has(s.name.toLowerCase()))
      .map((s) => buildEntry(s.name, s.attribute, "yrkesfardighet"));
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
    while (slots.length < n) slots.push({ name: "", source: "", description: "" });
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
      const price = doc.system.price ?? 0;
      return { uuid: doc.uuid, name: doc.name, img: doc.img, type: doc.type, price, qty };
    });
    const spent = items.reduce((sum, entry) => sum + entry.price * entry.qty, 0);
    const budget = capitalResult?.finalSm ?? 0;
    const remaining = budget - spent;
    for (const entry of items) {
      entry.canBuy = entry.price <= remaining;
      entry.canSell = entry.qty > 0;
    }
    return { items, budget, spent, remaining };
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
      case "alder": return !!this.state.ageCategory;
      case "attribut": return Object.values(this.state.attributes).every((v) => v !== null);
      case "yrke": return !!this.state.professionUuid;
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
    if (!this.#canAdvance(STEPS[this.stepIndex])) {
      ui.notifications.warn("Fyll i det här steget innan du går vidare.");
      return;
    }
    this.stepIndex = Math.min(this.stepIndex + 1, STEPS.length - 1);
    this.render();
  }

  static #onPrevStep() {
    this.stepIndex = Math.max(this.stepIndex - 1, 0);
    this.render();
  }

  static async #onRollAttribute(event, target) {
    const key = target.closest("[data-attr]")?.dataset.attr;
    if (!key) return;
    const roll = await new Roll("3d6").evaluate();
    this.state.attributes[key] = roll.total;
    this.render();
  }

  static async #onRollAllAttributes() {
    for (const key of ROLLABLE_ATTRIBUTES) {
      const roll = await new Roll("3d6").evaluate();
      this.state.attributes[key] = roll.total;
    }
    const sto = await new Roll("2d6+6").evaluate();
    this.state.attributes.sto = sto.total;
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
   * Köper +1 FV på en färdighet med EP — RP s.30. Knappen är redan `disabled`
   * i mallen när `skill.canIncrease` är falskt (inte nog EP kvar, eller
   * `maxStartFv` nådd), men `data-can-increase` speglas hit som en andra
   * spärr ifall action-anropet ändå triggas (t.ex. programmatisk klick vid
   * test) — ingen hård serverside-validering behövs för ett lokalt
   * wizard-state, men "lita inte blint på UI-disabled" är ändå god praxis.
   */
  static #onBuySkillFv(event, target) {
    const el = target.closest("[data-skill]");
    const name = el?.dataset.skill;
    if (!name || el.dataset.canIncrease !== "true") {
      ui.notifications.warn("Inte tillräckligt med EP kvar, eller max-FV vid skapande redan nådd.");
      return;
    }
    this.state.fardigheter[name] = (this.state.fardigheter[name] ?? 0) + 1;
    this.render();
  }

  /** Ångrar ett EP-köp på en färdighet (återbetalar EP:t implicit via omräkningen i #skillPreview). */
  static #onSellSkillFv(event, target) {
    const name = target.closest("[data-skill]")?.dataset.skill;
    if (!name) return;
    const current = this.state.fardigheter[name] ?? 0;
    if (current <= 0) return;
    this.state.fardigheter[name] = current - 1;
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

  static async #onCreateCharacter() {
    const raceDoc = this.state.raceUuid ? await fromUuid(this.state.raceUuid) : null;
    const professionDoc = this.state.professionUuid ? await fromUuid(this.state.professionUuid) : null;
    const effectiveAttributes = this.#effectiveAttributes(raceDoc, this.state.ageCategory);
    const socialResult = this.#socialStandingResult();
    const capitalResult = this.#startCapitalResult(socialResult);
    const bpLedger = this.#bpLedger(socialResult, capitalResult);
    const epBudget = this.#epResult(bpLedger);
    const skillPreview = this.#skillPreview(effectiveAttributes, professionDoc, epBudget);

    const actor = await Actor.create({
      name: this.state.name || "Ny rollperson",
      type: "character",
      system: {
        kon: this.state.kon,
        niva: this.state.niva,
        bp: this.state.bp,
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
    if (raceDoc) {
      const raceObj = raceDoc.toObject();
      raceObj.img = this.#genderedImg(raceDoc);
      itemsToCreate.push(raceObj);
    }
    if (professionDoc) {
      const professionObj = professionDoc.toObject();
      professionObj.img = this.#genderedImg(professionDoc);
      itemsToCreate.push(professionObj);
    }
    for (const skill of [...skillPreview.primary, ...skillPreview.professionSkills]) {
      itemsToCreate.push({
        name: skill.name,
        type: "fardighet",
        system: { attribute: skill.attribute, category: "a", fv: skill.fv, costTier: skill.costTier }
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
        "flags.dode.source": "age"
      }]);
    }

    await this.close();
    actor.sheet.render(true);
  }
}
