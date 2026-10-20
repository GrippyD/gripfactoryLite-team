import { describe, expect, it } from "vitest";
import { format2 } from "../src/config";
import { consoleBoxes, type HarvestConsoleInput } from "../src/console";
import worker from "../src/index";
import { directorWallPage, loadDirectorWall } from "../src/director";
import { saveDirectorTarget } from "../src/directors2b";
import {
  dlhSeriesFromRows,
  dlhWeighted,
  foldWetHours,
  harvestWindow,
  lbsHarvestedBody,
  lbsPerDlhBody,
  leastSquares,
  leastSquaresAt,
  refreshLbsHarvested,
  refreshLbsPerDlh,
  refreshPctFinished,
  wetPounds,
  type DlhDay,
  type HarvestDay,
} from "../src/ddsnapshot";
import { farmDay } from "../src/farmday";
import { formOf, migratedDb, seedBatch, seedPerson } from "./migrated";

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

function dlhRows(m: Awaited<ReturnType<typeof migratedDb>>): Row[] {
  return m.all(
    `SELECT period_start, dim_key, value, n FROM dd_kpi_values
     WHERE kpi_key = 'bizops.lbs_per_dlh' AND superseded_at IS NULL
     ORDER BY period_start, dim_key`
  );
}

function consoleInput(over: Partial<HarvestConsoleInput>): HarvestConsoleInput {
  return {
    today: "2026-10-19",
    day: "2026-10-17",
    dayPicked: true,
    year: 2026,
    remaining: [],
    seasonHarvested: [],
    seasonLots: [],
    dayWet: [],
    hours: { PNN: null, ARL: null, PNS: null },
    plantCounts: { PNN: null, ARL: null, PNS: null },
    ...over,
  };
}

function metric(boxes: ReturnType<typeof consoleBoxes>, key: string): string {
  const total = boxes.find((box) => box.farm === "Total");
  return total?.metrics.find((row) => row.key === key)?.value ?? "";
}

async function dlhFloor(): Promise<Awaited<ReturnType<typeof migratedDb>>> {
  const m = await migratedDb();
  m.run(`UPDATE app_config SET value = '6' WHERE key = 'farm_day_start_hour'`);
  m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('s-dlh', 'Strain', '098', ?, ?)`, TS, TS);
  const own = seedBatch(m, { id: "b-dlh-own", hbn: "26101-PNN-GH-098", serial: 901, farm: "PNN", strainId: "s-dlh" });
  const toll = seedBatch(m, { id: "b-dlh-toll", hbn: "26102-PNS-GH-098", serial: 902, farm: "PNS", strainId: "s-dlh" });
  m.run(`UPDATE harvest_batches SET customer = 'GreenCo' WHERE id = 'b-dlh-toll'`);
  entry(m, "e-dlh-own", own);
  entry(m, "e-dlh-toll", toll);
  tote(m, "w-dlh-own-17", "e-dlh-own", 4480, "2026-10-17T15:00:00.000Z");
  tote(m, "w-dlh-toll-17", "e-dlh-toll", 4480, "2026-10-17T16:00:00.000Z");
  tote(m, "w-dlh-gone-17", "e-dlh-own", 9000, "2026-10-17T17:00:00.000Z", TS);
  tote(m, "w-dlh-own-18", "e-dlh-own", 2240, "2026-10-18T15:00:00.000Z");
  tote(m, "w-dlh-own-19", "e-dlh-own", 4480, "2026-10-19T15:00:00.000Z");
  const labor = (id: string, farm: string, day: string, hours: number) =>
    m.run(
      `INSERT INTO harvest_labor_hours (id, farm_code, work_date, hours, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      farm,
      day,
      hours,
      TS,
      TS
    );
  labor("h-july", "ALL", "2026-07-15", 8);
  labor("h-17-all", "ALL", "2026-10-17", 10);
  labor("h-17-pnn", "PNN", "2026-10-17", 3);
  labor("h-19-pnn", "PNN", "2026-10-19", 2);
  labor("h-19-arl", "ARL", "2026-10-19", 2);
  labor("h-19-xxx", "XXX", "2026-10-19", 99);
  return m;
}

