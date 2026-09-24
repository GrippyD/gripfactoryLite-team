/**
 * THE SALESHELPER LIVE MENU AND HEADER (canon 0.30.47). Owner, 2026-09-12,
 * with a screenshot of the framed form's header bar: "Remove cell/monitor pill
 * add button next to the last update date [update] that redirects to the zoho
 * upload screen.  We just updated so the inventory should be on screen and the
 * date should roll.  Check and see what's happening".
 *
 * What was happening: the vendored form fetches menu.json beside itself and
 * this Worker served the vendored static (the 2026-08-11 build), so the Zoho
 * mount on the Marketplace never reached the form; its "Menu built" date is
 * baked into the HTML at the SalesHelper's own build time and its badge reads
 * the static's dataAsOf. Two fixes, both at serve time, the vendored bytes
 * untouched on disk (the vendored-pair law):
 *
 * 1. menu.json is built from the newest Zoho mount: the mounted, listed items
 *    run through the SalesHelper's own classify and collapse rules (ported
 *    here from its src/lib, canon SalesHelper 3 to 5), the lines and types
 *    replace the static's, builtAt and dataAsOf read the mount's time (the
 *    form swaps in a menu whose builtAt is newer than its embedded snapshot
 *    and its badge reads the data age), and the static's customers,
 *    salespeople, prices, case packs and origin licenses carry over (they come
 *    from sales history, which has no lane here yet). No mount: the static
 *    serves as before.
 * 2. The served page's header: the desktop/phone pill is hidden (the form's
 *    script still finds the buttons, so nothing breaks), the "Menu built"
 *    words become "Inventory updated <the mount's time, ET>" when a mount
 *    exists, and an [Update] link beside the date sends the whole window to
 *    the Marketplace's Zoho pane, where the export is dropped.
 *
 * THE SALESHELPER BATCH (canon 0.30.65, SalesHelper canon 0.8.0; owner rulings
 * 2026-09-14): the re-vendored form carries the netting toggle, the Zoho price
 * on every line and the header "Inventory updated <ET>" off dataAsOf. Here:
 * the live menu carries each line's Zoho price (the listing's Selling Price,
 * SalesHelper canon 6); builtAt is the later of the static's build and the
 * mount (the form adopts a live menu only when builtAt is not older than its
 * snapshot, so a re-vendor after a drop must not hide the drop) while dataAsOf
 * stays the drop time (owner: "The date and time for when inventory was
 * updated should be on the last user deployment of a Zoho csv/xlsx, not when
 * it last autoran"); the decoration accepts both header shapes.
 */

import type { ZohoMountRow } from "./zohoinv";

/* ------------------------------------- the SalesHelper's rules, ported */

/** SalesHelper canon 3: the convention types, in menu order. */
export const SH_CONVENTION_TYPES = ["PRE", "BUD", "MIX", "SHA", "MOB", "NUG", "TRI", "WBP"] as const;
/** Types sold in whole units; everything else allows decimal (weight) qty. */
export const SH_UNIT_TYPES = new Set(["PRE", "MOB", "VAPE", "IPR"]);
export const SH_GROW_LABEL: Record<string, string> = { O: "Outdoor", I: "Indoor", G: "Greenhouse" };
/** Menu section order: convention types, then vapes, then IPR. */
export const SH_SECTION_ORDER: string[] = [...SH_CONVENTION_TYPES, "VAPE", "IPR"];

/** rate: the Zoho selling price per native unit (SalesHelper canon 6, v0.8.0), when known. */
export type ShRawItem = { itemId: string; name: string; sku: string; stock: number; rate?: number };

export type ShParsedItem = ShRawItem & {
  cls: "convention" | "vape" | "ipr" | "excluded";
  excludeReason?: string;
  type?: string;
  strain?: string;
  farm?: string;
  grow?: string;
  thc?: number;
  thcInt?: number;
  lineKey?: string;
};

export type ShPkg = { sku: string; itemId: string; name: string; stock: number; thc?: number; farm?: string; rate?: number };

