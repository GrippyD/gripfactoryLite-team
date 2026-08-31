import { describe, expect, it } from "vitest";
import { adminHomePage, homePage, lotPage, stationPage, type StationLedgerCtx } from "../src/html";
import {
  EDITABLE_FIELDS,
  PIPELINE,
  homeEntries,
  queueByKey,
  queues,
  stationByKey,
  type QueueDef,
} from "../src/pipeline";
import type { PersonRow, QueueRow } from "../src/db";

describe("surfaces (owner ruling 2026-08-27)", () => {
  it("home renders stations only, plus the Admin tile", () => {
    const html = homePage(PIPELINE);
    expect(html).not.toContain("data-count=");
    expect(html).not.toContain("/queue/");
    expect(html).toContain('data-pipeline-key="acquire_hbn"');
    expect(html).toContain('data-pipeline-key="admin"');
    expect(html).toContain('href="/admin"');
  });

  it("every queue lives on the admin surface, every station on home", () => {
    for (const q of queues()) expect(q.surface).toBe("admin");
    for (const e of homeEntries()) expect(e.kind).toBe("station");
    expect(homeEntries()).toHaveLength(4);
  });

  it("the Admin landing lists Data Queues first", () => {
    const html = adminHomePage();
    const dq = html.indexOf("Data Queues");
    const lk = html.indexOf("Lookups");
    expect(dq).toBeGreaterThan(-1);
    expect(lk).toBeGreaterThan(-1);
    expect(dq).toBeLessThan(lk);
    expect(html).toContain('href="/admin/queues"');
  });
});

describe("fulfillment tile (owner ruling 2026-08-31)", () => {
  it("home carries the Fulfillment tile after Interco, linking /fulfillment", () => {
    const html = homePage(PIPELINE);
    expect(html).toContain('data-pipeline-key="fulfillment"');
    expect(html).toContain('href="/fulfillment"');
    expect(html.indexOf('href="/interco"')).toBeLessThan(html.indexOf('href="/fulfillment"'));
  });

  it("labels the tile kind Admin, not a stub, and titles it through i18n", () => {
    const en = homePage(PIPELINE, "en");
    expect(en).toContain('<a class="tile" href="/fulfillment" data-pipeline-key="fulfillment">');
    expect(en).toContain("Fulfillment");
    const es = homePage(PIPELINE, "es");
    expect(es).toContain("Despacho");
  });
});

describe("wet weight header form (owner ruling 2026-08-28)", () => {
  it("carries Lead, Move To, single line Notes, and Start lot; no weight fields", () => {
    const station = stationByKey("wet_weight")!;
    expect(station.personLabel).toBe("Lead");
    expect(station.submitLabel).toBe("Start lot");
    const fields = station.fields;
    expect(fields.find((f) => f.name === "weight_grams")).toBeUndefined();
    expect(fields.find((f) => f.name === "wet_spear_weight_grams")).toBeUndefined();
    expect(fields.find((f) => f.name === "dry_space_id")).toEqual({
      name: "dry_space_id",
      label: "Move To",
      input: "move_to",
      required: true,
    });
    expect(fields.find((f) => f.name === "notes")).toEqual({
      name: "notes",
      label: "Notes",
      input: "text",
    });
  });

  it("declares the wet_weights ledger", () => {
    expect(stationByKey("wet_weight")!.ledger).toEqual({
      table: "wet_weights",
      parentField: "wet_weight_entry_id",
    });
  });

  it("drops the spear weight from the edit page and adds the wet_weights ledger fields", () => {
    const names = EDITABLE_FIELDS.wet_weight_entries.map((f) => f.name);
    expect(names).not.toContain("wet_spear_weight_grams");
    expect(names).toContain("weight_grams");
    expect(EDITABLE_FIELDS.wet_weights).toEqual([
      { name: "weight_grams", label: "Weight (g)", input: "number" },
    ]);
  });

  it("keeps the other station person labels on Person", () => {
    for (const entry of PIPELINE) {
      if (entry.kind === "station" && entry.key !== "wet_weight") {
        expect(entry.personLabel).toBeUndefined();
      }
    }
  });
});

