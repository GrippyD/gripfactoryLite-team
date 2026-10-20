# DD S3d: Plant Weight (2026-10-19)

Worktree `branches/GFLiteMetrcAPI`. Tree received `0a3bfd792351f997` (the S3c gated tree, 396 files). Tree left `19e48053a9283cdb`, 399 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited. The planned PPP tiles were not touched.

## What an operator sees

On the bizops wall, Testing turnaround is gone. In its slot is `bizops.plant_weight`, titled Plant Weight (ES Peso por planta), badge v1, no question mark. Four selects sit in one row on a wide screen and wrap on a narrow one: Period (7 days, 14 days, 30 days, HTD; default 14 days), Strain (All, then the strains with lots this year), Farm (All, PNN, PNS, ARL), and Grow Method (All, then the methods with lots or plants this year). The picks are remembered in the browser.

Three boxes sit side by side, and stack on the phone:

- Lbs/Plant is dry grams over plants for dried lots whose unload day is in the period, in pounds at 448 g, two decimals. Under it, the lot and plant counts.
- AVG Lbs/Plant is that same figure for the whole harvest year. With every select on All it matches the console Total dry per plant box, and a farm pick matches that farm's box.
- Projected Lbs/Plant is strain performance season pounds over plants harvested plus plants remaining. The period does not apply. Under it, "Field estimate missing for N strains" when a selected row still has plants and no estimate.

A box with no dried lots reads No data. A tap or hover on a box states the formula and the counts. The wall line now says Plant Weight is computed from this year's lots when the page loads.

`bizops.lab_turnaround_days` stays in the registry with active 0. Its sort moved from 130 to 140. Plant Weight took sort 130. `stale_after_hours` is 30, the same window as the other daily app rows. The brief did not name one.

A strain and farm whose lots share one grow method keeps the harvested pounds on that method. Standing plants always split by mirror location: a location starting with GH is greenhouse, otherwise outdoor. If a strain and farm mixes grow methods, the harvested pounds split by the lots' plant counts (the remainder stays with the heaviest share) and the remaining plants split by location. Those pairs are listed on the model. The smoke floor did not need one on the face.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0109_dd_plant_weight.sql | 1482 | 472cfb46fb9d88f4 |
| app/src/plantweight.ts | 32335 | 989f1cb64d1e674b |
| app/src/directorregistry.ts | 108456 | 80047977f11ff4c9 |
| app/src/director.ts | 96543 | 62e5eb978dd7be48 |
| app/src/theme.ts | 235912 | d254be6d28ef93ab |
| app/src/i18n.ts | 372889 | 56bf060b635b8704 |
| app/test/director.test.ts | 103993 | f46c04e517eb63a2 |
| app/test/plantweight.test.ts | 13888 | 5b5af147483d5d29 |
| app/scripts/smoke.mjs | 909030 | db4b705f7abfb029 |

Dash and CR scan of those nine files: U+2013 0, U+2014 0, CR 0. The new migration and the new tile code name nobody.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  114 passed (114)
Tests  1640 passed | 6 skipped (1646)
```

Vitest TZ=America/New_York:

```
Test Files  114 passed (114)
Tests  1640 passed | 6 skipped (1646)
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke: exit 0. `About to apply 108 migration(s)`. `SMOKE PASS`. Lines containing ` 500 `: 0. Lines containing ` 503 `: 1 (`POST /api/send`, the smoke's own step). The bizops wall showed Plant Weight, v1, and three numbers. Testing turnaround was absent there.

Browser, on the smoke database. CO, Lite, and Grip (the cerberus cookie) at 1920 and at 820: page scroll width equals the client width, the four selects sit on one line, and the three boxes sit on one line. On the phone (390, `device-phone`) the same scroll holds, the selects wrap, and the boxes stack. Period, Strain, Farm, and Grow Method were each changed once. A tap on the projected number showed the formula, ending "0 plants harvested, 1 plant remaining." Theme ink followed the sheet: Lite rgb(28, 25, 20) on a light panel, Grip rgb(244, 244, 245) on a dark panel, CO the same dark family.

## Declined

There is no live-data bench in this worktree, so there is no floor timing of `loadStrainPerformance` and nothing was cached. The wall does not call that function as a second round of reads. Season pounds come from `buildStrainPerformance` on the year's own lots and the mirror's live plants, inside the wall's one batch. Trim packages are not read, because they do not enter season pounds. On the smoke server the bizops wall answered 200 in 191 ms, then 52 ms, 36 ms, and 43 ms. That is not the live floor.

## Close

Tree left `19e48053a9283cdb`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0109, so the merge block takes a snapshot first.
