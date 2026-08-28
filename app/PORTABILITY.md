# D1 to Postgres type mapping

Slice 1 SQL is ANSI-shaped so a later Aurora/Postgres port is a dialect change, not a rewrite. D1 is SQLite underneath.

## Column types

| D1 (this repo) | Postgres |
|---|---|
| TEXT primary keys (uuid strings from crypto.randomUUID) | uuid |
| TEXT columns named `*_at` (ISO 8601 UTC) | timestamptz |
| INTEGER 0/1 named `is_*` or `manicure` | boolean |
| NUMERIC (grams, two decimals, rounded in app code) | numeric(12,2) |
| TEXT for codes, names, status tokens, notes | text |

Status tokens (`open`, `drying`, `cryo_queue`, and the rest) live in `src/config.ts` as future config-table candidates. They are not CHECK constraints and not database enums, so the Postgres port does not need ENUM types.

## Seed dialect

Lookup seed migrations use `INSERT OR IGNORE` keyed on natural keys (primary key or UNIQUE name). That is a SQLite seed convenience. On Postgres, rewrite those statements to:

```sql
INSERT INTO ... VALUES (...)
ON CONFLICT DO NOTHING;
```

Application code (Workers) uses parameterized `INSERT` and `UPDATE` only. It never issues `DELETE`, never uses SQLite pragmas, and never uses AUTOINCREMENT.

## Other port notes

- Boolean reads from D1 come back as numbers 0/1. Keep comparing to `0`/`1` in app code so the same checks work after a boolean column type change.
- `record_change_log` has no audit columns; it is the audit. Same shape on Postgres.
- Foreign keys are declared in SQL. D1/SQLite may not enforce them the same way Postgres does. Do not rely on the database to catch missing lookups; the app loads lookups before insert.
