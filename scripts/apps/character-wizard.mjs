import { needsChoice, choiceCount, resolveGrants, applyResolvedAbility, pruneOrphanedAbilityGrants } from "../helpers/special-ability-effects.mjs";
import { resolveProfessionAbilityRows, resolveRaceAbilityRows } from "../helpers/ability-source-resolver.mjs";

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;

// Rollpersonsguidens bakgrund + ambiens — se DESIGN_DECISIONS.md backlog 34.
// Scenen "Rollpersonsguiden" skapas manuellt i varje värld (inte kompendiepackad
// än); saknas den hoppar #enterWizardScene bara över hela steget.
const WIZARD_SCENE_NAME = "Rollpersonsguiden";
const WIZARD_AMBIENCE_SRC = "systems/drakar-och-demoner-expert/assets/audio/the-iron-crown.mp3";

// ⚠ `attribut` ligger FÖRE `yrke` sedan 2026-07-28. Yrkenas grundegenskapskrav
// (YRKEN.md "Grundegenskapskrav", RP s.11) går annars inte att kontrollera vid
// valet — alla värden är null då, varje krav blir "overifierat" och kravkollen
// blir dekoration. Se DESIGN_DECISIONS.md §2-raden om yrkeskrav.
// ⚠ `alder` flyttad hit (2026-08-05, Johan) — kommer FÖRE attribut/yrke/kapital
// eftersom `#effectiveAttributes()`, `#checkRequirements()` och
// `ageCapitalMultiplier`-uppslaget i kapital-steget ALLA redan läste
// `state.ageCategory` innan spelaren hunnit sätta den (defaultade tyst till
// "Mogen"). Se docs/DESIGN_DECISIONS.md backlog 34 för hela utredningen —
// utan den här ordningen ändras attributköpstegens siffror retroaktivt så
// fort spelaren senare väljer en annan ålder än standardvärdet.
// Omordnad 2026-08-06 för att följa RP s.23-31:s egen sekvens (Johans
// direktiv) SÅ LÅNGT den går utan att återinföra en redan fixad bugg. Två
// hårda beroenden styr vad som INTE kunde flyttas rakt av:
//   - "alder" måste stå FÖRE "attribut" OCH "kapital" — båda läser
//     ageCategory för sina LIVE-förhandsvisningar (grundegenskapernas
//     åldersmod, kapitalets åldersmultiplikator). RP:s eget sidordning
//     (ålder långt senare, efter startkapital) fungerar på papper eftersom
//     den fysiska blanketten inte har någon "förhandsvisning" att räkna om
//     — vår guide har det, så att flytta ålder dit skulle återinföra exakt
//     den bugg backlog 34 fixade (redan bekräftat med Johan: ålder stannar
//     tidigt, en medveten guide-specifik avvikelse från bokordningen).
//   - "ras"/"attribut"/"yrke"/"magiskola" måste komma i den ordningen —
//     yrke kräver slutgiltiga (rasmodifierade) grundegenskaper för
//     kravkontrollen, magiskola kräver ett valt yrke.
// ⚠ RÄTTAD 2026-08-07 (Johan): "formagor" låg först direkt efter "attribut",
// FÖRE "yrke" — flyttad till EFTER "yrke" eftersom särskilda förmågor
// (KH s.3) rimligen inte kan slås fram innan yrke är valt, en riktig
// beroendekedja som fortfarande gäller (se nedan). Ursprungligen flyttad
// ÄNDA till efter "fardigheter" (matchande Roll20-projektets referens-HTML-
// guide, dode-chargen/preview.html), med motiveringen att `special-ability-
// effects.mjs`s `"yrkesUpgrade"`-effekttyp matchar mot redan valda
// yrkesfärdigheter.
// ⚠ OMPRÖVAD 2026-08-16 (Johan): "you will likely buy with EP differently"
// om man redan känner till sina särskilda förmågor — en genuin
// budgetplaneringspoäng som INTE handlar om ett tekniskt beroende (en
// kodgranskning samma dag, se DESIGN_DECISIONS.md backlog 69, visade att
// `yrkesUpgrade` bara matchar fritext mot den statiska sekundärfärdighets-
// katalogen, aldrig mot spelarens redan valda yrkesfärdigheter — det gamla
// motivet var svagare än dokumenterat). Poängen är i stället att en spelare
// som VET att hen t.ex. har +3 FV i Klättra på köpet (Sjöfararbakgrund)
// rimligen vill spendera sina EP annorlunda på just den färdigheten än om
// hen inte visste det än. "formagor" flyttad till EFTER "yrke"/"magiskola"
// (samma s.3-beroende som fortfarande gäller) men FÖRE de EP-spenderande
// stegen ("socialt"/"kapital"/"sprak"/"yrkesfardigheter"/"fardigheter") —
// alltså tillbaka till en position nära den allra första, men nu med rätt
// motivering och utan att återinföra "yrke måste vara valt"-buggen.
// Övriga, oförändrade beroenden:
//   - "alder" måste stå FÖRE "attribut" OCH "kapital" — båda läser
//     ageCategory för sina LIVE-förhandsvisningar.
//   - "ras"/"attribut"/"yrke"/"magiskola" måste komma i den ordningen —
//     yrke kräver slutgiltiga (rasmodifierade) grundegenskaper för
//     kravkontrollen, magiskola kräver ett valt yrke.
//   - "yrkesfardigheter" står OMEDELBART före "fardigheter" (samma bok-
//     sektion, RP s.30) — kräver att socialt/kapital redan är klara
//     eftersom "fardigheter"s EP-budget beror på kvarvarande BP efter ALLT
//     annat köp. "sprak" (modersmål) står kvar precis före skill-blocket
//     av samma skäl: den beror på ras och socialt stånd.
const ALL_STEPS = ["start", "kon", "niva", "grunder", "ras", "hand", "alder", "attribut", "yrke", "magiskola", "formagor", "socialt", "kapital", "sprak", "yrkesfardigheter", "fardigheter", "livsmal", "utrustning", "granska"];
// Steg som hoppas över i redigeringsläge (befintlig rollperson). Utrustning är
// spelläge så fort rollpersonen finns — guiden kan inte skilja ett köp vid
// skapandet från ett fynd i en grotta, så att köra butiken igen skulle antingen
// dubblera utrustning eller radera loot. Köp efter skapandet hör hemma i en
// handlar-/butiksaktör istället, se DESIGN_DECISIONS.md §7.2 + backlogposten om
// butiksarkitektur.
const EDIT_MODE_SKIPPED_STEPS = ["utrustning"];
const STEP_LABELS = {
  start: "Översikt",
  kon: "Kön",
  niva: "Nivå",
  grunder: "Namn",
  ras: "Ras",
  hand: "Svärdshand",
  yrke: "Yrke",
  magiskola: "Magiskola",
  yrkesfardigheter: "Yrkesfärdigheter",
  attribut: "Grundegenskaper",
  formagor: "Särskilda förmågor",
  socialt: "Socialt stånd",
  kapital: "Startkapital",
  sprak: "Språk",
  alder: "Ålder",
  fardigheter: "Färdigheter",
  livsmal: "Livsmål",
  utrustning: "Utrustning",
  granska: "Granska"
};
const AGE_CATEGORIES = ["Ung", "Mogen", "Medelålders", "Gammal"];
const ROLLABLE_ATTRIBUTES = ["sty", "fys", "smi", "int", "psy", "kar"];
// Kön — styr vilken imgMan/imgKvinna-variant som visas för ras/yrke i guiden
// (se #genderedImg). Ingen regelmekanik kopplad till valet i sig.
const KON_OPTIONS = [
  { value: "man", label: "Man", icon: "fa-mars" },
  { value: "kvinna", label: "Kvinna", icon: "fa-venus" }
];
// Rollpersonsnivåer — HH s.37-39 (fyra nivåer, narrativa kategorier utan egen
// mekanisk effekt utöver BP/EP-poolen — se DODE.bpByNiva i config.mjs).
// Bildsökvägarna pekar på assets/niva-<slug>.png (kopierade in för guiden).
const NIVA_OPTIONS = [
  { value: "vanlig", label: "Vanlig", description: "Ingen guds redskap. Ditt öde är ditt eget.", img: "systems/drakar-och-demoner-expert/assets/niva-vanlig.png" },
  { value: "slumpens-hjalte", label: "Slumpens hjälte", description: "Ödet grep in mitt i livet. Gudarnas redskap — men med fri vilja.", img: "systems/drakar-och-demoner-expert/assets/niva-slumpens-hjalte.png" },
  { value: "sann-hjalte", label: "Sann hjälte", description: "Vald vid första andetaget. Livet format av gudarna.", img: "systems/drakar-och-demoner-expert/assets/niva-sann-hjalte.png" },
  { value: "gudafodd", label: "Gudafödd", description: "Son eller dotter av en gud. Mäktigast. Sällsyntast. Ödets barn.", img: "systems/drakar-och-demoner-expert/assets/niva-gudafodd.png" }
];

/**
 * Guidad rollpersonsskapare — portning av mancer-flödet från dode-chargen (Roll20),
 * men bara de steg som är obekväma att göra direkt på arket: nivå/ras/yrke-val med
 * kravkontroll, och attributslag. Färdigheter och utrustning läggs till EFTER
 * guiden via arkets befintliga drag-släpp/"Ny färdighet"-funktioner (fas 2/3) —
 * ingen anledning att duplicera det flödet här.
 *
 * Kön (Man/Kvinna) väljs i steg 1, före nivå — styr bara vilken av item-ras/
 * item-yrkes `imgMan`/`imgKvinna`-porträttbilder som visas i ras-/yrkesstegen
 * och ärvs av de embeddade items när rollpersonen skapas (#genderedImg). Ingen
 * regelmekanik är kopplad till valet.
 *
 * Rollpersonsnivå (Vanlig/Slumpens hjälte/Sann hjälte/Gudafödd, HH s.37-39)
 * väljs i steg 2 och driver BP-poolen (125/150/175/200 — DODE.bpByNiva). En
 * löpande BP-räknare visas på alla steg (PLAN_WIZARD_V2.md Fas 2). Ras,
 * socialt stånd och startkapital drar/ger BP (Fas 2+3); särskilda förmågor och
 * färdigheter har egna ledger-fält förberedda i DataModel:en men spenderas
 * inte än — deras wizard-steg byggs i senare faser, se PLAN_WIZARD_V2.md.
 * De fyra nivåerna ÄR ödestypen — HH pp.37-39 anger ingen mekanisk effekt
 * kopplad till Öde-typen utöver KH:s BP/EP-nivåskala, så nivåvalet gör dubbel
 * tjänst istället för att vara en separat wizard-sektion.
 *
 * ⚠ RÄTTAD 2026-08-02: grundegenskaper KÖPS med BP (RP s.23), precis som ras,
 * särskilda förmågor, socialt stånd och startkapital — se
 * DODE.attributeBuyCumulative i config.mjs. Denna docblock-kommentar påstod
 * tidigare motsatsen ("de slås fram med 3T6, RP s.9") och att ingen
 * BP-köp-väg var byggd "medvetet" — det var en felläsning av källan, inte
 * ett avstämt designbeslut. Se DESIGN_DECISIONS.md backlog för utredningen.
 *
 * Socialt stånd/startkapital (Fas 3) implementerar RP s.27–28:s 2T6+BP/9-
 * ståndssystem — källdokumentet REGEL_SocialtStand.md drar själv slutsatsen att
 * det är auktoritativt för Expert, till skillnad från det tidigare aldrig
 * implementerade 1T20/4-ståndssystemet.
 *
 * Ålder (Fas 4) applicerar startkapitalets åldersmultiplikator (RP s.28, känd
 * tabell — `startCapital.finalSm` är nu slutgiltigt). Åldersmodifikationer på
 * grundegenskaper (RP s.24-25) är däremot en olöst forskningslucka — se
 * DODE.ageAttributeModifiers i config.mjs. Infrastrukturen (raceMod/ageMod-
 * uppdelning) finns och aktiveras automatiskt den dagen tabellen fylls i, men
 * ger `ageMod: 0` för alla åldrar tills dess. Gissa inte fram värden.
 *
 * EP-budgeten (Fas 5) räknas fram i `"alder"`-steget — nivå×ålder-tabell
 * (KH s.3/RP s.28) + kvarvarande BP × 5 (RP s.28) — och visas där, men inget
 * spenderar den ännu. `maxStartFv` (KH s.3, max FV en färdighet får ha vid
 * skapande) beräknas samtidigt, redo för Fas 6/7:s färdighetsköp.
 *
 * Färdigheter (Fas 6) auto-genereras i `"fardigheter"`-steget: de 16 primära
 * färdigheterna (RP s.36) + yrkets `professionSkills` (item-yrke.mjs), båda vid
 * bas-FV = BC (grupp av grundegenskapen, samma `DODE.attributeToGroup` som
 * DataModellens egen beräkning).
 *
 * EP-köp (Fas 7) sker i samma `"fardigheter"`-steg: varje färdighet har en
 * "+1 FV"/"−1 FV"-kontroll, kostnad enligt `DODE.skillCost` (RP s.30, kumulativ
 * tabell, INTE grundkostnad × antal steg). Knappen grånas (inte hård spärr på
 * något annat än sig själv) om EP inte räcker eller `maxStartFv` (KH s.3) är
 * nådd. `state.fardigheter[namn]` lagrar bara den köpta delen ovanpå BC — se
 * `#skillPreview`.
 *
 * Särskilda förmågor (Fas 8, MVP) — `"formagor"`-steget mellan `yrke`/
 * `magiskola` och `socialt` (se ALL_STEPS-kommentaren, omflyttad 2026-08-16).
 * Antalet fritext-slots styrs av nivå (`DODE.abilityRollsByNiva`,
 * KH s.3 — samma tabell som BP), men VAD spelaren skriver i varje slot är fri
 * text, inte en tabellslagning — ingen komplett förmågetabell är extraherad
 * (forskningslucka, se item-yrke.mjs-liknande kommentar i actor-character.mjs).
 *
 * Livsmål (Fas 9) — `"livsmal"`-steget: dropdown över `DODE.lifeGoals` (21
 * poster) + ett fritextfält som skriver över listvalet om ifyllt. Utrustning
 * (Fas 9) — `"utrustning"`-steget: kort-rutnät över `vapen-utrustning`-
 * kompendiet (vapen+rustning i samma pack), köp/sälj drar `state.startCapital
 * .finalSm` ner mot 0, grånad "Köp" när priset överstiger kvarvarande kapital.
 * Ingen ny Item-schema behövdes — `vapen`/`rustning` hade redan `price`.
 *
 */
