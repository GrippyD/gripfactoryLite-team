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

export type XlsxCell = { text?: string; number?: number; grams?: boolean };

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
  if (cell.number != null || cell.grams) {
    const n = cell.number ?? 0;
    if (plainNumbers) return `<c r="${ref}" t="n"><v>${String(n)}</v></c>`;
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
  const headerCells = sheet.headers
    .map((h, i) => `<c r="${colLetter(i)}1" t="inlineStr" s="1"><is><t>${xmlEsc(h)}</t></is></c>`)
    .join("");
  const body = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((cell, i) => cellXml(cell, `${colLetter(i)}${r + 2}`, gramSet.has(i), sheet.plainNumbers))
        .join("");
      return `<row r="${r + 2}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${cols}</cols>
  <sheetData>
    <row r="1">${headerCells}</row>
    ${body}
  </sheetData>
</worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

function workbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${xmlEsc(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0"/>
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
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
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
  const files: ZipFile[] = [
    { name: "[Content_Types].xml", data: te.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: te.encode(ROOT_RELS) },
    { name: "xl/workbook.xml", data: te.encode(workbookXml(sheet.sheetName ?? "Report")) },
    { name: "xl/_rels/workbook.xml.rels", data: te.encode(WORKBOOK_RELS) },
    { name: "xl/styles.xml", data: te.encode(STYLES) },
    { name: "xl/worksheets/sheet1.xml", data: te.encode(sheetXml(sheet)) },
  ];
  return writeStoreZip(files);
}

export function xlsxHasParts(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  const text = new TextDecoder("latin1").decode(bytes);
  return XLSX_PART_NAMES.every((name) => text.includes(name));
}
