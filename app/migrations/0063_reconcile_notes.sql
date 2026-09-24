-- Migration 0063: THE RECONCILE LEDGER LOCATION (canon 0.30.135).
-- Owner, 2026-09-20, verbatim: "add a new button to Admin: [Reconcile Ledger
-- Location] 1. Select Farm: (inert for now--we're all one farm as long as
-- interco is out of the chain) 2. Select Location - Start with just the drying
-- locations/freezers 1. Purge 1. Reason 2. Admin PIN 2. Edit 1. All the data
-- that's in the location becomes editable plus a note before saving changes -
-- reflect all on the changelog - No changes to the original CSV, but add
-- something to the data queue that's more like a note that can be
-- aknowe=ledged that the change occurred."
--
-- The note that rides the data queue: one row per Purge or per saved Edit,
-- what was done and where, in the reconciler's words, standing on Pending
-- Data Uploads until a hand acknowledges it. No METRC file is cut for it.
-- Append-only law: never edit this file once applied.

CREATE TABLE reconcile_notes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  farm_code TEXT,
  location TEXT NOT NULL,
  note TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT,
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX reconcile_notes_open ON reconcile_notes (acknowledged_at, created_at);
