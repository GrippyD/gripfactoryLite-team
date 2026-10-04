import { describe, expect, it } from "vitest";
import {
  assembleSiloVisuals,
  LB_GRAMS,
  siloFillClass,
  siloLiveEntry,
  siloLiveScript,
  siloPctLabel,
  siloSvg,
  siloTile,
  siloVisual,
  spaceCapacityGrams,
  spaceCapacityLabel,
  spaceShapeOf,
  spaceTypeOf,
  SILO_CAPACITY_WET_LBS_DEFAULT,
} from "../src/silo";
import { applyTransition, CAPACITY_UOMS, capacityUomOf, DRY_SPACE_TYPES, drySpaceTypeOf, LOT_STATUS, SYSTEM_REASON } from "../src/config";
import { HttpError } from "../src/audit";
import { parseCapacity, parseCapacityUom, parseDrySpaceType } from "../src/actions";
import { EDITABLE_FIELDS, stationByKey } from "../src/pipeline";
import { editPage, lookupSectionPage } from "../src/pages";
import { unloadLotPanel } from "../src/html";
import { themeStylesheet } from "../src/theme";

/** THE BLAST FREEZER(S) AND THE DRY SPACE TYPE (canon 0.30.106). Owner rulings
 * 2026-09-16, verbatim: "Change "Blast Freezer" to "Blast Freezer(s)".  Merge
 * the blast freezer formatting to the FFZ inventory one.  Expose FFZ inventory
 * on the dry ops pages.  Unload Dry Space/Blast Freezer just removes the line,
 * since the packages are already denoted as "FFZ" in METRC, the inventory lines
 * are identical and moving the BF inventory to the FFZ inventory would just
 * duplicate it.  Change blast freezer capacity to 800lbs.  Change status
 * "Drying" to "Chilling Out"" and "Admin lookups: Dry spaces: 1. Name 2.
 * Capacity 3. Capacity UOM (ea, lb, g, sqft) 4. Freezer, Dry Room, or Silo?
 * <<<<<<Toggle that decides the formatting and the shape". */

const CAP = SILO_CAPACITY_WET_LBS_DEFAULT * LB_GRAMS;
const base = { fillingGrams: 0, fillingLots: 0, awaitingGrams: 0, loadedGrams: 0, clock: null, capacityGrams: CAP } as const;
const BF = { id: "bf", name: "Blast Freezer(s)", shape: "cube", farm_code: "PNN", space_type: "freezer", capacity: 800, capacity_uom: "lb", location_name: "Blast Freezer" };

