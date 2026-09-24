-- 0038: mounted sales orders and pick orders (owner order 2026-09-08, canon
-- 0.30.18, verbatim: "Look in the original gripfactory repo for how pic prders
-- and Mount SOs should behave" ... "here is the iteration that should contain
-- it"). The behavior is gripfactorish's (Code\gripfactorish, v0.3.5): the Zoho
-- Sales Order export drops in, every line buckets into a readout category by
-- Item.CF.Product Sub, the order's status is Zoho's CF.Status (Internal) in the
-- lifecycle submitted / approved / picking / fulfilled / shipped. gripfactorish
-- was stateless; these tables make the mount durable and add the write side
-- (the pick) it never had. Postgres-portable; no dialect date math.

CREATE TABLE so_mounts (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  ignored_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

-- One row per Zoho sales order, keyed by Zoho's own SalesOrder Number (the
-- SH- number from SalesHelper dies at Zoho import; Zoho's number is the key).
-- zoho_status = Zoho "Status" (confirmed, invoiced); internal_status = Zoho
-- "CF.Status (Internal)" lowercased (submitted, approved, picking, fulfilled,
-- shipped); pick_status is OURS (NULL, picking, fulfilled) and never overwrites
-- Zoho's column.
CREATE TABLE mounted_sales_orders (
  id TEXT PRIMARY KEY,
  so_number TEXT NOT NULL,
  zoho_so_id TEXT,
  customer_name TEXT,
  customer_id TEXT,
  order_date TEXT,
  expected_ship TEXT,
  zoho_status TEXT,
  internal_status TEXT,
  sales_person TEXT,
  customer_license TEXT,
  destination_license TEXT,
  origin_license TEXT,
  delivery_method TEXT,
  location_name TEXT,
  pick_status TEXT,
  picked_by TEXT,
  picked_at TEXT,
  fulfilled_by TEXT,
  fulfilled_at TEXT,
  pick_notes TEXT,
  first_mount_id TEXT,
  last_mount_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);
CREATE UNIQUE INDEX mounted_sales_orders_number ON mounted_sales_orders (so_number);
CREATE INDEX mounted_sales_orders_status ON mounted_sales_orders (internal_status, pick_status, expected_ship);

-- One row per export line, keyed within its order by seq (the export carries no
-- line id). readout_category is the gripfactorish bucket; location_code is the
-- Zoho rack address (Item.CF.Location Code) the pick walks by; picked_qty and
-- short_flag are the pick's marks and survive a re-mount.
CREATE TABLE mounted_sales_order_lines (
  id TEXT PRIMARY KEY,
  sales_order_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  item_name TEXT,
  sku TEXT,
  product_sub TEXT,
  readout_category TEXT,
  quantity_ordered NUMERIC NOT NULL DEFAULT 0,
  quantity_invoiced NUMERIC NOT NULL DEFAULT 0,
  quantity_packed NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  item_price NUMERIC,
  location_code TEXT,
  line_location_name TEXT,
  picked_qty NUMERIC,
  short_flag INTEGER NOT NULL DEFAULT 0,
  pick_note TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);
CREATE UNIQUE INDEX mounted_sales_order_lines_seq ON mounted_sales_order_lines (sales_order_id, seq);
CREATE INDEX mounted_sales_order_lines_order ON mounted_sales_order_lines (sales_order_id, location_code);
