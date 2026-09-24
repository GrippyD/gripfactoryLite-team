# Session report: thousands separators on displayed grams (slice 12), 2026-08-31

**Sitting:** cloud Scribe, build by a Scribe-directed code agent, verification by the Scribe.
**Canon:** folded at 0.10.1. **Deploy: PENDING** (shared).

## The ruling (owner, 2026-08-31, verbatim)

"add commas to all thousands please. We're going to be dropping millions of grams and these numbers in test are starting to read like barcodes"

## What changed

- formatGrams in src/config.ts (deterministic comma grouping on toFixed(2); blank/null passthrough; negatives grouped); GRAM_FIELDS moved to config.ts and extended with dry_weight_grams.
- Applied at every HTML gram render: queue tables and Data Queues, pane and option labels, picked headings, cryo tables (bulk and picked), lot panels (rows, Total, Dry total), resume links, uploads page wet total.
- RAW by law: METRC wet weights CSV, queue CSV exports, form input values, change log stored values (comments cite the ruling). Counts, truck numbers, serials, dates untouched.
- Tests: formatGrams unit suite; every pinned HTML gram updated to the comma form; explicit raw-CSV guards (no grouped weights in either CSV). Smoke pins updated with a no-grouped-weights regex guard on both CSVs.

## Scribe verification (combined tree, slices 11 + 12)

npx tsc --noEmit clean; vitest 176/176; migrations 0001-0011 clean; node --check smoke; full smoke run by the Scribe: SMOKE PASS; byte-level dash audit 0 on all touched files.

## Sealed final check (combined tree)

```
1254 migrations/0011_metrc_uploads.sql
97573bc550016aa98e8e03a153ca1f482cd25e6020f4f6917917b5ace8e10ae6  migrations/0011_metrc_uploads.sql
9149 src/config.ts
cf3f46b711b3b6538a69d44d09354044f96622ac0ba44c5502b8b3fce07da40a  src/config.ts
2946 src/csv.ts
9728580a05ffcd086951d5c2a6bfe5854d710b3361e24be3baad00146ea85cb3  src/csv.ts
22929 src/db.ts
bdc086cf543934c4afefbb29d72bc8a823245af35180aacaaa7746e4876a842c  src/db.ts
35674 src/actions.ts
2fee797256d8c03d184b500e721d6011dc798c34a1b2db6cff20f427c35b1271  src/actions.ts
34685 src/html.ts
45fa6f45ef8cc70cb5b1c86ec570b6b55cf7f7cba07733e3606799070068a367  src/html.ts
24182 src/index.ts
c3d25afd347ba008699194a9aaaa7bc3bb46194acb73586c33a4c7ccbe4cb924  src/index.ts
7463 src/i18n.ts
eb7c1170e1acdfd6f9e7ea84164c89053d4f5b2d1bd6fb819212935303e0e87b  src/i18n.ts
8517 src/pages.ts
8bd578e745b2f9207c85732d1a135c881ffc004bf21820395961f9f96fe5a74a  src/pages.ts
43507 test/surface.test.ts
65168a98a45e15b85f5562254cc416def8b59fbe2634a566a27a30fc300bf6d1  test/surface.test.ts
13988 test/routing.test.ts
44942c2b2d8eff864ecaf57134a29129c44e8bccfd080482ef9f7acec5bab27a  test/routing.test.ts
9815 test/i18n.test.ts
604f310189b91fc2d62d505e1a9c7e6d0d1ea884effab1f80497f2c680481b4b  test/i18n.test.ts
3985 test/csv.test.ts
6d49f7d3bdefec0f1c3fdf20b815cbea170949c55b25bff9ef84fdb70152f4e7  test/csv.test.ts
46020 scripts/smoke.mjs
1b78f0b05f121d8139c07256d26247ecaa94b7b30608195875f968245c4aa8ff  scripts/smoke.mjs
19683 /home/claude/deploy/prompts/CERBERUSTHEMEPROMPT.md
48329e963f6a720f0b3b4cc5ddd78ba004874fb61f88200a73a1b7d691e35c8d  /home/claude/deploy/prompts/CERBERUSTHEMEPROMPT.md
50544 /home/claude/canon/CANON.md
bd55b8c799c61e4dba663eff574d0d90de4771a2ded6c37c7b25dec83b7bdb43  /home/claude/canon/CANON.md
3861 /home/claude/canon/_NOW.md
7c78b6205c908b42b0d60f71621118344d604c62fa77a495b3f9164f86841a7c  /home/claude/canon/_NOW.md
11504 /home/claude/canon/MEMORY.md
dec5ebbbdc5149a365a98a427031c22fd9806cdcfa1cbb3b0b63ccc52f55a265  /home/claude/canon/MEMORY.md
```
