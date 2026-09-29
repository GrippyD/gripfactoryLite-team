import { describe, expect, it } from "vitest";
import { FULFILLMENT_UNIT_GRAMS_DEFAULT, parseFulfillmentUnitGrams } from "../src/config";
import { TRAILER_CARGO } from "../src/consoleicons";
import {
  fulfillmentDateOf,
  fulfillmentOverridePage,
  fulfillmentSection,
  fulfillmentSeries,
  listFulfillmentCells,
  saveFulfillmentOverride,
  segmentWidths,
  stackedBar,
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
      },
      "en"
    );
    expect(html.indexOf('data-hc-fill="shipping_today"')).toBeLessThan(html.indexOf('data-hc-fill="submitted"'));
    expect(html.indexOf('data-hc-fill="submitted"')).toBeLessThan(html.indexOf('data-hc-fill="accepted"'));
    const shipping = html.slice(html.indexOf('data-hc-fill="shipping_today"'), html.indexOf('data-hc-fill="submitted"'));
    expect(shipping).toContain('data-fulfill-segment="bulk_bud"');
    expect(shipping).toContain('data-fulfill-segment="prepack"');
    expect(shipping).toContain("Bulk Bud 1,000 g");
    expect(shipping).toContain("Prepack 40 ea");
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
    const empty = fulfillmentSection({ cells: [], unitGrams: UNITS }, "en");
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
      formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "1000", "prepack:shipping_today": "40" })
    );
    const page = fulfillmentOverridePage(day, await listFulfillmentCells(m.db, day));
    expect(page).toContain('data-fulfill-cell="prepack:shipping_today"');
    expect(page).toContain('value="40"');
    expect(page).toContain('value="1000"');
    const logs = () => m.all(`SELECT old_value, new_value, reason FROM record_change_log WHERE record_table = 'fulfillment_overrides'`);
    const afterInsert = logs().length;
    await saveFulfillmentOverride(
      m.db,
      formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "1000", "prepack:shipping_today": "40" })
    );
    expect(logs().length).toBe(afterInsert);
    await saveFulfillmentOverride(
      m.db,
      formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "1000", "prepack:shipping_today": "50" })
    );
    expect(logs().find((row) => row.old_value === "40")).toMatchObject({ old_value: "40", new_value: "50", reason: "typed" });
    await saveFulfillmentOverride(m.db, formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "1000" }));
    const cleared = m.get(`SELECT delete_reason, deleted_at FROM fulfillment_overrides WHERE row_key = 'prepack'`);
    expect(cleared?.delete_reason).toBe("cleared");
    expect(cleared?.deleted_at).toBeTruthy();
    expect(m.all(`SELECT id FROM fulfillment_overrides WHERE row_key = 'prepack'`)).toHaveLength(1);
    const live = await listFulfillmentCells(m.db, day);
    expect(live.map((cell) => cell.rowKey)).toEqual(["bulk_bud"]);
    await expect(
      saveFulfillmentOverride(m.db, formOf({ person_id: person, entry_date: day, "bulk_bud:shipping_today": "1000", "prepack:accepted": "1.5" }))
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
