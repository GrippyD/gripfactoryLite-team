# PC1b: the plan's export and his headings

Worktree `branches/GFLiteMetrcAPI`. One plain session. No git. Nothing is committed, pushed, or deployed.

## Tree

- Received: `761c04653a9b4851` (435 files, 120 migrations). Canon hash in `app/`, Git Bash marker read as the Linux two space form, `wrangler.toml` already LF. That is the pin, the live tree after PC1.
- Left: `7b0ec6a5152a86e6` (435 files, 120 migrations). Same command.

## Files

- `app/src/prepackplan.ts`: `planRows` adds `grossNeedGrams` and `grossShortGrams`. The table is Strain, Target, Packed (not ordered), On Pack Schedule, Need, Net Need, Ready to pack, Short Product, Net Short. The note sits under the table. Export sits beside Targets. `prepackPlanXlsx` builds the workbook.
- `app/src/xlsx.ts`: optional `autoFilter` on `XlsxSheet`. Unset, the sheet XML is unchanged.
- `app/src/index.ts`: `GET /production/scheduling/prepack/plan.xlsx`.
- `app/src/i18n.ts`: the new words, each with a Spanish line. `Need` stays `Necesidad`.
- `app/test/prepackplan.test.ts`: both needs, the page, the pinned sheet, the export, the route.
- `app/scripts/smoke.mjs`: the nine headings, the export link, and the xlsx bytes.

## Decided

- The workbook is English, headings and as of lines, the same way the house exports are. The page still translates.
- The Zoho stock line is written when a stock mount has a time, the same rule as the fold. With no sales order mount the file carries "No sales orders mounted yet".
- A blank separator row has no cells. `readXlsxSheets` shows it as a skipped row number. Totals sits on the row after that gap. Totals Months is the cover of the summed free weight at the summed pace.
- `autoFilter` is the last row the filter covers, counting the heading as row 1. The last column is the last heading, so the plan writes `A1:M{last strain row}`.
- Weight columns use the writer's pounds style. Months uses the plain number cell. A blank target, a blank pace, and a blank months write no cell.
- On hand, Free, Pace, Months, and per month left the dictionary. The page no longer calls them, and the suite does not require them. `Need` stays, because that heading is still on the page.
- The export route sits on the scheduler path. The identity middleware applies. The Admin PIN does not. That is the page's gate.

## Gates

- `npx tsc --noEmit`: exit 0.
- vitest `TZ=UTC`: Test Files 125 passed (125). Tests 1724 passed, 6 skipped (1730). VITEST_EXIT 0.
- vitest `TZ=America/New_York`: Test Files 125 passed (125). Tests 1724 passed, 6 skipped (1730). VITEST_EXIT 0.
- `node --check scripts/smoke.mjs`: exit 0.
- From zero smoke, background: `About to apply 120 migration(s)`. `SMOKE PASS`. `SMOKE_EXIT 0`. No 500 in the log.
- Dash and CR scan of every touched file: U+2013 0, U+2014 0, CR 0. The lines this slice added name nobody.

## Seal

```
src/prepackplan.ts       34986  53ecceddb8672f623209ff692a5001245cbe21f325d3992fb6290fd2c0558351
src/xlsx.ts              20489  58ddef73fa431716f197c088e394ac9b18c69ae1eaa0f88a101a67ea373acd00
src/index.ts            207646  2529377a098fd702d9e768098ad5eb51d6e285cd7b832236d71feb1bdf48328e
src/i18n.ts             396801  ac0ec930e032e76bcd558b7d2b27226e810d483746022ee43973a65bcd234a53
test/prepackplan.test.ts 37545  d1bdb6ad367f82e6851140128d2374a27f4c93b3503a2db45551e56349ae87ab
scripts/smoke.mjs       969994  26ae504a8f31ed6ddc60607bdc3ba201e9e2f069bd8288eebd62561d4c13c74b
```

Tails:

```
src/prepackplan.ts
    ${table}`;
}
src/xlsx.ts
  return out;
}
src/index.ts
export { app };
export default worker;
src/i18n.ts
  return err.words ? tFill(locale, err.words.key, err.words.vars) : t(locale, err.message);
}
test/prepackplan.test.ts
  });
});
scripts/smoke.mjs
  process.exit(1);
});
```

Left tree `7b0ec6a5152a86e6`. Nothing is committed, pushed, or deployed.