describe("station left pane (owner ruling 2026-08-28)", () => {
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const rows: QueueRow[] = [
    { id: "hb1", values: { hbn: "26244-ARL-GH-027-0-NA-26001", strain_name: "Fruity Pebbles" } },
    { id: "hb2", values: { hbn: "26244-ARL-GH-027-0-NA-26002", strain_name: "Fruity Pebbles" } },
  ];
  const queuesByKey: Record<string, QueueDef> = { hbn_queue: queueByKey("hbn_queue")! };
  const lookups = { dry_spaces: [{ value: "ds1", label: "Silo 1" }] };
  const ledgerCtx: StationLedgerCtx = {
    farmName: "Arlington",
    moveToOptions: [{ value: "ds6", label: "Arlington Dry Room" }],
    resumeLots: [],
  };
  const wetWeight = () => stationByKey("wet_weight")!;

  it("wet_weight declares the hbn_queue left pane and no other station does", () => {
    expect(wetWeight().leftPane).toEqual({
      queue: "hbn_queue",
      pickField: "harvest_batch_id",
      groupBy: "farm_code",
      paneFilter: "no_finished_lot",
    });
    for (const entry of PIPELINE) {
      if (entry.kind === "station" && entry.key !== "wet_weight") {
        expect(entry.leftPane).toBeUndefined();
      }
    }
  });

  it("wet_weight leftPane declares paneFilter no_finished_lot", () => {
    expect(wetWeight().leftPane?.paneFilter).toBe("no_finished_lot");
  });

  it("renders the pane and its pick from paneRows when provided, not from queueOptions", () => {
    const html = stationPage(
      wetWeight(),
      people,
      "p1",
      lookups,
      { hbn_queue: rows },
      queuesByKey,
      undefined,
      undefined,
      [rows[1]]
    );
    expect(html).toContain('href="/station/wet_weight?pick=hb2"');
    expect(html).not.toContain('href="/station/wet_weight?pick=hb1"');
    const hidden = stationPage(
      wetWeight(),
      people,
      "p1",
      lookups,
      { hbn_queue: rows },
      queuesByKey,
      "hb1",
      ledgerCtx,
      [rows[1]]
    );
    expect(hidden).toContain("Pick from the left to begin.");
    expect(hidden).not.toContain('name="harvest_batch_id"');
  });

  it("renders the queue pane and prompt without a pick, and no form", () => {
    const html = stationPage(wetWeight(), people, "p1", lookups, { hbn_queue: rows }, queuesByKey);
    expect(html).toContain('class="queue-pane"');
    expect(html).toContain('href="/station/wet_weight?pick=hb1"');
    expect(html).toContain("Pick from the left to begin.");
    expect(html).not.toContain("<form");
    expect(html).not.toContain('name="harvest_batch_id"');
  });

  it("treats an unknown pick as no pick", () => {
    const html = stationPage(
      wetWeight(),
      people,
      "p1",
      lookups,
      { hbn_queue: rows },
      queuesByKey,
      "nope"
    );
    expect(html).toContain("Pick from the left to begin.");
    expect(html).not.toContain("<form");
  });

  it("shows the picked row, the hidden pick input, and the form on a valid pick", () => {
    const html = stationPage(
      wetWeight(),
      people,
      "p1",
      lookups,
      { hbn_queue: rows },
      queuesByKey,
      "hb1",
      ledgerCtx
    );
    expect(html).toContain('<input type="hidden" name="harvest_batch_id" value="hb1">');
    expect(html).toContain("<form");
    expect(html).toContain('<a class="queue-pane-item selected" href="/station/wet_weight?pick=hb1">');
    expect(html).toContain('<a class="queue-pane-item" href="/station/wet_weight?pick=hb2">');
    expect(html).toContain("26244-ARL-GH-027-0-NA-26001 - Arlington</h2>");
    expect(html).not.toContain('<select name="harvest_batch_id"');
  });

  it("shows an empty queue as no rows waiting with no form", () => {
    const html = stationPage(wetWeight(), people, "p1", lookups, { hbn_queue: [] }, queuesByKey);
    expect(html).toContain("No rows waiting.");
    expect(html).not.toContain("<form");
  });

  it("a station without leftPane still renders its form directly", () => {
    const acquire = stationByKey("acquire_hbn")!;
    const html = stationPage(acquire, people, "p1", {}, {}, queuesByKey);
    expect(html).toContain("<form");
    expect(html).not.toContain("queue-pane");
    expect(html).not.toContain("Pick from the left");
  });
});

