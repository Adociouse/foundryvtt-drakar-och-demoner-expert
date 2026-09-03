import { ensureHitLocations, applyLocationDamage, previewLocationDamage, armourFor, tokenDistance, meleeReach } from "../helpers/anatomy.mjs";
import { combineDamageFormula } from "./damage-roll.mjs";
import { canEarnFromUse, rollEpAward, awardItemEp } from "../helpers/ep.mjs";

/**
 * Stridsupplösning — **Spelledarboken s.16-18**.
 *
 * ⚠ **Träffområde slås ALLTID**, även i vanlig strid. Johans beslut 2026-07-29:
 * *"think of a generic attack always has a hidden riktad attack or if you switch
 * mid fight"*. Slaget är gratis, och genom att alltid ha det kan SL slå om till
 * detaljerad strid mitt i en strid utan att något behöver rekonstrueras — det
 * som skiljer lägena är om området **visas och får effekt**, inte om det finns.
 */

/** CL-modifikationer för närstrid — SLB s.17. */
export const MELEE_MODS = {
  liggande: 5, fransidan: 3, bakifran: 7, ororlig: 10,
  skymning: -5, morker: -15, riktat: -5, skoldhand: -10
};

/** CL-modifikationer för avståndsstrid — SLB s.17. */
export const RANGED_MODS = {
  ororlig: 10, skymning: -5, morker: -15, riktat: -5
};

/**
 * Löser ett måls `resistances[]` mot ETT vapenanfall — backlog 84, 2026-09-03,
 * utökad 2026-09-03 (backlog 100) med vapnets slagkategori (`strikeType`).
 * Skickar aldrig ett besvärjelseelement — se fields-resistances.mjs för varför
 * vapen- och besvärjelsekanalerna är medvetet SKILDA (Lindskiarnens halvering
 * gäller uttryckligen bara besvärjelser; skulle `"physical"` återanvänts för
 * båda hade den läckt in i vanliga svärdshugg).
 *
 * **Två-stegs uppslagning (backlog 100):** kollar FÖRST en post för vapnets
 * specifika `strikeType` (piercing/slashing/blunt — Skelettets fyra olika
 * regler för fyra vapentyper, MB1 s.91, kräver detta), och faller bara
 * tillbaka på den generiska `"weapon"`-typen om målet saknar en sådan post
 * (Varulv/Vampyr/Dödsgast/Kummelgast/Mörkgast — kategorilösa, rent material-
 * styrda regler som inte bryr sig om vapnets slagtyp alls).
 *
 * Tillämpas ALLTID efter rustningsavdrag — Varulv-textens egen ordning
 * ("...efter att vapnet trängt igenom skinnet").
 *
 * ⚠ `ammoMaterial` tillagd 2026-09-03 (backlog 104-uppföljning) — ÖVERORDNAR
 * `weapon.system.material` när den är satt. Johans rättelse: "a bow is just
 * a bow.. arrows is the ammo" — en Långbåge har inget eget `material` som
 * spelar roll i strid, det är PILEN (ett separat `utrustning`-item,
 * `category:"ammunition"`, se item-utrustning.mjs) som avgör om skottet
 * räknas som silver/magiskt. Bara relevant för `category:"projektil"`-vapen
 * (attack-dialog.mjs skickar `null` annars).
 *
 * @param {Actor} target
 * @param {Item|null} weapon
 * @param {number} amount Skada EFTER rustningsavdrag.
 * @param {string|null} [ammoMaterial=null]
 * @returns {{amount:number, resistance:object}}
 */
function applyWeaponResistance(target, weapon, amount, ammoMaterial = null) {
  const material = ammoMaterial ?? weapon?.system?.material ?? "mundane";
  const strikeType = weapon?.system?.strikeType || null;
  const hasSpecific = strikeType && (target?.system?.resistances ?? []).some((r) => r.damageType === strikeType);
  const damageType = hasSpecific ? strikeType : "weapon";
  const resistance = CONFIG.DODE.resolveResistance(target, damageType, 0, material);
  if (resistance.blocked) return { amount: 0, resistance };
  let out = Math.max(0, amount - resistance.reduction);
  if (resistance.halved) out = Math.floor(out / 2);
  if (resistance.doubled) out *= 2;
  return { amount: out, resistance };
}

/**
 * Vilken av de fyra fummeltabellerna (config.mjs `rollWeaponFummelTable`)
 * som gäller för ett ANFALL — vald efter VAPENTYP, se
 * docs/extracts/DODE_Spelarboken_FUMMELTABELLER.md. Inget vapen alls
 * (obeväpnad/naturlig attack utan Item) → "obevapnad".
 */
function attackFummelTableKey(weapon) {
  if (!weapon) return "obevapnad";
  const category = weapon.system?.category;
  if (category === "narstrid") return "narstrid";
  if (category === "projektil" || category === "kast") return "avstand";
  return "obevapnad";
}

/**
 * Vilken fummeltabell som gäller för en PARERING — sköld har sin EGEN tabell
 * (skild från vapnets), annars samma vapentyp-logik som anfall. Ett
 * pareringsföremål är alltid `rustning`(sköld) eller `vapen` — aldrig
 * `projektil`/`kast` (parering med avståndsvapen är omöjlig, `canParry`
 * spärrar redan det i attack-dialog.mjs).
 */
