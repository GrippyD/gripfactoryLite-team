import { describe, expect, it } from "vitest";
import {
  FEED_REFUSAL,
  HARVEST_BATCHES_PATH,
  feedDryMethodOf,
  feedDrySpaceOf,
  feedGrowMethodOf,
  feedLicenseOf,
  feedSiteOf,
  feedTagOf,
  feedUnloadFinishedAt,
  harvestBatchesFeed,
  listHarvestBatches,
  TRIM_WEIGHS_LIMIT_DEFAULT,
  TRIM_WEIGHS_PATH,
  TRIM_WEIGHS_STATION,
  listTrimWeighs,
  parseTrimWeighsQuery,
  trimWeighsFeed,
  type HarvestBatchRow,
  type HarvestBatchesPage,
  type TrimWeighRow,
  type TrimWeighsPage,
} from "../src/feeds";
import { isServiceRoute } from "../src/service";
import { LICENSE_ARL_AU, LICENSE_ARL_MED, LICENSE_AU_GROW, TRUCK_DRY_SPACE_ID } from "../src/config";
import { dateFromYyddd, parseHbn } from "../src/mint";

/** A D1 stand-in: each statement that runs takes the next result set off the
 * queue (the last set repeats), and every statement is kept for the pins. */
function fakeDb(...sets: TrimWeighRow[][]) {
  const prepared: Array<{ sql: string; args: unknown[] }> = [];
  const queue = sets.length ? [...sets] : [[]];
  return {
    prepared,
    prepare(sql: string) {
      const args: unknown[] = [];
      const self = {
        bind(...next: unknown[]) {
          args.push(...next);
          return self;
        },
        async all() {
          prepared.push({ sql, args });
          const rows = queue.length > 1 ? queue.shift()! : queue[0];
          return { results: rows };
        },
        async first() {
          return null;
        },
        async run() {
          return { success: true };
        },
      };
      return self;
    },
  };
}

function row(over: Partial<TrimWeighRow> = {}): TrimWeighRow {
  return {
    id: "wip-1",
    package_code: "26011-SMALLS-1",
    metrc_tag: "1A4060300003E5B000012345",
    stream: "SMALLS",
    stream_label: "Smalls",
    weight_grams: 453.6,
    trim_date: "2026-09-20",
    trim_operator: "Lead",
    status: "cryo_queue",
    lot_id: "lot-1",
    hbn: "26257-PNN-OD-070-0-02-26011",
    metrc_harvest_tag: null,
    strain: "Fruity Pebbles",
    market_strain: "Fruity Pebbles",
    farm_code: "PNN",
    license_value: LICENSE_AU_GROW,
    batch_license: null,
    created_at: "2026-09-20T12:00:00.000Z",
    updated_at: "2026-09-20T12:00:00.000Z",
    changed_at: "2026-09-20T12:00:00.000Z",
    voided_at: null,
    ...over,
  };
}

