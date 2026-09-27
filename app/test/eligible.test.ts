import { describe, expect, it } from "vitest";
import { loadSilo } from "../src/actions";
import { LOT_STATUS, SYSTEM_REASON } from "../src/config";
import { listBarnWetLots, type BarnWetLotRow, type SiloRow } from "../src/db";
import { loadSiloPage } from "../src/drying";

/** A D1 stand-in: reads answer by SQL shape from the rows given; every
 * statement that reaches batch is kept with its SQL and binds for the pins. */
function fakeDb(rows: { lots?: Array<Record<string, unknown>>; spaces?: Array<Record<string, unknown>> }) {
  const prepared: Array<{ sql: string; args: unknown[] }> = [];
  const batched: Array<{ sql: string; args: unknown[] }> = [];
  function stmt(sql: string) {
    const args: unknown[] = [];
    const self = {
      bind(...next: unknown[]) {
        args.push(...next);
        return self;
      },
      async all() {
        prepared.push({ sql, args });
        if (sql.includes("FROM wet_weight_entries w") && sql.includes("AS barn_location")) return { results: rows.lots ?? [] };
        if (sql.includes("FROM production_schedules") && args.includes("internal_logistics")) {
          const lot = (rows.lots ?? [])[0];
          const batch = lot ? String(lot.harvest_batch_id || lot.id || "") : "";
          return { results: batch ? [{ id: "sched-1", harvest_batch_id: batch, scheduled_at: "2026-09-19T12:00:00.000Z" }] : [] };
        }
        return { results: [] };
      },
      async first() {
        prepared.push({ sql, args });
        if (sql.includes("FROM people WHERE id = ?")) return { id: args[0], display_name: "Crew", is_active: 1 };
        if (sql.includes("FROM dry_spaces WHERE id = ?")) return (rows.spaces ?? []).find((s) => s.id === args[0]) ?? null;
        // No open load on the lot, no occupant in the space.
        if (sql.includes("FROM silo_loads l")) return null;
        return null;
      },
      async run() {
        return { success: true };
      },
      sql,
      args,
    };
    return self;
  }
  return {
    prepare: (sql: string) => stmt(sql),
    async batch(stmts: Array<{ sql: string; args: unknown[] }>) {
      for (const s of stmts) batched.push({ sql: s.sql, args: s.args });
      return stmts.map(() => ({ success: true }));
    },
    prepared,
    batched,
  };
}

const SILO_3 = { id: "s3", name: "Silo 3", kind: "silo", farm_code: "PNN", location_name: null };
const ARL_ROOM = { id: "arl", name: "Arlington Dry Room", kind: "silo", farm_code: "ARL", location_name: null };

function lotRow(over: Partial<BarnWetLotRow> = {}): BarnWetLotRow {
  return {
    id: "lot27",
    status: LOT_STATUS.drying,
    barn_location: "BARN",
    hbn: "26261-PNS-OD-029-0-01-26027",
    metrc_harvest_tag: "1A4060300003E5B000027027",
    farm_code: "PNS",
    strain_label: "Goji",
    entry_date: "2026-09-19",
    weight_grams: 1500,
    material_form: "bucked",
    actual_dryspc: "s3",
    planned_space_name: "Silo 3",
    planned_space_kind: "silo",
    planned_silo_id: null,
    package_code: "26027",
    item_id: "item27",
    lead_name: "Lead",
    supervisor_name: "crew@local",
    notes: null,
    plant_count: 40,
    ...over,
  };
}

function loadForm(lotId: string, spaceId: string): FormData {
  const form = new FormData();
  form.set("person_id", "p1");
  form.set("lot_id", lotId);
  form.set("dry_space_id", spaceId);
  form.set("start_time", "");
  form.set("loaded_at_iso", "");
  return form;
}

