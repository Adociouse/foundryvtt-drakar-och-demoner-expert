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
import { DODE } from "./helpers/config.mjs";
import { resolveAttack, postAttackCard } from "./rolls/attack.mjs";
import { resolveTwoAttacks, canUseTwoWeapons, effectiveSkillFv, TWO_WEAPON_OPTIONS } from "./rolls/dual-wield.mjs";

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
    "systems/drakar-och-demoner-expert/templates/apps/wizard-skill-slot.hbs"
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
    // Stridsupplösning — SLB s.16-18. GM: game.dode.resolveAttack({attacker, weapon, target, ...})
    resolveAttack, postAttackCard,
    // Scen-/miljömodifikationer via ActiveEffects (flags.<system.id>.source:"scene").
    // GM: game.dode.SceneEffects.applyToScene({ name, changes:[...] }) / removeFromScene(name).
    SceneEffects,
    // Två vapen — RP s.59. GM: game.dode.resolveTwoAttacks({attacker, primaryWeapon,
    // primarySkill, offWeapon, offSkill, primaryTarget, combo}).
    resolveTwoAttacks, canUseTwoWeapons, effectiveSkillFv, TWO_WEAPON_OPTIONS
  };
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
