const fields = foundry.data.fields;

/**
 * Besvärjelse — MAGI.md (MAG s.8-13). CL = S - 2*(E-1), PSY-kostnad = E per effektgrad;
 * det är kastmekanik (fas 6), inte modellerat på itemet — bara referensdata här.
 */
export default class DoDEBesvarjelseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      school: new fields.StringField({
        required: true,
        initial: "elementarmagi",
        choices: [
          "alkemi", "animism", "demonologi", "elementarmagi", "harmonism", "haxkonster",
          "illusionism", "mentalism", "nekromanti", "rostmagi", "spiritism", "stavmagi", "symbolism"
        ]
      }),
      sValue: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      duration: new fields.StringField({ required: false, initial: "" }),
      range: new fields.StringField({ required: false, initial: "" }),
      ritual: new fields.BooleanField({ required: false, initial: false }),
      kvick: new fields.BooleanField({ required: false, initial: false }),
      // Temporär ActiveEffect som besvärjelsen lägger på målet vid kastning.
      // `spellDuration` är i STRIDSRUNDOR (Foundrys duration.rounds). `spellEffect`
      // är en lista av AE-change-definitioner — riktas alltid mot `.bonus`-fält
      // (aldrig `.value`), mode 2 = ADD (CONST.ACTIVE_EFFECT_MODES.ADD). Kastlogiken
      // (DoDEActor#applySpellEffect) skapar en embeddad ActiveEffect på aktören med
      // flags.dode.source:"spell". Se actor.mjs. Själva "vid träff"-kedjan är stub —
      // metoden finns och kan anropas, men wire:as inte in i castSpell automatiskt än.
      spellDuration: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
      spellEffect: new fields.ArrayField(
        new fields.SchemaField({
          key: new fields.StringField({ required: true, initial: "system.attributes.sty.bonus" }),
          mode: new fields.NumberField({ required: true, integer: true, initial: 2 }),
          value: new fields.StringField({ required: true, initial: "" })
        })
      ),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }
}
