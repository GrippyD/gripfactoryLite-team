import { describe, expect, it } from "vitest";
import {
  assembleSiloVisuals,
  dryingTotals,
  dryingTotalsMarkup,
  emptyClockLine,
  emptyOrigin,
  lotStrainLine,
  siloWaitingLines,
  BOX_GEOMETRY,
  PROJECTED_DRY_YIELD_PCT_DEFAULT,
  siloUnloadLine,
  unloadingLevel,
  boxSkewDegrees,
  boxTopPoints,
  CUBE_GEOMETRY,
  LB_GRAMS,
  siloCapacityGrams,
  siloClockOf,
  siloFillBox,
  siloLiveEntry,
  siloLiveScript,
  siloShapeOf,
  siloSvg,
  siloTile,
  siloVisual,
  SILO_CAPACITY_WET_LBS_DEFAULT,
  SILO_LIVE_PATH,
} from "../src/silo";
import type { SiloLoadRow } from "../src/db";
import { listSiloEmptySince } from "../src/db";
import { loadSiloVisuals } from "../src/silo";
import { themeStylesheet } from "../src/theme";
import { migratedDb } from "./migrated";

const CAP = SILO_CAPACITY_WET_LBS_DEFAULT * LB_GRAMS;
const base = { fillingGrams: 0, fillingLots: 0, awaitingGrams: 0, loadedGrams: 0, clock: null, capacityGrams: CAP } as const;

function load(over: Partial<SiloLoadRow> = {}): SiloLoadRow {
  return {
    id: "L1",
    dry_space_id: "s2",
    silo_name: "Silo 2",
    wet_weight_entry_id: "lot1",
    hbn: "26257-ARL-GH-027-0-NA-26010",
    metrc_harvest_tag: "1A4060300003E5B000012345",
    strain_label: "Fruity Pebbles",
    farm_code: "ARL",
    weight_grams: 3360000,
    loaded_at: "2026-09-14T10:00:00.000Z",
    started_at: null,
    paused_at: null,
    paused_seconds: 0,
    ended_at: null,
    notes: null,
    ...over,
  };
}

