-- FB1 (canon 0.30.564). A Prepack cell may name its bag size in grams.
-- Nullable, no default, so a row typed before this column keeps bag_grams empty.
-- Nothing else moves: no index change, no seed, no rewrite of a standing row.

ALTER TABLE fulfillment_overrides ADD COLUMN bag_grams NUMERIC;