describe("THE TRIM WEIGHS FEED (canon 0.30.137; Corey's agent through the owner: a machine route for the trim packages, per package tag, stream, grams, timestamp, operator, keyed by row id)", () => {
  it("parses the query: since an ISO instant or absent, limit 1 to 2000 with 500 by default, live=1 for the live rows alone, site a farm code", () => {
    expect(parseTrimWeighsQuery({})).toEqual({ since: null, limit: TRIM_WEIGHS_LIMIT_DEFAULT, liveOnly: false, site: null });
    expect(parseTrimWeighsQuery({ since: "2026-09-20T12:00:00.000Z", limit: "25", live: "1", site: "arl" })).toEqual({
      since: "2026-09-20T12:00:00.000Z",
      limit: 25,
      liveOnly: true,
      site: "ARL",
    });
    expect(() => parseTrimWeighsQuery({ since: "yesterday" })).toThrow(FEED_REFUSAL.since);
    expect(() => parseTrimWeighsQuery({ limit: "0" })).toThrow(FEED_REFUSAL.limit);
    expect(() => parseTrimWeighsQuery({ limit: "2001" })).toThrow(FEED_REFUSAL.limit);
    expect(() => parseTrimWeighsQuery({ limit: "ten" })).toThrow(FEED_REFUSAL.limit);
    expect(() => parseTrimWeighsQuery({ site: "Penn North" })).toThrow(FEED_REFUSAL.site);
    expect(() => parseTrimWeighsQuery({ site: "A" })).toThrow(FEED_REFUSAL.site);
    expect(TRIM_WEIGHS_PATH).toBe("/feeds/trim-weighs.json");
    expect(TRIM_WEIGHS_STATION).toBe("trim_packages");
  });

  it("reads trim packages alone (never cryo outputs), voided rows included unless live, after since by the change instant, in change order, one row past the limit", async () => {
    const db = fakeDb([row()]);
    const page = await listTrimWeighs(db as unknown as D1Database, { since: "2026-09-19T00:00:00.000Z", limit: 100, liveOnly: true, site: null });
    expect(page).toEqual({ rows: [row()], more: false });
    const sql = db.prepared[0].sql.replace(/\s+/g, " ");
    expect(sql).toContain("FROM wip_packages p");
    expect(sql).toContain("COALESCE(p.source, 'trim') NOT IN ('cryo', 'metrc')");
    expect(sql).toContain("CASE WHEN p.deleted_at IS NOT NULL AND p.deleted_at > p.updated_at THEN p.deleted_at ELSE p.updated_at END > ?");
    expect(sql).toContain("p.deleted_at IS NULL");
    expect(sql).toContain("LEFT JOIN package_types pt ON pt.code = p.package_type_code");
    expect(sql).toContain("pt.display_name AS stream_label");
    // THE FEED NAMES THE REAL STRAIN: the strain as Lookups names it, the market label beside it.
    expect(sql).toContain("s.name AS strain, COALESCE(b.market_strain, s.name) AS market_strain");
    expect(sql).toContain("li.license_value, b.license_value AS batch_license");
    expect(sql).toContain("LEFT JOIN local_inventory_items li ON li.id = ( SELECT i.id FROM local_inventory_items i WHERE i.wip_package_id = p.id ORDER BY i.created_at ASC, i.id ASC LIMIT 1)");
    expect(sql).toMatch(/ORDER BY CASE WHEN p\.deleted_at IS NOT NULL.*ASC, p\.id ASC LIMIT \?$/);
    expect(sql).not.toContain("b.hbn LIKE");
    // One row past the limit tells whether more follow.
    expect(db.prepared[0].args).toEqual(["2026-09-19T00:00:00.000Z", 101]);
    expect(db.prepared).toHaveLength(1);
    const all = fakeDb([]);
    await listTrimWeighs(all as unknown as D1Database, { since: null, limit: 500, liveOnly: false, site: null });
    const sqlAll = all.prepared[0].sql.replace(/\s+/g, " ");
    expect(sqlAll).not.toContain("> ?");
    expect(sqlAll).not.toContain("p.deleted_at IS NULL");
    expect(all.prepared[0].args).toEqual([501]);
  });

  // THE TIE-COMPLETE PAGE (canon 0.30.149): every package cut in one trim entry shares one instant.
  it("never ends a page inside a tie: the rows sharing the last kept instant ride along beyond the limit, and more says whether any remain", async () => {
    const t1 = "2026-09-20T12:00:00.000Z";
    const t2 = "2026-09-20T12:30:00.000Z";
    const a = row({ id: "wip-a", changed_at: t1, updated_at: t1 });
    const b = row({ id: "wip-b", changed_at: t2, updated_at: t2, stream: "BUD" });
    const c = row({ id: "wip-c", changed_at: t2, updated_at: t2, stream: "SMALLS" });
    const d = row({ id: "wip-d", changed_at: t2, updated_at: t2, stream: "TRIM" });
    // limit 2: the page keeps a and b; the row past the limit (c) shares b's instant, so the tie's tail (c, d) is fetched and appended.
    const tied = fakeDb([a, b, c], [c, d]);
    const page = await listTrimWeighs(tied as unknown as D1Database, { since: null, limit: 2, liveOnly: false, site: null });
    expect(page.rows.map((r) => r.id)).toEqual(["wip-a", "wip-b", "wip-c", "wip-d"]);
    expect(page.more).toBe(true);
    expect(tied.prepared).toHaveLength(2);
    expect(tied.prepared[0].args).toEqual([3]);
    const tailSql = tied.prepared[1].sql.replace(/\s+/g, " ");
    expect(tailSql).toContain("CASE WHEN p.deleted_at IS NOT NULL AND p.deleted_at > p.updated_at THEN p.deleted_at ELSE p.updated_at END = ? AND p.id > ?");
    expect(tailSql).toMatch(/ORDER BY p\.id ASC$/);
    expect(tailSql).not.toMatch(/LIMIT \?$/);
    expect(tied.prepared[1].args).toEqual([t2, "wip-b"]);
    // The tail query carries the page's own clauses (since, live, site) so the tie is read under the same filter.
    const filtered = fakeDb([a, b, c], [c]);
    await listTrimWeighs(filtered as unknown as D1Database, { since: "2026-09-19T00:00:00.000Z", limit: 2, liveOnly: true, site: "PNN" });
    expect(filtered.prepared[1].args).toEqual(["2026-09-19T00:00:00.000Z", "PNN", "PNN", t2, "wip-b"]);
    expect(filtered.prepared[1].sql).toContain("p.deleted_at IS NULL");
    // The row past the limit stands at a new instant: the page is cut at the limit, more true, one query.
    const clean = fakeDb([a, b, row({ id: "wip-e", changed_at: "2026-09-20T13:00:00.000Z" })]);
    const cut = await listTrimWeighs(clean as unknown as D1Database, { since: null, limit: 2, liveOnly: false, site: null });
    expect(cut.rows.map((r) => r.id)).toEqual(["wip-a", "wip-b"]);
    expect(cut.more).toBe(true);
    expect(clean.prepared).toHaveLength(1);
    // The envelope reads more from the page, not from the count against the limit.
    const feed = trimWeighsFeed(page, { since: null, limit: 2, liveOnly: false, site: null }, "2026-09-20T13:00:00.000Z");
    expect(feed.count).toBe(4);
    expect(feed.more).toBe(true);
    expect(feed.next_since).toBe(t2);
    const lastPage: TrimWeighsPage = { rows: [a, b, c, d], more: false };
    expect(trimWeighsFeed(lastPage, { since: null, limit: 2, liveOnly: false, site: null }, "2026-09-20T13:00:00.000Z").more).toBe(false);
  });

  // THE FEED READS THE HBN (canon 0.30.141; owner: "the feed doesn't carry it but the data hides it in the HBN").
  it("filters by site through the HBN's farm segment, the batch's farm standing in for an HBN that is not a mint", async () => {
    const db = fakeDb([]);
    await listTrimWeighs(db as unknown as D1Database, { since: null, limit: 500, liveOnly: false, site: "ARL" });
    const sql = db.prepared[0].sql.replace(/\s+/g, " ");
    expect(sql).toContain("(b.hbn LIKE '_____-' || ? || '-%' OR (COALESCE(b.hbn, '') NOT LIKE '_____-%-%-%-%-%-%' AND b.farm_code = ?))");
    expect(db.prepared[0].args).toEqual(["ARL", "ARL", 501]);
  });

  it("reads the HBN back: harvest day, farm, grow code, strain code, manicure, the dry space segment and the serial", () => {
    expect(parseHbn("26257-PNN-OD-070-0-02-26011")).toEqual({
      harvest_day: "2026-09-14",
      farm: "PNN",
      grow_code: "OD",
      strain_code: "070",
      manicure: false,
      silo: "02",
      serial: "26011",
    });
    expect(parseHbn("26263-ARL-GH-012-1-NA-26018")).toEqual({
      harvest_day: "2026-09-20",
      farm: "ARL",
      grow_code: "GH",
      strain_code: "012",
      manicure: true,
      silo: null,
      serial: "26018",
    });
    expect(parseHbn("LEGACY-1")).toBeNull();
    expect(parseHbn("")).toBeNull();
    expect(parseHbn(null)).toBeNull();
    expect(parseHbn("26257--OD-070-0-02-26011")).toBeNull();
    expect(dateFromYyddd("26001")).toBe("2026-01-01");
    expect(dateFromYyddd("26365")).toBe("2026-12-31");
    expect(dateFromYyddd("26366")).toBeNull();
    expect(dateFromYyddd("2626")).toBeNull();
    expect(feedSiteOf("26257-PNN-OD-070-0-02-26011", "ARL")).toBe("PNN");
    expect(feedSiteOf("LEGACY-1", "ARL")).toBe("ARL");
    expect(feedSiteOf(null, null)).toBeNull();
    expect(feedDryMethodOf("26257-PNN-OD-070-0-02-26011")).toBe("silo");
    expect(feedDryMethodOf("26263-ARL-GH-012-1-NA-26018")).toBe("hang");
    expect(feedDryMethodOf("LEGACY-1")).toBeNull();
    // The facility: the ledger row's line first, else the lot's inherited line, else nothing.
    expect(feedLicenseOf({ license_value: LICENSE_ARL_MED, batch_license: null, lot_id: "lot-1" }, "ARL")).toBe(LICENSE_ARL_MED);
    expect(feedLicenseOf({ license_value: null, batch_license: LICENSE_ARL_MED, lot_id: "lot-1" }, "ARL")).toBe(LICENSE_ARL_MED);
    expect(feedLicenseOf({ license_value: null, batch_license: null, lot_id: "lot-1" }, "ARL")).toBe(LICENSE_ARL_AU);
    expect(feedLicenseOf({ license_value: null, batch_license: null, lot_id: null }, null)).toBeNull();
  });

  it("shapes the feed: each weigh keyed by its id with tag, stream, grams, the UTC weigh instant, date, operator, station, site, license, dry method, lot, instants and voided_at; next_since and more for the poller", () => {
    const rows = [
      row(),
      row({
        id: "wip-2",
        package_code: "26018-SHAKE-1",
        // An off-shape code kept as typed on the ledger row (THE TAG LAW) is no tag to the feed.
        metrc_tag: "26018-SHAKE-1",
        stream: "SHAKE",
        stream_label: null,
        weight_grams: 100.004,
        trim_operator: null,
        hbn: "26263-ARL-GH-012-1-NA-26018",
        metrc_harvest_tag: "1A4060300003E5B000099999",
        // The batch was minted under R&D but its market label was typed; the feed names the real strain and keeps the label beside it.
        strain: "Wild Mango Creamsicle",
        market_strain: "R&D",
        // The batch says PNN; the HBN says ARL, and the HBN is the reading.
        farm_code: "PNN",
        license_value: null,
        batch_license: LICENSE_ARL_MED,
        updated_at: "2026-09-20T12:05:00.000Z",
        changed_at: "2026-09-20T12:30:00.000Z",
        voided_at: "2026-09-20T12:30:00.000Z",
      }),
    ];
    const feed = trimWeighsFeed(rows, { since: "2026-09-20T00:00:00.000Z", limit: 2, liveOnly: false, site: null }, "2026-09-20T13:00:00.000Z");
    expect(feed.feed).toBe("trim_weighs");
    expect(feed.generated_at).toBe("2026-09-20T13:00:00.000Z");
    expect(feed.since).toBe("2026-09-20T00:00:00.000Z");
    expect(feed.site).toBeNull();
    expect(feed.count).toBe(2);
    expect(feed.next_since).toBe("2026-09-20T12:30:00.000Z");
    expect(feed.more).toBe(true);
    expect(feed.rows[0]).toEqual({
      id: "wip-1",
      package_code: "26011-SMALLS-1",
      metrc_tag: "1A4060300003E5B000012345",
      stream: "SMALLS",
      stream_label: "Smalls",
      weight_grams: 453.6,
      weighed_at: "2026-09-20T12:00:00.000Z",
      trim_date: "2026-09-20",
      operator: "Lead",
      station: "trim_packages",
      status: "cryo_queue",
      site: "PNN",
      license: LICENSE_AU_GROW,
      dry_method: "silo",
      lot: {
        id: "lot-1",
        hbn: "26257-PNN-OD-070-0-02-26011",
        short_id: "26011",
        strain: "Fruity Pebbles",
        market_strain: "Fruity Pebbles",
        farm: "PNN",
        metrc_harvest_tag: null,
        hbn_parts: { harvest_day: "2026-09-14", farm: "PNN", grow_code: "OD", strain_code: "070", manicure: false, silo: "02", serial: "26011" },
      },
      created_at: "2026-09-20T12:00:00.000Z",
      updated_at: "2026-09-20T12:00:00.000Z",
      changed_at: "2026-09-20T12:00:00.000Z",
      voided_at: null,
    });
    expect(feed.rows[1].weight_grams).toBe(100.004);
    expect(feed.rows[1].metrc_tag).toBeNull();
    expect(feed.rows[1].stream_label).toBeNull();
    expect(feed.rows[1].operator).toBeNull();
    expect(feed.rows[1].site).toBe("ARL");
    expect(feed.rows[1].lot.farm).toBe("PNN");
    expect(feed.rows[1].license).toBe(LICENSE_ARL_MED);
    expect(feed.rows[1].dry_method).toBe("hang");
    expect(feed.rows[1].lot.metrc_harvest_tag).toBe("1A4060300003E5B000099999");
    expect(feed.rows[1].lot.strain).toBe("Wild Mango Creamsicle");
    expect(feed.rows[1].lot.market_strain).toBe("R&D");
    expect(feed.rows[1].lot.hbn_parts?.harvest_day).toBe("2026-09-20");
    expect(feed.rows[1].voided_at).toBe("2026-09-20T12:30:00.000Z");
    expect(feedTagOf("1a4060300003e5b000012345")).toBe("1A4060300003E5B000012345");
    expect(feedTagOf("TRIM-SMOKE-1")).toBeNull();
    expect(feedTagOf(null)).toBeNull();
    const empty = trimWeighsFeed([], { since: "2026-09-20T12:30:00.000Z", limit: 500, liveOnly: false, site: "PNS" }, "2026-09-20T13:00:00.000Z");
    expect(empty.count).toBe(0);
    expect(empty.site).toBe("PNS");
    expect(empty.next_since).toBe("2026-09-20T12:30:00.000Z");
    expect(empty.more).toBe(false);
  });
});

