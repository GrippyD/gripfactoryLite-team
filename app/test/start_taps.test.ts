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
    // THE HBN ENTRY (canon 0.30.341): the HBN decides the lot's form and its space; this one is Bucked on Silo 1.
    harvest_batches: [{ id: "hb1", status: "open", born_from: "app", farm_code: "PNN", material_form: "bucked", planned_dryspc: "1", deleted_at: null }],
    dry_spaces: [
      { id: "silo1", name: "Silo 1", kind: "silo", space_type: "silo", deleted_at: null },
      { id: "silo2", name: "Silo 2", kind: "silo", space_type: "silo", deleted_at: null },
      { id: TRUCK_DRY_SPACE_ID, name: "Truck", kind: "truck", space_type: null, deleted_at: null },
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
    // listSilos: the sequence's spaces, kind silo, in the strip's order.
    if (q.includes("from dry_spaces where kind = 'silo'")) return tables.dry_spaces.filter((r) => r.kind === "silo");
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
        return { results: Array.isArray(r) ? r : r ? [r] : [] };
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

// THE HBN ENTRY (canon 0.30.341): the header carries no Move To and no form any
// more; the HBN (Bucked, Silo 1) decides both. An older client's posted
// actual_dryspc or material_form is ignored (pinned below).
const header = { person_id: "p1", team_lead: "Test Lead", harvest_batch_id: "hb1" };
const truckHeader = { ...header, actual_dryspc: "truck-4", material_form: "spear" };
const secondsAgo = (n: number) => new Date(Date.now() - n * 1000).toISOString();
const emptyLot = (over: Row = {}): Row => ({
  id: "lot-first",
  harvest_batch_id: "hb1",
  status: "weighing",
  weight_grams: 0,
  actual_dryspc: "silo1",
  truck_number: null,
  team_lead: "test lead",
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
    const otherLead = makeDb([emptyLot({ team_lead: "Other Lead" })]);
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

  it("THE HBN ENTRY (canon 0.30.341): a posted Move To or form is ignored; the HBN's silo and form land the lot", async () => {
    const db = makeDb([]);
    await createWetWeight(db as unknown as D1Database, fd(truckHeader));
    expect(db.tables.wet_weight_entries).toHaveLength(1);
    expect(db.tables.wet_weight_entries[0]).toMatchObject({ actual_dryspc: "silo1", material_form: "bucked" });
    const sentinel = makeDb([]);
    await createWetWeight(sentinel as unknown as D1Database, fd({ ...header, actual_dryspc: TRUCK_DRY_SPACE_ID }));
    expect(sentinel.tables.wet_weight_entries[0]).toMatchObject({ actual_dryspc: "silo1" });
    // A Bucked HBN with no numeric silo refuses in words and mints nothing.
    const noSilo = makeDb([]);
    noSilo.tables.harvest_batches[0].planned_dryspc = null;
    await expect(createWetWeight(noSilo as unknown as D1Database, fd(header))).rejects.toMatchObject({
      status: 400,
      message: "This HBN has no silo. Set it on the HBN first.",
    });
    expect(noSilo.tables.wet_weight_entries).toHaveLength(0);
  });

  it("a voided or finished twin does not catch the tap", async () => {
    const voided = makeDb([emptyLot({ deleted_at: "2026-09-16T00:00:00.000Z" })]);
    await createWetWeight(voided as unknown as D1Database, fd(header));
    expect(voided.tables.wet_weight_entries).toHaveLength(2);
    const drying = makeDb([emptyLot({ status: "drying" })]);
    await createWetWeight(drying as unknown as D1Database, fd(header));
    expect(drying.tables.wet_weight_entries).toHaveLength(2);
  });

  it("THE TRUCK RECORD (canon 0.30.226): Truck # is part of the header the repeat guard matches", async () => {
    const same = makeDb([emptyLot({ truck_number: "3" })]);
    const again = await createWetWeight(same as unknown as D1Database, fd({ ...header, truck_number: "3" }));
    expect(again.redirect).toBe("/station/wet_weight?lot=lot-first&repeat=1");
    expect(same.tables.wet_weight_entries).toHaveLength(1);
    const other = makeDb([emptyLot({ truck_number: "3" })]);
    await createWetWeight(other as unknown as D1Database, fd({ ...header, truck_number: "4" }));
    expect(other.tables.wet_weight_entries).toHaveLength(2);
    expect(other.tables.wet_weight_entries[1].truck_number).toBe("4");
    const blank = makeDb([]);
    await createWetWeight(blank as unknown as D1Database, fd(header));
    expect(blank.tables.wet_weight_entries[0].truck_number).toBeNull();
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