describe("left pane farm groups (owner ruling 2026-08-28)", () => {
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const rows: QueueRow[] = [
    {
      id: "hb1",
      values: { hbn: "26244-ARL-GH-027-0-NA-26001", strain_name: "Fruity Pebbles", farm_code: "ARL" },
    },
    {
      id: "hb2",
      values: { hbn: "26244-PNS-GH-027-0-NA-26002", strain_name: "Fruity Pebbles", farm_code: "PNS" },
    },
  ];
  const queuesByKey: Record<string, QueueDef> = { hbn_queue: queueByKey("hbn_queue")! };
  const lookups = { dry_spaces: [{ value: "ds1", label: "Silo 1" }] };
  const wetWeight = () => stationByKey("wet_weight")!;

  it("wet_weight declares groupBy farm_code on its left pane", () => {
    expect(wetWeight().leftPane?.groupBy).toBe("farm_code");
  });

  it("renders one collapsed details group per farm when nothing is picked", () => {
    const html = stationPage(wetWeight(), people, "p1", lookups, { hbn_queue: rows }, queuesByKey);
    expect(html.match(/<details class="pane-group"/g)).toHaveLength(2);
    expect(html).toContain('<details class="pane-group"><summary>ARL <span class="tile-count">1</span></summary>');
    expect(html).toContain('<details class="pane-group"><summary>PNS <span class="tile-count">1</span></summary>');
    expect(html).not.toContain('<details class="pane-group" open>');
  });

  it("opens only the picked row's group", () => {
    const html = stationPage(
      wetWeight(),
      people,
      "p1",
      lookups,
      { hbn_queue: rows },
      queuesByKey,
      "hb2"
    );
    expect(html).toContain('<details class="pane-group" open><summary>PNS <span class="tile-count">1</span></summary>');
    expect(html).toContain('<details class="pane-group"><summary>ARL <span class="tile-count">1</span></summary>');
  });
});

describe("truck number after the ledger ruling (owner ruling 2026-08-28)", () => {
  it("left the station form; trucks are dry_spaces rows now", () => {
    const fields = stationByKey("wet_weight")!.fields;
    expect(fields.find((f) => f.name === "truck_number")).toBeUndefined();
  });

  it("the column stays on the edit page and the Dry Space Queue for older rows", () => {
    const fields = EDITABLE_FIELDS.wet_weight_entries.map((f) => [f.name, f.label, f.input]);
    expect(fields).toContainEqual(["truck_number", "Truck #", "text"]);
    const columns = queueByKey("dry_space_queue")!.columns;
    expect(columns).toContainEqual({ field: "truck_number", label: "Truck" });
  });
});

describe("wet weight header render (owner ruling 2026-08-28)", () => {
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const rows: QueueRow[] = [
    {
      id: "hb1",
      values: { hbn: "26240-ARL-GH-027-0-NA-26001", strain_name: "Fruity Pebbles", farm_code: "ARL" },
    },
  ];
  const queuesByKey: Record<string, QueueDef> = { hbn_queue: queueByKey("hbn_queue")! };
  const ledgerCtx: StationLedgerCtx = {
    farmName: "Arlington",
    moveToOptions: [
      { value: "ds6", label: "Arlington Dry Room" },
      { value: "ds7", label: "Truck 1" },
    ],
    resumeLots: [],
  };
  const render = (ctx: StationLedgerCtx) =>
    stationPage(
      stationByKey("wet_weight")!,
      people,
      "p1",
      {},
      { hbn_queue: rows },
      queuesByKey,
      "hb1",
      ctx
    );

  it("renders the HBN, a plain spaced hyphen, and the farm display name; Lead; no weight inputs", () => {
    const html = render(ledgerCtx);
    expect(html).toContain("26240-ARL-GH-027-0-NA-26001 - Arlington</h2>");
    expect(html).toContain("Lead");
    expect(html).not.toContain('name="weight_grams"');
    expect(html).not.toContain('name="wet_spear_weight_grams"');
    expect(html).toContain("Move To");
    expect(html).toContain("Add a truck");
    expect(html).toContain('action="/station/wet_weight/add_truck"');
    expect(html).toContain("Start lot");
  });

  it("filters Move To to the passed options", () => {
    const html = render(ledgerCtx);
    expect(html).toContain("Arlington Dry Room");
    expect(html).toContain("Truck 1");
    expect(html).not.toContain("Silo");
  });

  it("lists weighing lots as resume links above the form", () => {
    const html = render({
      ...ledgerCtx,
      resumeLots: [{ id: "lot1", created_at: "2026-08-31T00:00:00.000Z", weight_grams: 12.5 }],
    });
    expect(html).toContain('href="/station/wet_weight?lot=lot1"');
    expect(html).toContain("(total 12.50 g)");
    expect(html.indexOf("Lots in progress")).toBeLessThan(html.indexOf("<form class=\"stack\""));
  });
});

