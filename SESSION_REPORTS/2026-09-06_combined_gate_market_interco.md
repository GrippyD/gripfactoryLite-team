# Session report: the Scribe's combined gate over marketplace 0027 and interco 0028 (canon 0.25.1), 2026-09-06

**Scribe:** Gripfactory Lite Scribe (Cowork). Both Cursor slices returned sealed with G-10 reports (SESSION_REPORTS/2026-09-05_marketplace_trim_gate_slice.md, SESSION_REPORTS/2026-09-05_interco_rework_slice.md). The Scribe hash-synced the tree and re-verified everything from scratch, then applied one gate-fix set Scribe-direct.

## Tree sync

Whole-tree hash compare against the sealed 0.24.1 workspace tree: 20 changed files, 2 new migrations (0027, 0028), zero unexplained. Vendored files byte-identical (saleshelper pair, all 24 icons, the QR pair). wrangler.toml, package.json, package-lock, tsconfig, worker-configuration.d.ts untouched: zero new dependencies, TBD ids intact. The 0.24.1 radio fix survived the builders' html.ts edits (the carry script, the lock law, the walk.test pin, and the smoke trap walk all present). Both builder reports' file hashes match the tree byte for byte.

## Gate defects found and fixed Scribe-direct (render only, zero behavior change)

The mid-run visual pass caught four floor-page render defects:

1. **Double numbering** on every floor row ("1. 1. ..."): the lists were ordered lists AND carried the law's own "N. " prefix. The lists are markerless now (ul.floor-rows); the law's prefix stands alone.
2. **"Truck ?"** on wet rows with no truck number, and the rows ignored the simple row law. Floor wet rows now read "N. Truck X - Farm / Strain / Date - weight g" with the Truck prefix only when a number exists; road chips likewise (movement chips read origin - destination - manifest, falling back to the word Manifest).
3. **Bare-text site columns**: the ratified canvas draws steel panels. A .card style (and room sub-panels) now renders in every view via token fallbacks; floor lists align tabular.
4. **Building 23 counts** ran the number into the name; the count is a muted suffix now.

Files touched by the gate fixes: src/html.ts, src/index.ts, src/theme.ts.

## Flags for the owner (known seams, deliberately NOT changed)

- **The origin-location seam**: items whose ledger location is a dry-space name (for example Arlington Dry Room, from pre-barn-cutover mint paths) fall to PROCESSOR under the ratified SITE_OF_LOCATION fallback and therefore render inside Building 23 on the door page and the floor. The fallback is canon (0.23.1: unknown spots default processor); the honest fix is resolving dry-space-named locations through the dry spaces' own farm scoping, one ruling away.
- **Lane card labels** lead with the internal lane key ("Lane pns-pnn") before the consequence words; a crew-facing name would read better.
- Arrivals' manifested-inbound rows are terse (short id and weight); receipts and consequence lines are right.

## Sealed final check (the Scribe's own run, on the tree WITH the gate fixes)

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 15 passed (15), Tests 401 passed (401)
node --check scripts/smoke.mjs        -> ok
Dash audit (22 synced + 3 gate-fixed files, both builder reports)  -> 0
rm -rf .smoke-persist && SMOKE_PORT=9041 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 28 migration(s)" from zero
Visual pass: mid-smoke screenshots read back for the floor, Send (PNS), Arrivals
  (PNN), the door, and Marketplace; the floor's four render defects found there
  and fixed; laws verified on screen (barn-only send pane, lane consequence
  words, no license picker, the conversion banner, receipts with reasoned VOID,
  832 side vs Building 23, one-export-home footers).

Gate-fixed files:
src/html.ts    129738 bytes   sha256:e8a106bb870aceaa
src/index.ts    83506 bytes   sha256:0fd3041f921a53e0
src/theme.ts   107738 bytes   sha256:1dbd7adcdd7c3b7e
```

Sitting hazards logged for MEMORY: standalone `wrangler dev` dies in this sandbox on proxy-blocked fetches (spawn it the smoke's way: shell, CI=1, BROWSER=none, metrics off, under a live node parent); crashed dev attempts leave workerd orphans that `pkill -x workerd` misses, so sweep by PID from `ps aux --sort=-rss`; builders left seven scratch persist dirs (.inv-migrate-persist, .mig-*-persist, .render-walk-persist) in app/ on the device, flagged for deletion.

One PS run deploys migrations 0027 and 0028 plus the worker (the 0.24.1 radio fix rides it too). Never c10. TBD ids stay TBD.
