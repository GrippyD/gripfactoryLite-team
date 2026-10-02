# BRIEF V23: THE FRESH FROZEN DRY EQUIVALENT AND ESTIMATED DRY TOTAL (canon 0.30.359)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155): two more figures on the Harvest Console's Total box only, after V22's Estimated Bud. Built on the worktree exactly as it stands after BRIEF V22, ASSUMED DRY AND ESTIMATED BUD, is merged and pushed (the Scribe writes the tree hash into this line at the paste; if the hash on the disk differs, stop and say so). No migration; the smoke pin stays 89.

## The sources (verbatim)

The owner, 2026-10-02, in chat, on the Scribe's flag that V22 leaves frozen and freezer lots out:

"oh, missed your last note.  We will want to add it later somewhere in the totals.  It's going to be an additional number: Dry Equiv. Wt of Fresh Frozen

I need to think about how to do that one.  It does come up every year.  "How much of fresh frozen could've been dried flower?" will get asked.  And eventually we'll add that number to the total dry anyways.  So yes.  I just want to be cautious in implementing it.  It's not a farm-by-farm number.  It should go after Estimated Bud, and after that, Estimated Dry Total should be all the remaining plants with their dry down factored + the total actually dried + the fresh frozen equiv"

Then, on the Scribe's three questions:

"Conversion Factor: weighted dry down average
Remaining plants: same conversion factor multiplied by the average wet weight per plant
and yes, same as V22 for assumed dry."

## The law

1. THE FACTOR: the season's weighted dry-down over all three farms together: the sum of the dry weight (`dry_weight_grams`) of every unloaded or trimmed lot of the console's harvest year with a dry weight above zero, over the sum of those lots' wet weight, by V22's own set rules (frozen and freezer lots out of the factor's own lots). One factor for the Total box, never a farm's. No such lot: no factor, and both new figures read a dash with the line "no dry-down yet".
2. DRY EQUIV. WT OF FRESH FROZEN = the factor x the wet weight of the season's fresh frozen lots: the lots V22 leaves out (status `frozen`, or in a freezer space, `dry_spaces.kind = 'freezer'`), all farms, their wet total as the console reads it.
3. THE REMAINING PLANTS IN POUNDS = the Total box's Plants Remaining (the figure it shows, Admin's typed totals less the harvested, never below zero) x the Total box's Wet Weight/Plant Avg (the figure it shows, in grams) x the factor. No Wet Weight/Plant Avg: this part is zero and the line says so.
4. ESTIMATED DRY TOTAL = 3 + the Total box's Assumed Dry (V22's, the sum of the three farms) + 2.
5. THE PAGE, the Total box only, right after V22's Estimated Bud, in the console's metric markup (`hc-metric`; `data-hc-metric` keys `ff_dry_equiv` and `estimated_dry_total`), lb with two decimals and thousands commas (the 448 g pound), no grams line:
   - "Dry Equiv. Wt of Fresh Frozen", and under it, muted, "{wet lb} lb frozen at {pct}% dry-down" (the wet in lb, the factor to one decimal).
   - "Estimated Dry Total", and under it, muted, "{n} plants left at {lb} lb each + Assumed Dry + fresh frozen" ({n} the Plants Remaining with commas, {lb} the projected dry per remaining plant, the Wet Weight/Plant Avg x the factor, in lb to two decimals).
   No farm box carries either figure.
6. THE DAY: the harvest year's figures; the look-back does not change them (V22's law).
7. WORDS: EN and ES for the two labels and the lines.

## The check (for the build session's report)

From the newest snapshot: the factor, the frozen lots' count and wet lb, the dry equivalent, the Plants Remaining and the Wet Weight/Plant Avg used, the remaining plants' pounds, Assumed Dry, and Estimated Dry Total. The Scribe recomputes them at the gate.

## The tests and the smoke

- Unit: a synthetic season over two farms with unloaded, trimmed, drying and frozen lots: the factor pooled and weighted (not the mean of the farms' dry-downs), the frozen equivalent, the remaining plants' pounds from the shown Plants Remaining and Wet Weight/Plant Avg, Estimated Dry Total as the three parts' sum; no unloaded lot (dashes, "no dry-down yet"); no farm box carries the two keys.
- Smoke: `/harvest`'s Total box carries `data-hc-metric="ff_dry_equiv"` and then `data-hc-metric="estimated_dry_total"` after `estimated_bud`; no farm box carries them.
- Gates as always: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (`About to apply 89 migration(s)`, SMOKE PASS, no ` 500 `). No git; nothing committed, pushed or deployed. Report to `SESSION_REPORTS/` with the tree hash, the files touched and the snapshot figures.
