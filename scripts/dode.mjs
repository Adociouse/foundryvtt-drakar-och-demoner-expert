import DoDECharacterData from "./data/actor-character.mjs";
import DoDENpcData from "./data/actor-npc.mjs";
import DoDEHandlareData from "./data/actor-handlare.mjs";
import DoDEFardighetData from "./data/item-fardighet.mjs";
import DoDERasData from "./data/item-ras.mjs";
import DoDEYrkeData from "./data/item-yrke.mjs";
import DoDEVapenData from "./data/item-vapen.mjs";
import DoDERustningData from "./data/item-rustning.mjs";
import DoDEUtrustningData from "./data/item-utrustning.mjs";
import DoDEBesvarjelseData from "./data/item-besvarjelse.mjs";
import DoDEMinibesvarjelseData from "./data/item-minibesvarjelse.mjs";
import DoDEFormagaData from "./data/item-formaga.mjs";
import DoDEActor from "./documents/actor.mjs";
import DoDeActiveEffect from "./documents/dode-active-effect.mjs";
import DoDeItem from "./documents/item.mjs";
import SceneEffects from "./utils/scene-effects.mjs";
import DoDECharacterSheet from "./sheets/actor-character-sheet.mjs";
import DoDENpcSheet from "./sheets/actor-npc-sheet.mjs";
import DoDEHandlareSheet from "./sheets/actor-handlare-sheet.mjs";
import {
  DoDEFardighetSheet,
  DoDERasSheet,
  DoDEYrkeSheet,
  DoDEVapenSheet,
  DoDERustningSheet,
  DoDEUtrustningSheet,
  DoDEBesvarjelseSheet,
  DoDEMinibesvarjelseSheet,
  DoDEFormagaSheet
} from "./sheets/item-sheet.mjs";
import DoDECharacterWizard from "./apps/character-wizard.mjs";
import DoDETrainingApp from "./apps/training.mjs";
import DoDETimeWindow from "./apps/time-window.mjs";
import DoDEMagicTrainingApp from "./apps/magic-training.mjs";
import DoDEGmEffectsApp from "./apps/gm-effects.mjs";
import DoDEAttackDialog from "./apps/attack-dialog.mjs";
import DoDESpellDialog from "./apps/spell-dialog.mjs";
import DoDECombatTracker from "./apps/combat-tracker.mjs";
import { DODE } from "./helpers/config.mjs";
import { resolveAttack, applyAttackResult, postAttackCard } from "./rolls/attack.mjs";
import { resolveSpellCast, applySpellResult, postSpellCard } from "./rolls/spell.mjs";
import { resolveTwoAttacks, canUseTwoWeapons, effectiveSkillFv, TWO_WEAPON_OPTIONS } from "./rolls/dual-wield.mjs";
import { applyLoot } from "./rolls/loot.mjs";
import { applySell } from "./rolls/sell.mjs";

const SYSTEM_ID = "drakar-och-demoner-expert";

