# 2026-09-20 The Service Actor and The Feed Reads the HBN (canon 0.30.140, 0.30.141)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.138 (worker e171de72, migrations 0001-0063). Worker-only; no migration; from-zero pin stays 63; next free migration 0064. Two rulings from one afternoon at the Cloudflare dashboard, after Corey's agent's connector spec arrived (relayed by the owner 2026-09-20; the verbatim rides canon 0.30.139) and the two service tokens first answered 200.

## The tokens, as they stand (canon 0.30.139)

- Two Cloudflare Access service tokens on the account that owns the Worker: silo-ops-cron (Silo Ops, the Drying Operations watch) and trimatron-puller (the TRIMATRON poller; named so by hand, and canon takes the name as made).
- One reusable policy, corey-portal, Action Service Auth, Include rule Service Token naming both tokens, attached to the application "gripfactory-lite-grip - Cloudflare Workers" beside the Allow policy "Email domain: @gripcannabis.com". Access evaluates Service Auth policies first, so the order of the two rows does not matter.
- Two findings on the way there, both now law in canon: a new Client Secret is `cfast_` plus 48 characters (54 in all) and the prefix is part of the secret; a good token with no Service Auth policy on the application gets the login redirect (meta `service_token_status false`), not a 403. Two stray characters (a copied line break) on each value, and the policy attached but unsaved, were the other two walls.
- The values never enter the repo or the canon; they go to Corey's agent by a password-grade channel from the owner's hands.
- The first 200 carried no login email, so the worker took it as dev@local and a People row named dev was born on production by the first-login law: the standing consequence of the 0.30.136 pick, closed by the guard below from this deploy on.

## The law, as built

### THE SERVICE ACTOR (0.30.140)

Corey's agent: "Access: read only. A GET route only, no write scope anywhere ... If it is easier to hand over a broader key, do not." His pick on the question tool: "Build THE SERVICE ACTOR guard".

