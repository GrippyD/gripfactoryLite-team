// GripFactory Lite, TL2: the TagLeaf pull. Runs on the owner's PC.
//
// What it does, once a day: opens the saved browser profile (logged in to
// lims.tagleaf.com by his hands, never by this script), reads the Samples
// listing for the last N days of lab intakes, reads the COA page of each
// sample completed since the last run, and posts the rows to the app's lab
// samples feed with the tagleaf-pusher Access token. The token is read from a
// DPAPI protected file written by setup-token.ps1; it is never logged.
//
// TagLeaf's Terms of Use ban robots collecting data. This is one. The owner
// runs it on his own account, for his own samples, with the lab's blessing.
//
//   node pull.mjs --login          open the browser, log in by hand, press Enter here
//   node pull.mjs                  the daily run (last 21 days of intakes)
//   node pull.mjs --since 2026-09-14 --max-coas 2000   a backfill
//   node pull.mjs --dry            no post: writes the rows to rows-<date>.json
//   node pull.mjs --days 7         a shorter window
//
// Exit codes: 0 posted (or dry), 2 not logged in (run --login), 1 anything else.

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { coaUrlOf, daysAgo, feedRow, isoDate, listingPath, parseCoa } from "./lib.mjs";

const LIMS = "https://lims.tagleaf.com";
const APP = process.env.GF_APP_URL || "https://gripfactory-lite-grip.gflite.workers.dev";
const FEED = APP.replace(/\/$/, "") + "/feeds/lab-samples.json";
const TENANT_NAME = "Alchemy North - Reassure";
const TENANT_SLUG = "alchemy-north-reassure";
const HOME = path.join(process.env.LOCALAPPDATA || os.homedir(), "gf-tagleaf");
const PROFILE = path.join(HOME, "profile");
const STATE = path.join(HOME, "state.json");
const LOG = path.join(HOME, "pull.log");
const ACCESS = path.join(HOME, "access.json");
const JSON_HEADERS = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };
const COA_SPACING_MS = 400;
const POST_CHUNK = 500;

const args = parseArgs(process.argv.slice(2));
fs.mkdirSync(HOME, { recursive: true });

function parseArgs(list) {
  const out = { login: false, dry: false, days: 21, since: null, maxCoas: 300 };
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === "--login") out.login = true;
    else if (a === "--dry") out.dry = true;
    else if (a === "--days") out.days = Number(list[++i]);
    else if (a === "--since") out.since = String(list[++i]);
    else if (a === "--max-coas") out.maxCoas = Number(list[++i]);
    else throw new Error("Unknown argument " + a);
  }
  if (!Number.isFinite(out.days) || out.days < 1) throw new Error("--days wants a number of days");
  if (out.since && !/^\d{4}-\d{2}-\d{2}$/.test(out.since)) throw new Error("--since wants YYYY-MM-DD");
  return out;
}

function log(line) {
  const stamped = new Date().toISOString() + " " + line;
  console.log(stamped);
  fs.appendFileSync(LOG, stamped + "\n");
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return { coas: {} };
  }
}

function writeState(state) {
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
}

/** The Access token pair, decrypted by the Windows user that stored it. Never logged. */
function readAccess() {
  if (!fs.existsSync(ACCESS)) throw new Error("No Access token on this machine. Run setup-token.ps1 first.");
  const plain = (field) => `[Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR(($j.${field} | ConvertTo-SecureString)))`;
  const script = [
    `$j = Get-Content -Raw '${ACCESS.replace(/'/g, "''")}' | ConvertFrom-Json`,
    `@{ id = (${plain("id")}); secret = (${plain("secret")}) } | ConvertTo-Json -Compress`,
  ].join("; ");
  const out = execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", windowsHide: true });
  const pair = JSON.parse(out);
  if (!pair.id || !pair.secret) throw new Error("The Access token file is incomplete. Run setup-token.ps1 again.");
  return pair;
}

async function openBrowser(headless) {
  return chromium.launchPersistentContext(PROFILE, {
    headless,
    channel: process.env.GF_BROWSER || "chrome",
    viewport: { width: 1280, height: 900 },
  });
}

async function login() {
  const ctx = await openBrowser(false);
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(LIMS + "/login");
  console.log("Log in to TagLeaf in the window that opened (tick Remember me), pick the tenant " + TENANT_NAME + ", then press Enter here.");
  await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("", () => {
      rl.close();
      resolve();
    });
  });
  await page.goto(LIMS + "/home");
  const ok = !page.url().includes("/login");
  await ctx.close();
  if (!ok) {
    console.log("Still on the login page. Run --login again.");
    process.exit(2);
  }
  console.log("Session saved in " + PROFILE + ". The daily run can start.");
}

/** True when the saved session still opens the portal. */
async function signedIn(page) {
  await page.goto(LIMS + "/home", { waitUntil: "domcontentloaded" });
  return !page.url().includes("/login");
}

/** Make the Alchemy North - Reassure tenant the current one (the switcher can wake up on another). */
async function ensureTenant(page) {
  const current = await page.evaluate((name) => {
    const links = [...document.querySelectorAll("a")];
    const hit = links.find((a) => (a.getAttribute("href") || "") === "#" && a.textContent.trim() === name);
    return Boolean(hit);
  }, TENANT_NAME);
  if (current) return;
  const hasForm = await page.evaluate(
    (slug) => [...document.querySelectorAll("form")].some((f) => (f.getAttribute("action") || "").endsWith("/tenants/switchToTenant/" + slug)),
    TENANT_SLUG
  );
  if (!hasForm) throw new Error("The tenant " + TENANT_NAME + " is not on this login's switcher.");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.evaluate((slug) => {
      const form = [...document.querySelectorAll("form")].find((f) => (f.getAttribute("action") || "").endsWith("/tenants/switchToTenant/" + slug));
      form.submit();
    }, TENANT_SLUG),
  ]);
  await page.goto(LIMS + "/home", { waitUntil: "domcontentloaded" });
  const now = await page.evaluate((name) => [...document.querySelectorAll("a")].some((a) => (a.getAttribute("href") || "") === "#" && a.textContent.trim() === name), TENANT_NAME);
  if (!now) throw new Error("Could not switch to the tenant " + TENANT_NAME + ".");
}