describe("the type decides the shape and the formatting (canon 0.30.106)", () => {
  it("freezer is the cube, dry room the box, silo the cylinder; a row with no type reads its stored shape", () => {
    expect(spaceShapeOf({ space_type: "freezer" })).toBe("cube");
    expect(spaceShapeOf({ space_type: "dry_room" })).toBe("box");
    expect(spaceShapeOf({ space_type: "silo" })).toBe("cylinder");
    expect(spaceShapeOf({ space_type: null, shape: "box" })).toBe("box");
    expect(spaceShapeOf({ shape: "cylinder" })).toBe("cylinder");
    expect(spaceTypeOf({ space_type: "freezer" })).toBe("freezer");
    expect(spaceTypeOf({ shape: "box" })).toBe("dry_room");
    expect(spaceTypeOf({})).toBe("silo");
    expect(drySpaceTypeOf("garbage")).toBe("silo");
    expect(DRY_SPACE_TYPES).toEqual(["silo", "dry_room", "freezer", "cure"]);
    expect(drySpaceTypeOf("cure")).toBe("cure");
    expect(CAPACITY_UOMS).toEqual(["ea", "lb", "g", "sqft"]);
    expect(capacityUomOf("LB")).toBe("lb");
    expect(capacityUomOf("tons")).toBeNull();
  });

  it("a space's own weight capacity scales its fill; ea and sqft leave the standing silo capacity", () => {
    expect(spaceCapacityGrams(BF, CAP)).toBeCloseTo(800 * LB_GRAMS, 4);
    expect(spaceCapacityGrams({ capacity: 1000, capacity_uom: "g" }, CAP)).toBe(1000);
    expect(spaceCapacityGrams({ capacity: 120, capacity_uom: "sqft" }, CAP)).toBe(CAP);
    expect(spaceCapacityGrams({ capacity: 4, capacity_uom: "ea" }, CAP)).toBe(CAP);
    expect(spaceCapacityGrams({}, CAP)).toBe(CAP);
    expect(spaceCapacityGrams({ capacity: "15,000", capacity_uom: "lb" }, 1)).toBeCloseTo(15000 * LB_GRAMS, 4);
    expect(spaceCapacityLabel(BF)).toBe("800 lb");
    expect(spaceCapacityLabel({ capacity: 15000, capacity_uom: "lb" })).toBe("15,000 lb");
    expect(spaceCapacityLabel({})).toBe("");
  });

  it("a freezer's running clock reads Chilling Out and its fill is the FFZ blue fading to white", () => {
    const chilling = siloVisual({ ...base, capacityGrams: 800 * LB_GRAMS, loadedGrams: 749.03 * LB_GRAMS, clock: "running", freezer: true });
    expect(chilling).toMatchObject({ state: "drying", label: "chilling out", freezer: true, fill: "red", throb: "red" });
    expect(chilling.level).toBeCloseTo(749.03 / 800, 4);
    expect(siloFillClass(chilling)).toBe("silo-fill ffz-fill ffz-throb");
    expect(siloPctLabel(chilling)).toBe("94% full");
    expect(siloPctLabel(chilling, "es")).toBe("94% lleno");
    // The other states keep their words; the empty freezer draws the wire alone.
    expect(siloVisual({ ...base, fillingGrams: 5, fillingLots: 1, freezer: true })).toMatchObject({ state: "filling", label: "filling", freezer: true });
    expect(siloFillClass(siloVisual({ ...base, freezer: true }))).toBe("silo-fill");
    // A silo is untouched: drying stays drying in red.
    expect(siloVisual({ ...base, loadedGrams: 10, clock: "running" })).toMatchObject({ state: "drying", label: "drying", freezer: false });
    expect(siloFillClass(siloVisual({ ...base, loadedGrams: 10, clock: "running" }))).toBe("silo-fill silo-fill-red silo-throb");
  });

  it("the freezer tile wears the FFZ chrome: status and percent on one line, the lot lines muted, the wet line, the cube", () => {
    const v = siloVisual({ ...base, capacityGrams: 800 * LB_GRAMS, loadedGrams: 749.03 * LB_GRAMS, clock: "running", freezer: true });
    const tile = siloTile({ id: "bf", name: "Blast Freezer(s)", visual: v, body: '<div class="inv-lot">Lot 26023</div>', shape: "cube" });
    expect(tile).toContain('<div class="inv-gauge silo-gauge ffz-gauge freezer-gauge dry-tile" data-silo="bf" data-silo-state="drying" data-silo-shape-kind="cube" data-space-type="freezer" data-dry-tile>');
    expect(tile).toContain('aria-expanded="false"');
    expect(tile).toContain('<div class="inv-gauge-name">Blast Freezer(s)</div>');
    expect(tile).toContain('<svg class="silo-shape silo-shape-cube" data-silo-shape data-silo-state="drying"');
    expect(tile).toContain('<div class="silo-state ffz-state freezer-state"><span data-silo-label>Chilling Out</span> · <span data-silo-pct>94% full</span></div>');
    expect(tile).toContain('<div class="muted ffz-source freezer-lines"><div class="inv-lot">Lot 26023</div></div>');
    expect(tile).toContain('class="silo-fill ffz-fill ffz-throb" data-silo-fill');
    expect(tile).toContain('<div class="silo-wet" data-silo-wet>Wet <strong data-silo-wet-lb>749.03</strong> lb');
    expect(tile).not.toContain('class="silo-state silo-state-drying"');
    // Spanish reads the freezer's word too.
    expect(siloTile({ id: "bf", name: "Blast Freezer(s)", visual: v, body: "", shape: "cube", locale: "es" })).toContain("<span data-silo-label>Enfriando</span>");
    // The cube is the FFZ cube's geometry, not the dry room's box.
    expect(siloSvg(v, "bf", "en", "cube")).toContain('<path class="silo-wire" d="M46 42 H138 V134 H46 Z"/>');
    expect(siloSvg(v, "bf", "en", "box")).toContain('<path class="silo-wire" d="M34 42 H146 V134 H34 Z"/>');
  });

  it("the live entry and the live script carry the freezer's classes and word", () => {
    const v = siloVisual({ ...base, capacityGrams: 800 * LB_GRAMS, loadedGrams: 749.03 * LB_GRAMS, clock: "running", freezer: true });
    const entry = siloLiveEntry("bf", "Blast Freezer(s)", v, "en", "cube");
    expect(entry).toMatchObject({ shape: "cube", spaceType: "freezer", fillClass: "silo-fill ffz-fill ffz-throb", pctLabel: "94% full", label: "Chilling Out" });
    const script = siloLiveScript();
    expect(script).toContain("if (entry.fillClass) cls = entry.fillClass;");
    expect(script).toContain('tile.getAttribute("data-space-type") === "freezer"');
    expect(script).toContain('tile.querySelector("[data-silo-pct]")');
  });

  it("assembleSiloVisuals scales each space against its own capacity and flags the freezer", () => {
    const silos = [
      { id: "s1", name: "Silo 1", shape: "cylinder", farm_code: "PNN", space_type: "silo", capacity: 15000, capacity_uom: "lb", location_name: null },
      BF,
    ];
    const loads = [
      { id: "L1", dry_space_id: "bf", silo_name: "Blast Freezer(s)", wet_weight_entry_id: "w1", loaded_at: "2026-09-16T12:00:00.000Z", started_at: "2026-09-16T12:00:00.000Z", paused_at: null, paused_seconds: 0, ended_at: null, notes: null, weight_grams: 749.03 * LB_GRAMS, dry_weight_grams: null, hbn: "26259-PNN-GL-070-0-BF-26023", metrc_harvest_tag: null, strain_name: "Gelonade" },
    ] as never;
    const live = assembleSiloVisuals(silos, loads, [], CAP);
    expect(live[0].visual).toMatchObject({ state: "empty", freezer: false });
    expect(live[1].visual).toMatchObject({ state: "drying", label: "chilling out", freezer: true });
    expect(live[1].visual.level).toBeCloseTo(749.03 / 800, 4);
  });

  it("every sheet styles the freezer tile's lines and status", () => {
    for (const view of ["lite", "cerberus", "co"] as const) {
      const css = themeStylesheet(view);
      expect(css, view).toContain(".freezer-gauge .freezer-lines {");
      expect(css, view).toContain(".freezer-gauge .freezer-state { white-space: nowrap; }");
      expect(css, view).toContain(".ffz-throb { animation: ffz-throb 4.2s ease-in-out infinite; }");
    }
  });
});

