-- 0066: THE SHEET SYNC (canon 0.30.162). Owner, 2026-09-21, verbatim:
-- "on that topic, can we setup a cron job or something to regularly check the
-- sheet?  It's not going anywhere."
-- His picks (AskUserQuestion, 2026-09-21): the lane, "The worker pulls the sheet
-- on its own cron"; the cadence, "Every hour"; a row that reads like a season
-- total, "Take it as typed"; the Graph app registration, "I can, with your steps".
--
-- One row per run of the Labor tab read. status is ok, skipped, or failed.
-- trigger is cron or admin. rows_landed counts inserts, rows_changed updates,
-- rows_skipped the future, blank, and non-farm rows. message is the error text
-- on failed (a Graph status and a body head, never a token). The last 500 runs
-- are kept. The three app_config rows are the workbook's place in data (canon
-- L-4), editable in Admin, Lookups, app_config.
CREATE TABLE sheet_sync_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  trigger TEXT NOT NULL,
  workbook_modified_at TEXT,
  workbook_ctag TEXT,
  rows_seen INTEGER,
  rows_landed INTEGER,
  rows_changed INTEGER,
  rows_skipped INTEGER,
  message TEXT
);

CREATE INDEX sheet_sync_runs_started_at ON sheet_sync_runs (started_at);

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('sheet_drive_id', 'b!hLLp1cDWXkeCQTO5rv3K44ZzPy9mrjZFgUOar8SCPqxXhso9CN3pSqsCANdLw8Oi', '2026-09-21T00:00:00.000Z', NULL, '2026-09-21T00:00:00.000Z', NULL, NULL, NULL),
  ('sheet_item_id', '01C7EIU75DJNOITHJNVNB3RBX6XLXX6FQA', '2026-09-21T00:00:00.000Z', NULL, '2026-09-21T00:00:00.000Z', NULL, NULL, NULL),
  ('sheet_labor_tab', 'Labor', '2026-09-21T00:00:00.000Z', NULL, '2026-09-21T00:00:00.000Z', NULL, NULL, NULL);
