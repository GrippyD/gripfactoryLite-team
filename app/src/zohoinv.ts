/**
 * Mount Zoho Inventory (canon 0.30.36). Owner question 2026-09-09: "Is there a
 * place in the app that I can drop current Zoho inventory and it will update
 * the offerings on the marketplace?" There was not; this is it. His four
 * answers, verbatim, shape the lane:
 *
 *   1. "attached" (the Zoho Inventory Items export, 68 columns, Item 2.csv)
 *   2. "If zoho is using  each, it's weight, if it's oz or g, show that as
 *      "market-facing UOM" and actual weight in grams - Lbs = 448 grams"
 *   3. "Zoho should show a SKU, that's usually the METRC package ID"
 *   4. "Not sure what you mean, picking and shipping will remove it.  Dropping
 *      a new inventory should correct it"
 *
 * So: the export is the truth of what is offered. Every Active item with stock
 * on hand becomes (or updates) a Zoho-sourced listing keyed by its SKU; the
 * market-facing UOM is what Zoho sells it in (lb, oz, g, each, L) and the
 * actual weight in grams rides beside it (lb = 448 g, oz = 28 g, each = the
 * size in the item's name or the category's known size); a Zoho listing gone
 * from the newer export unlists; hand-entered listings are never touched.
 * Nothing writes back to Zoho.
 */

import { HttpError, nowIso } from "./audit";
import { zohoPriceNumber } from "./saleshelper";
import { csvObjects } from "./csv";
import { insertLog, requireActor } from "./db";
import { GRAMS_PER_LB, METRC_TAG_RE, roundGrams, SYSTEM_REASON } from "./config";
import type { ActionOk } from "./actions";

/* ------------------------------------------------------------ constants */

/** Re-export of GRAMS_PER_LB (canon 0.30.164): the trade's pound, 16 oz at 28 g. */
export const ZOHO_GRAMS_PER_LB = GRAMS_PER_LB;
export const ZOHO_GRAMS_PER_OZ = 28;

export const MARKET_UOMS = ["lb", "oz", "g", "each", "L"] as const;
export type MarketUom = (typeof MARKET_UOMS)[number];

/** Category sizes for each-sold items whose names carry no size: a Prepack
 * Ounce is an ounce; a Max Out Bag is the 2.5 oz purchase limit (its price
 * in the export is exactly 2.5 times the ounce prepack's). Anything else sold
 * by the each without a size in its name lists with its weight unknown. */
export const EACH_GRAMS_BY_SUB: Array<[RegExp, number]> = [
  [/prepack\s*ounce/i, ZOHO_GRAMS_PER_OZ],
  [/max\s*out\s*bag/i, 2.5 * ZOHO_GRAMS_PER_OZ],
];

/** Categories Zoho leaves unitless that are sold by the each. Everything else
 * unitless is bulk and sold by the pound (the export's Unit Name says Pounds
 * wherever it says anything). */
const EACH_SUBS = /prepack|max\s*out\s*bag|vape|cart|pre-?roll|infused/i;

/** A METRC package tag: 1A plus 22 hex characters. The owner: "Zoho should
 * show a SKU, that's usually the METRC package ID". Canon 0.30.38 moved the
 * shape to config.ts (THE TAG LAW); re-exported here for the Zoho readers. */
export { METRC_TAG_RE } from "./config";

/** Scribe default (canon 0.30.36): a stock on hand of a billion or more is a
 * placeholder, not inventory. The owner's export carries eight such catch-all
 * items at 1,000,000,000,000 units; offering them would print a trillion
 * pounds on the marketplace. They are counted and skipped, never blocked
 * silently: the mount summary says how many. One word changes the line. */
export const PLACEHOLDER_STOCK = 1_000_000_000;

/* ---------------------------------------------------------------- parse */

export type ZohoItem = {
  key: string;
  sku: string;
  zoho_item_id: string;
  item_name: string;
  category: string;
  market_uom: MarketUom;
  market_qty: number;
  each_grams: number | null;
  qty_grams: number | null;
  price: string | null;
  location: string | null;
  thc_pct: number | null;
  status: string;
  package_tag: string | null;
};