export default class DoDECharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dode-character-wizard",
    tag: "form",
    classes: ["dode", "sheet", "character-wizard"],
    // Johan 2026-08-02: 640×640 var för litet i praktiken (samma anledning
    // som rollformuläret bumpades till 900×1000) — särskilt sena steg med
    // kortrutnät (yrke: upp till 19 kort) och hjältedåd-resultatlistan.
    // `resizable:true` sedan tidigare, det här är bara ett bekvämare default.
    position: { width: 900, height: 1000 },
    window: { title: "Ny rollperson", resizable: true },
    actions: {
      nextStep: DoDECharacterWizard.#onNextStep,
      prevStep: DoDECharacterWizard.#onPrevStep,
      buyAttribute: DoDECharacterWizard.#onBuyAttribute,
      sellAttribute: DoDECharacterWizard.#onSellAttribute,
      toggleProfessionSkill: DoDECharacterWizard.#onToggleProfessionSkill,
      clearProfessionSkills: DoDECharacterWizard.#onClearProfessionSkills,
      restartAttributes: DoDECharacterWizard.#onRestartAttributes,
      selectKon: DoDECharacterWizard.#onSelectKon,
      selectNiva: DoDECharacterWizard.#onSelectNiva,
      rollHjaltedadCount: DoDECharacterWizard.#onRollHjaltedadCount,
      rollHjaltedad: DoDECharacterWizard.#onRollHjaltedad,
      selectRace: DoDECharacterWizard.#onSelectRace,
      selectProfession: DoDECharacterWizard.#onSelectProfession,
      selectMagicSchool: DoDECharacterWizard.#onSelectMagicSchool,
      rollSwordHand: DoDECharacterWizard.#onRollSwordHand,
      rollSocialStanding: DoDECharacterWizard.#onRollSocialStanding,
      rollStartCapital: DoDECharacterWizard.#onRollStartCapital,
      buySkillFv: DoDECharacterWizard.#onBuySkillFv,
      sellSkillFv: DoDECharacterWizard.#onSellSkillFv,
      buyAllSkillFv: DoDECharacterWizard.#onBuyAllSkillFv,
      sellAllSkillFv: DoDECharacterWizard.#onSellAllSkillFv,
      buyEquipment: DoDECharacterWizard.#onBuyEquipment,
      sellEquipment: DoDECharacterWizard.#onSellEquipment,
      rollFormaga: DoDECharacterWizard.#onRollFormaga,
      createCharacter: DoDECharacterWizard.#onSubmitWizard
    },
    form: { handler: () => {}, submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    // `scrollable` är Foundrys EGEN mekanism (HandlebarsApplicationMixin,
    // `_preSyncPartState`/`_syncPartState`) för att spara och återställa en
    // scroll-position över en re-render — annars nollställs `.wizard-step-
    // container`s scrollTop varje gång `this.render()` körs efter ETT klick
    // (t.ex. ett enskilt yrkesfärdighetsval på Steg 14/18), vilket kastar
    // användaren till toppen av en lång lista efter varje val. Johan
    // 2026-08-08. Se scripts/apps/training.mjs och sheets/*.mjs för samma fix.
    form: { template: "systems/drakar-och-demoner-expert/templates/apps/character-wizard.hbs", scrollable: [".wizard-step-container"] }
  };

  /**
   * @param {object} [options]
   * @param {Actor} [options.actor]  Befintlig rollperson att redigera. Utelämnas
   *   vid nyskapande — `this.actor === null` är alltså skapaläget.
   */
  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    if (this.actor) this.#loadStateFromActor(this.actor);
  }

  /**
   * Väljardialog när en spelare äger fler än en rollperson och öppnar guiden
   * utan att peka ut vilken (den generiska "Ny rollperson"-knappen) — se
   * `game.dode.openCharacterWizard` i dode.mjs.
   *
   * @param {Actor[]} owned Rollpersoner spelaren äger.
   * @returns {Promise<Actor|"new"|undefined>} Vald aktör, strängen `"new"` för
   *   "skapa ny", eller `undefined` om dialogen stängdes utan val.
   *
   * ⚠ **INTE `null` för "skapa ny".** `DialogV2.wait()` (som `.prompt()` byggs
   * på) använder `??`/`??=` internt på returvärdet från `ok.callback` — ett
   * explicit `null` kan därför tyst bytas ut mot Foundrys eget defaultvärde i
   * stället för att komma fram som `null`. Upptäckt i livetest 2026-07-30: en
   * spelare som valde "skapa ny rollperson" fick i stället ett main-tråds-krasch
   * i `#loadStateFromActor` eftersom `options.actor` blev något annat än `null`.
   * Strängen `"new"` är varken `null` eller `undefined`, så den överlever `??`.
   */
  static async pickCharacter(owned) {
    const rows = owned.map((a) => `
      <label class="wizard-pick-row">
        <input type="radio" name="actorId" value="${a.id}" />
        <img src="${a.img}" alt="" />
        <span>${a.name}</span>
      </label>`).join("");

    return DialogV2.prompt({
      window: { title: "Välj rollperson" },
      content: `<p>Du har flera rollpersoner. Vilken vill du öppna?</p>
        <div class="wizard-pick-list">
          ${rows}
          <label class="wizard-pick-row">
            <input type="radio" name="actorId" value="" checked />
            <i class="fa-solid fa-plus"></i>
            <span>Skapa en ny rollperson</span>
          </label>
        </div>`,
      ok: {
        label: "Öppna",
        callback: (event, button) => {
          const id = button.form.elements.actorId.value;
          return id ? (owned.find((a) => a.id === id) ?? "new") : "new";
        }
      }
    });
  }

  /**
   * Byter DENNA ANVÄNDARES vy till rollpersonsguidens scen (marmorgolv + moln,
   * se DESIGN_DECISIONS.md backlog 34) med lokal ambiensmusik, och lägger tillbaka
   * spelaren där den var när guiden stängs.
   *
   * ⚠ **Bara för spelare, aldrig GM** — GM:s skärm styr vad hela bordet ser och
   * ska inte ryckas undan av en spelares "Ny rollperson"-klick mitt i sessionen.
   * `game.dode.openCharacterWizard` hoppar redan över hela guidevalsflödet för
   * GM, men den kollen skyddar inte ett GM-anrop med explicit `actor` (arkets
   * "Redigera i guiden"-knapp) — dubbelkollat här.
   *
   * ⚠ **`scene.view()` och `AudioHelper.play(..., false)` är båda KLIENTLOKALA**
   * — de påverkar bara den anropande webbläsaren, inte resten av bordet. Det är
   * det som gör "spelare X är i guiden medan resten spelar vidare" möjligt utan
   * att röra `scene.active`/`Scene#activate()`, som är delat för alla.
   *
   * ⚠ Ljudet spelas EJ inväntat (`.then()`, inte `await`) — en webbläsare som
   * inte hunnit lås upp ljud efter en användarklick kan låta `AudioHelper.play()`
   * hänga i väntan på upplåsning; det får aldrig blockera att guiden öppnas.
   */
  async #enterWizardScene() {
    if (game.user.isGM) return;
    const scene = game.scenes.getName(WIZARD_SCENE_NAME);
    if (!scene) return; // scenen är inte upplagd i den här världen — inget att göra
    if (scene.id === canvas.scene?.id) return; // redan där, rör ingenting

    this.#previousSceneId = canvas.scene?.id ?? null;
    await scene.view();
    foundry.audio.AudioHelper.play(
      { src: WIZARD_AMBIENCE_SRC, volume: 0.4, loop: true, channel: "music" },
      false // lokalt — pushas inte till andra klienter
    ).then((sound) => { this.#ambience = sound; }).catch(() => {});
  }

  /** Motsatsen till #enterWizardScene — se den för resonemang. */
  async #exitWizardScene() {
    this.#ambience?.stop();
    this.#ambience = null;
    if (!this.#previousSceneId) return;
    const previous = game.scenes.get(this.#previousSceneId);
    this.#previousSceneId = null;
    await previous?.view();
  }

  #previousSceneId = null;
  #ambience = null;

  /** @override Körs en gång vid guidens första rendering — se #enterWizardScene. */
  async _onFirstRender(context, options) {
    await super._onFirstRender?.(context, options);
    await this.#enterWizardScene();
  }

  /** @override Städar undan scen/ljud innan fönstret faktiskt stängs. */
  async close(options) {
    await this.#exitWizardScene();
    return super.close(options);
  }

  get isEditMode() {
    return !!this.actor;
  }

  /**
   * Stegen som faktiskt visas. Två filter:
   *  - EDIT_MODE_SKIPPED_STEPS i redigeringsläge (utrustning).
   *  - `magiskola` bara för magikeryrken — en krigare ska inte tvingas igenom
   *    ett tomt magiskolesteg. Se #isMagicUser.
   */
  get steps() {
    let steps = ALL_STEPS;
    if (this.isEditMode) steps = steps.filter((s) => !EDIT_MODE_SKIPPED_STEPS.includes(s));
    if (!this.#isMagicUser) steps = steps.filter((s) => s !== "magiskola");
    return steps;
  }

  /**
   * Magikeryrke? Avgörs på yrkets namn eftersom magiskoletillhörighet inte är
   * ett schemafält på `yrke` — Magiker är det enda grundyrket med magiskolor
   * (MAGI.md), och specialiseringar som Paladin/Fingerkonstnär får sin magi via
   * sin yrkesförmåga, inte via en egen skola.
   * ⚠ Namnbaserat, och därmed samma lokaliseringsrisk som backlogpost 6a
   * beskriver — men här är namnet det enda vi har tills `yrke` får ett eget
   * fält. Noterat i backloggen.
   */
  /**
   * ⚠ Läser yrkets `system.magic.access`, INTE namnet. Fram till 2026-07-28
   * matchade detta på /magiker/i, vilket missade både **paladin** (Mentalism,
   * KH s.6) och **utbygdsjägare** (Animism, RP) — båda har magi. Se
   * backlogpost 12e och item-yrke.mjs för de tre behörighetsnivåerna.
   */
  get #magicAccess() {
    return this.#selectedProfessionDoc?.system?.magic ?? null;
  }

  get #isMagicUser() {
    return (this.#magicAccess?.access ?? "none") !== "none";
  }

  /** Bara "full" räknas som magiker i RP:s mening — 9 yrkesfärdigheter i stället för 12. */
  get #isFullMagician() {
    return (this.#magicAccess?.access ?? "none") === "full";
  }

  // Cachad av #attributeBuyResult (varje render) — se #attributeBounds.
  #stoBounds = null;

  #selectedProfessionName = "";
  // Speglat av samma skäl som namnet ovan: yrkesfärdighetssteget behöver hela
  // dokumentet (professionSkills), men actions körs utanför _prepareContext.
  #selectedProfessionDoc = null;
  // Samma mönster, samma skäl — språksteget (#canAdvance/#onSetMotherTongueLang)
  // behöver rasdokumentet (raceGroup, för DODE.motherTongueSlots) synkront.
  #selectedRaceDoc = null;
  // Samma mönster igen — yrkesfärdighetsstegets vapenfärdighetspooler
  // (backlog 66, Johan: "weapon selection UI... weird and not natural")
  // behöver en riktig lista att bygga en <select> av i #professionSkillState,
  // som körs utanför _prepareContext(). Alla `vapen`-kompendieposter, samma
  // källa som redan fanns för den fria textens autokomplettering
  // (weaponSuggestions) — bara riktade om till en riktig dropdown.
  #weaponDocs = [];

  get title() {
    return this.isEditMode ? `Redigera: ${this.actor.name}` : "Ny rollperson";
  }

  stepIndex = 0;

  state = {
    kon: "man",
    niva: "vanlig",
    name: "",
    ageCategory: "Mogen",
    // null = inte köpt än; #ensureAttributesInitialized sätter baslinjen
    // (3, respektive rasens stoRange.normal) första gången rasen är känd.
    attributes: { sty: null, sto: null, fys: null, smi: null, int: null, psy: null, kar: null },
    raceUuid: null,
    professionUuid: null,
    // Vald magiskola (nyckel ur DODE.magicSchoolSkills) — materialiseras som en
    // vanlig `fardighet` vid skapandet, inte som ett eget fält på rollpersonen.
    magicSchoolKey: null,
    // Valda yrkesfärdigheter — RP s.11: spelaren väljer 12 av yrkets lista
    // (magiker 9). Varje post är { name, attribute, key, slotIndex }.
    // `slotIndex` !== null betyder att posten fyller en valfri plats
    // ("Maximalt fem valfria vapenfärdigheter"), annars är den en namngiven
    // färdighet ur listan.
    professionSkillPicks: [],
    // Vapenmästarens "(två)"-alternativ (KH s.8-9, professionSkills-entry
    // `dualWieldAlt`) — kryssrutan som expanderar en 1-vals-plats till 2 så
    // spelaren kan välja två vapenfärdigheter i kombination i stället för en.
    // Nycklas på slot-index eftersom fler än en profession skulle kunna få
    // flaggan i framtiden.
    dualWieldChecked: {},
    // BP-ledger — se klassdokblocket. spentSocialt/spentKapital lever INTE här —
    // de härleds från socialStanding.bpSpent/startCapital.bpSpent nedan (samma
    // enda-källa-princip som DataModellens prepareDerivedData använder).
    bp: { spentRas: 0, spentFormagor: 0, spentFardigheter: 0, spentAttribut: 0, spentSvardshand: 0 },
    // Hjältedåd (HH s.6-7) — bara hjälte-nivåer, inte "vanlig". EN TVÅSTEGS-
    // RAKET (Johan 2026-08-02): #onRollHjaltedadCount slår 1T6 och sätter
    // rollCount; #onRollHjaltedad slår sedan just så många 1T20 mot
    // DODE.hjaltedadTable in i `rolls`. bonusBP/bonusHjaltepoang är SUMMAN av
    // alla raderna, läggs på ovanpå de fasta 125 (se #bpLedger). `rolls` (med
    // full beskrivningstext per rad) är bara UI-detalj för DENNA session — det
    // som faktiskt persisteras på skapandet är bonusBP/bonusHjaltepoang HÄR,
    // plus en kopia av varje rad som en riktig specialAbilities-post i
    // hjaltedadAbilities nedan (så resultatet syns på rollformuläret i spel,
    // inte bara i guiden). ⚠ RÄTTAT 2026-08-02: hette tidigare `bonusHP` och
    // laddades felaktigt in i `system.hp.max` (kroppspoäng) — boktabellens
    // "HP" är HJÄLTEPOÄNG (H·jälte-P·oäng), en helt egen valuta som INTE
    // rör kroppspoäng, se `hjaltepoang`-fältets docblock i
    // actor-character.mjs för hela förklaringen.
    hjaltedad: { rollCount: 0, rolls: [], bonusBP: 0, bonusHjaltepoang: 0 },
    // Hjältedådens resultat speglade som specialAbilities-formade rader
    // ({name, source, description, slotId}) — HÅLLS ISÄR från
    // `specialAbilities` nedan (formagor-stegets fasta, nivåstyrda slots)
    // eftersom #specialAbilitySlots() annars skulle trunkera dem vid
    // nivåbyte. Byggs av #onRollHjaltedad; #loadStateFromActor läser tillbaka
    // tidigare sparade rader (source === DODE.hjaltedadAbilitySource) hit,
    // inte in i specialAbilities, så ett omslag i redigeringsläge inte äter
    // dem. Sparas som EXTRA specialAbilities-poster vid #onCreateCharacter/
    // #applyToActor (se dessa).
    hjaltedadAbilities: [],
    // Svärdshand — RP s.27, samma 2T6+BP-mekanik som socialt stånd på samma sida.
    swordHand: { roll: 0, bpSpent: 0, granted: false },
    socialStanding: { roll: 0, bpSpent: 0 },
    startCapital: { roll: 0, bpSpent: 0 },
    // EP-köp (Fas 7) — namn på färdighet → antal FV köpta UTÖVER baschansen (BC).
    // Bara den köpta delen lagras här; BC self räknas alltid om från effektiva
    // attribut i #skillPreview, så ett omkastat attributslag eller rasbyte
    // aldrig lämnar en färdighet med en stale bas-FV.
    fardigheter: {},
    // Modersmål (backlog, session 2026-08-06) — RP s.42/44, se DODE.raceMotherTongues.
    // `tala`/`lasaSkriva` är arrayer av VALDA språknycklar, index-parade mot
    // slotlistan `DODE.motherTongueSlots(raceDoc, kind)` — bara index vars slot
    // faktiskt ÄR ett val ("human" eller {choice}) har ett meningsfullt värde,
    // fasta slots (t.ex. Alvers "alviska") läses direkt ur slotlistan, sparas
    // inte här. Se #skillPreview för hur detta blir BC + visningsnamn.
    motherTongues: { tala: [], lasaSkriva: [] },
    // Särskilda förmågor (Fas 8, MVP) — fritext-slots, storleken styrs av
    // DODE.abilityRollsByNiva[niva] och synkas i #specialAbilitySlots() varje
    // render (inte här vid init) eftersom den beror på ett värde som kan ändras.
    specialAbilities: [],
    // Livsmål (Fas 9) — lifeGoal är dropdown-valet (en av DODE.lifeGoals),
    // lifeGoalCustom är fritext som skriver över det om ifyllt (se
    // #onCreateCharacter). Två separata fält istf att skriva fritext direkt i
    // samma fält som dropdownen, så ett tidigare listval inte tyst skrivs över
    // av ett tomt fritextfält (bara ifyllt fritext vinner, se villkoret nedan).
    lifeGoal: "",
    lifeGoalCustom: "",
    // Utrustning (Fas 9) — uuid → antal köpta. Bara den köpta mängden lagras;
    // pris/kapital räknas om varje render i #equipmentResult, samma
    // enda-källa-princip som resten av guiden.
    equipment: {}
  };

  /**
   * Slår upp alla dokument för en nyckel i CONFIG.DODE.contentPacks (t.ex.
   * "races"), sammanslaget över samtliga registrerade packs — så att en
   * kampanjmodul kan bidra med eget innehåll utan systemändring. Se
   * config.mjs's kommentar vid DODE.contentPacks och DESIGN_DECISIONS.md §7.5.
   *
   * Packs som saknas (avinstallerad modul) eller som den aktuella användaren
   * inte får läsa hoppas tyst över — ett dolt pack ska degradera guiden, inte
   * krascha den.
   */
  static async #resolveContentPacks(key) {
    const packIds = CONFIG.DODE.contentPacks?.[key] ?? [];
    const docs = [];
    for (const packId of packIds) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      if (!pack.testUserPermission(game.user, "OBSERVER")) continue;
      docs.push(...(await pack.getDocuments()));
    }
    return docs;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const steps = this.steps;
    const stepId = steps[this.stepIndex];

    const races = await DoDECharacterWizard.#resolveContentPacks("races");
    const professions = await DoDECharacterWizard.#resolveContentPacks("professions");
    // Utrustningssteget filtrerar dessutom bort allt som bär ActiveEffects —
    // se #resolveContentPacks och DESIGN_DECISIONS.md §7.5.
    const equipmentDocs = (await DoDECharacterWizard.#resolveContentPacks("startingEquipment"))
      .filter((doc) => doc.effects.size === 0);
    this.#weaponDocs = equipmentDocs.filter((d) => d.type === "vapen")
      .sort((a, b) => a.name.localeCompare(b.name, "sv"));

    // Redigeringsläge: koppla ihop embeddad ras/yrke med kompendiedokumentet
    // innan något annat räknas ut — annars beräknas baschansen utan rasbonus.
    this.#resolveMissingSources(races, professions);

    const selectedRace = this.state.raceUuid ? races.find((r) => r.uuid === this.state.raceUuid) : null;
    const selectedProfession = this.state.professionUuid
      ? professions.find((p) => p.uuid === this.state.professionUuid)
      : null;

    // Grundegenskaper KÖPS — RP s.23 (rättelse 2026-08-02, se config.mjs
    // DODE.attributeBuyCumulative). Sätter en engångsbaslinje (3, eller rasens
    // STO-normalvärde) första gången en ras är vald — precis som
    // #specialAbilitySlots() lazy-initierar sina tomma slots, INTE i den
    // statiska state-definitionen, eftersom STO-normalvärdet inte är känt
    // förrän rasen är vald. Måste ske FÖRE #effectiveAttributes nedan, annars
    // beräknas den första renderingen av attribut-steget mot null-värden.
    this.#ensureAttributesInitialized(selectedRace);
    const effectiveAttributes = this.#effectiveAttributes(selectedRace, this.state.ageCategory);
    // Redigeringsläge: färdighetsladdningen behöver BC, som i sin tur behöver
    // det uppslagna rasdokumentet — därför först här, inte i #loadStateFromActor.
    this.#loadBoughtSkillFv(effectiveAttributes);
    const requirementCheck = selectedProfession
      ? DoDECharacterWizard.#checkRequirements(selectedProfession.system.requirements, effectiveAttributes)
      : null;

    context.stepId = stepId;
    // 1-baserat i UI:t. Låg tidigare rått (0-baserat), vilket gav "Steg 0/15"
    // så fort översiktssidan lades till och var av-med-ett även innan dess.
    context.stepIndex = this.stepIndex;
    context.stepNumber = this.stepIndex + 1;
    context.stepCount = steps.length;
    context.stepLabel = STEP_LABELS[stepId];
    context.isFirstStep = this.stepIndex === 0;
    context.isLastStep = this.stepIndex === steps.length - 1;
    // Redigeringsläge: ras/yrke visas men går inte att byta (se klassdokblocket
    // och DESIGN_DECISIONS.md backlog 4c) — byte sker via drag-släpp på arket.
    context.isEditMode = this.isEditMode;
    context.showStart = stepId === "start";
    context.attributeBuy = this.#attributeBuyResult(selectedRace, effectiveAttributes);
    context.showKon = stepId === "kon";
    context.showNiva = stepId === "niva";
    context.showGrunder = stepId === "grunder";
    context.showRas = stepId === "ras";
    context.showAlder = stepId === "alder";
    context.showFardigheter = stepId === "fardigheter";
    context.showFormagor = stepId === "formagor";
    context.showLivsmal = stepId === "livsmal";
    context.showUtrustning = stepId === "utrustning";
    context.showAttribut = stepId === "attribut";
    context.showYrke = stepId === "yrke";
    context.showHand = stepId === "hand";
    context.showSocialt = stepId === "socialt";
    context.showKapital = stepId === "kapital";
    context.showSprak = stepId === "sprak";
    context.showGranska = stepId === "granska";
    context.showMagiskola = stepId === "magiskola";
    context.showYrkesfardigheter = stepId === "yrkesfardigheter";
    // Begränsa skolvalet till yrkets tillåtna skolor — paladinen får bara
    // Mentalism, utbygdsjägaren bara Animism. Tom lista = alla.
    const allowedSchools = this.#magicAccess?.schools ?? [];
    context.magicAccess = this.#magicAccess;
    context.magicSchools = CONFIG.DODE.magicSchoolSkills
      .filter((s) => !allowedSchools.length || allowedSchools.includes(s.school))
      .map((s) => ({
      key: s.key,
      label: game.i18n.localize(s.labelKey),
      img: s.img,
      selected: s.key === this.state.magicSchoolKey
    }));
    context.state = this.state;
    context.konOptions = KON_OPTIONS.map((option) => ({
      ...option,
      selected: option.value === this.state.kon
    }));
    // Husregeln (Johan 2026-08-06/07) ger varje hjälte-nivå en EGEN
    // slag-antal-formel i stället för det delade 1T6 (HH s.6-7) — nivåkorten
    // ska visa VILKEN formel som gäller för just DEN nivån innan man ens
    // valt, inte bara i detaljboxen efter valet (Johan: "under varje
    // hjälteikon hur många slag man får som text").
    const houseRuleOn = game.settings.get(game.system.id, "hjaltedadTieredRollCount");
    context.nivaOptions = NIVA_OPTIONS.map((option) => ({
      ...option,
      bp: CONFIG.DODE.bpByNiva[option.value],
      // Hjälte-nivåerna får också slå hjältedåd (HH s.6-7) för bonus-BP/KP
      // ovanpå den delade 125-basen — "vanlig" gör inte det, se #onRollHjaltedad.
      isHero: option.value !== "vanlig",
      hjaltedadFormula: option.value !== "vanlig"
        ? ((houseRuleOn && CONFIG.DODE.hjaltedadCountHouseRule[option.value]) || "1d6").replace(/d/gi, "T")
        : null,
      selected: option.value === this.state.niva
    }));
    context.selectedNivaOption = context.nivaOptions.find((option) => option.selected) ?? null;
    // Johans fynd #2 (2026-08-02): EP-budgeten vid start beror på nivå (INTE bara
    // ålder), men det syntes ingenstans i nivåstegets sammanfattning. Visar alla
    // fyra åldersrader för den VALDA nivån — ålder väljs först i ett senare steg,
    // så exakt EP är inte känt än, men skillnaden mellan nivåerna är det.
    context.epByAge = CONFIG.DODE.epBudgetTable[this.state.niva] ?? null;
    context.hjaltedad = this.state.hjaltedad;
    // Husregel-formeln (om påslagen och nivån har en, se
    // #onRollHjaltedadCount) — mallen ska ALDRIG hårdkoda "1T6" när en annan
    // formel faktiskt slås, annars ljuger stegets egen text mot chattkortet.
    // "d"→"T" bara för VISNING (Roll-formeln själv, skickad till `new Roll()`,
    // förblir oförändrad "1d2"-syntax i #onRollHjaltedadCount).
    const rawFormula = (game.settings.get(game.system.id, "hjaltedadTieredRollCount")
      && CONFIG.DODE.hjaltedadCountHouseRule[this.state.niva]) || "1d6";
    context.hjaltedadCountFormula = rawFormula.replace(/d/gi, "T");
    const socialResult = this.#socialStandingResult();
    const capitalResult = this.#startCapitalResult(socialResult);
    context.socialStanding = socialResult;
    // Referenstabell under socialt stånd-steget (Johan 2026-08-07: "borde ha
    // stödtabell under så man ser vad man kan få för val") — samma
    // "referens under valen"-mönster som svärdshandens 2T6-tabell och
    // språkstegets referenstabell. `min` härleds från föregående rads `max`,
    // eftersom DODE.socialStandingTable (config.mjs) bara lagrar övre gränsen.
    context.socialStandingTable = (() => {
      let min = 2;
      return CONFIG.DODE.socialStandingTable.map((row) => {
        const label = row.max === Infinity ? `≥${min}` : (min === row.max ? `${min}` : `${min}–${row.max}`);
        min = row.max + 1;
        return { range: label, rank: row.rank };
      });
    })();
    context.swordHand = this.#swordHandResult();
    context.swordHandOptions = CONFIG.DODE.swordHands;
    context.startCapital = capitalResult;
    // Hålls i synk vid varje render (inte bara vid sparning) så granska-stegets
    // BP-tabell visar rätt siffra direkt, samma skäl som #syncAttributeSpend.
    this.state.bp.spentSvardshand = this.#swordHandBpSpent();
    context.bp = this.#bpLedger(socialResult, capitalResult);
    const epBudget = this.#epResult(context.bp);
    context.races = races.map((r) => ({
      uuid: r.uuid, name: r.name, img: this.#genderedImg(r), system: r.system,
      // Gruppmarkör från kompendiet, se grupperingen nedan.
      raceGroup: r.getFlag(game.system.id, "raceGroup") ?? "",
      selected: r.uuid === this.state.raceUuid
    }));
    context.professions = professions.map((p) => ({
      uuid: p.uuid, name: p.name, img: this.#genderedImg(p), system: p.system, selected: p.uuid === this.state.professionUuid
    }));
    // Gruppering — utan den blir 13 ras- och 36 yrkeskort ett oöverblickbart
    // platt rutnät.
    //
    // ⚠ Grupptillhörighet läses ur en FLAGGA på kompendieitemet, inte ur namnet.
    // Ett första försök matchade på namn (/alv$/) och drog med "Halvalv" — som
    // är en grundras från RP, inte ett alvsläkte ur Alver-supplementet. Samma
    // lärdom som backlogpost 6a: namn är inte identitet. Flaggan gör dessutom
    // att en kampanjmodul kan lägga sina egna raser i rätt grupp.
    const isElfLineage = (r) => r.raceGroup === "alvslakte";
    // Progressiv visning (Johan 2026-08-02): en undergrupp (alvsläkten,
    // yrkesspecialiseringar) syns bara när dess FÖRÄLDER faktiskt är vald —
    // annars är 13 rasval och 36 yrkesval ett för stort första intryck. Vald
    // ras/yrke avslöjar sin grupp via `flags.<id>.revealsRaceGroup`/
    // `revealsProfessionGroup` (satt på Alv respektive Krigare/Tjuv/
    // Lönnmördare/Bard) — generellt på VÄRDET, inte hårdkodat mot "alv", så
    // ett framtida Svartfolk-baskön med `revealsRaceGroup: "svartfolk"`
    // slotar in utan kodändring här, bara nytt kompendieinnehåll.
    // ⚠ RÄTTAT 2026-08-02 (Johan): gruppen försvann så fort spelaren klickade
    // en SPECIFIK undergruppsmedlem (t.ex. Mörkeralv) i stället för bara
    // föräldern (Alv) — `selectedRace` blev då lineage-itemet, som inte SJÄLVT
    // bär `revealsRaceGroup`-flaggan (bara Alv gör det), så gruppen stängdes
    // mitt under valet. Faller nu tillbaka på det valda itemets EGEN
    // `raceGroup`-flagga (samma flagga som `isElfLineage` ovan läser) om det
    // inte är en avslöjare självt — en gruppmedlem håller alltså sin egen
    // grupp öppen, inte bara föräldern.
    const revealedRaceGroup = selectedRace?.getFlag(game.system.id, "revealsRaceGroup")
      ?? selectedRace?.getFlag(game.system.id, "raceGroup")
      ?? null;
    context.raceGroups = [
      { label: "Grundraser", races: context.races.filter((r) => !isElfLineage(r)) },
      { label: "Alvsläkten (Alver s.22)", races: context.races.filter(isElfLineage), group: "alvslakte" }
    ].filter((g) => g.races.length && (!g.group || g.group === revealedRaceGroup));
    // Samma rättelse som ovan, för yrkesspecialiseringar: en vald specialisering
    // (t.ex. Riddare) bär inte `revealsProfessionGroup` själv — bara basyrket
    // (Krigare) gör det — men BÄR sitt eget `system.baseProfession` ("krigare"),
    // som håller gruppen öppen på samma sätt.
    const revealedProfessionGroup = selectedProfession?.getFlag(game.system.id, "revealsProfessionGroup")
      ?? (selectedProfession?.system?.baseProfession || null);
    const PROFESSION_GROUPS = [
      ["", "Grundyrken"],
      ["krigare", "Krigarspecialiseringar (KH s.4-9)"],
      ["tjuv", "Tjuvspecialiseringar (T&L s.12-16)"],
      ["lonnmordare", "Lönnmördarspecialiseringar (T&L s.9-12)"],
      ["bard", "Bardspecialiseringar (T&L s.7-9)"]
    ];
    // Kravstatus per yrkeskort. Grundegenskaperna är köpta vid det här laget
    // (attribut-steget ligger före), så kontrollen är meningsfull.
    // ⚠ Ett omött krav SPÄRRAR inte valet, det märks bara upp. En snålt köpt
    // rollperson kan ändå landa på noll av de 36 yrkena — hård spärr hade låst
    // spelaren ute helt. Boken låter SL avgöra;
    // guiden visar tydligt vad som inte är uppfyllt och låter bordet bestämma.
    const reqFor = (p) => DoDECharacterWizard.#checkRequirements(
      p.system.requirements, effectiveAttributes);
    // ⚠ RÄTTAT 2026-08-02 (Johan: "10 av 36" visades trots att alla grund-
    // egenskaper var köpta till 18 — borde ha varit nära 36/36). `allGroups`
    // byggs HÄR, FÖRE den progressiva avslöjningsfiltreringen, och är källan
    // för `allProfessions`/`qualifiedCount`/`noProfessionQualifies` nedan.
    // `context.professionGroups` (kortrutnätet, filtrerat på
    // `revealedProfessionGroup`) är en SEPARAT, mindre lista för VAD SOM VISAS
    // — de två fick tidigare dela samma array, vilket gjorde att
    // täckningssiffran bara räknade de yrken som råkade vara synliga just då
    // (10, om bara Grundyrken var uppfällt) i stället för alla 36.
    const allGroups = PROFESSION_GROUPS.map(([base, label]) => ({
      label,
      base,
      professions: context.professions
        .filter((p) => (p.system.baseProfession ?? "") === base)
        .map((p) => {
          const check = reqFor(p);
          return { ...p, reqCheck: check, reqMet: check.allMet };
        })
    }));
    context.professionGroups = allGroups
      .filter((g) => g.professions.length && (!g.base || g.base === revealedProfessionGroup));
    // Kan spelaren över huvud taget kvalificera sig för NÅGOT yrke? Med köpta
    // grundegenskaper är svaret spelarens eget val snarare än otur, men en
    // för snålt köpt rollperson kan ändå landa här — #onRestartAttributes
    // erbjuds ovillkorligt (inget SL-inställning-villkor längre, se
    // dode.mjs — allowRestartIfUnqualified retirerades 2026-08-02).
    const allProfessions = allGroups.flatMap((g) => g.professions);
    context.attributesRolled = Object.values(this.state.attributes).every((v) => v !== null);
    context.noProfessionQualifies = context.attributesRolled
      && allProfessions.length > 0
      && !allProfessions.some((p) => p.reqMet);
    context.qualifiedCount = allProfessions.filter((p) => p.reqMet).length;
    // Speglas till ett fält eftersom `steps` (som avgör om magiskolesteget
    // visas) är en synkron getter utan tillgång till de async-uppslagna yrkena.
    this.#selectedProfessionName = selectedProfession?.name ?? "";
    this.#selectedProfessionDoc = selectedProfession ?? null;
    context.professionSkillState = selectedProfession ? this.#professionSkillState() : null;
    // Förslagslista till förmågevalens "valfri sekundär färdighet"-inputs
    // (backlogpost 7/36) — samma "fritext, listan är bara hjälp"-princip.
    context.secondarySkillSuggestions = CONFIG.DODE.secondarySkills.map((s) => s.name).sort();
    // Johan, 2026-08-16: sourcade hantverksexempel (äventyr/världsböcker) för
    // hantverksfältets datalist — se CONFIG.DODE.craftSuggestions för källor.
    context.craftSuggestions = CONFIG.DODE.craftSuggestions;
    context.selectedRace = selectedRace;
    this.#selectedRaceDoc = selectedRace ?? null;
    context.selectedProfession = selectedProfession;
    // Ras-/yrkesramverket (2026-08-16): visar den SAMMANSLAGNA listan (bas-
    // yrkets egna rader + specialiseringens egna) i stället för bara den
    // valda posten egna `system.professionAbilities` — annars skulle t.ex.
    // Krigarmunk aldrig visa Krigarens "+5 på initiativ" i guidens detaljkort.
    context.selectedProfessionAbilityRows = resolveProfessionAbilityRows(selectedProfession, professions);
    context.selectedRaceAbilityRows = resolveRaceAbilityRows(selectedRace);
    context.ageCategories = AGE_CATEGORIES.map((c) => ({ value: c, selected: c === this.state.ageCategory }));
    context.attributes = CONFIG.DODE.attributes;
    context.effectiveAttributes = effectiveAttributes;
    context.requirementCheck = requirementCheck;
    context.motherTongue = this.#motherTongueResult(selectedRace, socialResult, effectiveAttributes);
    // Referenstabell för språksteget (Johan 2026-08-07: "spelarna [ska]
    // förstå vad de väljer och varför") — samma "referens under valen"-mönster
    // som attributstegets grupptabell (backlog 35).
    context.languages = CONFIG.DODE.languages;
    const skillPreview = this.#skillPreview(effectiveAttributes, selectedProfession, epBudget, selectedRace);
    context.skillPreview = skillPreview;
    context.ep = {
      max: epBudget.max,
      maxStartFv: epBudget.maxStartFv,
      spent: skillPreview.epSpent,
      remaining: skillPreview.epRemaining
    };
    context.abilitySlots = CONFIG.DODE.abilityRollsByNiva[this.state.niva] ?? 1;
    // needsChoiceCount/choiceRows läggs på ovanpå rå-sloten (index bevarad,
    // så data-ability-*-index i mallen fortfarande pekar rätt i state) — se
    // needsChoice/choiceCount i special-ability-effects.mjs.
    context.specialAbilities = this.#specialAbilitySlots().map((slot) => {
      const choicePool = slot.effect?.pool === "hantverk" ? "hantverk" : (slot.effect?.pool ?? "");
      // Johan, 2026-08-16: "särkilda förmågot langauge should have language
      // selction" — samma fritext-mot-datalist-problem som vapenvalet redan
      // hade (backlog 66/67). Effekten (grantSecondary→addChosen) var redan
      // riktigt kopplad och skapar en verklig FV20-färdighet — det var bara
      // INMATNINGEN som var fritext, med risk att spelarens stavning
      // ("Alvspråk") inte matchar katalogens riktiga namn ("Alviska").
      const languageOptions = choicePool === "sprak"
        ? CONFIG.DODE.languages.map((l) => ({ value: l.name, label: l.name }))
        : null;
      return {
        ...slot,
        needsChoiceCount: needsChoice(slot.effect) ? choiceCount(slot.effect) : 0,
        choiceRows: needsChoice(slot.effect)
          ? Array.from({ length: choiceCount(slot.effect) }, (_, i) => ({
              row: i, value: slot.effectChoices?.[i] ?? "",
              languageOptions: languageOptions?.map((opt) => ({ ...opt, selected: opt.value === slot.effectChoices?.[i] }))
            }))
          : [],
        choicePool
      };
    });
    context.specialAbilityNames = context.specialAbilities
      .map((a) => a.name.trim())
      .filter((name) => name.length > 0)
      .join(", ");
    context.lifeGoalOptions = CONFIG.DODE.lifeGoals.map((goal) => ({ value: goal.name, selected: goal.name === this.state.lifeGoal }));
    // Referenstabell under valet (Johan, 2026-08-16: "livsmål probably need
    // to have a sub table explaining the contents, otherwise its hard to
    // understand") — samma mönster som språkstegets redan existerande
    // beskrivningstabell (backlog 64).
    context.lifeGoalTable = CONFIG.DODE.lifeGoals;
    context.finalLifeGoal = this.state.lifeGoalCustom.trim() || this.state.lifeGoal;
    context.equipmentResult = this.#equipmentResult(equipmentDocs, capitalResult);
    context.canAdvance = this.#canAdvance(stepId);
    return context;
  }

  /**
   * Väljer ras/yrke-dokumentets porträttbild utifrån valt kön (steg 1).
   * `imgMan`/`imgKvinna` är valfria fält på item-ras.mjs/item-yrke.mjs — saknas
   * de (tomt fält) faller vi tillbaka på itemets vanliga `img`, inte ett kraschande
   * hål i UI:t.
   */
  #genderedImg(doc) {
    const variant = this.state.kon === "kvinna" ? doc.system?.imgKvinna : doc.system?.imgMan;
    return variant || doc.img;
  }

  /**
   * Rasens top-down-token (assets/tokens/raser-topdown/, se docs/dev/ART_STYLE.md
   * "Rastoken") — äkta fågelperspektiv-konst för `prototypeToken.texture.src`,
   * separat från porträttet `#genderedImg` väljer till `img`. Slug byggs med
   * samma DODE.skillKey-mönster som övriga tokenmappar, inte ett eget fält på
   * rasdokumentet — filnamnen sattes upp 2026-08-03 för alla 13 raser.
   */
  #genderedTopdownImg(raceDoc) {
    if (!raceDoc?.name) return null;
    const slug = CONFIG.DODE.skillKey(raceDoc.name);
    const variant = this.state.kon === "kvinna" ? "kvinna" : "man";
    return `systems/${game.system.id}/assets/tokens/raser-topdown/${slug}-${variant}.png`;
  }

  /**
   * Fyller `state` från en befintlig rollperson (redigeringsläge). Motsatsen
   * till #onCreateCharacter — allt som skrivs där måste kunna läsas tillbaka
   * här, annars nollställs fältet tyst vid nästa sparning.
   *
   * ⚠ Utrustning laddas medvetet INTE (steget hoppas över, se
   * EDIT_MODE_SKIPPED_STEPS). `state.equipment` förblir tomt, och
   * #applyToActor rör aldrig aktörens föremål.
   */
  #loadStateFromActor(actor) {
    const sys = actor.system;
    this.state.name = actor.name ?? "";
    this.state.kon = sys.kon ?? "man";
    this.state.niva = sys.niva ?? "vanlig";
    this.state.ageCategory = sys.alder || "Mogen";
    this.state.lifeGoal = sys.lifeGoal ?? "";
    this.state.lifeGoalCustom = "";
    for (const key of Object.keys(this.state.attributes)) {
      // BAS-värdet, inte total — guiden lägger själv på ras-/åldersmod i sin
      // förhandsvisning (#effectiveAttributes). Att läsa `total` här skulle
      // baka in bonusen i basen och dubbla den vid varje sparning.
      this.state.attributes[key] = sys.attributes?.[key]?.value ?? null;
    }
    // Svärdshanden lagras bara som resultatet på aktören, inte som slag+insats —
    // vid redigering läses den därför tillbaka som en "given" hand, så guiden
    // inte ber om ett omslag av något som redan är bestämt.
    this.state.swordHand = { roll: 0, bpSpent: 0, granted: sys.swordHand ?? "hoger" };
    this.state.socialStanding = { roll: sys.socialStanding?.roll ?? 0, bpSpent: sys.socialStanding?.bpSpent ?? 0 };
    // ⚠ Modersmålsvalet läses INTE tillbaka — vilket språk som valdes finns
    // bara som fritext i den skapade `fardighet`-postens NAMN (t.ex. "Tala
    // modersmål (Västjori)"), inte som ett eget strukturerat fält, så det går
    // inte att tillförlitligt parsa tillbaka. Ett omslag i redigeringsläge
    // visar språksteget tomt igen — spelaren väljer om, `#applyToActor`s
    // befintliga namn-/nyckelmatchning uppdaterar samma färdighetspost i
    // stället för att skapa en dubblett (den matchar på `skillKey`, som är
    // oförändrat "tala-modersmal"/"lasa-skriva-modersmal" oavsett språk).
    this.state.motherTongues = { tala: [], lasaSkriva: [] };
    this.state.startCapital = { roll: sys.startCapital?.roll ?? 0, bpSpent: sys.startCapital?.bpSpent ?? 0 };
    this.state.bp = {
      spentRas: sys.bp?.spentRas ?? 0,
      spentFormagor: sys.bp?.spentFormagor ?? 0,
      spentFardigheter: sys.bp?.spentFardigheter ?? 0,
      spentAttribut: sys.bp?.spentAttribut ?? 0,
      spentSvardshand: sys.bp?.spentSvardshand ?? 0,
      bonusHjaltedad: sys.bp?.bonusHjaltedad ?? 0
    };
    // Bara AGGREGATEN läses tillbaka (bonusBP/bonusHjaltepoang), inte
    // radhistoriken — samma "aggregat, inte historik"-princip som spentRas
    // m.fl. En omslagen hjältedåd-lista finns inte att återskapa, bara
    // slutsumman. `sys.hjaltepoang` (inte `sys.hp.bonusHjaltedad`, se ⚠ i
    // actor-character.mjs) är den sparade hjältepoäng-poolen.
    this.state.hjaltedad = {
      rollCount: 0, rolls: [],
      bonusBP: sys.bp?.bonusHjaltedad ?? 0,
      bonusHjaltepoang: sys.hjaltepoang ?? 0
    };
    // Hjältedåd-rader (source === DODE.hjaltedadAbilitySource) hålls ISÄR
    // från de vanliga formagor-slotsen nedan — de läses tillbaka rakt av,
    // OFÖRÄNDRADE (slotId bevarad), så #specialAbilitySlots() aldrig ser dem
    // och riskerar trunkera dem vid ett nivåbyte i redigeringsläge. Se
    // state-fältets docblock ovan.
    const allAbilities = sys.specialAbilities ?? [];
    this.state.hjaltedadAbilities = allAbilities
      .filter((a) => a.source === CONFIG.DODE.hjaltedadAbilitySource)
      .map((a) => ({
        name: a.name ?? "", source: a.source, description: a.description ?? "",
        slotId: a.slotId || foundry.utils.randomID()
      }));
    // ⚠ `slotId` läses tillbaka rakt av (aldrig ny) — se schemakommentaren i
    // actor-character.mjs. Ett nytt id här skulle göra en befintlig formaga-
    // post föräldralös och skapa en dubblett vid nästa #applyToActor.
    // `effect` läses INTE tillbaka (den avgörs av namnet/tabellslaget, inte
    // lagrad på specialAbilities) — ett omslag i redigeringsläge sätter det
    // på nytt via #onRollFormaga; tills dess visas raden utan känd effekt.
    this.state.specialAbilities = allAbilities
      .filter((a) => a.source !== CONFIG.DODE.hjaltedadAbilitySource)
      .map((a) => ({
      name: a.name ?? "", source: a.source ?? "", description: a.description ?? "",
      bpSpent: 1, rollResult: null, slotId: a.slotId || foundry.utils.randomID(),
      effect: null, effectChoices: []
    }));

    // Ras/yrke: vi sätter en egen `flags.<sysid>.sourceUuid` när items skapas
    // (se #onCreateCharacter). ⚠ `_stats.compendiumSource` DUGER INTE ensamt —
    // Foundry fyller det bara vid riktig kompendieimport, inte när vi skapar ur
    // `toObject()`, så det är `null` på allt guiden själv byggt. Det ledde till
    // att redigeringsläget tappade ras/yrke helt (och därmed räknade baschansen
    // utan rasbonus). Sista utvägen är namnmatchning mot registret, vilket görs
    // asynkront i _prepareContext eftersom det kräver uppslagna packs.
    const raceItem = actor.items.find((i) => i.type === "ras");
    const yrkeItem = actor.items.find((i) => i.type === "yrke");
    this.state.raceUuid = raceItem?.getFlag(game.system.id, "sourceUuid")
      ?? raceItem?._stats?.compendiumSource ?? null;
    this.state.professionUuid = yrkeItem?.getFlag(game.system.id, "sourceUuid")
      ?? yrkeItem?._stats?.compendiumSource ?? null;
    this.#pendingSourceResolve = {
      race: this.state.raceUuid ? null : raceItem?.name ?? null,
      profession: this.state.professionUuid ? null : yrkeItem?.name ?? null
    };

    // Färdigheter: `state.fardigheter[namn]` är antal FV KÖPTA ÖVER baschansen.
    // Vi känner inte BC förrän attribut/ras är kända, så räkna om det här på
    // samma sätt som #skillPreview gör, och klampa till >= 0 (BC kan ha stigit
    // sedan skapandet, t.ex. via en rasändring på arket).
    this.state.fardigheter = {};
    this.#pendingSkillLoad = true;
  }

  /**
   * Andra halvan av färdighetsladdningen — kan först köras när ras-dokumentet
   * är uppslaget (async) och BC därmed går att räkna ut. Anropas från
   * _prepareContext första gången redigeringsläget renderas.
   */
  #loadBoughtSkillFv(effectiveAttributes) {
    if (!this.#pendingSkillLoad || !this.actor) return;
    const bc = (attribute) => {
      const total = effectiveAttributes[attribute]?.total;
      return total == null ? 0 : CONFIG.DODE.attributeToGroup(total);
    };
    for (const item of this.actor.items) {
      if (item.type !== "fardighet") continue;
      // Bara guidens egna kategorier laddas — "sekundar" (tillagda i spel,
      // via färdighetsväljaren eller av SL) ligger utanför guidens steg och
      // ska varken visas eller skrivas över. Se reconciliation-regeln i
      // DESIGN_DECISIONS.md backlog 4c.
      if (item.system.costTier === "sekundar") continue;
      // Magiskolan är en färdighet som skapades av magiskolesteget, inte av
      // #skillPreview — läs tillbaka valet så att steget visar rätt skola i
      // redigeringsläge, och hoppa över den i FV-laddningen nedan (den ingår
      // inte i skillPreview och skulle annars aldrig matcha).
      const schoolHit = CONFIG.DODE.magicSchoolSkills.find((s) => s.key === item.system.skillKey);
      if (schoolHit) {
        this.state.magicSchoolKey = schoolHit.key;
        continue;
      }
      const baseFv = bc(item.system.attribute);
      // Nyckel, inte namn (backlogpost 6a). Äldre färdigheter saknar
      // `skillKey` — härled den ur namnet så att de fortfarande matchar.
      const key = item.system.skillKey || CONFIG.DODE.skillKey(item.name);
      this.state.fardigheter[key] = Math.max(0, (item.system.fv ?? 0) - baseFv);
      // Redigeringsläge: återskapa yrkesfärdighetsvalen ur rollpersonens
      // befintliga färdigheter. Utan detta skulle steget öppnas tomt och
      // #skillPreview räkna om rollpersonen UTAN sina yrkesfärdigheter.
      // `slotIndex` sätts från yrkets lista när namnet inte är en namngiven
      // post — då fyllde färdigheten en valfri plats.
      if (item.system.costTier === "yrkesfardighet") {
        const list = this.#selectedProfessionDoc?.system?.professionSkills ?? [];
        const namedHit = list.findIndex(
          (e) => !e.choiceCount && (e.key || CONFIG.DODE.skillKey(e.name)) === key);
        const slot = namedHit >= 0 ? null : list.findIndex((e) => e.choiceCount);
        this.state.professionSkillPicks.push({
          key, name: item.name, attribute: item.system.attribute,
          weaponGroup: item.system.weaponGroup || "",
          slotIndex: namedHit >= 0 ? null : (slot >= 0 ? slot : null)
        });
      }
    }
    // Vapenmästarens "(två)"-kryssruta (dualWieldAlt) återskapas från VERKLIGA
    // val, inte ett eget sparat fält — om ett slot redan har fler val än sin
    // grundläggande choiceCount måste kryssrutan ha varit ikryssad när
    // rollpersonen sparades, annars hade #professionSkillState() aldrig gett
    // plats för det andra valet. Utan detta hade en redigeringsomgång öppnat
    // steget med kryssrutan tom trots att TVÅ vapenval redan finns sparade.
    const list = this.#selectedProfessionDoc?.system?.professionSkills ?? [];
    list.forEach((entry, i) => {
      if (!entry.dualWieldAlt) return;
      const count = this.state.professionSkillPicks.filter((p) => p.slotIndex === i).length;
      if (count > (entry.choiceCount || 1)) this.state.dualWieldChecked[i] = true;
    });
    this.#pendingSkillLoad = false;
  }

  #pendingSkillLoad = false;
  #pendingSourceResolve = null;

  /**
   * Sista utvägen för att koppla en redan embeddad ras/yrke till sitt
   * kompendiedokument: matcha på namn. Körs bara när varken vår egen
   * `sourceUuid`-flagga eller `_stats.compendiumSource` finns — alltså för
   * rollpersoner skapade innan flaggan infördes.
   */
  #resolveMissingSources(races, professions) {
    if (!this.#pendingSourceResolve) return;
    const { race, profession } = this.#pendingSourceResolve;
    if (race && !this.state.raceUuid) {
      this.state.raceUuid = races.find((r) => r.name === race)?.uuid ?? null;
    }
    if (profession && !this.state.professionUuid) {
      this.state.professionUuid = professions.find((p) => p.name === profession)?.uuid ?? null;
    }
    this.#pendingSourceResolve = null;
  }

  /**
   * Standardvärden för rollpersonens porträtt + prototyptoken. Guiden satte
   * tidigare varken `img` eller `prototypeToken` alls, så varje skapad
   * rollperson fick Foundrys grå standardikon och en olänkad token utan syn.
   *
   * `actorLink: true` är det viktigaste fältet: för spelarrollpersoner ska
   * token och ark vara samma dokument, annars blir varje utplacerad token en
   * fristående kopia vars KP-ändringar inte syns på arket.
   *
   * bar1/bar2 sätts INTE här — de ärver `primaryTokenAttribute`/
   * `secondaryTokenAttribute` från system.json (hp respektive resources.psy),
   * vilket gäller alla aktörer och inte bara guidens.
   *
   * Porträttet ärvs från ras-/yrkesbilden (könsvarianten, se #genderedImg) —
   * yrket först eftersom det är mer utmärkande än rasen. Tokenbilden på
   * spelbrädet (`prototypeToken.texture.src`) är separat: äkta top-down-konst
   * per ras (#genderedTopdownImg), inte samma porträtt beskuret till en cirkel.
   * Faller tillbaka till porträttet om rasen saknas (professionsval utan ras
   * ska inte ge en trasig sökväg).
   */
  #tokenDefaults(raceDoc, professionDoc) {
    const portrait = professionDoc
      ? this.#genderedImg(professionDoc)
      : raceDoc
        ? this.#genderedImg(raceDoc)
        : null;
    const tokenImg = (raceDoc ? this.#genderedTopdownImg(raceDoc) : null) || portrait;
    const name = this.state.name || "Ny rollperson";
    const prototypeToken = {
      name,
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      sight: { enabled: true }
    };
    if (tokenImg) prototypeToken.texture = { src: tokenImg };
    return { img: portrait, prototypeToken };
  }

  /**
   * BP-pool efter vald nivå (KH s.3) minus det som spenderats hittills i guiden.
   * spentSocialt/spentKapital hämtas från socialStanding/startCapital-resultaten
   * (inte från state.bp) — samma enda-källa-princip som DataModellen använder.
   */
  #bpLedger(socialResult, capitalResult) {
    const spent = this.state.bp;
    // Hjältedåd (HH s.6-7) lägger BONUS-BP ovanpå den vanliga 125-poolen för
    // hjälte-nivåerna — se #onRollHjaltedad. 0 för "vanlig" och för hjälte-
    // nivåer som inte slagit än.
    const start = (CONFIG.DODE.bpByNiva[this.state.niva] ?? CONFIG.DODE.bpByNiva.vanlig)
      + (this.state.hjaltedad?.bonusBP ?? 0);
    const handBp = this.#swordHandBpSpent();
    const total = spent.spentRas + spent.spentFormagor + socialResult.bpSpent + capitalResult.bpSpent
      + spent.spentFardigheter + spent.spentAttribut + handBp;
    return { start, spent: total, remaining: start - total };
  }

  /**
   * Svärdshandens BP-insats (RP s.27) — INTE lagrad direkt i `state.bp`, den
   * härleds från `state.swordHand` av samma "enda källa"-skäl som
   * spentSocialt/spentKapital på DataModellen. Delad mellan #bpLedger (live
   * summa i guiden) och #applyToActor/#onCreateCharacter (persisterad summa
   * på aktören, `bp.spentSvardshand`) så de två aldrig kan komma i otakt.
   */
  #swordHandBpSpent() {
    return this.state.swordHand.granted ? 0 : (Number(this.state.swordHand.bpSpent) || 0);
  }

  /**
   * EP-budget — RP s.28/KH s.3: nivå×ålder-tabell + kvarvarande BP × 5.
   * `maxStartFv` (KH s.3) är en ren tabellslagning, ingen persisterad ingång.
   * Speglar actor-character.mjs.
   */
  #epResult(bpLedger) {
    const budget = CONFIG.DODE.epBudgetTable[this.state.niva]?.[this.state.ageCategory] ?? 0;
    const max = budget + Math.max(0, bpLedger.remaining) * 5;
    const maxStartFv = CONFIG.DODE.maxStartFvTable[this.state.niva]?.[this.state.ageCategory] ?? null;
    return { max, maxStartFv };
  }

  /**
   * Svärdshand — RP s.27: 2T6 + spenderade BP → Höger/Vänster/Dubbelhänt/Ambidextriös.
   * ⚠ Fåtts handen som särskild förmåga slås inget alls.
   */
  #swordHandResult() {
    const { roll, bpSpent, granted } = this.state.swordHand;
    if (granted) {
      return { granted, key: granted, label: CONFIG.DODE.swordHands[granted],
        total: null, roll: 0, bpSpent: 0, noOffHandPenalty: CONFIG.DODE.hasNoOffHandPenalty(granted) };
    }
    const total = roll > 0 ? roll + (Number(bpSpent) || 0) : 0;
    const row = total > 0 ? CONFIG.DODE.swordHandFromRoll(total) : null;
    return {
      granted: false, roll, bpSpent: Number(bpSpent) || 0, total,
      key: row?.key ?? null, label: row?.label ?? null,
      noOffHandPenalty: row ? CONFIG.DODE.hasNoOffHandPenalty(row.key) : false
    };
  }

  /** Socialt stånd — RP s.27: 2T6 + spenderade BP. Speglar actor-character.mjs. */
  #socialStandingResult() {
    const { roll, bpSpent } = this.state.socialStanding;
    const total = roll > 0 ? roll + bpSpent : 0;
    const rank = roll > 0 ? CONFIG.DODE.socialStandingRank(total) : "";
    return { roll, bpSpent, total, rank };
  }

  /**
   * Startkapital — RP s.27-28: 2T6 + BP + halva socialt-stånd-BP:et, takat vid
   * (socialt ståndets slutsumma + 10), sedan multiplicerat med åldersmultiplikatorn
   * (RP s.28, känd tabell). Speglar actor-character.mjs.
   */
  #startCapitalResult(socialResult) {
    const { roll, bpSpent } = this.state.startCapital;
    const halfSocialBp = Math.ceil(socialResult.bpSpent / 2);
    const cap = socialResult.total + 10;
    const total = roll > 0 ? Math.min(roll + bpSpent + halfSocialBp, cap) : 0;
    const baseSm = roll > 0 ? CONFIG.DODE.startCapitalLookup(total) : 0;
    const capitalMultiplier = CONFIG.DODE.ageCapitalMultiplier[this.state.ageCategory] ?? 1;
    const finalSm = roll > 0 ? Math.round(baseSm * capitalMultiplier) : 0;
    return { roll, bpSpent, halfSocialBp, cap, total, baseSm, capitalMultiplier, finalSm };
  }

  /**
   * Beräknar attribut inkl. ras- och åldersmodifikation, för förhandsvisning
   * under guiden. `ageMod` blir 0 för alla åldrar tills DODE.ageAttributeModifiers
   * fylls i (forskningslucka, RP s.24-25) — se klassdokblocket.
   */
  #effectiveAttributes(selectedRace, ageCategory) {
    const raceMods = selectedRace?.system?.attributeMods ?? {};
    const ageMods = CONFIG.DODE.ageAttributeModifiers[ageCategory] ?? {};
    const result = {};
    for (const [key, value] of Object.entries(this.state.attributes)) {
      // STO: rasmoden är intervall-baserad (aldrig additiv), men åldersmoden appliceras.
      const raceMod = key === "sto" ? 0 : (raceMods[key] ?? 0);
      const ageMod = ageMods[key] ?? 0;
      const mod = raceMod + ageMod;
      const modParts = [];
      if (raceMod) modParts.push(`${raceMod} ras`);
      if (ageMod) modParts.push(`${ageMod} ålder`);
      result[key] = {
        base: value,
        raceMod,
        ageMod,
        mod,
        modLabel: modParts.join(" + "),
        total: value === null ? null : value + mod
      };
    }
    return result;
  }

  /**
   * Modersmål-stegets data — RP s.42/44, DODE.raceMotherTongues (config.mjs).
   * Bygger en rad per SLOT för Tala/Läsa-Skriva, oavsett om slotten är fast
   * (t.ex. Alvers "alviska") eller ett val ("human"/{choice}) — mallen visar
   * fasta rader som ren text och valrader som en `<select>`.
   *
   * Visar också en förhandsvisning av det resulterande FV:t (BC, se
   * DODE.motherTongueTalaBc/motherTongueLasaSkrivaBc) så spelaren ser vad
   * socialt stånd + INT faktiskt gav INNAN färdighetssteget — annars dyker
   * talet bara upp senare utan förklaring.
   */
  #motherTongueResult(raceDoc, socialResult, effectiveAttributes) {
    const bucket = CONFIG.DODE.languageSocialBucket(socialResult?.rank ?? "");
    const intTotal = effectiveAttributes?.int?.total ?? 0;
    const buildKind = (kind, bc) => {
      const slots = CONFIG.DODE.motherTongueSlots(raceDoc, kind);
      const chosen = this.state.motherTongues[kind];
      const rows = slots.map((slot, index) => {
        const options = CONFIG.DODE.motherTongueSlotOptions(slot);
        if (!options) return { index, fixed: true, label: CONFIG.DODE.languageName(slot), selectedKey: slot };
        const selectedKey = chosen[index] ?? "";
        return {
          index, fixed: false, selectedKey,
          options: options.map((o) => ({ key: o.key, name: o.name, selected: o.key === selectedKey }))
        };
      });
      const complete = rows.every((r) => r.fixed || r.selectedKey);
      return { kind, bc, rows, complete };
    };
    const tala = buildKind("tala", CONFIG.DODE.motherTongueTalaBc(bucket));
    const lasaSkriva = buildKind("lasaSkriva", CONFIG.DODE.motherTongueLasaSkrivaBc(bucket, intTotal));
    return { tala, lasaSkriva, complete: tala.complete && lasaSkriva.complete };
  }

  /**
   * Auto-tilldelade färdigheter — PLAN_WIZARD_V2.md Fas 6: de 16 primära
   * färdigheterna (RP s.36, DODE.primarySkills) + yrkets `professionSkills`
   * (item-yrke.mjs, se dess schemakommentar för forskningsluckan där inte alla
   * "tillåtna" färdigheter finns med). Bas-FV = BC = grupp av grundegenskapen
   * (REGLER_EGENSKAPER.md) — samma `DODE.attributeToGroup` som DataModellens
   * egna attributberäkning använder. Yrkesfärdigheter som redan är primära
   * hoppas över (annars skulle samma färdighetsnamn skapas två gånger på
   * samma rollperson) — filtrerat på namn, skiftlägesokänsligt.
   *
   * EP-köp (Fas 7): `state.fardigheter[namn]` är antal FV köpta UTÖVER BC.
   * Kostnaden att nå aktuell FV från BC räknas med `DODE.skillCost` (RP s.30,
   * kumulativ tabell — INTE grundkostnad × antal steg rakt av). `epSpent`
   * summeras över ALLA färdigheter samtidigt (delad EP-pool), så
   * `canIncrease` för en enskild färdighet alltid speglar den verkliga
   * kvarvarande poolen efter allt annat som redan köpts, inte en lokal
   * per-färdighet-budget.
   *
   * ⚠ **`tala-modersmal`/`lasa-skriva-modersmal` är ett SÄRFALL** — RP s.42/44
   * ger dem ett fast BC ur socialt stånd (× INT för Läsa/Skriva), INTE
   * `attributeToGroup(INT)` som alla andra INT-baserade färdigheter. Ett
   * tidigare fel (upptäckt 2026-08-05, fixat 2026-08-06) räknade dem som
   * vilken primärfärdighet som helst. `raceDoc` behövs bara för de här två —
   * övriga färdigheter är opåverkade.
   */
  #skillPreview(effectiveAttributes, selectedProfession, epBudget, raceDoc = null) {
    const bc = (attribute) => {
      const total = effectiveAttributes[attribute]?.total;
      return total == null ? 0 : CONFIG.DODE.attributeToGroup(total);
    };
    const socialRank = this.#socialStandingResult().rank;
    const socialBucket = CONFIG.DODE.languageSocialBucket(socialRank);
    const intTotal = effectiveAttributes?.int?.total ?? 0;
    const motherTongueBc = {
      "tala-modersmal": CONFIG.DODE.motherTongueTalaBc(socialBucket),
      "lasa-skriva-modersmal": CONFIG.DODE.motherTongueLasaSkrivaBc(socialBucket, intTotal)
    };
    // Visningsnamn utökas med de FAKTISKT valda/beviljade språken, t.ex.
    // "Tala modersmål (Dvärgiska, Kaseni)" — se DODE.motherTongueSlots.
    // ⚠ Tar skillKEY ("tala-modersmal"), översätter till slot-KIND ("tala")
    // EN gång här — DODE.motherTongueSlots vill ha "tala"/"lasaSkriva", inte
    // skillKey. En tidigare bugg skickade skillKey rakt in i den funktionen,
    // vilket alltid missade (den okända kinden föll tyst tillbaka på ["human"]),
    // så inget språknamn någonsin visades. Hittat i liveverifiering 2026-08-06.
    const motherTongueLabel = (skillKey) => {
      const kind = skillKey === "tala-modersmal" ? "tala" : "lasaSkriva";
      const slots = CONFIG.DODE.motherTongueSlots(raceDoc, kind);
      const chosen = this.state.motherTongues[kind];
      const names = slots.map((slot, index) => {
        const isChoice = CONFIG.DODE.motherTongueSlotOptions(slot) !== null;
        const key = isChoice ? chosen[index] : slot;
        return key ? CONFIG.DODE.languageName(key) : null;
      }).filter(Boolean);
      return names.join(", ");
    };
    // ⚠ All matchning går på `skillKey`, aldrig på visningsnamnet — se
    // DODE.skillKey i config.mjs och backlogpost 6a. Yrkens `professionSkills`
    // (kompendiedata) saknar ännu explicita nycklar, så de härleds ur namnet;
    // konfigtabellernas nycklar är däremot frysta och överlever en omdöpning.
    // Yrkets automatiska GOLV på en primär/namngiven färdighet (item-yrke.mjs
    // `skillFloors`, t.ex. Prisjägarens "automatiskt minst CL 17 i Upptäcka
    // fara", KH s.6-7) — tidigare bara professionAbility-prosa, aldrig
    // maskinläst. Gratis, precis som BC — höjer bara baseFv, kostar inget EP.
    const skillFloors = new Map(
      (selectedProfession?.system?.skillFloors ?? []).map((f) => [f.key, f.minFv])
    );
    // Katalog-nivå grundkostnadsöverskrivning (Vapentekniker/Stridskonster,
    // Vapenmästarens/Krigarmunkens halva pris) fanns tidigare bara i
    // training.mjs (post-skapande) — aldrig i guidens egen kostnadsförhands-
    // visning, eftersom Vapentekniker aldrig var wizard-integrerat. Nu när
    // Stridskonster ÄR det (backlog 71/72, `choicePool: "stridskonst"`)
    // måste guiden visa samma korrekta grundkostnad, annars visar den fel
    // EP-pris (den platta yrkesfärdighet-basen) för en teknik som i själva
    // verket kostar 0,5-2 EP. `selectedProfession` finns redan i scope här
    // (används av skillFloors ovan) — bygger en minimal shim istället för
    // att ändra secondarySkillBaseOverrideFor-signaturen, som annars är
    // gjord för en RIKTIG Actor-dokument.
    const professionNameShim = { system: { profession: { name: selectedProfession?.name } } };
    const buildEntry = (key, name, attribute, costTier, weaponGroup = "") => {
      let baseFv = bc(attribute);
      let displayName = name;
      if (key in motherTongueBc) {
        baseFv = motherTongueBc[key];
        const label = motherTongueLabel(key);
        if (label) displayName = `${name} (${label})`;
      } else if (skillFloors.has(key)) {
        baseFv = Math.max(baseFv, skillFloors.get(key));
      }
      const bought = this.state.fardigheter[key] ?? 0;
      const fv = baseFv + bought;
      const baseOverride = CONFIG.DODE.secondarySkillBaseOverrideFor(key, professionNameShim);
      const cost = CONFIG.DODE.skillCost(costTier, baseFv, fv, baseOverride);
      return { key, name: displayName, attribute, costTier, baseFv, fv, cost, weaponGroup, baseOverride };
    };
    const primaryKeys = new Set(CONFIG.DODE.primarySkills.map((s) => s.key));
    const primary = CONFIG.DODE.primarySkills.map((s) => buildEntry(s.key, s.name, s.attribute, "primar"));
    // ⚠ Bara de yrkesfärdigheter spelaren FAKTISKT valt (RP s.11: 12 av listan,
    // magiker 9) — inte hela yrkets lista. Före 2026-07-28 delades allt ut, vilket
    // gav en bard 24 yrkesfärdigheter i stället för 12 och sprängde EP-budgeten.
    // Valfria platser ("5× vapenfärdighet") bär spelarens inskrivna namn.
    const professionSkills = this.state.professionSkillPicks
      .map((s) => ({ ...s, key: s.key || CONFIG.DODE.skillKey(s.name) }))
      .filter((s) => s.name && !primaryKeys.has(s.key))
      .map((s) => buildEntry(s.key, s.name, s.attribute, "yrkesfardighet", s.weaponGroup ?? ""));
    // Ett `skillFloors`-golv (t.ex. Stråtrövarens "Överleva i skogstrakter",
    // Prisjägares Upptäcka fara) är boktextens egen "AUTOMATISKT/ALLTID" —
    // FÅR INTE vara beroende av att spelaren råkar välja just DEN raden bland
    // sina begränsade 12 yrkesfärdighetsval. Prisjägares golv har alltid
    // fungerat av en anledning som inte generaliserar: Upptäcka fara är en
    // PRIMÄR färdighet, alltid närvarande oavsett pick-budget. Stråtrövarens
    // golv ligger däremot på en YRKESFÄRDIGHET, som konkurrerar om samma 12
    // platser som alla andra val — en spelare som fyller sina 12 platser med
    // annat skulle annars aldrig få golvet alls (hittat i liveverifiering
    // 2026-08-17, `EDGE Stråtrövare skogsvana` visade `totalYrkesfardigheter:
    // 12` men INGEN "Överleva i skogstrakter"-rad). Fixat genom att lägga
    // till en garanterad, kostnadsfri post för varje golv-nyckel som INTE
    // redan täcks av primär eller ett faktiskt spelarval — samma "gratis,
    // precis som BC"-princip skillFloors-kommentaren i item-yrke.mjs redan
    // beskriver, nu också garanterad oavsett pick-ordning.
    const coveredKeys = new Set([...primaryKeys, ...professionSkills.map((s) => s.key)]);
    const floorOnlySkills = [...skillFloors.keys()]
      .filter((key) => !coveredKeys.has(key))
      .map((key) => {
        const catalogEntry = CONFIG.DODE.secondarySkills.find((s) => s.key === key);
        return buildEntry(key, catalogEntry?.name ?? key, catalogEntry?.attribute ?? "int", "yrkesfardighet");
      });
    // ⚠ `floorOnlySkills` MÅSTE in i den RETURNERADE `professionSkills`, inte
    // bara i den lokala `all` som räknar EP — `#onCreateCharacter`/
    // `#applyToActor` itererar `[...skillPreview.primary,
    // ...skillPreview.professionSkills]` för att FAKTISKT SKAPA `fardighet`-
    // items på aktören. Utan detta hade golvet räknats med i EP-budgeten men
    // aldrig blivit en riktig färdighetspost på den skapade rollpersonen.
    professionSkills.push(...floorOnlySkills);
    const all = [...primary, ...professionSkills];
    const epSpent = all.reduce((sum, entry) => sum + entry.cost, 0);
    const epRemaining = (epBudget?.max ?? 0) - epSpent;
    const maxStartFv = epBudget?.maxStartFv ?? null;
    for (const entry of all) {
      entry.canDecrease = entry.fv > entry.baseFv;
      entry.nextCost = maxStartFv != null && entry.fv < maxStartFv
        ? CONFIG.DODE.skillCost(entry.costTier, entry.fv, entry.fv + 1, entry.baseOverride)
        : null;
      entry.canIncrease = entry.nextCost !== null && entry.nextCost <= epRemaining;
    }
    return { primary, professionSkills, total: all.length, epSpent, epRemaining, maxStartFv };
  }

  /**
   * Säkerställer att `state.specialAbilities` har exakt så många slots som
   * nivån ger rätt till (`DODE.abilityRollsByNiva`, KH s.3) — fyller på med
   * tomma poster om nivån höjts, kapar bakifrån (tar bort de senast tillagda,
   * inte godtyckliga) om nivån sänkts. Muterar `state.specialAbilities`
   * direkt (samma mönster som övriga state-synk i denna klass) så att
   * fält-bindningarna i _onRender pekar på samma array-referens som mallen
   * fick i sin context.
   */
  #specialAbilitySlots() {
    const n = CONFIG.DODE.abilityRollsByNiva[this.state.niva] ?? 1;
    const slots = this.state.specialAbilities;
    // bpSpent/rollResult/effect/effectChoices är bara wizard-scratch för
    // slå fram-knappen (se #onRollFormaga) — actor.system.specialAbilities
    // schemat (SchemaField) har bara name/source/description/slotId, så
    // extra nycklar rensas automatiskt bort av Foundry vid #onCreateCharacter,
    // ingen manuell strippning behövs. `slotId` är INTE scratch — se dess
    // schemakommentar i actor-character.mjs — och krymps aldrig bort utan att
    // #applyToActor/#onCreateCharacter först städar den formaga-post den äger
    // (pruneOrphanedAbilityGrants).
    while (slots.length < n) {
      slots.push({
        name: "", source: "", description: "", bpSpent: 1, rollResult: null,
        slotId: foundry.utils.randomID(), effect: null, effectChoices: []
      });
    }
    for (const slot of slots) {
      if (!slot.slotId) slot.slotId = foundry.utils.randomID();
      if (!("effectChoices" in slot)) slot.effectChoices = [];
    }
    if (slots.length > n) slots.length = n;
    return slots;
  }

  /**
   * Hovertext per utrustningskort (Johan, 2026-08-16) — bara de fält som
   * faktiskt finns i respektive DataModel-schema (se item-vapen.mjs/
   * item-rustning.mjs/item-utrustning.mjs); INGET brytvärde (BV) här, det
   * fältet saknas fortfarande helt på både vapen och rustning (DESIGN_
   * DECISIONS.md §6, ett redan känt öppet schemagap, inte glömt nu).
   */
  static #equipmentStatsTooltip(doc) {
    const s = doc.system;
    if (doc.type === "vapen") {
      const parts = [`Skada: ${s.damage}`, `Vikt: ${s.weight} BEP`, `Fattning: ${s.grip}`];
      if (s.length) parts.push(`Längd: ${s.length}`);
      if (s.range) parts.push(`Räckvidd: ${s.range}`);
      return parts.join(" · ");
    }
    if (doc.type === "rustning") {
      const parts = [`Skydd (Abs): ${s.abs}`, `Vikt: ${s.weight} BEP`];
      if (s.coverage?.length) parts.push(`Skyddar: ${s.coverage.join(", ")}`);
      return parts.join(" · ");
    }
    // utrustning — bara vikt är ett generiskt, alltid tillgängligt fält.
    return s.weight ? `Vikt: ${s.weight} BEP` : "";
  }

  /**
   * Utrustning (Fas 9) — köp/sälj från `vapen-utrustning`-kompendiet (vapen+
   * rustning i samma pack), draget mot `state.startCapital.finalSm`. Ingen
   * `qty`-fält på Item-schemat (plan: "Ingen ny schema för utrustning") — antal
   * lagras bara i `state.equipment[uuid]`, materialiseras till N separata
   * embeddade kopior i #onCreateCharacter.
   */
  #equipmentResult(equipmentDocs, capitalResult) {
    const items = equipmentDocs.map((doc) => {
      const qty = this.state.equipment[doc.uuid] ?? 0;
      // Mängdköpbara poster (Johan 2026-08-08: "purchasable/usable entity",
      // se backlog 66) — ett fritextpris som "20 sm/g" är INTE referensdata,
      // det är ett styckpris per gram/dos/kagge som bara saknat ett mängdfält
      // i UI:t. DODE.parsePriceNote returnerar null för de FÅ notar som
      // faktiskt ÄR ren referens (ridjursmultiplikatorerna "×0,5"/"×10" —
      // de prissätter ett ANNAT föremål, inte sig själva).
      const parsedNote = doc.type === "utrustning" && doc.system.priceNote
        ? CONFIG.DODE.parsePriceNote(doc.system.priceNote, doc.system.priceUnit)
        : null;
      // `utrustning` prissätts i bokens eget myntslag och normaliseras till
      // silver i prepareDerivedData; vapen/rustning har ett rent sm-pris.
      // Startkapitalet är i silver, så allt jämförs i silver här.
      const price = parsedNote
        ? CONFIG.DODE.toSilver(parsedNote.amountPerUnit, parsedNote.currency)
        : (doc.type === "utrustning" ? (doc.system.priceSm ?? 0) : (doc.system.price ?? 0));
      return {
        uuid: doc.uuid, name: doc.name, img: doc.img, type: doc.type, price, qty,
        category: doc.system.category ?? "",
        priceLabel: doc.system.priceNote || `${price} sm`,
        isQuantityPurchase: !!parsedNote,
        unitLabel: parsedNote?.unitLabel ?? "",
        // Rena multiplikatornotar ("×0,5") har varken ett styckpris eller en
        // parsad enhet — de förblir referens-only, oköpbara här.
        purchasable: parsedNote ? true : (!doc.system.priceNote && price > 0),
        // Johan, 2026-08-16: "hovering over the equipment a text should be
        // shown about the characteristics" — ett kort blir annars bara en
        // bild+pris, med vapnets skada/vikt eller rustningens skydd gömt
        // en klick bort på själva kompendieposten.
        statsTooltip: DoDECharacterWizard.#equipmentStatsTooltip(doc)
      };
    });
    const spent = items.reduce((sum, entry) => sum + entry.price * entry.qty, 0);
    const budget = capitalResult?.finalSm ?? 0;
    const remaining = budget - spent;
    for (const entry of items) {
      entry.canBuy = entry.purchasable !== false && entry.price <= remaining;
      entry.canSell = entry.qty > 0;
      // Mängdfältets `max` — hur många enheter TOTALT (redan köpta + fler man
      // har råd med just nu) — så fältet klampar mot budgeten i stället för
      // att tillåta ett negativt "kapital kvar".
      if (entry.isQuantityPurchase) {
        const affordableMore = entry.price > 0 ? Math.floor(remaining / entry.price) : Infinity;
        entry.maxQty = entry.qty + Math.max(0, affordableMore);
        entry.totalSm = entry.price * entry.qty;
      }
    }
    // Gruppering per kategori — utrustningssteget gick från 33 till 304 kort när
    // Magi-regelbokens listor portades (2026-07-28), och ett platt rutnät i den
    // storleken är obrukbart. Samma skäl som ras-/yrkesgrupperingen infördes för.
    // Vapen och rustning saknar `category` och samlas under egna rubriker först.
    const ORDER = ["vapen", "rustning", ...Object.keys(CONFIG.DODE.equipmentCategories)];
    const labelFor = (key) => {
      if (key === "vapen") return "Vapen";
      if (key === "rustning") return "Rustning";
      return game.i18n.localize(CONFIG.DODE.equipmentCategories[key] ?? key);
    };
    const buckets = new Map();
    for (const entry of items) {
      const key = entry.type === "utrustning" ? (entry.category || "diverse") : entry.type;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(entry);
    }
    // Johan, 2026-08-16: "utrustning should probably be alphabetically
    // indexed under each category" — korten låg tidigare i kompendiets
    // egen (skapelseordnings-)följd inom varje kategori, inte bokstavsordning.
    const groups = ORDER
      .filter((key) => buckets.has(key))
      .map((key) => ({
        key, label: labelFor(key),
        items: buckets.get(key).sort((a, b) => a.name.localeCompare(b.name, "sv"))
      }));
    return { items, groups, budget, spent, remaining };
  }

  /**
   * Attributen är ofta null här — yrkessteget kommer före attributsteget i guidens
   * ordning (PLAN_WIZARD_V2.md Fas 1). Ett null-attribut betyder "inte kontrollerat
   * än", inte "kravet är brutet" — visa `unverified` separat från `met`/olyckat
   * `!met`, annars ser varje krav ut som ett rött kryss innan spelaren ens hunnit
   * slå tärningar.
   */
  static #checkRequirements(requirementText, effectiveAttributes) {
    if (!requirementText) return { text: "", entries: [], allMet: true };
    const re = /(STY|STO|FYS|SMI|INT|PSY|KAR)\s*(\d+)/gi;
    const entries = [];
    let match;
    while ((match = re.exec(requirementText))) {
      const key = match[1].toLowerCase();
      const required = Number(match[2]);
      const total = effectiveAttributes[key]?.total ?? null;
      const unverified = total === null;
      entries.push({ key: match[1], required, total, unverified, met: !unverified && total >= required });
    }
    return {
      text: requirementText,
      entries,
      allMet: entries.length === 0 || entries.every((e) => e.met || e.unverified)
    };
  }

  #canAdvance(stepId) {
    switch (stepId) {
      case "grunder": return this.state.name.trim().length > 0;
      case "ras": return !!this.state.raceUuid;
      case "hand": return !!this.state.swordHand.granted || this.state.swordHand.roll > 0;
      case "alder": return !!this.state.ageCategory;
      // Grundegenskaper köps, inget att "slå klart" — #ensureAttributesInitialized
      // seedar baslinjen så fort rasen är känd, alltid färdigt att gå vidare från.
      case "yrke": return !!this.state.professionUuid;
      case "magiskola": return !!this.state.magicSchoolKey;
      // Exakt så många som RP s.11 ger — annars går EP-budgeten inte ihop och
      // rollpersonen får fel antal yrkesfärdigheter.
      case "yrkesfardigheter": return this.state.professionSkillPicks.length >= this.#professionSkillTarget;
      case "socialt": return this.state.socialStanding.roll > 0;
      case "kapital": return this.state.startCapital.roll > 0;
      // Alla valbara slots (t.ex. "vilket människospråk") måste vara ifyllda —
      // fasta slots (Alvers "alviska" m.fl.) räknas alltid som klara, se
      // DODE.motherTongueSlots. socialResult/effectiveAttributes påverkar bara
      // det FÖRHANDSVISADE BC:t, inte om steget räknas som klart.
      case "sprak": {
        for (const kind of ["tala", "lasaSkriva"]) {
          const slots = CONFIG.DODE.motherTongueSlots(this.#selectedRaceDoc, kind);
          const chosen = this.state.motherTongues[kind];
          for (let i = 0; i < slots.length; i++) {
            if (CONFIG.DODE.motherTongueSlotOptions(slots[i]) && !chosen[i]) return false;
          }
        }
        return true;
      }
      default: return true;
    }
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const nameInput = this.element.querySelector('[name="state.name"]');
    nameInput?.addEventListener("input", (ev) => {
      this.state.name = ev.target.value;
      const nextBtn = this.element.querySelector('[data-action="nextStep"]');
      if (nextBtn) nextBtn.disabled = !this.#canAdvance("grunder");
    });
    // ⚠ Svärdshand "fick du handen som förmåga"-väljaren och modersmålsvalen
    // (nedan) MÅSTE bindas med en riktig `change`-lyssnare, inte
    // `data-action` — Foundrys egen `_attachFrameListeners()`
    // (client/applications/api/application.mjs) binder `[data-action]`
    // ENDAST till `click`, aldrig `change`. Ett `<select data-action="...">`
    // ser ut som det borde fungera men gör det ALDRIG: att välja ett
    // alternativ i en riktig dropdown avfyrar `change`, inte `click`, så
    // handlern kallas aldrig och tillståndet skrivs aldrig. Upptäckt
    // 2026-08-06 genom att faktiskt klicka igenom guiden (inte state-
    // injektion via konsolen) — se CLAUDE.md Livetestregler och
    // memory.md för hela utredningen. `#onToggleHandGranted` hade dessutom
    // redan innan dess läst `target.dataset.value` i stället för
    // `target.value`, ett fel som aldrig kunde synas förrän klicket
    // faktiskt avfyrades. Samma bugg fanns i den nya `setMotherTongueLang`
    // eftersom den kopierades från samma (trasiga) mönster.
    const handSelect = this.element.querySelector('select[name="grantedHand"]');
    handSelect?.addEventListener("change", (ev) => {
      this.state.swordHand.granted = ev.target.value || false;
      this.state.swordHand.roll = 0;
      this.render();
    });
    for (const select of this.element.querySelectorAll(".dode-mother-tongue-select")) {
      select.addEventListener("change", (ev) => {
        const kind = ev.target.dataset.kind;
        const index = Number(ev.target.dataset.index);
        if (!kind || Number.isNaN(index)) return;
        this.state.motherTongues[kind][index] = ev.target.value;
        // Tala/Läsa-Skriva "human"-platser är SAMMA modersmål, inte två
        // oberoende val (Johan 2026-08-07, se DODE.syncedHumanMotherTongueIndices)
        // — spegla värdet till motsvarande plats i den andra färdigheten.
        const synced = CONFIG.DODE.syncedHumanMotherTongueIndices(this.#selectedRaceDoc);
        if (synced) {
          if (kind === "tala" && index === synced.talaIndex) {
            this.state.motherTongues.lasaSkriva[synced.lasaSkrivaIndex] = ev.target.value;
          } else if (kind === "lasaSkriva" && index === synced.lasaSkrivaIndex) {
            this.state.motherTongues.tala[synced.talaIndex] = ev.target.value;
          }
        }
        this.render();
      });
    }
    // Mängdköpbara utrustningsposter (Johan 2026-08-08, "purchasable/usable
    // entity") — direkt mängdinmatning i stället för en ±1-stegare, eftersom
    // att klicka +1 30 gånger för att köpa 30 gram vore orimligt. Klampar mot
    // `maxQty` (redan köpt + vad kvarvarande kapital räcker till), se
    // #equipmentResult. `change`, inte `input`, av samma skäl som övriga
    // fält i den här filen — ingen omrendering mitt i skrivandet.
    for (const field of this.element.querySelectorAll(".wizard-quantity-input")) {
      field.addEventListener("change", (ev) => {
        const uuid = ev.target.dataset.uuid;
        const max = Number(ev.target.dataset.max) || 0;
        const value = Math.max(0, Math.min(max, Math.floor(Number(ev.target.value) || 0)));
        this.state.equipment[uuid] = value;
        this.render();
      });
    }
    // Vapenmästarens "(två)"-kryssruta (KH s.8-9, dualWieldAlt) — expanderar
    // eller drar ihop platsen med en rad. Vid ur-kryssning rensas ev. andra
    // radens val bort så den inte blir kvar som ett spöke i state.
    for (const box of this.element.querySelectorAll("[data-dualwield-index]")) {
      box.addEventListener("change", (ev) => {
        const slotIndex = Number(ev.target.dataset.dualwieldIndex);
        this.state.dualWieldChecked[slotIndex] = ev.target.checked;
        if (!ev.target.checked) {
          const picks = this.state.professionSkillPicks;
          const mine = picks.filter((p) => p.slotIndex === slotIndex);
          if (mine.length > 1) picks.splice(picks.indexOf(mine[mine.length - 1]), 1);
        }
        this.render();
      });
    }
    // Valfria platser i yrkesfärdighetssteget. Bindningen sker på `change`
    // (inte `input`) så att ett halvskrivet namn inte triggar en omrendering
    // mitt i skrivandet — samma skäl som färdighetsstegets fält.
    for (const field of this.element.querySelectorAll("[data-slot-index]")) {
      field.addEventListener("change", (ev) => {
        const slotIndex = Number(ev.target.dataset.slotIndex);
        const row = Number(ev.target.dataset.slotRow);
        const value = ev.target.value.trim();
        const picks = this.state.professionSkillPicks;
        const mine = picks.filter((p) => p.slotIndex === slotIndex);
        const existing = mine[row];
        // Vapengrupper (RP s.60) — matchar det inskrivna namnet mot
        // DODE.weaponGroupFor oavsett vilken pool platsen tillhör (ett
        // "hantverk"- eller "främmande språk"-namn kolliderar aldrig med ett
        // vapennamn, så det är säkert att alltid försöka). Träff ger rätt
        // grundegenskap (STY för flera grupper, inte bara SMI som förut) och
        // taggar färdigheten för #computeWeaponGroupBonus. Ingen träff faller
        // tillbaka till exakt samma beteende som innan — fritext, poolens
        // egen attribute.
        const weaponGroup = CONFIG.DODE.weaponGroupFor(value);
        // Stridskonst (backlog 71/72) — MÅSTE använda katalogens egen `key`
        // (t.ex. "sk-dodande-anfall"), INTE `DODE.skillKey(value)`. Tre av
        // teknikerna delar visningsnamn med en DODE.vapentekniker-post
        // ("Dödande anfall", "Psykisk duell", "Virvelvindsanfall") och skulle
        // annars av misstag matcha VAPENTEKNIKERNS grundkostnad i
        // secondarySkillBaseOverrideFor (som kollar vapentekniker FÖRE
        // stridskonster) i stället för stridskonstens egen, lägre kostnad.
        const stridskonstEntry = CONFIG.DODE.stridskonstFor(value);
        const attribute = weaponGroup?.attribute
          ?? (stridskonstEntry ? CONFIG.DODE.stridskonstAttribute(stridskonstEntry) : null)
          ?? (ev.target.dataset.slotAttribute || "int");
        const key = stridskonstEntry?.key ?? CONFIG.DODE.skillKey(value);
        if (!value) {
          if (existing) picks.splice(picks.indexOf(existing), 1);
        } else if (existing) {
          existing.name = value;
          existing.key = key;
          existing.attribute = attribute;
          existing.weaponGroup = weaponGroup?.key ?? "";
        } else {
          if (picks.length >= this.#professionSkillTarget) {
            ui.notifications.warn(`Du har redan valt ${this.#professionSkillTarget} yrkesfärdigheter.`);
            ev.target.value = "";
            return;
          }
          picks.push({
            key, name: value,
            attribute, weaponGroup: weaponGroup?.key ?? "", slotIndex
          });
        }
        this.render();
      });
    }

    const ageSelect = this.element.querySelector('[name="state.ageCategory"]');
    ageSelect?.addEventListener("change", (ev) => {
      this.state.ageCategory = ev.target.value;
      this.render();
    });

    const socialBpInput = this.element.querySelector('[name="state.socialStanding.bpSpent"]');
    socialBpInput?.addEventListener("change", (ev) => {
      this.state.socialStanding.bpSpent = Math.max(0, Number(ev.target.value) || 0);
      this.render();
    });
    const capitalBpInput = this.element.querySelector('[name="state.startCapital.bpSpent"]');
    capitalBpInput?.addEventListener("change", (ev) => {
      this.state.startCapital.bpSpent = Math.max(0, Number(ev.target.value) || 0);
      this.render();
    });
    // ⚠ Saknades helt fram till 2026-08-02 (Johans fynd) — `name`-attributet på
    // fältet i mallen antydde auto-bindning, men wizardens form-handler är en
    // no-op (se DEFAULT_OPTIONS), så INGET fält binds automatiskt. #onRollSwordHand
    // läste `state.swordHand.bpSpent` som därför alltid stod kvar på sitt
    // initialvärde 0, oavsett vad spelaren skrev in.
    const swordHandBpInput = this.element.querySelector('[name="state.swordHand.bpSpent"]');
    swordHandBpInput?.addEventListener("change", (ev) => {
      this.state.swordHand.bpSpent = Math.max(0, Number(ev.target.value) || 0);
      this.render();
    });

    // Särskilda förmågor — fritext, ingen re-render vid varje tangenttryckning
    // (samma anledning som namnfältet ovan: skulle tappa fokus/markörposition).
    this.element.querySelectorAll("[data-ability-index]").forEach((el) => {
      el.addEventListener("input", (ev) => {
        const idx = Number(el.dataset.abilityIndex);
        const field = el.dataset.abilityField;
        if (this.state.specialAbilities[idx]) this.state.specialAbilities[idx][field] = ev.target.value;
      });
    });

    // Val-input för effekter som kräver spelarval (backlogpost 7/36, t.ex.
    // Hobbyist "valfri sekundär färdighet") — se needsChoice/choiceCount i
    // special-ability-effects.mjs. `change`, inte `input`, av samma skäl som
    // yrkesfärdighetsstegets valfria platser ovan.
    this.element.querySelectorAll("[data-ability-choice-index]").forEach((el) => {
      el.addEventListener("change", (ev) => {
        const idx = Number(el.dataset.abilityChoiceIndex);
        const choiceIdx = Number(el.dataset.abilityChoiceSlot);
        const slot = this.state.specialAbilities[idx];
        if (slot?.effectChoices) slot.effectChoices[choiceIdx] = ev.target.value;
      });
    });

    const lifeGoalSelect = this.element.querySelector('[name="state.lifeGoal"]');
    lifeGoalSelect?.addEventListener("change", (ev) => {
      this.state.lifeGoal = ev.target.value;
      this.render();
    });
    const lifeGoalCustomInput = this.element.querySelector('[name="state.lifeGoalCustom"]');
    lifeGoalCustomInput?.addEventListener("input", (ev) => {
      this.state.lifeGoalCustom = ev.target.value;
    });
  }

  static #onNextStep() {
    const steps = this.steps;
    if (!this.#canAdvance(steps[this.stepIndex])) {
      ui.notifications.warn("Fyll i det här steget innan du går vidare.");
      return;
    }
    this.stepIndex = Math.min(this.stepIndex + 1, steps.length - 1);
    this.render();
  }

  static #onPrevStep() {
    this.stepIndex = Math.max(this.stepIndex - 1, 0);
    this.render();
  }

  /**
   * Sätter köpbaslinjen EN gång — 3 för de sex kärnegenskaperna (RP s.23,
   * "Värde du vill köpa: 3 → 0 BP"), rasens `stoRange.normal` för STO. Körs
   * bara om attributen aldrig satts (`sty === null`), så en spelares redan
   * gjorda köp aldrig nollställs av en omrendering — samma lazy-init-mönster
   * som #specialAbilitySlots() använder för tomma förmågeslots.
   */
  #ensureAttributesInitialized(selectedRace) {
    if (this.state.attributes.sty !== null) return;
    for (const key of ROLLABLE_ATTRIBUTES) this.state.attributes[key] = 3;
    this.state.attributes.sto = selectedRace?.system?.stoRange?.normal ?? 13;
  }

  /**
   * Köpstatus per grundegenskap — RP s.23 (rättelse 2026-08-02: sidan är en
   * köptabell, inte ett slagsystem — se config.mjs DODE.attributeBuyCumulative
   * för hela utredningen). Mirrorar #skillPreview i formen, men BP-kostnaden
   * är BARA informativ — precis som ras/förmågor/socialt stånd/startkapital
   * redan är i resten av guiden (`bp.remaining` kan gå negativt, SL:s bord
   * avgör, ingen hård spärr här heller). +/- spärras bara av tabellens egna
   * gränser: 3-18 för kärnegenskaperna, ±5 från rasens normalvärde för STO
   * (klampat mot `stoRange.min`/`max` om rasen har ett snävare intervall).
   */
  #attributeBuyResult(selectedRace, effectiveAttributes) {
    const stoNormal = selectedRace?.system?.stoRange?.normal ?? 13;
    const stoMin = Math.max(selectedRace?.system?.stoRange?.min ?? (stoNormal - 5), stoNormal - 5);
    const stoMax = Math.min(selectedRace?.system?.stoRange?.max ?? (stoNormal + 5), stoNormal + 5);
    // Cachat här (i stället för att slå upp rasen på nytt i #attributeBounds)
    // så köp-/säljhandlerns kapplöpningsskydd inte behöver ett async
    // dokumentuppslag — se #attributeBounds docblock.
    this.#stoBounds = { min: stoMin, max: stoMax };
    const rows = [...ROLLABLE_ATTRIBUTES, "sto"].map((key) => {
      const isSto = key === "sto";
      const value = this.state.attributes[key];
      const min = isSto ? stoMin : 3;
      const max = isSto ? stoMax : 18;
      const buyCost = (from, to) => (isSto ? CONFIG.DODE.stoBuyCost(from - stoNormal, to - stoNormal) : CONFIG.DODE.attributeBuyCost(from, to));
      const cost = isSto ? buyCost(stoNormal, value) : buyCost(3, value);
      const eff = effectiveAttributes[key];
      return {
        key, label: key.toUpperCase(), value, min, max, cost,
        // Marginalkostnad för NÄSTA steg — bara informativ (som alla andra
        // BP-steg i guiden), men gör +/- begripligt utan huvudräkning.
        nextCost: value < max ? buyCost(value, value + 1) : null,
        prevRefund: value > min ? buyCost(value, value - 1) : null,
        canIncrease: value < max, canDecrease: value > min,
        raceMod: eff?.mod ?? 0, modLabel: eff?.modLabel ?? "", total: eff?.total ?? value,
        // STO har ingen flat rasbonus (raceMod är alltid 0 för den, se
        // #effectiveAttributes) utan ett eget spann — visa rasnamn+normalvärde
        // som referenstext i stället, så STO-rutan inte står utan sammanhang
        // medan de andra sex visar "+N ras".
        raceStoLabel: isSto && selectedRace ? `${selectedRace.name}: normal ${stoNormal} (${stoMin}–${stoMax})` : null,
        // BC-grupp (backlog 35, Johan 2026-08-05): "är nästa poäng värd det?"
        // går inte att avgöra utan att se om köpet faktiskt korsar en
        // gruppgräns — DODE.attributeToGroup (REG s.6) räknat på det
        // EFFEKTIVA värdet (inkl. rasmod), samma tal CL-beräkningar använder.
        group: CONFIG.DODE.attributeToGroup(eff?.total ?? value),
        nextGroupsUp: value < max ? CONFIG.DODE.attributeToGroup((eff?.total ?? value) + 1) > CONFIG.DODE.attributeToGroup(eff?.total ?? value) : false
      };
    });
    const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);
    return { rows, totalCost };
  }

  /**
   * Räknar om `state.bp.spentAttribut` från de sju grundegenskapernas
   * nuvarande köpta värden. Körs vid varje +/- så att BP-ledgern (header,
   * "BP kvar: X/125") stämmer direkt — samma mönster som `spentFormagor`
   * i #onRollFormaga. Läser rasen via `fromUuid` snarare än den mappade
   * context-arrayen, eftersom action-handlers körs utanför _prepareContext.
   */
  async #syncAttributeSpend() {
    const raceDoc = this.state.raceUuid ? await fromUuid(this.state.raceUuid) : null;
    const stoNormal = raceDoc?.system?.stoRange?.normal ?? 13;
    let total = 0;
    for (const key of ROLLABLE_ATTRIBUTES) total += CONFIG.DODE.attributeBuyCost(3, this.state.attributes[key]);
    total += CONFIG.DODE.stoBuyCost(0, this.state.attributes.sto - stoNormal);
    this.state.bp.spentAttribut = total;
  }

  /**
   * Räknar fram (min, max) för en grundegenskap på nytt, direkt ur `state` —
   * ⚠ RÄTTAT 2026-08-02: `#onBuyAttribute`/`#onSellAttribute` litade tidigare
   * ENBART på knappens `data-can-increase`/`data-can-decrease`, ett
   * ögonblicksvärde från SENASTE rendering. Ett verifierat kapplöpningsfel:
   * flera klick avfyrade snabbare än `this.render()` (async) hann uppdatera
   * knappens `disabled`-attribut hann köra igenom vardera sin `#onBuyAttribute`
   * mot samma, ännu ogiltigförklarade DOM-knapp — värden gick förbi 18 (upp
   * till 26-29 uppmätt) och tabellslagningen (`DODE.attributeBuyCumulative`,
   * som bara definierar 3-18) gav `undefined`-kostnader däröver. Handlers
   * kollar nu gränsen mot `this.state` direkt, inte mot DOM:en, så ett
   * kapplöpt extra klick blir ett no-op istället för ett hål i schemat.
   */
  #attributeBounds(key) {
    if (key !== "sto") return { min: 3, max: 18 };
    // Cachad av senaste #attributeBuyResult-anropet (varje render, se
    // _prepareContext) — undviker ett async rasuppslag inuti en synkron
    // klick-handler. Fallback om steget aldrig renderats än är osannolik
    // (knappen kräver att attribut-steget redan visats) men ofarlig: samma
    // ±5-runt-13-standard som resten av koden faller tillbaka på.
    return this.#stoBounds ?? { min: 8, max: 18 };
  }

  static async #onBuyAttribute(event, target) {
    const key = target.dataset.attr;
    if (!key) return;
    const { max } = this.#attributeBounds(key);
    if (this.state.attributes[key] >= max) return;
    this.state.attributes[key] += 1;
    await this.#syncAttributeSpend();
    this.render();
  }

  static async #onSellAttribute(event, target) {
    const key = target.dataset.attr;
    if (!key) return;
    const { min } = this.#attributeBounds(key);
    if (this.state.attributes[key] <= min) return;
    this.state.attributes[key] -= 1;
    await this.#syncAttributeSpend();
    this.render();
  }

  /**
   * RP s.11: spelaren väljer **12** av yrkets möjliga yrkesfärdigheter — magiker
   * väljer **9**. Listar yrket färre än så tar man alla, så taket är
   * min(12, tillgängliga).
   */
  get #professionSkillTarget() {
    const doc = this.#selectedProfessionDoc;
    if (!doc) return 0;
    const list = doc.system.professionSkills ?? [];
    const available = list.reduce((n, s, i) => n + this.#slotChoiceCount(s, i), 0);
    return Math.min(this.#isFullMagician ? 9 : 12, available);
  }

  /**
   * En platss antal valbara rader — normalt `entry.choiceCount||1`, men +1 om
   * entryn har `dualWieldAlt` (Vapenmästarens "(två)"-alternativ, KH s.8-9)
   * OCH spelaren kryssat i den för just detta slot-index. Delad mellan
   * #professionSkillTarget (summan) och #professionSkillState (raderna) så de
   * aldrig kan glida isär.
   */
  #slotChoiceCount(entry, index) {
    const base = entry.choiceCount || 1;
    return entry.dualWieldAlt && this.state.dualWieldChecked[index] ? base + 1 : base;
  }

  /**
   * Språkpoolernas fasta prefix — matchar exakt namnkonventionen "+Ny
   * färdighet"-dialogen (actor-character-sheet.mjs) redan använder för
   * samma två poolers rader, så samma språk gett vid skapande vs. i spel
   * åtminstone LÄSER likadant, även om de exakta skillKey:erna kan skilja
   * sig marginellt (samma egenskap som "vapenfärdighet"-poolen redan har —
   * nyckeln härleds ur det fria namnet, inte en delad katalogpost).
   */
  static #LANGUAGE_POOL_PREFIX = { "främmande språk": "Tala", "läsa/skriva främmande språk": "Läsa/Skriva" };

  /**
   * Vilka `"<Prefix> <Språk>"`-värden rollpersonen redan har via MODERSMÅL
   * (Tala/Läsa-Skriva) för den här poolen — utgråas i "Tala/Läsa-skriva
   * Främmande Språk"-valen (Johan 2026-08-07: "annars blir det dubbelt").
   * Ett SKILT huvudspråk för Tala vs Läsa/Skriva (Dvärgar/Halvorcher/
   * Halvalver) betyder att den här mängden är olika beroende på `kind` —
   * använder samma slot-modell som #motherTongueResult, inte en gissning.
   */
  #knownMotherTongueValues(kind, langPrefix) {
    const slots = CONFIG.DODE.motherTongueSlots(this.#selectedRaceDoc, kind);
    const chosen = this.state.motherTongues[kind];
    const values = new Set();
    slots.forEach((slot, index) => {
      const isChoice = CONFIG.DODE.motherTongueSlotOptions(slot) !== null;
      const key = isChoice ? chosen[index] : slot;
      if (key) values.add(`${langPrefix} ${CONFIG.DODE.languageName(key)}`);
    });
    return values;
  }

  /** Byggd vy över yrkets lista + spelarens val. */
  #professionSkillState() {
    const doc = this.#selectedProfessionDoc;
    const list = doc?.system?.professionSkills ?? [];
    const picks = this.state.professionSkillPicks;
    const target = this.#professionSkillTarget;
    // Förpass: namngivna färdigheter som yrket redan ger AUTOMATISKT (t.ex.
    // Bards "Dolk"/"Trästav") — en vapenfärdighetspool-val som råkar matcha
    // en av dessa vore en meningslös dubblett (samma färdighet två gånger).
    // Måste byggas FÖRE huvudloopen: named/slots fylls i EN gemensam
    // `list.forEach`, så en namngiven post längre FRAM i listan än en
    // vapenpool skulle annars inte synas än när poolen byggs.
    const namedSkillNames = new Set(list.filter((e) => !e.choiceCount).map((e) => e.name));
    const named = [];
    const slots = [];
    list.forEach((entry, i) => {
      if (entry.choiceCount) {
        const filled = picks.filter((p) => p.slotIndex === i);
        const count = this.#slotChoiceCount(entry, i);
        // Språk (RP s.58/42/44), vapenfärdighet (RP s.60, se
        // DODE.weaponGroupFor) och Stridskonst (RP s.56-58/KH s.91-93, se
        // DODE.stridskonster) har alla en STÄNGD katalog att välja ur — en
        // riktig `<select>` i stället för fritext (backlog 66/71, Johan:
        // "weapon selection UI... weird and not natural" / "Build a
        // DODE.stridskonster structure"). Andra pooler (hantverk) saknar
        // fortfarande en katalog i systemet och förblir fritext.
        const langPrefix = DoDECharacterWizard.#LANGUAGE_POOL_PREFIX[entry.choicePool];
        const isWeaponPool = /vapen/i.test(entry.choicePool || "");
        const isStridskonstPool = entry.choicePool === "stridskonst";
        // Utgråa språk man redan kan — antingen via modersmål (RP s.58: ett
        // FRÄMMANDE språk är per definition inte redan ens eget) eller för
        // att man redan valt det i en annan plats i SAMMA pool (två "Tala
        // Kaseni"-rader vore en meningslös dubblett). De två Främmande-
        // Språk-poolerna (Tala/Läsa-Skriva) är INTE varandras dubbletter —
        // att kunna TALA ett språk innebär inte att man kan LÄSA/SKRIVA det.
        const knownValues = langPrefix
          ? this.#knownMotherTongueValues(langPrefix === "Tala" ? "tala" : "lasaSkriva", langPrefix)
          : null;
        const usedInSlot = (langPrefix || isWeaponPool || isStridskonstPool) ? new Set(filled.map((p) => p.name)) : null;
        slots.push({
          index: i, label: entry.name, pool: entry.choicePool,
          count, attribute: entry.attribute,
          dualWieldAlt: !!entry.dualWieldAlt,
          dualWieldChecked: !!this.state.dualWieldChecked[i],
          isLanguagePool: !!langPrefix,
          isWeaponPool,
          isStridskonstPool,
          // En rad per plats: ifylld eller tom.
          rows: Array.from({ length: count }, (_, n) => {
            const value = filled[n]?.name ?? "";
            const row = { slotIndex: i, row: n, value };
            if (langPrefix) {
              row.languageOptions = CONFIG.DODE.languages.map((l) => {
                const optionValue = `${langPrefix} ${l.name}`;
                let reason = null;
                if (optionValue !== value) {
                  if (knownValues.has(optionValue)) reason = "redan modersmål";
                  else if (usedInSlot.has(optionValue)) reason = "redan valt";
                }
                return {
                  value: optionValue, selected: optionValue === value,
                  disabled: !!reason, label: reason ? `${l.name} (${reason})` : l.name
                };
              });
            } else if (isWeaponPool) {
              // Attributet visas per vapen (RP s.60 vapengrupp, samma
              // matchning `#onSlotFieldChange`/`weaponGroupFor` redan gör vid
              // sparning) — en spelare ser då om vapnet är STY- eller
              // SMI-baserat INNAN valet görs, inte bara efteråt.
              row.weaponOptions = this.#weaponDocs.map((w) => {
                const group = CONFIG.DODE.weaponGroupFor(w.name);
                let reason = null;
                if (w.name !== value) {
                  if (namedSkillNames.has(w.name)) reason = "redan yrkesfärdighet";
                  else if (usedInSlot.has(w.name)) reason = "redan valt";
                }
                // Fall tillbaka på poolens egen deklarerade grundegenskap
                // (samma värde `#onSlotFieldChange` redan använder vid
                // sparning, se dess `ev.target.dataset.slotAttribute`-fallback)
                // för vapen som INTE matchar en DODE.weaponGroups-post — annars
                // visar hintraden attribut för 18 av 23 vapen men tystnar helt
                // för de 5 utan gruppmedlemskap (Bola/Lasso/Oxpiska — medvetet
                // odelade specialvapen, se packs/vapen-utrustning/_source/*
                // beskrivningarna), en omärkt informationslucka en spelare
                // inte kan se anledningen till.
                const attrKey = group?.attribute ?? entry.attribute;
                const attrLabel = attrKey ? attrKey.toUpperCase() : "";
                return {
                  value: w.name, selected: w.name === value,
                  disabled: !!reason,
                  label: reason ? `${w.name} (${reason})` : (attrLabel ? `${w.name} — ${attrLabel}` : w.name)
                };
              });
            } else if (isStridskonstPool) {
              // Riktig katalog (backlog 71/72, DODE.stridskonster) i stället
              // för fritext — samma "gets ALL the stridskonster"-bugg Johan
              // rapporterade (en enda hårdkodad monolitisk "Stridskonster"-
              // post) kunde annars återuppstå via fritext som inte matchar
              // katalogens riktiga tekniknamn. Varje rad blir EN specifik,
              // egen teknik (t.ex. "Krosslag"), inte en platt platshållare.
              row.stridskonstOptions = CONFIG.DODE.stridskonster.map((t) => {
                let reason = null;
                if (t.name !== value) {
                  if (namedSkillNames.has(t.name)) reason = "redan yrkesfärdighet";
                  else if (usedInSlot.has(t.name)) reason = "redan valt";
                }
                const attrLabel = CONFIG.DODE.stridskonstAttribute(t).toUpperCase();
                return {
                  value: t.name, selected: t.name === value,
                  disabled: !!reason,
                  label: reason ? `${t.name} (${reason})` : `${t.name} — ${t.grundkostnad} EP, ${attrLabel}`
                };
              });
            }
            return row;
          })
        });
      } else {
        const key = entry.key || CONFIG.DODE.skillKey(entry.name);
        named.push({
          key, name: entry.name, attribute: entry.attribute, index: i,
          picked: picks.some((p) => p.slotIndex === null && p.key === key)
        });
      }
    });
    // Johan, 2026-08-16: "step 13 should have valfria separate in Weapons,
    // Languages and namngivna more clearly. maybe with separators between."
    // De tre poolsorterna renderas nu i egna grupper (samma
    // .wizard-group-heading-stil som redan skiljer ras-/yrkeskorten och
    // Namngivna färdigheter) i stället för en enda odelad "Valfria
    // platser"-lista där vapen-, språk- och fritextrader stod om varandra.
    const weaponSlots = slots.filter((s) => s.isWeaponPool);
    const languageSlots = slots.filter((s) => s.isLanguagePool);
    const otherSlots = slots.filter((s) => !s.isWeaponPool && !s.isLanguagePool);
    // Rubrikbadgen ska visa antal VAL (rader), inte antal pooler — annars
    // visar en Gladiats "Vapenfärdigheter"-rubrik siffran 1 (en enda pool)
    // i stället för 6 (de faktiska vapenplatserna), rakt motsatsen till
    // vad hela den här omstruktureringen skulle förtydliga.
    const sumRows = (arr) => arr.reduce((n, s) => n + s.rows.length, 0);
    return {
      named, slots, weaponSlots, languageSlots, otherSlots,
      weaponSlotCount: sumRows(weaponSlots),
      languageSlotCount: sumRows(languageSlots),
      otherSlotCount: sumRows(otherSlots),
      target,
      chosen: picks.length,
      remaining: Math.max(0, target - picks.length),
      complete: picks.length >= target,
      over: picks.length > target,
      isMagicUser: this.#isMagicUser
    };
  }

  static #onToggleProfessionSkill(event, target) {
    const key = target.dataset.key;
    if (!key) return;
    const picks = this.state.professionSkillPicks;
    const at = picks.findIndex((p) => p.slotIndex === null && p.key === key);
    if (at >= 0) {
      picks.splice(at, 1);
    } else {
      if (picks.length >= this.#professionSkillTarget) {
        ui.notifications.warn(`Du har redan valt ${this.#professionSkillTarget} yrkesfärdigheter — avmarkera en först.`);
        return;
      }
      picks.push({
        key, name: target.dataset.name, attribute: target.dataset.attribute, slotIndex: null
      });
    }
    this.render();
  }

  static #onClearProfessionSkills() {
    this.state.professionSkillPicks = [];
    this.state.dualWieldChecked = {};
    this.render();
  }

  /**
   * Återställer alla köpta grundegenskaper till baslinjen (3, respektive
   * rasens STO-normalvärde) och återbetalar BP:t — repurposed 2026-08-02
   * från det gamla "slå om alla"-slagsystemet (se config.mjs
   * DODE.attributeBuyCumulative för varför köp ersatte slag).
   */
  static async #onRestartAttributes() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Återställ grundegenskaper?" },
      content: "<p>Alla köpta grundegenskaper återställs till baslinjen och den spenderade BP:n "
        + "återbetalas. Övriga val (kön, nivå, namn, ras) behålls.</p>"
    });
    if (!ok) return;
    for (const key of ROLLABLE_ATTRIBUTES) this.state.attributes[key] = 3;
    const raceDoc = this.state.raceUuid ? await fromUuid(this.state.raceUuid) : null;
    this.state.attributes.sto = raceDoc?.system?.stoRange?.normal ?? 13;
    this.state.bp.spentAttribut = 0;
    // Knappen finns även på yrkessteget (ingen kvalificerar), inte bara på
    // attribut-steget självt — hoppa dit så spelaren ser resultatet direkt.
    this.stepIndex = this.steps.map((s) => s.id ?? s).indexOf("attribut");
    this.render();
  }

  static #onSelectKon(event, target) {
    this.state.kon = target.closest("[data-kon]")?.dataset.kon ?? this.state.kon;
    this.render();
  }

  static #onSelectNiva(event, target) {
    const niva = target.closest("[data-niva]")?.dataset.niva ?? this.state.niva;
    if (niva !== this.state.niva) {
      this.state.niva = niva;
      // Ett bytt nivåval nollställer ev. redan slaget hjältedåd — det hörde
      // till den GAMLA nivån (t.ex. byte bort från en hjälte-nivå till
      // "vanlig", som inte har hjältedåd alls) och ska inte tyst hänga kvar.
      this.state.hjaltedad = { rollCount: 0, rolls: [], bonusBP: 0, bonusHjaltepoang: 0 };
      this.state.hjaltedadAbilities = [];
    }
    this.render();
  }

  /**
   * Hjältedåd, STEG 1 av 2 — HH s.6-7. Bara hjälte-nivåerna (inte "vanlig")
   * får slå. Slår 1T6 för att avgöra hur MÅNGA gånger man sedan slår 1T20 mot
   * DODE.hjaltedadTable (#onRollHjaltedad, steg 2). Johans fynd 2026-08-02:
   * en tidigare version slog och summerade båda stegen i EN knapptryckning
   * utan att någonsin posta 1T6-slaget till chatten — resultatet syntes bara
   * som en redan uträknad siffra, och Dice So Nice fick aldrig en riktig
   * `ChatMessage.create({rolls:[...]})` att haka i (samma klass av bugg som
   * DESIGN_DECISIONS.md redan dokumenterat en gång för grundegenskapsslagen).
   * Separata knapptryckningar + separata chattkort med `rolls` löser båda:
   * 1T6-resultatet syns för sig, och tärningarna rullar synligt i båda stegen.
   *
   * ⚠ HUSREGEL-VÄXEL (Johan, 2026-08-07): om SL:s inställning
   * `hjaltedadTieredRollCount` är påslagen, ersätts det gemensamma 1T6 med
   * DODE.hjaltedadCountHouseRule[niva] (Slumpens hjälte 1T2, Sann hjälte
   * 2+1T2, Gudafödd 4+1T2) — INTE en boktabell, se den inställningens och
   * tabellens docblock för hela motiveringen. Av som standard: då slås 1T6
   * exakt som HH s.6-7 säger, oavsett nivå.
   */
  static async #onRollHjaltedadCount() {
    const houseRuleOn = game.settings.get(game.system.id, "hjaltedadTieredRollCount");
    const houseRuleFormula = CONFIG.DODE.hjaltedadCountHouseRule[this.state.niva];
    const formula = houseRuleOn && houseRuleFormula ? houseRuleFormula : "1d6";
    const countRoll = await new Roll(formula).evaluate();
    const message = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: this.state.name || "Ny rollperson" }),
      flavor: "Hjältedåd (HH s.6-7) — hur många gånger får du slå?"
        + (houseRuleOn && houseRuleFormula ? " (husregel, ej standard — se SL-inställningarna)" : ""),
      rolls: [countRoll],
      sound: CONFIG.sounds.dice
    });
    // Johan 2026-08-02: Dice So Nice tar ~2s att landa, men resultatet syntes
    // i guiden direkt när ChatMessage.create() löste ut — INTE när tärningen
    // faktiskt slutat rulla, eftersom DSN:s animation körs asynkront vid sidan
    // om chattkortets skapande, inte inuti det await:et. `this.render()` (som
    // avslöjar "du fick N" och nästa knapp) väntar nu på
    // CONFIG.DODE.waitForDiceAnimation — se den helperns docblock i
    // config.mjs för hela regeln (gäller nu ALLA slag i systemet, inte bara
    // hjältedåd, se DESIGN_DECISIONS.md §6).
    await CONFIG.DODE.waitForDiceAnimation(message);
    this.state.hjaltedad = { rollCount: countRoll.total, rolls: [], bonusBP: 0, bonusHjaltepoang: 0 };
    this.state.hjaltedadAbilities = [];
    this.render();
  }

  /**
   * Hjältedåd, STEG 2 av 2. Slår `state.hjaltedad.rollCount` stycken 1T20 i EN
   * pool-formel (samma "tärningshink"-teknik som tidigare validerats mot Dice
   * So Nice för grundegenskapsslagen — `roll.terms[0].rolls` ger varje
   * enskild tärnings resultat, `ChatMessage.create({rolls:[pool]})` animerar
   * alla samtidigt i ETT kort i stället för N separata). Varje träffad rad
   * lägger `bonusBP` OVANPÅ den vanliga 125-poolen och `bonusHjaltepoang` i
   * en egen, separat pool (`system.hjaltepoang` — ⚠ INTE kroppspoäng, se
   * `hjaltepoang`-fältets docblock i actor-character.mjs) — fasta tal eller
   * tärningsformler (t.ex. "1T10+10", bokens egen notation, konverterad via
   * DODE.swedishDiceToRoll). Radens fulla boktext (`description`) och eventuella
   * `notes` (t.ex. "+10 Startkapital", "Magiskt vapen" — pekar på mekanik som
   * inte är byggd, se DESIGN_DECISIONS.md backlog 58) sparas i
   * `hjaltedadAbilities` som riktiga specialAbilities-rader, så spelaren ser
   * VARFÖR bonusen finns, inte bara siffran — och de följer med till
   * rollformuläret i spel (se #onCreateCharacter/#applyToActor).
   */
  static async #onRollHjaltedad() {
    const count = this.state.hjaltedad.rollCount;
    if (!count) return;
    const evalBonus = async (value) => {
      if (typeof value === "number") return value;
      const roll = await new Roll(CONFIG.DODE.swedishDiceToRoll(value)).evaluate();
      return roll.total;
    };
    const pool = await new Roll(`{${Array(count).fill("1d20").join(",")}}`).evaluate();
    const dieResults = pool.terms[0].rolls.map((r) => r.total);
    const rolls = [];
    let bonusBP = 0;
    let bonusHjaltepoang = 0;
    for (const result of dieResults) {
      const row = CONFIG.DODE.hjaltedadTable.find((r) => result >= r.range[0] && result <= r.range[1]);
      if (!row) continue;
      const rowBP = await evalBonus(row.bonusBP);
      const rowHjaltepoang = await evalBonus(row.bonusHjaltepoang);
      bonusBP += rowBP;
      bonusHjaltepoang += rowHjaltepoang;
      rolls.push({ roll: result, name: row.name, description: row.description, bonusBP: rowBP, bonusHjaltepoang: rowHjaltepoang, notes: row.notes });
    }
    const message = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: this.state.name || "Ny rollperson" }),
      flavor: `Hjältedåd — resultat (${count} slag)`,
      content: `<div class="dode-chat-card"><ul>${rolls.map((r) =>
        `<li><strong>${r.name}</strong> (${r.roll}): +${r.bonusBP} BP, +${r.bonusHjaltepoang} hjältepoäng${r.notes ? ` — ${r.notes}` : ""}</li>`
      ).join("")}</ul></div>`,
      rolls: [pool],
      sound: CONFIG.sounds.dice
    });
    // Se CONFIG.DODE.waitForDiceAnimation — pool-tärningarna (N stycken 1T20)
    // tar sin tid att landa i DSN, och state sätts inte förrän animationen är
    // klar så att resultatlistan (med sin fulla boktext) inte dyker upp innan
    // spelaren sett vilka tal tärningarna faktiskt visar.
    await CONFIG.DODE.waitForDiceAnimation(message);
    this.state.hjaltedad = { rollCount: count, rolls, bonusBP, bonusHjaltepoang };
    // Ren text, INGA HTML-taggar — den här beskrivningen visas och redigeras
    // som vanlig text i en <textarea> på rollformuläret (character-sheet.hbs),
    // inte via en rich text-editor. `<em>`/`<strong>` hade bara synts som
    // bokstavliga hakparenteser för SL, inte som formatering.
    this.state.hjaltedadAbilities = rolls.map((r) => ({
      name: r.name,
      source: CONFIG.DODE.hjaltedadAbilitySource,
      description: `${r.description}${r.notes ? ` (${r.notes})` : ""} +${r.bonusBP} BP, +${r.bonusHjaltepoang} hjältepoäng.`,
      slotId: foundry.utils.randomID()
    }));
    this.render();
  }

  static async #onSelectRace(event, target) {
    this.state.raceUuid = target.closest("[data-uuid]")?.dataset.uuid ?? null;
    const raceDoc = this.state.raceUuid ? await fromUuid(this.state.raceUuid) : null;
    this.state.bp.spentRas = raceDoc?.system?.bpCost ?? 0;
    this.render();
  }

  static #onSelectProfession(event, target) {
    this.state.professionUuid = target.closest("[data-uuid]")?.dataset.uuid ?? null;
    this.render();
  }

  static #onSelectMagicSchool(event, target) {
    this.state.magicSchoolKey = target.closest("[data-school]")?.dataset.school ?? null;
    this.render();
  }

  /**
   * Svärdshand — RP s.27: 2T6 modifierat med antalet BP man väljer att spendera,
   * +1 per BP.
   *
   * ⚠ **Den dolda pärlan i regelverket** (Johan 2026-07-29): 15 BP ger 2T6+15 =
   * lägst 17, vilket garanterar minst **Dubbelhänt** och ger **Ambidextriös på
   * 33/36 ≈ 92 %**. Att köpa bort sin sämre hand tidigt sparar enormt mycket
   * senare, eftersom sköldhanden annars är genomgående sämre (SLB s.17: −10 CL).
   */
  static async #onRollSwordHand() {
    const bp = Math.max(0, Number(this.state.swordHand.bpSpent) || 0);
    const roll = await new Roll("2d6").evaluate();
    // ⚠ Postades tidigare bara om SL-inställningen "showAttributeRollsInChat"
    // var på — den inställningen retirerades 2026-08-02 tillsammans med hela
    // slagsystemet för grundegenskaper (se DODE.attributeBuyCumulative). Detta
    // slag är oförändrat (RP s.27, 2T6+BP), och postas nu alltid, som övriga
    // skapandeslag i guiden.
    const message = await roll.toMessage({ flavor: `Svärdshand — 2T6 + ${bp} BP` });
    // Johan 2026-08-02: samma "text före tärning"-bugg som hjältedåd hade,
    // funnen på svärdshanden — se CONFIG.DODE.waitForDiceAnimation (nu regel
    // för ALLA slag, DESIGN_DECISIONS.md §6). `state.swordHand.roll` sätts
    // (och avslöjas via render()) inte förrän DSN hunnit landa.
    await CONFIG.DODE.waitForDiceAnimation(message);
    this.state.swordHand.roll = roll.total;
    this.render();
  }

  static async #onRollSocialStanding() {
    const roll = await new Roll("2d6").evaluate();
    // Johan 2026-08-02: postade tidigare INGET chattkort alls (samma
    // "tyst slag"-bugg redan hittad och rättad för grundegenskaper/svärdshand)
    // — tärningen syntes aldrig, vare sig i chatten eller i Dice So Nice. Se
    // CONFIG.DODE.waitForDiceAnimation, nu regel för alla slag (§6).
    const message = await roll.toMessage({ flavor: "Socialt stånd — 2T6" });
    await CONFIG.DODE.waitForDiceAnimation(message);
    this.state.socialStanding.roll = roll.total;
    this.render();
  }

  static async #onRollStartCapital() {
    const roll = await new Roll("2d6").evaluate();
    // Se #onRollSocialStanding — samma bugg, samma fix.
    const message = await roll.toMessage({ flavor: "Startkapital — 2T6" });
    await CONFIG.DODE.waitForDiceAnimation(message);
    this.state.startCapital.roll = roll.total;
    this.render();
  }

  /**
   * Slår fram en särskild förmåga — RP s.25-27, CONFIG.DODE.specialAbilitiesTable
   * (portad session 2026-07-27, se DESIGN_DECISIONS.md §3). "Du kan spendera
   * valfritt antal BP (minst 1, max +40). Slå 2T20 och addera spenderade BP."
   * BP-insatsen läses direkt från radens eget input (inte state-bunden via en
   * change-listener som övriga BP-fält) eftersom slaget bara ska ske vid
   * knapptryck, inte vid varje redigering av insatsen.
   */
  static async #onRollFormaga(event, target) {
    const idx = Number(target.dataset.index);
    const slot = this.state.specialAbilities[idx];
    if (!slot) return;
    const bpInput = this.element.querySelector(`[data-ability-bp-index="${idx}"]`);
    const bpSpent = Math.max(1, Math.min(40, Number(bpInput?.value) || 1));
    const roll = await new Roll(`2d20+${bpSpent}`).evaluate();
    const result = CONFIG.DODE.rollSpecialAbility(roll.total);
    // Johan 2026-08-02: postade tidigare INGET chattkort — samma "tysta slag"-
    // bugg som socialt stånd/startkapital, nu regel att undvika (§6).
    const message = await roll.toMessage({ flavor: "Särskild förmåga — 2T20+BP" });
    await CONFIG.DODE.waitForDiceAnimation(message);

    slot.bpSpent = bpSpent;
    slot.rollResult = roll.total;
    if (result) {
      slot.name = result.name || `Förmåga (${roll.total})`;
      slot.description = result.description;
      slot.source = "bas"; // se schemakommentaren i actor-character.mjs — "bas" = grundboken (RP s.25-27)
      // Backlogpost 7/36 — se special-ability-effects.mjs. `effectChoices`
      // nollställs vid varje omslag: ett gammalt val för en annan rad ska
      // aldrig läcka in i en ny rads effekt.
      slot.effect = result.effect ?? null;
      slot.effectChoices = new Array(needsChoice(result.effect) ? choiceCount(result.effect) : 0).fill("");
    }

    this.state.bp.spentFormagor = this.state.specialAbilities.reduce(
      (sum, s) => sum + (s.bpSpent || 0),
      0
    );
    this.render();
  }

  /**
   * Applicerar samtliga förmågeslots mekaniska effekter på EN redan skapad
   * aktör — backlogpost 7/36. Delad mellan #applyToActor (redigeringsläge) och
   * #onCreateCharacter (nyskapande); körs EFTER att aktören/dess primära och
   * yrkesfärdigheter redan finns, så `ensureSeeds` i special-ability-effects.mjs
   * kan se om en förmågas färdighet redan är täckt av det.
   *
   * ⚠ Prunar INTE själv (2026-08-16, ras-/yrkesramverket) — returnerar bara
   * sina `keepSlotIds`. Anropande kod måste kombinera dem med #applyRace-/
   * #applyProfessionAbilityGrants's motsvarande listor och pruna EN gång, se
   * pruneOrphanedAbilityGrants's docblock för varför (tre producenter delar
   * samma formaga-itemtyp och flagg-nyckel).
   * @returns {Promise<string[]>} keepSlotIds
   */
  async #applySpecialAbilityGrants(actor) {
    const keepSlotIds = [];
    for (const slot of this.state.specialAbilities) {
      if (!slot.name?.trim() || !slot.slotId) continue;
      keepSlotIds.push(slot.slotId);
      const resolved = resolveGrants(slot.effect, slot.effectChoices ?? []);
      await applyResolvedAbility(actor, slot.slotId, slot.name, slot.effect, resolved);
    }
    return keepSlotIds;
  }

  /**
   * Applicerar rasens automatiska förmågor (item-ras.mjs `automaticAbilities`)
   * på en redan skapad aktör — 2026-08-16, ras-/yrkesramverket (DESIGN_
   * DECISIONS.md backlog 70). Indexbaserade slotId:n är säkra här (till
   * skillnad från särskilda förmågors slumpade slotId:n): en ras förmågelista
   * är FAST kompendieinnehåll, aldrig omordnad av spelaren.
   * @returns {Promise<string[]>} keepSlotIds
   */
  async #applyRaceAbilityGrants(actor, raceDoc) {
    const rows = resolveRaceAbilityRows(raceDoc);
    const keepSlotIds = [];
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].effect) continue;
      const slotId = `race-ability-${i}`;
      keepSlotIds.push(slotId);
      const resolved = resolveGrants(rows[i].effect, []);
      await applyResolvedAbility(actor, slotId, rows[i].name || raceDoc.name, rows[i].effect, resolved, "ras");
    }
    return keepSlotIds;
  }

  /**
   * Applicerar yrkets automatiska förmågor (item-yrke.mjs `professionAbilities`,
   * inklusive basyrkets egna via resolveProfessionAbilityRows) — samma mönster
   * som #applyRaceAbilityGrants.
   * @returns {Promise<string[]>} keepSlotIds
   */
  async #applyProfessionAbilityGrants(actor, professionDoc, allProfessionDocs) {
    const rows = resolveProfessionAbilityRows(professionDoc, allProfessionDocs);
    const keepSlotIds = [];
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].effect) continue;
      const slotId = `profession-ability-${i}`;
      keepSlotIds.push(slotId);
      const resolved = resolveGrants(rows[i].effect, []);
      await applyResolvedAbility(actor, slotId, rows[i].name || professionDoc.name, rows[i].effect, resolved, "yrke");
    }
    return keepSlotIds;
  }

  /**
   * Köper +1 FV på en färdighet med EP — RP s.30. Knappen är redan `disabled`
   * i mallen när `skill.canIncrease` är falskt (inte nog EP kvar, eller
   * `maxStartFv` nådd), men `data-can-increase` speglas hit som en andra
   * spärr ifall action-anropet ändå triggas (t.ex. programmatisk klick vid
   * test) — ingen hård serverside-validering behövs för ett lokalt
   * wizard-state, men "lita inte blint på UI-disabled" är ändå god praxis.
   */
  static #onBuySkillFv(event, target) {
    const el = target.closest("[data-skill]");
    // `data-skill` bär färdighetens NYCKEL (skillKey), inte visningsnamnet.
    const key = el?.dataset.skill;
    if (!key || el.dataset.canIncrease !== "true") {
      ui.notifications.warn("Inte tillräckligt med EP kvar, eller max-FV vid skapande redan nådd.");
      return;
    }
    this.state.fardigheter[key] = (this.state.fardigheter[key] ?? 0) + 1;
    this.render();
  }

  /** Ångrar ett EP-köp på en färdighet (återbetalar EP:t implicit via omräkningen i #skillPreview). */
  static #onSellSkillFv(event, target) {
    const key = target.closest("[data-skill]")?.dataset.skill;
    if (!key) return;
    const current = this.state.fardigheter[key] ?? 0;
    if (current <= 0) return;
    this.state.fardigheter[key] = current - 1;
    this.render();
  }

  /**
   * Höjer ALLA färdigheter i en kategori ("primar"/"yrkesfardighet") med +1
   * FV var, i ett enda klick (Johan, 2026-08-16: "there would be good to
   * have +1 and -1 button all primary and all yrkesfärdigheter on category
   * level as one has to click a lot otherwise" — en primär-kategori kan ha
   * 16+ rader). Samma EP-/max-FV-kontroll som `#onBuySkillFv` görs per rad,
   * men räknas om LEVANDE mellan varje enskild höjning (inte en gång i
   * förväg) — annars skulle en tidig rad i listan kunna äta upp EP en SENARE
   * rad också hade haft råd med, och tvärtom en redan-otillräcklig kontroll
   * hade blockerat rader som blir prisvärda efter att en annan INTE höjdes.
   */
  static async #onBuyAllSkillFv(event, target) {
    const category = target.dataset.category;
    const raceDoc = this.state.raceUuid ? await fromUuid(this.state.raceUuid) : null;
    const professionDoc = this.state.professionUuid ? await fromUuid(this.state.professionUuid) : null;
    const effectiveAttributes = this.#effectiveAttributes(raceDoc, this.state.ageCategory);
    const epBudget = this.#epResult(this.#bpLedger(this.#socialStandingResult(), this.#startCapitalResult(this.#socialStandingResult())));
    const currentList = () => {
      const preview = this.#skillPreview(effectiveAttributes, professionDoc, epBudget, raceDoc);
      return category === "primar" ? preview.primary : preview.professionSkills;
    };
    for (const key of currentList().map((s) => s.key)) {
      const skill = currentList().find((s) => s.key === key);
      if (skill?.canIncrease) this.state.fardigheter[key] = (this.state.fardigheter[key] ?? 0) + 1;
    }
    this.render();
  }

  /** Sänker ALLA färdigheter i en kategori med −1 FV var (symmetrisk motpart till #onBuyAllSkillFv). */
  static #onSellAllSkillFv(event, target) {
    const category = target.dataset.category;
    const keys = category === "primar"
      ? CONFIG.DODE.primarySkills.map((s) => s.key)
      : this.state.professionSkillPicks
          .map((s) => s.key || CONFIG.DODE.skillKey(s.name))
          .filter((key, i, arr) => arr.indexOf(key) === i);
    for (const key of keys) {
      const current = this.state.fardigheter[key] ?? 0;
      if (current > 0) this.state.fardigheter[key] = current - 1;
    }
    this.render();
  }

  /** Köper 1 st av en utrustningspost — draget mot startCapital.finalSm, se #equipmentResult. */
  static #onBuyEquipment(event, target) {
    const el = target.closest("[data-uuid]");
    const uuid = el?.dataset.uuid;
    if (!uuid || el.dataset.canBuy !== "true") {
      ui.notifications.warn("Inte tillräckligt med startkapital kvar.");
      return;
    }
    this.state.equipment[uuid] = (this.state.equipment[uuid] ?? 0) + 1;
    this.render();
  }

  /** Säljer tillbaka 1 st (återbetalar kapitalet implicit via omräkningen i #equipmentResult). */
  static #onSellEquipment(event, target) {
    const uuid = target.closest("[data-uuid]")?.dataset.uuid;
    if (!uuid) return;
    const current = this.state.equipment[uuid] ?? 0;
    if (current <= 0) return;
    this.state.equipment[uuid] = current - 1;
    this.render();
  }

  /**
   * Guidens slutknapp. Skapaläge → #onCreateCharacter (oförändrad).
   * Redigeringsläge → #applyToActor, som ALDRIG skapar en ny aktör och aldrig
   * skapar om ras/yrke/utrustning (se klassdokblocket).
   */
  static async #onSubmitWizard() {
    if (this.isEditMode) return DoDECharacterWizard.#applyToActor.call(this);
    return DoDECharacterWizard.#onCreateCharacter.call(this);
  }

  /**
   * Sparar redigeringsläget tillbaka till en BEFINTLIG rollperson.
   *
   * ⚠ Kärnan i hela funktionen: ingenting får dubbleras. Att köra skaparvägen
   * igen hade gett en ANDRA ras-item — och eftersom rasbonusen är en
   * `transfer:true`-AE på det itemet hade rasbonusen applicerats två gånger
   * (exakt buggklassen som fixades i session 8). Därför:
   *   - Ras/yrke rörs inte alls (går inte att byta i redigeringsläge).
   *   - Utrustning rörs inte alls (steget hoppas över).
   *   - Ålders-AE:n rörs inte här — `updateActor`-hooken i dode.mjs sköter den
   *     automatiskt när `system.alder` ändras.
   *   - Färdigheter matchas på namn (skiftlägesokänsligt): uppdatera om de
   *     finns, skapa om de saknas, ta ALDRIG bort. "sekundar"-färdigheter
   *     (tillagda i spel) ligger utanför guidens steg och rörs aldrig.
   */
  static async #applyToActor() {
    const actor = this.actor;
    const raceDoc = this.state.raceUuid ? await fromUuid(this.state.raceUuid) : null;
    const professionDoc = this.state.professionUuid ? await fromUuid(this.state.professionUuid) : null;
    const effectiveAttributes = this.#effectiveAttributes(raceDoc, this.state.ageCategory);
    const socialResult = this.#socialStandingResult();
    const capitalResult = this.#startCapitalResult(socialResult);
    const bpLedger = this.#bpLedger(socialResult, capitalResult);
    const epBudget = this.#epResult(bpLedger);
    const skillPreview = this.#skillPreview(effectiveAttributes, professionDoc, epBudget, raceDoc);
    // Samma filtrerade lista som utrustningssteget använder (poster med
    // ActiveEffects är uteslutna där) — annars kan restkapitalet skilja sig
    // från det spelaren såg i steget.
    const shopDocs = (await DoDECharacterWizard.#resolveContentPacks("startingEquipment"))
      .filter((doc) => doc.effects.size === 0);
    const leftoverSm = this.#equipmentResult(shopDocs, capitalResult).remaining;
    this.state.bp.spentSvardshand = this.#swordHandBpSpent();
    this.state.bp.bonusHjaltedad = this.state.hjaltedad.bonusBP;

    await actor.update({
      name: this.state.name || actor.name,
      system: {
        kon: this.state.kon,
        niva: this.state.niva,
        bp: this.state.bp,
        hjaltepoang: this.state.hjaltedad.bonusHjaltepoang,
        swordHand: this.#swordHandResult().key ?? "hoger",
        socialStanding: this.state.socialStanding,
        startCapital: this.state.startCapital,
        // Kapitalet som blev över i utrustningssteget blir rollpersonens
        // faktiska börs. `startCapital` står kvar som skapandehistorik och
        // minskar aldrig; `currency` är det som spenderas i spel.
        currency: CONFIG.DODE.kmToPurse(CONFIG.DODE.silverToKm(Math.max(0, leftoverSm))),
        ep: { spent: skillPreview.epSpent },
        // Hjältedåd-rader (hjaltedadAbilities) läggs på OVANPÅ formagor-stegets
        // egna, fasta slots — se state-fältets docblock för varför de hålls
        // isär under hela wizard-sessionen.
        specialAbilities: [
          ...this.state.specialAbilities
            .filter((a) => a.name.trim().length > 0)
            .map((a) => ({ name: a.name, source: a.source, description: a.description })),
          ...this.state.hjaltedadAbilities.map((a) => ({
            name: a.name, source: a.source, description: a.description, slotId: a.slotId
          }))
        ],
        lifeGoal: this.state.lifeGoalCustom.trim() || this.state.lifeGoal,
        attributes: {
          sty: { value: this.state.attributes.sty },
          sto: { value: this.state.attributes.sto },
          fys: { value: this.state.attributes.fys },
          smi: { value: this.state.attributes.smi },
          int: { value: this.state.attributes.int },
          psy: { value: this.state.attributes.psy },
          kar: { value: this.state.attributes.kar }
        },
        alder: this.state.ageCategory
      },
      [`flags.${game.system.id}.wizardUnlocked`]: false
    });

    // Färdighetsavstämning — se dokblocket ovan.
    // ⚠ Matchning på NYCKEL, aldrig på visningsnamn (backlogpost 6a) — annars
    // skulle en rollperson skapad på ett språk och redigerad på ett annat tyst
    // få dubbletter. Äldre färdigheter utan `skillKey` får sin nyckel härledd
    // ur namnet, och backfillas nedan så att migreringen sker av sig själv.
    const existingByKey = new Map(
      actor.items
        .filter((i) => i.type === "fardighet")
        .map((i) => [i.system.skillKey || CONFIG.DODE.skillKey(i.name), i])
    );
    const toCreate = [];
    const toUpdate = [];
    for (const skill of [...skillPreview.primary, ...skillPreview.professionSkills]) {
      const existing = existingByKey.get(skill.key);
      if (existing) {
        const needsFv = existing.system.fv !== skill.fv;
        const needsTier = existing.system.costTier !== skill.costTier;
        const needsKey = existing.system.skillKey !== skill.key;
        const needsWeaponGroup = (existing.system.weaponGroup || "") !== (skill.weaponGroup || "");
        if (needsFv || needsTier || needsKey || needsWeaponGroup) {
          toUpdate.push({
            _id: existing.id,
            "system.fv": skill.fv,
            "system.costTier": skill.costTier,
            "system.skillKey": skill.key,
            "system.weaponGroup": skill.weaponGroup || ""
          });
        }
      } else {
        toCreate.push({
          name: skill.name,
          type: "fardighet",
          system: {
            skillKey: skill.key, attribute: skill.attribute, category: "a", fv: skill.fv,
            costTier: skill.costTier, weaponGroup: skill.weaponGroup || ""
          }
        });
      }
    }
    if (toUpdate.length) await actor.updateEmbeddedDocuments("Item", toUpdate);
    if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);

    // Ras-/yrkesramverket (2026-08-16) — samma "kombinera keepSlotIds, pruna
    // EN gång"-ordning som #onCreateCharacter, se pruneOrphanedAbilityGrants
    // docblock för varför.
    const allProfessionDocs = await DoDECharacterWizard.#resolveContentPacks("professions");
    const raceKeep = await this.#applyRaceAbilityGrants(actor, raceDoc);
    const professionKeep = await this.#applyProfessionAbilityGrants(actor, professionDoc, allProfessionDocs);
    const specialKeep = await this.#applySpecialAbilityGrants(actor);
    await pruneOrphanedAbilityGrants(actor, [...raceKeep, ...professionKeep, ...specialKeep]);

    ui.notifications.info(`${actor.name} uppdaterad via guiden.`);
    await this.close();
    actor.sheet.render(true);
  }

  static async #onCreateCharacter() {
    const raceDoc = this.state.raceUuid ? await fromUuid(this.state.raceUuid) : null;
    const professionDoc = this.state.professionUuid ? await fromUuid(this.state.professionUuid) : null;
    const effectiveAttributes = this.#effectiveAttributes(raceDoc, this.state.ageCategory);
    const socialResult = this.#socialStandingResult();
    const capitalResult = this.#startCapitalResult(socialResult);
    const bpLedger = this.#bpLedger(socialResult, capitalResult);
    const epBudget = this.#epResult(bpLedger);
    const skillPreview = this.#skillPreview(effectiveAttributes, professionDoc, epBudget, raceDoc);

    const { img, prototypeToken } = this.#tokenDefaults(raceDoc, professionDoc);
    this.state.bp.spentSvardshand = this.#swordHandBpSpent();
    this.state.bp.bonusHjaltedad = this.state.hjaltedad.bonusBP;

    const actor = await Actor.create({
      name: this.state.name || "Ny rollperson",
      type: "character",
      ...(img ? { img } : {}),
      prototypeToken,
      system: {
        kon: this.state.kon,
        niva: this.state.niva,
        bp: this.state.bp,
        hjaltepoang: this.state.hjaltedad.bonusHjaltepoang,
        swordHand: this.#swordHandResult().key ?? "hoger",
        socialStanding: this.state.socialStanding,
        startCapital: this.state.startCapital,
        ep: { spent: skillPreview.epSpent },
        // Bara ifyllda förmågerader sparas — tomma slots (spelaren lämnade en
        // eller flera outnyttjade) skräpar annars ner arkets kommande
        // förmågelista med tomma rader. Hjältedåd-rader läggs på ovanpå, se
        // state-fältets docblock.
        specialAbilities: [
          ...this.state.specialAbilities.filter((a) => a.name.trim().length > 0),
          ...this.state.hjaltedadAbilities
        ],
        lifeGoal: this.state.lifeGoalCustom.trim() || this.state.lifeGoal,
        attributes: {
          sty: { value: this.state.attributes.sty },
          sto: { value: this.state.attributes.sto },
          fys: { value: this.state.attributes.fys },
          smi: { value: this.state.attributes.smi },
          int: { value: this.state.attributes.int },
          psy: { value: this.state.attributes.psy },
          kar: { value: this.state.attributes.kar }
        },
        alder: this.state.ageCategory
      }
    });

    const itemsToCreate = [];
    // ⚠ `toObject()` bär INTE med sig `_stats.compendiumSource` — Foundry sätter
    // det bara vid riktig kompendieimport. Utan en egen källhänvisning kan
    // redigeringsläget inte koppla tillbaka den embeddade rasen/yrket till sitt
    // kompendiedokument (och räknar då baschansen utan rasbonus). Vi stämplar
    // därför en egen flagga; #loadStateFromActor läser den först.
    if (raceDoc) {
      const raceObj = raceDoc.toObject();
      raceObj.img = this.#genderedImg(raceDoc);
      foundry.utils.setProperty(raceObj, `flags.${game.system.id}.sourceUuid`, raceDoc.uuid);
      itemsToCreate.push(raceObj);
    }
    if (professionDoc) {
      const professionObj = professionDoc.toObject();
      professionObj.img = this.#genderedImg(professionDoc);
      foundry.utils.setProperty(professionObj, `flags.${game.system.id}.sourceUuid`, professionDoc.uuid);
      itemsToCreate.push(professionObj);
    }
    for (const skill of [...skillPreview.primary, ...skillPreview.professionSkills]) {
      itemsToCreate.push({
        name: skill.name,
        type: "fardighet",
        system: {
          skillKey: skill.key, attribute: skill.attribute, category: "a", fv: skill.fv,
          costTier: skill.costTier, weaponGroup: skill.weaponGroup || ""
        }
      });
    }
    // Magiskola — en skola ÄR en färdighet i regelverket (MAGI.md, se
    // DODE.magicSchoolSkills). FV höjs sedan med EP i färdighetssteget precis
    // som vilken annan yrkesfärdighet som helst.
    const school = CONFIG.DODE.magicSchoolSkills.find((s) => s.key === this.state.magicSchoolKey);
    if (school) {
      itemsToCreate.push({
        name: game.i18n.localize(school.labelKey),
        type: "fardighet",
        img: school.img,
        system: { skillKey: school.key, attribute: school.attribute, category: "a", fv: 1, costTier: "yrkesfardighet" }
      });
    }
    // Utrustning — en separat embeddad kopia per köpt enhet (Item-schemat har
    // inget `qty`-fält för HELA vapen/rustning, se klassdokblocket). Låga
    // MVP-kvantiteter förväntas (vapen/rustning, inte staplade pilar), så
    // detta är inget prestandaproblem.
    //
    // ⚠ Mängdköpta poster (backlog 66, "purchasable/usable entity" — gram/
    // dos/kagge-prissatt utrustning som Saffran/Sarassos) är UNDANTAGET: här
    // ÄR `qty` (t.ex. 20 gram) ett riktigt `system.quantity`-värde, inte "20
    // separata föremål" — item-utrustning.mjs har redan ett `quantity`-fält
    // som räknar totalvikt/-pris. 20 gram saffran ska bli EN item-rad med
    // quantity:20, inte 20 rader.
    for (const [uuid, qty] of Object.entries(this.state.equipment)) {
      if (qty <= 0) continue;
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      const isQuantityPurchase = doc.type === "utrustning"
        && !!CONFIG.DODE.parsePriceNote(doc.system.priceNote, doc.system.priceUnit);
      if (isQuantityPurchase) {
        itemsToCreate.push(foundry.utils.mergeObject(doc.toObject(), { _id: null, "system.quantity": qty }));
        continue;
      }
      // Varje köpt enhet måste bli ett eget embedded Item med eget _id — annars
      // kolliderar flera köp av samma kompendieföremål (samma _id från
      // toObject()) i en och samma createEmbeddedDocuments-anrop. `_id: null`
      // tvingar Foundry att generera ett nytt slumpat id per post.
      for (let i = 0; i < qty; i++) itemsToCreate.push({ ...doc.toObject(), _id: null });
    }
    if (itemsToCreate.length) await actor.createEmbeddedDocuments("Item", itemsToCreate);

    // Ras-/yrkesramverket (2026-08-16, DESIGN_DECISIONS.md backlog 70) — körs
    // EFTER att primära/yrkesfärdigheter redan finns (samma ordningsberoende
    // ensureSeeds i special-ability-effects.mjs kräver för särskilda
    // förmågor). Kombinerad prune, se pruneOrphanedAbilityGrants docblock.
    const allProfessionDocs = await DoDECharacterWizard.#resolveContentPacks("professions");
    const raceKeep = await this.#applyRaceAbilityGrants(actor, raceDoc);
    const professionKeep = await this.#applyProfessionAbilityGrants(actor, professionDoc, allProfessionDocs);
    const specialKeep = await this.#applySpecialAbilityGrants(actor);
    await pruneOrphanedAbilityGrants(actor, [...raceKeep, ...professionKeep, ...specialKeep]);

    const ageMods = CONFIG.DODE.ageAttributeModifiers[this.state.ageCategory] ?? {};
    const ageAeChanges = Object.entries(ageMods)
      .filter(([, v]) => v !== 0)
      .map(([key, value]) => ({
        key: `system.attributes.${key}.bonus`,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: String(value)
      }));
    if (ageAeChanges.length) {
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        name: `Åldersmod (${this.state.ageCategory})`,
        changes: ageAeChanges,
        origin: "system.age",
        transfer: false,
        disabled: false,
        [`flags.${game.system.id}.source`]: "age"
      }]);
    }

    await this.close();
    actor.sheet.render(true);
  }
}
