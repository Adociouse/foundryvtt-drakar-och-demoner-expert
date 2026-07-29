/**
 * Testuppsättning för strid — två rollpersoner och två SLP.
 *
 * Klistra in i F12-konsolen som SL, eller kör `DoDECombatTest.seed()`.
 * `DoDECombatTest.teardown()` städar bort allt igen.
 *
 * ⚠ **Vapnet bär inget FV** — färdigheten gör det (`item-vapen.mjs` har damage,
 * styGroup och baseValue men inget fv). Varje figur här får därför BÅDE ett
 * vapen och en matchande vapenfärdighet; utan färdigheten kan `resolveAttack`
 * inte slå något alls. Det var första felet i livetestet 2026-07-29.
 *
 * ⚠ Skölden är också ett `vapen`-item — den pareras med och har brytvärde,
 * den absorberar inte (SB s.38: sköldtabellen har ingen Absorbering-kolumn).
 */
const DoDECombatTest = {
  FLAG: "dode-combat-test",

  async seed() {
    await this.teardown();
    const mk = (data) => foundry.utils.mergeObject(data, {
      [`flags.${game.system.id}.${this.FLAG}`]: true
    });

    // --- Rollpersoner ------------------------------------------------------
    const sigrid = await Actor.create(mk({
      name: "Sigrid Järnhand", type: "character",
      system: {
        attributes: { sty: { value: 15 }, sto: { value: 13 }, fys: { value: 14 },
          smi: { value: 16 }, int: { value: 11 }, psy: { value: 10 }, kar: { value: 12 } },
        // KP = (FYS+STO)/2 uppåt = 14 (RP s.24)
        hp: { max: 14, value: 14 },
        // ⚠ `abs` går INTE att sätta här — på en rollperson HÄRLEDS det ur buren
        // rustning i prepareDerivedData. Att skriva ett värde ger tyst 0. SLP:er
        // har däremot ett riktigt abs-fält (källorna anger det direkt).
        bodyPlan: "humanoid", swordHand: "hoger",
        currency: { gm: 12, sm: 5, km: 0 }
      }
    }));
    await sigrid.createEmbeddedDocuments("Item", [
      { name: "Bredsvärd", type: "vapen", system: { damage: "1d8+1", baseValue: 15, styGroup: 2, grip: "1H" } },
      { name: "Rundsköld, liten", type: "vapen", system: { damage: "1d3", baseValue: 9, grip: "1H" } },
      // ⚠ Färdigheterna är det som bär FV.
      { name: "Svärd", type: "fardighet", system: { fv: 14, attribute: "smi", category: "a", costTier: "yrkesfardighet", skillKey: "svard" } },
      { name: "Sköld", type: "fardighet", system: { fv: 12, attribute: "smi", category: "a", costTier: "yrkesfardighet", skillKey: "skold" } },
      // Ringbrynja Abs 6 (RP s.52). `equipped: true` krävs — annars räknas den inte.
      { name: "Ringbrynja", type: "rustning", system: { abs: 6, equipped: true, price: 175 } }
    ]);

    const rurik = await Actor.create(mk({
      name: "Rurik Tvåyxa", type: "character",
      system: {
        attributes: { sty: { value: 17 }, sto: { value: 15 }, fys: { value: 16 },
          smi: { value: 12 }, int: { value: 10 }, psy: { value: 9 }, kar: { value: 10 } },
        hp: { max: 16, value: 16 },
        bodyPlan: "humanoid",
        // ⚠ Ambidextriös — RP s.27. Ingen sämre hand, alltså inget −10 på
        // sköldhanden, vilket är hela poängen med att slåss med två vapen.
        swordHand: "ambidextrios",
        currency: { gm: 8, sm: 0, km: 0 }
      }
    }));
    await rurik.createEmbeddedDocuments("Item", [
      { name: "Handyxa", type: "vapen", system: { damage: "1d6+2", baseValue: 11, styGroup: 2, grip: "1H" } },
      { name: "Handyxa (avig hand)", type: "vapen", system: { damage: "1d6+2", baseValue: 11, styGroup: 2, grip: "1H" } },
      { name: "Yxor", type: "fardighet", system: { fv: 15, attribute: "smi", category: "a", costTier: "yrkesfardighet", skillKey: "yxor" } },
      { name: "Två vapen", type: "fardighet", system: { fv: 11, attribute: "smi", category: "a", costTier: "yrkesfardighet", skillKey: "tva-vapen" } },
      { name: "Nitläder", type: "rustning", system: { abs: 3, equipped: true, price: 70 } }
    ]);

    // --- Spelledarpersoner -------------------------------------------------
    // ⚠ SLP:er har inga färdighets-Item (MONSTER.md: källorna anger färdigheter
    // som fritext), så deras FV skickas som `fv`-argument till resolveAttack.
    const bandit = await Actor.create(mk({
      name: "Stigman", type: "npc",
      system: {
        attributes: { sty: { value: 13 }, sto: { value: 12 }, fys: { value: 12 }, smi: { value: 13 } },
        hp: { max: 12, value: 12 }, abs: 2, bodyPlan: "humanoid",
        damageBonus: "", moral: 7,
        attacks: [{ name: "Kortsvärd", fv: 11, damage: "1d6+1" }]
      }
    }));
    const varg = await Actor.create(mk({
      name: "Varg", type: "npc",
      system: {
        attributes: { sty: { value: 12 }, sto: { value: 10 }, fys: { value: 14 }, smi: { value: 16 } },
        hp: { max: 12, value: 12 }, abs: 1,
        // ⚠ Fyrfotadjur — konstruerad kroppsbyggnad, se config.mjs.
        bodyPlan: "fyrfota", moral: 6,
        attacks: [{ name: "Bett", fv: 13, damage: "1d6" }]
      }
    }));

    console.log("Sådd klar:", [sigrid, rurik, bandit, varg].map((a) => a.name).join(", "));
    return { sigrid, rurik, bandit, varg };
  },

  async teardown() {
    const doomed = game.actors.filter((a) => a.getFlag(game.system.id, this.FLAG));
    for (const a of doomed) await a.delete();
    return doomed.length;
  }
};
globalThis.DoDECombatTest = DoDECombatTest;
