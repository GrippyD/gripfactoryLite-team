/**
 * BRIEF V10, PASTEURIZATION ON THE CONSOLE (canon 0.30.334, re-based 0.30.335).
 * The pure figures by shift and live, the waste at Finish run (his pick), the
 * open runs' remainders (started runs only, canon 0.30.338), the render (the
 * Rad half running and empty, the cryo
 * picture, the list, the five icons in each card, the hours box), the hours
 * saved and logged, the Rad loader with and without a running run, and the
 * console loader's reads. The fixtures carry no name from the floor.
 */
import { describe, expect, it } from "vitest";
import {
  cryoLinePicture,
  cryoRunLeft,
  emptyPasteurizationInput,
  harvestConsolePage,
  livePasteurization,
  loadHarvestConsole,
  pasteurizationDuty,
  pasteurizationFigures,
  pasteurizationSection,
  savePasteurizationHours,
  type HarvestConsoleInput,
  type PasteurizationInput,
} from "../src/console";
import {
  CONFIG_KEYS,
  HARVEST_PASTEURIZATION_HOURS_PATH,
  PASTEURIZATION_RUNNING_MINUTES,
  PASTEURIZATION_SHIFT_HOURS_DEFAULT,
  PASTEURIZATION_SHIFTS,
  SYSTEM_REASON,
  parseCryoTypeCategories,
} from "../src/config";
import { scheduleRadPackage, startRadRun, unstartRadRun } from "../src/actions";
import { loadRadBoard, loadRadRunning, radLotNumber, type RadAvailableRow, type RadRunningView } from "../src/rad";
import { formOf, migratedDb, seedBatch, seedLot, seedMirror, seedPerson } from "./migrated";

const base: HarvestConsoleInput = {
  today: "2026-09-21",
  day: "2026-09-20",
  dayPicked: false,
  year: 2026,
  remaining: [],
  seasonHarvested: [],
  seasonLots: [],
  dayWet: [],
  hours: { PNN: null, ARL: null, PNS: null },
  plantCounts: { PNN: null, ARL: null, PNS: null },
};

/** A day's cryo room: three hands, the first on the Day shift, the second on the Second, the third on neither. */
const day: PasteurizationInput = {
  outputs: [
    { type_code: "BUD", weight_grams: 300, cryo_operator: "Hand One" },
    { type_code: "wpr", weight_grams: 100, cryo_operator: "hand one " },
    { type_code: "SMALLS", weight_grams: 50, cryo_operator: "Hand One" },
    { type_code: "SHA", weight_grams: 40, cryo_operator: "Hand One" },
    { type_code: "BUD", weight_grams: 90, cryo_operator: "Hand Two" },
    { type_code: "SHA", weight_grams: 7, cryo_operator: "Hand Three" },
    { type_code: "BUD", weight_grams: 3, cryo_operator: null },
  ],
  finishedRuns: [
    { run_id: "r1", in_grams: 1000, out_grams: 800, last_operator: "Hand One" },
    { run_id: "r2", in_grams: 500, out_grams: 600, last_operator: "Hand Two" },
    { run_id: "r3", in_grams: 100, out_grams: 60, last_operator: "Hand Three" },
  ],
  openRuns: [
    { run_id: "r4", in_grams: 300, out_grams: 100 },
    { run_id: "r5", in_grams: 50, out_grams: 80 },
  ],
  recent: [{ cryo_operator: "Hand One" }, { cryo_operator: "Hand Three" }],
  typeCategories: parseCryoTypeCategories(null),
  operators: { day: ["Hand One"], second: ["Hand Two"] },
  hours: { day: 5, second: null },
  nowIso: "2026-09-21T14:30:00.000Z",
  startHour: 6,
};

const HBN = "26273-PNN-GH-027-0-NA-27011";

const radRun: RadRunningView = {
  id: "rad-1",
  status: "running",
  grey: 1500,
  scheduledAt: "2026-09-21T12:00:00.000Z",
  startedAt: "2026-09-21T13:00:00.000Z",
  completedAt: null,
  packages: [
    { id: "p1", tag: "1A4050300000000000A00001", type: "BUD", position: 1, grams: 100, lab: "NotSubmitted", strain: "Fruity Pebbles", quantityLabel: "100 g", lot: HBN },
    { id: "p2", tag: "1A4050300000000000A00002", type: "WPR", position: 2, grams: 50, lab: "NotSubmitted", strain: "Fruity Pebbles", quantityLabel: "50 g", lot: HBN },
    { id: "p3", tag: "1A4050300000000000A00003", type: "SHA", position: 3, grams: 20, lab: "TestFailed", strain: "Fruity Pebbles", quantityLabel: "20 g", lot: "00003" },
  ],
  lots: [HBN, "00003"],
};

const page: HarvestConsoleInput = { ...base, pasteurization: day, pasteurizationLive: day, lastCryoOutputAt: "2026-09-21T14:20:00.000Z", radRunning: radRun };