export type ZohoParseResult = {
  offered: ZohoItem[];
  rows_total: number;
  rows_inactive: number;
  rows_no_stock: number;
  rows_not_goods: number;
  rows_placeholder: number;
  by_category: Array<{ category: string; count: number; market: string }>;
};

/** Column lookup tolerant of spelling drift, the fulfillment lane's pattern. */
function field(r: Record<string, string>, names: string[]): string {
  for (const n of names) {
    if (r[n] != null && String(r[n]).trim() !== "") return String(r[n]).trim();
  }
  return "";
}

/** The file-kind test: an Items export carries Item Name, SKU and Stock On Hand. */
export function isZohoItemsExport(headers: string[]): boolean {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()));
  return set.has("item name") && set.has("sku") && set.has("stock on hand");
}

export function looksLikeZohoItemsFilename(name: string): boolean {
  return /item/i.test(name);
}

function num(raw: string): number | null {
  const text = String(raw).replace(/,/g, "").trim();
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Zoho's Unit column comes in every spelling (lb, LB, Lb, Pound, pound, Gram,
 * g, grams, each, Each, Unit, Liters, Liter) and is blank on most rows; a blank
 * unit reads from the category. */
export function normalizeUnit(raw: string, sub: string): MarketUom {
  const u = raw.trim().toLowerCase();
  if (u === "each" || u === "unit" || u === "units" || u === "ea" || u === "pcs") return "each";
  if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") return "lb";
  if (u === "g" || u === "gram" || u === "grams" || u === "gm") return "g";
  if (u === "oz" || u === "ounce" || u === "ounces") return "oz";
  if (u === "l" || u === "liter" || u === "liters" || u === "litre" || u === "litres") return "L";
  if (u === "") return EACH_SUBS.test(sub) ? "each" : "lb";
  return "each";
}

/** The size of one each: the item's own name first ("1.2g", "15g", "1oz"),
 * then the category's known size, else unknown. */
export function eachGramsFor(name: string, sub: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*-?\s*(g|gram|grams|oz|ounce|ounces)\b/i.exec(name);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return /^o/i.test(m[2]) ? n * ZOHO_GRAMS_PER_OZ : n;
  }
  for (const [re, grams] of EACH_GRAMS_BY_SUB) if (re.test(sub)) return grams;
  return null;
}

/** Actual weight in grams from the market-facing quantity. Liters and eaches
 * of unknown size have no weight to state. */
