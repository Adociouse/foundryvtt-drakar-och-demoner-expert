/**
 * DoDE Combat — flyttar Foundrys inbyggda rörelsehistorik-nollställning från
 * PER TUR till PER RUNDA. En DoD-stridsrunda (SR) är en runda där ALLA
 * agerar (SLB s.15) — Foundrys defaultbeteende (`Combat#_clearMovementHistoryOnStartTurn`,
 * `client/documents/combat.mjs`) nollställer i stället ALLA combatanters
 * `movementHistory` vid VARJE enskild tur, vilket hade gjort
 * `TokenDocument#movementHistory` oanvändbar som DoD:s rörelsepoängsräknare
 * (se DoDETokenRuler, scripts/canvas/token-ruler.mjs, som läser historiken
 * för att visa förbrukat/budget mot `system.movement`).
 *
 * Lösningen flyttar bara VILKEN lifecycle-hook som anropar
 * `clearMovementHistories()`, ingen egen historik-mekanism byggs:
 * `_clearMovementHistoryOnStartTurn` blir en no-op, och `_onStartRound`
 * (som Foundry redan garanterar bara körs EN gång per rundskifte, se
 * `#onStartRound`/`#onStartTurn` i client/documents/combat.mjs) gör jobbet
 * i stället.
 */
export default class DoDECombat extends Combat {
  /** @override — no-op: rörelsehistoriken ska INTE nollställas per tur i DoD, se filhuvudet. */
  async _clearMovementHistoryOnStartTurn(combatant, context) {}

  /** @override — nollställ rörelsehistoriken en gång per rundskifte i stället. */
  async _onStartRound(context) {
    await super._onStartRound(context);
    await this.clearMovementHistories();
  }
}
