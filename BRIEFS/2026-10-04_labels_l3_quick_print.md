# BRIEF L3: QUICK PRINT (canon 0.30.386)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155): the last of the three Labels slices: print a saved template for a run of containers, each label filled from its package. Built on the worktree exactly as it stands after BRIEF L2, CONNECTIONS AND CUSTOM LABEL DATA, is merged and pushed (the Scribe writes the tree hash into this line at the paste; if the hash on the disk differs, stop and say so). Migration 0094; the smoke pin moves to 94.

## The sources (verbatim)

The owner's document (`slice labels.docx`, 2026-10-04), verbatim: "[Quick Print]" "New Menu: quick print" "Select Template Combobox" "Saved Template names land here" "Package ID" "A valid metrc package ID" "Roll ID with print? (y/n)" "Determines whether package ID should roll by 1 digit/container" "Default to "no"" "Admin PIN to change" "Container Qty" "Number of containers being labeled" "Labels/container" "Number of labels to print before container data changes"; and the editor's "Print" "Modal quick print screen".

His picks, 2026-10-04, verbatim: printing "Browser print, page = label (Recommended)"; the fields "Yes, and more.  We're going to need to get clever with our connections." (L2's resolvers).

## The law

1. THE QUICK PRINT SCREEN (`/compliance/labels/print`, the menu's first button) and the same form as a modal from the editor's Print (the template preset to the one open). Fields: Template (a combobox of saved template names, typing filters); Package ID; Roll ID with print (No by default; changing it to Yes asks the Admin PIN, as the app's other PIN gates); Container Qty (1 to 500); Labels per container (1 to 50).
2. A VALID METRC PACKAGE ID: 24 characters, `1A4` then the license's facility characters and a numeric tail, upper-cased and trimmed as typed; a malformed ID is refused in words. An ID the app does not know (not in the mirror nor the app's packages) is allowed with a warning that its fields will print blank.
3. THE RUN. Without roll: every container is the one package; the run is Container Qty x Labels per container labels of that package. With roll: container n (from 0) is the ID whose numeric tail is the first ID's plus n, the same width with leading zeros kept; each container's labels fill from that container's own package through L2's resolvers. Before printing, a preview list shows every container's ID, its item and strain, and any ID unknown to the app or any field that resolved blank, with Print and Back.
4. THE PRINT. One browser print job: each label on its own page of the template's size (`@page size: L in W in; margin: 0`), the template's objects as L1 draws them, the bound fields filled, barcodes and QR encoding the filled value. No driver code; the printer is chosen in the system dialog.
5. THE PRINT LOG (migration 0094, `label_print_runs`): one row per run (template id and name, first ID, roll yes or no, container qty, labels per container, the actor, the time, the unknown IDs as JSON); Quick Print shows the last 20 runs under the form with a Reprint link that refills the form.
6. WORDS: EN and ES for every label, button, warning and refusal.

## The tests and the smoke

- Unit: the ID check (good, short, wrong prefix, lower case typed); the roll (tail plus n with leading zeros kept; a tail that would overflow its width refused in words); Roll ID Yes refused without the PIN; Container Qty and Labels per container bounds; the run's page count; each rolled container fills from its own package; an unknown ID warns and prints blank fields; a run is logged once.
- Smoke: Quick Print the L1 smoke template for a smoke package, 3 containers, 2 labels each, roll Yes with the PIN: the preview lists three IDs, the print page holds six pages of the template's size, the log shows the run, Reprint refills.
- Render check: the Quick Print screen, the editor's modal and the preview in Lite, CO and Cerberus; one print page.
- Rehearse 0094 on a copy of the newest snapshot at 0093. Gates as always (the from-zero smoke `About to apply 94 migration(s)`); dash and CR audits; no personnel name in a tracked file; no git. Report with the tree hash and every file touched.
