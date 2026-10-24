#!/usr/bin/env node
// THE TEAM SANDBOX (canon 0.30.542). The owner, 2026-10-24: a teammate must be
// able to try an idea, see the change, and pass it back in a form the team can
// easily build in, from a current sandbox that needs no setting up each time.
// His picks: the teammate's own PC with one command, a canned instance of live
// data, and a patch file in a shared folder.
//
// From the repo's top folder (the one holding app, canon and tools):
//
//   node tools/sandbox/sandbox.mjs setup --can <snapshot folder> --ideas <ideas folder> --name <first name>
//   node tools/sandbox/sandbox.mjs start              today's main on the canned data, http://localhost:8787
//   node tools/sandbox/sandbox.mjs start --keep       the same, keeping the change in progress
//   node tools/sandbox/sandbox.mjs handback "<idea title>"
//   node tools/sandbox/sandbox.mjs reset --yes        throw the change away and start clean
//   node tools/sandbox/sandbox.mjs status
//   node tools/sandbox/sandbox.mjs can <snapshot folder>   rebuild the canned data from a newer snapshot
//   node tools/sandbox/sandbox.mjs pack <snapshot> <can>  (the owner) a scrubbed copy of a snapshot to share
//
// THE SANDBOX LAW: it works on a local branch named sandbox that it resets to
// origin/main; it never pushes, merges, touches main or deploys; wrangler runs
// with --local only; the canned data lives in app/.sandbox-persist (ignored by
// git) and never leaves this computer.
// THE CAN SCRUB: the canned copy never carries the live PINs (every PIN reads
// 0000), the SensorPush tokens, anyone's phone or email, the drivers' license
// numbers and plates, or the raw uploaded files. pack applies it to the files
// the owner shares, and the build applies it again to the database.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const APP = path.join(ROOT, "app");
const MIGRATIONS = path.join(APP, "migrations");
const WRANGLER_JS = path.join(APP, "node_modules", "wrangler", "bin", "wrangler.js");
const LOCAL = path.join(HERE, "sandbox.local.json");
const IDEA = path.join(HERE, "IDEA.md");
const IDEA_TEMPLATE = path.join(HERE, "IDEA_TEMPLATE.md");
const SHOTS = path.join(HERE, "shots");
const PERSIST_NAME = ".sandbox-persist";
const NEXT_NAME = ".sandbox-next-persist";
const PERSIST = path.join(APP, PERSIST_NAME);
const NEXT = path.join(APP, NEXT_NAME);
const CAN_INFO = "sandbox-can.json";
const BRANCH = "sandbox";
const DB = "gripfactory-lite-local";
const DEFAULT_PORT = 8787;
const SANDBOX_PIN = "0000";
const PIN_KEY = /(^|_)pin$/i;
const PATCH_LIMIT_MB = 20;
const STREAM_FROM_BYTES = 64 * 1024 * 1024;
// THE CAN SCRUB: tables left empty, and columns blanked wherever they appear.
const EMPTY_TABLES = ["sensorpush_auth"];
const BLANK_COLUMNS = [/^(?:.*_)?email$/i, /^(?:.*_)?phone$/i, /_license_number$/i, /^driver_occupational_license$/i, /_plate$/i];
const BLANK_EXACT = [["import_queue", "content"]];
/** True when the scrub blanks this field: by its name in any table, or by name in its table. */
export function blankHit(table, column) {
  return BLANK_COLUMNS.some((re) => re.test(String(column))) || BLANK_EXACT.some(([t, c]) => t === table && c === column);
}
// A sandbox change belongs in the app's code, tests and assets; these paths are the team's.
const TEAM_PATHS = [/^canon\//, /^BRIEFS\//, /^SESSION_REPORTS\//, /^\.github\//, /^app\/wrangler\.toml$/, /^app\/migrations\//, /^app\/package(-lock)?\.json$/];
const WRANGLER_ENV = { ...process.env, CI: "1", BROWSER: "none", WRANGLER_SEND_METRICS: "false" };

// ---------------------------------------------------------------- words

function say(text) {
  console.log(`[sandbox] ${text}`);
}

function fail(text) {
  console.error(`[sandbox] ${text}`);
  process.exit(1);
}

// ---------------------------------------------------------------- paths

function normPath(p) {
  let out = path.resolve(p);
  try {
    out = fs.realpathSync.native(out);
  } catch {
    // A path that does not exist yet keeps its resolved form.
  }
  return process.platform === "win32" ? out.toLowerCase() : out;
}

function samePath(a, b) {
  return normPath(a) === normPath(b);
}

/** True when child is parent itself or sits anywhere under it. */
function inside(parent, child) {
  const rel = path.relative(normPath(parent), normPath(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** A path argument without the stray quote a trailing backslash leaves on Windows. */
function cleanArg(value) {
  return value == null ? value : String(value).trim().replace(/^"+|"+$/g, "");
}

// ---------------------------------------------------------------- runners

function git(args, { allowFail = false, keepIndent = false } = {}) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) fail(`Git is not installed or not on the PATH (${r.error.message}).`);
  if (r.status !== 0 && !allowFail) fail(`git ${args.join(" ")} failed:\n${(r.stderr || r.stdout || "").trim()}`);
  const out = r.stdout || "";
  return { ok: r.status === 0, out: keepIndent ? out.trimEnd() : out.trim(), err: (r.stderr || "").trim() };
}

/** npm is npm.cmd on Windows, so it runs through the shell. */
function npm(args) {
  const r = spawnSync(`npm ${args}`, { cwd: APP, shell: true, env: WRANGLER_ENV, stdio: "inherit" });
  if (r.status !== 0) fail(`npm ${args} failed (exit ${r.status}).`);
}

/** wrangler from the app's own packages, run by this Node with no shell between. */
function wrangler(args, { quiet = false } = {}) {
  const r = spawnSync(process.execPath, [WRANGLER_JS, ...args], {
    cwd: APP,
    env: WRANGLER_ENV,
    encoding: "utf8",
    stdio: quiet ? "pipe" : "inherit",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) fail(`wrangler could not start (${r.error.message}).`);
  if (r.status !== 0) {
    const tail = quiet ? `\n${((r.stdout || "") + (r.stderr || "")).trim().slice(-2000)}` : "";
    fail(`wrangler ${args.slice(0, 3).join(" ")} failed (exit ${r.status}).${tail}`);
  }
  return quiet ? `${r.stdout || ""}${r.stderr || ""}` : "";
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen({ port, host: "127.0.0.1" }, () => server.close(() => resolve(true)));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ port: 0, host: "127.0.0.1" }, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** node:sqlite, without its experimental notice; null when this Node lacks it. */
async function loadSqlite() {
  const emit = process.emitWarning;
  process.emitWarning = (warning, ...rest) => (/sqlite/i.test(String(warning?.message ?? warning)) ? undefined : emit.call(process, warning, ...rest));
  try {
    return await import("node:sqlite");
  } catch {
    return null;
  } finally {
    process.emitWarning = emit;
  }
}

// ---------------------------------------------------------------- settings

function readLocal() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL, "utf8"));
  } catch {
    return null;
  }
}

