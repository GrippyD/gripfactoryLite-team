import { t, type Locale } from "./i18n";
import { esc } from "./ui";

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

/** L1 THE LABEL EDITOR (canon 0.30.386). Three buttons. The old template form is gone. */
export function labelsMenuPage(locale: Locale = "en"): string {
  const button = (key: string, href: string, label: string) =>
    `<a class="le-menu-btn" data-labels="${key}" href="${href}">${esc(t(locale, label))}</a>`;
  return `<h1>${esc(t(locale, "Labels"))}</h1>
    <nav class="le-menu" data-labels-menu>
      ${button("quick-print", "/compliance/labels/print", "Quick Print")}
      ${button("editor", "/compliance/labels/editor", "Label Editor")}
      ${button("data", "/compliance/labels/data", "Custom Label Data")}
    </nav>`;
}

export function labelsSoonPage(locale: Locale = "en"): string {
  return `<h1>${esc(t(locale, "Labels"))}</h1>
    <p data-labels-soon="slices">${esc(t(locale, "Coming in the next slices"))}</p>
    <p><a href="/compliance/labels">${esc(t(locale, "Labels"))}</a></p>`;
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
