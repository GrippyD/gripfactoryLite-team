import { describe, expect, it } from "vitest";
import { FULFILLMENT_UNIT_GRAMS_DEFAULT, GRAMS_PER_LB, parseFulfillmentUnitGrams, parsePrepackUnits } from "../src/config";
import { GRIP_MARK_PATH, TRAILER_CARGO } from "../src/consoleicons";
import {
  formatFulfillmentLbs,
  fulfillmentDateOf,
  fulfillmentOverridePage,
  fulfillmentSection,
  fulfillmentSeries,
  listFulfillmentCells,
  saveFulfillmentOverride,
  segmentWidths,
  stackedBar,
  type FulfillmentCell,
  type FulfillmentDay,
} from "../src/fulfillmentboard";
import { formOf, migratedDb, seedPerson } from "./migrated";

const UNITS = { ...FULFILLMENT_UNIT_GRAMS_DEFAULT };

describe("FULFILLMENT (canon 0.30.306)", () => {
  it("parses the grams in one each, and falls back when the row is blank or useless", () => {
    expect(parseFulfillmentUnitGrams(null)).toEqual(UNITS);
    expect(parseFulfillmentUnitGrams("  ")).toEqual(UNITS);
    expect(parseFulfillmentUnitGrams("prepack=28, mobs=70, prerolls=1, vapes=1")).toEqual(UNITS);
    expect(parseFulfillmentUnitGrams("prepack=30, mobs=nope")).toEqual({ prepack: 30 });
    expect(parseFulfillmentUnitGrams("prepack=0, vapes=-1")).toEqual(UNITS);
  });

  it("keeps a scheduled series, a zero, and an each, and leaves a missing row out", () => {
    const series = fulfillmentSeries(
      [
        { rowKey: "prepack", value: 40 },
        { rowKey: "shake", value: 0 },
        { rowKey: "bulk_bud", value: 1000 },
      ],
      { prepack: 28 }
    );
    expect(series.map((row) => row.key)).toEqual(["bulk_bud", "prepack", "shake"]);
    expect(series.map((row) => row.grams)).toEqual([1000, 1120, 0]);
    expect(series[2].share).toBe(0);
    expect(series[0].share + series[1].share).toBeCloseTo(1);
    expect(series[1].hue).toBe(3);
    expect(series.map((row) => row.key)).not.toContain("vapes");
    const mobs = fulfillmentSeries([{ rowKey: "mobs", value: 2 }], { prepack: 30 });
    expect(mobs[0].grams).toBe(140);
    expect(fulfillmentSeries([], UNITS)).toEqual([]);
  });

  it("draws rects that sum to the trailer cargo width, a zero taking none of it", () => {
    const series = fulfillmentSeries(
      [
        { rowKey: "bulk_bud", value: 1000 },
        { rowKey: "prepack", value: 40 },
        { rowKey: "shake", value: 0 },
      ],
      UNITS
    );
    const widths = segmentWidths(series.map((row) => row.share), TRAILER_CARGO.width);
    expect(widths.reduce((sum, n) => sum + n, 0)).toBeCloseTo(TRAILER_CARGO.width, 5);
    expect(widths[2]).toBe(0);
    const bar = stackedBar(series, TRAILER_CARGO);
    const drawn = [...bar.matchAll(/width="([^"]+)"/g)].map((hit) => Number(hit[1]));
    expect(drawn.reduce((sum, n) => sum + n, 0)).toBeCloseTo(TRAILER_CARGO.width, 5);
    expect(bar).toContain('data-fulfill-segment="bulk_bud"');
    expect(bar).toContain('class="hc-fill-1"');
    expect(bar).toContain('class="hc-fill-3"');
    expect(bar).toContain('data-fulfill-segment="shake"');
  });

  it("draws the three panes for a day with cells and the empty words for a day without", () => {
    const html = fulfillmentSection(
      {
        cells: [
          { rowKey: "bulk_bud", col: "shipping_today", value: 1000, unit: "g" },
          { rowKey: "prepack", col: "shipping_today", value: 40, unit: "ea" },
          { rowKey: "shake", col: "shipping_today", value: 0, unit: "g" },
          { rowKey: "vapes", col: "submitted", value: 2, unit: "ea" },
        ],
        unitGrams: UNITS,
        prepackUnits: ["3.5", "7", "14", "28"],
      },
      "en"
    );
    expect(html.indexOf('data-hc-fill="shipping_today"')).toBeLessThan(html.indexOf('data-hc-fill="submitted"'));
    expect(html.indexOf('data-hc-fill="submitted"')).toBeLessThan(html.indexOf('data-hc-fill="accepted"'));
    const shipping = html.slice(html.indexOf('data-hc-fill="shipping_today"'), html.indexOf('data-hc-fill="submitted"'));
    expect(shipping).toContain('data-fulfill-segment="bulk_bud"');
    expect(shipping).toContain('data-fulfill-segment="prepack"');
    expect(shipping).toContain("Bulk Bud 2.23 lbs");
    expect(shipping).not.toContain("Bulk Bud 1,000 g");
    expect(shipping).toContain("Prepack (unsplit) 40 ea");
    expect(shipping).toContain("data-fulfill-legacy");
    expect(shipping).toContain("Shake 0 g");
    expect(shipping).toContain("data-icon-trailer-cargo");
    expect(shipping).not.toContain("hc-fill-band");
    const submitted = html.slice(html.indexOf('data-hc-fill="submitted"'), html.indexOf('data-hc-fill="accepted"'));
    expect(submitted).toContain("hc-fill-band");
    expect(submitted).toContain('data-fulfill-segment="vapes"');
    expect(submitted).toContain("Vapes 2 ea");
    const accepted = html.slice(html.indexOf('data-hc-fill="accepted"'));
    expect(accepted).toContain("No figures typed for this day.");
    expect(accepted).not.toContain("hc-fill-band");
    const empty = fulfillmentSection({ cells: [], unitGrams: UNITS, prepackUnits: ["3.5", "7", "14", "28"] }, "en");
    expect(empty.match(/No figures typed for this day\./g)).toHaveLength(3);
    expect(empty).not.toContain("data-fulfill-segment");
    expect(empty).not.toContain("hc-fill-band");
    expect(empty).toContain('data-hc-icon="shipping"');
  });

  it("inserts, updates, clears without a hard delete, and refuses a fraction", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const seeded = m.get(`SELECT value FROM app_config WHERE key = 'fulfillment_unit_grams'`);
    expect(seeded?.value).toBe("prepack=28, mobs=70, prerolls=1, vapes=1");
    const day = "2026-09-29";
    await saveFulfillmentOverride(
      m.db,
      formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "1000", "prepack@28:shipping_today": "40" })
    );
    const page = fulfillmentOverridePage(day, await listFulfillmentCells(m.db, day));
    expect(page).toContain('class="report-scroll"><table class="fulfill-grid"');
    expect(page).toContain('data-fulfill-cell="prepack@28:shipping_today"');
    expect(page).toContain('value="40"');
    expect(page).toContain('value="1000"');
    const logs = () => m.all(`SELECT old_value, new_value, reason FROM record_change_log WHERE record_table = 'fulfillment_overrides'`);
    const afterInsert = logs().length;
    await saveFulfillmentOverride(
      m.db,
      formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "1000", "prepack@28:shipping_today": "40" })
    );
    expect(logs().length).toBe(afterInsert);
    await saveFulfillmentOverride(
      m.db,
      formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "1000", "prepack@28:shipping_today": "50" })
    );
    expect(logs().find((row) => row.old_value === "40")).toMatchObject({ old_value: "40", new_value: "50", reason: "typed" });
    await saveFulfillmentOverride(m.db, formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "1000" }));
    const cleared = m.get(`SELECT delete_reason, deleted_at FROM fulfillment_overrides WHERE row_key = 'prepack@28'`);
    expect(cleared?.delete_reason).toBe("cleared");
    expect(cleared?.deleted_at).toBeTruthy();
    expect(m.all(`SELECT id FROM fulfillment_overrides WHERE row_key = 'prepack@28'`)).toHaveLength(1);
    const live = await listFulfillmentCells(m.db, day);
    expect(live.map((cell) => cell.rowKey)).toEqual(["bulk_bud"]);
    await expect(
      saveFulfillmentOverride(m.db, formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "1000", "prepack@28:accepted": "1.5" }))
    ).rejects.toMatchObject({ status: 400, message: "Each figure must be a whole number of zero or more." });
    expect(await listFulfillmentCells(m.db, day)).toHaveLength(1);
    await expect(saveFulfillmentOverride(m.db, formOf({ person_id: person, entry_date: "yesterday" }))).rejects.toMatchObject({
      status: 400,
      message: "Pick a day.",
    });
    expect(fulfillmentDateOf("nope", "2026-09-29")).toBe("2026-09-29");
    expect(fulfillmentDateOf("2026-09-28", "2026-09-29")).toBe("2026-09-28");
  });
});

