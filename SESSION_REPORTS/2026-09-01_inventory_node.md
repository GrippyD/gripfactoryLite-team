# Session report: Inventory node + Acquire HBN recall, 2026-09-01

**Sitting:** Scribe-issued builder prompt (canon v0.12.1), build and verification in this repo.
**Canon:** unread here (not edited). **Deploy: PENDING, worker only.** Say deploy when you want it live.

## The ruling (owner, 2026-09-01)

Be COMPREHENSIVE. The Inventory tile becomes the sheet at `/inventory` (mock at `canon/inventory-sheet-mock.png`). Acquire HBN keeps its plain mint form and gains a right pane of deployed HBNs with no weights, each with a recall control.

## What changed

- Replaced the Inventory stub with one GET `/inventory` sheet: four Admin-styled reserved buttons, WIP (collapsed) with Drying / In Production / In Testing, FG (expanded) from vendored `menu.json` via `ASSETS.fetch`. Tile lost `tile-stub`.
- Reserved pages (`/inventory/change-locations`, `/zoho-upload`, `/physical-audit`, `/location-audit`): title, "Reserved. Awaiting the owner's talk-through.", and the future data interface line. No invented workflows.
- Drying gauges from non-truck `dry_spaces` (silo = circle, hang = rectangle). Empty spaces say "empty". Lots stack short id, `Nd Nh` from `updated_at`, projected dry via `projected_dry_yield_pct` (seeded `22`). Collapsible wet and projected totals.
- In Production: waiting trim = unloaded `dry_weight_grams`; pasteurize = awaiting (no grams); extraction = non-bud `created` packages (PROVISIONAL); total dry = unloaded dry plus live (non-voided, non-released) packages.
- In Testing: cryo_queue = scheduled representative weight; testing_queue = in testing. Pareto from persisted `test_outcome` on released packages, grouped "(no lab recorded)". No labs lookup. No fabricated bars.
- FG: SalesHelper type codes PRE, BUD, MIX, SHA, MOB, NUG, TRI, WBP, VAPE, IPR as clickable bars; click expands name + stock. Missing/unparseable menu is "Zoho data unavailable". Data-age from `dataAsOf` / `builtAt` plus the 2026-08-11 static note.
- CSV: `/export/inventory.csv` (section, row, grams). Display grams through `formatGrams`; CSV raw. Pasteurization grams blank.
- Acquire HBN: right pane of open weightless batches, newest first. Recall soft-deletes with reason `recalled` (audited), prefills the form, serials never reuse (ADR-6). Inline `confirm()` if the mint form has user input.
- Migration `0013_inventory_node.sql`: seeds `projected_dry_yield_pct`. Outcomes already persist on `wip_packages`; no outcome column and no labs.
- Both view stylesheets carry `.inv-gauge`, `.inv-fg-bar`, `.recall-pane`, `.acquire-split`. i18n en + es for every new label.

## Scribe verification

- `npx tsc --noEmit`: clean.
- `npx vitest run`: Test Files 9 passed (9), Tests 245 passed (245).
- `node --check scripts/smoke.mjs`: passes.
- Migrations 0001 through 0013 apply clean on a fresh persist dir (`.inv-migrate-persist`).
- Full smoke (`SMOKE_PORT=8795`, `WRANGLER_SEND_METRICS=false`, `npm run smoke` from `app/`): **SMOKE PASS**. Walk asserts sheet totals against the walk's own numbers (wet drying 200.00, projected 44.00, waiting trim 751.00, extraction 20.50, total dry 921.50, scheduled 50.00, in testing 100.00), FG data-age line, four reserved pages 200 behind the PIN, both views on the empty sheet, recall of 26003 (void + prefill + log), remint 26004.
- Byte-level em/en dash audit: 0 on every touched authored file.
- Visual pass in the local browser against the smoke persist: Cerberus sheet (steel, honeycomb, gold gauges and FG bars, WIP collapsed / FG expanded by default), Lite sheet (prior cream look, same structure), Acquire HBN recall pane with 26004 and the curved-arrow button, Change Locations reserved page with both muted lines.

## Markers for the Scribe fold (verbatim)

- **OWNER RATIFICATION NEEDED:** `projected_dry_yield_pct` seed `22` (Scribe placeholder, canon L-4).
- **OWNER MAPPING NEEDED:** Waiting to be pasteurized; no pipeline stage; muted `awaiting pipeline stage`; CSV grams blank.
- **PROVISIONAL:** Waiting to be shipped for extraction = non-bud `wip_packages` (`package_types.is_bud = 0`) in status `created`.
- **FLAGGED FOR THE OWNER:** Recall soft-deletes with reason `recalled`; saving mints a **new** HBN; voided serial stays a gap (ADR-6).
- Time since start uses lot `updated_at` (status-flip approximation).
- Lab capture awaits the owner; pareto grouped as `(no lab recorded)`; no lab picker (owner-gated).
- FG menu is the 2026-08-11 static until the refresh lane exists.

This slice does not build METRC or Zoho CSVs. Each reserved button page names its future file. Nothing here makes those files harder later.

## Sealed final check

