const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export default class DoDENpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dode", "sheet", "actor", "npc"],
    position: { width: 640, height: 760 },
    window: { resizable: true },
    actions: {
      rollAttack: DoDENpcSheet.#onRollAttack,
      rollAttackDamage: DoDENpcSheet.#onRollAttackDamage,
      declareAttack: DoDENpcSheet.#onDeclareAttack,
      addAttack: DoDENpcSheet.#onAddAttack,
      deleteAttack: DoDENpcSheet.#onDeleteAttack
    },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    // Se actor-character-sheet.mjs PARTS för hela motiveringen — samma
    // scroll-till-toppen-vid-varje-klick-fix (Johan 2026-08-08).
    form: { template: "systems/drakar-och-demoner-expert/templates/actor/npc-sheet.hbs", scrollable: [""] }
  };

  get title() {
    return this.actor.name;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.attributes = CONFIG.DODE.attributes;
    return context;
  }

  static async #onRollAttack(event, target) {
    const index = Number(target.closest("[data-attack-index]")?.dataset.attackIndex);
    if (!Number.isNaN(index)) await this.actor.rollAttack(index);
  }

  static async #onRollAttackDamage(event, target) {
    const index = Number(target.closest("[data-attack-index]")?.dataset.attackIndex);
    if (!Number.isNaN(index)) await this.actor.rollAttackDamage(index);
  }

  /** Öppnar Anfallsdialogen (detaljerad strid) förvald till denna anfallsrad. */
  static async #onDeclareAttack(event, target) {
    const index = Number(target.closest("[data-attack-index]")?.dataset.attackIndex);
    if (Number.isNaN(index)) return;
    const { default: DoDEAttackDialog } = await import("../apps/attack-dialog.mjs");
    new DoDEAttackDialog(this.actor, { npcAttackIndex: index }).render(true);
  }

  static async #onAddAttack() {
    const attacks = this.actor.system.attacks.map((a) => ({ ...a }));
    attacks.push({ name: "Nytt anfall", fv: 0, damage: "", note: "" });
    await this.actor.update({ "system.attacks": attacks });
  }

  static async #onDeleteAttack(event, target) {
    const index = Number(target.closest("[data-attack-index]")?.dataset.attackIndex);
    if (Number.isNaN(index)) return;
    const attacks = this.actor.system.attacks.map((a) => ({ ...a }));
    attacks.splice(index, 1);
    await this.actor.update({ "system.attacks": attacks });
  }
}
