import { describe, expect, it } from "vitest";
import { CONTINUUM_HOME_URL, continuumCrumb, homePage, opsGroupPage } from "../src/html";
import { DEFAULT_VIEW } from "../src/config";
import { complianceTestingPage } from "../src/equipment";
import { OPS_ICON_NAMES, opsIconSvg } from "../src/icons";
import {
  HOME_SURFACE_KEYS,
  OPS_FLOW_EDGES,
  OPS_GROUPS,
  OPS_PHONE_ORDER,
  PIPELINE,
  homeEntries,
  opsGroupByKey,
  opsMemberKeys,
  reservedOpsMemberByKey,
} from "../src/pipeline";

describe("OPS_GROUPS registry (owner ruling 2026-09-02)", () => {
  it("declares the six groups with the named icons and hrefs", () => {
    expect(OPS_GROUPS.map((g) => g.key)).toEqual([
      "harvest_ops",
      "interco_logistics",
      "drying_ops",
      "production_ops",
      "marketplace",
      "business_ops",
    ]);
    expect(opsGroupByKey("harvest_ops")?.icon).toBe("field");
    expect(opsGroupByKey("interco_logistics")?.icon).toBe("truck");
    expect(opsGroupByKey("drying_ops")?.icon).toBe("silo");
    expect(opsGroupByKey("production_ops")?.icon).toBe("factory");
    expect(opsGroupByKey("marketplace")?.icon).toBe("storefront");
    expect(opsGroupByKey("business_ops")?.icon).toBe("scales");
    expect(opsGroupByKey("harvest_ops")?.href).toBe("/ops/harvest_ops");
    expect(opsGroupByKey("interco_logistics")?.href).toBe("/ops/interco_logistics");
    expect(opsGroupByKey("interco_logistics")?.label).toBe("Logistics Operations");
    expect(opsGroupByKey("marketplace")?.href).toBe("/marketplace");
    expect(opsGroupByKey("marketplace")?.reserved).toBeUndefined();
    expect(opsGroupByKey("marketplace")?.members.map((m) => m.href)).toEqual(["/marketplace"]);
  });

  it("places every home-surface station and page of today in exactly one group", () => {
    const keys = opsMemberKeys();
    for (const key of HOME_SURFACE_KEYS) {
      expect(keys.filter((k) => k === key)).toHaveLength(1);
    }
    const homeStationKeys = homeEntries().map((e) => e.key);
    for (const key of homeStationKeys) {
      expect(keys).toContain(key);
    }
    expect([...HOME_SURFACE_KEYS]).toEqual([
      "acquire_hbn",
      "wet_weight",
      "unload_dry_space",
      "trim_packages",
      "cryo_weight",
      "internal_logistics",
      "processing_partners",
      "fulfillment",
      "inventory",
      "virtual_move_processor",
    ]);
  });

  it("lists exactly the five flow edges, Business Operations in the chain", () => {
    // Owner ruling 2026-09-02 (evening): "swap marketplace and business ops
    // and add the arrow in between." The island is retired.
    expect(OPS_FLOW_EDGES).toEqual([
      { from: "harvest_ops", to: "interco_logistics", dir: "right" },
      { from: "interco_logistics", to: "drying_ops", dir: "right" },
      { from: "drying_ops", to: "production_ops", dir: "down" },
      { from: "production_ops", to: "business_ops", dir: "left" },
      { from: "business_ops", to: "marketplace", dir: "left" },
    ]);
  });

  it("phones the six groups in flow order, Business before Marketplace", () => {
    expect([...OPS_PHONE_ORDER]).toEqual([
      "harvest_ops",
      "interco_logistics",
      "drying_ops",
      "production_ops",
      "business_ops",
      "marketplace",
    ]);
  });

  it("names reserved members and their future files", () => {
    expect(reservedOpsMemberByKey("virtual_move_processor")).toBeUndefined();
    expect(reservedOpsMemberByKey("compliance_console")).toBeUndefined();
    expect(reservedOpsMemberByKey("purchasing")).toBeUndefined();
    expect(opsGroupByKey("business_ops")?.members.map((m) => m.href)).toEqual([
      "/compliance",
      "/purchasing",
    ]);
    expect(reservedOpsMemberByKey("acquire_hbn")).toBeUndefined();
  });
});

