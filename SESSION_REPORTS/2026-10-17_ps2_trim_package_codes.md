# PS2: trim package codes on the pasteurization label (2026-10-17)

Worktree branches/GFLiteMetrcAPI. Pin as received, the recipe's hash in app/ (Linux two-space sha256sum, wrangler.toml read as LF): d609c739a3bc303d, 391 files (PS1 live plus the repair file). Final tree 3677f9b00573d11e, 391 files. No git. Nothing is committed, pushed, or deployed. No migration. canon/ and prompts/ were not edited. The repair file was not edited.

## What an operator sees

Line 1 of a pasteurization run is the lot, the distinct 5 digit package codes on its trim containers, and the container count. The codes read in ascending order, comma separated. An Available HBN uses the codes on the containers that group lists. A run with no 5 digit code reads "no code" (ES "sin codigo").

When the mirror has any package for that HBN, a code that is not the last 5 of a WIP item from that harvest shows with a trailing ? and the title "Not a METRC package from this harvest". When the mirror has no row for the HBN, every code shows plain. The harvest package metrc_tag is no longer read for the label. New Packages files are unchanged.

On a finished, picked run, Add Shake and its form sit directly under the pool table and above the consumed containers list.

## Files

| file | bytes | sha256 | state |
| --- | ---: | --- | --- |
| app/src/cryo.ts | 32078 | 848537da70148669 | edited |
| app/src/db.ts | 233738 | 33d12abbf076e2fd | edited |
| app/src/scheduling.ts | 48387 | db8242481cf276de | edited |
| app/src/i18n.ts | 368396 | d029f280a179770e | edited |
| app/test/cryo.test.ts | 58247 | 3acb055244ed7a8d | edited |
| app/scripts/smoke.mjs | 898058 | 178b1cdb6cc95b41 | edited |

Dash and CR scan of those six files: U+2013 0, U+2014 0, CR 0. The new lines add no personnel names.

The codes and the mirror check are two grouped reads per list (containers, then metrc_packages), chunked at 100 binds. The available read uses one bind for the cryo-queue status, so its id chunk is 99. No index was added. A local table of 14,500 metrc_packages rows, filtered by source_harvests for 80 harvests, answered in about 10 ms. There is no live-sized bench in this worktree, so there is no page time from the floor.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  112 passed (112)
Tests  1622 passed | 6 skipped (1628)
```

Vitest TZ=America/New_York (`--maxWorkers=4`):

```
Test Files  112 passed (112)
Tests  1622 passed | 6 skipped (1628)
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke: exit 0. `About to apply 104 migration(s)`. `SMOKE PASS`. Lines containing ` 500 `: 0. Lines containing ` 503 `: 1 (`POST /api/send`, the smoke's own step).

Static renders of the cryo station (working, and finished with Add Shake open) and the Pasteurization scheduling page, in Lite, CO, and Cerberus, at 1920 and at 820. Scroll width equaled client width on each. On every finished render, Add Shake sits under the pool and above the consumed containers. The marked code shows `56833?` with the title.

Final tree 3677f9b00573d11e. Nothing is committed, pushed, or deployed. The Scribe gates; the owner merges.
