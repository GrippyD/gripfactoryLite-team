-- Owner names, verbatim: planned_dryspc is the HBN station's silo slot;
-- actual_dryspc is the wet lot's destination dry space. Existing
-- record_change_log rows keep the old field names; new writes log the new names.

ALTER TABLE harvest_batches RENAME COLUMN silo_number TO planned_dryspc;
ALTER TABLE wet_weight_entries RENAME COLUMN dry_space_id TO actual_dryspc;
