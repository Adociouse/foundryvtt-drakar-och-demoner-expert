/**
 * Skaderullning — REGLER_STRID.md "Skada & Absorption": slå vapenskada, dra av
 * målets ABS (om ett mål är valt i Foundry), resten är faktisk skada på KP.
 */
export async function rollDamage({ actor, label, formula }) {
  const roll = await new Roll(formula).evaluate();
  const target = game.user.targets.first();
  const targetAbs = target?.actor?.system?.abs ?? 0;
  const targetName = target?.actor?.name ?? null;
  const finalDamage = Math.max(0, roll.total - targetAbs);

  const content = await renderTemplate(
    "systems/drakar-och-demoner-expert/templates/chat/damage-card.hbs",
    { label, formula, rollTotal: roll.total, targetName, targetAbs, finalDamage }
  );

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  });
}

/**
 * Kombinerar vapnets skadeformel med en skadebonus-sträng (t.ex. "+1d4" eller
 * "1d4" utan tecken — NPC-data skrivs ofta utan explicit "+"). "0"/tomt hoppas över.
 */
export function combineDamageFormula(weaponDamage, bonus) {
  const trimmed = (bonus ?? "").trim();
  if (!trimmed || trimmed === "0") return weaponDamage;
  const sign = trimmed.startsWith("+") || trimmed.startsWith("-") ? "" : "+";
  return `${weaponDamage}${sign}${trimmed}`;
}
