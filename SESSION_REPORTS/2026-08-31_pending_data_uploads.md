# Session report: [Pending Data Uploads] + Wet Weights METRC CSV (slice 11), 2026-08-31

**Sitting:** cloud Scribe, build by a Scribe-directed code agent, verification by the Scribe.
**Canon:** folded at 0.10.0 with the owner terms glossary (canon 1b). **Deploy: PENDING** (migration 0011 rides the shared deploy).

## Rulings

"Add button to Admin page: [Pending Data Uploads]. This is a list of CSVs... We'll start with Wet Weights. We use null sublocations. The files should be named [HBN number].csv." Pending trigger, verbatim: "when the TL clicks finish lot." Terms cleanup folded as canon 1b: HBN = the METRC harvest NAME; Lot = YY###; Package ID = METRC package.

## What changed

- migrations/0011_metrc_uploads.sql: metrc_uploads (kind, harvest_batch_id, filename, uploaded_at, audit columns) + index.
- /admin/uploads (PIN gated via /admin/*): pending list (Wet Weights, <HBN>.csv, Lot YY###, finished entries, wet total, last activity, Download, Mark uploaded), Nothing pending empty state, muted Plant note.
- Pending law in db.ts: finished non-voided entry newer than the batch's last mark-uploaded; edits re-pend on purpose.
- Wet Weights CSV: exact METRC header; one row per non-voided scale read of finished entries; Plant empty (owner-parked); Grams; DryingLocation = destination display (Truck N for trucks, provisional); DryingSublocation empty (ruled); HarvestName = the HBN; PatientLicenseNumber empty; ActualDate = finish date (provisional).
- markUploaded action (audited insert), download route with content-disposition <HBN>.csv, i18n en/es (12 keys), tests, smoke walk (list, download shape, 404s, mark uploaded, re-pend on reasoned edit).

## Scribe verification

npx tsc --noEmit clean; vitest 168/168 at slice gate (176/176 on the combined tree with slice 12); migrations 0001-0011 apply clean on fresh persist; node --check smoke; full smoke SMOKE PASS (agent run and Scribe combined run); byte-level dash audit 0.
