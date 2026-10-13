/* Load finance's GRIPCasting export into GFLite's D1.
 *
 *   node scripts/gripcasting-import.mjs --dry-run
 *   node scripts/gripcasting-import.mjs --admin you@example.com=Name --director them@example.com=Name
 *   node scripts/gripcasting-import.mjs --remote --admin you@example.com=Name
 *
 * Reads const.json and data/ from a folder outside the repo
 * (default ../db_backups/_imports/gripcasting/). Local D1 unless --remote.
 * Stops at the first failure and reports what loaded. Never prints figures.
 * --dry-run counts rows and writes nothing.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gripDatabase, ROOT_DIR, run } from "./d1lib.mjs";

const DEFAULT_DIR = join(ROOT_DIR, "db_backups", "_imports", "gripcasting");
const BY = "import";

export function sqlText(value) {
  const hex = Buffer.from(String(value), "utf8").toString("hex");
  return `CAST(X'${hex}' AS TEXT)`;
}

const cents = (n) => Math.round(Number(n) * 100);
const tenThousandths = (n) => Math.round(Number(n) * 10000);
const millionths = (n) => Math.round(Number(n) * 1000000);
const int = (n) => {
  if (!Number.isInteger(n)) throw new Error("a stored number is not a whole unit");
  return String(n);
};
const lastDay = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readPack(dir) {
  const cPath = join(dir, "const.json");
  if (!existsSync(cPath)) throw new Error("const.json is required in the import folder.");
  const C = JSON.parse(readFileSync(cPath, "utf8"));
  if (!C || !C.BUDGET || !Object.keys(C.BUDGET).length) throw new Error("const.json with a budget is required.");
  if (!Array.isArray(C.BUS) || !Array.isArray(C.GLS) || !C.VOL_DEFAULT || typeof C.VOL_DEFAULT !== "object") {
    throw new Error("const.json is missing BUS, GLS, or VOL_DEFAULT.");
  }
  const drivers = readJson(join(dir, "data", "db", "model", "drivers.json"));
  const actuals = readJson(join(dir, "data", "db", "actuals", "current.json"));
  const buildsDir = join(dir, "data", "db", "builds");
  const builds = [];
  if (existsSync(buildsDir)) {
    for (const name of readdirSync(buildsDir).filter((file) => file.endsWith(".json")).sort()) {
      builds.push(JSON.parse(readFileSync(join(buildsDir, name), "utf8")));
    }
  }
  return { C, drivers, actuals, builds };
}

export function countPack(pack, people) {
  const budget = Object.values(pack.C.BUDGET).reduce((sum, row) => sum + Object.keys(row).length, 0);
  let buildLines = 0;
  let buildItems = 0;
  for (const build of pack.builds) {
    for (const line of Object.values(build.lines || {})) {
      buildLines += 1;
      buildItems += (line.items || []).length;
    }
  }
  const monthly = pack.actuals
    ? Object.values(pack.actuals.monthly || {}).reduce((sum, row) => sum + Object.keys(row).length, 0)
    : 0;
  return {
    harvests: 1,
    business_units: pack.C.BUS.length,
    gl_accounts: new Set(pack.C.GLS).size,
    budget_lines: budget,
    drivers: pack.drivers ? 1 : 0,
    actual_closes: pack.actuals ? 1 : 0,
    actual_lines: pack.actuals ? (pack.actuals.rows || []).length : 0,
    actual_monthly: monthly,
    builds: pack.builds.length,
    build_lines: buildLines,
    build_items: buildItems,
    users: people.length,
  };
}

/** Append a text value in pieces so one wrangler --command stays under cmd's limit. */
export function jsonAppends(table, whereSql, column, value, label) {
  const hex = Buffer.from(String(value), "utf8").toString("hex");
  const step = 4000;
  const stmts = [];
  if (!hex.length) {
    stmts.push({ label, sql: `UPDATE ${table} SET ${column} = '' WHERE ${whereSql}` });
    return stmts;
  }
  for (let i = 0; i < hex.length; i += step) {
    const part = hex.slice(i, i + step);
    const expr = i === 0 ? `CAST(X'${part}' AS TEXT)` : `${column} || CAST(X'${part}' AS TEXT)`;
    stmts.push({ label, sql: `UPDATE ${table} SET ${column} = ${expr} WHERE ${whereSql}` });
  }
  return stmts;
}

