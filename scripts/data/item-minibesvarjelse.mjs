import { sourceField } from "./fields-source.mjs";

const fields = foundry.data.fields;

/**
 * Minibesvärjelse — MAG s.23.
 *
 * ⚠ **Egen typ, inte en `besvarjelse` med en flagga.** Mekaniken är en annan
 * sak, inte en variant: en minibesvärjelse **kräver ingen CL-kontroll och
 * lyckas alltid**, kostar en fast **1 PSY** utan effektgradsskalning, är
 * **alltid Kvick** (verkar samma SR) och **behöver inte stå i formelsamlingen**
 * — magikern har den alltid. Det finns alltså inget slag, ingen effektgrad,
 * inget misslyckande och ingen snedtändning, vilket är det mesta av det
 * `besvarjelse` och `castSpell()` finns till för. Att dela typ hade betytt att
 * halva schemat är dött och att kastknappen gör fel sak. Johans bedömning
 * 2026-07-28, bekräftad mot MAG s.23.
 *
 * ⚠ **Åtkomst är härledd, inte ägd.** En magiker har automatiskt minimagin i
 * den skola där hen har **högst FV** (MAG s.23, "Allmän minimagi"). Därför
 * behöver de flesta rollpersoner inte äga posterna — arket visar dem utifrån
 * skolan. Typen finns ändå som Item för det Johan pekade på: SL ska kunna
 * dela ut en enskild minibesvärjelse ad hoc, till någon som annars inte skulle
 * ha den.
 *
 * FV-trösklarna styr bara ÅTHÄVOR, inte utfallet: under 15 krävs normala
 * gester och ord, 15+ inga yttre åthävor, 25+ aktiveras nästan omedvetet.
 */
export default class DoDEMinibesvarjelseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      school: new fields.StringField({
        required: true,
        initial: "animism",
        choices: [
          "alkemi", "animism", "demonologi", "elementarmagi", "harmonism", "haxkonster",
          "illusionism", "mentalism", "nekromanti", "rostmagi", "spiritism", "stavmagi", "symbolism"
        ]
      }),
      // Normalt 1 PSY. Fältet finns för SL:s egna varianter, inte för att
      // regeln skulle skala — den gör den inte.
      psyCost: new fields.NumberField({ required: false, integer: true, initial: 1, min: 0 }),
      // Bok + sida — se fields-source.mjs.
      source: sourceField(),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }
}
