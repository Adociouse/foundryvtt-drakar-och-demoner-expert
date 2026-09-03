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
 * **Utökat 2026-09-03 (backlog 84), tre tillägg — Lindskiarnen (MBX2 s.64,
 * "tar bara HALV skada av alla övriga besvärjelser") och en bred genomläsning
 * av redan transkriberade monster-special-texter (Varulv/Dödsgast/Kummelgast/
 * Mörkgast/Vampyr) blottade tre saknade uttrycksformer, inte bara en:**
 *  - `reduction:"half"` — proportionell reduktion, avrundat NEDÅT (samma
 *    konvention Varulv-texten själv anger: "avrundat nedåt"). `reduction:
 *    "double"` — samma primitiv åt andra hållet, en SÅRBARHET (Irrbloss:
 *    "tar dubbel skada av köldattacker").
 *  - `damageType` fick två nya poster: `"magic"` (en samlad "ren kraftskada"-
 *    kategori för besvärjelser som inte passar något grundelement — Johans
 *    ursprungliga backlog-anteckning) och `"weapon"` — **ett eget, medvetet
 *    SKILT spår från de fysikaliska skadetyperna.** Anledningen: Lindskiarnens
 *    regel gäller uttryckligen bara "besvärjelser" (magi), INTE vapen — hade
 *    `damageType:"physical"` återanvänts för BÅDE ett vapenhugg (attack.mjs)
 *    OCH en fysisk besvärjelse (spell.mjs) hade Lindskiarnens spell-bara
 *    halvering av misstag även halverat vanliga svärdshugg. `"weapon"` matchas
 *    ENDAST av `resolveAttack()` (aldrig av en besvärjelses egna `damageType`,
 *    som saknar `"weapon"` i sin choices-lista, se item-besvarjelse.mjs) — de
 *    två kanalerna kan aldrig kollidera.
 *  - `overcomeMaterial`/`overcomeReduction` — samma "övervinnbar immunitet"-
 *    mönster som `overcomeE` redan har, fast för VAPENMATERIAL i stället för
 *    effektgrad (Varulv/Vampyr: silver ELLER magi övervinner; Dödsgast/
 *    Kummelgast/Mörkgast: ENDAST magi övervinner — silver räknas INTE, se
 *    `resolveResistance`s asymmetriska jämförelse, samma regel som
 *    `creatureWeaponWarning` i config.mjs redan kodar). `overcomeReduction`
 *    (default `"0"` = full skada) täcker Dödsängelns sammansatta regel
 *    ("Endast magiska vapen kan skada den, och de gör bara halv skada") —
 *    en fallback-reduktion som gäller NÄR villkoret väl är övervunnet, i
 *    stället för att anta att övervunnen immunitet alltid betyder full skada.
 *
 * **Utökat igen 2026-09-03 (backlog 100), samma dag — vapnens SLAGKATEGORI
 * fick tre egna `damageType`-poster i stället för att bara vara ett gap i
 * `"weapon"`.** Skelettets statblock (MB1 s.91) har fyra OLIKA regler för
 * fyra olika vapentyper under samma "vapen"-paraply — `"weapon"` som en enda
 * monolitisk hink kan inte uttrycka det. Lösning: `"piercing"` (pilar/
 * stick/stöt — identisk effekt hos Skelettet, slås ihop), `"slashing"`
 * (hugg) och `"blunt"` (kross) är nu egna `damageType`-värden, matchande
 * `item-vapen.mjs`s nya `strikeType`-fält. `resolveAttack()` slår upp
 * `strikeType` FÖRST; bara om målet saknar en post för just den kategorin
 * faller den tillbaka på den generiska `"weapon"`-typen (Varulv/Vampyr/
 * Dödsgast/Kummelgast/Mörkgast — kategorilösa, rent materialstyrda regler,
 * ingen omkurering av dem behövdes). Johans egen observation samma session,
 * efter att ha sett både detta OCH spelens `damageType` bredvid varandra:
 * *"Seems like 'damage type' is the consistent architecture?"* — bekräftat:
 * samma delade vokabulär täcker nu vapenslag, besvärjelseelement OCH,
 * sedan backlog 104 (samma dag), en tredje MILJÖ-skadekälla: `"water"`
 * (Irrbloss, "vatten ger 1T3 skada per liter") och `"sun"` (Illvätte,
 * "1T6 i skada per minut i solljus") — kurerade på Irrbloss (fire/cold)
 * som proof case, se `resolveResistance`/`tickPeriodicEffect` i config.mjs
 * och SL-formuläret i `scripts/apps/gm-effects.mjs`.
 *
 * Konsumeras av CONFIG.DODE.resolveResistance (scripts/helpers/config.mjs) —
 * vapenanfall (attack.mjs) skickar `weapon.system.strikeType` (fallback
 * `"weapon"`) + vapnets `material`; besvärjelseskada (spell.mjs) OCH
 * periodiska SL-lagda effekter (`tickPeriodicEffect`, backlog 104) skickar
 * ett vanligt elementvärde, aldrig ett strikeType-värde eller `"weapon"`.
 */
export function resistancesField() {
  return new fields.ArrayField(
    new fields.SchemaField({
      damageType: new fields.StringField({
        required: true,
        initial: "physical",
        choices: [
          "physical", "fire", "cold", "acid", "lightning", "poison", "mental", "magic",
          "water", "sun", "weapon", "piercing", "slashing", "blunt"
        ]
      }),
      // "immun" | "half" | "double" | ett flat tal (som sträng) — sparat som
      // sträng eftersom fields.NumberField inte kan uttrycka den unionen;
      // tolkas av resolveResistance.
      reduction: new fields.StringField({ required: true, initial: "0" }),
      overcomeE: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true, min: 0 }),
      // Vapenmaterial som övervinner `reduction:"immun"`/`"half"` — tomt (default)
      // = inget material övervinner alls (t.ex. Spökets totala vapenimmunitet).
      // Bara relevant för damageType:"weapon". Se moduldoc-kommentaren ovan.
      overcomeMaterial: new fields.StringField({ required: false, initial: "", blank: true, choices: ["", "silver", "magical"] }),
      // Vad som gäller NÄR overcomeE/overcomeMaterial är uppfyllt — default
      // "0" (full skada, dagens beteende oförändrat). Kan sättas till "half"
      // för Dödsängelns "magiska vapen gör ändå bara halv skada"-mönster.
      overcomeReduction: new fields.StringField({ required: false, initial: "0" })
    })
  );
}
