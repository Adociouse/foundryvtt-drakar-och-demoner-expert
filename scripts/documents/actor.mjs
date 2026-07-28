import { rollFV } from "../rolls/fv-roll.mjs";
import { rollDamage, combineDamageFormula } from "../rolls/damage-roll.mjs";

export default class DoDEActor extends Actor {
  /** @param {Item} item En "fardighet"-item ägd av denna actor. */
  async rollSkill(item) {
    if (!item) return;
    return rollFV({ actor: this, label: item.name, fv: item.system.total });
  }

  /** @param {number} index Index i NPC:ns system.attacks-array. */
  async rollAttack(index) {
    const attack = this.system.attacks?.[index];
    if (!attack) return;
    return rollFV({ actor: this, label: attack.name || "Anfall", fv: attack.fv });
  }

  /** @param {number} index Index i NPC:ns system.attacks-array. */
  async rollAttackDamage(index) {
    const attack = this.system.attacks?.[index];
    if (!attack?.damage) return;
    return rollDamage({ actor: this, label: `${attack.name || "Anfall"} (skada)`, formula: attack.damage });
  }

  /**
   * @param {Item} item En "vapen"-item ägd av denna actor. Skadebonus läggs alltid
   * på för rollpersoner (REGLER_STRID.md) — undantaget lönnmördarens bakhugg är
   * inte specialhanterat än.
   */
  async rollWeaponDamage(item) {
    if (!item) return;
    const formula = combineDamageFormula(item.system.damage, this.system.damageBonus ?? "");
    return rollDamage({ actor: this, label: `${item.name} (skada)`, formula });
  }

