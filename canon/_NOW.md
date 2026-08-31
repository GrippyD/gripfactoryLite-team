# _NOW: the single active line

**Updated:** 2026-08-31 · **Driver:** Dennis (break it, bring rulings), Scribe (folds, deploys, verifies)
**Rule:** ONE box at a time. Read this, then MEMORY, then canon/CANON.md (re-pin the version). Not chat history.

## One-line status

Canon v0.7.2. Live at https://gripfactory-lite-grip.gflite.workers.dev, worker version dcb4791c-a27a-4511-8c5e-def27e100b29, migrations 0001-0008 remote. Access enforcing; identity = login email (ADR-7); PIN 21319 gates Admin, Interco, and the new Fulfillment surface (vendored SalesHelper form at /fulfillment/). Go-live is tomorrow, 2026-09-01.

## Open box: go-live hardening

- **Owed: Dennis's authenticated visual check** of slices 4 and Fulfillment: chrome shows your email, no Person picker anywhere, PIN gate on Admin/Interco/Fulfillment (wrong PIN refused, holds 12 h), Lead picker on wet weight, your auto-created row in Lookups People, Fulfillment tile lands on the order form with menu and its data-age badge.
- **The wipe is armed and fires only on Dennis's words "wipe it":** recreate the grip D1, remigrate, patch the new id into wrangler.toml, redeploy, verify empty queues, commit the toml change locally. All DB content is test data (mints 26001-26007 plus auto-created people).
- Owed tonight (Dennis): the 26H workbook Abbr one-cell edit (Blue Andeez 071 → 078).
- Vendored-pair law: app/public/saleshelper/{index.html, menu.json} are never edited in place, only replaced by copy from the SalesHelper repo.

## Next

Wipe on the words, then B05/B10 deepening talk-through (who weighs where, manifests, hang vs silo differences) after go-live hardening, then B03/B04 in map order.

## Parked / future

Theme token sets (Grip, C10) · c10 deploy for Christine · console incorporation shape · product name · ABC column meaning · Zero Trust org label rename · server-side Move To enforcement · Access JWT (AUD) hardening · PIN editable in Admin · Fulfillment follow-ups (menu refresh lane, /api/send capture, Corey's pages.dev copy)

---
*Resume: read this, MEMORY, canon (re-pin version), acknowledge, wait for Dennis.*
