# FG1 fix plus SP2, one session

Filed by the Scribe on 2026-10-14 (canon 0.30.477) from the owner's word: TRI and SHA come from "METRC", and "Can we run it all together?"

For the build session (Claude Code or Cursor): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). The worktree holds FG1's gated build, tree `6e8ea44ae71f43ec`. Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. No migration. LF only.

This session does two things, in this order, and hands back once:
- PART A, the FG1 fix below.
- PART B, SP2 exactly as `BRIEFS/2026-10-14_strain_btr.md` says (BTR in the Strain performance pane). Read that brief whole. Its "do not touch fginventory.ts" line is lifted for this session only, for PART A.

## PART A: TRI and SHA from METRC
1. THE SOURCE. `FG_LEDGER_SQL` in `src/fginventory.ts` stops reading the local ledger (the ledger's FG items are all prepacked bud, so it always gave 0). It reads the METRC mirror: `metrc_packages` with `gone_at IS NULL`, `category = 'Shake/Trim'` and `quantity > 0`, every license the mirror holds.
2. TRI OR SHA. By the item's prefix (the text before the first " - ", upper case): `SHA` is SHAKE; every other prefix (TRI, TRIM, MIX, anything else) is TRIM. The query keeps its output columns (type_code TRIM or SHAKE, strain_name, thc_pct, grams), so `buildFgInventory` does not change.
3. GRAMS. `uom` g as is, kg times 1000, lb (METRC's standard pound) times 453.59237. Any other uom is left out and counted in a footnote under the section ("N METRC packages in other units not shown"). Display stays app pounds at 448 g like the rest of the section.
4. STRAIN. `item_strain` when set, else the item name's second " - " field.
5. THC. The same two lab lookups FG1 already has (latest compliance sample, else latest internal test), keyed on the package's `tag`.
6. ZERO LINES STAY. Every category in the owner's list shows even at 0.00, as FG1 is built now.
7. FOOTNOTE. Under TRI and SHA: "From METRC, live Shake/Trim packages, as of the last mirror mount" with the mount time.

One grouped read, no per row query. /harvest stays under 1 s on the live-data bench and FG inventory adds no more than 0.05 s.

## Tests and the smoke
- Unit (PART A): a SHA item lands in SHA; TRI, MIX and an unknown prefix land in TRI; a gone package, a 0 quantity package and a Buds package stay out; g, kg and lb convert; an "each" package lands in the footnote count; strain from item_strain and from the name; THC from a compliance sample keyed on the tag; zero categories still render.
- Smoke: seed one live Shake/Trim package of each kind; /harvest shows them under TRI and SHA. PART B's smoke check as its brief says.
- Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York; node --check scripts/smoke.mjs; from-zero smoke, `About to apply 102 migration(s)`, SMOKE PASS, no 500. Dash and CR audits by character. Render /harvest at 1920 and 820 in Lite, CO and Cerberus with FG inventory and Strain performance open. One report: `SESSION_REPORTS/2026-10-14_fg1_metrc_and_sp2.md` with the tree hash and every file touched (keep it short; the Scribe's gate report carries the detail).
