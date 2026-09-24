-- THE MANIFEST BUILDER (canon 0.30.125). Owner, 2026-09-18, verbatim in the
-- canon row: "New interco logistics layout: Three equal panes ... Origin
-- License: selecting a license exposes the METRC packages ordered numerically
-- based on the last six digits ... Right Pane: Header: all the herbs and
-- spices needed for a METRC manifest (use our library of templates--I believe
-- this one is T3 based) ... [finish] button [cancel] button". His picks:
-- finish downloads the T3 file at once and records the move; the receive-into
-- list is the mirror's; a package on a finished manifest reads dim with no >>;
-- a wholesale price box per added package.
--
-- The packages on the new surface come from the METRC mirror by tag, not from
-- the local ledger, so a movement item learns to carry the tag itself (and the
-- price typed beside it). local_inventory_item_id stays NOT NULL from 0018; a
-- mirror-born item writes it empty, since no ledger item stands behind a
-- METRC-only package. Nothing existing changes.

ALTER TABLE interco_movement_items ADD COLUMN metrc_tag TEXT;
ALTER TABLE interco_movement_items ADD COLUMN wholesale_price TEXT;

CREATE INDEX interco_movement_items_tag ON interco_movement_items (metrc_tag);
