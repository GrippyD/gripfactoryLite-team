-- 0096: MA1, THE METRC API READ INTEGRATION, Phase B (the client).
-- Law 5 (THE CADENCE AND CURSOR LAW): sweeps are resumable and bounded. One
-- cursor per host, license, endpoint and mode holds the lastModified
-- high-water mark, the window in progress and its next page, and the full
-- pass in progress (A26: a dry_run cursor never moves a write cursor). A full
-- pass keeps its seen tags as one row per page and deletes them when it
-- completes (A13). Law 4 and A22, A33: Test connection writes what one
-- GET /facilities/v2 reaches per license, and never EmployeeLicenseNumber,
-- FacilityId or a person field. Law 1: the mount row's source is stamped
-- (file or api), every existing mount reads file. The Law 5 budget values
-- are seeded as data (canon L-4) in the eight-column shape of 0088; the
-- sweep mode is off (Law 7). Nothing here stores a key.

CREATE TABLE metrc_cursors (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  license_value TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  mode TEXT NOT NULL,
  kind TEXT NOT NULL,
  phase TEXT,
  hwm_end TEXT,
  win_start TEXT,
  win_end TEXT,
  win_page INTEGER NOT NULL DEFAULT 0,
  full_pass_id TEXT,
  full_started_at TEXT,
  full_page INTEGER NOT NULL DEFAULT 0,
  full_total_pages INTEGER,
  full_total_records INTEGER,
  full_rows_seen INTEGER NOT NULL DEFAULT 0,
  full_completed_at TEXT,
  full_due_at TEXT,
  gone_override INTEGER NOT NULL DEFAULT 0,
  last_status TEXT,
  last_http INTEGER,
  last_run_at TEXT,
  failures INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

-- One live cursor per scope. A soft-deleted cursor (a reset) leaves the scope
-- free for a fresh one; the partial index is SQLite and Postgres alike.
CREATE UNIQUE INDEX metrc_cursors_scope ON metrc_cursors (host, license_value, endpoint, mode) WHERE deleted_at IS NULL;

CREATE TABLE metrc_pass_pages (
  pass_id TEXT NOT NULL,
  page INTEGER NOT NULL,
  tags_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (pass_id, page)
);

CREATE TABLE metrc_facilities (
  host TEXT NOT NULL,
  license_value TEXT NOT NULL,
  in_lookup INTEGER NOT NULL,
  reached INTEGER NOT NULL,
  can_grow_plants INTEGER,
  can_record_processing_jobs INTEGER,
  can_track_vegetative_plants INTEGER,
  license_type TEXT,
  checked_at TEXT NOT NULL,
  PRIMARY KEY (host, license_value)
);

ALTER TABLE metrc_mounts ADD COLUMN source TEXT NOT NULL DEFAULT 'file';

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('metrc_sweep_mode', 'off', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_page_size', '50', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_tick_calls', '60', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_tick_license_calls', '20', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_tick_wall_ms', '240000', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_tick_rows', '3000', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_month_calls', '45000', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_window_overlap_minutes', '5', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_window_max_minutes', '1440', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_full_packages_hours', '24', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_full_harvests_hours', '24', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_full_plants_hours', '168', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_harvest_finished_days', '30', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_sample_cap', '25', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_gone_hold_share', '0.5', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_log_keep_days', '90', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL),
  ('metrc_sweep_now_calls', '10', '2026-10-08T00:00:00.000Z', NULL, '2026-10-08T00:00:00.000Z', NULL, NULL, NULL);
