-- LB1: write_id is the write's own key for the log guard.
-- Null on every row that already exists.

ALTER TABLE lab_internal_tests ADD COLUMN write_id TEXT;
ALTER TABLE lab_compliance_samples ADD COLUMN write_id TEXT;
ALTER TABLE lab_op_results ADD COLUMN write_id TEXT;
