import { describe, expect, it } from "vitest";
import {
  CAT_UOM,
  READOUT_CATEGORIES,
  SO_STATUSES,
  ZOHO_IGNORE,
  categoryForSub,
  compareRack,
  effectiveStatus,
  isIsoDate,
  isZohoSalesOrderExport,
  looksLikeZohoFilename,
  mountSosPage,
  parseZohoSalesOrders,
  pickOrdersPage,
  pickSheetHtml,
  pipelineCounts,
  pipelineTable,
  rackSortKey,
  soStatusDetail,
  sortLinesForPick,
  zohoDate,
  type OrderWithLines,
} from "../src/fulfillment";
import { csvObjects } from "../src/csv";
import type { MountedLineRow, MountedOrderRow, SoMountRow } from "../src/db";
import { t } from "../src/i18n";

/* A Zoho Inventory Sales Order export, the real column names (the export
 * carries 96; these are the ones the mount reads), one row per line. */
const ZOHO_HEADER = [
  "SalesOrder Number",
  "SalesOrder ID",
  "Order Date",
  "Expected Shipment Date",
  "Status",
  "Customer Name",
  "Customer ID",
  "Sales Person",
  "Item Name",
  "SKU",
  "QuantityOrdered",
  "QuantityInvoiced",
  "QuantityPacked",
  "Usage unit",
  "Item Price",
  "Item.CF.Product Sub",
  "Item.CF.Location Code",
  "CF.Customer License #",
  "CF.Destination License #",
  "CF.Origin License #",
  "CF.Status (Internal)",
  "Delivery Method",
  "Location Name",
];

function row(over: Record<string, string>): string[] {
  const base: Record<string, string> = {
    "SalesOrder Number": "SO-00901",
    "SalesOrder ID": "1234567890",
    "Order Date": "2026-09-01",
    "Expected Shipment Date": "2026-09-08",
    Status: "confirmed",
    "Customer Name": "Green Leaf Dispensary",
    "Customer ID": "555",
    "Sales Person": "Sales One",
    "Item Name": "Blue Dream Bulk Flower",
    SKU: "1A4FF0100000022000012345",
    QuantityOrdered: "10",
    QuantityInvoiced: "0",
    QuantityPacked: "0",
    "Usage unit": "lb",
    "Item Price": "600.00",
    "Item.CF.Product Sub": "Bulk Flower",
    "Item.CF.Location Code": "P2.3.A",
    "CF.Customer License #": "C10-0000001-LIC",
    "CF.Destination License #": "C10-0000001-LIC",
    "CF.Origin License #": "C11-0000002-LIC",
    "CF.Status (Internal)": "Approved",
    "Delivery Method": "Grip",
    "Location Name": "Ahlgren",
  };
  return ZOHO_HEADER.map((h) => over[h] ?? base[h] ?? "");
}

function csv(rows: string[][]): string {
  return [ZOHO_HEADER, ...rows].map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\r\n");
}

const SAMPLE = csv([
  row({}),
  row({ "Item Name": "Blue Dream Trim", SKU: "1A4FF0100000022000012346", "Item.CF.Product Sub": "Trim", "Item.CF.Location Code": "P1.1.B", QuantityOrdered: "25" }),
  row({ "Item Name": "CRIF", SKU: "", "Item.CF.Product Sub": "CRIF Fee", QuantityOrdered: "1", "Item.CF.Location Code": "" }),
  row({
    "SalesOrder Number": "SO-00902",
    "Customer Name": "North Star",
    "CF.Status (Internal)": "Submitted",
    "Expected Shipment Date": "2026-09-10",
    "Item Name": "Infused Pre-Rolls 5pk",
    SKU: "1A4FF0100000022000012347",
    "Item.CF.Product Sub": "Infused Pre-Rolls",
    "Usage unit": "ea",
    QuantityOrdered: "200",
    "Item.CF.Location Code": "Oxford N",
  }),
  row({
    "SalesOrder Number": "SO-00903",
    "Customer Name": "Harbor",
    Status: "invoiced",
    "CF.Status (Internal)": "Shipped",
    "Expected Shipment Date": "2026-09-08",
    "Item Name": "THCA Infused Flower",
    "Item.CF.Product Sub": "THCA Infused Flower",
    QuantityOrdered: "4",
    QuantityInvoiced: "3",
  }),
  row({
    "SalesOrder Number": "SO-00904",
    "Customer Name": "Unmapped Co",
    "CF.Status (Internal)": "Approved",
    "Item Name": "Mystery Widget",
    "Item.CF.Product Sub": "Accessories",
    "Usage unit": "ea",
    QuantityOrdered: "2",
    "Item.CF.Location Code": "",
  }),
]);