describe("THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69)", () => {
  it("scales every silo against 15,000 lbs wet unless Admin says otherwise", () => {
    expect(SILO_CAPACITY_WET_LBS_DEFAULT).toBe(15000);
    expect(siloCapacityGrams(null)).toBe(6720000);
    expect(siloCapacityGrams("")).toBe(6720000);
    expect(siloCapacityGrams("garbage")).toBe(6720000);
    expect(siloCapacityGrams("10,000")).toBe(4480000);
    expect(siloCapacityGrams("-5")).toBe(6720000);
  });

  it("reads the law: the clock wins, then filling, then a finished lot waiting, else empty", () => {
    expect(siloVisual({ ...base })).toEqual({ state: "empty", label: "empty", freezer: false, wetGrams: 0, level: 0, throb: null, fill: null, unloadedDryGrams: 0, unloadedShare: 0, expectedDryGrams: 0 });
    const filling = siloVisual({ ...base, fillingGrams: 3360000, fillingLots: 1 });
    expect(filling).toMatchObject({ state: "filling", label: "filling", wetGrams: 3360000, throb: "green", fill: "green" });
    expect(filling.level).toBeCloseTo(0.5, 4);
    // A lot that just started filling has no grams yet: still filling, level 0.
    expect(siloVisual({ ...base, fillingLots: 1 })).toMatchObject({ state: "filling", level: 0, throb: "green" });
    // THE LOADING SILO (canon 0.30.81): the barn-waiting state is his word, loading.
    expect(siloVisual({ ...base, awaitingGrams: 1000 })).toMatchObject({ state: "loading", label: "loading", wetGrams: 1000, throb: null, fill: "green" });
    expect(siloVisual({ ...base, awaitingLots: 1 })).toMatchObject({ state: "loading", level: 0 });
    const drying = siloVisual({ ...base, loadedGrams: 6720000 * 1.2, clock: "running", fillingGrams: 5, fillingLots: 1 });
    expect(drying).toMatchObject({ state: "drying", label: "drying", throb: "red", fill: "red", level: 1 });
    expect(siloVisual({ ...base, loadedGrams: 100, clock: "paused" })).toMatchObject({ state: "paused", label: "paused", throb: null, fill: "red" });
    expect(siloVisual({ ...base, loadedGrams: 100, clock: "not_started" })).toMatchObject({ state: "loaded", label: "loaded", throb: null, fill: "red" });
    // A capacity of zero never divides.
    expect(siloVisual({ ...base, fillingGrams: 10, fillingLots: 1, capacityGrams: 0 }).level).toBe(0);
  });

  it("draws the cone-topped cylinder twice as wide as tall-ish (canon 0.30.71): the fill clipped to the body, rising from the bottom", () => {
    const half = siloSvg(siloVisual({ ...base, fillingGrams: CAP / 2, fillingLots: 1 }), "s1");
    expect(half).toContain('<svg class="silo-shape" data-silo-shape data-silo-state="filling" viewBox="0 0 200 150"');
    expect(half).toContain('aria-label="filling, 50%"');
    expect(half).toContain('<clipPath id="silo-clip-s1"><path d="M40 42 H160 V134 A60 8 0 0 1 40 134 Z"/></clipPath>');
    // THE WIDE SILO (owner: "make the silos and their contents twice as wide
    // without changing their height"): every x doubled from the 0.30.69 box
    // (20..80 in 100 became 40..160 in 200), every y the same, the fill with it.
    expect(half).toContain('<rect class="silo-fill silo-fill-green silo-throb" data-silo-fill x="40" y="88" width="120" height="46"/>');
    // The roof, the rim, the body: three wire strokes, no circle anywhere.
    expect(half).toContain('<path class="silo-wire" d="M40 42 L100 8 L160 42"/>');
    expect(half).toContain('<ellipse class="silo-wire" cx="100" cy="42" rx="60" ry="8"/>');
    expect(half).toContain('<path class="silo-wire" d="M40 42 V134 A60 8 0 0 0 160 134 V42"/>');
    expect(half).not.toContain("<circle");
    expect(siloFillBox(0)).toEqual({ y: 134, height: 0 });
    expect(siloFillBox(1)).toEqual({ y: 42, height: 92 });
    const empty = siloSvg(siloVisual({ ...base }), "silo 3!");
    expect(empty).toContain('<clipPath id="silo-clip-silo3">');
    expect(empty).toContain('<rect class="silo-fill" data-silo-fill x="40" y="134" width="120" height="0"/>');
  });

  it("wraps the shape as a tile: name, shape, state word, the caller's body, the wet weight at the bottom", () => {
    const html = siloTile({ id: "s2", name: "Silo 2", visual: siloVisual({ ...base, loadedGrams: 3360000, clock: "running" }), body: '<div class="inv-lot">x</div>' });
    expect(html).toContain('<div class="inv-gauge silo-gauge" data-silo="s2" data-silo-state="drying" data-silo-shape-kind="cylinder">');
    expect(html.indexOf('<div class="inv-gauge-name">Silo 2</div>')).toBeLessThan(html.indexOf('<svg class="silo-shape"'));
    expect(html.indexOf('<svg class="silo-shape"')).toBeLessThan(html.indexOf('data-silo-label>drying</div>'));
    expect(html.indexOf('data-silo-label>drying</div>')).toBeLessThan(html.indexOf('<div class="inv-lot">x</div>'));
    expect(html.indexOf('<div class="inv-lot">x</div>')).toBeLessThan(html.indexOf('data-silo-wet>'));
    expect(html).toContain('Wet <strong data-silo-wet-lb>7,500.00</strong> lb · <strong data-silo-wet-g>3,360,000</strong> g');
    expect(html).not.toContain("3360000");
    expect(html).toContain("silo-fill silo-fill-red silo-throb");
  });

  it("assembles the visuals per silo from loads and lot grams, a running clock beating a paused one", () => {
    const silos = [{ id: "s1", name: "Silo 1" }, { id: "s2", name: "Silo 2" }, { id: "s3", name: "Silo 3" }];
    const loads = [load(), load({ id: "L2", dry_space_id: "s2", paused_at: "2026-09-14T11:00:00.000Z", weight_grams: 100 })];
    const live = assembleSiloVisuals(
      silos,
      loads,
      [
        { dry_space_id: "s1", status: "weighing", weight_grams: 1234.56, lots: 1 },
        { dry_space_id: "s3", status: "drying", weight_grams: 999, lots: 1 },
      ],
      CAP
    );
    expect(live.map((l) => l.visual.state)).toEqual(["filling", "drying", "loading"]);
    expect(live[0].visual.wetGrams).toBe(1234.56);
    expect(live[1].visual.wetGrams).toBe(3360100);
    expect(live[1].loads.map((l) => l.id)).toEqual(["L1", "L2"]);
    expect(live[2].visual).toMatchObject({ state: "loading", wetGrams: 999, fill: "green", throb: null });
    expect(siloClockOf(load())).toBe("running");
    expect(siloClockOf(load({ paused_at: "2026-09-14T11:00:00.000Z" }))).toBe("paused");
    expect(siloClockOf(load({ loaded_at: "", started_at: null }))).toBe("not_started");
  });

  it("answers the live endpoint with everything a tile repaints from", () => {
    expect(SILO_LIVE_PATH).toBe("/silos/live.json");
    const entry = siloLiveEntry("s1", "Silo 1", siloVisual({ ...base, fillingGrams: 2000, fillingLots: 1 }), "en");
    expect(entry).toEqual({
      id: "s1",
      name: "Silo 1",
      state: "filling",
      label: "filling",
      wetGrams: 2000,
      wetLb: "4.46",
      wetG: "2,000",
      level: 2000 / CAP,
      fill: "green",
      throb: "green",
      shape: "cylinder",
      unloadedDryGrams: 0,
      unloadLb: "0.00",
      unloadPct: 0,
      // THE DRY SPACE TYPE (canon 0.30.106): the fill's classes, the fullness word and the type ride along.
      fillClass: "silo-fill silo-fill-green silo-throb",
      pctLabel: "0% full",
      spaceType: "silo",
      flags: [],
      emptySince: null,
      checks: [],
    });
    const es = siloLiveEntry("s2", "Silo 2", siloVisual({ ...base, loadedGrams: 10, clock: "running" }), "es");
    expect(es.label).toBe("secando");
  });
});