const EMPTY_JSON = "CAST(X'7b7d' AS TEXT)";

function inserts(table, columns, rows, label) {
  const stmts = [];
  const head = `INSERT INTO ${table} (${columns.join(", ")}) VALUES `;
  let batch = [];
  let size = head.length;
  const flush = () => {
    if (!batch.length) return;
    stmts.push({ label, sql: head + batch.join(", ") });
    batch = [];
    size = head.length;
  };
  for (const row of rows) {
    const value = `(${row.join(", ")})`;
    if (batch.length && size + value.length + 2 > 6500) flush();
    batch.push(value);
    size += value.length + 2;
  }
  flush();
  return stmts;
}

function guard(sql) {
  if (sql.includes('"')) throw new Error("a statement carries a double quote");
  if (sql.includes("%")) throw new Error("a statement carries a percent sign");
  if (sql.length > 7500) throw new Error(`a statement is ${sql.length} characters`);
}

/** Statements that need the harvest id. Ids in the pack are generated here. */
export function childStatements(pack, people, harvestId, now) {
  const id = sqlText(harvestId);
  const stamp = sqlText(now);
  const by = sqlText(BY);
  const stmts = [
    { label: "build_items", sql: `DELETE FROM gc_build_items WHERE line_id IN (SELECT l.id FROM gc_build_lines l JOIN gc_builds b ON b.id = l.build_id WHERE b.harvest_id = ${id})` },
    { label: "build_lines", sql: `DELETE FROM gc_build_lines WHERE build_id IN (SELECT id FROM gc_builds WHERE harvest_id = ${id})` },
    { label: "builds", sql: `DELETE FROM gc_builds WHERE harvest_id = ${id}` },
    { label: "budget_lines", sql: `DELETE FROM gc_budget_lines WHERE harvest_id = ${id}` },
    { label: "gl_accounts", sql: `DELETE FROM gc_gl_accounts WHERE harvest_id = ${id}` },
    { label: "business_units", sql: `DELETE FROM gc_business_units WHERE harvest_id = ${id}` },
  ];
  stmts.push(...inserts("gc_business_units",
    ["id", "harvest_id", "code", "name", "sort", "created_at", "created_by"],
    pack.C.BUS.map((name, i) => [sqlText(randomUUID()), id, sqlText(String(name).slice(0, 2)), sqlText(name), int(i), stamp, by]),
    "business_units"));
  stmts.push(...inserts("gc_gl_accounts",
    ["id", "harvest_id", "name", "created_at", "created_by"],
    [...new Set(pack.C.GLS)].map((name) => [sqlText(randomUUID()), id, sqlText(name), stamp, by]),
    "gl_accounts"));
  const budget = [];
  for (const [gl, row] of Object.entries(pack.C.BUDGET)) {
    for (const [bu, amount] of Object.entries(row)) budget.push([sqlText(randomUUID()), id, sqlText(gl), sqlText(bu), int(cents(amount)), stamp, by]);
  }
  stmts.push(...inserts("gc_budget_lines",
    ["id", "harvest_id", "gl", "bu", "amount", "created_at", "created_by"],
    budget,
    "budget_lines"));

  if (pack.drivers) {
    const data = pack.drivers.data || pack.drivers;
    stmts.push({
      label: "drivers",
      sql: `INSERT INTO gc_drivers (id, harvest_id, vol, gl, updated_at, created_at, created_by) VALUES (${sqlText(randomUUID())}, ${id}, ${EMPTY_JSON}, ${EMPTY_JSON}, ${pack.drivers.updatedAt ? sqlText(pack.drivers.updatedAt) : "NULL"}, ${stamp}, ${by}) ON CONFLICT(harvest_id) DO UPDATE SET vol = excluded.vol, gl = excluded.gl, updated_at = ${stamp}`,
    });
    stmts.push(...jsonAppends("gc_drivers", `harvest_id = ${id}`, "vol", JSON.stringify(data.vol), "drivers"));
    stmts.push(...jsonAppends("gc_drivers", `harvest_id = ${id}`, "gl", JSON.stringify(data.gl || {}), "drivers"));
  }

  if (pack.actuals) {
    const a = pack.actuals;
    const closeDate = sqlText(a.closeDate);
    stmts.push(
      { label: "transactions", sql: `DELETE FROM gc_transactions WHERE close_id IN (SELECT id FROM gc_actual_closes WHERE harvest_id = ${id} AND close_date = ${closeDate})` },
      { label: "actual_monthly", sql: `DELETE FROM gc_actual_monthly WHERE close_id IN (SELECT id FROM gc_actual_closes WHERE harvest_id = ${id} AND close_date = ${closeDate})` },
      { label: "actual_lines", sql: `DELETE FROM gc_actual_lines WHERE close_id IN (SELECT id FROM gc_actual_closes WHERE harvest_id = ${id} AND close_date = ${closeDate})` },
      { label: "actual_closes", sql: `DELETE FROM gc_actual_closes WHERE harvest_id = ${id} AND close_date = ${closeDate}` },
      { label: "actual_closes", sql: `UPDATE gc_actual_closes SET is_current = 0, updated_at = ${stamp} WHERE harvest_id = ${id} AND is_current = 1` },
    );
    const closeId = randomUUID();
    stmts.push({
      label: "actual_closes",
      sql: `INSERT INTO gc_actual_closes (id, harvest_id, close_date, file_name, uploaded_at, is_current, created_at, created_by) VALUES (${sqlText(closeId)}, ${id}, ${closeDate}, ${sqlText(a.fileName)}, ${sqlText(a.uploadedAt || now)}, 1, ${stamp}, ${by})`,
    });
    const cid = sqlText(closeId);
    stmts.push(...inserts("gc_actual_lines",
      ["id", "close_id", "entity", "bu", "gl", "amount", "created_at", "created_by"],
      (a.rows || []).map(([entity, bu, gl, amount]) => [sqlText(randomUUID()), cid, sqlText(entity), sqlText(bu), sqlText(gl), int(cents(amount)), stamp, by]),
      "actual_lines"));
    const monthly = [];
    for (const [gl, months] of Object.entries(a.monthly || {})) {
      for (const [key, amount] of Object.entries(months)) monthly.push([sqlText(randomUUID()), cid, sqlText(gl), sqlText(`${key}-01`), int(cents(amount)), stamp, by]);
    }
    stmts.push(...inserts("gc_actual_monthly",
      ["id", "close_id", "gl", "month", "amount", "created_at", "created_by"],
      monthly,
      "actual_monthly"));
    stmts.push({
      label: "upload_log",
      sql: `DELETE FROM gc_upload_log WHERE harvest_id = ${id} AND close_date = ${closeDate} AND created_by = ${by}`,
    });
    stmts.push({
      label: "upload_log",
      sql: `INSERT INTO gc_upload_log (id, harvest_id, close_date, file_name, total, transactions, created_at, created_by) VALUES (${sqlText(randomUUID())}, ${id}, ${closeDate}, ${sqlText(a.fileName)}, ${int(cents((a.rows || []).reduce((s, r) => s + (+String(r[2]).slice(0, 4) < 5000 ? 0 : r[3]), 0)))}, 0, ${sqlText(a.uploadedAt || now)}, ${by})`,
    });
  }

  for (const build of pack.builds) {
    const code = String(build.bu || "").slice(0, 2);
    const buildId = randomUUID();
    stmts.push({
      label: "builds",
      sql: `INSERT INTO gc_builds (id, harvest_id, bu_code, submitted_at, created_at, updated_at, created_by) VALUES (${sqlText(buildId)}, ${id}, ${sqlText(code)}, ${build.submittedAt ? sqlText(build.submittedAt) : "NULL"}, ${stamp}, ${stamp}, ${by})`,
    });
    for (const [gl, line] of Object.entries(build.lines || {})) {
      const lineId = randomUUID();
      stmts.push({
        label: "build_lines",
        sql: `INSERT INTO gc_build_lines (id, build_id, gl, status, reason, is_custom, edited_at, created_at, created_by) VALUES (${sqlText(lineId)}, ${sqlText(buildId)}, ${sqlText(gl)}, ${sqlText(line.status || "notstarted")}, ${sqlText(line.reason || "")}, ${line.custom ? 1 : 0}, ${line.updatedAt ? sqlText(line.updatedAt) : "NULL"}, ${stamp}, ${by})`,
      });
      const items = (line.items || []).map((it, i) => [
        sqlText(randomUUID()), sqlText(lineId), sqlText(it.id), int(i), sqlText(it.desc || ""), sqlText(it.po || ""),
        it.drv ? sqlText(it.drv) : "NULL",
        it.share == null ? "NULL" : int(millionths(it.share)),
        it.per == null ? "NULL" : int(tenThousandths(it.per)),
        it.qty == null ? "NULL" : int(tenThousandths(it.qty)),
        sqlText(it.unit || ""),
        it.cost == null ? "NULL" : int(tenThousandths(it.cost)),
        it.start || it.month ? sqlText(it.start || `${it.month}-01`) : "NULL",
        it.end || it.month ? sqlText(it.end || lastDay(it.month)) : "NULL",
        stamp, by,
      ]);
      stmts.push(...inserts("gc_build_items",
        ["id", "line_id", "client_id", "sort", "description", "po", "driver", "share", "per_hour", "qty", "unit", "unit_cost", "start_on", "end_on", "created_at", "created_by"],
        items,
        "build_items"));
    }
  }

  for (const person of people) {
    const email = sqlText(person.email);
    stmts.push({ label: "users", sql: `DELETE FROM gc_app_users WHERE lower(email) = ${email}` });
    stmts.push({
      label: "users",
      sql: `INSERT INTO gc_app_users (id, email, name, role, is_active, created_at, created_by) VALUES (${sqlText(randomUUID())}, ${email}, ${sqlText(person.name)}, ${sqlText(person.role)}, 1, ${stamp}, ${by})`,
    });
  }
  for (const stmt of stmts) guard(stmt.sql);
  return stmts;
}

