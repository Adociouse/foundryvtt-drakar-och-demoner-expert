/**
 * Plundring — live-fynd 2026-08-21 (Johan, efter krogslagsmålet): NPC-arkets
 * befintliga drag-och-släpp-loot (actor-npc-sheet.mjs#_onDrop) KOPIERAR bara
 * ett item till mottagaren, utan att ta bort det från liket — inget hindrar
 * att flera spelare (eller samma spelare flera gånger) drar samma vapen om
 * och om igen. Draget är dessutom bara möjligt för den som redan har
 * skrivbehörighet på liket (oftast bara SL), så en vanlig spelare kunde inte
 * ens plundra själv.
 *
 * Samma "spelaren begär, SL godkänner, ATOMISK skrivning"-princip som redan
 * bevisad för anfall (attack.mjs) och besvärjelser (spell.mjs) i det här
 * passet — se dode.mjs's renderChatMessageHTML-hook för godkännande-delen.
 * Skillnaden mot de två andra: inget att BERÄKNA här (inget slag), bara en
 * atomisk radera-från-liket-OCH-skapa-hos-looter-operation som MÅSTE ske i
 * ETT steg för att inte kunna dubbelplundras.
 */

/**
 * @param {Actor} corpse Liket/NPC:n som äger föremålet.
 * @param {string} itemId
 * @param {Actor} looter Rollpersonen som vill plundra.
 * @returns {Promise<void>}
 */
export async function requestLoot(corpse, itemId, looter) {
  const item = corpse.items.get(itemId);
  if (!item) { ui.notifications.warn("Föremålet finns inte längre på liket."); return; }
  if (!looter) { ui.notifications.warn("Ingen rollperson vald att plundra åt — tilldela dig en karaktär först."); return; }

  const canApplyDirectly = game.user.isGM || corpse.isOwner;
  if (canApplyDirectly) {
    await applyLoot({ corpseUuid: corpse.uuid, itemId, looterUuid: looter.uuid });
    return;
  }

  ui.notifications.info(`Begär att plundra ${item.name} — väntar på SL-godkännande.`);
  if (!game.users.some((u) => u.isGM && u.active)) {
    ui.notifications.warn("Ingen SL är online just nu — plundringen väntar tills en SL loggar in och godkänner.");
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: looter }),
    content: `<div class="dode-chat-card dode-loot-card">
      <p><i class="fa-solid fa-sack-dollar"></i> <strong>${looter.name}</strong> vill plundra <strong>${item.name}</strong> från <strong>${corpse.name}</strong>.</p>
      <div class="pending-banner"><i class="fa-solid fa-hourglass-half"></i> Väntar på SL-godkännande</div>
      <div class="pending-actions">
        <button type="button" data-action="approveLootRequest"><i class="fa-solid fa-check"></i> Godkänn</button>
        <button type="button" data-action="rejectLootRequest"><i class="fa-solid fa-xmark"></i> Avvisa</button>
      </div>
    </div>`,
    flags: {
      [game.system.id]: {
        pendingLoot: { corpseUuid: corpse.uuid, itemId, looterUuid: looter.uuid, itemName: item.name, processed: false }
      }
    }
  });
}

/**
 * Utför själva överföringen ATOMISKT — anropas antingen direkt (SL/ägare)
 * eller från godkännande-hooken (dode.mjs). Ingen behörighetskontroll här;
 * anroparen ansvarar för det (samma kontrakt som applyAttackResult/
 * applySpellResult).
 */
export async function applyLoot({ corpseUuid, itemId, looterUuid }) {
  const corpse = fromUuidSync(corpseUuid);
  const looter = fromUuidSync(looterUuid);
  const item = corpse?.items.get(itemId);
  if (!corpse || !looter || !item) {
    ui.notifications.error("Liket, rollpersonen eller föremålet finns inte längre — kan inte plundra.");
    return;
  }
  await looter.createEmbeddedDocuments("Item", [item.toObject()]);
  await item.delete();
  await ChatMessage.create({
    content: `<div class="dode-chat-card"><p>🎒 <strong>${looter.name}</strong> plundrade <strong>${item.name}</strong> från ${corpse.name}.</p></div>`
  });

  // Motsvarigheten till "dead" → Observer-hooken i dode.mjs: när det sista
  // lootbara föremålet är taget tappar liket sin Observer-behörighet igen,
  // så det slutar synas i alla spelares Actors-sidopanel. `handlare`-butiker
  // rörs aldrig här (dit kommer man aldrig via applyLoot). Ingen isGM-koll
  // behövs — anroparen (godkännande-hooken eller direktvägen) har redan
  // skrivbehörighet på `corpse` för att ha kommit hit över huvud taget.
  if (corpse.type === "npc") {
    const stillLootable = corpse.items.some((i) => ["vapen", "rustning", "utrustning"].includes(i.type));
    if (!stillLootable && (corpse.ownership?.default ?? 0) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER) {
      await corpse.update({ "ownership.default": CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE });
    }
  }
}
