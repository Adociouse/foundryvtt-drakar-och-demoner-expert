/**
 * Testfixturer — skapar en standarduppsättning rollpersoner för regressions-
 * och modultestning. Se docs/TEST_CASES.md för vad varje fixtur är till för.
 *
 * ANVÄNDNING: klistra in hela filen i Foundrys konsol (F12) som SL, i en värld
 * som kör drakar-och-demoner-expert. Sedan:
 *
 *   await DoDETestParty.seed();      // skapar allt som saknas (idempotent)
 *   await DoDETestParty.teardown();  // tar bort ALLA seedade fixturer
 *   DoDETestParty.report();          // sammanfattar vad som finns
 *
 * Filen ligger under docs/ och följer alltså INTE med i en runtime-zip
 * (distributionspaketet innehåller bara system.json, scripts/, templates/,
 * lang/, styles/, packs/ — se DESIGN_DECISIONS.md §3 om distributionspipelinen).
 *
 * ⚠ Fixturerna skapas via GUIDENS EGNA skaparväg, inte via Actor.create direkt.
 * Det är avsiktligt: seedningen blir därmed också ett regressionstest av
 * rollpersonsskaparen (färdighetsgenerering, ålders-AE, prototyptoken osv.).
 * Går seedningen igenom utan fel fungerar hela skaparkedjan.
 */
