/* TS2, THE TEAM COPY (the owner, 2026-11-19): "let's set the default background for all CSS options to burnt orange.
 * That way it's always distinguishable in the browser from Live.  Also, add a refresh D1 button to the homepage."
 * His picks: the button loads the newest can, on a local copy only and never on live; the team's guide lives in the
 * repo (tools/sandbox) with an email from him; a teammate's change leaves only as a hand-back.
 *
 * OFF LIVE: the default env in wrangler.toml carries OFF_LIVE = "1", so every local run (the sandbox, the smoke, a
 * plain wrangler dev) has it. A named env never inherits vars, so env.grip (live) and env.c10 never see it. Off live,
 * every HTML page carries one more style block: a burnt orange frame around the window, and on the app's own pages a
 * burnt orange page ground, with each look (Grip, Lite, Continuum) keeping its own colors under the app bar and the
 * page itself, so a page reads as it does on live while the ground around it says this is not live.
 *
 * REFRESH D1: tools/sandbox/sandbox.mjs start runs a control server on 127.0.0.1 and hands the app its address as
 * SANDBOX_CONTROL. With it, the home page names the can the data came from and carries Refresh D1: the tool builds
 * the newest can in the shared folder beside the running app, then stops the app, swaps the database in and starts
 * the app again. Without it (live, the smoke, a plain wrangler dev) the strip and its routes do not exist. */

import { t, tFill, type Locale } from "./i18n";
import { esc } from "./ui";

declare global {
  interface Env {
    /** "1" in wrangler.toml's default env only: this copy is not live. */
    OFF_LIVE?: string;
    /** Passed by the sandbox tool's start (a --var, never in wrangler.toml): its control server on 127.0.0.1. */
    SANDBOX_CONTROL?: string;
  }
}

export const SANDBOX_REFRESH_PATH = "/sandbox/refresh-d1";
/** A vendored page (the Models tools, Harvest Console Lite, SalesHelper) carries this: its bytes are pinned by the
 * vendored pair law, so the off live block never touches it, on any copy. */
export const VENDORED_HEADER = "x-gf-vendored";
export const SANDBOX_STATUS_PATH = "/sandbox/refresh-d1/status.json";
export const BURNT_ORANGE = "#cc5500";

/** True on any copy that is not live: the default env's OFF_LIVE. */
export function offLive(env: Pick<Env, "OFF_LIVE">): boolean {
  return String(env.OFF_LIVE ?? "").trim() === "1";
}

const CONTROL_RE = /^http:\/\/127\.0\.0\.1:\d{2,5}\/[0-9a-f]{32,64}$/;

/** The sandbox tool's control address, only off live and only in the exact shape the tool hands over. */
export function sandboxControl(env: Pick<Env, "OFF_LIVE" | "SANDBOX_CONTROL">): string | null {
  if (!offLive(env)) return null;
  const base = String(env.SANDBOX_CONTROL ?? "").trim();
  return CONTROL_RE.test(base) ? base : null;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** A request to this copy itself, from a page of this copy: a site that resolves its own name to this computer (DNS
 * rebinding) arrives under its own host and origin and is turned away. */
export function localRequest(url: string, origin: string | undefined): boolean {
  try {
    if (!LOCAL_HOSTS.has(new URL(url).hostname)) return false;
    return !origin || LOCAL_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

const OFF_LIVE_CSS = `
html::after { content: ""; position: fixed; inset: 0; border: 6px solid ${BURNT_ORANGE}; pointer-events: none; z-index: 2147483647; }
html:has(> body > header.app-bar) { background: ${BURNT_ORANGE} !important; }
html:has(> body > header.app-bar) > body { background: transparent !important; background-image: none !important; padding: 6px !important; }
html:has(> body > header.app-bar) > body > header.app-bar,
html:has(> body > header.app-bar) > body > main { background-color: var(--bg); }
@media print { html::after { display: none; } }
.sbx-strip { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; margin: 0 0 1rem; padding: 0.6rem 0.8rem; border: 2px solid ${BURNT_ORANGE}; border-radius: var(--radius, 10px); min-width: 0; }
.sbx-strip-label { font-weight: 800; letter-spacing: 0.04em; }
.sbx-strip-can { overflow-wrap: anywhere; min-width: 0; }
.sbx-strip .btn, .sbx-strip a.btn { margin-left: auto; min-height: 44px; display: inline-flex; align-items: center; }
.sbx-refresh { max-width: 44rem; }
.sbx-refresh dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.35rem 1rem; margin: 1rem 0; }
.sbx-refresh dt { font-weight: 700; }
.sbx-refresh dd { margin: 0; overflow-wrap: anywhere; }
.sbx-refresh .sbx-tools { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0; }
.sbx-refresh .sbx-tools .btn, .sbx-refresh .sbx-tools button { min-height: 44px; }
.sbx-note { padding: 0.6rem 0.8rem; border-left: 4px solid ${BURNT_ORANGE}; margin: 0.8rem 0; overflow-wrap: anywhere; }
.sbx-error { border-left-color: var(--danger, var(--alert, currentColor)); }
`;

/** The off live block, the last thing in the head so it wins over each look's own ground. */
export const OFF_LIVE_STYLE = `<style data-off-live>${OFF_LIVE_CSS}</style>`;

/** An HTML page with the off live block in its head; a page without a head is left as it is. */
export function withOffLive(html: string): string {
  const at = html.indexOf("</head>");
  if (at < 0 || html.includes("data-off-live")) return html;
  return html.slice(0, at) + OFF_LIVE_STYLE + html.slice(at);
}

export type CanRef = { name: string; dumped_at: string | null };
export type SandboxStatus = {
  state: "idle" | "building" | "restarting" | "failed";
  can: CanRef | null;
  newest: CanRef | null;
  target: CanRef | null;
  error: string | null;
  at: string | null;
};

function canRef(raw: unknown): CanRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name ?? "").slice(0, 200);
  if (!name) return null;
  const dumped = r.dumped_at == null ? null : String(r.dumped_at).slice(0, 40);
  return { name, dumped_at: dumped };
}

/** The tool's answer, kept to the fields the pages use and their sizes. */
export function readStatus(raw: unknown): SandboxStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const state = ["idle", "building", "restarting", "failed"].includes(String(r.state)) ? (String(r.state) as SandboxStatus["state"]) : null;
  if (!state) return null;
  return {
    state,
    can: canRef(r.can),
    newest: canRef(r.newest),
    target: canRef(r.target),
    error: r.error == null ? null : String(r.error).slice(0, 600),
    at: r.at == null ? null : String(r.at).slice(0, 40),
  };
}

