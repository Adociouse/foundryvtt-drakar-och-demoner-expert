/**
 * Löser ett DODE.specialAbilitiesTable-slag (config.mjs) till en konkret
 * mekanisk effekt — backlogpost 7/36. Delad mellan rollpersonsguidens
 * "formagor"-steg (character-wizard.mjs) och arkets "Slå fram förmåga"-knapp
 * (actor-character-sheet.mjs), så de två inte kan komma i otakt.
 *
 * Grundidé: en förmåga med `effect` blir ETT `formaga`-item (item-formaga.mjs,
 * `system.skillModifiers`), taggat med `flags.<id>.specialAbilitySlot` = en
 * stabil `slotId` (INTE array-index — se nedan för varför). Den faktiska
 * bonusen ligger ALLTID i `skillModifiers`, aldrig direkt i en `fardighet`s
 * `fv`/`bonus` — även för "grantSecondary"-rader (Hobbyist, Gott språksinne)
 * som i bokens text ser ut som ett absolut FV. `fardighetSeeds` skapar bara
 * en fv:0-basfärdighet att hänga modifieraren på om spelaren inte redan äger
 * den (RP s.28-29, 13b: sekundära går annars aldrig att äga från start).
 *
 * ⚠ `slotId`, inte index: wizardens formagor-array är fast längd men kan
 * krympa vid nivåsänkning (#specialAbilitySlots); arkets egen array växer/
 * krymper fritt via #onAddAbility/#onDeleteAbility (splice). Ett index skulle
 * peka på fel rad så fort en tidigare rad tas bort. `slotId` är ett
 * `foundry.utils.randomID()` satt när sloten skapas (actor-character.mjs
 * `specialAbilities[].slotId`), stabilt oavsett vad som händer med andra rader.
 */

function lookupSkillMeta(key) {
  return CONFIG.DODE.primarySkills.find((s) => s.key === key)
    ?? CONFIG.DODE.secondarySkills.find((s) => s.key === key)
    ?? null;
}

/**
 * Matchar ett spelartypat namn mot den riktiga sekundärfärdighetskatalogen
 * (så att t.ex. "Simning" hittar sin riktiga nyckel/grundegenskap) och faller
 * annars tillbaka på ett fritt namn — precis som yrkesfärdighetsstegets
 * fria vapenval redan gör (character-wizard.mjs `professionSkillPicks`).
 * ⚠ Attributet "smi" på fallback-grenen är en approximation (samma som
 * `hantverk-spec` i config.mjs) — vi vet inte grundegenskapen för ett
 * påhittat namn.
 */
function matchPoolChoice(rawName) {
  const name = String(rawName ?? "").trim();
  if (!name) return null;
  const found = CONFIG.DODE.secondarySkills.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (found) return { key: found.key, name: found.name, attribute: found.attribute };
  return { key: CONFIG.DODE.skillKey(name), name, attribute: "smi" };
}

/** @returns {boolean} Kräver effekten spelarval (pool-baserad)? */
export function needsChoice(effect) {
  return !!effect?.pool;
}

/** @returns {number} Hur många valinmatningar formagor-steget ska visa. */
export function choiceCount(effect) {
  return effect?.count ?? 1;
}

/**
 * @param {object|null} effect En rad ur DODE.specialAbilitiesTable's `effect`.
 * @param {string[]} choices Spelarens fria textval, längd = choiceCount(effect).
 * @returns {{skillModifiers: Array<{skillKey:string,value:number}>, fardighetSeeds: Array<{key:string,name:string,attribute:string,costTier:string}>, recoveryModifiers: Array<{resource:string,operation:string,value:number}>}}
 */
