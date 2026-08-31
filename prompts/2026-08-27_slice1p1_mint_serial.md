gflite: slice 1.1, mint serial and seed fix

# Cursor build prompt: Gripfactory Lite, Slice 1.1 (corrected mint law + seed fix)

**Repo:** this folder. Read `canon/CANON.md` (guardrails G-1 through G-10) and the slice 1 session report first. Never edit `canon/` or `prompts/`; propose amendments in your session report.

**No deploy has happened** (wrangler.toml still carries TBD database ids), so schema and seed migrations may be **edited in place** this one time. After the first deploy, changes ride new numbered migrations only; say so in a comment at the top of each edited migration.

## Ruling 1: the mint's trailing segment is a lot serial, not a year

The owner's ruling (2026-08-27), confirmed against the real 25H formula (`"25" & TEXT(Seq,"000")` and values like `45833-ARL-GH-027-0-NA-25004`):

Full corrected format: `<YYDDD>-<farm>-<grow_code>-<strain_code>-<manicure>-<silo>-<YY###>`

- **YY### = 2-digit year + 3-digit zero-padded lot serial**, a year-wide running number in mint order (26001, 26002, ...). It resets each year. This is the floor's primary identifier and the largest, most prominent number on the traveler; treat it as load-bearing.
- **Silo segment**: numeric silo numbers render 2-digit zero-padded (5 → `05`), matching the 25H formula (`CONCATENATE("0",Z7)` for numeric); non-numeric input passes through; blank → `NA`.
- Example: the first 2026 lot minted on 2026-09-01, silo 5, becomes `26244-ARL-GH-027-0-05-26001`.

Implementation:

- Add `lot_serial` INTEGER NOT NULL and `harvest_year` INTEGER NOT NULL to harvest_batches (edit migration 0001 in place per the note above). UNIQUE(harvest_year, lot_serial).
- Allocate the serial server-side at mint time: next = 1 + MAX(lot_serial) for that harvest_year, inside the same `db.batch()`/transaction as the insert so two stations cannot double-allocate. harvest_year comes from entry_date.
- hbn stays UNIQUE and is built from the allocated serial.
- Voided batches do NOT free their serial (no reuse; gaps are fine and auditable).

## Ruling 2: seed fix, strain code 071

Owner ruling (2026-08-27): **Blue Andeez moves to 078; Gelato 41 keeps 071.** Update `app/seed/strains.csv` (Blue Andeez,BA,078) and regenerate/edit migration 0003 accordingly. (The matching one-cell edit in the 26H workbook's Abbr tab is the owner's side, not yours; note it in the report.)

## Tests and smoke (update, then extend)

- Mint unit tests: serial allocation increments within a year; year rollover starts a new sequence at 001; silo zero-padding (5 → 05, NA passthrough, text passthrough); full example string above; concurrent-ish double mint cannot produce duplicate (year, serial).
- Smoke: expected first mint becomes `26244-ARL-GH-027-0-NA-26001` (no silo in the smoke walk unless you add one); second mint same day gets 26002; all prior assertions still pass.
- `tsc --noEmit` clean.

## Hygiene

No em or en dashes anywhere (G-8). No other scope: do not touch stations, queues, pages, or styling beyond what the mint change requires. Local commits only, no remote (G-1).

## Verification and report (G-10)

Sealed final check over every touched file (wc -c, sha256, tail 80 visualized), tsc, tests, smoke; paste the full output verbatim into `SESSION_REPORTS/2026-08-27_slice1p1_mint_serial.md` along with scope, deviations, and proposed canon amendments. Last stdout line: `Session report: <absolute path>`.
