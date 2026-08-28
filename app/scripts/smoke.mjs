import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const persistRel = ".smoke-persist";
const persist = join(appRoot, persistRel);
const port = Number(process.env.SMOKE_PORT || 8788);
const base = `http://127.0.0.1:${port}`;

let cookie = "";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(base + path, { redirect: "manual", ...opts, headers });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return res;
}

async function text(path, opts = {}) {
  const res = await req(path, opts);
  const body = await res.text();
  return { res, body };
}

function form(fields) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) {
      for (const item of v) f.append(k, String(item));
    } else if (v != null) {
      f.append(k, String(v));
    }
  }
  return f;
}

function countFor(html, key) {
  const re = new RegExp(`data-pipeline-key="${key}"[^>]*data-count="(\\d+)"`);
  const m = html.match(re);
  if (!m) throw new Error(`missing count for ${key}`);
  return Number(m[1]);
}

function optionValue(html, labelPart) {
  const re = new RegExp(`<option value="([^"]+)">([^<]*${labelPart}[^<]*)</option>`);
  const m = html.match(re);
  if (!m) throw new Error(`missing option ${labelPart}`);
  return m[1];
}

function firstInputValue(html, name) {
  const re = new RegExp(`name="${name}"[^>]*value="([^"]+)"`);
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(`value="([^"]+)"[^>]*name="${name}"`);
  const m2 = html.match(re2);
  if (!m2) throw new Error(`missing input ${name}`);
  return m2[1];
}

function fail(step, detail) {
  throw new Error(`SMOKE FAIL at ${step}: ${detail}`);
}

async function homeCounts() {
  const { res, body } = await text("/");
  if (res.status !== 200) fail("GET /", `status ${res.status}`);
  return {
    hbn: countFor(body, "hbn_queue"),
    dry: countFor(body, "dry_space_queue"),
    cryo: countFor(body, "cryo_queue"),
    testing: countFor(body, "testing_queue"),
    body,
  };
}

function runCmd(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: appRoot,
      shell: true,
      env: { ...process.env, BROWSER: "none", CI: "1" },
    });
    let buf = "";
    const onData = (chunk) => {
      const s = chunk.toString();
      buf += s;
      process.stdout.write(s);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(command + " exited " + code + "\n" + buf.slice(-2000)));
    });
  });
}

function startWrangler() {
  if (existsSync(persist)) rmSync(persist, { recursive: true, force: true });
  return runCmd(
    "npx wrangler d1 migrations apply gripfactory-lite-local --local --persist-to .smoke-persist"
  ).then(
    () =>
      new Promise((resolve, reject) => {
        const child = spawn(
          `npx wrangler dev --persist-to .smoke-persist --port ${port} --ip 127.0.0.1`,
          { cwd: appRoot, shell: true, env: { ...process.env, BROWSER: "none", CI: "1" } }
        );
        let buf = "";
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          child.kill();
          reject(new Error("wrangler did not become ready\n" + buf.slice(-2000)));
        }, 90000);
        const onExit = (code) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(new Error("wrangler exited " + code + "\n" + buf.slice(-2000)));
        };
        const onData = (chunk) => {
          const s = chunk.toString();
          buf += s;
          process.stdout.write(s);
          if (
            !settled &&
            (/Ready on http:\/\/127\.0\.0\.1:/.test(buf) || /Ready on http:\/\/localhost:/.test(buf))
          ) {
            settled = true;
            clearTimeout(timer);
            child.off("exit", onExit);
            resolve(child);
          }
        };
        child.stdout.on("data", onData);
        child.stderr.on("data", onData);
        child.on("exit", onExit);
      })
  );
}

function stopWrangler(child) {
  return new Promise((resolve) => {
    if (!child) return resolve();
    child.removeAllListeners("exit");
    child.on("exit", () => resolve());
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"]).on("exit", () => resolve());
    } else {
      child.kill("SIGTERM");
    }
    setTimeout(resolve, 4000);
  });
}

