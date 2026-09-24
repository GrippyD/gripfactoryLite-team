# 2026-09-16 THE EFFECTIVE DATE (canon 0.30.92)

Scribe-direct under G-2. Two owner rulings 2026-09-16, minutes apart, verbatim:

> We need to quickly add a date override in the load silo screen - PIN gated: 21319
>
> Correcting for the issues from yesterday has made it impossible for me to load the silos at their proper time because the default date is today.

> Next move
> "Effective Date" = field on all transactional records - always pin gated - defaults to today and rarely needs to be touched.

The first is the floor need of the hour: after THE RECORD CORRECTED (0.30.91) lots 26018 and 26019 wait in the barn to be loaded into Silos 5 and 4 at the time they were really loaded, and the Load Silo form's Start time (canon 0.30.9) is HH:MM on today only. The second is the law the fix belongs to. Built as one: the Effective Date field, with Load Silo as its first record.

## The law

1. Effective Date is a field on a transactional record's form. It defaults to today (the farm's day, Eastern) and rarely needs to be touched: it renders collapsed, one line reading "Effective Date: YYYY-MM-DD (today)".
2. Opened, it offers the date (capped at today) and an Admin PIN box. Any day other than today is honored only with the Admin PIN (app_config admin_pin, 21319) typed beside it, and never a day ahead of today. Blank, absent or today itself asks no PIN.
3. The record's own instant falls on that day. On Load Silo the typed Start time (24h) on the Effective Date is the loaded time and the clock's zero; another day requires the Start time (a blank time is refused in words, not guessed). Under the PIN any day back is allowed; the two-day floor of 0.30.9 stays for the crew's ordinary post. The browser's resolved instant is taken when it agrees with the day (loaded_at_iso); without one (no script) the farm's clock resolves the typed time (`etInstant`).
4. Every write under another day leaves a change-log row with the reason "effective date set under the Admin PIN" (SYSTEM_REASON.effective_date), so the override is never silent.
5. Load Silo is the first record on the field. The same field, same names (effective_date, effective_pin), same reason and same helper go on the other transactional records next; that walk is the open build, below.

## What changed

- `src/farmday.ts` (new, a leaf): the Eastern day helpers moved out of console.ts (`etDate`, `dayBefore`, `etDayBounds`, `FARM_TIME_ZONE`) plus `isCalendarDate` and `etInstant(date, hhmm)` (two-pass offset, a daylight-saving edge settles). `src/console.ts` imports and re-exports them, so its readers and tests keep their import.
- `src/effective.ts` (new): `EFFECTIVE_DATE_FIELD`, `EFFECTIVE_PIN_FIELD`, `effectiveDateField(nowIso, locale, hint)` (the collapsed details block and its summary script), `resolveEffectiveDate(db, form, nowIso)` (today / another day under the PIN / refusals 400 and 403), `EFFECTIVE_DATE_REASON`.
- `src/config.ts`: `SYSTEM_REASON.effective_date`.
- `src/actions.ts`: `resolveLoadedAt` takes the effective day (any day back, the instant must fall on it, ahead of now still refuses); `loadSilo` resolves the Effective Date, requires the Start time with another day, and logs the override row.
- `src/drying.ts`: the field under the Start time on the load form; `loadedAtScript` composes the instant from the picked day and the typed time (today when none).
- `src/theme.ts` x3: `.effective-date` spacing, the summary as the tap target with each theme's focus ring.
- `src/i18n.ts`: the field's strings, EN and ES.
- `test/effective.test.ts` (new, +7): `etInstant` both offsets and bad shapes; `isCalendarDate`; the field's markup EN and ES; the post (today needs no PIN, the farm's day at 03:30Z, another day under the PIN, 403 without or with the Models PIN, 400 ahead or malformed, a missing admin_pin opens nothing); the loaded time on the day, the no-script path, the mismatch refusal, the old two-day floor. `test/drying.test.ts`: the load form pins the field between the Start time and the button.
- `scripts/smoke.mjs`: the Effective Date walk on the second PNN lot into Silo 1: the field reads today; yesterday without the PIN 403 in words; with the Models PIN 403; with the Admin PIN and no Start time 400 in words; tomorrow 400 in words; four refusals load nothing; yesterday 20:30 under the PIN loads (303) and the load page reads the Eastern instant of 20:30 on that day; the change log carries the effective_date reason. The farm's clock is replicated in the smoke (`etDateSmoke`, `etInstantSmoke`).

No migration; no route change.

## Visual pass

The load form in Lite, Continuum and Cerberus: collapsed, "Effective Date: 2026-09-16 (today)" sits between the clock line and the Load silo button; opened with 2026-09-15 and the PIN typed, the summary reads "(changed, Admin PIN)", the date and PIN stack as fields, the hint line names the law and the Start time rule.

## Open for the owner (the next build)

The walk of the transactional records, each getting the same field: Start lot (the lot's day), Finish lot, the wet truck receive, Unload (the unload session and the dry weights), Trim Packages Entry, Acquire HBN, the interco manifests and receipts, package adjust and split, cryo, testing and release. His word on two: a record that already carries a typed business date (Acquire HBN entry_date, Trim Packages trim_date) either takes the same PIN gate on any day other than today, or stays as it is; and whether the Effective Date on a station with several posts (Start lot, then weights, then Finish) rides the header once or asks at each post.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 30 files, 642 tests passed.
- From-zero smoke: "About to apply 52 migration(s)", SMOKE PASS (twice: before and after the theme rules).
- Dash audit: 0 on every changed file.

## Deploy (his hands, worker-only)

From `app/`: `npm run deploy:grip`.

## Sealed final check

```
src/farmday.ts                 3610  1a6df68a649ecfb5
src/effective.ts               4881  984daaa2c23ebc9a
src/console.ts                34809  77db170235e6fda7
src/config.ts                 41848  757560d835f034c2
src/actions.ts               230002  d4f345ce3e32bedf
src/drying.ts                 17713  360b22fdc7fc8c24
src/i18n.ts                  110096  c0327ca3202f7c80
src/theme.ts                 137502  715186a7cdd34bd0
test/effective.test.ts         7874  1153d25c4417c3a0
test/drying.test.ts           14388  7c1149f4039a65a7
scripts/smoke.mjs            385649  5bf4552306fe7202
tsc: 0 errors; vitest: 30 files, 642 tests passed
smoke: About to apply 52 migration(s); SMOKE PASS
dash audit: 0 on every file above; sha256 identical on the device for all eleven
```
