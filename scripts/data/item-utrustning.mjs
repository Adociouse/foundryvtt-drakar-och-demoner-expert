import { sourceField } from "./fields-source.mjs";
import { SCHEMA_VERSION } from "../helpers/schema-migrations.mjs";

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
      // Schema-versionsstämpel — se scripts/helpers/schema-migrations.mjs.
      schemaVersion: new fields.NumberField({ required: false, integer: true, initial: SCHEMA_VERSION }),
      category: new fields.StringField({
        required: true,
        initial: "diverse",
        blank: true,
        choices: [
          "verktyg", "kladsel", "behallare", "koksutrustning", "lagerutrustning",
          "tjuvverktyg", "instrument", "droger", "mat", "riddjur", "fordon", "vardesaker", "diverse"
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
      // Färdighetsmodifierare (backlogpost 7) — samma form och samma LIVA
      // summering som item-formaga.mjs `skillModifiers`, se
      // actor-character.mjs#prepareDerivedData. Räknas bara medan `equipped`
      // är sant, och (om `activationSeconds` är satt) bara medan
      // `flags.<id>.activeUntil` inte gått ut — se `activationSeconds` nedan
      // och scripts/documents/item.mjs.
      skillModifiers: new fields.ArrayField(new fields.SchemaField({
        skillKey: new fields.StringField({ required: true, initial: "" }),
        value: new fields.NumberField({ required: true, integer: true, initial: 0 })
      })),
      // Magiska bärbara föremål som höjer HP/PSY-max medan utrustade (t.ex. en
      // stav som ger +3 PSY) — samma fält/form som item-formaga.mjs's
      // `statModifiers`, konsumerat av SAMMA `#applyStatModifiers`-summering
      // i actor-character.mjs (som redan skannar "utrustning"-typade items,
      // gated på `equipped`, se `#isModifierItemActive`) — bara fältet
      // saknades här, ingen ändring behövdes i själva summeringslogiken.
      // Live-fynd 2026-08-21, Johan: "Malakor med... en stav som ger +3PSY".
      statModifiers: new fields.ArrayField(new fields.SchemaField({
        stat: new fields.StringField({ required: true, initial: "hp.max", choices: ["hp.max", "psy.max"] }),
        operation: new fields.StringField({ required: true, initial: "add", choices: ["add", "multiply"] }),
        value: new fields.NumberField({ required: true, integer: true, initial: 0 })
      })),
      // HP-/PSY-återhämtningsmodifierare medan buren (t.ex. en meditationsstav,
      // +50% PSY-återhämtning) — samma equip-/activationSeconds-grind som
      // skillModifiers ovan. Se docs/dev/AATERHAMTNING_ANVANDNINGSFALL.md UC-R10.
      recoveryModifiers: new fields.ArrayField(new fields.SchemaField({
        resource: new fields.StringField({ required: true, initial: "hp", choices: ["hp", "psy"] }),
        operation: new fields.StringField({ required: true, initial: "multiply", choices: ["add", "multiply"] }),
        value: new fields.NumberField({ required: true, initial: 1 })
      })),
      // Antal aktiveringar kvar innan föremålet är förbrukat/uttjänt. `null` =
      // obegränsat (normalfallet för allt utom testade laddningsföremål).
      // Dras av EN gång per aktivering (se item.mjs `_preUpdate`), inte per
      // sekund föremålet bärs.
      chargesRemaining: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true, min: 0 }),
      // Hur många sekunder en aktivering (utrustning=true, eller konsumtion)
      // håller i sig innan effekten klingar av — `null` = permanent så länge
      // föremålet är utrustat (samma beteende som Väktarklingan/Alvskölden
      // hade innan detta fält fanns, oförändrat för dem). Skiljer sig från
      // ActiveEffect-baserad duration (se `effectChanges`/consumeItem nedan) —
      // `skillModifiers` är INTE AE-driven, så tidsgränsen är en ren
      // flagga-mot-worldTime-jämförelse i den live aggregeringen, ingen egen
      // ActiveEffect behövs bara för att räkna ner tiden.
      activationSeconds: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true, min: 0 }),
      // Konsumtionsbart engångsföremål (t.ex. en drickbar drog/besvärjelse-i-
      // flaska) — actor.mjs#consumeItem tar bort föremålet när chargesRemaining
      // når 0, till skillnad från utrustning som bara blir en inert pryl.
      consumable: new fields.BooleanField({ required: false, initial: false }),
      // Generaliserar item-besvarjelse.mjs `spellEffect` till konsumtionsbar
      // utrustning — samma {key, mode, value}-form, samma ActiveEffect-baserade
      // applicering (actor.mjs#consumeItem, mönster från applySpellEffect). En
      // `key` FÅR innehålla platshållaren "$CHOICE" (t.ex.
      // "system.attributes.$CHOICE.bonus"), ersatt med spelarens val vid
      // konsumtion — se consumeItem.
      effectChanges: new fields.ArrayField(new fields.SchemaField({
        key: new fields.StringField({ required: true, initial: "" }),
        // mode 2 = ADD (CONST.ACTIVE_EFFECT_MODES.ADD) — samma konvention och
        // samma skäl att inte referera CONST här som item-besvarjelse.mjs
        // `spellEffect`.
        mode: new fields.NumberField({ required: false, integer: true, initial: 2 }),
        value: new fields.StringField({ required: false, initial: "" })
      })),
      // Bok + sida — se fields-source.mjs. Var tidigare en fri sträng
      // ("Magi-regelboken s.43-48"); migrerad till strukturerad form 2026-07-28.
      source: sourceField(),
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

  /** Se scripts/helpers/schema-migrations.mjs. Inga utrustning-specifika grenar än. */
  static migrateData(source) {
    source.schemaVersion = SCHEMA_VERSION;
    return super.migrateData(source);
  }
}
