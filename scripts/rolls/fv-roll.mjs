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

  if (result === 1) {
    const confirm = await new Roll("1d20").evaluate();
    success = true;
    outcome = confirm.total <= fv ? "perfekt" : "lyckat";
  } else if (result === 20) {
    const confirm = await new Roll("1d20").evaluate();
    success = false;
    outcome = confirm.total > fv ? "fummel" : "misslyckat";
  }

  // Erfarenhetspoäng — RP s.63. ⚠ AUTOMATISKT, inte ett SL-beslut: regeln ger EP
  // "första gången färdigheten används framgångsrikt efter en sovperiod", och det
  // kan systemet avgöra självt via sömnklockan (`item.system.ep.awardedSinceRest`).
  // Här låg tidigare en SL-knapp för "stressigt läge" — den formuleringen kommer
  // från ett kurerat dokument och står inte i vare sig RP s.63 eller REG s.45.
  // Bytt efter Johans beslut 2026-07-29, se DESIGN_DECISIONS.md backlogpost 39.
  let epAward = null;
  if (success && item && actor?.type === "character" && canEarnFromUse(item)) {
    const { amount, roll: epRoll } = await rollEpAward(outcome);
    await awardItemEp(item, amount);
    epAward = { amount, roll: epRoll };
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
      epAmount: epAward?.amount ?? 0,
      epItemName: item?.name ?? "",
      epIsPerfekt: outcome === "perfekt"
    }
  );

  // 1T3+1-slaget för perfekt läggs med så att Dice So Nice animerar det.
  const rolls = [roll];
  if (epAward?.roll) rolls.push(epAward.roll);

  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls,
    sound: CONFIG.sounds.dice
  });

  return { outcome, result, message, epAward };
}