export function resolveGrants(effect, choices = []) {
  const skillModifiers = [];
  const fardighetSeeds = [];
  const recoveryModifiers = [];
  const statModifiers = [];
  if (!effect) return { skillModifiers, fardighetSeeds, recoveryModifiers, statModifiers };

  const addFixed = (key, value, costTier = "sekundar") => {
    skillModifiers.push({ skillKey: key, value });
    const meta = lookupSkillMeta(key);
    if (meta) fardighetSeeds.push({ key: meta.key, name: meta.name, attribute: meta.attribute, costTier });
  };
  const addChosen = (picked, value, costTier = "sekundar") => {
    if (!picked?.key) return;
    skillModifiers.push({ skillKey: picked.key, value });
    fardighetSeeds.push({ key: picked.key, name: picked.name, attribute: picked.attribute, costTier });
  };

  switch (effect.type) {
    case "skillBonus": {
      // `effect.costTier` (2026-08-16, ras-/yrkesramverket): valfri override —
      // t.ex. Dvärgs "+5 FV i Geologi (räknas som primärfärdighet)". Saknas
      // den faller det tillbaka på addFixed/addChosens egen "sekundar"-default,
      // oförändrat beteende för alla befintliga anrop.
      if (effect.skills) {
        for (const key of effect.skills) addFixed(key, effect.value, effect.costTier ?? "sekundar");
      } else if (effect.pool === "hantverk") {
        const craft = String(choices[0] ?? "").trim();
        if (craft) {
          const name = `${effect.namePrefix ?? ""}${craft}`;
          addChosen({ key: CONFIG.DODE.skillKey(name), name, attribute: "smi" }, effect.value);
        }
      } else if (effect.pool) {
        addChosen(matchPoolChoice(choices[0]), effect.value);
      }
      break;
    }
    case "grantSecondary": {
      // `effect.skills` (2026-08-16, ras-/yrkesramverket) — en FAST lista,
      // samma mönster som skillBonus redan har. T.ex. Ankas "Automatiskt FV
      // 20 i Simma": ingen spelarvals-pool, bara en given färdighet.
      if (effect.skills) {
        for (const key of effect.skills) addFixed(key, effect.fv, effect.costTier ?? "sekundar");
      } else if (effect.pool === "sprak") {
        const lang = String(choices[0] ?? "").trim();
        if (lang) {
          for (const label of effect.labels ?? ["Tala"]) {
            const name = `${label} ${lang}`;
            addChosen({ key: CONFIG.DODE.skillKey(name), name, attribute: "int" }, effect.fv);
          }
        }
      } else {
        addChosen(matchPoolChoice(choices[0]), effect.fv);
      }
      break;
    }
    case "yrkesUpgrade": {
      for (const choice of choices) {
        const picked = matchPoolChoice(choice);
        if (picked?.key) fardighetSeeds.push({ key: picked.key, name: picked.name, attribute: picked.attribute, costTier: "yrkesfardighet" });
      }
      break;
    }
    case "costTierOverride":
      // Ingen skill-koppling — effekten flaggas direkt på formaga-itemet i
      // applyResolvedAbility, DODE.skillCostOverrideFor läser den där.
      break;
    case "recoveryModifier":
      // Gott läkekött / God mental kontroll (rad 73/74) — se item-formaga.mjs
      // `recoveryModifiers` och actor-character.mjs `recoveryModifierTotals`.
      recoveryModifiers.push({ resource: effect.resource, operation: effect.operation, value: effect.value });
      break;
    case "statModifier":
      // Multiplikator/tillägg på en HÄRLEDD attributsumma (hp.max/psy.max) —
      // t.ex. "Extremt smärttålig" (Totala KP × 1,5). Skiljer sig medvetet från
      // recoveryModifier, som riktar sig mot LÄKNINGSTAKTEN, en annan mekanik
      // än poolens STORLEK — se item-formaga.mjs `statModifiers` och
      // actor-character.mjs `#applyStatModifiers`.
      statModifiers.push({ stat: effect.stat, operation: effect.operation, value: effect.value });
      break;
  }
  return { skillModifiers, fardighetSeeds, recoveryModifiers, statModifiers };
}

const TIER_RANK = { sekundar: 0, yrkesfardighet: 1, primar: 2 };

/**
 * Säkerställer att varje seed finns som `fardighet` (skapar vid behov, fv:0 —
 * själva värdet kommer från skillModifiers, se filhuvudet). Höjer costTier om
 * seeden vill ha en dyrare/bättre nivå än en redan befintlig färdighet
 * (Stort kunskapsområde-fallet: en sekundär som redan finns pga en annan
 * förmåga ska bli yrkesfärdighetsnivå, aldrig tvärtom). Rör ALDRIG `fv`/`bonus`
 * på en befintlig färdighet — det kan vara spelarens egna EP-köp.
 */
async function ensureSeeds(actor, seeds) {
  if (!seeds.length) return;
  const existingByKey = new Map(
    actor.items
      .filter((i) => i.type === "fardighet")
      .map((i) => [i.system.skillKey || CONFIG.DODE.skillKey(i.name), i])
  );
  const toCreate = [];
  const toUpdate = [];
  const seenKeys = new Set();
  for (const seed of seeds) {
    if (seenKeys.has(seed.key)) continue;
    seenKeys.add(seed.key);
    const existing = existingByKey.get(seed.key);
    if (!existing) {
      toCreate.push({
        name: seed.name,
        type: "fardighet",
        system: { skillKey: seed.key, attribute: seed.attribute, category: "a", fv: 0, costTier: seed.costTier }
      });
    } else if ((TIER_RANK[seed.costTier] ?? 0) > (TIER_RANK[existing.system.costTier] ?? 0)) {
      toUpdate.push({ _id: existing.id, "system.costTier": seed.costTier });
    }
  }
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
  if (toUpdate.length) await actor.updateEmbeddedDocuments("Item", toUpdate);
}

