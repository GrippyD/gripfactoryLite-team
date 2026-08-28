import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ? process.argv[2] : join(here, "..", "..");

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".wrangler",
  ".smoke-persist",
  "canon",
  "prompts",
]);
const SKIP_FILES = new Set(["worker-configuration.d.ts"]);

function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (!SKIP_FILES.has(name)) acc.push(full);
  }
  return acc;
}

const files = walk(root, []).sort((a, b) => a.localeCompare(b));
for (const file of files) {
  const buf = readFileSync(file);
  const rel = relative(root, file).replaceAll("\\", "/");
  const sha = createHash("sha256").update(buf).digest("hex");
  const tail = buf.subarray(Math.max(0, buf.length - 80));
  const visualized = Buffer.from(tail)
    .toString("utf8")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n");
  process.stdout.write(`${rel}\n`);
  process.stdout.write(`  wc -c: ${buf.length}\n`);
  process.stdout.write(`  sha256: ${sha}\n`);
  process.stdout.write(`  tail80: ${visualized}\n`);
}
process.stdout.write(`files: ${files.length}\n`);
