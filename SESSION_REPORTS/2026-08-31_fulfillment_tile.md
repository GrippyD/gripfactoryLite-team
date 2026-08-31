# Session report: Fulfillment surface (slice 5), 2026-08-31

**Sitting:** cloud Scribe, build by a Scribe-directed code agent, verification by the Scribe.
**Canon:** folded at 0.7.1 with this slice. **Deploy: PENDING** (no new migrations; the worker upload now carries the public/ assets).

## The ruling

Owner, 2026-08-31: add a [Fulfillment] button to the home page, PIN gated like Admin and Interco, landing on the SalesHelper node; we host our own copy.

## What changed

- app/wrangler.toml: [assets] block (directory public, binding ASSETS, run_worker_first true, html_handling none) plus identical [env.grip.assets] and [env.c10.assets] blocks (env tables do not inherit the top-level block).
- app/worker-configuration.d.ts: regenerated via npx wrangler types; Env now carries ASSETS (Fetcher).
- app/src/index.ts: pinGate applied to /fulfillment and /fulfillment/*; GET /fulfillment 302-redirects to /fulfillment/ (the form fetches menu.json relative to its own URL); GET /fulfillment/ and GET /fulfillment/menu.json serve the vendored files through the ASSETS binding via a salesHelperAsset helper (explicit content-type, cache-control no-store, c.notFound() on a missing asset). /api/send stays unrouted: the form falls back to CSV/JSON download plus mailto by design.
- app/src/html.ts: fulfillmentTile after intercoTile on the home page (tile-kind Admin, tile-title through i18n, data-pipeline-key fulfillment).
- app/src/i18n.ts: "Fulfillment" { en Fulfillment, es Despacho }.
- app/test/surface.test.ts, i18n.test.ts, identity.test.ts: tile presence, ordering, both locales, key completeness, safeNextPath("/fulfillment/"). 92 tests total.
- app/scripts/smoke.mjs: gate 401 on /fulfillment before unlock; after unlock 302 to /fulfillment/, the form title served with no-store, menu.json served as JSON containing builtAt. (Runs on Dennis's machine only.)
- app/public/saleshelper/index.html and menu.json: the SalesHelper node vendored VERBATIM from the SalesHelper repo (its v0.7.3 build and the 2026-08-11 menu). Vendored-pair law: never edit in place, only replace by copy.
- canon/CANON.md 0.7.1, canon/_NOW.md, canon/MEMORY.md: the fold.

## Notes for the record

- wrangler dry-run prints "Read 3 files from the assets directory" while the directory holds exactly 2 files (census verified twice); the count includes wrangler's own manifest handling, not a stray file.
- worker-configuration.d.ts contains dashes inside wrangler-generated vendor doc comments; it is a generated file, exempt from the G-8 audit like the vendored saleshelper pair. Regenerate with npx wrangler types, never hand-edit.
- The vendored form posts orders to /api/send with a baked key; on our origin that 404s and the form falls back cleanly (downloads ride first in its code path regardless). Parked in canon open items with the menu refresh lane.

## Scribe verification (run by the Scribe, not the agent)

- npx tsc --noEmit: clean, exit 0.
- npx vitest run: Test Files 6 passed (6), Tests 92 passed (92).
- npx wrangler deploy --dry-run --outdir /tmp/gf-dry-grip --env grip: "--dry-run: exiting now." with bindings env.DB (gripfactory-lite-grip) D1, env.ASSETS Assets, env.THEME "grip". Total Upload: 174.19 KiB / gzip: 40.11 KiB.
- Em/en dash audit (byte-level, LC_ALL=C): 0 matches in all eight authored files, and in the three canon files (checked below).

## Sealed final check

```
1708 wrangler.toml
d3a04910b2e0915e5d92e4ebb62b5bf66e6cc3f234fab38d116ddd693424a255  wrangler.toml
16811 src/index.ts
9f20f76821687ef60fce9e2b8a34a6d7e65c3f74703618c928fde24ea8ebf821  src/index.ts
23141 src/html.ts
61a9b0ed4b974dbb6462cd5cd08591a9369821692157518712e4e2810a510474  src/html.ts
4450 src/i18n.ts
2d05d4912a321af4eab0c6d66ae1a4436dfc05a99f27b2505b173d5e5acbf670  src/i18n.ts
15339 test/surface.test.ts
e17fc86f7ded1fe86a15b0968950ab227cfea1201abc62516eeeda6d22eccbe4  test/surface.test.ts
5729 test/i18n.test.ts
71031e0be77652e9ddac81e4bb4bdab36518a30a0225353965edb96681d6cc96  test/i18n.test.ts
4043 test/identity.test.ts
36729da69ee0a5ab816dc99c99620c40f20c6b910dda2a9a79604c802c1ddeb2  test/identity.test.ts
23035 scripts/smoke.mjs
66d99c9caa25306090fc525bade7d82dee4fdcb7201681688707513c728774e1  scripts/smoke.mjs
583824 worker-configuration.d.ts
866f761edff18f0e29ac8dc3690c28272c860e27907ba22758804599c7777288  worker-configuration.d.ts
651831 public/saleshelper/index.html
f666e4eebde5efd1473fedd855397dd8afa15ed5d2033d780e033b30ac94b242  public/saleshelper/index.html
607296 public/saleshelper/menu.json
7f43fd9a7732ebb7869e2330a95939d6e630766c773de23e663328d7e8f33a14  public/saleshelper/menu.json
33324 /home/claude/canon/CANON.md
f92d5314d2cb871404f05f9e906e746b6c1f5b2ce75d0b155dc4673582f86010  /home/claude/canon/CANON.md
2613 /home/claude/canon/_NOW.md
7adf1630a41e0c43a0637b8bf39e44416cb853d04f72f3c0d296e608bd2ea998  /home/claude/canon/_NOW.md
7907 /home/claude/canon/MEMORY.md
69405e3d2d2df792b973e4d596e552c32e1b34ef5a6a473f142bf48d3ca65008  /home/claude/canon/MEMORY.md
```

### Canon dash audit
```
/home/claude/canon/CANON.md: 0
/home/claude/canon/_NOW.md: 0
/home/claude/canon/MEMORY.md: 0
```

### Tails (last 15 lines, authored app files)

--- tail wrangler.toml
```

[env.c10.vars]
THEME = "c10"

[env.c10.assets]
directory = "public"
binding = "ASSETS"
run_worker_first = true
html_handling = "none"

[[env.c10.d1_databases]]
binding = "DB"
database_name = "gripfactory-lite-c10"
database_id = "TBD-c10-d1-id"
migrations_dir = "migrations"
```

--- tail src/index.ts
```
): Promise<Record<string, Awaited<ReturnType<typeof listQueueRows>>>> {
  const keys = new Set<string>();
  for (const field of station.fields) {
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

--- tail src/html.ts
```
function groupRows(rows: QueueRow[], groupBy?: string): Array<[string, QueueRow[]]> {
  if (!groupBy) return [["", rows]];
  const map = new Map<string, QueueRow[]>();
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

--- tail src/i18n.ts
```
  // Interco Logistics stub (owner ruling 2026-08-28)
  "Orange barreled. Not built yet.": {
    en: "Orange barreled. Not built yet.",
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

--- tail test/surface.test.ts
```
    expect(html).toContain('action="/station/wet_weight/lot/lot1/finish"');
    expect(html).toContain('href="/record/wet_weights/w1/edit"');
    expect(html).toContain('href="/record/wet_weights/w1/void"');
    expect(html).toContain('href="/record/wet_weights/w2/edit"');
    expect(html).toContain("Total: <strong>1234.56</strong> g");
    expect(html.indexOf("1234.56")).toBeGreaterThan(html.indexOf("</section>"));
    expect(html.indexOf("234.5")).toBeLessThan(html.indexOf("1000.06"));
  });

  it("says no weights yet on an empty lot", () => {
    const html = lotPage(stationByKey("wet_weight")!, lot, [], "Arlington", 0);
    expect(html).toContain("No weights yet.");
    expect(html).toContain("Total: <strong>0.00</strong> g");
  });
});
```

--- tail test/i18n.test.ts
```
    const html = stationPage(
      stationByKey("wet_weight")!,
      people,
      "p1",
      {},
      { hbn_queue: rows },
      queuesByKey,
      undefined,
      undefined,
      undefined,
      "es"
    );
    expect(html).toContain("Elija de la izquierda para comenzar.");
  });
});
```

--- tail test/identity.test.ts
```
    const html = stationPage(
      stationByKey("wet_weight")!,
      people,
      "p1",
      {},
      { hbn_queue: rows },
      queuesByKey,
      "hb1",
      ledgerCtx
    );
    expect(html).toContain('<select name="lead_person_id" required>');
    expect(html).toContain('<option value="p1" selected>Pat</option>');
    expect(html).not.toContain('name="person_id"');
  });
});
```

--- tail scripts/smoke.mjs
```

    const csv = await text("/export/record_change_log.csv");
    assert(csv.res.status === 200, "change log csv");
    assert(/smoke reasoned edit/.test(csv.body), "csv missing reasoned edit");

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

## Deploy (local Scribe, 2026-08-31, on Dennis's word "deploy")

```
npx tsc --noEmit          TSC_EXIT=0
npm test                  Test Files 6 passed (6) / Tests 92 passed (92)
npm run smoke             SMOKE PASS (migrations 0001-0008 clean on fresh persist)
npx wrangler d1 migrations apply gripfactory-lite-grip --env grip --remote
  -> No migrations to apply! (expected: this slice ships no migration)
npm run deploy:grip
  -> Uploaded /saleshelper/menu.json and /saleshelper/index.html (2 of 2 assets)
  -> Bindings: DB (D1), ASSETS (Assets), THEME grip
  -> https://gripfactory-lite-grip.gflite.workers.dev
  -> Current Version ID: dcb4791c-a27a-4511-8c5e-def27e100b29
Unauthenticated browser check: /fulfillment/ lands on the gflite.cloudflareaccess.com
sign-in page; the Access wall fronts the new surface.
```

Dennis's authenticated visual check owed: Fulfillment tile, PIN gate, order form with menu and data-age badge. Folded at canon 0.7.2; the cloud sitting's slice was uncommitted and is committed as-deployed with this fold.

## Sealed final check for the deploy fold (bytes, sha256 first 16)

```
34150   122dea61a0f9aa83  canon/CANON.md
2121    94e0083136f677ba  canon/_NOW.md
7847    36798951440b3739  canon/MEMORY.md
1708    d3a04910b2e0915e  app/wrangler.toml
16811   9f20f76821687ef6  app/src/index.ts
23035   66d99c9caa253060  app/scripts/smoke.mjs
```