/** A D1 stand-in for the harvest feed: PRAGMA answers the column list, and each later statement takes the next page. */
function harvestDb(columns: string[], ...sets: HarvestBatchRow[][]) {
  const prepared: Array<{ sql: string; args: unknown[] }> = [];
  const queue = sets.length ? [...sets] : [[]];
  return {
    prepared,
    prepare(sql: string) {
      const args: unknown[] = [];
      const self = {
        bind(...next: unknown[]) {
          args.push(...next);
          return self;
        },
        async all() {
          prepared.push({ sql, args: [...args] });
          if (sql.includes("table_info")) return { results: columns.map((name) => ({ name })) };
          const rows = queue.length > 1 ? queue.shift()! : queue[0];
          return { results: rows };
        },
      };
      return self;
    },
  };
}

function lot(over: Partial<HarvestBatchRow> = {}): HarvestBatchRow {
  return {
    id: "lot-1",
    hbn: "26244-PNN-GH-027-0-01-26013",
    strain: "Fruity Pebbles",
    market_strain: "Fruity Pebbles",
    farm_code: "PNN",
    plant_count: 1200,
    wet_weight_grams: 1235,
    dry_weight_grams: null,
    space_id: "silo-1",
    space_name: "Silo 1",
    space_kind: "silo",
    truck_number: null,
    unload_effective_date: null,
    unload_finished_raw: null,
    status: "weighing",
    created_at: "2026-09-01T14:00:00.000Z",
    changed_at: "2026-09-01T15:00:00.000Z",
    voided_at: null,
    customer: null,
    ...over,
  };
}

