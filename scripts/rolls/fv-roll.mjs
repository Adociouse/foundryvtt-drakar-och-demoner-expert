/**
 * FV-slaget: 1T20 ≤ FV lyckas. Perfekt/fummel-bekräftelse enligt REGLER_STRID.md
 * ("Anfallsslag"-tabellen) och REGLER_EGENSKAPER.md ("Grundegenskapslag"):
 * en etta lyckas alltid, en tjugo misslyckas alltid; vilken av dem som blir
 * "perfekt"/"fummel" avgörs av ett bekräftelseslag mot samma FV.
 */
export async function rollFV({ actor, label, fv }) {
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
      outcomeLabel: game.i18n.localize(outcomeLabels[outcome])
    }
  );

  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  });

  return { outcome, result, message };
}
