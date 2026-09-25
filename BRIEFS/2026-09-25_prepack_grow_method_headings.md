# BRIEF N: THE PREPACK AVAILABLE PANE BY GROW METHOD (canon 0.30.229)

For the build session (Claude Code or Cursor) in `app/`, under THE DISPATCH RULE (canon 0.30.155). A small slice; build it in its own sitting, not inside brief M's, so its report and gate stand alone. Canon wins over this brief where they differ; read `canon/_NOW.md` first. No migration; the head stays where `canon/_NOW.md` says it is. Commit nothing, push nothing.

## The ruling (owner, 2026-09-25, verbatim)

"In the availablility pane for prepack scheduling, next the packages under "Indoor", "Outdoor", and "Greenhouse" under collapsable headings so we can get more granular."

## What the Scribe read in the code

The Prepack scheduling page (`prepackSchedulingPage` in `src/scheduling.ts`, THE SCHEDULER BY PACKAGE, canon 0.30.196) draws Available as one flat `<ul>` of `.schedule-item` rows (one per released, passed WPR package with a METRC tag, `listPrepackAvailable` in `src/db.ts` over `PREPACK_PARENT_SQL`), filtered by the `q` box (`scheduleFilterHit` on the HBN and the tag's last six), with the adopt section beneath. Each row carries `data-schedule-hbn` and `data-schedule-tag`; the count in the pane's header is the visible rows. The HBN's grow method is `harvest_batches.grow_method_code` (ID, OD, GH; the `grow_methods` lookup carries `display_name` Indoor, Outdoor, Greenhouse, seeded by migration 0002, editable in Admin). THE CHECK-ALL AND THE COLLAPSIBLE CATEGORIES (brief J, canon 0.30.217) gave Data Queues `queueFold(key, heading, body)` in `src/html.ts` with `QUEUE_FOLD_SCRIPT`: a heading that folds its body on a tap and remembers the fold in `localStorage` under `gf_fold:<pathname>` by key; that is the pattern to reuse, not a second one.

## The law to build

1. THE HEADINGS. Available groups its rows under one collapsible heading per grow method, in the order Indoor, Outdoor, Greenhouse (the lookup's rows ordered by that fixed list, any other live method after them by display name, and an `Unknown` heading last for a package whose HBN has no method), each heading `<h3>` carrying the method's display name and a `tile-count` of its rows, folding by the same `queueFold` and `QUEUE_FOLD_SCRIPT` as Data Queues (the fold remembered per heading under `gf_fold:/production/scheduling/prepack`, open by default). An empty method draws no heading. Within a heading the rows keep today's order and markup (`packageIdentityMarkup`, the `>>` button, `data-schedule-*`), so `>>`, the working and complete panes, the adopt section and the effective date form do not change.

2. THE FILTER STAYS. The `q` filter hides rows as today; a heading whose rows are all hidden hides with them (its count reads the visible rows); the pane's header count stays the visible total. `FILTER_SCRIPT` learns the headings (their counts and their hiding) without a page load, as it hides rows today.

3. THE READ. `PREPACK_PARENT_SQL` gains the batch's `grow_method_code` and its `display_name` (a LEFT JOIN on `grow_methods` by code, live rows only); `PrepackFeed` and `ScheduleItemRow` carry `grow_method` (the display name or null); `prepackAvailableRow` passes it through. The Scheduled and Complete panes stay flat.

4. THE WORDS. `Unknown` and any new string with Spanish. The method names come from the lookup's display names as stored (the seed's are English; Admin may rename them; they are not translated).

5. THE TESTS. `test/scheduling.test.ts` (or a new `test/prepackheadings.test.ts`): fixtures with packages under an Indoor HBN, two Outdoor HBNs, a Greenhouse HBN and an HBN with no method render four headings in order with the right counts and the `Unknown` last; a method with no packages draws no heading; the `q` filter hides a whole heading and keeps the other; the `>>` button and the `data-schedule-*` attributes are unchanged inside a heading; `test/surface.test.ts` or the markup test for the fold's `data-fold` key. `scripts/smoke.mjs`: on the prepack page the Available pane shows a heading for the fixture's grow method with its count, folds and unfolds by the same markup Data Queues uses, and the filter still finds a package by its last six under its heading.

6. NOTHING ELSE MOVES. The trim and pasteurization surfaces, the drying surfaces if brief M part two has landed, the adopt section, THE UNFINISH, the Data Queues folds.

## Files

- `src/scheduling.ts` (the Available pane), `src/db.ts` (`PREPACK_PARENT_SQL`, `PrepackFeed`, `ScheduleItemRow`, `prepackAvailableRow`), `src/html.ts` (`queueFold` reused, exported if it is not), `src/i18n.ts`, `test/scheduling.test.ts` (or `test/prepackheadings.test.ts`), `test/surface.test.ts`, `scripts/smoke.mjs`.

## Gates and the hand-back

The usual: tsc 0; vitest both zones; node --check; the from-zero smoke at the current pin with `SMOKE PASS` and no 500; dash audit 0; no key or secret in any file; no personnel data. Report `SESSION_REPORTS/<date>_prepack_grow_method_headings.md` with the sealed final check and the assumptions for the owner's word (among them: the fixed order Indoor, Outdoor, Greenhouse with other methods after; `Unknown` for a batch without a method; the fold open by default; the Scheduled and Complete panes staying flat). Do not deploy; the Scribe hands the worker-only deploy line.
