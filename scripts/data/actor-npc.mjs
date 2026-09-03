import { DODE } from "../helpers/config.mjs";
import { sourceField } from "./fields-source.mjs";
import { resistancesField } from "./fields-resistances.mjs";
import { SCHEMA_VERSION } from "../helpers/schema-migrations.mjs";

const fields = foundry.data.fields;

/**
 * NPC/monster — MONSTER.md (MB1/MB2/MBK2/MM). Enklare än rollpersonen: inga
 * ras/yrke-item, inga färdighets-item — "skills" är fritext (källorna anger dem
 * som t.ex. "Spåra 65%, Simma 80%", ej strukturerat).
 *
 * KP-formeln (STO+FYS)/2 höll konsekvent mot alla kontrollerade MB1/MBK2-block.
 * Skadebonus gjorde INTE det — t.ex. Krokodil (STY38+STO38=76) skulle enligt
 * PC-tabellen ge +3T6, men källan anger uttryckligen 2T6. Skadebonus är därför
 * ett manuellt textfält för NPC, inte auto-beräknat som på rollpersonen.
 */
export default class DoDENpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const attribute = () => new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, initial: 10, min: 0 })
    });

    return {
      // Schema-versionsstämpel — se scripts/helpers/schema-migrations.mjs.
      schemaVersion: new fields.NumberField({ required: false, integer: true, initial: SCHEMA_VERSION }),
      attributes: new fields.SchemaField({
        sty: attribute(), sto: attribute(), fys: attribute(),
        smi: attribute(), int: attribute(), psy: attribute(), kar: attribute()
      }),
      hp: new fields.SchemaField({
        value: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
        max: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        // ⚠ Explicit KP som ÖVERSTYR båda härledningsformlerna nedan. Behövs för
        // varelser vars källa anger KP på ett sätt ingen formel kan uttrycka.
        // `null` = använd den vanliga härledningen. Tre skilda fall i dag:
        //
        // 1. EGEN FORMEL I KÄLLAN. Monsterboken 2:s gastar (Dödsgast s.89,
        //    Kummelgast s.90, Mörkgast s.91) trycker "KP = PSY", eftersom PSY
        //    ÄR deras kropp och all skada dras därifrån — utan fältet hade en
        //    dödsgast fått 16 KP i stället för bokens 33. Varulven (MB1 s.34)
        //    anger ett TREvägsmedel av STY, STO och FYS = 20, inte tvåvägs 14.
        //
        // 2. AVSIKTLIG NOLLA. Spöket (MB1 s.91) är immateriellt och kan inte
        //    skadas av vapen eller skadevållande magi alls; en härledd KP hade
        //    felaktigt antytt en kropp att slå på. Samma mönster som svärmarna,
        //    som redan bär KP 0 direkt ur källan.
        //
        // 3. KÄLLAN FÖLJER INTE SIN EGEN FORMEL. Vid en maskinell jämförelse av
        //    alla 179 poster 2026-08-22 stämde 163 exakt; resten trycker ett KP
        //    som avviker från bokens egen formel trots korrekt transkriberade
        //    grundegenskaper (Barracuda 6/10, Syrödla 15/13, Brachiosaurus
        //    178/176, Dödsängel 200/108, Jättespindel ung 13/12, plus ,5-fallen
        //    Onaqui 17, Eldhäst 37, Urgammal drake 131). ⚠ Bokens avrundning
        //    vid exakt ,5 är INKONSEKVENT — Skuggbest och Gasthäst går uppåt,
        //    Eldhäst nedåt — så ingen avrundningsregel går att härleda. Det
        //    TRYCKTA värdet gäller; varje sådan post bär en synlig ⚠-notis i
        //    `special` om vad formeln annars hade gett. Se de kurerade
        //    extrakten DODE_Monsterboken1/2_STATBLOCK.md i Roll20-projektet.
        maxOverride: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true })
      }),
      // ⚠ Deplomerbar PSY-resurs, tillagd 2026-09-03 (Johan: "Build NPC/Monster
      // PSY like KP to manage PSY spells"). Innan detta hade NPC:er bara
      // `attributes.psy.value` — en platt attributpoäng utan aktuell/max-
      // uppdelning — så en PSY-skadebesvärjelse (Andeslag, Själaförvittring,
      // Skrik) hade ingenstans att skriva för ett NPC-mål (se backlog 92).
      // Samma value/max-mönster som `hp` ovan: `value:null` betyder "full",
      // `max` härleds i prepareDerivedData() direkt från `attributes.psy.value`
      // (till skillnad från HP finns ingen formel att avvika från — psy-
      // attributet ÄR redan det auktorerade grundtalet, ingen maxOverride
      // behövs). Låga PSY-varelser (skorpioner/spindlar PSY 1, svärmar PSY 0
      // i dagens kompendium) töms alltså nästan omedelbart av även en svag
      // PSY-besvärjelse — samma "överkill mot ett lågt HP-mål"-dynamik som
      // redan gäller KP-skada, inget särskilt undantag behövs.
      resources: new fields.SchemaField({
        psy: new fields.SchemaField({
          value: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
          max: new fields.NumberField({ required: true, integer: true, initial: 0 })
        })
      }),
      // Kroppsbyggnad — styr träffområdestabellen (RP s.48-50). ⚠ Dolt värde:
      // spelarna ska inte behöva veta att en varelse är bevingad för att systemet
      // ska slå rätt träffområde. Default humanoid, vilket täcker de flesta.
      bodyPlan: new fields.StringField({
        required: false, initial: "humanoid",
        choices: ["humanoid", "fyrfota", "bevingad-humanoid", "kentaur", "svanmo"]
      }),
      // Träffområdenas KP — ⚠ TOMT tills någon riktar ett anfall mot varelsen.
      // KP per område HÄRLEDS ur Totala KP (DODE.hitLocationKp), så ingenting
      // behöver förberedas: en varelse som hittills varit en påse KP får en
      // kropp i samma ögonblick som någon siktar på den. Det är mekaniken som
      // gör det möjligt att blanda vanlig och detaljerad strid utan bokföring.
      hitLocations: new fields.ObjectField({ required: false, initial: () => ({}) }),
      abs: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
      // Motstånd/immunitet mot skadetyp (eld/kyla/syra m.fl.) — se fields-resistances.mjs.
      resistances: resistancesField(),
      damageBonus: new fields.StringField({ required: false, initial: "" }),
      movement: new fields.StringField({ required: false, initial: "" }),
      moral: new fields.NumberField({ required: false, integer: true, initial: null, nullable: true }),
      count: new fields.StringField({ required: false, initial: "" }),
      habitat: new fields.StringField({ required: false, initial: "" }),
      rarity: new fields.StringField({ required: false, initial: "" }),
      attacks: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: false, initial: "" }),
        fv: new fields.NumberField({ required: false, integer: true, initial: 0 }),
        damage: new fields.StringField({ required: false, initial: "" }),
        note: new fields.StringField({ required: false, initial: "" })
      })),
      skills: new fields.StringField({ required: false, initial: "" }),
      special: new fields.HTMLField({ required: false, initial: "" }),
      // Bok + sida - se fields-source.mjs.
      source: sourceField(),
      biography: new fields.HTMLField({ required: false, initial: "" })
    };
  }

  /** Se scripts/helpers/schema-migrations.mjs. Inga npc-specifika grenar än. */
  static migrateData(source) {
    source.schemaVersion = SCHEMA_VERSION;
    return super.migrateData(source);
  }

  prepareDerivedData() {
    // ⚠ `total` speglar bara `value` här. Rollpersonen har mönstret
    // value/bonus/total (se actor-character.mjs); NPC:er har inget bonuslager
    // ännu. Fältet finns ändå så att EN initiativformel fungerar för båda
    // aktörstyperna — se CONFIG.Combat.initiative i dode.mjs. Får NPC:er
    // bonusar senare räknas de in här utan att formeln behöver ändras.
    for (const attr of Object.values(this.attributes)) attr.total = attr.value;

    const a = this.attributes;
    for (const data of Object.values(a)) {
      data.group = DODE.attributeToGroup(data.value);
    }

    // KP = (STO + FYS) / 2 — samma formel som rollpersonen, verifierad mot MONSTER.md-blocken.
    //
    // ⚠ UNDANTAG: ODÖDA. Monsterboken 1 (s.89 Mumie, s.90 Skelett, s.95 Zombie,
    // s.93 Vampyr) säger uttryckligen att odöda "har ingen FYS" och att deras
    // KP i stället beräknas ur medelvärdet av **STO och STY**. Med den vanliga
    // formeln hade FYS 0 gett absurt låga värden — ett mänskligt skelett skulle
    // få 6 KP i stället för bokens 17, och en vampyr 6 i stället för 22, alltså
    // en varelse som dör av ett enda slag. Hittat vid liveverifiering av
    // Monsterboken 1-importen 2026-08-22.
    //
    // FYS === 0 är den enda markören som behövs: ingen levande varelse i
    // källmaterialet har FYS 0, och boken använder just "ingen FYS" som sin
    // egen definition av odöd. Ingen ny schemaflagga krävs alltså.
    // ⚠ Samma FYS === 0-gren täcker BÅDA de källor som säger "ingen FYS":
    // odöda (MB1 s.89/90/93/95, MB2 s.84) och magiska varelser (MB2 s.100,
    // Skuggbest/Eldhäst/Frostvarg/Djinn) — båda anger KP som medelvärdet av
    // STY och STO. Stickprov mot boken: Baneman 16, Dödsriddare 18, Skuggbest
    // 33, Djinn 25, Mara 25, Gasthäst 38 — alla exakta.
    const isUndead = a.fys.value === 0;
    this.hp.max = this.hp.maxOverride ?? (isUndead
      ? Math.round((a.sto.value + a.sty.value) / 2)
      : Math.round((a.sto.value + a.fys.value) / 2));
    this.hp.value = this.hp.value === null || this.hp.value === undefined
      ? this.hp.max
      : Math.min(this.hp.value, this.hp.max);

    // PSY-resurs — se schemafältets kommentar ovan. Max är rakt av
    // attributvärdet (ingen formel, ingen maxOverride-flykt behövs).
    this.resources.psy.max = a.psy.value;
    this.resources.psy.value = this.resources.psy.value === null || this.resources.psy.value === undefined
      ? this.resources.psy.max
      : Math.min(this.resources.psy.value, this.resources.psy.max);
  }
}
