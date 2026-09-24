-- 0064: THE FARM DAY BEGINS AT SIX (canon 0.30.151). Owner ruling 2026-09-20,
-- verbatim: "Second shift ends the next day, how can I have the report date
-- treat the start of the shift a the date?"; his pick (AskUserQuestion,
-- 2026-09-20): "6:00 AM".
--
-- The farm's day no longer rolls at midnight. It begins at this Eastern hour,
-- and an instant before it belongs to the day before, so a second-shift entry
-- at 1:30 AM dates to the shift's own day. Every reader of "today" follows it:
-- the Effective Date default on every transactional form (and the trim and wet
-- weight dates through it), the Harvest Console's day and yesterday and the
-- windows they draw. A value in data (canon L-4), editable in Admin, Lookups,
-- app_config: a whole number 0 to 23; 0 is the old midnight law.
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('farm_day_start_hour', '6', '2026-09-20T00:00:00.000Z', NULL, '2026-09-20T00:00:00.000Z', NULL, NULL, NULL);