function parryFummelTableKey(parryItem) {
  if (!parryItem) return "obevapnad";
  if (parryItem.system?.slot === "skold") return "skold";
  return "narstrid";
}

/**
 * Slår ett FV-slag och klassar utfallet enligt samma perfekt/fummel-bekräftelse
 * som `rollFV` — men utan chattkort, eftersom anfall och parering (och,
 * fr.o.m. Fas 2, besvärjelsekastning) redovisas tillsammans i ett kort.
 * Exporterad så `scripts/rolls/spell.mjs` kan återanvända samma
 * bekräftelselogik i stället för att duplicera den.
 */
export async function classifiedRoll(fv) {
  const roll = await new Roll("1d20").evaluate();
  let outcome = roll.total <= fv ? "lyckat" : "misslyckat";
  if (roll.total === 1) {
    const c = await new Roll("1d20").evaluate();
    outcome = c.total <= fv ? "perfekt" : "lyckat";
  } else if (roll.total === 20) {
    const c = await new Roll("1d20").evaluate();
    outcome = c.total > fv ? "fummel" : "misslyckat";
  }
  return { roll, outcome };
}

/**
 * Kryssar i EP-strecket för en färdighet som just användes framgångsrikt —
 * RP s.63, samma regel `rollFV` redan tillämpar på vanliga färdighetsslag.
 *
 * ⚠ **Detta saknades helt för strid.** `resolveAttack` slår sina egna tärningar
 * via `classifiedRoll` i stället för `rollFV`, så anfalls- och pareringsslag gav
 * inget EP-streck alls tidigare — en rollperson kunde slåss en hel dag och
 * kryssa i noll rutor. Ett lyckat ANFALL är en lyckad användning av
 * vapenfärdigheten; en lyckad PARERING är en lyckad användning av
 * pareringsfärdigheten (t.ex. Sköld). Båda ska ge EP oavsett vad som händer
 * sedan i utfallsmatrisen — det är själva slaget som räknas, inte träffen.
 *
 * ⚠ Bara rollpersoner (inte SLP) tjänar EP — SLP:er saknar de EP-bärande
 * färdighets-Item helt (se doc-kommentaren på `skill`/`parrySkill` nedan).
 *
 * ⚠ **Bara BERÄKNAR + RULLAR, skriver INGET** (Spelar-anfall-planen,
 * 2026-08-21) — `awardItemEp`s faktiska `item.update()` flyttad till
 * `applyAttackResult`, så en anfallande klient utan skrivbehörighet på
 * försvararen ändå kan räkna ut och VISA hela resultatet. `rollEpAward`s
 * tärning slås ändå HÄR (i den rena fasen) så Dice So Nice-animationen sker
 * på den klient som faktiskt slår — se `applyAttackResult` för skrivningen.
 */
async function computeSkillEp(actorType, skill, outcome) {
  if (actorType !== "character") return null;
  if (!["lyckat", "perfekt"].includes(outcome)) return null;
  if (!canEarnFromUse(skill)) return null;
  const { amount, roll } = await rollEpAward(outcome);
  return { skillId: skill.id, amount, roll, skillName: skill.name };
}

/**
 * SLB s.17:s resultatmatris. Returnerar vad som ska hända, inte vad som hände.
 *
 * ⚠ **BV är en slitagemätare, inte en absorbering.** Överstiger skadan
 * brytvärdet sjunker BV med 1; vid BV 0 går den överskjutande skadan igenom.
 * ⚠ På **misslyckat anfall + lyckad parering** slits ANFALLARENS vapen — ett
 * vapen kan alltså gå sönder av att bli parerat.
 */
export function resolveMatrix(attack, parry) {
  if (attack === "fummel") return { result: "fummeltabell-anfall" };
  if (attack === "perfekt") return { result: "traff", maxDamage: true, ignoreArmour: true };
  if (attack === "misslyckat") {
    if (parry === "fummel") return { result: "fummeltabell-parering" };
    if (parry === "lyckat" || parry === "perfekt") return { result: "vapenslitage", wearOn: "attacker" };
    return { result: "ingenting" };
  }
  // Lyckat anfall
  if (parry === "fummel") return { result: "traff", alsoFumbleTable: "parering" };
  if (parry === "misslyckat" || parry === null) return { result: "traff" };
  if (parry === "perfekt") return { result: "ingenting" };
  return { result: "parerat", wearOn: "defender" };
}

