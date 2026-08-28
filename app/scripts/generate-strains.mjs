import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = dirname(fileURLToPath(import.meta.url));
const csvPath = join(root, "../seed/strains.csv");
const outPath = join(root, "../migrations/0003_strains.sql");
const text = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
const header = lines.shift();
if (header !== "name,abbr,hbn_code") {
  throw new Error(`Unexpected strains.csv header: ${header}`);
}

const ts = "2026-08-27T00:00:00.000Z";
const rows = [];
for (const line of lines) {
  const parts = line.split(",");
  if (parts.length < 3) throw new Error(`Bad strain row: ${line}`);
  const hbn_code = parts[parts.length - 1].trim();
  const abbr = parts[parts.length - 2].trim();
  const name = parts.slice(0, parts.length - 2).join(",").trim();
  const id = randomUUID();
  const sqlName = name.replaceAll("'", "''");
  const sqlAbbr = abbr.length === 0 ? "NULL" : `'${abbr.replaceAll("'", "''")}'`;
  rows.push(
    `  ('${id}', '${sqlName}', ${sqlAbbr}, '${hbn_code}', '${ts}', NULL, '${ts}', NULL, NULL, NULL)`
  );
}

const sql = `-- Generated from seed/strains.csv (${rows.length} rows). Do not seed people.
INSERT OR IGNORE INTO strains (
  id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
${rows.join(",\n")};
`;
writeFileSync(outPath, sql, "utf8");
process.stdout.write(`Wrote ${rows.length} strains to ${outPath}\n`);
