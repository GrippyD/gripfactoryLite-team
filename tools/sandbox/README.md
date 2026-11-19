# The team sandbox: try an idea on GripFactory Lite, see it, hand it back

This is for teammates who want to change how something in GripFactory Lite looks or works, see the change running with real numbers, and pass it back for us to build in. It runs on your own computer. Each time, one command brings your copy up to what is live today. Nothing you do here can touch the live app, the live database, or anyone else's work.

How it works:
- You work in the team copy of the code (the `gripfactoryLite-team` repository on GitHub). Its main is the code that is live now.
- `start` resets your copy to that main and runs the app at `http://localhost:8787` on a canned copy of live data. The data is a snapshot Dennis shares (a "can"), built into a local database once and kept between sessions.
- Your copy is always **burnt orange** around the page: the page ground and a frame around the window, in all three looks. Live never is. If you see orange, you are on your own copy.
- **Refresh D1** on the home page loads the newest can from the shared folder whenever you want fresher data.
- You and your agent change files, and the page reloads by itself.
- `handback` writes your change as a patch file, with a short note, into your ideas folder. The Scribe tests it like any other build and Dennis decides what ships. Nothing you do is pushed to GitHub; the hand-back is the only way an idea leaves your computer.

## What you need once

1. Git, Node.js 22 (22.5 or newer; the current 22 LTS from nodejs.org is right) and your AI agent (Claude Code or Cursor).
2. A free GitHub account. Dennis invites you to the `gripfactoryLite-team` repository; accept the invite from the email GitHub sends.
3. Two folder paths, both in the shared folder `GripFactory Sandbox` (OneDrive), which appears on your computer once it syncs:
   - the CAN: the newest folder in `GripFactory Sandbox\can`, named like `20261117-115853_pre_wb1`, holding one `.json` file per table and a `_manifest.json`;
   - your IDEAS folder: `GripFactory Sandbox\ideas\<your first name>`, where hand-backs go.

   Keep both outside your copy of the code; the tool refuses them inside it.

## First time (about ten minutes)

Open PowerShell (Windows) or Terminal (Mac).

1. Get the team copy, in a folder of its own outside OneDrive and outside Documents (both sync files and get in the way):

       git clone https://github.com/GrippyD/gripfactoryLite-team.git C:\Users\<you>\GFLite-team
       cd C:\Users\<you>\GFLite-team

   GitHub may ask you to sign in. That is your own GitHub login, and it is fine. If you have an older copy of GripFactory Lite from before, leave it alone and use this one.
2. Set up, with your two paths and your first name (no backslash at the end of a path):

       node tools/sandbox/sandbox.mjs setup --can "C:\path\to\GripFactory Sandbox\can\<the newest folder>" --ideas "C:\path\to\GripFactory Sandbox\ideas\<your first name>" --name <your first name>

   This saves your paths on your computer, installs the app's packages and builds the database from the can, which takes a few minutes the first time. Then it starts the app and opens your browser. When it asks for a PIN anywhere, the sandbox PIN is `0000`.

## Every time after that

From your `GFLite-team` folder:

    node tools/sandbox/sandbox.mjs start

You get today's main, any new database changes, and the app in your browser. Stop it with Ctrl+C.

## Fresh data: Refresh D1

The strip at the top of the home page says which can your data came from, and when Dennis has put a newer one in the shared `can` folder.

1. Press **Refresh D1**, check what it will load, then press **Refresh now**.
2. The app keeps working while the new database is built beside it, then restarts by itself; the page comes back on its own. With a full can this takes a few minutes.
3. Your code and your change in progress stay as they are. Anything you typed into your copy (notes, entries) is replaced by the can's data.

The same, by hand, with the app stopped: `node tools/sandbox/sandbox.mjs can "C:\path\to\the\newer can"`.

## Trying an idea

1. Tell your agent what you want to try. Point it at `tools/sandbox/AGENT.md` first; that file tells it how this works and what it must not do.
2. Look at the page in your browser. Saving a file reloads the app. Try the three looks (Grip, Lite, Continuum, top right) and a narrow window, or the phone switch, so you see the change everywhere. Judge colors on the page itself, not on the orange around it: live has no orange.
3. When you like it, have the agent write the note (`tools/sandbox/IDEA.md`: what, why, where to look), then:

       node tools/sandbox/sandbox.mjs handback "short title of the idea"

   This writes a folder in your ideas folder with the patch, the note, the list of files and any screenshots. Tell Dennis the title.
4. For the next idea, start clean:

       node tools/sandbox/sandbox.mjs reset --yes

   This throws the change away (it is already in the ideas folder) and keeps your database.

Stopped the app halfway through an idea and want to carry on? Use `start --keep`. It skips the refresh so your change stays.

## Good to know

- The data is a copy of live: real lots, strains, packages, buyers and people's names. It stays on your computer, in `app/.sandbox-persist`, which git never picks up. Phones, emails, drivers' license numbers and plates are blanked, the SensorPush link is left out, and every PIN is `0000`. Still, do not copy rows, names or buyers out of it into notes, chats or screenshots you share outside the team.
- In the sandbox you are signed in as `dev`. Anything you enter lands in your own copy only.
- Nothing here can reach the live database or deploy. The tool runs the app locally only, never pushes to GitHub, and never touches main. Please do not push to the team copy either: ideas come back only as hand-backs.
- Where am I? `node tools/sandbox/sandbox.mjs status` shows how far behind main you are, whether a change is in progress, which can your data came from, and whether a newer one is waiting.

## If something goes sideways

- "You have a change in progress" when you start: you have unsaved work from before. Hand it back, keep going with `start --keep`, or throw it away with `reset --yes`.
- "Port 8787 is busy": the app is already running in another window. Use that one, or close it. If something else of yours uses 8787, run `start --port 8790`.
- Refresh D1 says the refresh failed: usually the new can is still syncing from OneDrive. Wait until it has finished, then press Refresh D1 again. Your data was not changed.
- The home page says the sandbox tool is not answering: the app was started some other way. Stop it and run `start`.
- A Git or Node error on the first run: check `git --version` and `node --version` (it must start with v22).
- Anything asks for a Cloudflare login or an API token: say no and tell Dennis. Nothing in the sandbox needs one.

## For Dennis

Making a can: share a scrubbed copy of a snapshot, never the snapshot itself. From the live repo's top folder:

    node tools/sandbox/sandbox.mjs pack "db_backups\<snapshot folder>" "<GripFactory Sandbox>\can\<snapshot folder>"

It writes the same files with every PIN set to `0000`, the SensorPush tokens left out, and phones, emails, drivers' license numbers, plates and raw uploads blanked. Put each new can beside the others in the `can` folder: Refresh D1 picks the newest by the time its snapshot was taken.

Bringing the team copy's code up to live: from the live repo's top folder,

    git push https://github.com/GrippyD/gripfactoryLite-team.git main:main

The team works on their own copies and never pushes, so this never collides. Share the team copy only: never the live repository, a zip of its folder, or a raw snapshot.