describe("Zoho sub mapping (gripfactorish ZOHO_SUB_MAP, canon 0.30.18)", () => {
  it("buckets every product sub in gripfactorish order, THCA first", () => {
    expect(categoryForSub("THCA Infused Flower")).toBe("THCA");
    expect(categoryForSub("THCA Concentrate")).toBe("THCA");
    expect(categoryForSub("Bulk Flower")).toBe("BUD");
    expect(categoryForSub("Bulk Flower Smalls")).toBe("BUD");
    expect(categoryForSub("Prepack Ounces")).toBe("PREPACK");
    expect(categoryForSub("Max Out Bags")).toBe("PREPACK");
    expect(categoryForSub("Vape Carts")).toBe("VAPES");
    expect(categoryForSub("Infused Pre-Rolls")).toBe("PREROLLS");
    expect(categoryForSub("Infused Flower")).toBe("INFUSED BUD");
    expect(categoryForSub("Concentrate")).toBe("DISTILLATE");
    expect(categoryForSub("Shake")).toBe("SHAKE");
    expect(categoryForSub("Trim")).toBe("TRIM");
    expect(categoryForSub("Accessories")).toBeNull();
    expect(categoryForSub("")).toBeNull();
    expect(categoryForSub(null)).toBeNull();
  });

  it("ignores CRIF and processing lines and carries the ten categories with their units", () => {
    expect(ZOHO_IGNORE.test("CRIF Fee")).toBe(true);
    expect(ZOHO_IGNORE.test("Processing")).toBe(true);
    expect(ZOHO_IGNORE.test("Bulk Flower")).toBe(false);
    expect(READOUT_CATEGORIES).toEqual(["BUD", "TRIM", "BIO", "PREPACK", "PREROLLS", "SHAKE", "DISTILLATE", "INFUSED BUD", "VAPES", "THCA"]);
    expect(CAT_UOM.PREROLLS).toBe("ea");
    expect(CAT_UOM.VAPES).toBe("ea");
    expect(CAT_UOM.DISTILLATE).toBe("L");
    expect(CAT_UOM.BUD).toBe("lb");
    expect(SO_STATUSES).toEqual(["submitted", "approved", "picking", "fulfilled", "shipped"]);
  });
});

