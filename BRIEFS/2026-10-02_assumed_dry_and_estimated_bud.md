# BRIEF V22: ASSUMED DRY AND ESTIMATED BUD (canon 0.30.356)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155): two projected figures on every Harvest Console box, under the Harvest Year Total pane. Built on the worktree exactly as it stands after THE CURE PANE IS A BAR is merged and pushed (LIVE as worker `bd457794`, main `ff0196b`, the app tree `4047f0ef84ba0ae2`, 269 files; if the hash on the disk differs, stop and say so). No migration; the smoke pin stays 89.

## The sources (verbatim)

The owner, 2026-10-02, in chat, with a picture of the four console boxes (PNN, ARL, PNS, Total, each with its Harvest Year Total pane: PNN 243,516.08 lb, ARL 190,189.67 lb, PNS 473,961.19 lb, Total 907,666.93 lb):

"In each farm, under Harvest Year Total:

1. [Assumed Dry]
   1. Take what's actually unloaded from silos with an HBN matching that farm and get the average percentage of drydown.
   2. Apply that percentage to anything that's still drying with an HBN matching that farm
   3. Add the sum of what's actually dried and the projected sum of #2
2. [Estimated Bud]
   1. AVG Weighted BTR for HBNs matching that farm
   2. Apply that BTR to anything that's still drying or dry but not yet trimmed
   3. Add the sum of BUD, PRE, SHA, WBP, and WPR that were harvested with HBNs matching that farm and the projected sum of #2

In the Total Pane:
Assumed total Dry
Estimated Bud

All of this expressed in lbs."

His picks, 2026-10-02: the dry-down "Weighted by weight (Recommended)"; the drying set "Every lot not yet unloaded (Recommended)". On the bud types, his words, verbatim:

"1. Bud = BUD prefix
2. Prepack = PRE prefix
3. Shake = SHA prefix

These are made at the pasteurization stage from the two forms of substrate from the trim room:

1. WIP Bud = WBP prefix - the system calls this "Bud" in the trim weight entry for ease of the user
2. WIP Prepack = WPR - the system calls this "smalls" in the trim weight entry for ease of the user.

We make these changes in METRC, but not right now in the system.  We're building up to it."

So in the app today, every gram of flower is counted once, where it comes off the trim room: the trim packages typed BUD (WBP), SMALLS (WPR) and SHAKE (SHA). The finished BUD, PRE and SHA made from them at pasteurization live in METRC only; the app does not count them, so nothing is counted twice. When pasteurization's conversion comes into the app, a finished package replaces its WIP parent in this sum, never adds to it (say so in a comment at the sum).

## The law

1. THE SET. Per farm, the lots (`wet_weight_entries`, `deleted_at IS NULL`) whose HBN (`harvest_batches`, `deleted_at IS NULL`) is of the console's harvest year (the Harvest Year Total pane's year) and whose `harvest_batches.farm_code` is the box's farm. Lots that are frozen (status `frozen`) or that sit in a freezer space (`dry_spaces.kind = 'freezer'`) are fresh frozen, never dried: they are out of both figures. The Total box is the sum of the three farms' figures, never a recomputation over the pooled lots.
2. THE DRY-DOWN, weighted: over the farm's lots that are unloaded or trimmed (status `unloaded` or `trimmed`) with a dry weight above zero, the sum of their dry weight (`dry_weight_grams`) over the sum of their wet weight (the lot's wet total as the console reads it). No such lot: no dry-down.
3. ASSUMED DRY = the sum of the dry weight of the farm's unloaded and trimmed lots + the dry-down x the sum of the wet weight of the farm's lots not yet unloaded (status `weighing`, `in_transit` or `drying`; a lot still weighing in counts its wet weight so far). With no dry-down, the projected part is left out and the line under the figure says so.
4. THE BTR, weighted: over the farm's trimmed lots (status `trimmed`), the sum of the grams of their bud-type trim packages over the sum of the grams of all their trim packages, by the console's own trim BTR law (the bud types are `parseBtrTypeCodes`, seeded BUD, SMALLS, SHAKE; the trim packages are `wip_packages` under `NON_TRIM_SOURCE_SQL`, `deleted_at IS NULL`; the all-weight denominator as the console's trim section counts it). No trimmed lot: no BTR.
5. ESTIMATED BUD = the grams of every bud-type trim package of the farm's lots, whatever their status + the BTR x (the projected dry of the lots not yet unloaded, from 3 + for each unloaded lot, its dry weight less the grams of all its trim packages so far, never below zero). An unloaded lot partway through trim counts its packages so far and projects only the rest. With no BTR, the projected part is left out and the line under the figure says so.
6. THE PAGE. In each farm box and in Total, right after the Harvest Year Total pane, two metrics in the console's own metric markup (`hc-metric`, `data-hc-metric` keys `assumed_dry` and `estimated_bud`):
   - "Assumed Dry", the figure in lb with two decimals and thousands commas, and under it, muted, "at {pct}% dry-down" (one decimal), or "no dry-down yet" with no unloaded lot.
   - "Estimated Bud", the figure in lb, and under it "at {pct}% BTR" (one decimal), or "no BTR yet" with no trimmed lot.
   - In Total: "Assumed Dry" and "Estimated Bud", the sums, each with the line "the three farms". Every figure in lb (the 448 g pound, `GRAMS_PER_LB`); no grams line on these two.
7. THE DAY. The figures are the harvest year's, not the console's day: the look-back (`?day=`) does not change them.
8. WORDS: EN and ES for the two labels, the four lines and "the three farms".

## The check (for the build session's report)

Read the live snapshot `db_backups/20261002-163605_pre_v18_v21` (or the newest) for each farm: the dry-down, the BTR, the counts of lots in each set, Assumed Dry and Estimated Bud, and put them in the report. The Scribe recomputes them independently at the gate.

## The tests and the smoke

- Unit: a synthetic farm with two unloaded lots (one partway through trim), one trimmed lot, one drying lot, one weighing lot and one frozen lot: the dry-down (weighted, the frozen lot out), Assumed Dry, the BTR (weighted, trimmed lots only), Estimated Bud (the partial lot's remainder never below zero); no unloaded lot (no dry-down, the line says so); no trimmed lot (no BTR, the line says so); the Total as the sum of the farms; a SMALLS and a SHAKE package counted as bud, a TRIM package not.
- Smoke: on `/harvest`, each box carries `data-hc-metric="assumed_dry"` and `data-hc-metric="estimated_bud"` after its year pane, in lb.
- Gates as always: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (`About to apply 89 migration(s)`, SMOKE PASS, no ` 500 `). No git; nothing committed, pushed or deployed. Report to `SESSION_REPORTS/` with the tree hash, the files touched and the snapshot figures.
