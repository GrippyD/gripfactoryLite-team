# 2026-10-07 The sensor door keeps each unit

BRIEF SD1, THE SENSOR DOOR KEEPS EACH UNIT (canon 0.30.422). No migration of its own. H1's 0095 was not on the disk at the open. It landed in this worktree while this session was open, so the gates below are the combined tree. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The pin

Opened on `9c7639ac10df35ec` (305 files, migrations 0001 to 0094, `wrangler.toml` read as LF). That is the tree the brief named. The tree this session leaves is `c63769980fe87554` (307 files, migrations 0001 to 0095). The two files past the open are H1's migration and H1's test file.

## What changed

A reading may carry `sensor_id`, trimmed, 1 to 80 characters. Longer than 80 is refused with the reading's number, and a reading that is not text is refused the same way. A blank is stored as today, with `sensor_id` NULL. The id is written on `sensor_readings.sensor_id`.

A resend is skipped. The same `sensor_id` and `read_at` already held, or a reading with no sensor id whose room, `read_at` and source already stand with a NULL sensor id, is not stored again and does not fail the batch. The same pair inside one batch stores once. Every reading is checked before any row is written. One bad reading still answers 400 and writes nothing. The answer is 200 `{"ok":true,"stored":n,"skipped":m}`.

A cure pane's conditions line, and the room flag that sits on it, reads each unit's newest door reading within 15 minutes of the room's newest door reading. Door rows are those with no role. A SensorPush pull row keeps its role and its binding. Readings with no sensor id are one unit for the room. A source of "test" stays out. The line shows the mean temperature and mean humidity, rounded as before, and "{n} units" when n is more than 1 (ES "{n} unidades"). The hover is the newest read time and that reading's source.

On the Environment page, those door readings show under the room name in the same words. They do not need a sensor binding. The catalog, the pull, and the bindings are unchanged.

The old smoke step that posted a second manual HBN with the same tail and a new text still expected 409. H1's law accepts that text, so the step now expects 303, and a repeat of the same HBN text still expects 409. The from-zero apply check now says 95 migrations.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 95 files, 1256 tests passed under `TZ=UTC`, and 95 files, 1256 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9484`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`, `node scripts/smoke.mjs`): About to apply 95 migration(s), SMOKE PASS, exit 0. No ` 500 ` line. The one ` 503 ` line is `POST /api/send`, the smoke's own asserted step.
- Dash (U+2013, U+2014), CR, and BOM audits by character on the files this brief touched and this report: 0.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. Say deploy when you want it on the grip worker.

## Sealed final check

```
the tree as received, wrangler.toml read as LF
                                      9c7639ac10df35ec (305 files, migrations 0001-0094)
npx tsc --noEmit                      exit 0
TZ=UTC npx vitest run                 95 files, 1256 tests passed
TZ=America/New_York npx vitest run    95 files, 1256 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9484 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC node scripts/smoke.mjs
                                      About to apply 95 migration(s); SMOKE PASS; " 500 " lines: 0; POST /api/send 503 (the smoke's own step); exit 0
dash audit: 0; CR audit: 0; BOM: 0
the app tree this session leaves, wrangler.toml read as LF
                                      c63769980fe87554 (307 files, migrations 0001-0095)
```

The tree hash is sha256 of the text-mode `sha256sum` list (`<hash><two spaces><path>`, forward slashes, a final newline) over `src`, `test`, `scripts`, `migrations`, `wrangler.toml`, `tsconfig.json`, and `package.json`, sorted. `wrangler.toml` is read as LF. File hashes below are the session's final bytes.

```
app/src/cure.ts                      26067  8bddbb6c907fa741
TAIL data.nowIso,\n    locale,\n    flags.CSB ?? [],\n    layout\n  )}${cureClockScript()}`;\n}\n
app/src/environment.ts               29103  6a12f325e3c4b561
TAIL es),\n      actor_person_id: actor.id,\n      reason,\n      changed_at: ts,\n    }),\n  ]);\n}\n
app/src/i18n.ts                     268573  cfafa49ba09bcce4
TAIL turn err.words ? tFill(locale, err.words.key, err.words.vars) : t(locale, err.message);\n}\n
app/src/index.ts                    179515  9038875750c0f8c9
TAIL }\n\nconst worker = { fetch: app.fetch, scheduled };\nexport { app };\nexport default worker;\n
app/test/cure.test.ts                20138  ab3fc44ae3814467
TAIL idades");\n    expect(html).toContain('title="2026-09-21 23:00 ET · silo-ops"');\n  });\n});\n
app/test/environment.test.ts         12702  eeb524a1750ce3b9
TAIL  F"]);\n    expect(curePanes(panes, "en")).toContain("71.5 F · 50 % · 4 units");\n  });\n});\n
app/test/service.test.ts              8806  ab017db1182d10e3
TAIL request("/feeds/trim-weighs.json", {}, dev);\n    expect(feed.status).toBe(200);\n  });\n});\n
app/scripts/smoke.mjs               821974  23dfa3f23410f50a
TAIL angler(child);\n  }\n}\n\nrun().catch((err) => {\n  console.error(err);\n  process.exit(1);\n});\n
```
