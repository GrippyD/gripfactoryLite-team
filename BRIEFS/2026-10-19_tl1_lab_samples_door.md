# TL1: the lab samples door (TagLeaf rows into the app)

Filed by the Scribe on 2026-10-19 (canon 0.30.523). The owner, on S3g's TagLeaf pull: "API access to Tagleaf is limited. I could do a bot that looked every day." His pick: a script on his PC, under Windows Task Scheduler, reads what TagLeaf allows and posts the rows to the app daily. This slice builds the app's side, the door, so the script (TL2, written once the Scribe knows what TagLeaf gives his login) and a hand upload both land the same rows.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

RUN AFTER S3f. Pin: the S3f gated tree `0a7d248251529ea9` (S3a to S3f, gated 2026-10-20). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0112`. LF only. Read big files by search and line range (`src/index.ts`, `src/feeds.ts`, `src/xlsx.ts`).

## 1. The table (migration 0112)
`lab_samples`, one row per lab sample, keyed by the lab code:
- lab_code TEXT PRIMARY KEY (RAS-260921-031), lab_name, intake_date (YYYY-MM-DD), product_code, product, strain, farm, metrc_tag, test_type (First-time, Retest, Internal QA), status (Completed, In Process), result (Pass, Fail, blank), failure_mode, coliforms_cfu, yeast_mold_cfu, other_failed_analyte, total_thc_pct, coa_posted_at (ISO, from the export's Eastern time), tat_days, batch_qty_g, source (upload or feed), first_seen_at, changed_at, received_at.
- Indexes on intake_date and on coa_posted_at.
- Nothing seeded. Guarded and idempotent.

## 2. Two ways in, one law
- THE UPLOAD: Admin, Lab Samples (behind the Admin PIN): upload the TagLeaf export workbook. Read its Samples sheet by header names (not positions), the 30 columns his file carries; the other tabs are ignored. Use `readXlsxSheets`.
- THE FEED: `POST /feeds/lab-samples.json`, a JSON body `{ "rows": [ ... ] }` with the same fields by the same header names, at most 2,000 rows a post. It sits under /feeds/ like the trim weighs feed, so Cloudflare Access fronts it: the owner adds a service token (tagleaf-pusher) on the application by his hands, and the script sends its id and secret as Access headers. The worker holds no new secret. Never print, log or store a token.
- THE LAW for both: upsert by lab_code. A row whose fields are unchanged writes nothing; a changed row updates its fields and changed_at and logs the changed fields to record_change_log with reason "lab samples feed" or "lab samples upload". A sample never seen before inserts. Rows absent from a later file are left alone (TagLeaf files are windows, not the whole history). A row without a lab code or with an unreadable intake date is refused in the answer, the others still land.
- The answer (page banner for the upload, JSON for the feed): received, inserted, updated, unchanged, refused with reasons (first 20).
- The last load's instant, source and counts are kept (one app_config key, `lab_samples_last_load`) so S3g can say when TagLeaf was last pulled.

## 3. Admin, Lab Samples
A small page: the upload form, the last load line, and counts (samples, completed, in process, newest intake, newest COA). No editing of rows here.

## Tests
- His export's Samples sheet shape (five rows built from it) uploads: 5 inserted; the same file again: 0 written; one changed status: 1 updated with its change log.
- The feed takes the same rows as JSON with the same results; over 2,000 rows refuses; a row without a lab code is refused and the rest land.
- Eastern COA times become the right ISO instants across the DST change (Nov 1).
- The last load key reads the newest load.
- No dash characters in any output.

## Smoke and gates
Smoke: `About to apply 111 migration(s)` (S3f's read 110). Upload a three row workbook, check the counts, post the same rows to the feed, check 0 written; keep every other check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (SMOKE PASS, no 500); renders of Admin, Lab Samples in Lite, CO and Cerberus at 1920, 820 and the phone; dash, CR and name scans of every touched file. With his export (the Scribe stages it on the bench): 1,096 samples, 814 completed, 282 in process.

## Hand back
Report `SESSION_REPORTS/2026-10-19_tl1_lab_samples_door.md`, short: the tree received and left, files touched, gate results, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges with the rest (it carries migration 0112, and he adds the tagleaf-pusher service token on Cloudflare Access by his hands before the script runs).
