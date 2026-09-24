-- 0036: two owner rulings of 2026-09-08 (canon 0.30.9).
--
-- R4, verbatim: "Null Market Strains should automatically inherit the real
-- strain, the market strain should be what's listed from Trim Packages entry
-- forward". Acquire now stores the strain name when the market strain is left
-- blank; this backfills every batch minted before the law so the Trim-forward
-- surfaces read a market strain on every lot.
UPDATE harvest_batches
   SET market_strain = (SELECT s.name FROM strains s WHERE s.id = harvest_batches.strain_id)
 WHERE (market_strain IS NULL OR trim(market_strain) = '')
   AND strain_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM strains s WHERE s.id = harvest_batches.strain_id);

-- R7, verbatim: "Cryo and Trim need the dates saved to each record, along
-- with the hand entry of the operator filling in the data". A trim package
-- stores the trim date and the hand-typed operator at entry; the cryo weight
-- stores its own date and operator when it lands. Existing rows keep NULLs
-- (their created_at and created_by remain the system record).
ALTER TABLE wip_packages ADD COLUMN trim_date TEXT;
ALTER TABLE wip_packages ADD COLUMN trim_operator TEXT;
ALTER TABLE wip_packages ADD COLUMN cryo_date TEXT;
ALTER TABLE wip_packages ADD COLUMN cryo_operator TEXT;
