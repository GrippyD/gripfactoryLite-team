// THE LAB STATION (canon 0.30.362). The one outcome vocabulary the consoles
// read lab_compliance_samples by (BRIEF V24, law 7). Every reader of a lab
// sample's status goes through these, in TypeScript or in SQL, so the words
// live in one place.

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

/** A sample whose status is not a retest one is a first test. */
export function isLabRetest(status: string | null | undefined): boolean {
  return has(LAB_RETEST_STATUSES, status);
}

/** 1 for a first test, 2 for a retest: the attempt the V19 readers count by. */
export function labAttempt(status: string | null | undefined): 1 | 2 {
  return isLabRetest(status) ? 2 : 1;
}

const sqlList = (list: readonly string[]): string => list.map((s) => `'${s}'`).join(", ");

/** The outcome of the row's status column, as 'passed', 'failed' or 'open'. */
export const LAB_OUTCOME_SQL = `CASE WHEN status IN (${sqlList(LAB_PASS_STATUSES)}) THEN 'passed' WHEN status IN (${sqlList(LAB_FAIL_STATUSES)}) THEN 'failed' ELSE 'open' END`;

/** The attempt of the row's status column: 2 for a retest status, else 1. */
export const LAB_ATTEMPT_SQL = `CASE WHEN status IN (${sqlList(LAB_RETEST_STATUSES)}) THEN 2 ELSE 1 END`;
