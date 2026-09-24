import { HBN_BLANK_SILO } from "./config";

export type MintInput = {
  entryDate: string;
  farmCode: string;
  growHbnCode: string;
  strainHbnCode: string;
  manicure: 0 | 1;
  siloNumber: string | null;
  lotSerial: number;
};

export type SerialClaim = { harvestYear: number; lotSerial: number };

export class HbnCollisionError extends Error {
  readonly hbn: string;
  constructor(hbn: string) {
    super(
      `HBN already exists: ${hbn}. The mint was not changed. Adjust the batch fields and try again.`
    );
    this.name = "HbnCollisionError";
    this.hbn = hbn;
  }
}

function parseIsoDate(isoDate: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new Error(`Date must be YYYY-MM-DD, got ${isoDate}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${isoDate}`);
  }
  return { year, month, day };
}

export function dayOfYearUtc(isoDate: string): number {
  const { year, month, day } = parseIsoDate(isoDate);
  const utc = Date.UTC(year, month - 1, day);
  const start = Date.UTC(year, 0, 1);
  return Math.floor((utc - start) / 86400000) + 1;
}

export function yyddd(isoDate: string): string {
  const { year } = parseIsoDate(isoDate);
  const yy = String(year % 100).padStart(2, "0");
  const ddd = String(dayOfYearUtc(isoDate)).padStart(3, "0");
  return `${yy}${ddd}`;
}

export function harvestYearFromEntryDate(isoDate: string): number {
  return parseIsoDate(isoDate).year;
}

/** The calendar date behind a YYDDD token (the mint's first segment), as
 * YYYY-MM-DD; null when the token is not five digits or the day is past the
 * year's end. The century is this one. */
export function dateFromYyddd(token: string): string | null {
  const match = /^(\d{2})(\d{3})$/.exec(String(token ?? "").trim());
  if (!match) return null;
  const year = 2000 + Number(match[1]);
  const day = Number(match[2]);
  if (day < 1) return null;
  const utc = new Date(Date.UTC(year, 0, 1) + (day - 1) * 86400000);
  if (utc.getUTCFullYear() !== year) return null;
  return utc.toISOString().slice(0, 10);
}

/** THE FEED READS THE HBN (canon 0.30.141). Owner, 2026-09-20, on the fields
 * Corey's agent asked for: "the feed doesn't carry it but the data hides it in
 * the HBN". The mint format is YYDDD-farm-grow_code-strain_code-manicure-silo-YY###;
 * this reads it back. Null when the text is not a seven-segment HBN. */
export type HbnParts = {
  harvest_day: string | null;
  farm: string;
  grow_code: string;
  strain_code: string;
  manicure: boolean;
  /** The dry space segment as minted: a silo number, or null for NA (a hang dry). */
  silo: string | null;
  serial: string;
};

export function parseHbn(hbn: string | null | undefined): HbnParts | null {
  const parts = String(hbn ?? "").trim().split("-");
  if (parts.length !== 7 || parts.some((p) => p === "")) return null;
  const [token, farm, growCode, strainCode, manicure, silo, serial] = parts;
  return {
    harvest_day: dateFromYyddd(token),
    farm,
    grow_code: growCode,
    strain_code: strainCode,
    manicure: manicure === "1",
    silo: silo.toUpperCase() === HBN_BLANK_SILO ? null : silo,
    serial,
  };
}

/** THE HBN INHERITED (canon 0.30.196; his pick: "Mint the HBN from METRC"):
 * the batch fields read from METRC's harvest name, exactly as METRC states it.
 * The year and serial come from the seventh segment (26007 is 2026, serial 7).
 * The entry date is the first segment's day when it reads as a day of that
 * same year, else the package's packaged date, else the farm day. */
export type MetrcHbnMint = {
  hbn: string;
  farm_code: string;
  grow_code: string;
  strain_code: string;
  manicure: 0 | 1;
  planned_dryspc: string | null;
  harvest_year: number;
  lot_serial: number;
  entry_date: string;
};

export type MetrcHbnReading =
  | { ok: true; mint: MetrcHbnMint }
  | { ok: false; refusal: { key: string; vars: Record<string, string> } };

function calendarDate(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  try {
    parseIsoDate(text);
    return text;
  } catch {
    return null;
  }
}