export function harvestStatements(pack, now) {
  const stamp = sqlText(now);
  const wages = pack.C.WAGES_BUDGET == null ? "NULL" : int(cents(pack.C.WAGES_BUDGET));
  const stmts = [
    { label: "harvests", sql: `UPDATE gc_harvests SET is_current = 0, updated_at = ${stamp} WHERE is_current = 1` },
    {
      label: "harvests",
      sql: `INSERT INTO gc_harvests (id, code, starts_on, is_current, wages_budget, season, vol_default, created_at, created_by) VALUES (${sqlText(randomUUID())}, '2026H', '2026-04-01', 1, ${wages}, ${EMPTY_JSON}, ${EMPTY_JSON}, ${stamp}, ${sqlText(BY)}) ON CONFLICT(code) DO UPDATE SET is_current = 1, wages_budget = excluded.wages_budget, season = excluded.season, vol_default = excluded.vol_default, updated_at = ${stamp}`,
    },
  ];
  for (const stmt of stmts) guard(stmt.sql);
  return stmts;
}

function parsePeople(argv) {
  const people = [];
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const role = flag === "--admin" ? "admin" : flag === "--director" ? "director" : null;
    if (!role) continue;
    const raw = argv[++i] || "";
    const eq = raw.indexOf("=");
    const email = (eq < 0 ? raw : raw.slice(0, eq)).trim().toLowerCase();
    const name = (eq < 0 ? "" : raw.slice(eq + 1)).replace(/^"|"$/g, "") || email;
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error("an --admin or --director value must be email=Name");
    people.push({ email, name, role });
  }
  return people;
}

