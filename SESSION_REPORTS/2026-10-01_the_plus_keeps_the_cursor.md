# 2026-10-01 The plus keeps the cursor (canon 0.30.334)

Scribe session, built Scribe-direct under G-2 (a small slice from the Scribe's session) on the worktree `branches/GFLiteOpsDashboard` as it stood after the V9 merge (main `db3a435`, the app tree `64a357f2992d12bd`, the five files below at main's hashes, checked on his disk before the landing). No migration; the smoke pin stays 85. Landed in the worktree; not committed, not pushed, not deployed; the merge block below is his hands.

## The ruling (owner, 2026-10-01, verbatim)

"quality of life request: when the wet weight entry screen has the "+" pushed, the screen refreshes and the operator needs to refind the cursor and click on the weight entry. They're doing this 3500 times a day. Can we fix it so they can type, hit + and type again without the exercise?"

## What the Scribe read

1. THE SCREEN is the field node, Penn South/Arlington Harvest (`/station/field_harvest`, `src/fieldharvest.ts`, canon 0.30.317), the screen his V15 ruling called "the wet weight entry screen": the entry pane is Weight, HBN and "+". The "+" posts `/station/field_harvest/load/:id/weights` (`addFieldLoadWeight`), which answers 303 to `?load=...&carry=1&ok=field_weight`; the page reloads with the HBN carried and "Weight added." on top, and the Weight box had no autofocus, so the cursor was nowhere.
2. THE PENN NORTH HARVEST station (`/station/wet_weight`) adds with "Add a weight", not "+", and its box already carries `autofocus`; it is not this screen and is not changed.
3. THE PAGE'S OWN SCRIPT (`finishScript`, emitted after the Finish Load block) binds the YES link, the Confirm form and each tote row's HBN change; a background post that replaces those panes must run it again on the new nodes.
4. No global script touches a form's submit (the submit lock rides only `data-lock-on-submit` forms); identity rides the Access header on every request, a same-origin fetch included.

## What changed

- `src/fieldharvest.ts`: the Weight box carries `autofocus` and `data-field-weight` (the cursor is in the box whenever the page loads, the path without script); the "+" carries `data-field-plus`; a status line `data-field-status` (hidden, the words of a refusal or of no answer, the no-answer words in `data-no-answer`) and the entry script sit inside the entry form. The script: a press of the "+" (mouse or touch) does not take the focus from the box; the "+" key typed in the box is the "+" button; the post goes in the background (fetch), so the page never reloads and a tablet's keyboard stays up. The box clears as the weight leaves, so the next weight can be typed at once; the panes after the form (the totes and the Finish Load block) are replaced from the server's own answer page and their script runs again; the HBN select takes the server's options and its carried pick; the banner on top takes the server's ("Weight added."); the address takes the answer's URL, so a manual refresh shows the same page. A second weight typed and sent while the first is in flight goes after the first lands. A refusal puts the weight back in the box with the server's words ("10 g: HBN is required."); no answer puts it back with "No answer from the server. Check the list before you add it again." and reads the list again in the background. A browser without fetch posts as before.
- `src/i18n.ts`: the no-answer words, EN and ES ("Sin respuesta del servidor. Revise la lista antes de agregarlo otra vez.").
- `src/theme.ts`: the status line on a row of its own under the entry form.
- `test/fieldharvest.test.ts`: one case: the box's autofocus and hook, the "+" hook, the hidden status line with its words EN and ES, the script inside the entry form once, its fetch and its "+" key, no autofocus on the page without a load, and none of the strings the smoke counts inside the script.
- `scripts/smoke.mjs`: the opened load's page carries the box's autofocus and hook, the "+" hook, and the entry script once.

