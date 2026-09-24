# 2026-09-18 The Menu Tool Replaced (canon 0.30.123)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.122 (worker bf9ba9c4, migrations 0001-0060). Owner ruling 2026-09-18, mid-turn, with the upload grip-harvest-menu-hosting_3.zip, verbatim:

"Also, replace the menu tool in "Models" with this one"

Worker-only; no migration. From-zero pin stays 60; next free migration 0061.

## The law, as built

1. HIS BYTES, REPLACED. The Harvest Menu Tool 2026 tile on /models now streams the index.html of grip-harvest-menu-hosting_3.zip (42990 bytes, sha256 b96dd261b907a0a1) in place of the 2026-09-15 zip's (42416 bytes, 1b5a8798e8417aca), untouched, at the same path /models/harvest-menu-2026/ behind the same Models PIN. THE MODELS BUTTON (0.30.86) stands in every other clause: the registry MODEL_TOOLS, the slashed folder, no-store, data.json as JSON.
2. THE DATA STANDS. The zip's data.json is byte-identical to the one on the floor (7429 bytes, 979881ee7f395397); nothing moved.
3. THE LINEAGE FILES FOLLOW. The zip's README.md (4635 bytes, 460f20df61300d9c; the same source workbook, the hosting notes now naming the per-grow-type spread) replaces the unserved copy under app/vendor/harvest-menu-2026/; refresh_data.py is byte-identical to the one already there (03f9735ebd089e26).

## What his new build changes (read from the diff, for the record; not the Scribe's work)

- The one Potency spread slider becomes a spread slider per grow type (Indoor, Greenhouse, Outdoor), each under its grow type in the Base price panel, stored per type (localStorage key grip-harvest-menu-v5, so a viewer's v4 edits do not carry over); the price multiplier reads the lot's grow type's spread; the section meta line and the How to read this footer name the three spreads.
- The vs-base note under a price hides when the rounded difference is 0%.
- The embedded SOURCE_META names shmerblez.xlsx and the Microsoft 365 connector as the method (the served data.json's meta, unchanged, still reads test_plan.xlsx as of 2026-09-15 22:44; the page shows data.json's meta over the embedded one).

## What changed here

- `public/models/harvest-menu-2026/index.html`: his new bytes.
- `vendor/harvest-menu-2026/README.md`: his new README (unserved).
- `scripts/smoke.mjs`: the byte pin moves to b96dd261b907a0a1; two new pins read the v5 key and the per-grow-type slider markup in the served page.

## Scribe assumptions (his word owed if wrong)

- The tile keeps its title, Harvest Menu Tool 2026, and its slug; "replace" read as the same tool at the same address, not a second tile.
- The tool keeps streaming raw in its own theme (the 0.30.86 open question on the Continuum skin stands).

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 34 files, 698 tests passed.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9028): `About to apply 60 migration(s)`, `SMOKE PASS`, no 500 in the log; the Models walk passes with the new pins.
- Render pass: the served folder opened headless at /models/harvest-menu-2026/ reads the three spread sliders (sp_IN, sp_GH, sp_OD at 50), 45 lots, no page error; the only console lines are the tool's own two external requests (Google Fonts, cdnjs) refused by the sandbox and a bare static server's missing favicon, none of them the tool's fault.
- Dash audit: 0 on scripts/smoke.mjs (the vendored files are his bytes, the G-8 vendored exemption).

## Deploy (his hands, worker only)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        34 files, 698 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9028 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 60 migration(s); SMOKE PASS

public/models/harvest-menu-2026/index.html        42990  b96dd261b907a0a1
public/models/harvest-menu-2026/data.json          7429  979881ee7f395397  (unchanged)
vendor/harvest-menu-2026/README.md                 4635  460f20df61300d9c
vendor/harvest-menu-2026/refresh_data.py           5231  03f9735ebd089e26  (unchanged)
scripts/smoke.mjs                                425276  402447c1364e2e86
dash audit: 0 on scripts/smoke.mjs
```
