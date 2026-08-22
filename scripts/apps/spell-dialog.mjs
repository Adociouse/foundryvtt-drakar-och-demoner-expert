import { resolveSpellCast, applySpellResult, postSpellCard } from "../rolls/spell.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Kast-UI — Magisystem-planen Fas 3 (2026-08-21). En författningsyta ovanpå
 * den redan byggda, deterministiskt liveverifierade motorn (`resolveSpellCast`/
 * `applySpellResult`/`postSpellCard`, rolls/spell.mjs) — mirror av
 * `attack-dialog.mjs`s uppbyggnad: samla effektgrad/mål, ETT
 * `resolveSpellCast()`-anrop, sedan direkt skrivning ELLER väntande kort
 * beroende på ägarskap.
 *
 * ⚠ Ersätter den TIDIGARE direkta `data-action="castSpell"` → `actor.castSpell()`-
 * kopplingen (karaktärsarkets besvärjelserad) — precis som `#onDeclareAttack`
 * en gång ersatte en bar skaderulle. `DoDEActor#castSpell` (documents/actor.mjs)
 * finns kvar oförändrad för konsol-/makrobruk (ren CL/PSY-kontroll utan mål),
 * men arkets knapp öppnar nu den här dialogen i stället.
 *
 * ⚠ EN delad kastningsslag för ALLA mål (till skillnad från Anfallsdialogen,
 * som gör ett OBEROENDE `resolveAttack()`-anrop per mål). En besvärjelse
 * kastas EN gång och kan träffa flera mål med samma slag (Eldklot mot tre
 * fiender) — `resolveSpellCast` är därför medvetet byggd för att ta en HEL
 * mål-array i ETT anrop, se spell.mjs:s modulkommentar. Det betyder att
 * ägarskapsbeslutet (direkt skrivning kontra väntande godkännande) görs för
 * HELA kastningen på en gång, inte per mål — om NÅGOT mål inte ägs av
 * anroparen går HELA det redan beräknade resultatet till SL-godkännande.
 */
