import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { directorWallPage, loadDirectorWall } from "../src/director";
import {
  foldWetHours,
  harvestWindow,
  lbsHarvestedBody,
  leastSquares,
  leastSquaresAt,
  refreshLbsHarvested,
  wetPounds,
  type HarvestDay,
} from "../src/ddsnapshot";
import { farmDay } from "../src/farmday";
import { migratedDb, seedBatch } from "./migrated";

type Row = Record<string, unknown>;

const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const NOW = "2026-10-19T18:00:00.000Z";
const BEFORE = "2026-10-18T09:30:00.000Z";
const AT = "2026-10-18T10:00:00.000Z";
const TS = "2026-09-01T00:00:00.000Z";

function entry(m: Awaited<ReturnType<typeof migratedDb>>, id: string, batchId: string, deletedAt: string | null = null): void {
  m.run(
    `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, created_at, updated_at, deleted_at)
     VALUES (?, ?, 0, 'silo', 'drying', ?, ?, ?)`,
    id,
    batchId,
    TS,
    TS,
    deletedAt
  );
}

function tote(m: Awaited<ReturnType<typeof migratedDb>>, id: string, entryId: string, grams: number, at: string, deletedAt: string | null = null): void {
  m.run(
    `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    entryId,
    grams,
    at,
    at,
    deletedAt
  );
}

async function floor(): Promise<Awaited<ReturnType<typeof migratedDb>>> {
  const m = await migratedDb();
  m.run(`UPDATE app_config SET value = '6' WHERE key = 'farm_day_start_hour'`);
  m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('s-dd', 'Strain', '099', ?, ?)`, TS, TS);
  const ownEarly = seedBatch(m, { id: "b-early", hbn: "26001-PNS-GH-099", serial: 801, farm: "PNS", strainId: "s-dd" });
  const ownDay = seedBatch(m, { id: "b-day", hbn: "26002-PNN-GH-099", serial: 802, farm: "PNN", strainId: "s-dd" });
  const toll = seedBatch(m, { id: "b-toll", hbn: "26003-PNS-GH-099", serial: 803, farm: "PNS", strainId: "s-dd" });
  const testLot = seedBatch(m, { id: "b-test", hbn: "26004-ARL-GH-099", serial: 804, farm: "ARL", strainId: "s-dd" });
  const ownDel = seedBatch(m, { id: "b-del", hbn: "26005-PNN-GH-099", serial: 805, farm: "PNN", strainId: "s-dd" });
  const ownEntry = seedBatch(m, { id: "b-entry", hbn: "26006-ARL-GH-099", serial: 806, farm: "ARL", strainId: "s-dd" });
  m.run(`UPDATE harvest_batches SET customer = 'GreenCo' WHERE id = 'b-toll'`);
  m.run(`UPDATE harvest_batches SET is_test = 1 WHERE id = 'b-test'`);
  entry(m, "e-early", ownEarly);
  entry(m, "e-day", ownDay);
  entry(m, "e-toll", toll);
  entry(m, "e-test", testLot);
  entry(m, "e-del", ownDel);
  entry(m, "e-gone", ownEntry, TS);
  tote(m, "w-early", "e-early", 2240, BEFORE);
  tote(m, "w-day", "e-day", 4480, AT);
  tote(m, "w-toll", "e-toll", 9000, AT);
  tote(m, "w-test", "e-test", 9000, AT);
  tote(m, "w-del", "e-del", 9000, AT, TS);
  tote(m, "w-gone", "e-gone", 9000, AT);
  return m;
}

function live(m: Awaited<ReturnType<typeof migratedDb>>): Row[] {
  return m.all(
    `SELECT period_start, dim_key, value, n FROM dd_kpi_values
     WHERE kpi_key = 'bizops.lbs_processed' AND superseded_at IS NULL
     ORDER BY period_start, dim_key`
  );
}

