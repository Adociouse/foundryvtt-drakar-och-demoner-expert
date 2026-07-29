import { ensureHitLocations, applyLocationDamage, armourFor } from "../helpers/anatomy.mjs";
import { combineDamageFormula } from "./damage-roll.mjs";

/**
 * Stridsupplösning — **Spelledarboken s.16-18**.
 *
 * ⚠ **Träffområde slås ALLTID**, även i vanlig strid. Johans beslut 2026-07-29:
 * *"think of a generic attack always has a hidden riktad attack or if you switch
 * mid fight"*. Slaget är gratis, och genom att alltid ha det kan SL slå om till
 * detaljerad strid mitt i en strid utan att något behöver rekonstrueras — det
 * som skiljer lägena är om området **visas och får effekt**, inte om det finns.
 */

/** CL-modifikationer för närstrid — SLB s.17. */
export const MELEE_MODS = {
  liggande: 5, fransidan: 3, bakifran: 7, ororlig: 10,
  skymning: -5, morker: -15, riktat: -5, skoldhand: -10
};

/** CL-modifikationer för avståndsstrid — SLB s.17. */
export const RANGED_MODS = {
  ororlig: 10, skymning: -5, morker: -15, riktat: -5
};

/**
 * Slår ett FV-slag och klassar utfallet enligt samma perfekt/fummel-bekräftelse
 * som `rollFV` — men utan chattkort, eftersom anfall och parering redovisas
 * tillsammans i ett kort.
 */
async function classifiedRoll(fv) {
  const roll = await new Roll("1d20").evaluate();
  let outcome = roll.total <= fv ? "lyckat" : "misslyckat";
  if (roll.total === 1) {
    const c = await new Roll("1d20").evaluate();
    outcome = c.total <= fv ? "perfekt" : "lyckat";
  } else if (roll.total === 20) {
    const c = await new Roll("1d20").evaluate();
    outcome = c.total > fv ? "fummel" : "misslyckat";
  }
  return { roll, outcome };
}

/**
 * SLB s.17:s resultatmatris. Returnerar vad som ska hända, inte vad som hände.
 *
 * ⚠ **BV är en slitagemätare, inte en absorbering.** Överstiger skadan
 * brytvärdet sjunker BV med 1; vid BV 0 går den överskjutande skadan igenom.
 * ⚠ På **misslyckat anfall + lyckad parering** slits ANFALLARENS vapen — ett
 * vapen kan alltså gå sönder av att bli parerat.
 */
export function resolveMatrix(attack, parry) {
  if (attack === "fummel") return { result: "fummeltabell-anfall" };
  if (attack === "perfekt") return { result: "traff", maxDamage: true, ignoreArmour: true };
  if (attack === "misslyckat") {
    if (parry === "fummel") return { result: "fummeltabell-parering" };
    if (parry === "lyckat" || parry === "perfekt") return { result: "vapenslitage", wearOn: "attacker" };
    return { result: "ingenting" };
  }
  // Lyckat anfall
  if (parry === "fummel") return { result: "traff", alsoFumbleTable: "parering" };
  if (parry === "misslyckat" || parry === null) return { result: "traff" };
  if (parry === "perfekt") return { result: "ingenting" };
  return { result: "parerat", wearOn: "defender" };
}

/**
 * Full stridsupplösning mellan två aktörer.
 *
 * @param {object} o
 * @param {Actor}  o.attacker
 * @param {Item}   o.weapon        `vapen`-item
 * @param {Actor}  o.target
 * @param {Item}   [o.skill]       Vapenfärdigheten (bär FV — vapnet gör INTE det)
 * @param {number} [o.fv]          Uttryckligt FV, för SLP utan färdighets-Item
 * @param {Item}   [o.parryItem]   Vapen/sköld försvararen parerar med
 * @param {string} [o.aimedAt]     Träffområdesnyckel — gör anfallet RIKTAT (−5 CL)
 * @param {string} [o.intent]      "skada" | "bedova"
 * @param {object} [o.mods]        Fria CL-modifikationer, t.ex. { bakifran: 7 }
 * @param {boolean}[o.ranged]      Avståndsanfall — ⚠ kan aldrig pareras utom kastvapen
 * @param {boolean}[o.defending]   Försvarar sig målet? Styr träfftabellens kolumn
 * @param {boolean}[o.detailed]    Visa/tillämpa träffområdeseffekter
 */
