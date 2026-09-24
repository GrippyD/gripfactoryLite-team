// THE BETA ROLL (canon 0.30.53). Owner, 2026-09-12, from the road: "Let's roll
// the db one last time and then take a snapshot of all seed data  (including
// the settings in the admin toggles that don't get rolled.  I'm about to release
// this for the true beta test)".
//
// One command at the owner's keyboard, from app\ (wrangler authorized there):
//
//   node scripts/roll-beta.mjs
//
// What it does, in order, stopping at the first red step:
//   1. Reads the grip database from wrangler.toml (THE NAME LAW) and probes it.
//   2. PRE-ROLL SNAPSHOT: dumps every table of the current database to
//      db_backups/<stamp>_pre_roll_<name>/ (the alpha's last picture, and the
//      source of the settings carried below).
//   3. Creates the new database gripfactory-lite-grip-<today> beside the old one
//      (the old one stands until the owner's own word deletes it); a re-run
//      finds the one already created and continues with it.
//   4. Patches the env.grip d1 block of wrangler.toml to the new name and id
//      (a copy of the old toml goes beside the dumps); applies migrations 0001
//      through the head from zero; deploys the worker so the binding points at
//      the new database. A failure here restores the toml before stopping.
//   5. CARRIES THE SEED TABLES: app_config (the admin toggles), lookup_values,
//      farms, strains, grow_methods, package_types, dry_spaces, label_templates,
//      suppliers, equipment_assets, equipment_pm_schedules, people are made to
//      read exactly as the pre-roll snapshot (DELETE, then INSERT), so what the
//      owner set in Admin survives the roll. Every other table starts empty:
//      lots, packages, moves, mounts (METRC and Zoho: drop the exports again),
//      orders, tests, tickets, the change log.
//   6. BETA SEED SNAPSHOT: dumps every table of the new database to
//      db_backups/<stamp>_beta_seed_<newname>/, the baseline for the true beta.
//   7. Verifies: carried counts equal the pre-roll counts, every other table
//      reads what the migrations alone seeded (usually zero); writes
//      DEPLOY/roll-result.json for the Scribe to fold.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  APP_DIR,
  ROOT_DIR,
  TOML_PATH,
  carrySql,
  d1File,
  d1Query,
  dumpAll,
  gripDatabase,
  listTables,
  nowStamp,
  patchGripDatabase,
  readDump,
  run,
  todayCompact,
} from "./d1lib.mjs";

const CARRY_TABLES = [
  "app_config",
  "lookup_values",
  "farms",
  "strains",
  "grow_methods",
  "package_types",
  "dry_spaces",
  "label_templates",
  "suppliers",
  "equipment_assets",
  "equipment_pm_schedules",
  "people",
];

const stamp = nowStamp();
const result = {
  stamp,
  started_at: new Date().toISOString(),
  ok: false,
  step_failed: "",
  old: null,
  new: null,
  version_id: "",
  migrations_applied: "",
  pre_roll_dir: "",
  beta_seed_dir: "",
  carried: {},
  cleared: {},
  mismatches: [],
  finished_at: "",
};
const deployDir = join(ROOT_DIR, "DEPLOY");
mkdirSync(deployDir, { recursive: true });
const writeResult = () => {
  result.finished_at = new Date().toISOString();
  writeFileSync(join(deployDir, "roll-result.json"), JSON.stringify(result, null, 2), "utf8");
};
const fail = (step, err) => {
  result.step_failed = step;
  result.error = String(err && err.message ? err.message : err).slice(0, 4000);
  writeResult();
  console.error(`\n[roll] STOPPED at ${step}: ${result.error}`);
  process.exit(1);
};

// 1. the database of record, probed
const tomlBefore = readFileSync(TOML_PATH, "utf8");
const old = gripDatabase(tomlBefore);
result.old = old;
console.log(`[roll] current grip database: ${old.name} (${old.id})`);
try {
  d1Query(old.name, "SELECT 1 AS one");
} catch (e) {
  fail("probe", e);
}

