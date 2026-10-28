/**
 * CT1, THE C&T WALL IS THE REGISTER (canon 0.30.558). The Cultivation and Technology wall shows the C&T
 * register's seven KPIs exactly as Field Ops recorded them each morning: the status, the headline as
 * written, the sources not read that morning, the recorded numbers with their labels as sent, a line of
 * one number across the days, and the reasons. It recomputes nothing, so the wall and the board editions
 * agree. The owner's picks: the register is the source for all seven (gfLite's own computes leave this
 * wall; their reports stay), the piece is ported into the app's shape, and the feed is read live on each
 * view, server side, with the token a worker secret the page never sees.
 *
 * THE SWAP SEAM: Field Ops is read here and nowhere else (readCtRegister).
 */

import { etWallClock } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { esc } from "./ui";

declare global {
  interface Env {
    /** The C&T register's bearer token: a worker secret set by the owner's hands (wrangler secret put KPI_FEED_TOKEN --env grip). Never logged, stored or shown. */
    KPI_FEED_TOKEN?: string;
    /** Smoke and bench only: a feed on this machine (http://127.0.0.1 or localhost). Any other value is ignored, so the token only ever goes to Field Ops. */
    KPI_FEED_BASE?: string;
  }
}

export const CT_REGISTER_BASE = "https://grip-field-ops.pages.dev";
export const CT_REGISTER_PATH = "/api/kpi/feed";
/** The days the wall asks for: the line on each card spans them. */
export const CT_REGISTER_DAYS = 30;
export const CT_REGISTER_TIMEOUT_MS = 10_000;

