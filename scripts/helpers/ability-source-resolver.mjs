/**
 * Slår upp och slår ihop en ras/yrkes strukturerade förmågelista
 * (`item-ras.mjs` `automaticAbilities`, `item-yrke.mjs` `professionAbilities`)
 * — 2026-08-16, se DESIGN_DECISIONS.md backlog 70 och wise-herding-lemur.md.
 *
 * Egen liten fil i stället för att byggas in i special-ability-effects.mjs,
 * som är avgränsat till förmågostegets slumptabellsflöde — det HÄR är
 * platsen en framtida `resolveWeaponAbilityRows(weaponDoc)`/
 * `resolveSpellAbilityRows(spellDoc)` skulle läggas till, utan att röra
 * `resolveGrants`/`applyResolvedAbility` (special-ability-effects.mjs) alls,
 * som redan är effekttyp- och origin-agnostiska.
 */

/**
 * Hittar ett yrkes BASYRKE bland en lista yrkesdokument, via den redan
 * existerande `revealsProfessionGroup`-flaggan (satt på Krigare/Tjuv/
 * Lönnmördare/Bard, samma värderymd som `system.baseProfession`).
 * @param {Item[]} professionDocs
 * @param {string} key t.ex. "krigare"
 * @returns {Item|null}
 */
export function findBaseProfessionDoc(professionDocs, key) {
  if (!key) return null;
  return professionDocs.find((p) => p.getFlag(game.system.id, "revealsProfessionGroup") === key) ?? null;
}

/**
 * Ett yrkes fulla förmågelista = basyrkets EGNA rader (om yrket är en
 * specialisering) + yrkets EGNA rader. Undviker att duplicera t.ex.
 * Krigarens "+5 på initiativ" på varje krigarspecialisering för sig —
 * varje specialiseringspost har bara sin egen "plus:"-rad.
 * @param {Item|null} professionDoc Det valda yrket.
 * @param {Item[]} professionDocs Alla yrken (för basyrkes-uppslaget).
 * @returns {Array<{name:string, description:string, effect:object|null}>}
 */
export function resolveProfessionAbilityRows(professionDoc, professionDocs) {
  if (!professionDoc) return [];
  const baseKey = professionDoc.system?.baseProfession || null;
  const baseDoc = baseKey ? findBaseProfessionDoc(professionDocs, baseKey) : null;
  return [
    ...(baseDoc?.system?.professionAbilities ?? []),
    ...(professionDoc.system?.professionAbilities ?? [])
  ];
}

/**
 * Trivial passthrough (ingen arvskedja för raser) — kvar för symmetri med
 * resolveProfessionAbilityRows och som en tydlig utökningspunkt.
 * @param {Item|null} raceDoc
 * @returns {Array<{name:string, description:string, effect:object|null}>}
 */
export function resolveRaceAbilityRows(raceDoc) {
  return raceDoc?.system?.automaticAbilities ?? [];
}
