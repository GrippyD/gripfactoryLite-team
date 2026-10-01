-- TERP RECIPES AND THE PASTEURIZATION SCHEDULE (canon 0.30.321).
-- A recipe is saved whole and retired, never edited. A run keeps the
-- recipe it picked by id. Null on every schedule row already stored.

CREATE TABLE terp_recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  retired_at TEXT,
  retired_by TEXT,
  retire_reason TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX terp_recipes_status ON terp_recipes (status);

CREATE TABLE terp_recipe_lines (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  terp_name TEXT NOT NULL,
  percent INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX terp_recipe_lines_recipe ON terp_recipe_lines (recipe_id);

ALTER TABLE production_schedules ADD COLUMN terp_recipe_id TEXT;
ALTER TABLE production_schedules ADD COLUMN terp_dose_pct REAL;

CREATE INDEX production_schedules_terp_recipe ON production_schedules (terp_recipe_id);
