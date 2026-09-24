# Session report: extraction law, App config home, lot code = last 5 (slice 16), 2026-09-01

**Sitting:** cloud Scribe; extraction and config home by a Scribe-directed code agent, the lot display law applied by the Scribe directly under G-2; all verification by the Scribe.
**Canon:** folded at 0.13.1. **Deploy: PENDING, migrations 0013 + 0014 ride it.**

## Rulings (owner, 2026-09-01)

Yield: "ratify 22 but place the home of the 22 in the lookups section of Admin." Extraction: "Trim and BIO only. I would add that Kief and Mix are no longer menu items, might as well remove them from everything." Alpha feedback: "Noticed run away serialization on the lot code, should always be the last 5 of the HBN."

## What changed

- migrations/0014_extraction_codes.sql: app_config extraction_type_codes = TRIM,BIO; package_types MIX and KIEF soft-deleted.
- Extraction pool = created packages with a configured type (bound placeholders; parseExtractionCodes with TRIM,BIO fallback); the PROVISIONAL marker retired; SMALLS and WASTE excluded.
- Admin, Lookups gains the App config section: key, value, updated_at, reasoned Edit only (no Void, no Add; voidRecord refuses app_config; blank values refused); the sheet's yield note points at Admin, Lookups.
- Lot code display law: shortLotId and SHORT_LOT_ID_SQL render the HBN's last 5 alone everywhere; the serial-plus-tag pair survives as travelerLotId for the parked traveler printing.
- Alpha feedback logged in canon 0.13.1 for talk-through: grow-to-processor manifests, cryo type + waste before commit, SalesHelper netting relay, overissue-before-METRC guard.

## Scribe verification

npx tsc --noEmit clean; vitest 261/261; migrations 0001-0014 apply clean on fresh persist (twice); node --check smoke; full smoke SMOKE PASS run by the Scribe after each layer (extraction slice, then the lot display change); byte-level dash audit 0 on every touched file.

## Sealed final check

```
959 migrations/0014_extraction_codes.sql
47c7411ed8eac126dbe75cb9f5810a71795ed9ed6d40d21172150be803cb7fcc  migrations/0014_extraction_codes.sql
13273 src/config.ts
b8516cdf03d3f3dfe2b65652f43d4e4151e1a1972cca6140a683460f39496862  src/config.ts
33414 src/db.ts
fccd9280ea8da023121d8fa1a48183cbc7285f28e52f0e4c40ace4a7aef0113b  src/db.ts
29856 src/index.ts
3075ac5cfcf27754c33ca3588cbeb5abf9e8eabbcd9e17b5cee3993880247aa4  src/index.ts
15055 src/inventory.ts
d7ee9b4a7cdc15c0d903e82586613706e9c0bc2ea9c8f544eeeffe82959c9332  src/inventory.ts
52590 src/html.ts
f4c7896b3eaae01c3e0f1c6b94d3c9b2af4931e69e93821c4e0da23ec545904c  src/html.ts
14212 src/i18n.ts
b71f17be82557b00ed6c68d4c7b9830b6f7e353d91ae3fd3e292550c25b76fb8  src/i18n.ts
18784 src/pipeline.ts
bc349e8ac5a7651dffcc250569e41caae10b60e3940dcc0f10a95988182d8cd0  src/pipeline.ts
41660 src/actions.ts
1060827478f8e06271587a6e71f7e349ff4956a3d70e30ab96a04820f7f65147  src/actions.ts
9591 src/pages.ts
ce77721543b79d0ec1463204c9caaee58a56821e9b9e7b4e14e93d0379cc4598  src/pages.ts
17012 test/routing.test.ts
e018892724d3a6e9b91f8ba91abc0bcd26b50e5b0658a4c024960b8fcac907c1  test/routing.test.ts
16039 test/inventory.test.ts
fc877f6c91b880fcae463b2b386f142d6f12bf0a9910d22c14f2cc42ae94019a  test/inventory.test.ts
54409 test/surface.test.ts
fe305395cde10e243daba172870b5ee4fbcb0ceb90ee55182bb5d424b6a7adee  test/surface.test.ts
2491 test/audit.test.ts
b30371060a597d5d51a3793d8c5d9081943bfd0ff6f57152576c54bcf158e68f  test/audit.test.ts
13423 test/i18n.test.ts
6aaccd9c62b52c6c606bcfc07e011ff0d96339e41f552b0d195aaca1b487dfd9  test/i18n.test.ts
74391 scripts/smoke.mjs
e5d21713e370ccc027d2288948094d36bfd950cf2c30d0b62c7a9e6cf83e44c5  scripts/smoke.mjs
60241 /home/claude/canon/CANON.md
16a5457866a784fcfb18fcb38fb0aba47442a6e559e159214217db5114dd690b  /home/claude/canon/CANON.md
4493 /home/claude/canon/_NOW.md
52fd1b20a6ec4783ced5d3924bb59fd78406a8d920ff2511feaa9daf730dc36f  /home/claude/canon/_NOW.md
13649 /home/claude/canon/MEMORY.md
8978f877f818876b1b73c9ec580f34c0c2c8a5a4952bdc3ea1bce854e8f8a91e  /home/claude/canon/MEMORY.md
```
