# DD S3g: Testing Throughput takes BTR's place (after TL1, the lab samples door)

Filed by the Scribe on 2026-10-19 (canon 0.30.522) from the owner's word: "In BTR: yesterday, weighted average to date, projected's place: Testing Throughput". His mock: Label Testing Throughput; three boxes, [AVG Tests/Day], [AVG COAs/Day], [AVG TAT]. He attached his TagLeaf export, Grip_Testing_Data_2026-09-14_to_2026-10-19.xlsx (TagLeaf LIMS, Alchemy North Reassure). Colors: our themes.

THE SOURCE (the Scribe named it; his pick): the app's lab_compliance_samples (the InTesting workbook sync) is stale: 378 samples, last entered 2026-10-03, last finished 2026-09-29, average TAT 3.97 days, and Reassure is not in testing_labs. His export holds 1,096 Reassure samples, intake 2026-09-21 to 10-19: about 52 tests per intake day, 48 COAs per COA day, average TAT 5.24 days (first-time 5.69, retest 4.38, internal QA 5.06). His pick: a TagLeaf feed; with the API limited, a daily script on his PC posts to TL1's door. His pick on counting: working days, harvest to date, with a period select: Tests/Day = samples the lab took in over the days it took any in; COAs/Day = COAs posted over the days any posted; TAT = the average days from intake to COA.

RUNS AFTER TL1 (BRIEFS/2026-10-19_tl1_lab_samples_door.md), on TL1's gated tree; the Scribe re-pins at dispatch. TagLeaf's API is limited (the owner, 2026-10-19), so TL1 builds the app's door instead of a pull: the `lab_samples` table, filled by an Admin upload of his export and by a token fronted feed a script on his PC posts to daily (TL2, written once the Scribe knows what TagLeaf gives his login). This tile reads `lab_samples` and says when it was last loaded (`lab_samples_last_load`).

## 1. The registry (migration 0113, after TL1's 0112)
- `harvest.btr_pct`: active 0 (its row stays).
- A new row `bizops.testing_throughput` in its sort slot, on the walls btr_pct was on: title_en "Testing Throughput", title_es "Rendimiento de pruebas"; unit ratio; cadence daily; dims "test_type"; goal_kind none; source_kind connector; status live; def_version 1; no open question; compute_key naming lab_samples and the three laws above.

## 2. The data
Computed on the wall read from lab_samples (a few thousand rows a season at most, read grouped by day, never per row into the worker past that).
- Tests/Day: samples by intake date in the window, over the count of intake dates with any sample.
- COAs/Day: completed samples by the farm day of the COA posted instant in the window, over the count of days with any COA.
- TAT: the average of intake to COA posted, in days to one decimal, over completed samples whose COA falls in the window.

## 3. The tile
- Head: "Testing Throughput", v1.
- A Period select (7 days, 14 days, 30 days, HTD; default 14), client side, remembered per browser in try/catch.
- Three boxes: AVG Tests/Day, AVG COAs/Day, AVG TAT ("5.2 days"); under each, the counts behind it ("1,096 tests over 21 intake days"). Hover or tap: the same split by test type (First-time, Retest, Internal QA).
- "No data" when the window is empty; "TagLeaf last loaded Oct 19, 2:00 AM" under the boxes (from lab_samples_last_load), in the warning token when the last load is older than a day.
- Theme tokens only; fits at 1920, 820 and the phone with no sideways scroll.

## Tests
- On a fixture equal to five rows of his export: the three laws, the working day denominators, the test type split.
- A window with tests and no COAs; an empty window; the stale load warning.
- The registry: btr_pct inactive, the new row on its walls.
- No dash characters in any output.

## Gates and hand back
As the other S3 slices: typecheck; vitest under both time zones; the from zero smoke with the new count; renders in all three themes at 1920, 820 and the phone; on a live-data bench with his export uploaded through TL1, the three boxes for 2026-09-21 to 10-19 against his export (52.2, 47.9, 5.24). Report `SESSION_REPORTS/2026-10-19_dd_s3g_testing_throughput.md`; nothing committed, pushed or deployed.
