# BRIEF T: THE EMPTY CLOCK (canon 0.30.270)

For the build session (Claude Code or Cursor) in `app/`, under THE DISPATCH RULE (canon 0.30.155), in its own sitting on the live tree (worker d2aad6d9, canon 0.30.269). Canon wins over this brief where they differ; read `canon/_NOW.md` first. No migration. Commit nothing, push nothing, deploy nothing.

## The ruling (owner, 2026-09-27, verbatim)

"Can we get the empty countdown on silos next?"

"when an op[erator finishes an unload of a silo or dry room, it should use that timestamp to determin the origin, then count from there. So silo 3 was unloaded today at x time(according to unload dry space)"

## What the Scribe read

1. THE LOAD CLOCK (canon 0.30.9, 0.30.6): a silo tile's body lists each open load with `clockMarkup` (`src/drying.ts`): a `.silo-clock[data-clock]` in `formatClock`'s shape (`1d 02:14:09`), zero at `loaded_at`, paused by `paused_at`, ticked by `clockScript` on every page the strip tops; `siloVisual` (`src/silo.ts`) reads a load (the clock) over filling, filling over loading, and an untouched silo as empty.
2. THE UNLOAD FINISH (`finishUnload` and its statements in `src/actions.ts`): the press stamps `ts` on `unload_sessions.finished_at` and on every open `silo_loads` row of the lot as `ended_at` (the freezer branch the same); a load ends by that press, or leaves with its lot's void (THE VOIDED LOT LEAVES ITS SILO, canon 0.30.116: `deleted_at` set, `ended_at` left null). Nothing else ends a load. `unload_sessions.effective_date` is the unload's day for the ledger, not its moment.
3. THE STRIP'S REFRESH: `/silos/live.json` (`siloLiveEntry`) carries each space's state, grams, fill and, since brief Q, `flags`; `siloLiveScript` repaints each tile from it every `SILO_LIVE_REFRESH_MS` without a page load, and Silo Ops reads the same file, so its fields only ever grow.

## The law to build

1. THE ORIGIN. A silo's or a dry room's empty clock starts at the moment its last load left it: the newest `ended_at` among the space's loads (the unload finish's press, his "according to unload dry space"), or, for a load that left by its lot's void with no `ended_at`, that load's `deleted_at`. A space with an open load has no empty clock. A space no load has ever left has none. A load's `effective_date` plays no part.
2. THE COUNT. It counts up from the origin, in `formatClock`'s shape (`0d 04:12:33`), the load clock's family: his "count from there". Nothing in the data names a moment to count down to; if a target is wanted, it is a brief of its own.
3. WHERE. On the tile, under the state word, a muted line `Empty since` with the clock, on every state without an open load (empty, filling, loading): the space is physically empty through all three and the question is the same, how long it has stood without product. It draws on every page the strip tops. Silos and dry rooms only; a freezer's tile does not carry it (his words name silos and dry rooms; a freezer holds, it does not dry).
4. LIVE. The line ticks by `clockScript` like a running load clock (a `[data-clock][data-state="running"]` with its origin as `data-started` and no banked pause), and `/silos/live.json` carries `emptySince` (the origin's ISO, or null) beside the fields it has, none changed, so the refresh script sets the line when a load ends and clears it when one begins, with no page load. Silo Ops keeps reading what it reads.
5. NOTHING ELSE MOVES. The load clock, its zero, its pause; `siloVisual`'s states and their order; the Drying line of the Operations map (one line per space with an open load; an empty space has no line); Load Silo, Unload Dry Space, the joint unload; the flags; every migration.
6. THE TESTS. The origin from an ended load, from a voided load with no end, the newer of the two when both exist, none with an open load, none with no load ever; the markup on the empty, filling and loading tiles and its absence on a loaded tile and on a freezer; `live.json`'s `emptySince` present with the old fields unchanged; the refresh script's set and clear. `scripts/smoke.mjs`: a silo unloaded in the walk reads `Empty since` with a clock on the strip and `emptySince` in `live.json`; the same silo loaded again loses both.

## Assumptions for his word

- Up from the unload, not down to a target (law 2).
- A void that took the last load counts from the void (law 1); otherwise a silo emptied by a void would show no clock until its next unload.
- Filling and loading tiles carry it as the empty tile does (law 3).
- Freezers do not (law 3).
- The press, not the unload's effective day (law 1).

## Files

`src/silo.ts` (the origin query or its assembly, `siloLiveEntry`, `siloTile`, the refresh script), `src/drying.ts` (the strip's body, `clockScript` if it needs a word), `src/db.ts` (the origin read, if the loads it already lists do not carry it), `src/i18n.ts` (`Empty since`, en and es), tests beside them, `scripts/smoke.mjs`.

## Gates and the hand-back

The usual: tsc 0; vitest both zones; node --check; the from-zero smoke at pin 77 with `SMOKE PASS` and no 500; dash audit 0; no key, secret or password in any file; no personnel data. Report `SESSION_REPORTS/<date>_the_empty_clock.md` with the sealed final check and the assumptions above. Do not deploy; the worker-only line is the Scribe's to hand after the gate.
