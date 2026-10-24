-- WL1. The mirror takes the Inactive and Transferred package exports.
-- inactive_state is Finished when that file's Finished cell is true, else
-- Discontinued. Null means the Inactive export never named the package.
-- metrc_transfers keeps one row per package tag and manifest. A later file
-- that omits a row leaves it (transfers are history).
-- uom: the Transferred export has no unit column. The assumption is ea when
-- the item prefix (the text before " - ") is PRE, else g.

ALTER TABLE metrc_packages ADD COLUMN inactive_state TEXT CHECK (inactive_state IS NULL OR inactive_state IN ('Finished', 'Discontinued'));

CREATE TABLE IF NOT EXISTS metrc_transfers (
  tag TEXT NOT NULL,
  license_value TEXT NOT NULL,
  manifest TEXT NOT NULL,
  destination_facility TEXT,
  destination_license TEXT,
  shipped_quantity NUMERIC,
  uom TEXT NOT NULL CHECK (uom IN ('ea', 'g')),
  lab_state TEXT,
  received_date TEXT,
  source_harvests TEXT,
  source_packages TEXT,
  item TEXT,
  category TEXT,
  item_strain TEXT,
  transfer_type TEXT NOT NULL CHECK (transfer_type IN ('Lab sample', 'Sale')),
  mount_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  PRIMARY KEY (tag, manifest)
);

CREATE INDEX IF NOT EXISTS metrc_transfers_license ON metrc_transfers (license_value);
