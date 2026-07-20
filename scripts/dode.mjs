import DoDECharacterData from "./data/actor-character.mjs";
import DoDENpcData from "./data/actor-npc.mjs";
import DoDEFardighetData from "./data/item-fardighet.mjs";
import DoDERasData from "./data/item-ras.mjs";
import DoDEYrkeData from "./data/item-yrke.mjs";
import DoDEVapenData from "./data/item-vapen.mjs";
import DoDERustningData from "./data/item-rustning.mjs";
import DoDEBesvarjelseData from "./data/item-besvarjelse.mjs";
import DoDEActor from "./documents/actor.mjs";
import DoDECharacterSheet from "./sheets/actor-character-sheet.mjs";
import DoDENpcSheet from "./sheets/actor-npc-sheet.mjs";
import {
  DoDEFardighetSheet,
  DoDERasSheet,
  DoDEYrkeSheet,
  DoDEVapenSheet,
  DoDERustningSheet,
  DoDEBesvarjelseSheet
} from "./sheets/item-sheet.mjs";
import DoDECharacterWizard from "./apps/character-wizard.mjs";
import { DODE } from "./helpers/config.mjs";

Hooks.once("init", () => {
  console.log("Drakar och Demoner Expert | Initierar system");

  CONFIG.DODE = DODE;
  CONFIG.Actor.documentClass = DoDEActor;

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
    besvarjelse: DoDEBesvarjelseData
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
    ["besvarjelse", DoDEBesvarjelseSheet]
  ];
  for (const [type, sheetClass] of itemSheets) {
    Items.registerSheet("drakar-och-demoner-expert", sheetClass, {
      types: [type],
      makeDefault: true,
      label: `TYPES.Item.${type}`
    });
  }

  game.dode = { openCharacterWizard: () => new DoDECharacterWizard().render(true) };
});

Hooks.on("renderActorDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  const header = root?.querySelector(".directory-header .action-buttons") ?? root?.querySelector(".directory-header");
  if (!header) return;
  if (header.querySelector(".dode-open-wizard")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("dode-open-wizard");
  button.innerHTML = '<i class="fa-solid fa-hat-wizard"></i> Ny rollperson (guide)';
  button.addEventListener("click", () => game.dode.openCharacterWizard());
  header.appendChild(button);
});
