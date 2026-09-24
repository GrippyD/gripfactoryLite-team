# Session report: [Inventory] stub tile (slice 10), 2026-08-31

**Sitting:** cloud Scribe, built directly by the Scribe under G-2, Scribe-verified.
**Canon:** folded at 0.9.2. **Deploy: PENDING, worker only,** shared with the 0.8.2 and 0.9.0 slices.

## The ruling (owner, 2026-08-31)

"New button: add [Inventory]". Picker: the destination is "A new node that I'm going to have to build"; PIN gated.

## What changed

- Home tile [Inventory] after Fulfillment, tile-stub styled (drops the stub styling when the node lands), i18n Inventory / Inventario.
- /inventory and /inventory/* join the ADR-7 PIN gate; GET /inventory renders the reserved stub page ("Reserved for the Inventory node. Not built yet.", EN/ES).
- The node itself is Dennis's future build; it vendors in like the SalesHelper form (public/ asset served worker-first) when it exists.
- Files: src/html.ts (tile + inventoryPage), src/index.ts (gate + route + import), src/i18n.ts (two keys), test/surface.test.ts, test/i18n.test.ts, scripts/smoke.mjs (gate 401 + unlocked stub).

## Scribe verification

- npx tsc --noEmit: clean.
- npx vitest run: Test Files 6 passed (6), Tests 153 passed (153).
- node --check scripts/smoke.mjs: passes.
- Full smoke run by the Scribe in the cloud sandbox: SMOKE PASS.
- Byte-level em/en dash audit: 0 across all touched files and the canon fold.

## Sealed final check

```
31892 src/html.ts
d27fdcd1332a3f079f4b2cad487cf30280029e49d9a0081de8072c9ac189c7c0  src/html.ts
22365 src/index.ts
fa987867125f662324930a79558383e56662f56e627630a71b4874bedd7cc044  src/index.ts
6217 src/i18n.ts
9444253722dd898196e07fb4c9264805c51236b308dbd4123fb50ca94928928f  src/i18n.ts
40170 test/surface.test.ts
01ac4275eaaaa9859b4245dffff98108b578deb9cd6fbe1f190e96a0c66a529a  test/surface.test.ts
8353 test/i18n.test.ts
639235d10119efd6a3ec24a462aa3f6cc2153fcda589f469489bbccd41190522  test/i18n.test.ts
39160 scripts/smoke.mjs
6d6b15a44f1c6297d2666127bb463fa436def85b9a8cbf331c31fcc5aecc178d  scripts/smoke.mjs
45866 /home/claude/canon/CANON.md
53a77612ca68e251001c30e162051ff0d5ba423f95b5dc7332f1d0dcd9651b7b  /home/claude/canon/CANON.md
3763 /home/claude/canon/_NOW.md
0b26b31c172eb44e58d7e8633ba682d70755691c8e8553866a2da7a89bae96a5  /home/claude/canon/_NOW.md
10758 /home/claude/canon/MEMORY.md
1f8282f5ecdecd4bc67f45a47a865e86c9ca3f344b3467437a4ab9140469c235  /home/claude/canon/MEMORY.md
```

### Tails (last 12 lines, authored files)

--- tail src/html.ts
```
  for (const row of rows) {
    const key = row.values[groupBy] || "(none)";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()];
}

export function errorBody(message: string): string {
  return `<h1>Could not save</h1><div class="banner err">${esc(message)}</div><p><a href="javascript:history.back()">Back</a></p>`;
}
```

--- tail src/index.ts
```
    if (field.input === "queue_pick" || field.input === "cryo_weights") keys.add(field.queue);
  }
  if (station.leftPane) keys.add(station.leftPane.queue);
  const out: Record<string, Awaited<ReturnType<typeof listQueueRows>>> = {};
  for (const key of keys) {
    const q = queueByKey(key);
    if (q) out[key] = await listQueueRows(db, q);
  }
  return out;
}

export default app;
```

--- tail src/i18n.ts
```
    es: "Con barriles naranjas. Aún no construido.",
  },
  // Fulfillment tile (owner ruling 2026-08-31): the hosted SalesHelper node.
  "Fulfillment": { en: "Fulfillment", es: "Despacho" },
};

/** Look a display string up by its English key; unknown keys render as-is. */
export function t(locale: Locale, key: string): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[locale] ?? entry.en;
}
```

--- tail scripts/smoke.mjs
```
    );

    process.stdout.write("SMOKE PASS\n");
  } finally {
    await stopWrangler(child);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```
