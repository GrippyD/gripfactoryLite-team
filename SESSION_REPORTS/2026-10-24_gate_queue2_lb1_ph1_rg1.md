# Gate: THE QUEUE, TWO (LB1, PH1, RG1)

Gated by the Scribe on 2026-10-24 (canon 0.30.546). PASS WITH TWO SCRIBE FIXES, both in PH1's own lane. Nothing is committed, pushed or deployed.

## Trees
- Received: `9d444d039b24932f` (430 files, 119 migrations), read on the disk in `branches/GFLiteMetrcAPI/app` and rebuilt here. The chain, as the four reports give it: the pin `86b80eda966f0d2d`, then LB1 `e0bc9cca7aa64bd2` (0119), then PH1 `e4c036fb7fa68c63`, then RG1 `9d444d039b24932f` (0120).
- Against the pin: 31 files touched (16 in src, 12 tests, `scripts/smoke.mjs` and the two migrations), plus `test/sideways.test.ts` new. `public/` and `vendor/` are untouched, and `package-lock.json` is unchanged.
- Fixed: `dc284a9cd196d6e6` (431 files with the new test). The fixes:
  - `src/html.ts` `b349e59b303e51b5`;
  - `src/theme.ts` `cbb959dfb36d3475`;
  - `test/sideways.test.ts` `bf60d1dace727246`.

## LB1: a lab create's retry logs nothing
- The probe: LB1's `test/lab.test.ts`, run on the pinned code, fails 5 cases:
  - the frozen compliance retry logs 28 rows for 15;
  - the bench, compliance and op import retries in the same millisecond log 30 for 15, 30 for 15 and 52 for 26;
  - the 900 row import case wants the new `write_id`.
  On the hand-back all of them pass.
- On the live-data bench (0119 applied):
  - `write_id` is on the three tables and null on the 574, 378 and 2,621 rows already there.
  - A station create answers 201 with 15 change log rows. The same body again answers 200, `created: false`, and the log stays at 15.
  - The stored `write_id` is set and never leaves the server: not in the create or resend answers, the internal, compliance and op lists, or the three feeds.
- Read in the diff: a create's log guard is `id` and `write_id`, and the op import's is `write_id` with `source = 'station'`. `write_id` is not a logged field. Patch and void are unchanged.

## RG1: the for sale tile loses its answered question
- On the bench, 0120:
  - nulls the two questions on `farmops.assets_for_sale_count`;
  - leaves status live, def_version 2 and the title standing;
  - stamps `updated_at` 2026-10-24T00:00:00.000Z.
  Rows with an open question go from 68 to 67. Running 0120 a second time changes nothing.
- The farmops wall: no "?" on Asset list and for sale list, and its count and the Equipment for sale link stand. The wall's other 14 question marks stand.

## PH1: the sideways sweep, at the gate
THE SIDEWAYS SWEEP measured the page's sideways scroll on 222 pages (the 0.30.541 crawl and its six extra pages) in Lite, Continuum and Grip (cerberus) at the phone (390), 820 and 1920. That is 1,998 measurements.

On the hand-back, two things were still wrong:
1. **`/admin/uploads` at 820:** 254, 243 and 227 px in the three themes. PH1 wrapped the Wet Weights and New Packages tables only. The Package files and Location changes tables still pushed the page.
   - Fix: every table in the uploads folds now sits in the report-scroll box. That covers manifests, package files, receive manifest, splits, location moves, location changes, test samples, prepack and changed after upload.
   - A new test renders a row in each fold and checks every table. It fails on the hand-back and passes on the fix.
2. **`/inventory/metrc` at the phone:** the Three pictures list no longer scrolled, but `minmax(0, max-content) minmax(0, 1fr)` let the label column take its full width. Three values shrank to 0 to 11 px and printed one character a line in all three themes.
   - Fix: `.lot-meta` takes `fit-content(45%) minmax(0, 1fr)` in the three stylesheets. A label column never passes 45% and wraps inside it, and the value keeps the rest.
   - A desktop label stays at its own width, so a wide window reads as before. Rendered and read at the phone after the fix.

[SWEEP RESULT]

## Gates on the fixed tree
[GATES]

## Scans
The 31 touched files (and the three fixed files) hold no U+2013 or U+2014 and no CR, and no person's name appears in an added line.

## Note
During the sweep the bench worker stopped once: workerd reported "Network connection lost" at 19:23:05Z, a minute after the from zero smoke ended. It was restarted, and the remaining views ran clean. It did not come back. This is the bench's worker, not the app.

## The merge
Two migrations ride (0119, 0120), so the merge block takes a snapshot first. The worktree commit carries:
- the fixed tree;
- the queue's briefs and reports, and this gate report;
- `tools/sandbox` and `.gitignore`, identical to the copies already on main;
- the PC1 brief and Cursor's PC1 stop report.

Canon is committed on main first. Then `git merge --no-ff GFLiteMetrcAPI` with the message on the command line, then the push.
