# MT1: MORE TRUCKS COMING

Built and gated by the Scribe on 2026-10-28 (canon 0.30.556), in the fast lane on the owner's pick. Nothing is committed, pushed or deployed.

## The ask
- The owner, verbatim: "apparently [the investigator] left something for us to fix in the sandbox. Let's take a look and see, we'll make it the next slice".
- What was left, in the Operations library (`Grip Internal Site - SQL Server`, the folder for the owner): two wet weight repairs (gated in `SESSION_REPORTS/2026-10-28_gate_silo_weights_repairs.md`) and a proposal for the Scribe.
- The investigator's ask, verbatim as his agent recorded it: "when we are harvesting at one of our other locations, sometimes one "batch" does not fit on one truck. this illustration shows 6 trucks filling 5 silos. I cannot produce a harvest csv without closing the batch. Metrc will uptake multiple CSVs for one harvest batch but grip factory must close a batch to export to Metrc." He wants it prevented, not repaired.
- The cause, read in the code and on the 10-26 tables:
  - Finish Load's YES both finishes the HBN's lot (its file pends) and sets `harvest_batches.field_closed_at`, which takes the HBN off the field select.
  - On 2026-10-26 the crew finished every truck as its own HBN: six lots for five silos, each closed at its truck's send.
  - Nothing in the app cuts a lot at 750 totes; 750 is a full truck.
- His picks on the question tool, verbatim:
  - "Copy to the ideas folder (Recommended)" (the repair files);
  - "Yes, until its last truck (Recommended)" (an HBN marked More trucks coming stays on the select across farm days);
  - "I build it now (Recommended)".
- The investigator's four questions are answered by canon:
  - a file per truck: one harvest file per load (0.30.249);
  - plants per part: tags pasted per load (0.30.249), and the count lives on the lot (0.30.62);
  - two parts in one silo: the joint unload (0.30.226);
  - the next part's silo and form: they come from the HBN (0.30.341).

## Trees
- Received: the live tree `bc947d297e75dd52` (main 8af2db5, SM1 live).
- Left: `d207a7c0f98d13d6` (438 files, 122 migrations). Against the received tree it touches ten files and nothing else:
  - `migrations/0123_field_more_trucks.sql` (new);
  - `src/config.ts`, `src/db.ts`, `src/actions.ts`, `src/fieldharvest.ts`, `src/index.ts`, `src/i18n.ts`, `src/theme.ts`;
  - `test/fieldharvest.test.ts`, `scripts/smoke.mjs`.
- `public/`, `vendor/`, `package.json`, `package-lock.json`, `wrangler.toml` and `tsconfig.json` are untouched.

## What changed
1. **Finish Load's YES.** Each HBN on the truck is a fieldset of three radios, `pick_{id}`:
   - **Not finished** (checked): the old unticked box; its lot keeps weighing on the next truck.
   - **More trucks coming:** this truck's part finishes as the old YES finishes it. Its file pends as the next `<HBN>(n).csv`, it goes in transit to the Dry Queue, and the HBN stays open.
   - **Last truck:** the old YES; the part finishes and the HBN closes.
   - NO is unchanged.
2. **The send** (`sendFieldLoad`) reads Last truck from `hbn` (as every caller before MT1 posts it) or a `last` radio, and More trucks coming from `hbn_more` or a `more` radio. An HBN in both lists refuses in words: "Pick one choice for each HBN: More trucks coming or Last truck."
3. **The mark** (migration 0123): `harvest_batches.field_more_trucks_at` and `field_more_trucks_by`.
   - More trucks coming sets them once, with two log rows under "field more trucks coming"; a second More trucks coming leaves the first mark.
   - Last truck clears them in the same statement that closes the HBN, with their log rows under "field hbn closed".
