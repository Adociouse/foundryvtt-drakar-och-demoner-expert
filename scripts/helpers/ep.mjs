/**
 * Erfarenhetspoäng i spel — REG s.45-46 (färdigheter) och MAG s.23 (besvärjelser).
 *
 * Tre skilda ekonomier delar namnet "EP" i böckerna, och de får INTE blandas:
 *
 *  1. **Skapandebudgeten** (`actor.system.ep.max/spent`) — härledd ur nivå + ålder
 *     + kvarvarande BP × 5. Frusen när guiden stängs, räknas om vid varje
 *     prepareDerivedData. Rörs inte av något här.
 *  2. **Färdighetens egen pott** (`item.system.ep.earned/spent`) — intjänad genom
 *     att lyckas i spel. ⚠ Bunden till just den färdigheten: "noteras ett streck
 *     vid färdigheten" (REG s.45). Kan aldrig flyttas till en annan färdighet.
 *  3. **SL:s bonuspoäng** (`actor.system.ep.bonus/bonusSpent`) — fria, "INTE bundna
 *     till en viss färdighet", max 10 per äventyr.
 *
 * Den här modulen sköter INTJÄNANDET (2 och 3). Omsättningen till FV sker i
 * träningsfönstret (apps/training.mjs), som är stängt tills viloperiodsgrinden
 * öppnats — EP kan inte omsättas under ett pågående äventyr (REG s.46).
 */

const SYSTEM = "drakar-och-demoner-expert";

/** Max bonuspoäng SL får dela ut per äventyr — REG s.46. Rådgivande i UI:t. */
export const MAX_BONUS_PER_ADVENTURE = 10;

/**
 * Hur många EP ett lyckat slag är värt.
 *
 * ⚠ Ett vanligt lyckat slag ger 1 EP — men BARA "i ett stressigt läge (SL
 * bedömer)". Den bedömningen är medvetet inte automatiserad: systemet vet inte
 * om rollpersonen klättrade för sitt liv eller för nöjes skull. Därför är
 * utdelningen en SL-knapp på slagkortet, inte en automatisk bieffekt av slaget.
 */
export async function rollEpAward(outcome) {
  // Perfekt slag ger 1T3+1 EP (REG s.45).
  if (outcome === "perfekt") {
    const roll = await new Roll("1d3+1").evaluate();
    return { amount: roll.total, roll };
  }
  return { amount: 1, roll: null };
}

/**
 * Lägg EP i en färdighets eller besvärjelses egen pott.
 *
 * ⚠ Besvärjelser har en SÖMNKLOCKA i stället för stresskravet: 1 EP första gången
 * besvärjelsen används framgångsrikt efter förra sömnen (MAG s.23), inte per
 * kastning. `awardedSinceRest` hindrar dubbelutdelning; den nollas av
 * `clearSpellAwardMarks()` vid vila.
 */
export async function awardItemEp(item, amount) {
  if (!item || amount <= 0) return null;
  const update = { "system.ep.earned": (item.system.ep?.earned ?? 0) + amount };
  if (item.type === "besvarjelse") update["system.ep.awardedSinceRest"] = true;
  await item.update(update);
  return item;
}

/** Kan besvärjelsen ge EP just nu? Falskt om den redan gett EP sedan förra vilan. */
export function spellCanEarn(item) {
  return item?.type === "besvarjelse" && !item.system.ep?.awardedSinceRest;
}

/** Nollar sömnklockan på alla besvärjelser — anropas när rollpersonen vilat. */
export async function clearSpellAwardMarks(actor) {
  const updates = actor.items
    .filter((i) => i.type === "besvarjelse" && i.system.ep?.awardedSinceRest)
    .map((i) => ({ _id: i.id, "system.ep.awardedSinceRest": false }));
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/**
 * SL:s bonuspoäng efter ett äventyr (REG s.46). Fria poäng — de landar på
 * rollpersonen, inte på någon färdighet.
 */
export async function awardBonusEp(actor, amount) {
  if (!actor || amount <= 0) return null;
  await actor.update({ "system.ep.bonus": (actor.system.ep?.bonus ?? 0) + amount });
  return actor;
}

/**
 * Öppnar eller stänger viloperiodsgrinden — REG s.46: EP kan bara omsättas efter
 * minst 7 dagars sammanhängande vila, och aldrig under ett pågående äventyr.
 * Att öppna grinden nollar samtidigt besvärjelsernas sömnklocka.
 */
export async function setTrainingUnlocked(actor, unlocked) {
  await actor.update({ "system.rest.trainingUnlocked": !!unlocked });
  if (unlocked) await clearSpellAwardMarks(actor);
  return actor;
}

/** Flaggnyckeln som slagkortet bär för att veta vad ett EP-streck ska landa på. */
export function epAwardFlag(actor, item, outcome) {
  return { [SYSTEM]: { epAward: { actorId: actor?.id ?? null, itemId: item?.id ?? null, outcome } } };
}

export { SYSTEM as EP_FLAG_SCOPE };
