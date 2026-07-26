export default class DoDeActiveEffect extends ActiveEffect {
  // Foundry v14 note: the old apply(actor, change) override is no longer called for
  // schema-resolvable fields (which system.attributes.*.bonus is) — ActiveEffect.applyChange()
  // now resolves those via the DataModel field directly, bypassing apply()/_applyLegacy()
  // entirely. shouldApplyChange(change, {phase}) is the documented v14 hook for gating whether
  // a change applies at all, and Actor#applyActiveEffects calls it for every change on every
  // applicable effect (including item-transferred ones), so it's the correct override point.
  /** @override */
  shouldApplyChange(change, options = {}) {
    // Utrustningseffekter (vapen/rustning) gäller bara medan föremålet är utrustat.
    // Transfer-effekter på ett Item behåller Itemet som `parent` i Foundry v11+
    // (de kopieras inte till aktören), så vi kan läsa källföremålets `equipped`-flagga
    // direkt. Källor utan `equipped` (förmågor, raser, ålders-/scen-/besvärjelse-AE:er)
    // saknar fältet -> `undefined !== false` -> effekten appliceras som vanligt.
    if (this.parent?.system?.equipped === false) return false;

    const condition = this.getFlag(game.system.id, "condition");
    if (condition && !DoDeActiveEffect.evaluateCondition(condition)) {
      return false;
    }
    return super.shouldApplyChange(change, options);
  }

  // TODO: Implement real condition evaluation (scene context, token state, etc.)
  // For now, all conditions pass — the hook point is what matters.
  static evaluateCondition(_condition) {
    return true;
  }
}
