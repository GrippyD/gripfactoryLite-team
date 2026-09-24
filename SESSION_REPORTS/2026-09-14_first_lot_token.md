# Session report: THE BETA FLOOR IS OPEN, THE FIRST LOT TOKEN (canon 0.30.55), Scribe-direct, 2026-09-14

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Two things in one morning: the beta roll of 0.30.53 completed at the owner's keyboard (read back from its evidence), and an owner ruling built as a worker change with migration 0044.

## The owner, verbatim

"I'm back at the terminal, do I still need the watcher?"

"Set things up so that the first number added today ends in 26010 (we're on the tenth lot this year, we just haven't inputted the historical data yet"

## Part one: the roll completed (evidence, staged back)

`DEPLOY/roll-result.json`, stamp 20260914-072154 (07:21 to 07:25 on his laptop, 11:21 to 11:25 UTC): old `gripfactory-lite-grip-20260911` (ba651a49), new **`gripfactory-lite-grip-20260914` (29c59313-c09b-4b81-b0cc-610150c7803b)**, migrations applied 43, worker **ab40b657-2b46-4c5d-82b4-a8fa7afc0466** deployed with the binding on the new database. The dated name is today's, so Saturday's empty `gripfactory-lite-grip-20260912` (6eeffc49) stands unused beside the alpha databases until his word deletes them.

