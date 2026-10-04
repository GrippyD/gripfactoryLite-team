/**
 * L2 CONNECTIONS AND CUSTOM LABEL DATA (canon 0.30.386).
 * A label binds to named fields. Each field resolves from a package tag and
 * says which route answered. Custom tables fill beside the catalog.
 */

import { dateFromYyddd } from "./mint";
import { harvestTokens } from "./metrc";
import { t, type Locale } from "./i18n";
import { esc } from "./ui";

export const LABEL_GROUPS = ["package", "harvest", "test", "company"] as const;
export type LabelGroup = (typeof LABEL_GROUPS)[number];

export const LABEL_FIELD_KEYS = [
  "package_tag",
  "item",
  "category",
  "strain",
  "net_weight",
  "packaged_date",
  "license",
  "facility_name",
  "harvest_name",
  "harvest_date",
  "hbn",
  "hbn_last_five",
  "thc_percent",
  "test_date",
  "lab",
  "lab_test_status",
  "production_batch",
  "location",
] as const;
export type LabelFieldKey = (typeof LABEL_FIELD_KEYS)[number];
export type LabelFieldType = "text" | "number" | "date" | "percent";

export const KEY_FIELDS = ["strain", "item", "category", "harvest_name"] as const;
export type LabelKeyField = (typeof KEY_FIELDS)[number];

const FIELD_GROUP: Record<LabelFieldKey, LabelGroup> = {
  package_tag: "package",
  item: "package",
  category: "package",
  strain: "package",
  net_weight: "package",
  packaged_date: "package",
  production_batch: "package",
  location: "package",
  lab_test_status: "package",
  harvest_name: "harvest",
  harvest_date: "harvest",
  hbn: "harvest",
  hbn_last_five: "harvest",
  thc_percent: "test",
  test_date: "test",
  lab: "test",
  license: "company",
  facility_name: "company",
};

const FIELD_TYPE: Record<LabelFieldKey, LabelFieldType> = {
  package_tag: "text",
  item: "text",
  category: "text",
  strain: "text",
  net_weight: "text",
  packaged_date: "date",
  license: "text",
  facility_name: "text",
  harvest_name: "text",
  harvest_date: "date",
  hbn: "text",
  hbn_last_five: "text",
  thc_percent: "percent",
  test_date: "date",
  lab: "text",
  lab_test_status: "text",
  production_batch: "text",
  location: "text",
};

const FIELD_WORDS: Record<LabelFieldKey, string> = {
  package_tag: "Package tag",
  item: "Item",
  category: "Category",
  strain: "Strain",
  net_weight: "Net weight",
  packaged_date: "Packaged date",
  license: "License",
  facility_name: "Facility name",
  harvest_name: "Harvest name",
  harvest_date: "Harvest date",
  hbn: "HBN",
  hbn_last_five: "HBN last five",
  thc_percent: "THC percent",
  test_date: "Test date",
  lab: "Lab",
  lab_test_status: "Lab test status",
  production_batch: "Production batch",
  location: "Location",
};

const GROUP_WORDS: Record<LabelGroup, string> = {
  package: "Package",
  harvest: "Harvest",
  test: "Test",
  company: "Company",
};

export const HARVEST_LINEAGE_CAP = 6;
export const NO_POTENCY_ROUTE = "no passed compliance potency";

export type Resolved = { value: string; route: string };

export type MirrorPackage = {
  tag: string;
  license_value: string | null;
  source_harvests: string | null;
  source_packages: string | null;
  original_source_label: string | null;
  item: string | null;
  category: string | null;
  item_strain: string | null;
  quantity: number | null;
  uom: string | null;
  packaged_date: string | null;
  production_batch: string | null;
  lab_test_status: string | null;
  location: string | null;
  gone_at: string | null;
};

export type LocalPackage = {
  metrc_tag: string;
  harvest_batch_id: string | null;
  qty: number | null;
  uom: string | null;
  license_value: string | null;
  location: string | null;
  farm_code: string | null;
  item_kind: string | null;
  deleted_at?: string | null;
};

export type HarvestRow = {
  id: string;
  entry_date: string;
  hbn: string;
  market_strain: string | null;
  strain_name: string | null;
  metrc_harvest_tag: string | null;
  farm_code: string | null;
  farm_name: string | null;
};

export type ComplianceSample = {
  source_metrc_tag: string;
  sample_tag: string | null;
  harvest_batch: string | null;
  thc_potency_pct: number | null;
  status: string;
  program: string;
  voided_at: string | null;
  finished_testing_on: string | null;
  testing_facility: string | null;
  changed_at: string;
};

export type LabelFacts = {
  packages: MirrorPackage[];
  locals: LocalPackage[];
  harvests: HarvestRow[];
  samples: ComplianceSample[];
};