describe("Lbs Harvested series", () => {
  it("buckets across the farm day start hour and keeps toll, test, and deleted rows out", () => {
    expect(farmDay(BEFORE, 6)).toBe("2026-10-17");
    expect(farmDay(AT, 6)).toBe("2026-10-18");
    const folded = foldWetHours(
      [
        { hour_key: BEFORE.slice(0, 13), farm: "PNS", grams: 2240, n: 1, newest: BEFORE },
        { hour_key: AT.slice(0, 13), farm: "PNN", grams: 4480, n: 1, newest: AT },
      ],
      6
    );
    expect(folded.map((row) => row.day).sort()).toEqual(["2026-10-17", "2026-10-18"]);
    expect(wetPounds(2240)).toBe(5);
    expect(wetPounds(4480)).toBe(10);
  });

  it("the year sum equals the console yearWet sum to the gram, and a second refresh writes nothing", async () => {
    const m = await floor();
    const yearWet = Number(
      m.get(
        `SELECT COALESCE(SUM(x.weight_grams), 0) AS grams
         FROM wet_weights x
         JOIN wet_weight_entries w ON w.id = x.wet_weight_entry_id AND w.deleted_at IS NULL
         JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
         WHERE x.deleted_at IS NULL AND b.harvest_year = 2026
           AND COALESCE(b.is_test, 0) = 0 AND (b.customer IS NULL OR TRIM(b.customer) = '')`
      )?.grams
    );
    expect(yearWet).toBe(6720);
    const first = await refreshLbsHarvested(m.db, NOW);
    expect(first.grams).toBe(yearWet);
    expect(first.written).toBe(4);
    expect(first.year).toBe(2026);
    expect(live(m)).toEqual([
      { period_start: "2026-10-17", dim_key: "", value: 5, n: 1 },
      { period_start: "2026-10-17", dim_key: "PNS", value: 5, n: 1 },
      { period_start: "2026-10-18", dim_key: "", value: 10, n: 1 },
      { period_start: "2026-10-18", dim_key: "PNN", value: 10, n: 1 },
    ]);
    expect(m.get(`SELECT def_version, source FROM dd_kpi_values WHERE kpi_key = 'bizops.lbs_processed' AND superseded_at IS NULL LIMIT 1`)).toMatchObject({
      def_version: 2,
      source: "app",
    });
    const ids = m.all(`SELECT id FROM dd_kpi_values WHERE kpi_key = 'bizops.lbs_processed' AND superseded_at IS NULL ORDER BY id`);
    const second = await refreshLbsHarvested(m.db, NOW);
    expect(second.written).toBe(0);
    expect(m.all(`SELECT id FROM dd_kpi_values WHERE kpi_key = 'bizops.lbs_processed' AND superseded_at IS NULL ORDER BY id`)).toEqual(ids);
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE kpi_key = 'bizops.lbs_processed' AND superseded_at IS NOT NULL`)?.n).toBe(0);
  });

  it("a changed tote supersedes the farm row and the day total, and a day that drops to zero stays as zero", async () => {
    const m = await floor();
    await refreshLbsHarvested(m.db, NOW);
    const kept = String(m.get(`SELECT id AS id FROM dd_kpi_values WHERE period_start = '2026-10-17' AND dim_key = 'PNS' AND superseded_at IS NULL`)?.id);
    const pnn = String(m.get(`SELECT id AS id FROM dd_kpi_values WHERE period_start = '2026-10-18' AND dim_key = 'PNN' AND superseded_at IS NULL`)?.id);
    const total = String(m.get(`SELECT id AS id FROM dd_kpi_values WHERE period_start = '2026-10-18' AND dim_key = '' AND superseded_at IS NULL`)?.id);
    m.run(`UPDATE wet_weights SET weight_grams = 8960 WHERE id = 'w-day'`);
    const changed = await refreshLbsHarvested(m.db, NOW);
    expect(changed.written).toBe(2);
    expect(m.get(`SELECT id AS id FROM dd_kpi_values WHERE period_start = '2026-10-17' AND dim_key = 'PNS' AND superseded_at IS NULL`)?.id).toBe(kept);
    expect(m.get(`SELECT superseded_at FROM dd_kpi_values WHERE id = ?`, pnn)?.superseded_at).toBe(NOW);
    expect(m.get(`SELECT superseded_at FROM dd_kpi_values WHERE id = ?`, total)?.superseded_at).toBe(NOW);
    expect(m.get(`SELECT value, n FROM dd_kpi_values WHERE period_start = '2026-10-18' AND dim_key = 'PNN' AND superseded_at IS NULL`)).toMatchObject({
      value: 20,
      n: 1,
    });
    expect(m.all(`SELECT id FROM dd_kpi_values WHERE period_start = '2026-10-18' AND dim_key = 'PNN' AND superseded_at IS NULL`)).toHaveLength(1);
    m.run(`UPDATE wet_weights SET deleted_at = ? WHERE id = 'w-early'`, NOW);
    const dropped = await refreshLbsHarvested(m.db, NOW);
    expect(dropped.written).toBe(2);
    expect(m.get(`SELECT value, n FROM dd_kpi_values WHERE period_start = '2026-10-17' AND dim_key = '' AND superseded_at IS NULL`)).toMatchObject({
      value: 0,
      n: 0,
    });
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE period_start = '2026-10-17' AND dim_key = ''`)?.n).toBe(2);
    expect(m.get(`SELECT value FROM dd_kpi_values WHERE period_start = '2026-10-18' AND dim_key = '' AND superseded_at IS NULL`)?.value).toBe(20);
  });
});

