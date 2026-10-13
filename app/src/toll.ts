/**
 * TOLL LOTS (canon 0.30.431). A toll lot is another company's material that
 * Grip's floor works. It holds a place in the line. It is out of every figure
 * a test is out of. The customer is a company name, blank for Grip's own.
 */

import { formatGrams } from "./config";
import { tFill, type Locale } from "./i18n";

export const TOLL_BOTH = "A lot cannot be both a test and a toll lot.";
export const TOLL_LINE = "Toll lots: {customer} {n} lots, {g} g dry";
export const TOLL_HEADING = "Toll lots";

/** The company name, or null when the lot is Grip's own. Blank is null. */
export function tollCustomer(raw: unknown): string | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  return text.length === 0 ? null : text;
}

/** No customer set. Alias "" reads the bare column. */
export function gripCustomerSql(alias = "b"): string {
  const p = alias ? `${alias}.` : "";
  return `(${p}customer IS NULL OR TRIM(${p}customer) = '')`;
}

/**
 * Grip's own lot: not a test, and not a toll lot. Alias "" reads the bare
 * columns. The season and yield queries use this one fragment.
 */
export function ownLotSql(alias = "b"): string {
  const p = alias ? `${alias}.` : "";
  return `COALESCE(${p}is_test, 0) = 0 AND ${gripCustomerSql(alias)}`;
}

/** The harvest_batches alias `b`, the form the season queries use. */
export const OWN_LOT_SQL = ownLotSql("b");

/** A toll lot: not a test, and a customer is set. */
export function tollLotSql(alias = "b"): string {
  const p = alias ? `${alias}.` : "";
  return `COALESCE(${p}is_test, 0) = 0 AND ${p}customer IS NOT NULL AND TRIM(${p}customer) <> ''`;
}

/** The line under a report's own total. `{n} lots` stays plural, as written. */
export function tollLine(customer: string, lots: number, dryGrams: number, locale: Locale = "en"): string {
  return tFill(locale, TOLL_LINE, {
    customer,
    n: String(lots),
    g: formatGrams(Math.round(dryGrams)),
  });
}
