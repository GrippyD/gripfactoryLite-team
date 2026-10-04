/**
 * L1 THE LABEL EDITOR (canon 0.30.386).
 * The layout is versioned JSON (v: 1). Length is across, width is down, inches.
 * Print is one browser page the size of the label. Codes are the app's own
 * Code 128 and QR, drawn as vectors.
 */

import { code128Svg } from "./code128";
import { t, type Locale } from "./i18n";
import { labelIcon, type LabelIconName } from "./labelicons";
import { qrSvg } from "./qr";
import { esc } from "./ui";

export const LABEL_FONTS = ["Arial", "Times New Roman", "Courier New", "Georgia", "Verdana"] as const;
export type LabelFont = (typeof LABEL_FONTS)[number];

export const PICTURE_MAX_BYTES = 1024 * 1024;
export const INCH_MIN = 0.5;
export const INCH_MAX = 12;

const FONT_CSS: Record<LabelFont, string> = {
  Arial: "Arial, Helvetica, sans-serif",
  "Times New Roman": "'Times New Roman', Times, serif",
  "Courier New": "'Courier New', Courier, monospace",
  Georgia: "Georgia, serif",
  Verdana: "Verdana, Geneva, sans-serif",
};

export type Align = "left" | "center" | "right";
export type MemoKind = "text" | "number" | "alphanumeric";
export type ShapeKind = "rect" | "ellipse" | "roundrect" | "triangle";
export type DashKind = "solid" | "dashed" | "dotted";
export type PictureMime = "image/jpeg" | "image/png" | "image/bmp";

type Box = { id: string; x: number; y: number; w: number; h: number; rotate: number };

export type TextObj = Box & {
  type: "text";
  text: string;
  font: LabelFont;
  size: number;
  bold: boolean;
  italic: boolean;
  align: Align;
  attach: string | null;
};

export type MemoObj = Box & {
  type: "memo";
  text: string;
  memo: MemoKind;
  font: LabelFont;
  size: number;
  bold: boolean;
  italic: boolean;
  align: Align;
  attach: string | null;
};

export type CodeObj = Box & {
  type: "barcode" | "qr";
  data: string;
  caption: boolean;
  attach: string | null;
};

export type PictureObj = Box & {
  type: "picture";
  mime: PictureMime;
  filename: string;
  bytes: string;
};

export type ShapeObj = Box & {
  type: "shape";
  shape: ShapeKind;
  stroke: number;
  fill: "none" | "black";
};

export type LineObj = {
  id: string;
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  dashes: DashKind;
};

export type LabelObject = TextObj | MemoObj | CodeObj | PictureObj | ShapeObj | LineObj;
export type LabelLayout = { v: 1; objects: LabelObject[] };

export class LayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LayoutError";
  }
}

export function emptyLayout(): LabelLayout {
  return { v: 1, objects: [] };
}

export function inchesToMm(inches: number): number {
  return Math.round(inches * 25.4 * 100) / 100;
}

export function parseLabelInches(raw: unknown): number {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) throw new LayoutError("Length and width are inches from 0.5 to 12.");
  const rounded = Math.round(n * 100) / 100;
  if (rounded < INCH_MIN || rounded > INCH_MAX) throw new LayoutError("Length and width are inches from 0.5 to 12.");
  return rounded;
}

/** Admin's label_stock values, "4x6" and "2 x 1", as length across and width down. */
export function stockToInches(value: string, label: string): { lengthIn: number; widthIn: number } | null {
  const match = `${value} ${label}`.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const lengthIn = Number(match[1]);
  const widthIn = Number(match[2]);
  if (lengthIn < INCH_MIN || lengthIn > INCH_MAX || widthIn < INCH_MIN || widthIn > INCH_MAX) return null;
  return { lengthIn: Math.round(lengthIn * 100) / 100, widthIn: Math.round(widthIn * 100) / 100 };
}

export function holdsData(obj: LabelObject): obj is TextObj | MemoObj | CodeObj {
  return obj.type === "text" || obj.type === "memo" || obj.type === "barcode" || obj.type === "qr";
}

export function ownData(obj: LabelObject): string {
  if (obj.type === "text" || obj.type === "memo") return obj.text;
  if (obj.type === "barcode" || obj.type === "qr") return obj.data;
  return "";
}

export function resolveData(objects: LabelObject[], id: string): { text: string; cycle: boolean } {
  const byId = new Map(objects.map((obj) => [obj.id, obj]));
  const seen = new Set<string>();
  let cur = byId.get(id);
  if (!cur) return { text: "", cycle: false };
  while (holdsData(cur) && cur.attach) {
    if (seen.has(cur.id)) return { text: "", cycle: true };
    seen.add(cur.id);
    const next = byId.get(cur.attach);
    if (!next || !holdsData(next)) break;
    cur = next;
  }
  return { text: ownData(cur), cycle: false };
}

/** True when pointing `fromId` at `toId` would loop, including a self attach. */
export function wouldCycle(objects: LabelObject[], fromId: string, toId: string): boolean {
  if (fromId === toId) return true;
  const byId = new Map(objects.map((obj) => [obj.id, obj]));
  const seen = new Set<string>();
  let cur = byId.get(toId);
  while (cur) {
    if (cur.id === fromId) return true;
    if (seen.has(cur.id)) return true;
    seen.add(cur.id);
    if (!holdsData(cur) || !cur.attach) return false;
    cur = byId.get(cur.attach);
  }
  return false;
}

function num(raw: unknown, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n * 1000) / 1000;
}

function wholeDeg(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
}

function quarterDeg(raw: unknown): number {
  return (Math.round(wholeDeg(raw) / 90) * 90) % 360;
}

function fontOf(raw: unknown): LabelFont {
  return (LABEL_FONTS as readonly string[]).includes(String(raw)) ? (String(raw) as LabelFont) : "Arial";
}

function alignOf(raw: unknown): Align {
  return raw === "center" || raw === "right" ? raw : "left";
}

function memoOf(raw: unknown): MemoKind {
  return raw === "number" || raw === "alphanumeric" ? raw : "text";
}

function clampSize(raw: unknown, fallback: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(96, Math.max(6, n));
}

function clampStroke(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2;
  return Math.min(12, Math.max(0.5, Math.round(n * 10) / 10));
}

function idOf(raw: unknown, seen: Set<string>): string {
  const id = String(raw ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || seen.has(id)) throw new LayoutError("The label could not be read.");
  seen.add(id);
  return id;
}

function boxOf(raw: Record<string, unknown>, id: string, rotate: number): Box {
  const w = Math.max(0.125, num(raw.w, 1));
  const h = Math.max(0.125, num(raw.h, 0.4));
  return { id, x: num(raw.x), y: num(raw.y), w, h, rotate };
}

function attachOf(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const id = String(raw);
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new LayoutError("The label could not be read.");
  return id;
}

function base64Size(b64: string): number {
  const clean = b64.replaceAll(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) {
    throw new LayoutError("A picture must be a JPEG, PNG, or BMP.");
  }
  const pad = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - pad;
}

function pictureBytes(raw: unknown, mimeHint: unknown): { mime: PictureMime; bytes: string } {
  let text = String(raw ?? "");
  let mime = String(mimeHint ?? "");
  const wrapped = text.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);
  if (wrapped && wrapped[2]) {
    mime = wrapped[1];
    text = wrapped[3];
  }
  const mimeNorm =
    mime === "image/jpg" || mime === "image/jpeg"
      ? "image/jpeg"
      : mime === "image/png"
        ? "image/png"
        : mime === "image/bmp" || mime === "image/x-ms-bmp"
          ? "image/bmp"
          : "";
  if (!mimeNorm) throw new LayoutError("A picture must be a JPEG, PNG, or BMP.");
  const bytes = text.replaceAll(/\s/g, "");
  if (base64Size(bytes) > PICTURE_MAX_BYTES) throw new LayoutError("That picture is over 1 MB.");
  return { mime: mimeNorm, bytes };
}