export async function resolveAttack({
  attacker, weapon, target, skill = null, fv: fvOverride = null, parryItem = null,
  parrySkill = null, parryFv = null, aimedAt = null,
  intent = "skada", mods = {}, ranged = false, defending = true, detailed = true
}) {
  // ⚠ **Vapnet bär inte FV** — färdigheten gör det (`item-vapen.mjs` har damage,
  // styGroup, baseValue m.m. men inget fv). Den som anropar måste skicka
  // färdigheten eller ett uttryckligt `fv`; annars finns ingen chans att träffa.
  const baseFv = skill?.system.total ?? fvOverride ?? 0;
  if (!baseFv) throw new Error("resolveAttack: skicka `skill` (fardighet-Item) eller `fv` — vapnet bär inget FV.");
  const modTotal = Object.values(mods).reduce((a, b) => a + b, 0) + (aimedAt ? -5 : 0);
  const fv = Math.max(1, baseFv + modTotal);

  const atk = await classifiedRoll(fv);

  // ⚠ Parering: aldrig mot projektilvapen, och aldrig med ett avståndsvapen i
  // handen (SLB s.17). Kastvapen får pareras om försvararen har sköld.
  const canParry = !!parryItem && !ranged;
  const par = canParry
    ? await classifiedRoll(parrySkill?.system.total ?? parryFv ?? baseFv)
    : { roll: null, outcome: null };

  const verdict = resolveMatrix(atk.outcome, par.outcome);
  const out = {
    fv, modTotal, mods, attack: atk, parry: par, verdict,
    aimed: !!aimedAt, intent, damage: null, location: null, effect: null, wear: null
  };

  // ⚠ Träffområdet slås ALLTID — se modulkommentaren. Även när `detailed` är
  // false; då används det bara inte.
  const plan = target?.system.bodyPlan ?? "humanoid";
  const rolled = await CONFIG.DODE.rollHitLocation(plan, { defending, fromBehind: !!mods.bakifran });
  out.location = aimedAt
    ? { location: aimedAt, label: CONFIG.DODE.hitLocations[aimedAt] ?? aimedAt, aimed: true }
    : { ...rolled, aimed: false };

  if (verdict.result === "vapenslitage" || verdict.result === "parerat") {
    const item = verdict.wearOn === "attacker" ? weapon : parryItem;
    const dmg = await new Roll(weapon?.system.damage || "1d6").evaluate();
    // ⚠ Brytvärdet heter `baseValue` på vapenmodellen (BV = brytvärde) — det
    // fanns redan, oanvänt. SLB s.17: överstiger skadan BV sjunker BV med 1;
    // vid BV 0 går den överskjutande skadan igenom till försvararen.
    const bv = item?.system.baseValue ?? null;
    const worn = bv !== null && dmg.total > bv;
    if (worn) await item.update({ "system.baseValue": Math.max(0, bv - 1) });
    const broke = worn && bv - 1 <= 0;
    out.wear = {
      item: item?.name ?? "—", damage: dmg.total, bv, bvAfter: worn ? Math.max(0, bv - 1) : bv,
      worn, broke, wearOn: verdict.wearOn,
      overflow: broke ? Math.max(0, dmg.total - 0) : 0,
      note: bv === null ? "⚠ Föremålet saknar brytvärde (baseValue)" : ""
    };
    // ⚠ Går BV till 0 fortsätter anfallet — men **stridsdiagrammet (SLB s.31)**
    // skickar den grenen genom rutan "−1 på skadan" innan rustningen dras.
    // Textmatrisen på s.17 säger bara "den överskjutande skadan" utan att nämna
    // avdraget; diagrammet är det mer precisa av de två och följs här.
    // Håller skölden (BV > 0) är anfallet slut — ingen skada alls går igenom.
    if (broke && verdict.wearOn === "defender") {
      const abs = armourFor(target);
      const applied = Math.max(0, dmg.total - 1 - abs);
      const res = await applyLocationDamage(target, out.location.location, applied, { intent });
      out.damage = { roll: dmg, formula: weapon?.system.damage, abs, applied, viaBrokenParry: true, minusOne: true };
      out.effect = res.effect;
      out.totalAfter = res.totalAfter;
    }
    return out;
  }

  // ⚠ **AVSTEG — "det rena utslaget". Creator decision, Johan 2026-07-29.**
  // Ingen bok har någon motsvarighet. Ett PERFEKT anfallsslag med bedövande
  // avsikt mot ett RIKTAT huvudslag slår ut offret fullständigt: **noll skada**,
  // medvetslös i dagar, och inget spår av hur det gick till.
  //
  // Elegansen ligger i nollan: eftersom inga KP dras finns det heller ingen
  // sårskada att hitta, varken mekaniskt eller i fiktionen. Offret vaknar
  // oskadat och vet inte vad som hände.
  //
  // ⚠ Priset är inbyggt: man måste RIKTA mot huvudet (−5 CL), vilket gör det
  // perfekta slaget svårare att bekräfta. Man betalar alltså i träffchans för
  // chansen till ett rent utslag.
  //
  // ⚠ Kräver medvetet både riktat huvudslag OCH bedövande avsikt — annars hade
  // ett perfekt rapiestick "slagit ut" någon, vilket vore orimligt.
  if (atk.outcome === "perfekt" && intent === "bedova" && aimedAt === "huvud") {
    const formula = game.settings.get("drakar-och-demoner-expert", "cleanKnockoutDuration");
    const dur = await new Roll(formula).evaluate();
    out.cleanKnockout = {
      days: dur.total, roll: dur,
      text: `Rent utslag — medvetslös i ${dur.total} dygn. Ingen skada, inget spår av hur det gick till.`
    };
    out.damage = { roll: null, formula: null, abs: 0, applied: 0, cleanKnockout: true };
    out.totalAfter = target.system.hp?.value ?? target.system.hp?.max ?? 0;
    return out;
  }

  if (verdict.result !== "traff") return out;

  // --- Träff: skada → rustning → träffområde + Totala KP -------------------
  const formula = combineDamageFormula(weapon?.system.damage || "1d6",
    ranged ? "" : (attacker.system.damageBonus ?? ""));
  const dmgRoll = await new Roll(formula).evaluate();
  let damage = verdict.maxDamage
    // Perfekt: automatiskt maximal skada med maximal skadebonus (SLB s.18).
    ? dmgRoll.terms.filter((t) => t.faces).reduce((a, t) => a + t.number * t.faces, 0)
      + dmgRoll.terms.filter((t) => typeof t.number === "number" && !t.faces).reduce((a, t) => a + t.number, 0)
    : dmgRoll.total;

  // ⚠ **KONFLIKT INOM SAMMA BOK — SLB s.17 mot s.31.**
  //   s.17 (textmatrisen): "Perfekt ... Attacken gör automatiskt maximal skada.
  //     Försvararens rustningsabsorbering dras ej bort."
  //   s.31 (stridsdiagrammet): rutan "Maximal skada" flödar in i "Dra bort
  //     rustningens absorbering och/eller naturligt skydd" precis som de andra
  //     två skadegrenarna — alltså dras rustningen även vid perfekt.
  // Vi följer TEXTEN (ingen absorbering vid perfekt), eftersom den är ett
  // uttryckligt påstående medan diagrammet kan vara en förenkling. Skillnaden
  // är stor i praktiken: mot Abs 8 är ett perfekt hugg antingen förödande eller
  // nästan verkningslöst. ⚠ Behöver Johans beslut — se DESIGN_DECISIONS.md.
  const abs = verdict.ignoreArmour ? 0 : armourFor(target);
  damage = Math.max(0, damage - abs);
  out.damage = { roll: dmgRoll, formula, abs, applied: damage, maximised: !!verdict.maxDamage };

  if (detailed) await ensureHitLocations(target);
  const applied = await applyLocationDamage(target, out.location.location, damage, { intent });
  out.effect = applied.effect;
  out.totalAfter = applied.totalAfter;
  out.pulled = applied.pulled;
  return out;
}

