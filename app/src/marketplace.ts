import { formatGrams, ITEM_KIND_FG, ITEM_KIND_WIP, metrcQuantity, OVERISSUE_TOLERANCE_GRAMS, roundGrams } from "./config";
import { formatLbs, gramsToLbs, GRAMS_PER_LB } from "./compliance";
import { t, type Locale } from "./i18n";
import { esc, fieldBlock, statusPill, tabBar } from "./ui";
import { salesHelperFitScript } from "./saleshelper";
import { marketQtyLabel, type MarketUom, type ZohoMountRow } from "./zohoinv";

export function mintSoNumber(year: number, seq: number): string {
  const yy = String(year).slice(-2).padStart(2, "0");
  return `SO-${yy}-${String(seq).padStart(3, "0")}`;
}

export function parseSoSeq(soNumber: string, yy: string): number | null {
  const prefix = `SO-${yy}-`;
  if (!soNumber.startsWith(prefix)) return null;
  const n = Number(soNumber.slice(prefix.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export type InventoryQtyByTag = Map<string, number>;

export type InventoryItemQty = {
  qty: number;
  deleted: boolean;
};

export type InventoryMatchCtx = {
  qtyByTag: InventoryQtyByTag;
  itemsById: Map<string, InventoryItemQty>;
};

export type ListingMatchInput = {
  package_item_id?: string | null;
  package_tag?: string | null;
  qty_grams: number;
};

/** Matching prefers the internal item link. When a link is set, the linked
 * item must exist, not be deleted, and cover the listing quantity. When no
 * link is set, fall back to the current tag matching (package_tag vs live
 * inventory by package code). */
export function listingMatches(row: ListingMatchInput, inv: InventoryMatchCtx): boolean {
  const qty = Number(row.qty_grams);
  if (row.package_item_id) {
    const item = inv.itemsById.get(row.package_item_id);
    return Boolean(item && !item.deleted && item.qty >= qty);
  }
  if (!row.package_tag) return false;
  const have = inv.qtyByTag.get(row.package_tag) ?? 0;
  return have >= qty;
}

export type ListingRow = {
  id: string;
  item_name: string;
  package_tag: string | null;
  package_label?: string | null;
  package_item_id?: string | null;
  item_display_name?: string | null;
  category?: string | null;
  qty_grams: number;
  listed: number;
  /** Canon 0.30.36: manual (hand-entered, the default) or zoho (mounted). */
  source?: string | null;
  sku?: string | null;
  market_uom?: string | null;
  market_qty?: number | null;
  each_grams?: number | null;
  price?: string | null;
  zoho_location?: string | null;
  thc_pct?: number | null;
  zoho_status?: string | null;
  zoho_mounted_at?: string | null;
};

/** Canon 0.30.36: a Zoho listing's match reads three ways. Its SKU is usually
 * the METRC package tag; when our ledger holds that tag the listing is
 * "matching" (the package covers it) or "short" (it does not); when the ledger
 * has never seen the tag the listing stands on Zoho's word alone: "zoho". A
 * manual listing keeps its two states. */
export type MatchState = "matching" | "short" | "zoho";

export type ListingView = ListingRow & { matching: boolean; match_state: MatchState };

export function matchStateOf(row: ListingRow, inv: InventoryMatchCtx): MatchState {
  // A Zoho row the ledger has never seen stands on Zoho's word, whatever its
  // grams say (a liters row carries 0 g, which would otherwise match anything).
  if (isZohoListing(row) && !row.package_item_id) {
    const tag = row.package_tag;
    if (!tag || !inv.qtyByTag.has(tag)) return "zoho";
  }
  return listingMatches(row, inv) ? "matching" : "short";
}

export function isZohoListing(row: Pick<ListingRow, "source">): boolean {
  return row.source === "zoho";
}

export function listingsWithMatch(rows: readonly ListingRow[], inv: InventoryMatchCtx): ListingView[] {
  return rows.map((row) => {
    const match_state = matchStateOf(row, inv);
    return { ...row, matching: match_state === "matching", match_state };
  });
}

/** The market-facing quantity with its actual weight beside it (owner: "show
 * that as "market-facing UOM" and actual weight in grams"). A weight the export
 * cannot state (liters, an each of unknown size) reads as unknown. */
export function marketQtyCell(row: ListingRow, locale: Locale): string {
  const uom = (row.market_uom ?? "") as MarketUom | "";
  if (!uom) return `${esc(formatGrams(row.qty_grams))} g`;
  const market = marketQtyLabel(uom, Number(row.market_qty ?? 0));
  const weightKnown = uom === "lb" || uom === "oz" || uom === "g" || (uom === "each" && row.each_grams != null);
  const weight = weightKnown
    ? `${esc(formatGrams(row.qty_grams))} g`
    : esc(t(locale, "weight unknown"));
  return `<b>${esc(market)}</b> <span class="muted">${weight}</span>`;
}

export type SalesOrderRow = {
  id: string;
  so_number: string;
  buyer: string;
  status: string;
  created_at: string;
  lines_label: string;
};

export type MarketItemOption = {
  id: string;
  name: string;
  qty: number;
  kind: string;
  parent_item_id?: string | null;
};

export type CategoryOption = { value: string; label: string };

export type SplitParentView = {
  id: string;
  name: string;
  package_code: string;
  qty: number;
};

export type SplitChildView = {
  id: string;
  package_code: string;
  qty: number;
};

export type MarketplaceExtras = {
  categories?: CategoryOption[];
  splitParent?: SplitParentView | null;
  splitChildren?: SplitChildView[];
  fromSplitChild?: boolean;
  /** Canon 0.30.36: the Zoho pane's mounts, newest first, and the flash. */
  zohoMounts?: ZohoMountRow[];
  ok?: string;
  mounted?: { added: number; updated: number; unlisted: number };
};

function qtyCell(qtyGrams: number, locale: Locale): string {
  return `${esc(formatGrams(qtyGrams))} g <span class="muted">${esc(formatLbs(qtyGrams))} ${esc(t(locale, "lbs"))}</span>`;
}

function itemOptionsHtml(
  items: MarketItemOption[],
  selectedId: string | null,
  required: boolean
): string {
  const opts = items
    .map((p) => {
      const sel = selectedId && p.id === selectedId ? " selected" : "";
      return `<option value="${esc(p.id)}"${sel}>${esc(p.name)} (${esc(p.kind)}, ${esc(formatGrams(p.qty))} g)</option>`;
    })
    .join("");
  return `<select name="package_item_id"${required ? " required" : ""}><option value=""></option>${opts}</select>`;
}

export type MarketplacePane = "listings" | "orders" | "zoho" | "saleshelper";

export function parseMarketplacePane(raw: string | undefined | null): MarketplacePane {
  if (raw === "orders" || raw === "zoho" || raw === "saleshelper") return raw;
  return "listings";
}

/** THE SALESHELPER TAB (canon 0.30.45). Owner, 2026-09-12: "New tab in
 * marketplace: [Saleshelper]  Return sales helper to the resulting pane, and
 * you and I will start to fix the issues". The pane frames the vendored form
 * exactly as the Fulfillment wrapper does (the same /fulfillment/saleshelper/app,
 * the same PIN cookie); the tab bar above it stays, so the embed keeps its
 * top margin here. */
export function salesHelperPaneHtml(locale: Locale): string {
  return `<div class="saleshelper-embed saleshelper-embed-pane" data-marketplace-saleshelper>
      <iframe class="saleshelper-frame" src="/fulfillment/saleshelper/app" title="${esc(t(locale, "SalesHelper"))}"></iframe>
    </div>
    ${salesHelperFitScript("[data-marketplace-saleshelper] iframe")}`;
}


export function marketplacePage(
  pane: MarketplacePane,
  allListings: ListingView[],
  orders: SalesOrderRow[],
  itemOptions: MarketItemOption[],
  listingOptions: ListingRow[],
  menuNames: string[],
  locale: Locale = "en",
  extras: MarketplaceExtras = {}
): string {
  const tabs = tabBar(
    locale,
    [
      { href: "/marketplace?pane=listings", key: "listings", label: "Listings" },
      { href: "/marketplace?pane=zoho", key: "zoho", label: "Zoho" },
      { href: "/marketplace?pane=orders", key: "orders", label: "Orders" },
      // THE SALESHELPER TAB (canon 0.30.45).
      { href: "/marketplace?pane=saleshelper", key: "saleshelper", label: "SalesHelper" },
    ],
    pane
  );
  // Canon 0.30.36: the Listings table stays the hand-entered rows; the mounted
  // Zoho offerings have their own pane, grouped by category.
  const listings = allListings.filter((row) => !isZohoListing(row));
  const zohoListings = allListings.filter((row) => isZohoListing(row));
  const names = [...new Set([...itemOptions.map((p) => p.name), ...menuNames])].filter((n) => n);
  const datalist = names.map((n) => `<option value="${esc(n)}"></option>`).join("");
  const catOpts = (extras.categories ?? [])
    .map((c) => `<option value="${esc(c.value)}">${esc(c.label)}</option>`)
    .join("");
  const listingRows =
    listings.length === 0
      ? `<tr><td colspan="7">${esc(t(locale, "No listings yet."))}</td></tr>`
      : listings
          .map((row) => {
            const label = row.package_label ?? row.package_tag ?? "";
            const linked = row.item_display_name
              ? ` <span class="muted">${esc(row.item_display_name)}</span>`
              : "";
            const splitHref = row.package_item_id
              ? `<a class="btn secondary" href="/marketplace?pane=listings&amp;split=${esc(row.package_item_id)}">${esc(t(locale, "Split package"))}</a>`
              : "";
            return `<tr class="phone-row">
        <td data-th="${esc(t(locale, "Item"))}">${esc(row.item_name)}</td>
        <td data-th="${esc(t(locale, "Label"))}">${esc(label)}${linked}</td>
        <td data-th="${esc(t(locale, "Category"))}">${esc(row.category ?? "")}</td>
        <td data-th="${esc(t(locale, "Quantity"))}">${qtyCell(row.qty_grams, locale)}</td>
        <td data-th="${esc(t(locale, "Listed"))}">${esc(row.listed ? t(locale, "yes") : t(locale, "no"))}</td>
        <td data-th="${esc(t(locale, "Matching"))}" data-match="${row.matching ? "yes" : "no"}">${esc(row.matching ? t(locale, "Matching") : t(locale, "Not matching"))}</td>
        <td>
          <form method="post" action="/marketplace/listings/${esc(row.id)}/listed">
            <input type="hidden" name="listed" value="${row.listed ? "0" : "1"}">
            <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
            <button type="submit">${esc(row.listed ? t(locale, "Unlist") : t(locale, "List"))}</button>
          </form>
          ${splitHref}
        </td>
      </tr>`;
          })
          .join("");
  const orderRows =
    orders.length === 0
      ? `<tr><td colspan="4">${esc(t(locale, "No orders yet."))}</td></tr>`
      : orders
          .map(
            (o) => `<tr class="phone-row">
        <td data-th="${esc(t(locale, "Number"))}"><a href="/marketplace/orders/${esc(o.id)}">${esc(o.so_number)}</a></td>
        <td data-th="${esc(t(locale, "Buyer"))}">${esc(o.buyer)}</td>
        <td data-th="${esc(t(locale, "Lines"))}">${esc(o.lines_label)}</td>
        <td data-th="${esc(t(locale, "Status"))}">${statusPill(o.status, locale)}</td>
      </tr>`
          )
          .join("");
  const pickOption = (l: ListingRow) =>
    `<option value="${esc(l.id)}">${esc(l.item_name)} ${esc(isZohoListing(l) ? (l.sku ?? "") : (l.package_label ?? l.package_tag ?? ""))}</option>`;
  const manualPick = listingOptions.filter((l) => l.listed && !isZohoListing(l)).map(pickOption).join("");
  // Canon 0.30.36: the mounted offerings ride the order pick too, grouped by category.
  const zohoPickGroups = new Map<string, string[]>();
  for (const l of listingOptions.filter((l) => l.listed && isZohoListing(l))) {
    const cat = l.category ?? "Uncategorized";
    const list = zohoPickGroups.get(cat) ?? [];
    list.push(pickOption(l));
    zohoPickGroups.set(cat, list);
  }
  const zohoPick = [...zohoPickGroups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, opts]) => `<optgroup label="Zoho: ${esc(cat)}">${opts.join("")}</optgroup>`)
    .join("");
  const listingPick = manualPick + zohoPick;
  const requireItem = Boolean(extras.fromSplitChild);
  const prefillItem = extras.fromSplitChild && extras.splitParent ? extras.splitParent.id : "";
  const splitParent = extras.splitParent ?? null;
  const splitChildren = extras.splitChildren ?? [];
  const childRows =
    splitChildren.length === 0
      ? `<tr><td colspan="2">${esc(t(locale, "No split children yet."))}</td></tr>`
      : splitChildren
          .map(
            (c) => `<tr>
        <td>${esc(c.package_code)}</td>
        <td>${esc(formatGrams(c.qty))} g</td>
      </tr>`
          )
          .join("");
  const parentOpts = itemOptions
    .filter((p) => p.kind === ITEM_KIND_FG || p.kind === ITEM_KIND_WIP)
    .map((p) => {
      const sel = splitParent && p.id === splitParent.id ? " selected" : "";
      return `<option value="${esc(p.id)}"${sel}>${esc(p.name)} (${esc(p.kind)}, ${esc(formatGrams(p.qty))} g)</option>`;
    })
    .join("");
  const remaining = splitParent ? splitParent.qty : 0;
  const splitExchange = splitParent
    ? `<p>${esc(t(locale, "Current quantity"))}: ${esc(formatGrams(splitParent.qty))} g</p>
      <p>${esc(t(locale, "Remaining"))}: ${esc(formatGrams(remaining))} g</p>
      <form class="stack" method="post" action="/marketplace/split" data-balance-remaining="${esc(String(remaining))}">
        <input type="hidden" name="parent_item_id" value="${esc(splitParent.id)}">
        <table class="data pkg-table">
          <thead><tr><th>${esc(t(locale, "Child quantity grams"))}</th><th>${esc(t(locale, "Child label note"))}</th></tr></thead>
          <tbody>
            <tr>
              <td><input type="number" name="child_qty_grams" step="0.01" min="0" id="split-plus-weight"></td>
              <td><input type="text" name="child_label_note"></td>
            </tr>
          </tbody>
        </table>
        <p><button type="submit" class="secondary" id="add-split" name="plus_one" value="1" title="${esc(t(locale, "Add the typed package to the list"))}">+</button></p>
        <button type="submit">${esc(t(locale, "Save"))}</button>
        <script>
          (function () {
            var btn = document.getElementById("add-split");
            if (!btn) return;
            btn.addEventListener("click", function (e) {
              var meta = document.querySelector("[data-balance-remaining]");
              var w = parseFloat((document.getElementById("split-plus-weight") || {}).value || "");
              if (!meta || !isFinite(w)) return;
              var remaining = parseFloat(meta.getAttribute("data-balance-remaining") || "");
              if (isFinite(remaining) && w > remaining + ${OVERISSUE_TOLERANCE_GRAMS}) {
                if (!confirm(${JSON.stringify(t(locale, "This split over issues the parent package. Record it anyway?"))})) e.preventDefault();
              }
            });
          })();
        </script>
      </form>
      <h3>${esc(t(locale, "Split children"))}</h3>
      <table class="data"><thead><tr><th>${esc(t(locale, "Label"))}</th><th>${esc(t(locale, "Quantity"))}</th></tr></thead><tbody>${childRows}</tbody></table>`
    : `<form class="stack" method="get" action="/marketplace">
        <input type="hidden" name="pane" value="listings">
        ${fieldBlock(locale, "Parent package", `<select name="split" required><option value=""></option>${parentOpts}</select>`, "Pick the FG or WIP package to split.")}
        <button type="submit">${esc(t(locale, "Split package"))}</button>
      </form>`;
  const zohoLine =
    zohoListings.length === 0
      ? ""
      : `<p class="muted" data-zoho-offerings="${zohoListings.filter((l) => l.listed).length}">${esc(
          t(locale, "Zoho offerings")
        )}: ${esc(String(zohoListings.filter((l) => l.listed).length))} ${esc(t(locale, "listed"))} · <a href="/marketplace?pane=zoho">${esc(t(locale, "Zoho"))}</a></p>`;
  const listingsPane = `${zohoLine}<div class="phone-table-wrap">
      <table class="data phone-table">
        <thead><tr>
          <th>${esc(t(locale, "Item"))}</th>
          <th>${esc(t(locale, "Label"))}</th>
          <th>${esc(t(locale, "Category"))}</th>
          <th>${esc(t(locale, "Quantity"))}</th>
          <th>${esc(t(locale, "Listed"))}</th>
          <th>${esc(t(locale, "Matching"))}</th>
          <th></th>
        </tr></thead>
        <tbody>${listingRows}</tbody>
      </table>
    </div>
    <h2>${esc(t(locale, "Add listing"))}</h2>
    <form class="stack" method="post" action="/marketplace/listings">
      ${requireItem ? `<input type="hidden" name="from_split_child" value="1">` : ""}
      ${fieldBlock(locale, "Item", `<input type="text" name="item_name" list="fg-names" required>`, "FG-eligible name from local inventory or the fulfillment menu.")}
      <datalist id="fg-names">${datalist}</datalist>
      ${fieldBlock(locale, "Label", `<input type="text" name="package_label">`, "Sales-facing name, free text.")}
      ${fieldBlock(locale, "Internal package", itemOptionsHtml(itemOptions, prefillItem || null, requireItem), "Internal package. Required to split.")}
      ${fieldBlock(locale, "Category", `<select name="category"><option value=""></option>${catOpts}</select>`, "Category for the listing. Admin\\Data Lookups\\Marketplace\\Listing Categories")}
      ${fieldBlock(locale, "Quantity grams", `<input type="number" name="qty_grams" step="0.01" min="0" required>`, "Quantity in grams. Lbs are calculated.")}
      <button type="submit">${esc(t(locale, "Add listing"))}</button>
    </form>
    <h2>${esc(t(locale, "Split package"))}</h2>
    ${splitExchange}`;
  const ordersPane = `<div class="phone-table-wrap">
      <table class="data phone-table">
        <thead><tr>
          <th>${esc(t(locale, "Number"))}</th>
          <th>${esc(t(locale, "Buyer"))}</th>
          <th>${esc(t(locale, "Lines"))}</th>
          <th>${esc(t(locale, "Status"))}</th>
        </tr></thead>
        <tbody>${orderRows}</tbody>
      </table>
    </div>
    <h2>${esc(t(locale, "New order"))}</h2>
    <form class="stack" method="post" action="/marketplace/orders">
      ${fieldBlock(locale, "Buyer", `<input type="text" name="buyer" required>`, "Buyer name on the sales order.")}
      ${fieldBlock(locale, "Listing", `<select name="listing_id" required>${listingPick}</select>`, "Line from a listed row.")}
      ${fieldBlock(locale, "Quantity grams", `<input type="number" name="qty_grams" step="0.01" min="0" required>`, "Quantity grams. Stored as grams. Lbs are calculated. Fulfillment does not reduce inventory this slice.")}
      <button type="submit">${esc(t(locale, "Create order"))}</button>
    </form>`;
  const zohoPane = zohoPaneHtml(zohoListings, extras, locale);
  const body =
    pane === "orders" ? ordersPane : pane === "zoho" ? zohoPane : pane === "saleshelper" ? salesHelperPaneHtml(locale) : listingsPane;
  return `<h1>${esc(t(locale, "Marketplace"))}</h1>
    ${tabs}
    ${body}`;
}

/** Canon 0.30.36: the Zoho pane. The drop form, the last mount's summary, and
 * the offerings grouped by Zoho's Product Sub, each row with its SKU, the
 * market-facing quantity and actual weight, price, location, THC, and how it
 * reads against our ledger. */
function zohoPaneHtml(rows: ListingView[], extras: MarketplaceExtras, locale: Locale): string {
  const mounts = extras.zohoMounts ?? [];
  const last = mounts[0];
  const flash =
    extras.ok === "mounted" && extras.mounted
      ? `<div class="banner ok" data-zoho-flash>${esc(t(locale, "Mounted"))}: ${esc(String(extras.mounted.added))} ${esc(t(locale, "added"))}, ${esc(String(extras.mounted.updated))} ${esc(t(locale, "updated"))}, ${esc(String(extras.mounted.unlisted))} ${esc(t(locale, "unlisted"))}.</div>`
      : "";
  const form = `<form class="stack" method="post" action="/marketplace/zoho" enctype="multipart/form-data" data-zoho-mount-form>
      <label class="field">${esc(t(locale, "Zoho Inventory Items export (csv)"))}
        <input type="file" name="file" accept=".csv" required>
      </label>
      <p class="muted">${esc(t(locale, "Drop the Items export from Zoho Inventory. Every active item with stock on hand becomes an offering by SKU; a listing gone from the newer export unlists; hand-entered listings are untouched. Nothing writes back to Zoho."))}</p>
      <button type="submit">${esc(t(locale, "Mount inventory"))}</button>
    </form>`;
  let summary = `<p class="muted" data-zoho-none>${esc(t(locale, "No Zoho inventory mounted yet."))}</p>`;
  if (last) {
    let cats: Array<{ category: string; count: number; market: string }> = [];
    try {
      cats = JSON.parse(last.by_category) as Array<{ category: string; count: number; market: string }>;
    } catch {
      cats = [];
    }
    const catRows = cats
      .map(
        (c) => `<tr><td>${esc(c.category)}</td><td>${esc(String(c.count))}</td><td>${esc(c.market)}</td></tr>`
      )
      .join("");
    summary = `<h2>${esc(t(locale, "Zoho as of"))} ${esc(last.created_at.replace("T", " ").slice(0, 16))}</h2>
      <p class="muted" data-zoho-summary>${esc(last.filename)} · ${esc(String(last.rows_total))} ${esc(t(locale, "rows"))} · ${esc(String(last.rows_offered))} ${esc(t(locale, "offered"))} · ${esc(String(last.rows_inactive))} ${esc(t(locale, "inactive"))} · ${esc(String(last.rows_no_stock))} ${esc(t(locale, "without stock"))}${Number(last.rows_placeholder ?? 0) > 0 ? ` · ${esc(String(last.rows_placeholder))} ${esc(t(locale, "placeholders skipped"))}` : ""} · ${esc(String(last.listings_added))} ${esc(t(locale, "added"))} · ${esc(String(last.listings_updated))} ${esc(t(locale, "updated"))} · ${esc(String(last.listings_unlisted))} ${esc(t(locale, "unlisted"))}</p>
      <table class="data zoho-cats"><thead><tr><th>${esc(t(locale, "Category"))}</th><th>${esc(t(locale, "Offerings"))}</th><th>${esc(t(locale, "Quantity"))}</th></tr></thead><tbody>${catRows}</tbody></table>`;
  }
  const listed = rows.filter((r) => r.listed);
  const gone = rows.filter((r) => !r.listed);
  const groups = new Map<string, ListingView[]>();
  for (const r of listed) {
    const cat = r.category ?? "Uncategorized";
    const list = groups.get(cat) ?? [];
    list.push(r);
    groups.set(cat, list);
  }
  const matchLabel = (r: ListingView) =>
    r.match_state === "matching"
      ? t(locale, "Matching")
      : r.match_state === "short"
        ? t(locale, "Not matching")
        : t(locale, "Zoho only");
  const rowHtml = (r: ListingView) => `<tr class="phone-row" data-zoho-sku="${esc(r.sku ?? "")}">
        <td data-th="${esc(t(locale, "Item"))}">${esc(r.item_name)}</td>
        <td data-th="${esc(t(locale, "SKU"))}"><code>${esc(r.sku ?? "")}</code></td>
        <td data-th="${esc(t(locale, "Quantity"))}">${marketQtyCell(r, locale)}</td>
        <td data-th="${esc(t(locale, "Price"))}">${esc(r.price ?? "")}</td>
        <td data-th="${esc(t(locale, "Location"))}">${esc(r.zoho_location ?? "")}</td>
        <td data-th="THC">${r.thc_pct == null ? "" : esc(`${Number(r.thc_pct).toFixed(1)}%`)}</td>
        <td data-th="${esc(t(locale, "Matching"))}" data-match="${esc(r.match_state)}">${esc(matchLabel(r))}</td>
      </tr>`;
  const groupHtml = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(
      ([cat, list]) => `<details class="zoho-cat" data-zoho-cat="${esc(cat)}">
        <summary><b>${esc(cat)}</b> <span class="muted">${esc(String(list.length))} ${esc(t(locale, "offerings"))}</span></summary>
        <div class="phone-table-wrap"><table class="data phone-table">
          <thead><tr><th>${esc(t(locale, "Item"))}</th><th>${esc(t(locale, "SKU"))}</th><th>${esc(t(locale, "Quantity"))}</th><th>${esc(t(locale, "Price"))}</th><th>${esc(t(locale, "Location"))}</th><th>THC</th><th>${esc(t(locale, "Matching"))}</th></tr></thead>
          <tbody>${list.map(rowHtml).join("")}</tbody>
        </table></div>
      </details>`
    )
    .join("");
  const goneHtml =
    gone.length === 0
      ? ""
      : `<details class="zoho-cat zoho-gone" data-zoho-gone="${gone.length}">
        <summary><b>${esc(t(locale, "Gone from Zoho"))}</b> <span class="muted">${esc(String(gone.length))}</span></summary>
        <ul>${gone.map((r) => `<li>${esc(r.item_name)} <code>${esc(r.sku ?? "")}</code></li>`).join("")}</ul>
      </details>`;
  const offerings =
    listed.length === 0
      ? ""
      : `<h2>${esc(t(locale, "Offerings"))} <span class="muted">${esc(String(listed.length))}</span></h2>${groupHtml}`;
  return `${flash}${form}${summary}${offerings}${goneHtml}`;
}

export function salesOrderPage(
  order: SalesOrderRow,
  lines: Array<{ item_name: string; package_label?: string | null; package_tag?: string | null; category?: string | null; qty_grams: number }>,
  locale: Locale = "en"
): string {
  const body = lines
    .map(
      (l) => `<tr class="phone-row">
        <td data-th="${esc(t(locale, "Item"))}">${esc(l.item_name)}</td>
        <td data-th="${esc(t(locale, "Label"))}">${esc(l.package_label ?? l.package_tag ?? "")}</td>
        <td data-th="${esc(t(locale, "Category"))}">${esc(l.category ?? "")}</td>
        <td data-th="${esc(t(locale, "Quantity"))}">${qtyCell(l.qty_grams, locale)}</td>
      </tr>`
    )
    .join("");
  const next =
    order.status === "new"
      ? { action: "confirmed", label: "Confirm" }
      : order.status === "confirmed"
        ? { action: "fulfilled", label: "Fulfill" }
        : null;
  const step = next
    ? `<form class="stack" method="post" action="/marketplace/orders/${esc(order.id)}/status">
        <input type="hidden" name="status" value="${esc(next.action)}">
        <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
        <button type="submit">${esc(t(locale, next.label))}</button>
      </form>`
    : "";
  const cancel =
    order.status !== "cancelled" && order.status !== "fulfilled"
      ? `<form class="stack" method="post" action="/marketplace/orders/${esc(order.id)}/status">
          <input type="hidden" name="status" value="cancelled">
          <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
          <button type="submit" class="danger">${esc(t(locale, "Cancel"))}</button>
        </form>`
      : "";
  return `<h1>${esc(order.so_number)}</h1>
    <p>${esc(t(locale, "Buyer"))}: ${esc(order.buyer)} ${statusPill(order.status, locale)}</p>
    <table class="data phone-table"><thead><tr>
      <th>${esc(t(locale, "Item"))}</th><th>${esc(t(locale, "Label"))}</th><th>${esc(t(locale, "Category"))}</th><th>${esc(t(locale, "Quantity"))}</th>
    </tr></thead><tbody>${body}</tbody></table>
    ${step}
    ${cancel}`;
}

export function lbsToGrams(lbs: number): number {
  return roundGrams(Number(lbs) * GRAMS_PER_LB);
}

export function agedDays(createdAt: string, now = new Date()): number {
  const start = Date.parse(createdAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((now.getTime() - start) / 86_400_000));
}

/** PROVISIONAL: the owner's naming conventions doc lands here in one edit. */
export function splitChildCode(parentCode: string, n: number): string {
  return `${parentCode}-S${n}`;
}

/** PROVISIONAL: the owner's T3 split template, if one exists, lands as a single edit. */
export const SPLIT_CSV_HEADER = "ParentLabel,ChildLabel,Quantity,UnitOfWeight,Date";

export type SplitCsvRow = {
  parentLabel: string;
  childLabel: string;
  quantity: number;
  date: string;
};

export function packageSplitCsv(rows: readonly SplitCsvRow[]): string {
  const body = rows.map((row) =>
    [row.parentLabel, row.childLabel, metrcQuantity(row.quantity).toFixed(2), "Grams", row.date]
      .map((cell) => {
        const s = String(cell);
        return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
      })
      .join(",")
  );
  return SPLIT_CSV_HEADER + "\r\n" + (body.length ? body.join("\r\n") + "\r\n" : "");
}

export function splitFilename(parentCode: string): string {
  const safe = parentCode.replace(/[^A-Za-z0-9._-]+/g, "_");
  return `package_split_${safe}.csv`;
}

export { gramsToLbs };