export type CtEnv = { KPI_FEED_TOKEN?: string; KPI_FEED_BASE?: string };
export type CtKpiCode = "r01" | "r02" | "r03" | "r04" | "r05" | "r06" | "r07";
export type CtStatus = "nominal" | "watch" | "action" | "building";
export type CtPoint = { key: string; label: string; value: number | null; held: boolean };
export type CtReason = { level: string; text: string };
export type CtRow = {
  day: string;
  kpi: CtKpiCode;
  status: CtStatus;
  headline: string;
  reasons: CtReason[];
  series: CtPoint[];
  unread: string[];
  rule_version: string;
  computed_at: string;
};
export type CtFeed = { generated_at: string; rule_version: string; rows: CtRow[]; bad_json: string[] };
export type CtRead =
  | { kind: "ok"; feed: CtFeed; readAt: string }
  | { kind: "no_token"; readAt: string }
  | { kind: "refused"; status: number; error: string; readAt: string }
  | { kind: "timeout"; readAt: string }
  | { kind: "unreachable"; readAt: string }
  | { kind: "bad_feed"; readAt: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** The seven cards: which recorded numbers each shows and which one draws its line (the register's own panel). */
export const CT_REGISTER_CARDS: ReadonlyArray<{ kpi: CtKpiCode; reg: string; title: string; show: readonly string[]; spark: string }> = [
  { kpi: "r01", reg: "CT-R01", title: "Light and environment", show: ["dli7_ARL", "dli7_PNN", "dli7_PNS", "pns_wet", "csa_t", "csa_rh", "plenum_peak"], spark: "dli7_PNN" },
  { kpi: "r02", reg: "CT-R02", title: "Plant health", show: ["days_since_photo", "first_pass", "lab_pending", "pins7", "facility_capture"], spark: "days_since_photo" },
  { kpi: "r03", reg: "CT-R03", title: "Yield forecast", show: ["proj_dry", "proj_flower", "pct_plan", "measured_dry", "flower_share", "line_7d", "plants_cut"], spark: "proj_dry" },
  { kpi: "r04", reg: "CT-R04", title: "Strain value scorecard", show: ["cultivars_carded", "cultivars_tiered", "top_index"], spark: "cultivars_tiered" },
  { kpi: "r05", reg: "CT-R05", title: "Project pipeline", show: ["open", "due14", "overdue", "flagged"], spark: "open" },
  { kpi: "r06", reg: "CT-R06", title: "Active projects", show: ["on_plan", "slipped", "five_pic", "silos_live"], spark: "five_pic" },
  { kpi: "r07", reg: "CT-R07", title: "Event credit", show: ["offered", "confirmed", "redeemed", "cash_cost"], spark: "confirmed" },
];

const KPI_CODES = new Set<string>(CT_REGISTER_CARDS.map((card) => card.kpi));
const STATUSES = new Set<string>(["nominal", "watch", "action", "building"]);
const MONEY_KEYS = new Set<string>(["offered", "confirmed", "redeemed", "cash_cost"]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_BASE_RE = /^http:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/;

export const CT_STATUS_WORDS: Readonly<Record<CtStatus, string>> = {
  nominal: "Nominal",
  watch: "Watch",
  action: "Action",
  building: "Not live yet",
};

/** Field Ops, or a feed on this machine for the smoke and the bench. The token never goes anywhere else. */
export function ctRegisterBase(env: CtEnv): string {
  const local = (env.KPI_FEED_BASE ?? "").trim().replace(/\/$/, "");
  return LOCAL_BASE_RE.test(local) ? local : CT_REGISTER_BASE;
}

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** The feed as Field Ops sends it, or null when it is not the register's feed. Rows of an unknown KPI or day are dropped. */
export function parseCtFeed(doc: unknown): CtFeed | null {
  if (!doc || typeof doc !== "object") return null;
  const raw = doc as Record<string, unknown>;
  if (raw.ok !== true || !Array.isArray(raw.rows)) return null;
  const rows: CtRow[] = [];
  for (const item of raw.rows as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const day = text(row.day, 10);
    const kpi = text(row.kpi, 3);
    if (!DAY_RE.test(day) || !KPI_CODES.has(kpi)) continue;
    const status = STATUSES.has(text(row.status, 20)) ? (text(row.status, 20) as CtStatus) : "building";
    const reasons: CtReason[] = Array.isArray(row.reasons)
      ? (row.reasons as unknown[])
          .map((r) => (typeof r === "string" ? { level: "", text: text(r) } : r && typeof r === "object" ? { level: text((r as Record<string, unknown>).level, 20), text: text((r as Record<string, unknown>).text) } : null))
          .filter((r): r is CtReason => r != null && r.text !== "")
      : [];
    const series: CtPoint[] = Array.isArray(row.series)
      ? (row.series as unknown[])
          .map((p) => {
            if (!p || typeof p !== "object") return null;
            const point = p as Record<string, unknown>;
            const key = text(point.key, 80);
            if (!key) return null;
            const value = typeof point.value === "number" && Number.isFinite(point.value) ? point.value : null;
            return { key, label: text(point.label, 200), value, held: point.held === true };
          })
          .filter((p): p is CtPoint => p != null)
      : [];
    const unread = Array.isArray(row.unread) ? (row.unread as unknown[]).map((u) => text(u, 400)).filter((u) => u !== "") : [];
    rows.push({ day, kpi: kpi as CtKpiCode, status, headline: text(row.headline), reasons, series, unread, rule_version: text(row.rule_version, 40), computed_at: text(row.computed_at, 40) });
  }
  const badJson = Array.isArray(raw.bad_json) ? (raw.bad_json as unknown[]).map((b) => text(b, 200)).filter((b) => b !== "") : [];
  return { generated_at: text(raw.generated_at, 40), rule_version: text(raw.rule_version, 40), rows, bad_json: badJson };
}

/** One live read of the register, server side. The token rides only to Field Ops (or a local feed), never follows a
 * redirect, and never appears in what this returns. */
export async function readCtRegister(env: CtEnv, fetchImpl: FetchLike = fetch, nowIso: string = new Date().toISOString()): Promise<CtRead> {
  const token = (env.KPI_FEED_TOKEN ?? "").trim();
  if (!token) return { kind: "no_token", readAt: nowIso };
  const url = `${ctRegisterBase(env)}${CT_REGISTER_PATH}?days=${CT_REGISTER_DAYS}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CT_REGISTER_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal, redirect: "manual" });
    const body = await res.text();
    let doc: unknown = null;
    try {
      doc = JSON.parse(body);
    } catch {
      doc = null;
    }
    if (res.status !== 200) {
      const said = doc && typeof doc === "object" ? text((doc as Record<string, unknown>).error, 200) : "";
      return { kind: "refused", status: res.status, error: said, readAt: nowIso };
    }
    const feed = parseCtFeed(doc);
    return feed ? { kind: "ok", feed, readAt: nowIso } : { kind: "bad_feed", readAt: nowIso };
  } catch (err) {
    return { kind: ctrl.signal.aborted || (err instanceof Error && err.name === "AbortError") ? "timeout" : "unreachable", readAt: nowIso };
  } finally {
    clearTimeout(timer);
  }
}

/** A recorded number as the board editions print it: held, n/a, dollars, separators past a thousand, one decimal below. */
export function ctValue(point: CtPoint | undefined, locale: Locale): string {
  if (!point) return t(locale, "n/a");
  if (point.held) return t(locale, "held");
  if (point.value == null) return t(locale, "n/a");
  const v = point.value;
  const money = MONEY_KEYS.has(point.key) || point.label.includes("($)");
  const shown = Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : String(Math.round(v * 10) / 10);
  return money ? `$${shown}` : shown;
}

/** One number across the days, oldest first. A held or missing day breaks the line; a lone day is a dot. */
export function ctSparkSvg(values: ReadonlyArray<number | null>): string {
  const shown = values.filter((v): v is number => v != null);
  if (shown.length === 0) return "";
  const lo = Math.min(...shown);
  const hi = Math.max(...shown);
  const n = values.length;
  const x = (i: number) => (n === 1 ? 60 : (i * 120) / (n - 1));
  const y = (v: number) => (hi === lo ? 16 : 28 - ((v - lo) / (hi - lo)) * 24);
  const parts: string[] = [];
  let run: Array<{ i: number; v: number }> = [];
  const flush = () => {
    if (run.length === 1) {
      const p = run[0] as { i: number; v: number };
      parts.push(`<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2"/>`);
    } else if (run.length > 1) {
      parts.push(`<polyline points="${run.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}"/>`);
    }
    run = [];
  };
  values.forEach((v, i) => {
    if (v == null) flush();
    else run.push({ i, v });
  });
  flush();
  return `<svg class="dd-spark ct-spark-line" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true" data-ct-spark-points="${shown.length}">${parts.join("")}</svg>`;
}

function refusalWords(read: Exclude<CtRead, { kind: "ok" }>, locale: Locale): string {
  if (read.kind === "no_token") return t(locale, "The C&T register's token is not set on this worker yet.");
  if (read.kind === "timeout") return t(locale, "Field Ops did not answer within 10 seconds.");
  if (read.kind === "unreachable") return t(locale, "Field Ops could not be reached.");
  if (read.kind === "bad_feed") return t(locale, "Field Ops answered, but not with the register's feed.");
  const said = read.error ? `: ${read.error}` : "";
  return `${tFill(locale, "Field Ops refused the read ({status})", { status: String(read.status) })}${said}`;
}

function cardHtml(card: (typeof CT_REGISTER_CARDS)[number], rows: readonly CtRow[], days: readonly string[], latest: string, locale: Locale): string {
  const row = rows.find((r) => r.day === latest && r.kpi === card.kpi) ?? null;
  const status: CtStatus | "missing" = row ? row.status : "missing";
  const statusWord = row ? t(locale, CT_STATUS_WORDS[row.status]) : t(locale, "Not recorded");
  const head = `<span class="dd-tile-head">
        <span class="dd-tile-title"><span class="ct-reg">${esc(card.reg)}</span> ${esc(t(locale, card.title))}</span>
        <span class="ct-status" data-ct-status-word>${esc(statusWord)}</span>
      </span>`;
  if (!row) {
    return `<article class="dd-tile ct-card ct-missing" data-ct-kpi="${esc(card.kpi)}" data-ct-status="missing">
      ${head}
      <p class="muted">${esc(tFill(locale, "No row recorded for {day}.", { day: latest }))}</p>
    </article>`;
  }
  const unread = row.unread.length ? `<p class="ct-unread" data-ct-unread>${esc(t(locale, "Not read that morning"))}: ${esc(row.unread.join("; "))}</p>` : "";
  const nums = card.show
    .map((key) => row.series.find((p) => p.key === key))
    .filter((p): p is CtPoint => p != null)
    .map((p) => `<div class="ct-num"><dt>${esc(p.label || p.key)}</dt><dd data-ct-key="${esc(p.key)}">${esc(ctValue(p, locale))}</dd></div>`)
    .join("");
  const sparkPoint = row.series.find((p) => p.key === card.spark);
  let spark = "";
  if (sparkPoint && days.length > 1) {
    let anyHeld = false;
    const values = days.map((d) => {
      const r = rows.find((x) => x.day === d && x.kpi === card.kpi);
      const p = r ? r.series.find((s) => s.key === card.spark) : undefined;
      if (p?.held) anyHeld = true;
      return p && !p.held && p.value != null ? p.value : null;
    });
    const svg = ctSparkSvg(values);
    const label = `${sparkPoint.label || sparkPoint.key}, ${days[0]} ${t(locale, "to")} ${latest}`;
    spark = `<div class="ct-spark"><span class="ct-spark-label">${esc(label)}</span>${
      svg || `<span class="ct-spark-none">${esc(t(locale, anyHeld ? "held on every day in this window" : "not measured in this window"))}</span>`
    }</div>`;
  }
  const reasons = row.reasons.length
    ? `<details class="ct-notes"><summary>${esc(tFill(locale, row.reasons.length === 1 ? "{n} note" : "{n} notes", { n: String(row.reasons.length) }))}</summary><ul>${row.reasons
        .map((r) => `<li class="ct-level-${esc(STATUSES.has(r.level) ? r.level : "note")}">${esc(r.text)}</li>`)
        .join("")}</ul></details>`
    : "";
  return `<article class="dd-tile ct-card ct-${esc(status)}" data-ct-kpi="${esc(card.kpi)}" data-ct-status="${esc(status)}" data-ct-day="${esc(row.day)}">
      ${head}
      <p class="ct-headline">${esc(row.headline)}</p>
      ${unread}
      ${nums ? `<dl class="ct-nums">${nums}</dl>` : ""}
      ${spark}
      ${reasons}
    </article>`;
}

/** The Cultivation and Technology wall: the register's seven cards from one live read, or the read's refusal in words. */
export function ctRegisterWallPage(read: CtRead, locale: Locale = "en"): string {
  const note = `<p class="muted">${esc(t(locale, "The C&T register's seven KPIs, exactly as Field Ops recorded them each morning. This wall recomputes nothing, so it matches the board editions."))}</p>`;
  const readAt = `<span data-ct-read-at="${esc(read.readAt)}">${esc(etWallClock(read.readAt))}</span>`;
  if (read.kind !== "ok") {
    return `<div class="dd-wall ct-register" data-dd-wall="culttech" data-ct-register="${esc(read.kind)}">
    <h1>${esc(t(locale, "Cultivation and Technology"))}</h1>
    ${note}
    <p class="ct-refusal" data-ct-refusal="${esc(read.kind)}">${esc(refusalWords(read, locale))}</p>
    <p class="muted">${esc(t(locale, "Read live"))} ${readAt}</p>
  </div>`;
  }
  const rows = read.feed.rows;
  const days = [...new Set(rows.map((r) => r.day))].sort();
  const latest = days[days.length - 1] ?? "";
  const versions = [...new Set(rows.map((r) => r.rule_version).filter((v) => v !== ""))].sort();
  const meta = latest
    ? `${esc(tFill(locale, "Recorded {day}", { day: latest }))}. ${esc(t(locale, "Rules"))} ${esc(versions.join(", ") || t(locale, "n/a"))}. ${esc(t(locale, "Read live"))} ${readAt}`
    : `${esc(t(locale, "No days recorded yet."))} ${esc(t(locale, "Read live"))} ${readAt}`;
  const bad = read.feed.bad_json.length ? `<p class="ct-unread" data-ct-bad-json>${esc(t(locale, "Fields Field Ops could not parse"))}: ${esc(read.feed.bad_json.join(", "))}</p>` : "";
  const cards = latest ? CT_REGISTER_CARDS.map((card) => cardHtml(card, rows, days, latest, locale)).join("") : "";
  return `<div class="dd-wall ct-register" data-dd-wall="culttech" data-ct-register="ok" data-ct-days="${esc(days.length)}" data-ct-latest="${esc(latest)}">
    <h1>${esc(t(locale, "Cultivation and Technology"))}</h1>
    ${note}
    <p class="muted" data-ct-meta>${meta}</p>
    ${bad}
    ${cards ? `<div class="dd-tiles ct-cards">${cards}</div>` : ""}
  </div>`;
}