function tileOf(html: string, key: string): string {
  const at = html.indexOf(`data-dd-kpi="${key}"`);
  return html.slice(html.lastIndexOf("<article", at), html.indexOf("</article>", at));
}

function chartDlh(html: string, period: string): string {
  const token = `data-dd-dlh-chart="${period}"`;
  const start = html.indexOf(token);
  const next = html.indexOf("data-dd-dlh-chart=", start + token.length);
  return html.slice(start, next === -1 ? undefined : next);
}

describe("Lbs per DLH series", () => {
  it("the ALL row wins, a day without hours stores wet only, pre-season hours are skipped, toll wet counts, and a second refresh writes nothing", async () => {
    const m = await dlhFloor();
    const first = await refreshLbsPerDlh(m.db, NOW);
    expect(first.year).toBe(2026);
    expect(first.written).toBe(7);
    expect(dlhRows(m).some((row) => String(row.period_start).startsWith("2026-07"))).toBe(false);
    expect(dlhRows(m).filter((row) => row.period_start === "2026-10-17")).toEqual([
      { period_start: "2026-10-17", dim_key: "", value: 2, n: 2 },
      { period_start: "2026-10-17", dim_key: "hours", value: 10, n: 1 },
      { period_start: "2026-10-17", dim_key: "wet_lb", value: 20, n: 2 },
    ]);
    expect(dlhRows(m).filter((row) => row.period_start === "2026-10-18")).toEqual([
      { period_start: "2026-10-18", dim_key: "wet_lb", value: 5, n: 1 },
    ]);
    expect(dlhRows(m).filter((row) => row.period_start === "2026-10-19")).toEqual([
      { period_start: "2026-10-19", dim_key: "", value: 2.5, n: 1 },
      { period_start: "2026-10-19", dim_key: "hours", value: 4, n: 2 },
      { period_start: "2026-10-19", dim_key: "wet_lb", value: 10, n: 1 },
    ]);
    expect(wetPounds(4480)).toBe(10);
    const ids = m.all(`SELECT id FROM dd_kpi_values WHERE kpi_key = 'bizops.lbs_per_dlh' AND superseded_at IS NULL ORDER BY id`);
    const second = await refreshLbsPerDlh(m.db, NOW);
    expect(second.written).toBe(0);
    expect(m.all(`SELECT id FROM dd_kpi_values WHERE kpi_key = 'bizops.lbs_per_dlh' AND superseded_at IS NULL ORDER BY id`)).toEqual(ids);
  });

  it("the stored day equals the console Total box", async () => {
    const m = await dlhFloor();
    await refreshLbsPerDlh(m.db, NOW);
    const stored = (day: string) => {
      const rows = dlhRows(m).filter((row) => row.period_start === day);
      return {
        wet: Number(rows.find((row) => row.dim_key === "wet_lb")?.value),
        hours: Number(rows.find((row) => row.dim_key === "hours")?.value),
        ratio: Number(rows.find((row) => row.dim_key === "")?.value),
      };
    };
    const seventeenth = consoleBoxes(
      consoleInput({
        day: "2026-10-17",
        dayWet: [
          { farm: "PNN", wet_grams: 4480 },
          { farm: "PNS", wet_grams: 4480 },
        ],
        hours: { PNN: 3, ARL: null, PNS: null },
        harvestHoursAll: 10,
      })
    );
    const day17 = stored("2026-10-17");
    expect(metric(seventeenth, "weight_harvested")).toBe(`${format2(day17.wet)} lb`);
    expect(Number(metric(seventeenth, "hours"))).toBe(day17.hours);
    expect(metric(seventeenth, "weight_per_dlh")).toBe(`${format2(day17.ratio)} lb/h`);
    const nineteenth = consoleBoxes(
      consoleInput({
        day: "2026-10-19",
        dayWet: [{ farm: "PNN", wet_grams: 4480 }],
        hours: { PNN: 2, ARL: 2, PNS: null },
        harvestHoursAll: null,
      })
    );
    const day19 = stored("2026-10-19");
    expect(metric(nineteenth, "weight_harvested")).toBe(`${format2(day19.wet)} lb`);
    expect(Number(metric(nineteenth, "hours"))).toBe(day19.hours);
    expect(metric(nineteenth, "weight_per_dlh")).toBe(`${format2(day19.ratio)} lb/h`);
  });
});

