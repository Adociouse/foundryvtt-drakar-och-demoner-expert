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

  /**
   * ⚠ Skydd mot en BUGG I FOUNDRYS EGEN KÄRNA, inte mot något i det här systemet.
   *
   * `CombatTracker#_onRender` (client/applications/sidebar/tabs/combat-tracker.mjs,
   * verifierad i den installerade v14-klienten) gör:
   *
   *     let data = {};
   *     if ( Array.isArray(renderData) ) data = renderData.find(d => d._id === this.viewed?.id);
   *     if ( ... && ("turn" in data) ) { ...rulla aktiv combatant till synlighet... }
   *
   * Om `renderData` ÄR en array men `.find()` inte matchar något — t.ex. när den
   * visade striden just raderats, eller när flera Combat-dokument finns och det
   * uppdaterade inte är det visade — blir `data` `undefined`, och `"turn" in
   * undefined` kastar `TypeError: Cannot use 'in' operator to search for 'turn'`.
   *
   * Konsekvensen är begränsad (ett konsolfel, och kärnans autoskroll till aktiv
   * combatant hoppas över för just den renderingen), men projektets stående
   * verifieringskrav är NOLL konsolfel — och brus döljer riktiga fel. Eftersom vi
   * ändå äger en subklass normaliseras `renderData` här innan kärnan får se den:
   * finns ingen post som matchar den visade striden skickas `undefined` vidare i
   * stället för arrayen. Då slår kärnans `Array.isArray`-gren aldrig till, `data`
   * förblir `{}`, och `"turn" in data` blir ett ofarligt `false`.
   *
   * Rapportvärt uppströms; ta bort den här overriden när kärnan rättat det.
   */
  async _onRender(context, options) {
    const renderData = options?.renderData;
    if (Array.isArray(renderData) && !renderData.some((d) => d._id === this.viewed?.id)) {
      options = { ...options, renderData: undefined };
    }
    return super._onRender(context, options);
  }

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
