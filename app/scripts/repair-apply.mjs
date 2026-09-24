// THE REPAIR LANE WITHOUT THE IMPORT API (canon 0.30.118). On 2026-09-18 the
// owner's `wrangler d1 execute --remote --file` for a repair answered
// "Authentication error [code: 10000]" on the D1 /import endpoint (the --file
// path uploads the file and runs it through the import service; the OAuth login
// reaches /query but not always /import, as `d1 export` already did not, MEMORY
// 2026-09-06). This script applies a repair file statement by statement through
// `--command`, the same /query lane the snapshots ride, so the repair never
// needs the import API. A repair file is guarded and idempotent by the 0.30.91
// law, so a statement-at-a-time apply is safe to interrupt and re-run.
//
// Runs on the owner's machine (wrangler authorized), from app/:
//
//   node scripts/repair-apply.mjs scripts/repairs/<file>.sql            (remote grip database)
//   node scripts/repair-apply.mjs <file> --dry-run                      (print the statements, run nothing)
//   node scripts/repair-apply.mjs <file> --local <persist-dir>          (the local D1 under that persist dir; rehearsal)
//
// Rules for the file (cmd.exe carries each statement in one double-quoted
// argument): no double quotes, no percent signs, no newlines inside a string
// literal. Comment lines (--) are dropped; statements split on the semicolons
// that stand outside single-quoted strings.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APP_DIR, gripDatabase, run } from "./d1lib.mjs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: node scripts/repair-apply.mjs <repair.sql> [--dry-run] [--local <persist-dir>]");
  process.exit(2);
}
const dryRun = args.includes("--dry-run");
const localIdx = args.indexOf("--local");
const localPersist = localIdx >= 0 ? args[localIdx + 1] : null;
if (localIdx >= 0 && !localPersist) {
  console.error("--local needs the persist directory (the folder given to wrangler --persist-to)");
  process.exit(2);
}

/** Drop -- comment lines, then split on the semicolons outside single quotes. */
export function splitRepairSql(text) {
  const lines = text.split(/\r?\n/).filter((line) => !line.trim().startsWith("--"));
  const body = lines.join("\n");
  const statements = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "'") {
      // A doubled quote inside a string is an escaped quote, not a close.
      if (inString && body[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }
      inString = !inString;
    }
    if (ch === ";" && !inString) {
      const stmt = current.replace(/\s+/g, " ").trim();
      if (stmt) statements.push(stmt);
      current = "";
      continue;
    }
    current += ch;
  }
  const tail = current.replace(/\s+/g, " ").trim();
  if (tail) statements.push(tail);
  if (inString) throw new Error("unbalanced single quote in the repair file");
  return statements;
}

function checkShellSafe(stmt, n) {
  if (/"/.test(stmt)) throw new Error(`statement ${n} carries a double quote; the repair lane cannot carry it through cmd.exe`);
  if (/%/.test(stmt)) throw new Error(`statement ${n} carries a percent sign; cmd.exe reads it as a variable`);
  if (stmt.length > 7500) throw new Error(`statement ${n} is ${stmt.length} characters; cmd.exe stops at 8191`);
}

const path = resolve(APP_DIR, file);
const statements = splitRepairSql(readFileSync(path, "utf8"));
statements.forEach((s, i) => checkShellSafe(s, i + 1));
console.log(`[repair] ${file}: ${statements.length} statement(s)`);

if (dryRun) {
  statements.forEach((s, i) => console.log(`\n-- ${i + 1}\n${s};`));
  process.exit(0);
}

const target = localPersist
  ? { label: `local D1 under ${localPersist}`, prefix: `npx wrangler d1 execute gripfactory-lite-local --local --persist-to "${localPersist}"` }
  : (() => {
      const db = gripDatabase();
      return { label: `remote ${db.name} (${db.id})`, prefix: `npx wrangler d1 execute "${db.name}" --env grip --remote` };
    })();
console.log(`[repair] target: ${target.label}`);

let totalChanges = 0;
let totalWritten = 0;
for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const head = stmt.slice(0, 72).replace(/\s+/g, " ");
  const res = run(`${target.prefix} --json --command "${stmt}"`, { quiet: true });
  if (res.code !== 0) {
    console.error(`[repair] statement ${i + 1} failed (exit ${res.code}): ${head}...\n${res.out.slice(-3000)}`);
    console.error(`[repair] stopped after ${i} statement(s). Every statement is guarded; re-run the same command to finish.`);
    process.exit(1);
  }
  const start = res.stdout.indexOf("[");
  const parsed = start >= 0 ? JSON.parse(res.stdout.slice(start)) : null;
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first || first.success === false) {
    console.error(`[repair] statement ${i + 1} reported failure: ${head}...\n${JSON.stringify(first).slice(0, 2000)}`);
    process.exit(1);
  }
  // The remote /query meta carries changes and rows_written; the local
  // miniflare meta carries only the duration, so a local run reads n/a and
  // the rehearsal verifies by reading the database.
  const meta = first.meta ?? {};
  const hasCounts = meta.changes !== undefined || meta.rows_written !== undefined;
  const changes = Number(meta.changes ?? 0);
  const written = Number(meta.rows_written ?? 0);
  totalChanges += changes;
  totalWritten += written;
  const counts = hasCounts ? `changes=${changes} rows_written=${written}` : "changes=n/a (local meta)";
  console.log(`[repair] ${i + 1}/${statements.length} ok  ${counts}  ${head}...`);
}
console.log(`[repair] done: ${statements.length} statement(s), changes=${totalChanges}, rows_written=${totalWritten}`);
