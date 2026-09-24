# Grip Harvest Menu — hosting package

Static, dependency-free web app. Drop the folder onto any web host or into an
existing project's static/public directory.

## Contents

| File | Purpose |
|---|---|
| `index.html` | The whole app (HTML + CSS + JS). Also carries an embedded copy of the data so it works from `file://` or anywhere `data.json` can't be fetched. |
| `data.json` | Strain / potency / plant-count data. When the page is served over HTTP it fetches this on load and it overrides the embedded copy. Edit or regenerate this to update the menu without touching `index.html`. |
| `refresh_data.py` | Regenerates `data.json` (and optionally the embedded copy) from the harvest-plan workbook. |

## Data lineage

Source of truth: `shmerblez.xlsx`, sheet **PNN**, in Dennis Wallace's OneDrive
(https://ocgcompanies-my.sharepoint.com/personal/wallace_gripcannabis_com/Documents/shmerblez.xlsx).

Columns read: Farm · Environment · Row Labels (strain) · Count of Tag (plants) ·
Fdate (harvest date) · THC · Hang · Silo · Harvest order (Rough).

Rules applied, identical in `refresh_data.py` and the in-page "Load newer
workbook" importer:

- `GH` → Greenhouse, `IN` → Indoor, anything else / blank → Outdoor.
- Blank Hang and Silo → 100% silo. Blank Hang with a Silo value → hang = 100 − silo.
- Rows with no plant count, and the `Early` / `Grand Total` rows, are skipped.
  (Currently that drops ARL "GH BT", which has a date and THC but no count.)
- Biomass = plants × 6 lb (the workbook's K/L formulas). Product = biomass × BTR.
  BTR defaults come from the workbook's assumption cells: **Silo 25%, Hang 30%**.

Reconciliation against the workbook as of 2026-09-15: 41 lots, 99,654 plants,
597,924 lb biomass, 152,665 lb product. The workbook's own totals (526,104 /
63,672 lb; 150,628 lb flower) are lower by exactly the first six PNN strains
(1,358 plants, 8,148 lb) because its SUM ranges start at row 9 rather than
row 3. Nothing else differs.

## Updating the data

**Option A — in the browser (no tooling).** Download the workbook from OneDrive,
open the hosted page, click *Load newer workbook…*, pick the file. This
replaces the rows for that viewer only (stored in their browser). Good for
checking a draft plan; not a publish.

**Option B — regenerate and redeploy (the publish path).**

    pip install openpyxl
    python refresh_data.py ~/Downloads/shmerblez.xlsx            # rewrites data.json
    python refresh_data.py ~/Downloads/shmerblez.xlsx --inline   # also re-embeds into index.html

Then redeploy the folder (or just `data.json` if the host serves it — the page
fetches it with `cache: no-store`).

**Option C — scheduled.** Run Option B from a job that first pulls the workbook
via Microsoft Graph (`/me/drive/root:/shmerblez.xlsx:/content`) with an app
registration that has `Files.Read` on the OneDrive. The script has no other
inputs, so it is safe to run unattended.

## Hosting

Any static host works. No build step, no server code, no environment variables.

- **SharePoint / OneDrive:** upload the three files to a document library and
  open `index.html`. Modern SharePoint blocks inline scripts in some tenants;
  if the page renders blank, host it elsewhere and link to it from SharePoint.
- **Azure Static Web Apps / Blob static website:** point the app at this folder
  as the app location; no API. Blob: enable "Static website", upload to `$web`.
- **GitHub Pages / Netlify / Cloudflare Pages:** publish directory = this folder.
- **IIS / nginx / Apache on an internal box:** copy the folder into the web
  root. Make sure `.json` is served (IIS needs a `application/json` MIME
  mapping, which is present by default on modern versions).
- **Inside another app:** copy the folder to that app's `public/` or `static/`
  directory. The page uses only relative paths, so it works at any sub-path
  (e.g. `/tools/harvest-menu/`).

External requests the page makes: Google Fonts (falls back to system fonts if
blocked) and `cdnjs.cloudflare.com` for the SheetJS reader that powers *Load
newer workbook…* (the rest of the page works without it). Everything else is
inline.

## What viewers can change

Prices, BTR, per-grow-type spread, volume assumptions, inline lot edits and added strains are
saved in the viewer's browser (`localStorage`) and never leave it. *Reset to
source* returns to the data shipped with the page. To publish new prices to
everyone, change the `DEFAULTS` block near the top of the script in
`index.html`.

## PDF

*Export PDF* triggers the browser print dialog with a controls-free layout
(Letter portrait). Choose "Save as PDF".
