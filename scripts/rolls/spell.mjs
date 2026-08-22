import { classifiedRoll } from "./attack.mjs";

/**
 * Besvärjelsekastning MOT MÅL — MAGI.md, se docs/dev/MAGI_STRID_ANVANDNINGSFALL.md
 * för de sourcade användningsfallen bakom varje gren nedan.
 *
 * Mirror av `attack.mjs`s rena beräkning/skrivning-uppdelning (Spelar-anfall-
 * planen, 2026-08-21): `resolveSpellCast` skriver INGENTING (körbar på
 * VILKEN klient som helst, även utan behörighet på målen), `applySpellResult`
 * utför de faktiska skrivningarna och kräver att anroparen redan har
 * behörighet. Samma "spelaren slår sina egna tärningar, SL godkänner det
 * redan slagna resultatet"-princip som vapenanfall — se attack.mjs:s
 * modulkommentar för hela resonemanget, gäller oförändrat här.
 *
 * `DoDEActor#castSpell` (documents/actor.mjs) förblir den ENKLA, mål-lösa
 * varianten (SL-fiat/ren CL-kontroll utan effekt) — den här filen är ingången
 * för besvärjelser som faktiskt riktas mot ett eller flera mål.
 */

/**
 * @param {object} o
 * @param {Actor}  o.caster
 * @param {Item}   o.item     `besvarjelse`-item med de nya Fas 1/2-fälten.
 * @param {number} [o.effektgrad=1]
 * @param {Actor[]} [o.targets=[]] Tomt = besvärjelsen påverkar ingen (rent
 *   CL/PSY-kast, samma som castSpell() redan gör).
 */
