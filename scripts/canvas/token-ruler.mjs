/**
 * DoDE Token Ruler — subklassar Foundrys inbyggda `TokenRuler`
 * (`CONFIG.Token.rulerClass`, `client/canvas/placeables/tokens/ruler.mjs`)
 * för att färglägga och märka rörelsedraget enligt DoD:s egna
 * förflyttningsnivåer (SLB s.15-16) i stället för Foundrys generiska
 * spelarfärg. Se planen "Förflyttning, börda & rörelse på kartan", steg 1b.
 *
 * Budgeten är `token.actor.system.movement` (rutor/SR, redan bördepåverkad —
 * se actor-character.mjs#prepareDerivedData/DODE.encumbranceTable).
 * Förbrukningen är `waypoint.measurement.cost`, som Foundry SJÄLVT redan
 * ackumulerar över hela stridsrundans path (`TokenDocument#movementHistory`
 * + det aktuella planerade draget slås ihop av basklassens `#createPath`
 * innan `_get*Style`/`_getWaypointLabelContext` anropas) — det ÄR
 * rörelsepoängsräknaren, ingen egen budget-tracker byggs här. Kostnaden
 * respekterar redan eventuella `modifyMovementCost`-regioner (terräng, se
 * planens steg 1d), så nivåerna nedan är automatiskt terrängkorrekta.
 *
 * ⚠ Rent visuellt/analytiskt — ingen spärr, ingen varning. Johans uttryckliga
 * svar på AskUserQuestion 2026-09-06: "Display only, no warnings." SL dömer,
 * precis som SLB s.15 lägger terrängbedömningen hos SL.
 */

/**
 * DoD:s förflyttningsnivåer per stridsrunda, SLB s.15-16 (ordagrant):
 * - "Du får flytta högst hälften av din modifierade förflyttningsförmåga
 *   innan striden" om du fortfarande ska kunna anfalla den rundan.
 * - Full förflyttning (1×): man joggar, får inte göra något annat i SR:n.
 * - Springa (2×): inget annat, "helt omedveten om sin omgivning".
 * - Sprinta (3×): boken kräver ingen rustning/packning/upptagen hand för
 *   detta — den kontrollen görs INTE här (display only, se ovan).
 * - >3×: utanför vad rundan medger.
 */
const MOVEMENT_TIERS = [
  { max: 0.5, color: 0x4caf50, label: "Kan anfalla" },
  { max: 1, color: 0x2196f3, label: "Full förflyttning" },
  { max: 2, color: 0xffb300, label: "Springa" },
  { max: 3, color: 0xff5722, label: "Sprinta" },
  { max: Infinity, color: 0x9e0000, label: "Utanför rundan" }
];

function tierFor(ratio) {
  return MOVEMENT_TIERS.find((tier) => ratio <= tier.max) ?? MOVEMENT_TIERS.at(-1);
}

export default class DoDETokenRuler extends foundry.canvas.placeables.tokens.TokenRuler {
  /** @override */
  _getSegmentStyle(waypoint) {
    const base = super._getSegmentStyle(waypoint);
    if (!(base.width > 0)) return base;
    const ratio = this.#movementRatio(waypoint);
    if (ratio === null) return base;
    return { ...base, color: tierFor(ratio).color };
  }

  /** @override */
  _getGridHighlightStyle(waypoint, offset) {
    const base = super._getGridHighlightStyle(waypoint, offset);
    if (!(base.alpha > 0)) return base;
    const ratio = this.#movementRatio(waypoint);
    if (ratio === null) return base;
    return { ...base, color: tierFor(ratio).color };
  }

  /** @override */
  _getWaypointLabelContext(waypoint, state) {
    const context = super._getWaypointLabelContext(waypoint, state);
    if (!context) return context;
    const ratio = this.#movementRatio(waypoint);
    if (ratio === null) return context;
    const budget = this.#movementBudget();
    const cost = waypoint.measurement.cost;
    const costText = Number.isFinite(cost) ? cost.toNearest(0.01).toLocaleString(game.i18n.lang) : "∞";
    context.cost.total = `${costText}/${budget} · ${tierFor(ratio).label}`;
    return context;
  }

  /** @returns {number|null} `system.movement` för aktören som äger linjalens token, eller null om ej en DoDE-rollperson/NPC. */
  #movementBudget() {
    return this.token.actor?.system?.movement ?? null;
  }

  /**
   * @param {object} waypoint Ruler-waypointen (bär `measurement.cost`, ackumulerad ur hela rundans path).
   * @returns {number|null} Förbrukad/budget, eller null om budgeten saknas/kostnaden inte är ett tal.
   */
  #movementRatio(waypoint) {
    const budget = this.#movementBudget();
    if (!budget) return null;
    const cost = waypoint.measurement?.cost;
    if (!Number.isFinite(cost)) return null;
    return cost / budget;
  }
}
