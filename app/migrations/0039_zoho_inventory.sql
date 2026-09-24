-- Mount Zoho Inventory (canon 0.30.36). Owner, 2026-09-09, asked for a place to
-- drop current Zoho inventory that updates the offerings on the marketplace.
-- Listings gain a source (manual, the hand-entered rows as before; zoho, the
-- mounted ones) and the Zoho columns: the SKU (usually the METRC package tag),
-- the market-facing UOM and quantity, the weight of one each when known, the
-- selling price as Zoho states it, the Zoho location, THC, Zoho's status and
-- the mount that last touched the row. qty_grams stays the actual weight in
-- grams (owner: "Lbs = 448 grams"); 0 when the weight is unknown (liters, an
-- each of unknown size). One row per mount records the drop, including the
-- placeholder rows skipped (a stock on hand of a billion or more is not stock).

ALTER TABLE listings ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE listings ADD COLUMN sku TEXT;
ALTER TABLE listings ADD COLUMN zoho_item_id TEXT;
ALTER TABLE listings ADD COLUMN market_uom TEXT;
ALTER TABLE listings ADD COLUMN market_qty NUMERIC;
ALTER TABLE listings ADD COLUMN each_grams NUMERIC;
ALTER TABLE listings ADD COLUMN price TEXT;
ALTER TABLE listings ADD COLUMN zoho_location TEXT;
ALTER TABLE listings ADD COLUMN thc_pct NUMERIC;
ALTER TABLE listings ADD COLUMN zoho_status TEXT;
ALTER TABLE listings ADD COLUMN zoho_mount_id TEXT;
ALTER TABLE listings ADD COLUMN zoho_mounted_at TEXT;

CREATE INDEX listings_source_sku ON listings (source, sku);

CREATE TABLE zoho_inventory_mounts (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  rows_total INTEGER NOT NULL,
  rows_offered INTEGER NOT NULL,
  rows_inactive INTEGER NOT NULL,
  rows_no_stock INTEGER NOT NULL,
  rows_placeholder INTEGER NOT NULL DEFAULT 0,
  listings_added INTEGER NOT NULL,
  listings_updated INTEGER NOT NULL,
  listings_unlisted INTEGER NOT NULL,
  by_category TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX zoho_inventory_mounts_created ON zoho_inventory_mounts (created_at);
