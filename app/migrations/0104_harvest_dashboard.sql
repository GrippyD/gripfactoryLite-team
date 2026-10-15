-- AD1: Harvest Dashboard settings (canon 0.30.490).
-- Caps, truck size, THC band edges, prefixes that are not finished goods,
-- folded prefixes, and the ounce each. INSERT OR IGNORE keeps a later value.
-- Code falls back to these same values when a row is missing or unreadable.

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('fg_cap_tri_lb', '40000', '2026-10-15T00:00:00.000Z', NULL, '2026-10-15T00:00:00.000Z', NULL, NULL, NULL),
  ('fg_cap_sha_lb', '5000', '2026-10-15T00:00:00.000Z', NULL, '2026-10-15T00:00:00.000Z', NULL, NULL, NULL),
  ('fg_cap_distillate_l', '2000', '2026-10-15T00:00:00.000Z', NULL, '2026-10-15T00:00:00.000Z', NULL, NULL, NULL),
  ('fg_cap_isolate_g', '68000', '2026-10-15T00:00:00.000Z', NULL, '2026-10-15T00:00:00.000Z', NULL, NULL, NULL),
  ('fg_cap_infused_g', '20000', '2026-10-15T00:00:00.000Z', NULL, '2026-10-15T00:00:00.000Z', NULL, NULL, NULL),
  ('fg_truck_lb', '8000', '2026-10-15T00:00:00.000Z', NULL, '2026-10-15T00:00:00.000Z', NULL, NULL, NULL),
  ('fg_bud_thc_bands', '20,25,30', '2026-10-15T00:00:00.000Z', NULL, '2026-10-15T00:00:00.000Z', NULL, NULL, NULL),
  ('fg_not_finished', 'WBP,WIP,WPR,BIOMASS,FFZ', '2026-10-15T00:00:00.000Z', NULL, '2026-10-15T00:00:00.000Z', NULL, NULL, NULL),
  ('fg_metrc_not_finished', 'WBP,WIP,WPR,FFZ', '2026-10-15T00:00:00.000Z', NULL, '2026-10-15T00:00:00.000Z', NULL, NULL, NULL),
  ('fg_folded_prefixes', 'MIX=BUD,NUG=BUD,MOB=PRE:70', '2026-10-15T00:00:00.000Z', NULL, '2026-10-15T00:00:00.000Z', NULL, NULL, NULL),
  ('fg_pre_each_grams', '28', '2026-10-15T00:00:00.000Z', NULL, '2026-10-15T00:00:00.000Z', NULL, NULL, NULL);
