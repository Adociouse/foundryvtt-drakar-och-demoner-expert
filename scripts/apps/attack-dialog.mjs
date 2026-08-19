import { resolveAttack, postAttackCard, MELEE_MODS, RANGED_MODS } from "../rolls/attack.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// ⚠ "riktat" finns i BÅDA MELEE_MODS och RANGED_MODS (SLB s.17s egen CL-tabell
// listar den som en vanlig rad), men resolveAttack() applicerar redan −5
// AUTOMATISKT när `aimedAt` sätts (attack.mjs: `modTotal = ... + (aimedAt ?
// -5 : 0)`). Att också visa en "riktat"-kryssruta här hade dubbelapplicerat
// samma straff. Uteslut den ur situationslistan — träffområdesvalet NEDAN är
// den enda vägen till den penaltyn.
function situationalModEntries(mods) {
  return Object.entries(mods).filter(([key]) => key !== "riktat");
}

const MOD_LABELS = {
  liggande: "Liggande mål (+5)",
  fransidan: "Från sidan (+3)",
  bakifran: "Bakifrån (+7)",
  ororlig: "Orörligt mål (+10)",
  skymning: "Skymning (−5)",
  morker: "Mörker (−15)",
  skoldhand: "Sköldhand (−10)"
};

// Alla sex är Foundry-KÄRNANS egna standard-statusEffects (CONFIG.statusEffects)
// — kräver ingen egen registrering, bara ett uppslag mot actor.statuses. SLB
// s.17: "om försvararen av någon annan anledning inte kan parera" — dessa är
// den klausulens uppenbara fall. `restrain` (fastbunden) inkluderat med samma
// motivering: bundna händer kan inte hålla ett pareringsvapen — en egen
// rimlighetsbedömning, inte en bokcitatssiffra, flaggad som sådan.
const PARRY_BLOCKING_STATUSES = ["unconscious", "sleep", "stun", "paralysis", "frozen", "restrain"];
const BLOCKING_STATUS_LABELS = {
  unconscious: "Medvetslöst", sleep: "Sovande", stun: "Omtöcknat",
  paralysis: "Förlamat", frozen: "Fruset", restrain: "Fastbundet"
};

function blockingStatusOf(actor) {
  return PARRY_BLOCKING_STATUSES.find((id) => actor?.statuses?.has(id)) ?? null;
}

/**
 * Vapen→färdighet matchas på NAMN, inte en direkt länk — samma etablerade
 * konvention som `rolls/dual-wield.mjs#effectiveSkillFv` redan bygger på
 * (RP s.60: varje vapen är sin egen färdighet, ingen kopplingsnyckel finns
 * på vapen-itemet självt).
 */
function findWeaponSkill(actor, weaponName) {
  const key = CONFIG.DODE.skillKey(weaponName);
  return actor.items.find((i) => i.type === "fardighet" && i.system.skillKey === key) ?? null;
}

function effectiveFv(actor, skillItem) {
  if (!skillItem) return 0;
  const key = skillItem.system.skillKey;
  return skillItem.system.total
    + (actor.system.weaponGroupBonusTotals?.[key] ?? 0)
    + (actor.system.skillModifierTotals?.[key] ?? 0);
}

/**
 * Anfallsdialogen — "detaljerad strid" (SLB s.16-18). En författningsyta
 * ovanpå den redan byggda, konsol-testade stridsmotorn (`resolveAttack`/
 * `postAttackCard`, rolls/attack.mjs) — ingen ny stridslogik här, bara
 * insamling av mål/vapen/situationsmod/riktat/parering och ETT
 * `resolveAttack()`-anrop. Se planen ("Stridsupplösnings-UI: Anfallsdialogen")
 * i Claude-planarkivet för hela designresonemanget.
 *
 * ⚠ De äldre knapparna `rollSkill`/`rollWeaponDamage`/`rollAttack`/
 * `rollAttackDamage` (character-/npc-sheet) rör den HÄR filen aldrig —
 * de täcker medvetet "vanlig strid" (SLB:s enklare monster-/djurläge utan
 * parering/träffområde), den här dialogen är "detaljerad strid". Två
 * parallella lägen, inte en bugg.
 *
 * ⚠ EN person (oftast SL) avgör båda sidor i EN dialogöppning — precis som
 * `resolveAttack`/`resolveTwoAttacks` redan är byggda. Ingen multiklient-
 * handskakning ("vill motståndaren parera?") finns eller uppfinns här.
 */
