import { describe, expect, it } from "vitest";
import {
  buildLiveSalesHelperMenu,
  decorateSalesHelperPage,
  salesHelperEasternTime,
  shClassify,
  shCollapseLines,
  shFifoCompare,
  SH_SECTION_ORDER,
  SH_UPDATE_HREF,
  zohoPriceNumber,
} from "../src/saleshelper";

const HEADER = `<!doctype html><html><head><meta charset="utf-8"><style>header{color:#fff}</style></head>
<body>
<header>
  <h1>GRIP CANNABIS · Sales Order</h1>
  <span class="meta">Menu built Aug 11, 2026, 1:58 PM ET · SalesHelper canon v0.7.3 · OCG Companies</span>
  <span id="freshness" class="stale ok"></span>
  <div id="mode-pill" role="group" aria-label="Display mode">
    <button id="mode-desktop" title="Desktop layout" aria-label="Desktop layout">D</button>
    <button id="mode-phone" title="Phone layout - big and clear" aria-label="Phone layout">P</button>
  </div>
</header>
<script id="menu-data" type="application/json">{"builtAt":"2026-08-11T17:58:11.229Z","lines":[]}</script>
</body></html>`;

/** The 0.8.0 form's header (canon 0.30.65): the time inside its own span, the build time a title. */
const HEADER_080 = HEADER.replace(
  '<span class="meta">Menu built Aug 11, 2026, 1:58 PM ET · SalesHelper canon v0.7.3 · OCG Companies</span>',
  '<span class="meta" title="Form built Sep 14, 2026, 11:51 AM ET">Inventory updated <span data-inventory-time>Sep 14, 2026, 11:27 AM ET</span> · SalesHelper canon v0.8.0 · OCG Companies</span>'
).replace('{"builtAt":"2026-08-11T17:58:11.229Z","lines":[]}', '{"builtAt":"2026-09-14T15:51:51.064Z","lines":[]}');

const BASE = JSON.stringify({
  builtAt: "2026-08-11T17:58:11.229Z",
  sourceFile: "Items_api_2026-08-06.csv",
  dataAsOf: "2026-08-06T00:00:00.000Z",
  canonVersion: "0.7.3",
  types: ["PRE", "BUD", "VAPE"],
  lines: [{ key: "PRE|old|O|18", type: "PRE", label: "Old", strain: "Old", farms: [], unit: "ea", available: 1, pkgs: [] }],
  customers: [{ name: "Placeholder Provisioning", license: "AU-R-000001" }],
  salespeople: ["Placeholder Rep"],
  lastPrice: { "*|BUD|donny burger|O|22": 150, "*|PRE|old|O|18": 10 },
  lastTypePrice: { "*|BUD": 150 },
  casePacks: { PRE: 80, MOB: 32 },
  originLicenses: [{ id: "AU-G-000832", label: "GRIP official" }],
  stats: { packages: 1510, menuLines: 583, excluded: 37 },
});

const ITEMS = [
  { itemId: "110", name: "BUD - Donny Burger - PNS - O - 22.1%", sku: "1A40503000311FB000028139", stock: 0.25, rate: 180 },
  { itemId: "101", name: "BUD - Donny Burger - PNS - O - 22.1%", sku: "1A40503000311FB000028138", stock: 0.5 },
  { itemId: "111", name: "BUD - Donny Burger - ARL - O - 22.9%", sku: "1A40503000311FB000028140", stock: 1, rate: 175 },
  { itemId: "102", name: "PRE - Applescotti - PNN - O - 20.77%", sku: "1A40503000311FB000051831", stock: 80, rate: 12.5 },
  { itemId: "103", name: "MOB - Apple Jack - PNN - O - 25.42%", sku: "1A40503000311FB000052749", stock: 32 },
  { itemId: "105", name: "GRIP Vape - Berry Mojito - 2g", sku: "GRIP Vape - Berry Mojito - 2g", stock: 17650 },
  { itemId: "104", name: "IPR - Orange Crush 1.2g", sku: "Infused Pre-Rolls - Orange Crush 1.2g", stock: 712 },
  { itemId: "106", name: "Bow House Distillate - 83.625%", sku: "1A40503000308F5000047817", stock: 94.601 },
  { itemId: "107", name: "MIX - Empty - PNN - O - 21%", sku: "1A40503000311FB000000108", stock: 0 },
  { itemId: "109", name: "Bud - Placeholder", sku: "2", stock: 1000000000008 },
];

