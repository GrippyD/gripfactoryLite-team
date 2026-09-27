# BRIEF O: THE PREPACK AVAILABLE PANE READS ONE LIST (canon 0.30.238)

For the build session (Claude Code or Cursor) in `app/`, under THE DISPATCH RULE (canon 0.30.155). A small slice in its own sitting, so its report and gate stand alone. Canon wins over this brief where they differ; read `canon/_NOW.md` first. No migration; the head stays 0075. Commit nothing, push nothing, deploy nothing.

## The ruling (owner, 2026-09-25, verbatim, on a screenshot of the Prepack scheduling page)

"1. yesish: (pic1) move the text in line with the arrow.  Everything will be from METRC in the future, this is pointless addition.  The HBN that is associated with it will say how it was grown, all but one of the METRC lots are "ID" in their 11th and 12th characters.  ID is indoor, OD is outdoor, GH is greenhouse."

The screenshot shows the Available pane with a lone fold triangle on its own line above `OUTDOOR 4`, and beneath the headings the `FROM METRC` section holding the five strangers (tags ending 1994, 1995, 1997, 1998 and 2000).

## What the Scribe read in the code

1. THE TRIANGLE. `queueFold(key, summary, body)` in `src/html.ts` draws `<details class="queue-fold"><summary>...</summary>`. `src/theme.ts` line 120 reads `.queue-fold > summary h2 { display: inline; }`, so a Data Queues heading (an `h2`) sits on the marker's line. Brief N's grow headings in `availableByMethod` (`src/scheduling.ts`) are `h3`, which the rule does not reach: the `h3` stays a block and drops below the marker. The prepack headings are the only `h3` inside a fold summary today.
2. THE SECTION. `adoptSection` in `src/scheduling.ts` draws `<section data-schedule-adopt>` under the headings with its own `<h3>From METRC</h3>`, its own list (`data-schedule-list="adopt"`), `Nothing to adopt.` when empty, and on each row's HBN line the word `known` (the HBN is an app batch) or `new from METRC`. Its rows come from `listMetrcAdoptions` (`src/metrc.ts`): passed WPR in grams in the mirror that no wip package or live ledger item bears, each with `harvest` (the HBN its lineage names, THE HBN INHERITED, canon 0.30.196) and `hbnId` (the app's batch for it, or null). Its `>>` posts the tag to the Available pane's schedule form and `adoptFromMetrc` (`src/actions.ts`) adopts and schedules in one press (canon 0.30.200).
3. THE GROW CODE. `adoptFromMetrc` mints a batch for a harvest the app does not know through `hbnFromMetrcName` (`src/mint.ts`, over `parseHbn`), whose `grow_code` is the HBN's third part, its 11th and 12th characters in the owner's words (46254-PNN-ID-005-1-NA-26004 reads ID), and writes `grow_method_code` as the live `grow_methods` row whose `hbn_code` matches (ID Indoor, OD Outdoor, GH Greenhouse, migration 0002). So an adopted package already lands under the heading its HBN names.

## The law to build

1. THE TRIANGLE AND THE TEXT ON ONE LINE. The fold summary's heading sits inline with the marker whether it is an `h2` or an `h3` (extend the `theme.ts` rule to `h3`; no markup change to `queueFold`, no change to Data Queues). The count badge stays on the same line.

2. FROM METRC RETIRES. No `data-schedule-adopt` section, no `From METRC` heading, no `Nothing to adopt.` line, and no `known` or `new from METRC` on any row: a stranger's HBN line reads the HBN alone, like an app row's. A stranger whose lineage names no harvest keeps its muted `no harvest in METRC's lineage` line and still carries no `>>`.