export async function resolveSpellCast({ caster, item, effektgrad = 1, targets = [] }) {
  const E = Math.max(1, Math.floor(effektgrad) || 1);
  const cl = item.system.sValue - 2 * (E - 1);
  const cast = await classifiedRoll(cl);

  let psyCost = 0;
  if (cast.outcome === "perfekt") psyCost = Math.max(1, Math.floor(E / 2));
  else if (cast.outcome === "lyckat" || cast.outcome === "fummel") psyCost = E;

  const out = {
    item, caster, E, cl, cast, psyCost,
    perTarget: [],
    // ⚠ Skrivningar skjuts upp till `applySpellResult` — se modulkommentaren.
    // `targets` här är MINIMAL, JSON-säker data (inga Roll-instanser), samma
    // filosofi som attack.mjs:s `out.pending` — bara det APPLICERINGEN
    // faktiskt behöver, inte allt kortet visar.
    pending: { psy: psyCost > 0 ? { amount: psyCost } : null, targets: [] }
  };

  // Misslyckat/fummel: besvärjelsen har ingen effekt på omvärlden alls —
  // matchar castSpell()s redan etablerade beteende. Fummel drar en riktig
  // Snedtändningstabellen-post (Fas 4, 2026-08-21) — draget sker HÄR, i den
  // rena fasen, inte i applySpellResult: det är slumpmässigt och ska INTE
  // slås om vid ett SL-godkännande, samma princip som attack.mjs:s planerade
  // Fummeltabellen (Fas 6). Bara draget/visat, ingen mekanisk tillämpning —
  // se CONFIG.DODE.rollSnedtandningstabell:s egen kommentar.
  if (cast.outcome === "misslyckat" || cast.outcome === "fummel") {
    out.fumbled = cast.outcome === "fummel";
    if (out.fumbled) out.snedtandning = await CONFIG.DODE.rollSnedtandningstabell(E);
    return out;
  }

  const sys = item.system;
  // "split" (Eld m.fl. — se item-besvarjelse.mjs's targetMode-kommentar):
  // EN delad pool av E tärningar delas mellan `targets.length` sfärer/mål,
  // 1 tärning avstås per extra mål. N=1 ger exakt samma tärningsantal som
  // innan (E), bakåtkompatibelt. `resolveResistance`s "kan kastaren
  // övervinna målets motstånd"-jämförelse använder ändå HELA E (den frågan
  // gäller kastarens råa kraft, inte hur den delats upp mellan sfärer).
  const splitDiceE = sys.targetMode === "split" ? Math.max(1, E - targets.length + 1) : E;
  for (const target of targets) {
    const t = { actorId: target.id, name: target.name, resisted: null, fearDraw: null, instantEffect: null, statusApplied: null, spellEffectApplies: false };
    const pendingT = { actorId: target.id, instantEffect: null, status: null, spellEffect: false };

    let saveSucceeded = false;
    if (sys.resistedBy === "attribute-save" && sys.saveAttribute) {
      // Motståndstabellen (SL s.34/RP s.37-38) — se DODE.rollResistance.
      // `success` = MÅLET lyckades motstå: ingen effekt ska då slå igenom.
      const sg = CONFIG.DODE.difficultyGrades[sys.saveDifficulty] ?? CONFIG.DODE.difficultyGrades.normalt;
      const attrValue = target.system?.attributes?.[sys.saveAttribute]?.total ?? 0;
      t.resisted = await CONFIG.DODE.rollResistance(sg, attrValue);
      saveSucceeded = t.resisted.success;
    }

    if (!saveSucceeded) {
      if (sys.instantEffect?.kind && sys.instantEffect.kind !== "none" && sys.instantEffect.formula) {
        const roll = await new Roll(sys.instantEffect.formula, { E: splitDiceE }).evaluate();
        let resistance = { reduction: 0, immune: false, blocked: false };
        if (sys.instantEffect.kind === "damage" && sys.damageType !== "none") {
          resistance = CONFIG.DODE.resolveResistance(target, sys.damageType, E);
        }
        // ⚠ Homebrew-inställning (av som standard, se dode.mjs's
        // `perfectSpellMaxDamage`-registrering för hela resonemanget/källan).
        // Samma maximeringsteknik som attack.mjs redan använder för vapen:
        // riktiga tärningar slås/visas, men SUMMAN räknas som att varje
        // tärning visade sitt högsta värde. Bara `kind:"damage"` — en Perfekt
        // LÄKNING maximeras inte av den här inställningen.
        const maximise = cast.outcome === "perfekt"
          && sys.instantEffect.kind === "damage"
          && game.settings.get(game.system.id, "perfectSpellMaxDamage");
        const rollTotal = maximise
          ? roll.terms.filter((t) => t.faces).reduce((a, t) => a + t.number * t.faces, 0)
            + roll.terms.filter((t) => typeof t.number === "number" && !t.faces).reduce((a, t) => a + t.number, 0)
          : roll.total;
        const appliedAmount = resistance.blocked ? 0 : Math.max(0, rollTotal - resistance.reduction);

        const currentHp = target.system.hp?.value ?? target.system.hp?.max ?? 0;
        const maxHp = target.system.hp?.max ?? currentHp;
        const previewAfter = sys.instantEffect.kind === "heal"
          ? Math.min(maxHp, currentHp + appliedAmount)
          : currentHp - appliedAmount; // ⚠ Ej klampat vid 0 — samma konvention som tickPeriodicEffect (config.mjs).

        t.instantEffect = { kind: sys.instantEffect.kind, roll, resistance, appliedAmount, totalAfterPreview: previewAfter, maximised: maximise };
        pendingT.instantEffect = { kind: sys.instantEffect.kind, amount: appliedAmount };
      }
      if (sys.statusEffect) {
        t.statusApplied = sys.statusEffect;
        pendingT.status = sys.statusEffect;
      }
      if (sys.spellEffect?.length) {
        t.spellEffectApplies = true;
        pendingT.spellEffect = true;
      }
      if (sys.triggersFearTable) {
        t.fearDraw = await CONFIG.DODE.rollFearTable();
      }
    }

    out.perTarget.push(t);
    out.pending.targets.push(pendingT);
  }

  return out;
}

/**
 * Utför ALLA skrivningar ett `resolveSpellCast()`-resultat beskriver (PSY-
 * avdrag, instant HP-delta, statustoggle, spellEffect-ActiveEffect) — se
 * `result.pending`. Kräver att ANROPAREN redan har behörighet på de
 * inblandade dokumenten; ingen egen permission-hantering här — samma
 * kontrakt som `attack.mjs#applyAttackResult`.
 *
 * ⚠ HP-deltat räknas mot AKTUELLT värde vid skrivtillfället, inte mot
 * `perTarget[].totalAfterPreview` (som bara är för kortets förhandsvisning)
 * — samma "delta, inte ögonblicksbild"-princip som `applyAttackResult`
 * redan följer (se memory.md, Spelar-anfall Fas B).
 *
 * @param {object} result Returvärdet från `resolveSpellCast()`.
 * @param {object} ctx
 * @param {Actor}  ctx.caster
 * @param {Actor[]} [ctx.targets=[]] Måste innehålla varje aktör som
 *   `result.pending.targets` refererar (matchas på `.id`).
 */
