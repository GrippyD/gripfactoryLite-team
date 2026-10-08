# 2026-10-08 R5 Dry Weight by Strain (canon 0.30.427), Scribe-direct (G-2): SEALED

BRIEF R5 `BRIEFS/2026-10-08_dry_weight_by_strain.md`, built by the Scribe in the worktree on the bar hover tree `5250906e8547b9f9`. The owner, 2026-10-08, verbatim: "New Report: Dry Weight by Strain: 1. Date Range field 2. Strain=(blank = all) 3. Grow Method=(combobox(indoor,outdoor,greenhouse, blank (all))) 4. Farm=(bombox(PNN,PNS,ARL,Blan(all))". His picks: the range on the unload date; the strain pick matches the real strain or the market strain.

THE TREE: `3f067013cbb9f39e` (309 files, migrations 0001-0095; no migration), on the disk the same.

## What was built

1. THE PAGE. Reports carries "Dry Weight by Strain" (ES "Peso seco por cepa") at `/reports/dry_weight_by_strain`. Filters in the house layout (stacked `label.field`, as TATs and the other date reports): From and To (From defaults to 30 days before today in Eastern, To to today; "That is not a date.", "To is before From.", "Pick 366 days or fewer." refused in words), Strain (All plus every name that appears as a lot's real strain or market strain in the range's data), Grow Method (All, Indoor, Outdoor, Greenhouse), Farm (All, PNN, PNS, ARL), and a note: "A lot counts on the day it was unloaded: the Effective Date typed at the unload, else the Eastern date of its finish."
2. WHICH LOTS. Every live lot (entry and batch not deleted, batch not a test HBN) with a finished unload; the unload date is the newest finished session's `effective_date` when set, else `etDate(finished_at)`; dry is `wet_weight_entries.dry_weight_grams`, else the sum of its live `dry_weights`, else 0. A lot never unloaded is out.
3. THE ROWS. One per (real strain, market strain) pair, the market blank when it equals the real, sorted by dry weight largest first: Strain, Market strain, Lots, Wet lb, Dry lb (both at 448 g, two decimals, grams in the hover), Dry/Wet % (one decimal), Plants (lots with a count), Dry lb/plant (dry of the counted lots over their plants; blank when none counted). The lot numbers (last five) fold under each strain row ("{n} lots, {g} g dry", singular "{n} lot"). A Total row by the same rules, with no fold (every lot is already under its strain). Empty: "No lot was unloaded in that range." / "Ningun lote fue descargado en ese rango."
4. EXPORTS. CSV (the lot numbers as a column), XLSX and PDF of the rows shown, the heading carrying the filters ("Unloaded {from} to {to} · strain {name} · Outdoor · PNN").
5. NOTHING ELSE MOVES. Read only; no migration.

## Files (all under `app/`)

| file | bytes | sha256 (16) | what |
|---|---|---|---|
| `src/drystrain.ts` (new) | 11,686 | `0c9a0d553c4754cb` | the range, the filters, the rows, the SQL |
| `src/reports.ts` | 35,871 | `cc396634194badd7` | the key and the card |
| `src/html.ts` | 197,717 | `478948a7e47def4f` | the fold row under a strain row; the lot column off the page |
| `src/index.ts` | 181,985 | `346f1283ea715bb1` | the route branch and its filter form |
| `src/i18n.ts` | 270,984 | `a4494169d3afd815` | the EN and ES strings |
| `src/theme.ts` | 200,989 | `82cf856b1bed8619` | `.report-detail`, `.report-fold` styles (on the bar hover fix) |
| `test/drystrain.test.ts` (new) | 10,464 | `5ecd0c1358cc844f` | 6 tests |
| `test/console.test.ts` | 97,621 | `83d421bb10ae4f1b` | 14 report keys |
| `scripts/smoke.mjs` | 824,862 | `dfff1721f003a168` | the report on the smoke lot, the words, the CSV, XLSX, PDF |

Also `BRIEFS/2026-10-08_dry_weight_by_strain.md` and `BRIEFS/2026-10-08_lot_26062_investigation.md` (the prompt for the 26062 investigation, read-only, for an agent in the investigator's own clone).

## Sealed final check

```
THE TREE                              3f067013cbb9f39e (309 files, 0001-0095), disk the same
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 96 files, 1263 tests passed
TZ=America/New_York npx vitest run    96 files, 1263 tests passed
node --check scripts/smoke.mjs        exit 0
CI=1 SMOKE_PORT=9461 npm run smoke    About to apply 95 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
rendered at 1920                      Lite, CO, Cerberus: one strain row, its fold "1 lot, 752 g dry" with the lot number, Total 1 / 2.76 / 1.68 / 60.9, three selects (strain 2, method 4, farm 4), no page error
rendered at 390 (phone)               the table clipped in its box, no page scroll, no error
dash audit (by character): 0; CR audit: 0; personnel names: none
```

The brief's figure on `20261008-135926_post_dedupe` (From 2026-09-01 To 2026-10-08: 76 lots, 20 pairs, 89,801,068 g dry; Bermuda Triangle 18 lots, 23,601,105 g dry, 104,707,657 g wet, 14,116 plants) came from the same SQL run on the snapshot; the live page should show it once the merge lands.

## The merge (his hands; the bar hover fix rides with R5; no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_r5
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "R5 Dry Weight by Strain; the bar buttons all light on hover" -m "Reports gains Dry Weight by Strain: lots by unload date, filtered by strain (real or market), grow method and farm, one row per strain pair with wet, dry, percent, plants and dry per plant, the lot numbers folded under, CSV, XLSX and PDF. Models, Harvest Console and Maintenance take the hover, focus and press styles Reports and Admin had. No migration. Canon 0.30.425 to 0.30.428.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge R5 and the bar hover fix"
git push
```

His paste back: the Version ID.
