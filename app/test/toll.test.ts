import { describe, expect, it } from "vitest";
import { createHarvestBatch, editRecord, manualHbn } from "../src/actions";
import { loadHarvestConsole } from "../src/console";
import { listHarvestsByYear, listQueueRows, listSeasonToll } from "../src/db";
import { dryStrainView, type DryStrainLot } from "../src/drystrain";
import { buildFloorVsMetrc, floorVsMetrcPage } from "../src/floormetrc";
import { harvestReconcileView, loadHarvestReconciliation, type HarvestReconcileModel } from "../src/harvestreconciliation";
import { queueSection } from "../src/html";
import { t } from "../src/i18n";
import { editPage, manualHbnPage } from "../src/pages";
import { listUncountedLots } from "../src/plantcounts";
import { queueByKey } from "../src/pipeline";
import { harvestsView, reportCsv } from "../src/reports";
import { ownLotSql, tollLine, tollLotSql, TOLL_BOTH } from "../src/toll";
import { formOf, migratedDb, seedBatch, seedLot, seedPerson } from "./migrated";

/** TOLL LOTS (canon 0.30.431). */

const STRAIN = "98cf3164-344e-414a-9f1c-1526fde445ac";

function manualForm(person: string, over: Record<string, string> = {}): FormData {
  return formOf({
    person_id: person,
    hbn: "GreenCo-Toll-26111",
    entry_date: "2026-10-07",
    farm_code: "PNN",
    grow_method_code: "GH",
    strain_id: STRAIN,
    planned_dryspc: "1",
    material_form: "bucked",
    reason: "toll lot",
    ...over,
  });
}

function acquire(person: string): FormData {
  return formOf({
    person_id: person,
    entry_date: "2026-10-07",
    farm_code: "PNN",
    grow_method_code: "GH",
    strain_id: STRAIN,
    planned_dryspc: "1",
    material_form: "bucked",
  });
}

const dryLot = (over: Partial<DryStrainLot>): DryStrainLot => ({
  lotId: over.lotId ?? "lot",
  harvestYear: 2026,
  lotSerial: 10,
  farm: "PNN",
  growMethod: "GH",
  strain: "Fruity Pebbles",
  marketStrain: "Fruity Pebbles",
  wetGrams: 4480,
  dryGrams: 1000,
  plantCount: 10,
  effectiveDate: null,
  finishedAt: "2026-09-20T15:00:00.000Z",
  ...over,
});

