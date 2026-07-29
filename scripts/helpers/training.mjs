/**
 * Träningsmekaniken — REG s.45-46, kompletterad av MAG (kapitlet *Att lära sig
 * nya besvärjelser*). Se det kurerade extraktet
 * `docs/extracts/DODE_Regler_TRANING_EP.md` i Roll20-projektet; råextraktet är
 * tvåspaltssammanflätat och obrukbart för just det här avsnittet.
 *
 * ⚠ **Träning är en KÄLLA till EP, inte bara tillfället då EP växlas in.** REG
 * s.45 räknar upp tre sätt att skaffa EP: ensamträning, träning med lärare, och
 * erfarenhet under äventyr. Man tränar alltså för att TJÄNA EP, och växlar sedan
 * in EP mot FV. Den första halvan saknades i den första implementationen
 * (2026-07-29) — träningsfönstret kunde bara spendera.
 *
 * Veckoslaget: "Varje vecka slår spelaren ett normalt egenskapsslag för
 * färdighetens grundegenskap. Lyckas kastet får rollpersonen en erfarenhetspoäng
 * för färdigheten." Med lärare slås **två** slag i stället för ett — det är hela
 * den mekaniska vinsten med att betala.
 */

/** Antal veckoslag per träningspass. REG s.45: ensam 1, med lärare 2. */
export const ROLLS_PER_WEEK = { ensam: 1, larare: 2 };

/**
 * Ett normalt grundegenskapsslag: 1T20 ≤ egenskapens värde.
 *
 * ⚠ Inte ett FV-slag — det är färdighetens GRUNDEGENSKAP som slås emot, inte
 * färdighetsvärdet. En magiker med INT 16 slår mot 16 vare sig hen tränar
 * Animism eller en enskild besvärjelse.
 */
export async function rollTrainingWeek(attributeValue, clMod = 0) {
  const target = attributeValue + clMod;
  const roll = await new Roll("1d20").evaluate();
  return { roll, target, success: roll.total <= target };
}

/**
 * Träningstaket — REG s.45: "Genom träning kan man inte öka en färdighet till
 * högre FV än vad man har för värde i dess grundegenskap."
 *
 * ⚠ "Lärdomsfärdigheterna och alla färdigheter av kategori B är undantagna från
 * denna regel." Kategori B känner vi igen på `system.category === "b"`.
 * Lärdomsfärdigheter har vi ingen egen markering för än — magiskolorna är i
 * boken av typen LÄR (se skolans färdighetsblock i MAG) och undantas därför här.
 */
export function trainingCap(item, actor) {
  if (item.system.category === "b") return null;
  if (CONFIG.DODE.isMagicSchoolKey(item.system.skillKey)) return null;
  const attr = actor.system.attributes?.[item.system.attribute];
  return attr?.total ?? null;
}

/**
 * Kan besvärjelsen tränas i det valda läget?
 *
 * ⚠ MAG: "Man kan inte lära sig en besvärjelse genom ensamträning, utan enbart
 * genom träning med lärare. Läraren tar dubbelt så mycket betalt som för träning
 * av en färdighet." Besvärjelser kräver alltså alltid lärare.
 * ⚠ Detta motsäger `docs/wiki/MAGI.md`, som påstår att nya besvärjelser kan läras
 * med ensamträning om man har en magisk kodex. Boken säger raka motsatsen — se
 * rättelsetabellen i det kurerade extraktet.
 */
export function requiresTeacher(item) {
  return item.type === "besvarjelse";
}

/** Träningsavgift i silvermynt för ett pass, ur världsinställningen. */
export function trainingFee(mode) {
  if (mode !== "larare") return 0;
  return game.settings.get("drakar-och-demoner-expert", "trainingFeePerWeek");
}

/**
 * Drar en silversumma ur rollpersonens börs. Räknar i kopparmynt som atom (se
 * DODE.purseToKm) så att brutna silverpriser inte blir flyttalsdrivor.
 * Returnerar `false` utan att ändra något om täckning saknas.
 */
export async function payFromPurse(actor, sm) {
  const costKm = CONFIG.DODE.silverToKm(sm);
  if (costKm <= 0) return true;
  const haveKm = CONFIG.DODE.purseToKm(actor.system.currency ?? {});
  if (haveKm < costKm) return false;
  const purse = CONFIG.DODE.kmToPurse(haveKm - costKm);
  await actor.update({
    "system.currency.gm": purse.gm ?? 0,
    "system.currency.sm": purse.sm ?? 0,
    "system.currency.km": purse.km ?? 0
  });
  return true;
}
