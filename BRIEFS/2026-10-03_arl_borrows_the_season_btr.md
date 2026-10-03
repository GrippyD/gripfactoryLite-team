# BRIEF V27: A FARM WITH NO TRIMMED LOT BORROWS THE SEASON'S BTR (canon 0.30.376)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155): one correction to V22's Estimated Bud on the Harvest Console. Built on the worktree exactly as it stands LIVE after BRIEF V26, FINISHED LOTS, FOUND (worker `2c220c44`, main `0e21362`, the app tree `b333d595286a8b10`, 283 files, migrations 0001-0090; if the hash on the disk differs, stop and say so). No migration; the smoke pin stays 90. When this is built, build BRIEF V27a, THE OLD TOTE CONTROLS FOLLOW VOID'S LAW (`BRIEFS/2026-10-03_the_old_tote_controls_follow_void.md`), in the same session; one report and one push for both.

## The sources (verbatim)

The Scribe's question from the V22 and V23 gate (`SESSION_REPORTS/2026-10-02_gate_v22_v23.md`): "ARL has no trimmed lot yet, so it has no BTR, and its Estimated Bud is only the bud packages already weighed (11,773.27 lb); its 5,023 lb of dry not yet run through trim are not projected. Say if a farm with no trimmed lot should borrow the season's pooled BTR until it has one."

The owner, 2026-10-03, in chat: "on the ARL trim question, yes."

## The law

1. THE SEASON BTR. In `consoleYields` (`src/console.ts`), the season's pooled BTR: over the three farms' trimmed lots together (status `trimmed`, frozen and freezer lots out, exactly the lots each farm's own BTR reads), the bud-type grams over all trim grams, weighted by weight (the same sum the farm figure takes, pooled, never an average of the farms' percents). Null when no farm has a trimmed lot.
2. THE BORROW. A farm whose own BTR is null (no trimmed lot) projects its Estimated Bud with the season BTR: its bud packages so far plus the season BTR times (its projected dry plus its unloaded remainder), the same formula as V22 with the borrowed rate. A farm with a BTR of its own keeps it; the first trimmed lot ends the borrow with no switch to set. The Total stays the sum of the three farms' grams. Assumed Dry and the dry-down are not touched.
3. THE LINE. The borrowing farm's Estimated Bud line reads "at {pct}% BTR, the season's (no lot trimmed here yet)" in EN and ES; a farm's own rate keeps "at {pct}% BTR"; with no season BTR either, "no BTR yet" as today. `FarmYield` says which rate it used (its own, the season's, or none), so the page and the tests read it rather than guess.
4. WORDS: EN and ES for the new line.

## The tests and the smoke

- Unit: a farm with no trimmed lot takes the pooled BTR of the other farms' trimmed lots (weighted: two farms of unequal trim weights, the pooled figure is not the mean of their percents) and its Estimated Bud equals bud so far plus that rate times projected dry plus remainder; its line names the season's rate; a farm with its own trimmed lot keeps its own rate; no trimmed lot anywhere leaves "no BTR yet" and Estimated Bud as bud so far; frozen and freezer lots stay out of the pool; the Total is the sum of the farms.
- Smoke: the console with trimmed lots on one farm only shows the other farms' Estimated Bud lines with the season's rate.
- Gates as always: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (SMOKE PASS, no ` 500 `). Dash and CR audits by character; no personnel name in a tracked file. No git; nothing committed, pushed or deployed. Report to `SESSION_REPORTS/` with the tree hash, every file touched, and the figures recomputed on the newest snapshot in the MAIN folder's `db_backups/` (read it from there): the season BTR, each farm's Estimated Bud and its line before and after, and the Total (the Scribe re-checks them at the gate).