Hooks.once("init", () => {
  console.log("Drakar och Demoner Expert | Initierar system");

  CONFIG.DODE = DODE;
  CONFIG.Actor.documentClass = DoDEActor;
  CONFIG.ActiveEffect.documentClass = DoDeActiveEffect;
  CONFIG.Item.documentClass = DoDeItem;

  // DoDE-specifika villkor i Foundrys egen statuseffekt-lista — se
  // docs/dev/GM_EFFEKTFONSTER_ANALYS.md. En gång registrerade dyker de upp i
  // Token HUD automatiskt (rutans egen native toggle-UI, ingen egen byggd här)
  // och blir riktiga ActiveEffects med `statuses:[id]` när de sätts på.
  // ⚠ Rent villkorsflaggor (typ 4 i effektanalysen) — ingen egen mekanik
  // hänger på själva togglen, det är den framtida handlingsekonomin (Part 5)
  // som frågar `DODE.actorConditions(actor)` innan den tillåter en handling.
  for (const status of [
    {
      id: "armObrukbar",
      name: "DODE.Status.ArmObrukbar",
      img: "systems/drakar-och-demoner-expert/assets/tokens/statuseffekter/arm-obrukbar.png"
    },
    {
      id: "handUpptagen",
      name: "DODE.Status.HandUpptagen",
      img: "systems/drakar-och-demoner-expert/assets/tokens/statuseffekter/hand-upptagen.png"
    }
  ]) {
    CONFIG.statusEffects.push(status);
  }

  // Utökad Combat Tracker (ABS + snabbanfallsknapp per rad) — MÅSTE sättas här
  // (init), inte i ready: Game#initializeUI() instansierar CONFIG.ui.* strikt
  // mellan setup- och ready-hookarna, se planen "Stridsflödets 'smoothness'".
  CONFIG.ui.combat = DoDECombatTracker;

  Object.assign(CONFIG.Actor.dataModels, {
    character: DoDECharacterData,
    npc: DoDENpcData,
    handlare: DoDEHandlareData
  });
  Object.assign(CONFIG.Item.dataModels, {
    fardighet: DoDEFardighetData,
    ras: DoDERasData,
    yrke: DoDEYrkeData,
    vapen: DoDEVapenData,
    rustning: DoDERustningData,
    utrustning: DoDEUtrustningData,
    besvarjelse: DoDEBesvarjelseData,
    minibesvarjelse: DoDEMinibesvarjelseData,
    formaga: DoDEFormagaData
  });

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("drakar-och-demoner-expert", DoDECharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "DODE.Sheet.Character"
  });
  Actors.registerSheet("drakar-och-demoner-expert", DoDENpcSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "DODE.Sheet.Npc"
  });
  Actors.registerSheet("drakar-och-demoner-expert", DoDEHandlareSheet, {
    types: ["handlare"],
    makeDefault: true,
    label: "DODE.Sheet.Handlare"
  });

  Items.unregisterSheet("core", ItemSheet);
  const itemSheets = [
    ["fardighet", DoDEFardighetSheet],
    ["ras", DoDERasSheet],
    ["yrke", DoDEYrkeSheet],
    ["vapen", DoDEVapenSheet],
    ["rustning", DoDERustningSheet],
    ["utrustning", DoDEUtrustningSheet],
    ["besvarjelse", DoDEBesvarjelseSheet],
    ["minibesvarjelse", DoDEMinibesvarjelseSheet],
    ["formaga", DoDEFormagaSheet]
  ];
  for (const [type, sheetClass] of itemSheets) {
    Items.registerSheet("drakar-och-demoner-expert", sheetClass, {
      types: [type],
      makeDefault: true,
      label: `TYPES.Item.${type}`
    });
  }

  /**
   * Systeminställningar. Först registrerade inställningarna i projektet
   * (stängde backlogpost 5:s "noll game.settings.register någonstans").
   *
   * ⚠ RÄTTELSE 2026-08-02: tre inställningar som styrde grundegenskapernas
   * SLAGsystem (`attributeRollMode`, `allowRestartIfUnqualified`,
   * `showAttributeRollsInChat`) är borttagna härifrån. RP s.23 visade sig
   * vara ett köpsystem, inte ett slagsystem (se config.mjs
   * DODE.attributeBuyCumulative och DESIGN_DECISIONS.md backlog för hela
   * utredningen) — alla tre inställningarna configurerade slagvarianter som
   * inte längre existerar. Foundry tappar bort registrerade world-settings
   * ur config-UI:t automatiskt när systemet slutar registrera dem; ingen
   * migrering behövs.
   */

  // Träningsavgift per veckopass med lärare.
  //
  // ⚠ AVSTEG FRÅN GRUNDREGLERNA — beslutat av Johan 2026-07-29.
  // REG s.45 anger 150 sm/vecka som grundkostnad och 300 sm/vecka för en
  // magikerlärare, med multiplikatorer ovanpå (×1,5 för elev av annan ras, ×2 för
  // liten klass, × lärarens INT för ensam elev). MAG lägger dessutom på dubbel
  // taxa för besvärjelseträning. Vi tar i stället en FAST avgift per pass, som
  // standard 300 sm, och sätter ingen gräns för hur många färdigheter som kan
  // tränas samma vecka. Johans motivering: reglerna säger inte att man inte får
  // träna flera färdigheter under samma vecka, och vad pengarna går till —
  // lärare, material, lokal — är SL:s beskrivning, inte en mekanik. En siffra
  // som SL kan ändra slår en trappa av multiplikatorer som ingen slår upp vid
  // bordet. Bokens riktiga tabell finns i det kurerade extraktet
  // DODE_Regler_TRANING_EP.md för den som vill räkna exakt.
  game.settings.register(SYSTEM_ID, "trainingFeePerWeek", {
    name: "Träningsavgift per pass (sm)",
    hint: "Dras ur rollpersonens börs vid träning med lärare. Bokens grundkostnad är "
      + "150 sm/vecka (magiker 300 sm) plus multiplikatorer; 300 är en fast förenkling "
      + "av det. Ensamträning är alltid gratis.",
    scope: "world",
    config: true,
    restricted: true,
    type: Number,
    default: 300
  });

  // Varaktighet för "det rena utslaget" — se resolveAttack i rolls/attack.mjs.
  // ⚠ AVSTEG utan bokstöd (Johan 2026-07-29); därför en inställning och inte en
  // konstant, så varje bord kan sätta hur brutal tjuvfantasin får vara.
  // Världseffekter (GM-effektfönstret, Part 1) — en lista, inte ett enskilt
  // värde, så `config:false`: redigeras via fönstret (DODE.addWorldEffect/
  // removeWorldEffect i config.mjs), aldrig som rå Settings-JSON i UI:t.
  game.settings.register(SYSTEM_ID, "worldEffects", {
    name: "Världseffekter (GM-effektfönstret)",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // Hjältedåd-antal per nivå — HUSREGEL, INTE grundregler.
  //
  // ⚠ EJ STANDARDREGLER. HH s.6-7 anger bara "slå 1T6" för hur många gånger en
  // hjälte-nivå (Slumpens hjälte/Sann hjälte/Gudafödd) får slå på
  // hjältedådstabellen — samma 1T6 oavsett vilken av de tre nivåerna, se
  // #onRollHjaltedadCount. Johan (2026-08-07), efter att ha kört
  // hjältemenyn många gånger: en flat 1T6 gör att en Gudafödd statistiskt
  // inte alls skiljer sig från en Slumpens hjälte i antal slag, trots att de
  // ska vara mekaniskt olika sällsynta/mäktiga (HH s.37-39). Han vill ha en
  // ALTERNATIV formel tillgänglig som en avstängningsbar SL-inställning för
  // sin egen kampanj — INTE som ny systemstandard för alla bord. Default
  // `false` (av) medvetet: byter man på den ändrar man en tryckt regel, ett
  // beslut varje bord ska ta själva, inte något systemet ska välja åt dem.
  // Formlerna (DODE.hjaltedadCountHouseRule, config.mjs) är Johans egna,
  // inte bokkällade: Slumpens hjälte 1T2, Sann hjälte 2+1T2, Gudafödd 4+1T2.
  game.settings.register(SYSTEM_ID, "hjaltedadTieredRollCount", {
    name: "Hjältedåd: nivåstyrt antal slag (HUSREGEL)",
    hint: "⚠ INTE en grundregel — HH s.6-7 säger \"slå 1T6\" för alla tre hjälte-nivåer "
      + "lika. Om påslagen ersätts det gemensamma 1T6 med en formel per nivå (Slumpens "
      + "hjälte 1T2, Sann hjälte 2+1T2, Gudafödd 4+1T2), så nivåerna faktiskt skiljer sig "
      + "åt i hur många gånger man får slå. Av som standard — ett medvetet bordsval, inte "
      + "en systemrekommendation.",
    scope: "world",
    config: true,
    restricted: true,
    type: Boolean,
    default: false
  });

  game.settings.register(SYSTEM_ID, "cleanKnockoutDuration", {
    name: "Rent utslag — varaktighet (dygn)",
    hint: "Tärningsformel för hur länge ett perfekt, riktat och bedövande huvudslag "
      + "håller offret medvetslöst. Slaget gör ingen skada alls och lämnar inga spår.",
    scope: "world",
    config: true,
    restricted: true,
    type: String,
    default: "1d3"
  });

  // ⚠ HOMEBREW, av som standard. Johans uttryckliga fråga 2026-08-21 under
  // krogslagsmålet: SLB s.17s "Perfekt → automatisk maximal skada, rustning
  // dras ej bort" gäller ORDAGRANT bara anfallsslag/pareringsslag (se
  // spell.mjs's docblock för resonemanget om varför besvärjelser INTE fick
  // samma regel per default — tabellen är strukturerad kring en pareringsrulle
  // besvärjelser saknar). Johan bad uttryckligen om en SL-växlingsbar
  // inställning i stället för ett hårdkodat ja/nej, så olika bord kan välja.
  // Bara skadan maximeras (samma teknik som redan används för vapen — riktiga
  // tärningar slås och visas, men SUMMAN räknas som om varje tärning visade
  // sitt högsta värde) — motstånd/reduktion dras fortfarande av som vanligt,
  // ingen "rustning dras ej bort"-motsvarighet för magiskt motstånd inbyggd.
  game.settings.register(SYSTEM_ID, "perfectSpellMaxDamage", {
    name: "Perfekt besvärjelse ger maximal skada (husregel)",
    hint: "Av som standard: MAGI.md:s egen regel för Perfekt (halv PSY-kostnad) är den "
      + "kompletta, avsiktliga regeln — SLB s.17:s maxskada-regel för vapen gäller inte "
      + "besvärjelser i grundutförandet (ingen pareringsrulle att hänga upp den på). "
      + "På: en Perfekt skadebesvärjelse räknar sin skada som om alla tärningar visade "
      + "sitt högsta värde (riktiga tärningar slås och syns ändå). Magiskt motstånd/"
      + "reduktion dras fortfarande av som vanligt.",
    scope: "world",
    config: true,
    restricted: true,
    type: Boolean,
    default: false
  });

  // Initiativ — **Spelledarboken s.16**: "Först i stridsrundan ska alla
  // stridsdeltagare slå ett initiativslag, 1T10+SMI (plus eventuella övriga
  // modifikationer). De som får ett högt resultat får agera före de som får ett
  // lågt. Om två deltagare får samma resultat låter man dem slå om."
  //
  // ⚠ Utan detta faller Foundry tillbaka på sitt eget `1d20`, helt frikopplat
  // från rollpersonen — det gällde fram till 2026-07-29, och drabbade även
  // moduler som Combat Carousel som bara läser systemets formel.
  //
  // ⚠ KÄLLKONFLIKT: grundregelboken (REG s.56, via REGLER_STRID.md) har en HELT
  // annan turordning — statisk SMI-jämförelse där högst SMI agerar först, med
  // 1T6 enbart som skiljeslag, plus att vapenlängd alltid går först i stridens
  // första SR. Vi följer SLB eftersom det är den enda av de två som går att
  // uttrycka som en Foundry-initiativformel. Se DESIGN_DECISIONS.md post 47/48.
  //
  // ⚠ Modifikationerna (Krigare +5, Karate +5, Hoppspark/Rundspark −2,
  // stridskonsttekniken Initiativbonus +5) ligger INTE i formeln — de är
  // situationsberoende och hör till stridslogiken.
  CONFIG.Combat.initiative = {
    formula: "1d10 + @attributes.smi.total",
    decimals: 0
  };

  // Delade delmallar måste laddas innan {{> "path"}} kan användas.
  foundry.applications.handlebars.loadTemplates([
    "systems/drakar-och-demoner-expert/templates/apps/training-header.hbs",
    "systems/drakar-och-demoner-expert/templates/apps/training-rows.hbs",
    "systems/drakar-och-demoner-expert/templates/apps/wizard-skill-slot.hbs",
    "systems/drakar-och-demoner-expert/templates/apps/gm-effects-list.hbs",
    "systems/drakar-och-demoner-expert/templates/apps/gm-effects-form.hbs"
  ]);

  game.dode = {
    // Med en aktör: redigeringsläge, öppnar alltid direkt (används av arkets
    // egna "Redigera i guiden"-knapp, som redan vet vilken rollperson).
    //
    // Utan argument (den generiska "Ny rollperson"-knappen): guiden avgör
    // själv vad som ska hända, i stället för att alltid anta skapaläge.
    // ⚠ **GM hoppar över allt det här** — en GM äger alla aktörer (bypassar
    // behörighetskontrollen), så "vilken av dina rollpersoner" har inget
    // meningsfullt svar för GM, och GM redigerar en specifik rollperson via
    // arkets egen knapp. GM:s skärm ska heller inte ryckas till guidescenen
    // mitt i en pågående session — se character-wizard.mjs #enterWizardScene.
    //
    // För en spelare: 0 ägda rollpersoner → skapaläge. 1 → rakt in i
    // redigeringsläge, ingen anledning att fråga. 2+ → en väljare (eller
    // "skapa en till"), eftersom en spelare KAN äga flera rollpersoner
    // (t.ex. efter en död mitt i ett äventyr) och guiden annars gissar fel.
    async openCharacterWizard(actor = null) {
      if (actor || game.user.isGM) {
        return new DoDECharacterWizard(actor ? { actor } : {}).render(true);
      }
      const owned = game.actors.filter((a) => a.type === "character" && a.isOwner);
      if (owned.length <= 1) {
        return new DoDECharacterWizard(owned[0] ? { actor: owned[0] } : {}).render(true);
      }
      const picked = await DoDECharacterWizard.pickCharacter(owned);
      if (picked === undefined) return null; // avbrutet
      // ⚠ Sentinelvärdet är strängen "new", inte null — se pickCharacter().
      return new DoDECharacterWizard(picked !== "new" ? { actor: picked } : {}).render(true);
    },
    // Träningsfönstret — omsättning av EP till FV efter viloperiod (REG s.46).
    // Tidsfonstret — SL:s enda stalle for att flytta klockan utanfor strid (§10).
    openTimeWindow: () => new DoDETimeWindow().render(true),
    openTraining: (actor) => new DoDETrainingApp(actor).render(true),
    // Magi har ett eget fönster — EP-källorna skiljer sig från vanliga
    // färdigheters (SB s.7), se apps/magic-training.mjs.
    openMagicTraining: (actor) => new DoDEMagicTrainingApp(actor).render(true),
    // GM-effekter (skillMod/clMod/recoveryMod + periodiska effekter) — se
    // docs/dev/GM_EFFEKTFONSTER_ANALYS.md. Författningsyta, ingen egen
    // datamodell; öppnas även från Aktörskatalogens header-knapp (GM-only).
    openGmEffects: () => new DoDEGmEffectsApp().render(true),
    // Anfallsdialogen (detaljerad strid) — normalt öppnad via en vapen-/
    // anfallsrads egen knapp, konsolparitet för SL: game.dode.openAttackDialog(actor, {weapon}).
    openAttackDialog: (actor, opts) => new DoDEAttackDialog(actor, opts).render(true),
    // Kast-dialogen (Magisystem-planen Fas 3) — normalt öppnad via en
    // besvärjelserads egen knapp, konsolparitet för SL: game.dode.openSpellDialog(actor, {item}).
    openSpellDialog: (actor, opts) => new DoDESpellDialog(actor, opts).render(true),
    // Stridsupplösning — SLB s.16-18. GM: game.dode.resolveAttack({attacker, weapon, target, ...})
    // `applyAttackResult` skriver ett `resolveAttack()`-resultats pending-fält
    // (EP/slitage/skada) — se Spelar-anfall-planen, 2026-08-21, och
    // renderChatMessageHTML-hooken nedan för godkännande-flödet som anropar den.
    resolveAttack, applyAttackResult, postAttackCard,
    // Besvärjelsekastning mot mål — MAGI.md, Fas 2 (2026-08-21). Mirror av
    // resolveAttack/applyAttackResult/postAttackCard ovan, se rolls/spell.mjs
    // för hela pending/apply-uppdelningen. GM/konsol: game.dode.resolveSpellCast(
    // {caster, item, effektgrad, targets}).
    resolveSpellCast, applySpellResult, postSpellCard,
    // Scen-/miljömodifikationer via ActiveEffects (flags.<system.id>.source:"scene").
    // GM: game.dode.SceneEffects.applyToScene({ name, changes:[...] }) / removeFromScene(name).
    SceneEffects,
    // Två vapen — RP s.59. GM: game.dode.resolveTwoAttacks({attacker, primaryWeapon,
    // primarySkill, offWeapon, offSkill, primaryTarget, combo}).
    resolveTwoAttacks, canUseTwoWeapons, effectiveSkillFv, TWO_WEAPON_OPTIONS,
    // Snabbanfall-hotbarmakron (se hotbarDrop-hooken nedan) anropar detta —
    // löser aktören mot VILKEN TOKEN SOM JUST DÅ ÄR VALD, inte den aktör som
    // råkade vara vald när makrot skapades. Namn, inte ID: `weaponOrAttackName`
    // slås upp på nytt varje klick, samma etablerade namn-matchningskonvention
    // som resten av stridssystemet (se rolls/dual-wield.mjs).
    declareAttackMacro(weaponOrAttackName) {
      const actor = ChatMessage.getSpeakerActor(ChatMessage.getSpeaker());
      if (!actor) return ui.notifications.warn("Ingen token vald.");
      if (actor.type === "npc") {
        const index = actor.system.attacks.findIndex((a) => a.name === weaponOrAttackName);
        if (index < 0) return ui.notifications.warn(`${actor.name} har inget anfall som heter "${weaponOrAttackName}".`);
        return game.dode.openAttackDialog(actor, { npcAttackIndex: index });
      }
      const weapon = actor.items.find((i) => i.type === "vapen" && i.name === weaponOrAttackName);
      if (!weapon) return ui.notifications.warn(`${actor.name} har inget vapen som heter "${weaponOrAttackName}".`);
      return game.dode.openAttackDialog(actor, { weapon });
    },
    // Samma mönster som declareAttackMacro ovan, för besvärjelser (se
    // hotbarDrop-hooken nedan) — namn slås upp färskt mot vilken token som
    // just då är vald, inte den aktör som råkade vara vald vid dragtillfället.
    declareSpellCastMacro(spellName) {
      const actor = ChatMessage.getSpeakerActor(ChatMessage.getSpeaker());
      if (!actor) return ui.notifications.warn("Ingen token vald.");
      const spell = actor.items.find((i) => ["besvarjelse", "minibesvarjelse"].includes(i.type) && i.name === spellName);
      if (!spell) return ui.notifications.warn(`${actor.name} kan inte "${spellName}".`);
      return game.dode.openSpellDialog(actor, { item: spell });
    }
  };
});

