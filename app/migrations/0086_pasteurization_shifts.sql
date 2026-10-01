-- 0086: BRIEF V10, PASTEURIZATION ON THE CONSOLE (canon 0.30.334, re-based
-- 0.30.335). The owner's doc, its Pasteurization section: "2. Two shift panes,
-- like trim (no equipment), that refer to the date in the first combobox:
-- a. Bulk Bud Lbs; b. Prepack Lbs; c. Shake lbs; d. Waste Lbs; e. Total Lbs;
-- f. Total Hours [Save](you know the deal); g. Lbs/DLH." His answer on the
-- shifts, verbatim: "Their own, new fields".
--
-- 1. "Total Hours [Save]": the hours typed on the console, one number per
--    pasteurization shift per work day, so Lbs/DLH divides by a number
--    everyone sees. A retype overwrites the day's number and the change lands
--    in record_change_log (record_table pasteurization_labor_hours), as
--    trim_labor_hours (0052) does.
CREATE TABLE pasteurization_labor_hours (
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

CREATE INDEX pasteurization_labor_hours_date ON pasteurization_labor_hours (work_date);

-- 2. Values in data (canon L-4), editable in Admin, Lookups, app_config: the
--    pasteurization operators of each shift (comma lists, matched to the cryo
--    operator typed on each output, case-insensitive; blank until named, nothing
--    copied from trim's) and each shift's hours, Eastern, HH:MM-HH:MM.
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('pasteurization_shift_day_operators', '', '2026-10-01T00:00:00.000Z', NULL, '2026-10-01T00:00:00.000Z', NULL, NULL, NULL),
  ('pasteurization_shift_second_operators', '', '2026-10-01T00:00:00.000Z', NULL, '2026-10-01T00:00:00.000Z', NULL, NULL, NULL),
  ('pasteurization_shift_day_hours', '06:00-18:00', '2026-10-01T00:00:00.000Z', NULL, '2026-10-01T00:00:00.000Z', NULL, NULL, NULL),
  ('pasteurization_shift_second_hours', '18:00-06:00', '2026-10-01T00:00:00.000Z', NULL, '2026-10-01T00:00:00.000Z', NULL, NULL, NULL);
