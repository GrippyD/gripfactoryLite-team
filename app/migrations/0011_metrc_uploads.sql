-- Owner ruling 2026-08-31: [Pending Data Uploads], a new Admin surface: a list
-- of CSVs awaiting upload to METRC, one format per data type, starting with Wet
-- Weights. A metrc_uploads row records "this batch's file of this kind was
-- marked uploaded at T"; the pending law lives in code (src/db.ts): a batch
-- pends when the newest updated_at among its non-voided finished (not weighing)
-- lots is newer than its latest uploaded_at for the kind, or when no upload row
-- exists. An edit after upload re-pends the file on purpose, changed data wants
-- a re-upload. Owner terms law: HBN = the METRC harvest NAME, it follows every
-- subsequent package; Lot = the YY### serial (year + sequential order of the
-- harvest); Package ID = METRC package, all or part of a lot. The file is named
-- <HBN>.csv and a batch's file becomes pending when the TL clicks Finish lot.
CREATE TABLE metrc_uploads (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  harvest_batch_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX metrc_uploads_batch_kind ON metrc_uploads (harvest_batch_id, kind);
