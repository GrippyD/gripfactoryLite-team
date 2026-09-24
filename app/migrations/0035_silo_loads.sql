-- 0035: silo loads, the Drying Operations [Load Silo] station (owner ruling
-- 2026-09-08, canon 0.30.6, verbatim: "Drying Operations add [load silo]  Left
-- Pane is Wet weights in barn at PNN ... CSV is 832 Barn - 832 Silo n ... 5
-- circles with clocks running ... Start Button - greyed when started - Pause
-- Button - Pencil Button"). One row per lot loaded into a silo: the clock's
-- zero (started_at), the pause state (paused_at while paused, paused_seconds
-- accumulated), and the end (the unload finish closes it). Postgres-portable:
-- no dialect date math; the clocks compute in TypeScript.
CREATE TABLE silo_loads (
  id TEXT PRIMARY KEY,
  dry_space_id TEXT NOT NULL,
  wet_weight_entry_id TEXT NOT NULL,
  loaded_at TEXT NOT NULL,
  started_at TEXT,
  paused_at TEXT,
  paused_seconds INTEGER NOT NULL DEFAULT 0,
  ended_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);
CREATE INDEX silo_loads_space ON silo_loads (dry_space_id);
CREATE INDEX silo_loads_lot ON silo_loads (wet_weight_entry_id);
