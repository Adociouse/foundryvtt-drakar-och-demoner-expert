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
 *
 * ⚠⚠ STÅENDE REGEL (Johan 2026-08-08): "new features break legacy artifacts...
 * value building migration tools less than rebuild items based on requirements
 * if needed." Den här filen är INTE en engångsleverans — guidens `state`-form
 * växer varje gång ett nytt steg läggs till (attributköp, hjältedåd, svärdshand,
 * språk, yrkesfärdighetsval har alla lagts till EFTER att filen ursprungligen
 * skrevs 2026-07-27, och seedningen slutade tyst spegla verkligheten:
 * yrkesfärdigheter blev 0 eftersom `professionSkillPicks` aldrig fylldes i,
 * och modersmålsnamnen blev tomma eftersom `motherTongues` aldrig fylldes i).
 * **När ett wizard-steg ändrar sin `state`-form: uppdatera `createViaWizard`
 * i SAMMA session** — inte en migrationsfunktion för gamla seedade aktörer
 * (de raderas och byggs om av `teardown()`+`seed()`), utan en uppdaterad
 * BYGGFUNKTION som producerar korrekta aktörer enligt de AKTUELLA kraven.
 * Fixturerna är alltid engångsbyggda på nytt, aldrig migrerade.
 */
const DoDETestParty = (() => {
  const FIXTURE_FLAG = "testFixture";
  // Deterministiskt, alltid tillgängligt (alla raser i DODE.raceMotherTongues
  // har minst ett "human"-alternativ) — används som defaultval för varje
  // olåst modersmåls-/språkval så fixturerna blir reproducerbara mellan körningar.
  const DEFAULT_HUMAN_LANGUAGE = "vastjori";

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
      anka: { name: "Anka", uuid: "Compendium.drakar-och-demoner-expert.raser.Item.osxxtEzS9uugtho6" },
      // Alvsläkt-MEDLEM, inte bas-Alv — session 2026-08-08 hittade en riktig
      // bugg (motherTongueRaceKey läste system-fält i stället för flagga) som
      // bara syns på just en medlem, aldrig på bas-Alv. Se docs/DESIGN_DECISIONS.md
      // backlog 64. Fixturen finns för att en framtida regression ska synas HÄR
      // igen, inte bara upptäckas via en ny spelarrapport.
      skogsalv: { name: "Skogsalv", uuid: "Compendium.drakar-och-demoner-expert.raser.Item.dodeAlvSkogsalv1" }
    },
    yrken: {
      krigare: { name: "Krigare", uuid: "Compendium.drakar-och-demoner-expert.yrken.Item.FqfsY2CF2RbG1mBy" },
      magiker: { name: "Magiker", uuid: "Compendium.drakar-och-demoner-expert.yrken.Item.XkPUZFz1f0e1avVM" },
      tjuv: { name: "Tjuv", uuid: "Compendium.drakar-och-demoner-expert.yrken.Item.5C1N1gJYsQwesfqN" },
      utbygdsjagare: { name: "Utbygdsjägare", uuid: "Compendium.drakar-och-demoner-expert.yrken.Item.WqmtsnTlaj04nMA0" },
      // Enda yrket med en dualWieldAlt-plats (KH s.8-9) — behövs för att
      // regressionstesta Ambidextriös-checkboxtexten (backlog 64) och Två
      // vapen-husregeln (CLAUDE.md-avsteget) tillsammans.
      vapenmastare: { name: "Vapenmästare", uuid: "Compendium.drakar-och-demoner-expert.yrken.Item.dodeYkrigvapenma" },
      // Backlog 71/72 (Stridskonster/skillFloors) — Krigarmunk regressionstestar
      // det nya `choicePool:"stridskonst"`-valet OCH Krigarmunkens halva pris
      // (secondarySkillBaseOverrideFor), Stråtrövare det nya "Överleva i
      // skogstrakter"-golvet.
      krigarmunk: { name: "Krigarmunk", uuid: "Compendium.drakar-och-demoner-expert.yrken.Item.dodeYkrigkrigarm" },
      stratrovare: { name: "Stråtrövare", uuid: "Compendium.drakar-och-demoner-expert.yrken.Item.dodeYtjuvstratro" }
    },
    utrustning: {
      bredsvard: { name: "Bredsvärd", uuid: "Compendium.drakar-och-demoner-expert.vapen-utrustning.Item.JO4hXSY5ZwYVJzZk" },
      // ⚠ UUID-drift hittad och fixad 2026-08-08: den platta "Ringbrynja"/"Läder"
      // (helkroppsrustning) finns inte längre — SB s.27:s per-kroppsdels-
      // rustningssystem (backlog 53, 2026-07-29) ersatte dem med separata
      // Harnesk/Armskydd/Benskydd/Huva-poster. `resolve()`s namn-fallback
      // hittade INTE de gamla namnen (varnade tyst i konsolen i stället för
      // att krascha) — exakt den sortens tyst drift den här filens ⚠⚠-regel
      // ovan finns för att fånga. Pekar nu på torsodelen av varje rustningstyp.
      ringbrynja: { name: "Brynja, ringbrynja", uuid: "Compendium.drakar-och-demoner-expert.vapen-utrustning.Item.brynjaringbrynja" },
      dolk: { name: "Dolk", uuid: "Compendium.drakar-och-demoner-expert.vapen-utrustning.Item.TnTigfxjU5S8HV1d" },
      kortsvard: { name: "Kortsvärd", uuid: "Compendium.drakar-och-demoner-expert.vapen-utrustning.Item.emiDjdMa6lrIXAqR" },
      lader: { name: "Harnesk, läder", uuid: "Compendium.drakar-och-demoner-expert.vapen-utrustning.Item.harneskladerxxxx" },
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
    },
    {
      // Se REF.raser.skogsalv ovan för varför den här fixturen finns.
      name: "EDGE Skogsalv modersmål", kon: "kvinna", niva: "vanlig",
      race: REF.raser.skogsalv, profession: null, age: "Mogen",
      attributes: { sty: 10, sto: 13, fys: 10, smi: 14, int: 13, psy: 11, kar: 12 },
      equipment: [],
      note: "Alvsläkt-MEDLEM (inte bas-Alv). Regression för motherTongueRaceKey-buggen (backlog 64) — Tala/Läsa-skriva modersmål ska visa BÅDE Alviska (medfött, fast) OCH ett människospråk (valt), inte bara människospråket."
    },
    {
      name: "EDGE Ambidextriös Vapenmästare", kon: "man", niva: "vanlig",
      race: REF.raser.manniska, profession: REF.yrken.vapenmastare, age: "Mogen",
      attributes: { sty: 14, sto: 12, fys: 12, smi: 15, int: 10, psy: 12, kar: 8 },
      swordHand: "ambidextrios",
      equipment: [],
      note: "Ambidextriös + Vapenmästarens dualWieldAlt-plats (KH s.8-9) samtidigt. Regression för checkboxtexten som felaktigt påstod ett Två vapen-träningskrav (backlog 64) — Ambidextriös slipper det kravet helt (CLAUDE.md-avsteget)."
    },
    {
      name: "EDGE Krigarmunk stridskonst", kon: "man", niva: "vanlig",
      race: REF.raser.manniska, profession: REF.yrken.krigarmunk, age: "Mogen",
      attributes: { sty: 14, sto: 10, fys: 12, smi: 16, int: 11, psy: 15, kar: 10 },
      equipment: [],
      note: "Backlog 71/72. Regression för det nya choicePool:\"stridskonst\"-valet (en riktig, namngiven teknik i stället för den gamla monolitiska \"Stridskonster\"-posten) OCH Krigarmunkens halva pris (secondarySkillBaseOverrideFor) på den valda teknikens grundkostnad."
    },
    {
      name: "EDGE Stråtrövare skogsvana", kon: "kvinna", niva: "vanlig",
      race: REF.raser.manniska, profession: REF.yrken.stratrovare, age: "Mogen",
      attributes: { sty: 10, sto: 10, fys: 10, smi: 16, int: 10, psy: 10, kar: 10 },
      equipment: [],
      note: "Backlog 71. Regression för det nya \"Överleva i skogstrakter\"-golvet (skillFloors, minFv:10) — ska visa FV 10 automatiskt utan EP-kostnad, separat från den generiska \"Överlevnad\"-yrkesfärdigheten."
    }
  ];

  /**
   * Fyller `state.motherTongues.tala`/`lasaSkriva` med DEFAULT_HUMAN_LANGUAGE
   * för varje olåst ("human"/`{choice:...}`) plats, deterministiskt så
   * fixturerna blir reproducerbara. Fasta platser (Alviska, Dvärgiska osv)
   * behöver inget värde i arrayen — #motherTongueResult läser slotens EGEN
   * fasta nyckel för dem — men vi fyller ändå i null för att hålla
   * array-längden korrekt (kosmetiskt, läses aldrig).
   *
   * Speglar sedan 2026-08-07 samma "human"-plats till BÅDA Tala och
   * Läsa/Skriva när DODE.syncedHumanMotherTongueIndices säger att de hör
   * ihop (Människa/Alv/Halvlängdsman/Anka/Halvorch) — annars skulle
   * fixturerna själva bryta mot regeln vi just byggde.
   */
  function fillMotherTongues(w, raceDoc) {
    for (const kind of ["tala", "lasaSkriva"]) {
      const slots = CONFIG.DODE.motherTongueSlots(raceDoc, kind);
      w.state.motherTongues[kind] = slots.map((slot) => {
        const options = CONFIG.DODE.motherTongueSlotOptions(slot);
        if (!options) return null; // fast plats, aldrig läst
        // Föredra DEFAULT_HUMAN_LANGUAGE om den finns i poolen (den gör det
        // för varje "human"/blandad plats), annars första alternativet.
        const preferred = options.find((o) => o.key === DEFAULT_HUMAN_LANGUAGE);
        return (preferred ?? options[0])?.key ?? null;
      });
    }
    const synced = CONFIG.DODE.syncedHumanMotherTongueIndices(raceDoc);
    if (synced) {
      w.state.motherTongues.tala[synced.talaIndex] = DEFAULT_HUMAN_LANGUAGE;
      w.state.motherTongues.lasaSkriva[synced.lasaSkrivaIndex] = DEFAULT_HUMAN_LANGUAGE;
    }
  }

  /**
   * Fyller `state.professionSkillPicks` upp till yrkets riktiga mål
   * (`professionSkillState.target`, RP s.11: 12 vanligt / 9 för magiker) genom
   * att läsa den FAKTISKA, redan renderade guide-kontexten i stället för att
   * gissa reglerna på nytt här — om #professionSkillTarget/#professionSkillState
   * någonsin ändras räcker det att seedningen fortsätter läsa rätt context-fält.
   * Namngivna färdigheter väljs först (enklast, mest representativt); pooler
   * (vapenfärdighet/språk/hantverk) fylls sist med ett rimligt default-värde
   * per pool-typ. `picks`-objektens FORM speglar exakt vad #onToggleProfessionSkill
   * respektive change-lyssnaren för `[data-slot-index]` bygger, så resultatet
   * är oskiljbart från om en spelare klickat/skrivit själv.
   */
  async function fillProfessionSkills(w) {
    const ctx = await w._prepareContext({});
    const skillState = ctx.professionSkillState;
    if (!skillState) return;
    const picks = w.state.professionSkillPicks;

    for (const sk of skillState.named) {
      if (picks.length >= skillState.target) break;
      picks.push({ key: sk.key, name: sk.name, attribute: sk.attribute, slotIndex: null });
    }
    for (const slot of skillState.slots) {
      // ⚠ `slot.rows[row].languageOptions`/`.weaponOptions` är EN statisk
      // ögonblicksbild tagen innan den här loopen börjat fylla i något —
      // rad 0 och rad 1 i SAMMA pool ser alltså identiskt "inget valt än"-
      // läge, trots att en riktig spelare skulle se rad 1 utgråa vad hen
      // redan valt i rad 0 (se #professionSkillState/`usedInSlot`). Utan en
      // egen `localUsed`-mängd skulle två rader i samma pool (t.ex.
      // Vapenmästares "Tala max tre") tyst kunna få SAMMA värde två gånger
      // — ett fel den riktiga guiden aldrig kan producera (den läser om
      // `usedInSlot` vid varje re-render), men som seedningen kunde ha gjort
      // tyst om den bara läste den statiska ögonblicksbilden rakt av.
      const localUsed = new Set();
      for (let row = 0; row < slot.count && picks.length < skillState.target; row++) {
        let value = null;
        if (slot.isLanguagePool) {
          value = (slot.rows[row]?.languageOptions ?? [])
            .find((o) => !o.disabled && !localUsed.has(o.value))?.value ?? null;
        } else if (slot.isWeaponPool) {
          // Riktiga vapen ur den faktiska katalogen (samma <select> spelaren
          // ser, backlog 66) — testar vapengrupp-spillover på köpet, precis
          // som den gamla hårdkodade "Bredsvärd" gjorde, men nu ett ANNAT
          // vapen per rad i stället för samma vapen om poolen har fler än en plats.
          value = (slot.rows[row]?.weaponOptions ?? [])
            .find((o) => !o.disabled && !localUsed.has(o.value))?.value ?? null;
        } else if (slot.isStridskonstPool) {
          // Riktiga tekniker ur DODE.stridskonster (backlog 71/72, samma
          // <select> spelaren ser) — testar att en teknik med egen,
          // katalogsourcad grundkostnad kostnadsberäknas korrekt i stället
          // för den gamla monolitiska "Stridskonster"-platshållaren.
          value = (slot.rows[row]?.stridskonstOptions ?? [])
            .find((o) => !o.disabled && !localUsed.has(o.value))?.value ?? null;
        } else {
          value = `${slot.pool} (testval ${row})`;
        }
        if (!value) continue;
        localUsed.add(value);
        const weaponGroup = CONFIG.DODE.weaponGroupFor(value);
        const stridskonstEntry = CONFIG.DODE.stridskonstFor(value);
        const attribute = weaponGroup?.attribute
          ?? (stridskonstEntry ? CONFIG.DODE.stridskonstAttribute(stridskonstEntry) : null)
          ?? slot.attribute ?? "int";
        picks.push({
          key: stridskonstEntry?.key ?? CONFIG.DODE.skillKey(value), name: value,
          attribute, weaponGroup: weaponGroup?.key ?? "", slotIndex: slot.index
        });
      }
      if (picks.length >= skillState.target) break;
    }
  }

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
    // Svärdshand: lämnas orörd (→ fallback "hoger" vid skapande, se
    // #onCreateCharacter) om inte specen uttryckligen begär en särskild hand
    // (t.ex. "ambidextrios" för att regressionstesta Två vapen-husregeln).
    if (spec.swordHand) w.state.swordHand.granted = spec.swordHand;

    // Modersmål och yrkesfärdighetsval — se docblocken på respektive
    // funktion. Måste ske EFTER att ras/yrke/attribut är satta (behöver
    // #selectedRaceDoc/#selectedProfessionDoc, som bara sätts av
    // _prepareContext) men FÖRE granska-steget.
    await w._prepareContext({}); // sätter #selectedRaceDoc/#selectedProfessionDoc
    fillMotherTongues(w, raceDoc);
    if (professionDoc) await fillProfessionSkills(w);
    // Hjältedåd (hjälte-nivåer) lämnas medvetet OROLLAT här — se
    // docs/TEST_CASES.md UC-1b för varför, och `#onRollHjaltedadCount`/
    // `#onRollHjaltedad` för det riktiga, tärningsbaserade flödet som
    // testas separat, inte via seedningen.

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
      .map((a) => {
        const skills = a.items.filter((i) => i.type === "fardighet");
        const modersmal = skills.find((i) => i.system.skillKey === "tala-modersmal");
        return {
          namn: a.name,
          ras: a.items.find((i) => i.type === "ras")?.name ?? "—",
          yrke: a.items.find((i) => i.type === "yrke")?.name ?? "—",
          alder: a.system.alder || "—",
          niva: a.system.niva,
          svardshand: a.system.swordHand,
          STY: a.system.attributes.sty.total,
          KAR: a.system.attributes.kar.total,
          KP: a.system.hp.max,
          PSY: a.system.resources.psy.max,
          primara: skills.filter((i) => i.system.costTier === "primar").length,
          yrkesfardigheter: skills.filter((i) => i.system.costTier === "yrkesfardighet").length,
          modersmal: modersmal?.name ?? "—",
          utrustning: a.items.filter((i) => ["vapen", "rustning"].includes(i.type)).length,
          actorLink: a.prototypeToken.actorLink
        };
      });
    console.table(rows);
    return rows;
  }

  return { seed, teardown, report, PARTY, EDGE_CASES, FIXTURE_FLAG };
})();

globalThis.DoDETestParty = DoDETestParty;
console.log("DoDETestParty laddad — kör DoDETestParty.seed()");
