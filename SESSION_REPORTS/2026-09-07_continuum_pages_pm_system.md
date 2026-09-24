# Session report: the Continuum pages and the Preventive Maintenance system (canon 0.29.0), Scribe-direct, 2026-09-07

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Two owner orders in one sitting: remake the Continuum 10 "Vendors & Equipment" page (C10 CSS, Admin link, strategic partners, a mock PM system with hilarity-grade lightness replacing the Equipment ROI tool, a horizontal screenshot slider mid-blurb) and, mid-build, remake the "ERP" page the same way (What is an ERP, GripFactory with its own slider, "Goto GripFactory" at the bottom, the P&L simulator kept, an Admin backdoor link "it won't stay there").

## What shipped

1. **`/vendors-equipment`** (standalone C10 document: Christine's paper tokens, Palatino display, pinstripe ground, pill buttons; English-first by design since it lives outside the app shell). Strategic Partners cards for Athena, VIST, Twister, and T1 Logistics: what they do and what they do for us, the data-and-technology thread stated up front. Equipment Management blurb on the strategic weight of regular PM, a horizontal scroll-snap slider of three live PM-system screenshots mid-blurb, and the Tools pill now reads Preventive Maintenance (Live), replacing Equipment ROI Calculator. Partner facts grounded by web search (Twister Technologies makes the T-Zero, T2, and Marvel; VIST Labs is the clean-cannabis decontamination outfit; Athena Ag is the data-first nutrient program); the copy is the Scribe's draft for the owner's red pen.
2. **`/erp-software`** (same shell). "What is an ERP?": the term is overused in cannabis for wrappers around regulatory software or a second parallel system; the "We made both" card (we operate METRC from our own inventory system, one entry, one export home) and the tailor-made-tools card. "GripFactory": what it is, what it can do, a four-shot slider of the live product (ops map, the four-window interco floor, Inventory by Location, the wet weight station), the data-thread blurb, and the "Goto GripFactory" pill to the live worker. Tools keeps the ERP P&L Simulator, pointed at the Continuum page that hosts it.
3. **The Preventive Maintenance system** (`/equipment`, migration 0031): 49 seeded assets with minted serials GF-EQ-0001 through 0049 (T-Zero; three T2s; Marvel; Big Blue; Little Blue; twelve Gators, 10 PNN 2 PNS; seven Quads, 1 ARL 4 PNN 2 PNS; two Rad Sources; the Reefer Trailer; twenty RTUs), three seeded open tickets (T-Zero tune up, Big Blue needs belt, Rad Source 1 door contact fault), one inferred recurring PM schedule per asset (RTU filters every 30 days, the only real PM but real; trimmers 30 days; drivetrains 90), and an openly fake, person-free PM history (98 rows, hand signed by the likes of "the guy with the 10mm" and "night crew, allegedly"). THE HAND-SIGN LAW: every completion and ticket action is signed with a TYPED NAME, never a dropdown; each write also lands in record_change_log with the signature in the reason. Overdue reads "OVERDUE. It remembers."
4. **Admin links:** the Admin landing carries Continuum tiles for both pages (the ERP one is the owner's stated backdoor).
5. **`/continuum/:file` asset route:** run_worker_first means assets serve only through routed handlers; the seven vendored screenshots (pm-1..3, gf-1..4) serve like the icons do.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 16 passed (16), Tests 429 passed (429)
node --check scripts/smoke.mjs        -> ok
Dash audit (6 touched files)          -> 0
rm -rf .smoke-persist && SMOKE_PORT=9167 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 31 migration(s)" from zero
Smoke walks added: both pages 200 with their sections, sliders, and links; the
  ROI tool gone; PM home lists GF-EQ-0001 through 0049 with open-ticket chips;
  a PM completion hand signs (no dropdown, pinned) and lands in the history;
  Admin carries both Continuum tiles; /continuum/pm-1.png serves 200.
Unit pins added: nextDueFrom / dueLabel; the vendors page (partners, slider,
  PM link, Palatino, paper ground, no ROI); the PM home render.

migrations/0031_equipment_pm.sql 7815a0589aaf47ea  src/equipment.ts  f8c277a4d9a070c7
src/index.ts   719ca1f7512632b3   src/html.ts       dda3b11088048898
test/routing.test.ts c7c478822248b5d0  scripts/smoke.mjs 598e1d277a4281ce
public/continuum: pm-1 badaeb491086e727, pm-2 ab927c9ac81e5ab9, pm-3 5441f00992278ab5,
  gf-1 8ffcb075a69d5fef, gf-2 836794204f70e901, gf-3 2bad7820426b40c4, gf-4 672db398b4ac5ede
```

Worker plus one append-only migration (0031). The owner may replace any screenshot by dropping a same-named png into public/continuum/. NEXT, ALREADY RULED (2026-09-07, folding as 0.29.1): the Spear/Bucked toggle moves to the wet weight entry screen; dry weight keeps only the bucked-on-site question, and only for spear lots away from North. Never c10 deploy. TBD ids stay TBD.
