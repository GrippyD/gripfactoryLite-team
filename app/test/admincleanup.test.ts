import { describe, expect, it } from "vitest";
import { ADMIN_GROUPS, adminGroupPage, adminHomePage, appBarActions, layout } from "../src/html";
import { backLinkFor } from "../src/nav";
import { themeStylesheet } from "../src/theme";

const REMOVED = ["Testing Override", "Environment", "Sheet sync", "Testing desk"];

describe("Admin cleanup (canon 0.30.418)", () => {
  it("Admin shows the four buttons in order, and each group lists today's URLs", () => {
    const home = adminHomePage("en");
    const titles = [...home.matchAll(/tile-title">([^<]+)/g)].map((hit) => hit[1]);
    // DD S1: the Director Dashboard button joins the three (its own test covers its tiles).
    expect(titles).toEqual(["Data Connections", "Admin Settings", "Continuum10", "Director Dashboard"]);
    expect(home).toContain('href="/admin/data-connections"');
    expect(home).toContain('href="/admin/settings"');
    expect(home).toContain('href="/admin/continuum10"');
    expect(home).toContain('href="/admin/director"');
    for (const title of REMOVED) expect(home).not.toContain(title);
    const connections = adminGroupPage("data-connections");
    // MA1 Law 8 (Phase E1): the Metrc evaluation tile sits beside the Metrc API tile.
    expect([...connections.matchAll(/href="([^"]+)"/g)].map((hit) => hit[1])).toEqual([
      "/admin/queues",
      "/admin/uploads",
      "/admin/imports",
      "/admin/metrc-api",
      "/admin/metrc-eval",
    ]);
    const settings = adminGroupPage("settings");
    expect([...settings.matchAll(/href="([^"]+)"/g)].map((hit) => hit[1])).toEqual([
      "/admin/lookups",
      "/admin/field_estimates",
      "/log",
      "/admin/manual-hbn",
      "/admin/reconcile-location",
    ]);
    const continuum = adminGroupPage("continuum10");
    expect([...continuum.matchAll(/href="([^"]+)"/g)].map((hit) => hit[1])).toEqual([
      "/vendors-equipment",
      "/erp-software",
      "/compliance-testing",
      "/harvest-console",
    ]);
    const allAdmin = [home, connections, settings, continuum].join("\n");
    for (const title of REMOVED) expect(allAdmin).not.toContain(title);
    expect(adminHomePage("es")).toContain("Conexiones de datos");
    expect(adminHomePage("es")).toContain("Ajustes de administracion");
    expect(ADMIN_GROUPS.map((group) => group.href)).toEqual([
      "/admin/data-connections",
      "/admin/settings",
      "/admin/continuum10",
      "/admin/director",
    ]);
  });

  it("the bar reads Models, Harvest Console, Maintenance, Reports, Admin, and the back links follow the groups", () => {
    const bar = appBarActions("en");
    const hrefs = [...bar.matchAll(/href="([^"]+)"/g)].map((hit) => hit[1]);
    expect(hrefs).toEqual(["/models", "/harvest", "/maintenance", "/reports", "/admin"]);
    expect(backLinkFor("/admin/queues")).toEqual({ href: "/admin/data-connections", label: "Data Connections" });
    expect(backLinkFor("/admin/uploads")).toEqual({ href: "/admin/data-connections", label: "Data Connections" });
    expect(backLinkFor("/admin/imports")).toEqual({ href: "/admin/data-connections", label: "Data Connections" });
    expect(backLinkFor("/admin/metrc-api")).toEqual({ href: "/admin/data-connections", label: "Data Connections" });
    expect(backLinkFor("/admin/lookups")).toEqual({ href: "/admin/settings", label: "Admin Settings" });
    expect(backLinkFor("/admin/field_estimates")).toEqual({ href: "/admin/settings", label: "Admin Settings" });
    expect(backLinkFor("/log")).toEqual({ href: "/admin/settings", label: "Admin Settings" });
    expect(backLinkFor("/admin/manual-hbn")).toEqual({ href: "/admin/settings", label: "Admin Settings" });
    expect(backLinkFor("/admin/reconcile-location")).toEqual({ href: "/admin/settings", label: "Admin Settings" });
    expect(backLinkFor("/admin/data-connections")).toEqual({ href: "/admin", label: "Admin" });
    expect(backLinkFor("/admin/settings")).toEqual({ href: "/admin", label: "Admin" });
    expect(backLinkFor("/admin/continuum10")).toEqual({ href: "/admin", label: "Admin" });
    expect(backLinkFor("/harvest")).toEqual({ href: "/", label: "Home" });
    expect(backLinkFor("/models")).toEqual({ href: "/", label: "Home" });
    expect(backLinkFor("/vendors-equipment")).toEqual({ href: "/", label: "Home" });
  });

  it("on a phone the bar wraps inside the screen, in every view", () => {
    const html = layout({ title: "Home", theme: "grip", personEmail: "dev@local", body: "<p>Hi</p>", device: "phone" });
    expect(html).toContain('class="device-phone"');
    expect(html.indexOf('href="/models"')).toBeLessThan(html.indexOf('href="/harvest"'));
    for (const view of ["lite", "co", "cerberus"] as const) {
      const css = themeStylesheet(view);
      expect(css).toContain("body.device-phone .bar-actions { flex: 1 1 100%; flex-wrap: wrap; margin-left: 0; max-width: 100%; }");
    }
  });
});