/**
 * Dra ett vapen- ELLER besvärjelse-item till hotbaren → skapar ett makro som
 * anfaller/kastar med det, löst mot vilken token som är vald VID
 * KLICKTILLFÄLLET (inte dragtillfället) — se game.dode.declareAttackMacro/
 * declareSpellCastMacro ovan. Samma mönster dnd5e:s hotbarDrop-hantering
 * redan bevisat (dnd5e.mjs, `create5eMacro`), byggt på ren Foundry-kärn-API
 * (`hotbarDrop`-hooken, `ChatMessage.getSpeaker`) — inget dnd5e-specifikt
 * lånas in.
 *
 * ⚠ Registreras i `ready`, INTE `init` — till skillnad från `CONFIG.ui.combat`
 * fyrar `hotbarDrop` bara senare vid ett användarklick, så tidpunkten spelar
 * ingen roll för korrekthet (samma resonemang dnd5e:s egen kodkommentar ger).
 * Egen `ready`-hook, inte den GM-låsta nedan — en spelare ska kunna dra sitt
 * eget vapen/besvärjelse till sin egen hotbar utan att vara SL.
 */
Hooks.once("ready", () => {
  const HOTBAR_MACRO_TYPES = {
    vapen: "declareAttackMacro",
    besvarjelse: "declareSpellCastMacro",
    minibesvarjelse: "declareSpellCastMacro"
  };
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    if (data.type !== "Item") return;
    (async () => {
      const item = await Item.implementation.fromDropData(data);
      const fn = HOTBAR_MACRO_TYPES[item?.type];
      if (!fn) return; // låt kärnans generiska fallback ta över
      const command = `game.dode.${fn}(${JSON.stringify(item.name)})`;
      const macro = game.macros.find((m) => m.name === item.name && m.command === command && m.isAuthor)
        ?? await Macro.create({ name: item.name, type: "script", img: item.img, command, author: game.user.id });
      await game.user.assignHotbarMacro(macro, slot);
    })();
    return false;
  });
});

