const fields = foundry.data.fields;

/**
 * Yrke — YRKEN.md (RP s.11-22). Yrkesfärdighetsval (12, magiker 9) och EP-ekonomi
 * är chargen-wizard-arbete (fas 5) — detta är en referens-/beskrivningsitem tills vidare.
 */
export default class DoDEYrkeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      requirements: new fields.StringField({ required: false, initial: "" }),
      professionAbility: new fields.HTMLField({ required: false, initial: "" }),
      skillList: new fields.HTMLField({ required: false, initial: "" }),
      description: new fields.HTMLField({ required: false, initial: "" }),
      // Könsvarianter av porträttbilden — visas i rollpersonsskaparens yrkesval
      // beroende på tidigare valt kön (character-wizard.mjs). Tomt = ingen
      // variant, guiden faller då tillbaka på itemets vanliga `img`.
      imgMan: new fields.StringField({ required: false, initial: "" }),
      imgKvinna: new fields.StringField({ required: false, initial: "" })
    };
  }
}
