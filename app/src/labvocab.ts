// THE LAB STATION (canon 0.30.362). The one outcome vocabulary the consoles
// read lab_compliance_samples by (BRIEF V24, law 7). Every reader of a lab
// sample's status goes through these, in TypeScript or in SQL, so the words
// live in one place.
//
// THE STATION IS THE TEST RECORD (canon 0.30.365, BRIEF V25 law 1): ONE
// RETEST RULE. A sample is a retest when its status is a retest one, OR its
// required test begins with "Retest" (case-blind, after trimming). A retest
// means the package failed at least once, so it is never a first test and is
// out of every FTQ, numerator and denominator. Its outcome stays by status.

/** The set the consoles picture: compliance samples, not voided. R&D is out (V19). */
export const LAB_CONSOLE_SET_SQL = "program = 'compliance' AND voided_at IS NULL";

export const LAB_PASS_STATUSES = ["passed", "retest_passed"] as const;
export const LAB_FAIL_STATUSES = ["failed", "retest_failed"] as const;
export const LAB_OPEN_STATUSES = ["scheduled", "not_submitted", "in_testing"] as const;
export const LAB_RETEST_STATUSES = ["retest_passed", "retest_failed"] as const;

export type LabOutcome = "passed" | "failed" | "open";

const has = (list: readonly string[], status: string | null | undefined): boolean =>
  status != null && list.includes(status);

/** passed and retest_passed pass; failed and retest_failed fail; anything else is open. */
export function labOutcome(status: string | null | undefined): LabOutcome {
  if (has(LAB_PASS_STATUSES, status)) return "passed";
  if (has(LAB_FAIL_STATUSES, status)) return "failed";
  return "open";
}

/** A required test that names a retest: it begins with "Retest", case-blind,
 * after trimming ("Retest (Coliforms)", " retest (metals)"). */
export function isRetestTest(requiredTest: string | null | undefined): boolean {
  return String(requiredTest ?? "").trim().toLowerCase().startsWith("retest");
}

/** A retest: a retest status, or a required test that names a retest. Never a first test. */
export function isLabRetest(status: string | null | undefined, requiredTest: string | null | undefined): boolean {
  return has(LAB_RETEST_STATUSES, status) || isRetestTest(requiredTest);
}

/** 1 for a first test, 2 for a retest: the attempt the V19 readers count by. */
export function labAttempt(status: string | null | undefined, requiredTest: string | null | undefined): 1 | 2 {
  return isLabRetest(status, requiredTest) ? 2 : 1;
}

const sqlList = (list: readonly string[]): string => list.map((s) => `'${s}'`).join(", ");

/** The outcome of the row's status column, as 'passed', 'failed' or 'open'. */
export const LAB_OUTCOME_SQL = `CASE WHEN status IN (${sqlList(LAB_PASS_STATUSES)}) THEN 'passed' WHEN status IN (${sqlList(LAB_FAIL_STATUSES)}) THEN 'failed' ELSE 'open' END`;

/** isRetestTest over the row's required_test column. LOWER carries the case
 * blindness: LIKE is case-blind in SQLite and not in Postgres. SQL TRIM takes
 * spaces only where the TypeScript trim takes every blank; the two agree on
 * every stored row, since the station stores required_test trimmed (labrules). */
export const LAB_RETEST_TEST_SQL = `LOWER(TRIM(COALESCE(required_test, ''))) LIKE 'retest%'`;

/** The attempt of the row: 2 for a retest status or a required test that names a retest, else 1. */
export const LAB_ATTEMPT_SQL = `CASE WHEN status IN (${sqlList(LAB_RETEST_STATUSES)}) OR ${LAB_RETEST_TEST_SQL} THEN 2 ELSE 1 END`;

/** One sample in testing as Lbs in testing reads it. */
export type LabInTestingRow = {
  id: string;
  source_metrc_tag: string | null;
  batch_weight_g: number | string | null;
  scheduled_at: string | null;
  changed_at: string | null;
};

/** BRIEF V25 law 2, LBS IN TESTING COUNTS A PACKAGE ONCE: over the samples in
 * testing, one batch weight per source tag, the newest sample's (by
 * scheduled_at, then changed_at, then the id, so a tie still names one). A
 * sample with no source tag counts on its own. Grams as stored, unrounded. */
export function labInTestingGrams(rows: readonly LabInTestingRow[]): number {
  const newer = (a: LabInTestingRow, b: LabInTestingRow): boolean => {
    const keys: Array<[string, string]> = [
      [String(a.scheduled_at ?? ""), String(b.scheduled_at ?? "")],
      [String(a.changed_at ?? ""), String(b.changed_at ?? "")],
      [String(a.id), String(b.id)],
    ];
    for (const [x, y] of keys) if (x !== y) return x > y;
    return false;
  };
  const byTag = new Map<string, LabInTestingRow>();
  const untagged: LabInTestingRow[] = [];
  for (const row of rows) {
    const tag = String(row.source_metrc_tag ?? "").trim().toUpperCase();
    if (!tag) {
      untagged.push(row);
      continue;
    }
    const held = byTag.get(tag);
    if (!held || newer(row, held)) byTag.set(tag, row);
  }
  const grams = (row: LabInTestingRow): number => {
    const n = Number(row.batch_weight_g);
    return row.batch_weight_g != null && row.batch_weight_g !== "" && Number.isFinite(n) ? n : 0;
  };
  return [...byTag.values(), ...untagged].reduce((sum, row) => sum + grams(row), 0);
}
