# Session report: the hover help law (canon 0.26.0), Scribe-direct, 2026-09-06

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Owner ruling, verbatim: "Remove any on screen help text (everywhere). The help text should be on hover. I think that alone would help."

## What shipped (worker only, no migration)

1. **Every field's help rides hover now.** The two central help emitters stopped printing spans and stamp the help onto the field itself as a native title tooltip: `withFieldHelp` in src/html.ts (the pipeline-wide field renderer; the 0.17.0 REQUIRED-help law, Admin Data Lookups paths included, survives inside `<label class="field" title="...">`), `fieldBlock`/`fieldHelp` in src/ui.ts (the 52 business-ops fields), and the hardcoded Lead picker help. The dead `.field-help` CSS left all four view sheets.
2. **The interco explainer paragraphs left the screen.** Every `class="hint"` law line on the floor, Send, Ship external, Arrivals, and the door moved to a title on its natural anchor: the floor's inbox law on the page h1, the 832-side and Building 23 laws on their room headings, the ship-external and door laws on their buttons and h1s, the ARL law on its site heading, the Send page's two explainer lines folded into its h1 title, the Arrivals consequence banner onto its h1, the door's two direction laws onto their Finish move buttons (a duplicated line deleted outright). The ONE hint kept visible: the lane card's arrival consequence, which is the lane choice's substance, not help. The Admin Data Lookups landing's tile descriptions ride tile titles now too.
3. **Parity fix riding along:** the Send pane's wet rows had the same "Truck ?" null and non-law row format the floor gate fix cured; they now read "N. Truck X - Farm / Strain / Date - weight" with the Truck prefix only when a number exists.

Phone note, stated honestly: native titles need hover; on the phone layout the help is effectively invisible until a richer touch affordance is ruled. The owner ruled hover; this ships hover.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 15 passed (15), Tests 401 passed (401)
Dash audit (6 touched files)          -> 0
rm -rf .smoke-persist && SMOKE_PORT=9051 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 28 migration(s)" from zero
Smoke pins updated: acquire asserts hover titles present and on-screen field-help
  markup gone; the i18n floor pin now expects the h1 title carrying the inbox law.

src/html.ts        c7967ea9b1298b03    src/ui.ts        3eb00efc8a84039d
src/pages.ts       2bbe8af9612ebf90    src/theme.ts     45c4f06ec0a824e1
test/i18n.test.ts  a8541a77972d10f6    scripts/smoke.mjs 7debbc377f1010c7
```

Worker-only deploy (no new migration; the standing PS block's migrations step applies nothing). Never c10. TBD ids stay TBD.

Companion rulings this sitting, logged in canon 0.26.0: the scoped purge (owner retracted the full wipe; inventory transactions purged in-app by the owner; the logistics movement tables purged by the SQL runbook the Scribe handed, with an export backup first), and THE LOGISTICS QUEUE RULING (owner: logistics moves, like everything else, need a place in the Admin data queues; queued as the next Scribe-direct build so movements get a crew-visible surface with the reasoned controls).
