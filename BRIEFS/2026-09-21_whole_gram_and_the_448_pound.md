# BRIEF A: THE WHOLE GRAM AND THE 448 POUND (canon 0.30.164, general items 1 and 2)

For a build session (Claude Code or Cursor) in `app/`, under THE DISPATCH RULE (canon 0.30.155). Read `CLAUDE.md`, then `canon/_NOW.md`, `canon/MEMORY.md`, `canon/CANON.md` (rows 0.30.164 and the pound rows it overrides) before a line is written. Guardrails: no git remotes or pushes (G-1); no em or en dashes anywhere you write (G-8); ship-clean (G-9); a sealed session report (G-10); migrations append-only. No migration is needed here. Never deploy; the Scribe hands the owner the block. This brief is independent of briefs B and C and should land first: they inherit its formatting.

## The ruling (owner, 2026-09-21, verbatim)

"1. Remove all decimals for gram weights.
2. Universal rule 1 lb ALWAYS = 448 grams for conversion (override all previous rules in canon regarding this conversion)"

His pick on the question tool: decimals go from "Storage too" (offered: display only).

## The law to build

1. THE WHOLE GRAM, SHOWN: every gram figure shown to a person (pages, tiles, feeds' labels, the console, CSVs meant for people, flashes and refusals) is a whole number with thousands separators: `formatGrams` returns whole grams (round half up, no decimals). Pounds keep two decimals (his rule names grams alone). Percentages, hours and money are untouched.
2. THE WHOLE GRAM, STORED: from this deploy every gram value that enters through a form, a CSV import, a feed or an action rounds to a whole gram at the door: `roundGrams` rounds to an integer, and the sums (`sumGrams`) stay exact in whole grams. Values already stored keep their decimals (no migration rewrites history); they display rounded. The METRC mirror keeps what METRC sends (its quantities are METRC's, not ours). Feeds for machines (`/feeds/trim-weighs.json`, `/silos/live.json`) send the stored numbers as they are.
3. THE 448 POUND: one pound is 448 grams everywhere (the trade's pound, 16 ounces at 28 grams: `src/zohoinv.ts` already carries `ZOHO_GRAMS_PER_LB = 448`). One constant, `GRAMS_PER_LB = 448`, exported from `src/config.ts`; `src/silo.ts` `LB_GRAMS` and `src/compliance.ts` `GRAMS_PER_LB` (both 453.59237 today) and `ZOHO_GRAMS_PER_LB` become re-exports of it, so no second number survives. Silo and room capacities typed in pounds (15,000 lb, the FFZ cube's 4,800 lb, any app_config `*_capacity_lbs`) convert at 448. Every gram-to-pound and pound-to-gram path in the app follows: `gramsToLbs`, `formatLbs`, the hours math (Lbs/DLH), the console's pounds, the Zoho pane, the FFZ tile.
4. METRC-FACING WEIGHTS: nothing sent to or prepared for METRC is converted at 448. A CSV or a future API payload that carries a weight for METRC carries grams (unit "Grams"); where METRC demands pounds the value is METRC's own conversion (453.59237) and the code says so in a comment naming this rule. The Scribe's assumption for his word: he ruled the house conversion, not METRC's arithmetic.
5. THE OVERRIDE: canon rows that name 453.59237 or a two-decimal gram display (0.30.6x silo capacities, the trim feed, the console) are superseded on these two points alone; everything else in them stands.

## Files

- `src/config.ts`: `GRAMS_PER_LB = 448`; `formatGrams` to whole grams; `roundGrams` to integers; `sumGrams` in whole grams; a note under each naming the rule. `formatGramsWhole` becomes the same as `formatGrams` (keep the export).
- `src/silo.ts`, `src/compliance.ts`, `src/zohoinv.ts`: the constants re-exported from config; every capacity conversion through it.
- Every module that formats grams inherits the change; grep `formatGrams(`, `roundGrams(`, `toFixed(2)` on gram values, `LB_GRAMS`, `GRAMS_PER_LB`, `453.59` and fix the strays (there are about 85 `formatGrams` call sites and 10 constant uses).
- Tests and smoke: every `x.xx g` pin (about 140 in `test/` and `scripts/smoke.mjs`) becomes whole grams; every pound pin recomputes at 448 (for example 50 g reads 0.11 lb, 1,234.56 g stored reads 1,235 g shown and 2.76 lb; 15,000 lb of capacity is 6,720,000 g); the smoke's `capacity must scale 15,000 lbs wet` pin uses 448.
- `src/i18n.ts`: any string that spells a two-decimal gram example.

## Gates and the hand-back

`npx tsc --noEmit` (0); `npx vitest run` and `TZ=America/New_York npx vitest run` (all green); `node --check scripts/smoke.mjs`; the from-zero smoke (`rm -rf .smoke-persist && SMOKE_PORT=<fresh 90xx> WRANGLER_SEND_METRICS=false timeout 285 npm run smoke`, exit 124 normal, `SMOKE PASS`, zero ` 500 ` lines, the migration count unchanged); the dash audit reading 0 on every file touched; `grep -rn "453.59" src scripts test` finding only the METRC-facing comment of law 4. Report `SESSION_REPORTS/<date>_whole_gram_448.md` with the sealed final check. Do not deploy.
