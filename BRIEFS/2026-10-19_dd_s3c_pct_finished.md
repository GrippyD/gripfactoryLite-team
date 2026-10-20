# DD S3c: % Complete (By Plant Count) replaces Shipments on the bizops wall

Filed by the Scribe on 2026-10-19 (canon 0.30.517) from the owner's word: "Shipments: bump and replace with Percent Finished (Plants)." His mock: Label "% Complete (By Plant Count)"; two drop downs, Grow Method and Harvest Year; "[A Single Percentage for the Grow Type/HY Combo]". Colors: our themes (his standing word).

His picks (2026-10-19):
- Source: the Harvest Console's % Complete law. Keep the planned tile `harvest.pct_complete` on the list, untouched.
- Grow method: "Can be derived from the Package Item Name (- G, - O, - I) or by looking at the HBN." The Scribe's reading: a lot's grow method is the HBN's grow segment, already stored as `harvest_batches.grow_method_code` (OD, GH, ID). A plant still standing has no HBN or item name, so its grow method comes from its mirror location: a location starting "GH" (GH 4 to GH 12 at PNS today) is greenhouse, anything else outdoor.
- "Bump" reads as: Shipments leaves the bizops wall and stays on the sales wall.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

RUN AFTER S3b. It builds on `src/ddsnapshot.ts`, its hourly refresh and its Recompute button. Pin: the S3b gated tree `14b04627b5cc68e6` (S3a and S3b, gated 2026-10-19). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0108`. LF only. Read big files by search and line range.

## 1. The registry (migration 0108 and src/directorregistry.ts together)
- `bizops.shipments_count`: wall_keys from "bizops,sales" to "sales". Nothing else changes on it.
- A new row `bizops.pct_finished_plants` in Shipments' old bizops place:
  - dept bizops, wall_keys bizops; title_en "% Complete (By Plant Count)", title_es "% Completo (por conteo de plantas)";
  - unit pct (the app's pct is 0 to 100, one decimal), cadence daily, dims "grow_method";
  - goal_kind none; source_kind app; status live; def_version 1; no open question;
  - compute_key: "All grow methods: consoleBoxes pct (src/console.ts, the Total box), the Admin plant total less the mirror's live plants over the Admin total, a farm with no total using its lots plus its live plants. One grow method: plants on own lots of the year with that grow_method_code (the console's season lots, status not weighing) over those plus the live mirror plants of that grow method (location starting GH is GH, else OD)".
- Guarded and idempotent (INSERT OR IGNORE for the new row, the UPDATE guarded on the old wall_keys).
- The registry test's counts and the code to rows equality move with it.

## 2. The stored series (dd_kpi_values)
Add `refreshPctFinished(db, nowIso)` to `src/ddsnapshot.ts`, on the same hourly cron and the same Recompute button.
- It writes today's farm day only, one row per dim: '' (All), and each grow method code in the grow_methods lookup that has plants this harvest year (today OD and GH). period_kind day; value the percent to one decimal; n the plants finished; value_text "finished of total" as two integers ("61177/100367") so the tile can print the counts; source app.
- The harvest year is the farm today's. Earlier days are never restated: the mirror only knows today, so yesterday's row is the record of yesterday. Same write law as S3a (supersede on change, batched).
- All must equal the console's Total % Complete box to the tenth (a test drives both on one fixture). ARL with its typed total and no live plants reads 100.
- The live plant count by grow method is one grouped query over metrc_plants (gone_at NULL) by license farm and the GH test on location; never per plant rows into the worker.

## 3. The tile
On the bizops wall, in Shipments' place:
- Head: "% Complete (By Plant Count)", the v1 badge.
- Two selects side by side: Grow Method (All, then each grow method with a row, by its lookup label: Outdoor, Greenhouse, Indoor) and Harvest Year (each year with a stored row, newest first; default the farm today's year). Client side, the picks remembered per browser in try/catch.
- The face: one large percentage for the pair picked, from that pair's latest stored row (today for this year, the last day stored for a past year). Under it, small: "61,177 of 100,367 plants" and, for a past year, "as of Oct 31, 2026".
- A pair with no row: "No data".
- Hover or tap on the number: the farm day the figure stands for and, for All, a note that it uses the Admin plant totals; for a single grow method, that it counts lots and the mirror's live plants.
- Theme tokens only; fits the wall at 1920, 820 and on the phone with no sideways scroll.

## Tests
- The series:
  - All equals the console's Total box;
  - a farm without a typed total falls back as the console does;
  - GH from a "GH 7" location and OD otherwise;
  - lots split by grow_method_code;
  - toll and test lots out;
  - one row per dim per day;
  - a second refresh writes nothing.
- The registry: Shipments is on sales only; the new row is on bizops.
- The tile:
  - the two selects;
  - the default pair is All and this year;
  - a past year reads its last day with "as of";
  - "No data" for an empty pair;
  - no dash characters in any output.

## Smoke and gates
Smoke: `About to apply 107 migration(s)` (S3b's read 106; this tree has no 0101). Seed a typed plant total, a few live plants with one GH location and two lots, press Recompute, check the wall shows the tile with a percentage and Shipments is gone from bizops but present on sales; keep every other check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (SMOKE PASS, no 500); renders of the bizops wall in Lite, CO and Cerberus at 1920 and 820 and the phone, each select used once; dash, CR and name scans of every touched file.

## Hand back
Report `SESSION_REPORTS/2026-10-19_dd_s3c_pct_finished.md`, short: the tree received and left, files touched, gate results, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges (it carries migration 0108, so the merge block takes a snapshot first).
