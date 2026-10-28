-- MT1: MORE TRUCKS COMING (canon 0.30.556). At Finish Load an HBN on the truck
-- is finished with More trucks coming (this truck's part finishes and its file
-- pends) or with Last truck (today's YES, which closes it). field_more_trucks_at
-- marks an HBN whose last truck has not come yet: it keeps the HBN on the field
-- select across farm days until Last truck or the Admin close clears it. Null on
-- every row already stored.

ALTER TABLE harvest_batches ADD COLUMN field_more_trucks_at TEXT;
ALTER TABLE harvest_batches ADD COLUMN field_more_trucks_by TEXT;
