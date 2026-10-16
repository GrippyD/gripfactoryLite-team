# DD S2c: the weekly check-in (make the Director Dashboard forms friendly)

Filed by the Scribe on 2026-10-16 (canon 0.30.502) from the owner's word on the live S2 forms: "The forms don't really match expectations ... It's not user friendly." Shown three directions, he chose the weekly check-in: one KPI at a time, last week and the goal beside one box, and you are done when the list is done.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). Pinned to the live tree `f2c7f30bebff85eb` (DD tranche 1 live, worker 460d1455). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. No migration. LF only. Read big files by search and line range.

## The point
A director is not an engineer. Today's pages speak the database: unit codes, "Period kind", "Not entered here: bucket", "Goal ref dd_targets", "Phasing: blank, flat, or weights", a reason box on every save, 17 debate essays. S2c changes what people see and type, not what is stored. The save logic, the tables, the log and every refusal stay as S2a and S2b built them; S2c keeps the POST contract (`cell:<kpi_key>|<dim_key>`, `reason`) so the save path and its tests stand.

## 1. The check-in replaces the entry grid (same URL, `/admin/director/:dept/enter`)
- Header in words: "Farming Operations, week of Oct 12 to 18" (month: "October 2026"; quarter: "Q4 2026"; day: "Thursday, Oct 15"). Previous and next as plain arrows. A progress line: "3 of 7 done" (enterable KPIs with a live hand value for this period). Marker `data-dd-progress`.
- Cadence tabs in words: Today, This week, This month, This quarter. Show only cadences that have something to type; default to the first one with an empty card.
- One card per enterable KPI (hand or mixed), in registry order. Marker `data-dd-card="<kpi_key>"`. On each card:
  - the title in the locale, and the unit as a word (hours, pounds, grams, each, liters, $ before the number, % after it, days; count shows no unit);
  - "Last week: 9" (the previous period's value; "Last month", "Last quarter", "Yesterday" by cadence; a dash is not allowed, so show "none yet" when empty);
  - "Goal: under 10" or "Goal: at least 140" from the target in force, else the goal, read through goal_direction (at_most reads "under", at_least reads "at least"); no goal shows nothing;
  - one box for the total, large, `inputmode="decimal"` (a text unit gets a short textarea);
  - for rows whose dims include farm, a closed "By farm (optional)" section with the three farm boxes. Other dim kinds show nothing at all (drop "Not entered here: ...").
- A filled card shows a check mark and its value on one line with an Edit link that opens it. An empty card is open.
- The "?" icon becomes a small "What is this?" link to the KPI detail.
- Locked KPIs are not cards. One closed line at the bottom: "Filled in automatically: N" listing their titles with their latest value or "not yet".
- Enter in a box moves to the next empty box (small inline script, as the app already uses inline scripts; the page works without it).
- The reason: a hidden field with "Weekly check-in" (EN and ES through t()) for the current period. The box shows, required, only when the period is a past one or a posted value overwrites an existing hand value; the page says "You are changing a saved number. Say why." The house rule stands: every write carries a reason.
- One Save button; on the phone layout it sticks to the bottom of the screen. After a save: "Saved 3. 4 left." and the page opens at the first empty card. A no-op save says "Nothing changed."

## 2. The KPI detail in plain words
- Top: the title, then a short plain block: how often (Weekly), unit, goal in words, season ("All year" or "Mar 1 to May 31"), where the number comes from ("You type it", "The app fills it", "Both").
- Move goal kind, goal ref, compute key, status, definition version, config key and dims into a closed "Definition details" section.
- History as a small table: period, value (Total, then farms), goal, on goal or off goal in words.

## 3. The target form in plain words
- "Set a goal": the goal number; "Goal for each" week, month, quarter or day (the row's own kind preselected, others listed only when allowed); "Starting" date (defaults to the start of the current period).
- "Spread a yearly goal" as a closed option: "Evenly" (flat) or "Custom" (the weights box, explained in one line). Hidden unless the kind is week or month.
- "Range (optional)" closed: low and high.
- Dimension select only when the row has farm dims, labeled "Which farm (optional)".
- The stored values and refusals are S2b's; only words and layout change. Refusal messages in plain words ("A goal for that week already starts on that date.").

## 4. The questions page is the owner's, and shorter
- Each card closed by default: the question in one line, the current answer, ruled or open, a Change button. The positions, recommendation and affected KPIs sit inside when opened.
- Order: open questions first, then ruled.

## 5. Not changing
The walls, the import page (it is an admin tool), the tables, the routes, the POST field names, the log, the refusals.

## Tests
- The S2a and S2b save, target, ruling and import tests keep passing unchanged (the contract holds).
- Check-in: the progress count; a filled card renders collapsed with its value; the farm section only for farm rows and no "Not entered here" text anywhere; the reason box absent on the current period with no overwrite and present for a past period; the goal reads "under" for at_most and "at least" for at_least; the unit words; locked KPIs only in the automatic list.
- The detail: the definition fields only inside the closed section. The target form: the spread option hidden on a quarter row.

## Smoke and gates
Adjust the DD smoke checks for the new markers (`data-dd-card`, `data-dd-progress`) and keep every save check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (104 migrations, SMOKE PASS, no 500); renders of the check-in (empty, half done, all done), the detail, the target form and the questions page at 1920 and 820 in Lite, CO and Cerberus, and the check-in with the phone layout on; no sideways scroll; dash, CR and name scans of every touched file.

## Hand back
Report `SESSION_REPORTS/2026-10-16_dd_s2c.md`, short, with two or three screenshots of the check-in described in words (what a director sees first). Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges.
