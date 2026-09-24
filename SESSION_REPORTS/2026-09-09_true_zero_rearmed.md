# Session report: the true zero re-armed (canon 0.30.24), owner-run runbook, 2026-09-09

**Scribe:** Gripfactory Lite Scribe (Cowork). Ops handoff, no code change, no migration. The owner's words: "well, thing is, I don't see any stranded lots in silos now.  I don't know what happened.  Send me the purge code block, I'll roll the db, re-run the walk from start."

## Scope

Everything the harvest walk creates, back to nothing, children first: silo_loads, unload_sessions, dry_weights, wip_packages, interco_movement_items, interco_receipts, interco_movements, local_inventory_items, metrc_uploads, wet_weights, wet_weight_entries, harvest_plant_tags, harvest_batches; then the three 0038 fulfillment tables (empty; they exist only after the pending deploy, which is why the deploy block runs first). Lot serials restart at 26001 because the serial is max(lot_serial) plus one.

UNTOUCHED: every lookup and catalog (farms, strains, grow methods, dry spaces and the silos, package types, people, lookup_values including the sign-off names, app_config with the PIN, label templates, suppliers), the PM system (equipment_assets, schedules, logs, tickets), compliance (audits, audit_notes, test results), purchasing, the marketplace (listings, sales_orders, sales_order_lines; their package links go dangling exactly as the 0.29.8 purge left them), import_queue, and record_change_log, which never purges.

The destructive runbook law in full: the warm-up probe leads (re-run that line alone until green if the 7403 bites), per-table JSON backups through the OAuth-safe `d1 execute --json` lane into `db_backups\2026-09-09_true_zero\`, every line throw-guarded, counts printed before and after.

## The runbook (PowerShell, after the deploy block)

```powershell
Set-Location "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
$D = "gripfactory-lite-grip"
npx wrangler d1 execute $D --env grip --remote --command "SELECT 1"; if ($LASTEXITCODE) { throw "probe failed (the 7403 blip): re-run this line alone until green, then continue" }
$dir = "..\db_backups\2026-09-09_true_zero"; New-Item -ItemType Directory -Force -Path $dir | Out-Null
$tables = @("silo_loads","unload_sessions","dry_weights","wip_packages","interco_movement_items","interco_receipts","interco_movements","local_inventory_items","metrc_uploads","wet_weights","wet_weight_entries","harvest_plant_tags","harvest_batches")
foreach ($t in $tables) { npx wrangler d1 execute $D --env grip --remote --json --command "SELECT * FROM $t" | Out-File -Encoding utf8 "$dir\$t.json"; if ($LASTEXITCODE) { throw "backup of $t failed; nothing deleted" } }
npx wrangler d1 execute $D --env grip --remote --command "SELECT (SELECT COUNT(*) FROM harvest_batches) AS batches, (SELECT COUNT(*) FROM wet_weight_entries) AS lots, (SELECT COUNT(*) FROM wet_weights) AS reads, (SELECT COUNT(*) FROM local_inventory_items) AS items, (SELECT COUNT(*) FROM wip_packages) AS packages, (SELECT COUNT(*) FROM interco_movements) AS movements, (SELECT COUNT(*) FROM silo_loads) AS loads, (SELECT COUNT(*) FROM metrc_uploads) AS marks"; if ($LASTEXITCODE) { throw "count before failed" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM silo_loads"; if ($LASTEXITCODE) { throw "silo_loads" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM unload_sessions"; if ($LASTEXITCODE) { throw "unload_sessions" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM dry_weights"; if ($LASTEXITCODE) { throw "dry_weights" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM wip_packages"; if ($LASTEXITCODE) { throw "wip_packages" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM interco_movement_items"; if ($LASTEXITCODE) { throw "interco_movement_items" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM interco_receipts"; if ($LASTEXITCODE) { throw "interco_receipts" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM interco_movements"; if ($LASTEXITCODE) { throw "interco_movements" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM local_inventory_items"; if ($LASTEXITCODE) { throw "local_inventory_items" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM metrc_uploads"; if ($LASTEXITCODE) { throw "metrc_uploads" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM wet_weights"; if ($LASTEXITCODE) { throw "wet_weights" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM wet_weight_entries"; if ($LASTEXITCODE) { throw "wet_weight_entries" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM harvest_plant_tags"; if ($LASTEXITCODE) { throw "harvest_plant_tags" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM harvest_batches"; if ($LASTEXITCODE) { throw "harvest_batches" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM mounted_sales_order_lines"; if ($LASTEXITCODE) { throw "mounted_sales_order_lines (exists only after the 0038 deploy)" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM mounted_sales_orders"; if ($LASTEXITCODE) { throw "mounted_sales_orders" }
npx wrangler d1 execute $D --env grip --remote --command "DELETE FROM so_mounts"; if ($LASTEXITCODE) { throw "so_mounts" }
npx wrangler d1 execute $D --env grip --remote --command "SELECT (SELECT COUNT(*) FROM harvest_batches) AS batches, (SELECT COUNT(*) FROM wet_weight_entries) AS lots, (SELECT COUNT(*) FROM wet_weights) AS reads, (SELECT COUNT(*) FROM local_inventory_items) AS items, (SELECT COUNT(*) FROM wip_packages) AS packages, (SELECT COUNT(*) FROM interco_movements) AS movements, (SELECT COUNT(*) FROM silo_loads) AS loads, (SELECT COUNT(*) FROM metrc_uploads) AS marks"; if ($LASTEXITCODE) { throw "count after failed" }
```

The after-counts paste closes this record; every column should read 0. Then the walk from Acquire HBN: the first lot mints 26001 again.

## What the Scribe wants from the walk

The 0.30.19 R2 picture: when a lot appears in the Load Silo left pane that the owner says is not in the barn, a screenshot of that screen and the path the lot took (acquired where, Move To what, finished, trucked, received). The report now heads by site (0.30.23), so the Inventory by Location page alongside it will show where the ledger has the package.
