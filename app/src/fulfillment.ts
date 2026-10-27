/**
 * Fulfillment: [Mount SOs] and [Pick Orders] (owner order 2026-09-08, canon
 * 0.30.18, verbatim: "Look in the original gripfactory repo for how pic prders
 * and Mount SOs should behave" ... "here is the iteration that should contain
 * it"). The behavior is gripfactorish's (Code\gripfactorish,
 * reference/gripfactorish.html v0.3.5 and web/src/domain/rules.ts): a Zoho
 * Sales Order export drops in; each line buckets into one of ten readout
 * categories by Item.CF.Product Sub through ZOHO_SUB_MAP; crif and processing
 * lines are ignored; the order's status is Zoho's CF.Status (Internal) in the
 * lifecycle submitted, approved, picking, fulfilled, shipped; Shipping Today
 * is Expected Shipment Date equals today; the Sales Pipeline table and the SO
 * Status Detail render distinct orders and ordered quantity per category per
 * status. gripfactorish was stateless and read-only, so Picking and Fulfilled
 * sat grayed; the pick here is the write side it never had, and those two
 * rows fill from our own pick_status.
 */

import { esc } from "./html";
import { t, tFill, type Locale } from "./i18n";
import type { MountedLineRow, MountedOrderRow, SoMountRow } from "./db";

/* ------------------------------------------------------------- categories */

export const READOUT_CATEGORIES = [
  "BUD",
  "TRIM",
  "BIO",
  "PREPACK",
  "PREROLLS",
  "SHAKE",
  "DISTILLATE",
  "INFUSED BUD",
  "VAPES",
  "THCA",
] as const;
export type ReadoutCategory = (typeof READOUT_CATEGORIES)[number];

/** The display unit per category (gripfactorish CAT_UOM): lb for the weight
 * categories, each for pre-rolls and vapes, liters for distillate. */
export const CAT_UOM: Record<ReadoutCategory, "lb" | "ea" | "L"> = {
  BUD: "lb",
  TRIM: "lb",
  BIO: "lb",
  PREPACK: "lb",
  PREROLLS: "ea",
  SHAKE: "lb",
  DISTILLATE: "L",
  "INFUSED BUD": "lb",
  VAPES: "ea",
  THCA: "lb",
};

/** gripfactorish ZOHO_SUB_MAP, verbatim order: thca first (v0.3.2, so THCA
 * subs never mis-route through infused flower or concentrate). */
export const ZOHO_SUB_MAP: Array<[RegExp, ReadoutCategory]> = [
  [/thca/i, "THCA"],
  [/^bulk\s*flower/i, "BUD"],
  [/prepack\s*ounces|max\s*out\s*bags/i, "PREPACK"],
  [/vape|cart/i, "VAPES"],
  [/infused\s*pre[- ]?rolls?/i, "PREROLLS"],
  [/infused\s*flower/i, "INFUSED BUD"],
  [/concentrate/i, "DISTILLATE"],
  [/shake/i, "SHAKE"],
  [/trim/i, "TRIM"],
];

/** gripfactorish ZOHO_IGNORE: the CRIF fee line and processing lines never
 * count, in the readout or on the pick sheet. */
export const ZOHO_IGNORE = /crif|processing/i;

/** Zoho CF.Status (Internal), lowercased. Zoho carries the first two and the
 * last; picking and fulfilled are ours until a lane back to Zoho exists. */
export const SO_STATUSES = ["submitted", "approved", "picking", "fulfilled", "shipped"] as const;
export type SoStatus = (typeof SO_STATUSES)[number];

export function categoryForSub(sub: string | null | undefined): ReadoutCategory | null {
  const s = String(sub ?? "");
  if (!s) return null;
  for (const [re, cat] of ZOHO_SUB_MAP) if (re.test(s)) return cat;
  return null;
}

/* ---------------------------------------------------------------- parsing */

