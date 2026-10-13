# FE1: Field estimates lookup (effective dated)

Worktree: C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI
Stop if you are not under that path. Pin: live tree 352ccfe1408a1888 (canon hash command). No git, no deploy, no credential anywhere, no em or en dashes.

## What he asked
An Admin lookup that incorporates dates. An older date's data stands until it is replaced. The form defaults to today's date. Two columns: [estimated dry weight], [reason] (Memo).

## Settled by him (2026-10-12)
Unit: dry pounds at the app pound (448 g, GRAMS_PER_LB), hand entered. Key: strain AND farm.

## Design
1. Migration 0102_field_estimates.sql: table field_estimates (id TEXT PK, strain_id TEXT NOT NULL, farm_code TEXT NOT NULL REFERENCES farms(code), effective_date TEXT NOT NULL, est_dry_weight REAL NOT NULL, reason TEXT, created_by TEXT, created_at TEXT, deleted_at TEXT). Unique on (strain_id, farm_code, effective_date) among live rows. Index (strain_id, farm_code, effective_date). Key is strain plus farm.
2. Resolution rule: for a strain, a farm and a date D, the estimate is the live row with the greatest effective_date on or before D. A newer row replaces the older one only from its own date forward; earlier dates keep reading the older row. Nothing is overwritten by a newer date. Editing the same date replaces that row (logged).
3. Admin page under Admin Settings, next to /admin/lookups: /admin/field_estimates. Form fields: strain (picker from strains), farm (picker from live farms), effective date (defaults to the farm's today via farmToday), estimated dry weight, reason (memo, textarea). List shows each strain and farm pair's rows newest first with the one currently in force marked. Soft delete only, with a change log row. Use the existing admin guard, i18n (English and Spanish) and html helpers.
4. Unit: dry pounds at the app pound (448 g, GRAMS_PER_LB), hand entered as a plain positive number. Label the field "dry lb (448 g)" in both languages. No conversion on save.
5. Exposed helper in a new src/fieldestimates.ts: estimateFor(db, strainId, farmCode, date) and estimatesAsOf(db, date) returning one row per strain and farm pair in force. FC1 reads estimatesAsOf and shows the estimate beside the forecast; no FC1 change is required to ship FE1.
6. Validation: positive number, date not blank, reason optional but kept; strain and farm must exist and be live.

## Tests
Resolution (older stands until replaced, same date edit, delete falls back to the older row), form defaults to today, validation, i18n parity, route guard, report count unchanged. Vitest TZ=UTC and TZ=America/New_York. Update scripts/smoke.mjs to load the page and post one row.

## Bench gates (mine)
Live data copy, page and list under 1 s, EXPLAIN QUERY PLAN shows SEARCH on the index.

## Hand back
Tree hash, changed files, test counts.
