# THE BRANCH PLAN: GFLiteOpsDashboard (canon 0.30.277)

For the owner's word first, then for the build sessions slice by slice. Canon wins over this plan where they differ; read `canon/_NOW.md` first. This is the plan he asked to see clearly (canon 0.30.260, verbatim: "I'm fine with merging in pieces. If you want it can even be multiple branches. I just need to see the plan clearly."); his word tonight, verbatim: "Let's start the branch". Nothing here commits, pushes or deploys by itself; every act that touches the remote or the floor is named with whose hands do it.

## The ruling it serves (owner, 2026-09-27, verbatim)

"Help me on this one. I feel like we're a little backwards on our github order of ops. I want to get to where pushing to github is the deploy step and we're building the branches on my disk and only pushing when they're ready to merge with main"

"Then the branch, hopefully on disk where the risk is limited to my laptop and a push to git hub is a deploy to cloudflare in one stroke."

"I think I'm going to set you up for pushes, so that the option is there. It will be easier for dispatch purposes."

## 1. The shape

1. ONE BRANCH, ONE FOLDER. The branch is `GFLiteOpsDashboard`, born from `main` at `96dbe2a` (canon 0.30.276) into a git worktree inside the repo folder: `branches/GFLiteOpsDashboard`. A worktree is a second checkout of the same repository in its own folder, so `main` stays checked out and deployable where it is, and the branch builds beside it with its own `node_modules`, its own `.wrangler` and its own smoke persist. `branches/` is git-ignored, so the folder never rides. The Scribe's bridge and his Code session both reach it, because it sits inside the connected folder.
2. SLICES IN SEQUENCE. The Major Move is ten slices (section 4). Each slice is a brief of its own, built in the worktree by his Code session under THE DISPATCH RULE, gated by the Scribe on the worktree's tree against `main`'s, and merged into `main` when it passes. The next slice begins on the same branch after the merge. A slice that must wait steps aside onto a side branch of its own (his "multiple branches" offer, taken only when needed).
3. THE MERGE IS HIS HANDS. In the main folder: `git merge --no-ff GFLiteOpsDashboard`, then `git push`. After the merge and before the push the Scribe reads `main`'s tree; if it is not the gated tree (a hotfix landed on `main` meanwhile), the gate re-runs on `main`'s tree before the push. Under G-1 the Scribe may push by his word for that one push once section 3 exists.
4. THE WORKTREE NEVER DEPLOYS. `npm run deploy:grip` is never run from `branches/`; the worker is deployed from `main` alone: by the workflow once section 2 lands, by the worker-only line from the main folder until then. A build session deploys nothing, as today.
5. THE FLOOR KEEPS RUNNING. `main` is always the live tree plus what has been merged and pushed. A floor fix during the branch's life is a slice on `main` as today (brief, gate, deploy), and the branch takes it in with a merge from `main` before its next gate.

## 2. The push is the deploy (slice V1)

1. THE WORKFLOW. `.github/workflows/deploy.yml`, on push to `main` only: check out, Node 22, `npm ci` in `app/`, `npm run typecheck` (wrangler types, then tsc), `npx vitest run`, then `npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote`, then `npx wrangler deploy --env grip`. One deploy at a time (a concurrency group). A push of any other branch runs nothing, so the branch can be pushed to GitHub for safekeeping without deploying.
2. THE TWO SECRETS, his hands, never in chat: `CLOUDFLARE_API_TOKEN` (a token minted in the Cloudflare dashboard with Workers Scripts edit and D1 edit on the account, nothing more) and `CLOUDFLARE_ACCOUNT_ID`, set in the repository's Settings, Secrets and variables, Actions. The workflow reads them as environment for the two wrangler steps. No token is ever written to the repo, a report or canon.
3. THE GATE STAYS THE GATE. The Scribe's gate on the worktree (tsc, vitest both zones, the from-zero smoke, the audits, the rehearsal of any migration on the newest snapshot) is what lets a slice merge. The workflow is the deploy hand and a backstop (typecheck and tests again on the merged tree); it does not run the smoke, which takes five minutes and belongs to the gate.
4. THE SNAPSHOT BEFORE A MIGRATION stays his hands from the main folder, `node scripts/db-snapshot.mjs pre_<slice>`, before the merge that carries the migration, so `db_backups/` on his disk stays the home of the floor's snapshots and nothing of the floor lands in GitHub. (The alternative, a snapshot in the workflow kept as a run artifact, would put table dumps with the crew's names and phones in GitHub's storage; declined unless he says otherwise.)
5. THE FIRST PROOF. The merge of V1 itself, `main` plus the workflow file and nothing under `app/src`, runs the workflow for the first time: the migrations step answers no migrations to apply and the deploy redeploys the live tree unchanged, a harmless deploy that proves the path. His paste back: the run's page (green) and the Version ID it printed; the Scribe folds LIVE from it as from any paste.
6. WHEN IT FAILS. A red run deploys nothing (the deploy step runs only after the checks). The fix is a slice on `main` like any other; nothing on the floor moved.

