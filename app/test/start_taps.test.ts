import { describe, expect, it } from "vitest";
import { createWetWeight } from "../src/actions";
import { START_LOT_REPEAT_WINDOW_SECONDS, TRUCK_DRY_SPACE_ID } from "../src/config";
import { lockOnSubmitScript, localTimeScript } from "../src/html";

/** THE FOUR START TAPS (canon 0.30.89). Owner, 2026-09-16, with a picture of
 * the wet weight station: four weighing lots on the PNS HBN 26020 born six
 * seconds apart (00:12:43 to 00:12:49 UTC), two empty, two carrying weight,
 * listed under "Lots in progress" by their UTC instants: "What's happening?".
 * Repeated taps on Start lot minted a lot each. The law: a header that repeats
 * an EMPTY weighing lot's within the window lands on that lot; the button locks
 * on the first tap; the resume list names each lot in local time with its Move
 * To, Team Lead and total. */

type Row = Record<string, unknown>;

function makeDb(lots: Row[]) {
  const tables: Record<string, Row[]> = {
    people: [{ id: "p1", display_name: "Pat", is_active: 1, deleted_at: null }],
    harvest_batches: [{ id: "hb1", status: "open", deleted_at: null }],
    dry_spaces: [
      { id: "silo1", kind: "silo", deleted_at: null },
      { id: "silo2", kind: "silo", deleted_at: null },
      { id: TRUCK_DRY_SPACE_ID, kind: "truck", deleted_at: null },
    ],
    wet_weight_entries: lots,
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
      row[col] = vals[i] === "?" ? args[ai++] : /^null$/i.test(vals[i]) ? null : vals[i];
    });
    (tables[m[1]] ??= []).push(row);
  }
  function exec(sql: string, args: unknown[]) {
    const q = norm(sql);
    if (q.startsWith("insert into")) return insert(sql, args), { success: true };
    if (q.includes("from people")) return tables.people.find((r) => r.id === args[0]) ?? null;
    if (q.includes("from harvest_batches")) return tables.harvest_batches.find((r) => r.id === args[0]) ?? null;
    if (q.includes("from dry_spaces")) return tables.dry_spaces.find((r) => r.id === args[0]) ?? null;
    if (q.includes("from wet_weight_entries") && q.includes("created_at >= ?")) {
      const [batch, status, space, truck, lead, since] = args as string[];
      const hits = tables.wet_weight_entries
        .filter(
          (r) =>
            r.harvest_batch_id === batch &&
            r.status === status &&
            !r.deleted_at &&
            Number(r.weight_grams) === 0 &&
            r.actual_dryspc === space &&
            String(r.truck_number ?? "") === truck &&
            String(r.team_lead ?? "").trim().toLowerCase() === lead &&
            String(r.created_at) >= since
        )
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return hits[0] ?? null;
    }
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

// THE BLANK SLATE (canon 0.30.108): the trucks left the Move To list, so the
// four taps' header points at a silo now; the truck header of 2026-09-16
// refuses in words (pinned below).
const header = { person_id: "p1", team_lead: "Plutarco", harvest_batch_id: "hb1", actual_dryspc: "silo1", material_form: "bucked" };
const truckHeader = { ...header, actual_dryspc: "truck-4" };
const secondsAgo = (n: number) => new Date(Date.now() - n * 1000).toISOString();
const emptyLot = (over: Row = {}): Row => ({
  id: "lot-first",
  harvest_batch_id: "hb1",
  status: "weighing",
  weight_grams: 0,
  actual_dryspc: "silo1",
  truck_number: null,
  team_lead: "plutarco",
  created_at: secondsAgo(6),
  deleted_at: null,
  ...over,
});

describe("THE FOUR START TAPS (canon 0.30.89): the Start lot repeat guard", () => {
  it("the window is one minute", () => {
    expect(START_LOT_REPEAT_WINDOW_SECONDS).toBe(60);
  });

  it("a header repeating an empty weighing lot born seconds ago lands on that lot, minting nothing (case-blind Team Lead)", async () => {
    const db = makeDb([emptyLot()]);
    const out = await createWetWeight(db as unknown as D1Database, fd(header));
    expect(out.redirect).toBe("/station/wet_weight?lot=lot-first&repeat=1");
    expect(db.tables.wet_weight_entries).toHaveLength(1);
    expect(db.tables.record_change_log).toHaveLength(0);
  });

  it("a lot that already holds weight is never taken for a tap: a new lot is born", async () => {
    const db = makeDb([emptyLot({ weight_grams: 5 })]);
    const out = await createWetWeight(db as unknown as D1Database, fd(header));
    expect(out.redirect).toMatch(/^\/station\/wet_weight\?lot=[0-9a-f-]{36}$/);
    expect(db.tables.wet_weight_entries).toHaveLength(2);
    expect(db.tables.record_change_log.length).toBeGreaterThan(0);
  });

  it("an empty lot born before the window, or with another header, is not the same lot", async () => {
    const old = makeDb([emptyLot({ created_at: secondsAgo(START_LOT_REPEAT_WINDOW_SECONDS + 30) })]);
    await createWetWeight(old as unknown as D1Database, fd(header));
    expect(old.tables.wet_weight_entries).toHaveLength(2);
    const otherLead = makeDb([emptyLot({ team_lead: "Olga" })]);
    await createWetWeight(otherLead as unknown as D1Database, fd(header));
    expect(otherLead.tables.wet_weight_entries).toHaveLength(2);
    const otherSpace = makeDb([emptyLot({ actual_dryspc: "silo2" })]);
    await createWetWeight(otherSpace as unknown as D1Database, fd(header));
    expect(otherSpace.tables.wet_weight_entries).toHaveLength(2);
    // A lot that still rides a truck (a record-borne truck number from before
    // THE BLANK SLATE) is another header, not this one.
    const truckLot = makeDb([emptyLot({ actual_dryspc: TRUCK_DRY_SPACE_ID, truck_number: "4" })]);
    await createWetWeight(truckLot as unknown as D1Database, fd(header));
    expect(truckLot.tables.wet_weight_entries).toHaveLength(2);
  });

  it("THE BLANK SLATE (canon 0.30.108): a truck header refuses in words and mints nothing", async () => {
    const db = makeDb([]);
    await expect(createWetWeight(db as unknown as D1Database, fd(truckHeader))).rejects.toMatchObject({
      status: 400,
      message: "Trucks left the Move To list; every lot lands in PNN's barn. Pick a silo or a room.",
    });
    expect(db.tables.wet_weight_entries).toHaveLength(0);
    const sentinel = makeDb([]);
    await expect(createWetWeight(sentinel as unknown as D1Database, fd({ ...header, actual_dryspc: TRUCK_DRY_SPACE_ID }))).rejects.toMatchObject({ status: 400 });
    expect(sentinel.tables.wet_weight_entries).toHaveLength(0);
  });

  it("a voided or finished twin does not catch the tap", async () => {
    const voided = makeDb([emptyLot({ deleted_at: "2026-09-16T00:00:00.000Z" })]);
    await createWetWeight(voided as unknown as D1Database, fd(header));
    expect(voided.tables.wet_weight_entries).toHaveLength(2);
    const drying = makeDb([emptyLot({ status: "drying" })]);
    await createWetWeight(drying as unknown as D1Database, fd(header));
    expect(drying.tables.wet_weight_entries).toHaveLength(2);
  });

  it("the header form locks its button on the first tap; the resume list renders local time", () => {
    const lock = lockOnSubmitScript();
    expect(lock).toContain('form[data-lock-on-submit]');
    expect(lock).toContain("b.disabled = true");
    const local = localTimeScript();
    expect(local).toContain("time[data-local]");
    expect(local).toContain("data-local-done");
  });
});