export function gramsOf(uom: MarketUom, qty: number, eachGrams: number | null): number | null {
  if (uom === "lb") return roundGrams(qty * ZOHO_GRAMS_PER_LB);
  if (uom === "oz") return roundGrams(qty * ZOHO_GRAMS_PER_OZ);
  if (uom === "g") return roundGrams(qty);
  if (uom === "each") return eachGrams == null ? null : roundGrams(qty * eachGrams);
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function marketQtyLabel(uom: MarketUom, qty: number): string {
  const q = uom === "each" ? String(Math.round(qty)) : trimNum(qty);
  return `${q} ${uom}`;
}

function trimNum(n: number): string {
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString("en-US");
  return String(Math.round(n * 10000) / 10000);
}

export function parseZohoItems(records: Record<string, string>[]): ZohoParseResult {
  const offered: ZohoItem[] = [];
  let inactive = 0;
  let noStock = 0;
  let notGoods = 0;
  let placeholder = 0;
  for (const r of records) {
    const name = field(r, ["Item Name", "Name"]);
    if (!name) continue;
    const status = field(r, ["Status"]);
    if (status && status.toLowerCase() !== "active") {
      inactive++;
      continue;
    }
    const productType = field(r, ["Product Type"]).toLowerCase();
    const itemType = field(r, ["Item Type"]).toLowerCase();
    if (productType === "service" || (itemType !== "" && !/inventory/i.test(itemType))) {
      notGoods++;
      continue;
    }
    const stock = num(field(r, ["Stock On Hand", "Available Stock", "Stock"]));
    if (stock == null || stock <= 0) {
      noStock++;
      continue;
    }
    if (stock >= PLACEHOLDER_STOCK) {
      placeholder++;
      continue;
    }
    const sub = field(r, ["CF.Product Sub", "Product Sub", "Category Name"]);
    const uom = normalizeUnit(field(r, ["Unit"]), sub);
    const eachGrams = uom === "each" ? eachGramsFor(name, sub) : null;
    const sku = field(r, ["SKU"]);
    const itemId = field(r, ["Item ID"]);
    const locName = field(r, ["Location Name"]);
    const locCode = field(r, ["CF.Location Code", "Location Code"]);
    const thc = num(field(r, ["CF.THC %", "THC %"]));
    offered.push({
      key: sku || (itemId ? `item:${itemId}` : `name:${name}`),
      sku,
      zoho_item_id: itemId,
      item_name: name,
      category: sub || "Uncategorized",
      market_uom: uom,
      market_qty: stock,
      each_grams: eachGrams,
      qty_grams: gramsOf(uom, stock, eachGrams),
      price: field(r, ["Selling Price", "Rate"]) || null,
      location: [locName, locCode].filter((s) => s).join(" / ") || null,
      thc_pct: thc,
      status: status || "Active",
      package_tag: METRC_TAG_RE.test(sku) ? sku.toUpperCase() : null,
    });
  }
  return {
    offered,
    rows_total: records.length,
    rows_inactive: inactive,
    rows_no_stock: noStock,
    rows_not_goods: notGoods,
    rows_placeholder: placeholder,
    by_category: summarizeByCategory(offered),
  };
}

/** Per category: the count and the market-facing total in the category's
 * dominant UOM (mixed units list each UOM's total). */
export function summarizeByCategory(items: readonly ZohoItem[]): Array<{ category: string; count: number; market: string }> {
  const groups = new Map<string, Map<MarketUom, number>>();
  const counts = new Map<string, number>();
  for (const it of items) {
    counts.set(it.category, (counts.get(it.category) ?? 0) + 1);
    const g = groups.get(it.category) ?? new Map<MarketUom, number>();
    g.set(it.market_uom, (g.get(it.market_uom) ?? 0) + it.market_qty);
    groups.set(it.category, g);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category, count]) => ({
      category,
      count,
      market: [...(groups.get(category) ?? new Map<MarketUom, number>()).entries()]
        .map(([uom, qty]) => marketQtyLabel(uom, qty))
        .join(" + "),
    }));
}

/* ---------------------------------------------------------------- mount */

export type ZohoListingRow = {
  id: string;
  sku: string | null;
  zoho_item_id: string | null;
  item_name: string;
  market_qty: number | null;
  listed: number;
  key?: string;
};

function keyOfExisting(row: ZohoListingRow): string {
  if (row.sku) return row.sku;
  if (row.zoho_item_id) return `item:${row.zoho_item_id}`;
  return `name:${row.item_name}`;
}

const BATCH_CHUNK = 400;

async function batchInChunks(db: D1Database, stmts: D1PreparedStatement[]): Promise<void> {
  for (let i = 0; i < stmts.length; i += BATCH_CHUNK) {
    await db.batch(stmts.slice(i, i + BATCH_CHUNK));
  }
}

export async function listZohoListings(db: D1Database): Promise<ZohoListingRow[]> {
  const result = await db
    .prepare(
      `SELECT id, sku, zoho_item_id, item_name, market_qty, listed FROM listings
       WHERE source = 'zoho' AND deleted_at IS NULL`
    )
    .all<ZohoListingRow>();
  return result.results ?? [];
}

/** THE SALESHELPER LIVE MENU (canon 0.30.47): the mounted, listed Zoho items
 * as the SalesHelper's raw items (Zoho item id, the item name it classifies,
 * the SKU it sorts by, the stock on hand it offers). */
