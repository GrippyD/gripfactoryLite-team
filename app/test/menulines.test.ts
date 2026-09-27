import { describe, expect, it } from "vitest";
import type { MenuDryingLoad, MenuEntryRow } from "../src/db";
import { dryingMenuLines, harvestMenuLines, menuLineMarkup, truckMenuLines, type OpsMenuLine } from "../src/drying";
import { farmDayBounds } from "../src/farmday";
import { homePage } from "../src/html";
import { themeStylesheet } from "../src/theme";

const NOW = "2026-09-26T16:00:00.000Z";
const START = farmDayBounds("2026-09-26", 6).startIso;

function entry(over: Partial<MenuEntryRow> & Pick<MenuEntryRow, "id" | "harvest_batch_id" | "created_at">): MenuEntryRow {
  return {
    status: "drying",
    updated_at: over.created_at,
    truck_number: null,
    loaded: 0,
    transit_at: null,
    ...over,
  };
}

function load(over: Partial<MenuDryingLoad> & Pick<MenuDryingLoad, "id" | "space_id" | "space_name">): MenuDryingLoad {
  return {
    space_type: "silo",
    loaded_at: NOW,
    started_at: NOW,
    paused_at: null,
    paused_seconds: 0,
    ...over,
  };
}

describe("THE MENU LINES (canon 0.30.241)", () => {
  it("draws a half-height line under the three named buttons and none under the others", () => {
    const line = menuLineMarkup({ name: "Lot 1", status: "in progress", clock: null }, "en");
    expect(line).toContain('class="ops-menu-line"');
    expect(line).toContain('class="ops-menu-name">Lot 1</span>');
    expect(line).toContain('class="ops-menu-dots"');
    expect(line).toContain('class="ops-menu-status">in progress</span>');
    const html = homePage(undefined, "en", "lite", {
      harvest_ops: line,
      interco_logistics: menuLineMarkup({ name: "Truck 1", status: "in-transit", clock: null }, "en"),
      drying_ops: menuLineMarkup({ name: "Silo 1", status: "drying", clock: null }, "en"),
    });
    for (const key of ["harvest_ops", "interco_logistics", "drying_ops"]) {
      const node = html.slice(html.indexOf(`data-ops-key="${key}"`), html.indexOf("data-ops-key=", html.indexOf(`data-ops-key="${key}"`) + 12));
      expect(node).toContain("ops-menu-line");
    }
    const market = html.slice(html.indexOf('data-ops-key="marketplace"'), html.indexOf('data-ops-key="business_ops"'));
    expect(market).not.toContain("ops-menu-line");
    expect(html).toContain('class="ops-menu-dots"');
  });

  it("numbers today's lots by the first load and leaves a lot that began yesterday", () => {
    const before = new Date(Date.parse(START) - 60 * 60 * 1000).toISOString();
    const first = new Date(Date.parse(START) + 60 * 60 * 1000).toISOString();
    const second = new Date(Date.parse(START) + 2 * 60 * 60 * 1000).toISOString();
    const third = new Date(Date.parse(START) + 3 * 60 * 60 * 1000).toISOString();
    const entries = [
      entry({ id: "old", harvest_batch_id: "hb-old", created_at: before, status: "weighing" }),
      entry({ id: "c", harvest_batch_id: "hb-c", created_at: third, loaded: 1 }),
      entry({ id: "b", harvest_batch_id: "hb-b", created_at: second }),
      entry({ id: "a", harvest_batch_id: "hb-a", created_at: first, status: "weighing" }),
    ];
    const lines = harvestMenuLines(entries, new Set(["hb-b"]), NOW, 6);
    expect(lines.map((line) => `${line.name} ${line.status}`)).toEqual(["Lot 1 in progress", "Lot 2 ready to be moved"]);
    expect(harvestMenuLines(entries, new Set(["hb-b"]), NOW, 6, "es").map((line) => line.name)).toEqual(["Lote 1", "Lote 2"]);
  });

  it("lines only a part that is in_transit, from its Finish load until it is loaded", () => {
    const finished = new Date(Date.parse(NOW) - 2 * 60 * 60 * 1000).toISOString();
    const edited = NOW;
    const rows = [
      entry({ id: "site", harvest_batch_id: "hb-site", created_at: finished, updated_at: finished, status: "drying" }),
      entry({ id: "old", harvest_batch_id: "hb-old", created_at: finished, updated_at: finished, status: "unloaded" }),
      entry({
        id: "road",
        harvest_batch_id: "hb-road",
        created_at: finished,
        updated_at: edited,
        status: "in_transit",
        truck_number: "4",
        transit_at: finished,
      }),
      entry({ id: "bare", harvest_batch_id: "hb-bare", created_at: finished, updated_at: finished, status: "in_transit", truck_number: "  ", transit_at: finished }),
    ];
    const lines = truckMenuLines(rows, NOW);
    expect(lines.map((line) => line.name)).toEqual(["Truck", "Truck 4"]);
    const truck = lines.find((line) => line.name === "Truck 4") as OpsMenuLine;
    expect(truck.clock?.started).toBe(Date.parse(finished));
    expect(truck.clock?.started).not.toBe(Date.parse(edited));
    const loaded = truckMenuLines(rows.map((row) => (row.id === "road" ? { ...row, status: "drying", loaded: 1 } : row)), NOW);
    expect(loaded.map((line) => line.name)).toEqual(["Truck"]);
  });

  it("keeps each line's status whole at a phone width in every skin", () => {
    for (const view of ["lite", "co", "cerberus"] as const) {
      const css = themeStylesheet(view);
      expect(css).toContain("@media (max-width: 480px)");
      expect(css).toContain(".ops-menu-name, .ops-menu-status { flex: 1 0 100%; white-space: normal;");
    }
  });

  it("lines each drying space by its longest clock and leaves freezers off", () => {
    const older = new Date(Date.parse(NOW) - 5 * 60 * 60 * 1000).toISOString();
    const newer = new Date(Date.parse(NOW) - 60 * 60 * 1000).toISOString();
    const loads = [
      load({ id: "f", space_id: "bf", space_name: "Blast Freezer(s)", space_type: "freezer", loaded_at: older }),
      load({ id: "s1", space_id: "silo", space_name: "Silo 2", loaded_at: newer }),
      load({ id: "s2", space_id: "silo", space_name: "Silo 2", loaded_at: older, paused_at: NOW, paused_seconds: 0 }),
      load({ id: "room", space_id: "arl", space_name: "Arlington Dry Room", space_type: "dry_room", loaded_at: newer }),
    ];
    const lines = dryingMenuLines(loads, NOW);
    expect(lines.map((line) => line.name)).toEqual(["Arlington Dry Room", "Silo 2"]);
    const silo = lines.find((line) => line.name === "Silo 2") as OpsMenuLine;
    expect(silo.status).toBe("drying");
    expect(silo.clock?.state).toBe("paused");
    expect(silo.clock?.text.startsWith("0d 05:")).toBe(true);
  });
});
