import { describe, expect, it } from "vitest";
import { formatLbs } from "../src/compliance";
import {
  CONSOLE_FARMS,
  consoleBoxes,
  consoleYields,
  seasonDryFactor,
  dayBefore,
  etDate,
  etDayBounds,
  HARVEST_HOURS_PATH,
  HARVEST_PATH,
  HARVEST_TRIM_HOURS_PATH,
  harvestConsolePage,
  consoleDayOf,
  loadHarvestConsole,
  parseHours,
  prepackCodesOf,
  TRIM_LINE_BAR_WIDTH,
  TRIM_LINE_FLOW_MS,
  TRIM_RUNNING_MINUTES,
  TRIM_SHIFTS,
  trimFigures,
  trimLinePicture,
  trimmingSection,
  liveTrimLine,
  trimDuty,
  btrBar,
  emptyTrimInput,
  BUD_ROWS,
  BUD_COLS,
  BUD_CELLS,
  BUD_PRODUCT_CELLS,
  budWaffle,
  buildTestingFigures,
  isPasteurizedTag,
  type HarvestConsoleInput,
  type TrimInput,
  type YieldLot,
} from "../src/console";
import { CONFIG_KEYS, parseBtrTypeCodes, parseCryoTypeCategories, parseNameList, parseShiftWindow, parseTrimBogey, shiftWindowHolds, TRIM_BOGEY_DEFAULT, TRIM_SHIFT_HOURS_DEFAULT, trimBogeyOf } from "../src/config";
import { etClockMinutes, farmDayBounds } from "../src/farmday";
import { isReportKey, REPORT_CARDS, REPORT_KEYS } from "../src/reports";
import { LB_GRAMS, siloVisual, type SiloLive } from "../src/silo";
import { themeStylesheet } from "../src/theme";
import { countQueue, listHarvestsByYear, listLookup, listPaneRows, listQueueRows, listRecallableBatches } from "../src/db";
import { createWetWeight, recallHarvestBatch } from "../src/actions";
import { queueByKey } from "../src/pipeline";
import { formOf, migratedDb, seedBatch, seedLot, seedPerson } from "./migrated";

const input: HarvestConsoleInput = {
  today: "2026-09-15",
  day: "2026-09-14",
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
  dayWet: [
    { farm: "PNN", wet_grams: 90718.474 },
    { farm: "ARL", wet_grams: 4535.9237 },
  ],
  hours: { PNN: 8, ARL: null, PNS: 0 },
  plantCounts: { PNN: null, ARL: null, PNS: null },
};

const CAP = 15000 * LB_GRAMS;
const base = { fillingGrams: 0, fillingLots: 0, awaitingGrams: 0, loadedGrams: 0, clock: null, capacityGrams: CAP } as const;
const live: SiloLive[] = [
  { silo: { id: "s1", name: "Silo 1", shape: "cylinder", farm_code: "PNN" }, visual: siloVisual(base), loads: [], waiting: [], emptySince: null },
  { silo: { id: "s6", name: "Arlington Dry Room", shape: "box", farm_code: "ARL" }, visual: siloVisual({ ...base, fillingGrams: CAP / 4, fillingLots: 1 }), loads: [], waiting: [], emptySince: null },
];

