import { HBN_BLANK_SILO } from "./config";

export type MintInput = {
  entryDate: string;
  farmCode: string;
  growHbnCode: string;
  strainHbnCode: string;
  manicure: 0 | 1;
  siloNumber: string | null;
};

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

export function mintHbn(input: MintInput): string {
  const token = yyddd(input.entryDate);
  const yy = token.slice(0, 2);
  const silo =
    input.siloNumber && input.siloNumber.trim() !== ""
      ? input.siloNumber.trim()
      : HBN_BLANK_SILO;
  const strain = input.strainHbnCode.trim().padStart(3, "0");
  return `${token}-${input.farmCode}-${input.growHbnCode}-${strain}-${input.manicure}-${silo}-${yy}`;
}

export function assertHbnAvailable(
  existing: { id: string } | null | undefined,
  hbn: string
): void {
  if (existing) throw new HbnCollisionError(hbn);
}
