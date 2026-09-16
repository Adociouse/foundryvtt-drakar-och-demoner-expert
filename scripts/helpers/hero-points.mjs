/**
 * Hjältepoäng (`system.hjaltepoang`, HH s.20/46-48) — HH:s egen hjältevaluta,
 * INTE bäruppgiftspoäng (BP, spenderas i character-wizard.mjs under skapandet)
 * och INTE kroppspoäng (KP). En enda ackumulerande siffra på aktören; bryr sig
 * inte om den kom från guidens hjältedåd-slag vid skapandet eller en SL-utdelning
 * mitt i en kampanj — se plan wise-herding-lemur.
 */

/**
 * SL:s hjältepoängutdelning — mirror av helpers/ep.mjs#awardBonusEp, men till
 * skillnad från den tillåter den här NEGATIVA belopp: RP s.64 låter SL dra
 * bort hjältepoäng för ohjältemodiga handlingar (överge vänner i faran,
 * förråda, vägra duell), se `DODE.heroicDeedsAwardTable`s "ohjaltemodig"-rad.
 *
 * `hjaltepoangEarned` (livstidstotal, igenkänningsrisk RP s.64) ökar BARA vid
 * positiva belopp — ett avdrag för en ohjältemodig handling raderar inte
 * redan intjänad ryktbarhet, det är bara poolen som krymper.
 */
export async function awardHeroPoints(actor, amount) {
  if (!actor || amount === 0) return null;
  const pool = Math.max(0, (actor.system.hjaltepoang ?? 0) + amount);
  const update = { "system.hjaltepoang": pool };
  if (amount > 0) update["system.hjaltepoangEarned"] = (actor.system.hjaltepoangEarned ?? 0) + amount;
  await actor.update(update);
  return actor;
}

/**
 * Drar hjältepoäng för ett köp. Returnerar `false` (utan att skriva något) om
 * poolen inte räcker — anropsstället avgör vad som ska hända då (avbryta,
 * varna).
 */
export async function spendHeroPoints(actor, amount) {
  if (!actor || amount <= 0) return true;
  const current = actor.system.hjaltepoang ?? 0;
  if (amount > current) return false;
  await actor.update({ "system.hjaltepoang": current - amount });
  return true;
}
