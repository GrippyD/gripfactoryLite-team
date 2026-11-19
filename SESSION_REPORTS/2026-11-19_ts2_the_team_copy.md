# TS2: THE TEAM COPY

Built and gated by the Claude scribe on 2026-11-19, on the owner's word, in the GFLiteMetrcAPI worktree. Nothing is committed, pushed or deployed by this session: the merge block is in his hands. Canon 0.30.569 folds this build.

## The ask
- The owner, verbatim: "Once I've finished step 4, the team will need instructions on how to proceed.  Also, before we do that, let's set the default background for all CSS options to burnt orange.  That way it's always distinguishable in the browser from Live.  Also, add a refresh D1 button to the homepage."
- Step 4 is the last of the scribe's steps for a team copy of the code: a private repository `gripfactoryLite-team` with no secrets and Actions off, the teammates as its collaborators, so nobody on the team can push to the live repository or read its deploy token.
- His picks on the question tool, verbatim:
  - "Load the newest can (Recommended)" (what Refresh D1 does, on a local copy only);
  - "Guide in the repo + email (Recommended)" (where the team's instructions live);
  - "Hand-backs only (Recommended)" (a teammate never pushes; ideas leave as hand-backs).

## Trees
- Received: `3c6a68c0331de685` (WB2 live; main 505eef5, equal to origin/main and GFLiteMetrcAPI); `tools/sandbox` at canon 0.30.545's hashes.
- Left: `9e02875d36962d66` (452 files, 126 migrations; no migration).
- New: `app/src/sandbox.ts`, `app/test/sandbox.test.ts`.
- Changed: `app/src/index.ts`, `app/src/i18n.ts`, `app/wrangler.toml`, `app/scripts/smoke.mjs`, `tools/sandbox/sandbox.mjs`, `tools/sandbox/README.md`, `tools/sandbox/AGENT.md`.

## What it is
1. **Off live, burnt orange.** The default env in `wrangler.toml` carries `OFF_LIVE = "1"`. A named env never inherits vars, so env.grip (live) and env.c10 never carry it. Off live, the outermost middleware adds one style block, last in the head, to every HTML page:
   - a burnt orange (#cc5500) frame around the window, on every page;
   - on the app's own pages, a burnt orange page ground, with the app bar and the page itself keeping each look's own ground (Grip, Lite, Continuum), so a page reads as it does on live while the ground around it says it is not live;
   - 6 px of padding, so the frame never covers the page; nothing of it prints.
   - Vendored pages (the Models tools, Harvest Console Lite, SalesHelper) carry `x-gf-vendored` and stream untouched off live as on live (the vendored pair law). The smoke's pin on the menu tool's bytes caught the first cut, which touched them.
   - JSON, files and redirects pass through untouched.
   - Seen and accepted: off live, the Grip honeycomb and the Continuum pinstripe show on the orange ground only, not under the page.
2. **Refresh D1, on a local copy only.** The sandbox tool's `start` runs a control server on 127.0.0.1 (a random port and a random 128 bit token) and hands its address to the app as `SANDBOX_CONTROL`, a command line var that is never in `wrangler.toml`. The app takes it only off live and only in that exact local shape.
   - **The home page's strip:** "Local copy, not live", the can the data came from with its dump time, a newer can in the shared folder when there is one (judged by dump time), and Refresh D1.
   - **`/sandbox/refresh-d1`:** what a refresh does, the data now, the newest can, a note when it is the same can or an older one, Refresh now, and the progress as it runs; it returns to the home page by itself. Refresh now is a JSON post, so a form posted from elsewhere is refused.
   - **The tool's refresh:**
     - it builds the newest can beside the running app, in a second Node, so the app keeps working;
     - then it stops the app, moves the old database aside, puts the new one in place (or puts the old one back) and starts the app again;
     - a failed build or swap says so in words and leaves the data as it was.
   - **The newest can:** the latest dump among the cans beside the one in the settings. If that can has been cleared from the folder, the newest packed can.
   - **Where the routes answer:** only off live with the tool running, and only to this copy's own host and origin, so a site that points its own name at the computer (DNS rebinding) is turned away. Live, the smoke and a plain wrangler dev answer 404.
   - **The dev server** now runs wrangler's CLI directly (the launcher stays the fallback), so a stop reaches the process that shuts the local runtime down.
   - **`status`** names the newest can, and a hand-back touching `app/src/sandbox.ts` or `tools/sandbox/` is flagged like canon or migrations.
3. **The guide.**
   - **`tools/sandbox/README.md`, rewritten for the team copy:**
     - a free GitHub account and the invite;
     - clone `gripfactoryLite-team` into a folder outside OneDrive and Documents;
     - the can and ideas folders in the GripFactory Sandbox share;
     - setup, start and Refresh D1;
     - the orange;
     - hand-backs only, never a push;
     - the trouble list;
     - for Dennis: packing cans and bringing the team copy's main up to live.
   - **`tools/sandbox/AGENT.md`:**
     - the orange is the sandbox's, never part of a design;
     - never press Refresh D1 or call its routes;
     - the code is the team copy;
     - two more files are never to be edited.

## The acceptance
- **The suite:** `test/sandbox.test.ts` holds 13 tests:
  - off live only by OFF_LIVE, and the tool's address only in its exact local shape (six bad shapes refused);
  - the block last in the head, once;
  - the orange on every HTML page off live, never on live, never on JSON;
  - the strip only with the tool (no call out on live), in both languages;
  - the words when the tool does not answer;
  - the confirm page, the JSON-only post and the status passthrough;
  - a running refresh refused in Spanish, and a failed one shown;
  - no routes on live, in the smoke or on a plain wrangler dev;
  - the host and origin check;
  - a vendored page's bytes untouched;
  - newer only by dump time, and the older note;
  - the status fields kept to what the pages use;
  - every word in Spanish, and no dash.
- **The smoke** runs the default env, so every page it walks passes through the off live middleware. It also checks:
  - the home page carries the block in its head;
  - no strip without the tool;
  - `/sandbox/refresh-d1` answers 404;
  - JSON passes untouched;
  - the vendored menu tool's pinned bytes still hold.
- **The real tool, end to end,** on a scratch clone of the final tree. The setup: a local bare origin, and packed cans made from the smoke's database, every PIN 0000 by the scrub.
  - Setup built can A. The home page wore the orange in all three looks at 1920 and 390: 0 px sideways, the Refresh D1 button 44 px or taller, the strip naming can A.
  - Can B dropped into the shared folder and the strip named it. Refresh D1 showed both cans. Refresh now built B beside the running app, restarted it, and came home on B in 9 s, with B's marker note on the board.
  - A broken can (a manifest, no table file) made the refresh fail in words; the app never stopped and the data stayed.
  - The same can again showed the "already the newest" note, then a clean restart.
  - With the configured can cleared from the folder and only an older can left, there was no "newer" claim and the older note showed. Can C dropped in, and the refresh loaded C, with C's marker note.
  - The Models menu tool off live streamed its own bytes (`x-gf-vendored`, no off live block).
  - Ctrl+C (SIGINT to the group) stopped the tool, the CLI and the runtime with nothing left. After each restart exactly one CLI and its runtime ran.
  - **A defect found and fixed on the way:** the stop's 15 second force timer read the variable the restart had already pointed at the new app, so it killed the new app and took the tool down with it. The timer now holds the stopped app's own handle.
- **The whiteboard bench** (WB2's, on the smoke's end state, off live): the same results as at WB2.
  - 18 board views at 0 px sideways.
  - Every flow passed; the five picture formats reached the check.
  - The phone passed.
  - The Director home at 390 px in the computer layout still scrolls sideways from its top bar, as WB2 recorded; it is not new.

## Gates on the tree
- typecheck 0.
- vitest TZ=UTC: Test Files 131 passed (131); Tests 1801 passed, 6 skipped (1807).
- vitest TZ=America/New_York: the same.
- `node --check scripts/smoke.mjs` and `node --check tools/sandbox/sandbox.mjs`: 0.
- The from zero smoke: `About to apply 126 migration(s)`, SMOKE PASS, exit 0, no 500.
- The scans: no dash or CR in any file TS2 wrote; the only non ASCII is Spanish.

## His hands
1. **The merge block:** TS2 and WB2's report fix in the worktree, canon 0.30.568 and 0.30.569 on main, the merge, the push. No migration and no snapshot. Live shows nothing new: the orange and Refresh D1 never appear on live.
2. **Before the team sees any copy of the code:** change the live Admin and Models PINs. Both are written in the repository (migration 0008 and the smoke test).
3. **A fresh can:** pack one into the GripFactory Sandbox share's `can` folder (the command is in the README).
4. **The team copy:** create it after the push, so it starts with TS2; then invite the team and send the email.

## Sealed final check (G-10), read on the worktree after the write
```
app/src/sandbox.ts              15235 bytes  sha256 98d0b696edceffe7aa9fb06ab5ee12693977c249f3ba94761de35a1dfbcd931c  tail: `;
app/src/index.ts               225775 bytes  sha256 d288124e555158f7e4c5328306d8ad48faac2757d75ae7e956285bf252773a3e  tail: export default worker;
app/src/i18n.ts                422187 bytes  sha256 5ff5a056f8e95559fcc19acd754d21bb117deebf6a79cfffa1228b5200cc6199  tail: }
app/test/sandbox.test.ts        14790 bytes  sha256 387afac07bd0286079f87f7169ab3e86f1332336f2b5975b40fc579024f0c4ea  tail: });
app/scripts/smoke.mjs         1000748 bytes  sha256 ac3d099392b53f8969d6caa70fffdec7778e652a646da398084fefddfcb6d73d  tail: });
app/wrangler.toml                3502 bytes  sha256 f4ba67f692c57a7381fc8cbe228d0024f636b9f2edbe40e39f6ab0953fee678c  tail: migrations_dir = "migrations"
tools/sandbox/sandbox.mjs       53506 bytes  sha256 223616619977793067e601a9763a534672df74976508a974323a4d1ba2c96a7c  tail: }
tools/sandbox/README.md          7784 bytes  sha256 c7d79c70462705104c2234135b8604951d9d546c02bb85ed11b37213745fb6fc  tail: The team works on their own copies and never pushes, so this
tools/sandbox/AGENT.md           5113 bytes  sha256 55d482d10729b583363d4c57b56248e9e4372f15675a051619ecd869a1480ea8  tail: If the teammate asks for any of these, explain why the sandb
parse: tsc --noEmit exit 0 on these bytes; node --check smoke.mjs and sandbox.mjs ok; node --experimental-strip-types --check ok on the four .ts files
tree: 9e02875d36962d66 (452 files, 126 migrations), equal in the Scribe's workspace and the worktree
```
