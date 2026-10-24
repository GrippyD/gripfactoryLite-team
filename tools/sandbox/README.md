# The team sandbox: try an idea on GripFactory Lite, see it, hand it back

This is for teammates who want to change how something in GripFactory Lite looks or works, see the change running with real numbers, and pass it back for us to build in. It runs on your own computer. Each time, one command brings your copy up to what is live today. Nothing you do here can touch the live app, the live database, or anyone else's work.

How it works:
- `start` resets your copy to the current main on GitHub. Main is the code that is live now.
- It runs the app at `http://localhost:8787` on a canned copy of live data. The data is a snapshot Dennis shares, built into a local database once and kept between sessions.
- You and your agent change files, and the page reloads by itself.
- `handback` writes your change as a patch file, with a short note, into the shared ideas folder. The Scribe tests it like any other build and Dennis decides what ships.

## What you need once

1. Git, Node.js 22 (22.5 or newer; the current 22 LTS from nodejs.org is right) and your AI agent (Claude Code or Cursor).
2. Your copy of the repo (the `gripfactoryLite` folder from GitHub). An old copy is fine; step 2 below brings it up to date.
3. Two folder paths from Dennis:
   - the CAN, a snapshot folder named like `20261024-082052_pre_queue_wl_s3g`, holding one `.json` file per table and a `_manifest.json`;
   - the IDEAS folder, the shared folder where hand-backs go.

   Both are shared folders (OneDrive or SharePoint), so they appear on your computer once they sync. Keep them OUTSIDE your repo folder; the tool refuses them inside it.

## First time (about ten minutes)

Open PowerShell (Windows) or Terminal (Mac) in your `gripfactoryLite` folder, the one holding `app`, `canon` and `tools`.

1. If you have anything of your own in this copy that is not on GitHub, save it somewhere else first. Step 2 moves this copy onto a fresh branch.
2. Bring the copy up to today's main (one time, by hand, because an old copy does not have the sandbox tool yet):

       git fetch origin
       git switch --no-track -C sandbox origin/main

   GitHub may ask you to sign in. That is your own GitHub login, and it is fine.
3. Set up, with your two paths and your first name (no backslash at the end of a path):

       node tools/sandbox/sandbox.mjs setup --can "C:\path\to\the\snapshot folder" --ideas "C:\path\to\the\ideas folder" --name Patrick

   This saves your paths on your computer, installs the app's packages and builds the database from the snapshot, which takes a few minutes the first time. Then it starts the app and opens your browser. When it asks for a PIN anywhere, the sandbox PIN is `0000`.

## Every time after that

    node tools/sandbox/sandbox.mjs start

You get today's main, any new database changes, and the app in your browser. Stop it with Ctrl+C.

## Trying an idea

1. Tell your agent what you want to try. Point it at `tools/sandbox/AGENT.md` first; that file tells it how this works and what it must not do.
2. Look at the page in your browser. Saving a file reloads the app. Try the three looks (Grip, Lite, Continuum, top right) and a narrow window, or the phone switch, so you see the change everywhere.
3. When you like it, have the agent write the note (`tools/sandbox/IDEA.md`: what, why, where to look), then:

       node tools/sandbox/sandbox.mjs handback "short title of the idea"

   This writes a folder in the shared ideas folder with the patch, the note, the list of files and any screenshots. Tell Dennis the title.
4. For the next idea, start clean:

       node tools/sandbox/sandbox.mjs reset --yes

   This throws the change away (it is already in the ideas folder) and keeps your database.

Stopped the app halfway through an idea and want to carry on? Use `start --keep`. It skips the refresh so your change stays.

## Good to know

- The data is a copy of live: real lots, strains, packages, buyers and people's names. It stays on your computer, in `app/.sandbox-persist`, which git never picks up. Phones, emails, drivers' license numbers and plates are blanked, the SensorPush link is left out, and every PIN is `0000`. Still, do not copy rows, names or buyers out of it into notes, chats or screenshots you share outside the team.
- In the sandbox you are signed in as `dev`. Anything you enter lands in your own copy only.
- Nothing here can reach the live database or deploy. The tool runs the app locally only, never pushes to GitHub, and never touches main.
- A newer snapshot from Dennis? Stop the app, then run `node tools/sandbox/sandbox.mjs can "C:\path\to\the\newer snapshot"`. It rebuilds the data; your code is untouched.
- Where am I? `node tools/sandbox/sandbox.mjs status` shows how far behind main you are, whether a change is in progress, and which snapshot your data came from.

## If something goes sideways

- "You have a change in progress" when you start: you have unsaved work from before. Hand it back, keep going with `start --keep`, or throw it away with `reset --yes`.
- "Port 8787 is busy": the app is already running in another window. Use that one, or close it. If something else of yours uses 8787, run `start --port 8790`.
- A Git or Node error on the first run: check `git --version` and `node --version` (it must start with v22).
- Anything asks for a Cloudflare login or an API token: say no and tell Dennis. Nothing in the sandbox needs one.

## For Dennis: making a can

Share a scrubbed copy of a snapshot, never the snapshot itself. From the repo's top folder:

    node tools/sandbox/sandbox.mjs pack "db_backups\<snapshot folder>" "<shared folder>\can\<snapshot folder>"

It writes the same files with every PIN set to `0000`, the SensorPush tokens left out, and phones, emails, drivers' license numbers, plates and raw uploads blanked. Teammates point `--can` at that copy. When a newer snapshot is worth sharing, pack it beside the old one and tell the team to run `can` with the new path.