function day(dayName: string, lb: number, farms: HarvestDay["farms"], n = 1): HarvestDay {
  return { day: dayName, lb, n, farms };
}

function chartOf(html: string, period: string): string {
  const token = `data-dd-harvest-chart="${period}"`;
  const start = html.indexOf(token);
  const next = html.indexOf("data-dd-harvest-chart=", start + token.length);
  return html.slice(start, next === -1 ? undefined : next);
}

describe("Lbs Harvested tile", () => {
  it("keeps the HTD headline, lists the four periods, draws the window with gaps, and omits the trend under 3 bars", () => {
    const days: HarvestDay[] = [];
    for (let i = 0; i < 20; i += 1) {
      const date = new Date(Date.parse("2026-09-30T00:00:00.000Z") + i * 86_400_000).toISOString().slice(0, 10);
      if (date === "2026-10-10") continue;
      days.push(day(date, 1, { PNN: 0.25, PNS: 0.5, ARL: 0.25 }));
    }
    const html = lbsHarvestedBody({ today: "2026-10-19", days }, "en", 448);
    expect(html.match(/data-dd-harvest-headline=/g)).toHaveLength(1);
    expect(html).toContain('data-dd-harvest-headline="19"');
    expect(html).toContain(">19.0<span");
    expect(html).toContain("HTD, Sep 30 to Oct 19");
    expect(html).toContain('value="7"');
    expect(html).toContain('value="14" selected');
    expect(html).toContain('value="30"');
    expect(html).toContain('value="htd"');
    expect(chartOf(html, "7").match(/data-dd-bar="/g)).toHaveLength(7);
    expect(chartOf(html, "htd")).toContain('data-dd-bar="2026-10-10" data-dd-empty="1"');
    expect(chartOf(html, "htd")).toContain("data-dd-trend");
    const short = lbsHarvestedBody(
      {
        today: "2026-10-19",
        days: [day("2026-10-18", 4, { PNN: 1, PNS: 2, ARL: 1 }, 3), day("2026-10-19", 2, { PNN: 2, PNS: 0, ARL: 0 }, 1)],
      },
      "en",
      448
    );
    expect(chartOf(short, "htd")).not.toContain("data-dd-trend");
    expect(harvestWindow("htd", "2026-10-19", "2026-10-18")).toEqual(["2026-10-18", "2026-10-19"]);
    expect(leastSquares([1, 2])).toBeNull();
    expect(leastSquares([1, 2, 3])).toEqual({ a: 1, b: 1 });
    // Scribe gate fix: the trend skips empty days. Harvest days at 10 on x 0, 1, 3, 4 with a
    // gap at x 2 fit flat (b 0); a zero for the gap would have bent it.
    expect(leastSquaresAt([{ x: 0, y: 10 }, { x: 1, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 }])).toEqual({ a: 10, b: 0 });
    const flat: HarvestDay[] = [];
    for (let i = 0; i < 14; i += 1) {
      const date = new Date(Date.parse("2026-10-06T00:00:00.000Z") + i * 86_400_000).toISOString().slice(0, 10);
      if (new Date(`${date}T00:00:00.000Z`).getUTCDay() === 0) continue;
      flat.push(day(date, 10, { PNN: 10, PNS: 0, ARL: 0 }));
    }
    const flatHtml = chartOf(lbsHarvestedBody({ today: "2026-10-19", days: flat }, "en", 448), "14");
    const trendLine = /data-dd-trend="1" x1="[0-9.]+" y1="([0-9.]+)" x2="[0-9.]+" y2="([0-9.]+)"/.exec(flatHtml);
    expect(trendLine).not.toBeNull();
    expect(trendLine?.[1]).toBe(trendLine?.[2]);
    const early = chartOf(short, "htd");
    const tip = early.slice(early.indexOf('data-dd-bar="2026-10-18"'), early.indexOf('data-dd-bar="2026-10-19"'));
    expect(tip).toContain("PNN 1.00, PNS 2.00, ARL 1.00");
    expect(tip).toContain("3 totes");
    expect(tip).not.toContain("so far");
    expect(early).toContain("so far");
    expect(short).toContain('href="/harvest#strain-performance"');
    expect(DASH.test(html)).toBe(false);
    expect(DASH.test(short)).toBe(false);
    const es = lbsHarvestedBody(
      { today: "2026-10-19", days: [day("2026-10-19", 2, { PNN: 2, PNS: 0, ARL: 0 })] },
      "es",
      448
    );
    expect(es).toContain("HTD, 19 oct a 19 oct");
    expect(es).toContain("7 dias");
    expect(es).toContain("Rendimiento por variedad");
    expect(es).toContain("hasta ahora");
    expect(DASH.test(es)).toBe(false);
  });

  it("a wall with no stored days keeps the no data look, and a wall with days shows the chart", async () => {
    const empty = await migratedDb();
    const bare = directorWallPage(await loadDirectorWall(empty.db, "bizops", "2026-10-19", null, null, NOW), "en");
    const at = bare.indexOf('data-dd-kpi="bizops.lbs_processed"');
    const tile = bare.slice(bare.lastIndexOf("<article", at), bare.indexOf("</article>", at));
    expect(tile).toContain("No data yet");
    expect(tile).toContain('data-dd-version="2"');
    expect(tile).not.toContain("data-dd-harvest");
    expect(tile).not.toContain("data-dd-question");
    const m = await floor();
    await refreshLbsHarvested(m.db, NOW);
    const page = directorWallPage(await loadDirectorWall(m.db, "bizops", "2026-10-19", null, null, NOW), "en");
    const start = page.indexOf('data-dd-kpi="bizops.lbs_processed"');
    const body = page.slice(page.lastIndexOf("<article", start), page.indexOf("</article>", start));
    expect(body).toContain("Lbs Harvested");
    expect(body).toContain('data-dd-harvest-headline="15"');
    expect(body).toContain("data-dd-bar");
    expect(body).toContain('href="/harvest#strain-performance"');
    expect(body).not.toContain("data-dd-question");
    expect(DASH.test(body)).toBe(false);
  });
});

describe("Lbs Harvested cron", () => {
  it("runs on the hourly cron string only", async () => {
    const m = await floor();
    const env = { DB: m.db, THEME: "grip" } as unknown as Env;
    const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext;
    const tick = (cron: string) => worker.scheduled({ cron, scheduledTime: Date.now(), noRetry: () => undefined } as ScheduledController, env, ctx);
    const count = () => Number(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE kpi_key = 'bizops.lbs_processed'`)?.n);
    await tick("*/5 * * * *");
    expect(count()).toBe(0);
    await tick("45 * * * *");
    expect(count()).toBe(0);
    await tick("15 * * * *");
    expect(count()).toBeGreaterThan(0);
  }, 20000);
});

describe("migration 0106", () => {
  it("is LF, guarded, and a second apply changes nothing", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const sql = fs.readFileSync(new URL("../migrations/0106_dd_lbs_harvested.sql", import.meta.url), "utf8");
    expect(sql.includes("\r")).toBe(false);
    expect(sql.includes('"')).toBe(false);
    expect(sql.includes("%")).toBe(false);
    expect(DASH.test(sql)).toBe(false);
    expect(sql).toContain("AND title_en = 'Lbs processed'");
    expect(sql).toContain("AND ruling = 'trim,cryo,prepack'");
    const m = await migratedDb();
    const before = m.get(`SELECT title_en, def_version, ruling FROM dd_kpis k JOIN dd_kpi_questions q ON q.question_key = 'processed_lbs' WHERE k.kpi_key = 'bizops.lbs_processed'`);
    expect(before).toMatchObject({ title_en: "Lbs Harvested", def_version: 2, ruling: "wet_harvested" });
    const statements: string[] = [];
    let current = "";
    let quote = false;
    for (let i = 0; i < sql.length; i += 1) {
      const ch = sql[i] ?? "";
      if (ch === "'") {
        current += ch;
        if (quote && sql[i + 1] === "'") {
          current += "'";
          i += 1;
          continue;
        }
        quote = !quote;
        continue;
      }
      if (ch === ";" && !quote) {
        if (current.trim()) statements.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    for (const statement of statements) m.run(statement);
    const after = m.get(`SELECT title_en, def_version, ruling, reason FROM dd_kpis k JOIN dd_kpi_questions q ON q.question_key = 'processed_lbs' WHERE k.kpi_key = 'bizops.lbs_processed'`);
    expect(after).toMatchObject({
      title_en: "Lbs Harvested",
      def_version: 2,
      ruling: "wet_harvested",
      reason: "owner 2026-10-19: Lbs processed means wet lbs harvested",
    });
  });
});
