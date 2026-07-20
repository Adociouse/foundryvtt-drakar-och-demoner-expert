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
      bpCost: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      attributeMods: new fields.SchemaField({
        sty: mod(), fys: mod(), smi: mod(), int: mod(), psy: mod(), kar: mod()
      }),
      stoRange: new fields.SchemaField({
        min: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
        max: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
        normal: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true })
      }),
      automaticAbilities: new fields.HTMLField({ required: false, initial: "" }),
      description: new fields.HTMLField({ required: false, initial: "" }),
      // Könsvarianter av porträttbilden — visas i rollpersonsskaparens rasval
      // beroende på tidigare valt kön (character-wizard.mjs). Tomt = ingen
      // variant, guiden faller då tillbaka på itemets vanliga `img`.
      imgMan: new fields.StringField({ required: false, initial: "" }),
      imgKvinna: new fields.StringField({ required: false, initial: "" })
    };
  }
}
