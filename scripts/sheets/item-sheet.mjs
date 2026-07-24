const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

class DoDEItemSheetBase extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dode", "sheet", "item"],
    position: { width: 480, height: 460 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  get title() {
    return this.item.name;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.attributes = CONFIG.DODE.attributes;
    context.skillCategories = CONFIG.DODE.skillCategories;
    context.costTiers = CONFIG.DODE.costTiers;
    context.weaponGrips = CONFIG.DODE.weaponGrips;
    context.weaponTypes = CONFIG.DODE.weaponTypes;
    context.weaponCategories = CONFIG.DODE.weaponCategories;
    context.armorSlots = CONFIG.DODE.armorSlots;
    context.magicSchools = CONFIG.DODE.magicSchools;
    return context;
  }
}

export class DoDEFardighetSheet extends DoDEItemSheetBase {
  static PARTS = {
    form: { template: "systems/drakar-och-demoner-expert/templates/item/item-fardighet-sheet.hbs" }
  };
}

export class DoDERasSheet extends DoDEItemSheetBase {
  static DEFAULT_OPTIONS = { position: { width: 480, height: 560 } };
  static PARTS = {
    form: { template: "systems/drakar-och-demoner-expert/templates/item/item-ras-sheet.hbs" }
  };
}

export class DoDEYrkeSheet extends DoDEItemSheetBase {
  static DEFAULT_OPTIONS = { position: { width: 480, height: 560 } };
  static PARTS = {
    form: { template: "systems/drakar-och-demoner-expert/templates/item/item-yrke-sheet.hbs" }
  };
}

export class DoDEVapenSheet extends DoDEItemSheetBase {
  static PARTS = {
    form: { template: "systems/drakar-och-demoner-expert/templates/item/item-vapen-sheet.hbs" }
  };
}

export class DoDERustningSheet extends DoDEItemSheetBase {
  static PARTS = {
    form: { template: "systems/drakar-och-demoner-expert/templates/item/item-rustning-sheet.hbs" }
  };
}

export class DoDEBesvarjelseSheet extends DoDEItemSheetBase {
  static DEFAULT_OPTIONS = { position: { width: 480, height: 560 } };
  static PARTS = {
    form: { template: "systems/drakar-och-demoner-expert/templates/item/item-besvarjelse-sheet.hbs" }
  };
}

export class DoDEFormagaSheet extends DoDEItemSheetBase {
  static DEFAULT_OPTIONS = { position: { width: 480, height: 500 } };
  static PARTS = {
    form: { template: "systems/drakar-och-demoner-expert/templates/item/item-formaga-sheet.hbs" }
  };
}
