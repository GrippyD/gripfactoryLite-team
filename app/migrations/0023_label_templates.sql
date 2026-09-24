-- In-repo label maker: templates plus stock and printer lookups.
-- Printers are browser-printed devices on standard hardware; the owner
-- registers names in Admin. No driver integration lives in the Worker.

CREATE TABLE label_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  width_mm NUMERIC NOT NULL,
  height_mm NUMERIC NOT NULL,
  fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX label_templates_name ON label_templates (name, created_at);

INSERT INTO lookup_values (
  id, category, value, label, sort_order,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
) VALUES
  ('a2000023-0001-4000-8000-000000000001', 'label_stock', '4x6', '4 x 6 in', 1, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000023-0001-4000-8000-000000000002', 'label_stock', '2x1', '2 x 1 in', 2, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL);
