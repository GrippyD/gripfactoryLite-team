-- 0094: L3 QUICK PRINT (canon 0.30.386).
-- One row per print run. unknown_ids_json is the package IDs the app
-- did not know. A reprint refills the form; it does not copy the row.

CREATE TABLE label_print_runs (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  first_id TEXT NOT NULL,
  roll INTEGER NOT NULL,
  container_qty INTEGER NOT NULL,
  labels_per_container INTEGER NOT NULL,
  actor_person_id TEXT,
  printed_at TEXT NOT NULL,
  unknown_ids_json TEXT NOT NULL
);

CREATE INDEX label_print_runs_printed ON label_print_runs (printed_at);
