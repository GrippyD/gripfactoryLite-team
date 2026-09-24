# 2026-09-16 THE EFFECTIVE DATE PER STATION (canon 0.30.94)

Scribe-direct under G-2. Owner ruling 2026-09-16, verbatim:

> Each station should have its own effective date field.  It's always the source data for the transaction date.  It defaults to (today).  It can be changed with a PIN

This generalizes THE EFFECTIVE DATE (0.30.92), which put the field on Load Silo, to every station. His picks on the two forks (AskUserQuestion): where a station already has a date field the Effective Date becomes that date (Trim's trim date, Cryo's cryo date), and Acquire HBN's harvest date stays free (it mints the HBN token and backdating there is routine).

## The law

1. Every station carries one Effective Date field, the source of that station's transaction date. It defaults to today (the farm's day, Eastern) and needs no touch on an ordinary day; the Admin PIN (app_config admin_pin, 21319) sets any other day, never a day ahead of today. The posted field is always named effective_date, with effective_pin beside it; the station's action writes the resolved date to its own column. Every write under a non-today date carries a change-log marker (field effective_date, reason "effective date set under the Admin PIN"), so a backdate is never silent.
2. The field is declarative: a FieldDef `input: "effective_date"` in the pipeline registry renders the effective.ts component, and the station action resolves it with `resolveEffectiveDate`. The synchronous field renderer has no instant, so the date renders blank and the client fills today, its max and its default; a blank still resolves to today on the server, and the server is the gate (the PIN check and the not-ahead-of-today check are server-side).
3. The stations:
   - Wet Weight (Start lot): the field is on the header; the lot's transaction date stores on `wet_weight_entries.effective_date`. A routine Start lot tap needs no touch (today).
   - Unload Dry Space: the field is on the session line; the unload's date stores on `unload_sessions.effective_date`. Only a form carrying an effective_date value touches it, so a weight-add (its form has none) never clobbers the session's set date.
   - Trim Packages: the old trim date IS the Effective Date now; it writes each package's `trim_date`. The Trimming console (0.30.88) still buckets by trim_date, so a backdated entry lands on the right day.
   - Cryo Weight: the old cryo date IS the Effective Date now; it writes each package's `cryo_date`.
   - Load Silo: already carried it (0.30.92); the loaded_at is its transaction date.
   - Acquire HBN: unchanged; its harvest date stays free.
4. The audit `created_at` stays the honest instant everywhere; the Effective Date is the business date beside it.

## What changed

- `migrations/0053_effective_date.sql`: `effective_date` on wet_weight_entries and unload_sessions (Trim, Cryo and Load Silo already store their date). Append-only, Postgres-portable.
- `src/effective.ts`: `effectiveDateField(nowIso | null, locale, hint?, current?)` gains the client-defaulted path (null instant; the client fills today, max and default) and a stored-value render (a backdated unload session); `effectiveDateScript` iterates every field on the page and fills the auto ones; `effectiveOverrideLog` (one marker per record written under a non-today date).
- `src/pipeline.ts`: the FieldDef `input: "effective_date"`; Trim's and Cryo's date fields become it; Wet Weight gains it.
- `src/html.ts`: `renderField` emits the effective component for `input: "effective_date"`; the unload session form carries the field with its stored value.
- `src/db.ts`: `UnloadSessionRow.effective_date`; `getOpenUnloadSession` selects it.
- `src/actions.ts`: `createTrimPackages` and `setCryoWeight` resolve the Effective Date and write trim_date / cryo_date with an override marker per package; `createWetWeight` stores effective_date on the lot; `ensureUnloadSession` stores it on the session (create) and updates it on save (a form that carries the value), never on a weight-add; the dead `entryDateOrToday` retired.
- `src/i18n.ts`: the four per-station hints, EN and ES.
- Tests: `test/effective.test.ts` (+3: each station carries one effective_date field, renderField emits the client-defaulted component, a stored value renders as the field's value); `test/trim.test.ts`, `test/surface.test.ts` (the Trim/Cryo forms now show the effective component); `test/gate.test.ts` (the trim fixture posts effective_date + the Admin PIN, makeTrimDb answers app_config).
- `scripts/smoke.mjs`: the from-zero pin is 53 migrations; the Trim and Cryo backdated posts carry effective_date + the Admin PIN; a Cryo backdate without the PIN is 403 in words; the Wet Weight Start lot carries the field and a backdate without the PIN is 403 (a fresh Team Lead so the repeat guard does not take it for a twin); the Unload session carries the field, a backdate under the PIN sticks on the session and reads back, and a weight-add does not clobber it.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 30 files, 645 tests passed.
- From-zero smoke: "About to apply 53 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.
- Visual pass: the client-defaulted Effective Date on a station form (Lite, Cerberus, Continuum); the client fills today, the summary reads it and the state reads "(today)"; opened, the date and the Admin PIN stack with the per-station hint.

## Errors found and fixed in the build

- The Wet Weight INSERT carried one extra placeholder after adding effective_date (16 `?` for 15 binds, 20 value tokens for 19 columns), which answered 500 on the first Start lot; found by reading the D1 path on the smoke's leftover database, fixed to 15 placeholders. tsc did not catch it (the SQL is a string); the smoke did.

## Deploy (his hands, WITH the migration)

From `app/`:

```
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
migrations/0053_effective_date.sql    900  82f4ab804741e184
src/effective.ts                     6987  0f07bfcae9d6c85d
src/pipeline.ts                     46026  e358740650128d27
src/html.ts                        168748  bb5e05729e7a0f23
src/db.ts                          125379  433237c3cd0b1675
src/actions.ts                     232293  6873d9292bc063e7
src/i18n.ts                        111365  231ce030f8ab4d37
test/effective.test.ts              10326  67a0c50b8a71baa7
test/trim.test.ts                   13425  cea381ec31b4d99a
test/surface.test.ts                81172  772c5bf0dc326b8f
test/gate.test.ts                   28275  3bb4642069be0111
scripts/smoke.mjs                  390297  8e57dfd0357dde13
tsc: 0 errors; vitest: 30 files, 645 tests passed
smoke: About to apply 53 migration(s); SMOKE PASS
dash audit: 0 on every file above; sha256 identical on the device for all twelve
```
