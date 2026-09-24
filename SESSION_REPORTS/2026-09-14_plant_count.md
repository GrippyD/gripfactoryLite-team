# Session report: THE PLANT COUNT (canon 0.30.62), Scribe-direct, 2026-09-14

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. A worker slice with migration 0045, the fourth of the beta floor's first day. Two forks answered by the owner through AskUserQuestion before the build.

## The owner, verbatim

"When you click "finish lot" in wet weights, prompt for the number of plants.  Leave an option on the prompt to click "skip".  If the user skips, you're prompted again when you load a silo or a dry room in the load silo page.  The total divided by the number of plants with each record weight randomized but totalling the correct total is what we need for the CSV that goes into METRC."

Forks (his picks): the second prompt at the load is **skippable again** (the pencil stays open on the lot record); with a count and no tags the METRC file carries **one row per plant with Plant blank**, pasted tags still winning.

## The law

1. **The count lives on the lot.** `wet_weight_entries.plant_count INTEGER`, NULL until given (migration 0045). A count is a whole number of one or more; the crew may type it grouped (`1,200`).
2. **Finish lot asks first.** On the Wet Weight lot panel the Finish lot button opens the question "How many plants in this lot?" with two buttons, Finish lot (posts `plant_prompt=count` and the number) and Skip (`plant_prompt=skip`). Without script the first button posts straight through, which the action reads as a skip. The METRC tag box keeps riding the same form (THE TAG LAW).
3. **Load Silo asks again.** The load form of an uncounted lot carries a Number of plants box ("skipped at Finish lot"); blank skips again; a typed count lands on the lot with a log line under the silo_load reason. A counted lot shows Plants on its card and is not asked. Hang-room lots have no load step, so their count comes at Finish lot or through the pencil.
4. **The pencil.** `plant_count` is a reasoned-edit field on the lot record (Number of plants); a present blank clears it, an absent field leaves it, a value must be a whole number of one or more.
5. **The CSV.** `/admin/uploads/wet_weights/<batch>.csv`: pasted tags win (one row per tag, as before); otherwise a batch with any counted finished lot writes one row per plant for each counted lot, Plant EMPTY, the lot's wet total split across the count by the seeded jitter law (`splitPlantWeights`, the batch id and the lot id in the seed, exact total kept, re-downloads identical), while an uncounted lot keeps its scale reads; a batch with no counts keeps today's per-read file byte for byte.
6. **Display.** The lot panel and the Load Silo card show Plants when set.

## What shipped

- `migrations/0045_plant_count.sql`: the column.
- `src/audit.ts`: `parsePlantCount(raw, label)` (blank null; `^\d+$` after stripping commas; one or more; else 400).
- `src/actions.ts`: `finishLot` reads `plant_prompt` and `plant_count`, writes the count in the status UPDATE and logs `plant_count` under finish_lot; `loadSilo` reads `plant_count`, writes and logs it under silo_load when it changes; the reasoned edit validates `plant_count` (absent unchanged, blank clears).
- `src/db.ts`: `LotRow.plant_count` and `getLot`; `BarnWetLotRow.plant_count` and `listBarnWetLots`; the two wet weights upload queries carry `entry_id` and `plant_count`.
- `src/html.ts`: `weightsSection` `opts.plantPrompt` renders the finish form `finish-with-plants[data-plant-prompt-form]` with the opener button, the hidden prompt (input `plant_count`, buttons `plant_prompt=count|skip`, the note) and `plantPromptScript()`; `wetLotPanel` passes it and shows the Plants row.
- `src/drying.ts`: `plantCountPrompt(lot)` on the load form for an uncounted lot; the Plants row on the lot card.
- `src/csv.ts`: `WetWeightsCsvRow.entry_id` and `plant_count`; `wetWeightsCsvWithCounts(entries, reads, jitterPct, seedKey, barn)`; `anyPlantCount(entries)`.
- `src/index.ts`: the upload route's three-way choice (tags, counts, reads).
- `src/pipeline.ts`: `plant_count` in EDITABLE_FIELDS.wet_weight_entries.
- `src/i18n.ts`: the prompt strings, EN and ES.
- `src/theme.ts` (x3): `.finish-with-plants [hidden] { display: none !important }` (the button rule's inline-flex would defeat the UA hidden, the 2026-09-01 boot-slot lesson), the form wraps, the prompt takes the full row.
- Tests: `csv.test.ts` (seven rows for a 7-plant lot summing cent-exact to 1234.56 within the 10 percent band and not all equal; an uncounted lot keeps its reads in entry order; determinism and a different lot id draws a different split; the Truck n fallback; `anyPlantCount`; `parsePlantCount`); `surface.test.ts` (the prompt markup on the wet panel alone, the Plants row, none on the dry panel); `drying.test.ts` (the re-prompt for an uncounted lot, none and the Plants row for a counted one).
- `scripts/smoke.mjs`: pin 45; the extra lot's panel carries the prompt, a fractional count answers 400, a count of 7 finishes and shows Plants 7, its batch file writes exactly seven blank-Plant rows summing to 200.00 and reproduces byte for byte; the uncounted 1132 lot is asked again at Load Silo and the load with 42 lands the count on the lot record.

## Sealed final check

```
npx tsc --noEmit -> 0
npx vitest run -> 23 files, 568 tests passed (561 + 7)
rm -rf .smoke-persist && SMOKE_PORT=8833 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
  -> "About to apply 45 migration(s)", SMOKE PASS (exit 124 is the teardown hang)
Visual pass (static Grip render of the wet panel, chromium): closed state unchanged
  (Finish lot beside the tag box); revealed state reads "How many plants in this lot?",
  the box, [Finish lot] [Skip], the note, the opener hidden.
Dash audit (fifteen files and this report) -> 0 each
Committed, staged back, sha256 equal both sides (all fifteen):
  migrations/0045_plant_count.sql  334c04d770fc47c3    src/audit.ts   80bcd90090d4773f
  src/actions.ts 4c1e7f9d8a333708   src/db.ts 119b144221945140   src/drying.ts f40d48ffbf00a3bc
  src/html.ts 2ea6f14885e3595f      src/i18n.ts 7726caba5fab8eee src/pipeline.ts e36c6b3b029725b9
  src/csv.ts 531da4b156a59926       src/index.ts da68f0b91a117f2f src/theme.ts 6bb0c5373e3e0296
  test/csv.test.ts 2edac5b4e7082431 test/drying.test.ts a0ec43ee8d9a8a73
  test/surface.test.ts 4e6d31d1d0247b43 scripts/smoke.mjs c45ebf1ab8d198d8
Migrations 0001-0045 in the tree; from-zero smoke pin 45; next is 0046.
Deploy: probe, migrations apply, deploy:grip at the owner's hands (the watcher stopped);
  the version id lands in the LIVE row that follows. Live underneath at writing: 5f0526b2, 0001-0044.
```

## Flags

The count is a number, not the tags: the METRC template still wants a plant tag per row, so the blank Plant column is filled by hand (or by pasting the tags onto the batch, which then wins). "A dry room in the load silo page": the Load Silo page loads silos alone today; a hang-room lot moves at Finish lot by the spine, so its second chance is the pencil. A count typed at the load also lands when the lot already had one (the log shows old and new).
