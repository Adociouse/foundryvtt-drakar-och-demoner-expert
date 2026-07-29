const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Träningsfönstret — omsättning av EP till FV efter en viloperiod.
 *
 * ⚠ Eget fönster, inte ett läge på rollpersonsarket. Reglerna behandlar det här
 * som en egen händelse mellan äventyren: EP kan inte omsättas under ett pågående
 * äventyr, och först efter minst 7 dagars sammanhängande vila (REG s.46). Ett
 * alltid närvarande köpläge på arket hade suddat ut den gränsen. SL öppnar
 * grinden (`system.rest.trainingUnlocked`), spelaren tränar, grinden stängs.
 *
 * Tre finansieringsregler, som skiljer sig åt i böckerna:
 *
 *  - **Vanlig färdighet** — betalas ur färdighetens EGEN pott (streck intjänade
 *    genom att lyckas i spel, REG s.45) och/eller SL:s fria bonuspoäng.
 *  - **Besvärjelse (S-värde)** — samma två källor, men potten fylls på en
 *    sömnklocka (MAG s.23) i stället för av stresslägen.
 *  - **Magiskola (FV)** — ⚠ kan ALDRIG betalas med intjänad EP: "FV i magiskolor
 *    förbättras BARA via träning, INTE via erfarenhet under äventyr" (MAG s.23).
 *    Skolan tjänar alltså aldrig egna streck, och raden kan bara betalas med
 *    fria bonuspoäng.
 *
 * ⚠ Att lära sig en HELT NY skola kräver lärare och kan inte göras på egen hand
 * (MAG s.23) — det ligger utanför det här fönstret, som bara höjer det man redan
 * har. Nya skolor delas ut av SL på arket.
 */
export default class DoDETrainingApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dode-training-{id}",
    tag: "div",
    classes: ["dode", "dode-training"],
    position: { width: 640, height: 720 },
    window: { title: "Träning", resizable: true, icon: "fa-solid fa-dumbbell" },
    actions: {
      buy: DoDETrainingApp.#onBuy
    }
  };

  static PARTS = {
    body: { template: "systems/drakar-och-demoner-expert/templates/apps/training.hbs" }
  };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
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
   * En rad i fönstret. `own` är färdighetens egen pott, `bonusNeeded` hur mycket
   * som måste tas ur den fria potten för att nå kostnaden.
   */
  #row({ item, label, current, cost, own, canUseOwn, note = "", blocked = false }) {
    const bonusAvailable = this.actor.system.ep.bonusAvailable ?? 0;
    const usableOwn = canUseOwn ? Math.min(own, cost) : 0;
    const bonusNeeded = cost - usableOwn;
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
      affordable: !blocked && bonusNeeded <= bonusAvailable
    };
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
            // Bär bokens egen begränsning ut i UI:t i stället för att bara greya knappen.
            note: "Endast träning — skolans FV kan inte höjas med äventyrs-EP (MAG s.23)"
          }));
        } else {
          skills.push(this.#row({
            item, label: item.name, current: fv,
            cost: DODE.skillCost(item.system.costTier, fv, fv + 1),
            own, canUseOwn: true,
            note: CONFIG.DODE.costTiers[item.system.costTier]
              ? game.i18n.localize(CONFIG.DODE.costTiers[item.system.costTier])
              : ""
          }));
        }
      } else if (item.type === "besvarjelse") {
        const schoolFv = this.#schoolFv(item.system.school);
        const s = item.system.sValue;
        // Priset följer magikerns FV i SKOLAN, inte besvärjelsens S (MAG s.13).
        // Utan skolan finns ingen kostnadsgrund alls.
        spells.push(this.#row({
          item, label: item.name, current: s,
          cost: schoolFv ? DODE.spellCost(schoolFv, s, s + 1) : 0,
          own: item.system.ep?.available ?? 0,
          canUseOwn: true,
          blocked: !schoolFv,
          note: schoolFv
            ? `Skolans FV ${schoolFv} → grundkostnad ${DODE.spellBaseCost(schoolFv)} × ${DODE.magicCostMultiplier(schoolFv)}`
            : "⚠ Rollpersonen saknar färdighet i besvärjelsens skola — ingen kostnadsgrund"
        }));
      }
    }

    const byLabel = (a, b) => a.label.localeCompare(b.label, "sv");
    return {
      actor: this.actor,
      unlocked: !!this.actor.system.rest.trainingUnlocked,
      bonusAvailable: this.actor.system.ep.bonusAvailable ?? 0,
      skills: skills.sort(byLabel),
      schools: schools.sort(byLabel),
      spells: spells.sort(byLabel)
    };
  }

  static async #onBuy(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    // Grinden kontrolleras här också, inte bara i mallen — fönstret kan stå öppet
    // när SL stänger den.
    if (!this.actor.system.rest.trainingUnlocked) {
      return ui.notifications.warn("Viloperioden är inte öppnad — EP kan inte omsättas under ett äventyr (REG s.46).");
    }

    const context = await this._prepareContext();
    const row = [...context.skills, ...context.schools, ...context.spells].find((r) => r.id === item.id);
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
      content: `<div class="dode-chat-card"><h3>Träning</h3>
        <p><strong>${row.label}</strong> ${row.current} → ${row.next}</p>
        <p>Kostnad ${row.cost} EP (${paid})</p></div>`
    });

    this.render();
  }
}
