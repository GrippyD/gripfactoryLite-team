# FB1: the fulfillment board in pounds (2026-10-29)

Branch `fb1-fulfillment-lbs`, cut from main `1fcece9` (canon 0.30.564). Nothing was deployed. Nothing was merged. No remote D1 command was run. `canon/` and `prompts/` were not edited. Migration `0124` was not copied onto this branch.

## What an operator sees

On Shipping Today, Submitted, and Accepted, wherever those three cards render, Bulk Bud and split Prepack read in lbs only. One pound is 448 grams (`GRAMS_PER_LB`). The figure is two decimals, rounded half up, with thousands grouped, and the label is `lbs`. A positive figure under one hundredth of a pound reads `<0.01 lbs` (one 3.5 g bag). The page source escapes the less-than so the rendered words are `<0.01 lbs`.

Prepack is entered on `/admin/lookups/fulfillment_override` as one row per bag size from `prepack_units` (default 3.5, 7, 14, 28 g): "Prepack 3.5 g" and the same shape for the other sizes, counts in ea. A cell is `row_key` `prepack@<size>`, `bag_grams` written at save. The card shows one line, `Prepack N lbs`, from the sum of count times `bag_grams`, divided by 448. The other eight rows keep their g or ea text. The Admin grid keeps entry units.

A live row whose `row_key` is still `prepack` (no bag size) stays as it was. It is not split, rewritten, or given a guessed size. The grid shows it read-only as "Prepack (unsplit, legacy)", and a Clear soft-deletes it with reason `cleared`. The card shows "Prepack (unsplit) N ea" with `data-fulfill-legacy`. That count is not added to any lbs figure. In the bar it still uses count times the `fulfillment_unit_grams` prepack figure. A new unsplit Prepack count is refused: "A Prepack count needs a bag size."

The Shipping Today trailer carries the Grip mark from `app/public/brand/grip.svg`, the path `d` copied byte for byte (6,767 characters). Outline only, the icon's own stroke, scaled to the full height of the trailer panel and centered in it. It is drawn on empty days too. Submitted and Accepted do not get it. The bar segments are unchanged.

## Rulings taken

The dispatch answered R8 (legacy rows stay flagged, read-only, and out of the lbs totals, with no guessed splits), R9 (LD1, migration 0124 on `GFLiteOpsDashboard`, deploys first, then FB1), and R11 (a new Prepack entry with no bag size is blocked).

R10 was not answered. The safe default in the brief stands: `fulfillment_unit_grams` is not changed, and `prepack=28` remains the bar measure for a legacy unsplit row only.

A positive figure under 0.01 lb shows `<0.01 lbs`, from the dispatch, in place of the brief's standing line that a non-zero figure rounding to 0.00 still reads `0.00 lbs`. Zero still reads `0.00 lbs`.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0125_fulfillment_prepack_bags.sql | 298 | b8d84f3b4ec8b9d06eee5b8e9b6be64198637d18225417567689431579e0994f |
| app/src/consoleicons.ts | 33288 | 926bd8e71ee764a8ccfa0020077aa25735832b67d006ba999739c643c33c5908 |
| app/src/fulfillmentboard.ts | 21658 | feb6adaa82a1ef8d5c574234c2637af5ed74ef721707db15b1be7544bd275b77 |
| app/src/i18n.ts | 404682 | 279c3768e58d6b3786b94164eb3a0b137cb3dcc357335e0dd31adbcbf87d03a3 |
| app/src/index.ts | 209392 | 2c7532269027a78935513d2ed8e96094cf5755673bf480b599dae1b93c664995 |
| app/test/fulfillmentboard.test.ts | 24383 | 3ca5df39c434d5aedf5183355e5fffb3b44cc17d0fb4f88acfca6ab0f159dc93 |
| app/scripts/smoke.mjs | 985291 | 28f5e169ba5e9f262f817e774aaa97d64efd50869eacd01f3df99e2755aa5e3c |

