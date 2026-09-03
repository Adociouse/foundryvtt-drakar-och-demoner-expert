import { rollFV } from "../rolls/fv-roll.mjs";
import { rollDamage, combineDamageFormula } from "../rolls/damage-roll.mjs";

/**
 * Delad ActiveEffect-payload för besvärjelser (applySpellEffect) och
 * konsumerbar utrustning (consumeItem) — samma `{key,mode,value}`-changeform,
 * samma flagg-/origin-konvention, tidigare byggd två gånger nästan identiskt
 * (upptäckt vid research inför magisystem-designen 2026-08-21, se
 * docs/dev/MAGI_STRID_ANVANDNINGSFALL.md punkt 5). Ren dedup, ingen
 * beteendeändring — utom att `spellName`/`itemName` slås ihop till en enda
 * `sourceName`-flagga (ingen tidigare kod läste de gamla nycklarna, se grep
 * inför den här ändringen).
 * @param {Item} item Källan — "besvarjelse" eller "utrustning".
 * @param {Array<{key:string, mode?:number, value:string}>} changes Redan filtrerade changes.
 * @param {{sourceKind:string, duration?:object}} opts `sourceKind` blir flags.<system.id>.source.
 */
function buildTemporaryEffectData(item, changes, { sourceKind, duration = {} }) {
  return {
    name: item.name,
    img: item.img,
    changes: changes.map((c) => ({ key: c.key, mode: c.mode ?? CONST.ACTIVE_EFFECT_MODES.ADD, value: String(c.value) })),
    duration,
    origin: item.uuid,
    transfer: false,
    disabled: false,
    [`flags.${game.system.id}.source`]: sourceKind,
    [`flags.${game.system.id}.sourceName`]: item.name
  };
}

