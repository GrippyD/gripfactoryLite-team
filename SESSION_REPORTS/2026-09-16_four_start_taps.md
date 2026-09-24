# 2026-09-16 THE FOUR START TAPS (canon 0.30.89)

Scribe-direct under G-2. Owner report 2026-09-16, two screenshots of the wet weight station, verbatim: "What's happening?". The picture: HBN Queue 1, PNS / Gelonade / 2026-09-15 (26258-PNS-OD-029-0-NA-26020), "LOTS IN PROGRESS" listing four lots by their UTC instants, 2026-09-16T00:12:43.964Z (total 0.00 g), 00:12:48.658Z (total 1,878,105.00 g), 00:12:48.972Z (total 0.00 g), 00:12:49.371Z (total 422,094.00 g), and "Start another lot" beneath.

## What was found

Four Start lot posts landed on the same HBN within six seconds (8:12 PM Eastern on the 15th): repeated taps on Start lot while the first post was still saving. The header form's button did not lock, and the server took every post as a new lot. Two of the four then received weight. With more than one weighing lot on the HBN, the pick page shows the resume panel, which labeled each lot only by its creation instant in UTC.

## The law

1. The Start lot repeat guard: a header that repeats an EMPTY weighing lot's on the same HBN (same Move To, truck number and Team Lead, case-blind) born within the last minute (`START_LOT_REPEAT_WINDOW_SECONDS`) lands on that lot with a flash ("That lot was already started a moment ago; you are on it. No second lot was made.") and mints nothing. A lot that already holds weight is never taken for a tap: a second crew's lot, another Team Lead, another truck, a voided or finished twin all mint their own.
2. The header form locks its Start lot button on the first tap (`data-lock-on-submit`), so a second tap sends nothing while the first is in flight; the server guard stands behind it for the no-script case.
3. The resume list names each lot in the viewer's local clock (YYYY-MM-DD HH:MM) with its Move To (a record-borne truck by number), its Team Lead and its total, so two lots born seconds apart tell apart.

## What changed

- `src/config.ts`: `START_LOT_REPEAT_WINDOW_SECONDS` (60).
- `src/actions.ts`: `createWetWeight` looks for the empty twin before the insert and redirects to it with `repeat=1`.
- `src/db.ts`: `listLotsByStatus` carries truck_number, dry space name and team_lead (LotSummary).
- `src/html.ts`: the resume list markup with `<time data-local>`, Move To, Team Lead; `lockOnSubmitScript`, `localTimeScript`; the station header form marked `data-lock-on-submit`.
- `src/index.ts`: the `repeat=1` flash.
- `src/i18n.ts`: the flash line, EN and ES.
- `test/start_taps.test.ts` (+6): the window; the repeat lands and mints nothing (case-blind lead); a weighted twin, an old twin, another lead, another truck, a silo header, a voided and a finished twin all mint; the scripts. `test/surface.test.ts`: the resume list pin rewritten for the new label and the lock.
- `scripts/smoke.mjs`: a second identical tap lands on the lot just started with its flash and no resume list; the header form locks; the resume list reads local time, Move To and Team Lead. The duplicate-lot-guard walk's second lot now names its own Team Lead (the real two-lots case; the same header again would land on the empty first lot by this law).

No migration; no route change.

## The floor cleanup (his hands)

The two empty lots on 26020: Admin, Data Queues, Weighing Queue, Void with a reason. The two with weight: both stay if both are real PNS lots; if one is a duplicate the crew weighed into by mistake, his word on which, and whether its weights should move to the other.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 29 files, 635 tests passed.
- From-zero smoke: "About to apply 52 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.

## Deploy (his hands)

Ships with THE TRIMMING SECTION (0.30.88), whose migration 0052 rides the same deploy: from `app/`, the probe, `npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote`, `npm run deploy:grip`.

## Sealed final check

```
src/config.ts               41630  23383e284fd35d80
src/actions.ts             228077  edb230127dfe303d
src/db.ts                  125245  c522f7d765da19a3
src/html.ts                168098  6dbd31eed78bc529
src/index.ts               112748  7ca2ec852ce65796
src/i18n.ts                109297  dda70a65f2d90c37
test/start_taps.test.ts      7313  78994754ff861921
test/surface.test.ts        80917  2ae07ff4f66c967e
scripts/smoke.mjs          379860  63f26eaef3f0014f
tsc: 0 errors; vitest: 29 files, 635 tests passed
smoke: About to apply 52 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
