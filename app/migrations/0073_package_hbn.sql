-- 0073: THE PREPACK SCHEDULER BY PACKAGE, THE HBN INHERITED (canon 0.30.196).
-- The package carries its HBN. wip_packages gains harvest_batch_id, filled
-- from each row's lot, and the lot becomes optional so a package adopted from
-- METRC onto a harvest the app never weighed can stand. Every other column and
-- index stays as it was; the new column rides at the end, as an added column
-- would. harvest_batches gains born_from: app for every batch the app minted,
-- metrc for a batch minted from METRC's harvest name at adoption.

CREATE TABLE wip_packages__0073 (
  id TEXT PRIMARY KEY,
  wet_weight_entry_id TEXT,
  package_code TEXT NOT NULL,
  package_type_code TEXT NOT NULL,
  weight_grams NUMERIC NOT NULL,
  cryo_weight_grams NUMERIC,
  status TEXT NOT NULL,
  test_outcome TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  trim_date TEXT,
  trim_operator TEXT,
  cryo_date TEXT,
  cryo_operator TEXT,
  cryo_run_id TEXT,
  source TEXT,
  harvest_batch_id TEXT
);

INSERT INTO wip_packages__0073 (
  id, wet_weight_entry_id, package_code, package_type_code, weight_grams, cryo_weight_grams,
  status, test_outcome, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by,
  trim_date, trim_operator, cryo_date, cryo_operator, cryo_run_id, source, harvest_batch_id
)
SELECT
  p.id, p.wet_weight_entry_id, p.package_code, p.package_type_code, p.weight_grams, p.cryo_weight_grams,
  p.status, p.test_outcome, p.created_at, p.created_by, p.updated_at, p.updated_by, p.deleted_at, p.deleted_by,
  p.trim_date, p.trim_operator, p.cryo_date, p.cryo_operator, p.cryo_run_id, p.source,
  (SELECT w.harvest_batch_id FROM wet_weight_entries w WHERE w.id = p.wet_weight_entry_id)
FROM wip_packages p;

DROP TABLE wip_packages;

ALTER TABLE wip_packages__0073 RENAME TO wip_packages;

CREATE INDEX wip_packages_status ON wip_packages (status);
CREATE INDEX wip_packages_created_at ON wip_packages (created_at);
CREATE INDEX wip_packages_harvest_batch ON wip_packages (harvest_batch_id);

ALTER TABLE harvest_batches ADD COLUMN born_from TEXT NOT NULL DEFAULT 'app';