describe("the freezer's unload law and the frozen lot (canon 0.30.106)", () => {
  it("frozen is a lot status reached from drying, and no queue reads it", () => {
    expect(LOT_STATUS.frozen).toBe("frozen");
    expect(applyTransition("lot_frozen", LOT_STATUS.drying)).toBe(LOT_STATUS.frozen);
    expect(() => applyTransition("lot_frozen", LOT_STATUS.unloaded)).toThrow();
    expect(SYSTEM_REASON.freezer_unload).toBe("freezer line removed; the packages stand as FFZ in METRC");
  });

  it("the unload panel of a freezer lot takes no dry weight and offers Remove the line alone", () => {
    const station = stationByKey("unload_dry_space")!;
    const lot = {
      id: "w1",
      hbn: "26259-PNN-GL-070-0-BF-26023",
      metrc_harvest_tag: null,
      strain_name: "Gelonade",
      dry_space_name: "Blast Freezer(s)",
      dry_space_kind: "silo",
      dry_space_type: "freezer",
      material_form: "bucked",
      weight_grams: 339754,
    };
    const html = unloadLotPanel(station, lot, [], 0, "en");
    expect(html).toContain('<section class="freezer-unload" data-freezer-unload>');
    expect(html).toContain("This lot stands in a freezer. Its packages already read FFZ in METRC, so unloading only removes the line: nothing moves and no dry weight is taken.");
    expect(html).toContain('action="/station/unload_dry_space/lot/w1/finish"');
    expect(html).toContain(">Remove the line</button>");
    expect(html).toContain("<dt>From</dt><dd>Blast Freezer(s)</dd>");
    expect(html).not.toContain("Dry weights");
    expect(html).not.toContain("Finish unload");
    expect(html).not.toContain('id="unload-session"');
    expect(unloadLotPanel(station, lot, [], 0, "es")).toContain(">Quitar la linea</button>");
    // A silo lot keeps the standing panel.
    const silo = unloadLotPanel(station, { ...lot, dry_space_type: "silo", dry_space_name: "Silo 4" }, [], 0, "en");
    expect(silo).toContain("Dry weights");
    expect(silo).not.toContain("data-freezer-unload");
  });
});