3. THE STRANGERS FILE UNDER THE GROW HEADINGS. Each stranger row goes into Available under one of brief N's headings: the grow method of its batch when `hbnId` names one (the display name, as the app's rows read it); otherwise the method whose live `hbn_code` matches the `grow_code` that `parseHbn` reads from its HBN, the same match `adoptFromMetrc` writes when it mints, so a package keeps its heading when it is adopted; `Unknown` when there is no harvest, the harvest is not a seven-part HBN, or no live method carries the code. A heading that only strangers fill is drawn like any other (its order, its fold key `grow:<name>`, its remembered fold).

4. ONE LIST. Within a heading the app's rows come first in today's order, then the strangers by tag (today's adopt order). Every row is a `.schedule-item` with `data-schedule-tag` and `data-schedule-hbn`, so the heading's count, the pane's `Available` count and `FILTER_SCRIPT`'s counts and hiding take the strangers in with no new script; a stranger row also keeps `data-adopt-tag` so tests can tell it apart. The stranger's `>>` is unchanged (it posts its tag to the pane's schedule form, titled `Adopt and schedule`, and `adoptFromMetrc` answers as today); the app row's `>>` is unchanged. The Scheduled and Complete panes, the effective date form and the filter box do not change.

5. THE WORDS. Retire from `src/i18n.ts` only the strings no surface uses once the section is gone (`From METRC`, `Nothing to adopt.`, `known`, `new from METRC` as the build finds them unused); any new string with Spanish.

6. THE TESTS. `test/scheduling.test.ts` (or a new `test/prepackonelist.test.ts`): fixtures with app packages under Indoor and Outdoor HBNs and strangers whose HBNs read ID, OD and GH, one on a known Outdoor HBN, one with no harvest and one with a harvest `parseHbn` refuses: the strangers render inside the Indoor, Outdoor and Greenhouse headings after the app rows, the known one under its batch's method, the last two under `Unknown` (the no-harvest row without `>>`); a heading filled only by strangers draws; the heading and pane counts include the strangers; the `q` filter hides a stranger by its last six and hides a heading when every row in it is hidden; no `data-schedule-adopt`, `From METRC`, `known` or `new from METRC` in the markup; the stranger's `>>` names the tag and the pane's form. The served stylesheet carries the inline rule for an `h3` inside a fold summary. `scripts/smoke.mjs`: the prepack page shows the fixture stranger under its grow heading with the heading count including it, its `>>` adopts and schedules as today, and no From METRC section is served.

7. NOTHING ELSE MOVES. `adoptFromMetrc` and its refusals; which packages `listMetrcAdoptions` lists (it may carry the grow method, nothing else changes); `PREPACK_PARENT_SQL` and who stands in Available; the mirror laws; the three lines and THE UNFINISH; the drying surfaces; the Data Queues folds; the migrations, `wrangler.toml`, `package.json`, `scripts/repairs/` and `src/vendor/`.

## Not in this brief

Why METRC lists more passed WPR than the page shows is data, not code: the ten passed WPR the page misses are cryo outputs the app knows whose ledger items were purged on the old FFZ inventory page; their restore is a repair the owner rules on in the repair lane (canon 0.30.238), not a build.

## Files

- `src/theme.ts`, `src/scheduling.ts` (`availableByMethod`, `adoptSection` retired or folded in, `prepackSchedulingPage`), `src/metrc.ts` (`MetrcAdoptRow`, `listMetrcAdoptions`, if the grow method rides there), `src/i18n.ts`, `test/scheduling.test.ts` (or `test/prepackonelist.test.ts`), `scripts/smoke.mjs`.

## Gates and the hand-back

The usual: tsc 0; vitest both zones; node --check; the from-zero smoke at pin 75 with `SMOKE PASS` and no 500; dash audit 0; no key or secret in any file; no personnel data. Report `SESSION_REPORTS/2026-09-25_prepack_one_list.md` with the sealed final check and the assumptions for the owner's word (among them: app rows before strangers within a heading; `known` retired with `new from METRC`; `Unknown` for a stranger whose HBN does not read). Do not deploy; the Scribe hands the worker-only deploy line.