describe("THE HARVEST CONSOLE (canon 0.30.73): the wire box and the FFZ cube", () => {
  it("a silo's shape is data: box for the Arlington Dry Room, the cylinder for anything else", () => {
    expect(siloShapeOf("box")).toBe("box");
    expect(siloShapeOf("cylinder")).toBe("cylinder");
    expect(siloShapeOf(null)).toBe("cylinder");
    expect(siloShapeOf(undefined)).toBe("cylinder");
    expect(siloShapeOf("sphere")).toBe("cylinder");
  });

  it("keeps the box proportional to the silos: the same 200 by 150 frame and the same body height, 42 to 134", () => {
    expect(BOX_GEOMETRY).toEqual({ width: 200, height: 150, left: 34, right: 146, top: 42, bottom: 134, dx: 32, dy: 18 });
    expect(CUBE_GEOMETRY).toEqual({ width: 200, height: 150, left: 46, right: 138, top: 42, bottom: 134, dx: 32, dy: 18 });
    // The cube's front face is square: 92 wide, 92 tall, the silo body's height.
    expect(CUBE_GEOMETRY.right - CUBE_GEOMETRY.left).toBe(CUBE_GEOMETRY.bottom - CUBE_GEOMETRY.top);
    // The skew lays the side face's rectangle onto the depth: y falls 18 across 32.
    expect(boxSkewDegrees(BOX_GEOMETRY)).toBe(29.3578);
    expect(Math.tan((boxSkewDegrees(BOX_GEOMETRY) * Math.PI) / 180)).toBeCloseTo(18 / 32, 4);
    expect(boxTopPoints(BOX_GEOMETRY, 88)).toBe("34,88 146,88 178,70 66,70");
  });

  it("draws the Arlington Dry Room as a 3D wire box with the silo fill law: front, side and top faces, back edges dashed", () => {
    const half = siloSvg(siloVisual({ ...base, fillingGrams: CAP / 2, fillingLots: 1 }), "room", "en", "box");
    expect(half).toContain('<svg class="silo-shape silo-shape-box" data-silo-shape data-silo-state="filling" viewBox="0 0 200 150"');
    expect(half).toContain('aria-label="filling, 50%"');
    // The front face fills from the bottom by the level, exactly as the cylinder does (y 88, height 46 at half).
    expect(half).toContain('<rect class="silo-fill silo-fill-green silo-throb" data-silo-fill x="34" y="88" width="112" height="46"/>');
    // The side face is the same rectangle skewed onto the depth.
    expect(half).toContain('<g transform="translate(146 0) skewY(-29.3578)"><rect class="silo-fill silo-fill-green silo-throb silo-fill-side" data-silo-fill-side x="0" y="88" width="32" height="46"/></g>');
    // The liquid's top face rides the fill line into the depth; data-box lets the live script move it.
    expect(half).toContain('<polygon class="silo-fill silo-fill-green silo-throb silo-fill-top" data-silo-fill-top data-box="34 146 32 18" points="34,88 146,88 178,70 66,70"/>');
    // The wire: front face, top face, right face, and the hidden back edges dashed.
    expect(half).toContain('<path class="silo-wire" d="M34 42 H146 V134 H34 Z"/>');
    expect(half).toContain('<path class="silo-wire" d="M34 42 L66 24 H178 L146 42"/>');
    expect(half).toContain('<path class="silo-wire" d="M178 24 V116 L146 134"/>');
    expect(half).toContain('<path class="silo-wire silo-wire-hidden" d="M66 24 V116 H178 M34 134 L66 116"/>');
    expect(half).not.toContain("<ellipse");
    expect(half).not.toContain("clipPath");
    // Drying reads red and throbbing in the box as in the cylinder.
    const drying = siloSvg(siloVisual({ ...base, loadedGrams: CAP, clock: "running" }), "room", "en", "box");
    expect(drying).toContain('data-silo-fill x="34" y="42" width="112" height="92"');
    expect(drying).toContain("silo-fill silo-fill-red silo-throb");
    // The tile names its shape, and the default stays the cylinder.
    const tile = siloTile({ id: "room", name: "Arlington Dry Room", visual: siloVisual(base), body: "", shape: "box" });
    expect(tile).toContain('data-silo="room" data-silo-state="empty" data-silo-shape-kind="box"');
    expect(tile).toContain('class="silo-shape silo-shape-box"');
    expect(siloTile({ id: "s1", name: "Silo 1", visual: siloVisual(base), body: "" })).toContain('data-silo-shape-kind="cylinder"');
    expect(siloLiveEntry("room", "Arlington Dry Room", siloVisual(base), "en", "box").shape).toBe("box");
  });

  it("the live script repaints the side and top faces along with the front fill", () => {
    const script = siloLiveScript();
    expect(script).toContain('[data-silo-fill-side]');
    expect(script).toContain('[data-silo-fill-top]');
    expect(script).toContain('getAttribute("data-box")');
    expect(script).not.toContain("paintFfz");
    expect(script).not.toContain("data.ffz");
  });
});

