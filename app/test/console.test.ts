import { describe, expect, it } from "vitest";
import {
  CONSOLE_FARMS,
  consoleBoxes,
  dayBefore,
  etDate,
  etDayBounds,
  HARVEST_HOURS_PATH,
  HARVEST_PATH,
  HARVEST_TRIM_HOURS_PATH,
  HARVEST_TRIM_INPUT_PATH,
  harvestConsolePage,
  parseHours,
  parseInputLbs,
  prepackCodesOf,
  TRIM_LINE_BAR_WIDTH,
  TRIM_LINE_FLOW_MS,
  TRIM_RUNNING_MINUTES,
  TRIM_SHIFTS,
  trimFigures,
  testingFigures,
  trimLinePicture,
  trimmingSection,
  BUD_ROWS,
  BUD_COLS,
  BUD_CELLS,
  BUD_STEM,
  budWaffle,
  type HarvestConsoleInput,
  type TrimInput,
} from "../src/console";
import { CONFIG_KEYS, parseBtrTypeCodes, parseCryoTypeCategories, parseNameList, parseShiftWindow, shiftWindowHolds, TRIM_SHIFT_HOURS_DEFAULT } from "../src/config";
import { etClockMinutes } from "../src/farmday";
import { HttpError } from "../src/audit";
import { isReportKey, REPORT_CARDS, REPORT_KEYS } from "../src/reports";
import { LB_GRAMS, siloVisual, type SiloLive } from "../src/silo";
import { loadHarvestConsole } from "../src/console";
import { countQueue, listHarvestsByYear, listLookup, listPaneRows, listQueueRows, listRecallableBatches } from "../src/db";
import { createWetWeight, recallHarvestBatch } from "../src/actions";
import { queueByKey } from "../src/pipeline";
import { formOf, migratedDb, seedBatch, seedLot, seedPerson } from "./migrated";

const input: HarvestConsoleInput = {
  today: "2026-09-15",
  yesterday: "2026-09-14",
  dayPicked: false,
  year: 2026,
  remaining: [
    { farm: "PNN", plants: 1200 },
    { farm: "ARL", plants: 300 },
    { farm: null, plants: 9 },
  ],
  seasonHarvested: [
    { farm: "PNN", plants: 800 },
    { farm: "PNS", plants: 50 },
  ],
  seasonLots: [
    { farm: "PNN", wet_grams: 400000, dry_grams: 88000, plant_count: 800 },
    { farm: "PNS", wet_grams: 25000, dry_grams: null, plant_count: 50 },
    // An uncounted lot never enters a per-plant average.
    { farm: "ARL", wet_grams: 999, dry_grams: 100, plant_count: null },
  ],
  yesterdayWet: [
    { farm: "PNN", wet_grams: 90718.474 },
    { farm: "ARL", wet_grams: 4535.9237 },
  ],
  hours: { PNN: 8, ARL: null, PNS: 0 },
};

const CAP = 15000 * LB_GRAMS;
const base = { fillingGrams: 0, fillingLots: 0, awaitingGrams: 0, loadedGrams: 0, clock: null, capacityGrams: CAP } as const;
const live: SiloLive[] = [
  { silo: { id: "s1", name: "Silo 1", shape: "cylinder", farm_code: "PNN" }, visual: siloVisual(base), loads: [], waiting: [] },
  { silo: { id: "s6", name: "Arlington Dry Room", shape: "box", farm_code: "ARL" }, visual: siloVisual({ ...base, fillingGrams: CAP / 4, fillingLots: 1 }), loads: [], waiting: [] },
];

