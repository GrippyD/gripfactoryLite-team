gflite: slice 1.2, queues move under Admin as listed records

# Cursor build prompt: Gripfactory Lite, Slice 1.2 (UI restructure from first break-in)

**Repo:** this folder. Read `canon/CANON.md` (guardrails G-1 through G-10) first. Never edit `canon/` or `prompts/`; propose amendments in your session report.

**We are deployed now.** Migration files are frozen: this slice must not touch `app/migrations/`. It is a UI and routing change only. Do not touch wrangler.toml.

## Owner ruling (2026-08-27, verbatim intent)

1. The home page shows **stations only**. Remove the queue tiles/buttons from home entirely.
2. Home gains an **Admin** button (a tile after the stations, plus the existing nav link stays).
3. Admin becomes a landing page; its **first button is "Data Queues"**.
4. The Data Queues page shows **all four queues with their records listed inline**: actual tables stacked on one page (HBN Queue, Dry Space Queue, Cryo Queue, Testing Queue), each with its heading, live rows newest first, its row controls (Mark complete, Mark trimmed, Release with outcome, Edit and Void with reason), and its CSV export link. Records listed, never a button you have to click to see them.

## Implementation

- Keep it registry-driven: give pipeline entries a `surface` field ("home" for stations, "admin" for queues) in `app/src/pipeline.ts` so placement stays data, not structure. Home renders surface=home; Data Queues renders every surface=admin queue as an inline table section.
- New route `/admin` (landing): buttons in order: **Data Queues** (`/admin/queues`), **Lookups** (`/admin/lookups`), **Log** (`/log`). The top nav "Admin" link points at `/admin` now.
- New route `/admin/queues`: the stacked queue tables described above. Queue counts can ride the section headings.
- Old `/queue/<key>` routes redirect (302) to `/admin/queues`.
- Station queue pickers (Wet Weight Entry picking from the HBN queue, etc.) are unchanged.
- No new dependencies. No em or en dashes anywhere (G-8).

## Verification (G-10)

- Update tests: home contains no queue tiles and does contain the Admin tile; `/admin` lists Data Queues first; `/admin/queues` renders all four queue sections with their controls; `/queue/<key>` redirects.
- Update the smoke walk to read queue counts from `/admin/queues` (all prior assertions preserved).
- `tsc --noEmit` clean, all tests green, smoke green.
- Sealed final check over every touched file (wc -c, sha256, tail 80 visualized), output pasted verbatim into the session report.

## Session report (required)

`SESSION_REPORTS/2026-08-27_slice1p2_admin_queues.md`: scope, built, deviations, proposed canon amendments, verification verbatim. Last stdout line: `Session report: <absolute path>`. Do not deploy; the owner deploys with `npm run deploy:grip` after review.
