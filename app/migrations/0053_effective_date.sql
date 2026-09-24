-- 0053: THE EFFECTIVE DATE PER STATION (canon 0.30.94). Owner ruling
-- 2026-09-16, verbatim: "Each station should have its own effective date field.
-- It's always the source data for the transaction date.  It defaults to
-- (today).  It can be changed with a PIN". His picks (AskUserQuestion,
-- 2026-09-16): where a station already has a date field it becomes the
-- Effective Date (Trim's trim_date, Cryo's cryo_date), and Acquire HBN's
-- harvest date stays free.
--
-- Trim, Cryo and Load Silo already store their station's business date
-- (wip_packages.trim_date, wip_packages.cryo_date, silo_loads.loaded_at). The
-- two stations that lacked one gain a business transaction date here; the audit
-- created_at stays the honest instant. Postgres-portable, append-only.
ALTER TABLE wet_weight_entries ADD COLUMN effective_date TEXT;
ALTER TABLE unload_sessions ADD COLUMN effective_date TEXT;
