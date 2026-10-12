/**
 * THE TRIM WEIGHS FEED (canon 0.30.137). Corey's agent, relayed by the owner
 * 2026-09-20, verbatim: "I want the trim room scale weights flowing into
 * TRIMATRON automatically instead of through the workbook. Two things from
 * GripFactory Lite: 1. A machine route for the station data behind
 * /station/trim_packages: the JSON the page reads (per package: tag, stream,
 * weight in grams, timestamp, operator), or a read of the table it writes.
 * 2. A Cloudflare Access service token for that route so a Field Ops poller
 * can read it without a login, or an Access bypass on just that route. The
 * poller reads every few minutes, stores each weigh by its row id, and the
 * phones fill their package totals from it. Nothing writes back to your side."
 * His pick: a second service token (trimatron-puller) on the application; no
 * bypass.
 *
 * The route: GET /feeds/trim-weighs.json, one row per trim package (the
 * wip_packages the Trim Packages Entry station writes; cryo outputs are not
 * trim weighs), newest change last, with ?since=<ISO> for polling (rows whose
 * change instant is after it: a new weigh, a reasoned edit, a void), ?limit=
 * (1 to 2000, 500 by default), ?live=1 to leave voided rows out and ?site= for
 * one farm. Each row carries its id (the poller's key), the internal package
 * code, the METRC tag when the ledger holds one, the stream (the package type
 * code and its label), the grams, the trim date, the typed operator, the
 * status, the lot (id, HBN, serial, strain, farm, harvest tag, the HBN read
 * back), created_at, updated_at, changed_at and voided_at (null while live).
 * Read-only; no PIN (Access fronts it); no-store.
 *
 * THE FEED READS THE HBN (canon 0.30.141). Corey's agent's connector spec asked
 * for a weigh timestamp in UTC, a station id, the site, the facility, the
 * harvest batch, the dry method and a site filter; the owner, 2026-09-20: "the
 * feed doesn't carry it but the data hides it in the HBN". So each row also
 * carries weighed_at (the weigh's UTC instant), station, site (the HBN's farm
 * segment, the batch's farm when the HBN does not parse), license (the ledger
 * row's line, else the lot's inherited line), dry_method (silo when the HBN's
 * dry space segment names a silo, hang when it reads NA) and the HBN's parts
 * on the lot; ?site= filters by that same reading.
 *
 * THE TIE-COMPLETE PAGE (canon 0.30.149, a correction of 0.30.137's poll).
 * Corey's agent's first poll: 605 rows over 7 pages of 90 for 546 distinct
 * ids. Every package cut in one trim entry shares one timestamp, so change
 * instants tie, and a page cut inside a tie with since strictly after lost the
 * tie's tail for good. A page now never splits an instant: the rows sharing
 * the page's last change instant ride along beyond the limit, so the limit is
 * a floor, next_since stays the last instant, and strictly-after loses nothing.
 *
 * THE FEED NAMES THE REAL STRAIN (canon 0.30.149; his pick "Real strain first,
 * market beside it"): lot.strain is the batch's strain as Lookups names it,
 * the one a METRC tag prints; lot.market_strain is the market label beside it.
 */

import { HttpError, textOrNull } from "./audit";
import { NON_TRIM_SOURCE_SQL, TRUCK_DRY_SPACE_ID, inheritedLotLicense, isMetrcTag, shortLotId } from "./config";
import { etDate, isCalendarDate } from "./farmday";
import { parseHbn, type HbnParts } from "./mint";

/** Under /feeds, not /api: the /api tree sits behind the Admin PIN for the
 * SalesHelper's send, and a poller carries no cookie; Access alone fronts this. */
export const TRIM_WEIGHS_PATH = "/feeds/trim-weighs.json";
export const TRIM_WEIGHS_LIMIT_DEFAULT = 500;
export const TRIM_WEIGHS_LIMIT_MAX = 2000;
/** The station whose rows these are, as the pipeline names it (/station/trim_packages). */
export const TRIM_WEIGHS_STATION = "trim_packages";

