-- ONE HARVEST FILE PER LOAD (canon 0.30.249). Each finished load of an HBN
-- carries a number, 1, 2, 3, in the order its loads first finish. The harvest
-- file is <HBN>(n).csv for that load alone. Tags paste onto a load. A mark
-- records the grams and the plant count the file carried.
ALTER TABLE wet_weight_entries ADD COLUMN harvest_file_seq INTEGER;

UPDATE wet_weight_entries
SET harvest_file_seq = (
  SELECT COUNT(*) FROM wet_weight_entries w2
  WHERE w2.harvest_batch_id = wet_weight_entries.harvest_batch_id
    AND (
      w2.created_at < wet_weight_entries.created_at
      OR (w2.created_at = wet_weight_entries.created_at AND w2.id <= wet_weight_entries.id)
    )
);

ALTER TABLE harvest_plant_tags ADD COLUMN wet_weight_entry_id TEXT;

UPDATE harvest_plant_tags
SET wet_weight_entry_id = (
  SELECT w.id FROM wet_weight_entries w
  WHERE w.harvest_batch_id = harvest_plant_tags.harvest_batch_id AND w.deleted_at IS NULL
)
WHERE deleted_at IS NULL
  AND (
    SELECT COUNT(*) FROM wet_weight_entries w
    WHERE w.harvest_batch_id = harvest_plant_tags.harvest_batch_id AND w.deleted_at IS NULL
  ) = 1;

ALTER TABLE metrc_uploads ADD COLUMN file_wet_grams NUMERIC;
ALTER TABLE metrc_uploads ADD COLUMN file_plant_count INTEGER;
