import { describe, expect, it } from "vitest";
import {
  eachGramsFor,
  gramsOf,
  isZohoItemsExport,
  marketQtyLabel,
  normalizeUnit,
  parseZohoItems,
  summarizeByCategory,
  ZOHO_GRAMS_PER_LB,
  ZOHO_GRAMS_PER_OZ,
} from "../src/zohoinv";
import { listingsWithMatch, marketQtyCell, matchStateOf, type ListingRow } from "../src/marketplace";

// Canon 0.30.36. Owner, 2026-09-09, verbatim: "If zoho is using  each, it's
// weight, if it's oz or g, show that as "market-facing UOM" and actual weight
// in grams - Lbs = 448 grams" and "Zoho should show a SKU, that's usually the
// METRC package ID".

const HEADERS = ["Item ID", "Item Name", "Status", "Unit", "SKU", "Stock On Hand", "Product Type", "Item Type", "Selling Price", "Location Name", "CF.THC %", "CF.Product Sub", "CF.Location Code"];

function rec(over: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {
    "Item ID": "1",
    "Item Name": "BUD - Test - PNN - O - 22.1%",
    Status: "Active",
    Unit: "",
    SKU: "1A40503000311FB000028138",
    "Stock On Hand": "0.5",
    "Product Type": "goods",
    "Item Type": "Inventory",
    "Selling Price": "USD 175.00",
    "Location Name": "Head Office",
    "CF.THC %": "22.100000",
    "CF.Product Sub": "Bulk Flower Outdoor",
    "CF.Location Code": "24.2.A",
  };
  return { ...base, ...over };
}

describe("the Zoho Items export: units to market-facing UOM and grams", () => {
  it("recognizes the export by Item Name, SKU and Stock On Hand", () => {
    expect(isZohoItemsExport(HEADERS)).toBe(true);
    expect(isZohoItemsExport(["SalesOrder Number", "Item Name", "Status"])).toBe(false);
  });

  it("holds the owner's conversions: a pound is 448 grams, an ounce 28", () => {
    expect(ZOHO_GRAMS_PER_LB).toBe(448);
    expect(ZOHO_GRAMS_PER_OZ).toBe(28);
    expect(gramsOf("lb", 0.5, null)).toBe(224);
    expect(gramsOf("oz", 2, null)).toBe(56);
    expect(gramsOf("g", 25000, null)).toBe(25000);
    expect(gramsOf("each", 80, 28)).toBe(2240);
    expect(gramsOf("each", 80, null)).toBeNull();
    expect(gramsOf("L", 94.6, null)).toBeNull();
  });

  it("reads Zoho's every spelling of a unit and infers a blank one from the category", () => {
    for (const u of ["lb", "LB", "Lb", "Pound", "pound", "Pounds"]) expect(normalizeUnit(u, "")).toBe("lb");
    for (const u of ["g", "Gram", "gram", "grams"]) expect(normalizeUnit(u, "")).toBe("g");
    for (const u of ["each", "Each", "Unit"]) expect(normalizeUnit(u, "")).toBe("each");
    for (const u of ["Liters", "Liter"]) expect(normalizeUnit(u, "")).toBe("L");
    expect(normalizeUnit("oz", "")).toBe("oz");
    // Blank: bulk categories are pounds; the each-sold categories are eaches.
    expect(normalizeUnit("", "Bulk Flower Outdoor")).toBe("lb");
    expect(normalizeUnit("", "Shake")).toBe("lb");
    expect(normalizeUnit("", "")).toBe("lb");
    expect(normalizeUnit("", "Prepack Ounces")).toBe("each");
    expect(normalizeUnit("", "Max Out Bags")).toBe("each");
    expect(normalizeUnit("", "Vape/Cart")).toBe("each");
    expect(normalizeUnit("", "Infused Pre-Rolls")).toBe("each");
  });

  it("finds the weight of one each in the name, else in the category, else unknown", () => {
    expect(eachGramsFor("IPR - Orange Crush 1.2g", "Infused Pre-Rolls")).toBe(1.2);
    expect(eachGramsFor("GRIP THCA Infused Flower - Grape Ape -15g", "Infused Flower")).toBe(15);
    expect(eachGramsFor("GRIP Vape - Berry Mojito - 2g", "Vape/Cart")).toBe(2);
    expect(eachGramsFor("Something 1oz", "Other")).toBe(28);
    expect(eachGramsFor("PRE - Applescotti - PNN - O - 20.77%", "Prepack Ounces")).toBe(28);
    expect(eachGramsFor("MOB - Apple Jack - PNN - O - 25.42%", "Max Out Bags")).toBe(70);
    expect(eachGramsFor("Widget", "Other")).toBeNull();
    // A percentage in the name is not a size.
    expect(eachGramsFor("BUD - Test - 22.1%", "Prepack Ounces")).toBe(28);
  });

  it("labels the market-facing quantity in its UOM", () => {
    expect(marketQtyLabel("lb", 0.368304)).toBe("0.3683 lb");
    expect(marketQtyLabel("each", 712)).toBe("712 each");
    expect(marketQtyLabel("each", 13594)).toBe("13594 each");
    expect(marketQtyLabel("L", 94.601)).toBe("94.601 L");
  });
});