export function hbnFromMetrcName(name: string, packagedDate: string | null, farmDay: string): MetrcHbnReading {
  const hbn = String(name ?? "").trim().toUpperCase();
  const parts = parseHbn(hbn);
  if (!parts) return { ok: false, refusal: { key: "{hbn} is not a seven-part HBN, so nothing was minted.", vars: { hbn } } };
  const lot = /^(\d{2})(\d{3,})$/.exec(parts.serial);
  if (!lot || Number(lot[2]) < 1) {
    return { ok: false, refusal: { key: "{hbn} does not end in a YY### lot token, so nothing was minted.", vars: { hbn } } };
  }
  const token = hbn.split("-")[0];
  const tokenDay = parts.harvest_day && token.slice(0, 2) === lot[1] ? parts.harvest_day : null;
  const silo = parts.silo == null ? null : /^\d+$/.test(parts.silo) ? String(Number(parts.silo)) : parts.silo;
  return {
    ok: true,
    mint: {
      hbn,
      farm_code: parts.farm,
      grow_code: parts.grow_code,
      strain_code: parts.strain_code,
      manicure: parts.manicure ? 1 : 0,
      planned_dryspc: silo,
      harvest_year: 2000 + Number(lot[1]),
      lot_serial: Number(lot[2]),
      entry_date: tokenDay ?? calendarDate(packagedDate) ?? farmDay,
    },
  };
}

/** The next serial for a harvest year: one past the ledger's max, never below
 * the year's floor (owner ruling 2026-09-14, canon 0.30.55: the first lot
 * token 26010 while the historical lots wait to be entered). A null floor is
 * the plain ledger rule. */
export function nextLotSerial(
  currentMax: number | null | undefined,
  floorSerial: number | null | undefined = null
): number {
  const n = currentMax == null ? 0 : Number(currentMax);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid lot_serial max: ${currentMax}`);
  }
  const next = Math.floor(n) + 1;
  if (floorSerial == null) return next;
  if (!Number.isInteger(floorSerial) || floorSerial < 1) {
    throw new Error(`Invalid lot_serial floor: ${floorSerial}`);
  }
  return Math.max(next, floorSerial);
}

export function formatLotToken(harvestYear: number, lotSerial: number): string {
  if (!Number.isInteger(lotSerial) || lotSerial < 1) {
    throw new Error(`Lot serial must be a positive integer, got ${lotSerial}`);
  }
  const yy = String(harvestYear % 100).padStart(2, "0");
  const serial = String(lotSerial).padStart(3, "0");
  return `${yy}${serial}`;
}

export function formatSiloSegment(siloNumber: string | null | undefined): string {
  if (siloNumber == null || siloNumber.trim() === "") return HBN_BLANK_SILO;
  const trimmed = siloNumber.trim();
  if (/^[0-9]+$/.test(trimmed)) return trimmed.padStart(2, "0");
  return trimmed;
}

export function mintHbn(input: MintInput): string {
  const token = yyddd(input.entryDate);
  const year = harvestYearFromEntryDate(input.entryDate);
  const silo = formatSiloSegment(input.siloNumber);
  const strain = input.strainHbnCode.trim().padStart(3, "0");
  const lot = formatLotToken(year, input.lotSerial);
  return `${token}-${input.farmCode}-${input.growHbnCode}-${strain}-${input.manicure}-${silo}-${lot}`;
}

export function maxSerialForYear(
  existing: readonly SerialClaim[],
  harvestYear: number
): number | null {
  let max: number | null = null;
  for (const row of existing) {
    if (row.harvestYear !== harvestYear) continue;
    if (max == null || row.lotSerial > max) max = row.lotSerial;
  }
  return max;
}

export function tryClaimSerial(
  existing: SerialClaim[],
  harvestYear: number,
  lotSerial: number
): boolean {
  if (existing.some((row) => row.harvestYear === harvestYear && row.lotSerial === lotSerial)) {
    return false;
  }
  existing.push({ harvestYear, lotSerial });
  return true;
}

export function assertHbnAvailable(
  existing: { id: string } | null | undefined,
  hbn: string
): void {
  if (existing) throw new HbnCollisionError(hbn);
}
