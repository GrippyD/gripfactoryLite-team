import { describe, expect, it } from "vitest";
import { cureMembership, cureSpaceCap, listCurePanes } from "../src/cure";
import { dryingRowTotals, siloStrip, type DryingStripFigures } from "../src/drying";
import { listSilos } from "../src/db";
import { LB_GRAMS, siloVisual, type SiloLive } from "../src/silo";
import { migratedDb } from "./migrated";

const CAP = 15000 * LB_GRAMS;

function space(id: string, name: string, type: "silo" | "freezer" | "dry_room", grams = 0): SiloLive {
  return {
    silo: { id, name, space_type: type, shape: type === "freezer" ? "cube" : type === "dry_room" ? "box" : "cylinder" },
    visual: siloVisual({
      fillingGrams: 0,
      fillingLots: 0,
      awaitingGrams: 0,
      loadedGrams: grams,
      clock: grams ? "running" : null,
      capacityGrams: CAP,
      freezer: type === "freezer",
    }),
    loads: grams
      ? [
          {
            id: `L-${id}`,
            dry_space_id: id,
            weight_grams: grams,
            loaded_at: "2026-10-01T12:00:00.000Z",
            started_at: null,
            paused_at: null,
            paused_seconds: 0,
            hbn: "26001",
            metrc_harvest_tag: null,
            strain_label: null,
          } as SiloLive["loads"][number],
        ]
      : [],
    waiting: [],
    emptySince: null,
  };
}

const cure =
  '<div class="inv-gauge cure-pane" data-cure-pane="CSA"></div><div class="inv-gauge cure-pane" data-cure-pane="CSB"></div>';