function dlhDay(day: string, wetLb: number | null, hours: number | null, ratio: number | null, n = 1): DlhDay {
  return { day, wetLb, hours, ratio, n };
}

describe("Lbs per DLH tile", () => {
  const days: DlhDay[] = [
    dlhDay("2026-09-01", 50, 10, 5),
    dlhDay("2026-10-01", 100, 10, 10),
    dlhDay("2026-10-08", 40, 4, 10),
    dlhDay("2026-10-13", 10, 1, 10),
    dlhDay("2026-10-14", 10, 4, 2.5),
    dlhDay("2026-10-15", 10, 4, 2.5),
    dlhDay("2026-10-16", 8, null, null),
    dlhDay("2026-10-17", 6, null, null),
    dlhDay("2026-10-18", 20, 2, 10),
    dlhDay("2026-10-19", 20, 2, 10),
  ];

  it("the four periods use summed wet over summed hours, a gap day has no point, and the goal line and hover are present", () => {
    const html = lbsPerDlhBody({ today: "2026-10-19", days }, 26, "en");
    expect(html).toContain('value="7"');
    expect(html).toContain('value="14" selected');
    expect(html).toContain('value="30"');
    expect(html).toContain('value="htd"');
    expect(chartDlh(html, "7")).toContain('data-dd-dlh-headline="6.5"');
    expect(chartDlh(html, "7")).toContain('data-dd-dlh-wet="84"');
    expect(chartDlh(html, "7")).toContain('data-dd-dlh-hours="13"');
    expect(chartDlh(html, "14")).toContain('data-dd-dlh-headline="7.3"');
    expect(chartDlh(html, "30")).toContain('data-dd-dlh-headline="8.3"');
    expect(chartDlh(html, "htd")).toContain('data-dd-dlh-headline="7.4"');
    const mean = (10 + 2.5 + 2.5 + 10 + 10) / 5;
    expect(mean).toBe(7);
    expect(dlhWeighted(days, harvestWindow("7", "2026-10-19", "2026-09-01")).ratio).toBeCloseTo(84 / 13, 8);
    expect(chartDlh(html, "7")).toContain("2 days without hours");
    expect(chartDlh(html, "7")).toContain('data-dd-dlh-segments="2"');
    expect(chartDlh(html, "7")).toContain('data-dd-dlh-day="2026-10-16" data-dd-dlh-tip="Friday, Oct 16. no hours typed" data-dd-dlh-gap="1"');
    expect(chartDlh(html, "7")).not.toContain('data-dd-dlh-day="2026-10-16" data-dd-dlh-tip="Friday, Oct 16. no hours typed" data-dd-dlh-gap="1" data-dd-dlh-point');
    expect(chartDlh(html, "7")).toContain("Monday, Oct 19. 10.00 lb/DLH. 20.00 lb. 2 h. so far");
    expect(chartDlh(html, "7")).toContain('data-dd-dlh-today="1"');
    expect(chartDlh(html, "7")).toContain('data-dd-dlh-goal="26"');
    expect(chartDlh(html, "7")).toContain("Goal 26");
    expect(chartDlh(html, "7")).toContain("19.5 under");
    expect(chartDlh(html, "7")).toContain('data-dd-dlh-tone="warn"');
    expect(html).toContain("toll lots");
    expect(DASH.test(html)).toBe(false);
    const bare = lbsPerDlhBody(
      { today: "2026-10-19", days: [dlhDay("2026-10-18", 4, null, null), dlhDay("2026-10-19", 4, null, null)] },
      26,
      "en"
    );
    expect(chartDlh(bare, "7")).toContain("No hours typed");
    expect(chartDlh(bare, "7")).toContain("2 days without hours");
    expect(chartDlh(bare, "7")).not.toContain("data-dd-dlh-point");
    expect(DASH.test(bare)).toBe(false);
    const es = lbsPerDlhBody({ today: "2026-10-19", days }, 26, "es");
    expect(chartDlh(es, "7")).toContain("Meta 26");
    expect(chartDlh(es, "7")).toContain("19.5 por debajo");
    expect(chartDlh(es, "7")).toContain("2 dias sin horas");
    expect(chartDlh(es, "7")).toContain("no hay horas escritas");
    expect(es).toContain("lotes de cliente");
    expect(DASH.test(es)).toBe(false);
    expect(dlhSeriesFromRows([], "2026-10-19").days).toEqual([]);
  });

  it("the seeded goal is 26, and a newer target from the targets form takes over on its date", async () => {
    const m = await dlhFloor();
    await refreshLbsPerDlh(m.db, NOW);
    const early = tileOf(directorWallPage(await loadDirectorWall(m.db, "bizops", "2026-10-01", null, null, NOW), "en"), "bizops.lbs_per_dlh");
    expect(early).toContain("Goal 26");
    expect(early).not.toContain("Goal 30");
    seedPerson(m, "dd-actor");
    await saveDirectorTarget(
      m.db,
      "bizops.lbs_per_dlh",
      formOf({
        person_id: "dd-actor",
        dim_key: "",
        period_kind: "day",
        effective_from: "2026-10-19",
        target: "30",
        reason: "raise the goal",
      }),
      NOW
    );
    const later = tileOf(directorWallPage(await loadDirectorWall(m.db, "bizops", "2026-10-19", null, null, NOW), "en"), "bizops.lbs_per_dlh");
    expect(later).toContain("Goal 30");
    const still = tileOf(directorWallPage(await loadDirectorWall(m.db, "bizops", "2026-10-18", null, null, NOW), "en"), "bizops.lbs_per_dlh");
    expect(still).toContain("Goal 26");
    expect(still).not.toContain("Goal 30");
    expect(DASH.test(later)).toBe(false);
  });
});

