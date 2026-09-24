# Session report: unload gate, Virtual Move, BARN, CO invert, device-pill icons, 2026-09-04

**Builder:** Cursor sitting at `Documents\Claude\Projects\gripfactory Practical`.
**Prompt:** `prompts/2026-09-04_unload_gate_virtual_move_slice.md` (canon 0.19.0). Stacks on the walk slice (0020 already in tree).
**Canon:** read `_NOW.md`, `MEMORY.md`, `CANON.md`. This sitting did not edit `canon/` or `prompts/`. No remotes, no push, no GitHub, no deploy.

Walk slice was already landed (migration 0020, Interco menu, seven licenses, vendored icons). This slice's only migration is **0021**. Migrations 0001 through 0020 were not edited.

## What shipped

### Part 1: device pill icons

The Computer/Phone words are chrome SVG glyphs (monitor on a stand; tall phone with a home dot). House stroke: `currentColor`, stroke 2, viewBox 24, `aria-hidden`. Sized at 1.1em. `aria-label` and `title` keep the i18n words in EN and ES. Not the operations map set; vendored icons were not touched.

### Part 2: Continuum inverted

`coStylesheet()` now uses Christine's dark tokens as the always look in both `prefers-color-scheme` branches (`color-scheme: dark`). Paper-light tokens stay in a comment for a future flip-back. The vendored Continuum CSS was not edited.

CO decisions forced by the invert:

- `--key-sheen` is the dim value always (`rgba(255, 255, 255, 0.07)`).
- Softkey rest shadows use black, not the old paper brown.
- Tone chips on CO join Cerberus (`#7eb6ff` / `#e6c35c` / `#7fb494`).
- `.field-help` stays `--muted` (readable on the dark ground).
- Table even-row stripe is `rgba(255,255,255,0.02)`.
- Admin and Reports fabs stay amber pills on the dark ground.
- CO still has no Cerberus boot scrawl.
- **Icon variant amendment:** CO now always shows `/icons/white/`, same as Cerberus. Lite still uses the dark set. The dark icon files stay vendored and unused on CO.

Grip and Lite stylesheets were not restyled.

### Part 3: overissue warning, reconciliation gate, [+], finish clears space

- Add form carries `data-parent-qty` and `data-recorded-total` (RAW). Inline script warns and confirms before submit when typed + recorded reaches or passes the parent qty. Same guard on Add and [+].
- After such an add, a standing banner shows the over-issue amount (comma-grouped). Server never blocks.
- Finish unload with a mismatch redirects to `?gate=1`. The gate is one screen from `reconcileGate()` in `src/reconcile.ts` (delta in, choices out). Exact match skips the gate.
- Over: Queue an adjustment CSV, Queue a package finish CSV, Nothing just finish, Back to weighing.
- Under: Finish package in METRC, Nothing just finish, Back to weighing.
- Spear `queue_adjust` shows Already queued (automatic moisture CSV is the adjustment; no duplicate pend). Bucked extra adjust is UNION-listed only on hang (silo auto-adjust is not doubled).
- `package_finish` kind: `FINISH_CSV_HEADER = "Label,FinishDate"` in `src/interco.ts`. One RAW row, RFC 4180. Listed on `/admin/uploads`.
- Finish moves the parent (and bucked child) to BARN except the spear-no interco-staged path, which keeps the parent location and the building movement.
- Compact [+] posts `rapid_add=1`; redirect `rapid=1` clears the box and focuses it. Save and plain Add stay as they were.

### Part 4: BARN and Virtual Move

`0021_barn_cutover.sql`: INSERT BARN (sort 0, seed uuid `a2000002-0001-4000-8000-000000000004`), `UPDATE` CSA items to BARN, soft-delete CSA with `delete_reason` `superseded by Barn, owner delegation 2026-09-04`. Adds `lookup_values.delete_reason`.

Location side convention (zero schema, in `config.ts`): BARN is the only 832-side location; every other `inventory_location` row is processor-side. The Inventory Locations lookup pane and landing tile say so.

