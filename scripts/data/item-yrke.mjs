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
      // Strukturerad delmängd av yrkets tillåtna färdigheter — CHARACTERMANCER-
      // WORKFLOW.md:333-477 (YRKEN-objektet, Roll20-projektet), korsat mot
      // REGLER_FARDIGHETER.md:s sekundärfärdighetstabell för attributkoppling.
      // Konsumeras av rollpersonsskaparens auto-tilldelning (PLAN_WIZARD_V2.md
      // Fas 6, character-wizard.mjs).
      // ⚠ Inte en fullständig lista över allt yrket "får" — källans
      // tillåtna_fardigheter-listor innehåller dels valfria poster (t.ex.
      // "Tala språk (max 2)", "Valfri vapenfärdighet") som kräver ett UI-val som
      // inte finns än, dels breda kategorier ("Alla strid utom Judo och Karate",
      // "Alla uppfattning", "Alla tjuvfärdigheter") som inte går att slå upp mot
      // en enskild grundegenskap utan att gissa. Bara konkreta, namngivna
      // färdigheter som finns i REGLER_FARDIGHETER.md:s tabeller är listade här
      // — resten läggs till manuellt via arkets "Ny färdighet"-knapp (fas 2/3).
      // Detta är den dokumenterade forskningsluckan i PLAN_WIZARD_V2.md:s
      // öppna-luckor-tabell ("Strukturerade yrkesfärdighetslistor... Fas 6").
      professionSkills: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: true, initial: "" }),
          attribute: new fields.StringField({
            required: true,
            initial: "int",
            choices: ["sty", "sto", "fys", "smi", "int", "psy", "kar"]
          })
        })
      ),
      description: new fields.HTMLField({ required: false, initial: "" }),
      // Könsvarianter av porträttbilden — visas i rollpersonsskaparens yrkesval
      // beroende på tidigare valt kön (character-wizard.mjs). Tomt = ingen
      // variant, guiden faller då tillbaka på itemets vanliga `img`.
      imgMan: new fields.StringField({ required: false, initial: "" }),
      imgKvinna: new fields.StringField({ required: false, initial: "" })
    };
  }
}
