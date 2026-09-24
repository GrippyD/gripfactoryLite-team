# Session report: Unload Dry Space station (slice 7), 2026-08-31

**Sitting:** cloud Scribe, build by a Scribe-directed code agent, verification by the Scribe.
**Canon:** folded at 0.8.0. **Deploy: PENDING** and shared with slice 6 (migrations 0009 + 0010 + worker, one deploy).

## The ruling (owner, 2026-08-31, two messages plus the talk-through picker)

"Need an [Unload Dry Space] button. Left pane: dry space queue, right pane is essentially the same as wet weights, but these are dry weights, different container sizes. Will always refer to the last 5 digits of the HBN/Last 6 of the Harvest tag. That's what will go on travelers." Talk-through: container sizes were context only (dry rows are plain weights, count independent of wet rows); Finish unload moves the lot into the new Unloaded Queue which feeds Trim; the short id pair plus strain and weight is inherited by the Unloaded Queue and all queues after it. Traveler printing and METRC Package ID modeling are owner-parked, in his words, until the weights land where they need to be.

## What changed

- migrations/0010_unload_dry_space.sql: dry_weights table mirroring wet_weights (0006) with its two indexes; wet_weight_entries.dry_weight_grams (nullable live dry total; wet total untouched).
- src/config.ts: LOT_STATUS.unloaded; transitions lot_unloaded (drying to unloaded) and lot_trimmed_unloaded (unloaded to trimmed), lot_trimmed untouched as the Dry Space Queue manual exit; SYSTEM_REASON.finish_unload; shortLotId(hbn, tag), the identifier law.
- src/pipeline.ts: LedgerDef generalized (table, parentField, totalField, lotStatus, mode direct, finishTransition); unload_dry_space station (home, direct dry ledger over the Dry Space Queue pane); unloaded_queue (Lot short_id, Strain, Dry total, From, notes, created; Mark trimmed control); trim picks unloaded_queue; cryo and testing queues gained short_id and strain_name (hbn kept); EDITABLE_FIELDS.dry_weights.
- src/db.ts: SHORT_LOT_ID_SQL twin of shortLotId; wet and wip queue branches select short_id, strain_name (strains join), dry_weight_grams, metrc_harvest_tag; ledger helpers (listLotWeights, countLotWeights, lotTotalRecomputeStmt) take the LedgerDef; ALLOWED_TABLES gains dry_weights; getLot widened.
- src/actions.ts: addLotWeight and finishLot generalized over the station ledger (wet behavior byte-identical); dry finish requires one non-voided dry weight and applies lot_unloaded with reason "finish unload"; createTrimPackages gates on unloaded ("That lot is not in the Unloaded Queue."); runQueueControl mark_trimmed branches by status; dry_weights edit and void recompute dry_weight_grams.
- src/html.ts: lotPage refactored onto a shared weightsSection helper (wet output proven byte-identical); unloadLotPage: heading shortLotId - strain, full HBN muted beneath, From row, dry weights with reasoned pencil and x, Add a weight, Dry total outside the pane, Finish unload.
- src/index.ts: direct-mode pick 302s to the lot ledger page; status guard bounces with a translated flash; create POST and add_truck 404 on direct stations.
- src/i18n.ts: Unload Dry Space, Unloaded Queue, Finish unload, Dry weights, Dry total, From, and the bounce flash, en and es.
- Tests extended in kind across surface, routing, i18n: 132 total.
- scripts/smoke.mjs: full unload walk (pane pick, short id heading, two dry weights, reasoned edit, dry total, finish, Unloaded Queue count and row, CSV export, trim from unloaded, short_id inheritance on cryo and testing), truck and void walks intact.

## Scribe verification (run by the Scribe)

- npx tsc --noEmit: clean.
- npx vitest run: Test Files 6 passed (6), Tests 132 passed (132).
- Offline migration proof: fresh persist dir, 0001 through 0010 all apply clean.
- node --check scripts/smoke.mjs: passes.
- Byte-level em/en dash audit: 0 across all touched files and the canon fold.
- Device census before commit: every repo file carried the slice 6 commit's write window; canon and git head unmoved; no concurrent edits.

## Builder deviations accepted

Strain keeps its existing es translation (Variedad); wrong-status lots bounce with a flash instead of 404; shared weights-table strings stay untranslated to preserve wet byte-identity (admin-table translation is parked canon-wide); finish_unload is its own audit reason; add_truck 404s on direct stations.

## Sealed final check

```
1199 migrations/0010_unload_dry_space.sql
dfcaba4d0a4102da8e34125e74e0cdfc3fee31bd1c7ba644dbbc52e10d203708  migrations/0010_unload_dry_space.sql
7224 src/config.ts
55e81e71021edca43a3c17dce92661bb4d979fff517c8c7ae6abbeefbd06ec3e  src/config.ts
17098 src/pipeline.ts
f846da7b03eded45f6403af48d1ca3a7fbe8c18f5077ec2fd72e935261ab4a41  src/pipeline.ts
19548 src/db.ts
97eb3b8af23842323bd673c6cf388ebc5a786624becc4b9e195698334d93529a  src/db.ts
33652 src/actions.ts
09b86248ae8536cfa4a65bd8844918efe73b6e55a94e8c556c12fd248915d214  src/actions.ts
26623 src/html.ts
2fd92f13e3ace2ef8b1f8727b46aea45154b01e8d5ff6e2a94ac7e43e5960929  src/html.ts
19511 src/index.ts
0dfe892b98e1300dd042c652ab4a89341935d2d0c8cbc00548205fc8ea7c304b  src/index.ts
5350 src/i18n.ts
4f93d2a5d8d3ff52ff58a4d4a560d380f713450173078d058cb51cca7e986db6  src/i18n.ts
25267 test/surface.test.ts
b9124bb83a23a98588a4a3669f5d652517ca8cf659c43386c6161dcd4076ebf2  test/surface.test.ts
10831 test/routing.test.ts
1169277434883b2e67cf74ad73a3f835687f7544c5c2917413b396b3cdd98f51  test/routing.test.ts
7550 test/i18n.test.ts
67d4ea2a91327e3ba5ecb486c6519c6aa724a259a1ca4878c2afd7525ef25e35  test/i18n.test.ts
33431 scripts/smoke.mjs
eb7b65606cca28b40722ecc56b53dc0fda717f2f103ffc860d62c2f65e005a30  scripts/smoke.mjs
40156 /home/claude/canon/CANON.md
1b75119eb55f23e749196fea2f9e8339be95604f2efeb129cc07122b3bbbec30  /home/claude/canon/CANON.md
3191 /home/claude/canon/_NOW.md
7cf63c0d27e66e5d1d9c17f0744b1c92b1d5900faebf1fccc0b705c08d71485a  /home/claude/canon/_NOW.md
9454 /home/claude/canon/MEMORY.md
4f487e40fe9c9ad228f82e10be9671edb2dab4518d9d2cd8126d5ef8431c5bc1  /home/claude/canon/MEMORY.md
```

### Tails (last 12 lines, authored files)

--- tail migrations/0010_unload_dry_space.sql
```
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX dry_weights_entry ON dry_weights (wet_weight_entry_id);
CREATE INDEX dry_weights_created_at ON dry_weights (created_at);

-- Nullable: NULL until an unload begins, then the live total of the lot's
-- non-voided dry_weights rows, recomputed alongside every add, edit, and void.
ALTER TABLE wet_weight_entries ADD COLUMN dry_weight_grams NUMERIC;
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
