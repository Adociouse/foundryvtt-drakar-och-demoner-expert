const fields = foundry.data.fields;

/**
 * Rustning — UTRUSTNING.md (REG s.53-54). En typ täcker kroppsrustning, hjälmar och
 * sköldar via `slot`. Sköldars faktiska stridsmekanik (extra parering, 1/20 sönderchans)
 * är stridsintegration — fas 6, inte modellerad här ännu.
 */
export default class DoDERustningData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      slot: new fields.StringField({ required: true, initial: "kropp", choices: ["kropp", "huvud", "skold"] }),
      abs: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      weight: new fields.NumberField({ required: false, initial: 0 }),
      price: new fields.NumberField({ required: false, integer: true, initial: 0 }),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }
}
