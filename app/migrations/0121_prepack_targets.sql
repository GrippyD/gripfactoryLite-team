-- PC1: one prepack target per strain. Pounds are typed and stored as grams
-- (times 448). A live row is unique on strain_key. Clearing a target is a
-- soft delete, so the row stays for the change log.

CREATE TABLE IF NOT EXISTS prepack_targets (
  id TEXT PRIMARY KEY,
  strain TEXT NOT NULL,
  strain_key TEXT NOT NULL,
  target_grams REAL NOT NULL CHECK (target_grams >= 0),
  note TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS prepack_targets_live
  ON prepack_targets (strain_key)
  WHERE deleted_at IS NULL;