/**
 * Applicerar (skapar/uppdaterar/tar bort) den `formaga`-post som representerar
 * EN förmågeslot — se filhuvudet för varför taggning sker på `slotId`.
 *
 * @param {Actor} actor
 * @param {string} slotId Stabil identitet för sloten (`specialAbilities[].slotId`,
 *   eller `"race-ability-N"`/`"profession-ability-N"` för ras-/yrkesramverket).
 * @param {string} name Förmågans namn (visningsnamn på formaga-itemet).
 * @param {object|null} effect Raden ur DODE.specialAbilitiesTable/professionAbilities/
 *   automaticAbilities, eller null.
 * @param {{skillModifiers: Array, fardighetSeeds: Array, recoveryModifiers?: Array, statModifiers?: Array}} resolved Från resolveGrants.
 * @param {string} [origin="bas"] `formaga.system.origin` — "bas" (särskilda
 *   förmågor), "ras" eller "yrke" (2026-08-16, ras-/yrkesramverket).
 */
export async function applyResolvedAbility(actor, slotId, name, effect, resolved, origin = "bas") {
  const existing = actor.items.find(
    (i) => i.type === "formaga" && i.getFlag(game.system.id, "specialAbilitySlot") === slotId
  );
  if (!effect) {
    // Ingen mekanisk effekt på den här raden (de flesta av de 49) — städa bort
    // en ev. tidigare formaga om spelaren rullat om från en effektfull rad.
    if (existing) await existing.delete();
    return;
  }

  await ensureSeeds(actor, resolved.fardighetSeeds);

  const data = {
    name,
    type: "formaga",
    system: {
      origin,
      skillModifiers: resolved.skillModifiers,
      recoveryModifiers: resolved.recoveryModifiers ?? [],
      statModifiers: resolved.statModifiers ?? []
    },
    [`flags.${game.system.id}.specialAbilitySlot`]: slotId,
    [`flags.${game.system.id}.effect`]: effect
  };
  if (existing) {
    await existing.update(data);
  } else {
    await actor.createEmbeddedDocuments("Item", [data]);
  }
}

/**
 * Städar bort formaga-poster vars slot inte längre finns (nivåsänkning som
 * kortar wizardens slot-array, eller en rad borttagen på arket). Körs EFTER
 * att ALLA producenter (särskilda förmågor, ras, yrke) hunnit köra
 * applyResolvedAbility — en enda kombinerad `keepSlotIds`-lista, inte tre
 * separata pruningar.
 *
 * ⚠ VIKTIGT (2026-08-16, upptäckt under design av ras-/yrkesramverket): de
 * tre slot-namnrymderna ("<randomID>" för särskilda förmågor, "race-ability-N",
 * "profession-ability-N") delar samma flagg-nyckel (`specialAbilitySlot`) på
 * SAMMA `formaga`-itemtyp. Ett tidigare utkast lät varje producent pruna för
 * sig med sin egen, ofullständiga `keepSlotIds`-lista — det hade RADERAT de
 * ANDRA producenternas poster (t.ex. skulle särskilda förmågors prune-anrop,
 * som bara känner till sina egna slotId:n, tolka varje ras-/yrkes-formaga som
 * "föräldralös" och ta bort den). Anropande kod MÅSTE alltså samla ihop
 * keepSlotIds från ALLA tre producenterna innan detta anrop görs EN gång —
 * se character-wizard.mjs `#onCreateCharacter`/`#applyToActor`.
 * @param {Actor} actor
 * @param {string[]} keepSlotIds Alla `slotId` som fortfarande finns, FRÅN ALLA producenter.
 */
export async function pruneOrphanedAbilityGrants(actor, keepSlotIds) {
  const keep = new Set(keepSlotIds);
  const stale = actor.items.filter((i) => {
    if (i.type !== "formaga") return false;
    const slotId = i.getFlag(game.system.id, "specialAbilitySlot");
    return slotId && !keep.has(slotId);
  });
  if (stale.length) await actor.deleteEmbeddedDocuments("Item", stale.map((i) => i.id));
}