async function run() {
  const child = await startWrangler();
  try {
    let counts = await homeCounts();
    assert(counts.hbn === 0 && counts.dry === 0 && counts.cryo === 0 && counts.testing === 0, "queues should start empty");

    const addPerson = await req("/admin/lookups/people", {
      method: "POST",
      body: form({ action: "add", display_name: "Smoke Tester" }),
    });
    if (addPerson.status !== 303) fail("add person", `status ${addPerson.status}`);
    const loc = addPerson.headers.get("location") || "";
    const personId = new URL(loc, base).searchParams.get("person_id");
    if (!personId) fail("add person", "no person_id on redirect");
    await req("/person", { method: "POST", body: form({ person_id: personId }) });

    const acquireGet = await text("/station/acquire_hbn");
    const strainId = optionValue(acquireGet.body, "Fruity Pebbles");
    const create = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({
        person_id: personId,
        entry_date: "2026-09-01",
        farm_code: "ARL",
        grow_method_code: "GH",
        strain_id: strainId,
        start_time: "07:00",
      }),
    });
    if (create.status !== 303) fail("acquire HBN", `status ${create.status} ${await create.text()}`);
    const minted = new URL(create.headers.get("location") || "", base).searchParams.get("minted");
    assert(minted === "26244-ARL-GH-027-0-NA-26001", `unexpected HBN ${minted}`);

    counts = await homeCounts();
    assert(counts.hbn === 1, `hbn after acquire expected 1 got ${counts.hbn}`);
    assert(counts.dry === 0, `dry after acquire expected 0 got ${counts.dry}`);

    const second = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({
        person_id: personId,
        entry_date: "2026-09-01",
        farm_code: "ARL",
        grow_method_code: "GH",
        strain_id: strainId,
      }),
    });
    if (second.status !== 303) fail("second mint", `status ${second.status}`);
    const minted2 = new URL(second.headers.get("location") || "", base).searchParams.get("minted");
    assert(minted2 === "26244-ARL-GH-027-0-NA-26002", `unexpected second HBN ${minted2}`);

    counts = await homeCounts();
    assert(counts.hbn === 2, `hbn after second mint expected 2 got ${counts.hbn}`);

    const wetPage = await text("/station/wet_weight");
    const batchId = optionValue(wetPage.body, "26244-ARL-GH-027-0-NA-26001");
    const drySpaceId = optionValue(wetPage.body, "Silo 1");
    const wet = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        person_id: personId,
        harvest_batch_id: batchId,
        weight_grams: "1234.56",
        dry_space_id: drySpaceId,
        notes: "smoke lot",
      }),
    });
    if (wet.status !== 303) fail("wet weight", `status ${wet.status}`);

    counts = await homeCounts();
    assert(counts.hbn === 2, `hbn after wet expected 2 got ${counts.hbn}`);
    assert(counts.dry === 1, `dry after wet expected 1 got ${counts.dry}`);

    const trimPage = await text("/station/trim_packages");
    const lotId = optionValue(trimPage.body, "26244-ARL-GH-027-0-NA-26001");
    const trim = await req("/station/trim_packages", {
      method: "POST",
      body: form({
        person_id: personId,
        wet_weight_entry_id: lotId,
        package_code: ["BUD-SMOKE-1", "TRIM-SMOKE-1"],
        package_type_code: ["BUD", "TRIM"],
        weight_grams: ["100.00", "20.50"],
      }),
    });
    if (trim.status !== 303) fail("trim packages", `status ${trim.status}`);

    counts = await homeCounts();
    assert(counts.cryo === 1, `cryo after trim expected 1 (BUD only) got ${counts.cryo}`);
    assert(counts.testing === 0, `testing after trim expected 0 got ${counts.testing}`);
    assert(counts.dry === 1, `lot stays until marked trimmed, dry=${counts.dry}`);

    const cryoPage = await text("/station/cryo_weight");
    const pkgId = firstInputValue(cryoPage.body, "package_id");
    const cryo = await req("/station/cryo_weight", {
      method: "POST",
      body: form({
        person_id: personId,
        package_id: pkgId,
        cryo_weight_grams: "88.25",
      }),
    });
    if (cryo.status !== 303) fail("cryo weight", `status ${cryo.status}`);

    counts = await homeCounts();
    assert(counts.cryo === 0, `cryo after weight expected 0 got ${counts.cryo}`);
    assert(counts.testing === 1, `testing after cryo expected 1 got ${counts.testing}`);

    const testingPage = await text("/queue/testing_queue");
    const testId = firstInputValue(testingPage.body, "id");
    const release = await req("/queue/testing_queue/control", {
      method: "POST",
      body: form({
        person_id: personId,
        id: testId,
        control: "release",
        outcome: "passed",
        note: "smoke release",
      }),
    });
    if (release.status !== 303) fail("release", `status ${release.status}`);

    counts = await homeCounts();
    assert(counts.testing === 0, `testing after release expected 0 got ${counts.testing}`);

    const editOk = await req(`/record/wip_packages/${testId}/edit`, {
      method: "POST",
      body: form({
        person_id: personId,
        package_code: "BUD-SMOKE-1",
        package_type_code: "BUD",
        weight_grams: "101.00",
        cryo_weight_grams: "88.25",
        status: "released",
        test_outcome: "passed",
        reason: "smoke reasoned edit",
      }),
    });
    if (editOk.status !== 303) fail("reasoned edit", `status ${editOk.status}`);

    const logPage = await text("/log");
    assert(/smoke reasoned edit/.test(logPage.body), "change log missing reasoned edit");
    assert(/weight_grams/.test(logPage.body), "change log missing weight_grams field row");

    const editBad = await req(`/record/wip_packages/${testId}/edit`, {
      method: "POST",
      body: form({
        person_id: personId,
        package_code: "BUD-SMOKE-1",
        package_type_code: "BUD",
        weight_grams: "102.00",
        cryo_weight_grams: "88.25",
        status: "released",
        test_outcome: "passed",
        reason: "",
      }),
    });
    assert(editBad.status === 400, `reasonless edit expected 400 got ${editBad.status}`);
    const badBody = await editBad.text();
    assert(/Reason is required/.test(badBody), "reasonless edit should say reason is required");

    const csv = await text("/export/record_change_log.csv");
    assert(csv.res.status === 200, "change log csv");
    assert(/smoke reasoned edit/.test(csv.body), "csv missing reasoned edit");

    process.stdout.write("SMOKE PASS\n");
  } finally {
    await stopWrangler(child);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
