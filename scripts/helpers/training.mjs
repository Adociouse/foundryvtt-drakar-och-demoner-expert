/**
 * Träningsmekaniken — **Rollpersonen s.63** (vanliga färdigheter) och
 * **Spelarboken s.7** (magi). Se det kurerade extraktet
 * `docs/extracts/DODE_Regler_TRANING_EP.md` i Roll20-projektet.
 *
 * ⚠ **RP/SB går före REG.** Grundregelboken (REG s.45-46) har samma mekanik i
 * grova drag, men Expertböckerna preciserar den och avviker på flera punkter —
 * lärarens FV-krav (RP 17 mot REG 15), kostnaden för ensam elev (RP ×3 mot REG
 * × lärarens INT) och framför allt takreglerna nedan. Vi följer RP/SB.
 *
 * ⚠ **Träning är en KÄLLA till EP, inte bara tillfället då EP växlas in.** RP
 * s.63 räknar upp tre sätt: ensamträning, träning med lärare, och erfarenhet
 * under äventyr. Man tränar för att TJÄNA EP, och växlar sedan in EP mot FV.
 */

/** Antal veckoslag per träningspass. RP s.63: ensam 1, med lärare 2. */
export const ROLLS_PER_WEEK = { ensam: 1, larare: 2 };

/**
 * Takregler — RP s.63. ⚠ TVÅ OLIKA TAK, lätt att slå ihop till ett:
 *
 *  - **Sekundära färdigheter och kategori B:** "kan man ALDRIG få högre FV än
 *    värdet i den grundegenskap den är baserad på." Absolut tak, oavsett metod.
 *  - **Primära färdigheter och yrkesfärdigheter:** taket gäller bara TRÄNING.
 *    "Skall man få högre FV i en sådan färdighet måste det ske genom erfarenhet
 *    (B-färdigheter undantagna)" — äventyrs-EP kan alltså passera taket.
 *
 * ⚠ Kategori B är alltså INTE undantagen från taket (som REG s.45 kan läsas) —
 * den är undantagen från *undantaget*: B-färdigheter kan inte förbättras genom
 * äventyr alls, bara genom träning, och når därför aldrig över grundegenskapen.
 *
 * @returns {{cap:number|null, hard:boolean}} `hard` = gäller även äventyrs-EP.
 */
export function skillCap(item, actor) {
  const attr = actor.system.attributes?.[item.system.attribute];
  const cap = attr?.total ?? null;
  if (cap === null) return { cap: null, hard: false };
  const hard = item.system.category === "b" || item.system.costTier === "sekundar";
  return { cap, hard };
}

/**
 * Magiskolor har ingen motsvarande takregel — de är lärdomsfärdigheter (typ LÄR)
 * och begränsas i stället av att de bara kan tränas med lärare.
 */
export function isSchool(item) {
  return item.type === "fardighet" && CONFIG.DODE.isMagicSchoolKey(item.system.skillKey);
}

/**
 * Vilka träningsformer som ger EP för en given post — **SB s.7**.
 *
 * ⚠ Den här tabellen är hela poängen med att magi har ett eget fönster:
 *
 * | | Ensamträning | Med lärare | Äventyr |
 * |---|---|---|---|
 * | Vanlig färdighet | ja | ja | ja (ej kategori B) |
 * | **Magiskola (FV)** | **NEJ** | **ja — enda källan** | **NEJ** |
 * | **Besvärjelse (S)** | **ja — kräver magisk kodex** | ja | ja |
 *
 * SB s.7 ordagrant om skolor: "Att skaffa sig FV i magiskolor fungerar som för
 * vanliga färdigheter, men man kan endast få erfarenhetspoäng genom träning med
 * lärare; ej genom ensamträning eller erfarenhet."
 *
 * ⚠ Detta motsäger det ÄLDRE Magi-häftet, som säger att besvärjelser bara kan
 * läras av lärare. SB (Expert, senare) tillåter uttryckligen ensamträning ur en
 * magisk kodex och beskriver mekaniken i detalj. Vi följer SB.
 */
export function allowedSources(item) {
  if (isSchool(item)) return { ensam: false, larare: true, aventyr: false };
  if (item.type === "besvarjelse") return { ensam: true, larare: true, aventyr: true };
  return { ensam: true, larare: true, aventyr: item.system.category !== "b" };
}