export function normalizeLayout(raw: unknown): LabelLayout {
  if (!raw || typeof raw !== "object") throw new LayoutError("The label could not be read.");
  const body = raw as { v?: unknown; objects?: unknown };
  if (body.v !== 1 || !Array.isArray(body.objects)) throw new LayoutError("The label could not be read.");
  const seen = new Set<string>();
  const objects: LabelObject[] = body.objects.map((item) => {
    if (!item || typeof item !== "object") throw new LayoutError("The label could not be read.");
    const row = item as Record<string, unknown>;
    const id = idOf(row.id, seen);
    const type = String(row.type ?? "");
    if (type === "text" || type === "memo") {
      const obj = {
        ...boxOf(row, id, wholeDeg(row.rotate)),
        type,
        text: String(row.text ?? ""),
        font: fontOf(row.font),
        size: clampSize(row.size, 12),
        bold: Boolean(row.bold),
        italic: Boolean(row.italic),
        align: alignOf(row.align),
        attach: attachOf(row.attach),
      };
      if (type === "memo") return { ...obj, type: "memo", memo: memoOf(row.memo) };
      return { ...obj, type: "text" };
    }
    if (type === "barcode" || type === "qr") {
      return {
        ...boxOf(row, id, quarterDeg(row.rotate)),
        type,
        data: String(row.data ?? ""),
        caption: Boolean(row.caption),
        attach: attachOf(row.attach),
      };
    }
    if (type === "picture") {
      const pic = pictureBytes(row.bytes, row.mime);
      return {
        ...boxOf(row, id, quarterDeg(row.rotate)),
        type: "picture",
        mime: pic.mime,
        filename: String(row.filename ?? "").slice(0, 120),
        bytes: pic.bytes,
      };
    }
    if (type === "shape") {
      const shape = row.shape === "ellipse" || row.shape === "roundrect" || row.shape === "triangle" ? row.shape : "rect";
      return {
        ...boxOf(row, id, wholeDeg(row.rotate)),
        type: "shape",
        shape,
        stroke: clampStroke(row.stroke),
        fill: row.fill === "black" ? "black" : "none",
      };
    }
    if (type === "line") {
      const dashes = row.dashes === "dashed" || row.dashes === "dotted" ? row.dashes : "solid";
      return {
        id,
        type: "line",
        x1: num(row.x1),
        y1: num(row.y1),
        x2: num(row.x2),
        y2: num(row.y2),
        thickness: clampStroke(row.thickness),
        dashes,
      };
    }
    throw new LayoutError("The label could not be read.");
  });
  for (const obj of objects) {
    if (!holdsData(obj) || !obj.attach) continue;
    const target = objects.find((item) => item.id === obj.attach);
    if (!target || !holdsData(target)) throw new LayoutError("Attach only to an object that holds text or a code.");
    if (wouldCycle(objects, obj.id, obj.attach)) throw new LayoutError("Those objects attach in a circle.");
  }
  return { v: 1, objects };
}

export function emptyFieldsJson(): string {
  return JSON.stringify({ fields: [] });
}

function shownText(objects: LabelObject[], obj: LabelObject): string {
  if (!holdsData(obj)) return "";
  if (obj.attach) return resolveData(objects, obj.id).text;
  return ownData(obj);
}

function codeMarkup(kind: "barcode" | "qr", text: string): string {
  if (!text) return "";
  try {
    return kind === "qr" ? qrSvg(text) : code128Svg(text);
  } catch {
    return "";
  }
}

export function labelCodeSvg(kind: string, text: string): string {
  const clipped = text.slice(0, 256);
  if (kind === "qr") return codeMarkup("qr", clipped);
  return codeMarkup("barcode", clipped);
}

function dashArray(dashes: DashKind): string {
  if (dashes === "dashed") return ' stroke-dasharray="0.1 0.06"';
  if (dashes === "dotted") return ' stroke-dasharray="0.02 0.05"';
  return "";
}

function shapeSvg(obj: ShapeObj): string {
  const fill = obj.fill === "black" ? "#000" : "none";
  const stroke = `stroke="#000" stroke-width="${obj.stroke}" vector-effect="non-scaling-stroke" fill="${fill}"`;
  let body = `<rect x="2" y="2" width="96" height="96" ${stroke}/>`;
  if (obj.shape === "ellipse") body = `<ellipse cx="50" cy="50" rx="46" ry="46" ${stroke}/>`;
  else if (obj.shape === "roundrect") body = `<rect x="2" y="2" width="96" height="96" rx="14" ${stroke}/>`;
  else if (obj.shape === "triangle") body = `<polygon points="50,4 96,96 4,96" ${stroke}/>`;
  return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">${body}</svg>`;
}

function boxStyle(obj: Box): string {
  return `left:${num(obj.x)}in;top:${num(obj.y)}in;width:${num(obj.w)}in;height:${num(obj.h)}in;transform:rotate(${obj.rotate}deg)`;
}

function textStyle(obj: TextObj | MemoObj): string {
  return `font-family:${FONT_CSS[obj.font]};font-size:${obj.size}pt;font-weight:${obj.bold ? 700 : 400};font-style:${obj.italic ? "italic" : "normal"};text-align:${obj.align};${obj.type === "memo" ? "white-space:pre-wrap;" : "white-space:nowrap;"}`;
}

