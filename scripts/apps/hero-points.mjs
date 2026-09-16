import { needsChoice, choiceCount, resolveGrants, applyResolvedAbility } from "../helpers/special-ability-effects.mjs";
import { spendHeroPoints } from "../helpers/hero-points.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const { DialogV2 } = foundry.applications.api;

const ATTRIBUTE_KEYS = ["sty", "fys", "smi", "psy", "kar", "int"]; // ej STO — HH s.20/46-48

/**
 * Spenderingsfönster för hjältepoäng (`system.hjaltepoang`, HH s.20/46-48) —
 * HH §8 listar fyra spendmöjligheter under EN rubrik, helt separat från
 * bäruppgiftspoäng (BP) som spenderas i character-wizard.mjs under skapandet.
 * Se plan wise-herding-lemur för hela research/beslutshistoriken.
 *
 * ⚠ Gren "Höja CL" är AVSIKTLIGT bara bokföring — se docs/dev/SPECIALANFALL_SL_GUIDE.md.
 * `rollFV`/`classifiedRoll` klassificerar och konsumerar ett utfall i samma
 * synkrona block; en sann post-hoc-bump hade krävt att bryta isär tre redan
 * hårt testade kärnmotorer, avsiktligt avgränsat bort denna runda.
 *
 * Ingen "training-base.mjs"-stil bas-/underklasskilsmässa här — till skillnad
 * från träningsfönstren (som verkligen har två oberoende konsumenter:
 * färdigheter kontra magiskolor) finns bara EN variant av det här fönstret,
 * så en förberedd basklass hade varit en abstraktion utan en andra användare.
 */
