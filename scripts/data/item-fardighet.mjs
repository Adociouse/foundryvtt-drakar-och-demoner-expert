const fields = foundry.data.fields;

/**
 * Färdighet — REGLER_FARDIGHETER.md. FV lagras direkt (inte EP-kostnad ännu;
 * EP-köpsekonomin är ej påbörjad — se PLAN_WIZARD_V2.md Fas 7).
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
      // Ersätter den tidigare `yrkesfardighet`-booleanen (PLAN_WIZARD_V2.md Fas 6)
      // — RP s.30 skiljer på tre kostnadskategorier (2/3/5 EP per FV-steg vid
      // EP-köp, Fas 7), inte bara yrkesfärdighet/inte. Rollpersonsskaparens
      // auto-tilldelning (Fas 6) sätter "primar" för de 16 primära färdigheterna
      // och "yrkesfardighet" för matchade poster i yrkets `professionSkills`
      // (item-yrke.mjs) — "sekundar" är default för allt annat (manuellt
      // tillagda färdigheter via "Ny färdighet"-knappen).
      costTier: new fields.StringField({
        required: false,
        initial: "sekundar",
        choices: ["primar", "yrkesfardighet", "sekundar"]
      }),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }
}