export const FEED_REFUSAL = {
  since: "since must be an ISO instant, such as 2026-09-20T12:00:00.000Z.",
  limit: `limit must be a whole number from 1 to ${TRIM_WEIGHS_LIMIT_MAX}.`,
  site: "site must be a farm code, such as ARL, PNN or PNS.",
} as const;

export type TrimWeighRow = {
  id: string;
  package_code: string;
  metrc_tag: string | null;
  stream: string;
  stream_label: string | null;
  weight_grams: number;
  trim_date: string | null;
  trim_operator: string | null;
  status: string;
  lot_id: string | null;
  hbn: string | null;
  metrc_harvest_tag: string | null;
  /** The batch's strain as Lookups names it (the tag's strain). */
  strain: string | null;
  /** The market label typed on the batch, else the strain's own name (the mint's inheritance). */
  market_strain: string | null;
  farm_code: string | null;
  license_value: string | null;
  batch_license: string | null;
  created_at: string;
  updated_at: string;
  changed_at: string;
  voided_at: string | null;
};

export type TrimWeighLot = {
  id: string | null;
  hbn: string | null;
  short_id: string | null;
  /** The real strain, the one a METRC tag prints (THE FEED NAMES THE REAL STRAIN). */
  strain: string | null;
  /** The market label beside it: the typed market strain, else the strain's own name. */
  market_strain: string | null;
  /** The batch's farm as stored; site above is the HBN's own reading. */
  farm: string | null;
  metrc_harvest_tag: string | null;
  /** The HBN read back: harvest day, farm, grow code, strain code, manicure, dry space segment, serial. */
  hbn_parts: HbnParts | null;
};

export type TrimWeigh = {
  id: string;
  package_code: string;
  metrc_tag: string | null;
  stream: string;
  stream_label: string | null;
  weight_grams: number;
  /** The weigh's instant, UTC (the Z is the zone). */
  weighed_at: string;
  trim_date: string | null;
  operator: string | null;
  station: typeof TRIM_WEIGHS_STATION;
  status: string;
  /** The HBN's farm segment (ARL, PNN, PNS); the batch's farm when the HBN does not parse; null with no lot. */
  site: string | null;
  /** The facility: the ledger row's license, else the lot's inherited line; null with no lot and no ledger row. */
  license: string | null;
  /** silo when the HBN's dry space segment names a silo, hang when it reads NA, null without a parsed HBN. */
  dry_method: "silo" | "hang" | null;
  lot: TrimWeighLot;
  created_at: string;
  updated_at: string;
  changed_at: string;
  voided_at: string | null;
};

export type TrimWeighsQuery = { since: string | null; limit: number; liveOnly: boolean; site: string | null };

/** The query string, checked: since an ISO instant or absent; limit 1 to 2000,
 * 500 by default; live=1 leaves voided rows out; site a farm code or absent. */
export function parseTrimWeighsQuery(params: {
  since?: string | null;
  limit?: string | null;
  live?: string | null;
  site?: string | null;
}): TrimWeighsQuery {
  const since = textOrNull(params.since);
  if (since != null && !Number.isFinite(Date.parse(since))) throw new HttpError(400, FEED_REFUSAL.since);
  const limitRaw = textOrNull(params.limit);
  let limit = TRIM_WEIGHS_LIMIT_DEFAULT;
  if (limitRaw != null) {
    if (!/^\d+$/.test(limitRaw)) throw new HttpError(400, FEED_REFUSAL.limit);
    limit = Number(limitRaw);
    if (limit < 1 || limit > TRIM_WEIGHS_LIMIT_MAX) throw new HttpError(400, FEED_REFUSAL.limit);
  }
  const live = textOrNull(params.live);
  const siteRaw = textOrNull(params.site);
  let site: string | null = null;
  if (siteRaw != null) {
    site = siteRaw.toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(site)) throw new HttpError(400, FEED_REFUSAL.site);
  }
  return { since, limit, liveOnly: live === "1" || live === "true", site };
}

