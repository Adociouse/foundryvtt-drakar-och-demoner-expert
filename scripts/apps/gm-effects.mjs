const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const KIND_LABELS = {
  skillMod: "Färdighetsbonus",
  clMod: "Situationellt CL-mod",
  recoveryMod: "Läkningstakt"
};

function skillCatalog() {
  return [...CONFIG.DODE.primarySkills, ...CONFIG.DODE.secondarySkills]
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

function skillLabel(key) {
  return skillCatalog().find((s) => s.key === key)?.name ?? key;
}

/**
 * GM-effektfönstret — en författningsyta ovanpå TRE separata lagringsplatser
 * (världs-Setting, scen-flagga, aktörs-flagga), samma CRUD-API som redan
 * byggdes och liveverifierades i config.mjs (DODE.getWorldEffects m.fl.) —
 * se docs/dev/GM_EFFEKTFONSTER_ANALYS.md. Fönstret lägger INTE till en fjärde
 * datamodell, det är bara ett formulär över de tre som redan finns.
 *
 * ⚠ Attributbonusar (analysdokumentets typ 3) och villkor (typ 5) hör INTE
 * hemma här — de går via riktiga ActiveEffects (game.dode.SceneEffects)
 * respektive CONFIG.statusEffects/Token HUD, som redan ger dem gratis (se
 * CLAUDE.md "Kolla Foundrys inbyggda funktioner FÖRST"). Det här fönstret
 * täcker bara de effekttyper som saknar en inbyggd Foundry-mekanism:
 * skillMod, clMod, recoveryMod (namngivna effekter) — plus aktörens
 * periodiska effekter (gift m.fl., ett separat lager, se config.mjs).
 *
 * ⚠ Varaktighet: `duration.mode:"manual"` går aldrig ut av sig själv (ingen
 * inbyggd urblekning finns på Setting/flagg-nivå, till skillnad från en
 * riktig ActiveEffects `duration`) — GM:en tar bort raden för hand.
 * `"timed"` beräknar `expiresAt` en gång vid skapandet utifrån
 * `game.time.worldTime` + vald varaktighet; `DODE.isEffectExpired` (redan
 * byggd) avgör om raden är utgången vid varje läsning. Utgångna rader visas
 * här (så GM:en ser vad som just klingat av) men räknas inte längre av
 * `namedSkillModEffects`/`recoveryModEffects`/`situationalClMods`.
 */
export default class DoDEGmEffectsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dode-gm-effects",
    tag: "div",
    classes: ["dode", "dode-gm-effects"],
    position: { width: 640, height: 760 },
    window: { title: "GM-effekter", resizable: true },
    actions: {
      addWorldEffect: DoDEGmEffectsApp.#onAddWorldEffect,
      removeWorldEffect: DoDEGmEffectsApp.#onRemoveWorldEffect,
      addSceneEffect: DoDEGmEffectsApp.#onAddSceneEffect,
      removeSceneEffect: DoDEGmEffectsApp.#onRemoveSceneEffect,
      addActorEffect: DoDEGmEffectsApp.#onAddActorEffect,
      removeActorEffect: DoDEGmEffectsApp.#onRemoveActorEffect,
      addPeriodicEffect: DoDEGmEffectsApp.#onAddPeriodicEffect,
      removePeriodicEffect: DoDEGmEffectsApp.#onRemovePeriodicEffect
    }
  };

  static PARTS = {
    body: { template: "systems/drakar-och-demoner-expert/templates/apps/gm-effects.hbs", scrollable: [".dode-gm-effects-body"] }
  };

  constructor(options = {}) {
    super(options);
    this.selectedActorId = game.actors.find((a) => a.type === "character")?.id ?? null;
  }

  get title() {
    return "GM-effekter";
  }

  #decorate(effect) {
    const expired = CONFIG.DODE.isEffectExpired(effect);
    let targetLabel = "—";
    if (effect.kind === "skillMod") targetLabel = skillLabel(effect.skillKey);
    else if (effect.kind === "recoveryMod") targetLabel = effect.resource === "psy" ? "PSY" : "KP";
    return {
      ...effect,
      kindLabel: KIND_LABELS[effect.kind] ?? effect.kind,
      targetLabel,
      opLabel: effect.kind === "clMod" ? "" : (effect.operation === "multiply" ? "×" : "+"),
      expired,
      durationLabel: effect.duration?.mode === "timed"
        ? new Date((effect.duration.expiresAt ?? 0) * 1000).toISOString().replace("T", " ").slice(0, 16)
        : "Tills borttagen"
    };
  }

  async _prepareContext() {
    const scene = game.scenes.active ?? canvas?.scene ?? null;
    const actors = game.actors.filter((a) => a.type === "character");
    const actor = this.selectedActorId ? game.actors.get(this.selectedActorId) : null;

    return {
      skillOptions: skillCatalog(),
      worldEffects: CONFIG.DODE.getWorldEffects({ includeExpired: true }).map((e) => this.#decorate(e)),
      scene,
      sceneEffects: scene ? CONFIG.DODE.getSceneEffects(scene, { includeExpired: true }).map((e) => this.#decorate(e)) : [],
      actors: actors.map((a) => ({ id: a.id, name: a.name, active: a.id === this.selectedActorId })),
      actor,
      actorEffects: actor ? CONFIG.DODE.getActorEffects(actor, { includeExpired: true }).map((e) => this.#decorate(e)) : [],
      periodicEffects: actor ? CONFIG.DODE.getPeriodicEffects(actor) : []
    };
  }

  // ⚠ `<select>`-lyssnare måste bindas med en riktig `change`-listener, inte
  // `data-action` — se DESIGN_DECISIONS.md §6 "data-action på <select>
  // never fires". Samma mönster som character-wizard.mjs redan använder.
  _onRender(context, options) {
    super._onRender?.(context, options);
    const actorSelect = this.element.querySelector('select[name="actorId"]');
    actorSelect?.addEventListener("change", (event) => {
      this.selectedActorId = event.currentTarget.value || null;
      this.render();
    });
    for (const kindSelect of this.element.querySelectorAll('select[name="kind"]')) {
      kindSelect.addEventListener("change", () => this.#syncKindFields(kindSelect));
      this.#syncKindFields(kindSelect);
    }
    for (const durationSelect of this.element.querySelectorAll('select[name="durationMode"]')) {
      durationSelect.addEventListener("change", () => this.#syncDurationFields(durationSelect));
      this.#syncDurationFields(durationSelect);
    }
  }

  #syncKindFields(kindSelect) {
    const form = kindSelect.closest("[data-effect-form]");
    if (!form) return;
    const kind = kindSelect.value;
    form.querySelector('[data-field="skillKey"]')?.classList.toggle("hidden", kind !== "skillMod");
    form.querySelector('[data-field="resource"]')?.classList.toggle("hidden", kind !== "recoveryMod");
    form.querySelector('[data-field="operation"]')?.classList.toggle("hidden", kind === "clMod");
  }

  #syncDurationFields(durationSelect) {
    const form = durationSelect.closest("[data-effect-form]");
    if (!form) return;
    form.querySelector('[data-field="durationAmount"]')?.classList.toggle("hidden", durationSelect.value !== "timed");
  }

  #readEffectForm(form) {
    const label = form.querySelector('[name="label"]').value.trim();
    if (!label) { ui.notifications.warn("Effekten behöver ett namn."); return null; }
    const kind = form.querySelector('[name="kind"]').value;
    const value = Number(form.querySelector('[name="value"]').value) || 0;
    const operation = form.querySelector('[name="operation"]')?.value ?? "add";
    const durationMode = form.querySelector('[name="durationMode"]').value;
    const note = form.querySelector('[name="note"]')?.value.trim() ?? "";

    const effect = { label, kind, value, note };
    if (kind === "skillMod") {
      effect.skillKey = form.querySelector('[name="skillKey"]').value.trim();
      effect.operation = operation;
      if (!effect.skillKey) { ui.notifications.warn("Ange en färdighetsnyckel."); return null; }
    } else if (kind === "recoveryMod") {
      effect.resource = form.querySelector('[name="resource"]').value;
      effect.operation = operation;
    }

    if (durationMode === "timed") {
      const amount = Number(form.querySelector('[name="durationAmount"]').value) || 0;
      const unit = form.querySelector('[name="durationUnit"]').value;
      const seconds = amount * (unit === "dygn" ? 86400 : unit === "timmar" ? 3600 : 60);
      effect.duration = { mode: "timed", expiresAt: (game.time?.worldTime ?? 0) + seconds };
    } else {
      effect.duration = { mode: "manual" };
    }
    return effect;
  }

  static async #onAddWorldEffect(event, target) {
    const form = target.closest("[data-effect-form]");
    const effect = this.#readEffectForm(form);
    if (!effect) return;
    await CONFIG.DODE.addWorldEffect(effect);
    this.render();
  }

  static async #onRemoveWorldEffect(event, target) {
    await CONFIG.DODE.removeWorldEffect(target.closest("[data-effect-id]").dataset.effectId);
    this.render();
  }

  static async #onAddSceneEffect(event, target) {
    const scene = game.scenes.active ?? canvas?.scene ?? null;
    if (!scene) return ui.notifications.warn("Ingen aktiv scen.");
    const form = target.closest("[data-effect-form]");
    const effect = this.#readEffectForm(form);
    if (!effect) return;
    await CONFIG.DODE.addSceneEffect(scene, effect);
    this.render();
  }

  static async #onRemoveSceneEffect(event, target) {
    const scene = game.scenes.active ?? canvas?.scene ?? null;
    if (!scene) return;
    await CONFIG.DODE.removeSceneEffect(scene, target.closest("[data-effect-id]").dataset.effectId);
    this.render();
  }

  static async #onAddActorEffect(event, target) {
    const actor = this.selectedActorId ? game.actors.get(this.selectedActorId) : null;
    if (!actor) return ui.notifications.warn("Välj en rollperson.");
    const form = target.closest("[data-effect-form]");
    const effect = this.#readEffectForm(form);
    if (!effect) return;
    await CONFIG.DODE.addActorEffect(actor, effect);
    this.render();
  }

  static async #onRemoveActorEffect(event, target) {
    const actor = this.selectedActorId ? game.actors.get(this.selectedActorId) : null;
    if (!actor) return;
    await CONFIG.DODE.removeActorEffect(actor, target.closest("[data-effect-id]").dataset.effectId);
    this.render();
  }

  static async #onAddPeriodicEffect(event, target) {
    const actor = this.selectedActorId ? game.actors.get(this.selectedActorId) : null;
    if (!actor) return ui.notifications.warn("Välj en rollperson.");
    const form = target.closest("[data-effect-form]");
    const label = form.querySelector('[name="label"]').value.trim();
    if (!label) return ui.notifications.warn("Effekten behöver ett namn.");
    const cadence = form.querySelector('[name="cadence"]').value;
    const targetField = form.querySelector('[name="target"]').value.trim() || "hp";
    const amount = Number(form.querySelector('[name="amount"]').value) || 0;
    const ticksRemaining = Number(form.querySelector('[name="ticks"]').value) || 0;
    if (ticksRemaining < 1) return ui.notifications.warn("Antal tickar måste vara minst 1.");
    await CONFIG.DODE.addPeriodicEffect(actor, {
      label, cadence, target: targetField, amount, ticksRemaining, source: "gm"
    });
    this.render();
  }

  static async #onRemovePeriodicEffect(event, target) {
    const actor = this.selectedActorId ? game.actors.get(this.selectedActorId) : null;
    if (!actor) return;
    await CONFIG.DODE.removePeriodicEffect(actor, target.closest("[data-effect-id]").dataset.effectId);
    this.render();
  }
}