/**
 * Full stridsupplösning mellan två aktörer.
 *
 * @param {object} o
 * @param {Actor}  o.attacker
 * @param {Item}   o.weapon        `vapen`-item
 * @param {Actor}  o.target
 * @param {Item}   [o.skill]       Vapenfärdigheten (bär FV — vapnet gör INTE det)
 * @param {number} [o.fv]          Uttryckligt FV, för SLP utan färdighets-Item
 * @param {Item}   [o.parryItem]   Vapen/sköld försvararen parerar med
 * @param {string} [o.aimedAt]     Träffområdesnyckel — gör anfallet RIKTAT (−5 CL)
 * @param {string} [o.intent]      "skada" | "bedova"
 * @param {object} [o.mods]        Fria CL-modifikationer, t.ex. { bakifran: 7 }
 * @param {boolean}[o.ranged]      Avståndsanfall — ⚠ kan aldrig pareras utom kastvapen
 * @param {boolean}[o.defending]   Försvarar sig målet? Styr träfftabellens kolumn
 * @param {boolean}[o.detailed]    Visa/tillämpa träffområdeseffekter
 * @param {number} [o.parryBonus]  Fri SL-satt bonus till FÖRSVARARENS pareringsCL
 *   (Spelar-anfall-planen, 2026-08-21) — t.ex. ett tydligt "telegraferat" anfall
 *   (en drake som synligt drar in luft, en bågskytt som långsamt siktar) där SL
 *   vill ge extra pareringschans. Alltid 0 om inte uttryckligen satt av SL i
 *   den manuella enda-måls-dialogen; ALDRIG i flermåls-/snabbanfallsläget.
 *   Samma "SL:s ad hoc-bedömning"-princip som `mods`, ingen bokciterad siffra.
 * @param {TokenDocument} [o.attackerToken] Tillsammans med targetToken ger detta
 *   en RÄCKVIDDSKONTROLL via Foundrys egen `canvas.grid.measurePath` — respekterar
 *   rutnätstyp och diagonalregel. Utelämnas de görs ingen kontroll alls.
 * @param {TokenDocument} [o.targetToken]
 */
