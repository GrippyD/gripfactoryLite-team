import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const persistRel = ".smoke-persist";
const persist = join(appRoot, persistRel);
const port = Number(process.env.SMOKE_PORT || 8788);
const base = `http://127.0.0.1:${port}`;

// The whole suite acts as this Access login (owner ruling 2026-08-31); the
// identity middleware auto-creates the person row on the first request.
const SMOKE_EMAIL = "smoke@gripcannabis.com";
const ADMIN_PIN = "21319";

const jar = new Map();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (!("Cf-Access-Authenticated-User-Email" in headers) && !opts.noIdentity) {
    headers["Cf-Access-Authenticated-User-Email"] = SMOKE_EMAIL;
  }
  if (jar.size > 0) {
    headers.cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  const res = await fetch(base + path, { redirect: "manual", ...opts, headers });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const [pair] = setCookie.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
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

function queueSectionHtml(html, key) {
  const start = html.indexOf(`data-pipeline-key="${key}"`);
  if (start === -1) throw new Error(`missing section ${key}`);
  const end = html.indexOf("</section>", start);
  return html.slice(start, end === -1 ? html.length : end);
}

function optionValue(html, labelPart) {
  const re = new RegExp(`<option value="([^"]+)">([^<]*${labelPart}[^<]*)</option>`);
  const m = html.match(re);
  if (!m) throw new Error(`missing option ${labelPart}`);
  return m[1];
}

function drySpaceIdByName(html, name) {
  const re = new RegExp(`<td>${name}</td>[^]*?href="/record/dry_spaces/([^/"]+)/edit"`);
  const m = html.match(re);
  if (!m) throw new Error(`missing dry space ${name} on Lookups`);
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
  const { res, body } = await text("/admin/queues");
  if (res.status !== 200) fail("GET /admin/queues", `status ${res.status}`);
  return {
    hbn: countFor(body, "hbn_queue"),
    dry: countFor(body, "dry_space_queue"),
    inbound: countFor(body, "inbound_queue"),
    cryo: countFor(body, "cryo_queue"),
    testing: countFor(body, "testing_queue"),
    body,
  };
}

function releaseFormId(html) {
  const re = /name="id" value="([^"]+)">\s*<input type="hidden" name="control" value="release"/;
  const m = html.match(re);
  if (!m) throw new Error("missing release form id on Data Queues");
  return m[1];
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
    const home = await text("/");
    if (home.res.status !== 200) fail("GET /", `status ${home.res.status}`);
    assert(!/data-count=/.test(home.body), "home must carry no queue tiles");
    assert(/data-pipeline-key="admin"/.test(home.body), "home must carry the Admin tile");

    // Identity chrome (owner ruling 2026-08-31): the login email replaces the Person picker.
    assert(home.body.includes(SMOKE_EMAIL), "chrome must show the login email");
    assert(!home.body.includes('id="gf_person"'), "chrome must carry no person picker");
    assert(!home.body.includes('action="/person"'), "chrome must carry no person form");
    const devHome = await text("/", { noIdentity: true });
    assert(devHome.body.includes("dev@local"), "headerless request must act as dev@local");

    assert(
      home.body.includes('name="locale" value="en"') && home.body.includes(">EN</button>"),
      "home missing the EN side of the locale pill"
    );
    assert(
      home.body.includes('name="locale" value="es"') && home.body.includes(">ES</button>"),
      "home missing the ES side of the locale pill"
    );

    const toEs = await req("/locale", { method: "POST", body: form({ locale: "es" }) });
    if (toEs.status !== 303) fail("POST /locale es", `status ${toEs.status}`);
    const esHome = await text("/");
    assert(esHome.body.includes("Inicio"), "es home missing Inicio");

    const toEn = await req("/locale", { method: "POST", body: form({ locale: "en" }) });
    if (toEn.status !== 303) fail("POST /locale en", `status ${toEn.status}`);
    const enHome = await text("/");
    assert(enHome.body.includes('href="/">Home</a>'), "en home missing Home after the restore");

    // PIN gate (owner ruling 2026-08-31): Admin and Interco refuse without the PIN.
    const gatedInterco = await text("/interco");
    assert(gatedInterco.res.status === 401, `gated interco expected 401 got ${gatedInterco.res.status}`);
    assert(gatedInterco.body.includes("Enter PIN"), "gated interco missing the PIN prompt");
    const gatedAdmin = await text("/admin/queues");
    assert(gatedAdmin.res.status === 401, `gated admin expected 401 got ${gatedAdmin.res.status}`);
    const wrongPin = await text("/pin", { method: "POST", body: form({ pin: "00000", next: "/admin" }) });
    assert(wrongPin.res.status === 401, `wrong PIN expected 401 got ${wrongPin.res.status}`);
    assert(wrongPin.body.includes("Wrong PIN."), "wrong PIN must say so");
    const evilNext = await req("/pin", {
      method: "POST",
      body: form({ pin: ADMIN_PIN, next: "//evil.example" }),
    });
    assert(evilNext.status === 303, `PIN unlock expected 303 got ${evilNext.status}`);
    assert(
      (evilNext.headers.get("location") || "").endsWith("/admin"),
      "an off-site next must fall back to /admin"
    );

    const interco = await text("/interco");
    if (interco.res.status !== 200) fail("GET /interco", `status ${interco.res.status}`);
    assert(interco.body.includes("Interco Logistics"), "interco stub missing its title");

    const adminLanding = await text("/admin");
    if (adminLanding.res.status !== 200) fail("GET /admin", `status ${adminLanding.res.status}`);
    const dq = adminLanding.body.indexOf("Data Queues");
    const lk = adminLanding.body.indexOf("Lookups");
    assert(dq !== -1 && lk !== -1 && dq < lk, "Admin landing must list Data Queues first");

    const redirect = await req("/queue/hbn_queue");
    assert(redirect.status === 302, `queue route should redirect, got ${redirect.status}`);
    assert((redirect.headers.get("location") || "").endsWith("/admin/queues"), "queue redirect target");

    let counts = await homeCounts();
    assert(
      counts.hbn === 0 && counts.dry === 0 && counts.inbound === 0 && counts.cryo === 0 && counts.testing === 0,
      "queues should start empty"
    );
    assert(counts.body.includes("Inbound Queue"), "Data Queues missing the Inbound Queue heading");

    const addPerson = await req("/admin/lookups/people", {
      method: "POST",
      body: form({ action: "add", display_name: "Smoke Tester" }),
    });
    if (addPerson.status !== 303) fail("add person", `status ${addPerson.status}`);
    const loc = addPerson.headers.get("location") || "";
    const personId = new URL(loc, base).searchParams.get("person_id");
    if (!personId) fail("add person", "no person_id on redirect");

    // The auto-created login person shows on Lookups with its email.
    const lookupsAfterAdd = await text("/admin/lookups");
    assert(lookupsAfterAdd.body.includes(SMOKE_EMAIL), "Lookups people missing the auto-created login person");
    assert(lookupsAfterAdd.body.includes("Smoke Tester"), "Lookups people missing the added person");

    const acquireGet = await text("/station/acquire_hbn");
    assert(!acquireGet.body.includes('name="person_id"'), "acquire form must carry no Person picker");
    const strainId = optionValue(acquireGet.body, "Fruity Pebbles");
    const create = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({
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
    if (wetPage.res.status !== 200) fail("GET /station/wet_weight", `status ${wetPage.res.status}`);
    assert(wetPage.body.includes("Pick from the left"), "wet weight page missing left pane prompt");
    const paneLink = wetPage.body.match(/href="\/station\/wet_weight\?pick=([^"]+)">([^<]+)</);
    if (!paneLink) fail("wet weight pane", "missing pane pick link");
    const batchId = paneLink[1];
    const pickedHbn = paneLink[2].split(" / ")[0];
    const pickedPage = await text(`/station/wet_weight?pick=${batchId}`);
    if (pickedPage.res.status !== 200) fail("GET picked wet weight", `status ${pickedPage.res.status}`);
    const hiddenBatch = firstInputValue(pickedPage.body, "harvest_batch_id");
    assert(hiddenBatch === batchId, `hidden batch id expected ${batchId} got ${hiddenBatch}`);
    assert(
      pickedPage.body.includes(`${pickedHbn} - Arlington`),
      `picked page missing header ${pickedHbn} - Arlington`
    );
    assert(pickedPage.body.includes("Lead"), "picked page missing the Lead label");
    assert(
      pickedPage.body.includes('name="lead_person_id"'),
      "picked page must carry the Lead picker as lead_person_id"
    );
    assert(pickedPage.body.includes("Start lot"), "picked page missing the Start lot button");
    assert(!pickedPage.body.includes('name="weight_grams"'), "picked header must carry no bucked weight input");
    assert(!pickedPage.body.includes('name="wet_spear_weight_grams"'), "picked header must carry no spear input");
    assert(pickedPage.body.includes("Add a truck"), "picked page missing the Add a truck control");
    assert(pickedPage.body.includes("Arlington Dry Room"), "ARL Move To must offer hang spaces");
    assert(!pickedPage.body.includes(">Silo 1<"), "ARL Move To must not offer silo spaces");
    assert(!pickedPage.body.includes("Hang in Place"), "ARL Move To must not offer PNN's Hang in Place");

    const lookupsPage = await text("/admin/lookups");
    if (lookupsPage.res.status !== 200) fail("GET /admin/lookups", `status ${lookupsPage.res.status}`);
    const drySpaceId = drySpaceIdByName(lookupsPage.body, "Silo 1");
    const startLot = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        lead_person_id: personId,
        harvest_batch_id: batchId,
        dry_space_id: drySpaceId,
        notes: "smoke lot",
      }),
    });
    if (startLot.status !== 303) fail("start lot", `status ${startLot.status}`);
    const wetLotId = new URL(startLot.headers.get("location") || "", base).searchParams.get("lot");
    if (!wetLotId) fail("start lot", "no lot id on redirect");
    let lotView = await text(`/station/wet_weight?lot=${wetLotId}`);
    if (lotView.res.status !== 200) fail("GET lot page", `status ${lotView.res.status}`);
    assert(lotView.body.includes("Weights"), "lot page missing the Weights pane");
    assert(lotView.body.includes(`${pickedHbn} - Arlington`), "lot page missing the HBN header");
    assert(lotView.body.includes("smoke lot"), "lot page missing the note");
    assert(lotView.body.includes("Smoke Tester"), "lot page must show the picked Lead");
    assert(lotView.body.includes("Finish lot"), "lot page missing the Finish lot button");

    for (const grams of ["1000.06", "234.50"]) {
      const addWeight = await req(`/station/wet_weight/lot/${wetLotId}/weights`, {
        method: "POST",
        body: form({ weight_grams: grams }),
      });
      if (addWeight.status !== 303) fail(`add weight ${grams}`, `status ${addWeight.status}`);
    }
    lotView = await text(`/station/wet_weight?lot=${wetLotId}`);
    assert(lotView.body.includes("1234.56"), "lot page missing total 1234.56");

    const finish = await req(`/station/wet_weight/lot/${wetLotId}/finish`, {
      method: "POST",
      body: form({}),
    });
    if (finish.status !== 303) fail("finish lot", `status ${finish.status}`);

    // Pane-only hide (owner ruling 2026-08-28): the finished batch leaves the wet weight
    // pane; the HBN Queue table keeps it until Mark complete.
    const otherHbn = pickedHbn === minted ? minted2 : minted;
    const wetAfterFinish = await text("/station/wet_weight");
    if (wetAfterFinish.res.status !== 200) {
      fail("GET wet weight after finish", `status ${wetAfterFinish.res.status}`);
    }
    assert(!wetAfterFinish.body.includes(pickedHbn), `pane must hide finished batch ${pickedHbn}`);
    assert(wetAfterFinish.body.includes(otherHbn), `pane must keep open batch ${otherHbn}`);

    counts = await homeCounts();
    assert(counts.hbn === 2, `hbn after wet expected 2 got ${counts.hbn}`);
    assert(counts.dry === 1, `dry after finish expected 1 got ${counts.dry}`);
    assert(counts.inbound === 0, `inbound after a silo finish expected 0 got ${counts.inbound}`);
    assert(counts.body.includes("Inbound Queue"), "Data Queues missing the Inbound Queue heading");
    assert(counts.body.includes("1234.56"), "Data Queues missing lot total 1234.56");
    assert(
      queueSectionHtml(counts.body, "hbn_queue").includes(pickedHbn),
      `HBN Queue must keep ${pickedHbn} until Mark complete`
    );

    const trimPage = await text("/station/trim_packages");
    const lotId = optionValue(trimPage.body, pickedHbn);
    const trim = await req("/station/trim_packages", {
      method: "POST",
      body: form({
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
        package_id: pkgId,
        cryo_weight_grams: "88.25",
      }),
    });
    if (cryo.status !== 303) fail("cryo weight", `status ${cryo.status}`);

    counts = await homeCounts();
    assert(counts.cryo === 0, `cryo after weight expected 0 got ${counts.cryo}`);
    assert(counts.testing === 1, `testing after cryo expected 1 got ${counts.testing}`);

    const testingPage = await text("/admin/queues");
    const testId = releaseFormId(testingPage.body);
    const release = await req("/queue/testing_queue/control", {
      method: "POST",
      body: form({
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
