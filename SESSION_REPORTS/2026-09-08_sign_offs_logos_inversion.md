# Session report: sign-off names, vendor logos, the inverted Continuum (canon 0.30.12), Scribe-direct, 2026-09-08

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Three owner rulings landed while the 0.30.10 deploy (worker b5f5f4c4, folded 0.30.11) was going out; all three are verbatim in the 0.30.12 canon row and built here as one slice. Worker plus one append-only migration (0037).

## The rulings, in the order they landed

- R8 "Replace all the hand sign offs with the names "Kieth", "Les", or "Austin".  Kieth will almost always be the one managing RTUs"
- R9 "Remove the headings in the vendor blurbs on the continuum pages that say the names and replace with Logos" (one logo attached: VIST)
- R10 "invert the colors on all the continuum pages"

## What shipped

1. **R8, the sign-off names.** Migration 0037 seeds `lookup_values` category `sign_off_name` with Kieth, Les, Austin (his spellings, exactly), exposed in Admin, Data Lookups, People and System, Sign-off names (`LOOKUP_VALUE_SECTIONS.sign_off_names`), so he edits the list there. Every hand sign-off in the app now picks from it: the Trim and Cryo operators (station fields and the record pencil become `lookup` fields), the Unload Dry Space session operator (a select), and the Preventive Maintenance PM-done, ticket-open and ticket-close signatures (`signerSelect`). The server refuses anything off the list in words (`requireSignOff` / `optionalSignOff` in actions.ts, `requireSignature` in equipment.ts). RTU assets start their signature on Kieth (`defaultSignerFor`: an asset named RTU n preselects Kieth; everything else starts blank). The 0.29.0 hand-sign law (a typed name, never a dropdown) retires; each write still lands in record_change_log with the signature in the reason. The PM history column reads Signed by.
2. **R9, the vendor logos.** The four Strategic Partners cards on /vendors-equipment lose their name headings. Each card leads with a logo slot: VIST's logo is vendored exactly as supplied at `public/continuum/logo-vist.png` and rides the `/continuum/:file` asset route; Athena, Twister and T1 Logistics show a plain typographic wordmark in the slot until their files land (drop `logo-<key>.png` and set `logo` on the PARTNERS row: one edit each).
3. **R10, the inverted Continuum.** The C10 shell's palette flips to its dark twin (`C10_INVERTED_TOKENS`: ink ground #14120e, paper text #f1ede4, the amber kept as the accent and brightened; badges and buttons take dark text on amber; the meta color-scheme is dark). Every page on the shell inverts together: /vendors-equipment, /erp-software, /compliance-testing, and the PM system at /equipment. The in-app co view (theme.ts) keeps its paper tokens; it is a chrome skin, not a Continuum page. The three PM screenshots on the vendors page (pm-1..3) were re-shot on the inverted shell: the PM home, the T-Zero page, and RTU 1 with its signature on Kieth.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 18 passed (18), Tests 460 passed (460)
Dash audit (13 touched text files)    -> 0
SMOKE_PORT=9552 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 37 migration(s)" from zero
Smoke walks added or changed: the Trim operator renders as a select of the three
  names; a typed operator off the list 400s; Les and Austin ride the trim and
  cryo entries and show selected on the record edit; the unload session
  operator is a select, a typed one 400s, Kieth saves and shows selected;
  Admin lookups lists the three names and the landing links Sign-off names;
  the PM asset page signs with a select (no "Hand signed by"), a typed
  signature 400s, Les signs and lands in the history; RTU 1 starts on Kieth;
  the vendors page carries no <h3> vendor names, the VIST logo serves 200
  through the asset route, and the shell renders the inverted tokens.
Unit pins: gate.test.ts (19: the fixture learns the lookup, an off-list
  operator refuses in words, Les saves); trim.test.ts (13: the lookup fields
  and the Admin section, the Trim select of the names with no free text,
  defaultSignerFor and signerSelect, the PM page's three selects with Kieth
  on an RTU and blank elsewhere); routing.test.ts (no name headings, the VIST
  img, three wordmarks, the inverted tokens on the vendors and compliance
  testing pages, no paper token left).
Visual pass (wrangler dev on the smoke database, 1280x900 @1.5): the inverted
  vendors page with the VIST logo leading its card and three wordmarks; RTU 1
  on the inverted PM shell with Kieth preselected in both signature selects
  and the Signed by history column.

migrations/0037_sign_off_names.sql 7a62707aa7d7a98f
src/actions.ts 3827da38a462caad  src/db.ts 57cad2500d91f792  src/equipment.ts 197238940d7c531b
src/html.ts bda46b11782a7250  src/i18n.ts c49cb65b100b0aff  src/index.ts a6ae0550275b87fd
src/lookups.ts f14758f6cfaf9a77  src/pipeline.ts 1e9ddb2d825224e7
test/gate.test.ts 64becf4612953e1a  test/routing.test.ts dbe197a1ce61571a  test/trim.test.ts 775e0f90ba55593a
scripts/smoke.mjs e5cfaa57e85c9a11
public/continuum/logo-vist.png c06d5de862b15bda (vendored as supplied)
public/continuum/pm-1.png e84d09138e4548a8  pm-2.png a446c65975c4b7b8  pm-3.png 0355583a4db8460c
```

Worker plus one append-only migration (0037: three lookup rows). Never c10 deploy. Owed from the owner: the Athena, Twister and T1 Logistics logo files; the harvest purge after-counts paste (or the word to narrow it); the METRC location-change and T3 templates.