/**
 * Veckoslaget för ensamträning av en BESVÄRJELSE — SB s.7.
 *
 * ⚠ Inte ett vanligt grundegenskapsslag. Man slår mot INT, men får **+1 på
 * tärningen för varje poäng INT under 19** — ett straff, inte en lättnad. Den
 * kurerade `MAGI.md` återger det som "(lättare)", vilket är fel håll.
 *
 * Bokens exempel: en magiker med INT 15 får +4 (19−15) och måste alltså slå
 * **11 eller lägre**. Effektivt måltal = INT − (19 − INT) = 2×INT − 19.
 */
export function spellSoloTarget(int) {
  return 2 * int - 19;
}

/** Ett normalt grundegenskapsslag: 1T20 ≤ egenskapens värde (+ modifikation). */
export async function rollTrainingWeek(target) {
  const roll = await new Roll("1d20").evaluate();
  return { roll, target, success: roll.total <= target };
}

/**
 * Träningsavgift i silvermynt för ett pass, ur världsinställningen.
 *
 * ⚠ AVSTEG — se `trainingFeePerWeek` i dode.mjs. RP s.63 anger 150 sm/vecka
 * (magiker 300 sm) plus ×1,5 för elev av annan ras och ×3 för ensam elev; vi
 * tar en fast avgift per pass efter Johans beslut 2026-07-29.
 */
export function trainingFee(mode, item) {
  if (mode !== "larare") return 0;
  const base = game.settings.get("drakar-och-demoner-expert", "trainingFeePerWeek");
  // Magikerlärare kostar dubbelt i boken (150 → 300); den fasta avgiften är satt
  // till magikertaxan, så magirader betalar samma som allt annat.
  return base;
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

/**
 * Kör ett träningspass och skriver EP till posten. Delas av båda fönstren så att
 * avgift, slag, chattkort och EP-bokföring inte kan glida isär mellan dem.
 *
 * @param {object} opts
 * @param {Actor} opts.actor
 * @param {Item} opts.item
 * @param {"ensam"|"larare"} opts.mode
 * @param {number} opts.target Måltal för veckoslaget.
 * @param {string} opts.targetLabel Vad måltalet heter i chatten, t.ex. "INT 16".
 */
export async function runTrainingWeek({ actor, item, mode, target, targetLabel }) {
  const fee = trainingFee(mode, item);
  if (fee > 0 && !(await payFromPurse(actor, fee))) {
    ui.notifications.warn(`Har inte råd med träningsavgiften (${fee} sm).`);
    return null;
  }

  const rolls = [];
  let gained = 0;
  for (let i = 0; i < ROLLS_PER_WEEK[mode]; i++) {
    const result = await rollTrainingWeek(target);
    rolls.push(result);
    if (result.success) gained++;
  }
  if (gained > 0) {
    await item.update({ "system.ep.earned": (item.system.ep?.earned ?? 0) + gained });
  }

  const lines = rolls
    .map((r) => `<li>1T20 = <strong>${r.roll.total}</strong> mot ${targetLabel} — ${r.success ? "lyckat, +1 EP" : "misslyckat"}</li>`)
    .join("");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dode-chat-card"><h3>Träningsvecka — ${item.name}</h3>
      <p>${mode === "larare" ? `Med lärare (${fee} sm)` : "Ensamträning"} · ${ROLLS_PER_WEEK[mode]} slag mot ${targetLabel}</p>
      <ul>${lines}</ul>
      <p><strong>${gained} EP</strong> till ${item.name}.</p></div>`,
    rolls: rolls.map((r) => r.roll),
    sound: CONFIG.sounds.dice
  });

  return gained;
}

/**
 * Växlar in EP mot ett steg. Egen pott först, fria bonuspoäng fyller på — så att
 * bundna poäng inte blir liggande oanvända medan den fria potten töms.
 */
export async function spendEp({ actor, item, row, valueField }) {
  const itemUpdate = { [valueField]: row.next };
  if (row.usableOwn > 0) {
    itemUpdate["system.ep.spent"] = (item.system.ep?.spent ?? 0) + row.usableOwn;
  }
  await item.update(itemUpdate);
  if (row.bonusNeeded > 0) {
    await actor.update({
      "system.ep.bonusSpent": (actor.system.ep.bonusSpent ?? 0) + row.bonusNeeded
    });
  }

  const paid = [
    row.usableOwn > 0 ? `${row.usableOwn} egna` : null,
    row.bonusNeeded > 0 ? `${row.bonusNeeded} bonus` : null
  ].filter(Boolean).join(" + ");

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dode-chat-card"><h3>Höjning</h3>
      <p><strong>${row.label}</strong> ${row.current} → ${row.next}</p>
      <p>Kostnad ${row.cost} EP (${paid})</p></div>`
  });
}
