/**
 * FLOOR VS METRC (canon 0.30.415). Read only. A 24 character metrc_tag is the
 * package's own tag. A shorter tag names a harvest package and stays out.
 * Locations are shown and never flagged. Nothing here writes.
 */

import { formatGrams } from "./config";
import { etWallClock } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { formatLotToken } from "./mint";
import { TOLL_HEADING, tollCustomer } from "./toll";

export const FINDING_SAME = "Same";
export const FINDING_UNITS = "Units differ";
export const FINDING_GONE = "Gone in METRC";
export const FINDING_MISSING = "Not in METRC";
export const FINDING_LICENSE = "License differs";
export const FINDING_NO_FLOOR = "No floor package";
export const FINDING_NO_METRC = "No METRC package";
export const FINDING_VOIDED = "Lot voided on the floor";
export const NOTHING_PENDING = "nothing pending";
export const SPR_ITEM_PREFIX = "SPR - ";

const KIND_ORDER: Record<string, number> = { WIP: 0, SPR: 1, FG: 2 };

export type FloorItemInput = {
  deletedAt?: string | null;
  itemKind: string;
  tag: string | null;
  qty: number;
  uom: string;
  location: string;
  license: string;
  lot?: string;
  batchId?: string;
};

export type MirrorInput = {
  tag: string;
  quantity: number | null;
  uom: string | null;
  location: string | null;
  license: string | null;
  item?: string | null;
  sourceHarvests?: string | null;
  goneAt?: string | null;
  changedAt?: string | null;
};

export type BatchInput = {
  batchId: string;
  hbn: string;
  lot: string;
  state: string;
  harvestYear: number;
  voided: boolean;
  /** Set on a toll lot. Blank means Grip's own. */
  customer?: string | null;
};

export type SprItemInput = {
  batchId: string;
  qty: number;
  uom: string;
  location: string;
};

export type UploadInput = {
  batchId: string;
  kind: string;
  cleared: number;
  deletedAt?: string | null;
};

export type PackageRow = {
  tag: string;
  itemKind: string;
  lot: string;
  batchId: string;
  floorQty: string;
  floorUom: string;
  floorLocation: string;
  floorLicense: string;
  metrcQty: string;
  metrcUom: string;
  metrcLocation: string;
  metrcLicense: string;
  finding: string;
  pending: string;
};

export type LotRow = {
  lot: string;
  hbn: string;
  state: string;
  batchId: string;
  floorQty: string;
  floorUom: string;
  floorLocation: string;
  metrcTag: string;
  metrcQty: string;
  metrcUom: string;
  metrcLocation: string;
  finding: string;
  pending: string;
};

export type FloorModel = {
  changedAt: string | null;
  packages: PackageRow[];
  lots: LotRow[];
  tollPackages: PackageRow[];
  tollLots: LotRow[];
};

export type FloorFilter = {
  finding: string;
  itemKind: string;
  lot: string;
};

type Side = {
  present: boolean;
  qty: number | null;
  uom: string | null;
  location: string;
  tag: string;
};

/** A metrc_tag of 24 characters is the package's own tag. */
export function isPackageTag(tag: string | null | undefined): boolean {
  return String(tag ?? "").length === 24;
}

