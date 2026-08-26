import { sourceField } from "./fields-source.mjs";
import { SCHEMA_VERSION } from "../helpers/schema-migrations.mjs";

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
      // Schema-versionsstämpel — se scripts/helpers/schema-migrations.mjs.
      schemaVersion: new fields.NumberField({ required: false, integer: true, initial: SCHEMA_VERSION }),
      school: new fields.StringField({
        required: true,
        initial: "animism",
        choices: [
          // ⚠ "allman" är ingen lärbar magiskola — se item-besvarjelse.mjs.
          // Formelboken s.1 listar tolv minibesvärjelser under rubriken
          // "Allmänna besvärjelser / Minimagi" som varje magiker har tillgång
          // till oavsett skola: Ljusspel, Bläddra, Knäppa, Tryckvåg, Kyla/Värme,
          // Minilyft, Putsa/Smutsa, Vindpust, Smaksätt, Vissling, Väldoft,
          // Öppna/Stänga. Varje skola har DESSUTOM sin egen minimagi (animismens
          // är Bevara, Identifiera, Lugna och Natura, s.4).
          "allman",
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

  /** Se scripts/helpers/schema-migrations.mjs. Inga minibesvärjelse-specifika grenar än. */
  static migrateData(source) {
    source.schemaVersion = SCHEMA_VERSION;
    return super.migrateData(source);
  }
}
