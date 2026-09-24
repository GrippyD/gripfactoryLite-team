-- Tradogram-lite purchasing: suppliers, purchase orders, and lines.
-- Requisitions, deliveries, invoices, budgets, and approvals wait.

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  main_contact TEXT,
  phone TEXT,
  notes TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX suppliers_status ON suppliers (status, company_name);

CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT NOT NULL,
  name TEXT NOT NULL,
  po_class TEXT,
  project TEXT,
  supplier_id TEXT NOT NULL,
  status TEXT NOT NULL,
  issued_at TEXT,
  closed_at TEXT,
  eval_quality INTEGER,
  eval_documents INTEGER,
  eval_timing INTEGER,
  eval_notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX purchase_orders_status ON purchase_orders (status, created_at);
CREATE INDEX purchase_orders_number ON purchase_orders (po_number);

CREATE TABLE purchase_order_lines (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL,
  item_code TEXT,
  description TEXT NOT NULL,
  uom TEXT NOT NULL DEFAULT 'each',
  qty NUMERIC NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX purchase_order_lines_po ON purchase_order_lines (purchase_order_id, created_at);
