# Session report: 2026-08-28, slice 3c, Hang in Place at PNN (destination farm scoping)

**Builder:** a Scribe-deployed Claude Code agent. **Verifier:** the Scribe, independently.

## Ruling (Dennis, 2026-08-28)

Add "hang in place" to the PNN Move To options.

## What shipped

- Migration 0007: dry_spaces gains `farm_code` (NULL = shared); Arlington Dry Room scoped to ARL; new seeded destination **Hang in Place** (kind hang, farm PNN). Silos and trucks stay shared; kind gating already restricts them.
- Config: PNN's allowed kinds are now silo, truck, hang.
- Move To filtering: kind allowed for the farm AND (farm_code NULL or matching). ARL sees Arlington Dry Room + trucks and NOT Hang in Place; PNN sees silos + trucks + Hang in Place and NOT Arlington Dry Room; PNS sees trucks only. Verified by fixture tests and direct local D1 queries.
- Admin Lookups: dry_spaces shows and edits the farm scope (blank means shared); a scoped space can return to shared.
- Bonus fix the agent caught: Admin's "Add dry space" INSERT had a pre-existing bind mismatch and would have failed at runtime; it is correct now.

## Scribe verification (independent, verbatim)

```
npx tsc --noEmit          TSC_CLEAN
npx vitest run            Test Files 5 passed (5) / Tests 76 passed (76)
node --check smoke.mjs    parses
wrangler d1 migrations apply (fresh local persist): 28 checkmarks, 0001 through 0007 all applied
Em/en dash audit: 0 files

Sealed final check (bytes, sha256 first 16):
654    c0484303c2d5186b  migrations/0007_dry_space_farm_scope.sql
4493   6a3aca1451586fc4  src/config.ts
14864  3e0def10165dd7f3  src/db.ts
13748  4e63719c80223eff  src/index.ts
30110  5d71042e3d24f46e  src/actions.ts
8320   edfb1193113a0b16  src/pages.ts
12334  99af0547008b0889  src/pipeline.ts
5423   f09c72e81f06dbd2  test/routing.test.ts
17834  6f48fce2b40ef7a6  scripts/smoke.mjs
```

## Deploy

Rides the already-pending deploy: `npx wrangler d1 migrations apply gripfactory-lite-grip --env grip --remote` (applies 0005, 0006, 0007), then `npm run deploy:grip`.