/**
 * Skapar en lås-och-markera-funktion för EN väntande-flagga på ett kort.
 * Delad mellan anfalls- och besvärjelsegrenarna nedan (den senare tillagd i
 * Magisystem-planens Fas 3, 2026-08-21 — generaliserad från den
 * ursprungliga, anfalls-bara hooken samma dag).
 *
 * ⚠ Läser FÄRSKT flagg-tillstånd (inte en stängd variabel från renderingen)
 * och sätter `processed` FÖRST, innan någon skrivning görs — skydd mot att
 * två SL-klienter som klickar samtidigt kör samma godkännande två gånger.
 * Samma "läs senaste tillstånd, lås innan skrivning"-disciplin som
 * periodeffekt-kön (config.mjs `_queuePerActor`) redan etablerat.
 *
 * ⚠ Manipulerar DOM:en direkt och sparar tillbaka `element.innerHTML` som
 * nytt `content` i stället för att rendera om hela mallen via
 * `renderTemplate` — skrivningen (`applyAttackResult`/`applySpellResult`)
 * behöver bara `pending` (redan ren JSON-data i flaggan), aldrig hela det
 * ursprungliga resultatet (som bar `Roll`-instanser bara relevanta för DEN
 * URSPRUNGLIGA postningens Dice So Nice-animation).
 */
