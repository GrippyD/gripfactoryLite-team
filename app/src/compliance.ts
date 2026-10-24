import { format2, formatGrams, GRAMS_PER_LB, round2, roundGrams } from "./config";
import { csvObjects } from "./csv";
import { t, type Locale } from "./i18n";
import { labStationBody } from "./labpage";
import { STATUS_LABELS, STATUSES } from "./labrules";
import { labAttempt } from "./labvocab";
import { esc, fieldBlock, pencilLink, rapidAddButton, rapidFocusScript, tabBar, voidLink } from "./ui";

export { GRAMS_PER_LB };

/** Pounds from grams at 448 (canon 0.30.164). Two decimals, from the gram
 * number passed in (a stored 1,234.56 g is 2.76 lb). */
export function gramsToLbs(grams: number): number {
  return round2(Number(grams) / GRAMS_PER_LB);
}

export function formatLbs(grams: number): string {
  return format2(gramsToLbs(grams));
}

export const OP_KEY_ALIASES = [
  "tag",
  "sample",
  "package",
  "package_tag",
  "sample_id",
  "sample tag",
  "package tag",
  "source_metrc_tag",
] as const;

export const OP_DATE_ALIASES = [
  "date",
  "tested_at",
  "test date",
  "tested",
  "datetime",
  "test_date",
] as const;

export const HBN_ALIASES = ["hbn", "harvest batch", "harvest_batch", "harvest batch name"] as const;

export const AQUALAB_KEY_ALIASES = OP_KEY_ALIASES;
export const AQUALAB_DATE_ALIASES = OP_DATE_ALIASES;
export const AQUALAB_VALUE_ALIASES = [
  "water_activity",
  "aw",
  "a_w",
  "water activity",
  "aw results",
] as const;

/** THE MAINTENANCE NODE (canon 0.30.293): moisture content on an instrument file. */
export const MOISTURE_ANALYTE_ALIASES = ["mc", "moisture", "moisture content", "mc%"] as const;

/** water activity or moisture content, the two silo checks. Null for anything else. */
export function internalCheckKind(analyte: string | null | undefined): "aw" | "mc" | null {
  const name = normHeader(analyte ?? "");
  if (AQUALAB_VALUE_ALIASES.some((alias) => normHeader(alias) === name)) return "aw";
  if (MOISTURE_ANALYTE_ALIASES.some((alias) => normHeader(alias) === name)) return "mc";
  return null;
}

export const POTENCY_ANALYTE_ALIASES = [
  "thc",
  "total_thc",
  "total thc",
  "potency",
  "thc_pct",
  "thc%",
  "d9_thc",
  "delta9_thc",
  "delta-9 thc",
] as const;

export function isPotencyAnalyte(name: string): boolean {
  return POTENCY_ANALYTE_ALIASES.includes(normHeader(name) as (typeof POTENCY_ANALYTE_ALIASES)[number]);
}

