/**
 * A small MS-XLSB reader (canon 0.30.187). Enough for a flat table: sheet
 * names, shared strings, and cell values including formula caches. The zip
 * is the one the Labor reader already opens. No new dependency.
 */

import { readZipEntryByName } from "./sheetsync";
import { writeStoreZip, type ZipFile } from "./xlsx";

export type XlsbCell = string | number | boolean | null;
export type XlsbRow = { row: number; cells: XlsbCell[] };

const BRT = {
  rowHdr: 0,
  cellBlank: 1,
  cellRk: 2,
  cellError: 3,
  cellBool: 4,
  cellReal: 5,
  cellSt: 6,
  cellIsst: 7,
  fmlaString: 8,
  fmlaNum: 9,
  fmlaBool: 10,
  fmlaError: 11,
  sstItem: 19,
  bundleSh: 156,
} as const;

const te = new TextEncoder();
const td16 = new TextDecoder("utf-16le");

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

/** 7-bit groups, low group first, high bit means another byte. */
function writeVar(n: number): number[] {
  const out: number[] = [];
  let v = n >>> 0;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v & 0x7f);
  return out;
}

function readVar(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let next = offset;
  for (let i = 0; i < 4; i++) {
    const b = bytes[next++] ?? 0;
    value |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value: value >>> 0, next };
}

function writeRecord(type: number, body: Uint8Array): Uint8Array {
  const head = [...writeVar(type), ...writeVar(body.length)];
  const out = new Uint8Array(head.length + body.length);
  out.set(head, 0);
  out.set(body, head.length);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const part of parts) len += part.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const part of parts) {
    out.set(part, off);
    off += part.length;
  }
  return out;
}

function writeU32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function writeF64(n: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, n, true);
  return b;
}

function writeWide(text: string): Uint8Array {
  const units = new Uint8Array(4 + text.length * 2);
  units.set(writeU32(text.length), 0);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    units[4 + i * 2] = c & 0xff;
    units[5 + i * 2] = (c >>> 8) & 0xff;
  }
  return units;
}

function readWide(bytes: Uint8Array, offset: number): { text: string; next: number } {
  if (offset + 4 > bytes.length) return { text: "", next: bytes.length };
  const cch = u32(bytes, offset);
  if (cch === 0xffffffff) return { text: "", next: offset + 4 };
  const end = Math.min(bytes.length, offset + 4 + cch * 2);
  return { text: td16.decode(bytes.subarray(offset + 4, end)), next: end };
}

function cellHeader(col: number): Uint8Array {
  const b = new Uint8Array(8);
  b.set(writeU32(col), 0);
  return b;
}

/** RK number: bit 0 divides by 100, bit 1 means a signed integer. */
export function decodeRk(raw: number): number {
  const rk = raw >>> 0;
  const div = (rk & 1) !== 0;
  const asInt = (rk & 2) !== 0;
  let n: number;
  if (asInt) {
    n = rk >> 2;
  } else {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setUint32(4, rk & 0xfffffffc, true);
    n = new DataView(buf).getFloat64(0, true);
  }
  return div ? n / 100 : n;
}

export function encodeRk(n: number, flags: { div100?: boolean; asInt?: boolean } = {}): number {
  const asInt = flags.asInt ?? Number.isInteger(n);
  const div100 = flags.div100 ?? false;
  const base = div100 ? Math.round(n * 100) : n;
  let bits: number;
  if (asInt) bits = (base << 2) | 2;
  else {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, base, true);
    bits = new DataView(buf).getUint32(4, true) & 0xfffffffc;
  }
  if (div100) bits |= 1;
  return bits >>> 0;
}