export default class DoDEAttackDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dode-attack-dialog-{id}",
    tag: "div",
    classes: ["dode", "dode-attack-dialog"],
    position: { width: 520, height: "auto" },
    window: { title: "Anfall", resizable: true },
    actions: {
      submitAttack: DoDEAttackDialog.#onSubmitAttack
    }
  };

  static PARTS = {
    body: { template: "systems/drakar-och-demoner-expert/templates/apps/attack-dialog.hbs" }
  };

  /**
   * @param {Actor} actor Anfallaren.
   * @param {object} [o]
   * @param {Item} [o.weapon] Förvalt vapen-item (character).
   * @param {number} [o.npcAttackIndex] Förvalt index i actor.system.attacks (NPC).
   */
  constructor(actor, { weapon = null, npcAttackIndex = null } = {}) {
    super();
    this.actor = actor;
    this.isNpc = actor.type === "npc";
    this.weaponKey = this.isNpc
      ? (npcAttackIndex !== null ? String(npcAttackIndex) : (actor.system.attacks?.length ? "0" : null))
      : (weapon?.id ?? actor.items.find((i) => i.type === "vapen")?.id ?? null);
  }

  get title() {
    return `Anfall — ${this.actor.name}`;
  }

  /**
   * Blind → återanvänder den redan sourcade Mörker-modifieraren (SLB s.17)
   * i stället för en påhittad egen siffra — Johans beslut, oberoende bekräftat
   * av att Foundrys egen `DetectionModeLightPerception` redan behandlar
   * blind-status och "stå i mörker" som samma sak (client/canvas/perception).
   * Delad av både anfallssidan (mods-objektet) och pareringssidan (se
   * #onSubmitAttack — kan INTE gå via samma mods-objekt, resolveAttack har
   * ingen generell "pareringsmodifierare"-parameter, bara en fri `mods` för
   * ANFALLAREN).
   */
  #morkerFor(ranged, isThrown) {
    return (ranged || isThrown ? RANGED_MODS : MELEE_MODS).morker;
  }

  #targetToken() {
    return game.user.targets.first() ?? null;
  }

  #selectedWeapon() {
    if (this.isNpc) {
      const index = Number(this.weaponKey);
      const row = this.actor.system.attacks?.[index];
      return row ? { row, index } : null;
    }
    return this.actor.items.get(this.weaponKey) ?? null;
  }

  async _prepareContext() {
    const isNpc = this.isNpc;
    const weaponOptions = isNpc
      ? (this.actor.system.attacks ?? []).map((a, index) => ({
        key: String(index), label: a.name || "Namnlöst anfall", baseFv: a.fv ?? 0
      }))
      : this.actor.items.filter((i) => i.type === "vapen").map((i) => {
        const skill = findWeaponSkill(this.actor, i.name);
        return { key: i.id, label: i.name, baseFv: effectiveFv(this.actor, skill), noSkill: !skill };
      });

    const selected = this.#selectedWeapon();
    const category = isNpc ? "narstrid" : (selected?.system?.category ?? "narstrid");
    const ranged = category === "projektil";
    const isThrown = category === "kast";

    const targetToken = this.#targetToken();
    const targetActor = targetToken?.actor ?? null;
    const bodyPlan = targetActor?.system?.bodyPlan ?? "humanoid";
    const planDef = CONFIG.DODE.bodyPlans[bodyPlan] ?? CONFIG.DODE.bodyPlans.humanoid;
    const aimedOptions = targetActor
      ? Object.keys(planDef.kp).map((key) => ({ key, label: CONFIG.DODE.hitLocations[key] ?? key }))
      : [];

    const modEntries = situationalModEntries(ranged || isThrown ? RANGED_MODS : MELEE_MODS)
      .map(([key, value]) => ({ key, value, label: MOD_LABELS[key] ?? key, positive: value > 0 }));

    // Parering: aldrig för rena projektilvapen. Kastvapen bara om målet
    // faktiskt bär en utrustad sköld (den sourcade "om försvararen har
    // sköld"-regeln, SLB s.17) — annars ett vanligt narstrid-vapen. Ett
    // blockerande villkor (medvetslös/sovande/förlamad/fastbunden/omtöcknad/
    // fruset) tar bort parering helt, oavsett utrustning — SLB s.17:s "om
    // försvararen av någon annan anledning inte kan parera".
    const targetShield = targetActor?.items.find(
      (i) => i.type === "rustning" && i.system.slot === "skold" && i.system.equipped
    ) ?? null;
    const targetBlocking = blockingStatusOf(targetActor);
    const canParry = !ranged && (!isThrown || !!targetShield) && !targetBlocking;

    // Blind mål: pareringens FV sänks med Mörker-värdet (samma modifierare,
    // se #morkerFor) — en straffavgift, inte ett fullt block, Johans
    // uttryckliga distinktion mot de sex blockerande villkoren ovan.
    const targetBlind = !!targetActor?.statuses?.has("blind");
    const morker = this.#morkerFor(ranged, isThrown);
    const parryOptions = canParry && targetActor
      ? targetActor.items.filter((i) =>
        (i.type === "vapen" && i.system.equipped) || (i.type === "rustning" && i.system.slot === "skold" && i.system.equipped)
      ).map((i) => {
        const skill = findWeaponSkill(targetActor, i.name);
        const rawFv = effectiveFv(targetActor, skill);
        return { key: i.id, label: i.name, baseFv: targetBlind ? Math.max(1, rawFv + morker) : rawFv, noSkill: !skill };
      }).sort((a, b) => b.baseFv - a.baseFv)
      : [];

    // Blind anfallare: samma modifierare, men på ANFALLSSIDAN — går via det
    // vanliga mods-objektet (resolveAttack summerar det rakt av), ingen
    // kryssruta, alltid på om statusen är satt.
    const attackerBlind = this.actor.statuses?.has("blind");
    this.autoAttackMod = attackerBlind ? morker : 0;

    // ⚠ De flesta NPC:er har INGA vapen-/rustning-Items alls (fritext
    // system.attacks[], se actor-npc.mjs) — parryOptions blir alltså ALLTID
    // tom för dem, och en person utan sköld/parerande vapen-Item ger samma
    // tomma lista. SLB s.17 kräver bara "ett vapen eller en sköld att parera
    // med", inte ett registrerat Item — så en tom parryOptions-lista får
    // INTE tolkas som "kan inte parera" (det är blockstatusarnas jobb ovan).
    // I stället erbjuds ett manuellt FV-fält alltid, förifyllt med NPC:ns
    // bästa anfalls-FV som en rimlig gissning (samma "SL anger explicit"-
    // flyktväg attacks[]/fv-overriden redan använder på anfallssidan).
    const targetNpcAttacks = targetActor?.type === "npc" ? (targetActor.system.attacks ?? []) : [];
    const suggestedParryFv = targetNpcAttacks.length ? Math.max(...targetNpcAttacks.map((a) => a.fv ?? 0)) : "";

    return {
      isNpc, weaponOptions, weaponKey: this.weaponKey,
      selectedNoSkill: !isNpc && !!weaponOptions.find((w) => w.key === this.weaponKey)?.noSkill,
      target: targetActor ? { name: targetActor.name, img: targetToken.document.texture.src ?? targetActor.img } : null,
      aimedOptions, modEntries, canParry, parryOptions,
      parryBlockedReason: targetBlocking
        ? `⚠ Målet är ${BLOCKING_STATUS_LABELS[targetBlocking]} — kan inte parera (SLB s.17)` : null,
      // Alltid förvald när parering överhuvudtaget är mekaniskt möjlig — SLB
      // s.17 ger ingen presumtion mot parering, bara mot specifika
      // undantag (redan täckta av canParry ovan). Johans uttryckliga rättelse
      // 2026-08-18 efter att en demo visade motsatsen för en NPC utan Items.
      parryDefaultChecked: canParry,
      suggestedParryFv,
      targetBlind,
      attackerBlindLabel: attackerBlind ? `Blind (dig): ${morker}` : null,
      baseFv: weaponOptions.find((w) => w.key === this.weaponKey)?.baseFv ?? 0
    };
  }

  // ⚠ `<select>`/kryssrutor måste bindas med riktiga `change`-lyssnare, ALDRIG
  // `data-action` — DESIGN_DECISIONS.md §6, samma fälla som gm-effects.mjs.
  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelector('select[name="weaponKey"]')?.addEventListener("change", (event) => {
      this.weaponKey = event.currentTarget.value;
      this.render();
    });
    this.element.querySelector('input[name="targetParries"]')?.addEventListener("change", (event) => {
      this.element.querySelector(".parry-fields")?.classList.toggle("hidden", !event.currentTarget.checked);
      this.#recomputePreview();
    });
    // Engångsflaggan (den här attacken, inte ett sparat villkor) döljer
    // pareringsraden helt medan den är ikryssad — men rör aldrig
    // "Målet parerar"-kryssrutans EGET värde, se #onSubmitAttack.
    this.element.querySelector('input[name="attackUnprepared"]')?.addEventListener("change", (event) => {
      this.element.querySelector(".parry-section")?.classList.toggle("hidden", event.currentTarget.checked);
    });
    for (const el of this.element.querySelectorAll('[data-mod-value], select[name="aimedAt"]')) {
      el.addEventListener("change", () => this.#recomputePreview());
    }
    this.#recomputePreview();
  }

  #recomputePreview() {
    const form = this.element;
    const base = Number(form.querySelector('select[name="weaponKey"]')?.selectedOptions[0]?.dataset.baseFv ?? 0);
    let total = base + (this.autoAttackMod ?? 0);
    for (const el of form.querySelectorAll('[data-mod-value]:checked')) {
      total += Number(el.dataset.modValue);
    }
    const aimed = form.querySelector('select[name="aimedAt"]')?.value;
    if (aimed) total -= 5;
    const out = form.querySelector(".fv-preview");
    if (out) out.textContent = `FV ${Math.max(1, total)} (grund ${base})`;
  }

  static async #onSubmitAttack(event, target) {
    const form = this.element;
    const targetToken = this.#targetToken();
    if (!targetToken?.actor) { ui.notifications.warn("Inget mål valt — högerklicka en token på kartan."); return; }

    const isNpc = this.isNpc;
    const selected = this.#selectedWeapon();
    if (!selected) { ui.notifications.warn("Inget vapen/anfall valt."); return; }

    let weapon, skill, fv;
    if (isNpc) {
      weapon = {
        name: selected.row.name, img: this.actor.img,
        system: { damage: selected.row.damage, category: "narstrid", hardToParry: false, length: 0 }
      };
      skill = null;
      fv = selected.row.fv;
    } else {
      weapon = selected;
      skill = findWeaponSkill(this.actor, weapon.name);
      if (!skill) {
        ui.notifications.warn(`Ingen färdighet kopplad till ${weapon.name} — lägg till en färdighetsrad först.`);
        return;
      }
      fv = null;
    }

    const category = weapon.system.category ?? "narstrid";
    const ranged = category === "projektil";

    const isThrown = category === "kast";
    const mods = {};
    for (const el of form.querySelectorAll('[data-mod-value]:checked')) mods[el.dataset.modKey] = Number(el.dataset.modValue);
    if (this.actor.statuses?.has("blind")) mods.blind_attacker = this.#morkerFor(ranged, isThrown);
    const aimedAt = form.querySelector('select[name="aimedAt"]')?.value || null;
    const intent = form.querySelector('input[name="intent"]:checked')?.value ?? "skada";

    // Parering uteblir helt vid ett blockerande villkor ELLER SL:s
    // engångsbedömning "målet är oförberett" — läses FÄRSKT här, inte
    // cachat från _prepareContext (samma disciplin som periodisk-effekt-
    // koden redan etablerat: läs aktuellt tillstånd vid körning).
    const attackUnprepared = !!form.querySelector('input[name="attackUnprepared"]')?.checked;
    const targetBlocking = blockingStatusOf(targetToken.actor);
    let parryItem = null, parrySkill = null, parryFv = null;
    if (!attackUnprepared && !targetBlocking && form.querySelector('input[name="targetParries"]')?.checked) {
      const parryKey = form.querySelector('select[name="parryItemKey"]')?.value;
      const item = parryKey ? (targetToken.actor.items.get(parryKey) ?? null) : null;
      let rawFv = null;
      // ⚠ Egen lokal `defenderSkill` — MEDVETET inte döpt `skill`, för att inte
      // skugga funktionens yttre `skill` (anfallarens färdighet, läst igen i
      // resolveAttack-anropet nedan). Blockscopat `const` hade varit tekniskt
      // säkert även med samma namn, men ett namnbyte är billigare än att lita
      // på att nästa redigerare minns det.
      let defenderSkill = null;
      if (item) {
        parryItem = item;
        defenderSkill = findWeaponSkill(targetToken.actor, item.name);
        rawFv = defenderSkill ? effectiveFv(targetToken.actor, defenderSkill) : null;
      }
      if (rawFv === null) {
        // ⚠ De flesta NPC:er (och obeväpnade karaktärer) har inget vapen-/
        // rustning-Item alls att peka på — SLB s.17 kräver bara "ett vapen
        // eller en sköld att parera med", inte ett registrerat Item, så det
        // här är INTE ett fel, det är normalfallet för en NPC-försvarare.
        // Samma "SL anger explicit FV"-flyktväg som `fv`-overriden på
        // anfallssidan redan använder för SLP:er utan färdighets-Item.
        rawFv = Number(form.querySelector('input[name="parryFvOverride"]')?.value) || 0;
        if (!rawFv) {
          ui.notifications.warn(`Inget FV att parera med för ${targetToken.actor.name} — ange ett manuellt.`);
          return;
        }
        if (!parryItem) {
          // Syntetiskt "vapen" enbart för att uppfylla resolveAttack()s
          // `!!parryItem`-grind — samma mönster som NPC-anfallarens
          // syntetiska vapenobjekt ovan. `baseValue: null` gör att
          // vapenslitage-grenen redan hanterar "inget brytvärde" snyggt
          // (attack.mjs har detta fallet inbyggt sedan tidigare).
          parryItem = { name: "Naturligt försvar", img: targetToken.actor.img, system: { baseValue: null } };
        }
      }
      // Blind mål: kollapsa till den redan byggda parryFv-flyktvägen med
      // Mörker-avdraget inräknat — resolveAttack har ingen egen
      // "pareringsmodifierare"-parameter (bara mods för anfallaren), så
      // det här är den korrekta, motor-oförändrade vägen in.
      if (targetToken.actor.statuses?.has("blind")) {
        parryFv = Math.max(1, rawFv + this.#morkerFor(ranged, isThrown));
      } else if (defenderSkill) {
        parrySkill = defenderSkill;
      } else {
        parryFv = rawFv;
      }
    }

    const attackerToken = this.actor.getActiveTokens(true)[0]?.document ?? null;

    const result = await resolveAttack({
      attacker: this.actor, weapon, skill, fv,
      target: targetToken.actor, parryItem, parrySkill, parryFv,
      aimedAt, intent, mods, ranged, detailed: true,
      attackerToken, targetToken: targetToken.document
    });

    if (result.outOfRange) {
      ui.notifications.warn(result.reason);
      return;
    }

    await postAttackCard(result, { attacker: this.actor, weapon, parryItem, ranged });
    this.close();
  }
}
