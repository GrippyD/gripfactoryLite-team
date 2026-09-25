-- THE TRUCK RECORD (canon 0.30.226). A tote may name its own HBN. Null reads
-- as the lot's HBN, so every tote already stored keeps its HBN with no backfill.
ALTER TABLE wet_weights ADD COLUMN harvest_batch_id TEXT;

CREATE INDEX wet_weights_harvest_batch ON wet_weights (harvest_batch_id);
