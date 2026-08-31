# _NOW: the single active line

**Updated:** 2026-08-31 · **Driver:** Dennis (break it, bring rulings), Scribe (folds, deploys, verifies)
**Rule:** ONE box at a time. Read this, then MEMORY, then canon/CANON.md (re-pin the version). Not chat history.

## One-line status

Canon v0.7.0. Live at https://gripfactory-lite-grip.gflite.workers.dev, worker version a2416f32-76d3-4103-bdf1-a7f9a379f2e1, migrations 0001-0008 applied remotely. Cloudflare Access enforcing; identity = the login email (ADR-7); Admin and Interco behind PIN 21319. Go-live is tomorrow, 2026-09-01.

## Open box: go-live hardening

- **Owed: Dennis's production visual check of slice 4** (the Scribe's browser stops at Access): chrome shows your email with no Person picker; /admin and /interco demand the PIN (21319, wrong PIN refused, holds 12 h); Acquire HBN has no Person select; wet weight keeps the Lead picker; first login auto-creates your person row (visible in Lookups, People with the email).
- **The wipe is armed and fires only on Dennis's words "wipe it":** recreate the grip D1, remigrate, patch the new id into wrangler.toml, redeploy, verify empty queues, commit the toml change locally. Everything in the DB is test data (mints 26001-26007 plus auto-created people).
- Owed tonight (Dennis): the 26H workbook Abbr one-cell edit (Blue Andeez 071 → 078).

## Next

Wipe on the words, then B05/B10 deepening talk-through (who weighs where, manifests, hang vs silo differences) after go-live hardening, then B03/B04 in map order.

## Parked / future

Theme token sets (Grip, C10) · c10 deploy for Christine · console incorporation shape · product name · ABC column meaning · Zero Trust org label rename (aged-snowflake-24fc) · server-side Move To enforcement · Access JWT (AUD) verification hardening · PIN editable in Admin

---
*Resume: read this, MEMORY, canon (re-pin version), acknowledge, wait for Dennis.*
