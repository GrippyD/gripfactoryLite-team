# 2026-09-23 The gate on the HBN as the real strain and >> adopting (canon 0.30.203)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-23_hbn_real_strain_and_adopt_arrow.md` (brief H, THE HBN IS THE REAL STRAIN, AND >> ADOPTS, canon 0.30.200; no migration). The report says "Not deployed from this session"; nothing was deployed before this gate. No Scribe change to `app/`.

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 11:43 device time, the report at 11:46; the gate began after his hand-back) and compared with the Scribe's sandbox, which held the tree of canon 0.30.199 (the four lines, deployed as 0.30.202) byte for byte. Nine files differed, exactly the nine of the report's seal, none new; the 196 others hash identical on both sides (the unchanged part of both lists at ac142bb1023abcb1). After the copy the two trees hash identical (adfdea689ba17e70, 205 files). No migration moved; the head is 0073.
2. The nine were staged, verified against the seal (size and sha256, all nine), copied into the sandbox and verified again there.
3. Read against the brief's four laws. THE HBN IS THE REAL STRAIN: `mintMetrcBatch` takes the one live strain whose `hbn_code` is the fourth segment as `parseHbn` reads it, `market_strain` METRC's strain name through `inheritMarketStrain` (a blank name inherits the real strain's own name); `strainForMetrcBatch` is gone; no code refuses `{hbn} cannot be adopted: no strain carries code {code}; add it in Admin, Lookups, Strains.`, two or more refuse naming them A to Z; either refusal inserts nothing; the ledger item carries the batch's strain on both paths; a known batch is not rewritten. >> ADOPTS AND SCHEDULES: From METRC rows are pane items with `>>` on the shared schedule form (`name="tag"`, title `Adopt and schedule`), the effective date and `q` riding; the schedule route sends a posted tag to `adoptFromMetrc`, which writes the batch when new, the package, the ledger item and one prepack schedule row in one `db.batch`, the schedule row logged as any `>>` (`schedule`); `ok=adopted&n=1` flashes `Adopted and scheduled 1.` (`Adoptado y programado 1.`); `<<` unschedules and leaves the adoption; a row with no harvest has no `>>`; the Adopt button, the per-row form and the adopt route are gone. THE WORDS: Spanish on the two refusals, the title and the flash; `Adopt` and `Adoptar` left the dictionary. NOTHING ELSE MOVES: the four lines, the filter, the markers, the hop, `hbnFromMetrcName`, the mirror release, Trimming and Pasteurization untouched; `console.ts`, `db.ts`, `prepack.ts`, `metrc.ts` and `mint.ts` did not move.
4. THE LANDING, READ IN THE DATABASE. The smoke's local D1 after the walk: two METRC-born batches, `46258-PNN-ID-062-0-NA-26007` (open, born from METRC, strain Super Boof at 062, market strain Donny Burger, license AU-P-000694, entry date 2026-09-15 the packaged date) and `46299-PNN-ID-099-0-NA-26099` (strain Code Ninety Nine at 099, the strain the smoke added in Admin after the refusal, market strain Mystery Market); no strain named Donny Burger or Mystery Market; zero strain rows logged under `adopted from METRC` (the log tables are `harvest_batches`, `local_inventory_items`, `wip_packages`; the schedule rows log under `schedule`); three adopted packages (`...000105` 751 g on the minted 26007 with no lot, `...000D01` 40 g on the smoke's own 26011 with its lot, `...000E99` 12 g on 26099), each released and passed, each with a prepack schedule row dated 2026-09-23, the D01 row voided `unscheduled from the working pane` after `<<` with the adoption in place; every adopted ledger item's strain is its batch's strain (3 of 3); 21 packages in the table; no 500.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 49 files, 851 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9086`, the DROPS copy of the In Testing workbook present): `About to apply 73 migration(s)`, `SMOKE PASS`, no 500; exit 0 once the dev server was ended by pid (the sandbox note of 0.30.189).
- Dash audit: 0 on the nine files and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfas[t]_`): no matches in the slice.

## His word: the nine assumptions

All nine stand as the brief asked, read against the code and the database. The refusal wordings, the exact fourth segment, the flash, the effective date with the PIN for another day and its override log, `<<` leaving the adoption, the blank name inheriting the real strain, the market name over the real strain on the four lines, the known batch untouched, `Adopt` gone from the dictionary.

## The floor before the adoptions: the ops dash disagrees with two of METRC's names

