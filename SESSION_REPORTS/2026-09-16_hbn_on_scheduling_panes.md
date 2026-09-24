# 2026-09-16 The HBN on the scheduling panes (canon 0.30.102)

Scribe sitting, built Scribe-direct under G-2 (a display change inside the standing renderer). Owner ruling 2026-09-16, verbatim: "Need the HBN listed on the left pane of the scheduling nodes.  The information in there isn't pointing us in the right place." His picks at the fork: the full HBN only (the farm / strain / date label goes away), on all three panes. Worker-only deploy; no migration.

## The law, as built

1. Every HBN group on the Trimming and Pasteurization stations heads with the full HBN alone (26257-PNN-OD-070-0-01-26018), on the Available, Scheduled and Complete panes alike. The build hand's simple label (farm_code / strain / entry_date) is gone from the station and from the type.
2. The item rows are unchanged: a Trimming row still reads short lot id / strain / dry total g / born package code, a Pasteurization row package code / type / weight g.
3. The heading is sized to sit on one line in a 16rem pane (0.95rem, bold, tabular figures, no letter-spacing or uppercase from the sheet) and to break at a hyphen, never mid-token, when a pane runs narrower. Shared by all three sheets through the walk-slice chrome.

## What changed

- `src/db.ts`: `ScheduleHbnGroup` loses `simpleLabel`; `simpleHbnLabel` removed; `groupScheduleByHbn` no longer builds the label. The loaders and identity lines are untouched.
- `src/scheduling.ts`: one `groupHeading(group)` (the escaped HBN) heads the available summary line, the working group and the complete group.
- `src/theme.ts`: `.schedule-hbn-line, .schedule-hbn-label` sizing and `.schedule-hbn-label` margin in the shared block beside the other scheduling rules.
- `test/scheduling.test.ts`: the fixture drops the label; the available test pins `<span class="schedule-hbn-line">26251-ARL-GH-027-0-NA-26011 <span class="tile-count">2</span></span>` and the absence of the farm / strain / date line; the working and complete tests pin `<h3 class="schedule-hbn-label">26251-ARL-GH-027-0-NA-26011</h3>`.
- `scripts/smoke.mjs`: the Trimming walk asserts the available group heads with the picked HBN and not with a `XXX / ` label, and the working group heads with the HBN after `>>`.

## Visual pass

The Scribe's fixture through `schedulingPage` and `themeStylesheet`: lite, cerberus and co at 1280; lite at 700 (two panes then one); the phone stack at 420 with `body.device-phone`. The HBN heads every group on every pane in every sheet; the Scheduled and Complete headings sit on one line; the Available summary shares its line with the count and the `>>` control and, where the sandbox font runs wide, breaks once at a hyphen so the serial stands on the second line. No horizontal scroll in any frame (scrollWidth equals the viewport). Dash audit 0 on the rendered pages.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 31 files, 660 tests passed.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=8983, before the theme sizing): `About to apply 56 migration(s)`, `SMOKE PASS`. Re-run after the theme sizing (SMOKE_PORT=8985): see the sealed check.
- Dash audit: 0 on every file below.

## Deploy (his hands, worker only)

From `app/`: `npm run deploy:grip`. No migration. Paste the Version ID back and the Scribe folds LIVE.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        31 files, 660 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=8985 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 56 migration(s); SMOKE PASS

src/db.ts                     139563  1dc1743d75792cbe
src/scheduling.ts               8762  9c819769ca8026e8
src/theme.ts                  139163  53cb364f3ff64e5e
test/scheduling.test.ts         9191  49b2cb9825e6aee0
scripts/smoke.mjs             406640  62087002797a84df
tsc: 0 errors; vitest: 31 files, 660 tests passed
smoke: About to apply 56 migration(s); SMOKE PASS (SMOKE_PORT=8983 before the theme sizing, SMOKE_PORT=8985 after)
dash audit: 0 on every file above
```
