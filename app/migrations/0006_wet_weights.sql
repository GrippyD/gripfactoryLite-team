-- Owner ruling 2026-08-28: the wet weight station becomes a header + weights ledger.
-- Each lot (wet_weight_entries row) collects many weighings. wet_weights is the
-- append-only ledger; the lot's weight_grams stays the live total of non-voided rows.
CREATE TABLE wet_weights (
  id TEXT PRIMARY KEY,
  wet_weight_entry_id TEXT NOT NULL,
  weight_grams NUMERIC NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX wet_weights_entry ON wet_weights (wet_weight_entry_id);
CREATE INDEX wet_weights_created_at ON wet_weights (created_at);

-- Farm display names spelled out for the station header (HBN then the farm name).
-- Flagged for owner confirmation; the names stay editable in Admin, Lookups.
UPDATE farms SET display_name = 'Arlington' WHERE code = 'ARL';
UPDATE farms SET display_name = 'Penn South' WHERE code = 'PNS';
UPDATE farms SET display_name = 'Penn North' WHERE code = 'PNN';