/** GET the tool's status; null when it does not answer in time or answers out of shape. */
export async function controlStatus(base: string): Promise<SandboxStatus | null> {
  try {
    const res = await fetch(`${base}/status`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    return readStatus(await res.json());
  } catch {
    return null;
  }
}

export type RefreshAnswer = { ok: true; target: CanRef | null } | { ok: false; error: string };

/** POST the tool's refresh: it answers at once and works on in the background. */
export async function controlRefresh(base: string): Promise<RefreshAnswer> {
  try {
    const res = await fetch(`${base}/refresh`, { method: "POST", signal: AbortSignal.timeout(5000) });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 202) return { ok: true, target: canRef(body.target) };
    if (res.status === 409) return { ok: false, error: "A refresh is already running." };
    return { ok: false, error: "The sandbox tool isn't answering. Stop the app and start it again with the sandbox tool." };
  } catch {
    return { ok: false, error: "The sandbox tool isn't answering. Stop the app and start it again with the sandbox tool." };
  }
}

function when(dumped: string | null): string {
  if (!dumped) return "";
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(dumped);
  return m ? `${m[1]} ${m[2]} UTC` : dumped;
}

function canLine(ref: CanRef | null, locale: Locale): string {
  if (!ref) return t(locale, "unknown");
  const stamp = when(ref.dumped_at);
  return stamp ? tFill(locale, "{can} (dumped {when})", { can: ref.name, when: stamp }) : ref.name;
}

/** A can newer than the data's, by the time each snapshot was taken (the shared folder may hold older cans too). */
export function newerCan(newest: CanRef | null, can: CanRef | null): boolean {
  if (!newest || !can || newest.name === can.name) return false;
  if (newest.dumped_at && can.dumped_at) return newest.dumped_at > can.dumped_at;
  return true;
}

/** The home page's strip: which can the data came from, and Refresh D1. */
export function sandboxStrip(status: SandboxStatus | null, locale: Locale): string {
  const tr = (key: string) => esc(t(locale, key));
  let line: string;
  if (!status) line = tr("The sandbox tool isn't answering.");
  else if (status.state === "building" || status.state === "restarting") line = tr("A refresh is running.");
  else {
    line = `${tr("Data from")} ${esc(canLine(status.can, locale))}`;
    if (status.newest && newerCan(status.newest, status.can)) {
      line += `. ${esc(tFill(locale, "A newer can is in the shared folder: {can}.", { can: status.newest.name }))}`;
    }
  }
  return `<section class="sbx-strip" data-sbx-strip>
  <span class="sbx-strip-label">${tr("Local copy, not live")}</span>
  <span class="sbx-strip-can" data-sbx-can>${line}</span>
  <a class="btn" href="${SANDBOX_REFRESH_PATH}" data-sbx-refresh>${tr("Refresh D1")}</a>
</section>`;
}

const REFRESH_WORD_KEYS = [
  "Building the new database from {can}. The app keeps working until it restarts.",
  "Restarting the app with the new data...",
  "Done. Opening the home page...",
  "The refresh failed: {error} Your data was not changed.",
  "Waiting for the app to come back...",
  "A refresh is already running.",
  "The sandbox tool isn't answering. Stop the app and start it again with the sandbox tool.",
];