describe("THE ROWS (canon 0.30.383)", () => {
  it("draws Silo, Freezer, Cure Space, Dry Room, skips an empty row, and arrows only past five", () => {
    const five = [1, 2, 3, 4, 5].map((n) => space(`s${n}`, `Silo ${n}`, "silo"));
    const folded = siloStrip(five, "2026-10-03T12:00:00.000Z");
    expect(folded).toContain('data-dry-row="silo"');
    expect(folded).not.toContain('data-dry-row="freezer"');
    expect(folded).not.toContain('data-dry-row="cure"');
    expect(folded).not.toContain('data-dry-row="dry_room"');
    expect(folded).not.toContain('data-dry-arrow="prev"');
    expect(folded).toContain('aria-expanded="false"');
    expect(folded).toContain("data-dry-icon");
    expect(folded).toContain("data-dry-status");
    expect(folded).toContain("data-dry-weight");

    const seven = [1, 2, 3, 4, 5, 6, 7].map((n) => space(`s${n}`, `Silo ${n}`, "silo", n === 1 ? 4480 : 0));
    const wide = siloStrip(seven, "2026-10-03T12:00:00.000Z", "en", "", {}, { dryYieldPct: 22 });
    expect(wide).toContain('data-dry-arrow="prev"');
    expect(wide).toContain('data-dry-arrow="next"');
    expect(wide).toContain('aria-label="Scroll back"');
    expect(wide).toContain('aria-label="Scroll forward"');
    expect(siloStrip(seven, "2026-10-03T12:00:00.000Z", "es")).toContain('aria-label="Desplazar atras"');

    const mixed = [
      space("s1", "Silo 1", "silo", 4480),
      space("bf", "Blast Freezer(s)", "freezer", 800),
      space("room", "Arlington Dry Room", "dry_room", 2240),
    ];
    const figures: DryingStripFigures = { hangGrams: 448, hangLots: 1, cureGrams: 1344, cureLots: 3, dryYieldPct: 22 };
    const html = siloStrip(mixed, "2026-10-03T12:00:00.000Z", "en", cure, {}, figures);
    const order = ["silo", "freezer", "cure", "dry_room"].map((key) => html.indexOf(`data-dry-row="${key}"`));
    expect(order.every((n) => n >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).not.toContain("data-ffz");
    expect(html).not.toContain("FFZ Inventory");
    expect(html).not.toContain("Fresh Frozen");
    expect(html).toContain('data-silo="bf"');
    expect(html).not.toContain('data-dry-total="freezer"');
    expect(html.indexOf('data-cure-pane="CSA"')).toBeLessThan(html.indexOf('data-cure-pane="CSB"'));
    expect(html.indexOf('data-dry-row="cure"')).toBeLessThan(html.indexOf('data-silo="room"'));

    const totals = dryingRowTotals(mixed, figures);
    expect(totals.siloGrams).toBe(4480);
    expect(totals.siloLots).toBe(1);
    expect(totals.estimateGrams).toBe(Math.round((4480 * 22) / 100));
    expect(html).toContain('data-dry-total="silo"');
    expect(html).toContain("Drying in Silos");
    expect(html).toContain("est. dry");
    expect(html).toContain('data-dry-total="cure" data-dry-total-grams="1344" data-dry-total-lots="3"');
    expect(html).toContain("Curing");
    expect(html).toContain('data-dry-total="dry_room"');
    expect(html).toContain('data-dry-hang-grams="448"');
    expect(totals.hangTotalGrams).toBe(2240 + 448);
    expect(totals.hangTotalLots).toBe(2);
    expect(html).toContain("Hang Drying");
    expect(siloStrip(mixed, "2026-10-03T12:00:00.000Z", "es", cure, {}, figures)).toContain("Secando en silos");
    expect(siloStrip(mixed, "2026-10-03T12:00:00.000Z", "es", cure, {}, figures)).not.toContain("Fresco congelado");
    expect(siloStrip(mixed, "2026-10-03T12:00:00.000Z", "es", cure, {}, figures)).toContain("Curando");
    expect(siloStrip(mixed, "2026-10-03T12:00:00.000Z", "es", cure, {}, figures)).toContain("Secado colgado");
  });

  it("the dashboard strip is one open row, and no strip carries the cube", () => {
    const mixed = [
      space("s1", "Silo 1", "silo", 4480),
      space("bf", "Blast Freezer(s)", "freezer", 800),
      space("room", "Arlington Dry Room", "dry_room", 2240),
    ];
    const open = siloStrip(mixed, "2026-10-03T12:00:00.000Z", "en", cure, {}, {}, "open");
    expect(open).not.toContain("data-dry-head");
    expect(open).not.toContain("data-dry-row");
    expect(open).not.toContain("data-dry-total");
    expect(open).not.toContain("data-ffz");
    expect(open).not.toContain("FFZ Inventory");
    expect(open).not.toContain("Fresh Frozen");
    expect(open.indexOf('data-silo="s1"')).toBeLessThan(open.indexOf('data-silo="bf"'));
    expect(open.indexOf('data-silo="bf"')).toBeLessThan(open.indexOf('data-silo="room"'));
    expect(open.indexOf('data-silo="room"')).toBeLessThan(open.indexOf('data-cure-pane="CSA"'));
    expect(open).toContain('class="inv-gauge-name">Silo 1</div>');
    expect(open).toContain('data-silo="bf"');
    const rows = siloStrip(mixed, "2026-10-03T12:00:00.000Z", "en", cure);
    expect(rows).toContain("data-dry-row");
    expect(rows).toContain("data-dry-head");
    expect(rows).not.toContain("data-ffz");
  });

  it("keeps cure membership as it stands", () => {
    expect(cureMembership({ status: "unloaded", deleted: false, trimStatus: null })).toBe("CSA");
    expect(cureMembership({ status: "unloaded", deleted: false, trimStatus: "scheduled" })).toBe("CSB");
    expect(cureMembership({ status: "unloaded", deleted: false, trimStatus: "complete" })).toBeNull();
    expect(cureMembership({ status: "drying", deleted: false, trimStatus: null })).toBeNull();
  });
});

describe("0091 cure spaces", () => {
  it("seeds CSA and CSB once, and the panes read the space", async () => {
    const m = await migratedDb();
    const rows = m.all(`SELECT name, kind, space_type, capacity, capacity_uom, location_name, farm_code FROM dry_spaces WHERE name IN ('CSA', 'CSB') ORDER BY name`);
    expect(rows).toEqual([
      { name: "CSA", kind: "cure", space_type: "cure", capacity: 36, capacity_uom: "ea", location_name: "Cold Storage A", farm_code: "PNN" },
      { name: "CSB", kind: "cure", space_type: "cure", capacity: 8, capacity_uom: "ea", location_name: "Cold Storage B", farm_code: "PNN" },
    ]);
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const sql = fs.readFileSync(new URL("../migrations/0091_cure_spaces.sql", import.meta.url), "utf8");
    const statements = sql
      .split(";")
      .map((part: string) => part.split("\n").filter((line: string) => !line.trim().startsWith("--")).join("\n").trim())
      .filter((part: string) => part.startsWith("INSERT"));
    for (const statement of statements) m.run(statement);
    expect(m.all(`SELECT name FROM dry_spaces WHERE name IN ('CSA', 'CSB') ORDER BY name`).map((row) => row.name)).toEqual(["CSA", "CSB"]);
    const silos = await listSilos(m.db);
    expect(silos.some((row) => row.name === "CSA" || row.name === "CSB")).toBe(false);
    expect((await cureSpaceCap(m.db, "CSA")).value).toBe(36);
    const panes = await listCurePanes(m.db, "2026-10-03T12:00:00.000Z");
    expect(panes.caps).toEqual({ CSA: 36, CSB: 8 });
  });
});