## Gates (the Scribe's sandbox, the fixed tree `2a2e8cf7980a86e9`)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 72 files, 1008 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9263`): `About to apply 85 migration(s)`, `SMOKE PASS`, no ` 500 ` line. The smoke's own posts are plain HTTP and land exactly as before.
- THE DRIVE in a real browser (Chromium through Playwright) against a local worker on the smoke's database (`wrangler dev --persist-to .smoke-persist`), a fresh load on the field screen, 25 checks, all PASS (the refusal's and the no-answer's words recorded beside them): the box takes the cursor on load; click "+": no reload, the box cleared, the cursor still in the box, the row reading 1,234, the HBN carried; type and Enter: the same; type and the "+" key: the same, no "+" left in the box; two weights fast with the server held 600 ms: both landed, newest first, the box empty and the cursor in it; a double tap on an empty box adds nothing; a refusal (the blank HBN): "10 g: HBN is required.", the weight back in the box, no row, no reload, and the retry lands with the words cleared; no answer (the post aborted): "11 g: No answer from the server. Check the list before you add it again.", the weight back, the cursor in the box, the retry lands; after the replacements Finish Load YES still opens its list in place and a tote's HBN change still moves the cursor to its PIN; one banner on top; the address reads the answer; a manual refresh shows the same list and the box takes the cursor again. The page's console carried only the deliberate 400 and the deliberate abort. Then two touch tablets emulated (Galaxy Tab S4 and iPad gen 7 profiles, tap events): tap the box, type, tap "+", type, tap "+": no reload, the cursor in the box after each tap, both weights listed.
- Dash audit: 0 (em and en), no CR byte, no BOM on the five files; no secret value; no personnel data added (the smoke's four standing matches are the old fixtures' comments, unchanged).

## Observations for his word (no hold)

- The drive ran Chromium, its tablet profiles emulated; real iPad Safari was not in the Scribe's hands. The technique (the "+" press not taking the focus, the post in the background) is the standard one and Safari supports it, but his eye on the floor's tablet is the proof: type, "+", type.
- On a tablet whose number keyboard has no Enter key (an iPad's number pad), the "+" is still a tap; the cursor and the keyboard now stay up through it.
- Penn North Harvest's "Add a weight" still reloads the page (its box takes the cursor on the reload already); if the PNN tablet feels the same, the same script is one more small change there.
- A tote added on another tablet while this one types shows up on this page with the next "+" (the list comes back from the server each time).

## Landing (done, on his request)

The five files written whole to the worktree on his disk and verified by hash; the worktree's app tree reads `2a2e8cf7980a86e9`.

## The merge (his hands; the snapshot first and the block stopping on its failure, the canon checkout before the merge)

REPLACED: run the block in `SESSION_REPORTS/2026-10-01_finish_load_in_reach_and_the_weighted_btr.md` instead; it carries this fix with the Finish Load fix and the weighted BTR in one commit (canon 0.30.335). The block below stays as the record.

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_field_plus
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "The field + keeps the cursor" -m "Penn South/Arlington Harvest: the Weight box takes the cursor, the + press does not take it, the + key in the box is the + button, and the + posts in the background so the page never reloads and a tablet's keyboard stays up; the totes and Finish Load come back from the server's own page; a refusal or no answer puts the weight back with the words under the form. The owner's quality of life request, canon 0.30.334. BRIEF V10 rides in BRIEFS/.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge: the field + keeps the cursor"
git push
```

If the snapshot answers 7403 on its first query, run the snapshot line alone once more and then the rest. The push runs the workflow (typecheck, the tests, no migration to apply, the deploy). His paste back: the Version ID from the deploy step's log; the Scribe reads main and folds LIVE.

## Sealed final check

```
THE TREE BEFORE (main's, 64a357f2992d12bd, checked on his disk before the landing)
app/src/fieldharvest.ts                        13497  d7cb473cd925ea49
app/src/i18n.ts                               195891  c2cb2f3e24c8e838
app/src/theme.ts                              177757  f5db725a2ad82d6e
app/test/fieldharvest.test.ts                  30803  f1bca4d09c53444f
app/scripts/smoke.mjs                         679481  91c973387cb7a823

THE FIXED TREE (2a2e8cf7980a86e9, the sandbox and his disk)
rm worker-configuration.d.ts; npm run typecheck      exit 0
TZ=UTC npx vitest run                 72 files, 1008 tests passed
TZ=America/New_York npx vitest run    72 files, 1008 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9263 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 85 migration(s); SMOKE PASS; " 500 " lines: 0
the drive (Chromium, a local worker on the smoke's database)   25 checks PASS; two touch profiles PASS
app/src/fieldharvest.ts                        19171  9847a0673941c5e5
TAIL }
app/src/i18n.ts                               196235  9fb8cc7024b8c57a
TAIL }
app/src/theme.ts                              177946  a0e21aa83961c90d
TAIL }
app/test/fieldharvest.test.ts                  33208  c872f2a2552689d1
TAIL });
app/scripts/smoke.mjs                         680017  1f46fd56a062a19e
TAIL });
changed against main's tree, not in the five: none
dash audit: 0; CR audit: 0; BOM: none; secret grep: no values; personnel data: none added
```
