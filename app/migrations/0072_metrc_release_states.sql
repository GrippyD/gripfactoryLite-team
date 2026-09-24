-- 0072: THE MIRROR RELEASES THE QUEUE (canon 0.30.193). The lab states
-- that release a Testing Queue package are a value in data. A state
-- that is not listed leaves the package in the queue.

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  (
    'metrc_release_states',
    'TestPassed=passed;RetestPassed=passed;TestFailed=failed;RetestFailed=failed',
    '2026-09-22T00:00:00.000Z', NULL, '2026-09-22T00:00:00.000Z', NULL, NULL, NULL
  );