describe("parseZohoItems: the offering is every active item with stock", () => {
  it("keeps active in-stock goods, drops inactive, empty and service rows, and sums the file", () => {
    const parsed = parseZohoItems([
      rec({}),
      rec({ "Item ID": "2", "Item Name": "Old", Status: "Inactive", SKU: "1A40503000311FB000000002" }),
      rec({ "Item ID": "3", "Item Name": "Empty", "Stock On Hand": "0.0000", SKU: "1A40503000311FB000000003" }),
      rec({ "Item ID": "4", "Item Name": "Fee", "Product Type": "service", "Item Type": "Sales", SKU: "" }),
      rec({ "Item ID": "5", "Item Name": "PRE - Applescotti - PNN - O - 20.77%", "CF.Product Sub": "Prepack Ounces", SKU: "1A40503000311FB000051831", "Stock On Hand": "80", "Selling Price": "USD 12.50", "CF.Location Code": "P4.1.B" }),
      rec({ "Item ID": "6", "Item Name": "GRIP Vape - Berry Mojito - 2g", "CF.Product Sub": "Vape/Cart", SKU: "GRIP Vape - Berry Mojito - 2g", "Stock On Hand": "17650.0000", "Location Name": "Oxford N", "CF.Location Code": "", "CF.THC %": "" }),
      rec({ "Item ID": "7", "Item Name": "Bow House Distillate - 83.625%", "CF.Product Sub": "Concentrate", Unit: "Liters", SKU: "1A40503000308F5000047817", "Stock On Hand": "94.6010", "Location Name": "Head Office", "CF.Location Code": "" }),
    ]);
    expect(parsed.rows_total).toBe(7);
    expect(parsed.rows_inactive).toBe(1);
    expect(parsed.rows_no_stock).toBe(1);
    expect(parsed.rows_not_goods).toBe(1);
    expect(parsed.offered.map((o) => o.item_name)).toEqual([
      "BUD - Test - PNN - O - 22.1%",
      "PRE - Applescotti - PNN - O - 20.77%",
      "GRIP Vape - Berry Mojito - 2g",
      "Bow House Distillate - 83.625%",
    ]);
    const [bud, pre, vape, oil] = parsed.offered;
    // Bulk, blank unit: pounds, 448 g each.
    expect(bud.market_uom).toBe("lb");
    expect(bud.market_qty).toBe(0.5);
    expect(bud.qty_grams).toBe(224);
    expect(bud.sku).toBe("1A40503000311FB000028138");
    expect(bud.package_tag).toBe("1A40503000311FB000028138");
    expect(bud.key).toBe("1A40503000311FB000028138");
    expect(bud.location).toBe("Head Office / 24.2.A");
    expect(bud.thc_pct).toBe(22.1);
    expect(bud.price).toBe("USD 175.00");
    // Prepack ounces: eaches of 28 g.
    expect(pre.market_uom).toBe("each");
    expect(pre.each_grams).toBe(28);
    expect(pre.qty_grams).toBe(2240);
    // A branded vape: text SKU, so no METRC tag to match by; 2 g each from the name.
    expect(vape.package_tag).toBeNull();
    expect(vape.key).toBe("GRIP Vape - Berry Mojito - 2g");
    expect(vape.each_grams).toBe(2);
    expect(vape.qty_grams).toBe(35300);
    expect(vape.location).toBe("Oxford N");
    expect(vape.thc_pct).toBeNull();
    // Liters: a market UOM with no weight to state.
    expect(oil.market_uom).toBe("L");
    expect(oil.qty_grams).toBeNull();
    const cats = summarizeByCategory(parsed.offered);
    expect(cats.map((c) => c.category)).toEqual(["Bulk Flower Outdoor", "Concentrate", "Prepack Ounces", "Vape/Cart"]);
    expect(cats.find((c) => c.category === "Bulk Flower Outdoor")?.market).toBe("0.5 lb");
    expect(cats.find((c) => c.category === "Vape/Cart")?.market).toBe("17650 each");
    expect(parsed.by_category).toEqual(cats);
  });

  it("counts and skips placeholder rows: a stock on hand of a billion or more is not inventory", () => {
    const parsed = parseZohoItems([
      rec({}),
      rec({ "Item ID": "9", "Item Name": "Bud - Placeholder", SKU: "2", "Stock On Hand": "1000000000008.0000", "Location Name": "Elsewhere" }),
      rec({ "Item ID": "10", "Item Name": "MOB - Placeholder", SKU: "7", "CF.Product Sub": "Max Out Bags", "Stock On Hand": "1000000000" }),
    ]);
    expect(parsed.offered.map((o) => o.item_name)).toEqual(["BUD - Test - PNN - O - 22.1%"]);
    expect(parsed.rows_placeholder).toBe(2);
    expect(parsed.rows_no_stock).toBe(0);
  });

  it("falls back to the Item ID, then the name, when an item has no SKU", () => {
    const parsed = parseZohoItems([rec({ SKU: "", "Item ID": "77" }), rec({ SKU: "", "Item ID": "", "Item Name": "Nameless" })]);
    expect(parsed.offered[0].key).toBe("item:77");
    expect(parsed.offered[1].key).toBe("name:Nameless");
  });
});

