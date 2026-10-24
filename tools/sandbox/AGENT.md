# For the agent: helping a teammate try an idea in the GripFactory Lite sandbox

Read this before you change anything. You are working with a teammate (not a developer) who wants to try an idea on GripFactory Lite: a page that should look or work differently. Your job is to make the idea real in their sandbox, show it to them, explain it in plain words, and hand it back as a patch the owner's team can test and build in. You are not shipping anything. The owner's Scribe gates every hand-back, and the owner decides what goes live.

## The sandbox, in short
- The repo's app lives in `app/`. It is a Cloudflare Worker: Hono, TypeScript and D1 (SQLite).
  - Pages are server-rendered HTML in `app/src/*.ts`.
  - Styles live in `app/src/theme.ts`, in three looks plus a shared chrome. The switch at the top right calls them Grip, Lite and Continuum; the code calls them `cerberus`, `lite` and `co`.
  - Words go through `app/src/i18n.ts` (English and Spanish).
- `node tools/sandbox/sandbox.mjs start` runs the app at `http://localhost:8787` on a canned copy of live data. Saving a file reloads it.
- Start with `--keep` to keep a change in progress. Without it, start refuses to run over a change, and on a clean copy it resets the code to main.
- Every PIN in the sandbox is `0000` (Admin and Models). The app signs you in as `dev`; anything entered lands in this copy only.
- The canned data has no phones, emails, drivers' license numbers or plates (blanked on purpose). Do not treat their absence as a bug.
- The app's laws are in `canon/CANON.md`. It is long; search it for the page or the word you need instead of reading it whole.

## The loop
1. Ask the teammate what they want and where: the page, and what should change. Restate it in one or two sentences and confirm before you edit.
2. Find the code that draws that page. Search `app/src` for words you see on the page.
3. Make the smallest change that shows the idea. Keep everything else as it is.
4. Tell the teammate what to look at. Check the change in all three looks (the switch at the top right) and at a phone width, and say what you checked.
5. Iterate until they are happy.
6. Write `tools/sandbox/IDEA.md` from `tools/sandbox/IDEA_TEMPLATE.md`, in plain words: what it does, why, where to look, what is unfinished. If you can take screenshots, save them as `.png` in `tools/sandbox/shots/`.
7. Ask the teammate to run the hand-back:

       node tools/sandbox/sandbox.mjs handback "<short title>"

   It writes the patch and your note to the shared ideas folder.
8. When they move on to another idea: `node tools/sandbox/sandbox.mjs reset --yes`.

## How a change should look, so it is easy to build in
- Use theme tokens and the app's own classes, never fixed colors. A change must hold in all three looks, at 1920 and at 820 wide, and on a phone, with no sideways scroll.
- New words on a page go through `t(locale, "...")`, with a Spanish line in `app/src/i18n.ts`.
- Use no em dash or en dash characters anywhere (a house rule). Use commas, colons or parentheses.
- Keep values escaped with `esc(...)`, as the code around you does.
- Do not add a migration or change the database schema. If the idea needs new data, say so in `IDEA.md` and show it with what exists. The team adds the table properly.
- Do not rename or move files, reformat code you did not change, or upgrade packages.
- Tests: run `cd app; npx vitest run` before the hand-back if you can, and say in `IDEA.md` whether it passed.

## What you must never do here
- Never run `git push`, `git merge`, `git commit` on main, `git switch main`, or anything that changes GitHub. The hand-back is the only way out.
- Never run `wrangler deploy`, `npm run deploy:*`, or any wrangler command with `--remote`. Never log in to Cloudflare. Never ask for or use a token, a password or an API key.
- Never edit `canon/`, `BRIEFS/`, `SESSION_REPORTS/`, `.github/`, `app/wrangler.toml` or `app/migrations/`.
- Never copy rows, names, buyers, licenses or manifest numbers from the canned data into `IDEA.md`, a screenshot you share outside the team, or a chat. Describe the idea with counts and invented examples.
- Never run `reset --yes` without the teammate saying so: it throws away their change.

If the teammate asks for any of these, explain why the sandbox does not do it and offer the hand-back instead.
