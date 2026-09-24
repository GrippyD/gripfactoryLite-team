# 2026-09-23 The HBN is the real strain, and >> adopts

Brief H, canon 0.30.200. A METRC-born batch takes the live strain whose code is the HBN's fourth segment, and METRC's strain name as its market strain. The From METRC control is `>>`, and that one press adopts the package and schedules it. No migration. The head stays 0073. Not deployed.

## What landed

- `mintMetrcBatch` sets `strain_id` to the one live strain whose `hbn_code` is the fourth segment, as `parseHbn` reads it. `market_strain` is METRC's strain name through `inheritMarketStrain`, so a blank name stores the real strain's own name. `strainForMetrcBatch` is gone. Adoption never mints a strain and never matches one by name.
- No live strain for that code refuses with `{hbn} cannot be adopted: no strain carries code {code}; add it in Admin, Lookups, Strains.` Two or more refuse with `{hbn} cannot be adopted: code {code} belongs to {strains}; fix the codes in Admin, Lookups, Strains.` The names are listed A to Z, comma separated. Either refusal inserts nothing.
- The ledger item carries the batch's `strain_id` on both paths. A known batch is not rewritten.
- From METRC rows are pane items. The control is `>>` on the Available pane's shared schedule form (`name="tag"`), title `Adopt and schedule`. The effective date and the filter's `q` ride with it. A row with no harvest has no `>>`. The Adopt button, the per-row form, and `/production/scheduling/prepack/adopt` are gone.
- The schedule route sends a posted tag to `adoptFromMetrc`. That writes the new batch when the harvest is new, the package, the ledger item, and one prepack schedule row, in one `db.batch`. The schedule row logs as any `>>` does (`schedule`). The redirect is `ok=adopted&n=1`, and the flash reads `Adopted and scheduled 1.` `<<` unschedules the row back to Available. The package stays adopted, source `metrc`, still carrying its HBN.
- The four lines are unchanged. With a market strain set, they read that name over the real strain.

## Assumptions for your word

- The two refusals are worded as above. Two strains that share a code are named A to Z, separated by a comma and a space.
- The code compared is the fourth segment exactly as `parseHbn` reads it. `062` matches Super Boof. A shorter or longer token would not.
- The flash is `Adopted and scheduled 1.` Spanish is `Adoptado y programado 1.`
- The effective date at the top of Available rides the adoption. Today needs no PIN. Another day needs the Admin PIN, and that override is logged on the schedule row.
- `<<` takes the package off the schedule and leaves the adoption in place. There is no un-adopt.
- A blank METRC strain name stores the real strain's name as the market strain.
- The four lines, and every other place that already reads `COALESCE(market_strain, strain name)`, show the market name over the real strain. A 062 harvest whose METRC name is Donny Burger reads Donny Burger. The batch's strain is Super Boof.
- A known batch keeps the strain and market strain the app minted. The ledger item takes that strain, not a match on METRC's name.
- `Adopt` and `Adoptar` left the dictionary. Nothing reads them.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 49 files, 851 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9152`, `WRANGLER_SEND_METRICS=false`): `About to apply 73 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. `>>` on the known stranger and on `46258-PNN-ID-062-0-NA-26007` each landed in Scheduled with the flash `Adopted and scheduled 1.` The minted batch is born from METRC, strain Super Boof, market strain Donny Burger, and Donny Burger is not a strain in Lookups. The four lines read `Donny Burger - 751 g`. `<<` returned the known package to Available still carrying its HBN. A harvest with code 099 refused in words, left no batch and no strain, and the same `>>` landed after a strain was added at 099 in Admin, Lookups, Strains.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`. `453.59` remains the one METRC comment in `src/config.ts`.

## Browser

On the smoked local database the Scheduled pane read `Mystery Market - 12 g` under `46299-PNN-ID-099-0-NA-26099` and `Donny Burger - 751 g` under `46258-PNN-ID-062-0-NA-26007`, each with `<<` and `>`. From METRC read nothing to adopt. The package `<<` had returned stood in Available, still under its HBN, with `>>`.

## Deploy

Not deployed from this session. The Scribe gates the report and hands the worker-only block. No migration rides.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        49 files, 851 tests passed
TZ=America/New_York npx vitest run    49 files, 851 tests passed
node --check scripts/smoke.mjs        exit 0
Remove-Item .smoke-persist; SMOKE_PORT=9152 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 73 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

app/src/actions.ts                    282588  03bb3d155fbcd5de  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/scheduling.ts                  21102  2697a7217fd13061  tail: }
app/src/index.ts                      132266  406a2994dd0633b0  tail: export default worker;
app/src/i18n.ts                       158335  4b5978dc9cec89a0  tail: }
app/src/theme.ts                      154300  87d9016e00f42101  tail: }
app/test/metrc.test.ts                 61563  1be41edc9b95f939  tail: }
app/test/scheduling.test.ts            21837  cadd3541bf11222e  tail: });
app/test/prepack.test.ts                9179  548baa055aba2a9f  tail: });
app/scripts/smoke.mjs                 563257  f151eaa68e4d38cc  tail: });
```