export async function applySpellResult(result, { caster, targets = [] }) {
  const p = result?.pending ?? {};

  if (p.psy) {
    const current = caster.system.resources?.psy?.value ?? caster.system.resources?.psy?.max ?? 0;
    await caster.update({ "system.resources.psy.value": Math.max(0, current - p.psy.amount) });
  }

  for (const pt of p.targets ?? []) {
    const target = targets.find((t) => t.id === pt.actorId);
    if (!target) continue;

    if (pt.instantEffect) {
      const current = target.system.hp?.value ?? target.system.hp?.max ?? 0;
      const maxHp = target.system.hp?.max ?? current;
      const next = pt.instantEffect.kind === "heal"
        ? Math.min(maxHp, current + pt.instantEffect.amount)
        : current - pt.instantEffect.amount;
      await target.update({ "system.hp.value": next });
    }
    if (pt.status) {
      // ⚠ Live-fynd 2026-08-21 (Johan): när en statuseffekt applicerad av en
      // besvärjelse senare tas bort (utgången varaktighet, botad, SL-borttagen)
      // ska det synas i chatten VILKEN besvärjelse det var — annars försvinner
      // ikonen tyst utan förklaring. `toggleStatusEffect` skapar/returnerar den
      // nya ActiveEffect-dokumentet (core-API) — flaggas här med källan, läses
      // av `deleteActiveEffect`-hooken i dode.mjs.
      const created = await target.toggleStatusEffect(pt.status, { active: true });
      // Samma flagg-form som buildTemporaryEffectData (actor.mjs) redan
      // använder för spellEffect-buffar — EN gemensam konvention
      // `deleteActiveEffect`-hooken (dode.mjs) kan lita på oavsett vilken av
      // de två vägarna som skapade effekten.
      if (created?.setFlag) {
        await created.setFlag(game.system.id, "source", "spell");
        await created.setFlag(game.system.id, "sourceName", result.item.name);
      }
    }
    if (pt.spellEffect) await caster.applySpellEffect(result.item, target);
  }
}

const OUTCOME_LABEL = { perfekt: "Perfekt!", lyckat: "Lyckat", misslyckat: "Misslyckat", fummel: "Fummel!" };

/** Bygger mallkontexten för besvärjelsekortet — mirror av attack.mjs:s buildAttackCardContext. */
function buildSpellCardContext(result, { caster, targets = [], pendingBanner = false }) {
  // ⚠ Rättad 2026-08-21 (live-fynd, samma dag/rot-orsak som attack-card.hbs:s
  // motsvarande fix): headern visade ALDRIG vem besvärjelsen riktades mot —
  // `result.perTarget` är dessutom TOM för ett misslyckat/fummlat kast
  // (resolveSpellCast returnerar tidigt), så ett misslyckat kast mot ett
  // riktigt mål syntes inte ha NÅGOT mål alls i kortet. `targets` (de riktiga
  // Actor-objekten anroparen redan skickar till postSpellCard) används i
  // stället, oavsett utfall.
  const targetName = targets.length > 1
    ? `${targets.length} mål`
    : (targets[0]?.name ?? "");
  return {
    casterName: caster.name,
    targetName,
    spellName: result.item.name,
    spellImg: result.item.img,
    school: result.item.system.school,
    E: result.E,
    cl: result.cl,
    castRoll: result.cast.roll.total,
    castOutcome: result.cast.outcome,
    castOutcomeLabel: OUTCOME_LABEL[result.cast.outcome],
    psyCost: result.psyCost,
    fumbled: !!result.fumbled,
    snedtandning: result.snedtandning ? {
      name: result.snedtandning.result.name,
      description: result.snedtandning.result.description,
      fobiName: result.snedtandning.fobi?.result.name ?? null,
      fobiDescription: result.snedtandning.fobi?.result.description ?? null
    } : null,
    targets: result.perTarget.map((t) => ({
      name: t.name,
      resisted: t.resisted ? {
        rolled: t.resisted.roll?.total ?? null,
        success: t.resisted.success,
        autoResult: t.resisted.autoResult
      } : null,
      instantEffect: t.instantEffect ? {
        kind: t.instantEffect.kind,
        rolled: t.instantEffect.roll.total,
        maximised: t.instantEffect.maximised,
        blocked: t.instantEffect.resistance.blocked,
        reduction: t.instantEffect.resistance.reduction,
        applied: t.instantEffect.appliedAmount,
        totalAfter: t.instantEffect.totalAfterPreview
      } : null,
      statusApplied: t.statusApplied,
      spellEffectApplies: t.spellEffectApplies,
      fearDraw: t.fearDraw ? { text: t.fearDraw.result.name } : null
    })),
    cssClass: result.cast.outcome,
    pendingBanner
  };
}

/**
 * Postar besvärjelsekortet. Samma "riktiga tärningar bifogas OAVSETT pending"-
 * princip som `attack.mjs#postAttackCard` — se den funktionens docblock.
 *
 * @param {object} [o]
 * @param {Actor}  [o.targets] Bara nödvändigt när `pending` är sant — sparas i
 *   kortets flagga så godkännande-hooken (Fas 3) kan återskapa
 *   `applySpellResult`s kontext.
 * @param {boolean}[o.pending] Sant när anroparen INTE har skrivbehörighet på
 *   (minst ett av) målen.
 */