function wordsJson(locale: Locale): string {
  const words: Record<string, string> = {};
  for (const key of REFRESH_WORD_KEYS) words[key] = t(locale, key);
  return JSON.stringify(words).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

/** The confirm page: what the refresh does, the data now, the newest can, and Refresh now. */
export function sandboxRefreshPage(status: SandboxStatus | null, locale: Locale): string {
  const tr = (key: string) => esc(t(locale, key));
  const busy = status && (status.state === "building" || status.state === "restarting");
  const same = status?.newest && status?.can && status.newest.name === status.can.name;
  const older = !same && status?.newest?.dumped_at && status?.can?.dumped_at && status.newest.dumped_at < status.can.dumped_at;
  const failed = status?.state === "failed" && status.error
    ? `<p class="sbx-note sbx-error" data-sbx-failed>${esc(tFill(locale, "The refresh failed: {error} Your data was not changed.", { error: status.error }))}</p>`
    : "";
  const body = !status
    ? `<p class="sbx-note sbx-error" data-sbx-down>${tr("The sandbox tool isn't answering. Stop the app and start it again with the sandbox tool.")}</p>`
    : `<dl>
    <dt>${tr("Data now")}</dt><dd data-sbx-now>${esc(canLine(status.can, locale))}</dd>
    <dt>${tr("Newest can")}</dt><dd data-sbx-newest>${esc(canLine(status.newest, locale))}</dd>
  </dl>
  ${same ? `<p class="sbx-note" data-sbx-same>${tr("Your data is already from the newest can. Refreshing loads it again from the start.")}</p>` : ""}
  ${older ? `<p class="sbx-note" data-sbx-older>${tr("The newest can in the shared folder is older than your data. Refreshing loads that older can.")}</p>` : ""}
  ${failed}
  <div class="sbx-tools">
    <button type="button" data-sbx-go${busy ? " disabled" : ""}>${tr("Refresh now")}</button>
    <a class="btn secondary" href="/">${tr("Cancel")}</a>
  </div>`;
  return `<section class="sbx-refresh" data-sbx-page data-sbx-busy="${busy ? "1" : "0"}" data-sbx-target="${esc(status?.target?.name ?? "")}">
  <h1>${tr("Refresh D1")}</h1>
  <p>${tr("Refresh D1 loads the newest can from the shared folder into this copy's database. Your code and any change in progress stay as they are; anything you entered in this copy is replaced. The app restarts by itself, which takes a few minutes.")}</p>
  ${body}
  <p class="sbx-note" data-sbx-progress role="status" aria-live="polite"${busy ? "" : " hidden"}>${busy ? tr("A refresh is running.") : ""}</p>
</section>
<script type="application/json" data-sbx-words>${wordsJson(locale)}</script>
<script>${SBX_CLIENT}</script>`;
}

const SBX_CLIENT = String.raw`
(function () {
  var page = document.querySelector('[data-sbx-page]');
  if (!page) return;
  var words = JSON.parse(document.querySelector('[data-sbx-words]').textContent || '{}');
  var w = function (k, fill) { var s = words[k] || k; Object.keys(fill || {}).forEach(function (f) { s = s.split('{' + f + '}').join(fill[f]); }); return s; };
  var progress = page.querySelector('[data-sbx-progress]');
  var go = page.querySelector('[data-sbx-go]');
  var target = page.getAttribute('data-sbx-target') || '';
  function say(text) { progress.hidden = false; progress.textContent = text; }
  function poll() {
    fetch('${SANDBOX_STATUS_PATH}', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (s) {
      if (!s || !s.state) { say(w('Waiting for the app to come back...')); return later(); }
      if (s.state === 'building') { say(w('Building the new database from {can}. The app keeps working until it restarts.', { can: (s.target && s.target.name) || target })); return later(); }
      if (s.state === 'restarting') { say(w('Restarting the app with the new data...')); return later(); }
      if (s.state === 'failed') { say(w('The refresh failed: {error} Your data was not changed.', { error: s.error || '' })); if (go) go.disabled = false; return; }
      if (!target || (s.can && s.can.name === target)) { say(w('Done. Opening the home page...')); setTimeout(function () { location.href = '/'; }, 800); return; }
      later();
    }, function () { say(w('Waiting for the app to come back...')); later(); });
  }
  function later() { setTimeout(poll, 2000); }
  if (page.getAttribute('data-sbx-busy') === '1') later();
  if (go) go.addEventListener('click', function () {
    go.disabled = true;
    fetch('${SANDBOX_REFRESH_PATH}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { say(d.error || w('A refresh is already running.')); go.disabled = false; return; }
        target = (d.target && d.target.name) || target;
        say(w('Building the new database from {can}. The app keeps working until it restarts.', { can: target }));
        later();
      }, function () { say(w("The sandbox tool isn't answering. Stop the app and start it again with the sandbox tool.")); go.disabled = false; });
  });
})();
`;
