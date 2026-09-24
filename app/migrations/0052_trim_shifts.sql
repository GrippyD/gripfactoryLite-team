-- 0052: THE TRIMMING SECTION (canon 0.30.88). Owner ruling 2026-09-16,
-- verbatim: "in the harvest console (not the continuum one) let's work on
-- Trimming: Day shift: Lbs Produced Yesterday / DLH Yesterday: [numbox] /
-- Lbs/DLH / BTR (BTR=(BUD+WPR+SHA)/All weight ran that shift) shown as a
-- percentage / BUD = [BUD+WPR+SHA] / OTHER = All other / Second Shift / Same /
-- Display them in a visual way (graphed or something, a pictograph of some
-- kind maybe)". His picks (AskUserQuestion, 2026-09-16): the shifts are the
-- operators ("Olga = Days, Victor = Afternoons") and "WPR means SMALLS".
--
-- 1. "DLH Yesterday: [numbox]": the direct labor hours typed on the console,
--    one number per shift per work day, so Lbs/DLH divides by a number
--    everyone sees. A retype overwrites the day's number and the change lands
--    in record_change_log (record_table trim_labor_hours).
CREATE TABLE trim_labor_hours (
  id TEXT PRIMARY KEY,
  work_date TEXT NOT NULL,
  shift TEXT NOT NULL,
  hours NUMERIC NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  UNIQUE (work_date, shift)
);

CREATE INDEX trim_labor_hours_date ON trim_labor_hours (work_date);

-- 2. Values in data (canon L-4), editable in Admin, Lookups, app_config: the
--    package type codes that count as BUD in the BTR (his BUD+WPR+SHA, where
--    WPR means SMALLS and SHA is SHAKE), and the trim operators of each shift
--    (comma lists, matched to the typed trim operator, case-insensitive).
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('btr_type_codes', 'BUD,SMALLS,SHAKE', '2026-09-16T00:00:00.000Z', NULL, '2026-09-16T00:00:00.000Z', NULL, NULL, NULL),
  ('trim_shift_day_operators', 'Olga', '2026-09-16T00:00:00.000Z', NULL, '2026-09-16T00:00:00.000Z', NULL, NULL, NULL),
  ('trim_shift_second_operators', 'Victor', '2026-09-16T00:00:00.000Z', NULL, '2026-09-16T00:00:00.000Z', NULL, NULL, NULL);
