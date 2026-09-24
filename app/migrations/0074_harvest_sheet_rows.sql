-- 0074: THE HARVEST DETAILS IMPORT (canon 0.30.205). The ops dash Harvest Details
-- tab is the book of reality. METRC's harvest name is the HBN string. One row
-- per sheet name and tag, so a lot with two harvest tags keeps both. Grams stay
-- the sheet's figures. The four counts sit beside the Labor counts on the same
-- run. sheet_harvest_tab is the tab name, a value in data.

CREATE TABLE harvest_sheet_rows (
  sheet_hbn TEXT NOT NULL,
  metrc_harvest_tag TEXT NOT NULL DEFAULT '',
  row_no INTEGER NOT NULL,
  sheet_date TEXT,
  farm_code TEXT,
  grow_method TEXT,
  strain_name TEXT,
  market_strain TEXT,
  manicure INTEGER,
  cuts NUMERIC,
  plants NUMERIC,
  wet_spear_g NUMERIC,
  bucked_wet_g NUMERIC,
  seq NUMERIC,
  seq_date TEXT,
  silo TEXT,
  dry_weight_g NUMERIC,
  dry_down NUMERIC,
  moisture NUMERIC,
  water_activity NUMERIC,
  containers NUMERIC,
  total_bud_g NUMERIC,
  total_other_g NUMERIC,
  btr NUMERIC,
  packaging_waste NUMERIC,
  avg_bud_thc NUMERIC,
  avg_bio_thc NUMERIC,
  avg_shake_thc NUMERIC,
  untested_bud_g NUMERIC,
  tested_bud_g NUMERIC,
  trim_g NUMERIC,
  other_g NUMERIC,
  harvest_batch_id TEXT,
  landed_at TEXT NOT NULL,
  run_id TEXT NOT NULL,
  PRIMARY KEY (sheet_hbn, metrc_harvest_tag)
);

CREATE INDEX harvest_sheet_rows_batch ON harvest_sheet_rows (harvest_batch_id);

ALTER TABLE sheet_sync_runs ADD COLUMN harvest_rows_seen INTEGER;
ALTER TABLE sheet_sync_runs ADD COLUMN harvest_rows_landed INTEGER;
ALTER TABLE sheet_sync_runs ADD COLUMN harvest_rows_changed INTEGER;
ALTER TABLE sheet_sync_runs ADD COLUMN harvest_rows_skipped INTEGER;

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('sheet_harvest_tab', 'Harvest Details', '2026-09-23T00:00:00.000Z', NULL, '2026-09-23T00:00:00.000Z', NULL, NULL, NULL);
