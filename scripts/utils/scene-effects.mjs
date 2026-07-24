/**
 * SceneEffects — hjälpklass för scen-/miljömodifikationer via ActiveEffects.
 *
 * Applicerar/tar bort en ActiveEffect på ALLA aktörer med token på den aktiva
 * scenen. Använd för miljöeffekter som "Dimön: PSY ×2", "mörker: −FV på syn",
 * hunger/kyla osv. Alla scen-AE:er flaggas med flags.dode.source:"scene" så att
 * de går att identifiera och sopa bort gemensamt.
 *
 * Regel: rikta alltid mot `.bonus`-fält (aldrig `.value`) via mode ADD (2).
 *
 * Registreras som game.dode.SceneEffects i dode.mjs. Endast GM bör köra dessa
 * (de skapar/raderar dokument på andras aktörer).
 */
export default class SceneEffects {
  /**
   * Unika aktörer som har minst en token på den aktiva scenen.
   * @returns {Actor[]}
   */
  static _sceneActors() {
    const scene = game.scenes?.active ?? canvas?.scene ?? null;
    if (!scene) return [];
    const actors = new Map();
    for (const token of scene.tokens) {
      const actor = token.actor;
      if (actor && !actors.has(actor.id)) actors.set(actor.id, actor);
    }
    return [...actors.values()];
  }

  /**
   * Lägger en ActiveEffect på varje aktör med token på aktiva scenen.
   *
   * @param {object} effectData AE-data. Kräver minst `name` och `changes[]`.
   *   `changes` bör rikta mot `.bonus`-fält med mode ADD. En `duration` (t.ex.
   *   { rounds: 3 }) är valfri. flags.dode.source sätts alltid till "scene".
   * @returns {Promise<ActiveEffect[]>} De skapade effekterna (plattad lista).
   */
  static async applyToScene(effectData) {
    if (!effectData?.name || !Array.isArray(effectData.changes)) {
      ui.notifications?.warn("SceneEffects.applyToScene: kräver name och changes[].");
      return [];
    }
    const actors = SceneEffects._sceneActors();
    const created = [];
    for (const actor of actors) {
      const data = foundry.utils.mergeObject(
        foundry.utils.deepClone(effectData),
        { transfer: false, disabled: false, "flags.dode.source": "scene" }
      );
      const effects = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
      created.push(...effects);
    }
    return created;
  }

  /**
   * Tar bort alla scen-AE:er (flags.dode.source === "scene") vars namn matchar
   * `effectName` från varje aktör med token på aktiva scenen.
   *
   * @param {string} effectName Effektens namn att ta bort.
   * @returns {Promise<void>}
   */
  static async removeFromScene(effectName) {
    if (!effectName) return;
    const actors = SceneEffects._sceneActors();
    for (const actor of actors) {
      const ids = actor.effects
        .filter((e) => e.getFlag("dode", "source") === "scene" && e.name === effectName)
        .map((e) => e.id);
      if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
    }
  }
}
