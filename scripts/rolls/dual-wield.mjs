import { resolveAttack, postAttackCard } from "./attack.mjs";

/**
 * Två vapen — handlingsekonomi, RP s.59. Se docs/dev/STRID_FLERHAND_ANVANDNINGSFALL.md
 * (UC-F8–F10) och docs/DESIGN_DECISIONS.md backlog 32.
 *
 * ⚠ **Skopa medvetet snävt.** Den fulla Combatant-/rundhandlingslagret (§9 i
 * DESIGN_DECISIONS.md) är inte byggt — det finns ingen dokumentmodell för
 * "vad har den här aktören redan gjort denna SR". Det den här filen KAN göra
 * utan det lagret: den atomära "2 anfall"-varianten (två ordnade
 * `resolveAttack()`-anrop i samma orkestrering, inget mellanliggande
 * rundtillstånd behövs). "Anfall + parering" och "2 pareringar" kräver att en
 * ANNAN handling (en inkommande attack senare samma SR, ibland från en helt
 * annan aktörs tur) senare gör ett eget `resolveAttack()`-anrop med rätt
 * vapen som `parryItem` — det är redan möjligt (resolveAttack tar vilket
 * vapen som helst som parryItem), bara inte SPÄRRAT till "max en extra
 * parering per SR" utan den obyggda rundräknaren. `canUseTwoWeapons` är
 * spärren för själva RÄTTEN att göra det; en framtida Combatant-lager får
 * spärra ANTALET.
 */

/** RP s.59 — de tre alternativen, för framtida UI att lista. */
export const TWO_WEAPON_OPTIONS = [
  { key: "tva-anfall", label: "2 anfall", automated: true },
  { key: "anfall-parering", label: "Anfall + parering", automated: "delvis" },
  { key: "tva-pareringar", label: "2 pareringar", automated: "delvis" }
];

/**
 * Aktörens effektiva FV i en namngiven färdighet — egen `total` +
 * vapengruppsbonus + färdighetsmodifierare (samma beräkning som redan finns i
 * `actor-character-sheet.mjs#onAddTwoWeaponCombo` och `training.mjs#skillCap`
 * — samlad här så alla tre inte kan glida isär).
 */
export function effectiveSkillFv(actor, skillKey) {
  const item = actor.items.find((i) => i.type === "fardighet" && i.system.skillKey === skillKey);
  if (!item) return 0;
  return item.system.total
    + (actor.system.weaponGroupBonusTotals?.[skillKey] ?? 0)
    + (actor.system.skillModifierTotals?.[skillKey] ?? 0);
}

/**
 * Får aktören slåss med två vapen den här SR:n?
 *
 * Kräver ANTINGEN en tränad `twoWeaponCombo`-färdighet för just det här
 * vapenparet, ELLER Ambidextriös (CLAUDE.md avsteg 2026-08-04,
 * `DODE.canDualWieldWithoutTraining`). Spärras i BÅDA fallen av en aktiv
 * `armObrukbar`/`handUpptagen`-status — en fysisk/positionell begränsning
 * som gäller oavsett handstyp eller träning (se
 * STRID_FLERHAND_ANVANDNINGSFALL.md UC-F15).
 *
 * ⚠ Ingen vänster-/högerhandsupplösning — en enda generisk status per aktör,
 * inte per lem. Se docs/dev/GM_EFFEKTFONSTER_ANALYS.md om varför (ingen
 * per-lem-datamodell finns utanför det detaljerade hitLocations-systemet,
 * som medvetet hålls avstängt från allmän strid den här omgången).
 *
 * @param {Actor} actor
 * @param {{primaryWeaponKey: string, offWeaponKey: string}|null} combo Ett
 *   redan tränat `twoWeaponCombo`-item, om ett sådant finns.
 * @returns {{allowed: boolean, reason: string}}
 */
export function canUseTwoWeapons(actor, combo = null) {
  const conditions = CONFIG.DODE.actorConditions(actor);
  if (conditions.has("armObrukbar") || conditions.has("handUpptagen")) {
    return { allowed: false, reason: "En arm/hand är obrukbar eller upptagen — bara ett vapen kan användas denna SR." };
  }
  if (combo) return { allowed: true, reason: "Tränad Två vapen-kombination." };
  if (CONFIG.DODE.canDualWieldWithoutTraining(actor)) {
    return { allowed: true, reason: "Ambidextriös — inget träningskrav (CLAUDE.md avsteg 2026-08-04)." };
  }
  return { allowed: false, reason: "Kräver antingen en tränad Två vapen-kombination eller Ambidextriös (RP s.59, SB s.33)." };
}

/**
 * "2 anfall" — RP s.59: svärdshanden agerar FÖRST i turordningen, sköldhanden
 * SIST. Två fullständiga, oberoende `resolveAttack()`-upplösningar (får
 * gärna gälla olika mål). Postar båda korten i rätt ordning.
 *
 * @param {object} o
 * @param {Actor} o.attacker
 * @param {Item} o.primaryWeapon Svärdshandens vapen-Item.
 * @param {Item} o.primarySkill  Svärdshandens fardighet-Item (bär FV).
 * @param {Item} o.offWeapon     Sköldhandens vapen-Item.
 * @param {Item} o.offSkill      Sköldhandens fardighet-Item.
 * @param {Actor} o.primaryTarget
 * @param {Actor} [o.offTarget]  Default samma mål som primaryTarget.
 * @param {{primaryWeaponKey:string, offWeaponKey:string}|null} [o.combo]
 * @param {object} [o.sharedOptions] Extra `resolveAttack`-options (mods, detailed, ranged=false m.m.) som ska gälla båda anfallen.
 */
export async function resolveTwoAttacks({
  attacker, primaryWeapon, primarySkill, offWeapon, offSkill,
  primaryTarget, offTarget = null, combo = null, sharedOptions = {}
}) {
  const gate = canUseTwoWeapons(attacker, combo);
  if (!gate.allowed) {
    ui.notifications?.warn(`Två vapen: ${gate.reason}`);
    return { allowed: false, reason: gate.reason, primary: null, off: null };
  }

  const primary = await resolveAttack({
    attacker, weapon: primaryWeapon, skill: primarySkill,
    target: primaryTarget, ...sharedOptions
  });
  await postAttackCard(primary, { attacker, weapon: primaryWeapon, parryItem: null, ranged: !!sharedOptions.ranged });

  const off = await resolveAttack({
    attacker, weapon: offWeapon, skill: offSkill,
    target: offTarget ?? primaryTarget, ...sharedOptions
  });
  await postAttackCard(off, { attacker, weapon: offWeapon, parryItem: null, ranged: !!sharedOptions.ranged });

  return { allowed: true, reason: gate.reason, primary, off };
}
