-- 0088: BRIEF V18, THE CURE CAPS (canon 0.30.341).
-- Owner, 2026-10-02: "New Admin lookup: CSA Lot Cap and CSB Lot Cap";
-- "Default caps are CSA: 36, and CSB: 8".
-- Values in data (canon L-4), the eight-column shape of 0086.
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('csa_lot_cap', '36', '2026-10-02T00:00:00.000Z', NULL, '2026-10-02T00:00:00.000Z', NULL, NULL, NULL),
  ('csb_lot_cap', '8', '2026-10-02T00:00:00.000Z', NULL, '2026-10-02T00:00:00.000Z', NULL, NULL, NULL);
