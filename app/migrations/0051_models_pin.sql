-- 0051: THE MODELS BUTTON (canon 0.30.86). Owner, 2026-09-15, verbatim: "New
-- button in Admin: [Models] - pin gated: 17853". The Models PIN is a value in
-- data (canon L-4) like admin_pin, editable in Admin, Lookups, app_config; its
-- gate and cookie are separate from Admin's.
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('models_pin', '17853', '2026-09-15T00:00:00.000Z', NULL, '2026-09-15T00:00:00.000Z', NULL, NULL, NULL);
