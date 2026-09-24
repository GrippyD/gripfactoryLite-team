# Session report: the Admin button locks to the bottom right, 2026-09-02

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct build under G-2.
**Ruling (owner, verbatim):** "Lock the Admin button to the bottom right of the screen"

## What shipped

Admin leaves the top nav and rides as a fixed button pinned to the viewport's bottom right on every page, in every view. The nav is Home and Log. The markup is one element in layout() (`<a class="admin-fab" href="/admin">`, i18n through t()); each of the three sheets styles it in its own language: Cerberus as a steel plate with gold ink, all caps letterspaced, gold fill on hover; CO as Christine's amber header-cta pill with shadow and hover lift (stilled under prefers-reduced-motion); Lite as the accent-filled 2px-border button. Every sheet adds bottom clearance to main (6.5rem) so the pinned button never hides the last row of content. z-index 50 keeps it under the Cerberus boot scrawl (100) and the bloom layer (60). The PIN gate on /admin* is untouched: the button is a door, the lock is server-side. Phone mode unaffected structurally (the button sits outside main, so the full-width phone button rule never touches it).

## Files changed

- `app/src/html.ts`: nav drops the Admin link; the admin-fab anchor renders after main in every view.
- `app/src/theme.ts`: the .admin-fab block plus main clearance appended to all three sheets (lite, cerberus, co), each in its own idiom.
- `app/test/view.test.ts`: one new test covering all three views (fab present, bare nav link gone) and all three sheets (fixed position rule, clearance).
- `app/scripts/smoke.mjs`: home asserts the fab and the nav link's absence.

## Verification

tsc clean; **294 tests** passing (one new); full smoke **PASS**; dash audit 0 on every written file. Visual pass, Scribe screenshots read back on a seeded dev server: home under Cerberus (steel/gold plate bottom right), CO (amber pill), and Lite (accent button); no collisions with content or chrome in any view.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 9 passed (9), Tests 294 passed (294)
node --check scripts/smoke.mjs        -> ok
LC_ALL=C grep -c $'\xe2\x80\x94\|\xe2\x80\x93' src/theme.ts src/html.ts test/view.test.ts scripts/smoke.mjs
                                      -> 0 0 0 0
rm -rf .smoke-persist && SMOKE_PORT=8963 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS (exit 124 is the expected dev-server timeout kill)

src/theme.ts          85545 bytes  sha256:0ccadf48c70cba92
src/html.ts           59555 bytes  sha256:54b7a870d02d56dc
test/view.test.ts     19382 bytes  sha256:4273b0fcf7e06144
scripts/smoke.mjs     91424 bytes  sha256:8b881239fbeaee99
```

No migrations. Worker-only deploy.
