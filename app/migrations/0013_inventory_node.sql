-- Inventory node + Acquire HBN recall (builder prompt 2026-09-01).
-- Owner: projected dry yield is a value in data (canon L-4). Seed 22 is the
-- Scribe's placeholder and needs the owner's ratification.
-- Release already persists test_outcome on wip_packages (0001 schema column,
-- written by runQueueControl). This file adds no outcome column and no labs
-- lookup; lab capture is owner-gated and must not change the release station.
INSERT INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('projected_dry_yield_pct', '22', '2026-09-01T00:00:00.000Z', NULL, '2026-09-01T00:00:00.000Z', NULL, NULL, NULL);
