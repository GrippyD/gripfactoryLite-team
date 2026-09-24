-- 0050: THE FFZ CUBE READS THE MIRROR (canon 0.30.75). Owner, 2026-09-15,
-- verbatim: "check FFZ, we have inventory but the FFZ cube is empty". His FG
-- Inventory in METRC pane read FFZ 129,259.00 g (the mirror's packages whose
-- Item name begins FFZ) while the cube read only the local ledger. The METRC
-- item kinds that are fresh frozen, a comma list in data (canon L-4), editable
-- in Admin, Lookups, app_config; FFZ by default.
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('ffz_item_kinds', 'FFZ', '2026-09-15T00:00:00.000Z', NULL, '2026-09-15T00:00:00.000Z', NULL, NULL, NULL);
