# Session report: unload follows the two-pane theme (slice 8), 2026-08-31

**Sitting:** cloud Scribe, build by a Scribe-directed code agent, verification by the Scribe.
**Canon:** folded at 0.8.2. **Deploy: PENDING, worker only** (no migrations in this slice).

## The ruling (owner, 2026-08-31, verbatim)

"Unload dry space works, but I want to follow the theme of left pane: available-in-queue, right pane: what's currently saved about that record and the ability to add more to it."

## What changed

- The unload pick no longer leaves the two-pane page. GET /station/unload_dry_space?pick=<id> renders the Dry Space Queue pane on the left (picked group open, row marked) and the lot's record panel on the right: short id - strain heading, muted full HBN, From line, saved dry weights with the reasoned pencil and x, Add a weight, Dry total, Finish unload.
- ?lot=<id> survives as a compatibility alias that 302s to ?pick=<id> (the reverse of before). Unknown or voided lots 404; wrong-status lots bounce with the existing translated flash; a pick missing from the pane rows renders the landing state (wet precedent).
- Landing with no pick shows a muted prompt, new i18n key "Pick a lot from the pane." / "Elija un lote del panel."; every other pane station keeps the wet prompt byte for byte.
- Add-a-weight redirects land on ?pick=<id>&ok=weight for the dry ledger; wet keeps its ?lot= redirect byte-identically. Finish returns to the bare station with its ok flash (the lot left the queue).
- stationPage gained an optional trailing ledgerPanel parameter; unloadLotPage became unloadLotPanel (fragment, no h1). A direct station structurally cannot reach the header create form branch.
- Files: src/html.ts, src/index.ts, src/actions.ts, src/i18n.ts, test/surface.test.ts, test/i18n.test.ts, scripts/smoke.mjs.

## Scribe verification (run by the Scribe)

- npx tsc --noEmit: clean.
- npx vitest run: Test Files 6 passed (6), Tests 137 passed (137).
- node --check scripts/smoke.mjs: passes.
- **Full smoke executed in the cloud sandbox by the Scribe itself: SMOKE PASS** (all 10 migrations on a fresh persist, identity, PIN, trucks, two-pane unload walk, trim from unloaded, void return). Lane discovery: wrangler dev DOES run here with WRANGLER_SEND_METRICS=false and a fresh SMOKE_PORT; the process hangs on exit because the egress proxy blocks Cloudflare telemetry, so PASS is read from the log under a timeout and stray workerd processes are killed by exact name (pkill -x workerd; a pkill -f pattern can match your own shell and kill it).
- Builder's wet byte-identity harness: 46-case matrix, old vs new bundles cmp-identical for every wet surface; harness sensitivity proven against the intended unload diff.
- Byte-level em/en dash audit: 0 across all touched files and the canon fold.
- Device census before commit: content sha-identical to the prior commit on every file being overwritten (two files carried fresh mtimes with identical bytes, indexer touch); canon and git head unmoved.

## Sealed final check

```
27957 src/html.ts
5d773cf92b822d6313cac8ed7337b4f625a0ab9192cb565eb51e27e96ad30e7f  src/html.ts
20468 src/index.ts
9b4f36cb144d47e1b0518f87fbf3bd4a023a27bf3d17ed08d484704470380d76  src/index.ts
33882 src/actions.ts
7d65614644c19fc71a7870a34102ad247a71b1ef26ecf9057094e76093d8077e  src/actions.ts
5615 src/i18n.ts
d7219a2cac2065d616c1ed8b528acd8cee9595c05f43b66b644cac5c4e51b3bc  src/i18n.ts
29207 test/surface.test.ts
52cab5958a5b366c356666d55f7335dea41a1e2bb95678c28e30a14ad83cb7e0  test/surface.test.ts
7793 test/i18n.test.ts
69fb1fbba5c03a3a710dc40f34e5508be4a6f9b2b781cbe1047e308994c3bc40  test/i18n.test.ts
34622 scripts/smoke.mjs
7846cf2239f2803c14a53793bdc0c5e9fca3699386540088016fc15719e15499  scripts/smoke.mjs
42145 /home/claude/canon/CANON.md
34d2106028b340aa06cf34238d9e3419a75350e6506979c82f75251336d17bfb  /home/claude/canon/CANON.md
3151 /home/claude/canon/_NOW.md
e038ac08412ca0677bb436fe648371a5d7f54bb6c143c8f0a369b672dc9a1026  /home/claude/canon/_NOW.md
10205 /home/claude/canon/MEMORY.md
aa4ad8041bf0c1bef38c40ab5e983b2c60a664ad4c355090044e713c9868452e  /home/claude/canon/MEMORY.md
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

--- tail src/actions.ts
```
    ...logsForInsert(
      db,
      "package_types",
      code,
      { code, display_name: displayName, is_bud: isBud, created_at: ts, created_by: actor.id },
      actor.id,
      SYSTEM_REASON.create,
      ts
    ),
  ]);
  return { redirect: "/admin/lookups?ok=type" };
}
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