describe("THE HARVEST BATCH FEED (BRIEF HB1: one row per wet lot, the trim weighs door, read only)", () => {
  it("uses the trim query and the /feeds door", () => {
    expect(HARVEST_BATCHES_PATH).toBe("/feeds/harvest-batches.json");
    expect(isServiceRoute("GET", HARVEST_BATCHES_PATH)).toBe(true);
    expect(isServiceRoute("POST", HARVEST_BATCHES_PATH)).toBe(false);
    expect(feedGrowMethodOf("26244-PNN-GH-027-0-01-26013")).toBe("greenhouse");
    expect(feedGrowMethodOf("26257-PNN-OD-070-0-02-26011")).toBe("outdoor");
    expect(feedGrowMethodOf("26257-PNN-ID-070-0-02-26011")).toBe("indoor");
    expect(feedGrowMethodOf("MANUAL-26099")).toBeNull();
    expect(feedGrowMethodOf("26257-PNN-XX-070-0-02-26011")).toBeNull();
    expect(feedDrySpaceOf({ spaceId: "silo-1", spaceName: "Silo 1", spaceKind: "silo", truckNumber: "4" })).toBe("Silo 1");
    expect(feedDrySpaceOf({ spaceId: TRUCK_DRY_SPACE_ID, spaceName: "Truck", spaceKind: "truck", truckNumber: "4" })).toBe("Truck 4");
    expect(feedDrySpaceOf({ spaceId: "room-1", spaceName: "Arlington Dry Room", spaceKind: "hang", truckNumber: null })).toBe("Arlington Dry Room");
    expect(feedUnloadFinishedAt(null, null)).toBeNull();
    expect(feedUnloadFinishedAt("2026-09-08", "2026-09-09T02:00:00.000Z")).toBe("2026-09-08");
    expect(feedUnloadFinishedAt(null, "2026-09-08T03:00:00.000Z")).toBe("2026-09-07");
    expect(feedUnloadFinishedAt("not-a-date", "2026-09-08T15:00:00.000Z")).toBe("2026-09-08");
  });

  it("reads live lots only when asked, after since, by the widest change instant, test HBNs never, and names customer only once the column exists", async () => {
    const db = harvestDb(["id"], [lot()]);
    const page = await listHarvestBatches(db as unknown as D1Database, { since: "2026-09-01T00:00:00.000Z", limit: 100, liveOnly: true, site: "PNN" });
    expect(page).toEqual({ rows: [lot()], more: false });
    expect(db.prepared[0].sql).toContain("PRAGMA table_info(harvest_batches)");
    const sql = db.prepared[1].sql.replace(/\s+/g, " ");
    expect(sql).toContain("FROM wet_weight_entries w");
    expect(sql).toContain("JOIN harvest_batches b ON b.id = w.harvest_batch_id");
    expect(sql).toContain("s.name AS strain, COALESCE(b.market_strain, s.name) AS market_strain");
    expect(sql).toContain("COALESCE(b.is_test, 0) = 0");
    expect(sql).toContain("NULL AS customer");
    expect(sql).not.toContain("b.customer AS customer");
    expect(sql).toContain("SUM(ww.weight_grams) FROM wet_weights ww");
    expect(sql).toContain("ww.deleted_at IS NULL");
    expect(sql).toContain("SUM(dw.weight_grams) FROM dry_weights dw");
    expect(sql).toContain("FROM silo_loads sl");
    expect(sql).toContain("COALESCE(us.finished_at, '')");
    expect(sql).toContain("FROM wet_weights ww");
    expect(sql).toContain("FROM dry_weights dw");
    expect(sql).toContain("AND w.deleted_at IS NULL");
    expect(sql).toContain("(b.hbn LIKE '_____-' || ? || '-%' OR (COALESCE(b.hbn, '') NOT LIKE '_____-%-%-%-%-%-%' AND b.farm_code = ?))");
    expect(sql).toContain("u2.finished_at IS NOT NULL");
    expect(sql).toMatch(/ORDER BY max\( max\(w\.created_at, w\.updated_at, COALESCE\(w\.deleted_at, ''\)\),[\s\S]*ASC, w\.id ASC LIMIT \?$/);
    expect(db.prepared[1].args).toEqual(["2026-09-01T00:00:00.000Z", "PNN", "PNN", 101]);
    const plain = harvestDb(["id"]);
    await listHarvestBatches(plain as unknown as D1Database, { since: null, limit: 500, liveOnly: false, site: null });
    const plainSql = plain.prepared[1].sql.replace(/\s+/g, " ");
    expect(plainSql).toContain("WHERE COALESCE(b.is_test, 0) = 0 ORDER BY");
    expect(plainSql).not.toContain("b.hbn LIKE");
    expect(plain.prepared[1].args).toEqual([501]);
    const tolled = harvestDb(["id", "customer"]);
    await listHarvestBatches(tolled as unknown as D1Database, { since: null, limit: 500, liveOnly: false, site: null });
    expect(tolled.prepared[1].sql).toContain("b.customer AS customer");
    expect(tolled.prepared[1].sql).not.toContain("NULL AS customer");
  });

  it("never ends a page inside a tie", async () => {
    const t1 = "2026-09-01T15:00:00.000Z";
    const t2 = "2026-09-01T16:00:00.000Z";
    const a = lot({ id: "lot-a", changed_at: t1 });
    const b = lot({ id: "lot-b", changed_at: t2 });
    const c = lot({ id: "lot-c", changed_at: t2 });
    const tied = harvestDb(["id"], [a, b, c], [c]);
    const page = await listHarvestBatches(tied as unknown as D1Database, { since: null, limit: 2, liveOnly: false, site: null });
    expect(page.rows.map((r) => r.id)).toEqual(["lot-a", "lot-b", "lot-c"]);
    expect(page.more).toBe(true);
    expect(tied.prepared).toHaveLength(3);
    const tailSql = tied.prepared[2].sql.replace(/\s+/g, " ");
    expect(tailSql).toContain("FROM silo_loads sl");
    expect(tailSql).toMatch(/w\.id > \? ORDER BY w\.id ASC$/);
    expect(tied.prepared[2].args).toEqual([t2, "lot-b"]);
    const clean = harvestDb(["id"], [a, b, lot({ id: "lot-e", changed_at: "2026-09-01T17:00:00.000Z" })]);
    const cut = await listHarvestBatches(clean as unknown as D1Database, { since: null, limit: 2, liveOnly: false, site: null });
    expect(cut.rows.map((r) => r.id)).toEqual(["lot-a", "lot-b"]);
    expect(cut.more).toBe(true);
    expect(clean.prepared).toHaveLength(2);
  });

  it("shapes a lot: the HBN read back, a partial dry total, the unload date as the final signal, a void, a toll customer, and nulls when the HBN does not parse", () => {
    const rows = [
      lot(),
      lot({
        id: "lot-2",
        hbn: "GreenCo-DonFernando-26999",
        strain: null,
        market_strain: null,
        farm_code: "PNS",
        plant_count: null,
        wet_weight_grams: 227000,
        dry_weight_grams: 400,
        space_id: TRUCK_DRY_SPACE_ID,
        space_name: "Truck",
        space_kind: "truck",
        truck_number: "2",
        unload_effective_date: null,
        unload_finished_raw: null,
        status: "drying",
        changed_at: "2026-09-02T12:00:00.000Z",
        customer: "GreenCo",
      }),
      lot({
        id: "lot-3",
        hbn: "26263-ARL-GH-012-1-NA-26018",
        strain: "Grip Cake",
        market_strain: "R&D",
        farm_code: "PNN",
        plant_count: 10,
        wet_weight_grams: 5000,
        dry_weight_grams: 1800,
        space_id: "room-1",
        space_name: "Arlington Dry Room",
        space_kind: "hang",
        unload_effective_date: "2026-09-20",
        unload_finished_raw: "2026-09-21T02:00:00.000Z",
        status: "unloaded",
        changed_at: "2026-09-21T02:00:00.000Z",
        voided_at: "2026-09-21T02:00:00.000Z",
      }),
    ];
    const feed = harvestBatchesFeed(rows, { since: null, limit: 2, liveOnly: false, site: null }, "2026-09-21T12:00:00.000Z");
    expect(feed.feed).toBe("harvest_batches");
    expect(feed.count).toBe(3);
    expect(feed.more).toBe(true);
    expect(feed.next_since).toBe("2026-09-21T02:00:00.000Z");
    expect(feed.rows[0]).toEqual({
      id: "lot-1",
      hbn: "26244-PNN-GH-027-0-01-26013",
      short_id: "26013",
      strain: "Fruity Pebbles",
      market_strain: "Fruity Pebbles",
      farm: "PNN",
      grow_method: "greenhouse",
      harvest_day: "2026-09-01",
      plant_count: 1200,
      wet_weight_grams: 1235,
      dry_method: "silo",
      dry_space: "Silo 1",
      dry_weight_grams: null,
      unload_finished_at: null,
      status: "weighing",
      created_at: "2026-09-01T14:00:00.000Z",
      changed_at: "2026-09-01T15:00:00.000Z",
      voided_at: null,
      customer: null,
      hbn_parts: {
        harvest_day: "2026-09-01",
        farm: "PNN",
        grow_code: "GH",
        strain_code: "027",
        manicure: false,
        silo: "01",
        serial: "26013",
      },
    });
    expect(feed.rows[1].hbn).toBe("GreenCo-DonFernando-26999");
    expect(feed.rows[1].short_id).toBeNull();
    expect(feed.rows[1].strain).toBeNull();
    expect(feed.rows[1].market_strain).toBeNull();
    expect(feed.rows[1].farm).toBe("PNS");
    expect(feed.rows[1].grow_method).toBeNull();
    expect(feed.rows[1].harvest_day).toBeNull();
    expect(feed.rows[1].dry_method).toBeNull();
    expect(feed.rows[1].hbn_parts).toBeNull();
    expect(feed.rows[1].dry_space).toBe("Truck 2");
    expect(feed.rows[1].dry_weight_grams).toBe(400);
    expect(feed.rows[1].unload_finished_at).toBeNull();
    expect(feed.rows[1].customer).toBe("GreenCo");
    expect(feed.rows[1].plant_count).toBeNull();
    expect(feed.rows[2].farm).toBe("ARL");
    expect(feed.rows[2].dry_method).toBe("hang");
    expect(feed.rows[2].dry_space).toBe("Arlington Dry Room");
    expect(feed.rows[2].grow_method).toBe("greenhouse");
    expect(feed.rows[2].market_strain).toBe("R&D");
    expect(feed.rows[2].dry_weight_grams).toBe(1800);
    expect(feed.rows[2].unload_finished_at).toBe("2026-09-20");
    expect(feed.rows[2].voided_at).toBe("2026-09-21T02:00:00.000Z");
    const last: HarvestBatchesPage = { rows, more: false };
    expect(harvestBatchesFeed(last, { since: null, limit: 2, liveOnly: false, site: null }, "2026-09-21T12:00:00.000Z").more).toBe(false);
    const none = harvestBatchesFeed([], { since: "2026-09-01T00:00:00.000Z", limit: 500, liveOnly: true, site: "ARL" }, "2026-09-21T12:00:00.000Z");
    expect(none.count).toBe(0);
    expect(none.more).toBe(false);
    expect(none.next_since).toBe("2026-09-01T00:00:00.000Z");
    expect(none.site).toBe("ARL");
  });
});
