const fields = foundry.data.fields;

/** Vapen — UTRUSTNING.md (REG s.58-59). */
export default class DoDEVapenData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      grip: new fields.StringField({ required: true, initial: "1H", choices: ["1H", "2H", "1-2H"] }),
      styGroup: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      damage: new fields.StringField({ required: true, initial: "1d6" }),
      length: new fields.NumberField({ required: false, integer: true, initial: 0 }),
      weight: new fields.NumberField({ required: false, initial: 0 }),
      baseValue: new fields.NumberField({ required: false, integer: true, initial: 0 }),
      weaponType: new fields.StringField({ required: true, initial: "latt", choices: ["latt", "tung"] }),
      category: new fields.StringField({
        required: true,
        initial: "narstrid",
        choices: ["narstrid", "projektil", "kast"]
      }),
      range: new fields.StringField({ required: false, initial: "" }),
      price: new fields.NumberField({ required: false, integer: true, initial: 0 }),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }
}