describe("THE SALESHELPER LIVE MENU (canon 0.30.47): the SalesHelper's rules, ported", () => {
  it("classifies by the item name exactly as the SalesHelper does", () => {
    const pre = shClassify({ itemId: "1", name: "PRE - Fruity Pebbles - PNS - O - 19.93%", sku: "1A40503000311FB000036721", stock: 80 });
    expect(pre).toMatchObject({ cls: "convention", type: "PRE", strain: "Fruity Pebbles", farm: "PNS", grow: "O", thc: 19.93, thcInt: 19, lineKey: "PRE|fruity pebbles|O|19" });
    const vape = shClassify({ itemId: "2", name: "GRIP Vape - Berry Mojito - 2g", sku: "x", stock: 5 });
    expect(vape).toMatchObject({ cls: "vape", type: "VAPE", strain: "Berry Mojito - 2g", lineKey: "VAPE|berrymojito2g" });
    const ipr = shClassify({ itemId: "3", name: "IPR - Orange Crush 1.2g", sku: "x", stock: 5 });
    expect(ipr).toMatchObject({ cls: "ipr", type: "IPR", strain: "Orange Crush 1.2g", lineKey: "IPR|orangecrush12g" });
    expect(shClassify({ itemId: "4", name: "Bow House Distillate - 83.625%", sku: "x", stock: 1 })).toMatchObject({
      cls: "excluded",
      excludeReason: "name has 2 segment(s), need TYPE - Strain - FARM - GROW - THC",
    });
    expect(shClassify({ itemId: "5", name: "OIL - A - PNN - O - 20%", sku: "x", stock: 1 }).excludeReason).toBe('unknown type "OIL"');
    expect(shClassify({ itemId: "6", name: "BUD - A - PNN - O - n/a", sku: "x", stock: 1 }).excludeReason).toBe('unreadable THC "n/a"');
    expect(shClassify({ itemId: "7", name: "BUD - A - PNN - O - 20%", sku: "x", stock: 0 }).excludeReason).toBe("no stock");
    expect(shClassify({ itemId: "8", name: "Bud - Placeholder", sku: "2", stock: 1e12 }).excludeReason).toBe("placeholder/test item");
    expect(shClassify({ itemId: "9", name: "Konopie test", sku: "x", stock: 1 }).excludeReason).toBe("placeholder/test item");
  });

  it("orders FIFO: METRC tags ascending first, then item ids", () => {
    const rows = [
      { sku: "abc", itemId: "20" },
      { sku: "1A40503000311FB000028139", itemId: "1" },
      { sku: "1A40503000311FB000028138", itemId: "2" },
      { sku: "", itemId: "3" },
    ];
    expect([...rows].sort(shFifoCompare).map((r) => r.itemId)).toEqual(["2", "1", "3", "20"]);
  });

  it("collapses lines by TYPE, strain, GROW and floor(THC), farms merged, sections in the canon order", () => {
    const lines = shCollapseLines(ITEMS.map(shClassify).filter((p) => p.cls !== "excluded"));
    expect(lines.map((l) => l.key)).toEqual(["PRE|applescotti|O|20", "BUD|donny burger|O|22", "MOB|apple jack|O|25", "VAPE|berrymojito2g", "IPR|orangecrush12g"]);
    const bud = lines[1];
    expect(bud).toMatchObject({ type: "BUD", label: "Donny Burger · Outdoor", strain: "Donny Burger", grow: "O", thcInt: 22, farms: ["ARL", "PNS"], thcMin: 22.1, thcMax: 22.9, unit: "wt", available: 1.75 });
    expect(bud.pkgs.map((p) => p.itemId)).toEqual(["101", "110", "111"]);
    // canon 0.30.65 (SalesHelper canon 6): the line's Zoho price is the FIFO-first
    // package's rate, else the first package carrying one; packages keep their own.
    expect(bud.price).toBe(180);
    expect(bud.pkgs.map((p) => p.rate)).toEqual([undefined, 180, 175]);
    expect(lines[0]).toMatchObject({ unit: "ea", available: 80, farms: ["PNN"], price: 12.5 });
    expect(lines[2].price).toBeUndefined();
    expect(lines[3]).toMatchObject({ type: "VAPE", label: "Berry Mojito - 2g", unit: "ea", available: 17650, farms: [] });
    expect(SH_SECTION_ORDER).toEqual(["PRE", "BUD", "MIX", "SHA", "MOB", "NUG", "TRI", "WBP", "VAPE", "IPR"]);
  });

  it("re-lines the static base from the mount, builtAt first, the base's prices and people carried", () => {
    const live = buildLiveSalesHelperMenu(BASE, ITEMS, { created_at: "2026-09-12T16:04:35.564Z", filename: "Item.csv" });
    expect(live).not.toBeNull();
    expect(live!.text.startsWith('{"builtAt":"2026-09-12T16:04:35.564Z"')).toBe(true);
    expect(live).toMatchObject({ lines: 5, packages: 7, excluded: 1, builtAt: "2026-09-12T16:04:35.564Z" });
    const menu = JSON.parse(live!.text) as Record<string, unknown>;
    expect(menu.dataAsOf).toBe("2026-09-12T16:04:35.564Z");
    expect((menu.lines as Array<{ key: string; price?: number }>).find((l) => l.key === "BUD|donny burger|O|22")?.price).toBe(180);
    expect(menu.sourceFile).toBe("zoho mount Item.csv (gripfactory lite)");
    expect(menu.baseBuiltAt).toBe("2026-08-11T17:58:11.229Z");
    expect(menu.canonVersion).toBe("0.7.3");
    expect(menu.types).toEqual(["PRE", "BUD", "MOB", "VAPE", "IPR"]);
    expect(menu.stats).toEqual({ packages: 7, menuLines: 5, excluded: 1 });
    expect(menu.customers).toEqual([{ name: "Placeholder Provisioning", license: "AU-R-000001" }]);
    expect(menu.salespeople).toEqual(["Placeholder Rep"]);
    expect(menu.lastPrice).toEqual({ "*|BUD|donny burger|O|22": 150, "*|PRE|old|O|18": 10 });
    expect(menu.casePacks).toEqual({ PRE: 80, MOB: 32 });
    expect(menu.originLicenses).toEqual([{ id: "AU-G-000832", label: "GRIP official" }]);
    expect((menu.lines as Array<{ key: string }>).map((l) => l.key)).toContain("BUD|donny burger|O|22");
    expect((menu.lines as Array<{ key: string }>).map((l) => l.key)).not.toContain("PRE|old|O|18");
    // canon 0.30.65: a static built AFTER the mount keeps its own builtAt (the
    // form adopts a live menu only when builtAt is not older than its snapshot),
    // while dataAsOf stays the drop: the badge and header read data age.
    const newer = JSON.parse(BASE) as Record<string, unknown>;
    newer.builtAt = "2026-09-14T15:51:51.064Z";
    const liveOld = buildLiveSalesHelperMenu(JSON.stringify(newer), ITEMS, { created_at: "2026-09-14T12:31:38.905Z", filename: "Item 3.csv" });
    expect(liveOld!.text.startsWith('{"builtAt":"2026-09-14T15:51:51.064Z","sourceFile":"zoho mount Item 3.csv (gripfactory lite)","dataAsOf":"2026-09-14T12:31:38.905Z"')).toBe(true);
    expect(liveOld!.builtAt).toBe("2026-09-14T15:51:51.064Z");
    // Not a canonical menu: the caller keeps the static.
    expect(buildLiveSalesHelperMenu("not json", ITEMS, { created_at: "2026-09-12T16:04:35.564Z", filename: "x" })).toBeNull();
    expect(buildLiveSalesHelperMenu('{"lines":[]}', ITEMS, { created_at: "2026-09-12T16:04:35.564Z", filename: "x" })).toBeNull();
  });
});

