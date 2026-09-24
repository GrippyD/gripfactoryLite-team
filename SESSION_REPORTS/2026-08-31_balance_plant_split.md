# Session report: balance law + plant tag organic split (slice 13), 2026-08-31

**Sitting:** cloud Scribe, build by a Scribe-directed code agent, verification by the Scribe.
**Canon:** folded at 0.11.0. **Deploy: PENDING** (migrations 0011 + 0012 ride the shared deploy).

## Rulings (owner, 2026-08-31, verbatim)

Balance: "The weights of the original package and what's left after a record is created should be on the weight recording pages." Clarified: unload, the future inventory transfer, trim, all of them except wet weights (upstream of wet is plant count, untouched by this system).
Plant fill: "We use randbetween in excel right now where the weight per plant is nominally the same, but the data looks organic. The total of each randbetween value must combine to the actual total wet grams weighed."

## What changed

- Balance displays: Unload panel shows Original (wet) and Remaining (wet minus dry recorded, may go negative, rule of thumb); Trim picked view shows Original (dry), Recorded, Remaining; Cryo picked row shows Remaining; wet pages untouched; cryo bulk view byte-identical.
- Plant tags: migration 0012 (harvest_plant_tags + app_config plant_split_jitter_pct seeded 10 per L-4); paste form per pending batch (one per line, trim, dedupe, REPLACE semantics audited under tags_replaced; empty paste clears); tag count on the row; the Plant note renders only while a pending batch lacks tags.
- Tagged CSV: one row per tag; tags allocated across finished entries proportional to entry weight (largest remainder); per-entry organic split in cents inside a plus or minus jitter band, deterministic (mulberry32 seeded from the batch id, repeat downloads byte-identical), residual cents distributed in-band, cent-exact per entry and in total; rows carry the entry's destination and date; tagless batches keep the read-rows file.
- i18n en/es for the balance and tag strings.

## Scribe verification

npx tsc --noEmit clean; vitest 203/203; migrations 0001-0012 apply clean on fresh persist; node --check smoke; full smoke SMOKE PASS in the Scribe's hands (one transient stall traced to a stale .smoke-persist dir, cleared by removal, gotcha noted); byte-level dash audit 0 on all touched files.

## Sealed final check

```
1530 migrations/0012_plant_tags.sql
e2c5a14c26adb1c8f58973916f3a94d5c90b21bcd34bc56ee3701a4f8ce04478  migrations/0012_plant_tags.sql
9874 src/config.ts
a9ad595190b2c53abce9e597d4860ff688eeb7e4545c6ec664f7f6b66103fef8  src/config.ts
10433 src/csv.ts
af0951c10e00bcbbaecfd72d4318a32b44d0556714856f2d72bb99fcba36ed07  src/csv.ts
26029 src/db.ts
0d5e2eaad63e3adb1e36005f524c77a4add6eca334d69c2ff70c63720d4555da  src/db.ts
38602 src/actions.ts
f601f0da95036928019139e798022bbf269deaaa3bde6848c6ae5c356df15449  src/actions.ts
38021 src/html.ts
dae9da02ada758a07c3f776ee82f9256d76f7530b5e11e594abfb14f25916e16  src/html.ts
26426 src/index.ts
c32f7f1e1ebee41e35bf7e8a4cf13e7b8924ff495d770525a7d4dbe36642aad0  src/index.ts
8432 src/i18n.ts
2fa306a9c301e02a06d71f11c0a3b782f3bde687914a2b22935fafca3127ab60  src/i18n.ts
12054 test/csv.test.ts
61713a6e155fe0fdaac076ce4c25d0cdd92d2a2a36dafc27c7af43acd6e73609  test/csv.test.ts
14668 test/routing.test.ts
92f71825cead2f437992dcbebd10e5a1a4d4337a7520d41e00dad10635ca6e12  test/routing.test.ts
10921 test/i18n.test.ts
8a425752faa9784867e194b72ab08e0261320530fa068d3c9acf63bc8e5160f4  test/i18n.test.ts
48231 test/surface.test.ts
f69ecd8a9222a17762ea70d8eb61a380b3fd6f8af35d1fb6a38d8d4f66a795d0  test/surface.test.ts
53363 scripts/smoke.mjs
c796977386f83d627b8b9ce644bb4ed76362ac54fb037df13e1eae5b2bbf8b6e  scripts/smoke.mjs
52584 /home/claude/canon/CANON.md
7bddfcbb10414a7de3378ecf63d571e320d72f748a09db0e578ac9c2352daf10  /home/claude/canon/CANON.md
3872 /home/claude/canon/_NOW.md
2bf754088bf14fae39c3b6393f11b17ae8420957d57d7a5ae33265c746f7c3dc  /home/claude/canon/_NOW.md
12078 /home/claude/canon/MEMORY.md
b6d11a01590aae5fea506978bb928e91ef1733b670ae0a74c7cbd01e2ae330df  /home/claude/canon/MEMORY.md
```
