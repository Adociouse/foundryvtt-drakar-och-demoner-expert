const fields = foundry.data.fields;

/**
 * Utrustning — generisk föremålstyp för allt som varken är vapen, rustning,
 * besvärjelse eller förmåga: verktyg, kläder, behållare, köksutrustning,
 * lägerutrustning, tjuvverktyg, instrument, droger, mat, riddjur och fordon.
 *
 * Bakgrund: fram till 2026-07-28 hade systemet BARA specialiserade Item-typer
 * (`vapen`/`rustning`/…), så de ~200 vardagsföremålen i Magi-regelbokens
 * utrustningslistor (s.43-48) hade ingenstans att bo. Se DESIGN_DECISIONS.md §3 14e.
 *
 * Prissättning skiljer sig från `vapen`/`rustning`, som har ett rent `price` i
 * silvermynt. Källtabellerna blandar myntslag — hela klädtabellen är i
 * kopparmynt och drogtabellen till stor del i guldmynt — så priset lagras i
 * BOKENS EGET myntslag (`price` + `priceUnit`) och normaliseras till silver i
 * `priceSm`. Att räkna om vid inmatning i stället hade tappat källvärdet och
 * gjort varje pris omöjligt att stämma av mot boken.
 */
export default class DoDEUtrustningData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      category: new fields.StringField({
        required: true,
        initial: "diverse",
        blank: true,
        choices: [
          "verktyg", "kladsel", "behallare", "koksutrustning", "lagerutrustning",
          "tjuvverktyg", "instrument", "droger", "mat", "riddjur", "fordon", "diverse"
        ]
      }),
      quantity: new fields.NumberField({ required: false, integer: true, initial: 1, min: 0 }),
      // Vikt i BEP (belastningspoäng), samma enhet som vapen/rustning använder.
      // Källtabellerna anger bråkdelar som 1/4 och 1/2 — lagras som 0.25/0.5.
      weight: new fields.NumberField({ required: false, initial: 0, min: 0 }),
      price: new fields.NumberField({ required: false, initial: 0, min: 0 }),
      priceUnit: new fields.StringField({
        required: false,
        initial: "sm",
        choices: ["km", "sm", "gm"]
      }),
      // Fritext för priser som inte är ett rent tal ("4 per kagge", "5 sm/g",
      // "×0,5", "2×grundkostnad per 100 ord"). Sätts priset så här är `price` 0
      // och posten är inte köpbar i guidens utrustningssteg — den finns som
      // referens. Att tvinga in dessa i ett nummerfält hade förvanskat dem.
      priceNote: new fields.StringField({ required: false, initial: "" }),
      // Utrustad-flagga av samma skäl som på vapen/rustning: den styr om
      // föremålets ev. ActiveEffects appliceras (DoDeActiveEffect.isGateOpen).
      // Vanlig utrustning bär sällan effekter, men en magisk ryggsäck kan.
      equipped: new fields.BooleanField({ required: false, initial: false }),
      source: new fields.StringField({ required: false, initial: "" }),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  prepareDerivedData() {
    // Normaliserat pris i silvermynt — det enda måttet guidens utrustningssteg
    // och eventuella butiksfunktioner kan jämföra över myntslag.
    // ⚠ Växelkursen är INTE belagd i källmaterialet, se CONFIG.DODE.coinToSilver.
    this.priceSm = CONFIG.DODE.toSilver(this.price, this.priceUnit);
    this.totalWeight = Math.round((this.weight ?? 0) * (this.quantity ?? 1) * 100) / 100;
    this.priceDisplay = this.priceNote
      ? this.priceNote
      : `${this.price} ${this.priceUnit}`;
  }
}