describe("BRIEF V10, PASTEURIZATION ON THE CONSOLE (canon 0.30.334): the figures", () => {
  it("the shifts are the trim's two names bound to their own keys, the path, his thirty minutes, the seeded windows", () => {
    expect(PASTEURIZATION_SHIFTS.map((s) => [s.key, s.label])).toEqual([
      ["day", "Day shift"],
      ["second", "Second Shift"],
    ]);
    expect(PASTEURIZATION_SHIFTS[0].configKey).toBe(CONFIG_KEYS.pasteurization_shift_day_operators);
    expect(PASTEURIZATION_SHIFTS[1].configKey).toBe(CONFIG_KEYS.pasteurization_shift_second_operators);
    expect(CONFIG_KEYS.pasteurization_shift_day_hours).toBe("pasteurization_shift_day_hours");
    expect(CONFIG_KEYS.pasteurization_shift_second_hours).toBe("pasteurization_shift_second_hours");
    expect(HARVEST_PASTEURIZATION_HOURS_PATH).toBe("/harvest/pasteurization-hours");
    expect(PASTEURIZATION_RUNNING_MINUTES).toBe(30);
    expect(PASTEURIZATION_SHIFT_HOURS_DEFAULT).toEqual({ day: "06:00-18:00", second: "18:00-06:00" });
  });

  it("his pick: a run's waste is its inputs less its outputs at Finish run, 0 when the outputs exceed", () => {
    expect(cryoRunLeft({ in_grams: 1000, out_grams: 800 })).toBe(200);
    expect(cryoRunLeft({ in_grams: 500, out_grams: 600 })).toBe(0);
    expect(cryoRunLeft({ in_grams: "28537", out_grams: "0" })).toBe(28537);
    expect(cryoRunLeft({ in_grams: null, out_grams: null })).toBe(0);
  });

  it("the type sums by shift (case-blind), the WPR category, the waste by the run's last operator, the unassigned, RUNNING per shift, the duty, Lbs/DLH", () => {
    const figures = pasteurizationFigures(day);
    const [dayShift, second] = figures.shifts;
    expect(dayShift.key).toBe("day");
    expect(dayShift.packages).toBe(4);
    expect(dayShift.budGrams).toBe(300);
    // Prepack is WPR and any type the category list maps to WPR: SMALLS.
    expect(dayShift.prepackGrams).toBe(150);
    expect(dayShift.shakeGrams).toBe(40);
    // r1: 1000 in, 800 out, finished by the Day hand.
    expect(dayShift.wasteGrams).toBe(200);
    expect(dayShift.finishedRuns).toBe(1);
    expect(dayShift.totalGrams).toBe(690);
    expect(dayShift.hours).toBe(5);
    expect(dayShift.gramsPerDlh).toBe(138);
    expect(dayShift.running).toBe(true);
    expect(dayShift.onDuty).toBe(true);
    expect(dayShift.hours_window).toBe("06:00-18:00");
    expect(second.key).toBe("second");
    expect(second.packages).toBe(1);
    expect(second.budGrams).toBe(90);
    // r2: 500 in, 600 out, reads 0.
    expect(second.wasteGrams).toBe(0);
    expect(second.finishedRuns).toBe(1);
    expect(second.totalGrams).toBe(90);
    expect(second.gramsPerDlh).toBeNull();
    expect(second.running).toBe(false);
    expect(second.onDuty).toBe(false);
    // The third hand's 7 g and the unnamed 3 g, plus r3's 40 g of waste, gather into the note.
    expect(figures.unassignedGrams).toBe(50);
    expect(figures.unassignedOperators).toEqual(["Hand Three"]);
    expect(figures.unassignedRunning).toBe(true);
    expect(figures.clockGrams).toBe(0);
    expect(figures.clockOperators).toEqual([]);
  });

  it("nothing on the day: zeros, null Lbs/DLH, no RUNNING, no unassigned; typed hours over nothing read zero", () => {
    const figures = pasteurizationFigures({ ...emptyPasteurizationInput(), hours: { day: 4, second: null } });
    expect(figures.shifts[0].totalGrams).toBe(0);
    expect(figures.shifts[0].gramsPerDlh).toBe(0);
    expect(figures.shifts[1].gramsPerDlh).toBeNull();
    expect(figures.shifts.every((s) => !s.running)).toBe(true);
    expect(figures.unassignedGrams).toBe(0);
    expect(figures.unassignedRunning).toBe(false);
    expect(figures.clockGrams).toBe(0);
  });

  it("the duty reads the shifts' own windows: second at 2 AM Eastern, none in a gap of custom hours", () => {
    expect(pasteurizationDuty({ ...day, nowIso: "2026-09-22T06:00:00.000Z" })).toBe("second");
    expect(pasteurizationDuty({ ...day, nowIso: "2026-09-21T14:30:00.000Z" })).toBe("day");
    const custom = { ...day, shiftHours: { day: "07:00-15:00", second: "15:00-23:00" }, nowIso: "2026-09-22T03:30:00.000Z" };
    expect(pasteurizationDuty(custom)).toBeNull();
    expect(livePasteurization(custom).duty).toBeNull();
    expect(pasteurizationFigures(custom).shifts.every((s) => !s.onDuty)).toBe(true);
    expect(pasteurizationDuty({ ...day, nowIso: undefined })).toBeNull();
  });

  it("an unlisted operator counts by the entry clock, a named operator wins, and a row with no instant stays unassigned", () => {
    const morning = "2026-09-21T14:30:00.000Z";
    const night = "2026-09-22T03:15:00.000Z";
    const unnamed = pasteurizationFigures({
      ...emptyPasteurizationInput(),
      operators: { day: [], second: [] },
      outputs: [
        { type_code: "BUD", weight_grams: 100, cryo_operator: "Hand One", created_at: morning },
        { type_code: "SHA", weight_grams: 40, cryo_operator: "Hand Two", created_at: night },
        { type_code: "WPR", weight_grams: 7, cryo_operator: "Hand Three", created_at: null },
      ],
      finishedRuns: [{ run_id: "r", in_grams: 50, out_grams: 10, last_operator: "Hand One", completed_at: night }],
      recent: [
        { cryo_operator: "Hand Two", created_at: morning },
        { cryo_operator: "Hand Three" },
      ],
    });
    const [dayShift, second] = unnamed.shifts;
    expect(dayShift.budGrams).toBe(100);
    expect(dayShift.packages).toBe(1);
    expect(dayShift.running).toBe(true);
    expect(second.shakeGrams).toBe(40);
    expect(second.wasteGrams).toBe(40);
    expect(second.running).toBe(false);
    expect(unnamed.clockGrams).toBe(180);
    expect(unnamed.clockOperators).toEqual(["Hand One", "Hand Two"]);
    expect(unnamed.unassignedGrams).toBe(7);
    expect(unnamed.unassignedOperators).toEqual(["Hand Three"]);
    expect(unnamed.unassignedRunning).toBe(true);
    const named = pasteurizationFigures({
      ...emptyPasteurizationInput(),
      operators: { day: ["Hand One"], second: [] },
      outputs: [{ type_code: "BUD", weight_grams: 100, cryo_operator: "Hand One", created_at: night }],
      finishedRuns: [{ run_id: "r", in_grams: 20, out_grams: 0, last_operator: "Hand One", completed_at: night }],
      recent: [{ cryo_operator: "Hand One", created_at: night }],
    });
    expect(named.shifts[0].budGrams).toBe(100);
    expect(named.shifts[0].wasteGrams).toBe(20);
    expect(named.shifts[0].running).toBe(true);
    expect(named.shifts[1].totalGrams).toBe(0);
    expect(named.clockGrams).toBe(0);
    expect(named.unassignedGrams).toBe(0);
    expect(named.unassignedRunning).toBe(false);
    const overlap = pasteurizationFigures({
      ...emptyPasteurizationInput(),
      operators: { day: [], second: [] },
      shiftHours: { day: "06:00-20:00", second: "18:00-06:00" },
      outputs: [{ type_code: "BUD", weight_grams: 11, cryo_operator: "Hand Two", created_at: "2026-09-21T23:30:00.000Z" }],
    });
    expect(overlap.shifts[0].budGrams).toBe(11);
    expect(overlap.shifts[1].budGrams).toBe(0);
    const html = pasteurizationSection({
      ...base,
      pasteurization: {
        ...emptyPasteurizationInput(),
        operators: { day: [], second: [] },
        outputs: [{ type_code: "BUD", weight_grams: 88, cryo_operator: "Hand One", created_at: morning }],
      },
    });
    expect(html).toContain(
      'data-hc-past-clock>88 g on the day by operators on neither list, counted by the clock: Hand One. Name the shifts\' operators in Admin, Lookups, app_config.</p>'
    );
    expect(html).not.toContain("data-hc-past-unassigned");
  });

  it("the live line: every operator in one line, CRYO = BUD + WPR + WASTE, AMAPS = BUD + WPR, UV = SHA, the open runs' remainders shown and never counted", () => {
    const live = livePasteurization(day);
    expect(live.packages).toBe(7);
    expect(live.budGrams).toBe(393);
    expect(live.prepackGrams).toBe(150);
    expect(live.shakeGrams).toBe(47);
    expect(live.wasteGrams).toBe(240);
    expect(live.otherGrams).toBe(0);
    expect(live.totalGrams).toBe(830);
    expect(live.cryoGrams).toBe(783);
    expect(live.amapsGrams).toBe(543);
    expect(live.uvGrams).toBe(47);
    expect(live.finishedRuns).toBe(3);
    // r4 holds 200 g not yet entered out; r5's outputs exceed its inputs, so it holds nothing.
    expect(live.openRuns).toBe(1);
    expect(live.openGrams).toBe(200);
    expect(live.running).toBe(true);
    expect(live.duty).toBe("day");
    expect(live.hours_window).toBe("06:00-18:00");
    const still = livePasteurization({ ...day, recent: [] });
    expect(still.running).toBe(false);
    expect(still.wasteGrams).toBe(240);
    const stranger = livePasteurization({ ...day, outputs: [{ type_code: "MIX", weight_grams: 9, cryo_operator: "Hand One" }], finishedRuns: [] });
    expect(stranger.packages).toBe(1);
    expect(stranger.otherGrams).toBe(9);
    expect(stranger.totalGrams).toBe(0);
  });
});

