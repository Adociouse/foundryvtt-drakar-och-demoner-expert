/**
 * Träffområden i spel — Rollpersonen s.48-50, Spelledarboken s.17-18.
 *
 * ⚠ **Träffområden skapas LAT.** `actor.system.hitLocations` är tomt tills någon
 * faktiskt siktar på varelsen; då härleds KP per område ur Totala KP
 * (`DODE.hitLocationKp`). Det är den mekanism som gör att vanlig och detaljerad
 * strid kan blandas fritt: ett vanligt slagsmål kostar ingen bokföring alls, och
 * en varelse får en kropp först i det ögonblick det spelar roll.
 */

/**
 * Ser till att varelsen har träffområdes-KP och returnerar dem.
 *
 * ⚠ Returnerar `null` för varelser under 5 Totala KP — RP s.48: "Om Totala KP är
 * 1-4 delar man inte in kroppen i olika träffområden." Riktade anfall är alltså
 * meningslösa mot råttor och liknande, och anropande kod måste tåla `null`.
 */
export async function ensureHitLocations(actor) {
  const existing = actor.system.hitLocations;
  if (existing && Object.keys(existing).length) return existing;

  const maxKp = actor.system.hp?.max ?? 0;
  const plan = actor.system.bodyPlan ?? "humanoid";
  const derived = CONFIG.DODE.hitLocationKp(plan, maxKp);
  if (!derived) return null;

  // Varje område får value === max vid skapandet; skador dras sedan från value.
  const locations = {};
  for (const [key, max] of Object.entries(derived)) locations[key] = { value: max, max };
  await actor.update({ "system.hitLocations": locations });
  return locations;
}

/**
 * Rustningens absorbering för ett givet träffområde.
 *
 * ⚠ **Förenkling, medvetet.** RP s.52 ger rustning per kroppsdel (hjälm, armskena,
 * benskena, kilt, harnesk...), men vår `rustning`-modell har ett enda `abs`-fält
 * utan kroppsdelsangivelse. Tills rustningsmodellen delas upp per kroppsdel
 * används aktörens samlade `abs` för alla områden. Se DESIGN_DECISIONS.md.
 */
export function armourFor(actor) {
  return actor.system.abs ?? 0;
}

/**
 * Skadeeffekter när ett träffområdes KP passerar noll — SLB s.18 / RP s.50.
 *
 * ⚠ **Två trösklar, inte en:**
 *  - KP ≤ 0 → området obrukbart (arm hänger slapp, ben viker sig). Bröstkorg/mage
 *    fäller varelsen; huvud ger medvetslöshet.
 *  - Skada ≥ **dubbla** områdets max-KP → **kritisk skada**. Arm/ben/vinge huggs av
 *    eller måste amputeras; bröstkorg/mage ger omedelbar medvetslöshet och
 *    förblödning; **huvud = död på plats**.
 *
 * ⚠ RP s.50 och SLB s.18 anger olika tid för medvetslöshet vid huvudskada
 * (RP "40−FYS minuter", SLB "1T100−FYS minuter, minst 5"). Vi följer SLB, som är
 * Expert-seriens egen stridsbok — flaggat i DESIGN_DECISIONS.md.
 */
export function locationEffect(locationKey, locationState, damageTaken) {
  const critical = damageTaken >= locationState.max * 2;
  const disabled = locationState.value <= 0;
  const isHead = locationKey === "huvud" || locationKey === "huvud-hals";
  const isTorso = ["brostkorg", "mage", "kropp", "hastkropp", "manniskokropp"].includes(locationKey);

  if (critical) {
    if (isHead) return { level: "kritisk", lethal: true, text: "Huvudet krossat eller avhugget — omedelbar död (SLB s.18)" };
    if (isTorso) return { level: "kritisk", lethal: false, unconscious: true, bleeding: true,
      text: "Kritisk bålskada — omedelbart medvetslös, förblöder inom FYS SR (RP s.50)" };
    return { level: "kritisk", lethal: false, severed: true,
      text: "Kroppsdelen avhuggen eller måste amputeras — blir aldrig normalt användbar igen (RP s.50)" };
  }
  if (!disabled) return null;
  if (isHead) return { level: "utslagen", unconscious: true,
    text: "Medvetslös 1T100−FYS minuter (minst 5) — SLB s.18" };
  if (isTorso) return { level: "utslagen", prone: true,
    text: "Faller till marken, oförmögen att göra något tills hjälp anländer (SLB s.18)" };
  return { level: "obrukbar", bleeding: true,
    text: "Kroppsdelen obrukbar. ⚠ Två fungerande armar krävs för Första förband och för att lägga besvärjelser" };
}