describe("THE UNLOADING SILO (canon 0.30.77): dry weights out read unloading, throb blue, the fill falls", () => {
  const loaded = { ...base, loadedGrams: 1132, clock: "running" as const };

  it("owner, verbatim: 'All silos: if there is weight in the lot's unload dry space fields, \"unloading\", throb blue, show cap changes'", () => {
    expect(PROJECTED_DRY_YIELD_PCT_DEFAULT).toBe(22);
    // 1,132 g wet at 22% expects 249.04 g dry; 50 g out is 20% of it, so the fill falls to 80% of the loaded level.
    const u = unloadingLevel(1132, 50, 22, CAP);
    expect(u.expectedDryGrams).toBe(249.04);
    expect(u.share).toBeCloseTo(50 / 249.04, 9);
    expect(u.level).toBeCloseTo((1132 * (1 - 50 / 249.04)) / CAP, 12);
    const v = siloVisual({ ...loaded, unloadedDryGrams: 50 });
    expect(v).toMatchObject({ state: "unloading", label: "unloading", wetGrams: 1132, throb: "blue", fill: "blue", unloadedDryGrams: 50, expectedDryGrams: 249.04 });
    expect(v.unloadedShare).toBeCloseTo(50 / 249.04, 9);
    expect(v.level).toBeCloseTo((1132 / CAP) * (1 - 50 / 249.04), 12);
    expect(v.level).toBeLessThan(siloVisual(loaded).level);
    // Unloading wins over the clock's state, paused or not started alike.
    expect(siloVisual({ ...loaded, clock: "paused", unloadedDryGrams: 1 }).state).toBe("unloading");
    expect(siloVisual({ ...loaded, clock: "not_started", unloadedDryGrams: 1 }).state).toBe("unloading");
    // No dry out yet: drying as before, the unload numbers zero.
    const drying = siloVisual({ ...loaded, unloadedDryGrams: 0 });
    expect(drying).toMatchObject({ state: "drying", throb: "red", fill: "red", unloadedDryGrams: 0, unloadedShare: 0, expectedDryGrams: 0 });
    // All the expected dry out (or more): the fill is empty but the silo still reads unloading until Finish unload ends the load.
    const allOut = siloVisual({ ...loaded, unloadedDryGrams: 300 });
    expect(allOut.state).toBe("unloading");
    expect(allOut.unloadedShare).toBe(1);
    expect(allOut.level).toBe(0);
    // A different yield in data scales the fall (44% expects 498.08 g; 50 g is about 10%).
    expect(siloVisual({ ...loaded, unloadedDryGrams: 50, dryYieldPct: 44 }).unloadedShare).toBeCloseTo(50 / 498.08, 9);
    // A zero yield cannot divide: any dry out reads all out.
    expect(siloVisual({ ...loaded, unloadedDryGrams: 5, dryYieldPct: 0 }).unloadedShare).toBe(1);
    // Without a load there is no unloading, whatever the number says.
    expect(siloVisual({ ...base, fillingGrams: 10, fillingLots: 1, unloadedDryGrams: 50 }).state).toBe("filling");
  });

  it("draws it: blue throbbing fill, the word unloading, the cap change line, in the cylinder and the box", () => {
    const v = siloVisual({ ...loaded, unloadedDryGrams: 50 });
    expect(siloSvg(v, "s4")).toContain('class="silo-fill silo-fill-blue silo-throb"');
    expect(siloSvg(v, "s4")).toContain('data-silo-state="unloading"');
    expect(siloSvg(v, "room", "en", "box")).toContain('class="silo-fill silo-fill-blue silo-throb" data-silo-fill');
    expect(siloUnloadLine(v)).toBe('<div class="silo-unload" data-silo-unload>Dry out <strong data-silo-unload-lb>0.11</strong> lb · <strong data-silo-unload-pct>20%</strong> of expected</div>');
    // Outside unloading the line is kept hidden for the live repaint.
    expect(siloUnloadLine(siloVisual(loaded))).toBe('<div class="silo-unload" hidden data-silo-unload>Dry out <strong data-silo-unload-lb>0.00</strong> lb · <strong data-silo-unload-pct>0%</strong> of expected</div>');
    const tile = siloTile({ id: "s4", name: "Silo 4", visual: v, body: "" });
    expect(tile).toContain('data-silo="s4" data-silo-state="unloading"');
    expect(tile).toContain('<div class="silo-state silo-state-unloading" data-silo-label>unloading</div>');
    expect(tile.indexOf("data-silo-label")).toBeLessThan(tile.indexOf("data-silo-unload"));
    expect(tile).toContain("Wet <strong data-silo-wet-lb>2.53</strong> lb");
    expect(siloTile({ id: "s4", name: "Silo 4", visual: v, body: "", locale: "es" })).toContain(">descargando</div>");
    expect(siloTile({ id: "s4", name: "Silo 4", visual: v, body: "", locale: "es" })).toContain("Seco fuera <strong");
    // The live entry and the script carry the dry out.
    const entry = siloLiveEntry("s4", "Silo 4", v);
    expect(entry).toMatchObject({ state: "unloading", fill: "blue", throb: "blue", unloadedDryGrams: 50, unloadLb: "0.11", unloadPct: 20 });
    const script = siloLiveScript();
    expect(script).toContain('if (entry.fill === "blue") cls += " silo-fill-blue"');
    expect(script).toContain('unload.hidden = entry.state !== "unloading"');
    expect(script).toContain("[data-silo-unload-lb]");
    expect(script).toContain("[data-silo-unload-pct]");
  });

  it("assembles it from the loads' dry grams and the yield in data", () => {
    const silos = [{ id: "s4", name: "Silo 4", shape: "cylinder", farm_code: "PNN" }];
    const loadRow = { ...load({ dry_space_id: "s4", silo_name: "Silo 4", weight_grams: 1132, dry_weight_grams: 50 }) };
    const [live] = assembleSiloVisuals(silos, [loadRow], [], CAP, 22);
    expect(live.visual.state).toBe("unloading");
    expect(live.visual.unloadedDryGrams).toBe(50);
    expect(live.visual.expectedDryGrams).toBe(249.04);
    const [live44] = assembleSiloVisuals(silos, [loadRow], [], CAP, 44);
    expect(live44.visual.expectedDryGrams).toBe(498.08);
    const [dryingLive] = assembleSiloVisuals(silos, [{ ...loadRow, dry_weight_grams: null }], [], CAP);
    expect(dryingLive.visual.state).toBe("drying");
  });
});

