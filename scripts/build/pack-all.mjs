import { execFileSync } from "node:child_process";
import { PACKS } from "./packs.config.mjs";

/**
 * Kompilerar alla packs/<namn>/_source/*.json (källformat) till packs/<namn> (LevelDB) —
 * det Foundry faktiskt läser vid körning. Kör detta efter att ha redigerat källfilerna.
 *
 * VIKTIGT: kör aldrig detta medan Foundry-servern är igång och har systemet öppet —
 * se memory.md "Kompendiebyggnad via CLI" och fas 4-gotchan om stale LevelDB-cache.
 */
for (const { name, type } of PACKS) {
  console.log(`\n--- Packar ${name} (${type}) ---`);
  execFileSync("npx", ["fvtt", "package", "pack", name, "-t", type, "-v"], { stdio: "inherit", shell: true });
}
