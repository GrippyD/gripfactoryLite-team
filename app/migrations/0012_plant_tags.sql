-- Owner ruling 2026-08-31: the Plant fill rule, verbatim: "We use randbetween
-- in excel right now where the weight per plant is nominally the same, but the
-- data looks organic. The total of each randbetween value must combine to the
-- actual total wet grams weighed." Plant tags paste onto a pending batch on
-- [Pending Data Uploads]; with tags saved, the batch's wet weights file
-- carries one row per tag, weights split from the finished entries by a
-- seeded jitter, cent-exact to the wet total (src/csv.ts). Saving replaces:
-- the batch's current non-voided tags soft-delete and the new set inserts in
-- one db.batch. Dedupe is enforced in the action, because a partial unique
-- index on (harvest_batch_id, tag) WHERE deleted_at IS NULL is not portable;
-- the index below is a plain lookup index.
CREATE TABLE harvest_plant_tags (
  id TEXT PRIMARY KEY,
  harvest_batch_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX harvest_plant_tags_batch ON harvest_plant_tags (harvest_batch_id);

-- Owner ruling 2026-08-31: the split's jitter percent is data (canon L-4),
-- editable without a deploy; code falls back to 10 when the key is missing.
INSERT INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('plant_split_jitter_pct', '10', '2026-08-31T00:00:00.000Z', NULL, '2026-08-31T00:00:00.000Z', NULL, NULL, NULL);