export type ShMenuLine = {
  key: string;
  type: string;
  label: string;
  strain: string;
  grow?: string;
  thcInt?: number;
  farms: string[];
  thcMin?: number;
  thcMax?: number;
  unit: "ea" | "wt";
  available: number;
  pkgs: ShPkg[];
  /** The Zoho selling price of the FIFO-first package, native UOM (SalesHelper canon 6, v0.8.0). */
  price?: number;
};

/** A Zoho price cell as the export writes it ("USD 175.00", "175", "1,250.00") as a number; null when blank or unreadable. */
export function zohoPriceNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const shIsMetrc = (sku: string): boolean => /^1A[0-9A-F]{22}$/i.test(sku);

/** SalesHelper canon 3 and 4: one Zoho item classified by its name. */
export function shClassify(it: ShRawItem): ShParsedItem {
  const out: ShParsedItem = { ...it, cls: "excluded" };
  if (it.stock <= 0) {
    out.excludeReason = "no stock";
    return out;
  }
  if (it.stock >= 1e8 || /konopie/i.test(it.name)) {
    out.excludeReason = "placeholder/test item";
    return out;
  }
  const segs = it.name.split(" - ").map((s) => s.trim());
  const first = (segs[0] ?? "").toUpperCase();
  if (first === "GRIP VAPE") {
    out.cls = "vape";
    out.type = "VAPE";
    out.strain = segs.slice(1).join(" - ").replace(/\s+/g, " ").trim() || it.name;
    out.lineKey = `VAPE|${out.strain.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
    return out;
  }
  if (first === "IPR") {
    out.cls = "ipr";
    out.type = "IPR";
    out.strain = segs.slice(1).join(" - ").trim() || it.name;
    out.lineKey = `IPR|${out.strain.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
    return out;
  }
  if (segs.length === 5 && (SH_CONVENTION_TYPES as readonly string[]).includes(first)) {
    const thc = Number(segs[4].replace(/[%\s]/g, ""));
    if (!Number.isFinite(thc)) {
      out.excludeReason = `unreadable THC "${segs[4]}"`;
      return out;
    }
    out.cls = "convention";
    out.type = first;
    out.strain = segs[1];
    out.farm = segs[2].toUpperCase();
    out.grow = segs[3].toUpperCase();
    out.thc = thc;
    out.thcInt = Math.floor(thc);
    // canon 4: TYPE + Strain + GROW + floor(THC). Farms merge.
    out.lineKey = `${first}|${segs[1].toLowerCase()}|${out.grow}|${out.thcInt}`;
    return out;
  }
  out.excludeReason =
    segs.length !== 5 ? `name has ${segs.length} segment(s), need TYPE - Strain - FARM - GROW - THC` : `unknown type "${first}"`;
  return out;
}

/** SalesHelper canon 5, the FIFO sort key: METRC tags ascending, else item id ascending, METRC first. */
export function shFifoCompare(a: { sku: string; itemId: string }, b: { sku: string; itemId: string }): number {
  const am = shIsMetrc(a.sku);
  const bm = shIsMetrc(b.sku);
  if (am && bm) {
    const au = a.sku.toUpperCase();
    const bu = b.sku.toUpperCase();
    return au < bu ? -1 : au > bu ? 1 : 0;
  }
  if (am !== bm) return am ? -1 : 1;
  if (a.itemId.length !== b.itemId.length) return a.itemId.length - b.itemId.length;
  return a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0;
}

/** SalesHelper canon 4 and 5: classified in-stock items collapsed into sorted menu lines. */
export function shCollapseLines(included: ShParsedItem[]): ShMenuLine[] {
  const byKey = new Map<string, ShParsedItem[]>();
  for (const p of included) {
    const arr = byKey.get(p.lineKey!) ?? [];
    arr.push(p);
    byKey.set(p.lineKey!, arr);
  }
  const lines: ShMenuLine[] = [];
  for (const [key, items] of byKey) {
    items.sort(shFifoCompare);
    const f = items[0];
    const thcs = items.map((i) => i.thc).filter((v): v is number => v != null);
    const label = f.cls === "convention" ? `${f.strain} · ${SH_GROW_LABEL[f.grow!] ?? f.grow}` : f.strain!;
    lines.push({
      key,
      type: f.type!,
      label,
      strain: f.strain!,
      grow: f.grow,
      thcInt: f.thcInt,
      farms: [...new Set(items.map((i) => i.farm).filter((x): x is string => !!x))].sort(),
      thcMin: thcs.length ? Math.min(...thcs) : undefined,
      thcMax: thcs.length ? Math.max(...thcs) : undefined,
      unit: SH_UNIT_TYPES.has(f.type!) ? "ea" : "wt",
      available: items.reduce((s, i) => s + i.stock, 0),
      pkgs: items.map((i) => ({ sku: i.sku, itemId: i.itemId, name: i.name, stock: i.stock, thc: i.thc, farm: i.farm, ...(i.rate ? { rate: i.rate } : {}) })),
      // SalesHelper canon 6 (v0.8.0): the line's price is the FIFO-first package's rate
      // (the package an order drains first), else the first package that carries one.
      ...((): { price?: number } => {
        const first = f.rate && f.rate > 0 ? f.rate : items.find((i) => i.rate && i.rate > 0)?.rate;
        return first ? { price: first } : {};
      })(),
    });
  }
  lines.sort((a, b) => {
    const t = SH_SECTION_ORDER.indexOf(a.type) - SH_SECTION_ORDER.indexOf(b.type);
    if (t) return t;
    if (a.thcInt != null && b.thcInt != null && a.thcInt !== b.thcInt) return a.thcInt - b.thcInt;
    return a.label.localeCompare(b.label);
  });
  return lines;
}

/* ------------------------------------------------- the live menu.json */

export type ShLiveMenuResult = {
  text: string;
  lines: number;
  packages: number;
  excluded: number;
  builtAt: string;
};

/** The static menu.json (the base: prices, customers, licenses) re-lined from
 * the mount's items. Null when the base is not a canonical menu (then the
 * caller serves the static as it came). builtAt stays the FIRST key: the
 * SalesHelper's own serving law sniffs it from the head bytes. */
export function buildLiveSalesHelperMenu(
  baseText: string,
  items: readonly ShRawItem[],
  mount: Pick<ZohoMountRow, "created_at" | "filename">
): ShLiveMenuResult | null {
  let base: Record<string, unknown>;
  try {
    base = JSON.parse(baseText) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!base || typeof base !== "object" || !Array.isArray(base.lines) || typeof base.lastPrice !== "object" || base.lastPrice == null) {
    return null;
  }
  const parsed = items.map(shClassify);
  const included = parsed.filter((p) => p.cls !== "excluded");
  const excluded = parsed.filter(
    (p) => p.cls === "excluded" && p.excludeReason !== "no stock" && p.excludeReason !== "placeholder/test item"
  ).length;
  const lines = shCollapseLines(included);
  // builtAt: the later of the static's build and the mount (canon 0.30.65). The
  // form takes a live menu only when its builtAt is not older than the embedded
  // snapshot's, so a form re-vendored after the drop would otherwise ignore it.
  // dataAsOf stays the drop: the badge and the header read data age, not build age.
  const baseBuilt = typeof base.builtAt === "string" ? new Date(base.builtAt).getTime() : NaN;
  const mountAt = new Date(mount.created_at).getTime();
  const builtAt = Number.isFinite(baseBuilt) && Number.isFinite(mountAt) && baseBuilt > mountAt ? (base.builtAt as string) : mount.created_at;
  // The base's own build keys are replaced; everything else (canonVersion,
  // customers, salespeople, lastPrice, lastTypePrice, casePacks,
  // originLicenses) carries over in the base's own order.
  const replaced = new Set(["builtAt", "sourceFile", "dataAsOf", "types", "lines", "stats", "baseBuiltAt"]);
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(base)) if (!replaced.has(k)) rest[k] = v;
  const menu = {
    builtAt,
    sourceFile: `zoho mount ${mount.filename} (gripfactory lite)`,
    dataAsOf: mount.created_at,
    ...rest,
    baseBuiltAt: typeof base.builtAt === "string" ? base.builtAt : undefined,
    types: SH_SECTION_ORDER.filter((t) => lines.some((l) => l.type === t)),
    lines,
    stats: { packages: included.length, menuLines: lines.length, excluded },
  };
  return { text: JSON.stringify(menu), lines: lines.length, packages: included.length, excluded, builtAt };
}