export default class DoDEActor extends Actor {
  /** @param {Item} item En "fardighet"-item ägd av denna actor. */
  async rollSkill(item) {
    if (!item) return;
    // `item` följer med så slagkortet kan erbjuda SL ett EP-streck vid lyckat
    // slag — REG s.45, se helpers/ep.mjs.
    // Färdighetsmodifierare (backlogpost 7/36) läggs på HÄR, inte i
    // item.system.total — de är en separat, live-summerad lager från
    // formaga-/utrustningsitem, se actor-character.mjs#prepareDerivedData.
    // Vapengrupper (RP s.60) är samma slags separat lager, se
    // actor-character.mjs#computeWeaponGroupBonus.
    const modifier = this.system.skillModifierTotals?.[item.system.skillKey] ?? 0;
    const weaponGroupBonus = this.system.weaponGroupBonusTotals?.[item.system.skillKey] ?? 0;
    return rollFV({ actor: this, label: item.name, fv: item.system.total + modifier + weaponGroupBonus, item });
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
   * fummel (+ en riktig dragning på Snedtändningstabellen, se
   * CONFIG.DODE.rollSnedtandningstabell — Magisystem-planen Fas 4, 2026-08-21).
   * Inget PSY-avdrag vid vanligt misslyckat slag.
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
      let note = `${psyCost} PSY förbrukat.`;
      const rolls = [];
      if (outcome === "fummel") {
        const draw = await CONFIG.DODE.rollSnedtandningstabell(E);
        if (draw) {
          note = `${psyCost} PSY förbrukat. Fummel — Snedtändningstabellen: <strong>${draw.result.name}</strong>. ${draw.result.description}`
            + (draw.fobi ? ` Fobi: <strong>${draw.fobi.result.name}</strong>. ${draw.fobi.result.description}` : "");
          rolls.push(draw.roll);
          if (draw.fobi) rolls.push(draw.fobi.roll);
        } else {
          note = `${psyCost} PSY förbrukat. Fummel — slå på Snedtändningstabellen (tabellen kunde inte hittas i kompendiet).`;
        }
      }
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<p>${note}</p>`,
        rolls, sound: rolls.length ? CONFIG.sounds.dice : null
      });
    }
  }

  /**
   * Lägger en besvärjelses temporära ActiveEffect på ett mål. Skapar en embeddad
   * ActiveEffect med duration.rounds = besvärjelsens spellDuration och flaggorna
   * flags.<system.id>.source:"spell" + flags.<system.id>.spellName. Changes riktas
   * normalt mot `.bonus`-fält (samma mönster som ras-/ålders-AE:erna redan
   * använder, se actor-character.mjs#prepareDerivedData) via mode ADD, men
   * fältet/moden är fritt — schemat tvingar inget.
   *
   * ⚠ **Är nu KOPPLAD in i den riktiga kast-vägen** (spell-dialog.mjs →
   * resolveSpellCast/applySpellResult, se spell.mjs) — karaktärsarkets "Kasta"-
   * knapp har använt den vägen sedan Fas 3 (2026-08-21), INTE den enkla
   * `castSpell()` nedan. Den gamla kommentaren här ("wire:as inte in i
   * castSpell() automatiskt") var föråldrad och gällde bara den ANDRA,
   * numera sekundära kastvägen — rättad 2026-09-03 (backlog 90).
   *
   * ⚠ **`effektgrad`-tillägg, 2026-09-03 (backlog 90):** metoden tog tidigare
   * INGEN effektgrad alls — ett `spellEffect`-värde kunde bara vara ett statiskt
   * tal, aldrig en formel som skalar med kastet (t.ex. Kraftrops "+Ex5 STY").
   * Foundrys ActiveEffect-changes stöder ingen `@E`-substitution vid
   * TILLÄMPNINGSTILLFÄLLET (till skillnad från vår egen Roll-baserade
   * instantEffect-hantering) — lösningen är samma som där: lösa upp formeln
   * EN gång, HÄR, vid kastningstillfället, och spara det FÄRDIGA talet i
   * AE:n. Samma `@E`/`@{E}`-konvention som instantEffect.formula redan
   * använder (se item-besvarjelse.mjs).
   *
   * @param {Item} item En "besvarjelse"-item med spellEffect/spellDuration.
   * @param {Actor} [target=this] Aktören effekten läggs på (default: kastaren själv).
   * @param {number} [effektgrad=1] Kastets effektgrad — löser upp `@E`-formler i spellEffect.value.
   */
  async applySpellEffect(item, target = this, effektgrad = 1) {
    if (!item || item.type !== "besvarjelse") return;
    const E = Math.max(1, Math.floor(effektgrad) || 1);
    const changes = [];
    for (const c of item.system.spellEffect ?? []) {
      if (!c.key || c.value === "") continue;
      const roll = await new Roll(c.value, { E }).evaluate();
      changes.push({ key: c.key, mode: c.mode ?? CONST.ACTIVE_EFFECT_MODES.ADD, value: String(roll.total) });
    }
    if (!changes.length) return;

    const rounds = item.system.spellDuration ?? 0;
    return target.createEmbeddedDocuments("ActiveEffect", [
      buildTemporaryEffectData(item, changes, { sourceKind: "spell", duration: rounds > 0 ? { rounds } : {} })
    ]);
  }

  /**
   * Konsumerar ett engångsföremål (`system.consumable`, t.ex. en drickbar
   * drog) — backlogpost 7, testat med "Drakpotion". Samma mönster som
   * applySpellEffect ovan: en tillfällig, aktörsägd ActiveEffect med
   * `duration.seconds`, som v14-kärnan redan självmant slutar tillämpa när
   * tiden går (DESIGN_DECISIONS.md §6, "v14-kärnan slutar tillämpa utgångna
   * ActiveEffects själv") — ingen egen nedräkningskod behövs.
   *
   * En `key` i `effectChanges` som innehåller platshållaren "$CHOICE" gör att
   * spelaren får välja grundegenskap i en dialog innan effekten skapas (RP:s
   * "valfri egenskap"-formulering, t.ex. Drakpotion +10 på valfri
   * grundegenskap). ⚠ Detta är en RIKTIG ActiveEffect (till skillnad från
   * skillModifiers, se item-fardighet.mjs) eftersom attribut ÄR aktörens egna
   * schemafält — AE-blockeringen som backlogpost 7 löser gäller bara
   * embeddade Items.
   *
   * @param {Item} item En "utrustning"-item med `system.consumable`.
   */
  async consumeItem(item) {
    if (!item || item.system.consumable !== true) return;
    let changes = (item.system.effectChanges ?? []).filter((c) => c.key);
    if (!changes.length) {
      ui.notifications.warn(`${item.name} har ingen konsumtionseffekt definierad.`);
      return;
    }

    if (changes.some((c) => c.key.includes("$CHOICE"))) {
      const options = Object.entries(CONFIG.DODE.attributes)
        .map(([key, label]) => `<option value="${key}">${game.i18n.localize(label)}</option>`)
        .join("");
      const result = await foundry.applications.api.DialogV2.input({
        window: { title: `Konsumera ${item.name}` },
        content: `
          <div class="form-group">
            <label>Grundegenskap</label>
            <select name="attribute">${options}</select>
          </div>`
      });
      if (!result) return; // avbrutet — föremålet förbrukas inte
      changes = changes.map((c) => ({ ...c, key: c.key.replaceAll("$CHOICE", result.attribute) }));
    }

    await this.createEmbeddedDocuments("ActiveEffect", [
      buildTemporaryEffectData(item, changes, {
        sourceKind: "consumable",
        duration: item.system.activationSeconds ? { seconds: item.system.activationSeconds } : {}
      })
    ]);

    const remaining = item.system.chargesRemaining;
    if (typeof remaining === "number") {
      if (remaining <= 1) await item.delete();
      else await item.update({ "system.chargesRemaining": remaining - 1 });
    }
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
