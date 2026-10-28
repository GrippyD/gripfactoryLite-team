# CT1: THE C&T WALL IS THE REGISTER

Built and gated by the Scribe on 2026-10-28 (canon 0.30.558), Scribe-direct on the owner's pick. Nothing is committed, pushed or deployed.

## The ask
- [The C&T director]'s Teams message to the owner (Monday 10:41 PM), verbatim after the greeting: "here's my piece for the director dashboard. The zip has a route for gfLite that serves my seven KPIs live from Field Ops, a reference panel you can restyle, the feed spec, and two weeks of real data to build against. It shows exactly what the register records each morning and recalculates nothing, so your dashboard and the board reports always match. I'll send you the access token separately."
- The zip, read as data: `README.md` (the feed spec, 6,670 bytes), `gflite-route.js` (3,150), `kpi-panel.html` (10,327) and `feed-sample.json` (152,663, fourteen real days). The sample carries real partner names and dollars, so it stayed in the Scribe's scratch: it is in no repo file, fixture, test or report. The route and the panel were not copied; the wall is the app's own code in the app's shape.
- The owner's picks on the question tool, verbatim:
  - "Lift it; you build it now (Recommended)" (the DD pause lifted for this wall);
  - "[the C&T director]'s register, all seven (Recommended)" (the register is the source for all seven C&T KPIs; gfLite's own computes leave the C&T wall, and their reports stay);
  - "Port it into the app (Recommended)" (the C&T wall, three themes, EN and ES, behind the Admin PIN, one named feed reader, no personal name in code);
  - "Fetch live on each view" (no migration, no stored copy).

## Trees
- Received: the live tree `d207a7c0f98d13d6` (main 1ddeca3, MT1 live).
- Left: `0dc10dd8baba39fa` (440 files, 122 migrations). Against the received tree it touches seven files and nothing else:
  - `src/ctregister.ts` and `test/ctregister.test.ts` (new);
  - `src/index.ts`, `src/director.ts`, `src/i18n.ts`, `src/theme.ts`, `scripts/smoke.mjs`.
- The other 433 files are byte for byte the worktree's (`083fa4643ceb184a` on both sides). `public/`, `vendor/`, `package.json`, `package-lock.json`, `wrangler.toml` and `tsconfig.json` are untouched. No migration.

## What changed
1. **The reader** (`src/ctregister.ts`, `readCtRegister`, the one place Field Ops is read):
   - `GET https://grip-field-ops.pages.dev/api/kpi/feed?days=30` with `Authorization: Bearer` and the worker secret `KPI_FEED_TOKEN`, server side, on each view of the wall;
   - 10 seconds, then it gives up; a redirect is never followed;
   - `KPI_FEED_BASE` is honored only for `http://127.0.0.1` or `http://localhost` (the smoke's stub), so the token goes to Field Ops or this machine and nowhere else;
   - the token is never logged, stored, shown or returned.
2. **The parse** (`parseCtFeed`): `ok` must be true and `rows` a list. A row of an unknown KPI or day is dropped; an unknown status reads as not live yet; numbers are kept only when finite; every text is capped and escaped where it prints.
3. **The wall** (`/admin/director/culttech`, behind the /admin PIN as before):
   - seven cards in the register's order, CT-R01 to CT-R07, each with:
     - its status word (Nominal, Watch, Action, Not live yet; Not recorded when the day lacks the KPI);
     - the headline as written, and the sources not read that morning;
     - the latest day's numbers with their labels as sent, the set on each card as the register's own panel has it;
     - a line of one number across the days;
     - the reasons folded under the notes line;
   - above the cards: the recorded day, the rule versions and the time of the live read;
   - **as sent:** held prints held, never 0; a missing value prints n/a; dollars on the four money keys; separators past a thousand; one decimal below. Nothing is recomputed or averaged;
   - **the line:** a held or missing day breaks it and is never bridged; a lone day is a dot; a window held every day says so in words;
   - **the refusals,** in words and with no card: no token, refused (Field Ops' status and its error), no answer in 10 seconds, unreachable, not the register's feed.
4. **The home** (`/admin/director`):
   - the C&T card reads "7 KPIs from the C&T register" and "Read live from Field Ops on the wall", with no counts;
   - the page says the C&T card is the exception;
   - there is no C&T check-in link.
   The other four cards and their check-ins stand. The culttech rows of the registry stay in the database, their reports stay, and the two bizops KPIs whose wall keys include culttech still show on the bizops wall.
5. **Words:** every new word goes through `t()` with a Spanish line, ASCII as the house is, with no dash characters. The feed's own headlines, reasons, labels and sources are data and print as sent.
6. **Theme:** `.ct-*` rules beside the DD tiles: the cards' grid, the status edge in each theme, the numbers' grid, the line, the notes.

## The acceptance
- **The suite:** 7 tests in `test/ctregister.test.ts`, on an invented feed:
  - the parse;
  - the base and the token (it never appears in a result);
  - the values;
  - the line;
  - the wall in English and Spanish, an escaped `<script>` headline included;
  - each refusal;
  - the home's card and sentence in both languages.
- **The smoke:**
  - before the stub walk, the wall without its token: 200, the no token words, no registry tile;
  - with the smoke's stub feed (2 days, 7 rows a day, one number held):
    - the wall reads `ok` with r01 to r07, the stub's headline, `1,234` and held;
    - no registry tile;
    - the home's card and sentence, and no C&T check-in;
    - the token is never in the body;
    - every read is `/api/kpi/feed?days=30`.
- **Layout:** the bench served the C&T director's own fourteen days from a local stub, bench only. The wall and the home were read in all nine views (Lite, Continuum and Grip at the phone, 820 and 1920), in English and in Spanish:
  - 0 px sideways everywhere, and 0 px at the phone with every notes fold open;
  - seven cards, none overflowing.
  The Grip theme's backdrop paths run past the edge inside their clipped layer, as on every page.

## Gates on the tree
- typecheck 0.
- vitest TZ=UTC: Test Files 127 passed (127); Tests 1751 passed, 6 skipped (1757).
- vitest TZ=America/New_York: the same.
- `node --check scripts/smoke.mjs`: 0.
- The from zero smoke: `About to apply 122 migration(s)`, SMOKE PASS, exit 0, no 500.
- The scans of the seven files: no dash, CR or non ASCII character, no personal name, and none of the sample's text or figures.

## Noted, not touched
The register's R03 notes flag gfLite data.
- **The 10,000 kg cap:**
  - lots 26118, 26119, 26148 and 26151 show only readings over the cap, so their silo pounds are left out;
  - all four went into the Arlington Dry Room while gfLite still held older lots there;
  - the owner's words on why fold into AR1 (canon 0.30.558).
- **The 30 loads:** they wait on the allocation sheet's last read (Oct 13). That sits on the register's side.

## The merge
No migration rides, so no snapshot. The block:
- THE RE-RUN CHECK first;
- the worktree commit on `0dc10dd8baba39fa`;
- canon committed on main;
- `git merge --no-ff GFLiteMetrcAPI`, with the message on the command line;
- the push, and the worktree fast forwarded.

## His hands after the deploy
When the C&T director sends the token, from the main folder's `app\`:

    npx wrangler secret put KPI_FEED_TOKEN --env grip

He pastes the value at wrangler's prompt, never in chat, canon, a report or a log. Until then the wall says the token is not set. The secret makes a new worker version; its ID is the one to paste.
