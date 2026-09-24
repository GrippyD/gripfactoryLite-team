# 2026-09-20 The Tie-Complete Page and The Feed Names the Real Strain (canon 0.30.149)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.147 (worker e8360239, migrations 0001-0063). Worker-only; no migration; from-zero pin stays 63; next free migration 0064. Prompted by Corey's agent's first-poll report, relayed by the owner 2026-09-20 (the verbatim rides canon 0.30.148), and the owner's pick on the strain question: "Real strain first, market beside it".

## What the numbers said

"605 rows over 7 pages of 90, 546 distinct ids landed." Every package cut in one trim entry shares one timestamp (one `ts` per entry in the trim action), so change instants tie across a lot's streams as a matter of course. THE POLL of 0.30.137 returned `limit` rows and set `next_since` to the last row's change instant, and the next page took rows strictly after it. A page cut inside a tie therefore dropped the tie's tail for good: the rows sharing the boundary instant beyond the limit were never sent. The 59 duplicates the poller saw are a separate matter (a cursor taken from a row's `updated_at` rather than `next_since` would re-read the span between a voided row's edit and its void; harmless, since the poller keeps the freshest by id); the drops were silent and are the defect this slice closes.

"lot.strain says R&D on 56802, 56803, and 56804 (tags and sheet: Wild Mango Creamsicle) and Gelonade on 56809 (tag: Detroit Diesel)." R&D is a real strain in Lookups (HBN code 070), so those batches were minted under it; the feed read `COALESCE(market_strain, strain)`, and the mint stores the market strain as the strain's own name, so a corrected batch strain alone would still have fed the old label.

## The law, as built

### THE TIE-COMPLETE PAGE (0.30.149, a correction of 0.30.137's poll)

1. The page asks the database for one row past the limit to learn whether more follow.
2. When the row past the limit shares the last kept row's change instant, every row of that instant beyond the limit is fetched (same clauses: since, live, site; ordered by id) and appended. A page never ends inside a tie; the limit is a floor, exceeded only by the rows sharing its last instant.
3. `next_since` stays the page's last change instant and `since` stays strictly after it, so nothing is lost and nothing repeats between pages. `more` reads whether rows remained past the limit, not the count against the limit.
4. Nothing changes for the poller: the same envelope, the same cursor, the same `limit`; a page may simply run over by a few rows.

### THE FEED NAMES THE REAL STRAIN (0.30.149; his pick)

1. `lot.strain` is the batch's strain as Lookups names it (the strain a METRC tag prints).
2. `lot.market_strain` rides beside it: the market label typed on the batch, else the strain's own name (the mint's inheritance).
3. The four batch records (56802, 56803, 56804, 56809) still need the owner's pencil: Strain to the tag's strain (added in Lookups, Strains, if not there yet), Market Strain to the label wanted (or the same name), a reason on each; the feed follows the record.

## What changed

- `src/feeds.ts`: ROW_SELECT and feedClauses shared by the page and its tie completion; listTrimWeighs returns a page ({ rows, more }), fetching limit + 1 and completing the tie; the select names `s.name AS strain` and `COALESCE(b.market_strain, s.name) AS market_strain`; the lot carries `market_strain`; trimWeighsFeed takes the page (a bare row list still reads more the old way).
- `src/index.ts`: the route passes the page.
- Tests: `test/feeds.test.ts` (the fake D1 answers a queue of result sets; the limit + 1 bind; the tie completion with its tail query, clauses and binds; the clean cut at a new instant; the envelope's more from the page; the real strain and the market label on the lot).
- `scripts/smoke.mjs`: the lot's `market_strain`; limit=1 answering every row of its instant with more true, the next page from next_since carrying none of that instant, the two pages walking the feed without loss or repeat.

## Scribe assumptions (his word owed if wrong)

- A tie group is small (the streams of one entry, or one bulk act); the completion query has no limit and reads the whole instant.
- The 59 duplicates were the poller's cursor, not the feed's; if they persist after this deploy, the poller is advancing by something other than `next_since`.
- `lot.strain` changing meaning for a batch whose market label differs from its strain is what the owner asked for; TRIMATRON matches tags.
- The four batch corrections are his hands and a reason each; the feed does not edit records.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 41 files, 753 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9058): `About to apply 63 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Dash audit: 0 on every file below.

## Deploy (his hands; worker only, no new migration, the apply is idempotent)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## The note back to Corey's agent (send as is)

Two changes on the feed from this deploy on, both without any change on your side. Pages no longer split a change instant: a page may run over its limit by the rows sharing its last changed_at, so next_since stays exact and nothing is lost between pages; if you re-pull from the beginning once, you will pick up any rows an earlier page boundary dropped (your 546 against our count will tell). lot.strain now reads the batch's real strain, the one the METRC tag prints, and lot.market_strain rides beside it as the market label; the four batches you named are being corrected on our lot records, and the feed will follow. Two answers on what you saw: metrc_tag is null on every trim weigh by design here, a trim container carries the lot serial as its code and no METRC tag, the tag is born at cryo on the cryo output (not in this feed; a cryo feed is its own route if you want one); and the 59 duplicates in your first pull are not ours to explain from the feed's side, since pages are disjoint by construction, so check that the cursor you advance is next_since itself and not a row's updated_at (a voided row's changed_at is later than its updated_at).

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        41 files, 753 tests passed
TZ=America/New_York npx vitest run    41 files, 753 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9058 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 63 migration(s); SMOKE PASS; " 500 " lines: 0

src/feeds.ts                14967  9c2744805e60f5a9
src/index.ts               117482  07cf8b02ae3c71a8
test/feeds.test.ts          15068  778d0810703cdfaa
scripts/smoke.mjs          491338  43ee74aaf67f53e8
dash audit: 0 on every file above
```
