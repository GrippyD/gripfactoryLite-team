# Session report: record-borne trucks (slice 6), 2026-08-31

**Sitting:** cloud Scribe, build by a Scribe-directed code agent, merge and verification by the Scribe.
**Canon:** folded at 0.7.4 (on top of the local sitting's 0.7.3). **Deploy: PENDING** (migration 0009 + worker).

## The ruling

Owner, 2026-08-31: "Trucks should only live in the record itself... It starts at 0 trucks each HBN. Each click of add truck adds a Truck #." Picker: retire the break-in catalog trucks now.

## What changed

- migrations/0009_record_borne_trucks.sql: soft-retires the break-in Truck N dry_spaces rows; seeds the standing sentinel 'Truck' row (a1000001-0000-4000-8000-000000000009, kind truck, shared) that backs the NOT NULL dry_space_id for truck lots.
- src/config.ts: TRUCK_DRY_SPACE_ID, TRUCK_PICK_RE (^truck-([1-9][0-9]{0,2})$), truckNumberFromPick; nextTruckNumber reworked to pure max+1 over one batch's numbers.
- src/db.ts: listBatchTruckNumbers (distinct non-voided truck_number per batch, numeric order); filterDrySpaces drops kind truck from standing options (the bare sentinel never renders); wet queue rows gain computed truck_label ('Truck N - HBN', legacy rows keep their old names); getLot carries truck_number.
- src/actions.ts: createWetWeight accepts a real dry_spaces id or truck-<n> (sentinel id + truck_number bound and audited); raw sentinel pick refused; addTruck rewritten as a stage-only redirect (no database write; the number becomes real when Start lot writes the record); voidRecord and editRecord refuse the sentinel; finishLot untouched (sentinel kind truck routes to in_transit).
- src/index.ts: ledger branch derives truckOptions per picked batch only where farm law allows kind truck; ?truck=<n> staged gate (must pass the encoding law and exceed the derived numbers).
- src/html.ts: moveToField renders standing options, the batch's truck-<n> options, and the staged option preselected; Add a truck button unchanged in place, now farm-law gated; lotPage labels truck lots 'Truck N'.
- src/pipeline.ts: inbound_queue column, optionFields, and groupBy move from dry_space_name to truck_label.
- src/i18n.ts: "Truck" en/es (Camión, matching the file's accent usage).
- Tests: nextTruckNumber law, encoding accept/reject, truck option render, staged preselect, farm-law hiding, inbound truck_label, lot page labeling. 110 total.
- scripts/smoke.mjs: full truck walk (stage, start with truck-1, finish to Inbound with 'Truck 1 - HBN' grouping, second batch isolation) plus the merged void-return walk.

## Concurrency note (the merge)

The local Scribe sitting deployed the Fulfillment slice (0.7.2, worker dcb4791c) and the void return law (0.7.3, worker 76e714ec) while this slice was building. Its delta (commit 8b7d91b: backRedirect in audit.ts, voidRecord redirect, void GET referer carry, voidPage back field, audit tests, smoke walk) was pulled from git and merged into this workspace by hand; pages.ts, audit.ts, and test/audit.test.ts were taken wholesale from the repo. Canon 0.7.4 was refolded on the fresh 0.7.3, discarding the cloud sitting's local 0.7.1 copies.

## Scribe verification (run by the Scribe on the merged tree)

- npx tsc --noEmit: clean.
- npx vitest run: Test Files 6 passed (6), Tests 110 passed (110).
- Offline migration proof: fresh persist dir, 0001 through 0009 all apply clean.
- node --check scripts/smoke.mjs: passes.
- Byte-level em/en dash audit: 0 across all touched and merged files.

## Sealed final check

```
971 migrations/0009_record_borne_trucks.sql
f041c99f9cc0a34c666fe41798504e7e8e896110ac03c53e8cb220df6b5756a9  migrations/0009_record_borne_trucks.sql
5921 src/config.ts
93d1ea441f7719c282c321e6a84920c3a9a334bef57b7820cccfbd3041596474  src/config.ts
31689 src/actions.ts
0d3671af0738fabd5ef05c4f2dd96b1bab9134ff68f53db03d0b132639a519ad  src/actions.ts
17959 src/db.ts
07a6382ca9ce1238ca280e0e7979e544ddf172b752ac624a52cfca428f27ea84  src/db.ts
13016 src/pipeline.ts
cdb10c01a06c2af13fe1c0011ad14018b04c39cfeaa9edddddf30588ed8c8556  src/pipeline.ts
24743 src/html.ts
47c7c21f238856d2e51cd74a6781de12878817cad236784c265689f414993d8a  src/html.ts
18073 src/index.ts
4552c466996eb74a2d944d1c7c5224f8294cf6ff593baff3e07246c13d02fae7  src/index.ts
4569 src/i18n.ts
92d14b14876bbccc6de4c9a40e5cd214450328ed994aff7d86bd8babd8af6f85  src/i18n.ts
7885 test/routing.test.ts
74fb1797593dc939931c2288e05088774b31d5451bbd44df5a0830a70b993484  test/routing.test.ts
18650 test/surface.test.ts
b1fad6abea084c932fc6a6883e6aee37fa5745322679587fc7984d0eb56988f1  test/surface.test.ts
6132 test/i18n.test.ts
96a26743438f4a521f6e2ae6e05bf51b59571e2f30e402174b9981fd9eff9cdc  test/i18n.test.ts
28137 scripts/smoke.mjs
adf5427f898efdc2ff1ed37c24e9416966866650615435d087074666c8ca62eb  scripts/smoke.mjs
37047 /home/claude/canon/CANON.md
f2b32bdae45dafc83e0338717deea1047c867212ee86427a1aa6e2bd924992d5  /home/claude/canon/CANON.md
2949 /home/claude/canon/_NOW.md
9c3683516150315d110e5089046e25f1791c23125d2429009459b476b9558094  /home/claude/canon/_NOW.md
8640 /home/claude/canon/MEMORY.md
8f879e98a720514e284fc37198de55ad4c9e896fcefba84ec280ff06ed7fcfe0  /home/claude/canon/MEMORY.md
```

### Tails (last 12 lines, authored files)

--- tail migrations/0009_record_borne_trucks.sql
```
-- per-HBN number, the truck list starts at zero for every HBN, and Add a truck
-- stages the next number for that HBN only. A single standing sentinel row backs
-- the NOT NULL dry_space_id for truck lots; the break-in Truck N catalog rows
-- retire here by soft delete. LIKE 'Truck %' cannot match the sentinel name
-- 'Truck' (no trailing space), so the order is safe either way; retire first anyway.

UPDATE dry_spaces SET deleted_at = '2026-08-31T00:00:00.000Z' WHERE name LIKE 'Truck %' AND deleted_at IS NULL;

INSERT OR IGNORE INTO dry_spaces (
  id, name, kind, farm_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('a1000001-0000-4000-8000-000000000009', 'Truck', 'truck', NULL, '2026-08-31T00:00:00.000Z', NULL, '2026-08-31T00:00:00.000Z', NULL, NULL, NULL);
```

--- tail src/config.ts
```
export function nextTruckNumber(taken: ReadonlyArray<string | number>): number {
  let max = 0;
  for (const value of taken) {
    const n = Number(value);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}

export function isTestOutcome(value: string): value is TestOutcome {
  return (TEST_OUTCOMES as readonly string[]).includes(value);
}
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

--- tail src/db.ts
```
        record_id: id,
        field,
        old_value: null,
        new_value: String(value),
        actor_person_id: actorId,
        reason,
        changed_at: changedAt,
      })
    );
  }
  return stmts;
}
```

--- tail src/pipeline.ts
```

export function queueByKey(key: string): QueueDef | undefined {
  return PIPELINE.find((e) => e.kind === "queue" && e.key === key) as QueueDef | undefined;
}

export function queues(): QueueDef[] {
  return PIPELINE.filter((e): e is QueueDef => e.kind === "queue");
}

export function homeEntries(): PipelineEntry[] {
  return PIPELINE.filter((e) => e.surface === "home");
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
