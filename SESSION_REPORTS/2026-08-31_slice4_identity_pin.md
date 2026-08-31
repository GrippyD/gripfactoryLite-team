# Session report: 2026-08-31, slice 4, identity from the Access login + the PIN gate (ADR-7)

**Builder and verifier:** the local Claude Code Scribe (G-2 lane), same sitting as the 0.6.0 deploy report.

## Rulings (Dennis, 2026-08-31, verbatim)

1. "Replace the 'Person' selector with the cloudflare email address used at login."
2. "Gate Admin and Interco logistics with a PIN prompt. '21319' is the only valid PIN."

Ratified by picker: people rows auto-create on first login; the wet weight Lead stays a picker.

## What shipped

- Migration 0008: people.email (unique partial index), wet_weight_entries.lead_person_id, app_config table seeded with admin_pin = 21319 (canon L-4: the PIN is data).
- src/identity.ts (new): resolveIdentity reads Cf-Access-Authenticated-User-Email, finds the person by email (case-insensitive), auto-creates on first login with full audit rows (reason "first login"), refuses deactivated logins, survives the create race via the unique index. Headerless requests (local dev, smoke) act as dev@local.
- Identity middleware on every route; the actor is injected into every write server-side (actorForm) and never trusted from the form. The person cookie, POST /person, the chrome Person picker, and every hidden person_id input are gone; the chrome shows the login email.
- Lead: the wet weight header keeps a people picker posting lead_person_id (required, validated active), stored on the lot; the lot page's Lead joins COALESCE(lead_person_id, created_by) so pre-0008 lots still show their creator.
- PIN gate: /admin, /admin/*, /interco return the EN/ES PIN page (401) until POST /pin matches app_config; a correct PIN sets a 12 hour HttpOnly cookie; wrong PIN re-renders with the error; off-site next targets fall back to /admin.
- Lookups: People table shows the email; Add person takes an optional email; people email is edit-page editable.
- i18n: Enter PIN / PIN / Unlock / Wrong PIN. in EN and ES.

## Scribe verification (verbatim)

```
npx tsc --noEmit          TSC_EXIT=0
npm test                  Test Files 6 passed (6) / Tests 89 passed (89)
npm run smoke             SMOKE PASS
  smoke exercised: chrome shows the login email and no person form; headerless
  request acts as dev@local; /interco and /admin/queues 401 before the PIN;
  wrong PIN 401 with "Wrong PIN."; off-site next falls back to /admin; unlock
  303 then Admin and Interco 200; auto-created smoke@gripcannabis.com visible
  in Lookups; acquire form carries no Person picker; Lead posts lead_person_id
  and renders "Smoke Tester" on the lot page; full chain to release still green.
  Migrations 0001 through 0008 applied clean on fresh persist.
Em/en dash audit over all touched files: 0 matches.
```

## Deploy and remote verification (verbatim)

```
npx wrangler d1 migrations apply gripfactory-lite-grip --env grip --remote
  -> 0008_identity_pin.sql applied (6 commands)
npm run deploy:grip
  -> https://gripfactory-lite-grip.gflite.workers.dev
  -> Current Version ID: a2416f32-76d3-4103-bdf1-a7f9a379f2e1
Remote D1 check: app_config admin_pin = 21319; people.email present;
wet_weight_entries.lead_person_id present.
```

Production visual check is Dennis's (the Scribe's unauthenticated browser stops at the Access wall): chrome email, PIN gate on Admin/Interco, Lead picker, auto-created person row after first login.

## Sealed final check (bytes, sha256 first 16)

```
986     08a6220032239668  app/migrations/0008_identity_pin.sql
3451    ba6fc034ebbfec4e  app/src/identity.ts
15329   78072890632a6e2b  app/src/index.ts
30650   eefcc91b297b8759  app/src/actions.ts
22723   32ce76655aa0ab09  app/src/html.ts
7965    aa4cff65cb2205d7  app/src/pages.ts
12789   dd873aac3161f329  app/src/pipeline.ts
16392   967ce51aa742fd8d  app/src/db.ts
4877    ff1d600b7fd788c2  app/src/config.ts
4316    b5fc2a2d423ffe39  app/src/i18n.ts
21402   83c9a499ebfb16e1  app/scripts/smoke.mjs
3906    a1e483d783503060  app/test/identity.test.ts
5163    96d772b1b1fbc2ee  app/test/i18n.test.ts
14584   d285a7c31404223c  app/test/surface.test.ts
31421   3c899b224fcf36e0  canon/CANON.md
1909    277094150c649ff5  canon/_NOW.md
6437    7aeebdf07330857d  canon/MEMORY.md
```

## Parked

Access JWT (AUD tag) verification for defense in depth; PIN editable in Admin; Zero Trust org label rename.
