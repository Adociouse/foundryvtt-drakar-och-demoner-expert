const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const GEAR_TYPES = ["vapen", "rustning", "besvarjelse"];

export default class DoDECharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dode", "sheet", "actor", "character"],
    position: { width: 680, height: 800 },
    window: { resizable: true },
    dragDrop: [{ dragSelector: "[data-item-id]", dropSelector: "form" }],
    actions: {
      rollSkill: DoDECharacterSheet.#onRollSkill,
      addSkill: DoDECharacterSheet.#onAddSkill,
      editSkill: DoDECharacterSheet.#onEditSkill,
      deleteSkill: DoDECharacterSheet.#onDeleteSkill,
      editItem: DoDECharacterSheet.#onEditItem,
      deleteItem: DoDECharacterSheet.#onDeleteItem,
      toggleEquipped: DoDECharacterSheet.#onToggleEquipped,
      addAbility: DoDECharacterSheet.#onAddAbility,
      deleteAbility: DoDECharacterSheet.#onDeleteAbility,
      clearRas: DoDECharacterSheet.#onClearRas,
      clearYrke: DoDECharacterSheet.#onClearYrke,
      rollDamage: DoDECharacterSheet.#onRollDamage,
      castSpell: DoDECharacterSheet.#onCastSpell
    },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    form: { template: "systems/drakar-och-demoner-expert/templates/actor/character-sheet.hbs" }
  };

  get title() {
    return this.actor.name;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.attributes = CONFIG.DODE.attributes;
    context.skills = this.actor.items.filter((i) => i.type === "fardighet");
    context.gear = this.actor.items
      .filter((i) => GEAR_TYPES.includes(i.type))
      .map((item) => ({
        item,
        isVapen: item.type === "vapen",
        isRustning: item.type === "rustning",
        isBesvarjelse: item.type === "besvarjelse",
        // Utrustningsbara typer (vapen/rustning) visar en av/på-växel som styr
        // om föremålets ActiveEffects appliceras — se DoDeActiveEffect.apply().
        canEquip: item.type === "vapen" || item.type === "rustning"
      }));
    // Förmåga-Item (bär transfer-AE:er, alltid aktiva). Separat från fritext-
    // arrayen system.specialAbilities.
    context.formagor = this.actor.items.filter((i) => i.type === "formaga");
    context.race = this.actor.system.race;
    context.profession = this.actor.system.profession;
    return context;
  }

  static #itemFromEvent(actor, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    return actor.items.get(itemId);
  }

  static async #onRollSkill(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) await this.actor.rollSkill(item);
  }

  static async #onEditSkill(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) item.sheet.render(true);
  }

  static async #onAddSkill() {
    await this.actor.createEmbeddedDocuments("Item", [
      { name: game.i18n.localize("DODE.Skill.New"), type: "fardighet" }
    ]);
  }

  static async #onDeleteSkill(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) await item.delete();
  }

  static async #onEditItem(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) item.sheet.render(true);
  }

  static async #onDeleteItem(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) await item.delete();
  }

  static async #onToggleEquipped(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) await item.update({ "system.equipped": !item.system.equipped });
  }

  /**
   * `specialAbilities` är ett vanligt ArrayField på rollpersonens egen data,
   * inte embeddade Items (till skillnad från färdigheter/utrustning) — lägg
   * till/ta bort skriver om hela arrayen via `actor.update`, inte
   * `createEmbeddedDocuments`/`deleteEmbeddedDocuments`.
   */
  static async #onAddAbility() {
    const current = this.actor.system.specialAbilities.map((a) => ({ ...a }));
    current.push({ name: "", source: "", description: "" });
    await this.actor.update({ "system.specialAbilities": current });
  }

  static async #onDeleteAbility(event, target) {
    const index = Number(target.closest("[data-index]")?.dataset.index);
    if (Number.isNaN(index)) return;
    const current = this.actor.system.specialAbilities.map((a) => ({ ...a }));
    current.splice(index, 1);
    await this.actor.update({ "system.specialAbilities": current });
  }

  static async #onClearRas() {
    const existing = this.actor.items.filter((i) => i.type === "ras");
    if (existing.length) await this.actor.deleteEmbeddedDocuments("Item", existing.map((i) => i.id));
  }

  static async #onClearYrke() {
    const existing = this.actor.items.filter((i) => i.type === "yrke");
    if (existing.length) await this.actor.deleteEmbeddedDocuments("Item", existing.map((i) => i.id));
  }

  static async #onRollDamage(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) await this.actor.rollWeaponDamage(item);
  }

  static async #onCastSpell(event, target) {
    const row = target.closest("[data-item-id]");
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    const effektgrad = Number(row?.querySelector("[data-effektgrad]")?.value) || 1;
    if (item) await this.actor.castSpell(item, effektgrad);
  }

  /** @override */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Item") return super._onDrop?.(event);

    const item = await Item.implementation.fromDropData(data);
    if (!item) return;

    // Ras/yrke: högst en åt gången — byt ut befintlig vid nytt släpp.
    if (item.type === "ras" || item.type === "yrke") {
      const existing = this.actor.items.filter((i) => i.type === item.type);
      if (existing.length) await this.actor.deleteEmbeddedDocuments("Item", existing.map((i) => i.id));
      await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
      return;
    }

    if (GEAR_TYPES.includes(item.type) || item.type === "fardighet" || item.type === "formaga") {
      await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
    }
  }
}