const SIZES = ["3.5", "7", "14", "28"] as const;

function dayOf(cells: FulfillmentCell[]): FulfillmentDay {
  return { cells, unitGrams: UNITS, prepackUnits: SIZES };
}

function pane(html: string, name: string): string {
  const at = html.indexOf(`data-hc-fill="${name}"`);
  const rest = html.slice(at);
  const next = rest.indexOf('data-hc-fill="', 16);
  return next < 0 ? rest : rest.slice(0, next);
}

async function gripPathFromFile(): Promise<string> {
  const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
  const svg = fs.readFileSync(new URL("../public/brand/grip.svg", import.meta.url), "utf8");
  const mark = svg.match(/\bd="([^"]*)"/);
  if (!mark) throw new Error("grip.svg has no path");
  return mark[1];
}

describe("FB1 THE FULFILLMENT BOARD IN POUNDS (canon 0.30.564)", () => {
  it("reads Bulk Bud and split Prepack in lbs on every card, and keeps the other eight rows", () => {
    expect(formatFulfillmentLbs(GRAMS_PER_LB)).toBe("1.00 lbs");
    expect(formatFulfillmentLbs(GRAMS_PER_LB * 1000)).toBe("1,000.00 lbs");
    expect(formatFulfillmentLbs(3617)).toBe("8.07 lbs");
    expect(formatFulfillmentLbs(30)).toBe("0.07 lbs");
    expect(formatFulfillmentLbs(3.5)).toBe("<0.01 lbs");
    expect(formatFulfillmentLbs(0)).toBe("0.00 lbs");
    const html = fulfillmentSection(
      dayOf([
        { rowKey: "bulk_bud", col: "shipping_today", value: 3617, unit: "g" },
        { rowKey: "bulk_bud", col: "submitted", value: 30, unit: "g" },
        { rowKey: "bulk_bud", col: "accepted", value: 3617, unit: "g" },
        { rowKey: "prepack@28", col: "shipping_today", value: 560, unit: "ea", bagGrams: 28 },
        { rowKey: "prepack@3.5", col: "submitted", value: 160, unit: "ea", bagGrams: 3.5 },
        { rowKey: "prepack@28", col: "submitted", value: 10, unit: "ea", bagGrams: 28 },
        { rowKey: "prepack@28", col: "accepted", value: 2720, unit: "ea", bagGrams: 28 },
        { rowKey: "biomass_trim", col: "shipping_today", value: 12, unit: "g" },
        { rowKey: "prerolls", col: "shipping_today", value: 4, unit: "ea" },
        { rowKey: "shake", col: "shipping_today", value: 9, unit: "g" },
        { rowKey: "bulk_distillate", col: "submitted", value: 8, unit: "g" },
        { rowKey: "vapes", col: "submitted", value: 2, unit: "ea" },
        { rowKey: "mobs", col: "submitted", value: 3, unit: "ea" },
        { rowKey: "bulk_isolate", col: "accepted", value: 6, unit: "g" },
        { rowKey: "bulk_infused", col: "accepted", value: 7, unit: "g" },
      ]),
      "en"
    );
    for (const name of ["shipping_today", "submitted", "accepted"]) {
      const card = pane(html, name);
      const bud = card.match(/data-fulfill-legend="bulk_bud"[^<]*<span[^>]*><\/span>([^<]*)/)?.[1] ?? "";
      expect(bud).not.toContain(" g");
      expect(card).toContain("lbs");
    }
    expect(pane(html, "shipping_today")).toContain("Bulk Bud 8.07 lbs");
    expect(pane(html, "shipping_today")).toContain("Prepack 35.00 lbs");
    expect(pane(html, "shipping_today")).not.toMatch(/data-fulfill-legend="prepack"[^>]*>(?:(?!<\/li>).)*ea/);
    expect(pane(html, "submitted")).toContain("Bulk Bud 0.07 lbs");
    expect(pane(html, "submitted")).toContain("Prepack 1.88 lbs");
    const accepted = pane(html, "accepted");
    expect(accepted).toContain("Bulk Bud 8.07 lbs");
    expect(accepted).toContain("Prepack 170.00 lbs");
    const lone = fulfillmentSection(dayOf([{ rowKey: "prepack@3.5", col: "shipping_today", value: 1, unit: "ea", bagGrams: 3.5 }]), "en");
    expect(pane(lone, "shipping_today")).toContain("Prepack &lt;0.01 lbs");
    expect(pane(lone, "submitted")).not.toContain("data-fulfill-grip-outline");
    expect(pane(html, "shipping_today")).toContain("Biomass/Trim 12 g");
    expect(pane(html, "shipping_today")).toContain("Prerolls 4 ea");
    expect(pane(html, "shipping_today")).toContain("Shake 9 g");
    expect(pane(html, "submitted")).toContain("Bulk Distillate 8 g");
    expect(pane(html, "submitted")).toContain("Vapes 2 ea");
    expect(pane(html, "submitted")).toContain("MOBs 3 ea");
    expect(pane(html, "accepted")).toContain("Bulk Isolate (THCA) 6 g");
    expect(pane(html, "accepted")).toContain("Bulk Infused 7 g");
    const es = fulfillmentSection(
      dayOf([
        { rowKey: "bulk_bud", col: "shipping_today", value: 3617, unit: "g" },
        { rowKey: "prepack@28", col: "shipping_today", value: 560, unit: "ea", bagGrams: 28 },
        { rowKey: "shake", col: "shipping_today", value: 9, unit: "g" },
      ]),
      "es"
    );
    expect(pane(es, "shipping_today")).toContain("Flor a granel 8.07 lbs");
    expect(pane(es, "shipping_today")).toContain("Preempacado 35.00 lbs");
    expect(pane(es, "shipping_today")).toContain("Picadillo 9 g");
    const esPage = fulfillmentOverridePage("2026-10-29", [], "es", undefined, SIZES);
    expect(esPage).toContain("Preempacado 3.5 g");
    expect(esPage).toContain("Preempacado 28 g");
  });

  it("sums split Prepack by bag grams, and a day without Prepack draws the same bar", () => {
    const mixed = fulfillmentSeries(
      [
        { rowKey: "prepack@3.5", value: 160, bagGrams: 3.5 },
        { rowKey: "prepack@28", value: 10, bagGrams: 28 },
      ],
      UNITS
    );
    expect(mixed).toHaveLength(1);
    expect(mixed[0].key).toBe("prepack");
    expect(mixed[0].grams).toBe(840);
    expect(mixed[0].kind).toBe("lbs");
    const stored = fulfillmentSeries([{ rowKey: "prepack@3.5", value: 2, bagGrams: 28 }], UNITS);
    expect(stored[0].grams).toBe(56);
    const plain = fulfillmentSeries(
      [
        { rowKey: "bulk_bud", value: 1000 },
        { rowKey: "shake", value: 50 },
      ],
      UNITS
    );
    const bar = stackedBar(plain, TRAILER_CARGO);
    expect(bar).toBe(
      '<rect class="hc-fill-1" data-fulfill-segment="bulk_bud" fill="currentColor" stroke="none" x="41.46" y="2.15" width="110.6" height="22.83"/><rect class="hc-fill-5" data-fulfill-segment="shake" fill="currentColor" stroke="none" x="152.06" y="2.15" width="5.54" height="22.83"/>'
    );
    const html = fulfillmentSection(
      dayOf([
        { rowKey: "bulk_bud", col: "shipping_today", value: 1000, unit: "g" },
        { rowKey: "shake", col: "shipping_today", value: 50, unit: "g" },
      ]),
      "en"
    );
    const shipping = pane(html, "shipping_today");
    const rects = [...shipping.matchAll(/<rect\b[^>]*data-fulfill-segment="[^"]+"[^>]*\/>/g)].map((hit) => hit[0]);
    expect(rects.join("")).toBe(bar);
  });

  it("keeps a legacy Prepack row in ea, out of the pounds, and read-only until it is cleared", async () => {
    const series = fulfillmentSeries(
      [
        { rowKey: "prepack", value: 40 },
        { rowKey: "prepack@28", value: 10, bagGrams: 28 },
      ],
      { prepack: 30 }
    );
    expect(series.map((row) => row.key)).toEqual(["prepack", "prepack_legacy"]);
    expect(series[0].grams).toBe(280);
    expect(series[1].grams).toBe(1200);
    expect(series[1].kind).toBe("legacy");
    const html = fulfillmentSection(
      dayOf([
        { rowKey: "prepack", col: "shipping_today", value: 40, unit: "ea", bagGrams: null },
        { rowKey: "prepack@28", col: "shipping_today", value: 10, unit: "ea", bagGrams: 28 },
      ]),
      "en"
    );
    const shipping = pane(html, "shipping_today");
    expect(shipping).toContain("Prepack 0.63 lbs");
    expect(shipping).toContain('data-fulfill-legacy');
    expect(shipping).toContain("Prepack (unsplit) 40 ea");
    expect(shipping).not.toContain("2.68 lbs");
    const m = await migratedDb();
    const person = seedPerson(m);
    const day = "2026-10-02";
    m.run(
      `INSERT INTO fulfillment_overrides (
         id, entry_date, row_key, col, value, unit, created_at, created_by, updated_at, updated_by
       ) VALUES ('leg-1', ?, 'prepack', 'shipping_today', 40, 'ea', '2026-10-02T00:00:00.000Z', NULL, '2026-10-02T00:00:00.000Z', NULL)`,
      day
    );
    const listed = await listFulfillmentCells(m.db, day);
    expect(listed[0].bagGrams).toBeNull();
    const page = fulfillmentOverridePage(day, listed, "en");
    expect(page).toContain("Prepack (unsplit, legacy)");
    expect(page).toContain('data-fulfill-legacy');
    expect(page).toContain('data-fulfill-readonly="prepack:shipping_today"');
    expect(page).not.toContain('name="prepack:shipping_today"');
    const legacyRow = page.slice(page.indexOf("data-fulfill-legacy"), page.indexOf("</tr>", page.indexOf("data-fulfill-legacy")));
    expect(legacyRow).not.toContain("<input");
    await saveFulfillmentOverride(m.db, formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "100" }));
    const still = m.get(`SELECT value, bag_grams, deleted_at FROM fulfillment_overrides WHERE id = 'leg-1'`);
    expect(still).toMatchObject({ value: 40, bag_grams: null, deleted_at: null });
    await expect(
      saveFulfillmentOverride(m.db, formOf({ person_id: person, entry_date: day, "prepack:accepted": "9" }))
    ).rejects.toMatchObject({ status: 400, message: "A Prepack count needs a bag size." });
    expect(m.get(`SELECT deleted_at, bag_grams FROM fulfillment_overrides WHERE id = 'leg-1'`)).toMatchObject({ deleted_at: null, bag_grams: null });
    expect(m.all(`SELECT id FROM fulfillment_overrides WHERE row_key = 'prepack' AND deleted_at IS NULL`)).toHaveLength(1);
    await saveFulfillmentOverride(m.db, formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "100", clear_prepack: "shipping_today" }));
    const gone = m.get(`SELECT delete_reason, bag_grams FROM fulfillment_overrides WHERE id = 'leg-1'`);
    expect(gone?.delete_reason).toBe("cleared");
    expect(gone?.bag_grams).toBeNull();
    const log = m.get(`SELECT reason, old_value, new_value FROM record_change_log WHERE record_id = 'leg-1' AND reason = 'cleared'`);
    expect(log).toMatchObject({ reason: "cleared", old_value: "40", new_value: null });
  });

  it("saves a bag size with its grams, logs the change, and the unique index refuses a second live cell", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const day = "2026-10-03";
    await saveFulfillmentOverride(
      m.db,
      formOf({
        person_id: person,
        entry_date: day,
        "prepack@3.5:shipping_today": "160",
        "prepack@28:shipping_today": "10",
      })
    );
    const rows = m.all(`SELECT row_key, value, bag_grams, unit FROM fulfillment_overrides WHERE entry_date = ? AND deleted_at IS NULL ORDER BY row_key`, day);
    expect(rows).toEqual([
      { row_key: "prepack@28", value: 10, bag_grams: 28, unit: "ea" },
      { row_key: "prepack@3.5", value: 160, bag_grams: 3.5, unit: "ea" },
    ]);
    await saveFulfillmentOverride(
      m.db,
      formOf({ person_id: person, entry_date: day, "prepack@3.5:shipping_today": "161", "prepack@28:shipping_today": "10" })
    );
    const typed = m.get(`SELECT old_value, new_value, reason FROM record_change_log WHERE new_value = '161'`);
    expect(typed).toMatchObject({ old_value: "160", new_value: "161", reason: "typed" });
    expect(m.get(`SELECT bag_grams FROM fulfillment_overrides WHERE row_key = 'prepack@3.5' AND deleted_at IS NULL`)?.bag_grams).toBe(3.5);
    await saveFulfillmentOverride(m.db, formOf({ person_id: person, entry_date: day, "prepack@28:shipping_today": "10" }));
    const cleared = m.get(`SELECT delete_reason FROM fulfillment_overrides WHERE row_key = 'prepack@3.5'`);
    expect(cleared?.delete_reason).toBe("cleared");
    const live = m.get(`SELECT id FROM fulfillment_overrides WHERE row_key = 'prepack@28' AND deleted_at IS NULL`);
    expect(() =>
      m.run(
        `INSERT INTO fulfillment_overrides (
           id, entry_date, row_key, col, value, unit, bag_grams, created_at, created_by, updated_at, updated_by
         ) VALUES ('dup', ?, 'prepack@28', 'shipping_today', 1, 'ea', 28, '2026-10-03T00:00:00.000Z', NULL, '2026-10-03T00:00:00.000Z', NULL)`,
        day
      )
    ).toThrow();
    expect(live?.id).toBeTruthy();
    m.run(`UPDATE app_config SET value = '1,3.5,7,14,28' WHERE key = 'prepack_units'`);
    const units = parsePrepackUnits(String(m.get(`SELECT value FROM app_config WHERE key = 'prepack_units'`)?.value));
    expect(units).toContain("1");
    const grid = fulfillmentOverridePage(day, await listFulfillmentCells(m.db, day), "en", undefined, units);
    expect(grid).toContain('data-fulfill-cell="prepack@1:shipping_today"');
    expect(grid).toContain("Prepack 1 g");
    await saveFulfillmentOverride(m.db, formOf({ person_id: person, entry_date: day, "prepack@1:accepted": "10", "prepack@28:shipping_today": "10" }));
    const one = fulfillmentSeries([{ rowKey: "prepack@1", value: 10, bagGrams: 1 }], UNITS);
    expect(one[0].grams).toBe(10);
    expect(formatFulfillmentLbs(one[0].grams)).toBe("0.02 lbs");
  });

  it("adds bag_grams on a fresh database and leaves it empty on a legacy row", async () => {
    const fresh = await migratedDb();
    const cols = fresh.all(`PRAGMA table_info(fulfillment_overrides)`).map((row) => row.name);
    expect(cols).toContain("bag_grams");
    const older = await migratedDb({ until: "0125" });
    older.run(
      `INSERT INTO fulfillment_overrides (
         id, entry_date, row_key, col, value, unit, created_at, created_by, updated_at, updated_by
       ) VALUES ('old-1', '2026-09-01', 'prepack', 'accepted', 12, 'ea', '2026-09-01T00:00:00.000Z', NULL, '2026-09-01T00:00:00.000Z', NULL)`
    );
    await older.applyRest();
    expect(older.get(`SELECT bag_grams FROM fulfillment_overrides WHERE id = 'old-1'`)?.bag_grams).toBeNull();
  });

  it("draws the Grip outline on Shipping Today only, on an empty day too, without moving the bars", async () => {
    const mark = await gripPathFromFile();
    expect(GRIP_MARK_PATH).toBe(mark);
    const filled = fulfillmentSection(
      dayOf([
        { rowKey: "bulk_bud", col: "shipping_today", value: 1000, unit: "g" },
        { rowKey: "bulk_bud", col: "submitted", value: 30, unit: "g" },
        { rowKey: "shake", col: "accepted", value: 4, unit: "g" },
      ]),
      "en"
    );
    const shipping = pane(filled, "shipping_today");
    const outlines = shipping.match(/data-fulfill-grip-outline/g) ?? [];
    expect(outlines).toHaveLength(1);
    expect(shipping.lastIndexOf("data-fulfill-segment")).toBeLessThan(shipping.indexOf("data-fulfill-grip-outline"));
    expect(pane(filled, "submitted")).not.toContain("data-fulfill-grip-outline");
    expect(pane(filled, "accepted")).not.toContain("data-fulfill-grip-outline");
    const tag = shipping.match(/<path data-fulfill-grip-outline\b[^>]*>/)?.[0] ?? "";
    expect(tag).toContain('fill="none"');
    expect(tag).toContain('stroke="currentColor"');
    expect(tag).toContain('vector-effect="non-scaling-stroke"');
    expect(tag).toContain('pointer-events="none"');
    expect(tag).toContain('aria-hidden="true"');
    expect(tag).toContain(`d="${mark}"`);
    const transform = tag.match(/transform="translate\(([0-9.]+) ([0-9.]+)\) scale\(([0-9.]+)\)"/);
    expect(transform).toBeTruthy();
    const tx = Number(transform?.[1]);
    const ty = Number(transform?.[2]);
    const scale = Number(transform?.[3]);
    const left = tx;
    const top = ty;
    const right = tx + 1782 * scale;
    const bottom = ty + 1798 * scale;
    expect(left).toBeGreaterThanOrEqual(41.46 - 0.001);
    expect(right).toBeLessThanOrEqual(157.6 + 0.001);
    expect(top).toBeGreaterThanOrEqual(2.15 - 0.001);
    expect(bottom).toBeLessThanOrEqual(24.98 + 0.001);
    expect((left + right) / 2).toBeCloseTo(41.46 + 116.14 / 2, 2);
    expect((top + bottom) / 2).toBeCloseTo(2.15 + 22.83 / 2, 2);
    const bar = stackedBar(fulfillmentSeries([{ rowKey: "bulk_bud", value: 1000 }], UNITS), TRAILER_CARGO);
    const rects = [...shipping.matchAll(/<rect\b[^>]*data-fulfill-segment="[^"]+"[^>]*\/>/g)].map((hit) => hit[0]);
    expect(rects.join("")).toBe(bar);
    const empty = fulfillmentSection(dayOf([]), "en");
    expect(pane(empty, "shipping_today").match(/data-fulfill-grip-outline/g)).toHaveLength(1);
    expect(pane(empty, "submitted")).not.toContain("data-fulfill-grip-outline");
    expect(pane(empty, "accepted")).not.toContain("data-fulfill-grip-outline");
    expect(empty).toContain("No figures typed for this day.");
  });
});
