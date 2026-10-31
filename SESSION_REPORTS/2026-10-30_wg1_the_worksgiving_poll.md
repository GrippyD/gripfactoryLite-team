# WG1: THE WORKSGIVING POLL

Built and gated by the Claude session on 2026-10-30, on the owner's word, in the GFLiteMetrcAPI worktree. Nothing is committed, pushed or deployed. Canon was not touched: the ledger is the Grok Bot scribe's (canon 0.30.559), so this report is the record for whoever folds it.

## The ask
- The owner brought a poll spec written for another stack (Postgres, a `lite.` schema, Pages Functions) and his announcement email, with these addendums, verbatim:
  - "I want it hosted at https://gripfactory-lite-grip.gflite.workers.dev/special/worksgiving26 (a new directory). I don't want any new navigation buttons that lead to it though. /special/ can only be reached when I share a link to it."
  - "Remove utensils/napkins/etc as an option"
  - "Review my email and tell me what it's missing." (answered in chat)
- His picks on the question tool, verbatim:
  - "You build it here (Recommended)";
  - "Bypass Access for /special (Recommended)";
  - "No caps, show live counts";
  - "Any email (Recommended)".
- Then, verbatim:
  - "not that I want this to take longer, but add a "Yes +1" option to the RSVP";
  - "contact me to fix it" (he is the contact for a changed answer; his name goes in at Admin, never in a repo file).

## Trees
- Received: `0dc10dd8baba39fa` (CT1, main b117b03; the worktree and the main folder's app both read it).
- Built: `d4d7a4f84df9e1c8` (443 files). Seven files:
  - new: `src/potluck.ts`, `test/potluck.test.ts`, and the migration;
  - changed: `src/index.ts`, `src/i18n.ts`, `src/theme.ts`, `scripts/smoke.mjs`.
- **The first merge block (2026-10-30):**
  - its first run stopped at the snapshot on a passing 7403 (the empty `20261030-205606_pre_wg1`);
  - the second took `20261030-205613_pre_wg1` (132 tables, 721,205 rows; record_change_log failed on its size, as the guard allows), committed fa6392c in the worktree and merged it into the laptop's main (1dbebab);
  - the push was refused, because GitHub's main had moved to d934734 (LD1 with 0124, and FB1 with `0125_fulfillment_prepack_bags.sql`).
- **Merged onto d934734** (its app tree `3a3948949746b3b5`, exported by his hands, read as data):
  - git merged `src/index.ts` and `src/i18n.ts` cleanly;
  - the smoke's migration count was the one conflict, now 125;
  - the poll's migration is renumbered `0126_worksgiving_poll.sql`, since FB1 holds 0125.
- **Left:** `698a2413eef600bd` (447 files, 125 migrations), the tree his finishing block lands.

## What it is
1. **The page,** `/special/worksgiving26`. One standalone page in Lite's colors: no app chrome, no menu, no login, never cached or indexed, English and Spanish (a switch at its top).
   - **Are you coming?** Yes, Yes +1, No or Maybe.
   - **What are you bringing?** Main / protein, Hot side, Cold side / salad, Bread / rolls, Dessert, Drinks, or Nothing this time, just eating.
     - Each category shows how many have picked it so far. There are no caps.
     - Picking a category opens "What's the dish?" (2 to 80 characters).
     - A No hides the question, and the server drops whatever was picked.
   - **Your email:** any domain, lower case and trimmed.
   - **Review:** the answers read back, with the warning: "One submission per email. Once you submit you can't change it from this page. Contact {contact} to fix anything."
     - Go back returns every answer intact.
     - Submit disables itself on the tap.
   - **Done:** "You're on the list.", the answers, and "Need a change? Contact {contact}."
   - **Refusals,** each said in words: an answer already in from that email (at Review and at Submit), a field that is off, and the close ("Sign-ups closed ...").
   - **A honeypot field** no person sees: a form that fills it hears done and stores nothing.
2. **The guarantees are the database's** (0126):
   - one live answer per email per event (a partial unique index);
   - the CHECKs: the email normalized, the four answers, the six category keys, a dish only with a category, nothing to bring on a No.
3. **/special opens nothing else.** The identity middleware answers `/special/worksgiving26` (GET, HEAD, POST) and nothing more there:
   - every other `/special` path is a plain 404;
   - the trailing slash redirects;
   - the poll never reads or makes an identity, so no people row is born.
4. **The results,** `/admin/special/worksgiving26`, behind Access and the Admin PIN, linked from nowhere:
   - the tiles: People coming (one per Yes, two per Yes +1; Maybe not counted), Yes, Yes +1, Maybe, No, Responses;
   - what's coming by category, with each dish and its email;
   - the answers, with Remove (a logged soft delete that lets that email answer again);
   - the CSV at `/admin/special/worksgiving26.csv`: email, attending, category, dish, submitted_at in farm time;
   - **The event:** the event date, the time and note, where, the contact, and when sign-ups close. Every change is logged.
5. **The seed:**
   - Friday 2026-11-20, "after your shift";
   - no place;
   - the contact blank, which shows "the Ops office";
   - sign-ups close Tuesday 2026-11-17 at 5:00 PM farm time.
   The place, the time and his name as the contact are his to type at Admin, so no name rides in a repo file.

## The acceptance
- **The suite:** 7 tests in `test/potluck.test.ts`:
  - the migration's constraints, Yes +1 among them;
  - the draft check;
  - the doors under /special, with the Access-fronted env;
  - the whole flow, including the duplicate, a No, the refusals and the honeypot;
  - the close;
  - Spanish;
  - the results, the CSV, the event's words and Remove, each logged.
- **The smoke:**
  - the page with no login;
  - a 404 elsewhere under /special;
  - review, submit, a second answer from the same email refused;
  - the count;
  - the results and the CSV behind the PIN.
- **The bench,** on the smoke's end state:
  - the page in five states (form, error, review, done, closed) at the phone, 820 and 1920, in English and Spanish: 0 px sideways, no app link, no tap target under 48 px;
  - the real flow at the phone (a No hides the question, a pick opens the dish, Go back keeps every answer, Submit lands done);
  - the results page in all nine views: 0 px sideways, the tables inside their scroll.

## Gates on the tree
- On the poll's own tree `d4d7a4f84df9e1c8`:
  - vitest 1758 passed and 6 skipped in both zones (128 files);
  - the from zero smoke `About to apply 123 migration(s)`, SMOKE PASS, no 500.
- On the merged tree `698a2413eef600bd`:
  - typecheck 0;
  - vitest TZ=UTC: Test Files 129 passed (129); Tests 1772 passed, 6 skipped (1778);
  - vitest TZ=America/New_York: the same;
  - `node --check scripts/smoke.mjs`: 0;
  - the from zero smoke: `About to apply 125 migration(s)`, SMOKE PASS, exit 0, no 500.
- The scans of the seven files: no dash or CR, no personal name. The only non ASCII is the Spanish of the public page (accents and the opening question mark).

## His hands
1. **The merge blocks:**
   - the first took the snapshot of record (`20261030-205613_pre_wg1`, before 0126 rides);
   - the finishing block merges GitHub's main and pushes.
2. **Zero Trust, once:**
   - add a self-hosted Access application for `gripfactory-lite-grip.gflite.workers.dev`, path `special`, with a Bypass policy for Everyone;
   - Cloudflare documents path rules but not this case on workers.dev, so test it on a phone off the farm WiFi, in a private window, before the email goes out.
3. **At `/admin/special/worksgiving26`:** type the time, the place and his name as the contact, then Save.
4. **Send the email** with the link.
