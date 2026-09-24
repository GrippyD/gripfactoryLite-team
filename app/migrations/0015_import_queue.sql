-- Owner ruling 2026-09-02: Admin [Import Data], a multipurpose upload queue.
-- Files store in D1 behind a 1 MB per-file cap; a parser hangs later and we
-- move to R2 if bigger files show up. status is seeded at 'queued' only;
-- parsing states come later. content is the raw bytes (SQLite BLOB; a
-- Postgres port would spell this BYTEA). delete_reason rides the house
-- void columns so a reasoned void can store the reason on the row as well
-- as in record_change_log.

CREATE TABLE import_queue (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  kind TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  content BLOB NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX import_queue_status ON import_queue (status, created_at);
