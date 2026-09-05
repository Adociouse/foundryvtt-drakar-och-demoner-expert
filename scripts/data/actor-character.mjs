import { DODE } from "../helpers/config.mjs";
import DoDeActiveEffect from "../documents/dode-active-effect.mjs";
import { resistancesField } from "./fields-resistances.mjs";
import { SCHEMA_VERSION, migrateCharacterNiva } from "../helpers/schema-migrations.mjs";

const fields = foundry.data.fields;

/**
 * Rollperson — grunddata. Källa: REGLER_EGENSKAPER.md (Roll20-projektet).
 * Ras och yrke är ägda Item-dokument (typ "ras"/"yrke") — högst en av vardera används
 * (se actor-character-sheet.mjs #onDropItem för byt-ut-vid-släpp-logiken).
 */
export default class DoDECharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const attribute = () => new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, initial: 10, min: 0 }),
      bonus: new fields.NumberField({ required: true, integer: true, initial: 0 })
    });

    return {
      // Schema-versionsstämpel — se scripts/helpers/schema-migrations.mjs för
      // hela migrationsramverket, SCHEMA_LOG och varför den här mekanismen är
      // native Foundry (TypeDataModel#migrateData) och inte egenbyggd.
      schemaVersion: new fields.NumberField({ required: false, integer: true, initial: SCHEMA_VERSION }),
      attributes: new fields.SchemaField({
        sty: attribute(),
        sto: attribute(),
        fys: attribute(),
        smi: attribute(),
        int: attribute(),
        psy: attribute(),
        kar: attribute()
      }),
      // Kön — väljs som guidens första steg. Styr vilken av item-ras/item-yrkes
      // imgMan/imgKvinna-varianter som visas/ärvs vid rasval/yrkesval i guiden
      // (character-wizard.mjs). Inte kopplat till någon regelmekanik i sig.
      kon: new fields.StringField({
        required: true,
        initial: "man",
        choices: ["man", "kvinna"]
      }),
      // Rollpersonsnivå — HH s.37-39 (fyra nivåer), se helpers/config.mjs
      // DODE.bpByNiva för BP-poolen. Ödestypen (Slumpens hjälte/Sann hjälte/
      // Gudafödd) ÄR nivåvalet här — ingen separat mekanisk öde-axel, se
      // PLAN_WIZARD_V2.md.
      niva: new fields.StringField({
        required: true,
        initial: "vanlig",
        choices: ["vanlig", "slumpens-hjalte", "sann-hjalte", "gudafodd"]
      }),
      // BP-ledger — RP s.27-30/KH s.3. Spenderas på grundegenskaper (RP s.23,
      // se nedan), ras (RASER.md bpCost), svärdshand (RP s.27), särskilda
      // förmågor, socialt stånd och startkapital (RP s.27-28). Färdigheter
      // spenderas av EP (separat pool, PLAN_WIZARD_V2.md Fas 5), inte BP direkt,
      // men "kvarvarande BP × 5" konverteras till bonus-EP (RP s.28) —
      // spentFardigheter finns här ändå ifall en framtida BP-för-färdigheter-väg
      // behövs.
      //
      // ⚠ RÄTTELSE 2026-08-02: den här kommentaren påstod tidigare att
      // "Grundegenskaper är INTE en BP-kategori — de slås fram med 3T6 (RP s.9),
      // inte köps". Det var fel — RP s.23 ("GRUNDEGENSKAPER") är ett uttalat
      // köpsystem med en egen BP-kostnadstabell, inte ett slagsystem. `spentAttribut`
      // härifrån var alltså inte "förberett för framtiden", det var en täckt lucka.
      // Se DESIGN_DECISIONS.md backlog för hela utredningen (Johans fynd 2026-08-02).
      bp: new fields.SchemaField({
        spentRas: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spentFormagor: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spentSocialt: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spentKapital: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spentFardigheter: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spentAttribut: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        // RP s.27: svärdshandens slag kan modifieras med spenderad BP, precis som
        // socialt stånd/startkapital på samma sida — bara den delen missades tills
        // Johan hittade att fältet aldrig bands till formuläret (2026-08-02).
        spentSvardshand: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        // Hjältedåd (HH s.6-7) — bara hjälte-nivåerna. Slaget en gång vid
        // skapandet (character-wizard.mjs #onRollHjaltedad), rullat in i
        // `bp.start` i prepareDerivedData nedan, precis som en extra BP-pool
        // ovanpå bpByNiva-basen.
        bonusHjaltedad: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 })
      }),
      // Socialt stånd — RP s.27: 2T6 + spenderade BP. `total`/`rank` är härledda
      // (prepareDerivedData), inte satta direkt — `roll`/`bpSpent` är källan.
      socialStanding: new fields.SchemaField({
        roll: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        bpSpent: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        total: new fields.NumberField({ required: false, integer: true, initial: 0 }),
        rank: new fields.StringField({ required: false, initial: "" })
      }),
      // Startkapital — RP s.27-28: 2T6 + BP + halva socialt-stånd-BP:et, takat vid
      // (socialStanding.total + 10). `finalSm` (efter åldersmultiplikator) sätts i
      // en senare fas (PLAN_WIZARD_V2.md Fas 4) — orört av denna fas.
      startCapital: new fields.SchemaField({
        roll: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        bpSpent: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        total: new fields.NumberField({ required: false, integer: true, initial: 0 }),
        baseSm: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        finalSm: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 })
      }),
      // Börs — de mynt rollpersonen FAKTISKT bär, till skillnad från
      // `startCapital` ovan som bara är skapandeögonblickets siffra och aldrig
      // minskar. Utan det här fältet fanns inget att dra pengar ifrån vid ett
      // köp (upptäckt 2026-07-28 när handlararket byggdes). Guiden såddar
      // `sm` med kapitalet som blev över i utrustningssteget.
      currency: new fields.SchemaField({
        gm: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        sm: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        km: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 })
      }),
      // EP-pool för färdighetsköp vid rollpersonsskapande — RP s.28/KH s.3.
      // `spent` är den enda verkliga inmatningen (skrivs av Fas 6/7:s
      // färdighetsköp, inte av något ännu); `max`/`remaining` är helt härledda
      // (nivå×ålder-tabell + kvarvarande BP×5) och sätts i prepareDerivedData,
      // samma mönster som `bp.start`/`spent`/`remaining` ovan.
      ep: new fields.SchemaField({
        spent: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        // SL:s bonuspoäng efter äventyr — REG s.45-46: 1-4 för uppdragsframgång,
        // 1-2 för svåra gärningar, 1-4 för god rollspelning, max 10 per äventyr.
        // ⚠ Dessa är INTE bundna till någon färdighet ("kan användas fritt") och
        // därför den enda EP-potten som ligger på rollpersonen. Färdigheternas
        // egna potter bor på respektive Item (item-fardighet.mjs `system.ep`).
        //
        // ⚠ Skild från `spent` ovan med flit: `max` är HÄRLEDD ur nivå + ålder +
        // kvarvarande BP och räknas om vid varje prepareDerivedData. Låg intjänad
        // EP i samma pott skulle en åldersändring i efterhand radera spelad
        // erfarenhet. Skapandebudget och spelintjänad EP är alltså två skilda
        // ekonomier som råkar dela namn.
        bonus: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        bonusSpent: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 })
      }),
      // Viloperiodsgrinden — REG s.45-46 / MAG s.23: EP kan inte omsättas förrän
      // efter minst 7 dagars sammanhängande vila, och aldrig under ett pågående
      // äventyr. SL öppnar grinden; träningsfönstret är stängt tills dess.
      // Per rollperson, inte per värld — vila är individuell (en spelare kan
      // ligga skadad i en stad medan resten fortsätter).
      rest: new fields.SchemaField({
        // ⚠ SVIT, inte tidsstampel — RP s.63 kraver en SAMMANHANGANDE viloperiod
        // om minst 7 dygn. Resa och aventyr nollstaller den; se helpers/time.mjs.
        streakDays: new fields.NumberField({ required: false, initial: 0, min: 0 }),
        trainingUnlocked: new fields.BooleanField({ required: false, initial: false })
      }),
      // Kroppsbyggnad — styr träffområdestabellen (RP s.48-50). ⚠ Dolt värde:
      // spelarna ska inte behöva veta att en varelse är bevingad för att systemet
      // ska slå rätt träffområde. Default humanoid, vilket täcker de flesta.
      bodyPlan: new fields.StringField({
        required: false, initial: "humanoid",
        choices: ["humanoid", "fyrfota", "bevingad-humanoid", "kentaur", "svanmo"]
      }),
      // Träffområdenas KP — ⚠ TOMT tills någon riktar ett anfall mot varelsen.
      // KP per område HÄRLEDS ur Totala KP (DODE.hitLocationKp), så ingenting
      // behöver förberedas: en varelse som hittills varit en påse KP får en
      // kropp i samma ögonblick som någon siktar på den. Det är mekaniken som
      // gör det möjligt att blanda vanlig och detaljerad strid utan bokföring.
      hitLocations: new fields.ObjectField({ required: false, initial: () => ({}) }),
      // Svärdshand — RP s.27. Slås med 2T6 + spenderade BP vid skapandet.
      // ⚠ Styr sköldhandens −10 CL (SLB s.17): dubbelhänt och ambidextriös har
      // ingen sämre hand alls. Se DODE.swordHandTable.
      swordHand: new fields.StringField({
        required: false, initial: "hoger",
        choices: ["hoger", "vanster", "dubbelhant", "ambidextrios"]
      }),
      alder: new fields.StringField({ required: false, initial: "" }),
      // Särskilda förmågor — MVP, PLAN_WIZARD_V2.md Fas 8. ⚠ FORSKNINGSLUCKA:
      // ingen komplett källtabell för VILKA förmågor som finns/vad de gör är
      // extraherad (RP+REG, ospecificerat sidintervall). Antalet slots
      // (DODE.abilityRollsByNiva, KH s.3) är känt och styr guidens
      // "formagor"-steg — men VAD spelaren skriver i varje slot är fritext,
      // inte en tabellslagning. `source` är fri text ("bas"/"ras"/"yrke"/
      // "hjalte" är förslag, inte enforcade choices) för framtida
      // filtrering/gruppering den dag en riktig tabell finns.
      specialAbilities: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: true, initial: "" }),
          source: new fields.StringField({ required: false, initial: "" }),
          description: new fields.HTMLField({ required: false, initial: "" }),
          // Stabil sloteidentitet — backlogpost 7/36. INTE samma sak som
          // array-index: den här arrayen kan krympa (nivåsänkning, borttagen
          // rad på arket) vilket förskjuter index men aldrig slotId. Används
          // för att tagga det `formaga`-item (om något) som representerar
          // radens mekaniska effekt, se special-ability-effects.mjs.
          slotId: new fields.StringField({ required: false, initial: "" })
        })
      ),
      hp: new fields.SchemaField({
        value: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
        max: new fields.NumberField({ required: true, integer: true, initial: 0 })
      }),
      // Hjältepoäng (HH s.6-7 källan, s.20/46-48 användningen) — ⚠ RÄTTAT
      // 2026-08-02 (Johan): fältet hette tidigare `hp.bonusHjaltedad` och
      // lades felaktigt in i `hp.max` (kroppspoäng, spelets egen förkortning
      // KP). Hjältedådstabellens andra kolumn ("HP" i boken) är HJÄLTEPOÄNG,
      // inte kroppspoäng — en helt egen valuta, spenderas post-creation på
      // ett 1T20-slag mot en separat 18-radig hjälteförmågetabell (HH s.20/
      // 46-48). Den tabellen och en spenderingsvy är INTE byggda än (se
      // DESIGN_DECISIONS.md backlog) — det här fältet är bara en ackumulerad
      // pool tills vidare, satt vid #onRollHjaltedad (character-wizard.mjs)
      // och oförändrad annars.
      hjaltepoang: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
      resources: new fields.SchemaField({
        psy: new fields.SchemaField({
          value: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
          max: new fields.NumberField({ required: true, integer: true, initial: 0 })
        })
      }),
      // Motstånd/immunitet mot skadetyp (eld/kyla/syra m.fl.) — se fields-resistances.mjs.
      resistances: resistancesField(),
      // Livsmål — CHARACTERMANCER-WORKFLOW.md, källa "Expert Regler" (21 poster,
      // se DODE.lifeGoals i config.mjs). Ett av de 21 ELLER fritext — bara en
      // sträng, ingen strukturell skillnad mellan de två (fritext skriver bara
      // över listvalet). `destinyNote` (HH Öde-typer) hör till Fas 10, inte hit.
      lifeGoal: new fields.StringField({ required: false, initial: "" }),
      biography: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  /**
   * Se scripts/helpers/schema-migrations.mjs SCHEMA_LOG för vad som faktiskt
   * migreras och varför — den gamla 3-nivå `niva`-skalan (v1) är den enda
   * grenen just nu. Anropas AUTOMATISKT av Foundry (världsuppstart och
   * Document#importFromJSON), aldrig manuellt.
   */
  static migrateData(source) {
    migrateCharacterNiva(source);
    source.schemaVersion = SCHEMA_VERSION;
    return super.migrateData(source);
  }

  prepareBaseData() {
    for (const key of Object.keys(DODE.attributes)) {
      this.attributes[key].bonus = 0;
    }
  }

  prepareDerivedData() {
    const a = this.attributes;

    // Börsens totalvärde — härlett, aldrig lagrat. Räknas i kopparmynt som atom
    // (se DODE.purseToKm) så att jämförelser mot ett pris alltid är exakta.
    this.currency.totalKm = DODE.purseToKm(this.currency);
    this.currency.totalSm = Math.round(this.currency.totalKm) / 10;
    this.currency.label = DODE.formatPurse(this.currency);

    const rasItem = this.parent?.items?.find((i) => i.type === "ras") ?? null;

    // ActiveEffects (race transfer AEs + age AEs) target system.attributes.*.bonus
    // and are applied before prepareDerivedData runs. If the AE pipeline populated
    // bonus, use it directly. If not (legacy characters whose ras item lacks transfer
    // AEs, or no age AE exists), fall back to the manual computation so existing
    // character data isn't broken.
    // Race AEs are transfer:true effects owned by the embedded ras Item — Foundry only
    // surfaces those via Actor#appliedEffects, never via Actor#effects (that collection
    // is actor-owned effects only). Age AEs ARE actor-owned (created directly on the
    // actor, transfer:false), so `effects` is correct for those.
    const hasRaceAE = this.parent?.appliedEffects?.some(
      (e) => e.getFlag?.(game.system.id, "source") === "race"
    ) ?? false;
    const hasAgeAE = this.parent?.effects?.some(
      (e) => e.getFlag?.(game.system.id, "source") === "age"
    ) ?? false;

    if (!hasRaceAE && rasItem) {
      const mods = rasItem.system?.attributeMods ?? {};
      for (const key of Object.keys(DODE.attributes)) {
        if (key === "sto") continue;
        a[key].bonus += mods[key] ?? 0;
      }
    }
    if (!hasAgeAE && this.alder) {
      const ageMods = DODE.ageAttributeModifiers[this.alder] ?? {};
      for (const key of Object.keys(DODE.attributes)) {
        a[key].bonus += ageMods[key] ?? 0;
      }
    }

    // Per-attribut källuppdelning av bonusen, till Mod-tooltipen i character-sheet.hbs
    // (t.ex. "Rasmodifikationer (Dvärg): +3\nVäktarklingans välsignelse: +2"). Läser
    // samma AE-lista som Foundry redan applicerat bonusen från, filtrerad genom
    // DoDeActiveEffect.isGateOpen — annars listar tooltipen källor som (t.ex. p.g.a.
    // ej utrustat vapen) faktiskt inte bidrog till talet som visas.
    const bonusSourcesByKey = {};
    for (const key of Object.keys(DODE.attributes)) bonusSourcesByKey[key] = [];
    for (const effect of this.parent?.appliedEffects ?? []) {
      if (!DoDeActiveEffect.isGateOpen(effect)) continue;
      for (const change of effect.changes ?? []) {
        const match = /^system\.attributes\.(\w+)\.bonus$/.exec(change.key);
        if (!match || !(match[1] in bonusSourcesByKey)) continue;
        const value = Number(change.value) || 0;
        if (!value) continue;
        bonusSourcesByKey[match[1]].push({ label: effect.name || "?", value });
      }
    }

    for (const key of Object.keys(DODE.attributes)) {
      a[key].total = a[key].value + a[key].bonus;
      a[key].group = DODE.attributeToGroup(a[key].total);
      a[key].bonusDisplay = a[key].bonus > 0 ? `+${a[key].bonus}` : `${a[key].bonus}`;

      const sources = bonusSourcesByKey[key];
      // Fallback-vägen (rad ~146-158 ovan) skapar ingen AE, så lägg till en syntetisk
      // källrad manuellt när den vägen användes — annars saknar äldre rollpersoner
      // (utan ras-/ålders-AE) en förklaring för bonusen tooltipen ändå visar.
      if (!hasRaceAE && rasItem) {
        const v = rasItem.system?.attributeMods?.[key] ?? 0;
        if (v) sources.push({ label: `Ras (${rasItem.name})`, value: v });
      }
      if (!hasAgeAE && this.alder) {
        const v = DODE.ageAttributeModifiers[this.alder]?.[key] ?? 0;
        if (v) sources.push({ label: `Ålder (${this.alder})`, value: v });
      }
      a[key].bonusSources = sources;
      a[key].bonusTooltip = sources
        .map((s) => `${s.label}: ${s.value > 0 ? "+" : ""}${s.value}`)
        .join("\n");
    }

    this.race = rasItem;
    this.profession = this.parent?.items?.find((i) => i.type === "yrke") ?? null;

    // Socialt stånd — RP s.27.
    const social = this.socialStanding;
    social.total = social.roll > 0 ? social.roll + social.bpSpent : 0;
    social.rank = social.roll > 0 ? DODE.socialStandingRank(social.total) : "";

    // Startkapital — RP s.27-28. Taket ("aldrig mer än 10 högre än socialt stånds
    // slutsumma") gäller själva slutsumman, inte tärningsslaget.
    const capital = this.startCapital;
    if (capital.roll > 0) {
      const cap = social.total + 10;
      capital.total = Math.min(capital.roll + capital.bpSpent + Math.ceil(social.bpSpent / 2), cap);
      capital.baseSm = DODE.startCapitalLookup(capital.total);
      // Åldersmultiplikator — RP s.28. Till skillnad från attributmodifikationerna
      // ovan är denna tabell redan känd/extraherad, ingen forskningslucka.
      const capitalMultiplier = DODE.ageCapitalMultiplier[this.alder] ?? 1;
      capital.finalSm = Math.round(capital.baseSm * capitalMultiplier);
    } else {
      capital.total = 0;
      capital.baseSm = 0;
      capital.finalSm = 0;
    }

    // BP-pool efter nivå (KH s.3) minus det som spenderats — se schemakommentaren
    // ovan för vilka kategorier som faktiskt är BP-finansierade. spentSocialt/
    // spentKapital speglar alltid socialStanding.bpSpent/startCapital.bpSpent —
    // ingen separat skrivväg, för att undvika att de två kan hamna i otakt.
    const bp = this.bp;
    bp.spentSocialt = social.bpSpent;
    bp.spentKapital = capital.bpSpent;
    bp.start = (DODE.bpByNiva[this.niva] ?? DODE.bpByNiva.vanlig) + bp.bonusHjaltedad;
    bp.spent = bp.spentRas + bp.spentFormagor + bp.spentSocialt + bp.spentKapital + bp.spentFardigheter
      + bp.spentAttribut + bp.spentSvardshand;
    bp.remaining = bp.start - bp.spent;

    // EP-budget — RP s.28/KH s.3: nivå×ålder-tabell + kvarvarande BP × 5
    // ("Kvarvarande BP × 5", RP s.28). maxStartFv (KH s.3) är en ren
    // tabellslagning, ingen persisterad ingång.
    const ep = this.ep;
    const epBudget = DODE.epBudgetTable[this.niva]?.[this.alder] ?? 0;
    ep.max = epBudget + Math.max(0, bp.remaining) * 5;
    ep.remaining = ep.max - ep.spent;
    // Fri pott, spelintjänad — helt skild från skapandebudgeten ovan.
    ep.bonusAvailable = Math.max(0, ep.bonus - ep.bonusSpent);
    this.maxStartFv = DODE.maxStartFvTable[this.niva]?.[this.alder] ?? null;

    // KP = (STO + FYS) / 2, avrundat till närmaste heltal — REGLER_EGENSKAPER.md / REGLER_STRID.md
    // ⚠ RÄTTAT 2026-08-02: hjältedåd lägger INTE på KP — se `hjaltepoang`-
    // fältets docblock ovan för varför den tidigare `hp.bonusHjaltedad`-
    // kopplingen var fel.
    this.hp.max = Math.round((a.sto.total + a.fys.total) / 2);
    // Ras-/yrkes-formagor (t.ex. "Extremt smärttålig") — måste ligga FÖRE
    // value-klampen nedan, annars klampas mot det oaugmenterade maxvärdet.
    this.hp.max = this.#applyStatModifiers("hp.max", this.hp.max);
    this.hp.value = this.hp.value === null || this.hp.value === undefined
      ? this.hp.max
      : Math.min(this.hp.value, this.hp.max);

    // Skadebonus från STY + STO — RP s.25 (⚠ verifiera exakta gränsvärden)
    this.damageBonus = DODE.damageBonus(a.sty.total + a.sto.total);

    // Förflyttning — RP s.25: slå upp SUMMAN STO+FYS+SMI i tabellen, plus rasmodifikation.
    // ⚠ Rättad 2026-07-28: koden delade tidigare summan med 3 och slog upp i en tabell
    // som inte fanns i någon bok. Se DESIGN_DECISIONS.md §3 31C.
    const movementSum = a.sto.total + a.fys.total + a.smi.total;
    const raceName = (rasItem?.name ?? "").toLowerCase();
    const movementMod = rasItem?.system?.movementMod ?? DODE.movementRaceMod[raceName] ?? 0;
    this.movement = Math.max(1, DODE.movement(movementSum) + movementMod);

    // Bärförmåga = STY kg utan att bli nämnvärt uttröttad — REGLER_EGENSKAPER.md
    this.carryCapacity = a.sty.total;

    // PSY-resurs: max = PSY-attributets total. Nuvarande PSY förbrukas vid besvärjelsekastning
    // (MAGI.md) — se DoDEActor#castSpell.
    this.resources.psy.max = a.psy.total;
    this.resources.psy.max = this.#applyStatModifiers("psy.max", this.resources.psy.max);
    this.resources.psy.value = this.resources.psy.value === null || this.resources.psy.value === undefined
      ? this.resources.psy.max
      : Math.min(this.resources.psy.value, this.resources.psy.max);

    // ABS = högsta Abs bland ägda rustningar i kroppsplatsen. Rustning staplar inte
    // (REGLER_STRID.md: "Abs gäller för HELA kroppen i grundsystemet") — därför max, inte summa.
    const bodyArmor = this.parent?.items?.filter((i) => i.type === "rustning" && i.system.slot === "kropp") ?? [];
    this.abs = bodyArmor.reduce((max, i) => Math.max(max, i.system.abs ?? 0), 0);
  }

  /**
   * Färdighetsmodifierare — backlogpost 7/36, se doc-kommentaren i
   * item-fardighet.mjs. RIKTIGA getters, INTE fält satta i prepareDerivedData
   * — ett tidsbegränsat föremåls (`activationSeconds`) bonus måste sluta gälla
   * så fort `game.time.worldTime` passerar `activeUntil`, men INGET rör
   * aktören när tiden bara går (till skillnad från ett `actor.update()`).
   * Ett cachat fält från senaste prepareDerivedData-körningen skulle då visa
   * en föråldrad bonus tills något annat råkar trigga en omräkning.
   * ⚠ Upptäckt i livetest 2026-07-31 (Runas Duntofflor): `game.time.advance()`
   * fick inte bort +5-bonusen förrän `actor.prepareData()` tvingades fram för
   * hand — exakt den fällan denna kommentar varnar för. Samma mönster som
   * `ActiveEffect#duration`/`#active` (v14-kärnans egna live-getters, se
   * DESIGN_DECISIONS.md §6 "v14-kärnan slutar tillämpa utgångna
   * ActiveEffects själv") — beräkna vid LÄSNING, inte vid senaste skrivning.
   *
   * `formaga` är alltid aktiv medan den ligger på aktören (item-formaga.mjs).
   * `utrustning`/`vapen`/`rustning` kräver `equipped === true`, och om
   * `activationSeconds` är satt dessutom att `flags.<id>.activeUntil` inte
   * gått ut — se scripts/documents/item.mjs.
   */
  /**
   * Delad aktiv-kontroll för item-burna aktörsbonusar — bröts ut ur
   * #computeSkillModifiers 2026-08-05 när #computeRecoveryModifiers behövde
   * exakt samma logik (formaga alltid aktiv, utrustning/vapen/rustning kräver
   * equipped + ej utgången activationSeconds). Ett enda ställe att hålla i
   * synk i stället för två kopior som kan glida isär.
   */
  #isModifierItemActive(item, worldTime) {
    if (item.type === "formaga") return true;
    if (!["utrustning", "vapen", "rustning"].includes(item.type)) return false;
    if (item.system.equipped !== true) return false;
    const activationSeconds = item.system.activationSeconds;
    if (activationSeconds) {
      const activeUntil = item.getFlag(game.system.id, "activeUntil") ?? 0;
      if (worldTime >= activeUntil) return false;
    }
    return true;
  }

  /**
   * Summerar `formaga`-buren `statModifiers` (item-formaga.mjs) mot ETT
   * härlett fält ("hp.max"/"psy.max") — t.ex. "Extremt smärttålig" (KP×1,5).
   * 2026-08-16, ras-/yrkesramverket (DESIGN_DECISIONS.md backlog 70).
   *
   * ⚠ Medveten förenkling, INTE en live getter à la skillModifierTotals:
   * ras-/yrkes-formagor är alltid aktiva (#isModifierItemActive returnerar
   * `true` ovillkorat för `type:"formaga"`, ingen `activationSeconds`-gate),
   * så ingen world-time-utgångsrisk finns ännu för dagens innehåll — den
   * risken är exakt vad som tvingade skillModifierTotals att bli en getter
   * 2026-07-31 (Runas Duntofflor, ett TIDSBEGRÄNSAT utrustningsföremål).
   * En framtida tidsbegränsad källa (besvärjelse/välsignelse) till
   * statModifiers skulle behöva samma getter-konvertering — hp.max/psy.max
   * är idag vanliga fält, inte getters, och den konverteringen är en större
   * ändring än den här omgången kräver. Flaggat, inte byggt.
   */
  #applyStatModifiers(stat, base) {
    const worldTime = game.time?.worldTime ?? 0;
    let add = 0;
    let multiply = 1;
    for (const item of this.parent?.items ?? []) {
      const mods = item.system?.statModifiers;
      if (!mods?.length) continue;
      if (!this.#isModifierItemActive(item, worldTime)) continue;
      for (const mod of mods) {
        if (mod.stat !== stat) continue;
        if (mod.operation === "multiply") multiply *= mod.value;
        else add += mod.value;
      }
    }
    return Math.round((base + add) * multiply);
  }

  #computeSkillModifiers() {
    const worldTime = game.time?.worldTime ?? 0;
    const totals = {};
    const sources = {};
    for (const item of this.parent?.items ?? []) {
      const mods = item.system?.skillModifiers;
      if (!mods?.length) continue;
      if (!this.#isModifierItemActive(item, worldTime)) continue;
      for (const mod of mods) {
        if (!mod.skillKey || !mod.value) continue;
        totals[mod.skillKey] = (totals[mod.skillKey] ?? 0) + mod.value;
        (sources[mod.skillKey] ??= []).push({ label: item.name, value: mod.value });
        // ⚠ Särfall: "tva-vapen" är den GENERISKA nyckeln en formaga-effekt
        // (t.ex. "God koordinationsförmåga", HH-tabellen i config.mjs) pekar
        // på, men RP s.59 gör varje tränad vapenkombination till en EGEN
        // färdighet med sin egen skillKey (item-fardighet.mjs `twoWeaponCombo`)
        // — inte en enda delad "tva-vapen"-post. Utan detta hade en sådan
        // förmåga bara matchat en färdighet som råkar heta exakt "tva-vapen",
        // vilket ingen riktig Två vapen-kombination någonsin gör. Sprid
        // bonusen till VARJE kombinationsfärdighet aktören faktiskt har.
        if (mod.skillKey === "tva-vapen") {
          for (const combo of this.parent?.items ?? []) {
            if (combo.type !== "fardighet" || !combo.system.twoWeaponCombo?.primaryWeaponKey) continue;
            const comboKey = combo.system.skillKey;
            if (!comboKey || comboKey === "tva-vapen") continue;
            totals[comboKey] = (totals[comboKey] ?? 0) + mod.value;
            (sources[comboKey] ??= []).push({ label: item.name, value: mod.value });
          }
        }
      }
    }

    // GM-effekter (scen/värld, namngivna färdighetsmodifierare) — se
    // DODE.namedSkillModEffects i config.mjs och
    // docs/dev/GM_EFFEKTFONSTER_ANALYS.md. Attributnivå-scen-effekter ("Dimön
    // PSY×2") går INTE via den här vägen — de är riktiga ActiveEffects satta
    // av game.dode.SceneEffects och flödar redan in via Foundrys egen
    // prepareDerivedData-kedja. Det här täcker bara NAMNGIVNA färdigheter,
    // som aldrig kan vara AE-mål (§6).
    // ⚠ `getActiveTokens(true)` utan `document:true` returnerar RITADE
    // placeable Token-objekt (`.parent` = canvas-lagret), inte token-
    // DOKUMENTET (`.parent` = Scenen) — kraschade `scene?.getFlag is not a
    // function` för VARJE färdighetsslag/arkrendering så fort en riktig
    // token faktiskt stod synlig på den just då visade scenen. Bara upptäckt
    // 2026-08-06 via ett riktigt canvas/token-test, se recoveryModifierTotals
    // ovan och memory.md för samma fynd i den andra av de två platser detta
    // mönster kopierades till.
    const scene = this.parent?.getActiveTokens?.(true, true)?.[0]?.parent ?? game.scenes?.active ?? null;
    const named = CONFIG.DODE.namedSkillModEffects(this.parent, scene);
    for (const [skillKey, sourceList] of Object.entries(named.sources)) {
      for (const src of sourceList) {
        totals[skillKey] = src.operation === "multiply"
          ? (totals[skillKey] ?? 0) * src.value
          : (totals[skillKey] ?? 0) + src.value;
        (sources[skillKey] ??= []).push(src);
      }
    }

    return { totals, sources };
  }

  get skillModifierTotals() {
    return this.#computeSkillModifiers().totals;
  }

  get skillModifierSources() {
    return this.#computeSkillModifiers().sources;
  }

  /**
   * Slår ihop aktörens EGEN, sällan ifyllda `system.resistances` (samma flata
   * fält en NPC har, ärvt av character men i praktiken alltid tomt tills nu)
   * med resistances-poster från ägda `formaga`-items (backlog 88, Kaos
   * Väktares magiska tatueringar — Eldsköld/Kroppssköld). Live getter, aldrig
   * cachad, samma princip som skillModifierTotals — tar en tatuering bort
   * (Item.delete) försvinner dess skydd omedelbart utan extra städkod.
   *
   * Formaga-poster listas FÖRE aktörens egna så en mer specifik, item-buren
   * post vinner vid en `damageType`-kollision (resolveResistance tar första
   * träffen) — i praktiken en icke-fråga idag eftersom ingen karaktär någonsin
   * haft en egen ifylld `system.resistances`-post.
   */
  get effectiveResistances() {
    const fromFormaga = this.parent.items
      .filter((i) => i.type === "formaga")
      .flatMap((i) => i.system.resistances ?? []);
    return [...fromFormaga, ...(this.resistances ?? [])];
  }

  /**
   * HP-/PSY-återhämtningsmodifierare — docs/dev/AATERHAMTNING_ANVANDNINGSFALL.md.
   * Samma tre källor som skillModifiers (item-burna, via #isModifierItemActive)
   * PLUS aktör-/scen-/världs-GM-effekter (`DODE.recoveryModEffects`, config.mjs)
   * — till skillnad från namngivna färdigheter kan en resurs som HP/PSY inte
   * bara nås via item-scan, en besvärjelse måste kunna ge en TIDSBEGRÄNSAD
   * personlig bonus som överlever scenbyten (UC-R11), därav aktör-scope.
   *
   * Multiplikatorer komponeras SEKVENTIELLT (samma ordning de påträffas i),
   * precis som Foundrys egna ActiveEffect-pipeline redan gör för MULTIPLY-läge
   * på ett schemafält — UC-R5:s stapling (2× × 3× = 6×) är alltså inte ett eget
   * beslut här, det är samma komposition kärnan redan använder överallt annars.
   *
   * @returns {{hp: {add:number, multiply:number}, psy: {add:number, multiply:number}}}
   */
  #computeRecoveryModifiers() {
    const worldTime = game.time?.worldTime ?? 0;
    const totals = { hp: { add: 0, multiply: 1 }, psy: { add: 0, multiply: 1 } };
    for (const item of this.parent?.items ?? []) {
      const mods = item.system?.recoveryModifiers;
      if (!mods?.length) continue;
      if (!this.#isModifierItemActive(item, worldTime)) continue;
      for (const mod of mods) {
        const bucket = totals[mod.resource];
        if (!bucket) continue;
        if (mod.operation === "multiply") bucket.multiply *= mod.value;
        else bucket.add += mod.value;
      }
    }

    // GM-effekter (person/scen/värld) — se DODE.recoveryModEffects i config.mjs.
    // ⚠ `getActiveTokens(true)` utan `document:true` returnerar de RITADE
    // placeable Token-objekten (PIXI display objects), vars `.parent` är
    // canvas-lagret de ritas i — INTE token-DOKUMENTET, vars `.parent` är
    // Scenen. Utan andra argumentet `true` kraschade det här på riktiga,
    // canvas-placerade tokens (`scene?.getFlag is not a function`) — ett fel
    // ingen tidigare test hittade eftersom inget tidigare test hade en
    // rollperson med en RIKTIG token på en riktig scen (se memory.md
    // 2026-08-06, Johans krav på canvas-baserade tester).
    const scene = this.parent?.getActiveTokens?.(true, true)?.[0]?.parent ?? game.scenes?.active ?? null;
    const gm = CONFIG.DODE.recoveryModEffects(this.parent, scene);
    for (const resource of ["hp", "psy"]) {
      totals[resource].add += gm[resource].add;
      totals[resource].multiply *= gm[resource].multiply;
    }
    return totals;
  }

  get recoveryModifierTotals() {
    return this.#computeRecoveryModifiers();
  }

  /**
   * Vapengrupper — RP s.60, se DODE.weaponGroups i config.mjs. Om en aktör har
   * FV X i ett vapen har hen automatiskt minst floor(X/2) i alla andra vapen
   * inom samma vapengrupp. En RIKTIG getter (samma skäl som
   * #computeSkillModifiers ovan — måste räknas om vid varje läsning, inte
   * cachas i prepareDerivedData) eftersom den beror på andra fardighet-items
   * `total`+`skillModifierTotals`, som själva kan ändras utan ett
   * `actor.update()` på DENNA beräkning.
   *
   * Bonusen läggs på `total+skillModifierTotals` (inte bara `fv`) så en
   * utrustningsbonus på källfärdigheten räknas med i vad som sprider sig till
   * syskonvapnen — annars hade en magisk vapenbonus bara gällt ETT vapen i
   * stället för att göra bäraren till en bättre allroundare inom gruppen.
   */
  #computeWeaponGroupBonus() {
    const totals = {};
    const sources = {};
    const skillMods = this.skillModifierTotals;
    const weaponSkills = (this.parent?.items ?? []).filter(
      (i) => i.type === "fardighet" && i.system.weaponGroup
    );
    const byGroup = {};
    for (const item of weaponSkills) {
      (byGroup[item.system.weaponGroup] ??= []).push(item);
    }
    for (const group of Object.values(byGroup)) {
      if (group.length < 2) continue;
      let best = null;
      for (const item of group) {
        const effective = item.system.total + (skillMods[item.system.skillKey] ?? 0);
        if (!best || effective > best.effective) best = { item, effective };
      }
      const halfBest = Math.floor(best.effective / 2);
      for (const item of group) {
        if (item === best.item) continue;
        const key = item.system.skillKey;
        const ownEffective = item.system.total + (skillMods[key] ?? 0);
        const bonus = Math.max(0, halfBest - ownEffective);
        if (bonus <= 0) continue;
        totals[key] = (totals[key] ?? 0) + bonus;
        (sources[key] ??= []).push({ label: `Vapengrupp: ${best.item.name} ${best.effective}`, value: bonus });
      }
    }
    return { totals, sources };
  }

  get weaponGroupBonusTotals() {
    return this.#computeWeaponGroupBonus().totals;
  }

  get weaponGroupBonusSources() {
    return this.#computeWeaponGroupBonus().sources;
  }
}
