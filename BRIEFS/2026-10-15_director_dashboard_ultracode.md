# DD: Director Dashboard in Admin (an ultracode brief)

Filed by the Scribe on 2026-10-15 (canon 0.30.493) from the owner's word: "Need added: Tools for all of this. Put it in Admin: [Director Dashboard] ... intuit what I need from the book provided. Anywhere a connection to authenticated data can be provided is great, but if it all needs to be hand-entered for now, that works. But make researching and sub-agent debate a part of the gig." And on cost: he does not mind spending this week's Fable allowance on it, but must not exceed it.

## Where and how
- Open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155): one build session in this worktree.
- Pin: the live tree `59b132a8a7496a1b` (AD1 live, worker 4e270d33, migrations through 0104). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs.
- No git. Nothing committed, pushed or deployed, whatever any tool offers. The owner merges after the Scribe gates.
- Inputs (git-ignored, never copied into the repo):
  - `..\..\db_backups\_imports\director\director_kpis_book1.xlsx`: the owner's workbook. Sheet1 rows 3 to 26 are the plan list (department, KPI, frequency, season window for plan year 2027); rows 29 to 85 are each director's own list.
  - `..\..\db_backups\_imports\director\research.json`: the Scribe's research run. Every KPI mapped to its source in this code, three competing designs, and a judge's verdict and slice plan. Start from it. Do not redo the mapping; challenge it where the code says otherwise.

## The house rules (each one has bitten before)
1. No personnel names anywhere in the repo: code, seeds, tests, fixtures, i18n, reports. Departments are codes (sales, finance, bizops, farmops, culttech). People are rows the owner picks in the app. The workbook carries names, so read it but never quote it into a file.
2. No em dash or en dash in any file you write; audit by character. LF only.
3. Values live in data (app_config or tables), with code fallbacks so a missing row never blanks a page. The FG and Harvest Dashboard settings (canon 0.30.491) are the pattern.
4. Every write takes a person and a reason and lands in record_change_log, as the App config and Harvest Dashboard editors do. A no-op save writes nothing.
5. D1: at most 100 binds per statement; never scan sensor_readings; read pages in one round trip where possible; every page under 1 s on a live-sized bench.
6. EN and ES strings in i18n for every word on a page. Three themes (Lite, CO, Cerberus) through theme tokens. No sideways scroll at 820.
7. Migrations start at 0105, one per slice that needs one, INSERT OR IGNORE seeds.
8. A file under public/ is served only when a route names it (canon 0.30.483).
9. Do not redo work the app already does: reuse console.ts, strainperformance.ts, fginventory.ts, reports.ts, gripcasting/model.ts, labvocab.ts and the lab and METRC modules, and hold every reused number equal to its source page in a test (parity).

