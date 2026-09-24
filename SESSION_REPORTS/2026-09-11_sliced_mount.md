# Session report: THE SLICED MOUNT (canon 0.30.42), Scribe-direct, 2026-09-11

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. One live incident, one slice, worker only (no migration; the fast lane).

## The incident, verbatim

The owner's screenshot of 2026-09-11, 23:50:27 UTC, from gripfactory-lite-grip.gflite.workers.dev: Cloudflare **Error 1102**, "Worker exceeded resource limits", Ray ID a39a93183d34d8ab. His words with it: **"On the third export mounting"**.

## What it was

One request did everything for one export: read the file, shape every row, load every mirror row under the license, diff, build every INSERT and UPDATE, and run them in batches of 400. For the small files that is nothing; for a plants export of tens of thousands of rows the request holds the shaped rows, the existing rows and thousands of prepared statements at once, and the Worker's ceiling (128 MB of memory, and the CPU time of one invocation) is a hard wall. The first two mounts stood; the third hit the wall. Cloudflare answers 1102 before anything of that request lands, or after part of it: with the mount row written first in the first batch (the 0.30.38 design), a partial mount leaves the mount row and some rows; THE MIRROR LAW makes a re-drop reconcile either way.

## What shipped

**The rounds.** The drop form on `/inventory/metrc` now carries a small script: it sends the same file in rounds of **5,000 rows** (`METRC_SLICE_ROWS`), each round its own request to `POST /inventory/metrc/mount` with `slice`, `slice_size` and, after the first, `mount_id`. Each round answers JSON (`ok, mount_id, kind, phase, license, total, next, done, added, updated, unchanged, gone, redirect`); a refusal answers JSON too (`ok: false, error`) so the page can say what stopped in words. The line under the button reads "Mounting: 5,000 of 48,149 rows so far." and, when the last round answers done, the page goes to the mirror with the usual flash. A browser without the script (or without fetch) posts once as before and the Worker walks the whole file in that one request.

**The Worker's side of a round** (`mountMetrcRound` in `src/metrc.ts`): the file streams once per round (`streamMetrcGrid`, header first, then every row with its index, xlsx through the inflater or CSV); every row is read so the set of tags the file carries and the summary total the whole file, but only the window's rows are shaped into memory, diffed and written. The window's existing rows are read by tag (`WHERE tag IN (...)`, 99 a statement, in one batch), never the whole license. Round zero writes the mount row with the file's row count, zero counts and a summary that reads `{"mounting": true, "rows_done": 0}`, plus the change-log rows for the drop itself; every round adds its counts to the mount row in the same final batch as its rows (counts never run ahead of rows); the last round computes gone (the mirror's live tags under the license, and the phase for plants, minus every tag the file carries), writes the real summary and logs the final counts. Rounds after the first are checked against the mount row: same kind, license and phase, and the same row count, or the round is refused ("That is not the file this drop started with (250 rows then, 3 now); start again."). A mount whose rounds never finished shows in the Mounts table as "unfinished, N of total rows" beside its counts.

**THE MIRROR LAW across our own licenses.** The old mount read the mirror's existing rows by license, so a package the mirror held under one license, dropped in another license's file (a transfer between our own licenses), would have been an insert colliding on the tag. The window lookup is by tag alone, and a row known under another license (or phase) updates in place, license included. Pinned in the smoke: a package mounted under AU-G-C-001509 and then dropped in GR-C-001405's file reads 0 added, 1 updated, and its card reads the receiving license and the receiving file's Received date.

**The size of a round, measured on his own exports** (Node, the same reader): one round of the 48,149-row GR-C-001132 flowering file scans in about 1.0 s and grows the heap by about 18 MB; the 34,445-row GR-C-001405 file about 0.6 s and 13 MB; the 11,742-row AU-G-C-000832 packages file about 0.4 s and 14 MB. Ten rounds for the biggest file. In the browser against wrangler dev, the 34,445-row file mounted in 7 rounds in 6.2 s and the 48,149-row file in 10 rounds in 11.4 s (all rounds 200; a re-drop of the same file, every row unchanged, 10.1 s).

**Not touched:** the ledger, the tag law, the Change Location setup, the Zoho mount, every migration (0001-0043 stand; next is 0044).

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 22 passed (22), Tests 542 passed (542)
Dash audit (6 authored files + this report) -> 0 each
SMOKE_PORT=9814 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 43 migration(s)" from zero
                                         (the process idles after the pass line until the timeout,
                                          as it always has; the orphan sweep follows)
Smoke pins added: a 250-plant flowering xlsx for AU-G-C-001397 in rounds of
  100: round one answers JSON, not done, next 100 of 250, 100 added, with the
  mount id; between rounds the mounts table reads unfinished, 100 of 250 rows
  and the license line holds 100; a round naming an unknown mount is 404 in
  JSON words; a round with a different file is 400 counting both files; a
  later round without its mount is 400; round two reads 200 added; round
  three is done with 250 added and the redirect; the flash reads 250 added,
  nothing reads unfinished, exactly one mount row for the file reads 250 rows
  and 250 / 0 / 0 / 0, the license line reads 250 flowering, the last
  window's last plant stands at GH 2. The re-drop in rounds (one plant moved
  in the first window, one plant dropped from the last): 1 updated and 99
  unchanged, then 199 unchanged, then done at 1 updated, 248 unchanged, 1
  gone; the moved plant reads GH 1; the dropped plant carries a gone date;
  the license line reads 249. The license hop: a package under 1509 dropped
  in 1405's file reads 0 added, 1 updated, 0 gone; its card reads GR-C-001405
  and Received 2026-09-10.
