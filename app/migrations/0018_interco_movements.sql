-- Interco Logistics outbound and inbound: a movement, its items, and receipts.
-- movement_kind is interco or virtual. Virtual moves complete immediately.
-- Header fields follow the T3+ Tools Licensed Transfers upload (canon 0.17.1).

CREATE TABLE interco_movements (
  id TEXT PRIMARY KEY,
  movement_kind TEXT NOT NULL,
  origin_farm TEXT,
  destination_farm TEXT,
  origin_license TEXT NOT NULL,
  destination_license TEXT NOT NULL,
  truck_number TEXT,
  driver TEXT,
  planned_route TEXT,
  transfer_type TEXT,
  invoice_number TEXT,
  payment_term_days TEXT,
  planned_departure TEXT,
  planned_arrival TEXT,
  gross_weight TEXT,
  gross_weight_uom TEXT,
  transporter_license TEXT,
  transporter_phone TEXT,
  driver_occupational_license TEXT,
  driver_license_number TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_plate TEXT,
  status TEXT NOT NULL,
  exported_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX interco_movements_status ON interco_movements (status, created_at);
CREATE INDEX interco_movements_kind ON interco_movements (movement_kind, created_at);

CREATE TABLE interco_movement_items (
  id TEXT PRIMARY KEY,
  movement_id TEXT NOT NULL,
  local_inventory_item_id TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  uom TEXT NOT NULL,
  received_at TEXT,
  received_by TEXT,
  receipt_id TEXT,
  rejected_at TEXT,
  rejected_by TEXT,
  reject_reason TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX interco_movement_items_movement ON interco_movement_items (movement_id);
CREATE INDEX interco_movement_items_item ON interco_movement_items (local_inventory_item_id);

CREATE TABLE interco_receipts (
  id TEXT PRIMARY KEY,
  movement_id TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX interco_receipts_movement ON interco_receipts (movement_id, created_at);
