import { DODE } from "../helpers/config.mjs";
import { sourceField } from "./fields-source.mjs";
import { SCHEMA_VERSION } from "../helpers/schema-migrations.mjs";

const fields = foundry.data.fields;

/**
 * NPC/monster — MONSTER.md (MB1/MB2/MBK2/MM). Enklare än rollpersonen: inga
 * ras/yrke-item, inga färdighets-item — "skills" är fritext (källorna anger dem
 * som t.ex. "Spåra 65%, Simma 80%", ej strukturerat).
 *
 * KP-formeln (STO+FYS)/2 höll konsekvent mot alla kontrollerade MB1/MBK2-block.
 * Skadebonus gjorde INTE det — t.ex. Krokodil (STY38+STO38=76) skulle enligt
 * PC-tabellen ge +3T6, men källan anger uttryckligen 2T6. Skadebonus är därför
 * ett manuellt textfält för NPC, inte auto-beräknat som på rollpersonen.
 */
export default class DoDENpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const attribute = () => new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, initial: 10, min: 0 })
    });

    return {
      // Schema-versionsstämpel — se scripts/helpers/schema-migrations.mjs.
      schemaVersion: new fields.NumberField({ required: false, integer: true, initial: SCHEMA_VERSION }),
      attributes: new fields.SchemaField({
        sty: attribute(), sto: attribute(), fys: attribute(),
        smi: attribute(), int: attribute(), psy: attribute(), kar: attribute()
      }),
      hp: new fields.SchemaField({
        value: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
        max: new fields.NumberField({ required: true, integer: true, initial: 0 })
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
      abs: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
      damageBonus: new fields.StringField({ required: false, initial: "" }),
      movement: new fields.StringField({ required: false, initial: "" }),
      moral: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
      count: new fields.StringField({ required: false, initial: "" }),
      habitat: new fields.StringField({ required: false, initial: "" }),
      rarity: new fields.StringField({ required: false, initial: "" }),
      attacks: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: false, initial: "" }),
        fv: new fields.NumberField({ required: false, integer: true, initial: 0 }),
        damage: new fields.StringField({ required: false, initial: "" }),
        note: new fields.StringField({ required: false, initial: "" })
      })),
      skills: new fields.StringField({ required: false, initial: "" }),
      special: new fields.HTMLField({ required: false, initial: "" }),
      // Bok + sida - se fields-source.mjs.
      source: sourceField(),
      biography: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  /** Se scripts/helpers/schema-migrations.mjs. Inga npc-specifika grenar än. */
  static migrateData(source) {
    source.schemaVersion = SCHEMA_VERSION;
    return super.migrateData(source);
  }

  prepareDerivedData() {
    // ⚠ `total` speglar bara `value` här. Rollpersonen har mönstret
    // value/bonus/total (se actor-character.mjs); NPC:er har inget bonuslager
    // ännu. Fältet finns ändå så att EN initiativformel fungerar för båda
    // aktörstyperna — se CONFIG.Combat.initiative i dode.mjs. Får NPC:er
    // bonusar senare räknas de in här utan att formeln behöver ändras.
    for (const attr of Object.values(this.attributes)) attr.total = attr.value;

    const a = this.attributes;
    for (const data of Object.values(a)) {
      data.group = DODE.attributeToGroup(data.value);
    }

    // KP = (STO + FYS) / 2 — samma formel som rollpersonen, verifierad mot MONSTER.md-blocken.
    this.hp.max = Math.round((a.sto.value + a.fys.value) / 2);
    this.hp.value = this.hp.value === null || this.hp.value === undefined
      ? this.hp.max
      : Math.min(this.hp.value, this.hp.max);
  }
}
