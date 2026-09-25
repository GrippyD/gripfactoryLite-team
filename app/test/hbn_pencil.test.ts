import { describe, expect, it } from "vitest";
import { editRecord } from "../src/actions";
import { HttpError } from "../src/audit";
import { EDITABLE_FIELDS } from "../src/pipeline";

/** THE HBN THAT CAME BACK (canon 0.30.84). Owner report 2026-09-15, verbatim:
 * "This one is interesting.  For some reason, they're weighing an HBN from
 * yesterday at PNS.  Wrong HBN, wrong farm, wrong everything.  This was the
 * actual first lot yesterday.  The issue started when they unloaded the silo."
 * His pick: the HBN pencil on the lot. A weighing lot moves to an open HBN with
 * a reason, weights and all; a finished lot and a complete HBN both refuse. */

type Row = Record<string, unknown>;

function makeDb(lot: Row, batches: Row[]) {
  const tables: Record<string, Row[]> = {
    people: [{ id: "p1", display_name: "Pat", is_active: 1, deleted_at: null }],
    wet_weight_entries: [lot],
    harvest_batches: batches,
    record_change_log: [],
  };
  const norm = (sql: string) => sql.replace(/\s+/g, " ").trim().toLowerCase();
  function insert(sql: string, args: unknown[]) {
    const m = sql.match(/insert into (\w+)\s*\(([^)]+)\)\s*values\s*\(([\s\S]+)\)/i);
    if (!m) return;
    const cols = m[2].split(",").map((c) => c.trim());
    const vals = m[3].split(",").map((v) => v.trim());
    const row: Row = {};
    let ai = 0;
    cols.forEach((col, i) => {
      row[col] = vals[i] === "?" ? args[ai++] : vals[i];
    });
    (tables[m[1]] ??= []).push(row);
  }
  function update(sql: string, args: unknown[]) {
    const m = sql.match(/update (\w+) set (.+?) where (\w+) = \?/i);
    if (!m) return;
    const sets = m[2].split(",").map((p) => p.trim().split("=")[0].trim());
    const row = (tables[m[1]] ?? []).find((r) => r.id === args[sets.length]);
    if (!row) return;
    sets.forEach((col, i) => {
      row[col] = args[i];
    });
  }
  function exec(sql: string, args: unknown[]) {
    const q = norm(sql);
    if (q.startsWith("insert into")) return insert(sql, args), { success: true };
    if (q.startsWith("update ")) return update(sql, args), { success: true };
    if (q.includes("from people")) return tables.people.find((r) => r.id === args[0]) ?? null;
    if (q.includes("from wet_weight_entries")) return tables.wet_weight_entries.find((r) => r.id === args[0]) ?? null;
    if (q.includes("from harvest_batches")) return tables.harvest_batches.find((r) => r.id === args[0] && !r.deleted_at) ?? null;
    return null;
  }
  function stmt(sql: string) {
    const args: unknown[] = [];
    const self = {
      bind(...next: unknown[]) {
        args.push(...next);
        return self;
      },
      async first() {
        return exec(sql, args);
      },
      async all() {
        const r = exec(sql, args);
        return { results: r ? [r] : [] };
      },
      async run() {
        exec(sql, args);
        return { success: true };
      },
    };
    return self;
  }
  return {
    tables,
    prepare: (sql: string) => stmt(sql),
    async batch(stmts: { run: () => Promise<unknown> }[]) {
      for (const s of stmts) await s.run();
    },
  };
}

function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

const openPnn = { id: "hb-pnn", status: "open", deleted_at: null };
const openPns = { id: "hb-pns", status: "open", deleted_at: null };
const complete = { id: "hb-done", status: "complete", deleted_at: null };

