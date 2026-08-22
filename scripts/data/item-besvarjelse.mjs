import { sourceField } from "./fields-source.mjs";
import { SCHEMA_VERSION } from "../helpers/schema-migrations.mjs";

const fields = foundry.data.fields;

/**
 * Besvärjelse — MAGI.md (MAG s.8-13). CL = S - 2*(E-1), PSY-kostnad = E per effektgrad;
 * det är kastmekanik (fas 6), inte modellerat på itemet — bara referensdata här.
 */
export default class DoDEBesvarjelseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Schema-versionsstämpel — se scripts/helpers/schema-migrations.mjs.
      schemaVersion: new fields.NumberField({ required: false, integer: true, initial: SCHEMA_VERSION }),
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
      // ⚠ Besvärjelser tjänar in EP på samma EP-STRECK som färdigheter, inte per
      // kastning: 1 EP första gången besvärjelsen används framgångsrikt efter
      // förra sömnen (MAG s.23), perfekt ger 1T3+1. `ticked` kryssas i vid
      // utdelning och kryssas ur vid vila, så samma besvärjelse inte kan ge EP
      // två gånger innan nästa sovperiod.
      ep: new fields.SchemaField({
        ticked: new fields.BooleanField({ required: false, initial: false }),
        earned: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spent: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 })
      }),
      sValue: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      // Magisk kodex för just den här besvärjelsen — SB s.7. ⚠ Krävs för att
      // kunna ENSAMTRÄNA besvärjelsen: "för att lära sig den själv måste han
      // göra det ur en s.k. magisk kodex", 20-30 sidor handskriven text per
      // besvärjelse. Träning med lärare kräver ingen kodex.
      // ⚠ Bör på sikt vara ett ägt `utrustning`-föremål som går att köpa och
      // stjäla, inte en bock på besvärjelsen — se backlogposten om kodexar.
      hasCodex: new fields.BooleanField({ required: false, initial: false }),
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
      // Momentan HP-förändring vid kastning (skada/läkning) — separat från
      // spellEffect ovan, som bara kan skapa varaktiga .bonus-ActiveEffects.
      // `formula` följer samma tärningsformel-konvention som item-vapen.mjs:s
      // `damage`-fält (t.ex. "1T6*@E"), där @E ersätts med kastets effektgrad
      // vid upplösning (scripts/rolls/spell.mjs, fas 2). Beslut 2026-08-21,
      // se docs/dev/MAGI_STRID_ANVANDNINGSFALL.md: motorn saknade helt en
      // instant-HP-delta-primitiv (UC-M1/M3/M11/M12).
      instantEffect: new fields.SchemaField({
        kind: new fields.StringField({ required: false, initial: "none", choices: ["none", "damage", "heal"] }),
        formula: new fields.StringField({ required: false, initial: "" })
      }),
      // Skadetyp för instantEffect.kind:"damage" — matchas mot en aktörs
      // `resistances[]` (actor-character.mjs/actor-npc.mjs) via
      // CONFIG.DODE.resolveResistance (fas 2). "none" = ingen resistans möjlig
      // (t.ex. rent mentala effekter utan en fysisk skadekälla).
      damageType: new fields.StringField({
        required: false,
        initial: "none",
        choices: ["none", "physical", "fire", "cold", "acid", "lightning", "poison", "mental"]
      }),
      // Foundry-kärnans egen status-id (samma sex som attack-dialog.mjs:s
      // PARRY_BLOCKING_STATUSES + t.ex. "blind") att toggla vid lyckad
      // kastning — skilt från spellEffect, som bara ändrar .bonus-fält och
      // aldrig kan uttrycka en riktig statustoggle (UC-M5/M6/M8/M9).
      statusEffect: new fields.StringField({ required: false, initial: "" }),
      // Räddningsslag — kopplar mot den redan byggda, tidigare oanvända
      // DODE.rollResistance/resistanceTarget (config.mjs, Motståndstabellen,
      // SL s.34/RP s.37-38). "attribute-save" = ett äkta slumpmässigt
      // attribut-vs-SG-slag (rädsla/mental påverkan, UC-M7). Skilt från
      // resistances[].overcomeE (actor-character.mjs), som är en
      // deterministisk taltröskel utan slag ("övervinna MED E" — UC-M17).
      resistedBy: new fields.StringField({ required: false, initial: "none", choices: ["none", "attribute-save"] }),
      // Bara relevant när resistedBy:"attribute-save". Dynamiska choices (samma
      // mönster som fields-source.mjs:s sourceField) i stället för en hårdkodad
      // kopia av DODE.attributes nycklar.
      saveAttribute: new fields.StringField({
        required: false, initial: "", blank: true,
        choices: () => ["", ...Object.keys(CONFIG.DODE?.attributes ?? {})]
      }),
      // Svårighetsgrad för räddningsslaget — en fritt AUKTORERAD nivå (samma
      // DODE.difficultyGrades-skala som Motståndstabellen redan använder),
      // INTE en härledd formel från effektgrad. Fas 2-tillägg (2026-08-21):
      // en formel som kopplar E→SG vore en ny, osourcad homebrew-regel som
      // enligt CLAUDE.md kräver ett uttalat skaparbeslut — att i stället låta
      // innehållsförfattaren välja SG direkt (precis som sValue/spellDuration
      // redan är auktorerade tal) undviker den frågan helt.
      saveDifficulty: new fields.StringField({
        required: false, initial: "normalt",
        choices: ["mycket-latt", "latt", "normalt", "svart", "mycket-svart", "extremt-svart"]
      }),
      // Drar Skräcktabellen (packs/tabeller) vid ETT misslyckat räddningsslag
      // mot den här besvärjelsen — Rädsla/Panik/Terror-mönstret (UC-M7).
      // Bara meningsfullt tillsammans med resistedBy:"attribute-save".
      triggersFearTable: new fields.BooleanField({ required: false, initial: false }),
      // Hur besvärjelsen väljer mål — informerar kast-UI:t (fas 3), ingen
      // motorlogik i sig. "multi"/"area" återanvänder Anfallsdialogens redan
      // byggda flermåls-loop-mönster (game.user.targets).
      // "split" tillagt 2026-08-21 (live-fynd/Johans SL-ruling under
      // krogslagsmålet, se Eld: "Temperaturhöjning i 1 m sfär vid målet...
      // alternativt E sfärer med lägre skada"). Skiljer sig från "multi"
      // (varje mål får HELA effekten dupplicerad) — "split" delar EN delad
      // pool av effektgrad-tärningar mellan valfritt antal mål (1..E), fler
      // mål = färre tärningar/mål. Formaliserat som: mål N (1..E) väljs via
      // hur många tokens spelaren målsatt, tärningar/mål = E - N + 1 (N=1
      // ger samma resultat som innan detta fält fanns, bakåtkompatibelt).
      // Se spell.mjs#resolveSpellCast för beräkningen.
      targetMode: new fields.StringField({
        required: false,
        initial: "single",
        choices: ["self", "touch", "single", "multi", "area", "split"]
      }),
      // Den "stödkolumn för battle" Johan efterfrågade — flaggar besvärjelser
      // som är relevanta att visa/filtrera i en stridssituation, till
      // skillnad från de ~150 rent narrativa/utility-besvärjelserna (Karta,
      // Levitation, Väderförutsägelse m.fl.) som inte behöver någon av
      // fälten ovan. Ren kureringsflagga, ingen motorlogik läser den än.
      battleRelevant: new fields.BooleanField({ required: false, initial: false }),
      // Bok + sida — se fields-source.mjs.
      source: sourceField(),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  prepareDerivedData() {
    // Vad som faktiskt går att lägga på ett köp just nu.
    this.ep.available = Math.max(0, this.ep.earned - this.ep.spent);
  }

  /** Se scripts/helpers/schema-migrations.mjs. Inga besvärjelse-specifika grenar än. */
  static migrateData(source) {
    source.schemaVersion = SCHEMA_VERSION;
    return super.migrateData(source);
  }
}
