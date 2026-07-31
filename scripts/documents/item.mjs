/**
 * DoDeItem — hanterar tidsbegränsad aktivering vid utrustning (backlogpost 7,
 * testat med "Runas Duntofflor"). En `utrustning`/`vapen`/`rustning`-post med
 * `system.activationSeconds` satt ger bara sin `skillModifiers`-bonus en
 * begränsad tid EFTER varje gång den utrustas — se
 * actor-character.mjs#prepareDerivedData, som läser `flags.<id>.activeUntil`
 * denna klass sätter.
 *
 * Enda hookpunkten för equip-växling — både arkets equip-knapp
 * (actor-character-sheet.mjs #onToggleEquip) och item-sheetens egen
 * `system.equipped`-checkbox går via ett `Item#update`, så `_preUpdate` här
 * fångar båda utan att någon av anropsplatserna behöver känna till laddnings-
 * eller tidsmekaniken.
 */
export default class DoDeItem extends Item {
  /** @override */
  async _preUpdate(changes, options, user) {
    const wasEquipped = this.system.equipped === true;
    const willBeEquipped = foundry.utils.getProperty(changes, "system.equipped");
    const activating = willBeEquipped === true && !wasEquipped && this.system.activationSeconds;

    if (activating) {
      if (this.system.chargesRemaining === 0) {
        // Slut på laddningar — föremålet går att bära, men ger inte längre
        // sin tidsbegränsade bonus. Blockera INTE själva utrustningen (det
        // vore förvirrande — spelaren ska fortfarande kunna ha kvar/ta av
        // föremålet), bara aktiveringen.
      } else {
        foundry.utils.setProperty(changes, `flags.${game.system.id}.activeUntil`, game.time.worldTime + this.system.activationSeconds);
        if (typeof this.system.chargesRemaining === "number") {
          foundry.utils.setProperty(changes, "system.chargesRemaining", this.system.chargesRemaining - 1);
        }
      }
    }
    return super._preUpdate(changes, options, user);
  }
}
