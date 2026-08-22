const fields = foundry.data.fields;

/**
 * Delat `resistances`-fält: motstånd/immunitet mot en skadetyp — character
 * och npc delar exakt samma form, ingen aktörstyp-specifik variant behövs.
 *
 * Beslut 2026-08-21 (docs/dev/MAGI_STRID_ANVANDNINGSFALL.md, UC-M16/M17/M18):
 * tre skilda bokmönster ryms i EN radform, ingen anledning till tre fält:
 *  - Motståndskraft (flat reduktion): `reduction: 3` — dras av instantEffect-
 *    skadan av matchande damageType innan HP-avdrag, min 0.
 *  - Syraskydd (full immunitet, ingen slump): `reduction:"immun"`,
 *    `overcomeE: null` — effekten blockeras helt.
 *  - Blindskydd (övervinnbar immunitet, INGEN tärning — boken säger uttryck-
 *    ligen "övervinna MED E"): `reduction:"immun"`, `overcomeE: 4` — blockerad
 *    om kastarens effektgrad <= 4. Detta är EN DETERMINISTISK taltröskel,
 *    medvetet skilt från DODE.rollResistance (config.mjs), som är ett äkta
 *    slumpmässigt attribut-vs-SG-slag för en helt annan bokmekanik
 *    (räddningskast mot rädsla/mental påverkan, se item-besvarjelse.mjs
 *    `resistedBy`) — två verkliga mekaniker, inte samma primitiv återanvänd fel.
 *
 * Konsumeras av CONFIG.DODE.resolveResistance (scripts/helpers/config.mjs).
 */
export function resistancesField() {
  return new fields.ArrayField(
    new fields.SchemaField({
      damageType: new fields.StringField({
        required: true,
        initial: "physical",
        choices: ["physical", "fire", "cold", "acid", "lightning", "poison", "mental"]
      }),
      // Antingen ett tal (flat reduktion) eller "immun" — sparat som sträng
      // eftersom fields.NumberField inte kan uttrycka en number|"immun"-union;
      // tolkas av resolveResistance.
      reduction: new fields.StringField({ required: true, initial: "0" }),
      overcomeE: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true, min: 0 })
    })
  );
}