describe("ops icons (owner ruling 2026-09-02)", () => {
  // The row-two law after the owner's evening swap: Production stays in grid
  // column 5 under Drying's down arrow; the flow runs Production to Business
  // Operations to Marketplace with a left arrow between each pair.
  it("runs row two Marketplace, arrow, Business, arrow, Production under the down arrow", () => {
    const html = homePage(undefined, "en");
    // Slice the desktop row only; the phone chain repeats the keys after it.
    const row2 = html.slice(html.indexOf("ops-row-2"), html.indexOf("ops-map-phone"));
    const marketplace = row2.indexOf('data-ops-key="marketplace"');
    const business = row2.indexOf('data-ops-key="business_ops"');
    const production = row2.indexOf('data-ops-key="production_ops"');
    expect(marketplace).toBeGreaterThan(-1);
    expect(business).toBeGreaterThan(marketplace);
    expect(production).toBeGreaterThan(business);
    // A left arrow sits in each gap.
    const arrow1 = row2.indexOf("ops-arrow-left");
    const arrow2 = row2.indexOf("ops-arrow-left", arrow1 + 1);
    expect(arrow1).toBeGreaterThan(marketplace);
    expect(arrow1).toBeLessThan(business);
    expect(arrow2).toBeGreaterThan(business);
    expect(arrow2).toBeLessThan(production);
    // Production is the row's last node: column 5, under Drying's down arrow.
    expect(row2.indexOf("data-ops-key", production + 1)).toBe(-1);
  });

  it("keeps src/icons.ts compiling as legacy (map no longer inlines it)", () => {
    expect([...OPS_ICON_NAMES]).toEqual([
      "field",
      "truck",
      "silo",
      "factory",
      "storefront",
      "scales",
    ]);
    for (const name of OPS_ICON_NAMES) {
      const svg = opsIconSvg(name);
      expect(svg.startsWith("<svg ")).toBe(true);
      expect(svg).toContain('viewBox="0 0 64 64"');
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('aria-hidden="true"');
      expect(new TextEncoder().encode(svg).byteLength).toBeLessThan(2048);
      expect(svg).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("map nodes render vendored img srcs and variant classes, not inline svg", () => {
    const html = homePage(undefined, "en");
    const expected: Record<string, string> = {
      harvest_ops: "harvest-field",
      interco_logistics: "interco-truck",
      drying_ops: "drying-silo",
      production_ops: "production-factory",
      marketplace: "marketplace",
      business_ops: "business-scale",
    };
    for (const [key, stem] of Object.entries(expected)) {
      const start = html.indexOf(`data-ops-key="${key}"`);
      const slice = html.slice(start, start + 700);
      expect(slice).toContain(`src="/icons/white/${stem}.svg"`);
      expect(slice).toContain(`src="/icons/dark/${stem}.svg"`);
      expect(slice).toContain('class="ops-icon ops-icon-on-dark"');
      expect(slice).toContain('class="ops-icon ops-icon-on-light"');
      expect(slice).toContain('aria-hidden="true"');
      expect(slice).toContain('width="54"');
      expect(slice).toContain('height="54"');
      expect(slice).not.toContain("<svg ");
    }
    const group = opsGroupPage(opsGroupByKey("harvest_ops")!, "en");
    expect(group).toContain('src="/icons/white/harvest-field.svg"');
    expect(group).toContain("ops-icon-on-light");
  });
});

describe("the home crumb in the Continuum format (canon 0.30.28)", () => {
  // Owner ruling 2026-09-09, verbatim: "add a return to continuum link at the
  // top of the homepage only present when in continuum format on the format
  // pill.  Make the continuum format loading default"
  const crumb = '<a class="continuum-crumb" href="https://gripcontinuum.gripcannabis.com/#/">&#8592; Back to the Continuum 10</a>';

  it("leads the home page with the Back to the Continuum 10 crumb in the co view", () => {
    const html = homePage(undefined, "en", "co");
    expect(html.trimStart().startsWith(crumb)).toBe(true);
    expect(html.indexOf(crumb)).toBeLessThan(html.indexOf("<h1>Operations</h1>"));
    expect(continuumCrumb("en")).toBe(crumb);
    expect(CONTINUUM_HOME_URL).toBe("https://gripcontinuum.gripcannabis.com/#/");
    // The same destination the Continuum pages' own crumb points at.
    expect(complianceTestingPage()).toContain('href="https://gripcontinuum.gripcannabis.com/#/">&#8592; Back to the Continuum 10</a>');
  });

  it("is the loading default: no view named means the co home, crumb and all", () => {
    expect(DEFAULT_VIEW).toBe("co");
    expect(homePage(undefined, "en")).toContain(crumb);
    expect(homePage(PIPELINE)).toContain(crumb);
  });

  it("stays off the home page in the Grip and Lite formats", () => {
    expect(homePage(undefined, "en", "cerberus")).not.toContain("continuum-crumb");
    expect(homePage(undefined, "en", "lite")).not.toContain("continuum-crumb");
    expect(homePage(undefined, "en", "cerberus").trimStart().startsWith("<h1>Operations</h1>")).toBe(true);
  });

  it("stays off every other page: the group pages carry no crumb in any view", () => {
    const group = opsGroupPage(opsGroupByKey("harvest_ops")!, "en");
    expect(group).not.toContain("continuum-crumb");
  });

  it("translates the crumb's words and keeps the Continuum name", () => {
    expect(homePage(undefined, "es", "co")).toContain("&#8592; Volver al Continuum 10</a>");
    expect(homePage(undefined, "es", "co")).toContain("<h1>Operaciones</h1>");
  });
});