export default class DoDESpellDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dode-spell-dialog-{id}",
    tag: "div",
    classes: ["dode", "dode-spell-dialog"],
    position: { width: 480, height: "auto" },
    window: { title: "Kasta besvärjelse", resizable: true },
    actions: {
      submitCast: DoDESpellDialog.#onSubmitCast
    }
  };

  static PARTS = {
    body: { template: "systems/drakar-och-demoner-expert/templates/apps/spell-dialog.hbs" }
  };

  /**
   * @param {Actor} actor Kastaren.
   * @param {object} [o]
   * @param {Item} [o.item] Förvald besvärjelse (karaktärsarkets radknapp).
   */
  constructor(actor, { item = null } = {}) {
    super();
    this.actor = actor;
    this.itemId = item?.id ?? actor.items.find((i) => i.type === "besvarjelse")?.id ?? null;
  }

  get title() {
    return `Kasta besvärjelse — ${this.actor.name}`;
  }

  #selectedItem() {
    return this.itemId ? (this.actor.items.get(this.itemId) ?? null) : null;
  }

  /** Samma mönster som attack-dialog.mjs's #targetTokens() — game.user.targets, ingen egen väljar-UI. */
  #targetTokens() {
    return [...game.user.targets];
  }

  async _prepareContext() {
    const spellOptions = this.actor.items
      .filter((i) => i.type === "besvarjelse")
      .map((i) => ({ key: i.id, label: `${i.name} (S${i.system.sValue})`, sValue: i.system.sValue, targetMode: i.system.targetMode }));

    const item = this.#selectedItem();
    const targetMode = item?.system?.targetMode ?? "single";
    const needsTargets = targetMode !== "self";
    const isSplit = targetMode === "split";
    const multiTarget = targetMode === "multi" || targetMode === "area" || isSplit;
    const tokens = needsTargets ? this.#targetTokens() : [];

    const psy = this.actor.system.resources?.psy ?? {};

    return {
      spellOptions, itemId: this.itemId,
      noSpells: !spellOptions.length,
      itemDescription: item?.system?.description ?? "",
      sValue: item?.system?.sValue ?? 0,
      needsTargets, multiTarget, isSplit,
      // Enda-mål-läget (self/touch/single) använder bara det FÖRSTA
      // målsatta tokenet, precis som Anfallsdialogens enda-måls-vy — men
      // visar HELA listan om spelaren råkat målsätta flera, med en
      // förklarande rad, i stället för att tyst ignorera resten.
      targets: tokens.map((t) => ({ name: t.actor?.name ?? t.name, img: t.document?.texture?.src ?? t.actor?.img })),
      tooManyTargetsNote: needsTargets && !multiTarget && tokens.length > 1
        ? "Fler än ett mål markerat — bara det första används (enda-måls-besvärjelse)." : null,
      // "split" (Eld m.fl.): en delad tärningspool mellan valda mål, 1
      // tärning avstås per extra mål — se item-besvarjelse.mjs:s
      // targetMode-kommentar och spell.mjs#resolveSpellCast för beräkningen.
      splitNote: isSplit
        ? "Delar effektgradens tärningar mellan valda mål — fler mål ger färre tärningar per mål (max så många mål som effektgrad)."
        : null,
      selfTargetNote: !needsTargets ? "Riktar sig mot dig själv — inget mål behöver markeras." : null,
      psyValue: psy.value ?? psy.max ?? 0, psyMax: psy.max ?? 0
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelector('select[name="itemId"]')?.addEventListener("change", (event) => {
      this.itemId = event.currentTarget.value;
      this.render();
    });
    this.element.querySelector('input[name="effektgrad"]')?.addEventListener("change", () => this.#recomputePreview());
    this.#recomputePreview();
  }

  #recomputePreview() {
    const form = this.element;
    const sValue = Number(form.querySelector('select[name="itemId"]')?.selectedOptions[0]?.dataset.sValue ?? 0);
    const E = Math.max(1, Math.floor(Number(form.querySelector('input[name="effektgrad"]')?.value)) || 1);
    const cl = sValue - 2 * (E - 1);
    const out = form.querySelector(".cl-preview");
    if (out) out.textContent = `CL ${cl}`;

    // "split"-förhandsvisning (Eld m.fl.) — se item-besvarjelse.mjs:s
    // targetMode-kommentar: N = antal FAKTISKT målsatta tokens, klampat till
    // E (kan aldrig få fler sfärer än man har effektgrad till).
    const item = this.#selectedItem();
    const splitOut = form.querySelector(".split-preview");
    if (splitOut && item?.system?.targetMode === "split") {
      const n = Math.max(1, Math.min(E, this.#targetTokens().length || 1));
      const dice = Math.max(1, E - n + 1);
      splitOut.textContent = `${n} mål à ${dice}T6`;
    }
  }

  static async #onSubmitCast(event, target) {
    const form = this.element;
    const item = this.#selectedItem();
    if (!item) { ui.notifications.warn("Ingen besvärjelse vald."); return; }

    const effektgrad = Math.max(1, Math.floor(Number(form.querySelector('input[name="effektgrad"]')?.value)) || 1);
    const targetMode = item.system.targetMode ?? "single";
    const isSplit = targetMode === "split";
    const multiTarget = targetMode === "multi" || targetMode === "area" || isSplit;

    let targetActors;
    if (targetMode === "self") {
      targetActors = [this.actor];
    } else {
      const tokens = this.#targetTokens().filter((t) => t?.actor);
      if (!tokens.length) { ui.notifications.warn("Inget mål valt — hovra en token och tryck T."); return; }
      // "split": max lika många sfärer som effektgrad — extra målsatta
      // tokens utöver det ignoreras (spelaren kan sänka E i stället om fler
      // mål önskas, se splitNote i dialogen).
      targetActors = isSplit ? tokens.slice(0, effektgrad).map((t) => t.actor)
        : multiTarget ? tokens.map((t) => t.actor) : [tokens[0].actor];
    }

    const result = await resolveSpellCast({ caster: this.actor, item, effektgrad, targets: targetActors });

    // ⚠ HELA kastningen (alla mål) delar ETT ägarskapsbeslut — se
    // klassens modulkommentar för varför, till skillnad från
    // Anfallsdialogens per-mål-beslut.
    //
    // ⚠ Rättad 2026-08-21 (live-fynd, mitt i krogslagsmålet): ett MISSLYCKAT
    // eller FUMMLAT kast har `result.pending.targets === []` (resolveSpellCast
    // returnerar tidigt, se den funktionens kommentar) — det finns då INGET
    // att skriva på målet alls, bara ev. kastarens EGET PSY-avdrag (som
    // kastaren alltid äger, oavsett vem målet är). Att kräva SL-godkännande
    // för ett kort som ändå inte kommer skriva något var en ren irritation
    // ("Misslyckade kast ska inte behöva godkännande") — inte en säkerhetsfråga,
    // bara en onödig extra kö-post. Bara kastningar som FAKTISKT vill skriva
    // något på ett oägt mål (instant-effekt/status/spellEffect) går längre.
    const hasTargetWrites = result.pending.targets.some((t) => t.instantEffect || t.status || t.spellEffect);
    const canApplyDirectly = game.user.isGM || !hasTargetWrites || targetActors.every((a) => a.isOwner);
    if (canApplyDirectly) {
      await applySpellResult(result, { caster: this.actor, targets: targetActors });
      await postSpellCard(result, { caster: this.actor, targets: targetActors });
    } else {
      await postSpellCard(result, { caster: this.actor, targets: targetActors, pending: true });
      ui.notifications.info("Besvärjelsen är kastad och väntar på SL-godkännande.");
      if (!game.users.some((u) => u.isGM && u.active)) {
        ui.notifications.warn("Ingen SL är online just nu — besvärjelsen väntar tills en SL loggar in och godkänner.");
      }
    }

    this.close();
  }
}
