# Session report: THE FREE TIER WALL (canon 0.30.54), Scribe-direct, 2026-09-12

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. An incident and an ops slice: the beta roll of 0.30.53 stopped at the migrations on a Cloudflare plan limit; the roll script learns to re-run; the nine exports the owner sent from the road are parked for their drop. No app code, no migration.

## The owner, verbatim (from the road)

"you will have to upload them, I'm going to hit the road" (with eighteen attachments: eight METRC exports and one Zoho Items export, each attached twice)

## What happened

At 16:03 on his laptop the owner ran `node scripts\roll-beta.mjs` from `app\`. Steps 1 to 3 went through: the probe, the pre-roll snapshot of all 46 tables to `db_backups\20260912-160323_pre_roll_gripfactory-lite-grip-20260911\` (with the toml beside it), and `wrangler d1 create "gripfactory-lite-grip-20260912"` (database_id 6eeffc49-2c03-44b9-a7a4-bd1649e9ccf9). Step 4 stopped at the first query of `migrations apply`. Wrangler, verbatim (from `DEPLOY/roll-result.json`, staged back):

```
A request to the Cloudflare API (/accounts/.../d1/database/6eeffc49-2c03-44b9-a7a4-bd1649e9ccf9/query) failed.

  Your account has exceeded D1's free tier daily row write limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue. See https://developers.cloudflare.com/d1/platform/limits/ for more details. [code: 7500]
