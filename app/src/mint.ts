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

export function nextLotSerial(currentMax: number | null | undefined): number {
  const n = currentMax == null ? 0 : Number(currentMax);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid lot_serial max: ${currentMax}`);
  }
  return Math.floor(n) + 1;
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
