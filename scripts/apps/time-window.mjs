import { TIME_KINDS, DAY, advanceTime } from "../helpers/time.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Tidsfönstret — SL:s enda ställe för att flytta klockan utanför strid.
 *
 * ⚠ Ersätter Viloperiod-dialogen: i stället för att fråga hur länge man vilat
 * **flyttas klockan**, och grindarna öppnas av att tiden passerat. Se
 * DESIGN_DECISIONS.md §10.
 */
export default class DoDETimeWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dode-time-window",
    classes: ["dode", "dode-time"],
    position: { width: 420, height: "auto" },
    window: { title: "Tid", resizable: false },
    actions: {
      setKind: DoDETimeWindow.#onSetKind,
      advance: DoDETimeWindow.#onAdvance,
      advanceCustom: DoDETimeWindow.#onAdvanceCustom
    }
  };

  static PARTS = { body: { template: "systems/drakar-och-demoner-expert/templates/apps/time-window.hbs" } };

  kind = "aventyr";

  async _prepareContext() {
    const kinds = {};
    for (const [key, k] of Object.entries(TIME_KINDS)) {
      kinds[key] = { label: k.label, active: key === this.kind,
        hint: k.buildsStreak ? "Bygger vilosvit, läker full takt" : "Nollar vilosviten, läker halva takten" };
    }
    const cfg = TIME_KINDS[this.kind];
    return {
      worldTime: new Date(game.time.worldTime * 1000).toISOString().replace("T", " ").slice(0, 16),
      kinds, steps: CONFIG.DODE.timeSteps,
      kindHint: cfg.buildsStreak
        ? "⚠ Vila bygger den sammanhängande viloperioden — 7 dygn öppnar träningen (RP s.63)."
        : "⚠ Resa och äventyr NOLLSTÄLLER viloperioden, men man sover ändå — EP-klockan nollas.",
      actors: game.actors.filter((a) => a.type === "character").map((a) => ({
        id: a.id, name: a.name, checked: true,
        streak: Math.floor(a.system.rest?.streakDays ?? 0),
        unlocked: !!a.system.rest?.trainingUnlocked,
        kp: `${a.system.hp?.value ?? 0}/${a.system.hp?.max ?? 0} KP`
      }))
    };
  }

  #selected() {
    return [...this.element.querySelectorAll("[data-actor-id]")]
      .filter((c) => c.checked).map((c) => game.actors.get(c.dataset.actorId)).filter(Boolean);
  }

  async #run(seconds) {
    const res = await advanceTime({ seconds, kind: this.kind, actors: this.#selected() });
    const lines = res.report.map((r) =>
      `<li>${r.name}: vila ${Math.floor(r.streak)}/7${r.unlocked ? " — <strong>träning öppen</strong>" : ""}`
      + (r.healed ? ` · läkte ${r.healed} KP` : "") + (r.restored ? " · <em>helt återställd</em>" : "") + "</li>").join("");
    await ChatMessage.create({
      content: `<div class="dode-chat-card"><h3>${res.kind} — ${res.days} dygn</h3><ul>${lines}</ul></div>`
    });
    this.render();
  }

  static async #onSetKind(event, target) { this.kind = target.dataset.kind; this.render(); }
  static async #onAdvance(event, target) { await this.#run(Number(target.dataset.seconds)); }
  static async #onAdvanceCustom() {
    const days = Number(this.element.querySelector('input[name="days"]').value) || 0;
    if (days > 0) await this.#run(days * DAY);
  }
}
