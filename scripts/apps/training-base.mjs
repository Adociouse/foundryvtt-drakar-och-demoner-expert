import {
  ROLLS_PER_WEEK, allowedSources, trainingFee, runTrainingWeek, spendEp
} from "../helpers/training.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Gemensam bas för de två träningsfönstren.
 *
 * ⚠ Två fönster, inte ett — Johans beslut 2026-07-29. Magi och vanliga
 * färdigheter delar bara skalet: reglerna för VAR EP kommer ifrån skiljer sig
 * fundamentalt (SB s.7), veckoslaget räknas olika för ensamtränade besvärjelser,
 * och magirader har förutsättningar (skolans FV, magisk kodex) som en vanlig
 * färdighet saknar. Ett gemensamt fönster hade fyllts av villkor som bara gäller
 * hälften av raderna.
 *
 * Basen äger: viloperiodsgrinden, lägesväxeln ensam/lärare, radaritmetiken för
 * EP-täckning, och de två handlingarna Träna (tjänar EP) och Höj (spenderar EP).
 * Underklasserna bestämmer VILKA rader som visas och hur varje rad räknas.
 */
export default class DoDETrainingBase extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "div",
    classes: ["dode", "dode-training"],
    position: { width: 760, height: 720 },
    window: { resizable: true },
    actions: {
      buy: DoDETrainingBase.#onBuy,
      train: DoDETrainingBase.#onTrain,
      setMode: DoDETrainingBase.#onSetMode
    }
  };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    /** "ensam" | "larare" — styr antal veckoslag och avgift (RP s.63). */
    this.mode = "larare";
  }

  /* -------------------------------------------- */
  /*  Underklassernas ansvar                       */
  /* -------------------------------------------- */

  /** @returns {Item[]} posterna fönstret ska visa. */
  get trainableItems() {
    return [];
  }

  /** @returns {object} radspecifika fält — se #row i underklasserna. */
  describeRow() {
    throw new Error("describeRow måste implementeras");
  }

  /* -------------------------------------------- */

  /**
   * Bygger en rad. `own` är postens egen pott, `bonusNeeded` vad som måste tas
   * ur den fria potten.
   */
  buildRow({ item, label, current, cost, own, canUseOwn, valueField, target, targetLabel,
    note = "", blocked = false, trainNote = "", canTrainInMode = true }) {
    const bonusAvailable = this.actor.system.ep.bonusAvailable ?? 0;
    const usableOwn = canUseOwn ? Math.min(own, cost) : 0;
    const bonusNeeded = cost - usableOwn;
    const sources = allowedSources(item);
    const modeAllowed = sources[this.mode] && canTrainInMode;

    return {
      id: item.id,
      img: item.img,
      label,
      current,
      next: current + 1,
      cost,
      own,
      canUseOwn,
      usableOwn,
      bonusNeeded,
      note,
      blocked,
      valueField,
      target,
      targetLabel,
      affordable: !blocked && cost > 0 && bonusNeeded <= bonusAvailable,
      canTrain: modeAllowed && target > 0,
      trainNote: trainNote || (!sources[this.mode]
        ? (this.mode === "ensam"
          ? "Kan inte tränas på egen hand"
          : "Kan inte tränas med lärare")
        : "")
    };
  }

  async _prepareContext() {
    const rows = [];
    for (const item of this.trainableItems) rows.push(this.describeRow(item));
    rows.sort((a, b) => a.label.localeCompare(b.label, "sv"));

    const fee = trainingFee(this.mode);
    return {
      actor: this.actor,
      unlocked: !!this.actor.system.rest.trainingUnlocked,
      bonusAvailable: this.actor.system.ep.bonusAvailable ?? 0,
      purse: CONFIG.DODE.formatPurse(this.actor.system.currency ?? {}),
      mode: this.mode,
      isTeacher: this.mode === "larare",
      rollsPerWeek: ROLLS_PER_WEEK[this.mode],
      fee,
      canAffordFee: CONFIG.DODE.purseToKm(this.actor.system.currency ?? {}) >= CONFIG.DODE.silverToKm(fee),
      rows
    };
  }

  #itemFrom(target) {
    return this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
  }

  static async #onSetMode(event, target) {
    this.mode = target.dataset.mode === "ensam" ? "ensam" : "larare";
    this.render();
  }

  /** Ett veckopass — TJÄNAR EP (RP s.63 / SB s.7). */
  static async #onTrain(event, target) {
    const item = this.#itemFrom(target);
    if (!item) return;
    if (!this.actor.system.rest.trainingUnlocked) {
      return ui.notifications.warn("Viloperioden är inte öppnad — det går inte att träna under ett pågående äventyr (RP s.63).");
    }
    const row = this.describeRow(item);
    if (!row.canTrain) return ui.notifications.warn(row.trainNote || "Går inte att träna.");

    await runTrainingWeek({
      actor: this.actor, item, mode: this.mode,
      target: row.target, targetLabel: row.targetLabel
    });
    this.render();
  }

  /** Växlar in EP mot ett steg — SPENDERAR EP. */
  static async #onBuy(event, target) {
    const item = this.#itemFrom(target);
    if (!item) return;
    // Grinden kontrolleras här också, inte bara i mallen — fönstret kan stå öppet
    // när SL stänger den.
    if (!this.actor.system.rest.trainingUnlocked) {
      return ui.notifications.warn("Viloperioden är inte öppnad — EP kan inte omsättas under ett äventyr (RP s.63).");
    }
    const row = this.describeRow(item);
    if (row.blocked) return;
    if (!row.affordable) {
      return ui.notifications.warn(`${row.label} kostar ${row.cost} EP — det finns inte täckning.`);
    }
    await spendEp({ actor: this.actor, item, row, valueField: row.valueField });
    this.render();
  }
}