```
675 migrations/0013_inventory_node.sql
2347c771572e4708c791c1bca3c1446d52d93df761f408cd193dd106b9b2b17e  migrations/0013_inventory_node.sql
14752 src/inventory.ts
9c066ffcb52212d4130c3436d390c1cf5f9d89a0917b17ea5b65a66549dde67c  src/inventory.ts
11649 src/config.ts
32f0d2a386eba6ed6ae8d6aea3cc730e41f1c57d32cf5fda2b5a08d139dbb194  src/config.ts
31696 src/db.ts
7c66ecfe8d4d4b29774951d95ef442b21788d7bce94c04e0915406a86d37424b  src/db.ts
40629 src/actions.ts
26716a625ef3e87676bdfcb5ebac7f97d6da88cf9a83059125ca0934301c8496  src/actions.ts
52489 src/html.ts
639154d9086ca1b169e14600698d81fc71c2d0524da468a3649558bd19b51622  src/html.ts
13507 src/i18n.ts
0ae52ab1053f23a1ab1ed606be6853ae526a92922cdde91348dea898d5779a2f  src/i18n.ts
43025 src/theme.ts
43f9a65f527a7a6a39cce7ddc4715b56a0bbc21fdae8f9db1029a9399cb2426f  src/theme.ts
29417 src/index.ts
bb39afb12602d468dd47c64c0ae6aabb3e7f2a8f484eca57ecdfd0216c69cc0b  src/index.ts
14202 test/inventory.test.ts
330e2f4611cbdcc880e06f48b27dc60961c91bfc42b67a435db89e25a7a86d3f  test/inventory.test.ts
52194 test/surface.test.ts
72a8f8ee7fbd4ed219283971f42921c4f0641dc2f18b6c2c8092e12db11d25fd  test/surface.test.ts
12379 test/i18n.test.ts
09fa1b8fb4fe7bf2e509cfc71550d9b017630d60d25511c5fe81a6f4b32f0c7a  test/i18n.test.ts
15038 test/routing.test.ts
2d206c92e7cb872a49c8570915ea45ebb0bd3e5295700c828f06c5e56762177a  test/routing.test.ts
5768 test/view.test.ts
3e9cf59d714e7b4cd26e787e3d39c6ad8c6d098bdd2d9cce6f9f23989bad4724  test/view.test.ts
67199 scripts/smoke.mjs
5ed22cd7dc3ccca34f7ea7ea6712ff132ded78c9b5cd5be2177dfe584f156339  scripts/smoke.mjs
56449 canon/CANON.md
cd41ac5e667001bc66a72430b2463455aaf0f9b0306edec7b64fdbb2daa15680  canon/CANON.md
4339 canon/_NOW.md
44267f0cde14eefe9073cbb9e7abb30538e3b060ead7d7218d8179db5ac56945  canon/_NOW.md
13001 canon/MEMORY.md
93ab0d66a34b4d478a323d2023438b3599240d6a56934b39b64c7f505d88b75d  canon/MEMORY.md
```

### Tails (last 8 lines, authored files)

--- tail migrations/0013_inventory_node.sql
```
-- Scribe's placeholder and needs the owner's ratification.
-- Release already persists test_outcome on wip_packages (0001 schema column,
-- written by runQueueControl). This file adds no outcome column and no labs
-- lookup; lab capture is owner-gated and must not change the release station.
INSERT INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('projected_dry_yield_pct', '22', '2026-09-01T00:00:00.000Z', NULL, '2026-09-01T00:00:00.000Z', NULL, NULL, NULL);
```

--- tail src/inventory.ts
```
  const params = new URLSearchParams();
  params.set("ok", "recalled");
  for (const name of RECALL_PREFILL_FIELDS) {
    const value = prefill[name];
    if (value != null && value !== "") params.set(name, value);
  }
  return `/station/acquire_hbn?${params.toString()}`;
}
```

--- tail src/config.ts
```
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}

export function isTestOutcome(value: string): value is TestOutcome {
  return (TEST_OUTCOMES as readonly string[]).includes(value);
}
```

--- tail src/db.ts
```
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
};

/** Look a display string up by its English key; unknown keys render as-is. */
export function t(locale: Locale, key: string): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[locale] ?? entry.en;
}
```

--- tail src/theme.ts
```
  at(4430,function(){ el.classList.add('boot-collapse'); });
  at(4630,function(){ el.classList.add('boot-line'); });
  at(4730,function(){ el.classList.add('boot-off'); });
  at(4830,function(){ el.classList.add('boot-out'); });
  at(4980,finish);
})();
</script>`;
}
```

--- tail src/index.ts
```
  for (const key of keys) {
    const q = queueByKey(key);
    if (q) out[key] = await listQueueRows(db, q);
  }
  return out;
}

export default app;
```

--- tail test/inventory.test.ts
```
      rows_text: null,
      metrc_harvest_tag: null,
      manicure: 0,
    });
    expect(prefill.silo_number).toBeUndefined();
    expect(prefill.manicure).toBe("0");
  });
});
```

--- tail test/surface.test.ts
```
      undefined,
      undefined,
      []
    );
    expect(html).toContain("No rows waiting.");
    expect(html).toContain("Cryo Queue is empty.");
  });
});
```

--- tail test/i18n.test.ts
```
      undefined,
      undefined,
      undefined,
      "es"
    );
    expect(html).toContain("Elija de la izquierda para comenzar.");
  });
});
```

--- tail test/routing.test.ts
```
    expect(truckNumberFromPick("xtruck-1")).toBeNull();
  });

  it("rejects the bare sentinel id and real dry space ids", () => {
    expect(truckNumberFromPick(TRUCK_DRY_SPACE_ID)).toBeNull();
    expect(truckNumberFromPick("a1000001-0001-4000-8000-000000000001")).toBeNull();
  });
});
```

--- tail test/view.test.ts
```
      expect(sheet).toContain(".inv-gauge-hang");
      expect(sheet).toContain(".inv-pareto");
      expect(sheet).toContain(".inv-fg-bar");
      expect(sheet).toContain(".recall-pane");
      expect(sheet).toContain(".acquire-split");
    }
  });
});
```

--- tail scripts/smoke.mjs
```
    await stopWrangler(child);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```
