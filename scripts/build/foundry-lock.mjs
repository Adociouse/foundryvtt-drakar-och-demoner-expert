/**
 * Koordinerar Foundry-omstarter/packningar mellan FLERA samtidiga Claude Code-
 * sessioner (interaktiva + cowork/dispatch) som delar samma arbetskatalog.
 *
 * Bakgrund: 2026-09-02 hittades `lost/`-mappar (LevelDB-korruptionsreparation)
 * i VARJE pack, orsakade av att två sessioner stoppade/packade/startade
 * Foundry överlappande — samma dag missade dessutom en session i flera timmar
 * att `packs/journaler` aldrig packades om efter att en annan sessions commits
 * lagt till nytt innehåll, helt tyst. Se memory.md/CLAUDE.md för hela historien.
 *
 * Lånefilen `.foundry-restart.lock` (repo-roten, gitignorad) är sanningskällan
 * för "någon håller redan på". Atomär skapelse (`flag:"wx"`) förhindrar en
 * race mellan kontroll och skrivning.
 *
 * Användning:
 *   node scripts/build/foundry-lock.mjs acquire "<anledning>" [--force]
 *   node scripts/build/foundry-lock.mjs release [--force]
 *   node scripts/build/foundry-lock.mjs status
 *
 * Exit-koder: 0 = OK/låset ditt, 1 = blockerad av en annan AKTIV session.
 * `acquire` skriver låsinfo till stdout som JSON oavsett utfall, så en
 * anropande agent kan läsa vem som håller det och varför utan att parsa text.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCK_PATH = path.resolve(__dirname, "../../.foundry-restart.lock");
const STALE_MS = 20 * 60 * 1000; // 20 minuter — en hel stopp/packa/starta/verifiera-cykel har hittills tagit under 15.

const SESSION_ID =
  process.env.CLAUDE_CODE_SESSION_ID || process.env.CLAUDE_SESSION_ID || `unknown-${process.pid}`;

function readLock() {
  try {
    return JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    // Trasig/halvskriven låsfil — behandla som frånvarande, men flagga den.
    console.error(`⚠ Låsfilen finns men gick inte att tolka (${err.message}) — behandlas som ledig.`);
    return null;
  }
}

function isStale(lock) {
  return Date.now() - new Date(lock.acquiredAt).getTime() > STALE_MS;
}

function describe(lock) {
  const ageMin = Math.round((Date.now() - new Date(lock.acquiredAt).getTime()) / 60000);
  return `session ${lock.sessionId} (pid ${lock.pid} på ${lock.host}), sedan ${lock.acquiredAt} (${ageMin} min sedan) — "${lock.reason}"`;
}

function acquire(reason, force) {
  if (!reason) {
    console.error('Användning: acquire "<anledning>" [--force]');
    process.exit(2);
  }
  const existing = readLock();
  if (existing && existing.sessionId === SESSION_ID) {
    console.log(JSON.stringify({ ok: true, note: "redan din egen session", lock: existing }, null, 1));
    return;
  }
  if (existing && !force) {
    if (isStale(existing)) {
      console.error(`⚠ Hittade ett gammalt, sannolikt övergivet lås — ${describe(existing)}. Tar över automatiskt (åldern överstiger ${STALE_MS / 60000} min).`);
    } else {
      console.log(
        JSON.stringify(
          { ok: false, blocked: true, lock: existing, message: `Blockerad — ${describe(existing)}` },
          null,
          1
        )
      );
      process.exit(1);
    }
  }
  const lock = {
    sessionId: SESSION_ID,
    pid: process.pid,
    host: os.hostname(),
    reason,
    acquiredAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 1) + "\n", { flag: force ? "w" : "wx" });
  } catch (err) {
    if (err.code === "EEXIST") {
      // Race: någon annan hann skriva mellan vår kontroll och vårt skrivförsök.
      const winner = readLock();
      console.log(
        JSON.stringify(
          { ok: false, blocked: true, lock: winner, message: `Blockerad (race) — ${describe(winner)}` },
          null,
          1
        )
      );
      process.exit(1);
    }
    throw err;
  }
  console.log(JSON.stringify({ ok: true, lock }, null, 1));
}

function release(force) {
  const existing = readLock();
  if (!existing) {
    console.log(JSON.stringify({ ok: true, note: "inget lås fanns" }, null, 1));
    return;
  }
  if (existing.sessionId !== SESSION_ID && !force) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          message: `Vägrar släppa — låset ägs av en annan session (${describe(existing)}). Använd --force bara om du är säker på att den sessionen är död.`,
        },
        null,
        1
      )
    );
    process.exit(1);
  }
  fs.rmSync(LOCK_PATH, { force: true });
  console.log(JSON.stringify({ ok: true, released: existing }, null, 1));
}

function status() {
  const existing = readLock();
  if (!existing) {
    console.log(JSON.stringify({ held: false }, null, 1));
    return;
  }
  console.log(
    JSON.stringify({ held: true, stale: isStale(existing), mine: existing.sessionId === SESSION_ID, lock: existing }, null, 1)
  );
}

const [, , cmd, arg, flag] = process.argv;
const force = process.argv.includes("--force");

switch (cmd) {
  case "acquire":
    acquire(arg, force);
    break;
  case "release":
    release(force);
    break;
  case "status":
    status();
    break;
  default:
    console.error("Användning: node scripts/build/foundry-lock.mjs <acquire \"<anledning>\"|release|status> [--force]");
    process.exit(2);
}