describe("a Zoho listing reads three ways against our ledger (canon 0.30.36)", () => {
  const base: ListingRow = {
    id: "z1",
    item_name: "BUD - Test",
    package_tag: "1A40503000311FB000028138",
    qty_grams: 224,
    listed: 1,
    source: "zoho",
    sku: "1A40503000311FB000028138",
    market_uom: "lb",
    market_qty: 0.5,
    each_grams: null,
  };
  const inv = (qty: number | null) => ({
    qtyByTag: new Map(qty == null ? [] : [["1A40503000311FB000028138", qty]]),
    itemsById: new Map(),
  });

  it("matching when the ledger holds the SKU's package with enough grams", () => {
    expect(matchStateOf(base, inv(224))).toBe("matching");
    expect(matchStateOf(base, inv(300))).toBe("matching");
  });

  it("short when the ledger holds the tag with less, zoho when the ledger has never seen it", () => {
    expect(matchStateOf(base, inv(100))).toBe("short");
    expect(matchStateOf(base, inv(null))).toBe("zoho");
    // A branded item with a text SKU has no tag: Zoho's word alone.
    expect(matchStateOf({ ...base, package_tag: null, sku: "GRIP Vape - 2g" }, inv(null))).toBe("zoho");
    // A liters row carries 0 g; an unseen tag is still Zoho only, never a free match.
    expect(matchStateOf({ ...base, market_uom: "L", market_qty: 94.6, qty_grams: 0 }, inv(null))).toBe("zoho");
    expect(matchStateOf({ ...base, market_uom: "L", market_qty: 94.6, qty_grams: 0 }, inv(5))).toBe("matching");
  });

  it("keeps a manual listing to its two states", () => {
    const manual: ListingRow = { id: "m1", item_name: "Hand", package_tag: "TAG-1", qty_grams: 10, listed: 1, source: "manual" };
    expect(matchStateOf(manual, { qtyByTag: new Map([["TAG-1", 10]]), itemsById: new Map() })).toBe("matching");
    expect(matchStateOf(manual, { qtyByTag: new Map(), itemsById: new Map() })).toBe("short");
    const views = listingsWithMatch([manual, base], inv(null));
    expect(views.map((v) => v.match_state)).toEqual(["short", "zoho"]);
    expect(views.map((v) => v.matching)).toEqual([false, false]);
  });

  it("shows the market-facing quantity with the actual weight beside it", () => {
    expect(marketQtyCell(base, "en")).toContain("<b>0.5 lb</b>");
    expect(marketQtyCell(base, "en")).toContain("224 g");
    expect(marketQtyCell({ ...base, market_uom: "each", market_qty: 80, each_grams: 28, qty_grams: 2240 }, "en")).toContain("<b>80 each</b>");
    expect(marketQtyCell({ ...base, market_uom: "L", market_qty: 94.601, qty_grams: 0 }, "en")).toContain("weight unknown");
    expect(marketQtyCell({ ...base, market_uom: "each", market_qty: 3, each_grams: null, qty_grams: 0 }, "en")).toContain("weight unknown");
    // A manual listing keeps its grams-only cell.
    expect(marketQtyCell({ id: "m", item_name: "x", package_tag: null, qty_grams: 10, listed: 1 }, "en")).toBe("10 g");
  });
});
