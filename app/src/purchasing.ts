import { t, type Locale } from "./i18n";
import { esc, fieldBlock, pencilLink, rapidAddButton, rapidFocusScript, statusPill, tabBar, voidLink } from "./ui";

export const PO_STATUSES = ["draft", "open", "closed", "cancelled"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export function mintPoNumber(farm: string, year: number, seq: number): string {
  const yy = String(year).slice(-2).padStart(2, "0");
  const token = String(seq).padStart(3, "0");
  return `PO-${farm}-${yy}-${token}`;
}

export function parsePoSeq(poNumber: string, farm: string, yy: string): number | null {
  const prefix = `PO-${farm}-${yy}-`;
  if (!poNumber.startsWith(prefix)) return null;
  const n = Number(poNumber.slice(prefix.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function dollarsToCents(raw: string): number {
  const n = Number(String(raw).trim().replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, "0");
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${grouped}.${rem}`;
}

export function lineTotalCents(qty: number, unitPriceCents: number): number {
  return Math.round(Number(qty) * Number(unitPriceCents));
}

export type PoLineRow = {
  id: string;
  item_code: string | null;
  description: string;
  uom: string;
  qty: number;
  unit_price_cents: number;
};

export function poLinesTotalCents(lines: readonly PoLineRow[]): number {
  return lines.reduce((sum, line) => sum + lineTotalCents(line.qty, line.unit_price_cents), 0);
}

export type PoListRow = {
  id: string;
  po_number: string;
  name: string;
  po_class: string | null;
  project: string | null;
  status: string;
  supplier_name: string | null;
  total_cents: number;
};

export function purchasingListPage(
  tab: "all" | "open" | "draft" | "closed",
  rows: PoListRow[],
  locale: Locale = "en"
): string {
  const tabs = tabBar(
    locale,
    [
      { href: "/purchasing?tab=all", key: "all", label: "All" },
      { href: "/purchasing?tab=open", key: "open", label: "Open" },
      { href: "/purchasing?tab=draft", key: "draft", label: "Draft" },
      { href: "/purchasing?tab=closed", key: "closed", label: "Closed" },
      { href: "/purchasing/requisitions", key: "req", label: "Requisitions" },
      { href: "/purchasing/deliveries", key: "del", label: "Deliveries" },
      { href: "/purchasing/invoices", key: "inv", label: "Invoices" },
    ],
    tab
  );
  const body =
    rows.length === 0
      ? `<tr><td colspan="7">${esc(t(locale, "No purchase orders."))}</td></tr>`
      : rows
          .map(
            (r) => `<tr>
        <td><a href="/purchasing/po/${esc(r.id)}">${esc(r.po_number)}</a></td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.po_class ?? "")}</td>
        <td>${esc(r.project ?? "")}</td>
        <td>${statusPill(r.status, locale)}</td>
        <td>${esc(r.supplier_name ?? "")}</td>
        <td>${esc(formatUsd(r.total_cents))}</td>
      </tr>`
          )
          .join("");
  return `<h1>${esc(t(locale, "Purchasing"))}</h1>
    <p><a href="/purchasing/suppliers">${esc(t(locale, "Suppliers"))}</a></p>
    ${tabs}
    <p><a class="btn" href="/purchasing/new">${esc(t(locale, "Create purchase order"))}</a></p>
    <table class="data">
      <thead><tr>
        <th>${esc(t(locale, "Number"))}</th>
        <th>${esc(t(locale, "Name"))}</th>
        <th>${esc(t(locale, "Class"))}</th>
        <th>${esc(t(locale, "Project"))}</th>
        <th>${esc(t(locale, "Status"))}</th>
        <th>${esc(t(locale, "Supplier"))}</th>
        <th>${esc(t(locale, "Total"))}</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

export function purchasingReservedPage(title: string, locale: Locale = "en"): string {
  return `<h1>${esc(t(locale, title))}</h1>
    <p class="muted">${esc(t(locale, "Reserved. Later slice: requisitions, deliveries, invoices, budgets, and approvals from the Tradogram walk."))}</p>`;
}

export function newPurchaseOrderPage(
  suppliers: Array<{ id: string; company_name: string }>,
  farms: Array<{ value: string; label: string }>,
  locale: Locale = "en"
): string {
  const supplierOpts = suppliers.map((s) => `<option value="${esc(s.id)}">${esc(s.company_name)}</option>`).join("");
  const farmOpts = farms
    .map((f) => `<option value="${esc(f.value)}"${f.value === "PNN" ? " selected" : ""}>${esc(f.label)}</option>`)
    .join("");
  return `<h1>${esc(t(locale, "Create purchase order"))}</h1>
    <form class="stack" method="post" action="/purchasing/new">
      ${fieldBlock(locale, "Name", `<input type="text" name="name" required>`, "Short name on the Tradogram-lite list.")}
      ${fieldBlock(locale, "Class", `<input type="text" name="po_class">`, "Free text. The owner's classes read like 2024 Harvest and 23H.")}
      ${fieldBlock(locale, "Project", `<input type="text" name="project">`, "Free text project label.")}
      ${fieldBlock(locale, "Farm", `<select name="farm">${farmOpts}</select>`, "Mints PO-farm-yy-seq. Admin\\Data Lookups\\Harvest Operations\\Farms")}
      ${fieldBlock(locale, "Supplier", `<select name="supplier_id" required>${supplierOpts}</select>`, "Supplier directory. Add a supplier below if the name is new.")}
      <button type="submit">${esc(t(locale, "Create purchase order"))}</button>
    </form>
    <h2>${esc(t(locale, "Add supplier"))}</h2>
    <form class="stack" method="post" action="/purchasing/suppliers">
      <input type="hidden" name="next" value="/purchasing/new">
      ${fieldBlock(locale, "Company", `<input type="text" name="company_name" required>`, "Supplier company name.")}
      ${fieldBlock(locale, "Main contact", `<input type="text" name="main_contact">`, "Main contact at the supplier.")}
      ${fieldBlock(locale, "Phone", `<input type="text" name="phone">`, "Phone for the supplier directory.")}
      <button type="submit">${esc(t(locale, "Add supplier"))}</button>
    </form>`;
}

export type PoRecord = {
  id: string;
  po_number: string;
  name: string;
  po_class: string | null;
  project: string | null;
  supplier_id: string;
  supplier_name: string | null;
  status: string;
  issued_at: string | null;
  closed_at: string | null;
  created_at: string;
  created_by_name: string | null;
  eval_quality: number | null;
  eval_documents: number | null;
  eval_timing: number | null;
  eval_notes: string | null;
};

export type ChangeLogRow = {
  field: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  changed_at: string;
  actor_name: string | null;
};

export function purchaseOrderPage(
  po: PoRecord,
  lines: PoLineRow[],
  activity: ChangeLogRow[],
  rapidFocus: boolean,
  locale: Locale = "en"
): string {
  const total = formatUsd(poLinesTotalCents(lines));
  const lineRows =
    lines.length === 0
      ? `<tr><td colspan="6">${esc(t(locale, "No lines yet."))}</td></tr>`
      : lines
          .map(
            (line) => `<tr>
        <td>${esc(line.item_code ?? "")}</td>
        <td>${esc(line.description)}</td>
        <td>${esc(line.uom)}</td>
        <td>${esc(String(line.qty))}</td>
        <td>${esc(formatUsd(line.unit_price_cents))}</td>
        <td>${esc(formatUsd(lineTotalCents(line.qty, line.unit_price_cents)))}</td>
        <td class="row-actions">
          ${pencilLink(`/record/purchase_order_lines/${line.id}/edit`, locale, "Edit line")}
          ${voidLink(`/record/purchase_order_lines/${line.id}/void`, locale, "Void line")}
        </td>
      </tr>`
          )
          .join("");
  const focusAttr = rapidFocus ? " data-rapid-focus" : "";
  const actions =
    po.status === "draft"
      ? `<form method="post" action="/purchasing/po/${esc(po.id)}/issue"><button type="submit">${esc(t(locale, "Issue"))}</button></form>`
      : po.status === "open"
        ? `<form class="stack" method="post" action="/purchasing/po/${esc(po.id)}/close">
            <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
            <button type="submit">${esc(t(locale, "Close"))}</button>
          </form>
          <form class="stack" method="post" action="/purchasing/po/${esc(po.id)}/cancel">
            <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
            <button type="submit" class="danger">${esc(t(locale, "Cancel"))}</button>
          </form>`
        : "";
  const evalBlock =
    po.status === "closed"
      ? `<h2>${esc(t(locale, "Supplier evaluation"))}</h2>
        <p class="muted">${esc(t(locale, "Bad 0 Average 5 Excellent 10"))}</p>
        <form class="stack" method="post" action="/purchasing/po/${esc(po.id)}/eval">
          ${fieldBlock(locale, "Quality", `<input type="number" name="eval_quality" min="0" max="10" value="${esc(String(po.eval_quality ?? ""))}">`, "Quality 0 to 10. Bad 0, Average 5, Excellent 10.")}
          ${fieldBlock(locale, "Documents", `<input type="number" name="eval_documents" min="0" max="10" value="${esc(String(po.eval_documents ?? ""))}">`, "Documents 0 to 10. Bad 0, Average 5, Excellent 10.")}
          ${fieldBlock(locale, "Timing", `<input type="number" name="eval_timing" min="0" max="10" value="${esc(String(po.eval_timing ?? ""))}">`, "Timing 0 to 10. Bad 0, Average 5, Excellent 10.")}
          ${fieldBlock(locale, "Notes", `<textarea name="eval_notes">${esc(po.eval_notes ?? "")}</textarea>`, "Close-time notes on the supplier.")}
          <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
          <button type="submit">${esc(t(locale, "Save evaluation"))}</button>
        </form>`
      : "";
  const activityRows = activity
    .map(
      (a) => `<tr>
        <td>${esc(a.changed_at)}</td>
        <td>${esc(a.actor_name ?? "")}</td>
        <td>${esc(a.field)}</td>
        <td>${esc(a.old_value ?? "")}</td>
        <td>${esc(a.new_value ?? "")}</td>
        <td>${esc(a.reason)}</td>
      </tr>`
    )
    .join("");
  return `<h1>${esc(po.po_number)} ${esc(po.name)}</h1>
    <p><a class="btn secondary" href="/purchasing/po/${esc(po.id)}/print">${esc(t(locale, "Print or save as PDF"))}</a></p>
    <p>${statusPill(po.status, locale)}
      ${esc(t(locale, "Supplier"))}: ${esc(po.supplier_name ?? "")}
      ${esc(t(locale, "Class"))}: ${esc(po.po_class ?? "")}
      ${esc(t(locale, "Project"))}: ${esc(po.project ?? "")}
    </p>
    <p class="muted">${esc(t(locale, "Created"))}: ${esc(po.created_at)} ${esc(po.created_by_name ?? "")}
      ${po.issued_at ? `${esc(t(locale, "Issued"))}: ${esc(po.issued_at)}` : ""}
    </p>
    <table class="data">
      <thead><tr>
        <th>${esc(t(locale, "Item code"))}</th>
        <th>${esc(t(locale, "Description"))}</th>
        <th>${esc(t(locale, "UOM"))}</th>
        <th>${esc(t(locale, "Qty"))}</th>
        <th>${esc(t(locale, "Unit price"))}</th>
        <th>${esc(t(locale, "Total"))}</th>
        <th></th>
      </tr></thead>
      <tbody>${lineRows}</tbody>
    </table>
    <p><strong>${esc(t(locale, "TOTAL"))} ${esc(total)}</strong></p>
    ${po.status === "draft" || po.status === "open" ? `<form class="row-actions" method="post" action="/purchasing/po/${esc(po.id)}/lines">
      <input type="text" name="item_code" placeholder="${esc(t(locale, "Item code"))}"${focusAttr}>
      <input type="text" name="description" placeholder="${esc(t(locale, "Description"))}" required>
      <input type="text" name="uom" value="each" placeholder="${esc(t(locale, "UOM"))}">
      <input type="number" name="qty" step="0.01" min="0" value="1" required>
      <input type="number" name="unit_price" step="0.01" min="0" value="0" required>
      <button type="submit">${esc(t(locale, "Add line"))}</button>
      ${rapidAddButton(locale)}
    </form>` : ""}
    ${actions}
    ${evalBlock}
    <h2>${esc(t(locale, "Activity"))}</h2>
    <table class="data">
      <thead><tr>
        <th>${esc(t(locale, "When"))}</th>
        <th>${esc(t(locale, "Who"))}</th>
        <th>${esc(t(locale, "Field"))}</th>
        <th>${esc(t(locale, "Old"))}</th>
        <th>${esc(t(locale, "New"))}</th>
        <th>${esc(t(locale, "Reason"))}</th>
      </tr></thead>
      <tbody>${activityRows || `<tr><td colspan="6">${esc(t(locale, "No activity yet."))}</td></tr>`}</tbody>
    </table>
    ${rapidFocusScript(rapidFocus)}`;
}

export function purchaseOrderPrintHtml(po: PoRecord, lines: PoLineRow[], locale: Locale = "en"): string {
  const total = formatUsd(poLinesTotalCents(lines));
  const body = lines
    .map(
      (line) => `<tr>
        <td>${esc(line.item_code ?? "")}</td>
        <td>${esc(line.description)}</td>
        <td>${esc(line.uom)}</td>
        <td>${esc(String(line.qty))}</td>
        <td>${esc(formatUsd(line.unit_price_cents))}</td>
        <td>${esc(formatUsd(lineTotalCents(line.qty, line.unit_price_cents)))}</td>
      </tr>`
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <title>${esc(po.po_number)}</title>
  <style>
    body { font-family: Georgia, serif; margin: 1.5rem; color: #1a1a1a; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #bbb; padding: 0.35rem 0.5rem; text-align: left; }
    .print-bar { margin: 0 0 1rem; }
    @media print { .print-bar { display: none; } }
  </style>
</head>
<body data-po-print="1">
  <div class="print-bar"><button type="button" onclick="window.print()">${esc(t(locale, "Print or save as PDF"))}</button></div>
  <h1>${esc(po.po_number)} ${esc(po.name)}</h1>
  <p>${esc(t(locale, "Supplier"))}: ${esc(po.supplier_name ?? "")}</p>
  <table><thead><tr>
    <th>${esc(t(locale, "Item code"))}</th><th>${esc(t(locale, "Description"))}</th>
    <th>${esc(t(locale, "UOM"))}</th><th>${esc(t(locale, "Qty"))}</th>
    <th>${esc(t(locale, "Unit price"))}</th><th>${esc(t(locale, "Total"))}</th>
  </tr></thead><tbody>${body}</tbody></table>
  <p><strong>${esc(t(locale, "TOTAL"))} ${esc(total)}</strong></p>
  <script>window.addEventListener("load", function () { window.print(); });</script>
</body>
</html>`;
}

export type SupplierRow = {
  id: string;
  company_name: string;
  main_contact: string | null;
  phone: string | null;
  status: string;
  po_count: number;
};

export function suppliersPage(rows: SupplierRow[], locale: Locale = "en"): string {
  const body =
    rows.length === 0
      ? `<tr><td colspan="5">${esc(t(locale, "No suppliers yet."))}</td></tr>`
      : rows
          .map(
            (s) => `<tr>
        <td>${esc(s.company_name)}</td>
        <td>${esc(s.main_contact ?? "")}</td>
        <td>${esc(s.phone ?? "")}</td>
        <td>${statusPill(s.status, locale)}</td>
        <td>${esc(String(s.po_count))}</td>
        <td class="row-actions">
          ${pencilLink(`/record/suppliers/${s.id}/edit`, locale, "Edit supplier")}
          ${s.status === "active" ? `<form method="post" action="/purchasing/suppliers/${esc(s.id)}/deactivate" class="row-actions">
            <input type="text" name="reason" required placeholder="${esc(t(locale, "Reason"))}">
            <button type="submit">${esc(t(locale, "Deactivate"))}</button>
          </form>` : ""}
        </td>
      </tr>`
          )
          .join("");
  return `<h1>${esc(t(locale, "Suppliers"))}</h1>
    <table class="data">
      <thead><tr>
        <th>${esc(t(locale, "Company"))}</th>
        <th>${esc(t(locale, "Main contact"))}</th>
        <th>${esc(t(locale, "Phone"))}</th>
        <th>${esc(t(locale, "Status"))}</th>
        <th>${esc(t(locale, "POs"))}</th>
        <th></th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
    <h2>${esc(t(locale, "Add supplier"))}</h2>
    <form class="stack" method="post" action="/purchasing/suppliers">
      ${fieldBlock(locale, "Company", `<input type="text" name="company_name" required>`, "Supplier company name.")}
      ${fieldBlock(locale, "Main contact", `<input type="text" name="main_contact">`, "Main contact at the supplier.")}
      ${fieldBlock(locale, "Phone", `<input type="text" name="phone">`, "Phone for the supplier directory.")}
      ${fieldBlock(locale, "Notes", `<textarea name="notes"></textarea>`, "Internal notes. Not a portal.")}
      <button type="submit">${esc(t(locale, "Add supplier"))}</button>
    </form>`;
}