export async function resolveAttack({
  attacker, weapon, target, skill = null, fv: fvOverride = null, parryItem = null,
  parrySkill = null, parryFv = null, aimedAt = null,
  intent = "skada", mods = {}, ranged = false, defending = true, detailed = true,
  parryBonus = 0, attackerToken = null, targetToken = null,
  // ⚠ Backlog 104-uppföljning, 2026-09-03: "a bow is just a bow.. arrows is
  // the ammo". Överordnar `weapon.system.material` i applyWeaponResistance
  // — attack-dialog.mjs skickar den valda ammunitionens `material` (ett
  // `utrustning`-item, `category:"ammunition"`) för `category:"projektil"`-
  // vapen, annars `null` (då gäller vapnets eget `material` som förut).
  ammoMaterial = null
}) {
  // ⚠ Räckvidd mäts med Foundrys egen funktion, inte egen geometri — se
  // tokenDistance(). Kontrollen görs bara när båda tokens skickas med, så
  // anrop utan karta (tester, SL-fiat) fungerar som förut.
  if (attackerToken && targetToken) {
    const d = tokenDistance(attackerToken, targetToken);
    const reach = ranged ? Infinity : meleeReach(weapon);
    // ⚠ SLB s.16: avståndsvapen kräver MINST en ruta emellan — man kan inte
    // skjuta någon som står intill sig.
    if (ranged && d.spaces < 1) {
      return { outOfRange: true, distance: d, reason: "Avståndsvapen kräver minst en ruta mellan skytt och mål (SLB s.16)" };
    }
    if (!ranged && d.spaces > reach) {
      return { outOfRange: true, distance: d, reason: `Utom räckhåll — ${d.spaces} rutor, vapnet når ${reach}` };
    }
  }

  // ⚠ **Vapnet bär inte FV** — färdigheten gör det (`item-vapen.mjs` har damage,
  // styGroup, baseValue m.m. men inget fv). Den som anropar måste skicka
  // färdigheten eller ett uttryckligt `fv`; annars finns ingen chans att träffa.
  //
  // ⚠ **Vapengrupps-/färdighetsmodifierare saknades här — hittat och rättat
  // 2026-08-18 under Anfallsdialog-arbetet.** `actor.rollSkill()`
  // (documents/actor.mjs) har alltid lagt `weaponGroupBonusTotals`/
  // `skillModifierTotals` OVANPÅ `item.system.total` som ett separat,
  // live-summerat lager (se den funktionens egen kommentar) — `resolveAttack`
  // läste bara `skill.system.total` rakt av och missade båda. Ett stridsslag
  // gav alltså tystare FV än ett vanligt färdighetsslag för SAMMA färdighet,
  // t.ex. hela vapengruppens gratis delkredit (RP s.60) räknades aldrig i
  // strid. Samma tillägg görs nu för BÅDE anfallaren och pareraren nedan.
  const attackerBonus = skill
    ? (attacker?.system?.weaponGroupBonusTotals?.[skill.system.skillKey] ?? 0)
      + (attacker?.system?.skillModifierTotals?.[skill.system.skillKey] ?? 0)
    : 0;
  const baseFv = (skill ? skill.system.total + attackerBonus : null) ?? fvOverride ?? 0;
  if (!baseFv) throw new Error("resolveAttack: skicka `skill` (fardighet-Item) eller `fv` — vapnet bär inget FV.");
  const modTotal = Object.values(mods).reduce((a, b) => a + b, 0) + (aimedAt ? -5 : 0);
  const fv = Math.max(1, baseFv + modTotal);

  const atk = await classifiedRoll(fv);

  // ⚠ Kättingvapen/Piska (SB s.33, item-vapen.mjs `hardToParry`) — TVÅ
  // separata, oberoende regler i samma stycke, lätt att sammanblanda:
  //  1. Bäraren riskerar ett eget självfummelslag: ett rått anfallsslag på
  //     18, 19 ELLER 20 räknas automatiskt som miss (oavsett FV), och avgörs
  //     sedan av ett 1T20 (resultat > eget FV = fumlat; ett rått 20 på DETTA
  //     slag är alltid fummel). Detta ersätter `classifiedRoll`s vanliga
  //     raw-20-hantering för just det här vapnet.
  //  2. Varje pareringsförsök mot vapnet — vapen ELLER sköld — får CL
  //     halverat (se nedan, `parryFvBase`).
  let hardParrySelfFumble = null;
  if (weapon?.system?.hardToParry && atk.roll.total >= 18) {
    const confirm = await new Roll("1d20").evaluate();
    const fumbled = confirm.total === 20 || confirm.total > fv;
    atk.outcome = fumbled ? "fummel" : "misslyckat";
    hardParrySelfFumble = { roll: confirm, fumbled };
  }

  // ⚠ Parering: aldrig mot projektilvapen, och aldrig med ett avståndsvapen i
  // handen (SLB s.17). Kastvapen får pareras om försvararen har sköld.
  // ⚠ `weapon.system.parryable` (Spelar-anfall-planen, 2026-08-21): default
  // `true` (icke-Item-vapen, t.ex. NPC-fritextanfall, saknar fältet — `!==
  // false` behåller dem parerbara som förut). ETT TILLÄGG, aldrig en väg att
  // göra ett projektilvapen parerbart — `!ranged` gäller alltid först. Låter
  // enstaka närstrids-/kastvapen (t.ex. ett magiskt vapen som "slår igenom"
  // all parering) markeras oparerbara utan att felaktigt kategoriseras om
  // till projektil.
  const canParry = !!parryItem && !ranged && weapon?.system?.parryable !== false;
  // Samma vapengrupps-/färdighetsmodifierare-tillägg som `baseFv` ovan,
  // fast på FÖRSVARAREN (`target`) — samma bugg, samma fix.
  const parrySkillBonus = parrySkill
    ? (target?.system?.weaponGroupBonusTotals?.[parrySkill.system.skillKey] ?? 0)
      + (target?.system?.skillModifierTotals?.[parrySkill.system.skillKey] ?? 0)
    : 0;
  const parryFvBase = ((parrySkill ? parrySkill.system.total + parrySkillBonus : null) ?? parryFv ?? baseFv) + parryBonus;
  const effectiveParryFv = weapon?.system?.hardToParry ? Math.floor(parryFvBase / 2) : parryFvBase;
  const par = canParry
    ? await classifiedRoll(effectiveParryFv)
    : { roll: null, outcome: null };

  // ⚠ EP-streck för BÅDA slagen — se computeSkillEp(). Sker oavsett vad
  // utfallsmatrisen sedan gör med anfallet; det är det lyckade SLAGET som ger
  // EP (RP s.63), inte att hugget faktiskt gick igenom. Tärningen slås HÄR
  // (ren fas), men skrivningen (EP-strecket, `awardItemEp`) sker först i
  // `applyAttackResult` — se computeSkillEp()s egen kommentar.
  const attackEp = skill ? await computeSkillEp(attacker?.type, skill, atk.outcome) : null;
  const parryEp = canParry && parrySkill ? await computeSkillEp(target?.type, parrySkill, par.outcome) : null;

  const verdict = resolveMatrix(atk.outcome, par.outcome);
  const out = {
    fv, modTotal, mods, attack: atk, parry: par, verdict,
    attackEp, parryEp, hardParrySelfFumble,
    aimed: !!aimedAt, intent, damage: null, location: null, effect: null, wear: null,
    // ⚠ Skrivningar som ANNARS skulle ske här skjuts upp till `applyAttackResult`
    // — se Spelar-anfall-planen, 2026-08-21. Fylls i av grenarna nedan.
    pending: { attackerEp: null, defenderEp: null, wear: null, damage: null }
  };
  if (attackEp) out.pending.attackerEp = { skillId: attackEp.skillId, amount: attackEp.amount };
  if (parryEp) out.pending.defenderEp = { skillId: parryEp.skillId, amount: parryEp.amount };

  // ⚠ Varning, INTE en blockering (Johan, 2026-09-03, kreaturstyp+mål-
  // varningssystemet) — anfallet slås och skadan beräknas/appliceras
  // oförändrat oavsett detta. Bara NPC-mål har ett `creatureType`.
  if (target?.type === "npc" && target.system.creatureType) {
    out.targetWarning = CONFIG.DODE.creatureWeaponWarning(target.system.creatureType, weapon?.system?.material ?? "mundane");
  }

  // ⚠ Fummeltabell-dragning (Magisystem-planen Fas 6, 2026-08-21) — sker HÄR,
  // i den rena beräkningsfasen, INTE i applyAttackResult: draget är
  // slumpmässigt och ska ALDRIG slås om vid ett ev. SL-godkännande (samma
  // princip som Snedtändningstabellen redan följer). Bara visat, ingen
  // mekanisk tillämpning av effekttexten — se rollWeaponFummelTable().
  if (verdict.result === "fummeltabell-anfall") {
    out.fummelDraw = await CONFIG.DODE.rollWeaponFummelTable(attackFummelTableKey(weapon));
  } else if (verdict.result === "fummeltabell-parering" || verdict.alsoFumbleTable === "parering") {
    out.fummelDraw = await CONFIG.DODE.rollWeaponFummelTable(parryFummelTableKey(parryItem));
  }

  // ⚠ Träffområdet slås ALLTID — se modulkommentaren. Även när `detailed` är
  // false; då används det bara inte.
  const plan = target?.system.bodyPlan ?? "humanoid";
  const rolled = await CONFIG.DODE.rollHitLocation(plan, { defending, fromBehind: !!mods.bakifran });
  out.location = aimedAt
    ? { location: aimedAt, label: CONFIG.DODE.hitLocations[aimedAt] ?? aimedAt, aimed: true }
    : { ...rolled, aimed: false };

  if (verdict.result === "vapenslitage" || verdict.result === "parerat") {
    const item = verdict.wearOn === "attacker" ? weapon : parryItem;
    const dmg = await new Roll(weapon?.system.damage || "1d6").evaluate();
    // ⚠ Brytvärdet heter `baseValue` på vapenmodellen (BV = brytvärde) — det
    // fanns redan, oanvänt. SLB s.17: överstiger skadan BV sjunker BV med 1;
    // vid BV 0 går den överskjutande skadan igenom till försvararen.
    const bv = item?.system.baseValue ?? null;
    const worn = bv !== null && dmg.total > bv;
    // ⚠ SLP:ers attacker är fritext i `system.attacks`, inte Item-dokument
    // (MONSTER.md: källorna anger dem så). Slitaget kan då bara rapporteras,
    // inte bokföras — därför en guard i stället för ett antagande om Document.
    // ⚠ Skrivningen (`item.update`) sker inte här längre — se
    // `out.pending.wear`/`applyAttackResult`.
    const persisted = typeof item?.update === "function";
    if (worn && persisted) out.pending.wear = { itemId: item.id, side: verdict.wearOn, newBaseValue: Math.max(0, bv - 1) };
    const broke = worn && bv - 1 <= 0;
    out.wear = {
      item: item?.name ?? "—", damage: dmg.total, bv, bvAfter: worn ? Math.max(0, bv - 1) : bv,
      worn, broke, wearOn: verdict.wearOn,
      persisted,
      overflow: broke ? Math.max(0, dmg.total - 0) : 0,
      note: bv === null ? "⚠ Föremålet saknar brytvärde (baseValue)" : ""
    };
    // ⚠ Går BV till 0 fortsätter anfallet — men **stridsdiagrammet (SLB s.31)**
    // skickar den grenen genom rutan "−1 på skadan" innan rustningen dras.
    // Textmatrisen på s.17 säger bara "den överskjutande skadan" utan att nämna
    // avdraget; diagrammet är det mer precisa av de två och följs här.
    // Håller skölden (BV > 0) är anfallet slut — ingen skada alls går igenom.
    if (broke && verdict.wearOn === "defender") {
      const abs = armourFor(target, out.location.location);
      const { amount: applied, resistance } = applyWeaponResistance(target, weapon, Math.max(0, dmg.total - 1 - abs), ammoMaterial);
      const res = previewLocationDamage(target, out.location.location, applied, { intent, allowHypotheticalLocations: detailed });
      out.damage = {
        roll: dmg, formula: weapon?.system.damage, abs, applied, viaBrokenParry: true, minusOne: true,
        resistance: (resistance.blocked || resistance.reduction || resistance.halved || resistance.doubled) ? resistance : null
      };
      out.effect = res.effect;
      out.totalAfter = res.totalAfter;
      out.pending.damage = { location: out.location.location, amount: applied, intent, detailed };
    }
    return out;
  }

  // ⚠ **AVSTEG — "det rena utslaget". Creator decision, Johan 2026-07-29.**
  // Ingen bok har någon motsvarighet. Ett PERFEKT anfallsslag med bedövande
  // avsikt mot ett RIKTAT huvudslag slår ut offret fullständigt: **noll skada**,
  // medvetslös i dagar, och inget spår av hur det gick till.
  //
  // Elegansen ligger i nollan: eftersom inga KP dras finns det heller ingen
  // sårskada att hitta, varken mekaniskt eller i fiktionen. Offret vaknar
  // oskadat och vet inte vad som hände.
  //
  // ⚠ Priset är inbyggt: man måste RIKTA mot huvudet (−5 CL), vilket gör det
  // perfekta slaget svårare att bekräfta. Man betalar alltså i träffchans för
  // chansen till ett rent utslag.
  //
  // ⚠ Kräver medvetet både riktat huvudslag OCH bedövande avsikt — annars hade
  // ett perfekt rapiestick "slagit ut" någon, vilket vore orimligt.
  if (atk.outcome === "perfekt" && intent === "bedova" && aimedAt === "huvud") {
    const formula = game.settings.get("drakar-och-demoner-expert", "cleanKnockoutDuration");
    const dur = await new Roll(formula).evaluate();
    out.cleanKnockout = {
      days: dur.total, roll: dur,
      text: `Rent utslag — medvetslös i ${dur.total} dygn. Ingen skada, inget spår av hur det gick till.`
    };
    out.damage = { roll: null, formula: null, abs: 0, applied: 0, cleanKnockout: true };
    out.totalAfter = target.system.hp?.value ?? target.system.hp?.max ?? 0;
    return out;
  }

  if (verdict.result !== "traff") return out;

  // --- Träff: skada → rustning → träffområde + Totala KP -------------------
  const formula = combineDamageFormula(weapon?.system.damage || "1d6",
    ranged ? "" : (attacker.system.damageBonus ?? ""));
  const dmgRoll = await new Roll(formula).evaluate();
  let damage = verdict.maxDamage
    // Perfekt: automatiskt maximal skada med maximal skadebonus (SLB s.18).
    ? dmgRoll.terms.filter((t) => t.faces).reduce((a, t) => a + t.number * t.faces, 0)
      + dmgRoll.terms.filter((t) => typeof t.number === "number" && !t.faces).reduce((a, t) => a + t.number, 0)
    : dmgRoll.total;

  // ⚠ **KONFLIKT INOM SAMMA BOK — SLB s.17 mot s.31.**
  //   s.17 (textmatrisen): "Perfekt ... Attacken gör automatiskt maximal skada.
  //     Försvararens rustningsabsorbering dras ej bort."
  //   s.31 (stridsdiagrammet): rutan "Maximal skada" flödar in i "Dra bort
  //     rustningens absorbering och/eller naturligt skydd" precis som de andra
  //     två skadegrenarna — alltså dras rustningen även vid perfekt.
  // Vi följer TEXTEN (ingen absorbering vid perfekt), eftersom den är ett
  // uttryckligt påstående medan diagrammet kan vara en förenkling. Skillnaden
  // är stor i praktiken: mot Abs 8 är ett perfekt hugg antingen förödande eller
  // nästan verkningslöst. ⚠ Behöver Johans beslut — se DESIGN_DECISIONS.md.
  const abs = verdict.ignoreArmour ? 0 : armourFor(target, out.location.location);
  damage = Math.max(0, damage - abs);
  // ⚠ Kreaturstyp-/vapenmaterialmotstånd (backlog 84) — ALLTID efter rustning,
  // ÄVEN vid Perfekt (ignoreArmour gäller bara rustning, inte köttets/
  // andeväsens egen motståndskraft mot vapenmaterial). Se applyWeaponResistance.
  const { amount: resistedDamage, resistance } = applyWeaponResistance(target, weapon, damage, ammoMaterial);
  damage = resistedDamage;
  out.damage = {
    roll: dmgRoll, formula, abs, applied: damage, maximised: !!verdict.maxDamage,
    resistance: (resistance.blocked || resistance.reduction || resistance.halved || resistance.doubled) ? resistance : null
  };

  // ⚠ `ensureHitLocations`s skrivning OCH själva skadeskrivningen skjuts upp
  // till `applyAttackResult` — se `out.pending.damage`. Förhandsvisningen
  // (`previewLocationDamage`) räknar mot en hypotetisk träffområdeskarta om
  // ingen redan finns, styrt av samma `detailed`-flagga som annars hade
  // gett `ensureHitLocations` grönt ljus.
  const applied = previewLocationDamage(target, out.location.location, damage, { intent, allowHypotheticalLocations: detailed });
  out.effect = applied.effect;
  out.totalAfter = applied.totalAfter;
  out.pulled = applied.pulled;
  out.pending.damage = { location: out.location.location, amount: damage, intent, detailed };
  return out;
}