Read in `26H.Operations Dashboard .xlsm`, Harvest Details (35 HBN rows), on his word. The 46xxx tokens are Excel date serials (10 of 10: 46223 is 2026-07-20, 46248 is 08-14, 46254 is 08-20, 46258 is 08-24, 46268 is 09-03); the 26xxx tokens are YYDDD (25 of 25). The nine historical HBNs 26001 to 26009 are not in the app (canon 0.30.55: the historical lots wait to be entered). Against the four harvests the strangers name:

- `46248-PNN-ID-062-1-NA-26002`: the sheet's row exactly (2026-08-14, PNN, Indoor, Super Boof, manicure Yes, tag 1A40503000311FB000053532). Strain by code gives Super Boof: right.
- `46268-PNN-OD-078-0-NA-26009`: the sheet's row exactly (2026-09-03, PNN, Outdoor, tag 1A40503000311FB000053538), but the sheet's strain is Banana Berry Wine, whose code on the sheet's Abbr tab is 078; the app carries Banana Berry Wine at 096 and Blue Andeez at 078 (0033 moved BBW off the colliding 078). Strain by code would mint Blue Andeez: wrong.
- `46254-PNN-ID-005-1-NA-26004`: not a sheet row. The sheet has `46254-PNN-ID-005-1-NA-26003` (08-20, manicure Yes, tag ...53536) and `46258-PNN-ID-005-0-NA-26004` (08-24, manicure No, tag ...53537), both Apple Fritter, PNN, Indoor. Strain by code gives Apple Fritter: right; the date is 08-20 by the token or 08-24 by the serial.
- `46258-PNN-ID-062-0-NA-26007`: not a sheet row. The sheet's 26007 is `46258-PNN-ID-077-1-NA-26007`, Heir Heads, manicure Yes, 08-24 (two rows, tags ...53530 and ...53531). METRC's name carries 062 for a Heir Heads lot; the package's METRC strain, Heir Heads, is the real one there. Strain by code would mint Super Boof: wrong.

So the law is right and two of METRC's names are wrong, and the app can only mint from the name it is given. The way through is the one canon 0.30.55 already names: enter the historical lots first, as known batches with METRC's exact strings and the sheet's strains and dates, so `>>` inherits them and mints nothing. Admin, Manual HBN takes a hand-typed HBN verbatim (any first segment, any strain code) with the date, farm, grow method, strain, the METRC harvest tag and a reason; it writes manicure No and the strain's name as the market strain, which matches the sheet for all nine. His pick is put to him on the question tool with the nine lines ready. Also read, for later: the sheet carries market strains the app's own batches lack (26011, 26013, 26014 Wild Mango Creamsicle; 26017, 26019 Detroit Diesel; 26025 Meat Breath; 26026 Mendo Breath; 26027 Permanent Marker; 26036, 26037 Banana Zelato), and two HBN strings differ between the two (26016 silo 01 on the sheet, NA in the app; the sheet's 26028 and the app's 26029). A Harvest Details import would reconcile all of it; his call.

## Deploy (his hands; worker only, no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

Safe to deploy now: nothing adopts without a `>>`. HOLD the `>>` on the four METRC-born harvests until the historical lots are entered or his word says otherwise; the six strangers on the app's own lots (26011, 26013, 26014, 26015, 26018, 26021) adopt correctly today.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        49 files, 851 tests passed
TZ=America/New_York npx vitest run    49 files, 851 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9086 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 73 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (9 files) verified byte for byte on the device and in the sandbox:
src/actions.ts                                282588  03bb3d155fbcd5de
src/scheduling.ts                              21102  2697a7217fd13061
src/index.ts                                  132266  406a2994dd0633b0
src/i18n.ts                                   158335  4b5978dc9cec89a0
src/theme.ts                                  154300  87d9016e00f42101
test/metrc.test.ts                             61563  1be41edc9b95f939
test/scheduling.test.ts                        21837  cadd3541bf11222e
test/prepack.test.ts                            9179  548baa055aba2a9f
scripts/smoke.mjs                             563257  f151eaa68e4d38cc
tree hash after the copy, device and sandbox: adfdea689ba17e70 (205 files)
the build report: SESSION_REPORTS/2026-09-23_hbn_real_strain_and_adopt_arrow.md  5853  59269e068db8b9ad
dash audit: 0 on every file above
secret grep: no matches
```