export type DataColumn = { key: string; label: string; type: LabelFieldType };
export type DataTable = {
  id: string;
  name: string;
  mode: "static" | "keyed";
  key_field: LabelKeyField | null;
  columns: DataColumn[];
  rows: string[][];
};

const PASSED = new Set(["passed", "retest_passed"]);

function up(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function blank(): Resolved {
  return { value: "", route: "" };
}

function hit(value: string, route: string): Resolved {
  return { value, route };
}

export function fieldWords(key: LabelFieldKey): string {
  return FIELD_WORDS[key];
}

export function fieldGroup(key: LabelFieldKey): LabelGroup {
  return FIELD_GROUP[key];
}

export function fieldType(key: LabelFieldKey): LabelFieldType {
  return FIELD_TYPE[key];
}

export function isFieldKey(raw: string): raw is LabelFieldKey {
  return (LABEL_FIELD_KEYS as readonly string[]).includes(raw);
}

export function isKeyField(raw: string): raw is LabelKeyField {
  return (KEY_FIELDS as readonly string[]).includes(raw);
}

export function dataToken(tableId: string, columnKey: string): string {
  return `{d:${tableId}:${columnKey}}`;
}

export function bindText(raw: string, fills: Record<string, string>): string {
  return raw.replace(/\{([A-Za-z0-9_:-]+)\}/g, (all, key: string) => (Object.prototype.hasOwnProperty.call(fills, key) ? fills[key] : all));
}

type FactIndex = {
  pkg: Map<string, MirrorPackage>;
  local: Map<string, LocalPackage>;
  harvestId: Map<string, HarvestRow>;
  harvestToken: Map<string, HarvestRow>;
  sampleTag: Map<string, ComplianceSample[]>;
  sampleHarvest: Map<string, ComplianceSample[]>;
};

const FACT_INDEX = new WeakMap<LabelFacts, FactIndex>();

function factIndex(facts: LabelFacts): FactIndex {
  const cached = FACT_INDEX.get(facts);
  if (cached) return cached;
  const pkg = new Map<string, MirrorPackage>();
  for (const row of facts.packages) pkg.set(up(row.tag), row);
  const local = new Map<string, LocalPackage>();
  for (const row of facts.locals) {
    const key = up(row.metrc_tag);
    const prior = local.get(key);
    const live = !row.deleted_at;
    if (!prior) local.set(key, row);
    else if (prior.deleted_at && live) local.set(key, row);
    else if (!prior.harvest_batch_id && row.harvest_batch_id && (live || prior.deleted_at)) local.set(key, row);
  }
  const harvestId = new Map<string, HarvestRow>();
  const harvestToken = new Map<string, HarvestRow>();
  for (const row of facts.harvests) {
    harvestId.set(row.id, row);
    if (row.hbn) harvestToken.set(up(row.hbn), row);
    if (row.metrc_harvest_tag) harvestToken.set(up(row.metrc_harvest_tag), row);
  }
  const sampleTag = new Map<string, ComplianceSample[]>();
  const sampleHarvest = new Map<string, ComplianceSample[]>();
  const push = (map: Map<string, ComplianceSample[]>, key: string, row: ComplianceSample) => {
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  };
  for (const row of facts.samples) {
    if (row.source_metrc_tag) push(sampleTag, up(row.source_metrc_tag), row);
    if (row.sample_tag) push(sampleTag, up(row.sample_tag), row);
    if (row.harvest_batch) push(sampleHarvest, up(row.harvest_batch), row);
  }
  const built = { pkg, local, harvestId, harvestToken, sampleTag, sampleHarvest };
  FACT_INDEX.set(facts, built);
  return built;
}

function packageOf(facts: LabelFacts, tag: string): MirrorPackage | null {
  return factIndex(facts).pkg.get(up(tag)) ?? null;
}

function localOf(facts: LabelFacts, tag: string): LocalPackage | null {
  return factIndex(facts).local.get(up(tag)) ?? null;
}

function harvestOfId(facts: LabelFacts, id: string | null): HarvestRow | null {
  if (!id) return null;
  return factIndex(facts).harvestId.get(id) ?? null;
}

function harvestByToken(facts: LabelFacts, token: string): HarvestRow | null {
  const want = up(token);
  if (!want) return null;
  return factIndex(facts).harvestToken.get(want) ?? null;
}

/** THE L2 GATE (canon 0.30.389): the date a METRC harvest name carries in its first segment. Only a harvest name
 * (it has dashes) is read; a bare token such as 24089 is a lot token (YY###), never a day. The 2026 names read the first
 * segment as two digits of year and three of day of year (26267 is 2026-09-24); the 2025 names carry a spreadsheet day
 * number there (45922 is 2025-09-22, days from 1899-12-30). When the name ends in a lot token (YY###), the date must
 * fall in that lot's year or the year before; a year past 2039 is never read as YYDDD. */
export function codedHarvestDate(name: string): string | null {
  const parts = String(name ?? "").trim().split("-").map((part) => part.trim());
  if (parts.length < 2) return null;
  const first = parts[0];
  if (!/^\d{5}$/.test(first)) return null;
  const last = parts[parts.length - 1];
  const lotYear = parts.length >= 3 && /^\d{5}$/.test(last) ? 2000 + Number(last.slice(0, 2)) : null;
  const fits = (day: string) => lotYear == null || [lotYear, lotYear - 1].includes(Number(day.slice(0, 4)));
  const yyddd = Number(first.slice(0, 2)) <= 39 ? dateFromYyddd(first) : null;
  if (yyddd && fits(yyddd)) return yyddd;
  const serial = Number(first);
  if (lotYear != null && serial >= 40000 && serial <= 60000) {
    const day = new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
    if (fits(day)) return day;
  }
  return null;
}

function earliest(dates: string[]): string {
  return [...dates].sort()[0] ?? "";
}

type DateHit = { value: string; route: string };

function datesOn(facts: LabelFacts, pkg: MirrorPackage | null, local: LocalPackage | null): DateHit | null {
  const own = harvestOfId(facts, local?.harvest_batch_id ?? null);
  if (own?.entry_date) return { value: own.entry_date.slice(0, 10), route: "the app's harvest" };
  const names = harvestTokens(pkg?.source_harvests);
  const matched = names
    .map((name) => harvestByToken(facts, name))
    .filter((row): row is HarvestRow => Boolean(row?.entry_date));
  if (matched.length === 1) return { value: matched[0].entry_date.slice(0, 10), route: "a matched source harvest" };
  if (matched.length > 1) {
    return { value: earliest(matched.map((row) => row.entry_date.slice(0, 10))), route: "the earliest of several harvests" };
  }
  const coded = names.map((name) => codedHarvestDate(name)).filter((day): day is string => Boolean(day));
  if (coded.length === 1) return { value: coded[0], route: "the date coded in the harvest name" };
  if (coded.length > 1) return { value: earliest(coded), route: "the earliest of several harvests" };
  return null;
}

function ancestors(pkg: MirrorPackage | null): string[] {
  if (!pkg) return [];
  const next: string[] = [];
  const original = up(pkg.original_source_label);
  if (original) next.push(original);
  for (const tag of harvestTokens(pkg.source_packages)) {
    const id = up(tag);
    if (id && !next.includes(id)) next.push(id);
  }
  return next;
}

/** Harvest date for a package tag. The first route that answers wins, then the lineage, at most six steps, never a loop. */
export function harvestDateOf(facts: LabelFacts, tag: string): Resolved {
  const seen = new Set<string>();
  let queue = [up(tag)];
  let hops = 0;
  while (queue.length > 0) {
    const nextQueue: string[] = [];
    for (const current of queue) {
      if (!current || seen.has(current)) continue;
      seen.add(current);
      const found = datesOn(facts, packageOf(facts, current), localOf(facts, current));
      if (found) {
        const route = hops === 0 ? found.route : `through the lineage, ${found.route}`;
        return hit(found.value, route);
      }
      if (hops >= HARVEST_LINEAGE_CAP) continue;
      nextQueue.push(...ancestors(packageOf(facts, current)));
    }
    hops += 1;
    queue = nextQueue;
  }
  return blank();
}

function passedSamples(rows: ComplianceSample[]): ComplianceSample[] {
  return rows
    .filter((row) => row.program === "compliance" && !row.voided_at && PASSED.has(row.status))
    .sort((a, b) => String(b.finished_testing_on ?? "").localeCompare(String(a.finished_testing_on ?? "")) || String(b.changed_at).localeCompare(String(a.changed_at)));
}

function withPotency(rows: ComplianceSample[]): ComplianceSample[] {
  return rows.filter((row) => row.thc_potency_pct != null && Number.isFinite(Number(row.thc_potency_pct)));
}

function potencyOf(rows: ComplianceSample[], route: string): Resolved | null {
  const ready = withPotency(rows);
  if (ready.length === 0) return null;
  const sample = ready[0];
  return hit(String(sample.thc_potency_pct), route);
}

function harvestIdentity(facts: LabelFacts, tag: string): HarvestRow | null {
  const local = localOf(facts, tag);
  const own = harvestOfId(facts, local?.harvest_batch_id ?? null);
  if (own) return own;
  const pkg = packageOf(facts, tag);
  for (const name of harvestTokens(pkg?.source_harvests)) {
    const found = harvestByToken(facts, name);
    if (found) return found;
  }
  return null;
}

/** THC percent from a passed compliance sample. Internal readings are never read. */
export function thcOf(facts: LabelFacts, tag: string): Resolved {
  const own = potencyOf(passedSamples(factIndex(facts).sampleTag.get(up(tag)) ?? []), "the package's own passed sample");
  if (own) return own;
  const seen = new Set<string>([up(tag)]);
  let queue = ancestors(packageOf(facts, up(tag)));
  let hops = 0;
  while (queue.length > 0 && hops < HARVEST_LINEAGE_CAP) {
    const nextQueue: string[] = [];
    for (const current of queue) {
      if (!current || seen.has(current)) continue;
      seen.add(current);
      const found = potencyOf(passedSamples(factIndex(facts).sampleTag.get(current) ?? []), "a passed sample on the lineage");
      if (found) return found;
      nextQueue.push(...ancestors(packageOf(facts, current)));
    }
    hops += 1;
    queue = nextQueue;
  }
  const harvest = harvestIdentity(facts, tag);
  if (harvest) {
    const onHarvest = withPotency(passedSamples(factIndex(facts).sampleHarvest.get(up(harvest.hbn)) ?? []));
    const distinct = new Set(onHarvest.map((row) => String(row.thc_potency_pct)));
    if (onHarvest.length === 1) return hit(String(onHarvest[0].thc_potency_pct), "the harvest's one passed potency");
    if (distinct.size > 1) return blank();
  }
  return { value: "", route: NO_POTENCY_ROUTE };
}

function sampleUsed(facts: LabelFacts, tag: string): ComplianceSample | null {
  const resolved = thcOf(facts, tag);
  if (!resolved.value) return null;
  const rows = withPotency(
    facts.samples.filter((row) => row.program === "compliance" && !row.voided_at && PASSED.has(row.status) && String(row.thc_potency_pct) === resolved.value)
  );
  return rows[0] ?? null;
}

function weight(qty: number | null, uom: string | null, whole: boolean): string {
  if (qty == null || !Number.isFinite(Number(qty))) return "";
  const n = whole ? Math.round(Number(qty)) : Number(qty);
  const unit = String(uom ?? "").trim();
  return unit ? `${n} ${unit}` : String(n);
}

function harvestName(facts: LabelFacts, tag: string): string {
  const harvest = harvestIdentity(facts, tag);
  if (harvest) return harvest.hbn;
  const names = harvestTokens(packageOf(facts, tag)?.source_harvests);
  return names[0] ?? "";
}

export function resolveField(facts: LabelFacts, tag: string, key: LabelFieldKey): Resolved {
  const pkg = packageOf(facts, tag);
  const local = localOf(facts, tag);
  const harvest = harvestIdentity(facts, tag);
  if (key === "package_tag") return tag ? hit(up(tag), "the package tag") : blank();
  if (key === "item") {
    if (pkg?.item) return hit(pkg.item, "METRC's item");
    if (local?.item_kind) return hit(local.item_kind, "the app's item");
    return blank();
  }
  if (key === "category") return pkg?.category ? hit(pkg.category, "METRC's category") : blank();
  if (key === "strain") {
    const market = String(harvest?.market_strain ?? "").trim() || String(harvest?.strain_name ?? "").trim();
    if (market) return hit(market, "the market strain");
    if (pkg?.item_strain) return hit(pkg.item_strain, "METRC's item strain");
    return blank();
  }
  if (key === "net_weight") {
    if (local) {
      const text = weight(local.qty, local.uom, true);
      return text ? hit(text, "the app's package") : blank();
    }
    const text = weight(pkg?.quantity ?? null, pkg?.uom ?? null, false);
    return text ? hit(text, "METRC's quantity") : blank();
  }
  if (key === "packaged_date") {
    const day = String(pkg?.packaged_date ?? "").slice(0, 10);
    return day ? hit(day, "METRC's packaged date") : blank();
  }
  if (key === "license") {
    const value = pkg?.license_value || local?.license_value || "";
    return value ? hit(value, "the license") : blank();
  }
  if (key === "facility_name") {
    if (harvest?.farm_name) return hit(harvest.farm_name, "the farm");
    if (local?.farm_code) return hit(local.farm_code, "the farm code");
    return blank();
  }
  if (key === "harvest_name") {
    const name = harvestName(facts, tag);
    return name ? hit(name, "the harvest name") : blank();
  }
  if (key === "harvest_date") return harvestDateOf(facts, tag);
  if (key === "hbn") return harvest?.hbn ? hit(harvest.hbn, "the app's harvest") : blank();
  if (key === "hbn_last_five") {
    const hbn = harvest?.hbn ?? "";
    return hbn ? hit(hbn.slice(-5), "the app's harvest") : blank();
  }
  if (key === "thc_percent") return thcOf(facts, tag);
  if (key === "test_date") {
    const sample = sampleUsed(facts, tag);
    const day = String(sample?.finished_testing_on ?? "").slice(0, 10);
    return day ? hit(day, thcOf(facts, tag).route) : blank();
  }
  if (key === "lab") {
    const sample = sampleUsed(facts, tag);
    return sample?.testing_facility ? hit(sample.testing_facility, thcOf(facts, tag).route) : blank();
  }
  if (key === "lab_test_status") return pkg?.lab_test_status ? hit(pkg.lab_test_status, "METRC's lab status") : blank();
  if (key === "production_batch") return pkg?.production_batch ? hit(pkg.production_batch, "METRC's production batch") : blank();
  if (key === "location") {
    if (pkg?.location) return hit(pkg.location, "METRC's location");
    if (local?.location) return hit(local.location, "the app's location");
    return blank();
  }
  return blank();
}

export function resolveAll(facts: LabelFacts, tag: string): Record<LabelFieldKey, Resolved> {
  const out = {} as Record<LabelFieldKey, Resolved>;
  for (const key of LABEL_FIELD_KEYS) out[key] = resolveField(facts, tag, key);
  return out;
}

export function nameFills(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of LABEL_FIELD_KEYS) out[key] = FIELD_WORDS[key];
  return out;
}

