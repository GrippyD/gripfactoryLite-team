# 2026-10-04 The gate on L4 (label formulas, ink and fill) and R1 (Line packages, a date range) (canon 0.30.398): PASSED

Scribe session. BRIEF L4, LABEL FORMULAS, AND INK AND FILL (`BRIEFS/2026-10-04_labels_l4_formulas.md`) and MINI BRIEF R1, LINE PACKAGES, A DATE RANGE (`BRIEFS/2026-10-04_line_packages_date_range.md`), built in the worktree on the live tree `6555983371ed752a`. His Code session's report `SESSION_REPORTS/2026-10-04_labels_l4.md` with four screenshots. Its hand-back, verbatim in part: "After it, the app tree is `24b7982823f39aed` (297 files, migrations 0001 through 0094). Nothing was committed, pushed, or deployed." and "That slice landed in this worktree while the formula work was open, and it is inside the hash above."

Two agents worked in this worktree at once (his word, 2026-10-04: "I might have two agents deployed on the same job"). So the Scribe read every changed file against the live tree, not only the files the report lists.

VERDICT: PASSED. No change by the Scribe. The tree stays `24b7982823f39aed`.

## What was gated

1. THE MAIN FOLDER: `src`, `test`, `scripts` and `migrations` of the main folder's `app/` equal HEAD `f3cd4c2`. Clean for the merge.
2. THE TREE. Staged as `gateL4.tar` (11,755,520 bytes, `f79a10cd82158fbe`), unpacked; `24b7982823f39aed` both sides, 297 files; against the live tree 2 new (`src/labelformula.ts`, `test/labelformula.test.ts`) and 15 changed. Every change reads as L4's or R1's: `src/biz.ts` only refuses a broken formula at Save; `src/code128.ts` and `src/qr.ts` only take an ink color; `src/reports.ts`, `src/html.ts`, `src/xlsx.ts` and `test/reports.test.ts` are R1. No stray or half-applied edit.
3. GATES: typecheck 0; 90 files, 1,211 tests UTC and New York; `node --check scripts/smoke.mjs` 0; the from-zero smoke `About to apply 94 migration(s)`, SMOKE PASS, no ` 500 `.
4. THE FORMULAS, probed by the Scribe on thirty cases outside the build's tests: his `=Right([PACKAGE.TAG.ID],6)` gives `056845` for `1A40503000311FB000056845`, the same as `{package_tag}` and `[Package tag]`; LEFT, MID, LEN, TRIM, UPPER, SUBSTITUTE, CONCAT, `&`, IFBLANK and quoted `""` as Excel; TEXT dates (`09/24/26`, `Sep 24, 2026`, `September 24 2026`) and numbers (`22.3`, `1,234,567`, half up); a bad date or a text in a number format returned unchanged; an unknown function, an unknown field, a broken formula and a wrong argument count each `#ERROR` with words; a blank field blank, never an error.
5. INK AND FILL, driven by the Scribe: a 4 x 6 template saved with a black rectangle, a white on black text box `="Lot "&RIGHT([PACKAGE.TAG.ID],6)`, a white on black barcode `=RIGHT({package_tag},6)` with its caption, a dated text and a QR; a broken formula refused at Save in words; Quick Print of one label for `...000111` printed `Lot 000111` and the white barcode on black with exact colors. The encoder already carries ten quiet modules each side, so a white Code128 keeps its quiet zone in the fill.
6. R1, read by the Scribe on the smoke's data: `date=2026-10-04` and `from=to=2026-10-04` both answer `2026-10-04 06:00 to 2026-10-05 06:00, Eastern`; a four day range ends the day after To at 06:00; To before From swaps with the note; 2026-01-01 to 2026-10-04 refused (over 92 days); 2026-02-30 refused; a range over the 2026-11-01 time change keeps 06:00 at both ends.
7. THE PAGES at 1920 wide in Lite, CO and Cerberus: the editor with the white on black objects; the Line packages page with its window line. No page error.

## For his word (no hold)

- With no package in "Preview with package", a formula is worked on the field's NAME, so the editor shows `Lot ge tag` (the last six of "Package tag") and a date formula shows "Harvest date". The print is right. Showing the formula itself until a package is previewed is a small later touch if wanted.
- Save's refusal names the object's kind ("The text box holds a formula that cannot be saved."), not which text box.

## Sealed final check

```
THE MAIN FOLDER                       src, test, scripts, migrations = HEAD f3cd4c2
THE TREE (24b7982823f39aed, 297 files; the live tree 6555983371ed752a); every changed file read
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 90 files, 1211 tests passed
TZ=America/New_York npx vitest run    90 files, 1211 tests passed
CI=1 SMOKE_PORT=9444 npm run smoke    About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0
formulas (30 cases), ink and fill (a saved white on black label printed), R1 (7 windows)
dash audit (by character): 0; CR audit: 0; personnel data: none
```

Screenshots beside this report: `2026-10-04_gate_labels_l4_print.png` (14,286, `6ae1bf156e6eadf8`), `2026-10-04_gate_labels_l4_cerberus_editor.png` (201,729, `5ace6fb5548a08c7`), `2026-10-04_gate_labels_l4_line_packages.png` (97,287, `7a22f1b6d62f49cb`).

## The merge (his hands; no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_l4
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "L4: label formulas, ink and fill; R1: Line packages date range" -m "A text box, memo, barcode or QR starting with = is an Excel style formula over the label fields: LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM, SUBSTITUTE, CONCAT, IFBLANK, TEXT; one evaluator for print and the editor. Ink and fill, white on black, front and back. Line packages takes From and To. No migration. Canon 0.30.393 to 0.30.399.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge L4 and R1"
git push
```

His paste back: the Version ID.