/* ------------------------------------------------ the served header */

/** The mount's time as the SalesHelper writes its build time: "Sep 12, 2026, 12:10 PM ET". */
export function salesHelperEasternTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return `${d.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET`;
}

export const SH_UPDATE_HREF = "/marketplace?pane=zoho";

const SH_HEADER_STYLE = `<style data-gf-saleshelper-header>
#mode-pill{display:none !important}
.gf-update{margin-left:6px;align-self:center;background:#fff;color:#1f4d2b;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;text-decoration:none;line-height:1.2;white-space:nowrap}
.gf-update:hover{background:#e9f2ea}
/* canon 0.30.49: the framed form's own scrollbar, wide enough to find */
html{scrollbar-width:auto;scrollbar-color:#5f7a66 #e6ebe7}
::-webkit-scrollbar{width:16px;height:16px}
::-webkit-scrollbar-track{background:#e6ebe7}
::-webkit-scrollbar-thumb{background:#5f7a66;border-radius:8px;border:3px solid #e6ebe7;min-height:48px}
::-webkit-scrollbar-thumb:hover{background:#3f5a46}
</style>`;

/** Serve-time decoration of the vendored page: the pill hidden, the date
 * rolled to the mount's time, the [Update] link beside it. Every replacement
 * uses a callback so no dollar pattern could expand; a re-vendored page whose
 * header moved simply keeps its own words (the tests pin the current shape). */