function finite(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sameUom(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = String(a ?? "").trim().toLowerCase();
  const right = String(b ?? "").trim().toLowerCase();
  return left !== "" && left === right;
}

function licensesDiffer(floor: string | null | undefined, mirror: string | null | undefined): boolean {
  return String(floor ?? "").trim() !== String(mirror ?? "").trim();
}

function withLicense(base: string, differs: boolean): string {
  return differs ? `${base}; ${FINDING_LICENSE}` : base;
}

function weightFinding(floor: number, mirror: number): string {
  const diff = Math.abs(floor - mirror);
  if (diff <= 1) return FINDING_SAME;
  return `Weight differs by ${formatGrams(diff)}`;
}

function qtyText(qty: number | null, uom: string | null): string {
  if (qty == null) return "";
  if (String(uom ?? "").trim().toLowerCase() === "g") return formatGrams(qty);
  if (Number.isInteger(qty)) return String(qty);
  return String(qty);
}

function isGone(goneAt: string | null | undefined): boolean {
  return goneAt != null && String(goneAt).trim() !== "";
}

/** Section A. Unlike units are named and never subtracted. */
export function packageFinding(
  floor: { qty: number; uom: string; license: string },
  mirror: { quantity: number | null; uom: string | null; license: string | null; goneAt?: string | null } | null
): string {
  if (!mirror) return FINDING_MISSING;
  const license = licensesDiffer(floor.license, mirror.license);
  if (isGone(mirror.goneAt)) return withLicense(FINDING_GONE, license);
  if (!sameUom(floor.uom, mirror.uom)) return withLicense(FINDING_UNITS, license);
  const floorQty = finite(floor.qty);
  const mirrorQty = finite(mirror.quantity);
  if (floorQty == null || mirrorQty == null) return withLicense("Weight differs", license);
  return withLicense(weightFinding(floorQty, mirrorQty), license);
}

/** Section B. A voided lot is named as voided and is not weighed against the mirror. */
export function lotFinding(input: { voided: boolean; floor: Side; metrc: Side }): string {
  if (input.voided) return FINDING_VOIDED;
  if (input.floor.present && !input.metrc.present) return FINDING_NO_METRC;
  if (!input.floor.present && input.metrc.present) return FINDING_NO_FLOOR;
  if (!sameUom(input.floor.uom, input.metrc.uom)) return FINDING_UNITS;
  if (input.floor.qty == null || input.metrc.qty == null) return "Weight differs";
  return weightFinding(input.floor.qty, input.metrc.qty);
}

/** Open uploads are not cleared and not deleted. Kinds stay in storage English. */
export function openUploadKinds(uploads: readonly UploadInput[], batchId: string): string {
  if (!batchId) return NOTHING_PENDING;
  const kinds = new Set<string>();
  for (const row of uploads) {
    if (row.batchId !== batchId) continue;
    if (row.deletedAt != null && String(row.deletedAt).trim() !== "") continue;
    if (Number(row.cleared) !== 0) continue;
    const kind = String(row.kind ?? "").trim();
    if (kind) kinds.add(kind);
  }
  if (kinds.size === 0) return NOTHING_PENDING;
  return [...kinds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(", ");
}

export function metrcAsOfText(changedAt: string | null | undefined, locale: Locale): string {
  const clock = changedAt ? etWallClock(changedAt) : "";
  if (!clock) return t(locale, "METRC as of");
  return tFill(locale, "METRC as of {time}", { time: clock });
}

function pendingFor(finding: string, uploads: readonly UploadInput[], batchId: string): string {
  if (finding === FINDING_SAME) return "";
  return openUploadKinds(uploads, batchId);
}

function groupSide(rows: readonly { qty: number | null; uom: string; location: string; tag?: string }[]): Side {
  if (rows.length === 0) return { present: false, qty: null, uom: null, location: "", tag: "" };
  const uoms = new Set(rows.map((row) => String(row.uom ?? "").trim().toLowerCase()).filter(Boolean));
  const locations = [...new Set(rows.map((row) => String(row.location ?? "").trim()).filter(Boolean))];
  const tags = rows.map((row) => String(row.tag ?? "").trim()).filter(Boolean);
  const qtys = rows.map((row) => finite(row.qty));
  const oneUom = uoms.size === 1;
  const qty = oneUom && qtys.every((value) => value != null) ? qtys.reduce((sum, value) => sum + (value ?? 0), 0) : null;
  return {
    present: true,
    qty,
    uom: oneUom ? rows.find((row) => String(row.uom ?? "").trim())?.uom ?? null : null,
    location: locations.join(", "),
    tag: tags.join(", "),
  };
}

function newestChangedAt(rows: readonly MirrorInput[]): string | null {
  let best: string | null = null;
  for (const row of rows) {
    const at = String(row.changedAt ?? "").trim();
    if (at && (best == null || at > best)) best = at;
  }
  return best;
}

export function buildFloorVsMetrc(input: {
  items: readonly FloorItemInput[];
  mirror: readonly MirrorInput[];
  batches: readonly BatchInput[];
  spr: readonly SprItemInput[];
  uploads: readonly UploadInput[];
  harvestYear: number;
  changedAt?: string | null;
}): FloorModel {
  const byTag = new Map<string, MirrorInput>();
  for (const row of input.mirror) byTag.set(row.tag, row);

  const tollIds = new Set(input.batches.filter((batch) => tollCustomer(batch.customer)).map((batch) => batch.batchId));
  const packages: PackageRow[] = [];
  const tollPackages: PackageRow[] = [];
  for (const item of input.items) {
    if (item.deletedAt != null && String(item.deletedAt).trim() !== "") continue;
    if (!isPackageTag(item.tag)) continue;
    const tag = String(item.tag);
    const mirror = byTag.get(tag) ?? null;
    const finding = packageFinding(
      { qty: item.qty, uom: item.uom, license: item.license },
      mirror
        ? { quantity: mirror.quantity, uom: mirror.uom, license: mirror.license, goneAt: mirror.goneAt }
        : null
    );
    const batchId = item.batchId ?? "";
    const packageRow: PackageRow = {
      tag,
      itemKind: item.itemKind,
      lot: item.lot ?? "",
      batchId,
      floorQty: qtyText(finite(item.qty), item.uom),
      floorUom: item.uom,
      floorLocation: item.location,
      floorLicense: item.license,
      metrcQty: mirror ? qtyText(finite(mirror.quantity), mirror.uom) : "",
      metrcUom: mirror?.uom ?? "",
      metrcLocation: mirror?.location ?? "",
      metrcLicense: mirror?.license ?? "",
      finding,
      pending: pendingFor(finding, input.uploads, batchId),
    };
    (tollIds.has(batchId) ? tollPackages : packages).push(packageRow);
  }
  const byTagOrder = (a: PackageRow, b: PackageRow) => {
    const kind = (KIND_ORDER[a.itemKind] ?? 9) - (KIND_ORDER[b.itemKind] ?? 9);
    if (kind !== 0) return kind;
    return a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0;
  };
  packages.sort(byTagOrder);
  tollPackages.sort(byTagOrder);

  const sprByBatch = new Map<string, SprItemInput[]>();
  for (const row of input.spr) {
    const list = sprByBatch.get(row.batchId) ?? [];
    list.push(row);
    sprByBatch.set(row.batchId, list);
  }
  const mirrorByHbn = new Map<string, MirrorInput[]>();
  for (const row of input.mirror) {
    if (isGone(row.goneAt)) continue;
    if (!String(row.item ?? "").startsWith(SPR_ITEM_PREFIX)) continue;
    const hbn = String(row.sourceHarvests ?? "");
    if (!hbn) continue;
    const list = mirrorByHbn.get(hbn) ?? [];
    list.push(row);
    mirrorByHbn.set(hbn, list);
  }

  const lots: LotRow[] = [];
  const tollLots: LotRow[] = [];
  for (const batch of input.batches) {
    const floor = groupSide(sprByBatch.get(batch.batchId) ?? []);
    const metrc = groupSide(
      (mirrorByHbn.get(batch.hbn) ?? []).map((row) => ({
        qty: finite(row.quantity),
        uom: row.uom ?? "",
        location: row.location ?? "",
        tag: row.tag,
      }))
    );
    const live = !batch.voided && batch.harvestYear === input.harvestYear && (floor.present || metrc.present);
    const voided = batch.voided && metrc.present;
    if (!live && !voided) continue;
    const finding = lotFinding({ voided: batch.voided, floor, metrc });
    (tollCustomer(batch.customer) ? tollLots : lots).push({
      lot: batch.lot,
      hbn: batch.hbn,
      state: batch.state,
      batchId: batch.batchId,
      floorQty: floor.present ? qtyText(floor.qty, floor.uom) : "",
      floorUom: floor.uom ?? "",
      floorLocation: floor.location,
      metrcTag: metrc.tag,
      metrcQty: metrc.present ? qtyText(metrc.qty, metrc.uom) : "",
      metrcUom: metrc.uom ?? "",
      metrcLocation: metrc.location,
      finding,
      pending: pendingFor(finding, input.uploads, batch.batchId),
    });
  }
  const byLot = (a: LotRow, b: LotRow) => (a.lot < b.lot ? -1 : a.lot > b.lot ? 1 : a.hbn < b.hbn ? -1 : a.hbn > b.hbn ? 1 : 0);
  lots.sort(byLot);
  tollLots.sort(byLot);

  return {
    changedAt: input.changedAt === undefined ? newestChangedAt(input.mirror) : input.changedAt,
    packages,
    lots,
    tollPackages,
    tollLots,
  };
}

export function findingMatches(finding: string, filter: string): boolean {
  const pick = filter || "differences";
  if (pick === "all") return true;
  if (pick === "differences") return finding !== FINDING_SAME;
  if (pick === "same") return finding === FINDING_SAME;
  if (pick === "weight") return finding.startsWith("Weight differs");
  if (pick === "units") return finding.startsWith(FINDING_UNITS);
  if (pick === "gone") return finding.startsWith(FINDING_GONE);
  if (pick === "missing") return finding.startsWith(FINDING_MISSING);
  if (pick === "license") return finding.includes(FINDING_LICENSE);
  if (pick === "no_floor") return finding.startsWith(FINDING_NO_FLOOR);
  if (pick === "no_metrc") return finding.startsWith(FINDING_NO_METRC);
  if (pick === "voided") return finding.startsWith(FINDING_VOIDED);
  return true;
}

function lotMatches(lot: string, filter: string): boolean {
  const want = filter.trim();
  if (!want) return true;
  return lot === want;
}

export function shownFloorVsMetrc(model: FloorModel, filter: FloorFilter): {
  packages: PackageRow[];
  lots: LotRow[];
  tollPackages: PackageRow[];
  tollLots: LotRow[];
} {
  const kind = filter.itemKind.trim();
  const keepPackage = (row: PackageRow) => {
    if (kind && row.itemKind !== kind) return false;
    if (!lotMatches(row.lot, filter.lot)) return false;
    return findingMatches(row.finding, filter.finding);
  };
  const keepLot = (row: LotRow) => lotMatches(row.lot, filter.lot) && findingMatches(row.finding, filter.finding);
  const packages = model.packages.filter(keepPackage);
  const tollPackages = (model.tollPackages ?? []).filter(keepPackage);
  const lots = kind === "WIP" || kind === "FG" ? [] : model.lots.filter(keepLot);
  const tollLots = kind === "WIP" || kind === "FG" ? [] : (model.tollLots ?? []).filter(keepLot);
  return { packages, lots, tollPackages, tollLots };
}

const COUNT_KEYS = [
  FINDING_SAME,
  "Weight differs",
  FINDING_UNITS,
  FINDING_GONE,
  FINDING_MISSING,
  FINDING_NO_FLOOR,
  FINDING_NO_METRC,
  FINDING_VOIDED,
  FINDING_LICENSE,
] as const;

export function findingCounts(findings: readonly string[]): Array<{ key: string; n: number }> {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    const base = finding.split(";")[0].trim();
    const key = base.startsWith("Weight differs") ? "Weight differs" : base;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (finding.includes(FINDING_LICENSE)) counts.set(FINDING_LICENSE, (counts.get(FINDING_LICENSE) ?? 0) + 1);
  }
  return COUNT_KEYS.filter((key) => (counts.get(key) ?? 0) > 0).map((key) => ({ key, n: counts.get(key) ?? 0 }));
}

export function findingText(locale: Locale, finding: string): string {
  const [base, extra] = finding.split(";").map((part) => part.trim());
  const baseText = base.startsWith("Weight differs by ")
    ? tFill(locale, "Weight differs by {n}", { n: base.slice("Weight differs by ".length) })
    : t(locale, base);
  if (extra === FINDING_LICENSE) return `${baseText}; ${t(locale, FINDING_LICENSE)}`;
  return baseText;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function last6(tag: string): string {
  const tags = tag.split(",").map((part) => part.trim()).filter(Boolean);
  return tags.map((part) => part.slice(-6)).join(", ");
}

function countLine(locale: Locale, findings: readonly string[]): string {
  return findingCounts(findings)
    .map((row) => `${t(locale, row.key)} ${row.n}`)
    .join(", ");
}

function tagCell(tag: string): string {
  if (!tag) return "<td></td>";
  return `<td><span class="tag-six" title="${esc(tag)}">${esc(last6(tag))}</span></td>`;
}

function packageTable(locale: Locale, rows: readonly PackageRow[]): string {
  const heads = ["Tag", "Kind", "Floor qty", "Floor uom", "Floor location", "Floor license", "METRC qty", "METRC uom", "METRC location", "METRC license", "Finding", "Pending"]
    .map((label) => `<th>${esc(t(locale, label))}</th>`)
    .join("");
  const body =
    rows.length === 0
      ? `<tr><td colspan="12">${esc(t(locale, "No rows."))}</td></tr>`
      : rows
          .map(
            (row) => `<tr data-tag="${esc(row.tag)}" data-finding="${esc(row.finding)}">
              ${tagCell(row.tag)}
              <td>${esc(row.itemKind)}</td>
              <td>${esc(row.floorQty)}</td>
              <td>${esc(row.floorUom)}</td>
              <td>${esc(row.floorLocation)}</td>
              <td>${esc(row.floorLicense)}</td>
              <td>${esc(row.metrcQty)}</td>
              <td>${esc(row.metrcUom)}</td>
              <td>${esc(row.metrcLocation)}</td>
              <td>${esc(row.metrcLicense)}</td>
              <td>${esc(findingText(locale, row.finding))}</td>
              <td>${esc(row.pending === NOTHING_PENDING ? t(locale, NOTHING_PENDING) : row.pending)}</td>
            </tr>`
          )
          .join("");
  return `<table class="data"><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table>`;
}

function lotTable(locale: Locale, rows: readonly LotRow[]): string {
  const heads = ["Lot", "HBN", "State", "Floor qty", "Floor location", "METRC tag", "METRC qty", "METRC location", "Finding", "Pending"]
    .map((label) => `<th>${esc(t(locale, label))}</th>`)
    .join("");
  const body =
    rows.length === 0
      ? `<tr><td colspan="10">${esc(t(locale, "No rows."))}</td></tr>`
      : rows
          .map(
            (row) => `<tr data-lot="${esc(row.lot)}" data-finding="${esc(row.finding)}">
              <td>${esc(row.lot)}</td>
              <td>${esc(row.hbn)}</td>
              <td>${esc(row.state)}</td>
              <td>${esc(row.floorQty)}</td>
              <td>${esc(row.floorLocation)}</td>
              ${tagCell(row.metrcTag)}
              <td>${esc(row.metrcQty)}</td>
              <td>${esc(row.metrcLocation)}</td>
              <td>${esc(findingText(locale, row.finding))}</td>
              <td>${esc(row.pending === NOTHING_PENDING ? t(locale, NOTHING_PENDING) : row.pending)}</td>
            </tr>`
          )
          .join("");
  return `<table class="data"><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table>`;
}

const FINDING_OPTIONS: Array<[string, string]> = [
  ["differences", "Differences only"],
  ["all", "All findings"],
  ["same", FINDING_SAME],
  ["weight", "Weight differs"],
  ["units", FINDING_UNITS],
  ["gone", FINDING_GONE],
  ["missing", FINDING_MISSING],
  ["license", FINDING_LICENSE],
  ["no_floor", FINDING_NO_FLOOR],
  ["no_metrc", FINDING_NO_METRC],
  ["voided", FINDING_VOIDED],
];

export function floorVsMetrcPage(input: {
  changedAt: string | null;
  packages: readonly PackageRow[];
  lots: readonly LotRow[];
  tollPackages?: readonly PackageRow[];
  tollLots?: readonly LotRow[];
  filter: FloorFilter;
  locale: Locale;
}): string {
  const finding = input.filter.finding || "differences";
  const kind = input.filter.itemKind;
  const lot = input.filter.lot;
  const findingOpts = FINDING_OPTIONS.map(
    ([value, label]) => `<option value="${value}"${finding === value ? " selected" : ""}>${esc(t(input.locale, label))}</option>`
  ).join("");
  const kindOpt = (value: string, label: string) =>
    `<option value="${value}"${kind === value ? " selected" : ""}>${esc(value ? label : t(input.locale, label))}</option>`;
  const query = new URLSearchParams();
  query.set("finding", finding);
  if (kind) query.set("item_kind", kind);
  if (lot.trim()) query.set("lot", lot.trim());
  const csv = `/reports/floor_vs_metrc?${query.toString()}&format=csv`;
  const packageCounts = countLine(input.locale, input.packages.map((row) => row.finding));
  const lotCounts = countLine(input.locale, input.lots.map((row) => row.finding));
  return `<div class="floor-metrc" data-floor-metrc="1">
    <h1>${esc(t(input.locale, "Floor vs METRC"))}</h1>
    <p class="report-window" data-metrc-as-of="${esc(input.changedAt ? etWallClock(input.changedAt) : "")}">${esc(metrcAsOfText(input.changedAt, input.locale))}</p>
    <form class="stack report-filters" method="get" action="/reports/floor_vs_metrc">
      <label class="field">${esc(t(input.locale, "Finding"))} <select name="finding">${findingOpts}</select></label>
      <label class="field">${esc(t(input.locale, "Kind"))} <select name="item_kind">${kindOpt("", "All")}${kindOpt("WIP", "WIP")}${kindOpt("FG", "FG")}${kindOpt("SPR", "SPR")}</select></label>
      <label class="field">${esc(t(input.locale, "Lot last 5"))} <input type="text" name="lot" value="${esc(lot)}"></label>
      <button type="submit">${esc(t(input.locale, "Apply filters"))}</button>
    </form>
    <p class="format-bar"><a class="btn secondary" href="${esc(csv)}">${esc(t(input.locale, "CSV (standard)"))}</a></p>
    <h2>${esc(t(input.locale, "Packages by tag"))}</h2>
    <p class="floor-metrc-counts" data-section="packages">${esc(packageCounts)}</p>
    <div class="report-scroll">${packageTable(input.locale, input.packages)}</div>
    <h2>${esc(t(input.locale, "Lot packages"))}</h2>
    <p class="floor-metrc-counts" data-section="lots">${esc(lotCounts)}</p>
    <div class="report-scroll">${lotTable(input.locale, input.lots)}</div>
    ${tollSection(input.locale, input.tollPackages ?? [], input.tollLots ?? [])}
  </div>`;
}

function tollSection(locale: Locale, packages: readonly PackageRow[], lots: readonly LotRow[]): string {
  if (packages.length === 0 && lots.length === 0) return "";
  const packagesHtml =
    packages.length === 0
      ? ""
      : `<h3>${esc(t(locale, "Packages by tag"))}</h3><div class="report-scroll">${packageTable(locale, packages)}</div>`;
  const lotsHtml = lots.length === 0 ? "" : `<div class="report-scroll">${lotTable(locale, lots)}</div>`;
  return `<h2 data-floor-toll="1">${esc(t(locale, TOLL_HEADING))}</h2>${packagesHtml}${lotsHtml}`;
}

const CSV_HEAD = [
  "Section",
  "Tag",
  "Kind",
  "Lot",
  "HBN",
  "State",
  "Floor qty",
  "Floor uom",
  "Floor location",
  "Floor license",
  "METRC tag",
  "METRC qty",
  "METRC uom",
  "METRC location",
  "METRC license",
  "Finding",
  "Pending",
];

export function floorVsMetrcCsv(
  shown: {
    packages: readonly PackageRow[];
    lots: readonly LotRow[];
    tollPackages?: readonly PackageRow[];
    tollLots?: readonly LotRow[];
  },
  changedAt: string | null
): string {
  const lines = [csvCell(metrcAsOfText(changedAt, "en")), CSV_HEAD.join(",")];
  for (const row of shown.packages) {
    lines.push(
      [
        "Packages by tag",
        row.tag,
        row.itemKind,
        row.lot,
        "",
        "",
        row.floorQty,
        row.floorUom,
        row.floorLocation,
        row.floorLicense,
        row.finding === FINDING_MISSING ? "" : row.tag,
        row.metrcQty,
        row.metrcUom,
        row.metrcLocation,
        row.metrcLicense,
        row.finding,
        row.pending,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  for (const row of shown.lots) {
    lines.push(
      [
        "Lot packages",
        "",
        "SPR",
        row.lot,
        row.hbn,
        row.state,
        row.floorQty,
        row.floorUom,
        row.floorLocation,
        "",
        row.metrcTag,
        row.metrcQty,
        row.metrcUom,
        row.metrcLocation,
        "",
        row.finding,
        row.pending,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  for (const row of shown.tollPackages ?? []) {
    lines.push(
      [
        TOLL_HEADING,
        row.tag,
        row.itemKind,
        row.lot,
        "",
        "",
        row.floorQty,
        row.floorUom,
        row.floorLocation,
        row.floorLicense,
        row.finding === FINDING_MISSING ? "" : row.tag,
        row.metrcQty,
        row.metrcUom,
        row.metrcLocation,
        row.metrcLicense,
        row.finding,
        row.pending,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  for (const row of shown.tollLots ?? []) {
    lines.push(
      [
        TOLL_HEADING,
        "",
        "SPR",
        row.lot,
        row.hbn,
        row.state,
        row.floorQty,
        row.floorUom,
        row.floorLocation,
        "",
        row.metrcTag,
        row.metrcQty,
        row.metrcUom,
        row.metrcLocation,
        "",
        row.finding,
        row.pending,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

function lotToken(year: number, serial: number): string {
  if (!Number.isInteger(Number(serial)) || Number(serial) < 1) return "";
  return formatLotToken(Number(year), Number(serial)).slice(-5);
}

type BatchSql = { id: string; hbn: string; lot_serial: number; harvest_year: number; deleted_at: string | null; customer: string | null };
type LotSql = { harvest_batch_id: string; status: string; deleted_at: string | null };
type ItemSql = {
  item_kind: string;
  qty: number;
  uom: string;
  location: string;
  license_value: string;
  metrc_tag: string | null;
  harvest_batch_id: string | null;
  lot_batch_id: string | null;
  deleted_at?: string | null;
};
type MirrorSql = {
  tag: string;
  quantity: number | null;
  uom: string | null;
  location: string | null;
  license_value: string | null;
  item: string | null;
  source_harvests: string | null;
  gone_at: string | null;
  changed_at: string | null;
};
type UploadSql = { kind: string; harvest_batch_id: string; cleared: number; deleted_at: string | null };

export async function loadFloorVsMetrc(db: D1Database, harvestYear: number): Promise<FloorModel> {
  const [fresh, batches, lotRows, packageItems, sprItems, mirror, uploads] = await Promise.all([
    db.prepare(`SELECT MAX(changed_at) AS changed_at FROM metrc_packages`).first<{ changed_at: string | null }>(),
    db
      .prepare(`SELECT id, hbn, lot_serial, harvest_year, deleted_at, customer FROM harvest_batches`)
      .all<BatchSql>(),
    db
      .prepare(`SELECT harvest_batch_id, status, deleted_at FROM wet_weight_entries`)
      .all<LotSql>(),
    db
      .prepare(
        `SELECT i.item_kind, i.qty, i.uom, i.location, i.license_value, i.metrc_tag, i.harvest_batch_id,
                w.harvest_batch_id AS lot_batch_id
         FROM local_inventory_items i
         LEFT JOIN wet_weight_entries w ON w.id = i.wet_weight_entry_id
         WHERE i.deleted_at IS NULL AND i.metrc_tag IS NOT NULL AND length(i.metrc_tag) = 24`
      )
      .all<ItemSql>(),
    db
      .prepare(
        `SELECT i.qty, i.uom, i.location, i.harvest_batch_id, w.harvest_batch_id AS lot_batch_id
         FROM local_inventory_items i
         LEFT JOIN wet_weight_entries w ON w.id = i.wet_weight_entry_id
         WHERE i.deleted_at IS NULL AND i.item_kind = 'SPR'`
      )
      .all<ItemSql>(),
    db
      .prepare(
        `SELECT tag, quantity, uom, location, license_value, item, source_harvests, gone_at, changed_at
         FROM metrc_packages
         WHERE tag IN (
           SELECT metrc_tag FROM local_inventory_items
           WHERE deleted_at IS NULL AND metrc_tag IS NOT NULL AND length(metrc_tag) = 24
         )
         OR item LIKE 'SPR - %'`
      )
      .all<MirrorSql>(),
    db.prepare(`SELECT kind, harvest_batch_id, cleared, deleted_at FROM metrc_uploads`).all<UploadSql>(),
  ]);

  const batchById = new Map<string, BatchSql>();
  for (const row of batches.results ?? []) batchById.set(row.id, row);
  const states = new Map<string, Set<string>>();
  for (const row of lotRows.results ?? []) {
    if (row.deleted_at != null && String(row.deleted_at).trim() !== "") continue;
    const set = states.get(row.harvest_batch_id) ?? new Set<string>();
    if (row.status) set.add(String(row.status));
    states.set(row.harvest_batch_id, set);
  }
  const tokenOf = (batchId: string | null): { lot: string; batchId: string } => {
    if (!batchId) return { lot: "", batchId: "" };
    const batch = batchById.get(batchId);
    if (!batch) return { lot: "", batchId };
    return { lot: lotToken(Number(batch.harvest_year), Number(batch.lot_serial)), batchId };
  };

  return buildFloorVsMetrc({
    changedAt: fresh?.changed_at ?? null,
    harvestYear,
    items: (packageItems.results ?? []).map((row) => {
      const linked = tokenOf(row.lot_batch_id || row.harvest_batch_id);
      return {
        itemKind: row.item_kind,
        tag: row.metrc_tag,
        qty: Number(row.qty),
        uom: row.uom,
        location: row.location,
        license: row.license_value,
        lot: linked.lot,
        batchId: linked.batchId,
      };
    }),
    spr: (sprItems.results ?? []).flatMap((row) => {
      const batchId = row.lot_batch_id || row.harvest_batch_id;
      if (!batchId) return [];
      return [{ batchId, qty: Number(row.qty), uom: row.uom, location: row.location }];
    }),
    batches: (batches.results ?? []).map((row) => ({
      batchId: row.id,
      hbn: row.hbn,
      lot: lotToken(Number(row.harvest_year), Number(row.lot_serial)),
      state: [...(states.get(row.id) ?? [])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(", "),
      harvestYear: Number(row.harvest_year),
      voided: row.deleted_at != null && String(row.deleted_at).trim() !== "",
      customer: row.customer,
    })),
    mirror: (mirror.results ?? []).map((row) => ({
      tag: row.tag,
      quantity: finite(row.quantity),
      uom: row.uom,
      location: row.location,
      license: row.license_value,
      item: row.item,
      sourceHarvests: row.source_harvests,
      goneAt: row.gone_at,
      changedAt: row.changed_at,
    })),
    uploads: (uploads.results ?? []).map((row) => ({
      batchId: row.harvest_batch_id,
      kind: row.kind,
      cleared: Number(row.cleared),
      deletedAt: row.deleted_at,
    })),
  });
}
