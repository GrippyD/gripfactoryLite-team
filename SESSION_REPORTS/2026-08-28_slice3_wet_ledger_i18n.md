# Session report: 2026-08-28, slices 3a + 3b, wet weight ledger rebuild, ES/EN, Interco stub

**Builders:** two Scribe-deployed Claude Code agents, sequential. **Verifier:** the Scribe, independently after each and across the batch.

## Rulings implemented (Dennis, 2026-08-28, verbatim intent)

**The wet weight record becomes a header + weights ledger:**
1. Lead replaces Person on this station (mechanism unchanged).
2. HBN at top, non-editable, derived from the left pane, with the farm spelled out after a plain spaced hyphen (26240-ARL-... - Arlington). Farm display names set by migration 0006: Arlington, Penn South, **Penn North (Scribe guess, flagged; editable in Admin, Lookups, where a Farms section now exists)**.
3. Bucked and spear weight fields removed from the form (columns remain in schema; spear dropped from the edit page).
4. Move To replaces Dry Space, options filtered by farm (config MOVE_TO_KINDS_BY_FARM: ARL hang+truck, PNS truck, PNN silo+truck; unknown farm sees all). Trucks are dry_spaces rows of kind truck; an Add a truck control mints Truck N inline.
5. Notes is a single line.
6. The Weights pane: Start lot creates the lot (status weighing); Add a weight appends ledger rows (new wet_weights table, migration 0006); each weight carries pencil (edit) and x (void), both reasoned per house law; the total renders outside the pane at the bottom; the lot's weight_grams is the live total, recomputed inside the same transaction on every add, edit, and void, so downstream surfaces read it unchanged.
7. Finish lot (requires at least one weight): truck destination sends the lot to the new **Inbound Queue** (status in_transit, grouped by truck); any other destination sends it to the Dry Space Queue (drying), change-logged transitions either way. Interrupted lots resume from links on the picked page.

**ES/EN pill on every page:** locale cookie + /locale route; src/i18n.ts dictionary (52 entries, proper Spanish); chrome and operator surfaces translate, admin tables and log stay English this slice; unknown strings fall back to English silently; stored identifiers stay English.

**Interco Logistics, orange barreled:** muted amber-edged tile on home linking /interco, a stub page saying so.

## Scribe verification (independent, verbatim)

```
npx tsc --noEmit          TSC_CLEAN
npx vitest run            Test Files 5 passed (5) / Tests 73 passed (73)
node --check smoke.mjs    parses
wrangler d1 migrations apply (fresh local persist)   21 checkmarks: 0001 through 0006 all applied
Em/en dash audit across src, test, scripts, migrations: 0 files

Sealed final check (bytes, sha256 first 16):
999    67e3ffe02eb938b4  migrations/0006_wet_weights.sql
4428   73145c604eca65a4  src/config.ts
12074  947b1ab6878d6d9c  src/pipeline.ts
14326  d508e188fa22d430  src/db.ts
29950  b67d1bea8bf8e63e  src/actions.ts
22194  58bd6aeb6c92e5ac  src/html.ts
7645   404434bf184d1696  src/theme.ts
7910   5df46fd685be6e4a  src/pages.ts
13738  7a78934eb45e6da3  src/index.ts
4073   5d9a17903d453947  src/i18n.ts
4289   72bf757105ec2ffd  test/routing.test.ts
13661  2bd3b9a632560f36  test/surface.test.ts
4991   6f2fc8e1b2401fbc  test/i18n.test.ts
17728  0ce944b1638a0133  scripts/smoke.mjs
```

The e2e smoke cannot run in the Scribe sandbox (workerd); live verification follows the deploy.

## Accepted deviations (full detail in the agents' reports)

Two indexes on wet_weights; farm-to-destination filtering is UI-only (server accepts any dry space; tighten on request); the derived lot total is not double-logged (the ledger rows are the audit trail); weight edits and voids demand a reason per house law even mid-lot (friction flag for the owner); lot page renders without the left pane; home tile titles and tab titles also translate; "Admin" stays "Admin" in Spanish.

## Deploy

From app/: `npx wrangler d1 migrations apply gripfactory-lite-grip --env grip --remote` (applies 0006, including the farm name updates), then `npm run deploy:grip`.

## Open

Inbound Queue has no unload/receive flow yet (that is the B12-B14 territory of the map); in-transit lots are corrected via reasoned edits until that box opens. Spanish coverage extends on request.
