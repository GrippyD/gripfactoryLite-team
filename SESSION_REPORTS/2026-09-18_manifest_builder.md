# 2026-09-18 The Manifest Builder (canon 0.30.125)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.123 (worker d469fd3d, migrations 0001-0060). Owner ruling 2026-09-18, verbatim, his line breaks kept:

"New interco logistics layout:

Three equal panes

Left Pane:

Origin License: selecting a license exposes the METRC packages ordered numerically based on the last six digits

At the top of the exposed list, a "last six" filter (user types the last six digits and it focuses on all the packages that meet the criterea.

Add a package to the far right pane by clicking ">>" next to it

Middle Pane:

Destination License:

Selecting exposes METRC location within that license (we call this "receive into")

Right Pane: Header: all the herbs and spices needed for a METRC manifest (use our library of templates--I believe this one is T3 based)

Underneath the header, packages added from the left each with its own "<<" proceeding it that "puts the package back in" the origin license list.

One more thing: let's have a security discussion.  I have varying degrees of email access on the team and the users are regularly needing my management team to sign in for them.  I'd like to make the cloudflare login keyed to a cell phone number instead of an email address.  I'd like to extend the code request window longer as well, maybe a week. 


[finish] button [cancel] button"

His picks on the question tool: what [finish] produces, "Download at once, and record"; the receive-into source, "Mirror only"; a package already on a finished manifest, "Dim, no >>"; the per-package wholesale price, "A price box per added package". (The security discussion is answered in canon 0.30.124 and in the chat; nothing of it is built here.)

Migration 0061 (interco_movement_items.metrc_tag, wholesale_price, an index on the tag). From-zero pin becomes 61; next free migration 0062.

## The law, as built

1. THE THREE PANES. The Interco Logistics tile opens one form of three equal cards: Origin license, Destination license, Manifest. Before any pick every list reads - EMPTY - (canon 0.27.6). Every old path under /interco and /virtual-move still lands on the page.
2. THE ORIGIN. The License select carries the license list (Admin, Lookups, license). Picking one reloads the page with the METRC mirror's live packages under that license (metrc_packages, gone_at null), one row each: the last six in bold, the whole tag beneath it muted, then the mirror's item, quantity (grams formatted as grams) and location. The rows sort by the number in the last six, ascending; a tail that is not six digits sorts after them by its text; ties by the whole tag. A "Last six" box sits atop the list: the typed digits match anywhere in the last six and the list narrows as they are typed (more than six characters, a whole tag typed or scanned, match against the whole tag); the count line under it reads the rows shown; an empty match reads - EMPTY -. Each live row carries >>.
3. THE DESTINATION. The License select carries every license but the origin. Picking one fills Receive into with the location names the mirror's packages carry under that license (live rows; a license whose packages have all gone keeps the names its rows ever carried), A to Z, and sets the Recipient line in the Manifest pane. Receive into is required when the list has names and reads - EMPTY - when the mirror knows none for that license. The destination pick rides the origin reload (dest in the query), so either order of picking holds.
4. THE MANIFEST. The Header is the vendored T3 Licensed Transfers block (prompts/2026-09-03_t3_manifest_template_blank.csv; T3ManifestHeader): Planned route, Transfer type, Invoice number, Payment term days, Estimated departure, Estimated arrival, Gross weight, Gross weight UOM, Transporter license, Transporter phone, Driver name, Driver occupational license, Driver license number, Vehicle make, Vehicle model, Vehicle plate; the recipient is the destination license, derived. When a destination is picked the header prefills from the newest finished manifest on the same origin and destination pair (a field the hand has typed is never overwritten). >> moves a row from the origin list to the Packages list under the header, where it reads << and gains a Wholesale price box; << puts it back in the origin list in last-six order and clears the price. Nothing is written until [finish]; [cancel] is the bare page.
5. [FINISH]. One interco_movements row, finished as it lands (movement_kind interco, status completed, completed_at now, origin_farm and destination_farm from the license list, destination_location the receive-into pick, the header as typed with CRLF line breaks folded to LF), one interco_movement_items row per package with the METRC tag, the mirror's quantity and unit, and the price typed beside it (local_inventory_item_id empty: the package is the mirror's, no ledger item stands behind it), every field in record_change_log. The page returns with the flash, a banner naming the manifest's short id, its package count and a Download the T3 file link, and the file downloading on its own (/interco/manifest/:id/csv, under the interco gate). The same CSV pends on Pending Data Uploads (Admin) as every completed movement's does, downloads there too, and marks uploaded there; the move stands in Admin, Data Queues, Logistics Moves with the reasoned void, which frees its tags and drops the file off the export home.
6. THE T3 FILE. The three template header rows, then the block: the first data row carries the recipient, the header fields and the first package, each further package its own row with only the package columns; package.Id is the tag, package.WholesalePrice the price typed beside it (blank when none), the two gross weight columns blank. The filename is manifest_<short id>_<yyyymmdd>.csv.
7. DIM, NO >>. A package riding a finished, unvoided manifest out of the origin license reads dim in the origin list with "on manifest <short id>" and no >>; the finish refuses it by name. The next METRC mount drops it when METRC does.
8. THE REFUSALS, IN WORDS. Pick the origin license; Pick the destination license; The destination must differ from the origin; Add at least one package with >> before finishing (also in the browser, before the post, the button staying live); A package tag must be 1A plus 22 hex characters; A package is on the manifest twice; That package is not in the METRC mirror under the origin license (last six named); That package already rides a finished manifest (last six and manifest named); A wholesale price must be a number; an unknown origin or destination license is not on the license list. Spanish at the pill for every word on the page.
9. THE PHONE. The three panes stack; the header fields fall to one column; nothing scrolls sideways.

