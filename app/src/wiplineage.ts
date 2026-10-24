/**
 * WIP Package Lineage (WL2). The page reads the METRC mirror. One row per tag:
 * Transferred over Inactive over Active. A harvest is a family when it has a
 * WIP that is not transferred. The root is the earliest packaged of those WIPs
 * that was not made from another WIP. Pounds are grams over 448.
 */

import { GRAMS_PER_LB, LICENSE_AU_PROCESSOR, format2, formatGrams } from "./config";
import { etWallClock } from "./farmday";
import { t, type Locale } from "./i18n";
import { esc } from "./ui";

export type LineageStatus = "Active" | "Finished" | "Discontinued" | "Transferred";

export type LineagePackage = {
  tag: string;
  status: LineageStatus;
  source_harvest: string;
  source_package: string;
  item: string;
  category: string;
  strain: string;
  quantity: number;
  uom: string;
  location: string;
  lab_status: string;
  packaged_date: string;
  destination: string;
  destination_license: string;
  manifest: string;
  shipped_date: string;
  transfer_type: "" | "Lab sample" | "Sale";
};

export type MirrorLineagePackage = {
  tag: string;
  source_harvests: string | null;
  source_packages: string | null;
  item: string | null;
  category: string | null;
  item_strain: string | null;
  quantity: number | null;
  uom: string | null;
  location: string | null;
  lab_test_status: string | null;
  packaged_date: string | null;
  inactive_state: string | null;
  gone_at: string | null;
};

export type MirrorLineageTransfer = {
  tag: string;
  manifest: string;
  destination_facility: string | null;
  destination_license: string | null;
  shipped_quantity: number | null;
  uom: string | null;
  lab_state: string | null;
  received_date: string | null;
  source_harvests: string | null;
  source_packages: string | null;
  item: string | null;
  category: string | null;
  item_strain: string | null;
  transfer_type: string | null;
};

export function itemPrefix(item: string | null | undefined): string {
  return String(item ?? "").split(" - ")[0].trim();
}