describe("THE BLUE THROB (canon 0.30.79; owner: \"looks good, but there's no blue throb\")", () => {
  it("every theme pulses an unloading silo's wire blue with its fill, and a reduced-motion setting slows the throb instead of stilling it", () => {
    for (const view of ["lite", "co", "cerberus"] as const) {
      const css = themeStylesheet(view);
      expect(css).toContain('.silo-shape[data-silo-state="unloading"] .silo-wire {');
      expect(css).toContain("animation: silo-wire-throb 1.6s ease-in-out infinite");
      expect(css).toContain("@keyframes silo-wire-throb { 0%, 100% { stroke-opacity: 0.35; } 50% { stroke-opacity: 1; } }");
      expect(css).toContain(".silo-fill-blue { fill: #");
      expect(css).toContain(".silo-throb { animation: silo-throb 1.6s ease-in-out infinite; }");
      expect(css).toContain("@media (prefers-reduced-motion: reduce) { .silo-throb { animation-duration: 3.2s; } }");
      expect(css).toContain("@media (prefers-reduced-motion: reduce) { .ffz-throb { animation-duration: 8.4s; } }");
      expect(css).not.toContain(".silo-throb { animation: none");
      expect(css).not.toContain(".ffz-throb { animation: none");
    }
  });
});

describe("THE LOADING SILO (canon 0.30.81): received satellite material in the PNN barn reads loading in its assigned silo", () => {
  const silos = [
    { id: "s3", name: "Silo 3", shape: "cylinder", farm_code: "PNN" },
    { id: "s4", name: "Silo 4", shape: "cylinder", farm_code: "PNN" },
  ];
  it("owner, verbatim: 'when a satellite farm's material is received at PNN and it's in the barn with a wet weight, it should be set as \"loading\" in the correctly assigned silo'", () => {
    // The PNS lot rode a truck (its space the sentinel), the HBN planned Silo 3; the loader attributes it there as a drying, unloaded row.
    const rows = [{ dry_space_id: "s3", status: "drying", weight_grams: 777.25, lots: 1, lot_id: "lotPNS", hbn: "26258-PNS-OD-051-0-03-26014", metrc_harvest_tag: null, planned: 1 }];
    const [silo3, silo4] = assembleSiloVisuals(silos, [], rows, CAP);
    expect(silo3.visual).toMatchObject({ state: "loading", label: "loading", wetGrams: 777.25, fill: "green", throb: null });
    expect(silo3.visual.level).toBeCloseTo(777.25 / CAP, 12);
    expect(silo3.waiting).toEqual([{ lot_id: "lotPNS", hbn: "26258-PNS-OD-051-0-03-26014", metrc_harvest_tag: null, weight_grams: 777.25, planned: true }]);
    expect(silo4.visual.state).toBe("empty");
    expect(silo4.waiting).toEqual([]);
    // A PNN lot finished into Silo 4 itself waits the same way, its own space (planned 0).
    const own = [{ dry_space_id: "s4", status: "drying", weight_grams: 1132, lots: 1, lot_id: "lot1132", hbn: "26260-PNN-GH-027-0-NA-26016", metrc_harvest_tag: null, planned: 0 }];
    const [, own4] = assembleSiloVisuals(silos, [], own, CAP);
    expect(own4.visual.state).toBe("loading");
    expect(own4.waiting[0]).toMatchObject({ lot_id: "lot1132", planned: false });
    // A load (the clock) still wins over a lot waiting for the same silo.
    const [loaded3] = assembleSiloVisuals(silos, [load({ dry_space_id: "s3" })], rows, CAP);
    expect(loaded3.visual.state).toBe("drying");
    expect(loaded3.waiting).toHaveLength(1);
  });
  it("names the waiting lots on the tile, each a link to Load Silo with the lot picked", () => {
    const lines = siloWaitingLines([
      { lot_id: "lotPNS", hbn: "26258-PNS-OD-051-0-03-26014", metrc_harvest_tag: null, weight_grams: 777.25, planned: true },
      { lot_id: "lot1132", hbn: "26260-PNN-GH-027-0-NA-26016", metrc_harvest_tag: null, weight_grams: 1132, planned: false },
    ]);
    expect(lines).toContain('<div class="inv-lot silo-waiting" data-waiting="lotPNS">');
    expect(lines).toContain('<a href="/station/load_silo?pick=lotPNS">Lot 26014</a>');
    expect(lines).toContain('<div class="inv-lot-time muted">waiting to load, planned here</div>');
    expect(lines).toContain('<a href="/station/load_silo?pick=lot1132">Lot 26016</a>');
    expect(lines).toContain('<div class="inv-lot-time muted">waiting to load</div>');
    expect(lines).not.toContain("in the barn");
    expect(siloWaitingLines([])).toBe("");
    expect(siloWaitingLines([{ lot_id: "l", hbn: "26258-PNS-OD-051-0-03-26014", metrc_harvest_tag: null, weight_grams: 1, planned: true }], "es")).toContain("esperando carga, planificado aqui");
    const tile = siloTile({ id: "s3", name: "Silo 3", visual: siloVisual({ ...base, awaitingGrams: 777.25 }), body: siloWaitingLines([{ lot_id: "lotPNS", hbn: "26258-PNS-OD-051-0-03-26014", metrc_harvest_tag: null, weight_grams: 777.25, planned: true }]) });
    expect(tile).toContain('<div class="silo-state silo-state-loading" data-silo-label>loading</div>');
    expect(tile.indexOf("data-silo-label")).toBeLessThan(tile.indexOf('data-waiting="lotPNS"'));
  });
});