describe("THE HBN THAT CAME BACK (canon 0.30.84): the HBN pencil on the lot", () => {
  it("the lot record carries HBN as a reasoned lookup over harvest batches, first in the list", () => {
    const fields = EDITABLE_FIELDS.wet_weight_entries;
    expect(fields[0]).toEqual({ name: "harvest_batch_id", label: "HBN", input: "lookup", lookup: "harvest_batches" });
    expect(EDITABLE_FIELDS.wet_weights.map((f) => f.name)).toContain("harvest_batch_id");
  });

  it("moves a weighing lot to an open HBN with a reason and logs the change", async () => {
    const db = makeDb(
      { id: "lot1", status: "weighing", harvest_batch_id: "hb-pnn", material_form: "bucked", deleted_at: null },
      [openPnn, openPns]
    );
    const out = await editRecord(db as unknown as D1Database, "wet_weight_entries", "lot1", fd({
      person_id: "p1",
      harvest_batch_id: "hb-pns",
      reason: "weighed into yesterday's PNN HBN by mistake",
    }));
    expect(out.redirect).toBe("/record/wet_weight_entries/lot1/edit?ok=saved");
    expect(db.tables.wet_weight_entries[0].harvest_batch_id).toBe("hb-pns");
    const log = db.tables.record_change_log.find((l) => l.field === "harvest_batch_id");
    expect(log).toMatchObject({
      record_table: "wet_weight_entries",
      record_id: "lot1",
      old_value: "hb-pnn",
      new_value: "hb-pns",
      reason: "weighed into yesterday's PNN HBN by mistake",
    });
  });

  it("refuses to move a lot that has finished against its HBN", async () => {
    for (const status of ["drying", "in_transit", "unloaded", "trimmed"]) {
      const db = makeDb(
        { id: "lot1", status, harvest_batch_id: "hb-pnn", material_form: "bucked", deleted_at: null },
        [openPnn, openPns]
      );
      const attempt = editRecord(db as unknown as D1Database, "wet_weight_entries", "lot1", fd({
        person_id: "p1",
        harvest_batch_id: "hb-pns",
        reason: "wrong HBN",
      }));
      await expect(attempt).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Only a weighing lot") });
      expect(db.tables.wet_weight_entries[0].harvest_batch_id).toBe("hb-pnn");
    }
  });

  it("refuses a complete HBN and an unknown one", async () => {
    const db = makeDb(
      { id: "lot1", status: "weighing", harvest_batch_id: "hb-pnn", material_form: "bucked", deleted_at: null },
      [openPnn, complete]
    );
    await expect(
      editRecord(db as unknown as D1Database, "wet_weight_entries", "lot1", fd({ person_id: "p1", harvest_batch_id: "hb-done", reason: "x" }))
    ).rejects.toMatchObject({ status: 400, message: "Pick an open HBN." });
    await expect(
      editRecord(db as unknown as D1Database, "wet_weight_entries", "lot1", fd({ person_id: "p1", harvest_batch_id: "hb-nope", reason: "x" }))
    ).rejects.toMatchObject({ status: 404, message: "Unknown HBN." });
    expect(db.tables.wet_weight_entries[0].harvest_batch_id).toBe("hb-pnn");
  });

  it("an unchanged HBN on a finished lot is no move: the other fields still edit", async () => {
    const db = makeDb(
      { id: "lot1", status: "unloaded", harvest_batch_id: "hb-pnn", material_form: "bucked", notes: null, deleted_at: null },
      [openPnn]
    );
    const out = await editRecord(db as unknown as D1Database, "wet_weight_entries", "lot1", fd({
      person_id: "p1",
      harvest_batch_id: "hb-pnn",
      notes: "left as is",
      reason: "a note",
    }));
    expect(out.redirect).toContain("ok=saved");
    expect(db.tables.wet_weight_entries[0].notes).toBe("left as is");
    expect(db.tables.record_change_log.some((l) => l.field === "harvest_batch_id")).toBe(false);
  });

  it("a blank HBN refuses in words; an absent field (older form) leaves it alone", async () => {
    const db = makeDb(
      { id: "lot1", status: "weighing", harvest_batch_id: "hb-pnn", material_form: "bucked", notes: null, deleted_at: null },
      [openPnn]
    );
    await expect(
      editRecord(db as unknown as D1Database, "wet_weight_entries", "lot1", fd({ person_id: "p1", harvest_batch_id: "", reason: "x" }))
    ).rejects.toBeInstanceOf(HttpError);
    const out = await editRecord(db as unknown as D1Database, "wet_weight_entries", "lot1", fd({ person_id: "p1", notes: "older form", reason: "x" }));
    expect(out.redirect).toContain("ok=saved");
    expect(db.tables.wet_weight_entries[0].harvest_batch_id).toBe("hb-pnn");
  });
});
