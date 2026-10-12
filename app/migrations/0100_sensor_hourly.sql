-- SENSOR RETENTION (BRIEF SR1). One row per unit per hour, kept.
-- sensor_key and source_key store COALESCE(sensor_id, '') and COALESCE(source, '')
-- so the unique key is a plain index (D1 does not take expression indexes reliably).
-- Test rows (source 'test') are never rolled. The watermark is the last UTC hour
-- fully rolled. Retention is days of raw readings, 90 until Admin changes it.

CREATE TABLE sensor_hourly (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  sensor_id TEXT,
  role TEXT,
  source TEXT,
  sensor_key TEXT NOT NULL,
  source_key TEXT NOT NULL,
  hour_start TEXT NOT NULL,
  readings INTEGER NOT NULL,
  temp_min NUMERIC NOT NULL,
  temp_max NUMERIC NOT NULL,
  temp_avg NUMERIC NOT NULL,
  hum_min NUMERIC,
  hum_max NUMERIC,
  hum_avg NUMERIC,
  first_read_at TEXT NOT NULL,
  last_read_at TEXT NOT NULL,
  rolled_at TEXT NOT NULL
);

CREATE UNIQUE INDEX sensor_hourly_unit_hour ON sensor_hourly (room, sensor_key, source_key, hour_start);
CREATE INDEX sensor_hourly_room_hour ON sensor_hourly (room, hour_start);

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('sensor_retention_days', '90', '2026-10-12T00:00:00.000Z', NULL, '2026-10-12T00:00:00.000Z', NULL, NULL, NULL),
  ('sensor_rollup_through', '', '2026-10-12T00:00:00.000Z', NULL, '2026-10-12T00:00:00.000Z', NULL, NULL, NULL);