/**
 * Utför ALLA skrivningar ett `resolveAttack()`-resultat beskriver (EP-streck,
 * vapenslitage, skada) — se `out.pending`. Kräver att ANROPAREN redan har
 * behörighet på de inblandade dokumenten; ingen egen permission-hantering
 * här. Anropas antingen OMEDELBART (SL, eller en spelare som redan äger
 * målet) eller efter SL:s godkännande av ett väntande anfallskort — se
 * Spelar-anfall-planen, 2026-08-21.
 *
 * @param {object} result Returvärdet från `resolveAttack()`.
 * @param {object} ctx
 * @param {Actor}  ctx.attacker
 * @param {Actor}  ctx.target
 * @param {Item}   [ctx.weapon]      Måste ha `.update` om `pending.wear.side === "attacker"`.
 * @param {Item}   [ctx.parryItem]   Måste ha `.update` om `pending.wear.side === "defender"`.
 * @returns {Promise<{totalAfter:number, locationState:object, effect:object, pulled:boolean}|null>}
 *   Den FAKTISKA (inte förhandsvisade) skadeupplösningen, om någon skada skrevs.
 */
export async function applyAttackResult(result, { attacker, target, weapon = null, parryItem = null }) {
  const p = result?.pending ?? {};

  if (p.attackerEp) {
    const item = attacker?.items.get(p.attackerEp.skillId);
    if (item) await awardItemEp(item, p.attackerEp.amount);
  }
  if (p.defenderEp) {
    const item = target?.items.get(p.defenderEp.skillId);
    if (item) await awardItemEp(item, p.defenderEp.amount);
  }
  if (p.wear) {
    const item = p.wear.side === "attacker" ? weapon : parryItem;
    if (item?.id === p.wear.itemId && typeof item.update === "function") {
      await item.update({ "system.baseValue": p.wear.newBaseValue });
    }
  }
  if (p.damage) {
    if (p.damage.detailed) await ensureHitLocations(target);
    return applyLocationDamage(target, p.damage.location, p.damage.amount, { intent: p.damage.intent });
  }
  return null;
}

