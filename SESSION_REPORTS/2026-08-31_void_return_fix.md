# Session report: 2026-08-31, void return fix (canon 0.7.3)

**Builder and verifier:** the local Claude Code Scribe (G-2 lane).

## Ruling (Dennis, 2026-08-31, bug report)

"VOIDING a wet weight from the Admin submenu returns you to the homepage instead of the Data Queues screen."

## Root cause and fix

voidRecord hard-redirected every void to /?ok=voided. Now: the void page captures the referring page's path in a hidden back input (on-site paths only); the POST returns there with the ok flash; a missing or off-site back falls back to /admin/queues. The homepage is never the target.

- app/src/audit.ts: backRedirect(raw, fallback = "/admin/queues") with query-aware flash append
- app/src/actions.ts: voidRecord returns backRedirect(form.get("back"))
- app/src/pages.ts: voidPage carries the hidden back
- app/src/index.ts: the void GET extracts pathname+search from the referer
- app/scripts/smoke.mjs: end-to-end assertion of the round trip
- app/test/audit.test.ts: backRedirect unit tests

## Scribe verification (verbatim)

```
npx tsc --noEmit          TSC_EXIT=0
npm test                  Test Files 6 passed (6) / Tests 94 passed (94)
npm run smoke             SMOKE PASS
  smoke asserts: the void page carries name="back" value="/admin/queues" when
  reached from Data Queues, and the void POST 303s to /admin/queues?ok=voided.
Em/en dash audit over all touched files: 0 matches.
```

## Deploy (verbatim)

```
npm run deploy:grip
  -> https://gripfactory-lite-grip.gflite.workers.dev
  -> Current Version ID: 76e714ec-fb63-4ba2-8760-add03d440dac
(no migrations in this slice)
```

## Sealed final check (bytes, sha256 first 16)

```
34722   72ed6aa1d81fe409  canon/CANON.md
2121    c177f56d76179bac  canon/_NOW.md
7835    37092a8ec1dc96fb  canon/MEMORY.md
1565    08d37a6661be70f1  app/src/audit.ts
30809   bd30e049b9fab45d  app/src/actions.ts
8126    27c9a7001f6f2510  app/src/pages.ts
17110   59ee4cc9756c0b13  app/src/index.ts
23876   f45da895a555fd6f  app/scripts/smoke.mjs
1534    f5a82c2673e80ba1  app/test/audit.test.ts
```
