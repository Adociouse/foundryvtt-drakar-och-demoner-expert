/** Kompendielista + dokumenttyp, delad av unpack-all.mjs och pack-all.mjs. */
export const PACKS = [
  { name: "raser", type: "Item" },
  { name: "yrken", type: "Item" },
  { name: "vapen-utrustning", type: "Item" },
  { name: "besvarjelser", type: "Item" },
  // SL-only, se system.json's ownership + DESIGN_DECISIONS.md §7.4.
  { name: "magiska-foremal", type: "Item" },
  { name: "monster", type: "Actor" },
  { name: "handlare", type: "Actor" }
];