The carry, every table exact: app_config 5, lookup_values 1652, farms 3, strains 96, grow_methods 3, package_types 8, dry_spaces 8, label_templates 0, suppliers 0, equipment_assets 49, equipment_pm_schedules 49, people 2 (a second person since Saturday's snapshot). The beta seed snapshot (`db_backups\20260914-072154_beta_seed_gripfactory-lite-grip-20260914\`, 47 tables) shows exactly the carried tables plus what the migrations seed, and nothing else: no lots, no weights, no mounts, no listings, no change log. The pre-roll snapshot (`...\20260914-072154_pre_roll_gripfactory-lite-grip-20260911\`) is the alpha's last picture: 3 harvest batches, 2 wet weights, 1 interco movement, 8 METRC mounts (97,936 plants, 11,742 packages), 382 listings, 624 change-log rows.

**The false NOT OK.** The script printed `NOT OK: read the mismatches above` with two mismatches: `equipment_pm_logs: expected 0 after the roll, got 98` and `equipment_tickets: expected 0 after the roll, got 3`. Those rows are the equipment migration's own seed (the alpha carried the same 98 and 3 from the same seed); the verification expected every non-carried table at zero and did not know a fresh floor is not empty. Nothing was wrong on the floor; the toml stayed on the new database (its restore runs only on a red step of the migrate-and-deploy stage), sha256 b383f4c0103de3e0.

**The fix (`app/scripts/roll-beta.mjs`, sha 46e43be365d93ed9):** step 4b reads THE SEED BASELINE right after the migrations and the deploy, one `COUNT(*)` per table on the fresh floor, and the verification expects those counts (usually zero) on every table the carry skips; `roll-result.json` gains `seeded`. Committed and staged back.

**The watcher.** The last heartbeat is 07:17, before the roll: he stopped it when he sat down ("do I still need the watcher?"). Answer given: not while he is at the keyboard; harmless to leave running; `DEPLOY\stop` or Ctrl+C ends it. With the lane down, today's deploy is his three commands.

## Part two: THE FIRST LOT TOKEN

The HBN's last segment is the lot token YY### (`formatLotToken`): the harvest year's last two digits and a serial that is one past `MAX(lot_serial)` for that year (`nextLotSerial`). On the fresh floor the first 2026 mint would have read 26001; nine lots of 2026 exist in the world and wait to be entered later through Admin's Manual HBN (canon 0.30.1 fork 6, which takes a full HBN with its own serial and refuses a taken one).

**The law (canon L-4, a value in data):** `app_config.first_lot_token` holds the first YY### token the automatic mint may issue for that year. The mint takes the higher of the ledger's next serial and that floor; a token whose YY is another year's, a blank, or a malformed value leaves the ledger rule alone; the manual mint is untouched.

- `src/config.ts`: `CONFIG_KEYS.first_lot_token`; `lotSerialFloor(value, harvestYear)` parses `^\d{2}\d{3}$` after trim, returns the serial when YY matches the year and the serial is at least 1, else null.
- `src/mint.ts`: `nextLotSerial(currentMax, floorSerial = null)` returns `max(floor(currentMax) + 1, floorSerial)`; a non-integer or sub-1 floor throws.
- `src/actions.ts`: the Acquire mint reads the value once per request (`getConfigValue`) and passes the floor into the retry loop; on a UNIQUE collision the re-read `MAX` moves the serial past the floor as before.
- `migrations/0044_first_lot_token.sql`: `INSERT OR IGNORE` of `first_lot_token = '26010'` (the seed shape of 0008, 0012, 0014). It shows in Admin, Lookups, app_config like the other keys, editable there with a reason.
- `test/mint.test.ts`: six new cases (the empty ledger lifts to 26010 with the full HBN `26257-ARL-GH-027-0-NA-26010` for 2026-09-14; counting past the floor; historical 1 and 9 below the floor still answer 10; another year untouched; blank, malformed and zero tokens; a bad floor throws).
- `scripts/smoke.mjs`: the from-zero pin moves to 44 migrations; the first four mints of 2026-09-01 now read 26010, 26011, 26012 (the recall mint) and 26013 (the remint that skips the recalled serial); the drying gauge shows 26011; Admin's app_config page must carry `first_lot_token` and `26010`. The smoke is the proof of the ruling on a fresh floor.

Order with the roll: the roll had already run when the ruling arrived, so 0044 applies to the new database by his three commands (probe, `migrations apply`, `deploy:grip`); had it come first, the carry would have brought the row across. Either order lands the same floor; the two must not run at the same moment.

## Sealed final check

```
npx tsc --noEmit -> 0
npx vitest run -> 23 files, 558 tests passed (552 + 6)
rm -rf .smoke-persist && SMOKE_PORT=8827 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
  -> "About to apply 44 migration(s)", SMOKE PASS (exit 124 is the teardown hang)
Dash audit (config.ts, mint.ts, actions.ts, 0044, mint.test.ts, smoke.mjs, roll-beta.mjs, this report) -> 0 each
Committed, staged back, sha256 equal both sides:
  src/config.ts                        7649f8fa38838bdc   33,252 bytes
  src/mint.ts                          82045a02006e6f05    4,402 bytes
  src/actions.ts                       c589b1bc0bb8310d  221,592 bytes
  migrations/0044_first_lot_token.sql  5f89a58c4e787c08      795 bytes
  test/mint.test.ts                    1161a8eb33d2d8fc    7,250 bytes
  scripts/smoke.mjs                    c531fe57dce96a45  315,743 bytes
  scripts/roll-beta.mjs                46e43be365d93ed9   11,784 bytes
wrangler.toml on his machine (adopted byte for byte): sha256 b383f4c0103de3e0, env.grip -> gripfactory-lite-grip-20260914 / 29c59313-c09b-4b81-b0cc-610150c7803b
Live at writing: worker ab40b657, migrations 0001-0043 on gripfactory-lite-grip-20260914; 0044 and the mint code deploy at his hands (this report's version id lands in the LIVE row that follows).
```

## Flags

The seed 26010 rides every fresh floor (the smoke's, a local dev's, c10's if ever deployed), as admin_pin 21319 does; c10 would edit its own value in Admin. The nine exports parked in `DROPS\2026-09-12\` still wait on the plan question: on the Free plan their 450,000 row writes would spend the day's budget and freeze his own lot entries; the Scribe asked and holds until his word. Fresh METRC exports on beta day are his call.