function makeLockAndMark(message, html, flagKey) {
  return async (note) => {
    const latest = game.messages.get(message.id)?.getFlag(game.system.id, flagKey);
    if (!latest || latest.processed) { ui.notifications.info("Redan hanterat av en annan SL-klient."); return false; }
    await message.setFlag(game.system.id, flagKey, { ...latest, processed: true });
    html.querySelector(".pending-banner")?.replaceWith(
      Object.assign(document.createElement("div"), { className: "processed-note", textContent: note })
    );
    html.querySelector(".pending-actions")?.remove();
    await message.update({ content: html.innerHTML });
    return true;
  };
}

/**
 * Godkännande/avvisning av väntande spelar-anfall OCH -besvärjelser —
 * Spelar-anfall-planen (2026-08-21) resp. Magisystem-planens Fas 3
 * (2026-08-21, samma dag). Kortet är redan fullt beräknat och postat med
 * spelarens EGNA tärningar (se attack.mjs/spell.mjs's `pending`-parameter)
 * — SL:s Godkänn kör INGET nytt tärningsslag, bara den deferrade
 * skrivningen. Bara SL ser knapparna göra något (kortet självt är publikt,
 * alla ser resultatet) — `renderChatMessageHTML` fyrar för ALLA klienter,
 * `!game.user.isGM`-vakten gör resten till en no-op för spelare.
 *
 * ⚠ `html` är ett RIKTIGT `HTMLElement` i den här Foundry-versionen (inte
 * jQuery) — `renderChatMessageHTML` ersatte den äldre `renderChatMessage`
 * specifikt för det (common/documents/chat-message.mjs).
 */
