-- THE FARM PLANT COUNT (canon 0.30.288). One number per farm per harvest year,
-- typed on Admin, Lookups. It is the denominator of Plants Remaining/Total on
-- the console and is never written by a METRC pull.

CREATE TABLE farm_plant_counts (
  id TEXT PRIMARY KEY,
  farm_code TEXT NOT NULL,
  harvest_year INTEGER NOT NULL,
  plant_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE UNIQUE INDEX farm_plant_counts_farm_year ON farm_plant_counts (farm_code, harvest_year) WHERE deleted_at IS NULL;
