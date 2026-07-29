/** Kompendielista + dokumenttyp, delad av unpack-all.mjs och pack-all.mjs. */
export const PACKS = [
  { name: "raser", type: "Item" },
  { name: "yrken", type: "Item" },
  { name: "vapen-utrustning", type: "Item" },
  { name: "besvarjelser", type: "Item" },
  // SL-only, se system.json's ownership + DESIGN_DECISIONS.md §7.4.
  { name: "magiska-foremal", type: "Item" },
  { name: "monster", type: "Actor" },
  { name: "handlare", type: "Actor" },
  // Regeltabeller — ett pack per dokumenttyp OCH per publik, se §8.3:
  // `type` är ett enda värde per pack, och ownership sitter på pack-nivå.
  { name: "regler", type: "JournalEntry" },
  { name: "tabeller", type: "RollTable" },
  { name: "sl-regler", type: "JournalEntry" },
  // Generiska platser — se DESIGN_DECISIONS.md §7.3: systemnivå betyder
  // spoilerfritt och äventyrsoberoende. Äventyrsscener hör hemma i modulen.
  { name: "scener", type: "Scene" }
];