export function harvestNames(raw: string | null | undefined): string[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function lineagePounds(grams: number): number {
  return Math.round(Number(grams) / GRAMS_PER_LB);
}

function text(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function qty(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** A later received date wins. The same date keeps the later manifest. */
function transferWins(next: MirrorLineageTransfer, prev: MirrorLineageTransfer): boolean {
  const a = text(next.received_date);
  const b = text(prev.received_date);
  if (a !== b) return a > b;
  return text(next.manifest) > text(prev.manifest);
}

function fromPackage(row: MirrorLineagePackage, status: LineageStatus): LineagePackage {
  return {
    tag: row.tag,
    status,
    source_harvest: text(row.source_harvests),
    source_package: text(row.source_packages),
    item: text(row.item),
    category: text(row.category),
    strain: text(row.item_strain),
    quantity: qty(row.quantity),
    uom: text(row.uom),
    location: text(row.location),
    lab_status: text(row.lab_test_status),
    packaged_date: text(row.packaged_date),
    destination: "",
    destination_license: "",
    manifest: "",
    shipped_date: "",
    transfer_type: "",
  };
}

function fromTransfer(row: MirrorLineageTransfer): LineagePackage {
  const kind = row.transfer_type === "Lab sample" ? "Lab sample" : "Sale";
  return {
    tag: row.tag,
    status: "Transferred",
    source_harvest: text(row.source_harvests),
    source_package: text(row.source_packages),
    item: text(row.item),
    category: text(row.category),
    strain: text(row.item_strain),
    quantity: qty(row.shipped_quantity),
    uom: text(row.uom),
    location: "",
    lab_status: text(row.lab_state),
    packaged_date: "",
    destination: text(row.destination_facility),
    destination_license: text(row.destination_license),
    manifest: text(row.manifest),
    shipped_date: text(row.received_date),
    transfer_type: kind,
  };
}

/** One row per tag. Transferred over Inactive over Active. A gone package
 * with no inactive state and no transfer is not a current export row. */
export function lineageFromMirror(packages: readonly MirrorLineagePackage[], transfers: readonly MirrorLineageTransfer[]): LineagePackage[] {
  const byTag = new Map<string, LineagePackage>();
  for (const row of packages) {
    const inactive = row.inactive_state === "Finished" || row.inactive_state === "Discontinued" ? row.inactive_state : null;
    if (!inactive && row.gone_at != null) continue;
    byTag.set(row.tag, fromPackage(row, inactive ?? "Active"));
  }
  const best = new Map<string, MirrorLineageTransfer>();
  for (const row of transfers) {
    const prev = best.get(row.tag);
    if (!prev || transferWins(row, prev)) best.set(row.tag, row);
  }
  for (const row of best.values()) byTag.set(row.tag, fromTransfer(row));
  return [...byTag.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

export type WipFamily = {
  harvest: string;
  root_tag: string;
  strain: string;
  family_status: "Active" | "Inactive";
  wip_n: number;
  active_wip_n: number;
  active_wip_g: number;
  root_lb: number | null;
  finished_n: number;
  finished_active_n: number;
  shipped_n: number;
  shipped_lb: number;
  shipped_ea: number;
  buyers: number;
};

const FINISHED = ["BUD", "PRE", "SHA"];

function byHarvest(packages: readonly LineagePackage[]): Map<string, LineagePackage[]> {
  const map = new Map<string, LineagePackage[]>();
  for (const row of packages) {
    for (const name of harvestNames(row.source_harvest)) {
      const list = map.get(name);
      if (list) list.push(row);
      else map.set(name, [row]);
    }
  }
  return map;
}

export function wipFamilies(packages: readonly LineagePackage[]): WipFamily[] {
  const wipTags = new Set(packages.filter((row) => itemPrefix(row.item) === "WIP").map((row) => row.tag));
  const grouped = byHarvest(packages);
  const rows: WipFamily[] = [];
  for (const [harvest, list] of grouped) {
    const wips = list.filter((row) => itemPrefix(row.item) === "WIP" && row.status !== "Transferred");
    if (wips.length === 0) continue;
    const sold = list.filter((row) => row.status === "Transferred" && row.transfer_type === "Sale");
    const tops = wips.filter((row) => !harvestNames(row.source_package).some((tag) => wipTags.has(tag)));
    const pool = tops.length ? tops : wips;
    const root = [...pool].sort((a, b) => a.packaged_date.localeCompare(b.packaged_date) || a.tag.localeCompare(b.tag))[0];
    const fin = list.filter((row) => FINISHED.includes(itemPrefix(row.item)));
    const activeWips = wips.filter((row) => row.status === "Active");
    rows.push({
      harvest,
      root_tag: root.tag,
      strain: root.strain,
      family_status: activeWips.length ? "Active" : "Inactive",
      wip_n: wips.length,
      active_wip_n: activeWips.length,
      active_wip_g: activeWips.filter((row) => row.uom === "g").reduce((sum, row) => sum + row.quantity, 0),
      root_lb: root.uom === "g" ? lineagePounds(root.quantity) : null,
      finished_n: fin.length,
      finished_active_n: fin.filter((row) => row.status === "Active").length,
      shipped_n: sold.length,
      shipped_lb: lineagePounds(sold.filter((row) => row.uom === "g").reduce((sum, row) => sum + row.quantity, 0)),
      shipped_ea: sold.filter((row) => row.uom === "ea").reduce((sum, row) => sum + row.quantity, 0),
      buyers: new Set(sold.map((row) => row.destination)).size,
    });
  }
  return rows;
}

export type WipBranch = {
  harvest: string;
  type: string;
  n: number;
  active_n: number;
  active_qty: number;
  active_failed_n: number;
  shipped_n: number;
  shipped_qty: number;
  uom: string;
};

export function wipBranches(packages: readonly LineagePackage[], families: readonly WipFamily[]): WipBranch[] {
  const grouped = byHarvest(packages);
  const rows: WipBranch[] = [];
  for (const family of families) {
    const groups = new Map<string, WipBranch>();
    for (const row of grouped.get(family.harvest) ?? []) {
      if (row.tag === family.root_tag) continue;
      const type = itemPrefix(row.item);
      let group = groups.get(type);
      if (!group) {
        group = { harvest: family.harvest, type, n: 0, active_n: 0, active_qty: 0, active_failed_n: 0, shipped_n: 0, shipped_qty: 0, uom: row.uom };
        groups.set(type, group);
      }
      group.n += 1;
      if (row.status === "Active") {
        group.active_n += 1;
        group.active_qty += row.quantity;
        if (row.lab_status === "TestFailed" || row.lab_status === "RetestFailed") group.active_failed_n += 1;
      }
      if (row.status === "Transferred") {
        group.shipped_n += 1;
        group.shipped_qty += row.quantity;
      }
      if (group.uom !== row.uom) group.uom = "mixed";
    }
    for (const group of groups.values()) {
      rows.push({ ...group, active_qty: Math.round(group.active_qty * 100) / 100, shipped_qty: Math.round(group.shipped_qty * 100) / 100 });
    }
  }
  return rows;
}

export type FamilyLab = {
  harvest: string;
  passed: number;
  pending: number;
  failed: number;
  not_submitted: number;
  tested_n: number;
};

function labGroup(status: string): "passed" | "pending" | "failed" | "not_submitted" {
  if (status === "TestPassed" || status === "RetestPassed") return "passed";
  if (status === "TestFailed" || status === "RetestFailed") return "failed";
  if (status === "SubmittedForTesting" || status === "TestingInProgress" || status === "AwaitingConfirmation") return "pending";
  return "not_submitted";
}

export function familyLab(packages: readonly LineagePackage[], families: readonly WipFamily[]): FamilyLab[] {
  const grouped = new Map<string, LineagePackage[]>();
  for (const row of packages) {
    if (row.status !== "Active") continue;
    for (const name of harvestNames(row.source_harvest)) {
      const list = grouped.get(name);
      if (list) list.push(row);
      else grouped.set(name, [row]);
    }
  }
  return families.map((family) => {
    const row: FamilyLab = { harvest: family.harvest, passed: 0, pending: 0, failed: 0, not_submitted: 0, tested_n: 0 };
    for (const pkg of grouped.get(family.harvest) ?? []) {
      if (pkg.tag === family.root_tag) continue;
      row[labGroup(pkg.lab_status)] += 1;
      row.tested_n += 1;
    }
    return row;
  });
}

export type WipTotals = {
  families: number;
  active_families: number;
  active_wips: number;
  inactive_wips: number;
  active_wip_lb: number;
  bud_n: number;
  bud_active_n: number;
  pre_n: number;
  pre_active_n: number;
  sha_n: number;
  sha_active_n: number;
  traced_active: number;
  active_finished_total: number;
  failed_active_n: number;
  failed_families: number;
  shipped_sale_n: number;
  shipped_sale_lb: number;
  buyers: number;
};

export function wipTotals(packages: readonly LineagePackage[], families: readonly WipFamily[], branches: readonly WipBranch[], labs: readonly FamilyLab[]): WipTotals {
  const sum = (type: string, field: "n" | "active_n") => branches.filter((row) => row.type === type).reduce((total, row) => total + row[field], 0);
  const allWips = families.reduce((total, row) => total + row.wip_n, 0);
  const activeWips = families.reduce((total, row) => total + row.active_wip_n, 0);
  const sold = packages.filter((row) => row.status === "Transferred" && row.transfer_type === "Sale" && FINISHED.includes(itemPrefix(row.item)));
  return {
    families: families.length,
    active_families: families.filter((row) => row.family_status === "Active").length,
    active_wips: activeWips,
    inactive_wips: allWips - activeWips,
    active_wip_lb: lineagePounds(families.reduce((total, row) => total + row.active_wip_g, 0)),
    bud_n: sum("BUD", "n"),
    bud_active_n: sum("BUD", "active_n"),
    pre_n: sum("PRE", "n"),
    pre_active_n: sum("PRE", "active_n"),
    sha_n: sum("SHA", "n"),
    sha_active_n: sum("SHA", "active_n"),
    traced_active: families.reduce((total, row) => total + row.finished_active_n, 0),
    active_finished_total: packages.filter((row) => row.status === "Active" && FINISHED.includes(itemPrefix(row.item))).length,
    failed_active_n: labs.reduce((total, row) => total + row.failed, 0),
    failed_families: labs.filter((row) => row.failed > 0).length,
    shipped_sale_n: sold.length,
    shipped_sale_lb: lineagePounds(sold.filter((row) => row.uom === "g").reduce((total, row) => total + row.quantity, 0)),
    buyers: new Set(sold.map((row) => row.destination)).size,
  };
}

export type LineageSort = "newest" | "most" | "shipped" | "failed" | "strain";

export type LineageViewFilter = {
  q: string;
  status: "all" | "active" | "inactive";
  only: boolean;
  failed: boolean;
  shipped: boolean;
  hide: boolean;
  sort: LineageSort;
  types: ReadonlySet<string>;
  open: boolean;
};

const DEFAULT_TYPES = ["WIP", "BUD", "PRE", "SHA"];
const BRANCH_ORDER = ["WIP", "BUD", "PRE", "SHA"];

export function lineageFilterOf(params: URLSearchParams): LineageViewFilter {
  const status = params.get("status");
  const sort = params.get("sort");
  const submitted = params.get("filtered") === "1";
  const chips = params.getAll("chip").map((value) => value.trim()).filter(Boolean);
  const types = new Set(submitted ? chips : DEFAULT_TYPES);
  return {
    q: (params.get("q") ?? "").trim(),
    status: status === "active" || status === "inactive" ? status : "all",
    only: params.get("only") === "1",
    failed: params.get("failed") === "1",
    shipped: params.get("shipped") === "1",
    hide: params.get("hide") === "1",
    sort: sort === "most" || sort === "shipped" || sort === "failed" || sort === "strain" ? sort : "newest",
    types,
    open: params.get("open") === "1",
  };
}

export type LineageCard = {
  family: WipFamily;
  root: LineagePackage;
  groups: Map<string, LineagePackage[]>;
  lab: FamilyLab | undefined;
};

export function lineageCards(packages: readonly LineagePackage[], families: readonly WipFamily[], labs: readonly FamilyLab[], filter: LineageViewFilter): LineageCard[] {
  const tags = new Map(packages.map((row) => [row.tag, row]));
  const grouped = byHarvest(packages);
  const labByHarvest = new Map(labs.map((row) => [row.harvest, row]));
  let cards: LineageCard[] = [];
  for (const family of families) {
    const root = tags.get(family.root_tag);
    if (!root) continue;
    const groups = new Map<string, LineagePackage[]>();
    for (const row of grouped.get(family.harvest) ?? []) {
      if (row.tag === family.root_tag) continue;
      const type = itemPrefix(row.item);
      const list = groups.get(type);
      if (list) list.push(row);
      else groups.set(type, [row]);
    }
    cards.push({ family, root, groups, lab: labByHarvest.get(family.harvest) });
  }
  if (filter.status === "active") cards = cards.filter((card) => card.family.family_status === "Active");
  if (filter.status === "inactive") cards = cards.filter((card) => card.family.family_status === "Inactive");
  if (filter.only) cards = cards.filter((card) => card.family.finished_n > 0);
  if (filter.failed) cards = cards.filter((card) => (card.lab?.failed ?? 0) > 0);
  if (filter.shipped) cards = cards.filter((card) => card.family.shipped_n > 0);
  const q = filter.q.toLowerCase();
  if (q) {
    cards = cards.filter((card) => {
      const own = [card.root.strain, card.root.tag, card.family.harvest, card.root.item].some((value) => value.toLowerCase().includes(q));
      let child = false;
      for (const list of card.groups.values()) {
        for (const row of list) {
          if (row.tag.toLowerCase().includes(q) || row.manifest.toLowerCase().includes(q) || row.destination.toLowerCase().includes(q)) child = true;
        }
      }
      return own || child;
    });
  }
  const byDate = (a: LineageCard, b: LineageCard) => b.root.packaged_date.localeCompare(a.root.packaged_date);
  cards.sort((a, b) => {
    if (filter.sort === "most") return b.family.finished_n - a.family.finished_n || byDate(a, b);
    if (filter.sort === "shipped") return b.family.shipped_n - a.family.shipped_n || byDate(a, b);
    if (filter.sort === "failed") return (b.lab?.failed ?? 0) - (a.lab?.failed ?? 0) || (b.lab?.pending ?? 0) - (a.lab?.pending ?? 0) || byDate(a, b);
    if (filter.sort === "strain") return a.root.strain.localeCompare(b.root.strain) || byDate(a, b);
    return byDate(a, b) || a.root.strain.localeCompare(b.root.strain);
  });
  return cards;
}

export type LineageAsOf = { active: string | null; inactive: string | null; transferred: string | null };

export type WipLineageModel = {
  license: string;
  licenses: string[];
  packages: LineagePackage[];
  families: WipFamily[];
  branches: WipBranch[];
  labs: FamilyLab[];
  totals: WipTotals;
  asOf: LineageAsOf;
};

function formatQty(n: number): string {
  if (Number.isInteger(n)) return formatGrams(n);
  return format2(n);
}

export async function loadWipLineage(db: D1Database, asked: string | null): Promise<WipLineageModel> {
  const found = await db
    .prepare(
      `SELECT license_value FROM metrc_packages WHERE license_value LIKE 'AU-P-%'
       UNION
       SELECT license_value FROM metrc_transfers WHERE license_value LIKE 'AU-P-%'
       ORDER BY license_value`
    )
    .all<{ license_value: string }>();
  const licenses = (found.results ?? []).map((row) => row.license_value);
  const license = licenses.includes(asked ?? "") ? (asked as string) : licenses.includes(LICENSE_AU_PROCESSOR) ? LICENSE_AU_PROCESSOR : licenses[0] ?? LICENSE_AU_PROCESSOR;
  const [packages, transfers, mounts] = await Promise.all([
    db
      .prepare(
        `SELECT tag, source_harvests, source_packages, item, category, item_strain, quantity, uom, location,
                lab_test_status, packaged_date, inactive_state, gone_at
         FROM metrc_packages WHERE license_value = ?`
      )
      .bind(license)
      .all<MirrorLineagePackage>(),
    db
      .prepare(
        `SELECT tag, manifest, destination_facility, destination_license, shipped_quantity, uom, lab_state,
                received_date, source_harvests, source_packages, item, category, item_strain, transfer_type
         FROM metrc_transfers WHERE license_value = ?`
      )
      .bind(license)
      .all<MirrorLineageTransfer>(),
    db
      .prepare(
        `SELECT CASE WHEN phase = 'inactive' THEN 'inactive' WHEN phase = 'transferred' THEN 'transferred' ELSE 'active' END AS grid,
                MAX(created_at) AS newest
         FROM metrc_mounts
         WHERE deleted_at IS NULL AND kind = 'packages' AND license_value = ?
         GROUP BY CASE WHEN phase = 'inactive' THEN 'inactive' WHEN phase = 'transferred' THEN 'transferred' ELSE 'active' END`
      )
      .bind(license)
      .all<{ grid: string; newest: string | null }>(),
  ]);
  const asOf: LineageAsOf = { active: null, inactive: null, transferred: null };
  for (const row of mounts.results ?? []) {
    if (row.grid === "inactive" || row.grid === "transferred" || row.grid === "active") asOf[row.grid] = row.newest;
  }
  const rows = lineageFromMirror(packages.results ?? [], transfers.results ?? []);
  const families = wipFamilies(rows);
  const branches = wipBranches(rows, families);
  const labs = familyLab(rows, families);
  return { license, licenses, packages: rows, families, branches, labs, totals: wipTotals(rows, families, branches, labs), asOf };
}

function chip(name: string, on: boolean, label: string): string {
  return `<label class="wl-chip"><input type="checkbox" name="chip" value="${esc(name)}"${on ? " checked" : ""}> ${esc(label)}</label>`;
}

/** Her hide chip ("Hide finished and discontinued"): a branch and its rows keep
 * only the packages that are active or shipped. */
function keepRow(row: LineagePackage): boolean {
  return row.status === "Active" || row.status === "Transferred";
}

function branchTypes(card: LineageCard, filter: LineageViewFilter): string[] {
  return [...card.groups.keys()]
    .filter((type) => (BRANCH_ORDER.includes(type) ? filter.types.has(type) : filter.types.has("OTHER")))
    .filter((type) => !filter.hide || (card.groups.get(type) ?? []).some(keepRow))
    .sort((a, b) => (BRANCH_ORDER.includes(a) ? BRANCH_ORDER.indexOf(a) : 9) - (BRANCH_ORDER.includes(b) ? BRANCH_ORDER.indexOf(b) : 9) || a.localeCompare(b));
}

function labClass(status: string): string {
  if (/Failed/.test(status)) return " bad";
  if (/Passed/.test(status)) return " ok";
  if (status !== "NotSubmitted" && /Submitted|InProgress|Awaiting/.test(status)) return " warn";
  return "";
}

/** A METRC tag with its last six characters in bold, as her cards print it. */
function tagHtml(tag: string): string {
  const tail = tag.length > 6 ? tag.slice(-6) : tag;
  const head = tag.length > 6 ? tag.slice(0, -6) : "";
  return `<code class="wl-tag">${esc(head)}<b>${esc(tail)}</b></code>`;
}

function rowRank(row: LineagePackage): number {
  if (row.status === "Active") return 0;
  if (row.status === "Transferred") return 1;
  return 2;
}

function phrase(locale: Locale, key: string, values: Record<string, string>): string {
  let out = t(locale, key);
  for (const [name, value] of Object.entries(values)) out = out.replace(`{${name}}`, value);
  return out;
}

/** The branch head: her counts (packages, active, failed, shipped, on hand),
 * always over the whole branch. */
function branchSummary(type: string, list: readonly LineagePackage[], locale: Locale): string {
  const title = type === "WIP" ? t(locale, "WIP splits") : type;
  const active = list.filter((row) => row.status === "Active");
  const failed = active.filter((row) => /Failed/.test(row.lab_status)).length;
  const shipped = list.filter((row) => row.status === "Transferred").length;
  const stats: Array<{ text: string; failed?: boolean }> = [
    { text: phrase(locale, list.length === 1 ? "{n} package" : "{n} packages", { n: formatGrams(list.length) }) },
    { text: phrase(locale, "{n} active", { n: formatGrams(active.length) }) },
  ];
  if (failed > 0) stats.push({ text: phrase(locale, "{n} failed", { n: formatGrams(failed) }), failed: true });
  if (shipped > 0) stats.push({ text: phrase(locale, "{n} shipped", { n: formatGrams(shipped) }) });
  if (active.length > 0) {
    const onHand = Math.round(active.reduce((sum, row) => sum + row.quantity, 0) * 100) / 100;
    stats.push({ text: phrase(locale, "{qty} {uom} on hand", { qty: formatQty(onHand), uom: active[0].uom }) });
  }
  return `<summary><span class="wl-sum"><span class="wl-pill">${esc(title)}</span>${stats
    .map((stat) => ` <span class="wl-branch-stat${stat.failed ? " is-failed" : ""}">${esc(stat.text)}</span>`)
    .join("")}</span></summary>`;
}

/** The packages under a branch in her columns. Where a package sits shows only
 * when a row is still here; where it went shows only when a row shipped. */
function branchTable(list: readonly LineagePackage[], locale: Locale): string {
  const anyShipped = list.some((row) => row.status === "Transferred");
  const anyHere = list.some((row) => row.status !== "Transferred");
  const rows = [...list].sort((a, b) => rowRank(a) - rowRank(b) || b.shipped_date.localeCompare(a.shipped_date) || a.tag.localeCompare(b.tag));
  const th = (key: string, cls = "") => `<th${cls ? ` class="${cls}"` : ""}>${esc(t(locale, key))}</th>`;
  const head = [
    th("Package tag"),
    th("Status"),
    th("Quantity", "num"),
    th("Unit"),
    th("Made from"),
    anyHere ? th("Location") : "",
    th("Lab status"),
    anyHere ? th("Packaged") : "",
    anyShipped ? `${th("Shipment")}${th("Sent to")}${th("Manifest")}${th("Received")}` : "",
  ].join("");
  const body = rows
    .map((row) => {
      const state = row.status === "Active" ? "active" : row.status === "Transferred" ? "shipped" : "inactive";
      const shippedCells = anyShipped
        ? `<td>${row.transfer_type ? `<span class="wl-ship-tag${row.transfer_type === "Lab sample" ? " is-lab" : ""}">${esc(t(locale, row.transfer_type))}</span>` : ""}</td><td>${esc(row.destination)}</td><td>${esc(row.manifest)}</td><td>${esc(row.shipped_date)}</td>`
        : "";
      return `<tr class="wl-row-${state}" data-wl-tag="${esc(row.tag)}"><td>${tagHtml(row.tag)}</td><td>${esc(row.status)}</td><td class="num">${esc(formatQty(row.quantity))}</td><td>${esc(row.uom)}</td><td><code>${esc(row.source_package)}</code></td>${anyHere ? `<td>${esc(row.location)}</td>` : ""}<td><span class="wl-lab${labClass(row.lab_status)}">${esc(row.lab_status)}</span></td>${anyHere ? `<td>${esc(row.packaged_date)}</td>` : ""}${shippedCells}</tr>`;
    })
    .join("");
  return `<div class="report-scroll"><table class="data wl-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function labBlock(lab: FamilyLab, locale: Locale): string {
  const segs: Array<["passed" | "pending" | "failed" | "not_submitted", string, string]> = [
    ["passed", "{n} passed", "wl-lab-passed"],
    ["pending", "{n} pending", "wl-lab-pending"],
    ["failed", "{n} failed", "wl-lab-failed"],
    ["not_submitted", "{n} not submitted", "wl-lab-none"],
  ];
  const shown = segs.filter(([key]) => lab[key] > 0);
  const label = shown.map(([key, words]) => phrase(locale, words, { n: formatGrams(lab[key]) })).join(", ");
  return `<div class="wl-lab-row">
      <span class="wl-lab-title">${esc(t(locale, "Lab status of active packages"))}</span>
      <div class="wl-labbar" role="img" aria-label="${esc(label)}">${shown.map(([key, , cls]) => `<span class="${cls}" style="flex:${lab[key]} 1 0"></span>`).join("")}</div>
      <span class="wl-lab-counts">${shown
        .map(([key, words]) => `<span${key === "failed" ? ' class="is-failed"' : ""}>${esc(t(locale, words)).replace("{n}", `<b>${esc(formatGrams(lab[key]))}</b>`)}</span>`)
        .join(" ")}</span>
    </div>`;
}

function familyCard(card: LineageCard, filter: LineageViewFilter, locale: Locale): string {
  const root = card.root;
  const family = card.family;
  const types = branchTypes(card, filter);
  const lab = card.lab;
  const labBar = lab && lab.tested_n > 0 ? labBlock(lab, locale) : "";
  const shippedParts = [phrase(locale, family.shipped_n === 1 ? "{n} package" : "{n} packages", { n: formatGrams(family.shipped_n) })];
  if (family.shipped_lb) shippedParts.push(`${formatGrams(family.shipped_lb)} lb`);
  if (family.shipped_ea) shippedParts.push(`${formatGrams(family.shipped_ea)} ${t(locale, "pre-rolls")}`);
  const shipped =
    family.shipped_n > 0
      ? `<p class="wl-ship">${esc(t(locale, "Shipped for sale"))}: ${esc(shippedParts.join(", "))} ${esc(t(locale, "to"))} ${esc(formatGrams(family.buyers))} ${esc(t(locale, family.buyers === 1 ? "buyer" : "buyers"))}</p>`
      : "";
  const branches = types
    .map((type) => {
      const list = card.groups.get(type) ?? [];
      const rows = filter.hide ? list.filter(keepRow) : list;
      return `<details class="wl-branch" data-wl-branch="${esc(type)}"${filter.open ? " open" : ""}>
        ${branchSummary(type, list, locale)}
        ${branchTable(rows, locale)}
      </details>`;
    })
    .join("");
  const empty = types.length === 0 ? `<p class="muted">${esc(t(locale, "No packages from this harvest in the selected branches."))}</p>` : "";
  const meta = (key: string, value: string, cls = "") => `<span>${esc(t(locale, key))} <em${cls ? ` class="${cls}"` : ""}>${esc(value)}</em></span>`;
  const pounds = family.root_lb == null ? "" : `<span>${esc(formatGrams(family.root_lb))} lb</span>`;
  return `<article class="wl-fam${family.family_status === "Active" ? "" : " is-inactive"}${lab && lab.failed > 0 ? " has-failed" : ""}" data-wl-family="${esc(family.harvest)}" id="h-${esc(family.harvest)}">
    <div class="wl-root">
      <span class="wl-node">WIP</span>
      <div class="wl-root-main">
        <p class="wl-strain-row"><b>${esc(root.strain || root.item)}</b> <span class="wl-status">${esc(root.status)}</span></p>
        ${tagHtml(root.tag)}
        <p class="wl-meta">${meta("Harvest", root.source_harvest)} ${meta("Location", root.location)} ${meta("Packaged", root.packaged_date)} ${meta("Lab", root.lab_status, `wl-lab${labClass(root.lab_status)}`)}</p>
      </div>
      <div class="wl-qty"><b>${esc(formatQty(root.quantity))} ${esc(root.uom)}</b>${pounds}</div>
    </div>
    ${labBar}
    ${shipped}
    ${branches}
    ${empty}
  </article>`;
}

/** THE ZONELESS ZERO (canon 0.30.102): each grid's newest mount in farm time. */
function asOfText(asOf: LineageAsOf, locale: Locale): string {
  const part = (label: string, value: string | null) => `${label} ${value ? etWallClock(value) || value : t(locale, "not mounted")}`;
  return `${t(locale, "Data as of")} ${part(t(locale, "Active"), asOf.active)}, ${part(t(locale, "Inactive"), asOf.inactive)}, ${part(t(locale, "Transferred"), asOf.transferred)}.`;
}

/** Her takeaway line, with the counts the acceptance reads. */
function takeawayHtml(totals: WipTotals, locale: Locale): string {
  const values: Record<string, number> = {
    families: totals.families,
    active: totals.active_wips,
    inactive: totals.inactive_wips,
    traced: totals.traced_active,
    total: totals.active_finished_total,
    failed: totals.failed_families,
    shipped: totals.shipped_sale_n,
  };
  let out = esc(
    t(
      locale,
      "{families} harvests have a WIP package ({active} active WIPs, {inactive} inactive). {traced} of the {total} active BUD, PRE and SHA packages trace back to one of them. {failed} families have active packages that failed lab testing. {shipped} BUD, PRE and SHA packages have shipped for sale."
    )
  );
  for (const [name, value] of Object.entries(values)) out = out.replace(`{${name}}`, `<b data-wl-take="${name}">${esc(formatGrams(value))}</b>`);
  return `<p class="wl-takeaway" data-wl-takeaway>${out}</p>`;
}

export function wipLineageHtml(model: WipLineageModel, filter: LineageViewFilter, locale: Locale): string {
  const cards = lineageCards(model.packages, model.families, model.labs, filter);
  const totals = model.totals;
  const licenseSelect =
    model.licenses.length > 1
      ? `<label class="field">${esc(t(locale, "License"))}
          <select name="license">${model.licenses.map((value) => `<option value="${esc(value)}"${value === model.license ? " selected" : ""}>${esc(value)}</option>`).join("")}</select>
        </label>`
      : `<input type="hidden" name="license" value="${esc(model.license)}">`;
  const checked = (name: string) => (filter.types.has(name) ? true : false);
  const flag = (name: string, on: boolean, label: string) =>
    `<label class="wl-flag"><input type="checkbox" name="${esc(name)}" value="1"${on ? " checked" : ""}> ${esc(t(locale, label))}</label>`;
  const query = new URLSearchParams();
  if (filter.q) query.set("q", filter.q);
  if (filter.status !== "all") query.set("status", filter.status);
  if (filter.sort !== "newest") query.set("sort", filter.sort);
  if (filter.only) query.set("only", "1");
  if (filter.failed) query.set("failed", "1");
  if (filter.shipped) query.set("shipped", "1");
  if (filter.hide) query.set("hide", "1");
  query.set("filtered", "1");
  query.set("license", model.license);
  for (const type of filter.types) query.append("chip", type);
  const open = new URLSearchParams(query);
  open.set("open", "1");
  const shut = new URLSearchParams(query);
  shut.delete("open");
  const tile = (label: string, value: string, sub: string) =>
    `<div class="wl-kpi"><span>${esc(t(locale, label))}</span><b>${esc(value)}</b><span class="muted">${esc(sub)}</span></div>`;
  return `<div class="wl-page">
    <p class="crumb"><a href="/reports">${esc(t(locale, "Reports"))}</a></p>
    <h1>${esc(t(locale, "WIP Lineage"))}</h1>
    <p data-wl-asof>${esc(asOfText(model.asOf, locale))}</p>
    ${takeawayHtml(totals, locale)}
    <form class="wl-filters" method="get" action="/reports/wip_lineage">
      <input type="hidden" name="filtered" value="1">
      ${licenseSelect}
      <label class="field">${esc(t(locale, "Search"))} <input type="search" name="q" value="${esc(filter.q)}" placeholder="${esc(t(locale, "Strain, tag, harvest, buyer or manifest"))}"></label>
      <label class="field">${esc(t(locale, "Status"))}
        <select name="status">
          <option value="all"${filter.status === "all" ? " selected" : ""}>${esc(t(locale, "All"))}</option>
          <option value="active"${filter.status === "active" ? " selected" : ""}>${esc(t(locale, "Active"))}</option>
          <option value="inactive"${filter.status === "inactive" ? " selected" : ""}>${esc(t(locale, "Inactive"))}</option>
        </select>
      </label>
      <label class="field">${esc(t(locale, "Sort"))}
        <select name="sort">
          <option value="newest"${filter.sort === "newest" ? " selected" : ""}>${esc(t(locale, "Newest"))}</option>
          <option value="most"${filter.sort === "most" ? " selected" : ""}>${esc(t(locale, "Most packages"))}</option>
          <option value="shipped"${filter.sort === "shipped" ? " selected" : ""}>${esc(t(locale, "Shipped"))}</option>
          <option value="failed"${filter.sort === "failed" ? " selected" : ""}>${esc(t(locale, "Failed"))}</option>
          <option value="strain"${filter.sort === "strain" ? " selected" : ""}>${esc(t(locale, "Strain"))}</option>
        </select>
      </label>
      ${flag("only", filter.only, "With BUD, PRE or SHA")}
      ${flag("failed", filter.failed, "Failed lab")}
      ${flag("shipped", filter.shipped, "Shipped for sale")}
      ${flag("hide", filter.hide, "Hide finished and discontinued")}
      <span class="wl-chips">${chip("WIP", checked("WIP"), "WIP")}${chip("BUD", checked("BUD"), "BUD")}${chip("PRE", checked("PRE"), "PRE")}${chip("SHA", checked("SHA"), "SHA")}${chip("OTHER", checked("OTHER"), t(locale, "Other"))}</span>
      <button type="submit">${esc(t(locale, "Apply"))}</button>
    </form>
    <p class="wl-open"><a href="/reports/wip_lineage?${esc(open.toString())}">${esc(t(locale, "Expand all"))}</a> <a href="/reports/wip_lineage?${esc(shut.toString())}">${esc(t(locale, "Collapse all"))}</a></p>
    <section class="wl-kpis" data-wl-totals>
      ${tile("WIP families", formatGrams(totals.families), `${formatGrams(totals.active_families)} ${t(locale, "with an active WIP")}`)}
      ${tile("Active WIP packages", formatGrams(totals.active_wips), `${formatGrams(totals.active_wip_lb)} lb`)}
      <div class="wl-trio">
        ${tile("BUD packages", formatGrams(totals.bud_n), phrase(locale, "{n} active", { n: formatGrams(totals.bud_active_n) }))}
        ${tile("PRE packages", formatGrams(totals.pre_n), phrase(locale, "{n} active", { n: formatGrams(totals.pre_active_n) }))}
        ${tile("SHA packages", formatGrams(totals.sha_n), phrase(locale, "{n} active", { n: formatGrams(totals.sha_active_n) }))}
      </div>
      ${tile("Shipped for sale", formatGrams(totals.shipped_sale_n), `${formatGrams(totals.shipped_sale_lb)} lb, ${formatGrams(totals.buyers)} ${t(locale, "buyers")}`)}
      ${tile("Failed lab tests", formatGrams(totals.failed_active_n), phrase(locale, "{n} families", { n: formatGrams(totals.failed_families) }))}
    </section>
    <p class="wl-note muted">${esc(
      t(
        locale,
        "Combines the Active, Inactive and Transferred METRC exports mounted in Admin, METRC. A transferred package shows where it went: a shipment to a testing laboratory (a safety compliance license) is a lab sample, everything else a sale. Each card is one harvest: its first WIP package is the root, and every package that shares its source harvest hangs below it. WIP packages made from another WIP sit under WIP splits."
      )
    )}</p>
    <p data-wl-count>${esc(phrase(locale, cards.length === 1 ? "Showing {n} WIP family" : "Showing {n} WIP families", { n: formatGrams(cards.length) }))}</p>
    <section class="wl-families">
      ${cards.length === 0 ? `<p class="muted">${esc(t(locale, "No WIP families match these filters."))}</p>` : cards.map((card) => familyCard(card, filter, locale)).join("")}
    </section>
  </div>`;
}

export async function wipLineagePage(db: D1Database, params: URLSearchParams, locale: Locale): Promise<string> {
  const model = await loadWipLineage(db, params.get("license"));
  return wipLineageHtml(model, lineageFilterOf(params), locale);
}
