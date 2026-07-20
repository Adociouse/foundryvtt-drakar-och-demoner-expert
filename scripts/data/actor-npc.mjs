import { DODE } from "../helpers/config.mjs";

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
      attributes: new fields.SchemaField({
        sty: attribute(), sto: attribute(), fys: attribute(),
        smi: attribute(), int: attribute(), psy: attribute(), kar: attribute()
      }),
      hp: new fields.SchemaField({
        value: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
        max: new fields.NumberField({ required: true, integer: true, initial: 0 })
      }),
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
      biography: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  prepareDerivedData() {
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
