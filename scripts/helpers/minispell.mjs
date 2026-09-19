const { DialogV2 } = foundry.applications.api;

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/** Frågar efter valfri berättartext. Returnerar `null` vid avbryt, annars strängen (kan vara tom). */
export async function promptMinispellStory() {
  const result = await DialogV2.input({
    window: { title: game.i18n.localize("DODE.Dialog.MinispellStoryTitle") },
    content: `<div class="form-group stacked"><label>${game.i18n.localize("DODE.Dialog.MinispellStoryLabel")}</label>
      <textarea name="story" rows="4" autofocus></textarea>
      <p class="hint">${game.i18n.localize("DODE.Dialog.MinispellStoryHint")}</p></div>`,
    ok: { label: game.i18n.localize("DODE.Dialog.MinispellStoryConfirm") },
    rejectClose: false
  });
  return result ? (result.story ?? "").trim() : null;
}

/**
 * Använder en minibesvärjelse (MAG s.23): ingen CL-kontroll, lyckas alltid,
 * fast PSY-kostnad, alltid Kvick. Delas av karaktärs- och NPC-arket.
 *
 * @param {Actor} actor
 * @param {Item|object} item  minibesvarjelse-Item (ägt eller ur kompendiet)
 * @param {object} [o]
 * @param {number|null} [o.fv]  FV i skolan — styr bara åthävo-raden, inte utfallet
 * @param {string} [o.story]    valfri berättartext som visas i chattkortet
 * @returns {Promise<boolean>} true om den användes
 */
export async function castMinispell(actor, item, { fv = null, story = "" } = {}) {
  if (!actor || !item) return false;
  if (!actor.isOwner) {
    ui.notifications.warn(game.i18n.localize("DODE.Notify.Magic.MinispellNotOwner", { actor: actor.name }));
    return false;
  }

  const cost = item.system.psyCost ?? 1;
  const psy = actor.system.resources?.psy;
  const have = psy?.value ?? psy?.max ?? 0;
  if (have < cost) {
    ui.notifications.warn(game.i18n.localize("DODE.Notify.Magic.MinispellNoPsy", { actor: actor.name, spell: item.name, cost, have }));
    return false;
  }
  const left = have - cost;
  await actor.update({ "system.resources.psy.value": left });

  const schoolLabel = item.system.school === "allman"
    ? "Allmän minimagi"
    : game.i18n.localize(CONFIG.DODE.magicSchools[item.system.school] ?? item.system.school);
  const targets = [...game.user.targets].map((t) => t.name).filter(Boolean);
  const gestures = fv === null ? "" : fv >= 25 ? "Omedvetet — kräver ingen uppmärksamhet"
    : fv >= 15 ? "Inga yttre åthävor" : "Kräver gester och ord";

  const content = `<div class="dode-chat-card dode-minispell-card">
    <h3>${game.i18n.localize("DODE.Chat.MinispellHeading", { actor: esc(actor.name), spell: esc(item.name) })}</h3>
    <p class="minispell-meta"><em>${game.i18n.localize("DODE.Chat.MinispellMeta", { school: esc(schoolLabel) })}${gestures ? ` · ${esc(gestures)}` : ""}</em></p>
    ${story ? `<blockquote class="minispell-story">${esc(story).replace(/\n/g, "<br>")}</blockquote>` : ""}
    <div class="minispell-desc">${item.system.description ?? ""}</div>
    ${targets.length ? `<p>${game.i18n.localize("DODE.Chat.MinispellTargets", { targets: esc(targets.join(", ")) })}</p>` : ""}
    <p class="minispell-cost">${game.i18n.localize("DODE.Chat.MinispellCost", { cost, left })}</p>
  </div>`;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
  return true;
}

/** Slår upp en minibesvärjelse ur ett `data-item-id` (ägd) eller `data-uuid` (härledd, ur kompendiet). */
export async function resolveMinispell(actor, target) {
  const row = target.closest("[data-item-id],[data-uuid]");
  if (!row) return null;
  if (row.dataset.itemId) return actor.items.get(row.dataset.itemId);
  return fromUuid(row.dataset.uuid);
}
