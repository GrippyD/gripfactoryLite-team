-- Owner ruling 2026-08-28: ARL and PNS truck bucked material to PNN; the truck
-- number later identifies what lot went into what silo. It is internal only and
-- must never ride a METRC export (no METRC exports exist in this app yet).
ALTER TABLE wet_weight_entries ADD COLUMN truck_number TEXT;
