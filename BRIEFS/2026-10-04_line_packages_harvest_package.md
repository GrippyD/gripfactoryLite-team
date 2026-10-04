# MINI BRIEF R2: LINE PACKAGES, LAST 6 OF HARVEST PACKAGE (canon 0.30.403)

For the build session that builds BRIEF L5 (Claude Code or Cursor, the worktree `branches/GFLiteOpsDashboard`), under THE DISPATCH RULE (canon 0.30.155): a small addition to Reports, Line packages, built in the same session after L5 and gated and pushed with it (as R1 rode L4). If L5 is already handed back, build it on the worktree as L5 left it and say so. One build agent in the worktree at a time. No migration.

## The source (verbatim)

The owner, 2026-10-04: "add a field to line packages: Last 6 of Harvest Package: must match identically to free text (this is the solution for finding a specific label ID when you're printing labels--it refers to the five digits you see referring to the trim weight entries."

What the data holds (read by the Scribe on `db_backups/20261004-133858_pre_l4`): a trim weight entry is a `wip_packages` row (source null), and its `package_code` is five digits, the tail of the METRC harvest package the trim was weighed from (for instance `56838`, the tail of `1A40503000311FB000056838`, a WIP package in the mirror). Of 2,601 live trim rows, 2,600 codes end exactly one `metrc_packages.tag` and one ends none; no two mirror tags share a last five with a different last six. A prepack line (`prepack_lines`) draws from a parent `wip_packages` row (`parent_package_id`). The report today (`listLinePackages` in `src/db.ts`) shows a trim row's `tag` as that five digit code.

## The law

1. THE FIELD. The filter gains "Last 6 of Harvest Package" (EN; ES "Ultimos 6 del paquete de cosecha"), a free text box beside Operator. Blank shows every row, as today.
2. EACH ROW'S HARVEST PACKAGE. The report works out each row's harvest package, its full METRC tag, from the mirror:
   - Trim: the one live or gone `metrc_packages.tag` that ends in the row's five digit `package_code` (a code of other than five digits, or one matching no tag or more than one, has none);
   - Prepack: the same, from its parent `wip_packages` row's `package_code`;
   - Cryo and Rad: none (they do not draw from a harvest package this way).
   The page gains a column "Harvest package" showing that tag's last 6 (blank when there is none), on the page and in the CSV, XLSX and PDF.
3. MUST MATCH IDENTICALLY. With text typed, a row shows only when its harvest package's last 6 equals the typed text exactly: the same six characters, the same case, nothing more or less (outer spaces trimmed, nothing else changed). Five digits typed match nothing; a row with no harvest package never matches. When nothing matches, the page says "No harvest package ends in {text}. Type all six characters." (EN and ES).
4. THE WINDOW STILL HOLDS. The match is within From, To, the start time, Line and Operator, as R1 left them; the footnote totals cover the rows shown.
5. Nothing else changes.

## The tests and the smoke

- Unit: a trim row's harvest package found from its code; a prepack row's from its parent; Cryo and Rad none; a code ending two tags or none gives none; `056838` and ` 056838 ` match; `56838`, `0568380`, `O56838` and a tail with its letters in the other case do not; blank shows all; the totals follow the filter; the column on the page and in the three exports.
- Smoke: a smoke trim entry whose code ends a smoke mirror tag: `?harvest_last6=` its last 6 lists it alone; its last five lists nothing with the words; blank lists all.
- Gates as L5's, together with it.
