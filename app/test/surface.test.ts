import { describe, expect, it } from "vitest";
import {
  adminHomePage,
  fulfillmentMenuPage,
  homePage,
  importQueuePage,
  opsGroupPage,
  reportsPage,
  inventoryPage,
  inventoryReservedPage,
  lotPage,
  pendingUploadsPage,
  queueSection,
  salesHelperWrapperPage,
  stationPage,
  unloadLotPanel,
  wetLotPanel,
  type StationLedgerCtx,
  renderField,
} from "../src/html";
import { backLinkFor } from "../src/nav";
import {
  EDITABLE_FIELDS,
  PIPELINE,
  homeEntries,
  opsGroupByKey,
  queueByKey,
  queues,
  stationByKey,
  type QueueDef,
} from "../src/pipeline";
import type { ImportQueueRow, PendingUploadRow, PersonRow, QueueRow } from "../src/db";
import { emptyInventorySheet } from "../src/inventory";
import { adminPage } from "../src/pages";

describe("surfaces (owner ruling 2026-08-27)", () => {
  it("home renders the operations map, not the old tile grid", () => {
    const html = homePage(PIPELINE);
    expect(html).not.toContain("data-count=");
    expect(html).not.toContain("/queue/");
    expect(html).toContain("<h1>Operations</h1>");
    expect(html).toContain('data-ops-key="harvest_ops"');
    expect(html).toContain('href="/ops/harvest_ops"');
    expect(html).not.toContain('data-pipeline-key="admin"');
    expect(html).not.toContain('data-pipeline-key="acquire_hbn"');
  });

  it("every queue lives on the admin surface, every station on home", () => {
    for (const q of queues()) expect(q.surface).toBe("admin");
    for (const e of homeEntries()) expect(e.kind).toBe("station");
    // Unload Dry Space joins the operator tiles (owner ruling 2026-08-31).
    expect(homeEntries()).toHaveLength(5);
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

describe("App config on Lookups (owner ruling 2026-09-01: the yield's home)", () => {
  const tables = {
    people: [],
    farms: [],
    strains: [],
    dry_spaces: [],
    package_types: [],
    app_config: [
      {
        id: "extraction_type_codes",
        key: "extraction_type_codes",
        value: "TRIM,BIO",
        updated_at: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "projected_dry_yield_pct",
        key: "projected_dry_yield_pct",
        value: "22",
        updated_at: "2026-09-01T00:00:00.000Z",
      },
    ],
  };

  it("renders the section with key, value, updated_at and the Edit control only", () => {
    const html = adminPage(tables);
    expect(html).toContain("App config");
    expect(html).toContain("<td>projected_dry_yield_pct</td>");
    expect(html).toContain("<td>22</td>");
    expect(html).toContain("<td>extraction_type_codes</td>");
    expect(html).toContain("<td>TRIM,BIO</td>");
    expect(html).toContain('href="/record/app_config/projected_dry_yield_pct/edit"');
    expect(html).toContain('href="/record/app_config/extraction_type_codes/edit"');
    // No Void (a voided admin_pin would unlock the site and a voided yield
    // breaks the sheet) and no Add (standing config keys are code-known).
    expect(html).not.toMatch(/\/record\/app_config\/[^"]+\/void/);
    expect(html).not.toContain('action="/admin/lookups/app_config"');
  });

  it("keeps Void on the other lookup tables", () => {
    const html = adminPage({
      ...tables,
      package_types: [
        { id: "TRIM", code: "TRIM", display_name: "TRIM", is_bud: 0, created_at: "x" },
      ],
    });
    expect(html).toContain('href="/record/package_types/TRIM/void"');
  });

  it("translates the section chrome in es and keeps keys and values raw", () => {
    const es = adminPage(tables, "es");
    expect(es).toContain("Configuración de la aplicación");
    expect(es).toContain("<td>projected_dry_yield_pct</td>");
    expect(es).toContain("<td>TRIM,BIO</td>");
  });

  it("EDITABLE_FIELDS wires app_config to the single Value field", () => {
    expect(EDITABLE_FIELDS.app_config).toEqual([{ name: "value", label: "Value", input: "text" }]);
  });
});

describe("pending data uploads surface (owner ruling 2026-08-31)", () => {
  const row: PendingUploadRow = {
    id: "load1",
    harvest_batch_id: "hb1",
    hbn: "26244-ARL-GH-027-0-NA-26002",
    seq: 1,
    lot: "26002",
    load_label: "Truck 4",
    wet_total_grams: 1734.56,
    plant_count: 12,
    newest_activity: "2026-09-01T15:00:00.000Z",
    tag_count: 0,
    unassigned: 0,
    tags_locked: false,
  };

  it("the Admin landing carries [Pending Data Uploads] right after Data Queues", () => {
    const html = adminHomePage();
    const dq = html.indexOf("Data Queues");
    const up = html.indexOf("Pending Data Uploads");
    const lk = html.indexOf("Lookups");
    expect(dq).toBeGreaterThan(-1);
    expect(up).toBeGreaterThan(dq);
    expect(up).toBeLessThan(lk);
    expect(html).toContain('href="/admin/uploads"');
    expect(adminHomePage("es")).toContain("Cargas de datos pendientes");
  });

  it("the Admin landing carries [Import Data] after Pending Data Uploads", () => {
    const html = adminHomePage();
    const up = html.indexOf("Pending Data Uploads");
    const im = html.indexOf("Import Data");
    const lk = html.indexOf("Lookups");
    expect(im).toBeGreaterThan(up);
    expect(im).toBeLessThan(lk);
    expect(html).toContain('href="/admin/imports"');
    expect(adminHomePage("es")).toContain("Importar datos");
  });

  it("lists a pending file with its type, <hbn>.csv, lot serial, counts, total, and controls", () => {
    const html = pendingUploadsPage([row]);
    expect(html).toContain("<h1>Pending Data Uploads</h1>");
    expect(html).toContain("<td>Wet Weights</td>");
    expect(html).toContain('href="/admin/uploads/wet_weights/load1.csv"');
    expect(html).toContain(">26244-ARL-GH-027-0-NA-26002(1).csv</a>");
    expect(html).toContain("<td>26002</td>");
    expect(html).toContain("<td>Truck 4</td>");
    expect(html).toContain("<td>12</td>");
    // Owner ruling 2026-08-31: add commas to all thousands; the wet total column
    // formats through formatGrams while the file itself stays raw.
    expect(html).toContain("<td>1,735</td>");
    expect(html).not.toContain("<td>1734.56</td>");
    expect(html).toContain("2026-09-01T15:00:00.000Z");
    expect(html).toContain("Download");
    expect(html).toContain('action="/admin/uploads/wet_weights/load1/uploaded"');
    expect(html).toContain("Mark uploaded");
  });

  it("shows the tag count and the paste form on each pending row (owner ruling 2026-08-31: the Plant fill rule)", () => {
    const html = pendingUploadsPage([row]);
    expect(html).toContain("Plant tags: 0");
    expect(html).toContain('action="/admin/uploads/wet_weights/load1/tags"');
    expect(html).toContain('<textarea name="plant_tags"');
    expect(html).toContain("Save tags");
    const tagged = pendingUploadsPage([{ ...row, tag_count: 3 }]);
    expect(tagged).toContain("Plant tags: 3");
  });

  it("carries the muted Plant note only while a pending batch has zero tags (owner ruling 2026-08-31: the Plant fill rule)", () => {
    const note = "Plant column is blank pending the owner's fill rule.";
    expect(pendingUploadsPage([row])).toContain(`<p class="muted">${note}</p>`);
    expect(pendingUploadsPage([{ ...row, tag_count: 3 }])).not.toContain(note);
    expect(
      pendingUploadsPage([{ ...row, tag_count: 3 }, { ...row, id: "hb2", tag_count: 0 }])
    ).toContain(note);
    const empty = pendingUploadsPage([]);
    expect(empty).not.toContain(note);
    expect(empty).toContain(`<p class="muted">Nothing pending.</p>`);
    expect(empty).not.toContain("<table");
  });

  it("carries the Clear all control with the pending count when anything pends, and none when empty (canon 0.30.96)", () => {
    // THE PENDING QUEUE CLEAR: a reveal-guarded button that posts to the clear
    // route, with the total across every list; the wording says cleared, not
    // uploaded to METRC.
    const one = pendingUploadsPage([row]);
    expect(one).toContain('<details class="clear-all" data-clear-all>');
    expect(one).toContain('action="/admin/uploads/clear-all"');
    expect(one).toContain('<button type="submit" class="danger">Clear all pending (1)</button>');
    expect(one).toContain("It records them as cleared, not uploaded to METRC.");
    // The count sums every list, not just wet weights.
    const many = pendingUploadsPage(
      [row],
      "en",
      [],
      [],
      [],
      [],
      [{ id: "sl1", harvest_batch_id: "hb1", hbn: "H", lot: "26002", silo_name: "Silo 1", file_location: "Silo 1", seq: 1, newest_activity: "2026-09-01T15:00:00.000Z" }]
    );
    expect(many).toContain("Clear all pending (2)</button>");
    // Empty queue: no Clear all control.
    expect(pendingUploadsPage([])).not.toContain("clear-all");
  });

  it("translates the uploads chrome in es and keeps the data untouched", () => {
    const es = pendingUploadsPage([row], "es");
    expect(es).toContain("Cargas de datos pendientes");
    expect(es).toContain("Pesos húmedos");
    expect(es).toContain("Marcar cargado");
    expect(es).toContain("Descargar");
    expect(es).toContain(
      "La columna Plant queda en blanco en espera de la regla de llenado del propietario."
    );
    expect(es).toContain("26244-ARL-GH-027-0-NA-26002(1).csv");
    const esEmpty = pendingUploadsPage([], "es");
    expect(esEmpty).toContain("Nada pendiente.");
  });

  it("renders the Splits section after Manifests with download and mark uploaded", () => {
    const html = pendingUploadsPage(
      [],
      "en",
      [],
      [],
      [],
      [
        {
          id: "parent-1",
          parent_code: "1A1",
          harvest_batch_id: "hb1",
          filename: "package_split_1A1.csv",
          newest_activity: "2026-09-05T00:00:00.000Z",
        },
      ]
    );
    expect(html).toContain('data-fold="package_split" open');
    expect(html).toContain(">Splits <span");
    expect(html).toContain('name="item" value="package_split:parent-1"');
    expect(html).toContain('data-check-all="up-package_split"');
    expect(html).toContain('action="/admin/uploads/uploaded-checked"');
    expect(html).toContain("Package split");
    expect(html).toContain("/admin/uploads/package_split/parent-1.csv");
    expect(html).toContain('action="/admin/uploads/package_split/parent-1/uploaded"');
    expect(html).toContain("Mark uploaded");
  });
});

describe("fulfillment tile (owner ruling 2026-08-31)", () => {
  it("Production Operations carries the Fulfillment tile after the station tiles, linking /fulfillment", () => {
    const group = opsGroupByKey("production_ops")!;
    const html = opsGroupPage(group);
    expect(html).toContain('data-pipeline-key="fulfillment"');
    expect(html).toContain('href="/fulfillment"');
    expect(html.indexOf('data-pipeline-key="cryo_weight"')).toBeLessThan(
      html.indexOf('data-pipeline-key="fulfillment"')
    );
  });

  it("Production Operations carries Production Scheduling first (canon 0.30.97)", () => {
    const group = opsGroupByKey("production_ops")!;
    expect(group.members.map((m) => m.key)).toEqual([
      "production_scheduling",
      "trim_packages",
      "cryo_weight",
      "prepack",
      "fulfillment",
      "inventory",
    ]);
    expect(group.members[0]).toEqual({
      key: "production_scheduling",
      title: "Production Scheduling",
      href: "/production/scheduling",
    });
    const html = opsGroupPage(group);
    expect(html.indexOf('data-pipeline-key="production_scheduling"')).toBeLessThan(
      html.indexOf('data-pipeline-key="trim_packages"')
    );
    expect(html).toContain('href="/production/scheduling"');
    expect(html).toContain("Production Scheduling");
    const es = opsGroupPage(group, "es");
    expect(es).toContain("Programacion de produccion");
  });

  it("labels the tile through i18n and is not a stub", () => {
    const group = opsGroupByKey("production_ops")!;
    const en = opsGroupPage(group, "en");
    expect(en).toContain('<a class="tile" href="/fulfillment" data-pipeline-key="fulfillment">');
    expect(en).toContain("Fulfillment");
    const es = opsGroupPage(group, "es");
    expect(es).toContain("Despacho");
  });
});

describe("fulfillment menu (owner ruling 2026-09-01)", () => {
  it("renders three admin-style buttons, all functional since canon 0.30.18", () => {
    const html = fulfillmentMenuPage();
    expect(html).toContain("<h1>Fulfillment</h1>");
    expect(html).toContain(
      '<a class="tile" href="/fulfillment/saleshelper/" data-fulfillment-key="saleshelper">'
    );
    expect(html).toContain("SalesHelper");
    // Canon 0.30.18: Mount SOs and Pick Orders are built; the orange barrels
    // (tile-stub) came off both tiles.
    expect(html).toContain(
      '<a class="tile" href="/fulfillment/mount-sos" data-fulfillment-key="mount-sos">'
    );
    expect(html).toContain("Mount SOs");
    expect(html).toContain(
      '<a class="tile" href="/fulfillment/pick-orders" data-fulfillment-key="pick-orders">'
    );
    expect(html).toContain("Pick Orders");
    expect(html).not.toContain("tile-stub");
    // The order is SalesHelper first.
    expect(html.indexOf("saleshelper")).toBeLessThan(html.indexOf("mount-sos"));
    expect(html.indexOf("mount-sos")).toBeLessThan(html.indexOf("pick-orders"));
  });

  it("translates the menu chrome in es and keeps the proper noun", () => {
    const es = fulfillmentMenuPage("es");
    expect(es).toContain("<h1>Despacho</h1>");
    expect(es).toContain("SalesHelper");
    expect(es).toContain("Montar SOs");
    expect(es).toContain("Preparar pedidos");
  });
});

describe("hosted saleshelper wrapper (owner ruling 2026-09-01)", () => {
  it("frames the raw form at /fulfillment/saleshelper/app in a flush iframe", () => {
    const html = salesHelperWrapperPage();
    expect(html).toContain('class="saleshelper-embed" data-saleshelper-wrapper');
    // Canon 0.30.49: the wrapper's frame is fitted to the viewport too.
    expect(html).toContain('document.querySelector("[data-saleshelper-wrapper] iframe")');
    expect(html).toContain("var below = Math.max(0, doc.scrollHeight - (rect.bottom + scrollY))");
    expect(html).toContain(
      '<iframe class="saleshelper-frame" src="/fulfillment/saleshelper/app" title="SalesHelper"></iframe>'
    );
  });

  it("titles the iframe through t() so es rides the proper noun", () => {
    expect(salesHelperWrapperPage("es")).toContain('title="SalesHelper"');
  });
});

describe("inventory tile (owner ruling 2026-08-31, sheet 2026-09-01)", () => {
  it("Production Operations carries the Inventory tile after Fulfillment, no longer a stub", () => {
    const html = opsGroupPage(opsGroupByKey("production_ops")!);
    expect(html).toContain('data-pipeline-key="inventory"');
    expect(html).toContain('<a class="tile" href="/inventory" data-pipeline-key="inventory">');
    expect(html.indexOf('href="/fulfillment"')).toBeLessThan(html.indexOf('href="/inventory"'));
    const inv = html.slice(html.indexOf('href="/inventory"') - 30, html.indexOf('href="/inventory"') + 80);
    expect(inv).not.toContain("tile-stub");
  });

  it("titles the tile through i18n and renders the sheet, not the old stub", () => {
    const en = opsGroupPage(opsGroupByKey("production_ops")!, "en");
    expect(en).toContain("Inventory");
    const es = opsGroupPage(opsGroupByKey("production_ops")!, "es");
    expect(es).toContain("Inventario");
    const page = inventoryPage(emptyInventorySheet(), "en");
    expect(page).toContain("WIP Inventory");
    expect(page).toContain("FG Inventory");
    expect(page).not.toContain("Reserved for the Inventory node. Not built yet.");
    expect(inventoryPage(emptyInventorySheet(), "es")).toContain("Inventario en proceso");
    // Canon 0.30.40 built Change Locations; a still-reserved page keeps the line.
    expect(inventoryReservedPage("zoho-upload", "es")).toContain(
      "Reservado. En espera de la conversación con el propietario."
    );
  });
});

describe("wet weight header form (owner ruling 2026-08-28)", () => {
  it("carries Team Lead (canon 0.30.67), Move To, single line Notes, and Start lot; no weight fields", () => {
    const station = stationByKey("wet_weight")!;
    // THE SUPERVISOR AND THE TEAM LEAD (canon 0.30.67): the header's typed field is the Team Lead.
    expect(station.personLabel).toBe("Team Lead");
    expect(station.submitLabel).toBe("Start lot");
    const fields = station.fields;
    expect(fields.find((f) => f.name === "weight_grams")).toBeUndefined();
    expect(fields.find((f) => f.name === "wet_spear_weight_grams")).toBeUndefined();
    const moveTo = fields.find((f) => f.name === "actual_dryspc");
    expect(moveTo?.label).toBe("Move To");
    expect(moveTo?.input).toBe("move_to");
    expect(moveTo && "required" in moveTo && moveTo.required).toBe(true);
    expect(fields.find((f) => f.name === "dry_space_id")).toBeUndefined();
    expect(fields.find((f) => f.name === "notes")?.input).toBe("text");
    // Owner ruling 2026-09-07 (canon 0.29.1): the spear/buck toggle lives here.
    const materialForm = fields.find((f) => f.name === "material_form");
    expect(materialForm?.input).toBe("radio");
    expect(materialForm && "default" in materialForm && materialForm.default).toBe("spear");
  });

  it("declares the wet_weights ledger", () => {
    // Widened for the dry mirror (owner ruling 2026-08-31); wet semantics unchanged.
    expect(stationByKey("wet_weight")!.ledger).toEqual({
      table: "wet_weights",
      parentField: "wet_weight_entry_id",
      totalField: "weight_grams",
      lotStatus: "weighing",
    });
  });

  it("drops the spear weight from the edit page and adds the wet_weights ledger fields", () => {
    const names = EDITABLE_FIELDS.wet_weight_entries.map((f) => f.name);
    expect(names).not.toContain("wet_spear_weight_grams");
    expect(names).toContain("weight_grams");
    expect(EDITABLE_FIELDS.wet_weights).toEqual([
      { name: "weight_grams", label: "Weight (g)", input: "number" },
      { name: "harvest_batch_id", label: "HBN", input: "lookup", lookup: "harvest_batches" },
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
    { id: "hb1", values: { hbn: "26244-ARL-GH-027-0-NA-26001", strain_name: "Fruity Pebbles", farm_code: "ARL", entry_date: "2026-09-01" } },
    { id: "hb2", values: { hbn: "26244-ARL-GH-027-0-NA-26002", strain_name: "Fruity Pebbles", farm_code: "ARL", entry_date: "2026-09-01" } },
  ];
  const queuesByKey: Record<string, QueueDef> = { hbn_queue: queueByKey("hbn_queue")! };
  const lookups = { dry_spaces: [{ value: "ds1", label: "Silo 1" }] };
  const ledgerCtx: StationLedgerCtx = {
    farmName: "Arlington",
    moveToOptions: [{ value: "ds6", label: "Arlington Dry Room" }],
    resumeLots: [],
  };
  const wetWeight = () => stationByKey("wet_weight")!;

  it("wet_weight declares the hbn_queue left pane; every fed station has one, Acquire none", () => {
    expect(wetWeight().leftPane).toEqual({
      queue: "hbn_queue",
      pickField: "harvest_batch_id",
      groupBy: "farm_code",
      paneFilter: "no_finished_lot",
    });
    // Owner ruling 2026-08-31: the two-pane theme is the station law for
    // everything; Acquire HBN is the source station with no feeding queue and
    // stays a plain form, every other station declares its pane.
    for (const entry of PIPELINE) {
      if (entry.kind !== "station") continue;
      if (entry.key === "acquire_hbn") expect(entry.leftPane).toBeUndefined();
      else expect(entry.leftPane).toBeDefined();
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
    expect(html).toContain("ARL / Fruity Pebbles / 2026-09-01</h2>");
    expect(html).toContain('<p class="muted">26244-ARL-GH-027-0-NA-26001</p>');
    expect(html).not.toContain('<select name="harvest_batch_id"');
  });

  it("shows an empty queue as no rows waiting with no form", () => {
    const html = stationPage(wetWeight(), people, "p1", lookups, { hbn_queue: [] }, queuesByKey);
    expect(html).toContain("No rows waiting.");
    expect(html).not.toContain("<form");
  });

  it("a station without leftPane still renders its form; Acquire gains the recall pane", () => {
    const acquire = stationByKey("acquire_hbn")!;
    const html = stationPage(acquire, people, "p1", {}, {}, queuesByKey);
    expect(html).toContain("<form");
    expect(html).toContain('id="acquire-hbn-form"');
    expect(html).toContain("recall-pane");
    expect(html).toContain("Weightless HBNs");
    expect(html).not.toContain("Pick from the left");
  });
});

describe("acquire HBN recall pane (owner ruling 2026-09-01)", () => {
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const queuesByKey: Record<string, QueueDef> = {};
  const acquire = () => stationByKey("acquire_hbn")!;
  const rows = [
    {
      id: "hb3",
      hbn: "26244-ARL-GH-027-0-NA-26003",
      entry_date: "2026-09-01",
      farm_code: "ARL",
      grow_method_code: "GH",
      strain_id: "st1",
      manicure: 0,
      planned_dryspc: "5",
      start_time: "07:00",
      zone: "A",
      rows_text: "1-4",
      metrc_harvest_tag: "1A4TAG",
    },
  ];

  it("lists only the passed weightless batches, newest first as given, with the recall icon", () => {
    const html = stationPage(
      acquire(),
      people,
      "p1",
      {},
      {},
      queuesByKey,
      undefined,
      undefined,
      undefined,
      "en",
      undefined,
      undefined,
      { recallRows: rows, prefill: {} }
    );
    expect(html).toContain("26244-ARL-GH-027-0-NA-26003");
    expect(html).toContain('action="/station/acquire_hbn/recall"');
    expect(html).toContain('class="recall-hbn"');
    expect(html).toContain('title="recall HBN"');
    expect(html).toContain("&#8617;");
    expect(html).toContain('name="id" value="hb3"');
    expect(html).toContain("No weightless HBNs.".length > 0);
    expect(html).not.toContain("No weightless HBNs.");
  });

  it("carries the confirm-guard markup and the i18n warning", () => {
    const html = stationPage(acquire(), people, "p1", {}, {}, queuesByKey);
    expect(html).toContain('id="acquire-hbn-form"');
    expect(html).toContain("Unsaved HBN data will be lost.");
    expect(html).toContain("confirm(msg)");
    const es = stationPage(
      acquire(),
      people,
      "p1",
      {},
      {},
      queuesByKey,
      undefined,
      undefined,
      undefined,
      "es",
      undefined,
      undefined,
      { recallRows: rows, prefill: {} }
    );
    expect(es).toContain("Se perderán los datos de HBN no guardados.");
    expect(es).toContain("retirar HBN");
  });

  it("prefills the mint form from the recalled field values", () => {
    const html = stationPage(
      acquire(),
      people,
      "p1",
      {
        farms: [{ value: "ARL", label: "Arlington" }],
        grow_methods: [{ value: "GH", label: "Greenhouse" }],
        strains: [{ value: "st1", label: "Fruity Pebbles (027)" }],
      },
      {},
      queuesByKey,
      undefined,
      undefined,
      undefined,
      "en",
      undefined,
      undefined,
      {
        recallRows: [],
        prefill: {
          entry_date: "2026-09-01",
          farm_code: "ARL",
          grow_method_code: "GH",
          strain_id: "st1",
          manicure: "1",
          planned_dryspc: "5",
          start_time: "07:00",
          zone: "A",
          rows_text: "1-4",
          metrc_harvest_tag: "1A4TAG",
        },
      }
    );
    expect(html).toContain('name="entry_date" value="2026-09-01"');
    expect(html).toContain('<option value="ARL" selected>');
    expect(html).toContain('<option value="st1" selected>');
    expect(html).toContain('name="manicure" value="1" checked');
    expect(html).toContain('name="planned_dryspc"');
    expect(html).toContain("07:00");
    expect(html).toContain('name="metrc_harvest_tag" value="1A4TAG"');
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
  it("Truck # is free text on the header; Move To is still not a truck (canon 0.30.226)", () => {
    const fields = stationByKey("wet_weight")!.fields;
    const truck = fields.find((f) => f.name === "truck_number");
    expect(truck?.input).toBe("text");
    expect(fields.find((f) => f.name === "actual_dryspc")?.input).toBe("move_to");
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
      values: { hbn: "26240-ARL-GH-027-0-NA-26001", strain_name: "Fruity Pebbles", farm_code: "ARL", entry_date: "2026-08-28" },
    },
  ];
  const queuesByKey: Record<string, QueueDef> = { hbn_queue: queueByKey("hbn_queue")! };
  // Owner ruling 2026-08-31: trucks are record-borne; standing options carry no
  // catalog trucks and the batch's own numbers arrive as truckOptions.
  const ledgerCtx: StationLedgerCtx = {
    farmName: "Arlington",
    moveToOptions: [{ value: "ds6", label: "Arlington Dry Room" }],
    truckOptions: ["1"],
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

  it("renders the HBN, a plain spaced hyphen, and the farm display name; Supervisor and Team Lead; no weight inputs", () => {
    const html = render(ledgerCtx);
    expect(html).toContain("ARL / Fruity Pebbles / 2026-08-28</h2>");
    expect(html).toContain('<p class="muted">26240-ARL-GH-027-0-NA-26001</p>');
    // THE SUPERVISOR AND THE TEAM LEAD (canon 0.30.67): the login shown as the
    // Supervisor, never picked; the Team Lead a hand-typed, required text box.
    expect(html).toContain('data-supervisor>Supervisor: Pat</p>');
    expect(html).toContain('<input type="text" name="team_lead" required autocomplete="off" data-team-lead>');
    expect(html).not.toContain('name="lead_person_id"');
    expect(html).toContain("Team Lead");
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
    expect(html).not.toContain("Silo");
  });

  it("lists weighing lots as resume links above the form, each in local time with its Move To, Team Lead and total (canon 0.30.89)", () => {
    const html = render({
      ...ledgerCtx,
      resumeLots: [
        { id: "lot1", created_at: "2026-08-31T00:00:00.000Z", weight_grams: 12.5, truck_number: "4", dry_space_name: "Truck", team_lead: "Plutarco" },
        { id: "lot2", created_at: "2026-08-31T00:00:06.000Z", weight_grams: 0, truck_number: null, dry_space_name: "Silo 1", team_lead: null },
      ],
    });
    expect(html).toContain('href="/station/wet_weight?lot=lot1"><time datetime="2026-08-31T00:00:00.000Z" data-local>2026-08-31T00:00:00.000Z</time> · Truck 4 · Plutarco (total 13 g)</a>');
    expect(html).toContain('href="/station/wet_weight?lot=lot2"><time datetime="2026-08-31T00:00:06.000Z" data-local>2026-08-31T00:00:06.000Z</time> · Silo 1 (total 0 g)</a>');
    expect(html).toContain("time[data-local]");
    expect(html.indexOf("Lots in progress")).toBeLessThan(html.indexOf("<form class=\"stack\""));
    // THE FOUR START TAPS: the header form locks its button on the first tap.
    expect(html).toContain('action="/station/wet_weight" data-lock-on-submit>');
    expect(html).toContain("form[data-lock-on-submit]");
  });

  // Owner report 2026-09-01 (duplicate-lot guard): an in-progress lot must never
  // hide behind a blank header form, so with lots in progress the header form
  // collapses behind Start another lot unless newFormOpen says it was asked for.
  it("collapses the header form behind Start another lot when lots are in progress", () => {
    const html = render({
      ...ledgerCtx,
      resumeLots: [
        { id: "lot1", created_at: "2026-08-31T00:00:00.000Z", weight_grams: 12.5 },
        { id: "lot2", created_at: "2026-08-31T01:00:00.000Z", weight_grams: 3 },
      ],
    });
    expect(html).toContain('<details class="start-another">');
    expect(html).toContain("<summary>Start another lot</summary>");
    expect(html.indexOf('<details class="start-another">')).toBeLessThan(
      html.indexOf('<form class="stack"')
    );
    expect(html).not.toContain('<details class="start-another" open>');
  });

  it("keeps the header form open when newFormOpen marks it deliberately asked for", () => {
    const html = render({
      ...ledgerCtx,
      resumeLots: [{ id: "lot1", created_at: "2026-08-31T00:00:00.000Z", weight_grams: 12.5 }],
      newFormOpen: true,
    });
    expect(html).not.toContain('<details class="start-another">');
    expect(html).toContain('<form class="stack"');
    expect(html).toContain("Lots in progress");
  });

  it("renders the plain header form with no collapse when nothing is in progress", () => {
    const html = render(ledgerCtx);
    expect(html).not.toContain('<details class="start-another">');
    expect(html).not.toContain("Start another lot");
    expect(html).toContain('<form class="stack"');
  });
});

describe("record-borne truck options (owner ruling 2026-08-31)", () => {
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const rows: QueueRow[] = [
    {
      id: "hb1",
      values: { hbn: "26240-ARL-GH-027-0-NA-26001", strain_name: "Fruity Pebbles", farm_code: "ARL", entry_date: "2026-08-28" },
    },
  ];
  const queuesByKey: Record<string, QueueDef> = { hbn_queue: queueByKey("hbn_queue")! };
  const base: StationLedgerCtx = {
    farmName: "Arlington",
    moveToOptions: [{ value: "ds6", label: "Arlington Dry Room" }],
    truckOptions: [],
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

  it("renders each derived truck as the encoded truck-<n> with a numbered label", () => {
    const html = render({ ...base, truckOptions: ["1", "2"] });
    expect(html).toContain('<option value="truck-1">Truck 1</option>');
    expect(html).toContain('<option value="truck-2">Truck 2</option>');
  });

  it("starts a batch with zero truck options but keeps the Add a truck control", () => {
    const html = render(base);
    expect(html).not.toContain('value="truck-');
    expect(html).toContain("Add a truck");
    expect(html).toContain('action="/station/wet_weight/add_truck"');
  });

  it("preselects the staged option and carries it into the sibling form", () => {
    const html = render({ ...base, truckOptions: ["1"], stagedTruck: "2" });
    expect(html).toContain('<option value="truck-1">Truck 1</option>');
    expect(html).toContain('<option value="truck-2" selected>Truck 2</option>');
    expect(html).toContain('<input type="hidden" name="truck" value="2">');
  });

  it("never renders the bare numberless Truck option", () => {
    const html = render({ ...base, truckOptions: ["1"] });
    expect(html).not.toContain(">Truck</option>");
  });

  it("hides truck options and the Add a truck control when the farm law disallows trucks", () => {
    const html = render({ ...base, truckOptions: undefined });
    expect(html).not.toContain('value="truck-');
    expect(html).not.toContain("Add a truck");
    expect(html).not.toContain('action="/station/wet_weight/add_truck"');
  });
});

describe("inbound queue (owner ruling 2026-08-28)", () => {
  it("registers right after the unload pair with predicate in_transit", () => {
    const q = queueByKey("inbound_queue")!;
    expect(q).toBeDefined();
    expect(q.surface).toBe("admin");
    expect(q.entity).toBe("wet_weight_entries");
    expect(q.predicate).toEqual({ field: "status", value: "in_transit" });
    // Owner ruling 2026-09-02: [Demote] rides every queue whose status steps back.
    expect(q.rowControls).toEqual([{ key: "demote", label: "Demote" }]);
    // The unload station and Unloaded Queue slot in between (owner ruling 2026-08-31).
    const keys = PIPELINE.map((e) => e.key);
    expect(keys.indexOf("inbound_queue")).toBe(keys.indexOf("unloaded_queue") + 1);
  });

  it("rides truck_label for the truck column, options, and grouping (owner ruling 2026-08-31)", () => {
    const q = queueByKey("inbound_queue")!;
    expect(q.groupBy).toBe("truck_label");
    expect(q.optionFields).toEqual(["hbn", "truck_label", "weight_grams"]);
    expect(q.columns).toEqual([
      { field: "hbn", label: "HBN" },
      { field: "weight_grams", label: "Total (g)" },
      { field: "truck_label", label: "Truck" },
      { field: "notes", label: "Notes" },
      { field: "created_at", label: "Created" },
    ]);
  });

  it("the Weighing Queue closes the removal gap (owner word 2026-09-06, canon 0.27.5)", () => {
    const q = queueByKey("weighing_queue")!;
    expect(q).toBeDefined();
    expect(q.surface).toBe("admin");
    expect(q.entity).toBe("wet_weight_entries");
    expect(q.predicate).toEqual({ field: "status", value: "weighing" });
    // No controls beyond the standard reasoned Edit and Void; demote from
    // weighing would step back to nothing.
    expect(q.rowControls).toEqual([]);
    expect(q.columns.map((c) => c.field)).toEqual(["hbn", "weight_grams", "notes", "created_at"]);
    // It rides right after the Inbound Queue on the Data Queues page.
    const keys = PIPELINE.map((e) => e.key);
    expect(keys.indexOf("weighing_queue")).toBe(keys.indexOf("inbound_queue") + 1);
  });

  it("leaves the Dry Space Queue grouping on dry_space_name", () => {
    expect(queueByKey("dry_space_queue")!.groupBy).toBe("dry_space_name");
  });

  it("leaves the Dry Space Queue predicate on drying so weighing and in_transit stay out", () => {
    expect(queueByKey("dry_space_queue")!.predicate).toEqual({ field: "status", value: "drying" });
  });
});

describe("lot weights page (owner ruling 2026-08-28)", () => {
  const lot = {
    id: "lot1",
    hbn: "26240-ARL-GH-027-0-NA-26001",
    farm_code: "ARL",
    strain_name: "Fruity Pebbles",
    entry_date: "2026-08-28",
    notes: "smoke lot",
    dry_space_name: "Silo 1",
    truck_number: null,
    lead_name: "Maria",
    supervisor_name: "Pat",
  };
  const weights = [
    { id: "w2", weight_grams: 234.5, created_at: "2026-08-31T00:01:00.000Z" },
    { id: "w1", weight_grams: 1000.06, created_at: "2026-08-31T00:00:00.000Z" },
  ];

  it("renders the header, read-only lot text, weight controls, and the total outside the pane", () => {
    const html = lotPage(stationByKey("wet_weight")!, lot, weights, "Arlington", 1234.56);
    expect(html).toContain("ARL / Fruity Pebbles / 2026-08-28</h2>");
    expect(html).toContain('<p class="muted">26240-ARL-GH-027-0-NA-26001</p>');
    expect(html).toContain("Move To");
    expect(html).toContain("Silo 1");
    // THE SUPERVISOR AND THE TEAM LEAD (canon 0.30.67): both read on the lot.
    expect(html).toContain("<dt>Supervisor</dt><dd data-supervisor>Pat</dd>");
    expect(html).toContain("<dt>Team Lead</dt><dd data-team-lead>Maria</dd>");
    expect(html).not.toContain("<dt>Lead</dt>");
    expect(html).toContain("smoke lot");
    expect(html).toContain('action="/station/wet_weight/lot/lot1/weights"');
    expect(html).toContain('action="/station/wet_weight/lot/lot1/finish"');
    expect(html).toContain('href="/record/wet_weights/w1/edit"');
    expect(html).toContain('href="/record/wet_weights/w1/void"');
    expect(html).toContain('href="/record/wet_weights/w2/edit"');
    // Owner ruling 2026-08-31: add commas to all thousands; the total and each
    // weight row format through formatGrams at 2 decimals.
    expect(html).toContain("Total: <strong>1,235</strong> g");
    expect(html).not.toContain("1234.56");
    // The bottom total stays outside the pane; since canon 0.30.60 the running
    // total also reads under Notes above it, so the check names the bottom line.
    expect(html.indexOf("Total: <strong>1,235")).toBeGreaterThan(html.indexOf("</section>"));
    expect(html.indexOf("235")).toBeLessThan(html.indexOf("1,000"));
  });

  it("says no weights yet on an empty lot", () => {
    const html = lotPage(stationByKey("wet_weight")!, lot, [], "Arlington", 0);
    expect(html).toContain("No weights yet.");
    expect(html).toContain("Total: <strong>0</strong> g");
  });

  it("labels a record-borne truck lot Truck <n>, never the bare sentinel name (owner ruling 2026-08-31)", () => {
    const truckLot = { ...lot, dry_space_name: "Truck", truck_number: "1" };
    const html = lotPage(stationByKey("wet_weight")!, truckLot, [], "Arlington", 0);
    expect(html).toContain("<dd data-truck-number>Truck 1 - 26240-ARL-GH-027-0-NA-26001</dd>");
    const es = lotPage(stationByKey("wet_weight")!, truckLot, [], "Arlington", 0, "es");
    expect(es).toContain("<dd data-truck-number>Camión 1 - 26240-ARL-GH-027-0-NA-26001</dd>");
  });
});

describe("unload dry space station (owner ruling 2026-08-31)", () => {
  it("registers between dry_space_queue and the Unloaded Queue, on the home surface", () => {
    const keys = PIPELINE.map((e) => e.key);
    expect(keys.indexOf("unload_dry_space")).toBe(keys.indexOf("dry_space_queue") + 1);
    expect(keys.indexOf("unloaded_queue")).toBe(keys.indexOf("unload_dry_space") + 1);
  });

  it("declares the direct dry_weights ledger over the dry space pane, with no create form", () => {
    const station = stationByKey("unload_dry_space")!;
    expect(station.surface).toBe("home");
    expect(station.entity).toBe("wet_weight_entries");
    expect(station.fields).toEqual([]);
    expect(station.transition).toBeUndefined();
    expect(station.leftPane).toEqual({
      queue: "dry_space_queue",
      pickField: "wet_weight_entry_id",
      groupBy: "dry_space_name",
    });
    expect(station.ledger).toEqual({
      table: "dry_weights",
      parentField: "wet_weight_entry_id",
      totalField: "dry_weight_grams",
      lotStatus: "drying",
      mode: "direct",
      finishTransition: "lot_unloaded",
    });
  });

  it("home-surface stations stay Acquire, Wet Weight, Unload Dry Space, Trim, Cryo", () => {
    expect(homeEntries().map((e) => e.key)).toEqual([
      "acquire_hbn",
      "wet_weight",
      "unload_dry_space",
      "trim_packages",
      "cryo_weight",
    ]);
    const drying = opsGroupPage(opsGroupByKey("drying_ops")!);
    const production = opsGroupPage(opsGroupByKey("production_ops")!);
    expect(drying).toContain('data-pipeline-key="unload_dry_space"');
    expect(production.indexOf('data-pipeline-key="trim_packages"')).toBeLessThan(
      production.indexOf('data-pipeline-key="cryo_weight"')
    );
  });

  it("adds the dry_weights ledger fields to the reasoned edit page", () => {
    expect(EDITABLE_FIELDS.dry_weights).toEqual([
      { name: "weight_grams", label: "Weight (g)", input: "number" },
    ]);
  });
});

describe("unloaded queue (owner ruling 2026-08-31)", () => {
  it("holds unloaded lots with the short id, strain, dry total, and source columns", () => {
    const q = queueByKey("unloaded_queue")!;
    expect(q.surface).toBe("admin");
    expect(q.entity).toBe("wet_weight_entries");
    expect(q.predicate).toEqual({ field: "status", value: "unloaded" });
    expect(q.groupBy).toBeUndefined();
    expect(q.columns).toEqual([
      { field: "short_id", label: "Lot" },
      { field: "strain_name", label: "Strain" },
      { field: "dry_weight_grams", label: "Dry total (g)" },
      { field: "dry_space_name", label: "From" },
      { field: "notes", label: "Notes" },
      { field: "created_at", label: "Created" },
    ]);
    expect(q.optionFields).toEqual(["short_id", "strain_name", "dry_weight_grams"]);
    // Owner ruling 2026-09-02: [Demote] rides beside the queue's own exit.
    expect(q.rowControls).toEqual([
      { key: "mark_trimmed", label: "Mark trimmed" },
      { key: "demote", label: "Demote" },
    ]);
  });

  it("trim packages picks from the Unloaded Queue, not the Dry Space Queue", () => {
    const pick = stationByKey("trim_packages")!.fields.find(
      (f) => f.name === "wet_weight_entry_id"
    );
    expect(pick).toMatchObject({
      name: "wet_weight_entry_id",
      label: "Lot",
      input: "queue_pick",
      queue: "unloaded_queue",
      required: true,
    });
    expect(pick?.help?.en).toMatch(/Unloaded lot/);
  });

  it("cryo and testing queues inherit short_id and strain_name and keep the full HBN", () => {
    for (const key of ["cryo_queue", "testing_queue"]) {
      const cols = queueByKey(key)!.columns;
      expect(cols).toContainEqual({ field: "short_id", label: "Lot" });
      expect(cols).toContainEqual({ field: "strain_name", label: "Strain" });
      expect(cols).toContainEqual({ field: "hbn", label: "HBN" });
    }
  });
});

describe("unload record panel (owner ruling 2026-08-31)", () => {
  const station = () => stationByKey("unload_dry_space")!;
  const lot = {
    id: "lot9",
    hbn: "26244-ARL-GH-027-0-NA-26002",
    metrc_harvest_tag: "1A4000000000000000A4B7C9",
    strain_name: "Fruity Pebbles",
    dry_space_name: "Silo 1",
    weight_grams: 1234.56,
  };
  const weights = [
    { id: "d2", weight_grams: 250.5, created_at: "2026-08-31T00:01:00.000Z" },
    { id: "d1", weight_grams: 500.25, created_at: "2026-08-31T00:00:00.000Z" },
  ];

  it("heads with the short id and strain, keeps the full HBN muted, and mirrors the wet controls", () => {
    const html = unloadLotPanel(station(), lot, weights, 750.75);
    expect(html).toContain('<h2 class="working-pick">26002 - Fruity Pebbles</h2>');
    expect(html).toContain('<p class="muted">26244-ARL-GH-027-0-NA-26002</p>');
    expect(html).toContain("From");
    expect(html).toContain("Silo 1");
    expect(html).toContain("Dry weights");
    expect(html).toContain('action="/station/unload_dry_space/lot/lot9/weights"');
    expect(html).toContain('action="/station/unload_dry_space/lot/lot9/finish"');
    expect(html).toContain('href="/record/dry_weights/d1/edit"');
    expect(html).toContain('href="/record/dry_weights/d1/void"');
    expect(html).toContain('href="/record/dry_weights/d2/edit"');
    expect(html).toContain("Finish unload");
    expect(html).not.toContain("Finish lot");
    expect(html).not.toContain("wet_weights");
  });

  it("is a right-pane fragment: no page heading of its own (owner ruling 2026-08-31)", () => {
    const html = unloadLotPanel(station(), lot, weights, 750.75);
    expect(html).not.toContain("<h1>");
    expect(html.startsWith('<h2 class="working-pick">')).toBe(true);
  });

  it("renders the Dry total outside the pane at the bottom, wet precedent", () => {
    const html = unloadLotPanel(station(), lot, weights, 750.75);
    expect(html).toContain("Dry total: <strong>751</strong> g");
    expect(html.indexOf("Dry total")).toBeGreaterThan(html.indexOf("</section>"));
  });

  it("shows Original (wet) and the live Remaining above the dry weights (owner ruling 2026-08-31: balance displays)", () => {
    // The ruling, verbatim: "The weights of the original package and what's
    // left after a record is created should be on the weight recording pages."
    const html = unloadLotPanel(station(), lot, weights, 750.75);
    expect(html).toContain("<dt>Original (wet)</dt><dd>1,235 g</dd>");
    expect(html).toContain("<dt>Remaining</dt><dd>484 g</dd>");
    expect(html.indexOf("Original (wet)")).toBeLessThan(html.indexOf('class="weights-pane"'));
    // A rule of thumb only: drying loses weight, so it can go negative and renders as-is.
    const over = unloadLotPanel(station(), { ...lot, weight_grams: 700 }, weights, 750.75);
    expect(over).toContain("<dt>Remaining</dt><dd>-51 g</dd>");
    // Zero dry rows leave Remaining at the full wet total.
    const fresh = unloadLotPanel(station(), lot, [], 0);
    expect(fresh).toContain("<dt>Remaining</dt><dd>1,235 g</dd>");
  });

  it("renders just the serial when the batch has no tag, and translates the chrome in es", () => {
    const bare = unloadLotPanel(station(), { ...lot, metrc_harvest_tag: null }, [], 0);
    expect(bare).toContain('<h2 class="working-pick">26002 - Fruity Pebbles</h2>');
    expect(bare).toContain("No weights yet.");
    expect(bare).toContain("Dry total: <strong>0</strong> g");
    const es = unloadLotPanel(station(), lot, weights, 750.75, "es");
    expect(es).toContain("Pesos secos");
    expect(es).toContain("Terminar descarga");
    expect(es).toContain("Total seco: <strong>751</strong> g");
    // Balance labels translate too (owner ruling 2026-08-31: balance displays).
    expect(es).toContain("<dt>Original (húmedo)</dt><dd>1,235 g</dd>");
    expect(es).toContain("<dt>Restante</dt><dd>484 g</dd>");
    // User-entered data never translates.
    expect(es).toContain("26002 - Fruity Pebbles</h2>");
  });
});

describe("unload two-pane page (owner ruling 2026-08-31)", () => {
  // The ruling, verbatim: "left pane: available-in-queue, right pane: what's
  // currently saved about that record and the ability to add more to it."
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const station = () => stationByKey("unload_dry_space")!;
  const queuesByKey: Record<string, QueueDef> = {
    dry_space_queue: queueByKey("dry_space_queue")!,
  };
  const rows: QueueRow[] = [
    {
      id: "lot9",
      values: {
        hbn: "26244-ARL-GH-027-0-NA-26002",
        dry_space_name: "Silo 1",
        weight_grams: "1234.56",
      },
    },
    {
      id: "lot8",
      values: {
        hbn: "26244-ARL-GH-027-0-NA-26001",
        dry_space_name: "Hang Room",
        weight_grams: "900",
      },
    },
  ];
  const lot = {
    id: "lot9",
    hbn: "26244-ARL-GH-027-0-NA-26002",
    metrc_harvest_tag: "1A4000000000000000A4B7C9",
    strain_name: "Fruity Pebbles",
    dry_space_name: "Silo 1",
    weight_grams: 1234.56,
  };
  const page = (pickId?: string, panel?: string, locale: "en" | "es" = "en") =>
    stationPage(
      station(),
      people,
      "p1",
      {},
      { dry_space_queue: rows },
      queuesByKey,
      pickId,
      undefined,
      rows,
      locale,
      panel
    );

  it("carries both the pane group markup and the record panel on a pick", () => {
    const panel = unloadLotPanel(station(), lot, [], 0);
    const html = page("lot9", panel);
    // Left pane: the grouped queue, the picked lot's group open, its row marked.
    expect(html).toContain('<h1>Unload Dry Space</h1>');
    expect(html).toContain('class="station-split"');
    expect(html).toContain(
      '<details class="pane-group" open><summary>Silo 1 <span class="tile-count">1</span></summary>'
    );
    expect(html).toContain(
      '<details class="pane-group"><summary>Hang Room <span class="tile-count">1</span></summary>'
    );
    expect(html).toContain(
      '<a class="queue-pane-item selected" href="/station/unload_dry_space?pick=lot9">'
    );
    expect(html).toContain(
      '<a class="queue-pane-item" href="/station/unload_dry_space?pick=lot8">'
    );
    // Right pane: the record panel with the short-id heading, in the working pane.
    expect(html).toContain('<div class="working-pane">');
    expect(html).toContain('<h2 class="working-pick">26002 - Fruity Pebbles</h2>');
    expect(html).toContain('action="/station/unload_dry_space/lot/lot9/weights"');
    // No header create form on a direct station: no Save, no Start lot.
    expect(html).not.toContain('action="/station/unload_dry_space"');
    expect(html).not.toContain("Start lot");
  });

  it("prompts for a lot from the pane when nothing is picked, en and es", () => {
    const html = page();
    expect(html).toContain('class="queue-pane"');
    expect(html).toContain("Pick a lot from the pane.");
    expect(html).not.toContain("Pick from the left to begin.");
    expect(html).not.toContain("<form");
    const es = page(undefined, undefined, "es");
    expect(es).toContain("Elija un lote del panel.");
  });

  it("treats a pick without a panel as no pick, never a header form", () => {
    const html = page("lot9");
    expect(html).toContain("Pick a lot from the pane.");
    expect(html).not.toContain("<form");
  });

  it("keeps the wet prompt on the wet station untouched", () => {
    const wet = stationPage(
      stationByKey("wet_weight")!,
      people,
      "p1",
      {},
      { hbn_queue: [] },
      { hbn_queue: queueByKey("hbn_queue")! }
    );
    expect(wet).toContain("Pick from the left to begin.");
    expect(wet).not.toContain("Pick a lot from the pane.");
  });
});

describe("wet lot two-pane view (owner ruling 2026-08-31)", () => {
  // The ruling: the two-pane theme is the station law for everything, so the
  // wet lot view rides stationPage with the lot panel as the right pane.
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const wet = () => stationByKey("wet_weight")!;
  const queuesByKey: Record<string, QueueDef> = { hbn_queue: queueByKey("hbn_queue")! };
  const rows: QueueRow[] = [
    {
      id: "hb1",
      values: { hbn: "26240-ARL-GH-027-0-NA-26001", strain_name: "Fruity Pebbles", farm_code: "ARL", entry_date: "2026-08-28" },
    },
    {
      id: "hb2",
      values: { hbn: "26240-PNS-GH-027-0-NA-26002", strain_name: "Fruity Pebbles", farm_code: "PNS" },
    },
  ];
  const lot = {
    id: "lot1",
    hbn: "26240-ARL-GH-027-0-NA-26001",
    farm_code: "ARL",
    strain_name: "Fruity Pebbles",
    entry_date: "2026-08-28",
    notes: "smoke lot",
    dry_space_name: "Silo 1",
    truck_number: null,
    lead_name: "Pat",
  };
  const weights = [{ id: "w1", weight_grams: 1000.06, created_at: "2026-08-31T00:00:00.000Z" }];
  const panel = () => wetLotPanel(wet(), lot, weights, "Arlington", 1000.06);
  const page = (pickId?: string) =>
    stationPage(wet(), people, "p1", {}, {}, queuesByKey, pickId, undefined, rows, "en", panel());

  it("carries the hbn pane and the lot panel together, the batch row marked picked", () => {
    const html = page("hb1");
    expect(html).toContain("<h1>Wet Weight Entry</h1>");
    expect(html).toContain('class="station-split"');
    expect(html).toContain('class="queue-pane"');
    expect(html).toContain(
      '<details class="pane-group" open><summary>ARL <span class="tile-count">1</span></summary>'
    );
    expect(html).toContain(
      '<a class="queue-pane-item selected" href="/station/wet_weight?pick=hb1">'
    );
    expect(html).toContain('<div class="working-pane">');
    expect(html).toContain("ARL / Fruity Pebbles / 2026-08-28</h2>");
    expect(html).toContain('<p class="muted">26240-ARL-GH-027-0-NA-26001</p>');
    expect(html).toContain("smoke lot");
    expect(html).toContain('action="/station/wet_weight/lot/lot1/weights"');
    expect(html).toContain('action="/station/wet_weight/lot/lot1/finish"');
    expect(html).toContain('href="/record/wet_weights/w1/edit"');
    expect(html).toContain('href="/record/wet_weights/w1/void"');
    // Owner ruling 2026-08-31: add commas to all thousands (display only).
    expect(html).toContain("Total: <strong>1,000</strong> g");
    // No header create form on the lot view: no Start lot, no Lead picker.
    expect(html).not.toContain("Start lot");
    expect(html).not.toContain('name="lead_person_id"');
    expect(html).not.toContain('action="/station/wet_weight"');
  });

  it("still renders the panel when the lot's batch has left the pane, no row marked", () => {
    const html = page("");
    expect(html).toContain('class="queue-pane"');
    expect(html).toContain("ARL / Fruity Pebbles / 2026-08-28</h2>");
    expect(html).toContain('<p class="muted">26240-ARL-GH-027-0-NA-26001</p>');
    expect(html).toContain("Finish load");
    expect(html).not.toContain("queue-pane-item selected");
    expect(html).not.toContain('<details class="pane-group" open>');
    expect(html).not.toContain("Pick from the left to begin.");
  });

  it("wetLotPanel is a right-pane fragment: no page heading of its own", () => {
    const html = panel();
    expect(html).not.toContain("<h1>");
    expect(html.startsWith('<h2 class="working-pick">')).toBe(true);
  });

  // Owner report 2026-09-01 (duplicate-lot guard): the lot panel carries the one
  // deliberate path back to a blank header, a Start another lot link with new=1
  // so the pick redirect does not bounce it straight back to the lot.
  it("links Start another lot back to the pick with new=1 when the lot knows its batch", () => {
    const html = wetLotPanel(
      wet(),
      { ...lot, harvest_batch_id: "hb1" },
      weights,
      "Arlington",
      1000.06
    );
    expect(html).toContain(
      '<a class="secondary" href="/station/wet_weight?pick=hb1&amp;new=1">Start another lot</a>'
    );
  });

  it("omits the Start another lot link when the lot carries no batch id", () => {
    expect(panel()).not.toContain("Start another lot");
  });

  it("lotPage stays the thin standalone wrapper: the station heading over the same panel", () => {
    const html = lotPage(wet(), lot, weights, "Arlington", 1000.06);
    expect(html).toContain("<h1>Wet Weight Entry</h1>");
    expect(html).toContain(panel());
  });

  // Owner ruling 2026-09-14 (canon 0.30.58), verbatim: "Put a number starting at
  // one and going to infinity for every weight in wet weight entry, add to the
  // top of the list like before (the TLs will ask how many totes before I start
  // the silo)". The list stays newest first; the number counts the lot's live
  // weights from the first one, so the top row reads the tote count.
  describe("the tote count on the wet weights (owner ruling 2026-09-14)", () => {
    const three = [
      { id: "w3", weight_grams: 3000, created_at: "2026-09-14T12:02:00.000Z" },
      { id: "w2", weight_grams: 2000, created_at: "2026-09-14T12:01:00.000Z" },
      { id: "w1", weight_grams: 1000, created_at: "2026-09-14T12:00:00.000Z" },
    ];

    it("numbers every weight from one, the newest at the top carrying the count", () => {
      const html = wetLotPanel(wet(), lot, three, "Arlington", 6000);
      expect(html).toContain('<table class="data weights-numbered">');
      expect(html).toContain('<th class="weight-seq" title="Totes so far, counted from the first weight">#</th><th>Weight (g)</th>');
      const seqs = [...html.matchAll(/data-weight-seq="(\d+)"/g)].map((m) => Number(m[1]));
      expect(seqs).toEqual([3, 2, 1]);
      expect(html).toContain('<tr data-weight-seq="3">\n        <td class="weight-seq">3</td><td>3,000</td>');
      expect(html).toContain('<tr data-weight-seq="1">\n        <td class="weight-seq">1</td><td>1,000</td>');
      // The first weight of a lot reads 1 alone.
      const one = wetLotPanel(wet(), lot, weights, "Arlington", 1000.06);
      expect([...one.matchAll(/data-weight-seq="(\d+)"/g)].map((m) => Number(m[1]))).toEqual([1]);
    });

    // Owner ruling 2026-09-14 (canon 0.30.60), verbatim: "Add the running total
    // weight under "NOTES" in wet weight entry" then "in grams and lbs".
    it("shows the running total under Notes in grams and pounds, the bottom total kept", () => {
      const html = wetLotPanel(wet(), lot, three, "Arlington", 6000);
      expect(html).toContain(
        '<dt>Notes</dt><dd>smoke lot</dd>\n      <dt>Running total</dt><dd class="lot-running-total" data-lot-running-total><strong>6,000</strong> g · <strong>13.39</strong> lb</dd>'
      );
      // 6,000 g at 448 g/lb is 13.39 lb; the bottom total stays (owner ruling 2026-08-28).
      expect(html).toContain("Total: <strong>6,000</strong> g");
      const one = wetLotPanel(wet(), lot, weights, "Arlington", 1000.06);
      expect(one).toContain('<dd class="lot-running-total" data-lot-running-total><strong>1,000</strong> g · <strong>2.23</strong> lb</dd>');
      const empty = wetLotPanel(wet(), lot, [], "Arlington", 0);
      expect(empty).toContain('<dd class="lot-running-total" data-lot-running-total><strong>0</strong> g · <strong>0.00</strong> lb</dd>');
    });

    // THE PLANT COUNT (owner ruling 2026-09-14, canon 0.30.62), verbatim: "When
    // you click "finish lot" in wet weights, prompt for the number of plants.
    // Leave an option on the prompt to click "skip"."
    it("Finish lot first asks how many plants, with Skip, on the wet panel alone", () => {
      const html = wetLotPanel(wet(), lot, three, "Arlington", 6000);
      expect(html).toContain('class="row-actions finish-with-plants" data-plant-prompt-form');
      expect(html).toContain('<button type="submit" class="secondary" data-plant-prompt-open>Finish load</button>');
      expect(html).toContain('<div class="plant-prompt" data-plant-prompt hidden>');
      expect(html).toContain("How many plants in this load?");
      expect(html).toMatch(/name="plant_count"[^>]*inputmode="numeric"[^>]*data-plant-count-input/);
      expect(html).toContain('<button type="submit" name="plant_prompt" value="count">Finish load</button>');
      expect(html).toContain('<button type="submit" name="plant_prompt" value="skip" class="secondary" data-plant-skip>Skip</button>');
      expect(html).toContain("Skip asks again at Load Silo");
      expect(html).toContain('document.querySelector("[data-plant-prompt-form]")');
      // The METRC tag box still rides the finish form (THE TAG LAW).
      expect(html).toMatch(/data-plant-prompt-form[\s\S]*name="metrc_tag"[\s\S]*data-plant-prompt-open/);
      // No count yet: no Plants row; a counted lot shows it under the running total.
      expect(html).not.toContain("data-plant-count>");
      const counted = wetLotPanel(wet(), { ...lot, plant_count: 120 }, three, "Arlington", 6000);
      expect(counted).toContain("<dt>Plants</dt><dd data-plant-count>120</dd>");
      const dry = unloadLotPanel(
        stationByKey("unload_dry_space")!,
        { id: "lot9", hbn: "26244-ARL-GH-027-0-NA-26002", metrc_harvest_tag: null, strain_name: "Fruity Pebbles", dry_space_name: "Silo 1", weight_grams: 1234.56 },
        three,
        6000
      );
      expect(dry).not.toContain("data-plant-prompt");
    });

    it("keeps the dry (unload) weights unnumbered until the owner says otherwise", () => {
      const html = unloadLotPanel(
        stationByKey("unload_dry_space")!,
        { id: "lot9", hbn: "26244-ARL-GH-027-0-NA-26002", metrc_harvest_tag: null, strain_name: "Fruity Pebbles", dry_space_name: "Silo 1", weight_grams: 1234.56 },
        three,
        6000
      );
      expect(html).not.toContain("weights-numbered");
      expect(html).not.toContain("data-weight-seq");
      expect(html).toContain("<th>Weight (g)</th>");
    });
  });
});

// Owner ruling 2026-09-02, verbatim: "Add a [Demote] button on the data queues
// menu for each record. Clicking it prompts the user with a warning and kicks
// the record back down to the last process it was at."
describe("demote control render (owner ruling 2026-09-02)", () => {
  const row: QueueRow = { id: "lot9", values: { hbn: "26240-ARL-GH-027-0-NA-26001" } };

  it("renders the Demote form with the confirm warning on a demotable queue", () => {
    const html = queueSection(queueByKey("dry_space_queue")!, [row]);
    expect(html).toContain('name="control" value="demote"');
    expect(html).toContain(
      "onsubmit=\"return confirm('Demote kicks this record back to the last process it was at. Continue?')\""
    );
    expect(html).toContain(">Demote</button>");
    // The step-back sits beside the queue's own exit, never replacing it.
    expect(html).toContain('name="control" value="mark_trimmed"');
  });

  it("renders no Demote on a birth-status queue", () => {
    const html = queueSection(queueByKey("hbn_queue")!, [row]);
    expect(html).not.toContain('value="demote"');
    expect(html).toContain('name="control" value="mark_complete"');
    expect(html).toContain('data-fold="hbn_queue" open');
    expect(html).toContain('data-pipeline-key="hbn_queue"');
    expect(html).toContain('name="id" value="lot9"');
    expect(html).toContain('data-check-all="qf-hbn_queue"');
    expect(html).toContain('action="/admin/queues/hbn_queue/void-checked"');
  });
});

describe("trim packages pane (owner ruling 2026-08-31)", () => {
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const station = () => stationByKey("trim_packages")!;
  const queuesByKey: Record<string, QueueDef> = { unloaded_queue: queueByKey("unloaded_queue")! };
  const rows: QueueRow[] = [
    {
      id: "lot1",
      values: {
        short_id: "26001",
        strain_name: "Fruity Pebbles",
        dry_weight_grams: "751",
        metrc_harvest_tag: "1A4060300003E5B000012345",
      },
    },
    {
      id: "lot2",
      values: { short_id: "26002", strain_name: "Gelato", dry_weight_grams: "600", metrc_harvest_tag: "" },
    },
  ];
  const lookups = { package_types: [{ value: "BUD", label: "Bud" }] };
  const page = (pickId?: string) =>
    stationPage(
      station(),
      people,
      "p1",
      lookups,
      { unloaded_queue: rows },
      queuesByKey,
      pickId,
      undefined,
      rows
    );

  it("declares the Unloaded Queue left pane with no groupBy", () => {
    expect(station().leftPane).toEqual({
      queue: "unloaded_queue",
      pickField: "wet_weight_entry_id",
      paneFilter: "trim_scheduled",
    });
    expect(station().leftPane?.groupBy).toBeUndefined();
  });

  it("renders the flat pane and the wet prompt with no pick; no dropdown, no form", () => {
    const html = page();
    expect(html).toContain('class="queue-pane"');
    expect(html).toContain('href="/station/trim_packages?pick=lot1"');
    expect(html).toContain('href="/station/trim_packages?pick=lot2"');
    expect(html).not.toContain('<details class="pane-group"');
    expect(html).toContain("Pick from the left to begin.");
    expect(html).not.toContain("<form");
    expect(html).not.toContain('<select name="wet_weight_entry_id"');
  });

  it("heads the right pane with the picked row's label and hides the pick behind a hidden input", () => {
    const html = page("lot1");
    // The saved-record side. Owner ruling 2026-09-08 (canon 0.30.9, his
    // picture "[Last 6 of Tag Number]/26001/TEST MOOKY/250,000(drop the
    // decimals)"): from Trim forward the lot reads last-6-of-tag / serial /
    // market strain / whole grams; a blank tag drops its token.
    expect(html).toContain('<h2 class="working-pick">012345 / 26001 / Fruity Pebbles / 751</h2>');
    expect(html).toContain(">26002 / Gelato / 600</a>");
    expect(html).not.toContain("751.00</h2>");
    // Canon 0.30.9 (R7): the date and the hand-typed operator ride the form
    // above the package rows. THE EFFECTIVE DATE PER STATION (canon 0.30.94):
    // that date is now the Effective Date component (posts effective_date, PIN
    // beside it, client-defaulted to today).
    expect(html).toContain('<details class="effective-date" data-effective-date>');
    expect(html).toMatch(/<input type="date" name="effective_date" data-effective-input data-effective-default="" data-effective-auto>/);
    expect(html).toContain('name="effective_pin"');
    expect(html).toContain('name="trim_operator"');
    expect(html.indexOf('name="trim_operator"')).toBeLessThan(html.indexOf('id="pkg-rows"'));
    expect(html).toContain('<input type="hidden" name="wet_weight_entry_id" value="lot1">');
    expect(html).not.toContain('<select name="wet_weight_entry_id"');
    expect(html).toContain('<a class="queue-pane-item selected" href="/station/trim_packages?pick=lot1">');
    // The add-more side: the packages form posting to the station.
    expect(html).toContain('action="/station/trim_packages"');
    expect(html).toContain('id="pkg-rows"');
    // Owner walk report 2026-09-04 (canon 0.22.0): the [+] rapid-add replaces
    // the Add package clone button; the entry line starts blank and unrequired.
    expect(html).toContain('name="plus_one" value="1"');
    expect(html).not.toContain("Add package");
    expect(html).not.toContain('name="package_code" required');
  });

  it("treats a pick outside the pane rows as no pick", () => {
    const html = page("nope");
    expect(html).toContain("Pick from the left to begin.");
    expect(html).not.toContain("<form");
  });

  it("renders Original (dry) / Recorded / Remaining above the packages form when the route passes the balance (owner ruling 2026-08-31: balance displays)", () => {
    // The ruling, verbatim: "The weights of the original package and what's
    // left after a record is created should be on the weight recording pages."
    const html = stationPage(
      station(),
      people,
      "p1",
      lookups,
      { unloaded_queue: rows },
      queuesByKey,
      "lot1",
      undefined,
      rows,
      "en",
      undefined,
      { original: 751, recorded: 120.5, remaining: 630.5 }
    );
    expect(html).toContain("<dt>Original (dry)</dt><dd>751 g</dd>");
    expect(html).toContain("<dt>Recorded</dt><dd>121 g</dd>");
    expect(html).toContain("<dt>Remaining</dt><dd>631 g</dd>");
    expect(html.indexOf("Original (dry)")).toBeLessThan(
      html.indexOf('action="/station/trim_packages"')
    );
    const es = stationPage(
      station(),
      people,
      "p1",
      lookups,
      { unloaded_queue: rows },
      queuesByKey,
      "lot1",
      undefined,
      rows,
      "es",
      undefined,
      { original: 751, recorded: 120.5, remaining: 630.5 }
    );
    expect(es).toContain("<dt>Original (seco)</dt><dd>751 g</dd>");
    expect(es).toContain("<dt>Registrado</dt><dd>121 g</dd>");
    expect(es).toContain("<dt>Restante</dt><dd>631 g</dd>");
  });

  it("renders no balance list without the ctx, and the no-pick page never carries one", () => {
    expect(page("lot1")).not.toContain("Original (dry)");
    expect(page()).not.toContain("Original (dry)");
  });

  it("renders the trim reconcile gate on Save when remaining is nonzero and hides Save", () => {
    const html = stationPage(
      station(),
      people,
      "p1",
      lookups,
      { unloaded_queue: rows },
      queuesByKey,
      "lot1",
      undefined,
      rows,
      "en",
      undefined,
      { original: 751, recorded: 800, remaining: -49 },
      undefined,
      true
    );
    // Canon 0.30.9 (R6, his words: "when I go over in trim packages entry, I
    // need to be prompted that I'm at 0 and the option provided to remove it
    // from queue."): past zero the REMAINING 0 prompt with [Remove from queue]
    // stands where the over gate used to; the overage is named and the
    // adjustment CSV promised.
    expect(html).not.toContain("data-reconcile-gate");
    expect(html).toContain('data-remaining-zero data-over="1"');
    expect(html).toContain("Remaining 0.");
    expect(html).toContain("Over by 49 g.");
    expect(html).toContain("Removing it pends the adjustment CSV at the export home.");
    expect(html).toContain('name="gate_choice" value="remove"');
    expect(html).toContain(">Remove from queue</button>");
    expect(html).not.toContain("Queue a package finish CSV");
    expect(html).not.toContain('name="gate_choice" value="queue_finish"');
    // Exactly zero prompts too, without an overage line.
    const zero = stationPage(
      station(),
      people,
      "p1",
      lookups,
      { unloaded_queue: rows },
      queuesByKey,
      "lot1",
      undefined,
      rows,
      "en",
      undefined,
      { original: 751, recorded: 751, remaining: 0 }
    );
    expect(zero).toContain('data-remaining-zero data-over="0"');
    expect(zero).toContain("Remaining 0.");
    expect(zero).not.toContain("Over by");
    expect(zero).toContain(">Remove from queue</button>");
    // Short of the parent: no prompt; the under gate still asks on Save.
    const under = stationPage(
      station(),
      people,
      "p1",
      lookups,
      { unloaded_queue: rows },
      queuesByKey,
      "lot1",
      undefined,
      rows,
      "en",
      undefined,
      { original: 751, recorded: 120.5, remaining: 630.5 },
      undefined,
      true
    );
    expect(under).not.toContain("data-remaining-zero");
    expect(under).toContain("data-reconcile-gate");
    expect(under).toContain("Recorded short of the parent.");
    expect(under).toContain('name="gate_choice" value="queue_adjust"');
    expect(under).not.toMatch(/<button type="submit">Save<\/button>/);
    const skip = stationPage(
      station(),
      people,
      "p1",
      lookups,
      { unloaded_queue: rows },
      queuesByKey,
      "lot1",
      undefined,
      rows,
      "en",
      undefined,
      { original: 751, recorded: 751, remaining: 0 },
      undefined,
      true
    );
    expect(skip).not.toContain("data-reconcile-gate");
    expect(skip).toMatch(/<button type="submit">Save<\/button>/);
  });
});

describe("cryo weight pane (owner ruling 2026-08-31) as THE CRYO RUN (canon 0.30.110) reshaped it", () => {
  it("declares the run pane: the Cryo Queue's law under paneFilter cryo_scheduled, the pick a run, no header form", () => {
    const station = stationByKey("cryo_weight")!;
    expect(station.leftPane).toEqual({ queue: "cryo_queue", pickField: "run_id", paneFilter: "cryo_scheduled" });
    expect(station.transition).toBeUndefined();
    expect(station.fields.map((f) => f.name)).toEqual(["effective_date", "cryo_operator", "cryo_lines"]);
    // The generic renderer draws nothing for the line; cryo.ts owns the page.
    const line = station.fields.find((f) => f.input === "cryo_lines")!;
    expect(renderField(line, {}, {}, {}, "en")).toBe("");
  });
});

describe("operations map home (owner ruling 2026-09-02)", () => {
  it("renders six nodes, the four arrows, and a live Marketplace href", () => {
    const html = homePage(PIPELINE);
    expect(html).toContain("<h1>Operations</h1>");
    expect(html).toContain('data-ops-key="harvest_ops"');
    expect(html).toContain('data-ops-key="interco_logistics"');
    expect(html).toContain('data-ops-key="drying_ops"');
    expect(html).toContain('data-ops-key="production_ops"');
    expect(html).toContain('data-ops-key="marketplace"');
    expect(html).toContain('data-ops-key="business_ops"');
    expect(html).toContain('href="/ops/harvest_ops"');
    expect(html).toContain('href="/ops/interco_logistics"');
    expect(html).toContain("Logistics Operations");
    expect(html).toContain('href="/ops/drying_ops"');
    expect(html).toContain('href="/ops/production_ops"');
    expect(html).toContain('href="/marketplace"');
    expect(html).toContain('href="/ops/business_ops"');
    expect(html).toContain('class="ops-arrow ops-arrow-right"');
    expect(html).toContain('class="ops-arrow ops-arrow-down"');
    expect(html).toContain('class="ops-arrow ops-arrow-left"');
    expect(html).toContain("ops-map-desktop");
    expect(html).toContain("ops-map-phone");
    const market = html.slice(
      html.indexOf('data-ops-key="marketplace"') - 50,
      html.indexOf('data-ops-key="marketplace"') + 40
    );
    expect(market).not.toContain("ops-node-stub");
    expect(html.match(/data-ops-key="/g)?.length).toBe(12);
  });

  it("titles home Operations in en and Operaciones in es", () => {
    expect(homePage(PIPELINE, "en")).toContain("<h1>Operations</h1>");
    expect(homePage(PIPELINE, "es")).toContain("<h1>Operaciones</h1>");
  });

  it("phone map lists the six groups in flow order with down arrows only", () => {
    const html = homePage(PIPELINE);
    const start = html.indexOf('class="ops-map ops-map-phone"');
    const end = html.indexOf("</div>", start);
    const phone = html.slice(start, end);
    const keys = [...phone.matchAll(/data-ops-key="([^"]+)"/g)].map((m) => m[1]);
    // Owner ruling 2026-09-02 (evening): Business Operations joins the flow
    // between Production and Marketplace.
    expect(keys).toEqual([
      "harvest_ops",
      "interco_logistics",
      "drying_ops",
      "production_ops",
      "business_ops",
      "marketplace",
    ]);
    expect(phone).not.toContain("ops-arrow-right");
    expect(phone).not.toContain("ops-arrow-left");
    expect((phone.match(/ops-arrow-down/g) || []).length).toBe(5);
  });
});

describe("ops group pages (owner ruling 2026-09-02)", () => {
  it("Harvest Operations carries Acquire then Wet Weight; the way back rides the crumb (canon 0.30.109)", () => {
    const html = opsGroupPage(opsGroupByKey("harvest_ops")!);
    expect(html).toContain("Harvest Operations</h1>");
    // THE BACK LINK: the layout's crumb carries the way back to the map; the
    // page repeats no link of its own.
    expect(html).not.toContain('<p><a href="/">');
    expect(backLinkFor("/ops/harvest_ops")).toEqual({ href: "/", label: "Home" });
    expect(html).toContain('data-pipeline-key="acquire_hbn"');
    expect(html).toContain('data-pipeline-key="wet_weight"');
    expect(html.indexOf('data-pipeline-key="acquire_hbn"')).toBeLessThan(
      html.indexOf('data-pipeline-key="wet_weight"')
    );
    expect(html).toContain('class="tiles"');
  });

  it("Virtual move is a live tile at /virtual-move", () => {
    const drying = opsGroupPage(opsGroupByKey("drying_ops")!);
    expect(drying).toContain(
      '<a class="tile" href="/virtual-move" data-pipeline-key="virtual_move_processor">'
    );
    expect(drying).not.toContain("tile-stub");
  });
});

describe("Reports node (canon 0.17.0)", () => {
  it("lists the five report cards", () => {
    const en = reportsPage("en");
    expect(en).toContain("<h1>Reports</h1>");
    expect(en).toContain("/reports/inventory");
    expect(en).not.toContain("src/reports.ts");
    const es = reportsPage("es");
    expect(es).toContain("<h1>Informes</h1>");
  });
});

describe("Import Data queue surface (owner ruling 2026-09-02)", () => {
  const row: ImportQueueRow = {
    id: "imp1",
    filename: "lots.csv",
    kind: "csv",
    byte_size: 42,
    status: "queued",
    created_at: "2026-09-02T12:00:00.000Z",
    created_by: "p1",
    uploaded_by: "Pat",
  };

  it("empty state shows the upload form and Nothing queued.", () => {
    const html = importQueuePage([]);
    expect(html).toContain("<h1>Import Data</h1>");
    expect(html).toContain("Nothing queued.");
    expect(html).toContain('enctype="multipart/form-data"');
    expect(html).toContain('accept=".csv,.xlsx,.xlsb,.xlsm"');
    expect(html).toContain('name="file"');
    expect(html).toContain("Queue file");
    expect(html).not.toContain("<table");
    expect(importQueuePage([], "es")).toContain("Nada en cola.");
  });

  it("lists a queued file with Download and Void, and no Edit", () => {
    const html = importQueuePage([row]);
    expect(html).toContain("<td>lots.csv</td>");
    expect(html).toContain("<td>csv</td>");
    expect(html).toContain("<td>42 B</td>");
    expect(html).toContain("<td>queued</td>");
    expect(html).toContain("<td>Pat</td>");
    expect(html).toContain("<td>2026-09-02T12:00:00.000Z</td>");
    expect(html).toContain('href="/admin/imports/imp1/download"');
    expect(html).toContain('href="/record/import_queue/imp1/void"');
    expect(html).not.toContain("/edit");
    expect(html).not.toContain(">Edit<");
  });
});
