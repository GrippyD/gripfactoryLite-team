/**
 * In-repo uncompressed zip plus a small XLSX writer. Zero dependencies.
 * Store method only (no deflate). Excel opens the result as a real workbook.
 */

const CRC_TABLE: number[] = (() => {
  const table = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
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

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

const te = new TextEncoder();

function dosDateTime(d: Date): { time: number; date: number } {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

export type ZipFile = { name: string; data: Uint8Array };

/** Uncompressed zip (store method) with a central directory. */
export function writeStoreZip(files: ZipFile[], stamped = new Date("2026-09-03T00:00:00.000Z")): Uint8Array {
  const { time, date } = dosDateTime(stamped);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = te.encode(file.name);
    const crc = crc32(file.data);
    const local = concatBytes([
      te.encode("PK\u0003\u0004"),
      u16(20),
      u16(0),
      u16(0),
      u16(time),
      u16(date),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      file.data,
    ]);
    locals.push(local);
    const central = concatBytes([
      te.encode("PK\u0001\u0002"),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(time),
      u16(date),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    centrals.push(central);
    offset += local.length;
  }
  const centralDir = concatBytes(centrals);
  const end = concatBytes([
    te.encode("PK\u0005\u0006"),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return concatBytes([...locals, centralDir, end]);
}

export type XlsxCell = { text?: string; number?: number; grams?: boolean; lbs?: boolean };

export type XlsxSheet = {
  headers: string[];
  rows: XlsxCell[][];
  /** 0-based column indexes that use the gram number format. */
  gramColumns?: number[];
  colWidths?: number[];
  /** THE CRYO RUN (canon 0.30.110): the worksheet's name when a template wants
   * its own (the owner's T3 autofill sheet); Report otherwise. */
  sheetName?: string;
  /** Number cells written as plain integers/decimals without the gram format
   * (a template that wants 22679, not 22,679.00). */
  plainNumbers?: boolean;
  /** A text line in row 1, above the header. The header and body shift down. */
  banner?: string;
  /** When set, an autofilter from A1 through the last heading and this 1-based
   * row. Unset writes the sheet exactly as before. */
  autoFilter?: number;
};

function xmlEsc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellXml(cell: XlsxCell, ref: string, gramCol: boolean, plainNumbers = false): string {
  if (cell.number != null || cell.grams || cell.lbs) {
    const n = cell.number ?? 0;
    if (plainNumbers) return `<c r="${ref}" t="n"><v>${String(n)}</v></c>`;
    if (cell.lbs) return `<c r="${ref}" t="n" s="3"><v>${String(n)}</v></c>`;
    if (gramCol || cell.grams) {
      const whole = Math.sign(n) * Math.round(Math.abs(n));
      return `<c r="${ref}" t="n" s="2"><v>${String(whole)}</v></c>`;
    }
    return `<c r="${ref}" t="n"><v>${n.toFixed(2)}</v></c>`;
  }
  // A cell with neither text nor number is truly empty: no element at all, so a
  // template reader sees a blank, not an empty string.
  if (cell.text == null) return "";
  return `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(cell.text)}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const gramSet = new Set(sheet.gramColumns ?? []);
  const widths =
    sheet.colWidths ??
    sheet.headers.map((h) => Math.min(40, Math.max(12, h.length + 4)));
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");
  const headerRow = sheet.banner ? 2 : 1;
  const bannerRow = sheet.banner
    ? `<row r="1"><c r="A1" t="inlineStr"><is><t>${xmlEsc(sheet.banner)}</t></is></c></row>`
    : "";
  const headerCells = sheet.headers
    .map((h, i) => `<c r="${colLetter(i)}${headerRow}" t="inlineStr" s="1"><is><t>${xmlEsc(h)}</t></is></c>`)
    .join("");
  const body = sheet.rows
    .map((row, r) => {
      const rowNum = r + headerRow + 1;
      const cells = row
        .map((cell, i) => cellXml(cell, `${colLetter(i)}${rowNum}`, gramSet.has(i), sheet.plainNumbers))
        .join("");
      return `<row r="${rowNum}">${cells}</row>`;
    })
    .join("");
  const filter =
    typeof sheet.autoFilter === "number" && Number.isInteger(sheet.autoFilter) && sheet.autoFilter >= 1 && sheet.headers.length > 0
      ? `\n  <autoFilter ref="A1:${colLetter(sheet.headers.length - 1)}${sheet.autoFilter}"/>`
      : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${cols}</cols>
  <sheetData>
    ${bannerRow}
    <row r="${headerRow}">${headerCells}</row>
    ${body}
  </sheetData>${filter}
</worksheet>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0"/>
    <numFmt numFmtId="165" formatCode="#,##0.00"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="1">
    <fill><patternFill patternType="none"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;

export const XLSX_PART_NAMES = [
  "[Content_Types].xml",
  "_rels/.rels",
  "xl/workbook.xml",
  "xl/_rels/workbook.xml.rels",
  "xl/styles.xml",
  "xl/worksheets/sheet1.xml",
] as const;

/** Build a real .xlsx (uncompressed OOXML zip) with a bold header and gram formats. */
export function buildXlsx(sheet: XlsxSheet): Uint8Array {
  return buildXlsxBook([sheet]);
}

/** Several sheets in one stored .xlsx. Sheet names come from each sheet's sheetName. */
export function buildXlsxBook(sheets: XlsxSheet[]): Uint8Array {
  const list = sheets.length > 0 ? sheets : [{ headers: [], rows: [] }];
  const styleRid = `rId${list.length + 1}`;
  const sheetTags = list
    .map((sheet, i) => `<sheet name="${xmlEsc(sheet.sheetName ?? `Sheet${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  const rels = list
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join("");
  const overrides = list
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");
  const content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${overrides}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
  const book = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetTags}</sheets>
</workbook>`;
  const bookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
  <Relationship Id="${styleRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  const files: ZipFile[] = [
    { name: "[Content_Types].xml", data: te.encode(content) },
    { name: "_rels/.rels", data: te.encode(ROOT_RELS) },
    { name: "xl/workbook.xml", data: te.encode(book) },
    { name: "xl/_rels/workbook.xml.rels", data: te.encode(bookRels) },
    { name: "xl/styles.xml", data: te.encode(STYLES) },
    ...list.map((sheet, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: te.encode(sheetXml(sheet)) })),
  ];
  return writeStoreZip(files);
}

export function xlsxHasParts(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  const text = new TextDecoder("latin1").decode(bytes);
  return XLSX_PART_NAMES.every((name) => text.includes(name));
}

/** The same grid `readXlsbSheets` yields. `row` is zero-based. Cached cell values only. */
export type XlsxGridRow = { row: number; cells: (string | number | boolean | null)[] };

type ZipEntry = { name: string; method: number; data: Uint8Array; compressed: Uint8Array };

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function findEocd(bytes: Uint8Array): number {
  const start = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= start; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
  }
  throw new Error("The workbook is not a zip.");
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateRawBytes(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Central directory, then each local payload. Method 0 is stored. Method 8 is deflate. */
export async function readZip(bytes: Uint8Array): Promise<ZipEntry[]> {
  const eocd = findEocd(bytes);
  const count = readU16(bytes, eocd + 10);
  let cursor = readU32(bytes, eocd + 16);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (readU32(bytes, cursor) !== 0x02014b50) throw new Error("The workbook zip is unreadable.");
    const method = readU16(bytes, cursor + 10);
    const compSize = readU32(bytes, cursor + 20);
    const nameLen = readU16(bytes, cursor + 28);
    const extraLen = readU16(bytes, cursor + 30);
    const commentLen = readU16(bytes, cursor + 32);
    const localAt = readU32(bytes, cursor + 42);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
    const localName = readU16(bytes, localAt + 26);
    const localExtra = readU16(bytes, localAt + 28);
    const dataAt = localAt + 30 + localName + localExtra;
    const compressed = bytes.subarray(dataAt, dataAt + compSize);
    const data = method === 8 ? await inflateRaw(compressed) : compressed;
    entries.push({ name: name.replaceAll("\\", "/"), method, data, compressed });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function writeZip(entries: ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = te.encode(entry.name);
    const payload = entry.method === 8 ? entry.compressed : entry.data;
    const crc = crc32(entry.data);
    const local = concatBytes([
      te.encode("PK\u0003\u0004"),
      u16(20),
      u16(0),
      u16(entry.method),
      u16(0),
      u16(0),
      u32(crc),
      u32(payload.length),
      u32(entry.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      payload,
    ]);
    const central = concatBytes([
      te.encode("PK\u0001\u0002"),
      u16(20),
      u16(20),
      u16(0),
      u16(entry.method),
      u16(0),
      u16(0),
      u32(crc),
      u32(payload.length),
      u32(entry.data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralBytes = concatBytes(centrals);
  const eocd = concatBytes([
    te.encode("PK\u0005\u0006"),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralBytes.length),
    u32(offset),
    u16(0),
  ]);
  return concatBytes([...locals, centralBytes, eocd]);
}

/** Recompress one stored part so a reader is proved on deflate-raw as well as store. */
export async function deflateZipPart(bytes: Uint8Array, name: string): Promise<Uint8Array> {
  const entries = await readZip(bytes);
  const hit = entries.find((entry) => entry.name === name);
  if (!hit) throw new Error(`The zip has no ${name}.`);
  hit.compressed = await deflateRawBytes(hit.data);
  hit.method = 8;
  return writeZip(entries);
}

function xmlText(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function sharedStringList(xml: string): string[] {
  const out: string[] = [];
  const si = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = si.exec(xml))) {
    const parts: string[] = [];
    const texts = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let text: RegExpExecArray | null;
    while ((text = texts.exec(match[1]))) parts.push(xmlText(text[1]));
    out.push(parts.join(""));
  }
  return out;
}

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function sheetGrid(xml: string, strings: readonly string[]): XlsxGridRow[] {
  const byRow = new Map<number, Map<number, string | number | boolean | null>>();
  const cells = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let match: RegExpExecArray | null;
  while ((match = cells.exec(xml))) {
    const attrs = match[1];
    const body = match[2] ?? "";
    const ref = /r="([A-Z]+)(\d+)"/.exec(attrs);
    if (!ref) continue;
    const kind = /t="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const row = Number(ref[2]) - 1;
    const col = colIndex(ref[1]);
    let value: string | number | boolean | null = null;
    const cached = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
    if (kind === "inlineStr") {
      const parts: string[] = [];
      const texts = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
      let text: RegExpExecArray | null;
      while ((text = texts.exec(body))) parts.push(xmlText(text[1]));
      value = parts.join("");
    } else if (kind === "s") {
      value = strings[Number(cached ?? "")] ?? "";
    } else if (kind === "b") {
      value = cached === "1";
    } else if (kind === "str") {
      value = cached == null ? "" : xmlText(cached);
    } else if (cached != null && cached !== "") {
      const n = Number(cached);
      value = Number.isFinite(n) ? n : xmlText(cached);
    }
    const line = byRow.get(row) ?? new Map();
    line.set(col, value);
    byRow.set(row, line);
  }
  return [...byRow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([row, cols]) => {
      const width = cols.size === 0 ? 0 : Math.max(...cols.keys()) + 1;
      const cells: (string | number | boolean | null)[] = Array.from({ length: width }, () => null);
      for (const [col, value] of cols) cells[col] = value;
      return { row, cells };
    });
}

function sheetNames(workbookXml: string): Array<{ name: string; rel: string }> {
  const out: Array<{ name: string; rel: string }> = [];
  const re = /<sheet\b([^>]*)\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(workbookXml))) {
    const name = /name="([^"]*)"/.exec(match[1])?.[1] ?? "";
    const rel = /r:id="([^"]*)"/.exec(match[1])?.[1] ?? "";
    if (name && rel) out.push({ name: xmlText(name), rel });
  }
  return out;
}

function relTargets(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /<Relationship\b([^>]*)\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const id = /Id="([^"]*)"/.exec(match[1])?.[1] ?? "";
    const target = /Target="([^"]*)"/.exec(match[1])?.[1] ?? "";
    if (id && target) out.set(id, target.replaceAll("\\", "/"));
  }
  return out;
}

/** Named sheets from an .xlsx zip. Cached values only. Dates stay Excel serials. */
export async function readXlsxSheets(bytes: Uint8Array, only?: readonly string[]): Promise<Map<string, XlsxGridRow[]>> {
  const entries = await readZip(bytes);
  const file = (name: string) => entries.find((entry) => entry.name === name)?.data;
  const book = file("xl/workbook.xml");
  const rels = file("xl/_rels/workbook.xml.rels");
  if (!book || !rels) throw new Error("The workbook has no sheet list.");
  const stringsRaw = file("xl/sharedStrings.xml");
  const strings = stringsRaw ? sharedStringList(new TextDecoder().decode(stringsRaw)) : [];
  const targets = relTargets(new TextDecoder().decode(rels));
  const wanted = only ? new Set(only) : null;
  const out = new Map<string, XlsxGridRow[]>();
  for (const sheet of sheetNames(new TextDecoder().decode(book))) {
    if (wanted && !wanted.has(sheet.name)) continue;
    const target = targets.get(sheet.rel);
    if (!target) continue;
    const part = target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\//, "")}`;
    const xml = file(part);
    if (!xml) continue;
    out.set(sheet.name, sheetGrid(new TextDecoder().decode(xml), strings));
  }
  return out;
}
