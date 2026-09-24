/**
 * A memory database built from the app's own migrations, in order, behind the
 * slice of the D1 surface the app uses (prepare, bind, run, first, all, batch).
 * `until` stops before the named migration so a test can seed the older shape
 * and then apply the rest.
 */

type SqliteStatement = {
  run(...args: Array<string | number | null>): { changes: number | bigint };
  get(...args: Array<string | number | null>): unknown;
  all(...args: Array<string | number | null>): unknown[];
};

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
};

type Row = Record<string, unknown>;

export type MigratedDb = {
  db: D1Database;
  get: (sql: string, ...args: Array<string | number | null>) => Row | undefined;
  all: (sql: string, ...args: Array<string | number | null>) => Row[];
  run: (sql: string, ...args: Array<string | number | null>) => void;
  applyRest: () => Promise<void>;
};

export async function migratedDb(options: { until?: string } = {}): Promise<MigratedDb> {
  const sqliteMod = (await import("node:" + "sqlite")) as { DatabaseSync: new (path: string) => SqliteDb };
  const fs = (await import("node:" + "fs")) as {
    readdirSync(path: URL): string[];
    readFileSync(path: URL, encoding: "utf8"): string;
  };
  const dir = new URL("../migrations/", import.meta.url);
  const names = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  const sqlite = new sqliteMod.DatabaseSync(":memory:");
  const stop = options.until ? names.findIndex((name) => name.startsWith(options.until as string)) : -1;
  const first = stop >= 0 ? names.slice(0, stop) : names;
  const rest = stop >= 0 ? names.slice(stop) : [];
  for (const name of first) sqlite.exec(fs.readFileSync(new URL(name, dir), "utf8"));
  const make = (sql: string, args: unknown[]) => {
    const bound = args as Array<string | number | null>;
    return {
      bind: (...next: unknown[]) => make(sql, next),
      async run() {
        const out = sqlite.prepare(sql).run(...bound);
        return { success: true, meta: { changes: Number(out.changes) } };
      },
      async first<T>(column?: string) {
        const row = sqlite.prepare(sql).get(...bound) as Row | undefined;
        if (!row) return null;
        return (column ? row[column] : row) as T;
      },
      async all<T>() {
        return { success: true, results: sqlite.prepare(sql).all(...bound) as T[] };
      },
    };
  };
  const db = {
    prepare: (sql: string) => make(sql, []),
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      sqlite.exec("BEGIN");
      try {
        const out = [];
        for (const stmt of stmts) out.push(await stmt.run());
        sqlite.exec("COMMIT");
        return out;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
  };
  return {
    db: db as unknown as D1Database,
    get: (sql, ...args) => sqlite.prepare(sql).get(...args) as Row | undefined,
    all: (sql, ...args) => sqlite.prepare(sql).all(...args) as Row[],
    run: (sql, ...args) => {
      sqlite.prepare(sql).run(...args);
    },
    applyRest: async () => {
      for (const name of rest) sqlite.exec(fs.readFileSync(new URL(name, dir), "utf8"));
    },
  };
}

const T0 = "2026-09-22T12:00:00.000Z";

/** A person who may act. */
export function seedPerson(m: MigratedDb, id = "person-1"): string {
  m.run(`INSERT INTO people (id, display_name, is_active, created_at, updated_at) VALUES (?, 'Smoke Hand', 1, ?, ?)`, id, T0, T0);
  return id;
}

/** An app-minted batch (born_from app). */
export function seedBatch(
  m: MigratedDb,
  over: { id: string; hbn: string; serial: number; strainId?: string; farm?: string; status?: string; born?: string }
): string {
  m.run(
    `INSERT INTO harvest_batches (
       id, entry_date, farm_code, grow_method_code, strain_id, manicure, hbn, lot_serial, harvest_year, status,
       license_value, born_from, created_at, updated_at
     ) VALUES (?, '2026-09-08', ?, 'GH', ?, 0, ?, ?, 2026, ?, 'AU-G-C-000832', ?, ?, ?)`,
    over.id,
    over.farm ?? "ARL",
    over.strainId ?? "98cf3164-344e-414a-9f1c-1526fde445ac",
    over.hbn,
    over.serial,
    over.status ?? "open",
    over.born ?? "app",
    T0,
    T0
  );
  return over.id;
}

/** A lot on a batch. */
export function seedLot(m: MigratedDb, id: string, batchId: string, status = "trimmed"): string {
  m.run(
    `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, dry_weight_grams, actual_dryspc, status, created_at, updated_at)
     VALUES (?, ?, 1000, 800, 'dry-1', ?, ?, ?)`,
    id,
    batchId,
    status,
    T0,
    T0
  );
  return id;
}

/** One live mirror package. */
export function seedMirror(
  m: MigratedDb,
  row: { tag: string; harvest?: string | null; sourcePackages?: string | null; item?: string; strain?: string | null; grams?: number; status?: string; license?: string; location?: string; packaged?: string | null; gone?: string | null }
): void {
  m.run(
    `INSERT INTO metrc_packages (
       tag, license_value, source_harvests, source_packages, location, item, item_strain, quantity, uom,
       lab_test_status, packaged_date, mount_id, first_seen_at, changed_at, gone_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'g', ?, ?, 'mount-1', ?, ?, ?)`,
    row.tag,
    row.license ?? "AU-P-000694",
    row.harvest ?? null,
    row.sourcePackages ?? null,
    row.location ?? "Cryo 1",
    row.item ?? "WPR - Zebra Cake - PNN - O",
    row.strain === undefined ? "Zebra Cake" : row.strain,
    row.grams ?? 750.5,
    row.status ?? "TestPassed",
    row.packaged === undefined ? "2026-09-15" : row.packaged,
    T0,
    T0,
    row.gone ?? null
  );
}

export function formOf(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}
