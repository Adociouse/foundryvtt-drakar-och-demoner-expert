import { execFileSync } from "node:child_process";
import { PACKS } from "./packs.config.mjs";

/**
 * Packar upp alla kompendier från packs/<namn> (LevelDB) till packs/<namn>/_source/*.json
 * (läsbart, git-diffbart källformat). Kräver att `npx fvtt configure set dataPath <sökväg>`
 * körts en gång per maskin — se memory.md "Kompendiebyggnad via CLI".
 *
 * VIKTIGT: kör aldrig detta medan Foundry-servern är igång och har systemet öppet —
 * LevelDB-filerna får inte läsas samtidigt av två processer (se memory.md, fas 4-gotchan).
 */
for (const { name, type } of PACKS) {
  console.log(`\n--- Packar upp ${name} (${type}) ---`);
  execFileSync("npx", ["fvtt", "package", "unpack", name, "-t", type, "-v"], { stdio: "inherit", shell: true });
}
