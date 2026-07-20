import { rollFV } from "../rolls/fv-roll.mjs";
import { rollDamage, combineDamageFormula } from "../rolls/damage-roll.mjs";

export default class DoDEActor extends Actor {
  /** @param {Item} item En "fardighet"-item ägd av denna actor. */
  async rollSkill(item) {
    if (!item) return;
    return rollFV({ actor: this, label: item.name, fv: item.system.fv });
  }

  /** @param {number} index Index i NPC:ns system.attacks-array. */
  async rollAttack(index) {
    const attack = this.system.attacks?.[index];
    if (!attack) return;
    return rollFV({ actor: this, label: attack.name || "Anfall", fv: attack.fv });
  }

  /** @param {number} index Index i NPC:ns system.attacks-array. */
  async rollAttackDamage(index) {
    const attack = this.system.attacks?.[index];
    if (!attack?.damage) return;
    return rollDamage({ actor: this, label: `${attack.name || "Anfall"} (skada)`, formula: attack.damage });
  }

  /**
   * @param {Item} item En "vapen"-item ägd av denna actor. Skadebonus läggs alltid
   * på för rollpersoner (REGLER_STRID.md) — undantaget lönnmördarens bakhugg är
   * inte specialhanterat än.
   */
  async rollWeaponDamage(item) {
    if (!item) return;
    const formula = combineDamageFormula(item.system.damage, this.system.damageBonus ?? "");
    return rollDamage({ actor: this, label: `${item.name} (skada)`, formula });
  }

  /**
   * Kastar en besvärjelse — MAGI.md: CL = S - 2*(E-1), PSY-kostnad = E vid lyckat
   * slag, halva E (avrundat till magikerns fördel, min 1) vid perfekt, full E vid
   * fummel (+ snedtändningstabell, ej automatiserad). Inget PSY-avdrag vid vanligt
   * misslyckat slag.
   *
   * Förenkling: `item.system.sValue` (besvärjelsens tabellerade skolvärde) används
   * som skicklighetsvärde (S) i CL-formeln. Egentligen är S kastarens PERSONLIGA
   * skicklighet i just den besvärjelsen (kan skilja sig från skolvärdet och höjas
   * separat via erfarenhet — se MAGI.md "Skolvärde och Skicklighetsvärde"), men
   * ingen sådan per-besvärjelse-träning är modellerad ännu. Flaggat, inte löst.
   */
  async castSpell(item, effektgrad = 1) {
    if (!item) return;
    const E = Math.max(1, Math.floor(effektgrad) || 1);
    const cl = item.system.sValue - 2 * (E - 1);
    const { outcome } = await rollFV({ actor: this, label: `${item.name} (E${E})`, fv: cl });

    let psyCost = 0;
    if (outcome === "perfekt") psyCost = Math.max(1, Math.floor(E / 2));
    else if (outcome === "lyckat" || outcome === "fummel") psyCost = E;

    if (psyCost > 0) {
      const current = this.system.resources?.psy?.value ?? this.system.resources?.psy?.max ?? 0;
      await this.update({ "system.resources.psy.value": Math.max(0, current - psyCost) });
    }

    if (psyCost > 0 || outcome === "fummel") {
      const note = outcome === "fummel"
        ? `${psyCost} PSY förbrukat. Fummel — slå på Snedtändningstabellen (MAGI.md, ej automatiserad).`
        : `${psyCost} PSY förbrukat.`;
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this }), content: `<p>${note}</p>` });
    }
  }
}