describe("THE DRYING TOTALS AND THE STRAIN ON THE LOT LINE (canon 0.30.183)", () => {
  const spaces = [
    { id: "s1", name: "Silo 1", shape: "cylinder", farm_code: "PNN" },
    { id: "s2", name: "Silo 2", shape: "cylinder", farm_code: "PNN" },
    { id: "room", name: "Arlington Dry Room", shape: "box", farm_code: "ARL", space_type: "dry_room" },
    { id: "ffz", name: "Blast Freezer(s)", shape: "cube", farm_code: "PNN", space_type: "freezer" },
  ];
  const loads = [
    load({ id: "L1", dry_space_id: "s2", weight_grams: 7140894, started_at: "2026-09-22T12:00:00.000Z" }),
    load({ id: "L2", dry_space_id: "room", silo_name: "Arlington Dry Room", weight_grams: 8280388, strain_label: "Bermuda Triangle" }),
    load({ id: "L3", dry_space_id: "ffz", silo_name: "Blast Freezer(s)", weight_grams: 100000, strain_label: null }),
  ];
  // Silo 1 holds a lot waiting to load (loading), which the first total leaves out.
  const rows = [{ dry_space_id: "s1", status: "drying", weight_grams: 6843406, lots: 1, lot_id: "lot30", hbn: "26264-ARL-OD-009-0-NA-26030", metrc_harvest_tag: null, planned: 0, strain_label: "Bermuda Triangle" }];
  const live = assembleSiloVisuals(spaces, loads, rows, CAP);

  it("owner, verbatim: 'Total in Dry Spaces, Total in Cure Spaces, Total Dry Queued'; his pick: 'Loaded in dry rooms and silos only - also add a dry weight estimate based on an Admin lookup'", () => {
    const totals = dryingTotals({ live, cureLots: [{ dryGrams: 1280080 }, { dryGrams: 1369670 }, { dryGrams: 1456290 }], queue: { grams: 2825960, lots: 2 }, dryYieldPct: 22 });
    // The silo load and the dry room load; not the freezer's 100,000 g, not the 6,843,406 g waiting on Silo 1.
    expect(totals.loadedGrams).toBe(7140894 + 8280388);
    expect(totals.loadedLots).toBe(2);
    // The estimate at the Admin percent, whole grams.
    expect(totals.estimateGrams).toBe(Math.round((7140894 + 8280388) * 0.22));
    expect(totals.dryYieldPct).toBe(22);
    expect(totals.cureGrams).toBe(1280080 + 1369670 + 1456290);
    expect(totals.cureLots).toBe(3);
    expect(totals.queuedGrams).toBe(2825960);
    expect(totals.queuedLots).toBe(2);
    // His default of 21 reads through the same percent; a bad percent falls back to the standing default.
    expect(dryingTotals({ live, cureLots: [], queue: { grams: 0, lots: 0 }, dryYieldPct: 21 }).estimateGrams).toBe(Math.round(15421282 * 0.21));
    expect(dryingTotals({ live, cureLots: [], queue: { grams: 0, lots: 0 }, dryYieldPct: Number.NaN }).dryYieldPct).toBe(PROJECTED_DRY_YIELD_PCT_DEFAULT);
    // An empty floor reads zeros, not NaN.
    expect(dryingTotals({ live: [], cureLots: [], queue: { grams: 0, lots: 0 }, dryYieldPct: 22 })).toEqual({
      loadedGrams: 0, loadedLots: 0, estimateGrams: 0, dryYieldPct: 22, cureGrams: 0, cureLots: 0, queuedGrams: 0, queuedLots: 0,
    });
  });

  it("draws the three totals as one line under the tiles: pounds and grams, the lot count, the estimate at its percent", () => {
    const totals = dryingTotals({ live, cureLots: [{ dryGrams: 1280080 }], queue: { grams: 1280080, lots: 1 }, dryYieldPct: 22 });
    const html = dryingTotalsMarkup(totals);
    expect(html).toContain('<div class="drying-totals" data-hc-drying-totals>');
    expect(html).toContain('data-hc-total="dry-spaces"');
    expect(html).toContain('<div class="drying-total-label">Total in Dry Spaces</div>');
    expect(html).toContain("<strong>34,422.50</strong> lb · <strong>15,421,282</strong> g");
    expect(html).toContain("2 lots · <span data-hc-dry-estimate>est. dry 7,572.95 lb at 22%</span>");
    expect(html).toContain('<div class="drying-total-label">Total in Cure Spaces</div>');
    expect(html).toContain("<strong>2,857.32</strong> lb · <strong>1,280,080</strong> g");
    expect(html).toContain("1 lot</div>");
    expect(html).toContain('<div class="drying-total-label">Total Dry Queued</div>');
    expect(html).toContain('data-hc-total="dry-queued"');
    // Spanish speaks.
    const es = dryingTotalsMarkup(totals, "es");
    expect(es).toContain("Total en espacios de secado");
    expect(es).toContain("Total en espacios de curado");
    expect(es).toContain("Total seco en cola");
    expect(es).toContain("seco est. 7,572.95 lb al 22%");
    expect(es).toContain("2 lotes");
    expect(es).toContain("1 lote</div>");
  });

  it("owner, verbatim: 'Under the lots in the dry spaces, show the market strain (or the actual strain if the market strain is null)'", () => {
    expect(lotStrainLine("Bermuda Triangle")).toBe('<div class="inv-lot-strain muted" data-lot-strain>Bermuda Triangle</div>');
    expect(lotStrainLine("  ")).toBe("");
    expect(lotStrainLine(null)).toBe("");
    expect(lotStrainLine("<b>")).toContain("&lt;b&gt;");
    // The waiting line carries the strain under the lot number, before the waiting word.
    const [silo1] = live;
    expect(silo1.waiting[0]).toMatchObject({ lot_id: "lot30", strain_label: "Bermuda Triangle" });
    const lines = siloWaitingLines(silo1.waiting);
    const id = lines.indexOf("Lot 26030</a>");
    const strain = lines.indexOf('<div class="inv-lot-strain muted" data-lot-strain>Bermuda Triangle</div>');
    const waiting = lines.indexOf("waiting to load</div>");
    expect(id).toBeGreaterThan(-1);
    expect(strain).toBeGreaterThan(id);
    expect(waiting).toBeGreaterThan(strain);
    // A row without a strain draws no line and keeps its shape.
    const bare = assembleSiloVisuals(spaces, [], [{ dry_space_id: "s1", status: "drying", weight_grams: 5, lots: 1, lot_id: "lotX", hbn: "26264-ARL-OD-009-0-NA-26031", metrc_harvest_tag: null, planned: 0 }], CAP);
    expect(bare[0].waiting[0]).toEqual({ lot_id: "lotX", hbn: "26264-ARL-OD-009-0-NA-26031", metrc_harvest_tag: null, weight_grams: 5, planned: false });
    expect(siloWaitingLines(bare[0].waiting)).not.toContain("data-lot-strain");
  });
});

