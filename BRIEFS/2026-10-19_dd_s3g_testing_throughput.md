# DD S3g: Testing Throughput on the Business Operations wall, beside BTR

Filed by the Scribe on 2026-10-19 (canon 0.30.522); re-filed 2026-10-23 (canon 0.30.538) for THE QUEUE. The owner's word (2026-10-19): "In BTR: yesterday, weighted average to date, projected's place: Testing Throughput". His mock: Label Testing Throughput; three boxes, [AVG Tests/Day], [AVG COAs/Day], [AVG TAT]. Colors: our themes. Since then, Logan's list kept BTR on the Business Operations wall (L1), and the owner's pick of 2026-10-23 is "Both on your wall": Testing Throughput is added beside BTR and nothing retires.

THE SOURCE (the Scribe named it; his pick): the app's lab_compliance_samples (the InTesting workbook sync) is stale. His TagLeaf export (Grip_Testing_Data_2026-09-14_to_2026-10-19, TagLeaf LIMS, Alchemy North Reassure) holds 1,096 Reassure samples, intake 2026-09-21 to 10-19: about 52 tests per intake day, 48 COAs per COA day, average TAT 5.24 days (first-time 5.69, retest 4.38, internal QA 5.06). TL1 (live) is the door: the `lab_samples` table, filled by Admin, Lab Samples and by `POST /feeds/lab-samples.json`, which the TagLeaf pull on his PC (TL2, `tools/tagleaf-pull`) posts to daily. His pick on counting: working days, harvest to date, with a period select: Tests/Day = samples the lab took in over the days it took any in; COAs/Day = COAs posted over the days any posted; TAT = the average days from intake to COA.

Part of THE QUEUE (`BRIEFS/2026-10-23_queue_wl1_wl2_s3g.md`): read it first; its runner law and stop rules apply here. THIRD IN THE QUEUE. Pin: the tree WL2 left, as WL2's report states. Verify with canon's hash command in `app/` and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0118`. LF only. Read big files by search and line range (`src/director.ts`, `src/directorregistry.ts`, `src/labsamples.ts`, `src/trimthroughput.ts` as the pattern for a tile with a period select).

## 1. The registry (migration 0118 and src/directorregistry.ts together; the registry test's counts and equality move with it)
- `harvest.btr_pct` is untouched (it stays on bizops and culttech, a planned tile).
- A new row `bizops.testing_throughput`, placed directly after `harvest.btr_pct` in the registry order: dept bizops, wall_keys `bizops`; title_en "Testing Throughput", title_es "Rendimiento de pruebas"; unit ratio; cadence daily; dims "test_type"; goal_kind none; source_kind connector; status live; def_version 1; no open question; compute_key naming lab_samples and the three laws above.
- Guarded and idempotent.

## 2. The data
Computed on the wall read from `lab_samples` (a few thousand rows a season at most), read grouped by day, never per row into the worker past that.
- Tests/Day: samples by intake date in the window, over the count of intake dates with any sample.
- COAs/Day: completed samples by the farm day of the COA posted instant in the window, over the count of days with any COA.
- TAT: the average of intake to COA posted, in days to one decimal, over completed samples whose COA falls in the window (the stored `tat_days`).
- HTD starts at the harvest year's first intake, as the other S3 tiles read the harvest year.

## 3. The tile
- Head: "Testing Throughput", v1.
- A Period select (7 days, 14 days, 30 days, HTD; default 14), client side, remembered per browser in try/catch.
- Three boxes: AVG Tests/Day, AVG COAs/Day, AVG TAT ("5.2 days"); under each, the counts behind it ("1,096 tests over 21 intake days"). Hover or tap: the same split by test type (First-time, Retest, Internal QA).
- "No data" when the window is empty; "TagLeaf last loaded Oct 19, 2:00 AM" under the boxes (from `lab_samples_last_load`, the farm clock), in the warning token when the last load is older than a day.
- Theme tokens only; fits at 1920, 820 and the phone with no sideways scroll (the Scribe renders it at the gate).

## Tests
- On a fixture of five rows shaped like his export (invented lab codes and strains): the three laws, the working day denominators, the test type split.
- A window with tests and no COAs; an empty window; the stale load warning.
- The registry: btr_pct untouched on bizops and culttech; the new row on bizops only, right after btr_pct.
- No dash characters in any output.

## Smoke and gates
Smoke: `About to apply 117 migration(s)` (WL1's read 116; WL2 adds none). Post three invented rows to the lab samples feed, load the bizops wall, check the three boxes and that BTR still shows; keep every other check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke run in the background by the runner law (SMOKE PASS, SMOKE_EXIT 0, no 500); dash, CR and name scans of every touched file. No renders. THE CHECK (the Scribe, on the live-data bench where his export is loaded through TL1): the three boxes for 2026-09-21 to 10-19 against his export (52.2, 47.9, 5.24).

## Hand back
Report `SESSION_REPORTS/2026-10-19_dd_s3g_testing_throughput.md`, short: the tree received and left, files touched, gate results, anything decided or declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. Then the queue's closing report.