describe("BRIEF V10 (canon 0.30.334): the section rendered", () => {
  it("the Right now pane: the head, the Rad half running with the throb, the lots, the count, the grey and the clock; the cryo picture and the list", () => {
    const html = pasteurizationSection(page);
    expect(html).toContain('<details class="hc-section" data-hc-section="pasteurization" open>');
    expect(html).toContain("<summary>Pasteurization</summary>");
    expect(html.indexOf("data-hc-past-rightnow")).toBeLessThan(html.indexOf('data-hc-past-shift="day"'));
    expect(html.indexOf('data-hc-past-shift="day"')).toBeLessThan(html.indexOf('data-hc-past-shift="second"'));
    const now = html.slice(html.indexOf("data-hc-past-rightnow"), html.indexOf('data-hc-past-shift="day"'));
    expect(now).toContain('<span class="hc-shift-name">Right now</span>');
    expect(now).toContain('<span class="hc-date muted">2026-09-21</span>');
    expect(now).toContain("data-hc-past-duty>Day shift</span>");
    expect(now).toContain('<span class="hc-running" data-hc-running>RUNNING</span>');
    expect(now).not.toContain("data-hc-past-down");
    expect(now.indexOf("data-hc-rad ")).toBeLessThan(now.indexOf("data-hc-cryo>"));
    const rad = now.slice(now.indexOf("data-hc-rad "), now.indexOf("data-hc-cryo>"));
    expect(rad).toContain('data-hc-rad-state="running"');
    expect(rad).toContain('data-hc-rad-run="rad-1"');
    expect(rad).toContain('class="hc-icon hc-icon-rad hc-rad-throb" data-hc-icon="rad"');
    expect(rad).toContain(`data-hc-rad-lots>${HBN}, 00003</div>`);
    expect(rad).toContain("data-hc-rad-count>3 packages</span>");
    expect(rad).toContain("data-hc-rad-grey>Grey (Gy) 1500</span>");
    expect(rad).toContain(`<span class="silo-clock" data-clock data-state="running" data-started="${Date.parse("2026-09-21T13:00:00.000Z")}" data-paused-at="" data-paused-seconds="0">0d 01:30:00</span>`);
    expect(rad).not.toContain("Rad empty");
    const cryo = now.slice(now.indexOf("data-hc-cryo>"));
    expect(cryo).toContain('data-hc-cryoline data-hc-cryoline-running="1" data-hc-cryoline-cryo="783"');
    expect(cryo).toContain("<animate ");
    expect(cryo).toContain('data-hc-flow="cryo-meter"');
    expect(cryo).toContain('data-hc-flow="meter-amaps"');
    expect(cryo).toContain('data-hc-flow="cryo-uv"');
    expect(cryo).toContain('data-hc-node="meter"');
    expect(cryo).not.toContain('data-hc-node-value="meter"');
    expect(cryo).toContain('data-hc-node-value="cryo" x="770" y="156">1.75 lb</text>');
    expect(cryo).toContain("783 g · 7 packages</text>");
    expect(cryo).toContain('data-hc-node-value="amaps" x="210" y="506">1.21 lb</text>');
    expect(cryo).toContain(">543 g</text>");
    expect(cryo).toContain('data-hc-node-value="uv" x="770" y="506">0.10 lb</text>');
    expect(cryo).toContain(">47 g</text>");
    expect(cryo).toContain('data-hc-cryo-since="06:00">since 06:00</span>');
    expect(cryo).toContain('data-hc="past_now_bud_lb">0.88 lb</span><span class="hc-sub muted" data-hc="past_now_bud_g">393 g</span>');
    expect(cryo).toContain('data-hc="past_now_wpr_g">150 g</span>');
    expect(cryo).toContain('data-hc="past_now_sha_g">47 g</span>');
    expect(cryo).toContain('data-hc="past_now_waste_g">240 g</span>');
    expect(cryo).toContain('data-hc="past_now_total_lb">1.85 lb</span><span class="hc-sub muted" data-hc="past_now_total_g">830 g</span>');
    const order = ["BUD", "WPR", "SHA", "WASTE", "TOTAL"].map((k) => cryo.indexOf(`data-hc-cryo-line="${k}"`));
    expect(order.every((p, i) => p >= 0 && (i === 0 || p > order[i - 1]))).toBe(true);
    expect(cryo).toContain('data-hc-cryo-open data-hc-cryo-open-runs="1" data-hc-cryo-open-grams="200">1 open run holds 0.45 lb not yet entered out</p>');
    expect(html).toContain('querySelectorAll(".hc-cryoline animate")');
    expect(html).toContain('setAttribute("dur","1800ms")');
    // Two open runs speak in the plural.
    const two = livePasteurization({ ...day, openRuns: [{ run_id: "a", in_grams: 300, out_grams: 100 }, { run_id: "b", in_grams: 150, out_grams: 50 }] });
    expect(two.openRuns).toBe(2);
    expect(two.openGrams).toBe(300);
    const plural = pasteurizationSection({ ...page, pasteurizationLive: { ...day, openRuns: [{ run_id: "a", in_grams: 300, out_grams: 100 }, { run_id: "b", in_grams: 150, out_grams: 50 }] } });
    expect(plural).toContain('data-hc-cryo-open-grams="300">2 open runs hold 0.67 lb not yet entered out</p>');
  });

  it("the open runs' line counts started runs only (his word at the gate, canon 0.30.338): a run with no output yet is queued, not held", () => {
    const queued = livePasteurization({ ...day, openRuns: [{ run_id: "q", in_grams: 900, out_grams: 0 }] });
    expect(queued.openRuns).toBe(0);
    expect(queued.openGrams).toBe(0);
    const mixed = livePasteurization({
      ...day,
      openRuns: [
        { run_id: "a", in_grams: 300, out_grams: 100 },
        { run_id: "q", in_grams: 900, out_grams: 0 },
        { run_id: "n", in_grams: 50, out_grams: 80 },
      ],
    });
    expect(mixed.openRuns).toBe(1);
    expect(mixed.openGrams).toBe(200);
    const none = pasteurizationSection({ ...page, pasteurizationLive: { ...day, openRuns: [{ run_id: "q", in_grams: 900, out_grams: 0 }] } });
    expect(none).not.toContain("data-hc-cryo-open");
    const one = pasteurizationSection({
      ...page,
      pasteurizationLive: { ...day, openRuns: [{ run_id: "a", in_grams: 300, out_grams: 100 }, { run_id: "q", in_grams: 900, out_grams: 0 }] },
    });
    expect(one).toContain('data-hc-cryo-open data-hc-cryo-open-runs="1" data-hc-cryo-open-grams="200">1 open run holds 0.45 lb not yet entered out</p>');
  });

  it("the shift panes for the day picked: the head, the five icons in order with the figures under them, no picture and no bud, the hours box, Lbs/DLH; the notes", () => {
    const html = pasteurizationSection(page);
    const dayCard = html.slice(html.indexOf('data-hc-past-shift="day"'), html.indexOf('data-hc-past-shift="second"'));
    expect(dayCard).toContain('data-hc-past-shift="day" data-hc-past-shift-grams="690" data-hc-past-shift-running="1"');
    expect(dayCard).toContain('<span class="hc-shift-name">Day shift</span>');
    expect(dayCard).toContain("data-hc-past-operators>Hand One</span>");
    expect(dayCard).toContain('<span class="hc-date muted">2026-09-20</span>');
    expect(dayCard).toContain('<span class="hc-running" data-hc-running>RUNNING</span>');
    const icons = ["bulk-bud", "prepack", "shake", "waste", "total"].map((k) => dayCard.indexOf(`data-hc-icon="${k}"`));
    expect(icons.every((p, i) => p >= 0 && (i === 0 || p > icons[i - 1]))).toBe(true);
    for (const label of ["Bulk Bud", "Prepack", "Shake", "Waste", "Total"]) expect(dayCard).toContain(`<div class="hc-gate-name">${label}</div>`);
    expect(dayCard).not.toContain("hc-cryoline");
    expect(dayCard).not.toContain("hc-trimline");
    expect(dayCard).not.toContain("data-hc-bud");
    // 300 g = 0.67 lb; 150 g = 0.33 lb; 40 g = 0.09 lb; 200 g = 0.45 lb; 690 g = 1.54 lb.
    for (const [key, lb, g] of [
      ["bulk", "0.67 lb", "300 g"],
      ["prepack", "0.33 lb", "150 g"],
      ["shake", "0.09 lb", "40 g"],
      ["waste", "0.45 lb", "200 g"],
      ["total", "1.54 lb", "690 g"],
    ]) {
      expect(dayCard).toContain(`<span class="hc-value" data-hc="past_${key}_lb">${lb}</span>`);
      expect(dayCard).toContain(`<span class="hc-sub muted" data-hc="past_${key}_g">${g}</span>`);
    }
    expect(dayCard).toContain(`<form method="post" action="${HARVEST_PASTEURIZATION_HOURS_PATH}" class="hc-hours" data-hc-past-hours="day">`);
    expect(dayCard).toContain('<input type="hidden" name="shift" value="day">');
    expect(dayCard).toContain('<input type="hidden" name="work_date" value="2026-09-20">');
    expect(dayCard).toContain('<input type="hidden" name="day_picked" value="">');
    expect(dayCard).toContain('value="5" placeholder="hours" aria-label="Total Hours Day shift" data-hc-hours-input>');
    expect(dayCard).toContain("<dt>Total Hours</dt>");
    expect(dayCard).toContain('<dt>Lbs/DLH</dt><dd><span class="hc-value" data-hc="past_lbs_per_dlh">0.31 lb/h</span><span class="hc-sub muted">138 g/h</span></dd>');
    const second = html.slice(html.indexOf('data-hc-past-shift="second"'));
    expect(second).toContain('data-hc-past-shift="second" data-hc-past-shift-grams="90" data-hc-past-shift-running="0"');
    expect(second).toContain('<span class="hc-shift-name">Second Shift</span>');
    expect(second).toContain("data-hc-past-operators>Hand Two</span>");
    expect(second).not.toContain("data-hc-running>");
    const secondIcons = ["bulk-bud", "prepack", "shake", "waste", "total"].map((k) => second.indexOf(`data-hc-icon="${k}"`));
    expect(secondIcons.every((p, i) => p >= 0 && (i === 0 || p > secondIcons[i - 1]))).toBe(true);
    expect(second.match(/data-hc-past-figure="/g)).toHaveLength(5);
    expect(second).toContain('data-hc="past_total_g">90 g</span>');
    expect(second).toContain('value="" placeholder="hours" aria-label="Total Hours Second Shift" data-hc-hours-input>');
    expect(second).toContain('data-hc="past_lbs_per_dlh">type hours</span>');
    expect(html).toContain("data-hc-past-unassigned>50 g on the day by operators on neither shift: Hand Three. Name the shifts' operators in Admin, Lookups, app_config.</p>");
    expect(html).toContain('data-hc-past-running-unassigned><span class="hc-running">RUNNING</span> an output was entered in the last 30 minutes by an operator on neither shift.</p>');
    const picked = pasteurizationSection({ ...page, day: "2026-09-08", dayPicked: true });
    expect(picked).toContain('<input type="hidden" name="work_date" value="2026-09-08">');
    expect(picked).toContain('<input type="hidden" name="day_picked" value="1">');
  });

  it("empty: the Rad inert and Rad empty, the line DOWN with no clock, the flows still, zeros, no notes; DOWN with the timer from the last output", () => {
    const html = pasteurizationSection(base);
    expect(html).toContain('data-hc-rad-state="empty"');
    expect(html).toContain('class="hc-icon hc-icon-rad" data-hc-icon="rad"');
    expect(html).not.toContain("hc-rad-throb");
    expect(html).toContain("data-hc-rad-empty>Rad empty</span>");
    expect(html).toContain('data-hc-cryoline-running="0"');
    expect(html).not.toContain("<animate ");
    expect(html).toContain("data-hc-past-down>DOWN</span>");
    expect(html).not.toContain("data-clock");
    expect(html).toContain("data-hc-past-duty>no shift on duty</span>");
    expect(html).not.toContain("data-hc-cryo-open");
    expect(html).not.toContain("data-hc-past-unassigned");
    expect(html).not.toContain("data-hc-past-running-unassigned");
    expect(html).toContain('data-hc="past_now_total_g">0 g</span>');
    expect(html.match(/data-hc-past-operators>no operators named<\/span>/g)).toHaveLength(2);
    expect(html.match(/data-hc="past_lbs_per_dlh">type hours<\/span>/g)).toHaveLength(2);
    const down = pasteurizationSection({ ...page, pasteurizationLive: { ...day, recent: [] }, radRunning: null });
    expect(down).toContain(`data-hc-past-down>DOWN</span> <span class="silo-clock" data-clock data-state="running" data-started="${Date.parse("2026-09-21T14:20:00.000Z")}" data-paused-at="" data-paused-seconds="0">0d 00:10:00</span>`);
    expect(down).toContain('data-hc-cryoline-running="0"');
    expect(down).toContain('data-hc-rad-state="empty"');
  });

  it("speaks Spanish on both halves, the list and the cards", () => {
    const es = pasteurizationSection(page, "es");
    expect(es).toContain("<summary>Pasteurizacion</summary>");
    expect(es).toContain('<span class="hc-shift-name">Ahora</span>');
    expect(es).toContain("data-hc-past-duty>Turno de dia</span>");
    expect(es).toContain("EN MARCHA");
    expect(es).toContain("data-hc-rad-grey>Gy 1500</span>");
    expect(es).toContain("data-hc-rad-count>3 paquetes</span>");
    expect(es).toContain("783 g · 7 paquetes</text>");
    expect(es).toContain('data-hc-cryo-since="06:00">desde 06:00</span>');
    expect(es).toContain("<dt>DESPERDICIO</dt>");
    expect(es).toContain("<dt>TOTAL</dt>");
    expect(es).toContain("1 corrida abierta tiene 0.45 lb sin salida registrada");
    for (const label of ["Flor a granel", "Preempacado", "Picadillo", "Desperdicio", "Total"]) expect(es).toContain(`<div class="hc-gate-name">${label}</div>`);
    expect(es).toContain("<dt>Horas totales</dt>");
    expect(es).toContain('aria-label="Horas totales Turno de dia"');
    expect(es).toContain("50 g en el dia de operadores sin turno: Hand Three. Nombre los operadores de cada turno en Admin, Lookups, app_config.");
    expect(es).toContain("una salida se registro en los ultimos 30 minutos por un operador sin turno.");
    const esEmpty = pasteurizationSection({ ...base }, "es");
    expect(esEmpty).toContain("Rad vacio");
    expect(esEmpty).toContain("data-hc-past-down>PARADO</span>");
    expect(esEmpty).toContain("sin operadores nombrados");
    expect(esEmpty).toContain("ningun turno de guardia");
  });

  it("the console page carries the section open between Trimming and Testing, no stub left, and flashes the hours saved", () => {
    const html = harvestConsolePage({ input: page, live: [], nowIso: "2026-09-21T14:30:00.000Z", ok: "pasteurization_hours" });
    expect(html).toContain('<details class="hc-section" data-hc-section="pasteurization" open>');
    expect(html.indexOf('data-hc-section="trimming"')).toBeLessThan(html.indexOf('data-hc-section="pasteurization"'));
    expect(html.indexOf('data-hc-section="pasteurization"')).toBeLessThan(html.indexOf('data-hc-section="testing"'));
    expect(html).not.toContain("hc-stub");
    expect(html).not.toContain("data-hc-stub");
    expect(html).toContain("data-hc-flash>Hours saved.</p>");
    expect(html).toContain('data-hc-rad-state="running"');
    expect(html).toContain("gf_hc_fold");
    // THE FOLD REMEMBERED (canon 0.30.288) met the stub: a browser that folded any section while the
    // stub stood holds pasteurization "0"; the script forgets that once and marks the fold built.
    expect(html).toContain('if (name === "pasteurization" && stored.pasteurization_built !== "1") return;');
    expect(html).toContain('var next = { pasteurization_built: "1" };');
    const picture = cryoLinePicture(livePasteurization(day), "en");
    expect(picture).toContain('aria-label="Cryo 1.75 lb"');
  });
});

describe("BRIEF V10 (canon 0.30.334): the hours saved, the Rad read, the console loaded", () => {
  it("migration 0086 seeds the four values: the lists blank, the windows 06:00-18:00 and 18:00-06:00", async () => {
    const m = await migratedDb();
    expect(m.all(`SELECT key, value FROM app_config WHERE key LIKE 'pasteurization_shift_%' ORDER BY key`)).toEqual([
      { key: "pasteurization_shift_day_hours", value: "06:00-18:00" },
      { key: "pasteurization_shift_day_operators", value: "" },
      { key: "pasteurization_shift_second_hours", value: "18:00-06:00" },
      { key: "pasteurization_shift_second_operators", value: "" },
    ]);
    expect(m.all(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pasteurization_labor_hours'`)).toHaveLength(1);
  });

  it("savePasteurizationHours: one row per date and shift, updates in place, a same value writes nothing, deletes on blank, logs each change, refuses what it must", async () => {
    const m = await migratedDb();
    seedPerson(m);
    const DAY = "2026-09-15";
    const first = await savePasteurizationHours(m.db, formOf({ shift: "day", work_date: DAY, hours: "6", day_picked: "1" }));
    expect(first.redirect).toBe(`/harvest?ok=pasteurization_hours&day=${DAY}`);
    const plain = await savePasteurizationHours(m.db, formOf({ shift: "day", work_date: DAY, hours: "6.5" }));
    expect(plain.redirect).toBe("/harvest?ok=pasteurization_hours");
    expect(m.all(`SELECT work_date, shift, hours FROM pasteurization_labor_hours`)).toEqual([{ work_date: DAY, shift: "day", hours: 6.5 }]);
    await savePasteurizationHours(m.db, formOf({ shift: "day", work_date: DAY, hours: "6.5" }));
    await savePasteurizationHours(m.db, formOf({ shift: "second", work_date: DAY, hours: "3" }));
    expect(m.all(`SELECT shift, hours FROM pasteurization_labor_hours ORDER BY shift`)).toEqual([
      { shift: "day", hours: 6.5 },
      { shift: "second", hours: 3 },
    ]);
    const logs = m.all(
      `SELECT old_value, new_value FROM record_change_log WHERE record_table = 'pasteurization_labor_hours' AND reason = ? ORDER BY changed_at, old_value`,
      SYSTEM_REASON.labor_hours
    );
    expect(logs).toHaveLength(3);
    expect(logs.map((row) => `${row.old_value}>${row.new_value}`).sort()).toEqual(["6>6.5", "null>3", "null>6"]);
    await expect(savePasteurizationHours(m.db, formOf({ shift: "night", work_date: DAY, hours: "5" }))).rejects.toMatchObject({ message: "Pick a shift." });
    await expect(savePasteurizationHours(m.db, formOf({ shift: "day", work_date: "2026-13-40", hours: "5" }))).rejects.toMatchObject({ message: "Work date must be YYYY-MM-DD." });
    await expect(savePasteurizationHours(m.db, formOf({ shift: "day", work_date: DAY, hours: "seven" }))).rejects.toMatchObject({
      message: "Hours must be a number of hours, zero or more.",
    });
    await savePasteurizationHours(m.db, formOf({ shift: "day", work_date: DAY, hours: "" }));
    expect(m.all(`SELECT shift FROM pasteurization_labor_hours`)).toEqual([{ shift: "second" }]);
    const cleared = m.all(`SELECT old_value, new_value FROM record_change_log WHERE record_table = 'pasteurization_labor_hours' AND new_value IS NULL`);
    expect(cleared).toEqual([{ old_value: "6.5", new_value: null }]);
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_table = 'trim_labor_hours'`)).toEqual({ n: 0 });
  });

  it("radLotNumber: the batch's hbn through the lineage, else the harvest name's HBN, else the tag's last five", () => {
    const row = (over: Partial<RadAvailableRow>): RadAvailableRow => ({
      tag: "1A4050300000000000A00009",
      type: "BUD",
      strain: "Fruity Pebbles",
      quantityLabel: "100 g",
      grams: 100,
      lab: "NotSubmitted",
      grow: null,
      harvest: HBN,
      hbnId: null,
      license: "GR-C-001132",
      location: null,
      packagedDate: null,
      strainName: "Fruity Pebbles",
      ...over,
    });
    const batches = new Map([["hb-1", "26258-PNN-GH-001-0-NA-26001"]]);
    expect(radLotNumber("1A4050300000000000A00009", row({ hbnId: "hb-1" }), batches)).toBe("26258-PNN-GH-001-0-NA-26001");
    expect(radLotNumber("1A4050300000000000A00009", row({ hbnId: "hb-unknown" }), batches)).toBe(HBN);
    expect(radLotNumber("1A4050300000000000A00009", row({}), batches)).toBe(HBN);
    expect(radLotNumber("1A4050300000000000A00009", row({ harvest: "Fruity Pebbles 9/1/2026" }), batches)).toBe("00009");
    expect(radLotNumber("1A4050300000000000A00009", undefined, batches)).toBe("00009");
  });

  it("loadRadRunning: null with no run in the Rad; the running run with its lot numbers; null again after unstart", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    expect(await loadRadRunning(m.db)).toBeNull();
    const one = "1A4050300000000000A70001";
    const two = "1A4050300000000000A70002";
    for (const [tag, item] of [
      [one, "BUD - Fruity Pebbles - PNN - O"],
      [two, "WPR - Fruity Pebbles - PNN - O"],
    ]) {
      seedMirror(m, { tag, harvest: HBN, item, strain: "Fruity Pebbles", grams: 100, status: "NotSubmitted", license: "GR-C-001132" });
    }
    await scheduleRadPackage(m.db, formOf({ person_id: person, tag: one }));
    await scheduleRadPackage(m.db, formOf({ person_id: person, tag: two }));
    const run = (await loadRadBoard(m.db)).scheduled[0];
    if (!run) throw new Error("no run");
    expect(run.packages.map((pkg) => pkg.lot)).toEqual([HBN, HBN]);
    expect(await loadRadRunning(m.db)).toBeNull();
    await startRadRun(m.db, run.id, formOf({ person_id: person }));
    const running = await loadRadRunning(m.db);
    expect(running?.id).toBe(run.id);
    expect(running?.status).toBe("running");
    expect(running?.grey).toBe(100);
    expect(running?.lots).toEqual([HBN]);
    expect(running?.packages).toHaveLength(2);
    expect(typeof running?.startedAt).toBe("string");
    await unstartRadRun(m.db, run.id, formOf({ person_id: person }));
    expect(await loadRadRunning(m.db)).toBeNull();
  });

  it("loadHarvestConsole reads the day's outputs and finished runs, today's with the open runs, the recent, the last output, the shifts' values and the hours", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-c", hbn: "26258-PNN-GH-001-0-NA-26001", serial: 1, farm: "PNN" });
    seedLot(m, "lot-c", "hb-c", "trimmed");
    const DAY = "2026-09-08";
    const AT = "2026-09-15T16:00:00.000Z";
    const sched = (id: string, status: string, completedAt: string | null) =>
      m.run(
        `INSERT INTO production_schedules (id, stage, wet_weight_entry_id, wip_package_id, harvest_batch_id, status, effective_date, scheduled_at, completed_at, created_at, updated_at)
         VALUES (?, 'cryo', NULL, NULL, 'hb-c', ?, ?, '2026-09-08T12:00:00.000Z', ?, '2026-09-08T12:00:00.000Z', '2026-09-08T12:00:00.000Z')`,
        id,
        status,
        DAY,
        completedAt
      );
    const input = (id: string, runId: string, grams: number) =>
      m.run(`INSERT INTO cryo_run_inputs (id, run_id, wip_package_id, package_type_code, weight_grams, created_at) VALUES (?, ?, ?, 'BUD', ?, '2026-09-08T12:00:00.000Z')`, id, runId, `trim-${id}`, grams);
    const output = (id: string, runId: string, type: string, grams: number, operator: string, cryoDate: string | null, createdAt: string) =>
      m.run(
        `INSERT INTO wip_packages (id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, cryo_weight_grams, status, cryo_date, cryo_operator, cryo_run_id, source, created_at, updated_at)
         VALUES (?, 'lot-c', 'hb-c', ?, ?, ?, ?, 'testing_queue', ?, ?, ?, 'cryo', ?, ?)`,
        id,
        `1A405030000000000${id.padStart(7, "0")}`,
        type,
        grams,
        grams,
        cryoDate,
        operator,
        runId,
        createdAt,
        createdAt
      );
    // A run finished on the day: 1000 g in, 800 g out, the last output by the Day hand.
    sched("run-done", "complete", "2026-09-08T20:00:00.000Z");
    input("in-1", "run-done", 1000);
    output("o1", "run-done", "BUD", 500, "Hand One", DAY, "2026-09-08T18:00:00.000Z");
    output("o2", "run-done", "WPR", 300, "Hand One", DAY, "2026-09-08T19:00:00.000Z");
    // A voided output never counts.
    output("o3", "run-done", "SHA", 999, "Hand One", DAY, "2026-09-08T19:30:00.000Z");
    m.run(`UPDATE wip_packages SET deleted_at = '2026-09-08T19:40:00.000Z' WHERE id = 'o3'`);
    // A line typed today for the day (its cryo date 2026-09-08), thirty-one minutes before the read:
    // on the day's list, on the run's outputs, and not among the recent (his thirty).
    output("o5", "run-done", "SHA", 10, "Hand One", DAY, "2026-09-15T15:29:00.000Z");
    // An open run holding 200 g not yet entered out, its one output entered today, ten minutes ago, with no date typed.
    sched("run-open", "scheduled", null);
    input("in-2", "run-open", 300);
    output("o4", "run-open", "SHA", 100, "Hand Two", null, "2026-09-15T15:50:00.000Z");
    // The shifts' values and the typed hours.
    m.run(`UPDATE app_config SET value = 'Hand One, Hand Two' WHERE key = 'pasteurization_shift_day_operators'`);
    m.run(`UPDATE app_config SET value = '07:00-19:00' WHERE key = 'pasteurization_shift_day_hours'`);
    m.run(
      `INSERT INTO pasteurization_labor_hours (id, work_date, shift, hours, created_at, updated_at) VALUES ('h-1', ?, 'day', 7.5, '2026-09-09T12:00:00.000Z', '2026-09-09T12:00:00.000Z')`,
      DAY
    );
    const loaded = await loadHarvestConsole(m.db, AT, DAY);
    expect(loaded.dayPicked).toBe(true);
    expect([...(loaded.pasteurization?.outputs ?? [])].sort((a, b) => a.weight_grams - b.weight_grams)).toEqual([
      { type_code: "SHA", weight_grams: 10, cryo_operator: "Hand One", created_at: "2026-09-15T15:29:00.000Z" },
      { type_code: "WPR", weight_grams: 300, cryo_operator: "Hand One", created_at: "2026-09-08T19:00:00.000Z" },
      { type_code: "BUD", weight_grams: 500, cryo_operator: "Hand One", created_at: "2026-09-08T18:00:00.000Z" },
    ]);
    expect(loaded.pasteurization?.finishedRuns).toEqual([
      { run_id: "run-done", in_grams: 1000, out_grams: 810, last_operator: "Hand One", completed_at: "2026-09-08T20:00:00.000Z" },
    ]);
    expect(loaded.pasteurization?.hours).toEqual({ day: 7.5, second: null });
    expect(loaded.pasteurization?.operators).toEqual({ day: ["Hand One", "Hand Two"], second: [] });
    expect(loaded.pasteurization?.shiftHours).toEqual({ day: "07:00-19:00", second: "18:00-06:00" });
    expect(loaded.pasteurization?.recent).toEqual([{ cryo_operator: "Hand Two", created_at: "2026-09-15T15:50:00.000Z" }]);
    expect(loaded.pasteurization?.typeCategories?.get("SMALLS")).toBe("WPR");
    expect(loaded.pasteurization?.nowIso).toBe(AT);
    expect(loaded.pasteurization?.startHour).toBe(6);
    expect(loaded.pasteurizationLive?.outputs).toEqual([{ type_code: "SHA", weight_grams: 100, cryo_operator: "Hand Two", created_at: "2026-09-15T15:50:00.000Z" }]);
    expect(loaded.pasteurizationLive?.finishedRuns).toEqual([]);
    expect(loaded.pasteurizationLive?.openRuns).toEqual([{ run_id: "run-open", in_grams: 300, out_grams: 100 }]);
    expect(loaded.pasteurizationLive?.hours).toEqual({ day: null, second: null });
    expect(loaded.lastCryoOutputAt).toBe("2026-09-15T15:50:00.000Z");
    expect(loaded.radRunning).toBeNull();
    const figures = pasteurizationFigures(loaded.pasteurization ?? emptyPasteurizationInput());
    expect(figures.shifts[0].budGrams).toBe(500);
    expect(figures.shifts[0].prepackGrams).toBe(300);
    expect(figures.shifts[0].shakeGrams).toBe(10);
    // 1000 in less 810 out: the fifth output drew the waste down.
    expect(figures.shifts[0].wasteGrams).toBe(190);
    expect(figures.shifts[0].totalGrams).toBe(1000);
    expect(figures.shifts[0].gramsPerDlh).toBeCloseTo(133.33, 1);
    expect(figures.shifts[0].running).toBe(true);
    const live = livePasteurization(loaded.pasteurizationLive ?? emptyPasteurizationInput());
    expect(live.uvGrams).toBe(100);
    expect(live.wasteGrams).toBe(0);
    expect(live.openRuns).toBe(1);
    expect(live.openGrams).toBe(200);
    expect(live.running).toBe(true);
    const html = harvestConsolePage({ input: loaded, live: [], nowIso: AT });
    expect(html).toContain('data-hc-cryo-open-grams="200">1 open run holds 0.45 lb not yet entered out</p>');
    expect(html).toContain('value="7.5" placeholder="hours" aria-label="Total Hours Day shift" data-hc-hours-input>');
    // A pick equal to today reads today's own outputs on the cards and the open run's line still.
    const today = await loadHarvestConsole(m.db, AT, "2026-09-15");
    expect(today.dayPicked).toBe(false);
    expect(today.pasteurization?.outputs).toEqual([{ type_code: "SHA", weight_grams: 100, cryo_operator: "Hand Two", created_at: "2026-09-15T15:50:00.000Z" }]);
    expect(today.pasteurization?.finishedRuns).toEqual([]);
  });
});
