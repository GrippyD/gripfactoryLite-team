# SETUP FOR THE 26062 INVESTIGATION: GETTING THE REPO AND AN AGENT ON YOUR MACHINE

For the investigator. Read this once, top to bottom, before opening any AI tool. It takes about twenty minutes the first time. The investigation prompt itself is the other file, `2026-10-08_lot_26062_investigation.md`; this file gets you to the point where you can paste it.

## What you are about to do, in plain words

The app's code lives in a GitHub repository (the "repo"). You will take a copy of it onto your own computer (a "clone"), make a side track of your own inside that copy (a "branch") so nothing you do touches the real thing, let an AI coding agent read the code and a copy of the database, and have it write ONE report file. Then you send your branch back up to GitHub (a "push"). The owner reads the report and decides what, if anything, happens next. Nothing you or the agent do here changes the live app or the live database: the live database is never connected, and the main branch is never touched.

## What you need before you start

1. A GitHub account, and the owner must add it as a collaborator on `github.com/GrippyD/gripfactoryLite`. Until he does, step 3 below fails with a "repository not found" message; that is the sign to ask him, not a bug.
2. Git installed. On Windows, install "Git for Windows" from git-scm.com with its defaults. On a Mac, open Terminal and type `git`; it offers to install the tools.
3. Node.js version 22. Install the LTS build from nodejs.org. Check with `node --version` in a terminal; it should start with `v22`.
4. An AI coding agent. Either Claude Code (a terminal program; install per claude.com/claude-code) or Cursor (an editor; cursor.com). Both read the folder they are opened in and can run commands in it. Everything below works with either.
5. The snapshot folder from the owner. It is a folder named like `20261008-135926_post_dedupe` holding one `.json` file per table and `_manifest.json`. He will send it as a zip. Unzip it somewhere OUTSIDE the repo folder, for example `C:\Users\<you>\Documents\gf_snapshot\20261008-135926_post_dedupe`. Keeping it outside the repo is what keeps it from ever being committed.

## Step by step

Open a terminal (Windows: "Git Bash" from the Start menu, or PowerShell; Mac: Terminal). Each line below is one command; type it and press Enter.

1. Pick a home for the clone and go there:
   `cd ~/Documents`
2. Clone the repo (this downloads it; it asks for your GitHub login the first time, through a browser window):
   `git clone https://github.com/GrippyD/gripfactoryLite.git`
   You now have a folder `gripfactoryLite`.
3. Go into it and make your branch:
   `cd gripfactoryLite`
   `git switch -c investigate-26062`
   The second command creates the side track and puts you on it. Confirm with `git branch --show-current`; it must print `investigate-26062`. If it prints `main`, run the switch command again before anything else.
4. Install the app's packages, so the agent can read types and run the tests if it wants to:
   `cd app`
   `npm ci`
   `cd ..`
   This takes a minute or two and writes only into `app/node_modules`, which git ignores.
5. Open the agent in THIS folder (the `gripfactoryLite` folder, the one holding `app`, `canon`, `BRIEFS`, `SESSION_REPORTS`):
   Claude Code: with the terminal still in `gripfactoryLite`, run `claude`.
   Cursor: File, Open Folder, choose `gripfactoryLite`, then open its chat panel.
6. Paste the investigation prompt. Open `BRIEFS/2026-10-08_lot_26062_investigation.md`, copy its entire text, and paste it as your first message. Then add one line of your own, filling in the real path:
   `The snapshot folder is at C:\Users\<you>\Documents\gf_snapshot\20261008-135926_post_dedupe`
7. Let it work. It will read migrations, write a small script to read the JSON files, and think out loud. When it asks to run a command or write a file, read what it is asking: a script that reads the snapshot, a file written under `SESSION_REPORTS/`, and `git add` / `git commit` of that one file are all fine. Say no to anything else, and in particular to any `git push`, `git merge`, `git switch main`, `wrangler`, `npm run deploy`, or anything that asks for a password, token or login. The prompt tells it not to; your job is to hold it to that.
8. Read the report yourself. It is `SESSION_REPORTS/2026-10-08_lot_26062_investigation.md`. Ask the agent plain questions about it ("which load does the 1,903,423 g number come from?", "what would a person have to tell you to settle this?") until you could explain it to the owner in two minutes. If something looks wrong, say so and let it revise; it commits again.
9. Push your branch (your hands, not the agent's):
   `git push -u origin investigate-26062`
   Then tell the owner the branch name. On GitHub he will see it under Branches and read the report there. He merges it; you do not.

## If something goes sideways

Wrong branch: `git branch --show-current` tells you where you are; `git switch investigate-26062` puts you back. Never run `git switch main` followed by a commit.

The agent edited code or other files it should not have: `git status` lists every changed file; `git restore <file>` throws away the change to that file. The only file that should show as new is the report.

A command asked for a Cloudflare login, an API token, or a database id: close it, do not supply one, and tell the owner. Nothing in this task needs any of them.

You want to start over: delete the `gripfactoryLite` folder and do steps 1 to 4 again. Nothing is lost that cannot be recreated; the live app is not involved.

## What the agent must never do here, so you recognise it

Push, merge, deploy, touch `main`, touch the `canon/` folder, run anything against the remote database, commit the snapshot, write a person's name into the report, or run a repair. If it proposes any of these, decline and carry on.