// 2. the pre-roll snapshot
const preDir = join(ROOT_DIR, "db_backups", `${stamp}_pre_roll_${old.name}`);
result.pre_roll_dir = preDir;
console.log(`\n[roll] pre-roll snapshot of ${old.name} -> ${preDir}`);
let preManifest;
try {
  preManifest = dumpAll(old.name, preDir, { label: "pre_roll" });
} catch (e) {
  fail("pre-roll snapshot", e);
}
const preFailed = Object.entries(preManifest.tables).filter(([, v]) => v.error);
if (preFailed.length) fail("pre-roll snapshot", new Error(`tables failed to dump: ${preFailed.map(([t]) => t).join(", ")}`));
for (const t of CARRY_TABLES) {
  if (!(t in preManifest.tables)) fail("pre-roll snapshot", new Error(`carried table ${t} is not in the database`));
}
copyFileSync(TOML_PATH, join(preDir, "wrangler.toml.before-roll"));

// 3. the new database beside the old (a re-run reuses one already created:
//    the first run of 2026-09-12 created the database and then hit D1's free
//    tier daily write limit at the migrations, code 7500; the same command
//    picks the roll up from there)
let newName = `gripfactory-lite-grip-${todayCompact()}`;
if (newName === old.name) newName = `${newName}b`;
let newId = existingDatabaseId(newName);
if (newId) {
  console.log(`\n[roll] ${newName} already exists (${newId}); reusing it, the migrations apply picks up where it stopped`);
} else {
  console.log(`\n[roll] creating ${newName}`);
  const created = run(`npx wrangler d1 create "${newName}"`);
  if (created.code !== 0) fail("d1 create", new Error(created.out.slice(-3000)));
  const idMatch = /database_id["'\s:=]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(created.out);
  if (!idMatch) fail("d1 create", new Error(`no database_id in wrangler's output:\n${created.out.slice(-3000)}`));
  newId = idMatch[1];
  console.log(`[roll] created ${newName} (${newId})`);
}
result.new = { name: newName, id: newId };

// 4. the toml, the migrations, the deploy (the toml restored on a red step)
const tomlAfter = patchGripDatabase(tomlBefore, newName, newId);
writeFileSync(TOML_PATH, tomlAfter, "utf8");
const restoreToml = () => writeFileSync(TOML_PATH, tomlBefore, "utf8");
const probeNew = d1QuerySafe(newName, "SELECT 1 AS one");
if (!probeNew.ok) {
  restoreToml();
  fail("probe new", probeNew.error);
}
const applied = run(`npx wrangler d1 migrations apply "${newName}" --env grip --remote`, { input: "y\n" });
if (applied.code !== 0) {
  restoreToml();
  if (/code: 7500|daily row write limit/i.test(applied.out)) {
    console.error("\n[roll] D1's FREE TIER daily row write limit is spent for this UTC day (100,000 rows, indexes counted). The account cannot write until 00:00 UTC (8:00 PM Eastern). Upgrade the Cloudflare plan (Workers Paid lifts the daily cap) or wait, then run this same command again; the database created today is reused.");
  } else if (/already exists/i.test(applied.out)) {
    console.error(`\n[roll] a migration is half applied in ${newName} from an earlier stopped run. Delete that empty database (npx wrangler d1 delete "${newName}") and run this same command again; it will create the database afresh.`);
  }
  fail("migrations apply", new Error(applied.out.slice(-4000)));
}
const migCount = /(\d+) migration/.exec(applied.out);
result.migrations_applied = migCount ? migCount[1] : "(see output)";
const deployed = run("npm run deploy:grip");
if (deployed.code !== 0) {
  restoreToml();
  fail("deploy", new Error(deployed.out.slice(-4000)));
}
const ver = /Version ID:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(deployed.out);
result.version_id = ver ? ver[1] : "";
console.log(`[roll] deployed, version ${result.version_id || "(unparsed)"}; migrations ${result.migrations_applied}`);

// 4b. THE SEED BASELINE: what the migrations alone put on the fresh floor (the
//     equipment migration seeds PM logs and tickets, for one). The verification
//     below expects those counts, not zero, on every table the carry skips. The
//     first roll of 2026-09-14 read "NOT OK" on exactly that false alarm
//     (equipment_pm_logs 98, equipment_tickets 3) with every carry exact.
const seeded = {};
for (const t of listTables(newName)) {
  const row = d1Query(newName, `SELECT COUNT(*) AS n FROM ${t}`)[0];
  seeded[t] = Number(row?.n ?? 0);
}
result.seeded = Object.fromEntries(Object.entries(seeded).filter(([, n]) => n > 0));
console.log(`[roll] seeded by the migrations: ${Object.entries(result.seeded).map(([t, n]) => `${t} ${n}`).join(", ") || "nothing"}`);

// 5. the seed tables carried from the pre-roll snapshot
const carryLines = ["-- THE BETA ROLL: seed tables carried from the pre-roll snapshot", `-- from ${old.name} to ${newName}, ${new Date().toISOString()}`];
for (const t of CARRY_TABLES) {
  const rows = readDump(preDir, t) ?? [];
  carryLines.push(...carrySql(t, rows));
  result.carried[t] = { expected: rows.length };
}
const carryPath = join(preDir, "_carry.sql");
writeFileSync(carryPath, carryLines.join("\n") + "\n", "utf8");
console.log(`\n[roll] carrying ${CARRY_TABLES.length} seed tables (${carryPath})`);
try {
  d1File(newName, carryPath);
} catch (e) {
  fail("carry", e);
}

// 6. the beta seed snapshot
const betaDir = join(ROOT_DIR, "db_backups", `${stamp}_beta_seed_${newName}`);
result.beta_seed_dir = betaDir;
console.log(`\n[roll] beta seed snapshot of ${newName} -> ${betaDir}`);
let betaManifest;
try {
  betaManifest = dumpAll(newName, betaDir, { label: "beta_seed" });
} catch (e) {
  fail("beta seed snapshot", e);
}
copyFileSync(TOML_PATH, join(betaDir, "wrangler.toml.after-roll"));

// 7. the verification
for (const t of CARRY_TABLES) {
  const got = betaManifest.tables[t]?.rows;
  result.carried[t].got = got;
  if (got !== result.carried[t].expected) result.mismatches.push(`${t}: expected ${result.carried[t].expected}, got ${got}`);
}
for (const t of listTables(newName)) {
  if (CARRY_TABLES.includes(t)) continue;
  const n = betaManifest.tables[t]?.rows ?? null;
  const expected = seeded[t] ?? 0;
  result.cleared[t] = n;
  if (n !== expected) result.mismatches.push(`${t}: expected ${expected} after the roll (${expected ? "the migrations' seed" : "empty"}), got ${n}`);
}
result.ok = result.mismatches.length === 0 && Boolean(result.version_id);
writeResult();

console.log("\n================ THE BETA ROLL ================");
console.log(`old database  ${old.name} (${old.id})  stands until the owner's word deletes it`);
console.log(`new database  ${newName} (${newId})`);
console.log(`migrations    ${result.migrations_applied}`);
console.log(`worker        ${result.version_id}`);
console.log(`pre-roll      ${preDir}`);
console.log(`beta seed     ${betaDir}`);
console.log(`carried       ${CARRY_TABLES.map((t) => `${t} ${result.carried[t].got}`).join(", ")}`);
console.log(`cleared       ${Object.keys(result.cleared).length} tables at their fresh-floor counts (${Object.keys(result.seeded).length} of them seeded by the migrations)`);
if (result.mismatches.length) console.log(`MISMATCHES    ${result.mismatches.join("; ")}`);
console.log(`result        ${join(deployDir, "roll-result.json")}`);
console.log(result.ok ? "OK: the beta floor is set." : "NOT OK: read the mismatches above.");
process.exit(result.ok ? 0 : 2);

/** The id of a database already on the account by this name, else null
 * (wrangler d1 list --json prints every database with its uuid and name). */
function existingDatabaseId(name) {
  const listed = run("npx wrangler d1 list --json", { quiet: true });
  if (listed.code !== 0) return null;
  const start = listed.stdout.indexOf("[");
  if (start < 0) return null;
  try {
    const dbs = JSON.parse(listed.stdout.slice(start));
    const hit = dbs.find((d) => d && d.name === name);
    return hit ? hit.uuid || hit.id || null : null;
  } catch {
    return null;
  }
}

function d1QuerySafe(name, sql) {
  try {
    return { ok: true, rows: d1Query(name, sql) };
  } catch (error) {
    return { ok: false, error };
  }
}
