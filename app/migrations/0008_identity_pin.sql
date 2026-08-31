-- Owner rulings 2026-08-31:
-- 1) The Person selector is replaced by the Cloudflare Access login email; people
--    rows auto-create on first login, keyed by a unique email column.
-- 2) The Lead on a wet weight lot stays a picker and stores on the lot itself.
-- 3) Admin and Interco Logistics sit behind a PIN; the PIN is data (canon L-4).
ALTER TABLE people ADD COLUMN email TEXT;

CREATE UNIQUE INDEX idx_people_email ON people(email) WHERE email IS NOT NULL;

ALTER TABLE wet_weight_entries ADD COLUMN lead_person_id TEXT REFERENCES people(id);

CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

INSERT INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('admin_pin', '21319', '2026-08-31T00:00:00.000Z', NULL, '2026-08-31T00:00:00.000Z', NULL, NULL, NULL);
