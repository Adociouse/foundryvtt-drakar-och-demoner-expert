const fields = foundry.data.fields;

/**
 * Färdighet — REGLER_FARDIGHETER.md. FV lagras direkt (inte EP-kostnad ännu;
 * EP-köpsekonomin är ej påbörjad — se PLAN_WIZARD_V2.md Fas 7).
 *
 * Bas/bonus/total-mönster (samma som attributen, se actor-character.mjs) — `fv`
 * är det EP-köpta grundvärdet, `bonus` är ett manuellt GM/spelar-redigerbart
 * fritextfält (item-sheeten), `total` (= fv + bonus) är vad `rollSkill()`
 * faktiskt slår mot. ⚠ Detta är BARA det platta fältmönstret, inte det fulla
 * "Skill Modifier System" (automatiska ras-/yrkes-/förmågebaserade modifierare,
 * PLAN_WIZARD_V2.md rad 604+/§3-backlogpost 7) — den delen kräver ett separat
 * arkitekturbeslut (AE-changes kan inte rikta in sig på ett namngivet embeddat
 * Item hos aktören, bara på aktörens egna schemafält, så ras-/yrkesförmågor kan
 * inte idag applicera en färdighetsbonus via samma transfer-AE-mekanism som
 * attributen använder). `bonus` här är alltså manuell, inte AE-driven.
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
      bonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
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

  prepareDerivedData() {
    this.total = this.fv + this.bonus;
    this.bonusDisplay = this.bonus > 0 ? `+${this.bonus}` : `${this.bonus}`;
  }
}