Law updates: silo and hang finishes land BARN; Finish Receipt lands farm PNN location BARN; reverse virtual move always BARN; harvests CSV location string is Barn. CSA identifiers are gone from live code (updated tests, never deleted).

`/virtual-move`: left pane AU-G-C-000832 grouped by location; right pane AU-P-000694 grouped by processor location. Move to processor requires a dest select (processor-side rows, BARN excluded, CSB first by sort). Move to 832 has no select and always lands BARN. Confirms name the count and the Building 23 crossing. Movement records and T3 virtual manifests stay as the strap-in slice built them. License tone chips sit on both pane headings.

## Files written or updated

New: `app/migrations/0021_barn_cutover.sql`, `app/src/reconcile.ts`, `app/test/gate.test.ts`.

Updated: `actions.ts`, `config.ts`, `db.ts`, `html.ts`, `i18n.ts`, `index.ts`, `interco.ts`, `ledger.ts`, `lookups.ts`, `pages.ts`, `theme.ts`, `scripts/smoke.mjs`, `test/view.test.ts`, `test/walk.test.ts`, `test/strapin.test.ts`, `test/i18n.test.ts`.

Not touched: canon, prompts, migrations 0001-0020, vendored Continuum CSS, T3 pair, saleshelper pair, icon files, wrangler TBD ids. No npm dependencies. No c10 deploy.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 14 files, **367 tests** passed.
- `node --check scripts/smoke.mjs`: ok.
- Migrations 0001 through 0021 apply clean into a fresh local persist dir (`.mig-gate-persist`).
- `SMOKE_PORT=8788 WRANGLER_SEND_METRICS=false BROWSER=none CI=1 npm run smoke`: **SMOKE PASS**. Existing CSA asserts now BARN. New walks: silo under-issue gate + package_finish pend, [+] rapid-add, virtual move dest_location CSB and back to Barn, Finish Receipt BARN, bucked over-issue banner + gate + adjustment pend.
- Dash audit (UTF-8 E2 80 93 / E2 80 94) on every authored file this slice touched: **0** on each.
- Rendered pass on local wrangler (smoke persist, port 8792, identity `dev@local`): inverted CO home and Drying Operations / Unload station (dark ground, amber primary, Palatino, white icons, no scrawl); device-pill glyphs on Grip, Lite, and CO; unload under-issue gate and over-issue gate (both directions); Virtual Move with dest select (CSB / In transit, Barn group, tone chips); Barn in the local inventory list.

## OWNER-flag (needs a Dennis ruling or a Scribe fold, not resolved here)

- **package_finish CSV shape is provisional.** `FINISH_CSV_HEADER` is `Label,FinishDate`. No T3 finish template exists. When the owner supplies one it is a one-constant edit.
- **Gate-helper seam for the trim rework.** `src/reconcile.ts` (`reconcileGate`, choice ids `queue_adjust` / `queue_finish` / `nothing` / `back`) is the reusable helper. Finish Parent should call it later; do not fork a second gate.
- **Location side convention.** BARN is the only 832-side location. Every other `inventory_location` row is processor-side, including IN-TRANSIT, so IN-TRANSIT appears in the Move to processor dest select. If the owner wants IN-TRANSIT hidden there, that is a one-filter edit.
- **CO invert decisions** (flip-back is a token swap, not a rewrite): dark-always in both schemes; dim `--key-sheen` always; white icons always on CO; even-row table stripe; paper-light tokens kept only in a comment.
- **`canon/_NOW.md` is stale on CSA.** It still names Finish Receipt landing PNN CSA and silo unloads to LOC CSA. This slice lands BARN. Flag only; canon was not edited.
- Bucked over-issue can write a negative parent qty (recorded over parent; FLAG, never block). Visible on the ledger as a negative grams row.

Do not flag `/reports` PIN. Do not flag the walk-slice license values (still 832 and 694). Do not flag overissue blocking (there is none).

