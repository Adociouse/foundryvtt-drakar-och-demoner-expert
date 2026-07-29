const { HandlebarsApplicationMixin } = foundry.applications.api;
const { DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const GEAR_TYPES = ["vapen", "rustning", "utrustning", "besvarjelse"];

export default class DoDECharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dode", "sheet", "actor", "character"],
    position: { width: 680, height: 800 },
    window: { resizable: true },
    dragDrop: [{ dragSelector: "[data-item-id]", dropSelector: "form" }],
    actions: {
      rollSkill: DoDECharacterSheet.#onRollSkill,
      addSkill: DoDECharacterSheet.#onAddSkill,
      grantSpell: DoDECharacterSheet.#onGrantSpell,
      editSkill: DoDECharacterSheet.#onEditSkill,
      deleteSkill: DoDECharacterSheet.#onDeleteSkill,
      editItem: DoDECharacterSheet.#onEditItem,
      deleteItem: DoDECharacterSheet.#onDeleteItem,
      toggleEquipped: DoDECharacterSheet.#onToggleEquipped,
      addAbility: DoDECharacterSheet.#onAddAbility,
      rollAbility: DoDECharacterSheet.#onRollAbility,
      deleteAbility: DoDECharacterSheet.#onDeleteAbility,
      clearRas: DoDECharacterSheet.#onClearRas,
      clearYrke: DoDECharacterSheet.#onClearYrke,
      toggleWizardUnlock: DoDECharacterSheet.#onToggleWizardUnlock,
      openWizardEdit: DoDECharacterSheet.#onOpenWizardEdit,
      rollDamage: DoDECharacterSheet.#onRollDamage,
      castSpell: DoDECharacterSheet.#onCastSpell,
      openTraining: DoDECharacterSheet.#onOpenTraining,
      toggleRest: DoDECharacterSheet.#onToggleRest,
      awardBonusEp: DoDECharacterSheet.#onAwardBonusEp
    },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    form: { template: "systems/drakar-och-demoner-expert/templates/actor/character-sheet.hbs" }
  };

  get title() {
    return this.actor.name;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.attributes = CONFIG.DODE.attributes;
    // Härkomst syns på raden — en färdighet som SL delat ut efter träning ska
    // gå att skilja från en som fanns från skapandet.
    // Härkomst syns på raden — en färdighet som SL delat ut efter träning ska
    // gå att skilja från en som fanns från skapandet. Vanliga vyobjekt, inte
    // klonade Documents: att kopiera ett Document med Object.assign tappar
    // getters och är svårt att lita på.
    context.skills = this.actor.items
      .filter((i) => i.type === "fardighet")
      .map((i) => ({
        id: i.id, name: i.name, system: i.system,
        grantedBy: i.getFlag(game.system.id, "grantedBy"),
        grantedReason: i.getFlag(game.system.id, "grantedReason")
      }));
    context.gear = this.actor.items
      .filter((i) => GEAR_TYPES.includes(i.type))
      .map((item) => ({
        item,
        isVapen: item.type === "vapen",
        isRustning: item.type === "rustning",
        isBesvarjelse: item.type === "besvarjelse",
        isUtrustning: item.type === "utrustning",
        // Utrustningsbara typer visar en av/på-växel som styr om föremålets
        // ActiveEffects appliceras — se DoDeActiveEffect.isGateOpen().
        canEquip: item.type === "vapen" || item.type === "rustning" || item.type === "utrustning"
      }));
    // Förmåga-Item (bär transfer-AE:er, alltid aktiva). Separat från fritext-
    // arrayen system.specialAbilities.
    context.formagor = this.actor.items.filter((i) => i.type === "formaga");
    context.race = this.actor.system.race;
    context.profession = this.actor.system.profession;
    // Guide-redigering (DESIGN_DECISIONS.md backlog 4c): SL låser upp en
    // specifik rollperson, spelaren går sedan själv in i guiden, och låset
    // slår till igen när guiden sparar. `isGM` är Foundrys egen roll >= 3
    // (Assistent-SL räknas som SL — se §6).
    context.isGM = game.user.isGM;
    context.wizardUnlocked = !!this.actor.getFlag(game.system.id, "wizardUnlocked");
    context.canEditInWizard = context.isGM || context.wizardUnlocked;
    // Viloperiodsgrinden — REG s.46. SL öppnar, spelaren tränar. Träningsknappen
    // visas bara när grinden är öppen; SL ser växeln alltid.
    context.trainingUnlocked = !!this.actor.system.rest?.trainingUnlocked;
    context.minimagi = await this.#prepareMinimagi();
    return context;
  }

  static async #onOpenTraining() {
    const { default: DoDETrainingApp } = await import("../apps/training.mjs");
    new DoDETrainingApp(this.actor).render(true);
  }

  /**
   * Öppnar/stänger viloperiodsgrinden (REG s.46). Att öppna nollar samtidigt
   * besvärjelsernas sömnklocka, eftersom vilan i praktiken innehåller en sömn.
   */
  static async #onToggleRest() {
    const { setTrainingUnlocked } = await import("../helpers/ep.mjs");
    const next = !this.actor.system.rest?.trainingUnlocked;
    await setTrainingUnlocked(this.actor, next);
    ui.notifications.info(next
      ? `Viloperiod öppnad för ${this.actor.name} — träning möjlig.`
      : `Viloperiod stängd för ${this.actor.name}.`);
  }

  /**
   * SL:s bonuspoäng efter äventyr — REG s.46: 1-4 uppdragsframgång, 1-2 svåra
   * gärningar, 1-4 god rollspelning, max 10 per äventyr. ⚠ Taket är rådgivande
   * här: systemet vet inte var ett äventyr börjar och slutar, så det står som en
   * påminnelse i dialogen i stället för som en spärr.
   */
  static async #onAwardBonusEp() {
    const amount = await DialogV2.prompt({
      window: { title: "Dela ut bonuspoäng" },
      content: `<p>Fria EP till <strong>${this.actor.name}</strong>. Ej bundna till någon färdighet.</p>
        <p class="hint">REG s.46: 1-4 uppdragsframgång · 1-2 svåra gärningar · 1-4 god rollspelning.
        Högst 10 per äventyr.</p>
        <input type="number" name="amount" value="1" min="1" max="10" autofocus />`,
      ok: { label: "Dela ut", callback: (event, button) => Number(button.form.elements.amount.value) }
    });
    if (!amount || amount <= 0) return;
    const { awardBonusEp } = await import("../helpers/ep.mjs");
    await awardBonusEp(this.actor, amount);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="dode-chat-card"><h3>Bonuspoäng</h3>
        <p>${this.actor.name} får <strong>${amount} fria EP</strong>.</p></div>`
    });
  }

  /**
   * Minibesvärjelser som rollpersonen har tillgång till.
   *
   * ⚠ HÄRLEDDA, inte ägda. MAG s.23 ger minimagin med skolan: man behöver inte
   * äga någon post för att kunna använda den, och listan ska ändras av sig själv
   * när magikern lär sig en ny skola. Därför läses de ur kompendiet utifrån
   * rollpersonens skolfärdigheter i stället för att kopieras in på aktören.
   *
   * ⚠ EN SKOLA → MÅNGA MINIBESVÄRJELSER, OCH FLERA SKOLOR SAMTIDIGT. Johans
   * beslut 2026-07-29: en magiker som lär sig ytterligare en skola får också den
   * skolans minimagi. MAG s.23:s formulering "den tillhör automatiskt den skola
   * där magikern har högst FV" handlar om magiker som inte tillhör NÅGON skola —
   * direkt före står att "varje magiskola har sina egna minibesvärjelser". Den
   * tidigare implementationen läste bara högsta-FV-skolan och hade tystnat en
   * skola så fort magikern lärde sig en till.
   *
   * SL:s ad hoc-utdelningar ligger som riktiga Items på aktören och läggs till
   * ovanpå — de är just undantagen från skolhärledningen.
   */
  async #prepareMinimagi() {
    const schools = new Map();
    for (const item of this.actor.items) {
      if (item.type !== "fardighet") continue;
      if (!CONFIG.DODE.isMagicSchoolKey(item.system.skillKey)) continue;
      schools.set(item.system.skillKey.replace(/^magiskola-/, ""), item.system.total);
    }

    const granted = this.actor.items.filter((i) => i.type === "minibesvarjelse");
    if (!schools.size && !granted.length) return null;

    const entries = [];
    for (const packId of CONFIG.DODE.contentPacks.spells) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      const docs = await pack.getDocuments({ type: "minibesvarjelse" });
      for (const doc of docs) {
        if (!schools.has(doc.system.school)) continue;
        entries.push({
          name: doc.name, img: doc.img, school: doc.system.school,
          schoolLabel: game.i18n.localize(CONFIG.DODE.magicSchools[doc.system.school]),
          psyCost: doc.system.psyCost,
          fv: schools.get(doc.system.school),
          // MAG s.23:s åthävotrappa — samma minibesvärjelse kräver olika mycket
          // av magikern beroende på FV i skolan.
          gestures: schools.get(doc.system.school) >= 25
            ? "Omedvetet — kräver ingen uppmärksamhet"
            : schools.get(doc.system.school) >= 15
              ? "Inga yttre åthävor"
              : "Kräver gester och ord"
        });
      }
    }
    for (const item of granted) {
      entries.push({
        name: item.name, img: item.img, school: item.system.school,
        schoolLabel: game.i18n.localize(CONFIG.DODE.magicSchools[item.system.school]),
        psyCost: item.system.psyCost, id: item.id, isGranted: true,
        gestures: "Utdelad av spelledaren"
      });
    }
    if (!entries.length) return null;

    entries.sort((a, b) => a.schoolLabel.localeCompare(b.schoolLabel, "sv") || a.name.localeCompare(b.name, "sv"));
    return {
      entries,
      schoolCount: schools.size,
      schoolNames: [...schools.keys()]
        .map((k) => game.i18n.localize(CONFIG.DODE.magicSchools[k]))
        .sort((a, b) => a.localeCompare(b, "sv"))
        .join(", ")
    };
  }

  static #itemFromEvent(actor, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    return actor.items.get(itemId);
  }

  static async #onRollSkill(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) await this.actor.rollSkill(item);
  }

  static async #onEditSkill(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) item.sheet.render(true);
  }

  /**
   * Visar en väljare byggd på CONFIG.DODE.primarySkills/secondarySkills + yrkets
   * professionSkills (item-yrke.mjs) — redan innehavda färdigheter exkluderas.
   * "Annat"-alternativet faller tillbaka till fritext (samma beteende som innan
   * denna väljare fanns), så inget tas bort — bara ett riktigt förstahandsval
   * läggs till. Se CLAUDE.md/DESIGN_DECISIONS.md §3 (Förmågor/färdighetskatalog,
   * session 2026-07-27).
   */
  /**
   * SL:s "boon" — dela ut en färdighet, magiskola eller besvärjelse till en
   * rollperson mitt i kampanjen, typiskt efter träning.
   *
   * ⚠ **SL-låst.** Guiden täcker skapandet; det HÄR är vägen in för allt en
   * rollperson lär sig i spel. Att låta spelaren själv lägga till färdigheter
   * (som knappen gjorde fram till 2026-07-28) gör varje kostnadsnivå
   * meningslös — man tar bara det man vill ha. Se DESIGN_DECISIONS.md §3 23.
   *
   * ⚠ Startvärdet är **baschansen** ur grundegenskapen, inte 1. En färdighet
   * man precis lärt sig börjar på BC (RP s.29: "Baschansen är det FV du får
   * automatiskt"), och det gamla `fv: 1` gav fel värde för varje färdighet
   * vars grundegenskap låg över 3.
   *
   * Besvärjelser hamnar här av ett skäl Johan tog upp: en icke-magiker kan få
   * en välsignelse av SL under äventyret. Mekaniskt är det samma sak — SL
   * lägger ett `besvarjelse`-Item på rollpersonen.
   */
  static async #onAddSkill() {
    if (!game.user.isGM) {
      ui.notifications.warn("Bara SL kan dela ut nya färdigheter — de lärs in genom träning i spel.");
      return;
    }
    const actor = this.actor;
    const existingKeys = new Set(
      actor.items.filter((i) => i.type === "fardighet")
        .map((i) => i.system.skillKey || CONFIG.DODE.skillKey(i.name))
    );
    const professionSkills = (actor.system.profession?.system?.professionSkills ?? [])
      .filter((s) => !s.choiceCount)
      .map((s) => ({ ...s, key: s.key || CONFIG.DODE.skillKey(s.name) }))
      .filter((s) => !CONFIG.DODE.primarySkills.some((p) => p.key === s.key));

    // Vapenfärdigheter har ingen egen katalog — de namnges efter vapnet, så
    // vapnen i kompendiet är den bästa listan vi har. Samma resonemang som
    // yrkesfärdighetsstegets datalist i guiden.
    let weaponSkills = [];
    for (const packId of CONFIG.DODE.contentPacks.startingEquipment ?? []) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      weaponSkills.push(...(await pack.getDocuments())
        .filter((d) => d.type === "vapen")
        .map((d) => ({ key: CONFIG.DODE.skillKey(d.name), name: d.name, attribute: "smi" })));
    }

    const groups = [
      ["primar", game.i18n.localize("DODE.CostTier.Primar"), CONFIG.DODE.primarySkills],
      ["yrkesfardighet", game.i18n.localize("DODE.CostTier.Yrkesfardighet"), professionSkills],
      ["yrkesfardighet", "Vapenfärdigheter", weaponSkills],
      ["yrkesfardighet", "Magiskolor", CONFIG.DODE.magicSchoolSkills.map((m) => ({
        key: m.key, name: game.i18n.localize(m.labelKey), attribute: m.attribute
      }))],
      ["sekundar", game.i18n.localize("DODE.CostTier.Sekundar"), CONFIG.DODE.secondarySkills]
    ];
    let optionsHtml = "";
    for (const [tier, label, skills] of groups) {
      const available = (skills ?? [])
        .map((x) => ({ ...x, key: x.key || CONFIG.DODE.skillKey(x.name) }))
        .filter((x) => !existingKeys.has(x.key));
      if (!available.length) continue;
      optionsHtml += `<optgroup label="${label}">` + available
        .map((x) => `<option value="${tier}|${x.key}|${x.attribute}|${x.name}">${x.name}</option>`)
        .join("") + "</optgroup>";
    }

    const result = await foundry.applications.api.DialogV2.input({
      window: { title: `Dela ut färdighet till ${actor.name}` },
      content: `
        <p class="hint">Färdigheten läggs till på baschansen (BC) ur grundegenskapen.
        Anteckna gärna varför — det visas i chatten och på färdigheten.</p>
        <div class="form-group"><label>Färdighet</label>
          <select name="skillKey">${optionsHtml}<option value="custom">Annat (fritext)…</option></select>
        </div>
        <div class="form-group"><label>Eget namn</label><input type="text" name="customName" /></div>
        <div class="form-group"><label>Anledning</label>
          <input type="text" name="reason" placeholder="t.ex. Fyra veckors träning hos vapenmästaren" /></div>`
    });
    if (!result) return;

    let name, attribute, costTier, key;
    if (result.skillKey === "custom") {
      name = (result.customName ?? "").trim();
      if (!name) return;
      attribute = "smi"; costTier = "sekundar"; key = CONFIG.DODE.skillKey(name);
    } else {
      [costTier, key, attribute, name] = String(result.skillKey).split("|");
    }
    if (!name || existingKeys.has(key)) return;

    const total = actor.system.attributes?.[attribute]?.total ?? 0;
    const fv = CONFIG.DODE.attributeToGroup(total);
    const reason = (result.reason ?? "").trim();
    await actor.createEmbeddedDocuments("Item", [{
      name, type: "fardighet",
      system: { skillKey: key, attribute, costTier, fv },
      flags: { [game.system.id]: { grantedBy: game.user.name, grantedReason: reason } }
    }]);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="dode-chat-card"><h3>Ny färdighet</h3>`
        + `<p><strong>${actor.name}</strong> lärde sig <strong>${name}</strong> (FV ${fv}, ${game.i18n.localize(CONFIG.DODE.costTiers[costTier])}).</p>`
        + (reason ? `<p class="dode-chat-note">${reason}</p>` : "") + `</div>`
    });
  }

  /**
   * SL delar ut en besvärjelse eller välsignelse. Samma väg som färdigheter
   * ovan, men för `besvarjelse`-Items.
   *
   * ⚠ Kräver INTE att rollpersonen är magiker. Johans exempel: en icke-magiker
   * får en gudomlig välsignelse av SL mitt i kampanjen. Mekaniskt är en
   * välsignelse och en besvärjelse samma dokument — skillnaden är hur den
   * kom dit, vilket `grantedReason` fångar.
   */
  static async #onGrantSpell() {
    if (!game.user.isGM) return;
    const actor = this.actor;
    const have = new Set(actor.items.filter((i) => i.type === "besvarjelse").map((i) => i.name));
    // Yrkets magibehörighet (item-yrke.mjs `system.magic`). Paladinen får bara
    // Mentalism upp till skolvärde 12 och inga allmänna besvärjelser;
    // utbygdsjägaren bara Animism. Listan MARKERAR vad som ligger utanför
    // behörigheten i stället för att dölja det — SL ska kunna ge en välsignelse
    // som bryter mot yrkets normala gränser, det är hela poängen med en boon.
    const magic = actor.system.profession?.system?.magic ?? null;
    const allowed = (d) => {
      if (!magic || magic.access === "none") return false;
      if (magic.schools?.length && !magic.schools.includes(d.system.school)) return false;
      if (magic.maxSchoolValue && d.system.sValue > magic.maxSchoolValue) return false;
      return true;
    };
    const bySchool = {};
    for (const packId of CONFIG.DODE.contentPacks.spells ?? []) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      for (const d of await pack.getDocuments()) {
        if (have.has(d.name)) continue;
        (bySchool[d.system.school] ||= []).push(d);
      }
    }
    let opts = "";
    for (const [school, list] of Object.entries(bySchool)) {
      const label = game.i18n.localize(CONFIG.DODE.magicSchools[school] ?? school);
      opts += `<optgroup label="${label}">` + list
        .sort((a, b) => a.system.sValue - b.system.sValue)
        .map((d) => {
          const ok = allowed(d);
          return `<option value="${d.uuid}">${ok ? "" : "⚠ "}${d.name} (S${d.system.sValue})`
            + `${ok ? "" : " — utanför yrkets behörighet"}</option>`;
        })
        .join("") + "</optgroup>";
    }
    if (!opts) return void ui.notifications.info("Rollpersonen kan redan alla besvärjelser i kompendiet.");

    const result = await foundry.applications.api.DialogV2.input({
      window: { title: `Dela ut besvärjelse till ${actor.name}` },
      content: `
        <p class="hint">Fungerar även för icke-magiker — en välsignelse från SL är
        mekaniskt samma dokument som en besvärjelse.</p>
        <p class="hint">${magic && magic.access !== "none"
          ? `<strong>${actor.system.profession?.name ?? "Yrket"}</strong>: `
            + (magic.access === "full" ? "full magibehörighet."
              : `${(magic.schools ?? []).map((x) => game.i18n.localize(CONFIG.DODE.magicSchools[x] ?? x)).join(", ") || "alla skolor"}`
                + (magic.maxSchoolValue ? `, skolvärde ≤ ${magic.maxSchoolValue}` : "")
                + (magic.allowGeneralSpells ? "" : ", inga allmänna besvärjelser")
                + (magic.canLearnAtCreation ? "" : ", får inte lära vid skapandet — bara genom träning"))
          : `<strong>${actor.system.profession?.name ?? "Yrket"}</strong> har ingen magibehörighet — allt nedan är utanför normala regler. Det är tillåtet som SL-välsignelse, men värt att vara medveten om.`}</p>
        <div class="form-group"><label>Besvärjelse</label><select name="uuid">${opts}</select></div>
        <div class="form-group"><label>Anledning</label>
          <input type="text" name="reason" placeholder="t.ex. Välsignelse från Vinterns tempel" /></div>`
    });
    if (!result?.uuid) return;
    const doc = await fromUuid(result.uuid);
    if (!doc) return;
    const obj = doc.toObject();
    delete obj._id;
    const reason = (result.reason ?? "").trim();
    obj.flags = { ...(obj.flags ?? {}),
      [game.system.id]: { grantedBy: game.user.name, grantedReason: reason } };
    await actor.createEmbeddedDocuments("Item", [obj]);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="dode-chat-card"><h3>Ny besvärjelse</h3>`
        + `<p><strong>${actor.name}</strong> lärde sig <strong>${doc.name}</strong> `
        + `(${game.i18n.localize(CONFIG.DODE.magicSchools[doc.system.school] ?? doc.system.school)}, S${doc.system.sValue}).</p>`
        + (reason ? `<p class="dode-chat-note">${reason}</p>` : "") + `</div>`
    });
  }

  static async #onDeleteSkill(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) await item.delete();
  }

  static async #onEditItem(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) item.sheet.render(true);
  }

  static async #onDeleteItem(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) await item.delete();
  }

  static async #onToggleEquipped(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) await item.update({ "system.equipped": !item.system.equipped });
  }

  /**
   * `specialAbilities` är ett vanligt ArrayField på rollpersonens egen data,
   * inte embeddade Items (till skillnad från färdigheter/utrustning) — lägg
   * till/ta bort skriver om hela arrayen via `actor.update`, inte
   * `createEmbeddedDocuments`/`deleteEmbeddedDocuments`.
   */
  static async #onAddAbility() {
    const current = this.actor.system.specialAbilities.map((a) => ({ ...a }));
    current.push({ name: "", source: "", description: "" });
    await this.actor.update({ "system.specialAbilities": current });
  }

  /**
   * Mid-adventure-motsvarigheten till wizardens #onRollFormaga — samma tabell
   * (CONFIG.DODE.specialAbilitiesTable, RP s.25-27), samma 2T20+BP-formel, men
   * lägger till en HELT NY rad direkt istället för att fylla i en befintlig
   * tom slot (den här sheeten har inga fasta "slots" kopplade till nivå som
   * wizardens formagor-steg har). Fritextfälten förblir redigerbara efteråt.
   */
  static async #onRollAbility() {
    const result = await foundry.applications.api.DialogV2.input({
      window: { title: game.i18n.localize("DODE.Ability.Roll") },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("DODE.Ability.BpSpent")}</label>
          <input type="number" name="bpSpent" min="1" max="40" value="1" />
        </div>
      `
    });
    if (!result) return;

    const bpSpent = Math.max(1, Math.min(40, Number(result.bpSpent) || 1));
    const roll = await new Roll(`2d20+${bpSpent}`).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: game.i18n.localize("DODE.Ability.Roll")
    });
    const entry = CONFIG.DODE.rollSpecialAbility(roll.total);

    const current = this.actor.system.specialAbilities.map((a) => ({ ...a }));
    current.push({
      name: entry?.name || `Förmåga (${roll.total})`,
      source: "bas", // se schemakommentaren i actor-character.mjs — "bas" = grundboken (RP s.25-27)
      description: entry?.description ?? ""
    });
    await this.actor.update({ "system.specialAbilities": current });
  }

  static async #onDeleteAbility(event, target) {
    const index = Number(target.closest("[data-index]")?.dataset.index);
    if (Number.isNaN(index)) return;
    const current = this.actor.system.specialAbilities.map((a) => ({ ...a }));
    current.splice(index, 1);
    await this.actor.update({ "system.specialAbilities": current });
  }

  /**
   * SL låser upp/låser rollpersonen för guide-redigering. Engångsnyckel:
   * guiden nollställer flaggan när den sparar (#applyToActor), så varje
   * upplåsning motsvarar en överenskommen ändring.
   */
  static async #onToggleWizardUnlock() {
    if (!game.user.isGM) return;
    const current = !!this.actor.getFlag(game.system.id, "wizardUnlocked");
    await this.actor.setFlag(game.system.id, "wizardUnlocked", !current);
    ui.notifications.info(
      current
        ? `${this.actor.name} är låst för guide-redigering igen.`
        : `${this.actor.name} är upplåst — spelaren kan nu öppna guiden.`
    );
  }

  static #onOpenWizardEdit() {
    const unlocked = !!this.actor.getFlag(game.system.id, "wizardUnlocked");
    if (!game.user.isGM && !unlocked) {
      ui.notifications.warn("Rollpersonen är inte upplåst för redigering — be SL låsa upp den.");
      return;
    }
    game.dode.openCharacterWizard(this.actor);
  }

  static async #onClearRas() {
    const existing = this.actor.items.filter((i) => i.type === "ras");
    if (existing.length) await this.actor.deleteEmbeddedDocuments("Item", existing.map((i) => i.id));
  }

  static async #onClearYrke() {
    const existing = this.actor.items.filter((i) => i.type === "yrke");
    if (existing.length) await this.actor.deleteEmbeddedDocuments("Item", existing.map((i) => i.id));
  }

  static async #onRollDamage(event, target) {
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    if (item) await this.actor.rollWeaponDamage(item);
  }

  static async #onCastSpell(event, target) {
    const row = target.closest("[data-item-id]");
    const item = DoDECharacterSheet.#itemFromEvent(this.actor, target);
    const effektgrad = Number(row?.querySelector("[data-effektgrad]")?.value) || 1;
    if (item) await this.actor.castSpell(item, effektgrad);
  }

  /** @override */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Item") return super._onDrop?.(event);

    const item = await Item.implementation.fromDropData(data);
    if (!item) return;

    // Ras/yrke: högst en åt gången — byt ut befintlig vid nytt släpp.
    if (item.type === "ras" || item.type === "yrke") {
      const existing = this.actor.items.filter((i) => i.type === item.type);
      if (existing.length) await this.actor.deleteEmbeddedDocuments("Item", existing.map((i) => i.id));
      await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
      return;
    }

    if (GEAR_TYPES.includes(item.type) || item.type === "fardighet" || item.type === "formaga") {
      await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
    }
  }
}
