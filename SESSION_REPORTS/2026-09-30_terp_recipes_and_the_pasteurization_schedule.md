# 2026-09-30 Terp recipes and the pasteurization schedule

BRIEF V8, TERP RECIPES AND THE PASTEURIZATION SCHEDULE (canon 0.30.321), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on V15 and V15.1 as merged (main `ee17a5a`, the app tree `d9876ff55742ed8d`). One migration, `0084`. The smoke pin is 84. Not deployed. Nothing committed. No git was run.

## What changed

Migration `0084_terp_recipes.sql` adds `terp_recipes` (name, status `active` or `retired`, the retire columns, the audit columns), `terp_recipe_lines` (recipe, position, terp name, whole percent), and `production_schedules.terp_recipe_id` plus `terp_dose_pct`. Null on every schedule row already stored.

Terp Recipes is a lookup at `/admin/lookups/terp_recipes`, a tile in Production Operations beside Trim Bogey. The builder is the page's script: Recipe Name, then Terp Name, a whole-percent box (100 with no line below, else 100 minus the sum), "+", and Start Over. Each "+" logs a line below with a minus. An empty name or percent warns and adds nothing. A percent that would pass 100 warns and adds nothing. At exactly 100 the prompt offers Save and Start Over. Save posts the lines as hidden inputs. Without the script the same form is eight blank rows and a Save button. The server judges both: the name is required and unique among active recipes ignoring case, at least one line, each name at most 60 characters, each percent a whole number from 1 to 100, the sum exactly 100. A good save is one batch, logged with reason `create`. The list under the builder is the active recipes newest first, each with its lines, the time saved in farm time, and Retire with a required reason. Retired recipes are read-only behind Show retired, open when the page is asked with `?retired=1`. There is no edit. A retired name may be used again. Runs keep the recipe they picked by id.

On Pasteurization, each working run carries Terp recipe (the active recipes, plus No recipe) and Dose (a percent of the lot's weight, two decimals, blank allowed), with Save. The post writes both on the run and logs `terp recipe picked` and `terp dose set`. A completed run refuses the pick. A retired or unknown id is refused. A completed run shows the name and the dose read-only, or No recipe. At `>>` the new run takes the recipe of the newest pasteurization run, any status, whose HBN's market strain matches (the typed strain, else the strain's name, trimmed, ignoring case) and whose recipe is still active. That default is written on the row in the schedule's own batch. The dose is left blank. Cryo Weight Entry shows the recipe, its lines, and the dose, read-only.

## Assumptions for his word

- The order: V8 after V15 and V15.1 are merged, before V7 unless his walk of CSA and CSB lands first.
- The dose is a percent of the lot's weight to two decimals; if the crew doses in mL per pound, the unit word changes and nothing else.
- The default recipe is written on the run at `>>`, read from the newest run of the same market strain, active recipes only; the dose never carries.
- The recipe and the dose change only while the run is scheduled; a completed run's pick stands until Unfinish behind the PIN.
- The percents are whole numbers, one to one hundred (the doc's "input mask to whole number %"); a terp name is free text up to 60 characters, the consumable list his later note.
- A retired recipe's name may be reused by a new recipe; the runs keep the recipe they picked by id.
- Retire asks a reason, the house's void pattern; no recipe is ever edited or deleted.
- The builder's script holds the lines until Save; without script the plain rows; the server judges both.
- The Cryo Weight Entry header shows the run's recipe and dose read-only.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 71 files, 998 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9246`, `WRANGLER_SEND_METRICS=false`): `About to apply 84 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The lookup saves a three-line recipe totaling 100 and lists it, refuses a save at 90, refuses a duplicate active name, saves a second recipe, and retires the first with a reason under retired. The first pasteurization run takes no recipe. A pick with dose 2.50 reads back on the working row. A later run of that same HBN (the same market strain) takes the recipe at `>>` and no dose. After the retire the recipe is off the select, and a later `>>` takes none. A completed run refuses a pick. Cryo Weight Entry shows the recipe and the dose.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files. No personnel data.

## Deploy

Not deployed from this session. Nothing committed. No git was run.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run (TZ=UTC)               71 files, 998 tests passed
TZ=America/New_York npx vitest run    71 files, 998 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9246 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 84 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```

```
app/migrations/0084_terp_recipes.sql       1089  58f37c86a4b56421
TAIL CREATE INDEX production_schedules_terp_recipe ON production_schedules (terp_recipe_id);
app/src/terps.ts                          11141  9ae95c9df383a266
TAIL }
app/src/db.ts                            202200  64c680877fe60d59
TAIL }
app/src/actions.ts                       384645  29075bf54cda46c6
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/scheduling.ts                     47240  74038987dba02120
TAIL }
app/src/cryo.ts                           25382  14f5f0164a5bfe31
TAIL }
app/src/lookups.ts                        10123  8c954ca82d6c30f5
TAIL };
app/src/index.ts                         153853  814a96f75b54f5a7
TAIL export default worker;
app/src/config.ts                         74998  84b3a7620cffb46f
TAIL }
app/src/i18n.ts                          192781  a7386cb1013f498f
TAIL }
app/src/theme.ts                         176586  965037ac552fc560
TAIL }
app/scripts/smoke.mjs                    656199  e6756971f5a75649
TAIL });
app/test/terps.test.ts                    10220  e74b62a4d718bdb9
TAIL });
app/test/scheduling.test.ts               22413  09f9342339954422
TAIL });
```