/** The change instant of a row: its void when that came after its last edit, else its last edit. */
const CHANGED_AT_SQL = "CASE WHEN p.deleted_at IS NOT NULL AND p.deleted_at > p.updated_at THEN p.deleted_at ELSE p.updated_at END";

/** A minted HBN: YYDDD then six more dash-bound segments. */
const HBN_SHAPE_LIKE = "'_____-%-%-%-%-%-%'";

const ROW_SELECT = `SELECT p.id, p.package_code, li.metrc_tag, p.package_type_code AS stream, pt.display_name AS stream_label,
              p.weight_grams, p.trim_date, p.trim_operator, p.status,
              w.id AS lot_id, b.hbn, b.metrc_harvest_tag, s.name AS strain, COALESCE(b.market_strain, s.name) AS market_strain, b.farm_code,
              li.license_value, b.license_value AS batch_license,
              p.created_at, p.updated_at, ${CHANGED_AT_SQL} AS changed_at, p.deleted_at AS voided_at
       FROM wip_packages p
       LEFT JOIN package_types pt ON pt.code = p.package_type_code
       LEFT JOIN wet_weight_entries w ON w.id = p.wet_weight_entry_id
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       LEFT JOIN local_inventory_items li ON li.id = (
         SELECT i.id FROM local_inventory_items i WHERE i.wip_package_id = p.id ORDER BY i.created_at ASC, i.id ASC LIMIT 1)`;

/** The WHERE clauses and binds the query shares between the page and its tie completion. */
function feedClauses(query: TrimWeighsQuery): { clauses: string[]; binds: unknown[] } {
  const clauses = [NON_TRIM_SOURCE_SQL];
  const binds: unknown[] = [];
  if (query.since) {
    clauses.push(`${CHANGED_AT_SQL} > ?`);
    binds.push(query.since);
  }
  if (query.liveOnly) clauses.push("p.deleted_at IS NULL");
  if (query.site) {
    // THE FEED READS THE HBN: the site is the HBN's second segment; a lot whose
    // HBN is not a mint falls back to the batch's farm, the same reading trimWeighOf makes.
    clauses.push(
      `(b.hbn LIKE '_____-' || ? || '-%' OR (COALESCE(b.hbn, '') NOT LIKE ${HBN_SHAPE_LIKE} AND b.farm_code = ?))`
    );
    binds.push(query.site, query.site);
  }
  return { clauses, binds };
}

export type TrimWeighsPage = { rows: TrimWeighRow[]; more: boolean };

/** One page of the feed. THE TIE-COMPLETE PAGE: the query asks for one row past
 * the limit to learn whether more follow; when the row past the limit shares
 * the last kept row's change instant, every row of that instant beyond the
 * limit is fetched and appended, so no page ends inside a tie and since
 * strictly after next_since loses nothing. */
export async function listTrimWeighs(db: D1Database, query: TrimWeighsQuery): Promise<TrimWeighsPage> {
  const { clauses, binds } = feedClauses(query);
  const result = await db
    .prepare(
      `${ROW_SELECT}
       WHERE ${clauses.join(" AND ")}
       ORDER BY ${CHANGED_AT_SQL} ASC, p.id ASC
       LIMIT ?`
    )
    .bind(...binds, query.limit + 1)
    .all<TrimWeighRow>();
  const fetched = result.results ?? [];
  if (fetched.length <= query.limit) return { rows: fetched, more: false };
  const rows = fetched.slice(0, query.limit);
  const last = rows[rows.length - 1];
  const next = fetched[query.limit];
  if (next.changed_at !== last.changed_at) return { rows, more: true };
  const tail = await db
    .prepare(
      `${ROW_SELECT}
       WHERE ${clauses.join(" AND ")} AND ${CHANGED_AT_SQL} = ? AND p.id > ?
       ORDER BY p.id ASC`
    )
    .bind(...binds, last.changed_at, last.id)
    .all<TrimWeighRow>();
  return { rows: [...rows, ...(tail.results ?? [])], more: true };
}

/** THE TAG LAW (canon 0.30.38) keeps an off-shape code as typed on the ledger
 * row; the feed's metrc_tag is a METRC tag or null, the internal code standing
 * in package_code either way. */
