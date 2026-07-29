import { sourceField } from "./fields-source.mjs";

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
      // EP-pott intjänad i spel — REG s.45-46. ⚠ EP från äventyr är BUNDET till
      // den färdighet som tjänade in det ("noteras ett streck vid färdigheten"),
      // till skillnad från SL:s bonuspoäng som är fria (actor.system.ep.bonus).
      // Därför bor potten på itemet, inte på rollpersonen.
      // `earned` räknas upp av strecket, `spent` av köp i träningsfönstret —
      // båda ackumulerar, så historiken finns kvar när potten är tömd.
      // ⚠ Besvärjelser tjänar in EP på en SÖMNKLOCKA, inte per kastning: 1 EP
      // första gången besvärjelsen används framgångsrikt efter förra sömnen
      // (MAG s.23), perfekt ger 1T3+1. `awardedSince` sätts vid utdelning och
      // nollas vid vila, så samma besvärjelse inte kan ge EP två gånger.
      ep: new fields.SchemaField({
        awardedSinceRest: new fields.BooleanField({ required: false, initial: false }),
        earned: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spent: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 })
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
      // flags.<system.id>.source:"spell". Se actor.mjs. Själva "vid träff"-kedjan är stub —
      // metoden finns och kan anropas, men wire:as inte in i castSpell automatiskt än.
      spellDuration: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
      spellEffect: new fields.ArrayField(
        new fields.SchemaField({
          key: new fields.StringField({ required: true, initial: "system.attributes.sty.bonus" }),
          mode: new fields.NumberField({ required: true, integer: true, initial: 2 }),
          value: new fields.StringField({ required: true, initial: "" })
        })
      ),
      // Bok + sida — se fields-source.mjs.
      source: sourceField(),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  prepareDerivedData() {
    // Vad som faktiskt går att lägga på ett köp just nu.
    this.ep.available = Math.max(0, this.ep.earned - this.ep.spent);
  }
}
