-- 0097: MA1, THE METRC API READ INTEGRATION, Phase C, Law 6 (THE HARVESTS
-- LEG). Closes TRANSLATION_MAP gap 2 for rows 1 and 2: canon 0.30.390 (REAL
-- LIFE IN, METRC OUT) records that METRC keeps no harvest date on a package,
-- a harvest carries its dates, so a harvest's real date can be read back only
-- from the harvest itself. One row per METRC harvest id (A36), fed by the API
-- door alone (no export exists for it): the name (the HBN where Grip named it
-- so), the license the call named, the dates and wet weight the API returns,
-- the drying location as METRC words it, the list the harvest was last seen
-- in (active, inactive or onhold; a state change is an in-place update, never
-- gone), the plant count, and THE MIRROR LAW's bookkeeping (mount, first seen,
-- changed, gone). The unit of weight is METRC's UnitOfWeightName verbatim; no
-- gram conversion column (G-3). The harvest name's coded date stays decoded
-- where it is (Findings correction 15). Postgres-portable; nothing here stores
-- a key.

CREATE TABLE metrc_harvests (
  harvest_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  license_value TEXT NOT NULL,
  harvest_start_date TEXT,
  finished_date TEXT,
  archived_date TEXT,
  total_wet_weight NUMERIC,
  unit_of_weight TEXT,
  location TEXT,
  sublocation TEXT,
  state TEXT NOT NULL,
  plant_count INTEGER,
  mount_id TEXT,
  gone_mount_id TEXT,
  first_seen_at TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  gone_at TEXT
);

CREATE INDEX metrc_harvests_license_state ON metrc_harvests (license_value, state, gone_at);
CREATE INDEX metrc_harvests_name ON metrc_harvests (name);
