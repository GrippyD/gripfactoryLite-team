# 2026-09-27 The prepack available pane reads one list

Brief O, THE PREPACK AVAILABLE PANE READS ONE LIST (canon 0.30.238). No migration. The head stays 0076. Not deployed. Nothing committed.

## What changed

The fold marker and the heading sit on one line. The summary rule that kept an `h2` inline with the marker now keeps an `h3` there too, in Lite, Continuum, and Cerberus. The count badge stays on that line.

From METRC is gone. There is no separate section, no `Nothing to adopt.` line, and no `known` or `new from METRC` on a row. A stranger's HBN line is the HBN alone, the same way an app row reads it. A stranger whose lineage names no harvest still shows the muted line and still has no `>>`.

Each stranger files under one of the grow headings. A package whose harvest is already a batch uses that batch's grow method. Otherwise the heading is the live method whose code matches the grow code `parseHbn` reads from the HBN (ID Indoor, OD Outdoor, GH Greenhouse). Unknown is the heading when there is no harvest, the harvest is not a seven-part HBN, or no live method carries the code. A heading that only strangers fill is drawn like any other.

Within a heading the app's rows come first, in the order they already had, then the strangers by tag. The heading count and the Available count include them. The stranger's `>>` still posts its tag to the pane's schedule form. Scheduled, Complete, the effective date, and the filter box are unchanged.

## Assumptions for your word

- App rows come before strangers inside a heading. Strangers follow by tag.
- `known` and `new from METRC` are retired with the section. The HBN line is the HBN alone.
- Unknown is the heading when the harvest is missing, `parseHbn` refuses it, or no live method carries its grow code.
- A stranger on a batch the app already has uses that batch's method, even when the HBN's own code would name another.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 61 files, 932 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9181`, `WRANGLER_SEND_METRICS=false`): `About to apply 76 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The stranger sat under its grow heading, the heading count included it, its `>>` adopted and scheduled, and no From METRC section was served.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. No migration.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        61 files, 932 tests passed
TZ=America/New_York npx vitest run    61 files, 932 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9181 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 76 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
```

```
src/i18n.ts                  177784  b70e3fde8c7371c8
TAIL }
src/metrc.ts                  87588  bc4a4ca51f4b9530
TAIL }
src/scheduling.ts             45973  e2d843abe0d476d1
TAIL }
src/theme.ts                 156898  2912de0e4808c560
TAIL }
scripts/smoke.mjs            611452  427739d9d7953de4
TAIL });
test/metrc.test.ts            64074  86cb14deb70e96d0
TAIL });
test/prepackonelist.test.ts    6548  2c77ae9faeae7212
TAIL });
test/scheduling.test.ts       21411  0a9b49402684683b
TAIL });
```