Hooks.on("renderChatMessageHTML", (message, html) => {
  if (!game.user.isGM) {
    // ⚠ Live-fynd 2026-08-21: Godkänn/Avvisa-knapparna ligger i kortets
    // HTML-innehåll (synligt för ALLA som ser meddelandet), men bara GM:s
    // klient kopplar in en klicklyssnare (se gaten nedan) — en spelare som
    // klickade dem fick alltså inget att hända alls, utan felmeddelande.
    // Ta bort dem helt för icke-GM, lämna bara väntar-bandet kvar.
    html.querySelectorAll(".pending-actions").forEach((el) => el.remove());
    return;
  }

  const attackFlag = message.getFlag(game.system.id, "pendingAttack");
  if (attackFlag && !attackFlag.processed) {
    const approveBtn = html.querySelector('[data-action="approveAttackRequest"]');
    const rejectBtn = html.querySelector('[data-action="rejectAttackRequest"]');
    if (approveBtn || rejectBtn) {
      const lockAndMark = makeLockAndMark(message, html, "pendingAttack");

      approveBtn?.addEventListener("click", async () => {
        // ⚠ `fromUuidSync`, INTE `game.actors.get(id)` (rättat 2026-08-21,
        // hittat under Magisystem-passets Fas 3-liveverifiering — se
        // attack.mjs:s postAttackCard-kommentar för hela orsaken: en olänkad
        // NPC-tokens `.id` är delat med bas-aktören, `game.actors.get` hade
        // alltid gett bas-objektet, inte den specifika token-instans som
        // faktiskt förhandsvisades/målsattes).
        const attacker = attackFlag.attackerUuid ? fromUuidSync(attackFlag.attackerUuid) : null;
        const target = attackFlag.targetUuid ? fromUuidSync(attackFlag.targetUuid) : null;
        if (!attacker || !target) { ui.notifications.error("Anfallaren eller målet finns inte längre — kan inte godkänna."); return; }
        if (!(await lockAndMark(`✅ Godkänt av ${game.user.name}`))) return;
        const pending = attackFlag.pending ?? {};
        const weapon = pending.wear?.side === "attacker" ? attacker.items.get(pending.wear.itemId) : null;
        const parryItem = pending.wear?.side === "defender" ? target.items.get(pending.wear.itemId) : null;
        try {
          await applyAttackResult({ pending }, { attacker, target, weapon, parryItem });
        } catch (err) {
          console.error("DoDE | applyAttackResult misslyckades efter godkännande", err);
          ui.notifications.error("Kunde inte skriva anfallets resultat — se konsolen.");
        }
      });

      rejectBtn?.addEventListener("click", () => lockAndMark(`❌ Avvisat av ${game.user.name}`));
    }
  }

  // Besvärjelsegodkännande — Magisystem-planen Fas 3 (2026-08-21). Speglar
  // anfallsgrenen exakt; se spell.mjs's postSpellCard/applySpellResult för
  // vad `pending`/`itemId` bär. `targets.length !== targetIds.length`
  // fångar en raderad aktör bland flera mål — samma "hellre avbryt än
  // applicera på ett ofullständigt målurval"-princip som ett saknat enda mål
  // redan följer i anfallsgrenen.
  const spellFlag = message.getFlag(game.system.id, "pendingSpell");
  if (spellFlag && !spellFlag.processed) {
    const approveSpellBtn = html.querySelector('[data-action="approveSpellRequest"]');
    const rejectSpellBtn = html.querySelector('[data-action="rejectSpellRequest"]');
    if (approveSpellBtn || rejectSpellBtn) {
      const lockAndMarkSpell = makeLockAndMark(message, html, "pendingSpell");

      approveSpellBtn?.addEventListener("click", async () => {
        // ⚠ `fromUuidSync`, se attack-grenens motsvarande kommentar ovan —
        // samma rot-orsak (delat `.id` mellan en olänkad NPC-tokens
        // synthetic actor och bas-aktören i `game.actors`).
        const caster = spellFlag.casterUuid ? fromUuidSync(spellFlag.casterUuid) : null;
        const item = caster?.items.get(spellFlag.itemId);
        const targetUuids = spellFlag.targetUuids ?? [];
        const targets = targetUuids.map((uuid) => fromUuidSync(uuid)).filter(Boolean);
        if (!caster || !item || targets.length !== targetUuids.length) {
          ui.notifications.error("Kastaren, besvärjelsen eller ett mål finns inte längre — kan inte godkänna.");
          return;
        }
        if (!(await lockAndMarkSpell(`✅ Godkänt av ${game.user.name}`))) return;
        try {
          await applySpellResult({ pending: spellFlag.pending, item }, { caster, targets });
        } catch (err) {
          console.error("DoDE | applySpellResult misslyckades efter godkännande", err);
          ui.notifications.error("Kunde inte skriva besvärjelsens resultat — se konsolen.");
        }
      });

      rejectSpellBtn?.addEventListener("click", () => lockAndMarkSpell(`❌ Avvisat av ${game.user.name}`));
    }
  }

  // Plundringsgodkännande — se rolls/loot.mjs för hela resonemanget. Samma
  // mönster som anfall/besvärjelser, men här finns inget att förhandsberäkna
  // (inget slag) — godkännande KÖR själva överföringen, den enda skrivningen.
  const lootFlag = message.getFlag(game.system.id, "pendingLoot");
  if (lootFlag && !lootFlag.processed) {
    const approveLootBtn = html.querySelector('[data-action="approveLootRequest"]');
    const rejectLootBtn = html.querySelector('[data-action="rejectLootRequest"]');
    if (approveLootBtn || rejectLootBtn) {
      const lockAndMarkLoot = makeLockAndMark(message, html, "pendingLoot");

      approveLootBtn?.addEventListener("click", async () => {
        if (!(await lockAndMarkLoot(`✅ Godkänt av ${game.user.name}`))) return;
        try {
          await applyLoot(lootFlag);
        } catch (err) {
          console.error("DoDE | applyLoot misslyckades efter godkännande", err);
          ui.notifications.error("Kunde inte genomföra plundringen — se konsolen.");
        }
      });

      rejectLootBtn?.addEventListener("click", () => lockAndMarkLoot(`❌ Avvisat av ${game.user.name}`));
    }
  }

  // Försäljningsgodkännande — se rolls/sell.mjs. Samma form som plundring,
  // men gaten för DIREKT applicering (i requestSell) är `game.user.isGM`,
  // inte ägarskap — en spelare äger alltid sin egen rollperson, så
  // ägarskapsgaten hade gjort godkännande meningslöst här.
  const sellFlag = message.getFlag(game.system.id, "pendingSell");
  if (sellFlag && !sellFlag.processed) {
    const approveSellBtn = html.querySelector('[data-action="approveSellRequest"]');
    const rejectSellBtn = html.querySelector('[data-action="rejectSellRequest"]');
    if (approveSellBtn || rejectSellBtn) {
      const lockAndMarkSell = makeLockAndMark(message, html, "pendingSell");

      approveSellBtn?.addEventListener("click", async () => {
        if (!(await lockAndMarkSell(`✅ Godkänt av ${game.user.name}`))) return;
        try {
          await applySell(sellFlag);
        } catch (err) {
          console.error("DoDE | applySell misslyckades efter godkännande", err);
          ui.notifications.error("Kunde inte genomföra försäljningen — se konsolen.");
        }
      });

      rejectSellBtn?.addEventListener("click", () => lockAndMarkSell(`❌ Avvisat av ${game.user.name}`));
    }
  }
});

/**
 * NPC-behörighetsläckan: en spelare som fick Observer (krävs för Plundra-
 * knappen, se loot.mjs) ser inte bara det öppnade liket — varje `npc`-aktör
 * med `ownership.default >= LIMITED` listas dessutom i ALLA spelares Actors-
 * sidopanel (Foundrys egen `ClientDocument#visible`-getter, kärn-API, testar
 * bara `testUserPermission(user, "LIMITED")` — ingen känsla för "levande
 * fiende" kontra "redan plundrat lik"). Johan, skärmdump 2026-08-22: en
 * spelare såg "Skelett (togad)", "Vaktskelett (fjällpansar)" och "Malakor
 * Benbrytare" listade i sin egen meny — döda motståndare som SKA gå att
 * plundra, men som inte ska stå namngivna i spelarens sidopanel förrän de
 * faktiskt är besegrade, och inte längre efter allt är plundrat.
 *
 * Lösning, Johans uttryckliga val: `npc`-aktörer föds med `default:0`
 * (osynliga), får `default:2` (Observer) AUTOMATISKT i samma stund `dead`-
 * statusen sätts (samma `toggleStatusEffect("dead", ...)`-anrop striden
 * redan använder — se auto-städningshooken ovan), och tappar den igen så
 * fort inget lootbart föremål återstår (se loot.mjs#applyLoot). `handlare`-
 * aktörer (riktiga butiker, t.ex. "Torvald Krögaren — Bardisk") räknas INTE
 * hit — en butik ska gå att besöka när som helst, inte bara efter ett dråp.
 *
 * `toggleStatusEffect` skapar en riktig ActiveEffect med `statuses:["dead"]`
 * — `createActiveEffect` är alltså rätt krok, samma mekanism som redan
 * dokumenterats i dode.mjs. Bara GM:s klient skriver (samma engångs-skydd
 * som `deleteActiveEffect`-hooken nedan).
 */
