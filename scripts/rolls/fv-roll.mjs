import { canEarnFromUse, rollEpAward, awardItemEp } from "../helpers/ep.mjs";

/**
 * FV-slaget: 1T20 ≤ FV lyckas. Perfekt/fummel-bekräftelse enligt REGLER_STRID.md
 * ("Anfallsslag"-tabellen) och REGLER_EGENSKAPER.md ("Grundegenskapslag"):
 * en etta lyckas alltid, en tjugo misslyckas alltid; vilken av dem som blir
 * "perfekt"/"fummel" avgörs av ett bekräftelseslag mot samma FV.
 */
export async function rollFV({ actor, label, fv, item = null }) {
  const roll = await new Roll("1d20").evaluate();
  const result = roll.total;

  let success = result <= fv;
  let outcome = success ? "lyckat" : "misslyckat";
  // ⚠ Bekräftelseslaget (perfekt/fummel) saknades tidigare i `rolls`-arrayen
  // nedan — Dice So Nice fick aldrig se den tärningen, trots att den avgör
  // om slaget blev perfekt. Sparas nu i en delad variabel så den kan läggas
  // till chattkortets `rolls` tillsammans med huvudslaget.
  let confirm = null;

  if (result === 1) {
    confirm = await new Roll("1d20").evaluate();
    success = true;
    outcome = confirm.total <= fv ? "perfekt" : "lyckat";
  } else if (result === 20) {
    confirm = await new Roll("1d20").evaluate();
    success = false;
    outcome = confirm.total > fv ? "fummel" : "misslyckat";
  }

  // Erfarenhetspoäng — RP s.63. ⚠ AUTOMATISKT, inte ett SL-beslut: regeln ger EP
  // "första gången färdigheten används framgångsrikt efter en sovperiod", och det
  // kan systemet avgöra självt via EP-strecket (`item.system.ep.ticked`) — samma
  // ruta som på det fysiska rollformuläret, se helpers/ep.mjs.
  // Här låg tidigare en SL-knapp för "stressigt läge" — den formuleringen kommer
  // från ett kurerat dokument och står inte i vare sig RP s.63 eller REG s.45.
  // Bytt efter Johans beslut 2026-07-29, se DESIGN_DECISIONS.md backlogpost 39.
  //
  // ⚠ Johan 2026-08-02: EP-strecket kryssades i (och synligt uppdaterade arket)
  // INNAN tärningarna hunnit landa i Dice So Nice — samma "text före tärning"-
  // bugg som hittades i guiden, men här i själva stridsmotorn. Tärningen slås
  // (för animationen) och beloppet beräknas HÄR, men `awardItemEp` (den
  // faktiska, synliga uppdateringen av posten) skjuts upp till EFTER
  // `CONFIG.DODE.waitForDiceAnimation` nedan — se §6 i DESIGN_DECISIONS.md.
  let epAmount = 0;
  let epRoll = null;
  const canEarnEp = success && item && actor?.type === "character" && canEarnFromUse(item);
  if (canEarnEp) {
    const award = await rollEpAward(outcome);
    epAmount = award.amount;
    epRoll = award.roll;
  }

  const outcomeLabels = {
    perfekt: "DODE.RollCard.Perfekt",
    fummel: "DODE.RollCard.Fummel",
    lyckat: "DODE.RollCard.Lyckat",
    misslyckat: "DODE.RollCard.Misslyckat"
  };

  const content = await renderTemplate(
    "systems/drakar-och-demoner-expert/templates/chat/roll-card.hbs",
    {
      label,
      fv,
      result,
      cssClass: outcome,
      outcomeLabel: game.i18n.localize(outcomeLabels[outcome]),
      epAmount,
      epItemName: item?.name ?? "",
      epIsPerfekt: outcome === "perfekt"
    }
  );

  const rolls = [roll];
  if (confirm) rolls.push(confirm);
  if (epRoll) rolls.push(epRoll);

  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls,
    sound: CONFIG.sounds.dice
  });

  // Se docblocket ovan — poster-uppdateringen väntar in animationen.
  await CONFIG.DODE.waitForDiceAnimation(message);
  const epAward = canEarnEp ? { amount: epAmount, roll: epRoll } : null;
  if (epAward) await awardItemEp(item, epAmount);

  return { outcome, result, message, epAward };
}