describe("Zoho export detection and dates", () => {
  it("knows a Zoho Sales Order export by its columns or its filename", () => {
    expect(isZohoSalesOrderExport(ZOHO_HEADER)).toBe(true);
    expect(isZohoSalesOrderExport(["Item Name", "CF.Status (Internal)"])).toBe(true);
    expect(isZohoSalesOrderExport(["Plant", "Weight"])).toBe(false);
    expect(looksLikeZohoFilename("Sales_Order.csv")).toBe(true);
    expect(looksLikeZohoFilename("sales order export 2026-09-08.csv")).toBe(true);
    expect(looksLikeZohoFilename("SalesOrder.csv")).toBe(true);
    expect(looksLikeZohoFilename("wet_weights.csv")).toBe(false);
  });

  it("reads ISO and M/D/YYYY dates and nothing else", () => {
    expect(zohoDate("2026-09-08")).toBe("2026-09-08");
    expect(zohoDate("2026-09-08T00:00:00")).toBe("2026-09-08");
    expect(zohoDate("9/8/2026")).toBe("2026-09-08");
    expect(zohoDate("")).toBeNull();
    expect(zohoDate("soon")).toBeNull();
    expect(isIsoDate("2026-09-08")).toBe(true);
    expect(isIsoDate("2026-9-8")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe("parseZohoSalesOrders", () => {
  const parsed = parseZohoSalesOrders(csvObjects(SAMPLE));

  it("makes one order per SalesOrder Number with its lines in file order", () => {
    expect(parsed.orders.map((o) => o.so_number)).toEqual(["SO-00901", "SO-00902", "SO-00903", "SO-00904"]);
    const first = parsed.orders[0];
    expect(first.customer_name).toBe("Green Leaf Dispensary");
    expect(first.internal_status).toBe("approved");
    expect(first.zoho_status).toBe("confirmed");
    expect(first.expected_ship).toBe("2026-09-08");
    expect(first.order_date).toBe("2026-09-01");
    expect(first.origin_license).toBe("C11-0000002-LIC");
    expect(first.destination_license).toBe("C10-0000001-LIC");
    expect(first.lines.map((l) => l.seq)).toEqual([1, 2]);
    expect(first.lines[0].readout_category).toBe("BUD");
    expect(first.lines[0].location_code).toBe("P2.3.A");
    expect(first.lines[0].quantity_ordered).toBe(10);
    expect(first.lines[0].item_price).toBe(600);
    expect(first.lines[1].readout_category).toBe("TRIM");
  });

  it("drops the CRIF line, counts it ignored, and keeps an unmapped sub as an unbucketed line", () => {
    expect(parsed.ignored).toBe(1);
    expect(parsed.counted).toBe(5);
    expect(parsed.unbucketed).toBe(1);
    const unmapped = parsed.orders[3];
    expect(unmapped.lines).toHaveLength(1);
    expect(unmapped.lines[0].readout_category).toBeNull();
    expect(unmapped.lines[0].item_name).toBe("Mystery Widget");
  });

  it("lowercases both Zoho statuses and reads invoiced quantity on the shipped order", () => {
    const shipped = parsed.orders[2];
    expect(shipped.internal_status).toBe("shipped");
    expect(shipped.zoho_status).toBe("invoiced");
    expect(shipped.lines[0].quantity_invoiced).toBe(3);
    expect(shipped.lines[0].readout_category).toBe("THCA");
  });

  it("tolerates header spelling drift through the case-insensitive lookup", () => {
    const drift = parseZohoSalesOrders([
      { "sales order number": "SO-1", "item name": "Shake bag", "product sub": "Shake", quantityordered: "3", "status (internal)": "Approved" },
    ]);
    expect(drift.orders).toHaveLength(1);
    expect(drift.orders[0].so_number).toBe("SO-1");
    expect(drift.orders[0].lines[0].readout_category).toBe("SHAKE");
    expect(drift.orders[0].lines[0].quantity_ordered).toBe(3);
    expect(drift.orders[0].internal_status).toBe("approved");
  });
});

describe("rack walking order", () => {
  it("sorts rack addresses by prefix, row, bay, shelf; then named spots; blanks last", () => {
    expect(rackSortKey("P2.3.A")).toEqual([0, "P", 2, 3, "A"]);
    expect(rackSortKey("Oxford N")[0]).toBe(1);
    expect(rackSortKey("")[0]).toBe(2);
    expect(rackSortKey(null)[0]).toBe(2);
    const codes = ["", "Oxford N", "P2.3.A", "P1.10.B", "P1.2.A", "North Wall", "P1.2.B", null];
    const sorted = [...codes].sort(compareRack);
    expect(sorted).toEqual(["P1.2.A", "P1.2.B", "P1.10.B", "P2.3.A", "North Wall", "Oxford N", "", null]);
  });

  it("keeps file order inside one location", () => {
    const lines = [
      { seq: 3, location_code: "P1.1.A" },
      { seq: 1, location_code: "P1.1.A" },
      { seq: 2, location_code: null },
    ];
    expect(sortLinesForPick(lines).map((l) => l.seq)).toEqual([1, 3, 2]);
  });
});

/* ------------------------------------------------------- readout fixtures */

function order(over: Partial<MountedOrderRow> & { lines?: MountedLineRow[] } = {}): OrderWithLines {
  const id = over.id ?? "o1";
  return {
    id,
    so_number: "SO-00901",
    zoho_so_id: "1",
    customer_name: "Green Leaf Dispensary",
    customer_id: "555",
    order_date: "2026-09-01",
    expected_ship: "2026-09-08",
    zoho_status: "confirmed",
    internal_status: "approved",
    sales_person: "Sales One",
    customer_license: "C10-0000001-LIC",
    destination_license: "C10-0000001-LIC",
    origin_license: "C11-0000002-LIC",
    delivery_method: "Grip",
    location_name: "Ahlgren",
    pick_status: null,
    picked_by: null,
    picked_at: null,
    fulfilled_by: null,
    fulfilled_at: null,
    pick_notes: null,
    first_mount_id: "m1",
    last_mount_id: "m1",
    created_at: "2026-09-08T12:00:00.000Z",
    updated_at: "2026-09-08T12:00:00.000Z",
    ...over,
    lines: over.lines ?? [line({ sales_order_id: id })],
  };
}

function line(over: Partial<MountedLineRow> = {}): MountedLineRow {
  return {
    id: over.id ?? "l1",
    sales_order_id: "o1",
    seq: 1,
    item_name: "Blue Dream Bulk Flower",
    sku: "1A4FF0100000022000012345",
    product_sub: "Bulk Flower",
    readout_category: "BUD",
    quantity_ordered: 10,
    quantity_invoiced: 0,
    quantity_packed: 0,
    unit: "lb",
    item_price: 600,
    location_code: "P2.3.A",
    line_location_name: null,
    picked_qty: null,
    short_flag: 0,
    pick_note: null,
    ...over,
  };
}

const TODAY = "2026-09-08";
const ORDERS: OrderWithLines[] = [
  // Approved, ships today, two categories: counts once in TOTAL.
  order({
    id: "o1",
    so_number: "SO-00901",
    lines: [line({ id: "l1", sales_order_id: "o1" }), line({ id: "l2", sales_order_id: "o1", seq: 2, readout_category: "TRIM", quantity_ordered: 25, location_code: "P1.1.B" })],
  }),
  // Submitted, ships later, PREROLLS (ea).
  order({
    id: "o2",
    so_number: "SO-00902",
    internal_status: "submitted",
    expected_ship: "2026-09-10",
    lines: [line({ id: "l3", sales_order_id: "o2", readout_category: "PREROLLS", quantity_ordered: 200, unit: "ea", location_code: "Oxford N" })],
  }),
  // Shipped today by date: reads invoiced, never Shipping Today.
  order({
    id: "o3",
    so_number: "SO-00903",
    internal_status: "shipped",
    zoho_status: "invoiced",
    lines: [line({ id: "l4", sales_order_id: "o3", readout_category: "THCA", quantity_ordered: 4, quantity_invoiced: 3 })],
  }),
  // Zoho says approved, our pick says picking: the overlay wins.
  order({
    id: "o4",
    so_number: "SO-00904",
    pick_status: "picking",
    picked_by: "Les",
    picked_at: "2026-09-08T13:00:00.000Z",
    expected_ship: "2026-09-09",
    lines: [line({ id: "l5", sales_order_id: "o4", readout_category: "BUD", quantity_ordered: 5 })],
  }),
];

describe("effective status and pipeline counts (SLICE-001 semantics)", () => {
  it("overlays our pick_status on Zoho's internal status", () => {
    expect(effectiveStatus(order({ internal_status: "approved" }))).toBe("approved");
    expect(effectiveStatus(order({ internal_status: "Approved" }))).toBe("approved");
    expect(effectiveStatus(order({ internal_status: "approved", pick_status: "picking" }))).toBe("picking");
    expect(effectiveStatus(order({ internal_status: "approved", pick_status: "fulfilled" }))).toBe("fulfilled");
    expect(effectiveStatus(order({ internal_status: "weird" }))).toBeNull();
  });

  it("counts distinct orders per category and a union TOTAL, quantity in the category unit", () => {
    const c = pipelineCounts(ORDERS, TODAY);
    expect(c.orders.approved.BUD.size).toBe(1);
    expect(c.orders.approved.TRIM.size).toBe(1);
    expect(c.total.approved.size).toBe(1); // one SO in two categories counts once
    expect(c.qty.approved.BUD).toBe(10);
    expect(c.qty.approved.TRIM).toBe(25);
    expect(c.orders.submitted.PREROLLS.size).toBe(1);
    expect(c.qty.submitted.PREROLLS).toBe(200);
    expect(c.orders.picking.BUD.size).toBe(1);
    expect(c.total.picking.size).toBe(1);
    expect(c.total.fulfilled.size).toBe(0);
    // Shipped reads QuantityInvoiced.
    expect(c.orders.shipped.THCA.size).toBe(1);
    expect(c.qty.shipped.THCA).toBe(3);
  });

  it("Shipping Today is Expected Shipment Date equals today, shipped orders excluded", () => {
    const c = pipelineCounts(ORDERS, TODAY);
    expect(c.total.shippingToday.size).toBe(1);
    expect([...c.total.shippingToday]).toEqual(["SO-00901"]);
    const tomorrow = pipelineCounts(ORDERS, "2026-09-09");
    expect([...tomorrow.total.shippingToday]).toEqual(["SO-00904"]);
  });
});

describe("Mount SOs page", () => {
  const mounts: SoMountRow[] = [
    { id: "m1", filename: "Sales_Order.csv", row_count: 5, order_count: 4, ignored_count: 1, created_at: "2026-09-08T12:00:00.000Z", created_by: "p1" },
  ];

  it("renders the upload form, the mount summary, the pipeline table and the SO status detail", () => {
    const html = mountSosPage({ mounts, orders: ORDERS, today: TODAY, ok: "mounted" });
    expect(html).toContain("<h1>Mount SOs</h1>");
    expect(html).toContain("Mounted.");
    expect(html).toContain('action="/fulfillment/mount-sos" enctype="multipart/form-data" data-mount-form');
    expect(html).toContain('<input type="file" name="file" accept=".csv" required>');
    expect(html).toContain("data-mount-summary");
    expect(html).toContain("Sales_Order.csv");
    expect(html).toContain("5 lines, 4 orders, 1 ignored (CRIF, processing)");
    expect(html).toContain("data-pipeline-table");
    expect(html).toContain('data-today="2026-09-08"');
    for (const cat of READOUT_CATEGORIES) expect(html).toContain(`<th>${cat}<br>`);
    expect(html).toContain('data-pipeline-row="shippingToday"');
    expect(html).toContain("Shipping Today &middot; orders");
    expect(html).toContain("Accepted &middot; orders");
    expect(html).toContain("data-so-detail");
    expect(html).toContain("data-mounted-orders");
    // The shipped order leaves the open list; the other three stay with Pick links.
    expect(html).toContain('data-so="SO-00901"');
    expect(html).toContain('data-so="SO-00902"');
    expect(html).not.toContain('data-so="SO-00903"');
    expect(html).toContain('href="/fulfillment/pick-orders?order=o1"');
    expect(html).toContain('class="chip so-picking"');
    expect(html).not.toContain("data-stale");
  });

  it("flags an order the latest mount did not carry", () => {
    const stale = order({ id: "o9", so_number: "SO-00909", last_mount_id: "m0" });
    const html = mountSosPage({ mounts, orders: [stale], today: TODAY });
    expect(html).toContain("data-stale");
    expect(html).toContain("not in last mount");
  });

  it("says so before the first mount", () => {
    const html = mountSosPage({ mounts: [], orders: [], today: TODAY });
    expect(html).toContain("Nothing mounted yet.");
    expect(html).toContain("data-pipeline-empty");
    expect(html).toContain("Populates on the first mount.");
    expect(html).not.toContain("data-pipeline-table");
    expect(pipelineTable([], TODAY)).toContain("Populates on the first mount.");
    expect(soStatusDetail([])).toBe("");
  });

  it("translates the readout chrome in es", () => {
    const html = mountSosPage({ mounts, orders: ORDERS, today: TODAY, locale: "es" });
    expect(html).toContain("<h1>Montar SOs</h1>");
    expect(html).toContain("Canal de ventas");
    expect(html).toContain("Sale hoy &middot; pedidos");
    expect(html).toContain("Pedidos abiertos");
    expect(t("es", "Pick Orders")).toBe("Preparar pedidos");
  });
});

describe("Pick Orders page", () => {
  const open = ORDERS.filter((o) => effectiveStatus(o) !== "shipped");

  it("lists the orders to pick in the left pane and asks for a pick from the pane", () => {
    const html = pickOrdersPage({ orders: open, picked: null });
    expect(html).toContain("<h1>Pick Orders</h1>");
    expect(html).toContain("Orders to pick");
    expect(html).toContain('<span class="tile-count">3</span>');
    expect(html).toContain('href="/fulfillment/pick-orders?order=o1"');
    expect(html).toContain("Pick an order from the pane.");
    expect(html).not.toContain("data-pick-start");
  });

  it("an unstarted order shows its lines read-only, the print link, and the Start pick form with a typed Picked by (canon 0.30.21)", () => {
    const html = pickOrdersPage({ orders: open, picked: open[0] });
    expect(html).toContain('class="queue-pane-item selected"');
    expect(html).toContain('href="/fulfillment/pick-orders/o1/print"');
    expect(html).toContain('action="/fulfillment/pick-orders/o1/start" data-pick-start');
    expect(html).toContain('<input type="text" name="signed_by" required autocomplete="off">');
    expect(html).not.toContain('<select name="signed_by"');
    expect(html).toContain("Start pick");
    expect(html).not.toContain("data-pick-save");
    // Lines walk the racks: P1.1.B before P2.3.A.
    expect(html.indexOf("P1.1.B")).toBeLessThan(html.indexOf("P2.3.A"));
    expect(html).toContain('<tr class="loc-row"><th colspan="7">P1.1.B</th></tr>');
    expect(html).not.toContain('name="picked_l1"');
  });

  it("a picking order takes picked quantities, short flags and notes, and completes with a signer", () => {
    const picking = open.find((o) => o.id === "o4")!;
    const html = pickOrdersPage({ orders: open, picked: picking, ok: "picking" });
    expect(html).toContain("Pick started.");
    expect(html).toContain('action="/fulfillment/pick-orders/o4/save" data-pick-save');
    expect(html).toContain('name="picked_l5"');
    expect(html).toContain('name="short_l5"');
    expect(html).toContain('name="note_l5"');
    expect(html).toContain("Save progress");
    expect(html).toContain('action="/fulfillment/pick-orders/o4/complete" data-pick-complete');
    expect(html).toContain("Complete pick");
    expect(html).toContain("Fulfilled by");
    expect(html).toContain('Picked by Les <time datetime="2026-09-08T13:00:00.000Z" data-local>2026-09-08T13:00:00.000Z</time>');
    expect(html).toContain("time[data-local]");
    expect(html).toContain("A short line is flagged, never blocked.");
  });

  it("a fulfilled order is read-only with its marks", () => {
    const done = order({
      id: "o7",
      so_number: "SO-00907",
      pick_status: "fulfilled",
      picked_by: "Les",
      picked_at: "2026-09-08T13:00:00.000Z",
      fulfilled_by: "Austin",
      fulfilled_at: "2026-09-08T14:00:00.000Z",
      lines: [line({ id: "l9", sales_order_id: "o7", picked_qty: 8, short_flag: 1, pick_note: "two bags light" })],
    });
    const html = pickOrdersPage({ orders: [done], picked: done, ok: "fulfilled" });
    expect(html).toContain("Fulfilled.");
    expect(html).not.toContain("data-pick-save");
    expect(html).not.toContain("data-pick-complete");
    expect(html).toContain("<td>8</td><td>short</td><td>two bags light</td>");
    expect(html).toContain("Fulfilled by Austin");
  });

  it("prints a letter pick sheet grouped by location with checkboxes and both sign lines", () => {
    const html = pickSheetHtml(open[0]);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<title>Pick sheet SO-00901</title>");
    expect(html).toContain("@page { size: letter;");
    expect(html).toContain("Green Leaf Dispensary");
    expect(html).toContain("C11-0000002-LIC");
    expect(html).toContain('<tr class="loc"><td colspan="6">P1.1.B</td></tr>');
    expect(html).toContain('<tr class="loc"><td colspan="6">P2.3.A</td></tr>');
    expect(html).toContain("&#9744;");
    expect(html).toContain("Picked by:");
    expect(html).toContain("Fulfilled by:");
    expect(html).toContain("window.print()");
    const es = pickSheetHtml(open[0], "es");
    expect(es).toContain("Hoja de preparacion");
  });
});
