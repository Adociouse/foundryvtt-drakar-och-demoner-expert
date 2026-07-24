export default class DoDeActiveEffect extends ActiveEffect {
  /** @override */
  apply(actor, change) {
    // Utrustningseffekter (vapen/rustning) gäller bara medan föremålet är utrustat.
    // Transfer-effekter på ett Item behåller Itemet som `parent` i Foundry v11+
    // (de kopieras inte till aktören), så vi kan läsa källföremålets `equipped`-flagga
    // direkt. Källor utan `equipped` (förmågor, raser, ålders-/scen-/besvärjelse-AE:er)
    // saknar fältet -> `undefined !== false` -> effekten appliceras som vanligt.
    if (this.parent?.system?.equipped === false) return null;

    const condition = this.getFlag("dode", "condition");
    if (condition && !DoDeActiveEffect.evaluateCondition(condition, actor)) {
      return null;
    }
    return super.apply(actor, change);
  }

  // TODO: Implement real condition evaluation (scene context, token state, etc.)
  // For now, all conditions pass — the hook point is what matters.
  static evaluateCondition(_condition, _actor) {
    return true;
  }
}
