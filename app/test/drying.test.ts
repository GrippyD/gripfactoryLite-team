import { describe, expect, it } from "vitest";
import {
  barnLotLabel,
  formatClock,
  loadSiloPage,
  siloClockSeconds,
  siloClockState,
  siloStrip,
} from "../src/drying";
import { resolveLoadedAt } from "../src/actions";
import { HttpError } from "../src/audit";
import { LOCATION_CHANGE_CSV_HEADER, locationChangeCsv, locationChangeFilename } from "../src/interco";
import { EDITABLE_FIELDS, OPS_GROUPS } from "../src/pipeline";
import type { BarnWetLotRow, SiloLoadRow } from "../src/db";
import { assembleSiloVisuals, LB_GRAMS, SILO_CAPACITY_WET_LBS_DEFAULT } from "../src/silo";
const CAP = SILO_CAPACITY_WET_LBS_DEFAULT * LB_GRAMS;

const NOW = "2026-09-08T12:00:00.000Z";
const SILOS = [
  { id: "s1", name: "Silo 1" },
  { id: "s2", name: "Silo 2" },
  { id: "s3", name: "Silo 3" },
  { id: "s4", name: "Silo 4" },
  { id: "s5", name: "Silo 5" },
];

function load(over: Partial<SiloLoadRow> = {}): SiloLoadRow {
  return {
    id: "L1",
    dry_space_id: "s2",
    silo_name: "Silo 2",
    wet_weight_entry_id: "lot1",
    hbn: "26251-ARL-GH-027-0-NA-26011",
    metrc_harvest_tag: "1A4060300003E5B000012345",
    strain_label: "Fruity Pebbles",
    farm_code: "ARL",
    weight_grams: 1500,
    loaded_at: "2026-09-08T10:00:00.000Z",
    started_at: "2026-09-08T10:00:00.000Z",
    paused_at: null,
    paused_seconds: 0,
    ended_at: null,
    notes: null,
    ...over,
  };
}

describe("the silo clock (owner rulings 2026-09-08, canon 0.30.6 and 0.30.9)", () => {
  // Canon 0.30.9, his words: "The "LOADED" time is when the clock should start".
  it("runs from the loaded time, banks pauses, freezes while paused, and never waits for Start", () => {
    expect(siloClockSeconds(load(), NOW)).toBe(7200);
    expect(siloClockSeconds(load({ paused_seconds: 600 }), NOW)).toBe(6600);
    expect(siloClockSeconds(load({ paused_at: "2026-09-08T11:00:00.000Z" }), NOW)).toBe(3600);
    // A load from before the law (no started_at) runs from its loaded time too.
    expect(siloClockSeconds(load({ started_at: null }), NOW)).toBe(7200);
    // A later Start press never moves the zero off the loaded time.
    expect(siloClockSeconds(load({ started_at: "2026-09-08T11:30:00.000Z" }), NOW)).toBe(7200);
    expect(siloClockState(load())).toBe("running");
    expect(siloClockState(load({ paused_at: NOW }))).toBe("paused");
    expect(siloClockState(load({ started_at: null }))).toBe("running");
    expect(siloClockState(load({ loaded_at: "garbage", started_at: null }))).toBe("not_started");
  });

  it("resolves the typed start time through the browser instant, refusing the future", () => {
    // Blank time: loads now. A typed time with no resolved instant (no script): now.
    expect(resolveLoadedAt(null, null, NOW)).toBe(NOW);
    expect(resolveLoadedAt("07:15", null, NOW)).toBe(NOW);
    // The browser's instant wins (07:15 on a UTC-4 day).
    expect(resolveLoadedAt("07:15", "2026-09-08T11:15:00.000Z", NOW)).toBe("2026-09-08T11:15:00.000Z");
    // Ten minutes of grace, then the future refuses in words.
    expect(resolveLoadedAt("12:05", "2026-09-08T12:05:00.000Z", NOW)).toBe("2026-09-08T12:05:00.000Z");
    expect(() => resolveLoadedAt("13:00", "2026-09-08T13:00:00.000Z", NOW)).toThrow(HttpError);
    expect(() => resolveLoadedAt("13:00", "not a date", NOW)).toThrow(HttpError);
    expect(() => resolveLoadedAt("13:00", "2026-09-01T13:00:00.000Z", NOW)).toThrow(HttpError);
  });

  it("formats days then hh:mm:ss", () => {
    expect(formatClock(0)).toBe("0d 00:00:00");
    expect(formatClock(7200)).toBe("0d 02:00:00");
    expect(formatClock(90061)).toBe("1d 01:01:01");
  });

  it("labels a barn lot last-6-of-tag / origin farm / market strain", () => {
    expect(
      barnLotLabel({ metrc_harvest_tag: "1A4060300003E5B000012345", package_code: "26011", farm_code: "ARL", strain_label: "Gelato" })
    ).toBe("012345 / ARL / Gelato");
    expect(barnLotLabel({ metrc_harvest_tag: null, package_code: "26011", farm_code: "PNN", strain_label: null })).toBe(
      "26011 / PNN / "
    );
  });
});

