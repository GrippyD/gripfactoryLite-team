# Session report: Cerberus theme + Lite toggle (slice 14), 2026-09-01

**Sitting:** cloud Scribe, build by a Scribe-directed code agent, verification by the Scribe including a rendered visual pass.
**Canon:** folded at 0.12.0. **Deploy: PENDING, worker only.**

## The ruling (owner, 2026-09-01)

Cerberus goes live now as the default look, with "an easy way for me to switch back to 'lite' view". Motive on the record: "This is helping immensely but I need to 'wow' people for C10." Source of truth: prompts/CERBERUSTHEMEPROMPT.md.

## What changed

- theme.ts rebuilt: themeStylesheet(view) dispatches; the lite sheet is the prior stylesheet byte-preserved; the Cerberus sheet carries the prompt's verbatim token, typography, honeycomb, and bloom blocks (values byte-true; dash-bearing comments rewritten per G-8) plus adapted component styling for every existing surface under the steel-and-gold discipline.
- View mechanism: gf_view cookie (default cerberus), POST /view mirroring the locale pill, a Cerberus/Lite pill in the chrome beside EN/ES.
- Boot scrawl: Cerberus only, once per browser session (sessionStorage guard in try/catch, storage failure skips), click skips, prefers-reduced-motion skips, page content never gated; repeat loads fire only the hex-wave sweep.
- Honeycomb background: three layers, fixed behind everything, reduced-motion aware. THEME env (grip/c10) plumbing untouched.
- i18n: Cerberus and Lite as proper nouns. New test file view.test.ts.

## Scribe verification

npx tsc --noEmit clean; vitest 213/213; node --check smoke; full smoke SMOKE PASS in the Scribe's hands; byte-level dash audit 0 on all touched files; **visual pass rendered by the Scribe** (headless chromium screenshots of the running worker): Cerberus home (steel, honeycomb, gold accents, caps headings, pill active states) and Lite home (prior look intact, toggle showing Lite) both correct.

## Sealed final check

```
37788 src/theme.ts
9b6d54157a6c231f2103c2f865fb1c15d16bedf1a661d55b32b84762ae544f80  src/theme.ts
10401 src/config.ts
6175eacbf14c4a0cff60b04baa4418c5de79c87f2d947faf82f4ab98b73dbf8f  src/config.ts
8635 src/i18n.ts
37c709a48236270f23aa3fa1be30ba56ef0aca64ebfffb55a41284fd138643c2  src/i18n.ts
39273 src/html.ts
b1dd4c2f3d1a3f294a1b77fb97d16f22058d4b23243cdd53986489c20aa3afb9  src/html.ts
27353 src/index.ts
305ba760fa40ef15ba264b6ea304e0b8ea4fb41fc6c1b27f2dfff871566a565e  src/index.ts
5324 test/view.test.ts
65b4f68109ffb723fba5fc00edfcb9895271d26776b4c16896711b63660c0c42  test/view.test.ts
56244 scripts/smoke.mjs
62fc5cf60e739bbbb1dd23fc6abb9af7a5588c91031d4c65f7a533882bbc60a3  scripts/smoke.mjs
53362 /home/claude/canon/CANON.md
e1f54c6e70b4801ed0412839b0a95f0eea20aede2a6a9327331f7c0d72ec491e  /home/claude/canon/CANON.md
3755 /home/claude/canon/_NOW.md
7ab98df9b722d7517fb06a26120b0d24ed92feb2f62b18f674be69b6837dcfad  /home/claude/canon/_NOW.md
12557 /home/claude/canon/MEMORY.md
3afa84c3383925306ce50839e22822abcb1d995b693936f8900a5c7b215dfdca  /home/claude/canon/MEMORY.md
```
