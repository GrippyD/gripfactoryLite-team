import { formatGrams } from "./config";
import { code128Svg } from "./code128";
import { t, type Locale } from "./i18n";
import { qrSvg } from "./qr";
import { esc, fieldBlock } from "./ui";

export const LABEL_FIELD_KEYS = [
  "item_or_strain",
  "package_tag",
  "tag_barcode",
  "potency",
  "net_weight",
  "packaged_date",
  "license_number",
  "facility_name",
  "free_text",
] as const;
export type LabelFieldKey = (typeof LABEL_FIELD_KEYS)[number];

export const LABEL_FIELD_LABELS: Record<LabelFieldKey, string> = {
  item_or_strain: "Item or strain name",
  package_tag: "Package tag",
  tag_barcode: "Tag barcode",
  potency: "Potency",
  net_weight: "Net weight",
  packaged_date: "Packaged date",
  license_number: "License number",
  facility_name: "Facility name",
  free_text: "Free-text line",
};

export type BarcodeMode = "1d" | "2d" | "both";

export type LabelFieldsJson = {
  fields: LabelFieldKey[];
  free_text?: string;
  barcode_mode?: BarcodeMode;
};

export const LABEL_STOCK_MM: Record<string, { width_mm: number; height_mm: number }> = {
  "4x6": { width_mm: 101.6, height_mm: 152.4 },
  "2x1": { width_mm: 50.8, height_mm: 25.4 },
};

export function parseLabelFields(raw: string): LabelFieldsJson {
  try {
    const data = JSON.parse(raw) as LabelFieldsJson;
    const fields = (data.fields ?? []).filter((k): k is LabelFieldKey =>
      (LABEL_FIELD_KEYS as readonly string[]).includes(k)
    );
    const mode = data.barcode_mode;
    const barcode_mode: BarcodeMode = mode === "2d" || mode === "both" || mode === "1d" ? mode : "1d";
    return { fields, free_text: data.free_text, barcode_mode };
  } catch {
    return { fields: [], barcode_mode: "1d" };
  }
}

export function serializeLabelFields(fields: LabelFieldsJson): string {
  return JSON.stringify(fields);
}

export type LabelTemplateRow = {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  fields_json: string;
};

export type LabelPackage = {
  id: string;
  tag: string;
  item_or_strain: string;
  potency: string;
  net_weight_grams: number | null;
  packaged_date: string;
  license_number: string;
  facility_name: string;
};

export function labelsPage(
  templates: LabelTemplateRow[],
  packages: LabelPackage[],
  stocks: Array<{ value: string; label: string }>,
  printers: Array<{ value: string; label: string }>,
  locale: Locale = "en"
): string {
  const stockOpts = stocks.map((s) => `<option value="${esc(s.value)}">${esc(s.label)}</option>`).join("");
  const pkgOpts = packages
    .map((p) => `<option value="${esc(p.id)}">${esc(p.tag)} ${esc(p.item_or_strain)}</option>`)
    .join("");
  const tplOpts = templates.map((trow) => `<option value="${esc(trow.id)}">${esc(trow.name)}</option>`).join("");
  const boxes = LABEL_FIELD_KEYS.map(
    (key) => `<label class="field"><span><input type="checkbox" name="field" value="${esc(key)}"> ${esc(t(locale, LABEL_FIELD_LABELS[key]))}</span></label>`
  ).join("");
  const printerList =
    printers.length === 0
      ? `<p class="muted">${esc(t(locale, "No printers registered yet. Add names in Admin."))}</p>`
      : `<ul>${printers.map((p) => `<li>${esc(p.label)}</li>`).join("")}</ul>`;
  const saved =
    templates.length === 0
      ? `<p class="muted">${esc(t(locale, "No templates yet."))}</p>`
      : `<table class="data"><thead><tr><th>${esc(t(locale, "Name"))}</th><th>mm</th></tr></thead><tbody>${templates
          .map(
            (row) =>
              `<tr><td>${esc(row.name)}</td><td>${esc(String(row.width_mm))} x ${esc(String(row.height_mm))}</td></tr>`
          )
          .join("")}</tbody></table>`;
  return `<h1>${esc(t(locale, "Labels"))}</h1>
    <p class="muted">${esc(t(locale, "Printers are browser-printed devices on standard hardware. The Worker has no driver integration. Pick any OS-installed label printer in the browser dialog."))}</p>
    <h2>${esc(t(locale, "Printers on the floor"))}</h2>
    ${printerList}
    <p class="muted">${esc(t(locale, "Register printer names and stock in Admin\\Data Lookups\\Business Operations\\Label printers"))}</p>
    <h2>${esc(t(locale, "Templates"))}</h2>
    ${saved}
    <form class="stack" method="post" action="/compliance/labels/templates">
      ${fieldBlock(locale, "Name", `<input type="text" name="name" required>`, "Template name the floor picks at print time.")}
      ${fieldBlock(locale, "Stock", `<select name="stock"><option value="">${esc(t(locale, "Custom mm"))}</option>${stockOpts}</select>`, "Thermal stock size. Admin\\Data Lookups\\Business Operations\\Label stock")}
      ${fieldBlock(locale, "Width mm", `<input type="number" name="width_mm" step="0.1" min="1">`, "Custom width in millimeters when stock is not picked.")}
      ${fieldBlock(locale, "Height mm", `<input type="number" name="height_mm" step="0.1" min="1">`, "Custom height in millimeters when stock is not picked.")}
      <fieldset>
        <legend>${esc(t(locale, "Fields"))}</legend>
        ${boxes}
      </fieldset>
      ${fieldBlock(locale, "Barcode", `<select name="barcode_mode"><option value="1d">1D</option><option value="2d">2D</option><option value="both">${esc(t(locale, "both"))}</option></select>`, "1D is Code 128. 2D is QR. Both prints both.")}
      ${fieldBlock(locale, "Free-text line", `<input type="text" name="free_text">`, "Optional line printed when Free-text line is checked.")}
      <button type="submit">${esc(t(locale, "Save template"))}</button>
    </form>
    <h2>${esc(t(locale, "Print"))}</h2>
    <form class="stack" method="get" action="/compliance/labels/print">
      ${fieldBlock(locale, "Template", `<select name="template" required>${tplOpts}</select>`, "Saved template that sizes the page.")}
      ${fieldBlock(locale, "Package", `<select name="package" required>${pkgOpts}</select>`, "Live package from local inventory or testing. The tag is never typed.")}
      <button type="submit">${esc(t(locale, "Print preview"))}</button>
    </form>`;
}

