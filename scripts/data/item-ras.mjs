import { sourceField } from "./fields-source.mjs";
import { SCHEMA_VERSION } from "../helpers/schema-migrations.mjs";

const fields = foundry.data.fields;

/**
 * Ras — RASER.md (RP s.9-10). STO hålls medvetet UTANFÖR attributeMods: källan är
 * tydlig med att STO anges som ett intervall (min-max, normalvärde) som spelaren
 * väljer inom, inte en additiv modifierare som övriga attribut. Se RASER.md rad ~27.
 */
export default class DoDERasData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const mod = () => new fields.NumberField({ required: true, integer: true, initial: 0 });

    return {
      // Schema-versionsstämpel — se scripts/helpers/schema-migrations.mjs.
      schemaVersion: new fields.NumberField({ required: false, integer: true, initial: SCHEMA_VERSION }),
      // Rasmodifikation på förflyttning — RP s.25 (Anka −2, Alv +1, Dvärg −2,
      // Halvlängdsman −2, övriga ±0). Lämnas 0 så faller actor-character.mjs
      // tillbaka på DODE.movementRaceMod, som matchar på rasnamn.
      movementMod: new fields.NumberField({ required: false, integer: true, initial: 0 }),
      bpCost: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      attributeMods: new fields.SchemaField({
        sty: mod(), fys: mod(), smi: mod(), int: mod(), psy: mod(), kar: mod()
      }),
      stoRange: new fields.SchemaField({
        min: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
        max: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
        normal: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true })
      }),
      /**
       * Automatiska förmågor — strukturerad ersättning för det gamla fria
       * textfältet (2026-08-16, se DESIGN_DECISIONS.md backlog 70 och
       * wise-herding-lemur.md-planen). Samma radform som `item-yrke.mjs`s
       * `professionAbilities`/`DODE.specialAbilitiesTable`: `effect`
       * återanvänder `resolveGrants`s befintliga typvokabulär, `null` när
       * ingen befintlig typ passar. Ingen arvskedja för raser (till skillnad
       * från yrkenas `baseProfession`) — alvsläkten är en platt lista.
       * ⚠ De 6 alvsläktenas "kan slå fram den släktesegna särskilda
       * förmågan..."-rader är INTE en flat bonus utan en referens till en
       * egen, rasläkt-låst slumptabell (parallell till specialAbilitiesTable)
       * — uttryckligen UTANFÖR den här listan, se ability-source-resolver.mjs.
       */
      automaticAbilities: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: false, initial: "" }),
          description: new fields.HTMLField({ required: false, initial: "" }),
          effect: new fields.ObjectField({ required: false, nullable: true, initial: null })
        })
      ),
      // Bok + sida — se fields-source.mjs.
      source: sourceField(),
      description: new fields.HTMLField({ required: false, initial: "" }),
      // Könsvarianter av porträttbilden — visas i rollpersonsskaparens rasval
      // beroende på tidigare valt kön (character-wizard.mjs). Tomt = ingen
      // variant, guiden faller då tillbaka på itemets vanliga `img`.
      imgMan: new fields.StringField({ required: false, initial: "" }),
      imgKvinna: new fields.StringField({ required: false, initial: "" })
    };
  }

  /** Se scripts/helpers/schema-migrations.mjs. Inga ras-specifika grenar än. */
  static migrateData(source) {
    source.schemaVersion = SCHEMA_VERSION;
    return super.migrateData(source);
  }
}
