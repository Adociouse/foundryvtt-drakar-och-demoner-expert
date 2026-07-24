import DoDECharacterData from "./data/actor-character.mjs";
import DoDENpcData from "./data/actor-npc.mjs";
import DoDEFardighetData from "./data/item-fardighet.mjs";
import DoDERasData from "./data/item-ras.mjs";
import DoDEYrkeData from "./data/item-yrke.mjs";
import DoDEVapenData from "./data/item-vapen.mjs";
import DoDERustningData from "./data/item-rustning.mjs";
import DoDEBesvarjelseData from "./data/item-besvarjelse.mjs";
import DoDEFormagaData from "./data/item-formaga.mjs";
import DoDEActor from "./documents/actor.mjs";
import DoDeActiveEffect from "./documents/dode-active-effect.mjs";
import SceneEffects from "./utils/scene-effects.mjs";
import DoDECharacterSheet from "./sheets/actor-character-sheet.mjs";
import DoDENpcSheet from "./sheets/actor-npc-sheet.mjs";
import {
  DoDEFardighetSheet,
  DoDERasSheet,
  DoDEYrkeSheet,
  DoDEVapenSheet,
  DoDERustningSheet,
  DoDEBesvarjelseSheet,
  DoDEFormagaSheet
} from "./sheets/item-sheet.mjs";
import DoDECharacterWizard from "./apps/character-wizard.mjs";
import { DODE } from "./helpers/config.mjs";

Hooks.once("init", () => {
  console.log("Drakar och Demoner Expert | Initierar system");

  CONFIG.DODE = DODE;
  CONFIG.Actor.documentClass = DoDEActor;
  CONFIG.ActiveEffect.documentClass = DoDeActiveEffect;

  Object.assign(CONFIG.Actor.dataModels, {
    character: DoDECharacterData,
    npc: DoDENpcData
  });
  Object.assign(CONFIG.Item.dataModels, {
    fardighet: DoDEFardighetData,
    ras: DoDERasData,
    yrke: DoDEYrkeData,
    vapen: DoDEVapenData,
    rustning: DoDERustningData,
    besvarjelse: DoDEBesvarjelseData,
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

  Items.unregisterSheet("core", ItemSheet);
  const itemSheets = [
    ["fardighet", DoDEFardighetSheet],
    ["ras", DoDERasSheet],
    ["yrke", DoDEYrkeSheet],
    ["vapen", DoDEVapenSheet],
    ["rustning", DoDERustningSheet],
    ["besvarjelse", DoDEBesvarjelseSheet],
    ["formaga", DoDEFormagaSheet]
  ];
  for (const [type, sheetClass] of itemSheets) {
    Items.registerSheet("drakar-och-demoner-expert", sheetClass, {
      types: [type],
      makeDefault: true,
      label: `TYPES.Item.${type}`
    });
  }

  game.dode = {
    openCharacterWizard: () => new DoDECharacterWizard().render(true),
    // Scen-/miljömodifikationer via ActiveEffects (flags.dode.source:"scene").
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
  const existing = actor.effects.find((e) => e.getFlag("dode", "source") === "age");
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
      "flags.dode.source": "age"
    }]);
  }
});