function needLocal() {
  const cfg = readLocal();
  if (!cfg) fail("Run setup first: node tools/sandbox/sandbox.mjs setup --can <snapshot folder> --ideas <ideas folder> --name <first name>");
  return cfg;
}

function writeLocal(cfg) {
  fs.writeFileSync(LOCAL, `${JSON.stringify(cfg, null, 2)}\n`);
}

function flag(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const value = args[i + 1];
  if (value == null || value.startsWith("--")) fail(`${name} needs a value.`);
  return cleanArg(value);
}

function portFlag(args) {
  const raw = flag(args, "--port");
  if (raw == null) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) fail("--port needs a number from 1024 to 65535.");
  return port;
}

// ---------------------------------------------------------------- the repo

function requireRepo() {
  if (!fs.existsSync(path.join(APP, "wrangler.toml"))) fail(`This does not look like the GripFactory Lite repo (no app/wrangler.toml under ${ROOT}).`);
  const top = git(["rev-parse", "--show-toplevel"]).out;
  if (!samePath(top, ROOT)) fail(`Run this inside the repo at ${ROOT}.`);
}

function currentBranch() {
  return git(["branch", "--show-current"]).out;
}

function hasOriginMain() {
  return git(["rev-parse", "--verify", "--quiet", "origin/main"], { allowFail: true }).ok;
}

function dirtyFiles() {
  const out = git(["status", "--porcelain"]).out;
  return out ? out.split("\n").filter(Boolean) : [];
}

/** Commits on the sandbox branch that main does not have (a reset to main would drop them). */
function sandboxCommits() {
  if (currentBranch() !== BRANCH || !hasOriginMain()) return 0;
  return Number(git(["rev-list", "--count", "origin/main..HEAD"]).out) || 0;
}

function changeInProgress() {
  const files = dirtyFiles().length;
  const commits = sandboxCommits();
  const parts = [];
  if (files) parts.push(`${files} changed file(s)`);
  if (commits) parts.push(`${commits} commit(s) not on main`);
  return parts.join(" and ");
}

function baseCommit() {
  if (!hasOriginMain()) fail("This copy has no origin/main yet. Run start once first.");
  return git(["merge-base", "HEAD", "origin/main"]).out;
}

function refreshToMain() {
  say("Fetching the current main from GitHub.");
  git(["fetch", "origin", "main"]);
  const waiting = changeInProgress();
  if (waiting) fail(`You have a change in progress (${waiting}). Hand it back, keep it with start --keep, or throw it away with reset --yes.`);
  // No upstream on purpose: a stray git push from here has nowhere to go.
  git(["switch", "--no-track", "-C", BRANCH, "origin/main"]);
  const sha = git(["rev-parse", "--short", "HEAD"]).out;
  const when = git(["log", "-1", "--format=%cd", "--date=format:%Y-%m-%d %H:%M"]).out;
  say(`On branch ${BRANCH} at main ${sha} (${when}).`);
}

function ensurePackages() {
  const lock = path.join(APP, "package-lock.json");
  const marker = path.join(APP, "node_modules", ".sandbox-lock");
  const want = createHash("sha256").update(fs.readFileSync(lock)).digest("hex");
  const have = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim() : "";
  if (have === want && fs.existsSync(WRANGLER_JS)) return;
  say("Installing the app's packages (npm ci). This takes a minute or two after main's packages change.");
  npm("ci");
  if (!fs.existsSync(WRANGLER_JS)) fail("npm ci finished, but wrangler is not in app/node_modules.");
  fs.writeFileSync(marker, `${want}\n`);
}

