import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const repoRoot = join(appRoot, "..");

function run(command, cwd) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n===== ${command} =====\n`);
    const child = spawn(command, {
      cwd,
      shell: true,
      env: { ...process.env, CI: "1", BROWSER: "none" },
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(command + " exited " + code));
    });
  });
}

async function main() {
  await run("node app/scripts/sealed-check.mjs", repoRoot);
  await run("npx tsc --noEmit", appRoot);
  await run("npx vitest run", appRoot);
  await run("node scripts/smoke.mjs", appRoot);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