describe("Admin, Lookups, Dry spaces: his four fields (canon 0.30.106)", () => {
  it("the pencil carries name, capacity, capacity UOM, the type toggle, then kind and farm", () => {
    expect(EDITABLE_FIELDS.dry_spaces.map((f) => f.name)).toEqual(["name", "capacity", "capacity_uom", "space_type", "kind", "farm_code"]);
    const type = EDITABLE_FIELDS.dry_spaces.find((f) => f.name === "space_type")!;
    expect(type.label).toBe("Freezer, Dry Room, Silo, or Cure Space?");
    expect(type.options!.map((o) => o.label)).toEqual(["Silo", "Dry Room", "Freezer", "Cure Space"]);
    const uom = EDITABLE_FIELDS.dry_spaces.find((f) => f.name === "capacity_uom")!;
    expect(uom.options!.map((o) => o.value)).toEqual(["ea", "lb", "g", "sqft"]);
    expect(uom.optional).toBe(true);
    const html = editPage("dry_spaces", "bf", { name: "Blast Freezer(s)", capacity: 800, capacity_uom: "lb", space_type: "freezer", kind: "silo", farm_code: "PNN" }, { farms: [{ value: "PNN", label: "PNN" }] });
    expect(html).toContain('<select name="space_type"><option value="silo">Silo</option><option value="dry_room">Dry Room</option><option value="freezer" selected>Freezer</option><option value="cure">Cure Space</option></select>');
    expect(html).toContain('<select name="capacity_uom"><option value=""></option><option value="ea">ea</option><option value="lb" selected>lb</option><option value="g">g</option><option value="sqft">sqft</option></select>');
    expect(html).toContain('<input type="number" name="capacity" value="800" step="0.01">');
  });

  it("the lookup table reads his four columns first with the type in his words, and the add form carries them", () => {
    const tables = {
      people: [],
      farms: [{ code: "PNN" }],
      grow_methods: [],
      strains: [],
      dry_spaces: [
        { id: "bf", name: "Blast Freezer(s)", space_type: "freezer", capacity: 800, capacity_uom: "lb", kind: "silo", farm_code: "PNN" },
        { id: "s1", name: "Silo 1", space_type: "silo", capacity: 15000, capacity_uom: "lb", kind: "silo", farm_code: "PNN" },
      ],
      package_types: [],
      app_config: [],
    };
    const html = lookupSectionPage("dry_spaces", tables, []);
    expect(html).toContain("<tr><th>name</th><th>capacity</th><th>capacity_uom</th><th>space_type</th><th>kind</th><th>farm_code</th><th>Controls</th></tr>");
    expect(html).toContain("<td>Blast Freezer(s)</td><td>800</td><td>lb</td><td>Freezer</td><td>silo</td><td>PNN</td>");
    expect(html).toContain("<td>Silo 1</td><td>15000</td><td>lb</td><td>Silo</td>");
    expect(html).toContain('<label class="field">Capacity <input type="number" name="capacity" step="0.01" min="0"></label>');
    expect(html).toContain('<label class="field">Capacity UOM <select name="capacity_uom"><option value=""></option><option value="ea">ea</option><option value="lb">lb</option><option value="g">g</option><option value="sqft">sqft</option></select></label>');
    expect(html).toContain('<label class="field">Freezer, Dry Room, Silo, or Cure Space? <select name="space_type"><option value="silo">Silo</option><option value="dry_room">Dry Room</option><option value="freezer">Freezer</option><option value="cure">Cure Space</option></select></label>');
  });

  it("the add form's parsers refuse in words", () => {
    expect(parseDrySpaceType("freezer")).toBe("freezer");
    expect(() => parseDrySpaceType("fridge")).toThrow(HttpError);
    expect(() => parseDrySpaceType("fridge")).toThrow("Pick Silo, Dry Room, Freezer or Cure Space.");
    expect(parseDrySpaceType("cure")).toBe("cure");
    expect(parseCapacity("800")).toBe(800);
    expect(parseCapacity("1,234.567")).toBe(1234.57);
    expect(parseCapacity("")).toBeNull();
    expect(parseCapacity(null)).toBeNull();
    expect(() => parseCapacity("-5")).toThrow("Capacity must be a number above zero, or blank.");
    expect(() => parseCapacity("lots")).toThrow(HttpError);
    expect(parseCapacityUom("lb")).toBe("lb");
    expect(parseCapacityUom(" SQFT ")).toBe("sqft");
    expect(parseCapacityUom("")).toBeNull();
    expect(() => parseCapacityUom("tons")).toThrow("Capacity UOM must be one of ea, lb, g, sqft.");
  });
});
