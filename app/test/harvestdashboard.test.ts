import { describe, expect, it } from "vitest";
import { saveHarvestDashboard } from "../src/actions";
import { HttpError } from "../src/audit";
import { CONFIG_KEYS } from "../src/config";
import { getConfigValue } from "../src/db";
import {
  FG_SETTINGS,
  FG_SETTING_KEYS,
  budThcBand,
  buildFgInventory,
  fgInventorySection,
  fgSettingsFrom,
  type FgLedgerRow,
} from "../src/fginventory";
import { harvestDashboardPage, loadHarvestDashboard } from "../src/harvestdashboard";
import { LOOKUP_LANDING } from "../src/lookups";
import { formOf, migratedDb, seedPerson } from "./migrated";

const LB = 448;

function listing(over: { itemName?: string; qtyGrams?: number | null; thcPct?: number | null } = {}) {
  return {
    itemName: over.itemName ?? "BUD - Gelato - PNN",
    category: "Bulk Flower Outdoor",
    marketUom: "lb",
    marketQty: 1,
    qtyGrams: over.qtyGrams === undefined ? LB : over.qtyGrams,
    eachGrams: null,
    thcPct: over.thcPct === undefined ? 22 : over.thcPct,
    mountedAt: null,
  };
}

function trimLb(lb: number): FgLedgerRow {
  return { typeCode: "TRIM", strain: "Gelato", thcPct: 22, grams: lb * LB };
}

function sliceCat(html: string, key: string): string {
  const at = html.indexOf(`data-fg-cat="${key}"`);
  if (at < 0) throw new Error(key);
  const next = html.indexOf('data-fg-cat="', at + 12);
  return html.slice(at, next < 0 ? undefined : next);
}

const SEEDED: Record<string, string> = {
  fg_cap_tri_lb: "40000",
  fg_cap_sha_lb: "5000",
  fg_cap_distillate_l: "2000",
  fg_cap_isolate_g: "68000",
  fg_cap_infused_g: "20000",
  fg_truck_lb: "8000",
  fg_bud_thc_bands: "20,25,30",
  fg_not_finished: "WBP,WIP,WPR,BIOMASS,FFZ",
  fg_metrc_not_finished: "WBP,WIP,WPR,FFZ",
  fg_folded_prefixes: "MIX=BUD,NUG=BUD,MOB=PRE:70",
  fg_pre_each_grams: "28",
};

describe("AD1 Harvest Dashboard", () => {
  it("reads each seeded key back, and a missing or bad row falls back", async () => {
    const m = await migratedDb();
    for (const key of FG_SETTING_KEYS) {
      expect(await getConfigValue(m.db, key)).toBe(SEEDED[key]);
    }
    const page = await loadHarvestDashboard(m.db);
    for (const key of FG_SETTING_KEYS) {
      const field = page.fields.find((row) => row.key === key);
      expect(field?.fallback).toBe(false);
      expect(field?.value).toBe(SEEDED[key]);
    }
    expect(fgSettingsFrom(new Map()).caps.tri).toBe(40000);
    expect(fgSettingsFrom(new Map([[CONFIG_KEYS.fg_cap_tri_lb, "nope"]])).caps.tri).toBe(FG_SETTINGS.caps.tri);
    expect(budThcBand(19.99, fgSettingsFrom(new Map()).bands)).toBe("19.99% or less");
    const button = LOOKUP_LANDING.flatMap((section) => section.buttons).find((row) => row.key === "harvest_dashboard");
    expect(button?.href).toBe("/admin/lookups/harvest_dashboard");
    const html = harvestDashboardPage(page, "en");
    for (const key of FG_SETTING_KEYS) expect(html).toContain(`data-hd-key="${key}"`);
    expect(html).toContain('data-hd-pane="FG inventory"');
    expect(html).toContain('data-hd-pane="Trimming"');
    expect(html).toContain("btr_type_codes");
    expect(html).toContain('class="hd-break">BUD=BUD,SMALLS=WPR,SHAKE=SHA');
  });

  it("a changed cap turns 35,000 lb red and names 4 trucks, and a changed truck size changes the count", () => {
    const capped = {
      ...FG_SETTINGS,
      caps: { ...FG_SETTINGS.caps, tri: 30000 },
    };
    const red = sliceCat(fgInventorySection(buildFgInventory([], [trimLb(35000)], capped)), "tri");
    expect(red).toContain('data-fg-over="1"');
    expect(red).toContain('data-fg-trucks="4"');
    expect(red).toContain(">4 trucks<");
    expect(red).toContain("35,000.00 lb of 30,000 lb");
    const trucks = {
      ...FG_SETTINGS,
      truckLb: 10000,
    };
    const counted = sliceCat(fgInventorySection(buildFgInventory([], [trimLb(40000)], trucks)), "tri");
    expect(counted).toContain('data-fg-trucks="4"');
    expect(counted).toContain(">4 trucks<");
  });

  it("a changed band edge moves a listing out of the first band", () => {
    const edges = fgSettingsFrom(new Map([[CONFIG_KEYS.fg_bud_thc_bands, "18,25,30"]]));
    const html = sliceCat(fgInventorySection(buildFgInventory([listing({ thcPct: 19.99 })], [], edges)), "bud");
    expect(html).toContain('data-fg-seg="18 to 25%"');
    expect(html).not.toContain('data-fg-seg="19.99% or less"');
    expect(budThcBand(19.99)).toBe("19.99% or less");
  });

  it("refuses text, zero, a negative, and bands out of order, and logs a save", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const refuse = async (value: string, key: string = CONFIG_KEYS.fg_cap_tri_lb) => {
      const err = await saveHarvestDashboard(m.db, formOf({ person_id: person, key, value, reason: "try" })).catch((e) => e);
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
      expect(await getConfigValue(m.db, key)).toBe(SEEDED[key]);
    };
    await refuse("abc");
    await refuse("0");
    await refuse("-5");
    await refuse("30,25,20", CONFIG_KEYS.fg_bud_thc_bands);
    await refuse("20,nope,30", CONFIG_KEYS.fg_bud_thc_bands);
    const saved = await saveHarvestDashboard(
      m.db,
      formOf({ person_id: person, key: CONFIG_KEYS.fg_cap_tri_lb, value: "30000", reason: "lower the red line" })
    );
    expect(saved.redirect).toBe("/admin/lookups/harvest_dashboard?ok=saved");
    expect(await getConfigValue(m.db, CONFIG_KEYS.fg_cap_tri_lb)).toBe("30000");
    const log = m.get(
      `SELECT old_value, new_value FROM record_change_log WHERE record_table = 'app_config' AND record_id = 'fg_cap_tri_lb' AND field = 'value'`
    );
    expect(log?.old_value).toBe("40000");
    expect(log?.new_value).toBe("30000");
  });
});