export function decorateSalesHelperPage(page: string, mount: Pick<ZohoMountRow, "created_at"> | null): string {
  let out = page.replace("</head>", () => `${SH_HEADER_STYLE}</head>`);
  if (mount) {
    const when = salesHelperEasternTime(mount.created_at);
    // Two header shapes: the 0.7.3 form's "Menu built <ET> ·" and the 0.8.0
    // form's "Inventory updated <span data-inventory-time>...</span> ·" (whose
    // own script rolls the same words once it adopts the live menu).
    out = out.replace(
      /(<span class="meta"[^>]*>)Inventory updated <span data-inventory-time>[^<]*<\/span> ·/,
      (_m, open: string) => `${open}Inventory updated <span data-inventory-time>${when}</span> ·`
    );
    out = out.replace(/(<span class="meta"[^>]*>)Menu built [^<·]*·/, (_m, open: string) => `${open}Inventory updated ${when} ·`);
  }
  const link = `<a class="gf-update" data-gf-update href="${SH_UPDATE_HREF}" target="_top" title="Drop a new Zoho Items export on the Marketplace">Update</a>`;
  // The meta span may nest the inventory-time span: the link lands after the outer one.
  out = out.replace(/(<span class="meta"[^>]*>(?:[^<]|<span[^>]*>[^<]*<\/span>)*?<\/span>)/, (_m, meta: string) => `${meta}\n  ${link}`);
  return out;
}

/* ------------------------------------------------ the fitted frame */

/** THE SALESHELPER PANE SCROLLBARS (canon 0.30.49). Owner: "move the right
 * anchor in slightly and increase the size of the working pane's vertical
 * scroll bar, it's getting hidden behind the primary scrollbar". The frame is
 * sized to what is left of the viewport under whatever sits above it, less
 * what the page keeps below it (the main's bottom padding for the fixed
 * buttons), so the page itself has nothing to scroll and its scrollbar steps
 * aside; the embed also stops short of the right edge (the themes), and the
 * framed form's own scrollbar is drawn wider (the served header style). Without
 * the script the CSS height stands. Floor 480px: a short window scrolls the
 * page rather than crushing the form. */
export function salesHelperFitScript(selector: string): string {
  return `<script>(function(){
  var frame = document.querySelector(${JSON.stringify(selector)});
  if (!frame) return;
  function fit() {
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var rect = frame.getBoundingClientRect();
    var top = rect.top + scrollY;
    var doc = document.scrollingElement || document.documentElement;
    var below = Math.max(0, doc.scrollHeight - (rect.bottom + scrollY));
    var room = window.innerHeight - top - below;
    frame.style.height = Math.max(480, Math.floor(room)) + "px";
  }
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("load", fit);
})();</script>`;
}
