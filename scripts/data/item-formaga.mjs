import { sourceField } from "./fields-source.mjs";

const fields = foundry.data.fields;

/**
 * Förmåga — ett embeddat Item som bär en eller flera ActiveEffects (transfer:true)
 * vilka appliceras automatiskt så fort förmågan ligger på aktören. Till skillnad
 * från utrustning (vapen/rustning) finns ingen `equipped`-växel: en förmåga är
 * alltid aktiv medan den är på aktören (DoDeActiveEffect.apply() släcker den aldrig
 * eftersom `system.equipped` saknas -> undefined !== false).
 *
 * Detta är den strukturerade motsvarigheten till rollpersonens fritext-array
 * `system.specialAbilities` (actor-character.mjs). Fritext-arrayen finns kvar för
 * ren anteckning; `formaga`-Item är för förmågor som faktiskt ska MODIFIERA värden
 * via AE (t.ex. Skogsalv "+10 CL Gömma sig", en medfödd resistens som höjer ett
 * attribut). `origin` speglar specialAbilities.source ("bas"/"ras"/"yrke"/"hjalte");
 * `source` är bok+sida som på alla andra innehållstyper.
 *
 * Källa/backlog: docs/DESIGN_DECISIONS.md — "Förmågor 4-source aggregation" /
 * "structured ability table". Effekterna authoras som vanliga ActiveEffects på
 * itemet (transfer:true), inte som schemadata här.
 */
export default class DoDEFormagaData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Härkomst ("bas"/"ras"/"yrke"/"hjalte") — INTE bokkälla. Hette `source`
      // fram till 2026-07-28 men döptes om när `source` blev bok+sida på alla
      // innehållstyper; två olika betydelser på samma nyckel gav en tyst
      // duplicerad schemanyckel. Inget kompendieinnehåll fanns ännu, så
      // omdöpningen kostade ingen migrering.
      origin: new fields.StringField({ required: false, initial: "" }),
      // Bok + sida — se fields-source.mjs.
      source: sourceField(),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }
}
