const fields = foundry.data.fields;

/**
 * Färdighet — REGLER_FARDIGHETER.md. FV lagras direkt (inte EP-kostnad ännu;
 * EP-köpsekonomin är ej påbörjad — se ACTIVE_TASK.md.
 */
export default class DoDEFardighetData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      attribute: new fields.StringField({
        required: true,
        initial: "smi",
        choices: ["sty", "sto", "fys", "smi", "int", "psy", "kar"]
      }),
      category: new fields.StringField({
        required: true,
        initial: "a",
        choices: ["a", "b"]
      }),
      fv: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      yrkesfardighet: new fields.BooleanField({ required: false, initial: false }),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }
}