/** rate: the listing's Zoho selling price as a number (SalesHelper canon 6, v0.8.0), when it reads. */
export type ZohoMenuItem = { itemId: string; name: string; sku: string; stock: number; rate?: number };

export async function listZohoMenuItems(db: D1Database): Promise<ZohoMenuItem[]> {
  const result = await db
    .prepare(
      `SELECT zoho_item_id, item_name, sku, market_qty, price FROM listings
       WHERE source = 'zoho' AND deleted_at IS NULL AND listed = 1 AND COALESCE(market_qty, 0) > 0
       ORDER BY item_name`
    )
    .all<{ zoho_item_id: string | null; item_name: string; sku: string | null; market_qty: number | null; price: string | null }>();
  return (result.results ?? []).map((r) => {
    const rate = zohoPriceNumber(r.price);
    return {
      itemId: String(r.zoho_item_id ?? ""),
      name: String(r.item_name ?? ""),
      sku: String(r.sku ?? ""),
      stock: Number(r.market_qty ?? 0),
      ...(rate != null ? { rate } : {}),
    };
  });
}

export type ZohoMountRow = {
  id: string;
  filename: string;
  rows_total: number;
  rows_offered: number;
  rows_inactive: number;
  rows_no_stock: number;
  rows_placeholder: number;
  listings_added: number;
  listings_updated: number;
  listings_unlisted: number;
  by_category: string;
  created_at: string;
};

export async function listZohoMounts(db: D1Database, limit = 5): Promise<ZohoMountRow[]> {
  const result = await db
    .prepare(
      `SELECT id, filename, rows_total, rows_offered, rows_inactive, rows_no_stock, rows_placeholder,
              listings_added, listings_updated, listings_unlisted, by_category, created_at
       FROM zoho_inventory_mounts WHERE deleted_at IS NULL
       ORDER BY created_at DESC LIMIT ?`
    )
    .bind(limit)
    .all<ZohoMountRow>();
  return result.results ?? [];
}

function uploadBasename(name: string): string {
  return String(name ?? "").split(/[\\/]/).pop()?.trim() ?? "";
}

