import { armourFor } from "../helpers/anatomy.mjs";

/**
 * Utökad Combat Tracker — visar ABS per rad och en snabbanfallsknapp, så SL
 * kan slå ett anfall direkt från sidopanelen utan att öppna en enskild
 * NPC-/karaktärsark (5v5-strid var annars ~40 klick/runda bara för SL, se
 * planen "Stridsflödets 'smoothness'" i Claude-planarkivet).
 *
 * ⚠ Kärnans `CombatTracker` har INGEN ABS-kolumn och INGEN handlingsknapp i
 * standardmallen (bekräftat mot `templates/sidebar/tabs/combat/tracker.hbs`
 * i den installerade klienten) — dnd5e:s egen `CombatTracker5e` löser aldrig
 * det här, den lånar bara det befintliga `resource`-fältet för HP. Den här
 * klassen override:ar därför en RIKTIG egen `tracker`-PART-mall, inte bara
 * `_prepareTurnContext`.
 */
export default class DoDECombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
  static DEFAULT_OPTIONS = {
    actions: {
      quickAttack: DoDECombatTracker.#onQuickAttack
    }
  };

  static PARTS = {
    ...foundry.applications.sidebar.tabs.CombatTracker.PARTS,
    tracker: {
      template: "systems/drakar-och-demoner-expert/templates/apps/combat-tracker-turns.hbs",
      scrollable: [""]
    }
  };

  /** @override */
  async _prepareTurnContext(combat, combatant, index) {
    const turn = await super._prepareTurnContext(combat, combatant, index);
    const actor = combatant.actor;
    turn.abs = actor ? armourFor(actor) : null;
    turn.canQuickAttack = !!actor;
    return turn;
  }

  static async #onQuickAttack(event, target) {
    const combatantId = target.closest("[data-combatant-id]")?.dataset.combatantId;
    const combatant = this.viewed?.combatants.get(combatantId);
    const actor = combatant?.actor;
    if (!actor) return;
    const { default: DoDEAttackDialog } = await import("./attack-dialog.mjs");
    new DoDEAttackDialog(actor).render(true);
  }
}