Unit pins (test/metrc.test.ts, 19 -> 24): the diff updates a tag known under
  another license and leaves it unchanged under its own; streamMetrcGrid
  hands the header first and every row with its index in both formats with
  the total; shapePlantRow and shapePackageRow shape one row through the
  header's indexer and answer null for a blank tag; scanMetrcExport keeps
  only the window's rows, sees every tag, totals the whole file (a tag listed
  twice counted once in the summary, its later row kept in the window),
  answers an empty window beyond the file, and refuses a grid that is not
  METRC's in words; the drop page carries data-slice-size 5000, the words the
  script speaks in EN and ES, the progress line and the round loop, and an
  unfinished mount reads unfinished, 15,000 of 48,149 rows.
Visual pass (chromium against wrangler dev on the smoke DB): the real
  MetrcMichiganGRC001405PlantsFlowering_2.xlsx (34,445 rows) chosen in the
  form and the button pressed; the progress line counted 5,000 to 30,000;
  7 rounds, all 200, 6.2 s; the page landed on the mirror with "Mounted:
  plants, 34445 added, 0 updated, 0 gone." and one mount row reading 34,445
  and 34445 / 0 / 0 / 0. Then the real 48,149-row GR-C-001132 flowering
  file: 10 rounds, 11.4 s, 48149 added; the license line reads 48,149
  flowering and 1 vegetative; its re-drop 10 rounds, 0 / 0 / 48149 / 0.

src/metrc.ts 42c2d89bd7891f5a (59,993 bytes)   src/metrcpane.ts 22885fdfb28e0bdd (17,271 bytes)
src/index.ts acd79b913c12841b (102,640 bytes)  src/i18n.ts de47aa17e37bd098 (98,885 bytes)
test/metrc.test.ts 2c0c4c9fbe280259 (34,569 bytes)
scripts/smoke.mjs 9ed4e37dac11b95e (305,392 bytes)
```

## Flags and forks left standing

**The failed third mount's row.** If the 1102 came after the first batch, a mount row for that file stands on the live mirror with the whole-file counts the old code wrote up front (it will not read unfinished; that word is for rows the new code writes). The row is history; the mirror reconciles on the re-drop. Which export it was, and the flash lines of the first two, are owed from the owner.

**The re-drops.** After the deploy, each big plants file goes in again through the page (rounds of 5,000); the small ones are indifferent. The line under the button tells the crew it is working.

**The lever if a round ever hits the wall again:** lower `METRC_SLICE_ROWS` (one constant, worker-only), or raise the Worker's CPU ceiling in wrangler.toml (`[limits] cpu_ms`); memory at 128 MB cannot be raised, which is why the rounds bound it.

**A curiosity in his exports:** MetrcMichiganAUGC001509PlantsFlowering_3.xlsx carries exactly 10,000 rows. A round number that even smells like a grid page cap; the other files are not round (48,149; 34,445; 11,742), so it may simply be the count. If METRC paged that export, a full one is owed before the mirror's gone marks under 1509 are trusted.

**Standing from before:** the rack grid reading, the plants file header (templates owed), CSA's place, F3, F6, F7, F8, F9, the Packages from Harvests Item pattern, the three Zoho forks.

Worker only, no migration: the fast lane (`npm run deploy:grip` from `app\`) or the standing block, which will say no migrations to apply. Live underneath: worker c50fc8b5, migrations 0001-0043 on the rolled database.
