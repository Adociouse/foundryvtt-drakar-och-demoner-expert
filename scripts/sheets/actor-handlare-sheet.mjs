const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Butiksark för `handlare`-aktörer. Dubbelklick på token → butiksdisken öppnas.
 *
 * Varorna är vanliga embeddade Items; arket grupperar dem per kategori och
 * lägger en köpknapp per rad. Köpet körs på KÖPARENS aktör
 * (DoDEActor#buyFromMerchant) — handlaren rörs aldrig, se actor-handlare.mjs.
 */
export default class DoDEHandlareSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dode", "sheet", "actor", "handlare"],
    position: { width: 620, height: 700 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      buyStock: DoDEHandlareSheet.#onBuy,
      inspectStock: DoDEHandlareSheet.#onInspect,
      deleteStock: DoDEHandlareSheet.#onDeleteStock
    }
  };

  static PARTS = {
    // Se actor-character-sheet.mjs PARTS för hela motiveringen. Butiksarket
    // saknade dessutom scroll-CSS HELT (bara `.dode.sheet.character`/`.npc`
    // hade fixen från session 8) — en lång varulista klipptes tyst av utan
    // ens en scrollbar, ett strängare fel än scroll-reset. Fixad i samma pass.
    form: { template: "systems/drakar-och-demoner-expert/templates/actor/handlare-sheet.hbs", scrollable: [""] }
  };

  get title() {
    return this.actor.system.shopName || this.actor.name;
  }

  /**
   * Vem handlar? Spelarens tilldelade rollperson (`game.user.character`).
   * SL har normalt ingen tilldelad rollperson — då faller vi tillbaka på den
   * markerade token, så att SL kan handla åt ett sällskap utan att byta konto.
   */
  #buyer() {
    const assigned = game.user.character;
    if (assigned?.type === "character") return assigned;
    const selected = canvas?.tokens?.controlled?.[0]?.actor;
    if (selected?.type === "character") return selected;
    return null;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    context.actor = actor;
    context.system = actor.system;
    context.isGM = game.user.isGM;
    context.isEditable = this.isEditable;

    const buyer = this.#buyer();
    context.buyer = buyer;
    context.buyerPurse = buyer ? CONFIG.DODE.formatPurse(buyer.system.currency) : null;
    const purseKm = buyer ? CONFIG.DODE.purseToKm(buyer.system.currency) : 0;

    const CATEGORY_LABELS = CONFIG.DODE.equipmentCategories;
    const buckets = new Map();
    for (const item of actor.items) {
      const priceSm = DoDEActor_merchantPriceSm(item, actor);
      const key = item.type === "utrustning" ? (item.system.category || "diverse") : item.type;
      const entry = {
        item,
        priceSm,
        // Fritext-priser ("4 per kagge", "5 sm/g") går inte att automatisera —
        // de visas som referens med köpknappen avstängd.
        priceLabel: priceSm === null
          ? (item.system.priceNote || "—")
          : CONFIG.DODE.formatPurse(CONFIG.DODE.kmToPurse(CONFIG.DODE.silverToKm(priceSm))),
        purchasable: priceSm !== null,
        affordable: priceSm !== null && buyer && CONFIG.DODE.silverToKm(priceSm) <= purseKm
      };
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(entry);
    }
    const ORDER = ["vapen", "rustning", ...Object.keys(CATEGORY_LABELS)];
    const labelFor = (key) => {
      if (key === "vapen") return "Vapen";
      if (key === "rustning") return "Rustning";
      if (key === "besvarjelse") return "Besvärjelser";
      return game.i18n.localize(CATEGORY_LABELS[key] ?? key);
    };
    context.stockGroups = [...buckets.keys()]
      .sort((a, b) => {
        const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map((key) => ({ key, label: labelFor(key), entries: buckets.get(key) }));
    context.stockCount = actor.items.size;
    return context;
  }

  static async #onBuy(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const buyer = this.#buyer();
    if (!buyer) {
      ui.notifications.warn(
        "Ingen rollperson vald. Tilldela en rollperson till ditt konto (eller markera en token) innan du handlar."
      );
      return;
    }
    const qtyInput = target.closest(".stock-row")?.querySelector("[data-buy-qty]");
    const qty = Math.max(1, Number(qtyInput?.value) || 1);
    const ok = await buyer.buyFromMerchant(item, this.actor, qty);
    if (ok) this.render();
  }

  static async #onInspect(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    this.actor.items.get(itemId)?.sheet.render(true);
  }

  static async #onDeleteStock(event, target) {
    if (!game.user.isGM) return;
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    await this.actor.items.get(itemId)?.delete();
  }
}

// Fristående kopia av DoDEActor.merchantPriceSm så att arket inte behöver
// importera dokumentklassen (cirkulärt importberoende via CONFIG).
function DoDEActor_merchantPriceSm(item, merchant) {
  const sys = item.system ?? {};
  if (sys.priceNote) return null;
  const base = item.type === "utrustning" ? (sys.priceSm ?? 0) : (sys.price ?? 0);
  if (!base) return null;
  const markup = merchant?.system?.markup ?? 0;
  return Math.round(base * (1 + markup / 100) * 100) / 100;
}
