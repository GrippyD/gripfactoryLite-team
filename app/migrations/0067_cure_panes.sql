-- 0067: THE CURE PANES (canon 0.30.164). Owner, 2026-09-21, verbatim
-- (his dashes rendered as hyphens): "Add to all drying screens AND THE
-- DASHBOARD, next to FFZ Inventory two new panes: CSA ... CSB ... Current
-- Conditions (read from Corey's app ... or we setup a sensor push
-- API-whatever's clever)". His pick: a push door we own.
--
-- sensor_readings is that door's log. room is a name from app_config
-- cure_rooms (CSA,CSB to start), so a sensor can be named for a room
-- without a deploy. Nothing here pulls from another app.
CREATE TABLE sensor_readings (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  temperature_f NUMERIC NOT NULL,
  humidity_pct NUMERIC NOT NULL,
  source TEXT,
  read_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  raw TEXT
);

CREATE INDEX sensor_readings_room_read_at ON sensor_readings (room, read_at);

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('cure_rooms', 'CSA,CSB', '2026-09-21T00:00:00.000Z', NULL, '2026-09-21T00:00:00.000Z', NULL, NULL, NULL);