/** Column lookup tolerant of Zoho's spelling drift (gripfactorish `field`). */
export function field(rec: Record<string, string>, names: string[]): string {
  for (const n of names) {
    const v = rec[n];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  const lower = new Map(Object.keys(rec).map((k) => [k.trim().toLowerCase(), k]));
  for (const n of names) {
    const k = lower.get(n.toLowerCase());
    if (k && rec[k] != null && String(rec[k]).trim() !== "") return String(rec[k]).trim();
  }
  return "";
}

/** gripfactorish's file-kind test: a Zoho Sales Order export has a Product Sub
 * or a Status (Internal) column (the filename test rides the route). */
export function isZohoSalesOrderExport(headers: string[]): boolean {
  const h = headers.map((x) => x.trim().toLowerCase());
  return h.some((x) => x.includes("product sub")) || h.some((x) => x.includes("status (internal)"));
}

export function looksLikeZohoFilename(name: string): boolean {
  return /sales[_ ]?order/i.test(name);
}

export function numberOf(raw: string): number {
  const n = Number(String(raw ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Zoho dates arrive ISO (2026-08-06) in the export; tolerate M/D/YYYY. */
export function zohoDate(raw: string): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

export type ParsedLine = {
  seq: number;
  item_name: string;
  sku: string;
  product_sub: string;
  readout_category: ReadoutCategory | null;
  quantity_ordered: number;
  quantity_invoiced: number;
  quantity_packed: number;
  unit: string;
  item_price: number | null;
  location_code: string;
  line_location_name: string;
};

export type ParsedOrder = {
  so_number: string;
  zoho_so_id: string;
  customer_name: string;
  customer_id: string;
  order_date: string | null;
  expected_ship: string | null;
  zoho_status: string;
  internal_status: string;
  sales_person: string;
  customer_license: string;
  destination_license: string;
  origin_license: string;
  delivery_method: string;
  location_name: string;
  lines: ParsedLine[];
};

export type ParseResult = {
  orders: ParsedOrder[];
  counted: number;
  ignored: number;
  unbucketed: number;
};

/** parseZoho, made durable: one order per SalesOrder Number, its lines in file
 * order with a seq; crif and processing lines dropped (ignored); a line whose
 * sub buckets nowhere still mounts (it is real material to pick) with no
 * readout category (unbucketed). */
export function parseZohoSalesOrders(records: Record<string, string>[]): ParseResult {
  const orders = new Map<string, ParsedOrder>();
  let counted = 0;
  let ignored = 0;
  let unbucketed = 0;
  let lineNo = 0;
  for (const r of records) {
    lineNo += 1;
    const sub = field(r, ["Item.CF.Product Sub", "CF.Product Sub", "Product Sub", "Item CF Product Sub"]);
    const itemName = field(r, ["Item Name", "Item", "Product Name"]);
    if (ZOHO_IGNORE.test(sub) || ZOHO_IGNORE.test(itemName)) {
      ignored += 1;
      continue;
    }
    const soNumber =
      field(r, ["SalesOrder Number", "Sales Order Number", "SO Number", "Order Number"]) ||
      field(r, ["SalesOrder ID"]) ||
      `line~${lineNo}`;
    let order = orders.get(soNumber);
    if (!order) {
      order = {
        so_number: soNumber,
        zoho_so_id: field(r, ["SalesOrder ID"]),
        customer_name: field(r, ["Customer Name", "Customer"]),
        customer_id: field(r, ["Customer ID"]),
        order_date: zohoDate(field(r, ["Order Date", "SO Date", "Date"])),
        expected_ship: zohoDate(field(r, ["Expected Shipment Date", "Expected Ship Date", "Shipment Date"])),
        zoho_status: field(r, ["Status"]).toLowerCase(),
        internal_status: field(r, ["CF.Status (Internal)", "Status (Internal)", "CF Status Internal"]).toLowerCase(),
        sales_person: field(r, ["Sales Person", "Salesperson"]),
        customer_license: field(r, ["CF.Customer License #", "Customer License #", "Customer License"]),
        destination_license: field(r, ["CF.Destination License #", "Destination License #", "Destination License"]),
        origin_license: field(r, ["CF.Origin License #", "Origin License #", "Origin License"]),
        delivery_method: field(r, ["Delivery Method"]),
        location_name: field(r, ["Location Name"]),
        lines: [],
      };
      orders.set(soNumber, order);
    }
    const cat = categoryForSub(sub);
    if (!cat) unbucketed += 1;
    const priceRaw = field(r, ["Item Price", "Rate", "Price"]);
    order.lines.push({
      seq: order.lines.length + 1,
      item_name: itemName,
      sku: field(r, ["SKU", "Sku"]),
      product_sub: sub,
      readout_category: cat,
      quantity_ordered: numberOf(field(r, ["QuantityOrdered", "Quantity Ordered", "Ordered", "Quantity"])),
      quantity_invoiced: numberOf(field(r, ["QuantityInvoiced", "Quantity Invoiced", "Invoiced"])),
      quantity_packed: numberOf(field(r, ["QuantityPacked", "Quantity Packed", "Packed"])),
      unit: field(r, ["Usage unit", "Usage Unit", "Unit", "UOM"]),
      item_price: priceRaw ? numberOf(priceRaw) : null,
      location_code: field(r, ["Item.CF.Location Code", "CF.Location Code", "Location Code"]),
      line_location_name: field(r, ["Line Item Location Name", "Location"]),
    });
    counted += 1;
  }
  return { orders: [...orders.values()], counted, ignored, unbucketed };
}

/* ------------------------------------------------------------ rack order */

/** Walking order for the pick sheet: rack addresses first (P1.1.A before
 * P1.2.A before P2.1.B: prefix, row, bay, shelf), then named spots (Oxford N,
 * North Wall) alphabetically, blanks last. */
export function rackSortKey(code: string | null | undefined): [number, string, number, number, string] {
  const v = String(code ?? "").trim();
  if (!v) return [2, "", 0, 0, ""];
  const m = /^([A-Za-z]*)\s*(\d+)\.(\d+)(?:\.([A-Za-z0-9]+))?$/.exec(v);
  if (m) return [0, m[1].toUpperCase(), Number(m[2]), Number(m[3]), (m[4] ?? "").toUpperCase()];
  return [1, v.toUpperCase(), 0, 0, ""];
}

export function compareRack(a: string | null | undefined, b: string | null | undefined): number {
  const ka = rackSortKey(a);
  const kb = rackSortKey(b);
  for (let i = 0; i < ka.length; i++) {
    const x = ka[i];
    const y = kb[i];
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

export function sortLinesForPick<T extends { location_code: string | null; seq: number }>(lines: T[]): T[] {
  return [...lines].sort((a, b) => compareRack(a.location_code, b.location_code) || a.seq - b.seq);
}

/* --------------------------------------------------------------- readouts */

export type OrderWithLines = MountedOrderRow & { lines: MountedLineRow[] };

/** The order's effective status: our pick_status overlays Zoho's internal
 * status (gripfactorish counted each order in exactly one status bucket). */
export function effectiveStatus(order: MountedOrderRow): SoStatus | null {
  if (order.pick_status === "fulfilled") return "fulfilled";
  if (order.pick_status === "picking") return "picking";
  const s = (order.internal_status ?? "").toLowerCase();
  return (SO_STATUSES as readonly string[]).includes(s) ? (s as SoStatus) : null;
}

export type PipelineRow = "shippingToday" | "approved" | "submitted" | "picking" | "fulfilled" | "shipped";
export const PIPELINE_ROWS: Array<[PipelineRow, string]> = [
  ["shippingToday", "Shipping Today"],
  ["approved", "Accepted"],
  ["submitted", "Submitted"],
  ["picking", "Picking"],
  ["fulfilled", "Fulfilled"],
  ["shipped", "Shipped"],
];

export type PipelineCounts = {
  orders: Record<PipelineRow, Record<string, Set<string>>>;
  qty: Record<PipelineRow, Record<string, number>>;
  total: Record<PipelineRow, Set<string>>;
};

/** Distinct SO Sets and ordered quantity per category per row (SLICE-001):
 * TOTAL orders is the union across categories so a multi-category order
 * counts once; Shipping Today reads Expected Shipment Date equals today. */
export function pipelineCounts(orders: OrderWithLines[], today: string): PipelineCounts {
  const mk = <T>(f: () => T): Record<PipelineRow, Record<string, T>> => {
    const o = {} as Record<PipelineRow, Record<string, T>>;
    for (const [row] of PIPELINE_ROWS) {
      o[row] = {};
      for (const c of READOUT_CATEGORIES) o[row][c] = f();
    }
    return o;
  };
  const counts: PipelineCounts = {
    orders: mk(() => new Set<string>()),
    qty: mk(() => 0),
    total: Object.fromEntries(PIPELINE_ROWS.map(([row]) => [row, new Set<string>()])) as Record<PipelineRow, Set<string>>,
  };
  for (const order of orders) {
    const status = effectiveStatus(order);
    const rows: PipelineRow[] = [];
    if (status) rows.push(status);
    if (order.expected_ship && order.expected_ship === today && status !== "shipped") rows.push("shippingToday");
    for (const line of order.lines) {
      const cat = line.readout_category as ReadoutCategory | null;
      if (!cat || !(READOUT_CATEGORIES as readonly string[]).includes(cat)) continue;
      const q = status === "shipped" ? Number(line.quantity_invoiced) : Number(line.quantity_ordered);
      for (const row of rows) {
        counts.orders[row][cat].add(order.so_number);
        counts.qty[row][cat] += q;
        counts.total[row].add(order.so_number);
      }
    }
  }
  return counts;
}

function fmtQty(n: number): string {
  return n === 0 ? "" : Math.round(n).toLocaleString("en-US");
}

export function pipelineTable(orders: OrderWithLines[], today: string, locale: Locale = "en"): string {
  if (orders.length === 0) {
    return `<p class="muted" data-pipeline-empty>${esc(t(locale, "Populates on the first mount."))}</p>`;
  }
  const c = pipelineCounts(orders, today);
  const head = `<tr><th></th>${READOUT_CATEGORIES.map((cat) => `<th>${esc(cat)}<br><span class="muted">${esc(CAT_UOM[cat])}</span></th>`).join("")}<th>${esc(t(locale, "TOTAL"))}</th></tr>`;
  const body = PIPELINE_ROWS.map(([row, label]) => {
    const ordersCells = READOUT_CATEGORIES.map((cat) => {
      const n = c.orders[row][cat].size;
      return `<td class="${n ? "" : "z"}">${n ? n : "&middot;"}</td>`;
    }).join("");
    const lbTotal = READOUT_CATEGORIES.filter((cat) => CAT_UOM[cat] === "lb").reduce((s, cat) => s + c.qty[row][cat], 0);
    const qtyCells = READOUT_CATEGORIES.map((cat) => {
      const q = c.qty[row][cat];
      return `<td class="${q ? "" : "z"}">${q ? esc(fmtQty(q)) : "&middot;"}</td>`;
    }).join("");
    return `<tr data-pipeline-row="${esc(row)}"><th>${esc(t(locale, label))} &middot; ${esc(t(locale, "orders"))}</th>${ordersCells}<td class="tot">${c.total[row].size || "&middot;"}</td></tr>
      <tr class="qtyrow"><th>${esc(t(locale, label))} &middot; ${esc(t(locale, "qty"))}</th>${qtyCells}<td class="tot">${lbTotal ? `${esc(fmtQty(lbTotal))} <small>${esc(t(locale, "lb only"))}</small>` : "&middot;"}</td></tr>`;
  }).join("");
  return `<table class="data sotable" data-pipeline-table><thead>${head}</thead><tbody>${body}</tbody></table>
    <p class="muted">${esc(
      t(
        locale,
        "Orders = distinct sales orders per category; TOTAL is distinct across categories (a multi-category SO counts once). Qty = ordered quantity in the category's unit; Shipped reads invoiced. Picking and Fulfilled are this app's pick status; the rest is Zoho's CF.Status (Internal)."
      )
    )}</p>`;
}

export function soStatusDetail(orders: OrderWithLines[], locale: Locale = "en"): string {
  if (orders.length === 0) return "";
  const cols: Array<[SoStatus, string]> = [
    ["submitted", "Submitted"],
    ["approved", "Approved"],
    ["picking", "Picking"],
    ["fulfilled", "Fulfilled"],
    ["shipped", "Shipped"],
  ];
  const sets: Record<string, Record<string, Set<string>>> = {};
  const totals: Record<string, Set<string>> = {};
  for (const [s] of cols) {
    totals[s] = new Set();
    sets[s] = {};
    for (const cat of READOUT_CATEGORIES) sets[s][cat] = new Set();
  }
  for (const order of orders) {
    const status = effectiveStatus(order);
    if (!status) continue;
    for (const line of order.lines) {
      const cat = line.readout_category;
      if (!cat || !(cat in sets[status])) continue;
      sets[status][cat].add(order.so_number);
      totals[status].add(order.so_number);
    }
  }
  const head = `<tr><th>${esc(t(locale, "Category"))}</th>${cols.map(([, l]) => `<th>${esc(t(locale, l))}</th>`).join("")}</tr>`;
  const rows = READOUT_CATEGORIES.map(
    (cat) =>
      `<tr><th>${esc(cat)}</th>${cols
        .map(([s]) => {
          const n = sets[s][cat].size;
          return `<td class="${n ? "" : "z"}">${n ? n : "&middot;"}</td>`;
        })
        .join("")}</tr>`
  ).join("");
  const tot = `<tr class="tot"><th>${esc(t(locale, "TOTAL"))}</th>${cols.map(([s]) => `<td>${totals[s].size || "&middot;"}</td>`).join("")}</tr>`;
  return `<table class="data sotable" data-so-detail><thead>${head}</thead><tbody>${rows}${tot}</tbody></table>`;
}

/* ------------------------------------------------------------------ pages */

/** Shipping Today is the browser's calendar day, not the worker's UTC day (the
 * browser-resolved wall-clock law of canon 0.30.10): when the page's today
 * differs from the device's local date and the URL has not said otherwise, the
 * page reloads once with ?today=YYYY-MM-DD and the readout recounts. */
export function isIsoDate(v: string | null | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function todayResolveScript(): string {
  return `<script>(function(){
  var el = document.querySelector("[data-today]");
  if (!el) return;
  var url = new URL(location.href);
  if (url.searchParams.has("today")) return;
  var d = new Date();
  var local = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  if (local !== el.getAttribute("data-today")) { url.searchParams.set("today", local); location.replace(url.toString()); }
})();</script>`;
}

/** A stored ISO instant rendered in the browser's wall clock (canon 0.30.10:
 * the device's clock, never the worker's UTC); the ISO stays as the fallback. */
function localTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return `<time datetime="${esc(iso)}" data-local>${esc(iso)}</time>`;
}

function localTimeScript(): string {
  return `<script>(function(){
  function pad(n) { return String(n).padStart(2, "0"); }
  document.querySelectorAll("time[data-local]:not([data-local-done])").forEach(function (el) {
    var ms = Date.parse(el.getAttribute("datetime") || "");
    if (!isFinite(ms)) return;
    var d = new Date(ms);
    el.textContent = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    el.setAttribute("data-local-done", "1");
  });
})();</script>`;
}

function statusChip(order: MountedOrderRow, locale: Locale): string {
  const s = effectiveStatus(order);
  const label = s ? t(locale, s.charAt(0).toUpperCase() + s.slice(1)) : (order.internal_status || order.zoho_status || "");
  return `<span class="chip so-${esc(s ?? "unknown")}">${esc(label)}</span>`;
}

/** SM1, THE WHOLE EXPORT MOUNT (canon 0.30.554): the most rows one round of the
 * Mount SOs page carries. Rounds hold whole orders, so an order with more lines
 * than this rides alone. A round of 1,500 lines reads in about 25 MB, where the
 * Worker has 128 MB. */
export const SO_ROUND_ROWS = 1500;

/** SM1: a mount is whole when its rounds all landed (a mount from before SM1 is). */
export function soMountWhole(mount: Pick<SoMountRow, "rounds_total" | "completed_at">): boolean {
  return mount.rounds_total == null || Boolean(mount.completed_at);
}

/** SM1: the page's splitter, plain script (it rides inline, and the tests run
 * it through new Function). It cuts the export into records at line breaks
 * outside quotes (the parseCsv rules), groups the records by the order key
 * the mount reads (the first filled of SalesOrder Number, Sales Order Number,
 * SO Number, Order Number, by exact name and then any case; then SalesOrder
 * ID; rows with none ride together), keeps file order inside an order, and
 * packs whole orders into rounds of at most cap records, each with the header. */
export const SO_SPLIT_JS = `function soSplit(text, cap) {
  var src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  var records = [];
  var start = 0;
  var quoted = false;
  for (var i = 0; i < src.length; i++) {
    var ch = src.charCodeAt(i);
    if (ch === 34) { quoted = !quoted; continue; }
    if (ch === 10 && !quoted) { records.push(src.slice(start, i)); start = i + 1; }
  }
  if (start < src.length) records.push(src.slice(start));
  var header = null;
  var body = [];
  for (var r = 0; r < records.length; r++) {
    if (records[r].replace(/\\r/g, "") === "") continue;
    if (header === null) header = records[r]; else body.push(records[r]);
  }
  if (header === null) return { rounds: [], orders: 0, rows: 0 };
  function unquote(raw) {
    var out = "";
    var q = false;
    for (var j = 0; j < raw.length; j++) {
      var c = raw.charAt(j);
      if (q) {
        if (c === '"') { if (raw.charAt(j + 1) === '"') { out += '"'; j++; } else { q = false; } }
        else out += c;
        continue;
      }
      if (c === '"') { q = true; continue; }
      if (c === "\\r") continue;
      out += c;
    }
    return out;
  }
  function fields(record) {
    var out = [];
    var q = false;
    var from = 0;
    for (var j = 0; j <= record.length; j++) {
      var c = j < record.length ? record.charCodeAt(j) : 44;
      if (c === 34) { q = !q; continue; }
      if (c === 44 && !q) { out.push(record.slice(from, j)); from = j + 1; }
    }
    return out;
  }
  function fieldAt(record, want) {
    var idx = 0;
    var q = false;
    var from = 0;
    for (var j = 0; j <= record.length; j++) {
      var c = j < record.length ? record.charCodeAt(j) : 44;
      if (c === 34) { q = !q; continue; }
      if (c === 44 && !q) {
        if (idx === want) return unquote(record.slice(from, j)).trim();
        idx++;
        from = j + 1;
      }
    }
    return "";
  }
  var heads = fields(header).map(function (h) { return unquote(h).trim(); });
  var tries = [];
  function look(names) {
    var n, k;
    for (n = 0; n < names.length; n++) for (k = 0; k < heads.length; k++) if (heads[k] === names[n] && tries.indexOf(k) < 0) tries.push(k);
    for (n = 0; n < names.length; n++) for (k = 0; k < heads.length; k++) if (heads[k].toLowerCase() === names[n].toLowerCase() && tries.indexOf(k) < 0) tries.push(k);
  }
  look(["SalesOrder Number", "Sales Order Number", "SO Number", "Order Number"]);
  look(["SalesOrder ID"]);
  var groups = new Map();
  for (var b = 0; b < body.length; b++) {
    var key = "";
    for (var t = 0; t < tries.length && key === ""; t++) key = fieldAt(body[b], tries[t]);
    var group = groups.get(key);
    if (!group) { group = []; groups.set(key, group); }
    group.push(body[b]);
  }
  var rounds = [];
  var current = [];
  groups.forEach(function (group) {
    if (current.length > 0 && current.length + group.length > cap) { rounds.push(current); current = []; }
    for (var g = 0; g < group.length; g++) current.push(group[g]);
  });
  if (current.length > 0) rounds.push(current);
  return {
    rounds: rounds.map(function (rows) { return header + "\\n" + rows.join("\\n") + "\\n"; }),
    orders: groups.size,
    rows: body.length
  };
}`;

/** SM1: the page's rounds. Without fetch, FormData, Blob, Map or File.text the
 * form posts the whole file once, as before. */
function soRoundsScript(): string {
  return `<script>(function(){
  var form = document.querySelector("[data-mount-form]");
  if (!form || !window.fetch || !window.FormData || !window.Blob || !window.Map) return;
  var input = form.querySelector('input[type="file"]');
  var line = form.querySelector("[data-so-progress]");
  var button = form.querySelector('button[type="submit"]');
  var cap = Number(form.getAttribute("data-round-rows")) || ${SO_ROUND_ROWS};
  ${SO_SPLIT_JS}
  function say(text) { line.textContent = text; line.hidden = false; }
  function fill(template, done, total) { return template.replace("{done}", String(done)).replace("{total}", String(total)); }
  function stop(err) {
    say(form.getAttribute("data-text-fail") + " " + (err && err.message ? err.message : String(err)));
    button.disabled = false;
  }
  form.addEventListener("submit", function (ev) {
    var file = input && input.files && input.files[0];
    if (!file || typeof file.text !== "function") return;
    ev.preventDefault();
    button.disabled = true;
    say(form.getAttribute("data-text-start"));
    file.text().then(function (text) {
      var split = soSplit(text, cap);
      var rounds = split.rounds.length ? split.rounds : [text];
      var total = rounds.length;
      var k = 0;
      var mountId = "";
      function round() {
        var body = new FormData();
        body.set("file", new Blob([rounds[k]], { type: "text/csv" }), file.name);
        body.set("round", String(k));
        body.set("rounds", String(total));
        if (mountId) body.set("mount_id", mountId);
        fetch(form.getAttribute("action"), { method: "POST", body: body, credentials: "same-origin", headers: { "Accept": "application/json" } })
          .then(function (res) {
            return res.text().then(function (raw) {
              var data = null;
              try { data = JSON.parse(raw); } catch (e) { data = null; }
              if (!res.ok || !data || data.ok !== true) throw new Error((data && data.error) || ("HTTP " + res.status));
              return data;
            });
          })
          .then(function (data) {
            mountId = data.mount_id;
            if (data.done) { say(form.getAttribute("data-text-done")); window.location.assign(data.redirect); return; }
            k = data.next;
            say(fill(form.getAttribute("data-text-progress"), k, total));
            round();
          })
          .catch(stop);
      }
      say(fill(form.getAttribute("data-text-progress"), 0, total));
      round();
    }).catch(stop);
  });
})();</script>`;
}

export function mountSosPage(input: {
  mounts: SoMountRow[];
  orders: OrderWithLines[];
  today: string;
  locale?: Locale;
  ok?: string;
  err?: string;
}): string {
  const locale = input.locale ?? "en";
  const latest = input.mounts[0];
  // SM1: the summary, the stale chip and the gone line read the last whole
  // mount; a mount whose rounds stopped says so on its own line.
  const whole = input.mounts.find((m) => soMountWhole(m));
  const flash =
    input.ok === "mounted"
      ? `<p class="banner ok">${esc(t(locale, "Mounted."))}</p>`
      : input.err
        ? `<p class="banner err">${esc(input.err)}</p>`
        : "";
  const summaryLine = whole
    ? `<p class="muted" data-mount-summary>${esc(t(locale, "Last mount"))}: ${esc(whole.filename)} &middot; ${localTime(whole.created_at)} &middot; ${esc(
        String(whole.row_count)
      )} ${esc(t(locale, "lines"))}, ${esc(String(whole.order_count))} ${esc(t(locale, "orders"))}, ${esc(String(whole.ignored_count))} ${esc(
        t(locale, "ignored (CRIF, processing)")
      )}</p>`
    : `<p class="muted">${esc(t(locale, "Nothing mounted yet."))}</p>`;
  const goneLine =
    whole && Number(whole.gone_count ?? 0) > 0
      ? `<p class="muted" data-mount-gone>${esc(
          tFill(locale, "Gone from Zoho with this mount: {n}. An order dated inside the export that the export no longer carries leaves.", { n: String(whole.gone_count) })
        )}</p>`
      : "";
  const heldLine =
    whole && Number(whole.gone_held ?? 0) > 0
      ? `<p class="banner err" data-mount-held>${esc(
          tFill(
            locale,
            "Missing from this export but dated inside it: {n}. Nothing was removed; a filtered export does that. Mount Zoho's whole export to settle them.",
            { n: String(whole.gone_held) }
          )
        )}</p>`
      : "";
  const stoppedLine =
    latest && !soMountWhole(latest)
      ? `<p class="banner err" data-mount-stopped>${esc(
          tFill(locale, "The mount of {file} stopped after round {done} of {total}. Mount the file again; what landed stays.", {
            file: latest.filename,
            done: String(latest.rounds_done ?? 0),
            total: String(latest.rounds_total ?? 0),
          })
        )}</p>`
      : "";
  const summary = `${stoppedLine}${summaryLine}${goneLine}${heldLine}`;
  const open = input.orders.filter((o) => effectiveStatus(o) !== "shipped");
  const list =
    open.length === 0
      ? `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`
      : `<div class="report-scroll"><table class="data" data-mounted-orders><thead><tr><th>${esc(t(locale, "SO"))}</th><th>${esc(t(locale, "Customer"))}</th><th>${esc(
          t(locale, "Ships")
        )}</th><th>${esc(t(locale, "Status"))}</th><th>${esc(t(locale, "Lines"))}</th><th></th></tr></thead><tbody>${open
          .map(
            (o) => `<tr data-so="${esc(o.so_number)}">
          <td>${esc(o.so_number)}</td>
          <td>${esc(o.customer_name ?? "")}</td>
          <td>${esc(o.expected_ship ?? "")}</td>
          <td>${statusChip(o, locale)}${
            whole && o.last_mount_id !== whole.id ? ` <span class="chip so-stale" data-stale>${esc(t(locale, "not in last mount"))}</span>` : ""
          }</td>
          <td>${esc(String(o.lines.length))}</td>
          <td><a class="btn secondary" href="/fulfillment/pick-orders?order=${esc(o.id)}">${esc(t(locale, "Pick"))}</a></td>
        </tr>`
          )
          .join("")}</tbody></table></div>`;
  return `<h1>${esc(t(locale, "Mount SOs"))}</h1>
    ${flash}
    <form class="stack" method="post" action="/fulfillment/mount-sos" enctype="multipart/form-data" data-mount-form
      data-round-rows="${esc(String(SO_ROUND_ROWS))}"
      data-text-start="${esc(t(locale, "Mounting: reading the file."))}"
      data-text-progress="${esc(t(locale, "Mounting: {done} of {total} rounds landed."))}"
      data-text-done="${esc(t(locale, "Mounted. Loading the orders."))}"
      data-text-fail="${esc(t(locale, "The mount stopped:"))}">
      <label class="field">${esc(t(locale, "Zoho Sales Order export (csv)"))}
        <input type="file" name="file" accept=".csv" required>
      </label>
      <p class="muted">${esc(
        t(
          locale,
          "Drop Zoho Inventory's whole Sales Order export, no filters; an xlsx export saves as csv first. It mounts in rounds of whole orders, and the line under the button counts them. Every order takes what Zoho says now, a year back included; an order inside the export's dates that the export lacks is gone from Zoho and leaves. Nothing writes back to Zoho."
        )
      )}</p>
      <button type="submit">${esc(t(locale, "Mount"))}</button>
      <p class="muted" data-so-progress hidden></p>
    </form>
    ${soRoundsScript()}
    ${summary}
    <h2>${esc(t(locale, "Sales Pipeline"))} &middot; ${esc(t(locale, "Orders and quantity"))}</h2>
    <div data-today="${esc(input.today)}"><div class="report-scroll">${pipelineTable(input.orders, input.today, locale)}</div></div>
    ${todayResolveScript()}
    <h2>${esc(t(locale, "SO Status Detail"))}</h2>
    <div class="report-scroll">${soStatusDetail(input.orders, locale) || `<p class="muted">${esc(t(locale, "Populates on the first mount."))}</p>`}</div>
    <h2>${esc(t(locale, "Open orders"))} <span class="tile-count">${esc(String(open.length))}</span></h2>
    ${list}
    ${localTimeScript()}`;
}

function pickLinesTable(
  lines: MountedLineRow[],
  locale: Locale,
  editable: boolean
): string {
  const sorted = sortLinesForPick(lines);
  let lastLoc: string | null = null;
  const rows = sorted
    .map((l) => {
      const loc = (l.location_code ?? "").trim() || t(locale, "(no location)");
      const group = loc !== lastLoc ? `<tr class="loc-row"><th colspan="7">${esc(loc)}</th></tr>` : "";
      lastLoc = loc;
      const picked = l.picked_qty == null ? "" : String(l.picked_qty);
      const cells = editable
        ? `<td><input type="number" step="0.01" min="0" name="picked_${esc(l.id)}" value="${esc(picked)}" inputmode="decimal" class="pick-qty"></td>
           <td><input type="checkbox" name="short_${esc(l.id)}" value="1"${Number(l.short_flag) === 1 ? " checked" : ""}></td>
           <td><input type="text" name="note_${esc(l.id)}" value="${esc(l.pick_note ?? "")}"></td>`
        : `<td>${esc(picked)}</td><td>${Number(l.short_flag) === 1 ? esc(t(locale, "short")) : ""}</td><td>${esc(l.pick_note ?? "")}</td>`;
      return `${group}<tr data-line="${esc(l.id)}">
        <td>${esc(l.item_name ?? "")}</td>
        <td class="mono">${esc(l.sku ?? "")}</td>
        <td>${esc(String(Number(l.quantity_ordered)))}</td>
        <td>${esc(l.unit ?? "")}</td>
        ${cells}
      </tr>`;
    })
    .join("");
  return `<table class="data pick-lines" data-pick-lines><thead><tr><th>${esc(t(locale, "Item"))}</th><th>${esc(t(locale, "Tag"))}</th><th>${esc(
    t(locale, "Ordered")
  )}</th><th>${esc(t(locale, "Unit"))}</th><th>${esc(t(locale, "Picked"))}</th><th>${esc(t(locale, "Short"))}</th><th>${esc(t(locale, "Note"))}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** The signer, hand entry (canon 0.30.21, owner: "The operator dropdowns
 * don't need to have the maintenance crew on every single one, that was just
 * for the PM portion"). */
function signerInputHtml(locale: Locale, label: string, fieldName = "signed_by"): string {
  return `<label class="field">${esc(t(locale, label))} <input type="text" name="${esc(fieldName)}" required autocomplete="off"></label>`;
}

export function pickOrdersPage(input: {
  orders: OrderWithLines[];
  picked: OrderWithLines | null;
  locale?: Locale;
  ok?: string;
}): string {
  const locale = input.locale ?? "en";
  const flash =
    input.ok === "picking"
      ? `<p class="banner ok">${esc(t(locale, "Pick started."))}</p>`
      : input.ok === "saved"
        ? `<p class="banner ok">${esc(t(locale, "Pick saved."))}</p>`
        : input.ok === "fulfilled"
          ? `<p class="banner ok">${esc(t(locale, "Fulfilled."))}</p>`
          : "";
  const pane =
    input.orders.length === 0
      ? `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`
      : `<ul class="ledger-list">${input.orders
          .map(
            (o) => `<li><a class="queue-pane-item${input.picked?.id === o.id ? " selected" : ""}" href="/fulfillment/pick-orders?order=${esc(
              o.id
            )}"><strong>${esc(o.so_number)}</strong> ${esc(o.customer_name ?? "")} <span class="muted">${esc(o.expected_ship ?? "")} &middot; ${esc(
              String(o.lines.length)
            )} ${esc(t(locale, "lines"))}</span> ${statusChip(o, locale)}</a></li>`
          )
          .join("")}</ul>`;
  let working: string;
  const p = input.picked;
  if (!p) {
    working = `<p class="muted">${esc(t(locale, "Pick an order from the pane."))}</p>`;
  } else {
    const header = `<h2 class="working-pick">${esc(p.so_number)} &middot; ${esc(p.customer_name ?? "")}</h2>
      <dl class="lot-meta">
        <dt>${esc(t(locale, "Ships"))}</dt><dd>${esc(p.expected_ship ?? "")}</dd>
        <dt>${esc(t(locale, "Sales person"))}</dt><dd>${esc(p.sales_person ?? "")}</dd>
        <dt>${esc(t(locale, "Licenses"))}</dt><dd>${esc([p.origin_license, p.destination_license].filter(Boolean).join(" to "))}</dd>
        <dt>${esc(t(locale, "Zoho"))}</dt><dd>${esc(p.internal_status ?? "")} / ${esc(p.zoho_status ?? "")}</dd>
        <dt>${esc(t(locale, "Pick"))}</dt><dd>${statusChip(p, locale)} ${
          p.picked_by ? `${esc(t(locale, "Picked by"))} ${esc(p.picked_by)} ${localTime(p.picked_at)}` : ""
        } ${p.fulfilled_by ? `&middot; ${esc(t(locale, "Fulfilled by"))} ${esc(p.fulfilled_by)} ${localTime(p.fulfilled_at)}` : ""}</dd>
      </dl>
      <p><a class="btn secondary" href="/fulfillment/pick-orders/${esc(p.id)}/print" target="_blank" rel="noopener">${esc(t(locale, "Print pick sheet"))}</a></p>`;
    if (!p.pick_status) {
      working = `${header}
        ${pickLinesTable(p.lines, locale, false)}
        <form class="stack" method="post" action="/fulfillment/pick-orders/${esc(p.id)}/start" data-pick-start>
          ${signerInputHtml(locale, "Picked by")}
          <button type="submit">${esc(t(locale, "Start pick"))}</button>
        </form>`;
    } else if (p.pick_status === "picking") {
      working = `${header}
        <form class="stack" method="post" action="/fulfillment/pick-orders/${esc(p.id)}/save" data-pick-save>
          ${pickLinesTable(p.lines, locale, true)}
          <button type="submit" class="secondary">${esc(t(locale, "Save progress"))}</button>
        </form>
        <form class="stack" method="post" action="/fulfillment/pick-orders/${esc(p.id)}/complete" data-pick-complete>
          ${signerInputHtml(locale, "Fulfilled by")}
          <button type="submit">${esc(t(locale, "Complete pick"))}</button>
          <p class="muted">${esc(t(locale, "A short line is flagged, never blocked. Zoho keeps its own status; this marks the order fulfilled here."))}</p>
        </form>`;
    } else {
      working = `${header}${pickLinesTable(p.lines, locale, false)}`;
    }
  }
  return `<h1>${esc(t(locale, "Pick Orders"))}</h1>
    <p><a href="/fulfillment/mount-sos">${esc(t(locale, "Mount SOs"))}</a></p>
    ${flash}
    <div class="station-split">
      <aside class="queue-pane">
        <h2>${esc(t(locale, "Orders to pick"))} <span class="tile-count">${esc(String(input.orders.length))}</span></h2>
        ${pane}
      </aside>
      <div class="working-pane">${working}</div>
    </div>
    ${localTimeScript()}`;
}

/** The printable pick sheet: the paper that replaces the picklist hand written
 * on the invoice (the owner's 2026-05-12 system map). Letter, one order. */
export function pickSheetHtml(order: OrderWithLines, locale: Locale = "en"): string {
  const sorted = sortLinesForPick(order.lines);
  let lastLoc: string | null = null;
  const rows = sorted
    .map((l) => {
      const loc = (l.location_code ?? "").trim() || t(locale, "(no location)");
      const group = loc !== lastLoc ? `<tr class="loc"><td colspan="6">${esc(loc)}</td></tr>` : "";
      lastLoc = loc;
      return `${group}<tr>
        <td class="box">&#9744;</td>
        <td>${esc(l.item_name ?? "")}</td>
        <td class="mono">${esc(l.sku ?? "")}</td>
        <td class="num">${esc(String(Number(l.quantity_ordered)))}</td>
        <td>${esc(l.unit ?? "")}</td>
        <td class="num">${l.picked_qty == null ? "" : esc(String(l.picked_qty))}${Number(l.short_flag) === 1 ? ` <b>${esc(t(locale, "short"))}</b>` : ""}</td>
      </tr>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="${esc(locale)}">
<head>
<meta charset="utf-8">
<title>${esc(t(locale, "Pick sheet"))} ${esc(order.so_number)}</title>
<style>
@page { size: letter; margin: 0.5in; }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif; color: #111; margin: 0; padding: 0.25in; font-size: 12px; }
h1 { font-size: 20px; margin: 0 0 4px; }
.meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 16px; margin: 8px 0 12px; }
.meta div b { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
table { width: 100%; border-collapse: collapse; }
th, td { border-bottom: 1px solid #ccc; padding: 6px 6px; text-align: left; vertical-align: top; }
th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
tr.loc td { background: #eee; font-weight: 700; border-bottom: 1px solid #999; }
td.box { font-size: 16px; width: 24px; }
td.num { text-align: right; }
.mono { font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
.sign { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.sign div { border-top: 1px solid #111; padding-top: 4px; font-size: 11px; }
@media print { .noprint { display: none; } }
</style>
</head>
<body>
<h1>${esc(t(locale, "Pick sheet"))} &middot; ${esc(order.so_number)}</h1>
<div class="meta">
  <div><b>${esc(t(locale, "Customer"))}</b>${esc(order.customer_name ?? "")}</div>
  <div><b>${esc(t(locale, "Ships"))}</b>${esc(order.expected_ship ?? "")}</div>
  <div><b>${esc(t(locale, "Sales person"))}</b>${esc(order.sales_person ?? "")}</div>
  <div><b>${esc(t(locale, "Origin license"))}</b>${esc(order.origin_license ?? "")}</div>
  <div><b>${esc(t(locale, "Destination license"))}</b>${esc(order.destination_license ?? "")}</div>
  <div><b>${esc(t(locale, "Delivery"))}</b>${esc(order.delivery_method ?? "")}</div>
</div>
<table>
  <thead><tr><th></th><th>${esc(t(locale, "Item"))}</th><th>${esc(t(locale, "Tag"))}</th><th>${esc(t(locale, "Ordered"))}</th><th>${esc(
    t(locale, "Unit")
  )}</th><th>${esc(t(locale, "Picked"))}</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="sign">
  <div>${esc(t(locale, "Picked by"))}: ${esc(order.picked_by ?? "")} ${esc(order.picked_at ? order.picked_at.slice(0, 10) : "")}</div>
  <div>${esc(t(locale, "Fulfilled by"))}: ${esc(order.fulfilled_by ?? "")} ${esc(order.fulfilled_at ? order.fulfilled_at.slice(0, 10) : "")}</div>
</div>
<p class="noprint"><button onclick="window.print()">${esc(t(locale, "Print"))}</button></p>
</body>
</html>`;
}
