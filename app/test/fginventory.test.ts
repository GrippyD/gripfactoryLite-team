import { describe, expect, it } from "vitest";
import { GRAMS_PER_LB } from "../src/config";
import { harvestConsolePage, type HarvestConsoleInput } from "../src/console";
import {
  FG_CAPS,
  FG_FOLDED_PREFIXES,
  FG_LEDGER_SQL,
  FG_LISTINGS_SQL,
  FG_NOT_FINISHED,
  FG_PRE_EACH_GRAMS,
  FG_TRUCK_LB,
  budThcBand,
  buildFgInventory,
  classifyListing,
  distillateMaker,
  isolateMaker,
  fgTotalAttr,
  fgInventorySection,
  fgMountedLabel,
  fgTruckCount,
  loadFgInventory,
  vapeSizeAndFlavor,
  type FgCategory,
  type FgInventoryModel,
  type FgListing,
  type FgLedgerRow,
} from "../src/fginventory";
import { DICT, t } from "../src/i18n";
import { themeStylesheet } from "../src/theme";
import { siloVisual, type SiloLive } from "../src/silo";
import { migratedDb } from "./migrated";

const LB = GRAMS_PER_LB;
const WHEN = "2026-10-13T11:32:00.000Z";

function listing(over: Partial<FgListing> = {}): FgListing {
  return {
    itemName: "BUD - Gelato - PNN",
    category: "Bulk Flower Outdoor",
    marketUom: "lb",
    marketQty: 1,
    qtyGrams: LB,
    eachGrams: null,
    thcPct: 22.1,
    mountedAt: WHEN,
    ...over,
  };
}

function cat(model: FgInventoryModel, key: string): FgCategory {
  const found = model.categories.find((row) => row.key === key);
  if (!found) throw new Error(key);
  return found;
}

function strain(model: FgInventoryModel, key: string, name: string) {
  const found = cat(model, key).groups.find((row) => row.name === name);
  if (!found) throw new Error(`${key} ${name}`);
  return found;
}

const input: HarvestConsoleInput = {
  today: "2026-10-13",
  day: "2026-10-13",
  dayPicked: false,
  year: 2026,
  remaining: [],
  seasonHarvested: [],
  seasonLots: [],
  dayWet: [],
  hours: { PNN: null, ARL: null, PNS: null },
  plantCounts: { PNN: null, ARL: null, PNS: null },
};

const live: SiloLive[] = [
  { silo: { id: "s1", name: "Silo 1", shape: "cylinder", farm_code: "PNN" }, visual: siloVisual({ fillingGrams: 0, fillingLots: 0, awaitingGrams: 0, loadedGrams: 0, clock: null, capacityGrams: 15000 * LB }), loads: [], waiting: [], emptySince: null },
];

