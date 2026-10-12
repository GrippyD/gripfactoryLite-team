/**
 * Reports node. Five reports, three format lanes, zero new dependencies.
 * TAT metric definitions are provisional (Scribe-derived from the pipeline).
 */

import { dayAfter, dayBefore, etInstant, etWallClock, isCalendarDate } from "./farmday";
import { formatLbs, gramsToLbs, isPotencyAnalyte } from "./compliance";
import { formatGrams, ITEM_KIND_WET_TOTAL, round2, roundGrams } from "./config";
import { t, tFill, type Locale } from "./i18n";
import { agedDays } from "./marketplace";
import { buildXlsx, type XlsxCell, type XlsxSheet } from "./xlsx";

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// THE HARVEST CONSOLE (canon 0.30.73). Owner ruling 2026-09-15, verbatim:
// "Let's strike the dashboard.  Remove it from the report list." The Harvest
// Dashboard (0.30.6x) is gone from here; its laws live on at /harvest.
export const REPORT_KEYS = [
  "inventory",
  "inventory_by_location",
  "sales_orders",
  "tats",
  "harvests",
  "product_mix",
  "external_audits",
  "rf",
  "internal_testing",
  "labor_hours",
  "line_packages",
  "post_harvest_puzzles",
  "floor_vs_metrc",
  "dry_weight_by_strain",
  "environment_history",
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export function isReportKey(value: string): value is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value);
}

export const TAT_METRICS = [
  {
    key: "field_to_wet",
    label: "Field to wet",
    definition: "Batch entry date to the lot's finish (weighing to drying or in transit).",
  },
  {
    key: "dry_dwell",
    label: "Dry dwell",
    definition: "Lot finish to unload finish (drying to unloaded).",
  },
  {
    key: "unload_to_trim",
    label: "Unload to trim",
    definition: "Unload finish to the lot's first trim package created.",
  },
  {
    key: "trim_to_cryo",
    label: "Trim to cryo",
    definition: "Package created to cryo weight set (cryo queue to testing queue).",
  },
  {
    key: "cryo_to_release",
    label: "Cryo to release",
    definition: "Cryo weight set to testing release.",
  },
] as const;

export type TatMetricKey = (typeof TAT_METRICS)[number]["key"];

export function tatMetricByKey(key: string) {
  return TAT_METRICS.find((m) => m.key === key);
}

export const TAT_LINES = ["farm", "strain", "grow_method"] as const;
export type TatLine = (typeof TAT_LINES)[number];

export type StatusLogRow = {
  record_table: string;
  record_id: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  changed_at: string;
};

/** Exclude demoted status rows exactly like the demote resolver. */
export function statusLogsForSpans<T extends StatusLogRow>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.reason !== "demoted");
}

export function daysBetween(startIso: string, endIso: string): number {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return round2((end - start) / 86_400_000);
}

export function medianDays(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return round2((sorted[mid - 1] + sorted[mid]) / 2);
}

export type TatAggRow = {
  line: string;
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
};

export function aggregateTatDays(groups: Map<string, number[]>): TatAggRow[] {
  const rows: TatAggRow[] = [];
  for (const [line, values] of groups) {
    if (values.length === 0) continue;
    const sum = values.reduce((a, b) => a + b, 0);
    rows.push({
      line,
      count: values.length,
      mean: round2(sum / values.length),
      median: medianDays(values),
      min: round2(Math.min(...values)),
      max: round2(Math.max(...values)),
    });
  }
  rows.sort((a, b) => a.line.localeCompare(b.line));
  return rows;
}

export type ReportColumn = {
  key: string;
  label: string;
  grams?: boolean;
  /** The row value is grams. Rendered as pounds at 448, two decimals. */
  lbs?: boolean;
};

export type ReportView = {
  key: ReportKey;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  footnote?: string;
  empty?: string;
  reserved?: boolean;
  /** Canon 0.30.23: the column whose value heads each run of rows on the page
   * and the PDF (rendered as a header row, hidden from the row cells); the
   * CSV and XLSX keep it as a plain column. Rows must arrive sorted by it. */
  groupBy?: string;
  /** A line under the title. Line packages states its window here, and the
   * CSV, XLSX and PDF carry the same line. */
  heading?: string;
};

/** The column list a table body renders: hidden keys and the group column out. */
export function bodyColumns(view: ReportView): ReportColumn[] {
  return view.columns.filter((c) => !c.key.startsWith("_") && c.key !== view.groupBy);
}