4. **THE FARM DAY GIVES WAY TO THE MARK.** The field select lists a marked, unclosed HBN whatever the day (`FIELD_OPEN_HBN_SQL`). An unmarked HBN keeps the farm-day rule exactly (`NO_FINISHED_LOT_SQL` is the same string). A marked HBN's option reads ", more trucks coming".
5. **The waiting list.** The station's home (no load picked) lists the HBNs waiting on more trucks: their parts, their grams and when they were marked.
   - Each carries **Close HBN** behind the Admin PIN, for one that gets no more trucks. It closes the HBN and clears the mark, with four log rows under "field hbn closed, no more trucks".
   - A part weighing with a live tote refuses: "That HBN is weighing on an open load. Finish that load with Last truck instead." An empty weighing part (every tote voided) does not hold the close.
6. **The warn** (the path without script) reads each choice's own sentence:
   - More trucks coming: "This truck's part of HBN(s): {list} will be finished and its harvest file will pend. The HBN stays on the list for the next truck."
   - Last truck: the owner's sentence, unchanged.
   - Its Confirm posts `hbn` and `hbn_more`. The script's confirm joins the two sentences.
7. **Words.** Every new word goes through `t()` with a Spanish line, ASCII as the station's family is. No dash characters.
8. **The export.** The two columns land at the end of `/export/harvest_batches.csv`, as every column of the table does; the smoke's six line-end checks follow.

## The acceptance
- **The suite:** 5 new tests in `test/fieldharvest.test.ts`:
  - a silo batch across two trucks: part 1 more, part 2 last, seq 1 and 2, the mark set and cleared with its logs;
  - the mark across farm days, and a second More trucks coming;
  - the refusals, and the old YES and NO;
  - the Admin close: the PIN, a live weighing part, a voided one, the four logs, a second close;
  - the page: the select's mark, the warn's two sentences and hidden fields, the waiting list in Spanish.
  The old Spanish render test now reads the fieldset and the three radios.
- **The smoke**, at the walk's end (the walk spends 2026's lot numbers, so its two HBNs mint on a 2025 entry date):
  - truck 1 More trucks coming;
  - truck 2 carries the rest of silo 3 and the start of silo 4, and refuses one HBN in both lists;
  - then Last truck on silo 3 and More trucks coming on silo 4;
  - `(1).csv` and `(2).csv` pend for silo 3 and `(1).csv` for silo 4;
  - the waiting list holds silo 4 only; the select drops silo 3 and keeps silo 4, marked;
  - the close refuses a wrong PIN, then closes silo 4, which leaves the select and the list.
- **Layout.** On the smoke's own end state with a two-truck scene added, the station's home, Finish Load YES and the warn all scroll sideways by 0 px in all nine views (Lite, Continuum and Grip at the phone, 820 and 1920):
  - 2 fieldsets of 3 radios, none overflowing; the waiting list of 2, one with its close and one weighing;
  - at the phone the radios stack one per line, and at 820 and 1920 they sit in a row.

## Gates on the tree
- typecheck 0.
- vitest TZ=UTC: Test Files 126 passed (126); Tests 1744 passed, 6 skipped (1750).
- vitest TZ=America/New_York: the same.
- `node --check scripts/smoke.mjs`: 0.
- The from zero smoke: `About to apply 122 migration(s)`, SMOKE PASS, exit 0, no 500.
- Dash, CR and name scans of the ten touched files: none.

## Noted, not touched
`fieldEntryScript` declares `keep()` twice in one scope, so the HBN memory's `keep` shadows THE PLUS KEEPS THE CURSOR's focus `keep`. The focus law still holds, because + never takes the focus (its mousedown and pointerdown are prevented); a later slice can rename one.

## The merge
Migration 0123 rides, so the snapshot comes first under THE SNAPSHOT GUARD. The block:
- THE RE-RUN CHECK first;
- the worktree commit on `d207a7c0f98d13d6`;
- canon committed on main;
- `git merge --no-ff GFLiteMetrcAPI`, with the message on the command line;
- the push, and the worktree fast-forwarded.

Once live, the crew picks per HBN at Finish Load; nothing changes for a truck that carries one whole silo, which still takes Last truck as YES did.
