-- Owner ruling 2026-08-31: [Unload Dry Space]. Left pane: the Dry Space Queue;
-- the right pane works like wet weights, but these are dry weights, and the
-- number of dry rows is independent of the wet rows. dry_weights mirrors
-- wet_weights (0006): the append-only ledger of one lot's dry weighings.
-- Finishing an unload moves the lot out of the Dry Space Queue into the new
-- Unloaded Queue (status unloaded), and Trim Packages picks from that queue.
-- The lot's dry_weight_grams stays the live total of the non-voided dry rows;
-- the wet total in weight_grams is untouched.
CREATE TABLE dry_weights (
  id TEXT PRIMARY KEY,
  wet_weight_entry_id TEXT NOT NULL,
  weight_grams NUMERIC NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX dry_weights_entry ON dry_weights (wet_weight_entry_id);
CREATE INDEX dry_weights_created_at ON dry_weights (created_at);

-- Nullable: NULL until an unload begins, then the live total of the lot's
-- non-voided dry_weights rows, recomputed alongside every add, edit, and void.
ALTER TABLE wet_weight_entries ADD COLUMN dry_weight_grams NUMERIC;
