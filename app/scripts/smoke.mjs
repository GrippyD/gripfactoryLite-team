import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const persistRel = ".smoke-persist";
const persist = join(appRoot, persistRel);
const port = Number(process.env.SMOKE_PORT || 8788);
const base = `http://127.0.0.1:${port}`;

// The whole suite acts as this Access login (owner ruling 2026-08-31); the
// identity middleware auto-creates the person row on the first request.
const SMOKE_EMAIL = "smoke@gripcannabis.com";
const ADMIN_PIN = "21319";
// THE MODELS BUTTON (canon 0.30.86): the second PIN, seeded by migration 0051.
const MODELS_PIN = "17853";
// THE SALESHELPER BATCH (canon 0.30.65): the vendored pair's own facts, read
// from disk so a re-vendor by the vendored-pair law moves these pins with it.
const SH_STATIC = JSON.parse(readFileSync(join(appRoot, "public", "saleshelper", "menu.json"), "utf8"));
const SH_INDEX = readFileSync(join(appRoot, "public", "saleshelper", "index.html"), "utf8");
const SH_HEADER_TIME = (SH_INDEX.match(/Inventory updated <span data-inventory-time>([^<]*)<\/span>/) || [])[1] || "";
// SalesHelper canon 4b: the form's send gate value, visible by design.
const SH_SEND_KEY = "grip-c4aba3e1d0320e1acb5d5716";

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

/** THE LOAD AND THE LOT: a finished entry reaches Load Silo only after >>. */
async function passEntry(entryId) {
  const page = await text("/logistics/internal");
  const rows = [...page.body.matchAll(/data-logistics-lot="([^"]+)" data-logistics-parts="([^"]*)"/g)];
  const hit = rows.find((row) => row[1] === entryId || row[2].split(/\s+/).includes(entryId));
  if (!hit) return null;
  const available = page.body.slice(page.body.indexOf('data-schedule-pane="available"'), page.body.indexOf('data-schedule-pane="working"'));
  if (!available.includes(`data-logistics-lot="${hit[1]}"`)) return hit[1];
  const res = await req("/logistics/internal/schedule", { method: "POST", body: form({ harvest_batch_id: hit[1] }) });
  const detail = res.status === 303 ? "" : await res.text();
  assert(res.status === 303, `passing ${entryId} expected 303 got ${res.status} ${detail}`);
  return hit[1];
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

/** THE METRC MIRROR (canon 0.30.38): a plants xlsx exactly as METRC writes it
 * (shared strings, booleans, dates as serials under numFmt 14, one sheet),
 * zipped with real deflate so the Worker's inflater is the thing under test.
 * rows: [tag, strain, location, sublocation, hold, batch, batchType, batchDateSerial, phaseDateSerial, harvested]. */
function buildPlantsXlsx(rows) {
  const header = ["Tag", "Strain", "Location", "Sublocation", "Hold", "Plant Batch", "Plant Batch Type", "Plant Batch Date", "Phase Date", "Harvested"];
  const strings = [...header];
  const sIdx = (s) => {
    let i = strings.indexOf(s);
    if (i < 0) {
      strings.push(s);
      i = strings.length - 1;
    }
    return i;
  };
  const cols = "ABCDEFGHIJ";
  const xmlRows = [];
  xmlRows.push(`<row r="1">${header.map((h, i) => `<c r="${cols[i]}1" s="1" t="s"><v>${sIdx(h)}</v></c>`).join("")}</row>`);
  rows.forEach((r, n) => {
    const rn = n + 2;
    const cells = [
      `<c r="A${rn}" t="s"><v>${sIdx(r[0])}</v></c>`,
      `<c r="B${rn}" t="s"><v>${sIdx(r[1])}</v></c>`,
      `<c r="C${rn}" t="s"><v>${sIdx(r[2])}</v></c>`,
      r[3] ? `<c r="D${rn}" t="s"><v>${sIdx(r[3])}</v></c>` : `<c r="D${rn}"  >\n\n</c>`,
      `<c r="E${rn}" t="b"><v>${r[4] ? 1 : 0}</v></c>`,
      `<c r="F${rn}" t="s"><v>${sIdx(r[5])}</v></c>`,
      `<c r="G${rn}" t="s"><v>${sIdx(r[6])}</v></c>`,
      `<c r="H${rn}" s="2"><v>${r[7]}</v></c>`,
      `<c r="I${rn}" s="2"><v>${r[8]}</v></c>`,
      `<c r="J${rn}" t="n"><v>${r[9]}</v></c>`,
    ];
    xmlRows.push(`<row r="${rn}" x14ac:dyDescent="0.25"\n>\n${cells.join("\n")}\n</row>`);
  });
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"></numFmts><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" /><xf xfId="0" fontId="1" applyFont="1" fillId="2" applyFill="1"></xf><xf xfId="0" numFmtId="14" applyNumberFormat="1"></xf></cellXfs></styleSheet>`,
    "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t xml:space="preserve">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</t></si>`).join("")}</sst>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"><dimension ref="A1"/><sheetData>${xmlRows.join("\n")}</sheetData></worksheet>`,
  };
  const le16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
  const le32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, textBody] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const raw = enc.encode(textBody);
    const data = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = [
      ...le32(0x04034b50), ...le16(20), ...le16(0), ...le16(8), ...le16(0), ...le16(0),
      ...le32(crc), ...le32(data.length), ...le32(raw.length), ...le16(nameBytes.length), ...le16(0),
      ...nameBytes, ...data,
    ];
    centrals.push(
      ...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0), ...le16(8), ...le16(0), ...le16(0),
      ...le32(crc), ...le32(data.length), ...le32(raw.length), ...le16(nameBytes.length), ...le16(0), ...le16(0),
      ...le16(0), ...le16(0), ...le32(0), ...le32(offset), ...nameBytes
    );
    locals.push(...local);
    offset += local.length;
  }
  const count = Object.keys(files).length;
  const eocd = [...le32(0x06054b50), ...le16(0), ...le16(0), ...le16(count), ...le16(count), ...le32(centrals.length), ...le32(locals.length), ...le16(0)];
  return new Uint8Array([...locals, ...centrals, ...eocd]);
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

function firstSelectValue(html, name) {
  const block = html.match(new RegExp(`<select name="${name}"[^>]*>([\\s\\S]*?)</select>`));
  if (!block) throw new Error(`missing select ${name}`);
  const opts = [...block[1].matchAll(/<option value="([^"]*)">/g)];
  const hit = opts.find((o) => o[1]);
  if (!hit) throw new Error(`empty select ${name}`);
  return hit[1];
}

function loadPageStripHasSpaces(page) {
  return page.res.status === 200 && page.body.includes("data-silo-strip") && !page.body.includes("data-ffz");
}

function drySpaceIdByName(html, name) {
  // THE BLAST FREEZER(S) (canon 0.30.106): a name may carry regex specials.
  const re = new RegExp(`<td>${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</td>[^]*?href="/record/dry_spaces/([^/"]+)/edit"`);
  const m = html.match(re);
  if (!m) throw new Error(`missing dry space ${name} on Lookups`);
  return m[1];
}

// THE EFFECTIVE DATE (canon 0.30.92): the farm's clock, as src/farmday.ts
// resolves it (Eastern), so the smoke can name the instant a typed wall clock
// on a day must land on.
const SMOKE_FARM_TZ = "America/New_York";
function etDateSmoke(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SMOKE_FARM_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const pick = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}
// THE FARM DAY BEGINS AT SIX (canon 0.30.151): the farm's day rolls at 6:00 AM
// Eastern (app_config farm_day_start_hour, seeded 6), so the smoke names today
// and yesterday the way the worker does.
const SMOKE_FARM_DAY_START = 6;
function etHourSmoke(iso) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: SMOKE_FARM_TZ, hourCycle: "h23", hour: "2-digit" }).formatToParts(new Date(iso));
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}
function dayBeforeSmoke(date) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
}
function farmDaySmoke(iso) {
  const date = etDateSmoke(iso);
  return etHourSmoke(iso) < SMOKE_FARM_DAY_START ? dayBeforeSmoke(date) : date;
}
function etOffsetMinutesSmoke(at) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SMOKE_FARM_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const pick = (type) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour"), pick("minute"), pick("second"));
  return Math.round((at.getTime() - asUtc) / 60_000);
}
function etWallClockSmoke(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SMOKE_FARM_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const pick = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}`;
}
function etInstantSmoke(date, hhmm) {
  const [hh, mm] = hhmm.split(":").map(Number);
  const wallAsUtc = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), hh, mm);
  let instant = wallAsUtc + etOffsetMinutesSmoke(new Date(wallAsUtc)) * 60_000;
  instant = wallAsUtc + etOffsetMinutesSmoke(new Date(instant)) * 60_000;
  return new Date(instant).toISOString();
}

function invGrams(html, key) {
  const re = new RegExp(`data-inv-row="${key}"[^>]*data-grams="([^"]+)"`);
  const m = html.match(re);
  if (!m) throw new Error(`missing inventory row ${key}`);
  return m[1];
}

function checkboxNear(html, needle) {
  const idx = html.indexOf(needle);
  if (idx === -1) throw new Error(`missing ${needle}`);
  const window = html.slice(Math.max(0, idx - 500), idx + 800);
  const m = window.match(/name="item_id" value="([^"]+)"/) || window.match(/value="([^"]+)"[^>]*name="item_id"/);
  if (!m) throw new Error(`missing item_id near ${needle}`);
  return m[1];
}

async function bin(path, opts = {}) {
  const res = await req(path, opts);
  const buf = new Uint8Array(await res.arrayBuffer());
  return { res, buf, text: new TextDecoder("utf-8").decode(buf), latin: new TextDecoder("latin1").decode(buf) };
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

async function finishUnloadLot(lotId, fields = {}, gateChoice = "nothing") {
  const first = await req(`/station/unload_dry_space/lot/${lotId}/finish`, {
    method: "POST",
    body: form(fields),
  });
  if (first.status !== 303) fail("finish unload", `status ${first.status}`);
  let loc = first.headers.get("location") || "";
  if (loc.includes("gate=1")) {
    const path = loc.startsWith("http") ? new URL(loc).pathname + new URL(loc).search : loc;
    const gate = await text(path);
    assert(gate.res.status === 200, `gate page expected 200 got ${gate.res.status}`);
    assert(
      gate.body.includes("data-reconcile-gate") || gate.body.includes('name="gate_choice"'),
      "a mismatched finish must render the METRC gate"
    );
    const second = await req(`/station/unload_dry_space/lot/${lotId}/finish`, {
      method: "POST",
      body: form({ ...fields, gate_choice: gateChoice }),
    });
    if (second.status !== 303) fail("finish unload gate", `status ${second.status}`);
    loc = second.headers.get("location") || "";
    return { loc, gateBody: gate.body, gated: true };
  }
  return { loc, gateBody: "", gated: false };
}

function assertOpsMap(html, label) {
  assert(
    html.includes("<h1>Operations</h1>") || html.includes("<h1>Operaciones</h1>"),
    `${label} missing the Operations heading`
  );
  for (const key of [
    "harvest_ops",
    "interco_logistics",
    "drying_ops",
    "production_ops",
    "marketplace",
    "business_ops",
  ]) {
    const n = (html.match(new RegExp(`data-ops-key="${key}"`, "g")) || []).length;
    assert(n === 2, `${label} must render ${key} on desktop and phone, got ${n}`);
  }
  assert(html.includes('href="/ops/harvest_ops"'), `${label} missing harvest href`);
  assert(html.includes('href="/ops/interco_logistics"'), `${label} missing logistics href`);
  assert(html.includes("Logistics Operations"), `${label} missing the Logistics Operations label`);
  assert(html.includes('href="/marketplace"'), `${label} missing live Marketplace href`);
  const marketNode = html.slice(
    html.indexOf('data-ops-key="marketplace"') - 80,
    html.indexOf('data-ops-key="marketplace"') + 40
  );
  assert(!marketNode.includes("ops-node-stub"), `${label} Marketplace node must not carry ops-node-stub`);
  assert(html.includes('class="ops-arrow ops-arrow-right"'), `${label} missing right arrow`);
  assert(html.includes('class="ops-arrow ops-arrow-down"'), `${label} missing down arrow`);
  assert(html.includes('class="ops-arrow ops-arrow-left"'), `${label} missing left arrow`);
  assert(html.includes("ops-map-desktop"), `${label} missing the desktop map`);
  assert(html.includes("ops-map-phone"), `${label} missing the phone map`);
  assert(html.includes('src="/icons/white/harvest-field.svg"'), `${label} missing harvest-field img`);
  assert(html.includes('src="/icons/white/interco-truck.svg"'), `${label} missing interco-truck img`);
  assert(html.includes('src="/icons/dark/drying-silo.svg"'), `${label} missing drying-silo dark img`);
  assert(html.includes("ops-icon-on-dark"), `${label} missing the dark-ground icon class`);
  assert(html.includes("ops-icon-on-light"), `${label} missing the light-ground icon class`);
  assert(!html.includes('data-pipeline-key="admin"'), `${label} must drop the old Admin tile`);
  assert(!html.includes('data-pipeline-key="acquire_hbn"'), `${label} must drop station tiles`);
}

async function homeCounts() {
  const { res, body } = await text("/admin/queues");
  if (res.status !== 200) fail("GET /admin/queues", `status ${res.status}`);
  return {
    hbn: countFor(body, "hbn_queue"),
    dry: countFor(body, "dry_space_queue"),
    unloaded: countFor(body, "unloaded_queue"),
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
      if (code === 0) resolve(buf);
      else reject(new Error(command + " exited " + code + "\n" + buf.slice(-2000)));
    });
  });
}

function startWrangler() {
  if (existsSync(persist)) rmSync(persist, { recursive: true, force: true });
  return runCmd(
    "npx wrangler d1 migrations apply gripfactory-lite-local --local --persist-to .smoke-persist"
  ).then((applyOut) => {
    if (!String(applyOut).includes("About to apply 77 migration(s)")) {
      throw new Error(`from-zero apply must say 77 migrations\n${String(applyOut).slice(-2000)}`);
    }
    return new Promise((resolve, reject) => {
      const child = spawn(
        // THE SHEET SYNC (canon 0.30.162): the cron is walked through /__scheduled, and the
        // default env reads the smoke's own fixture workbook, never the owner's file.
        `npx wrangler dev --persist-to .smoke-persist --port ${port} --ip 127.0.0.1 --test-scheduled --var SHEET_FIXTURE_URL:http://127.0.0.1:${port}/__sheet-fixture --var SENSORPUSH_API_BASE:http://127.0.0.1:${port}/__sensorpush --var SENSORPUSH_EMAIL:smoke@local --var SENSORPUSH_PASSWORD:smoke`,
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
    });
  });
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
    assertOpsMap(home.body, "default (co) home");
    for (const iconPath of [
      "/icons/white/harvest-field.svg",
      "/icons/white/interco-truck.svg",
      "/icons/dark/drying-silo.svg",
      "/icons/dark/business-scale.svg",
    ]) {
      const icon = await req(iconPath);
      assert(icon.status === 200, `${iconPath} expected 200 got ${icon.status}`);
    }

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
    assert(esHome.body.includes("<h1>Operaciones</h1>"), "es home missing Operaciones");

    const toEn = await req("/locale", { method: "POST", body: form({ locale: "en" }) });
    if (toEn.status !== 303) fail("POST /locale en", `status ${toEn.status}`);
    const enHome = await text("/");
    assert(enHome.body.includes('href="/">Home</a>'), "en home missing Home after the restore");

    // Owner ruling 2026-09-09 (canon 0.30.28, verbatim: "add a return to
    // continuum link at the top of the homepage only present when in continuum
    // format on the format pill.  Make the continuum format loading default"):
    // with no view cookie the home loads in the Continuum format, CO active on
    // the pill, no Cerberus chrome, and the Back to the Continuum 10 crumb
    // leads the page, before the Operations heading.
    const CONTINUUM_CRUMB = '<a class="continuum-crumb" href="https://gripcontinuum.gripcannabis.com/#/">&#8592; Back to the Continuum 10</a>';
    assert(home.body.includes("--bg: #0e0f11"), "the default home must render the Continuum tokens");
    assert(!home.body.includes("--gold:#f1c232"), "the default home must not carry the Cerberus token");
    assert(home.body.includes('class="locale-pill view-pill"'), "home missing the view pill");
    assert(
      home.body.includes('name="view" value="co" class="view-opt view-opt-co active"'),
      "the default view pill must mark CO active"
    );
    assert(home.body.includes('name="view" value="lite"'), "home missing the Lite side of the view pill");
    assert(home.body.includes('name="view" value="cerberus"'), "home missing the Grip side of the view pill");
    assert(!home.body.includes('id="boot-scrawl"'), "the default home must carry no boot scrawl");
    assert(home.body.includes(CONTINUUM_CRUMB), "the default (co) home must lead with the Back to the Continuum 10 crumb");
    assert(
      home.body.indexOf(CONTINUUM_CRUMB) < home.body.indexOf("<h1>Operations</h1>"),
      "the crumb must sit at the top of the home page, above Operations"
    );
    assert((home.body.match(/class="continuum-crumb"/g) || []).length === 1, "exactly one crumb on the home page");
    // The crumb is the home page's alone: no other page carries it.
    const reportsInCo = await text("/reports");
    assert(!reportsInCo.body.includes('class="continuum-crumb"'), "the crumb must stay off every page but home");
    // The Cerberus view (owner ruling 2026-09-01) is a pick now, no longer the
    // default: picking Grip restores the gold, the scrawl, and drops the crumb.
    const toCerberusFirst = await req("/view", { method: "POST", body: form({ view: "cerberus" }) });
    if (toCerberusFirst.status !== 303) fail("POST /view cerberus (first pick)", `status ${toCerberusFirst.status}`);
    const gripHome = await text("/");
    assert(gripHome.body.includes("--gold:#f1c232"), "the Grip home must carry the Cerberus token");
    assert(
      gripHome.body.includes('name="view" value="cerberus" class="view-opt active"'),
      "the Grip view pill must mark Grip active"
    );
    assert(gripHome.body.includes('id="boot-scrawl"'), "cerberus home missing the boot scrawl overlay");
    assert(gripHome.body.includes("gf_boot_seen"), "cerberus home missing the boot scrawl session guard");
    assert(!gripHome.body.includes('class="continuum-crumb"'), "the Grip home must carry no Continuum crumb");
    assertOpsMap(gripHome.body, "cerberus home");

    const toLite = await req("/view", { method: "POST", body: form({ view: "lite" }) });
    if (toLite.status !== 303) fail("POST /view lite", `status ${toLite.status}`);
    const liteHome = await text("/");
    assert(!liteHome.body.includes("--gold:#f1c232"), "lite home must carry no Cerberus token");
    assert(!liteHome.body.includes("boot-scrawl"), "lite home must carry no boot scrawl");
    assert(!liteHome.body.includes('class="continuum-crumb"'), "the Lite home must carry no Continuum crumb");
    assertOpsMap(liteHome.body, "lite home");
    assert(liteHome.body.includes("--ops-arrow: var(--accent)"), "lite map arrows must use the accent token");
    assert(
      liteHome.body.includes('name="view" value="lite" class="view-opt active"'),
      "the lite view pill must mark Lite active"
    );
    // Owner ruling 2026-09-01: the Lite view gets the brand lockup too; its
    // old text brand retires.
    assert(
      liteHome.body.includes('class="brand brand-lockup"'),
      "the lite bar must carry the brand lockup"
    );
    assert(
      !liteHome.body.includes('<div class="brand">Gripfactory'),
      "the lite bar must drop the old text brand"
    );

    // The locale pill still works under lite.
    const liteEs = await req("/locale", { method: "POST", body: form({ locale: "es" }) });
    if (liteEs.status !== 303) fail("POST /locale es under lite", `status ${liteEs.status}`);
    const liteEsHome = await text("/");
    assert(liteEsHome.body.includes("Inicio"), "lite es home missing Inicio");
    assert(!liteEsHome.body.includes("--gold:#f1c232"), "lite es home must stay lite");
    const liteEn = await req("/locale", { method: "POST", body: form({ locale: "en" }) });
    if (liteEn.status !== 303) fail("POST /locale en under lite", `status ${liteEn.status}`);

    const toCerberus = await req("/view", { method: "POST", body: form({ view: "cerberus" }) });
    if (toCerberus.status !== 303) fail("POST /view cerberus", `status ${toCerberus.status}`);
    const cerberusHome = await text("/");
    assert(cerberusHome.body.includes("--gold:#f1c232"), "the restored home must carry the Cerberus token");
    assert(
      cerberusHome.body.includes('name="view" value="cerberus" class="view-opt active"'),
      "the restored view pill must mark Cerberus active"
    );

    // Owner ruling 2026-09-01: the view pill's three segments. The first
    // segment's LABEL is Grip now while its posted value stays cerberus so
    // existing cookies keep working; the CO segment is the CO mark inline with
    // aria-label Continuum. Owner dispatch 2026-09-02: selecting CO renders the
    // Continuum sheet (Christine Selden's tokens on our selectors), paper and
    // amber with no Cerberus chrome.
    // THE BAR CARRIES REPORTS AND ADMIN (canon 0.30.201): the two ride at the
    // end of the app bar, Reports left of Admin; the top nav carries Home and
    // Log only; nothing is pinned to the bottom right any more.
    assert(
      cerberusHome.body.includes('<a class="admin-link" href="/admin">Admin</a>'),
      "home missing the Admin link in the bar"
    );
    assert(
      cerberusHome.body.includes('<a class="reports-link" href="/reports">Reports</a>'),
      "home missing the Reports link in the bar"
    );
    assert(
      cerberusHome.body.indexOf('class="reports-link"') < cerberusHome.body.indexOf('class="admin-link"') &&
        cerberusHome.body.indexOf('class="admin-link"') < cerberusHome.body.indexOf("</header>"),
      "Reports must sit left of Admin, both inside the app bar"
    );
    assert(!cerberusHome.body.includes("fab-cluster") && !cerberusHome.body.includes("admin-fab"), "the bottom-right cluster must be gone");
    assert(!cerberusHome.body.includes('<a href="/admin">'), "the nav Admin link must be gone");
    assertOpsMap(cerberusHome.body, "restored cerberus home");
    assert(
      cerberusHome.body.includes("--ops-arrow: var(--gold)"),
      "cerberus map arrows must use gold"
    );
    assert(cerberusHome.body.includes(">Grip</button>"), "the view pill must label its first segment Grip");
    assert(!cerberusHome.body.includes(">Cerberus</button>"), "the old Cerberus label must be gone");
    assert(cerberusHome.body.includes('name="view" value="co"'), "home missing the CO segment");
    assert(cerberusHome.body.includes('class="co-pill-mark"'), "the CO segment must render the CO mark inline");
    assert(cerberusHome.body.includes('aria-label="Continuum"'), "the CO mark must carry the Continuum aria label");
    const toCo = await req("/view", { method: "POST", body: form({ view: "co" }) });
    if (toCo.status !== 303) fail("POST /view co", `status ${toCo.status}`);
    const coHome = await text("/");
    assert(coHome.body.includes("--bg: #f6f4ef"), "the co view must render the Continuum paper token");
    assert(coHome.body.includes("--primary: #b3762b"), "the co view must render the Continuum amber token");
    assert(coHome.body.includes('"Palatino Linotype"'), "the co view must carry the Palatino display stack");
    assertOpsMap(coHome.body, "co home");
    assert(coHome.body.includes("--ops-arrow: var(--primary)"), "co map arrows must use the amber primary");
    assert(!coHome.body.includes("--gold:#f1c232"), "the co view must not render the grip tokens");
    assert(
      coHome.body.includes('name="view" value="co" class="view-opt view-opt-co active"'),
      "the co view pill must mark CO active"
    );
    assert(!coHome.body.includes('id="boot-scrawl"'), "the co view must carry no cerberus chrome");
    // Canon 0.30.28: picked CO carries the crumb exactly like the default load.
    assert(coHome.body.includes(CONTINUUM_CRUMB), "the picked co home must lead with the Continuum crumb");
    const coEs = await req("/locale", { method: "POST", body: form({ locale: "es" }) });
    if (coEs.status !== 303) fail("POST /locale es under co", `status ${coEs.status}`);
    const coEsHome = await text("/");
    assert(coEsHome.body.includes("&#8592; Volver al Continuum 10</a>"), "the es co home must translate the crumb's words");
    const coEn = await req("/locale", { method: "POST", body: form({ locale: "en" }) });
    if (coEn.status !== 303) fail("POST /locale en under co", `status ${coEn.status}`);
    const backFromCo = await req("/view", { method: "POST", body: form({ view: "cerberus" }) });
    if (backFromCo.status !== 303) fail("POST /view cerberus after co", `status ${backFromCo.status}`);

    // Owner ruling 2026-09-01: the universal bar brand lockup replaces the
    // text brand, and the boot scrawl opens on the Continuum lockup then
    // reveals the factory plate frame with the spray painted lite.
    assert(cerberusHome.body.includes('class="brand brand-lockup"'), "home missing the brand lockup");
    assert(
      cerberusHome.body.includes('<span class="brand-factory">FACTORY</span>'),
      "home missing the FACTORY chip"
    );
    assert(cerberusHome.body.includes('<span class="brand-lite">lite</span>'), "home missing the bar spray lite");
    assert(
      !cerberusHome.body.includes('<div class="brand">Gripfactory'),
      "the old text brand must be gone"
    );
    assert(cerberusHome.body.includes("CONTINUUM"), "the scrawl must open on the Continuum lockup");
    assert(
      cerberusHome.body.includes('src="/brand/factory-plate.png"'),
      "the scrawl must carry the factory plate frame"
    );
    assert(
      cerberusHome.body.includes('class="boot-spray-lite"'),
      "the scrawl must carry the spray lite element"
    );

    // Owner ruling 2026-09-01: the device pill between the EN/ES pill and the
    // view pill; phone mode sets the body class and the sheets reflow.
    assert(cerberusHome.body.includes('class="locale-pill device-pill"'), "home missing the device pill");
    assert(
      cerberusHome.body.includes('name="device" value="computer" class="device-opt active"'),
      "the default device pill must mark computer active"
    );
    assert(
      !cerberusHome.body.includes('<body class="device-phone" data-farm-day-start="6">'),
      "the default body must carry no phone class"
    );
    const toPhone = await req("/device", { method: "POST", body: form({ device: "phone" }) });
    if (toPhone.status !== 303) fail("POST /device phone", `status ${toPhone.status}`);
    const phoneHome = await text("/");
    assert(phoneHome.body.includes('<body class="device-phone" data-farm-day-start="6">'), "phone mode must set the body class");
    assertOpsMap(phoneHome.body, "phone home");
    assert(
      phoneHome.body.includes("body.device-phone .ops-map-desktop { display: none; }"),
      "phone mode must hide the desktop map"
    );
    assert(
      phoneHome.body.includes("body.device-phone .ops-map-phone"),
      "phone mode must show the vertical map"
    );
    assert(
      phoneHome.body.includes('name="device" value="phone" class="device-opt active"'),
      "the phone pill must mark phone active"
    );
    const toComputer = await req("/device", { method: "POST", body: form({ device: "computer" }) });
    if (toComputer.status !== 303) fail("POST /device computer", `status ${toComputer.status}`);
    const computerHome = await text("/");
    assert(
      !computerHome.body.includes('<body class="device-phone" data-farm-day-start="6">'),
      "computer mode must drop the phone class"
    );

    // Owner ruling 2026-09-01: /brand/:file serves the three brand assets, no
    // PIN, correct content types, an hour of public cache; anything else 404s.
    for (const [file, type] of [
      ["grip.svg", "image/svg+xml"],
      ["co-mark.svg", "image/svg+xml"],
      ["factory-plate.png", "image/png"],
    ]) {
      const asset = await req(`/brand/${file}`);
      assert(asset.status === 200, `/brand/${file} expected 200 got ${asset.status}`);
      assert(
        (asset.headers.get("content-type") || "").includes(type),
        `/brand/${file} content type must be ${type}`
      );
      assert(
        (asset.headers.get("cache-control") || "") === "public, max-age=3600",
        `/brand/${file} must cache public for an hour`
      );
      const bytes = await asset.arrayBuffer();
      assert(bytes.byteLength > 0, `/brand/${file} must carry bytes`);
    }
    const ghostBrand = await req("/brand/nope.svg");
    assert(ghostBrand.status === 404, `unknown brand file expected 404 got ${ghostBrand.status}`);
    await ghostBrand.text();

    // PIN gate (owner ruling 2026-08-31): Admin and Interco refuse without the PIN.
    const gatedInterco = await text("/interco");
    assert(gatedInterco.res.status === 401, `gated interco expected 401 got ${gatedInterco.res.status}`);
    assert(gatedInterco.body.includes("Enter PIN"), "gated interco missing the PIN prompt");
    const gatedAdmin = await text("/admin/queues");
    assert(gatedAdmin.res.status === 401, `gated admin expected 401 got ${gatedAdmin.res.status}`);
    // Pending Data Uploads (owner ruling 2026-08-31) rides the same /admin/* gate.
    const gatedUploads = await text("/admin/uploads");
    assert(gatedUploads.res.status === 401, `gated uploads expected 401 got ${gatedUploads.res.status}`);
    const gatedImports = await text("/admin/imports");
    assert(gatedImports.res.status === 401, `gated imports expected 401 got ${gatedImports.res.status}`);
    assert(gatedImports.body.includes("Enter PIN"), "gated imports missing the PIN prompt");
    // THE HARVEST CONSOLE (canon 0.30.73): the Admin button's page sits behind
    // the same PIN; the vendored Harvest Console Lite at /harvest-console does not.
    const gatedHarvest = await text("/harvest");
    assert(gatedHarvest.res.status === 401, `gated harvest console expected 401 got ${gatedHarvest.res.status}`);
    assert(gatedHarvest.body.includes("Enter PIN"), "gated harvest console missing the PIN prompt");
    const gatedHours = await req("/harvest/hours", { method: "POST", body: form({ farm: "PNN", work_date: "2026-09-14", hours: "8" }) });
    assert(gatedHours.status === 401, `gated hours post expected 401 got ${gatedHours.status}`);
    await gatedHours.text();
    const openLite = await req("/harvest-console");
    assert(openLite.status === 200, `the vendored Harvest Console Lite expected 200 without the PIN got ${openLite.status}`);
    await openLite.text();
    const reportsOpen = await text("/reports");
    assert(reportsOpen.res.status === 200, `GET /reports expected 200 got ${reportsOpen.res.status}`);
    assert(reportsOpen.body.includes("<h1>Reports</h1>"), "reports page missing its heading");
    assert(reportsOpen.body.includes("/reports/inventory"), "reports landing missing Inventory");
    assert(reportsOpen.body.includes("/reports/sales_orders"), "reports landing missing Sales Order Status");
    assert(reportsOpen.body.includes("/reports/tats"), "reports landing missing TATs");
    assert(reportsOpen.body.includes("/reports/harvests"), "reports landing missing Harvests");
    // THE HARVEST CONSOLE (canon 0.30.73; owner: "Let's strike the dashboard.
    // Remove it from the report list."): the Harvest Dashboard card is gone.
    assert(!reportsOpen.body.includes('data-report-key="harvest_dashboard"'), "the Harvest Dashboard must be struck from the report list");
    assert(!reportsOpen.body.includes("Harvest Dashboard"), "the Harvest Dashboard title must be gone from the reports landing");
    const dashGone = await req("/reports/harvest_dashboard");
    assert(dashGone.status === 404, `the struck dashboard route expected 404 got ${dashGone.status}`);
    assert(reportsOpen.body.includes("/reports/product_mix"), "reports landing missing Product Mix");
    assert(reportsOpen.body.includes("/reports/external_audits"), "reports landing missing External Audits");
    assert(reportsOpen.body.includes("/reports/rf"), "reports landing missing RF report");
    assert(reportsOpen.body.includes("/reports/internal_testing"), "reports landing missing Internal testing");
    assert(!reportsOpen.body.includes("Enter PIN"), "reports must not sit behind the PIN");
    const gatedCompliance = await text("/compliance");
    assert(gatedCompliance.res.status === 401, `gated compliance expected 401 got ${gatedCompliance.res.status}`);
    assert(gatedCompliance.body.includes("Enter PIN"), "gated compliance missing the PIN prompt");
    const gatedPurchasing = await text("/purchasing");
    assert(gatedPurchasing.res.status === 401, `gated purchasing expected 401 got ${gatedPurchasing.res.status}`);
    const gatedMarketplace = await text("/marketplace");
    assert(gatedMarketplace.res.status === 401, `gated marketplace expected 401 got ${gatedMarketplace.res.status}`);
    const harvestOps = await text("/ops/harvest_ops");
    assert(harvestOps.res.status === 200, `GET /ops/harvest_ops expected 200 got ${harvestOps.res.status}`);
    assert(harvestOps.body.includes("Harvest Operations</h1>"), "harvest ops missing its heading");
    assert(harvestOps.body.includes('data-pipeline-key="acquire_hbn"'), "harvest ops missing Acquire");
    assert(harvestOps.body.includes('data-pipeline-key="wet_weight"'), "harvest ops missing Wet Weight");
    assert(!harvestOps.body.includes("Enter PIN"), "ops group pages must not sit behind the PIN");
    const gatedFulfillment = await text("/fulfillment");
    assert(
      gatedFulfillment.res.status === 401,
      `gated fulfillment expected 401 got ${gatedFulfillment.res.status}`
    );
    assert(gatedFulfillment.body.includes("Enter PIN"), "gated fulfillment missing the PIN prompt");
    // Inventory (2026-09-01): same PIN, the sheet and its reserved button pages.
    const gatedVirtual = await text("/virtual-move");
    assert(
      gatedVirtual.res.status === 401,
      `gated virtual-move expected 401 got ${gatedVirtual.res.status}`
    );
    assert(gatedVirtual.body.includes("Enter PIN"), "gated virtual-move missing the PIN prompt");
    const gatedInventory = await text("/inventory");
    assert(
      gatedInventory.res.status === 401,
      `gated inventory expected 401 got ${gatedInventory.res.status}`
    );
    const gatedChange = await text("/inventory/change-locations");
    assert(
      gatedChange.res.status === 401,
      `gated change-locations expected 401 got ${gatedChange.res.status}`
    );
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

    // THE LOAD AND THE LOT (canon 0.30.241): Logistics Operations, two buttons.
    // The manifest renderers stay in the file. Every old /interco path lands
    // on the group page and acts on nothing.
    const logistics = await text("/ops/interco_logistics");
    if (logistics.res.status !== 200) fail("GET /ops/interco_logistics", `status ${logistics.res.status}`);
    assert(logistics.body.includes("Logistics Operations"), "the group page must read Logistics Operations");
    assert(logistics.body.includes('href="/logistics/internal"') && logistics.body.includes("Internal Logistics"), "the group page must offer Internal Logistics");
    assert(logistics.body.includes('href="/logistics/partners"') && logistics.body.includes("Processing Partners"), "the group page must offer Processing Partners");
    assert(!logistics.body.includes("data-manifest-builder"), "the manifest builder must not be served");
    const partners = await text("/logistics/partners");
    assert(partners.res.status === 200 && partners.body.includes("Processing Partners") && partners.body.includes("- EMPTY -"), "Processing Partners is its title and empty");
    for (const path of ["/interco", "/interco/arrivals/pnn", "/interco/send/pns", "/interco/door", "/interco/outbound", "/interco/receiving"]) {
      const gone = await req(path);
      assert(gone.status === 302, `${path} expected 302 got ${gone.status}`);
      assert((gone.headers.get("location") || "").endsWith("/ops/interco_logistics"), `${path} must land on Logistics Operations`);
      await gone.text();
    }
    const virtualMove = await req("/virtual-move");
    assert(virtualMove.status === 302 && (virtualMove.headers.get("location") || "").endsWith("/interco"), "virtual-move still leaves the drying menu");
    await virtualMove.text();
    const staleIntercoPost = await req("/interco/manifest/add", { method: "POST", body: form({ item_id: "x" }) });
    assert(staleIntercoPost.status === 303 && (staleIntercoPost.headers.get("location") || "").endsWith("/ops/interco_logistics"), "a stale interco post must land on the group page, acting on nothing");
    await staleIntercoPost.text();

    // THE BACK LINK (canon 0.30.109; owner, 2026-09-17, verbatim: "All
    // sub-menus need to have a link that goes back to the pervious menu.  Using
    // the "home" button for every process is too onerous"): every shelled page
    // but Home carries the crumb to the menu above it, first thing in main.
    const crumbOf = (body) => (body.match(/<nav class="back-crumb" aria-label="[^"]*"><a class="back-link" href="([^"]*)" data-back-link>&#8592; ([^<]*)<\/a><\/nav>/) || []).slice(1);
    const homeCrumb = await text("/");
    assert(!homeCrumb.body.includes('<nav class="back-crumb"'), "Home carries no crumb: it is the top of the tree");
    const crumbCases = [
      ["/ops/harvest_ops", "/", "Home"],
      ["/station/wet_weight", "/ops/harvest_ops", "Harvest Operations"],
      ["/station/load_silo", "/ops/drying_ops", "Drying Operations"],
      ["/station/cryo_weight", "/ops/production_ops", "Production Operations"],
      ["/production/scheduling", "/ops/production_ops", "Production Operations"],
      ["/production/scheduling/cryo", "/production/scheduling", "Production Scheduling"],
      ["/inventory", "/ops/production_ops", "Production Operations"],
      ["/inventory/metrc", "/inventory", "Inventory"],
      ["/fulfillment", "/ops/production_ops", "Production Operations"],
      ["/ops/interco_logistics", "/", "Home"],
      ["/logistics/internal", "/ops/interco_logistics", "Logistics Operations"],
      ["/logistics/partners", "/ops/interco_logistics", "Logistics Operations"],
      ["/reports", "/", "Home"],
      ["/reports/inventory_by_location", "/reports", "Reports"],
      ["/admin", "/", "Home"],
      ["/admin/queues", "/admin", "Admin"],
      ["/admin/lookups", "/admin", "Admin"],
      ["/admin/lookups/dry_spaces", "/admin/lookups", "Data Lookups"],
      ["/admin/uploads", "/admin", "Admin"],
      ["/log", "/", "Home"],
    ];
    for (const [path, href, label] of crumbCases) {
      const page = await text(path);
      assert(page.res.status === 200, `${path} expected 200 got ${page.res.status}`);
      const [gotHref, gotLabel] = crumbOf(page.body);
      assert(gotHref === href && gotLabel === label, `${path} must carry the crumb to ${label} (${href}), got ${gotHref} ${gotLabel}`);
      const mainAt = page.body.indexOf("<main>");
      assert(mainAt !== -1 && page.body.indexOf('<nav class="back-crumb"') > mainAt && page.body.indexOf('<nav class="back-crumb"') < page.body.indexOf("<h1"), `${path}: the crumb must be the first thing in main`);
    }
    // A record page goes back where it came from (the same-origin referer) and reads Back.
    const crumbPeople = await text("/admin/lookups/people");
    const personEditHref = (crumbPeople.body.match(/href="(\/record\/people\/[^"]+\/edit)"/) || [])[1];
    assert(personEditHref, "the people lookup must offer a pencil to walk the record crumb");
    const editWithRef = await req(personEditHref, { headers: { referer: `${base}/admin/lookups/people` } });
    const editBody = await editWithRef.text();
    assert(editWithRef.status === 200, `record pencil expected 200 got ${editWithRef.status}`);
    const [refHref, refLabel] = crumbOf(editBody);
    assert(refHref === "/admin/lookups/people" && refLabel === "Back", `a record pencil must go back to its referer as Back, got ${refHref} ${refLabel}`);
    const editNoRef = await text(personEditHref);
    const [noRefHref, noRefLabel] = crumbOf(editNoRef.body);
    assert(noRefHref === "/admin/queues" && noRefLabel === "Data Queues", `a record pencil with no referer must go to Data Queues, got ${noRefHref} ${noRefLabel}`);
    // The Spanish crumb speaks Spanish.
    const esOn = await req("/locale", { method: "POST", body: form({ locale: "es" }), headers: { referer: `${base}/station/load_silo` } });
    assert(esOn.status === 303, `locale switch expected 303 got ${esOn.status}`);
    await esOn.text();
    const esLoad = await text("/station/load_silo");
    const [esHref, esLabel] = crumbOf(esLoad.body);
    assert(esHref === "/ops/drying_ops" && esLabel === "Operaciones de secado", `the Spanish crumb must read Operaciones de secado, got ${esHref} ${esLabel}`);
    const enBack = await req("/locale", { method: "POST", body: form({ locale: "en" }) });
    assert(enBack.status === 303, `locale switch back expected 303 got ${enBack.status}`);
    await enBack.text();

    // Fulfillment (owner ruling 2026-09-01): /fulfillment is a themed MENU
    // page in the normal chrome now; the hosted SalesHelper form (owner ruling
    // 2026-08-31) moved behind the wrapper at /fulfillment/saleshelper/, all
    // still under the same PIN.
    const fulfillMenu = await text("/fulfillment");
    if (fulfillMenu.res.status !== 200) fail("GET /fulfillment", `status ${fulfillMenu.res.status}`);
    assert(fulfillMenu.body.includes("<h1>Fulfillment</h1>"), "fulfillment menu missing its heading");
    assert(fulfillMenu.body.includes('class="app-bar"'), "fulfillment menu must ride the normal chrome");
    assert(
      fulfillMenu.body.includes('href="/fulfillment/saleshelper/"'),
      "fulfillment menu missing the SalesHelper button"
    );
    assert(fulfillMenu.body.includes("SalesHelper"), "fulfillment menu missing the SalesHelper title");
    // Canon 0.30.18: both buttons are built; the orange barrels came off.
    assert(
      fulfillMenu.body.includes('<a class="tile" href="/fulfillment/mount-sos"'),
      "fulfillment menu must carry Mount SOs as a plain tile"
    );
    assert(
      fulfillMenu.body.includes('<a class="tile" href="/fulfillment/pick-orders"'),
      "fulfillment menu must carry Pick Orders as a plain tile"
    );
    assert(!fulfillMenu.body.includes('class="tile tile-stub"'), "fulfillment menu must carry no orange barrel");
    const fulfillMenuSlash = await text("/fulfillment/");
    if (fulfillMenuSlash.res.status !== 200) {
      fail("GET /fulfillment/", `status ${fulfillMenuSlash.res.status}`);
    }
    assert(
      fulfillMenuSlash.body.includes('href="/fulfillment/saleshelper/"'),
      "/fulfillment/ must serve the menu too"
    );

    // Canon 0.30.18: [Mount SOs] and [Pick Orders] built on gripfactorish's
    // behavior. Before any mount the readouts say so.
    const mountEmpty = await text("/fulfillment/mount-sos");
    assert(mountEmpty.res.status === 200, `mount-sos expected 200 got ${mountEmpty.res.status}`);
    assert(mountEmpty.body.includes("<h1>Mount SOs</h1>"), "mount-sos missing its title");
    assert(mountEmpty.body.includes("data-mount-form"), "mount-sos missing the mount form");
    assert(mountEmpty.body.includes("Nothing mounted yet."), "mount-sos must say nothing is mounted yet");
    assert(mountEmpty.body.includes("data-pipeline-empty"), "mount-sos must render the empty pipeline note");
    assert(!mountEmpty.body.includes("Reserved. Awaiting"), "mount-sos must not be a reserved stub any more");
    const pickEmpty = await text("/fulfillment/pick-orders");
    assert(pickEmpty.res.status === 200, `pick-orders expected 200 got ${pickEmpty.res.status}`);
    assert(pickEmpty.body.includes("<h1>Pick Orders</h1>"), "pick-orders missing its title");
    assert(pickEmpty.body.includes("Pick an order from the pane."), "pick-orders must ask for a pick");
    assert(!pickEmpty.body.includes("Reserved. Awaiting"), "pick-orders must not be a reserved stub any more");

    // A file that is not a Zoho Sales Order export refuses in words.
    const notZoho = new FormData();
    notZoho.append("file", new File([new TextEncoder().encode("Plant,Weight\r\nA,1\r\n")], "wet.csv", { type: "text/csv" }));
    const notZohoRes = await req("/fulfillment/mount-sos", { method: "POST", body: notZoho });
    assert(notZohoRes.status === 400, `non-Zoho mount expected 400 got ${notZohoRes.status}`);
    assert((await notZohoRes.text()).includes("not a Zoho Sales Order export"), "non-Zoho mount must refuse in words");

    // The Zoho export (real column names), one row per line: SO-00901 approved
    // shipping today in BUD and TRIM plus a CRIF line; SO-00902 submitted in
    // PREROLLS; SO-00903 shipped (reads invoiced) in THCA.
    const zohoHeader = [
      "SalesOrder Number", "SalesOrder ID", "Order Date", "Expected Shipment Date", "Status", "Customer Name",
      "Sales Person", "Item Name", "SKU", "QuantityOrdered", "QuantityInvoiced", "QuantityPacked", "Usage unit",
      "Item Price", "Item.CF.Product Sub", "Item.CF.Location Code", "CF.Customer License #",
      "CF.Destination License #", "CF.Origin License #", "CF.Status (Internal)", "Delivery Method",
    ];
    const todayIso = new Date().toISOString().slice(0, 10);
    // SO-00902's expected date once read the fixed 2026-09-20 and met the calendar
    // on that day (the shipping-today row counted it too); a date ten days out
    // keeps the submitted order out of today's row on every day the smoke runs.
    const laterIso = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const zohoRows = (status, extra = []) => [
      ["SO-00901", "901", "2026-09-01", todayIso, "confirmed", "Green Leaf", "Sales One", "Blue Dream Bulk Flower", "1A4FF0100000022000012345", "10", "0", "0", "lb", "600.00", "Bulk Flower", "P2.3.A", "C10-1", "C10-1", "C11-2", status, "Grip"],
      ["SO-00901", "901", "2026-09-01", todayIso, "confirmed", "Green Leaf", "Sales One", "Blue Dream Trim", "1A4FF0100000022000012346", "25", "0", "0", "lb", "80.00", "Trim", "P1.1.B", "C10-1", "C10-1", "C11-2", status, "Grip"],
      ["SO-00901", "901", "2026-09-01", todayIso, "confirmed", "Green Leaf", "Sales One", "CRIF", "", "1", "0", "0", "ea", "0", "CRIF Fee", "", "C10-1", "C10-1", "C11-2", status, "Grip"],
      ["SO-00902", "902", "2026-09-02", laterIso, "confirmed", "North Star", "Sales One", "Infused Pre-Rolls 5pk", "1A4FF0100000022000012347", "200", "0", "0", "ea", "12.00", "Infused Pre-Rolls", "Oxford N", "C10-3", "C10-3", "C11-2", "Submitted", "Grip"],
      ["SO-00903", "903", "2026-08-20", "2026-08-28", "invoiced", "Harbor", "Sales Two", "THCA Infused Flower", "1A4FF0100000022000012348", "4", "3", "0", "lb", "900.00", "THCA Infused Flower", "P3.1.A", "C10-4", "C10-4", "C11-2", "Shipped", "Grip"],
      ...extra,
    ];
    const zohoCsv = (rows) =>
      [zohoHeader, ...rows].map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\r\n") + "\r\n";
    const mountForm = new FormData();
    mountForm.append("file", new File([new TextEncoder().encode(zohoCsv(zohoRows("Approved")))], "Sales_Order.csv", { type: "text/csv" }));
    const mounted = await req("/fulfillment/mount-sos", { method: "POST", body: mountForm });
    assert(mounted.status === 303, `mount expected 303 got ${mounted.status}: ${(await mounted.text()).slice(0, 300)}`);
    assert((mounted.headers.get("location") || "").endsWith("/fulfillment/mount-sos?ok=mounted"), "mount must redirect with ok=mounted");
    const mountSos = await text("/fulfillment/mount-sos?ok=mounted");
    assert(mountSos.body.includes("Mounted."), "mount-sos must flash Mounted.");
    assert(mountSos.body.includes("Sales_Order.csv"), "mount summary missing the filename");
    assert(mountSos.body.includes("4 lines, 3 orders, 1 ignored (CRIF, processing)"), `mount summary counts wrong: ${mountSos.body.match(/data-mount-summary>[^<]*/)?.[0]}`);
    assert(mountSos.body.includes("data-pipeline-table"), "mount-sos missing the pipeline table after the mount");
    const pipelineRow = (html, row) => {
      const start = html.indexOf(`data-pipeline-row="${row}"`);
      assert(start !== -1, `pipeline missing row ${row}`);
      return html.slice(start, html.indexOf("</tr>", start));
    };
    const cellsOf = (tr) => [...tr.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]);
    // Columns follow READOUT_CATEGORIES: BUD, TRIM, BIO, PREPACK, PREROLLS, SHAKE, DISTILLATE, INFUSED BUD, VAPES, THCA, TOTAL.
    const approvedCells = cellsOf(pipelineRow(mountSos.body, "approved"));
    assert(approvedCells[0] === "1" && approvedCells[1] === "1" && approvedCells[10] === "1", `approved row wrong: ${approvedCells.join("|")}`);
    const todayCells = cellsOf(pipelineRow(mountSos.body, "shippingToday"));
    assert(todayCells[0] === "1" && todayCells[10] === "1", `shipping today row wrong: ${todayCells.join("|")}`);
    const submittedCells = cellsOf(pipelineRow(mountSos.body, "submitted"));
    assert(submittedCells[4] === "1" && submittedCells[10] === "1", `submitted row wrong: ${submittedCells.join("|")}`);
    const shippedCells = cellsOf(pipelineRow(mountSos.body, "shipped"));
    assert(shippedCells[9] === "1" && shippedCells[10] === "1", `shipped row wrong: ${shippedCells.join("|")}`);
    const pickingCells = cellsOf(pipelineRow(mountSos.body, "picking"));
    assert(pickingCells[10] === "&middot;", `picking row must be empty before any pick: ${pickingCells.join("|")}`);
    assert(mountSos.body.includes("data-so-detail"), "mount-sos missing the SO status detail");
    assert(mountSos.body.includes('data-so="SO-00901"') && mountSos.body.includes('data-so="SO-00902"'), "open orders missing");
    assert(!mountSos.body.includes('data-so="SO-00903"'), "a shipped order must leave the open list");
    const orderId = mountSos.body.match(/data-so="SO-00901">[\s\S]*?href="\/fulfillment\/pick-orders\?order=([^"]+)"/)?.[1];
    assert(orderId, "open orders missing the Pick link for SO-00901");

    // Re-mount the same file: idempotent (same counts, no duplicate orders);
    // a newer export flips SO-00901's Zoho status in place.
    const remountForm = new FormData();
    remountForm.append("file", new File([new TextEncoder().encode(zohoCsv(zohoRows("Approved")))], "Sales_Order.csv", { type: "text/csv" }));
    const remounted = await req("/fulfillment/mount-sos", { method: "POST", body: remountForm });
    assert(remounted.status === 303, `re-mount expected 303 got ${remounted.status}`);
    const remountPage = await text("/fulfillment/mount-sos");
    assert((remountPage.body.match(/data-so="SO-00901"/g) || []).length === 1, "re-mount must not duplicate an order");
    assert(cellsOf(pipelineRow(remountPage.body, "approved"))[10] === "1", "re-mount must keep the approved count at 1");

    // The pick: start (the picker typed by hand, canon 0.30.21), save marks, complete.
    const pickPage = await text(`/fulfillment/pick-orders?order=${orderId}`);
    assert(pickPage.res.status === 200, `pick page expected 200 got ${pickPage.res.status}`);
    assert(pickPage.body.includes("data-pick-start"), "unstarted order must offer Start pick");
    assert(pickPage.body.includes('<input type="text" name="signed_by" required autocomplete="off">'), "pick signer must be a typed name");
    assert(!pickPage.body.includes('<select name="signed_by"'), "pick signer must not be a select of the maintenance crew");
    assert(pickPage.body.indexOf("P1.1.B") < pickPage.body.indexOf("P2.3.A"), "pick lines must walk the racks in order");
    assert(pickPage.body.includes(`href="/fulfillment/pick-orders/${orderId}/print"`), "pick page missing the print link");
    const badSigner = await req(`/fulfillment/pick-orders/${orderId}/start`, { method: "POST", body: form({ signed_by: "" }) });
    assert(badSigner.status === 400, `a blank signer must refuse, got ${badSigner.status}`);
    const started = await req(`/fulfillment/pick-orders/${orderId}/start`, { method: "POST", body: form({ signed_by: "Les" }) });
    assert(started.status === 303, `start pick expected 303 got ${started.status}: ${(await started.text()).slice(0, 300)}`);
    assert((started.headers.get("location") || "").endsWith(`/fulfillment/pick-orders?order=${orderId}&ok=picking`), "start pick must redirect ok=picking");
    const picking = await text(`/fulfillment/pick-orders?order=${orderId}&ok=picking`);
    assert(picking.body.includes("Pick started."), "pick page must flash Pick started.");
    assert(picking.body.includes("data-pick-save"), "picking order must offer Save progress");
    assert(picking.body.includes("Picked by Les"), "pick page must show the picker");
    const lineIds = [...picking.body.matchAll(/name="picked_([^"]+)"/g)].map((m) => m[1]);
    assert(lineIds.length === 2, `picking order must post two lines, got ${lineIds.length}`);
    const twice = await req(`/fulfillment/pick-orders/${orderId}/start`, { method: "POST", body: form({ signed_by: "Les" }) });
    assert(twice.status === 400, `a second start must refuse, got ${twice.status}`);
    // Save: the first line short by hand, the second untouched (absent field
    // means unchanged, canon 0.30.10).
    const saved = await req(`/fulfillment/pick-orders/${orderId}/save`, {
      method: "POST",
      body: form({ [`picked_${lineIds[0]}`]: "9", [`short_${lineIds[0]}`]: "1", [`note_${lineIds[0]}`]: "one bag light" }),
    });
    assert(saved.status === 303, `save pick expected 303 got ${saved.status}: ${(await saved.text()).slice(0, 300)}`);
    const savedPage = await text(`/fulfillment/pick-orders?order=${orderId}&ok=saved`);
    assert(savedPage.body.includes("Pick saved."), "pick page must flash Pick saved.");
    assert(savedPage.body.includes(`name="picked_${lineIds[0]}" value="9"`), "saved picked quantity must render");
    assert(savedPage.body.includes(`name="short_${lineIds[0]}" value="1" checked`), "saved short flag must render checked");
    assert(savedPage.body.includes('value="one bag light"'), "saved note must render");
    assert(savedPage.body.includes(`name="picked_${lineIds[1]}" value=""`), "the untouched line must stay blank");
    // Mid-pick, the pipeline shows the order under Picking, not Accepted.
    const midPick = await text("/fulfillment/mount-sos");
    assert(cellsOf(pipelineRow(midPick.body, "picking"))[10] === "1", "pipeline must count the picking order");
    assert(cellsOf(pipelineRow(midPick.body, "approved"))[10] === "&middot;", "pipeline must move the order out of Accepted");
    // The print sheet, mid-pick.
    const pickSheet = await text(`/fulfillment/pick-orders/${orderId}/print`);
    assert(pickSheet.res.status === 200, `pick sheet expected 200 got ${pickSheet.res.status}`);
    assert(pickSheet.body.startsWith("<!DOCTYPE html>"), "pick sheet must be a standalone document");
    assert(pickSheet.body.includes("Pick sheet &middot; SO-00901"), "pick sheet missing its title");
    assert(pickSheet.body.includes("Green Leaf") && pickSheet.body.includes("P1.1.B") && pickSheet.body.includes("&#9744;"), "pick sheet missing its body");
    assert(pickSheet.body.includes("<b>short</b>"), "pick sheet must mark the short line");
    // Complete: the second line in walking order (P2.3.A, the 10 lb of bud),
    // picked 6 of 10, flags short by law (never blocks).
    await req(`/fulfillment/pick-orders/${orderId}/save`, { method: "POST", body: form({ [`picked_${lineIds[1]}`]: "6" }) });
    const completed = await req(`/fulfillment/pick-orders/${orderId}/complete`, { method: "POST", body: form({ signed_by: "Austin" }) });
    assert(completed.status === 303, `complete pick expected 303 got ${completed.status}: ${(await completed.text()).slice(0, 300)}`);
    const donePage = await text(`/fulfillment/pick-orders?order=${orderId}&ok=fulfilled`);
    assert(donePage.body.includes("Fulfilled."), "pick page must flash Fulfilled.");
    assert(donePage.body.includes("Fulfilled by Austin"), "pick page must show the fulfiller");
    assert(!donePage.body.includes("data-pick-save") && !donePage.body.includes("data-pick-complete"), "a fulfilled order is read-only");
    assert(donePage.body.includes("<td>6</td><td>short</td>"), "the under-picked line must be flagged short on completion");
    const afterPick = await text("/fulfillment/mount-sos");
    assert(cellsOf(pipelineRow(afterPick.body, "fulfilled"))[10] === "1", "pipeline must count the fulfilled order");
    // A later export keeps our pick: Zoho still says Approved, we say fulfilled.
    const laterForm = new FormData();
    laterForm.append("file", new File([new TextEncoder().encode(zohoCsv(zohoRows("Approved")))], "Sales_Order.csv", { type: "text/csv" }));
    await req("/fulfillment/mount-sos", { method: "POST", body: laterForm });
    const afterRemount = await text(`/fulfillment/pick-orders?order=${orderId}`);
    assert(afterRemount.body.includes("Fulfilled by Austin"), "a re-mount must keep the pick marks");
    assert(afterRemount.body.includes("<td>9</td><td>short</td><td>one bag light</td>"), "a re-mount must keep the line marks");
    // Unknown order 404s on the sheet; the mount and pick pages es.
    const noSheet = await req("/fulfillment/pick-orders/nope/print");
    assert(noSheet.status === 404, `unknown pick sheet expected 404 got ${noSheet.status}`);
    const toEsMount = await req("/locale", { method: "POST", body: form({ locale: "es" }) });
    if (toEsMount.status !== 303) fail("POST /locale es (mount)", `status ${toEsMount.status}`);
    const esMount = await text("/fulfillment/mount-sos");
    assert(esMount.body.includes("<h1>Montar SOs</h1>") && esMount.body.includes("Canal de ventas"), "es mount page missing its chrome");
    const toEnMount = await req("/locale", { method: "POST", body: form({ locale: "en" }) });
    if (toEnMount.status !== 303) fail("POST /locale en (mount)", `status ${toEnMount.status}`);

    // The wrapper (owner ruling 2026-09-01): our chrome on top, the raw form
    // filling the rest of the viewport in an iframe.
    const wrapper = await text("/fulfillment/saleshelper/");
    if (wrapper.res.status !== 200) fail("GET /fulfillment/saleshelper/", `status ${wrapper.res.status}`);
    assert(wrapper.body.includes('class="app-bar"'), "the wrapper must carry the universal bar");
    assert(
      wrapper.body.includes('<iframe class="saleshelper-frame" src="/fulfillment/saleshelper/app"'),
      "the wrapper must frame the form at /fulfillment/saleshelper/app"
    );
    const wrapperBare = await req("/fulfillment/saleshelper");
    assert(wrapperBare.status === 302, `bare saleshelper expected 302 got ${wrapperBare.status}`);
    assert(
      (wrapperBare.headers.get("location") || "").endsWith("/fulfillment/saleshelper/"),
      "bare saleshelper must redirect to the trailing slash"
    );

    // THE SALESHELPER LIVE MENU AND HEADER (canon 0.30.47), before any Zoho
    // mount: menu.json is the vendored static as it came (both paths), and the
    // served form hides the desktop/phone pill, keeps its own build date and
    // offers the [Update] link to the Marketplace's Zoho pane.
    const menuStatic = await req("/fulfillment/saleshelper/menu.json");
    assert(menuStatic.status === 200, `menu.json expected 200 got ${menuStatic.status}`);
    const menuStaticText = await menuStatic.text();
    assert(menuStaticText.startsWith(`{"builtAt":"${SH_STATIC.builtAt}"`) && menuStaticText.includes(`"sourceFile":"${SH_STATIC.sourceFile}"`), "menu.json must be the vendored static before a mount");
    assert(SH_STATIC.canonVersion === "0.8.0" && SH_STATIC.sourceFile === "Items_manual_2026-09-14.csv", `the vendored static is the SalesHelper 0.8.0 build of the 2026-09-14 export, got ${SH_STATIC.canonVersion} ${SH_STATIC.sourceFile}`);
    assert(SH_STATIC.dataAsOf < SH_STATIC.builtAt && SH_STATIC.lines.length === 184 && SH_STATIC.lines.every((l) => typeof l.price === "number" && l.price > 0), "the vendored static stamps dataAsOf before builtAt and carries a Zoho price on all 184 lines");
    assert(!menuStatic.headers.get("x-gf-menu"), "the static menu carries no live marker");
    const menuOld = await req("/fulfillment/menu.json");
    assert(menuOld.status === 200 && (await menuOld.text()).startsWith(`{"builtAt":"${SH_STATIC.builtAt}"`), "the old menu.json path must serve the same static");
    const shAppRaw = await text("/fulfillment/saleshelper/app");
    assert(shAppRaw.res.status === 200, `the form expected 200 got ${shAppRaw.res.status}`);
    assert(shAppRaw.body.includes("#mode-pill{display:none !important}"), "the served form must hide the desktop/phone pill");
    assert(shAppRaw.body.includes('id="mode-desktop"') && shAppRaw.body.includes('id="mode-phone"'), "the pill's buttons must stay in the DOM for the form's own script");
    assert(shAppRaw.body.includes('<a class="gf-update" data-gf-update href="/marketplace?pane=zoho" target="_top"'), "the served form must carry the Update link to the Zoho pane");
    assert(SH_HEADER_TIME.length > 0 && shAppRaw.body.includes(`Inventory updated <span data-inventory-time>${SH_HEADER_TIME}</span> \u00b7 SalesHelper canon v0.8.0`), `without a mount the form keeps its own inventory time (${SH_HEADER_TIME})`);
    assert((shAppRaw.body.match(/data-gf-update/g) || []).length === 1, "exactly one Update link");
    assert(/<\/span>\n  <a class="gf-update"/.test(shAppRaw.body) && shAppRaw.body.indexOf("data-gf-update") < shAppRaw.body.indexOf('id="freshness"'), "the Update link lands after the whole meta span, before the badge");
    // THE SALESHELPER BATCH (canon 0.30.65): the re-vendored 0.8.0 form carries
    // the netting toggle and the hand picker; the vendored bytes stream raw.
    for (const piece of ['id="f-net"', 'data-net="even"', 'data-net="hand"', 'data-net="whole"', 'id="pkgpick"', 'id="f-size"']) {
      assert(shAppRaw.body.includes(piece), `the served form must carry the 0.8.0 netting control (${piece})`);
    }

    // THE SEND EMAIL (canon 0.30.65): /api/send answers the SalesHelper form's
    // contract. No gate key: 403. A bad body: 400 in words. A good body with
    // no RESEND_API_KEY on this dev Worker: 503 naming the secret, so the
    // form falls back to its email client. Without the PIN cookie: the gate.
    const sendOrder = { orderNo: "SH-SMOKE-0001", customer: "Smoke Provisioning", salesperson: "Smoke Rep", orderDate: "2026-09-14", license: "AU-R-000001", originLicense: "AU-G-000832", subtotal: 350, lines: [{ label: "BUD \u00b7 Donny Burger \u00b7 Outdoor \u00b7 22%", type: "BUD", qty: 2, price: 175, total: 350 }] };
    const sendBody = { filename: "ZohoSO_SH-SMOKE-0001.csv", csv: "SalesOrder Number,Item Name\r\nSH-SMOKE-0001,BUD - Donny Burger - PNS - O - 22.1%\r\n", order: sendOrder };
    const sendNoKey = await req("/api/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sendBody) });
    assert(sendNoKey.status === 403, `/api/send without the gate key expected 403 got ${sendNoKey.status}`);
    const sendBad = await req("/api/send", { method: "POST", headers: { "Content-Type": "application/json", "X-Grip-Key": SH_SEND_KEY }, body: JSON.stringify({ filename: "x.csv" }) });
    assert(sendBad.status === 400 && (await sendBad.text()).includes("needs the CSV text"), `/api/send with a bad body expected 400 in words got ${sendBad.status}`);
    const sendUnconfigured = await req("/api/send", { method: "POST", headers: { "Content-Type": "application/json", "X-Grip-Key": SH_SEND_KEY }, body: JSON.stringify(sendBody) });
    const sendUnconfiguredBody = await sendUnconfigured.text();
    assert(sendUnconfigured.status === 503 && sendUnconfiguredBody.includes("RESEND_API_KEY"), `/api/send without the secret expected 503 naming the secret got ${sendUnconfigured.status} ${sendUnconfiguredBody.slice(0, 200)}`);
    {
      const savedPinForSend = jar.get("gf_pin");
      jar.delete("gf_pin");
      const sendNoPin = await req("/api/send", { method: "POST", headers: { "Content-Type": "application/json", "X-Grip-Key": SH_SEND_KEY }, body: JSON.stringify(sendBody) });
      assert(sendNoPin.status === 401, `/api/send without the PIN cookie expected the gate (401) got ${sendNoPin.status}`);
      jar.set("gf_pin", savedPinForSend);
    }

    // The raw form at /app: the vendored bytes plus the serve-time Cerberus
    // skin when the view cookie is cerberus (the jar holds that pick here; an
    // absent cookie is co since canon 0.30.28 and streams raw); raw bytes under
    // lite AND under co (owner dispatch 2026-09-02: the skin is Cerberus's alone).
    // The vendored pair never changes on disk (owner ruling 2026-09-01:
    // runtime decoration only).
    const appPage = await text("/fulfillment/saleshelper/app");
    if (appPage.res.status !== 200) fail("GET saleshelper app", `status ${appPage.res.status}`);
    assert(
      appPage.body.includes("<title>GRIP Cannabis - Sales Order Form</title>"),
      "saleshelper app missing the vendored order form"
    );
    assert(
      (appPage.res.headers.get("cache-control") || "").includes("no-store"),
      "saleshelper app must send cache-control no-store"
    );
    assert(
      appPage.body.includes('id="gf-cerberus-skin"'),
      "the cerberus view must inject the theme skin into the served form"
    );
    const toLiteApp = await req("/view", { method: "POST", body: form({ view: "lite" }) });
    if (toLiteApp.status !== 303) fail("POST /view lite for the app", `status ${toLiteApp.status}`);
    const liteApp = await text("/fulfillment/saleshelper/app");
    assert(
      !liteApp.body.includes('id="gf-cerberus-skin"'),
      "the lite view must serve the vendored bytes raw"
    );
    assert(
      liteApp.body.includes("<title>GRIP Cannabis - Sales Order Form</title>"),
      "the lite app must still be the vendored form"
    );
    // Owner dispatch 2026-09-02: co streams the vendored bytes raw too; the
    // plain light form sits naturally in the Continuum paper world.
    const toCoApp = await req("/view", { method: "POST", body: form({ view: "co" }) });
    if (toCoApp.status !== 303) fail("POST /view co for the app", `status ${toCoApp.status}`);
    const coApp = await text("/fulfillment/saleshelper/app");
    assert(
      !coApp.body.includes('id="gf-cerberus-skin"'),
      "the co view must serve the vendored bytes raw"
    );
    assert(
      coApp.body.includes("<title>GRIP Cannabis - Sales Order Form</title>"),
      "the co app must still be the vendored form"
    );
    const restoreAfterApp = await req("/view", { method: "POST", body: form({ view: "cerberus" }) });
    if (restoreAfterApp.status !== 303) {
      fail("POST /view cerberus after the app", `status ${restoreAfterApp.status}`);
    }

    // menu.json serves at BOTH paths (owner ruling 2026-09-01): the saleshelper
    // path resolves the form's relative fetch; the old path stays for
    // compatibility.
    for (const path of ["/fulfillment/menu.json", "/fulfillment/saleshelper/menu.json"]) {
      const menu = await text(path);
      if (menu.res.status !== 200) fail(`GET ${path}`, `status ${menu.res.status}`);
      assert(menu.body.startsWith("{"), `${path} must start with {`);
      assert(menu.body.includes('"builtAt"'), `${path} missing builtAt`);
      assert(
        (menu.res.headers.get("content-type") || "").includes("application/json"),
        `${path} content type must be application/json`
      );
    }

    // Inventory sheet (2026-09-01): buttons, collapsed WIP, expanded FG, both views.
    const inventory = await text("/inventory");
    if (inventory.res.status !== 200) fail("GET /inventory", `status ${inventory.res.status}`);
    assert(inventory.body.includes("WIP Inventory"), "inventory page must show the sheet");
    assert(inventory.body.includes("Change Locations"), "inventory missing Change Locations");
    assert(inventory.body.includes("Upload Inventory to Zoho"), "inventory missing Zoho upload");
    assert(inventory.body.includes("Physical Inventory Audit"), "inventory missing physical audit");
    assert(inventory.body.includes("Location Audit"), "inventory missing location audit");
    assert(inventory.body.includes('data-inv-section="fg" open'), "FG must default expanded");
    assert(
      !inventory.body.includes("Reserved for the Inventory node"),
      "the inventory stub must be gone"
    );
    // THE CHANGE LOCATION SETUP (canon 0.30.40): the first reserved page is
    // built; it answers with the toggle and the scope form, no reserved line.
    const changeHome = await text("/inventory/change-locations");
    assert(changeHome.res.status === 200, `change-locations expected 200 got ${changeHome.res.status}`);
    assert(changeHome.body.includes("Change Locations") && changeHome.body.includes('data-tab="plants"') && changeHome.body.includes('data-tab="packages"'), "Change Locations must carry the plants/packages toggle");
    assert(!changeHome.body.includes("Reserved. Awaiting the owner's talk-through."), "Change Locations is built, not reserved");
    assert(changeHome.body.includes("data-change-scope") && changeHome.body.includes('name="farm"'), "Change Locations must ask for the farm");
    for (const [path, title, iface] of [
      ["/inventory/zoho-upload", "Upload Inventory to Zoho", "Zoho items/adjustments CSV"],
      ["/inventory/physical-audit", "Physical Inventory Audit", "reconciliation report"],
      ["/inventory/location-audit", "Location Audit", "reconciliation report"],
    ]) {
      const reserved = await text(path);
      assert(reserved.res.status === 200, `${path} expected 200 got ${reserved.res.status}`);
      assert(reserved.body.includes(title), `${path} missing its title`);
      assert(
        reserved.body.includes("Reserved. Awaiting the owner's talk-through."),
        `${path} missing the reserved line`
      );
      assert(reserved.body.includes(iface), `${path} missing its future interface`);
    }
    const toLiteInv = await req("/view", { method: "POST", body: form({ view: "lite" }) });
    assert(toLiteInv.status === 303, `lite toggle expected 303 got ${toLiteInv.status}`);
    const liteInv = await text("/inventory");
    assert(liteInv.body.includes("WIP Inventory"), "lite inventory must render the sheet");
    assert(!liteInv.body.includes("--gold:#f1c232"), "lite inventory must not carry Cerberus gold");
    const toCerbInv = await req("/view", { method: "POST", body: form({ view: "cerberus" }) });
    assert(toCerbInv.status === 303, `cerberus restore expected 303 got ${toCerbInv.status}`);

    const adminLanding = await text("/admin");
    if (adminLanding.res.status !== 200) fail("GET /admin", `status ${adminLanding.res.status}`);
    const dq = adminLanding.body.indexOf("Data Queues");
    const lk = adminLanding.body.indexOf("Lookups");
    assert(dq !== -1 && lk !== -1 && dq < lk, "Admin landing must list Data Queues first");
    assert(adminLanding.body.includes('href="/admin/imports"'), "Admin landing missing Import Data");
    assert(adminLanding.body.includes("Import Data"), "Admin landing missing the Import Data title");
    // One admin page renders under Cerberus with its chrome intact (owner ruling 2026-09-01).
    assert(adminLanding.body.includes("--gold:#f1c232"), "the Admin landing must render under Cerberus");

    const dryingOps = await text("/ops/drying_ops");
    assert(dryingOps.res.status === 200, `GET /ops/drying_ops expected 200 got ${dryingOps.res.status}`);
    assert(dryingOps.body.includes("Unload Dry Space"), "drying ops missing Unload Dry Space");
    assert(
      dryingOps.body.includes('href="/virtual-move"'),
      "drying ops must link Virtual move to /virtual-move"
    );
    assert(
      !dryingOps.body.includes('class="tile tile-stub" href="/virtual-move"'),
      "drying ops must not orange-barrel Virtual move"
    );
    const productionOps = await text("/ops/production_ops");
    assert(
      productionOps.res.status === 200,
      `GET /ops/production_ops expected 200 got ${productionOps.res.status}`
    );
    assert(productionOps.body.includes('href="/production/scheduling"'), "production ops missing Production Scheduling");
    assert(
      productionOps.body.indexOf('data-pipeline-key="production_scheduling"') <
        productionOps.body.indexOf('data-pipeline-key="trim_packages"'),
      "Production Scheduling must stand first in Production Operations"
    );
    assert(productionOps.body.includes('href="/fulfillment"'), "production ops missing Fulfillment");
    assert(productionOps.body.includes('href="/inventory"'), "production ops missing Inventory");
    const schedLanding = await text("/production/scheduling");
    assert(schedLanding.res.status === 200, `GET /production/scheduling expected 200 got ${schedLanding.res.status}`);
    assert(schedLanding.body.includes("<h1>Production Scheduling</h1>"), "scheduling landing missing its heading");
    assert(schedLanding.body.includes('href="/production/scheduling/trim"'), "landing missing the Trimming tile");
    assert(schedLanding.body.includes('href="/production/scheduling/cryo"'), "landing missing the Pasteurization tile");
    const schedGhost = await text("/production/scheduling/nope");
    assert(schedGhost.res.status === 404, `unknown schedule stage expected 404 got ${schedGhost.res.status}`);
    const marketOps = await text("/ops/marketplace");
    assert(marketOps.res.status === 200, `GET /ops/marketplace expected 200 got ${marketOps.res.status}`);
    assert(marketOps.body.includes("Marketplace"), "marketplace group missing its title");
    assert(marketOps.body.includes('href="/marketplace"'), "marketplace group must link /marketplace");
    assert(!marketOps.body.includes("Enter PIN"), "ops marketplace group must stay open");
    const businessOps = await text("/ops/business_ops");
    assert(businessOps.res.status === 200, `GET /ops/business_ops expected 200 got ${businessOps.res.status}`);
    assert(businessOps.body.includes("Compliance Console"), "business ops missing Compliance Console");
    assert(businessOps.body.includes("Purchasing"), "business ops missing Purchasing");
    assert(businessOps.body.includes('href="/compliance"'), "business ops must link /compliance");
    assert(businessOps.body.includes('href="/purchasing"'), "business ops must link /purchasing");
    const ghostOps = await text("/ops/not_a_group");
    assert(ghostOps.res.status === 404, `unknown ops key expected 404 got ${ghostOps.res.status}`);

    const emptyImports = await text("/admin/imports");
    if (emptyImports.res.status !== 200) fail("GET /admin/imports", `status ${emptyImports.res.status}`);
    assert(emptyImports.body.includes("<h1>Import Data</h1>"), "imports page missing its heading");
    assert(emptyImports.body.includes("Nothing queued."), "empty imports must say Nothing queued.");
    assert(emptyImports.body.includes('accept=".csv,.xlsx,.xlsb,.xlsm"'), "imports form must accept csv, xlsx, xlsb, and xlsm");
    const csvBytes = new TextEncoder().encode("hbn,grams\nSMOKE,1.25\n");
    const csvForm = new FormData();
    csvForm.append("file", new File([csvBytes], "smoke-lots.csv", { type: "text/csv" }));
    const queueCsv = await req("/admin/imports", { method: "POST", body: csvForm });
    assert(queueCsv.status === 303, `queue csv expected 303 got ${queueCsv.status}`);
    assert(
      (queueCsv.headers.get("location") || "").endsWith("/admin/imports?ok=file_queued"),
      "queued file must flash File queued."
    );
    const queuedLoc = queueCsv.headers.get("location") || "";
    const queuedUrl = new URL(queuedLoc, base);
    const queuedPage = await text(queuedUrl.pathname + queuedUrl.search);
    assert(queuedPage.body.includes("File queued."), "imports missing the queued flash");
    assert(queuedPage.body.includes("smoke-lots.csv"), "imports missing the queued filename");
    assert(queuedPage.body.includes("<td>csv</td>"), "imports missing the csv kind");
    assert(queuedPage.body.includes("<td>queued</td>"), "imports missing the queued status");
    const importIdMatch = queuedPage.body.match(/href="\/admin\/imports\/([^/"]+)\/download"/);
    assert(importIdMatch, "imports row must carry a download link");
    const importId = importIdMatch[1];
    const importDl = await req(`/admin/imports/${importId}/download`);
    assert(importDl.status === 200, `import download expected 200 got ${importDl.status}`);
    assert((importDl.headers.get("content-type") || "").includes("text/csv"), "csv download must be text/csv");
    assert(
      (importDl.headers.get("content-disposition") || "").includes("smoke-lots.csv"),
      "csv download must keep the original filename"
    );
    const dlBytes = new Uint8Array(await importDl.arrayBuffer());
    assert(
      dlBytes.length === csvBytes.length && dlBytes.every((b, i) => b === csvBytes[i]),
      "import download must be byte-identical"
    );
    const hugeForm = new FormData();
    hugeForm.append("file", new File([new Uint8Array(1048577)], "too-big.csv", { type: "text/csv" }));
    const oversize = await req("/admin/imports", { method: "POST", body: hugeForm });
    assert(oversize.status === 400, `oversize import expected 400 got ${oversize.status}`);
    const oversizeBody = await oversize.text();
    assert(oversizeBody.includes("1 MB cap"), "oversize import must name the 1 MB cap");
    const pdfForm = new FormData();
    pdfForm.append("file", new File([new Uint8Array([37, 80, 68, 70])], "notes.pdf", { type: "application/pdf" }));
    const wrongKind = await req("/admin/imports", { method: "POST", body: pdfForm });
    assert(wrongKind.status === 400, `pdf import expected 400 got ${wrongKind.status}`);
    const wrongBody = await wrongKind.text();
    assert(wrongBody.includes("Only csv, xlsx, xlsb, and xlsm files can be queued."), "wrong kind must name csv, xlsx, xlsb, and xlsm");
    const voidImportGet = await text(`/record/import_queue/${importId}/void`, {
      headers: { referer: `${base}/admin/imports` },
    });
    assert(voidImportGet.res.status === 200, `void import form expected 200 got ${voidImportGet.res.status}`);
    assert(
      voidImportGet.body.includes('name="back" value="/admin/imports"'),
      "void import must return to the queue"
    );
    const voidImport = await req(`/record/import_queue/${importId}/void`, {
      method: "POST",
      body: form({ back: "/admin/imports", reason: "smoke void import" }),
    });
    assert(voidImport.status === 303, `void import expected 303 got ${voidImport.status}`);
    assert(
      (voidImport.headers.get("location") || "").endsWith("/admin/imports?ok=voided"),
      "voided import must return to the queue"
    );
    const afterVoidImports = await text("/admin/imports");
    assert(!afterVoidImports.body.includes("smoke-lots.csv"), "voided import must leave the queue");
    assert(afterVoidImports.body.includes("Nothing queued."), "voided queue must return to empty");
    const importLog = await text("/log");
    assert(importLog.body.includes("smoke void import"), "the change log must carry the import void reason");

    const redirect = await req("/queue/hbn_queue");
    assert(redirect.status === 302, `queue route should redirect, got ${redirect.status}`);
    assert((redirect.headers.get("location") || "").endsWith("/admin/queues"), "queue redirect target");

    let counts = await homeCounts();
    assert(
      counts.hbn === 0 && counts.dry === 0 && counts.unloaded === 0 && counts.inbound === 0 && counts.cryo === 0 && counts.testing === 0,
      "queues should start empty"
    );
    assert(counts.body.includes("Inbound Queue"), "Data Queues missing the Inbound Queue heading");
    assert(counts.body.includes("Unloaded Queue"), "Data Queues missing the Unloaded Queue heading");

    const addPerson = await req("/admin/lookups/people", {
      method: "POST",
      body: form({ action: "add", display_name: "Smoke Tester" }),
    });
    if (addPerson.status !== 303) fail("add person", `status ${addPerson.status}`);
    const loc = addPerson.headers.get("location") || "";
    const personId = new URL(loc, base).searchParams.get("person_id");
    if (!personId) fail("add person", "no person_id on redirect");

    // The auto-created login person shows on Lookups with its email.
    const lookupsLanding = await text("/admin/lookups");
    assert(lookupsLanding.body.includes("Harvest Operations"), "lookups landing missing Harvest Operations");
    assert(lookupsLanding.body.includes("Production Operations"), "lookups landing missing Production Operations");
    assert(lookupsLanding.body.includes("Logistics"), "lookups landing missing Logistics");
    assert(lookupsLanding.body.includes("People and System"), "lookups landing missing People and System");
    assert(lookupsLanding.body.includes("/admin/lookups/people"), "lookups landing missing People");
    assert(lookupsLanding.body.includes("/admin/lookups/silo_number"), "lookups landing missing Silo #");
    const lookupsAfterAdd = await text("/admin/lookups/people");
    assert(lookupsAfterAdd.body.includes(SMOKE_EMAIL), "Lookups people missing the auto-created login person");
    assert(lookupsAfterAdd.body.includes("Smoke Tester"), "Lookups people missing the added person");

    // THE PHONE LOGIN (canon 0.30.127; owner, 2026-09-18: "I'd like to make the
    // cloudflare login keyed to a cell phone number instead of an email
    // address" and "Start on an external IdP plus a small people-mapping
    // slice"). Access hands one identity string; a phone login arrives as
    // <digits>@<phone login domain> and maps onto the person carrying the
    // phone. A phone no person carries is refused in words (never
    // auto-created); a mapped phone acts as that person; a bare phone maps
    // too; the phone column edits with a reason and refuses a second person on
    // the same number; a deactivated person's phone is refused.
    assert(lookupsAfterAdd.body.includes("<th>phone</th>") && lookupsAfterAdd.body.includes('name="phone" inputmode="tel"'), "Lookups people must carry the phone column and the phone box");
    const PHONE_IDENTITY = "2695550100@phone.gripcannabis.com";
    const phoneHeaders = { "Cf-Access-Authenticated-User-Email": PHONE_IDENTITY };
    const unmappedPhone = await text("/", { headers: phoneHeaders });
    assert(unmappedPhone.res.status === 403, `an unmapped phone login expected 403 got ${unmappedPhone.res.status}`);
    assert(unmappedPhone.body.includes("This phone is not on the People list: +12695550100. Ask an admin to put it on the person in Lookups."), "the unmapped phone must be refused in words with the phone");
    const peopleBefore = await text("/admin/lookups/people");
    assert(!peopleBefore.body.includes("+12695550100") && !peopleBefore.body.includes("2695550100@phone"), "a refused phone login must create no person");
    const badPhone = await req("/admin/lookups/people", { method: "POST", body: form({ action: "add", display_name: "Bad Phone", phone: "12" }) });
    assert(badPhone.status === 400 && (await badPhone.text()).includes("Phone must be ten digits (US) or a + country code and number."), "a short phone must be refused in words");
    const addPhonePerson = await req("/admin/lookups/people", { method: "POST", body: form({ action: "add", display_name: "Phone Tester", phone: "(269) 555-0100" }) });
    assert(addPhonePerson.status === 303, `adding the phone person expected 303 got ${addPhonePerson.status} ${await addPhonePerson.text()}`);
    const phonePersonId = new URL(addPhonePerson.headers.get("location") || "", base).searchParams.get("person_id");
    assert(phonePersonId, "the phone person's id must ride the redirect");
    const peopleWithPhone = await text("/admin/lookups/people");
    assert(peopleWithPhone.body.includes("<td>+12695550100</td>"), "the phone must store as +E.164 and show on the People table");
    const dupPhone = await req("/admin/lookups/people", { method: "POST", body: form({ action: "add", display_name: "Second Phone", phone: "269-555-0100" }) });
    assert(dupPhone.status === 400 && (await dupPhone.text()).includes("That phone is already on another person."), "a second person on the same phone must be refused");
    const mappedPhone = await text("/", { headers: phoneHeaders });
    assert(mappedPhone.res.status === 200, `a mapped phone login expected 200 got ${mappedPhone.res.status}`);
    assert(mappedPhone.body.includes("+12695550100"), "the chrome must show the phone person's identity");
    assert(!mappedPhone.body.includes(SMOKE_EMAIL), "the phone login must not act as the smoke email");
    const barePhone = await text("/", { headers: { "Cf-Access-Authenticated-User-Email": "+12695550100" } });
    assert(barePhone.res.status === 200 && barePhone.body.includes("+12695550100"), `a bare phone identity must map too, got ${barePhone.res.status}`);
    const peopleAfterLogin = await text("/admin/lookups/people");
    assert((peopleAfterLogin.body.match(/\+12695550100/g) || []).length === 1, "a phone login must not create a second person row");
    // The reasoned edit of the phone lands in the log; a bad edit refuses in words.
    const phoneEditBad = await req(`/record/people/${phonePersonId}/edit`, { method: "POST", body: form({ display_name: "Phone Tester", email: "", phone: "555", is_active: "1", reason: "smoke: a bad phone" }) });
    assert(phoneEditBad.status === 400 && (await phoneEditBad.text()).includes("Phone must be ten digits (US) or a + country code and number."), "a bad phone edit must be refused in words");
    const phoneEdit = await req(`/record/people/${phonePersonId}/edit`, { method: "POST", body: form({ display_name: "Phone Tester", email: "", phone: "269.555.0199", is_active: "1", reason: "smoke: the tester's new number" }) });
    assert(phoneEdit.status === 303, `the phone edit expected 303 got ${phoneEdit.status} ${await phoneEdit.text()}`);
    const oldPhoneGone = await text("/", { headers: phoneHeaders });
    assert(oldPhoneGone.res.status === 403, `the old phone must be refused after the edit, got ${oldPhoneGone.res.status}`);
    const newPhoneIn = await text("/", { headers: { "Cf-Access-Authenticated-User-Email": "2695550199@phone.gripcannabis.com" } });
    assert(newPhoneIn.res.status === 200 && newPhoneIn.body.includes("+12695550199"), `the new phone must map, got ${newPhoneIn.res.status}`);
    const phoneLog = await text("/log");
    assert(phoneLog.body.includes("smoke: the tester's new number"), "the phone edit must land in the change log under its reason");
    const deactivatePhone = await req("/admin/lookups/people", { method: "POST", body: form({ action: "deactivate", id: phonePersonId, reason: "smoke: the tester leaves" }) });
    assert(deactivatePhone.status === 303, `deactivating the phone person expected 303 got ${deactivatePhone.status}`);
    const deactivatedPhone = await text("/", { headers: { "Cf-Access-Authenticated-User-Email": "2695550199@phone.gripcannabis.com" } });
    assert(deactivatedPhone.res.status === 403 && deactivatedPhone.body.includes("This login is deactivated: +12695550199."), "a deactivated person's phone must be refused in words");
    // An ordinary email keeps its first-login row; the phone domain is a value in data.
    const configPhone = await text("/admin/lookups/app_config");
    assert(configPhone.body.includes("<td>phone_login_domain</td>") && configPhone.body.includes("<td>phone.gripcannabis.com</td>"), "App config must carry phone_login_domain phone.gripcannabis.com");

    const acquireGet = await text("/station/acquire_hbn");
    assert(!acquireGet.body.includes('name="person_id"'), "acquire form must carry no Person picker");
    assert(acquireGet.body.includes('<label class="field" title="'), "acquire fields must carry hover help titles (the 2026-09-06 hover help law)");
    assert(!acquireGet.body.includes('class="field-help"'), "on-screen field help must be gone (hover only)");
    assert(
      acquireGet.body.includes("Admin\\Data Lookups\\Harvest Operations\\Silo #"),
      "Silo # help must name its Admin Data Lookups path"
    );
    assert(acquireGet.body.includes('name="planned_dryspc"'), "acquire form missing planned_dryspc");
    assert(acquireGet.body.includes("Start Time (planned, optional, 24h)"), "acquire form missing the planned 24h start time label");
    assert(acquireGet.body.includes("data-time24-mask"), "acquire start time missing the #### mask hook");
    assert(acquireGet.body.includes('name="license_value"'), "acquire form missing the required license select");
    assert(acquireGet.body.includes('name="license_value"') && acquireGet.body.includes("required"), "acquire license select must be required");
    const rawDigits = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({
        entry_date: "2026-09-01",
        farm_code: "ARL",
        grow_method_code: "GH",
        strain_id: optionValue(acquireGet.body, "Fruity Pebbles"),
        start_time: "0730",
      }),
    });
    assert(rawDigits.status === 400, `raw #### start time must still refuse 400 got ${rawDigits.status}`);
    const badTime = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({
        entry_date: "2026-09-01",
        farm_code: "ARL",
        grow_method_code: "GH",
        strain_id: optionValue(acquireGet.body, "Fruity Pebbles"),
        start_time: "7:00 AM",
      }),
    });
    assert(badTime.status === 400, `24h refusal expected 400 got ${badTime.status}`);
    const badTimeBody = await badTime.text();
    assert(badTimeBody.includes("HH:MM"), "24h refusal must name the format");
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
    // THE FIRST LOT TOKEN (canon 0.30.55): migration 0044 seeds first_lot_token 26010,
    // so a from-zero floor mints its first 2026 lot at serial 010, not 001.
    assert(minted === "26244-ARL-GH-027-0-NA-26010", `unexpected HBN ${minted}`);
    const cfgPage = await text("/admin/lookups/app_config");
    assert(
      cfgPage.body.includes("first_lot_token") && cfgPage.body.includes("26010"),
      "Admin app_config must carry first_lot_token 26010"
    );

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
    assert(minted2 === "26244-ARL-GH-027-0-NA-26011", `unexpected second HBN ${minted2}`);

    counts = await homeCounts();
    assert(counts.hbn === 2, `hbn after second mint expected 2 got ${counts.hbn}`);

    const wetPage = await text("/station/wet_weight");
    if (wetPage.res.status !== 200) fail("GET /station/wet_weight", `status ${wetPage.res.status}`);
    // One station page renders under Cerberus with its chrome intact (owner ruling 2026-09-01).
    assert(wetPage.body.includes("--gold:#f1c232"), "the wet weight page must render under Cerberus");
    assert(wetPage.body.includes("Pick from the left"), "wet weight page missing left pane prompt");
    const paneLink = wetPage.body.match(/href="\/station\/wet_weight\?pick=([^"]+)">([^<]+)</);
    if (!paneLink) fail("wet weight pane", "missing pane pick link");
    const batchId = paneLink[1];
    const paneLabel = paneLink[2].replace(/^\d+\. /, "");
    const pickedPage = await text(`/station/wet_weight?pick=${batchId}`);
    if (pickedPage.res.status !== 200) fail("GET picked wet weight", `status ${pickedPage.res.status}`);
    // The pane label no longer carries the HBN (canon 0.22.0); the picked page
    // shows it muted, so learn it there and pin it to one of the minted two.
    const mutedHbn = pickedPage.body.match(/<p class="muted">(2\d{4}-[A-Z]{3}-[^<]+)<\/p>/);
    if (!mutedHbn) fail("picked wet weight", "missing the muted HBN line");
    const pickedHbn = mutedHbn[1];
    assert(pickedHbn === minted || pickedHbn === minted2, `muted HBN ${pickedHbn} is neither minted serial`);
    const hiddenBatch = firstInputValue(pickedPage.body, "harvest_batch_id");
    assert(hiddenBatch === batchId, `hidden batch id expected ${batchId} got ${hiddenBatch}`);
    // Canon 0.22.0: the heading is the simple Farm/Strain/Date form.
    assert(
      pickedPage.body.includes(`<h2 class="working-pick">${paneLabel}</h2>`),
      `picked page missing the simple header ${paneLabel}`
    );
    // THE SUPERVISOR AND THE TEAM LEAD (canon 0.30.67; owner, verbatim: "Minted
    // HBNs are passing the Team Lead definition from the cloudflare login email
    // to the wet weight screen.  Let's make all "Supervisors" the email, the
    // team lead should be hand entered"): the header names the login as the
    // Supervisor, a line and never a picker, and takes the Team Lead by hand.
    assert(pickedPage.body.includes("Team Lead"), "picked page missing the Team Lead label");
    assert(pickedPage.body.includes(`data-supervisor>Supervisor: ${SMOKE_EMAIL}</p>`), "picked page must name the login email as the Supervisor");
    assert(pickedPage.body.includes('<input type="text" name="team_lead" required autocomplete="off" data-team-lead>'), "picked page must carry the hand-typed Team Lead box");
    assert(!pickedPage.body.includes('name="lead_person_id"'), "the Lead picker retired with canon 0.30.67");
    assert(pickedPage.body.includes("Start lot"), "picked page missing the Start lot button");
    // THE EFFECTIVE DATE PER STATION (canon 0.30.94): the Start lot header
    // carries the Effective Date, defaulting to today, the Admin PIN for any
    // other day; it writes the lot's transaction date.
    assert(pickedPage.body.includes('<details class="effective-date" data-effective-date>'), "the Start lot header must carry the Effective Date field");
    assert(/<input type="date" name="effective_date" data-effective-input data-effective-default="" data-effective-auto>/.test(pickedPage.body), "the wet Effective Date must be client-defaulted");
    assert(pickedPage.body.includes('name="effective_pin"'), "the Start lot header must carry the Admin PIN box");
    assert(!pickedPage.body.includes('name="weight_grams"'), "picked header must carry no bucked weight input");
    assert(!pickedPage.body.includes('name="wet_spear_weight_grams"'), "picked header must carry no spear input");
    // THE BLANK SLATE (canon 0.30.108; owner, 2026-09-17, verbatim: "Wet
    // Weights: assume everything that get's entered into wet weights is landing
    // in PNN's barn location.  We'll handle real life logistics in METRC for
    // now"): this ARL HBN's Move To offers the landing site's silos and rooms,
    // never ARL's own room and never a truck; the Add a truck control is gone;
    // a truck pick, staged or hand-built, refuses in words.
    assert(!pickedPage.body.includes("Add a truck"), "the Add a truck control left with the trucks");
    // The Move To select alone (the shell's theme names the Arlington Dry Room in a comment).
    const moveToSelect = (pickedPage.body.match(/<select name="actual_dryspc"[^>]*>([^]*?)<\/select>/) || [])[1];
    assert(moveToSelect, "the picked page must carry the Move To select");
    assert(moveToSelect.includes(">Silo 1<"), "an ARL HBN's Move To must offer PNN's silos (everything lands in PNN's barn)");
    assert(moveToSelect.includes("Hang in Place"), "an ARL HBN's Move To must offer PNN's rooms");
    assert(moveToSelect.includes("Blast Freezer(s)"), "an ARL HBN's Move To must offer the Blast Freezer(s)");
    assert(!moveToSelect.includes("Arlington Dry Room"), "ARL's own room is not a landing space; nothing loads at ARL now");
    assert(!moveToSelect.includes('value="truck-'), "no truck options may render");
    assert(!moveToSelect.includes(">Truck</option>"), "the bare sentinel Truck must never render");
    const stage = await req("/station/wet_weight/add_truck", { method: "POST", body: form({ pick: batchId }) });
    if (stage.status !== 303) fail("add truck stage", `status ${stage.status}`);
    const stagedPage = await text(stage.headers.get("location") || "");
    assert(stagedPage.res.status === 200 && !stagedPage.body.includes('value="truck-'), "a staged truck number must not surface a truck option");
    const truckRefused = await req("/station/wet_weight", {
      method: "POST",
      body: form({ team_lead: "Smoke Lead", harvest_batch_id: batchId, actual_dryspc: "truck-1", material_form: "bucked", notes: "truck lot" }),
    });
    assert(truckRefused.status === 400, `a truck pick expected 400 got ${truckRefused.status}`);
    assert((await truckRefused.text()).includes("Trucks left the Move To list; every lot lands in PNN's barn. Pick a silo or a room."), "the truck pick must refuse in words");
    counts = await homeCounts();
    assert(counts.inbound === 0, `inbound stays 0 with the trucks gone, got ${counts.inbound}`);

    const lookupsPage = await text("/admin/lookups/dry_spaces");
    if (lookupsPage.res.status !== 200) fail("GET /admin/lookups/dry_spaces", `status ${lookupsPage.res.status}`);
    const drySpaceId = drySpaceIdByName(lookupsPage.body, "Silo 1");
    const arlRoomIdEarly = drySpaceIdByName(lookupsPage.body, "Arlington Dry Room");
    // Canon 0.30.67: the Team Lead is required by hand; the login cannot stand in for it.
    const startNoLead = await req("/station/wet_weight", {
      method: "POST",
      body: form({ harvest_batch_id: batchId, actual_dryspc: drySpaceId, notes: "no lead" }),
    });
    assert(startNoLead.status === 400 && (await startNoLead.text()).includes("Team Lead is required."), `start lot without a Team Lead expected 400 in words got ${startNoLead.status}`);
    const startLot = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        team_lead: "Smoke Lead",
        harvest_batch_id: batchId,
        actual_dryspc: drySpaceId,
        notes: "smoke lot",
      }),
    });
    if (startLot.status !== 303) fail("start lot", `status ${startLot.status}`);
    const wetLotId = new URL(startLot.headers.get("location") || "", base).searchParams.get("lot");
    if (!wetLotId) fail("start lot", "no lot id on redirect");
    // THE EFFECTIVE DATE PER STATION (canon 0.30.94): a Start lot backdated
    // without the Admin PIN refuses in words and mints nothing (a fresh Team
    // Lead so the repeat guard does not take it for a twin first).
    const wetBackdateNoPin = await req("/station/wet_weight", {
      method: "POST",
      body: form({ team_lead: "Backdate Lead", harvest_batch_id: batchId, actual_dryspc: drySpaceId, effective_date: "2026-09-08" }),
    });
    assert(wetBackdateNoPin.status === 403, `a wet Start lot backdated without the PIN expected 403 got ${wetBackdateNoPin.status}`);
    assert((await wetBackdateNoPin.text()).includes("Changing the Effective Date needs the Admin PIN."), "the wet backdate refusal must name the PIN");
    // THE FOUR START TAPS (canon 0.30.89; owner, 2026-09-16, four lots born six
    // seconds apart: "What's happening?"): the same header posted again a moment
    // later lands on the lot just started, with its flash, and mints nothing;
    // the header form locks its button on the first tap.
    const secondTap = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        team_lead: "smoke lead",
        harvest_batch_id: batchId,
        actual_dryspc: drySpaceId,
        notes: "smoke lot, tapped twice",
      }),
    });
    assert(secondTap.status === 303, `a second Start lot tap expected 303 got ${secondTap.status}`);
    assert(
      (secondTap.headers.get("location") || "").endsWith(`/station/wet_weight?lot=${wetLotId}&repeat=1`),
      `a second tap must land on the lot just started, got ${secondTap.headers.get("location")}`
    );
    const tappedView = await text(`/station/wet_weight?lot=${wetLotId}&repeat=1`);
    assert(tappedView.body.includes("That lot was already started a moment ago; you are on it. No second lot was made."), "the second tap must flash its line");
    assert(!tappedView.body.includes("Lots in progress"), "one lot on the HBN, so no resume list: nothing was minted by the tap");
    const headerAgain = await text(`/station/wet_weight?pick=${batchId}&new=1`);
    assert(headerAgain.body.includes('action="/station/wet_weight" data-lock-on-submit>'), "the header form must lock its button on submit");
    assert(headerAgain.body.includes("form[data-lock-on-submit]"), "the lock script must ride the header form");
    // The resume list names the lot in local time with its Move To and Team Lead.
    assert(/<time datetime="[^"]+" data-local>[^<]+<\/time> · Silo 1 · Smoke Lead \(total 0 g\)/.test(headerAgain.body), "the resume list must name the lot by local time, Move To and Team Lead");
    let lotView = await text(`/station/wet_weight?lot=${wetLotId}`);
    if (lotView.res.status !== 200) fail("GET lot page", `status ${lotView.res.status}`);
    assert(lotView.body.includes("Weights"), "lot page missing the Weights pane");
    assert(lotView.body.includes(`<p class="muted">${pickedHbn}</p>`), "lot page missing the muted HBN");
    assert(lotView.body.includes("smoke lot"), "lot page missing the note");
    assert(lotView.body.includes("<dt>Team Lead</dt><dd data-team-lead>Smoke Lead</dd>"), "lot page must show the typed Team Lead");
    assert(lotView.body.includes(`<dt>Supervisor</dt><dd data-supervisor>${SMOKE_EMAIL}</dd>`), "lot page must show the login email as the Supervisor");
    assert(!lotView.body.includes("<dt>Lead</dt>"), "the bare Lead row retired with canon 0.30.67");
    assert(lotView.body.includes("Finish load"), "lot page missing the Finish load button");
    // The pane and the panel render together (owner ruling 2026-08-31). The
    // weighing lot keeps the batch in the pane for its resume (owner ruling
    // 2026-08-28: "weighing lot keeps the batch visible"; owner ruling
    // 2026-09-01, alpha feedback: an in-progress lot must never hide; THE HBN
    // THAT CAME BACK, canon 0.30.84), marked as picked. THE BLANK SLATE (canon
    // 0.30.108): the truck lot that once rode this batch was refused above.
    assert(lotView.body.includes('class="queue-pane"'), "wet lot view missing the pane beside the panel");
    assert(
      lotView.body.includes("queue-pane-item selected"),
      "a weighing lot keeps its batch in the pane, marked as picked"
    );
    assert(lotView.body.includes(`?pick=${batchId}`), "the weighing lot's batch must be in the pane for resume");

    for (const grams of ["1000.06", "234.50"]) {
      const addWeight = await req(`/station/wet_weight/lot/${wetLotId}/weights`, {
        method: "POST",
        body: form({ weight_grams: grams }),
      });
      if (addWeight.status !== 303) fail(`add weight ${grams}`, `status ${addWeight.status}`);
    }
    lotView = await text(`/station/wet_weight?lot=${wetLotId}`);
    // Owner ruling 2026-08-31: add commas to all thousands; the rendered total
    // groups while storage stays 1234.56.
    assert(lotView.body.includes("1,235"), "lot page missing total 1,235");

    // THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69; owner: "If it's
    // being filled in the wet weight screen, indicate underneath that it's
    // "filling"", "Live inventory on all screens, including the Inventory by
    // Location report"): while this lot weighs into Silo 1, the inventory tile,
    // the drying strip, the live endpoint and the location report all read the
    // running total under Silo 1 as filling, green and throbbing.
    const fillingInv = await text("/inventory");
    assert((fillingInv.body.match(/<svg class="silo-shape"/g) || []).length === 5, "the inventory screen must draw five cone-topped cylinders");
    // THE HARVEST CONSOLE (canon 0.30.73): the Arlington Dry Room is the sixth
    // silo, drawn as the 3D wire box (front, side and top fills, dashed back edges).
    // THE BLAST FREEZER (canon 0.30.98) drew a second wire box; THE DRY SPACE
    // TYPE (canon 0.30.106) makes it the freezer's cube: one box, one cube.
    assert((fillingInv.body.match(/<svg class="silo-shape silo-shape-box"/g) || []).length === 1, "the inventory screen must draw the Arlington Dry Room as the one wire box");
    assert((fillingInv.body.match(/<svg class="silo-shape silo-shape-cube"/g) || []).length === 1, "the inventory screen must draw the Blast Freezer(s) as the cube");
    assert(fillingInv.body.includes(`data-silo="${arlRoomIdEarly}" data-silo-state="empty" data-silo-shape-kind="box"`), "the box tile must name its shape");
    assert(fillingInv.body.includes('<path class="silo-wire silo-wire-hidden" d="M66 24 V116 H178 M34 134 L66 116"/>'), "the box must dash its hidden back edges");
    assert(fillingInv.body.includes('data-silo-fill-top data-box="34 146 32 18"'), "the box must carry the liquid's top face for the live repaint");
    {
      const gaugesStart = fillingInv.body.indexOf('<div class="inv-gauges">');
      const gaugesEnd = fillingInv.body.indexOf("<script>", gaugesStart);
      assert(gaugesStart > 0 && gaugesEnd > gaugesStart && !fillingInv.body.slice(gaugesStart, gaugesEnd).includes("<circle"), "no silo is a circle any more");
    }
    assert(fillingInv.body.includes(`data-silo="${drySpaceId}" data-silo-state="filling"`), "the Silo 1 tile must read filling while the wet weight screen fills it");
    assert(fillingInv.body.includes('<div class="silo-state silo-state-filling" data-silo-label>filling</div>'), "the word filling must sit under the filling silo");
    assert(fillingInv.body.includes('class="silo-fill silo-fill-green silo-throb"'), "the filling silo must throb green inside the wireframe");
    assert(fillingInv.body.includes('Wet <strong data-silo-wet-lb>2.76</strong> lb · <strong data-silo-wet-g>1,235</strong> g'), "the wet weight must ride the bottom of the Silo 1 tile");
    assert(fillingInv.body.includes('fetch("/silos/live.json"'), "the inventory screen must carry the live silo refresh");
    const fillingStrip = await text("/station/load_silo");
    assert(fillingStrip.body.includes(`data-silo="${drySpaceId}" data-silo-state="filling"`), "the drying strip must read Silo 1 filling too");
    const liveRes = await req("/silos/live.json");
    assert(liveRes.status === 200 && (liveRes.headers.get("cache-control") || "").includes("no-store"), `live silos expected 200 no-store got ${liveRes.status}`);
    const liveData = await liveRes.json();
    assert(Math.abs(liveData.capacityGrams - 15000 * 448) < 0.01, `capacity must scale 15,000 lbs wet, got ${liveData.capacityGrams}`);
    const silo1Live = liveData.silos.find((x) => x.id === drySpaceId);
    assert(silo1Live && silo1Live.state === "filling" && silo1Live.label === "filling" && silo1Live.throb === "green" && silo1Live.fill === "green", `live Silo 1 must be filling, got ${JSON.stringify(silo1Live)}`);
    assert(silo1Live.wetG === "1,235" && silo1Live.wetLb === "2.76" && Math.abs(silo1Live.level - 1235 / (15000 * 448)) < 1e-9, `live Silo 1 must carry the running total, got ${JSON.stringify(silo1Live)}`);
    // Canon 0.30.73: the Arlington Dry Room's box joined the five cylinders; THE BLAST
    // FREEZER (canon 0.30.98) is the seventh silo, a second box at Penn North; the other six read empty.
    assert(liveData.silos.length === 7, `live.json must carry seven silos, got ${liveData.silos.length}`);
    assert(liveData.silos.filter((x) => x.state === "empty").length === 6, "the other six silos read empty");
    assert(
      liveData.silos.filter((x) => x.shape === "box").length === 1 &&
        liveData.silos.filter((x) => x.shape === "cube").length === 1 &&
        liveData.silos.filter((x) => x.shape === "cylinder").length === 5,
      "live.json must name five cylinders, one box and one cube"
    );
    // THE DRY SPACE TYPE (canon 0.30.106): the Blast Freezer(s) rides live.json as the freezer cube of 800 lb.
    const bfLive = liveData.silos.find((x) => x.name === "Blast Freezer(s)");
    assert(bfLive && bfLive.shape === "cube" && bfLive.spaceType === "freezer" && bfLive.pctLabel === "0% full", `the Blast Freezer(s) must ride live.json as an empty freezer cube, got ${JSON.stringify(bfLive)}`);
    assert(!liveData.silos.some((x) => x.name === "Blast Freezer"), "the tile's word is Blast Freezer(s); the METRC location keeps Blast Freezer");
    const fillingReport = await text("/reports/inventory_by_location?format=csv");
    assert(/PNN,Silo 1,[A-Z]*,WET,"1,235",g/.test(fillingReport.body), `the report must place the filling lot under Silo 1, got\n${fillingReport.body.slice(0, 400)}`);
    assert(fillingReport.body.includes('PNN,Silo 1,,Wet total,"1,235",g'), "the report must close Silo 1 with its Wet total row");

    const finish = await req(`/station/wet_weight/lot/${wetLotId}/finish`, {
      method: "POST",
      body: form({}),
    });
    if (finish.status !== 303) fail("finish lot", `status ${finish.status}`);

    // THE TRUCK RECORD (canon 0.30.226): a batch finished today stays on the pane
    // for its next truck. The HBN Queue table keeps it until Mark complete.
    // The pane still never prints the HBN itself (canon 0.22.0).
    const otherHbn = pickedHbn === minted ? minted2 : minted;
    const wetAfterFinish = await text("/station/wet_weight");
    if (wetAfterFinish.res.status !== 200) {
      fail("GET wet weight after finish", `status ${wetAfterFinish.res.status}`);
    }
    assert(wetAfterFinish.body.includes(`?pick=${batchId}`), `pane keeps a batch finished today ${batchId}`);
    assert(!wetAfterFinish.body.includes(pickedHbn), "the pane never prints an HBN (canon 0.22.0)");
    const panePicks = [...wetAfterFinish.body.matchAll(/href="\/station\/wet_weight\?pick=([a-f0-9-]{36})"/g)].map((m) => m[1]);
    assert(panePicks.includes(batchId) && panePicks.some((id) => id !== batchId), `pane must keep today's finished batch and the open batch (${otherHbn})`);

    counts = await homeCounts();
    assert(counts.hbn === 2, `hbn after wet expected 2 got ${counts.hbn}`);
    assert(counts.dry === 1, `dry after finish expected 1 got ${counts.dry}`);
    // THE BLANK SLATE (canon 0.30.108): no truck rides the Inbound Queue any more.
    assert(counts.inbound === 0, `inbound after a silo finish expected 0 got ${counts.inbound}`);
    assert(counts.body.includes("Inbound Queue"), "Data Queues missing the Inbound Queue heading");
    // Owner ruling 2026-08-31: queue tables render gram columns comma grouped.
    assert(counts.body.includes("1,235"), "Data Queues missing lot total 1,235");
    assert(
      queueSectionHtml(counts.body, "hbn_queue").includes(pickedHbn),
      `HBN Queue must keep ${pickedHbn} until Mark complete`
    );

    // Unload Dry Space (owner ruling 2026-08-31): "left pane: available-in-queue,
    // right pane: what's currently saved about that record and the ability to add
    // more to it." The pane is the Dry Space Queue grouped by dry space; picking a
    // drying lot keeps the two-pane page, with the lot's dry record panel on the
    // right, headed by the short id (HBN serial, plus tag tail when one exists).
    const shortId = pickedHbn.slice(-5);
    const unloadPane = await text("/station/unload_dry_space");
    if (unloadPane.res.status !== 200) {
      fail("GET /station/unload_dry_space", `status ${unloadPane.res.status}`);
    }
    assert(unloadPane.body.includes("Pick a lot from the pane."), "unload landing missing the pane prompt");
    assert(
      unloadPane.body.includes('<details class="pane-group"><summary>Silo 1 <span class="tile-count">1</span></summary>'),
      "unload pane must group the drying lot by its dry space"
    );
    const unloadPick = unloadPane.body.match(/href="\/station\/unload_dry_space\?pick=([^"]+)"/);
    if (!unloadPick) fail("unload pane", "missing the pick link");
    assert(unloadPick[1] === wetLotId, `unload pane must offer the drying lot, got ${unloadPick[1]}`);

    // The old ?lot= URL is a compatibility alias now; it redirects to the pick page.
    const legacyLot = await req(`/station/unload_dry_space?lot=${wetLotId}`);
    assert(legacyLot.status === 302, `unload ?lot alias expected 302 got ${legacyLot.status}`);
    assert(
      (legacyLot.headers.get("location") || "").endsWith(`pick=${wetLotId}`),
      "unload ?lot alias must redirect to the pick page"
    );

    let unloadView = await text(`/station/unload_dry_space?pick=${wetLotId}`);
    if (unloadView.res.status !== 200) fail("GET unload pick page", `status ${unloadView.res.status}`);
    assert(
      unloadView.body.includes('<details class="pane-group" open><summary>Silo 1 <span class="tile-count">1</span></summary>'),
      "the picked unload page must keep the pane with the picked group open"
    );
    assert(
      unloadView.body.includes("queue-pane-item selected"),
      "the picked unload page must mark the picked row"
    );
    assert(
      unloadView.body.includes(`${shortId} - Fruity Pebbles</h2>`),
      "unload pick page missing the short id heading"
    );
    assert(unloadView.body.includes(pickedHbn), "unload pick page must keep the full HBN muted below");
    assert(unloadView.body.includes("Finish unload"), "unload pick page missing the Finish unload button");
    assert(unloadView.body.includes("Operator"), "silo unload missing the session Operator");
    assert(unloadView.body.includes(`data-supervisor>Supervisor: ${SMOKE_EMAIL}</p>`), "silo unload must name the login email as the Supervisor on the session line");
    assert(unloadView.body.includes('data-team-lead>Team Lead: Smoke Lead</p>'), "silo unload must show the lot's typed Team Lead");
    // THE EFFECTIVE DATE PER STATION (canon 0.30.94): the unload session form
    // carries the Effective Date; a backdated save under the Admin PIN stores it
    // on the session and it reads back on the field; a weight-add never clobbers it.
    assert(unloadView.body.includes('<details class="effective-date" data-effective-date>'), "the unload session form must carry the Effective Date field");
    assert(unloadView.body.includes('name="effective_pin"'), "the unload session form must carry the Admin PIN box");
    const unloadBackNoPin = await req(`/station/unload_dry_space/lot/${wetLotId}/session`, {
      method: "POST",
      body: form({ operator_name: "Smoke Unloader", effective_date: "2026-09-08" }),
    });
    assert(unloadBackNoPin.status === 400 || unloadBackNoPin.status === 403, `an unload backdate without the PIN expected 403 got ${unloadBackNoPin.status}`);
    const unloadBackPin = await req(`/station/unload_dry_space/lot/${wetLotId}/session`, {
      method: "POST",
      body: form({ operator_name: "Smoke Unloader", effective_date: "2026-09-08", effective_pin: ADMIN_PIN }),
    });
    assert(unloadBackPin.status === 303, `an unload backdate under the PIN expected 303 got ${unloadBackPin.status}`);
    const unloadDated = await text(`/station/unload_dry_space?pick=${wetLotId}`);
    assert(/name="effective_date" value="2026-09-08"/.test(unloadDated.body), "the unload session must keep its backdated Effective Date on the field");
    assert(!unloadView.body.includes(">TL:"), "the TL line retired with canon 0.30.67");
    assert(!unloadView.body.includes('value="spear"'), "silo unload must hide the Spear radio");
    assert(unloadView.body.includes("Dry weights"), "unload pick page missing the Dry weights pane");
    // Balance displays (owner ruling 2026-08-31): "The weights of the original
    // package and what's left after a record is created should be on the
    // weight recording pages." Original (wet) is the lot's 1,234.56 wet total,
    // comma formatted; with zero dry rows Remaining still equals it.
    assert(
      unloadView.body.includes("<dt>Original (wet)</dt><dd>1,235 g</dd>"),
      "unload pick page missing the Original (wet) line at 1,235 g"
    );
    assert(
      unloadView.body.includes("<dt>Remaining</dt><dd>1,235 g</dd>"),
      "unload Remaining must start at the full wet total"
    );

    for (const grams of ["500.25", "250.50"]) {
      const addDry = await req(`/station/unload_dry_space/lot/${wetLotId}/weights`, {
        method: "POST",
        body: form({ weight_grams: grams }),
      });
      if (addDry.status !== 303) fail(`add dry weight ${grams}`, `status ${addDry.status}`);
      const addDryLoc = addDry.headers.get("location") || "";
      assert(
        addDryLoc.includes(`pick=${wetLotId}`),
        `dry weight redirect must land on the pick page, got ${addDryLoc}`
      );
    }
    unloadView = await text(`/station/unload_dry_space?pick=${wetLotId}`);
    assert(unloadView.body.includes("Dry total"), "unload pick page missing the Dry total line");
    // Whole grams at the door: 500.25 and 250.50 store as 500 and 251, total 751.
    assert(unloadView.body.includes("751"), "unload pick page missing dry total 751");
    // Remaining: 1,235 wet minus 751 dry is 484.
    assert(
      unloadView.body.includes("<dt>Remaining</dt><dd>484 g</dd>"),
      "unload Remaining must drop to 484 after the dry weights"
    );
    assert(
      unloadView.body.includes("<dt>Original (wet)</dt><dd>1,235 g</dd>"),
      "unload Original (wet) must stay at the wet total"
    );

    // The reasoned pencil works on dry weights too. 250.75 stores as the same whole gram, 251.
    const dryRow = unloadView.body.match(/<td>251<\/td>[^]*?href="\/record\/dry_weights\/([^/"]+)\/edit"/);
    if (!dryRow) fail("unload pick page", "missing the pencil on the 251 dry weight");
    const dryEdit = await req(`/record/dry_weights/${dryRow[1]}/edit`, {
      method: "POST",
      body: form({ weight_grams: "252", reason: "smoke dry reweigh" }),
    });
    if (dryEdit.status !== 303) fail("dry weight edit", `status ${dryEdit.status}`);
    unloadView = await text(`/station/unload_dry_space?pick=${wetLotId}`);
    assert(unloadView.body.includes("752"), "dry total must recompute to 752 after the edit");
    assert(
      unloadView.body.includes("<dt>Remaining</dt><dd>483 g</dd>"),
      "unload Remaining must recompute to 483 after the dry edit"
    );

    const finishUnload = await finishUnloadLot(wetLotId, {}, "queue_adjust");
    assert(finishUnload.gated, "silo 751 vs parent 1,234.56 must open the under-issue gate");
    // Canon 0.30.1 fork 7: the METRC finish choice is gone; the under gate
    // offers the adjustment CSV as its corrective lane.
    assert(finishUnload.gateBody.includes('data-gate-kind="under"'), "the under gate must render");
    assert(!finishUnload.gateBody.includes("Finish package in METRC"), "the METRC finish choice must be gone");
    assert(finishUnload.gateBody.includes("Queue an adjustment CSV"), "the under gate must offer the adjustment CSV");
    const finishLoc = finishUnload.loc;
    // Fork 8: a queued adjustment lands at the export home where its file pends.
    assert(
      finishLoc.includes("/admin/uploads?ok=adjust_queued"),
      `a queued adjustment must land at the export home, got ${finishLoc}`
    );
    const finishedView = await req(`/station/unload_dry_space?pick=${wetLotId}`);
    assert(
      finishedView.status === 302,
      `a finished lot must bounce off the unload pick page, got ${finishedView.status}`
    );

    counts = await homeCounts();
    assert(counts.dry === 0, `dry after unload expected 0 got ${counts.dry}`);
    assert(counts.unloaded === 1, `unloaded after unload expected 1 got ${counts.unloaded}`);
    const unloadedSection = queueSectionHtml(counts.body, "unloaded_queue");
    assert(unloadedSection.includes(shortId), "unloaded queue row missing the short id");
    assert(unloadedSection.includes("Fruity Pebbles"), "unloaded queue row missing the strain");
    // Owner ruling 2026-08-31: the dry total column renders through formatGrams.
    assert(unloadedSection.includes("752"), "unloaded queue row missing the dry total 752");
    const unloadedCsv = await text("/export/unloaded_queue.csv");
    assert(unloadedCsv.res.status === 200, "unloaded queue csv");
    assert(unloadedCsv.body.includes(shortId), "unloaded queue csv missing the short id");
    // Owner ruling 2026-08-31: commas are display only; the queue export stays
    // raw, the stored 751 with no formatting and no grouping anywhere.
    assert(unloadedCsv.body.includes(",752,"), "unloaded queue csv must carry the raw dry total 752");
    assert(!unloadedCsv.body.includes("751.00"), "unloaded queue csv must not carry a formatted dry total");
    // THE CURE PANES: an unloaded lot with no trim schedule sits in CSA.
    const cureOf = (html, name) => {
      const at = html.indexOf(`data-cure-pane="${name}"`);
      if (at < 0) return "";
      const rest = html.slice(at);
      const next = rest.indexOf('data-cure-pane="', 20);
      return next < 0 ? rest : rest.slice(0, next);
    };
    const consoleUnloaded = await text("/harvest");
    const dryingUnloaded = await text("/ops/drying_ops");
    assert(cureOf(consoleUnloaded.body, "CSA").includes(`data-cure-lot="${wetLotId}"`), "the console CSA pane must list the unloaded lot");
    // THE ROW FOLDS ON THE LOT NUMBER (owner, 2026-09-22): the lot's row is a folded details element, the id and the time in on its summary.
    {
      const csa = cureOf(consoleUnloaded.body, "CSA");
      const rowAt = csa.indexOf(`<details class="cure-row" data-cure-lot="${wetLotId}">`);
      assert(rowAt >= 0, "the CSA row must be a folded details element");
      const row = csa.slice(rowAt, csa.indexOf("</details>", rowAt));
      assert(row.includes('<summary class="cure-head" data-cure-head><span class="cure-id">') && row.indexOf("cure-id") < row.indexOf("data-cure-clock") && row.indexOf("data-cure-clock") < row.indexOf("</summary>"), "the lot number and its time in must share the summary line");
      assert(row.indexOf("</summary>") < row.indexOf('class="cure-weight"') && row.includes(`href="/record/wet_weight_entries/${wetLotId}/edit">Lot record</a>`), "the weight and the lot record link must open under the summary");
    }
    // THE PANES RIDE THE STRIP (owner, 2026-09-22): on the console and on a drying page the two panes stand inside
    // the strip's tile row, after the FFZ cube, and nowhere else.
    for (const [label, page] of [["console", consoleUnloaded.body], ["drying page", dryingUnloaded.body]]) {
      const stripAt = page.indexOf('<section class="silo-strip"');
      const stripEnd = page.indexOf("</section>", stripAt);
      const row = page.slice(stripAt, stripEnd);
      assert(stripAt >= 0 && row.includes('data-cure-pane="CSA"') && row.includes('data-cure-pane="CSB"'), `${label}: CSA and CSB must ride the strip's row`);
      assert(!row.includes("data-ffz") && row.lastIndexOf("data-silo=") < row.indexOf('data-cure-pane="CSA"') && row.indexOf('data-cure-pane="CSA"') < row.indexOf('data-cure-pane="CSB"'), `${label}: the panes must follow the last space tile`);
      assert(!page.slice(stripEnd).includes("data-cure-pane"), `${label}: no pane may stand outside the strip`);
      assert(!page.includes("cure-panes"), `${label}: the old wrapper must be gone`);
    }
    assert(!cureOf(consoleUnloaded.body, "CSB").includes(`data-cure-lot="${wetLotId}"`), "CSB must not list a lot that is not scheduled for trim");
    assert(cureOf(dryingUnloaded.body, "CSA").includes(`data-cure-lot="${wetLotId}"`), "a drying page CSA pane must list the unloaded lot");
    const sensorOk = await req("/sensors/readings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: "CSA", temperature_f: 68.2, humidity_pct: 58, read_at: new Date().toISOString(), source: "silo-ops" }),
    });
    assert(sensorOk.status === 200, `a sensor reading expected 200 got ${sensorOk.status} ${await sensorOk.text()}`);
    const withSensor = await text("/ops/drying_ops");
    assert(cureOf(withSensor.body, "CSA").includes("68.2 F"), "the posted reading must show on the CSA pane");
    const sensorBad = await req("/sensors/readings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: "NOPE", temperature_f: 70, humidity_pct: 40, read_at: new Date().toISOString() }),
    });
    assert(sensorBad.status === 400 && (await sensorBad.text()).includes("room"), "a bad reading must refuse in words");
    assert(!/\d,\d{3}\.\d{2}/.test(unloadedCsv.body), "unloaded queue csv must carry no comma-grouped weights");

    // THE HBN THAT CAME BACK (canon 0.30.84; owner report 2026-09-15: "they're
    // weighing an HBN from yesterday at PNS ... The issue started when they
    // unloaded the silo"): unloaded is a finished status, so the unloaded lot's
    // batch stays out of the wet weight pane. The 2026-08-28 spelling (drying,
    // in_transit, trimmed) let it back in and a satellite crew weighed into it.
    // Extra drying lot so the Inventory sheet walk has a drying circle. Uses the
    // still-open second HBN; the first lot stays unloaded. THE BLANK SLATE
    // (canon 0.30.108): the ARL HBN's lot weighs into PNN's Silo 2, since every
    // lot lands in PNN's barn and ARL's room is no landing space.
    const extraPane = await text("/station/wet_weight");
    assert(
      extraPane.body.includes(`?pick=${batchId}`),
      `a batch finished today stays on the wet pane after unload (${batchId})`
    );
    const extraPicks = [...extraPane.body.matchAll(/href="\/station\/wet_weight\?pick=([^"]+)"/g)].map((m) => m[1]);
    const extraBatchId = extraPicks.find((id) => id !== batchId);
    if (!extraBatchId) fail("extra drying", "missing the other open batch");
    const arlRoomId = drySpaceIdByName(lookupsPage.body, "Arlington Dry Room");
    const silo2Id = drySpaceIdByName(lookupsPage.body, "Silo 2");
    const extraStart = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        team_lead: "Smoke Lead",
        harvest_batch_id: extraBatchId,
        actual_dryspc: silo2Id,
        notes: "sheet drying",
      }),
    });
    if (extraStart.status !== 303) fail("extra start lot", `status ${extraStart.status}`);
    const extraLotId = new URL(extraStart.headers.get("location") || "", base).searchParams.get("lot");
    if (!extraLotId) fail("extra start lot", "no lot id");
    const extraWeight = await req(`/station/wet_weight/lot/${extraLotId}/weights`, {
      method: "POST",
      body: form({ weight_grams: "200.00" }),
    });
    if (extraWeight.status !== 303) fail("extra weight", `status ${extraWeight.status}`);
    // THE HBN THAT CAME BACK, his pick "HBN pencil on the lot" (canon 0.30.84):
    // the lot record's pencil offers an HBN select with the lot's batch selected
    // and the other open batch offered; the weighing lot moves to the unloaded
    // batch with a reason, weights and all, and that batch comes back into the
    // pane for the weighing lot's resume; a finished lot refuses to move; the lot
    // moves back; a batch finished today stays on the pane; the change log carries the
    // reason.
    const lotEditPage = await text(`/record/wet_weight_entries/${extraLotId}/edit`);
    if (lotEditPage.res.status !== 200) fail("GET lot edit page", `status ${lotEditPage.res.status}`);
    assert(lotEditPage.body.includes('<select name="harvest_batch_id">'), "the lot pencil must offer the HBN select");
    assert(
      lotEditPage.body.includes(`<option value="${extraBatchId}" selected>`),
      "the HBN select must preselect the lot's own batch"
    );
    assert(lotEditPage.body.includes(`<option value="${batchId}">`), "the HBN select must offer the other open batch");
    assert(lotEditPage.body.includes(`(${pickedHbn})`), "the HBN option must print the HBN in parentheses");
    const moveHbn = await req(`/record/wet_weight_entries/${extraLotId}/edit`, {
      method: "POST",
      body: form({ harvest_batch_id: batchId, reason: "smoke: weighed into the wrong HBN" }),
    });
    if (moveHbn.status !== 303) fail("lot HBN pencil", `status ${moveHbn.status}`);
    const movedPanel = await text(`/station/wet_weight?lot=${extraLotId}`);
    assert(movedPanel.body.includes(pickedHbn), "the moved lot must show its new HBN");
    assert(movedPanel.body.includes("<td>200</td>"), "the moved lot must keep its weights");
    const paneWithResume = await text("/station/wet_weight");
    assert(
      paneWithResume.body.includes(`?pick=${batchId}`),
      "a weighing lot brings its batch back into the pane for resume, finished lot beside it or not"
    );
    const finishedMove = await req(`/record/wet_weight_entries/${wetLotId}/edit`, {
      method: "POST",
      body: form({ harvest_batch_id: extraBatchId, reason: "smoke: a finished lot must not move" }),
    });
    assert(finishedMove.status === 400, `a finished lot's HBN pencil expected 400 got ${finishedMove.status}`);
    const moveBack = await req(`/record/wet_weight_entries/${extraLotId}/edit`, {
      method: "POST",
      body: form({ harvest_batch_id: extraBatchId, reason: "smoke: back to its own HBN" }),
    });
    if (moveBack.status !== 303) fail("lot HBN pencil back", `status ${moveBack.status}`);
    const paneAfterBack = await text("/station/wet_weight");
    assert(
      paneAfterBack.body.includes(`?pick=${batchId}`),
      "a batch finished today stays after its weighing lot moves off"
    );
    const logAfterMove = await text("/log");
    assert(logAfterMove.body.includes("smoke: weighed into the wrong HBN"), "the change log must carry the HBN move's reason");
    assert(logAfterMove.body.includes("<td>harvest_batch_id</td>"), "the change log must name the moved field");

    // THE PLANT COUNT (owner ruling 2026-09-14, canon 0.30.62): the lot panel asks
    // how many plants at Finish lot, with Skip; this lot answers 7 (a grouped
    // "1,200" style is accepted too), the picked batch's lots skipped above.
    const extraPanel = await text(`/station/wet_weight?lot=${extraLotId}`);
    assert(extraPanel.body.includes("data-plant-prompt-form"), "the wet lot panel must carry the plant count prompt");
    assert(extraPanel.body.includes('name="plant_prompt" value="skip"'), "the prompt must offer Skip");
    const badCount = await req(`/station/wet_weight/lot/${extraLotId}/finish`, {
      method: "POST",
      body: form({ plant_prompt: "count", plant_count: "12.5" }),
    });
    assert(badCount.status === 400, `a fractional plant count expected 400 got ${badCount.status}`);
    const extraFinish = await req(`/station/wet_weight/lot/${extraLotId}/finish`, {
      method: "POST",
      body: form({ plant_prompt: "count", plant_count: "7" }),
    });
    if (extraFinish.status !== 303) fail("extra finish", `status ${extraFinish.status}`);
    const extraCounted = await text(`/station/wet_weight?lot=${extraLotId}`);
    assert(extraCounted.body.includes("<dt>Plants</dt><dd data-plant-count>7</dd>"), "the finished lot must show its plant count");
    // The batch's METRC file: no tags, one counted lot of 200.00 g, so seven
    // rows, Plant blank, summing cent-exact to 200.00 with the seeded jitter.
    const countedCsv = await text(`/admin/uploads/wet_weights/${extraLotId}.csv`);
    assert(countedCsv.res.status === 200, `counted csv expected 200 got ${countedCsv.res.status}`);
    const countedLines = countedCsv.body.split("\r\n").filter((line) => line.length > 0);
    assert(countedLines.length === 8, `a 7-plant lot must write 7 rows, got ${countedLines.length - 1}`);
    let countedCents = 0;
    for (const line of countedLines.slice(1)) {
      const cells = line.split(",");
      assert(cells[0] === "", `Plant must stay blank on a count row, got ${cells[0]}`);
      assert(/^\d+\.\d{2}$/.test(cells[1]), `a count row weight must be raw 2-decimal, got ${cells[1]}`);
      countedCents += Math.round(Number(cells[1]) * 100);
    }
    assert(countedCents === 20000, `the seven rows must sum to 200.00, got ${countedCents / 100}`);
    const countedAgain = await text(`/admin/uploads/wet_weights/${extraLotId}.csv`);
    assert(countedAgain.body === countedCsv.body, "the count split must reproduce byte for byte");
    counts = await homeCounts();
    assert(counts.dry === 1, `dry after extra lot expected 1 got ${counts.dry}`);
    assert(counts.unloaded === 1, `unloaded must stay 1 got ${counts.unloaded}`);

    // PRODUCTION SCHEDULING (canon 0.30.97): an unloaded lot that nobody has
    // scheduled does not appear at Trim Packages Entry; the Data Queues stay
    // unfiltered. Scheduling the HBN is what exposes it to the trim pane.
    const trimBeforeSched = await text("/station/trim_packages");
    if (trimBeforeSched.res.status !== 200) fail("GET /station/trim_packages before schedule", `status ${trimBeforeSched.res.status}`);
    assert(trimBeforeSched.body.includes("No rows waiting."), "unscheduled trim pane must be empty");
    assert(
      !trimBeforeSched.body.includes(`href="/station/trim_packages?pick=${wetLotId}"`),
      "an unscheduled unloaded lot must not appear at Trim Packages Entry"
    );
    assert(
      queueSectionHtml(counts.body, "unloaded_queue").includes(wetLotId) ||
        queueSectionHtml(counts.body, "unloaded_queue").includes(shortId),
      "the Data Queues Unloaded Queue must still list the unscheduled lot"
    );
    const trimSchedOpen = await text("/production/scheduling/trim");
    if (trimSchedOpen.res.status !== 200) fail("GET /production/scheduling/trim", `status ${trimSchedOpen.res.status}`);
    assert(trimSchedOpen.body.includes("<h1>Trimming</h1>"), "Trimming station missing its heading");
    assert(trimSchedOpen.body.includes('class="station-triple"'), "Trimming must ride the three-pane layout");
    assert(trimSchedOpen.body.includes(`data-schedule-hbn="${batchId}"`), "Trimming available pane must list the unloaded HBN");
    // THE HBN ON THE SCHEDULING PANES (canon 0.30.102): the group heads with
    // the full HBN alone, never the farm / strain / date label.
    assert(
      trimSchedOpen.body.includes(`<span class="schedule-hbn-line">${pickedHbn} <span class="tile-count">`),
      `the available group must head with the HBN ${pickedHbn}`
    );
    assert(!/schedule-hbn-line">[A-Z]{3} \/ /.test(trimSchedOpen.body), "the available group must not head with Farm / Strain / Date");
    assert(
      /<details class="pane-group" data-schedule-hbn="[^"]+">/.test(trimSchedOpen.body),
      "the HBN list must be collapsed by default"
    );
    assert(trimSchedOpen.body.includes('title="Schedule trim"'), "the >> control must title Schedule trim");
    assert(trimSchedOpen.body.includes("&gt;&gt;"), "the include control must read as >>");
    assert(trimSchedOpen.body.includes('class="schedule-item-readonly"'), "opening the HBN must list its lots");
    assert(!/schedule-item-readonly"><a /.test(trimSchedOpen.body), "item rows must carry no links");
    assert((trimSchedOpen.body.match(/data-schedule-pane="available"[\s\S]*?- EMPTY -/)), "working and complete start empty");
    const schedToday = await req("/production/scheduling/trim/schedule", {
      method: "POST",
      body: form({ hbn_id: batchId }),
    });
    assert(schedToday.status === 303, `schedule trim expected 303 got ${schedToday.status}`);
    assert(
      (schedToday.headers.get("location") || "").includes("/production/scheduling/trim?ok=scheduled&n="),
      "schedule must flash ok=scheduled&n="
    );
    const nMatch = (schedToday.headers.get("location") || "").match(/n=(\d+)/);
    assert(nMatch && Number(nMatch[1]) >= 1, "scheduled n must be at least 1");
    const trimWorking = await text("/production/scheduling/trim?ok=scheduled&n=" + nMatch[1]);
    assert(trimWorking.body.includes("In queue"), "a scheduled trim item must read In queue");
    const consoleScheduled = await text("/harvest");
    const cureOfSched = (html, name) => {
      const at = html.indexOf(`data-cure-pane="${name}"`);
      if (at < 0) return "";
      const rest = html.slice(at);
      const next = rest.indexOf('data-cure-pane="', 20);
      return next < 0 ? rest : rest.slice(0, next);
    };
    assert(cureOfSched(consoleScheduled.body, "CSB").includes(`data-cure-lot="${wetLotId}"`), "scheduling trim must move the lot to CSB");
    assert(!cureOfSched(consoleScheduled.body, "CSA").includes(`data-cure-lot="${wetLotId}"`), "CSA must empty once the lot is scheduled for trim");
    assert(
      trimWorking.body.includes(`<h3 class="schedule-hbn-label">${pickedHbn}</h3>`),
      `the working group must head with the HBN ${pickedHbn}`
    );
    const availAfterSched = (trimWorking.body.match(/data-schedule-pane="available"[\s\S]*?(?=data-schedule-pane="working")/) || [])[0] || "";
    assert(
      availAfterSched.includes('tile-count">0<') && !availAfterSched.includes(`data-schedule-hbn="${batchId}"`),
      "available pane must drop the HBN once scheduled"
    );
    const trimPaneNow = await text("/station/trim_packages");
    assert(
      trimPaneNow.body.includes(`href="/station/trim_packages?pick=${wetLotId}"`),
      "after scheduling, Trim Packages Entry must list the lot"
    );
    const secondSched = await req("/production/scheduling/trim/schedule", {
      method: "POST",
      body: form({ hbn_id: batchId }),
    });
    assert(secondSched.status === 400, `a second >> on the same HBN expected 400 got ${secondSched.status}`);
    assert((await secondSched.text()).includes("Nothing available to schedule on this HBN."), "the second >> must refuse in words");
    const schedRowId = (trimWorking.body.match(/action="\/production\/scheduling\/trim\/unschedule\/([^"]+)"/) || [])[1];
    assert(schedRowId, "working pane missing an unschedule action");
    const unscheduled = await req(`/production/scheduling/trim/unschedule/${schedRowId}`, { method: "POST", body: form({}) });
    assert(unscheduled.status === 303, `unschedule expected 303 got ${unscheduled.status}`);
    assert((unscheduled.headers.get("location") || "").includes("ok=unscheduled"), "unschedule must flash ok=unscheduled");
    const backAvailable = await text("/production/scheduling/trim");
    assert(new RegExp(`data-schedule-pane="available"[\\s\\S]*data-schedule-hbn="${batchId}"`).test(backAvailable.body), "unschedule must return the HBN to available");
    // THE FARM DAY BEGINS AT SIX (canon 0.30.151): yesterday is the farm day before the farm's today.
    const schedYesterdayDay = dayBeforeSmoke(farmDaySmoke(new Date().toISOString()));
    const backdated = await req("/production/scheduling/trim/schedule", {
      method: "POST",
      body: form({ hbn_id: batchId, effective_date: schedYesterdayDay, effective_pin: ADMIN_PIN }),
    });
    assert(backdated.status === 303, `backdated schedule expected 303 got ${backdated.status}`);
    const afterBackdate = await text("/production/scheduling/trim");
    const backdateLog = await text("/log");
    assert(backdateLog.body.includes("effective date set under the Admin PIN"), "a backdated >> must leave the effective_date change-log marker");
    assert(backdateLog.body.includes(schedYesterdayDay), "the change log must carry the backdated effective date");
    const workingId = (afterBackdate.body.match(/action="\/production\/scheduling\/trim\/complete\/([^"]+)"/) || [])[1];
    assert(workingId, "working pane missing a complete action after the backdated schedule");
    const schedCompleted = await req(`/production/scheduling/trim/complete/${workingId}`, { method: "POST", body: form({}) });
    assert(schedCompleted.status === 303, `manual complete expected 303 got ${schedCompleted.status}`);
    const rightPane = await text("/production/scheduling/trim");
    assert(rightPane.body.includes(`data-schedule-id="${workingId}"`), "complete must move the item to the right pane");
    assert(rightPane.body.includes('data-local>'), "the right pane must carry the completion instant");
    assert(rightPane.body.includes('name="unfinish_pin"'), "the right pane unfinish must carry a PIN box");
    const demoteNoPin = await req(`/production/scheduling/trim/unfinish/${workingId}`, { method: "POST", body: form({}) });
    assert(demoteNoPin.status === 403, `unfinish without the PIN expected 403 got ${demoteNoPin.status}`);
    assert((await demoteNoPin.text()).includes("Unfinishing a completed item needs the Admin PIN."), "unfinish without the PIN must refuse in words");
    const demoteModels = await req(`/production/scheduling/trim/unfinish/${workingId}`, {
      method: "POST",
      body: form({ unfinish_pin: MODELS_PIN }),
    });
    assert(demoteModels.status === 403, `unfinish with the Models PIN expected 403 got ${demoteModels.status}`);
    const demoteOk = await req(`/production/scheduling/trim/unfinish/${workingId}`, {
      method: "POST",
      body: form({ unfinish_pin: ADMIN_PIN }),
    });
    assert(demoteOk.status === 303, `unfinish with the Admin PIN expected 303 got ${demoteOk.status}`);
    const demotedPage = await text("/production/scheduling/trim");
    assert(demotedPage.body.includes("In queue"), "unfinish must return the item to scheduled");
    const toEsSched = await req("/locale", { method: "POST", body: form({ locale: "es" }) });
    assert(toEsSched.status === 303, `POST /locale es (scheduling) expected 303 got ${toEsSched.status}`);
    const landingEs = await text("/production/scheduling");
    assert(landingEs.body.includes("Programacion de produccion"), "Spanish must speak on the scheduling landing");
    assert(landingEs.body.includes("Recorte") && landingEs.body.includes("Pasteurizacion"), "Spanish must title the two tiles");
    const trimEs = await text("/production/scheduling/trim");
    assert(trimEs.body.includes("<h1>Recorte</h1>"), "Spanish must speak on the Trimming station");
    const toEnSched = await req("/locale", { method: "POST", body: form({ locale: "en" }) });
    assert(toEnSched.status === 303, `POST /locale en (scheduling) expected 303 got ${toEnSched.status}`);

    // Trim picks from the Unloaded Queue through its pane now (owner ruling
    // 2026-08-31: the two-pane theme is the station law for everything). No
    // dropdown renders; the pick rides the pane URL and lands as a hidden input.
    const trimPane = await text("/station/trim_packages");
    if (trimPane.res.status !== 200) fail("GET /station/trim_packages", `status ${trimPane.res.status}`);
    assert(trimPane.body.includes("Pick from the left to begin."), "trim landing missing the pane prompt");
    assert(
      !trimPane.body.includes('<select name="wet_weight_entry_id"'),
      "trim must carry no lot dropdown under the pane law"
    );
    const trimPick = trimPane.body.match(/href="\/station\/trim_packages\?pick=([^"]+)"/);
    if (!trimPick) fail("trim pane", "missing the pick link");
    const lotId = trimPick[1];
    assert(lotId === wetLotId, `trim must offer the unloaded lot, got ${lotId}`);
    const trimPicked = await text(`/station/trim_packages?pick=${lotId}`);
    if (trimPicked.res.status !== 200) fail("GET trim pick page", `status ${trimPicked.res.status}`);
    // Owner ruling 2026-09-08 (canon 0.30.9, his picture "[Last 6 of Tag
    // Number]/26001/TEST MOOKY/250,000(drop the decimals)"): from Trim forward
    // the lot reads last-6-of-tag / serial / market strain / whole grams; this
    // batch typed no market strain, so it inherited Fruity Pebbles.
    assert(
      new RegExp(`<h2 class="working-pick">(?:[A-Za-z0-9]{1,6} / )?${shortId} / Fruity Pebbles / 752</h2>`).test(trimPicked.body),
      "trim picked heading must read tag tail / serial / market strain / whole grams"
    );
    assert(!trimPicked.body.includes("/ 751.00</h2>"), "the Trim-forward label must drop the decimals");
    assert(
      new RegExp(`<a class="queue-pane-item selected" href="/station/trim_packages\\?pick=${lotId}">(?:[A-Za-z0-9]{1,6} / )?${shortId} / Fruity Pebbles / 752</a>`).test(trimPicked.body),
      "the Unloaded Queue pane row must read the Trim-forward label"
    );
    // Canon 0.30.9 (R7): the date and the operator ride the form. THE EFFECTIVE
    // DATE PER STATION (canon 0.30.94): the date is the Effective Date component
    // (posts effective_date, PIN beside it, client-defaulted to today).
    assert(trimPicked.body.includes('<details class="effective-date" data-effective-date>'), "trim form missing the Effective Date field");
    assert(/<input type="date" name="effective_date" data-effective-input data-effective-default="" data-effective-auto>/.test(trimPicked.body), "trim Effective Date must be client-defaulted");
    assert(trimPicked.body.includes('name="effective_pin"'), "trim form missing the Admin PIN box");
    assert(trimPicked.body.includes('name="trim_operator"'), "trim form missing the operator");
    assert(trimPicked.body.includes("No packages entered yet."), "an untouched lot must say no packages entered yet");
    const hiddenLot = firstInputValue(trimPicked.body, "wet_weight_entry_id");
    assert(hiddenLot === wetLotId, `hidden lot id expected ${wetLotId} got ${hiddenLot}`);
    // Balance displays (owner ruling 2026-08-31): the trim picked view carries
    // Original (dry) / Recorded / Remaining above the packages form; nothing
    // recorded yet, so Remaining still equals the 751.00 dry total.
    assert(
      trimPicked.body.includes("<dt>Original (dry)</dt><dd>752 g</dd>"),
      "trim picked view missing Original (dry) at 752 g"
    );
    assert(
      trimPicked.body.includes("<dt>Recorded</dt><dd>0 g</dd>"),
      "trim picked view must show Recorded 0 g before any packages"
    );
    assert(
      trimPicked.body.includes("<dt>Remaining</dt><dd>752 g</dd>"),
      "trim picked view must show Remaining 752 g before any packages"
    );
    // Canon 0.30.26 (THE LEDGER FOLLOWS THE TRIM): snapshot the ledger's WIP
    // grams before the cut; the cut moves grams, it never creates or loses them.
    const wipGramsOf = (csv) =>
      csv
        .split(/\r?\n/)
        .filter((line) => /,WIP,/.test(line))
        .reduce((n, line) => n + Number(line.split(",")[4] || 0), 0);
    const ledgerBeforeTrim = wipGramsOf((await text("/reports/inventory_by_location?format=csv")).body);
    const trim = await req("/station/trim_packages", {
      method: "POST",
      body: form({
        wet_weight_entry_id: lotId,
        package_code: ["BUD-SMOKE-1", "TRIM-SMOKE-1"],
        package_type_code: ["BUD", "TRIM"],
        effective_date: "2026-09-08", effective_pin: ADMIN_PIN,
        trim_operator: "Les",
        weight_grams: ["100.00", "20.50"],
      }),
    });
    if (trim.status !== 303) fail("trim packages", `status ${trim.status}`);
    const ledgerAfterTrim = await text("/inventory");
    assert(/BUD-SMOKE-1<\/td>[\s\S]{0,600}?100 g/.test(ledgerAfterTrim.body), "the BUD trim package must mint its own ledger row at 100 g");
    assert(/TRIM-SMOKE-1<\/td>[\s\S]{0,600}?21 g/.test(ledgerAfterTrim.body), "the TRIM trim package must mint its own ledger row at 21 g");
    const ledgerAfterTrimGrams = wipGramsOf((await text("/reports/inventory_by_location?format=csv")).body);
    assert(
      Math.abs(ledgerAfterTrimGrams - ledgerBeforeTrim) < 0.005,
      `the trim must move grams, not make them: WIP ${ledgerBeforeTrim} before, ${ledgerAfterTrimGrams} after`
    );
    // Canon 0.30.9 (R7): no operator, no package.
    const noOperator = await req("/station/trim_packages", {
      method: "POST",
      body: form({
        wet_weight_entry_id: lotId,
        package_code: ["NOOP-1"],
        package_type_code: ["TRIM"],
        effective_date: "2026-09-08", effective_pin: ADMIN_PIN,
        weight_grams: ["1.00"],
      }),
    });
    assert(noOperator.status === 400, `a trim entry without the operator expected 400 got ${noOperator.status}`);
    // Canon 0.30.21 (his words: "The operator dropdowns don't need to have the
    // maintenance crew on every single one, that was just for the PM portion"):
    // the trim operator is a typed field again; the sign-off names stay in
    // Admin for the PM system.
    assert(/<input type="text" name="trim_operator"[^>]*required/.test(trimPicked.body), "the trim operator must be a typed field");
    assert(!trimPicked.body.includes('<select name="trim_operator"'), "the trim operator must not be a select of the maintenance crew");
    const signOffAdmin = await text("/admin/lookups/sign_off_names");
    assert(signOffAdmin.res.status === 200, `sign-off names lookup expected 200 got ${signOffAdmin.res.status}`);
    assert(signOffAdmin.body.includes("Kieth") && signOffAdmin.body.includes("Les") && signOffAdmin.body.includes("Austin"), "Admin lookups must list the three sign-off names");
    const signOffLanding = await text("/admin/lookups");
    assert(signOffLanding.body.includes('href="/admin/lookups/sign_off_names"'), "the lookups landing must carry Sign-off names");

    // Balance displays (owner ruling 2026-08-31): the recorded packages
    // (100.00 + 20.50) pull Remaining down to 630.50 on a re-pick.
    const trimAfter = await text(`/station/trim_packages?pick=${lotId}`);
    assert(
      trimAfter.body.includes("<dt>Recorded</dt><dd>121 g</dd>"),
      "trim picked view must show Recorded 121 g after the packages"
    );
    assert(
      trimAfter.body.includes("<dt>Remaining</dt><dd>631 g</dd>"),
      "trim picked view must show Remaining 631 g after the packages"
    );
    // Canon 0.30.9 (R5, his words: "show the entered packages below the
    // working pane, ordered by latest to oldest, pencil and "x" PIN gated").
    assert(trimAfter.body.includes("data-trim-entered"), "the trim pick must list the entered packages");
    assert(trimAfter.body.indexOf('id="pkg-rows"') < trimAfter.body.indexOf("data-trim-entered"), "the entered list must sit beneath the form");
    // THE TAG LAW (canon 0.30.38, fork F5): a code that is not a METRC tag is
    // kept as typed and marked with the shape note, never refused.
    assert(trimAfter.body.includes('<td>BUD-SMOKE-1 <span class="muted tag-shape-note"') && trimAfter.body.includes('<td>TRIM-SMOKE-1 <span class="muted tag-shape-note"'), "the entered list must carry both packages, marked as non-tag codes");
    assert((trimAfter.body.match(/data-tag-shape="off"/g) || []).length === 2, "both smoke codes must carry the off-shape mark");
    assert(trimAfter.body.includes("<td>Les</td>") && trimAfter.body.includes("<td>2026-09-08</td>"), "the entered list must carry the operator and the date (R7)");
    const enteredIds = [...trimAfter.body.matchAll(/data-package="([a-f0-9-]{36})"/g)].map((m) => m[1]);
    assert(enteredIds.length === 2, `the entered list expected 2 rows got ${enteredIds.length}`);
    assert(trimAfter.body.includes(`href="/record/wip_packages/${enteredIds[0]}/edit"`), "entered rows must carry the pencil");
    assert(trimAfter.body.includes(`href="/record/wip_packages/${enteredIds[0]}/void"`), "entered rows must carry the x");
    // CRYO ONLY (canon 0.30.114; owner: "The go/no-go package dupe check needs to
    // be removed from Trim, that's a cryo phenomenon.  A package is Id'd by its
    // HBN until the cryo step."): the trim line carries no duplicate-tag guard
    // and its rows no data-entered-tag.
    assert(!trimAfter.body.includes("data-dup-tag-warning") && !trimAfter.body.includes("data-entered-tag"), "the trim line must carry no duplicate-tag guard");
    // The pencil and the x sit behind the PIN: without the cookie, the PIN page.
    const savedPin = jar.get("gf_pin");
    jar.delete("gf_pin");
    const gatedPencil = await text(`/record/wip_packages/${enteredIds[0]}/edit`);
    assert(gatedPencil.res.status === 401 && gatedPencil.body.includes("Enter PIN"), "the trim package pencil must sit behind the PIN");
    const gatedX = await text(`/record/wip_packages/${enteredIds[0]}/void`);
    assert(gatedX.res.status === 401, "the trim package x must sit behind the PIN");
    jar.set("gf_pin", savedPin);
    const openPencil = await text(`/record/wip_packages/${enteredIds[0]}/edit`);
    assert(openPencil.res.status === 200, `with the PIN the pencil opens, got ${openPencil.res.status}`);
    // Canon 0.30.21: the pencil carries the saved operator as a typed value.
    assert(/name="trim_operator"[^>]*value="Les"/.test(openPencil.body) && !openPencil.body.includes('<select name="trim_operator"'), "the record edit must carry the saved operator as a typed value");
    // A second entry lands above the first (newest first).
    const plusTrim = await req("/station/trim_packages", {
      method: "POST",
      body: form({
        wet_weight_entry_id: lotId,
        package_code: ["PLUS-SMOKE-1"],
        package_type_code: ["TRIM"],
        effective_date: "2026-09-08", effective_pin: ADMIN_PIN,
        trim_operator: "Les",
        weight_grams: ["0.50"],
        plus_one: "1",
      }),
    });
    assert(plusTrim.status === 303, `plus trim expected 303 got ${plusTrim.status}`);
    const enteredOrder = await text(`/station/trim_packages?pick=${lotId}`);
    assert(enteredOrder.body.indexOf("<td>PLUS-SMOKE-1 <span") < enteredOrder.body.indexOf("<td>BUD-SMOKE-1 <span"), "the entered list must run newest first");
    const voidPlus = await req(`/record/wip_packages/${[...enteredOrder.body.matchAll(/data-package="([a-f0-9-]{36})"/g)].map((m) => m[1])[0]}/void`, {
      method: "POST",
      body: form({ reason: "smoke: undo the plus row" }),
    });
    assert(voidPlus.status === 303, `void of the plus row expected 303 got ${voidPlus.status}`);
    // Canon 0.30.26: the x on a trim package voids its ledger row and returns
    // the grams to the lot's package; the WIP total is what it was after the cut.
    const ledgerAfterVoid = await text("/inventory");
    assert(!ledgerAfterVoid.body.includes("<td>PLUS-SMOKE-1</td>"), "a voided trim package must leave the ledger");
    const ledgerAfterVoidGrams = wipGramsOf((await text("/reports/inventory_by_location?format=csv")).body);
    assert(
      Math.abs(ledgerAfterVoidGrams - ledgerAfterTrimGrams) < 0.005,
      `the void must hand the grams back: WIP ${ledgerAfterTrimGrams} after the cut, ${ledgerAfterVoidGrams} after the void`
    );

    // THE TRIM WEIGHS FEED (canon 0.30.137; Corey's agent through the owner: "A
    // machine route for the station data behind /station/trim_packages: the JSON
    // the page reads (per package: tag, stream, weight in grams, timestamp,
    // operator) ... The poller reads every few minutes, stores each weigh by its
    // row id"). The three trim packages just entered ride the feed keyed by id,
    // the voided plus row with its voided_at; live=1 leaves it out; since= by
    // the change instant narrows to the void; the limit cuts with more=true and
    // a next_since; a bad since or limit answers 400 in words as JSON.
    const feedAll = await req("/feeds/trim-weighs.json");
    assert(feedAll.status === 200, `the trim weighs feed expected 200 got ${feedAll.status}`);
    assert((feedAll.headers.get("content-type") || "").includes("application/json"), "the feed must answer JSON");
    assert((feedAll.headers.get("cache-control") || "") === "no-store", "the feed must answer no-store");
    const feedJson = await feedAll.json();
    assert(feedJson.feed === "trim_weighs" && Array.isArray(feedJson.rows) && feedJson.count === feedJson.rows.length, "the feed must name itself and count its rows");
    const feedBud = feedJson.rows.find((r) => r.package_code === "BUD-SMOKE-1");
    const feedTrim = feedJson.rows.find((r) => r.package_code === "TRIM-SMOKE-1");
    const feedPlus = feedJson.rows.find((r) => r.package_code === "PLUS-SMOKE-1");
    assert(feedBud && feedTrim && feedPlus, `the feed must carry the three trim packages, got ${feedJson.rows.map((r) => r.package_code).join(",")}`);
    assert(enteredIds.includes(feedBud.id) && enteredIds.includes(feedTrim.id), "the feed's ids must be the station's row ids");
    assert(feedBud.stream === "BUD" && feedBud.weight_grams === 100 && feedBud.operator === "Les" && feedBud.trim_date === "2026-09-08", `the BUD weigh must read its stream, grams, operator and date, got ${JSON.stringify(feedBud)}`);
    assert(feedTrim.stream === "TRIM" && feedTrim.weight_grams === 21 && feedTrim.metrc_tag === null, "the TRIM weigh must read 21 g with no METRC tag (an internal code)");
    // The lot is the ARL HBN's (its farm rides as the HBN's farm, the origin, not the landing site).
    assert(feedBud.lot && feedBud.lot.id === lotId && feedBud.lot.short_id === shortId && feedBud.lot.strain === "Fruity Pebbles" && feedBud.lot.farm === "ARL", `the weigh must name its lot, got ${JSON.stringify(feedBud.lot)}`);
    // THE FEED NAMES THE REAL STRAIN (canon 0.30.149): the market label rides beside the strain, the strain's own name when none was typed.
    assert(feedBud.lot.market_strain === "Fruity Pebbles", `the lot must carry its market label beside the strain, got ${JSON.stringify(feedBud.lot.market_strain)}`);
    assert(feedBud.voided_at === null && typeof feedBud.created_at === "string" && feedBud.changed_at === feedBud.updated_at, "a live weigh carries no voided_at and changes at its last edit");
    assert(typeof feedPlus.voided_at === "string" && feedPlus.changed_at === feedPlus.voided_at, "the voided plus row must carry its voided_at as its change instant");
    assert(feedJson.next_since === feedJson.rows[feedJson.rows.length - 1].changed_at && feedJson.more === false, "next_since must be the last change instant with more false under the limit");
    const feedLive = await (await req("/feeds/trim-weighs.json?live=1")).json();
    assert(!feedLive.rows.some((r) => r.package_code === "PLUS-SMOKE-1") && feedLive.rows.some((r) => r.package_code === "BUD-SMOKE-1"), "live=1 must leave the voided row out and keep the live ones");
    const feedSince = await (await req(`/feeds/trim-weighs.json?since=${encodeURIComponent(feedBud.changed_at)}`)).json();
    assert(feedSince.rows.some((r) => r.package_code === "PLUS-SMOKE-1") && !feedSince.rows.some((r) => r.id === feedBud.id), "since= must return the rows changed after it and not the row at it");
    // THE TIE-COMPLETE PAGE (canon 0.30.149): the three smoke packages were cut in one entry and share
    // one change instant (the voided plus row moved to its void), so limit=1 keeps the first row and
    // every row of its instant rides along; the page never ends inside a tie, more stays true, and
    // the next page from next_since carries no row of that instant.
    const feedOne = await (await req("/feeds/trim-weighs.json?limit=1")).json();
    assert(feedOne.count >= 1 && feedOne.more === true, `limit=1 must answer at least one row with more=true, got ${feedOne.count} ${feedOne.more}`);
    assert(feedOne.rows.every((r) => r.changed_at === feedOne.rows[0].changed_at), "a limit=1 page must hold one change instant alone");
    assert(feedOne.next_since === feedOne.rows[feedOne.rows.length - 1].changed_at, "next_since must be the page's instant");
    const feedOneAll = feedJson.rows.filter((r) => r.changed_at === feedOne.rows[0].changed_at);
    assert(feedOne.count === feedOneAll.length, `the page must carry every row of its instant (${feedOneAll.length}), got ${feedOne.count}`);
    const feedOneNext = await (await req(`/feeds/trim-weighs.json?limit=1&since=${encodeURIComponent(feedOne.next_since)}`)).json();
    assert(!feedOneNext.rows.some((r) => r.changed_at === feedOne.next_since), "the next page must carry no row of the instant already sent");
    assert(feedOne.count + feedOneNext.count <= feedJson.count && feedOneNext.count >= 1, "the pages must walk the feed without loss or repeat");
    const feedBadSince = await req("/feeds/trim-weighs.json?since=yesterday");
    assert(feedBadSince.status === 400 && (await feedBadSince.json()).error.startsWith("since must be an ISO instant"), "a bad since must answer 400 in words as JSON");
    const feedBadLimit = await req("/feeds/trim-weighs.json?limit=0");
    assert(feedBadLimit.status === 400 && (await feedBadLimit.json()).error.startsWith("limit must be a whole number"), "a bad limit must answer 400 in words as JSON");
    // THE FEED READS THE HBN (canon 0.30.141; owner: "the feed doesn't carry it
    // but the data hides it in the HBN"): each weigh also carries its UTC weigh
    // instant, the station, the site and dry method read off the HBN, the
    // facility line and the HBN's parts; ?site= filters by the same reading.
    assert(feedBud.weighed_at === feedBud.created_at && feedBud.weighed_at.endsWith("Z"), "weighed_at must be the row's UTC creation instant");
    assert(feedBud.station === "trim_packages", `station must name the trim packages station, got ${feedBud.station}`);
    assert(feedBud.stream_label === "BUD", `the stream label must ride beside the code, got ${feedBud.stream_label}`);
    const hbnParts = feedBud.lot.hbn_parts;
    assert(hbnParts && hbnParts.farm === "ARL" && hbnParts.serial === shortId && typeof hbnParts.harvest_day === "string", `the HBN must read back with its farm and serial, got ${JSON.stringify(hbnParts)}`);
    assert(feedBud.site === "ARL", `the site must be the HBN's farm, got ${feedBud.site}`);
    assert(feedBud.dry_method === (hbnParts.silo ? "silo" : "hang"), `the dry method must follow the HBN dry space segment, got ${feedBud.dry_method} for ${JSON.stringify(hbnParts.silo)}`);
    assert(typeof feedBud.license === "string" && /^(AU|GR)-/.test(feedBud.license), `the facility line must be a license, got ${feedBud.license}`);
    assert("metrc_harvest_tag" in feedBud.lot, "the lot must carry its METRC harvest tag field");
    const feedArl = await (await req("/feeds/trim-weighs.json?site=arl")).json();
    assert(feedArl.site === "ARL" && feedArl.rows.some((r) => r.id === feedBud.id) && feedArl.rows.every((r) => r.site === "ARL"), "site=arl must echo ARL and return the ARL weighs alone");
    const feedElse = await (await req("/feeds/trim-weighs.json?site=PNS")).json();
    assert(feedElse.rows.every((r) => r.site === "PNS") && !feedElse.rows.some((r) => r.id === feedBud.id), "site=PNS must leave the ARL weighs out");
    const feedBadSite = await req("/feeds/trim-weighs.json?site=Penn%20North");
    assert(feedBadSite.status === 400 && (await feedBadSite.json()).error.startsWith("site must be a farm code"), "a bad site must answer 400 in words as JSON");

    counts = await homeCounts();
    assert(counts.cryo === 1, `cryo after trim expected 1 (BUD only) got ${counts.cryo}`);
    assert(counts.testing === 0, `testing after trim expected 0 got ${counts.testing}`);
    assert(counts.unloaded === 1, `lot stays until marked trimmed, unloaded=${counts.unloaded}`);
    assert(
      queueSectionHtml(counts.body, "cryo_queue").includes(shortId),
      "cryo queue row must carry the short id"
    );
    assert(
      queueSectionHtml(counts.body, "cryo_queue").includes("Fruity Pebbles"),
      "cryo queue row must carry the strain"
    );

    // THE CRYO RUN (canon 0.30.110; owner, verbatim: "For cryo, replicate the
    // trim line surface in cryo production reporting.  Also, in production
    // scheduling for pasteurization collapse the lines to their HBN, do not
    // expose individual containers on the scheduled surface or on the input
    // list in the production reporting node."). Nothing scheduled: the Cryo
    // Weight Entry pane lists no run and points at the Pasteurization station;
    // the Data Queues Cryo Queue keeps the container as the record.
    const schedPaneOf = (body, name) => {
      const at = body.indexOf(`data-schedule-pane="${name}"`);
      if (at === -1) return "";
      const rest = body.slice(at + 22);
      const next = rest.search(/data-schedule-pane="/);
      return next === -1 ? rest : rest.slice(0, next);
    };
    const cryoBeforeSched = await text("/station/cryo_weight");
    assert(cryoBeforeSched.res.status === 200, `GET /station/cryo_weight expected 200 got ${cryoBeforeSched.res.status}`);
    assert(cryoBeforeSched.body.includes("No runs scheduled.") && cryoBeforeSched.body.includes('href="/production/scheduling/cryo"'), "an unscheduled cryo pane must point at the Pasteurization station");
    assert(!cryoBeforeSched.body.includes('name="package_id"') && !cryoBeforeSched.body.includes("BUD-SMOKE-1"), "the reporting node's input list must expose no container");
    assert(
      queueSectionHtml(counts.body, "cryo_queue").includes("BUD-SMOKE-1"),
      "the Data Queues Cryo Queue must still list the unscheduled container as the record"
    );
    // The Pasteurization station collapses Available to the HBN: the pool, no container.
    const cryoSchedOpen = await text("/production/scheduling/cryo");
    assert(cryoSchedOpen.body.includes("<h1>Pasteurization</h1>"), "Pasteurization station missing its heading");
    assert(cryoSchedOpen.body.includes('title="Schedule pasteurization"'), "the >> control must title Schedule pasteurization");
    const cryoAvail = schedPaneOf(cryoSchedOpen.body, "available");
    assert(cryoAvail.includes(pickedHbn) && cryoAvail.includes("1 container / 100 g in"), `Available must read the HBN's pool collapsed, got\n${cryoAvail.slice(0, 600)}`);
    assert(!cryoAvail.includes("BUD-SMOKE-1"), "Available must expose no container");
    const cryoSched = await req("/production/scheduling/cryo/schedule", {
      method: "POST",
      body: form({ hbn_id: batchId }),
    });
    assert(cryoSched.status === 303, `schedule cryo expected 303 got ${cryoSched.status}`);
    assert((cryoSched.headers.get("location") || "").includes("ok=scheduled&n=1"), "the cryo >> must flash ok=scheduled&n=1 (one container taken in)");
    const afterCryoPane = await text("/harvest");
    assert(!afterCryoPane.body.slice(afterCryoPane.body.indexOf('data-cure-pane="CSB"')).includes(`data-cure-lot="${wetLotId}"`), "a container taken into a cryo run must empty the lot from CSB");
    const cryoWorking = await text("/production/scheduling/cryo");
    const cryoWorkPane = schedPaneOf(cryoWorking.body, "working");
    assert(cryoWorkPane.includes("Pasteurizing") && cryoWorkPane.includes("1 container / 100 g in"), "the scheduled run must read Pasteurizing with its pool");
    assert(!cryoWorkPane.includes("BUD-SMOKE-1"), "the scheduled surface must expose no container");
    const runId = (cryoWorkPane.match(/data-schedule-id="([^"]+)"/) || [])[1];
    assert(runId, "the working pane must carry the run's id");
    const cryoSecond = await req("/production/scheduling/cryo/schedule", {
      method: "POST",
      body: form({ hbn_id: batchId }),
    });
    assert(cryoSecond.status === 400, `a second cryo >> with nothing free expected 400 got ${cryoSecond.status}`);

    // The reporting node lists the run by HBN; the picked run shows the pool (in
    // by type, out by category, the totals and the Remaining at the top), the
    // Effective Date, the operator and the trim-style line. THE CRYO CATEGORIES
    // (canon 0.30.112): the line's category box lists WPR, BUD, SHA from
    // app_config (migration 0059), blank until picked.
    const cryoPage = await text("/station/cryo_weight");
    assert(cryoPage.body.includes(`data-cryo-run="${runId}"`) && cryoPage.body.includes(`<strong>${pickedHbn}</strong>`), "the cryo pane must list the run by its HBN");
    assert(!cryoPage.body.includes("BUD-SMOKE-1"), "the cryo pane must expose no container");
    const cryoPicked = await text(`/station/cryo_weight?pick=${runId}`);
    if (cryoPicked.res.status !== 200) fail("GET cryo pick page", `status ${cryoPicked.res.status}`);
    assert(cryoPicked.body.includes('data-pool-total-in="100" data-pool-total-out="0" data-pool-total-remaining="100"'), "the pool must read 100 g in, 0 out, 100 remaining");
    // THE POOL BY CATEGORY (canon 0.30.121): one row per category with In, Out
    // and Remaining; the Total row closes the table; the row's remaining feeds
    // the plus guard for its own category.
    assert(cryoPicked.body.includes('<tr data-pool-category="BUD" data-pool-types="BUD" data-pool-in="100" data-pool-out="0" data-pool-remaining="100">'), "the pool must read BUD 100 g in, 0 out, 100 remaining on its own row");
    assert(cryoPicked.body.includes("<th>Category</th><th>In (g)</th><th>Out (g)</th><th>Remaining (g)</th>"), "the pool table must head Category, In, Out, Remaining");
    assert(cryoPicked.body.includes('<tr><th>Total</th><th>100</th><th>0</th><th data-pool-remaining-cell>100</th></tr>'), "the Total row must close the table");
    assert(cryoPicked.body.includes(`document.querySelector('[data-pool-category="' + category + '"]')`) && cryoPicked.body.includes("This weight over issues the pool for its category. Record it anyway?"), "the plus guard must read the picked category's remaining");
    assert(!cryoPicked.body.includes("BUD-SMOKE-1"), "the picked run must expose no container");
    assert(cryoPicked.body.includes("data-cryo-finish-blocked"), "Finish run must wait for a package");
    assert(cryoPicked.body.includes('<details class="effective-date" data-effective-date>'), "cryo form missing the Effective Date field");
    assert(/<input type="date" name="effective_date" data-effective-input data-effective-default="" data-effective-auto>/.test(cryoPicked.body), "cryo Effective Date must be client-defaulted");
    assert(cryoPicked.body.includes('name="effective_pin"'), "cryo form missing the Admin PIN box");
    assert(cryoPicked.body.includes('name="cryo_operator"'), "cryo form missing the operator");
    assert(
      cryoPicked.body.includes('<select name="package_type_code" id="cryo-plus-type" required data-cryo-category><option value=""></option><option value="WPR">WPR</option><option value="BUD">BUD</option><option value="SHA">SHA</option></select>'),
      "the line's category box must list WPR, BUD, SHA in his order, blank first"
    );
    // THE DUPLICATE TAG (canon 0.30.112): the warning line rides the page in the
    // pill's language, hidden until a scanned tag matches an entered row.
    assert(cryoPicked.body.includes('<p class="banner err" id="dup-tag-warning" role="alert" hidden data-dup-tag-warning>That tag is already entered beneath. Scan a different package.</p>'), "the cryo line must carry the duplicate-tag warning");
    assert(cryoPicked.body.includes('document.querySelectorAll("[data-entered-tag]")') && cryoPicked.body.includes("if (check()) { e.preventDefault(); input.focus(); input.select(); }"), "the duplicate-tag guard must block the plus");
    const esCryoOn = await req("/locale", { method: "POST", body: form({ locale: "es" }) });
    await esCryoOn.text();
    const cryoPickedEs = await text(`/station/cryo_weight?pick=${runId}`);
    assert(cryoPickedEs.body.includes("data-dup-tag-warning>Esa etiqueta ya esta ingresada abajo. Escanee otro paquete.</p>"), "the duplicate-tag warning must speak the pill's Spanish");
    assert(cryoPickedEs.body.includes("<th>Categoria</th><th>Entrada (g)</th><th>Salida (g)</th><th>Restante (g)</th>"), "the Spanish pool header");
    const enCryoBack = await req("/locale", { method: "POST", body: form({ locale: "en" }) });
    await enCryoBack.text();
    const CRYO_TAG = "1A4050300000000000000C01";
    const cryoLine = (over) => form({ package_code: CRYO_TAG.toLowerCase(), package_type_code: "BUD", weight_grams: "88.25", cryo_operator: "Austin", effective_date: "2026-09-08", effective_pin: ADMIN_PIN, ...over });
    const cryoNoPin = await req(`/station/cryo_weight/run/${runId}/add`, { method: "POST", body: cryoLine({ effective_pin: "" }) });
    assert(cryoNoPin.status === 403, `a cryo backdate without the PIN expected 403 got ${cryoNoPin.status}`);
    assert((await cryoNoPin.text()).includes("Changing the Effective Date needs the Admin PIN."), "the cryo backdate refusal must name the PIN");
    const cryoNoOperator = await req(`/station/cryo_weight/run/${runId}/add`, { method: "POST", body: cryoLine({ cryo_operator: "" }) });
    assert(cryoNoOperator.status === 400 && (await cryoNoOperator.text()).includes("Operator is required."), `a line without the operator expected 400 in words got ${cryoNoOperator.status}`);
    const cryoBadTag = await req(`/station/cryo_weight/run/${runId}/add`, { method: "POST", body: cryoLine({ package_code: "tote 9" }) });
    assert(cryoBadTag.status === 400 && (await cryoBadTag.text()).includes("The package tag must be 1A plus 22 hex characters."), "a line whose tag is not a METRC tag must refuse in words");
    const cryoBadType = await req(`/station/cryo_weight/run/${runId}/add`, { method: "POST", body: cryoLine({ package_type_code: "TRIM" }) });
    assert(cryoBadType.status === 400 && (await cryoBadType.text()).includes("That product category is not on the cryo list."), "a category outside the list must refuse in words");
    const cryoNoCategory = await req(`/station/cryo_weight/run/${runId}/add`, { method: "POST", body: cryoLine({ package_type_code: "" }) });
    assert(cryoNoCategory.status === 400 && (await cryoNoCategory.text()).includes("Pick the product category."), "a line without a category must refuse in words");
    const cryoEarlyFinish = await req(`/station/cryo_weight/run/${runId}/finish`, { method: "POST", body: form({}) });
    assert(cryoEarlyFinish.status === 400 && (await cryoEarlyFinish.text()).includes("Enter at least one package before finishing."), "Finish run before any output must refuse in words");
    const cryoPlus = await req(`/station/cryo_weight/run/${runId}/add`, { method: "POST", body: cryoLine({}) });
    assert(cryoPlus.status === 303, `the cryo line expected 303 got ${cryoPlus.status} ${await cryoPlus.text()}`);
    assert((cryoPlus.headers.get("location") || "").endsWith(`/station/cryo_weight?pick=${runId}&ok=plus`), `the plus must land back on the run, got ${cryoPlus.headers.get("location")}`);
    const afterPlus = await text(cryoPlus.headers.get("location") || "");
    assert(afterPlus.body.includes("Package entered."), "the plus must flash Package entered.");
    assert(afterPlus.body.includes(`<code>${CRYO_TAG}</code>`), "the entered list must carry the tag upper-cased");
    assert(afterPlus.body.includes('data-pool-total-out="88" data-pool-total-remaining="12"'), "the pool must read 88 out, 12 remaining after the line");
    assert(afterPlus.body.includes('<tr data-pool-category="BUD" data-pool-types="BUD" data-pool-in="100" data-pool-out="88" data-pool-remaining="12">'), "the BUD row must read 88 out, 12 remaining");
    assert(afterPlus.body.includes('<th data-pool-remaining-cell>12</th>'), "the Remaining must read 12");
    assert(afterPlus.body.includes(`data-entered-tag="${CRYO_TAG}"`), "the entered row must carry its tag for the duplicate guard");
    assert(afterPlus.body.indexOf(`action="/station/cryo_weight/run/${runId}/add"`) < afterPlus.body.indexOf("Entered packages"), "the entered packages must sit beneath the entry surface");
    assert(!afterPlus.body.includes("data-cryo-finish-blocked"), "Finish run must arm once a package stands");
    const outId = (afterPlus.body.match(/data-package="([a-f0-9-]{36})"/) || [])[1];
    assert(outId, "the entered list must carry the output's id");
    // THE CRYO CATEGORIES: a WPR line draws from the bud pool as a whole (his
    // "WPR means SMALLS" is a category of the output, not a trim type in the
    // pool); voided back out with a reason so the chain beneath keeps its numbers.
    const WPR_TAG = "1A4050300000000000000C02";
    const cryoWpr = await req(`/station/cryo_weight/run/${runId}/add`, { method: "POST", body: cryoLine({ package_code: WPR_TAG, package_type_code: "wpr", weight_grams: "5.00" }) });
    assert(cryoWpr.status === 303, `the WPR line expected 303 got ${cryoWpr.status} ${await cryoWpr.text()}`);
    const afterWpr = await text(cryoWpr.headers.get("location") || "");
    assert(afterWpr.body.includes('data-pool-total-out="93" data-pool-total-remaining="7"'), "the pool must read 93 out, 7 remaining after the WPR line");
    // A WPR line with no SMALLS in this run: the WPR row lists with 0 in and 5 out, its remaining negative (the guard asked, never refused).
    assert(afterWpr.body.includes('<tr data-pool-category="WPR" data-pool-types="" data-pool-in="0" data-pool-out="5" data-pool-remaining="-5">'), "the WPR row must read 0 in, 5.00 out, -5 remaining, upper-cased");
    assert(afterWpr.body.indexOf('data-pool-category="BUD"') < afterWpr.body.indexOf('data-pool-category="WPR"'), "BUD must list before WPR, in the list's order");
    assert(new RegExp(`<code>${WPR_TAG}</code></td>\\s*<td>WPR</td>`).test(afterWpr.body), "the entered list must read the WPR line under its category");
    const wprId = (afterWpr.body.match(new RegExp(`data-package="([a-f0-9-]{36})" data-entered-tag="${WPR_TAG}"`)) || [])[1];
    assert(wprId, "the WPR row must carry its id and tag");
    const wprVoid = await req(`/record/wip_packages/${wprId}/void`, { method: "POST", body: form({ back: `/station/cryo_weight?pick=${runId}`, reason: "smoke: the WPR line comes back out" }) });
    assert(wprVoid.status === 303, `voiding the WPR line expected 303 got ${wprVoid.status} ${await wprVoid.text()}`);
    const afterWprVoid = await text(`/station/cryo_weight?pick=${runId}`);
    assert(afterWprVoid.body.includes('data-pool-total-out="88" data-pool-total-remaining="12"'), "the pool must return to 88 out after the void");
    assert(!afterWprVoid.body.includes(`data-entered-tag="${WPR_TAG}"`), "the voided WPR line must leave the entered list");
    const cryoDup = await req(`/station/cryo_weight/run/${runId}/add`, { method: "POST", body: cryoLine({}) });
    assert(cryoDup.status === 400 && (await cryoDup.text()).includes("That package tag is already in use."), "a tag already in use must refuse in words");
    // The output is born straight into Testing (his pick); the trim container
    // still waits in the Cryo Queue until Finish run.
    counts = await homeCounts();
    assert(counts.testing === 1, `testing after the cryo line expected 1 got ${counts.testing}`);
    assert(counts.cryo === 1, `the trim container stays in the Cryo Queue until Finish run, got ${counts.cryo}`);
    assert(queueSectionHtml(counts.body, "testing_queue").includes(CRYO_TAG), "the Testing Queue must list the output by its tag");
    // The output's ledger row: the tag, 88.25 g, at Cryo Room.
    const ledgerAfterCryo = await text("/inventory");
    assert(new RegExp(`<code>${CRYO_TAG}</code>[\\s\\S]{0,500}?88 g[\\s\\S]{0,300}?Cryo Room`).test(ledgerAfterCryo.body), "the output must stand on the ledger at Cryo Room with its 88 g");
    const cryoRecord = await text(`/record/wip_packages/${outId}/edit`);
    assert(/name="cryo_operator"[^>]*value="Austin"/.test(cryoRecord.body) && cryoRecord.body.includes('name="cryo_date"'), "the output must save its date and operator on the record");
    // A run with outputs cannot be unscheduled; Finish run closes it.
    const cryoUnsched = await req(`/production/scheduling/cryo/unschedule/${runId}`, { method: "POST", body: form({}) });
    assert(cryoUnsched.status === 400 && (await cryoUnsched.text()).includes("A run with outputs cannot be unscheduled; finish it."), "unscheduling a run with outputs must refuse in words");
    const cryoFinish = await req(`/station/cryo_weight/run/${runId}/finish`, { method: "POST", body: form({}) });
    assert(cryoFinish.status === 303 && (cryoFinish.headers.get("location") || "").includes("ok=finished"), `Finish run expected 303 with ok=finished got ${cryoFinish.status} ${cryoFinish.headers.get("location")}`);
    const cryoFinished = await text(cryoFinish.headers.get("location") || "");
    assert(cryoFinished.body.includes("data-cryo-run-finished") && cryoFinished.body.includes("Run finished."), "the finished run must open read-only with its flash");
    assert(!cryoFinished.body.includes(`action="/station/cryo_weight/run/${runId}/add"`), "a finished run takes no more lines");
    // The trim container is archival: out of the Cryo Queue, its ledger grams zero; the output stands.
    counts = await homeCounts();
    assert(counts.cryo === 0, `cryo after Finish run expected 0 got ${counts.cryo}`);
    assert(counts.testing === 1, `testing after Finish run expected 1 got ${counts.testing}`);
    const ledgerAfterFinish = await text("/inventory");
    assert(/BUD-SMOKE-1<\/td>[\s\S]{0,600}?<td>0 g<\/td>/.test(ledgerAfterFinish.body), "the consumed trim container must read 0 g on the ledger");
    assert(new RegExp(`<code>${CRYO_TAG}</code>[\\s\\S]{0,500}?88 g`).test(ledgerAfterFinish.body), "the output keeps its grams after Finish run");
    const cryoLog = await text("/log");
    assert(cryoLog.body.includes("consumed by the cryo run; the container is archival"), "the change log must carry the consumption reason");
    // The scheduling page: the run complete, reading its pool and outputs; demote refuses.
    const cryoAuto = await text("/production/scheduling/cryo");
    const cryoDonePane = schedPaneOf(cryoAuto.body, "complete");
    assert(cryoDonePane.includes("1 container / 100 g in / 1 out, 88 g"), `the complete pane must read the run's pool and outputs, got\n${cryoDonePane.slice(0, 600)}`);
    assert(!cryoDonePane.includes("BUD-SMOKE-1") && !cryoDonePane.includes(CRYO_TAG), "the complete pane exposes no container, in or out");
    assert(!schedPaneOf(cryoAuto.body, "working").includes("Pasteurizing"), "the working pane must not keep the finished run");
    assert(cryoDonePane.includes('name="unfinish_pin"'), "the finished run must offer Unfinish");
    const cryoDemote = await req(`/production/scheduling/cryo/unfinish/${runId}`, { method: "POST", body: form({}) });
    assert(cryoDemote.status === 403 && (await cryoDemote.text()).includes("Unfinishing a completed item needs the Admin PIN."), "unfinish without the PIN must refuse in words");
    // The New Packages file pends in the owner's T3 template and marks uploaded.
    const npUploads = await text("/admin/uploads");
    assert(npUploads.body.includes(`data-new-packages="${runId}"`) && npUploads.body.includes("New Packages"), "the export home must list the run's New Packages file");
    const npFile = await req(`/admin/uploads/new_packages/${runId}.xlsx`);
    assert(npFile.status === 200, `the New Packages file expected 200 got ${npFile.status}`);
    assert((npFile.headers.get("content-type") || "").includes("spreadsheetml"), "the New Packages file must be an xlsx");
    const npText = new TextDecoder().decode(new Uint8Array(await npFile.arrayBuffer()));
    assert(npText.includes("new_packages_autofill_template.") && npText.includes("Tag Number") && npText.includes("line in repeaterLines"), "the file must carry the template's sheet and header rows");
    assert(npText.includes(`<t>${CRYO_TAG}</t>`) && npText.includes("<t>Cryo Room</t>") && npText.includes("<t>yes</t>") && npText.includes("<v>88</v>") && npText.includes("<t>2026-09-08</t>"), "the line must print the tag, Cryo Room, Same Item yes, 88 and the cryo date");
    const npMark = await req(`/admin/uploads/new_packages/${runId}/uploaded`, { method: "POST", body: form({}) });
    assert(npMark.status === 303, `mark New Packages uploaded expected 303 got ${npMark.status}`);
    const npAfter = await text("/admin/uploads");
    assert(!npAfter.body.includes(`data-new-packages="${runId}"`), "a marked New Packages file must leave the pending list");

    // A second BUD stays in the Cryo Queue so the sheet walk has cryo and testing.
    const secondTrim = await req("/station/trim_packages", {
      method: "POST",
      body: form({
        wet_weight_entry_id: lotId,
        package_code: ["BUD-SMOKE-2"],
        package_type_code: ["BUD"],
        effective_date: "2026-09-08", effective_pin: ADMIN_PIN,
        trim_operator: "Les",
        weight_grams: ["50.00"],
      }),
    });
    if (secondTrim.status !== 303) fail("second bud trim", `status ${secondTrim.status}`);
    counts = await homeCounts();
    assert(counts.cryo === 1, `cryo after second BUD expected 1 got ${counts.cryo}`);
    assert(counts.testing === 1, `testing after second BUD expected 1 got ${counts.testing}`);

    const sheet = await text("/inventory");
    if (sheet.res.status !== 200) fail("GET /inventory sheet", `status ${sheet.res.status}`);
    assert(sheet.body.includes("Local inventory"), "inventory page missing the local ledger");
    // THE LEDGER FOLDS (canon 0.30.129; owner: "make "local inventory" collapsable and make the loading defaul collapsed").
    assert(/<details class="inv-section local-inventory" data-inv-section="local">\s*<summary>Local inventory <span class="tile-count" data-local-inventory-count>\d+<\/span><\/summary>/.test(sheet.body), "the local ledger must be a collapsible block with its count in the summary");
    assert(!/<details class="inv-section local-inventory" data-inv-section="local" open>/.test(sheet.body), "the local ledger must load collapsed");
    assert(sheet.body.includes(">WIP<"), "silo finish must mint a WIP ledger row");
    // The Silo 2 lot weighed in bucked under the silo law and minted WIP, not
    // SPR; THE BLANK SLATE (canon 0.30.108) retired the spear truck lots.
    assert(!sheet.body.includes(">SPR<"), "no spear material yet: the silo lot weighed in bucked under the silo law");
    assert(sheet.body.includes("Barn") || sheet.body.includes("BARN"), "silo unload must land the WIP at BARN");
    assert(invGrams(sheet.body, "wet-drying") === "200.00", `wet drying expected 200.00 got ${invGrams(sheet.body, "wet-drying")}`);
    assert(invGrams(sheet.body, "projected-drying") === "44.00", `projected drying expected 44.00 got ${invGrams(sheet.body, "projected-drying")}`);
    assert(invGrams(sheet.body, "waiting-trim") === "752.00", `waiting trim expected 752.00 got ${invGrams(sheet.body, "waiting-trim")}`);
    assert(invGrams(sheet.body, "waiting-extraction") === "21.00", `extraction expected 21.00 got ${invGrams(sheet.body, "waiting-extraction")}`);
    // THE CRYO RUN: the consumed 100 g container is archival; its run's 88.25 g output counts instead.
    assert(invGrams(sheet.body, "total-dry") === "911.00", `total dry expected 911.00 got ${invGrams(sheet.body, "total-dry")}`);
    assert(invGrams(sheet.body, "rep-scheduled") === "50.00", `scheduled testing expected 50.00 got ${invGrams(sheet.body, "rep-scheduled")}`);
    // THE CRYO RUN: the testing package is the run's output at its cryo weight.
    assert(invGrams(sheet.body, "rep-testing") === "88.00", `in testing expected 88.00 got ${invGrams(sheet.body, "rep-testing")}`);
    assert(sheet.body.includes("OWNER MAPPING NEEDED"), "pasteurization must carry OWNER MAPPING NEEDED");
    assert(sheet.body.includes("awaiting pipeline stage"), "pasteurization must carry awaiting pipeline stage");
    // Owner ruling 2026-09-01: the extraction mapping is ruled ("Trim and BIO
    // only"), so the row carries no PROVISIONAL note; the yield note points at
    // its Admin, Lookups home.
    assert(!sheet.body.includes("PROVISIONAL"), "the ruled extraction row must carry no PROVISIONAL note");
    assert(
      sheet.body.includes("of wet, editable in Admin, Lookups"),
      "the yield note must point at Admin, Lookups"
    );
    assert(sheet.body.includes("26011"), "drying gauge must show the extra lot serial");
    assert(sheet.body.includes('data-inv-block="wet-drying"'), "wet drying details must be present to expand");
    // FG INVENTORY IN METRC (canon 0.30.43): before any packages export is
    // mounted the pane says so and points at the mirror; the Zoho static is gone.
    assert(sheet.body.includes("FG Inventory in METRC"), "the FG pane must be titled FG Inventory in METRC");
    assert(sheet.body.includes('data-inv-fg="missing"') && sheet.body.includes("No METRC packages export mounted yet."), "FG must say no packages export is mounted yet");
    assert(sheet.body.includes('<a href="/inventory/metrc">Drop the Packages export on the METRC Mirror.</a>'), "FG must point at the mirror's drop form");
    assert(!sheet.body.includes("inventory in Zoho") && !sheet.body.includes("2026-08-11 static"), "the Zoho static must be gone from the FG pane");
    const sheetCsv = await text("/export/inventory.csv");
    assert(sheetCsv.res.status === 200, "inventory csv");
    assert(sheetCsv.body.includes("200"), "inventory csv missing wet drying 200");
    assert(sheetCsv.body.includes("911"), "inventory csv missing total dry 911");
    assert(sheetCsv.body.includes("Waiting to be pasteurized"), "inventory csv missing the pasteurization row");

    // Owner ruling 2026-09-01: "Trim and BIO only." The extraction pool keys on
    // app_config extraction_type_codes, not is_bud, so SMALLS and WASTE stay out
    // even though their is_bud = 0; they still count as live dry inventory.
    const exclusionTrim = await req("/station/trim_packages", {
      method: "POST",
      body: form({
        wet_weight_entry_id: lotId,
        package_code: ["SMALLS-SMOKE-1", "WASTE-SMOKE-1"],
        package_type_code: ["SMALLS", "WASTE"],
        effective_date: "2026-09-08", effective_pin: ADMIN_PIN,
        trim_operator: "Les",
        weight_grams: ["5.00", "2.00"],
      }),
    });
    if (exclusionTrim.status !== 303) fail("smalls/waste trim", `status ${exclusionTrim.status}`);
    // THE CRYO POOL BY TYPE (canon 0.30.119; owner: "lot ending 011 contains x
    // amount of bud, y amount of wpr, and z amount of shake.  I need those
    // totals broken down on screen"): SMALLS and SHAKE are cryo-bound with BUD
    // (app_config cryo_type_categories, migration 0060), so the SMALLS container
    // lands in the Cryo Queue beside the second BUD; WASTE stays created. The
    // HBN reads both on Available; a >> makes a run whose pool breaks the In
    // side down by type, the category named with the trim type beside it and
    // the Total row closing the side; the run is unscheduled again so the
    // floor beneath stands as it was.
    const countsSmalls = await homeCounts();
    assert(countsSmalls.cryo === 2, `cryo after the SMALLS container expected 2 (the second BUD and the SMALLS) got ${countsSmalls.cryo}`);
    assert(queueSectionHtml(countsSmalls.body, "cryo_queue").includes("SMALLS-SMOKE-1"), "the Cryo Queue must list the SMALLS container");
    assert(!queueSectionHtml(countsSmalls.body, "cryo_queue").includes("WASTE-SMOKE-1"), "WASTE never reaches the Cryo Queue");
    const availSmalls = schedPaneOf((await text("/production/scheduling/cryo")).body, "available");
    assert(availSmalls.includes(pickedHbn) && availSmalls.includes("2 containers / 55 g in"), `Available must read the BUD and the SMALLS together, got\n${availSmalls.slice(0, 600)}`);
    const schedSmalls = await req("/production/scheduling/cryo/schedule", { method: "POST", body: form({ hbn_id: batchId }) });
    assert(schedSmalls.status === 303 && (schedSmalls.headers.get("location") || "").includes("ok=scheduled&n=2"), `the >> must take both containers in, got ${schedSmalls.status} ${schedSmalls.headers.get("location")}`);
    const workSmalls = schedPaneOf((await text("/production/scheduling/cryo")).body, "working");
    const runSmalls = (workSmalls.match(/data-schedule-id="([^"]+)"/) || [])[1];
    assert(runSmalls, "the working pane must carry the second run's id");
    const poolSmalls = await text(`/station/cryo_weight?pick=${runSmalls}`);
    assert(poolSmalls.body.includes('<tr data-pool-category="BUD" data-pool-types="BUD" data-pool-in="50" data-pool-out="0" data-pool-remaining="50">'), "the pool must read BUD 50.00 in on its own row");
    assert(/<tr data-pool-category="WPR" data-pool-types="SMALLS" data-pool-in="5" data-pool-out="0" data-pool-remaining="5">\s*<td>WPR <span class="muted pool-type-note">SMALLS<\/span><\/td>\s*<td>5<\/td>\s*<td>0<\/td>\s*<td>5<\/td>/.test(poolSmalls.body), "the pool must read WPR (SMALLS) 5 in, 0 out, 5 remaining on its own row");
    assert(poolSmalls.body.includes('<tr><th>Total</th><th>55</th><th>0</th><th data-pool-remaining-cell>55</th></tr>'), "the Total row must close the table at 55 in, 55 remaining");
    assert(poolSmalls.body.includes('data-pool-total-in="55" data-pool-total-out="0" data-pool-total-remaining="55"'), "the pool totals must read 55 in, 0 out, 55 remaining");
    const unschedSmalls = await req(`/production/scheduling/cryo/unschedule/${runSmalls}`, { method: "POST", body: form({}) });
    assert(unschedSmalls.status === 303, `unscheduling the type-pool run expected 303 got ${unschedSmalls.status} ${await unschedSmalls.text()}`);
    const availAgain = schedPaneOf((await text("/production/scheduling/cryo")).body, "available");
    assert(availAgain.includes("2 containers / 55 g in"), "the unscheduled containers must return to Available");
    const sheetExcl = await text("/inventory");
    assert(
      invGrams(sheetExcl.body, "waiting-extraction") === "21.00",
      `extraction must stay 21.00 from the TRIM package with SMALLS and WASTE excluded, got ${invGrams(sheetExcl.body, "waiting-extraction")}`
    );
    assert(
      invGrams(sheetExcl.body, "total-dry") === "918.00",
      `total dry must still count the excluded packages as live, got ${invGrams(sheetExcl.body, "total-dry")}`
    );

    // Owner ruling 2026-09-01: "Kief and Mix are no longer menu items." The
    // migration soft-deleted them; lookup-driven surfaces filter deleted rows.
    const trimOptions = await text(`/station/trim_packages?pick=${lotId}`);
    assert(trimOptions.body.includes('value="TRIM"'), "trim type options must keep TRIM");
    assert(trimOptions.body.includes('value="BIO"'), "trim type options must keep BIO");
    assert(!trimOptions.body.includes('value="MIX"'), "trim type options must drop MIX");
    assert(!trimOptions.body.includes('value="KIEF"'), "trim type options must drop KIEF");
    // Patrick 2026-09-11 (canon 0.30.37): "Shake is not an option in the
    // drop-down menu in the trim room ." Migration 0040 seeds SHAKE, not bud,
    // outside the extraction pool (TRIM,BIO stands below).
    assert(trimOptions.body.includes('<option value="SHAKE">SHAKE</option>'), "trim type options must offer SHAKE (0040)");
    // THE TAG LAW (canon 0.30.38, fork F5): the trim room's code IS the METRC tag.
    assert(trimOptions.body.includes("<th>Package tag</th>"), "the trim room must head its code column Package tag");
    assert(!trimOptions.body.includes("<th>Package code</th>"), "the trim room must not say Package code");
    // THE OVERISSUE LINE IS STRICT (canon 0.30.37): the trim [+] asks only past
    // Remaining, never at it.
    assert(trimOptions.body.includes("w > remaining + 0.005"), "the trim [+] guard must be strictly greater");
    assert(!trimOptions.body.includes("w >= remaining"), "the trim [+] guard must not fire at Remaining");
    const lookupsTypes = await text("/admin/lookups/package_types");
    assert(lookupsTypes.body.includes("<td>TRIM</td>"), "Lookups package types must keep TRIM");
    assert(lookupsTypes.body.includes("<td>SHAKE</td>"), "Lookups package types must list SHAKE (0040)");
    assert(!lookupsTypes.body.includes("<td>MIX</td>"), "Lookups package types must drop MIX");
    assert(!lookupsTypes.body.includes("<td>KIEF</td>"), "Lookups package types must drop KIEF");
    const lookupsNow = await text("/admin/lookups/app_config");

    // Owner ruling 2026-09-01: "ratify 22 but place the home of the 22 in the
    // lookups section of Admin." The App config section: Edit only, no Void, no Add.
    assert(lookupsNow.body.includes("App config"), "Lookups missing the App config section");
    assert(
      lookupsNow.body.includes("<td>projected_dry_yield_pct</td>"),
      "App config must list the yield key"
    );
    assert(lookupsNow.body.includes("<td>22</td>"), "the ratified yield must list value 22");
    assert(
      lookupsNow.body.includes("<td>extraction_type_codes</td>"),
      "App config must list the extraction codes key"
    );
    assert(lookupsNow.body.includes("<td>TRIM,BIO</td>"), "extraction codes must list TRIM,BIO");
    // THE CRYO POOL BY TYPE (canon 0.30.119): the cryo routing list is a value in data beside it.
    assert(lookupsNow.body.includes("<td>cryo_type_categories</td>") && lookupsNow.body.includes("<td>BUD=BUD,SMALLS=WPR,SHAKE=SHA</td>"), "App config must carry cryo_type_categories BUD=BUD,SMALLS=WPR,SHAKE=SHA");
    assert(
      lookupsNow.body.includes('href="/record/app_config/projected_dry_yield_pct/edit"'),
      "the yield row must carry the Edit control"
    );
    assert(
      !/\/record\/app_config\/[^"]+\/void/.test(lookupsNow.body),
      "App config must carry no Void control"
    );
    assert(
      !lookupsNow.body.includes('action="/admin/lookups/app_config"'),
      "App config must carry no Add form"
    );
    const voidConfig = await req("/record/app_config/projected_dry_yield_pct/void", {
      method: "POST",
      body: form({ reason: "smoke void attempt" }),
    });
    assert(voidConfig.status === 400, `app_config void expected 400 got ${voidConfig.status}`);
    const voidConfigBody = await voidConfig.text();
    assert(
      voidConfigBody.includes("App config keys are standing configuration and cannot be voided."),
      "app_config void must refuse with the standing-configuration message"
    );

    // The reasoned edit rides the record path: retarget the extraction codes to
    // BIO only (the pool empties), then restore the ruled TRIM,BIO.
    const codesEditPage = await text("/record/app_config/extraction_type_codes/edit");
    assert(codesEditPage.res.status === 200, `codes edit page expected 200 got ${codesEditPage.res.status}`);
    assert(codesEditPage.body.includes('name="value"'), "codes edit page missing the Value input");
    const codesEdit = await req("/record/app_config/extraction_type_codes/edit", {
      method: "POST",
      body: form({ value: "BIO", reason: "smoke extraction retarget" }),
    });
    if (codesEdit.status !== 303) fail("extraction codes edit", `status ${codesEdit.status}`);
    const sheetBioOnly = await text("/inventory");
    assert(
      invGrams(sheetBioOnly.body, "waiting-extraction") === "0.00",
      `a BIO-only list must empty the pool (no BIO packages exist), got ${invGrams(sheetBioOnly.body, "waiting-extraction")}`
    );
    const codesBack = await req("/record/app_config/extraction_type_codes/edit", {
      method: "POST",
      body: form({ value: "TRIM,BIO", reason: "smoke extraction restore" }),
    });
    if (codesBack.status !== 303) fail("extraction codes restore", `status ${codesBack.status}`);

    // The ratified yield edits the same way; the sheet recomputes, then the
    // restore keeps the downstream assertions standing.
    const yieldEdit = await req("/record/app_config/projected_dry_yield_pct/edit", {
      method: "POST",
      body: form({ value: "30", reason: "smoke yield edit" }),
    });
    if (yieldEdit.status !== 303) fail("yield edit", `status ${yieldEdit.status}`);
    const sheetAt30 = await text("/inventory");
    assert(
      invGrams(sheetAt30.body, "projected-drying") === "60.00",
      `projected drying must recompute at 30 pct of the 200 wet, got ${invGrams(sheetAt30.body, "projected-drying")}`
    );
    assert(sheetAt30.body.includes("(30%"), "the yield note must show the edited percent");
    const logAfterConfig = await text("/log");
    assert(/smoke yield edit/.test(logAfterConfig.body), "change log missing the yield edit reason");
    assert(
      /smoke extraction retarget/.test(logAfterConfig.body),
      "change log missing the extraction codes edit reason"
    );
    assert(logAfterConfig.body.includes("app_config"), "change log missing the app_config table rows");
    const yieldBack = await req("/record/app_config/projected_dry_yield_pct/edit", {
      method: "POST",
      body: form({ value: "22", reason: "smoke yield restore" }),
    });
    if (yieldBack.status !== 303) fail("yield restore", `status ${yieldBack.status}`);
    const sheetRestored = await text("/inventory");
    assert(
      invGrams(sheetRestored.body, "projected-drying") === "44.00",
      `projected drying must return to 44.00 after the restore, got ${invGrams(sheetRestored.body, "projected-drying")}`
    );
    assert(
      invGrams(sheetRestored.body, "waiting-extraction") === "21.00",
      `the restored codes must return the pool to 21.00, got ${invGrams(sheetRestored.body, "waiting-extraction")}`
    );

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
        package_code: CRYO_TAG,
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
        package_code: CRYO_TAG,
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

    // Void returns to its source, never the homepage (owner ruling 2026-08-31).
    const voidGet = await text(`/record/wip_packages/${testId}/void`, {
      headers: { referer: `${base}/admin/queues` },
    });
    assert(
      voidGet.body.includes('name="back" value="/admin/queues"'),
      "void page must carry the referring page as back"
    );
    const voidPost = await req(`/record/wip_packages/${testId}/void`, {
      method: "POST",
      body: form({ back: "/admin/queues", reason: "smoke void" }),
    });
    assert(voidPost.status === 303, `void expected 303 got ${voidPost.status}`);
    const voidLoc = voidPost.headers.get("location") || "";
    assert(
      new URL(voidLoc, base).pathname + new URL(voidLoc, base).search === "/admin/queues?ok=voided",
      `void must return to Data Queues, got ${voidLoc}`
    );

    // The extra drying lot on the second HBN also pends. Mark it uploaded before
    // the first uploads GET so its zero tags cannot keep the muted Plant note
    // after the picked batch is fully tagged.
    const markExtra = await req(`/admin/uploads/wet_weights/${extraLotId}/uploaded`, {
      method: "POST",
      body: form({}),
    });
    if (markExtra.status !== 303) fail("mark extra uploaded", `status ${markExtra.status}`);

    // Pending Data Uploads (owner ruling 2026-08-31): the picked batch holds
    // its finished silo lot by now (through drying and unload; THE BLANK SLATE,
    // canon 0.30.108, refused the truck lot that once finished early beside
    // it), so its wet weights file pends here, after the finish and before the
    // walk ends.
    const uploadsPage = await text("/admin/uploads");
    if (uploadsPage.res.status !== 200) fail("GET /admin/uploads", `status ${uploadsPage.res.status}`);
    assert(uploadsPage.body.includes("Wet Weights"), "uploads page missing the Wet Weights type");
    assert(uploadsPage.body.includes(`${pickedHbn}(1).csv`), `uploads page must list ${pickedHbn}(1).csv`);
    // Wet total = the silo lot's 1234.56 (1000.06 + 234.50).
    // Owner ruling 2026-08-31: the page groups thousands; the CSV below stays raw.
    assert(uploadsPage.body.includes("1,235"), "uploads page missing the wet total 1,235");
    assert(
      uploadsPage.body.includes("Plant column is blank pending the owner's fill rule."),
      "uploads page missing the muted Plant note"
    );
    assert(
      uploadsPage.body.includes(`action="/admin/uploads/wet_weights/${wetLotId}/uploaded"`),
      "uploads page missing the Mark uploaded form"
    );

    const uploadCsv = await text(`/admin/uploads/wet_weights/${wetLotId}.csv`);
    if (uploadCsv.res.status !== 200) fail("GET upload csv", `status ${uploadCsv.res.status}`);
    assert(
      (uploadCsv.res.headers.get("content-disposition") || "").includes(`filename="${pickedHbn}(1).csv"`),
      "upload csv must attach as <hbn>(1).csv"
    );
    const csvLines = uploadCsv.body.split("\r\n").filter((line) => line.length > 0);
    assert(
      csvLines[0] ===
        "Plant,Weight,UnitOfWeight,DryingLocation,DryingSublocation,HarvestName,PatientLicenseNumber,ActualDate",
      `upload csv header mismatch: ${csvLines[0]}`
    );
    assert(csvLines.length >= 2, "upload csv must carry at least one row");
    for (const line of csvLines.slice(1)) {
      const cells = line.split(",");
      assert(cells[0] === "", `Plant must be empty, got ${cells[0]}`);
      assert(cells[2] === "Grams", `UnitOfWeight must be Grams, got ${cells[2]}`);
      assert(cells[4] === "", `DryingSublocation must be empty, got ${cells[4]}`);
      assert(cells[5] === pickedHbn, `HarvestName must be the HBN, got ${cells[5]}`);
      assert(cells[6] === "", `PatientLicenseNumber must be empty, got ${cells[6]}`);
      assert(/^\d{4}-\d{2}-\d{2}$/.test(cells[7]), `ActualDate must be YYYY-MM-DD, got ${cells[7]}`);
    }
    // Canon 0.30.1 spine step 3: the harvest CSV's location is the BARN at
    // the plant-tag license's farm; the truck and the silo are later moves.
    // THE LOCATION WITHOUT THE FARM (canon 0.30.82; owner: "CSVs shouldn't
    // contain the farm name in the locations"): METRC reads BARN, never ARL BARN.
    assert(
      csvLines.some((line) => line.startsWith(",1000.00,Grams,BARN,,")),
      "upload csv missing the silo lot read at 1000.00 grams in the barn"
    );
    assert(
      csvLines.some((line) => line.startsWith(",235.00,Grams,BARN,,")),
      "upload csv missing the silo lot read at 235.00 grams in the barn"
    );
    assert(!csvLines.some((line) => line.startsWith(",500.00,")), "no truck lot rides this batch any more (THE BLANK SLATE)");
    assert(!uploadCsv.body.includes("ARL BARN") && !uploadCsv.body.includes("PNS BARN") && !uploadCsv.body.includes("PNN BARN"), "no METRC file may carry our site prefix on a location");
    assert(!uploadCsv.body.includes("Truck 1,,") && !uploadCsv.body.includes("Silo 1,,"),
      "the harvest CSV must never address a truck or silo directly");
    // Owner ruling 2026-08-31: commas are display only; the METRC file's weights
    // stay raw, so a read over a thousand never grows a group separator.
    assert(
      !/\d,\d{3}\.\d{2}/.test(uploadCsv.body),
      "upload csv must carry no comma-grouped weights"
    );

    const badCsvPath = await req(`/admin/uploads/wet_weights/${batchId}.txt`);
    assert(badCsvPath.status === 404, `non-csv upload path expected 404 got ${badCsvPath.status}`);
    const ghostCsv = await req("/admin/uploads/wet_weights/no-such-batch.csv");
    assert(ghostCsv.status === 404, `unknown batch csv expected 404 got ${ghostCsv.status}`);

    // The Plant fill rule (owner ruling 2026-08-31): pasting tags onto the
    // pending batch turns its file into one row per tag, weights split from
    // the finished entries by the seeded jitter, cent-exact to the wet total.
    assert(uploadsPage.body.includes("Plant tags: 0"), "the pending row must start at zero tags");
    const saveTags = await req(`/admin/uploads/wet_weights/${wetLotId}/tags`, {
      method: "POST",
      body: form({ plant_tags: " 1A4PLANT0001 \n1A4PLANT0002\n\n1A4PLANT0002\n1A4PLANT0003\n" }),
    });
    if (saveTags.status !== 303) fail("save plant tags", `status ${saveTags.status}`);
    const tagsUrl = new URL(saveTags.headers.get("location") || "", base);
    assert(
      tagsUrl.pathname === "/admin/uploads",
      `saving tags must return to /admin/uploads, got ${tagsUrl.pathname}`
    );
    const uploadsTagged = await text(tagsUrl.pathname + tagsUrl.search);
    assert(uploadsTagged.body.includes("Plant tags saved."), "saving tags must flash Plant tags saved.");
    // The paste trimmed, dropped the blank line, and deduped down to 3 tags.
    assert(uploadsTagged.body.includes("Plant tags: 3"), "the pending row must show Plant tags: 3");
    assert(
      !uploadsTagged.body.includes("Plant column is blank pending the owner's fill rule."),
      "a fully tagged pending list must drop the muted Plant note"
    );

    const pastedTags = ["1A4PLANT0001", "1A4PLANT0002", "1A4PLANT0003"];
    const taggedCsv = await text(`/admin/uploads/wet_weights/${wetLotId}.csv`);
    if (taggedCsv.res.status !== 200) fail("GET tagged csv", `status ${taggedCsv.res.status}`);
    const taggedLines = taggedCsv.body.split("\r\n").filter((line) => line.length > 0);
    assert(
      taggedLines.length === 1 + pastedTags.length,
      `tagged csv expected the header plus 3 rows, got ${taggedLines.length}`
    );
    let taggedCents = 0;
    const plantsSeen = [];
    for (const line of taggedLines.slice(1)) {
      const cells = line.split(",");
      // A comma-grouped weight would split a ninth cell out; raw stays 8.
      assert(cells.length === 8, `tagged csv row must carry 8 raw cells, got ${cells.length}`);
      plantsSeen.push(cells[0]);
      assert(/^\d+\.\d{2}$/.test(cells[1]), `tag weight must be raw 2-decimal grams, got ${cells[1]}`);
      assert(cells[2] === "Grams", `UnitOfWeight must be Grams, got ${cells[2]}`);
      assert(cells[4] === "", `DryingSublocation must be empty, got ${cells[4]}`);
      assert(cells[5] === pickedHbn, `HarvestName must be the HBN, got ${cells[5]}`);
      assert(cells[6] === "", `PatientLicenseNumber must be empty, got ${cells[6]}`);
      taggedCents += Math.round(Number(cells[1]) * 100);
    }
    assert(
      plantsSeen.slice().sort().join("|") === pastedTags.slice().sort().join("|"),
      `every Plant cell must carry a pasted tag once, got ${plantsSeen.join(", ")}`
    );
    // The wet total here: the silo lot's 1,235 g (1000 + 235), stored whole.
    assert(
      taggedCents === 123500,
      `tag weights must sum cent-exact to the 1235 wet total, got ${taggedCents} cents`
    );
    const taggedCsvAgain = await text(`/admin/uploads/wet_weights/${wetLotId}.csv`);
    assert(
      taggedCsvAgain.body === taggedCsv.body,
      "a second download must reproduce the identical tagged file (seeded determinism)"
    );

    // An empty paste clears the set and the file returns to one row per read.
    const clearTags = await req(`/admin/uploads/wet_weights/${wetLotId}/tags`, {
      method: "POST",
      body: form({ plant_tags: "" }),
    });
    if (clearTags.status !== 303) fail("clear plant tags", `status ${clearTags.status}`);
    const uploadsCleared = await text("/admin/uploads");
    assert(uploadsCleared.body.includes("Plant tags: 0"), "clearing must return the row to zero tags");
    assert(
      uploadsCleared.body.includes("Plant column is blank pending the owner's fill rule."),
      "a zero-tag pending list must bring the muted Plant note back"
    );
    const clearedCsv = await text(`/admin/uploads/wet_weights/${wetLotId}.csv`);
    assert(
      clearedCsv.body === uploadCsv.body,
      "clearing tags must return the read-rows file byte for byte"
    );

    const markUploaded = await req(`/admin/uploads/wet_weights/${wetLotId}/uploaded`, {
      method: "POST",
      body: form({}),
    });
    if (markUploaded.status !== 303) fail("mark uploaded", `status ${markUploaded.status}`);
    const markUrl = new URL(markUploaded.headers.get("location") || "", base);
    assert(
      markUrl.pathname === "/admin/uploads",
      `mark uploaded must return to /admin/uploads, got ${markUrl.pathname}`
    );
    const uploadsAfterMark = await text(markUrl.pathname + markUrl.search);
    assert(
      uploadsAfterMark.body.includes("Marked uploaded."),
      "mark uploaded must flash Marked uploaded."
    );
    assert(
      !uploadsAfterMark.body.includes(`/admin/uploads/wet_weights/${wetLotId}.csv`),
      "a marked load must leave the pending list"
    );
    assert(
      uploadsAfterMark.body.includes("Package Adjustments") ||
        uploadsAfterMark.body.includes("Packages from Harvests"),
      "a finished unload must leave a package file pending"
    );
    assert(
      !uploadsAfterMark.body.includes("Nothing pending."),
      "package files still pending must not show the empty wet list line"
    );

    // A reasoned weight edit after the mark does not re-pend the file. It
    // shows under Changed after upload. Reweigh the silo lot's 234.5 read.
    const wetLotAfter = await text(`/station/wet_weight?lot=${wetLotId}`);
    const wetRow = wetLotAfter.body.match(
      /<td>235<\/td>[^]*?href="\/record\/wet_weights\/([^/"]+)\/edit"/
    );
    if (!wetRow) fail("changed after upload", "missing the pencil on the 235 wet weight");
    const rePend = await req(`/record/wet_weights/${wetRow[1]}/edit`, {
      method: "POST",
      body: form({ weight_grams: "240", reason: "smoke metrc reweigh" }),
    });
    if (rePend.status !== 303) fail("changed after upload", `status ${rePend.status}`);
    const uploadsAfterEdit = await text("/admin/uploads");
    assert(
      !uploadsAfterEdit.body.includes(`wet_weights/${wetLotId}.csv`),
      "an edit after the mark must not re-pend the harvest file"
    );
    assert(uploadsAfterEdit.body.includes("Changed after upload"), "the edit must show under Changed after upload");
    assert(uploadsAfterEdit.body.includes(`${pickedHbn}(1).csv`), "the changed row must name the load's file");
    assert(uploadsAfterEdit.body.includes("1,240"), "the changed row must carry the grams now");
    const ackChange = await req(`/admin/uploads/wet_weights/${wetLotId}/acknowledge`, {
      method: "POST",
      body: form({ reason: "smoke acknowledged the reweigh" }),
    });
    if (ackChange.status !== 303) fail("acknowledge change", `status ${ackChange.status} ${await ackChange.text()}`);
    const afterAck = await text("/admin/uploads");
    assert(!afterAck.body.includes("data-changed-upload"), "acknowledge must clear the changed row");

    // Acquire HBN recall: mint a weightless batch, recall it (void + prefill),
    // remint one serial past the recalled gap (ADR-6).
    const acquireBefore = await text("/station/acquire_hbn");
    const recallStrain = optionValue(acquireBefore.body, "Fruity Pebbles");
    const recallMint = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({
        entry_date: "2026-09-01",
        farm_code: "ARL",
        grow_method_code: "GH",
        strain_id: recallStrain,
        start_time: "08:15",
        zone: "Z9",
        rows_text: "7-8",
        metrc_harvest_tag: "1A4RECALL",
      }),
    });
    if (recallMint.status !== 303) fail("recall mint", `status ${recallMint.status}`);
    const minted3 = new URL(recallMint.headers.get("location") || "", base).searchParams.get("minted");
    assert(minted3 && minted3.endsWith("-26012"), `recall mint expected serial 26012 got ${minted3}`);
    const acquirePane = await text("/station/acquire_hbn");
    assert(acquirePane.body.includes(minted3), "recall pane must list the new weightless HBN");
    assert(acquirePane.body.includes('id="acquire-hbn-form"'), "acquire must carry the confirm-guard form id");
    assert(acquirePane.body.includes("Unsaved HBN data will be lost."), "acquire missing the confirm text");
    const recallId = firstInputValue(acquirePane.body, "id");
    const recallPost = await req("/station/acquire_hbn/recall", {
      method: "POST",
      body: form({ id: recallId }),
    });
    assert(recallPost.status === 303, `recall expected 303 got ${recallPost.status}`);
    const recallLoc = recallPost.headers.get("location") || "";
    assert(recallLoc.includes("ok=recalled"), `recall redirect must prefill, got ${recallLoc}`);
    assert(recallLoc.includes("entry_date=2026-09-01"), "recall redirect missing date");
    assert(recallLoc.includes("zone=Z9"), "recall redirect missing zone");
    const recalledUrl = new URL(recallLoc, base);
    const recalledPage = await text(recalledUrl.pathname + recalledUrl.search);
    assert(recalledPage.body.includes("HBN recalled."), "flash must say HBN recalled.");
    assert(recalledPage.body.includes('name="entry_date" value="2026-09-01"'), "form must prefill date");
    assert(recalledPage.body.includes('name="zone" value="Z9"'), "form must prefill zone");
    assert(recalledPage.body.includes('name="start_time" value="08:15"'), "form must prefill start time");
    assert(recalledPage.body.includes('name="metrc_harvest_tag" value="1A4RECALL"'), "form must prefill the tag");
    assert(!recalledPage.body.includes(minted3), "recalled HBN must leave the pane");
    counts = await homeCounts();
    assert(
      !queueSectionHtml(counts.body, "hbn_queue").includes(minted3),
      "recalled HBN must leave the HBN Queue"
    );
    const logAfterRecall = await text("/log");
    assert(/recalled/.test(logAfterRecall.body), "change log must carry the reasoned void");
    const remint = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({
        entry_date: "2026-09-01",
        farm_code: "ARL",
        grow_method_code: "GH",
        strain_id: recallStrain,
      }),
    });
    if (remint.status !== 303) fail("remint after recall", `status ${remint.status}`);
    const minted4 = new URL(remint.headers.get("location") || "", base).searchParams.get("minted");
    assert(minted4 && minted4.endsWith("-26013"), `remint must skip the recalled serial, got ${minted4}`);

    // Duplicate-lot guard (owner report 2026-09-01): an in-progress lot must never
    // hide behind a blank header form. Exactly one weighing lot: the pick 302s onto
    // the lot; the header form returns only through Start another lot (?new=1) or a
    // staged ?truck=. Two lots: the pick renders the resume list with the header
    // form collapsed behind a Start another lot details. HTML goes out no-store so
    // a floor tablet can never show a stale header.
    const guardPane = await text("/station/wet_weight");
    const guardLink = guardPane.body.match(/href="\/station\/wet_weight\?pick=([^"]+)">([^<]+)</);
    if (!guardLink) fail("guard pane", "missing the reminted batch link");
    const guardBatchId = guardLink[1];
    assert(
      /^\d+\. ARL \/ /.test(guardLink[2]),
      `guard pane rows read 'N. Farm / Strain / Date', got ${guardLink[2]}`
    );
    const guardFresh = await text(`/station/wet_weight?pick=${guardBatchId}`);
    assert(
      guardFresh.body.includes(`<p class="muted">${minted4}</p>`),
      "guard pick must be the reminted batch (muted HBN)"
    );
    assert(guardFresh.res.status === 200, `fresh guard pick expected 200 got ${guardFresh.res.status}`);
    assert(
      (guardFresh.res.headers.get("cache-control") || "").includes("no-store"),
      "station HTML must send cache-control no-store"
    );
    assert(!guardFresh.body.includes("Start another lot"), "a lotless pick must show the plain header form");
    // Owner ruling 2026-09-07 (canon 0.29.1): this lot weighs in BUCKED at the
    // wet weight entry screen; the unload below derives its mode from the lot.
    const guardStart = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        team_lead: "Smoke Lead",
        harvest_batch_id: guardBatchId,
        actual_dryspc: silo2Id,
        material_form: "bucked",
        notes: "guard lot one",
      }),
    });
    if (guardStart.status !== 303) fail("guard start lot", `status ${guardStart.status}`);
    const guardLotId = new URL(guardStart.headers.get("location") || "", base).searchParams.get("lot");
    if (!guardLotId) fail("guard start lot", "no lot id on redirect");
    const guardRepick = await req(`/station/wet_weight?pick=${guardBatchId}`);
    assert(
      guardRepick.status === 302,
      `a pick with one weighing lot must 302 onto it, got ${guardRepick.status}`
    );
    assert(
      (guardRepick.headers.get("location") || "").endsWith(`lot=${guardLotId}`),
      `the single-lot redirect must land on ?lot=${guardLotId}`
    );
    const guardLotView = await text(`/station/wet_weight?lot=${guardLotId}`);
    assert(guardLotView.res.status === 200, `guard lot view expected 200 got ${guardLotView.res.status}`);
    assert(
      guardLotView.body.includes(
        `<a class="secondary" href="/station/wet_weight?pick=${guardBatchId}&amp;new=1">Start another lot</a>`
      ),
      "the lot panel must carry the Start another lot link with new=1"
    );
    assert(!guardLotView.body.includes('name="lead_person_id"'), "the lot view must carry no header form");
    const guardNew = await text(`/station/wet_weight?pick=${guardBatchId}&new=1`);
    assert(guardNew.res.status === 200, `?new=1 must render, got ${guardNew.res.status}`);
    assert(guardNew.body.includes("Lots in progress"), "?new=1 must keep the resume list in sight");
    assert(guardNew.body.includes(`href="/station/wet_weight?lot=${guardLotId}"`), "?new=1 missing the resume link");
    assert(!guardNew.body.includes('<details class="start-another">'), "?new=1 must open the header form");
    assert(guardNew.body.includes("Start lot"), "?new=1 must carry the Start lot button");
    // A staged ?truck= also implies the header form is wanted; it must not bounce.
    const guardStage = await req("/station/wet_weight/add_truck", {
      method: "POST",
      body: form({ pick: guardBatchId }),
    });
    if (guardStage.status !== 303) fail("guard truck stage", `status ${guardStage.status}`);
    const guardStageLoc = guardStage.headers.get("location") || "";
    const guardStaged = await text(guardStageLoc);
    assert(
      guardStaged.res.status === 200,
      `a staged truck pick must render the form, got ${guardStaged.res.status}`
    );
    // THE BLANK SLATE (canon 0.30.108): the staged number surfaces no truck option any more.
    assert(!guardStaged.body.includes('value="truck-'), "a staged truck number must surface no truck option");
    assert(guardStaged.body.includes("Start lot"), "a staged ?truck= still opens the header form");
    // THE FOUR START TAPS (canon 0.30.89): the same header again within a
    // minute would land on the empty first lot (the tap guard), so the second
    // crew's lot names its own Team Lead, the real two-lots case.
    const guardStart2 = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        team_lead: "Second Lead",
        harvest_batch_id: guardBatchId,
        actual_dryspc: silo2Id,
        notes: "guard lot two",
      }),
    });
    if (guardStart2.status !== 303) fail("guard start second lot", `status ${guardStart2.status}`);
    const guardLotId2 = new URL(guardStart2.headers.get("location") || "", base).searchParams.get("lot");
    assert(guardLotId2 && guardLotId2 !== guardLotId, "a second crew's header (another Team Lead) must mint its own lot");
    const guardTwo = await text(`/station/wet_weight?pick=${guardBatchId}`);
    assert(
      guardTwo.res.status === 200,
      `a pick with two weighing lots must render, got ${guardTwo.res.status}`
    );
    assert(
      guardTwo.body.includes('<details class="start-another">'),
      "two lots must collapse the header form behind Start another lot"
    );
    assert(
      guardTwo.body.includes("<summary>Start another lot</summary>"),
      "the collapsed header form must be labeled Start another lot"
    );
    assert(
      guardTwo.body.includes(`href="/station/wet_weight?lot=${guardLotId}"`) &&
        guardTwo.body.includes(`href="/station/wet_weight?lot=${guardLotId2}"`),
      "the two-lot pick must list both resume links"
    );

    // Demote (owner ruling 2026-09-02): a [Demote] button on the Data Queues
    // kicks the record back down to the last process it was at, behind a
    // confirm warning, reasoned into the change log. Finish guard lot two into
    // the Dry Space Queue, demote it back to weighing, and watch it leave.
    const demoteWeight = await req(`/station/wet_weight/lot/${guardLotId2}/weights`, {
      method: "POST",
      body: form({ weight_grams: "111.11" }),
    });
    if (demoteWeight.status !== 303) fail("demote seed weight", `status ${demoteWeight.status}`);
    const demoteFinish = await req(`/station/wet_weight/lot/${guardLotId2}/finish`, {
      method: "POST",
      body: form({}),
    });
    if (demoteFinish.status !== 303) fail("demote seed finish", `status ${demoteFinish.status}`);
    const queuesBefore = await text("/admin/queues");
    const drySection = queueSectionHtml(queuesBefore.body, "dry_space_queue");
    assert(drySection.includes('name="control" value="demote"'), "dry space rows missing the Demote control");
    assert(
      drySection.includes("onsubmit=\"return confirm('Demote kicks this record back to the last process it was at. Continue?')\""),
      "the Demote form must carry the confirm warning"
    );
    assert(
      !queueSectionHtml(queuesBefore.body, "hbn_queue").includes('value="demote"'),
      "birth-status HBN rows must carry no Demote control"
    );
    const demote = await req("/queue/dry_space_queue/control", {
      method: "POST",
      body: form({ id: guardLotId2, control: "demote" }),
    });
    assert(demote.status === 303, `demote expected 303 got ${demote.status}`);
    assert(
      (demote.headers.get("location") || "").endsWith("/admin/queues?ok=demoted"),
      "demote must return to the Data Queues with its flash"
    );
    const queuesAfter = await text("/admin/queues");
    assert(
      !queueSectionHtml(queuesAfter.body, "dry_space_queue").includes(guardLotId2),
      "the demoted lot must leave the Dry Space Queue"
    );
    const demotedLotView = await text(`/station/wet_weight?lot=${guardLotId2}`);
    assert(
      demotedLotView.body.includes("Finish load"),
      "the demoted lot must be back at the wet station as a weighing lot"
    );
    const demoteLog = await text("/log");
    assert(/demoted/.test(demoteLog.body), "the change log must carry the reasoned demote");
    // A birth-status record refuses the step with a clear 400.
    const demoteBirth = await req("/queue/dry_space_queue/control", {
      method: "POST",
      body: form({ id: guardLotId2, control: "demote" }),
    });
    assert(
      demoteBirth.status === 400,
      `a second demote from weighing must refuse 400, got ${demoteBirth.status}`
    );

    const siloLookup = await text("/admin/lookups/silo_number");
    assert(siloLookup.res.status === 200, `silo lookup expected 200 got ${siloLookup.res.status}`);
    for (const v of ["1", "2", "3", "4", "5", "NA"]) {
      assert(siloLookup.body.includes(`>${v}<`) || siloLookup.body.includes(`>${v}</`), `silo lookup missing ${v}`);
    }
    const locLookup = await text("/admin/lookups/licenses");
    assert(locLookup.body.includes("AU-G-C-000832"), "license lookup missing AU-G-C-000832");
    assert(locLookup.body.includes("AU-P-000694"), "license lookup missing AU-P-000694");
    assert(locLookup.body.includes("PNN AU"), "license lookup missing PNN AU");
    assert(locLookup.body.includes("PNN Processor"), "license lookup missing PNN Processor");
    assert(locLookup.body.includes("PNN Med"), "license lookup missing PNN Med");
    assert(locLookup.body.includes("PNS AU"), "license lookup missing PNS AU");
    assert(locLookup.body.includes("PNS Med"), "license lookup missing PNS Med");
    assert(locLookup.body.includes("ARL AU"), "license lookup missing ARL AU");
    assert(locLookup.body.includes("ARL Med"), "license lookup missing ARL Med");
    assert(locLookup.body.includes("tone"), "license lookup missing the tone column");
    assert(locLookup.body.includes("farm_code"), "license lookup missing the Farm column");
    assert(locLookup.body.includes('name="farm_code"'), "license add form must offer the farm select");
    // Fork 5 (canon 0.30.1, his word: "do it"): the GR-C trio ARE the Med
    // lines, farm-assigned; the placeholders retired in 0034.
    assert(locLookup.body.includes("GR-C-001132"), "the PNN Med line must be GR-C-001132");
    assert(locLookup.body.includes("GR-C-001405"), "the PNS Med line must be GR-C-001405");
    assert(locLookup.body.includes("GR-C-002600"), "the ARL Med line must be GR-C-002600");
    assert(!locLookup.body.includes("MED-ARL-TBD"), "the ARL Med placeholder must be retired");
    assert(!locLookup.body.includes("MED-PNS-TBD"), "the PNS Med placeholder must be retired");
    assert(!locLookup.body.includes("PNN Med (1132 stack)"), "the 1132 placeholder must be retired");
    assert(!locLookup.body.includes("TBD-AU-P"), "license lookup must not seed a TBD processor");
    const locPlaces = await text("/admin/lookups/inventory_locations");
    assert(locPlaces.res.status === 200, `location lookup expected 200 got ${locPlaces.res.status}`);
    assert(locPlaces.body.includes("Barn"), "location lookup missing Barn");
    assert(
      locPlaces.body.includes("Barns are the inbox at every site. CSA is 832-side staging. CSB and unknown spots are processor under 694."),
      "location lookup must state the side convention v2"
    );
    assert(locPlaces.body.includes("ARL BARN") || locPlaces.body.includes("ARL Barn"), "0028 must seed ARL BARN");
    assert(locPlaces.body.includes("PNS BARN") || locPlaces.body.includes("PNS Barn"), "0028 must seed PNS BARN");
    assert(locPlaces.body.includes("CSA"), "0028 must restore CSA");

    const invCsv = await text("/reports/inventory?format=csv");
    assert(invCsv.res.status === 200, `inventory csv expected 200 got ${invCsv.res.status}`);
    assert(
      invCsv.body.startsWith("Kind,Package code,Strain,Quantity,UOM,Farm,Location"),
      `inventory csv header got ${invCsv.body.slice(0, 80)}`
    );
    const invXlsx = await bin("/reports/inventory?format=xlsx");
    assert(invXlsx.res.status === 200, `inventory xlsx expected 200 got ${invXlsx.res.status}`);
    assert(invXlsx.buf[0] === 0x50 && invXlsx.buf[1] === 0x4b, "xlsx must start with PK");
    for (const part of [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]) {
      assert(invXlsx.latin.includes(part), `xlsx missing ${part}`);
    }
    const invPdf = await text("/reports/inventory?format=pdf");
    assert(invPdf.res.status === 200, `inventory pdf expected 200 got ${invPdf.res.status}`);
    assert(invPdf.body.includes("Print or save as PDF"), "pdf lane missing the print button");
    assert(invPdf.body.includes("window.print()"), "pdf lane missing on-load print");
    assert(!invPdf.body.includes("PDF (pretty)"), "the print view must not relabel the PDF lane");

    // THE BLANK SLATE (canon 0.30.108; owner, verbatim: "We need to completely
    // wipe the slate clean on the interco logistics tab.  Right now, it exists
    // to build a csv.  Make the entire menu surface blank." and "Wet Weights:
    // assume everything that get's entered into wet weights is landing in PNN's
    // barn location.  We'll handle real life logistics in METRC for now"). The
    // manifest, arrivals, receipt and door walks that stood here are gone with
    // the surface; the harvest spine writes no movement, so at this point of
    // the walk the export home's Manifests and Receipts lists stay empty and
    // the Logistics Moves queue reads none (THE MANIFEST BUILDER's own walk,
    // at the tail, is the only hand that writes one now).
    const noManifests = await text("/admin/uploads");
    assert(!noManifests.body.includes("/admin/uploads/manifest/"), "no manifest may pend: nothing writes a movement any more");
    assert(!noManifests.body.includes("/admin/uploads/receive_manifest/"), "no receive file may pend: nothing arrives in the app any more");
    const noMoves = await text("/admin/queues");
    assert(noMoves.body.includes('data-queue="logistics_moves"'), "the Logistics Moves record table still stands in Data Queues");
    assert(noMoves.body.includes("No logistics moves."), "the Logistics Moves record table reads none");

    // The ARL HBN's extra lot weighed into PNN's Silo 2 (the silo law weighs it
    // bucked) and its born package waits in PNN's BARN. THE FINISHED LOT IS
    // ELIGIBLE (canon 0.30.130; owner, 2026-09-19: "regardless of what farm the
    // HBN indicates, assume it's elligible for dry space loading as soon as the
    // "finish lot" routine runs"): the pane reads "Finished wet lots", the
    // pick offers every space on the strip, ARL's room among them (the 0.30.73
    // site refusal is repealed with the ledger's hold), Silo 2 preselected.
    await passEntry(extraLotId);
    const arlPane = await text(`/station/load_silo?pick=${extraLotId}`);
    assert(arlPane.res.status === 200, `load silo pick of the ARL HBN's lot expected 200 got ${arlPane.res.status}`);
    assert(arlPane.body.includes("Scheduled lots"), "the Load Silo pane must read Scheduled lots");
    assert(!arlPane.body.includes("Wet lots in the barn"), "the barn heading is gone with the ledger's hold");
    const arlSelect = arlPane.body.match(/<select name="dry_space_id" required>([^]*?)<\/select>/);
    assert(arlSelect && arlSelect[1].includes(`<option value="${silo2Id}" selected>Silo 2</option>`), "the lot's planned Silo 2 must preselect");
    assert(arlSelect && arlSelect[1].includes(`<option value="${arlRoomId}">Arlington Dry Room</option>`), "every space on the strip is offered, the Arlington Dry Room too (canon 0.30.130)");
    const roomLoad = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: extraLotId, dry_space_id: silo2Id, start_time: "", loaded_at_iso: "" }),
    });
    assert(roomLoad.status === 303, `load into Silo 2 expected 303 got ${roomLoad.status}`);
    const roomStrip = await text("/station/load_silo");
    assert(roomStrip.body.includes(`data-silo="${silo2Id}" data-silo-state="drying" data-silo-shape-kind="cylinder"`), "the loaded Silo 2 must read drying");
    assert(roomStrip.body.includes(`data-silo="${arlRoomId}" data-silo-state="empty" data-silo-shape-kind="box"`), "the Arlington Dry Room stands empty on the strip");
    const roomLive = await req("/silos/live.json");
    assert(roomLive.status === 200, `live json expected 200 got ${roomLive.status}`);
    const roomLiveJson = await roomLive.json();
    const roomEntry = (roomLiveJson.silos || []).find((x) => x.id === silo2Id);
    assert(roomEntry && roomEntry.shape === "cylinder" && roomEntry.state === "drying", "live.json must carry Silo 2 drying");
    assert(!("ffz" in roomLiveJson), "live.json must not carry an FFZ cube");
    const invRoomCsv = await text("/reports/inventory_by_location?format=csv");
    // Canon 0.30.23: the CSV reads Site,Location,Origin farm,Product type,Total,UOM;
    // the origin farm stays the HBN's (ARL) while the material sits at PNN.
    assert(invRoomCsv.body.includes("PNN,Silo 2,ARL,WIP,200,g"), `the loaded lot must sit under Silo 2 at PNN with its ARL origin, got\n${invRoomCsv.body}`);
    assert(invRoomCsv.body.includes("PNN,Silo 2,,Wet total,200,g"), "Silo 2 must close with its Wet total row");
    assert(!/^ARL,ARL BARN,/m.test(invRoomCsv.body), "nothing lands in the ARL barn any more");
    const pnnBarnWip = (csv) => {
      const m = csv.match(/^PNN,BARN,ARL,WIP,"?([0-9.,]+)"?,g/m);
      return m ? Number(String(m[1]).replace(/,/g, "")) : 0;
    };
    const pnnBarnBefore = pnnBarnWip(invRoomCsv.body);

    const extraUnload = await text(`/station/unload_dry_space?pick=${extraLotId}`);
    assert(extraUnload.res.status === 200, `extra unload pick expected 200 got ${extraUnload.res.status}`);
    // Owner ruling 2026-09-07 (canon 0.29.1): the spear/buck toggle moved to
    // the wet weight entry screen. The unload shows the lot's form as a plain
    // line and carries no weigh radios; a silo lot is bucked and the
    // bucked-on-site question never renders.
    assert(!extraUnload.body.includes('name="weigh_mode"'), "the unload must carry no weigh radios");
    assert(extraUnload.body.includes("data-material-form"), "the unload must show the lot's Material line");
    assert(extraUnload.body.includes("Material: Bucked"), "the silo law weighs the Silo 2 lot in bucked");
    assert(!extraUnload.body.includes("data-bucked-on-site"), "a bucked silo lot carries no bucked-on-site question");
    const extraDry = await req(`/station/unload_dry_space/lot/${extraLotId}/weights`, {
      method: "POST",
      body: form({ weight_grams: "80.00", rapid_add: "1" }),
    });
    assert(extraDry.status === 303, `extra dry weight expected 303 got ${extraDry.status}`);
    const extraDryLoc = extraDry.headers.get("location") || "";
    assert(extraDryLoc.includes("rapid=1"), `plus lane must clear-and-refocus, got ${extraDryLoc}`);
    const extraRapid = await text(`/station/unload_dry_space?pick=${extraLotId}&rapid=1`);
    assert(extraRapid.body.includes("data-rapid-focus"), "plus lane must focus the first box");
    assert(extraRapid.body.includes('name="rapid_add" value="1"'), "unload add row must keep the plus control");
    // The 0.24.1 radio-lock law retired with the radios: weights lock nothing.
    const afterWeights = await text(`/station/unload_dry_space?pick=${extraLotId}`);
    assert(
      !afterWeights.body.includes("checked disabled") && !afterWeights.body.includes('name="weigh_mode"'),
      "the unload with weights must stay radio-free, nothing locks"
    );
    // Canon 0.30.21: the unload operator is hand entry again (any name saves).
    assert(afterWeights.body.includes('<input type="text" name="operator_name"'), "the unload operator must be a typed field");
    assert(!afterWeights.body.includes('<select name="operator_name">'), "the unload operator must not be a select of the maintenance crew");
    const saveSession = await req(`/station/unload_dry_space/lot/${extraLotId}/session`, {
      method: "POST",
      body: form({ operator_name: "Smoke Op" }),
    });
    assert(saveSession.status === 303, `save session expected 303 got ${saveSession.status}`);
    const extraSaved = await text(`/station/unload_dry_space?pick=${extraLotId}`);
    assert(extraSaved.body.includes('name="operator_name" value="Smoke Op"'), "the session must keep its typed operator");
    assert(extraSaved.body.includes("Material: Bucked"), "the Material line must ride every render");
    // 80 g dry against a 200 g parent: the under gate; "nothing" records the dry
    // total on the package (the silo law) and the unload returns the material to
    // PNN's barn, ending Silo 2's load.
    const roomFinish = await finishUnloadLot(extraLotId, {}, "nothing");
    assert(roomFinish.loc.includes("ok=unloaded"), `the Silo 2 unload finish must complete, got ${roomFinish.loc}`);
    // Silo 2's load is ended; the guard lot still weighing into it (started
    // above, weighed below) leaves it filling, no longer drying.
    const roomAfter = await text("/station/load_silo");
    assert(roomAfter.body.includes(`data-silo="${silo2Id}" data-silo-state="filling" data-silo-shape-kind="cylinder"`), "the unloaded Silo 2 must drop its drying state (the guard lot keeps it filling)");
    assert(!roomAfter.body.includes(`data-silo="${silo2Id}" data-silo-state="drying"`), "the ended load must clear Silo 2's clock");
    const siloTileHtml = (html, id) => {
      const marker = `data-silo="${id}"`;
      const at = html.indexOf(marker);
      if (at < 0) return "";
      const next = html.indexOf('data-silo="', at + marker.length);
      return next < 0 ? html.slice(at) : html.slice(at, next);
    };
    const silo2Tile = siloTileHtml(roomAfter.body, silo2Id);
    const liveEmpty = await (await req("/silos/live.json")).json();
    const silo2LiveEmpty = (liveEmpty.silos || []).find((x) => x.id === silo2Id);
    assert(silo2Tile.includes("Empty since") && silo2Tile.includes('data-silo-empty="1">'), "an unloaded silo must show Empty since");
    assert(silo2Tile.includes('data-state="running"') && silo2Tile.includes('data-paused-seconds="0"'), "the empty clock must run from the unload, with no banked pause");
    assert(/\d+d \d{2}:\d{2}:\d{2}/.test(silo2Tile), "the empty clock must read in the load clock's shape");
    assert(
      silo2LiveEmpty && silo2LiveEmpty.state === "filling" && typeof silo2LiveEmpty.emptySince === "string" && /^\d{4}-\d{2}-\d{2}T/.test(silo2LiveEmpty.emptySince) && silo2LiveEmpty.wetGrams != null,
      `live.json must carry Silo 2's empty origin beside the old fields, got ${JSON.stringify(silo2LiveEmpty)}`
    );
    const bfEmptyTile = siloTileHtml(roomAfter.body, drySpaceIdByName(lookupsPage.body, "Blast Freezer(s)"));
    assert(bfEmptyTile && !bfEmptyTile.includes("Empty since") && !bfEmptyTile.includes("data-silo-empty"), "a freezer tile must not carry the empty clock");
    const invAfterRoomCsv = await text("/reports/inventory_by_location?format=csv");
    assert(
      Math.abs(pnnBarnWip(invAfterRoomCsv.body) - (pnnBarnBefore + 80)) < 0.005,
      `the unloaded material must return to PNN's barn at its dry weight (80 g more than ${pnnBarnBefore}), got\n${invAfterRoomCsv.body}`
    );
    assert(!invAfterRoomCsv.body.includes("Silo 2,ARL,WIP"), "nothing may linger under the emptied Silo 2");

    const guardWeight2 = await req(`/station/wet_weight/lot/${guardLotId}/weights`, {
      method: "POST",
      body: form({ weight_grams: "90.00" }),
    });
    assert(guardWeight2.status === 303, `guard hang weight expected 303 got ${guardWeight2.status}`);
    // THE TAG LAW (canon 0.30.38, fork F4): the wet lot page offers the tag
    // box beside Finish lot; the typed tag rides onto the born package.
    const GUARD_TAG = "1A4050300000000000000E07";
    const guardLotPage = await text(`/station/wet_weight?lot=${guardLotId}`);
    assert(guardLotPage.body.includes('name="metrc_tag"') && guardLotPage.body.includes("METRC package tag (optional)"), "the wet lot page must offer the METRC tag box beside Finish lot");
    const guardHangFinish = await req(`/station/wet_weight/lot/${guardLotId}/finish`, {
      method: "POST",
      body: form({ metrc_tag: GUARD_TAG }),
    });
    assert(guardHangFinish.status === 303, `guard hang finish expected 303 got ${guardHangFinish.status}`);
    const invGuardTag = await text("/inventory");
    assert(invGuardTag.body.includes(`<code>${GUARD_TAG}</code>`), "the born package must carry the tag typed at Finish lot");
    const buckedSession = await req(`/station/unload_dry_space/lot/${guardLotId}/session`, {
      method: "POST",
      body: form({ operator_name: "Austin" }),
    });
    assert(buckedSession.status === 303, `bucked session expected 303 got ${buckedSession.status}`);
    const buckedView = await text(`/station/unload_dry_space?pick=${guardLotId}`);
    // Owner ruling 2026-09-07 (canon 0.29.1): the lot weighed in bucked; the
    // unload reads the lot and never asks bucked-on-site for bucked material.
    assert(buckedView.body.includes("Material: Bucked"), "the bucked lot must show its Material line");
    assert(!buckedView.body.includes("data-bucked-on-site"), "a bucked lot must carry no bucked-on-site question");
    const buckedDry = await req(`/station/unload_dry_space/lot/${guardLotId}/weights`, {
      method: "POST",
      body: form({ weight_grams: "40.00" }),
    });
    assert(buckedDry.status === 303, `bucked dry weight expected 303 got ${buckedDry.status}`);
    // THE OVERISSUE LINE IS STRICT (Patrick 2026-09-11, canon 0.30.37): the
    // guard lot's package holds 90.00 g; dry weights of 40 + 50 land EXACTLY on
    // it, which is the clean case: no standing banner, the ask still strictly
    // greater on the form. The 60 that follows crosses the line and raises it.
    const buckedExact = await req(`/station/unload_dry_space/lot/${guardLotId}/weights`, {
      method: "POST",
      body: form({ weight_grams: "50.00" }),
    });
    assert(buckedExact.status === 303, `bucked exact weight expected 303 got ${buckedExact.status}`);
    const buckedEven = await text(`/station/unload_dry_space?pick=${guardLotId}`);
    assert(buckedEven.body.includes('data-parent-qty="90"'), "the unload add row must carry the 90 g parent");
    assert(buckedEven.body.includes('data-recorded-total="90"'), "the recorded total must read exactly 90");
    assert(!buckedEven.body.includes("data-overissue-banner"), "landing exactly on the parent must raise no banner");
    assert(!buckedEven.body.includes("Over issued by"), "landing exactly on the parent is not an over issue");
    assert(buckedEven.body.includes("typed() + recorded > parent + 0.005"), "the weights ask must be strictly greater");
    const buckedOver = await req(`/station/unload_dry_space/lot/${guardLotId}/weights`, {
      method: "POST",
      body: form({ weight_grams: "60.00" }),
    });
    assert(buckedOver.status === 303, `bucked overissue weight expected 303 got ${buckedOver.status}`);
    const buckedWarned = await text(`/station/unload_dry_space?pick=${guardLotId}`);
    assert(buckedWarned.body.includes("data-overissue-banner") || buckedWarned.body.includes("Over issued by"), "over issue must raise the standing banner");
    assert(buckedWarned.body.includes("data-parent-qty"), "add row must know the parent qty");
    const invBeforeBucked = await text("/inventory");
    const buckedFinish = await finishUnloadLot(guardLotId, {}, "queue_adjust");
    assert(buckedFinish.gated, "bucked over issue must open the over-issue gate");
    assert(
      buckedFinish.gateBody.includes("data-gate-kind=\"over\"") ||
        buckedFinish.gateBody.includes("Queue an adjustment CSV"),
      "over-issue gate must offer Queue an adjustment CSV"
    );
    const afterBucked = await text("/inventory");
    // Canon 0.30.73: the Arlington Dry Room is a silo, so its unload follows the
    // silo law: the harvest package itself takes the dry total (150 g) and the
    // adjustment pends; no -B child is minted for a silo lot.
    assert(
      (afterBucked.body.match(/-B/g) || []).length === (invBeforeBucked.body.match(/-B/g) || []).length,
      "a silo unload must mint no -B child"
    );
    assert(afterBucked.body.includes("150 g"), "the silo unload must set the harvest package to its 150 g dry total");
    const uploadsPkg = await text("/admin/uploads");
    assert(
      uploadsPkg.body.includes("Packages from Harvests") || uploadsPkg.body.includes("Package Adjustments"),
      "unload finishes must pend package files"
    );
    assert(!uploadsPkg.body.includes("Package finish"), "no package_finish pends once the choice is gone (canon 0.30.1 fork 7)");
    assert(uploadsPkg.body.includes("Package Adjustments"), "queue_adjust must pend an adjustment");

    // Owner bug report 2026-09-08 (canon 0.30.5): Mark uploaded works on a
    // pending package file, the marked row leaves the list, and the retired
    // package_finish lane answers 404.
    const pkgMarkMatch = uploadsPkg.body.match(/action="\/admin\/uploads\/package_adjust\/([a-f0-9-]{36})\/uploaded"/);
    assert(pkgMarkMatch, "uploads page missing a package_adjust mark form");
    // THE TAG LAW (canon 0.30.38): the adjustment file prints the package's
    // METRC tag in its Label column now that Finish lot captured it; the bucked
    // child (-B) has none yet, so the export home marks the batch.
    const adjustCsv = await text(`/admin/uploads/package_adjust/${pkgMarkMatch[1]}.csv`);
    assert(adjustCsv.body.includes(GUARD_TAG), "the adjustment file must print the METRC tag as its Label");
    // (Canon 0.30.73: no -B child exists for the silo lot, so the "no METRC tag
    // yet" mark that the bucked-hang child used to raise is not owed here.)
    const pkgMark = await req(`/admin/uploads/package_adjust/${pkgMarkMatch[1]}/uploaded`, { method: "POST", body: form({}) });
    assert(pkgMark.status === 303, `package adjust mark expected 303 got ${pkgMark.status}`);
    const afterPkgMark = await text("/admin/uploads");
    assert(
      !afterPkgMark.body.includes(`/admin/uploads/package_adjust/${pkgMarkMatch[1]}/uploaded`),
      "a marked package file must leave the pending list"
    );
    const finishGone = await req("/admin/uploads/package_finish/00000000-0000-4000-8000-000000000000.csv");
    assert(finishGone.status === 404, `the package_finish lane must be gone (fork 7), got ${finishGone.status}`);
    // A voided lot pends nothing: the list and the mark read one predicate.
    const pendBeforeVoid = await text("/admin/uploads");
    const voidGuardLot = await req(`/record/wet_weight_entries/${guardLotId}/void`, {
      method: "POST",
      body: form({ reason: "smoke: void a lot with a pending package file" }),
    });
    assert(voidGuardLot.status === 303, `voiding the guard lot expected 303 got ${voidGuardLot.status}`);
    const pendAfterVoid = await text("/admin/uploads");
    assert(
      (pendAfterVoid.body.match(/Package Adjustments/g) || []).length <= (pendBeforeVoid.body.match(/Package Adjustments/g) || []).length,
      "voiding a lot must never add pending package rows"
    );
    assert(!pendAfterVoid.body.includes("Unknown"), "the uploads page must render clean after a void");

    const menu = await text("/compliance");
    assert(menu.res.status === 200, `GET /compliance expected 200 got ${menu.res.status}`);
    assert(menu.body.includes("data-compliance-kpis"), "compliance menu missing KPI tiles");
    assert(menu.body.includes("Lbs in testing"), "compliance menu missing lbs tile");
    const extStart = await req("/compliance/audits/start", {
      method: "POST",
      body: form({ kind: "external", agency: "CRA Smoke", agency_contact: "Lee", grip_rep: "Smoke" }),
    });
    assert(extStart.status === 303, `start external audit expected 303 got ${extStart.status}`);
    const extLoc = new URL(extStart.headers.get("location") || "", base);
    const extId = extLoc.searchParams.get("audit");
    if (!extId) fail("start external audit", "no audit id");
    const note1 = await req(`/compliance/audits/${extId}/notes`, {
      method: "POST",
      body: form({ body: "ride along one", rapid_add: "1" }),
    });
    assert(note1.status === 303, `audit note expected 303 got ${note1.status}`);
    assert((note1.headers.get("location") || "").includes("rapid=1"), "audit note plus must keep rapid focus");
    const midNotes = await text(`/compliance/audits?kind=external&audit=${extId}`);
    assert(midNotes.body.includes("ride along one"), "open audit missing the committed note");
    assert(midNotes.body.includes("Ride along notes"), "external audit missing Remediate notes");
    const note2 = await req(`/compliance/audits/${extId}/notes`, {
      method: "POST",
      body: form({ body: "ride along two" }),
    });
    assert(note2.status === 303, `second audit note expected 303 got ${note2.status}`);
    const finishExt = await req(`/compliance/audits/${extId}/finish`, { method: "POST", body: form({}) });
    assert(finishExt.status === 303, `finish audit expected 303 got ${finishExt.status}`);
    const extReport = await text("/reports/external_audits");
    assert(extReport.res.status === 200, `GET /reports/external_audits expected 200 got ${extReport.res.status}`);
    assert(extReport.body.includes("CRA Smoke"), "external audits report missing the finished agency");
    assert(extReport.body.includes("ride along one"), "external audits report missing expanded notes");
    assert(extReport.body.includes("format=csv"), "external audits report missing CSV");
    assert(extReport.body.includes("format=xlsx"), "external audits report missing XLSX");
    assert(extReport.body.includes("format=pdf"), "external audits report missing PDF");
    const rfPage = await text("/reports/rf");
    assert(rfPage.body.includes("RF report: reserved"), "RF page must name the open question");
    assert(!rfPage.body.includes("format-bar"), "RF reserved page must hide the format bar");

    const tpl = await req("/compliance/labels/templates", {
      method: "POST",
      body: form({
        name: "Smoke 4x6",
        stock: "4x6",
        barcode_mode: "1d",
        field: ["package_tag", "tag_barcode"],
      }),
    });
    assert(tpl.status === 303, `label template expected 303 got ${tpl.status}`);
    const labels = await text("/compliance/labels");
    const tplId = optionValue(labels.body, "Smoke 4x6");
    const labelPkgId = firstSelectValue(labels.body, "package");
    const printed = await text(`/compliance/labels/print?template=${encodeURIComponent(tplId)}&package=${encodeURIComponent(labelPkgId)}`);
    assert(printed.res.status === 200, `label print expected 200 got ${printed.res.status}`);
    assert(printed.body.includes("@page { size: 101.6mm 152.4mm; margin: 0; }"), "label print must size the 4x6 stock");
    assert(printed.body.includes("<svg"), "label print must carry a barcode svg");

    const opBytes = new TextEncoder().encode("Sample,Date,THC\nHBN-SMOKE,2026-09-04,21.5\n");
    const opForm = new FormData();
    opForm.append("source", "orange_photonics");
    opForm.append("file", new File([opBytes], "op-smoke.csv", { type: "text/csv" }));
    const opDrop = await req("/compliance/testing/internal", { method: "POST", body: opForm });
    assert(opDrop.status === 303, `OP drop expected 303 got ${opDrop.status}`);
    assert((opDrop.headers.get("location") || "").includes("ok=parsed"), "OP drop must flash parsed");
    const awBytes = new TextEncoder().encode("Package,Date,aW\nHBN-SMOKE,2026-09-04,0.52\n");
    const awForm = new FormData();
    awForm.append("source", "aqualab");
    awForm.append("file", new File([awBytes], "aw-smoke.csv", { type: "text/csv" }));
    const awDrop = await req("/compliance/testing/internal", { method: "POST", body: awForm });
    assert(awDrop.status === 303, `Aqualab drop expected 303 got ${awDrop.status}`);
    const parsedPage = await text(new URL(awDrop.headers.get("location") || "", base).pathname + new URL(awDrop.headers.get("location") || "", base).search);
    assert(parsedPage.body.includes("Parsed"), "instrument drop must report parsed counts");
    const inTest = await text("/reports/internal_testing");
    assert(inTest.body.includes("HBN-SMOKE"), "internal testing report missing the dropped HBN");
    assert(inTest.body.includes("0.52"), "internal testing report missing aW");
    assert(inTest.body.includes("21.5"), "internal testing report missing potency");

    const extResult = await req("/compliance/testing/external", {
      method: "POST",
      body: form({
        sample_tag: "SMOKE-S1",
        item_name: "Gelato",
        net_weight_grams: "448",
        status: "Failed",
        failure_mode: "Coliforms",
        attempt: "1",
        entered_testing: "2026-09-04",
        reason: "smoke seed",
      }),
    });
    assert(extResult.status === 303, `external result expected 303 got ${extResult.status}`);
    const seededMenu = await text("/compliance");
    assert(seededMenu.body.includes("Coliforms"), "compliance pareto missing the seeded failure mode");
    assert(seededMenu.body.includes("1.00"), "lbs in testing must convert the seeded 448 g");

    const supplier = await req("/purchasing/suppliers", {
      method: "POST",
      body: form({ company_name: "Smoke Supply", main_contact: "Pat", phone: "555-0100" }),
    });
    assert(supplier.status === 303, `add supplier expected 303 got ${supplier.status}`);
    const newPoPage = await text("/purchasing/new");
    const supplierId = optionValue(newPoPage.body, "Smoke Supply");
    const poCreate = await req("/purchasing/new", {
      method: "POST",
      body: form({ name: "Smoke harvest", po_class: "23H", project: "walk", farm: "PNN", supplier_id: supplierId }),
    });
    assert(poCreate.status === 303, `create PO expected 303 got ${poCreate.status}`);
    const poPath = poCreate.headers.get("location") || "";
    assert(poPath.includes("/purchasing/po/"), "create PO must land on the PO page");
    const lineAdd = await req(`${poPath}/lines`, {
      method: "POST",
      body: form({ item_code: "GLV", description: "gloves", uom: "each", qty: "2", unit_price: "3.50" }),
    });
    assert(lineAdd.status === 303, `PO line expected 303 got ${lineAdd.status}`);
    const issued = await req(`${poPath}/issue`, { method: "POST", body: form({}) });
    assert(issued.status === 303, `issue PO expected 303 got ${issued.status}`);
    const closed = await req(`${poPath}/close`, { method: "POST", body: form({ reason: "received" }) });
    assert(closed.status === 303, `close PO expected 303 got ${closed.status}`);
    const evalSave = await req(`${poPath}/eval`, {
      method: "POST",
      body: form({ eval_quality: "8", eval_documents: "7", eval_timing: "9", reason: "rubric" }),
    });
    assert(evalSave.status === 303, `PO eval expected 303 got ${evalSave.status}`);
    const poView = await text(poPath);
    assert(poView.body.includes("PO-PNN-"), "PO page missing the minted number");
    assert(poView.body.includes("Supplier evaluation"), "closed PO missing the eval");
    assert(poView.body.includes("$7.00"), "PO page missing the cents total");

    const marketForm = await text("/marketplace?pane=listings");
    assert(marketForm.body.includes('name="qty_grams"'), "listing form must take grams");
    assert(!marketForm.body.includes('name="qty_lbs"'), "listing form must not take lbs");
    assert(!marketForm.body.includes('name="package_tag"'), "listing form must not take a tag select");
    const liveItem = firstSelectValue(marketForm.body, "package_item_id");
    const listingAdd = await req("/marketplace/listings", {
      method: "POST",
      body: form({
        item_name: "Gelato",
        package_item_id: liveItem,
        package_label: "Gelato bag",
        category: "Flower",
        qty_grams: "999999",
      }),
    });
    assert(listingAdd.status === 303, `add listing expected 303 got ${listingAdd.status}`);
    const listings = await text("/marketplace?pane=listings");
    assert(listings.body.includes("Not matching"), "oversized listing must read Not matching");
    assert(listings.body.includes("999,999 g"), "listing table must show grams");
    assert(listings.body.includes("2,232.14"), "listing table must show calculated lbs");
    assert(listings.body.includes("Flower"), "listing table must show category");
    const splitParent = firstSelectValue(listings.body, "split");
    const splitPick = await text(`/marketplace?pane=listings&split=${splitParent}`);
    assert(splitPick.body.includes("Child quantity grams"), "split parent page missing the child qty");
    const splitSave = await req("/marketplace/split", {
      method: "POST",
      body: form({ parent_item_id: splitParent, child_qty_grams: "10" }),
    });
    assert(splitSave.status === 303, `split expected 303 got ${splitSave.status}`);
    const splitAfter = await text(splitSave.headers.get("location") || "/marketplace?pane=listings");
    assert(splitAfter.body.includes("-S1"), "split child code must render on the marketplace page");
    const splitUploads = await text("/admin/uploads");
    assert(splitUploads.body.includes("Splits"), "uploads must show the Splits section");
    assert(splitUploads.body.includes("package_split_"), "uploads must pend the package_split file");
    const splitHref = (splitUploads.body.match(/href="(\/admin\/uploads\/package_split\/[^"]+\.csv)"/) || [])[1];
    assert(splitHref, "missing package_split download href");
    const splitCsv = await text(splitHref);
    assert(splitCsv.res.status === 200, `split csv expected 200 got ${splitCsv.res.status}`);
    assert(splitCsv.body.includes("ParentLabel,ChildLabel,Quantity,UnitOfWeight,Date"), "split csv missing the provisional header");
    const splitId = splitHref.replace("/admin/uploads/package_split/", "").replace(".csv", "");
    const splitMark = await req(`/admin/uploads/package_split/${splitId}/uploaded`, { method: "POST", body: form({}) });
    assert(splitMark.status === 303, `mark split uploaded expected 303 got ${splitMark.status}`);
    const splitCleared = await text("/admin/uploads");
    assert(!splitCleared.body.includes(splitHref), "mark uploaded must clear the pending split");
    // The under gate still asks on a short Save (canon 0.30.1 forks 7 and 8).
    const underPick = await text(`/station/trim_packages?pick=${lotId}&gate=1`);
    assert(underPick.body.includes("data-reconcile-gate"), "a short lot must still show the under gate on Save");
    assert(underPick.body.includes("Recorded short of the parent."), "under gate missing its headline");
    assert(underPick.body.includes('name="gate_choice" value="queue_adjust"'), "under gate missing queue adjust");
    assert(!underPick.body.includes("data-remaining-zero"), "a short lot must not prompt Remaining 0");
    const overTrim = await req("/station/trim_packages", {
      method: "POST",
      body: form({
        wet_weight_entry_id: lotId,
        package_code: ["OVER-SMOKE-1"],
        package_type_code: ["TRIM"],
        effective_date: "2026-09-08", effective_pin: ADMIN_PIN,
        trim_operator: "Les",
        weight_grams: ["800.00"],
      }),
    });
    assert(overTrim.status === 303, `overissue trim Save expected 303 got ${overTrim.status}`);
    // Canon 0.30.9 (R6, his words: "when I go over in trim packages entry, I
    // need to be prompted that I'm at 0 and the option provided to remove it
    // from queue."): the Save lands on the picked page, which prompts.
    const overLoc = overTrim.headers.get("location") || "";
    assert(overLoc.includes(`pick=${lotId}`) && !overLoc.includes("gate=1"), `an over Save must land on the picked page, got ${overLoc}`);
    const overPage = await text(`/station/trim_packages?pick=${lotId}`);
    assert(overPage.body.includes('data-remaining-zero data-over="1"'), "past zero the pane must prompt Remaining 0");
    assert(overPage.body.includes("Remaining 0.") && overPage.body.includes("Over by"), "the prompt must say Remaining 0 and name the overage");
    assert(overPage.body.includes("Removing it pends the adjustment CSV at the export home."), "the prompt must promise the adjustment CSV");
    assert(overPage.body.includes('name="gate_choice" value="remove"') && overPage.body.includes(">Remove from queue</button>"), "the prompt must offer Remove from queue");
    assert(!overPage.body.includes("data-reconcile-gate"), "the old over gate must not render beside the prompt");
    const removeIt = await req("/station/trim_packages", {
      method: "POST",
      body: form({ wet_weight_entry_id: lotId, gate_choice: "remove" }),
    });
    assert(removeIt.status === 303, `remove from queue expected 303 got ${removeIt.status}`);
    assert(
      (removeIt.headers.get("location") || "").includes("/station/trim_packages?ok=removed_adjust"),
      "an over remove must land back on the station with the adjustment flash"
    );
    const removedFlash = await text("/station/trim_packages?ok=removed_adjust");
    assert(removedFlash.body.includes("Removed from the queue. The adjustment CSV pends at the export home."), "the remove must flash its line");
    const afterAdjust = await text("/admin/uploads");
    assert(afterAdjust.body.includes("package_adjust"), "an over remove must pend the adjustment at uploads");
    const trimGone = await text("/station/trim_packages");
    assert(!trimGone.body.includes(lotId), "the remove must finish the trim and leave the pane");
    const trimAuto = await text("/production/scheduling/trim");
    assert(
      new RegExp(`data-schedule-pane="complete"[\\s\\S]{0,8000}${shortId}`).test(trimAuto.body),
      "remove from queue must auto-complete the trim schedule row onto the right pane"
    );
    assert(trimAuto.body.includes('name="unfinish_pin"'), "the auto-completed lot must offer a PIN-gated unfinish");
    const staleRemove = await req("/station/trim_packages", {
      method: "POST",
      body: form({ wet_weight_entry_id: lotId, gate_choice: "remove" }),
    });
    assert(staleRemove.status === 400, `a remove on a trimmed lot expected 400 got ${staleRemove.status}`);
    const stalePost = await req("/station/trim_packages", {
      method: "POST",
      body: form({ wet_weight_entry_id: lotId, gate_choice: "queue_finish" }),
    });
    assert(stalePost.status !== 500, "a stale queue_finish post must not crash");
    await stalePost.text();

    // THE TESTING DESK part 1. The lot is trimmed (Remove from queue). Schedule,
    // sample, manifest, a fail, a retest, a remediation, and a pass. No driver
    // name is typed. The console Testing numbers are part 2.
    const savedTestingPin = jar.get("gf_pin");
    jar.delete("gf_pin");
    const testingGated = await text("/testing");
    assert(testingGated.res.status === 401 && testingGated.body.includes("Enter PIN"), "the testing desk must sit behind the Admin PIN");
    jar.set("gf_pin", savedTestingPin);
    const testingDesk = await text("/testing");
    assert(testingDesk.res.status === 200, `GET /testing expected 200 got ${testingDesk.res.status}`);
    assert(testingDesk.body.includes(`data-ready="${lotId}"`), "a trimmed lot with no open order must be ready to schedule");
    assert(testingDesk.body.includes('data-sample-grams="14"'), "the sample size must be the 14 g floor");
    assert(testingDesk.body.includes("Book the pickup in the lab portal."), "the desk must say the pickup is booked in the lab portal");
    assert(!testingDesk.body.includes("over 50 lb") && !testingDesk.body.includes("R 420.304"), "the desk never refuses a batch on weight");
    const scLab = (testingDesk.body.match(/<option value="([^"]+)" data-lab="sc">/) || [])[1];
    assert(scLab, "the lab picker must offer SC Labs");
    const readySlice = testingDesk.body.slice(testingDesk.body.indexOf(`data-ready="${lotId}"`));
    const sourceTagged = readySlice.startsWith(`data-ready="${lotId}"`) && /data-source-tag="1"/.test(readySlice.slice(0, 400));
    const sourcePackage = (readySlice.match(/data-package="([^"]*)"/) || [])[1] || "";
    const scheduleTest = await text("/testing/schedule", {
      method: "POST",
      body: form({ lot_id: lotId, lab_id: scLab, panel: "full_compliance", pickup_date: "2026-09-22" }),
    });
    assert(scheduleTest.res.status === 303, `schedule expected 303 got ${scheduleTest.res.status}`);
    const testOrderId = new URL(scheduleTest.res.headers.get("location") || "", base).searchParams.get("order");
    assert(testOrderId, "schedule must return the order id");
    const testingOpen = await text("/testing");
    assert(!testingOpen.body.includes(`data-ready="${lotId}"`), "an open order must leave the ready list");
    assert(testingOpen.body.includes(`data-sample-order="${testOrderId}"`), "the scheduled order must offer a sample form");
    const scheduleAgain = await text("/testing/schedule", {
      method: "POST",
      body: form({ lot_id: lotId, lab_id: scLab, panel: "full_compliance", pickup_date: "2026-09-22" }),
    });
    assert(scheduleAgain.res.status === 400 && scheduleAgain.body.includes("open test order"), "a second open order on the lot must refuse");
    const badTag = await text("/testing/samples", {
      method: "POST",
      body: form({ order_id: testOrderId, sample_tag: "NOTATAG", net_grams: "14" }),
    });
    assert(badTag.res.status === 400 && badTag.body.includes("METRC tag"), "a sample tag that is not tag-shaped must refuse");
    const sampleTag = "1A4F00000000000000000A01";
    const sampled = await text("/testing/samples", {
      method: "POST",
      body: form({
        order_id: testOrderId,
        sample_tag: sampleTag,
        net_grams: "14",
        sampler_name: "sampler",
        grower_witness: "witness",
        chain_of_custody_ref: "COC-1",
      }),
    });
    assert(sampled.res.status === 303, `sample expected 303 got ${sampled.res.status}`);
    const manifested = await text("/testing/manifests", {
      method: "POST",
      body: form({ lab_id: scLab, manifest_date: "2026-09-22", order_id: testOrderId, route_note: "to the lab" }),
    });
    assert(manifested.res.status === 303, `manifest expected 303 got ${manifested.res.status}`);
    const testManifestId = new URL(manifested.res.headers.get("location") || "", base).searchParams.get("manifest");
    assert(testManifestId, "manifest must return its id");
    const testCsv = await text(`/admin/uploads/test_sample/${testManifestId}.csv`);
    assert(testCsv.res.status === 200, `test sample csv expected 200 got ${testCsv.res.status}`);
    assert(testCsv.body.startsWith("Tag Number,Location Name,Item Name,Use Same Item,"), "the csv must carry the Metrc header");
    assert(testCsv.body.includes(sampleTag) && testCsv.body.includes("In Testing") && testCsv.body.includes(",true,14.00,Grams,"), "the csv row must be the sample, In Testing, true, 14.00 grams");
    if (sourceTagged) assert(testCsv.body.includes("1A"), "a tagged source package must print on the csv");
    else if (sourcePackage) assert(testCsv.body.includes(sourcePackage), "an untagged source must print its package code");
    const worksheet = await text(`/testing/manifests/${testManifestId}/worksheet.csv`);
    assert(worksheet.res.status === 200 && worksheet.body.includes("Testing Transfer (to SCF)"), "the worksheet must name the testing transfer");
    assert(worksheet.body.includes("AU-SC-000129") || worksheet.body.includes("SC-000035"), "the worksheet must carry the lab license for the market");
    const manifestPrint = await text(`/testing/manifests/${testManifestId}`);
    assert(manifestPrint.res.status === 200 && manifestPrint.body.includes(sampleTag) && manifestPrint.body.includes("Testing Transfer (to SCF)"), "the printable manifest must show the sample and the transfer type");
    const testingUploads = await text("/admin/uploads");
    assert(testingUploads.body.includes(`data-test-sample="${testManifestId}"`), "the sample csv must pend at Pending Data Uploads");
    const testingMark = await text(`/admin/uploads/test_sample/${testManifestId}/uploaded`, { method: "POST", body: form({}) });
    assert(testingMark.res.status === 303, `mark test sample uploaded expected 303 got ${testingMark.res.status}`);
    const testingUploadsAfter = await text("/admin/uploads");
    assert(!testingUploadsAfter.body.includes(`data-test-sample="${testManifestId}"`), "mark uploaded must clear the test sample file");
    const testingSent = await text(`/testing/manifests/${testManifestId}/sent`, { method: "POST", body: form({}) });
    assert(testingSent.res.status === 303, `mark sent expected 303 got ${testingSent.res.status}`);
    const testingNumber = await text(`/testing/manifests/${testManifestId}/number`, {
      method: "POST",
      body: form({ metrc_manifest_number: "SMOKE-1" }),
    });
    assert(testingNumber.res.status === 303, `manifest number expected 303 got ${testingNumber.res.status}`);
    const testingFail = await text("/testing/results", {
      method: "POST",
      body: form({
        order_id: testOrderId,
        "passed__microbials": "0",
        "value__microbials": "1",
        "passed__potency": "1",
        "value__potency": "20.1",
        thc_total_pct: "20.1",
        coa_url: "https://lims.tagleaf.com/coa_/smoke",
        lab_sample_id: "ICM-000000-000",
        failure_note: "microbials",
      }),
    });
    assert(testingFail.res.status === 303, `a failing result expected 303 got ${testingFail.res.status}`);
    const testingFailed = await text("/testing");
    assert(testingFailed.body.includes(`data-failed-order="${testOrderId}"`), "a failed order must offer retest and remediation");
    assert(testingFailed.body.includes("R 420.306"), "a failed order must quote the retest rule");
    const testingRetest = await text(`/testing/orders/${testOrderId}/retest`, {
      method: "POST",
      body: form({ pickup_date: "2026-09-23" }),
    });
    assert(testingRetest.res.status === 303, `retest expected 303 got ${testingRetest.res.status}`);
    const retestOrderId = new URL(testingRetest.res.headers.get("location") || "", base).searchParams.get("order");
    assert(retestOrderId && retestOrderId !== testOrderId, "a retest must be a new order");
    const testingRemediate = await text(`/testing/orders/${testOrderId}/remediate`, {
      method: "POST",
      body: form({ reason: "lab hold", cra_approval_ref: "CRA-REF", remediated_date: "2026-09-23" }),
    });
    assert(testingRemediate.res.status === 303, `remediate expected 303 got ${testingRemediate.res.status}`);
    const retestTag = "1A4F00000000000000000A02";
    const retestSample = await text("/testing/samples", {
      method: "POST",
      body: form({ order_id: retestOrderId, sample_tag: retestTag, net_grams: "14", sampler_name: "sampler", grower_witness: "witness" }),
    });
    assert(retestSample.res.status === 303, `retest sample expected 303 got ${retestSample.res.status}`);
    const retestManifest = await text("/testing/manifests", {
      method: "POST",
      body: form({ lab_id: scLab, manifest_date: "2026-09-23", order_id: retestOrderId, route_note: "to the lab" }),
    });
    assert(retestManifest.res.status === 303, `retest manifest expected 303 got ${retestManifest.res.status}`);
    const retestManifestId = new URL(retestManifest.res.headers.get("location") || "", base).searchParams.get("manifest");
    assert(retestManifestId, "the retest manifest must return its id");
    const retestSent = await text(`/testing/manifests/${retestManifestId}/sent`, { method: "POST", body: form({}) });
    assert(retestSent.res.status === 303, `retest sent expected 303 got ${retestSent.res.status}`);
    const retestNumber = await text(`/testing/manifests/${retestManifestId}/number`, {
      method: "POST",
      body: form({ metrc_manifest_number: "SMOKE-2" }),
    });
    assert(retestNumber.res.status === 303, `retest number expected 303 got ${retestNumber.res.status}`);
    const testingPass = await text("/testing/results", {
      method: "POST",
      body: form({
        order_id: retestOrderId,
        "passed__microbials": "1",
        "passed__potency": "1",
        "value__potency": "20.1",
        thc_total_pct: "20.1",
        lab_sample_id: "ICM-000000-001",
      }),
    });
    assert(testingPass.res.status === 303, `a passing result expected 303 got ${testingPass.res.status}`);
    const testingDone = await text("/testing");
    assert(testingDone.body.includes(`data-closed-order="${retestOrderId}"`) && testingDone.body.includes('data-order-status="passed"'), "the retest must close as passed");
    assert(testingDone.body.includes(`data-order-status="remediated"`), "the first order must close as remediated");
    assert(testingDone.body.includes(`data-ready="${lotId}"`), "a passed lot with no open order is ready again");
    const testingLabs = await text("/admin/lookups/testing_labs");
    assert(testingLabs.res.status === 200, `testing labs expected 200 got ${testingLabs.res.status}`);
    assert(testingLabs.body.includes("SC Labs Michigan") && testingLabs.body.includes("AU-SC-000129"), "SC Labs must be editable with its adult-use license");
    assert(testingLabs.body.includes("ACT Laboratories") && testingLabs.body.includes("SC-000048"), "ACT must carry its med license");
    assert(testingLabs.body.includes('data-lab-row="viridis"') && testingLabs.body.includes('data-active="0"'), "Viridis must stay on the list and inactive");
    assert(!testingLabs.body.includes('name="driver_name"'), "the labs page must not carry a driver field");
    const adminTestingTile = await text("/admin");
    assert(adminTestingTile.body.includes('href="/testing"') && adminTestingTile.body.includes("Testing desk"), "Admin must carry the Testing desk tile");

    const orderPage = await text("/marketplace?pane=orders");
    const listPick = optionValue(orderPage.body, "Gelato");
    const soCreate = await req("/marketplace/orders", {
      method: "POST",
      body: form({ buyer: "Leaf buyer", listing_id: listPick, qty_grams: "1" }),
    });
    assert(soCreate.status === 303, `create SO expected 303 got ${soCreate.status}`);
    const soPath = soCreate.headers.get("location") || "";
    const confirm = await req(`${soPath}/status`, { method: "POST", body: form({ status: "confirmed", reason: "ok" }) });
    assert(confirm.status === 303, `confirm SO expected 303 got ${confirm.status}`);
    const fulfill = await req(`${soPath}/status`, { method: "POST", body: form({ status: "fulfilled", reason: "shipped" }) });
    assert(fulfill.status === 303, `fulfill SO expected 303 got ${fulfill.status}`);
    const soStatus = await text("/reports/sales_orders");
    assert(soStatus.body.includes("Leaf buyer"), "SO Status report must read the marketplace order");
    assert(soStatus.body.includes("fulfilled"), "SO Status report missing fulfilled");

    // Canon 0.30.36: Mount Zoho Inventory onto the marketplace. Owner question,
    // 2026-09-09: "Is there a place in the app that I can drop current Zoho
    // inventory and it will update the offerings on the marketplace?" and his
    // answers: the Items export is the file; "If zoho is using  each, it's
    // weight, if it's oz or g, show that as "market-facing UOM" and actual
    // weight in grams - Lbs = 448 grams"; "Zoho should show a SKU, that's
    // usually the METRC package ID"; "Dropping a new inventory should correct it".
    const zohoPane0 = await text("/marketplace?pane=zoho");
    assert(zohoPane0.res.status === 200, `zoho pane expected 200 got ${zohoPane0.res.status}`);
    assert(zohoPane0.body.includes('data-tab="zoho"'), "the marketplace must carry the Zoho tab");
    // THE SALESHELPER TAB (canon 0.30.45): the fourth tab and its pane framing
    // the vendored form; the frame's own page still answers under the PIN.
    assert(zohoPane0.body.includes('data-tab="saleshelper"'), "the marketplace must carry the SalesHelper tab");
    const shPane = await text("/marketplace?pane=saleshelper");
    assert(shPane.res.status === 200, `saleshelper pane expected 200 got ${shPane.res.status}`);
    assert(shPane.body.includes('data-marketplace-saleshelper') && shPane.body.includes('<iframe class="saleshelper-frame" src="/fulfillment/saleshelper/app"'), "the SalesHelper pane must frame the form");
    assert(shPane.body.includes('data-tab="saleshelper" aria-current="page"'), "the SalesHelper tab must read as the current one");
    // THE SALESHELPER PANE SCROLLBARS (canon 0.30.49): the frame fitted to the
    // viewport under the tabs so the page's own scrollbar steps aside.
    assert(shPane.body.includes('document.querySelector("[data-marketplace-saleshelper] iframe")') && shPane.body.includes('Math.max(480, Math.floor(room)) + "px"'), "the SalesHelper pane must carry the fit script");
    const shApp = await req("/fulfillment/saleshelper/app");
    assert(shApp.status === 200, `the framed form expected 200 got ${shApp.status}`);
    assert(zohoPane0.body.includes("data-zoho-mount-form"), "the Zoho pane must carry the mount form");
    assert(zohoPane0.body.includes("data-zoho-none"), "an unmounted Zoho pane must say so");
    const notItems = new FormData();
    notItems.append("file", new File([new TextEncoder().encode("Plant,Weight\r\nA,1\r\n")], "wet.csv", { type: "text/csv" }));
    const notItemsRes = await req("/marketplace/zoho", { method: "POST", body: notItems });
    assert(notItemsRes.status === 400, `a non-Items file expected 400 got ${notItemsRes.status}`);
    // The real export's 68 columns, in its order; the rows are synthetic.
    const itemsHeader = ["Item ID", "Created Time", "Last Modified Time", "Item Name", "Sales Description", "Selling Price", "Sales Account", "Is Returnable Item", "Brand", "Manufacturer", "Package Weight", "Package Length", "Package Width", "Package Height", "Dimension Unit", "Weight Unit", "Is Receivable Service", "Taxable", "Exemption Reason", "Product Type", "Source", "Reference ID", "Last Sync Time", "Status", "Unit", "Unit Name", "SKU", "UPC", "EAN", "ISBN", "Part Number", "Purchase Price", "MRP", "Purchase Account", "Purchase Description", "Inventory Account", "Inventory Valuation Method", "TrackSerialNumber", "Reorder Level", "Preferred Vendor", "Location Name", "Opening Stock", "Opening Stock Value", "Stock On Hand", "Is Combo Product", "Enable Bin Tracking", "Item Type", "Sellable", "Purchasable", "Track Inventory", "Product Name", "Item Description", "AttributeName1", "AttributeName2", "AttributeName3", "AttributeOption1", "AttributeOption2", "AttributeOption3", "Category Name", "Parent Category", "Serial Numbers", "Bin Name", "Bin Quantity", "CF.THC %", "CF.Product Quality", "CF.Product Sub", "CF.Location Code", "CF.Source Harvest"];
    const zohoItemRow = (o) => {
      const base = { "Product Type": "goods", "Item Type": "Inventory", Status: "Active", Sellable: "true", "Track Inventory": "true", "Weight Unit": "lb", "Location Name": "Head Office" };
      const r = { ...base, ...o };
      return itemsHeader.map((h) => r[h] ?? "");
    };
    const itemsCsv = (rows) =>
      [itemsHeader, ...rows].map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\r\n") + "\r\n";
    const SKU_BULK = "1A40503000311FB000028138";
    const SKU_PRE = "1A40503000311FB000051831";
    const SKU_MOB = "1A40503000311FB000052749";
    const SKU_OIL = "1A40503000308F5000047817";
    const zohoItems = (variant) => {
      const rows = [
        zohoItemRow({ "Item ID": "101", "Item Name": "BUD - Donny Burger - PNS - O - 22.1%", "Selling Price": "USD 175.00", SKU: SKU_BULK, "Stock On Hand": variant === "later" ? "0.75" : "0.5", "CF.THC %": "22.100000", "CF.Product Sub": "Bulk Flower Outdoor", "CF.Location Code": "24.2.A" }),
        zohoItemRow({ "Item ID": "102", "Item Name": "PRE - Applescotti - PNN - O - 20.77%", "Selling Price": "USD 12.50", SKU: SKU_PRE, "Stock On Hand": variant === "later" ? "0" : "80", "CF.THC %": "20.770000", "CF.Product Sub": "Prepack Ounces", "CF.Location Code": "P4.1.B" }),
        zohoItemRow({ "Item ID": "103", "Item Name": "MOB - Apple Jack - PNN - O - 25.42%", "Selling Price": "USD 31.25", SKU: SKU_MOB, "Stock On Hand": "32.0000", "CF.THC %": "25.420000", "CF.Product Sub": "Max Out Bags", "Location Name": "PNN", "CF.Location Code": "P8.2.B" }),
        zohoItemRow({ "Item ID": "105", "Item Name": "GRIP Vape - Berry Mojito - 2g", "Selling Price": "USD 7.00", SKU: "GRIP Vape - Berry Mojito - 2g", "Stock On Hand": "17650.0000", "CF.Product Sub": "Vape/Cart", "Location Name": "Oxford N", "CF.Location Code": "Oxford N" }),
        zohoItemRow({ "Item ID": "106", "Item Name": "Bow House Distillate - 83.625%", "Selling Price": "USD 1000.00", Unit: "Liters", SKU: SKU_OIL, "Stock On Hand": "94.6010", "CF.THC %": "83.625000", "CF.Product Sub": "Concentrate" }),
        zohoItemRow({ "Item ID": "107", "Item Name": "MIX - Old - PNN - O - 20%", SKU: "1A40503000311FB000000107", "Stock On Hand": "0.02", Status: "Inactive", "CF.Product Sub": "Bulk Flower" }),
        zohoItemRow({ "Item ID": "108", "Item Name": "MIX - Empty - PNN - O - 21%", SKU: "1A40503000311FB000000108", "Stock On Hand": "0.0000", "CF.Product Sub": "Bulk Flower" }),
        zohoItemRow({ "Item ID": "109", "Item Name": "Bud - Placeholder", SKU: "2", "Stock On Hand": "1000000000008.0000", "Selling Price": "USD 420.00", "CF.Product Sub": "Bulk Flower", "Location Name": "Elsewhere", "CF.Location Code": "0.0.Z" }),
        // The same package at a second bin folds into one offering.
        zohoItemRow({ "Item ID": "110", "Item Name": "BUD - Donny Burger - PNS - O - 22.1%", "Selling Price": "USD 175.00", SKU: SKU_BULK, "Stock On Hand": "0.25", "CF.THC %": "22.100000", "CF.Product Sub": "Bulk Flower Outdoor", "CF.Location Code": "24.2.B" }),
      ];
      if (variant !== "later") {
        rows.splice(3, 0, zohoItemRow({ "Item ID": "104", "Item Name": "IPR - Orange Crush 1.2g", "Selling Price": "USD 1.50", Unit: "Each", SKU: "Infused Pre-Rolls - Orange Crush 1.2g", "Stock On Hand": "712.0000", "CF.Product Sub": "Infused Pre-Rolls", "CF.Location Code": "North Wall" }));
      }
      return rows;
    };
    const zohoMount = new FormData();
    zohoMount.append("file", new File([new TextEncoder().encode(itemsCsv(zohoItems("first")))], "Item.csv", { type: "text/csv" }));
    const zohoMounted = await req("/marketplace/zoho", { method: "POST", body: zohoMount });
    assert(zohoMounted.status === 303, `zoho mount expected 303 got ${zohoMounted.status}: ${(await zohoMounted.text()).slice(0, 300)}`);
    const zohoLoc = zohoMounted.headers.get("location") || "";
    assert(zohoLoc.endsWith("/marketplace?pane=zoho&ok=mounted&added=6&updated=0&unlisted=0"), `zoho mount must land on the pane with its counts, got ${zohoLoc}`);

    // THE SALESHELPER LIVE MENU (canon 0.30.47): after the mount, menu.json is
    // the static re-lined from the mounted items by the SalesHelper's own rules
    // (builtAt first, the mount's time; the base's prices and people kept), and
    // the served form's header reads Inventory updated with the mount's time.
    const menuLive = await req("/fulfillment/saleshelper/menu.json");
    assert(menuLive.status === 200 && menuLive.headers.get("x-gf-menu") === "zoho-mount", `menu.json after the mount must be built from it, got ${menuLive.status} ${menuLive.headers.get("x-gf-menu")}`);
    const menuLiveText = await menuLive.text();
    assert(/^\{"builtAt":"20\d\d-\d\d-\d\dT/.test(menuLiveText) && !menuLiveText.startsWith(`{"builtAt":"${SH_STATIC.builtAt}"`), "the live menu's builtAt must be first and the mount's time (the mount is newer than the static)");
    const menuLiveObj = JSON.parse(menuLiveText);
    // canon 0.30.65: builtAt is the later of the static's build and the mount
    // (here the mount, minutes old); dataAsOf is always the mount, the drop.
    assert(menuLiveObj.dataAsOf === menuLiveObj.builtAt && menuLiveObj.dataAsOf > SH_STATIC.builtAt, "the live menu's data age is the mount's time, newer than the static");
    assert(menuLiveObj.sourceFile === "zoho mount Item.csv (gripfactory lite)", `sourceFile must name the mount, got ${menuLiveObj.sourceFile}`);
    assert(menuLiveObj.baseBuiltAt === SH_STATIC.builtAt, "the live menu must remember the base it was built on");
    assert(JSON.stringify(menuLiveObj.types) === JSON.stringify(["PRE", "BUD", "MOB", "VAPE", "IPR"]), `the live types must follow the canon order, got ${JSON.stringify(menuLiveObj.types)}`);
    const liveKeys = menuLiveObj.lines.map((l) => l.key);
    assert(JSON.stringify(liveKeys) === JSON.stringify(["PRE|applescotti|O|20", "BUD|donny burger|O|22", "MOB|apple jack|O|25", "VAPE|berrymojito2g", "IPR|orangecrush12g"]), `the live lines must be the mounted items collapsed, got ${JSON.stringify(liveKeys)}`);
    const budLine = menuLiveObj.lines.find((l) => l.key === "BUD|donny burger|O|22");
    assert(budLine.available === 0.75 && budLine.pkgs.length === 1 && budLine.pkgs[0].sku === SKU_BULK && budLine.unit === "wt" && budLine.label === "Donny Burger \u00b7 Outdoor", `the BUD line must carry the folded 0.75 under its tag, got ${JSON.stringify(budLine)}`);
    // canon 0.30.65 (SalesHelper canon 6): the Zoho selling price rides every live line.
    assert(budLine.price === 175 && budLine.pkgs[0].rate === 175, `the BUD line must carry its Zoho price 175, got ${budLine.price} / ${budLine.pkgs[0].rate}`);
    const preLine = menuLiveObj.lines.find((l) => l.key === "PRE|applescotti|O|20");
    assert(preLine.available === 80 && preLine.unit === "ea" && preLine.thcMin === 20.77, "the PRE line must read 80 eaches at 20.77");
    assert(preLine.price === 12.5, `the PRE line must carry its Zoho price 12.50, got ${preLine.price}`);
    assert(JSON.stringify(menuLiveObj.stats) === JSON.stringify({ packages: 5, menuLines: 5, excluded: 1 }), `the live stats must count 5 packages, 5 lines, 1 excluded (the distillate), got ${JSON.stringify(menuLiveObj.stats)}`);
    assert(menuLiveObj.customers.length > 100 && Object.keys(menuLiveObj.lastPrice).length > 100 && menuLiveObj.salespeople.length >= 1, "the base's customers, prices and salespeople must carry over");
    assert(menuLiveObj.canonVersion === "0.8.0", "the base's canon version carries over");
    const shAppLive = await text("/fulfillment/saleshelper/app");
    const liveHeader = shAppLive.body.match(/<span class="meta"[^>]*>Inventory updated <span data-inventory-time>([A-Z][a-z]{2} \d{1,2}, 20\d\d, \d{1,2}:\d\d [AP]M ET)<\/span> \u00b7 SalesHelper canon v0\.8\.0 \u00b7 OCG Companies<\/span>/);
    assert(liveHeader, "after the mount the form's header must read Inventory updated with the mount's Eastern time inside the inventory-time span");
    {
      // The rolled time is the mount's (made moments ago): one of the last few minutes, in Eastern time.
      const et = (ms) => `${new Date(ms).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET`;
      const recent = new Set(Array.from({ length: 8 }, (_, k) => et(Date.now() - k * 60_000)));
      assert(recent.has(liveHeader[1]), `the header's time must be the mount's (moments ago), got ${liveHeader[1]}`);
    }
    assert(shAppLive.body.includes('data-gf-update href="/marketplace?pane=zoho" target="_top"'), "the Update link stands after the mount");
    const zohoPane1 = await text(zohoLoc.replace(/^https?:\/\/[^/]+/, ""));
    assert(zohoPane1.body.includes("Mounted</b>") || zohoPane1.body.includes("Mounted: 6 added, 0 updated, 0 unlisted."), "the Zoho pane must flash the mount counts");
    assert(zohoPane1.body.includes("Item.csv"), "the mount summary must name the file");
    const zSummary = (zohoPane1.body.match(/data-zoho-summary>([^<]*)/) || [])[1] || "";
    for (const piece of ["10 rows", "6 offered", "1 inactive", "1 without stock", "1 placeholders skipped", "6 added", "0 updated", "0 unlisted"]) {
      assert(zSummary.includes(piece), `mount summary missing "${piece}": ${zSummary}`);
    }
    // The category table: Bulk Flower Outdoor folded to 0.75 lb; eaches by the each.
    assert(/<td>Bulk Flower Outdoor<\/td><td>1<\/td><td>0\.75 lb<\/td>/.test(zohoPane1.body), "the category table must fold the two bins into 0.75 lb");
    assert(/<td>Prepack Ounces<\/td><td>1<\/td><td>80 each<\/td>/.test(zohoPane1.body), "the category table must count prepack ounces by the each");
    assert(/<td>Concentrate<\/td><td>1<\/td><td>94\.601 L<\/td>/.test(zohoPane1.body), "the category table must carry liters as liters");
    // The rows: market-facing UOM with the actual weight beside it (lb = 448 g, oz = 28 g).
    const zRow = (sku) => {
      const at = zohoPane1.body.indexOf(`data-zoho-sku="${sku}"`);
      assert(at !== -1, `zoho pane missing the row for ${sku}`);
      return zohoPane1.body.slice(at, zohoPane1.body.indexOf("</tr>", at));
    };
    assert(zRow(SKU_BULK).includes("<b>0.75 lb</b>") && zRow(SKU_BULK).includes("336 g"), "0.75 lb must read 336 g beside it");
    assert(zRow(SKU_PRE).includes("<b>80 each</b>") && zRow(SKU_PRE).includes("2,240 g"), "80 prepack ounces must read 2,240 g");
    assert(zRow(SKU_MOB).includes("<b>32 each</b>") && zRow(SKU_MOB).includes("2,240 g"), "32 max out bags (2.5 oz) must read 2,240 g");
    assert(zRow("Infused Pre-Rolls - Orange Crush 1.2g").includes("<b>712 each</b>") && zRow("Infused Pre-Rolls - Orange Crush 1.2g").includes("854 g"), "712 pre-rolls at 1.2 g must read 854 g");
    assert(zRow(SKU_OIL).includes("<b>94.601 L</b>") && zRow(SKU_OIL).includes("weight unknown"), "liters carry no weight to state");
    assert(zRow(SKU_OIL).includes('data-match="zoho"'), "a liters row with 0 g must not match a tag the ledger never saw");
    assert(zRow(SKU_BULK).includes("USD 175.00") && zRow(SKU_BULK).includes("22.1%") && zRow(SKU_BULK).includes("Head Office / 24.2.A"), "a row must carry price, THC and location");
    assert(zRow(SKU_BULK).includes('data-match="zoho"') && zRow(SKU_BULK).includes("Zoho only"), "a SKU our ledger has never seen reads Zoho only");
    assert(!zohoPane1.body.includes("Bud - Placeholder"), "a placeholder row must not be offered");
    assert(!zohoPane1.body.includes("MIX - Old"), "an inactive row must not be offered");
    // The Listings pane keeps the hand-entered rows and points at the Zoho pane.
    const listingsAfterZoho = await text("/marketplace?pane=listings");
    assert(listingsAfterZoho.body.includes('data-zoho-offerings="6"'), "the Listings pane must count the Zoho offerings");
    assert(listingsAfterZoho.body.includes("Gelato"), "the hand-entered listing must stay on the Listings pane");
    assert(!listingsAfterZoho.body.includes(SKU_BULK), "Zoho rows must not join the hand-entered table");
    // The order pick offers the Zoho rows too, grouped by category.
    const ordersAfterZoho = await text("/marketplace?pane=orders");
    assert(ordersAfterZoho.body.includes('<optgroup label="Zoho: Prepack Ounces">'), "the order pick must group the Zoho offerings by category");
    assert(ordersAfterZoho.body.includes(`PRE - Applescotti - PNN - O - 20.77% ${SKU_PRE}`), "the order pick must name the Zoho offering with its SKU");
    // A newer export corrects the offerings: quantities move, gone rows unlist.
    const zohoRemount = new FormData();
    zohoRemount.append("file", new File([new TextEncoder().encode(itemsCsv(zohoItems("later")))], "Item (2).csv", { type: "text/csv" }));
    const zohoRemounted = await req("/marketplace/zoho", { method: "POST", body: zohoRemount });
    assert(zohoRemounted.status === 303, `zoho remount expected 303 got ${zohoRemounted.status}`);
    const remountLoc = zohoRemounted.headers.get("location") || "";
    assert(remountLoc.endsWith("added=0&updated=4&unlisted=2"), `remount counts wrong: ${remountLoc}`);
    const zohoPane2 = await text("/marketplace?pane=zoho");
    const zRow2 = (sku) => {
      const at = zohoPane2.body.indexOf(`data-zoho-sku="${sku}"`);
      return at === -1 ? "" : zohoPane2.body.slice(at, zohoPane2.body.indexOf("</tr>", at));
    };
    assert(zRow2(SKU_BULK).includes("<b>1 lb</b>") && zRow2(SKU_BULK).includes("448 g"), "the remount must move the bulk row to 1 lb, 448 g");
    assert(zRow2(SKU_PRE) === "", "a row at zero stock must leave the offerings");
    assert(zohoPane2.body.includes('data-zoho-gone="2"'), "the pane must list the two rows gone from Zoho");
    assert(zohoPane2.body.includes("IPR - Orange Crush 1.2g"), "the gone list must name the removed pre-roll");
    const listingsAfterRemount = await text("/marketplace?pane=listings");
    assert(listingsAfterRemount.body.includes('data-zoho-offerings="4"'), "the Listings pane must count four Zoho offerings after the remount");
    assert(listingsAfterRemount.body.includes("Gelato"), "the hand-entered listing must survive the remount");

    // Canon 0.22.0 walk: crew feedback (market strain, planned vs actual,
    // simple wet queue items, inbound trucks on Receiving).
    const acquire220 = await text("/station/acquire_hbn");
    assert(acquire220.body.includes('name="market_strain"'), "acquire missing market_strain");
    assert(acquire220.body.includes("Silo # (planned, optional)"), "acquire silo label must say planned, optional");
    assert(acquire220.body.includes("Start Time (planned, optional, 24h)"), "acquire start label must say planned");
    // THE LOADING SILO (canon 0.30.81): this ARL HBN plans Silo 5; under THE
    // BLANK SLATE (canon 0.30.108) its lot weighs into Silo 5 and its package is
    // born in PNN's barn at finish, so Silo 5 reads loading at once.
    const mk = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({
        entry_date: "2026-09-04",
        farm_code: "ARL",
        grow_method_code: "GH",
        strain_id: optionValue(acquire220.body, "Fruity Pebbles"),
        market_strain: "Rainbow Candies",
        planned_dryspc: "5",
      }),
    });
    assert(mk.status === 303, `market-strain acquire expected 303 got ${mk.status}`);
    const mkBatch = new URL(mk.headers.get("location") || "", base).searchParams.get("minted");
    assert(mkBatch, "no minted HBN for the market-strain batch");
    const wet220 = await text("/station/wet_weight");
    assert(/\d+\. ARL \/ /.test(wet220.body), "wet queue rows must read 'N. Farm / Strain / Date'");
    assert(!wet220.body.includes(`>${mkBatch}</a>`), "wet queue rows must not read the raw HBN");
    // The pane reads Farm / Strain / Date; walk the ARL rows to the minted HBN
    // (its picked page names the HBN muted).
    let pick220 = null;
    for (const m of wet220.body.matchAll(/\?pick=([a-f0-9-]{36})">\d+\. ARL \//g)) {
      const page = await text(`/station/wet_weight?pick=${m[1]}&new=1`);
      if (page.body.includes(`<p class="muted">${mkBatch}</p>`)) {
        pick220 = page;
        break;
      }
    }
    assert(pick220, `the wet pane must list the minted ARL HBN ${mkBatch}`);
    const batchId220 = (pick220.body.match(/name="harvest_batch_id" value="([a-f0-9-]{36})"/) || [])[1];
    assert(batchId220, "no picked batch id for the 0.22.0 walk");
    // Owner ruling 2026-09-07 (canon 0.29.1): the spear/buck toggle lives on
    // the wet weight entry screen, spear checked as the one-tap default; a
    // value outside spear/bucked refuses in words.
    assert(
      pick220.body.includes('name="material_form" value="spear" checked'),
      "the wet weight header must carry the Spear/Bucked toggle, spear checked"
    );
    assert(
      pick220.body.includes('name="material_form" value="bucked"'),
      "the wet weight header must offer Bucked"
    );
    const silo5Id = drySpaceIdByName(lookupsPage.body, "Silo 5");
    // The ARL HBN's Move To offers PNN's Silo 5 (the planned one) among the landing site's spaces.
    assert(pick220.body.includes(`<option value="${silo5Id}">Silo 5</option>`), "PNN's Silo 5 must be offered to the ARL HBN");
    const badForm = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        harvest_batch_id: batchId220,
        actual_dryspc: silo5Id,
        team_lead: "Smoke Lead",
        material_form: "silo",
        notes: "bad form",
      }),
    });
    assert(badForm.status === 400, `a garbage material form expected 400 got ${badForm.status}`);
    const start220 = await req(`/station/wet_weight`, {
      method: "POST",
      body: form({
        harvest_batch_id: batchId220,
        actual_dryspc: silo5Id,
        actual_start_time: "06:45",
        team_lead: "Smoke Lead",
        notes: "0.22.0 walk",
      }),
    });
    assert(start220.status === 303, `Silo 5 lot start expected 303 got ${start220.status}`);
    const lotPath220 = start220.headers.get("location") || "";
    const lotId220 = new URL(lotPath220, base).searchParams.get("lot");
    assert(lotId220, "no lot id for the 0.22.0 walk");
    const w220 = await req(`/station/wet_weight/lot/${lotId220}/weights`, { method: "POST", body: form({ weight_grams: "1500.00" }) });
    assert(w220.status === 303, `0.22.0 weight expected 303 got ${w220.status}`);
    // The report folds a location's product type into one row, so the barn's
    // ARL-origin WIP is read before and after the finish.
    const csvRowTotal = (csv, prefix) => {
      const m = csv.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},"?([0-9.,]+)"?,g`, "m"));
      return m ? Number(String(m[1]).replace(/,/g, "")) : 0;
    };
    const invBefore220 = await text("/reports/inventory_by_location?format=csv");
    const barnArlBefore = csvRowTotal(invBefore220.body, "PNN,BARN,ARL,WIP");
    assert(/^PNN,Silo 5,ARL,WET,"1,500",g/m.test(invBefore220.body), `the weighing lot must read WET under Silo 5 with its ARL origin, got\n${invBefore220.body}`);
    const fin220 = await req(`/station/wet_weight/lot/${lotId220}/finish`, { method: "POST", body: form({}) });
    assert(fin220.status === 303, `0.22.0 finish expected 303 got ${fin220.status}`);
    // THE BLANK SLATE (canon 0.30.108): born in PNN's barn under 832 (the silo
    // law weighs it bucked, so WIP), its ARL origin on the row; nothing at the
    // ARL barn, nothing on the road, no manifest.
    const inv220 = await text("/reports/inventory_by_location?format=csv");
    assert(
      Math.abs(csvRowTotal(inv220.body, "PNN,BARN,ARL,WIP") - (barnArlBefore + 1500)) < 0.005,
      `the ARL HBN's package must be born in PNN's barn with its ARL origin (1,500 g more than ${barnArlBefore}), got\n${inv220.body}`
    );
    assert(!/Silo 5,ARL,WET/.test(inv220.body), "the finished lot no longer reads WET under Silo 5");
    assert(!/,ARL BARN,/.test(inv220.body), "nothing is born at the ARL barn any more");
    assert(!inv220.body.includes("IN-TRANSIT"), "no lot rides the road any more");
    const uploads220 = await text("/admin/uploads");
    assert(!uploads220.body.includes("/admin/uploads/manifest/"), "the finish must cut no manifest");
    counts = await homeCounts();
    assert(counts.inbound === 0, `the Inbound Queue stays empty, got ${counts.inbound}`);
    // THE LOADING SILO (canon 0.30.81; owner, verbatim: "when a satellite farm's
    // material is received at PNN and it's in the barn with a wet weight, it
    // should be set as "loading" in the correctly assigned silo"): the ARL lot
    // waits in the PNN barn with 1,500 g, weighed into Silo 5 (the silo its HBN
    // planned), so Silo 5 reads loading, names the lot with a link to Load
    // Silo, and Load Silo preselects Silo 5 for it.
    const loadingStrip = await text("/station/load_silo");
    assert(loadingStrip.body.includes(`data-silo="${silo5Id}" data-silo-state="loading"`), "the planned silo must read loading once the lot waits in the barn");
    assert(loadingStrip.body.includes('<div class="silo-state silo-state-loading" data-silo-label>loading</div>'), "the word loading must sit under the planned silo");
    assert(loadingStrip.body.includes(`data-waiting="${lotId220}"`) && loadingStrip.body.includes(`href="/station/load_silo?pick=${lotId220}">Lot `), "the loading tile must name the waiting lot with a link to Load Silo");
    // The lot's own space IS Silo 5 (no truck sentinel stands between any more),
    // so the waiting line reads plainly; "planned here" was the truck lot's word.
    // THE FINISHED LOT IS ELIGIBLE (canon 0.30.130): the line says waiting to
    // load and names no barn.
    assert(loadingStrip.body.includes(">waiting to load</div>"), "the waiting line must say the lot waits to load");
    // THE STRAIN ON THE LOT LINE (canon 0.30.183): the market strain under the lot number (Rainbow Candies over Fruity Pebbles).
    {
      const waitAt = loadingStrip.body.indexOf(`data-waiting="${lotId220}"`);
      const waitBlock = loadingStrip.body.slice(waitAt, loadingStrip.body.indexOf("waiting to load", waitAt) + 22);
      assert(waitBlock.includes('<div class="inv-lot-strain muted" data-lot-strain>Rainbow Candies</div>'), "the waiting line must carry the market strain under the lot number");
      assert(waitBlock.indexOf("Lot ") < waitBlock.indexOf("data-lot-strain") && waitBlock.indexOf("data-lot-strain") < waitBlock.indexOf("waiting to load"), "the strain sits between the lot number and the waiting word");
    }
    assert(!loadingStrip.body.includes(">in the barn</div>"), "the tile names no barn any more (canon 0.30.130)");
    assert(!loadingStrip.body.includes("planned here"), "no lot rides the truck sentinel, so none is merely planned here");
    assert(!loadingStrip.body.includes("silo-state-filled"), "the word filled is gone (canon 0.30.81: his word is loading)");
    const liveLoading = await (await req("/silos/live.json")).json();
    const silo5Live = liveLoading.silos.find((x) => x.id === silo5Id);
    assert(silo5Live && silo5Live.state === "loading" && silo5Live.fill === "green" && silo5Live.throb === null && silo5Live.wetGrams === 1500, `live Silo 5 must read loading with the 1,500 g, got ${JSON.stringify(silo5Live)}`);
    await passEntry(lotId220);
    const pick220Load = await text(`/station/load_silo?pick=${lotId220}`);
    assert(new RegExp(`<option value="${silo5Id}" selected>Silo 5</option>`).test(pick220Load.body), "Load Silo must preselect the HBN's planned silo");
    const consoleLoading = await text("/harvest");
    assert(consoleLoading.body.includes(`data-silo="${silo5Id}" data-silo-state="loading"`), "the console's strip must read the planned silo loading too");

    // THE BLANK SLATE (canon 0.30.108): the manifest walks that rode here
    // (canon 0.30.9's WET-lot manifests, the one-button receive, the pane
    // receipt) are gone with the floor; every lot lands in PNN's barn at
    // finish and nothing writes a movement. The Move To pencil still carries
    // the born item along, one reasoned stroke (canon 0.28.6).
    const moveEdit = await req(`/record/wet_weight_entries/${lotId220}/edit`, {
      method: "POST",
      body: form({
        weight_grams: "1500",
        actual_dryspc: drySpaceIdByName(lookupsPage.body, "Silo 4"),
        actual_start_time: "06:45",
        notes: "0.22.0 walk",
        status: "drying",
        reason: "landed, placed in Silo 4",
      }),
    });
    assert(moveEdit.status === 303, `lot move-to edit expected 303 got ${moveEdit.status}`);
    // Canon 0.29.1 boundary law: an edit WITHOUT the material_form field (an
    // older floor form) leaves the column unchanged, as the post above just
    // proved by landing 303; a garbage value refuses in words before any write.
    const badMaterialEdit = await req(`/record/wet_weight_entries/${lotId220}/edit`, {
      method: "POST",
      body: form({ material_form: "silo", reason: "smoke garbage form" }),
    });
    assert(
      badMaterialEdit.status === 400,
      `a garbage material_form edit expected 400 got ${badMaterialEdit.status}`
    );
    const invAfterMove = await text("/reports/inventory_by_location?format=csv");
    assert(
      /^PNN,Silo 4,ARL,WIP,"1,500",g/m.test(invAfterMove.body),
      `the location change must carry the born item to the space, under PNN with its ARL origin, got\n${invAfterMove.body}`
    );
    assert(
      Math.abs(csvRowTotal(invAfterMove.body, "PNN,BARN,ARL,WIP") - barnArlBefore) < 0.005,
      `the moved item must leave the barn row (back to ${barnArlBefore}), got\n${invAfterMove.body}`
    );

    // Owner ruling 2026-09-06 (canon 0.26.0) kept the Logistics Moves record
    // table in the Admin Data Queues; THE BLANK SLATE (canon 0.30.108) leaves
    // it standing with nothing writing it, so it reads none all the way down.
    const movesQueue = await text("/admin/queues");
    assert(movesQueue.body.includes("Logistics Moves"), "data queues missing the Logistics Moves section");
    assert(movesQueue.body.includes("No logistics moves."), "nothing writes a movement any more: the record table reads none");
    assert(!movesQueue.body.includes("data-movement-id="), "no movement row may ride the logistics queue");

    // Owner ruling 2026-09-06 (canon 0.27.0): Inventory by Location: totals by
    // product type, grouped by location, grouped by farm; empty spots hidden.
    const invByLoc = await text("/reports/inventory_by_location");
    assert(invByLoc.res.status === 200, `inventory by location expected 200 got ${invByLoc.res.status}`);
    assert(invByLoc.body.includes("Inventory by Location"), "report missing its title");
    assert(invByLoc.body.includes("Product type"), "report missing the Product type column");
    const invByLocCsv = await req("/reports/inventory_by_location?format=csv");
    assert(invByLocCsv.status === 200, `inventory by location csv expected 200 got ${invByLocCsv.status}`);
    const invByLocX = await req("/reports/inventory_by_location?format=xlsx");
    assert(invByLocX.status === 200, `inventory by location xlsx expected 200 got ${invByLocX.status}`);
    // THE BLANK SLATE (canon 0.30.108) and THE MANIFEST BUILDER (canon
    // 0.30.125): the floor that carried the barn blocks is the builder page
    // now; the old empty lines cannot come back through it.
    const floorFinal = await req("/interco");
    assert(floorFinal.status === 302 && (floorFinal.headers.get("location") || "").endsWith("/ops/interco_logistics"), "the old interco path must land on Logistics Operations");
    await floorFinal.text();
    const locAdmin = await text("/admin/lookups/inventory_locations");
    assert(locAdmin.body.includes("farm_code"), "locations admin must carry the farm column");
    assert(locAdmin.body.includes('name="farm_code"'), "locations add form must offer the farm select");

    // THE BLANK SLATE (canon 0.30.108): no lot rides the road, so the report
    // carries no IN-TRANSIT row and no ARL barn row; the ARL origin's born
    // material (the Silo 2 unload's 80 g) counts under PNN's BARN with ARL as
    // its origin column.
    assert(!invByLoc.body.includes("IN-TRANSIT"), "no lot rides the road any more");
    assert(!invByLoc.body.includes("<td>ARL BARN</td>"), "nothing is born at the ARL barn any more");
    assert(
      invByLoc.body.includes("<td>BARN</td><td>ARL</td><td>WIP</td>"),
      "the ARL origin's material must count at PNN's barn with ARL as its origin column"
    );
    const acquirePns = await text("/station/acquire_hbn");
    const mkPns = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({
        entry_date: "2026-09-06",
        farm_code: "PNS",
        grow_method_code: "GH",
        strain_id: optionValue(acquirePns.body, "Fruity Pebbles"),
      }),
    });
    assert(mkPns.status === 303, `PNS acquire expected 303 got ${mkPns.status}`);
    const wetPanePns = await text("/station/wet_weight");
    const pnsPick = (wetPanePns.body.match(/\?pick=([a-f0-9-]{36})">\d+\. PNS \//) || [])[1];
    assert(pnsPick, "wet pane missing the PNS batch");
    const pnsPicked = await text(`/station/wet_weight?pick=${pnsPick}`);
    const startPns = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        team_lead: "Smoke Lead",
        harvest_batch_id: pnsPick,
        actual_dryspc: drySpaceIdByName(lookupsPage.body, "Silo 3"),
        notes: "0.27.2 walk",
      }),
    });
    assert(startPns.status === 303, `PNS lot start expected 303 got ${startPns.status}`);
    const pnsLotId = new URL(startPns.headers.get("location") || "", base).searchParams.get("lot");
    assert(pnsLotId, "no lot id for the PNS walk");
    const invZero = await text("/reports/inventory_by_location");
    assert(
      !invZero.body.includes("PNS BARN"),
      "a lot with no weights yet must stay off the report (zero is not material)"
    );
    const wPns = await req(`/station/wet_weight/lot/${pnsLotId}/weights`, {
      method: "POST",
      body: form({ weight_grams: "777.25" }),
    });
    assert(wPns.status === 303, `PNS weight expected 303 got ${wPns.status}`);
    const invWet = await text("/reports/inventory_by_location");
    // Canon 0.30.23 (his words: "The current farm should be the header the
    // list is sitting under"): the site heads the run; the origin farm is a
    // column. THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69; owner:
    // "Live inventory on all screens, including the Inventory by Location
    // report"): this PNS lot is weighing INTO Silo 3, so it reads under Silo 3
    // at PNN as it fills, its origin farm PNS kept as the column, and the
    // silo closes with its Wet total row; the PNS barn stays clean.
    assert(invWet.body.includes('data-report-group="PNN"'), "the report must head the PNN run with its site");
    assert(
      invWet.body.includes("<td>Silo 3</td><td>PNS</td><td>WET</td><td>777</td><td>g</td>"),
      "a lot weighing into a silo must count as WET under that silo, its origin farm the column"
    );
    assert(
      invWet.body.includes("<td>Silo 3</td><td></td><td>Wet total</td><td>777</td><td>g</td>"),
      "the silo must close with its Wet total row"
    );
    assert(!invWet.body.includes("<td>PNS BARN</td><td>PNS</td><td>WET</td>"), "the filling lot no longer reads at the PNS barn");
    // THE BLANK SLATE (canon 0.30.108): the road is gone, so no row folds as
    // IN-TRANSIT and no barn but PNN's holds born material.
    assert(!invWet.body.includes("IN-TRANSIT"), "no lot rides the road any more");
    assert(!invWet.body.includes("<td>ARL BARN</td>"), "nothing sits at the ARL barn any more");
    const pnnBarnWipRow = invWet.body.match(/<td>BARN<\/td><td>ARL<\/td><td>WIP<\/td><td>([0-9,.]+)<\/td><td>g<\/td>/);
    assert(
      pnnBarnWipRow && Number(pnnBarnWipRow[1].replace(/,/g, "")) >= 80,
      `the ARL origin's unloaded material must show at PNN's barn (at least 80 g), got ${pnnBarnWipRow && pnnBarnWipRow[1]}`
    );
    const invWetCsv = await text("/reports/inventory_by_location?format=csv");
    assert(invWetCsv.body.includes("WET"), "the csv must carry the WET rows");
    // The floor that agreed with the report is the blank slate now; the
    // Harvest Console's strip is where the weighing lot shows live.
    const consoleAgree = await text("/harvest");
    assert(consoleAgree.res.status === 200, `harvest console expected 200 got ${consoleAgree.res.status}`);
    assert(consoleAgree.body.includes(`data-silo="${drySpaceIdByName(lookupsPage.body, "Silo 3")}" data-silo-state="filling"`), "the console's Silo 3 must read filling with the PNS lot weighing in");
    const acquire1132 = await text("/station/acquire_hbn");
    const mk1132 = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({
        entry_date: "2026-09-06",
        farm_code: "PNN",
        license_value: "GR-C-001132",
        grow_method_code: "GH",
        strain_id: optionValue(acquire1132.body, "Fruity Pebbles"),
      }),
    });
    assert(mk1132.status === 303, `GR-C-001132 acquire expected 303 got ${mk1132.status}`);
    const wet1132 = await text("/station/wet_weight");
    const pick1132 = (wet1132.body.match(/\?pick=([a-f0-9-]{36})">\d+\. PNN \//) || [])[1];
    assert(pick1132, "wet pane missing the 1132 batch");
    const picked1132 = await text(`/station/wet_weight?pick=${pick1132}`);
    const start1132 = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        team_lead: "Smoke Lead",
        harvest_batch_id: pick1132,
        actual_dryspc: drySpaceIdByName(lookupsPage.body, "Silo 4"),
        notes: "0.30.1 med inherit",
      }),
    });
    assert(start1132.status === 303, `1132 lot start expected 303 got ${start1132.status}`);
    const lot1132 = new URL(start1132.headers.get("location") || "", base).searchParams.get("lot");
    assert(lot1132, "no lot id for the 1132 walk");
    const w1132 = await req(`/station/wet_weight/lot/${lot1132}/weights`, {
      method: "POST",
      body: form({ weight_grams: "1132.00" }),
    });
    assert(w1132.status === 303, `1132 weight expected 303 got ${w1132.status}`);
    // THE BLANK SLATE (canon 0.30.108): the med line has no floor to sit on
    // while it weighs; the page is the manifest builder (canon 0.30.125).
    const floor1132 = await req("/interco");
    assert(floor1132.status === 302 && (floor1132.headers.get("location") || "").endsWith("/ops/interco_logistics"), "the old interco path must land on Logistics Operations");
    await floor1132.text();

    // THE BLANK SLATE (canon 0.30.108; his pick "PNN's 832 at birth"): the
    // finish births the med lot's package in PNN's barn under the grow license
    // AU-G-C-000832, the HBN keeping its own GR-C-001132; no equivalent
    // transfer is written and no manifest pends (THE SPINE's fork 2 hop
    // retired with the floor; METRC carries the real transfer).
    const fin1132 = await req(`/station/wet_weight/lot/${lot1132}/finish`, {
      method: "POST",
      body: form({}),
    });
    assert(fin1132.status === 303, `med lot finish expected 303 got ${fin1132.status}`);
    const invMed = await text("/reports/inventory_by_location?format=csv");
    // Canon 0.30.6: a silo lot WAITS in the barn after its birth; Load Silo moves it.
    assert(invMed.body.includes("PNN,BARN,PNN,WIP"), "the med lot's package must wait in the barn after the barn birth");
    const medUploads = await text("/admin/uploads");
    assert(!medUploads.body.includes("/admin/uploads/manifest/"), "the med finish must cut no equivalent-transfer manifest");
    const scope832 = await text(`/inventory/change-locations?kind=packages&farm=PNN&license=${encodeURIComponent("AU-G-C-000832")}`);
    assert(/ 1,132 g \/ BARN</.test(scope832.body), `the med lot's package must be born under PNN's 832 at BARN, got no such ledger option`);
    const scope1132 = await text(`/inventory/change-locations?kind=packages&farm=PNN&license=${encodeURIComponent("GR-C-001132")}`);
    assert(!/ 1,132 g \/ BARN</.test(scope1132.body), "nothing is born under the med license any more");

    // Owner ruling 2026-09-08 (canon 0.30.6): Drying Operations [Load Silo].
    // The strip rides the Drying Operations menu; the left pane lists the barn
    // lot as last-6-of-tag / farm / strain; the pick opens the entry with the
    // planned silo preselected; the load moves the package, starts the clock,
    // pends the location change; Start greys; Pause and Resume toggle; the
    // strip shows the lot in its circle on every Drying Operations page.
    const dryingMenu = await text("/ops/drying_ops");
    assert(dryingMenu.body.includes('href="/station/load_silo"'), "Drying Operations must carry Load Silo");
    assert(dryingMenu.body.includes("data-silo-strip"), "the silo strip must ride the Drying Operations menu");
    // THE HARVEST CONSOLE (canon 0.30.73): the five cylinders first and the wire
    // box after them; THE BLAST FREEZER (canon 0.30.98) is the seventh gauge,
    // and THE DRY SPACE TYPE (canon 0.30.106) draws it as the freezer cube in
    // the FFZ chrome. The FFZ inventory cube left the strip (canon 0.30.225).
    assert((dryingMenu.body.match(/class="inv-gauge silo-gauge"/g) || []).length === 6, "the strip must show the five silos and the Arlington Dry Room in the silo chrome");
    assert((dryingMenu.body.match(/class="inv-gauge silo-gauge ffz-gauge freezer-gauge"/g) || []).length === 1, "the strip must show the Blast Freezer(s) in the freezer chrome");
    assert(dryingMenu.body.includes('<div class="inv-gauge-name">Blast Freezer(s)</div>'), "the Drying Operations strip must name the Blast Freezer(s)");
    assert(!dryingMenu.body.includes('<div class="inv-gauge-name">Blast Freezer</div>'), "the old tile word must be gone");
    assert(!dryingMenu.body.includes("data-ffz"), "the FFZ inventory cube must leave the Drying Operations strip");
    assert(!dryingMenu.body.includes('<div class="inv-gauge-name">FFZ inventory</div>'), "the strip must not name an FFZ inventory");
    assert(dryingMenu.body.lastIndexOf('data-silo-shape-kind="cylinder"') < dryingMenu.body.indexOf('data-silo-shape-kind="box"'), "the wire box must follow the five cylinders on the strip");
    assert(dryingMenu.body.indexOf('data-silo-shape-kind="box"') < dryingMenu.body.indexOf('data-silo-shape-kind="cube"'), "the freezer cube must follow the dry room box");
    assert(loadPageStripHasSpaces(await text("/station/load_silo")), "the Load Silo strip must keep the spaces and leave the FFZ cube");
    const lot1132Batch = await passEntry(lot1132);
    const loadPage = await text("/station/load_silo");
    assert(loadPage.res.status === 200, `load silo page expected 200 got ${loadPage.res.status}`);
    assert(loadPage.body.includes("Scheduled lots"), "load silo page missing the scheduled lots pane");
    assert(loadPage.body.includes(`href="/station/load_silo?pick=${lot1132Batch}"`), "the barn pane must list the waiting med lot by its HBN");
    assert(loadPage.body.includes("/ PNN / Fruity Pebbles"), "the barn row must read last6 / farm / strain");
    const loadPick = await text(`/station/load_silo?pick=${lot1132}`);
    assert(loadPick.body.includes('action="/station/load_silo/load"'), "the pick must open the load form");
    assert(/<option value="[a-f0-9-]{36}" selected>Silo 4<\/option>/.test(loadPick.body), "the planned silo must preselect");
    // Canon 0.30.9 (his words: "Start time in Load Silo needs the time input
    // mask" and "The "LOADED" time is when the clock should start"): the mask
    // rides the field, the browser resolves the instant, and the clock runs
    // from the loaded time the moment the silo loads.
    assert(/name="start_time"[^>]*data-time24-mask/.test(loadPick.body), "the Start time must carry the HH:MM mask");
    assert(loadPick.body.includes('name="loaded_at_iso"'), "the load form must carry the resolved loaded instant");
    // THE PLANT COUNT (canon 0.30.62): this lot skipped the count at Finish lot,
    // so the load form asks again; the load below answers 42.
    assert(loadPick.body.includes("data-plant-prompt"), "an uncounted lot must be asked again at Load Silo");
    assert(/name="plant_count"[^>]*data-plant-count-input/.test(loadPick.body), "the load form must carry the plant count box");
    const silo4Id = drySpaceIdByName(lookupsPage.body, "Silo 4");
    // THE FINISHED LOT IS ELIGIBLE (canon 0.30.130; owner, 2026-09-19, verbatim:
    // "how do i get lots 27, 28, and 29 when the load dry space page doesn't
    // show them?  I'm assuming this is leftover interco logistics keep that
    // logistics page live, but sever its hold on where ledger inventory lands."):
    // the Move To pencil on the finished lot carries its package to Silo 3's
    // name (canon 0.28.6), out of every barn; under 0.30.73 the pane lost the
    // lot right there. It stays listed, Silo 3 now preselects, and the load into
    // Silo 4 below moves the package from Silo 3 (the log says so).
    const silo3IdForPencil = drySpaceIdByName(lookupsPage.body, "Silo 3");
    const pencilOut = await req(`/record/wet_weight_entries/${lot1132}/edit`, {
      method: "POST",
      body: form({ actual_dryspc: silo3IdForPencil, reason: "smoke: the pencil carries the package out of the barn" }),
    });
    assert(pencilOut.status === 303, `the Move To pencil on the finished lot expected 303 got ${pencilOut.status}`);
    const invPencil = await text("/reports/inventory_by_location?format=csv");
    assert(invPencil.body.includes("PNN,Silo 3,PNN,WIP"), "the pencil must carry the package to Silo 3 (canon 0.28.6)");
    assert(!invPencil.body.includes("PNN,BARN,PNN,WIP"), "the package has left the barn");
    const paneSevered = await text("/station/load_silo");
    assert(paneSevered.body.includes(`href="/station/load_silo?pick=${lot1132Batch}"`), "a finished lot stays on the pane wherever its package sits (canon 0.30.130)");
    const pickSevered = await text(`/station/load_silo?pick=${lot1132}`);
    assert(pickSevered.body.includes(`<option value="${silo3IdForPencil}" selected>Silo 3</option>`), "the lot's own space preselects after the pencil");
    assert(pickSevered.body.includes(`<option value="${silo4Id}">Silo 4</option>`), "Silo 4 stands free for the load");
    const futureLoad = await req("/station/load_silo/load", {
      method: "POST",
      body: form({
        lot_id: lot1132,
        dry_space_id: silo4Id,
        start_time: "23:59",
        loaded_at_iso: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      }),
    });
    assert(futureLoad.status === 400, `a loaded time ahead of now expected 400 got ${futureLoad.status}`);
    const loadedIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const doLoad = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: lot1132, dry_space_id: silo4Id, start_time: "07:15", loaded_at_iso: loadedIso, plant_count: "42" }),
    });
    assert(doLoad.status === 303, `load silo expected 303 got ${doLoad.status}`);
    const countedAtLoad = await text(`/record/wet_weight_entries/${lot1132}/edit`);
    assert(countedAtLoad.res.status === 200, `lot record edit expected 200 got ${countedAtLoad.res.status}`);
    assert(/name="plant_count"[^>]*value="42"/.test(countedAtLoad.body), "the count typed at Load Silo must land on the lot record");
    // THE HARVEST CONSOLE (canon 0.30.73; owner: "In Admin, add a new button:
    // [Harvest Console]"): with the floor this far (counted lots, the mirror
    // mounted, a silo loaded), the console renders its five sections, the four
    // shaded boxes, the hours numbox that saves and divides, and the strip with
    // the wire box and the FFZ cube.
    const adminConsoleTiles = await text("/admin");
    assert(adminConsoleTiles.body.includes('<a class="tile" href="/harvest">'), "Admin must carry the [Harvest Console] button");
    assert(adminConsoleTiles.body.includes('<span class="tile-title">Harvest Console</span>'), "the button must read Harvest Console");
    assert(adminConsoleTiles.body.includes('<span class="tile-title">Harvest Console Lite</span>'), "the vendored planting app's tile must read Harvest Console Lite");
    assert(adminConsoleTiles.body.indexOf('href="/harvest"') < adminConsoleTiles.body.indexOf('href="/vendors-equipment"'), "the console button must stand before the Continuum tiles");

    // THE MODELS BUTTON (canon 0.30.86; owner ruling 2026-09-15, verbatim: "New
    // button in Admin: [Models] - pin gated: 17853" and "1. [Harvest Menu Tool
    // 2026]"): the tile in Admin; its own gate (the Admin PIN, held in the jar,
    // does not open it; the Admin PIN typed there is refused; an off-site next
    // falls back to /models); the tiles page; the vendored tool streamed at its
    // slashed path (the slash-less one redirects) with its data.json beside it.
    assert(adminConsoleTiles.body.includes('<a class="tile" href="/models">'), "Admin must carry the [Models] button");
    assert(adminConsoleTiles.body.includes('<span class="tile-title">Models</span>'), "the button must read Models");
    const modelsGate = await text("/models");
    assert(modelsGate.res.status === 401, `Models behind the Admin PIN alone expected 401 got ${modelsGate.res.status}`);
    assert(modelsGate.body.includes('action="/pin/models"'), "the Models PIN page must post to /pin/models");
    assert(modelsGate.body.includes('name="next" value="/models"'), "the Models PIN page must carry next=/models");
    const adminPinAtModels = await text("/pin/models", { method: "POST", body: form({ pin: ADMIN_PIN, next: "/models" }) });
    assert(
      adminPinAtModels.res.status === 401 && adminPinAtModels.body.includes("Wrong PIN."),
      `the Admin PIN typed at the Models gate must be refused, got ${adminPinAtModels.res.status}`
    );
    const toolGate = await req("/models/harvest-menu-2026/");
    assert(toolGate.status === 401, `the vendored tool without the Models PIN expected 401 got ${toolGate.status}`);
    const evilModelsNext = await req("/pin/models", { method: "POST", body: form({ pin: MODELS_PIN, next: "https://evil.example/" }) });
    assert(
      evilModelsNext.status === 303 && (evilModelsNext.headers.get("location") || "") === "/models",
      `an off-site next at the Models gate must fall back to /models, got ${evilModelsNext.status} ${evilModelsNext.headers.get("location")}`
    );
    const modelsHome = await text("/models");
    assert(modelsHome.res.status === 200, `Models after its PIN expected 200 got ${modelsHome.res.status}`);
    assert(modelsHome.body.includes("<h1>Models</h1>"), "the Models page must be titled Models");
    assert(modelsHome.body.includes('<a class="tile" href="/models/harvest-menu-2026/">'), "Models must carry the [Harvest Menu Tool 2026] tile");
    assert(modelsHome.body.includes('<span class="tile-title">Harvest Menu Tool 2026</span>'), "the tile must read Harvest Menu Tool 2026");
    const toolNoSlash = await req("/models/harvest-menu-2026");
    assert(
      toolNoSlash.status === 302 && (toolNoSlash.headers.get("location") || "") === "/models/harvest-menu-2026/",
      `the slash-less tool path must redirect to the slashed one, got ${toolNoSlash.status} ${toolNoSlash.headers.get("location")}`
    );
    const toolPage = await text("/models/harvest-menu-2026/");
    assert(toolPage.res.status === 200, `the vendored tool expected 200 got ${toolPage.res.status}`);
    assert(toolPage.body.includes("<title>Grip Harvest Menu</title>"), "the vendored tool must stream its own page");
    assert((toolPage.res.headers.get("cache-control") || "") === "no-store", "the vendored tool must stream no-store");
    // The bytes of his zip stream untouched; a replaced file is a deliberate
    // act with a new pin. THE MENU TOOL REPLACED (canon 0.30.123; owner,
    // 2026-09-18: "replace the menu tool in "Models" with this one"):
    // grip-harvest-menu-hosting_3.zip's index.html (the spread slider per grow
    // type) over the 2026-09-15 zip's (1b5a8798e8417aca); data.json unchanged.
    const sha16 = (text) => createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
    assert(sha16(toolPage.body) === "b96dd261b907a0a1", `the vendored tool's bytes must match his zip, got ${sha16(toolPage.body)}`);
    assert(toolPage.body.includes("grip-harvest-menu-v5"), "the replaced tool must be the v5 build (spread per grow type)");
    assert(toolPage.body.includes('id="sp_${e}" data-env="${e}"'), "the replaced tool must carry the per-grow-type spread slider");
    const toolData = await text("/models/harvest-menu-2026/data.json");
    assert(
      toolData.res.status === 200 && (toolData.res.headers.get("content-type") || "").includes("application/json"),
      `the tool's data.json must stream as JSON, got ${toolData.res.status} ${toolData.res.headers.get("content-type")}`
    );
    assert(toolData.body.includes('"rows"'), "data.json must carry the rows");
    assert((toolData.res.headers.get("cache-control") || "") === "no-store", "data.json must stream no-store");
    assert(sha16(toolData.body) === "979881ee7f395397", `data.json's bytes must match his zip, got ${sha16(toolData.body)}`);
    // Admin, Lookups, app_config carries the second PIN as a value in data (canon L-4).
    const configPage = await text("/admin/lookups/app_config");
    assert(configPage.res.status === 200 && configPage.body.includes("models_pin"), "app_config must list models_pin beside admin_pin");
    const consolePage = await text("/harvest");
    assert(consolePage.res.status === 200, `harvest console expected 200 got ${consolePage.res.status}`);
    assert(consolePage.body.includes("<h1>Harvest Console</h1>"), "the console must carry its title");
    for (const section of ["plants", "drying", "trimming", "pasteurization", "testing"]) {
      assert(consolePage.body.includes(`data-hc-section="${section}"`), `the console must carry the ${section} section`);
    }
    assert(consolePage.body.includes('data-hc-section="plants" open') && consolePage.body.includes('data-hc-section="drying" open'), "Plants and Drying open by default");
    assert((consolePage.body.match(/data-hc-stub>/g) || []).length === 1, "Pasteurization is the remaining stub; Testing is built");
    assert(consolePage.body.includes('data-hc-section="testing"') && !consolePage.body.includes('hc-stub" data-hc-section="testing"'), "Testing must be a section, not a stub");
    assert(consolePage.body.includes('data-hc="lots_ready">1<'), "the season must count the trimmed lot as ready");
    assert(consolePage.body.includes('data-hc="lots_scheduled">0<'), "no order is still on the way to the lab");
    assert(consolePage.body.includes('data-hc="lots_retest">0<'), "the failed order was remediated and already has a later attempt");
    const testingSection = consolePage.body.slice(consolePage.body.indexOf('data-hc-section="testing"'));
    assert(
      testingSection.includes('data-hc="first_pass">0.0%<') &&
        testingSection.includes('data-hc="first_pass_lb">0.00 of 1.68 lb<') &&
        testingSection.includes('data-hc="first_pass_packages">0 of 1 packages<'),
      "the first full panel failed, so the rate is that parent package's weight over itself"
    );
    assert(testingSection.includes('data-hc-lab="SC Labs Michigan"') && testingSection.includes('data-hc-failure="microbials"') && testingSection.includes('data-hc="failure_lb">1.68 lb<'), "the first failure must sit under its lab with the package weight");
    assert(testingSection.includes('data-hc-strain="Fruity Pebbles"') && testingSection.includes('data-hc-farm="ARL"'), "the first-time rate must break out by strain and farm");
    assert(testingSection.includes("https://lims.tagleaf.com/coa_/smoke"), "the COA list must link the sample's COA");
    assert(testingSection.includes('data-hc="thc">20.1<'), "THC by parent tag must show the recorded percent");
    assert(testingSection.includes('data-hc="attempt">attempt 1<') && testingSection.includes('data-hc="attempt">attempt 2<'), "the COA and THC lists show the attempt beside the date");
    assert(!testingSection.includes(sampleTag) && !testingSection.includes(retestTag), "the sample tag never shows in the Testing section");
    assert(consolePage.body.includes('data-hc-section="trimming" open'), "Trimming opens by default");
    assert((consolePage.body.match(/<div class="hc-farm( hc-total)?" data-hc-farm=/g) || []).length === 4, "four small boxes: PNN, ARL, PNS and Total");
    for (const farm of ["PNN", "ARL", "PNS", "Total"]) {
      assert(consolePage.body.includes(`data-hc-farm="${farm}"`), `the ${farm} box must render`);
    }
    assert(/data-hc-farm="Total" data-hc-pct="\d+">\s*<div class="hc-shade" style="opacity:\d\.\d{3}">/.test(consolePage.body), "the Total box must shade by its % complete");
    for (const label of ["Plants Remaining/Total Plants", "Plants Harvested", "% Complete", "Wet Weight/plant AVG", "Dry Weight/plant AVG", "Cutting and Bucking Hours Yesterday", "Weight/DLH Yesterday"]) {
      assert((consolePage.body.match(new RegExp(`<dt>${label.replace(/[/%]/g, (c) => "\\" + c)}`, "g")) || []).length === 4, `every box must carry the ${label} line`);
    }
    // The counted lots (42 + 7 so far) roll into Plants Harvested for Total.
    const totalBox = consolePage.body.slice(consolePage.body.indexOf('data-hc-farm="Total"'), consolePage.body.indexOf('data-hc-section="drying"'));
    const harvestedTotal = totalBox.match(/data-hc="harvested">([^<]+)</);
    assert(harvestedTotal && Number(harvestedTotal[1].replace(/,/g, "")) >= 49, `Total must count the typed plants (at least 49), got ${harvestedTotal && harvestedTotal[1]}`);
    // The open numbox: yesterday's date, one form per farm, blank until typed.
    const yesterdayMatch = consolePage.body.match(/name="work_date" value="(\d{4}-\d{2}-\d{2})"/);
    assert(yesterdayMatch, "the hours form must carry yesterday's date");
    const consoleYesterday = yesterdayMatch[1];
    // THE FARM DAY BEGINS AT SIX (canon 0.30.151): yesterday is the farm day before the farm's today, and every page's body carries the start hour.
    assert(consoleYesterday === dayBeforeSmoke(farmDaySmoke(new Date().toISOString())), `the console's yesterday must be the farm day before today, got ${consoleYesterday}`);
    assert(consolePage.body.includes('<body data-farm-day-start="6">'), "the body must carry the farm day's start hour for the date scripts");
    // THE CONSOLE DAY (canon 0.30.152): the date control reads yesterday by default, capped at the farm's today; a picked day drives the panes and the hours boxes.
    const farmToday = farmDaySmoke(new Date().toISOString());
    assert(consolePage.body.includes(`<input type="date" name="day" value="${consoleYesterday}" max="${farmToday}" data-hc-day-input onchange="this.form.submit()">`), "the console must carry the day control on yesterday, capped at today");
    assert(consolePage.body.includes("yesterday, the default") && !consolePage.body.includes("data-hc-day-reset"), "the default day reads as yesterday with no way back needed");
    const pickedDay = dayBeforeSmoke(dayBeforeSmoke(consoleYesterday));
    const consolePicked = await text(`/harvest?day=${pickedDay}`);
    assert(consolePicked.res.status === 200 && consolePicked.body.includes("picked; the panes below read this day") && consolePicked.body.includes('data-hc-day-reset'), "a picked day must read as picked with a way back");
    assert(
      consolePicked.body.includes('data-hc="lots_ready">1<') &&
        consolePicked.body.includes('data-hc="first_pass">0.0%<') &&
        consolePicked.body.includes('data-hc="first_pass_lb">0.00 of 1.68 lb<'),
      "a picked day must not change the Testing season"
    );
    const thcAsc = await text("/harvest?thc=asc");
    assert(thcAsc.res.status === 200 && thcAsc.body.includes('data-hc-thc-sort="asc"'), "THC by parent tag must sort ascending");
    const thcDesc = await text(`/harvest?day=${pickedDay}&thc=desc`);
    assert(thcDesc.res.status === 200 && thcDesc.body.includes('data-hc-thc-sort="desc"') && thcDesc.body.includes('data-hc="lots_ready">1<'), "THC sort must keep the picked day and the season counts");
    // Three farm hours forms, two DLH boxes, two input lbs boxes, and the prepack DLH box carry the day home.
    assert((consolePicked.body.match(new RegExp(`name="work_date" value="${pickedDay}"`, "g")) || []).length === 8, "every hours and input lbs form must carry the picked day");
    assert(consolePicked.body.includes(`<span class="hc-date muted">${pickedDay}</span>`), "the date under the yesterday lines must be the picked day");
    const pickedHours = await req("/harvest/hours", { method: "POST", body: form({ farm: "ARL", work_date: pickedDay, hours: "3", day_picked: "1" }) });
    assert(pickedHours.status === 303 && (pickedHours.headers.get("location") || "") === `/harvest?ok=hours&day=${pickedDay}`, `hours on a picked day must return to that day, got ${pickedHours.headers.get("location")}`);
    const consolePickedAfter = await text(`/harvest?ok=hours&day=${pickedDay}`);
    assert(consolePickedAfter.body.includes('aria-label="Cutting and Bucking Hours Yesterday ARL" data-hc-hours-input>') && /value="3"[^>]*aria-label="Cutting and Bucking Hours Yesterday ARL"/.test(consolePickedAfter.body), "the picked day's ARL hours must read back on that day");
    const consoleBackToYesterday = await text("/harvest");
    assert(/value=""[^>]*aria-label="Cutting and Bucking Hours Yesterday ARL"/.test(consoleBackToYesterday.body), "yesterday's ARL box must stay blank: the hours landed on the picked day");
    const clearPicked = await req("/harvest/hours", { method: "POST", body: form({ farm: "ARL", work_date: pickedDay, hours: "", day_picked: "1" }) });
    assert(clearPicked.status === 303, "clearing the picked day's hours must save");
    const futureDay = await text("/harvest?day=2099-01-01");
    assert(futureDay.body.includes("yesterday, the default"), "a future day reads yesterday");
    assert((consolePage.body.match(/class="hc-hours" data-hc-hours="/g) || []).length === 3, "one hours form per farm");
    assert(consolePage.body.includes(`<input type="number" name="hours" min="0" step="0.25" inputmode="decimal" value="" placeholder="hours" aria-label="Cutting and Bucking Hours Yesterday PNN" data-hc-hours-input>`), "the PNN hours box starts blank");
    assert(consolePage.body.includes("type hours"), "Weight/DLH must ask for hours until they are typed");
    const badHours = await req("/harvest/hours", { method: "POST", body: form({ farm: "PNN", work_date: consoleYesterday, hours: "eight" }) });
    assert(badHours.status === 400, `word hours expected 400 got ${badHours.status}`);
    assert((await badHours.text()).includes("Hours must be a number of hours, zero or more."), "bad hours must refuse in words");
    const badFarm = await req("/harvest/hours", { method: "POST", body: form({ farm: "XYZ", work_date: consoleYesterday, hours: "8" }) });
    assert(badFarm.status === 400, `unknown farm expected 400 got ${badFarm.status}`);
    await badFarm.text();
    const saveHours = await req("/harvest/hours", { method: "POST", body: form({ farm: "PNN", work_date: consoleYesterday, hours: "8" }) });
    assert(saveHours.status === 303, `save hours expected 303 got ${saveHours.status}`);
    assert((saveHours.headers.get("location") || "").endsWith("/harvest?ok=hours"), `save hours must return to the console, got ${saveHours.headers.get("location")}`);
    const consoleSaved = await text("/harvest?ok=hours");
    assert(consoleSaved.body.includes('data-hc-flash>Hours saved.</p>'), "the save must flash");
    assert(consoleSaved.body.includes('aria-label="Cutting and Bucking Hours Yesterday PNN" data-hc-hours-input') && /value="8"[^>]*aria-label="Cutting and Bucking Hours Yesterday PNN"/.test(consoleSaved.body), "the PNN box must keep its typed 8");
    const totalSaved = consoleSaved.body.slice(consoleSaved.body.indexOf('data-hc-farm="Total"'), consoleSaved.body.indexOf('data-hc-section="drying"'));
    assert(totalSaved.includes('<span class="hc-value" data-hc="hours">8</span>'), "Total must sum the typed hours");
    const pnnSaved = consoleSaved.body.slice(consoleSaved.body.indexOf('data-hc-farm="PNN"'), consoleSaved.body.indexOf('data-hc-farm="ARL"'));
    assert(!pnnSaved.includes("type hours"), "PNN's Weight/DLH must divide once hours are typed");
    assert(/data-hc="weight_per_dlh">[0-9,.]+ lb\/h</.test(pnnSaved), "PNN's Weight/DLH must read in lb/h");
    const retype = await req("/harvest/hours", { method: "POST", body: form({ farm: "PNN", work_date: consoleYesterday, hours: "7.5" }) });
    assert(retype.status === 303, `retype hours expected 303 got ${retype.status}`);
    const hoursLog = await text("/log");
    assert(hoursLog.body.includes("labor hours typed"), "the hours changes must land in the change log");
    const clearHours = await req("/harvest/hours", { method: "POST", body: form({ farm: "PNN", work_date: consoleYesterday, hours: "" }) });
    assert(clearHours.status === 303, `clear hours expected 303 got ${clearHours.status}`);
    const consoleCleared = await text("/harvest");
    assert(/value=""[^>]*aria-label="Cutting and Bucking Hours Yesterday PNN"/.test(consoleCleared.body), "a blank save must clear the day's hours");
    // THE LINE RUNS ON THE CLOCK (canon 0.30.163): read the Unloaded Queue's state at the same moment as this console.
    const trimQueueBefore = await text("/station/trim_packages");
    const queueEmptyBefore = trimQueueBefore.body.includes("No rows waiting.");
    // THE TRIMMING SECTION (canon 0.30.88; owner ruling 2026-09-16, verbatim in
    // the canon row; his picks "Olga = Days, Victor = Afternoons" and "WPR
    // means SMALLS"). Before any package dated yesterday: two shift cards, both
    // waffles empty, the seeded operators named. Then trim room packages dated
    // yesterday against the unloaded ARL lot (80 g dry, untouched so far):
    // Olga's SHAKE 30 and TRIM 20 (BTR 60%), victor's SMALLS 9 and WASTE 20
    // (case-blind; BTR 31.0%), Les's WASTE 1 on neither shift. The DLH numbox
    // per shift; Lbs/DLH divides; the change log carries the hours.
    // Canon 0.30.97: schedule the extra HBN first so Trim Packages Entry sees it.
    const extraSched = await req("/production/scheduling/trim/schedule", {
      method: "POST",
      body: form({ hbn_id: extraBatchId }),
    });
    assert(extraSched.status === 303, `schedule extra HBN for trim expected 303 got ${extraSched.status}`);
    const trimBefore = consoleCleared.body.slice(consoleCleared.body.indexOf('data-hc-section="trimming"'), consoleCleared.body.indexOf('data-hc-section="pasteurization"'));
    assert(trimBefore.includes('data-hc-shift="day"') && trimBefore.includes('data-hc-shift="second"'), "the Trimming section must carry the two shift cards");
    assert(trimBefore.indexOf('data-hc-shift="day"') < trimBefore.indexOf('data-hc-shift="second"'), "Day shift stands before Second Shift");
    // THE TRIM LINE PICTURE (canon 0.30.154): the waffle gave way to his machine
    // picture; with nothing dated yesterday both pictures hang a zero total and
    // stand still (no shift operator weighed lately), while Les's over-trim a
    // minute ago lights the section's RUNNING note for an operator on neither shift.
    assert((trimBefore.match(/data-hc-trimline-total="0"/g) || []).length === 2, "with nothing dated yesterday both pictures hang a zero total");
    assert((trimBefore.match(/data-hc-bud-consumed="0"/g) || []).length === 2, "with nothing dated yesterday both buds carry consumed 0");
    // THE PROGRESSION BUD (canon 0.30.273): 100 cells on a 13 by 19 lattice. Nothing ran: every cell is an outline. No permanent stem.
    assert((trimBefore.match(/class="hc-bud-cell hc-bud-empty"/g) || []).length === 200, "with nothing dated yesterday every cell of both buds is an outline");
    assert((trimBefore.match(/viewBox="0 0 130 190" role="img"/g) || []).length === 2, "both buds must ride the 13 by 19 lattice");
    assert(!trimBefore.includes("data-hc-bud-stem"), "the progression bud has no permanent stem");
    // THE LINE RUNS ON THE CLOCK (canon 0.30.163): with the Unloaded Queue empty of scheduled lots and no shift
    // operator weighing lately, both cards stand still; once a lot is scheduled for trim, the shift on duty
    // (Day 6:00 AM to 6:00 PM Eastern, Second the other twelve hours) runs by the clock alone.
    const onDutyKey = (() => { const h = etHourSmoke(new Date().toISOString()); return h >= 6 && h < 18 ? "day" : "second"; })();
    const offDutyKey = onDutyKey === "day" ? "second" : "day";
    if (queueEmptyBefore) {
      assert((trimBefore.match(/data-hc-trimline-running="0"/g) || []).length === 2, "an empty queue and no recent weighing: both pictures stand still");
      assert(!trimBefore.includes("<animate "), "still stripes while the line is idle");
      assert(!trimBefore.includes("data-hc-running>"), "no RUNNING word on an idle card");
    } else {
      assert(trimBefore.includes(`data-hc-shift="${onDutyKey}" data-hc-shift-grams="0" data-hc-shift-running="1"`), "a lot in the queue lights the shift on duty by the clock");
      assert(trimBefore.includes(`data-hc-shift="${offDutyKey}" data-hc-shift-grams="0" data-hc-shift-running="0"`), "the shift off duty stands still");
    }
    assert(trimBefore.includes('data-hc-trim-running-unassigned><span class="hc-running">RUNNING</span> a package was weighed in the last 30 minutes by an operator on neither shift.</p>'), "Les weighed within 30 minutes on neither shift: the section must say RUNNING there");
    for (const node of ["trim", "t0", "sorter", "marvel", "bio", "bud", "retrim"]) {
      assert((trimBefore.match(new RegExp(`data-hc-node="${node}"`, "g")) || []).length === 2, `each card's picture must carry the ${node} machine`);
    }
    assert((trimBefore.match(/data-hc-flow=/g) || []).length === 12, "six flow bars per picture");
    assert((trimBefore.match(/data-hc-flow="t0-trim" x="828" y="144" width="44" height="78" fill="url\(#hc-flow-up-(day|second)\)"/g) || []).length === 2, "the T-0 to TRIM bar keeps his width, 44 of 1000, and flows up out of T-0 (his correction)");
    assert((trimBefore.match(/<text class="hc-total-label" x="520" y="662">Shift total<\/text>/g) || []).length === 2, "the converging lines hang the shift total under each picture");
    assert(!trimBefore.includes('data-hc-node-value="retrim"'), "RETRIM carries no figure yet (his word)");
    assert((trimBefore.match(/data-hc-metric="trim_sheet_hours"/g) || []).length === 2 && (trimBefore.match(/data-hc-sheet-hours="PNN"/g) || []).length === 2, "each card lists the day's hours from the sheet per farm");
    assert((trimBefore.match(/data-hc-trim-input="(day|second)"/g) || []).length === 2, "each card carries its input lbs box");
    assert(trimBefore.includes("data-hc-shift-operators>Olga</span>") && trimBefore.includes("data-hc-shift-operators>Victor</span>"), "the seeded operators name their shifts (migration 0052)");
    for (const label of ["Other", "Bulk Bud", "Prepack Bud", "Total Bud", "BTR", "Lbs Produced Yesterday", "DLH Yesterday", "Lbs/DLH"]) {
      assert((trimBefore.match(new RegExp(`<dt>${label.replace(/[/]/g, "\\/")}</dt>`, "g")) || []).length === 2, `each shift card must carry the ${label} line`);
    }
    assert(!trimBefore.includes("data-hc-trim-unassigned"), "no unassigned line with nothing dated yesterday");
    const olgaTrim = await req("/station/trim_packages", {
      method: "POST",
      body: form({
        wet_weight_entry_id: extraLotId,
        package_code: ["SHK-OLGA-1", "TRM-OLGA-1"],
        package_type_code: ["SHAKE", "TRIM"],
        effective_date: consoleYesterday, effective_pin: ADMIN_PIN,
        trim_operator: "Olga",
        weight_grams: ["30.00", "20.00"],
      }),
    });
    assert(olgaTrim.status === 303, `Olga's trim packages expected 303 got ${olgaTrim.status}`);
    const victorTrim = await req("/station/trim_packages", {
      method: "POST",
      body: form({
        wet_weight_entry_id: extraLotId,
        package_code: ["SML-VIC-1", "WST-VIC-1"],
        package_type_code: ["SMALLS", "WASTE"],
        effective_date: consoleYesterday, effective_pin: ADMIN_PIN,
        trim_operator: "victor",
        weight_grams: ["9.00", "20.00"],
      }),
    });
    assert(victorTrim.status === 303, `Victor's trim packages expected 303 got ${victorTrim.status}`);
    const lesTrim = await req("/station/trim_packages", {
      method: "POST",
      body: form({
        wet_weight_entry_id: extraLotId,
        package_code: ["WST-LES-1"],
        package_type_code: ["WASTE"],
        effective_date: consoleYesterday, effective_pin: ADMIN_PIN,
        trim_operator: "Les",
        weight_grams: ["1.00"],
      }),
    });
    assert(lesTrim.status === 303, `Les's trim package expected 303 got ${lesTrim.status}`);
    const consoleTrim = await text("/harvest");
    const trimSection = consoleTrim.body.slice(consoleTrim.body.indexOf('data-hc-section="trimming"'), consoleTrim.body.indexOf('data-hc-section="pasteurization"'));
    const dayCard = trimSection.slice(trimSection.indexOf('data-hc-shift="day"'), trimSection.indexOf('data-hc-shift="second"'));
    assert(dayCard.includes('data-hc="trim_lbs">0.11 lb</span><span class="hc-sub muted">50 g · 2 packages</span>'), "Day shift must weigh Olga's 50 g");
    assert(dayCard.includes('data-hc="trim_btr">60.0%</span>'), "Day shift BTR must read 60.0% (30 SHAKE of 50)");
    assert(dayCard.includes('data-hc="trim_bud">0.07 lb</span><span class="hc-sub muted">30 g · Bulk + Prepack</span>'), "Day shift Total Bud must be the SHAKE 30 g");
    assert(dayCard.includes('data-hc="trim_bulk">0.07 lb</span><span class="hc-sub muted">30 g · SHAKE + BUD</span>'), "Day shift Bulk Bud must be the SHAKE 30 g");
    assert(dayCard.includes('data-hc="trim_prepack">0.00 lb</span><span class="hc-sub muted">0 g · WPR</span>'), "Day shift Prepack Bud must read zero (no SMALLS)");
    assert(dayCard.includes('data-hc="trim_other">0.04 lb</span><span class="hc-sub muted">20 g · TRIM 20 + BIO 0 + WIP left 0</span>'), "Day shift Other must be the TRIM 20 g, named by stream");
    // The picture: the total hangs 50 g, BUD carries the 30 g, RETRIM the TRIM 20 g; Olga weighed a minute ago, so the card runs and its stripes move.
    assert(dayCard.includes('data-hc-trimline-running="1" data-hc-trimline-total="50"'), "the Day picture must run and hang the 50 g total");
    assert(dayCard.includes('data-hc-bud-consumed="40"'), "Day BTR 60.0% must grey 40 cells of the bud");
    assert(dayCard.includes('hc-bud-bud" data-hc-bud-order="100" data-hc-bud-n="1"'), "at 60% the heart, cell 1, is still bud");
    assert(dayCard.includes('hc-bud-consumed" data-hc-bud-order="1" data-hc-bud-n="100"'), "at 60% the foot, cell 100, is the first consumed");
    assert(dayCard.includes('data-hc-node-value="bud" x="262" y="530">30 g</text>'), "the BUD endpoint must carry the Total Bud 30 g");
    assert(dayCard.includes("bulk 30 · prepack 0</text>"), "the BUD endpoint must name bulk and prepack");
    assert(dayCard.includes('<text class="hc-node-value" data-hc-node-value="trim" x="850" y="112">20 g</text>'), "the TRIM circle must carry the rest of Other, the TRIM 20 g (his correction)");
    assert(dayCard.includes('data-hc-node-value="bio" x="105" y="496">0 g</text>'), "the BIO endpoint must read zero");
    assert(dayCard.includes('data-hc-trimline-total-text x="520" y="692">0.11 lb · 50 g</text>'), "the converging lines must hang the shift total");
    assert(dayCard.includes('<animate attributeName="x" from="0" to="-20" dur="900ms" repeatCount="indefinite"/>') && dayCard.includes('<animate attributeName="y" from="0" to="20" dur="900ms" repeatCount="indefinite"/>') && dayCard.includes('<animate attributeName="y" from="0" to="-20" dur="900ms" repeatCount="indefinite"/>'), "a running line moves its stripes at the drying cadence, 900 ms a tile, up out of T-0 for the TRIM circle");
    assert(dayCard.includes('data-hc-shift-running="1"') && dayCard.includes('<span class="hc-running" data-hc-running>RUNNING</span>'), "Olga weighed within 30 minutes: the Day card flashes RUNNING");
    // THE LINE RUNS ON THE CLOCK: the extra lot now stands in the Unloaded Queue for trim, so the shift on duty runs by the clock too.
    const trimQueueNow = await text("/station/trim_packages");
    assert(!trimQueueNow.body.includes("No rows waiting."), "the scheduled extra lot must stand in the Unloaded Queue for trim");
    assert(trimSection.slice(trimSection.indexOf(`data-hc-shift="${onDutyKey}"`)).includes('data-hc-shift-running="1"'), "the shift on duty must run with a lot in the queue");
    assert(dayCard.includes('data-hc="trim_lbs_per_dlh">type hours</span>'), "Lbs/DLH must ask for hours until typed");
    const secondCard = trimSection.slice(trimSection.indexOf('data-hc-shift="second"'));
    assert(secondCard.includes('data-hc="trim_lbs">0.06 lb</span><span class="hc-sub muted">29 g · 2 packages</span>'), "Second Shift must weigh victor's 29 g (the operator matched case-blind)");
    assert(secondCard.includes('data-hc="trim_btr">31.0%</span>'), "Second Shift BTR must read 31.0% (9 SMALLS, his WPR, of 29)");
    assert(secondCard.includes('data-hc="trim_prepack">0.02 lb</span><span class="hc-sub muted">9 g · WPR</span>'), "Second Shift Prepack Bud must be the SMALLS 9 g (his WPR)");
    assert(secondCard.includes('data-hc="trim_bulk">0.00 lb</span><span class="hc-sub muted">0 g · SHAKE + BUD</span>'), "Second Shift Bulk Bud must read zero");
    assert(secondCard.includes('data-hc="trim_other">0.04 lb</span><span class="hc-sub muted">20 g · TRIM 0 + BIO 0 + WIP left 0 + other types 20</span>'), "Second Shift Other must gather the WASTE 20 g as another type");
    assert(secondCard.includes('data-hc-trimline-running="1" data-hc-trimline-total="29"'), "the Second picture must run (victor weighed a minute ago) and hang the 29 g total");
    assert(secondCard.includes('data-hc-bud-consumed="69"'), "Second BTR 31.0% must grey 69 cells of the bud");
    // THE TRIM BOGEY (canon 0.30.249): 40 until saved; at 35 the 69 consumed reach four product cells, from the 66th.
    const wasteOf = (card) => {
      const at = card.indexOf('<svg class="hc-bud"');
      return (card.slice(at, card.indexOf("</svg>", at)).match(/ data-hc-bud-waste\/>/g) || []).length;
    };
    assert(secondCard.includes('data-hc-bud-product="40"') && wasteOf(secondCard) === 9, "the default bogey leaves 40 product cells, 9 of them dug into at 31% BTR");
    const bogeyPage = await text("/admin/lookups/trim_bogey");
    assert(bogeyPage.res.status === 200, `GET the Trim Bogey page expected 200 got ${bogeyPage.res.status}`);
    assert(bogeyPage.body.includes('value="40" data-trim-bogey-value') && bogeyPage.body.includes("data-trim-bogey-default"), "the Trim Bogey page must show the default 40 until saved");
    const badBogey = await req("/admin/lookups/trim_bogey", { method: "POST", body: form({ trim_bogey_pct: "140", reason: "smoke" }) });
    assert(badBogey.status === 400, `a bogey past 100 expected 400 got ${badBogey.status}`);
    assert((await badBogey.text()).includes("Trim Bogey is a whole percent from 0 to 100."), "a bogey past 100 must refuse in words");
    const saveBogey = await req("/admin/lookups/trim_bogey", { method: "POST", body: form({ trim_bogey_pct: "35", reason: "smoke: a tighter goal" }) });
    assert(saveBogey.status === 303, `saving the bogey expected 303 got ${saveBogey.status} ${await saveBogey.text()}`);
    assert((saveBogey.headers.get("location") || "").endsWith("/admin/lookups/trim_bogey?ok=saved"), `saving the bogey must return to its page, got ${saveBogey.headers.get("location")}`);
    const bogeySaved = await text("/admin/lookups/trim_bogey?ok=saved");
    assert(bogeySaved.body.includes('value="35" data-trim-bogey-value') && bogeySaved.body.includes("data-trim-bogey-flash") && !bogeySaved.body.includes("data-trim-bogey-default"), "the saved bogey must read 35 with its flash");
    const bogeyConsole = await text("/harvest");
    const bogeySecond = bogeyConsole.body.slice(bogeyConsole.body.indexOf('data-hc-shift="second"'));
    assert(bogeySecond.includes('data-hc-bud-product="35"') && wasteOf(bogeySecond) === 4, "at a bogey of 35 the Second plume must dig into 4 product cells");
    const bogeyBack = await req("/admin/lookups/trim_bogey", { method: "POST", body: form({ trim_bogey_pct: "40", reason: "smoke: back to the default" }) });
    assert(bogeyBack.status === 303, `restoring the bogey expected 303 got ${bogeyBack.status}`);
    await bogeyBack.text();
    assert(secondCard.includes('<text class="hc-node-value" data-hc-node-value="trim" x="850" y="112">20 g</text>'), "the TRIM circle must carry the WASTE 20 g as the rest of Other");
    assert(trimSection.includes("data-hc-trim-unassigned>1 g yesterday by operators on neither shift: Les. Name the shifts' operators in Admin, Lookups, app_config.</p>"), "grams by an operator on neither shift must be named, never dropped");
    const badShift = await req("/harvest/trim-hours", { method: "POST", body: form({ shift: "night", work_date: consoleYesterday, hours: "5" }) });
    assert(badShift.status === 400, `an unknown shift expected 400 got ${badShift.status}`);
    assert((await badShift.text()).includes("Pick a shift."), "an unknown shift must refuse in words");
    const badTrimHours = await req("/harvest/trim-hours", { method: "POST", body: form({ shift: "day", work_date: consoleYesterday, hours: "five" }) });
    assert(badTrimHours.status === 400, `word DLH expected 400 got ${badTrimHours.status}`);
    await badTrimHours.text();
    const saveTrimDlh = await req("/harvest/trim-hours", { method: "POST", body: form({ shift: "day", work_date: consoleYesterday, hours: "5" }) });
    assert(saveTrimDlh.status === 303, `save DLH expected 303 got ${saveTrimDlh.status}`);
    assert((saveTrimDlh.headers.get("location") || "").endsWith("/harvest?ok=trim_hours"), `save DLH must return to the console, got ${saveTrimDlh.headers.get("location")}`);
    const consoleDlh = await text("/harvest?ok=trim_hours");
    assert(consoleDlh.body.includes('data-hc-flash>Hours saved.</p>'), "the DLH save must flash");
    const dayDlh = consoleDlh.body.slice(consoleDlh.body.indexOf('data-hc-shift="day"'), consoleDlh.body.indexOf('data-hc-shift="second"'));
    assert(/value="5"[^>]*aria-label="DLH Yesterday Day shift" data-hc-hours-input>/.test(dayDlh), "the Day numbox must keep its typed 5");
    assert(dayDlh.includes('data-hc="trim_lbs_per_dlh">0.02 lb/h</span><span class="hc-sub muted">10 g/h</span>'), "Lbs/DLH must divide 50 g by 5 h");
    const secondDlh = consoleDlh.body.slice(consoleDlh.body.indexOf('data-hc-shift="second"'), consoleDlh.body.indexOf('data-hc-section="pasteurization"'));
    assert(/value=""[^>]*aria-label="DLH Yesterday Second Shift" data-hc-hours-input>/.test(secondDlh), "the Second numbox stays blank");
    const dlhLog = await text("/log");
    assert(dlhLog.body.includes("<td>trim_labor_hours</td>"), "the DLH must land in the change log under trim_labor_hours");
    const clearTrimDlh = await req("/harvest/trim-hours", { method: "POST", body: form({ shift: "day", work_date: consoleYesterday, hours: "" }) });
    assert(clearTrimDlh.status === 303, `clear DLH expected 303 got ${clearTrimDlh.status}`);
    const consoleDlhCleared = await text("/harvest");
    assert(/value=""[^>]*aria-label="DLH Yesterday Day shift"/.test(consoleDlhCleared.body), "a blank save must clear the shift's DLH");
    // THE TRIM LINE PICTURE (canon 0.30.154): the input lbs box (total lbs run
    // through T-0), one number per shift per day, under the sheet hours; the
    // TRIM circle carries the typed pounds; the change log carries the change.
    const badInputShift = await req("/harvest/trim-input", { method: "POST", body: form({ shift: "night", work_date: consoleYesterday, lbs: "5" }) });
    assert(badInputShift.status === 400, `an unknown shift on input lbs expected 400 got ${badInputShift.status}`);
    assert((await badInputShift.text()).includes("Pick a shift."), "an unknown shift on input lbs must refuse in words");
    const badInputLbs = await req("/harvest/trim-input", { method: "POST", body: form({ shift: "day", work_date: consoleYesterday, lbs: "twelve" }) });
    assert(badInputLbs.status === 400, `word input lbs expected 400 got ${badInputLbs.status}`);
    assert((await badInputLbs.text()).includes("Input lbs must be a number of pounds, zero or more."), "word input lbs must refuse in words");
    const saveInputLbs = await req("/harvest/trim-input", { method: "POST", body: form({ shift: "day", work_date: consoleYesterday, lbs: "12.5" }) });
    assert(saveInputLbs.status === 303, `save input lbs expected 303 got ${saveInputLbs.status}`);
    assert((saveInputLbs.headers.get("location") || "").endsWith("/harvest?ok=trim_input"), `save input lbs must return to the console, got ${saveInputLbs.headers.get("location")}`);
    const consoleInput = await text("/harvest?ok=trim_input");
    assert(consoleInput.body.includes('data-hc-flash>Input lbs saved.</p>'), "the input lbs save must flash");
    const dayInput = consoleInput.body.slice(consoleInput.body.indexOf('data-hc-shift="day"'), consoleInput.body.indexOf('data-hc-shift="second"'));
    assert(/value="12.50"[^>]*aria-label="Input lbs Day shift" data-hc-input-lbs>/.test(dayInput), "the Day input box must keep its typed 12.50");
    assert(dayInput.includes('<text class="hc-node-sub" data-hc-node-value="t0-input" x="849" y="362">input 12.50 lb</text>'), "T-0 must carry the typed input pounds (the total run through it)");
    const secondInput = consoleInput.body.slice(consoleInput.body.indexOf('data-hc-shift="second"'), consoleInput.body.indexOf('data-hc-section="pasteurization"'));
    assert(/value=""[^>]*aria-label="Input lbs Second Shift" data-hc-input-lbs>/.test(secondInput), "the Second input box stays blank");
    assert(secondInput.includes('<text class="hc-node-sub hc-node-muted" data-hc-node-value="t0-input" x="849" y="362">input lbs</text>'), "an untyped T-0 asks for the input lbs");
    const inputLog = await text("/log");
    assert(inputLog.body.includes("<td>trim_line_inputs</td>"), "the input lbs must land in the change log under trim_line_inputs");
    const clearInputLbs = await req("/harvest/trim-input", { method: "POST", body: form({ shift: "day", work_date: consoleYesterday, lbs: "" }) });
    assert(clearInputLbs.status === 303, `clear input lbs expected 303 got ${clearInputLbs.status}`);
    const consoleInputCleared = await text("/harvest");
    assert(/value=""[^>]*aria-label="Input lbs Day shift"/.test(consoleInputCleared.body), "a blank save must clear the shift's input lbs");
    // Spanish: the shift names and the lines speak.
    const toEsTrim = await req("/locale", { method: "POST", body: form({ locale: "es" }) });
    await toEsTrim.text();
    const consoleTrimEs = await text("/harvest");
    assert(consoleTrimEs.body.includes("Turno de dia") && consoleTrimEs.body.includes("Segundo turno") && consoleTrimEs.body.includes("Libras producidas ayer"), "the Trimming section must speak Spanish");
    assert(consoleTrimEs.body.includes("<dt>Flor total</dt>") && consoleTrimEs.body.includes(">Total del turno</text>") && consoleTrimEs.body.includes("EN MARCHA"), "the picture and his lines must speak Spanish");
    // THE CONTRAST (canon 0.30.245): the legend reads bud, byproduct, waste.
    assert(consoleTrimEs.body.includes("subproducto") && consoleTrimEs.body.includes("desperdicio"), "the bud legend must speak Spanish");
    // THE DRYING TOTALS (canon 0.30.183) speak Spanish too.
    assert(consoleTrimEs.body.includes("Total en espacios de secado") && consoleTrimEs.body.includes("Total en espacios de curado") && consoleTrimEs.body.includes("Total seco en cola") && /seco est\. [0-9,]+\.[0-9]{2} lb al 22%/.test(consoleTrimEs.body), "the drying totals must speak Spanish");
    const toEnTrim = await req("/locale", { method: "POST", body: form({ locale: "en" }) });
    await toEnTrim.text();
    // The Drying section: the strip with the seven silos, the two rooms as wire
    // box, and the Blast Freezer(s) as the freezer cube. The FFZ inventory cube left (canon 0.30.225).
    const consoleDrying = consolePage.body.slice(consolePage.body.indexOf('data-hc-section="drying"'), consolePage.body.indexOf('data-hc-section="trimming"'));
    assert(consoleDrying.includes("data-silo-strip"), "the Drying section must carry the silo strip");
    // THE DRYING TOTALS (canon 0.30.183): three totals under the tiles, the estimate at the Admin percent (22 by default).
    assert(consoleDrying.includes('<div class="drying-totals" data-hc-drying-totals>'), "the Drying section must carry the totals line under the tiles");
    assert(consoleDrying.indexOf("data-silo-strip") < consoleDrying.indexOf("data-hc-drying-totals"), "the totals sit under the dry space tiles");
    for (const label of ["Total in Dry Spaces", "Total in Cure Spaces", "Total Dry Queued"]) {
      assert(consoleDrying.includes(`<div class="drying-total-label">${label}</div>`), `the totals line must read ${label}`);
    }
    assert(/data-hc-dry-estimate>est\. dry [0-9,]+\.[0-9]{2} lb at 22%</.test(consoleDrying), "the dry estimate must read at the Admin percent, 22 by default");
    assert((consoleDrying.match(/<strong>[0-9,]+\.[0-9]{2}<\/strong> lb · <strong>[0-9,]+<\/strong> g/g) || []).length >= 3, "each total reads pounds and whole grams");
    assert((consoleDrying.match(/data-silo-shape-kind="cylinder"/g) || []).length === 5, "five cylinders on the console");
    // THE BLAST FREEZER (canon 0.30.98): a second wire box beside the Arlington Dry Room.
    assert((consoleDrying.match(/data-silo-shape-kind="box"/g) || []).length === 1, "the Arlington Dry Room as the wire box on the console");
    assert((consoleDrying.match(/data-silo-shape-kind="cube"/g) || []).length === 1, "the Blast Freezer(s) as the freezer cube on the console");
    assert(!consoleDrying.includes("data-ffz"), "the FFZ inventory cube must leave the console");
    assert(consoleDrying.includes('<svg class="silo-shape silo-shape-cube"'), "the Blast Freezer(s) must draw as the cube");
    assert(consoleDrying.indexOf('data-silo-shape-kind="box"') < consoleDrying.indexOf('data-silo-shape-kind="cube"'), "the freezer cube stands after the dry room");
    const ffzLive = await (await req("/silos/live.json")).json();
    assert(!("ffz" in ffzLive), "live.json must not carry an FFZ cube");
    assert(consolePage.body.includes('fetch("/silos/live.json"'), "the console must repaint from live.json");
    // Spanish console, then back to English for the walk that follows.
    const toEsConsole = await req("/locale", { method: "POST", body: form({ locale: "es" }) });
    await toEsConsole.text();
    const consoleEs = await text("/harvest");
    assert(consoleEs.body.includes("<summary>Plantas</summary>") && consoleEs.body.includes("<summary>Secado</summary>"), "the console must speak Spanish");
    assert(!consoleEs.body.includes("Inventario FFZ") && !consoleEs.body.includes("data-ffz"), "the Spanish console must not carry the FFZ cube");
    const toEnConsole = await req("/locale", { method: "POST", body: form({ locale: "en" }) });
    await toEnConsole.text();
    const loadLoc = doLoad.headers.get("location") || "";
    const loadId = new URL(loadLoc, base).searchParams.get("load");
    assert(loadId, "load silo must redirect to the load");
    const loadedUrl = new URL(loadLoc, base);
    const loaded = await text(loadedUrl.pathname + loadedUrl.search);
    assert(loaded.body.includes("Loaded. The location change pends at the export home."), "the load must flash");
    assert(loaded.body.includes('data-state="running"'), "the clock must run from the load");
    assert(loaded.body.includes(`<time datetime="${loadedIso}" data-local>`), "Loaded must show the resolved loaded time as the clock's zero");
    assert(/data-started="\d+"/.test(loaded.body) && loaded.body.includes(`data-started="${Date.parse(loadedIso)}"`), "the clock's zero must be the loaded instant");
    assert(!loaded.body.includes("Not started"), "no load waits for Start any more");
    assert(/<button type="submit" disabled[^>]*>Start<\/button>/.test(loaded.body), "Start must grey from the load");
    assert(loaded.body.includes(">Pause</button>"), "the running clock must offer Pause");
    assert(loaded.body.includes(`href="/record/silo_loads/${loadId}/edit"`), "the load must carry its pencil");
    // THE ZONELESS ZERO (canon 0.30.104): the pencil shows the clock's zero in
    // farm time and takes it back the same way; the server stores the instant.
    // A zoneless wall clock is Eastern, an instant with its zone stands, any
    // other shape or a time ahead of now refuses in words.
    const pencilPage = await text(`/record/silo_loads/${loadId}/edit`);
    if (pencilPage.res.status !== 200) fail("GET silo load pencil", `status ${pencilPage.res.status}`);
    const loadedWall = etWallClockSmoke(loadedIso);
    assert(
      pencilPage.body.includes(`name="loaded_at" value="${loadedWall}" placeholder="YYYY-MM-DD HH:MM"`),
      `the pencil must show the clock's zero as farm time ${loadedWall}`
    );
    assert(pencilPage.body.includes("Loaded at (farm time, YYYY-MM-DD HH:MM, the clock's zero)"), "the pencil label must say farm time");
    assert(!pencilPage.body.includes("ISO UTC"), "the pencil must no longer ask for ISO UTC");
    const wallYesterday = `${etDateSmoke(new Date(Date.now() - 86_400_000).toISOString())} 06:30`;
    const wallIso = etInstantSmoke(wallYesterday.slice(0, 10), "06:30");
    const pencilWall = await req(`/record/silo_loads/${loadId}/edit`, {
      method: "POST",
      body: form({ loaded_at: wallYesterday, reason: "smoke: the zero typed in farm time" }),
    });
    assert(pencilWall.status === 303, `farm-time pencil expected 303 got ${pencilWall.status}`);
    const afterWall = await text(loadedUrl.pathname + loadedUrl.search);
    assert(afterWall.body.includes(`<time datetime="${wallIso}" data-local>`), `a farm-time zero must store the Eastern instant ${wallIso}`);
    assert(afterWall.body.includes(`data-started="${Date.parse(wallIso)}"`), "the clock must run from the stored instant, never the typed text");
    const pencilLog = await text("/log");
    assert(pencilLog.body.includes(wallIso) && pencilLog.body.includes(loadedIso), "the change log must carry the old and new instants");
    const pencilBad = await req(`/record/silo_loads/${loadId}/edit`, {
      method: "POST",
      body: form({ loaded_at: "yesterday morning", reason: "smoke: a shape the farm refuses" }),
    });
    assert(pencilBad.status === 400, `a zoneless non-time expected 400 got ${pencilBad.status}`);
    assert((await pencilBad.text()).includes("Loaded at must be a farm-time date and time, YYYY-MM-DD HH:MM."), "the bad shape must refuse in words");
    const pencilAhead = await req(`/record/silo_loads/${loadId}/edit`, {
      method: "POST",
      body: form({ loaded_at: etWallClockSmoke(new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()), reason: "smoke: ahead of now" }),
    });
    assert(pencilAhead.status === 400, `a zero ahead of now expected 400 got ${pencilAhead.status}`);
    assert((await pencilAhead.text()).includes("Loaded at is ahead of now."), "ahead of now must refuse in words");
    const pencilBlank = await req(`/record/silo_loads/${loadId}/edit`, {
      method: "POST",
      body: form({ loaded_at: "", reason: "smoke: a blank zero" }),
    });
    assert(pencilBlank.status === 400 && (await pencilBlank.text()).includes("Loaded at is required."), "a blank zero must refuse in words");
    const pencilBack = await req(`/record/silo_loads/${loadId}/edit`, {
      method: "POST",
      body: form({ loaded_at: loadedIso, reason: "smoke: the zero restored as an instant with its zone" }),
    });
    assert(pencilBack.status === 303, `an instant with its zone expected 303 got ${pencilBack.status}`);
    const afterBack = await text(loadedUrl.pathname + loadedUrl.search);
    assert(afterBack.body.includes(`<time datetime="${loadedIso}" data-local>`), "an instant with its zone must store as it stands");
    const invLoaded = await text("/reports/inventory_by_location?format=csv");
    assert(invLoaded.body.includes("PNN,Silo 4,PNN,WIP"), "loading the silo must move the package to the silo");
    assert(!invLoaded.body.includes("PNN,Silo 3,PNN,WIP"), "the load moves the package from where it sat, Silo 3 (canon 0.30.130)");
    const logSevered = await text("/log");
    assert(/<td>location<\/td>\s*<td>Silo 3<\/td>\s*<td>Silo 4<\/td>\s*<td>[^<]*<\/td>\s*<td>silo load<\/td>/.test(logSevered.body), "the location line must read from Silo 3 to Silo 4 under the load's reason");
    // Canon 0.30.69: the Wet total row closes the loaded silo's rows in the report.
    assert(/PNN,Silo 4,,Wet total,"?[0-9.,]+"?,g/.test(invLoaded.body), "the report must close Silo 4 with its Wet total row once loaded");
    const barnAfter = await text("/station/load_silo");
    assert(!barnAfter.body.includes(`href="/station/load_silo?pick=${lot1132}"`), "a loaded lot must leave the barn pane");
    assert(barnAfter.body.includes(`data-load="${loadId}"`), "the strip must show the load in its silo");
    // THE STRAIN ON THE LOT LINE (canon 0.30.183): the loaded lot's strain rides under its number too.
    {
      const loadAt = barnAfter.body.indexOf(`data-load="${loadId}"`);
      const loadBlock = barnAfter.body.slice(loadAt, barnAfter.body.indexOf('<div class="inv-lot-time">', loadAt));
      assert(/<div class="inv-lot-strain muted" data-lot-strain>[^<]+<\/div>/.test(loadBlock), "the loaded lot's line must carry its strain before the clock");
    }
    // Canon 0.30.69: once the clock runs the silo throbs red and reads drying, the wet weight under it.
    assert(barnAfter.body.includes(`data-silo="${silo4Id}" data-silo-state="drying"`), "the loaded silo must read drying on the strip");
    assert(barnAfter.body.includes('<div class="silo-state silo-state-drying" data-silo-label>drying</div>'), "the word drying must replace filling once the clock runs");
    assert(barnAfter.body.includes('class="silo-fill silo-fill-red silo-throb"'), "the drying silo must throb red");
    // The PNS lot of the 0.27.2 walk is still weighing into Silo 3: that silo fills green beside the drying one.
    assert(barnAfter.body.includes(`data-silo="${drySpaceIdByName(lookupsPage.body, "Silo 3")}" data-silo-state="filling"`), "Silo 3 must read filling while its PNS lot still weighs");
    const liveAfterLoad = await (await req("/silos/live.json")).json();
    const silo4Live = liveAfterLoad.silos.find((x) => x.id === silo4Id);
    assert(silo4Live && silo4Live.state === "drying" && silo4Live.throb === "red" && Number(silo4Live.wetGrams) > 0, `live Silo 4 must be drying with its grams, got ${JSON.stringify(silo4Live)}`);
    assert(silo4Live.unloadedDryGrams === 0 && silo4Live.unloadPct === 0, "a drying silo carries no dry out yet");
    // THE UNLOADING SILO (canon 0.30.77; owner, verbatim: "All silos: if there
    // is weight in the lot's unload dry space fields, "unloading", throb blue,
    // show cap changes"): a dry weight at Unload Dry Space on the loaded lot
    // turns Silo 4 blue and reads unloading; the fill falls by the share of the
    // expected dry (1,132 g wet x 22% = 249.04 g) now out: 50 g is 20%.
    const dry1132 = await req(`/station/unload_dry_space/lot/${lot1132}/weights`, { method: "POST", body: form({ weight_grams: "50.00" }) });
    assert(dry1132.status === 303, `the loaded lot's dry weight expected 303 got ${dry1132.status}`);
    const unloadingStrip = await text("/station/load_silo");
    assert(unloadingStrip.body.includes(`data-silo="${silo4Id}" data-silo-state="unloading"`), "the silo with dry weight out must read unloading");
    assert(unloadingStrip.body.includes('<div class="silo-state silo-state-unloading" data-silo-label>unloading</div>'), "the word unloading must replace drying");
    assert(unloadingStrip.body.includes('class="silo-fill silo-fill-blue silo-throb"'), "the unloading silo must throb blue");
    assert(unloadingStrip.body.includes('<div class="silo-unload" data-silo-unload>Dry out <strong data-silo-unload-lb>0.11</strong> lb · <strong data-silo-unload-pct>20%</strong> of expected</div>'), "the cap change must read in words under the state");
    const liveUnloading = await (await req("/silos/live.json")).json();
    const silo4U = liveUnloading.silos.find((x) => x.id === silo4Id);
    assert(silo4U && silo4U.state === "unloading" && silo4U.fill === "blue" && silo4U.throb === "blue", `live Silo 4 must read unloading in blue, got ${JSON.stringify(silo4U)}`);
    assert(silo4U.unloadedDryGrams === 50 && silo4U.unloadLb === "0.11" && silo4U.unloadPct === 20, `live Silo 4 must carry the dry out, got ${JSON.stringify(silo4U)}`);
    assert(silo4U.level < silo4Live.level && Math.abs(silo4U.level - silo4Live.level * 0.8) < 1e-6, `the fill must fall to 80% of the loaded level, got ${silo4U.level} from ${silo4Live.level}`);
    assert(silo4U.wetGrams === silo4Live.wetGrams, "the wet weight under the silo stays the loaded wet");
    // The other silos are untouched: no other tile reads unloading.
    // (The stylesheet names the state too, for the wire's blue pulse; count the tiles and shapes alone.)
    assert((unloadingStrip.body.match(/data-silo="[^"]+" data-silo-state="unloading"/g) || []).length === 1, "only Silo 4's tile reads unloading");
    assert((unloadingStrip.body.match(/data-silo-shape data-silo-state="unloading"/g) || []).length === 1, "only Silo 4's shape reads unloading");
    // Voiding the dry row (with its reason) recomputes the lot's dry total and the silo reads drying again.
    const unloadPage1132 = await text(`/station/unload_dry_space?pick=${lot1132}`);
    const dryRow1132 = unloadPage1132.body.match(/<td>50<\/td>[^]*?href="\/record\/dry_weights\/([^/"]+)\/edit"/);
    assert(dryRow1132, "the unload page must list the 50.00 dry row with its pencil");
    const voidDry1132 = await req(`/record/dry_weights/${dryRow1132[1]}/void`, { method: "POST", body: form({ reason: "smoke: the unloading law seen, the tote goes back in" }) });
    assert(voidDry1132.status === 303, `voiding the dry row expected 303 got ${voidDry1132.status}`);
    const liveBackDrying = await (await req("/silos/live.json")).json();
    const silo4Back = liveBackDrying.silos.find((x) => x.id === silo4Id);
    assert(silo4Back && silo4Back.state === "drying" && silo4Back.throb === "red" && silo4Back.unloadedDryGrams === 0, `Silo 4 must read drying again once the dry row is voided, got ${JSON.stringify(silo4Back)}`);
    assert(Math.abs(silo4Back.level - silo4Live.level) < 1e-9, "the fill must return to the loaded level");
    // Owner ruling 2026-09-08 (canon 0.30.19, verbatim: "occupied silos should
    // not accept more product"): a second PNN lot waits in the barn; its form
    // greys Silo 4 with the occupant and a hand-built post at Silo 4 refuses in
    // words; Silo 1 takes it.
    const acquireSecond = await text("/station/acquire_hbn");
    const mkSecond = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({
        entry_date: "2026-09-08",
        farm_code: "PNN",
        license_value: "AU-G-C-000832",
        grow_method_code: "GH",
        strain_id: optionValue(acquireSecond.body, "Fruity Pebbles"),
      }),
    });
    assert(mkSecond.status === 303, `second PNN acquire expected 303 got ${mkSecond.status}`);
    const wetSecond = await text("/station/wet_weight");
    const pickSecond = (wetSecond.body.match(/\?pick=([a-f0-9-]{36})">\d+\. PNN \/ Fruity Pebbles \/ 2026-09-08/) || [])[1];
    assert(pickSecond, "wet pane missing the second PNN batch");
    const pickedSecond = await text(`/station/wet_weight?pick=${pickSecond}`);
    const startSecond = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        team_lead: "Smoke Lead",
        harvest_batch_id: pickSecond,
        actual_dryspc: silo4Id,
        notes: "0.30.19 occupied silo",
      }),
    });
    assert(startSecond.status === 303, `second lot start expected 303 got ${startSecond.status}`);
    const lotSecond = new URL(startSecond.headers.get("location") || "", base).searchParams.get("lot");
    assert(lotSecond, "no lot id for the second PNN lot");
    const wSecond = await req(`/station/wet_weight/lot/${lotSecond}/weights`, { method: "POST", body: form({ weight_grams: "640.00" }) });
    assert(wSecond.status === 303, `second lot weight expected 303 got ${wSecond.status}`);
    const finSecond = await req(`/station/wet_weight/lot/${lotSecond}/finish`, { method: "POST", body: form({}) });
    assert(finSecond.status === 303, `second lot finish expected 303 got ${finSecond.status}`);
    await passEntry(lotSecond);
    const secondPick = await text(`/station/load_silo?pick=${lotSecond}`);
    assert(secondPick.body.includes('action="/station/load_silo/load"'), "the second lot must open the load form from the barn");
    assert(
      new RegExp(`<option value="${silo4Id}" disabled data-occupied>Silo 4 \\(occupied: 26\\d{3}\\)</option>`).test(secondPick.body),
      "the occupied silo must grey in the select with its occupant"
    );
    assert(!secondPick.body.includes(`value="${silo4Id}" selected`), "an occupied planned silo must not preselect");
    assert(!secondPick.body.includes("data-silos-full"), "four silos are still free");
    const intoOccupied = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: lotSecond, dry_space_id: silo4Id, start_time: "", loaded_at_iso: "" }),
    });
    assert(intoOccupied.status === 400, `loading an occupied silo expected 400 got ${intoOccupied.status}`);
    assert((await intoOccupied.text()).includes("Silo 4 is occupied by lot"), "the occupied silo must refuse in words");
    const silo1Id = drySpaceIdByName(lookupsPage.body, "Silo 1");
    // THE EFFECTIVE DATE (canon 0.30.92; owner rulings 2026-09-16, verbatim: "We
    // need to quickly add a date override in the load silo screen - PIN gated:
    // 21319" and ""Effective Date" = field on all transactional records - always
    // pin gated - defaults to today and rarely needs to be touched."): the load
    // form carries the collapsed field reading today; another day refuses
    // without the Admin PIN, with the wrong PIN, without a Start time, or ahead
    // of today; under the PIN the typed time lands on that day (no script ran
    // here, so the farm's clock resolves it) and the change log says so.
    // THE FARM DAY BEGINS AT SIX (canon 0.30.151): the field's today is the farm day (6:00 AM Eastern rolls it), not the calendar day.
    const etToday = farmDaySmoke(new Date().toISOString());
    const etYesterday = dayBeforeSmoke(etToday);
    const etTomorrow = new Date(Date.parse(`${etToday}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);
    assert(secondPick.body.includes('<details class="effective-date" data-effective-date>'), "the load form must carry the Effective Date field");
    assert(secondPick.body.includes(`Effective Date: <span data-effective-summary>${etToday}</span>`), "the field must read the farm's day today");
    assert(new RegExp(`name="effective_date" value="${etToday}" max="${etToday}"`).test(secondPick.body), "the date must default to today and cap at today");
    assert(secondPick.body.includes('name="effective_pin"'), "the field must carry the Admin PIN box");
    assert(secondPick.body.includes("Any other day needs the Admin PIN."), "the field must say the law");
    const noPin = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: lotSecond, dry_space_id: silo1Id, start_time: "20:30", loaded_at_iso: "", effective_date: etYesterday, effective_pin: "" }),
    });
    assert(noPin.status === 403, `another day without the PIN expected 403 got ${noPin.status}`);
    assert((await noPin.text()).includes("Changing the Effective Date needs the Admin PIN."), "the refusal must name the PIN");
    const otherPin = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: lotSecond, dry_space_id: silo1Id, start_time: "20:30", loaded_at_iso: "", effective_date: etYesterday, effective_pin: MODELS_PIN }),
    });
    assert(otherPin.status === 403, `another day with the Models PIN expected 403 got ${otherPin.status}`);
    const noTime = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: lotSecond, dry_space_id: silo1Id, start_time: "", loaded_at_iso: "", effective_date: etYesterday, effective_pin: ADMIN_PIN }),
    });
    assert(noTime.status === 400, `another day without a Start time expected 400 got ${noTime.status}`);
    assert((await noTime.text()).includes("Type the Start time with an Effective Date other than today."), "the refusal must ask for the time");
    const ahead = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: lotSecond, dry_space_id: silo1Id, start_time: "08:00", loaded_at_iso: "", effective_date: etTomorrow, effective_pin: ADMIN_PIN }),
    });
    assert(ahead.status === 400, `a day ahead of today expected 400 got ${ahead.status}`);
    assert((await ahead.text()).includes("The Effective Date cannot be ahead of today."), "the refusal must name tomorrow");
    const stillWaiting = await text("/station/load_silo");
    assert((stillWaiting.body.match(/data-load="/g) || []).length === 1, "four refusals must load nothing");
    const intoFree = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: lotSecond, dry_space_id: silo1Id, start_time: "20:30", loaded_at_iso: "", effective_date: etYesterday, effective_pin: ADMIN_PIN }),
    });
    assert(intoFree.status === 303, `loading a free silo on the Effective Date expected 303 got ${intoFree.status}`);
    const effectiveLoadId = new URL(intoFree.headers.get("location") || "", base).searchParams.get("load");
    assert(effectiveLoadId, "no load id for the Effective Date load");
    const effectiveIso = etInstantSmoke(etYesterday, "20:30");
    const effectivePage = await text(`/station/load_silo?load=${effectiveLoadId}`);
    assert(effectivePage.body.includes(`<time datetime="${effectiveIso}" data-local>`), `the loaded time must be 20:30 on ${etYesterday} Eastern (${effectiveIso})`);
    const effectiveLog = await text("/log");
    assert(effectiveLog.body.includes("effective date set under the Admin PIN"), "the override must land in the change log under its reason");
    const stripTwo = await text("/station/load_silo");
    assert((stripTwo.body.match(/data-load="/g) || []).length === 2, "the strip must show two loads in two silos");
    // Canon 0.30.23, the owner's picture: material sitting in a PNN silo heads
    // under PNN whatever farm it came from; the origin rides as its own column.
    const siteReport = await text("/reports/inventory_by_location");
    assert(siteReport.body.includes('data-report-group="PNN"'), "the report must head the PNN run with its site");
    assert(siteReport.body.includes("<td>Silo 1</td><td>PNN</td><td>WIP</td>"), "a PNN silo must sit under the PNN header with its origin farm beside it");
    assert(!/<td>ARL<\/td><td>Silo \d<\/td>/.test(siteReport.body), "no silo may read as an ARL location");
    const siteCsv = await text("/reports/inventory_by_location?format=csv");
    assert(siteCsv.body.startsWith("Site,Location,Origin farm,Product type,Total,UOM"), "the csv must lead with Site");
    const pauseIt = await req(`/station/load_silo/${loadId}/pause`, { method: "POST", body: form({}) });
    assert(pauseIt.status === 303, `pause expected 303 got ${pauseIt.status}`);
    const pausedPage = await text(`/station/load_silo?load=${loadId}`);
    assert(pausedPage.body.includes('data-state="paused"') && pausedPage.body.includes(">Resume</button>"), "Pause must pause and offer Resume");
    const resumeIt = await req(`/station/load_silo/${loadId}/pause`, { method: "POST", body: form({}) });
    assert(resumeIt.status === 303, `resume expected 303 got ${resumeIt.status}`);
    const resumedPage = await text(`/station/load_silo?load=${loadId}`);
    assert(resumedPage.body.includes('data-state="running"'), "Resume must run the clock again");
    const startAgain = await req(`/station/load_silo/${loadId}/start`, { method: "POST", body: form({}) });
    assert(startAgain.status === 303, "a second Start is a no-op, never a reset");
    const unloadStrip = await text("/station/unload_dry_space");
    assert(unloadStrip.body.includes("data-silo-strip"), "the silo strip must ride the unload station");
    const lcUploads = await text("/admin/uploads");
    assert(lcUploads.body.includes("Location changes"), "the export home must list Location changes");
    assert(lcUploads.body.includes(`/admin/uploads/location_change/${loadId}.csv`), "the location change file must pend");
    const lcCsv = await text(`/admin/uploads/location_change/${loadId}.csv`);
    assert(lcCsv.res.status === 200, `location change csv expected 200 got ${lcCsv.res.status}`);
    assert(lcCsv.body.startsWith("Label,Location,Sublocation,MoveDate\r\n"), "location change csv header mismatch");
    assert(lcCsv.body.includes(",Silo 4,,"), "the location change must address the silo");
    const lcMark = await req(`/admin/uploads/location_change/${loadId}/uploaded`, { method: "POST", body: form({}) });
    assert(lcMark.status === 303, `location change mark expected 303 got ${lcMark.status}`);
    const lcAfter = await text("/admin/uploads");
    assert(!lcAfter.body.includes(`/admin/uploads/location_change/${loadId}.csv`), "a marked location change must leave the list");

    // Fork 4 (canon 0.30.1): Patrick's strain table landed (0033) and the list
    // is exposed and functional in Admin lookups, codes included.
    const strainAdmin = await text("/admin/lookups/strains");
    assert(strainAdmin.body.includes("Electric Grape Diesel"), "the misspelled strain must seed renamed Electric");
    assert(!strainAdmin.body.includes("Elecetric"), "the old spelling must be gone");
    assert(strainAdmin.body.includes("Banana Berry Wine"), "Banana Berry Wine must seed");
    assert(strainAdmin.body.includes("096"), "Banana Berry Wine must carry the resolved code 096");
    assert(strainAdmin.body.includes("Zuava"), "the Maine block must seed through Zuava");
    assert(strainAdmin.body.includes('name="hbn_code"'), "the strain add form must expose the code");

    // Fork 6 (canon 0.30.1): the Admin-buried manual HBN fallback.
    const manualPage = await text("/admin/manual-hbn");
    assert(manualPage.res.status === 200, `manual hbn page expected 200 got ${manualPage.res.status}`);
    assert(manualPage.body.includes('name="hbn"'), "manual hbn page missing the HBN field");
    assert(manualPage.body.includes('name="reason"'), "manual hbn demands a reason");
    const manualStrain = optionValue(manualPage.body, "Fruity Pebbles");
    const manualPost = await req("/admin/manual-hbn", {
      method: "POST",
      body: form({
        hbn: "26250-ARL-GH-027-0-NA-26900",
        entry_date: "2026-09-07",
        farm_code: "ARL",
        license_value: "AU-G-C-001509",
        grow_method_code: "GH",
        strain_id: manualStrain,
        reason: "smoke: the system failed",
      }),
    });
    assert(manualPost.status === 303, `manual hbn expected 303 got ${manualPost.status}`);
    const manualDupe = await req("/admin/manual-hbn", {
      method: "POST",
      body: form({
        hbn: "26251-ARL-GH-027-0-NA-26900",
        entry_date: "2026-09-07",
        farm_code: "ARL",
        license_value: "AU-G-C-001509",
        grow_method_code: "GH",
        strain_id: manualStrain,
        reason: "smoke: dupe serial",
      }),
    });
    assert(manualDupe.status === 409, `a taken manual serial expected 409 got ${manualDupe.status}`);
    const manualQueue = await text("/station/wet_weight");
    assert(manualQueue.body.includes("pick="), "the manual HBN must land in the queue like any other");
    const adminTiles = await text("/admin");
    assert(adminTiles.body.includes('href="/admin/manual-hbn"'), "Admin must carry the buried Manual HBN tile");

    // Owner word 2026-09-06 (canon 0.27.5): weighing lots get their Data Queues
    // place, the last record class without a surfaced reasoned Void. The PNS
    // walk lot is weighing right now, so it must ride the section with Void.
    const queuesFinal = await text("/admin/queues");
    assert(queuesFinal.body.includes("Weighing Queue"), "data queues missing the Weighing Queue section");
    assert(
      queuesFinal.body.includes(`href="/record/wet_weight_entries/${pnsLotId}/void"`),
      "the weighing lot must carry the reasoned Void in the Weighing Queue"
    );

    // Owner ruling 2026-09-06 (canon 0.27.6): every interco container empty
    // line reads "- EMPTY -". The builder's empty lists show it.
    const partnersEmpty = await text("/logistics/partners");
    assert(partnersEmpty.body.includes("- EMPTY -"), "Processing Partners must read - EMPTY -");
    assert(!partnersEmpty.body.includes("No packages in this barn."), "the old barn empty line must be gone");
    for (const gone of [
      "Nothing in this barn.",
      "No items ready to move.",
      "Nothing on the road.",
      "No trucks on the road.",
      "No inbound movements.",
    ]) {
      assert(!partnersEmpty.body.includes(gone), `the floor must not read ${gone}`);
    }

    // Owner rulings 2026-09-07 (canon 0.29.0): the Continuum 10 Vendors and
    // Equipment remake plus the Preventive Maintenance system.
    const vendors = await text("/vendors-equipment");
    assert(vendors.res.status === 200, `vendors page expected 200 got ${vendors.res.status}`);
    assert(vendors.body.includes("Strategic Partners"), "vendors page missing Strategic Partners");
    for (const p of ["Athena", "VIST", "Twister", "T1 Logistics"]) {
      assert(vendors.body.includes(p), `vendors page missing partner ${p}`);
      assert(!vendors.body.includes(`<h3>${p}</h3>`), `vendor blurb ${p} must not head with its name (canon 0.30.12)`);
    }
    // Canon 0.30.12: the VIST logo leads its card and serves through the asset route;
    // the shell is the inverted ink ground.
    assert(vendors.body.includes('src="/continuum/logo-vist.png"'), "the VIST card must carry its logo");
    const vistLogo = await req("/continuum/logo-vist.png");
    assert(vistLogo.status === 200, `VIST logo expected 200 got ${vistLogo.status}`);
    // Canon 0.30.14: the Twister logo is a jpg; the asset route serves it as one.
    assert(vendors.body.includes('src="/continuum/logo-twister.jpg"'), "the Twister card must carry its logo");
    const twisterLogo = await req("/continuum/logo-twister.jpg");
    assert(twisterLogo.status === 200, `Twister logo expected 200 got ${twisterLogo.status}`);
    assert((twisterLogo.headers.get("content-type") || "").startsWith("image/jpeg"), "a jpg logo must serve as image/jpeg");
    // Canon 0.30.22 ("For T1"): the T1 mark leads its card; only Athena still holds a wordmark.
    assert(vendors.body.includes('src="/continuum/logo-t1-logistics.png"'), "the T1 card must carry its logo");
    const t1Logo = await req("/continuum/logo-t1-logistics.png");
    assert(t1Logo.status === 200, `T1 logo expected 200 got ${t1Logo.status}`);
    assert((t1Logo.headers.get("content-type") || "").startsWith("image/png"), "a png logo must serve as image/png");
    assert((vendors.body.match(/data-wordmark/g) || []).length === 1, "only the Athena card should still hold a wordmark");
    const badExt = await req("/continuum/logo-twister.svg");
    assert(badExt.status === 404, `an unlisted asset type expected 404 got ${badExt.status}`);
    assert(vendors.body.includes("--bg: #14120e") && !vendors.body.includes("#f6f4ef"), "the Continuum pages must render the inverted tokens");
    assert(vendors.body.includes('href="/equipment"'), "vendors page must link the PM system");
    assert(vendors.body.includes('class="shots"'), "vendors page missing the screenshot slider");
    assert(!vendors.body.includes("Equipment ROI"), "the Equipment ROI tool must be replaced");
    const eqHome = await text("/equipment");
    assert(eqHome.res.status === 200, `equipment expected 200 got ${eqHome.res.status}`);
    assert(eqHome.body.includes("Preventive Maintenance"), "equipment page missing its title");
    assert(eqHome.body.includes("GF-EQ-0001"), "equipment page missing the first serial");
    assert(eqHome.body.includes("GF-EQ-0049"), "equipment page missing the last serial");
    assert(eqHome.body.includes("1 open"), "equipment page must show open ticket counts");
    const eqAssetId = (eqHome.body.match(/href="\/equipment\/([a-f0-9-]{36})"/) || [])[1];
    assert(eqAssetId, "equipment page missing asset links");
    const eqAsset = await text(`/equipment/${eqAssetId}`);
    assert(eqAsset.res.status === 200, `asset page expected 200 got ${eqAsset.res.status}`);
    assert(eqAsset.body.includes("Recurring PM"), "asset page missing the schedule section");
    // Canon 0.30.12 (his words: "Replace all the hand sign offs with the names
    // "Kieth", "Les", or "Austin".  Kieth will almost always be the one managing
    // RTUs"): the signature is a select of the names; a typed name refuses; an
    // RTU asset starts on Kieth, every other asset starts blank.
    assert(eqAsset.body.includes('<select name="signed_by" required>'), "asset page must sign with the sign-off names");
    assert(!eqAsset.body.includes('placeholder="Hand signed by"'), "the typed signature must be gone");
    assert(eqAsset.body.includes('<option value="Kieth">Kieth</option>') || eqAsset.body.includes('<option value="Kieth" selected>Kieth</option>'), "the signature select must offer Kieth");
    const eqSchedId = (eqAsset.body.match(/name="schedule_id" value="([a-f0-9-]{36})"/) || [])[1];
    assert(eqSchedId, "asset page missing the schedule id");
    const typedSign = await req("/equipment/pm-done", {
      method: "POST",
      body: form({ schedule_id: eqSchedId, signed_by: "the smoke, hand signed", notes: "walked it" }),
    });
    assert(typedSign.status === 400, `a typed signature expected 400 got ${typedSign.status}`);
    const pmSign = await req("/equipment/pm-done", {
      method: "POST",
      body: form({ schedule_id: eqSchedId, signed_by: "Les", notes: "walked it" }),
    });
    assert(pmSign.status === 303, `PM sign expected 303 got ${pmSign.status}`);
    const eqAfter = await text(`/equipment/${eqAssetId}`);
    assert(/<td>Les<\/td><td>walked it<\/td>/.test(eqAfter.body), "the PM history must carry the signature");
    const rtuId = (eqHome.body.match(/href="\/equipment\/([a-f0-9-]{36})">RTU 1<\/a>/) || [])[1];
    assert(rtuId, "equipment page must link RTU 1");
    const rtuPage = await text(`/equipment/${rtuId}`);
    assert(rtuPage.body.includes("RTU 1"), "the RTU page must be RTU 1");
    assert(rtuPage.body.includes('<option value="Kieth" selected>Kieth</option>'), "an RTU must start its signature on Kieth");
    const adminHome = await text("/admin");
    assert(adminHome.body.includes('href="/vendors-equipment"'), "Admin must link the Vendors and Equipment page");
    assert(adminHome.body.includes('href="/erp-software"'), "Admin must carry the ERP backdoor link");
    const erp = await text("/erp-software");
    assert(erp.res.status === 200, `erp page expected 200 got ${erp.res.status}`);
    assert(erp.body.includes("What is an ERP?"), "erp page missing its first heading");
    assert(erp.body.includes("We made both"), "erp page missing the both-systems card");
    assert(erp.body.includes("GripFactory"), "erp page missing GripFactory");
    assert(erp.body.includes('class="shots"'), "erp page missing the screenshot slider");
    assert(erp.body.includes("Goto GripFactory"), "erp page missing the Goto GripFactory link");
    assert(erp.body.includes("ERP P&amp;L Simulator"), "erp page must keep the P and L simulator tool");
    const pmShot = await req("/continuum/pm-1.png");
    assert(pmShot.status === 200, `pm screenshot expected 200 got ${pmShot.status}`);

    // Owner ruling 2026-09-07 (canon 0.29.5): the Compliance Testing page,
    // same C10 pattern, real screenshots of the real console, Admin-linked.
    const ctPage = await text("/compliance-testing");
    assert(ctPage.res.status === 200, `compliance testing page expected 200 got ${ctPage.res.status}`);
    assert(ctPage.body.includes("The test is the gate"), "ct page missing its lede heading");
    assert(ctPage.body.includes("External: the state lab"), "ct page missing the external lane card");
    assert(ctPage.body.includes("Internal: we test first"), "ct page missing the internal lane card");
    assert(ctPage.body.includes("Orange Photonics"), "ct page missing the Orange Photonics lane");
    assert(ctPage.body.includes("Aqualab"), "ct page missing the Aqualab lane");
    assert(ctPage.body.includes('class="shots"'), "ct page missing the screenshot slider");
    assert(ctPage.body.includes("/continuum/ct-1.png"), "ct page missing the first real screenshot");
    assert(ctPage.body.includes("Open the Compliance Console"), "ct page missing the console pill");
    assert(adminHome.body.includes('href="/compliance-testing"'), "Admin must carry the Compliance Testing tile");
    const ctShot = await req("/continuum/ct-1.png");
    assert(ctShot.status === 200, `ct screenshot expected 200 got ${ctShot.status}`);

    // Owner ruling 2026-09-09 (canon 0.30.27, verbatim: "I need this entire app
    // hosted on a button in Admin with the dark (inverted) continuum theme and
    // the "back to continuum" link (exactly the same format as the other
    // pages)"), then canon 0.30.30 with two pictures of the live page ("Remove
    // all of this, make the CSS match the inverted continuum" over the crumb,
    // masthead, rule and lede; "Remove this" over the Tools pill): the page IS
    // the vendored Harvest Console Lite, whole, with the inverted Continuum skin
    // spliced in before its closing head tag at serve time; the file on disk is
    // untouched; the old /app path redirects; the Admin tile opens it.
    assert(adminHome.body.includes('href="/harvest-console"'), "Admin must carry the Harvest Console tile");
    const hcApp = await text("/harvest-console");
    assert(hcApp.res.status === 200, `harvest console expected 200 got ${hcApp.res.status}`);
    assert((hcApp.res.headers.get("content-type") || "").startsWith("text/html"), "the harvest console must serve as text/html");
    assert(hcApp.res.headers.get("cache-control") === "no-store", "the harvest console must serve no-store so a replaced file lands at once");
    assert(/<title>Harvest Console Lite v\d+\.\d+<\/title>/.test(hcApp.body), "the served page must be the Harvest Console Lite document");
    const hcVendored = readFileSync(join(appRoot, "public", "harvest-console", "harvest-console-lite.html"), "utf8");
    const hcSkinAt = hcApp.body.indexOf('<style id="gf-c10-inverted-skin">');
    assert(hcSkinAt !== -1, "the served app must carry the inverted Continuum skin");
    assert((hcApp.body.match(/gf-c10-inverted-skin/g) || []).length === 1, "the skin must splice in exactly once");
    const hcSkinEnd = hcApp.body.indexOf("</style>\n", hcSkinAt) + "</style>\n".length;
    assert(hcSkinEnd > hcSkinAt, "the skin must close");
    assert(hcApp.body.slice(hcSkinEnd).startsWith("</head>"), "the skin must sit right before the closing head tag");
    // Canon 0.30.32 ("Add "back to continuum" link to the harvest console lite
    // screen"): the crumb rides the app's own header bar, once, right of the
    // brand and before the spacer that pushes the zoom and language pills over.
    const HC_CRUMB = '<a id="gf-continuum-crumb" class="gf-continuum-crumb" href="https://gripcontinuum.gripcannabis.com/#/">&#8592; Back to the Continuum 10</a>\n  ';
    assert((hcApp.body.match(/id="gf-continuum-crumb"/g) || []).length === 1, "the harvest console must carry the Continuum crumb exactly once");
    const hcHeaderAt = hcApp.body.indexOf('<header id="lt-chrome">');
    const hcCrumbAt = hcApp.body.indexOf(HC_CRUMB);
    assert(hcHeaderAt !== -1 && hcCrumbAt > hcHeaderAt && hcCrumbAt < hcApp.body.indexOf("</header>", hcHeaderAt), "the crumb must sit inside the app's header bar");
    assert(hcCrumbAt > hcApp.body.indexOf('<div class="brand">', hcHeaderAt), "the crumb must follow the brand block");
    assert(hcApp.body.slice(hcCrumbAt + HC_CRUMB.length).startsWith('<div class="spacer"></div>'), "the crumb must stand right before the header's spacer");
    const hcLifted = (hcApp.body.slice(0, hcSkinAt) + hcApp.body.slice(hcSkinEnd)).replace(HC_CRUMB, "");
    assert(hcLifted === hcVendored, "with the skin and the crumb lifted out, the served app must be the vendored file byte for byte");
    const hcSkin = hcApp.body.slice(hcSkinAt, hcSkinEnd);
    for (const token of ["--bg: #14120e", "--panel: #1e1b16", "--panel-2: #27231c", "--accent: #d19a4e", "--accent-2: #e5b673", "--text: #f1ede4", "--text-mute: #a79f8f", "--alert: #e0785c"]) {
      assert(hcSkin.includes(token), `the skin must carry the inverted token ${token}`);
    }
    assert(hcSkin.includes("repeating-linear-gradient(115deg"), "the skin must lay the shell's diagonal rule on the app's body");
    assert(hcSkin.includes(".gf-continuum-crumb {"), "the skin must style the crumb (canon 0.30.32)");
    // The 0.30.27 shell is gone: no crumb, no masthead, no lede, no Tools pill, no frame.
    // (The app's own zoom and language pills are class="pill" too; the shell's
    // Tools pill was an anchor, pinned by its href.)
    for (const gone of ['class="crumb"', "<h1>Harvest Console</h1>", 'class="masthead"', 'class="lede"', "<h2>Tools</h2>", '<a class="pill" href=', 'class="node-frame"', "<iframe"]) {
      assert(!hcApp.body.includes(gone), `the harvest console must carry none of the old shell (${gone})`);
    }
    assert(!hcApp.body.includes('class="app-bar"'), "the vendored app must stream with no app shell around it");
    // The file is the owner's, replaced by copy and never edited here (its
    // sha256 stands in the session report and canon). What IS law: it stays one
    // self-contained document that makes no external requests.
    // (Checked on the vendored bytes as served, our two splices lifted out: the
    // crumb is our link to the Continuum, not a request the app makes.)
    for (const leak of [/src="https?:\/\//, /href="https?:\/\//, /fetch\(/, /XMLHttpRequest/]) {
      assert(!leak.test(hcLifted), `the vendored app must make no external requests (${leak})`);
    }
    assert((hcApp.body.match(/href="https?:\/\//g) || []).length === 1, "the only outbound link on the screen is the Continuum crumb");
    const hcLegacy = await req("/harvest-console/app");
    assert(hcLegacy.status === 302, `the old /harvest-console/app path expected 302 got ${hcLegacy.status}`);
    assert((hcLegacy.headers.get("location") || "").endsWith("/harvest-console"), "the old /app path must redirect to /harvest-console");

    // THE BLANK SLATE (canon 0.30.108): the bucked arrival that stood here (the
    // main walk's 500 g truck received one-button at PNN) has no road to ride;
    // a PNN lot weighed bucked into Silo 5 births its WIP package straight in
    // PNN's barn under 832 at Finish lot. THE TAG LAW (canon 0.30.38, fork F4):
    // the tag typed at Finish lot rides onto the born package, upper-cased.
    const TRUCK_TAG = "1A4050300000000000000E01";
    const acquireTag = await text("/station/acquire_hbn");
    const mkTag = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({ entry_date: "2026-09-01", farm_code: "PNN", grow_method_code: "ID", strain_id: optionValue(acquireTag.body, "Fruity Pebbles") }),
    });
    assert(mkTag.status === 303, `tagged-lot HBN acquire expected 303 got ${mkTag.status} ${await mkTag.text()}`);
    const tagHbn = new URL(mkTag.headers.get("location") || "", base).searchParams.get("minted");
    assert(tagHbn && tagHbn.includes("-PNN-"), `the tagged lot's HBN must be minted at PNN, got ${tagHbn}`);
    const wetTag = await text("/station/wet_weight");
    let tagBatchId = null;
    for (const m of wetTag.body.matchAll(/\?pick=([a-f0-9-]{36})">\d+\. PNN \//g)) {
      const page = await text(`/station/wet_weight?pick=${m[1]}`);
      if (page.body.includes(`<p class="muted">${tagHbn}</p>`)) {
        tagBatchId = m[1];
        break;
      }
    }
    assert(tagBatchId, "the wet pane must list the tagged lot's HBN among the PNN rows");
    const startTag = await req("/station/wet_weight", {
      method: "POST",
      body: form({ team_lead: "Smoke Lead", harvest_batch_id: tagBatchId, actual_dryspc: silo5Id, notes: "0.30.108 tagged birth" }),
    });
    assert(startTag.status === 303, `tagged lot start expected 303 got ${startTag.status} ${await startTag.text()}`);
    const truckLotId = new URL(startTag.headers.get("location") || "", base).searchParams.get("lot");
    assert(truckLotId, "no lot id for the tagged birth");
    const wTag = await req(`/station/wet_weight/lot/${truckLotId}/weights`, { method: "POST", body: form({ weight_grams: "500.00" }) });
    assert(wTag.status === 303, `tagged lot weight expected 303 got ${wTag.status}`);
    const finTag = await req(`/station/wet_weight/lot/${truckLotId}/finish`, {
      method: "POST",
      body: form({ metrc_tag: TRUCK_TAG.toLowerCase() }),
    });
    assert(finTag.status === 303, `tagged lot finish expected 303 got ${finTag.status} ${await finTag.text()}`);
    const invAfterBucked = await text("/reports/inventory_by_location?format=csv");
    assert(
      /^PNN,BARN,PNN,WIP/m.test(invAfterBucked.body),
      "the bucked lot must birth WIP into PNN's barn from the lot's own form"
    );
    const invTagged = await text("/inventory");
    assert(invTagged.body.includes(`<code>${TRUCK_TAG}</code>`), "the born package must show its METRC tag, upper-cased, on the ledger");
    assert(invTagged.body.includes("no METRC tag yet"), "packages without a tag must say so on the ledger");
    const tagScope = await text(`/inventory/change-locations?kind=packages&farm=PNN&license=${encodeURIComponent("AU-G-C-000832")}`);
    assert(tagScope.body.includes(`<option value="${TRUCK_TAG}"`) && new RegExp(`${TRUCK_TAG} / [^<]* / 500 g / BARN<`).test(tagScope.body), "the tagged package must sit under 832 at BARN with its 500 g");
    const uploadsTag = await text("/admin/uploads");
    assert(!uploadsTag.body.includes("/admin/uploads/receive_manifest/"), "no receive file pends: nothing arrives in the app any more");
    assert(uploadsTag.body.includes("no METRC tag yet"), "the export home must mark files that would print an internal code");

    // THE METRC MIRROR (canon 0.30.38, forks F1 and F2): the tile, the empty
    // pane, the registry, a plants xlsx as METRC writes it, a packages CSV, the
    // re-drop that updates and marks gone, the tag lookup with our fields, and
    // the refusals in words.
    const invTiles = await text("/inventory");
    assert(invTiles.body.includes('href="/inventory/metrc"') && invTiles.body.includes("METRC Mirror"), "the Inventory node must carry the METRC Mirror tile");
    const metrc0 = await text("/inventory/metrc");
    assert(metrc0.res.status === 200, `METRC pane expected 200 got ${metrc0.res.status}`);
    assert(metrc0.body.includes("data-metrc-empty"), "the mirror must say it is empty before a drop");
    assert(metrc0.body.includes("data-metrc-mount-form"), "the mirror must carry the drop form");
    for (const lic of ["AU-G-C-000832", "AU-P-000694", "GR-C-001132", "AU-G-C-001509", "GR-C-002600", "AU-G-C-001397", "GR-C-001405"]) {
      assert(metrc0.body.includes(`<option value="${lic}">`), `the drop form must offer ${lic}`);
    }
    const registry = await text("/admin/lookups/internal_fields");
    for (const key of ["location_code", "quality", "market_strain", "zoho_sku", "lane", "notes"]) {
      assert(registry.body.includes(`<td>${key}</td>`), `Internal fields must seed ${key} (0042)`);
    }
    assert(registry.body.includes('name="tone" placeholder="plants, packages, or blank for both"'), "the registry add form must ask what a field applies to");
    const lookupsLandingMetrc = await text("/admin/lookups");
    assert(lookupsLandingMetrc.body.includes('href="/admin/lookups/internal_fields"'), "Data Lookups must link the Internal fields registry");

    const plantsXlsx = buildPlantsXlsx([
      ["1A4050000000000000000101", "Bermuda Triangle", "West 3", "", false, "Bermuda Triangle 5/27/2026", "Seed", 46169, 46237, 0],
      ["1A4050000000000000000102", "Bermuda Triangle", "West 3", "", false, "Bermuda Triangle 5/27/2026", "Seed", 46169, 46237, 0],
      ["1A4050000000000000000103", "Bermuda Triangle", "West 4", "", true, "Bermuda Triangle 5/27/2026", "Clone", 46169, 46237, 0],
    ]);
    const plantsForm = new FormData();
    plantsForm.append("file", new File([plantsXlsx], "MetrcMichiganGRC002600PlantsFlowering.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const plantsMount = await req("/inventory/metrc/mount", { method: "POST", body: plantsForm });
    assert(plantsMount.status === 303, `plants mount expected 303 got ${plantsMount.status} ${await plantsMount.text()}`);
    const plantsLoc = plantsMount.headers.get("location") || "";
    assert(plantsLoc.includes("ok=mounted") && plantsLoc.includes("kind=plants") && plantsLoc.includes("added=3"), `plants mount must add 3, got ${plantsLoc}`);
    const metrc1 = await text(plantsLoc);
    assert(metrc1.body.includes('data-metrc-license="GR-C-002600"'), "the mirror must list GR-C-002600 after the plants drop");
    assert(/data-metrc-license="GR-C-002600">\s*<td><code>GR-C-002600<\/code><\/td>\s*<td>3<\/td>\s*<td>0<\/td>/.test(metrc1.body), "GR-C-002600 must read 3 flowering, 0 vegetative");
    assert(metrc1.body.includes("Mounted: plants, 3 added, 0 updated, 0 gone."), "the plants flash must read 3 added");
    assert(metrc1.body.includes("MetrcMichiganGRC002600PlantsFlowering.xlsx") && metrc1.body.includes("<span class=\"muted\">xlsx</span>"), "the mounts table must name the xlsx");

    const PKG_KNOWN = "1A4050300000000000000E02";
    const packagesCsv = (variant) => {
      const head = "Tag,Source Harvest(s),Source Package(s),Original Source Package Label,Source Processing Job(s),Location,Sublocation,Item,Category,Item Strain,Quantity,Unit Of Measure,Production Batch Number,Source Production Batch,Lab Test Status,Finished Goods,Administrative Hold,Administrative Recall,Packaged Date,Received,Expiration Date,Lab Test Expiration";
      const rows = [
        `${TRUCK_TAG},46258-PNN-ID-062-0-NA-26007,,,,Barn,,WIP - Placeholder - PNN - I,Buds,Placeholder,${variant === "later" ? "480" : "500"},g,,,NotSubmitted,False,False,False,9/1/2026 12:00:00 AM,,,`,
        `${SKU_BULK},45951-PNN-OD-051-0-02-25162,,,,24.2.A,,BUD - Donny Burger - PNS - O,Buds,Donny Burger,336,g,,,TestPassed,False,False,False,2025-12-01,2025-12-02,,`,
      ];
      if (variant !== "later") rows.push(`${PKG_KNOWN},45951-PNN-OD-051-0-02-25162,,,,Vault,,GRIP Vape - Elsewhere - 2g,Vape Cart,,"1,234",ea,,,TestPassed,False,False,False,2025-12-01,2025-12-02,,`);
      return `${head}\r\n${rows.join("\r\n")}\r\n`;
    };
    const pkgForm = new FormData();
    pkgForm.append("file", new File([new TextEncoder().encode(packagesCsv("first"))], "MetrcMichiganAUGC000832PackagesActive_12.csv", { type: "text/csv" }));
    const pkgMount = await req("/inventory/metrc/mount", { method: "POST", body: pkgForm });
    assert(pkgMount.status === 303, `packages mount expected 303 got ${pkgMount.status} ${await pkgMount.text()}`);
    const pkgLoc = pkgMount.headers.get("location") || "";
    assert(pkgLoc.includes("kind=packages") && pkgLoc.includes("added=3") && pkgLoc.includes("gone=0"), `packages mount must add 3, got ${pkgLoc}`);
    const metrc2 = await text(pkgLoc);
    assert(/data-metrc-license="AU-G-C-000832">\s*<td><code>AU-G-C-000832<\/code><\/td>\s*<td>0<\/td>\s*<td>0<\/td>\s*<td>3<\/td>\s*<td>836<\/td>\s*<td>1,234<\/td>/.test(metrc2.body), "AU-G-C-000832 must read 3 packages, 836 g, 1,234 eaches");
    // Three pictures: the received truck package is a ledger package in METRC;
    // the Zoho bulk SKU mounted earlier is a Zoho offering in METRC.
    assert(/data-cross="ledger_tagged">\d+ \((?!0 in METRC)/.test(metrc2.body), "the ledger's tagged package must read as in METRC");
    assert(metrc2.body.includes('data-cross="metrc_active">3 ('), "the mirror must count 3 active packages");
    assert(/data-cross="zoho_tagged">\d+ \((?!0 in METRC)/.test(metrc2.body), "the Zoho bulk SKU must read as in METRC");

    // The re-drop: the truck package's grams move, the vape row is gone.
    const pkgForm2 = new FormData();
    pkgForm2.append("file", new File([new TextEncoder().encode(packagesCsv("later"))], "MetrcMichiganAUGC000832PackagesActive_13.csv", { type: "text/csv" }));
    const pkgMount2 = await req("/inventory/metrc/mount", { method: "POST", body: pkgForm2 });
    assert(pkgMount2.status === 303, `packages remount expected 303 got ${pkgMount2.status}`);
    const pkgLoc2 = pkgMount2.headers.get("location") || "";
    assert(pkgLoc2.includes("added=0") && pkgLoc2.includes("updated=1") && pkgLoc2.includes("gone=1"), `packages remount must read 0 added, 1 updated, 1 gone, got ${pkgLoc2}`);
    const gone = await text(`/inventory/metrc?tag=${PKG_KNOWN}`);
    assert(gone.body.includes('data-metrc-record="package"'), "the gone vape row must still be found by tag");
    assert(!/data-metrc-field="gone_at"><span class="muted">-<\/span>/.test(gone.body), "the gone vape row must carry its gone date");
    const moved = await text(`/inventory/metrc?tag=${TRUCK_TAG.toLowerCase()}`);
    assert(moved.body.includes('data-metrc-field="quantity">480</dd>'), "the re-drop must move the truck package to 480 g");
    assert(moved.body.includes("<dt>Source Harvest(s)</dt>"), "the record card must speak METRC's column names");
    assert(moved.body.includes('data-internal-field="quality"') && moved.body.includes('data-internal-field="notes"'), "a package card must offer the package and both-kind fields");
    assert(!moved.body.includes('data-internal-field="nothing"'), "no unregistered field renders");

    // Our own field on the state's record, with a reason, logged.
    const noReason = await req("/inventory/metrc/field", { method: "POST", body: form({ tag: TRUCK_TAG, field_key: "quality", value: "A" }) });
    assert(noReason.status === 400, `a field set without a reason expected 400 got ${noReason.status}`);
    const setField = await req("/inventory/metrc/field", { method: "POST", body: form({ tag: TRUCK_TAG, field_key: "quality", value: "A", reason: "smoke: graded on the floor" }) });
    assert(setField.status === 303, `field set expected 303 got ${setField.status}`);
    const withField = await text(`/inventory/metrc?tag=${TRUCK_TAG}&ok=field`);
    assert(withField.body.includes("Field saved."), "the field flash must show");
    assert(/data-internal-field="quality">\s*<td>Quality grade<\/td>\s*<td>A<\/td>/.test(withField.body), "the quality grade must read A on the card");
    const unknownField = await req("/inventory/metrc/field", { method: "POST", body: form({ tag: TRUCK_TAG, field_key: "nothing", value: "x", reason: "smoke" }) });
    assert(unknownField.status === 400, `an unregistered field expected 400 got ${unknownField.status}`);
    const unknownTag = await req("/inventory/metrc/field", { method: "POST", body: form({ tag: "1A4050300000000000000FFF", field_key: "quality", value: "x", reason: "smoke" }) });
    assert(unknownTag.status === 404, `a tag the mirror does not know expected 404 got ${unknownTag.status}`);
    const plantCard = await text("/inventory/metrc?tag=1A4050000000000000000103");
    assert(plantCard.body.includes('data-metrc-record="plant"') && plantCard.body.includes('data-metrc-field="hold">Yes</dd>'), "the plant card must read the hold");
    assert(!plantCard.body.includes('data-internal-field="quality"') && plantCard.body.includes('data-internal-field="notes"'), "a plant card offers only plant and both-kind fields");
    assert(plantCard.body.includes('data-metrc-field="plant_batch_date">2026-05-27</dd>'), "the plant card must read the batch date from the xlsx serial");

    // Refusals in words: a Zoho export is not METRC's grid; a name with no
    // license and no pick; a plants CSV with no phase anywhere.
    const notMetrc = new FormData();
    notMetrc.append("file", new File([new TextEncoder().encode("Item ID,SKU,Stock On Hand\r\n1,x,2\r\n")], "Item 2.csv", { type: "text/csv" }));
    const notMetrcRes = await req("/inventory/metrc/mount", { method: "POST", body: notMetrc });
    assert(notMetrcRes.status === 400, `a non-METRC drop expected 400 got ${notMetrcRes.status}`);
    const noLicense = new FormData();
    noLicense.append("file", new File([new TextEncoder().encode(packagesCsv("first"))], "packages.csv", { type: "text/csv" }));
    const noLicenseRes = await req("/inventory/metrc/mount", { method: "POST", body: noLicense });
    assert(noLicenseRes.status === 400, `a drop with no license expected 400 got ${noLicenseRes.status}`);
    const noPhase = new FormData();
    noPhase.append("file", new File([new TextEncoder().encode("Tag,Strain,Location,Sublocation,Hold,Plant Batch,Plant Batch Type,Plant Batch Date,Phase Date,Harvested\r\n1A4050000000000000000201,Gelato,Barn,,False,Gelato 8/3/2026,Clone,8/3/2026,8/27/2026,False\r\n")], "plants.csv", { type: "text/csv" }));
    noPhase.append("license_value", "GR-C-001132");
    const noPhaseRes = await req("/inventory/metrc/mount", { method: "POST", body: noPhase });
    assert(noPhaseRes.status === 400, `a plants drop with no phase expected 400 got ${noPhaseRes.status}`);
    noPhase.append("phase", "vegetative");
    const withPhaseRes = await req("/inventory/metrc/mount", { method: "POST", body: noPhase });
    assert(withPhaseRes.status === 303, `a plants CSV with the phase picked expected 303 got ${withPhaseRes.status}`);
    const metrc3 = await text("/inventory/metrc");
    assert(/data-metrc-license="GR-C-001132">\s*<td><code>GR-C-001132<\/code><\/td>\s*<td>0<\/td>\s*<td>1<\/td>/.test(metrc3.body), "GR-C-001132 must read 1 vegetative plant from the CSV drop");

    // THE SLICED MOUNT (canon 0.30.42, after the live Error 1102 on the third
    // export): the drop page's rounds. A 250-plant flowering file for the seed
    // farm's license goes in rounds of 100 (the page's own size is 5,000): the
    // first round answers JSON, not done, with the mount id and 100 added; the
    // mounts table says unfinished, 100 of 250 rows between rounds; the third
    // round is done with 250 added and the redirect; one mount row carries the
    // whole file. Then the same file with one plant moved and one dropped, in
    // rounds again: 0 added, 1 updated, 248 unchanged, 1 gone, the gone one
    // computed on the last round across every window. Refusals answer JSON.
    const SLICE_LIC = "AU-G-C-001397";
    const slicedRows = (variant) => {
      const rows = [];
      for (let n = 0; n < 250; n += 1) {
        if (variant === "later" && n === 249) continue;
        const gh = variant === "later" && n === 7 ? "GH 1" : `GH ${(n % 8) + 1}`;
        rows.push([`1A40500000000000000${String(1000 + n).padStart(5, "0")}`, "Gelato", gh, "", false, "Gelato 8/3/2026", "Clone", 46237, 46261, 0]);
      }
      return rows;
    };
    const slicedFile = (variant) => new File([buildPlantsXlsx(slicedRows(variant))], `MetrcMichiganAUGC001397PlantsFlowering_${variant}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const roundForm = (variant, slice, mountId) => {
      const f = new FormData();
      f.append("file", slicedFile(variant));
      f.append("slice", String(slice));
      f.append("slice_size", "100");
      if (mountId) f.append("mount_id", mountId);
      return f;
    };
    const round1 = await req("/inventory/metrc/mount", { method: "POST", body: roundForm("first", 0, "") });
    if (round1.status !== 200) throw new Error(`round one expected 200 got ${round1.status} ${await round1.text()}`);
    assert((round1.headers.get("content-type") || "").includes("application/json"), "a round must answer JSON");
    const r1 = await round1.json();
    assert(r1.ok === true && r1.done === false && r1.next === 100 && r1.total === 250 && r1.kind === "plants" && r1.phase === "flowering" && r1.license === SLICE_LIC, `round one must read next 100 of 250, got ${JSON.stringify(r1)}`);
    assert(r1.added === 100 && r1.updated === 0 && r1.unchanged === 0 && r1.gone === 0 && typeof r1.mount_id === "string" && r1.mount_id.length > 0, `round one must add 100 and name the mount, got ${JSON.stringify(r1)}`);
    const between = await text("/inventory/metrc");
    assert(between.body.includes(`data-metrc-mount="${r1.mount_id}"`), "the mount row must exist after round one");
    assert(between.body.includes("data-metrc-unfinished>unfinished, 100 of 250 rows</span>"), "the mounts table must say unfinished, 100 of 250 rows between rounds");
    assert(/data-metrc-license="AU-G-C-001397">\s*<td><code>AU-G-C-001397<\/code><\/td>\s*<td>100<\/td>/.test(between.body), "the license line must hold the first window's 100 plants between rounds");
    const wrongMount = await req("/inventory/metrc/mount", { method: "POST", body: roundForm("first", 100, "not-a-mount") });
    assert(wrongMount.status === 404, `a round naming an unknown mount expected 404 got ${wrongMount.status}`);
    const wrongJson = await wrongMount.json();
    assert(wrongJson.ok === false && /not on record/.test(wrongJson.error), `the refusal must be JSON in words, got ${JSON.stringify(wrongJson)}`);
    const otherFile = new FormData();
    otherFile.append("file", new File([plantsXlsx], "MetrcMichiganAUGC001397PlantsFlowering_x.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    otherFile.append("slice", "100");
    otherFile.append("slice_size", "100");
    otherFile.append("mount_id", r1.mount_id);
    const otherRes = await req("/inventory/metrc/mount", { method: "POST", body: otherFile });
    assert(otherRes.status === 400, `a round with a different file expected 400 got ${otherRes.status}`);
    assert(/not the file this drop started with \(250 rows then, 3 now\)/.test((await otherRes.json()).error), "the different-file refusal must count both files");
    const noMount = await req("/inventory/metrc/mount", { method: "POST", body: roundForm("first", 100, "") });
    assert(noMount.status === 400 && /must name its mount/.test((await noMount.json()).error), "a later round without its mount must be refused in words");
    const round2 = await req("/inventory/metrc/mount", { method: "POST", body: roundForm("first", 100, r1.mount_id) });
    const r2 = await round2.json();
    assert(round2.status === 200 && r2.done === false && r2.next === 200 && r2.added === 200 && r2.mount_id === r1.mount_id, `round two must read 200 added, not done, got ${JSON.stringify(r2)}`);
    const round3 = await req("/inventory/metrc/mount", { method: "POST", body: roundForm("first", 200, r1.mount_id) });
    const r3 = await round3.json();
    assert(round3.status === 200 && r3.done === true && r3.next === 250 && r3.added === 250 && r3.updated === 0 && r3.unchanged === 0 && r3.gone === 0, `round three must finish with 250 added, got ${JSON.stringify(r3)}`);
    assert(typeof r3.redirect === "string" && r3.redirect.includes("ok=mounted") && r3.redirect.includes(`mount=${r1.mount_id}`) && r3.redirect.includes("added=250"), `the last round must hand the redirect, got ${r3.redirect}`);
    const slicedDone = await text(r3.redirect);
    assert(slicedDone.body.includes("Mounted: plants, 250 added, 0 updated, 0 gone."), "the flash after the rounds must read 250 added");
    assert(!slicedDone.body.includes("data-metrc-unfinished"), "no mount may read unfinished once the rounds are done");
    assert((slicedDone.body.match(/MetrcMichiganAUGC001397PlantsFlowering_first\.xlsx/g) || []).length === 1, "the rounds must leave exactly one mount row for the file");
    assert(/data-metrc-mount="[^"]+">\s*<td>[^<]*<\/td>\s*<td>plants \/ Flowering<\/td>\s*<td><code>AU-G-C-001397<\/code><\/td>\s*<td>MetrcMichiganAUGC001397PlantsFlowering_first\.xlsx <span class="muted">xlsx<\/span><\/td>\s*<td>250<\/td>\s*<td>250 \/ 0 \/ 0 \/ 0<\/td>/.test(slicedDone.body), "the mount row must read 250 rows, 250 added");
    assert(/data-metrc-license="AU-G-C-001397">\s*<td><code>AU-G-C-001397<\/code><\/td>\s*<td>250<\/td>\s*<td>0<\/td>/.test(slicedDone.body), "the license line must read 250 flowering after the rounds");
    const slicedPlant = await text("/inventory/metrc?tag=1A4050000000000000001249");
    assert(slicedPlant.body.includes('data-metrc-record="plant"') && slicedPlant.body.includes('data-metrc-field="location">GH 2</dd>'), "the last window's last plant must stand at GH 2");
    // The re-drop in rounds: plant 1007 (first window) moves GH 8 to GH 1,
    // plant 1249 (last window) is no longer in the file.
    const again1 = await (await req("/inventory/metrc/mount", { method: "POST", body: roundForm("later", 0, "") })).json();
    assert(again1.ok === true && again1.done === false && again1.total === 249 && again1.added === 0 && again1.updated === 1 && again1.unchanged === 99, `re-drop round one must read 1 updated, 99 unchanged of 249, got ${JSON.stringify(again1)}`);
    const again2 = await (await req("/inventory/metrc/mount", { method: "POST", body: roundForm("later", 100, again1.mount_id) })).json();
    assert(again2.done === false && again2.updated === 1 && again2.unchanged === 199, `re-drop round two must read 199 unchanged, got ${JSON.stringify(again2)}`);
    const again3 = await (await req("/inventory/metrc/mount", { method: "POST", body: roundForm("later", 200, again1.mount_id) })).json();
    assert(again3.done === true && again3.added === 0 && again3.updated === 1 && again3.unchanged === 248 && again3.gone === 1, `re-drop must finish 1 updated, 248 unchanged, 1 gone, got ${JSON.stringify(again3)}`);
    const movedSliced = await text("/inventory/metrc?tag=1A4050000000000000001007");
    assert(movedSliced.body.includes('data-metrc-field="location">GH 1</dd>'), "the moved plant must read GH 1 after the sliced re-drop");
    const goneSliced = await text("/inventory/metrc?tag=1A4050000000000000001249");
    assert(!/data-metrc-field="gone_at"><span class="muted">-<\/span>/.test(goneSliced.body), "the plant the re-drop no longer carries must be gone");
    const afterAgain = await text("/inventory/metrc");
    assert(/data-metrc-license="AU-G-C-001397">\s*<td><code>AU-G-C-001397<\/code><\/td>\s*<td>249<\/td>/.test(afterAgain.body), "the license line must read 249 flowering after the sliced re-drop");

    // THE MIRROR LAW across our own licenses (0.30.42): a package the mirror
    // holds under one license, dropped in another license's file, updates in
    // place (the transfer) instead of colliding; the first license's next drop
    // marks nothing for it, the receiving license counts it.
    const HOP_TAG = "1A4050300000000000000E09";
    const hopCsv = (lic) => `Tag,Source Harvest(s),Source Package(s),Original Source Package Label,Source Processing Job(s),Location,Sublocation,Item,Category,Item Strain,Quantity,Unit Of Measure,Production Batch Number,Source Production Batch,Lab Test Status,Finished Goods,Administrative Hold,Administrative Recall,Packaged Date,Received,Expiration Date,Lab Test Expiration\r\n${HOP_TAG},46258-PNN-ID-062-0-NA-26007,,,,Barn,,WIP - Placeholder - PNN - I,Buds,Placeholder,100,g,,,NotSubmitted,False,False,False,9/1/2026 12:00:00 AM,${lic === "GR-C-001405" ? "9/10/2026 12:00:00 AM" : ""},,\r\n`;
    const hopA = new FormData();
    hopA.append("file", new File([new TextEncoder().encode(hopCsv("AU-G-C-001509"))], "MetrcMichiganAUGC001509PackagesActive_1.csv", { type: "text/csv" }));
    const hopARes = await req("/inventory/metrc/mount", { method: "POST", body: hopA });
    assert(hopARes.status === 303 && (hopARes.headers.get("location") || "").includes("added=1"), "the hop package must mount under the first license");
    const hopB = new FormData();
    hopB.append("file", new File([new TextEncoder().encode(hopCsv("GR-C-001405"))], "MetrcMichiganGRC001405PackagesActive_1.csv", { type: "text/csv" }));
    const hopBRes = await req("/inventory/metrc/mount", { method: "POST", body: hopB });
    const hopBLoc = hopBRes.headers.get("location") || "";
    assert(hopBRes.status === 303 && hopBLoc.includes("added=0") && hopBLoc.includes("updated=1") && hopBLoc.includes("gone=0"), `the transferred package must update in place, got ${hopBRes.status} ${hopBLoc}`);
    const hopped = await text(`/inventory/metrc?tag=${HOP_TAG}`);
    assert(hopped.body.includes('data-metrc-field="license_value">GR-C-001405</dd>'), "the hop package must now read the receiving license");
    assert(/data-metrc-field="received_date">2026-09-10<\/dd>/.test(hopped.body), "the hop package must carry the receiving file's Received date");

    // FG INVENTORY IN METRC (canon 0.30.43): the /inventory pane reads the
    // mirror's active packages by item kind. The 832 re-drop left the truck
    // package (WIP, 480 g, NotSubmitted) and the bulk SKU (BUD, 336 g); the
    // vape row is gone; the hop package (WIP, 100 g) stands under 1405.
    const fgPane = await text("/inventory");
    assert(fgPane.body.includes("FG Inventory in METRC"), "the FG pane must be titled FG Inventory in METRC");
    assert(fgPane.body.includes("data-inv-fg-age") && /From the METRC mirror: 3 active packages\. Newest packages mount 20\d\d-/.test(fgPane.body), "the FG pane must count 3 active packages from the mirror with the newest mount");
    assert(/data-inv-fg-license="AU-G-C-000832"><code>AU-G-C-000832<\/code> 2 packages, mounted 20/.test(fgPane.body), "the FG pane must list 832 with 2 packages and its mount");
    assert(/data-inv-fg-license="GR-C-001405"><code>GR-C-001405<\/code> 1 package, mounted 20/.test(fgPane.body), "the FG pane must list 1405 with 1 package");
    assert(fgPane.body.includes('data-fg-type="WIP" data-fg-uom="g"') && fgPane.body.includes('data-fg-type="BUD" data-fg-uom="g"'), "the FG pane must carry the WIP and BUD kinds in grams");
    assert(!fgPane.body.includes('data-fg-type="GRIP Vape"'), "the gone vape row must not count");
    assert(fgPane.body.includes('<span class="inv-fg-stock">580 <span class="muted inv-fg-unit">g</span></span>'), "WIP must total 580 g across both licenses");
    assert(fgPane.body.includes('<span class="inv-fg-stock">336 <span class="muted inv-fg-unit">g</span></span>'), "BUD must read 336 g");
    assert(fgPane.body.includes("2 packages; Buds; 2 not test-passed"), "the WIP kind must note its two NotSubmitted packages");
    assert(fgPane.body.includes("<td>WIP - Placeholder - PNN - I</td>") && fgPane.body.includes("<td>BUD - Donny Burger - PNS - O</td>"), "the kinds must open to METRC's item names");
    assert(/data-fg-type="WIP"[\s\S]*?style="width:100%"/.test(fgPane.body) && /data-fg-type="BUD"[\s\S]*?style="width:58%"/.test(fgPane.body), "the grams bars must scale against the largest grams kind");
    assert(!fgPane.body.includes("By count"), "no eaches kind stands, so no By count block");
    const fgCsv = await text("/export/inventory.csv");
    assert(fgCsv.body.includes("fg,WIP,580") && fgCsv.body.includes("fg,BUD,336"), "the inventory CSV must carry the METRC kinds in grams");

    // THE FFZ INVENTORY (canon 0.30.225): a fresh frozen package the ledger lacks
    // lands at the Blast Freezer. The FG pane still reads the kind from the mirror.
    const FFZ_TAG = "1A4050300000000000000E11";
    const ffzCsv = `Tag,Source Harvest(s),Source Package(s),Original Source Package Label,Source Processing Job(s),Location,Sublocation,Item,Category,Item Strain,Quantity,Unit Of Measure,Production Batch Number,Source Production Batch,Lab Test Status,Finished Goods,Administrative Hold,Administrative Recall,Packaged Date,Received,Expiration Date,Lab Test Expiration\r\n${FFZ_TAG},46258-PNN-ID-062-0-NA-26007,,,,Blast Freezer,,FFZ - Donny Burger - PNN - O,Buds,Donny Burger,"1,500",g,,,NotSubmitted,False,False,False,9/12/2026 12:00:00 AM,,,\r\n`;
    const ffzFile = () => {
      const ffzForm = new FormData();
      ffzForm.append("file", new File([new TextEncoder().encode(ffzCsv)], "MetrcMichiganAUP000694PackagesActive_1.csv", { type: "text/csv" }));
      return ffzForm;
    };
    const ffzMount = await req("/inventory/metrc/mount", { method: "POST", body: ffzFile() });
    const ffzLoc = ffzMount.headers.get("location") || "";
    assert(ffzMount.status === 303 && ffzLoc.includes("added=1") && ffzLoc.includes("landed=1"), `the FFZ package must mount and land, got ${ffzMount.status} ${ffzLoc}`);
    const ffzFlash = await text(ffzLoc);
    assert(ffzFlash.body.includes("1 fresh frozen packages landed at the Blast Freezer."), "the flash must count the landed package");
    const ffzLedger = await text("/admin/reconcile-location?location=Blast%20Freezer");
    assert(ffzLedger.body.includes(`value="${FFZ_TAG}"`) && ffzLedger.body.includes('value="1500"'), "the Blast Freezer entry must list the landed package at 1500 g");
    const ffzPickEarly = await text("/admin/reconcile-location");
    assert(!ffzPickEarly.body.includes('value="FFZ inventory"'), "the picker must not offer FFZ inventory");
    const ffzAgain = await req("/inventory/metrc/mount", { method: "POST", body: ffzFile() });
    const ffzAgainLoc = ffzAgain.headers.get("location") || "";
    assert(ffzAgain.status === 303 && ffzAgainLoc.includes("landed=0"), `a second mount of the same file must land nothing, got ${ffzAgain.status} ${ffzAgainLoc}`);
    const fgFfz = await text("/inventory");
    assert(fgFfz.body.includes('data-fg-type="FFZ" data-fg-uom="g"'), "the FG pane must carry the FFZ kind now");

    // THE CHANGE LOCATION SETUP (canon 0.30.40): the seeds in Admin, a
    // package moved within its license, the plants at a row moved as one act,
    // the files pending on the export home and marked, the refusals in words.
    const invLocs = await text("/admin/lookups/inventory_locations");
    for (const loc of ["Blast Freezer", "Trim Room 1", "Trim Room 12", "Cryo 4", "1.1.a", "1.3.c", "12.4.d", "Concentrate Vault", "Prerolls 5", "Testing", "Fulfillment", "On Hold", "Trim Trailer 8", "Consumables"]) {
      assert(invLocs.body.includes(`<td>${loc}</td>`), `Inventory Locations must seed ${loc} (0043)`);
    }
    // Each rack row renders its value and its label, two cells of the same code.
    assert((invLocs.body.match(/<td>\d{1,2}\.\d\.[abcd]<\/td>/g) || []).length === 192 * 2, "the rack grid must be 12 sides x 4 bays x 4 levels = 192 slots");
    assert(invLocs.body.includes("<td>AU-P-000694</td>"), "the processor's locations must carry its license");
    assert(invLocs.body.includes('name="license_value"'), "the location add form must offer the license scope");
    const fieldLocs = await text("/admin/lookups/field_locations");
    assert(fieldLocs.res.status === 200, `field locations expected 200 got ${fieldLocs.res.status}`);
    for (const loc of ["West 1", "West 21", "GH 1", "GH 12", "Row 34A", "Row 96H", "199A", "SW Greenhouse", "East 86"]) {
      assert(fieldLocs.body.includes(`<td>${loc}</td>`), `Field Locations must seed ${loc} (0043)`);
    }
    assert((fieldLocs.body.match(/<td>Barn<\/td>/g) || []).length >= 6, "every license must have a Barn among its field locations");
    const lookupsLandingLoc = await text("/admin/lookups");
    assert(lookupsLandingLoc.body.includes('href="/admin/lookups/field_locations"'), "Data Lookups must link Field Locations");

    // A package under 832 (the received truck package, tagged, at BARN) moves to the Blast Freezer.
    const pkgScope = await text(`/inventory/change-locations?kind=packages&farm=PNN&license=${encodeURIComponent("AU-G-C-000832")}`);
    assert(pkgScope.body.includes('name="pick"'), "the packages pick must render once the scope is set");
    assert(pkgScope.body.includes(TRUCK_TAG), "the ledger pick must list the tagged truck package");
    const pkgPicked = await text(`/inventory/change-locations?kind=packages&farm=PNN&license=${encodeURIComponent("AU-G-C-000832")}&pick=${TRUCK_TAG.toLowerCase()}`);
    assert(pkgPicked.body.includes('data-pick-found="ledger"'), "the tagged package must resolve from the ledger");
    assert(pkgPicked.body.includes("<dd data-from-location>BARN</dd>"), "the package must read From BARN");
    assert(pkgPicked.body.includes('<option value="Blast Freezer">Blast Freezer</option>'), "the Blast Freezer must be offered to every 832 package at PNN");
    assert(!pkgPicked.body.includes('<option value="Trim Room 1">'), "the processor's rooms must not be offered under 832");
    assert(!pkgPicked.body.includes('<option value="BARN">'), "the package's own spot must not be offered");
    assert(pkgPicked.body.includes("data-change-warning") && pkgPicked.body.includes("data-execute"), "the card must carry the warning and Execute");
    const wrongDest = await req("/inventory/change-locations", { method: "POST", body: form({ kind: "packages", farm_code: "PNN", license_value: "AU-G-C-000832", pick: TRUCK_TAG, to_location: "Trim Room 1", move_date: "2026-09-11" }) });
    assert(wrongDest.status === 400, `a destination outside the license expected 400 got ${wrongDest.status}`);
    const sameSpot = await req("/inventory/change-locations", { method: "POST", body: form({ kind: "packages", farm_code: "PNN", license_value: "AU-G-C-000832", pick: TRUCK_TAG, to_location: "BARN", move_date: "2026-09-11" }) });
    assert(sameSpot.status === 400, `moving a package onto its own spot expected 400 got ${sameSpot.status}`);
    const unknownPick = await req("/inventory/change-locations", { method: "POST", body: form({ kind: "packages", farm_code: "PNN", license_value: "AU-G-C-000832", pick: "1A4050300000000000000FFF", to_location: "Blast Freezer", move_date: "2026-09-11" }) });
    assert(unknownPick.status === 404, `an unknown package expected 404 got ${unknownPick.status}`);
    const movePkg = await req("/inventory/change-locations", { method: "POST", body: form({ kind: "packages", farm_code: "PNN", license_value: "AU-G-C-000832", pick: TRUCK_TAG, to_location: "Blast Freezer", move_date: "2026-09-11" }) });
    assert(movePkg.status === 303, `package move expected 303 got ${movePkg.status} ${await movePkg.text()}`);
    const movePkgLoc = movePkg.headers.get("location") || "";
    assert(movePkgLoc.includes("ok=moved") && movePkgLoc.includes("n=1"), `package move must flash 1 moved, got ${movePkgLoc}`);
    const movedPage = await text(movePkgLoc);
    assert(movedPage.body.includes("Moved 1 package to Blast Freezer."), "the flash must name the destination");
    const groupPkg = new URL(movePkgLoc, base).searchParams.get("group");
    assert(groupPkg, "the move redirect must carry its group");
    const invMoved = await text("/inventory");
    assert(invMoved.body.includes("Blast Freezer"), "the ledger must show the package in the Blast Freezer");
    const mirrorMoved = await text(`/inventory/metrc?tag=${TRUCK_TAG}`);
    assert(mirrorMoved.body.includes('data-metrc-field="location">Blast Freezer</dd>'), "the mirror row must take the new location");
    const uploadsMove = await text("/admin/uploads");
    assert(uploadsMove.body.includes(`data-location-move="${groupPkg}"`), "the export home must list the Execute");
    assert(uploadsMove.body.includes("Package location change"), "the row must say Package location change");
    const pkgMoveCsv = await text(`/admin/uploads/location_move/${groupPkg}.csv`);
    assert(pkgMoveCsv.body.startsWith("Label,Location,Sublocation,MoveDate\r\n"), "the package move file must carry the package location-change header");
    assert(pkgMoveCsv.body.includes(`${TRUCK_TAG},Blast Freezer,,2026-09-11`), "the package move file must print the tag, the METRC word and the date");
    assert(pkgMoveCsv.res.headers.get("content-disposition").includes("location_change_packages_AUGC000832_20260911_"), "the package move file must be named by kind, license and date");

    // Every plant at West 3 under GR-C-002600 moves to West 4 as one act.
    const plantScope = await text(`/inventory/change-locations?kind=plants&farm=ARL&license=${encodeURIComponent("GR-C-002600")}`);
    assert(plantScope.body.includes('<option value="West 3" selected>') === false && plantScope.body.includes('<option value="West 3">West 3 (2)</option>'), "the plants pick must list West 3 with 2 plants");
    const plantsAt = await text(`/inventory/change-locations?kind=plants&farm=ARL&license=${encodeURIComponent("GR-C-002600")}&from=${encodeURIComponent("West 3")}`);
    assert(plantsAt.body.includes('data-pick-found="plants" data-plant-count="2"'), "two plants must stand at West 3");
    assert(plantsAt.body.includes('<option value="West 4">West 4</option>') && plantsAt.body.includes('<option value="Barn">Barn</option>'), "the field locations must offer West 4 and Barn");
    assert(!plantsAt.body.includes('<option value="West 3">West 3</option>'), "West 3 must not offer itself");
    assert(plantsAt.body.includes("GR-C-002600</code>: 2 plants."), "the warning must count 2 plants");
    const movePlants = await req("/inventory/change-locations", { method: "POST", body: form({ kind: "plants", farm_code: "ARL", license_value: "GR-C-002600", from_location: "West 3", to_location: "West 4", move_date: "2026-09-11" }) });
    assert(movePlants.status === 303, `plants move expected 303 got ${movePlants.status} ${await movePlants.text()}`);
    const movePlantsLoc = movePlants.headers.get("location") || "";
    assert(movePlantsLoc.includes("n=2"), `the plants move must move 2, got ${movePlantsLoc}`);
    const groupPlants = new URL(movePlantsLoc, base).searchParams.get("group");
    const afterPlants = await text(`/inventory/change-locations?kind=plants&farm=ARL&license=${encodeURIComponent("GR-C-002600")}`);
    assert(afterPlants.body.includes('<option value="West 4">West 4 (3)</option>'), "West 4 must now hold 3 plants");
    assert(!afterPlants.body.includes('<option value="West 3">West 3 ('), "West 3 must be empty now");
    const plantMoveCsv = await text(`/admin/uploads/location_move/${groupPlants}.csv`);
    assert(plantMoveCsv.body.startsWith("Plant,Location,Sublocation,ChangeDate\r\n"), "the plants move file must carry the plants location-change header");
    assert(plantMoveCsv.body.includes("1A4050000000000000000101,West 4,,2026-09-11") && plantMoveCsv.body.includes("1A4050000000000000000102,West 4,,2026-09-11"), "the plants move file must list both tags");
    const emptyFrom = await req("/inventory/change-locations", { method: "POST", body: form({ kind: "plants", farm_code: "ARL", license_value: "GR-C-002600", from_location: "West 3", to_location: "West 4", move_date: "2026-09-11" }) });
    assert(emptyFrom.status === 404, `moving from an empty row expected 404 got ${emptyFrom.status}`);
    const onePlant = await req("/inventory/change-locations", { method: "POST", body: form({ kind: "plants", farm_code: "ARL", license_value: "GR-C-002600", pick: "1a4050000000000000000103", to_location: "Barn", move_date: "2026-09-11" }) });
    assert(onePlant.status === 303, `one plant by tag expected 303 got ${onePlant.status}`);
    const plantCardMoved = await text("/inventory/metrc?tag=1A4050000000000000000103");
    assert(plantCardMoved.body.includes('data-metrc-field="location">Barn</dd>'), "the plant's mirror row must read Barn");
    const procPlants = await req("/inventory/change-locations", { method: "POST", body: form({ kind: "plants", farm_code: "PNN", license_value: "AU-P-000694", pick: "1A4050000000000000000103", to_location: "Barn", move_date: "2026-09-11" }) });
    assert(procPlants.status === 400, `plants under the processor expected 400 got ${procPlants.status}`);
    // The mark clears the Execute from the export home.
    const markMove = await req(`/admin/uploads/location_move/${groupPkg}/uploaded`, { method: "POST", body: form({}) });
    assert(markMove.status === 303, `location move mark expected 303 got ${markMove.status}`);
    const uploadsAfterMoveMark = await text("/admin/uploads");
    assert(!uploadsAfterMoveMark.body.includes(`data-location-move="${groupPkg}"`), "a marked Execute must leave the export home");
    assert(uploadsAfterMoveMark.body.includes(`data-location-move="${groupPlants}"`), "the unmarked plants Execute must stay");
    const recentMoves = await text("/inventory/change-locations");
    assert(recentMoves.body.includes("data-recent-moves") && recentMoves.body.includes(`data-move-group="${groupPlants}"`), "Recent moves must list the plants Execute");

    // THE PENDING QUEUE CLEAR (canon 0.30.96; owner: "CAN WE REMOVE ALL THE DOCS
    // that are parked on pending data uploads?"). His pick: cleared, NOT
    // uploaded to METRC, and a reusable button. With a pile pending (the plants
    // Execute and every never-marked file), the Clear all button carries the
    // count; one post disposes every kind, the queue reads Nothing pending, and
    // the change log says cleared, not uploaded.
    const beforeCheck = await text("/admin/uploads");
    assert(beforeCheck.body.includes('class="queue-fold" data-fold="wet_weights"') || beforeCheck.body.includes('data-fold='), "pending sections must fold open");
    assert(beforeCheck.body.includes(" open>"), "a fold must render open");
    const uploadItems = [...beforeCheck.body.matchAll(/name="item" value="([^"]+)"/g)].map((m) => m[1]);
    assert(uploadItems.length >= 2, `two pending files must be checkable, got ${uploadItems.length}`);
    const markChecked = await req("/admin/uploads/uploaded-checked", { method: "POST", body: form({ item: uploadItems.slice(0, 2) }) });
    assert(markChecked.status === 303 && (markChecked.headers.get("location") || "").includes("ok=uploaded&n=2"), `mark checked expected uploaded 2, got ${markChecked.status} ${markChecked.headers.get("location")}`);
    const markedPage = await text(markChecked.headers.get("location") || "/admin/uploads");
    assert(markedPage.body.includes("Marked 2 uploaded."), "the flash must say the two files were marked uploaded");
    assert(!markedPage.body.includes(`value="${uploadItems[0]}"`) && !markedPage.body.includes(`value="${uploadItems[1]}"`), "the two marked files must leave the pending list");
    const uploadLog = await text("/log");
    assert(uploadLog.body.includes("<td>marked uploaded</td>"), "the checked files must land in the change log as uploaded");
    const beforeClear = await text("/admin/uploads");
    assert(beforeClear.body.includes('<details class="clear-all" data-clear-all>'), "the export home must carry the Clear all control");
    const clearCountMatch = beforeClear.body.match(/Clear all pending \((\d+)\)<\/button>/);
    assert(clearCountMatch && Number(clearCountMatch[1]) > 0, `the Clear all button must carry a pending count, got ${clearCountMatch && clearCountMatch[1]}`);
    assert(beforeClear.body.includes(`data-location-move="${groupPlants}"`), "the plants Execute must be pending before the clear");
    const clearAll = await req("/admin/uploads/clear-all", { method: "POST", body: form({}) });
    assert(clearAll.status === 303, `clear all expected 303 got ${clearAll.status}`);
    const clearLoc = clearAll.headers.get("location") || "";
    assert(clearLoc.startsWith("/admin/uploads?ok=cleared&n="), `clear all must redirect to the export home with the count, got ${clearLoc}`);
    const afterClear = await text(clearLoc);
    assert(afterClear.body.includes("Pending files cleared, not uploaded to METRC."), "the clear must flash that it was not an upload");
    assert(afterClear.body.includes("Nothing pending."), "every pending file must be disposed by Clear all");
    assert(!afterClear.body.includes('data-location-move='), "no Execute may remain pending after Clear all");
    const clearLog = await text("/log");
    assert(clearLog.body.includes("cleared, not uploaded to METRC"), "the clear must land in the change log under its reason");

    // THE BLAST FREEZER(S) AND THE DRY SPACE TYPE (canon 0.30.106). Owner,
    // verbatim: "Change "Blast Freezer" to "Blast Freezer(s)".  Merge the blast
    // freezer formatting to the FFZ inventory one.  Expose FFZ inventory on the
    // dry ops pages.  Unload Dry Space/Blast Freezer just removes the line,
    // since the packages are already denoted as "FFZ" in METRC, the inventory
    // lines are identical and moving the BF inventory to the FFZ inventory
    // would just duplicate it.  Change blast freezer capacity to 800lbs.
    // Change status "Drying" to "Chilling Out"" and the Admin lookups fields.
    // A PNN lot of 200 lb loads into the freezer: the tile reads Chilling Out
    // and 25% full of 800 lb in the FFZ chrome, the package sits at the METRC
    // location Blast Freezer and the FFZ cube counts it; the unload takes no
    // dry weight, removes the line, closes the lot as frozen out of every
    // queue, and moves nothing.
    const drySpacesNow = await text("/admin/lookups/dry_spaces");
    assert(drySpacesNow.res.status === 200, `dry spaces lookup expected 200 got ${drySpacesNow.res.status}`);
    assert(drySpacesNow.body.includes("<th>name</th><th>capacity</th><th>capacity_uom</th><th>space_type</th><th>kind</th><th>farm_code</th>"), "the Dry Spaces lookup must carry his four columns first");
    assert(drySpacesNow.body.includes("<td>Blast Freezer(s)</td><td>800</td><td>lb</td><td>Freezer</td><td>silo</td><td>PNN</td>"), "the Blast Freezer(s) must read as a freezer of 800 lb");
    assert(drySpacesNow.body.includes("<td>Arlington Dry Room</td><td>15000</td><td>lb</td><td>Dry Room</td>"), "the Arlington Dry Room must read as a dry room of 15,000 lb");
    assert(drySpacesNow.body.includes("<td>Silo 4</td><td>15000</td><td>lb</td><td>Silo</td>"), "a silo must read as a silo of 15,000 lb");
    assert(drySpacesNow.body.includes('<label class="field">Freezer, Dry Room, or Silo? <select name="space_type">'), "the add form must carry the type toggle");
    assert(drySpacesNow.body.includes('<label class="field">Capacity UOM <select name="capacity_uom">'), "the add form must carry the capacity UOM");
    const bfId = drySpaceIdByName(drySpacesNow.body, "Blast Freezer(s)");
    assert(bfId === "a1000001-0000-4000-8000-0000000000bf", `the Blast Freezer(s) must keep its seeded id, got ${bfId}`);
    const bfPencil = await text(`/record/dry_spaces/${bfId}/edit`);
    assert(bfPencil.body.includes('<select name="space_type"><option value="silo">Silo</option><option value="dry_room">Dry Room</option><option value="freezer" selected>Freezer</option></select>'), "the pencil must offer the type toggle with Freezer picked");
    assert(bfPencil.body.includes('<input type="number" name="capacity" value="800" step="0.01">'), "the pencil must carry the 800 capacity");
    assert(bfPencil.body.includes('<option value="lb" selected>lb</option>'), "the pencil must carry lb");
    const badType = await req(`/record/dry_spaces/${bfId}/edit`, { method: "POST", body: form({ space_type: "fridge", reason: "smoke: a type the farm refuses" }) });
    assert(badType.status === 400 && (await badType.text()).includes("Freezer, Dry Room, or Silo? must be one of Silo, Dry Room, Freezer."), "an unknown type must refuse in words");
    const badCap = await req(`/record/dry_spaces/${bfId}/edit`, { method: "POST", body: form({ capacity: "-1", reason: "smoke: a capacity the farm refuses" }) });
    assert(badCap.status === 400 && (await badCap.text()).includes("Capacity must be a number above zero, or blank."), "a bad capacity must refuse in words");
    const badAdd = await req("/admin/lookups/dry_spaces", { method: "POST", body: form({ action: "add", name: "Smoke Freezer", kind: "silo", farm_code: "PNN", space_type: "freezer", capacity: "500", capacity_uom: "" }) });
    assert(badAdd.status === 400 && (await badAdd.text()).includes("Capacity and its UOM go together."), "a capacity without its UOM must refuse in words");

    const acquireBf = await text("/station/acquire_hbn");
    const mkBf = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({ entry_date: "2026-09-16", farm_code: "PNN", grow_method_code: "GH", strain_id: optionValue(acquireBf.body, "Fruity Pebbles") }),
    });
    assert(mkBf.status === 303, `freezer HBN acquire expected 303 got ${mkBf.status} ${await mkBf.text()}`);
    const bfHbn = new URL(mkBf.headers.get("location") || "", base).searchParams.get("minted");
    assert(bfHbn && bfHbn.includes("-PNN-"), `the freezer HBN must be minted at PNN, got ${bfHbn}`);
    const wetBf = await text("/station/wet_weight");
    // The pane reads Farm / Strain / Date (canon 0.22.0); the picked page shows
    // the HBN muted, so walk the PNN rows to the one just minted.
    let bfBatchId = null;
    let bfPicked = null;
    for (const m of wetBf.body.matchAll(/\?pick=([a-f0-9-]{36})">\d+\. PNN \//g)) {
      const page = await text(`/station/wet_weight?pick=${m[1]}`);
      if (page.body.includes(`<p class="muted">${bfHbn}</p>`)) {
        bfBatchId = m[1];
        bfPicked = page;
        break;
      }
    }
    assert(bfBatchId && bfPicked, "the wet pane must list the freezer HBN among the PNN rows");
    assert(bfPicked.body.includes(`<option value="${bfId}"`) && bfPicked.body.includes(">Blast Freezer(s)</option>"), "Move To at PNN must offer the Blast Freezer(s)");
    const startBf = await req("/station/wet_weight", {
      method: "POST",
      body: form({ team_lead: "Smoke Lead", harvest_batch_id: bfBatchId, actual_dryspc: bfId, notes: "0.30.106 freezer" }),
    });
    assert(startBf.status === 303, `freezer lot start expected 303 got ${startBf.status} ${await startBf.text()}`);
    const bfLot = new URL(startBf.headers.get("location") || "", base).searchParams.get("lot");
    assert(bfLot, "no lot id for the freezer walk");
    // 200 lb wet, 25% of the freezer's 800 lb.
    const wBf = await req(`/station/wet_weight/lot/${bfLot}/weights`, { method: "POST", body: form({ weight_grams: "89600" }) });
    assert(wBf.status === 303, `freezer lot weight expected 303 got ${wBf.status}`);
    const fillingBf = await text("/ops/drying_ops");
    assert(fillingBf.body.includes(`data-silo="${bfId}" data-silo-state="filling" data-silo-shape-kind="cube" data-space-type="freezer"`), "the freezer must read filling in the freezer chrome while the lot weighs in");
    assert(fillingBf.body.includes('<span data-silo-label>filling</span> · <span data-silo-pct>25% full</span>'), "the filling freezer must read filling and 25% full of 800 lb");
    assert(/data-silo="a1000001-0000-4000-8000-0000000000bf"[\s\S]*?class="silo-fill ffz-fill ffz-throb" data-silo-fill/.test(fillingBf.body), "the freezer's fill must be the FFZ blue");
    const finBf = await req(`/station/wet_weight/lot/${bfLot}/finish`, { method: "POST", body: form({ plant_count: "12" }) });
    assert(finBf.status === 303, `freezer lot finish expected 303 got ${finBf.status} ${await finBf.text()}`);
    const loadBfIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await passEntry(bfLot);
    const loadBf = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: bfLot, dry_space_id: bfId, start_time: "07:30", loaded_at_iso: loadBfIso }),
    });
    assert(loadBf.status === 303, `freezer load expected 303 got ${loadBf.status} ${await loadBf.text()}`);
    const bfLoadId = new URL(loadBf.headers.get("location") || "", base).searchParams.get("load");
    assert(bfLoadId, "the freezer load must redirect to the load");
    const chilling = await text("/ops/drying_ops");
    assert(chilling.body.includes(`data-silo="${bfId}" data-silo-state="drying" data-silo-shape-kind="cube" data-space-type="freezer"`), "the loaded freezer must ride the drying state in the freezer chrome");
    assert(chilling.body.includes('<div class="silo-state ffz-state freezer-state"><span data-silo-label>Chilling Out</span> · <span data-silo-pct>25% full</span></div>'), "the loaded freezer must read Chilling Out and 25% full on one line");
    assert(!/data-silo="a1000001-0000-4000-8000-0000000000bf"[\s\S]*?silo-state-drying/.test(chilling.body.slice(chilling.body.indexOf(`data-silo="${bfId}"`), chilling.body.indexOf(`data-silo="${bfId}"`) + 3000)), "the freezer never reads DRYING");
    const bfTile = chilling.body.slice(chilling.body.indexOf(`data-silo="${bfId}"`), chilling.body.indexOf(`data-silo="${bfId}"`) + 4000);
    assert(/<div class="muted ffz-source freezer-lines">[\s\S]*?href="\/station\/load_silo\?load=/.test(bfTile), "the lot link and its clock must sit in the muted lines under the status");
    assert(/data-silo-wet-lb>200\.00<\/strong> lb/.test(bfTile), "the freezer's wet line must read 200.00 lb");
    const liveBf = await (await req("/silos/live.json")).json();
    const bfEntry = liveBf.silos.find((x) => x.id === bfId);
    assert(bfEntry && bfEntry.state === "drying" && bfEntry.label === "Chilling Out" && bfEntry.pctLabel === "25% full" && bfEntry.spaceType === "freezer" && bfEntry.fillClass === "silo-fill ffz-fill ffz-throb" && bfEntry.shape === "cube", `live.json must carry the freezer chilling out, got ${JSON.stringify(bfEntry)}`);
    assert(Math.abs(bfEntry.level - 0.25) < 0.001, `the freezer's level must be a quarter of 800 lb, got ${bfEntry.level}`);
    // The package sits at the METRC location Blast Freezer.
    const invBf = await text("/reports/inventory_by_location?format=csv");
    assert(invBf.body.includes("PNN,Blast Freezer,PNN,WIP"), "the loaded package must sit at the METRC location Blast Freezer");
    assert(!invBf.body.includes("Blast Freezer(s)"), "the tile's word never reaches the inventory report");
    const bfLoadCsv = await text(`/admin/uploads/location_change/${bfLoadId}.csv`);
    assert(bfLoadCsv.res.status === 200 && bfLoadCsv.body.includes(",Blast Freezer,"), "the load's location-change file must print the METRC location Blast Freezer");
    assert(!bfLoadCsv.body.includes("Blast Freezer(s)"), "the load's file never prints the tile's word");

    // THE ROOM HOLDS MANY (canon 0.30.132; owner, 2026-09-20, verbatim: "Dry
    // rooms and freezers must be able to contain multiple lots"): a second PNN
    // lot of 80 lb finishes while the first chills; Load Silo offers the
    // freezer open, "holding 1 lot", the load lands (the 0.30.19 occupant law
    // binds a silo alone), the tile chills at 35% of 800 lb with both lots'
    // lines, live.json follows, and the FFZ cube's ledger side counts both.
    const acquireBf2 = await text("/station/acquire_hbn");
    const mkBf2 = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({ entry_date: "2026-09-16", farm_code: "PNN", grow_method_code: "GH", strain_id: optionValue(acquireBf2.body, "Fruity Pebbles") }),
    });
    assert(mkBf2.status === 303, `second freezer HBN acquire expected 303 got ${mkBf2.status} ${await mkBf2.text()}`);
    const bfHbn2 = new URL(mkBf2.headers.get("location") || "", base).searchParams.get("minted");
    assert(bfHbn2 && bfHbn2 !== bfHbn, `the second freezer HBN must be its own, got ${bfHbn2}`);
    const wetBf2 = await text("/station/wet_weight");
    let bfBatchId2 = null;
    for (const m of wetBf2.body.matchAll(/\?pick=([a-f0-9-]{36})">\d+\. PNN \//g)) {
      const page = await text(`/station/wet_weight?pick=${m[1]}`);
      if (page.body.includes(`<p class="muted">${bfHbn2}</p>`)) {
        bfBatchId2 = m[1];
        break;
      }
    }
    assert(bfBatchId2, "the wet pane must list the second freezer HBN among the PNN rows");
    const startBf2 = await req("/station/wet_weight", {
      method: "POST",
      body: form({ team_lead: "Smoke Lead", harvest_batch_id: bfBatchId2, actual_dryspc: bfId, notes: "0.30.132 second freezer lot" }),
    });
    assert(startBf2.status === 303, `second freezer lot start expected 303 got ${startBf2.status} ${await startBf2.text()}`);
    const bfLot2 = new URL(startBf2.headers.get("location") || "", base).searchParams.get("lot");
    assert(bfLot2, "no lot id for the second freezer lot");
    // 80 lb wet: with the first lot's 200 lb, 280 of 800 lb, 35%.
    const wBf2 = await req(`/station/wet_weight/lot/${bfLot2}/weights`, { method: "POST", body: form({ weight_grams: "35840" }) });
    assert(wBf2.status === 303, `second freezer lot weight expected 303 got ${wBf2.status}`);
    const finBf2 = await req(`/station/wet_weight/lot/${bfLot2}/finish`, { method: "POST", body: form({ plant_count: "5" }) });
    assert(finBf2.status === 303, `second freezer lot finish expected 303 got ${finBf2.status} ${await finBf2.text()}`);
    await passEntry(bfLot2);
    const pickBf2 = await text(`/station/load_silo?pick=${bfLot2}`);
    assert(pickBf2.res.status === 200, `second freezer lot pick expected 200 got ${pickBf2.res.status}`);
    assert(pickBf2.body.includes(`<option value="${bfId}" selected data-holding="1">Blast Freezer(s) (holding 1 lot)</option>`), "the loaded freezer must stay open in the select, holding 1 lot, preselected as the lot's own space");
    assert(!new RegExp(`<option value="${bfId}" disabled`).test(pickBf2.body), "a freezer with a lot inside is never greyed (canon 0.30.132)");
    assert(!pickBf2.body.includes("data-silos-full"), "rooms and freezers keep the load button live");
    const loadBf2 = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: bfLot2, dry_space_id: bfId, start_time: "", loaded_at_iso: "" }),
    });
    assert(loadBf2.status === 303, `a second load into the freezer expected 303 got ${loadBf2.status} ${await loadBf2.text()}`);
    const bfLoadId2 = new URL(loadBf2.headers.get("location") || "", base).searchParams.get("load");
    assert(bfLoadId2 && bfLoadId2 !== bfLoadId, "the second freezer load must be its own row");
    const twoChilling = await text("/ops/drying_ops");
    assert(twoChilling.body.includes(`data-silo="${bfId}" data-silo-state="drying" data-silo-shape-kind="cube" data-space-type="freezer"`), "the freezer with two lots still chills");
    assert(twoChilling.body.includes('<span data-silo-label>Chilling Out</span> · <span data-silo-pct>35% full</span>'), "two lots must sum to 35% of 800 lb");
    const bfTile2 = twoChilling.body.slice(twoChilling.body.indexOf(`data-silo="${bfId}"`), twoChilling.body.indexOf(`data-silo="${bfId}"`) + 6000);
    assert(bfTile2.includes(`data-load="${bfLoadId}"`) && bfTile2.includes(`data-load="${bfLoadId2}"`), "the freezer tile must carry a line per lot inside");
    assert(/data-silo-wet-lb>280\.00<\/strong> lb/.test(bfTile2), "the freezer's wet line must read 280.00 lb");
    const liveBf2 = await (await req("/silos/live.json")).json();
    const bfEntry2 = liveBf2.silos.find((x) => x.id === bfId);
    assert(bfEntry2 && bfEntry2.state === "drying" && bfEntry2.pctLabel === "35% full", `live.json must carry the freezer at 35% with two lots, got ${JSON.stringify(bfEntry2)}`);
    // Unload Dry Space on a freezer lot: no dry weights, one control.
    const bfUnloadPage = await text(`/station/unload_dry_space?pick=${bfLot}`);
    assert(bfUnloadPage.res.status === 200, `freezer unload page expected 200 got ${bfUnloadPage.res.status}`);
    assert(bfUnloadPage.body.includes('<section class="freezer-unload" data-freezer-unload>'), "the freezer lot's panel must be the freezer unload");
    assert(bfUnloadPage.body.includes(">Remove the line</button>"), "the freezer panel must offer Remove the line");
    assert(!bfUnloadPage.body.includes("Dry weights") && !bfUnloadPage.body.includes("Finish unload"), "the freezer panel takes no dry weight");
    assert(bfUnloadPage.body.includes("<dt>From</dt><dd>Blast Freezer(s)</dd>"), "the panel must name the freezer");
    const uploadsBeforeBfUnload = await text("/admin/uploads");
    const pendingCountOf = (page) => Number((page.body.match(/Clear all pending \((\d+)\)<\/button>/) || [])[1] ?? "0");
    const pendingBeforeBfUnload = pendingCountOf(uploadsBeforeBfUnload);
    assert(pendingBeforeBfUnload >= 1, `the freezer load must have pended its location change, got ${pendingBeforeBfUnload}`);
    const countsBeforeBfUnload = await homeCounts();
    const removeLine = await req(`/station/unload_dry_space/lot/${bfLot}/finish`, { method: "POST", body: form({}) });
    assert(removeLine.status === 303, `remove the line expected 303 got ${removeLine.status} ${await removeLine.text()}`);
    assert((removeLine.headers.get("location") || "").includes("ok=frozen"), "the freezer unload must flash frozen");
    const frozenPage = await text("/station/unload_dry_space?ok=frozen");
    assert(frozenPage.body.includes("Line removed. The packages stand as FFZ in METRC; nothing moved."), "the flash must say the line was removed and nothing moved");
    assert(!frozenPage.body.includes(`href="/station/unload_dry_space?pick=${bfLot}"`), "the frozen lot must leave the Dry Space Queue pane");
    // THE ROOM HOLDS MANY (canon 0.30.132): the first line removed, the second
    // lot still chills alone at 10%; its own removal empties the freezer.
    const oneLeft = await text("/ops/drying_ops");
    assert(oneLeft.body.includes(`data-silo="${bfId}" data-silo-state="drying" data-silo-shape-kind="cube" data-space-type="freezer"`), "the freezer must keep chilling while its second lot stays");
    assert(oneLeft.body.includes('<span data-silo-label>Chilling Out</span> · <span data-silo-pct>10% full</span>'), "the remaining lot alone must read 10% of 800 lb");
    const oneLeftTile = oneLeft.body.slice(oneLeft.body.indexOf(`data-silo="${bfId}"`), oneLeft.body.indexOf(`data-silo="${bfId}"`) + 6000);
    assert(!oneLeftTile.includes(`data-load="${bfLoadId}"`) && oneLeftTile.includes(`data-load="${bfLoadId2}"`), "the removed lot's line must leave the tile, the other stay");
    const removeLine2 = await req(`/station/unload_dry_space/lot/${bfLot2}/finish`, { method: "POST", body: form({}) });
    assert(removeLine2.status === 303 && (removeLine2.headers.get("location") || "").includes("ok=frozen"), `removing the second line expected 303 frozen got ${removeLine2.status}`);
    const afterFrozen = await text("/ops/drying_ops");
    assert(afterFrozen.body.includes(`data-silo="${bfId}" data-silo-state="empty" data-silo-shape-kind="cube" data-space-type="freezer"`), "the freezer must read empty once its line is removed");
    assert(afterFrozen.body.includes('<span data-silo-label>empty</span> · <span data-silo-pct>0% full</span>'), "the empty freezer reads empty and 0% full");
    const countsAfterBfUnload = await homeCounts();
    assert(countsAfterBfUnload.unloaded === countsBeforeBfUnload.unloaded, "a frozen lot never enters the Unloaded Queue");
    assert(!queueSectionHtml(countsAfterBfUnload.body, "unloaded_queue").includes(bfLot), "the Data Queues Unloaded Queue must not list the frozen lot");
    assert(!queueSectionHtml(countsAfterBfUnload.body, "dry_space_queue").includes(bfLot), "the Dry Space Queue must not list the frozen lot");
    const trimAvailAfterFrozen = await text("/production/scheduling/trim");
    assert(!trimAvailAfterFrozen.body.includes(`data-schedule-hbn="${bfBatchId}"`), "a frozen lot never reaches the Trimming station");
    const frozenLot = await text(`/record/wet_weight_entries/${bfLot}/edit`);
    assert(frozenLot.res.status === 200, `frozen lot record expected 200 got ${frozenLot.res.status}`);
    const frozenLog = await text("/log");
    assert(frozenLog.body.includes("freezer line removed; the packages stand as FFZ in METRC") && frozenLog.body.includes("<td>frozen</td>"), "the change log must carry the frozen status under the freezer reason");
    // Nothing moved: the package still sits at Blast Freezer, the FFZ cube still counts it, no new file pends.
    const invAfterFrozen = await text("/reports/inventory_by_location?format=csv");
    assert(invAfterFrozen.body.includes("PNN,Blast Freezer,PNN,WIP"), "the package must stay at the METRC location Blast Freezer after the line is removed");
    const liveAfterFrozen = await (await req("/silos/live.json")).json();
    // THE ROOM HOLDS MANY (canon 0.30.132): both freezer packages stay at Blast Freezer, so the cube reads the two-lot figure.
    const uploadsAfterBfUnload = await text("/admin/uploads");
    assert(pendingCountOf(uploadsAfterBfUnload) === pendingBeforeBfUnload, "the freezer unload must pend no file");

    // THE VOIDED LOT LEAVES ITS SILO (canon 0.30.116; owner, 2026-09-17: "Can
    // you remove this lot from the silo?  I think I stranded it by deleting its
    // record in data queue"; his pick "Take the load with it"). A stray 1.00 g
    // lot is weighed, finished and loaded into a free silo, then voided in Data
    // Queues: the silo reads empty, the lot's ledger package is gone, the load
    // and the package carry the reason in the change log, and the silo takes
    // a new load again.
    // Every seeded silo is busy by now, so the walk adds a sixth in Admin.
    const addSilo6 = await req("/admin/lookups/dry_spaces", {
      method: "POST",
      body: form({ action: "add", name: "Silo 6", kind: "silo", farm_code: "PNN", space_type: "silo", capacity: "15000", capacity_uom: "lb" }),
    });
    assert(addSilo6.status === 303, `adding Silo 6 expected 303 got ${addSilo6.status} ${await addSilo6.text()}`);
    const drySpacesWith6 = await text("/admin/lookups/dry_spaces");
    const silo6Id = drySpaceIdByName(drySpacesWith6.body, "Silo 6");
    const liveForStray = await (await req("/silos/live.json")).json();
    const straySilo = (liveForStray.silos || []).find((x) => x.id === silo6Id);
    assert(straySilo && straySilo.shape === "cylinder" && straySilo.state === "empty", `Silo 6 must stand empty on live.json, got ${JSON.stringify(straySilo)}`);
    const acquireStray = await text("/station/acquire_hbn");
    const mkStray = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({ entry_date: "2026-09-17", farm_code: "PNN", grow_method_code: "GH", strain_id: optionValue(acquireStray.body, "Fruity Pebbles") }),
    });
    assert(mkStray.status === 303, `stray HBN acquire expected 303 got ${mkStray.status} ${await mkStray.text()}`);
    const strayHbn = new URL(mkStray.headers.get("location") || "", base).searchParams.get("minted");
    const wetStray = await text("/station/wet_weight");
    let strayBatchId = null;
    for (const m of wetStray.body.matchAll(/\?pick=([a-f0-9-]{36})">\d+\. PNN \//g)) {
      const page = await text(`/station/wet_weight?pick=${m[1]}`);
      if (page.body.includes(`<p class="muted">${strayHbn}</p>`)) {
        strayBatchId = m[1];
        break;
      }
    }
    assert(strayBatchId, "the wet pane must list the stray HBN among the PNN rows");
    const startStray = await req("/station/wet_weight", {
      method: "POST",
      body: form({ team_lead: "Smoke Lead", harvest_batch_id: strayBatchId, actual_dryspc: straySilo.id, notes: "0.30.116 stray" }),
    });
    assert(startStray.status === 303, `stray lot start expected 303 got ${startStray.status} ${await startStray.text()}`);
    const strayLot = new URL(startStray.headers.get("location") || "", base).searchParams.get("lot");
    assert(strayLot, "no lot id for the stray walk");
    const wStray = await req(`/station/wet_weight/lot/${strayLot}/weights`, { method: "POST", body: form({ weight_grams: "1.00" }) });
    assert(wStray.status === 303, `stray weight expected 303 got ${wStray.status}`);
    const finStray = await req(`/station/wet_weight/lot/${strayLot}/finish`, { method: "POST", body: form({ plant_prompt: "skip" }) });
    assert(finStray.status === 303, `stray finish expected 303 got ${finStray.status} ${await finStray.text()}`);
    await passEntry(strayLot);
    const loadStray = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: strayLot, dry_space_id: straySilo.id, start_time: "", loaded_at_iso: "" }),
    });
    assert(loadStray.status === 303, `stray load expected 303 got ${loadStray.status} ${await loadStray.text()}`);
    const strayLoadId = new URL(loadStray.headers.get("location") || "", base).searchParams.get("load");
    assert(strayLoadId, "the stray load must redirect to the load");
    const strayLoaded = await text("/ops/drying_ops");
    assert(strayLoaded.body.includes(`data-silo="${straySilo.id}" data-silo-state="drying"`), "the stray lot's silo must read drying once loaded");
    const invStrayBefore = await text("/reports/inventory_by_location?format=csv");
    assert(invStrayBefore.body.includes(`PNN,${straySilo.name},PNN,WIP,1,g`), `the stray package must sit under its silo before the void, got\n${invStrayBefore.body}`);
    const occupiedRefusal = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: strayLot, dry_space_id: straySilo.id, start_time: "", loaded_at_iso: "" }),
    });
    assert(occupiedRefusal.status === 400, `a second load of the loaded lot expected 400 got ${occupiedRefusal.status}`);
    const voidStray = await req(`/record/wet_weight_entries/${strayLot}/void`, {
      method: "POST",
      body: form({ back: "/admin/queues", reason: "smoke: a stray 1 g lot voided in Data Queues while loaded" }),
    });
    assert(voidStray.status === 303, `voiding the loaded stray lot expected 303 got ${voidStray.status} ${await voidStray.text()}`);
    const strayVoided = await text("/ops/drying_ops");
    assert(strayVoided.body.includes(`data-silo="${straySilo.id}" data-silo-state="empty"`), "the silo must read empty once its lot is voided");
    const liveStrayAfter = await (await req("/silos/live.json")).json();
    const strayEntryAfter = (liveStrayAfter.silos || []).find((x) => x.id === straySilo.id);
    assert(strayEntryAfter && strayEntryAfter.state === "empty", `live.json must read the silo empty after the void, got ${JSON.stringify(strayEntryAfter)}`);
    const invStrayAfter = await text("/reports/inventory_by_location?format=csv");
    assert(!invStrayAfter.body.includes(`PNN,${straySilo.name},PNN,WIP,1,g`), "the voided lot's package must leave the ledger");
    const strayLog = await text("/log");
    assert(strayLog.body.includes("the lot was voided; its load leaves the silo: smoke: a stray 1 g lot voided in Data Queues while loaded"), "the change log must carry the load's void under the lot's reason");
    assert(strayLog.body.includes("the lot was voided; its package leaves the ledger: smoke: a stray 1 g lot voided in Data Queues while loaded"), "the change log must carry the package's void under the lot's reason");
    const strayLoadRecord = await text(`/record/silo_loads/${strayLoadId}/edit`);
    assert(strayLoadRecord.res.status === 404 || strayLoadRecord.res.status === 400 || strayLoadRecord.body.includes("voided"), `the voided load's record must read voided or gone, got ${strayLoadRecord.res.status}`);
    assert(!queueSectionHtml((await homeCounts()).body, "dry_space_queue").includes(strayLot), "the Dry Space Queue must not list the voided lot");
    const unloadAfterStray = await text("/station/unload_dry_space");
    assert(!unloadAfterStray.body.includes(`?pick=${strayLot}`), "Unload Dry Space must not offer the voided lot");

    // THE MANIFEST BUILDER (canon 0.30.125). Owner, 2026-09-18, verbatim: "New
    // interco logistics layout: Three equal panes Left Pane: Origin License:
    // selecting a license exposes the METRC packages ordered numerically based
    // on the last six digits ... Middle Pane: Destination License: Selecting
    // exposes METRC location within that license (we call this "receive into")
    // Right Pane: Header: all the herbs and spices needed for a METRC manifest
    // (use our library of templates--I believe this one is T3 based) ...
    // [finish] button [cancel] button". His picks: finish downloads the T3 file
    // at once and records the move; receive-into is the mirror's; a package on
    // a finished manifest reads dim with no >>; a price box per added package.
    // The processor's mirror gains four digit-tailed packages (the FFZ row
    // stays in the file, so nothing goes gone); the origin pane lists them by
    // last six with the hex-tailed FFZ row after; finish records and the page
    // opens with the file downloading; the T3 file carries the header and the
    // prices; the refusals speak; the void in Data Queues frees the tags.
    const mbHead = "Tag,Source Harvest(s),Source Package(s),Original Source Package Label,Source Processing Job(s),Location,Sublocation,Item,Category,Item Strain,Quantity,Unit Of Measure,Production Batch Number,Source Production Batch,Lab Test Status,Finished Goods,Administrative Hold,Administrative Recall,Packaged Date,Received,Expiration Date,Lab Test Expiration";
    const MB = (six) => `1A4050300000000000${six}`;
    const mbRows = [
      `${FFZ_TAG},46258-PNN-ID-062-0-NA-26007,,,,Blast Freezer,,FFZ - Donny Burger - PNN - O,Buds,Donny Burger,"1,500",g,,,NotSubmitted,False,False,False,9/12/2026 12:00:00 AM,,,`,
      `${MB("001001")},46258-PNN-ID-062-0-NA-26007,,,,Cryo 1,,BUD - Donny Burger - PNN - O,Buds,Donny Burger,"2,000",g,,,TestPassed,False,False,False,9/15/2026 12:00:00 AM,,,`,
      `${MB("000012")},46258-PNN-ID-062-0-NA-26007,,,,Trim Room 1,,BUD - Donny Burger - PNN - O,Buds,Donny Burger,500,g,,,TestPassed,False,False,False,9/15/2026 12:00:00 AM,,,`,
      `${MB("000105")},46258-PNN-ID-062-0-NA-26007,,,,Cryo 1,,WPR - Donny Burger - PNN - O,Buds,Donny Burger,750.5,g,,,TestPassed,False,False,False,9/15/2026 12:00:00 AM,,,`,
      `${MB("000999")},46258-PNN-ID-062-0-NA-26007,,,,Trim Room 2,,SHA - Donny Burger - PNN - O,Shake/Trim,Donny Burger,120,g,,,TestPassed,False,False,False,9/15/2026 12:00:00 AM,,,`,
    ];
    const mbForm = new FormData();
    mbForm.append("file", new File([new TextEncoder().encode(`${mbHead}\r\n${mbRows.join("\r\n")}\r\n`)], "MetrcMichiganAUP000694PackagesActive_2.csv", { type: "text/csv" }));
    const mbMount = await req("/inventory/metrc/mount", { method: "POST", body: mbForm });
    const mbMountLoc = mbMount.headers.get("location") || "";
    assert(mbMount.status === 303 && mbMountLoc.includes("added=4") && mbMountLoc.includes("gone=0"), `the builder's packages must mount under 694 with nothing gone, got ${mbMount.status} ${mbMountLoc}`);
    await mbMount.text();
    // THE LOAD AND THE LOT (canon 0.30.241): the manifest builder is struck. The mirror mount above stays so a later adopt can still read those tags.
    const struck = await req("/interco/manifest/finish", { method: "POST", body: form({}) });
    assert(struck.status === 303 && (struck.headers.get("location") || "").endsWith("/ops/interco_logistics"), "a stale manifest finish must land on Logistics Operations and act on nothing");
    await struck.text();

    // THE MIRROR CLOSES THE LEDGER (canon 0.30.128). Owner, 2026-09-19,
    // verbatim: "How do I empty my FFZ inventory.  I passed a METRC Mirror for
    // the licenses that material was in, now METRC is showing 0 and the ledger
    // is full"; his picks: the packages were sold or transferred out, and the
    // mirror closes the ledger. The received truck package (tag E01, its
    // ledger item 500 g at the Blast Freezer since the Change Location walk,
    // so it counts as FFZ ledger grams) stands live in 832's mirror; a drop of
    // 832's packages without it marks it gone: the sweep closes the ledger
    // item with the mount's reason, the flash says so, the ledger page drops
    // the row, the cube's ledger side drops its grams, the log carries the
    // reason, and a re-drop closes nothing more.
    const ledgerLive = await text("/inventory");
    assert(ledgerLive.body.includes(`<code>${TRUCK_TAG}</code>`), "the truck package's ledger item must stand while METRC lists it");
    const mcHead = "Tag,Source Harvest(s),Source Package(s),Original Source Package Label,Source Processing Job(s),Location,Sublocation,Item,Category,Item Strain,Quantity,Unit Of Measure,Production Batch Number,Source Production Batch,Lab Test Status,Finished Goods,Administrative Hold,Administrative Recall,Packaged Date,Received,Expiration Date,Lab Test Expiration";
    const mcKeep832 = [
      `${SKU_BULK},45951-PNN-OD-051-0-02-25162,,,,24.2.A,,BUD - Donny Burger - PNS - O,Buds,Donny Burger,336,g,,,TestPassed,False,False,False,2025-12-01,2025-12-02,,`,
    ];
    const mcMount = async (rows, name) => {
      const f = new FormData();
      f.append("file", new File([new TextEncoder().encode(`${mcHead}\r\n${rows.join("\r\n")}\r\n`)], name, { type: "text/csv" }));
      const res = await req("/inventory/metrc/mount", { method: "POST", body: f });
      const loc = res.headers.get("location") || "";
      assert(res.status === 303, `${name} expected 303 got ${res.status} ${await res.text()}`);
      await res.text().catch(() => "");
      return loc;
    };
    const mcGone = await mcMount(mcKeep832, "MetrcMichiganAUGC000832PackagesActive_14.csv");
    assert(mcGone.includes("gone=1") && mcGone.includes("closed=1") && mcGone.includes("closed_packages=0"), `the truck package gone must close its ledger item (no queue package behind it), got ${mcGone}`);
    const mcGoneMount = (mcGone.match(/mount=([0-9a-f-]+)/) || [])[1] || "";
    const mcFlash = await text(mcGone);
    assert(mcFlash.body.includes('data-metrc-closed="1" data-metrc-closed-packages="0"'), "the flash must carry the closed counts");
    assert(mcFlash.body.includes("1 ledger item and 0 queue packages closed as gone in METRC."), "the flash must say the ledger item closed as gone in METRC");
    const ledgerGone = await text("/inventory");
    assert(!ledgerGone.body.includes(`<code>${TRUCK_TAG}</code>`), "the ledger item must leave the ledger once METRC marks its tag gone");
    const goneLog = await text("/log");
    assert(goneLog.body.includes(`gone in METRC (mount ${mcGoneMount.replaceAll("-", "").slice(0, 8)})`), "the change log must carry the closing under the mount's reason");
    const mcAgain = await mcMount(mcKeep832, "MetrcMichiganAUGC000832PackagesActive_15.csv");
    assert(mcAgain.includes("gone=0") && mcAgain.includes("closed=0"), `a re-drop must close nothing more, got ${mcAgain}`);
    const mcAgainFlash = await text(mcAgain);
    assert(mcAgainFlash.body.includes('data-metrc-closed="0" data-metrc-closed-packages="0"></span>'), "a drop that closes nothing carries an empty closing note");
    // The mirror keeps the row as history with its gone date.
    const e01Card = await text(`/inventory/metrc?tag=${TRUCK_TAG}`);
    assert(e01Card.body.includes('data-metrc-record="package"') && !/data-metrc-field="gone_at"><span class="muted">-<\/span>/.test(e01Card.body), "the truck package's mirror row must stand with its gone date");

    // THE FINISHED LOT IS ELIGIBLE (canon 0.30.130): the truck lot finished and
    // was never loaded; its package is now closed as gone. The pane keeps the
    // lot (Finish lot ran on it) marked "no live package", read by its HBN
    // serial (the package code that carried the tag is gone with the item, and
    // the HBN has no harvest tag); the pick shows the words where the load form
    // would stand; a hand-built load refuses in words naming the lot by its serial.
    const truckBatch = await passEntry(truckLotId);
    const goneLotPane = await text("/station/load_silo");
    assert(goneLotPane.body.includes(`href="/station/load_silo?pick=${truckBatch}"`), "a finished lot whose package is gone still stands on the pane");
    assert(new RegExp(`pick=${truckBatch}"><strong>\\d{5} / PNN / [^<]*</strong> <span class="muted">500 g</span> <span class="muted" data-no-package>\\(no live package\\)</span>`).test(goneLotPane.body), "the gone-package lot must be marked no live package on its row");
    const goneLotPick = await text(`/station/load_silo?pick=${truckLotId}`);
    assert(goneLotPick.body.includes('<p class="banner warn" data-no-package>'), "the pick of a gone-package lot must show the words");
    assert(!goneLotPick.body.includes('action="/station/load_silo/load"'), "no load form for a lot without a live package");
    const goneLotLoad = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: truckLotId, dry_space_id: drySpaceIdByName(lookupsPage.body, "Silo 5"), start_time: "", loaded_at_iso: "" }),
    });
    assert(goneLotLoad.status === 400, `loading a lot without a live package expected 400 got ${goneLotLoad.status}`);
    const goneLotWords = await goneLotLoad.text();
    assert(/Lot \d{5} has no live package in the ledger to move \(voided or closed\); restore it or repair the lot before loading\./.test(goneLotWords), `the refusal must name the lot by its serial, got ${goneLotWords.slice(0, 300)}`);

    // THE RECONCILE LEDGER LOCATION (canon 0.30.135; owner, 2026-09-20, verbatim:
    // "add a new button to Admin: [Reconcile Ledger Location] 1. Select Farm:
    // (inert for now--we're all one farm as long as interco is out of the chain)
    // 2. Select Location - Start with just the drying locations/freezers 1. Purge
    // 1. Reason 2. Admin PIN 2. Edit 1. All the data that's in the location
    // becomes editable plus a note before saving changes - reflect all on the
    // changelog - No changes to the original CSV, but add something to the data
    // queue that's more like a note that can be aknowe=ledged that the change
    // occurred."). The tile; the page with the inert farm and the drying
    // locations; Silo 4 holds the med lot's package: an unchanged save and a
    // noteless save refuse, a two-field edit lands on the log under the note
    // and rides the queue as a note, a move to a non-drying location refuses,
    // a move to Silo 6 lands; the purge of Silo 6 refuses without the PIN and
    // without a reason, then voids the package under the reason; an empty
    // location refuses to purge; the notes acknowledge one at a time.
    const adminForReconcile = await text("/admin");
    assert(adminForReconcile.body.includes('<a class="tile" href="/admin/reconcile-location">'), "Admin must carry the [Reconcile Ledger Location] button");
    assert(adminForReconcile.body.includes('<span class="tile-title">Reconcile Ledger Location</span>'), "the button must read Reconcile Ledger Location");
    const reconcileHome = await text("/admin/reconcile-location");
    assert(reconcileHome.res.status === 200, `reconcile page expected 200 got ${reconcileHome.res.status}`);
    assert(reconcileHome.body.includes("<h1>Reconcile Ledger Location</h1>"), "the page must carry its title");
    assert(reconcileHome.body.includes('<select name="farm" disabled data-farm-inert>'), "the farm select stands inert");
    assert(reconcileHome.body.includes('<option value="PNN" selected>'), "the inert farm select reads the landing farm");
    assert(reconcileHome.body.includes("One farm while Interco Logistics is out of the chain."), "the page must say why the farm is inert");
    for (const loc of ["Silo 1", "Silo 4", "Silo 6", "Arlington Dry Room", "Hang in Place"]) {
      assert(reconcileHome.body.includes(`<option value="${loc}">${loc}</option>`), `the location select must offer ${loc}`);
    }
    assert(reconcileHome.body.includes('<option value="Blast Freezer">Blast Freezer(s) (Blast Freezer)</option>'), "the freezer must be offered by the METRC location it stands over");
    assert(!reconcileHome.body.includes('<option value="Truck"'), "the truck sentinel is no location");
    assert(reconcileHome.body.includes("Pick a location to see what the ledger holds there."), "no location picked: the page says so");
    const reconcileSilo4 = await text("/admin/reconcile-location?location=Silo%204");
    assert(reconcileSilo4.res.status === 200, `Silo 4 reconcile expected 200 got ${reconcileSilo4.res.status}`);
    // Silo 4 holds two packages here: the med lot's (26016, 1,132 g) and the
    // ARL lot's (26014), whose Move To pencil carried it there; the walk edits
    // the med lot's alone, so its row is found by its code.
    assert(reconcileSilo4.body.includes('data-reconcile-count>2<'), `Silo 4 must hold two packages, got ${(reconcileSilo4.body.match(/data-reconcile-count>(\d+)</) || [])[1]}`);
    const reconcileItemId = (reconcileSilo4.body.match(/data-reconcile-item="([a-f0-9-]{36})"[\s\S]*?name="package_code__\1" value="26016"/) || [])[1];
    assert(reconcileItemId, "the Silo 4 row for package 26016 must carry its item id");
    assert(reconcileSilo4.body.includes(`name="qty__${reconcileItemId}" value="1132"`), "the grams box must carry the package's grams");
    assert(reconcileSilo4.body.includes(`<select name="location__${reconcileItemId}">`), "the row must carry the location select");
    assert(reconcileSilo4.body.includes('<form class="stack" method="post" action="/admin/reconcile-location/purge" data-reconcile-purge-form>'), "the purge form must stand");
    assert(reconcileSilo4.body.includes('name="admin_pin"') && reconcileSilo4.body.includes('name="reason" required'), "the purge asks a reason and the Admin PIN");
    const unchangedSave = await req("/admin/reconcile-location/edit", {
      method: "POST",
      body: form({ location: "Silo 4", note: "smoke: nothing changes", [`qty__${reconcileItemId}`]: "1132.00" }),
    });
    assert(unchangedSave.status === 400 && (await unchangedSave.text()).includes("Nothing changed; the ledger stands as it was."), "an unchanged save must refuse in words");
    const notelessSave = await req("/admin/reconcile-location/edit", {
      method: "POST",
      body: form({ location: "Silo 4", [`qty__${reconcileItemId}`]: "1130" }),
    });
    assert(notelessSave.status === 400 && (await notelessSave.text()).includes("Note is required."), "a save without a note must refuse in words");
    const editSave = await req("/admin/reconcile-location/edit", {
      method: "POST",
      body: form({ location: "Silo 4", note: "smoke: reconcile edit", [`qty__${reconcileItemId}`]: "1130", [`metrc_tag__${reconcileItemId}`]: "1a4060300003e5b000112233" }),
    });
    assert(editSave.status === 303, `the reconcile edit expected 303 got ${editSave.status} ${await editSave.text()}`);
    assert((editSave.headers.get("location") || "") === "/admin/reconcile-location?location=Silo%204&ok=edited&n=2", `the edit must return to the location with its count, got ${editSave.headers.get("location")}`);
    const afterEdit = await text("/admin/reconcile-location?location=Silo%204&ok=edited&n=2");
    assert(afterEdit.body.includes('data-reconcile-flash="edited"') && afterEdit.body.includes("2 fields saved."), "the flash must count the saved fields");
    assert(afterEdit.body.includes(`name="qty__${reconcileItemId}" value="1130"`), "the grams must read the new value");
    assert(afterEdit.body.includes(`name="metrc_tag__${reconcileItemId}" value="1A4060300003E5B000112233"`), "the tag must land upper-cased");
    const reconcileLog = await text("/log");
    assert(reconcileLog.body.includes("<td>reconcile edit: smoke: reconcile edit</td>"), "the change log must carry the edit under the note");
    assert(/<td>qty<\/td>\s*<td>1132<\/td>\s*<td>1130<\/td>/.test(reconcileLog.body), "the grams line must read old and new");
    assert(/<td>metrc_tag<\/td>\s*<td><\/td>\s*<td>1A4060300003E5B000112233<\/td>/.test(reconcileLog.body), "the tag line must read blank to the tag");
    const uploadsWithNote = await text("/admin/uploads");
    assert(uploadsWithNote.body.includes('data-fold="reconcile_notes"') && uploadsWithNote.body.includes("Reconciliation notes"), "the queue must carry the Reconciliation notes section");
    assert(uploadsWithNote.body.includes('data-reconcile-kind="edit"') && uploadsWithNote.body.includes("<td>2 fields on 1 package edited at Silo 4</td>") && uploadsWithNote.body.includes("<td>smoke: reconcile edit</td>"), "the edit note must say what changed and where");
    const badMove = await req("/admin/reconcile-location/edit", {
      method: "POST",
      body: form({ location: "Silo 4", note: "smoke: a move off the drying floor", [`location__${reconcileItemId}`]: "BARN" }),
    });
    assert(badMove.status === 400 && (await badMove.text()).includes("A package can only move to a drying location."), "a move to a non-drying location must refuse in words");
    const goodMove = await req("/admin/reconcile-location/edit", {
      method: "POST",
      body: form({ location: "Silo 4", note: "smoke: moved to Silo 6", [`location__${reconcileItemId}`]: "Silo 6" }),
    });
    assert(goodMove.status === 303 && (goodMove.headers.get("location") || "").endsWith("ok=edited&n=1"), `the move expected 303 with one field, got ${goodMove.status} ${goodMove.headers.get("location")}`);
    const silo4Less = await text("/admin/reconcile-location?location=Silo%204");
    assert(silo4Less.body.includes('data-reconcile-count>1<') && !silo4Less.body.includes(`data-reconcile-item="${reconcileItemId}"`), "Silo 4 must hold one package fewer after the move");
    const silo6Full = await text("/admin/reconcile-location?location=Silo%206");
    assert(silo6Full.body.includes('data-reconcile-count>1<') && silo6Full.body.includes(`data-reconcile-item="${reconcileItemId}"`), "Silo 6 must hold the moved package");
    const purgeNoPin = await req("/admin/reconcile-location/purge", { method: "POST", body: form({ location: "Silo 6", reason: "smoke: purge", admin_pin: "00000" }) });
    assert(purgeNoPin.status === 403 && (await purgeNoPin.text()).includes("Purging needs the Admin PIN."), "a purge with the wrong PIN must refuse in words");
    const purgeNoReason = await req("/admin/reconcile-location/purge", { method: "POST", body: form({ location: "Silo 6", reason: "", admin_pin: ADMIN_PIN }) });
    assert(purgeNoReason.status === 400 && (await purgeNoReason.text()).includes("Reason is required."), "a purge without a reason must refuse in words");
    const purgeEmpty = await req("/admin/reconcile-location/purge", { method: "POST", body: form({ location: "Hang in Place", reason: "smoke: nothing here", admin_pin: ADMIN_PIN }) });
    assert(purgeEmpty.status === 400 && (await purgeEmpty.text()).includes("Nothing at that location to purge."), "an empty location must refuse to purge in words");
    const purgeSilo6 = await req("/admin/reconcile-location/purge", { method: "POST", body: form({ location: "Silo 6", reason: "smoke: purge", admin_pin: ADMIN_PIN }) });
    assert(purgeSilo6.status === 303 && (purgeSilo6.headers.get("location") || "") === "/admin/reconcile-location?location=Silo%206&ok=purged&n=1", `the purge expected 303 got ${purgeSilo6.status} ${purgeSilo6.headers.get("location")}`);
    const afterPurge = await text("/admin/reconcile-location?location=Silo%206&ok=purged&n=1");
    assert(afterPurge.body.includes('data-reconcile-flash="purged"') && afterPurge.body.includes('data-reconcile-count>0<'), "the purge flash and the empty count must stand");
    const purgeLog = await text("/log");
    assert(purgeLog.body.includes("<td>reconcile purge: smoke: purge</td>"), "the change log must carry the purge under the reason");
    const invAfterPurge = await text("/inventory");
    assert(!invAfterPurge.body.includes(`<code>1A4060300003E5B000112233</code>`), "the purged package must leave the ledger");
    const uploadsThreeNotes = await text("/admin/uploads");
    const noteIds = [...uploadsThreeNotes.body.matchAll(/data-reconcile-note="([a-f0-9-]{36})" data-reconcile-kind="(purge|edit)"/g)].map((m) => ({ id: m[1], kind: m[2] }));
    assert(noteIds.length === 3 && noteIds.filter((n) => n.kind === "edit").length === 2 && noteIds.filter((n) => n.kind === "purge").length === 1, `three notes must ride the queue (two edits, one purge), got ${JSON.stringify(noteIds)}`);
    assert(uploadsThreeNotes.body.includes("<td>1 package voided, 1,130 g, at Silo 6</td>"), "the purge note must count the grams voided");
    const purgeNote = noteIds.find((n) => n.kind === "purge");
    const ack = await req(`/admin/uploads/reconcile_note/${purgeNote.id}/acknowledge`, { method: "POST", body: form({}) });
    assert(ack.status === 303 && (ack.headers.get("location") || "") === "/admin/uploads?ok=acknowledged", `acknowledging expected 303 got ${ack.status} ${ack.headers.get("location")}`);
    const uploadsAfterAck = await text("/admin/uploads?ok=acknowledged");
    assert(uploadsAfterAck.body.includes("data-ack-flash") && !uploadsAfterAck.body.includes(`data-reconcile-note="${purgeNote.id}"`), "the acknowledged note must leave the queue with the flash");
    assert((uploadsAfterAck.body.match(/data-reconcile-note="/g) || []).length === 2, "the two edit notes must still wait");
    const ackLog = await text("/log");
    assert(ackLog.body.includes("<td>reconcile note acknowledged</td>"), "the change log must carry the acknowledgement");

    // THE FFZ INVENTORY (canon 0.30.225): the picker offers drying locations and
    // freezers. Blast Freezer still lists the landed package. FFZ inventory is not a place.
    const ffzPick = await text("/admin/reconcile-location");
    assert(ffzPick.body.includes('value="Blast Freezer"') && !ffzPick.body.includes('value="FFZ inventory"'), "the picker must keep Blast Freezer and drop FFZ inventory");
    const bfPage = await text("/admin/reconcile-location?location=Blast%20Freezer");
    assert(bfPage.body.includes(`value="${FFZ_TAG}"`), "Blast Freezer must still list the landed fresh frozen package");
    const namedFfz = await text("/admin/reconcile-location?location=FFZ%20inventory");
    assert(namedFfz.res.status === 200 && !namedFfz.body.includes("<h2>FFZ inventory"), "a URL that still names FFZ inventory reads as no pick");
    const silo4RemainingId = (silo4Less.body.match(/data-reconcile-item="([a-f0-9-]{36})"/) || [])[1];
    assert(silo4RemainingId, "Silo 4 must still hold one package to try the move");
    const moveIntoFfz = await req("/admin/reconcile-location/edit", {
      method: "POST",
      body: form({ location: "Silo 4", note: "smoke: into the reading", [`location__${silo4RemainingId}`]: "FFZ inventory" }),
    });
    assert(moveIntoFfz.status === 400 && (await moveIntoFfz.text()).includes("A package can only move to a drying location."), `a move into FFZ inventory must refuse in words, got ${moveIntoFfz.status}`);

    // THE SHEET SYNC (canon 0.30.162). Owner: "can we setup a cron job or something to
    // regularly check the sheet?" The console says the sheet was never read; the Admin
    // tile and page stand; the cron (walked through wrangler's /__scheduled) reads the
    // fixture Labor workbook and lands the hours, a typed number replaced and a large
    // number taken as typed (his pick); the second run skips an unchanged sheet; Run now
    // flashes in words.
    const syncNever = await text("/harvest");
    assert(syncNever.body.includes('data-hc-metric="trim_sheet_hours" data-hc-sheet-sync="never"'), "before any run the sheet hours line must say never");
    assert(syncNever.body.includes("data-hc-sheet-sync-line>sheet never read</dd>"), "before any run the console must say the sheet was never read");
    const adminSyncTiles = await text("/admin");
    assert(adminSyncTiles.body.includes('href="/admin/sheet-sync"'), "Admin must carry the [Sheet sync] tile");
    assert(adminSyncTiles.body.includes('href="/admin/metrc-api"') && adminSyncTiles.body.includes("Metrc API"), "Admin must carry the [Metrc API] tile");
    const syncPageEmpty = await text("/admin/sheet-sync");
    if (syncPageEmpty.res.status !== 200) fail("GET /admin/sheet-sync", `status ${syncPageEmpty.res.status}`);
    assert(syncPageEmpty.body.includes("<h1>Sheet sync</h1>") && syncPageEmpty.body.includes("No runs yet.") && syncPageEmpty.body.includes("data-sheet-sync-run>Run now</button>"), "the empty Sheet sync page must offer Run now");
    assert(syncPageEmpty.body.includes('data-sheet-sync-name="">no sheet metadata yet</p>'), "no metadata before the first run");
    const syncYesterday = dayBeforeSmoke(farmDaySmoke(new Date().toISOString()));
    const syncOlder = dayBeforeSmoke(syncYesterday);
    const excelSerialSmoke = (iso) => Math.round((Date.parse(`${iso}T00:00:00.000Z`) - Date.UTC(1899, 11, 30)) / 86400000);
    const aliasMetrc = "45999-PNN-ID-027-1-NA-26080";
    const aliasSheet = `${excelSerialSmoke("2026-08-24")}-PNN-ID-027-0-NA-26080`;
    const agreeHbn = `${excelSerialSmoke("2026-08-25")}-PNN-GH-001-0-NA-26081`;
    const HIST = "1A4050300000000000000E80";
    const HIST2 = "1A4050300000000000000E81";
    const histMount = await mcMount(
      [
        ...mcKeep832,
        `${HIST},${aliasMetrc},,,,24.2.A,,WPR - Fruity Pebbles - PNN - O,Buds,Fruity Pebbles,33,g,,,TestPassed,False,False,False,8/24/2026 12:00:00 AM,,,`,
        `${HIST2},${agreeHbn},,,,24.2.A,,BUD - After Party - PNN - O,Buds,After Party,10,g,,,TestPassed,False,False,False,8/25/2026 12:00:00 AM,,,`,
      ],
      "MetrcMichiganAUGC000832PackagesActive_16.csv"
    );
    assert(histMount.includes("added=2") && histMount.includes("gone=0"), `the harvest fixture packages must mount beside the bulk row, got ${histMount}`);
    const cronFirst = await req("/__scheduled?cron=15+*+*+*+*", { noIdentity: true });
    const cronFirstBody = await cronFirst.text();
    assert(cronFirst.status === 200, `the scheduled walk expected 200 got ${cronFirst.status}: ${cronFirstBody.slice(0, 200)}`);
    // THE TESTING DESK part 3. The same cron records a skipped Metrc sweep when
    // the keys are absent, and makes no call. The page never shows a key.
    const metrcPage = await text("/admin/metrc-api");
    assert(metrcPage.res.status === 200, `GET /admin/metrc-api expected 200 got ${metrcPage.res.status}`);
    assert(metrcPage.body.includes('data-metrc-integrator="absent"') && metrcPage.body.includes('data-metrc-user="absent"'), "both Metrc keys must read absent");
    assert(metrcPage.body.includes('data-metrc-write="off"'), "the Metrc write switch must read off");
    assert(metrcPage.body.includes('data-metrc-base="sandbox-api-mi.metrc.com"'), "the Metrc base must be the sandbox");
    assert(!metrcPage.body.includes("https://api-mi.metrc.com"), "the page must not point at production");
    assert(metrcPage.body.includes('data-metrc-sweep="skipped"'), "the cron must record a skipped sweep when the keys are absent");
    assert(metrcPage.body.includes('data-metrc-calls="0"'), "a skipped sweep must make no call");
    const metrcTest = await text("/admin/metrc-api/test", { method: "POST", body: form({}) });
    assert(metrcTest.res.status === 303 && (metrcTest.res.headers.get("location") || "").includes("ok=absent"), `test connection without keys expected absent, got ${metrcTest.res.status} ${metrcTest.res.headers.get("location")}`);
    const metrcAbsent = await text(metrcTest.res.headers.get("location") || "/admin/metrc-api?ok=absent");
    assert(metrcAbsent.body.includes("The integrator key is absent.") && metrcAbsent.body.includes('data-metrc-calls="0"'), "test connection must say the key is absent and still make no call");
    const syncRead = await text("/harvest");
    assert(syncRead.body.includes('data-hc-sheet-sync="ok"'), "after the cron the sheet hours line must say ok");
    assert(/data-hc-sheet-sync-line>read from the sheet at \d{4}-\d{2}-\d{2} \d{1,2}:\d{2} (AM|PM) ET \(8 rows, \d+ changed\)<\/dd>/.test(syncRead.body), "the console must say when the sheet was read, with the rows seen and changed");
    assert(syncRead.body.includes(`<span class="hc-date muted">${syncYesterday}</span>`), "the console's day must still be yesterday");
    assert(syncRead.body.includes('data-hc-sheet-hours="PNN">PNN 8.25</span>') && syncRead.body.includes('data-hc-sheet-hours="ARL">ARL 12.5</span>') && syncRead.body.includes('data-hc-sheet-hours="PNS">PNS 4</span>'), "yesterday's hours must land from the sheet per farm");
    assert(/value="8.25"[^>]*aria-label="Cutting and Bucking Hours Yesterday PNN"/.test(syncRead.body), "the Plants numbox must show the landed hours");
    const syncOlderPage = await text(`/harvest?day=${syncOlder}`);
    assert(syncOlderPage.body.includes('data-hc-sheet-hours="PNN">PNN 2753</span>'), "a large number lands as typed (his pick: no cap)");
    const syncPageRead = await text("/admin/sheet-sync");
    assert(syncPageRead.body.includes('data-sheet-sync-latest="ok"') && /data-sheet-sync-seen="8"/.test(syncPageRead.body), "the Admin page must list the ok run with 8 rows seen");
    assert(syncPageRead.body.includes('data-harvest-seen="4"') && syncPageRead.body.includes('data-harvest-landed="3"') && syncPageRead.body.includes('data-harvest-skipped="1"'), "Harvest Details must count 4 seen, 3 landed, 1 skipped");
    assert(syncPageRead.body.includes("No Such Herb") && syncPageRead.body.includes(`${aliasSheet} follows METRC ${aliasMetrc}`), "the run must name the skipped strain and the METRC pair");
    const sheetExport = (await text("/export/harvest_batches.csv")).body.split(/\r?\n/);
    const aliasLine = sheetExport.find((line) => line.includes(aliasMetrc)) || "";
    const agreeLine = sheetExport.find((line) => line.includes(agreeHbn)) || "";
    const knownLine = sheetExport.find((line) => line.includes("26244-ARL-GH-027-0-NA-26010")) || "";
    assert(aliasLine.endsWith(",sheet") && !sheetExport.some((line) => line.includes(aliasSheet)), `serial 80 must be minted under METRC's text, got ${aliasLine}`);
    assert(agreeLine.endsWith(",sheet"), `the agreeing lot must keep the sheet's text, got ${agreeLine}`);
    assert(knownLine.includes("Smoke Cream") && knownLine.endsWith(",app"), `the app batch must take the sheet's market strain and stay app-born, got ${knownLine}`);
    const sheetLog = await text("/log");
    assert(sheetLog.body.includes("<td>harvest details (sync)</td>") && sheetLog.body.includes("<td>Smoke Cream</td>"), "the market strain change must be logged under harvest details (sync)");
    const sheetId = aliasLine.split(",")[0];
    const wetSheet = await text("/station/wet_weight");
    assert(sheetId && wetSheet.body.includes(`?pick=${sheetId}`), "the wet weight pick must offer the sheet-born batch");
    assert(queueSectionHtml((await homeCounts()).body, "hbn_queue").includes(aliasMetrc), "the HBN Queue must keep the sheet-born batch");
    assert(syncPageRead.body.includes('data-sheet-sync-name="smoke-labor.xlsx"'), "the Admin page must name the fixture sheet from the last metadata");
    assert(!/cfas[t]_|Bearer /.test(syncPageRead.body), "no token on the Sheet sync page (the pattern is spelled so the secret grep stays clean)");
    const cronSecond = await req("/__scheduled?cron=15+*+*+*+*", { noIdentity: true });
    await cronSecond.text();
    const syncSkipped = await text("/harvest");
    assert(syncSkipped.body.includes('data-hc-sheet-sync="skipped"') && /data-hc-sheet-sync-line>sheet unchanged since \d{4}-\d{2}-\d{2} \d{1,2}:\d{2} (AM|PM) ET<\/dd>/.test(syncSkipped.body), "an unchanged sheet must skip and say since when");
    assert(syncSkipped.body.includes('data-hc-sheet-hours="PNN">PNN 8.25</span>'), "a skipped run leaves the hours standing");
    const runNow = await req("/admin/sheet-sync/run", { method: "POST", body: form({}) });
    assert(runNow.status === 303 && (runNow.headers.get("location") || "") === "/admin/sheet-sync?ok=ran", `Run now expected 303 to ?ok=ran got ${runNow.status} ${runNow.headers.get("location")}`);
    const syncPageRan = await text("/admin/sheet-sync?ok=ran");
    assert(syncPageRan.body.includes('data-sheet-sync-flash="skipped">The sheet was unchanged.</p>'), "Run now on an unchanged sheet must flash in words");
    assert((syncPageRan.body.match(/data-sheet-sync-source="labor"/g) || []).length === 3, "the page must list the three Labor runs");
    assert((syncPageRan.body.match(/data-sheet-sync-source="in_testing"/g) || []).length === 2, "the page must list the two In Testing cron runs");
    assert((syncPageRan.body.match(/<td>admin<\/td>/g) || []).length === 1 && (syncPageRan.body.match(/<td>cron<\/td>/g) || []).length === 4, "the page must list the labor and in-testing triggers");
    assert(syncPageRan.body.includes('data-in-testing-latest="ok"'), "the last In Testing run must read ok");
    assert(syncPageRan.body.includes("The sheet is the source of the cutting and bucking hours and replaces a typed number at the next hour."), "the page must say the sheet is the source");
    const xlsmBook = await req("/__sheet-fixture");
    assert(xlsmBook.status === 200, `the sheet fixture expected 200 got ${xlsmBook.status}`);
    const xlsmBytes = new Uint8Array(await xlsmBook.arrayBuffer());
    const xlsmUp = new FormData();
    xlsmUp.append("file", new File([xlsmBytes], "smoke-harvest.xlsm", { type: "application/vnd.ms-excel.sheet.macroEnabled.12" }));
    const xlsmPosted = await req("/admin/imports", { method: "POST", body: xlsmUp });
    assert(xlsmPosted.status === 303, `the xlsm upload expected 303 got ${xlsmPosted.status}`);
    const xlsmLoc = xlsmPosted.headers.get("location") || "";
    assert(xlsmLoc.includes("ok=harvest_details") && xlsmLoc.includes("hseen=4") && xlsmLoc.includes("hlanded=0") && xlsmLoc.includes("hskipped=1") && xlsmLoc.includes("lseen=8"), `the xlsm upload must land both tabs, got ${xlsmLoc}`);
    const xlsmPage = await text(xlsmLoc);
    assert(xlsmPage.body.includes("Harvest Details: 4 seen, 0 landed, 0 changed, 1 skipped; Labor: 8 seen, 0 landed."), "the import page must say both counts");
    assert(xlsmPage.body.includes("No Such Herb"), "the flash must name the skipped strain");
    const xlsxUp = new FormData();
    xlsxUp.append("file", new File([xlsmBytes], "smoke-harvest.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const xlsxPosted = await req("/admin/imports", { method: "POST", body: xlsxUp });
    assert(xlsxPosted.status === 303 && (xlsxPosted.headers.get("location") || "").includes("ok=file_queued"), `an xlsx copy must still queue, got ${xlsxPosted.status} ${xlsxPosted.headers.get("location")}`);
    const capUp = new FormData();
    capUp.append("file", new File([new Uint8Array(8_000_001)], "too-big.xlsm", { type: "application/vnd.ms-excel.sheet.macroEnabled.12" }));
    const capPosted = await req("/admin/imports", { method: "POST", body: capUp });
    assert(capPosted.status === 400 && (await capPosted.text()).includes("That file is over the cap."), `an xlsm over the cap must refuse, got ${capPosted.status}`);
    const seededConsole = await text("/harvest");
    assert(seededConsole.body.includes("Seed Pass") && seededConsole.body.includes("1A40503000311FB0000000A1"), "the console Testing section must read the seeded sheet history");
    const complianceSeed = await text("/compliance/testing?tab=external");
    assert(complianceSeed.body.includes("1A40503000311FB0000000A2") && complianceSeed.body.includes("BUD Seed"), "the compliance page must list the seeded sample");
    const fixtureBook = await req("/__sheet-fixture?book=in_testing");
    assert(fixtureBook.status === 200, `the in testing fixture expected 200 got ${fixtureBook.status}`);
    const fixtureBytes = new Uint8Array(await fixtureBook.arrayBuffer());
    const upload = new FormData();
    upload.append("file", new File([fixtureBytes], "in-testing-smoke.xlsb", { type: "application/vnd.ms-excel.sheet.binary.macroEnabled.12" }));
    const uploaded = await req("/admin/imports", { method: "POST", body: upload });
    assert(uploaded.status === 303, `the xlsb upload expected 303 got ${uploaded.status}`);
    const uploadLoc = uploaded.headers.get("location") || "";
    assert(uploadLoc.includes("ok=in_testing") && uploadLoc.includes("seen=2"), `the upload must read the counts back, got ${uploadLoc}`);
    const uploadPage = await text(uploadLoc);
    assert(uploadPage.body.includes("In testing sheet: 2 seen,"), "the import page must say the counts in words");
    const syncTrimNote = syncSkipped.body.slice(syncSkipped.body.indexOf('data-hc-section="trimming"'), syncSkipped.body.indexOf('data-hc-section="pasteurization"'));
    assert(syncTrimNote.includes("The sheet is the source of the cutting and bucking hours and replaces a typed number at the next hour."), "the Trimming footnote must name the sheet as the source");
    const dropsPath = join(appRoot, "..", "DROPS", "In Testing (2026).xlsb");
    if (existsSync(dropsPath)) {
      const dropped = readFileSync(dropsPath);
      const real = new FormData();
      real.append("file", new File([dropped], "In Testing (2026).xlsb", { type: "application/vnd.ms-excel.sheet.binary.macroEnabled.12" }));
      const realUp = await req("/admin/imports", { method: "POST", body: real });
      const realLoc = realUp.headers.get("location") || "";
      console.log(`DROPS In Testing upload ${realUp.status} ${realLoc}`);
    } else {
      console.log("DROPS In Testing workbook absent; smoke skipped that upload");
    }

    // THE PREPACK (canon 0.30.188). A test-passed WPR is scheduled, packed, and
    // read on the console. This walk sits last so its change log does not push
    // earlier lines off the log page.
    const PP1 = "1A4050300000000000000A01";
    const PP2 = "1A4050300000000000000A02";
    const BAG1 = "1A4050300000000000000B01";
    const BAG2 = "1A4050300000000000000B02";
    const BAG3 = "1A4050300000000000000B03";
    const prepackDay = dayBeforeSmoke(farmDaySmoke(new Date().toISOString()));
    const schedCryo = await req("/production/scheduling/cryo/schedule", { method: "POST", body: form({ hbn_id: batchId }) });
    assert(schedCryo.status === 303, `scheduling the prepack source run expected 303 got ${schedCryo.status} ${await schedCryo.text()}`);
    const cryoWork = schedPaneOf((await text("/production/scheduling/cryo")).body, "working");
    const prepackRun = (cryoWork.match(/data-schedule-id="([^"]+)"/) || [])[1];
    assert(prepackRun, "the working pane must carry the run that will feed prepack");
    const addWpr = (tag, grams) => req(`/station/cryo_weight/run/${prepackRun}/add`, { method: "POST", body: form({ package_code: tag, package_type_code: "WPR", weight_grams: grams, cryo_operator: "Austin" }) });
    const wprA = await addWpr(PP1, "20");
    assert(wprA.status === 303, `the first WPR output expected 303 got ${wprA.status} ${await wprA.text()}`);
    const wprB = await addWpr(PP2, "10");
    assert(wprB.status === 303, `the second WPR output expected 303 got ${wprB.status} ${await wprB.text()}`);
    const TAG_Q = "1A4050300000000000000C11";
    const TAG_HOLD = "1A4050300000000000000C12";
    const STRANGER = "1A4050300000000000000D01";
    const wprQ = await addWpr(TAG_Q, "15");
    assert(wprQ.status === 303, `the queue WPR expected 303 got ${wprQ.status} ${await wprQ.text()}`);
    const wprHold = await addWpr(TAG_HOLD, "8");
    assert(wprHold.status === 303, `the held WPR expected 303 got ${wprHold.status} ${await wprHold.text()}`);
    const finishFeed = await req(`/station/cryo_weight/run/${prepackRun}/finish`, { method: "POST", body: form({}) });
    assert(finishFeed.status === 303, `finishing the feed run expected 303 got ${finishFeed.status} ${await finishFeed.text()}`);
    const releaseTag = async (tag) => {
      const queue = await text("/admin/queues");
      const at = queue.body.indexOf(tag);
      assert(at >= 0, `the testing queue must list ${tag}`);
      const id = (queue.body.slice(at, at + 2500).match(/name="id" value="([^"]+)"/) || [])[1];
      assert(id, `the testing queue must offer a release for ${tag}`);
      const released = await req("/queue/testing_queue/control", { method: "POST", body: form({ id, control: "release", outcome: "passed", note: "smoke prepack" }) });
      assert(released.status === 303, `releasing ${tag} expected 303 got ${released.status}`);
      await released.text();
    };
    await releaseTag(PP1);
    await releaseTag(PP2);
    const availPre = await text("/production/scheduling/prepack");
    assert(availPre.body.includes("000A01") && availPre.body.includes("000A02"), "available prepack must list each WPR tag");
    // THE PACKAGE READS IN FOUR LINES (canon 0.30.199): the whole tag, the strain
    // and grams, the HBN, the location, each on its own line; the old one-line
    // identity is gone.
    assert(
      availPre.body.includes(`<span class="pkg-tag">${PP1}</span>`) && availPre.body.includes(`<span class="pkg-hbn">${pickedHbn}</span>`) &&
        /<span class="pkg-strain-grams">Fruity Pebbles - [\d,]+ g<\/span>/.test(availPre.body) && /<span class="pkg-location">Location: [^<]+<\/span>/.test(availPre.body),
      "a prepack row must read the whole tag, the strain and grams, the HBN and the location on their own lines"
    );
    assert(!availPre.body.includes("schedule-identity") && !/000A01 \/ Fruity Pebbles/.test(availPre.body), "the one-line identity must be gone from the prepack page");
    // THE SCHEDULER BY PACKAGE (canon 0.30.196): packages on the panes with >>
    // each; the filter narrows by last six or HBN and rides ?q=; >> on one
    // package leaves its HBN sibling Available; << returns it.
    const pkgOf = (body, tag) => (body.match(new RegExp(`data-schedule-tag="${tag}"[^>]*>[\\s\\S]{0,700}?name="wip_package_id" value="([^"]+)"`)) || [])[1];
    const pkgA = pkgOf(availPre.body, PP1);
    const pkgB = pkgOf(availPre.body, PP2);
    assert(pkgA && pkgB && pkgA !== pkgB, "each available package must carry its own >>");
    assert(!availPre.body.includes('name="hbn_id"') && !availPre.body.includes('<details class="pane-group"'), "the prepack page must list packages, never a whole HBN");
    assert(availPre.body.includes(`data-schedule-tag="${PP1}" data-schedule-hbn="${pickedHbn}">`), "a package row must carry its tag and its HBN");
    assert(availPre.body.includes('placeholder="HBN or last six"') && availPre.body.includes("data-schedule-filter"), "the filter box must sit on the prepack page");
    assert(
      availPre.body.includes('<details data-schedule-heading class="queue-fold" data-fold="grow:Greenhouse" open><summary><h3>Greenhouse <span class="tile-count" data-schedule-heading-count>') &&
        availPre.body.includes('var storeKey = "gf_fold:" + location.pathname'),
      "available prepack must head Greenhouse with a count and fold the way Data Queues folds"
    );
    const ghCount = (availPre.body.match(/data-fold="grow:Greenhouse" open><summary><h3>Greenhouse <span class="tile-count" data-schedule-heading-count>(\d+)<\/span>/) || [])[1];
    const ghStart = availPre.body.indexOf('data-fold="grow:Greenhouse"');
    const ghBlock = availPre.body.slice(ghStart, availPre.body.indexOf("</details>", ghStart));
    const ghShown = (ghBlock.match(/<li class="schedule-item"[^>]*>/g) || []).filter((row) => !/\shidden>/.test(row)).length;
    assert(ghCount && Number(ghCount) === ghShown && ghShown >= 2, "the Greenhouse heading must count the packages under it");
    const bySix = await text("/production/scheduling/prepack?q=000A01");
    assert(
      bySix.body.includes(`data-schedule-tag="${PP1}" data-schedule-hbn="${pickedHbn}">`) && bySix.body.includes(`data-schedule-tag="${PP2}" data-schedule-hbn="${pickedHbn}" hidden>`),
      "?q= by last six must keep the one package and hide its sibling under its heading"
    );
    assert(bySix.body.includes('name="q" value="000A01"') && bySix.body.includes('data-schedule-count="available">1<'), "the filter must keep the typed value and count what it shows");
    assert(
      bySix.body.includes('data-schedule-heading class="queue-fold" data-fold="grow:Greenhouse" open') &&
        bySix.body.includes('<h3>Greenhouse <span class="tile-count" data-schedule-heading-count>'),
      "the filter must keep the Greenhouse heading while a package under it still shows"
    );
    const byHbn = await text(`/production/scheduling/prepack?q=${encodeURIComponent(pickedHbn)}`);
    assert(
      byHbn.body.includes(`data-schedule-tag="${PP1}" data-schedule-hbn="${pickedHbn}">`) && byHbn.body.includes(`data-schedule-tag="${PP2}" data-schedule-hbn="${pickedHbn}">`),
      "?q= by HBN must keep both packages of the HBN"
    );
    const byNone = await text("/production/scheduling/prepack?q=zz9");
    assert(byNone.body.includes(`data-schedule-tag="${PP1}" data-schedule-hbn="${pickedHbn}" hidden>`) && byNone.body.includes('data-schedule-count="available">0<'), "a filter that matches nothing must hide every row");
    const schedA = await req("/production/scheduling/prepack/schedule", { method: "POST", body: form({ wip_package_id: pkgA, q: "000A01" }) });
    assert(schedA.status === 303 && (schedA.headers.get("location") || "").endsWith("ok=scheduled&n=1&q=000A01"), `>> on one package expected that package alone, got ${schedA.status} ${schedA.headers.get("location")}`);
    const availOne = schedPaneOf((await text("/production/scheduling/prepack")).body, "available");
    assert(availOne.includes(`data-schedule-tag="${PP2}"`) && !availOne.includes(`data-schedule-tag="${PP1}"`), "the HBN sibling must stay Available while the one package is scheduled");
    const schedB = await req("/production/scheduling/prepack/schedule", { method: "POST", body: form({ wip_package_id: pkgB }) });
    assert(schedB.status === 303, `>> on the sibling expected 303 got ${schedB.status}`);
    const jobIn = (body, six) => (schedPaneOf(body, "working").match(new RegExp(`data-schedule-id="([^"]+)"[\\s\\S]{0,240}${six}`)) || [])[1];
    const bothIn = await text("/production/scheduling/prepack");
    assert(bothIn.body.includes('title="Unschedule" aria-label="Unschedule">&lt;&lt;</button>'), "a scheduled package must carry <<");
    const backB = await req(`/production/scheduling/prepack/unschedule/${jobIn(bothIn.body, "000A02")}`, { method: "POST", body: form({}) });
    assert(backB.status === 303 && (backB.headers.get("location") || "").includes("ok=unscheduled"), `<< expected 303 got ${backB.status}`);
    assert(schedPaneOf((await text("/production/scheduling/prepack")).body, "available").includes(`data-schedule-tag="${PP2}"`), "<< must return the package to Available");
    const schedB2 = await req("/production/scheduling/prepack/schedule", { method: "POST", body: form({ wip_package_id: pkgB }) });
    assert(schedB2.status === 303, `>> again expected 303 got ${schedB2.status}`);
    const schedTwice = await req("/production/scheduling/prepack/schedule", { method: "POST", body: form({ wip_package_id: pkgB }) });
    assert(schedTwice.status === 400 && (await schedTwice.text()).includes("That package is already on the schedule."), "a second >> on the same package must refuse in words");
    const hbnWide = await req("/production/scheduling/prepack/schedule", { method: "POST", body: form({ hbn_id: batchId }) });
    assert(hbnWide.status === 400, `an HBN-wide post on prepack expected 400 got ${hbnWide.status}`);
    await hbnWide.text();
    const workPre = await text("/production/scheduling/prepack");
    const jobOf = (six) => jobIn(workPre.body, six);
    const jobA = jobOf("000A01");
    const jobB = jobOf("000A02");
    assert(jobA && jobB && jobA !== jobB, "the working pane must carry both prepack jobs");
    const stationA = await text(`/station/prepack?pick=${jobA}`);
    assert(stationA.body.includes('value="3.5" selected'), "the unit must default to 3.5 when none has been used");
    const lineOf = (job, unit, bags, tag) => req(`/station/prepack/${job}/line`, { method: "POST", body: form({ unit_grams: unit, bags, tag, effective_date: prepackDay, effective_pin: ADMIN_PIN }) });
    const line1 = await lineOf(jobA, "3.5", "2", BAG1);
    assert(line1.status === 303, `the first prepack line expected 303 got ${line1.status} ${await line1.text()}`);
    const line2 = await lineOf(jobA, "7", "1", BAG2);
    assert(line2.status === 303, `the second prepack line expected 303 got ${line2.status} ${await line2.text()}`);
    const packed = await text(`/station/prepack?pick=${jobA}`);
    assert(packed.body.includes('data-prepack-size="3.5"') && packed.body.includes('data-prepack-size="7"'), "the right pane must list both bag types");
    assert(packed.body.includes("Total lbs produced"), "the right pane must total the pounds");
    assert(packed.body.includes("Grams remaining"), "the right pane must show the grams still on the parent");
    const ask = await req(`/station/prepack/${jobA}/finish`, { method: "POST", body: form({}) });
    assert(ask.status === 303 && (ask.headers.get("location") || "").includes("ask=1"), `a remainder must ask before it finishes, got ${ask.status} ${ask.headers.get("location")}`);
    const asked = await text(ask.headers.get("location") || "");
    assert(asked.body.includes("Push it onto the next pack job?"), "the question must offer the remainder to the next job");
    const yes = await req(`/station/prepack/${jobA}/finish`, { method: "POST", body: form({ push: "yes" }) });
    assert(yes.status === 303 && (yes.headers.get("location") || "").includes("ok=finished"), `Finish Pack yes expected the finished flash, got ${yes.status} ${yes.headers.get("location")}`);
    const stationB = await text(`/station/prepack?pick=${jobB}`);
    assert(stationB.body.includes("Use it first?"), "the next job must offer the open carry");
    assert(stationB.body.includes('value="7" selected'), "the unit must default to the last one used");
    const carryId = (stationB.body.match(/data-prepack-carry="([^"]+)"/) || [])[1];
    assert(carryId, "the carry prompt must name the carry");
    const line3 = await req(`/station/prepack/${jobB}/line`, { method: "POST", body: form({ unit_grams: "3.5", bags: "1", tag: BAG3, carry_id: carryId, effective_date: prepackDay, effective_pin: ADMIN_PIN }) });
    assert(line3.status === 303, `the line that uses the carry expected 303 got ${line3.status} ${await line3.text()}`);
    const uploadsPre = await text("/admin/uploads");
    assert(uploadsPre.body.includes(`data-prepack-upload="new_packages" data-prepack-job="${jobA}"`) || uploadsPre.body.includes(`data-prepack-job="${jobA}"`), "the new packages file must pend for the finished job");
    assert(uploadsPre.body.includes('data-prepack-upload="package_finish"'), "the finish file must pend");
    const np = await req(`/admin/uploads/new_packages/${jobA}.xlsx`);
    assert(np.status === 200, `the new packages download expected 200 got ${np.status}`);
    const prepackNp = new TextDecoder("latin1").decode(await np.arrayBuffer());
    assert(prepackNp.includes(BAG1) && prepackNp.includes(BAG2) && prepackNp.includes("Each") && prepackNp.includes("PREPACK 3.5") && prepackNp.includes("PREPACK 7") && prepackNp.includes(PP1), "the new packages file must name the bags, Each, the items, and the parent");
    const fin = await text(`/admin/uploads/package_finish/${jobA}.csv`);
    assert(fin.res.status === 200 && fin.body.startsWith("Label,ActualDate") && fin.body.includes(PP1), "the finish file must name the parent tag");
    const consolePre = await text("/harvest");
    assert(consolePre.body.includes('data-hc-section="prepack"') && consolePre.body.includes('data-prepack-unit="3.5"') && consolePre.body.includes("type the hours"), "the console Prepack section must read yesterday's bags and the hours box");
    const hoursPre = await req("/harvest/prepack-hours", { method: "POST", body: form({ work_date: prepackDay, hours: "4", day_picked: "1" }) });
    assert(hoursPre.status === 303, `prepack hours expected 303 got ${hoursPre.status}`);
    const consoleHours = await text(hoursPre.headers.get("location") || "/harvest");
    assert(consoleHours.body.includes('data-hc="prepack_lbs_per_dlh"') && !consoleHours.body.includes("type the hours"), "Lbs/DLH must replace the prompt once the hours are typed");

    // THE MIRROR RELEASES THE QUEUE (canon 0.30.193). TAG_Q is still in the
    // Testing Queue. A packages mount that says TestPassed releases it, and a
    // stranger WPR with this HBN can be adopted.
    const releaseHead = "Tag,Source Harvest(s),Source Package(s),Original Source Package Label,Source Processing Job(s),Location,Sublocation,Item,Category,Item Strain,Quantity,Unit Of Measure,Production Batch Number,Source Production Batch,Lab Test Status,Finished Goods,Administrative Hold,Administrative Recall,Packaged Date,Received,Expiration Date,Lab Test Expiration";
    const releaseRow = (tag, status, grams, location) =>
      `${tag},${pickedHbn},,,,${location},,WPR - Fruity Pebbles - ARL - O,Buds,Fruity Pebbles,${grams},g,,,${status},False,False,False,9/22/2026 12:00:00 AM,,,`;
    const TAG_099 = "1A4050300000000000000E99";
    const HBN_099 = "46299-PNN-ID-099-0-NA-26099";
    const row099 = `${TAG_099},${HBN_099},,,,Trim Room,,WPR - Mystery Market - ARL - O,Buds,Mystery Market,12,g,,,TestPassed,False,False,False,9/22/2026 12:00:00 AM,,,`;
    const rowHist = `${HIST},${aliasMetrc},,,,24.2.A,,WPR - Fruity Pebbles - PNN - O,Buds,Fruity Pebbles,33,g,,,TestPassed,False,False,False,8/24/2026 12:00:00 AM,,,`;
    const releaseCsv = `${releaseHead}\r\n${releaseRow(TAG_Q, "TestPassed", "15", "Cryo Room")}\r\n${releaseRow(TAG_HOLD, "NotSubmitted", "8", "Cryo Room")}\r\n${releaseRow(STRANGER, "TestPassed", "40", "Trim Room")}\r\n${row099}\r\n${rowHist}\r\n`;
    const releaseForm = new FormData();
    releaseForm.append("file", new File([new TextEncoder().encode(releaseCsv)], "MetrcMichiganAUGC000832PackagesActive_release.csv", { type: "text/csv" }));
    const releaseMount = await req("/inventory/metrc/mount", { method: "POST", body: releaseForm });
    assert(releaseMount.status === 303, `the release mount expected 303 got ${releaseMount.status} ${await releaseMount.text()}`);
    const releaseLoc = releaseMount.headers.get("location") || "";
    assert(releaseLoc.includes("released=1") && releaseLoc.includes("released_passed=1") && releaseLoc.includes("released_failed=0"), `the mount must say one pass released, got ${releaseLoc}`);
    const releasePage = await text(releaseLoc);
    assert(releasePage.body.includes("1 released from the Testing Queue by METRC (1 passed, 0 failed)."), "the flash must say the release in words");
    const queueAfter = await text("/admin/queues");
    assert(!queueAfter.body.includes(TAG_Q), "a TestPassed package must leave the Testing Queue");
    assert(queueAfter.body.includes("Lab status (METRC)") && queueAfter.body.includes("NotSubmitted"), "the queue must show the mirror lab status");
    const availReleased = await text("/production/scheduling/prepack");
    assert(availReleased.body.includes("000C11"), "the released package must stand in Prepack Available");
    // THE HBN INHERITED (canon 0.30.196): the row names the HBN it will inherit; no select, no pick.
    const strangerAvail = schedPaneOf(availReleased.body, "available");
    assert(!strangerAvail.includes("data-schedule-adopt") && !strangerAvail.includes("From METRC") && !strangerAvail.includes("new from METRC"), "the From METRC section is gone");
    const strangerGhStart = strangerAvail.indexOf('data-fold="grow:Greenhouse"');
    const strangerGhNext = strangerAvail.indexOf("<details", strangerGhStart + 10);
    const strangerGh = strangerAvail.slice(strangerGhStart, strangerGhNext < 0 ? undefined : strangerGhNext);
    assert(strangerGh.includes(`data-adopt-tag="${STRANGER}"`) && strangerGh.includes(`<span class="pkg-hbn">${pickedHbn}</span>`), "the stranger sits under Greenhouse and its HBN line is the HBN alone");
    const ghRows = (strangerGh.match(/<li class="schedule-item"/g) || []).length;
    const ghBadge = Number((strangerGh.match(/data-schedule-heading-count>(\d+)/) || [])[1]);
    assert(ghBadge === ghRows && strangerGh.includes(`name="tag" value="${STRANGER}"`), `the Greenhouse count must include the stranger, badge ${ghBadge} rows ${ghRows}`);
    assert(!strangerAvail.includes("<select"), "Available must carry no HBN select");
    // THE PACKAGE READS IN FOUR LINES (canon 0.30.199): the whole tag, the
    // strain and grams, the HBN, the location.
    const strangerRow = availReleased.body.slice(availReleased.body.indexOf(`data-adopt-tag="${STRANGER}"`));
    const strangerForm = strangerRow.slice(0, strangerRow.indexOf("</li>"));
    assert(
      strangerForm.includes(`<span class="pkg-tag">${STRANGER}</span>`) && /<span class="pkg-strain-grams">[^<]+ - [\d,]+ g<\/span>/.test(strangerForm) &&
        strangerForm.includes(`<span class="pkg-hbn">${pickedHbn}</span>`) && /<span class="pkg-location">Location: [^<]+<\/span>/.test(strangerForm),
      "a stranger row must read the whole tag, the strain and grams, the HBN and the location on their own lines"
    );
    assert(!strangerForm.includes("AU-P-000694") && !strangerForm.includes("AU-G-C-000832"), "the license is no longer on the From METRC row");
    const adoptEsOn = await req("/locale", { method: "POST", body: form({ locale: "es" }) });
    await adoptEsOn.text();
    const adoptEsPage = await text("/production/scheduling/prepack");
    assert(!adoptEsPage.body.includes("Desde METRC") && !adoptEsPage.body.includes("nuevo desde METRC") && adoptEsPage.body.includes("Adoptar y programar") && adoptEsPage.body.includes("Filtrar"), "the adopt control and the filter must speak Spanish, with no From METRC section");
    const adoptEsOff = await req("/locale", { method: "POST", body: form({ locale: "en" }) });
    await adoptEsOff.text();
    const adoptNo = await req("/production/scheduling/prepack/schedule", { method: "POST", body: form({ tag: TAG_HOLD }) });
    assert(adoptNo.status === 400 && (await adoptNo.text()).includes("That package is not waiting to be adopted."), ">> on a tag not on the list must refuse in words");
    // >> ADOPTS AND SCHEDULES (canon 0.30.200): the tag posts to the schedule route and lands in Scheduled.
    const adopted = await req("/production/scheduling/prepack/schedule", { method: "POST", body: form({ tag: STRANGER }) });
    assert(adopted.status === 303 && (adopted.headers.get("location") || "").includes("ok=adopted&n=1"), `>> on the stranger expected adopted and scheduled, got ${adopted.status} ${adopted.headers.get("location")}`);
    const adoptedFlash = await text(adopted.headers.get("location") || "");
    assert(adoptedFlash.body.includes("Adopted and scheduled 1."), "the flash must say the package was adopted and scheduled");
    const workAdopted = await text("/production/scheduling/prepack");
    const adoptedJob = jobIn(workAdopted.body, "000D01");
    assert(adoptedJob && schedPaneOf(workAdopted.body, "working").includes(`data-schedule-tag="${STRANGER}"`) && schedPaneOf(workAdopted.body, "working").includes("&lt;&lt;"), "the adopted package must stand in Scheduled with <<");
    assert(!schedPaneOf(workAdopted.body, "available").includes(`data-schedule-tag="${STRANGER}"`), "an adopted package leaves Available");
    assert(schedPaneOf(workAdopted.body, "available").includes(`data-schedule-tag="${TAG_Q}"`), "the released package of the same HBN must stay Available");
    const adoptedStation = await text(`/station/prepack?pick=${adoptedJob}`);
    assert(adoptedStation.body.includes("000D01") && adoptedStation.body.includes("Finish Pack"), "the station must read the adopted package");
    const backAdopted = await req(`/production/scheduling/prepack/unschedule/${adoptedJob}`, { method: "POST", body: form({}) });
    assert(backAdopted.status === 303, `<< on the adopted package expected 303 got ${backAdopted.status}`);
    const returnedAdopted = await text("/production/scheduling/prepack");
    assert(schedPaneOf(returnedAdopted.body, "available").includes(`data-schedule-tag="${STRANGER}" data-schedule-hbn="${pickedHbn}">`), "<< must return the adopted package to Available still carrying its HBN");

    // A stranger whose harvest the app never minted: the row reads new from
    // METRC, Adopt mints the batch from METRC's name (born from METRC, no lot),
    // the package stands in Available under it, and the harvest figures do not move.
    const NEW_HBN = "46258-PNN-ID-062-0-NA-26007";
    const MB105 = MB("000105");
    const hcFigures = (body) => [...body.matchAll(/data-hc="(remaining_total|harvested|pct|wet_per_plant|dry_per_plant|lots_ready|lots_scheduled|lots_retest)">([^<]*)</g)].map((m) => `${m[1]}=${m[2]}`).join("|");
    const hcBefore = hcFigures((await text("/harvest")).body);
    assert(hcBefore.includes("harvested=") && hcBefore.includes("lots_ready="), `the console must read its harvest figures, got ${hcBefore}`);
    const beforeNew = await text("/production/scheduling/prepack");
    const indoorStart = beforeNew.body.indexOf('data-fold="grow:Indoor"');
    const indoorNext = beforeNew.body.indexOf("<details", indoorStart + 10);
    const indoor = indoorStart < 0 ? "" : beforeNew.body.slice(indoorStart, indoorNext < 0 ? undefined : indoorNext);
    assert(
      indoor.includes(`data-adopt-tag="${MB105}"`) && indoor.includes(`<span class="pkg-hbn">${NEW_HBN}</span>`) && !beforeNew.body.includes("new from METRC"),
      "an unminted ID harvest files under Indoor, and the HBN line is the HBN alone"
    );
    const adoptNew = await req("/production/scheduling/prepack/schedule", { method: "POST", body: form({ tag: MB105 }) });
    assert(adoptNew.status === 303 && (adoptNew.headers.get("location") || "").includes("ok=adopted&n=1"), `>> on the new-from-METRC stranger expected adopted and scheduled, got ${adoptNew.status} ${await adoptNew.text()}`);
    const scheduledNew = await text("/production/scheduling/prepack");
    const newPane = schedPaneOf(scheduledNew.body, "working");
    assert(newPane.includes(`data-schedule-tag="${MB105}" data-schedule-hbn="${NEW_HBN}">`) && newPane.includes("Donny Burger - 751 g") && !newPane.includes("Super Boof -"), "the four lines must read METRC's market name over the real strain");
    assert(!schedPaneOf(scheduledNew.body, "available").includes(`data-adopt-tag="${MB105}"`), "the adopted package leaves the stranger rows");
    const byNewHbn = await text(`/production/scheduling/prepack?q=${encodeURIComponent("46258-pnn")}`);
    assert(
      schedPaneOf(byNewHbn.body, "working").includes(`data-schedule-tag="${MB105}" data-schedule-hbn="${NEW_HBN}">`) && byNewHbn.body.includes(`data-schedule-tag="${TAG_Q}" data-schedule-hbn="${pickedHbn}" hidden>`),
      "?q= by the minted HBN must keep its package and hide the others"
    );
    // born_from is harvest_batches' last column, so each export line ends with it.
    const batchesCsv = (await text("/export/harvest_batches.csv")).body.split(/\r?\n/);
    const newLine = batchesCsv.find((line) => line.includes(NEW_HBN)) || "";
    assert(batchesCsv[0].endsWith(",born_from") && newLine.endsWith(",metrc"), `the minted batch must be born from METRC, got ${newLine}`);
    assert(newLine.includes(",2026,open,") || newLine.includes(",7,2026,"), `the minted batch must carry 2026 serial 7, got ${newLine}`);
    const newBatchId = newLine.split(",")[0];
    const appLines = batchesCsv.filter((line) => line.includes(pickedHbn));
    assert(appLines.length === 1 && appLines[0].endsWith(",app"), "the app's own batch must stay born from the app");
    const queuesNew = await text("/admin/queues");
    assert(!queuesNew.body.includes(NEW_HBN), "the HBN Queue must leave the METRC-born batch out");
    const wetNew = await text("/station/wet_weight");
    assert(newBatchId && !wetNew.body.includes(newBatchId), "the wet weight pick must leave the METRC-born batch out");
    const hcAfter = hcFigures((await text("/harvest")).body);
    assert(hcAfter === hcBefore, `the Harvest Console's figures must not move for a METRC-born batch, before ${hcBefore} after ${hcAfter}`);
    const strainsBefore = await text("/admin/lookups/strains");
    assert(strainsBefore.body.includes("Super Boof") && !strainsBefore.body.includes("Donny Burger") && !strainsBefore.body.includes("Mystery Market"), "METRC's market name must not become a strain");
    const headers = batchesCsv[0].split(",");
    const strainCol = headers.indexOf("strain_id");
    const marketCol = headers.indexOf("market_strain");
    const newCells = newLine.split(",");
    assert(strainCol > 0 && newCells[strainCol] === "c62936c3-8401-4489-911d-316104d11bf5", `the minted batch's strain must be Super Boof, got ${newCells[strainCol]}`);
    assert(marketCol > 0 && newCells[marketCol] === "Donny Burger", `the minted batch's market strain must be METRC's name, got ${newCells[marketCol]}`);
    // A harvest whose fourth segment no strain carries refuses, and nothing is inserted.
    const refused099 = await req("/production/scheduling/prepack/schedule", { method: "POST", body: form({ tag: TAG_099 }) });
    assert(refused099.status === 400 && (await refused099.text()).includes(`${HBN_099} cannot be adopted: no strain carries code 099`), `a code no strain carries must refuse in words, got ${refused099.status}`);
    const export099 = await text("/export/harvest_batches.csv");
    assert(!export099.body.includes(HBN_099), "a refused adoption must leave the harvest out of the export");
    const strainsMid = await text("/admin/lookups/strains");
    assert(!strainsMid.body.includes("Mystery Market") && !strainsMid.body.includes("099"), "a refused adoption must add no strain");
    const add099 = await req("/admin/lookups/strains", { method: "POST", body: form({ action: "add", name: "Code Ninety Nine", abbr: "C99", hbn_code: "099" }) });
    assert(add099.status === 303, `adding the 099 strain expected 303 got ${add099.status} ${await add099.text()}`);
    const adopted099 = await req("/production/scheduling/prepack/schedule", { method: "POST", body: form({ tag: TAG_099 }) });
    assert(adopted099.status === 303 && (adopted099.headers.get("location") || "").includes("ok=adopted&n=1"), `>> after the strain exists expected adopted and scheduled, got ${adopted099.status} ${adopted099.headers.get("location")}`);
    const page099 = await text("/production/scheduling/prepack");
    assert(schedPaneOf(page099.body, "working").includes(`data-schedule-tag="${TAG_099}" data-schedule-hbn="${HBN_099}">`) && schedPaneOf(page099.body, "working").includes("Mystery Market - 12 g"), "the 099 package must land in Scheduled reading its market name");

    // THE TWO BOOKS (canon 0.30.205): the historical lot was minted from the sheet under METRC's text, so >> inherits it and mints nothing.
    const knownBefore = await text("/production/scheduling/prepack");
    assert(
      knownBefore.body.includes(`data-adopt-tag="${HIST}"`) && knownBefore.body.includes(`<span class="pkg-hbn">${aliasMetrc}</span>`) && !knownBefore.body.includes("new from METRC"),
      "the historical package must read METRC's harvest name"
    );
    const batchesBeforeHist = (await text("/export/harvest_batches.csv")).body;
    const adoptHist = await req("/production/scheduling/prepack/schedule", { method: "POST", body: form({ tag: HIST }) });
    assert(adoptHist.status === 303 && (adoptHist.headers.get("location") || "").includes("ok=adopted&n=1"), `>> on the historical lot expected adopted, got ${adoptHist.status} ${adoptHist.headers.get("location")}`);
    const histWork = schedPaneOf((await text("/production/scheduling/prepack")).body, "working");
    assert(histWork.includes(`data-schedule-tag="${HIST}" data-schedule-hbn="${aliasMetrc}">`) && histWork.includes("Sheet Apple - 33 g"), "the adopted package must read the sheet's market strain");
    const batchesAfterHist = (await text("/export/harvest_batches.csv")).body;
    assert(batchesAfterHist.split(aliasMetrc).length === batchesBeforeHist.split(aliasMetrc).length, ">> on a known lot must mint nothing");
    assert((batchesAfterHist.split(/\r?\n/).find((line) => line.includes(aliasMetrc)) || "").endsWith(",sheet"), "the historical lot stays sheet-born");

    const queuesFold = await text("/admin/queues");
    assert(queuesFold.body.includes('data-fold="hbn_queue" open') && queuesFold.body.includes('data-fold="logistics_moves" open'), "Data Queues folds must render open");
    const foldKeys = [...queuesFold.body.matchAll(/data-fold="([^"]+)" open/g)].map((m) => m[1]);
    let voidKey = "";
    let voidIds = [];
    for (const key of foldKeys) {
      if (key === "logistics_moves") continue;
      const at = queuesFold.body.indexOf(`data-fold="${key}"`);
      const next = queuesFold.body.indexOf("data-fold=", at + 12);
      const slice = queuesFold.body.slice(at, next > at ? next : at + 12000);
      const ids = [...new Set([...slice.matchAll(/name="id" value="([^"]+)"/g)].map((m) => m[1]))];
      if (ids.length >= 2) {
        voidKey = key;
        voidIds = ids.slice(0, 2);
        break;
      }
    }
    assert(voidKey && voidIds.length === 2, `a queue must have two rows to void, saw ${foldKeys.join(",")}`);
    const voidChecked = await req(`/admin/queues/${voidKey}/void-checked`, { method: "POST", body: form({ reason: "smoke check-all", id: voidIds }) });
    assert(voidChecked.status === 303 && (voidChecked.headers.get("location") || "").includes("ok=voided&n=2"), `void checked expected voided 2, got ${voidChecked.status} ${voidChecked.headers.get("location")}`);
    const voidedPage = await text(voidChecked.headers.get("location") || "/admin/queues");
    assert(voidedPage.body.includes("Voided 2."), "the flash must say the two rows were voided");
    assert(!voidedPage.body.includes(`value="${voidIds[0]}"`) && !voidedPage.body.includes(`value="${voidIds[1]}"`), "the two voided rows must leave Data Queues");

    // THE UNFINISH (canon 0.30.220): a finished run, one container, and a trim row with an empty run.
    const unfinishBefore = await homeCounts();
    const cryoOpen = await text("/production/scheduling/cryo");
    const availHbn = (schedPaneOf(cryoOpen.body, "available").match(/data-schedule-hbn="([^"]+)"/) || [])[1];
    assert(availHbn, "an HBN must still be available to pasteurize");
    const schedUnfinish = await req("/production/scheduling/cryo/schedule", { method: "POST", body: form({ hbn_id: availHbn }) });
    assert(schedUnfinish.status === 303, `scheduling the unfinish run expected 303 got ${schedUnfinish.status} ${await schedUnfinish.text()}`);
    const cryoWorkPage = await text("/production/scheduling/cryo");
    const unfinishRun = (schedPaneOf(cryoWorkPage.body, "working").match(/action="\/production\/scheduling\/cryo\/complete\/([^"]+)"/) || [])[1];
    assert(unfinishRun, "the new pasteurization run must be working");
    const unfinishTag = "1A4050300000000000000C91";
    const unfinishPlus = await req(`/station/cryo_weight/run/${unfinishRun}/add`, {
      method: "POST",
      body: cryoLine({ package_code: unfinishTag, weight_grams: "10" }),
    });
    assert(unfinishPlus.status === 303, `the unfinish run's line expected 303 got ${unfinishPlus.status} ${await unfinishPlus.text()}`);
    const unfinishFinish = await req(`/station/cryo_weight/run/${unfinishRun}/finish`, { method: "POST", body: form({}) });
    assert(unfinishFinish.status === 303, `finishing the unfinish run expected 303 got ${unfinishFinish.status}`);
    const midCounts = await homeCounts();
    const runBack = await req(`/production/scheduling/cryo/unfinish/${unfinishRun}`, { method: "POST", body: form({ unfinish_pin: ADMIN_PIN }) });
    assert(runBack.status === 303, `unfinish run expected 303 got ${runBack.status} ${await runBack.text()}`);
    const afterRun = await text(runBack.headers.get("location") || "/production/scheduling/cryo");
    assert(afterRun.body.includes("Run unfinished;"), "the run unfinish must flash its line");
    const rose = await homeCounts();
    assert(rose.cryo > midCounts.cryo, `the Cryo Queue must rise after the run unfinish, ${midCounts.cryo} to ${rose.cryo}`);
    assert(rose.testing < midCounts.testing, `the Testing Queue must fall after the run unfinish, ${midCounts.testing} to ${rose.testing}`);
    const freeAgain = await req(`/production/scheduling/cryo/unschedule/${unfinishRun}`, { method: "POST", body: form({}) });
    assert(freeAgain.status === 303, `unscheduling the reopened run expected 303 got ${freeAgain.status} ${await freeAgain.text()}`);

    const unfinishSecond = await req("/production/scheduling/cryo/schedule", { method: "POST", body: form({ hbn_id: availHbn }) });
    assert(unfinishSecond.status === 303, `the second unfinish run expected 303 got ${unfinishSecond.status} ${await unfinishSecond.text()}`);
    const secondPage = await text("/production/scheduling/cryo");
    const secondRun = (schedPaneOf(secondPage.body, "working").match(/action="\/production\/scheduling\/cryo\/complete\/([^"]+)"/) || [])[1];
    assert(secondRun, "the second pasteurization run must be working");
    const secondTag = "1A4050300000000000000C92";
    const secondPlus = await req(`/station/cryo_weight/run/${secondRun}/add`, {
      method: "POST",
      body: cryoLine({ package_code: secondTag, weight_grams: "4" }),
    });
    assert(secondPlus.status === 303, `the second line expected 303 got ${secondPlus.status} ${await secondPlus.text()}`);
    const secondFinish = await req(`/station/cryo_weight/run/${secondRun}/finish`, { method: "POST", body: form({}) });
    assert(secondFinish.status === 303, `finishing the second run expected 303 got ${secondFinish.status}`);
    const finishedPick = await text(`/station/cryo_weight?pick=${secondRun}`);
    const inputId = (finishedPick.body.match(/data-cryo-input="([^"]+)"/) || [])[1];
    assert(inputId, "the finished run must list a consumed container");
    const poolBefore = (finishedPick.body.match(/data-pool-total-in="([^"]+)"/) || [])[1];
    const oneBack = await req(`/station/cryo_weight/run/${secondRun}/unfinish-container/${inputId}`, {
      method: "POST",
      body: form({ unfinish_pin: ADMIN_PIN }),
    });
    assert(oneBack.status === 303, `unfinish one container expected 303 got ${oneBack.status} ${await oneBack.text()}`);
    const poolAfter = await text(oneBack.headers.get("location") || `/station/cryo_weight?pick=${secondRun}`);
    assert(poolAfter.body.includes("Container unfinished;"), "the container unfinish must flash its line");
    const poolNow = (poolAfter.body.match(/data-pool-total-in="([^"]+)"/) || [])[1];
    assert(Number(poolNow) < Number(poolBefore), `the pool in must shrink, ${poolBefore} to ${poolNow}`);

    const trimPage = await text("/production/scheduling/trim");
    const trimDone = (schedPaneOf(trimPage.body, "complete").match(/action="\/production\/scheduling\/trim\/unfinish\/([^"]+)"/) || [])[1];
    assert(trimDone, "a finished trim row must offer Unfinish");
    const emptySched = await req("/production/scheduling/cryo/schedule", { method: "POST", body: form({ hbn_id: availHbn }) });
    assert(emptySched.status === 303, `an empty pasteurization run expected 303 got ${emptySched.status} ${await emptySched.text()}`);
    const beforeTrim = await text("/production/scheduling/cryo");
    const emptyRunId = (schedPaneOf(beforeTrim.body, "working").match(/action="\/production\/scheduling\/cryo\/unschedule\/([^"]+)"/) || [])[1];
    assert(emptyRunId, "the empty run must be working");
    const trimBack = await req(`/production/scheduling/trim/unfinish/${trimDone}`, { method: "POST", body: form({ unfinish_pin: ADMIN_PIN }) });
    const trimBody = trimBack.status === 303 ? (await text(trimBack.headers.get("location") || "/production/scheduling/trim")).body : await trimBack.text();
    if (trimBack.status === 303) {
      assert(trimBody.includes("was unscheduled."), "the trim unfinish must say the pasteurization run was unscheduled");
      const cryoAfterTrim = await text("/production/scheduling/cryo");
      assert(!cryoAfterTrim.body.includes(`/unschedule/${emptyRunId}`), "the empty run must be gone");
    } else {
      assert(trimBack.status === 400 && /is finished|outputs entered/.test(trimBody), `trim unfinish must refuse by name, got ${trimBack.status} ${trimBody.slice(0, 300)}`);
    }
    void unfinishBefore;

    // THE TRUCK RECORD (canon 0.30.226): one truck, two HBNs, Finish lot splits
    // it. Both lots read Truck 1 - <hbn> on Load Silo, both packages sit in the
    // barn, and each loads into a different silo.
    const truckPane = await text("/station/wet_weight");
    const truckPicks = [...truckPane.body.matchAll(/href="\/station\/wet_weight\?pick=([a-f0-9-]{36})"/g)].map((m) => m[1]);
    assert(truckPicks.length >= 2, `the wet pane must still offer two HBNs, saw ${truckPicks.length}`);
    const truckHeaderId = truckPicks[0];
    const truckOtherId = truckPicks[1];
    const headerPick = await text(`/station/wet_weight?pick=${truckHeaderId}`);
    const otherPickPage = await text(`/station/wet_weight?pick=${truckOtherId}`);
    const headerHbn = (headerPick.body.match(/<p class="muted">(2\d{4}-[^<]+)<\/p>/) || [])[1];
    const otherHbnFull = (otherPickPage.body.match(/<p class="muted">(2\d{4}-[^<]+)<\/p>/) || [])[1];
    assert(headerHbn && otherHbnFull && headerHbn !== otherHbnFull, "the truck needs two different HBNs");
    assert(headerPick.body.includes('name="truck_number"'), "the wet header must carry Truck #");
    const spaces = await text("/admin/lookups/dry_spaces");
    const truckSilo = drySpaceIdByName(spaces.body, "Silo 1");
    const startTruck = await req("/station/wet_weight", {
      method: "POST",
      body: form({
        team_lead: "Truck Lead",
        harvest_batch_id: truckHeaderId,
        actual_dryspc: truckSilo,
        truck_number: "1",
        material_form: "bucked",
        notes: "truck record",
      }),
    });
    assert(startTruck.status === 303, `start truck lot expected 303 got ${startTruck.status} ${await startTruck.text()}`);
    const splitLotId = new URL(startTruck.headers.get("location") || "", base).searchParams.get("lot");
    assert(splitLotId, "the truck lot redirect must name the lot");
    const totePage = await text(`/station/wet_weight?lot=${splitLotId}`);
    assert(totePage.body.includes('name="harvest_batch_id"'), "every tote form must carry an HBN select");
    for (const grams of ["400", "100"]) {
      const add = await req(`/station/wet_weight/lot/${splitLotId}/weights`, {
        method: "POST",
        body: form({ weight_grams: grams, harvest_batch_id: truckHeaderId }),
      });
      assert(add.status === 303, `header tote ${grams} expected 303 got ${add.status}`);
    }
    const otherTote = await req(`/station/wet_weight/lot/${splitLotId}/weights`, {
      method: "POST",
      body: form({ weight_grams: "80", harvest_batch_id: truckOtherId }),
    });
    assert(otherTote.status === 303, `the other HBN's tote expected 303 got ${otherTote.status} ${await otherTote.text()}`);
    const mixed = await text(`/station/wet_weight?lot=${splitLotId}`);
    assert(mixed.body.includes("HBNs on this lot"), "the lot panel must name both HBNs");
    assert(mixed.body.includes(otherHbnFull.slice(-5)), "a tote of the other HBN must show its serial");
    const finishTruck = await req(`/station/wet_weight/lot/${splitLotId}/finish`, {
      method: "POST",
      body: form({
        [`plant_count[${truckHeaderId}]`]: "12",
        [`plant_count[${truckOtherId}]`]: "3",
      }),
    });
    assert(finishTruck.status === 303, `finish truck expected 303 got ${finishTruck.status} ${await finishTruck.text()}`);
    const truckFinishLoc = finishTruck.headers.get("location") || "";
    assert(truckFinishLoc.includes("ok=truck_split") && truckFinishLoc.includes("truck=1"), `the flash must name Truck 1, got ${truckFinishLoc}`);
    const dryQueue = await text("/logistics/internal");
    const dryAvail = dryQueue.body.slice(dryQueue.body.indexOf('data-schedule-pane="available"'), dryQueue.body.indexOf('data-schedule-pane="working"'));
    assert(dryAvail.includes(headerHbn) && dryAvail.includes(otherHbnFull), "Finish load puts both lots in the Dry Queue");
    const beforePass = await text("/station/load_silo");
    assert(!beforePass.body.includes(`Truck 1 - ${headerHbn}`), "Finish load must not put a lot on Load Silo");
    for (const hbn of [headerHbn, otherHbnFull]) {
      const row = dryAvail.match(new RegExp(`data-logistics-lot="([^"]+)" data-logistics-parts="[^"]*" data-logistics-hbn="${hbn}"`));
      assert(row, `the Dry Queue must carry ${hbn}`);
      const passed = await req("/logistics/internal/schedule", { method: "POST", body: form({ harvest_batch_id: row[1] }) });
      assert(passed.status === 303, `passing ${hbn} expected 303 got ${passed.status} ${await passed.text()}`);
    }
    const loadPane = await text("/station/load_silo");
    assert(loadPane.body.includes(`Truck 1 - ${headerHbn}`), `Load Silo must label Truck 1 - ${headerHbn}`);
    assert(loadPane.body.includes(`Truck 1 - ${otherHbnFull}`), `Load Silo must label Truck 1 - ${otherHbnFull}`);
    // THE DRYING SCHEDULE (canon 0.30.226): the two split lots load from the
    // Silos surface. Each rides Available under its own HBN with the label
    // Load Silo reads; its >> opens Load Silo's picked form limited to silos
    // (no room, no freezer) carrying the return to the surface; each lands in
    // a different silo and the load returns to the surface.
    const silosForTruck = await text("/production/scheduling/silos");
    assert(silosForTruck.res.status === 200, `GET /production/scheduling/silos expected 200 got ${silosForTruck.res.status}`);
    for (const pane of ["available", "working", "complete"]) {
      assert(silosForTruck.body.includes(`data-schedule-pane="${pane}"`), `the Silos surface must carry the ${pane} pane`);
    }
    const truckAvail = schedPaneOf(silosForTruck.body, "available");
    assert(truckAvail.includes(`Truck 1 - ${headerHbn}`), `the Silos surface's Available must label Truck 1 - ${headerHbn}`);
    assert(truckAvail.includes(`Truck 1 - ${otherHbnFull}`), `the Silos surface's Available must label Truck 1 - ${otherHbnFull}`);
    const truckRows = [...truckAvail.matchAll(/<li class="schedule-item" data-drying-lot="([a-f0-9-]{36})"[^>]*>([\s\S]*?)<\/li>/g)];
    const splitIds = [];
    const splitHrefs = [];
    for (const hbn of [headerHbn, otherHbnFull]) {
      assert(truckAvail.includes(`data-schedule-hbn="${hbn}"`), `the split lot of ${hbn} must ride Available under its own HBN`);
      const row = truckRows.find((m) => m[2].includes(`>Truck 1 - ${hbn}</span>`));
      assert(row, `the Silos surface must list the split lot of ${hbn} as an Available row`);
      const href = (row[2].match(new RegExp(`href="(/station/load_silo\\?pick=${row[1]}&amp;kind=silo[^"]*)"`)) || [])[1];
      assert(href, `the split lot of ${hbn} must carry a >> into Load Silo limited to silos, got\n${row[2].slice(0, 800)}`);
      splitIds.push(row[1]);
      splitHrefs.push(href.replace(/&amp;/g, "&"));
    }
    assert(splitIds.length === 2 && splitIds[0] !== splitIds[1], `both split lots must be loadable from the Silos surface, saw ${splitIds.join(", ")}`);
    const splitSilos = [];
    for (let i = 0; i < 2; i++) {
      const picked = await text(splitHrefs[i]);
      assert(picked.res.status === 200, `the >> of split lot ${i + 1} expected 200 got ${picked.res.status}`);
      assert(picked.body.includes('data-space-kind="silo"'), `the >> of split lot ${i + 1} must limit the select to silos`);
      assert(
        picked.body.includes('<input type="hidden" name="next" value="/production/scheduling/silos">'),
        `the >> of split lot ${i + 1} must carry the return to the Silos surface`
      );
      const select = (picked.body.match(/<select name="dry_space_id" required data-space-kind="silo">([\s\S]*?)<\/select>/) || [])[1];
      assert(select, `the >> of split lot ${i + 1} must render the silo select`);
      assert(!select.includes("Arlington Dry Room"), "a silo-limited select offers no Arlington Dry Room");
      assert(!select.includes("Blast Freezer"), "a silo-limited select offers no Blast Freezer(s)");
      const freeSilos = [...select.matchAll(/<option value="([^"]+)"([^>]*)>([^<]*)<\/option>/g)].filter((m) => !/\bdisabled\b/.test(m[2])).map((m) => m[1]);
      if (i === 0) assert(freeSilos.length >= 2, `two empty silos must be offered, saw ${freeSilos.length}`);
      const siloPick = freeSilos.find((id) => !splitSilos.includes(id));
      assert(siloPick, `split lot ${i + 1} must find a free silo the other split lot does not hold`);
      const loaded = await req("/station/load_silo/load", {
        method: "POST",
        body: form({ lot_id: splitIds[i], dry_space_id: siloPick, start_time: "", loaded_at_iso: "", next: "/production/scheduling/silos" }),
      });
      assert(loaded.status === 303, `loading split lot ${i + 1} expected 303 got ${loaded.status} ${await loaded.text()}`);
      const loadedLoc = loaded.headers.get("location") || "";
      assert(loadedLoc === "/production/scheduling/silos?ok=drying_loaded", `a load from the Silos surface must return there, got ${loadedLoc}`);
      splitSilos.push(siloPick);
      if (i === 0) {
        assert(siloPick === silo2Id, "the first free silo must be Silo 2, the one counting empty since its unload");
        const reloadedStrip = await text("/station/load_silo");
        const reloadedTile = siloTileHtml(reloadedStrip.body, silo2Id);
        assert(reloadedTile.includes('data-silo-state="drying"'), "Silo 2 must read drying once loaded again");
        assert(reloadedTile.includes('data-silo-empty="1" hidden'), "the empty clock must leave the tile once a load begins");
        assert(!reloadedTile.includes('data-silo-empty="1">'), "the empty clock must not stay visible on the loaded tile");
        const liveReloaded = await (await req("/silos/live.json")).json();
        const silo2Reloaded = (liveReloaded.silos || []).find((x) => x.id === silo2Id);
        assert(
          silo2Reloaded && silo2Reloaded.state === "drying" && silo2Reloaded.emptySince == null && silo2Reloaded.wetGrams != null,
          `live.json must clear emptySince once Silo 2 is loaded, got ${JSON.stringify(silo2Reloaded)}`
        );
      }
    }
    assert(splitSilos[0] !== splitSilos[1], "the two split lots must land in two different silos");
    const finishedLots = await text("/logistics/internal");
    const finishedPane = finishedLots.body.slice(finishedLots.body.indexOf('data-schedule-pane="complete"'));
    assert(finishedPane.includes(headerHbn) && finishedPane.includes(otherHbnFull), "both loaded lots must read Finished");

    // A lot of two parts: the Scheduled > opens Load Silo on the harvest batch,
    // and each typed plant count lands on its part.
    const twoAcquire = await text("/station/acquire_hbn");
    const twoMint = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({ entry_date: "2026-09-26", farm_code: "PNN", grow_method_code: "GH", strain_id: optionValue(twoAcquire.body, "Fruity Pebbles") }),
    });
    assert(twoMint.status === 303, `two-part HBN expected 303 got ${twoMint.status} ${await twoMint.text()}`);
    const twoHbn = new URL(twoMint.headers.get("location") || "", base).searchParams.get("minted");
    const twoWet = await text("/station/wet_weight");
    let twoBatch = null;
    for (const hit of twoWet.body.matchAll(/\?pick=([a-f0-9-]{36})">\d+\. PNN \//g)) {
      const page = await text(`/station/wet_weight?pick=${hit[1]}`);
      if (page.body.includes(`<p class="muted">${twoHbn}</p>`)) {
        twoBatch = hit[1];
        break;
      }
    }
    assert(twoBatch, "the two-part HBN must be on the wet pane");
    const twoParts = [];
    for (const grams of ["300", "120"]) {
      const start = await req("/station/wet_weight", {
        method: "POST",
        body: form({ team_lead: "Smoke Lead", harvest_batch_id: twoBatch, actual_dryspc: silo1Id, notes: "two-part load" }),
      });
      assert(start.status === 303, `two-part start expected 303 got ${start.status} ${await start.text()}`);
      const lot = new URL(start.headers.get("location") || "", base).searchParams.get("lot");
      assert(lot, "two-part start must name the lot");
      const weigh = await req(`/station/wet_weight/lot/${lot}/weights`, { method: "POST", body: form({ weight_grams: grams }) });
      assert(weigh.status === 303, `two-part weight expected 303 got ${weigh.status}`);
      await weigh.text();
      const fin = await req(`/station/wet_weight/lot/${lot}/finish`, { method: "POST", body: form({ plant_prompt: "skip" }) });
      assert(fin.status === 303, `two-part finish expected 303 got ${fin.status} ${await fin.text()}`);
      twoParts.push(lot);
    }
    const roadStart = await req("/station/wet_weight", {
      method: "POST",
      body: form({ team_lead: "Smoke Lead", harvest_batch_id: twoBatch, actual_dryspc: silo1Id, truck_number: "9", notes: "on the road" }),
    });
    assert(roadStart.status === 303, `road lot start expected 303 got ${roadStart.status} ${await roadStart.text()}`);
    const roadLot = new URL(roadStart.headers.get("location") || "", base).searchParams.get("lot");
    assert(roadLot, "the road lot redirect must name the lot");
    const roadWeigh = await req(`/station/wet_weight/lot/${roadLot}/weights`, { method: "POST", body: form({ weight_grams: "40" }) });
    assert(roadWeigh.status === 303, `road lot weight expected 303 got ${roadWeigh.status}`);
    await roadWeigh.text();
    const truckSpace = drySpaceIdByName((await text("/admin/lookups/dry_spaces")).body, "Truck");
    const roadMove = await req(`/record/wet_weight_entries/${roadLot}/edit`, {
      method: "POST",
      body: form({ actual_dryspc: truckSpace, reason: "smoke: this load rides the truck" }),
    });
    assert(roadMove.status === 303, `pointing the lot at the truck expected 303 got ${roadMove.status} ${await roadMove.text()}`);
    const roadFinish = await req(`/station/wet_weight/lot/${roadLot}/finish`, { method: "POST", body: form({ plant_prompt: "skip" }) });
    assert(roadFinish.status === 303, `road lot finish expected 303 got ${roadFinish.status} ${await roadFinish.text()}`);
    const mapBefore = await text("/");
    const harvestNode = mapBefore.body.slice(mapBefore.body.indexOf('data-ops-key="harvest_ops"'), mapBefore.body.indexOf('data-ops-key="harvest_ops"') + 2500);
    const logisticsNode = mapBefore.body.slice(mapBefore.body.indexOf('data-ops-key="interco_logistics"'), mapBefore.body.indexOf('data-ops-key="interco_logistics"') + 2500);
    assert(harvestNode.includes('class="ops-menu-line"') && harvestNode.includes("Lot ") && harvestNode.includes("in progress"), "Harvest must line today's lot as in progress");
    assert(logisticsNode.includes(">Truck 9<") && logisticsNode.includes("in-transit") && logisticsNode.includes("data-clock"), "Logistics must line Truck 9 while it is on the road");
    assert(!logisticsNode.includes(">Truck</span>"), "the on-site two-part lot is off the Logistics line");
    assert(!mapBefore.body.slice(mapBefore.body.indexOf('data-ops-key="marketplace"'), mapBefore.body.indexOf('data-ops-key="marketplace"') + 800).includes("ops-menu-line"), "Marketplace carries no menu line");
    const twoQueue = await text("/logistics/internal");
    const twoAvail = twoQueue.body.slice(twoQueue.body.indexOf('data-schedule-pane="available"'), twoQueue.body.indexOf('data-schedule-pane="working"'));
    const twoRow = twoAvail.match(new RegExp(`data-logistics-lot="${twoBatch}" data-logistics-parts="([^"]*)"`));
    assert(twoRow && twoParts.every((id) => twoRow[1].split(/\s+/).includes(id)), "both parts must sit on one Dry Queue lot");
    const twoPass = await req("/logistics/internal/schedule", { method: "POST", body: form({ harvest_batch_id: twoBatch }) });
    assert(twoPass.status === 303, `passing the two-part lot expected 303 got ${twoPass.status} ${await twoPass.text()}`);
    const twoDesk = await text("/logistics/internal");
    const twoSched = twoDesk.body.slice(twoDesk.body.indexOf('data-schedule-pane="working"'), twoDesk.body.indexOf('data-schedule-pane="complete"'));
    const twoHref = (twoSched.match(new RegExp(`href="(/station/load_silo\\?pick=${twoBatch})"`)) || [])[1];
    assert(twoHref, "the Scheduled > must open Load Silo on the harvest batch");
    const twoPick = await text(twoHref);
    assert(twoPick.body.includes(`name="lot_id" value="${twoBatch}"`), "the picked form must post the harvest batch");
    for (const id of twoParts) assert(twoPick.body.includes(`name="plant_count[${id}]"`), `the form must ask the plant count for ${id}`);
    const twoSelect = (twoPick.body.match(/<select name="dry_space_id" required>([\s\S]*?)<\/select>/) || [])[1] || "";
    const twoSpace = ([...twoSelect.matchAll(/<option value="([^"]+)"(?![^>]*\bdisabled\b)/g)][0] || [])[1];
    assert(twoSpace, "a free space must be offered for the two-part lot");
    const twoFields = { lot_id: twoBatch, dry_space_id: twoSpace, start_time: "", loaded_at_iso: "" };
    twoFields[`plant_count[${twoParts[0]}]`] = "11";
    twoFields[`plant_count[${twoParts[1]}]`] = "7";
    const twoLoad = await req("/station/load_silo/load", { method: "POST", body: form(twoFields) });
    assert(twoLoad.status === 303, `the two-part load expected 303 got ${twoLoad.status} ${await twoLoad.text()}`);
    const mapDry = await text("/");
    const dryingNode = mapDry.body.slice(mapDry.body.indexOf('data-ops-key="drying_ops"'), mapDry.body.indexOf('data-ops-key="drying_ops"') + 4000);
    assert(dryingNode.includes('class="ops-menu-line"') && dryingNode.includes("drying") && dryingNode.includes("data-clock"), "Drying must line a space that holds a load");
    assert(!dryingNode.includes("Blast Freezer"), "a freezer is off the Drying line");
    const twoCounts = ["11", "7"];
    for (let i = 0; i < twoParts.length; i++) {
      const edit = await text(`/record/wet_weight_entries/${twoParts[i]}/edit`);
      assert(edit.body.includes(`name="plant_count" value="${twoCounts[i]}"`), `part ${twoParts[i]} must keep plant count ${twoCounts[i]}`);
    }

    // THE DRYING SCHEDULE (canon 0.30.226; Patrick's "scheduling the silos and
    // dry spaces the way we do the lines", his pick "Three surfaces by space
    // kind"): Silos, Dry Rooms and Freezers, each the station-triple under the
    // silo strip. The Silos Working pane holds the two split loads, each under
    // its own silo with its clock and Start and Pause returning to the surface;
    // a one-load silo offers no Unload together. Drying Operations links the
    // three; a drying surface is a view, never a line. THE JOINT UNLOAD, DRY PRO
    // RATA: two lots load into the Arlington Dry Room from the Dry Rooms
    // surface, the room offers Unload together, one total dry is shared by wet
    // grams in whole grams, both lots land on Complete, and the log names it.
    {
      const surfacePath = (stage) => `/production/scheduling/${stage}`;
      const sectionOf = (pane, attr, id) => {
        const at = pane.indexOf(`${attr}="${id}"`);
        if (at === -1) return "";
        const end = pane.indexOf("</section>", at);
        return pane.slice(at, end === -1 ? pane.length : end);
      };
      const rowOf = (pane, lotId) => {
        const at = pane.indexOf(`data-drying-lot="${lotId}"`);
        if (at === -1) return "";
        const end = pane.indexOf("</li>", at);
        return pane.slice(at, end === -1 ? pane.length : end);
      };
      const surfaces = {};
      for (const [stage, title] of [
        ["silos", "Silos"],
        ["dry_rooms", "Dry Rooms"],
        ["freezers", "Freezers"],
      ]) {
        const page = await text(surfacePath(stage));
        assert(page.res.status === 200, `GET ${surfacePath(stage)} expected 200 got ${page.res.status}`);
        assert(page.body.includes(`<h1>${title}</h1>`), `the ${title} surface must carry its heading`);
        assert(page.body.includes(`data-drying-surface="${stage}"`), `the ${title} surface must name itself on the station-triple`);
        for (const pane of ["available", "working", "complete"]) {
          assert(page.body.includes(`data-schedule-pane="${pane}"`), `the ${title} surface must carry the ${pane} pane`);
        }
        assert(page.body.includes("data-silo-strip"), `the silo strip must ride above the ${title} surface`);
        assert(page.body.indexOf("data-silo-strip") < page.body.indexOf(`data-drying-surface="${stage}"`), `the strip rides above the ${title} panes`);
        surfaces[stage] = page;
      }

      // The Silos Working pane: each split load under its own silo.
      const silosWorking = schedPaneOf(surfaces.silos.body, "working");
      const splitLoads = [];
      const splitEntries = [];
      for (let i = 0; i < 2; i++) {
        const section = sectionOf(silosWorking, "data-drying-space", splitSilos[i]);
        assert(section, `the Silos Working pane must carry split lot ${i + 1}'s silo as a section`);
        const entryIds = [...section.matchAll(/data-drying-lot="([a-f0-9-]{36})"/g)].map((m) => m[1]);
        assert(entryIds.length === 1, `split lot ${i + 1} must ride under the silo it loaded into, alone`);
        const entryId = entryIds[0];
        splitEntries.push(entryId);
        const loadId = (section.match(/data-drying-load="([a-f0-9-]{36})"/) || [])[1];
        assert(loadId, `split lot ${i + 1}'s Working row must name its load`);
        assert(section.includes("data-clock"), `split lot ${i + 1}'s Working row must carry the clock`);
        assert(section.includes(`action="/station/load_silo/${loadId}/start"`), `split lot ${i + 1}'s Working row must carry Start`);
        assert(section.includes(`action="/station/load_silo/${loadId}/pause"`), `split lot ${i + 1}'s Working row must carry Pause`);
        assert(
          (section.match(/<input type="hidden" name="next" value="\/production\/scheduling\/silos">/g) || []).length >= 2,
          `Start and Pause on split lot ${i + 1}'s row must each return to the Silos surface`
        );
        assert(section.includes(`href="/station/unload_dry_space?pick=${entryId}"`), `split lot ${i + 1}'s > must open Unload Dry Space on the lot`);
        assert(!section.includes("data-unload-together-link"), `a one-load silo offers no Unload together (split lot ${i + 1})`);
        splitLoads.push(loadId);
      }
      assert(Number((surfaces.silos.body.match(/data-schedule-count="working">(\d+)</) || [])[1]) >= 2, "the Silos Working count must hold both split loads");
      // Pause and Resume from the surface return to it.
      const clockStateOf = (body, loadId) => {
        const row = rowOf(schedPaneOf(body, "working"), splitEntries[splitLoads.indexOf(loadId)]);
        return (row.match(/data-clock data-state="([a-z_]+)"/) || [])[1];
      };
      assert(clockStateOf(surfaces.silos.body, splitLoads[0]) === "running", `a load from the surface starts running, got ${clockStateOf(surfaces.silos.body, splitLoads[0])}`);
      const pauseSplit = await req(`/station/load_silo/${splitLoads[0]}/pause`, { method: "POST", body: form({ next: surfacePath("silos") }) });
      assert(pauseSplit.status === 303, `Pause from the Silos surface expected 303 got ${pauseSplit.status} ${await pauseSplit.text()}`);
      assert((pauseSplit.headers.get("location") || "") === surfacePath("silos"), `Pause must return to the Silos surface, got ${pauseSplit.headers.get("location")}`);
      const pausedPage = await text(surfacePath("silos"));
      assert(clockStateOf(pausedPage.body, splitLoads[0]) === "paused", `the paused load must read paused on the surface, got ${clockStateOf(pausedPage.body, splitLoads[0])}`);
      assert(rowOf(schedPaneOf(pausedPage.body, "working"), splitEntries[0]).includes(">Resume</button>"), "a paused load's Pause reads Resume");
      const resumeSplit = await req(`/station/load_silo/${splitLoads[0]}/pause`, { method: "POST", body: form({ next: surfacePath("silos") }) });
      assert(resumeSplit.status === 303, `Resume from the Silos surface expected 303 got ${resumeSplit.status} ${await resumeSplit.text()}`);
      assert((resumeSplit.headers.get("location") || "") === surfacePath("silos"), `Resume must return to the Silos surface, got ${resumeSplit.headers.get("location")}`);
      const resumedPage = await text(surfacePath("silos"));
      assert(clockStateOf(resumedPage.body, splitLoads[0]) === "running", `the resumed load must read running again, got ${clockStateOf(resumedPage.body, splitLoads[0])}`);

      // Drying Operations links the three surfaces; a drying surface is no line.
      const opsDrying = await text("/ops/drying_ops");
      assert(opsDrying.res.status === 200, `GET /ops/drying_ops expected 200 got ${opsDrying.res.status}`);
      for (const [key, stage] of [
        ["schedule_silos", "silos"],
        ["schedule_dry_rooms", "dry_rooms"],
        ["schedule_freezers", "freezers"],
      ]) {
        assert(
          opsDrying.body.includes(`href="${surfacePath(stage)}" data-pipeline-key="${key}"`),
          `Drying Operations must carry the ${key} tile linking ${surfacePath(stage)}`
        );
      }
      const nope = await req("/production/scheduling/nope");
      assert(nope.status === 404, `an unknown scheduling stage expected 404 got ${nope.status}`);
      const siloSchedule = await req("/production/scheduling/silos/schedule", { method: "POST", body: form({ hbn_id: splitIds[0] }) });
      assert(siloSchedule.status === 404, `a drying surface is not a line: POST schedule expected 404 got ${siloSchedule.status}`);

      // THE JOINT UNLOAD: two lots into the Arlington Dry Room from the Dry Rooms surface.
      const roomId = arlRoomId;
      const roomsBefore = await text(surfacePath("dry_rooms"));
      assert(!sectionOf(schedPaneOf(roomsBefore.body, "working"), "data-drying-space", roomId), "the Arlington Dry Room holds no open load before the joint walk");
      const mintRoomLot = async (grams, note) => {
        const acquire = await text("/station/acquire_hbn");
        const mk = await req("/station/acquire_hbn", {
          method: "POST",
          body: form({ entry_date: "2026-09-18", farm_code: "PNN", grow_method_code: "GH", strain_id: optionValue(acquire.body, "Fruity Pebbles") }),
        });
        assert(mk.status === 303, `joint walk HBN acquire expected 303 got ${mk.status} ${await mk.text()}`);
        const hbn = new URL(mk.headers.get("location") || "", base).searchParams.get("minted");
        assert(hbn && hbn.includes("-PNN-"), `the joint walk HBN must be minted at PNN, got ${hbn}`);
        const wetPane = await text("/station/wet_weight");
        let batchId = null;
        for (const m of wetPane.body.matchAll(/\?pick=([a-f0-9-]{36})">\d+\. PNN \//g)) {
          const page = await text(`/station/wet_weight?pick=${m[1]}`);
          if (page.body.includes(`<p class="muted">${hbn}</p>`)) {
            batchId = m[1];
            break;
          }
        }
        assert(batchId, `the wet pane must list the joint walk HBN ${hbn} among the PNN rows`);
        const start = await req("/station/wet_weight", {
          method: "POST",
          body: form({ team_lead: "Smoke Lead", harvest_batch_id: batchId, actual_dryspc: roomId, notes: note }),
        });
        assert(start.status === 303, `joint walk lot start expected 303 got ${start.status} ${await start.text()}`);
        const lot = new URL(start.headers.get("location") || "", base).searchParams.get("lot");
        assert(lot, "no lot id for the joint walk lot");
        const weigh = await req(`/station/wet_weight/lot/${lot}/weights`, { method: "POST", body: form({ weight_grams: grams }) });
        assert(weigh.status === 303, `joint walk lot weight expected 303 got ${weigh.status}`);
        const fin = await req(`/station/wet_weight/lot/${lot}/finish`, { method: "POST", body: form({ plant_count: "7" }) });
        assert(fin.status === 303, `joint walk lot finish expected 303 got ${fin.status} ${await fin.text()}`);
        const batch = await passEntry(lot);
        return { entry: lot, batch };
      };
      // The 0.22.0 ARL lot (1,500 g, live package) still waits; else a lot is minted in its place.
      // Available rows are the harvest batch. The waiting entry's batch is learned when it is passed.
      const firstRoomLot = await mintRoomLot("1500", "0.30.226 joint unload first lot");
      const secondRoomLot = await mintRoomLot("900", "0.30.226 joint unload second lot");
      const roomLots = [firstRoomLot, secondRoomLot];
      const roomsAvail = await text(surfacePath("dry_rooms"));
      const roomsAvailPane = schedPaneOf(roomsAvail.body, "available");
      const secondRow = rowOf(roomsAvailPane, secondRoomLot.batch);
      assert(secondRow, "the minted lot must wait on the Dry Rooms surface's Available");
      assert(secondRow.includes("data-planned-here"), "a lot weighed into the room reads planned here on the Dry Rooms surface");
      assert(secondRow.includes(`data-planned-space="${roomId}"`), "the minted lot's planned space must be the room");
      for (let i = 0; i < roomLots.length; i++) {
        const lot = roomLots[i];
        const pane = schedPaneOf((await text(surfacePath("dry_rooms"))).body, "available");
        const row = rowOf(pane, lot.batch);
        assert(row, `room lot ${i + 1} must wait on the Dry Rooms surface's Available`);
        const href = (row.match(new RegExp(`href="(/station/load_silo\\?pick=${lot.batch}&amp;kind=dry_room[^"]*)"`)) || [])[1];
        assert(href, `room lot ${i + 1} must carry a >> into Load Silo limited to dry rooms, got\n${row.slice(0, 800)}`);
        if (lot.entry === secondRoomLot.entry) assert(href.includes(`&amp;space=${roomId}`), "the >> of a lot planned for the room must carry the room");
        const picked = await text(href.replace(/&amp;/g, "&"));
        assert(picked.res.status === 200, `the >> of room lot ${i + 1} expected 200 got ${picked.res.status}`);
        assert(
          picked.body.includes('<input type="hidden" name="next" value="/production/scheduling/dry_rooms">'),
          `the >> of room lot ${i + 1} must carry the return to the Dry Rooms surface`
        );
        const select = (picked.body.match(/<select name="dry_space_id" required data-space-kind="dry_room">([\s\S]*?)<\/select>/) || [])[1];
        assert(select, `the >> of room lot ${i + 1} must render the select limited to dry rooms`);
        assert(select.includes(`<option value="${roomId}"`), `the dry room select must offer the Arlington Dry Room (room lot ${i + 1})`);
        assert(!/>Silo \d/.test(select) && !select.includes("Blast Freezer"), `the dry room select offers no silo and no freezer (room lot ${i + 1})`);
        if (lot.entry === secondRoomLot.entry) assert(new RegExp(`<option value="${roomId}" selected`).test(select), "the room preselects for the lot planned there");
        const loaded = await req("/station/load_silo/load", {
          method: "POST",
          body: form({ lot_id: lot.batch, dry_space_id: roomId, start_time: "", loaded_at_iso: "", next: surfacePath("dry_rooms") }),
        });
        assert(loaded.status === 303, `loading room lot ${i + 1} expected 303 got ${loaded.status} ${await loaded.text()}`);
        const loadedLoc = loaded.headers.get("location") || "";
        assert(loadedLoc === "/production/scheduling/dry_rooms?ok=drying_loaded", `a load from the Dry Rooms surface must return there, got ${loadedLoc}`);
      }
      const roomsLoaded = await text("/production/scheduling/dry_rooms?ok=drying_loaded");
      assert(roomsLoaded.body.includes("Loaded. The location change pends at the export home."), "the Dry Rooms surface must flash the load");
      const roomSection = sectionOf(schedPaneOf(roomsLoaded.body, "working"), "data-drying-space", roomId);
      assert(roomSection, "the Arlington Dry Room must ride the Dry Rooms Working pane");
      const roomLoadIds = [...roomSection.matchAll(/data-drying-load="([a-f0-9-]{36})"/g)].map((m) => m[1]);
      assert(roomLoadIds.length === 2, `the room must hold two open loads, saw ${roomLoadIds.length}`);
      for (const lot of roomLots) assert(roomSection.includes(`data-drying-lot="${lot.entry}"`), `the room's Working section must carry lot ${lot.entry}`);
      assert(roomSection.includes(`data-unload-together-link="${roomId}"`), "a room holding two loads must offer Unload together");
      assert(roomSection.includes(`href="/production/scheduling/dry_rooms?together=${roomId}"`), "Unload together must open the joint form on the surface");
      // A silo holds one lot by law: a joint unload on a one-load silo refuses.
      const oneSilo = await req(`/production/scheduling/silos/unload_together/${splitSilos[0]}`, {
        method: "POST",
        body: form({ load_ids: splitLoads[0], total_dry_grams: "100", operator_name: "Smoke Operator", gate_choice: "nothing" }),
      });
      assert(oneSilo.status === 400, `a joint unload on a one-load silo expected 400 got ${oneSilo.status} ${await oneSilo.text()}`);
      // The joint form.
      const togetherPage = await text(`/production/scheduling/dry_rooms?together=${roomId}`);
      assert(togetherPage.res.status === 200, `the joint form expected 200 got ${togetherPage.res.status}`);
      const jointForm = (togetherPage.body.match(new RegExp(`<form [^>]*data-unload-together="${roomId}"[^>]*>([\\s\\S]*?)</form>`)) || [])[0];
      assert(jointForm, "the joint form must render on the room's Working section");
      assert(/^<form [^>]*data-lock-on-submit/.test(jointForm), "the joint form must lock on the first tap (THE FOUR START TAPS)");
      assert(jointForm.includes(`action="/production/scheduling/dry_rooms/unload_together/${roomId}"`), "the joint form must post to the room's joint unload");
      assert(jointForm.includes('name="total_dry_grams"') && jointForm.includes('name="gate_choice"') && jointForm.includes('name="operator_name"'), "the joint form asks the total dry, the operator and the gate's choice once");
      const loadIds = (jointForm.match(/<input type="hidden" name="load_ids" value="([^"]+)">/) || [])[1];
      assert(loadIds, "the joint form must carry the load ids");
      assert([...loadIds.split(",")].sort().join(",") === [...roomLoadIds].sort().join(","), `the joint form's load ids must be the room's open loads, got ${loadIds}`);
      const wetOf = {};
      for (const m of jointForm.matchAll(/data-share-lot="([a-f0-9-]{36})" data-wet="([0-9.]+)"/g)) wetOf[m[1]] = Number(m[2]);
      assert(roomLots.every((lot) => wetOf[lot.entry] > 0), `the joint form must list each lot's wet grams, got ${JSON.stringify(wetOf)}`);
      const groupWet = roomLots.reduce((sum, lot) => sum + wetOf[lot.entry], 0);
      const totalDry = 602;
      assert(totalDry < groupWet, `the typed total must fall well below the combined wet grams ${groupWet}`);
      const joint = await req(`/production/scheduling/dry_rooms/unload_together/${roomId}`, {
        method: "POST",
        body: form({ load_ids: loadIds, total_dry_grams: String(totalDry), operator_name: "Smoke Operator", gate_choice: "nothing" }),
      });
      assert(joint.status === 303, `the joint unload expected 303 got ${joint.status} ${await joint.text()}`);
      const jointLoc = joint.headers.get("location") || "";
      assert(jointLoc === "/production/scheduling/dry_rooms?ok=unloaded_together&n=2", `the joint unload must return to the Dry Rooms surface, got ${jointLoc}`);
      const roomsAfter = await text(jointLoc);
      assert(roomsAfter.res.status === 200, `the Dry Rooms surface after the joint unload expected 200 got ${roomsAfter.res.status}`);
      assert(roomsAfter.body.includes("Unloaded together: 2 lots."), "the Dry Rooms surface must flash the joint unload");
      const roomsComplete = schedPaneOf(roomsAfter.body, "complete");
      let drySum = 0;
      for (const lot of roomLots) {
        const row = rowOf(roomsComplete, lot.entry);
        assert(row, `lot ${lot.entry} must land on the Dry Rooms Complete pane`);
        const dry = Number((row.match(/data-dry-grams="([0-9.]+)"/) || [])[1]);
        assert(dry > 0, `lot ${lot.entry}'s Complete row must carry its dry grams, got\n${row.slice(0, 600)}`);
        const exact = (totalDry * wetOf[lot.entry]) / groupWet;
        assert(Math.abs(dry - exact) <= 1, `lot ${lot}'s dry share ${dry} must sit within 1 g of its pro rata ${exact.toFixed(2)}`);
        assert(Number.isInteger(dry), `lot ${lot}'s dry share must be whole grams, got ${dry}`);
        assert(row.includes("data-unload-day="), `lot ${lot}'s Complete row must carry the unload's day`);
        // THE RUN (canon 0.30.248): the row reads how long its load ran.
        assert(/data-run-seconds="\d+"/.test(row) && row.includes(">Ran "), `lot ${lot.entry}'s Complete row must read its run, got\n${row.slice(0, 600)}`);
        drySum += dry;
      }
      assert(drySum === totalDry, `the dry shares must sum to the typed total ${totalDry}, got ${drySum}`);
      const roomDone = sectionOf(roomsComplete, "data-drying-space", roomId);
      assert(roomDone && /data-run-average="\d+"/.test(roomDone) && roomDone.includes("average "), "the room's Complete heading must read its average run");
      const roomsWorkingAfter = schedPaneOf(roomsAfter.body, "working");
      assert(!sectionOf(roomsWorkingAfter, "data-drying-space", roomId), "the emptied room leaves the Dry Rooms Working pane");
      for (const id of roomLoadIds) assert(!roomsWorkingAfter.includes(`data-drying-load="${id}"`), `the ended load ${id} leaves Working`);
      for (const lot of roomLots) {
        const gone = await req(`/station/unload_dry_space?pick=${lot.entry}`);
        assert(gone.status === 302, `a lot unloaded together no longer dries: its unload pick expected 302 got ${gone.status}`);
      }
      const jointLog = await text("/log");
      assert(jointLog.body.includes("joint unload: Arlington Dry Room"), "the change log must carry the joint unload's reason naming the room");
      const jointAgain = await req(`/production/scheduling/dry_rooms/unload_together/${roomId}`, {
        method: "POST",
        body: form({ load_ids: loadIds, total_dry_grams: String(totalDry), operator_name: "Smoke Operator", gate_choice: "nothing" }),
      });
      const againBody = await jointAgain.text();
      assert(jointAgain.status === 409, `the same joint unload again expected 409 got ${jointAgain.status} ${againBody}`);
      assert(
        againBody.includes("Arlington Dry Room was already unloaded together; nothing was unloaded twice."),
        "a repeated joint unload must say the room was already unloaded together"
      );
    }

    // ONE HARVEST FILE PER LOAD: two truck loads of one HBN, each file its own
    // rows and tags. Mark (1), edit its grams, acknowledge the change, then
    // see the two loads' location-change and unload files named apart.
    const pairAcquire = await text("/station/acquire_hbn");
    const pairStrain = optionValue(pairAcquire.body, "Fruity Pebbles");
    const pairMint = await req("/station/acquire_hbn", {
      method: "POST",
      body: form({ entry_date: "2026-09-01", farm_code: "ARL", grow_method_code: "GH", strain_id: pairStrain }),
    });
    assert(pairMint.status === 303, `pair mint expected 303 got ${pairMint.status} ${await pairMint.text()}`);
    const pairHbn = new URL(pairMint.headers.get("location") || "", base).searchParams.get("minted");
    assert(pairHbn, "the pair mint must name the HBN");
    const pairWet = await text("/station/wet_weight");
    const pairPicks = [...pairWet.body.matchAll(/href="\/station\/wet_weight\?pick=([^"]+)"/g)].map((m) => m[1]);
    let pairBatch = "";
    for (const id of pairPicks) {
      const page = await text(`/station/wet_weight?pick=${id}`);
      if (page.body.includes(pairHbn)) {
        pairBatch = id;
        break;
      }
    }
    assert(pairBatch, "the minted HBN must be on the wet pane");
    const pairSpace = drySpaceId;
    const pairTruck = drySpaceIdByName((await text("/admin/lookups/dry_spaces")).body, "Truck");
    const pairLots = [];
    for (const spec of [
      { truck: "11", grams: "100", tag: "1A4PAIRLOAD0001" },
      { truck: "12", grams: "50", tag: "1A4PAIRLOAD0002" },
    ]) {
      const start = await req("/station/wet_weight", {
        method: "POST",
        body: form({ team_lead: "Smoke Lead", harvest_batch_id: pairBatch, actual_dryspc: pairSpace, truck_number: spec.truck, notes: `pair ${spec.truck}` }),
      });
      assert(start.status === 303, `pair load ${spec.truck} start expected 303 got ${start.status} ${await start.text()}`);
      const lotId = new URL(start.headers.get("location") || "", base).searchParams.get("lot");
      assert(lotId, "pair load redirect must name the lot");
      const weigh = await req(`/station/wet_weight/lot/${lotId}/weights`, { method: "POST", body: form({ weight_grams: spec.grams }) });
      assert(weigh.status === 303, `pair load ${spec.truck} weight expected 303 got ${weigh.status}`);
      await weigh.text();
      const point = await req(`/record/wet_weight_entries/${lotId}/edit`, {
        method: "POST",
        body: form({ actual_dryspc: pairTruck, reason: "smoke: this load rides its truck" }),
      });
      assert(point.status === 303, `pair load ${spec.truck} truck point expected 303 got ${point.status} ${await point.text()}`);
      const fin = await req(`/station/wet_weight/lot/${lotId}/finish`, { method: "POST", body: form({ plant_prompt: "count", plant_count: "1" }) });
      assert(fin.status === 303, `pair load ${spec.truck} finish expected 303 got ${fin.status} ${await fin.text()}`);
      pairLots.push({ id: lotId, tag: spec.tag, grams: spec.grams });
    }
    const pairPage = await text("/admin/uploads");
    assert(pairPage.body.includes(`${pairHbn}(1).csv`) && pairPage.body.includes(`${pairHbn}(2).csv`), "both load files must pend");
    for (let i = 0; i < pairLots.length; i += 1) {
      const saved = await req(`/admin/uploads/wet_weights/${pairLots[i].id}/tags`, {
        method: "POST",
        body: form({ plant_tags: pairLots[i].tag }),
      });
      assert(saved.status === 303, `pair tags ${i + 1} expected 303 got ${saved.status} ${await saved.text()}`);
    }
    const file1 = await text(`/admin/uploads/wet_weights/${pairLots[0].id}.csv`);
    const file2 = await text(`/admin/uploads/wet_weights/${pairLots[1].id}.csv`);
    assert((file1.res.headers.get("content-disposition") || "").includes(`${pairHbn}(1).csv`), "load 1 attaches as (1)");
    assert((file2.res.headers.get("content-disposition") || "").includes(`${pairHbn}(2).csv`), "load 2 attaches as (2)");
    assert(file1.body.includes(pairLots[0].tag) && !file1.body.includes(pairLots[1].tag), "load 1's file carries only its tag");
    assert(file2.body.includes(pairLots[1].tag) && !file2.body.includes(pairLots[0].tag), "load 2's file carries only its tag");
    assert(file1.body.includes(",100.00,") && !file1.body.includes(",50.00,"), "load 1's file carries only its rows");
    assert(file2.body.includes(",50.00,") && !file2.body.includes(",100.00,"), "load 2's file carries only its rows");
    const mark1 = await req(`/admin/uploads/wet_weights/${pairLots[0].id}/uploaded`, { method: "POST", body: form({}) });
    assert(mark1.status === 303, `mark (1) expected 303 got ${mark1.status}`);
    await mark1.text();
    const edit1 = await req(`/record/wet_weight_entries/${pairLots[0].id}/edit`, {
      method: "POST",
      body: form({ weight_grams: "120", reason: "smoke: grams changed after the file" }),
    });
    assert(edit1.status === 303, `edit (1) grams expected 303 got ${edit1.status} ${await edit1.text()}`);
    const changed = await text("/admin/uploads");
    assert(changed.body.includes("Changed after upload") && changed.body.includes(`${pairHbn}(1).csv`), "(1) must show under Changed after upload");
    assert(!changed.body.includes(`href="/admin/uploads/wet_weights/${pairLots[0].id}.csv"`), "(1) must not re-pend");
    const ackPair = await req(`/admin/uploads/wet_weights/${pairLots[0].id}/acknowledge`, {
      method: "POST",
      body: form({ reason: "smoke: acknowledged the pair" }),
    });
    assert(ackPair.status === 303, `acknowledge (1) expected 303 got ${ackPair.status} ${await ackPair.text()}`);
    await passEntry(pairLots[0].id);
    const siloPage = await text(`/station/load_silo?pick=${pairBatch}`);
    const freeSilo = ([...siloPage.body.matchAll(/<option value="([a-f0-9-]{36})"(?![^>]*disabled)[^>]*>([^<]*)</g)].find((row) => row[2].trim().startsWith("Silo")) || [])[1];
    const siloSelect = (siloPage.body.match(/<select name="dry_space_id"[\s\S]*?<\/select>/) || ["no select"])[0].slice(0, 800);
    assert(freeSilo, `a silo must be free for the pair's location files: ${siloSelect}`);
    const pairLoad = await req("/station/load_silo/load", {
      method: "POST",
      body: form({ lot_id: pairBatch, dry_space_id: freeSilo, start_time: "", loaded_at_iso: "" }),
    });
    assert(pairLoad.status === 303, `pair load silo expected 303 got ${pairLoad.status} ${await pairLoad.text()}`);
    const locPage = await text("/admin/uploads");
    const locNames = [...locPage.body.matchAll(new RegExp(`location_change_${pairHbn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\((\\d+)\\)_[^"<]+\\.csv`, "g"))].map((m) => m[0]);
    assert(locNames.some((name) => name.includes("(1)")) && locNames.some((name) => name.includes("(2)")), `the two location files must be named apart, got ${locNames.join(" ")}`);
    for (const lot of pairLots) {
      const dry = await req(`/station/unload_dry_space/lot/${lot.id}/weights`, { method: "POST", body: form({ weight_grams: "40" }) });
      assert(dry.status === 303, `pair dry weight expected 303 got ${dry.status} ${await dry.text()}`);
      const unloaded = await finishUnloadLot(lot.id, {}, "nothing");
      assert(unloaded.loc.includes("ok="), `pair unload must finish, got ${unloaded.loc}`);
    }
    const unloadPage = await text("/admin/uploads");
    assert(
      unloadPage.body.includes(`package_adjustments_${pairHbn}(1).csv`) || unloadPage.body.includes(`packages_from_harvests_${pairHbn}(1).csv`),
      "unload file (1) must be named with the load number"
    );
    assert(
      unloadPage.body.includes(`package_adjustments_${pairHbn}(2).csv`) || unloadPage.body.includes(`packages_from_harvests_${pairHbn}(2).csv`),
      "unload file (2) must be named with the load number"
    );

    const envOpen = await text("/admin/environment");
    assert(envOpen.res.status === 200 && envOpen.body.includes("Environment"), `environment page expected 200 got ${envOpen.res.status}`);
    const envRefresh = await req("/admin/environment/refresh", { method: "POST", body: form({}) });
    assert(envRefresh.status === 303, `sensor refresh expected 303 got ${envRefresh.status} ${await envRefresh.text()}`);
    const envBind = await req("/admin/environment/bind", {
      method: "POST",
      body: form({ sensor_id: "sp-silo3", space_name: "Silo 3", role: "plenum", reason: "smoke bind" }),
    });
    assert(envBind.status === 303, `binding the plenum expected 303 got ${envBind.status} ${await envBind.text()}`);
    const envRange = await req("/admin/environment/range", {
      method: "POST",
      body: form({ space_name: "Silo 3", role: "plenum", temp_high: "100", reason: "smoke range" }),
    });
    assert(envRange.status === 303, `the plenum range expected 303 got ${envRange.status} ${await envRange.text()}`);
    const envCron = await req(`/__scheduled?cron=${encodeURIComponent("*/5 * * * *")}`, { noIdentity: true });
    const envCronBody = await envCron.text();
    assert(envCron.status === 200, `the environment cron expected 200 got ${envCron.status}: ${envCronBody.slice(0, 200)}`);
    const flagged = await text("/ops/drying_ops");
    assert(flagged.body.includes("Plenum 104.2 F, above 100 F"), "Silo 3 must flag the plenum on the strip");
    const liveFlagged = await (await req("/silos/live.json")).json();
    const silo3 = (liveFlagged.silos || []).find((row) => row.name === "Silo 3");
    assert(silo3 && silo3.state && silo3.wetGrams != null && Array.isArray(silo3.flags) && silo3.flags.includes("Plenum 104.2 F, above 100 F"), "live.json must add flags and keep the old fields");
    const envClear = await req(`/__scheduled?cron=${encodeURIComponent("*/5 * * * *")}`, { noIdentity: true });
    await envClear.text();
    const liveClear = await (await req("/silos/live.json")).json();
    const silo3Clear = (liveClear.silos || []).find((row) => row.name === "Silo 3");
    assert(silo3Clear && Array.isArray(silo3Clear.flags) && silo3Clear.flags.length === 0, "an in-range reading must clear the flag");
    const freezerPost = await req("/sensors/readings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: "Blast Freezer(s)", temperature_f: 20, read_at: new Date().toISOString(), source: "plc" }),
    });
    assert(freezerPost.status === 200, `a freezer reading expected 200 got ${freezerPost.status} ${await freezerPost.text()}`);
    const freezerRange = await req("/admin/environment/range", {
      method: "POST",
      body: form({ space_name: "Blast Freezer(s)", role: "room", temp_high: "10", reason: "smoke freezer" }),
    });
    assert(freezerRange.status === 303, `the freezer range expected 303 got ${freezerRange.status}`);
    const freezerPage = await text("/ops/drying_ops");
    assert(freezerPage.body.includes("Room 20 F, above 10 F"), "the freezer tile must flag a temperature-only reading");

    process.stdout.write("SMOKE PASS\n");
  } finally {
    await stopWrangler(child);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
