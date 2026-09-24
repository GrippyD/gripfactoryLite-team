-- Marketplace listings and simple sales orders. Fulfilling an order does not
-- reduce inventory this slice; that wait is the owner's walk.

CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  package_tag TEXT,
  qty_grams NUMERIC NOT NULL,
  listed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX listings_tag ON listings (package_tag, listed);

CREATE TABLE sales_orders (
  id TEXT PRIMARY KEY,
  so_number TEXT NOT NULL,
  buyer TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX sales_orders_status ON sales_orders (status, created_at);
CREATE INDEX sales_orders_number ON sales_orders (so_number);

CREATE TABLE sales_order_lines (
  id TEXT PRIMARY KEY,
  sales_order_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  qty_grams NUMERIC NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX sales_order_lines_so ON sales_order_lines (sales_order_id, created_at);