export function feedTagOf(raw: string | null | undefined): string | null {
  const tag = String(raw ?? "").trim();
  return tag && isMetrcTag(tag) ? tag.toUpperCase() : null;
}

/** The row's site: the HBN's farm segment, the batch's farm when the HBN does not parse. */
export function feedSiteOf(hbn: string | null | undefined, farmCode: string | null | undefined): string | null {
  const parts = parseHbn(hbn);
  if (parts) return parts.farm;
  const farm = String(farmCode ?? "").trim();
  return farm ? farm : null;
}

/** The dry method the HBN was minted with: a silo number means silo, NA means a hang dry. */
export function feedDryMethodOf(hbn: string | null | undefined): "silo" | "hang" | null {
  const parts = parseHbn(hbn);
  if (!parts) return null;
  return parts.silo ? "silo" : "hang";
}

/** The facility line: the ledger row's license first; without one, the lot's
 * inherited line (THE INHERITANCE LAW); null when there is no lot at all. */
export function feedLicenseOf(row: Pick<TrimWeighRow, "license_value" | "batch_license" | "lot_id">, site: string | null): string | null {
  const ledger = String(row.license_value ?? "").trim();
  if (ledger) return ledger;
  if (!row.lot_id) return null;
  return inheritedLotLicense(row.batch_license, site);
}

