# WB2: ONE NOTE AT A TIME

Built and gated by the Claude scribe on 2026-11-17, on the owner's word, in the GFLiteMetrcAPI worktree. Nothing is committed, pushed or deployed by this session: the merge block is in his hands. The ledger is the Claude scribe's again (canon 0.30.565); canon 0.30.567 folds this build.

## The ask
- The owner, verbatim: "Can you add these records (after talking to me). In retrospect, I think one-note-at-a-time needs to be a rule. The whole board is a mess for the parser (hence why we need the whiteboard in GFLite in the first place)." Four photographs of the team's whiteboard came with it.
- His picks on the question tool, verbatim:
  - "One note per section (Recommended)" (how the records go on);
  - "Add everything,Crew names" for what to leave off, read as: everything goes on, crew names stay off;
  - "One picture, one note (Recommended)" (the rule for the import pane);
  - "Yes, add it there too (Recommended)" (the board reached from the Director Dashboard as well; the whiteboard itself carried a note asking for a Whiteboard tab on the Directors tab).

## The records (before the build, on live, WB1's code)
- 30 notes, one per section of the four photographs, placed on the live board through the import door: source import, the owner's login as originator, no overlaps.
- Crew names were left off and replaced by counts (for example "Silos / Silos: 14 people").
- A word the photographs did not settle carries "(?)" in the note.
- They were placed in one request, which WB1 allowed. From WB2 the server takes one note per picture; the 30 stand as placed.

## Trees
- Received: `29456218c99731ab` (WB1; main 0dcc2b0, equal to GFLiteMetrcAPI; the worktree reads it).
- Left: `3c6a68c0331de685` (450 files, 126 migrations; no migration).
- Changed, six files: `src/whiteboard.ts`, `src/director.ts`, `src/i18n.ts`, `src/theme.ts`, `test/whiteboard.test.ts`, `scripts/smoke.mjs`.

## What changed
1. **One picture is one note.** The import pane reads a picture into a single note to check.
   - The lines the reader finds go into one box as written: line breaks, numbering and bullets kept. A dot or star bullet, and any long dash the model writes, become a hyphen (handwriting has one dash).
   - Lines that look like a PIN, a password, an email or a phone number are held out of the note and listed under it, each with its flag and an Add back button that puts it at the end of the note.
   - More than 24 lines and the pane says: "This picture looks like more than one note. Photograph one note at a time." The longest section on the board of 2026-11-17 ran 19 lines.
   - Put this note on the board places the one note where the board is scrolled, makes it the active note and says "The note is on the board." An empty note is refused in words.
   - On a computer the box is ready to type in. On a phone (the device pill) or a touch screen the keyboard stays down and the page scrolls to the check.
2. **The server agrees.** `POST /admin/whiteboard/import/apply` takes one note: two or more answer "One picture is one note." in the reader's language and write nothing. A teammate's page left open from before the deploy gets that answer until it reloads. A typed batch keeps its cap of 60 (the function stays general).
3. **The reader is asked for one note.** The prompt names a sticky note, a card or one section of a whiteboard, and asks for its line breaks and numbering kept.
4. **The Director Dashboard links the board.** Team Whiteboard is the last link in the Director home's row, after Maintenance, in English and Spanish, to `/admin/whiteboard` behind the same Admin PIN.
5. **A riding polish.** The count reads "1 note", not "1 notes", in both languages.

## The acceptance
- **The suite:** `test/whiteboard.test.ts` holds 16 tests. The reader's lines, the page and the import test are rewritten for one note; two are new: the count, and the Director link in both languages.
- **The smoke** adds:
  - the pane checks one note (no line list);
  - two notes from one picture refused with nothing written;
  - one note placed as an import, line breaks kept;
  - the Director home links the board.
  - Clear all now clears two notes, under one batch.
- **The bench,** on the smoke's end state in Chromium:
  - the board in the three looks at 390, 820 and 1920, English and Spanish (18 views): 0 px sideways, the frame inside the screen, the phone's tools 48 px;
  - WB1's flows unchanged at 1920: write, drag, edit, Delete asks, Keep it keeps, delete, Delete and Backspace typed in a box stay in the box, Esc drops a box, the clean list downloads, a wrong PIN clears nothing, the right PIN clears;
  - the import, the reader stubbed in the browser:
    - PNG, GIF, WebP, JPEG and HEIC (converted in the page) each reached the one note check as a 1600 px JPEG;
    - the box held the three unflagged lines with their numbering, the PIN line was held out with its flag, and no line list was drawn;
    - Add back put the PIN line at the end of the note;
    - an empty note said "The note is empty." and sent nothing;
    - Put this note on the board placed one note, active, line breaks kept, and closed the pane;
    - 30 lines showed the hint;
    - a page posting two notes got "One picture is one note." and nothing was written;
    - a text file was refused in words, and without the stub the pane said reading is not set up;
  - the open check in the three looks at 390 and 820, English and Spanish (12 views): 0 px sideways, the box inside the screen, Add back 44 px (48 on the phone), the phone's keyboard left down with the check scrolled into view;
  - the phone with touch unchanged: a double tap writes, Add a note works, the 44 px delete button asks and deletes;
  - the Director home at 1920 in English and 390 in Spanish: the link last in the row, and it opens the board.
- **Seen and left alone:** the Director home at 390 px in the computer layout scrolls sideways about 250 to 290 px, from the top bar's links (Models, Harvest Console, Maintenance, Reports, Admin). The phone layout (the device pill) has none, and taking WB2's link out changes nothing.

## Gates on the tree
- typecheck 0.
- vitest TZ=UTC: Test Files 130 passed (130); Tests 1788 passed, 6 skipped (1794).
- vitest TZ=America/New_York: the same.
- `node --check scripts/smoke.mjs`: 0.
- The from zero smoke: `About to apply 126 migration(s)`, SMOKE PASS, exit 0, no 500.
- The scans: no dash or CR in any line WB2 wrote; the only non ASCII is Spanish.

## His hands
1. **The merge block,** the snapshot first by habit (no migration rides).
2. **After the deploy:** Admin, Team Whiteboard, Import a picture: photograph one note and read it. That is also WB1's first real picture read on live, still owed.
3. **A page open from before the deploy** needs a reload before its import works.