describe("the silo strip and the Load Silo page", () => {
  it("renders five cone-topped silos with live fills, an empty word, a running clock, a paused state, and the ticking script", () => {
    const loads = [load(), load({ id: "L2", dry_space_id: "s4", silo_name: "Silo 4", paused_at: NOW })];
    // THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69): Silo 1 is being
    // filled by the wet weight screen (a weighing lot at 2,000 g), Silo 2 dries
    // under a running clock, Silo 4 is paused, Silo 3 and 5 are empty.
    const live = assembleSiloVisuals(SILOS, loads, [{ dry_space_id: "s1", status: "weighing", weight_grams: 2000, lots: 1 }], CAP);
    const html = siloStrip(live, NOW);
    expect((html.match(/class="inv-gauge silo-gauge"/g) || []).length).toBe(5);
    expect((html.match(/<svg class="silo-shape"/g) || []).length).toBe(5);
    expect(html).toContain("data-silo-strip");
    expect(html).toContain('data-silo="s1" data-silo-state="filling"');
    expect(html).toContain('<div class="silo-state silo-state-filling" data-silo-label>filling</div>');
    expect(html).toContain('class="silo-fill silo-fill-green silo-throb"');
    expect(html).toContain('data-silo="s2" data-silo-state="drying"');
    expect(html).toContain('<div class="silo-state silo-state-drying" data-silo-label>drying</div>');
    expect(html).toContain('class="silo-fill silo-fill-red silo-throb"');
    expect(html).toContain('data-silo="s4" data-silo-state="paused"');
    expect(html).toContain('data-silo="s3" data-silo-state="empty"');
    expect(html).toContain('<div class="silo-state silo-state-empty" data-silo-label>empty</div>');
    // The wet weight at the bottom of every silo, pounds and grams.
    expect(html).toContain('Wet <strong data-silo-wet-lb>4.46</strong> lb · <strong data-silo-wet-g>2,000</strong> g');
    expect(html).toContain('Wet <strong data-silo-wet-lb>3.35</strong> lb · <strong data-silo-wet-g>1,500</strong> g');
    expect(html).toContain('Wet <strong data-silo-wet-lb>0.00</strong> lb · <strong data-silo-wet-g>0</strong> g');
    expect(html).toContain('data-state="running"');
    expect(html).toContain('data-state="paused"');
    expect(html).toContain("0d 02:00:00");
    expect(html).toContain("setInterval(beat, 1000)");
    expect(html).toContain("time[data-local]:not([data-local-done])");
    expect(html).toContain('fetch("/silos/live.json"');
    // THE STRAIN ON THE LOT LINE (canon 0.30.183): the loaded lot's strain under its number, before its clock.
    const idAt = html.indexOf('data-load="L1"');
    const strainAt = html.indexOf('<div class="inv-lot-strain muted" data-lot-strain>Fruity Pebbles</div>', idAt);
    const clockAt = html.indexOf('<div class="inv-lot-time">', idAt);
    expect(strainAt).toBeGreaterThan(idAt);
    expect(clockAt).toBeGreaterThan(strainAt);
    expect(siloStrip(assembleSiloVisuals(SILOS, [load({ strain_label: null })], [], CAP), NOW)).not.toContain("data-lot-strain");
  });

  it("the page lists barn lots, opens the wet lot entry with the load form on a pick, and shows Start greyed once started", () => {
    const lot: BarnWetLotRow = {
      id: "lot1",
      status: "drying",
      barn_location: "BARN",
      hbn: "26251-ARL-GH-027-0-NA-26011",
      metrc_harvest_tag: "1A4060300003E5B000012345",
      farm_code: "ARL",
      strain_label: "Fruity Pebbles",
      entry_date: "2026-09-08",
      weight_grams: 1500,
      material_form: "bucked",
      actual_dryspc: "s2",
      planned_space_name: "Silo 2",
      planned_space_kind: "silo",
      package_code: "26011",
      item_id: "i1",
      lead_name: "Maria",
      supervisor_name: "dev@local",
      notes: null,
      plant_count: null,
    };
    const list = loadSiloPage({ barnLots: [lot], silos: SILOS, loads: [], picked: null, pickedLoad: null, nowIso: NOW });
    expect(list).toContain("Scheduled lots");
    expect(list).toContain("012345 / ARL / Fruity Pebbles");
    expect(list).toContain("Pick a lot from the pane.");
    const picked = loadSiloPage({ barnLots: [lot], silos: SILOS, loads: [], picked: lot, pickedLoad: null, nowIso: NOW });
    expect(picked).toContain('action="/station/load_silo/load"');
    expect(picked).toContain('<option value="s2" selected>Silo 2</option>');
    // Canon 0.30.9: the HH:MM colon mask rides the Start time, the browser
    // resolves the loaded instant into loaded_at_iso, and the form says the
    // clock runs from it.
    expect(picked).toMatch(/name="start_time"[^>]*data-time24-mask/);
    expect(picked).toContain('name="loaded_at_iso"');
    expect(picked).toContain("data-time24-mask]");
    expect(picked).toContain("form[data-load-silo]");
    expect(picked).toContain("The clock runs from this loaded time.");
    // THE EFFECTIVE DATE (canon 0.30.92): the collapsed field under the Start
    // time, reading today (the farm's day of NOW), with the Admin PIN box; the
    // resolver puts the typed time on the picked day.
    expect(picked).toContain('<details class="effective-date" data-effective-date>');
    expect(picked).toContain("Effective Date: <span data-effective-summary>2026-09-08</span>");
    expect(picked).toMatch(/name="effective_date" value="2026-09-08" max="2026-09-08"/);
    expect(picked).toContain('name="effective_pin"');
    expect(picked).toContain("Here the Start time falls on that day and is required with it.");
    expect(picked).toContain("[name=effective_date]");
    expect(picked.indexOf("data-effective-date")).toBeGreaterThan(picked.indexOf('name="start_time"'));
    expect(picked.indexOf("data-effective-date")).toBeLessThan(picked.indexOf(">Load silo</button>"));
    expect(picked).toContain("Bucked");
    // THE PLANT COUNT (owner ruling 2026-09-14, canon 0.30.62): a lot that
    // skipped the count at Finish lot is asked again on the load form; a lot
    // that carries one shows it and is not asked.
    expect(picked).toContain("data-plant-prompt");
    expect(picked).toMatch(/name="plant_count"[^>]*data-plant-count-input/);
    expect(picked).toContain("Leave it blank to skip again");
    expect(picked).not.toContain("data-plant-count>");
    const counted = loadSiloPage({ barnLots: [{ ...lot, plant_count: 120 }], silos: SILOS, loads: [], picked: { ...lot, plant_count: 120 }, pickedLoad: null, nowIso: NOW });
    expect(counted).not.toContain("data-plant-prompt");
    expect(counted).toContain("<dt>Plants</dt><dd data-plant-count>120</dd>");
    const started = loadSiloPage({ barnLots: [], silos: SILOS, loads: [load()], picked: null, pickedLoad: load(), nowIso: NOW });
    expect(started).toContain('action="/station/load_silo/L1/start"');
    expect(started).toMatch(/<button type="submit" disabled[^>]*>Start<\/button>/);
    expect(started).toContain(">Pause</button>");
    expect(started).toContain('href="/record/silo_loads/L1/edit"');
    // The loaded time shows as the clock's zero, rendered local by the script.
    expect(started).toContain('<time datetime="2026-09-08T10:00:00.000Z" data-local>');
    expect(started).toContain("the clock's zero");
    expect(started).not.toContain("Not started");
    const paused = loadSiloPage({ barnLots: [], silos: SILOS, loads: [], picked: null, pickedLoad: load({ paused_at: NOW }), nowIso: NOW });
    expect(paused).toContain(">Resume</button>");
    // A load from before the law is running from its loaded time: Start greyed too.
    const legacy = loadSiloPage({ barnLots: [], silos: SILOS, loads: [], picked: null, pickedLoad: load({ started_at: null }), nowIso: NOW });
    expect(legacy).toMatch(/<button type="submit" disabled[^>]*>Start<\/button>/);
    expect(legacy).toContain('data-state="running"');
    const empty = loadSiloPage({ barnLots: [], silos: SILOS, loads: [], picked: null, pickedLoad: null, nowIso: NOW });
    expect(empty).toContain("- EMPTY -");
  });

  it("occupied silos refuse more product: greyed in the select with their occupant, all-full waits (canon 0.30.19)", () => {
    const lot: BarnWetLotRow = {
      id: "lot9",
      status: "drying",
      barn_location: "BARN",
      hbn: "26251-PNN-GH-027-0-NA-26012",
      metrc_harvest_tag: "1A4060300003E5B000012399",
      farm_code: "PNN",
      strain_label: "Fruity Pebbles",
      entry_date: "2026-09-08",
      weight_grams: 900,
      material_form: "bucked",
      actual_dryspc: "s2",
      planned_space_name: "Silo 2",
      planned_space_kind: "silo",
      package_code: "26012",
      item_id: "i9",
      lead_name: "Maria",
      supervisor_name: "dev@local",
      notes: null,
      plant_count: null,
    };
    // Silo 2 (the planned one) is occupied by L1: greyed with its occupant, no preselect.
    const one = loadSiloPage({ barnLots: [lot], silos: SILOS, loads: [load()], picked: lot, pickedLoad: null, nowIso: NOW });
    expect(one).toContain('<option value="s2" disabled data-occupied>Silo 2 (occupied: 26011)</option>');
    expect(one).not.toContain('value="s2" selected');
    expect(one).toContain('<option value="s1">Silo 1</option>');
    expect(one).not.toContain("data-silos-full");
    expect(one).toMatch(/<button type="submit">Load silo<\/button>/);
    // An ended load frees its silo.
    const freed = loadSiloPage({ barnLots: [lot], silos: SILOS, loads: [load({ ended_at: NOW })], picked: lot, pickedLoad: null, nowIso: NOW });
    expect(freed).toContain('<option value="s2" selected>Silo 2</option>');
    // Every silo full: every option greyed, the banner, the button waits.
    const full = SILOS.map((s, i) => load({ id: `L${i + 1}`, dry_space_id: s.id, silo_name: s.name }));
    const none = loadSiloPage({ barnLots: [lot], silos: SILOS, loads: full, picked: lot, pickedLoad: null, nowIso: NOW });
    expect((none.match(/data-occupied/g) || []).length).toBe(5);
    expect(none).toContain("data-silos-full");
    expect(none).toContain("Every silo is occupied. Unload one first.");
    expect(none).toMatch(/<button type="submit" disabled>Load silo<\/button>/);
  });

  it("the location change CSV: provisional METRC shape, silo as the destination", () => {
    expect(LOCATION_CHANGE_CSV_HEADER).toBe("Label,Location,Sublocation,MoveDate");
    expect(locationChangeCsv([{ label: "26011", location: "Silo 2", moveDate: "2026-09-08" }])).toBe(
      "Label,Location,Sublocation,MoveDate\r\n26011,Silo 2,,2026-09-08\r\n"
    );
    expect(locationChangeFilename("26251-ARL-GH-027-0-NA-26011", "Silo 2", "20260908")).toBe(
      "location_change_26251-ARL-GH-027-0-NA-26011(1)_Silo_2_20260908.csv"
    );
  });

  it("Drying Operations carries Load Silo first, and silo_loads take the reasoned pencil", () => {
    const drying = OPS_GROUPS.find((g) => g.key === "drying_ops")!;
    expect(drying.members[0]).toMatchObject({ key: "load_silo", href: "/station/load_silo" });
    // Canon 0.30.9: the pencil edits the loaded time, the clock's zero.
    expect(EDITABLE_FIELDS.silo_loads.map((f) => f.name)).toEqual(["loaded_at", "notes"]);
  });
});
