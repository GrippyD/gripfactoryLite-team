# Session report: THE BETA DROPS THROUGH HIS CHROME (canon 0.30.57), Scribe-direct, 2026-09-14

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. An operations slice with no code: the nine exports parked on 2026-09-12 loaded onto the open beta floor through the owner's own signed-in Chrome, by the lane found in 0.30.54.

## The owner, verbatim

"account is paid"

(and, from Saturday, the standing order: "you will have to upload them, I'm going to hit the road")

## The lane, as it actually worked

Claude in Chrome on his laptop, one tab the Scribe opened and closed. The `file_upload` tool accepts a session path under `/mnt/user-data/outputs/` (the staged copies from Saturday); it refused the connected-folder path (`DROPS\2026-09-12\...`) and the raw attachment path under the session's uploads. The METRC file names are hyphenated as METRC gives them (`Metrc-Michigan-GR-C-002600-Plants-Flowering.xlsx`), which `parseMetrcFilename` does not read (it wants `MetrcMichiganGRC002600PlantsFlowering`), so the license and the phase were set on the form for every file, as the owner has been doing by hand.

**Submitting the form.** Neither a ref click nor a coordinate click on `Mount export` fired the submit (the coordinate frame the screenshots reported did not match the captured image, and the ref click blurred the focused select without submitting); the keyboard route (focus the phase select, Tab, Enter) fired sometimes. What worked every time: the extension's `javascript_tool`, setting `select[name=license_value]` and `select[name=phase]` on the form and calling `button[type=submit].click()`, which runs the page's own sliced-mount script (0.30.42) exactly as a hand click would. The redirect URL carries the counts (`?ok=mounted&mount=<id>&kind=plants&added=N&updated=0&gone=0`), read back through `tabs_context_mcp`. One extension disconnect mid-batch reconnected on its own; one batch of six 10-second waits timed out on the tool side while the mount finished underneath.

## The mounts (from the mirror page, `/inventory/metrc`, read back after the last drop)

| When (UTC) | Kind | License | File | Rows | Added / updated / unchanged / gone |
|---|---|---|---|---|---|
| 12:19:43 | plants / Flowering | GR-C-002600 | Metrc-Michigan-GR-C-002600-Plants-Flowering.xlsx | 1,500 | 1500 / 0 / 0 / 0 |
| 12:22:09 | plants / Flowering | AU-G-C-001397 | Metrc-Michigan-AU-G-C-001397-Plants-Flowering 2.xlsx | 2,000 | 2000 / 0 / 0 / 0 |
| 12:24:56 | plants / Flowering | AU-G-C-000832 | Metrc-Michigan-AU-G-C-000832-Plants-Flowering.xlsx | 1,638 | 1638 / 0 / 0 / 0 |
| 12:26:26 | plants / Vegetative | GR-C-001132 | Metrc-Michigan-GR-C-001132-Plants-Vegetative 6.xlsx | 204 | 204 / 0 / 0 / 0 |
| 12:27:03 | plants / Flowering | AU-G-C-001509 | Metrc-Michigan-AU-G-C-001509-Plants-Flowering 3.xlsx | 10,000 | 10000 / 0 / 0 / 0 |
| 12:27:55 | packages | AU-G-C-000832 | Metrc-Michigan-AU-G-C-000832-Packages-Active 12.xlsx | 11,742 | 11742 / 0 / 0 / 0 |
| 12:28:56 | plants / Flowering | GR-C-001405 | Metrc-Michigan-GR-C-001405-Plants-Flowering 2.xlsx | 34,445 | 34445 / 0 / 0 / 0 |
| 12:30:31 | plants / Flowering | GR-C-001132 | Metrc-Michigan-GR-C-001132-Plants-Flowering 2.xlsx | 48,149 | 48149 / 0 / 0 / 0 |
| 12:31:38 | Zoho items | (all) | Item 3.csv | 8,349 | 382 added, 0 updated, 0 unlisted |

Mount ids: 512723ef, 80ada2b7, a2f3dbc8, 4fa93f8d, b0c1d22f, 7e9e1723, d6cefa6d, 03480c8f (METRC, in the order above). The 48,149-row file took under 30 seconds in rounds of 5,000 on the paid plan; the free-tier wall of Saturday never showed.

**What the mirror holds:** AU-G-C-000832 1,638 flowering, 11,742 packages (3,667,540.91 g, 555,275 eaches); AU-G-C-001397 2,000; AU-G-C-001509 10,000; GR-C-001132 48,149 flowering and 204 vegetative; GR-C-001405 34,445; GR-C-002600 1,500. Total 97,936 plants and 11,742 packages, the same figures as the alpha's last picture. The Three Pictures: ledger packages with a METRC tag 0 (the floor is fresh), METRC active packages 11,742 (11,742 not claimed by the ledger), Zoho offerings with a METRC SKU 290 (249 in METRC, 41 not in METRC).

**Zoho (`/marketplace?pane=zoho`):** Item 3.csv, 8,349 rows, 382 offered, 7,958 inactive, 0 without stock, 8 placeholders skipped; 382 listings added.

## Downstream, read live

- FG INVENTORY IN METRC (`/inventory`): "From the METRC mirror: 11,742 active packages. Newest packages mount 2026-09-14T12:27:55.264Z"; by weight, MIX 1,686,041.76 g in 126 packages leads.
- The SalesHelper menu (`/fulfillment/saleshelper/menu.json`): builtAt and dataAsOf 2026-09-14T12:31:38.905Z (the Zoho mount's created_at), sourceFile "zoho mount Item 3.csv (gripfactory lite)", baseBuiltAt 2026-08-11T17:58:11.229Z, 184 menu lines from 356 packages with 26 excluded; the header reads Inventory updated 8:31 AM ET.

## Sealed final check

```
No code changed; the tree stands at 0.30.55 (worker 4c38f4f6, migrations 0001-0044).
Evidence read back live through his Chrome after the last drop:
  /inventory/metrc mounts table: eight rows as above, added counts equal to the files' row counts
    (1,500 + 2,000 + 1,638 + 204 + 10,000 + 34,445 + 48,149 = 97,936 plants; 11,742 packages)
  /marketplace?pane=zoho flash: Mounted: 382 added, 0 updated, 0 unlisted; summary 8349 rows, 382 offered
  /inventory FG section: 11,742 active packages, newest mount 12:27:55Z
  /fulfillment/saleshelper/menu.json: builtAt 2026-09-14T12:31:38.905Z, 184 lines, source "zoho mount Item 3.csv"
Dash audit (this report) -> 0
```

## Flags

The file-name parser wants the compact form and METRC ships hyphens with a duplicate suffix ("Plants-Flowering 2.xlsx"); a small worker fix (strip hyphens, spaces and parentheses before the match) would let the form read license and phase from the name as the page promises. Proposed, not built; the owner's word. The parked copies in `DROPS\2026-09-12\` are now history and can be deleted at his word. The three idle databases still stand.
