import { HttpError, refusal } from "./audit";

/**
 * Import Data queue seam (owner ruling 2026-09-02). Raw bytes stay byte-identical.
 * The first real parsers hang here: Orange Photonics and Aqualab CSV drops.
 */

import { parseAqualabCsv, parseOrangePhotonicsCsv, type InstrumentParseResult } from "./compliance";

export const IMPORT_MAX_BYTES = 1_048_576;
export const XLSB_MAX_BYTES = 8_000_000;
export const IMPORT_KINDS = ["csv", "xlsx", "xlsb", "xlsm"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const IMPORT_STATUS = {
  queued: "queued",
} as const;

export const INSTRUMENT_SOURCES = ["orange_photonics", "aqualab"] as const;
export type InstrumentSource = (typeof INSTRUMENT_SOURCES)[number];

export function isInstrumentSource(value: string): value is InstrumentSource {
  return (INSTRUMENT_SOURCES as readonly string[]).includes(value);
}

/** Parser seam: instrument CSVs hang here so a real sample export is one alias edit. */
export function parseInstrumentCsv(source: InstrumentSource, text: string): InstrumentParseResult {
  if (source === "orange_photonics") return parseOrangePhotonicsCsv(text);
  return parseAqualabCsv(text);
}

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Basename only: strips any path the browser or OS may have sent. */
export function importBasename(filename: string): string {
  const trimmed = filename.trim();
  const parts = trimmed.replaceAll("\\", "/").split("/");
  return parts[parts.length - 1] ?? trimmed;
}

/** Extension decides kind (.csv, .xlsx, .xlsb, or .xlsm, case-insensitive). */
export function importKindFromFilename(filename: string): ImportKind | null {
  const name = importBasename(filename).toLowerCase();
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xlsx")) return "xlsx";
  if (name.endsWith(".xlsb")) return "xlsb";
  if (name.endsWith(".xlsm")) return "xlsm";
  return null;
}

export function importContentType(kind: ImportKind): string {
  return kind === "csv" ? "text/csv" : XLSX_MIME;
}

/** Comma-grouped bytes, or KB when the file is at least 1024 bytes. Display only. */
export function formatByteSize(byteSize: number): string {
  const n = Math.round(Number(byteSize));
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n >= 1024) {
    return `${groupInt(Math.round(n / 1024))} KB`;
  }
  return `${groupInt(n)} B`;
}

function groupInt(n: number): string {
  const abs = Math.abs(n).toFixed(0);
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < 0 ? `-${grouped}` : grouped;
}

/** Strip CR, LF, and quotes so a filename can ride a content-disposition header. */
export function attachmentFilename(filename: string): string {
  return importBasename(filename).replace(/[\r\n"]/g, "_");
}

export function asStoredBytes(content: unknown): Uint8Array {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (ArrayBuffer.isView(content)) {
    const view = content as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  // D1 reads BLOB back as a number array (Workers Binding API type conversion).
  if (Array.isArray(content) && content.every((n) => typeof n === "number")) {
    return Uint8Array.from(content as number[]);
  }
  throw new HttpError(500, "Stored file bytes are unreadable.");
}

/**
 * Kind and size rules for a queued file. Does not read the bytes. Throws 400
 * with a clear line for a wrong extension, a file over the 1 MB queue cap, or an
 * .xlsb or .xlsm over the 8 MB cap.
 */
export function assertImportUpload(filename: string, byteSize: number): ImportKind {
  const kind = importKindFromFilename(filename);
  if (!kind) {
    throw refusal(400, { key: "Only csv, xlsx, xlsb, and xlsm files can be queued.", vars: {} });
  }
  const cap = kind === "xlsb" || kind === "xlsm" ? XLSB_MAX_BYTES : IMPORT_MAX_BYTES;
  if (byteSize > cap) {
    if (kind === "xlsb" || kind === "xlsm") throw refusal(400, { key: "That file is over the 8 MB cap.", vars: {} });
    throw new HttpError(
      400,
      "That file is over the 1 MB cap. Larger files wait until the parser lands."
    );
  }
  if (byteSize < 0 || !Number.isFinite(byteSize)) {
    throw new HttpError(400, "A file is required.");
  }
  return kind;
}