export function valueFills(facts: LabelFacts, tag: string, tables: DataTable[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of LABEL_FIELD_KEYS) out[key] = resolveField(facts, tag, key).value;
  for (const table of tables) {
    const filled = fillTable(facts, tag, table);
    for (const column of table.columns) out[`d:${table.id}:${column.key}`] = filled.values[column.key] ?? "";
  }
  return out;
}

export function routeMap(facts: LabelFacts, tag: string, tables: DataTable[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of LABEL_FIELD_KEYS) out[key] = resolveField(facts, tag, key).route;
  for (const table of tables) {
    const filled = fillTable(facts, tag, table);
    for (const column of table.columns) out[`d:${table.id}:${column.key}`] = filled.route;
  }
  return out;
}

export function fillTable(facts: LabelFacts, tag: string, table: DataTable): { values: Record<string, string>; route: string } {
  const values: Record<string, string> = {};
  for (const column of table.columns) values[column.key] = "";
  if (table.rows.length === 0) return { values, route: "no matching row" };
  if (table.mode === "static") {
    writeRow(table, table.rows[0], values);
    return { values, route: "the table's first row" };
  }
  const key = table.key_field ? resolveField(facts, tag, table.key_field).value : "";
  const row = table.rows.find((cells) => String(cells[0] ?? "").trim().toLowerCase() === key.trim().toLowerCase());
  if (!row || !key) return { values, route: "no matching row" };
  writeRow(table, row, values);
  return { values, route: "the keyed row" };
}

