# Gate: THE QUEUE (WL1, WL2, S3g)

Scribe gate, 2026-10-24, canon 0.30.538. Worktree branches/GFLiteMetrcAPI. Built in Cursor, one plain session running the queue back to back (THE QUEUE LAW), with no renders (THE RENDER LAW).

## Trees
- Pin: 9d751a5730ab2493 (L1 to L4, live).
- Hand-backs: WL1 43583f124452133d (422 files), WL2 4496aa03aa378d12 (424), S3g d2719df79350d5fe (427). Rebuilt here from the L4 gate tree plus the 19 files the three reports name; the hash matched. It passed every gate as received (vitest 1690 passed, 6 skipped, both zones; smoke About to apply 117 migration(s), SMOKE PASS).
- After the Scribe's fixes: 86b80eda966f0d2d (427 files), written into the worktree and read back there.

## The acceptance (the live-data bench: the 10-17 snapshot with 0106 to 0118 applied; the owner's three AU-P-000694 exports of 2026-10-20 from the main folder's DROPS/metrc_20261017)
- WL1, through Admin, METRC, in the order Active, Inactive, Transferred. Active: 459 added, 613 updated, 692 unchanged, 224 gone (with the Active law's own close of 145 ledger items and the release of 207 from the Testing Queue, as before WL1). Inactive: 191 added, 243 updated, 193 gone (the 191 it inserted arrive gone; 2 more were live under another license). Transferred: 2,314 transfers new, nothing gone. A second Inactive and Transferred drop wrote nothing (434 and 2,314 unchanged). A file named Active with Inactive headers was refused in words.
- Her converter (src/metrc-normalize.js, fed by a reader that walks every cell present, as her sheetRows does) on the same three files: 4,512 packages (Active 1,764, Finished 307, Discontinued 127, Transferred 2,314), no warnings (no tag sits in two files), no row in her third Inactive state. The mirror, read through WL2's precedence: the same 4,512 tags, all 17 of her columns equal on every row.
- WL2: her four calculations, run verbatim from her index.html on her rows (the pound set to 448), against the page's module on the mirror: the 82 families, 362 branches and 82 lab rows identical, and every total: 82 WIP families (23 with an active WIP), 23 active WIPs and 82 inactive, 35,550 lb of active WIP, BUD 1,434 (509 active), PRE 805 (576), SHA 243 (148), 1,233 of the 1,269 active BUD, PRE and SHA packages traced, 42 failed active packages in 12 families; under her name rule 1,052 shipped for sale, 1,920 lb, 47 buyers. The page prints the same.
- S3g, THE CHECK: HTD over his loaded export reads 52.2 tests a day (1,096 over 21 intake days), 47.9 COAs a day (814 over 17 COA days) and 5.2 days TAT (814 completed); the split First-time 5.7, Retest 4.4, Internal QA 5.1 days, as his export gives (5.69, 4.38, 5.06). The 14 day default reads 53.5, 56.2 and 6.1. BTR stays on bizops and culttech; Testing Throughput sits right after BTR, on bizops only. The period choice holds across a reload.

## Scribe fixes (src/wiplineage.ts f98f6f29102ff542, src/testingthroughput.ts a01b8116191ecc4f, src/metrc.ts 0bba454e59d0926d, src/i18n.ts 358a674377243021, src/theme.ts 7078e17788b0df19, test/wiplineage.test.ts 005794e09585bac3, test/testingthroughput.test.ts a90ed9305872ac53, test/metrc.test.ts b0993d62e4c0ffa1, scripts/smoke.mjs 4b9952fc5115d342)
1. THE LAB RULE (the owner's pick, 2026-10-24). Her rule marks a lab sample only when the destination's name holds "laboratory". The testing lab's name does not, so its 1,096 shipments in the Oct 20 file read as sales: 640 BUD, PRE and SHA packages in Shipped for sale, and the lab counted as a buyer. His pick: the license decides (an AU-SC or SC safety compliance license is a lab sample), with her name rule kept as the backup. Dropping the Transferred file again updated exactly those 1,096 rows. The page now reads 412 shipped for sale, 1,760 lb, 46 buyers, with 1,273 lab samples; her calculations under the same rule agree on every row and total.
2. THE PAGE AGAINST HER LAYOUT. The hand-back printed each package as a run-on line and each branch as its type and a count. No line carried the acceptance's inactive WIPs or traced count. The BUD, PRE and SHA tiles were squeezed into one grid cell (1,434 broke into 1,43 and 4 at 1920). Now the page has:
   - her takeaway line under the title, with the inactive WIPs and the traced count;
   - the seven tiles in one row, like hers;
   - her counts on each branch (packages, active, failed, shipped, on hand);
   - the packages in a table in her columns: tag with the last six in bold, status, quantity, unit, made from, location, lab status, packaged, and on shipped rows shipment, sent to, manifest and received, active rows first;
   - a root block with strain, status, tag, harvest, location, packaged, lab, grams and pounds;
   - her note and the search placeholder.
3. HIDE FINISHED AND DISCONTINUED. The chip was labelled "Hide empty branches" and left finished rows in the branch. It now carries her name and drops finished and discontinued rows from the tables. The branch counts stay whole, as on her page.
4. DATA AS OF IN FARM TIME. The page printed raw UTC instants. It now prints each grid's newest mount on the farm clock (THE ZONELESS ZERO).
5. THE TILE'S SPLIT (S3g). Hover or tap wrote the split over the first box, because the script's lookup for the line under the boxes found the first box, which carried the same attribute. Each box now carries data-dd-test-split, the one line under the boxes shows it, and a period change clears it. On the phone the boxes now wrap two and one instead of breaking words ("Tests/D ay").
6. SPANISH. WL2's strings had overwritten the lab pages' "Not submitted" ("No enviada" became "No enviado"). The queue's strings no longer overwrite an existing key. The tile's "over" and the lineage's Sort, Harvest, Packaged, its counts and its column heads now translate.

New tests cover each fix. The six fail on the hand-back's code and pass on the fixes.

## Renders (the final tree on the bench, after the mounts)
The pages:
- Admin, METRC
- Reports
- WIP Lineage: the default view, and a family opened with Other on
- the bizops, culttech and Director home walls

Each in Lite, CO and Cerberus at 1920, 820 and the phone.

What they showed:
- Every page returned 200, and no queue page scrolls sideways.
- Warm load times: WIP Lineage 250 to 400 ms in Lite and CO, 310 to 470 ms in Cerberus. The bizops wall 210 to 330 ms, about 500 ms in Cerberus.
- The lineage page is 1.3 MB of HTML because it carries every branch table; gzip shrinks it in transit.
- Admin, METRC scrolls sideways on the phone (64 to 211 px, the Three pictures list) and by 5 px at 820 in Lite (the license lines table). Both are older than WL1, which touched only the flash, the help text and the mount lines.

The bench was restored after the walk, with 0117 and 0118 kept.

## Gates (on the fixed tree)
- Typecheck exit 0.
- Vitest TZ=UTC: 1696 passed, 6 skipped (123 files). TZ=America/New_York: 1696 passed, 6 skipped.
- node --check scripts/smoke.mjs exit 0.
- From-zero smoke: About to apply 117 migration(s), SMOKE PASS, SMOKE_EXIT 0, no 500. It has three new checks: the takeaway, the AU-SC row as a lab sample in the branch table, and the tile's split line. One earlier run failed on the line packages day that starts at 23:00, because the run straddled 23:00 Eastern. That check is older than the queue, and the rerun passed.
- Dash and CR scan of the touched files: U+2013 0, U+2014 0, CR 0. No name, license or manifest from the exports is in any file (the fixtures use Harbor Testing and AU-SC-900001).

## Notes for the owner
- After the push, take fresh Active, Inactive and Transferred exports in the same hour and drop them in Admin, METRC, the Active one first.
- Do not drop the Oct 20 Active file on live if a newer Active has been mounted since. An Active drop is the truth as of its own file, so an older one would roll the mirror back.
- An Inactive mount counts the packages it inserts as gone, because they arrive gone. Its gone count reads high on a first drop for that reason.
- The lineage page carries buyer names, licenses and manifests behind Cloudflare Access, like every page. The three service tokens (silo-ops-cron, trimatron-poller, tagleaf-pusher) can read it too; that is the standing risk recorded at 0.30.136.
- A package can sit in a later Active file and an older Inactive one (an unfinished package). The page keeps her precedence, Inactive over Active. This is rare; say if it should go by the newer drop instead.

## Verdict
PASS with the Scribe's fixes. Tree 86b80eda966f0d2d. It carries migrations 0117 and 0118, so the merge block takes a snapshot first.
