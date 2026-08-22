import { requestLoot } from "../rolls/loot.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

// Vapen/rustning/utrustning, samma som karaktärsarkets GEAR_TYPES minus
// besvärjelse/fardighet/formaga — NPC:er har varken färdighets- eller
// ras/yrke-items (actor-npc.mjs: "inga färdighets-item — skills är fritext").
const GEAR_TYPES = ["vapen", "rustning", "utrustning"];

export default class DoDENpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dode", "sheet", "actor", "npc"],
    position: { width: 640, height: 760 },
    window: { resizable: true },
    // Naturliga items (klor, bett, tjockt skinn — natural:true) exkluderas
    // ur selektorn helt, så Foundry aldrig ens fäster en dragstart-lyssnare
    // på den raden — de är inte lootbara. Beslut 2026-08-19, se item-vapen.mjs.
    dragDrop: [{ dragSelector: "[data-item-id]:not(.natural-item)", dropSelector: "form" }],
    actions: {
      rollAttack: DoDENpcSheet.#onRollAttack,
      rollAttackDamage: DoDENpcSheet.#onRollAttackDamage,
      declareAttack: DoDENpcSheet.#onDeclareAttack,
      addAttack: DoDENpcSheet.#onAddAttack,
      deleteAttack: DoDENpcSheet.#onDeleteAttack,
      editItem: DoDENpcSheet.#onEditItem,
      deleteItem: DoDENpcSheet.#onDeleteItem,
      toggleEquipped: DoDENpcSheet.#onToggleEquipped,
      requestLoot: DoDENpcSheet.#onRequestLoot
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

  /**
   * ⚠ Live-fynd 2026-08-21 (Johan, som Player2): `ActorSheetV2` inaktiverar
   * AUTOMATISKT varenda formulärkontroll (inputs OCH `data-action`-knappar)
   * när `!this.isEditable` — vilket är EXAKT läget för en spelare med bara
   * Observer-behörighet på ett lik (se `_prepareContext`s `isGM`-kommentar
   * för varför Observer krävs). Plundringsknappen är AVSIKTLIGT till för
   * just den användaren, så den måste räddas undan Foundrys blanda-disable
   * i efterhand — körs EFTER kärnans egen render/disable-passering.
   */
  async _onRender(context, options) {
    // ⚠ `DocumentSheetV2#_onRender` (Foundry-kärnan) är `async` och kör sin
    // `_toggleDisabled(true)`-inaktivering EFTER ett eget `await` — utan att
    // AWAITA `super._onRender()` här körde denna metods återaktivering FÖRE
    // kärnans inaktivering (race), och blev alltså tyst överskriven direkt
    // efteråt. Måste awaitas för att komma EFTER i tur.
    await super._onRender?.(context, options);
    this.element.querySelectorAll('[data-action="requestLoot"]').forEach((btn) => { btn.disabled = false; });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.attributes = CONFIG.DODE.attributes;
    // ⚠ Live-fynd 2026-08-21 (Johan, som Player2): för att plundringsknappen
    // (rolls/loot.mjs) ska kunna se vad som finns att plundra måste spelaren
    // ha Observer-behörighet på liket — men Observer visar HELA arket i
    // Foundrys kärna, inklusive "Speciellt"/beskrivning (som ofta bär SL-
    // hemligheter, t.ex. en gåtlösning) och attackernas FV/skada (rått
    // stridsdata). Foundry har ingen fältgranulär behörighet, så
    // begränsningen görs HÄR i mallen i stället: `isGM` styr om Anfall/
    // attribut/Speciellt/Beskrivning-sektionerna ens renderas för en
    // icke-SL-tittare — bara Utrustning (plundringslistan) syns då.
    context.isGM = game.user.isGM;
    context.gear = this.actor.items
      .filter((i) => GEAR_TYPES.includes(i.type))
      .map((item) => ({
        item,
        isVapen: item.type === "vapen",
        isRustning: item.type === "rustning",
        isUtrustning: item.type === "utrustning",
        canEquip: item.type === "vapen" || item.type === "rustning" || item.type === "utrustning",
        isNatural: !!item.system.natural
      }));
    return context;
  }

  static #itemFromEvent(actor, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    return actor.items.get(itemId);
  }

  static async #onEditItem(event, target) {
    const item = DoDENpcSheet.#itemFromEvent(this.actor, target);
    if (item) item.sheet.render(true);
  }

  static async #onDeleteItem(event, target) {
    const item = DoDENpcSheet.#itemFromEvent(this.actor, target);
    if (item) await item.delete();
  }

  static async #onToggleEquipped(event, target) {
    const item = DoDENpcSheet.#itemFromEvent(this.actor, target);
    if (item) await item.update({ "system.equipped": !item.system.equipped });
  }

  /** Plundring — se rolls/loot.mjs. `game.user.character` = spelarens egen rollperson. */
  static async #onRequestLoot(event, target) {
    const item = DoDENpcSheet.#itemFromEvent(this.actor, target);
    if (item) await requestLoot(this.actor, item.id, game.user.character);
  }

  /** Samma mönster som actor-character-sheet.mjs#_onDrop — kopierar (loot är GM:s manuella radering, inte en flytt). */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Item") return super._onDrop?.(event);

    const item = await Item.implementation.fromDropData(data);
    if (!item) return;
    if (GEAR_TYPES.includes(item.type)) await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
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
