# RG1: the for sale tile loses its answered question

Filed by the Scribe on 2026-10-24 (canon 0.30.540). This is a registry tidy, not a new tile; the director dashboard pause (canon 0.30.528) stands for new tiles.

The registry row `farmops.assets_for_sale_count` (Farming Operations, "Asset list and for sale list") still carries the open question it was seeded with in 0105: "The asset register of record (the app table or the accounting register) and which fields the app holds". The owner answered it with his pick for L4 (canon 0.30.531): the app's asset rows hold the sale fields (sale status, condition, asking price, note), typed on the asset page. 0116 made the row live (def_version 2) but left the question in place. So the wall tile still shows its "?" beside a live count; hovering it shows the old question. The L4 gate recorded it (canon 0.30.536): "Clearing it is a registry line for a later slice." The director questions page lists the debate questions (`dd_kpi_questions`), not this registry text, and does not change.

Part of THE QUEUE, TWO (`BRIEFS/2026-10-24_queue2_lb1_ph1_rg1.md`): read it first; its runner law and stop rules apply here. THIRD IN THE QUEUE. Pin: the tree PH1 left, as PH1's report states. No git; nothing committed, pushed or deployed. One migration, `0120`. LF only. Read `src/directorregistry.ts` and `src/director.ts` by search and line range.

## 1. The registry (migration 0120 and src/directorregistry.ts together; the registry test moves with it)
- `farmops.assets_for_sale_count`: `open_question_en` and `open_question_es` become null. Nothing else on the row changes: title, compute_key, status live and def_version 2 stay as they are.
- Migration 0120 is guarded and idempotent. It updates the row only while its question still reads the seeded English text, and stamps `updated_at`. A second apply changes nothing.
- The 0105 seed text stays byte for byte, as the S3g slice kept it.

## 2. What a reader sees
- The farmops wall tile shows no "?" for this row.
- The tile still reads its live count with the link to Equipment for sale, as L4 left it.
- Every other tile's "?" and the questions page are untouched.

## Tests
- The registry row has both questions null. The registry test's equality with the migrated database holds.
- The farmops wall renders no `data-dd-question="farmops.assets_for_sale_count"`.
- Every other row's open question is unchanged. Compare the counts of rows with an open question before and after: exactly one fewer.
- Applying 0120 a second time changes nothing.
- No dash characters in any output.

## Smoke and gates
- Smoke: `About to apply 119 migration(s)` (PH1 left 118). Load the farmops wall and check that the for sale tile has no question mark. Keep every other check.
- Gates:
  - typecheck 0;
  - vitest under TZ=UTC and TZ=America/New_York, with counts;
  - `node --check scripts/smoke.mjs`;
  - the from zero smoke in the background by the runner law (SMOKE PASS, SMOKE_EXIT 0, no 500);
  - dash, CR and name scans of every touched file.
- No renders.

## Hand back
Report `SESSION_REPORTS/2026-10-24_rg1_for_sale_question.md`, short. Give the tree received and left, the files touched, the gate results, and anything decided or declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. Then write the queue's closing report.
