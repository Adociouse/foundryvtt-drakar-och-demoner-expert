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
import DoDEMagicTrainingApp from "./apps/magic-training.mjs";
import { DODE } from "./helpers/config.mjs";
import { resolveAttack, postAttackCard } from "./rolls/attack.mjs";

const SYSTEM_ID = "drakar-och-demoner-expert";

Hooks.once("init", () => {
  console.log("Drakar och Demoner Expert | Initierar system");

  CONFIG.DODE = DODE;
  CONFIG.Actor.documentClass = DoDEActor;
  CONFIG.ActiveEffect.documentClass = DoDeActiveEffect;

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
   * Alla tre är `scope: "world"` + `restricted: true` — de är SL:s bordsregler,
   * inte spelarnas personliga preferenser, och måste gälla lika för alla vid
   * samma bord annars blir rollpersonsskapandet orättvist.
   */
  game.settings.register(SYSTEM_ID, "attributeRollMode", {
    name: "Slagsätt för grundegenskaper",
    hint: "Hur rollpersonens grundegenskaper slås fram i guiden. Gäller hela bordet.",
    scope: "world",
    config: true,
    restricted: true,
    type: String,
    default: "standard",
    choices: {
      standard: "Standard — ett slag per grundegenskap",
      reroll: "Omslag tillåtet — spelaren får slå om en grundegenskap fritt",
      bestOfThree: "Tre kandidater — slå tre värden per grundegenskap, välj ett"
    }
  });

  game.settings.register(SYSTEM_ID, "allowRestartIfUnqualified", {
    name: "Tillåt omstart när inget yrke går att välja",
    hint: "Med 3T6 hamnar en rollperson ofta på 10–11 i allt, och lägsta yrkeskravet är 12 — "
      + "då kvalificerar den för noll av 36 yrken. Med detta påslaget erbjuder guiden att slå "
      + "om alla grundegenskaper i stället för att spelaren kör fast.",
    scope: "world",
    config: true,
    restricted: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SYSTEM_ID, "showAttributeRollsInChat", {
    name: "Visa grundegenskapsslag i chatten",
    hint: "Postar varje slag som ett chattkort med tärningarna synliga — och animeras av "
      + "Dice So Nice om modulen är installerad. Av om skapandet ska ske i det tysta.",
    scope: "world",
    config: true,
    restricted: true,
    type: Boolean,
    default: true
  });

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
    "systems/drakar-och-demoner-expert/templates/apps/training-rows.hbs"
  ]);

  game.dode = {
    // Utan argument: skapaläge. Med en aktör: redigeringsläge (guiden laddar
    // rollpersonen och sparar tillbaka utan att dubblera något) — se
    // character-wizard.mjs och DESIGN_DECISIONS.md backlog 4c.
    openCharacterWizard: (actor = null) => new DoDECharacterWizard(actor ? { actor } : {}).render(true),
    // Träningsfönstret — omsättning av EP till FV efter viloperiod (REG s.46).
    openTraining: (actor) => new DoDETrainingApp(actor).render(true),
    // Magi har ett eget fönster — EP-källorna skiljer sig från vanliga
    // färdigheters (SB s.7), se apps/magic-training.mjs.
    openMagicTraining: (actor) => new DoDEMagicTrainingApp(actor).render(true),
    // Stridsupplösning — SLB s.16-18. GM: game.dode.resolveAttack({attacker, weapon, target, ...})
    resolveAttack, postAttackCard,
    // Scen-/miljömodifikationer via ActiveEffects (flags.<system.id>.source:"scene").
    // GM: game.dode.SceneEffects.applyToScene({ name, changes:[...] }) / removeFromScene(name).
    SceneEffects
  };
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