function applyMigrations(persistName) {
  say("Applying any new migrations to the sandbox database.");
  wrangler(["d1", "migrations", "apply", DB, "--local", "--persist-to", persistName]);
}

// ---------------------------------------------------------------- the can

/** What each migration leaves in a snapshot: the tables it makes and the
 * columns it adds. A snapshot does not keep d1_migrations, so its own tables
 * and columns tell how far it got. */
export function migrationMarkers(files) {
  const texts = files.map((f) => ({ file: f.file, sql: f.sql.replace(/--[^\n]*/g, "") }));
  const droppedAfter = new Map();
  texts.forEach((m, i) => {
    for (const d of m.sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?/gi)) droppedAfter.set(d[1].toLowerCase(), i);
  });
  return texts.map((m, i) => {
    const tables = new Set();
    const columns = [];
    const renamed = new Map();
    for (const r of m.sql.matchAll(/ALTER\s+TABLE\s+["`]?(\w+)["`]?\s+RENAME\s+TO\s+["`]?(\w+)["`]?/gi)) renamed.set(r[1].toLowerCase(), r[2].toLowerCase());
    for (const c of m.sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/gi)) {
      const name = renamed.get(c[1].toLowerCase()) ?? c[1].toLowerCase();
      tables.add(name);
    }
    for (const a of m.sql.matchAll(/ALTER\s+TABLE\s+["`]?(\w+)["`]?\s+ADD\s+(?:COLUMN\s+)?["`]?(\w+)["`]?/gi)) {
      columns.push([a[1].toLowerCase(), a[2].toLowerCase()]);
    }
    // A table dropped in this or a later migration, and never made again, marks nothing.
    const alive = (t) => {
      const d = droppedAfter.get(t);
      if (d == null || d < i) return true;
      return texts.slice(d).some((later) => new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["\`]?${t}["\`]?\\b`, "i").test(later.sql) || new RegExp(`RENAME\\s+TO\\s+["\`]?${t}["\`]?\\b`, "i").test(later.sql));
    };
    return { file: m.file, tables: [...tables].filter(alive), columns: columns.filter(([t]) => alive(t)) };
  });
}

/** floor: the last migration whose tables or columns the snapshot shows (it and
 * every one before it ran). absent: the first one whose tables or columns the
 * snapshot lacks (it and every one after it did not). The migrations between
 * only change rows, or touch tables the snapshot holds empty, so the snapshot
 * cannot tell; the build replays them on its rows. */
export function snapshotLevels(markers, has) {
  let floor = -1;
  let absent = markers.length;
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    const seen = [...m.tables.map((t) => has.table(t)), ...m.columns.map(([t, c]) => has.column(t, c))];
    if (seen.includes(false)) {
      absent = i;
      break;
    }
    if (seen.includes(true)) floor = i;
  }
  return { floor, absent };
}

/** A migration's statements, split on the semicolons outside quotes and comments. */
export function splitSql(sql) {
  const out = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (quote) {
      cur += c;
      if (c === quote) {
        if (sql[i + 1] === quote) cur += sql[++i];
        else quote = null;
      }
      continue;
    }
    if (c === "-" && sql[i + 1] === "-") {
      const j = sql.indexOf("\n", i);
      i = j < 0 ? sql.length : j;
      cur += "\n";
      continue;
    }
    if (c === "/" && sql[i + 1] === "*") {
      const j = sql.indexOf("*/", i + 2);
      i = j < 0 ? sql.length : j + 1;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === ";") {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** One migration the snapshot cannot place, run on its rows: whole when it
 * applies, else statement by statement, keeping the ones that apply (a
 * statement that fails found its rows already in the snapshot). */
export function replayMigration(db, m) {
  db.exec("SAVEPOINT sandbox_replay");
  try {
    db.exec(m.sql);
    db.exec("RELEASE sandbox_replay");
    return `${m.file}: replayed on the snapshot's rows`;
  } catch {
    db.exec("ROLLBACK TO sandbox_replay");
    db.exec("RELEASE sandbox_replay");
  }
  if (/CREATE\s+TRIGGER/i.test(m.sql)) fail(`${m.file} makes a trigger and does not apply on the snapshot's rows; the sandbox cannot place it. Ask the Scribe for a snapshot that names its level.`);
  const statements = splitSql(m.sql);
  let kept = 0;
  for (const statement of statements) {
    db.exec("SAVEPOINT sandbox_statement");
    try {
      db.exec(statement);
      db.exec("RELEASE sandbox_statement");
      kept += 1;
    } catch {
      db.exec("ROLLBACK TO sandbox_statement");
      db.exec("RELEASE sandbox_statement");
    }
  }
  return `${m.file}: replayed in part (${kept} of ${statements.length} statements; the rest were in the snapshot already)`;
}

/** has.table and has.column for a snapshot: true, false, or null when a table
 * is empty or failed and cannot tell. keys maps each table (lower case) to the
 * columns of its first row, or null. */
export function snapshotShape(manifest, keys) {
  const byName = new Map(Object.entries(manifest.tables ?? {}).map(([t, v]) => [t.toLowerCase(), v]));
  return {
    table: (t) => byName.has(t),
    column: (t, c) => {
      const v = byName.get(t);
      if (!v) return false;
      if (v.error) return null;
      const k = keys.get(t);
      return k == null ? null : k.has(c);
    },
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** A table file's rows. A large file, or the first row alone, is read line by
 * line in the dump's own layout (JSON.stringify with an indent of 1), so no
 * table is too big to load. */
export async function* tableRows(file, { stream = fs.statSync(file).size >= STREAM_FROM_BYTES } = {}) {
  if (!stream || !inDumpLayout(file)) {
    yield* readJson(file);
    return;
  }
  const input = fs.createReadStream(file, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  const layout = () => new Error(`${path.basename(file)} breaks the dump layout`);
  try {
    let open = null;
    let first = true;
    for await (const line of lines) {
      if (first) {
        first = false;
        if (line.trim() === "[]") return;
        continue;
      }
      if (open == null) {
        if (line === " {") open = ["{"];
        else if (line === " {}" || line === " {},") yield {};
        else if (line.trim() !== "]" && line.trim() !== "") throw layout();
        continue;
      }
      if (line === " }" || line === " },") {
        open.push("}");
        yield JSON.parse(open.join("\n"));
        open = null;
      } else open.push(line);
    }
  } finally {
    lines.close();
    input.destroy();
  }
}

/** True when a file starts the way db-snapshot writes one: "[" alone on its first line, then " {". */
function inDumpLayout(file) {
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(16);
    const n = fs.readSync(fd, head, 0, head.length, 0);
    const text = head.toString("utf8", 0, n);
    return /^\[\r?\n \{/.test(text) || /^\[\]\s*$/.test(text);
  } finally {
    fs.closeSync(fd);
  }
}

/** The columns of a table file's first row (lower case), or null when it has no rows. */
export async function firstKeys(file) {
  const keysOf = (row) => new Set(Object.keys(row).map((k) => k.toLowerCase()));
  try {
    for await (const row of tableRows(file, { stream: true })) return keysOf(row);
    return null;
  } catch {
    const rows = readJson(file);
    return rows.length ? keysOf(rows[0]) : null;
  }
}

function migrationFiles() {
  return fs
    .readdirSync(MIGRATIONS)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .map((file) => ({ file, sql: fs.readFileSync(path.join(MIGRATIONS, file), "utf8") }));
}

function findSqlite(persistDir) {
  const dir = path.join(persistDir, "v3", "d1", "miniflare-D1DatabaseObject");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite") : [];
  if (files.length !== 1) fail(`Expected one database file in ${dir}, found ${files.length}.`);
  return path.join(dir, files[0]);
}

function cell(value) {
  if (value === true) return 1;
  if (value === false) return 0;
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value;
}

/** THE CAN SCRUB, on the built database. Fails closed: a column it cannot blank stops the build. */
export function scrubCan(db) {
  const done = [];
  const columnsOf = (table) => db.prepare(`SELECT name, "notnull" AS nn FROM pragma_table_info(?)`).all(table);
  for (const table of EMPTY_TABLES) {
    if (!columnsOf(table).length) continue;
    const n = Number(db.prepare(`DELETE FROM "${table}"`).run().changes);
    if (n) done.push(`${table} emptied (${n})`);
  }
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND substr(name, 1, 7) <> 'sqlite_' AND substr(name, 1, 4) <> '_cf_' AND name <> 'd1_migrations'`)
    .all()
    .map((r) => r.name);
  for (const table of tables) {
    for (const col of columnsOf(table)) {
      if (!blankHit(table, col.name)) continue;
      // A NOT NULL column gets a distinct placeholder, so a unique index on it still holds.
      const value = col.nn ? `'scrubbed-' || rowid` : "NULL";
      try {
        const n = Number(db.prepare(`UPDATE "${table}" SET "${col.name}" = ${value} WHERE "${col.name}" IS NOT NULL AND "${col.name}" <> ''`).run().changes);
        if (n) done.push(`${table}.${col.name} blanked (${n})`);
      } catch (err) {
        fail(`The can scrub could not blank ${table}.${col.name} (${err.message}); the build stops so the sandbox never carries it.`);
      }
    }
  }
  const pins = db.prepare(`SELECT key FROM app_config WHERE value IS NOT NULL`).all().map((r) => r.key).filter((k) => PIN_KEY.test(k));
  const setPin = db.prepare(`UPDATE app_config SET value = ? WHERE key = ?`);
  for (const key of pins) setPin.run(SANDBOX_PIN, key);
  if (pins.length) done.push(`${pins.length} PIN(s) set to ${SANDBOX_PIN}`);
  // The change log keeps old and new values, so the scrubbed fields go blank there too.
  if (columnsOf("record_change_log").length) {
    let n = 0;
    const blankLog = db.prepare(`UPDATE record_change_log SET old_value = NULL, new_value = NULL WHERE record_table = ? AND field = ? AND (old_value IS NOT NULL OR new_value IS NOT NULL)`);
    const pairs = db.prepare(`SELECT DISTINCT record_table AS t, field AS f FROM record_change_log`).all().filter((r) => blankHit(r.t, r.f));
    for (const r of pairs) n += Number(blankLog.run(r.t, r.f).changes);
    for (const table of EMPTY_TABLES) n += Number(db.prepare(`DELETE FROM record_change_log WHERE record_table = ?`).run(table).changes);
    const pinIds = db
      .prepare(`SELECT DISTINCT record_id FROM record_change_log WHERE record_table = 'app_config'`)
      .all()
      .map((r) => String(r.record_id))
      .filter((k) => PIN_KEY.test(k));
    const blankPin = db.prepare(`UPDATE record_change_log SET old_value = NULL, new_value = NULL WHERE record_table = 'app_config' AND record_id = ? AND field = 'value'`);
    for (const id of pinIds) n += Number(blankPin.run(id).changes);
    if (n) done.push(`record_change_log: ${n} logged value(s) blanked`);
  }
  return done;
}

async function buildCan(snapshotDir) {
  const manifestPath = path.join(snapshotDir, "_manifest.json");
  if (!fs.existsSync(manifestPath)) fail(`No _manifest.json in ${snapshotDir}. Point --can at a snapshot folder from db_backups.`);
  const manifest = readJson(manifestPath);
  const listed = Object.entries(manifest.tables ?? {});
  const usable = listed.filter(([, v]) => !v.error).map(([t]) => t);
  const missing = usable.filter((t) => !fs.existsSync(path.join(snapshotDir, `${t}.json`)));
  if (missing.length) fail(`The snapshot folder is incomplete: ${missing.length} table files missing (${missing.slice(0, 5).join(", ")}). Is the shared folder fully synced?`);
  say(`Building the canned data from ${path.basename(snapshotDir)} (${usable.length} tables, dumped ${manifest.dumped_at ?? "at an unknown time"}). A few minutes.`);

  const sqlite = await loadSqlite();
  if (!sqlite) fail("This Node.js has no built in SQLite. Install the current Node 22 LTS from nodejs.org.");
  fs.rmSync(NEXT, { recursive: true, force: true });
  wrangler(["d1", "execute", DB, "--local", "--persist-to", NEXT_NAME, "--command", "SELECT 1"], { quiet: true });
  const dbFile = findSqlite(NEXT);

  // The snapshot's level: the one its manifest names, or else its own tables and columns tell.
  const files = migrationFiles();
  const named = manifest.migration_level ? files.findIndex((f) => f.file === manifest.migration_level) : -1;
  let floor = named;
  let absent = named + 1;
  if (named < 0) {
    const keys = new Map();
    for (const table of usable) keys.set(table.toLowerCase(), await firstKeys(path.join(snapshotDir, `${table}.json`)));
    ({ floor, absent } = snapshotLevels(migrationMarkers(files), snapshotShape(manifest, keys)));
  }
  if (floor < 0) fail("This snapshot does not match even the first migration; it is not a GripFactory Lite snapshot.");
  const replays = files.slice(floor + 1, absent);
  say(
    `The snapshot reads as migration ${files[floor].file}` +
      (replays.length ? `; ${replays.length} migration(s) after it only change rows, so they are replayed on its rows` : "") +
      `; ${files.length - absent} newer migration(s) apply on top.`
  );

  const db = new sqlite.DatabaseSync(dbFile);
  db.exec(`CREATE TABLE IF NOT EXISTS d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`);
  const record = db.prepare("INSERT INTO d1_migrations (name) VALUES (?)");
  for (const m of files.slice(0, floor + 1)) {
    db.exec(m.sql);
    record.run(m.file);
  }

  // The rows, table by table, as the snapshot holds them.
  let total = 0;
  const notes = [];
  db.exec("PRAGMA foreign_keys = OFF");
  for (const table of usable) {
    if (EMPTY_TABLES.includes(table)) continue;
    const cols = db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table).map((r) => r.name);
    if (!cols.length) {
      notes.push(`${table}: not in the schema at this level, left out`);
      continue;
    }
    db.exec("BEGIN");
    db.prepare(`DELETE FROM "${table}"`).run();
    const colSet = new Set(cols);
    const statements = new Map();
    const skipped = new Set();
    let count = 0;
    try {
      for await (const row of tableRows(path.join(snapshotDir, `${table}.json`))) {
        const keys = Object.keys(row).filter((k) => {
          if (colSet.has(k)) return true;
          skipped.add(k);
          return false;
        });
        const sig = keys.join(",");
        let stmt = statements.get(sig);
        if (!stmt) {
          stmt = db.prepare(`INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`);
          statements.set(sig, stmt);
        }
        stmt.run(...keys.map((k) => cell(row[k])));
        count += 1;
      }
    } catch (err) {
      db.exec("ROLLBACK");
      fail(`Could not load ${table}.json (${err.message}). Is the shared folder fully synced?`);
    }
    db.exec("COMMIT");
    if (skipped.size) notes.push(`${table}: columns not in the schema skipped (${[...skipped].join(", ")})`);
    total += count;
  }
  for (const [table, v] of listed.filter(([, v]) => v.error)) notes.push(`${table}: not in the snapshot (${String(v.error).slice(0, 80)}), left empty`);
  db.exec("PRAGMA foreign_keys = ON");
  for (const m of replays) {
    notes.push(replayMigration(db, m));
    record.run(m.file);
  }
  db.close();

  applyMigrations(NEXT_NAME);
  // THE CAN SCRUB runs last, on the finished database.
  const done = new sqlite.DatabaseSync(dbFile);
  const scrubbed = scrubCan(done);
  done.close();
  fs.writeFileSync(
    path.join(NEXT, CAN_INFO),
    `${JSON.stringify({ snapshot: path.basename(snapshotDir), dumped_at: manifest.dumped_at ?? null, level: files[floor].file, replayed: replays.map((m) => m.file), rows: total, built_at: new Date().toISOString(), scrubbed, notes }, null, 2)}\n`
  );
  try {
    fs.rmSync(PERSIST, { recursive: true, force: true });
    fs.renameSync(NEXT, PERSIST);
  } catch (err) {
    fail(`Could not put the new data in place (${err.code || err.message}). Is the app still running? Stop it (Ctrl+C in its window) and run this again.`);
  }
  for (const note of notes) say(`  ${note}`);
  say(`  scrubbed: ${scrubbed.length ? scrubbed.join("; ") : "nothing to scrub"}`);
  say(`Canned data ready: ${total.toLocaleString("en-US")} rows. Every PIN in the sandbox is ${SANDBOX_PIN}.`);
}

// ---------------------------------------------------------------- the app

function openBrowser(url) {
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true });
    child.on("error", () => say(`Open ${url} in your browser.`));
    child.unref();
  } catch {
    say(`Open ${url} in your browser.`);
  }
}

async function serve({ open = true, port = DEFAULT_PORT } = {}) {
  const url = `http://localhost:${port}`;
  const inspector = await freePort();
  say(`Starting the app on ${url} (Ctrl+C stops it). It reloads by itself when a file is saved.`);
  const child = spawn(
    process.execPath,
    [WRANGLER_JS, "dev", "--persist-to", PERSIST_NAME, "--port", String(port), "--ip", "127.0.0.1", "--inspector-port", String(inspector)],
    { cwd: APP, env: WRANGLER_ENV, stdio: ["inherit", "pipe", "pipe"] }
  );
  let opened = !open;
  let announced = false;
  const onData = (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    if (!announced && /Ready on http/.test(text)) {
      announced = true;
      say(`Open ${url} (every PIN is ${SANDBOX_PIN}).`);
      if (!opened) {
        opened = true;
        openBrowser(url);
      }
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
  // Ctrl+C reaches wrangler too; wait for it to close the database, and force it on a second press.
  let presses = 0;
  const stop = () => {
    presses += 1;
    if (presses > 1) {
      child.kill("SIGKILL");
      process.exit(130);
    }
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

// ---------------------------------------------------------------- commands

async function cmdSetup(args) {
  requireRepo();
  const can = flag(args, "--can");
  const ideas = flag(args, "--ideas");
  const name = flag(args, "--name");
  if (!can || !ideas || !name) fail("setup needs --can <snapshot folder> --ideas <ideas folder> --name <first name>.");
  if (!fs.existsSync(path.join(can, "_manifest.json"))) fail(`No _manifest.json in ${can}. Point --can at the snapshot folder itself.`);
  if (!fs.existsSync(ideas)) fail(`The ideas folder ${ideas} does not exist (is the shared folder synced?).`);
  // Outside the repo, so the canned data and old hand-backs can never ride a patch.
  if (inside(ROOT, can) || inside(ROOT, ideas)) fail("Keep the snapshot folder and the ideas folder outside the repo folder.");
  writeLocal({ name, can: path.resolve(can), ideas: path.resolve(ideas) });
  say(`Saved your settings in ${path.relative(ROOT, LOCAL)} (this file stays on your computer).`);
  await cmdStart(args.filter((a, i) => ["--no-serve", "--no-open", "--port"].includes(a) || args[i - 1] === "--port"));
}

async function cmdStart(args) {
  requireRepo();
  const cfg = needLocal();
  const keep = args.includes("--keep");
  const serveIt = !args.includes("--no-serve");
  const port = portFlag(args);
  if (serveIt && !(await portFree(port))) fail(`Port ${port} is busy: the app (or something else) is already running there. Use that window, or close it first.`);
  if (!keep) refreshToMain();
  else {
    const waiting = changeInProgress();
    say(`Keeping your change in progress (${waiting || "nothing changed yet"}); main is not refreshed.`);
  }
  ensurePackages();
  if (!fs.existsSync(path.join(PERSIST, CAN_INFO))) await buildCan(cfg.can);
  else applyMigrations(PERSIST_NAME);
  if (!serveIt) return;
  await serve({ open: !args.includes("--no-open"), port });
}

function slug(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "idea"
  );
}

function localDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function cmdHandback(args) {
  requireRepo();
  const cfg = needLocal();
  const title = args.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!title) fail('handback needs a title: node tools/sandbox/sandbox.mjs handback "<idea title>"');
  if (!fs.existsSync(cfg.ideas)) fail(`The ideas folder ${cfg.ideas} is not there (is the shared folder synced?).`);
  const base = baseCommit();
  git(["add", "-A"]);
  const patch = spawnSync("git", ["diff", "--cached", "--binary", base], { cwd: ROOT, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  const stat = git(["diff", "--cached", "--stat=200", base], { keepIndent: true }).out;
  const names = git(["diff", "--cached", "--name-only", base]).out.split("\n").filter(Boolean);
  git(["reset", "-q"]);
  if (patch.status !== 0) fail(`git diff failed: ${(patch.stderr || "").trim()}`);
  if (!patch.stdout.trim()) fail("There is no change to hand back.");
  const mb = Buffer.byteLength(patch.stdout) / 1e6;
  if (mb > PATCH_LIMIT_MB) fail(`The change is ${mb.toFixed(1)} MB, far bigger than an idea needs. Something large (copied data?) is in the repo folder. Look with: git status`);
  const team = names.filter((n) => TEAM_PATHS.some((re) => re.test(n)));
  let folder = path.join(cfg.ideas, `${localDay()}_${slug(cfg.name)}_${slug(title)}`);
  for (let n = 2; fs.existsSync(folder); n++) folder = path.join(cfg.ideas, `${localDay()}_${slug(cfg.name)}_${slug(title)}-${n}`);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "change.patch"), patch.stdout);
  fs.writeFileSync(path.join(folder, "files.txt"), `${stat}\n`);
  const baseDate = git(["log", "-1", "--format=%cI", base]).out;
  const lines = [`base ${base}`, `base_date ${baseDate}`, `made ${new Date().toISOString()}`, `by ${cfg.name}`, `title ${title}`];
  if (team.length) lines.push(`team_paths ${team.join(" ")}`);
  fs.writeFileSync(path.join(folder, "base.txt"), `${lines.join("\n")}\n`);
  if (fs.existsSync(IDEA)) fs.copyFileSync(IDEA, path.join(folder, "IDEA.md"));
  else {
    const template = fs.existsSync(IDEA_TEMPLATE) ? fs.readFileSync(IDEA_TEMPLATE, "utf8") : "# {title}\n\nBy {name}.\n";
    fs.writeFileSync(path.join(folder, "IDEA.md"), template.replace("{title}", () => title).replace("{name}", () => cfg.name));
    say("No tools/sandbox/IDEA.md was written, so the idea folder has the blank template. Fill it in there.");
  }
  if (fs.existsSync(SHOTS)) {
    const shots = fs.readdirSync(SHOTS).filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f));
    if (shots.length) {
      fs.mkdirSync(path.join(folder, "shots"), { recursive: true });
      for (const f of shots) fs.copyFileSync(path.join(SHOTS, f), path.join(folder, "shots", f));
    }
  }
  if (team.length) say(`Note: the change touches files the team keeps (${team.join(", ")}). It is handed back anyway; the team will look.`);
  say(`Handed back to ${folder}`);
  say((stat.split("\n").slice(-1)[0] || "").trim());
  say("Your change is still here. When you are ready for the next idea: node tools/sandbox/sandbox.mjs reset --yes");
}

function cmdReset(args) {
  requireRepo();
  if (!args.includes("--yes")) fail("reset throws your change away. Run it again with --yes when that is what you want (hand it back first if it is worth keeping).");
  const branch = currentBranch();
  if (branch !== BRANCH) fail(`reset works on the ${BRANCH} branch only; you are on ${branch || "a detached HEAD"}.`);
  git(["reset", "--hard", "origin/main"]);
  git(["clean", "-fd"]);
  fs.rmSync(IDEA, { force: true });
  fs.rmSync(SHOTS, { recursive: true, force: true });
  say("Clean: the code is main again; your database and packages are kept.");
}

function cmdStatus() {
  requireRepo();
  const cfg = readLocal();
  const branch = currentBranch();
  if (hasOriginMain()) {
    git(["fetch", "origin", "main"], { allowFail: true });
    const behind = git(["rev-list", "--count", "HEAD..origin/main"], { allowFail: true }).out;
    say(`Branch ${branch || "(detached)"}, ${behind || "0"} commit(s) behind main.`);
  } else say(`Branch ${branch || "(detached)"}; no origin/main yet.`);
  const waiting = changeInProgress();
  say(waiting ? `Change in progress: ${waiting}.` : "No change in progress.");
  const info = path.join(PERSIST, CAN_INFO);
  if (fs.existsSync(info)) {
    const can = readJson(info);
    say(`Canned data: ${can.snapshot} (dumped ${can.dumped_at}, level ${can.level}), ${Number(can.rows).toLocaleString("en-US")} rows, built ${can.built_at}.`);
  } else say("No canned data yet (start builds it).");
  if (cfg) say(`Ideas go to ${cfg.ideas}.`);
}

/** A row as an element of the dump's array, in db-snapshot's layout. */
function dumpRow(row) {
  return JSON.stringify(row, null, 1)
    .split("\n")
    .map((line) => ` ${line}`)
    .join("\n");
}

/** One row through THE CAN SCRUB, in a snapshot file: null when the row is dropped. */
export function scrubRow(table, row, ordinal) {
  let hits = 0;
  if (table === "app_config" && PIN_KEY.test(String(row.key)) && row.value != null) {
    row.value = SANDBOX_PIN;
    hits += 1;
  }
  for (const key of Object.keys(row)) {
    // A distinct placeholder keeps a NOT NULL column and a unique index happy; the build blanks it again.
    if (blankHit(table, key) && row[key] != null && row[key] !== "") {
      row[key] = `scrubbed-${ordinal}`;
      hits += 1;
    }
  }
  if (table === "record_change_log") {
    if (EMPTY_TABLES.includes(row.record_table)) return { row: null, hits: 1 };
    const pin = row.record_table === "app_config" && row.field === "value" && PIN_KEY.test(String(row.record_id));
    if ((pin || blankHit(row.record_table, row.field)) && (row.old_value != null || row.new_value != null)) {
      row.old_value = null;
      row.new_value = null;
      hits += 1;
    }
  }
  return { row, hits };
}

/** THE PACK: a scrubbed copy of a snapshot folder, safe to share, in the same layout. */
async function cmdPack(args) {
  const [src, out] = args.filter((a) => !a.startsWith("--")).map((a) => path.resolve(cleanArg(a)));
  if (!src || !out) fail("pack needs a snapshot folder and a new folder for the can: node tools/sandbox/sandbox.mjs pack <snapshot folder> <can folder>");
  const manifestPath = path.join(src, "_manifest.json");
  if (!fs.existsSync(manifestPath)) fail(`No _manifest.json in ${src}.`);
  const manifest = readJson(manifestPath);
  if (manifest.sandbox_can) fail(`${src} is a sandbox can already.`);
  if (inside(src, out) || inside(out, src)) fail("Put the can beside the snapshot folder, not inside it.");
  if (fs.existsSync(out) && fs.readdirSync(out).length) fail(`${out} is not empty; pick a new folder.`);
  const listed = Object.entries(manifest.tables ?? {});
  const usable = listed.filter(([, v]) => !v.error).map(([t]) => t);
  const missing = usable.filter((t) => !fs.existsSync(path.join(src, `${t}.json`)));
  if (missing.length) fail(`The snapshot folder is incomplete: ${missing.length} table files missing (${missing.slice(0, 5).join(", ")}).`);
  fs.mkdirSync(out, { recursive: true });
  say(`Packing ${path.basename(src)} (${usable.length} tables) into ${out}, scrubbed.`);
  const tables = {};
  const scrubbed = [];
  for (const [table, v] of listed) {
    if (v.error) {
      tables[table] = v;
      continue;
    }
    const dest = path.join(out, `${table}.json`);
    const fd = fs.openSync(dest, "w");
    let rows = 0;
    let hits = 0;
    try {
      if (EMPTY_TABLES.includes(table)) {
        hits = v.rows ?? 0;
      } else {
        for await (const original of tableRows(path.join(src, `${table}.json`))) {
          const result = scrubRow(table, original, rows + 1);
          hits += result.hits;
          if (!result.row) continue;
          fs.writeSync(fd, rows === 0 ? `[\n${dumpRow(result.row)}` : `,\n${dumpRow(result.row)}`);
          rows += 1;
        }
      }
      fs.writeSync(fd, rows === 0 ? "[]" : "\n]");
    } finally {
      fs.closeSync(fd);
    }
    tables[table] = { rows };
    if (hits) scrubbed.push(`${table} (${hits})`);
  }
  const packed = {
    ...manifest,
    label: `${manifest.label ?? path.basename(src)} sandbox can`,
    sandbox_can: true,
    packed_from: path.basename(src),
    packed_at: new Date().toISOString(),
    scrubbed,
    tables,
  };
  fs.writeFileSync(path.join(out, "_manifest.json"), `${JSON.stringify(packed, null, 2)}\n`);
  say(`  scrubbed: ${scrubbed.length ? scrubbed.join("; ") : "nothing to scrub"}`);
  say(`Can ready: ${out}. Share this folder, never the snapshot itself.`);
}

async function cmdCan(args) {
  requireRepo();
  const cfg = needLocal();
  const given = args.find((a) => !a.startsWith("--"));
  const dir = given ? path.resolve(cleanArg(given)) : cfg.can;
  if (inside(ROOT, dir)) fail("Keep the snapshot folder outside the repo folder.");
  if (!(await portFree(DEFAULT_PORT))) fail("The app is running (port 8787 is busy). Stop it with Ctrl+C in its window first; its database is in use.");
  ensurePackages();
  await buildCan(dir);
  if (!samePath(dir, cfg.can)) writeLocal({ ...cfg, can: dir });
}

const HELP = `GripFactory Lite team sandbox. From the repo's top folder:
  node tools/sandbox/sandbox.mjs setup --can <snapshot folder> --ideas <ideas folder> --name <first name>
  node tools/sandbox/sandbox.mjs start [--keep] [--no-open] [--no-serve] [--port <n>]
  node tools/sandbox/sandbox.mjs handback "<idea title>"
  node tools/sandbox/sandbox.mjs reset --yes
  node tools/sandbox/sandbox.mjs status
  node tools/sandbox/sandbox.mjs can [<snapshot folder>]
For the owner, a scrubbed copy of a snapshot to share:
  node tools/sandbox/sandbox.mjs pack <snapshot folder> <can folder>`;

const isMain = Boolean(process.argv[1]) && samePath(process.argv[1], fileURLToPath(import.meta.url));
if (isMain) {
  const [command, ...rest] = process.argv.slice(2);
  const run = { setup: cmdSetup, start: cmdStart, handback: cmdHandback, reset: cmdReset, status: cmdStatus, can: cmdCan, pack: cmdPack }[command];
  if (!run) {
    console.log(HELP);
    process.exit(command ? 1 : 0);
  }
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 5)) fail(`The sandbox needs Node.js 22.5 or newer; this is ${process.versions.node}. Install the current Node 22 LTS from nodejs.org.`);
  // Node 22.5 to 22.12 keeps SQLite behind a flag; run again with it.
  if (["setup", "start", "can"].includes(command) && !(await loadSqlite())) {
    if (process.execArgv.includes("--experimental-sqlite")) fail("This Node.js has no built in SQLite. Install the current Node 22 LTS from nodejs.org.");
    const again = spawnSync(process.execPath, ["--experimental-sqlite", ...process.execArgv, ...process.argv.slice(1)], { stdio: "inherit" });
    process.exit(again.status ?? 1);
  }
  await run(rest);
}
