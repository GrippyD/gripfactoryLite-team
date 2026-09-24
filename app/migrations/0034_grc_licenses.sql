-- 0034: THE GR-C TRIO SWAP (owner fork 5, 2026-09-07, verbatim: "do it";
-- Patrick's feedback named PNS Med as GR-C-001405, matching the 0020 trio).
-- The GR-C rows become the farm-assigned Med licenses; the placeholders
-- retire by soft delete (history keeps its shape); batches minted against a
-- placeholder move to the real number so their paper reads true.

UPDATE lookup_values SET farm_code = 'PNN', updated_at = '2026-09-07T00:00:00.000Z'
 WHERE category = 'license' AND value = 'GR-C-001132' AND deleted_at IS NULL;
UPDATE lookup_values SET farm_code = 'PNS', updated_at = '2026-09-07T00:00:00.000Z'
 WHERE category = 'license' AND value = 'GR-C-001405' AND deleted_at IS NULL;
UPDATE lookup_values SET farm_code = 'ARL', updated_at = '2026-09-07T00:00:00.000Z'
 WHERE category = 'license' AND value = 'GR-C-002600' AND deleted_at IS NULL;

UPDATE lookup_values SET deleted_at = '2026-09-07T00:00:00.000Z', delete_reason = 'GR-C trio ratified (canon 0.30.1 fork 5)'
 WHERE category = 'license' AND value IN ('MED-ARL-TBD', 'MED-PNS-TBD', '1132') AND deleted_at IS NULL;

UPDATE harvest_batches SET license_value = 'GR-C-002600', updated_at = '2026-09-07T00:00:00.000Z'
 WHERE license_value = 'MED-ARL-TBD' AND deleted_at IS NULL;
UPDATE harvest_batches SET license_value = 'GR-C-001405', updated_at = '2026-09-07T00:00:00.000Z'
 WHERE license_value = 'MED-PNS-TBD' AND deleted_at IS NULL;
UPDATE harvest_batches SET license_value = 'GR-C-001132', updated_at = '2026-09-07T00:00:00.000Z'
 WHERE license_value = '1132' AND deleted_at IS NULL;