/**
 * Lägger skada på ett träffområde OCH på Totala KP (SLB s.18: "I detaljerad
 * strid dras skadan från både träffområdets KP och totala KP").
 *
 * `intent: "bedova"` är ⚠ **ETT AVSTEG** — se `resolveAttack` i rolls/attack.mjs.
 */
export async function applyLocationDamage(actor, locationKey, damage, { intent = "skada" } = {}) {
  const locations = foundry.utils.deepClone(actor.system.hitLocations ?? {});
  const state = locations[locationKey];
  const hp = actor.system.hp ?? {};
  let totalAfter = (hp.value ?? hp.max ?? 0) - damage;
  let effect = null;

  if (state) {
    state.value -= damage;
    effect = locationEffect(locationKey, state, damage);
  }

  // ⚠ AVSTEG (Johan 2026-07-29): boken har ingen icke-dödlig avsikt alls. Ett
  // klubbslag som når 0 KP dödar inte i sig — men inget hindrar heller att det
  // gör det. Johan: "A thief clubbing someone still could unintentionally
  // unalive them." Därför är avsikten en HALV garanti: ett bedövningsslag som
  // skulle dra Totala KP under noll stannar på 0 (medvetslös enligt SLB s.18),
  // MEN en kritisk träff följer bokens dödliga utfall ändå. Man kan alltså
  // fortfarande råka slå ihjäl någon, vilket är precis vad som eftersträvades.
  const pulled = intent === "bedova" && totalAfter < 0 && !effect?.lethal;
  if (pulled) totalAfter = 0;

  const update = { "system.hp.value": totalAfter };
  if (state) update["system.hitLocations"] = locations;
  await actor.update(update);

  return { totalAfter, locationState: state, effect, pulled };
}

/**
 * Avstånd mellan två tokens — **Foundrys egen mätning**, inte egen geometri.
 *
 * ⚠ Johan 2026-07-29: *"But foundry has distance function, right?"* Ja, och den
 * ska användas. `canvas.grid.measurePath()` respekterar rutnätstypen (fyrkant,
 * hex, rutnätslöst) och den diagonalregel världen är inställd på. Ett handskrivet
 * Chebyshev-avstånd (som stridssimuleringen använde) ger fel så fort någon byter
 * till hex eller till en annan diagonalregel.
 *
 * Returnerar BÅDE `spaces` (rutor — det DoDE:s regler räknar i, SLB s.15) och
 * `distance` (scenens enheter, hos oss meter). ⚠ På ett rutnätslöst underlag är
 * `spaces` 0 och bara `distance` är meningsfull.
 */
export function tokenDistance(a, b) {
  const from = a?.object?.center ?? { x: a.x, y: a.y };
  const to = b?.object?.center ?? { x: b.x, y: b.y };
  const path = canvas.grid.measurePath([from, to]);
  return { spaces: path.spaces, distance: path.distance, units: canvas.grid.units };
}

/**
 * Räckvidd i RUTOR för ett närstridsvapen.
 *
 * ⚠ SLB s.16: "Normalt måste din motståndare stå i rutan intill dig" — 1 ruta.
 * "Med vissa vapen, t.ex. spjut och hillebarder, kan du dock anfalla motståndare
 * som befinner sig en eller flera rutor bort", och med dem får man dessutom
 * anfalla **genom rutor med andra stridande i**.
 *
 * ⚠ **Härledd, inte tabellerad.** Boken ger ingen kolumn "räckvidd i rutor".
 * Johan 2026-07-29 läste ut den ur **Spelarboken s.47-48**, som ritar upp varje
 * vapen mot en centimeterskala: en ruta är 150 cm (SLB s.15), så ett vapen som
 * sticker ut förbi 150 cm når två rutor och ett förbi 300 cm når tre. Det ger
 * tvåhandssvärd och tvåhandsyxa räckvidd 2, hillebard/partisan/glav/korpspjut 2,
 * och långspjut 3 — precis vad diagrammet visar.
 *
 * `vapen.system.length` är RP s.58:s **längdKOD 0-5**, inte meter:
 *
 * | Kod | Verklig längd | Räckvidd |
 * |-----|---------------|----------|
 * | 0-2 | 0 - 1,4 m     | 1 ruta   |
 * | 3-4 | 1,5 - 2,9 m   | 2 rutor  |
 * | 5   | 3,0 m +       | 3 rutor  |
 */
export function meleeReach(weapon) {
  const code = Number(weapon?.system?.length) || 0;
  if (code >= 5) return 3;
  if (code >= 3) return 2;
  return 1;
}