function prefixFor(remote, persist) {
  if (remote) {
    const db = gripDatabase();
    return `npx wrangler d1 execute "${db.name}" --env grip --remote`;
  }
  const persistFlag = persist ? ` --persist-to "${persist}"` : "";
  return `npx wrangler d1 execute gripfactory-lite-local --local${persistFlag}`;
}

function runStmt(prefix, stmt) {
  const res = run(`${prefix} --json --command "${stmt.sql}"`, { quiet: true });
  if (res.code !== 0) return { ok: false, code: res.code };
  const start = res.stdout.indexOf("[");
  if (start < 0) return { ok: false, code: res.code };
  let parsed;
  try {
    parsed = JSON.parse(res.stdout.slice(start));
  } catch {
    return { ok: false, code: res.code };
  }
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first || first.success === false) return { ok: false, code: res.code };
  return { ok: true, results: first.results || [] };
}

function reportCounts(counts) {
  for (const [key, value] of Object.entries(counts)) console.log(`${key}: ${value}`);
}

function tally(labels) {
  const counts = {};
  for (const label of labels) counts[label] = (counts[label] || 0) + 1;
  return Object.entries(counts).map(([key, value]) => `${key} ${value}`).join(", ") || "nothing";
}

function applyAll(prefix, pack, people) {
  const now = new Date().toISOString();
  const done = [];
  const fail = (label) => {
    console.error(`Import stopped on ${label}.`);
    console.error(`Loaded before the failure: ${tally(done)}.`);
    process.exitCode = 1;
  };
  for (const stmt of harvestStatements(pack, now)) {
    const res = runStmt(prefix, stmt);
    if (!res.ok) return fail(stmt.label);
    done.push(stmt.label);
  }
  const found = runStmt(prefix, { label: "harvests", sql: "SELECT id FROM gc_harvests WHERE code = '2026H'" });
  if (!found.ok || !found.results[0] || !found.results[0].id) return fail("harvests");
  done.push("harvests");
  const harvestId = found.results[0].id;
  const harvestWhere = `id = ${sqlText(harvestId)}`;
  const preface = [
    ...jsonAppends("gc_harvests", harvestWhere, "season", JSON.stringify(pack.C.SEASON || {}), "harvests"),
    ...jsonAppends("gc_harvests", harvestWhere, "vol_default", JSON.stringify(pack.C.VOL_DEFAULT), "harvests"),
  ];
  for (const stmt of [...preface, ...childStatements(pack, people, harvestId, now)]) {
    const res = runStmt(prefix, stmt);
    if (!res.ok) return fail(stmt.label);
    done.push(stmt.label);
  }
  console.log("Import finished.");
  reportCounts(countPack(pack, people));
}

function main() {
  const argv = process.argv.slice(2);
  let dir = DEFAULT_DIR;
  let remote = false;
  let dry = false;
  let persist = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--remote") remote = true;
    else if (arg === "--dry-run") dry = true;
    else if (arg === "--dir") dir = resolve(argv[++i] || "");
    else if (arg === "--persist-to") persist = argv[++i] || "";
    else if (arg === "--admin" || arg === "--director") i += 1;
    else throw new Error(`unknown argument ${arg}`);
  }
  if (remote && !argv.includes("--remote")) throw new Error("refusing to run against remote without --remote");
  const people = parsePeople(argv);
  const pack = readPack(dir);
  if (dry) {
    console.log("dry-run: no rows written.");
    reportCounts(countPack(pack, people));
    return;
  }
  applyAll(prefixFor(remote, persist), pack, people);
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  return import.meta.url.toLowerCase() === pathToFileURL(resolve(process.argv[1])).href.toLowerCase();
}

if (invokedDirectly()) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Import failed.");
    process.exitCode = 1;
  }
}
