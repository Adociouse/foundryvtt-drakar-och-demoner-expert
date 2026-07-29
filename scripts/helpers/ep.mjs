/**
 * Erfarenhetspoäng i spel — **Rollpersonen s.63**, ordagrant samma regel som
 * REG s.45. Se det kurerade extraktet `docs/extracts/DODE_Regler_TRANING_EP.md`
 * i Roll20-projektet.
 *
 * Tre skilda ekonomier delar namnet "EP" i böckerna, och de får INTE blandas:
 *
 *  1. **Skapandebudgeten** (`actor.system.ep.max/spent`) — härledd ur nivå + ålder
 *     + kvarvarande BP × 5. Frusen när guiden stängs, räknas om vid varje
 *     prepareDerivedData. Rörs inte av något här.
 *  2. **Postens egen pott** (`item.system.ep.earned/spent`) — intjänad genom att
 *     lyckas i spel eller genom träning. ⚠ Bunden till just den färdigheten:
 *     "Varje erfarenhetspoäng man får gäller bara för en viss färdighet"
 *     (RP s.63). Kan aldrig flyttas till en annan färdighet.
 *  3. **SL:s bonuspoäng** (`actor.system.ep.bonus/bonusSpent`) — fria, "kan av
 *     spelaren godtyckligt fördelas över alla hans färdigheter med SL:s
 *     godkännande", max 10 per äventyr.
 *
 * Den här modulen sköter INTJÄNANDET under äventyr (2 och 3). Träningspass
 * hanteras i `helpers/training.mjs`, och omsättningen till FV sker i
 * träningsfönstren bakom viloperiodsgrinden.
 */

const SYSTEM = "drakar-och-demoner-expert";

/** Max bonuspoäng SL får dela ut per äventyr — RP s.63. Rådgivande i UI:t. */
export const MAX_BONUS_PER_ADVENTURE = 10;

/**
 * Kan posten tjäna EP av ett lyckat slag just nu?
 *
 * ⚠ **Det är en STRECKMARKERING, inte ett SL-beslut — och inte en "klocka".**
 * RP s.63, ordagrant: *"noteras ett streck vid färdigheten"* när den används
 * framgångsrikt första gången efter en sovperiod om minst sex timmar (två för
 * alver). Det är precis samma sak som den lilla rutan bredvid varje färdighet
 * på det fysiska rollformuläret — man kryssar i den vid ett lyckat slag, och den
 * kryssas ur igen först när man sovit. `system.ep.ticked` ÄR den rutan.
 *
 * ⚠ **Kategori B kan inte tjäna EP genom äventyr alls** — "Detta gäller inte
 * färdigheter kategori B, som endast kan förbättras genom träning" (RP s.63).
 */
export function canEarnFromUse(item) {
  if (!item) return false;
  if (item.system.ep?.ticked) return false;
  if (item.type === "fardighet" && item.system.category === "b") return false;
  return item.type === "fardighet" || item.type === "besvarjelse";
}

/**
 * Hur många EP ett lyckat slag är värt. Perfekt slag ger 1T3+1 (RP s.63).
 * Tärningen slås så att den syns — Dice So Nice animerar den.
 */
export async function rollEpAward(outcome) {
  if (outcome === "perfekt") {
    const roll = await new Roll("1d3+1").evaluate();
    return { amount: roll.total, roll };
  }
  return { amount: 1, roll: null };
}

/** Lägger EP i en posts egen pott och sätter dess EP-streck (kryssar i rutan). */
export async function awardItemEp(item, amount) {
  if (!item || amount <= 0) return null;
  await item.update({
    "system.ep.earned": (item.system.ep?.earned ?? 0) + amount,
    "system.ep.ticked": true
  });
  return item;
}

/**
 * Kryssar ur EP-strecken på allt rollpersonen äger — anropas när hen sovit.
 *
 * ⚠ Sovperioden är **minst sex timmar, två för alver** (RP s.63). Systemet
 * spårar ingen speltid, så längden är SL:s bedömning; knappen är själva
 * kvitteringen på att den ägt rum.
 */
export async function clearEpTicks(actor) {
  const updates = actor.items
    .filter((i) => i.system.ep?.ticked)
    .map((i) => ({ _id: i.id, "system.ep.ticked": false }));
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/** SL:s bonuspoäng efter ett äventyr (RP s.63). Fria — de landar på rollpersonen. */
export async function awardBonusEp(actor, amount) {
  if (!actor || amount <= 0) return null;
  await actor.update({ "system.ep.bonus": (actor.system.ep?.bonus ?? 0) + amount });
  return actor;
}

/**
 * Öppnar eller stänger viloperiodsgrinden — RP s.63: EP kan bara omsättas efter
 * minst 7 dagars sammanhängande vila, och aldrig under ett pågående äventyr.
 * Att öppna grinden kryssar samtidigt ur alla EP-streck; en viloperiod
 * innehåller med nödvändighet en sovperiod.
 */
export async function setTrainingUnlocked(actor, unlocked) {
  await actor.update({ "system.rest.trainingUnlocked": !!unlocked });
  if (unlocked) await clearEpTicks(actor);
  return actor;
}

export { SYSTEM as EP_FLAG_SCOPE };