Hooks.on("createActiveEffect", (effect) => {
  if (!game.user.isGM) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "npc") return;
  if (!effect.statuses?.has("dead")) return;
  if ((actor.ownership?.default ?? 0) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER) return;
  actor.update({ "ownership.default": CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER });
});

/**
 * Berätta när en besvärjelses effekt tar slut — live-fynd 2026-08-21 (Johan:
 * "if he is no longer blind the icon should vanish and a text message state
 * Spell effect blindness expired?"). Utan detta försvinner statusikonen/
 * ActiveEffecten tyst (utgången varaktighet, botad, eller SL-borttagen för
 * hand) utan att bordet ser VARFÖR eller VILKEN besvärjelse det var.
 * Flaggan (`flags.<system>.source === "spell"` + `sourceName`) sätts av BÅDA
 * vägarna en besvärjelse kan skapa en ActiveEffect: `applySpellEffect`
 * (actor.mjs, buff via buildTemporaryEffectData) och `applySpellResult`s
 * statusEffect-gren (spell.mjs, `toggleStatusEffect`) — samma flagg-form,
 * en gemensam hook.
 *
 * ⚠ Bara GM:s klient postar — annars skulle VARJE ansluten spelare posta
 * samma meddelande en gång var (`deleteActiveEffect` fyrar lokalt hos alla).
 */
Hooks.on("deleteActiveEffect", (effect) => {
  if (!game.user.isGM) return;
  if (effect.getFlag(game.system.id, "source") !== "spell") return;
  const spellName = effect.getFlag(game.system.id, "sourceName") ?? effect.name;
  const actorName = effect.parent?.name ?? "Okänd";
  ChatMessage.create({
    content: `<div class="dode-chat-card"><p>💨 <strong>${spellName}</strong> på ${actorName} har upphört.</p></div>`
  });
});

/**
 * "Spöktoken"-varning — live-fynd 2026-08-21 (krogslagsmålet): fyra tokens
 * (`Sigrid Järnhand`, `Stigman`, `Varg`, `Rurik Tvåyxa`) pekade på ett
 * aktörs-id som inte längre fanns i världen — troligen kvarlämnade från en
 * tidigare raderad aktör. De syntes bara som namn utan hälsobar/typ, och
 * förvirrade en riktig strid (Johan: "confused the fight"). Ingen automatisk
 * städning här — bara en tydlig varning när scenen laddas, så SL kan städa
 * INNAN en strid börjar i stället för att upptäcka det mitt i en runda.
 */
Hooks.on("canvasReady", (canvas) => {
  if (!game.user.isGM) return;
  const ghosts = canvas.scene?.tokens.filter((t) => !t.actor) ?? [];
  if (!ghosts.length) return;
  const names = ghosts.map((t) => t.name).join(", ");
  ui.notifications.warn(`Scenen "${canvas.scene.name}" har ${ghosts.length} spöktoken(s) utan kopplad aktör: ${names}. Kontrollera/städa innan striden börjar.`, { permanent: true });
});

/**
 * Besegrade NPC-token städas automatiskt bort vid scenbyte (load/unload) —
 * Johans beslut 2026-08-22, efter att döda skelett/Malakor-tokens legat kvar
 * på "Värdshuset — Utkanten" efter en avslutad strid ("Looks like you have
 * ghosts.. thought we said we always clear the map on every load/unload
 * after a fight?"). Nyckeln `updateScene`s `active`-fält fyrar EN gång per
 * scenbyte, både för scenen som lämnas (`active:false`) och den som blir
 * aktiv (`active:true`) — att sopa vid BÅDA hållen täcker "load" och
 * "unload" utan att behöva jaga ett separat unload-event Foundry inte har.
 *
 * Bara `type:"npc"` — en spelares egen rollperson kan bära `dead`-statusen
 * av dramatiska skäl utan att deras token ska försvinna från kartan.
 * `dead`-statusen är samma Foundry-kärnstatus striden redan sätter via
 * `actor.toggleStatusEffect("dead", ...)` på VERKLIGT besegrade NPC:er.
 *
 * Bara GM:s klient utför raderingen (annars skulle varje ansluten spelare
 * försöka radera samma tokens en gång var) — matchar `deleteActiveEffect`-
 * hooken ovan.
 */
Hooks.on("updateScene", async (scene, changes) => {
  if (!game.user.isGM) return;
  if (!("active" in changes)) return;
  const defeated = scene.tokens.filter((t) => t.actor?.type === "npc" && t.actor?.statuses?.has("dead"));
  if (!defeated.length) return;
  const names = defeated.map((t) => t.name).join(", ");
  await scene.deleteEmbeddedDocuments("Token", defeated.map((t) => t.id));
  ui.notifications.info(`Rensade ${defeated.length} besegrad(e) NPC-token från "${scene.name}": ${names}.`);
});