describe("FG1 finished goods on the Harvest Console", () => {
  it("keeps folded prefixes and the not-finished goods in one constant each", () => {
    expect(FG_FOLDED_PREFIXES.map((row) => row.prefix)).toEqual(["MIX", "NUG", "MOB"]);
    expect(FG_FOLDED_PREFIXES.find((row) => row.prefix === "MOB") && "eachGrams" in FG_FOLDED_PREFIXES[2] && FG_FOLDED_PREFIXES[2].eachGrams).toBe(70);
    expect(FG_PRE_EACH_GRAMS).toBe(28);
    expect([...FG_NOT_FINISHED]).toEqual(["WBP", "WIP", "WPR", "Biomass", "FFZ"]);
  });

  it("sorts MIX and NUG into BUD, MOB into PRE at 70 g, and leaves WBP and FFZ out of every category", () => {
    const model = buildFgInventory(
      [
        listing({ itemName: "MIX - Gelato - PNN", qtyGrams: LB, thcPct: 22.1 }),
        listing({ itemName: "NUG - Lemon - PNN", qtyGrams: LB / 2, thcPct: null, category: "Bulk Flower Indoor" }),
        listing({ itemName: "BUD - Gelato - PNN", qtyGrams: 10 * LB, thcPct: 22.104 }),
        listing({ itemName: "bud - Other - PNN", qtyGrams: LB, thcPct: 18.5 }),
        listing({
          itemName: "PRE - Applescotti - PNN",
          category: "Prepack Ounces",
          marketUom: "each",
          marketQty: 16,
          qtyGrams: 0,
          eachGrams: null,
          thcPct: 20.77,
        }),
        listing({
          itemName: "MOB - Apple Jack - PNN",
          category: "Max Out Bags",
          marketUom: "each",
          marketQty: 32,
          qtyGrams: 0,
          eachGrams: null,
          thcPct: 25.42,
        }),
        listing({ itemName: "WBP - Skip", qtyGrams: 9 * LB }),
        listing({ itemName: "FFZ - Skip", category: "Fresh Frozen", qtyGrams: 8 * LB }),
        listing({ itemName: "WIP - Skip", qtyGrams: 7 * LB }),
        listing({ itemName: "WPR - Skip", qtyGrams: 6 * LB }),
        listing({ itemName: "BIO - Old", category: "Biomass", qtyGrams: 5 * LB }),
        listing({ itemName: "WIDGET - Thing", category: "Other", qtyGrams: 100, thcPct: null }),
      ],
      []
    );
    expect(cat(model, "bud").total).toBeCloseTo(12.5);
    expect(strain(model, "bud", "Gelato").amount).toBeCloseTo(11);
    expect(strain(model, "bud", "Gelato").lines.map((line) => line.thc)).toEqual(["22.10"]);
    expect(strain(model, "bud", "Lemon").lines.map((line) => line.thc)).toEqual([""]);
    expect(strain(model, "bud", "Other").lines[0].thc).toBe("18.50");
    expect(cat(model, "pre").total).toBeCloseTo(6);
    expect(strain(model, "pre", "Applescotti").amount).toBeCloseTo(1);
    expect(strain(model, "pre", "Apple Jack").amount).toBeCloseTo(5);
    expect(model.notShown).toBe(6);
    const html = fgInventorySection(model);
    for (const name of ["WBP", "FFZ", "WIDGET", "Biomass"]) {
      expect(html).not.toContain(`data-fg-strain="${name}"`);
    }
    expect(html).toContain('data-fg-not-shown="6"');
    expect(html).toContain("Not shown: 6 Zoho items");
  });

  it("uses 28 g for a PRE ounce and the stored each weight when the row has one", () => {
    const fallback = buildFgInventory(
      [
        listing({
          itemName: "PRE - Applescotti - PNN",
          category: "Prepack Ounces",
          marketUom: "each",
          marketQty: 16,
          qtyGrams: null,
          eachGrams: null,
        }),
      ],
      []
    );
    expect(cat(fallback, "pre").total).toBeCloseTo(1);
    const stored = buildFgInventory(
      [
        listing({
          itemName: "PRE - Applescotti - PNN",
          category: "Prepack Ounces",
          marketUom: "each",
          marketQty: 2,
          qtyGrams: null,
          eachGrams: 224,
        }),
      ],
      []
    );
    expect(cat(stored, "pre").total).toBeCloseTo(1);
    expect(classifyListing(listing({ itemName: "MOB - Apple Jack", category: "Max Out Bags", eachGrams: null }))).toBe("pre");
  });

  it("joins distillate makers case blind and keeps Zoho liters", () => {
    expect(distillateMaker("Mitten DIstillate")).toBe("Mitten");
    expect(distillateMaker("Bow House Distillate - 83.625%")).toBe("Bow House");
    expect(distillateMaker("HZ Distillate")).toBe("HZ");
    const model = buildFgInventory(
      [
        listing({ itemName: "Mitten DIstillate", category: "Concentrate", marketUom: "L", marketQty: 250.25, qtyGrams: 0, thcPct: null }),
        listing({ itemName: "mitten distillate", category: "concentrate", marketUom: "liters", marketQty: 91.61, qtyGrams: 0, thcPct: null }),
        listing({ itemName: "Bow House Distillate - 83.625%", category: "Concentrate", marketUom: "L", marketQty: 94.6, qtyGrams: 0, thcPct: null }),
        listing({ itemName: "HZ Distillate", category: "Concentrate", marketUom: "L", marketQty: 1, qtyGrams: 0, thcPct: null }),
        listing({ itemName: "Not oil", category: "Concentrate", marketUom: "g", marketQty: 3, qtyGrams: 3, thcPct: null }),
      ],
      [{ typeCode: "DISTILLATE", strain: "Ledger", thcPct: null, grams: 999 * LB }]
    );
    const oil = cat(model, "distillate");
    expect(oil.total).toBeCloseTo(437.46);
    expect(oil.lines.map((line) => [line.name, Math.round(line.amount * 100) / 100])).toEqual([
      ["Bow House", 94.6],
      ["HZ", 1],
      ["Mitten", 341.86],
    ]);
    expect(model.notShown).toBe(1);
  });

  it("puts THCA and isolate concentrates under Isolate in grams by maker", () => {
    expect(isolateMaker("HZ Holdings THCA - 77.38%")).toBe("HZ Holdings");
    expect(isolateMaker("Mitten Isolate")).toBe("Mitten");
    const model = buildFgInventory(
      [
        listing({ itemName: "HZ Holdings THCA - 77.38%", category: "Concentrate", marketUom: "g", marketQty: 20000, qtyGrams: 20000, thcPct: null }),
        listing({ itemName: "Mitten Isolate", category: "concentrate", marketUom: "g", marketQty: 500, qtyGrams: null, thcPct: null }),
        listing({ itemName: "HZ Holdings THCA", category: "Concentrate", marketUom: "grams", marketQty: 0, qtyGrams: 250, thcPct: null }),
        listing({ itemName: "GRIP THCA Infused Flower - Grape Ape -15g", category: "Infused Flower", marketUom: "each", marketQty: 10, qtyGrams: 150, eachGrams: 15, thcPct: null }),
        listing({ itemName: "Mitten Distillate", category: "Concentrate", marketUom: "L", marketQty: 5, qtyGrams: 0, thcPct: null }),
      ],
      []
    );
    const iso = cat(model, "isolate");
    expect(iso.total).toBe(20750);
    expect(iso.lines.map((line) => [line.name, line.amount])).toEqual([
      ["HZ Holdings", 20250],
      ["Mitten", 500],
    ]);
    expect(cat(model, "infused").total).toBe(150);
    expect(cat(model, "distillate").total).toBe(5);
    expect(model.notShown).toBe(0);
    const html = fgInventorySection(model);
    expect(html).toContain(`data-fg-cat="isolate" data-fg-total="${fgTotalAttr("g", 20750)}"`);
    expect(html).toContain('data-fg-maker="HZ Holdings"');
    expect(html.indexOf('data-fg-cat="distillate"')).toBeLessThan(html.indexOf('data-fg-cat="isolate"'));
    expect(html.indexOf('data-fg-cat="isolate"')).toBeLessThan(html.indexOf('data-fg-cat="infused"'));
    expect(fgInventorySection(model, "es")).toContain("Aislado");
  });

  it("collapses a vape into its size and then its flavor", () => {
    expect(vapeSizeAndFlavor("GRIP Vape - Berry Mojito - 2g")).toEqual({ size: "2g", flavor: "Berry Mojito" });
    expect(vapeSizeAndFlavor("Mitten Cart - Gelato - 1 g")).toEqual({ size: "1g", flavor: "Gelato" });
    const model = buildFgInventory(
      [
        listing({ itemName: "GRIP Vape - Berry Mojito - 2g", category: "Vape/Cart", marketUom: "each", marketQty: 20, qtyGrams: 40, eachGrams: 2, thcPct: null }),
        listing({ itemName: "GRIP Vape - Berry Mojito - 1g", category: "vape/cart", marketUom: "each", marketQty: 5, qtyGrams: 5, eachGrams: 1, thcPct: null }),
        listing({ itemName: "GRIP Vape - Lemon - 2G", category: "Vape/Cart", marketUom: "each", marketQty: 3, qtyGrams: 6, eachGrams: 2, thcPct: null }),
      ],
      []
    );
    const vapes = cat(model, "vape");
    expect(vapes.total).toBe(28);
    expect(vapes.sizes.map((size) => size.size)).toEqual(["1g", "2g"]);
    expect(vapes.sizes[0].flavors.map((row) => row.name)).toEqual(["Berry Mojito"]);
    expect(vapes.sizes[1].amount).toBe(23);
    expect(vapes.sizes[1].flavors.map((row) => [row.name, row.amount])).toEqual([
      ["Berry Mojito", 20],
      ["Lemon", 3],
    ]);
  });

  it("buckets ledger trim and shake by strain and then THC, and leaves a package with none under no THC", () => {
    const ledger: FgLedgerRow[] = [
      { typeCode: "TRIM", strain: "Gelato", thcPct: 25, grams: 2 * LB },
      { typeCode: "trim", strain: "gelato", thcPct: 25.004, grams: LB },
      { typeCode: "SHAKE", strain: "Lemon", thcPct: null, grams: LB },
      { typeCode: "SHAKE", strain: "Lemon", thcPct: 12.5, grams: LB / 2 },
      { typeCode: "BUD", strain: "Nope", thcPct: 30, grams: 9 * LB },
    ];
    const model = buildFgInventory([], ledger);
    expect(cat(model, "tri").total).toBeCloseTo(3);
    expect(strain(model, "tri", "Gelato").lines.map((line) => [line.thc, line.amount])).toEqual([["25.00", 3]]);
    const lemon = strain(model, "sha", "Lemon");
    expect(lemon.amount).toBeCloseTo(1.5);
    expect(lemon.lines.map((line) => line.thc)).toEqual(["12.50", ""]);
    expect(cat(model, "bud").total).toBe(0);
  });

  it("puts the section after Fulfillment, closed, with each category closed", () => {
    const model = buildFgInventory([listing()], [{ typeCode: "TRIM", strain: "Gelato", thcPct: null, grams: LB }]);
    const section = fgInventorySection(model);
    expect(section).toContain('<details class="hc-section" data-hc-section="fg_inventory">');
    expect(section).not.toContain('data-hc-section="fg_inventory" open');
    expect(section).toContain('data-fg-as-of="2026-10-13 07:32"');
    expect(section).toContain("Zoho as of 2026-10-13 07:32");
    const keys = ["bud", "tri", "sha", "pre", "distillate", "isolate", "infused", "preroll", "vape"];
    const at = keys.map((key) => section.indexOf(`data-fg-cat="${key}"`));
    expect(at.every((n) => n >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    for (const key of keys) expect(section).not.toContain(`data-fg-cat="${key}" open`);
    expect(section).toContain('data-fg-cat="bud" data-fg-total="1.00"');
    expect(section).toContain('data-fg-thc="none"');
    expect(section).toContain("no THC");
    const page = harvestConsolePage({ input, live, nowIso: WHEN, fgInventory: model });
    const fulfillmentAt = page.indexOf('data-hc-section="fulfillment"');
    const fgAt = page.indexOf('data-hc-section="fg_inventory"');
    expect(fgAt).toBeGreaterThan(fulfillmentAt);
    expect(page.indexOf('data-hc-section="', fgAt + 24)).toBe(-1);
    expect(page).not.toContain('data-hc-section="fg_inventory" open');
    expect(fgMountedLabel(WHEN)).toBe("2026-10-13 07:32");
    expect(fgMountedLabel(null)).toBe("");
  });

  it("has Spanish for the words the section says", () => {
    const keys = ["FG inventory", "Not shown: {n} Zoho items", "no THC", "no size", "Distillate", "Infused Bud", "each", "Prerolls", "Vapes", "Zoho as of", "no strain"];
    for (const key of keys) {
      expect(DICT[key]?.en, key).toBe(key);
      expect(DICT[key]?.es.trim().length, key).toBeGreaterThan(0);
    }
    const model = buildFgInventory(
      [
        listing({ itemName: "Bow House Distillate", category: "Concentrate", marketUom: "L", marketQty: 2, qtyGrams: 0, thcPct: null }),
        listing({ itemName: "IPR - Orange Crush 1.2g", category: "Infused Pre-Rolls", marketUom: "each", marketQty: 4, qtyGrams: 0, thcPct: null }),
        listing({ itemName: "GRIP THCA Infused Flower - Grape Ape -15g", category: "Infused Flower", marketUom: "each", marketQty: 10, qtyGrams: 150, eachGrams: 15, thcPct: null }),
        listing({ itemName: "WIDGET - Thing", category: "Other", qtyGrams: 1 }),
      ],
      [{ typeCode: "SHAKE", strain: "", thcPct: null, grams: LB }]
    );
    expect(cat(model, "preroll").lines[0].name).toBe("Orange Crush 1.2g");
    expect(cat(model, "infused").total).toBe(150);
    expect(cat(model, "infused").lines[0].name).toContain("Grape Ape");
    const es = fgInventorySection(model, "es");
    expect(es).toContain(t("es", "FG inventory"));
    expect(es).toContain("Destilado");
    expect(es).toContain("Cogollo infundido");
    expect(es).toContain("Preenrolados");
    expect(es).toContain("sin THC");
    expect(es).toContain("sin variedad");
    expect(es).toContain("cada");
    expect(es).toContain("No mostrados: 1 articulos de Zoho");
    expect(es).toContain("Zoho al 2026-10-13 07:32");
  });

  it("reads live Zoho rows and METRC Shake/Trim in two statements", async () => {
    expect(FG_LISTINGS_SQL.includes("?")).toBe(false);
    expect(FG_LEDGER_SQL.includes("?")).toBe(false);
    expect(FG_LEDGER_SQL.includes("metrc_packages")).toBe(true);
    expect(FG_LEDGER_SQL.includes("Shake/Trim")).toBe(true);
    expect(FG_LEDGER_SQL.includes("gone_at IS NULL")).toBe(true);
    expect(FG_LEDGER_SQL.includes("453.59237")).toBe(true);
    expect(FG_LEDGER_SQL.includes("local_inventory_items")).toBe(false);
    expect(FG_LEDGER_SQL.includes("'SHAKE'")).toBe(true);
    expect(FG_LEDGER_SQL.includes("GROUP BY")).toBe(true);
    expect(FG_LISTINGS_SQL.includes("zoho_status = 'Active'")).toBe(true);
    const m = await migratedDb();
    const ts = WHEN;
    m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('fg-gelato', 'Fg1 Gelato', 'FG1', ?, ?)`, ts, ts);
    m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('fg-lemon', 'Fg1 Lemon', 'FG2', ?, ?)`, ts, ts);
    const pack = (id: string, code: string, type: string, deleted: string | null) =>
      m.run(
        `INSERT INTO wip_packages (id, package_code, package_type_code, weight_grams, status, created_at, updated_at, deleted_at) VALUES (?, ?, ?, 1, 'created', ?, ?, ?)`,
        id,
        code,
        type,
        ts,
        ts,
        deleted
      );
    pack("fg-wp-tri", "FGTRI", "TRIM", null);
    pack("fg-wp-sha", "FGSHA", "SHAKE", null);
    pack("fg-wp-wip", "FGWIP", "TRIM", null);
    pack("fg-wp-gone", "FGGONE", "TRIM", ts);
    const item = (id: string, kind: string, code: string, tag: string, wip: string, strainId: string, qty: number, deleted: string | null) =>
      m.run(
        `INSERT INTO local_inventory_items (
           id, item_kind, package_code, metrc_tag, wip_package_id, strain_id, qty, uom, farm_code, license_value, location, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'g', 'PNN', 'AU-P-000694', 'CSA', ?, ?, ?)`,
        id,
        kind,
        code,
        tag,
        wip,
        strainId,
        qty,
        ts,
        ts,
        deleted
      );
    item("fg-tri", "FG", "FGTRI", "FGTRI", "fg-wp-tri", "fg-gelato", 2 * LB, null);
    item("fg-sha", "FG", "FGSHA", "FGSHA", "fg-wp-sha", "fg-lemon", LB, null);
    item("fg-wip", "WIP", "FGWIP", "FGWIP", "fg-wp-wip", "fg-gelato", 9 * LB, null);
    item("fg-del", "FG", "FGDEL", "FGDEL", "fg-wp-tri", "fg-gelato", 9 * LB, ts);
    item("fg-pkg", "FG", "FGGONE", "FGGONE", "fg-wp-gone", "fg-gelato", 9 * LB, null);
    m.run(
      `INSERT INTO lab_compliance_samples (
         id, program, license, market, source_metrc_tag, required_test, thc_potency_pct, status, notes, scheduled_at, finished_testing_on, source, created_at, updated_at, changed_at
       ) VALUES ('fg-old', 'compliance', 'AU-P-000694', 'AU', 'FGTRI', 'Potency', 10, 'passed', '', ?, '2026-01-01T00:00:00.000Z', 'station', ?, ?, ?)`,
      ts,
      ts,
      ts,
      ts
    );
    m.run(
      `INSERT INTO lab_compliance_samples (
         id, program, license, market, source_metrc_tag, required_test, thc_potency_pct, status, notes, scheduled_at, finished_testing_on, source, created_at, updated_at, changed_at
       ) VALUES ('fg-new', 'compliance', 'AU-P-000694', 'AU', 'fgtri', 'Potency', 25, 'passed', '', ?, '2026-10-01T00:00:00.000Z', 'station', ?, ?, ?)`,
      ts,
      ts,
      ts,
      ts
    );
    m.run(
      `INSERT INTO lab_compliance_samples (
         id, program, license, market, source_metrc_tag, required_test, thc_potency_pct, status, notes, scheduled_at, finished_testing_on, source, created_at, updated_at, changed_at, voided_at
       ) VALUES ('fg-void', 'compliance', 'AU-P-000694', 'AU', 'FGTRI', 'Potency', 99, 'passed', '', ?, '2026-10-12T00:00:00.000Z', 'station', ?, ?, ?, ?)`,
      ts,
      ts,
      ts,
      ts,
      ts
    );
    m.run(
      `INSERT INTO lab_internal_tests (
         id, tested_at, tested_at_source, location, reason, metrc_tag, sample_type, thc_pct, notes, source, created_at, updated_at, changed_at
       ) VALUES ('fg-int', ?, 'typed', 'CSA', 'check', 'FGSHA', 'trim', 18.2, '', 'station', ?, ?, ?)`,
      ts,
      ts,
      ts,
      ts
    );
    const offer = (id: string, name: string, category: string, grams: number, qty: number, uom: string, status: string, deleted: string | null, thc: number | null) =>
      m.run(
        `INSERT INTO listings (
           id, item_name, category, qty_grams, listed, source, market_uom, market_qty, thc_pct, zoho_status, zoho_mounted_at, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, 1, 'zoho', ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        name,
        category,
        grams,
        uom,
        qty,
        thc,
        status,
        ts,
        ts,
        ts,
        deleted
      );
    offer("fg-bud", "BUD - Gelato - PNN", "Bulk Flower Outdoor", LB, 1, "lb", "Active", null, 22.1);
    offer("fg-off", "BUD - Hidden - PNN", "Bulk Flower Outdoor", 50 * LB, 50, "lb", "Inactive", null, 1);
    offer("fg-zero", "BUD - Empty - PNN", "Bulk Flower Outdoor", 0, 0, "lb", "Active", null, 1);
    offer("fg-dead", "BUD - Dead - PNN", "Bulk Flower Outdoor", 40 * LB, 40, "lb", "Active", ts, 1);
    offer("fg-wbp", "WBP - Skip", "Bulk", 3 * LB, 3, "lb", "Active", null, null);
    const mirror = (tag: string, itemName: string, strainName: string, qty: number) =>
      m.run(
        `INSERT INTO metrc_packages (tag, license_value, item, category, item_strain, quantity, uom, mount_id, first_seen_at, changed_at)
         VALUES (?, 'AU-P-000694', ?, 'Shake/Trim', ?, ?, 'g', 'fg-mount', ?, ?)`,
        tag,
        itemName,
        strainName,
        qty,
        ts,
        ts
      );
    mirror("FGTRI", "TRI - Skip - PNN", "Fg1 Gelato", 2 * LB);
    mirror("FGSHA", "SHA - Skip - PNN", "Fg1 Lemon", LB);
    const model = await loadFgInventory(m.db);
    expect(cat(model, "bud").total).toBeCloseTo(1);
    expect(strain(model, "bud", "Gelato").lines[0].thc).toBe("22.10");
    expect(cat(model, "tri").total).toBeCloseTo(2);
    expect(strain(model, "tri", "Fg1 Gelato").lines[0].thc).toBe("25.00");
    expect(cat(model, "sha").total).toBeCloseTo(1);
    expect(strain(model, "sha", "Fg1 Lemon").lines[0].thc).toBe("18.20");
    expect(model.notShown).toBe(1);
    expect(fgMountedLabel(model.mountedAt)).toBe("2026-10-13 07:32");
    const html = fgInventorySection(model);
    expect(html).not.toContain("Hidden");
    expect(html).not.toContain("Empty");
    expect(html).not.toContain("Dead");
    expect(html).not.toContain("data-fg-other-units");
    expect(html).not.toContain("in other units not shown");
  });

  it("sorts live Shake/Trim by prefix, converts g kg and lb, and keeps zero categories", async () => {
    const m = await migratedDb();
    const ts = "2026-10-13T11:32:00.000Z";
    const mount = (id: string, kind: string, at: string) =>
      m.run(
        `INSERT INTO metrc_mounts (
           id, kind, license_value, filename, file_format, rows_total, rows_added, rows_updated, rows_unchanged, rows_gone, summary, created_at, updated_at
         ) VALUES (?, ?, 'LIC-A', 'packages.csv', 'csv', 1, 1, 0, 0, 0, '', ?, ?)`,
        id,
        kind,
        at,
        at
      );
    mount("fg-old", "packages", "2026-10-01T00:00:00.000Z");
    mount("fg-pkg", "packages", ts);
    mount("fg-plants", "plants", "2026-10-14T00:00:00.000Z");
    const pkg = (
      tag: string,
      license: string,
      itemName: string,
      category: string,
      strainName: string | null,
      qty: number,
      uom: string,
      gone: string | null
    ) =>
      m.run(
        `INSERT INTO metrc_packages (
           tag, license_value, item, category, item_strain, quantity, uom, mount_id, first_seen_at, changed_at, gone_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'fg-pkg', ?, ?, ?)`,
        tag,
        license,
        itemName,
        category,
        strainName,
        qty,
        uom,
        ts,
        ts,
        gone
      );
    pkg("sha-a", "LIC-A", "SHA - Lemon - PNN", "Shake/Trim", null, 448, "G", null);
    pkg("sha-b", "LIC-B", "SHA - Lemon - PNS", "Shake/Trim", null, 224, "g", null);
    pkg("tri-kg", "LIC-A", "TRI - Ignored - PNN", "Shake/Trim", "Named Gelato", 2, "kg", null);
    pkg("mix-lb", "LIC-A", "MIX - Cake - PNN", "Shake/Trim", null, 1, "lb", null);
    pkg("zzz-g", "LIC-A", "ZZZ - Mystery - PNN", "Shake/Trim", "  ", 100, "g", null);
    pkg("each-1", "LIC-A", "SHA - Skip - PNN", "Shake/Trim", "Skip", 4, "each", null);
    pkg("grams-word", "LIC-A", "SHA - Spelled - PNN", "Shake/Trim", null, 50, "Grams", null);
    pkg("bio-1", "LIC-A", "BIO - Biomass - PNN - O", "Shake/Trim", null, 9150, "g", null);
    pkg("bio-2", "LIC-A", "Biomass - S", "Shake/Trim", null, 8000, "g", null);
    pkg("wbp-1", "LIC-A", "WBP - Not Finished - PNN", "Shake/Trim", null, 700, "g", null);
    pkg("pounds-word", "LIC-A", "TRI - Pounds - PNN", "Shake/Trim", null, 2, "Pounds", null);
    pkg("gone-1", "LIC-A", "SHA - Gone Strain - PNN", "Shake/Trim", "Gone Strain", 9000, "g", ts);
    pkg("zero-1", "LIC-A", "TRI - Zero Strain - PNN", "Shake/Trim", "Zero Strain", 0, "g", null);
    pkg("buds-1", "LIC-A", "SHA - Buds Strain - PNN", "Buds", "Buds Strain", 9000, "g", null);
    m.run(
      `INSERT INTO lab_compliance_samples (
         id, program, license, market, source_metrc_tag, required_test, thc_potency_pct, status, notes, scheduled_at, finished_testing_on, source, created_at, updated_at, changed_at
       ) VALUES ('fg-old-thc', 'compliance', 'LIC-A', 'AU', 'tri-kg', 'Potency', 10, 'passed', '', ?, '2026-01-01T00:00:00.000Z', 'station', ?, ?, ?)`,
      ts,
      ts,
      ts,
      ts
    );
    m.run(
      `INSERT INTO lab_compliance_samples (
         id, program, license, market, source_metrc_tag, required_test, thc_potency_pct, status, notes, scheduled_at, finished_testing_on, source, created_at, updated_at, changed_at
       ) VALUES ('fg-new-thc', 'compliance', 'LIC-A', 'AU', 'TRI-KG', 'Potency', 25, 'passed', '', ?, '2026-10-01T00:00:00.000Z', 'station', ?, ?, ?)`,
      ts,
      ts,
      ts,
      ts
    );
    m.run(
      `INSERT INTO lab_compliance_samples (
         id, program, license, market, source_metrc_tag, required_test, thc_potency_pct, status, notes, scheduled_at, finished_testing_on, source, created_at, updated_at, changed_at, voided_at
       ) VALUES ('fg-void-thc', 'compliance', 'LIC-A', 'AU', 'tri-kg', 'Potency', 99, 'passed', '', ?, '2026-10-12T00:00:00.000Z', 'station', ?, ?, ?, ?)`,
      ts,
      ts,
      ts,
      ts,
      ts
    );
    const model = await loadFgInventory(m.db);
    expect(cat(model, "sha").total).toBeCloseTo(722 / LB);
    expect(strain(model, "sha", "Spelled").amount).toBeCloseTo(50 / LB);
    expect(strain(model, "tri", "Pounds").amount).toBeCloseTo((2 * 453.59237) / LB);
    expect(strain(model, "sha", "Lemon").amount).toBeCloseTo(672 / LB);
    expect(strain(model, "sha", "Lemon").lines.map((line) => line.thc)).toEqual([""]);
    expect(strain(model, "tri", "Named Gelato").amount).toBeCloseTo(2000 / LB);
    expect(strain(model, "tri", "Named Gelato").lines[0].thc).toBe("25.00");
    expect(strain(model, "tri", "Cake").amount).toBeCloseTo(453.59237 / LB);
    expect(strain(model, "tri", "Mystery").amount).toBeCloseTo(100 / LB);
    expect(model.categories.map((item) => item.key)).toEqual(["bud", "tri", "sha", "pre", "distillate", "isolate", "infused", "preroll", "vape"]);
    for (const key of ["bud", "pre", "distillate", "isolate", "infused", "preroll", "vape"]) expect(cat(model, key).total).toBe(0);
    expect(model.metrcOtherUnits).toBe(1);
    expect(fgMountedLabel(model.metrcMountedAt)).toBe("2026-10-13 07:32");
    const html = fgInventorySection(model);
    expect(html).toContain('data-fg-cat="tri"');
    for (const label of ["Bud", "Trim/Bio", "Shake", "Ounces"]) expect(html).toContain(`>${label}<`);
    expect(html).toContain('data-fg-cat="sha"');
    expect(html).toContain('data-fg-cat="pre" data-fg-total="0.00"');
    expect(html).toContain('data-fg-strain="Named Gelato"');
    expect(html).toContain('data-fg-thc="25.00"');
    expect(html).not.toContain("Gone Strain");
    expect(html).not.toContain("Zero Strain");
    expect(html).not.toContain("Buds Strain");
    expect(html).not.toContain("Ignored");
    expect(strain(model, "tri", "Biomass").amount).toBeCloseTo(9150 / LB);
    expect(strain(model, "tri", "S").amount).toBeCloseTo(8000 / LB);
    expect(html).not.toContain("Not Finished");
    expect(html).not.toContain("data-fg-metrc");
    expect(html).not.toContain("From METRC, live Shake/Trim packages");
    expect(html).toContain('data-fg-other-units="1"');
    expect(html).toContain("1 METRC packages in other units not shown");
    const es = fgInventorySection(model, "es");
    expect(es).not.toContain("Desde METRC");
    expect(es).toContain("Onzas");
    expect(es).toContain("Cogollo");
    expect(es).toContain("1 paquetes de METRC en otras unidades no mostrados");
    const keys = ["From METRC, live Shake/Trim packages, as of the last mirror mount", "{n} METRC packages in other units not shown"];
    for (const key of keys) {
      expect(DICT[key]?.en).toBe(key);
      expect(DICT[key]?.es.trim().length).toBeGreaterThan(0);
    }
  });
});

const ICON_HASH: Record<string, string> = {
  bud: "05d9ede6900567f4",
  tri: "745518556b563f4c",
  sha: "6cd3bfdad13cd51c",
  pre: "f96ae2e12f47d32b",
  distillate: "8e87820e244263b9",
  isolate: "aa46c6297343cabd",
  infused: "ecdbdf6a91cf2635",
  preroll: "dc517b1ef23ce2c0",
  vape: "82bbbd720381c463",
};

function sliceCat(html: string, key: string): string {
  const at = html.indexOf(`data-fg-cat="${key}"`);
  if (at < 0) throw new Error(key);
  const next = html.indexOf('data-fg-cat="', at + 12);
  return html.slice(at, next < 0 ? undefined : next);
}

function trimLb(lb: number, code = "TRIM"): FgLedgerRow {
  return { typeCode: code, strain: "Gelato", thcPct: 22, grams: lb * LB };
}

describe("FG3 icons and stacked bars", () => {
  it("keeps the caps and the truck size as named constants", () => {
    expect(FG_TRUCK_LB).toBe(8000);
    expect(FG_CAPS).toEqual({ tri: 40000, sha: 5000, distillate: 2000, isolate: 68000, infused: 20000 });
    expect(fgTruckCount(40000)).toBe(5);
    expect(fgTruckCount(52000)).toBe(7);
    expect(fgTruckCount(6.5 * FG_TRUCK_LB)).toBe(7);
  });

  it("bands bud THC at each edge, weighted by pounds, with no THC last", () => {
    const edges: Array<[number | null, string, string]> = [
      [19.99, "19.99% or less", "b1"],
      [20, "20 to 25%", "b2"],
      [24.99, "20 to 25%", "b2"],
      [25, "25 to 30%", "b3"],
      [29.99, "25 to 30%", "b3"],
      [30, "30% and up", "b4"],
      [null, "no THC", "none"],
    ];
    for (const [pct, band, tone] of edges) {
      expect(budThcBand(pct)).toBe(band);
      const html = fgInventorySection(buildFgInventory([listing({ qtyGrams: LB, thcPct: pct })], []));
      const bud = sliceCat(html, "bud");
      expect(bud.match(/data-fg-seg=/g)?.length).toBe(1);
      expect(bud).toContain(`data-fg-tone="${tone}"`);
      expect(bud).toContain(`data-fg-seg="${band}"`);
      expect(bud).toContain('data-fg-share="1.0000"');
      expect(bud).not.toContain('data-fg-over="1"');
    }
    const mixed = fgInventorySection(
      buildFgInventory(
        [
          listing({ itemName: "BUD - Alpha - PNN", qtyGrams: LB, thcPct: 19.99 }),
          listing({ itemName: "BUD - Bravo - PNN", qtyGrams: 3 * LB, thcPct: 30 }),
          listing({ itemName: "BUD - Charlie - PNN", qtyGrams: LB, thcPct: null }),
        ],
        []
      )
    );
    const bud = sliceCat(mixed, "bud");
    const low = bud.indexOf('data-fg-seg="19.99% or less"');
    const high = bud.indexOf('data-fg-seg="30% and up"');
    const none = bud.indexOf('data-fg-seg="no THC"');
    expect(low).toBeGreaterThanOrEqual(0);
    expect(low).toBeLessThan(high);
    expect(high).toBeLessThan(none);
    expect(bud).toContain('data-fg-seg="19.99% or less" data-fg-share="0.2000"');
    expect(bud).toContain('data-fg-seg="30% and up" data-fg-share="0.6000"');
    expect(bud).toContain('data-fg-seg="no THC" data-fg-share="0.2000"');
    expect(bud).toContain('data-fg-tone="none"');
  });

  it("turns TRI red at 40,000 lb and names the trucks, and stays plain at 39,999", () => {
    const under = sliceCat(fgInventorySection(buildFgInventory([], [trimLb(39999)])), "tri");
    expect(under).toContain("39,999.00 lb of 40,000 lb");
    expect(under).not.toContain('data-fg-over="1"');
    expect(under).not.toContain("data-fg-trucks");
    expect(under).not.toContain("trucks");
    const at = sliceCat(fgInventorySection(buildFgInventory([], [trimLb(40000)])), "tri");
    expect(at).toContain("40,000.00 lb of 40,000 lb");
    expect(at).toContain('data-fg-over="1"');
    expect(at).toContain('data-fg-trucks="5"');
    expect(at).toContain(">5 trucks<");
    const over = sliceCat(fgInventorySection(buildFgInventory([], [trimLb(52000)])), "tri");
    expect(over).toContain("52,000.00 lb of 40,000 lb");
    expect(over).toContain('data-fg-over="1"');
    expect(over).toContain('data-fg-trucks="7"');
    expect(over).toContain(">7 trucks<");
    expect(over).toContain('data-fg-share="1.0000"');
  });

  it("turns SHA, distillate, isolate and infused red only above the cap, and the note is the total", () => {
    const shaUnder = sliceCat(fgInventorySection(buildFgInventory([], [trimLb(5000, "SHAKE")])), "sha");
    expect(shaUnder).toContain("5,000.00 lb of 5,000 lb");
    expect(shaUnder).not.toContain('data-fg-over="1"');
    expect(shaUnder).not.toContain("hc-fg-note");
    const shaOver = sliceCat(fgInventorySection(buildFgInventory([], [trimLb(5000.01, "SHAKE")])), "sha");
    expect(shaOver).toContain('data-fg-over="1"');
    expect(shaOver).toContain('class="hc-fg-note">5,000.01 lb<');
    const oilUnder = sliceCat(
      fgInventorySection(buildFgInventory([listing({ itemName: "Mitten Distillate", category: "Concentrate", marketUom: "L", marketQty: 2000, qtyGrams: 0, thcPct: null })], [])),
      "distillate"
    );
    expect(oilUnder).toContain("2,000.00 L of 2,000 L");
    expect(oilUnder).not.toContain('data-fg-over="1"');
    const oilOver = sliceCat(
      fgInventorySection(buildFgInventory([listing({ itemName: "Mitten Distillate", category: "Concentrate", marketUom: "L", marketQty: 2000.01, qtyGrams: 0, thcPct: null })], [])),
      "distillate"
    );
    expect(oilOver).toContain('data-fg-over="1"');
    expect(oilOver).toContain('class="hc-fg-note">2,000.01 L<');
    const iso = (grams: number) =>
      sliceCat(
        fgInventorySection(
          buildFgInventory([listing({ itemName: "HZ Holdings THCA", category: "Concentrate", marketUom: "g", marketQty: grams, qtyGrams: grams, thcPct: null })], [])
        ),
        "isolate"
      );
    expect(iso(68000)).toContain("68,000 g of 68,000 g");
    expect(iso(68000)).not.toContain('data-fg-over="1"');
    expect(iso(68001)).toContain('data-fg-over="1"');
    expect(iso(68001)).toContain('class="hc-fg-note">68,001 g<');
    const flower = (grams: number) =>
      sliceCat(
        fgInventorySection(
          buildFgInventory(
            [listing({ itemName: "GRIP Infused Flower - Grape", category: "Infused Flower", marketUom: "each", marketQty: grams, qtyGrams: grams, eachGrams: 1, thcPct: null })],
            []
          )
        ),
        "infused"
      );
    expect(flower(20000)).toContain("20,000 g of 20,000 g");
    expect(flower(20000)).not.toContain('data-fg-over="1"');
    expect(flower(20001)).toContain('data-fg-over="1"');
    expect(flower(20001)).toContain('class="hc-fg-note">20,001 g<');
  });

  it("shares PRE by strain and writes preroll and vape segment text", () => {
    const pre = sliceCat(
      fgInventorySection(
        buildFgInventory(
          [
            listing({ itemName: "PRE - Lemon - PNN", category: "Prepack Ounces", marketUom: "each", marketQty: 48, qtyGrams: 0, eachGrams: null, thcPct: 18 }),
            listing({ itemName: "PRE - Gelato - PNN", category: "Prepack Ounces", marketUom: "each", marketQty: 16, qtyGrams: 0, eachGrams: null, thcPct: 22 }),
          ],
          []
        )
      ),
      "pre"
    );
    expect(pre.indexOf('data-fg-seg="Gelato"')).toBeLessThan(pre.indexOf('data-fg-seg="Lemon"'));
    expect(pre).toContain('data-fg-seg="Gelato" data-fg-share="0.2500"');
    expect(pre).toContain('data-fg-seg="Lemon" data-fg-share="0.7500"');
    expect(pre).toContain('title="Gelato: 1.00 lb"');
    const rolls = sliceCat(
      fgInventorySection(
        buildFgInventory(
          [
            listing({ itemName: "IPR - Orange Crush 1.2g", category: "Infused Pre-Rolls", marketUom: "each", marketQty: 6, qtyGrams: 0, thcPct: null }),
            listing({ itemName: "IPR - Grape Ape", category: "Infused Pre-Rolls", marketUom: "each", marketQty: 3, qtyGrams: 0, thcPct: null }),
          ],
          []
        )
      ),
      "preroll"
    );
    expect(rolls).toContain(">Orange Crush 1.2g: 6<");
    expect(rolls).toContain(">Grape Ape: 3<");
    expect(rolls).toContain('title="Orange Crush 1.2g: 6 each"');
    const vapes = sliceCat(
      fgInventorySection(
        buildFgInventory(
          [
            listing({ itemName: "GRIP Vape - Berry Mojito - 1g", category: "Vape/Cart", marketUom: "each", marketQty: 5, qtyGrams: 5, eachGrams: 1, thcPct: null }),
            listing({ itemName: "GRIP Vape - Berry Mojito - 2g", category: "Vape/Cart", marketUom: "each", marketQty: 20, qtyGrams: 40, eachGrams: 2, thcPct: null }),
            listing({ itemName: "GRIP Vape - Lemon - 2g", category: "Vape/Cart", marketUom: "each", marketQty: 3, qtyGrams: 6, eachGrams: 2, thcPct: null }),
          ],
          []
        )
      ),
      "vape"
    );
    expect(vapes).toContain(">1g: 5, 1 flavor<");
    expect(vapes).toContain(">2g: 23, 2 flavors<");
    expect(vapes).toContain('title="1g: 5 each, 1 flavor"');
    expect(vapes).toContain('data-fg-seg="1g"');
    expect(vapes).toContain('data-fg-seg="2g"');
  });

  it("draws an empty track, nine bars in order, and the icon as a mask", () => {
    const html = fgInventorySection(buildFgInventory([], []));
    const keys = ["bud", "tri", "sha", "pre", "distillate", "isolate", "infused", "preroll", "vape"];
    const bars = [...html.matchAll(/data-fg-bar="([^"]+)"/g)].map((hit) => hit[1]);
    expect(bars).toEqual(keys);
    const isolate = sliceCat(html, "isolate");
    expect(isolate).toContain('data-fg-bar="isolate"');
    expect(isolate).not.toContain("data-fg-seg");
    expect(isolate).toContain('class="hc-fg-track"></span>');
    expect(isolate).toContain('role="img"');
    expect(isolate).toContain('aria-label="Isolate: 0 g of 68,000 g"');
    for (const key of keys) {
      const mask = `url(/icons/fg/fg-${key}.svg) center / contain no-repeat`;
      expect(html).toContain(`style="background:currentColor;-webkit-mask:${mask};mask:${mask}"`);
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toContain(`data-fg-cat="${key}" open`);
    }
    for (const view of ["lite", "co", "cerberus"] as const) {
      const css = themeStylesheet(view);
      expect(css).toContain(".hc-fg-icon { width: 44px; height: 30px; flex: 0 0 auto; display: block; }");
      expect(css).toContain("@media (max-width: 820px) {\n  .hc-fg-row { flex-wrap: wrap; }\n  .hc-fg-bar { flex-basis: 100%; }\n}");
    }
    expect(themeStylesheet("co")).toContain(".hc-fg-bar { --fg-over-ink: #1c1914; }");
    expect(themeStylesheet("cerberus")).toContain(".hc-fg-bar { --fg-over-ink: #1c1914; }");
  });

  it("holds the nine icon files at the traced hashes", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL): Uint8Array };
    const crypto = (await import("node:" + "crypto")) as {
      createHash(alg: string): { update(data: Uint8Array): { digest(enc: "hex"): string } };
    };
    for (const [key, hash] of Object.entries(ICON_HASH)) {
      const bytes = fs.readFileSync(new URL(`../public/icons/fg/fg-${key}.svg`, import.meta.url));
      expect(crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16)).toBe(hash);
    }
  });

  it("says trucks, of, and no THC in Spanish", () => {
    for (const [key, es] of [
      ["trucks", "camiones"],
      ["of", "de"],
      ["no THC", "sin THC"],
      ["flavor", "sabor"],
      ["flavors", "sabores"],
    ] as const) {
      expect(DICT[key]?.en).toBe(key);
      expect(DICT[key]?.es).toBe(es);
    }
    const es = fgInventorySection(
      buildFgInventory(
        [listing({ qtyGrams: LB, thcPct: null })],
        [trimLb(40000)]
      ),
      "es"
    );
    expect(sliceCat(es, "tri")).toContain("de 40,000 lb");
    expect(sliceCat(es, "tri")).toContain(">5 camiones<");
    expect(sliceCat(es, "bud")).toContain(">sin THC<");
    expect(sliceCat(es, "bud")).toContain('data-fg-seg="no THC"');
  });
});
