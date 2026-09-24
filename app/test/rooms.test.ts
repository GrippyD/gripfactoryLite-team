import { describe, expect, it } from "vitest";
import { loadSilo } from "../src/actions";
import { LOT_STATUS, spaceHoldsOneLot } from "../src/config";
import type { BarnWetLotRow, SiloLoadRow, SiloRow } from "../src/db";
import { loadSiloPage } from "../src/drying";

/** A D1 stand-in for the load: the space's open load answers the occupant
 * query (l.dry_space_id = ?), the lot's own open-load query answers none. */
function fakeDb(input: { lot: Record<string, unknown>; space: Record<string, unknown>; occupant: Record<string, unknown> | null }) {
  const batched: Array<{ sql: string; args: unknown[] }> = [];
  function stmt(sql: string) {
    const args: unknown[] = [];
    const self = {
      bind(...next: unknown[]) {
        args.push(...next);
        return self;
      },
      async all() {
        if (sql.includes("FROM wet_weight_entries w") && sql.includes("AS barn_location")) return { results: [input.lot] };
        return { results: [] };
      },
      async first() {
        if (sql.includes("FROM people WHERE id = ?")) return { id: args[0], display_name: "Crew", is_active: 1 };
        if (sql.includes("FROM dry_spaces WHERE id = ?")) return input.space.id === args[0] ? input.space : null;
        if (sql.includes("FROM silo_loads l") && sql.includes("l.dry_space_id = ?")) return input.occupant;
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
    batched,
  };
}

const LOT: BarnWetLotRow = {
  id: "lot28",
  status: LOT_STATUS.drying,
  barn_location: "BARN",
  hbn: "26261-PNN-OD-029-0-01-26028",
  metrc_harvest_tag: null,
  farm_code: "PNN",
  strain_label: "Goji",
  entry_date: "2026-09-20",
  weight_grams: 36287.39,
  material_form: "bucked",
  actual_dryspc: "bf",
  planned_space_name: "Blast Freezer(s)",
  planned_space_kind: "silo",
  planned_silo_id: null,
  package_code: "26028",
  item_id: "item28",
  lead_name: "Lead",
  supervisor_name: "crew@local",
  notes: null,
  plant_count: 12,
};

const FREEZER = { id: "bf", name: "Blast Freezer(s)", kind: "silo", farm_code: "PNN", location_name: "Blast Freezer", space_type: "freezer" };
const ROOM = { id: "arl", name: "Arlington Dry Room", kind: "silo", farm_code: "ARL", location_name: null, space_type: "dry_room" };
const SILO_4 = { id: "s4", name: "Silo 4", kind: "silo", farm_code: "PNN", location_name: null, space_type: "silo" };
const OCCUPANT = { id: "L1", dry_space_id: "bf", hbn: "26261-PNN-OD-029-0-01-26027", metrc_harvest_tag: null, ended_at: null };

function loadForm(spaceId: string): FormData {
  const form = new FormData();
  form.set("person_id", "p1");
  form.set("lot_id", "lot28");
  form.set("dry_space_id", spaceId);
  form.set("start_time", "");
  form.set("loaded_at_iso", "");
  return form;
}

function load(over: Partial<SiloLoadRow>): SiloLoadRow {
  return {
    id: "L1",
    dry_space_id: "bf",
    silo_name: "Blast Freezer(s)",
    wet_weight_entry_id: "lot27",
    hbn: "26261-PNN-OD-029-0-01-26027",
    metrc_harvest_tag: null,
    strain_label: "Goji",
    farm_code: "PNN",
    weight_grams: 90718.47,
    loaded_at: "2026-09-20T10:00:00.000Z",
    started_at: "2026-09-20T10:00:00.000Z",
    paused_at: null,
    paused_seconds: 0,
    ended_at: null,
    notes: null,
    ...over,
  };
}

describe("THE ROOM HOLDS MANY (canon 0.30.132; owner: Dry rooms and freezers must be able to contain multiple lots)", () => {
  it("the one-load law binds a silo alone", () => {
    expect(spaceHoldsOneLot("silo")).toBe(true);
    expect(spaceHoldsOneLot(null)).toBe(true);
    expect(spaceHoldsOneLot(undefined)).toBe(true);
    expect(spaceHoldsOneLot("dry_room")).toBe(false);
    expect(spaceHoldsOneLot("freezer")).toBe(false);
  });

  it("the select keeps a loaded room or freezer open, counting what it holds, while a loaded silo greys with its occupant", () => {
    const silos: SiloRow[] = [
      { id: "s4", name: "Silo 4", farm_code: "PNN", space_type: "silo" },
      { id: "arl", name: "Arlington Dry Room", farm_code: "ARL", space_type: "dry_room" },
      { id: "bf", name: "Blast Freezer(s)", farm_code: "PNN", space_type: "freezer", location_name: "Blast Freezer" },
    ];
    const loads = [
      load({ id: "L1", dry_space_id: "bf" }),
      load({ id: "L2", dry_space_id: "s4", wet_weight_entry_id: "lot20", hbn: "26261-PNN-OD-029-0-01-26020" }),
      load({ id: "L3", dry_space_id: "arl", wet_weight_entry_id: "lot21", hbn: "26261-ARL-OD-029-0-01-26021" }),
      load({ id: "L4", dry_space_id: "arl", wet_weight_entry_id: "lot22", hbn: "26261-ARL-OD-029-0-01-26022" }),
      // An ended load holds nothing.
      load({ id: "L5", dry_space_id: "bf", wet_weight_entry_id: "lot19", ended_at: "2026-09-20T11:00:00.000Z" }),
    ];
    const page = loadSiloPage({ barnLots: [LOT], silos, loads, picked: LOT, pickedLoad: null, nowIso: "2026-09-20T12:00:00.000Z" });
    expect(page).toContain('<option value="s4" disabled data-occupied>Silo 4 (occupied: 26020)</option>');
    expect(page).toContain('<option value="arl" data-holding="2">Arlington Dry Room (holding 2 lots)</option>');
    expect(page).toContain('<option value="bf" selected data-holding="1">Blast Freezer(s) (holding 1 lot)</option>');
    expect(page).not.toContain("data-silos-full");
    expect(page).toContain(">Load silo</button>");
    const es = loadSiloPage({ barnLots: [LOT], silos, loads, picked: LOT, pickedLoad: null, nowIso: "2026-09-20T12:00:00.000Z", locale: "es" });
    expect(es).toContain("Arlington Dry Room (con 2 lotes)</option>");
    expect(es).toContain("Blast Freezer(s) (con 1 lote)</option>");
    // Every silo full and no room: the banner and the waiting button stand as before.
    const silosOnly: SiloRow[] = [{ id: "s4", name: "Silo 4", farm_code: "PNN", space_type: "silo" }];
    const full = loadSiloPage({ barnLots: [LOT], silos: silosOnly, loads, picked: LOT, pickedLoad: null, nowIso: "2026-09-20T12:00:00.000Z" });
    expect(full).toContain("data-silos-full");
  });

  it("a freezer holding a lot takes the next one; a room too; a silo holding one still refuses in words", async () => {
    const freezer = fakeDb({ lot: LOT, space: FREEZER, occupant: OCCUPANT });
    const out = await loadSilo(freezer as unknown as D1Database, loadForm("bf"));
    expect(out.redirect).toContain("ok=loaded");
    expect(freezer.batched.some((b) => b.sql.includes("INSERT INTO silo_loads"))).toBe(true);
    const move = freezer.batched.find((b) => b.sql.includes("UPDATE local_inventory_items SET location = ?"));
    expect(move!.args[0]).toBe("Blast Freezer");

    const room = fakeDb({ lot: { ...LOT, actual_dryspc: "arl" }, space: ROOM, occupant: { ...OCCUPANT, dry_space_id: "arl" } });
    const out2 = await loadSilo(room as unknown as D1Database, loadForm("arl"));
    expect(out2.redirect).toContain("ok=loaded");

    const silo = fakeDb({ lot: { ...LOT, actual_dryspc: "s4" }, space: SILO_4, occupant: { ...OCCUPANT, dry_space_id: "s4" } });
    await expect(loadSilo(silo as unknown as D1Database, loadForm("s4"))).rejects.toThrow("Silo 4 is occupied by lot 26027. Unload it first.");
    expect(silo.batched).toHaveLength(0);
  });
});