1. THE MARK: the grip environment carries the wrangler var `ACCESS_FRONTED = "1"` (env.grip.vars). Access fronts every request there; a person always arrives with the login email header, a service token never does (its JWT carries no email). Local dev and the smoke carry no var and keep the dev fallback identity exactly as before.
2. THE ACTOR: on the fronted worker, a request whose login email header is absent or blank is a service actor. It acts under a fixed identity (id `service-token`, display name `Service token`, email `service@access`) that is not a people row: nothing is born, nothing can be authored under it.
3. THE DOORS: the service actor may GET or HEAD `/ops/drying_ops` (the Drying Operations menu with the silo strip), anything under `/feeds/` (the trim weighs feed) and `/silos/live.json` (the strip's live JSON). Every other path, and every POST anywhere, answers 403 as JSON in words: "This service token reads /ops/drying_ops, /feeds and /silos/live.json alone; nothing else answers it." (no-store).
4. THE PERSON: a request with a login email resolves the person as before, fronted or not; nothing changes for the floor.

### THE FEED READS THE HBN (0.30.141)

Corey's agent's spec asked for a weigh timestamp in UTC with the zone, a station or pick id, the site, the facility, the harvest batch, the dry method (silo or hang) and a site filter. The owner, on the question tool: "Again, the feed doesn't carry it but the data hides it in the HBN". The mint format is `YYDDD-farm-grow_code-strain_code-manicure-silo-YY###`; the feed now reads it back.

1. Each row of GET /feeds/trim-weighs.json also carries: `weighed_at` (the weigh's UTC instant, the row's creation, Z-suffixed); `station` (`trim_packages`); `stream_label` (the package type's display name beside the code); `site` (the HBN's farm segment, ARL, PNN or PNS; the batch's stored farm when the HBN is not a seven-segment mint; null with no lot); `license` (the facility: the ledger row's license, else the lot's inherited line by THE INHERITANCE LAW, null with no lot and no ledger row); `dry_method` (`silo` when the HBN's dry space segment names a silo, `hang` when it reads NA, null without a parsed HBN). The lot gains `metrc_harvest_tag` and `hbn_parts` (harvest_day as YYYY-MM-DD from YYDDD, farm, grow_code, strain_code, manicure, silo or null, serial). `lot.farm` stays the batch's stored farm; `site` is the HBN's own reading.
2. `?site=<farm code>` filters by the same reading: the HBN's second segment, the batch's farm standing in for an HBN that is not a mint; a value that is not a farm code answers 400 in words. The envelope echoes `site` (null for every farm).
3. Nothing existing renames or moves: id, package_code, metrc_tag, stream, weight_grams, trim_date, operator, status, lot.id, lot.hbn, lot.short_id, lot.strain, lot.farm, created_at, updated_at, changed_at, voided_at, since, next_since, more all stand as 0.30.137 built them.

## What changed

- `wrangler.toml`: `ACCESS_FRONTED = "1"` under `[env.grip.vars]` with its comment. Nothing else in the file.
- `src/service.ts` (new): ACCESS_FRONTED_VAR, SERVICE_IDENTITY, SERVICE_ROUTES, SERVICE_REFUSAL, isAccessFronted, loginEmailOf, isServiceRoute.
- `src/index.ts`: the identity middleware reads the login email through loginEmailOf; on the fronted worker with no email it answers 403 off the doors or sets the service identity; otherwise resolveIdentity as before. The feed route passes `site`.
- `src/mint.ts`: dateFromYyddd, HbnParts, parseHbn.
- `src/feeds.ts`: TRIM_WEIGHS_STATION; FEED_REFUSAL.site; the site clause and the package_types and license columns in listTrimWeighs; feedSiteOf, feedDryMethodOf, feedLicenseOf; the new row fields; `site` on the envelope.
- Tests: `test/service.test.ts` (new, 5 tests: the names, the doors, the fronted read under the fixed identity with no people row born, the 403s on everything else and on every write, the person's path fronted and off); `test/feeds.test.ts` (the site query and its refusal, the site clause and binds, the HBN read back, the site, dry method and license readings, the new row fields).
- `scripts/smoke.mjs`: after the feed walk: weighed_at, station, stream_label, the HBN's parts with the ARL farm and the serial, site ARL, dry_method following the HBN's dry space segment, the license line, the harvest tag field; site=arl echoing ARL with the ARL weighs alone; site=PNS leaving them out; a bad site answering 400.

## Scribe assumptions (his word owed if wrong)

Six on THE SERVICE ACTOR:

- The mark is a wrangler var on env.grip, deployed with the worker, so the guard needs no dashboard hands.
- The doors are the three the two requests named. /ops/drying_ops renders as HTML for the watcher; a JSON twin was not built.
- A future environment fronted by Access must carry the same var or its tokens act as dev@local.
- The dev People row born on production by the first token request stays as it is; the guard makes it unreachable from a token from this deploy on. Deactivating it would change nothing for tokens now.
- A person's request, fronted or not, resolves exactly as before; nothing changes for the floor.
- The guard answers before the PIN gates and every route: a service actor never sees the PIN page, only the 403.

Six on THE FEED READS THE HBN:

- dry_method reads the HBN's dry space segment as minted (the planned dry space), not the live load; say the word and it reads silo_loads instead or as well.
- site reads the HBN's farm segment before the batch's stored farm, per his word; the two agree at the mint and part only if the batch's farm is edited after it.
- The facility falls back from the ledger row to the lot's inherited line (the batch's license when it is a site line, else the farm's AU grow line), the same law the floor uses.
- stream stays the package type code with the display name beside it as stream_label; Corey's "dry in, bud, nug, trim, shake, bio, sample" are his names to map onto ours.
- harvest_day reads the mint's YYDDD in this century.
- The feed's lot.short_id is our five-digit lot serial; Corey's 56803, 56808 and 56811 are his own numbering and do not appear on our side.

## The connection note for Corey's agent (send as is, the values by a separate password-grade channel)

Two Cloudflare Access service tokens, one per system: silo-ops-cron for Silo Ops and trimatron-puller for the TRIMATRON poller. Each request carries both headers: `CF-Access-Client-Id` (ends in `.access`) and `CF-Access-Client-Secret` (begins with `cfast_`); send each value whole. Base: https://gripfactory-lite-grip.gflite.workers.dev. The tokens are read-only in the worker itself: GET on `/ops/drying_ops`, `/feeds/*` and `/silos/live.json` answers; anything else answers 403 as JSON. No CORS; server to server.

Silo Ops: GET `/ops/drying_ops` is the Drying Operations menu (HTML) with the silo strip; GET `/silos/live.json` is the strip's data as JSON (one entry per dry space: what each tile shows), refreshed on every read. Hourly is fine.

TRIMATRON: GET `/feeds/trim-weighs.json?since=<ISO>&limit=500` (add `&site=ARL|PNN|PNS` for one site, `&live=1` to leave voided rows out). The envelope: `feed`, `generated_at`, `since`, `site`, `count`, `next_since`, `more`, `rows`. Poll every 5 minutes with `since` = the last `next_since`; when `more` is true, page again from `next_since` before sleeping. `since` compares against each row's `changed_at` (the later of its last edit and its void), strictly after, oldest first; limit 1 to 2000, 500 by default.

Per row, against the spec: your row id = `id` (stable, never reused); full METRC tag = `metrc_tag` (null until the package carries a METRC-shaped tag; `package_code` is the internal code, always present); stream = `stream` (the package type code as the station names it: BUD, TRIM, SMALLS, SHAKE and the rest) with `stream_label`; weight in grams = `weight_grams` (two decimals); weigh timestamp in UTC = `weighed_at` (ISO 8601, Z); operator = `operator`; station or pick id = `station` (`trim_packages`) and `lot.id`; `updated_at` as is; deleted or superseded = `voided_at` (null while live; a void moves `changed_at` forward so it arrives on the next poll). Corrections are in place: same `id`, `updated_at` and `changed_at` move; keep the freshest by `id`. Labels: tag = `metrc_tag`; strain = `lot.strain`; site = `site` (ARL, PNN, PNS, read from the harvest batch number); facility = `license` (the METRC license number); harvest batch = `lot.hbn` with `lot.metrc_harvest_tag`, `lot.short_id` (the five-digit lot serial) and `lot.hbn_parts.harvest_day`; dry method = `dry_method` (`silo` or `hang`). Errors: 400 `{"ok":false,"error":"..."}` for a bad query, 403 `{"error":"..."}` off the doors.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 41 files, 748 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9055): `About to apply 63 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Dash audit: 0 on every file below.

## Deploy (his hands; worker only, no new migration, the apply is idempotent)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

After the deploy, the token check tells the guard's story in one line each: the feed under trimatron-puller stays 200; the home page under either token turns 403.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        41 files, 748 tests passed
TZ=America/New_York npx vitest run    41 files, 748 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9055 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 63 migration(s); SMOKE PASS; " 500 " lines: 0

wrangler.toml                1975  53afcc92be61be8a
src/service.ts               3035  188243ff6f7005d2
src/feeds.ts                12068  3ac80356a77d0795
src/mint.ts                  6106  8dbfe7ec650e2c86
src/index.ts               117334  e9c2a6ee2c456a8e
test/service.test.ts         7867  e623977fbcbe2ac5
test/feeds.test.ts          10939  1fe93af56364ada7
scripts/smoke.mjs          484884  8855b331345ca9c9
dash audit: 0 on every file above
```