## The design (from the research run's verdict; refine it, do not restart it)
- Admin gets a [Director Dashboard] button (ADMIN_GROUPS in src/html.ts). Routes under `/admin/director`, behind the existing Admin PIN gate.
- A KPI registry (`dd_kpis`, about 50 to 60 keys after folding the workbook's duplicates, for example PPP and labor forecasting asked twice): key, department, unit, cadence, season window, goal kind and goal source, compute key, stale-after hours, status (`live`, `needs_definition`, `parked`), definition version, and an open question per row.
- One snapshot table (`dd_kpi_values`) every source writes: computed from app data, hand entered, or from a connector. Each value carries its source, as-of time, definition version and count. Pages read snapshots only, so they stay fast. Snapshots are taken on the crons the app already runs (multiplex on event.cron, no new cron trigger).
- Hand entry from day one: one entry grid per department and period, with live values shown locked, last period as the placeholder, and a person and a reason. CSV backfill and target import.
- Targets are effective-dated, with phasing (an annual goal spread by week or month).
- Definition questions are answered inside the app by the owner: a ruling writes data, bumps the definition version and restates open periods, all logged. A KPI marked `needs_definition` shows a badge, not a number.
- One typed log per data shape for what nothing in the app holds: issues (compliance, safety, returns, feedback), field plans and labor tasks, scouting and applications, projects, finance snapshots (cash, AR and AP aging, receipts, cash flow), extraction batches, strain scores. Finance hand entry writes the same tables a connector will later fill.
- Connectors last, each its own slice, only once research proves the product and the access: METRC transfers, lab results and additives on the existing sweep (already authenticated); the TagLeaf client API for lab results and FTQ (Bearer token the owner creates and sets as a Worker secret himself; never stored, logged or shown; canon 0.30.476); Zoho Inventory or Books API into the existing mounted_* tables so Fulfillment keeps working; QuickBooks Online only if research shows the company is not on Desktop; Open-Meteo for outdoor DLI. Every connector: tokens are Worker secrets set by the owner, an OAuth callback checks a state nonce, tests use recorded fixtures and never call out.

## Already known (from canon; do not reopen)
- The app pound is 448 g. A page that shows a standard pound says so beside it.
- FTQ is first-time quality: completed first-time compliance samples that passed over all completed first-time compliance samples, by harvest week (the FTQ package, canon 0.30.476).
- Strain performance, BTR to date (the console's Weighted BTR), the FG inventory, the Harvest Dashboard settings and GRIPCasting already exist and are live; reuse them.

## The run (research and debate are part of the job)
Work in phases. Use workflows and sub-agents throughout.

S0, research and debate, no code. Read the code the research cites and confirm or correct each mapping. Fold the workbook's duplicates. For each open definition (PPP: pounds per plant wet, dry or bud; HTD start; processed pounds; shipped and interco; active-account window; order week or invoice week; all-in cost scope; plan source for each goal; projected BTR and PPP basis; MOH; Product Life Cycle; Continuum Contra Recompenses; the Monthly Retail Data Report; market penetration), run a debate: two advocates, one rebuttal each, a judge, and record the recommendation with its evidence. Research each connector's product, auth and limits from primary docs. Output to `SESSION_REPORTS/2026-10-15_dd_s0.md`: the KPI registry as it will be seeded, the debate results, the connector findings, the questions only the owner can answer (with the recommended answer for each), and the slice plan with a token estimate per slice. Then STOP. The owner answers and dispatches the build.

After the owner's answers, build in this order. Each slice ends with its own report, and the session stops at the end of a tranche:
- Tranche 1 (the day-one cut): S1 migration 0105 core tables and seeds, the Admin button, the department tile walls; S2 the entry grid, KPI detail with history and change log, targets with phasing, the questions page, CSV backfill and target import.
- Tranche 2 (live numbers): S3 harvest tiles (wet weight, percent finished, PPP, BTR, trim throughput and lbs per labor hour, capacity utilization, yield per plant vs plan) at parity with /harvest; S4 operations quality and inventory (testing quantities, throughput and turnaround, FTQ, failure modes, environmentals, inventory by stage, METRC reconciliation, product mix, equipment upkeep); S5 sales from the Zoho mount (orders and shipments, units and average price, volume and price vs goal, revenue vs plan, active and lapsed and new customers, prepack by strain); S6 finance from GRIPCasting (P&L vs budget, close on time, forecasting by business unit, remaining budget, all-in cost per lb, planned vs unplanned POs); S7 labor hours and estimated cost by business unit, reconciled to payroll GL monthly.
- Tranche 3 (the typed logs): S8 issues; S9 field plans and labor tasks; S10 finance snapshots and extraction; S11 scouting, applications, DLI; S12 projects and the strain scorecard.
- Tranche 4 (connectors, each only with S0's go): S13 METRC transfers, lab results and additives; S14 TagLeaf; S15 Zoho API; S16 QuickBooks Online or a Desktop upload kind.

Each slice: tests for every computation and every refusal; parity tests against the page it reuses; the from-zero smoke grows by its checks and passes; typecheck 0; vitest under TZ=UTC and TZ=America/New_York; renders in the three themes at 1920 and 820; a name scan and a dash scan of every file touched. After each slice, adversarially verify it with independent reviewers (correctness, house rules, performance) before moving on, and fix what they confirm. At most two fix attempts per slice; then stop and report.

## The budget (hard)
The owner's Fable allowance for the week is the ceiling. If his message opens with a token target (for example `+1M`), that is the ceiling: scale every workflow to `budget.remaining()`, check it before each slice, and do not start a slice whose estimate exceeds what remains. Stop early rather than late. Always leave enough to write the stop report. With no target, run S0 only and stop. Every stop report gives tokens used, the tree hash, every file touched, what is done, what is next, and the next slice's estimate. Never start a new slice inside the last 15 percent of the target.

## Hand back
Report per slice in `SESSION_REPORTS/` (short; the Scribe's gate report carries the detail), and end the session with the tree hash. Say nothing is committed, pushed or deployed. The Scribe gates; the owner merges.
