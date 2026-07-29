import {
  ROLLS_PER_WEEK, rollTrainingWeek, trainingCap, requiresTeacher, trainingFee, payFromPurse
} from "../helpers/training.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Träningsfönstret — REG s.45-46. Se det kurerade extraktet
 * `docs/extracts/DODE_Regler_TRANING_EP.md` i Roll20-projektet.
 *
 * ⚠ Eget fönster, inte ett läge på rollpersonsarket. Reglerna behandlar det här
 * som en egen händelse mellan äventyren: EP kan inte omsättas under ett pågående
 * äventyr, och först efter minst 7 dagars sammanhängande vila. Ett alltid
 * närvarande köpläge på arket hade suddat ut den gränsen. SL öppnar grinden
 * (`system.rest.trainingUnlocked`), spelaren tränar, grinden stängs.
 *
 * **Två skilda handlingar per rad**, som lätt blandas ihop:
 *
 *  - **Träna** (veckopass) — TJÄNAR EP. Ett normalt grundegenskapsslag mot
 *    färdighetens grundegenskap; lyckat slag ger 1 EP till just den färdigheten.
 *    Med lärare slås två slag i stället för ett, mot en avgift.
 *  - **Höj** — SPENDERAR EP. Växlar in potten mot ett FV-steg.
 *
 * Tre finansieringsregler för höjningen:
 *
 *  - **Vanlig färdighet** — färdighetens egen pott och/eller fria bonuspoäng.
 *  - **Besvärjelse (S-värde)** — samma två källor. ⚠ Kräver alltid lärare för att
 *    tränas (MAG): "Man kan inte lära sig en besvärjelse genom ensamträning."
 *  - **Magiskola (FV)** — ⚠ kan ALDRIG betalas med EP intjänad under äventyr
 *    (MAG s.23), bara med fria bonuspoäng eller EP från träningspass.
 */
