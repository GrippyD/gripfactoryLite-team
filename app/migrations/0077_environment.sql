-- THE ENVIRONMENT FLAGS (canon 0.30.246). A dry space's readings come from
-- SensorPush or from the sensor door. Humidity is optional: a freezer reports
-- a temperature and nothing else. Bindings and ranges are GripFactory Lite's
-- own. The access token lives in sensorpush_auth and is not a page, an export,
-- or a log.

CREATE TABLE sensor_readings__0077 (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  temperature_f NUMERIC NOT NULL,
  humidity_pct NUMERIC,
  source TEXT,
  read_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  raw TEXT,
  sensor_id TEXT,
  role TEXT
);

INSERT INTO sensor_readings__0077 (
  id, room, temperature_f, humidity_pct, source, read_at, received_at, raw
)
SELECT id, room, temperature_f, humidity_pct, source, read_at, received_at, raw
FROM sensor_readings;

DROP TABLE sensor_readings;
ALTER TABLE sensor_readings__0077 RENAME TO sensor_readings;

CREATE INDEX sensor_readings_room_read_at ON sensor_readings (room, read_at);
CREATE UNIQUE INDEX sensor_readings_sensor_observed ON sensor_readings (sensor_id, read_at) WHERE sensor_id IS NOT NULL;

CREATE TABLE sensor_catalog (
  sensor_id TEXT PRIMARY KEY,
  name TEXT,
  battery_voltage NUMERIC,
  seen_at TEXT NOT NULL
);

CREATE TABLE sensor_bindings (
  id TEXT PRIMARY KEY,
  sensor_id TEXT NOT NULL,
  space_name TEXT,
  role TEXT,
  bound_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE UNIQUE INDEX sensor_bindings_live ON sensor_bindings (sensor_id) WHERE deleted_at IS NULL;

CREATE TABLE environment_ranges (
  id TEXT PRIMARY KEY,
  space_name TEXT NOT NULL,
  role TEXT NOT NULL,
  temp_low NUMERIC,
  temp_high NUMERIC,
  humidity_low NUMERIC,
  humidity_high NUMERIC,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE UNIQUE INDEX environment_ranges_live ON environment_ranges (space_name, role) WHERE deleted_at IS NULL;

CREATE TABLE sensorpush_auth (
  id TEXT PRIMARY KEY,
  authorization TEXT,
  authorization_until TEXT,
  access_token TEXT,
  access_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE environment_pulls (
  id TEXT PRIMARY KEY,
  pulled_at TEXT NOT NULL,
  sample_count INTEGER NOT NULL,
  error TEXT
);

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('environment_stale_minutes', '60', '2026-09-27T00:00:00.000Z', NULL, '2026-09-27T00:00:00.000Z', NULL, NULL, NULL);