describe("THE HARVEST CONSOLE (canon 0.30.73): the dashboard struck, the console at /harvest", () => {
  it("strikes the Harvest Dashboard from the report list (owner: 'Remove it from the report list.')", () => {
    expect(REPORT_KEYS).not.toContain("harvest_dashboard");
    expect(isReportKey("harvest_dashboard")).toBe(false);
    expect(REPORT_CARDS.map((c) => c.key)).not.toContain("harvest_dashboard");
    expect(REPORT_CARDS[0].key).toBe("inventory");
    expect(REPORT_KEYS).toHaveLength(9);
  });

  it("names the page and the hours post, and knows the three farms", () => {
    expect(HARVEST_PATH).toBe("/harvest");
    expect(HARVEST_HOURS_PATH).toBe("/harvest/hours");
    expect(CONSOLE_FARMS).toEqual(["PNN", "ARL", "PNS"]);
  });

  it("reads the farm's day in Eastern time and bounds it in UTC across both DST edges", () => {
    expect(etDate("2026-09-15T03:30:00.000Z")).toBe("2026-09-14");
    expect(etDate("2026-09-15T04:30:00.000Z")).toBe("2026-09-15");
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
    expect(dayBefore("2026-01-01")).toBe("2025-12-31");
    expect(etDayBounds("2026-09-14")).toEqual({ startIso: "2026-09-14T04:00:00.000Z", endIso: "2026-09-15T04:00:00.000Z" });
    expect(etDayBounds("2026-01-14")).toEqual({ startIso: "2026-01-14T05:00:00.000Z", endIso: "2026-01-15T05:00:00.000Z" });
    expect(etDayBounds("2026-03-08")).toEqual({ startIso: "2026-03-08T05:00:00.000Z", endIso: "2026-03-09T04:00:00.000Z" });
    expect(etDayBounds("2026-11-01")).toEqual({ startIso: "2026-11-01T04:00:00.000Z", endIso: "2026-11-02T05:00:00.000Z" });
  });

  it("computes the seven metrics per farm and for Total, pounds first with grams under", () => {
    const boxes = consoleBoxes(input);
    expect(boxes.map((b) => b.farm)).toEqual(["PNN", "ARL", "PNS", "Total"]);
    const pnn = boxes[0];
    expect(pnn.pct).toBeCloseTo(0.4, 9);
    expect(pnn.metrics.map((m) => m.key)).toEqual(["remaining_total", "harvested", "pct", "wet_per_plant", "dry_per_plant", "hours", "weight_per_dlh"]);
    const by = (farm: string, key: string) => {
      const box = boxes.find((b) => b.farm === farm)!;
      return box.metrics.find((m) => m.key === key)!;
    };
    expect(by("PNN", "remaining_total").value).toBe("1,200 / 2,000");
    expect(by("PNN", "harvested").value).toBe("800");
    expect(by("PNN", "pct").value).toBe("40.0%");
    expect(by("PNN", "wet_per_plant")).toEqual({ key: "wet_per_plant", label: "Wet Weight/plant AVG", value: "1.12 lb", sub: "500 g" });
    expect(by("PNN", "dry_per_plant")).toEqual({ key: "dry_per_plant", label: "Dry Weight/plant AVG", value: "0.25 lb", sub: "110 g" });
    expect(by("PNN", "hours").value).toBe("8");
    // 90,718.474 g over 8 h at 448 g/lb: 25.31 lb/h, 11,340 g/h.
    expect(by("PNN", "weight_per_dlh")).toEqual({ key: "weight_per_dlh", label: "Weight/DLH Yesterday", value: "25.31 lb/h", sub: "11,340 g/h" });
    // ARL: nothing harvested, no hours typed: the DLH line asks for hours and shows yesterday's pounds.
    expect(by("ARL", "remaining_total").value).toBe("300 / 300");
    expect(by("ARL", "pct").value).toBe("0.0%");
    expect(by("ARL", "wet_per_plant").value).toBe("");
    expect(by("ARL", "hours").value).toBe("");
    expect(by("ARL", "weight_per_dlh")).toEqual({ key: "weight_per_dlh", label: "Weight/DLH Yesterday", value: "type hours", sub: "10.12 lb yesterday" });
    // PNS: all harvested; zero hours typed divides nothing.
    expect(boxes[2].pct).toBe(1);
    expect(by("PNS", "pct").value).toBe("100.0%");
    expect(by("PNS", "dry_per_plant").value).toBe("");
    expect(by("PNS", "weight_per_dlh").value).toBe("");
    // Total: every farm plus the plants under a license with no farm (the 9).
    const total = boxes[3];
    expect(by("Total", "remaining_total").value).toBe("1,509 / 2,359");
    expect(by("Total", "harvested").value).toBe("850");
    expect(total.pct).toBeCloseTo(850 / 2359, 9);
    expect(by("Total", "pct").value).toBe("36.0%");
    expect(by("Total", "hours").value).toBe("8");
    expect(by("Total", "weight_per_dlh")).toEqual({ key: "weight_per_dlh", label: "Weight/DLH Yesterday", value: "26.58 lb/h", sub: "11,907 g/h" });
    // No plants known at all: no percent, not a division by zero.
    const blank = consoleBoxes({ ...input, remaining: [], seasonHarvested: [] });
    expect(blank[3].pct).toBeNull();
    expect(blank[3].metrics.find((m) => m.key === "pct")!.value).toBe("");
    // Spanish display text.
    expect(consoleBoxes(input, "es").find((b) => b.farm === "ARL")!.metrics.find((m) => m.key === "weight_per_dlh")!.value).toBe("escriba las horas");
  });

  it("renders the collapsible sections: Plants, Drying and Trimming open, the two stubs closed (Trimming built by canon 0.30.88)", () => {
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z" });
    expect(html).toContain("<h1>Harvest Console</h1>");
    expect(html).toContain('<details class="hc-section" data-hc-section="plants" open>');
    expect(html).toContain("<summary>Plants</summary>");
    expect(html).toContain('<details class="hc-section" data-hc-section="drying" open>');
    expect(html).toContain("<summary>Drying</summary>");
    expect(html).toContain('<details class="hc-section" data-hc-section="trimming" open>');
    expect(html).toContain("<summary>Trimming</summary>");
    expect(html).toContain(`<details class="hc-section hc-stub" data-hc-section="pasteurization">`);
    expect(html).toContain(`<summary>Pasteurization</summary>`);
    expect(html).toContain(`<details class="hc-section" data-hc-section="testing" data-hc-testing-year="`);
    expect(html).toContain(`<summary>Testing</summary>`);
    expect(html).toContain('data-hc="lots_ready">0<');
    expect(html.match(/data-hc-stub>/g)).toHaveLength(1);
    expect(html).toContain("Stub: this section waits on the owner's definition.");
    const order = ["plants", "drying", "trimming", "pasteurization", "testing", "prepack"].map((k) => html.indexOf(`data-hc-section="${k}"`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // THE DRYING TOTALS (canon 0.30.183): none handed, none drawn.
    expect(html).not.toContain("data-hc-drying-totals");
  });

  it("THE DRYING TOTALS (canon 0.30.183): the three totals ride under the dry space tiles in the Drying section", () => {
    const totals = { loadedGrams: 15421282, loadedLots: 2, estimateGrams: 3392682, dryYieldPct: 22, cureGrams: 1280080, cureLots: 1, queuedGrams: 0, queuedLots: 0 };
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z", dryingTotals: totals });
    const drying = html.slice(html.indexOf('data-hc-section="drying"'), html.indexOf('data-hc-section="trimming"'));
    expect(drying).toContain("data-silo-strip");
    expect(drying.indexOf("data-silo-strip")).toBeLessThan(drying.indexOf("data-hc-drying-totals"));
    expect(drying).toContain("Total in Dry Spaces");
    expect(drying).toContain("<strong>34,422.50</strong> lb · <strong>15,421,282</strong> g");
    expect(drying).toContain("est. dry 7,572.95 lb at 22%");
    expect(drying).toContain("Total in Cure Spaces");
    expect(drying).toContain("Total Dry Queued");
    expect(drying).toContain("<strong>0.00</strong> lb · <strong>0</strong> g");
    const es = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z", dryingTotals: totals, locale: "es" });
    expect(es).toContain("Total en espacios de secado");
    expect(es).toContain("seco est. 7,572.95 lb al 22%");
  });

  it("draws the four small boxes, PNN ARL PNS and Total, shaded by their % complete", () => {
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z" });
    expect(html.match(/<div class="hc-farm( hc-total)?" data-hc-farm=/g)).toHaveLength(4);
    expect(html).toContain('<div class="hc-farm" data-hc-farm="PNN" data-hc-pct="40">');
    expect(html).toContain('<div class="hc-farm" data-hc-farm="ARL" data-hc-pct="0">');
    expect(html).toContain('<div class="hc-farm" data-hc-farm="PNS" data-hc-pct="100">');
    expect(html).toContain('<div class="hc-farm hc-total" data-hc-farm="Total" data-hc-pct="36">');
    // The shade is the % complete: 40% reads as opacity 0.220 (55% of full at 100%).
    expect(html).toContain('data-hc-farm="PNN" data-hc-pct="40">\n          <div class="hc-shade" style="opacity:0.220"></div>');
    expect(html).toContain('data-hc-farm="PNS" data-hc-pct="100">\n          <div class="hc-shade" style="opacity:0.550"></div>');
    expect(html).toContain('<div class="hc-farm-name">PNN</div>');
    expect(html).toContain('<div class="hc-farm-name">Total</div>');
    // The seven lines, in the ruling's order, on every box.
    const labels = [
      "Plants Remaining/Total Plants",
      "Plants Harvested",
      "% Complete",
      "Wet Weight/plant AVG",
      "Dry Weight/plant AVG",
      "Cutting and Bucking Hours Yesterday",
      "Weight/DLH Yesterday",
    ];
    for (const label of labels) expect(html.match(new RegExp(`<dt>${label.replace(/[%/]/g, (c) => (c === "%" ? "%" : "\\/"))}`, "g"))).toHaveLength(4);
    expect(html).toContain('<span class="hc-value" data-hc="remaining_total">1,200 / 2,000</span>');
    expect(html).toContain('<span class="hc-value" data-hc="weight_per_dlh">25.31 lb/h</span><span class="hc-sub muted">11,340 g/h</span>');
  });

  it("the open numbox: one hours form per farm for yesterday, saving on change; Total shows the sum", () => {
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z", ok: "hours" });
    expect(html.match(/<form method="post" action="\/harvest\/hours" class="hc-hours"/g)).toHaveLength(3);
    expect(html).toContain('data-hc-hours="PNN"');
    expect(html).toContain('<input type="hidden" name="farm" value="ARL">');
    expect(html).toContain('<input type="hidden" name="work_date" value="2026-09-14">');
    expect(html).toContain('<input type="number" name="hours" min="0" step="0.25" inputmode="decimal" value="8" placeholder="hours" aria-label="Cutting and Bucking Hours Yesterday PNN" data-hc-hours-input>');
    expect(html).toContain('<input type="number" name="hours" min="0" step="0.25" inputmode="decimal" value="" placeholder="hours" aria-label="Cutting and Bucking Hours Yesterday ARL" data-hc-hours-input>');
    expect(html).toContain('<button type="submit" class="secondary">Save</button>');
    expect(html).toContain('box.addEventListener("change"');
    expect(html).toContain("box.form.requestSubmit()");
    // Total carries no box, only the sum.
    const total = html.slice(html.indexOf('data-hc-farm="Total"'), html.indexOf('data-hc-section="drying"'));
    expect(total).not.toContain("hc-hours");
    expect(total).toContain('<span class="hc-value" data-hc="hours">8</span>');
    // The date under the two yesterday lines, and the flash after a save.
    // Eight on the Plants boxes (hours and Weight/DLH per box), one per shift card (canon 0.30.88)
    // and one on each card's sheet-hours line (canon 0.30.154).
    expect(html.match(/<span class="hc-date muted">2026-09-14<\/span>/g)).toHaveLength(12);
    expect(html).toContain('<p class="banner ok" data-hc-flash>Hours saved.</p>');
    expect(harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z" })).not.toContain("data-hc-flash");
  });

  it("the Drying section is the silo strip with the Arlington Dry Room as the wire box", () => {
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z" });
    const drying = html.slice(html.indexOf('data-hc-section="drying"'), html.indexOf('data-hc-section="trimming"'));
    expect(drying).toContain('<section class="silo-strip" data-silo-strip>');
    expect(drying).toContain('data-silo="s1" data-silo-state="empty" data-silo-shape-kind="cylinder"');
    expect(drying).toContain('data-silo="s6" data-silo-state="filling" data-silo-shape-kind="box"');
    expect(drying).toContain('<div class="inv-gauge-name">Arlington Dry Room</div>');
    expect(drying).toContain('class="silo-shape silo-shape-box"');
    expect(drying).not.toContain("data-ffz");
    expect(drying).toContain('fetch("/silos/live.json"');
    expect(drying).not.toContain("paintFfz");
  });

  it("THE PANES RIDE THE STRIP (owner, 2026-09-22): CSA and CSB stand in the drying row after the last space tile", () => {
    const cureTiles =
      '<div class="inv-gauge cure-pane" data-cure-pane="CSA"><div class="inv-gauge-name">CSA</div></div>' +
      '<div class="inv-gauge cure-pane" data-cure-pane="CSB"><div class="inv-gauge-name">CSB</div></div>';
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z", cureTiles });
    const drying = html.slice(html.indexOf('data-hc-section="drying"'), html.indexOf('data-hc-section="trimming"'));
    const row = drying.slice(drying.indexOf('<div class="inv-gauges">'), drying.indexOf("</section>"));
    expect(row).toContain('data-cure-pane="CSA"');
    expect(row).toContain('data-cure-pane="CSB"');
    expect(row.indexOf('data-silo="s6"')).toBeLessThan(row.indexOf('data-cure-pane="CSA"'));
    expect(row.indexOf('data-cure-pane="CSA"')).toBeLessThan(row.indexOf('data-cure-pane="CSB"'));
    // Nothing of the panes stands outside the strip.
    expect(drying.slice(drying.indexOf("</section>"))).not.toContain("data-cure-pane");
    // Without the tiles the strip renders as before.
    expect(harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z" })).not.toContain("data-cure-pane");
  });

  it("parses the typed hours: blank clears, commas drop, negatives and words refuse", () => {
    expect(parseHours(" 7.5 ")).toBe(7.5);
    expect(parseHours("")).toBeNull();
    expect(parseHours(null)).toBeNull();
    expect(parseHours("1,000")).toBe(1000);
    expect(parseHours("0")).toBe(0);
    expect(() => parseHours("abc")).toThrow("Hours must be a number of hours, zero or more.");
    expect(() => parseHours("-1")).toThrow("Hours must be a number of hours, zero or more.");
  });

  it("speaks Spanish on the sections and the lines", () => {
    const es = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z", locale: "es" });
    expect(es).toContain("<summary>Plantas</summary>");
    expect(es).toContain("<summary>Secado</summary>");
    expect(es).toContain("<summary>Recorte</summary>");
    expect(es).toContain("<summary>Pasteurizacion</summary>");
    expect(es).toContain("<summary>Pruebas</summary>");
    expect(es).toContain("<dt>Plantas restantes/Plantas totales</dt>");
    expect(es).toContain("Horas de corte y deshoje de ayer");
    expect(es).not.toContain("Inventario FFZ");
  });
});

/** THE BUD WAFFLE (canon 0.30.157) and THE DEEPER BUD (canon 0.30.160). The
 * cell map is his fourth drawing, THE PLUME (canon 0.30.207): 100 cells on a
 * 16 by 13 lattice, ten each of red, orange, yellow, green, blue, indigo,
 * violet, white, black and the teal core as the center, plus two permanent
 * dark green stem cells that never count and draw as any unconsumed cell.
 * Consumption order is the array order: red first, white then black after
 * violet, the center last; within a band top to bottom, left to right. */
describe("THE BUD WAFFLE (canon 0.30.157), drawn as THE PLUME (canon 0.30.207)", () => {
  it("the cell map has the count the map states, every band its count, no duplicate cell, every cell inside the lattice", () => {
    expect(BUD_ROWS).toBe(16);
    expect(BUD_COLS).toBe(13);
    expect(BUD_CELLS).toHaveLength(100);
    const bands = ["red", "orange", "yellow", "green", "blue", "indigo", "violet", "white", "black", "center"] as const;
    const counts: Record<(typeof bands)[number], number> = {
      red: 10,
      orange: 10,
      yellow: 10,
      green: 10,
      blue: 10,
      indigo: 10,
      violet: 10,
      white: 10,
      black: 10,
      center: 10,
    };
    expect(BUD_CELLS.map((c) => c[2])).toEqual(bands.flatMap((band) => Array(counts[band]).fill(band)));
    const seen = new Set<string>();
    for (const [row, col, band] of BUD_CELLS) {
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(BUD_ROWS);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(BUD_COLS);
      expect(bands.includes(band as (typeof bands)[number])).toBe(true);
      const key = `${row}:${col}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(100);
    expect(BUD_CELLS[0][2]).toBe("red");
    expect(BUD_CELLS[BUD_CELLS.length - 1][2]).toBe("center");
    // The stem's two reds are red cells in reading order, the last two of the red band.
    expect(BUD_CELLS.slice(8, 10)).toEqual([[14, 6, "red"], [15, 6, "red"]]);
    // THE DEEPER BUD: white and black follow violet, so a 15% BTR (85 consumed) still leaves the center and half the black.
    expect(BUD_CELLS[70][2]).toBe("white");
    expect(BUD_CELLS[80][2]).toBe("black");
    expect(BUD_CELLS[90][2]).toBe("center");
    for (const band of bands) {
      const cells = BUD_CELLS.filter((c) => c[2] === band);
      expect(cells).toHaveLength(counts[band]);
      for (let i = 1; i < cells.length; i++) {
        const [r0, c0] = cells[i - 1];
        const [r1, c1] = cells[i];
        expect(r1 > r0 || (r1 === r0 && c1 > c0)).toBe(true);
      }
    }
    // THE PLUME: the tip is indigo, the crown orange and yellow, the eye's core is the center, the stem
    // reads dark green, dark green, red, red under the eye (his pick: the stem's orange dropped).
    expect(BUD_CELLS.filter((c) => c[0] === 0)).toEqual([[0, 6, "indigo"]]);
    expect(BUD_CELLS.filter((c) => c[0] === 1).map((c) => `${c[1]}:${c[2]}`).sort()).toEqual(["4:orange", "5:yellow", "6:indigo", "7:yellow", "8:orange"]);
    expect(BUD_CELLS.filter((c) => c[2] === "center").map((c) => [c[0], c[1]])).toEqual([[8, 6], [9, 5], [9, 6], [9, 7], [10, 5], [10, 6], [10, 7], [11, 5], [11, 6], [11, 7]]);
    expect(BUD_CELLS.filter((c) => c[0] >= 14)).toEqual([[14, 6, "red"], [15, 6, "red"]]);
    expect(BUD_CELLS.filter((c) => c[1] === 6 && c[0] >= 12)).toEqual([[14, 6, "red"], [15, 6, "red"]]);
    expect(BUD_STEM).toEqual([[12, 6], [13, 6]]);
    for (const [row, col] of BUD_STEM) {
      expect(row).toBeLessThan(BUD_ROWS);
      expect(col).toBeLessThan(BUD_COLS);
      expect(seen.has(`${row}:${col}`)).toBe(false);
    }
  });

  it("budWaffle(0.6) greys the first 40 cells; null outlines every cell; 1.004 greys 0; 0 greys them all", () => {
    const sixty = budWaffle(0.6);
    expect(sixty).toContain('<svg class="hc-bud" viewBox="0 0 130 160" role="img" aria-label="BTR 60.0%" data-hc-bud data-hc-bud-consumed="40">');
    expect((sixty.match(/class="hc-bud-cell hc-bud-consumed"/g) || []).length).toBe(40);
    expect((sixty.match(/class="hc-bud-cell hc-bud-bud"/g) || []).length).toBe(60);
    // THE PLUME: the two stem cells stand in every state and never count; with a reading they draw as unconsumed cells.
    expect((sixty.match(/class="hc-bud-cell hc-bud-stem" data-hc-bud-stem/g) || []).length).toBe(2);
    expect(sixty).toContain('<rect class="hc-bud-cell hc-bud-stem" data-hc-bud-stem x="61.2" y="121.2" width="7.6" height="7.6" rx="1.2"/>');
    expect(sixty).toContain('<rect class="hc-bud-cell hc-bud-stem" data-hc-bud-stem x="61.2" y="131.2" width="7.6" height="7.6" rx="1.2"/>');
    // The stem's reds are cells 9 and 10 of the hundred: consumed with the reds, as drawn.
    expect(sixty).toContain('class="hc-bud-cell hc-bud-consumed" data-hc-bud-order="9" x="61.2" y="141.2"');
    expect(sixty).toContain('class="hc-bud-cell hc-bud-consumed" data-hc-bud-order="10" x="61.2" y="151.2"');
    for (let k = 1; k <= 40; k++) {
      expect(sixty).toContain(`class="hc-bud-cell hc-bud-consumed" data-hc-bud-order="${k}"`);
    }
    expect(sixty).toContain('class="hc-bud-cell hc-bud-bud" data-hc-bud-order="41"');
    const none = budWaffle(null);
    expect(none).toContain('data-hc-bud-consumed="0"');
    expect(none).toContain('aria-label="no packages yesterday"');
    // Nothing ran: the hundred and the two stem cells are all outlines; the stem reads no different.
    expect((none.match(/class="hc-bud-cell hc-bud-empty"/g) || []).length).toBe(102);
    expect((none.match(/class="hc-bud-cell hc-bud-empty" data-hc-bud-stem/g) || []).length).toBe(2);
    expect(none).not.toContain("hc-bud-stem\"");
    expect(none).not.toContain('class="hc-bud-cell hc-bud-bud"');
    expect(none).not.toContain('class="hc-bud-cell hc-bud-consumed"');
    expect(budWaffle(null, "es")).toContain('aria-label="sin paquetes ayer"');
    const over = budWaffle(1.004);
    expect(over).toContain('data-hc-bud-consumed="0"');
    expect((over.match(/class="hc-bud-cell hc-bud-bud"/g) || []).length).toBe(100);
    const zero = budWaffle(0);
    expect(zero).toContain('data-hc-bud-consumed="100"');
    expect((zero.match(/class="hc-bud-cell hc-bud-consumed"/g) || []).length).toBe(100);
    expect((zero.match(/class="hc-bud-cell hc-bud-stem" data-hc-bud-stem/g) || []).length).toBe(2);
  });
});

/** THE TRIMMING SECTION (canon 0.30.88). Owner ruling 2026-09-16, verbatim:
 * "in the harvest console (not the continuum one) let's work on Trimming: Day
 * shift: Lbs Produced Yesterday / DLH Yesterday: [numbox] / Lbs/DLH / BTR
 * (BTR=(BUD+WPR+SHA)/All weight ran that shift) shown as a percentage / BUD =
 * [BUD+WPR+SHA] / OTHER = All other / Second Shift / Same / Display them in a
 * visual way (graphed or something, a pictograph of some kind maybe)". His
 * picks: "Olga = Days, Victor = Afternoons"; "WPR means SMALLS". */
describe("THE TRIMMING SECTION (canon 0.30.88)", () => {
  const trim: TrimInput = {
    packages: [
      { type_code: "BUD", weight_grams: 300, trim_operator: "Olga" },
      { type_code: "SMALLS", weight_grams: 100, trim_operator: "olga " },
      { type_code: "shake", weight_grams: 50, trim_operator: "Olga" },
      { type_code: "TRIM", weight_grams: 200, trim_operator: "Olga" },
      { type_code: "WASTE", weight_grams: 100, trim_operator: "Olga" },
      { type_code: "BUD", weight_grams: 90, trim_operator: "Victor" },
      { type_code: "TRIM", weight_grams: 210, trim_operator: "VICTOR" },
      { type_code: "BIO", weight_grams: 7, trim_operator: "Les" },
      { type_code: "BUD", weight_grams: 3, trim_operator: null },
    ],
    budCodes: ["BUD", "SMALLS", "SHAKE"],
    operators: { day: ["Olga"], second: ["Victor"] },
    hours: { day: 5, second: null },
  };
  const withTrim: HarvestConsoleInput = { ...input, trim };

  it("the shifts are his two, in his words, each bound to a config key of operators", () => {
    expect(TRIM_SHIFTS.map((s) => [s.key, s.label])).toEqual([
      ["day", "Day shift"],
      ["second", "Second Shift"],
    ]);
    expect(TRIM_SHIFTS[0].configKey).toBe(CONFIG_KEYS.trim_shift_day_operators);
    expect(TRIM_SHIFTS[1].configKey).toBe(CONFIG_KEYS.trim_shift_second_operators);
    expect(HARVEST_TRIM_HOURS_PATH).toBe("/harvest/trim-hours");
  });

  it("the values in data parse: BTR codes upper and deduped (his BUD, SMALLS, SHAKE by default), operator names as typed", () => {
    expect(parseBtrTypeCodes(null)).toEqual(["BUD", "SMALLS", "SHAKE"]);
    expect(parseBtrTypeCodes(" bud, Smalls ,shake,bud,")).toEqual(["BUD", "SMALLS", "SHAKE"]);
    expect(parseBtrTypeCodes("BUD")).toEqual(["BUD"]);
    expect(parseNameList(" Olga , victor,OLGA,")).toEqual(["Olga", "victor"]);
    expect(parseNameList("")).toEqual([]);
  });

  it("the figures: a package lands on its operator's shift (case-blind), BUD on the BTR set, OTHER on the rest; BTR is BUD over all; Lbs/DLH divides by typed hours", () => {
    const f = trimFigures(trim);
    const day = f.shifts[0];
    expect(day.key).toBe("day");
    expect(day.packages).toBe(5);
    expect(day.grams).toBe(750);
    expect(day.budGrams).toBe(450);
    expect(day.otherGrams).toBe(300);
    expect(day.btr).toBeCloseTo(0.6, 9);
    expect(day.hours).toBe(5);
    expect(day.gramsPerDlh).toBeCloseTo(150, 9);
    const second = f.shifts[1];
    expect(second.key).toBe("second");
    expect(second.packages).toBe(2);
    expect(second.grams).toBe(300);
    expect(second.budGrams).toBe(90);
    expect(second.otherGrams).toBe(210);
    expect(second.btr).toBeCloseTo(0.3, 9);
    expect(second.hours).toBeNull();
    expect(second.gramsPerDlh).toBeNull();
    // Nothing disappears in silence: grams by operators on neither shift are named.
    expect(f.unassignedGrams).toBe(10);
    expect(f.unassignedOperators).toEqual(["Les"]);
  });

  it("nothing ran: BTR null, zero grams; zero hours never divide, typed hours over nothing read zero", () => {
    const f = trimFigures({ ...trim, packages: [], hours: { day: 0, second: 4 } });
    for (const shift of f.shifts) {
      expect(shift.grams).toBe(0);
      expect(shift.btr).toBeNull();
    }
    expect(f.shifts[0].gramsPerDlh).toBeNull();
    expect(f.shifts[1].gramsPerDlh).toBe(0);
    expect(f.unassignedGrams).toBe(0);
  });

  it("THE TRIM LINE PICTURE (canon 0.30.154): the prepack types are the WPR types of the cryo category map, SMALLS by default", () => {
    expect(prepackCodesOf(parseCryoTypeCategories(null))).toEqual(["SMALLS"]);
    expect(prepackCodesOf(parseCryoTypeCategories("BUD=BUD,SMALLS=WPR,SHAKE=SHA,POPCORN=WPR"))).toEqual(["SMALLS", "POPCORN"]);
    expect(prepackCodesOf(parseCryoTypeCategories("BUD=BUD"))).toEqual([]);
    expect(TRIM_RUNNING_MINUTES).toBe(30);
    expect(TRIM_LINE_BAR_WIDTH).toBe(44);
    expect(TRIM_LINE_FLOW_MS).toBe(900);
    expect(HARVEST_TRIM_INPUT_PATH).toBe("/harvest/trim-input");
  });

  it("his math: Bulk Bud = SHAKE + BUD, Prepack Bud = WPR (SMALLS), Total Bud = Bulk + Prepack; Other = TRIM + BIO + WIP left + the rest; the shift total adds the WIP left; BTR divides by it", () => {
    const f = trimFigures({
      ...trim,
      packages: [
        ...trim.packages,
        { type_code: "BIO", weight_grams: 40, trim_operator: "Olga" },
        { type_code: "KIEF", weight_grams: 10, trim_operator: "Victor" },
      ],
      // Olga finished a 1,000 g lot with 800 g recorded (200 g WIP left); Victor finished one over (no WIP left);
      // Les finished one on neither shift (named nowhere); a lot without a dry weight leaves nothing.
      finishedLots: [
        { lot_id: "a", dry_grams: 1000, recorded_grams: 800, last_operator: "olga" },
        { lot_id: "b", dry_grams: 500, recorded_grams: 520, last_operator: "Victor" },
        { lot_id: "c", dry_grams: 300, recorded_grams: 100, last_operator: "Les" },
        { lot_id: "d", dry_grams: null, recorded_grams: 50, last_operator: "Victor" },
      ],
      inputLbs: { day: 12.5, second: null },
    });
    const day = f.shifts[0];
    expect(day.bulkGrams).toBe(350); // BUD 300 + SHAKE 50
    expect(day.prepackGrams).toBe(100); // SMALLS as WPR
    expect(day.budGrams).toBe(450);
    expect(day.trimGrams).toBe(200);
    expect(day.bioGrams).toBe(40);
    expect(day.restGrams).toBe(100); // WASTE
    expect(day.wipLeftGrams).toBe(200);
    expect(day.finishedLots).toBe(1);
    expect(day.otherGrams).toBe(540); // 200 + 40 + 100 + 200
    expect(day.grams).toBe(790); // weighed
    expect(day.totalGrams).toBe(990); // weighed + WIP left = Total Bud + Other
    expect(day.budGrams + day.otherGrams).toBe(day.totalGrams);
    expect(day.btr).toBeCloseTo(450 / 990, 9);
    expect(day.gramsPerDlh).toBeCloseTo(790 / 5, 9);
    expect(day.inputLbs).toBe(12.5);
    const second = f.shifts[1];
    expect(second.bulkGrams).toBe(90);
    expect(second.prepackGrams).toBe(0);
    expect(second.restGrams).toBe(10); // KIEF
    expect(second.wipLeftGrams).toBe(0); // over, and a lot without a dry weight
    expect(second.finishedLots).toBe(2);
    expect(second.otherGrams).toBe(220);
    expect(second.totalGrams).toBe(310);
    expect(second.btr).toBeCloseTo(90 / 310, 9);
    expect(second.inputLbs).toBeNull();
    // A finished lot on neither shift lands nowhere; the unassigned grams stay the packages'.
    expect(f.unassignedGrams).toBe(10);
  });

  it("RUNNING (his pick): a package weighed lately lights the shift its operator is named on; one on neither shift lights the section's note", () => {
    const idle = trimFigures(trim);
    expect(idle.shifts.map((s) => s.running)).toEqual([false, false]);
    expect(idle.unassignedRunning).toBe(false);
    const running = trimFigures({ ...trim, recent: [{ trim_operator: " OLGA " }, { trim_operator: "Les" }] });
    expect(running.shifts.map((s) => s.running)).toEqual([true, false]);
    expect(running.unassignedRunning).toBe(true);
    const nobody = trimFigures({ ...trim, recent: [{ trim_operator: null }] });
    expect(nobody.shifts.map((s) => s.running)).toEqual([false, false]);
    expect(nobody.unassignedRunning).toBe(true);
  });

  it("THE LINE RUNS ON THE CLOCK (canon 0.30.163): his 6-6 and 6-6; the shift on duty runs while a lot stands in the Unloaded Queue for trim", () => {
    expect(TRIM_SHIFT_HOURS_DEFAULT).toEqual({ day: "06:00-18:00", second: "18:00-06:00" });
    const day = parseShiftWindow(null, TRIM_SHIFT_HOURS_DEFAULT.day);
    const second = parseShiftWindow(null, TRIM_SHIFT_HOURS_DEFAULT.second);
    expect(day).toEqual({ startMinutes: 360, endMinutes: 1080 });
    expect(second).toEqual({ startMinutes: 1080, endMinutes: 360 });
    // The start is inside, the end is not; the Second shift wraps midnight.
    expect(shiftWindowHolds(day, 360)).toBe(true);
    expect(shiftWindowHolds(day, 1079)).toBe(true);
    expect(shiftWindowHolds(day, 1080)).toBe(false);
    expect(shiftWindowHolds(second, 1080)).toBe(true);
    expect(shiftWindowHolds(second, 0)).toBe(true);
    expect(shiftWindowHolds(second, 359)).toBe(true);
    expect(shiftWindowHolds(second, 360)).toBe(false);
    expect(shiftWindowHolds(parseShiftWindow("07:00-07:00", "06:00-18:00"), 200)).toBe(true);
    expect(parseShiftWindow("garbage", "06:00-18:00")).toEqual(day);
    expect(parseShiftWindow(" 8:00 - 16:30 ", "06:00-18:00")).toEqual({ startMinutes: 480, endMinutes: 990 });
    // The Eastern clock: 14:30Z in September is 10:30 AM Eastern (630 minutes); 03:15Z is 11:15 PM the evening before (1395).
    expect(etClockMinutes("2026-09-21T14:30:00.000Z")).toBe(630);
    expect(etClockMinutes("2026-09-22T03:15:00.000Z")).toBe(1395);
    // 10:30 AM Eastern with a lot in the queue: the Day card runs, the Second does not.
    const morning = trimFigures({ ...trim, queueLots: 2, nowIso: "2026-09-21T14:30:00.000Z" });
    expect(morning.shifts.map((s) => [s.onDuty, s.running])).toEqual([[true, true], [false, false]]);
    expect(morning.shifts[0].hours_window).toBe("06:00-18:00");
    // 11:15 PM Eastern: the Second card runs.
    const night = trimFigures({ ...trim, queueLots: 1, nowIso: "2026-09-22T03:15:00.000Z" });
    expect(night.shifts.map((s) => [s.onDuty, s.running])).toEqual([[false, false], [true, true]]);
    // An empty queue: on duty, not running; a package in the last 30 minutes still lights its shift.
    const empty = trimFigures({ ...trim, queueLots: 0, nowIso: "2026-09-21T14:30:00.000Z", recent: [{ trim_operator: "Victor" }] });
    expect(empty.shifts.map((s) => [s.onDuty, s.running])).toEqual([[true, false], [false, true]]);
    // Hours from data override the defaults; a blank value falls back.
    const custom = trimFigures({ ...trim, queueLots: 1, nowIso: "2026-09-21T14:30:00.000Z", shiftHours: { day: "12:00-20:00", second: "" } });
    expect(custom.shifts.map((s) => [s.hours_window, s.onDuty])).toEqual([["12:00-20:00", false], ["18:00-06:00", false]]);
    // Without an instant nothing is on duty (the pure figures of a fixture).
    expect(trimFigures({ ...trim, queueLots: 5 }).shifts.map((s) => s.onDuty)).toEqual([false, false]);
  });

  it("the picture: his seven machines, six flow bars of his width, the greens moving only while the line runs, the endpoints carrying the grams (the TRIM circle fed by T-0, his correction), the lines converging on the shift total", () => {
    const f = trimFigures({ ...trim, finishedLots: [{ lot_id: "a", dry_grams: 1000, recorded_grams: 800, last_operator: "Olga" }], inputLbs: { day: 12.5, second: null } });
    const day = trimLinePicture(f.shifts[0]);
    expect(day).toContain('<svg class="hc-trimline" viewBox="0 0 1000 704" role="img" aria-label="Shift total 2.12 lb · 950 g" data-hc-trimline data-hc-trimline-running="0" data-hc-trimline-total="950">');
    for (const node of ["trim", "t0", "sorter", "marvel", "bio", "bud", "retrim"]) expect(day).toContain(`data-hc-node="${node}"`);
    for (const flow of ["t0-trim", "t0-sorter", "sorter-marvel", "marvel-bud", "marvel-bio", "marvel-retrim"]) expect(day).toContain(`data-hc-flow="${flow}"`);
    expect(day.match(/data-hc-flow=/g)).toHaveLength(6);
    // The bars keep his width: the vertical ones 44 wide, the horizontal ones 44 tall.
    // The TRIM circle is fed by T-0 (his correction), so its bar flows up, out of the box.
    expect(day).toContain('data-hc-flow="t0-trim" x="828" y="144" width="44" height="78" fill="url(#hc-flow-up-day)"');
    expect(day).toContain('data-hc-flow="t0-sorter" x="646" y="279" width="78" height="44"');
    expect(day).toContain('data-hc-flow="marvel-bio" x="173" y="362" width="44" height="90" fill="url(#hc-flow-down-day)" transform="rotate(30 195 362)"');
    // The stripes: the continuum tubes' pair, 20 by 20 tiles at 135 degrees; still when idle.
    expect(day).toContain('<pattern id="hc-flow-down-day" patternUnits="userSpaceOnUse" width="20" height="20">');
    expect(day).toContain('<polygon class="hc-flow-a" points="0,0 10,0 0,10"/>');
    expect(day).not.toContain("<animate ");
    // The endpoints carry the grams: BIO the BIO stream, BUD the Total Bud with bulk and prepack under, the TRIM circle the rest of Other
    // (TRIM 200 + WIP left 200 + WASTE 100; his correction: "The "other" weight is "trim", not retrim"); RETRIM carries no figure yet.
    expect(day).toContain('data-hc-node-value="bio" x="105" y="496">0 g</text>');
    expect(day).toContain('data-hc-node-value="bud" x="262" y="530">450 g</text>');
    expect(day).toContain("bulk 350 · prepack 100</text>");
    expect(day).toContain('<text class="hc-node-value" data-hc-node-value="trim" x="850" y="112">500 g</text>');
    expect(day).not.toContain('data-hc-node-value="retrim"');
    expect(day).toContain('<text class="hc-node-label" x="522" y="461">RETRIM</text>');
    // T-0 carries the grams weighed, the package count and the typed input pounds (the total run through it).
    expect(day).toContain('data-hc-node-value="t0" x="849" y="308">1.67 lb</text>');
    expect(day).toContain("750 g · 5 packages</text>");
    expect(day).toContain('<text class="hc-node-sub" data-hc-node-value="t0-input" x="849" y="362">input 12.50 lb</text>');
    // The converging lines from BIO, BUD and the TRIM circle, and the total under them.
    expect(day).toContain('<polyline points="118,548 118,612 990,612"/>');
    expect(day).toContain('<polyline points="912,82 990,82 990,612"/>');
    expect(day).toContain('<text class="hc-total-label" x="520" y="662">Shift total</text>');
    expect(day).toContain('data-hc-trimline-total-text x="520" y="692">2.12 lb · 950 g</text>');
    // Running: every pattern animates at the drying cadence, 900 ms a tile, toward the next machine (up, out of T-0, for the TRIM circle).
    const live = trimLinePicture({ ...f.shifts[1], running: true });
    expect(live).toContain('data-hc-trimline-running="1"');
    expect(live).toContain('<animate attributeName="y" from="0" to="20" dur="900ms" repeatCount="indefinite"/>');
    expect(live).toContain('<animate attributeName="x" from="0" to="-20" dur="900ms" repeatCount="indefinite"/>');
    expect(live).toContain('<animate attributeName="y" from="0" to="-20" dur="900ms" repeatCount="indefinite"/>');
    expect(live.match(/<animate /g)).toHaveLength(3);
    expect(live).toContain('<text class="hc-node-sub hc-node-muted" data-hc-node-value="t0-input" x="849" y="362">input lbs</text>');
    // Spanish speaks on the picture's words.
    expect(trimLinePicture(f.shifts[0], "es")).toContain(">Total del turno</text>");
  });

  it("parses the typed input lbs: blank clears, commas drop, two decimals, negatives and words refuse", () => {
    expect(parseInputLbs(null)).toBeNull();
    expect(parseInputLbs("  ")).toBeNull();
    expect(parseInputLbs("1,250.505")).toBe(1250.51);
    expect(parseInputLbs("0")).toBe(0);
    expect(() => parseInputLbs("-1")).toThrow(HttpError);
    expect(() => parseInputLbs("twelve")).toThrow(HttpError);
  });

  it("the section: two cards in his order, the picture on top, his lines under it, the DLH box, the sheet hours, the input lbs box, the unassigned line", () => {
    const html = trimmingSection({ ...withTrim, trim: { ...trim, inputLbs: { day: 12.5, second: null }, recent: [{ trim_operator: "Olga" }, { trim_operator: "Les" }] } });
    expect(html).toContain('<details class="hc-section" data-hc-section="trimming" open>');
    expect(html).toContain("<summary>Trimming</summary>");
    expect(html.indexOf('data-hc-shift="day"')).toBeLessThan(html.indexOf('data-hc-shift="second"'));
    const day = html.slice(html.indexOf('data-hc-shift="day"'), html.indexOf('data-hc-shift="second"'));
    expect(day).toContain('<span class="hc-shift-name">Day shift</span>');
    expect(day).toContain("data-hc-shift-operators>Olga</span>");
    expect(day).toContain('<span class="hc-date muted">2026-09-14</span>');
    expect(day).toContain('data-hc-shift-running="1"');
    expect(day).toContain('<span class="hc-running" data-hc-running>RUNNING</span>');
    for (const label of ["Other", "Bulk Bud", "Prepack Bud", "Total Bud", "BTR", "Lbs Produced Yesterday", "DLH Yesterday", "Lbs/DLH"]) {
      expect(day).toContain(`<dt>${label}</dt>`);
    }
    // The picture stands before the bud, the bud before the lines, and the lines keep his order.
    expect(day.indexOf("data-hc-trimline")).toBeLessThan(day.indexOf("data-hc-bud"));
    expect(day.indexOf("data-hc-bud")).toBeLessThan(day.indexOf('data-hc-metric="trim_other"'));
    expect(day).toContain('class="hc-visuals"');
    expect(day).toContain('data-hc-bud-consumed="40"');
    expect(day).toContain('data-hc-btr-read><strong>60.0%</strong> BTR</div>');
    expect(day).toContain('<div class="hc-legend"><span class="hc-swatch hc-swatch-bud"></span>bud <span class="hc-swatch hc-swatch-consumed"></span>consumed</div>');
    const order = ["trim_other", "trim_bulk", "trim_prepack", "trim_bud", "trim_btr", "trim_lbs", "trim_dlh", "trim_lbs_per_dlh", "trim_sheet_hours", "trim_input"];
    const positions = order.map((k) => day.indexOf(`data-hc-metric="${k}"`));
    expect(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1]))).toBe(true);
    // 750 g = 1.65 lb; 450 g = 0.99 lb; 350 g = 0.77 lb; 100 g = 0.22 lb; 300 g = 0.66 lb; 150 g/h = 0.33 lb/h.
    expect(day).toContain('<span class="hc-value" data-hc="trim_other">0.67 lb</span><span class="hc-sub muted">300 g · TRIM 200 + BIO 0 + WIP left 0 + other types 100</span>');
    expect(day).toContain('<span class="hc-value" data-hc="trim_bulk">0.78 lb</span><span class="hc-sub muted">350 g · SHAKE + BUD</span>');
    expect(day).toContain('<span class="hc-value" data-hc="trim_prepack">0.22 lb</span><span class="hc-sub muted">100 g · WPR</span>');
    expect(day).toContain('<span class="hc-value" data-hc="trim_bud">1.00 lb</span><span class="hc-sub muted">450 g · Bulk + Prepack</span>');
    expect(day).toContain('<span class="hc-value" data-hc="trim_btr">60.0%</span><span class="hc-sub muted">Total Bud / shift total (weighed + WIP left)</span>');
    expect(day).toContain('<span class="hc-value" data-hc="trim_lbs">1.67 lb</span><span class="hc-sub muted">750 g · 5 packages</span>');
    expect(day).toContain('<span class="hc-value" data-hc="trim_lbs_per_dlh">0.33 lb/h</span><span class="hc-sub muted">150 g/h</span>');
    expect(day).toContain(`<form method="post" action="${HARVEST_TRIM_HOURS_PATH}" class="hc-hours" data-hc-trim-hours="day">`);
    expect(day).toContain('<input type="hidden" name="shift" value="day">');
    expect(day).toContain('<input type="hidden" name="work_date" value="2026-09-14">');
    expect(day).toContain('value="5" placeholder="hours" aria-label="DLH Yesterday Day shift" data-hc-hours-input>');
    // The day's hours from the sheet, per farm, PNN ARL PNS.
    expect(day).toContain('<dt>Cutting and bucking hours from the sheet <span class="hc-date muted">2026-09-14</span></dt>');
    expect(day).toContain('<span data-hc-sheet-hours="PNN">PNN 8</span> · <span data-hc-sheet-hours="ARL">ARL <span class="muted">none</span></span> · <span data-hc-sheet-hours="PNS">PNS 0</span>');
    // The input lbs box, under the hours, per shift.
    expect(day).toContain(`<form method="post" action="${HARVEST_TRIM_INPUT_PATH}" class="hc-hours" data-hc-trim-input="day">`);
    expect(day).toContain('value="12.50" placeholder="lbs" aria-label="Input lbs Day shift" data-hc-input-lbs>');
    expect(day).toContain('<text class="hc-node-sub" data-hc-node-value="t0-input" x="849" y="362">input 12.50 lb</text>');
    expect(day).toContain('data-hc-trimline-running="1"');
    const second = html.slice(html.indexOf('data-hc-shift="second"'));
    expect(second).toContain('<span class="hc-shift-name">Second Shift</span>');
    expect(second).toContain('data-hc-shift-running="0"');
    expect(second).not.toContain("data-hc-running>");
    expect(second).toContain('<span class="hc-value" data-hc="trim_lbs_per_dlh">type hours</span>');
    expect(second).toContain('value="" placeholder="hours" aria-label="DLH Yesterday Second Shift" data-hc-hours-input>');
    expect(second).toContain('value="" placeholder="lbs" aria-label="Input lbs Second Shift" data-hc-input-lbs>');
    expect(second).toContain('data-hc-trimline-total="300"');
    expect(second.indexOf("data-hc-trimline")).toBeLessThan(second.indexOf("data-hc-bud"));
    expect(second.indexOf("data-hc-bud")).toBeLessThan(second.indexOf('data-hc-metric="trim_other"'));
    expect(second).toContain('data-hc-bud-consumed="70"');
    expect(second).toContain('data-hc-btr-read><strong>30.0%</strong> BTR</div>');
    expect(second).toContain('<div class="hc-legend"><span class="hc-swatch hc-swatch-bud"></span>bud <span class="hc-swatch hc-swatch-consumed"></span>consumed</div>');
    expect(html).toContain("data-hc-trim-unassigned>10 g yesterday by operators on neither shift: Les. Name the shifts' operators in Admin, Lookups, app_config.</p>");
    expect(html).toContain('data-hc-trim-running-unassigned><span class="hc-running">RUNNING</span> a package was weighed in the last 30 minutes by an operator on neither shift.</p>');
    expect(html).toContain('.hc-trimline animate');
    expect(html).toContain('setAttribute("dur","1800ms")');
  });

  it("THE SHEET SYNC (canon 0.30.162): the line under the sheet hours says when the sheet was last read; never read before a run; Spanish speaks, footnotes included", () => {
    // No run yet: the status is never and the line says so.
    const never = trimmingSection(withTrim);
    expect(never).toContain('data-hc-metric="trim_sheet_hours" data-hc-sheet-sync="never"');
    expect(never).toContain('<dd class="hc-sheet-sync muted" data-hc-sheet-sync-line>sheet never read</dd>');
    const neverEs = trimmingSection(withTrim, "es");
    expect(neverEs).toContain("data-hc-sheet-sync-line>la hoja nunca se leyo</dd>");
    // The Trimming footnote speaks both hands' sentences, in both languages (the clock rule and the sheet as the source).
    expect(never).toContain("RUNNING means the clock is inside the shift's hours");
    expect(never).toContain("The sheet is the source of the cutting and bucking hours and replaces a typed number at the next hour.");
    expect(neverEs).toContain("EN MARCHA significa que el reloj esta dentro de las horas del turno");
    expect(neverEs).toContain("La hoja es la fuente de las horas de corte y deshoje y reemplaza un numero escrito en la hora siguiente.");
    expect(neverEs).not.toContain("The sheet is the source of the cutting and bucking hours");
    // A run that read the sheet: the Eastern stamp, rows seen and rows changed (2026-09-21T14:15:00Z is 10:15 AM ET).
    const okView = { status: "ok" as const, at: "2026-09-21T14:15:00Z", rowsSeen: 44, rowsChanged: 3, message: null };
    const ok = trimmingSection({ ...withTrim, sheetSync: okView });
    expect(ok).toContain('data-hc-sheet-sync="ok"');
    expect(ok).toContain("data-hc-sheet-sync-line>read from the sheet at 2026-09-21 10:15 AM ET (44 rows, 3 changed)</dd>");
    expect(trimmingSection({ ...withTrim, sheetSync: okView }, "es")).toContain(
      "data-hc-sheet-sync-line>leido de la hoja a las 2026-09-21 10:15 AM ET (44 filas, 3 cambiadas)</dd>"
    );
    // An unchanged sheet and a failed read, each with its time; the failure carries its message.
    const skipped = trimmingSection({ ...withTrim, sheetSync: { status: "skipped", at: "2026-09-21T15:15:00Z", rowsSeen: null, rowsChanged: null, message: null } });
    expect(skipped).toContain('data-hc-sheet-sync="skipped"');
    expect(skipped).toContain("data-hc-sheet-sync-line>sheet unchanged since 2026-09-21 11:15 AM ET</dd>");
    const failed = trimmingSection({ ...withTrim, sheetSync: { status: "failed", at: "2026-09-21T16:15:00Z", rowsSeen: null, rowsChanged: null, message: "401 token" } });
    expect(failed).toContain('data-hc-sheet-sync="failed"');
    expect(failed).toContain("data-hc-sheet-sync-line>sheet read failed at 2026-09-21 12:15 PM ET: 401 token</dd>");
  });

  it("without the trim input the section renders empty, never throws; no unassigned or running line; Spanish speaks", () => {
    const html = trimmingSection(input);
    expect(html.match(/data-hc-trimline-total="0"/g)).toHaveLength(2);
    expect(html.match(/data-hc-trimline-running="0"/g)).toHaveLength(2);
    expect(html.match(/data-hc-bud-consumed="0"/g)).toHaveLength(2);
    expect((html.match(/class="hc-bud-cell hc-bud-empty"/g) || []).length).toBe(204);
    expect((html.match(/data-hc-bud-stem/g) || []).length).toBe(4);
    expect(html).toContain('aria-label="no packages yesterday"');
    expect(html).toContain("data-hc-btr-read>no packages yesterday</div>");
    expect(html).not.toContain("<animate ");
    expect(html).not.toContain("data-hc-trim-unassigned");
    expect(html).not.toContain("data-hc-trim-running-unassigned");
    expect(html).toContain("no operators named");
    expect(html).toContain('<span class="hc-value" data-hc="trim_btr"></span>');
    const es = trimmingSection(withTrim, "es");
    expect(es).toContain("Turno de dia");
    expect(es).toContain("Segundo turno");
    expect(es).toContain("Libras producidas ayer");
    expect(es).toContain("<dt>Flor total</dt>");
    expect(es).toContain("<dt>Otros</dt>");
    expect(es).toContain("Libras de entrada");
    expect(es).toContain('hc-swatch-bud"></span>flor <span class="hc-swatch hc-swatch-consumed"></span>consumido</div>');
  });

  it("the console page carries the built section open and flashes trim hours saved, and input lbs saved", () => {
    const html = harvestConsolePage({ input: withTrim, live: [], nowIso: "2026-09-15T12:00:00.000Z", ok: "trim_hours" });
    expect(html).toContain('data-hc-section="trimming" open');
    expect(html).toContain("data-hc-flash>Hours saved.</p>");
    const lbsSaved = harvestConsolePage({ input: withTrim, live: [], nowIso: "2026-09-15T12:00:00.000Z", ok: "trim_input" });
    expect(lbsSaved).toContain("data-hc-flash>Input lbs saved.</p>");
    expect(html.indexOf('data-hc-section="drying"')).toBeLessThan(html.indexOf('data-hc-section="trimming"'));
    expect(html.indexOf('data-hc-section="trimming"')).toBeLessThan(html.indexOf('data-hc-section="pasteurization"'));
  });

  it("keeps an order without a lot in the rate and out of lots ready", () => {
    const figures = testingFigures({
      ready: 0,
      scheduled: 0,
      waiting: 0,
      parents: [
        {
          parentKey: "1A40503000311FB0000SEED1",
          grams: 4480,
          passedFirst: 1,
          lab: "SC Labs Michigan",
          strain: "Seed Pass",
          farm: "ARL",
          failed_types: [],
        },
      ],
      tags: [],
    });
    expect(figures.ready).toBe(0);
    expect(figures.scheduled).toBe(0);
    expect(figures.first).toMatchObject({ passed: 1, all: 1, passedGrams: 4480, allGrams: 4480 });
    expect(figures.strains[0]).toMatchObject({ strain: "Seed Pass" });
    expect(figures.strains[0].farms[0]).toMatchObject({ farm: "ARL" });
  });

  it("the Prepack section lists bags by size and one DLH box", () => {
    const prepack = {
      units: [
        { unit: "3.5", bags: 2, grams: 7 },
        { unit: "7", bags: 1, grams: 7 },
        { unit: "14", bags: 0, grams: 0 },
        { unit: "28", bags: 0, grams: 0 },
      ],
      grams: 14,
      jobs: 1,
      hours: null as number | null,
    };
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-22T16:00:00.000Z", prepack });
    const section = html.slice(html.indexOf('data-hc-section="prepack"'));
    expect(html.indexOf('data-hc-section="testing"')).toBeLessThan(html.indexOf('data-hc-section="prepack"'));
    expect(section).toContain('data-prepack-unit="3.5"');
    expect(section).toContain('data-prepack-bags>2<');
    expect(section).toContain('data-hc="prepack_lbs">0.03<');
    expect(section).toContain('data-hc="prepack_jobs">1<');
    expect(section).toContain('action="/harvest/prepack-hours"');
    expect(section).toContain("type the hours");
    expect(section).toContain("The sheet does not replace this box.");
    const es = harvestConsolePage({ input, live, nowIso: "2026-09-22T16:00:00.000Z", locale: "es", prepack });
    expect(es).toContain("escriba las horas");
    expect(es).toContain("Preempacado");
    const withHours = harvestConsolePage({
      input,
      live,
      nowIso: "2026-09-22T16:00:00.000Z",
      prepack: { ...prepack, hours: 2 },
    });
    expect(withHours).toContain('data-hc="prepack_lbs_per_dlh">0.02<');
    expect(withHours).not.toContain("type the hours");
  });
});

describe("THE METRC-BORN HBN STAYS OUT OF THE HARVEST (canon 0.30.196)", () => {
  it("the HBN Queue, its count, the wet weight pick, the recall list, the lot pencil and the year's batches leave it out", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-app", hbn: "26260-PNN-GH-001-0-NA-26010", serial: 10, farm: "PNN" });
    seedBatch(m, { id: "hb-done", hbn: "26259-PNN-GH-001-0-NA-26011", serial: 11, farm: "PNN", status: "complete" });
    seedLot(m, "lot-done", "hb-done", "drying");
    seedBatch(m, { id: "hb-metrc", hbn: "46258-PNN-ID-062-0-NA-26007", serial: 7, farm: "PNN", born: "metrc" });
    const hbnQueue = queueByKey("hbn_queue")!;
    expect(await countQueue(m.db, hbnQueue)).toBe(1);
    expect((await listQueueRows(m.db, hbnQueue)).map((row) => row.id)).toEqual(["hb-app"]);
    expect((await listPaneRows(m.db, hbnQueue, "no_finished_lot")).map((row) => row.id)).toEqual(["hb-app"]);
    expect((await listRecallableBatches(m.db)).map((row) => row.id)).toEqual(["hb-app"]);
    expect((await listLookup(m.db, "harvest_batches")).map((row) => row.value).sort()).toEqual(["hb-app", "hb-done"]);
    expect((await listHarvestsByYear(m.db)).map((row) => [row.harvest_year, row.batches, row.lots_finished])).toEqual([[2026, 2, 1]]);
    seedBatch(m, { id: "hb-sheet", hbn: "26261-PNN-GH-001-0-NA-26012", serial: 12, farm: "PNN", born: "sheet" });
    expect(await countQueue(m.db, hbnQueue)).toBe(2);
    expect((await listQueueRows(m.db, hbnQueue)).map((row) => row.id).sort()).toEqual(["hb-app", "hb-sheet"]);
    expect((await listPaneRows(m.db, hbnQueue, "no_finished_lot")).map((row) => row.id).sort()).toEqual(["hb-app", "hb-sheet"]);
    expect((await listRecallableBatches(m.db)).map((row) => row.id).sort()).toEqual(["hb-app", "hb-sheet"]);
    expect((await listHarvestsByYear(m.db)).map((row) => [row.harvest_year, row.batches, row.lots_finished])).toEqual([[2026, 3, 1]]);
    expect((await listLookup(m.db, "harvest_batches")).map((row) => row.value).sort()).toEqual(["hb-app", "hb-done", "hb-sheet"]);
    const consoleInput = await loadHarvestConsole(m.db, "2026-09-23T16:00:00.000Z");
    expect(consoleInput.seasonLots).toHaveLength(1);
    await expect(
      createWetWeight(m.db, formOf({ person_id: person, team_lead: "Lead", harvest_batch_id: "hb-metrc", actual_dryspc: "dry-1" }))
    ).rejects.toMatchObject({ message: "That batch is not in the HBN Queue." });
    await expect(recallHarvestBatch(m.db, formOf({ person_id: person, id: "hb-metrc" }))).rejects.toMatchObject({ message: "That batch is not in the HBN Queue." });
  });
});
