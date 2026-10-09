-- 0098: MA1, THE METRC API READ INTEGRATION, Phase E1 (the evaluation runner,
-- Law 8), carrying the Phase C log tables as well so Phase C needs no
-- migration edit (0097 is reserved for the harvests table of Law 6).
-- Law 1 (ONE DOOR, TWO PATHS): one log row per sweep per license per endpoint
-- (metrc_sweep_runs), never per row. Law 7 (DRY RUN BEFORE WRITE): the
-- would-add, would-update and would-gone counts, the gone hold (A29), and up
-- to metrc_sample_cap sample differences per run (metrc_sweep_samples: tag,
-- column, mirror value, API value). Law 5: the call log gains the host each
-- call was made on, so the month pace can count one host. Law 8 (THE
-- EVALUATION RUNNER): one row per evaluation run holds the pack as scrubbed
-- JSON (Law 4: no key, no Authorization header, no EmployeeLicenseNumber, no
-- FacilityId), capped under D1's 2,000,000 byte row limit. The two E1 budgets
-- are seeded as data (canon L-4) in the eight-column shape of 0088.
-- Postgres-portable SQL; nothing here stores a key.

CREATE TABLE metrc_sweep_runs (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  license_value TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  kind TEXT NOT NULL,
  phase TEXT,
  mode TEXT NOT NULL,
  run_kind TEXT NOT NULL,
  trigger TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  win_start TEXT,
  win_end TEXT,
  pages INTEGER,
  rows INTEGER,
  total_records INTEGER,
  calls INTEGER,
  failures INTEGER,
  would_add INTEGER,
  would_update INTEGER,
  would_gone INTEGER,
  gone_held INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX metrc_sweep_runs_host_started ON metrc_sweep_runs (host, started_at);
CREATE INDEX metrc_sweep_runs_scope_started ON metrc_sweep_runs (license_value, endpoint, started_at);

CREATE TABLE metrc_sweep_samples (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  column_name TEXT NOT NULL,
  mirror_value TEXT,
  api_value TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX metrc_sweep_samples_run ON metrc_sweep_samples (run_id);

ALTER TABLE metrc_api_calls ADD COLUMN host TEXT;

CREATE TABLE metrc_eval_runs (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  phase TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  steps_json TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX metrc_eval_runs_started ON metrc_eval_runs (started_at);

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('metrc_eval_max_calls', '150', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_eval_window_days', '30', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL);