describe("THE FINISHED LOT IS ELIGIBLE (canon 0.30.130; owner: sever its hold on where ledger inventory lands; eligible as soon as finish lot runs)", () => {
  it("the pane reads every finished lot no open load holds, whatever the farm and wherever the package sits", async () => {
    const db = fakeDb({ lots: [lotRow()] });
    const rows = await listBarnWetLots(db as unknown as D1Database);
    expect(rows).toHaveLength(1);
    const read = db.prepared.find((p) => p.sql.includes("AS barn_location"));
    expect(read).toBeDefined();
    const sql = read!.sql.replace(/\s+/g, " ");
    // The 0.30.73 gate is gone: no barn list on the package join, the package
    // rides as a LEFT JOIN on the lot's earliest live item.
    expect(sql).not.toContain("li.location IN");
    expect(sql).toContain("LEFT JOIN local_inventory_items li ON li.id = ( SELECT i.id FROM local_inventory_items i WHERE i.wet_weight_entry_id = w.id AND i.deleted_at IS NULL ORDER BY i.created_at ASC, i.id ASC LIMIT 1)");
    expect(sql).toContain("WHERE w.deleted_at IS NULL AND w.status IN (?, ?)");
    expect(sql).toContain("NOT EXISTS ( SELECT 1 FROM silo_loads l WHERE l.wet_weight_entry_id = w.id AND l.ended_at IS NULL AND l.deleted_at IS NULL)");
    expect(sql).not.toContain("farm_code =");
    expect(read!.args).toEqual([LOT_STATUS.drying, LOT_STATUS.in_transit]);
  });

  it("the picked lot is offered every space on the strip, the Arlington Dry Room included, and a homeless package still renders", () => {
    const silos: SiloRow[] = [
      { id: "s1", name: "Silo 1", farm_code: "PNN", space_type: "silo" },
      { id: "s3", name: "Silo 3", farm_code: "PNN", space_type: "silo" },
      { id: "arl", name: "Arlington Dry Room", farm_code: "ARL", space_type: "dry_room" },
    ];
    const moved = lotRow({ barn_location: "Silo 3" });
    const page = loadSiloPage({ barnLots: [moved], silos, loads: [], picked: moved, pickedLoad: null, nowIso: "2026-09-19T12:00:00.000Z" });
    expect(page).toContain("Scheduled lots");
    expect(page).not.toContain("Wet lots in the barn");
    expect(page).toContain('<option value="s1">Silo 1</option>');
    expect(page).toContain('<option value="s3" selected>Silo 3</option>');
    expect(page).toContain('<option value="arl">Arlington Dry Room</option>');
    // A lot whose package is gone from the ledger still stands on the pane,
    // marked, and its pick shows the words where the load form would be.
    const homeless = lotRow({ barn_location: null, item_id: null, package_code: null });
    const page2 = loadSiloPage({ barnLots: [homeless], silos, loads: [], picked: homeless, pickedLoad: null, nowIso: "2026-09-19T12:00:00.000Z" });
    expect(page2).toContain("027027 / PNS / Goji");
    expect(page2).toContain('<span class="muted" data-no-package>(no live package)</span>');
    expect(page2).toContain('<p class="banner warn" data-no-package>This lot has no live package in the ledger (voided, or closed as gone in METRC). Restore the package or repair the lot before loading it.</p>');
    expect(page2).not.toContain('action="/station/load_silo/load"');
    expect(page2).toContain("<dt>Package</dt><dd>26027</dd>");
    // Without a harvest tag either, the row reads by the HBN serial, the floor's number for the lot.
    const untagged = lotRow({ barn_location: null, item_id: null, package_code: null, metrc_harvest_tag: null });
    const page3 = loadSiloPage({ barnLots: [untagged], silos, loads: [], picked: null, pickedLoad: null, nowIso: "2026-09-19T12:00:00.000Z" });
    expect(page3).toContain("<strong>26027 / PNS / Goji</strong>");
    expect(page3).not.toContain("<strong>? /");
    const es = loadSiloPage({ barnLots: [untagged], silos, loads: [], picked: untagged, pickedLoad: null, nowIso: "2026-09-19T12:00:00.000Z", locale: "es" });
    expect(es).toContain("Lotes programados");
    expect(es).toContain("(sin paquete vivo)");
    expect(es).toContain("Este lote no tiene paquete vivo en el libro");
  });

  it("the load moves the package from wherever it sits into the space, logged from that place", async () => {
    const db = fakeDb({ lots: [lotRow({ barn_location: "Trim Room 1" })], spaces: [SILO_3] });
    const out = await loadSilo(db as unknown as D1Database, loadForm("lot27", "s3"));
    expect(out.redirect).toMatch(/^\/station\/load_silo\?load=.+&ok=loaded$/);
    const move = db.batched.find((b) => b.sql.includes("UPDATE local_inventory_items SET location = ?"));
    expect(move).toBeDefined();
    expect(move!.args[0]).toBe("Silo 3");
    expect(move!.args[3]).toBe("item27");
    const log = db.batched.find((b) => b.sql.includes("INSERT INTO record_change_log") && b.args.includes("Trim Room 1"));
    expect(log).toBeDefined();
    expect(log!.args).toContain("Silo 3");
    expect(log!.args).toContain(SYSTEM_REASON.silo_load);
    // A drying lot's status is left alone.
    expect(db.batched.some((b) => b.sql.includes("UPDATE wet_weight_entries SET status"))).toBe(false);
  });

  it("a lot whose HBN is another farm's loads the Arlington Dry Room: no site refusal stands", async () => {
    const db = fakeDb({ lots: [lotRow({ farm_code: "PNS", barn_location: "BARN" })], spaces: [ARL_ROOM] });
    const out = await loadSilo(db as unknown as D1Database, loadForm("lot27", "arl"));
    expect(out.redirect).toContain("ok=loaded");
    const move = db.batched.find((b) => b.sql.includes("UPDATE local_inventory_items SET location = ?"));
    expect(move!.args[0]).toBe("Arlington Dry Room");
  });

  it("a package already sitting at the space's location moves nowhere and writes no location line", async () => {
    const db = fakeDb({ lots: [lotRow({ barn_location: "Silo 3" })], spaces: [SILO_3] });
    await loadSilo(db as unknown as D1Database, loadForm("lot27", "s3"));
    expect(db.batched.some((b) => b.sql.includes("UPDATE local_inventory_items SET location = ?"))).toBe(false);
    expect(db.batched.some((b) => b.sql.includes("INSERT INTO silo_loads"))).toBe(true);
  });

  it("a truck-era lot still in transit arrives by the load: its status goes drying under the load's reason", async () => {
    const db = fakeDb({ lots: [lotRow({ status: LOT_STATUS.in_transit, barn_location: "IN-TRANSIT" })], spaces: [SILO_3] });
    await loadSilo(db as unknown as D1Database, loadForm("lot27", "s3"));
    const status = db.batched.find((b) => b.sql.includes("UPDATE wet_weight_entries SET status = ?"));
    expect(status).toBeDefined();
    expect(status!.args[0]).toBe(LOT_STATUS.drying);
    const log = db.batched.find((b) => b.sql.includes("INSERT INTO record_change_log") && b.args.includes(LOT_STATUS.in_transit));
    expect(log).toBeDefined();
    expect(log!.args).toContain(LOT_STATUS.drying);
    expect(log!.args).toContain(SYSTEM_REASON.silo_load);
  });

  it("a lot without a live package is named in words, and a lot the pane does not hold refuses in words", async () => {
    const db = fakeDb({ lots: [lotRow({ barn_location: null, item_id: null, package_code: null })], spaces: [SILO_3] });
    await expect(loadSilo(db as unknown as D1Database, loadForm("lot27", "s3"))).rejects.toThrow(
      "Lot 26027 has no live package in the ledger to move (voided or closed); restore it or repair the lot before loading."
    );
    expect(db.batched).toHaveLength(0);
    const none = fakeDb({ lots: [], spaces: [SILO_3] });
    await expect(loadSilo(none as unknown as D1Database, loadForm("lot27", "s3"))).rejects.toThrow(
      "That lot is not waiting for a dry space: Finish lot has not run on it, or a load already holds it."
    );
  });
});
