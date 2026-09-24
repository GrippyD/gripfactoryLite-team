-- 0069: THE TESTING DESK, part 3 (canon 0.30.164). The read-only Metrc
-- mirror. One row per HTTP call so the month's budget is visible. One row
-- per sweep so a run that makes no call (keys absent) still has a last
-- sweep. The mirror columns on test_orders and test_samples already exist
-- from 0068. Nothing here stores a key.

CREATE TABLE metrc_api_calls (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  path TEXT NOT NULL,
  status INTEGER NOT NULL,
  ms INTEGER NOT NULL
);

CREATE INDEX metrc_api_calls_started_at ON metrc_api_calls (started_at);

CREATE TABLE metrc_sweeps (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  trigger TEXT NOT NULL,
  message TEXT,
  packages_seen INTEGER,
  results_read INTEGER,
  fields_written INTEGER
);

CREATE INDEX metrc_sweeps_started_at ON metrc_sweeps (started_at);
