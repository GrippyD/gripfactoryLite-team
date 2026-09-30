-- THE IN-TRANSIT RULE (canon 0.30.320). field_closed_at marks an HBN
-- Finish Load YES has closed. received_at marks a field load the silo
-- scheduler has received. Null on every row already stored.

ALTER TABLE harvest_batches ADD COLUMN field_closed_at TEXT;
ALTER TABLE harvest_batches ADD COLUMN field_closed_by TEXT;

ALTER TABLE field_loads ADD COLUMN received_at TEXT;
ALTER TABLE field_loads ADD COLUMN received_by TEXT;
