-- WB1, THE TEAM WHITEBOARD (the owner, 2026-11-17): "I need a team whiteboard in Admin."
-- A double click puts a note where it is typed, in a box that moves; Delete on the active box asks first.
-- Each note keeps the email of the person who wrote it, its originator, for the clean list export.
-- Clear all takes the Admin PIN again. A picture's text is read, reviewed line by line, and placed (source import).
-- Notes are soft deleted: a single delete and a clear both stamp deleted_at, so a clear can be recovered here.
CREATE TABLE wb_notes (
  id TEXT PRIMARY KEY,
  board_key TEXT NOT NULL DEFAULT 'team',
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  x INTEGER NOT NULL CHECK (x BETWEEN 0 AND 3200),
  y INTEGER NOT NULL CHECK (y BETWEEN 0 AND 2000),
  source TEXT NOT NULL DEFAULT 'typed' CHECK (source IN ('typed', 'import')),
  originator_email TEXT NOT NULL CHECK (length(originator_email) > 0 AND originator_email = lower(trim(originator_email))),
  originator_person_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by_email TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by_email TEXT,
  delete_kind TEXT CHECK (delete_kind IS NULL OR delete_kind IN ('one', 'clear_all')),
  clear_batch TEXT,
  CHECK ((deleted_at IS NULL) = (delete_kind IS NULL)),
  CHECK (delete_kind IS NOT 'clear_all' OR clear_batch IS NOT NULL)
);
CREATE INDEX wb_notes_live ON wb_notes (board_key, deleted_at, y, x);
