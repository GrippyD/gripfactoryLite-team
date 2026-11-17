# WB1: THE TEAM WHITEBOARD

Built and gated by the Claude session on 2026-11-17, on the owner's word, for the GFLiteMetrcAPI worktree. Nothing is committed, pushed or deployed. Canon was not touched: the ledger is the Grok Bot scribe's, so this report is the record for whoever folds it.

## The ask
- The owner, verbatim: "I need a team whiteboard in Admin. Things:
  1. Double click anywhere. You type on it, text is stored wherever it is typed. Drops a moveable textbox around the text - when the box is active, the [DEL] key deletes the text box after an "are you sure" prompt.
  2. An "export to clean list" button - (the user email is stored with the text as "originator") - a spreadsheet is made and downloaded.
  3. A "clear all" button, PIN-gated
  4. A import pane (jpeg, png, gif, (some picture format), text screened and applied to the board"
- His picks on the question tool, verbatim:
  - "Cloudflare Workers AI (Recommended)" (what reads a picture);
  - "HEIC and WebP (Recommended)" (the picture format besides JPEG, PNG and GIF);
  - "I review each line first (Recommended)" (what screened means).

## Trees
- Received: `698a2413eef600bd` (main 69187ec, equal to GFLiteMetrcAPI; the main folder and the worktree both read it).
- Left: `29456218c99731ab` (450 files, 126 migrations, the last `0127_team_whiteboard.sql`).
- New: `migrations/0127_team_whiteboard.sql`, `src/whiteboard.ts`, `test/whiteboard.test.ts`, and under `public/vendor/heic-to/` the converter with its LICENSE and a README.
- Changed: `src/index.ts`, `src/html.ts`, `src/i18n.ts`, `src/theme.ts`, `src/metrcapi.ts`, `src/metrcadmin.ts`, `test/admincleanup.test.ts`, `scripts/smoke.mjs`, `wrangler.toml`.

## What it is
1. **The tile.** Admin carries a fifth tile, Team Whiteboard, opening `/admin/whiteboard` behind Access and the Admin PIN (the `/admin/*` gate). Its crumb climbs to Admin. English and Spanish.
2. **The board.** A 3200 by 2000 surface inside its own scrolling frame, so the page never scrolls sideways; works in the three looks, at 1920, 820 and on a phone.
   - A double click on an empty spot opens a box there; the text is stored at that spot, with the writer's Access email as its originator. A press anywhere outside the box saves it; Esc drops it.
   - A note drags to a new place (saved on release). A double click on a note edits it. On a phone a double tap does both, and Add a note opens a box in view.
   - A click makes a note active; Delete (or Backspace) on the active note asks "Delete this note?" first. The active note also shows a small delete button, for phones. Delete and Backspace inside a box being typed only edit the text.
   - Every save carries the version the page saw: a note someone else changed answers "Someone else changed this note. Showing their version." The board reads itself again every 10 seconds, so the team sees each other's notes.
3. **Export to clean list.** `team-whiteboard-<farm day>.xlsx`, one row per note in reading order (top to bottom, then left to right): number, the note, the originator's email, written and last changed in farm time, who changed it last, and whether it was typed or came from a picture.
4. **Clear all.** A dialog asks for the Admin PIN again; a wrong PIN clears nothing and says so. The clear is a soft delete of every live note under one batch id with one change log line, so a clear can be recovered in the database.
5. **Import a picture.** JPEG, PNG, GIF, WebP or HEIC.
   - The page shrinks the picture to 1600 px on its long side as a JPEG before it leaves the computer. A HEIC that the browser cannot open by itself (Chrome and Edge on a PC) is converted in the page by heic-to 1.6.7, vendored unmodified (LGPL-3.0, its license beside it), loaded only then.
   - Workers AI reads the text (default model `@cf/meta/llama-4-scout-17b-16e-instruct`; a `WB_OCR_MODEL` var changes it without code; the Llama 3.2 vision model's input shape is supported too).
   - The review lists every line as an editable note with a checkbox. Lines that look like a PIN, a password, an email or a phone number come flagged and unchecked. Only the checked lines go on the board, with the reviewer as originator, marked as from a picture.
   - If a model asks for its license, the pane shows a button that sends "agree" through the worker's own binding (no token anywhere). Without Workers AI (wrangler dev, the smoke) the pane says reading is not set up on this copy.
6. **The guarantees are the database's** (0127): text 1 to 2000 characters, a place inside the surface, the originator lower case, typed or import, and a delete that always names its kind (a clear also its batch). Content changes and deletes are logged; a move is not (position is not content).
7. **Every write takes JSON only** (a form posted from elsewhere answers 415), and every refusal answers in the reader's language.

## Two riding fixes (the calendar, not WB1)
- `src/metrcapi.ts` and `src/metrcadmin.ts`: the Metrc API page's "Calls this month" now reads the month from the page's own instant, not the clock inside `loadMetrcAdmin`. From November, five tests in `test/metrcadmin.test.ts` (seeded in October) failed on main as received, which would fail CI on any push. Production passes the real now, as before.
- `scripts/smoke.mjs`: the bizops wall check now lets Yield per plant vs plan read out_of_season. Its season is 09-01 to 10-31 (0105), so from November the from zero smoke failed on main as received.

## The acceptance
- **The suite:** 14 tests in `test/whiteboard.test.ts`: the migration's constraints; the screen; the model's lines; both model shapes and every answer shape; the picture check and the text tidy; the tile, the PIN gate and both languages; write, move, the version lock, edit and the log; delete; the clean list as a real xlsx; Clear all on the PIN; reading, flagging and placing; the license button; the HEIC route; every word in Spanish with no dash.
- **The smoke:** the tile, the board, a note with its originator, a move, a stale edit refused, the list, the xlsx, the picture door not set up here, a form post refused, Clear all refused on a wrong PIN and done on the right one, the HEIC script.
- **The bench,** on the smoke's end state:
  - the board in the three looks at the phone, 820 and 1920, in English and Spanish (18 views): 0 px sideways, the frame inside the screen, the phone's tools 48 px tall;
  - the real flow at 1920: a double click wrote a note where it landed, a drag moved it, a double click edited it, Delete asked and Keep it kept it, Delete again deleted it, typing Delete and Backspace stayed in the box, Esc dropped a box, the clean list downloaded as xlsx, a wrong PIN cleared nothing, the right PIN cleared the board;
  - the import pane, the reader stubbed in the browser: PNG, GIF, WebP, JPEG and HEIC (converted in the page) each reached the review as a 1600 px JPEG, the PIN line unchecked and flagged, Apply placed the two checked lines; a text file was refused in words; without the stub the pane said reading is not set up;
  - the phone with touch: a double tap opened a box and a tap outside saved it, Add a note worked, the active note's delete button (44 px) asked and deleted.

## Gates on the tree
- typecheck 0.
- vitest TZ=UTC: Test Files 130 passed (130); Tests 1786 passed, 6 skipped (1792).
- vitest TZ=America/New_York: the same.
- `node --check scripts/smoke.mjs`: 0.
- The from zero smoke: `About to apply 126 migration(s)`, SMOKE PASS, exit 0, no 500.
- The scans: no dash or CR in any line WB1 wrote; the only non ASCII is Spanish (the screen's words and the test's strings).

## His hands
1. **Before the push:** Cloudflare, My Profile, API Tokens, the token the GitHub deploy uses: add the permission Account, Workers AI, Read (editing a token keeps its value, so the GitHub secret stays). A Worker with an AI binding needs it to deploy.
2. **The merge block** (the snapshot first: 0127 rides).
3. **After the deploy:** Admin, Team Whiteboard: write a note, export, and read one picture. If the reader answers that it could not read, say so; the model can change through `WB_OCR_MODEL`.
4. **Workers AI is billed to his Cloudflare account** past its free daily allowance; one whiteboard photo is one small request.
