# 2026-09-25 The drying schedule

Brief M, canon 0.30.226, part two only: the drying schedule, built under THE DISPATCH RULE (canon 0.30.155). The starting tree already had part one (the truck record) and brief N (the prepack headings) live. No migration; the head stays 0075. Not deployed. Nothing committed.

## What landed

**The surfaces.** `SCHEDULE_STAGES` has three new stages, `silos`, `dry_rooms` and `freezers`, titled Silos, Dry Rooms and Freezers. Each is served at `/production/scheduling/<stage>` and maps to one space type (silo, dry_room, freezer).
- `parseScheduleStage` still accepts only the three lines. The new `parseDryingStage` accepts only the three surfaces. So the schedule, unschedule, complete and unfinish routes answer 404 on a drying stage, and no `production_schedules` row is ever written for one.
- There is no new table. The surfaces read `listBarnWetLots`, `loadSiloVisuals` (the rows the tiles already read) and a new reader, `listDryingComplete`.
- The silo strip sits above each surface, as on every Drying Operations page, and its script keeps the clocks ticking.
- The Drying Operations landing has three new tiles (Silos, Dry Rooms, Freezers) after its stations. Each surface's crumb leads back to Drying Operations.

Each surface is a `.station-triple` of three panes.

**Available** lists every lot Load Silo lists (drying, no open load), on all three surfaces, grouped by HBN. Each row shows:
- the lot's Load Silo label (`Truck <n> - <hbn>` when the lot has a truck number);
- the wet grams;
- the planned space. This is the lot's own space when Move To named a loadable space, else the HBN's planned silo (the same rule Load Silo uses to preselect). The row reads `planned here` when that space is of this surface's type.