const OUTCOME_LABEL = { perfekt: "Perfekt!", lyckat: "Lyckat", misslyckat: "Misslyckat", fummel: "Fummel!" };
const VERDICT_NOTE = {
  ingenting: "Ingenting händer — fortsätt med nästa attack",
  parerat: "Pareringen höll — anfallet är slut (SLB s.31)",
  vapenslitage: "Pareringen tog emot ett misslyckat hugg — anfallarens vapen slits"
};

/**
 * Bygger mallkontexten för stridskortet. Godkännande-/avvisningshooken
 * (`dode.mjs`s `renderChatMessageHTML`, Spelar-anfall-planen 2026-08-21)
 * manipulerar det REDAN renderade kortets DOM direkt i stället för att
 * rendera om via den här funktionen — se hookens egen kommentar för varför
 * (kräver inte att `result` sparas i sin helhet, bara `pending`).
 */
function buildAttackCardContext(result, { attacker, target, weapon, parryItem, ranged, pendingBanner = false }) {
  const parts = Object.entries(result.mods ?? {}).map(([k, v]) => ({
    label: k, value: v, positive: v > 0
  }));
  if (result.aimed) parts.push({ label: "riktat", value: -5, positive: false });

  return {
    attackerName: attacker.name,
    // ⚠ Rättad 2026-08-21 (Johans fynd mitt i en liveverifiering — kortet
    // visade ett rått "Totala KP kvar: -1" utan att säga VEMS KP, tolkades
    // som anfallarens egna). `target` fanns redan tillgängligt i `postAttackCard`s
    // anropare (attack-dialog.mjs), bara aldrig vidarebefordrat hit — samma
    // gap fanns i BÅDA direkt-tillämpningsgrenen och (delvis) den väntande.
    targetName: target?.name ?? "",
    weaponName: weapon?.name ?? "Obeväpnad",
    weaponImg: weapon?.img ?? attacker.img,
    aimed: result.aimed,
    intentBedova: result.intent === "bedova",
    fv: result.fv, base: result.fv - result.modTotal, clParts: parts,
    attackRoll: result.attack.roll.total,
    attackOutcome: result.attack.outcome,
    attackOutcomeLabel: OUTCOME_LABEL[result.attack.outcome],
    hasParry: !!result.parry.roll,
    parryRoll: result.parry.roll?.total,
    parryOutcome: result.parry.outcome,
    parryOutcomeLabel: OUTCOME_LABEL[result.parry.outcome],
    parryItemName: parryItem?.name ?? "",
    ranged,
    locationLabel: result.location?.label,
    damage: result.damage?.roll ? {
      rolled: result.damage.roll.total, abs: result.damage.abs,
      applied: result.damage.applied, maximised: result.damage.maximised,
      // Kreaturstyp-/vapenmaterialmotstånd (backlog 84) — se resolveAttack().
      resistanceBlocked: result.damage.resistance?.blocked ?? false,
      resistanceReduction: result.damage.resistance?.reduction ?? 0,
      resistanceHalved: result.damage.resistance?.halved ?? false,
      resistanceDoubled: result.damage.resistance?.doubled ?? false
    } : null,
    totalAfter: result.totalAfter, pulled: result.pulled,
    effect: result.effect, wear: result.wear, cleanKnockout: result.cleanKnockout,
    verdictNote: VERDICT_NOTE[result.verdict.result] ?? "",
    // Fummeltabell-dragning (Fas 6, 2026-08-21) — se resolveAttack().
    fummelDraw: result.fummelDraw ? {
      primaryName: result.fummelDraw.primary?.name, primaryText: result.fummelDraw.primary?.description,
      extra: (result.fummelDraw.extra ?? []).map((r) => ({ name: r?.name, text: r?.description }))
    } : null,
    cssClass: result.attack.outcome,
    // ⚠ EP-streck för anfalls- och pareringsslaget var för sig — se
    // computeSkillEp(). Ett lyckat parerat anfall kan alltså visa BÅDA.
    attackEp: result.attackEp, parryEp: result.parryEp,
    // Kättingvapen/Piska (SB s.33) — se resolveAttack.
    hardParrySelfFumble: result.hardParrySelfFumble ? {
      roll: result.hardParrySelfFumble.roll.total,
      fumbled: result.hardParrySelfFumble.fumbled
    } : null,
    // Spelar-anfall-planen, 2026-08-21 — se dode.mjs's renderChatMessageHTML-hook.
    pendingBanner,
    // Kreaturstyp+mål-varning, 2026-09-03 — se resolveAttack().
    targetWarning: result.targetWarning ?? null
  };
}