describe("inbound queue (owner ruling 2026-08-28)", () => {
  it("registers right after dry_space_queue with predicate in_transit", () => {
    const q = queueByKey("inbound_queue")!;
    expect(q).toBeDefined();
    expect(q.surface).toBe("admin");
    expect(q.entity).toBe("wet_weight_entries");
    expect(q.predicate).toEqual({ field: "status", value: "in_transit" });
    expect(q.groupBy).toBe("dry_space_name");
    expect(q.rowControls).toEqual([]);
    expect(q.columns).toEqual([
      { field: "hbn", label: "HBN" },
      { field: "weight_grams", label: "Total (g)" },
      { field: "dry_space_name", label: "Truck" },
      { field: "notes", label: "Notes" },
      { field: "created_at", label: "Created" },
    ]);
    const keys = PIPELINE.map((e) => e.key);
    expect(keys.indexOf("inbound_queue")).toBe(keys.indexOf("dry_space_queue") + 1);
  });

  it("leaves the Dry Space Queue predicate on drying so weighing and in_transit stay out", () => {
    expect(queueByKey("dry_space_queue")!.predicate).toEqual({ field: "status", value: "drying" });
  });
});

describe("lot weights page (owner ruling 2026-08-28)", () => {
  const lot = {
    id: "lot1",
    hbn: "26240-ARL-GH-027-0-NA-26001",
    notes: "smoke lot",
    dry_space_name: "Silo 1",
    lead_name: "Pat",
  };
  const weights = [
    { id: "w2", weight_grams: 234.5, created_at: "2026-08-31T00:01:00.000Z" },
    { id: "w1", weight_grams: 1000.06, created_at: "2026-08-31T00:00:00.000Z" },
  ];

  it("renders the header, read-only lot text, weight controls, and the total outside the pane", () => {
    const html = lotPage(stationByKey("wet_weight")!, lot, weights, "Arlington", 1234.56);
    expect(html).toContain("26240-ARL-GH-027-0-NA-26001 - Arlington</h2>");
    expect(html).toContain("Move To");
    expect(html).toContain("Silo 1");
    expect(html).toContain("Lead");
    expect(html).toContain("Pat");
    expect(html).toContain("smoke lot");
    expect(html).toContain('action="/station/wet_weight/lot/lot1/weights"');
    expect(html).toContain('action="/station/wet_weight/lot/lot1/finish"');
    expect(html).toContain('href="/record/wet_weights/w1/edit"');
    expect(html).toContain('href="/record/wet_weights/w1/void"');
    expect(html).toContain('href="/record/wet_weights/w2/edit"');
    expect(html).toContain("Total: <strong>1234.56</strong> g");
    expect(html.indexOf("1234.56")).toBeGreaterThan(html.indexOf("</section>"));
    expect(html.indexOf("234.5")).toBeLessThan(html.indexOf("1000.06"));
  });

  it("says no weights yet on an empty lot", () => {
    const html = lotPage(stationByKey("wet_weight")!, lot, [], "Arlington", 0);
    expect(html).toContain("No weights yet.");
    expect(html).toContain("Total: <strong>0.00</strong> g");
  });
});
