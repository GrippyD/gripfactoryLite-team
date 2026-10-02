// Shared helpers for the owner-run D1 scripts (db-snapshot.mjs, roll-beta.mjs).
// Everything here runs on the owner's machine where wrangler is authorized; the
// Scribe's sandbox cannot reach Cloudflare. Plain Node, no dependencies.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT_DIR = resolve(APP_DIR, "..");
export const TOML_PATH = join(APP_DIR, "wrangler.toml");

/** THE NAME LAW FOR DEPLOYS (canon 0.30.41): the grip database is whatever the
 * env.grip d1 block says; never a typed name. */
export function gripDatabase(tomlText = readFileSync(TOML_PATH, "utf8")) {
  const m = /\[\[env\.grip\.d1_databases\]\][\s\S]*?database_name = "([^"]+)"[\s\S]*?database_id = "([^"]+)"/.exec(tomlText);
  if (!m) throw new Error("wrangler.toml has no [[env.grip.d1_databases]] block with database_name and database_id");
  return { name: m[1], id: m[2] };
}

/** Rewrite the env.grip d1 block's name and id; everything else byte for byte. */
export function patchGripDatabase(tomlText, name, id) {
  const re = /(\[\[env\.grip\.d1_databases\]\][\s\S]*?database_name = ")([^"]+)("[\s\S]*?database_id = ")([^"]+)(")/;
  if (!re.test(tomlText)) throw new Error("wrangler.toml env.grip d1 block not found for patching");
  return tomlText.replace(re, (_m, a, _oldName, b, _oldId, c) => `${a}${name}${b}${id}${c}`);
}

export function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function todayCompact() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** Run a command line through the shell (npx and npm are .cmd shims on
 * Windows), capturing stdout and stderr; input feeds stdin (wrangler's y). */
export function run(cmd, { cwd = APP_DIR, input, quiet = false } = {}) {
  if (!quiet) console.log(`\n$ ${cmd}`);
  const res = spawnSync(cmd, { cwd, shell: true, encoding: "utf8", input, maxBuffer: 512 * 1024 * 1024, env: process.env });
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  if (!quiet && out.trim()) console.log(out.trim().split("\n").slice(-12).join("\n"));
  return { code: res.status ?? 1, out, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

function quoteArg(s) {
  // cmd.exe and sh both take a double-quoted argument. Every SQL sent through
  // --command is written without double quotes (plain identifiers, single-quoted
  // strings); double-quoted identifiers live only in SQL files.
  if (/"/.test(String(s))) throw new Error(`argument carries a double quote: ${s}`);
  return `"${s}"`;
}

/** One SQL statement against the remote grip database, parsed from --json. */
export function d1Query(dbName, sql, { quiet = true } = {}) {
  const res = run(`npx wrangler d1 execute ${quoteArg(dbName)} --env grip --remote --json --command ${quoteArg(sql)}`, { quiet });
  if (res.code !== 0) throw new Error(`d1 execute failed (exit ${res.code}) for: ${sql}\n${res.out.slice(-2000)}`);
  const start = res.stdout.indexOf("[");
  if (start < 0) throw new Error(`d1 execute gave no JSON for: ${sql}\n${res.stdout.slice(-2000)}`);
  const parsed = JSON.parse(res.stdout.slice(start));
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first || first.success === false) throw new Error(`d1 execute reported failure for: ${sql}\n${JSON.stringify(first).slice(0, 2000)}`);
  return first.results ?? [];
}

/** A SQL file against the remote grip database (many statements). */
export function d1File(dbName, filePath, { quiet = false } = {}) {
  const res = run(`npx wrangler d1 execute ${quoteArg(dbName)} --env grip --remote --file ${quoteArg(filePath)}`, { quiet, input: "y\n" });
  if (res.code !== 0) throw new Error(`d1 execute --file failed (exit ${res.code}) for ${filePath}\n${res.out.slice(-3000)}`);
  return res;
}

/** Every user table in the database, sqlite_ and d1_ internals excluded. */
export function listTables(dbName) {
  // No percent signs in a --command (cmd.exe reads them as variables); substr does the job.
  const rows = d1Query(
    dbName,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND substr(name, 1, 7) <> 'sqlite_' AND substr(name, 1, 3) <> 'd1_' AND substr(name, 1, 4) <> '_cf_' ORDER BY name"
  );
  return rows.map((r) => r.name);
}

/** THE PAGED DUMP (canon 0.30.353): record_change_log passed 806k rows and one SELECT * of it
 * failed twice with Cloudflare's code 7500 on 2026-10-02, so every table is read by rowid in pages,
 * each page tried twice; the rows and their column order are the single query's. */
export const DUMP_PAGE_ROWS = 50000;

export function dumpTable(dbName, table, pageRows = DUMP_PAGE_ROWS) {
  const rows = [];
  let after = null;
  for (;;) {
    const where = after == null ? "" : ` WHERE rowid > ${after}`;
    const sql = `SELECT rowid AS snapshot_rowid, * FROM ${table}${where} ORDER BY rowid LIMIT ${pageRows}`;
    let page;
    try {
      page = d1Query(dbName, sql);
    } catch {
      page = d1Query(dbName, sql);
    }
    for (const row of page) {
      after = row.snapshot_rowid;
      delete row.snapshot_rowid;
      rows.push(row);
    }
    if (page.length < pageRows) return rows;
  }
}

/** Dump every table to <dir>/<table>.json plus _manifest.json; returns the manifest. */
export function dumpAll(dbName, dir, { label = "" } = {}) {
  mkdirSync(dir, { recursive: true });
  const tables = listTables(dbName);
  const manifest = { database: dbName, label, dumped_at: new Date().toISOString(), tables: {} };
  for (const t of tables) {
    try {
      const rows = dumpTable(dbName, t);
      writeFileSync(join(dir, `${t}.json`), JSON.stringify(rows, null, 1), "utf8");
      manifest.tables[t] = { rows: rows.length };
      console.log(`  ${t}: ${rows.length} rows`);
    } catch (e) {
      manifest.tables[t] = { error: String(e.message).slice(0, 500) };
      console.log(`  ${t}: FAILED ${String(e.message).slice(0, 200)}`);
    }
  }
  writeFileSync(join(dir, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

function sqlLiteral(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** DELETE then INSERT statements that make a table read exactly like a dump.
 * Rows go in batches of 20 (D1 caps one statement at 100 bound values and
 * 100 KB; literals are inlined, so the size cap is the one that matters). */
export function carrySql(table, rows) {
  const lines = [`DELETE FROM "${table}";`];
  if (rows.length === 0) return lines;
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  for (let i = 0; i < rows.length; i += 20) {
    const chunk = rows.slice(i, i + 20);
    const values = chunk.map((r) => `(${cols.map((c) => sqlLiteral(r[c])).join(", ")})`).join(",\n  ");
    lines.push(`INSERT INTO "${table}" (${colList}) VALUES\n  ${values};`);
  }
  return lines;
}

export function readDump(dir, table) {
  const p = join(dir, `${table}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

export function ensureDir(p) {
  mkdirSync(p, { recursive: true });
  return p;
}