## 3. The Scribe's push (optional, his pick)

Two ways, both keeping the credential off the chat and off the Scribe's mirror:

- THE TOKEN FILE (G-1 as amended, 0.30.261): a fine-grained GitHub token scoped to this one repository (Contents read and write, Metadata read), minted and revoked by him, written by his hands into a git-ignored file the bridge's git reads by itself (`.scribe/credentials`, the store helper pointed at it with a repo-relative path). The Scribe then pushes by his word for that one push, after saying what it carries.
- THE ROAD LANE'S PUSH MODE (canon 0.30.51): the deploy watcher on his laptop, which already holds his git credentials, pushes when the Scribe drops a request file in `DEPLOY/` naming the branch and the commit; no credential leaves his laptop. A slice of its own on the watcher script.

Neither is needed to start the branch. Until one exists, pushes are his hands, as tonight.

## 4. The slices, in order

Each is a brief of its own when its turn comes; the sizes are the Scribe's estimate of one Code sitting (S), two (M) or three or more (L). "His hands" names what only he can do for that slice.

- V1, THE DEPLOY FROM THE PUSH (S; no app change). The workflow file, `branches/` in `.gitignore`, the worktree rule in `CLAUDE.md`. His hands: the worktree's birth (section 5), the two secrets, the merge and push, the run's paste.
- V2, THE ICONS AS LINE ART (S; no app change until his word). The ten icons of the doc redrawn as SVG line art in the app's own stroke: the Rad box, the Cryo picture, the bud box, the prepack bag, the shake bag, the fire, the pallet, the trailer, the phone, the handshake, and the four testing icons (pretest checks, today's flask, the microscope, the COA). Proofs to his eye before any pane draws them (his ruling 24). The files land under `app/public/icons/` on the branch and ride with the first pane that uses them.
- V3, GLOBAL AND PLANTS (M; one migration). The collapse state of each area kept per browser (localStorage, his ruling 5); the day selector reading today so far when today is picked, yesterday the default on load (Global 2); Admin Lookup Farm Plant Count, one number per farm per harvest year, never overridden by METRC, the denominator of remaining over total (Plants 1, ruling 11); the explanations under the Plants and Trimming panes removed (Plants 2, Trimming 4); the day's total harvested weight as a line on every Plants pane, zero included (Plants 3); the hours confirmed saved per date and operation for later review (Plants 4; the labor tables already keep a row per date, the slice proves it and adds what is missing).
- V4, THE TESTING GATE (L; one migration likely). The Testing section replaced (ruling 21) by the Inventory Gate's four panes, left to right: Ready for Testing (NotSubmitted and pasteurized), Scheduled for Testing (the desk's orders), In Testing (Submitted), Passed Testing (TestPassed and RetestPassed), pounds centered under each icon, bud types only (BUD, PRE, MOB and the like; WBP and WIP never), always live (ruling 19); the Quality Stats row (First Time Fails, First Time Tests, FTQ rate) and the Failure Mode pie from the InTesting sheet, a segment clicked pulling free and listing the strains and market strains with their share (rulings 20, 22).
- V5, FULFILLMENT (M; one migration). Admin Lookup Fulfillment Override: a date defaulting to today, three columns (Accepted, Submitted, Shipping Today), ten rows (Bulk Bud, Biomass/Trim, Prepack, Prerolls, Shake, Bulk Distillate, Vapes, MOBs, Bulk Isolate (THCA), Bulk Infused) with input masks in METRC's units, the panel the sole source of the figures (ruling 10); the three panes: Shipping today as a stacked bar inside the trailer, Submitted and Accepted as stacked bars beside their icons, a series drawn only when the day's value is not null, following the day picked, entries kept for posterity (ruling 23).
- V6, TRIMMING (M; one small migration). The Right now pane above the shift panes carrying the machine picture across both shifts with the BTR as a full-width bar on the live number; the shift panes keeping the bud centered for the day picked, their machine pictures removed; the cutting and bucking hours out of the trim panes, renamed harvest hours and typed once on the Totals pane, not per farm (his answer on the assumptions); the day's totals under the panes (Total Lbs, Total Hours, Lbs/DLH), shift agnostic; DOWN with a timer after thirty idle minutes (ruling 15).
- V7, DRYING (L; one migration; his live walk first). A tile collapses on click to its name, icon, status and wet weight, collapsed by default; every kind of space on its own row (Silo, Freezer, Cure Space, Dry Room) with a scroll arrow past five; each row's own total at its left (Drying in Silos, Hang Drying, Fresh Frozen, Curing); freezers and cure spaces acting like silos for load and unload while keeping their own colors and words, without losing the data already there. The cure rooms CSA and CSB become spaces of their kind. His hands: the live walk of CSA and CSB before the brief (ruling 12; the Scribe reads stills from a video, no sound).
- V8, TERP RECIPES AND THE PASTEURIZATION SCHEDULE (M; one migration). Admin Lookup Terp Recipes: the builder (Recipe Name, Terp Name typed, a whole-number percent, the plus, the minus beside each line, Start Over, the default of 100 minus the sum, the prompt at 100 with Save and Start Over); a recipe retired, never edited (ruling 6); the scheduler picking a recipe per scheduled lot on the Pasteurization step, the last pick kept per market strain while the recipe stands (ruling 7); a dose on the schedule per lot welcome, none in the recipe.
- V9, RAD SCHEDULE AND RAD OPERATION (L; one migration). On the Compliance Console: Rad Schedule's left pane of BUD, WPR, SHA and PRE tags in NotSubmitted, TestFailed or RetestFailed, sorted by testing state then product type then grow type, ordered by the last five of the tag; the standard `>>` and `<<`; the middle pane's suggested greys (100 to 3000 by 100, the last value the default); the right pane's done. Rad Operation: Scheduled `>>`, Running in the Rad `<<>>`, Completed `<<`, the timestamps the point; a run holds 1 to 10 packages, the grey per run; a completed run sends nothing to METRC and its packages enter the testing queue as ready, or re-enter it (rulings 8, 9).
- V10, PASTEURIZATION ON THE CONSOLE (L; one migration). Right now: the Rad icon throbbing green like a loading silo while it runs, an inert outline when empty, the lot numbers and a timer beneath, the grey setting and how long it has been in; the Cryo picture with its burgundy flow moving while the shift has weight on it and DOWN with a timer after thirty idle minutes, UV as the SHA pounds since 6 AM, Cryo as BUD and WPR plus waste, AMAPS as BUD and WPR, the list beside (BUD, WPR, SHA, WASTE, TOTAL in pounds since 6 AM), the unlabeled box the metering conveyor (ruling 16), waste measured by outputs (ruling 17); the two shift panes for the day picked (Bulk Bud, Prepack, Shake, Waste, Total in pounds with their icons, Total Hours with Save, Lbs/DLH) carrying their own hours and operator names (ruling 18).

Cross-cutting, every slice: the ship-clean rule (G-9), no dash (G-8), the sealed final check, the from-zero smoke at the current pin, and a migration only as the next free number.

## 5. His hands to start, tonight or tomorrow

1. The worktree's birth, in the main folder (PowerShell):

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git worktree add branches\GFLiteOpsDashboard -b GFLiteOpsDashboard main
cd branches\GFLiteOpsDashboard\app
npm ci
```

   `git worktree list` then shows two lines, `main` in the main folder and `GFLiteOpsDashboard` in `branches\GFLiteOpsDashboard`. The folder shows as untracked in the main folder until V1's `.gitignore` line lands; harmless.

2. The Cloudflare token and the account id, then the two GitHub secrets, at his keyboard.
3. V1's paste to his Code session, opened in the worktree folder (`branches\GFLiteOpsDashboard`), not the main one.

## 6. What the Scribe does

Writes each slice's brief when its turn comes, from the doc and the twenty-four rulings; gates each slice on the worktree's tree; reads `main` after each merge; folds canon after every event; hands the icon proofs for his eye; never runs git that writes on his tree; pushes only by his word once section 3 exists.
