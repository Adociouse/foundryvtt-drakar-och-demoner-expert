import { DODE } from "../helpers/config.mjs";
import DoDeActiveEffect from "../documents/dode-active-effect.mjs";

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
      // BP-ledger — RP s.27-30/KH s.3. Spenderas på ras (RASER.md bpCost), särskilda
      // förmågor, socialt stånd och startkapital (RP s.27-28). Grundegenskaper är
      // INTE en BP-kategori — de slås fram med 3T6 (RP s.9), inte köps — se
      // PLAN_WIZARD_V2.md Fas 2 för resonemanget. Färdigheter spenderas av EP
      // (separat pool, PLAN_WIZARD_V2.md Fas 5), inte BP direkt, men "kvarvarande
      // BP × 5" konverteras till bonus-EP (RP s.28) — spentFardigheter finns här
      // ändå ifall en framtida BP-för-färdigheter-väg behövs.
      bp: new fields.SchemaField({
        spentRas: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spentFormagor: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spentSocialt: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spentKapital: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spentFardigheter: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 })
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
        spent: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 })
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
          description: new fields.HTMLField({ required: false, initial: "" })
        })
      ),
      hp: new fields.SchemaField({
        value: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
        max: new fields.NumberField({ required: true, integer: true, initial: 0 })
      }),
      resources: new fields.SchemaField({
        psy: new fields.SchemaField({
          value: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
          max: new fields.NumberField({ required: true, integer: true, initial: 0 })
        })
      }),
      // Livsmål — CHARACTERMANCER-WORKFLOW.md, källa "Expert Regler" (21 poster,
      // se DODE.lifeGoals i config.mjs). Ett av de 21 ELLER fritext — bara en
      // sträng, ingen strukturell skillnad mellan de två (fritext skriver bara
      // över listvalet). `destinyNote` (HH Öde-typer) hör till Fas 10, inte hit.
      lifeGoal: new fields.StringField({ required: false, initial: "" }),
      biography: new fields.HTMLField({ required: false, initial: "" })
    };
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
    bp.start = DODE.bpByNiva[this.niva] ?? DODE.bpByNiva.vanlig;
    bp.spent = bp.spentRas + bp.spentFormagor + bp.spentSocialt + bp.spentKapital + bp.spentFardigheter;
    bp.remaining = bp.start - bp.spent;

    // EP-budget — RP s.28/KH s.3: nivå×ålder-tabell + kvarvarande BP × 5
    // ("Kvarvarande BP × 5", RP s.28). maxStartFv (KH s.3) är en ren
    // tabellslagning, ingen persisterad ingång.
    const ep = this.ep;
    const epBudget = DODE.epBudgetTable[this.niva]?.[this.alder] ?? 0;
    ep.max = epBudget + Math.max(0, bp.remaining) * 5;
    ep.remaining = ep.max - ep.spent;
    this.maxStartFv = DODE.maxStartFvTable[this.niva]?.[this.alder] ?? null;

    // KP = (STO + FYS) / 2, avrundat till närmaste heltal — REGLER_EGENSKAPER.md / REGLER_STRID.md
    this.hp.max = Math.round((a.sto.total + a.fys.total) / 2);
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
    this.resources.psy.value = this.resources.psy.value === null || this.resources.psy.value === undefined
      ? this.resources.psy.max
      : Math.min(this.resources.psy.value, this.resources.psy.max);

    // ABS = högsta Abs bland ägda rustningar i kroppsplatsen. Rustning staplar inte
    // (REGLER_STRID.md: "Abs gäller för HELA kroppen i grundsystemet") — därför max, inte summa.
    const bodyArmor = this.parent?.items?.filter((i) => i.type === "rustning" && i.system.slot === "kropp") ?? [];
    this.abs = bodyArmor.reduce((max, i) => Math.max(max, i.system.abs ?? 0), 0);
  }
}