describe("THE HARVEST CONSOLE (canon 0.30.73): the dashboard struck, the console at /harvest", () => {
  it("strikes the Harvest Dashboard from the report list (owner: 'Remove it from the report list.')", () => {
    expect(REPORT_KEYS).not.toContain("harvest_dashboard");
    expect(isReportKey("harvest_dashboard")).toBe(false);
    expect(REPORT_CARDS.map((c) => c.key)).not.toContain("harvest_dashboard");
    expect(REPORT_CARDS[0].key).toBe("inventory");
    expect(REPORT_KEYS).toContain("line_packages");
    expect(REPORT_KEYS).toContain("post_harvest_puzzles");
    expect(REPORT_KEYS).toHaveLength(12);
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

  it("computes the metrics per farm and for Total, pounds first with grams under", () => {
    const boxes = consoleBoxes(input);
    expect(boxes.map((b) => b.farm)).toEqual(["PNN", "ARL", "PNS", "Total"]);
    const pnn = boxes[0];
    expect(pnn.pct).toBeCloseTo(0.4, 9);
    expect(pnn.metrics.map((m) => m.key)).toEqual(["remaining_total", "harvested", "pct", "wet_per_plant", "dry_per_plant", "weight_harvested", "weight_harvested_year", "assumed_dry", "estimated_bud"]);
    const by = (farm: string, key: string) => {
      const box = boxes.find((b) => b.farm === farm)!;
      return box.metrics.find((m) => m.key === key)!;
    };
    expect(by("PNN", "remaining_total").value).toBe("1,200 / 2,000");
    expect(by("PNN", "harvested").value).toBe("800");
    expect(by("PNN", "pct").value).toBe("40.0%");
    expect(by("PNN", "wet_per_plant")).toEqual({ key: "wet_per_plant", label: "Wet Weight/plant AVG", value: "1.12 lb", sub: "500 g" });
    expect(by("PNN", "dry_per_plant")).toEqual({ key: "dry_per_plant", label: "Dry Weight/plant AVG", value: "0.25 lb", sub: "110 g" });
    expect(by("PNN", "weight_harvested").value).toContain("lb");
    expect(by("PNN", "hours")).toBeUndefined();
    expect(by("PNN", "weight_per_dlh")).toBeUndefined();
    // ARL: nothing harvested, no hours typed: the DLH line asks for hours and shows yesterday's pounds.
    expect(by("ARL", "remaining_total").value).toBe("300 / 300");
    expect(by("ARL", "pct").value).toBe("0.0%");
    expect(by("ARL", "wet_per_plant").value).toBe("");
    expect(by("ARL", "hours")).toBeUndefined();
    expect(by("ARL", "weight_per_dlh")).toBeUndefined();
    // PNS: all harvested; zero hours typed divides nothing.
    expect(boxes[2].pct).toBe(1);
    expect(by("PNS", "pct").value).toBe("100.0%");
    expect(by("PNS", "dry_per_plant").value).toBe("");
    expect(by("PNS", "weight_per_dlh")).toBeUndefined();
    // Total: every farm plus the plants under a license with no farm (the 9).
    const total = boxes[3];
    expect(by("Total", "remaining_total").value).toBe("1,500 / 2,350");
    expect(by("Total", "harvested").value).toBe("850");
    expect(total.pct).toBeCloseTo(850 / 2350, 9);
    expect(by("Total", "pct").value).toBe("36.2%");
    expect(by("Total", "hours")).toEqual({ key: "hours", label: "Harvest Hours", value: "8" });
    expect(by("Total", "weight_per_dlh")).toEqual({ key: "weight_per_dlh", label: "Weight/DLH", value: "26.58 lb/h", sub: "11,907 g/h" });
    // THE YEAR PANE (canon 0.30.346): last on Total, beneath Weight/DLH.
    expect(total.metrics.map((m) => m.key).slice(-7)).toEqual(["hours", "weight_per_dlh", "weight_harvested_year", "assumed_dry", "estimated_bud", "ff_dry_equiv", "estimated_dry_total"]);
    // THE PLANTS FROM ADMIN'S TOTAL (canon 0.30.346): a typed total less the remaining is the harvested, and drives the percent.
    const typed = consoleBoxes({ ...input, plantCounts: { PNN: 5000, ARL: null, PNS: 10 } });
    const tby = (farm: string, key: string) => typed.find((b) => b.farm === farm)!.metrics.find((m) => m.key === key)!.value;
    expect(tby("PNN", "remaining_total")).toBe("1,200 / 5,000");
    expect(tby("PNN", "harvested")).toBe("3,800");
    expect(tby("PNN", "pct")).toBe("76.0%");
    expect(tby("ARL", "harvested")).toBe("0");
    // PNS typed below its remaining reads zero harvested, never negative.
    expect(tby("PNS", "harvested")).toBe(String(Math.max(0, 10 - Number(by("PNS", "remaining_total").value.split(" / ")[0].replace(/,/g, "")))));
    const allHours = consoleBoxes({ ...input, harvestHoursAll: 4 });
    expect(allHours.find((b) => b.farm === "Total")!.metrics.find((m) => m.key === "hours")!.value).toBe("4");
    // No plants known at all: no percent, not a division by zero.
    const blank = consoleBoxes({ ...input, remaining: [], seasonHarvested: [] });
    expect(blank[3].pct).toBeNull();
    expect(blank[3].metrics.find((m) => m.key === "pct")!.value).toBe("");
    expect(consoleBoxes({ ...input, hours: { PNN: null, ARL: null, PNS: null } }, "es").find((b) => b.farm === "Total")!.metrics.find((m) => m.key === "weight_per_dlh")!.value).toBe("escriba las horas");
  });

  it("renders the collapsible sections: Plants, Trimming, Pasteurization and Testing open, Drying closed, no stub left (Pasteurization built by BRIEF V10, canon 0.30.334)", () => {
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z" });
    expect(html).toContain("<h1>Harvest Console</h1>");
    expect(html).toContain('<details class="hc-section" data-hc-section="plants" open>');
    expect(html).toContain('<summary>Plants <span class="muted hc-year">Harvest year 2026</span></summary>');
    expect(html).toContain('<details class="hc-section" data-hc-section="drying">');
    expect(html).toContain("<summary>Drying</summary>");
    expect(html).toContain('<details class="hc-section" data-hc-section="trimming" open>');
    expect(html).toContain("<summary>Trimming</summary>");
    // BRIEF V10 (canon 0.30.334): the Pasteurization section replaces the stub, open on a first visit.
    expect(html).toContain(`<details class="hc-section" data-hc-section="pasteurization" open>`);
    expect(html).toContain(`<summary>Pasteurization</summary>`);
    expect(html).toContain("data-hc-past-rightnow");
    expect(html).toContain('data-hc-rad-state="empty"');
    expect(html).toContain(`<details class="hc-section" id="testing" data-hc-section="testing" data-hc-testing-year="`);
    expect(html).toContain(`<summary>Testing <span class="muted hc-year">Harvest year 2026</span></summary>`);
    expect(html).toContain('data-hc-gate="ready"');
    expect(html).toContain('data-hc-icon="ready"');
    expect(html).toContain('data-hc="ready_packages">0<');
    expect(html).toContain('data-hc="ftq">NA<');
    expect(html).toContain("No first-time tests at the lab station this season.");
    expect(html).not.toContain("data-hc-thc");
    expect(html).not.toContain("Lots ready");
    expect(html.match(/data-hc-stub>/g)).toBeNull();
    expect(html).not.toContain("Stub: this section waits on the owner's definition.");
    expect(html).toContain('gf_hc_fold');
    expect(html).not.toContain('data-hc-section="drying" open');
    const order = ["plants", "drying", "trimming", "pasteurization", "testing", "prepack"].map((k) => html.indexOf(`data-hc-section="${k}"`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // THE DRYING TOTALS (canon 0.30.183): none handed, none drawn.
    expect(html).not.toContain("data-hc-drying-totals");
  });

  it("the drying tiles carry the next aW and MC lines", () => {
    const withCheck: SiloLive[] = [
      {
        ...live[0],
        visual: siloVisual({ ...base, loadedGrams: 1000, clock: "running" }),
        loads: [
          {
            id: "load-1",
            dry_space_id: "s1",
            silo_name: "Silo 1",
            wet_weight_entry_id: "lot-1",
            hbn: "26260-PNN-GH-001-0-NA-26070",
            metrc_harvest_tag: null,
            strain_label: "Papaya",
            farm_code: "PNN",
            weight_grams: 1000,
            loaded_at: "2026-09-28T12:00:00.000Z",
            started_at: "2026-09-28T12:00:00.000Z",
            paused_at: null,
            paused_seconds: 0,
            ended_at: null,
            notes: null,
          },
        ],
        loadChecks: [{ loadId: "load-1", kind: "aw", lot: "26070", checkNumber: 2, dueAt: "2026-09-29T18:00:00.000Z" }],
      },
    ];
    const html = harvestConsolePage({ input, live: withCheck, nowIso: "2026-09-29T12:00:00.000Z" });
    const drying = html.slice(html.indexOf('data-hc-section="drying"'), html.indexOf('data-hc-section="trimming"'));
    expect(drying).toContain('data-load="load-1"');
    expect(drying).toContain("Next aW check in");
    expect(drying).toContain('data-kind="aw"');
    expect(drying).toContain("data-icon-siren-lamp");
    expect(drying).toContain('data-check-n>2<');
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
      "Weight Harvested",
      "Harvest Year Total",
      "Assumed Dry",
      "Estimated Bud",
    ];
    for (const label of labels) expect(html.match(new RegExp(`<dt>${label.replace(/[%/]/g, (c) => (c === "%" ? "%" : "\\/"))}`, "g"))).toHaveLength(4);
    expect(html.match(/<dt>Harvest Hours/g)).toHaveLength(1);
    expect(html.match(/<dt>Weight\/DLH/g)).toHaveLength(1);
    expect(html).toContain('<span class="hc-value" data-hc="remaining_total">1,200 / 2,000</span>');
    expect(html).toContain('<span class="hc-value" data-hc="weight_per_dlh">26.58 lb/h</span><span class="hc-sub muted">11,907 g/h</span>');
  });

  it("the open numbox: one hours form per farm for yesterday, saving on change; Total shows the sum", () => {
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z", ok: "hours" });
    expect(html.match(/<form method="post" action="\/harvest\/hours" class="hc-hours"/g)).toHaveLength(1);
    expect(html).toContain('data-hc-hours="ALL"');
    expect(html).toContain('<input type="hidden" name="farm" value="ALL">');
    expect(html).toContain('<input type="hidden" name="work_date" value="2026-09-14">');
    expect(html).toContain('<input type="number" name="hours" min="0" step="0.25" inputmode="decimal" value="8" placeholder="hours" aria-label="Harvest Hours" data-hc-hours-input>');
    expect(html).not.toContain('data-hc-hours="PNN"');
    expect(html).not.toContain('data-hc-hours="ARL"');
    expect(html).toContain('<button type="submit" class="secondary">Save</button>');
    expect(html).toContain('box.addEventListener("change"');
    expect(html).toContain("box.form.requestSubmit()");
    // Total carries no box, only the sum.
    const total = html.slice(html.indexOf('data-hc-farm="Total"'), html.indexOf('data-hc-section="drying"'));
    expect(total).toContain('data-hc-hours="ALL"');
    expect(total).toContain('value="8"');
    // The date under the yesterday lines, and the flash after a save.
    // Twelve on the Plants boxes (hours, Weight Harvested and Weight/DLH per box), one per shift card
    // (canon 0.30.88), one on each card's sheet-hours line (canon 0.30.154), and one on each
    // pasteurization shift pane (BRIEF V10, canon 0.30.334).
    expect(html.match(/<span class="hc-date muted">2026-09-14<\/span>/g)).toHaveLength(10);
    expect(html).toContain('<p class="banner ok" data-hc-flash>Hours saved.</p>');
    expect(harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z" })).not.toContain("data-hc-flash");
  });

  it("the default day reads today so far, a pick offers Back to today, the plant count is the denominator, and the harvested weight shows even at zero", () => {
    expect(consoleDayOf("2026-09-15", "2026-09-15")).toEqual({ day: "2026-09-15", dayPicked: false });
    expect(consoleDayOf(null, "2026-09-15")).toEqual({ day: "2026-09-15", dayPicked: false });
    expect(consoleDayOf("2026-09-14", "2026-09-15")).toEqual({ day: "2026-09-14", dayPicked: true });
    const today = harvestConsolePage({ input: { ...input, day: "2026-09-15", dayPicked: false }, live, nowIso: "2026-09-15T16:00:00.000Z" });
    expect(today).toContain('data-hc-day-state>today so far; the panes below read today up to now');
    expect(today).not.toContain("data-hc-day-reset");
    expect(today).not.toContain("data-hc-day-today");
    expect(today).toContain("Today is 2026-09-15");
    const picked = harvestConsolePage({ input: { ...input, day: "2026-09-14", dayPicked: true }, live, nowIso: "2026-09-15T16:00:00.000Z" });
    expect(picked).toContain("picked; the panes below read this day");
    expect(picked).toContain('data-hc-day-reset>Back to today</a>');
    expect(picked).not.toContain("Today so far");
    const counted = consoleBoxes({ ...input, plantCounts: { PNN: 1000, ARL: null, PNS: null }, seasonHarvested: [{ farm: "PNN", plants: 250 }], remaining: [{ farm: "PNN", plants: 800 }] });
    const pnn = counted.find((b) => b.farm === "PNN")!;
    expect(pnn.metrics.find((m) => m.key === "remaining_total")!.value).toBe("800 / 1,000");
    // Canon 0.30.346: the typed total less the remaining (1,000 less 800) is the harvested; the lots' 250 no longer count.
    expect(pnn.metrics.find((m) => m.key === "harvested")!.value).toBe("200");
    expect(pnn.metrics.find((m) => m.key === "pct")!.value).toBe("20.0%");
    const stale = consoleBoxes({
      ...input,
      plantCounts: { PNN: 100, ARL: null, PNS: null },
      seasonHarvested: [{ farm: "PNN", plants: 250 }],
      remaining: [{ farm: "PNN", plants: 10 }],
    }).find((b) => b.farm === "PNN")!;
    // A typed total that the lots outrun no longer reads above 100%: 100 less the 10 remaining.
    expect(stale.metrics.find((m) => m.key === "pct")!.value).toBe("90.0%");
    expect(stale.pct).toBeCloseTo(0.9, 9);
    const fallback = consoleBoxes(input).find((b) => b.farm === "ARL")!;
    expect(fallback.metrics.find((m) => m.key === "remaining_total")!.value).toBe("300 / 300");
    const page = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z" });
    expect(page.match(/data-hc-metric="weight_harvested"/g)).toHaveLength(4);
    expect(page.match(/data-hc-metric="weight_harvested_year"/g)).toHaveLength(4);
    expect(page.match(/data-hc-metric="assumed_dry"/g)).toHaveLength(4);
    expect(page.match(/data-hc-metric="estimated_bud"/g)).toHaveLength(4);
    expect(page.match(/Harvest Year Total <span class="hc-date muted">2026<\/span>/g)).toHaveLength(4);
    expect(page).toContain('data-hc="weight_harvested">0.00 lb</span><span class="hc-sub muted">0 g</span>');
    expect(page).not.toContain("Plants remaining are the live plants");
    expect(page).not.toContain("The day's packages from Trim Packages Entry");
    expect(page).toContain("Harvest year 2026");
  });

  it("today picked bounds the weighed totes to today's farm day", async () => {
    const m = await migratedDb();
    const at = "2026-09-15T16:00:00.000Z";
    const bounds = farmDayBounds("2026-09-15", 6);
    seedBatch(m, { id: "hb-day", hbn: "26258-PNN-GH-001-0-NA-26001", serial: 1, farm: "PNN" });
    seedLot(m, "lot-day", "hb-day", "drying");
    m.run(
      `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES ('w-in', 'lot-day', 448, ?, ?)`,
      "2026-09-15T15:00:00.000Z",
      "2026-09-15T15:00:00.000Z"
    );
    m.run(
      `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES ('w-out', 'lot-day', 896, ?, ?)`,
      "2026-09-15T09:00:00.000Z",
      "2026-09-15T09:00:00.000Z"
    );
    const loaded = await loadHarvestConsole(m.db, at, "2026-09-15");
    expect(loaded.dayPicked).toBe(false);
    expect(loaded.day).toBe("2026-09-15");
    expect(loaded.dayWet).toEqual([{ farm: "PNN", wet_grams: 448 }]);
    expect(loaded.yearWet).toEqual([{ farm: "PNN", wet_grams: 1344 }]);
    const earlier = await loadHarvestConsole(m.db, at, "2026-09-14");
    expect(earlier.dayPicked).toBe(true);
    expect(earlier.day).toBe("2026-09-14");
    expect(earlier.dayWet).toEqual([{ farm: "PNN", wet_grams: 896 }]);
    expect(bounds.startIso < "2026-09-15T15:00:00.000Z" && "2026-09-15T15:00:00.000Z" < bounds.endIso).toBe(true);
    expect("2026-09-15T09:00:00.000Z" < bounds.startIso).toBe(true);
  });

  it("BRIEF V22: Assumed Dry and Estimated Bud, weighted, the frozen lot out, Total the sum of the farms", () => {
    const pkg = (type: string, grams: number) => ({ type_code: type, weight_grams: grams });
    const lots: YieldLot[] = [
      { farm: "PNN", status: "unloaded", wet_grams: 10000, dry_grams: 2000, freezer: false, packages: [pkg("BUD", 400), pkg("SMALLS", 100), pkg("TRIM", 100)] },
      { farm: "PNN", status: "unloaded", wet_grams: 2000, dry_grams: 1000, freezer: false, packages: [pkg("SHAKE", 800), pkg("TRIM", 400)] },
      { farm: "PNN", status: "trimmed", wet_grams: 8000, dry_grams: 1600, freezer: false, packages: [pkg("BUD", 900), pkg("smalls", 100), pkg("TRIM", 200)] },
      { farm: "PNN", status: "drying", wet_grams: 4000, dry_grams: null, freezer: false, packages: [] },
      { farm: "PNN", status: "weighing", wet_grams: 2000, dry_grams: null, freezer: false, packages: [] },
      { farm: "PNN", status: "frozen", wet_grams: 99999, dry_grams: 50000, freezer: false, packages: [pkg("BUD", 99999)] },
      { farm: "PNN", status: "drying", wet_grams: 50000, dry_grams: null, freezer: true, packages: [pkg("BUD", 1000)] },
      { farm: "ARL", status: "drying", wet_grams: 10000, dry_grams: null, freezer: false, packages: [] },
      { farm: "ZZZ", status: "trimmed", wet_grams: 8000, dry_grams: 8000, freezer: false, packages: [pkg("BUD", 8000)] },
    ];
    const yields = consoleYields(lots);
    // Weighted dry-down: 4600 / 20000 = 0.23. An average of the three ratios would be 0.30.
    expect(yields.farms.PNN.dryDown).toBeCloseTo(0.23, 9);
    expect(yields.farms.PNN.assumedDryGrams).toBeCloseTo(5980, 6);
    // BTR is the trimmed lot only: 1000 / 1200. The unloaded lots' packages stay out of the ratio.
    expect(yields.farms.PNN.btr).toBeCloseTo(1000 / 1200, 9);
    // SMALLS and SHAKE count as bud, TRIM does not. The over-trimmed lot's remainder stays at zero.
    // 2300 + (1000/1200) * (1380 + 1400) = 4616.666...
    expect(yields.farms.PNN.estimatedBudGrams).toBeCloseTo(2300 + (1000 / 1200) * 2780, 6);
    // No unloaded lot and no trimmed lot: no dry-down, and the line says so.
    expect(yields.farms.ARL.dryDown).toBeNull();
    expect(yields.farms.ARL.assumedDryGrams).toBe(0);
    expect(yields.farms.ARL.btr).toBeNull();
    expect(yields.farms.ARL.estimatedBudGrams).toBe(0);
    // A trimmed lot with no unloaded lot still has a dry-down (unloaded or trimmed).
    const trimmedOnly = consoleYields([{ farm: "PNS", status: "trimmed", wet_grams: 1000, dry_grams: 200, freezer: false, packages: [pkg("BUD", 80), pkg("TRIM", 20)] }]);
    expect(trimmedOnly.farms.PNS.dryDown).toBeCloseTo(0.2, 9);
    // No trimmed lot: the unloaded lot's bud counts, and nothing is projected.
    const noTrim = consoleYields([{ farm: "PNS", status: "unloaded", wet_grams: 5000, dry_grams: 1000, freezer: false, packages: [pkg("BUD", 400)] }]);
    expect(noTrim.farms.PNS.btr).toBeNull();
    expect(noTrim.farms.PNS.estimatedBudGrams).toBe(400);
    expect(noTrim.farms.PNS.assumedDryGrams).toBe(1000);
    // in_transit is still out, and takes the dry-down on its wet weight.
    const transit = consoleYields([
      { farm: "PNS", status: "unloaded", wet_grams: 5000, dry_grams: 1000, freezer: false, packages: [] },
      { farm: "PNS", status: "in_transit", wet_grams: 500, dry_grams: null, freezer: false, packages: [] },
    ]);
    expect(transit.farms.PNS.assumedDryGrams).toBeCloseTo(1100, 6);
    // Total is the sum of the farms, not the ratio over the pooled lots (that would be 8280 g).
    expect(yields.total.assumedDryGrams).toBeCloseTo(5980, 6);
    expect(yields.total.assumedDryGrams).not.toBeCloseTo(8280, 0);
    expect(yields.total.estimatedBudGrams).toBeCloseTo(yields.farms.PNN.estimatedBudGrams, 6);
    const filled = { ...input, yieldLots: lots };
    const boxes = consoleBoxes(filled);
    const metric = (farm: string, key: string) => boxes.find((b) => b.farm === farm)!.metrics.find((m) => m.key === key)!;
    expect(metric("PNN", "assumed_dry")).toEqual({ key: "assumed_dry", label: "Assumed Dry", value: `${formatLbs(5980)} lb`, sub: "at 23.0% dry-down" });
    expect(metric("PNN", "estimated_bud").value).toBe(`${formatLbs(yields.farms.PNN.estimatedBudGrams)} lb`);
    expect(metric("PNN", "estimated_bud").sub).toBe("at 83.3% BTR");
    expect(metric("ARL", "assumed_dry").sub).toBe("no dry-down yet");
    // ARL has no trimmed lot, so it borrows PNN's rate. The grams stay 0: no bud yet and no dry-down to project.
    expect(yields.farms.ARL.btrSource).toBe("season");
    expect(yields.farms.ARL.btrRate).toBeCloseTo(1000 / 1200, 9);
    expect(metric("ARL", "estimated_bud").sub).toBe("at 83.3% BTR, the season's (no lot trimmed here yet)");
    expect(metric("PNS", "assumed_dry")).toEqual({ key: "assumed_dry", label: "Assumed Dry", value: "0.00 lb", sub: "no dry-down yet" });
    expect(metric("Total", "assumed_dry").sub).toBe("the three farms");
    expect(metric("Total", "estimated_bud").sub).toBe("the three farms");
    expect(metric("Total", "assumed_dry").value).toBe(metric("PNN", "assumed_dry").value);
    expect(metric("Total", "assumed_dry").value).not.toContain("g");
    // The look-back does not move the harvest-year figures.
    const otherDay = consoleBoxes({ ...filled, day: "2025-01-01", dayPicked: true });
    expect(otherDay.find((b) => b.farm === "PNN")!.metrics.find((m) => m.key === "assumed_dry")).toEqual(metric("PNN", "assumed_dry"));
    const page = harvestConsolePage({ input: filled, live, nowIso: "2026-09-15T12:00:00.000Z" });
    const pnn = page.slice(page.indexOf('data-hc-farm="PNN"'), page.indexOf('data-hc-farm="ARL"'));
    const yearAt = pnn.indexOf('data-hc-metric="weight_harvested_year"');
    const dryAt = pnn.indexOf('data-hc-metric="assumed_dry"');
    const budAt = pnn.indexOf('data-hc-metric="estimated_bud"');
    expect(yearAt).toBeGreaterThan(0);
    expect(dryAt).toBeGreaterThan(yearAt);
    expect(budAt).toBeGreaterThan(dryAt);
    expect(pnn).toContain('data-hc="assumed_dry">13.35 lb</span><span class="hc-sub muted">at 23.0% dry-down</span>');
    expect(pnn).toContain('data-hc="estimated_bud">10.31 lb</span><span class="hc-sub muted">at 83.3% BTR</span>');
    const es = harvestConsolePage({ input: filled, live, nowIso: "2026-09-15T12:00:00.000Z", locale: "es" });
    expect(es).toContain("Seco asumido");
    expect(es).toContain("al 23.0% de seco");
    expect(es).toContain("Cogollo estimado");
    expect(es).toContain("al 83.3% BTR");
    expect(es).toContain("al 83.3% BTR, el de la temporada (ningun lote podado aqui aun)");
    expect(es).toContain("sin porcentaje de seco aun");
    expect(es).toContain("las tres granjas");
  });

  it("BRIEF V27: a farm with no trimmed lot borrows the season's pooled BTR, weighted, not the mean of the farms", () => {
    const pkg = (type: string, grams: number) => ({ type_code: type, weight_grams: grams });
    const lot = (
      farm: string,
      status: string,
      wet: number,
      dry: number | null,
      packages: { type_code: string; weight_grams: number }[],
      freezer = false
    ): YieldLot => ({ farm, status, wet_grams: wet, dry_grams: dry, freezer, packages });
    // PNN trimmed 100/100 = 100%. PNS trimmed 100/900 = 11.1%. The mean of the percents is 55.6%. The pool is 200/1000 = 20%.
    const lots: YieldLot[] = [
      lot("PNN", "trimmed", 1000, 400, [pkg("BUD", 80), pkg("SMALLS", 20), pkg("TRIM", 0)]),
      lot("PNS", "trimmed", 5000, 2000, [pkg("BUD", 100), pkg("TRIM", 800)]),
      lot("ARL", "unloaded", 8000, 2000, [pkg("BUD", 50), pkg("TRIM", 10)]),
      lot("ARL", "drying", 4000, null, []),
      lot("PNN", "frozen", 90000, 90000, [pkg("BUD", 80000)]),
      lot("PNS", "drying", 70000, null, [pkg("BUD", 60000)], true),
    ];
    // ARL dry-down is its own unloaded lot: 2000/8000 = 0.25. Projected dry of the drying lot: 0.25 * 4000 = 1000. Remainder: 2000 - 60 = 1940.
    const season = 200 / 1000;
    const mean = (1 + 100 / 900) / 2;
    expect(season).not.toBeCloseTo(mean, 2);
    const yields = consoleYields(lots);
    expect(yields.farms.PNN.btr).toBeCloseTo(1, 9);
    expect(yields.farms.PNN.btrSource).toBe("own");
    expect(yields.farms.PNN.btrRate).toBeCloseTo(1, 9);
    expect(yields.farms.PNS.btrSource).toBe("own");
    expect(yields.farms.PNS.btrRate).toBeCloseTo(100 / 900, 9);
    expect(yields.farms.ARL.btr).toBeNull();
    expect(yields.farms.ARL.btrSource).toBe("season");
    expect(yields.farms.ARL.btrRate).toBeCloseTo(season, 9);
    expect(yields.farms.ARL.btrRate).not.toBeCloseTo(mean, 2);
    const arlBud = 50 + season * (1000 + 1940);
    expect(yields.farms.ARL.estimatedBudGrams).toBeCloseTo(arlBud, 6);
    expect(yields.farms.ARL.assumedDryGrams).toBeCloseTo(3000, 6);
    expect(yields.total.estimatedBudGrams).toBeCloseTo(
      yields.farms.PNN.estimatedBudGrams + yields.farms.ARL.estimatedBudGrams + yields.farms.PNS.estimatedBudGrams,
      6
    );
    const boxes = consoleBoxes({ ...input, yieldLots: lots });
    const sub = (farm: string) => boxes.find((b) => b.farm === farm)!.metrics.find((m) => m.key === "estimated_bud")!.sub;
    expect(sub("PNN")).toBe("at 100.0% BTR");
    expect(sub("PNS")).toBe("at 11.1% BTR");
    expect(sub("ARL")).toBe("at 20.0% BTR, the season's (no lot trimmed here yet)");
    expect(sub("Total")).toBe("the three farms");
    const es = consoleBoxes({ ...input, yieldLots: lots }, "es");
    expect(es.find((b) => b.farm === "ARL")!.metrics.find((m) => m.key === "estimated_bud")!.sub).toBe(
      "al 20.0% BTR, el de la temporada (ningun lote podado aqui aun)"
    );
    // No trimmed lot anywhere: the line stays "no BTR yet" and Estimated Bud is the bud already weighed.
    const none = consoleYields([lot("ARL", "unloaded", 5000, 1000, [pkg("BUD", 400)]), lot("PNN", "drying", 2000, null, [])]);
    expect(none.farms.ARL.btr).toBeNull();
    expect(none.farms.ARL.btrSource).toBe("none");
    expect(none.farms.ARL.btrRate).toBeNull();
    expect(none.farms.ARL.estimatedBudGrams).toBe(400);
    expect(none.farms.PNN.btrSource).toBe("none");
    expect(none.farms.PNN.estimatedBudGrams).toBe(0);
    expect(consoleBoxes({ ...input, yieldLots: [lot("ARL", "drying", 1000, null, [])] }).find((b) => b.farm === "ARL")!.metrics.find((m) => m.key === "estimated_bud")!.sub).toBe(
      "no BTR yet"
    );
    // A trimmed lot with no trim grams ends the borrow and does not lend a rate.
    const emptyTrim = consoleYields([
      lot("PNN", "trimmed", 1000, 400, []),
      lot("ARL", "unloaded", 4000, 1000, [pkg("BUD", 80)]),
    ]);
    expect(emptyTrim.farms.PNN.btrSource).toBe("none");
    expect(emptyTrim.farms.ARL.btrSource).toBe("none");
    expect(emptyTrim.farms.ARL.estimatedBudGrams).toBe(80);
  });

  it("BRIEF V22: the loader reads the harvest year, and a picked day does not move the figures", async () => {
    const m = await migratedDb();
    const at = "2026-09-15T16:00:00.000Z";
    const ts = "2026-09-15T12:00:00.000Z";
    const freezer = "a1000001-0000-4000-8000-0000000000bf";
    seedBatch(m, { id: "hb-yield", hbn: "26258-PNN-GH-001-0-NA-26901", serial: 901, farm: "PNN" });
    seedBatch(m, { id: "hb-old", hbn: "25258-PNN-GH-001-0-NA-25901", serial: 801, farm: "PNN" });
    m.run(`UPDATE harvest_batches SET harvest_year = 2025 WHERE id = 'hb-old'`);
    const addLot = (id: string, batch: string, status: string, wet: number, dry: number | null, space: string) =>
      m.run(
        `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, dry_weight_grams, actual_dryspc, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        batch,
        wet,
        dry,
        space,
        status,
        ts,
        ts
      );
    const addPkg = (id: string, lot: string, type: string, grams: number, source: string | null, deleted: string | null) =>
      m.run(
        `INSERT INTO wip_packages (id, wet_weight_entry_id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, 'created', ?, ?, ?, ?)`,
        id,
        lot,
        id,
        type,
        grams,
        source,
        ts,
        ts,
        deleted
      );
    addLot("lot-unloaded", "hb-yield", "unloaded", 4480, 896, "dry-1");
    addPkg("pkg-bud", "lot-unloaded", "BUD", 200, null, null);
    addPkg("pkg-shake", "lot-unloaded", "SHAKE", 100, null, null);
    addPkg("pkg-trim", "lot-unloaded", "TRIM", 50, null, null);
    addPkg("pkg-cryo", "lot-unloaded", "BUD", 9999, "cryo", null);
    addPkg("pkg-void", "lot-unloaded", "BUD", 9999, null, ts);
    addLot("lot-trimmed", "hb-yield", "trimmed", 4480, 896, "dry-1");
    addPkg("pkg-tbud", "lot-trimmed", "BUD", 400, null, null);
    addPkg("pkg-ttrim", "lot-trimmed", "TRIM", 100, null, null);
    addLot("lot-frozen", "hb-yield", "frozen", 99999, 99999, "dry-1");
    addLot("lot-freezer", "hb-yield", "drying", 99999, null, freezer);
    addLot("lot-2025", "hb-old", "unloaded", 99999, 99999, "dry-1");
    addPkg("pkg-2025", "lot-2025", "BUD", 9999, null, null);
    const today = await loadHarvestConsole(m.db, at, "2026-09-15");
    const picked = await loadHarvestConsole(m.db, at, "2026-09-14");
    const read = (rows: YieldLot[] | undefined) => consoleYields(rows ?? [], ["BUD", "SMALLS", "SHAKE"]).farms.PNN;
    expect(read(picked.yieldLots)).toEqual(read(today.yieldLots));
    const pnn = read(today.yieldLots);
    expect(pnn.dryDown).toBeCloseTo(0.2, 9);
    expect(pnn.assumedDryGrams).toBeCloseTo(1792, 6);
    expect(pnn.btr).toBeCloseTo(0.8, 9);
    expect(pnn.estimatedBudGrams).toBeCloseTo(1136.8, 6);
  });

  it("BRIEF V23: fresh frozen dry equivalent and Estimated Dry Total, pooled, Total only", () => {
    const lot = (farm: string, status: string, wet: number, dry: number | null, freezer = false): YieldLot => ({
      farm,
      status,
      wet_grams: wet,
      dry_grams: dry,
      freezer,
      packages: [],
    });
    const lots: YieldLot[] = [
      lot("PNN", "unloaded", 10000, 2000),
      lot("PNN", "trimmed", 10000, 4000),
      lot("PNN", "drying", 5000, null),
      lot("PNN", "frozen", 8000, 9000),
      lot("ARL", "unloaded", 4000, 2000),
      lot("ARL", "drying", 2000, null, true),
      lot("ZZZ", "unloaded", 50000, 40000),
    ];
    const season = seasonDryFactor(lots);
    // Pooled 8000/24000. The mean of the farms' dry-downs is 0.40.
    expect(season.factor).toBeCloseTo(1 / 3, 9);
    expect(season.factor).not.toBeCloseTo(0.4, 2);
    expect(season.frozenLots).toBe(2);
    expect(season.frozenWetGrams).toBe(10000);
    const assumed = consoleYields(lots).total.assumedDryGrams;
    expect(assumed).toBeCloseTo(9500, 6);
    const filled = {
      ...input,
      remaining: [
        { farm: "PNN", plants: 100 },
        { farm: "ARL", plants: 40 },
        { farm: "PNS", plants: 10 },
        { farm: null, plants: 9 },
      ],
      seasonHarvested: [],
      plantCounts: { PNN: null, ARL: null, PNS: null },
      seasonLots: [{ farm: "PNN", wet_grams: 4480, dry_grams: null, plant_count: 10 }],
      yieldLots: lots,
    };
    const boxes = consoleBoxes(filled);
    const metric = (farm: string, key: string) => boxes.find((b) => b.farm === farm)!.metrics.find((m) => m.key === key);
    for (const farm of ["PNN", "ARL", "PNS"]) {
      expect(metric(farm, "ff_dry_equiv")).toBeUndefined();
      expect(metric(farm, "estimated_dry_total")).toBeUndefined();
    }
    const remaining = 150;
    const wetPer = 448;
    const factor = season.factor!;
    const remainingDry = remaining * wetPer * factor;
    const equiv = factor * season.frozenWetGrams;
    const totalGrams = remainingDry + assumed + equiv;
    expect(metric("Total", "ff_dry_equiv")).toEqual({
      key: "ff_dry_equiv",
      label: "Dry Equiv. Wt of Fresh Frozen",
      value: `${formatLbs(equiv)} lb`,
      sub: `${formatLbs(10000)} lb frozen at 33.3% dry-down`,
    });
    expect(metric("Total", "estimated_dry_total")).toEqual({
      key: "estimated_dry_total",
      label: "Estimated Dry Total",
      value: `${formatLbs(totalGrams)} lb`,
      sub: `150 plants left at ${formatLbs(wetPer * factor)} lb each + Assumed Dry + fresh frozen`,
    });
    expect(metric("Total", "estimated_dry_total")!.value).toBe("78.65 lb");
    expect(metric("Total", "ff_dry_equiv")!.value).not.toContain("g");
    const otherDay = consoleBoxes({ ...filled, day: "2025-01-01", dayPicked: true });
    expect(otherDay.find((b) => b.farm === "Total")!.metrics.find((m) => m.key === "estimated_dry_total")).toEqual(metric("Total", "estimated_dry_total"));
    // No unloaded or trimmed lot: both figures are a dash.
    const open = consoleBoxes({
      ...input,
      yieldLots: [lot("PNN", "drying", 5000, null), lot("ARL", "frozen", 9000, null)],
    });
    const dash = (key: string) => open.find((b) => b.farm === "Total")!.metrics.find((m) => m.key === key)!;
    expect(dash("ff_dry_equiv")).toEqual({ key: "ff_dry_equiv", label: "Dry Equiv. Wt of Fresh Frozen", value: "-", sub: "no dry-down yet" });
    expect(dash("estimated_dry_total").value).toBe("-");
    expect(dash("estimated_dry_total").sub).toBe("no dry-down yet");
    // A factor with no Wet Weight/Plant Avg leaves that part at zero and says so.
    const noAvg = consoleBoxes({ ...filled, seasonLots: [] });
    const noAvgTotal = noAvg.find((b) => b.farm === "Total")!.metrics.find((m) => m.key === "estimated_dry_total")!;
    expect(noAvgTotal.sub).toBe("no wet weight per plant");
    expect(noAvgTotal.value).toBe(`${formatLbs(assumed + equiv)} lb`);
    const es = harvestConsolePage({ input: filled, live, nowIso: "2026-09-15T12:00:00.000Z", locale: "es" });
    const esTotal = es.slice(es.indexOf('data-hc-farm="Total"'), es.indexOf('data-hc-section="drying"'));
    expect(esTotal).toContain("Peso seco equiv. de fresco congelado");
    expect(esTotal).toContain("Total seco estimado");
    expect(esTotal).toContain("22.32 lb congelado al 33.3% de seco");
    expect(esTotal).toContain("150 plantas restantes a 0.33 lb cada una + Seco asumido + congelado fresco");
    expect(es.indexOf('data-hc-farm="PNN"')).toBeLessThan(es.indexOf('data-hc-farm="Total"'));
    const esPnn = es.slice(es.indexOf('data-hc-farm="PNN"'), es.indexOf('data-hc-farm="ARL"'));
    expect(esPnn).not.toContain("ff_dry_equiv");
  });

  it("the Drying section is the silo strip with the Arlington Dry Room as the wire box", () => {
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z" });
    const drying = html.slice(html.indexOf('data-hc-section="drying"'), html.indexOf('data-hc-section="trimming"'));
    expect(drying).toContain('<section class="silo-strip" data-silo-strip>');
    expect(drying).toContain('data-silo="s1" data-silo-state="empty" data-silo-shape-kind="cylinder"');
    expect(drying).toContain('data-silo="s6" data-silo-state="filling" data-silo-shape-kind="box"');
    expect(drying).toContain('<div class="inv-gauge-name">Arlington Dry Room</div>');
    expect(drying).toContain('class="silo-shape silo-shape-box"');
    expect(drying).not.toContain("data-ffz=");
    expect(drying).toContain('fetch("/silos/live.json"');
    expect(drying).not.toContain("paintFfz");
  });

  it("THE PANES RIDE THE STRIP (owner, 2026-09-22): CSA and CSB stand in the drying row after the last space tile", () => {
    const cureTiles =
      '<div class="inv-gauge cure-pane" data-cure-pane="CSA"><div class="inv-gauge-name">CSA</div></div>' +
      '<div class="inv-gauge cure-pane" data-cure-pane="CSB"><div class="inv-gauge-name">CSB</div></div>';
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-15T12:00:00.000Z", cureTiles });
    const drying = html.slice(html.indexOf('data-hc-section="drying"'), html.indexOf('data-hc-section="trimming"'));
    const row = drying.slice(drying.indexOf('data-silo-strip'), drying.indexOf("</section>"));
    expect(row).toContain('data-dry-row="silo"');
    expect(row).toContain('data-dry-row="cure"');
    expect(row).toContain('data-dry-row="dry_room"');
    expect(row).not.toContain('data-dry-row="freezer"');
    expect(row.indexOf('data-dry-row="silo"')).toBeLessThan(row.indexOf('data-dry-row="cure"'));
    expect(row.indexOf('data-dry-row="cure"')).toBeLessThan(row.indexOf('data-dry-row="dry_room"'));
    expect(row).toContain('data-cure-pane="CSA"');
    expect(row).toContain('data-cure-pane="CSB"');
    expect(row.indexOf('data-silo="s1"')).toBeLessThan(row.indexOf('data-cure-pane="CSA"'));
    expect(row.indexOf('data-cure-pane="CSA"')).toBeLessThan(row.indexOf('data-cure-pane="CSB"'));
    expect(row.indexOf('data-cure-pane="CSB"')).toBeLessThan(row.indexOf('data-silo="s6"'));
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
    expect(es).toContain('<summary>Plantas <span class="muted hc-year">Año de cosecha 2026</span></summary>');
    expect(es).toContain("<summary>Secado</summary>");
    expect(es).toContain("<summary>Recorte</summary>");
    expect(es).toContain("<summary>Pasteurizacion</summary>");
    expect(es).toContain("<summary>Pruebas <span class=\"muted hc-year\">Año de cosecha 2026</span></summary>");
    expect(es).toContain("<dt>Plantas restantes/Plantas totales</dt>");
    expect(es).toContain("Horas de cosecha");
    expect(es).not.toContain("Inventario FFZ");
  });
});

/** THE PROGRESSION BUD (canon 0.30.273): his drawing, 100 cells on a 13 by 19
 * lattice, 1 at the heart and 100 at the foot. Every cell has its mirror. */
describe("THE BUD WAFFLE (canon 0.30.157), drawn as THE PROGRESSION BUD (canon 0.30.273)", () => {
  it("the table holds 100 cells, every number once, every cell with its mirror", () => {
    expect(BUD_ROWS).toBe(19);
    expect(BUD_COLS).toBe(13);
    expect(BUD_CELLS).toHaveLength(100);
    const numbers = BUD_CELLS.map((c) => c[2]).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    const byNumber = new Map(BUD_CELLS.map((c) => [c[2], c]));
    expect(byNumber.get(1)).toEqual([13, 6, 1]);
    expect(byNumber.get(100)).toEqual([18, 6, 100]);
    expect([50, 82, 83, 100].map((n) => byNumber.get(n))).toEqual([[15, 6, 50], [16, 6, 82], [17, 6, 83], [18, 6, 100]]);
    const seen = new Set<string>();
    for (const [row, col, n] of BUD_CELLS) {
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(BUD_ROWS);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(BUD_COLS);
      const key = `${row}:${col}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      const mirror = BUD_CELLS.find((c) => c[0] === row && c[1] === 12 - col);
      expect(mirror).toBeTruthy();
      expect(mirror?.[2]).not.toBe(0);
      if (col !== 6) expect(mirror?.[2]).not.toBe(n);
    }
    expect(seen.size).toBe(100);
    const sixtyThree = budWaffle(0.63);
    expect(sixtyThree).toContain('viewBox="0 0 130 190"');
    for (let n = 1; n <= 63; n++) expect(sixtyThree).toContain(`hc-bud-bud" data-hc-bud-order="${101 - n}" data-hc-bud-n="${n}"`);
    for (let n = 64; n <= 100; n++) expect(sixtyThree).toContain(`hc-bud-consumed" data-hc-bud-order="${101 - n}" data-hc-bud-n="${n}"`);
    const low = budWaffle(0.31);
    for (let n = 32; n <= 40; n++) expect(low).toMatch(new RegExp(`data-hc-bud-order="${101 - n}" data-hc-bud-n="${n}" [^>]* data-hc-bud-waste/>`));
    for (let n = 41; n <= 69; n++) expect(low).toMatch(new RegExp(`hc-bud-consumed" data-hc-bud-order="${101 - n}" data-hc-bud-n="${n}" [^>]*rx="1.2"/>`));
    expect(low).toMatch(/data-hc-bud-order="61" data-hc-bud-n="40" [^>]* data-hc-bud-waste\/>/);
    expect((budWaffle(0.31, "en", 0).match(/ data-hc-bud-waste\/>/g) || []).length).toBe(0);
    expect((budWaffle(0.31, "en", 100).match(/ data-hc-bud-waste\/>/g) || []).length).toBe(69);
    const none = budWaffle(null);
    expect((none.match(/class="hc-bud-cell hc-bud-empty"/g) || []).length).toBe(100);
    expect(none).not.toContain("data-hc-bud-stem");
    const pairs = [...none.matchAll(/data-hc-bud-order="(\d+)" data-hc-bud-n="(\d+)"/g)];
    expect(pairs).toHaveLength(100);
    for (const pair of pairs) expect(Number(pair[2])).toBe(101 - Number(pair[1]));
  });

  it("budWaffle(0.6) greys the first 40 cells; null outlines every cell; 1.004 greys 0; 0 greys them all", () => {
    const sixty = budWaffle(0.6);
    expect(sixty).toContain('<svg class="hc-bud" viewBox="0 0 130 190" role="img" aria-label="BTR 60.0%" data-hc-bud data-hc-bud-consumed="40" data-hc-bud-product="40">');
    expect((sixty.match(/class="hc-bud-cell hc-bud-consumed"/g) || []).length).toBe(40);
    expect((sixty.match(/class="hc-bud-cell hc-bud-bud"/g) || []).length).toBe(60);
    expect(sixty).not.toContain("data-hc-bud-stem");
    // Cell 1, the heart, is bud. Cell 100, the foot, is the first consumed.
    expect(sixty).toContain('hc-bud-bud" data-hc-bud-order="100" data-hc-bud-n="1"');
    expect(sixty).toContain('hc-bud-consumed" data-hc-bud-order="1" data-hc-bud-n="100"');
    for (let k = 1; k <= 40; k++) {
      expect(sixty).toContain(`class="hc-bud-cell hc-bud-consumed" data-hc-bud-order="${k}"`);
    }
    expect(sixty).toContain('class="hc-bud-cell hc-bud-bud" data-hc-bud-order="41"');
    const none = budWaffle(null);
    expect(none).toContain('data-hc-bud-consumed="0"');
    expect(none).toContain('aria-label="no packages on the day"');
    expect((none.match(/class="hc-bud-cell hc-bud-empty"/g) || []).length).toBe(100);
    expect(none).not.toContain("data-hc-bud-stem");
    expect(none).not.toContain('class="hc-bud-cell hc-bud-bud"');
    expect(none).not.toContain('class="hc-bud-cell hc-bud-consumed"');
    expect(budWaffle(null, "es")).toContain('aria-label="sin paquetes en el dia"');
    const over = budWaffle(1.004);
    expect(over).toContain('data-hc-bud-consumed="0"');
    expect((over.match(/class="hc-bud-cell hc-bud-bud"/g) || []).length).toBe(100);
    const zero = budWaffle(0);
    expect(zero).toContain('data-hc-bud-consumed="100"');
    expect((zero.match(/class="hc-bud-cell hc-bud-consumed"/g) || []).length).toBe(100);
    expect(zero).not.toContain("data-hc-bud-stem");
  });

  // THE PRODUCT LINE (canon 0.30.243; owner, 2026-09-26: "40% and under" and "I want it to look like biproduct for the first 60% and waste thereafter").
  it("the first sixty consumed cells grey as byproduct; a consumed cell of the last forty is waste, deep red", () => {
    expect(BUD_PRODUCT_CELLS).toBe(40);
    const waste = (svg: string) => (svg.match(/ data-hc-bud-waste\/>/g) || []).length;
    expect(waste(budWaffle(0.6))).toBe(0);
    expect(waste(budWaffle(0.4))).toBe(0);
    const low = budWaffle(0.31);
    expect(low).toContain('data-hc-bud-consumed="69"');
    expect(waste(low)).toBe(9);
    expect(low).toMatch(/class="hc-bud-cell hc-bud-consumed" data-hc-bud-order="60" [^>]*rx="1.2"\/>/);
    for (let k = 61; k <= 69; k++) {
      expect(low).toMatch(new RegExp(`class="hc-bud-cell hc-bud-consumed" data-hc-bud-order="${k}" [^>]* data-hc-bud-waste/>`));
    }
    expect(low).toMatch(/class="hc-bud-cell hc-bud-bud" data-hc-bud-order="70" [^>]*rx="1.2"\/>/);
    const zero = budWaffle(0);
    expect(waste(zero)).toBe(40);
    expect((zero.match(/class="hc-bud-cell hc-bud-consumed"/g) || []).length).toBe(100);
    expect(waste(budWaffle(1.004))).toBe(0);
    expect(waste(budWaffle(null))).toBe(0);
    expect(zero).not.toContain("data-hc-bud-stem");
    expect(low).not.toMatch(/hc-bud-bud"[^>]*data-hc-bud-waste/);
    expect(themeStylesheet("lite")).toContain(".hc-bud-consumed[data-hc-bud-waste] { fill: #7c1b1b; }");
    expect(themeStylesheet("co")).toContain(".hc-bud-consumed[data-hc-bud-waste] { fill: #7c1b1b; }");
    expect(themeStylesheet("cerberus")).toContain(".hc-bud-consumed[data-hc-bud-waste] { fill: #ba2929; }");
    // THE CONTRAST (canon 0.30.245, his pick "A: deeper green"): the legend swatch matches the waste cell in every skin.
    // THE DEEP RED (canon 0.30.248, his pick "Deep red (Recommended)"): #7c1b1b in Lite and Continuum, #ba2929 in Cerberus.
    expect(themeStylesheet("lite")).toContain(".hc-swatch-waste { background: #7c1b1b; margin-left: 0.45rem; }");
    expect(themeStylesheet("co")).toContain(".hc-swatch-waste { background: #7c1b1b; margin-left: 0.45rem; }");
    expect(themeStylesheet("cerberus")).toContain(".hc-swatch-waste { background: #ba2929; margin-left: 0.45rem; }");
  });

  // THE THROBBING WASTE (canon 0.30.266; owner, 2026-09-27: "make the dark red throb on the btr graph").
  it("a consumed waste cell throbs in its deep red, and the legend swatch stands still", () => {
    const rule = ".hc-bud-consumed[data-hc-bud-waste] { animation: hc-waste-throb 1.6s ease-in-out infinite; }";
    const frames = "@keyframes hc-waste-throb { 0%, 100% { fill-opacity: 0.55; } 50% { fill-opacity: 1; } }";
    const slow = "@media (prefers-reduced-motion: reduce) { .hc-bud-consumed[data-hc-bud-waste] { animation-duration: 3.2s; } }";
    for (const skin of ["lite", "co", "cerberus"] as const) {
      const css = themeStylesheet(skin);
      expect(css).toContain(rule);
      expect(css).toContain(frames);
      expect(css).toContain(slow);
      const reduced = css.slice(css.indexOf(slow), css.indexOf(slow) + slow.length);
      expect(reduced).not.toContain("animation: none");
      const swatch = css.match(/\.hc-swatch-waste \{[^}]+\}/)?.[0] ?? "";
      expect(swatch).not.toContain("animation");
      const trough = frames.match(/fill-opacity: ([0-9.]+)/g) ?? [];
      expect(trough.map((part) => Number(part.replace("fill-opacity: ", "")))).toEqual([0.55, 1]);
    }
    const low = budWaffle(0.31);
    expect(low).not.toContain("hc-waste-throb");
    expect(low).toMatch(/class="hc-bud-cell hc-bud-consumed" data-hc-bud-order="61" [^>]* data-hc-bud-waste\/>/);
  });

  // THE TRIM BOGEY (canon 0.30.249; owner, 2026-09-26: "Add a Admin Lookup Field: [Trim Bogey] expressed as a percentage",
  // "Determines number of dark red squares and the order based on our scheme (ROYGBIVWB-Aqua)").
  it("the Trim Bogey sets how many of the last cells are product, in the scheme's order", () => {
    const waste = (svg: string) => (svg.match(/ data-hc-bud-waste\/>/g) || []).length;
    const orders = (svg: string) => [...svg.matchAll(/data-hc-bud-order="(\d+)"[^>]* data-hc-bud-waste\/>/g)].map((m) => Number(m[1]));
    expect(TRIM_BOGEY_DEFAULT).toBe(BUD_PRODUCT_CELLS);
    const forty = budWaffle(0.31, "en", 40);
    expect(forty).toBe(budWaffle(0.31));
    expect(forty).toContain('data-hc-bud-product="40"');
    // At 35 the product is cells 1 to 35. At 31% BTR the waste is n 32 to 35, consumption positions 69 down to 66.
    const at35 = budWaffle(0.31, "en", 35);
    expect(at35).toContain('data-hc-bud-product="35"');
    expect(waste(at35)).toBe(4);
    expect(orders(at35).slice().sort((a, b) => a - b)).toEqual([66, 67, 68, 69]);
    expect(BUD_CELLS.find((c) => c[2] === 35)?.slice(0, 2)).toEqual([11, 3]);
    expect(at35).toMatch(/class="hc-bud-cell hc-bud-consumed" data-hc-bud-order="65" [^>]*rx="1.2"\/>/);
    // 0 draws no dark red; 100 draws every consumed cell; out of range clamps; a non-number keeps the default.
    expect(waste(budWaffle(0.31, "en", 0))).toBe(0);
    expect(waste(budWaffle(0.31, "en", 100))).toBe(69);
    expect(waste(budWaffle(0, "en", 100))).toBe(100);
    expect(budWaffle(0.31, "en", 150)).toContain('data-hc-bud-product="100"');
    expect(budWaffle(0.31, "en", Number.NaN)).toContain('data-hc-bud-product="40"');
    expect(waste(budWaffle(null, "en", 35))).toBe(0);
    // The stored value: a whole percent 0 to 100 (a trailing % allowed), else the default.
    expect(parseTrimBogey(null)).toBe(40);
    expect(parseTrimBogey("35")).toBe(35);
    expect(parseTrimBogey(" 35% ")).toBe(35);
    expect(parseTrimBogey("0")).toBe(0);
    expect(parseTrimBogey("100")).toBe(100);
    for (const bad of ["101", "-5", "35.5", "abc", ""]) expect(parseTrimBogey(bad)).toBe(40);
    expect(trimBogeyOf("12.5")).toBeNull();
    expect(trimBogeyOf("42")).toBe(42);
  });
});

/** THE TRIMMING SECTION (canon 0.30.88). Owner ruling 2026-09-16, verbatim:
 * "in the harvest console (not the continuum one) let's work on Trimming: Day
 * shift: Lbs Produced / DLH: [numbox] / Lbs/DLH / BTR
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
    const second = f.shifts[1];
    expect(second.bulkGrams).toBe(90);
    expect(second.prepackGrams).toBe(0);
    expect(second.restGrams).toBe(10); // KIEF
    expect(second.wipLeftGrams).toBe(0); // over, and a lot without a dry weight
    expect(second.finishedLots).toBe(2);
    expect(second.otherGrams).toBe(220);
    expect(second.totalGrams).toBe(310);
    expect(second.btr).toBeCloseTo(90 / 310, 9);
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
    const f = trimFigures({ ...trim, finishedLots: [{ lot_id: "a", dry_grams: 1000, recorded_grams: 800, last_operator: "Olga" }] });
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
    expect(day).not.toContain('data-hc-node-value="t0-input"');
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
    expect(live).not.toContain('data-hc-node-value="t0-input"');
    // Spanish speaks on the picture's words.
    expect(trimLinePicture(f.shifts[0], "es")).toContain(">Total del turno</text>");
  });

  it("the section: two cards in his order, the picture on top, his lines under it, the DLH box, the unassigned line", () => {
    const html = trimmingSection({ ...withTrim, trim: { ...trim, recent: [{ trim_operator: "Olga" }, { trim_operator: "Les" }] } });
    expect(html).toContain('<details class="hc-section" data-hc-section="trimming" open>');
    expect(html).toContain("<summary>Trimming</summary>");
    expect(html.indexOf('data-hc-shift="day"')).toBeLessThan(html.indexOf('data-hc-shift="second"'));
    const day = html.slice(html.indexOf('data-hc-shift="day"'), html.indexOf('data-hc-shift="second"'));
    expect(day).toContain('<span class="hc-shift-name">Day shift</span>');
    expect(day).toContain("data-hc-shift-operators>Olga</span>");
    expect(day).toContain('<span class="hc-date muted">2026-09-14</span>');
    expect(day).toContain('data-hc-shift-running="1"');
    expect(day).toContain('<span class="hc-running" data-hc-running>RUNNING</span>');
    for (const label of ["Other", "Bulk Bud", "Prepack Bud", "Total Bud", "BTR", "Lbs Produced", "DLH", "Lbs/DLH"]) {
      expect(day).toContain(`<dt>${label}</dt>`);
    }
    // The picture stands before the bud, the bud before the lines, and the lines keep his order.
    expect(day).not.toContain("data-hc-trimline");
    expect(day).toContain('class="hc-visuals"');
    expect(day).toContain('data-hc-bud-consumed="40"');
    expect(day).toContain('data-hc-btr-read><strong>60.0%</strong> BTR</div>');
    expect(day).toContain('<div class="hc-legend"><span class="hc-swatch hc-swatch-bud"></span>bud <span class="hc-swatch hc-swatch-consumed"></span>byproduct <span class="hc-swatch hc-swatch-waste"></span>waste</div>');
    const order = ["trim_other", "trim_bulk", "trim_prepack", "trim_bud", "trim_btr", "trim_lbs", "trim_dlh", "trim_lbs_per_dlh"];
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
    expect(day).toContain('value="5" placeholder="hours" aria-label="DLH Day shift" data-hc-hours-input>');
    expect(day).not.toContain("Cutting and bucking hours from the sheet");
    expect(day).not.toContain("data-hc-trimline");
    expect(day).not.toContain("data-hc-trim-input");
    expect(day).not.toContain('data-hc-node-value="t0-input"');
    const second = html.slice(html.indexOf('data-hc-shift="second"'));
    expect(second).toContain('<span class="hc-shift-name">Second Shift</span>');
    expect(second).toContain('data-hc-shift-running="0"');
    expect(second).not.toContain("data-hc-running>");
    expect(second).toContain('<span class="hc-value" data-hc="trim_lbs_per_dlh">type hours</span>');
    expect(second).toContain('value="" placeholder="hours" aria-label="DLH Second Shift" data-hc-hours-input>');
    expect(second).not.toContain("data-hc-trim-input");
    expect(second).not.toContain("data-hc-trimline");
    expect(second).toContain('data-hc-bud-consumed="70"');
    expect(second).toContain('data-hc-btr-read><strong>30.0%</strong> BTR</div>');
    expect(second).toContain('<div class="hc-legend"><span class="hc-swatch hc-swatch-bud"></span>bud <span class="hc-swatch hc-swatch-consumed"></span>byproduct <span class="hc-swatch hc-swatch-waste"></span>waste</div>');
    expect(html).toContain("data-hc-trim-unassigned>10 g on the day by operators on neither shift: Les. Name the shifts' operators in Admin, Lookups, app_config.</p>");
    expect(html).toContain('data-hc-trim-running-unassigned><span class="hc-running">RUNNING</span> a package was weighed in the last 30 minutes by an operator on neither shift.</p>');
    const rightNow = html.slice(html.indexOf("data-hc-trim-rightnow"), html.indexOf('data-hc-shift="day"'));
    expect(html.indexOf("data-hc-trim-rightnow")).toBeLessThan(html.indexOf('data-hc-shift="day"'));
    expect(rightNow).toContain("data-hc-btr-bar");
    expect(rightNow).toContain("no packages today");
    expect(html).toContain('data-hc-trim-totals');
    expect(html).toContain('setAttribute("dur","1800ms")');
  });

  it("THE RIGHT NOW PANE (canon 0.30.310): the live line, the bar, RUNNING and DOWN, and the day's totals", () => {
    const live = {
      ...trim,
      packages: [
        { type_code: "BUD", weight_grams: 200, trim_operator: "Olga" },
        { type_code: "TRIM", weight_grams: 100, trim_operator: "Victor" },
        { type_code: "WASTE", weight_grams: 10, trim_operator: "Les" },
      ],
      nowIso: "2026-09-21T14:30:00.000Z",
      recent: [{ trim_operator: "Olga" }],
      queueLots: 0,
      bogeyPct: 40,
    };
    const line = liveTrimLine(live);
    expect(line.grams).toBe(310);
    expect(line.budGrams).toBe(200);
    expect(line.running).toBe(true);
    expect(trimDuty(live)).toBe("day");
    // THE TRIMMING TIDIES (canon 0.30.313): the pane's DOWN follows the scale alone; a queued lot lights the cards, not the pane.
    const queued = liveTrimLine({ ...live, recent: [], queueLots: 1 });
    expect(queued.running).toBe(false);
    const queuedDown = trimmingSection({
      ...withTrim,
      today: "2026-09-21",
      trimLive: { ...live, recent: [], queueLots: 1 },
      lastWeighedAt: "2026-09-21T12:00:00.000Z",
    });
    const queuedPane = queuedDown.slice(queuedDown.indexOf("data-hc-trim-rightnow"), queuedDown.indexOf('data-hc-shift="day"'));
    expect(queuedPane).toContain("data-hc-trim-down");
    expect(queuedPane).toContain('data-hc-trimline-running="0"');
    expect(queuedPane).not.toContain("<animate ");
    const idle = liveTrimLine({ ...live, recent: [], queueLots: 0 });
    expect(idle.running).toBe(false);
    const html = trimmingSection({ ...withTrim, today: "2026-09-21", trimLive: live, lastWeighedAt: "2026-09-21T14:00:00.000Z" });
    expect(html.indexOf("data-hc-trim-rightnow")).toBeLessThan(html.indexOf('data-hc-shift="day"'));
    const pane = html.slice(html.indexOf("data-hc-trim-rightnow"), html.indexOf('data-hc-shift="day"'));
    expect(pane).toContain("data-hc-running");
    expect(pane).toContain("data-hc-btr-bar");
    expect(pane).toContain("data-hc-btr-tick");
    expect(pane).toContain("BTR ");
    expect(pane).toContain("Line total");
    expect(pane).not.toContain('data-hc-node-value="t0-input"');
    expect(html.slice(html.indexOf('data-hc-shift="day"'), html.indexOf('data-hc-shift="second"'))).not.toContain("hc-trimline");
    const down = trimmingSection({
      ...withTrim,
      today: "2026-09-21",
      trimLive: { ...live, recent: [], queueLots: 0 },
      lastWeighedAt: "2026-09-21T12:00:00.000Z",
    });
    expect(down).toContain("data-hc-trim-down");
    expect(down).toContain('data-state="running"');
    const silent = trimmingSection({ ...withTrim, trimLive: { ...emptyTrimInput(), nowIso: "2026-09-21T14:30:00.000Z", queueLots: 0 } });
    const silentPane = silent.slice(silent.indexOf("data-hc-trim-rightnow"), silent.indexOf('data-hc-shift="day"'));
    expect(silentPane).toContain("data-hc-trim-down");
    expect(silentPane).not.toContain("data-clock");
    expect(btrBar(0.612, 40)).toContain("BTR 61.2%");
    expect(btrBar(0.612, 40)).toContain("width:61.2%");
    expect(btrBar(0.612, 40)).toContain('data-hc-btr-tick');
    expect(btrBar(null, 40)).toContain("no packages today");
    const both = trimmingSection({ ...withTrim, trim: { ...trim, hours: { day: 5, second: 3 } } });
    expect(both).toContain('data-hc-trim-total="hours">');
    expect(both).toContain(">8<");
    const one = trimmingSection({ ...withTrim, trim: { ...trim, hours: { day: 5, second: null } } });
    expect(one).toContain('data-hc-trim-total="hours"');
    expect(one).toMatch(/data-hc-trim-total="hours"[\s\S]*?>5</);
    const none = trimmingSection({ ...withTrim, trim: { ...trim, hours: { day: null, second: null } } });
    expect(none).toContain('data-hc-trim-total="hours"');
    expect(none).toContain("type hours");
    // THE WEIGHTED BTR (canon 0.30.335): to the right of Lbs/DLH, both shifts' Total Bud over both shifts' totals:
    // Day 450 of 750 and Second 90 of 300 make 540 of 1050, 51.4% (the plain average would be 45.0%); Les and the
    // unnamed operator stay out.
    expect(both.indexOf('data-hc-trim-total="btr"')).toBeGreaterThan(both.indexOf('data-hc-trim-total="per"'));
    expect(both).toContain(
      '<div class="hc-trim-total" data-hc-trim-total="btr"><div class="hc-gate-name">Weighted BTR</div><span class="hc-value">51.4%</span><span class="hc-sub muted">both shifts, Total Bud over the shift totals</span></div>'
    );
    const quiet = trimmingSection({ ...withTrim, trim: { ...trim, packages: [] } });
    expect(quiet).toMatch(/data-hc-trim-total="btr"[\s\S]*?<span class="hc-value">no packages on the day<\/span><\/div>/);
    const esTotals = trimmingSection({ ...withTrim, trim: { ...trim, hours: { day: 5, second: 3 } } }, "es");
    expect(esTotals).toContain('<div class="hc-gate-name">BTR ponderado</div><span class="hc-value">51.4%</span><span class="hc-sub muted">ambos turnos, flor total sobre los totales de turno</span>');
  });

  it("the sheet read line has left the console; the long footnotes stay off the page", () => {
    const never = harvestConsolePage({ input: withTrim, live: [], nowIso: "2026-09-15T12:00:00.000Z" });
    expect(never).not.toContain("data-hc-sheet-sync");
    expect(never).not.toContain("sheet never read");
    expect(never).not.toContain("sheet read failed");
    const neverEs = harvestConsolePage({ input: withTrim, live: [], nowIso: "2026-09-15T12:00:00.000Z", locale: "es" });
    expect(neverEs).not.toContain("data-hc-sheet-sync");
    expect(never).not.toContain("RUNNING means the clock is inside the shift's hours");
    expect(never).not.toContain("Cutting and bucking hours from the sheet");
    expect(neverEs).not.toContain("EN MARCHA significa que el reloj esta dentro de las horas del turno");
    expect(neverEs).not.toContain("Horas de corte y desrame de la hoja");
  });

  it("without the trim input the section renders empty, never throws; no unassigned or running line; Spanish speaks", () => {
    const html = trimmingSection(input);
    expect(html.match(/data-hc-trimline-total="0"/g)).toHaveLength(1);
    expect(html.match(/data-hc-trimline-running="0"/g)).toHaveLength(1);
    expect(html.match(/data-hc-bud-consumed="0"/g)).toHaveLength(2);
    expect((html.match(/class="hc-bud-cell hc-bud-empty"/g) || []).length).toBe(200);
    expect(html).not.toContain("data-hc-bud-stem");
    expect(html).toContain('aria-label="no packages on the day"');
    expect(html).toContain("data-hc-btr-read>no packages on the day</div>");
    expect(html).not.toContain("<animate ");
    expect(html).not.toContain("data-hc-trim-unassigned");
    expect(html).not.toContain("data-hc-trim-running-unassigned");
    expect(html).toContain("no operators named");
    expect(html).toContain('<span class="hc-value" data-hc="trim_btr"></span>');
    const es = trimmingSection(withTrim, "es");
    expect(es).toContain("Turno de dia");
    expect(es).toContain("Segundo turno");
    expect(es).toContain("Libras producidas");
    expect(es).toContain("<dt>Flor total</dt>");
    expect(es).toContain("<dt>Otros</dt>");
    expect(es).not.toContain("Libras de entrada");
    expect(es).toContain('hc-swatch-bud"></span>flor <span class="hc-swatch hc-swatch-consumed"></span>subproducto <span class="hc-swatch hc-swatch-waste"></span>desperdicio</div>');
  });

  it("the console page carries the built section open and flashes trim hours saved", () => {
    const html = harvestConsolePage({ input: withTrim, live: [], nowIso: "2026-09-15T12:00:00.000Z", ok: "trim_hours" });
    expect(html).toContain('data-hc-section="trimming" open');
    expect(html).toContain("data-hc-flash>Hours saved.</p>");
    expect(html).not.toContain("Input lbs saved.");
    expect(html.indexOf('data-hc-section="drying"')).toBeLessThan(html.indexOf('data-hc-section="trimming"'));
    expect(html.indexOf('data-hc-section="trimming"')).toBeLessThan(html.indexOf('data-hc-section="pasteurization"'));
    // BRIEF V10 (canon 0.30.334): Pasteurization stands between Trimming and Testing, open, and flashes its hours saved.
    expect(html.indexOf('data-hc-section="pasteurization"')).toBeLessThan(html.indexOf('data-hc-section="testing"'));
    expect(html).toContain('data-hc-section="pasteurization" open');
    const pastSaved = harvestConsolePage({ input: withTrim, live: [], nowIso: "2026-09-15T12:00:00.000Z", ok: "pasteurization_hours" });
    expect(pastSaved).toContain("data-hc-flash>Hours saved.</p>");
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

  it("the Fulfillment section follows Prepack and is the last section", () => {
    const html = harvestConsolePage({ input, live, nowIso: "2026-09-22T16:00:00.000Z" });
    expect(html.indexOf('data-hc-section="prepack"')).toBeLessThan(html.indexOf('data-hc-section="fulfillment"'));
    const rest = html.slice(html.indexOf('data-hc-section="fulfillment"') + 'data-hc-section="fulfillment"'.length);
    expect(rest).not.toContain("data-hc-section=");
    expect(html).toContain('data-hc-section="fulfillment" open');
    expect(html).toContain("No figures typed for this day.");
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

describe("the Rad is the second way a tag is pasteurized", () => {
  it("counts a completed Rad tag in Ready and leaves a failed tag out", () => {
    expect(isPasteurizedTag("1A4050300000000000A00003", new Set(), new Set(["1A4050300000000000A00003"]))).toBe(true);
    expect(isPasteurizedTag("1A4050300000000000A00003", new Set())).toBe(false);
    const figures = buildTestingFigures({
      year: 2026,
      gateTypes: ["BUD", "WPR", "PRE", "MOB"],
      unitGrams: { PRE: 28, MOB: 70 },
      mirror: [
        { tag: "1A4050300000000000A00003", item: "BUD - A", quantity: 100, uom: "g", lab_test_status: "NotSubmitted", farm: "PNN" },
        { tag: "1A4050300000000000A00015", item: "WPR - A", quantity: 40, uom: "g", lab_test_status: "TestFailed", farm: "PNN" },
      ],
      cryo: [],
      rad: [{ tag: "1A4050300000000000A00003" }, { tag: "1A4050300000000000A00015" }],
      orders: [],
      sheet: [],
      marketByHbn: new Map(),
    });
    const ready = figures.panes.find((pane) => pane.gate === "ready");
    expect(ready?.packages).toBe(1);
    expect(ready?.grams).toBe(100);
  });
});