export function trimWeighOf(row: TrimWeighRow): TrimWeigh {
  const site = feedSiteOf(row.hbn, row.farm_code);
  return {
    id: row.id,
    package_code: row.package_code,
    metrc_tag: feedTagOf(row.metrc_tag),
    stream: row.stream,
    stream_label: row.stream_label ?? null,
    weight_grams: Number(row.weight_grams ?? 0),
    weighed_at: row.created_at,
    trim_date: row.trim_date ?? null,
    operator: row.trim_operator ?? null,
    station: TRIM_WEIGHS_STATION,
    status: row.status,
    site,
    license: feedLicenseOf(row, site),
    dry_method: feedDryMethodOf(row.hbn),
    lot: {
      id: row.lot_id ?? null,
      hbn: row.hbn ?? null,
      short_id: row.hbn ? shortLotId(row.hbn, row.metrc_harvest_tag) : null,
      strain: row.strain ?? null,
      market_strain: row.market_strain ?? row.strain ?? null,
      farm: row.farm_code ?? null,
      metrc_harvest_tag: row.metrc_harvest_tag ?? null,
      hbn_parts: parseHbn(row.hbn),
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
    changed_at: row.changed_at,
    voided_at: row.voided_at ?? null,
  };
}

export type TrimWeighsFeed = {
  feed: "trim_weighs";
  generated_at: string;
  since: string | null;
  /** The site filter as applied, or null for every farm. */
  site: string | null;
  count: number;
  /** The last row's change instant, or the since given when nothing came back: the poller's next since. */
  next_since: string | null;
  /** True when rows remain after this page; poll again from next_since. The limit is a
   * floor: a page runs over it by the rows sharing its last change instant, never splitting one. */
  more: boolean;
  rows: TrimWeigh[];
};

export function trimWeighsFeed(page: TrimWeighsPage | TrimWeighRow[], query: TrimWeighsQuery, generatedAt: string): TrimWeighsFeed {
  const rows = Array.isArray(page) ? page : page.rows;
  const out = rows.map(trimWeighOf);
  // A bare row list (older callers) reads more the old way; a page says so itself.
  const more = Array.isArray(page) ? out.length >= query.limit : page.more;
  return {
    feed: "trim_weighs",
    generated_at: generatedAt,
    since: query.since,
    site: query.site,
    count: out.length,
    next_since: out.length ? out[out.length - 1].changed_at : query.since,
    more,
    rows: out,
  };
}

/**
 * THE HARVEST BATCH FEED (BRIEF HB1). One row per wet lot (a wet_weight_entries
 * row), so a batch weighed as two lots is two rows. The puller's key is the
 * lot id. Same query as the trim weighs feed (since strictly after changed_at,
 * limit 1 to 2000 with 500 the default, live=1 drops voided lots, site a farm
 * code), same envelope, same tie-complete page. Read-only.
 *
 * changed_at is the widest instant on the lot: a wet read, the plant count, a
 * Move To, a Load Silo, a dry row, Finish unload, a reasoned edit of the lot
 * or its batch, or the void. Test HBNs (is_test 1) never ride. A lot whose HBN
 * does not parse still rides, with nulls where the HBN would have answered and
 * the stored farm in farm. grow_method is indoor, outdoor, or greenhouse from
 * the HBN grow code, never the license. dry_weight_grams is the live total of
 * non-voided dry rows while unloading (null until the first), and
 * unload_finished_at is the R5 unload date, the signal that the dry figure is
 * final. customer is the toll lot's customer once that column is on the batch
 * (T1), and null for Grip's own and on a database that does not have it yet.
 */

export const HARVEST_BATCHES_PATH = "/feeds/harvest-batches.json";

const GROW_METHOD_WORDS: Record<string, "indoor" | "outdoor" | "greenhouse"> = {
  ID: "indoor",
  OD: "outdoor",
  GH: "greenhouse",
};

/** indoor, outdoor, or greenhouse from the HBN grow code. Null when the HBN does not parse, or the code is none of the three. */
export function feedGrowMethodOf(hbn: string | null | undefined): "indoor" | "outdoor" | "greenhouse" | null {
  const parts = parseHbn(hbn);
  if (!parts) return null;
  return GROW_METHOD_WORDS[parts.grow_code.toUpperCase()] ?? null;
}

/** The space Move To or Load Silo last left the lot in: the space's name, or Truck N when the lot sits on the truck sentinel. */
export function feedDrySpaceOf(input: {
  spaceId: string | null;
  spaceName: string | null;
  spaceKind: string | null;
  truckNumber: string | null;
}): string | null {
  const truck = String(input.truckNumber ?? "").trim();
  const onTruck = input.spaceId === TRUCK_DRY_SPACE_ID || input.spaceKind === "truck";
  if (onTruck && truck) return `Truck ${truck}`;
  const name = String(input.spaceName ?? "").trim();
  return name ? name : null;
}

/** The R5 unload date: the newest finished session's Effective Date when one was typed, else the Eastern date of that finish. Null until Finish unload. */
export function feedUnloadFinishedAt(effectiveDate: string | null | undefined, finishedAt: string | null | undefined): string | null {
  const finished = textOrNull(finishedAt);
  if (!finished) return null;
  const typed = textOrNull(effectiveDate);
  if (typed && isCalendarDate(typed)) return typed;
  return etDate(finished);
}

/** The widest change instant. D1 refuses a compound SELECT past a few terms, and
 * scalar max() turns the whole result null when any argument is null, so each
 * stamp is coalesced to '' (it sorts before every ISO instant) and a missing
 * child table coalesces the same way. created_at is never null, so the result
 * is always a real instant. Repeated in the select, the since filter, and the
 * order so a page and its tie read one clock. */
const HARVEST_CHANGED_AT_SQL = `max(
  max(w.created_at, w.updated_at, COALESCE(w.deleted_at, '')),
  max(b.created_at, b.updated_at, COALESCE(b.deleted_at, '')),
  COALESCE((SELECT max(max(COALESCE(ww.created_at, ''), COALESCE(ww.updated_at, ''), COALESCE(ww.deleted_at, ''))) FROM wet_weights ww WHERE ww.wet_weight_entry_id = w.id), ''),
  COALESCE((SELECT max(max(COALESCE(dw.created_at, ''), COALESCE(dw.updated_at, ''), COALESCE(dw.deleted_at, ''))) FROM dry_weights dw WHERE dw.wet_weight_entry_id = w.id), ''),
  COALESCE((SELECT max(max(COALESCE(us.created_at, ''), COALESCE(us.updated_at, ''), COALESCE(us.deleted_at, ''), COALESCE(us.finished_at, ''))) FROM unload_sessions us WHERE us.wet_weight_entry_id = w.id), ''),
  COALESCE((SELECT max(max(COALESCE(sl.created_at, ''), COALESCE(sl.updated_at, ''), COALESCE(sl.deleted_at, ''), COALESCE(sl.loaded_at, ''), COALESCE(sl.ended_at, ''))) FROM silo_loads sl WHERE sl.wet_weight_entry_id = w.id), '')
)`;

export type HarvestBatchRow = {
  id: string;
  hbn: string | null;
  strain: string | null;
  market_strain: string | null;
  farm_code: string | null;
  plant_count: number | null;
  wet_weight_grams: number | null;
  dry_weight_grams: number | null;
  space_id: string | null;
  space_name: string | null;
  space_kind: string | null;
  truck_number: string | null;
  unload_effective_date: string | null;
  unload_finished_raw: string | null;
  status: string;
  created_at: string;
  changed_at: string;
  voided_at: string | null;
  customer: string | null;
};

export type HarvestBatch = {
  id: string;
  hbn: string | null;
  short_id: string | null;
  strain: string | null;
  market_strain: string | null;
  farm: string | null;
  grow_method: "indoor" | "outdoor" | "greenhouse" | null;
  harvest_day: string | null;
  plant_count: number | null;
  wet_weight_grams: number;
  dry_method: "silo" | "hang" | null;
  dry_space: string | null;
  dry_weight_grams: number | null;
  unload_finished_at: string | null;
  status: string;
  created_at: string;
  changed_at: string;
  voided_at: string | null;
  customer: string | null;
  hbn_parts: HbnParts | null;
};

export type HarvestBatchesPage = { rows: HarvestBatchRow[]; more: boolean };

export type HarvestBatchesFeed = {
  feed: "harvest_batches";
  generated_at: string;
  since: string | null;
  site: string | null;
  count: number;
  next_since: string | null;
  more: boolean;
  rows: HarvestBatch[];
};

/** True when T1's customer column is on harvest_batches. This tree has no migration for it; the feed names the customer once the column is there, and null until then. */
async function harvestCustomerColumn(db: D1Database): Promise<boolean> {
  const info = await db.prepare("PRAGMA table_info(harvest_batches)").all<{ name: string }>();
  return (info.results ?? []).some((col) => col.name === "customer");
}

function harvestSelect(hasCustomer: boolean): string {
  const customerSql = hasCustomer ? "b.customer AS customer" : "NULL AS customer";
  return `SELECT w.id, b.hbn, s.name AS strain, COALESCE(b.market_strain, s.name) AS market_strain, b.farm_code,
              w.plant_count,
              COALESCE((SELECT SUM(ww.weight_grams) FROM wet_weights ww WHERE ww.wet_weight_entry_id = w.id AND ww.deleted_at IS NULL), w.weight_grams, 0) AS wet_weight_grams,
              (SELECT SUM(dw.weight_grams) FROM dry_weights dw WHERE dw.wet_weight_entry_id = w.id AND dw.deleted_at IS NULL) AS dry_weight_grams,
              ds.id AS space_id, ds.name AS space_name, ds.kind AS space_kind, w.truck_number,
              uf.effective_date AS unload_effective_date, uf.finished_at AS unload_finished_raw,
              w.status, w.created_at, ${HARVEST_CHANGED_AT_SQL} AS changed_at, w.deleted_at AS voided_at,
              ${customerSql}
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       LEFT JOIN dry_spaces ds ON ds.id = w.actual_dryspc
       LEFT JOIN unload_sessions uf ON uf.id = (
         SELECT u2.id FROM unload_sessions u2
         WHERE u2.wet_weight_entry_id = w.id AND u2.deleted_at IS NULL AND u2.finished_at IS NOT NULL
         ORDER BY u2.finished_at DESC, u2.id DESC
         LIMIT 1)`;
}

function harvestClauses(query: TrimWeighsQuery): { clauses: string[]; binds: unknown[] } {
  const clauses = ["COALESCE(b.is_test, 0) = 0"];
  const binds: unknown[] = [];
  if (query.since) {
    clauses.push(`${HARVEST_CHANGED_AT_SQL} > ?`);
    binds.push(query.since);
  }
  if (query.liveOnly) clauses.push("w.deleted_at IS NULL");
  if (query.site) {
    clauses.push(
      `(b.hbn LIKE '_____-' || ? || '-%' OR (COALESCE(b.hbn, '') NOT LIKE ${HBN_SHAPE_LIKE} AND b.farm_code = ?))`
    );
    binds.push(query.site, query.site);
  }
  return { clauses, binds };
}

/** One page of harvest batches. The tie-complete page is the trim feed's: a page never ends inside one change instant. */
export async function listHarvestBatches(db: D1Database, query: TrimWeighsQuery): Promise<HarvestBatchesPage> {
  const hasCustomer = await harvestCustomerColumn(db);
  const { clauses, binds } = harvestClauses(query);
  const select = harvestSelect(hasCustomer);
  const result = await db
    .prepare(
      `${select}
       WHERE ${clauses.join(" AND ")}
       ORDER BY ${HARVEST_CHANGED_AT_SQL} ASC, w.id ASC
       LIMIT ?`
    )
    .bind(...binds, query.limit + 1)
    .all<HarvestBatchRow>();
  const fetched = result.results ?? [];
  if (fetched.length <= query.limit) return { rows: fetched, more: false };
  const rows = fetched.slice(0, query.limit);
  const last = rows[rows.length - 1];
  const next = fetched[query.limit];
  if (next.changed_at !== last.changed_at) return { rows, more: true };
  const tail = await db
    .prepare(
      `${select}
       WHERE ${clauses.join(" AND ")} AND ${HARVEST_CHANGED_AT_SQL} = ? AND w.id > ?
       ORDER BY w.id ASC`
    )
    .bind(...binds, last.changed_at, last.id)
    .all<HarvestBatchRow>();
  return { rows: [...rows, ...(tail.results ?? [])], more: true };
}

export function harvestBatchOf(row: HarvestBatchRow): HarvestBatch {
  const parts = parseHbn(row.hbn);
  return {
    id: row.id,
    hbn: row.hbn ?? null,
    short_id: parts && row.hbn ? shortLotId(row.hbn, null) : null,
    strain: row.strain ?? null,
    market_strain: row.market_strain ?? row.strain ?? null,
    farm: feedSiteOf(row.hbn, row.farm_code),
    grow_method: feedGrowMethodOf(row.hbn),
    harvest_day: parts?.harvest_day ?? null,
    plant_count: row.plant_count == null ? null : Number(row.plant_count),
    wet_weight_grams: Number(row.wet_weight_grams ?? 0),
    dry_method: feedDryMethodOf(row.hbn),
    dry_space: feedDrySpaceOf({
      spaceId: row.space_id,
      spaceName: row.space_name,
      spaceKind: row.space_kind,
      truckNumber: row.truck_number,
    }),
    dry_weight_grams: row.dry_weight_grams == null ? null : Number(row.dry_weight_grams),
    unload_finished_at: feedUnloadFinishedAt(row.unload_effective_date, row.unload_finished_raw),
    status: row.status,
    created_at: row.created_at,
    changed_at: row.changed_at,
    voided_at: row.voided_at ?? null,
    customer: textOrNull(row.customer),
    hbn_parts: parts,
  };
}

export function harvestBatchesFeed(
  page: HarvestBatchesPage | HarvestBatchRow[],
  query: TrimWeighsQuery,
  generatedAt: string
): HarvestBatchesFeed {
  const rows = Array.isArray(page) ? page : page.rows;
  const out = rows.map(harvestBatchOf);
  const more = Array.isArray(page) ? out.length >= query.limit : page.more;
  return {
    feed: "harvest_batches",
    generated_at: generatedAt,
    since: query.since,
    site: query.site,
    count: out.length,
    next_since: out.length ? out[out.length - 1].changed_at : query.since,
    more,
    rows: out,
  };
}
