# The TagLeaf pull (TL2)

A small program for Dennis's PC. Once a day it reads the Samples listing of the TagLeaf portal (tenant Alchemy North - Reassure), reads the COA page of each sample completed since the last run, and posts the rows to GripFactory Lite's lab samples feed (TL1). Admin, Lab Samples then shows the load, and the Testing tiles read the table.

It never types a password. You log in to TagLeaf once, by hand, in a browser window it opens; the session lives in a browser profile of its own on this machine. The feed's Access token is typed once, hidden, and saved protected by Windows for your user only. Nothing secret is printed or logged.

First, the rule of the road: TagLeaf's Terms of Use ban robots that collect data. This program is one. It runs on your own account, against your own samples, at one listing call and at most a few hundred COA pages a day. Have Reassure's word that it is fine, or ask them for a sanctioned feed instead.

## Setup (once, in your own PowerShell window)

1. Node 22 or newer is on the PC (`node --version`). Google Chrome is installed.
2. In this folder: `npm install` (Playwright, pinned). The pull drives your installed Chrome; if you would rather it use its own browser, run `npx playwright install chromium` and set `GF_BROWSER=chromium`.
3. `node pull.mjs --login`: a Chrome window opens on the TagLeaf login. Sign in, tick Remember me, make sure the top bar says Alchemy North - Reassure, then press Enter in the PowerShell window. The session is saved under `%LOCALAPPDATA%\gf-tagleaf\profile`.
4. In Cloudflare Zero Trust, add the service token `tagleaf-pusher` to the Access application that fronts the app (same place as the sensor and trim pullers). Then run `.\setup-token.ps1` and paste the Client Id and Client Secret when asked. They are stored DPAPI protected in `%LOCALAPPDATA%\gf-tagleaf\access.json`.
5. `node pull.mjs --dry`: a full run that posts nothing and writes `rows-<date>.json` next to the log, so you can look at the rows first.
6. `node pull.mjs --since 2026-09-14 --max-coas 2000`: the backfill, once. It reads every COA since September 14 (about ten minutes) and posts the rows; the feed updates what the workbook upload already holds and inserts the rest.
7. `.\install-task.ps1`: registers the Windows task "GripFactory TagLeaf pull" at 6:05 PM and 7:35 AM daily, running as you while you are logged on. `Start-ScheduledTask -TaskName 'GripFactory TagLeaf pull'` runs it now.

## Every day

The task lists the last 21 days of lab intakes (one page of 500), reads the COA pages not read before (pacing itself at 400 ms a page, at most 300 a run), posts the rows in chunks of 500, and writes one line to `%LOCALAPPDATA%\gf-tagleaf\pull.log`:

    2026-10-21T22:05:11.000Z intakes 2026-09-30 to 2026-10-22: listed 338, completed with a COA 290, COA pages read 41 (0 failed, 0 still to read); posted 338: inserted 12, updated 40, unchanged 286, refused 0

Admin, Lab Samples shows the same counts as its last load line, source feed.

A row the feed refuses (no lab code, unreadable intake date) is named in the log; the rest land.

## When it stops

- `FAILED: The TagLeaf session has ended ... Run pull.mjs --login.` (exit code 2): the saved login expired. Run `node pull.mjs --login` again. The task picks up at its next time.
- `FAILED: No Access token on this machine`: run `.\setup-token.ps1`.
- `FAILED: The feed answered 403`: the Access token was removed or rotated. Re-run `.\setup-token.ps1` with the new pair.
- `FAILED: The tenant Alchemy North - Reassure is not on this login's switcher`: the login lost the tenant; sign in again by hand and check the top bar.

## What the rows carry (the Samples sheet's columns)

Lab Code; Lab Name (Reassure for RAS codes, Orion for CL); Intake Date (from the lab code); Product Code, Product, Strain, Farm (from the sample name: BUD Bulk, WPR Prepack, SHA Shake; farms ARL, PNS, PNN); Metrc Tag; Test Type (First-time: a compliance order with the cannabinoid test; Retest: compliance without it; Internal QA); Status (Completed, else In Process; samples not yet at the lab are skipped); Result (Pass or Fail); Failure Mode (Pass, Coliform, Yeast & Mold, Both, Foreign Matter, Other) and the two CFU counts when that analyte failed; Other Failed Analyte; Total THC % (from the COA, first-time samples); COA Posted (ET) (the instant the sample reached Completed); TAT (days) (COA posting on the Eastern clock minus the intake date at midnight, the workbook's rule); Batch Qty (g).

## Files

- `pull.mjs`: the runner (browser, listing, COAs, the post). `lib.mjs`: the pure part. `lib.test.mjs`: its tests (`node --test`).
- `setup-token.ps1`: stores the Access token pair. `install-task.ps1`: registers the task.
- On the PC, outside this folder: `%LOCALAPPDATA%\gf-tagleaf\` holds the browser profile, `access.json`, `state.json` (the last run and the COAs already read) and `pull.log`.
