-- SM1: THE WHOLE EXPORT MOUNT. The Mount SOs page sends Zoho's whole Sales
-- Order export in rounds of whole orders. A mount knows how many rounds it has
-- and how many landed; THE GONE RULE runs once the last one lands, and its
-- result stays on the mount row. Null round columns mean a mount made in one
-- request before SM1, which is whole.

ALTER TABLE so_mounts ADD COLUMN rounds_total INTEGER;
ALTER TABLE so_mounts ADD COLUMN rounds_done INTEGER;
ALTER TABLE so_mounts ADD COLUMN completed_at TEXT;
ALTER TABLE so_mounts ADD COLUMN gone_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE so_mounts ADD COLUMN gone_held INTEGER NOT NULL DEFAULT 0;