/** Excel 1900 serial to a calendar date. Serial 60 is the fake leap day. */
export function excelSerialToIso(serial: number): string {
  const whole = Math.floor(Number(serial));
  const utc = Date.UTC(1899, 11, 30) + whole * 86_400_000;
  const d = new Date(utc);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Rec = { type: number; body: Uint8Array };

function recordsOf(bytes: Uint8Array): Rec[] {
  const out: Rec[] = [];
  let i = 0;
  while (i < bytes.length) {
    const type = readVar(bytes, i);
    const len = readVar(bytes, type.next);
    const end = Math.min(bytes.length, len.next + len.value);
    out.push({ type: type.value, body: bytes.subarray(len.next, end) });
    i = end;
    if (len.next === i && len.value === 0 && type.next === i) break;
  }
  return out;
}

function readF64(body: Uint8Array, offset: number): number {
  return new DataView(body.buffer, body.byteOffset + offset, 8).getFloat64(0, true);
}

function cellValue(type: number, body: Uint8Array, strings: string[]): XlsbCell | undefined {
  if (body.length < 8 && type !== BRT.rowHdr) return undefined;
  if (type === BRT.cellBlank) return null;
  if (type === BRT.cellRk) return body.length >= 12 ? decodeRk(u32(body, 8)) : null;
  if (type === BRT.cellReal || type === BRT.fmlaNum) return body.length >= 16 ? readF64(body, 8) : null;
  if (type === BRT.cellBool || type === BRT.fmlaBool) return (body[8] ?? 0) !== 0;
  if (type === BRT.cellError || type === BRT.fmlaError) return null;
  if (type === BRT.cellIsst) {
    const idx = body.length >= 12 ? u32(body, 8) : 0;
    return strings[idx] ?? "";
  }
  if (type === BRT.cellSt || type === BRT.fmlaString) return readWide(body, 8).text;
  return undefined;
}

function sheetGrid(bytes: Uint8Array, strings: string[]): XlsbRow[] {
  const grid = new Map<number, Map<number, XlsbCell>>();
  let row = 0;
  for (const rec of recordsOf(bytes)) {
    if (rec.type === BRT.rowHdr) {
      const next = rec.body.length >= 4 ? u32(rec.body, 0) : row;
      if (next <= 1_048_575) row = next;
      if (!grid.has(row)) grid.set(row, new Map());
      continue;
    }
    const value = cellValue(rec.type, rec.body, strings);
    if (value === undefined || rec.body.length < 8) continue;
    const col = u32(rec.body, 0);
    if (col > 255) continue;
    const line = grid.get(row) ?? new Map();
    line.set(col, value);
    grid.set(row, line);
  }
  return [...grid.keys()]
    .sort((a, b) => a - b)
    .map((r) => {
      const line = grid.get(r) ?? new Map();
      const cols = [...line.keys()];
      const width = cols.length ? Math.max(...cols) + 1 : 0;
      const cells: XlsbCell[] = [];
      for (let c = 0; c < width; c++) cells.push(line.has(c) ? (line.get(c) as XlsbCell) : null);
      return { row: r, cells };
    });
}

function sharedStrings(bytes: Uint8Array): string[] {
  const out: string[] = [];
  for (const rec of recordsOf(bytes)) {
    if (rec.type !== BRT.sstItem || rec.body.length < 5) continue;
    out.push(readWide(rec.body, 1).text);
  }
  return out;
}

type Bundle = { name: string; rel: string };

function bundles(bytes: Uint8Array): Bundle[] {
  const out: Bundle[] = [];
  for (const rec of recordsOf(bytes)) {
    if (rec.type !== BRT.bundleSh || rec.body.length < 8) continue;
    const rel = readWide(rec.body, 8);
    const name = readWide(rec.body, rel.next);
    if (name.text) out.push({ name: name.text, rel: rel.text });
  }
  return out;
}

function relTargets(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /<Relationship\b([^>]*)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const id = /Id="([^"]*)"/.exec(m[1])?.[1] ?? "";
    const target = /Target="([^"]*)"/.exec(m[1])?.[1] ?? "";
    if (id && target) out.set(id, target.replaceAll("\\", "/"));
  }
  return out;
}

function sheetPart(target: string): string {
  const cleaned = target.replaceAll("\\", "/");
  if (cleaned.startsWith("/")) return cleaned.slice(1);
  if (cleaned.startsWith("xl/")) return cleaned;
  return `xl/${cleaned.replace(/^\.\//, "")}`;
}

/** Named sheets, or every sheet when `only` is omitted. `row` is zero-based. */
export async function readXlsbSheets(bytes: Uint8Array, only?: readonly string[]): Promise<Map<string, XlsbRow[]>> {
  const book = await readZipEntryByName(bytes, "xl/workbook.bin");
  const rels = new TextDecoder().decode(await readZipEntryByName(bytes, "xl/_rels/workbook.bin.rels"));
  let strings: string[] = [];
  try {
    strings = sharedStrings(await readZipEntryByName(bytes, "xl/sharedStrings.bin"));
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("is missing")) throw err;
  }
  const targets = relTargets(rels);
  const wanted = only ? new Set(only) : null;
  const out = new Map<string, XlsbRow[]>();
  for (const sheet of bundles(book)) {
    if (wanted && !wanted.has(sheet.name)) continue;
    const target = targets.get(sheet.rel);
    if (!target) continue;
    const part = await readZipEntryByName(bytes, sheetPart(target));
    out.set(sheet.name, sheetGrid(part, strings));
  }
  return out;
}

function sstItem(text: string): Uint8Array {
  return writeRecord(BRT.sstItem, concat([new Uint8Array([0]), writeWide(text)]));
}

function bundle(name: string, rel: string): Uint8Array {
  return writeRecord(BRT.bundleSh, concat([writeU32(0), writeU32(1), writeWide(rel), writeWide(name)]));
}

function rowRecord(row: number): Uint8Array {
  return writeRecord(BRT.rowHdr, writeU32(row));
}

