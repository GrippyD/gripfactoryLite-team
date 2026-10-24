# RG1: the for sale tile loses its answered question

Worktree `branches/GFLiteMetrcAPI`. One plain session. No git. Nothing is committed, pushed, or deployed.

## Tree

- Received: `e4c036fb7fa68c63` (429 files, 118 migrations). That is the tree PH1 left.
- Left: `9d444d039b24932f` (430 files, 119 migrations).

## Files

- `app/migrations/0120_for_sale_question.sql`: sets `open_question_en` and `open_question_es` to null on `farmops.assets_for_sale_count` only while the English question is still the 0105 seed text, and stamps `updated_at` `2026-10-24T00:00:00.000Z`. A second apply changes nothing. Title, compute key, status live, and def_version 2 stay.
- `app/src/directorregistry.ts`: the live row's questions are null. The 0105 seed overlay still carries the original English and Spanish, so the 0105 seed text stays byte for byte.
- `app/test/director.test.ts`: the row's questions are null, the open-question count matches the registry, and putting the seed question back then applying 0120 drops the count by one. A second apply changes nothing. Every other row's question is unchanged.
- `app/test/maintenance.test.ts`: the farmops wall tile has no `data-dd-question` for this row. The count and the Equipment for sale link stay.
- `app/scripts/smoke.mjs`: from zero applies 119 migrations. The farmops wall's for sale tile has no question mark.

## Decided

- `updated_at` is `2026-10-24T00:00:00.000Z`.
- The question mark is drawn only when `open_question_en` is set, so nulling both questions removes the `?` and leaves the live count and the link.

## Gates

- `npx tsc --noEmit`: exit 0.
- vitest `TZ=UTC`: Test Files 124 passed (124). Tests 1705 passed, 6 skipped (1711). VITEST_EXIT 0.
- vitest `TZ=America/New_York`: Test Files 124 passed (124). Tests 1705 passed, 6 skipped (1711). VITEST_EXIT 0.
- `node --check scripts/smoke.mjs`: exit 0.
- From zero smoke, background: `About to apply 119 migration(s)`. `SMOKE PASS`. `SMOKE_EXIT 0`. No 500 in the log.
- Dash and CR scan of the touched files: U+2013 0, U+2014 0, CR 0.

Left tree `9d444d039b24932f`. Nothing is committed, pushed, or deployed.