  /**
   * Kastar en besvärjelse — MAGI.md: CL = S - 2*(E-1), PSY-kostnad = E vid lyckat
   * slag, halva E (avrundat till magikerns fördel, min 1) vid perfekt, full E vid
   * fummel (+ snedtändningstabell, ej automatiserad). Inget PSY-avdrag vid vanligt
   * misslyckat slag.
   *
   * Förenkling: `item.system.sValue` (besvärjelsens tabellerade skolvärde) används
   * som skicklighetsvärde (S) i CL-formeln. Egentligen är S kastarens PERSONLIGA
   * skicklighet i just den besvärjelsen (kan skilja sig från skolvärdet och höjas
   * separat via erfarenhet — se MAGI.md "Skolvärde och Skicklighetsvärde"), men
   * ingen sådan per-besvärjelse-träning är modellerad ännu. Flaggat, inte löst.
   */
  async castSpell(item, effektgrad = 1) {
    if (!item) return;
    const E = Math.max(1, Math.floor(effektgrad) || 1);
    const cl = item.system.sValue - 2 * (E - 1);
    const { outcome } = await rollFV({ actor: this, label: `${item.name} (E${E})`, fv: cl });

    let psyCost = 0;
    if (outcome === "perfekt") psyCost = Math.max(1, Math.floor(E / 2));
    else if (outcome === "lyckat" || outcome === "fummel") psyCost = E;

    if (psyCost > 0) {
      const current = this.system.resources?.psy?.value ?? this.system.resources?.psy?.max ?? 0;
      await this.update({ "system.resources.psy.value": Math.max(0, current - psyCost) });
    }

    if (psyCost > 0 || outcome === "fummel") {
      const note = outcome === "fummel"
        ? `${psyCost} PSY förbrukat. Fummel — slå på Snedtändningstabellen (MAGI.md, ej automatiserad).`
        : `${psyCost} PSY förbrukat.`;
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this }), content: `<p>${note}</p>` });
    }
  }

  /**
   * Lägger en besvärjelses temporära ActiveEffect på ett mål. Skapar en embeddad
   * ActiveEffect med duration.rounds = besvärjelsens spellDuration och flaggorna
   * flags.<system.id>.source:"spell" + flags.<system.id>.spellName. Changes riktas alltid mot
   * `.bonus`-fält via mode ADD — schemat (item-besvarjelse.mjs `spellEffect`)
   * garanterar detta.
   *
   * STUB: Detta är kopplingspunkten mot en framtida "vid träff"-kedja. Metoden är
   * fullt körbar (kan anropas manuellt eller från en makro), men wire:as medvetet
   * INTE in i castSpell() automatiskt än — måltilldelning/träfflogik är fas 6+.
   *
   * @param {Item} item En "besvarjelse"-item med spellEffect/spellDuration.
   * @param {Actor} [target=this] Aktören effekten läggs på (default: kastaren själv).
   */
  async applySpellEffect(item, target = this) {
    if (!item || item.type !== "besvarjelse") return;
    const changes = (item.system.spellEffect ?? [])
      .filter((c) => c.key && c.value !== "")
      .map((c) => ({
        key: c.key,
        mode: c.mode ?? CONST.ACTIVE_EFFECT_MODES.ADD,
        value: String(c.value)
      }));
    if (!changes.length) return;

    const rounds = item.system.spellDuration ?? 0;
    return target.createEmbeddedDocuments("ActiveEffect", [{
      name: item.name,
      img: item.img,
      changes,
      duration: rounds > 0 ? { rounds } : {},
      origin: item.uuid,
      transfer: false,
      disabled: false,
      [`flags.${game.system.id}.source`]: "spell",
      [`flags.${game.system.id}.spellName`]: item.name
    }]);
  }

  /**
   * Köp en vara från en handlare. Anropas från handlararket.
   *
   * Ägarskapsmodellen är hela poängen med hur det här är skrivet: metoden körs
   * på KÖPARENS aktör, aldrig på handlarens. En spelare äger sin rollperson och
   * får därför skriva till den, men äger normalt inte handlaren — och med
   * `"socket": false` i system.json finns inget relä via SL:s klient. Därför
   * rör ett köp aldrig handlardokumentet; lagret är en katalog (se
   * actor-handlare.mjs för varför det är ett medvetet val).
   *
   * @param {Item} stockItem  Varan hos handlaren (embeddad på handlaraktören).
   * @param {Actor} merchant  Handlaren — används för påslag och chattkortet.
   * @param {number} quantity Antal att köpa.
   * @returns {Promise<boolean>} true om köpet gick igenom.
   */
  async buyFromMerchant(stockItem, merchant, quantity = 1) {
    if (this.type !== "character") {
      ui.notifications.warn("Bara rollpersoner kan handla.");
      return false;
    }
    const qty = Math.max(1, Math.round(quantity));
    const unitSm = DoDEActor.merchantPriceSm(stockItem, merchant);
    if (unitSm === null) {
      ui.notifications.warn(`${stockItem.name} har inget styckpris — priset måste hanteras vid bordet.`);
      return false;
    }
    // All aritmetik i kopparmynt som heltal, aldrig i silver som flyttal.
    const costKm = CONFIG.DODE.silverToKm(unitSm) * qty;
    const purseKm = CONFIG.DODE.purseToKm(this.system.currency);
    if (costKm > purseKm) {
      const short = CONFIG.DODE.formatPurse(CONFIG.DODE.kmToPurse(costKm - purseKm));
      ui.notifications.warn(`${this.name} har inte råd med ${stockItem.name} — saknar ${short}.`);
      return false;
    }

    const newPurse = CONFIG.DODE.kmToPurse(purseKm - costKm);
    // Kopian nollställs medvetet på `equipped` — man går inte ut ur butiken
    // med rustningen redan på sig.
    const bought = stockItem.toObject();
    delete bought._id;
    if (bought.system && "equipped" in bought.system) bought.system.equipped = false;
    if (bought.system && "quantity" in bought.system) bought.system.quantity = qty;

    await this.update({ "system.currency": newPurse });
    await this.createEmbeddedDocuments("Item", [bought]);

    const priceLabel = CONFIG.DODE.formatPurse(CONFIG.DODE.kmToPurse(costKm));
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="dode-chat-card"><h3>Köp hos ${merchant?.name ?? "handlaren"}</h3>`
        + `<p><strong>${this.name}</strong> köpte ${qty}× <strong>${stockItem.name}</strong> för ${priceLabel}.</p>`
        + `<p class="dode-chat-note">Kvar i börsen: ${CONFIG.DODE.formatPurse(newPurse)}</p></div>`
    });
    return true;
  }

  /**
   * Styckpris i silver hos en given handlare, påslag inräknat.
   * @returns {number|null} null när varan saknar styckpris (fritext-pris som
   *   "4 per kagge" eller "5 sm/g") — sådant går inte att automatisera.
   */
  static merchantPriceSm(item, merchant) {
    const sys = item.system ?? {};
    if (sys.priceNote) return null;
    const base = item.type === "utrustning" ? (sys.priceSm ?? 0) : (sys.price ?? 0);
    if (!base) return null;
    const markup = merchant?.system?.markup ?? 0;
    return Math.round(base * (1 + markup / 100) * 100) / 100;
  }
}
