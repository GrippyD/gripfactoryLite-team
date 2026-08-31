# Session report: 2026-08-31, deploy of the wet weight stack, live verification, Cloudflare Access

**Sitting:** local Claude Code Scribe on Dennis's machine (first local sitting to run wrangler itself).
**Verifier:** the Scribe, independently. Dennis drove the Access dashboard clicks and ran parallel test lots.

## What happened, in order

1. Resume ritual found _NOW pinned at 0.4.5 and MEMORY at 0.4.0 while canon stood at 0.5.3. Dennis ratified the pointer refresh; the miss belonged to the cloud Scribe's 0.4.6-0.5.3 sitting. Logged, not dwelt on.
2. Local verification gate, all green (verbatim below).
3. Deploy: migrations 0005-0007 were already applied on the remote grip D1 (unlogged prior application, confirmed via d1_migrations query; harmless). Worker deployed fresh: version **92a0a590-4dde-43e3-a1e5-76ec26f3ef06** at https://gripfactory-lite-grip.gflite.workers.dev.
4. Live verification of the full wet weight rebuild in production (details below).
5. Penn North confirmed correct by owner ruling; the migration 0006 guess stands.
6. Cloudflare Access stood up and verified enforcing.
7. Canon folded to 0.6.0; _NOW and MEMORY refolded; this report sealed.

## Local verification (verbatim)

```
npx tsc --noEmit          TSC_EXIT=0
npm test                  Test Files 5 passed (5) / Tests 80 passed (80)
npm run smoke             SMOKE PASS (migrations 0001 through 0007 applied clean on fresh persist)
```

## Deploy (verbatim)

```
npx wrangler d1 migrations apply gripfactory-lite-grip --env grip --remote
  -> No migrations to apply! (0001-0007 already present in d1_migrations)
npm run deploy:grip
  -> Uploaded gripfactory-lite-grip (3.85 sec)
  -> Deployed gripfactory-lite-grip triggers (1.51 sec)
  -> https://gripfactory-lite-grip.gflite.workers.dev
  -> Current Version ID: 92a0a590-4dde-43e3-a1e5-76ec26f3ef06
```

## Live verification in production (test data; mints 26003-26007)

- Mint law exact: 26243-ARL-GH-078-0-NA-26003, 26243-PNN-OD-062-0-05-26004 (silo zero-pad), 26243-PNS-OD-071-0-NA-26005, 26243-ARL-GH-034-0-NA-26006, 26243-PNN-OD-013-0-06-26007. Julian day 243 for Aug 31, year-wide serials continuing from break-in.
- Pane: three farm groups (PNN, ARL, PNS), collapsed by default, counts right. A weighing lot keeps its batch visible for resume; a finished lot removes it from the pane while the batch stays in the Data Queues HBN table (slice 3d, also proven by Dennis's parallel lots on 26003/26004).
- Header: HBN plus the farm spelled out after a plain spaced hyphen ("- Arlington", "- Penn North"); Lead prefilled from the person cookie.
- Move To per farm, exact: ARL = Arlington Dry Room + trucks; PNS = trucks only; PNN = Hang in Place + Silos 1-5 + trucks. Add a truck minted Truck 1 inline and it appeared across farms (shared).
- Full lot on 26006 (ARL, to Truck 1): weights 1200.5 + 985.25, total 2185.75; pencil edit refused a blank reason ("Please fill out this field"), then 985.25 -> 990 with reason "scale re-read at the belt"; total recomputed 2190.50; reason verified present in the change log with full audit rows. Finish lot -> Inbound Queue under Truck 1 at 2190.5 g, batch left the pane.
- Second lot on 26007 (PNN, to Silo 2): 3350.75 g, finish -> Dry Space Queue grouped under Silo 2.
- ES pill: full Spanish chrome (Inicio, Registro, Persona, Recordar, Estacion headers, Eje de colas de cosecha, Entrada de peso humedo); Interco stub "Con barriles naranjas. Aun no construido." / "Orange barreled. Not built yet."; toggled back to EN.

## Cloudflare Access (Dennis clicked, Scribe walked and verified)

- Zero Trust org **gflite** created on the free plan.
- Worker Access on gripfactory-lite-grip: scope **All traffic** (the wizard defaults to Previews only, which left production public on first test; caught and corrected), policy **Allow, emails ending @gripcannabis.com**, One-time PIN, 24 hour sessions.
- Verified enforcing from the Scribe's unauthenticated browser: the URL now lands on the gflite.cloudflareaccess.com sign-in page ("Log in to gripfactory-lite-grip", email + Send login code). Dennis verified the allow path.
- Parked cosmetic: the login page shows the auto-generated org label aged-snowflake-24fc; rename lives in Zero Trust settings.
- Consequence for future sittings: unauthenticated verification browsers stop at the wall. Post-Access live checks run through wrangler remote D1 queries plus Dennis's authenticated browser.

## Sealed final check (bytes, sha256 first 16)

Em/en dash audit over all three touched files: 0 matches.

```
28442  fd90145aed96b9d1  canon/CANON.md
1685   29fbe19b30adcffb  canon/_NOW.md
5864   36270846e6b298b0  canon/MEMORY.md
```

## Armed, not fired

The go-live reset fires only on Dennis's words "wipe it": recreate the grip D1, remigrate, patch the new id into wrangler.toml, redeploy, verify empty queues, commit the toml change locally.

## Ruling received at seal time (folds next)

Dennis, 2026-08-31, verbatim: "Replace the 'Person' selector with the cloudflare email address used at login." Logged on arrival; folded and built as the next slice this sitting.
