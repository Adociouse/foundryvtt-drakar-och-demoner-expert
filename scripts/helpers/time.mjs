import { clearAwardMarks } from "./ep.mjs";

/**
 * Tidsmodellen — se DESIGN_DECISIONS.md §10.
 *
 * ⚠ **EN klocka, tva drivare.** `game.time.worldTime` ar enda sanningen om vad
 * klockan ar. Stridsrundan flyttar den 5 sekunder (SLB s.15, hook i dode.mjs);
 * det har fonstret flyttar den i minuter till dygn. Vi haller ingen egen kalender
 * — samma linje som dnd5e, som bara anropar `game.time.advance`.
 *
 * ⚠ **Tiden har ett SLAG, inte bara en langd** (Johan 2026-07-29). Samma antal
 * dygn far olika foljder beroende pa vad rollpersonerna gjorde:
 *
 * | Slag | Somnklocka | Vilosvit | Lakning (SLB s.20) |
 * |------|-----------|----------|--------------------|
 * | vila | nollas    | +1/dygn  | 1 KP per vecka     |
 * | resa | nollas    | ⚠ NOLLAS | halften sa fort    |
 * | aventyr | nollas | ⚠ NOLLAS | halften sa fort    |
 */

export const DAY = 86400;
export const WEEK = 604800;

/** Tidsslag. `strid` hanteras av rundhooken, inte harifran. */
export const TIME_KINDS = {
  vila: { label: "Vila", healDivisor: 1, buildsStreak: true },
  resa: { label: "Resa", healDivisor: 2, buildsStreak: false },
  aventyr: { label: "Äventyr", healDivisor: 2, buildsStreak: false }
};

/**
 * Naturlig lakning — **SLB s.20**: *"en (1) forlorad KP per vecka i alla
 * kroppsdelar som ar skadade, samt till totala KP"*, halva takten om varelsen
 * inte vilar liggande.
 *
 * ⚠ **Per skadad kroppsdel PARALLELLT** — varje omrade laker sin egen KP per
 * vecka, de konkurrerar inte.
 * ⚠ **Nar alla kroppsdelar ar hela aterstalls totala KP automatiskt** till max.
 * Man laker alltsa inte de tva spparen var for sig hela vagen.
 * ⚠ **Infekterad kroppsdel laker ingenting** (SLB s.20) — inte implementerat an,
 * se backlogpost 56.
 */
export async function applyHealing(actor, seconds, kind) {
  const cfg = TIME_KINDS[kind] ?? TIME_KINDS.aventyr;
  const kp = Math.floor(seconds / (WEEK * cfg.healDivisor));
  if (kp <= 0) return { healed: 0, restored: false };

  const hp = actor.system.hp ?? {};
  const locs = foundry.utils.deepClone(actor.system.hitLocations ?? {});
  let touched = false;
  for (const state of Object.values(locs)) {
    if (state.value < state.max) { state.value = Math.min(state.max, state.value + kp); touched = true; }
  }
  const allWhole = Object.values(locs).every((l) => l.value >= l.max);

  const update = {};
  if (touched) update["system.hitLocations"] = locs;
  // Alla kroppsdelar hela → totala KP aterstalls automatiskt (SLB s.20).
  if (allWhole && Object.keys(locs).length) update["system.hp.value"] = hp.max;
  else if ((hp.value ?? hp.max) < hp.max) update["system.hp.value"] = Math.min(hp.max, (hp.value ?? 0) + kp);

  if (Object.keys(update).length) await actor.update(update);
  return { healed: kp, restored: allWhole && Object.keys(locs).length > 0 };
}

/**
 * Flyttar varldsklockan och tillampar foljderna pa valda rollpersoner.
 *
 * ⚠ **Vilosviten ar en SVIT, inte en tidsstampel** — RP s.63 kraver en
 * *"sammanhangande viloperiod om minst sju dagar"*. En vecka pa vagen ar sju dygn
 * av tid men noll dygn av vila, sa resa och aventyr **nollstaller** raknaren.
 * ⚠ **Man sover aven nar man reser**, sa somnklockan nollas oavsett slag — det ar
 * darfor de tva grindarna maste vara skilda mekanismer.
 */
export async function advanceTime({ seconds, kind = "aventyr", actors = [] }) {
  const cfg = TIME_KINDS[kind] ?? TIME_KINDS.aventyr;
  await game.time.advance(seconds);

  const days = seconds / DAY;
  const report = [];
  for (const actor of actors) {
    if (actor.type !== "character") continue;
    const rest = actor.system.rest ?? {};
    const streak = cfg.buildsStreak ? (rest.streakDays ?? 0) + days : 0;
    const unlocked = streak >= 7;

    await actor.update({
      "system.rest.streakDays": streak,
      // Behalls som harlett falt sa traningsfonstret inte behover andras.
      "system.rest.trainingUnlocked": unlocked
    });
    // Sovperiod intraffar i alla slag utom strid.
    const cleared = await clearAwardMarks(actor);
    const heal = await applyHealing(actor, seconds, kind);
    report.push({ name: actor.name, streak, unlocked, cleared, ...heal });
  }
  return { seconds, days, kind: cfg.label, report };
}
