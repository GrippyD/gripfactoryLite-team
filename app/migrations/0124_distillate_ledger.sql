-- LD1: the distillate ledger (canon 0.30.561). One migration.
-- The processors lookup is seeded with the six names from the brief.
-- Grams are the stored unit. Liters are grams over 1,000.
-- A movement is voided, never edited or deleted.

CREATE TABLE processors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE UNIQUE INDEX processors_name ON processors (name);

INSERT INTO processors (
  id, name, active, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('proc-bowhouse', 'BowHouse', 1, '2026-10-28T00:00:00.000Z', NULL, '2026-10-28T00:00:00.000Z', NULL, NULL, NULL),
  ('proc-mitten', 'Mitten', 1, '2026-10-28T00:00:00.000Z', NULL, '2026-10-28T00:00:00.000Z', NULL, NULL, NULL),
  ('proc-sauce', 'Sauce', 1, '2026-10-28T00:00:00.000Z', NULL, '2026-10-28T00:00:00.000Z', NULL, NULL, NULL),
  ('proc-cannalicious', 'Cannalicious', 1, '2026-10-28T00:00:00.000Z', NULL, '2026-10-28T00:00:00.000Z', NULL, NULL, NULL),
  ('proc-oakcanna', 'Oakcanna', 1, '2026-10-28T00:00:00.000Z', NULL, '2026-10-28T00:00:00.000Z', NULL, NULL, NULL),
  ('proc-golden-lion', 'Golden Lion', 1, '2026-10-28T00:00:00.000Z', NULL, '2026-10-28T00:00:00.000Z', NULL, NULL, NULL);

CREATE TABLE distillate_movements (
  id TEXT PRIMARY KEY,
  moved_on TEXT NOT NULL,
  harvest_year TEXT NOT NULL,
  processor TEXT NOT NULL REFERENCES processors(id),
  kind TEXT NOT NULL,
  grams NUMERIC NOT NULL,
  ref TEXT,
  note TEXT,
  entered_by TEXT,
  created_at TEXT NOT NULL,
  voided_at TEXT,
  CHECK (
    (kind = 'finished' AND grams > 0)
    OR (kind = 'shipped' AND grams > 0)
    OR (kind = 'adjust' AND grams <> 0)
  )
);

CREATE INDEX distillate_movements_year_processor_moved
  ON distillate_movements (harvest_year, processor, moved_on);

CREATE TABLE distillate_counts (
  id TEXT PRIMARY KEY,
  counted_on TEXT NOT NULL,
  harvest_year TEXT NOT NULL,
  processor TEXT REFERENCES processors(id),
  grams NUMERIC NOT NULL,
  counted_by TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  voided_at TEXT,
  CHECK (grams >= 0)
);

CREATE INDEX distillate_counts_year_counted
  ON distillate_counts (harvest_year, counted_on);