/** The grouped table body shared by the page and the PDF: a header row every
 * time the group value changes, then the row cells without the group column. */
export function groupedRowsHtml(
  view: ReportView,
  cellHtml: (column: ReportColumn, row: Record<string, string | number>) => string,
  rowExtra: (row: Record<string, string | number>, colspan: number) => string = () => ""
): string {
  const cols = bodyColumns(view);
  let lastGroup: string | null = null;
  return view.rows
    .map((row) => {
      let header = "";
      if (view.groupBy) {
        const group = String(row[view.groupBy] ?? "");
        if (group !== lastGroup) {
          header = `<tr class="report-group" data-report-group="${esc(group)}"><th colspan="${cols.length}">${esc(group || "(unassigned)")}</th></tr>`;
          lastGroup = group;
        }
      }
      const cells = cols.map((c) => cellHtml(c, row)).join("");
      const total = row._total === 1 || row._total === "1";
      return `${header}<tr${total ? ' class="report-total"' : ""}>${cells}</tr>${rowExtra(row, cols.length)}`;
    })
    .join("");
}

export function reportFileStamp(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

/** A cell as a person reads it: grams grouped, pounds at 448 with two decimals. */
export function reportCellText(column: ReportColumn, raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "";
  if (column.grams) return formatGrams(raw);
  if (column.lbs) return formatLbs(Number(raw));
  return String(raw);
}

export function reportCsv(view: ReportView): string {
  const lines: string[] = [];
  if (view.heading) lines.push(csvCell(view.heading));
  lines.push(view.columns.map((c) => c.label).join(","));
  for (const row of view.rows) {
    lines.push(
      view.columns
        .map((c) => {
          if (c.key.startsWith("_")) return "";
          return csvCell(reportCellText(c, row[c.key] as string | number | null | undefined));
        })
        .join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

export function reportXlsx(view: ReportView): Uint8Array {
  const gramColumns = view.columns.map((c, i) => (c.grams ? i : -1)).filter((i) => i >= 0);
  const sheet: XlsxSheet = {
    headers: view.columns.map((c) => c.label),
    gramColumns,
    rows: view.rows.map((row) =>
      view.columns.map((c): XlsxCell => {
        const raw = row[c.key];
        if (c.key.startsWith("_")) return { text: "" };
        if (c.grams && raw != null && raw !== "") {
          return { number: roundGrams(Number(raw)), grams: true };
        }
        if (c.lbs && raw != null && raw !== "") {
          return { number: gramsToLbs(Number(raw)), lbs: true };
        }
        return { text: String(raw ?? "") };
      })
    ),
  };
  return buildXlsx({ ...sheet, banner: view.heading });
}

export function reportPdfHtml(
  view: ReportView,
  filterSummary: string,
  siteName: string,
  stamped: string,
  locale: Locale = "en"
): string {
  const cols = bodyColumns(view);
  const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join("");
  const body =
    view.rows.length === 0
      ? `<tr><td colspan="${cols.length}">${esc(view.empty ?? t(locale, "No rows."))}</td></tr>`
      : groupedRowsHtml(view, (c, row) => {
          const raw = row[c.key];
          const shown = reportCellText(c, raw as string | number | null | undefined);
          return `<td>${esc(shown)}</td>`;
        });
  const footnote = view.footnote ? `<p class="muted">${esc(view.footnote)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <title>${esc(t(locale, view.title))}</title>
  <style>
    body { font-family: Georgia, serif; margin: 1.5rem; color: #1a1a1a; }
    h1 { font-size: 1.4rem; margin: 0 0 0.4rem; }
    .filters { color: #444; margin: 0 0 1rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #bbb; padding: 0.35rem 0.5rem; text-align: left; }
    th { font-weight: 700; }
    tr.report-group th { background: #eee; text-align: left; font-size: 1.05rem; letter-spacing: 0.04em; }
    tr.report-total td { font-weight: 700; border-top: 2px solid #1a1a1a; }
    .muted { color: #555; font-size: 0.9rem; }
    footer { margin-top: 1.2rem; font-size: 0.85rem; color: #555; }
    .print-bar { margin: 0 0 1rem; }
    @media print { .print-bar { display: none; } }
  </style>
</head>
<body data-report-print="1">
  <div class="print-bar">
    <button type="button" onclick="window.print()">${esc(t(locale, "Print or save as PDF"))}</button>
  </div>
  <h1>${esc(t(locale, view.title))}</h1>
  ${view.heading ? `<p class="report-window">${esc(view.heading)}</p>` : ""}
  <p class="filters">${esc(filterSummary)}</p>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  ${footnote}
  <footer>${esc(siteName)} · ${esc(stamped)}</footer>
  <script>window.addEventListener("load", function () { window.print(); });</script>
</body>
</html>`;
}

export const REPORT_CARDS: Array<{ key: ReportKey; title: string; blurb: string }> = [
  { key: "inventory", title: "Inventory", blurb: "The local ledger: kind, package, strain, qty, farm, location." },
  {
    key: "inventory_by_location",
    title: "Inventory by Location",
    blurb: "Product-type totals, grouped by location, grouped by farm. Empty spots stay hidden.",
  },
  {
    key: "sales_orders",
    title: "Sales Order Status",
    blurb: "Sales orders from the Marketplace node: number, buyer, lines, status, age.",
  },
  { key: "tats", title: "TATs", blurb: "Turnaround times by metric, line, and period." },
  { key: "harvests", title: "Harvests by year", blurb: "Batches, lots finished, wet grams, dry grams." },
  { key: "product_mix", title: "Product Mix by weight", blurb: "Package types for a harvest year, by weight." },
  {
    key: "external_audits",
    title: "External Audits",
    blurb: "Finished external audits and their ride-along notes.",
  },
  {
    key: "rf",
    title: "RF report",
    blurb: "Reserved. The Scribe holds a question on what RF names.",
  },
  {
    key: "internal_testing",
    title: "Internal testing",
    blurb: "HBN, harvest date, testing date, aW results, potency results.",
  },
  {
    key: "labor_hours",
    title: "Labor hours",
    blurb: "Every hour and input lb typed on the console, by date and operation.",
  },
  {
    key: "line_packages",
    title: "Line packages",
    blurb: "Every package a line put out on a day: Trim, Prepack, Cryo/Rad; the day read from its start time.",
  },
  {
    key: "post_harvest_puzzles",
    title: "Post Harvest Puzzles",
    blurb: "One row per strain for a harvest year: the 2025 history from the workbook, later years from the lots.",
  },
  {
    key: "floor_vs_metrc",
    title: "Floor vs METRC",
    blurb: "The floor's packages beside the METRC mirror, by tag and by lot.",
  },
  {
    key: "dry_weight_by_strain",
    title: "Dry Weight by Strain",
    blurb: "Lots unloaded in a date range, one row per strain: wet, dry, dry per plant; by grow method and farm.",
  },
  {
    key: "environment_history",
    title: "Environment history",
    blurb: "Hourly temperature and humidity by room, one line per unit, kept after the raw readings age out.",
  },
];

export function salesOrdersEmptyCopy(): string {
  return "No sales orders yet. Marketplace is the receiver for this data.";
}

export function inventoryFgEmptyCopy(): string {
  return "No FG rows in the local ledger yet. The Zoho FG surface stays on the Inventory node.";
}

export function tatFootnote(): string {
  return TAT_METRICS.map((m) => `${m.label}: ${m.definition}`).join(" ");
}

/** The last 30 farm days ending today, inclusive. */
export function laborHoursDefaultWindow(today: string): { from: string; to: string } {
  let from = today;
  for (let i = 0; i < 29; i++) from = dayBefore(from);
  return { from, to: today };
}

export type LaborHourRow = {
  work_date: string;
  operation: string;
  value: number;
  unit: string;
  updated_at: string;
};

export function laborHoursView(rows: LaborHourRow[]): ReportView {
  return {
    key: "labor_hours",
    title: "Labor hours",
    columns: [
      { key: "date", label: "Date" },
      { key: "operation", label: "Operation" },
      { key: "value", label: "Value" },
      { key: "unit", label: "Unit" },
      { key: "updated", label: "Updated" },
    ],
    rows: rows.map((row) => ({
      date: row.work_date,
      operation: row.operation,
      value: Number(row.value),
      unit: row.unit,
      updated: row.updated_at,
    })),
    empty: "No hours in this window.",
  };
}

export type TatPeriod = { year?: number; from?: string; to?: string };

function lineValue(
  row: {
    farm_code: string | null;
    strain_name: string | null;
    grow_method_code: string | null;
  },
  line: TatLine
): string {
  if (line === "farm") return row.farm_code ?? "";
  if (line === "strain") return row.strain_name ?? "";
  return row.grow_method_code ?? "";
}

function inPeriod(endIso: string, period: TatPeriod): boolean {
  const day = endIso.slice(0, 10);
  if (period.year != null) return day.startsWith(String(period.year));
  if (period.from && day < period.from) return false;
  if (period.to && day > period.to) return false;
  return true;
}

export type TatSourceRow = {
  record_table: string;
  record_id: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  changed_at: string;
  farm_code: string | null;
  strain_name: string | null;
  grow_method_code: string | null;
  harvest_batch_id: string | null;
  wet_weight_entry_id: string | null;
  entry_date: string | null;
  package_created_at: string | null;
};

/** Build TAT day lists by line, excluding demoted status rows. */
export function computeTatGroups(
  rows: readonly TatSourceRow[],
  metric: TatMetricKey,
  line: TatLine,
  period: TatPeriod
): Map<string, number[]> {
  const logs = statusLogsForSpans(rows);
  const groups = new Map<string, number[]>();
  const push = (key: string, start: string, end: string) => {
    if (!start || !end || !inPeriod(end, period)) return;
    const days = daysBetween(start.length === 10 ? `${start}T00:00:00.000Z` : start, end);
    const list = groups.get(key) ?? [];
    list.push(days);
    groups.set(key, list);
  };
  if (metric === "field_to_wet") {
    for (const row of logs) {
      if (row.record_table !== "wet_weight_entries") continue;
      if (row.new_value !== "drying" && row.new_value !== "in_transit") continue;
      push(lineValue(row, line), row.entry_date ?? "", row.changed_at);
    }
    return groups;
  }
  if (metric === "dry_dwell") {
    const startByLot = new Map<string, string>();
    for (const row of logs) {
      if (row.record_table !== "wet_weight_entries") continue;
      if (row.new_value === "drying") startByLot.set(row.record_id, row.changed_at);
      if (row.new_value === "unloaded") {
        const start = startByLot.get(row.record_id);
        if (start) push(lineValue(row, line), start, row.changed_at);
      }
    }
    return groups;
  }
  if (metric === "unload_to_trim") {
    const unloadByLot = new Map<string, TatSourceRow>();
    for (const row of logs) {
      if (row.record_table === "wet_weight_entries" && row.new_value === "unloaded") {
        unloadByLot.set(row.record_id, row);
      }
    }
    const firstPkg = new Map<string, TatSourceRow>();
    for (const row of logs) {
      if (row.record_table !== "wip_packages" || !row.wet_weight_entry_id) continue;
      if (row.old_value != null) continue;
      const prev = firstPkg.get(row.wet_weight_entry_id);
      if (!prev || row.changed_at < prev.changed_at) firstPkg.set(row.wet_weight_entry_id, row);
    }
    for (const [lotId, unload] of unloadByLot) {
      const pkg = firstPkg.get(lotId);
      if (pkg) push(lineValue(unload, line), unload.changed_at, pkg.package_created_at ?? pkg.changed_at);
    }
    return groups;
  }
  if (metric === "trim_to_cryo") {
    for (const row of logs) {
      if (row.record_table !== "wip_packages") continue;
      if (row.new_value !== "testing_queue") continue;
      const start = row.package_created_at ?? "";
      push(lineValue(row, line), start, row.changed_at);
    }
    return groups;
  }
  for (const row of logs) {
    if (row.record_table !== "wip_packages") continue;
    if (row.new_value !== "released") continue;
    const startLogs = logs.filter(
      (l) => l.record_id === row.record_id && l.new_value === "testing_queue"
    );
    const start = startLogs.sort((a, b) => a.changed_at.localeCompare(b.changed_at))[0];
    if (start) push(lineValue(row, line), start.changed_at, row.changed_at);
  }
  return groups;
}

/** Owner ruling 2026-09-06 (canon 0.27.0), verbatim: "Just make it totals be
 * product type, grouped by location grouped by farm. Field locations,
 * greenhouses, and barn should be visible only if there's material in them."
 * The query hides material-less locations; the rows read farm, location, kind,
 * total, so the grouping is the row order in every format. */
/** Owner ruling 2026-09-09 (canon 0.30.23, verbatim: "the origin farm is
 * listed as farm in the report.  The current farm should be the header the
 * list is sitting under.  I'm good with the farm of origin on the report"):
 * the site the material sits at heads each run of rows; the origin farm rides
 * as a column. The CSV and XLSX carry Site as their first column. */
export function inventoryByLocationView(
  rows: Array<{ site: string; farm: string; location: string; item_kind: string; uom: string; total: number }>
): ReportView {
  return {
    key: "inventory_by_location",
    title: "Inventory by Location",
    groupBy: "site",
    columns: [
      { key: "site", label: "Site" },
      { key: "location", label: "Location" },
      { key: "farm", label: "Origin farm" },
      { key: "kind", label: "Product type" },
      { key: "total", label: "Total", grams: true },
      { key: "uom", label: "UOM" },
    ],
    rows: rows.map((r) => ({
      site: r.site || "(unassigned)",
      location: r.location,
      // Canon 0.30.69: the Wet total row under a silo carries no origin farm on purpose.
      farm: r.item_kind === ITEM_KIND_WET_TOTAL ? "" : r.farm || "(unassigned)",
      kind: r.item_kind,
      total: r.total,
      uom: r.uom,
    })),
    footnote:
      "Locations show only while material sits in them. Site is where it sits now; origin farm is where it came from. A lot still weighing into a silo reads under that silo as it fills; every silo closes with its Wet total row.",
    empty: "No material anywhere. The floor is clean.",
  };
}

export function inventoryReportView(
  rows: Array<{
    item_kind: string;
    package_code: string;
    strain_name: string | null;
    qty: number;
    uom: string;
    farm_code: string;
    location: string;
    location_label?: string | null;
  }>,
  hasFg: boolean
): ReportView {
  return {
    key: "inventory",
    title: "Inventory",
    columns: [
      { key: "kind", label: "Kind" },
      { key: "package_code", label: "Package code" },
      { key: "strain", label: "Strain" },
      { key: "qty", label: "Quantity", grams: true },
      { key: "uom", label: "UOM" },
      { key: "farm", label: "Farm" },
      { key: "location", label: "Location" },
    ],
    rows: rows.map((r) => ({
      kind: r.item_kind,
      package_code: r.package_code,
      strain: r.strain_name ?? "",
      qty: r.qty,
      uom: r.uom,
      farm: r.farm_code,
      location: r.location_label ?? r.location,
    })),
    footnote: hasFg ? undefined : inventoryFgEmptyCopy(),
  };
}

export function salesOrdersView(
  rows: Array<{
    so_number: string;
    buyer: string;
    lines_label: string;
    qty_grams: number;
    status: string;
    aged_days: number;
  }>
): ReportView {
  return {
    key: "sales_orders",
    title: "Sales Order Status",
    columns: [
      { key: "so_number", label: "SO number" },
      { key: "buyer", label: "Buyer" },
      { key: "lines", label: "Lines" },
      { key: "qty", label: "Quantity", grams: true },
      { key: "uom", label: "UOM" },
      { key: "status", label: "Status" },
      { key: "aged_days", label: "Aged days" },
    ],
    rows: rows.map((r) => ({
      so_number: r.so_number,
      buyer: r.buyer,
      lines: r.lines_label,
      qty: r.qty_grams,
      uom: "g",
      status: r.status,
      aged_days: r.aged_days,
    })),
    empty: salesOrdersEmptyCopy(),
  };
}

export function rfReportView(): ReportView {
  return {
    key: "rf",
    title: "RF report",
    columns: [{ key: "note", label: "Status" }],
    rows: [],
    empty: "RF report: reserved. The Scribe holds a question on what RF names.",
    reserved: true,
  };
}

export function externalAuditsView(
  rows: Array<{
    agency: string | null;
    agency_contact: string | null;
    grip_rep: string | null;
    started_at: string;
    finished_at: string | null;
    note_count: number;
    notes: string;
  }>
): ReportView {
  return {
    key: "external_audits",
    title: "External Audits",
    columns: [
      { key: "agency", label: "Agency" },
      { key: "contact", label: "Agency contact" },
      { key: "grip_rep", label: "Grip Rep" },
      { key: "started", label: "Started" },
      { key: "finished", label: "Finished" },
      { key: "note_count", label: "Note count" },
      { key: "notes", label: "Notes" },
    ],
    rows: rows.map((r) => ({
      agency: r.agency ?? "",
      contact: r.agency_contact ?? "",
      grip_rep: r.grip_rep ?? "",
      started: r.started_at,
      finished: r.finished_at ?? "",
      note_count: r.note_count,
      notes: r.notes,
      _detail: r.notes,
    })),
    empty: "No finished external audits.",
  };
}

export function collapseInternalTesting(
  raw: Array<{
    hbn: string | null;
    source: string;
    analyte: string;
    value: number;
    tested_at: string;
    created_at: string;
    entry_date: string | null;
    strain_name?: string | null;
  }>
): Array<{ hbn: string; harvest_date: string; testing_date: string; aw: string; potency: string }> {
  const byHbn = new Map<string, typeof raw>();
  for (const row of raw) {
    const hbn = (row.hbn ?? "").trim();
    if (!hbn) continue;
    const list = byHbn.get(hbn) ?? [];
    list.push(row);
    byHbn.set(hbn, list);
  }
  const out: Array<{ hbn: string; harvest_date: string; testing_date: string; aw: string; potency: string }> = [];
  for (const [hbn, rows] of byHbn) {
    const newest = (pred: (r: (typeof raw)[number]) => boolean) => {
      const hits = rows.filter(pred);
      hits.sort((a, b) => String(b.tested_at).localeCompare(String(a.tested_at)) || String(b.created_at).localeCompare(String(a.created_at)));
      return hits[0] ?? null;
    };
    const aw = newest((r) => r.source === "aqualab" && r.analyte === "water_activity");
    const potency = newest((r) => r.source === "orange_photonics" && isPotencyAnalyte(r.analyte));
    out.push({
      hbn,
      harvest_date: rows.find((r) => r.entry_date)?.entry_date ?? "",
      testing_date: aw?.tested_at ?? potency?.tested_at ?? "",
      aw: aw ? String(aw.value) : "",
      potency: potency ? String(potency.value) : "",
    });
  }
  out.sort((a, b) => a.hbn.localeCompare(b.hbn));
  return out;
}

export function salesOrderReportRows(
  orders: Array<{
    so_number: string;
    buyer: string;
    status: string;
    created_at: string;
    lines_label: string | null;
    qty_grams?: number;
  }>,
  now = new Date()
): Array<{ so_number: string; buyer: string; lines_label: string; qty_grams: number; status: string; aged_days: number }> {
  return orders.map((o) => ({
    so_number: o.so_number,
    buyer: o.buyer,
    lines_label: o.lines_label ?? "",
    qty_grams: Number(o.qty_grams ?? 0),
    status: o.status,
    aged_days: agedDays(o.created_at, now),
  }));
}

export function internalTestingView(
  rows: Array<{
    hbn: string;
    harvest_date: string;
    testing_date: string;
    aw: string;
    potency: string;
  }>
): ReportView {
  return {
    key: "internal_testing",
    title: "Internal testing",
    columns: [
      { key: "hbn", label: "HBN" },
      { key: "harvest_date", label: "Harvest Date" },
      { key: "testing_date", label: "Testing Date" },
      { key: "aw", label: "aW results" },
      { key: "potency", label: "Potency Results" },
    ],
    rows,
    empty: "No internal testing rows.",
  };
}

export function tatsView(agg: TatAggRow[]): ReportView {
  return {
    key: "tats",
    title: "TATs",
    columns: [
      { key: "line", label: "Line" },
      { key: "count", label: "Count" },
      { key: "mean", label: "Mean days" },
      { key: "median", label: "Median days" },
      { key: "min", label: "Min days" },
      { key: "max", label: "Max days" },
    ],
    rows: agg.map((r) => ({
      line: r.line,
      count: r.count,
      mean: r.mean,
      median: r.median,
      min: r.min,
      max: r.max,
    })),
    footnote: tatFootnote(),
  };
}

export function harvestsView(
  rows: Array<{ harvest_year: number; batches: number; lots_finished: number; wet_grams: number; dry_grams: number }>
): ReportView {
  return {
    key: "harvests",
    title: "Harvests by year",
    columns: [
      { key: "harvest_year", label: "Harvest year" },
      { key: "batches", label: "Batches" },
      { key: "lots_finished", label: "Lots finished" },
      { key: "wet_grams", label: "Wet grams", grams: true },
      { key: "dry_grams", label: "Dry grams", grams: true },
    ],
    rows: rows.map((r) => ({
      harvest_year: r.harvest_year,
      batches: r.batches,
      lots_finished: r.lots_finished,
      wet_grams: r.wet_grams,
      dry_grams: r.dry_grams,
    })),
  };
}

const LINE_PACKAGE_ORDER = ["Trim", "Prepack", "Cryo", "Rad"] as const;

const LINE_PACKAGE_COLUMNS: ReportColumn[] = [
  { key: "line", label: "Line" },
  { key: "entered", label: "Entered" },
  { key: "lot", label: "Lot" },
  { key: "tag", label: "Package tag" },
  { key: "harvest", label: "Harvest package" },
  { key: "type", label: "Type" },
  { key: "grams", label: "Weight (g)", grams: true },
  { key: "lbs", label: "Weight (lb)", lbs: true },
  { key: "effective", label: "Effective date" },
  { key: "operator", label: "Operator" },
];

/** LINE PACKAGES, A DATE RANGE (canon 0.30.398). Longer than this many inclusive days is refused. */
export const LINE_PACKAGES_MAX_DAYS = 92;
export const LINE_PACKAGES_TOO_LONG = "Pick 92 days or fewer.";
export const LINE_PACKAGES_NOT_A_DATE = "That is not a date.";
export const LINE_PACKAGES_SWAPPED = "To was before From, so the report swapped them.";
export const LINE_PACKAGES_NO_HARVEST = "No harvest package ends in {text}. Type all six characters.";

export type LinePackageRangeInput = {
  from: string | null;
  to: string | null;
  date: string | null;
  start: string | null;
  today: string;
  fallbackStart: string;
};

export type LinePackageRange =
  | {
      ok: true;
      from: string;
      to: string;
      start: string;
      startIso: string;
      endIso: string;
      swapped: boolean;
      startWarned: boolean;
    }
  | { ok: false; message: typeof LINE_PACKAGES_TOO_LONG | typeof LINE_PACKAGES_NOT_A_DATE };

function blankDate(value: string | null): boolean {
  return value == null || value.trim() === "";
}

/** Inclusive calendar days from From through To. YYYY-MM-DD, so a daylight saving day still counts as one. */
function inclusiveCalendarDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

/** The window is [From at the start time, the day after To at the start time).
 * From equal to To is that one day. A bare date= with no from or to is From = To.
 * To before From swaps. A range past 92 days, or a value that is not a date, is refused. */
export function resolveLinePackageRange(input: LinePackageRangeInput): LinePackageRange {
  let fromDay: string;
  let toDay: string;
  if (blankDate(input.from) && blankDate(input.to)) {
    const legacy = (input.date ?? "").trim();
    if (legacy) {
      if (!isCalendarDate(legacy)) return { ok: false, message: LINE_PACKAGES_NOT_A_DATE };
      fromDay = legacy;
      toDay = legacy;
    } else if (!isCalendarDate(input.today)) {
      return { ok: false, message: LINE_PACKAGES_NOT_A_DATE };
    } else {
      fromDay = input.today;
      toDay = input.today;
    }
  } else {
    fromDay = blankDate(input.from) ? input.today.trim() : (input.from ?? "").trim();
    toDay = blankDate(input.to) ? input.today.trim() : (input.to ?? "").trim();
    if (!isCalendarDate(fromDay) || !isCalendarDate(toDay)) return { ok: false, message: LINE_PACKAGES_NOT_A_DATE };
  }
  let swapped = false;
  if (toDay < fromDay) {
    const hold = fromDay;
    fromDay = toDay;
    toDay = hold;
    swapped = true;
  }
  if (inclusiveCalendarDays(fromDay, toDay) > LINE_PACKAGES_MAX_DAYS) {
    return { ok: false, message: LINE_PACKAGES_TOO_LONG };
  }
  const typed = (input.start ?? "").trim();
  const startOk = /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(typed);
  const start = startOk ? typed : input.fallbackStart;
  return {
    ok: true,
    from: fromDay,
    to: toDay,
    start,
    startIso: etInstant(fromDay, start),
    endIso: etInstant(dayAfter(toDay), start),
    swapped,
    startWarned: typed !== "" && !startOk,
  };
}

export type LinePackageInput = {
  line: string;
  enteredIso: string;
  lot: string;
  tag: string;
  type: string;
  grams: number;
  effective: string;
  operator: string;
  harvestLast6?: string;
};

/** A refused range: the words, and no rows. The caller has not run the query. */
export function linePackagesRefused(message: string): ReportView {
  return {
    key: "line_packages",
    title: "Line packages",
    columns: LINE_PACKAGE_COLUMNS,
    rows: [],
    empty: message,
    heading: message,
  };
}

/** THE LINE PACKAGES REPORT (canon 0.30.344, 0.30.398, 0.30.403). Totals ride the footnote and a _total row the page hides.
 * The heading is the window, From's start time through the day after To at that time.
 * A typed last 6 keeps the rows whose harvest package last 6 is those six characters. */
export function linePackagesView(
  rows: LinePackageInput[],
  opts: {
    budCodes: readonly string[];
    startWarned: boolean;
    startUsed: string;
    locale?: Locale;
    swapped?: boolean;
    windowStartIso?: string;
    windowEndIso?: string;
    harvestLast6?: string;
  }
): ReportView {
  const order = new Map<string, number>(LINE_PACKAGE_ORDER.map((line, index) => [line, index]));
  const sorted = [...rows].sort(
    (a, b) => (order.get(a.line) ?? 9) - (order.get(b.line) ?? 9) || a.enteredIso.localeCompare(b.enteredIso) || a.tag.localeCompare(b.tag)
  );
  const locale = opts.locale ?? "en";
  const harvestText = (opts.harvestLast6 ?? "").trim();
  const bud = new Set(opts.budCodes.map((code) => code.toUpperCase()));
  const body: ReportView["rows"] = [];
  const notes: string[] = [];
  if (opts.swapped) notes.push(t(locale, LINE_PACKAGES_SWAPPED));
  if (opts.startWarned) notes.push(tFill(locale, "Date start was not HH:MM, so the report used {start}.", { start: opts.startUsed }));
  const heading =
    opts.windowStartIso && opts.windowEndIso
      ? tFill(locale, "{start} to {end}, Eastern", {
          start: etWallClock(opts.windowStartIso),
          end: etWallClock(opts.windowEndIso),
        })
      : undefined;
  for (const line of LINE_PACKAGE_ORDER) {
    const group = sorted.filter((row) => row.line === line);
    if (group.length === 0) continue;
    for (const row of group) {
      body.push({
        line,
        entered: etWallClock(row.enteredIso),
        lot: row.lot,
        tag: row.tag,
        harvest: row.harvestLast6 ?? "",
        type: row.type,
        grams: row.grams,
        lbs: row.grams,
        effective: row.effective,
        operator: row.operator,
      });
    }
    const grams = group.reduce((sum, row) => sum + row.grams, 0);
    let sentence = tFill(locale, "{line}: {n} packages, {g} g ({lb} lb)", {
      line: t(locale, line),
      n: String(group.length),
      g: formatGrams(grams),
      lb: formatLbs(grams),
    });
    if (line === "Trim") {
      const of = (code: string) => group.filter((row) => row.type.toUpperCase() === code).reduce((sum, row) => sum + row.grams, 0);
      const budGrams = group.filter((row) => bud.has(row.type.toUpperCase())).reduce((sum, row) => sum + row.grams, 0);
      const pct = grams === 0 ? "0.0" : ((budGrams / grams) * 100).toFixed(1);
      sentence += "; " + tFill(locale, "TRIM {trim} g, BUD {bud} g, SMALLS {smalls} g, SHAKE {shake} g, WASTE {waste} g; bud {pct}% by the console's law", {
        trim: formatGrams(of("TRIM")),
        bud: formatGrams(of("BUD")),
        smalls: formatGrams(of("SMALLS")),
        shake: formatGrams(of("SHAKE")),
        waste: formatGrams(of("WASTE")),
        pct,
      });
    }
    notes.push(sentence);
    body.push({ line, entered: sentence, lot: "", tag: "", harvest: "", type: "", grams: "", lbs: "", effective: "", operator: "", _total: "1" });
  }
  return {
    key: "line_packages",
    title: "Line packages",
    columns: LINE_PACKAGE_COLUMNS,
    rows: body,
    groupBy: "line",
    empty:
      rows.length === 0 && harvestText !== ""
        ? tFill(locale, LINE_PACKAGES_NO_HARVEST, { text: harvestText })
        : "No packages on this line in this window.",
    footnote: notes.join(" ") || undefined,
    heading,
  };
}

export function productMixView(
  rows: Array<{ package_type_code: string; display_name: string | null; total_grams: number }>,
  year: number
): ReportView {
  const total = rows.reduce((s, r) => s + Number(r.total_grams), 0);
  const body: ReportView["rows"] = rows.map((r) => ({
    package_type: r.display_name ?? r.package_type_code,
    grams: r.total_grams,
    lbs: r.total_grams,
    percent: total === 0 ? "0.00" : ((Number(r.total_grams) / total) * 100).toFixed(2),
  }));
  if (body.length > 0) {
    body.push({
      package_type: "Total",
      grams: total,
      lbs: total,
      percent: "100.00",
      _total: 1,
    });
  }
  return {
    key: "product_mix",
    title: "Product Mix by weight",
    columns: [
      { key: "package_type", label: "Package type" },
      { key: "grams", label: "Grams", grams: true },
      { key: "lbs", label: "Lbs", lbs: true },
      { key: "percent", label: "Percent" },
    ],
    rows: body,
    footnote: `Year ${year}.`,
  };
}