describe("TOLL LOTS (canon 0.30.431)", () => {
  it("the shared fragment keeps a plain lot and leaves out a test and a toll lot", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "plain", hbn: "26280-PNN-GH-027-0-02-26105", serial: 105, farm: "PNN" });
    seedBatch(m, { id: "test", hbn: "SmokeTest-25901", serial: 90001, farm: "PNN" });
    seedBatch(m, { id: "toll", hbn: "GreenCo-Toll-26111", serial: 106, farm: "PNN" });
    m.run(`UPDATE harvest_batches SET is_test = 1 WHERE id = 'test'`);
    m.run(`UPDATE harvest_batches SET customer = 'GreenCo' WHERE id = 'toll'`);
    const own = m.all(`SELECT id FROM harvest_batches WHERE ${ownLotSql("")} ORDER BY id`);
    const toll = m.all(`SELECT id FROM harvest_batches WHERE ${tollLotSql("")} ORDER BY id`);
    expect(own.map((row) => row.id)).toEqual(["plain"]);
    expect(toll.map((row) => row.id)).toEqual(["toll"]);
  });

  it("a manual HBN with a customer takes the next serial in the line and shows the customer", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-105", hbn: "26280-PNN-GH-027-0-02-26105", serial: 105, farm: "PNN" });
    const page = manualHbnPage({ farms: [], licenses: [], grow_methods: [], strains: [] }, "en");
    expect(page).toContain('name="customer"');
    expect(page).toContain("Customer (toll lot)");
    expect(manualHbnPage({ farms: [], licenses: [], grow_methods: [], strains: [] }, "es")).toContain("Cliente (lote de cliente)");
    await manualHbn(m.db, manualForm(person, { customer: "GreenCo" }));
    expect(m.get(`SELECT lot_serial, is_test, customer FROM harvest_batches WHERE hbn = 'GreenCo-Toll-26111'`)).toEqual({
      lot_serial: 106,
      is_test: 0,
      customer: "GreenCo",
    });
    await createHarvestBatch(m.db, acquire(person));
    expect(m.get(`SELECT lot_serial FROM harvest_batches WHERE hbn LIKE '%-26107'`)).toEqual({ lot_serial: 107 });
    const queue = queueByKey("hbn_queue")!;
    const html = queueSection(queue, await listQueueRows(m.db, queue), "en");
    expect(html).toContain("GreenCo-Toll-26111 GreenCo");
    expect(html).toContain('data-hbn-customer="GreenCo"');
    expect(html).not.toContain("26280-PNN-GH-027-0-02-26105 GreenCo");
  });

  it("refuses a customer and the test box together, in words", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    await expect(manualHbn(m.db, manualForm(person, { customer: "GreenCo", is_test: "1" }))).rejects.toMatchObject({
      status: 400,
      message: TOLL_BOTH,
    });
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches WHERE hbn = 'GreenCo-Toll-26111'`)?.n).toBe(0);
    expect(t("es", TOLL_BOTH)).toBe("Un lote no puede ser de prueba y de cliente a la vez.");
    seedBatch(m, { id: "hb-test", hbn: "SmokeTest-25901", serial: 90001, farm: "PNN" });
    m.run(`UPDATE harvest_batches SET is_test = 1 WHERE id = 'hb-test'`);
    const edit = editPage("harvest_batches", "hb-test", { customer: null, is_test: 1, manicure: 0 }, {});
    expect(edit).toContain('name="customer"');
    expect(edit).toContain("Customer (toll lot)");
    await expect(
      editRecord(m.db, "harvest_batches", "hb-test", formOf({ person_id: person, customer: "GreenCo", reason: "toll" }))
    ).rejects.toMatchObject({ status: 400, message: TOLL_BOTH });
    expect(m.get(`SELECT customer FROM harvest_batches WHERE id = 'hb-test'`)?.customer ?? null).toBeNull();
  });

  it("Dry Weight by Strain leaves a toll lot out of the rows and the Total and prints the toll line", () => {
    const lots = [
      dryLot({ lotId: "own", lotSerial: 11, dryGrams: 1000 }),
      dryLot({ lotId: "toll", lotSerial: 12, dryGrams: 2000, strain: "Other Cake", customer: "GreenCo" }),
      dryLot({ lotId: "other", lotSerial: 13, dryGrams: 500, customer: "Northwind" }),
    ];
    const view = dryStrainView(lots, { from: "2026-09-01", to: "2026-09-30", strain: "", growMethod: "", farm: "" });
    expect(view.rows.map((row) => row.strain)).toEqual([
      "Fruity Pebbles",
      "Total",
      "Toll lots: GreenCo 1 lots, 2,000 g dry",
      "Toll lots: Northwind 1 lots, 500 g dry",
    ]);
    const total = view.rows[1];
    expect(total.lots).toBe(1);
    expect(total.dry_lbs).toBe(1000);
    expect(view.rows.some((row) => row.strain === "Other Cake")).toBe(false);
    const csv = reportCsv(view);
    expect(csv).toContain("Toll lots: GreenCo 1 lots, 2,000 g dry");
    expect(csv).toContain("Toll lots: Northwind 1 lots, 500 g dry");
    expect(tollLine("GreenCo", 1, 2000)).toBe("Toll lots: GreenCo 1 lots, 2,000 g dry");
  });

  it("the console totals leave a toll lot out, and the season report prints the line", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-live", hbn: "26280-PNN-GH-027-0-02-26105", serial: 105, farm: "PNN" });
    seedBatch(m, { id: "hb-toll", hbn: "GreenCo-Toll-26111", serial: 106, farm: "PNN" });
    m.run(`UPDATE harvest_batches SET customer = 'GreenCo' WHERE id = 'hb-toll'`);
    seedLot(m, "lot-live", "hb-live", "drying");
    seedLot(m, "lot-toll", "hb-toll", "drying");
    m.run(`UPDATE wet_weight_entries SET plant_count = 10 WHERE id = 'lot-live'`);
    m.run(`UPDATE wet_weight_entries SET plant_count = 40 WHERE id = 'lot-toll'`);
    const at = "2026-10-07T16:00:00.000Z";
    m.run(
      `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES ('w-live', 'lot-live', 448, ?, ?)`,
      at,
      at
    );
    m.run(
      `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES ('w-toll', 'lot-toll', 896, ?, ?)`,
      at,
      at
    );
    const loaded = await loadHarvestConsole(m.db, at);
    expect(loaded.seasonHarvested.reduce((n, row) => n + row.plants, 0)).toBe(10);
    expect(loaded.seasonLots).toHaveLength(1);
    expect(loaded.yearWet?.reduce((n, row) => n + row.wet_grams, 0)).toBe(448);
    expect(loaded.dayWet.reduce((n, row) => n + row.wet_grams, 0)).toBe(1344);
    seedLot(m, "lot-open", "hb-toll", "weighing");
    const left = await listUncountedLots(m.db, 2026);
    expect(left.map((row) => row.id)).not.toContain("lot-open");
    const years = await listHarvestsByYear(m.db);
    const year = years.find((row) => row.harvest_year === 2026);
    expect(year?.batches).toBe(1);
    const toll = await listSeasonToll(m.db);
    expect(toll).toEqual([{ customer: "GreenCo", lots: 1, dryGrams: 800 }]);
    const view = harvestsView(years, toll);
    expect(view.rows.map((row) => row.harvest_year)).toContain("Toll lots: GreenCo 1 lots, 800 g dry");
    expect(view.rows.filter((row) => row._toll === "1")).toHaveLength(1);
  });

  it("Floor vs METRC and the harvest reconciliation keep a toll lot in a section of its own", async () => {
    const model = buildFloorVsMetrc({
      items: [
        {
          itemKind: "WIP",
          tag: "1A40503000311FB0000000T2",
          qty: 5,
          uom: "g",
          location: "Silo 1",
          license: "AU-G-C-000832",
          lot: "26020",
          batchId: "toll",
        },
      ],
      mirror: [
        {
          tag: "1A40503000311FB0000000T1",
          quantity: 10,
          uom: "g",
          location: "Silo 1",
          license: "AU-G-C-000832",
          item: "SPR - T",
          sourceHarvests: "TollHbn-26020",
        },
      ],
      batches: [
        { batchId: "own", hbn: "OwnHbn-26019", lot: "26019", state: "drying", harvestYear: 2026, voided: false },
        { batchId: "toll", hbn: "TollHbn-26020", lot: "26020", state: "drying", harvestYear: 2026, voided: false, customer: "GreenCo" },
      ],
      spr: [
        { batchId: "own", qty: 10, uom: "g", location: "Silo 1" },
        { batchId: "toll", qty: 20, uom: "g", location: "Silo 1" },
      ],
      uploads: [],
      harvestYear: 2026,
    });
    expect(model.lots.map((row) => row.hbn)).toEqual(["OwnHbn-26019"]);
    expect(model.tollLots.map((row) => row.hbn)).toEqual(["TollHbn-26020"]);
    expect(model.packages).toHaveLength(0);
    expect(model.tollPackages.map((row) => row.tag)).toEqual(["1A40503000311FB0000000T2"]);
    const page = floorVsMetrcPage({
      changedAt: null,
      packages: model.packages,
      lots: model.lots,
      tollPackages: model.tollPackages,
      tollLots: model.tollLots,
      filter: { finding: "all", itemKind: "", lot: "" },
      locale: "en",
    });
    expect(page).toContain('data-floor-toll="1"');
    expect(page).toContain("TollHbn-26020");
    expect(page.indexOf("Lot packages")).toBeLessThan(page.indexOf('data-floor-toll="1"'));

    const m = await migratedDb();
    const ts = "2026-09-20T15:00:00.000Z";
    m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('s-toll', 'Toll Strain', '099', ?, ?)`, ts, ts);
    const batch = (id: string, serial: number, hbn: string, customer: string | null) => {
      m.run(
        `INSERT INTO harvest_batches (
           id, entry_date, farm_code, grow_method_code, strain_id, manicure, hbn, lot_serial, harvest_year, status,
           market_strain, created_at, updated_at
         ) VALUES (?, '2026-09-20', 'PNN', 'GH', 's-toll', 0, ?, ?, 2026, 'open', 'Toll Strain', ?, ?)`,
        id,
        hbn,
        serial,
        ts,
        ts
      );
      if (customer) m.run(`UPDATE harvest_batches SET customer = ? WHERE id = ?`, customer, id);
    };
    batch("b-own", 19, "26263-PNN-GH-099-0-NA-26019", null);
    batch("b-toll", 20, "26263-PNN-GH-099-0-NA-26020", "GreenCo");
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, created_at, updated_at) VALUES ('w-own', 'b-own', 448, 'silo', 'drying', ?, ?)`,
      ts,
      ts
    );
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, created_at, updated_at) VALUES ('w-toll', 'b-toll', 896, 'silo', 'drying', ?, ?)`,
      ts,
      ts
    );
    const loaded = await loadHarvestReconciliation(m.db, new URLSearchParams({ from: "2026-09-01", to: "2026-09-30" }), "2026-10-12");
    const ids = loaded.view.rows.filter((row) => row._total !== "1").map((row) => row.short_id);
    expect(ids).toEqual(["26019"]);
    expect(loaded.view.belowTable).toContain('data-reconcile-toll="1"');
    expect(loaded.view.belowTable).toContain("26020");
    expect(loaded.view.belowTable).toContain("GreenCo");
    expect(loaded.view.rows[1]?.short_id).toBe("Wet total");
    expect(loaded.csv).toContain("Toll lots");
    expect(loaded.csv).toContain("26020,GreenCo");
    const bare: HarvestReconcileModel = {
      from: "2026-09-01",
      to: "2026-09-30",
      farm: "",
      grow: "",
      lots: [],
      tollLots: [
        {
          lotId: "w-toll",
          hbn: "26263-PNN-GH-099-0-NA-26020",
          entryDate: "2026-09-20",
          farm: "PNN",
          growMethod: "GH",
          strain: "Toll Strain",
          marketStrain: "",
          wetGrams: 896,
          dryGrams: 200,
          metrcPounds: null,
          metrcUom: "",
          metrcMatched: false,
          customer: "GreenCo",
        },
      ],
      metrcOnly: [],
      hours: 0,
    };
    expect(harvestReconcileView(bare).rows).toEqual([]);
    expect(harvestReconcileView(bare).belowTable).toContain("GreenCo");
  });
});