export function labelPrintHtml(
  template: LabelTemplateRow,
  pkg: LabelPackage,
  locale: Locale = "en"
): string {
  const spec = parseLabelFields(template.fields_json);
  const mode = spec.barcode_mode ?? "1d";
  const blocks: string[] = [];
  for (const key of spec.fields) {
    if (key === "item_or_strain") blocks.push(`<div class="lbl-line lbl-name">${esc(pkg.item_or_strain)}</div>`);
    else if (key === "package_tag") blocks.push(`<div class="lbl-line lbl-tag">${esc(pkg.tag)}</div>`);
    else if (key === "tag_barcode") {
      const codes: string[] = [];
      if (mode === "1d" || mode === "both") codes.push(code128Svg(pkg.tag));
      if (mode === "2d" || mode === "both") codes.push(qrSvg(pkg.tag));
      blocks.push(`<div class="lbl-codes">${codes.join("")}</div>`);
    } else if (key === "potency") blocks.push(`<div class="lbl-line">${esc(t(locale, "Potency"))}: ${esc(pkg.potency)}</div>`);
    else if (key === "net_weight") {
      const w = pkg.net_weight_grams == null ? "" : `${formatGrams(pkg.net_weight_grams)} g`;
      blocks.push(`<div class="lbl-line">${esc(t(locale, "Net weight"))}: ${esc(w)}</div>`);
    } else if (key === "packaged_date") {
      blocks.push(`<div class="lbl-line">${esc(t(locale, "Packaged date"))}: ${esc(pkg.packaged_date)}</div>`);
    } else if (key === "license_number") {
      blocks.push(`<div class="lbl-line">${esc(t(locale, "License number"))}: ${esc(pkg.license_number)}</div>`);
    } else if (key === "facility_name") {
      blocks.push(`<div class="lbl-line">${esc(t(locale, "Facility name"))}: ${esc(pkg.facility_name)}</div>`);
    } else if (key === "free_text") {
      blocks.push(`<div class="lbl-line">${esc(spec.free_text ?? "")}</div>`);
    }
  }
  const w = Number(template.width_mm);
  const h = Number(template.height_mm);
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <title>${esc(template.name)}</title>
  <style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    html, body { margin: 0; padding: 0; width: ${w}mm; height: ${h}mm; background: #fff; color: #000; }
    .label { box-sizing: border-box; width: ${w}mm; height: ${h}mm; padding: 2mm; font-family: sans-serif; font-size: 11pt; background: #fff; color: #000; }
    .lbl-name { font-weight: 700; font-size: 14pt; }
    .lbl-tag { font-family: ui-monospace, monospace; }
    .lbl-codes svg { max-width: 100%; height: auto; display: block; margin: 1mm 0; }
    .print-bar { margin: 8px; }
    @media print { .print-bar { display: none; } }
  </style>
</head>
<body data-label-print="1">
  <div class="print-bar">
    <button type="button" onclick="window.print()">${esc(t(locale, "Print"))}</button>
  </div>
  <div class="label">${blocks.join("")}</div>
  <script>window.addEventListener("load", function () { window.print(); });</script>
</body>
</html>`;
}

export function stockMm(stock: string, widthRaw: string | null, heightRaw: string | null): { width_mm: number; height_mm: number } {
  const known = LABEL_STOCK_MM[stock];
  if (known) return known;
  const width_mm = Number(widthRaw);
  const height_mm = Number(heightRaw);
  if (!Number.isFinite(width_mm) || !Number.isFinite(height_mm) || width_mm <= 0 || height_mm <= 0) {
    return LABEL_STOCK_MM["4x6"];
  }
  return { width_mm, height_mm };
}
