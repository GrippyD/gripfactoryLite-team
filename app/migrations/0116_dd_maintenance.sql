-- DD L4: projects, equipment for sale, and the assets for sale count.
-- Nothing seeded. The frozen equipment rows keep their values; the new
-- columns start blank. Guarded: a second apply of the table and the KPI
-- update changes nothing. The column adds follow the repo's ALTER TABLE
-- shape, which wrangler runs once.

CREATE TABLE IF NOT EXISTS dd_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  farm_code TEXT,
  status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'paused', 'done')),
  started_on TEXT NOT NULL,
  expected_on TEXT NOT NULL,
  cost_to_date_usd NUMERIC,
  budget_usd NUMERIC,
  note TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX IF NOT EXISTS dd_projects_status ON dd_projects (status);

ALTER TABLE equipment_assets ADD COLUMN sale_status TEXT CHECK (sale_status IS NULL OR sale_status IN ('listed', 'under_offer', 'sold'));
ALTER TABLE equipment_assets ADD COLUMN sale_condition TEXT;
ALTER TABLE equipment_assets ADD COLUMN asking_price_usd NUMERIC;
ALTER TABLE equipment_assets ADD COLUMN sale_note TEXT;

UPDATE dd_kpis
SET compute_key = 'count of live equipment_assets whose sale_status is listed or under_offer. Sold and blank stay out of the count',
    status = 'live',
    def_version = 2,
    updated_at = '2026-10-23T00:00:00.000Z'
WHERE kpi_key = 'farmops.assets_for_sale_count'
  AND NOT (
    compute_key = 'count of live equipment_assets whose sale_status is listed or under_offer. Sold and blank stay out of the count'
    AND status = 'live'
    AND def_version = 2
  );
