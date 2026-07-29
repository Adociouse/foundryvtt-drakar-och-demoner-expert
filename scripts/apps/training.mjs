import DoDETrainingBase from "./training-base.mjs";
import { skillCap, isSchool } from "../helpers/training.mjs";

/**
 * Färdighetsträning — RP s.63 "Hur man blir bättre".
 *
 * ⚠ Magiskolor och besvärjelser hör INTE hemma här utan i `magic-training.mjs`.
 * SB s.7 ger dem andra EP-källor (skolor: bara lärare; besvärjelser: kodex vid
 * ensamträning) och en annan slagmekanik.
 */
export default class DoDETrainingApp extends DoDETrainingBase {
  static DEFAULT_OPTIONS = {
    id: "dode-training-{id}",
    window: { title: "Färdighetsträning" }
  };

  static PARTS = {
    body: { template: "systems/drakar-och-demoner-expert/templates/apps/training.hbs" }
  };

  get title() {
    return `Färdighetsträning — ${this.actor.name}`;
  }

  get trainableItems() {
    return this.actor.items.filter((i) => i.type === "fardighet" && !isSchool(i));
  }

  describeRow(item) {
    const fv = item.system.fv;
    const { cap, hard } = skillCap(item, this.actor);
    const cappedOut = cap !== null && fv >= cap;
    const attrLabel = item.system.attribute.toUpperCase();
    const attrValue = this.actor.system.attributes?.[item.system.attribute]?.total ?? 0;

    return {
      ...this.buildRow({
        item,
        label: item.name,
        current: fv,
        cost: CONFIG.DODE.skillCost(item.system.costTier, fv, fv + 1),
        own: item.system.ep?.available ?? 0,
        canUseOwn: true,
        valueField: "system.fv",
        target: attrValue,
        targetLabel: `${attrLabel} ${attrValue}`,
        note: CONFIG.DODE.costTiers[item.system.costTier]
          ? game.i18n.localize(CONFIG.DODE.costTiers[item.system.costTier])
          : "",
        canTrainInMode: !cappedOut,
        // ⚠ Två olika tak (RP s.63): sekundära och kategori B kan ALDRIG passera
        // grundegenskapen; primära och yrkesfärdigheter kan passera den, men bara
        // genom äventyrserfarenhet — aldrig genom träning.
        trainNote: cappedOut
          ? (hard
            ? `⚠ Tak: ${attrLabel} ${cap}. Sekundära och kategori B kan aldrig passera grundegenskapen (RP s.63)`
            : `⚠ Träningstak: ${attrLabel} ${cap}. Högre FV måste komma från äventyrserfarenhet (RP s.63)`)
          : ""
      }),
      attrLabel,
      attrValue,
      cap,
      hardCap: hard,
      cappedOut
    };
  }
}
