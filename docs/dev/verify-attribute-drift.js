/**
 * Dual-computation drift-test — backlog 11 (docs/DESIGN_DECISIONS.md §3, Important).
 *
 * Jämför wizardens EGEN attributformel (`#effectiveAttributes()`,
 * scripts/apps/character-wizard.mjs) mot vad DataModellen FAKTISKT skriver
 * (`actor-character.mjs#prepareDerivedData()`) för en rollperson skapad med
 * samma bas-attribut, ålder och ras — genom en RIKTIG `Actor.create()` +
 * `createEmbeddedDocuments("Item", [rasItem])`, inte ett handbyggt objekt.
 * Detta är den enda vägen in i #prepareDerivedData som inte kräver att
 * `#effectiveAttributes` (en sann privat klassmetod, `#`-prefixad — oåtkomlig
 * utifrån även via reflection) anropas direkt.
 *
 * ⚠ NIVA är MEDVETET INTE en egen axel i testmatrisen. Niva (`extraordinär`/
 * `hjälte`/...) påverkar bara BP-budgeten en spelare har att KÖPA UPP
 * bas-attributen (`state.attributes`) MED i wizarden — själva formeln
 * (`total = base + raceMod + ageMod`) är identisk oavsett var `base` kom
 * ifrån. Att variera bas-attributen (vilket testet gör indirekt genom att
 * testa BÅDE zero-mod- och extremmod-raser vid samma bas) täcker alltså
 * niva-variationens enda faktiska inverkan på den här formeln.
 *
 * Rassamplet är MEDVETET valt för att täcka båda kodvägarna i
 * `prepareDerivedData()`: Människa har INGEN transfer-AE alls (alla mods 0,
 * ingen AE författad för den — går via `!hasRaceAE`-fallback-grenen),
 * medan Dvärg/Halvlängdsman/Högalv alla har en riktig `transfer:true`
 * ActiveEffect (`flags.<system>.source:"race"` — går via den PRIMÄRA,
 * AE-drivna grenen som verkliga rollpersoner faktiskt använder).
 *
 * ANVÄNDNING: klistra in hela filen i Foundrys konsol (F12) som SL, i en
 * värld som kör drakar-och-demoner-expert. Sedan:
 *
 *   await DoDEAttributeDrift.run();  // kör alla kombinationer, rapporterar, städar
 *
 * Liveverifierat 2026-09-07 (Dvärg/Halvlängdsman/Högalv/Människa × alla 4
 * åldersnivåer, 16 kombinationer, bas sty/fys/smi/int/psy/kar/sto = 12 vardera):
 * 0 avvikelser, 12 kombinationer gick genom den riktiga AE-grenen, 4 genom
 * fallback-grenen — se docs/DESIGN_DECISIONS.md §3 backlog 11 för resultatet.
 */
const DoDEAttributeDrift = {
  /** Rassampel: id → namn i `raser`-kompendiet. Se filhuvudet för urvalslogiken. */
  RACE_SAMPLE: {
    "Människa": "70wwlDmDqJ7vDBNh",
    "Dvärg": "24kN2TQ2NgkH753S",
    "Halvlängdsman": "g4F6i6vck9nOafyr",
    "Högalv": "dodeAlvHogalv000"
  },

  /** Bas-attribut som matas in på båda sidor av jämförelsen. */
  BASE_ATTRS: { sty: 12, fys: 12, smi: 12, int: 12, psy: 12, kar: 12, sto: 12 },

  /** Wizardens egen formel (mirror av #effectiveAttributes) — se filhuvudet. */
  expectedTotal(key, base, raceMods, ageMods) {
    const raceMod = key === "sto" ? 0 : (raceMods[key] ?? 0);
    const ageMod = ageMods[key] ?? 0;
    return base + raceMod + ageMod;
  },

  async run() {
    const pack = game.packs.get("drakar-och-demoner-expert.raser");
    const ages = Object.keys(CONFIG.DODE.ageAttributeModifiers);
    const results = [];
    const createdActorIds = [];

    try {
      for (const [raceName, raceId] of Object.entries(this.RACE_SAMPLE)) {
        const raceDoc = await pack.getDocument(raceId);
        const raceMods = raceDoc.system.attributeMods ?? {};
        for (const age of ages) {
          const ageMods = CONFIG.DODE.ageAttributeModifiers[age] ?? {};
          const expected = {};
          for (const key of Object.keys(this.BASE_ATTRS)) {
            expected[key] = this.expectedTotal(key, this.BASE_ATTRS[key], raceMods, ageMods);
          }

          const actorData = {
            name: `DRIFT-TEST ${raceName} ${age}`,
            type: "character",
            system: { alder: age, attributes: {} }
          };
          for (const key of Object.keys(this.BASE_ATTRS)) {
            actorData.system.attributes[key] = { value: this.BASE_ATTRS[key] };
          }
          const actor = await Actor.create(actorData);
          createdActorIds.push(actor.id);
          await actor.createEmbeddedDocuments("Item", [raceDoc.toObject()]);

          const mismatches = [];
          for (const key of Object.keys(this.BASE_ATTRS)) {
            const actual = actor.system.attributes[key]?.total;
            if (actual !== expected[key]) mismatches.push({ key, expected: expected[key], actual });
          }
          results.push({
            race: raceName, age, mismatches,
            hasRaceAE: actor.appliedEffects?.some((e) => e.getFlag?.(game.system.id, "source") === "race")
          });
        }
      }
    } finally {
      if (createdActorIds.length) await Actor.deleteDocuments(createdActorIds);
    }

    const failures = results.filter((r) => r.mismatches.length > 0);
    const report = {
      totalCombinations: results.length,
      allPassed: failures.length === 0,
      failures,
      aePathCombinations: results.filter((r) => r.hasRaceAE).length,
      fallbackPathCombinations: results.filter((r) => !r.hasRaceAE).length
    };
    console.log(failures.length === 0
      ? `✅ DoDEAttributeDrift: ${report.totalCombinations}/${report.totalCombinations} kombinationer matchade (${report.aePathCombinations} via AE, ${report.fallbackPathCombinations} via fallback).`
      : `❌ DoDEAttributeDrift: ${failures.length} avvikelse(r) hittade — se report.failures.`);
    return report;
  }
};
