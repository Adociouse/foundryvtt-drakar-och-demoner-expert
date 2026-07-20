import { DODE } from "../helpers/config.mjs";

const fields = foundry.data.fields;

/**
 * Rollperson — grunddata. Källa: REGLER_EGENSKAPER.md (Roll20-projektet).
 * Ras och yrke är ägda Item-dokument (typ "ras"/"yrke") — högst en av vardera används
 * (se actor-character-sheet.mjs #onDropItem för byt-ut-vid-släpp-logiken).
 */
export default class DoDECharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const attribute = () => new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, initial: 10, min: 0 })
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
      // Rollpersonsnivå — KH s.3, se helpers/config.mjs DODE.bpByNiva för BP-poolen.
      // Styr ännu bara den informativa BP-siffran i guiden — EP-budget/max-FV-koppling
      // och faktisk BP-spendering kommer i senare faser (PLAN_WIZARD_V2.md).
      niva: new fields.StringField({
        required: true,
        initial: "vanlig",
        choices: ["vanlig", "extraordinar", "hjalte"]
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
      alder: new fields.StringField({ required: false, initial: "" }),
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
      biography: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  prepareDerivedData() {
    const a = this.attributes;

    const rasItem = this.parent?.items?.find((i) => i.type === "ras") ?? null;
    const mods = rasItem?.system?.attributeMods ?? {};
    // Åldersmodifikationer — RP s.24-25, forskningslucka (se DODE.ageAttributeModifiers
    // i config.mjs). Tomt tills tabellen extraherats — ageMod blir 0 för alla åldrar.
    const ageMods = DODE.ageAttributeModifiers[this.alder] ?? {};

    // Racial- och åldersmodifierare appliceras på alla attribut UTOM STO, som anges
    // som ett intervall spelaren väljer inom snarare än en additiv modifierare —
    // se item-ras.mjs. `mod` är summan av `raceMod`+`ageMod`, uppdelad för
    // spårbarhet (samma transparensprincip som resten av systemet).
    for (const key of ["sty", "fys", "smi", "int", "psy", "kar"]) {
      a[key].raceMod = mods[key] ?? 0;
      a[key].ageMod = ageMods[key] ?? 0;
      a[key].mod = a[key].raceMod + a[key].ageMod;
      a[key].total = a[key].value + a[key].mod;
      a[key].group = DODE.attributeToGroup(a[key].total);
    }
    a.sto.raceMod = 0;
    a.sto.ageMod = 0;
    a.sto.mod = 0;
    a.sto.total = a.sto.value;
    a.sto.group = DODE.attributeToGroup(a.sto.total);

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

    // KP = (STO + FYS) / 2, avrundat till närmaste heltal — REGLER_EGENSKAPER.md / REGLER_STRID.md
    this.hp.max = Math.round((a.sto.total + a.fys.total) / 2);
    this.hp.value = this.hp.value === null || this.hp.value === undefined
      ? this.hp.max
      : Math.min(this.hp.value, this.hp.max);

    // Skadebonus från STY + STO — RP s.25 (⚠ verifiera exakta gränsvärden)
    this.damageBonus = DODE.damageBonus(a.sty.total + a.sto.total);

    // Förflyttning: (SMI+FYS+STO)/3 avrundat nedåt, sedan tabell — RP s.24-25 (⚠ verifiera)
    const movementSum = Math.floor((a.smi.total + a.fys.total + a.sto.total) / 3);
    this.movement = DODE.movement(movementSum);

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