export default class DoDETrainingApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dode-training-{id}",
    tag: "div",
    classes: ["dode", "dode-training"],
    position: { width: 720, height: 760 },
    window: { title: "Träning", resizable: true },
    actions: {
      buy: DoDETrainingApp.#onBuy,
      train: DoDETrainingApp.#onTrain,
      setMode: DoDETrainingApp.#onSetMode
    }
  };

  static PARTS = {
    body: { template: "systems/drakar-och-demoner-expert/templates/apps/training.hbs" }
  };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    /** "ensam" | "larare" — styr antal veckoslag och avgift (REG s.45). */
    this.mode = "larare";
  }

  get title() {
    return `Träning — ${this.actor.name}`;
  }

  /** Rollpersonens FV i en given magiskola, eller 0 om hen inte kan skolan. */
  #schoolFv(school) {
    const item = this.actor.items.find(
      (i) => i.type === "fardighet" && i.system.skillKey === `magiskola-${school}`
    );
    return item?.system.total ?? 0;
  }

  /**
   * En rad. `own` är färdighetens egen pott, `bonusNeeded` vad som måste tas ur
   * den fria potten. `attrValue`/`cap` hör till träningshalvan, inte köphalvan.
   */
  #row({ item, label, current, cost, own, canUseOwn, note = "", blocked = false }) {
    const bonusAvailable = this.actor.system.ep.bonusAvailable ?? 0;
    const usableOwn = canUseOwn ? Math.min(own, cost) : 0;
    const bonusNeeded = cost - usableOwn;

    // Träningshalvan. Besvärjelser slår mot magikerns INT (deras skolas
    // grundegenskap) — de har ingen egen `attribute` i schemat.
    const attrKey = item.type === "besvarjelse" ? "int" : item.system.attribute;
    const attrValue = this.actor.system.attributes?.[attrKey]?.total ?? 0;
    const cap = trainingCap(item, this.actor);
    const cappedOut = cap !== null && current >= cap;
    const needsTeacher = requiresTeacher(item);
    const modeBlocks = needsTeacher && this.mode !== "larare";

    return {
      id: item.id,
      img: item.img,
      label,
      current,
      next: current + 1,
      cost,
      own,
      canUseOwn,
      usableOwn,
      bonusNeeded,
      note,
      blocked,
      affordable: !blocked && bonusNeeded <= bonusAvailable,
      attrKey,
      attrLabel: attrKey.toUpperCase(),
      attrValue,
      cap,
      cappedOut,
      canTrain: !modeBlocks && !cappedOut,
      trainNote: modeBlocks
        ? "Kräver lärare — besvärjelser kan inte läras genom ensamträning (MAG)"
        : cappedOut
          ? `⚠ Träningstak: FV kan inte tränas över ${this.attrOf(attrKey)} ${cap} (REG s.45)`
          : ""
    };
  }

  attrOf(key) {
    return key.toUpperCase();
  }

  async _prepareContext() {
    const { DODE } = CONFIG;
    const skills = [];
    const schools = [];
    const spells = [];

    for (const item of this.actor.items) {
      if (item.type === "fardighet") {
        const fv = item.system.fv;
        const own = item.system.ep?.available ?? 0;
        if (DODE.isMagicSchoolKey(item.system.skillKey)) {
          schools.push(this.#row({
            item, label: item.name, current: fv,
            cost: DODE.magicSchoolCost(fv, fv + 1),
            own, canUseOwn: false,
            note: "Endast träning — skolans FV kan inte höjas med äventyrs-EP (MAG s.23)"
          }));
        } else {
          skills.push(this.#row({
            item, label: item.name, current: fv,
            cost: DODE.skillCost(item.system.costTier, fv, fv + 1),
            own, canUseOwn: true,
            note: DODE.costTiers[item.system.costTier]
              ? game.i18n.localize(DODE.costTiers[item.system.costTier])
              : ""
          }));
        }
      } else if (item.type === "besvarjelse") {
        const schoolFv = this.#schoolFv(item.system.school);
        const s = item.system.sValue;
        // Priset följer magikerns FV i SKOLAN, multipeln följer besvärjelsens
        // eget S (MAG s.13). Utan skolan finns ingen kostnadsgrund alls.
        spells.push(this.#row({
          item, label: item.name, current: s,
          cost: schoolFv ? DODE.spellCost(schoolFv, s, s + 1) : 0,
          own: item.system.ep?.available ?? 0,
          canUseOwn: true,
          blocked: !schoolFv,
          note: schoolFv
            ? `Skolans FV ${schoolFv} → grundkostnad ${DODE.spellBaseCost(schoolFv)}`
            : "⚠ Rollpersonen saknar färdighet i besvärjelsens skola — ingen kostnadsgrund"
        }));
      }
    }

    const byLabel = (a, b) => a.label.localeCompare(b.label, "sv");
    const fee = trainingFee(this.mode);
    return {
      actor: this.actor,
      unlocked: !!this.actor.system.rest.trainingUnlocked,
      bonusAvailable: this.actor.system.ep.bonusAvailable ?? 0,
      purse: CONFIG.DODE.formatPurse(this.actor.system.currency ?? {}),
      mode: this.mode,
      isTeacher: this.mode === "larare",
      rollsPerWeek: ROLLS_PER_WEEK[this.mode],
      fee,
      canAffordFee: CONFIG.DODE.purseToKm(this.actor.system.currency ?? {}) >= CONFIG.DODE.silverToKm(fee),
      skills: skills.sort(byLabel),
      schools: schools.sort(byLabel),
      spells: spells.sort(byLabel)
    };
  }

  #rowFor(context, id) {
    return [...context.skills, ...context.schools, ...context.spells].find((r) => r.id === id);
  }

  static async #onSetMode(event, target) {
    this.mode = target.dataset.mode === "ensam" ? "ensam" : "larare";
    this.render();
  }

  /**
   * Ett veckopass — TJÄNAR EP (REG s.45). Ett normalt grundegenskapsslag per
   * vecka, två med lärare. Varje lyckat slag ger 1 EP till just den färdigheten.
   */
  static async #onTrain(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    if (!this.actor.system.rest.trainingUnlocked) {
      return ui.notifications.warn("Viloperioden är inte öppnad — det går inte att träna under ett pågående äventyr (REG s.45).");
    }

    const context = await this._prepareContext();
    const row = this.#rowFor(context, item.id);
    if (!row?.canTrain) return ui.notifications.warn(row?.trainNote || "Går inte att träna.");

    // Avgiften dras FÖRE slagen — man betalar för veckan, inte för resultatet.
    const fee = trainingFee(this.mode);
    if (fee > 0 && !(await payFromPurse(this.actor, fee))) {
      return ui.notifications.warn(`Har inte råd med träningsavgiften (${fee} sm).`);
    }

    const rolls = [];
    let gained = 0;
    for (let i = 0; i < ROLLS_PER_WEEK[this.mode]; i++) {
      const result = await rollTrainingWeek(row.attrValue);
      rolls.push(result);
      if (result.success) gained++;
    }
    if (gained > 0) {
      await item.update({ "system.ep.earned": (item.system.ep?.earned ?? 0) + gained });
    }

    const lines = rolls
      .map((r) => `<li>1T20 = <strong>${r.roll.total}</strong> mot ${row.attrLabel} ${r.target} — ${r.success ? "lyckat, +1 EP" : "misslyckat"}</li>`)
      .join("");
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="dode-chat-card"><h3>Träningsvecka — ${row.label}</h3>
        <p>${this.mode === "larare" ? `Med lärare (${fee} sm)` : "Ensamträning"} · ${ROLLS_PER_WEEK[this.mode]} slag</p>
        <ul>${lines}</ul>
        <p><strong>${gained} EP</strong> till ${row.label}.</p></div>`,
      rolls: rolls.map((r) => r.roll),
      sound: CONFIG.sounds.dice
    });

    this.render();
  }

  /** Växlar in EP mot ett FV-steg — SPENDERAR EP. */
  static async #onBuy(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    // Grinden kontrolleras här också, inte bara i mallen — fönstret kan stå öppet
    // när SL stänger den.
    if (!this.actor.system.rest.trainingUnlocked) {
      return ui.notifications.warn("Viloperioden är inte öppnad — EP kan inte omsättas under ett äventyr (REG s.46).");
    }

    const context = await this._prepareContext();
    const row = this.#rowFor(context, item.id);
    if (!row || row.blocked) return;
    if (!row.affordable) {
      return ui.notifications.warn(`${row.label} kostar ${row.cost} EP — det finns inte täckning.`);
    }

    // Egen pott först, fria bonuspoäng fyller på. Det gör att bundna poäng inte
    // blir liggande oanvända medan den fria potten töms.
    const itemUpdate = { [item.type === "besvarjelse" ? "system.sValue" : "system.fv"]: row.next };
    if (row.usableOwn > 0) {
      itemUpdate["system.ep.spent"] = (item.system.ep?.spent ?? 0) + row.usableOwn;
    }
    await item.update(itemUpdate);
    if (row.bonusNeeded > 0) {
      await this.actor.update({
        "system.ep.bonusSpent": (this.actor.system.ep.bonusSpent ?? 0) + row.bonusNeeded
      });
    }

    const paid = [
      row.usableOwn > 0 ? `${row.usableOwn} egna` : null,
      row.bonusNeeded > 0 ? `${row.bonusNeeded} bonus` : null
    ].filter(Boolean).join(" + ");

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="dode-chat-card"><h3>Höjning</h3>
        <p><strong>${row.label}</strong> ${row.current} → ${row.next}</p>
        <p>Kostnad ${row.cost} EP (${paid})</p></div>`
    });

    this.render();
  }
}