export default class DoDEHeroPointsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dode-hero-points-{id}",
    tag: "div",
    classes: ["dode", "dode-hero-points"],
    position: { width: 640, height: 640 },
    window: { resizable: true, title: "DODE.Dialog.HeroPoints" },
    actions: {
      buySpecialAbility: DoDEHeroPointsApp.#onBuySpecialAbility,
      buyHeroicAbility: DoDEHeroPointsApp.#onBuyHeroicAbility,
      improveAttribute: DoDEHeroPointsApp.#onImproveAttribute,
      raiseCl: DoDEHeroPointsApp.#onRaiseCl
    }
  };

  static PARTS = {
    body: { template: "systems/drakar-och-demoner-expert/templates/apps/hero-points.hbs", scrollable: [""] }
  };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  get title() {
    return game.i18n.localize("DODE.Dialog.HeroPointsFor", { actor: this.actor.name });
  }

  async _prepareContext() {
    return {
      actor: this.actor,
      hjaltepoang: this.actor.system.hjaltepoang ?? 0,
      hjaltepoangEarned: this.actor.system.hjaltepoangEarned ?? 0,
      attributes: ATTRIBUTE_KEYS.map((key) => ({
        key,
        label: game.i18n.localize(`DODE.Attribute.${key.toUpperCase()}`),
        value: this.actor.system.attributes?.[key]?.value ?? 0
      }))
    };
  }

  /**
   * Gren "Skaffa särskild förmåga" — HH s.20/46-48: samma tabell som RP:s
   * BP-finansierade variant (`#onRollAbility`, actor-character-sheet.mjs),
   * men +2 på tärningen per spenderad HP i stället för +1 per BP, min 1/max 40
   * HP. Kopierar hela needsChoice/resolveGrants/applyResolvedAbility-flödet
   * rakt av.
   */
  static async #onBuySpecialAbility() {
    const pool = this.actor.system.hjaltepoang ?? 0;
    const result = await DialogV2.input({
      window: { title: game.i18n.localize("DODE.HeroPoints.SpecialAbility") },
      content: `
        <p class="hint">${game.i18n.localize("DODE.HeroPoints.SpecialAbilityHint")}</p>
        <div class="form-group">
          <label>${game.i18n.localize("DODE.HeroPoints.Spend")} (${game.i18n.localize("DODE.HeroPoints.Pool")}: ${pool})</label>
          <input type="number" name="hpSpent" min="1" max="40" value="1" />
        </div>
      `
    });
    if (!result) return;

    const hpSpent = Math.max(1, Math.min(40, Number(result.hpSpent) || 1));
    if (hpSpent > pool) return ui.notifications.warn(game.i18n.localize("DODE.HeroPoints.NotEnough"));

    const bonus = hpSpent * 2;
    const roll = await new Roll(`2d20+${bonus}`).evaluate();
    const message = await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: game.i18n.localize("DODE.HeroPoints.SpecialAbility")
    });
    await CONFIG.DODE.waitForDiceAnimation(message);

    const professionName = this.actor.items.find((i) => i.type === "yrke")?.name ?? null;
    const entry = CONFIG.DODE.rollSpecialAbility(roll.total, professionName);
    const effect = entry?.effect ?? null;

    let choices = [];
    if (needsChoice(effect)) {
      const count = choiceCount(effect);
      const fields = Array.from({ length: count }, (_, i) => `
        <div class="form-group">
          <label>${count > 1 ? `Val ${i + 1}` : "Val"}</label>
          <input type="text" name="choice${i}" />
        </div>`).join("");
      const choiceResult = await DialogV2.input({
        window: { title: entry.name || game.i18n.localize("DODE.Dialog.Choose") },
        content: `<p>${entry.description}</p>${fields}`
      });
      if (!choiceResult) return; // avbrutet — inget spenderas, förmågan läggs INTE till halvfärdig
      choices = Array.from({ length: count }, (_, i) => choiceResult[`choice${i}`] ?? "");
    }

    if (!await spendHeroPoints(this.actor, hpSpent)) return ui.notifications.warn(game.i18n.localize("DODE.HeroPoints.NotEnough"));

    const slotId = foundry.utils.randomID();
    const current = this.actor.system.specialAbilities.map((a) => ({ ...a }));
    current.push({
      name: entry?.name || `Förmåga (${roll.total})`,
      source: "hjaltepoang", // se schemakommentaren i actor-character.mjs
      description: entry?.description ?? "",
      slotId
    });
    await this.actor.update({ "system.specialAbilities": current });

    if (effect) {
      const resolved = resolveGrants(effect, choices);
      await applyResolvedAbility(this.actor, slotId, entry.name, effect, resolved);
    }
    this.render();
  }

  /**
   * Gren "Skaffa hjälteförmåga" — HH s.10-15 (ljus)/s.45-51 (mörk). 5-20 HP,
   * bonus = spenderat-5, slå 1T20+bonus, slå upp i vald tabell. Text-only
   * resultat läggs som en `specialAbilities`-rad (samma array som gren 2) med
   * source "hjalteformaga"/"morkhjalteformaga" — ingen separat lista, samma
   * MUDA-resonemang som redan bär specialAbilities-fältet.
   */
  static async #onBuyHeroicAbility() {
    const pool = this.actor.system.hjaltepoang ?? 0;
    const result = await DialogV2.input({
      window: { title: game.i18n.localize("DODE.HeroPoints.HeroicAbility") },
      content: `
        <p class="hint">${game.i18n.localize("DODE.HeroPoints.HeroicAbilityHint")}</p>
        <div class="form-group">
          <label>${game.i18n.localize("DODE.HeroPoints.Table")}</label>
          <select name="dark">
            <option value="0">${game.i18n.localize("DODE.HeroPoints.TableLight")}</option>
            <option value="1">${game.i18n.localize("DODE.HeroPoints.TableDark")}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("DODE.HeroPoints.Spend")} (${game.i18n.localize("DODE.HeroPoints.Pool")}: ${pool})</label>
          <input type="number" name="hpSpent" min="5" max="20" value="5" />
        </div>
      `
    });
    if (!result) return;

    const hpSpent = Math.max(5, Math.min(20, Number(result.hpSpent) || 5));
    if (hpSpent > pool) return ui.notifications.warn(game.i18n.localize("DODE.HeroPoints.NotEnough"));
    const dark = result.dark === "1";

    const bonus = hpSpent - 5;
    const roll = await new Roll(`1d20+${bonus}`).evaluate();
    const message = await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: game.i18n.localize(dark ? "DODE.HeroPoints.TableDark" : "DODE.HeroPoints.TableLight")
    });
    await CONFIG.DODE.waitForDiceAnimation(message);

    const entry = CONFIG.DODE.rollHeroicAbility(roll.total, dark);
    if (!entry) return ui.notifications.error(game.i18n.localize("DODE.HeroPoints.NoTableEntry"));

    if (!await spendHeroPoints(this.actor, hpSpent)) return ui.notifications.warn(game.i18n.localize("DODE.HeroPoints.NotEnough"));

    const current = this.actor.system.specialAbilities.map((a) => ({ ...a }));
    current.push({
      name: entry.name,
      source: dark ? "morkhjalteformaga" : "hjalteformaga",
      description: entry.description,
      slotId: foundry.utils.randomID()
    });
    await this.actor.update({ "system.specialAbilities": current });
    this.render();
  }

  /**
   * Gren "Förbättra grundegenskaper" — HH s.20/46-48: 5 HP per poäng, permanent,
   * obegränsat, alla attribut UTOM STO. Skriver till `system.attributes.<key>.value`
   * (bekräftat fältet för permanenta grundvärden — se character-wizard.mjs där
   * guiden själv committar attributen dit vid skapandet).
   */
  static async #onImproveAttribute() {
    const pool = this.actor.system.hjaltepoang ?? 0;
    const options = ATTRIBUTE_KEYS.map((key) => {
      const label = game.i18n.localize(`DODE.Attribute.${key.toUpperCase()}`);
      const value = this.actor.system.attributes?.[key]?.value ?? 0;
      return `<option value="${key}">${label} (${value})</option>`;
    }).join("");

    const result = await DialogV2.input({
      window: { title: game.i18n.localize("DODE.HeroPoints.ImproveAttribute") },
      content: `
        <p class="hint">${game.i18n.localize("DODE.HeroPoints.ImproveAttributeHint")}</p>
        <div class="form-group">
          <label>${game.i18n.localize("DODE.HeroPoints.Attribute")}</label>
          <select name="attribute">${options}</select>
        </div>
        <p class="hint">${game.i18n.localize("DODE.HeroPoints.Pool")}: ${pool}</p>
      `
    });
    if (!result) return;

    const key = ATTRIBUTE_KEYS.includes(result.attribute) ? result.attribute : ATTRIBUTE_KEYS[0];
    const cost = 5;
    if (cost > pool) return ui.notifications.warn(game.i18n.localize("DODE.HeroPoints.NotEnough"));
    if (!await spendHeroPoints(this.actor, cost)) return ui.notifications.warn(game.i18n.localize("DODE.HeroPoints.NotEnough"));

    const nextValue = (this.actor.system.attributes?.[key]?.value ?? 0) + 1;
    await this.actor.update({ [`system.attributes.${key}.value`]: nextValue });
    this.render();
  }

  /**
   * Gren "Höja CL" — AVSIKTLIGT bara bokföring. Drar 1 HP, ingen roll/utfalls-
   * logik. SL tillämpar själva regeln (utfallet flyttas ett steg uppåt, ett
   * perfekt resultat ger tillbaka poängen) manuellt vid bordet — se
   * docs/dev/SPECIALANFALL_SL_GUIDE.md.
   */
  static async #onRaiseCl() {
    const pool = this.actor.system.hjaltepoang ?? 0;
    if (pool < 1) return ui.notifications.warn(game.i18n.localize("DODE.HeroPoints.NotEnough"));
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("DODE.HeroPoints.RaiseCl") },
      content: `<p>${game.i18n.localize("DODE.HeroPoints.RaiseClHint")}</p>`
    });
    if (!confirmed) return;
    if (!await spendHeroPoints(this.actor, 1)) return ui.notifications.warn(game.i18n.localize("DODE.HeroPoints.NotEnough"));
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="dode-chat-card"><h3>${game.i18n.localize("DODE.HeroPoints.RaiseCl")}</h3>
        <p>${game.i18n.localize("DODE.Chat.RaiseClLine", { actor: this.actor.name })}</p></div>`
    });
    this.render();
  }
}
