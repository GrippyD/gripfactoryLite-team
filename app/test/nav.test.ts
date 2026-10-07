import { describe, expect, it } from "vitest";
import { HARVEST_PATH, MODELS_PATH, PRODUCTION_SCHEDULING_PATH } from "../src/config";
import { layout } from "../src/html";
import { backCrumb, backLinkFor, refererPath } from "../src/nav";
import { OPS_GROUPS } from "../src/pipeline";

/** THE BACK LINK (canon 0.30.109). Owner ruling 2026-09-17, verbatim: "All
 * sub-menus need to have a link that goes back to the pervious menu.  Using
 * the "home" button for every process is too onerous". */
describe("THE BACK LINK (canon 0.30.109): the menu above every page", () => {
  it("Home has no parent; the group pages and the map's own-page groups go back to Home", () => {
    expect(backLinkFor("/")).toBeNull();
    expect(backLinkFor("/?ok=1")).toBeNull();
    for (const group of OPS_GROUPS) {
      expect(backLinkFor(group.href)).toEqual({ href: "/", label: "Home" });
    }
    expect(backLinkFor("/interco")).toEqual({ href: "/", label: "Home" });
    expect(backLinkFor("/marketplace")).toEqual({ href: "/", label: "Home" });
  });

  it("every station and member page goes back to its group on the operations map", () => {
    for (const group of OPS_GROUPS) {
      for (const member of group.members) {
        if (member.href === group.href) continue;
        expect(backLinkFor(member.href), member.href).toEqual({ href: group.href, label: group.label });
      }
    }
    expect(backLinkFor("/station/wet_weight?pick=abc&new=1")).toEqual({ href: "/ops/harvest_ops", label: "Harvest Operations" });
    expect(backLinkFor("/station/load_silo/")).toEqual({ href: "/ops/drying_ops", label: "Drying Operations" });
    expect(backLinkFor("/station/cryo_weight")).toEqual({ href: "/ops/production_ops", label: "Production Operations" });
    expect(backLinkFor("/fulfillment")).toEqual({ href: "/ops/production_ops", label: "Production Operations" });
    expect(backLinkFor("/inventory")).toEqual({ href: "/ops/production_ops", label: "Production Operations" });
    expect(backLinkFor("/compliance")).toEqual({ href: "/ops/business_ops", label: "Business Operations" });
    expect(backLinkFor("/purchasing")).toEqual({ href: "/ops/business_ops", label: "Business Operations" });
    expect(backLinkFor("/virtual-move")).toEqual({ href: "/ops/drying_ops", label: "Drying Operations" });
  });

  it("the families under a page go back to that page", () => {
    expect(backLinkFor(PRODUCTION_SCHEDULING_PATH)).toEqual({ href: "/ops/production_ops", label: "Production Operations" });
    expect(backLinkFor(`${PRODUCTION_SCHEDULING_PATH}/trim`)).toEqual({ href: PRODUCTION_SCHEDULING_PATH, label: "Production Scheduling" });
    expect(backLinkFor("/fulfillment/pick-orders")).toEqual({ href: "/fulfillment", label: "Fulfillment" });
    expect(backLinkFor("/fulfillment/saleshelper/")).toEqual({ href: "/fulfillment", label: "Fulfillment" });
    expect(backLinkFor("/inventory/change-locations?kind=packages")).toEqual({ href: "/inventory", label: "Inventory" });
    expect(backLinkFor("/inventory/metrc")).toEqual({ href: "/inventory", label: "Inventory" });
    expect(backLinkFor("/marketplace/orders/abc")).toEqual({ href: "/marketplace?pane=orders", label: "Marketplace" });
    expect(backLinkFor("/compliance/audits")).toEqual({ href: "/compliance", label: "Compliance Console" });
    expect(backLinkFor("/compliance/labels/print")).toEqual({ href: "/compliance", label: "Compliance Console" });
    expect(backLinkFor("/purchasing/po/abc")).toEqual({ href: "/purchasing", label: "Purchasing" });
    expect(backLinkFor("/purchasing/suppliers")).toEqual({ href: "/purchasing", label: "Purchasing" });
    expect(backLinkFor("/reports")).toEqual({ href: "/", label: "Home" });
    expect(backLinkFor("/reports/inventory_by_location?format=csv")).toEqual({ href: "/reports", label: "Reports" });
    expect(backLinkFor("/log")).toEqual({ href: "/admin/settings", label: "Admin Settings" });
    expect(backLinkFor("/interco/arrivals/pnn")).toEqual({ href: "/ops/interco_logistics", label: "Logistics Operations" });
    expect(backLinkFor("/logistics/internal")).toEqual({ href: "/ops/interco_logistics", label: "Logistics Operations" });
  });

  it("Admin and its pages: Admin goes Home; its pages go to Admin; lookups, uploads and queues go to their landings", () => {
    expect(backLinkFor("/admin")).toEqual({ href: "/", label: "Home" });
    expect(backLinkFor("/admin/data-connections")).toEqual({ href: "/admin", label: "Admin" });
    expect(backLinkFor("/admin/settings")).toEqual({ href: "/admin", label: "Admin" });
    expect(backLinkFor("/admin/continuum10")).toEqual({ href: "/admin", label: "Admin" });
    expect(backLinkFor("/admin/queues")).toEqual({ href: "/admin/data-connections", label: "Data Connections" });
    expect(backLinkFor("/admin/uploads")).toEqual({ href: "/admin/data-connections", label: "Data Connections" });
    expect(backLinkFor("/admin/imports")).toEqual({ href: "/admin/data-connections", label: "Data Connections" });
    expect(backLinkFor("/admin/metrc-api")).toEqual({ href: "/admin/data-connections", label: "Data Connections" });
    expect(backLinkFor("/admin/lookups")).toEqual({ href: "/admin/settings", label: "Admin Settings" });
    expect(backLinkFor("/admin/manual-hbn")).toEqual({ href: "/admin/settings", label: "Admin Settings" });
    expect(backLinkFor("/admin/reconcile-location")).toEqual({ href: "/admin/settings", label: "Admin Settings" });
    expect(backLinkFor("/admin/lookups/dry_spaces")).toEqual({ href: "/admin/lookups", label: "Data Lookups" });
    expect(backLinkFor("/admin/uploads/wet_weights/abc.csv")).toEqual({ href: "/admin/uploads", label: "Pending Data Uploads" });
    expect(backLinkFor("/queue/dry_space_queue")).toEqual({ href: "/admin/queues", label: "Data Queues" });
    expect(backLinkFor(HARVEST_PATH)).toEqual({ href: "/", label: "Home" });
    expect(backLinkFor(MODELS_PATH)).toEqual({ href: "/", label: "Home" });
    expect(backLinkFor(`${MODELS_PATH}/harvest-menu-tool-2026/`)).toEqual({ href: MODELS_PATH, label: "Models" });
  });

  it("a record's pencil or void goes back where it came from, else to Data Queues", () => {
    const origin = "https://gripfactory-lite-grip.gflite.workers.dev";
    expect(refererPath(`${origin}/station/load_silo?pick=abc`, origin)).toBe("/station/load_silo?pick=abc");
    expect(refererPath(`${origin}/`, origin)).toBe("/");
    expect(refererPath("https://elsewhere.example/station/x", origin)).toBeNull();
    expect(refererPath(`${origin}/record/wip_packages/1/edit`, origin)).toBeNull();
    expect(refererPath("not a url", origin)).toBeNull();
    expect(refererPath(null, origin)).toBeNull();
    expect(backLinkFor("/record/wet_weight_entries/abc/edit", { referer: `${origin}/station/wet_weight?lot=abc`, origin })).toEqual({
      href: "/station/wet_weight?lot=abc",
      label: "Back",
    });
    expect(backLinkFor("/record/wet_weight_entries/abc/void", { referer: null, origin })).toEqual({ href: "/admin/queues", label: "Data Queues" });
    expect(backLinkFor("/record/wet_weight_entries/abc/void")).toEqual({ href: "/admin/queues", label: "Data Queues" });
  });

  it("an unplaced page goes Home rather than nowhere", () => {
    expect(backLinkFor("/somewhere/new")).toEqual({ href: "/", label: "Home" });
  });

  it("renders the crumb with the arrow and the menu's name, in both languages, and nothing for Home", () => {
    expect(backCrumb(null)).toBe("");
    const en = backCrumb({ href: "/ops/production_ops", label: "Production Operations" }, "en");
    expect(en).toBe(
      '<nav class="back-crumb" aria-label="Back"><a class="back-link" href="/ops/production_ops" data-back-link>&#8592; Production Operations</a></nav>'
    );
    const es = backCrumb({ href: "/admin/lookups", label: "Data Lookups" }, "es");
    expect(es).toContain('aria-label="Atras"');
    expect(es).toContain("&#8592; Consultas de datos");
    expect(backCrumb({ href: "/station/x?a=1&b=2", label: "Back" })).toContain('href="/station/x?a=1&amp;b=2"');
  });

  it("the layout carries the crumb first in main on a sub-page and none on Home", () => {
    const base = { title: "x", theme: "grip", personEmail: "a@b.c", body: "<h1>Body</h1>" };
    const sub = layout({ ...base, back: { href: "/ops/drying_ops", label: "Drying Operations" } });
    const mainAt = sub.indexOf("<main>");
    const crumbAt = sub.indexOf('<nav class="back-crumb"');
    expect(crumbAt).toBeGreaterThan(mainAt);
    expect(crumbAt).toBeLessThan(sub.indexOf("<h1>Body</h1>"));
    expect(sub).toContain('<a class="back-link" href="/ops/drying_ops" data-back-link>&#8592; Drying Operations</a>');
    // The inlined theme carries the .back-crumb rules on every page, so the
    // absence is pinned on the markup, not the word.
    const home = layout({ ...base, back: null });
    expect(home).not.toContain('<nav class="back-crumb"');
    const legacy = layout(base);
    expect(legacy).not.toContain('<nav class="back-crumb"');
  });
});
