export default class DoDeActiveEffect extends ActiveEffect {
  /** @override */
  apply(actor, change) {
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