const DoDETestParty = (() => {
  const FIXTURE_FLAG = "testFixture";

  /**
   * ⚠ UUID är primärnyckeln, namnet bara en läsbar fallback.
   *
   * Anledning: namn är INTE stabila identifierare. Översättningsmoduler av
   * Babele-typ döper om kompendiedokument vid körning, så en ren namnuppslagning
   * ("Dvärg") skulle sluta fungera i en engelskspråkig värld — och kompendiets
   * `_id` (som UUID:t byggs av) ligger fast i `packs/<namn>/_source/*.json` och
   * överlever både ompackning och översättning.
   *
   * Fallbacken på namn finns kvar för det fall ett kompendium byggts om från
   * grunden med nya id:n; då loggas en varning så att UUID-tabellen nedan kan
   * uppdateras istället för att tyst gå på namn.
   */
  const resolve = async (packKey, ref) => {
    if (ref?.uuid) {
      const doc = await fromUuid(ref.uuid);
      if (doc) return doc;
      console.warn(`DoDETestParty: UUID ${ref.uuid} hittades inte — faller tillbaka på namnet "${ref.name}". Uppdatera UUID-tabellen.`);
    }
    for (const packId of CONFIG.DODE.contentPacks[packKey] ?? []) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      const docs = await pack.getDocuments();
      const hit = docs.find((d) => d.name === ref.name);
      if (hit) return hit;
    }
    return null;
  };

  // Stabila referenser. Namnet står med enbart för läsbarhet/fallback.
  const REF = {
    raser: {
      dvarg: { name: "Dvärg", uuid: "Compendium.drakar-och-demoner-expert.raser.Item.24kN2TQ2NgkH753S" },
      alv: { name: "Alv", uuid: "Compendium.drakar-och-demoner-expert.raser.Item.DV7tkdY5DFbslQ4B" },
      manniska: { name: "Människa", uuid: "Compendium.drakar-och-demoner-expert.raser.Item.70wwlDmDqJ7vDBNh" },
      halvlangdsman: { name: "Halvlängdsman", uuid: "Compendium.drakar-och-demoner-expert.raser.Item.g4F6i6vck9nOafyr" },
      anka: { name: "Anka", uuid: "Compendium.drakar-och-demoner-expert.raser.Item.osxxtEzS9uugtho6" }
    },
    yrken: {
      krigare: { name: "Krigare", uuid: "Compendium.drakar-och-demoner-expert.yrken.Item.FqfsY2CF2RbG1mBy" },
      magiker: { name: "Magiker", uuid: "Compendium.drakar-och-demoner-expert.yrken.Item.XkPUZFz1f0e1avVM" },
      tjuv: { name: "Tjuv", uuid: "Compendium.drakar-och-demoner-expert.yrken.Item.5C1N1gJYsQwesfqN" },
      utbygdsjagare: { name: "Utbygdsjägare", uuid: "Compendium.drakar-och-demoner-expert.yrken.Item.WqmtsnTlaj04nMA0" }
    },
    utrustning: {
      bredsvard: { name: "Bredsvärd", uuid: "Compendium.drakar-och-demoner-expert.vapen-utrustning.Item.JO4hXSY5ZwYVJzZk" },
      ringbrynja: { name: "Ringbrynja", uuid: "Compendium.drakar-och-demoner-expert.vapen-utrustning.Item.vXwmf5ag4g8gUSBo" },
      dolk: { name: "Dolk", uuid: "Compendium.drakar-och-demoner-expert.vapen-utrustning.Item.TnTigfxjU5S8HV1d" },
      kortsvard: { name: "Kortsvärd", uuid: "Compendium.drakar-och-demoner-expert.vapen-utrustning.Item.emiDjdMa6lrIXAqR" },
      lader: { name: "Läder", uuid: "Compendium.drakar-och-demoner-expert.vapen-utrustning.Item.baK0VIeXX3YeJYs6" },
      langbage: { name: "Långbåge", uuid: "Compendium.drakar-och-demoner-expert.vapen-utrustning.Item.jGLXZOtbDn34Xqhi" }
    }
  };

  /**
   * Standardsällskapet. Attributvärdena är BASVÄRDEN — rasmodifikationer läggs
   * på av systemet, så t.ex. Grimnes STY 11 blir 14 med Dvärgens +3 och klarar
   * därmed Krigarens STY 14-krav. Ändra inte basvärdena utan att kontrollera
   * yrkeskraven på nytt (packs/yrken/_source/*.json → system.requirements).
   */
  const PARTY = [
    {
      name: "Grimne Stenhammar", kon: "man", niva: "vanlig",
      race: REF.raser.dvarg, profession: REF.yrken.krigare, age: "Mogen",
      attributes: { sty: 11, sto: 12, fys: 12, smi: 10, int: 10, psy: 10, kar: 12 },
      equipment: [REF.utrustning.bredsvard, REF.utrustning.ringbrynja],
      note: "Närstridare. Rasbonus + utrustning med ABS — grundfallet för strids- och tokenmoduler."
    },
    {
      name: "Sylvie Månskir", kon: "kvinna", niva: "slumpens-hjalte",
      race: REF.raser.alv, profession: REF.yrken.magiker, age: "Ung",
      attributes: { sty: 10, sto: 9, fys: 10, smi: 11, int: 9, psy: 14, kar: 10 },
      equipment: [REF.utrustning.dolk],
      note: "Magiker. Hög PSY, testar PSY-baren (bar2) och besvärjelseflöden."
    },
    {
      name: "Rask Fingerfärdig", kon: "man", niva: "vanlig",
      race: REF.raser.manniska, profession: REF.yrken.tjuv, age: "Mogen",
      attributes: { sty: 10, sto: 10, fys: 11, smi: 16, int: 12, psy: 10, kar: 11 },
      equipment: [REF.utrustning.kortsvard, REF.utrustning.lader],
      note: "Människa = inga rasmodifikationer. Isolerar buggar som annars göms av rasbonusar."
    },
    {
      name: "Bramla Rotfast", kon: "kvinna", niva: "sann-hjalte",
      race: REF.raser.halvlangdsman, profession: REF.yrken.utbygdsjagare, age: "Medelålders",
      attributes: { sty: 12, sto: 8, fys: 10, smi: 10, int: 11, psy: 11, kar: 10 },
      equipment: [REF.utrustning.langbage],
      note: "Negativ rasmod (STY −4) + högre nivå (fler förmågeslots/BP). Testar ytterkanterna."
    }
  ];

  /** Kantfall — medvetet udda aktörer, inte ett spelbart sällskap. */
  const EDGE_CASES = [
    {
      name: "EDGE Tom rollperson", kon: "man", niva: "vanlig",
      race: null, profession: null, age: "Mogen",
      attributes: { sty: 10, sto: 10, fys: 10, smi: 10, int: 10, psy: 10, kar: 10 },
      equipment: [],
      note: "Varken ras eller yrke. Arket ska rendera med tomma släppzoner, inga AE:er, inga yrkesfärdigheter."
    },
    {
      name: "EDGE Gudafödd Gammal", kon: "man", niva: "gudafodd",
      race: REF.raser.dvarg, profession: REF.yrken.krigare, age: "Gammal",
      attributes: { sty: 14, sto: 12, fys: 14, smi: 12, int: 10, psy: 10, kar: 12 },
      equipment: [],
      note: "Högsta nivån (flest förmågeslots/BP/EP) mot sämsta ålderskategorin (STY−3, FYS−2, SMI−2, PSY+2). Två motverkande ytterligheter samtidigt."
    },
    {
      name: "EDGE Anka lågt KAR", kon: "man", niva: "vanlig",
      race: REF.raser.anka, profession: null, age: "Mogen",
      attributes: { sty: 10, sto: 6, fys: 10, smi: 10, int: 10, psy: 10, kar: 4 },
      equipment: [],
      note: "Anka har KAR −5 → totalt −1. Testar att attributeToGroup och arket klarar ett NEGATIVT attributvärde."
    }
  ];

  /** Skapar EN fixtur via guidens riktiga skaparväg. */
  async function createViaWizard(spec) {
    // ⚠ Guiden har ett FAST `id` i DEFAULT_OPTIONS, så Foundry tillåter bara en
    // instans åt gången. Att öppna nästa medan föregående fortfarande stänger
    // (stängningen är async/animerad) gör att den nya aldrig registreras — det
    // gav sporadiska "kunde inte öppna"-fel varannan fixtur. Vänta därför ut
    // stängningen först, och polla sedan efter den nya instansen istället för
    // att gissa en fördröjning.
    const findWizard = () => [...foundry.applications.instances.values()]
      .find((x) => x.constructor.name === "DoDECharacterWizard");

    for (const stale of [findWizard()].filter(Boolean)) await stale.close();
    for (let i = 0; i < 40 && findWizard(); i++) await new Promise((r) => setTimeout(r, 100));

    game.dode.openCharacterWizard();
    let w = null;
    for (let i = 0; i < 40; i++) {
      w = findWizard();
      if (w?.element) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!w) throw new Error("Kunde inte öppna rollpersonsskaparen.");

    const raceDoc = spec.race ? await resolve("races", spec.race) : null;
    const professionDoc = spec.profession ? await resolve("professions", spec.profession) : null;
    if (spec.race && !raceDoc) throw new Error(`Hittade inte rasen "${spec.race.name}"`);
    if (spec.profession && !professionDoc) throw new Error(`Hittade inte yrket "${spec.profession.name}"`);

    w.state.name = spec.name;
    w.state.kon = spec.kon;
    w.state.niva = spec.niva;
    w.state.ageCategory = spec.age;
    w.state.raceUuid = raceDoc?.uuid ?? null;
    w.state.professionUuid = professionDoc?.uuid ?? null;
    for (const [k, v] of Object.entries(spec.attributes)) w.state.attributes[k] = v;
    // Socialt stånd/startkapital: fasta värden istället för tärningsslag, så att
    // fixturerna blir reproducerbara mellan körningar.
    w.state.socialStanding = { roll: 7, bpSpent: 0 };
    w.state.startCapital = { roll: 7, bpSpent: 0 };

    for (const ref of spec.equipment ?? []) {
      const doc = await resolve("startingEquipment", ref);
      if (doc) w.state.equipment[doc.uuid] = 1;
      else console.warn(`DoDETestParty: hittade inte utrustningen "${ref.name}"`);
    }

    w.stepIndex = w.steps.indexOf("granska");
    await w.render();
    w.element.querySelector('[data-action="createCharacter"]').click();

    // Vänta in att aktören dyker upp (skaparvägen är async och stänger guiden).
    for (let i = 0; i < 40; i++) {
      const actor = game.actors.getName(spec.name);
      if (actor) {
        await actor.setFlag(game.system.id, FIXTURE_FLAG, true);
        return actor;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`Aktören "${spec.name}" skapades aldrig.`);
  }

  async function seed({ includeEdgeCases = true } = {}) {
    const specs = includeEdgeCases ? [...PARTY, ...EDGE_CASES] : [...PARTY];
    const created = [];
    const skipped = [];
    for (const spec of specs) {
      if (game.actors.getName(spec.name)) { skipped.push(spec.name); continue; }
      try {
        await createViaWizard(spec);
        created.push(spec.name);
      } catch (err) {
        console.error(`DoDETestParty: ${spec.name} misslyckades —`, err);
      }
    }
    console.log("DoDETestParty.seed:", { created, skipped });
    ui.notifications.info(`Testfixturer: ${created.length} skapade, ${skipped.length} fanns redan.`);
    return { created, skipped };
  }

  async function teardown() {
    const doomed = game.actors.filter((a) => a.getFlag(game.system.id, FIXTURE_FLAG));
    const names = doomed.map((a) => a.name);
    for (const a of doomed) await a.delete();
    console.log("DoDETestParty.teardown: raderade", names);
    ui.notifications.info(`Testfixturer: ${names.length} borttagna.`);
    return names;
  }

  function report() {
    const rows = game.actors
      .filter((a) => a.getFlag(game.system.id, FIXTURE_FLAG))
      .map((a) => ({
        namn: a.name,
        ras: a.items.find((i) => i.type === "ras")?.name ?? "—",
        yrke: a.items.find((i) => i.type === "yrke")?.name ?? "—",
        alder: a.system.alder || "—",
        niva: a.system.niva,
        STY: a.system.attributes.sty.total,
        KAR: a.system.attributes.kar.total,
        KP: a.system.hp.max,
        PSY: a.system.resources.psy.max,
        fardigheter: a.items.filter((i) => i.type === "fardighet").length,
        utrustning: a.items.filter((i) => ["vapen", "rustning"].includes(i.type)).length,
        actorLink: a.prototypeToken.actorLink
      }));
    console.table(rows);
    return rows;
  }

  return { seed, teardown, report, PARTY, EDGE_CASES, FIXTURE_FLAG };
})();

globalThis.DoDETestParty = DoDETestParty;
console.log("DoDETestParty laddad — kör DoDETestParty.seed()");