`>>` opens `/station/load_silo?pick=<lot>&kind=<type>`, adding `&space=<planned>` when the planned space is of this type. Opened with `kind`, Load Silo's picked form:
- lists only spaces of that type and labels its select by the type;
- preselects `space` when it is free;
- says so, and keeps the Load button disabled, when no space of the type exists;
- carries a hidden `next` naming the surface, and `loadSilo` then returns there with `ok=drying_loaded` (the flash is Load Silo's own line).

Without `kind` the page is unchanged. Without `next` every redirect is unchanged.

**Working** lists the open loads of this type's spaces under each space, oldest load first. Each row shows:
- the label and the wet grams;
- the tile clock (`clockMarkup`, now exported);
- Start and Pause/Resume, exactly as on Load Silo. They carry `next`, so they return to the surface;
- `>`, which opens `/station/unload_dry_space?pick=<lot>`.

A space whose open loads hold two or more lots shows `Unload together`, except a freezer.

**Complete** lists this type's lots unloaded in the last seven farm days (today included), grouped by space. Each row shows the dry grams, the yield (dry over wet, one decimal) and the unload's day. A freezer row reads `Line removed`.

**The joint unload.** `?together=<space>` opens the form inside that space's Working group.
- The form lists the lots in share order with their wet grams. It asks once for the total dry grams, the operator, the effective day (any other day needs the Admin PIN), and the gate's choice: Queue an adjustment CSV, or Nothing, just finish.
- The material shows as a plain line reading Bucked. Every loadable space is kind silo, which forces bucked, so there is no on-site question.
- The load ids ride along with the form, and the first tap locks the button (THE FOUR START TAPS).

POST `/production/scheduling/<stage>/unload_together/<space>` refuses and writes nothing when:
- the open loads hold fewer than two lots;
- the space is a freezer, or not of this surface's type;
- the group changed since the form opened (409);
- a lot already has dry weights, is not drying, or was moved to another space by the pencil after loading;
- the total is not above zero;
- the gate would open and no choice was given;
- the loads carry no wet grams, or a share would go negative;
- the day is backdated without the PIN;
- the posted group was already unloaded together, as when Back and resubmit repeat the post (409).

Otherwise it shares the total one per lot, with `jointUnloadShares`: the total times the lot's wet grams over the group's wet grams, in whole grams, rounded half up, the lot loaded last taking the remainder so the shares sum to the total. A lot that holds two open loads in the space counts once. Then one batch does, for each lot:
- writes one `dry_weights` row with its share. The row is keyed by the lot's load id, so a repeated post of the same group collides and its whole batch rolls back (409). The row also binds its lot only while the lot is still drying with no live dry weight, so a weigh-in or finish on Unload Dry Space that lands mid-unload rolls the batch back too (409, in words);
- recomputes the lot total;
- runs `finishUnload`'s own finish statements.

The results:
- The lots go drying to unloaded and their loads end.
- Their sessions finish with the operator, the day and the choice (`exact` for a lot that matched).
- Each package takes its share at the space's site barn, and the package file pends as before.
- The status, reconcile choice and dry weight rows carry one reason, `joint unload: <space> (<short ids>)`.
- After a queued adjustment the redirect goes to `/admin/uploads?ok=adjust_queued`, as `finishUnload`'s does (canon 0.30.1 fork 8). Otherwise it goes to `<surface>?ok=unloaded_together&n=<lots>`.

**finishUnload** is split into `readUnloadLot`, `resolveUnloadFinish` and `unloadFinishStmts`, with the original body moved in verbatim so the joint unload runs the same code. Every read, write, refusal, log reason and redirect on the single-lot path is unchanged, and the freezer branch is untouched.

## Assumptions for your word

1. Available shows every waiting lot on all three surfaces, since any lot may go to any space. `planned here` marks the lots planned for a space of this type, and their `>>` preselects that space. I read the brief's test line "not on Dry Rooms unless it is planned there" as this marker, not as a filter.
2. Complete covers today and the six farm days before it (the farm day starts at 6, Eastern).
   - The window is keyed on when the unload happened: the latest finished unload session, or for a freezer the latest ended load.
   - The day shown is the session's effective date, else the farm day of that moment.
   - A lot that has moved on to trim still shows. A lot demoted back to drying does not.
   - A lot that was never loaded and has no finished session (a freezer lot never loaded) does not show.
3. The joint unload's remainder goes to the last lot, meaning the one loaded most recently (ties broken by load id). The form lists the lots in that order.
4. The gate's choice is asked once and applies to every lot. A lot whose share happens to match its package logs `exact`, as `finishUnload` does. `back` is not offered.
5. A freezer has no Unload together: the brief says its branch "needs no joint form", so its lines are removed one lot at a time on Unload Dry Space. A one-press removal of every line in a freezer would be a later slice.
6. The package qty and location rows keep `inv_unload_adjust`, because the adjustment file finds its quantity by that exact reason. Every other row the joint unload writes carries the group reason. The session rows that `ensureUnloadSession` opens still log under `create`, as they do on Unload Dry Space.
7. A lot that already has dry weights on Unload Dry Space is refused: it finishes there, or its weights are voided first. The joint unload writes a single share row per lot.
8. The unload sessions are opened or updated one lot at a time just before the batch, as `finishUnload` does for its own lot. So a joint unload that rolls back can still leave an empty open session behind. It can also have written the form's operator and day onto a lot's open session. That empty session is the same kind the Unload Dry Space page opens on sight, and nothing pends from an unfinished session. The refusal words say no lot was unloaded, which is exact.
9. Yield is dry over wet, one decimal, rounded half up, and blank when either is missing.
10. The middle pane is headed Working, as the brief names it; the lines head it Scheduled. The three tiles sit on the Drying Operations landing only; the Production Scheduling landing keeps its three line tiles.

## The review

An adversarial review ran over the diff: five lenses (brief, refactor, joint unload, surfaces, routes), each finding put to two skeptics. It confirmed four defects, now fixed and pinned by tests:
- a queued joint adjustment returned to the surface instead of `/admin/uploads`;
- a double tap could write every share twice;
- a lot moved by the pencil after loading was finished against its new space;
- a lot holding two open loads was counted twice.

Three more claims were refuted by both skeptics:
- freezers carry no joint unload (the brief's own sentence);
- Available lists every lot (canon 0.30.226);
- a whitespace-only line in Load Silo's markup.

A second pass reviewed the fixes. It confirmed `finishUnload` is behavior-identical and found no high or medium defect. It found two low ones, now fixed and tested:
- a weigh-in on Unload Dry Space landing mid-unload could leave the lot's totals mismatched (now the in-batch guard);
- a repeat post after commit got a misleading "holds 0" refusal.

A third pass over that patch found no defect. Its one wording point, that "nothing was written" overstated the refusal, is now exact.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 55 files, 903 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9160`, `WRANGLER_SEND_METRICS=false`): `About to apply 75 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The walk covers the following:
  - The two split lots of part one ride Available on Silos as `Truck 1 - <hbn>`. They load from that surface's `>>`: the picked form offers silos only and carries the return. They land in two different silos, and the post returns to Silos.
  - The three surfaces answer 200 with their panes under the strip. Each split lot sits alone under its silo in Working, with the clock. Pause and Resume return to Silos. No one-load silo carries Unload together.
  - The Drying Operations landing shows the three tiles. `/production/scheduling/nope` and a drying stage's `/schedule` answer 404.
  - Two lots load into the Arlington Dry Room from the Dry Rooms surface, the room preselected for the lot planned there. The room carries Unload together, and a one-load silo refuses it (400).
  - The joint form locks on the first tap. Unloaded together with 602 g, both lots land on Complete with whole-gram dry grams summing to 602, each within 1 g of its pro rata share. Both leave the dry queue, `/log` carries `joint unload: Arlington Dry Room`, and the same post again answers 409.
- Dash audit: 0 on every file below and on this report (U+2014 and U+2013). No CR bytes; the tree keeps LF.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "` and `cfas[t]_` appear in no file under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.
- No migration. `migrations/` is identical to the starting tree (75 files, head `0075_tote_hbn.sql`). `wrangler.toml`, `package.json`, `scripts/repairs/` and `src/vendor/` did not move. The twelve files below are the only files that changed.

## Deploy

Not deployed from this session. Nothing committed. The head is 0075. The Scribe hands the worker-only deploy line.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        55 files, 903 tests passed
TZ=America/New_York npx vitest run    55 files, 903 tests passed
node --check scripts/smoke.mjs        exit 0
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9160 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

src/config.ts                     68858  198d61b3b30e9834  tail: }
src/ledger.ts                      9841  aa3b477d9fa26ce1  tail: export { ITEM_KIND_SPR, ITEM_KIND_WIP, LICENSE_AU_GROW, LOC_BARN, LOC_CSB, LOC_IN_TRANSIT };
src/db.ts                        170687  241ec7b2ad39137e  tail: }
src/drying.ts                     26877  bc8f8f366507ce9a  tail: }
src/scheduling.ts                 38157  1bde3a36cf853951  tail: }
src/actions.ts                   334933  03c1b0ec380eda8d  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
src/index.ts                     138889  92f81f70fb5b7eb5  tail: export default worker;
src/pipeline.ts                   50734  beb966a2169b1a4b  tail: }
src/i18n.ts                      173215  b16ec18d2a0527e5  tail: }
test/dryingschedule.test.ts       42637  dc81c6590e41f26f  tail: });
test/scheduling.test.ts           24374  6c3a85648b146504  tail: });
scripts/smoke.mjs                603049  ce6875f241243d05  tail: });
```