/** The print document. `@page` size is the label, and every object is placed in inches. */
export function labelLayoutPrintHtml(layout: LabelLayout, lengthIn: number, widthIn: number, name: string, locale: Locale = "en"): string {
  const blocks: string[] = [];
  const lines: string[] = [];
  for (const obj of layout.objects) {
    if (obj.type === "line") {
      lines.push(
        `<line x1="${num(obj.x1)}" y1="${num(obj.y1)}" x2="${num(obj.x2)}" y2="${num(obj.y2)}" stroke="#000" stroke-width="${num(obj.thickness / 72)}" stroke-linecap="round"${dashArray(obj.dashes)}/>`
      );
      continue;
    }
    const shown = shownText(layout.objects, obj);
    let inner = "";
    if (obj.type === "text" || obj.type === "memo") {
      inner = `<div class="le-print-text" style="${textStyle(obj)}">${esc(shown)}</div>`;
    } else if (obj.type === "barcode" || obj.type === "qr") {
      const caption = obj.caption
        ? `<div class="le-print-caption" style="font-size:${Math.max(6, Math.round(obj.h * 72 * 0.28))}pt">${esc(shown)}</div>`
        : "";
      inner = `<div class="le-print-code">${codeMarkup(obj.type, shown)}</div>${caption}`;
    } else if (obj.type === "picture") {
      inner = `<img alt="" src="data:${obj.mime};base64,${obj.bytes}"/>`;
    } else if (obj.type === "shape") {
      inner = shapeSvg(obj);
    } else {
      inner = "";
    }
    const shapeAttr = obj.type === "shape" ? ` data-le-shape="${obj.shape}"` : "";
    blocks.push(
      `<div class="le-print-obj" data-le-type="${obj.type}"${shapeAttr} style="${boxStyle(obj)}">${inner}</div>`
    );
  }
  const lineSvg =
    lines.length === 0
      ? ""
      : `<svg class="le-print-lines" viewBox="0 0 ${num(lengthIn)} ${num(widthIn)}" width="${num(lengthIn)}in" height="${num(widthIn)}in">${lines.join("")}</svg>`;
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <title>${esc(name)}</title>
  <style>
    @page { size: ${num(lengthIn)}in ${num(widthIn)}in; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    .label { position: relative; width: ${num(lengthIn)}in; height: ${num(widthIn)}in; background: #fff; color: #000; overflow: hidden; }
    .le-print-obj { position: absolute; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; transform-origin: center center; }
    .le-print-text { width: 100%; height: 100%; overflow: hidden; margin: 0; }
    .le-print-code { flex: 1; min-height: 0; }
    .le-print-code svg { width: 100%; height: 100%; display: block; }
    .le-print-caption { text-align: center; line-height: 1; color: #000; }
    .le-print-obj img { width: 100%; height: 100%; object-fit: fill; }
    .le-print-lines { position: absolute; left: 0; top: 0; overflow: visible; }
    .print-bar { margin: 8px; }
    @media print { .print-bar { display: none; } }
  </style>
</head>
<body data-label-print="1">
  <div class="print-bar"><button type="button" onclick="window.print()">${esc(t(locale, "Print"))}</button></div>
  <div class="label">${blocks.join("")}${lineSvg}</div>
  <script>window.addEventListener("load", function () { window.print(); });</script>
</body>
</html>`;
}

export type EditorTemplate = {
  id: string;
  name: string;
  length_in: number | null;
  width_in: number | null;
  width_mm: number | null;
  height_mm: number | null;
  updated_at: string;
  saved_by_name: string;
  layout_json: string | null;
};

export type EditorStock = { value: string; label: string; lengthIn: number; widthIn: number };

const WORD_KEYS = [
  "Open Template",
  "Save Template",
  "New",
  "Print",
  "Connections",
  "Text Box",
  "Memo",
  "Barcode",
  "QR",
  "Picture",
  "Shapes",
  "Line",
  "Exit",
  "Rectangle",
  "Ellipse",
  "Rounded rectangle",
  "Triangle",
  "The label size",
  "Length is across.",
  "Width is down.",
  "Length",
  "Width",
  "Apply",
  "Options",
  "Font",
  "Size",
  "Bold",
  "Italic",
  "Align",
  "Left",
  "Center",
  "Right",
  "Rotate",
  "Attach",
  "None",
  "Toggle caption",
  "Source Data",
  "Thickness",
  "Dashes",
  "Solid",
  "Dashed",
  "Dotted",
  "Fill",
  "No fill",
  "Black",
  "Text",
  "Number",
  "Alphanumeric",
  "Coming in the next slice",
  "New removes every object on the label.",
  "Save first",
  "Continue without saving",
  "Cancel",
  "Name",
  "A template with that name is already saved. Confirm to replace it.",
  "Last saved",
  "Saved by",
  "Unknown",
  "No templates yet.",
  "Click the label to drop it.",
  "Click once to start the line, again to finish it.",
  "Choose a shape, then click the label.",
  "Choose a JPEG, PNG, or BMP, then click the label.",
  "That picture is over 1 MB.",
  "A picture must be a JPEG, PNG, or BMP.",
  "Those objects attach in a circle.",
  "Length and width are inches from 0.5 to 12.",
  "Replace",
] as const;

function wordsFor(locale: Locale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of WORD_KEYS) out[key] = t(locale, key);
  return out;
}

function toolButton(locale: Locale, tool: string, icon: LabelIconName, label: string): string {
  return `<button type="button" class="le-tool" data-le-tool="${tool}" aria-pressed="false">${labelIcon(icon, t(locale, label))}<span>${esc(t(locale, label))}</span></button>`;
}

function templateSize(row: EditorTemplate): string {
  if (row.length_in != null && row.width_in != null) return `${row.length_in} x ${row.width_in} in`;
  if (row.width_mm != null && row.height_mm != null) return `${row.width_mm} x ${row.height_mm} mm`;
  return "";
}

function whenSaved(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

function editorObjectsHtml(layout: LabelLayout, lengthIn: number, widthIn: number): string {
  const blocks: string[] = [];
  const lines: string[] = [];
  for (const obj of layout.objects) {
    if (obj.type === "line") {
      lines.push(
        `<line data-le-object="1" data-le-type="line" data-le-id="${esc(obj.id)}" x1="${num(obj.x1)}" y1="${num(obj.y1)}" x2="${num(obj.x2)}" y2="${num(obj.y2)}" stroke="#161616" stroke-width="${num(obj.thickness / 72)}"${dashArray(obj.dashes)}/>`
      );
      continue;
    }
    const shown = shownText(layout.objects, obj);
    const attach = holdsData(obj) && obj.attach ? ` data-le-attach="${esc(obj.attach)}"` : "";
    const shapeAttr = obj.type === "shape" ? ` data-le-shape="${obj.shape}"` : "";
    let inner = "";
    if (obj.type === "text" || obj.type === "memo") inner = `<div class="le-text" style="${textStyle(obj)}">${esc(shown)}</div>`;
    else if (obj.type === "barcode" || obj.type === "qr") inner = `<div class="le-code">${codeMarkup(obj.type, shown)}</div>`;
    else if (obj.type === "picture") inner = `<img alt="" src="data:${obj.mime};base64,${obj.bytes}"/>`;
    else if (obj.type === "shape") inner = shapeSvg(obj);
    blocks.push(
      `<div class="le-obj" data-le-object="1" data-le-type="${obj.type}" data-le-id="${esc(obj.id)}"${attach}${shapeAttr} style="${boxStyle(obj)}">${inner}</div>`
    );
  }
  const svg = `<svg class="le-lines" viewBox="0 0 ${num(lengthIn)} ${num(widthIn)}" width="100%" height="100%">${lines.join("")}</svg>`;
  return svg + blocks.join("");
}

export function labelEditorPage(opts: {
  locale: Locale;
  templates: Array<Record<string, unknown>>;
  stocks: Array<{ value: string; label: string }>;
  loaded: Record<string, unknown> | null;
}): string {
  const locale = opts.locale;
  const rows: EditorTemplate[] = opts.templates.map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    length_in: row.length_in == null || row.length_in === "" ? null : Number(row.length_in),
    width_in: row.width_in == null || row.width_in === "" ? null : Number(row.width_in),
    width_mm: row.width_mm == null ? null : Number(row.width_mm),
    height_mm: row.height_mm == null ? null : Number(row.height_mm),
    updated_at: String(row.updated_at ?? ""),
    saved_by_name: String(row.saved_by_name ?? ""),
    layout_json: row.layout_json == null ? null : String(row.layout_json),
  }));
  let lengthIn = 4;
  let widthIn = 6;
  let layout = emptyLayout();
  let name = "";
  if (opts.loaded) {
    const loaded = rows.find((row) => row.id === String(opts.loaded?.id ?? "")) ?? null;
    const source = loaded ?? {
      id: String(opts.loaded.id ?? ""),
      name: String(opts.loaded.name ?? ""),
      length_in: opts.loaded.length_in == null ? null : Number(opts.loaded.length_in),
      width_in: opts.loaded.width_in == null ? null : Number(opts.loaded.width_in),
      width_mm: opts.loaded.width_mm == null ? null : Number(opts.loaded.width_mm),
      height_mm: opts.loaded.height_mm == null ? null : Number(opts.loaded.height_mm),
      updated_at: String(opts.loaded.updated_at ?? ""),
      saved_by_name: "",
      layout_json: opts.loaded.layout_json == null ? null : String(opts.loaded.layout_json),
    };
    name = source.name;
    if (source.length_in != null && source.width_in != null && Number.isFinite(source.length_in) && Number.isFinite(source.width_in)) {
      lengthIn = source.length_in;
      widthIn = source.width_in;
    }
    if (source.layout_json) {
      try {
        layout = normalizeLayout(JSON.parse(source.layout_json));
      } catch {
        layout = emptyLayout();
      }
    }
  }
  const stocks: EditorStock[] = [];
  for (const stock of opts.stocks) {
    const parsed = stockToInches(stock.value, stock.label);
    if (parsed) stocks.push({ value: stock.value, label: stock.label, ...parsed });
  }
  const words = wordsFor(locale);
  const boot = {
    lengthIn,
    widthIn,
    name,
    objects: layout.objects,
    templates: rows.map((row) => ({ id: row.id, name: row.name })),
    stocks,
    fonts: LABEL_FONTS,
    words,
  };
  const bootJson = JSON.stringify(boot).replaceAll("<", "\\u003c");
  const openRows =
    rows.length === 0
      ? `<p class="muted">${esc(t(locale, "No templates yet."))}</p>`
      : `<table class="data le-open-table"><thead><tr><th>${esc(t(locale, "Name"))}</th><th>${esc(t(locale, "Size"))}</th><th>${esc(t(locale, "Last saved"))}</th><th>${esc(t(locale, "Saved by"))}</th></tr></thead><tbody>${rows
          .map((row) => {
            const who = row.saved_by_name || t(locale, "Unknown");
            return `<tr><td><a href="/compliance/labels/editor?template=${esc(row.id)}">${esc(row.name)}</a></td><td>${esc(templateSize(row))}</td><td>${esc(whenSaved(row.updated_at))}</td><td>${esc(who)}</td></tr>`;
          })
          .join("")}</tbody></table>`;
  const stockButtons = stocks
    .map(
      (stock) =>
        `<button type="button" class="le-stock" data-le-stock="${esc(stock.value)}" data-length="${stock.lengthIn}" data-width="${stock.widthIn}">${esc(stock.label)}</button>`
    )
    .join("");
  const shapeButtons = (
    [
      ["rect", "rect", "Rectangle"],
      ["ellipse", "ellipse", "Ellipse"],
      ["roundrect", "roundrect", "Rounded rectangle"],
      ["triangle", "triangle", "Triangle"],
    ] as const
  )
    .map(
      ([kind, icon, label]) =>
        `<button type="button" class="le-tool le-shape" data-le-shape="${kind}" aria-pressed="${kind === "rect" ? "true" : "false"}">${labelIcon(icon, t(locale, label))}<span>${esc(t(locale, label))}</span></button>`
    )
    .join("");
  return `<div id="le-app" class="le-shell" data-label-editor data-le-count="${layout.objects.length}" data-le-length="${num(lengthIn)}" data-le-width="${num(widthIn)}">
    <div class="le-tools">
      ${toolButton(locale, "open", "open", "Open Template")}
      ${toolButton(locale, "save", "save", "Save Template")}
      ${toolButton(locale, "new", "new", "New")}
      ${toolButton(locale, "print", "print", "Print")}
      <button type="button" class="le-tool" data-le-action="connections">${labelIcon("connections", t(locale, "Connections"))}<span>${esc(t(locale, "Connections"))}</span></button>
      <div class="le-pair">
        ${toolButton(locale, "text", "text", "Text Box")}
        ${toolButton(locale, "memo", "memo", "Memo")}
      </div>
      <div class="le-pair">
        ${toolButton(locale, "barcode", "barcode", "Barcode")}
        ${toolButton(locale, "qr", "qr", "QR")}
      </div>
      <div class="le-pair">
        ${toolButton(locale, "picture", "picture", "Picture")}
        ${toolButton(locale, "shapes", "shapes", "Shapes")}
      </div>
      <div id="le-shapes" class="le-shapes" hidden>${shapeButtons}</div>
      ${toolButton(locale, "line", "line", "Line")}
      <div id="le-options" class="le-options">
        <p class="le-options-title">${esc(t(locale, "Options"))}</p>
        <button type="button" data-le-action="source-data">${esc(t(locale, "Source Data"))}</button>
      </div>
      <p id="le-alert" class="le-alert" role="alert"></p>
      <p id="le-soon-text" hidden>${esc(t(locale, "Coming in the next slice"))}</p>
      <a class="le-tool le-exit" href="/compliance/labels">${labelIcon("exit", t(locale, "Exit"))}<span>${esc(t(locale, "Exit"))}</span></a>
      <div id="le-open" class="le-pop" hidden>
        ${openRows}
      </div>
      <form id="le-save-form" class="le-pop" method="post" action="/compliance/labels/templates" hidden>
        <label>${esc(t(locale, "Name"))} <input type="text" name="name" required value="${esc(name)}"></label>
        <p id="le-replace" hidden>${esc(t(locale, "A template with that name is already saved. Confirm to replace it."))}</p>
        <input type="hidden" name="length_in" value="${num(lengthIn)}">
        <input type="hidden" name="width_in" value="${num(widthIn)}">
        <input type="hidden" name="layout_json" value="">
        <input type="hidden" name="overwrite" value="">
        <input type="hidden" name="then" value="">
        <button type="submit">${esc(t(locale, "Save Template"))}</button>
        <button type="button" data-le-close="save">${esc(t(locale, "Cancel"))}</button>
      </form>
      <div id="le-new" class="le-pop" hidden>
        <p>${esc(t(locale, "New removes every object on the label."))}</p>
        <button type="button" data-le-new="save">${esc(t(locale, "Save first"))}</button>
        <button type="button" data-le-new="clear">${esc(t(locale, "Continue without saving"))}</button>
        <button type="button" data-le-new="cancel">${esc(t(locale, "Cancel"))}</button>
      </div>
      <form id="le-print-form" method="post" action="/compliance/labels/print" target="_blank" hidden>
        <input type="hidden" name="name" value="${esc(name)}">
        <input type="hidden" name="length_in" value="${num(lengthIn)}">
        <input type="hidden" name="width_in" value="${num(widthIn)}">
        <input type="hidden" name="layout_json" value="">
      </form>
      <input id="le-file" type="file" accept=".jpg,.jpeg,.png,.bmp,image/jpeg,image/png,image/bmp" hidden>
    </div>
    <div class="le-work">
      <div class="le-scroll" id="le-scroll">
        <div class="le-frame">
          <div class="le-corner"><button type="button" class="le-tool le-size-btn" data-le-action="size" aria-label="${esc(t(locale, "The label size"))}">${labelIcon("size", t(locale, "The label size"))}</button></div>
          <div id="le-ruler-x" class="le-ruler-x"></div>
          <div id="le-ruler-y" class="le-ruler-y"></div>
          <div class="le-canvas">
            <div id="le-label" class="le-label" style="width:${num(lengthIn)}in;height:${num(widthIn)}in">${editorObjectsHtml(layout, lengthIn, widthIn)}</div>
          </div>
        </div>
      </div>
      <div id="le-size" class="le-pop le-size" hidden>
        <p>${esc(t(locale, "Length is across."))}</p>
        <p>${esc(t(locale, "Width is down."))}</p>
        <label>${esc(t(locale, "Length"))} <input id="le-length" type="number" min="0.5" max="12" step="0.01" value="${num(lengthIn)}"></label>
        <label>${esc(t(locale, "Width"))} <input id="le-width" type="number" min="0.5" max="12" step="0.01" value="${num(widthIn)}"></label>
        <div class="le-stock-row">${stockButtons}</div>
        <button type="button" id="le-apply-size">${esc(t(locale, "Apply"))}</button>
      </div>
    </div>
  </div>
  <script type="application/json" id="le-boot">${bootJson}</script>
  <script>${labelEditorClientSource()}</script>`;
}

export function labelEditorStyles(): string {
  return `
.le-pop[hidden], .le-shapes[hidden], #le-file[hidden], #le-soon-text[hidden], #le-replace[hidden] { display: none !important; }
.le-shell { display: grid; grid-template-columns: minmax(11.5rem, 17rem) minmax(0, 1fr); gap: 0.75rem; align-items: start; }
.le-tools { position: relative; display: flex; flex-direction: column; gap: 0.35rem; max-height: calc(100vh - 7.5rem); overflow: auto; }
/* THE L1 GATE (canon 0.30.387): the column's children keep their height, so the options pane holds every option and the column scrolls. */
.le-tools > * { flex-shrink: 0; }
.le-pair, .le-shapes { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.le-tool {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.15rem;
  min-height: 2.45rem; padding: 0.15rem 0.2rem; text-align: center; text-decoration: none;
  color: var(--accent, var(--gold, #4f6b4a));
  background: var(--panel, var(--surface, #fffdf8));
  border: 1px solid var(--line, var(--border, #c9c0ae));
  border-radius: 8px; font-size: 0.68rem; font-weight: 700; line-height: 1.15; cursor: pointer;
}
.le-tool.is-armed, .le-tool[aria-pressed="true"] { outline: 2px solid var(--accent, var(--gold, #4f6b4a)); outline-offset: 1px; }
.le-icon { width: 24px; height: 24px; display: block; }
.le-options {
  min-height: 9rem; padding: 0.55rem; display: flex; flex-direction: column; gap: 0.35rem;
  border: 1px solid var(--line, var(--border, #c9c0ae)); border-radius: 8px;
  background: var(--panel, var(--surface, #fffdf8)); color: var(--text, var(--ink, #1c1914));
}
.le-options-title { margin: 0; font-weight: 700; }
.le-options label, .le-pop label { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.8rem; }
.le-options input, .le-options select, .le-options textarea, .le-pop input {
  color: inherit; background: transparent; border: 1px solid var(--line, var(--border, #c9c0ae)); border-radius: 6px; padding: 0.2rem 0.35rem;
}
.le-alert { min-height: 1.2rem; margin: 0; color: var(--danger, #8b2e2e); font-size: 0.82rem; }
.le-pop {
  position: absolute; z-index: 6; left: 0; right: 0; padding: 0.6rem; display: flex; flex-direction: column; gap: 0.4rem;
  background: var(--panel, var(--surface, #fffdf8)); color: var(--text, var(--ink, #1c1914));
  border: 1px solid var(--line, var(--border, #c9c0ae)); border-radius: 8px;
}
.le-size { top: 2rem; left: 2rem; right: auto; width: 16rem; }
.le-work { position: relative; min-width: 0; }
.le-scroll {
  overflow: auto; max-height: calc(100vh - 7rem);
  background-color: var(--panel, var(--surface, #fffdf8));
  background-image:
    linear-gradient(to right, color-mix(in srgb, currentColor 20%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, currentColor 20%, transparent) 1px, transparent 1px);
  background-size: 0.25in 0.25in;
  color: var(--text, var(--ink, #1c1914));
  border: 1px solid var(--line, var(--border, #c9c0ae));
}
.le-frame { display: grid; grid-template-columns: 28px max-content; grid-template-rows: 28px max-content; }
.le-corner { position: sticky; top: 0; left: 0; z-index: 4; background: var(--panel, var(--surface, #fffdf8)); }
.le-size-btn { min-height: 28px; width: 28px; padding: 0; }
.le-size-btn .le-icon { width: 20px; height: 20px; }
.le-ruler-x, .le-ruler-y { color: var(--text, var(--ink, #1c1914)); }
.le-ruler-x { position: sticky; top: 0; z-index: 3; background: var(--panel, var(--surface, #fffdf8)); height: 28px; }
.le-ruler-y { position: sticky; left: 0; z-index: 3; background: var(--panel, var(--surface, #fffdf8)); width: 28px; }
.le-canvas { position: relative; }
.le-label {
  position: relative; background-color: #fff; color: #161616;
  background-image:
    linear-gradient(to right, rgba(22, 22, 22, 0.16) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(22, 22, 22, 0.16) 1px, transparent 1px);
  background-size: 0.25in 0.25in;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
}
.le-lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.le-lines .le-hit { pointer-events: stroke; cursor: move; }
.le-obj { position: absolute; box-sizing: border-box; cursor: move; }
.le-obj.is-selected { outline: 2px solid #2456a6; outline-offset: 1px; }
.le-text { width: 100%; height: 100%; overflow: hidden; }
.le-code, .le-obj img, .le-obj svg { width: 100%; height: 100%; }
.le-code { display: flex; flex-direction: column; }
.le-code img, .le-code svg { flex: 1; min-height: 0; object-fit: fill; }
.le-caption { text-align: center; line-height: 1; color: #161616; }
.le-anchor, .le-line-anchor {
  width: 8px; height: 8px; background: #fff; border: 2px solid #2456a6; box-sizing: border-box;
}
.le-anchor { position: absolute; right: -5px; bottom: -5px; cursor: nwse-resize; display: none; }
.le-obj.is-selected .le-anchor { display: block; }
.le-line-anchor { position: absolute; margin-left: -4px; margin-top: -4px; cursor: move; z-index: 4; }
.le-icon-sheet { display: flex; flex-wrap: wrap; gap: 0.8rem; color: var(--accent, var(--gold, #4f6b4a)); }
.le-icon-sheet figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; font-size: 0.75rem; }
.le-at-28 .le-icon { width: 28px; height: 28px; }
.le-at-20 .le-icon { width: 20px; height: 20px; }
.le-menu { display: flex; flex-direction: column; gap: 0.7rem; max-width: 22rem; margin-top: 1rem; }
.le-menu a {
  display: flex; align-items: center; justify-content: center; min-height: 3rem; padding: 0.6rem 1rem;
  text-decoration: none; font-weight: 700;
  color: var(--accent-text, #fff); background: var(--accent, var(--gold, #4f6b4a));
  border: 2px solid var(--accent, var(--gold, #4f6b4a)); border-radius: 8px;
}
@media (max-width: 720px) {
  .le-shell { grid-template-columns: 1fr; }
  .le-scroll { max-height: 70vh; }
}
`;
}

function labelEditorClientSource(): string {
  return `(function () {
  var bootEl = document.getElementById("le-boot");
  var app = document.getElementById("le-app");
  if (!bootEl || !app) return;
  var boot = JSON.parse(bootEl.textContent || "{}");
  var words = boot.words || {};
  var state = {
    lengthIn: Number(boot.lengthIn) || 4,
    widthIn: Number(boot.widthIn) || 6,
    name: boot.name || "",
    objects: boot.objects || [],
    selectedId: null,
    tool: null,
    shape: "rect",
    lineStart: null,
    pendingAt: null,
    defaults: { font: "Arial", size: 14, bold: false, italic: false, align: "left", thickness: 2, dashes: "solid", stroke: 2, fill: "none", caption: false, memo: "text" }
  };
  var label = document.getElementById("le-label");
  var options = document.getElementById("le-options");
  var alertEl = document.getElementById("le-alert");
  var fileInput = document.getElementById("le-file");
  var drag = null;

  function say(key) { if (alertEl) alertEl.textContent = words[key] || key || ""; }
  function inch(n) { return (Math.round(n * 1000) / 1000) + "in"; }
  function snap(n, free) { if (free) return Math.round(n * 1000) / 1000; return Math.round(n * 8) / 8; }
  function uid() { return "o" + Math.random().toString(36).slice(2, 10); }
  function find(id) { for (var i = 0; i < state.objects.length; i++) if (state.objects[i].id === id) return state.objects[i]; return null; }
  function holds(obj) { return obj && (obj.type === "text" || obj.type === "memo" || obj.type === "barcode" || obj.type === "qr"); }
  function own(obj) { if (!obj) return ""; if (obj.type === "text" || obj.type === "memo") return obj.text || ""; if (obj.type === "barcode" || obj.type === "qr") return obj.data || ""; return ""; }
  function resolve(id) {
    var seen = {};
    var cur = find(id);
    while (cur && holds(cur) && cur.attach) {
      if (seen[cur.id]) return "";
      seen[cur.id] = true;
      var next = find(cur.attach);
      if (!next || !holds(next)) break;
      cur = next;
    }
    return own(cur);
  }
  function cycles(fromId, toId) {
    if (fromId === toId) return true;
    var seen = {};
    var cur = find(toId);
    while (cur) {
      if (cur.id === fromId || seen[cur.id]) return true;
      seen[cur.id] = true;
      if (!holds(cur) || !cur.attach) return false;
      cur = find(cur.attach);
    }
    return false;
  }
  function shown(obj) { return obj.attach ? resolve(obj.id) : own(obj); }
  function hidePops() {
    ["le-open", "le-save-form", "le-new", "le-size"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }
  function setTool(tool) {
    state.tool = tool;
    state.lineStart = null;
    state.selectedId = null;
    app.querySelectorAll("[data-le-tool]").forEach(function (btn) {
      var on = btn.getAttribute("data-le-tool") === tool;
      btn.classList.toggle("is-armed", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var shapes = document.getElementById("le-shapes");
    if (shapes) shapes.hidden = tool !== "shapes";
    if (tool === "line") say("Click once to start the line, again to finish it.");
    else if (tool === "shapes") say("Choose a shape, then click the label.");
    else if (tool === "picture") say("Choose a JPEG, PNG, or BMP, then click the label.");
    else if (tool) say("Click the label to drop it.");
    else say("");
    renderOptions();
    paintSelection();
  }
  function syncMeta() {
    app.setAttribute("data-le-count", String(state.objects.length));
    app.setAttribute("data-le-length", String(state.lengthIn));
    app.setAttribute("data-le-width", String(state.widthIn));
    label.style.width = inch(state.lengthIn);
    label.style.height = inch(state.widthIn);
    label.setAttribute("data-le-count", String(state.objects.length));
  }
  function rulers() {
    function ticks(along, vertical) {
      var parts = [];
      var px = 96;
      var span = along * px;
      if (vertical) parts.push('<svg width="28" height="' + along + 'in" viewBox="0 0 28 ' + span + '">');
      else parts.push('<svg width="' + along + 'in" height="28" viewBox="0 0 ' + span + ' 28">');
      for (var i = 0; i / 8 <= along + 1e-6; i++) {
        var at = (i / 8) * px;
        var major = i % 8 === 0;
        var len = major ? 14 : 6;
        if (vertical) {
          parts.push('<line x1="' + (28 - len) + '" y1="' + at + '" x2="28" y2="' + at + '" stroke="currentColor" stroke-width="1"/>');
          if (major) parts.push('<text x="1" y="' + (at + 9) + '" fill="currentColor" stroke="none" font-size="9">' + (i / 8) + '</text>');
        } else {
          parts.push('<line x1="' + at + '" y1="' + (28 - len) + '" x2="' + at + '" y2="28" stroke="currentColor" stroke-width="1"/>');
          if (major) parts.push('<text x="' + (at + 2) + '" y="11" fill="currentColor" stroke="none" font-size="9">' + (i / 8) + '</text>');
        }
      }
      parts.push("</svg>");
      return parts.join("");
    }
    var rx = document.getElementById("le-ruler-x");
    var ry = document.getElementById("le-ruler-y");
    if (rx) rx.innerHTML = ticks(state.lengthIn, false);
    if (ry) ry.innerHTML = ticks(state.widthIn, true);
  }
  function el(tag, cls) { var node = document.createElement(tag); if (cls) node.className = cls; return node; }
  function renderObjects() {
    label.replaceChildren();
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "le-lines");
    svg.setAttribute("viewBox", "0 0 " + state.lengthIn + " " + state.widthIn);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    label.appendChild(svg);
    state.objects.forEach(function (obj) {
      if (obj.type === "line") {
        var hit = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hit.setAttribute("class", "le-hit");
        hit.setAttribute("data-le-object", "1");
        hit.setAttribute("data-le-type", "line");
        hit.setAttribute("data-le-id", obj.id);
        hit.setAttribute("x1", String(obj.x1));
        hit.setAttribute("y1", String(obj.y1));
        hit.setAttribute("x2", String(obj.x2));
        hit.setAttribute("y2", String(obj.y2));
        hit.setAttribute("stroke", "transparent");
        hit.setAttribute("stroke-width", "0.12");
        svg.appendChild(hit);
        var ink = document.createElementNS("http://www.w3.org/2000/svg", "line");
        ink.setAttribute("data-le-draw", obj.id);
        ink.setAttribute("x1", String(obj.x1));
        ink.setAttribute("y1", String(obj.y1));
        ink.setAttribute("x2", String(obj.x2));
        ink.setAttribute("y2", String(obj.y2));
        ink.setAttribute("stroke", state.selectedId === obj.id ? "#2456a6" : "#161616");
        ink.setAttribute("stroke-width", String(obj.thickness / 72));
        ink.setAttribute("stroke-linecap", "round");
        if (obj.dashes === "dashed") ink.setAttribute("stroke-dasharray", "0.1 0.06");
        if (obj.dashes === "dotted") ink.setAttribute("stroke-dasharray", "0.02 0.05");
        ink.setAttribute("pointer-events", "none");
        svg.appendChild(ink);
        ["a", "b"].forEach(function (which) {
          if (state.selectedId !== obj.id) return;
          var dot = el("div", "le-line-anchor");
          dot.setAttribute("data-le-anchor", which);
          dot.setAttribute("data-le-id", obj.id);
          dot.style.left = inch(which === "a" ? obj.x1 : obj.x2);
          dot.style.top = inch(which === "a" ? obj.y1 : obj.y2);
          label.appendChild(dot);
        });
        return;
      }
      var box = el("div", "le-obj" + (state.selectedId === obj.id ? " is-selected" : ""));
      box.setAttribute("data-le-object", "1");
      box.setAttribute("data-le-type", obj.type);
      box.setAttribute("data-le-id", obj.id);
      if (obj.attach) box.setAttribute("data-le-attach", obj.attach);
      if (obj.type === "shape") box.setAttribute("data-le-shape", obj.shape);
      box.style.left = inch(obj.x);
      box.style.top = inch(obj.y);
      box.style.width = inch(obj.w);
      box.style.height = inch(obj.h);
      box.style.transform = "rotate(" + obj.rotate + "deg)";
      var text = shown(obj);
      if (obj.type === "text" || obj.type === "memo") {
        var span = el("div", "le-text");
        span.textContent = text;
        span.style.fontFamily = obj.font;
        span.style.fontSize = obj.size + "pt";
        span.style.fontWeight = obj.bold ? "700" : "400";
        span.style.fontStyle = obj.italic ? "italic" : "normal";
        span.style.textAlign = obj.align;
        span.style.whiteSpace = obj.type === "memo" ? "pre-wrap" : "nowrap";
        box.appendChild(span);
      } else if (obj.type === "barcode" || obj.type === "qr") {
        var code = el("div", "le-code");
        var img = document.createElement("img");
        img.alt = "";
        if (text) img.src = "/compliance/labels/code.svg?kind=" + obj.type + "&text=" + encodeURIComponent(text);
        code.appendChild(img);
        if (obj.caption) {
          var cap = el("div", "le-caption");
          cap.textContent = text;
          cap.style.fontSize = Math.max(6, Math.round(obj.h * 72 * 0.28)) + "pt";
          code.appendChild(cap);
        }
        box.appendChild(code);
      } else if (obj.type === "picture") {
        var pic = document.createElement("img");
        pic.alt = "";
        pic.src = "data:" + obj.mime + ";base64," + obj.bytes;
        box.appendChild(pic);
      } else {
        box.innerHTML = shapeMarkup(obj);
      }
      if (state.selectedId === obj.id) {
        var anchor = el("div", "le-anchor");
        anchor.setAttribute("data-le-anchor", "se");
        anchor.setAttribute("data-le-id", obj.id);
        box.appendChild(anchor);
      }
      label.appendChild(box);
    });
  }
  function shapeMarkup(obj) {
    var fill = obj.fill === "black" ? "#000" : "none";
    var stroke = 'stroke="#000" stroke-width="' + obj.stroke + '" vector-effect="non-scaling-stroke" fill="' + fill + '"';
    var body = '<rect x="2" y="2" width="96" height="96" ' + stroke + "/>";
    if (obj.shape === "ellipse") body = '<ellipse cx="50" cy="50" rx="46" ry="46" ' + stroke + "/>";
    else if (obj.shape === "roundrect") body = '<rect x="2" y="2" width="96" height="96" rx="14" ' + stroke + "/>";
    else if (obj.shape === "triangle") body = '<polygon points="50,4 96,96 4,96" ' + stroke + "/>";
    return '<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">' + body + "</svg>";
  }
  function paintSelection() {
    label.querySelectorAll(".le-obj").forEach(function (node) {
      node.classList.toggle("is-selected", node.getAttribute("data-le-id") === state.selectedId);
    });
  }
  function disarm() {
    state.tool = null;
    state.lineStart = null;
    app.querySelectorAll("[data-le-tool]").forEach(function (btn) {
      btn.classList.remove("is-armed");
      btn.setAttribute("aria-pressed", "false");
    });
    var shapes = document.getElementById("le-shapes");
    if (shapes) shapes.hidden = true;
  }
  function add(obj) {
    obj.id = uid();
    state.objects.push(obj);
    state.selectedId = obj.id;
    disarm();
    say("");
    renderObjects();
    syncMeta();
    renderOptions();
  }
  function place(x, y, free) {
    x = snap(Math.max(0, x), free);
    y = snap(Math.max(0, y), free);
    var d = state.defaults;
    if (state.tool === "line") {
      if (!state.lineStart) { state.lineStart = { x: x, y: y }; say("Click once to start the line, again to finish it."); return; }
      var a = state.lineStart;
      state.lineStart = null;
      add({ type: "line", x1: a.x, y1: a.y, x2: x, y2: y, thickness: d.thickness, dashes: d.dashes });
      return;
    }
    if (state.tool === "picture") { state.pendingAt = { x: x, y: y }; fileInput.click(); return; }
    if (state.tool === "text") add({ type: "text", x: x, y: y, w: 2, h: 0.4, rotate: 0, text: "Text", font: d.font, size: d.size, bold: d.bold, italic: d.italic, align: d.align, attach: null });
    else if (state.tool === "memo") add({ type: "memo", x: x, y: y, w: 2, h: 1, rotate: 0, text: "Memo", memo: d.memo, font: d.font, size: d.size, bold: d.bold, italic: d.italic, align: d.align, attach: null });
    else if (state.tool === "barcode") add({ type: "barcode", x: x, y: y, w: 2.2, h: 0.75, rotate: 0, data: "12345678", caption: d.caption, attach: null });
    else if (state.tool === "qr") add({ type: "qr", x: x, y: y, w: 1, h: 1, rotate: 0, data: "QR", caption: d.caption, attach: null });
    else if (state.tool === "shapes") add({ type: "shape", shape: state.shape, x: x, y: y, w: 1, h: 1, rotate: 0, stroke: d.stroke, fill: d.fill });
  }
  function field(labelText, node) { var wrap = el("label"); wrap.appendChild(document.createTextNode(labelText)); wrap.appendChild(node); return wrap; }
  function renderOptions() {
    options.replaceChildren();
    var title = el("p", "le-options-title");
    title.textContent = words["Options"] || "Options";
    options.appendChild(title);
    var obj = state.selectedId ? find(state.selectedId) : null;
    var target = obj;
    if (!target && (state.tool === "text" || state.tool === "memo" || state.tool === "barcode" || state.tool === "qr" || state.tool === "shapes" || state.tool === "line" || state.tool === "picture")) {
      options.appendChild(document.createTextNode(words["Click the label to drop it."] || ""));
    }
    function fontFields(rec, onText) {
      var font = document.createElement("select");
      (boot.fonts || []).forEach(function (name) {
        var opt = document.createElement("option");
        opt.value = name; opt.textContent = name;
        if (rec.font === name) opt.selected = true;
        font.appendChild(opt);
      });
      font.addEventListener("change", function () { rec.font = font.value; if (onText) onText(); else renderObjects(); });
      options.appendChild(field(words["Font"], font));
      var size = document.createElement("input");
      size.type = "number"; size.min = "6"; size.max = "96"; size.value = String(rec.size);
      size.addEventListener("input", function () { rec.size = Math.max(6, Math.min(96, Math.round(Number(size.value) || 12))); if (onText) onText(); else renderObjects(); });
      options.appendChild(field(words["Size"], size));
      var bold = document.createElement("input"); bold.type = "checkbox"; bold.checked = !!rec.bold;
      bold.addEventListener("change", function () { rec.bold = bold.checked; if (onText) onText(); else renderObjects(); });
      options.appendChild(field(words["Bold"], bold));
      var italic = document.createElement("input"); italic.type = "checkbox"; italic.checked = !!rec.italic;
      italic.addEventListener("change", function () { rec.italic = italic.checked; if (onText) onText(); else renderObjects(); });
      options.appendChild(field(words["Italic"], italic));
      var align = document.createElement("select");
      ["left", "center", "right"].forEach(function (value) {
        var opt = document.createElement("option");
        opt.value = value; opt.textContent = words[value === "left" ? "Left" : value === "center" ? "Center" : "Right"];
        if (rec.align === value) opt.selected = true;
        align.appendChild(opt);
      });
      align.addEventListener("change", function () { rec.align = align.value; if (onText) onText(); else renderObjects(); });
      options.appendChild(field(words["Align"], align));
    }
    function rotateFields(rec, steps) {
      if (steps) {
        var row = el("div", "le-pair");
        [0, 90, 180, 270].forEach(function (deg) {
          var btn = document.createElement("button");
          btn.type = "button"; btn.textContent = deg + "°";
          if (rec.rotate === deg) btn.className = "is-armed";
          btn.addEventListener("click", function () { rec.rotate = deg; renderObjects(); renderOptions(); });
          row.appendChild(btn);
        });
        options.appendChild(field(words["Rotate"], row));
      } else {
        var degIn = document.createElement("input");
        degIn.type = "number"; degIn.step = "1"; degIn.value = String(rec.rotate || 0);
        degIn.addEventListener("input", function () { rec.rotate = Math.round(Number(degIn.value) || 0); renderObjects(); });
        options.appendChild(field(words["Rotate"], degIn));
      }
    }
    function attachFields(rec) {
      var sel = document.createElement("select");
      var none = document.createElement("option"); none.value = ""; none.textContent = words["None"]; sel.appendChild(none);
      state.objects.forEach(function (other) {
        if (other.id === rec.id || !holds(other)) return;
        var opt = document.createElement("option");
        opt.value = other.id;
        opt.textContent = other.type + " " + own(other).slice(0, 24);
        if (rec.attach === other.id) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", function () {
        if (sel.value && cycles(rec.id, sel.value)) { say("Those objects attach in a circle."); sel.value = rec.attach || ""; return; }
        rec.attach = sel.value || null;
        renderObjects();
      });
      options.appendChild(field(words["Attach"], sel));
    }
    if (target && (target.type === "text" || target.type === "memo")) {
      var input = target.type === "memo" ? document.createElement("textarea") : document.createElement("input");
      if (input.tagName === "INPUT") input.type = "text";
      input.value = target.text;
      if (target.attach) input.disabled = true;
      input.addEventListener("input", function () {
        if (target.type === "memo") target.text = filterMemo(input.value, target.memo);
        else target.text = input.value;
        if (input.value !== target.text) input.value = target.text;
        renderObjects();
      });
      options.appendChild(field(target.type === "memo" ? words["Memo"] : words["Text"], input));
      if (target.type === "memo") {
        var kind = document.createElement("select");
        ["text", "number", "alphanumeric"].forEach(function (value) {
          var opt = document.createElement("option");
          opt.value = value; opt.textContent = words[value === "text" ? "Text" : value === "number" ? "Number" : "Alphanumeric"];
          if (target.memo === value) opt.selected = true;
          kind.appendChild(opt);
        });
        kind.addEventListener("change", function () { target.memo = kind.value; target.text = filterMemo(target.text, target.memo); renderObjects(); renderOptions(); });
        options.appendChild(field(words["Memo"], kind));
      }
      fontFields(target, function () { renderObjects(); });
      rotateFields(target, false);
      attachFields(target);
      if (target.type === "text") {
        var source = document.createElement("button");
        source.type = "button"; source.textContent = words["Source Data"];
        source.setAttribute("data-le-action", "source-data");
        source.addEventListener("click", function () { say("Coming in the next slice"); });
        options.appendChild(source);
      }
    } else if (target && (target.type === "barcode" || target.type === "qr")) {
      var data = document.createElement("input");
      data.type = "text"; data.value = target.data;
      if (target.attach) data.disabled = true;
      data.addEventListener("input", function () { target.data = data.value; renderObjects(); });
      options.appendChild(field(words["Barcode"], data));
      rotateFields(target, true);
      attachFields(target);
      var cap = document.createElement("input"); cap.type = "checkbox"; cap.checked = !!target.caption;
      cap.addEventListener("change", function () { target.caption = cap.checked; renderObjects(); });
      options.appendChild(field(words["Toggle caption"], cap));
    } else if (target && target.type === "picture") {
      rotateFields(target, true);
    } else if (target && target.type === "shape") {
      rotateFields(target, false);
      strokeFill(target);
    } else if (target && target.type === "line") {
      var thick = document.createElement("input");
      thick.type = "number"; thick.min = "0.5"; thick.max = "12"; thick.step = "0.5"; thick.value = String(target.thickness);
      thick.addEventListener("input", function () { target.thickness = Math.max(0.5, Math.min(12, Number(thick.value) || 2)); renderObjects(); });
      options.appendChild(field(words["Thickness"], thick));
      var dashes = document.createElement("select");
      ["solid", "dashed", "dotted"].forEach(function (value) {
        var opt = document.createElement("option");
        opt.value = value; opt.textContent = words[value === "solid" ? "Solid" : value === "dashed" ? "Dashed" : "Dotted"];
        if (target.dashes === value) opt.selected = true;
        dashes.appendChild(opt);
      });
      dashes.addEventListener("change", function () { target.dashes = dashes.value; renderObjects(); });
      options.appendChild(field(words["Dashes"], dashes));
    } else if (!target && state.tool === "text") {
      var sourceIdle = document.createElement("button");
      sourceIdle.type = "button"; sourceIdle.textContent = words["Source Data"];
      sourceIdle.setAttribute("data-le-action", "source-data");
      sourceIdle.addEventListener("click", function () { say("Coming in the next slice"); });
      options.appendChild(sourceIdle);
    }
  }
  function strokeFill(rec) {
    var stroke = document.createElement("input");
    stroke.type = "number"; stroke.min = "0.5"; stroke.max = "12"; stroke.step = "0.5"; stroke.value = String(rec.stroke);
    stroke.addEventListener("input", function () { rec.stroke = Math.max(0.5, Math.min(12, Number(stroke.value) || 2)); renderObjects(); });
    options.appendChild(field(words["Thickness"], stroke));
    var fill = document.createElement("select");
    [["none", "No fill"], ["black", "Black"]].forEach(function (pair) {
      var opt = document.createElement("option");
      opt.value = pair[0]; opt.textContent = words[pair[1]];
      if (rec.fill === pair[0]) opt.selected = true;
      fill.appendChild(opt);
    });
    fill.addEventListener("change", function () { rec.fill = fill.value; renderObjects(); });
    options.appendChild(field(words["Fill"], fill));
  }
  function filterMemo(value, kind) {
    if (kind === "number") {
      var out = ""; var dot = false;
      for (var i = 0; i < value.length; i++) {
        var ch = value.charAt(i);
        if (ch >= "0" && ch <= "9") out += ch;
        else if (ch === "." && !dot) { dot = true; out += ch; }
      }
      return out;
    }
    if (kind === "alphanumeric") return value.replace(/[^0-9A-Za-z ]/g, "");
    return value;
  }
  function pointOf(e) {
    var rect = label.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * state.lengthIn,
      y: ((e.clientY - rect.top) / rect.height) * state.widthIn
    };
  }
  function clampBox(obj) {
    if (obj.type === "line") {
      obj.x1 = Math.max(0, Math.min(state.lengthIn, obj.x1));
      obj.x2 = Math.max(0, Math.min(state.lengthIn, obj.x2));
      obj.y1 = Math.max(0, Math.min(state.widthIn, obj.y1));
      obj.y2 = Math.max(0, Math.min(state.widthIn, obj.y2));
      return;
    }
    obj.w = Math.max(0.125, obj.w);
    obj.h = Math.max(0.125, obj.h);
    if (obj.x < 0) obj.x = 0;
    if (obj.y < 0) obj.y = 0;
    if (obj.x > state.lengthIn - 0.125) obj.x = Math.max(0, state.lengthIn - 0.125);
    if (obj.y > state.widthIn - 0.125) obj.y = Math.max(0, state.widthIn - 0.125);
  }
  label.addEventListener("pointerdown", function (e) {
    var anchor = e.target.closest("[data-le-anchor]");
    var objEl = e.target.closest("[data-le-object]");
    if (!anchor && !objEl) return;
    var id = (anchor || objEl).getAttribute("data-le-id");
    state.selectedId = id;
    state.tool = null;
    app.querySelectorAll("[data-le-tool]").forEach(function (btn) { btn.classList.remove("is-armed"); btn.setAttribute("aria-pressed", "false"); });
    var shapes = document.getElementById("le-shapes");
    if (shapes) shapes.hidden = true;
    var obj = find(id);
    drag = { id: id, kind: anchor ? anchor.getAttribute("data-le-anchor") : "move", px: e.clientX, py: e.clientY, src: JSON.parse(JSON.stringify(obj)) };
    renderObjects();
    renderOptions();
    label.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  label.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var rect = label.getBoundingClientRect();
    var dx = ((e.clientX - drag.px) / rect.width) * state.lengthIn;
    var dy = ((e.clientY - drag.py) / rect.height) * state.widthIn;
    var obj = find(drag.id);
    var src = drag.src;
    if (drag.kind === "move") {
      if (obj.type === "line") {
        obj.x1 = snap(src.x1 + dx, e.shiftKey); obj.y1 = snap(src.y1 + dy, e.shiftKey);
        obj.x2 = snap(src.x2 + dx, e.shiftKey); obj.y2 = snap(src.y2 + dy, e.shiftKey);
      } else {
        obj.x = snap(src.x + dx, e.shiftKey); obj.y = snap(src.y + dy, e.shiftKey);
      }
    } else if (obj.type === "line") {
      if (drag.kind === "a") { obj.x1 = snap(src.x1 + dx, e.shiftKey); obj.y1 = snap(src.y1 + dy, e.shiftKey); }
      else { obj.x2 = snap(src.x2 + dx, e.shiftKey); obj.y2 = snap(src.y2 + dy, e.shiftKey); }
    } else {
      obj.w = Math.max(0.125, snap(src.w + dx, e.shiftKey));
      obj.h = Math.max(0.125, snap(src.h + dy, e.shiftKey));
    }
    clampBox(obj);
    renderObjects();
  });
  label.addEventListener("pointerup", function () { drag = null; });
  label.addEventListener("click", function (e) {
    if (e.target.closest("[data-le-object]") || e.target.closest("[data-le-anchor]")) return;
    if (!state.tool) { state.selectedId = null; renderObjects(); renderOptions(); return; }
    var pt = pointOf(e);
    place(pt.x, pt.y, e.shiftKey);
  });
  document.addEventListener("keydown", function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (!state.selectedId) return;
    var obj = find(state.selectedId);
    if (!obj) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      state.objects.forEach(function (item) { if (holds(item) && item.attach === obj.id) item.attach = null; });
      state.objects = state.objects.filter(function (item) { return item.id !== obj.id; });
      state.selectedId = null;
      renderObjects(); syncMeta(); renderOptions();
      e.preventDefault();
      return;
    }
    var dx = 0; var dy = 0; var step = 0.125;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    if (obj.type === "line") { obj.x1 += dx; obj.y1 += dy; obj.x2 += dx; obj.y2 += dy; }
    else { obj.x += dx; obj.y += dy; }
    clampBox(obj);
    renderObjects();
    e.preventDefault();
  });
  app.querySelectorAll("[data-le-tool]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tool = btn.getAttribute("data-le-tool");
      if (tool === "open") { hidePops(); document.getElementById("le-open").hidden = false; return; }
      if (tool === "save") { hidePops(); document.getElementById("le-save-form").hidden = false; return; }
      if (tool === "new") { hidePops(); document.getElementById("le-new").hidden = false; return; }
      if (tool === "print") { fillPrint(); document.getElementById("le-print-form").submit(); return; }
      setTool(state.tool === tool ? null : tool);
    });
  });
  app.querySelectorAll("[data-le-shape]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.shape = btn.getAttribute("data-le-shape");
      app.querySelectorAll("[data-le-shape]").forEach(function (other) {
        other.setAttribute("aria-pressed", other === btn ? "true" : "false");
      });
      setTool("shapes");
    });
  });
  app.querySelectorAll("[data-le-action='connections'], [data-le-action='source-data']").forEach(function (btn) {
    btn.addEventListener("click", function () { say("Coming in the next slice"); });
  });
  document.querySelectorAll("[data-le-close]").forEach(function (btn) {
    btn.addEventListener("click", hidePops);
  });
  document.querySelectorAll("[data-le-new]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var mode = btn.getAttribute("data-le-new");
      if (mode === "cancel") { hidePops(); return; }
      if (mode === "clear") {
        state.objects = []; state.selectedId = null;
        disarm();
        hidePops(); renderObjects(); syncMeta(); renderOptions();
        return;
      }
      hidePops();
      var form = document.getElementById("le-save-form");
      form.querySelector("[name=then]").value = "clear";
      form.hidden = false;
    });
  });
  var sizeBtn = app.querySelector("[data-le-action='size']");
  if (sizeBtn) sizeBtn.addEventListener("click", function () {
    hidePops();
    document.getElementById("le-length").value = String(state.lengthIn);
    document.getElementById("le-width").value = String(state.widthIn);
    document.getElementById("le-size").hidden = false;
  });
  document.querySelectorAll("[data-le-stock]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      applySize(Number(btn.getAttribute("data-length")), Number(btn.getAttribute("data-width")));
    });
  });
  var apply = document.getElementById("le-apply-size");
  if (apply) apply.addEventListener("click", function () {
    applySize(Number(document.getElementById("le-length").value), Number(document.getElementById("le-width").value));
  });
  function applySize(lengthIn, widthIn) {
    var len = Math.round(lengthIn * 100) / 100;
    var wid = Math.round(widthIn * 100) / 100;
    if (!(len >= 0.5 && len <= 12) || !(wid >= 0.5 && wid <= 12)) { say("Length and width are inches from 0.5 to 12."); return; }
    state.lengthIn = len; state.widthIn = wid;
    state.objects.forEach(clampBox);
    document.getElementById("le-size").hidden = true;
    renderObjects(); rulers(); syncMeta();
  }
  function layoutJson() { return JSON.stringify({ v: 1, objects: state.objects }); }
  function fillPrint() {
    var form = document.getElementById("le-print-form");
    form.querySelector("[name=length_in]").value = String(state.lengthIn);
    form.querySelector("[name=width_in]").value = String(state.widthIn);
    form.querySelector("[name=layout_json]").value = layoutJson();
    form.querySelector("[name=name]").value = state.name || "Label";
  }
  var saveForm = document.getElementById("le-save-form");
  saveForm.addEventListener("submit", function (e) {
    saveForm.querySelector("[name=length_in]").value = String(state.lengthIn);
    saveForm.querySelector("[name=width_in]").value = String(state.widthIn);
    saveForm.querySelector("[name=layout_json]").value = layoutJson();
    var name = saveForm.querySelector("[name=name]").value.trim();
    var exists = (boot.templates || []).some(function (row) { return row.name === name; });
    if (exists && saveForm.querySelector("[name=overwrite]").value !== "yes") {
      e.preventDefault();
      saveForm.querySelector("[name=overwrite]").value = "yes";
      document.getElementById("le-replace").hidden = false;
    }
  });
  saveForm.querySelector("[name=name]").addEventListener("input", function () {
    saveForm.querySelector("[name=overwrite]").value = "";
    document.getElementById("le-replace").hidden = true;
  });
  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    var at = state.pendingAt;
    state.pendingAt = null;
    if (!file || !at) return;
    var mime = file.type || "";
    var fname = file.name || "";
    var ok = mime === "image/jpeg" || mime === "image/png" || mime === "image/bmp" || /\\.(jpe?g|png|bmp)$/i.test(fname);
    if (!ok) { say("A picture must be a JPEG, PNG, or BMP."); return; }
    if (file.size > 1048576) { say("That picture is over 1 MB."); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var url = String(reader.result || "");
      var mimeUse = mime || (fname.toLowerCase().endsWith(".png") ? "image/png" : fname.toLowerCase().endsWith(".bmp") ? "image/bmp" : "image/jpeg");
      var comma = url.indexOf(",");
      add({ type: "picture", x: at.x, y: at.y, w: 1.5, h: 1.5, rotate: 0, mime: mimeUse, filename: fname.slice(0, 120), bytes: comma >= 0 ? url.slice(comma + 1) : url });
    };
    reader.readAsDataURL(file);
  });
  renderObjects();
  rulers();
  syncMeta();
  renderOptions();
})();`;
}

export function labelIconSheet(locale: Locale): string {
  const cards = (
    [
      ["open", "Open Template"],
      ["save", "Save Template"],
      ["new", "New"],
      ["print", "Print"],
      ["connections", "Connections"],
      ["text", "Text Box"],
      ["memo", "Memo"],
      ["barcode", "Barcode"],
      ["qr", "QR"],
      ["picture", "Picture"],
      ["shapes", "Shapes"],
      ["rect", "Rectangle"],
      ["ellipse", "Ellipse"],
      ["roundrect", "Rounded rectangle"],
      ["triangle", "Triangle"],
      ["line", "Line"],
      ["exit", "Exit"],
      ["size", "The label size"],
    ] as const
  )
    .map(
      ([icon, label]) =>
        `<figure data-icon-card="${icon}"><div class="le-at-28">${labelIcon(icon, t(locale, label))}</div><div class="le-at-20">${labelIcon(icon, t(locale, label))}</div><figcaption>${esc(t(locale, label))}</figcaption></figure>`
    )
    .join("");
  return `<h1>${esc(t(locale, "Label Editor"))}</h1><div class="le-icon-sheet" data-icon-sheet>${cards}</div>`;
}