`GRIP_MARK_PATH` equals the `d` attribute of `app/public/brand/grip.svg` (6,767 bytes of path data). Dash and CR scan of the seven files: U+2013 0, U+2014 0, CR 0.

## Sealed final check

```
FILE app/migrations/0125_fulfillment_prepack_bags.sql
BYTES 298
SHA256 b8d84f3b4ec8b9d06eee5b8e9b6be64198637d18225417567689431579e0994f
TAIL
-- Nullable, no default, so a row typed before this column keeps bag_grams empty.
-- Nothing else moves: no index change, no seed, no rewrite of a standing row.

ALTER TABLE fulfillment_overrides ADD COLUMN bag_grams NUMERIC;
---
FILE app/src/consoleicons.ts
BYTES 33288
SHA256 926bd8e71ee764a8ccfa0020077aa25735832b67d006ba999739c643c33c5908
TAIL
export function consoleIconSvg(name: ConsoleIconName, options?: ConsoleIconOptions): string {
  const label = options?.label === undefined ? CONSOLE_ICON_LABELS[name] : options.label;
  return root(name, BODIES[name](), name === "shipping", label, options?.className);
}
---
FILE app/src/fulfillmentboard.ts
BYTES 21658
SHA256 feb6adaa82a1ef8d5c574234c2637af5ed74ef721707db15b1be7544bd275b77
TAIL
  }
  if (stmts.length) await db.batch(stmts);
  return { redirect: `${FULFILLMENT_OVERRIDE_PATH}?date=${encodeURIComponent(date)}&ok=saved` };
}
---
FILE app/src/i18n.ts
BYTES 404682
SHA256 279c3768e58d6b3786b94164eb3a0b137cb3dcc357335e0dd31adbcbf87d03a3
TAIL
export function refusalText(locale: Locale, err: { message: string; words?: { key: string; vars: Record<string, string> } }): string {
  if (locale === "en") return err.message;
  return err.words ? tFill(locale, err.words.key, err.words.vars) : t(locale, err.message);
}
---
FILE app/src/index.ts
BYTES 209392
SHA256 2c7532269027a78935513d2ed8e96094cf5755673bf480b599dae1b93c664995
TAIL

const worker = { fetch: app.fetch, scheduled };
export { app };
export default worker;
---
FILE app/test/fulfillmentboard.test.ts
BYTES 24383
SHA256 3ca5df39c434d5aedf5183355e5fffb3b44cc17d0fb4f88acfca6ab0f159dc93
TAIL
    expect(pane(empty, "accepted")).not.toContain("data-fulfill-grip-outline");
    expect(empty).toContain("No figures typed for this day.");
  });
});
---
FILE app/scripts/smoke.mjs
BYTES 985291
SHA256 28f5e169ba5e9f262f817e774aaa97d64efd50869eacd01f3df99e2755aa5e3c
TAIL
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
---
PATH_MATCH True 6767
EM 0
TSC_EXIT:0
```

`npx tsc --noEmit` from `app/`: exit 0, no diagnostics.

`node --check scripts/smoke.mjs` from `app/`: exit 0.

Vitest `TZ=UTC`:

```
 Test Files  127 passed (127)
      Tests  1757 passed | 6 skipped (1763)
   Start at  14:08:21
   Duration  28.94s (transform 5.16s, setup 0ms, import 23.68s, tests 51.50s, environment 8ms)
```

Vitest `TZ=America/New_York`:

```
 Test Files  127 passed (127)
      Tests  1757 passed | 6 skipped (1763)
   Start at  10:08:58
   Duration  31.73s (transform 5.72s, setup 0ms, import 25.51s, tests 56.92s, environment 9ms)
```

From-zero smoke: exit 0. The apply line is `About to apply 123 migration(s)` (0001 through 0123 with the 0101 gap, plus 0125). `SMOKE PASS`. Lines containing ` 500 `: 0.

## Deploy note

This branch does not contain migration 0124. LD1 on `GFLiteOpsDashboard` must be merged to main and deployed first, so 0124 applies before 0125. Then FB1.