```

The script did what it promised on a red step: it restored `wrangler.toml` (sha256 879c101580b7e5c8, still naming gripfactory-lite-grip-20260911), wrote `DEPLOY/roll-result.json` (ok false, step_failed "migrations apply", old and new named, pre_roll_dir set) and printed `[roll] STOPPED at migrations apply`. The worker f186a48e was never redeployed. The new database exists, empty and unmigrated (the refused call was the first write, so nothing half applied).

## The wall, measured

The account is on the Workers Free plan. D1's free tier (developers.cloudflare.com/d1/platform/pricing, read 2026-09-12): 100,000 rows written per day and 5 million read, account wide, resetting at midnight UTC; "Indexes will add an additional written row when writes include the indexed column". The daily limits have been enforced with the 7500 refusal since the changelog of 2026-09-01. Workers Paid: no daily cap, the first 50 million rows written per month included, then $1.00 per million; reads 25 billion a month included.

What spent today's budget: the afternoon's sliced mounts on UTC day 2026-09-12 (1132 flowering 48,149 rows, 832 plants 1,638, 832 packages 11,742). `metrc_plants` carries a TEXT primary key and two indexes (four row writes per insert); `metrc_packages` a primary key and three (five). So the three drops were about 260,000 row writes; the counter caught up at the roll. The enforcement is not instant (the 48,149-row mount went through), but it is real.

What the beta needs: the nine files below are 109,678 METRC rows (about 450,000 row writes with indexes) plus the Zoho items. On Free that is four and a half days of budget for one load, and every daily plants re-drop during the beta would hit the wall again. The Scribe's recommendation to the owner, sent by message: upgrade to Workers Paid before the beta; it is his call and his account (a plan change, no code). The same plan lifts the 10 ms CPU cap behind the 1102 of 2026-09-11.

## The exports received (deduplicated by sha256)

| File | Rows | sha256 (16) |
|---|---|---|
| Metrc-Michigan-GR-C-002600-Plants-Flowering.xlsx | 1,500 | 3c2704c2f2baa91a |
| Metrc-Michigan-AU-G-C-001509-Plants-Flowering 3.xlsx | 10,000 | 23e19934a49c6167 |
| Metrc-Michigan-GR-C-001405-Plants-Flowering 2.xlsx | 34,445 | 70a7ca9ad5bb04cb |
| Metrc-Michigan-AU-G-C-001397-Plants-Flowering 2.xlsx | 2,000 | deab3dc4c62922a9 |
| Metrc-Michigan-GR-C-001132-Plants-Vegetative 6.xlsx | 204 | f102eeb9c3c5070e |
| Metrc-Michigan-GR-C-001132-Plants-Flowering 2.xlsx | 48,149 | f6725465417f55cb |
| Metrc-Michigan-AU-G-C-000832-Plants-Flowering.xlsx | 1,638 | c142cc9b76fed1ac |
| Metrc-Michigan-AU-G-C-000832-Packages-Active 12.xlsx | 11,742 | 64c551cbc6b2f3e2 |
| Item 3.csv (Zoho Items) | 8,349 | d25dc500b3f252db |

The eight METRC files are byte for byte the exports he mounted this afternoon (same hashes as the 19:00 attachments); Item 3.csv is a newer Zoho export than Item 2.csv (2865ced99ad56c30). Total 109,678 METRC rows, matching the sum of today's mounts (97,936 plants and 11,742 packages).

## What shipped

**`app/scripts/roll-beta.mjs`** (sha256 3673a650c003b1f0, 10,766 bytes): the re-run law. Step 3 asks `wrangler d1 list --json` for a database already named `gripfactory-lite-grip-<today>` and reuses it instead of creating a second one (`existingDatabaseId(name)`, reading `uuid`); the migrations apply then picks up from zero on the empty database. A red migrations step names the wall in words when wrangler's output carries `code: 7500` or "daily row write limit" (what it means, when it resets, the plan option, and that the same command re-runs), and names the half-applied case ("already exists": delete the empty dated database by hand and run again). Everything else as at 0.30.53.

**`.gitignore`**: `db_backups/` (the roll's dumps were not ignored; a full alpha dump inside a tracked tree is against G-9) and `DROPS/`.

**`DROPS/2026-09-12/`** on the laptop (gitignored, never committed, never vendored): the nine exports above under his file names, committed through the bridge and staged back, sha256 equal on both sides. They wait there for the drop after the roll; the sandbox copy may not outlive the weekend, the laptop copy does.

**`CLAUDE.md`**: the roll paragraph learns the 7500 sentence.

## The drop lane found

The Scribe's sandbox cannot reach the live site (proxy CONNECT 403, as MEMORY says), and the bridge VM is still unmounted (the September 8 Windows update). But Claude in Chrome on his laptop answers: a tab opened on https://gripfactory-lite-grip.gflite.workers.dev/ rendered Home past the PIN gate (his own signed-in Chrome). The `file_upload` tool of that extension puts a session attachment or a connected-folder file straight into a page's file input (under 10 MB per call; the largest file here is 3.6 MB). So the drops can be done from here, through his browser, without his hands: navigate to the Marketplace METRC pane, attach a file, run the mount, read the counts; the Zoho pane likewise. THE ORDER LAW: the drops follow the roll, because the roll clears the mounts; and they follow the plan decision or the midnight reset, because each mount is hundreds of thousands of row writes.

## What waits on the owner

1. The plan (Workers Paid, recommended) or the midnight UTC reset (8:00 PM Eastern).
2. `node scripts\roll-beta.mjs` from `app\` at the laptop, once. The patched script reuses 6eeffc49 and completes: migrate, deploy, carry, beta seed snapshot, verify.

Then the Scribe: stage `DEPLOY/roll-result.json`, `app/wrangler.toml` (adopt byte for byte), the two `_manifest.json`; fold the new database and version id as LIVE; drop the nine files through his Chrome; fold the counts; watch FG INVENTORY and the SalesHelper header date roll.

## Sealed final check

```
node --check scripts/roll-beta.mjs -> syntax ok
Dash audit (roll-beta.mjs, .gitignore, CLAUDE.md, this report) -> 0 each
Commit, staged back, sha256 both sides equal:
  app/scripts/roll-beta.mjs   3673a650c003b1f0  10,766 bytes
  .gitignore                  cfb6c6d0349008d4     419 bytes
  DROPS/2026-09-12/ nine files, hashes as in the table above (8.2 MB)
wrangler.toml on his machine: sha256 879c101580b7e5c8 (restored by the script; unchanged)
Live underneath: worker f186a48e, migrations 0001-0043 on gripfactory-lite-grip-20260911;
  the account write-frozen until 2026-09-13 00:00 UTC on the Free plan.
No app code changed: tsc, vitest and the smoke stand as sealed at 0.30.49
  (tsc 0, 23 files 552 tests, SMOKE PASS at 43 migrations).
```

## Flags

The lane for the drops runs through the owner's own browser session; the Scribe opens and closes its own tabs there and touches nothing else. If Chrome on the laptop is closed when the time comes, the drops wait for him. The METRC exports are a day old by the time the beta floor opens; fresh exports on beta day are his call.
