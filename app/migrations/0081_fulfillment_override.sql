-- FULFILLMENT (canon 0.30.306). The Admin panel is the sole source of the
-- fulfillment figures. One cell is one row of one day. A cleared cell is
-- soft-deleted and kept. The config row is the grams in one each for the
-- rows METRC counts as eaches. INSERT OR IGNORE so a value already typed
-- is left alone.

CREATE TABLE fulfillment_overrides (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  row_key TEXT NOT NULL,
  col TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE UNIQUE INDEX fulfillment_overrides_day_row_col
  ON fulfillment_overrides (entry_date, row_key, col) WHERE deleted_at IS NULL;

CREATE INDEX fulfillment_overrides_day ON fulfillment_overrides (entry_date);

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('fulfillment_unit_grams', 'prepack=28, mobs=70, prerolls=1, vapes=1', '2026-09-29T00:00:00.000Z', NULL, '2026-09-29T00:00:00.000Z', NULL, NULL, NULL);