function cellRecord(kind: "blank" | "rk" | "real" | "bool" | "st" | "isst" | "fmlaNum" | "fmlaString" | "error", col: number, payload: Uint8Array): Uint8Array {
  const type = {
    blank: BRT.cellBlank,
    rk: BRT.cellRk,
    real: BRT.cellReal,
    bool: BRT.cellBool,
    st: BRT.cellSt,
    isst: BRT.cellIsst,
    fmlaNum: BRT.fmlaNum,
    fmlaString: BRT.fmlaString,
    error: BRT.cellError,
  }[kind];
  return writeRecord(type, concat([cellHeader(col), payload]));
}

export type XlsbSheetWrite = {
  name: string;
  rows: XlsbCell[][];
  /** Column indexes written as RK integers, RK floats, reals, bools, inline strings, shared strings, formula numbers, formula strings, blanks, or errors. */
  kinds?: Array<Array<"rk" | "rkFloat" | "rkDiv" | "real" | "bool" | "inline" | "shared" | "fmlaNum" | "fmlaString" | "blank" | "error" | "auto">>;
};

/**
 * A tiny .xlsb for tests and the smoke fixture. Shared strings collect every
 * auto string. Kinds force the cell record the reader must accept.
 */
export function writeXlsb(sheets: XlsbSheetWrite[]): Uint8Array {
  const shared: string[] = [];
  const indexOf = (text: string) => {
    let i = shared.indexOf(text);
    if (i < 0) {
      i = shared.length;
      shared.push(text);
    }
    return i;
  };
  for (const sheet of sheets) {
    sheet.rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        const kind = sheet.kinds?.[r]?.[c] ?? "auto";
        if ((kind === "auto" || kind === "shared") && typeof cell === "string") indexOf(cell);
        if (kind === "fmlaString" && typeof cell === "string") indexOf(cell);
      });
    });
  }
  const sheetParts: ZipFile[] = [];
  const bookRecs: Uint8Array[] = [];
  const rels: string[] = [];
  sheets.forEach((sheet, s) => {
    const rel = `rId${s + 1}`;
    bookRecs.push(bundle(sheet.name, rel));
    const recs: Uint8Array[] = [];
    sheet.rows.forEach((row, r) => {
      recs.push(rowRecord(r));
      row.forEach((cell, c) => {
        const kind = sheet.kinds?.[r]?.[c] ?? "auto";
        if (cell == null || kind === "blank") {
          recs.push(cellRecord("blank", c, new Uint8Array()));
          return;
        }
        if (kind === "error") {
          recs.push(cellRecord("error", c, new Uint8Array([0x07])));
          return;
        }
        if (kind === "bool" || typeof cell === "boolean") {
          recs.push(cellRecord("bool", c, new Uint8Array([cell ? 1 : 0])));
          return;
        }
        if (kind === "real") {
          recs.push(cellRecord("real", c, writeF64(Number(cell))));
          return;
        }
        if (kind === "rk" || kind === "rkDiv" || kind === "rkFloat") {
          const flags = kind === "rkDiv" ? { div100: true, asInt: true } : kind === "rkFloat" ? { asInt: false } : { asInt: true };
          recs.push(cellRecord("rk", c, writeU32(encodeRk(Number(cell), flags))));
          return;
        }
        if (kind === "fmlaNum") {
          recs.push(cellRecord("fmlaNum", c, writeF64(Number(cell))));
          return;
        }
        if (kind === "inline") {
          recs.push(cellRecord("st", c, writeWide(String(cell))));
          return;
        }
        if (kind === "fmlaString") {
          recs.push(cellRecord("fmlaString", c, writeWide(String(cell))));
          return;
        }
        if (typeof cell === "number" && Number.isInteger(cell)) {
          recs.push(cellRecord("rk", c, writeU32(encodeRk(cell, { asInt: true }))));
          return;
        }
        if (typeof cell === "number") {
          recs.push(cellRecord("real", c, writeF64(cell)));
          return;
        }
        recs.push(cellRecord("isst", c, writeU32(indexOf(String(cell)))));
      });
    });
    sheetParts.push({ name: `xl/worksheets/sheet${s + 1}.bin`, data: concat(recs) });
    rels.push(
      `<Relationship Id="${rel}" Type="http://schemas.microsoft.com/office/2006/relationships/xlWorksheet" Target="worksheets/sheet${s + 1}.bin"/>`
    );
  });
  const sst = concat(shared.map(sstItem));
  const relXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels.join("\n  ")}
  <Relationship Id="rIdSst" Type="http://schemas.microsoft.com/office/2006/relationships/sharedStrings" Target="sharedStrings.bin"/>
</Relationships>`;
  const files: ZipFile[] = [
    { name: "xl/workbook.bin", data: concat(bookRecs) },
    { name: "xl/_rels/workbook.bin.rels", data: te.encode(relXml) },
    { name: "xl/sharedStrings.bin", data: sst },
    ...sheetParts,
  ];
  return writeStoreZip(files);
}
