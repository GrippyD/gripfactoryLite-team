# Session report: the Continuum format is the loading default and the home page carries its crumb (canon 0.30.28), Scribe-direct, 2026-09-09

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. One owner message answering the 0.30.27 forks and ruling twice more; one slice, worker only, no migration.

## The message, verbatim

"no PIN, add a return to continuum link at the top of the homepage only present when in continuum format on the format pill.  Make the continuum format loading default"

Three rulings in one breath.

1. **"no PIN"** closes the first 0.30.27 fork: the Harvest Console node stays unPINned, like its three sibling Continuum pages. Nothing to build; it was built that way.
2. **The home crumb.** The home page (the operations map at `/`) now leads with the same crumb the Continuum pages carry, `&#8592; Back to the Continuum 10` to `https://gripcontinuum.gripcannabis.com/#/`, above the Operations heading, rendered ONLY while the view pill stands on CO (the Continuum format). Grip and Lite homes carry nothing; no other page carries it in any view. The words translate (es: "Volver al Continuum 10"); the name does not.
3. **The loading default.** A browser with no view cookie now loads the Continuum format. `asView` maps an absent or unknown value to `co` (it was `cerberus` under the 2026-09-01 ruling); a stored `cerberus` or `lite` pick keeps working exactly as before. `layout` and `themeStylesheet` default the same way through one `DEFAULT_VIEW` constant. The pill still holds a pick for a year, so a browser that has clicked Grip or Lite before today keeps its pick until it clicks CO; a browser that never clicked sees the change at once.

## What changed

- `src/config.ts`: `asView` (co default; cerberus and lite honored), `DEFAULT_VIEW`.
- `src/html.ts`: `continuumCrumb(locale)`, `CONTINUUM_HOME_URL`; `homePage(pipeline, locale, view)` leads with the crumb when `view === "co"`; `layout` defaults its view to `DEFAULT_VIEW`.
- `src/index.ts`: `/` passes `s.view` into `homePage`; the shell and SalesHelper comments say what the absent cookie means now.
- `src/theme.ts`: `themeStylesheet` defaults to `DEFAULT_VIEW`; the co sheet gains `.continuum-crumb` (muted, no underline, amber on hover), the crumb's only style since only co renders it.
- `src/i18n.ts`: "Back to the Continuum 10" (es "Volver al Continuum 10").
- Tests: `view.test.ts` (asView and themeStylesheet default to co; the Cerberus pins name their view; a new pin that a viewless layout is the Continuum sheet with CO active and no scrawl); `ops.test.ts` (the crumb leads the co home and matches the Compliance Testing page's destination; the default home carries it; Grip and Lite homes do not; group pages never do; es words).
- Smoke: the first home load, cookie-less, renders the Continuum tokens with CO active, no scrawl, exactly one crumb above Operations, and `/reports` carries none; picking Grip restores the gold and the scrawl and drops the crumb; Lite carries none; picking CO carries it again, in es too; the SalesHelper comment updated (the skin rides a stored cerberus pick; absent is co and streams raw).

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 19 passed (19), Tests 491 passed (491)
Dash audit (8 touched files)          -> 0 each
SMOKE_PORT=9621 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 38 migration(s)" from zero
Visual pass (playwright, fresh context, no view cookie, 1280x900 @1.5, wrangler dev
  on the smoke DB): / loads the Continuum format, CO active on the pill, the crumb
  "← Back to the Continuum 10" (href https://gripcontinuum.gripcannabis.com/#/) at
  y=96 above Operations; clicking Grip on the pill renders the Cerberus home with
  no crumb; clicking CO brings it back; /reports in co carries none.

src/config.ts 8a22b51316297cff     src/html.ts 102fe191ee73b5a4
src/index.ts bb08d39465d83200      src/theme.ts 62f64aff4854018a
src/i18n.ts db0b9f8e6c837049       test/view.test.ts 436a79d852520e86
test/ops.test.ts fea0987852657988  scripts/smoke.mjs a766074c48e5cd9b
```

Worker only; rides the pending deploy (worker plus migration 0038, now carrying 0.30.18 through 0.30.28). Never c10 deploy. Two 0.30.27 forks still open for the owner (the HC badge letters; whether the Continuum site links `/harvest-console` or `/harvest-console/app`). Owed from the owner: the deploy run and its version id; the true-zero after-counts; the 0.30.19 R2 picture if the Load Silo pane still misleads after deploy; a real Zoho export mounted live; the Athena logo; T1 Transport vs T1 Logistics; the METRC templates.
