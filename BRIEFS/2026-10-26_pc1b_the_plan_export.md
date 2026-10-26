# PC1b: the plan's export and his headings

Filed by the Scribe on 2026-10-26 (canon 0.30.550). The owner's words, verbatim:
1. With a picture of his Excel table of the plan: "add an export button near the table and reflect the excel table's heading names"
2. Asked which Need the app should use (his sheet's, the app's, or the app's with negatives shown): "Add columns for both summaries"
3. Asked what to call On hand, Open, Pace and Months, which his sheet does not show: "Leave them off the table" (the option read: the page shows only his sheet's columns, and the export still carries all of them).

His sheet's headings, left to right: Strain, Target, Packed (not ordered), On Pack Schedule, Need, Ready to pack, Short Product, with a Totals row set apart below the table and filter buttons on the headings. His sheet works Need as Target minus Packed (not ordered), which leaves the schedule out and goes below zero when packed stock passes the target. His Short Product is that Need minus Ready to pack, never below zero.

Its own slice. No migration. LF only. Read `src/prepackplan.ts` (`planRows`, `prepackPlanSection`), `src/xlsx.ts` (`buildXlsx`, `readXlsxSheets`), `src/reports.ts` (`reportXlsx`, `reportFileStamp`) and the reports' xlsx branch in `src/index.ts` by search and line range.

## 1. The table
On `/production/scheduling/prepack`, the Plan fold's table reads, left to right:

| Heading | What it holds |
|---|---|
| Strain | as today |
| Target | as today |
| Packed (not ordered) | today's Free: On hand minus Open; may go below zero (oversold) |
| On Pack Schedule | today's Scheduled |
| Need | new: Target minus Packed (not ordered); the schedule left out; may go below zero |
| Net Need | today's Need, unchanged: Target minus Packed (not ordered) minus On Pack Schedule, never below zero |
| Ready to pack | today's Ready |
| Short Product | new: Need minus Ready to pack, never below zero |
| Net Short | today's Short, unchanged: Net Need minus Ready to pack, never below zero |

- A blank Target counts as zero in Need, as it does in Net Need.
- On hand, Open, Pace and Months leave the page's table: no heading and no cell. They stay in the export (section 2).
- The header lines stay as they are: "Zoho stock as of {time}", "Orders as of {time}" or "No sales orders mounted yet", and the Targets link.
- One line under the table: "Net Need and Net Short count what is already on the pack schedule. The Plan picks follow Net Need."
- The sort stays: Net Short descending, then Net Need descending, then the name.
- The Totals row sums every column shown, negatives included (his sheet's Need total does the same).
- Short Product and Net Short above zero read in the warn tone, as Short does today. A Need or a Packed (not ordered) below zero shows its minus sign in the plain tone.
- The picks do not change. They cover Net Need, because the schedule already counts, so the Plan badges and `data-plan-pick` stay as they are.
- `planRows` stays pure. It adds `grossNeedGrams` and `grossShortGrams` to each row and to the totals; `needGrams` and `shortGrams` keep today's meaning.
- Data attributes: each existing `data-plan-*` stays on the column whose number it carries today: `data-plan-free` on Packed (not ordered), `data-plan-scheduled` on On Pack Schedule, `data-plan-need` on Net Need, `data-plan-ready` on Ready to pack, `data-plan-short` on Net Short. Add `data-plan-gross-need` on Need and `data-plan-gross-short` on Short Product.
- The table stays `table.data` inside the report-scroll box.

## 2. The export
- An Export button in the Plan header, beside the Targets link: `a.btn.secondary`, as the reports' format buttons are.
- `GET /production/scheduling/prepack/plan.xlsx`, behind the same gate as the scheduler page.
- Built with the in-repo writer (`buildXlsx`), as `reportXlsx` builds a report. One sheet, named `Prepack plan`. File name `prepack_plan_{reportFileStamp()}.xlsx`. The content type and the content disposition are the reports' xlsx branch's.
- Row 1 holds the headings, bold (the writer's header). These are the page's nine headings in the page's order, then four more: On hand, Open, Pace (lb per month), Months. The headings are the English ones whatever the viewer's language, as the house exports are.
- Then one row per strain, in the page's order. Pounds are numbers with two decimals (`lbs`). Months is a plain number with two decimals and never goes through the pounds format (the PC1 gate's fix). A blank stays blank (no Target, no Pace, no Months).
- Then one blank row, then the Totals row, set apart as his sheet sets it. It carries the plan's totals; its Months is the totals' own months of cover, not a sum.
- Then one blank row, then the header's as-of lines as text in column A: "Zoho stock as of {time}", and "Orders as of {time}" or "No sales orders mounted yet".
- Filter buttons on the heading row, over the strain rows only (not the blank row and not the Totals row), as his sheet has them.
  - If `xlsx.ts` has no autofilter, add an optional `autoFilter` field to `XlsxSheet`, off by default. It writes `<autoFilter ref="A1:M{last strain row}"/>` right after `</sheetData>`, the order OOXML wants.
  - With `autoFilter` unset, `buildXlsx` writes exactly what it writes today. A test pins the sheet XML of a small sheet without it, so the New Packages files and the reports cannot change.
- The export reads the same `loadPrepackSurface` and `planRows` as the page. It adds no read of a Zoho table (THE SWAP SEAM holds).

## 3. Words
Every new word on the page goes through `t()` with a Spanish line. Suggested:
- "Packed (not ordered)": "Empacado (sin pedido)"
- "On Pack Schedule": "En el programa de empaque"
- "Net Need": "Necesidad neta"
- "Ready to pack": "Listo para empacar"
- "Short Product": "Producto faltante"
- "Net Short": "Faltante neto"
- "Export": "Exportar"
- "Net Need and Net Short count what is already on the pack schedule. The Plan picks follow Net Need.": "La necesidad neta y el faltante neto cuentan lo que ya está en el programa de empaque. Las selecciones del plan siguen la necesidad neta."

Keys the page no longer uses leave `i18n.ts` only if the house tests want that; the panes keep their own words. No dash characters anywhere.

## 4. Unchanged
- The three panes and their `>>`, `<<` and `>` controls, the filter, the METRC adoption rows and the Plan badges.
- `/admin/prepack-targets`.
- The math of Net Need, Net Short and the picks.
- `zohoPrepackStock` and `zohoPrepackOrders`.
- No migration.

## Tests
Fixtures use invented strain names and round numbers; never copy the live plan's rows.
- `planRows`:
  - target 200, packed 80, on schedule 150, ready 400 gives Need 120, Net Need 0, Short Product 0, Net Short 0;
  - target 200, packed 0, on schedule 175, ready 75 gives Need 200, Net Need 25, Short Product 125, Net Short 0;
  - target 200, packed 450 gives Need -250 and Net Need 0;
  - a blank target counts as zero in both Needs;
  - the totals carry both Needs and both Shorts, negatives included.
- The page:
  - the nine headings in order;
  - no On hand, Open, Pace or Months heading or cell;
  - the note line;
  - the Export button's href;
  - the warn tone on both Shorts above zero.
- The export:
  - `GET /production/scheduling/prepack/plan.xlsx` answers 200 with the xlsx content type and an attachment named `prepack_plan_YYYYMMDD.xlsx`;
  - read back with `readXlsxSheets`: the thirteen headings in order, one row per strain, the blank row, the Totals row and the as-of lines;
  - the autofilter covers the heading row and the strain rows only;
  - Months is a plain number (2 months reads 2), Pace in pounds per month.
- The PC1 gate's Months test moves to the export, since Months leaves the page.
- `xlsx.ts`: with `autoFilter` unset, the sheet XML of a two-row sheet equals the pinned string.
- No dash characters in the page or in the file's text.

## Smoke and gates
- Smoke:
  - `About to apply 120 migration(s)`, as PC1 left it.
  - Load `/production/scheduling/prepack` and check the new headings and the Export link.
  - GET the xlsx: 200, the xlsx content type, and a body that starts with `PK`.
  - Keep every other check.
- Gates:
  - typecheck 0;
  - vitest under TZ=UTC and TZ=America/New_York, with counts;
  - `node --check scripts/smoke.mjs`;
  - the from zero smoke in the background by THE RUNNER LAW (SMOKE PASS, SMOKE_EXIT 0, no 500);
  - dash, CR and name scans of every touched file.
- No renders (THE RENDER LAW). The Scribe renders the page in the nine views, runs THE SIDEWAYS SWEEP and opens the file at the gate.

## For the build session
Cursor, one plain session, no sub-agents. Open `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI`; its `app\` is the app. If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

1. Read this brief through once.
2. Check the starting tree with canon's hash command in `app/`:

       (find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16

   Read `wrangler.toml` as LF. It must be `761c04653a9b4851`, the live tree (PC1, pushed 2026-10-24). If it is not, stop and say so.
3. Build it, run the gates, and write the report (Hand back, below).

THE RUNNER LAW, so the session does not stall:
- A command expected to run longer than three minutes runs in the background, with its output in a log. The from zero smoke takes five to eight minutes. From `app\` in PowerShell:

      $log = Join-Path $env:TEMP "gf-smoke.log"
      Remove-Item $log -ErrorAction SilentlyContinue
      Start-Process -FilePath "cmd.exe" -ArgumentList "/c node scripts\smoke.mjs > $log 2>&1 && echo SMOKE_EXIT 0 >> $log || echo SMOKE_EXIT 1 >> $log" -WorkingDirectory (Get-Location) -WindowStyle Hidden

  then, every 60 to 90 seconds until a SMOKE_EXIT line shows:

      Start-Sleep -Seconds 75; Select-String -Path $log -Pattern "About to apply|SMOKE PASS|SMOKE FAIL|SMOKE_EXIT" | Select-Object -Last 4

  SMOKE_EXIT 0 with SMOKE PASS is the pass. A tool call that times out while the smoke runs is not a failure: read the log.
- The smoke's line packages check reads the wall clock: a run that straddles 23:00 or 06:00 Eastern can fail it. If that check alone fails, rerun once clear of the hour and say so.
- Never start a server or any other command that does not return in the foreground. Nothing interactive.
- No browser and no screenshots. No git, no deploy, no wrangler command against the remote database.
- Do not stop to ask. When the brief leaves a choice open, take the reading closest to the brief and the app's existing laws, write it under "Decided" in the report, and continue. Stop only when the starting tree is wrong or a gate stays red after two honest fixes; then write the report as it stands.
- Never print, store or log a PIN, a token or a secret.

## Hand back
Report `SESSION_REPORTS/2026-10-26_pc1b_the_plan_export.md`, short:
- the tree received and the tree left;
- the files touched;
- the gate results;
- anything decided or declined, and why.

Close with the tree hash and a line that nothing is committed, pushed or deployed.
