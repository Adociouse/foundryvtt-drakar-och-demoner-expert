const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const STEPS = ["kon", "niva", "grunder", "ras", "yrke", "attribut", "socialt", "kapital", "alder", "granska"];
const STEP_LABELS = {
  kon: "Kön",
  niva: "Nivå",
  grunder: "Namn",
  ras: "Ras",
  yrke: "Yrke",
  attribut: "Grundegenskaper",
  socialt: "Socialt stånd",
  kapital: "Startkapital",
  alder: "Ålder",
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
// Rollpersonsnivåer — REGEL_Hjalte.md, källa KH s.3. BP-talen hämtas från CONFIG.DODE.bpByNiva.
const NIVA_OPTIONS = [
  { value: "vanlig", label: "Vanlig", description: "En vanlig människa som levt ett vanligt liv — kan vara adlig eller skicklig men har inte utfört hjältedåd." },
  { value: "extraordinar", label: "Extraordinär", description: "Mer av en hjälte — har kanske redan utfört hjältedåd, och gudarna håller ett öga på henne eller honom." },
  { value: "hjalte", label: "Hjälte", description: "Utvald av gudarna, med högre egenskaper och färdigheter, för storslagna äventyr." }
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
 * Rollpersonsnivå (Vanlig/Extraordinär/Hjälte, KH s.3) väljs i steg 2 och driver
 * BP-poolen (125/150/175 — DODE.bpByNiva). En löpande BP-räknare visas på alla
 * steg (PLAN_WIZARD_V2.md Fas 2). Ras, socialt stånd och startkapital drar/ger
 * BP (Fas 2+3); särskilda förmågor och färdigheter har egna ledger-fält
 * förberedda i DataModel:en men spenderas inte än — deras wizard-steg byggs i
 * senare faser, se PLAN_WIZARD_V2.md.
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
 * Avgränsat bort denna omgång (se memory.md / PLAN_WIZARD_V2.md): EP-köp av
 * färdigheter, Livsmål, Särskilda förmågor.
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
    startCapital: { roll: 0, bpSpent: 0 }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const stepId = STEPS[this.stepIndex];

    const racePack = game.packs.get("drakar-och-demoner-expert.raser");
    const professionPack = game.packs.get("drakar-och-demoner-expert.yrken");
    const races = racePack ? await racePack.getDocuments() : [];
    const professions = professionPack ? await professionPack.getDocuments() : [];

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
      const raceMod = key === "sto" ? 0 : (raceMods[key] ?? 0);
      const ageMod = key === "sto" ? 0 : (ageMods[key] ?? 0);
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

  static async #onCreateCharacter() {
    const raceDoc = this.state.raceUuid ? await fromUuid(this.state.raceUuid) : null;
    const professionDoc = this.state.professionUuid ? await fromUuid(this.state.professionUuid) : null;

    const actor = await Actor.create({
      name: this.state.name || "Ny rollperson",
      type: "character",
      system: {
        kon: this.state.kon,
        niva: this.state.niva,
        bp: this.state.bp,
        socialStanding: this.state.socialStanding,
        startCapital: this.state.startCapital,
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
    if (itemsToCreate.length) await actor.createEmbeddedDocuments("Item", itemsToCreate);

    await this.close();
    actor.sheet.render(true);
  }
}
