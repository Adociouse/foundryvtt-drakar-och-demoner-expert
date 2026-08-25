import DoDETrainingBase from "./training-base.mjs";
import { isSchool, spellSoloTarget } from "../helpers/training.mjs";

/**
 * Magiträning — **Spelarboken s.7 "Att bli bättre i magi"**.
 *
 * ⚠ Eget fönster därför att EP-källorna skiljer sig från vanliga färdigheter,
 * inte bara kostnaderna:
 *
 * | | Ensamträning | Med lärare | Äventyr |
 * |---|---|---|---|
 * | **Magiskola (FV)** | **NEJ** | **ja — enda källan** | **NEJ** |
 * | **Besvärjelse (S)** | ja — kräver **magisk kodex** | ja | ja |
 *
 * SB s.7: "Att skaffa sig FV i magiskolor fungerar som för vanliga färdigheter,
 * men man kan endast få erfarenhetspoäng genom träning med lärare; ej genom
 * ensamträning eller erfarenhet."
 *
 * ⚠ Ensamtränad besvärjelse slår **inte** ett vanligt grundegenskapsslag: man
 * slår mot INT men får **+1 på tärningen per poäng INT under 19** — ett straff.
 * Bokens exempel: INT 15 ger +4 och kräver alltså 11 eller lägre. Med lärare
 * gäller vanliga färdighetsregler, alltså ett rent INT-slag.
 *
 * ⚠ Ensamträning kräver dessutom en **magisk kodex** för just den besvärjelsen
 * (20-30 sidor handskriven text) och tillräckligt högt FV i besvärjelsens skola.
 */
export default class DoDEMagicTrainingApp extends DoDETrainingBase {
  static DEFAULT_OPTIONS = {
    id: "dode-magic-training-{id}",
    window: { title: "Magiträning" }
  };

  static PARTS = {
    body: { template: "systems/drakar-och-demoner-expert/templates/apps/magic-training.hbs" }
  };

  get title() {
    return `Magiträning — ${this.actor.name}`;
  }

  get trainableItems() {
    return this.actor.items.filter((i) => isSchool(i) || i.type === "besvarjelse");
  }

  /**
   * Delar upp raderna i skolor och besvärjelser — de visas i skilda avsnitt med
   * var sin regelförklaring, eftersom EP-källorna skiljer sig (SB s.7).
   */
  async _prepareContext() {
    const context = await super._prepareContext();
    context.schools = context.rows.filter((r) => r.isSchool);
    context.spells = context.rows.filter((r) => r.isSpell);
    return context;
  }

  /** Rollpersonens FV i en given magiskola, eller 0 om hen inte kan skolan. */
  schoolFv(school) {
    const item = this.actor.items.find(
      (i) => i.type === "fardighet" && i.system.skillKey === `magiskola-${school}`
    );
    return item?.system.total ?? 0;
  }

  /** Rollpersonens högsta skolvärde, oavsett skola. */
  bestSchoolFv() {
    return this.actor.items
      .filter((i) => i.type === "fardighet" && i.system.skillKey?.startsWith("magiskola-"))
      .reduce((best, i) => Math.max(best, i.system.total ?? 0), 0);
  }

  /**
   * Kostnadsgrundande skolvärde för en besvärjelse.
   *
   * ⚠ "allman" är ingen skola man kan lära sig — Formelbokens "Allmänna
   * besvärjelser" (tryckt s.1-4) kan läras av vilken magiker som helst oavsett
   * skoltillhörighet. Beslut: de ska kunna väljas av ALLA skolor. Ett uppslag
   * på `magiskola-allman` hade alltid gett 0 och därmed blockerat dem för alla,
   * så för dem används i stället rollpersonens HÖGSTA skolvärde — hen behöver
   * kunna någon skola, men det spelar ingen roll vilken.
   */
  spellSchoolFv(item) {
    return item.system.school === "allman"
      ? this.bestSchoolFv()
      : this.schoolFv(item.system.school);
  }

  /** Etikett för besvärjelsens skola — "allman" saknar post i DODE.magicSchools. */
  spellSchoolLabel(item) {
    if (item.system.school === "allman") return "Allmän besvärjelse (högsta skolvärdet)";
    return game.i18n.localize(CONFIG.DODE.magicSchools[item.system.school]);
  }

  describeRow(item) {
    const int = this.actor.system.attributes?.int?.total ?? 0;

    if (isSchool(item)) {
      const fv = item.system.fv;
      return {
        ...this.buildRow({
          item,
          label: item.name,
          current: fv,
          cost: CONFIG.DODE.magicSchoolCost(fv, fv + 1),
          // ⚠ Skolan tjänar aldrig egna streck (varken ensam eller genom äventyr),
          // så potten kan aldrig betala — bara fria bonuspoäng och EP från
          // lärarpass, som landar i potten.
          own: item.system.ep?.available ?? 0,
          canUseOwn: true,
          valueField: "system.fv",
          target: int,
          targetLabel: `INT ${int}`,
          note: "Endast träning med lärare — varken ensamträning eller äventyr ger EP (SB s.7)"
        }),
        isSchool: true,
        int
      };
    }

    // Besvärjelse.
    const schoolFv = this.spellSchoolFv(item);
    const s = item.system.sValue;
    const hasCodex = !!item.system.hasCodex;
    const soloTarget = spellSoloTarget(int);
    const solo = this.mode === "ensam";
    // ⚠ FV i skolan måste räcka till besvärjelsens skolvärde innan den kan läras
    // alls (SB s.5 "Skolvärde"), och ensamträning kräver kodex utöver det.
    const schoolTooLow = schoolFv < item.system.sValue && schoolFv === 0;
    const blockedSolo = solo && !hasCodex;

    return {
      ...this.buildRow({
        item,
        label: item.name,
        current: s,
        cost: schoolFv ? CONFIG.DODE.spellCost(schoolFv, s, s + 1) : 0,
        own: item.system.ep?.available ?? 0,
        canUseOwn: true,
        valueField: "system.sValue",
        target: solo ? soloTarget : int,
        targetLabel: solo ? `INT ${int} med +${Math.max(0, 19 - int)} på tärningen (≤ ${soloTarget})` : `INT ${int}`,
        blocked: !schoolFv,
        canTrainInMode: !blockedSolo && !schoolTooLow,
        note: schoolFv
          ? `${this.spellSchoolLabel(item)} FV ${schoolFv} → grundkostnad ${CONFIG.DODE.spellBaseCost(schoolFv)}`
          : (item.system.school === "allman"
              ? "⚠ Rollpersonen kan ingen magiskola alls — allmänna besvärjelser kräver minst en skola"
              : "⚠ Rollpersonen saknar färdighet i besvärjelsens skola — ingen kostnadsgrund"),
        trainNote: blockedSolo
          ? "⚠ Ensamträning kräver en magisk kodex för besvärjelsen (SB s.7)"
          : (solo && soloTarget <= 0 ? `⚠ INT ${int} ger måltal ${soloTarget} — ensamträning omöjlig` : "")
      }),
      isSpell: true,
      hasCodex,
      schoolFv,
      int,
      soloTarget,
      soloPenalty: Math.max(0, 19 - int)
    };
  }
}
