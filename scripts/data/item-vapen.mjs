import { sourceField } from "./fields-source.mjs";
import { SCHEMA_VERSION } from "../helpers/schema-migrations.mjs";

const fields = foundry.data.fields;

/** Vapen — UTRUSTNING.md (REG s.58-59). */
export default class DoDEVapenData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Schema-versionsstämpel — se scripts/helpers/schema-migrations.mjs.
      schemaVersion: new fields.NumberField({ required: false, integer: true, initial: SCHEMA_VERSION }),
      // Utrustad? Styr om vapnets ActiveEffects (transfer:true) appliceras på
      // aktören — DoDeActiveEffect.apply() släcker effekten när equipped === false.
      // Använd för magiska vapen som ger attribut-/färdighetsbonusar medan de bärs.
      equipped: new fields.BooleanField({ required: false, initial: true }),
      grip: new fields.StringField({ required: true, initial: "1H", choices: ["1H", "2H", "1-2H"] }),
      styGroup: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      damage: new fields.StringField({ required: true, initial: "1d6" }),
      length: new fields.NumberField({ required: false, integer: true, initial: 0 }),
      weight: new fields.NumberField({ required: false, initial: 0 }),
      baseValue: new fields.NumberField({ required: false, integer: true, initial: 0 }),
      weaponType: new fields.StringField({ required: true, initial: "latt", choices: ["latt", "tung"] }),
      category: new fields.StringField({
        required: true,
        initial: "narstrid",
        choices: ["narstrid", "projektil", "kast"]
      }),
      range: new fields.StringField({ required: false, initial: "" }),
      price: new fields.NumberField({ required: false, integer: true, initial: 0 }),
      // Kättingvapen/Piska — SB s.33: "kättingen kan slå runt vapen och sköldar",
      // varje pareringsförsök mot vapnet (vapen ELLER sköld) får CL halverat.
      // Konsumeras i rolls/attack.mjs#resolveAttack. Bäraren riskerar dessutom ett
      // eget självfummelslag på anfallsslag 18/19/20 — se samma funktion.
      hardToParry: new fields.BooleanField({ required: false, initial: false }),
      // Naturligt vapen (klor, bett, tjockt skinn, drakeld) — mekaniskt
      // IDENTISKT med ett tillverkat vapen (samma FV/skada/parering-
      // beräkning), bara inte plockbart/lootbart. Beslut 2026-08-19:
      // naturliga attacker räknas som vapen, bara "grown out of the being"
      // — gäller även icke-närstridsattacker (t.ex. en drakes eldandedräkt),
      // så fältet är oberoende av `category`. Styr enbart drag/loot-UI
      // (se actor-npc-sheet.mjs och npc-sheet.hbs), ingen mekanisk skillnad.
      natural: new fields.BooleanField({ required: false, initial: false }),
      // Bok + sida — se fields-source.mjs.
      source: sourceField(),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  /** Se scripts/helpers/schema-migrations.mjs. Inga vapen-specifika grenar än. */
  static migrateData(source) {
    source.schemaVersion = SCHEMA_VERSION;
    return super.migrateData(source);
  }
}
