const fields = foundry.data.fields;

/**
 * Besvärjelse — MAGI.md (MAG s.8-13). CL = S - 2*(E-1), PSY-kostnad = E per effektgrad;
 * det är kastmekanik (fas 6), inte modellerat på itemet — bara referensdata här.
 */
export default class DoDEBesvarjelseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      school: new fields.StringField({
        required: true,
        initial: "elementarmagi",
        choices: [
          "alkemi", "animism", "demonologi", "elementarmagi", "harmonism", "haxkonster",
          "illusionism", "mentalism", "nekromanti", "rostmagi", "spiritism", "stavmagi", "symbolism"
        ]
      }),
      sValue: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      duration: new fields.StringField({ required: false, initial: "" }),
      range: new fields.StringField({ required: false, initial: "" }),
      ritual: new fields.BooleanField({ required: false, initial: false }),
      kvick: new fields.BooleanField({ required: false, initial: false }),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }
}