describe("THE SALESHELPER HEADER (canon 0.30.47): the served page", () => {
  it("writes the mount's time as the SalesHelper writes its build time, in Eastern time", () => {
    expect(salesHelperEasternTime("2026-09-12T16:04:35.564Z")).toBe("Sep 12, 2026, 12:04 PM ET");
    expect(salesHelperEasternTime("2026-01-15T03:30:00.000Z")).toBe("Jan 14, 2026, 10:30 PM ET");
    expect(salesHelperEasternTime("nonsense")).toBe("nonsense");
  });

  it("hides the pill, rolls the date to the mount and adds the Update link beside it", () => {
    const html = decorateSalesHelperPage(HEADER, { created_at: "2026-09-12T16:04:35.564Z" });
    expect(html).toContain("#mode-pill{display:none !important}");
    // canon 0.30.49: the framed form's own scrollbar drawn wider.
    expect(html).toContain("::-webkit-scrollbar{width:16px;height:16px}");
    expect(html).toContain("html{scrollbar-width:auto;scrollbar-color:#5f7a66 #e6ebe7}");
    expect(html).toContain('<span class="meta">Inventory updated Sep 12, 2026, 12:04 PM ET · SalesHelper canon v0.7.3 · OCG Companies</span>');
    expect(html).not.toContain("Menu built");
    expect(html).toContain(`<a class="gf-update" data-gf-update href="${SH_UPDATE_HREF}" target="_top"`);
    expect(SH_UPDATE_HREF).toBe("/marketplace?pane=zoho");
    // The link sits right after the date, before the freshness badge; the
    // pill's buttons stay in the DOM for the form's own script.
    const meta = html.indexOf("</span>\n  <a class=\"gf-update\"");
    expect(meta).toBeGreaterThan(0);
    expect(html.indexOf('data-gf-update')).toBeLessThan(html.indexOf('id="freshness"'));
    expect(html).toContain('id="mode-desktop"');
    expect(html).toContain('id="mode-phone"');
    // The embedded snapshot is untouched.
    expect(html).toContain('{"builtAt":"2026-08-11T17:58:11.229Z","lines":[]}');
    expect((html.match(/data-gf-update/g) || []).length).toBe(1);
  });

  it("rolls the 0.8.0 header's inventory-time span to the mount and lands the link after the whole meta span", () => {
    const html = decorateSalesHelperPage(HEADER_080, { created_at: "2026-09-14T20:10:00.000Z" });
    expect(html).toContain(
      '<span class="meta" title="Form built Sep 14, 2026, 11:51 AM ET">Inventory updated <span data-inventory-time>Sep 14, 2026, 4:10 PM ET</span> · SalesHelper canon v0.8.0 · OCG Companies</span>\n  <a class="gf-update"'
    );
    expect(html).not.toContain("11:27 AM ET");
    expect((html.match(/data-gf-update/g) || []).length).toBe(1);
    expect(html.indexOf("data-gf-update")).toBeLessThan(html.indexOf('id="freshness"'));
    // Without a mount the baked drop time stands and the link still lands after the outer span.
    const plain = decorateSalesHelperPage(HEADER_080, null);
    expect(plain).toContain('<span data-inventory-time>Sep 14, 2026, 11:27 AM ET</span> · SalesHelper canon v0.8.0 · OCG Companies</span>\n  <a class="gf-update"');
    expect((plain.match(/data-gf-update/g) || []).length).toBe(1);
  });

  it("reads a Zoho price cell as a number", () => {
    expect(zohoPriceNumber("USD 175.00")).toBe(175);
    expect(zohoPriceNumber("12.5")).toBe(12.5);
    expect(zohoPriceNumber("USD 1,250.00")).toBe(1250);
    expect(zohoPriceNumber("")).toBeNull();
    expect(zohoPriceNumber(null)).toBeNull();
    expect(zohoPriceNumber("USD 0.00")).toBeNull();
    expect(zohoPriceNumber("n/a")).toBeNull();
  });

  it("without a mount keeps the build date and still offers the Update link", () => {
    const html = decorateSalesHelperPage(HEADER, null);
    expect(html).toContain("Menu built Aug 11, 2026, 1:58 PM ET");
    expect(html).not.toContain("Inventory updated");
    expect(html).toContain("data-gf-update");
    expect(html).toContain("#mode-pill{display:none !important}");
  });
});