export async function mountZohoInventory(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, String(form.get("person_id") ?? "") || null);
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "A file is required.");
  const filename = uploadBasename(file.name);
  if (!filename) throw new HttpError(400, "A file is required.");
  const text = await file.text();
  const records = csvObjects(text);
  const headers = records.length ? Object.keys(records[0]) : [];
  if (!isZohoItemsExport(headers)) {
    throw new HttpError(
      400,
      "That is not a Zoho Inventory Items export: it needs Item Name, SKU and Stock On Hand columns."
    );
  }
  const parsed = parseZohoItems(records);
  if (parsed.offered.length === 0) {
    throw new HttpError(400, "No active items with stock on hand in that file; nothing to offer.");
  }
  const ts = nowIso();
  const mountId = crypto.randomUUID();
  const existing = await listZohoListings(db);
  const byKey = new Map(existing.map((row) => [keyOfExisting(row), row]));
  const seen = new Set<string>();
  const stmts: D1PreparedStatement[] = [];
  const reason = SYSTEM_REASON.zoho_inventory_mount;
  const log = (id: string, fieldName: string, oldValue: unknown, newValue: unknown) =>
    insertLog(db, {
      record_table: "listings",
      record_id: id,
      field: fieldName,
      old_value: oldValue == null || oldValue === "" ? null : String(oldValue),
      new_value: newValue == null || newValue === "" ? null : String(newValue),
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    });
  let added = 0;
  let updated = 0;
  let unlisted = 0;
  // Two rows with one SKU (the export can carry the same package at two bins)
  // fold into one listing with the summed quantity.
  const folded = new Map<string, ZohoItem>();
  for (const it of parsed.offered) {
    const have = folded.get(it.key);
    if (!have) {
      folded.set(it.key, { ...it });
      continue;
    }
    have.market_qty = round2(have.market_qty + it.market_qty);
    have.qty_grams = gramsOf(have.market_uom, have.market_qty, have.each_grams);
  }
  for (const it of folded.values()) {
    seen.add(it.key);
    const grams = it.qty_grams ?? 0;
    const prior = byKey.get(it.key);
    if (!prior) {
      const id = crypto.randomUUID();
      stmts.push(
        db
          .prepare(
            `INSERT INTO listings (
              id, item_name, package_tag, package_label, package_item_id, category, qty_grams, listed,
              source, sku, zoho_item_id, market_uom, market_qty, each_grams, price, zoho_location, thc_pct,
              zoho_status, zoho_mount_id, zoho_mounted_at,
              created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
            ) VALUES (?, ?, ?, ?, NULL, ?, ?, 1, 'zoho', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
          )
          .bind(
            id,
            it.item_name,
            it.package_tag,
            it.sku || it.item_name,
            it.category,
            grams,
            it.sku || null,
            it.zoho_item_id || null,
            it.market_uom,
            it.market_qty,
            it.each_grams,
            it.price,
            it.location,
            it.thc_pct,
            it.status,
            mountId,
            ts,
            ts,
            actor.id,
            ts,
            actor.id
          ),
        log(id, "zoho_mount", null, `${it.sku || it.item_name} ${marketQtyLabel(it.market_uom, it.market_qty)}`)
      );
      added++;
    } else {
      stmts.push(
        db
          .prepare(
            `UPDATE listings SET item_name = ?, package_tag = ?, package_label = ?, category = ?, qty_grams = ?, listed = 1,
               sku = ?, zoho_item_id = ?, market_uom = ?, market_qty = ?, each_grams = ?, price = ?, zoho_location = ?, thc_pct = ?,
               zoho_status = ?, zoho_mount_id = ?, zoho_mounted_at = ?, updated_at = ?, updated_by = ?
             WHERE id = ?`
          )
          .bind(
            it.item_name,
            it.package_tag,
            it.sku || it.item_name,
            it.category,
            grams,
            it.sku || null,
            it.zoho_item_id || null,
            it.market_uom,
            it.market_qty,
            it.each_grams,
            it.price,
            it.location,
            it.thc_pct,
            it.status,
            mountId,
            ts,
            ts,
            actor.id,
            prior.id
          )
      );
      const priorQty = prior.market_qty == null ? null : Number(prior.market_qty);
      if (priorQty !== it.market_qty || Number(prior.listed) !== 1) {
        stmts.push(log(prior.id, "market_qty", priorQty, it.market_qty));
      }
      updated++;
    }
  }
  for (const row of existing) {
    if (seen.has(keyOfExisting(row))) continue;
    if (Number(row.listed) === 0 && Number(row.market_qty ?? 0) === 0) continue;
    stmts.push(
      db
        .prepare(
          `UPDATE listings SET listed = 0, market_qty = 0, qty_grams = 0, zoho_status = 'gone',
             zoho_mount_id = ?, zoho_mounted_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`
        )
        .bind(mountId, ts, ts, actor.id, row.id),
      log(row.id, "listed", row.listed, 0)
    );
    unlisted++;
  }
  stmts.push(
    db
      .prepare(
        `INSERT INTO zoho_inventory_mounts (
          id, filename, rows_total, rows_offered, rows_inactive, rows_no_stock, rows_placeholder,
          listings_added, listings_updated, listings_unlisted, by_category,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(
        mountId,
        filename,
        parsed.rows_total,
        folded.size,
        parsed.rows_inactive,
        parsed.rows_no_stock,
        parsed.rows_placeholder,
        added,
        updated,
        unlisted,
        JSON.stringify(summarizeByCategory([...folded.values()])),
        ts,
        actor.id,
        ts,
        actor.id
      )
  );
  await batchInChunks(db, stmts);
  return { redirect: `/marketplace?pane=zoho&ok=mounted&added=${added}&updated=${updated}&unlisted=${unlisted}` };
}
