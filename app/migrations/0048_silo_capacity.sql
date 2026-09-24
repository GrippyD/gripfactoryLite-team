-- 0048: THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69). Owner ruling
-- 2026-09-14, verbatim: "Each silo holds 15k lbs wet for scaling." The
-- capacity every silo wireframe's fill scales against, in pounds wet, a value
-- in data (canon L-4). Editable in Admin, Lookups, app_config.
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('silo_capacity_wet_lbs', '15000', '2026-09-14T00:00:00.000Z', NULL, '2026-09-14T00:00:00.000Z', NULL, NULL, NULL);
