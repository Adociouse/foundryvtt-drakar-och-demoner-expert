import { sourceField } from "./fields-source.mjs";

const fields = foundry.data.fields;

/**
 * Yrke — YRKEN.md (RP s.11-22). Yrkesfärdighetsval (12, magiker 9) och EP-ekonomi
 * är chargen-wizard-arbete (fas 5) — detta är en referens-/beskrivningsitem tills vidare.
 */
export default class DoDEYrkeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      requirements: new fields.StringField({ required: false, initial: "" }),
      // Grundyrke som detta yrke är en specialisering av — tomt för grundyrkena
      // själva. Krigar-/tjuv-/lönnmördar-/bardspecialiseringarna (KH s.4-9,
      // T&L s.7-16) har alla sitt grundyrkes förmåga PLUS en egen, och ärver
      // dess grundkrav. Fältet används i dagsläget bara för att gruppera korten
      // i rollpersonsskaparens yrkessteg — ingen mekanik hänger på det, men
      // utan gruppering blir 36 yrkeskort i ett platt rutnät oanvändbart.
      // ⚠ `blank: true` krävs: en StringField med `choices` avvisar annars tom
      // sträng, och eftersom grundyrkena har just "" här kraschade validering av
      // VARJE befintligt yrke-item på en aktör ("baseProfession: may not be a
      // blank string"). Fångades bara av liveverifiering — `node --check` ser
      // inte DataModel-validering.
      baseProfession: new fields.StringField({
        required: false,
        initial: "",
        blank: true,
        choices: ["", "krigare", "tjuv", "lonnmordare", "bard"]
      }),
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
      /**
       * Möjliga yrkesfärdigheter. Spelaren väljer 12 av dessa (magiker 9) — RP s.11.
       *
       * ⚠ Alla poster är INTE namngivna färdigheter. Böckernas listor innehåller
       * också valfria platser: "Maximalt fem valfria vapenfärdigheter",
       * "Tala maximalt två valfria främmande språk", "maximalt ett valfritt
       * Hantverk", "en valfri Stridskonst". De kan inte uttryckas som ett namn +
       * grundegenskap, och de kan heller inte delas ut automatiskt — spelaren
       * måste fylla dem. Därför `choiceCount`/`choicePool`:
       *
       *   choiceCount 0  → vanlig namngiven färdighet (som förut)
       *   choiceCount >0 → N valfria ur `choicePool`, `name` är etiketten som visas
       */
      professionSkills: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: true, initial: "" }),
          attribute: new fields.StringField({
            required: true,
            initial: "int",
            choices: ["sty", "sto", "fys", "smi", "int", "psy", "kar"]
          }),
          choiceCount: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
          choicePool: new fields.StringField({ required: false, initial: "", blank: true })
        })
      ),
      // Bok + sida — se fields-source.mjs.
      source: sourceField(),
      description: new fields.HTMLField({ required: false, initial: "" }),
      // Könsvarianter av porträttbilden — visas i rollpersonsskaparens yrkesval
      // beroende på tidigare valt kön (character-wizard.mjs). Tomt = ingen
      // variant, guiden faller då tillbaka på itemets vanliga `img`.
      imgMan: new fields.StringField({ required: false, initial: "" }),
      imgKvinna: new fields.StringField({ required: false, initial: "" })
    };
  }
}