function writeRow(table: DataTable, cells: string[], values: Record<string, string>) {
  table.columns.forEach((column, index) => {
    values[column.key] = String(cells[index] ?? "");
  });
}

export type Coverage = {
  live: number;
  harvest: Record<string, number>;
  thc: Record<string, number>;
  neither: number;
};

/** Live mirror packages (gone_at empty): harvest date and THC by the route that answered, and how many resolve neither. */
export function coverageOf(facts: LabelFacts): Coverage {
  const harvest: Record<string, number> = {};
  const thc: Record<string, number> = {};
  let neither = 0;
  const live = facts.packages.filter((row) => !row.gone_at);
  for (const row of live) {
    const date = harvestDateOf(facts, row.tag);
    const potency = thcOf(facts, row.tag);
    if (date.route) harvest[date.route] = (harvest[date.route] ?? 0) + 1;
    const thcRoute = potency.value ? potency.route : NO_POTENCY_ROUTE;
    thc[thcRoute] = (thc[thcRoute] ?? 0) + 1;
    if (!date.value && !potency.value) neither += 1;
  }
  return { live: live.length, harvest, thc, neither };
}

export function parseColumns(raw: unknown): DataColumn[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) throw new Error("A table needs 1 to 12 columns.");
  return raw.map((item, index) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const type = row.type === "number" || row.type === "date" || row.type === "percent" ? row.type : "text";
    const label = String(row.label ?? "").trim().slice(0, 80);
    if (!label) throw new Error("Each column needs a label.");
    const key = /^c\d+$/.test(String(row.key ?? "")) ? String(row.key) : `c${index}`;
    return { key, label, type };
  });
}

