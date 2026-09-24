-- 0065: THE TRIM LINE PICTURE (canon 0.30.154). Owner ruling 2026-09-21,
-- verbatim (with his machine picture: a circle TRIM above a box T-0, T-0 joined
-- left to SORTER then to MARVEL by thick flow bars, MARVEL fanning down to BIO,
-- BUD and RETRIM): "Look at the screenshot.  This is what I want to use for the
-- "visual" aspect of the trimming panes on the harvest dashboard. [...] Under
-- that we can list the hours from the sheet for that same date / Ender the
-- hours we can take input lbs (total lbs ran through T-0) / Use the same
-- "RUNNING" flash you do on the silos while there's open lots running through
-- the time weight entry node". His pick (AskUserQuestion, 2026-09-21) on the
-- input lbs: "Per shift, beside the DLH box".
--
-- The input pounds typed on the Harvest Console, the total pounds run through
-- T-0 by one shift on one work day, as typed (pounds, two decimals). A retype
-- overwrites the shift's number, a blank clears it, and every change lands in
-- record_change_log (record_table trim_line_inputs, field lbs), like the DLH
-- box beside it (trim_labor_hours, migration 0052).
CREATE TABLE trim_line_inputs (
  id TEXT PRIMARY KEY,
  work_date TEXT NOT NULL,
  shift TEXT NOT NULL,
  lbs NUMERIC NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  UNIQUE (work_date, shift)
);

CREATE INDEX trim_line_inputs_date ON trim_line_inputs (work_date);
