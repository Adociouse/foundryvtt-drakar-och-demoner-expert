import { sourceField } from "./fields-source.mjs";
import { SCHEMA_VERSION } from "../helpers/schema-migrations.mjs";

const fields = foundry.data.fields;

/**
 * Rustning — UTRUSTNING.md (REG s.53-54). En typ täcker kroppsrustning, hjälmar och
 * sköldar via `slot`. Sköldars faktiska stridsmekanik (extra parering, 1/20 sönderchans)
 * är stridsintegration — fas 6, inte modellerad här ännu.
 */
export default class DoDERustningData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Schema-versionsstämpel — se scripts/helpers/schema-migrations.mjs.
      schemaVersion: new fields.NumberField({ required: false, integer: true, initial: SCHEMA_VERSION }),
      slot: new fields.StringField({ required: true, initial: "kropp", choices: ["kropp", "huvud", "skold"] }),
      // Utrustad? Styr om föremålets ActiveEffects (transfer:true) faktiskt
      // appliceras på aktören — DoDeActiveEffect.apply() släcker effekten när
      // equipped === false. Använd t.ex. för en sköld som ger STY-bonus medan
      // den bärs. OBS: ABS härleds separat i actor-character.mjs (max bland
      // kroppsrustningar) och påverkas INTE av equipped — bara AE-bonusar gör det.
      equipped: new fields.BooleanField({ required: false, initial: true }),
      // ⚠ Vilka träffområden plåten faktiskt täcker — Spelarboken s.27 delar upp
      // rustning i namngivna delar (hjälm, armskydd, benskydd, harnesk, brynja,
      // brynjehosor, hauberk, helrustning) i stället för ett enda kroppsvärde.
      // Utan det här fältet kan en hjälm skydda benen, vilket den gjorde fram
      // till 2026-07-29. Nycklarna matchar DODE.hitLocations.
      // ⚠ Brytvärde — sköldar bärs som `rustning` men ABSORBERAR inte; de
      // pareras med och slits (SB s.38: sköldtabellen har STY-krav, BV, vikt och
      // pris, ingen Absorbering-kolumn). Utan fältet tappade DataModellen BV vid
      // inläsning trots att det låg i packen. Samma namn som på vapen.
      baseValue: new fields.NumberField({ required: false, integer: true, initial: 0 }),
      styGroup: new fields.NumberField({ required: false, integer: true, initial: 0 }),
      coverage: new fields.ArrayField(new fields.StringField(), { required: false }),
      armourGroup: new fields.StringField({ required: false, initial: "" }),
      abs: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      weight: new fields.NumberField({ required: false, initial: 0 }),
      price: new fields.NumberField({ required: false, integer: true, initial: 0 }),
      // Naturlig rustning (tjockt skinn, fjäll) — mekaniskt IDENTISK med en
      // tillverkad rustning (samma ABS-beräkning), bara inte plockbar/lootbar.
      // Beslut 2026-08-19, se motsvarande fält i item-vapen.mjs. Styr enbart
      // drag/loot-UI, ingen mekanisk skillnad.
      natural: new fields.BooleanField({ required: false, initial: false }),
      // Bok + sida — se fields-source.mjs.
      source: sourceField(),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  /** Se scripts/helpers/schema-migrations.mjs. Inga rustning-specifika grenar än. */
  static migrateData(source) {
    source.schemaVersion = SCHEMA_VERSION;
    return super.migrateData(source);
  }
}
