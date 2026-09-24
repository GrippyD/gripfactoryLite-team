-- Four-window floor (canon 0.28.0) and HBN license (canon 0.28.1 addendum).
-- Unshipped; widened in the same sitting. From-zero pin stays 30.

ALTER TABLE interco_movements ADD COLUMN origin_location TEXT;
ALTER TABLE interco_movements ADD COLUMN destination_location TEXT;

ALTER TABLE harvest_batches ADD COLUMN license_value TEXT;

-- Farm assignments on the known AU licenses (lookup_values.farm_code from 0029).
UPDATE lookup_values
   SET farm_code = 'PNN', updated_at = '2026-09-06T00:00:00.000Z'
 WHERE category = 'license' AND value IN ('AU-G-C-000832', 'AU-P-000694');

UPDATE lookup_values
   SET farm_code = 'ARL', updated_at = '2026-09-06T00:00:00.000Z'
 WHERE category = 'license' AND value = 'AU-G-C-001509';

UPDATE lookup_values
   SET farm_code = 'PNS', updated_at = '2026-09-06T00:00:00.000Z'
 WHERE category = 'license' AND value = 'AU-G-C-001397';

-- Med placeholders. INSERT OR IGNORE on id; value-level guard via WHERE NOT EXISTS.
INSERT OR IGNORE INTO lookup_values (
  id, category, value, label, sort_order, farm_code,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
)
SELECT 'a2000004-0001-4000-8000-000000000010', 'license', 'MED-ARL-TBD', 'ARL Med (placeholder)', 8, 'ARL',
       '2026-09-06T00:00:00.000Z', NULL, '2026-09-06T00:00:00.000Z', NULL, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM lookup_values WHERE category = 'license' AND value = 'MED-ARL-TBD'
);

INSERT OR IGNORE INTO lookup_values (
  id, category, value, label, sort_order, farm_code,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
)
SELECT 'a2000004-0001-4000-8000-000000000011', 'license', 'MED-PNS-TBD', 'PNS Med (placeholder)', 9, 'PNS',
       '2026-09-06T00:00:00.000Z', NULL, '2026-09-06T00:00:00.000Z', NULL, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM lookup_values WHERE category = 'license' AND value = 'MED-PNS-TBD'
);

INSERT OR IGNORE INTO lookup_values (
  id, category, value, label, sort_order, farm_code,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
)
SELECT 'a2000004-0001-4000-8000-000000000012', 'license', '1132', 'PNN Med (1132 stack)', 2, 'PNN',
       '2026-09-06T00:00:00.000Z', NULL, '2026-09-06T00:00:00.000Z', NULL, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM lookup_values WHERE category = 'license' AND value = '1132'
);

UPDATE lookup_values
   SET farm_code = 'PNN', updated_at = '2026-09-06T00:00:00.000Z'
 WHERE category = 'license' AND value = '1132' AND (farm_code IS NULL OR farm_code = '');

-- Backfill: a NULL batch license takes its farm's AU grow license.
UPDATE harvest_batches
   SET license_value = 'AU-G-C-001509'
 WHERE license_value IS NULL AND farm_code = 'ARL';

UPDATE harvest_batches
   SET license_value = 'AU-G-C-001397'
 WHERE license_value IS NULL AND farm_code = 'PNS';

UPDATE harvest_batches
   SET license_value = 'AU-G-C-000832'
 WHERE license_value IS NULL;
