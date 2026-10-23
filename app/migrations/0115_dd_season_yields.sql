-- DD L3: past season yields, and the Yield per Plant seasons tile.
-- Unique on (season, strain, farm_code) among live rows is enforced in the
-- upload, because a blank farm (farm wide) is NULL and a unique index would
-- not hold two blanks apart. Nothing seeded.
-- Guarded: a second apply changes nothing.

CREATE TABLE IF NOT EXISTS dd_season_yields (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  strain TEXT NOT NULL,
  strain_id TEXT,
  farm_code TEXT,
  plants INTEGER NOT NULL,
  dry_lb REAL NOT NULL,
  source TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX IF NOT EXISTS dd_season_yields_season ON dd_season_yields (season);

UPDATE dd_kpis
SET title_en = 'Yield per Plant: seasons',
    title_es = 'Rendimiento por planta: temporadas',
    unit = 'lb448',
    goal_kind = 'none',
    goal_ref = NULL,
    compute_key = 'per strain and farm wide: dry lb per plant for the two prior seasons from dd_season_yields (dry_lb over plants), their average over the seasons the strain was grown, this year to date (strainperformance dryLbPerPlant over dried lots with plant counts, the console''s dried filter), and this year projected (dried dry lb plus the field estimate in force per plant times the plants of lots cut but not yet dried, over all plants cut)',
    status = 'live',
    def_version = 2,
    open_question_en = NULL,
    open_question_es = NULL,
    config_key = NULL,
    updated_at = '2026-10-21T00:00:00.000Z'
WHERE kpi_key = 'harvest.dry_lb_per_plant_vs_plan_pct'
  AND NOT (
    title_en = 'Yield per Plant: seasons'
    AND title_es = 'Rendimiento por planta: temporadas'
    AND unit = 'lb448'
    AND goal_kind = 'none'
    AND goal_ref IS NULL
    AND status = 'live'
    AND def_version = 2
    AND open_question_en IS NULL
    AND config_key IS NULL
    AND compute_key = 'per strain and farm wide: dry lb per plant for the two prior seasons from dd_season_yields (dry_lb over plants), their average over the seasons the strain was grown, this year to date (strainperformance dryLbPerPlant over dried lots with plant counts, the console''s dried filter), and this year projected (dried dry lb plus the field estimate in force per plant times the plants of lots cut but not yet dried, over all plants cut)'
  );
