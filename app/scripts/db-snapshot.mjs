// THE SEED SNAPSHOT (canon 0.30.53). Owner, 2026-09-12: "take a snapshot of all
// seed data (including the settings in the admin toggles that don't get rolled".
//
// Dumps every table of the grip database (the one wrangler.toml names) to
// db_backups/<stamp>_<label>/<table>.json with a _manifest.json of row counts.
// Runs on the owner's machine (wrangler authorized):
//
//   node scripts/db-snapshot.mjs [label]        (default label: snapshot)
//
// wrangler d1 export fails under the OAuth login (MEMORY, 2026-09-06), so the
// dumps ride d1 execute --remote --json, one table at a time, as the purge
// runbook's backups did.
import { join } from "node:path";
import { ROOT_DIR, dumpAll, gripDatabase, nowStamp } from "./d1lib.mjs";

const label = (process.argv[2] ?? "snapshot").replace(/[^A-Za-z0-9_-]+/g, "_");
const db = gripDatabase();
const dir = join(ROOT_DIR, "db_backups", `${nowStamp()}_${label}`);
console.log(`[snapshot] database ${db.name} (${db.id}) -> ${dir}`);
const manifest = dumpAll(db.name, dir, { label });
const tables = Object.entries(manifest.tables);
const failed = tables.filter(([, v]) => v.error);
const rows = tables.reduce((n, [, v]) => n + (v.rows ?? 0), 0);
console.log(`[snapshot] ${tables.length} tables, ${rows} rows, ${failed.length} failed`);
if (failed.length) {
  for (const [t, v] of failed) console.log(`  FAILED ${t}: ${v.error}`);
  process.exit(1);
}