/**
 * Systemets standard: spelare får FILES_UPLOAD (kunna ladda upp en ny bild till
 * t.ex. sitt eget porträtt/token), men INTE FILES_BROWSE (kunna bläddra i hela
 * serverns filträd) — de är oberoende behörigheter i Foundrys kärna
 * (`file-picker.mjs`: FILES_UPLOAD styr uppladdningsknappen, FILES_BROWSE styr
 * bläddringen/trädlistan, separata kontrollpunkter). Johans oro 2026-08-03
 * ("if they have file browse they can see all? Does not seem ok?") gällde
 * bläddring — den lämnas orörd (kvar på Betrodd, rollid 2+) medan bara
 * uppladdning sänks till Spelare (rollid 1), så en spelare kan ersätta sin egen
 * bild utan att någonsin få en lista över allt som ligger på servern.
 *
 * Bara GM skriver world-inställningen, och bara om FILES_UPLOAD fortfarande
 * står på Foundrys egen fabriksstandard (rollid 3, Assistant GM) — rör den
 * INTE om SL redan varit inne i Configure Permissions och gjort ett eget,
 * medvetet val. Kör en gång per värld (flaggat via `flags.core` på world-
 * inställningen self är onödigt — settings-objektet självt är beviset: när det
 * en gång avviker från fabriksstandarden rör vi det aldrig igen).
 */
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const current = game.settings.get("core", "permissions") ?? {};
  // Foundry sätter varje nyskapad världs permissions-setting med "alla roller
  // från defaultRole och uppåt till Gamemaster" — inte bara [defaultRole]. För
  // FILES_UPLOAD (defaultRole = Assistant GM) är fabriksstandarden alltså
  // [ASSISTANT, GAMEMASTER], verifierat direkt mot en riktig körande värld
  // 2026-08-03 (game.permissions.FILES_UPLOAD === [3,4]).
  const vanillaUpload = [CONST.USER_ROLES.ASSISTANT, CONST.USER_ROLES.GAMEMASTER];
  const upload = current.FILES_UPLOAD ?? [];
  const untouched = upload.length === vanillaUpload.length && vanillaUpload.every((r) => upload.includes(r));
  if (!untouched) return;
  await game.settings.set("core", "permissions", {
    ...current,
    FILES_UPLOAD: [CONST.USER_ROLES.PLAYER, ...upload]
  });
  console.log("DoDE | FILES_UPLOAD-behörigheten sänkt till Spelare (systemstandard, se dode.mjs)");
});

Hooks.on("renderActorDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  const header =
    root?.querySelector(".directory-header .action-buttons") ??
    root?.querySelector(".directory-header .header-actions") ??
    root?.querySelector(".directory-header");
  if (!header) return;
  if (header.querySelector(".dode-open-wizard")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("dode-open-wizard");
  button.innerHTML = '<i class="fa-solid fa-hat-wizard"></i> Ny rollperson (guide)';
  button.addEventListener("click", () => game.dode.openCharacterWizard());
  header.appendChild(button);

  // GM-effektfönstret — bara meningsfullt för SL, som redan är den enda
  // rollen som kan skriva scen-/världs-/aktörsflaggorna (se config.mjs).
  if (game.user.isGM && !header.querySelector(".dode-open-gm-effects")) {
    const gmButton = document.createElement("button");
    gmButton.type = "button";
    gmButton.classList.add("dode-open-gm-effects");
    gmButton.innerHTML = '<i class="fa-solid fa-wand-sparkles"></i> GM-effekter';
    gmButton.addEventListener("click", () => game.dode.openGmEffects());
    header.appendChild(gmButton);
  }
});

/**
 * En stridsrunda är **5 sekunder** (SLB s.15) — flytta världsklockan i takt med
 * striden.
 *
 * ⚠ Poängen är inte klockan i sig utan att Foundrys egna varaktigheter då räknas
 * ned av kärnan: en ActiveEffect med `duration.rounds` eller `duration.seconds`
 * upphör av sig själv i stället för att någon måste minnas den. Se
 * DESIGN_DECISIONS.md §10 — samma modell som dnd5e, som aldrig håller en egen
 * kalender utan bara anropar `game.time.advance`.
 *
 * ⚠ Bara SL flyttar tiden, och bara framåt i rundan — annars skulle varje klient
 * försöka avancera samma runda.
 */
Hooks.on("combatRound", async (combat, updateData, updateOptions) => {
  if (!game.user.isGM) return;
  if ((updateOptions?.direction ?? 1) < 0) return;
  await game.time.advance(CONFIG.DODE.SECONDS_PER_ROUND);
});

/**
 * Periodiska effekter (Del 4b, GM-effektfönstret) med `cadence:"round"` —
 * gift m.fl. Tickar en gång per stridsrunda för varje combatant med en aktiv
 * periodisk effekt. `"hour"`/`"day"`-kadens ligger utanför stridsklockan och
 * konsumeras i stället lazy vid läsning (samma mönster som `activationSeconds`
 * på utrustning) — inte byggt här, se docs/dev/GM_EFFEKTFONSTER_ANALYS.md.
 */
Hooks.on("combatRound", async (combat, updateData, updateOptions) => {
  if (!game.user.isGM) return;
  if ((updateOptions?.direction ?? 1) < 0) return;
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;
    const roundEffects = CONFIG.DODE.getPeriodicEffects(actor).filter((e) => e.cadence === "round");
    for (const effect of roundEffects) {
      await CONFIG.DODE.tickPeriodicEffect(actor, effect);
    }
  }
});

Hooks.on("updateActor", async (actor, changes) => {
  if (actor.type !== "character") return;
  const flat = foundry.utils.flattenObject(changes);
  if (!("system.alder" in flat)) return;
  const ageMods = DODE.ageAttributeModifiers[actor.system.alder] ?? {};
  const aeChanges = Object.entries(ageMods)
    .filter(([, v]) => v !== 0)
    .map(([key, value]) => ({
      key: `system.attributes.${key}.bonus`,
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: String(value)
    }));
  const existing = actor.effects.find((e) => e.getFlag(game.system.id, "source") === "age");
  if (existing && aeChanges.length) {
    await existing.update({ name: `Åldersmod (${actor.system.alder})`, changes: aeChanges });
  } else if (existing && !aeChanges.length) {
    await existing.delete();
  } else if (aeChanges.length) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: `Åldersmod (${actor.system.alder})`,
      changes: aeChanges,
      origin: "system.age",
      transfer: false,
      disabled: false,
      [`flags.${game.system.id}.source`]: "age"
    }]);
  }
});