/**
 * Postar stridskortet. Följer stridsdiagrammets ordning (SLB s.31) uppifrån och
 * ned, så att bordet kan följa med i samma sekvens som boken.
 *
 * ⚠ Alla tärningar bifogas `rolls` så att Dice So Nice animerar dem — OAVSETT
 * `pending`. Spelar-anfall-planen, 2026-08-21: känslan av "jag slog mina
 * tärningar" avgörs av NÄR kortet postas (nu, på anropande klient), inte av
 * VEM som senare skriver undan resultatet — se `applyAttackResult`.
 *
 * @param {object} [o]
 * @param {Actor}  [o.target]  Målets namn visas alltid på kortet (se
 *   `targetName`, rättat 2026-08-21) — och sparas dessutom i kortets flagga
 *   när `pending` är sant, så godkännande-hooken kan återskapa
 *   `applyAttackResult`s kontext utan att behöva gissa vilket mål kortet gällde.
 * @param {boolean}[o.pending] Sant när den anropande användaren INTE har
 *   skrivbehörighet på målet — kortet visar ett väntar-band + Godkänn/Avvisa
 *   i stället för att vara ett färdigt resultat.
 */
export async function postAttackCard(result, { attacker, target = null, weapon, parryItem, ranged, pending = false }) {
  const content = await renderTemplate(
    "systems/drakar-och-demoner-expert/templates/chat/attack-card.hbs",
    buildAttackCardContext(result, { attacker, target, weapon, parryItem, ranged, pendingBanner: pending })
  );

  // ⚠ Rullflaggor + tvådelad postning (mirror av spell.mjs:s postSpellCard,
  // 2026-08-21 — se den funktionens kommentar för hela resonemanget/historien
  // bakom "en riktig paus utan dubbel-animation"-mönstret). Anfallsrullen
  // postas EGET/DIREKT, en riktig paus väntas ut, sedan det fulla kortet med
  // de ÅTERSTÅENDE rullarna — aldrig samma Roll-instans i två meddelanden.
  result.attack.roll.options.flavor = "Anfall";
  const restRolls = [];
  if (result.parry.roll) { result.parry.roll.options.flavor = "Parering"; restRolls.push(result.parry.roll); }
  if (result.hardParrySelfFumble) { result.hardParrySelfFumble.roll.options.flavor = "Självfummelkontroll"; restRolls.push(result.hardParrySelfFumble.roll); }
  if (result.damage?.roll) { result.damage.roll.options.flavor = "Skada"; restRolls.push(result.damage.roll); }
  if (result.cleanKnockout?.roll) restRolls.push(result.cleanKnockout.roll);
  if (result.attackEp?.roll) restRolls.push(result.attackEp.roll);
  if (result.parryEp?.roll) restRolls.push(result.parryEp.roll);
  if (result.fummelDraw?.rolls) {
    for (const r of result.fummelDraw.rolls) r.options.flavor = "Fummeltabell";
    restRolls.push(...result.fummelDraw.rolls);
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="dode-chat-card"><p>🎲 <strong>${attacker.name}</strong> anfaller... <strong>${result.attack.roll.total}</strong> — ${OUTCOME_LABEL[result.attack.outcome]}</p></div>`,
    rolls: [result.attack.roll],
    sound: CONFIG.sounds.dice
  });
  if (restRolls.length) await new Promise((r) => setTimeout(r, 900));

  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content, rolls: restRolls, sound: restRolls.length ? CONFIG.sounds.dice : null
  };

  if (pending) {
    // ⚠ Bara `result.pending` behövs för `applyAttackResult` — inga Roll-
    // instanser, redan ren JSON-data (se resolveAttack()s pending-fält).
    // `weapon`/`parryItem` återskapas vid godkännande ur `pending.wear.itemId`
    // + `side` (se dode.mjs-hooken), behöver inte sparas separat här.
    // ⚠ `Uuid`, INTE ett bart aktörs-id (rättat 2026-08-21, hittat under
    // Magisystem-passets Fas 3-liveverifiering, se motsvarande fix i
    // spell.mjs/dode.mjs samma dag): för en OLÄNKAD NPC-token är `target.id`
    // BASE-aktörens id, delat av ALLA tokens av samma NPC på kartan —
    // `game.actors.get(id)` i godkännande-hooken hade då alltid skrivit till
    // bas-aktören, INTE den specifika token-instans som faktiskt målsattes
    // och förhandsvisades. `target.uuid` kodar scen+token-vägen för olänkade
    // tokens (`Scene.<id>.Token.<id>.Actor.<id>`) och löses tillbaka med
    // `fromUuidSync` — samma objekt som förhandsvisningen räknade mot.
    messageData.flags = {
      [game.system.id]: {
        pendingAttack: {
          pending: result.pending,
          attackerUuid: attacker.uuid,
          targetUuid: target?.uuid ?? null,
          ranged,
          processed: false
        }
      }
    };
  }

  return ChatMessage.create(messageData);
}