export function normHeader(name: string): string {
  return name.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

function findAliasColumn(headers: string[], aliases: readonly string[]): string | null {
  const wanted = new Set(aliases.map(normHeader));
  for (const header of headers) {
    if (wanted.has(normHeader(header))) return header;
  }
  return null;
}

export type InternalParseRow = {
  package_tag: string | null;
  hbn: string | null;
  sample_id: string | null;
  tested_at: string;
  analyte: string;
  value: number;
  unit: string;
};

export type InstrumentParseResult = {
  rows: InternalParseRow[];
  parsed: number;
  skipped: number;
  error?: string;
};

function lookedFor(aliases: readonly string[]): string {
  return aliases.join(", ");
}

function asNumber(raw: string): number | null {
  const s = raw.trim().replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseOrangePhotonicsCsv(text: string): InstrumentParseResult {
  const objects = csvObjects(text);
  if (objects.length === 0) {
    return { rows: [], parsed: 0, skipped: 0, error: `No recognizable key column. Looked for: ${lookedFor(OP_KEY_ALIASES)}` };
  }
  const headers = Object.keys(objects[0] ?? {});
  const keyCol = findAliasColumn(headers, OP_KEY_ALIASES);
  if (!keyCol) {
    return { rows: [], parsed: 0, skipped: 0, error: `No recognizable key column. Looked for: ${lookedFor(OP_KEY_ALIASES)}` };
  }
  const dateCol = findAliasColumn(headers, OP_DATE_ALIASES);
  const hbnCol = findAliasColumn(headers, HBN_ALIASES);
  const skip = new Set([
    normHeader(keyCol),
    dateCol ? normHeader(dateCol) : "",
    hbnCol ? normHeader(hbnCol) : "",
  ]);
  const rows: InternalParseRow[] = [];
  let parsed = 0;
  let skipped = 0;
  for (const rec of objects) {
    const key = (rec[keyCol] ?? "").trim();
    if (!key) {
      skipped += 1;
      continue;
    }
    const hbn = (hbnCol ? (rec[hbnCol] ?? "").trim() : "") || key;
    let made = 0;
    for (const header of headers) {
      if (skip.has(normHeader(header))) continue;
      const value = asNumber(rec[header] ?? "");
      if (value == null) continue;
      rows.push({
        package_tag: key,
        hbn,
        sample_id: key,
        tested_at: dateCol ? (rec[dateCol] ?? "").trim() || "unknown" : "unknown",
        analyte: header.trim(),
        value: round2(value),
        unit: "",
      });
      made += 1;
    }
    if (made === 0) skipped += 1;
    else parsed += 1;
  }
  return { rows, parsed, skipped };
}

export function parseAqualabCsv(text: string): InstrumentParseResult {
  const objects = csvObjects(text);
  if (objects.length === 0) {
    return { rows: [], parsed: 0, skipped: 0, error: `No recognizable key column. Looked for: ${lookedFor(AQUALAB_KEY_ALIASES)}` };
  }
  const headers = Object.keys(objects[0] ?? {});
  const keyCol = findAliasColumn(headers, AQUALAB_KEY_ALIASES);
  if (!keyCol) {
    return { rows: [], parsed: 0, skipped: 0, error: `No recognizable key column. Looked for: ${lookedFor(AQUALAB_KEY_ALIASES)}` };
  }
  const dateCol = findAliasColumn(headers, AQUALAB_DATE_ALIASES);
  const hbnCol = findAliasColumn(headers, HBN_ALIASES);
  const valueCol = findAliasColumn(headers, AQUALAB_VALUE_ALIASES);
  const rows: InternalParseRow[] = [];
  let parsed = 0;
  let skipped = 0;
  for (const rec of objects) {
    const key = (rec[keyCol] ?? "").trim();
    if (!key) {
      skipped += 1;
      continue;
    }
    let value: number | null = null;
    if (valueCol) value = asNumber(rec[valueCol] ?? "");
    if (value == null) {
      for (const header of headers) {
        if (normHeader(header) === normHeader(keyCol)) continue;
        if (dateCol && normHeader(header) === normHeader(dateCol)) continue;
        value = asNumber(rec[header] ?? "");
        if (value != null) break;
      }
    }
    if (value == null) {
      skipped += 1;
      continue;
    }
    rows.push({
      package_tag: key,
      hbn: (hbnCol ? (rec[hbnCol] ?? "").trim() : "") || key,
      sample_id: key,
      tested_at: dateCol ? (rec[dateCol] ?? "").trim() || "unknown" : "unknown",
      analyte: "water_activity",
      value: round2(value),
      unit: "aw",
    });
    parsed += 1;
  }
  return { rows, parsed, skipped };
}

export function parseFailureModes(raw: string | null | undefined): string[] {
  if (raw == null) return [];
  return String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export type ParetoRow = { mode: string; count: number; pct: number };

export function paretoFromFailures(failureModes: readonly string[]): ParetoRow[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const raw of failureModes) {
    const modes = parseFailureModes(raw);
    for (const mode of modes) {
      counts.set(mode, (counts.get(mode) ?? 0) + 1);
      total += 1;
    }
  }
  if (total === 0) return [];
  const rows = [...counts.entries()].map(([mode, count]) => ({
    mode,
    count,
    pct: round2((count * 100) / total),
  }));
  rows.sort((a, b) => b.pct - a.pct || a.mode.localeCompare(b.mode));
  return rows;
}

export type FtqInput = { sample_tag: string; attempt: number; status: string | null };

export type FtqResult = { rate: number | null; n: number; passed: number };

const TESTING_PASSED = new Set(["passed", "pass", "passed - retest", "remediated"]);
const TESTING_FAILED = new Set(["failed", "fail"]);

/** The console's word list (canon 0.30.341): passed, pass, passed - retest, remediated; failed, fail; anything else is open. */
export function outcomeOf(status: string | null): "passed" | "failed" | "open" {
  const name = normHeader(status ?? "");
  if (TESTING_PASSED.has(name)) return "passed";
  if (TESTING_FAILED.has(name)) return "failed";
  return "open";
}

export function ftqRate(rows: readonly FtqInput[]): FtqResult {
  const first = new Map<string, FtqInput>();
  for (const row of rows) {
    if (row.attempt !== 1) continue;
    const tag = row.sample_tag.trim();
    if (!tag) continue;
    if (!first.has(tag)) first.set(tag, row);
  }
  let n = 0;
  let passed = 0;
  for (const row of first.values()) {
    const outcome = outcomeOf(row.status);
    if (outcome === "open") continue;
    n += 1;
    if (outcome === "passed") passed += 1;
  }
  if (n === 0) return { rate: null, passed: 0, n: 0 };
  return { rate: Math.round((passed * 1000) / n) / 10, passed, n };
}

export type AuditUpToDate = {
  upToDate: boolean;
  daysSince: number | null;
  newestFinishedAt: string | null;
};

export function auditUpToDate(
  newestFinishedAt: string | null | undefined,
  intervalDays: number,
  now = new Date()
): AuditUpToDate {
  if (!newestFinishedAt) {
    return { upToDate: false, daysSince: null, newestFinishedAt: null };
  }
  const finished = Date.parse(newestFinishedAt);
  if (!Number.isFinite(finished)) {
    return { upToDate: false, daysSince: null, newestFinishedAt };
  }
  const daysSince = Math.floor((now.getTime() - finished) / 86_400_000);
  return { upToDate: daysSince <= intervalDays, daysSince, newestFinishedAt };
}

export function internalAuditIntervalDays(value: string | null): number {
  if (value == null || value.trim() === "") return 30;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function testingWeightGrams(row: {
  net_weight_grams?: number | string | null;
  batch_weight_grams?: number | string | null;
}): number {
  const net = Number(row.net_weight_grams);
  if (Number.isFinite(net)) return net;
  const batch = Number(row.batch_weight_grams);
  return Number.isFinite(batch) ? batch : 0;
}

export function lbsInTesting(
  unfinished: ReadonlyArray<{ net_weight_grams?: number | string | null; batch_weight_grams?: number | string | null }>,
  queueGrams: readonly number[]
): { grams: number; lbs: number; source: "external" | "queue" } {
  if (unfinished.length > 0) {
    const grams = unfinished.reduce((sum, row) => sum + testingWeightGrams(row), 0);
    return { grams: roundGrams(grams), lbs: gramsToLbs(grams), source: "external" };
  }
  const grams = queueGrams.reduce((sum, g) => sum + Number(g), 0);
  return { grams: roundGrams(grams), lbs: gramsToLbs(grams), source: "queue" };
}

export type ComplianceKpis = {
  lbs: { grams: number; lbs: number; source: "external" | "queue" };
  pareto: ParetoRow[];
  ftq: FtqResult;
  audit: AuditUpToDate;
};

export function complianceMenuPage(kpis: ComplianceKpis, locale: Locale = "en"): string {
  const kind = `<span class="tile-kind">${esc(t(locale, "Compliance Console"))}</span>`;
  const ftq = kpis.ftq.rate == null ? t(locale, "n/a") : `${kpis.ftq.rate.toFixed(1)}%`;
  const auditClass = kpis.audit.upToDate ? "kpi-yes" : "kpi-no";
  const auditWord = kpis.audit.upToDate ? t(locale, "yes") : t(locale, "no");
  const auditDays =
    !kpis.audit.upToDate && kpis.audit.daysSince != null
      ? `<span class="muted">${esc(String(kpis.audit.daysSince))} ${esc(t(locale, "days since"))}</span>`
      : "";
  const bars =
    kpis.pareto.length === 0
      ? `<p class="muted">${esc(t(locale, "No failed external tests yet."))}</p>`
      : kpis.pareto
          .map(
            (row) => `<div class="pareto-row" data-mode="${esc(row.mode)}">
        <span class="pareto-label">${esc(row.mode)}</span>
        <span class="pareto-track"><span class="pareto-bar" style="width:${row.pct}%"></span></span>
        <span class="pareto-pct">${esc(format2(row.pct))}%</span>
      </div>`
          )
          .join("");
  return `<h1>${esc(t(locale, "Compliance Console"))}</h1>
    <section class="kpi-pane">
    <span class="kpi-pane-label">${esc(t(locale, "Metrics"))}</span>
    <div class="kpi-tiles" data-compliance-kpis="1">
      <div class="kpi-tile" data-kpi="lbs">
        <span class="kpi-label">${esc(t(locale, "Lbs in testing"))}</span>
        <strong class="kpi-value">${esc(formatLbs(kpis.lbs.grams))} ${esc(t(locale, "lbs"))}</strong>
      </div>
      <div class="kpi-tile" data-kpi="pareto">
        <span class="kpi-label">${esc(t(locale, "Pareto of failure modes by %"))}</span>
        <div class="pareto-list">${bars}</div>
      </div>
      <div class="kpi-tile" data-kpi="ftq">
        <span class="kpi-label">${esc(t(locale, "FTQ rate"))}</span>
        <strong class="kpi-value">${esc(ftq)}</strong>
        <span class="muted">n=${esc(String(kpis.ftq.n))}</span>
      </div>
      <div class="kpi-tile kpi-audit ${auditClass}" data-kpi="audit">
        <span class="kpi-label">${esc(t(locale, "Internal Audits up-to-date"))}</span>
        <strong class="kpi-value">${esc(auditWord)}</strong>
        ${auditDays}
      </div>
    </div>
    </section>
    <div class="tiles">
      <a class="tile" href="/compliance/audits" data-compliance-key="audits">
        ${kind}
        <span class="tile-title">${esc(t(locale, "Audits"))}</span>
      </a>
      <a class="tile" href="/compliance/labels" data-compliance-key="labels">
        ${kind}
        <span class="tile-title">${esc(t(locale, "Labels"))}</span>
      </a>
      <a class="tile" href="/compliance/testing" data-compliance-key="testing">
        ${kind}
        <span class="tile-title">${esc(t(locale, "Compliance Testing"))}</span>
      </a>
      <a class="tile" href="/compliance/rad_schedule" data-compliance-key="rad_schedule">
        ${kind}
        <span class="tile-title">${esc(t(locale, "Rad Schedule"))}</span>
      </a>
      <a class="tile" href="/compliance/rad_operation" data-compliance-key="rad_operation">
        ${kind}
        <span class="tile-title">${esc(t(locale, "Rad Operation"))}</span>
      </a>
    </div>`;
}

export type AuditRow = {
  id: string;
  kind: string;
  agency: string | null;
  agency_contact: string | null;
  grip_rep: string | null;
  started_at: string;
  finished_at: string | null;
  note_count?: number;
};

export type AuditNoteRow = {
  id: string;
  audit_id: string;
  body: string;
  created_at: string;
};

export function auditsPage(
  kind: "internal" | "external",
  open: AuditRow[],
  finished: AuditRow[],
  picked: AuditRow | null,
  notes: AuditNoteRow[],
  actorName: string,
  rapidFocus: boolean,
  locale: Locale = "en"
): string {
  const tabs = tabBar(
    locale,
    [
      { href: "/compliance/audits?kind=internal", key: "internal", label: "Internal" },
      { href: "/compliance/audits?kind=external", key: "external", label: "External" },
    ],
    kind
  );
  const leftOpen = open
    .map(
      (a) =>
        `<a class="queue-pane-item${picked?.id === a.id ? " on" : ""}" href="/compliance/audits?kind=${kind}&audit=${esc(a.id)}">
          ${esc(a.agency || a.grip_rep || t(locale, "Open audit"))}
          <span class="muted">${esc(a.started_at.slice(0, 10))}</span>
        </a>`
    )
    .join("") || `<p class="muted">${esc(t(locale, "No open audits."))}</p>`;
  const finishedRows =
    finished.length === 0
      ? `<tr><td colspan="4">${esc(t(locale, "No finished audits."))}</td></tr>`
      : finished
          .map(
            (a) => `<tr>
        <td>${esc(a.finished_at?.slice(0, 10) ?? a.started_at.slice(0, 10))}</td>
        <td>${esc(a.grip_rep ?? "")}</td>
        <td>${esc(a.agency ?? "")}</td>
        <td>${esc(String(a.note_count ?? 0))}</td>
      </tr>`
          )
          .join("");
  const working = picked
    ? auditWorkingPane(kind, picked, notes, rapidFocus, locale)
    : kind === "internal"
      ? startInternalForm(actorName, locale)
      : startExternalForm(actorName, locale);
  return `<h1>${esc(t(locale, "Audits"))}</h1>
    ${tabs}
    <div class="station-split">
      <aside class="queue-pane">
        <h2>${esc(t(locale, "Open"))}</h2>
        ${leftOpen}
        <h2>${esc(t(locale, "Finished"))}</h2>
        <table class="data">
          <thead><tr><th>${esc(t(locale, "When"))}</th><th>${esc(t(locale, "Grip Rep"))}</th><th>${esc(t(locale, "Agency"))}</th><th>${esc(t(locale, "Notes"))}</th></tr></thead>
          <tbody>${finishedRows}</tbody>
        </table>
      </aside>
      <div class="working-pane">${working}</div>
    </div>`;
}

function startInternalForm(actorName: string, locale: Locale): string {
  return `<h2>${esc(t(locale, "Start internal audit"))}</h2>
    <form class="stack" method="post" action="/compliance/audits/start">
      <input type="hidden" name="kind" value="internal">
      ${fieldBlock(locale, "Grip Rep", `<input type="text" name="grip_rep" value="${esc(actorName)}" required>`, "Person riding the audit. Admin\\Data Lookups\\People and System\\People")}
      <button type="submit">${esc(t(locale, "Start audit"))}</button>
    </form>`;
}

function startExternalForm(actorName: string, locale: Locale): string {
  return `<h2>${esc(t(locale, "Start external audit"))}</h2>
    <form class="stack" method="post" action="/compliance/audits/start">
      <input type="hidden" name="kind" value="external">
      ${fieldBlock(locale, "Agency", `<input type="text" name="agency" required>`, "Visiting agency name on the Remediate pane.")}
      ${fieldBlock(locale, "Agency contact", `<input type="text" name="agency_contact">`, "Agency contact for the ride-along notes.")}
      ${fieldBlock(locale, "Grip Rep", `<input type="text" name="grip_rep" value="${esc(actorName)}" required>`, "Person riding the audit. Admin\\Data Lookups\\People and System\\People")}
      <button type="submit">${esc(t(locale, "Start audit"))}</button>
    </form>`;
}

function auditWorkingPane(
  kind: "internal" | "external",
  audit: AuditRow,
  notes: AuditNoteRow[],
  rapidFocus: boolean,
  locale: Locale
): string {
  const header =
    kind === "external"
      ? `<form class="stack" method="post" action="/compliance/audits/${esc(audit.id)}/header">
        ${fieldBlock(locale, "Agency", `<input type="text" name="agency" value="${esc(audit.agency ?? "")}" required>`, "Visiting agency name on the Remediate pane.")}
        ${fieldBlock(locale, "Agency contact", `<input type="text" name="agency_contact" value="${esc(audit.agency_contact ?? "")}">`, "Agency contact for the ride-along notes.")}
        ${fieldBlock(locale, "Grip Rep", `<input type="text" name="grip_rep" value="${esc(audit.grip_rep ?? "")}" required>`, "Person riding the audit. Admin\\Data Lookups\\People and System\\People")}
        <button type="submit">${esc(t(locale, "Save header"))}</button>
      </form>`
      : `<p class="muted">${esc(t(locale, "Grip Rep"))}: ${esc(audit.grip_rep ?? "")}</p>`;
  const noteRows = notes
    .map(
      (n) => `<li class="audit-note" data-note-id="${esc(n.id)}">
        <span>${esc(n.body)}</span>
        <span class="row-actions">
          ${pencilLink(`/record/audit_notes/${n.id}/edit`, locale, "Edit note")}
          ${voidLink(`/record/audit_notes/${n.id}/void`, locale, "Void note")}
        </span>
      </li>`
    )
    .join("");
  const focusAttr = rapidFocus ? " data-rapid-focus" : "";
  return `<div class="remediate-pane" data-audit-kind="${kind}">
      <h2>${esc(kind === "external" ? t(locale, "Ride along notes") : t(locale, "Internal notes"))}</h2>
      ${header}
      <form class="row-actions" method="post" action="/compliance/audits/${esc(audit.id)}/notes">
        <input type="text" name="body" required autofocus${focusAttr} placeholder="${esc(t(locale, "Note"))}">
        <button type="submit">${esc(t(locale, "Add note"))}</button>
        ${rapidAddButton(locale)}
      </form>
      <ul class="audit-notes">${noteRows || `<li class="muted">${esc(t(locale, "No notes yet."))}</li>`}</ul>
      <form method="post" action="/compliance/audits/${esc(audit.id)}/finish">
        <button type="submit">${esc(t(locale, "Finish"))}</button>
      </form>
      ${rapidFocusScript(rapidFocus)}
    </div>`;
}

export type ExternalTestRow = {
  id: string;
  license_number: string | null;
  med_au: string | null;
  strain: string | null;
  item_name: string | null;
  source_metrc_tag: string | null;
  batch_weight_grams: number | null;
  hbn: string | null;
  sample_tag: string | null;
  required_test: string | null;
  net_weight_grams: number | null;
  testing_facility: string | null;
  entered_testing: string | null;
  finished_testing: string | null;
  attempt: number;
  potency_result: number | null;
  finalized_potency: number | null;
  status: string | null;
  failure_mode: string | null;
  source?: string | null;
  on_sheet?: number | null;
};

/** The lab_compliance_samples fields the External tab shows (any typed row with
 * these columns fits). */
export type LabSampleListFields = {
  id?: unknown;
  license?: unknown;
  market?: unknown;
  strain?: unknown;
  item_name?: unknown;
  source_metrc_tag?: unknown;
  batch_weight_g?: unknown;
  harvest_batch?: unknown;
  sample_tag?: unknown;
  required_test?: unknown;
  net_weight_g?: unknown;
  testing_facility?: unknown;
  entered_testing_on?: unknown;
  finished_testing_on?: unknown;
  thc_potency_pct?: unknown;
  status?: unknown;
  fail_reason?: unknown;
};

const textOf = (v: unknown): string | null => (v == null ? null : String(v));
const numberOf = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

/** THE LAB STATION (canon 0.30.362). A compliance sample as an External tab
 * row: the status stays the station's word (shown through its label), the
 * attempt is labvocab's (2 for a retest status or a "Retest" required test,
 * else 1; BRIEF V25 law 1), source 'lab'. */
export function externalRowFromLab(r: LabSampleListFields): ExternalTestRow {
  const status = String(r.status ?? "");
  return {
    id: String(r.id),
    license_number: textOf(r.license),
    med_au: textOf(r.market),
    strain: textOf(r.strain),
    item_name: textOf(r.item_name),
    source_metrc_tag: textOf(r.source_metrc_tag),
    batch_weight_grams: numberOf(r.batch_weight_g),
    hbn: textOf(r.harvest_batch),
    sample_tag: textOf(r.sample_tag),
    required_test: textOf(r.required_test),
    net_weight_grams: numberOf(r.net_weight_g),
    testing_facility: textOf(r.testing_facility),
    entered_testing: textOf(r.entered_testing_on),
    finished_testing: textOf(r.finished_testing_on),
    attempt: labAttempt(status, textOf(r.required_test)),
    potency_result: numberOf(r.thc_potency_pct),
    finalized_potency: null,
    status,
    failure_mode: textOf(r.fail_reason),
    source: "lab",
  };
}

/** A station status word through the station's label (an i18n key); any other word as written. */
export function labStatusText(status: string | null, locale: Locale): string {
  const label = status == null ? undefined : (STATUS_LABELS as Record<string, string>)[status];
  return label ? t(locale, label) : String(status ?? "");
}

/** The External tab's Status filter: the station's seven statuses, the English
 * station word as the value and its label in the page's words. A word off the
 * list (an old saved link) stays offered and selected, so the filter shows why
 * the list is empty. */
function statusFilterSelect(current: string, locale: Locale): string {
  const known = (STATUSES as readonly string[]).includes(current);
  const options = STATUSES.map(
    (s) => `<option value="${esc(s)}"${s === current ? " selected" : ""}>${esc(t(locale, STATUS_LABELS[s]))}</option>`
  ).join("");
  const offList = current !== "" && !known ? `<option value="${esc(current)}" selected>${esc(current)}</option>` : "";
  return `<select name="status"><option value=""${current === "" ? " selected" : ""}></option>${options}${offList}</select>`;
}

export function testingPage(
  tab: "internal" | "external",
  rows: ExternalTestRow[],
  filters: { facility: string; status: string; year: string },
  locale: Locale = "en",
  parseFlash?: string,
  operator: string | null = null
): string {
  const tabs = tabBar(
    locale,
    [
      { href: "/compliance/testing?tab=internal", key: "internal", label: "Internal" },
      { href: "/compliance/testing?tab=external", key: "external", label: "External" },
    ],
    tab
  );
  const flash = parseFlash ? `<p class="banner ok">${esc(parseFlash)}</p>` : "";
  if (tab === "internal") {
    return `<h1>${esc(t(locale, "Compliance Testing"))}</h1>
      ${tabs}
      ${flash}
      ${labStationBody(locale, operator)}`;
  }
  const body =
    rows.length === 0
      ? `<tr><td colspan="8">${esc(t(locale, "No external results."))}</td></tr>`
      : rows
          .map(
            (r) => `<tr>
        <td>${esc(r.sample_tag ?? "")}</td>
        <td>${esc(r.item_name ?? "")}</td>
        <td>${esc(r.testing_facility ?? "")}</td>
        <td>${esc(String(r.attempt))}</td>
        <td>${esc(labStatusText(r.status, locale))}${
          r.source === "sheet" && Number(r.on_sheet) === 0 ? ` <span class="muted" data-on-sheet="0">${esc(t(locale, "no longer on the sheet"))}</span>` : ""
        }</td>
        <td>${esc(r.failure_mode ?? "")}</td>
        <td>${r.net_weight_grams == null ? "" : esc(formatGrams(r.net_weight_grams))}</td>
        <td class="row-actions">${r.source === "lab" ? "" : pencilLink(`/record/external_test_results/${r.id}/edit`, locale, "Edit result")}</td>
      </tr>`
          )
          .join("");
  return `<h1>${esc(t(locale, "Compliance Testing"))}</h1>
    ${tabs}
    <form class="stack report-filters" method="get" action="/compliance/testing">
      <input type="hidden" name="tab" value="external">
      <label class="field">${esc(t(locale, "Facility"))} <input type="text" name="facility" value="${esc(filters.facility)}"></label>
      <label class="field">${esc(t(locale, "Status"))} ${statusFilterSelect(filters.status, locale)}</label>
      <label class="field">${esc(t(locale, "Year"))} <input type="text" name="year" value="${esc(filters.year)}"></label>
      <button type="submit">${esc(t(locale, "Apply filters"))}</button>
    </form>
    <div class="report-scroll"><table class="data">
      <thead><tr>
        <th>${esc(t(locale, "Sample Tag"))}</th>
        <th>${esc(t(locale, "Item Name"))}</th>
        <th>${esc(t(locale, "Testing Facility"))}</th>
        <th>${esc(t(locale, "Attempt"))}</th>
        <th>${esc(t(locale, "Status"))}</th>
        <th>${esc(t(locale, "Failure mode"))}</th>
        <th>${esc(t(locale, "Net Weight"))}</th>
        <th></th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    <p class="muted" data-lab-station-pointer>${esc(t(locale, "Compliance samples are entered at the lab station, on the Internal tab."))} <a href="/compliance/testing?tab=internal">${esc(t(locale, "Open the lab station"))}</a></p>`;
}
