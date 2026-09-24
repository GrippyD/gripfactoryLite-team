-- Crew feedback via the owner, 2026-09-04 (canon 0.22.0).
-- Market strain law: a free-text market name on the HBN overrides the product
-- display name on everything downstream of the batch (minted inventory items,
-- manifests, listings, labels) while the HBN token and the strain linkage keep
-- the true cultivar ("future Dennis will still want to know what the actual
-- cultivar was"). Blank means the cultivar displays as ever.
ALTER TABLE harvest_batches ADD COLUMN market_strain TEXT;

-- Planned fields law addendum: Acquire carries the plan (planned start time,
-- planned_dryspc); Wet Weight captures the actuals, and the wet entry is what
-- ratifies the HBN. The lot header gains the actual start time (24-hour law,
-- optional so the floor is never blocked).
ALTER TABLE wet_weight_entries ADD COLUMN actual_start_time TEXT;
