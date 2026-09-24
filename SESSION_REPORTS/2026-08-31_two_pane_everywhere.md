# Session report: the two-pane theme becomes law (slice 9, ADR-8), 2026-08-31

**Sitting:** cloud Scribe, build by a Scribe-directed code agent, verification by the Scribe.
**Canon:** folded at 0.9.0 (ADR-8). **Deploy: PENDING, worker only,** shared with the 0.8.2 slice (no migrations).

## The ruling (owner, 2026-08-31)

The two-pane theme ("left pane: available-in-queue, right pane: what's currently saved about that record and the ability to add more to it") extends to everything: "It will extend to everything" / "everything".

## What changed

- Wet lot ledger: GET /station/wet_weight?lot=<lotId> renders on the two-pane page: the filtered farm-grouped HBN Queue pane left (the lot's batch marked while the pane still shows it; a lot whose batch left the pane still renders, no row marked), the lot panel right (HBN - Farm heading, weights, reasoned pencil and x, Add a weight, total outside the pane, Finish lot). ?pick= header view and all POST targets unchanged.
- Trim Packages: leftPane over the Unloaded Queue replaces the dropdown; picked heading = the queue row label (short id, strain, dry total); hidden pick input; pick must be among pane rows.
- Cryo Weight: leftPane over the Cryo Queue; a pick renders only that package's row (saved fields plus the single cryo input); no pick keeps the bulk all-rows flow byte for byte; setCryoWeight untouched.
- Acquire HBN: untouched by law (ADR-8's standing exception: source station, no feeding queue).
- Files: src/pipeline.ts, src/html.ts, src/index.ts, src/i18n.ts (keys "Package", "Cryo weight (g)"), test/surface.test.ts, test/i18n.test.ts, scripts/smoke.mjs.

## Scribe verification (run by the Scribe)

- npx tsc --noEmit: clean.
- npx vitest run: Test Files 6 passed (6), Tests 151 passed (151).
- node --check scripts/smoke.mjs: passes.
- Full smoke run by the Scribe in the cloud sandbox: SMOKE PASS (fresh persist, migrations 0001-0010, the whole walk including the new wet-lot pane assertions, trim pane pick, cryo per-pick and bulk). The build agent's own run also passed.
- Byte-level em/en dash audit: 0 across all touched files and the canon fold.
- Device census before commit: every overwritten file sha-identical to the prior commit; canon and git head unmoved.

## Sealed final check

```
18499 src/pipeline.ts
58415bbec638335ab667f5ce4346c9dda41fc443b3f62cde1febe994b0a70202  src/pipeline.ts
31076 src/html.ts
0bb36630ef98e79530eba92dcebbc17eb818f388e34ad2f6be0e4e0aeb56b0bc  src/html.ts
21923 src/index.ts
ab903e94edd004ec3fdd03c9237a68b0798cf2f1df20b72c3a76a88ea57aa9ab  src/index.ts
5900 src/i18n.ts
6d4ec5f94c54bbbce4fa220fe61ef831a49b935b1be0e3307ce2b72e8157d892  src/i18n.ts
39243 test/surface.test.ts
52be25d0548179623f63c040cecbb4700509e4c6a1483288c9add6d9e2b944fe  test/surface.test.ts
8102 test/i18n.test.ts
f3281bbd12643f4b61d4c1c16ce76ae6c161d29256e3d1e08d50a9671e76ce78  test/i18n.test.ts
38518 scripts/smoke.mjs
49dc8da2a11183afbf381a4935ea4960d4e3b14d35cff54df299b75010bdd8b2  scripts/smoke.mjs
44103 /home/claude/canon/CANON.md
35a52e16f34fd12b78c64d4a52275fe3ca09a49225650f9e9452ae30c8e5212f  /home/claude/canon/CANON.md
3625 /home/claude/canon/_NOW.md
9c21b43c8d4e701e8ecab9774420c33e0de4a132ca1827b04933a5e844b4451c  /home/claude/canon/_NOW.md
10388 /home/claude/canon/MEMORY.md
d2898686f7e29ce636b1b981815810c7c5d3c018de9b59c41f4449b990fe2275  /home/claude/canon/MEMORY.md
```

### Tails (last 12 lines, authored files)

--- tail src/pipeline.ts
```
  return PIPELINE.filter((e) => e.surface === "home");
}

/** The ledger def owning a ledger table, from the registry; undefined for any
 * other table. The reasoned pencil and void use it to recompute the parent lot's
 * total column (owner rulings 2026-08-28 wet, 2026-08-31 dry). */
export function ledgerByTable(table: string): LedgerDef | undefined {
  const station = PIPELINE.find(
    (e): e is StationDef => e.kind === "station" && e.ledger?.table === table
  );
  return station?.ledger;
}
```

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