## What changed

- `migrations/0061_manifest_tags.sql`: interco_movement_items.metrc_tag, wholesale_price; index interco_movement_items_tag.
- `src/manifest.ts` (new): the header registry MANIFEST_HEADER_FIELDS, MANIFEST_REFUSAL, the last-six law (lastSix, lastSixNumber, compareByLastSix, sortByLastSix, matchesLastSix), receiveIntoList, parseFinishForm, headerFromMovement, the page (manifestBuilderPage, packageRow) and its browser script (manifestBuilderScript, autoDownloadScript).
- `src/interco.ts`: manifestCsv takes packages with a wholesale price (bare tags still accepted).
- `src/db.ts`: listMovementItems reads the item's own tag and price (COALESCE with the ledger's); listManifestedTags; listManifestHeaderPrefills; listTagGaps knows a tag-bearing item has no gap.
- `src/metrc.ts`: listMirrorPackagesForLicense; listMirrorLocationsByLicense.
- `src/actions.ts`: finishManifestBuild; buildManifestCsv through headerFromMovement with the prices.
- `src/index.ts`: GET /interco (loadManifestBuilder), POST /interco/manifest/finish, GET /interco/manifest/:id/csv, the old-path redirects kept; the ok=manifest flash.
- `src/theme.ts`: .interco-panes, .pkg-row, .manifest-header and the phone rules.
- `src/i18n.ts`: the pane words (EN, ES).
- Tests: `test/manifest.test.ts` (new; the last-six law, the filter, receive into, the finish form and its refusals, the header order, the T3 file with prices, the page before and after the origin pick, the dim row, the JSON payload, the finished banner and the download script, Spanish); `test/walk.test.ts` (the interco page is the builder).
- `scripts/smoke.mjs`: pin 61; the blank-slate pins read the builder; the builder walk at the tail (a four-package mount under 694, the sorted list, the filter box, the JSON lists, finish, the flash and banner and download script, the dim rows, the header prefill, the T3 file's bytes under both gates, the export home row, the Logistics Moves row, six refusals, Spanish, the void freeing the tags).

## Rehearsal in the browser

A dev server on the smoke's finished state, driven headless: the destination picked first rode the origin reload; the five 694 rows read 000012, 000105, 000999, 001001, 000E11; "0001" left 000012 and 000105 with the count reading 2 packages, "999" left 000999, "zzz" left none and - EMPTY - showed; >> on two rows moved them under the header with their tag boxes live and the count at 2, << put one back in order with its box disabled; finish with no destination stopped at the select's own required word, finish with no packages read the words in the error line and the button stayed live; finish with one priced package downloaded manifest_<short>_20260918.csv (the first data row: the destination, the quoted two-line route, Transfer, the driver, the tag, 672) and returned the page with the flash, the banner and the row dim under its short id; a fresh load with the destination picked prefilled the route and driver from that manifest and kept a typed driver across a destination change; cancel was the bare page; the phone stacked the panes at 420 with no sideways scroll; lite and cerberus both read clean. The server was killed.

## Scribe assumptions (his word owed if wrong)

- The filter matches the typed digits anywhere in the last six (not the start only), and a whole tag typed or scanned matches the whole tag.
- Receive into is required when the mirror knows locations for the destination and optional when it knows none.
- The header prefills from the newest finished manifest on the same origin and destination pair; a typed field is never overwritten.
- The receive-into pick lands as destination_location on the record only; no location-change file pends from it (METRC's receive is where the destination assigns the location).
- Wholesale price prints as typed (commas dropped); the two package gross weight columns stay blank.
- The item count and the words "1 package" / "n packages"; the T3 file's package rows in tag order.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 35 files, 713 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9034): `About to apply 61 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Browser walk and visual pass as above (lite, cerberus, phone).
- Dash audit: 0 on every file below.

## Deploy (his hands, with the migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        35 files, 713 tests passed
TZ=America/New_York npx vitest run    35 files, 713 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9034 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 61 migration(s); SMOKE PASS

migrations/0061_manifest_tags.sql        1235  cd5131b381eb35be
src/manifest.ts                         28211  ac046f4d18d06785
src/interco.ts                          20777  9acb3d47185a0cbd
src/db.ts                              155914  d0e8c2e5bd8f15d0
src/metrc.ts                            68526  79331dbbb201643b
src/actions.ts                         263583  ddc027ad04714504
src/index.ts                           113295  e5801ac6df1f3cd4
src/theme.ts                           144077  65ac03704c33d6d2
src/i18n.ts                            121840  c6410e1de0fdab11
test/manifest.test.ts                   14748  64723ccd3855ae24
test/walk.test.ts                       44325  a252802bb63ddfde
scripts/smoke.mjs                      443506  219d2eb1d42230c5
dash audit: 0 on every file above
```
