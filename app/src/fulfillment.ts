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
import { t, type Locale } from "./i18n";
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
  const flash =
    input.ok === "mounted"
      ? `<p class="banner ok">${esc(t(locale, "Mounted."))}</p>`
      : input.err
        ? `<p class="banner err">${esc(input.err)}</p>`
        : "";
  const summary = latest
    ? `<p class="muted" data-mount-summary>${esc(t(locale, "Last mount"))}: ${esc(latest.filename)} &middot; ${localTime(latest.created_at)} &middot; ${esc(
        String(latest.row_count)
      )} ${esc(t(locale, "lines"))}, ${esc(String(latest.order_count))} ${esc(t(locale, "orders"))}, ${esc(String(latest.ignored_count))} ${esc(
        t(locale, "ignored (CRIF, processing)")
      )}</p>`
    : `<p class="muted">${esc(t(locale, "Nothing mounted yet."))}</p>`;
  const open = input.orders.filter((o) => effectiveStatus(o) !== "shipped");
  const list =
    open.length === 0
      ? `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`
      : `<table class="data" data-mounted-orders><thead><tr><th>${esc(t(locale, "SO"))}</th><th>${esc(t(locale, "Customer"))}</th><th>${esc(
          t(locale, "Ships")
        )}</th><th>${esc(t(locale, "Status"))}</th><th>${esc(t(locale, "Lines"))}</th><th></th></tr></thead><tbody>${open
          .map(
            (o) => `<tr data-so="${esc(o.so_number)}">
          <td>${esc(o.so_number)}</td>
          <td>${esc(o.customer_name ?? "")}</td>
          <td>${esc(o.expected_ship ?? "")}</td>
          <td>${statusChip(o, locale)}${
            latest && o.last_mount_id !== latest.id ? ` <span class="chip so-stale" data-stale>${esc(t(locale, "not in last mount"))}</span>` : ""
          }</td>
          <td>${esc(String(o.lines.length))}</td>
          <td><a class="btn secondary" href="/fulfillment/pick-orders?order=${esc(o.id)}">${esc(t(locale, "Pick"))}</a></td>
        </tr>`
          )
          .join("")}</tbody></table>`;
  return `<h1>${esc(t(locale, "Mount SOs"))}</h1>
    ${flash}
    <form class="stack" method="post" action="/fulfillment/mount-sos" enctype="multipart/form-data" data-mount-form>
      <label class="field">${esc(t(locale, "Zoho Sales Order export (csv)"))}
        <input type="file" name="file" accept=".csv" required>
      </label>
      <p class="muted">${esc(t(locale, "Drop the Sales Order export from Zoho Inventory. An xlsx export saves as csv first. Re-mounting a newer export updates statuses in place; nothing writes back to Zoho."))}</p>
      <button type="submit">${esc(t(locale, "Mount"))}</button>
    </form>
    ${summary}
    <h2>${esc(t(locale, "Sales Pipeline"))} &middot; ${esc(t(locale, "Orders and quantity"))}</h2>
    <div data-today="${esc(input.today)}">${pipelineTable(input.orders, input.today, locale)}</div>
    ${todayResolveScript()}
    <h2>${esc(t(locale, "SO Status Detail"))}</h2>
    ${soStatusDetail(input.orders, locale) || `<p class="muted">${esc(t(locale, "Populates on the first mount."))}</p>`}
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
