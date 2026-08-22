/**
 * Sälj tillbaka till handlare — live-fynd 2026-08-21/22 (Johan, efter
 * plundringspasset): `actor-handlare.mjs`s `buybackRate`-fält fanns redan
 * (SL:s referenssiffra för återköp, se den filens docblock) men var
 * uttryckligen INTE automatiserat ("Återköp är inte automatiserat än" —
 * backlog 27) — bara ett tal SL skulle komma ihåg vid bordet. Den här filen
 * bygger den faktiska transaktionen.
 *
 * ⚠ Skiljer sig MEDVETET från plundring/anfall/besvärjelsers ägarskapsgrind
 * ("SL godkänner bara om spelaren INTE äger målet"): en spelare äger ALLTID
 * sin egen rollperson, så den vanliga gaten hade gjort försäljning alltid
 * direktapplicerad — ingen SL-koll alls. Johan bad uttryckligen om
 * godkännande "as well" för försäljning specifikt, för SL:s ekonomiska
 * översikt (vad flödar in/ut ur världens ekonomi), inte för en behörighets-
 * lucka. Gaten här är alltså `game.user.isGM`, inte `seller.isOwner`.
 */

/**
 * @param {Actor} seller Rollpersonen som säljer (alltid `type:"character"`).
 * @param {string} itemId
 * @param {Actor} merchant `type:"handlare"` — bara för `buybackRate`, rörs aldrig.
 */
export async function requestSell(seller, itemId, merchant) {
  const item = seller.items.get(itemId);
  if (!item) { ui.notifications.warn("Föremålet finns inte längre."); return; }
  if (!merchant || merchant.type !== "handlare") {
    ui.notifications.warn("Ingen handlare målsatt — hovra en handlartoken och tryck T innan du säljer.");
    return;
  }

  const priceSm = merchantBasePriceSm(item);
  if (priceSm === null) {
    ui.notifications.warn(`${item.name} har inget automatiserbart pris — SL får avgöra försäljningen manuellt.`);
    return;
  }
  const sellPriceSm = Math.round(priceSm * (merchant.system.buybackRate ?? 50) / 100 * 100) / 100;

  if (game.user.isGM) {
    await applySell({ sellerUuid: seller.uuid, itemId, merchantUuid: merchant.uuid, sellPriceSm });
    return;
  }

  ui.notifications.info(`Begär att sälja ${item.name} för ~${sellPriceSm} sm — väntar på SL-godkännande.`);
  if (!game.users.some((u) => u.isGM && u.active)) {
    ui.notifications.warn("Ingen SL är online just nu — försäljningen väntar tills en SL loggar in och godkänner.");
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: seller }),
    content: `<div class="dode-chat-card dode-loot-card">
      <p><i class="fa-solid fa-coins"></i> <strong>${seller.name}</strong> vill sälja <strong>${item.name}</strong> till <strong>${merchant.name}</strong> för ~<strong>${sellPriceSm} sm</strong> (${merchant.system.buybackRate ?? 50}% återköp).</p>
      <div class="pending-banner"><i class="fa-solid fa-hourglass-half"></i> Väntar på SL-godkännande</div>
      <div class="pending-actions">
        <button type="button" data-action="approveSellRequest"><i class="fa-solid fa-check"></i> Godkänn</button>
        <button type="button" data-action="rejectSellRequest"><i class="fa-solid fa-xmark"></i> Avvisa</button>
      </div>
    </div>`,
    flags: {
      [game.system.id]: {
        pendingSell: { sellerUuid: seller.uuid, itemId, merchantUuid: merchant.uuid, sellPriceSm, itemName: item.name, processed: false }
      }
    }
  });
}

/** Atomisk skrivning — anropas direkt (SL) eller från godkännande-hooken. */
export async function applySell({ sellerUuid, itemId, merchantUuid, sellPriceSm }) {
  const seller = fromUuidSync(sellerUuid);
  const merchant = fromUuidSync(merchantUuid);
  const item = seller?.items.get(itemId);
  if (!seller || !merchant || !item) {
    ui.notifications.error("Säljaren, handlaren eller föremålet finns inte längre — kan inte genomföra försäljningen.");
    return;
  }

  const currentKm = CONFIG.DODE.purseToKm(seller.system.currency);
  const newPurse = CONFIG.DODE.kmToPurse(currentKm + CONFIG.DODE.silverToKm(sellPriceSm));
  await seller.update({
    "system.currency.gm": newPurse.gm ?? 0,
    "system.currency.sm": newPurse.sm ?? 0,
    "system.currency.km": newPurse.km ?? 0
  });
  await item.delete();

  await ChatMessage.create({
    content: `<div class="dode-chat-card"><p>🪙 <strong>${seller.name}</strong> sålde <strong>${item.name}</strong> till ${merchant.name} för <strong>${sellPriceSm} sm</strong>.</p></div>`
  });
}

/** Fristående kopia av handlare-sheet.mjs's motsvarande funktion (samma cirkulär-import-skäl). */
function merchantBasePriceSm(item) {
  const sys = item.system ?? {};
  if (sys.priceNote) return null;
  const base = item.type === "utrustning" ? (sys.priceSm ?? 0) : (sys.price ?? 0);
  return base || null;
}