const PCT_NOW = "2026-10-19T18:00:00.000Z";
const PCT_NEXT = "2026-10-20T18:00:00.000Z";
const PCT_TS = "2026-09-01T00:00:00.000Z";

function pctEntry(m: Awaited<ReturnType<typeof migratedDb>>, id: string, batchId: string, plants: number, status = "drying", deletedAt: string | null = null): void {
  m.run(
    `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, plant_count, created_at, updated_at, deleted_at)
     VALUES (?, ?, 0, 'silo', ?, ?, ?, ?, ?)`,
    id,
    batchId,
    status,
    plants,
    PCT_TS,
    PCT_TS,
    deletedAt
  );
}

function pctPlant(m: Awaited<ReturnType<typeof migratedDb>>, tag: string, license: string, location: string, goneAt: string | null = null): void {
  m.run(
    `INSERT INTO metrc_plants (tag, license_value, phase, location, hold, harvested, mount_id, first_seen_at, changed_at, gone_at)
     VALUES (?, ?, 'flowering', ?, 0, 0, 'pct', ?, ?, ?)`,
    tag,
    license,
    location,
    PCT_TS,
    PCT_TS,
    goneAt
  );
}

function consolePct(input: HarvestConsoleInput): string {
  const box = consoleBoxes(input).find((row) => row.farm === "Total");
  return box?.metrics.find((metric) => metric.key === "pct")?.value ?? "";
}

function pctTile(html: string, key: string): string {
  const at = html.indexOf(`data-dd-kpi="${key}"`);
  return html.slice(html.lastIndexOf("<article", at), html.indexOf("</article>", at));
}

function storedPct(m: Awaited<ReturnType<typeof migratedDb>>, day: string, dim: string): Row {
  const row = m.get(
    `SELECT id, value, n, value_text FROM dd_kpi_values
     WHERE kpi_key = 'bizops.pct_finished_plants' AND period_kind = 'day' AND dim_key = ? AND period_start = ? AND superseded_at IS NULL`,
    dim,
    day
  );
  return row ?? {};
}