async function listSamples(ctx, fromDate, toDate) {
  const rows = [];
  for (let page = 1; page < 200; page++) {
    const res = await ctx.request.get(LIMS + listingPath(fromDate, toDate, page), { headers: JSON_HEADERS });
    const type = res.headers()["content-type"] || "";
    if (res.status() === 401 || res.status() === 419 || !type.includes("json")) {
      const err = new Error("The TagLeaf session has ended (listing answered " + res.status() + " " + type + "). Run pull.mjs --login.");
      err.exit = 2;
      throw err;
    }
    if (!res.ok()) throw new Error("The listing answered " + res.status() + ".");
    const body = await res.json();
    rows.push(...(Array.isArray(body.data) ? body.data : []));
    if (page >= Number(body.last_page || 1)) break;
  }
  return rows;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readCoas(ctx, rows, state) {
  const wanted = rows.filter((r) => /^completed$/i.test(String(r.client_display_status || "")) && coaUrlOf(r));
  let fetched = 0;
  let failed = 0;
  for (const r of wanted) {
    const key = String(r.lab_code);
    const stamp = String(r.status_updated_at || "");
    const cached = state.coas[key];
    if (cached && cached.stamp === stamp) continue;
    if (fetched >= args.maxCoas) break;
    try {
      const res = await ctx.request.get(coaUrlOf(r));
      if (!res.ok()) throw new Error("COA page " + res.status());
      const parsed = parseCoa(await res.text());
      state.coas[key] = { stamp, parsed, at: new Date().toISOString() };
    } catch (e) {
      failed++;
      if (failed <= 5) log("coa " + key + " not read: " + (e && e.message ? e.message : String(e)));
    }
    fetched++;
    await sleep(COA_SPACING_MS);
  }
  return { wanted: wanted.length, fetched, failed, pending: Math.max(0, wanted.filter((r) => !(state.coas[String(r.lab_code)] && state.coas[String(r.lab_code)].stamp === String(r.status_updated_at || ""))).length) };
}

async function postRows(rows, access) {
  const totals = { received: 0, inserted: 0, updated: 0, unchanged: 0, refused: 0, refusals: [] };
  for (let i = 0; i < rows.length; i += POST_CHUNK) {
    const chunk = rows.slice(i, i + POST_CHUNK);
    const res = await fetch(FEED, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Access-Client-Id": access.id,
        "CF-Access-Client-Secret": access.secret,
      },
      body: JSON.stringify({ rows: chunk }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error("The feed answered " + res.status + ": " + text.slice(0, 200));
    const body = JSON.parse(text);
    for (const k of ["received", "inserted", "updated", "unchanged", "refused"]) totals[k] += Number(body[k] || 0);
    if (Array.isArray(body.refusals)) totals.refusals.push(...body.refusals);
  }
  return totals;
}

function pruneCoas(state, keep) {
  const next = {};
  for (const k of keep) if (state.coas[k]) next[k] = state.coas[k];
  state.coas = next;
}

async function run() {
  const access = args.dry ? null : readAccess();
  const state = readState();
  const toDate = isoDate(new Date(Date.now() + 86400000));
  const fromDate = args.since || daysAgo(args.days);
  const ctx = await openBrowser(true);
  try {
    const page = await ctx.newPage();
    if (!(await signedIn(page))) {
      const err = new Error("Not signed in to TagLeaf. Run pull.mjs --login.");
      err.exit = 2;
      throw err;
    }
    await ensureTenant(page);
    const listed = await listSamples(ctx, fromDate, toDate);
    const coas = await readCoas(ctx, listed, state);
    const rows = [];
    for (const r of listed) {
      const cached = state.coas[String(r.lab_code)];
      const coa = cached && cached.stamp === String(r.status_updated_at || "") ? cached.parsed : null;
      const row = feedRow(r, coa);
      if (row) rows.push(row);
    }
    if (!args.since) pruneCoas(state, new Set(listed.map((r) => String(r.lab_code))));
    let summary;
    if (args.dry) {
      const file = path.join(HOME, "rows-" + isoDate(new Date()) + ".json");
      fs.writeFileSync(file, JSON.stringify({ from: fromDate, to: toDate, rows }, null, 1));
      summary = "dry run, rows written to " + file;
    } else {
      const t = await postRows(rows, access);
      summary = `posted ${rows.length}: inserted ${t.inserted}, updated ${t.updated}, unchanged ${t.unchanged}, refused ${t.refused}` + (t.refusals.length ? " (" + t.refusals.slice(0, 3).join("; ") + ")" : "");
    }
    state.lastRun = { at: new Date().toISOString(), from: fromDate, to: toDate, listed: listed.length, rows: rows.length };
    writeState(state);
    log(`intakes ${fromDate} to ${toDate}: listed ${listed.length}, completed with a COA ${coas.wanted}, COA pages read ${coas.fetched} (${coas.failed} failed, ${coas.pending} still to read); ${summary}`);
  } finally {
    await ctx.close();
  }
}

try {
  if (args.login) await login();
  else await run();
} catch (e) {
  log("FAILED: " + (e && e.message ? e.message : String(e)));
  process.exit(e && e.exit ? e.exit : 1);
}
