import { sourceField } from "./fields-source.mjs";
import { SCHEMA_VERSION } from "../helpers/schema-migrations.mjs";

const fields = foundry.data.fields;

/**
 * Färdighet — REGLER_FARDIGHETER.md. FV lagras direkt (inte EP-kostnad ännu;
 * EP-köpsekonomin är ej påbörjad — se PLAN_WIZARD_V2.md Fas 7).
 *
 * Bas/bonus/total-mönster (samma som attributen, se actor-character.mjs) — `fv`
 * är det EP-köpta grundvärdet, `bonus` är ett manuellt GM/spelar-redigerbart
 * fritextfält (item-sheeten), `total` (= fv + bonus) är vad `rollSkill()`
 * faktiskt slår mot.
 *
 * ⚠ **Backlogpost 7/36 löst 2026-07-31 — men INTE genom ett nytt fält här.**
 * "Skill Modifier System" (automatiska ras-/yrkes-/förmåge-/utrustningsbaserade
 * bonusar) var blockerat eftersom en transfer-AE:s `key` bara kan rikta in sig
 * på aktörens egna schemafält, aldrig ett namngivet embeddat Item. Lösningen är
 * INTE att göra AE-changes kan träffa den här itemtypen — det går fortfarande
 * inte. I stället bär KÄLLitemet (item-formaga.mjs `skillModifiers`, samma fält
 * på item-utrustning.mjs för utrustning) en ren datalista, och
 * actor-character.mjs#prepareDerivedData summerar den LIVE varje omräkning till
 * `actor.system.skillModifierTotals[skillKey]` — helt utanför AE-pipelinen.
 * `fardighet.total` (fv+bonus) rör sig ALDRIG av detta; konsumenter (rollSkill,
 * arkets färdighetstabell) lägger på `skillModifierTotals` separat. Se
 * `special-ability-effects.mjs` för hur ett förmågeslag blir ett `formaga`-item
 * med rätt `skillModifiers`, och DESIGN_DECISIONS.md backlog 7/36.
 */
export default class DoDEFardighetData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Schema-versionsstämpel — se scripts/helpers/schema-migrations.mjs för
      // hela migrationsramverket och SCHEMA_LOG.
      schemaVersion: new fields.NumberField({ required: false, integer: true, initial: SCHEMA_VERSION }),
      attribute: new fields.StringField({
        required: true,
        initial: "smi",
        choices: ["sty", "sto", "fys", "smi", "int", "psy", "kar"]
      }),
      category: new fields.StringField({
        required: true,
        initial: "a",
        choices: ["a", "b"]
      }),
      // Stabil, språkoberoende identitet — se DODE.skillKey i config.mjs och
      // backlogpost 6a. Visningsnamnet (`name`) är för människor och kan
      // översättas; ALL matchning i koden (guidens avstämning, dedupning,
      // EP-köp) ska gå på `skillKey`. Tomt på äldre färdigheter skapade före
      // 2026-07-27 — då härleds nyckeln ur namnet som fallback.
      skillKey: new fields.StringField({ required: false, initial: "" }),
      // Vapengrupp (RP s.60, DODE.weaponGroups i config.mjs) — bara satt för
      // färdigheter som RÅKAR vara ett namngivet vapen. Tomt fält = ingen
      // gruppspilloverbonus (#computeWeaponGroupBonus i actor-character.mjs).
      // Satt av guidens vapenfärdighetsväljare vid igenkänt namn, annars av
      // spelaren/SL manuellt på itemsheeten.
      weaponGroup: new fields.StringField({ required: false, initial: "" }),
      // Två vapen-kombination (RP s.59) — bara satt när DENNA färdighet
      // representerar en specifik tränad vapenkombination, t.ex.
      // "Två vapen (Kortsvärd+Dolk)". Varje kombination är sin EGEN färdighet
      // (RP: "Färdigheten måste utvecklas individuellt för varje kombination
      // av vapen") — en aktör kan alltså ha flera sådana items. Nycklarna
      // pekar på de två färdigheternas egna skillKey, inte på vapenitems —
      // se DESIGN_DECISIONS.md-planfilens Del 2-resonemang om varför
      // handfördelning INTE lagras här (ett rent stridstidskonern, hör
      // hemma i den ännu obyggda handlingsekonomi-lagern, §9).
      twoWeaponCombo: new fields.SchemaField({
        primaryWeaponKey: new fields.StringField({ required: false, initial: "" }),
        offWeaponKey: new fields.StringField({ required: false, initial: "" })
      }, { required: false }),
      // EP-pott intjänad i spel — REG s.45-46. ⚠ EP från äventyr är BUNDET till
      // den färdighet som tjänade in det ("noteras ett streck vid färdigheten"),
      // till skillnad från SL:s bonuspoäng som är fria (actor.system.ep.bonus).
      // Därför bor potten på itemet, inte på rollpersonen.
      // `earned` räknas upp av strecket, `spent` av köp i träningsfönstret —
      // båda ackumulerar, så historiken finns kvar när potten är tömd.
      ep: new fields.SchemaField({
        // ⚠ EP-STRECKET — RP s.63:s egen term, inte en "klocka". Ordagrant
        // (samma regel i REG s.45): "noteras ett streck vid färdigheten" när
        // rollpersonen använder den framgångsrikt FÖRSTA GÅNGEN EFTER EN
        // SOVPERIOD om minst sex timmar (två för alver). Det är den lilla
        // rutan bredvid varje färdighet på det fysiska rollformuläret — kryssas
        // i vid ett lyckat slag, kryssas ur av clearEpTicks() när man sovit.
        // `ticked` ÄR den rutan.
        //
        // ⚠ Systemet gjorde tidigare "1 EP per lyckat slag i ett stressigt läge
        // (SL bedömer)" efter den kurerade REGLER_FARDIGHETER.md. Den regeln står
        // inte i NÅGON av böckerna — bytt till strecket efter Johans beslut
        // 2026-07-29. Se DESIGN_DECISIONS.md backlogpost 39.
        ticked: new fields.BooleanField({ required: false, initial: false }),
        earned: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
        spent: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 })
      }),
      fv: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      bonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      // Ersätter den tidigare `yrkesfardighet`-booleanen (PLAN_WIZARD_V2.md Fas 6)
      // — RP s.30 skiljer på tre kostnadskategorier (2/3/5 EP per FV-steg vid
      // EP-köp, Fas 7), inte bara yrkesfärdighet/inte. Rollpersonsskaparens
      // auto-tilldelning (Fas 6) sätter "primar" för de 16 primära färdigheterna
      // och "yrkesfardighet" för matchade poster i yrkets `professionSkills`
      // (item-yrke.mjs) — "sekundar" är default för allt annat (manuellt
      // tillagda färdigheter via "Ny färdighet"-knappen).
      costTier: new fields.StringField({
        required: false,
        initial: "sekundar",
        choices: ["primar", "yrkesfardighet", "sekundar"]
      }),
      // Bok + sida — se fields-source.mjs.
      source: sourceField(),
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  prepareDerivedData() {
    // Vad som faktiskt går att lägga på ett köp just nu.
    this.ep.available = Math.max(0, this.ep.earned - this.ep.spent);
    this.total = this.fv + this.bonus;
    this.bonusDisplay = this.bonus > 0 ? `+${this.bonus}` : `${this.bonus}`;
  }

  /** Se scripts/helpers/schema-migrations.mjs. Inga fardighet-specifika grenar än. */
  static migrateData(source) {
    source.schemaVersion = SCHEMA_VERSION;
    return super.migrateData(source);
  }
}