export function parseRows(raw: unknown, columns: number): string[][] {
  if (!Array.isArray(raw)) throw new Error("The table could not be read.");
  if (raw.length > 40) throw new Error("A table holds at most 40 rows.");
  return raw.map((item) => {
    const cells = Array.isArray(item) ? item : [];
    return Array.from({ length: columns }, (_, index) => String(cells[index] ?? "").slice(0, 200));
  });
}

export function parseDataTable(row: Record<string, unknown>): DataTable {
  const columns = parseColumns(JSON.parse(String(row.columns_json ?? "[]")));
  const rows = parseRows(JSON.parse(String(row.rows_json ?? "[]")), columns.length);
  const mode = row.mode === "keyed" ? "keyed" : "static";
  const key = isKeyField(String(row.key_field ?? "")) ? (String(row.key_field) as LabelKeyField) : null;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    mode,
    key_field: mode === "keyed" ? key : null,
    columns,
    rows,
  };
}

export type DataTableView = {
  id: string;
  name: string;
  mode: string;
  key_field: string;
  columns_json: string;
  rows_json: string;
  updated_at: string;
};

export function labelDataPage(locale: Locale, tables: DataTableView[], editing: DataTable | null): string {
  const rows =
    tables.length === 0
      ? `<p class="muted">${esc(t(locale, "No tables yet."))}</p>`
      : `<table class="data"><thead><tr><th>${esc(t(locale, "Name"))}</th><th>${esc(t(locale, "Size"))}</th><th>${esc(t(locale, "Last saved"))}</th><th></th></tr></thead><tbody>${tables
          .map((row) => {
            let size = "";
            try {
              const cols = JSON.parse(row.columns_json) as unknown[];
              const body = JSON.parse(row.rows_json) as unknown[];
              size = `${body.length} x ${cols.length}`;
            } catch {
              size = "";
            }
            return `<tr><td>${esc(row.name)}</td><td>${esc(size)}</td><td>${esc(row.updated_at.replace("T", " ").slice(0, 16))}</td><td><a href="/compliance/labels/data?table=${esc(row.id)}">${esc(t(locale, "Edit"))}</a>
              <form method="post" action="/compliance/labels/data/delete" class="ld-delete">
                <input type="hidden" name="id" value="${esc(row.id)}">
                <input type="password" name="pin" autocomplete="off" aria-label="${esc(t(locale, "PIN"))}">
                <button type="submit">${esc(t(locale, "Delete"))}</button>
              </form></td></tr>`;
          })
          .join("")}</tbody></table>`;
  const keyOptions = KEY_FIELDS.map(
    (key) => `<option value="${key}"${editing?.key_field === key ? " selected" : ""}>${esc(t(locale, FIELD_WORDS[key]))}</option>`
  ).join("");
  const columnFields = (editing?.columns ?? [{ key: "c0", label: "", type: "text" as const }])
    .map(
      (column, index) => `<div class="ld-col" data-ld-column>
        <label>${esc(t(locale, "Label"))} <input name="col_label" value="${esc(column.label)}" required></label>
        <label>${esc(t(locale, "Type"))} <select name="col_type">
          ${["text", "number", "date", "percent"].map((type) => `<option value="${type}"${column.type === type ? " selected" : ""}>${esc(t(locale, type === "text" ? "Text" : type === "number" ? "Number" : type === "date" ? "Date" : "Percent"))}</option>`).join("")}
        </select></label>
        <input type="hidden" name="col_key" value="c${index}">
      </div>`
    )
    .join("");
  const grid = editing
    ? `<table class="data ld-grid" data-ld-grid><thead><tr>${editing.columns.map((column) => `<th>${esc(column.label)}</th>`).join("")}</tr></thead><tbody>${editing.rows
        .map(
          (cells) =>
            `<tr>${editing.columns
              .map((_column, index) => `<td><input name="cell" data-col="${index}" value="${esc(cells[index] ?? "")}"></td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody></table>`
    : `<div id="ld-grid" data-ld-grid></div>`;
  return `<h1>${esc(t(locale, "Custom Label Data"))}</h1>
    <section data-label-data>
      <h2>${esc(t(locale, "Saved tables"))}</h2>
      ${rows}
      <h2>${esc(t(locale, "Add New Table"))}</h2>
      <form id="ld-form" class="stack" method="post" action="/compliance/labels/data">
        <input type="hidden" name="id" value="${esc(editing?.id ?? "")}">
        <label>${esc(t(locale, "Name"))} <input name="name" required value="${esc(editing?.name ?? "")}"></label>
        <label>${esc(t(locale, "Mode"))}
          <select name="mode" id="ld-mode">
            <option value="static"${editing?.mode === "keyed" ? "" : " selected"}>${esc(t(locale, "Static"))}</option>
            <option value="keyed"${editing?.mode === "keyed" ? " selected" : ""}>${esc(t(locale, "Keyed by"))}</option>
          </select>
        </label>
        <label>${esc(t(locale, "Keyed by"))} <select name="key_field">${keyOptions}</select></label>
        <label>${esc(t(locale, "Rows"))} <input id="ld-rows" name="row_count" type="number" min="1" max="40" value="${editing?.rows.length || 1}"></label>
        <label>${esc(t(locale, "Columns"))} <input id="ld-cols" name="col_count" type="number" min="1" max="12" value="${editing?.columns.length || 1}"></label>
        <div id="ld-columns">${columnFields}</div>
        <button type="button" id="ld-add">${esc(t(locale, "Add the grid"))}</button>
        ${grid}
        <input type="hidden" name="columns_json" id="ld-columns-json" value="">
        <input type="hidden" name="rows_json" id="ld-rows-json" value="">
        <button type="submit">${esc(t(locale, "Save"))}</button>
        <button type="button" id="ld-reset">${esc(t(locale, "Start Over"))}</button>
        <a href="/compliance/labels" id="ld-exit">${esc(t(locale, "Exit Without Saving"))}</a>
        <p id="ld-warn" class="le-alert" role="alert"></p>
      </form>
    </section>
    <script>${labelDataClient(locale)}</script>`;
}

function labelDataClient(locale: Locale): string {
  const startOver = t(locale, "Start Over warns and clears this table.");
  const exitWarn = t(locale, "Exit Without Saving leaves the menu and keeps nothing new.");
  return `(function () {
    var form = document.getElementById("ld-form");
    if (!form) return;
    var words = ${JSON.stringify({ startOver, exitWarn }).replaceAll("<", "\\u003c")};
    function columnCount() { return Math.max(1, Math.min(12, Math.round(Number(document.getElementById("ld-cols").value) || 1))); }
    function rowCount() { return Math.max(1, Math.min(40, Math.round(Number(document.getElementById("ld-rows").value) || 1))); }
    function rebuildColumns() {
      var box = document.getElementById("ld-columns");
      var n = columnCount();
      while (box.children.length < n) {
        var i = box.children.length;
        var div = document.createElement("div");
        div.className = "ld-col";
        div.innerHTML = '<label>Label <input name="col_label" required></label><label>Type <select name="col_type"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="percent">Percent</option></select></label><input type="hidden" name="col_key" value="c' + i + '">';
        box.appendChild(div);
      }
      while (box.children.length > n) box.removeChild(box.lastChild);
    }
    function rebuildGrid() {
      var grid = document.getElementById("ld-grid");
      if (!grid) return;
      var cols = columnCount();
      var rows = rowCount();
      var labels = [].map.call(form.querySelectorAll("[name=col_label]"), function (input) { return input.value || ""; });
      var html = "<table class='data ld-grid'><thead><tr>";
      for (var c = 0; c < cols; c++) html += "<th>" + (labels[c] || "") + "</th>";
      html += "</tr></thead><tbody>";
      for (var r = 0; r < rows; r++) {
        html += "<tr>";
        for (var k = 0; k < cols; k++) html += '<td><input name="cell" data-col="' + k + '"></td>';
        html += "</tr>";
      }
      html += "</tbody></table>";
      grid.innerHTML = html;
    }
    var add = document.getElementById("ld-add");
    if (add) add.addEventListener("click", function () { rebuildColumns(); rebuildGrid(); });
    form.addEventListener("submit", function () {
      var cols = [].map.call(form.querySelectorAll("[name=col_key]"), function (input, index) {
        var label = form.querySelectorAll("[name=col_label]")[index].value;
        var type = form.querySelectorAll("[name=col_type]")[index].value;
        return { key: input.value || ("c" + index), label: label, type: type };
      });
      var width = cols.length || 1;
      var cells = [].map.call(form.querySelectorAll("[name=cell]"), function (input) { return input.value; });
      var body = [];
      for (var i = 0; i < cells.length; i += width) body.push(cells.slice(i, i + width));
      document.getElementById("ld-columns-json").value = JSON.stringify(cols);
      document.getElementById("ld-rows-json").value = JSON.stringify(body);
    });
    document.getElementById("ld-reset").addEventListener("click", function () {
      if (!window.confirm(words.startOver)) return;
      form.querySelector("[name=name]").value = "";
      form.querySelector("[name=id]").value = "";
      [].forEach.call(form.querySelectorAll("[name=cell], [name=col_label]"), function (input) { input.value = ""; });
    });
    document.getElementById("ld-exit").addEventListener("click", function (event) {
      if (!window.confirm(words.exitWarn)) event.preventDefault();
    });
  })();`;
}

export const GROUP_LABELS = GROUP_WORDS;

function ancestorsOf(row: MirrorPackage): string[] {
  return ancestors(row);
}

/** The packages, harvests and compliance samples one tag can reach. */
export async function loadLabelFacts(db: D1Database, tag: string): Promise<LabelFacts> {
  const packages: MirrorPackage[] = [];
  const want = new Set<string>([up(tag)].filter(Boolean));
  for (let hop = 0; hop <= HARVEST_LINEAGE_CAP; hop++) {
    const missing = [...want].filter((id) => !packages.some((row) => up(row.tag) === id));
    if (missing.length === 0) break;
    const found = await db
      .prepare(
        `SELECT tag, license_value, source_harvests, source_packages, original_source_label, item, category, item_strain, quantity, uom, packaged_date, production_batch, lab_test_status, location, gone_at
         FROM metrc_packages WHERE tag IN (${missing.map(() => "?").join(", ")})`
      )
      .bind(...missing)
      .all<MirrorPackage>();
    if ((found.results ?? []).length === 0) break;
    for (const row of found.results ?? []) {
      packages.push(row);
      if (hop < HARVEST_LINEAGE_CAP) for (const next of ancestorsOf(row)) want.add(next);
    }
  }
  const tags = [...want];
  const locals =
    tags.length === 0
      ? []
      : (
          await db
            .prepare(
              `SELECT metrc_tag, harvest_batch_id, qty, uom, license_value, location, farm_code, item_kind, deleted_at
               FROM local_inventory_items
               WHERE metrc_tag IN (${tags.map(() => "?").join(", ")})`
            )
            .bind(...tags)
            .all<LocalPackage>()
        ).results ?? [];
  const harvestIds = [...new Set(locals.map((row) => row.harvest_batch_id).filter((id): id is string => Boolean(id)))];
  const harvestNames = [
    ...new Set(packages.flatMap((row) => harvestTokens(row.source_harvests).map((name) => name.trim()).filter(Boolean))),
  ];
  const harvests = await loadHarvests(db, harvestIds, harvestNames);
  const hbns = harvests.map((row) => row.hbn);
  const samples = await loadSamples(db, tags, hbns);
  return { packages, locals, harvests, samples };
}

async function loadHarvests(db: D1Database, ids: string[], names: string[]): Promise<HarvestRow[]> {
  if (ids.length === 0 && names.length === 0) return [];
  const clauses: string[] = [];
  const args: string[] = [];
  if (ids.length > 0) {
    clauses.push(`h.id IN (${ids.map(() => "?").join(", ")})`);
    args.push(...ids);
  }
  if (names.length > 0) {
    clauses.push(`h.hbn IN (${names.map(() => "?").join(", ")})`);
    args.push(...names);
    clauses.push(`h.metrc_harvest_tag IN (${names.map(() => "?").join(", ")})`);
    args.push(...names);
  }
  const found = await db
    .prepare(
      `SELECT h.id, h.entry_date, h.hbn, h.market_strain, h.metrc_harvest_tag, h.farm_code,
              COALESCE(s.name, '') AS strain_name, COALESCE(f.display_name, '') AS farm_name
       FROM harvest_batches h
       LEFT JOIN strains s ON s.id = h.strain_id
       LEFT JOIN farms f ON f.code = h.farm_code
       WHERE h.deleted_at IS NULL AND (${clauses.join(" OR ")})`
    )
    .bind(...args)
    .all<HarvestRow>();
  return found.results ?? [];
}

async function loadSamples(db: D1Database, tags: string[], hbns: string[]): Promise<ComplianceSample[]> {
  if (tags.length === 0 && hbns.length === 0) return [];
  const clauses: string[] = [];
  const args: string[] = [];
  if (tags.length > 0) {
    clauses.push(`source_metrc_tag IN (${tags.map(() => "?").join(", ")})`);
    args.push(...tags);
    clauses.push(`sample_tag IN (${tags.map(() => "?").join(", ")})`);
    args.push(...tags);
  }
  if (hbns.length > 0) {
    clauses.push(`harvest_batch IN (${hbns.map(() => "?").join(", ")})`);
    args.push(...hbns);
  }
  const found = await db
    .prepare(
      `SELECT source_metrc_tag, sample_tag, harvest_batch, thc_potency_pct, status, program, voided_at, finished_testing_on, testing_facility, changed_at
       FROM lab_compliance_samples
       WHERE program = 'compliance' AND voided_at IS NULL AND (${clauses.join(" OR ")})`
    )
    .bind(...args)
    .all<ComplianceSample>();
  return found.results ?? [];
}

export async function listDataTables(db: D1Database): Promise<Array<Record<string, unknown>>> {
  const found = await db
    .prepare(
      `SELECT id, name, mode, key_field, columns_json, rows_json, updated_at
       FROM label_data_tables WHERE deleted_at IS NULL ORDER BY name`
    )
    .all<Record<string, unknown>>();
  return found.results ?? [];
}