describe("THE EMPTY CLOCK (canon 0.30.270)", () => {
  const ended = "2026-09-27T12:00:00.000Z";
  const voided = "2026-09-27T18:00:00.000Z";
  const now = "2026-09-27T22:00:00.000Z";
  const space = { id: "s3", name: "Silo 3", shape: "cylinder" as const, farm_code: "PNN", space_type: "silo" };

  it("takes the newest departure, and none while a load is open or none has ever left", () => {
    expect(emptyOrigin([{ ended_at: ended, deleted_at: null }], false)).toBe(ended);
    expect(emptyOrigin([{ ended_at: null, deleted_at: voided }], false)).toBe(voided);
    expect(emptyOrigin([{ ended_at: ended, deleted_at: null }, { ended_at: null, deleted_at: voided }], false)).toBe(voided);
    expect(emptyOrigin([{ ended_at: voided, deleted_at: ended }], false)).toBe(voided);
    expect(emptyOrigin([{ ended_at: ended, deleted_at: null }], true)).toBeNull();
    expect(emptyOrigin([], false)).toBeNull();
    expect(emptyOrigin([{ ended_at: null, deleted_at: null }], false)).toBeNull();
  });

  it("draws the clock under the state word on an empty, filling, or loading tile, and not on a loaded tile or a freezer", () => {
    const empty = siloVisual(base);
    const filling = siloVisual({ ...base, fillingGrams: 10, fillingLots: 1 });
    const loading = siloVisual({ ...base, awaitingGrams: 10, awaitingLots: 1 });
    const loaded = siloVisual({ ...base, loadedGrams: 10, clock: "running" });
    const freezer = siloVisual({ ...base, freezer: true });
    for (const visual of [empty, filling, loading]) {
      const tile = siloTile({ id: "s3", name: "Silo 3", visual, body: "", emptySince: ended, nowIso: now });
      const word = tile.indexOf("data-silo-label");
      const line = tile.indexOf("data-silo-empty");
      expect(line).toBeGreaterThan(word);
      expect(tile).toContain("Empty since");
      expect(tile).toContain('data-silo-empty-clock');
      expect(tile).toContain('data-state="running"');
      expect(tile).toContain(`data-started="${Date.parse(ended)}"`);
      expect(tile).toContain("0d 10:00:00");
      expect(tile).not.toContain('data-silo-empty="1" hidden');
    }
    const drying = siloTile({ id: "s3", name: "Silo 3", visual: loaded, body: "", emptySince: ended, nowIso: now });
    expect(drying).toContain('data-silo-empty="1" hidden');
    expect(drying).toContain('data-state="not_started"');
    expect(drying).not.toContain('data-state="running"');
    const cube = siloTile({ id: "bf", name: "Blast Freezer(s)", visual: freezer, body: "", shape: "cube", emptySince: ended, nowIso: now });
    expect(cube).not.toContain("data-silo-empty");
    expect(cube).not.toContain("Empty since");
    expect(siloTile({ id: "s3", name: "Silo 3", visual: empty, body: "", emptySince: ended, nowIso: now, locale: "es" })).toContain("Vacío desde");
    expect(emptyClockLine(null, now)).toContain('data-silo-empty="1" hidden');
  });

  it("carries emptySince on live.json and the refresh script sets and clears the line", () => {
    const filling = siloVisual({ ...base, fillingGrams: 10, fillingLots: 1 });
    const entry = siloLiveEntry("s3", "Silo 3", filling, "en", "cylinder", [], ended);
    expect(entry).toMatchObject({
      id: "s3",
      state: "filling",
      wetGrams: 10,
      fill: "green",
      throb: "green",
      flags: [],
      emptySince: ended,
    });
    const drying = siloVisual({ ...base, loadedGrams: 10, clock: "running" });
    expect(siloLiveEntry("s3", "Silo 3", drying, "en", "cylinder", ["Plenum 104.2 F, above 100 F"], ended).emptySince).toBe(ended);
    const freezer = siloVisual({ ...base, freezer: true });
    expect(siloLiveEntry("bf", "Blast Freezer(s)", freezer, "en", "cube", [], ended).emptySince).toBeNull();
    const script = siloLiveScript();
    expect(script).toContain("entry.emptySince");
    expect(script).toContain("entry.checks");
    expect(script).toContain("data-check-line");
    expect(script).toContain("[data-silo-empty]");
    expect(script).toContain('clock.setAttribute("data-state", "running")');
    expect(script).toContain('clock.setAttribute("data-state", "not_started")');
    expect(script).toContain("empty.hidden = false");
    expect(script).toContain("empty.hidden = true");
  });

  it("assembles the origin beside an open load, a void, and a freezer", () => {
    const departures = [
      { dry_space_id: "s3", left_at: ended },
      { dry_space_id: "bf", left_at: voided },
    ];
    const open = load({ id: "open", dry_space_id: "s3" });
    const withOpen = assembleSiloVisuals([space], [open], [], CAP, 22, departures);
    expect(withOpen[0].visual.state).toBe("drying");
    expect(withOpen[0].emptySince).toBeNull();
    const quiet = assembleSiloVisuals([space], [], [], CAP, 22, departures);
    expect(quiet[0].visual.state).toBe("empty");
    expect(quiet[0].emptySince).toBe(ended);
    const filling = assembleSiloVisuals([space], [], [{ dry_space_id: "s3", status: "weighing", weight_grams: 8, lots: 1 }], CAP, 22, departures);
    expect(filling[0].visual.state).toBe("filling");
    expect(filling[0].emptySince).toBe(ended);
    const freezerSpace = { id: "bf", name: "Blast Freezer(s)", shape: "cube" as const, farm_code: "PNN", space_type: "freezer" };
    const held = assembleSiloVisuals([freezerSpace], [], [], CAP, 22, departures);
    expect(held[0].emptySince).toBeNull();
    expect(assembleSiloVisuals([space], [], [], CAP)[0].emptySince).toBeNull();
  });

  it("reads the newer of an ended load and a voided load from the table", async () => {
    const m = await migratedDb();
    const t = "2026-09-27T00:00:00.000Z";
    m.run(`INSERT INTO dry_spaces (id, name, kind, space_type, created_at, updated_at) VALUES ('sp-e', 'Empty Clock Silo', 'silo', 'silo', ?, ?)`, t, t);
    m.run(
      `INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, paused_seconds, ended_at, created_at, updated_at)
       VALUES ('ld-ended', 'sp-e', 'w1', ?, 0, ?, ?, ?)`,
      ended,
      ended,
      t,
      t
    );
    m.run(
      `INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, paused_seconds, ended_at, deleted_at, created_at, updated_at)
       VALUES ('ld-void', 'sp-e', 'w2', ?, 0, NULL, ?, ?, ?)`,
      voided,
      voided,
      t,
      t
    );
    const rows = await listSiloEmptySince(m.db);
    expect(rows.find((row) => row.dry_space_id === "sp-e")?.left_at).toBe(voided);
    const live = await loadSiloVisuals(m.db);
    expect(live.live.find((row) => row.silo.id === "sp-e")?.emptySince).toBe(voided);
    m.run(
      `INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, paused_seconds, ended_at, created_at, updated_at)
       VALUES ('ld-open', 'sp-e', 'w3', ?, 0, NULL, ?, ?)`,
      now,
      t,
      t
    );
    const again = await loadSiloVisuals(m.db);
    expect(again.live.find((row) => row.silo.id === "sp-e")?.emptySince).toBeNull();
  });
});
