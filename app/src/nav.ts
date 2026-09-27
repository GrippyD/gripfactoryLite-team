/**
 * THE BACK LINK (canon 0.30.109). Owner ruling 2026-09-17, verbatim: "All
 * sub-menus need to have a link that goes back to the pervious menu.  Using
 * the "home" button for every process is too onerous".
 *
 * Every shelled page but Home carries one crumb under the app bar that goes
 * back to the menu above it. The tree is data: the operations map's groups and
 * members (pipeline.ts) place the stations and the group pages; the prefix
 * table below places everything else (Admin and its pages, Reports, the
 * Production Scheduling stages, the Inventory, Fulfillment, Marketplace,
 * Compliance and Purchasing families). A record's pencil or void page goes back
 * to the page it came from (the same-origin referer) and reads Back. The
 * renderer is pure so the tests pin it without a database.
 */
import { HARVEST_PATH, MODELS_PATH, PRODUCTION_SCHEDULING_PATH } from "./config";
import { t, type Locale } from "./i18n";
import { OPS_GROUPS } from "./pipeline";
import { esc } from "./ui";

export type BackLink = { href: string; label: string };

export const HOME_LINK: BackLink = { href: "/", label: "Home" };
const ADMIN_LINK: BackLink = { href: "/admin", label: "Admin" };
const DATA_QUEUES_LINK: BackLink = { href: "/admin/queues", label: "Data Queues" };

/** Longest prefix wins; each entry maps a family of pages onto the menu above it. */
const PREFIX_PARENTS: ReadonlyArray<[prefix: string, parent: BackLink]> = [
  [`${PRODUCTION_SCHEDULING_PATH}/`, { href: PRODUCTION_SCHEDULING_PATH, label: "Production Scheduling" }],
  ["/fulfillment/", { href: "/fulfillment", label: "Fulfillment" }],
  ["/inventory/", { href: "/inventory", label: "Inventory" }],
  ["/marketplace/", { href: "/marketplace", label: "Marketplace" }],
  // An order opens from the Orders pane, so its way back lands on that pane.
  ["/marketplace/orders/", { href: "/marketplace?pane=orders", label: "Marketplace" }],
  ["/compliance/", { href: "/compliance", label: "Compliance Console" }],
  ["/purchasing/", { href: "/purchasing", label: "Purchasing" }],
  ["/admin/lookups/", { href: "/admin/lookups", label: "Data Lookups" }],
  ["/admin/uploads/", { href: "/admin/uploads", label: "Pending Data Uploads" }],
  ["/admin/queues/", DATA_QUEUES_LINK],
  ["/admin/", ADMIN_LINK],
  [`${MODELS_PATH}/`, { href: MODELS_PATH, label: "Models" }],
  ["/reports/", { href: "/reports", label: "Reports" }],
  ["/queue/", DATA_QUEUES_LINK],
  ["/interco/", { href: "/ops/interco_logistics", label: "Logistics Operations" }],
  ["/logistics/", { href: "/ops/interco_logistics", label: "Logistics Operations" }],
  ["/virtual-move/", { href: "/ops/drying_ops", label: "Drying Operations" }],
];

/** Pages that hang directly under a menu the map does not spell out. */
const EXACT_PARENTS: Readonly<Record<string, BackLink>> = {
  "/admin": HOME_LINK,
  "/reports": HOME_LINK,
  "/log": HOME_LINK,
  [HARVEST_PATH]: ADMIN_LINK,
  [MODELS_PATH]: ADMIN_LINK,
  "/admin/manual-hbn": ADMIN_LINK,
};

function normalizePath(path: string): string {
  const bare = path.split("?")[0].split("#")[0];
  if (bare.length > 1 && bare.endsWith("/")) return bare.slice(0, -1);
  return bare || "/";
}

/** The same-origin path a referer points at, or null when it is missing,
 * foreign, or itself a record page (a pencil that led to a pencil). */
export function refererPath(referer: string | null | undefined, origin: string): string | null {
  if (!referer) return null;
  try {
    const ref = new URL(referer);
    const own = new URL(origin);
    if (ref.origin !== own.origin) return null;
    if (ref.pathname.startsWith("/record/")) return null;
    if (ref.pathname === "/") return "/";
    return `${ref.pathname}${ref.search}`;
  } catch {
    return null;
  }
}

/** The menu above a page: the ops map first (a station or group page), then
 * the exact table, then the longest prefix; Home for anything unplaced. Home
 * itself has no parent. */
export function backLinkFor(path: string, opts: { referer?: string | null; origin?: string } = {}): BackLink | null {
  const p = normalizePath(path);
  if (p === "/") return null;
  if (p.startsWith("/record/")) {
    const back = opts.origin ? refererPath(opts.referer, opts.origin) : null;
    return back ? { href: back, label: "Back" } : DATA_QUEUES_LINK;
  }
  for (const group of OPS_GROUPS) {
    // A group whose own page is its member (Interco Logistics, Marketplace)
    // hangs under Home like the /ops pages do.
    if (normalizePath(group.href) === p) return HOME_LINK;
    if (group.members.some((m) => normalizePath(m.href) === p)) {
      return { href: group.href, label: group.label };
    }
  }
  if (p in EXACT_PARENTS) return EXACT_PARENTS[p];
  let best: BackLink | null = null;
  let bestLen = -1;
  for (const [prefix, parent] of PREFIX_PARENTS) {
    if (p.startsWith(prefix) && prefix.length > bestLen) {
      best = parent;
      bestLen = prefix.length;
    }
  }
  if (best) return best;
  if (p.startsWith("/ops/")) return HOME_LINK;
  return HOME_LINK;
}

/** The crumb under the app bar: a left arrow and the menu's name. */
export function backCrumb(link: BackLink | null, locale: Locale = "en"): string {
  if (!link) return "";
  return `<nav class="back-crumb" aria-label="${esc(t(locale, "Back"))}"><a class="back-link" href="${esc(
    link.href
  )}" data-back-link>&#8592; ${esc(t(locale, link.label))}</a></nav>`;
}
