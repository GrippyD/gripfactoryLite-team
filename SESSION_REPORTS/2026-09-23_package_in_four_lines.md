# 2026-09-23 The package reads in four lines (canon 0.30.199)

Scribe session, Scribe-direct under G-2 on a quiet tree (the device tree at 1bf3d10d10ce6757, brief G LIVE as 0.30.198, nothing queued for a build). Owner, 2026-09-23, verbatim, with two screenshots (the app's From METRC row and an Excel mock of four lines): "The screenshot from the app shows what we currently display on the scheduling list.  In both this surface and the prepack one, it should be displayed like the excel screenshot (whole package ID, new-line market strain - weight, new-line, HBN, new-line, "Location: "+[LOC]". No migration. Not deployed.

## What changed

- One renderer, `packageIdentityMarkup` in `src/prepack.ts`: a `<span class="pkg-identity">` of four block lines, `pkg-tag` (the whole METRC tag), `pkg-strain-grams` (`<market strain> - <grams> g`, the house whole gram with thousands separators; the grams alone when no strain), `pkg-hbn` (the HBN, or ready markup when the caller has more to say there) and `pkg-location` (`Location: <loc>`, translated `Ubicacion:` in Spanish; left out when no location is known).
- The Prepack scheduling page (`src/scheduling.ts`): every row on Available, Scheduled and Complete reads the four lines in place of the one-line `last six / strain / grams` identity and the muted HBN; the `>>`, `<<`, `>`, the time, the data attributes, the filter and the counts are as brief G left them. From METRC rows read the four lines too, the HBN line carrying the inherited harvest with its `known` or `new from METRC` marker (or the muted `no harvest in METRC's lineage`); the license is no longer on the row.
- The station (`/station/prepack`): the left pane's job list reads the four lines per job, and the picked job's heading reads the whole tag (`<h2 class="pkg-tag">`) in place of the last six. The carry and remainder prompts keep their short `...ABCDEF` forms, as sentences.
- The rows carry what the lines need (`src/db.ts`): `ScheduleItemRow` gains `grams` and `location`; the prepack feed and the scheduled and complete lists select the ledger item's `location` and read the strain as `COALESCE(b.market_strain, st.name, '')`, the market strain when the HBN has one (the rule of 0.30.183 on the lot lines); a prepack row's `identity` is now the whole tag. The station's job queries do the same (`JobRow.location`).
- `src/theme.ts`: `.pkg-identity` as a grid of block lines, the tag bold and tabular, the HBN and location lines small and muted, inside the job list's link at normal weight.
- Trimming and Pasteurization are untouched (their groups and identities as 0.30.102 and 0.30.110 left them).

## Checks

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 49 files, 849 tests passed; the same under `TZ=America/New_York` (the scheduling and prepack tests now pin the four lines in English and the Spanish `Ubicacion:`, the absence of the one-line identity and of the license, and the feed rows' strain, grams and location).
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9085`): `About to apply 73 migration(s)`, `SMOKE PASS`, no 500, exit 0; new assertions read the four lines on an Available row and on a From METRC row, the one-line identity gone, the license gone.
- Dash audit: 0 on the seven files.

## Assumptions for the owner's word

- The grams read in the house style, `8,505 g` (whole, thousands separator, a space before the unit), where the Excel mock read `8505g`; one word changes it.
- The separator between the strain and the grams is a plain hyphen with spaces, ` - `, as the mock.
- The strain is the market strain when the package's HBN carries one, else the strain, the rule the lot lines follow (0.30.183).
- The Location line is the package's ledger location (From METRC: the location METRC states); a package with no location shows three lines.
- The license left the From METRC row (the mock did not carry it); the HBN line keeps the `known` or `new from METRC` marker because it says whether Adopt will mint a batch.
- The Complete pane reads the same four lines with the time; a finished parent reads its remaining grams, 0 after a full pack.

## Deploy

Worker only, no migration:

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        49 files, 849 tests passed
TZ=America/New_York npx vitest run    49 files, 849 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9085 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 73 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

src/prepack.ts                  32296  9e79e4c4b0a1b7bd
src/db.ts                      166995  58eece3648bb8f30
src/scheduling.ts               20897  c5d56d0233c89c64
src/theme.ts                   154329  474aae70410b732f
test/prepack.test.ts             9485  718d077953f5d914
test/scheduling.test.ts         21781  e6555bad2c4f18fe
scripts/smoke.mjs              559764  014189eb8abbf258
dash audit: 0 on every file above
```
