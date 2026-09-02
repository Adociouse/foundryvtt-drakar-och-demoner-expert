const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

class DoDEItemSheetBase extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dode", "sheet", "item"],
    position: { width: 520, height: 580 },
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
    context.equipmentCategories = CONFIG.DODE.equipmentCategories;
    context.coinLabels = CONFIG.DODE.coinLabels;
    // Källhänvisning — bokval + sida, plus en färdigformaterad etikett med den
    // RIKTIGA boktiteln (aldrig ett PDF-filnamn). Se fields-source.mjs.
    context.books = Object.fromEntries(
      Object.entries(CONFIG.DODE.books).map(([k, v]) => [k, v.label])
    );
    context.sourceLabel = CONFIG.DODE.formatSource(this.item.system?.source);
    return context;
  }
}

export class DoDEFardighetSheet extends DoDEItemSheetBase {
  static PARTS = {
    form: {
      template: "systems/drakar-och-demoner-expert/templates/item/item-fardighet-sheet.hbs",
      scrollable: [""]
    }
  };
}

export class DoDERasSheet extends DoDEItemSheetBase {
  // Bredare/högre än basdefaulten — attributgrid + STO-intervall + förmågelista +
  // en ProseMirror-beskrivningseditor gör basdefaulten för trångt för att läsa
  // utan att manuellt dra ut fönstret varje gång (Johan, 2026-09-02).
  static DEFAULT_OPTIONS = { position: { width: 600, height: 700 } };
  static PARTS = {
    form: {
      template: "systems/drakar-och-demoner-expert/templates/item/item-ras-sheet.hbs",
      scrollable: [""]
    }
  };
}

export class DoDEYrkeSheet extends DoDEItemSheetBase {
  // Bredare/högre än basdefaulten — förmågelista + TVÅ ProseMirror-editorer
  // (färdighetslista + beskrivning) är mer innehåll än övriga item-ark
  // (Johan, 2026-09-02).
  static DEFAULT_OPTIONS = { position: { width: 640, height: 760 } };
  static PARTS = {
    form: {
      template: "systems/drakar-och-demoner-expert/templates/item/item-yrke-sheet.hbs",
      scrollable: [""]
    }
  };
}

export class DoDEVapenSheet extends DoDEItemSheetBase {
  // Flest fält av alla item-ark (10 stridsvärden/fält) — bredare än basdefaulten.
  static DEFAULT_OPTIONS = { position: { width: 560, height: 680 } };
  static PARTS = {
    form: {
      template: "systems/drakar-och-demoner-expert/templates/item/item-vapen-sheet.hbs",
      scrollable: [""]
    }
  };
}

export class DoDERustningSheet extends DoDEItemSheetBase {
  static PARTS = {
    form: {
      template: "systems/drakar-och-demoner-expert/templates/item/item-rustning-sheet.hbs",
      scrollable: [""]
    }
  };
}

export class DoDEUtrustningSheet extends DoDEItemSheetBase {
  static DEFAULT_OPTIONS = { position: { width: 540, height: 620 } };
  static PARTS = {
    form: {
      template: "systems/drakar-och-demoner-expert/templates/item/item-utrustning-sheet.hbs",
      scrollable: [""]
    }
  };
}

export class DoDEBesvarjelseSheet extends DoDEItemSheetBase {
  // Katalogkompletteringen (2026-09) gav de flesta besvärjelser full, ordagrann
  // boktext i stället för en komprimerad rad — beskrivningseditorn behöver
  // märkbart mer plats än basdefaulten för att visa den utan att skrolla.
  static DEFAULT_OPTIONS = { position: { width: 580, height: 700 } };
  static PARTS = {
    form: {
      template: "systems/drakar-och-demoner-expert/templates/item/item-besvarjelse-sheet.hbs",
      scrollable: [""]
    }
  };
}

export class DoDEMinibesvarjelseSheet extends DoDEItemSheetBase {
  // Klart minst innehåll av alla item-ark (tre fält + kort hint) — mindre än
  // basdefaulten är ändå läsbart, men matchar nu samma bredd som övriga.
  static DEFAULT_OPTIONS = { position: { width: 480, height: 480 } };
  static PARTS = {
    form: {
      template: "systems/drakar-och-demoner-expert/templates/item/item-minibesvarjelse-sheet.hbs",
      scrollable: [""]
    }
  };
}

export class DoDEFormagaSheet extends DoDEItemSheetBase {
  static PARTS = {
    form: {
      template: "systems/drakar-och-demoner-expert/templates/item/item-formaga-sheet.hbs",
      scrollable: [""]
    }
  };
}