## Sealed final check

```
cd app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 14 passed (14), Tests 367 passed (367)
node --check scripts/smoke.mjs        -> ok
npx wrangler d1 migrations apply gripfactory-lite-local --local --persist-to .mig-gate-persist
                                      -> 0001 through 0021 applied clean
node dash-audit (UTF-8 E2 80 93 / E2 80 94) on every authored file this slice touched
                                      -> 0 on each
SMOKE_PORT=8788 WRANGLER_SEND_METRICS=false BROWSER=none CI=1 npm run smoke
                                      -> SMOKE PASS

migrations/0021_barn_cutover.sql         1207  sha256:56154a0e1fb26217cfb2964641e04cbaff064b4d2e0e977d4f242eea26ace3ee
src/reconcile.ts                         2138  sha256:2ad42eaca4f1085a77fae09ff99787d6082fef854db1b82d434d300fae0503a8
src/actions.ts                         105953  sha256:5edc2e29d2cc05889fe9ea6760f3048b9a7c9bc6449e2ef6da816b3da7c94c2a
src/config.ts                           17769  sha256:9bd72a2e66880f9d4e5faa8080a19aed191d5e388acb272fe4480731d1ee5c98
src/db.ts                               60132  sha256:475f9cff18a943fa695d3961bb167d5fd360cf55e1974e5282f4622c6efa7463
src/html.ts                            108897  sha256:fbc16d73ffb05d47ebc848e0b09573d116235691e086dcd5fc5aabb5531aaff7
src/i18n.ts                             38766  sha256:b622d6320c9864b0c934b2319879ee4a62b222c2e955b0a51a5970c9a2aca61e
src/index.ts                            58171  sha256:591f221a82a7cd0129883cb97586565aba1547055a2be20eb0566e451b1bb8df
src/interco.ts                           9695  sha256:d8bfe43b4edf4d28addf92d4968bc331d0e8914c9b117beb81feb7c1ae3999cb
src/ledger.ts                            6316  sha256:ee97857f5a32df62e0ae45eda5010c7fe828e10f4fd3103ecc820557f371b6c1
src/pages.ts                            17162  sha256:c4c9167c7c828ff3a7b9382b0bccc89dbebf6b04ab67a5888ce6d7d9d1eacd8a
src/theme.ts                           101284  sha256:1e80c8a80c0ea91825a56fe491c232811b443a3c2b2717d1c92f3a3e3ec0c6a9
src/lookups.ts                           4607  sha256:29fe3585db875659e170c00b4173d68a5db4d81dcb6547b5edc2350e07107c19
scripts/smoke.mjs                      132557  sha256:95695454eb8576eb9796ff2f93f3599842b75b3b3903283808d74b945e12f06d
test/gate.test.ts                       11392  sha256:859625d204f891c1239bafc524e3cfdb1e5c957d72c39a3166c1895acf17733d
test/view.test.ts                       21498  sha256:dd72e1b7bb5b3b1898dd467e2b5528d235b13ef6a3ea949688fc5455cf92f42a
test/walk.test.ts                       35923  sha256:e417168a5c58335f19dbba2e864c27d1a1a5af4a2067f2fbb4839b1ff7e8d72c
test/strapin.test.ts                    13005  sha256:fe6469497eb01d974f457d33d1961721dff38f6ac1b2b2ef286c60265d45c080
test/i18n.test.ts                       16051  sha256:ec16fd4774f347d0ba95fb141697b27edbfdc05af39e975945da4a6a079cb70b

tails
0021: AND value = 'CSA' AND deleted_at IS NULL;
reconcile.ts: return formatGrams(absDelta); }
actions.ts: export { MANIFEST_COLUMNS, buckedPackageCode };
index.ts: export default app;
smoke.mjs: process.exit(1); });
```

Worker plus one append-only migration (0021). Owner deploys by PS after the Scribe's gate. Never c10. TBD ids in wrangler.toml stay TBD.