describe("DD S3c percent finished", () => {
  it("All matches the console Total box, lots split by grow method, toll and test lots out, and a second refresh writes nothing", async () => {
    const m = await migratedDb();
    m.run(`UPDATE app_config SET value = '6' WHERE key = 'farm_day_start_hour'`);
    m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('s-pct', 'Strain', '099', ?, ?)`, PCT_TS, PCT_TS);
    m.run(
      `INSERT INTO farm_plant_counts (id, farm_code, harvest_year, plant_count, created_at, updated_at) VALUES ('pc-arl', 'ARL', 2026, 1000, ?, ?)`,
      PCT_TS,
      PCT_TS
    );
    seedBatch(m, { id: "b-od", hbn: "PCT-OD", serial: 9101, farm: "PNS", strainId: "s-pct" });
    seedBatch(m, { id: "b-gh", hbn: "PCT-GH", serial: 9102, farm: "PNS", strainId: "s-pct" });
    seedBatch(m, { id: "b-arl", hbn: "PCT-ARL", serial: 9103, farm: "ARL", strainId: "s-pct" });
    seedBatch(m, { id: "b-weigh", hbn: "PCT-W", serial: 9104, farm: "PNS", strainId: "s-pct" });
    seedBatch(m, { id: "b-toll", hbn: "PCT-TOLL", serial: 9105, farm: "PNS", strainId: "s-pct" });
    seedBatch(m, { id: "b-test", hbn: "PCT-TEST", serial: 9106, farm: "PNS", strainId: "s-pct" });
    seedBatch(m, { id: "b-del", hbn: "PCT-DEL", serial: 9107, farm: "PNS", strainId: "s-pct" });
    m.run(`UPDATE harvest_batches SET grow_method_code = 'OD' WHERE id IN ('b-od', 'b-arl', 'b-toll')`);
    m.run(`UPDATE harvest_batches SET customer = 'GreenCo' WHERE id = 'b-toll'`);
    m.run(`UPDATE harvest_batches SET is_test = 1 WHERE id = 'b-test'`);
    pctEntry(m, "e-od", "b-od", 20);
    pctEntry(m, "e-gh", "b-gh", 10);
    pctEntry(m, "e-arl", "b-arl", 400);
    pctEntry(m, "e-weigh", "b-weigh", 99, "weighing");
    pctEntry(m, "e-toll", "b-toll", 50);
    pctEntry(m, "e-test", "b-test", 70);
    pctEntry(m, "e-del", "b-del", 80, "drying", PCT_TS);
    pctPlant(m, "p-gh-1", "AU-G-C-001397", "GH 7");
    pctPlant(m, "p-gh-2", "AU-G-C-001397", "GH 7");
    pctPlant(m, "p-gh-3", "AU-G-C-001397", "GH 7");
    pctPlant(m, "p-od-1", "AU-G-C-001397", "Field 4");
    pctPlant(m, "p-od-2", "AU-G-C-001397", "South 1");
    pctPlant(m, "p-gone", "AU-G-C-001397", "GH 7", PCT_TS);
    const first = await refreshPctFinished(m.db, PCT_NOW);
    expect(first.written).toBe(3);
    expect(first.year).toBe(2026);
    const shown = consolePct({
      today: "2026-10-19",
      day: "2026-10-19",
      dayPicked: false,
      year: 2026,
      remaining: [{ farm: "PNS", plants: 5 }],
      seasonHarvested: [
        { farm: "PNS", plants: 30 },
        { farm: "ARL", plants: 400 },
      ],
      seasonLots: [],
      dayWet: [],
      hours: { PNN: null, ARL: null, PNS: null },
      plantCounts: { PNN: null, ARL: 1000, PNS: null },
    });
    const all = storedPct(m, "2026-10-19", "");
    expect(`${Number(all.value).toFixed(1)}%`).toBe(shown);
    expect(all.value_text).toBe("1030/1035");
    expect(all.n).toBe(1030);
    const gh = storedPct(m, "2026-10-19", "GH");
    expect(gh.value_text).toBe("10/13");
    expect(Number(gh.value).toFixed(1)).toBe("76.9");
    expect(gh.n).toBe(10);
    const od = storedPct(m, "2026-10-19", "OD");
    expect(od.value_text).toBe("420/422");
    expect(Number(od.value).toFixed(1)).toBe("99.5");
    expect(od.n).toBe(420);
    expect(m.get(`SELECT id FROM dd_kpi_values WHERE kpi_key = 'bizops.pct_finished_plants' AND dim_key = 'ID' AND superseded_at IS NULL`)).toBeUndefined();
    const dims = m.all(
      `SELECT dim_key, COUNT(*) AS n FROM dd_kpi_values WHERE kpi_key = 'bizops.pct_finished_plants' AND superseded_at IS NULL GROUP BY dim_key ORDER BY dim_key`
    );
    expect(dims).toEqual([
      { dim_key: "", n: 1 },
      { dim_key: "GH", n: 1 },
      { dim_key: "OD", n: 1 },
    ]);
    const ids = m.all(`SELECT id FROM dd_kpi_values WHERE kpi_key = 'bizops.pct_finished_plants' AND superseded_at IS NULL ORDER BY dim_key`);
    const second = await refreshPctFinished(m.db, PCT_NOW);
    expect(second.written).toBe(0);
    expect(m.all(`SELECT id FROM dd_kpi_values WHERE kpi_key = 'bizops.pct_finished_plants' AND superseded_at IS NULL ORDER BY dim_key`)).toEqual(ids);
    pctPlant(m, "p-od-3", "AU-G-C-001397", "Field 9");
    const next = await refreshPctFinished(m.db, PCT_NEXT);
    expect(next.written).toBe(3);
    expect(storedPct(m, "2026-10-19", "")).toMatchObject({ id: all.id, value_text: "1030/1035" });
    expect(storedPct(m, "2026-10-20", "").value_text).toBe("1030/1036");
    expect(DASH.test(JSON.stringify(m.all(`SELECT value_text FROM dd_kpi_values WHERE kpi_key = 'bizops.pct_finished_plants'`)))).toBe(false);
  });

  it("ARL with a typed total and no live plants reads 100, and a farm with no typed total uses lots plus live plants", async () => {
    const typed = await migratedDb();
    typed.run(`UPDATE app_config SET value = '6' WHERE key = 'farm_day_start_hour'`);
    typed.run(
      `INSERT INTO farm_plant_counts (id, farm_code, harvest_year, plant_count, created_at, updated_at) VALUES ('pc-only', 'ARL', 2026, 250, ?, ?)`,
      PCT_TS,
      PCT_TS
    );
    await refreshPctFinished(typed.db, PCT_NOW);
    const arl = storedPct(typed, "2026-10-19", "");
    expect(Number(arl.value).toFixed(1)).toBe("100.0");
    expect(arl.value_text).toBe("250/250");
    expect(`${Number(arl.value).toFixed(1)}%`).toBe(
      consolePct({
        today: "2026-10-19",
        day: "2026-10-19",
        dayPicked: false,
        year: 2026,
        remaining: [],
        seasonHarvested: [],
        seasonLots: [],
        dayWet: [],
        hours: { PNN: null, ARL: null, PNS: null },
        plantCounts: { PNN: null, ARL: 250, PNS: null },
      })
    );
    const open = await migratedDb();
    open.run(`UPDATE app_config SET value = '6' WHERE key = 'farm_day_start_hour'`);
    open.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('s-open', 'Strain', '099', ?, ?)`, PCT_TS, PCT_TS);
    seedBatch(open, { id: "b-open", hbn: "PCT-OPEN", serial: 9201, farm: "PNS", strainId: "s-open" });
    open.run(`UPDATE harvest_batches SET grow_method_code = 'OD' WHERE id = 'b-open'`);
    pctEntry(open, "e-open", "b-open", 40);
    pctPlant(open, "p-open", "AU-G-C-001397", "Field 2");
    for (let i = 0; i < 9; i += 1) pctPlant(open, `p-open-${i}`, "AU-G-C-001397", "Field 2");
    await refreshPctFinished(open.db, PCT_NOW);
    const fallback = storedPct(open, "2026-10-19", "");
    expect(fallback.value_text).toBe("40/50");
    expect(Number(fallback.value).toFixed(1)).toBe("80.0");
    expect(`${Number(fallback.value).toFixed(1)}%`).toBe(
      consolePct({
        today: "2026-10-19",
        day: "2026-10-19",
        dayPicked: false,
        year: 2026,
        remaining: [{ farm: "PNS", plants: 10 }],
        seasonHarvested: [{ farm: "PNS", plants: 40 }],
        seasonLots: [],
        dayWet: [],
        hours: { PNN: null, ARL: null, PNS: null },
        plantCounts: { PNN: null, ARL: null, PNS: null },
      })
    );
  });

  it("the tile offers Grow Method and Harvest Year, defaults to All and this year, and a past year reads its last day", async () => {
    const m = await migratedDb();
    const rows: Array<[string, string, string, number, string, number]> = [
      ["pct-now", "2026-10-19", "", 61, "61177/100367", 61177],
      ["pct-od", "2026-10-19", "OD", 80, "80/100", 80],
      ["pct-year", "2025-10-31", "", 100, "50/50", 50],
      ["pct-early", "2025-09-01", "", 10, "5/50", 5],
      ["pct-id", "2025-10-31", "ID", 40, "4/10", 4],
    ];
    for (const [id, day, dim, value, text, n] of rows) {
      m.run(
        `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, value_text, n, source, computed_at, def_version, created_at)
         VALUES (?, 'bizops.pct_finished_plants', 'day', ?, ?, ?, ?, ?, 'app', ?, 1, ?)`,
        id,
        day,
        dim,
        value,
        text,
        n,
        PCT_NOW,
        PCT_NOW
      );
    }
    const html = directorWallPage(await loadDirectorWall(m.db, "bizops", "2026-10-19", null, null, PCT_NOW), "en");
    const tile = pctTile(html, "bizops.pct_finished_plants");
    expect(tile).toContain("% Complete (By Plant Count)");
    expect(tile).toContain('data-dd-version="1"');
    expect(tile).toContain('data-dd-pct-method');
    expect(tile).toContain('data-dd-pct-year');
    expect(tile).toContain('<option value="" selected>All</option>');
    expect(tile).toContain('<option value="2026" selected>2026</option>');
    expect(tile.indexOf('value="2026"')).toBeLessThan(tile.indexOf('value="2025"'));
    expect(tile).toContain(">Indoor<");
    expect(tile).toContain(">Outdoor<");
    expect(tile).not.toContain(">Greenhouse<");
    expect(tile.indexOf(">Outdoor<")).toBeLessThan(tile.indexOf(">Indoor<"));
    expect(tile).toContain('data-dd-pct-face data-dd-pct-method="" data-dd-pct-year="2026">');
    expect(tile).toContain("61.0%");
    expect(tile).toContain("61,177 of 100,367 plants");
    expect(tile).toContain("2026-10-19. Uses the Admin plant totals.");
    const past = tile.slice(tile.indexOf('data-dd-pct-year="2025"'));
    expect(tile).toContain('data-dd-pct-face data-dd-pct-method="" data-dd-pct-year="2025" hidden');
    expect(past).toContain("as of Oct 31, 2025");
    expect(past).toContain("50 of 50 plants");
    expect(past).not.toContain("5 of 50 plants");
    const empty = tile.slice(tile.indexOf('data-dd-pct-method="ID" data-dd-pct-year="2026"'));
    expect(empty.startsWith('data-dd-pct-method="ID" data-dd-pct-year="2026" hidden')).toBe(true);
    expect(empty.slice(0, empty.indexOf("</div>"))).toContain("No data");
    expect(tile).toContain("2026-10-19. Counts lots and the mirror's live plants.");
    expect(DASH.test(tile)).toBe(false);
    const es = pctTile(directorWallPage(await loadDirectorWall(m.db, "bizops", "2026-10-19", null, null, PCT_NOW), "es"), "bizops.pct_finished_plants");
    expect(es).toContain("% Completo (por conteo de plantas)");
    expect(es).toContain("Sin datos");
    expect(es).toContain("61,177 de 100,367 plantas");
    expect(es).toContain("al 31 oct 2025");
    expect(DASH.test(es)).toBe(false);
  });
});
