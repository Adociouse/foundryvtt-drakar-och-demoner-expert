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
/**
 * Ren härledning av träffområdes-KP — SAMMA formel som `ensureHitLocations`,
 * men utan skrivningen. Används för att FÖRHANDSVISA ett träffområdeseffekt
 * (Spelar-anfall-planen, 2026-08-21: en anfallande klient utan behörighet på
 * målet kan inte skriva `system.hitLocations`, men behöver ändå kunna
 * BERÄKNA vad ett träffområdesslag skulle innebära för att visa ett
 * fullständigt, redan uträknat kort innan SL godkänner). Returnerar `null`
 * under samma villkor som `ensureHitLocations` (< 5 Totala KP, RP s.48).
 */
function deriveHitLocationsPure(actor) {
  const existing = actor.system.hitLocations;
  if (existing && Object.keys(existing).length) return existing;
  const maxKp = actor.system.hp?.max ?? 0;
  const plan = actor.system.bodyPlan ?? "humanoid";
  const derived = CONFIG.DODE.hitLocationKp(plan, maxKp);
  if (!derived) return null;
  const locations = {};
  for (const [key, max] of Object.entries(derived)) locations[key] = { value: max, max };
  return locations;
}

export async function ensureHitLocations(actor) {
  const existing = actor.system.hitLocations;
  if (existing && Object.keys(existing).length) return existing;
  const locations = deriveHitLocationsPure(actor);
  if (!locations) return null;
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
export function armourFor(actor, locationKey = null) {
  // ⚠ "Har aktören NÅGOT rustnings-Item" — inte "har aktören NÅGRA Items
  // alls". Den senare kontrollen (tidigare `actor.items?.size`) tystade
  // tyst en NPC:s abs-fält till 0 så fort NPC:n fick ETT vapen-Item utan
  // ett matchande rustnings-Item (t.ex. via NPC-vapen/rustnings-migreringen,
  // 2026-08-19) — inget konsolfel, bara plötsligt oskyddad NPC.
  const hasArmourItems = (actor.items ?? []).some((i) => i.type === "rustning" && i.system.equipped);

  // ⚠ Utan träffområde (vanlig strid): karaktärer härleder redan
  // `system.abs` ur sina rustnings-Items i prepareDerivedData()
  // (actor-character.mjs) — läs det direkt som förut. NPC:er gör INTE
  // den härledningen; `system.abs` är ett manuellt fält som blir stale
  // så fort en NPC får riktiga rustnings-Items, så för NPC:er med
  // rustnings-Items måste vi läsa Items direkt i stället.
  if (!locationKey) {
    if (actor.type === "npc" && hasArmourItems) {
      let best = 0;
      for (const item of actor.items ?? []) {
        if (item.type === "rustning" && item.system.equipped) best = Math.max(best, item.system.abs ?? 0);
      }
      return best;
    }
    return actor.system.abs ?? 0;
  }

  // ⚠ SB s.27: rustning är namngivna DELAR med var sin täckning. Den bästa
  // buret plåten över just det träffområdet gäller — de staplas inte.
  let best = 0;
  for (const item of actor.items ?? []) {
    if (item.type !== "rustning" || !item.system.equipped) continue;
    const cov = item.system.coverage ?? [];
    // Tom täckning = äldre post utan uppdelning; räknas som heltäckande.
    if (cov.length && !cov.includes(locationKey)) continue;
    best = Math.max(best, item.system.abs ?? 0);
  }
  // SLP:er utan rustnings-Item bär sitt abs direkt på aktören.
  return best || (hasArmourItems ? 0 : (actor.system.abs ?? 0));
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
/**
 * Ren beräkningskärna, delad av `applyLocationDamage` (skriver) och
 * `previewLocationDamage` (skriver INTE) — se Spelar-anfall-planen,
 * 2026-08-21, för varför uppdelningen finns: en anfallande klient utan
 * skrivbehörighet på målet måste ändå kunna räkna ut HELA resultatet.
 *
 * `locationsOverride` låter förhandsvisningen räkna mot en HYPOTETISK
 * träffområdeskarta (från `deriveHitLocationsPure`) utan att den någonsin
 * skrivs — samma träffområde som en efterföljande riktig skrivning skulle
 * härleda, bara utan sidoeffekten.
 */
function computeLocationDamage(actor, locationKey, damage, { intent = "skada", locationsOverride = null } = {}) {
  const locations = foundry.utils.deepClone(locationsOverride ?? actor.system.hitLocations ?? {});
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
  return { totalAfter, locationState: state, effect, pulled, update };
}

/**
 * Lägger skada på ett träffområde OCH på Totala KP (SLB s.18: "I detaljerad
 * strid dras skadan från både träffområdets KP och totala KP"). SKRIVER —
 * kräver att anroparen har behörighet på `actor`. Samma kontrakt som förut:
 * anroparen ansvarar för att ha kört `ensureHitLocations` FÖRST om
 * träffområdeseffekter ska räknas (den `detailed`-styrda vägen i attack.mjs).
 */
export async function applyLocationDamage(actor, locationKey, damage, opts = {}) {
  const r = computeLocationDamage(actor, locationKey, damage, opts);
  await actor.update(r.update);
  return { totalAfter: r.totalAfter, locationState: r.locationState, effect: r.effect, pulled: r.pulled };
}

/**
 * Samma beräkning som `applyLocationDamage`, men SKRIVER INGET — för
 * förhandsvisning på en klient som (ännu) inte har skrivbehörighet på målet.
 * Härleder en HYPOTETISK träffområdeskarta om ingen redan finns (i stället
 * för att kräva `ensureHitLocations`s skrivning), styrt av
 * `allowHypotheticalLocations` (motsvarar attack.mjs's `detailed`-flagga —
 * vanlig strid ska INTE börja räkna träffområden bara för att en
 * förhandsvisning råkar köras).
 */
export function previewLocationDamage(actor, locationKey, damage, { allowHypotheticalLocations = true, ...opts } = {}) {
  const existing = actor.system.hitLocations;
  const hasReal = existing && Object.keys(existing).length;
  const locationsOverride = (!hasReal && allowHypotheticalLocations) ? deriveHitLocationsPure(actor) : null;
  const r = computeLocationDamage(actor, locationKey, damage, { ...opts, locationsOverride });
  return { totalAfter: r.totalAfter, locationState: r.locationState, effect: r.effect, pulled: r.pulled };
}

/**
 * GM-genväg (GM-effektfönstrets person-flik) — sätter ett träffområdes KP
 * direkt till "obrukbar"-tröskeln, för narrativa fall utan ett riktigt slag
 * bakom sig (t.ex. en SLP som stympar en spelares arm för berättelsens skull).
 * Återanvänder `ensureHitLocations`/`locationEffect` exakt som ett vanligt
 * slag skulle göra — ⚠ INTE en parallell modell, se
 * docs/dev/GM_EFFEKTFONSTER_ANALYS.md om varför fysisk skada aldrig ska få en
 * andra sanningskälla.
 *
 * @param {Actor} actor
 * @param {string} locationKey Nyckel ur DODE.hitLocations för aktörens bodyPlan.
 * @returns {Promise<{locationState: object, effect: object}>}
 */
export async function gmDisableLocation(actor, locationKey) {
  const locations = await ensureHitLocations(actor);
  if (!locations?.[locationKey]) {
    throw new Error(`gmDisableLocation: okänt träffområde "${locationKey}" för ${actor.name}.`);
  }
  const updated = foundry.utils.deepClone(actor.system.hitLocations);
  updated[locationKey].value = 0;
  await actor.update({ "system.hitLocations": updated });
  const effect = locationEffect(locationKey, updated[locationKey], 0);
  return { locationState: updated[locationKey], effect };
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
 * ⚠ **RÄTTAD 2026-07-29 (andra försöket).** `Längd`-kolumnen i Spelarbokens
 * närstridsvapentabell (SB s.35) är **inte** REG s.58:s längdkod 0-5 — den är ett
 * eget litet 0-3-tal som anger hur många rutor bortom den intilliggande vapnet
 * når. Tvåhandssvärd har `Längd 1`, inte 3. Räckvidden är alltså rakt av
 * **1 + Längd**:
 *
 * | Längd | Vapen (SB s.35) | Räckvidd |
 * |-------|-----------------|----------|
 * | 0 | dolk, svärd, yxor, klubbor … | 1 ruta |
 * | 1 | tvåhandssvärd, tvåhandsyxa, hillebard, partisan, glav, spetum, pålyxa, kortspjut, piska, treudd | 2 rutor |
 * | 2 | långspjut, lans | 3 rutor |
 * | 3 | pik | 4 rutor |
 *
 * ⚠ **TVÅ OLIKA LÄNGDSYSTEM I TVÅ BÖCKER, samma ordval.** Grundregelboken har på
 * s.58 en ruta *"Beräkning av vapenlängd"* som översätter **verklig längd i meter
 * till en kod 0-5** (0,0-0,4 → 0 · 0,5-0,9 → 1 · 1,0-1,4 → 2 · 1,5-1,9 → 3 ·
 * 2,0-2,9 → 4 · 3,0+ → 5). Spelarbokens `Längd`-kolumn är något helt annat: ett
 * 0-3-tal som direkt anger räckvidd bortom den intilliggande rutan. Samma ord,
 * olika skalor — och `item-vapen.mjs` `length` bär SB:s variant, eftersom det är
 * den som står i vapentabellen vi portat.
 *
 * Mitt första försök läste kolumnen som REG:s längdkod och gav tvåhandssvärdet
 * räckvidd 2 av fel skäl — och långspjutet (`Längd 2`) bara 1 ruta, vilket är
 * uppenbart fel för ett spjut.
 */
export function meleeReach(weapon) {
  return 1 + (Number(weapon?.system?.length) || 0);
}
