import { sourceField } from "./fields-source.mjs";

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
      // Stabil, språkoberoende identitet — se DODE.skillKey i config.mjs och
      // backlogpost 6a. Visningsnamnet (`name`) är för människor och kan
      // översättas; ALL matchning i koden (guidens avstämning, dedupning,
      // EP-köp) ska gå på `skillKey`. Tomt på äldre färdigheter skapade före
      // 2026-07-27 — då härleds nyckeln ur namnet som fallback.
      skillKey: new fields.StringField({ required: false, initial: "" }),
      // EP-pott intjänad i spel — REG s.45-46. ⚠ EP från äventyr är BUNDET till
      // den färdighet som tjänade in det ("noteras ett streck vid färdigheten"),
      // till skillnad från SL:s bonuspoäng som är fria (actor.system.ep.bonus).
      // Därför bor potten på itemet, inte på rollpersonen.
      // `earned` räknas upp av strecket, `spent` av köp i träningsfönstret —
      // båda ackumulerar, så historiken finns kvar när potten är tömd.
      ep: new fields.SchemaField({
        // ⚠ SÖMNKLOCKA, inte stressbedömning. RP s.63 (ordagrant samma i REG
        // s.45): EP ges "varje gång som en rollperson använder en färdighet
        // framgångsrikt FÖRSTA GÅNGEN EFTER EN SOVPERIOD om minst sex timmar
        // (två timmar för alver)". Sedan kan färdigheten inte ge mer EP förrän
        // rollpersonen sovit igen. Flaggan nollas av clearAwardMarks().
        //
        // ⚠ Systemet gjorde tidigare "1 EP per lyckat slag i ett stressigt läge
        // (SL bedömer)" efter den kurerade REGLER_FARDIGHETER.md. Den regeln står
        // inte i NÅGON av böckerna — bytt till sömnklockan efter Johans beslut
        // 2026-07-29. Se DESIGN_DECISIONS.md backlogpost 39.
        awardedSinceRest: new fields.BooleanField({ required: false, initial: false }),
        earned: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spent: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 })
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
      // Bok + sida — se fields-source.mjs.
      source: sourceField(),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  prepareDerivedData() {
    // Vad som faktiskt går att lägga på ett köp just nu.
    this.ep.available = Math.max(0, this.ep.earned - this.ep.spent);
    this.total = this.fv + this.bonus;
    this.bonusDisplay = this.bonus > 0 ? `+${this.bonus}` : `${this.bonus}`;
  }
}
