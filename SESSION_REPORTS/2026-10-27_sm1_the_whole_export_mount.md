# SM1: THE WHOLE EXPORT MOUNT

Built and gated by the Scribe on 2026-10-27 (canon 0.30.554), in the fast lane on the owner's pick. Nothing is committed, pushed or deployed.

## The incident
- His screenshot: Cloudflare Error 1102 "Worker exceeded resource limits", Ray ID a50d9de79e40e006, 2026-10-27 00:34:52 UTC, on `POST /fulfillment/mount-sos`.
- The file, saved to `DROPS/` by his hand: Zoho Inventory's Sales Order export, 23.8 MB, 100 columns, 15,755 rows. It holds 1,715 orders dated 2025-11-25 to 2026-10-26, with 5,828 prepack lines.
- The cause: `parseCsv` built every cell one character at a time. The mount's read of this file needed about 636 MB of heap (`parseCsv` alone 476 MB), and the Worker has 128 MB. In Node under a 128 MB heap the same read runs out of memory, as live did.

## His words, verbatim
1. "the filters are cumbersome in Zoho.  I'd rather have a solution that shows historical fixes too.  So I think we need a more perfect pasta sauce here"
2. Asked what "shows historical fixes" should mean: "Nothing, other than the data should exist in gripfactory as it does in Zoho.  That means if, for whatever unforseen reason, I need to change an invoice a year after the fact that gfLite sees that if it's ever needed"
3. Asked what happens to an order an earlier export carried and a newer one lacks: "Mark it gone (Recommended)". The option read: inside the new export's date range it is gone from Zoho, leaves the plan and the open list; outside the range it stays, so a filtered export never flags anything.
4. Asked who builds it: "I build it now (Recommended)".

## Trees
- Received: the live tree `7b0ec6a5152a86e6` (main f432617, PC1b live).
- Left: `bc947d297e75dd52` (437 files, 121 migrations). It was written into `branches/GFLiteMetrcAPI/app` and read back on the disk.
- Touched:
  - `src/csv.ts`, `src/actions.ts`, `src/db.ts`, `src/fulfillment.ts`, `src/index.ts`, `src/i18n.ts`, `src/prepackplan.ts`;
  - `migrations/0122_so_mount_rounds.sql` (new);
  - `test/somount.test.ts` (new), `test/csv.test.ts`, `test/fulfillment.test.ts`;
  - `scripts/smoke.mjs`.
- `public/`, `vendor/`, `package.json`, `package-lock.json`, `wrangler.toml` and `tsconfig.json` are untouched.

## What changed
1. **The reader.** `parseCsv` slices each cell from the text, under the old reader's rules exactly. The suite proves it against the old reader kept word for word: 22 edge cases, 20,000 seeded random texts, and a wide quoted export; at the gate, 200,000 more random texts and his real export gave identical output. On his file the read drops from 476 MB to 49 MB and from 7.6 s to 1.3 s of CPU. Every caller gains: the METRC drop, the director imports, the lab rules.
2. **The rounds.** The Mount SOs page's script reads the file in the browser. It cuts the file at line breaks outside quotes and groups rows by the order key the mount reads (the first filled of the SO number columns by exact name then any case, then SalesOrder ID; keyless rows ride together). It packs whole orders into rounds of at most 1,500 rows, each with the header, and a progress line counts them. Without the script the form posts once, as before.
3. **A round reads only its own orders.** It reads its orders and their lines by `so_number` in chunks of 90, never the whole table, and writes in batches of 200. The upsert rules of 0.30.18 are unchanged.
4. **The mount row** (migration 0122) carries `rounds_total`, `rounds_done`, `completed_at`, `gone_count` and `gone_held`.
   - Rounds must come in order.
   - A round after the close refuses, and so does a changed round count or a later round without its mount; each refusal answers JSON in words.
   - A mount whose rounds stopped says so on the page. The plan's "Orders as of" stamp, the summary and the stale chip read only whole mounts.
5. **THE GONE RULE**, on the last round:
   - an order dated inside the export's date range that the export lacks soft-deletes with its lines, with the reason "gone from the Zoho export" and its change log rows;
   - an order dated outside the range stays;
   - an order the export carries again revives, with its lines and our pick marks.
6. **THE GONE GUARD**: when more than 10 orders and more than 2% of the export's orders would go, nothing goes and the page says so (a filtered export does that).
7. **The page's three tables** sit in the report-scroll box. With real orders mounted, the Sales Pipeline table pushed the page 128 to 192 px sideways at 820 in all three themes; the sweep had only ever seen the empty page.

## The acceptance on the live-data bench
The bench: the 20261026-095457 tables at 0122, a bench-only PIN, and his real export dropped on the page in Chromium, through the page's own script.
- **The whole export:**
  - 12 rounds, every one 200, in 6.6 s locally: 15,673 lines, 1,715 orders, 82 ignored.
  - An independent count equals the database order for order and line for line: 0 missing, 0 extra, 0 header and 0 line differences, and 5,828 prepack lines on both sides. The count used Python's own csv reader on the same file, under the mount's rules.
- **One round, at its largest:** 1,498 rows, 212 orders, 3.5 MB. The mount's read of it peaks at 38 MB of heap and still runs under a 32 MB cap. Every row lands in exactly one round, and no order is split across rounds.
- **The same file again:** nothing changes, and not one change log row is added for an order or a line.
- **A changed export:** an invoice of December 2025 edited, one May 2026 order voided, and the two orders of the first day absent. The edited quantity was taken (40 to 41), the May order left with its lines, and the two first-day orders stayed (dated outside the new range). The page read "Gone from Zoho with this mount: 1."
- **The whole export again:** the May order back, the invoice back to Zoho's 40, and the mirror exact.
- **Filtered by status** (confirmed only, 79 orders): THE GONE GUARD held 219 orders and removed nothing.
- **Filtered by date** (October only, 281 orders): nothing removed, and the orders outside October untouched.
- **The plan with orders mounted:**
  - the header reads "Orders as of 2026-10-26 22:25";
  - Packed (not ordered) totals 725.06 lb against 985.06 before (260 lb on open orders), with the bench's 200 lb targets;
  - Need 2,674.94, Net Need 2,473.00, Short Product 804.61, Net Short 683.39;
  - the plan's order read takes 77 ms over the 15,673 lines.
- **Layout:** Mount SOs and Pick Orders scroll sideways by 0 px in all nine views (Lite, Continuum and Grip at the phone, 820 and 1920).
- **Noted, not touched:** the prepack page's Available pane query takes about 0.6 s on the live-data bench, and it predates SM1.

## Gates on the tree
- typecheck 0.
- vitest TZ=UTC: Test Files 126 passed (126); Tests 1739 passed, 6 skipped (1745).
- vitest TZ=America/New_York: the same.
- `node --check scripts/smoke.mjs`: 0.
- The from zero smoke: `About to apply 121 migration(s)`, SMOKE PASS, exit 0, no 500. It now mounts the export in two rounds, refuses a round after the close, takes out an order the next export lacks, and brings it back with its pick marks.
- Dash, CR and name scans of the twelve touched files: none.

## The merge
Migration 0122 rides, so the snapshot comes first under THE SNAPSHOT GUARD. The block:
- THE RE-RUN CHECK first;
- the worktree commit on `bc947d297e75dd52`;
- canon committed on main;
- `git merge --no-ff GFLiteMetrcAPI`, with the message on the command line;
- the push, and the worktree fast-forwarded.

Once live, the whole export mounts from the page in about a minute or two against the live database; the tab stays open until it reads "Mounted. Loading the orders."