const OUTCOME_LABEL = { perfekt: "Perfekt!", lyckat: "Lyckat", misslyckat: "Misslyckat", fummel: "Fummel!" };
const VERDICT_NOTE = {
  "fummeltabell-anfall": "⚠ Slå på fummeltabellen för anfall (ej byggd än)",
  "fummeltabell-parering": "⚠ Slå på fummeltabellen för pareringar (ej byggd än)",
  ingenting: "Ingenting händer — fortsätt med nästa attack",
  parerat: "Pareringen höll — anfallet är slut (SLB s.31)",
  vapenslitage: "Pareringen tog emot ett misslyckat hugg — anfallarens vapen slits"
};

/**
 * Postar stridskortet. Följer stridsdiagrammets ordning (SLB s.31) uppifrån och
 * ned, så att bordet kan följa med i samma sekvens som boken.
 *
 * ⚠ Alla tärningar bifogas `rolls` så att Dice So Nice animerar dem.
 */
export async function postAttackCard(result, { attacker, weapon, parryItem, ranged }) {
  const parts = Object.entries(result.mods ?? {}).map(([k, v]) => ({
    label: k, value: v, positive: v > 0
  }));
  if (result.aimed) parts.push({ label: "riktat", value: -5, positive: false });

  const content = await renderTemplate(
    "systems/drakar-och-demoner-expert/templates/chat/attack-card.hbs", {
      attackerName: attacker.name,
      weaponName: weapon?.name ?? "Obeväpnad",
      weaponImg: weapon?.img ?? attacker.img,
      aimed: result.aimed,
      intentBedova: result.intent === "bedova",
      fv: result.fv, base: result.fv - result.modTotal, clParts: parts,
      attackRoll: result.attack.roll.total,
      attackOutcome: result.attack.outcome,
      attackOutcomeLabel: OUTCOME_LABEL[result.attack.outcome],
      hasParry: !!result.parry.roll,
      parryRoll: result.parry.roll?.total,
      parryOutcome: result.parry.outcome,
      parryOutcomeLabel: OUTCOME_LABEL[result.parry.outcome],
      parryItemName: parryItem?.name ?? "",
      ranged,
      locationLabel: result.location?.label,
      damage: result.damage?.roll ? {
        rolled: result.damage.roll.total, abs: result.damage.abs,
        applied: result.damage.applied, maximised: result.damage.maximised
      } : null,
      totalAfter: result.totalAfter, pulled: result.pulled,
      effect: result.effect, wear: result.wear, cleanKnockout: result.cleanKnockout,
      verdictNote: VERDICT_NOTE[result.verdict.result] ?? "",
      cssClass: result.attack.outcome
    });

  const rolls = [result.attack.roll];
  if (result.parry.roll) rolls.push(result.parry.roll);
  if (result.damage?.roll) rolls.push(result.damage.roll);
  if (result.cleanKnockout?.roll) rolls.push(result.cleanKnockout.roll);

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content, rolls, sound: CONFIG.sounds.dice
  });
}