export async function postSpellCard(result, { caster, targets = [], pending = false }) {
  const content = await renderTemplate(
    "systems/drakar-och-demoner-expert/templates/chat/spell-card.hbs",
    buildSpellCardContext(result, { caster, targets, pendingBanner: pending })
  );

  // ⚠ Varje rulle märkt med en `flavor` — Johans live-feedback 2026-08-21:
  // korten visade tärningar utan att säga VILKEN rulle det var (kastning?
  // skada?). Läses av mallen INTE (bara av Dice So Nice-tooltipen/loggen),
  // se spell-card.hbs:s egna "Kastning"/"Skada"-etiketter för den synliga
  // texten i själva kortet.
  result.cast.roll.options.flavor = "Kastning";
  const restRolls = [];
  if (result.snedtandning?.roll) { result.snedtandning.roll.options.flavor = "Snedtändning"; restRolls.push(result.snedtandning.roll); }
  if (result.snedtandning?.fobi?.roll) { result.snedtandning.fobi.roll.options.flavor = "Fobi"; restRolls.push(result.snedtandning.fobi.roll); }
  for (const t of result.perTarget) {
    if (t.resisted?.roll) { t.resisted.roll.options.flavor = "Motstånd"; restRolls.push(t.resisted.roll); }
    if (t.instantEffect?.roll) {
      t.instantEffect.roll.options.flavor = t.instantEffect.kind === "heal" ? "Läkning" : "Skada";
      restRolls.push(t.instantEffect.roll);
    }
    if (t.fearDraw?.roll) { t.fearDraw.roll.options.flavor = "Skräck"; restRolls.push(t.fearDraw.roll); }
  }

  // ⚠ Riktig paus mellan "lyckades jag?" och "hur mycket skada?" — Johans
  // live-feedback 2026-08-21 (samma dag som det TIDIGARE försöket med manuell
  // `showForRoll`-förhandsvisning reverterades, se den borttagna kommentaren
  // i git-historiken: det försöket dubbel-animerade eftersom SAMMA Roll-
  // instans hamnade i både den manuella visningen och `ChatMessage.create`s
  // egen auto-animation). Den här varianten undviker problemet HELT genom
  // att ALDRIG lägga samma Roll i två meddelandens `rolls`-array: kastnings-
  // rullen postas i ETT eget litet meddelande DIREKT (egen, ensam DsN-
  // animation), en riktig paus väntas ut, och det FULLA kortet postas sedan
  // med BARA de återstående rullarna (skada/motstånd/skräck osv) — kortets
  // mall visar redan kastningsresultatet som TEXT (result.cast.roll.total),
  // oberoende av om Roll-OBJEKTET finns med i just det meddelandets rolls-
  // array, så inget syns dubbelt.
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="dode-chat-card"><p>🎲 <strong>${caster.name}</strong> kastar ${result.item.name}... <strong>${result.cast.roll.total}</strong> — ${OUTCOME_LABEL[result.cast.outcome]}</p></div>`,
    rolls: [result.cast.roll],
    sound: CONFIG.sounds.dice
  });
  if (restRolls.length) await new Promise((r) => setTimeout(r, 900));

  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content, rolls: restRolls, sound: restRolls.length ? CONFIG.sounds.dice : null
  };

  if (pending) {
    // ⚠ Bara `result.pending` + `itemId` behövs för `applySpellResult` —
    // samma minimal-JSON-princip som attack.mjs:s pendingAttack-flagga.
    // `itemId` (INTE hela iteminnehållet) räcker eftersom besvärjelsen är
    // ett EMBEDDAT item på kastaren — godkännande-hooken slår upp
    // `caster.items.get(itemId)` färskt, samma mönster som attack.mjs:s
    // hook redan slår upp vapen/pareringsföremål via `pending.wear.itemId`.
    // ⚠ `Uuid`, INTE bara aktörs-id:n — se attack.mjs:s motsvarande fix
    // (samma dag, samma rot-orsak): en olänkad NPC-tokens `.id` är delat med
    // BAS-aktören, så `game.actors.get(id)` i godkännande-hooken hade skrivit
    // till fel objekt om samma bas-NPC har flera tokens på kartan (eller om
    // token-instansen redan bär en egen ActorDelta-override). `.uuid` löses
    // tillbaka till EXAKT samma objekt som förhandsvisades via `fromUuidSync`.
    messageData.flags = {
      [game.system.id]: {
        pendingSpell: {
          pending: result.pending,
          itemId: result.item.id,
          casterUuid: caster.uuid,
          targetUuids: targets.map((t) => t.uuid),
          processed: false
        }
      }
    };
  }

  return ChatMessage.create(messageData);
}
