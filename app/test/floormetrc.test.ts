import { describe, expect, it } from "vitest";
import { t } from "../src/i18n";
import {
  NOTHING_PENDING,
  FINDING_GONE,
  FINDING_LICENSE,
  FINDING_MISSING,
  FINDING_NO_FLOOR,
  FINDING_NO_METRC,
  FINDING_SAME,
  FINDING_UNITS,
  FINDING_VOIDED,
  buildFloorVsMetrc,
  findingText,
  floorVsMetrcCsv,
  floorVsMetrcPage,
  isPackageTag,
  metrcAsOfText,
  openUploadKinds,
  packageFinding,
  shownFloorVsMetrc,
  type BatchInput,
  type FloorItemInput,
  type MirrorInput,
  type SprItemInput,
  type UploadInput,
} from "../src/floormetrc";

const TAG_SAME = "1A40503000311FB0000000A1";
const TAG_DIFF = "1A40503000311FB0000000A2";
const TAG_EACH = "1A40503000311FB0000000A3";
const TAG_GONE = "1A40503000311FB0000000A4";
const TAG_MISS = "1A40503000311FB0000000A5";
const TAG_LIC = "1A40503000311FB0000000A6";
const TAG_FIVE = "26027";
const AS_OF = "2026-10-05T01:28:27.560Z";

const uploads: UploadInput[] = [
  { batchId: "b1", kind: "wet_weights", cleared: 0 },
  { batchId: "b1", kind: "plants", cleared: 0 },
  { batchId: "b1", kind: "package_adjust", cleared: 1 },
  { batchId: "b1", kind: "location_change", cleared: 0, deletedAt: "2026-10-01T00:00:00.000Z" },
  { batchId: "b2", kind: "wet_weights", cleared: 0 },
];

function item(over: Partial<FloorItemInput> & Pick<FloorItemInput, "tag" | "qty">): FloorItemInput {
  return {
    itemKind: "WIP",
    uom: "g",
    location: "CSA",
    license: "AU-G-C-000832",
    lot: "26027",
    batchId: "b1",
    ...over,
  };
}

function mirror(over: Partial<MirrorInput> & Pick<MirrorInput, "tag">): MirrorInput {
  return {
    quantity: 100,
    uom: "g",
    location: "Shelf A",
    license: "AU-G-C-000832",
    changedAt: AS_OF,
    ...over,
  };
}

function modelFrom(items: FloorItemInput[], mirrorRows: MirrorInput[], extra?: { batches?: BatchInput[]; spr?: SprItemInput[] }) {
  return buildFloorVsMetrc({
    items,
    mirror: mirrorRows,
    batches: extra?.batches ?? [],
    spr: extra?.spr ?? [],
    uploads,
    harvestYear: 2026,
    changedAt: AS_OF,
  });
}

describe("FLOOR VS METRC (canon 0.30.415)", () => {
  it("names each package finding, and a 5 digit tag stays out", () => {
    expect(TAG_SAME).toHaveLength(24);
    expect(isPackageTag(TAG_FIVE)).toBe(false);
    expect(packageFinding({ qty: 100, uom: "g", license: "L" }, { quantity: 100, uom: "g", license: "L" })).toBe(FINDING_SAME);
    expect(packageFinding({ qty: 100, uom: "g", license: "L" }, { quantity: 101, uom: "g", license: "L" })).toBe(FINDING_SAME);
    expect(packageFinding({ qty: 100, uom: "g", license: "L" }, { quantity: 2500, uom: "g", license: "L" })).toBe("Weight differs by 2,400");
    expect(packageFinding({ qty: 10, uom: "g", license: "L" }, { quantity: 999, uom: "ea", license: "L" })).toBe(FINDING_UNITS);
    expect(packageFinding({ qty: 10, uom: "g", license: "L" }, { quantity: 999, uom: "ea", license: "L" })).not.toContain("989");
    expect(packageFinding({ qty: 10, uom: "g", license: "L" }, { quantity: 10, uom: "g", license: "L", goneAt: "2026-10-01T00:00:00.000Z" })).toBe(FINDING_GONE);
    expect(packageFinding({ qty: 10, uom: "g", license: "L" }, null)).toBe(FINDING_MISSING);
    expect(packageFinding({ qty: 100, uom: "g", license: "A" }, { quantity: 100, uom: "g", license: "B" })).toBe(`${FINDING_SAME}; ${FINDING_LICENSE}`);
    expect(packageFinding({ qty: 10, uom: "g", license: "A" }, null)).not.toContain(FINDING_LICENSE);

    const model = modelFrom(
      [
        item({ tag: TAG_SAME, qty: 100 }),
        item({ tag: TAG_DIFF, qty: 250, itemKind: "FG" }),
        item({ tag: TAG_EACH, qty: 10, itemKind: "FG", uom: "g" }),
        item({ tag: TAG_GONE, qty: 10 }),
        item({ tag: TAG_MISS, qty: 10, batchId: "" }),
        item({ tag: TAG_LIC, qty: 100, license: "OTHER" }),
        item({ tag: TAG_FIVE, qty: 999 }),
        item({ tag: TAG_SAME, qty: 1, deletedAt: "2026-10-01T00:00:00.000Z" }),
      ],
      [
        mirror({ tag: TAG_SAME, quantity: 100 }),
        mirror({ tag: TAG_DIFF, quantity: 100 }),
        mirror({ tag: TAG_EACH, quantity: 999, uom: "ea" }),
        mirror({ tag: TAG_GONE, goneAt: "2026-10-01T00:00:00.000Z" }),
        mirror({ tag: TAG_LIC, quantity: 100, license: "AU-G-C-000832" }),
        mirror({ tag: TAG_FIVE, quantity: 1 }),
      ]
    );
    const byTag = new Map(model.packages.map((row) => [row.tag, row]));
    expect(byTag.has(TAG_FIVE)).toBe(false);
    expect(model.packages).toHaveLength(6);
    expect(byTag.get(TAG_SAME)?.finding).toBe(FINDING_SAME);
    expect(byTag.get(TAG_SAME)?.pending).toBe("");
    expect(byTag.get(TAG_DIFF)?.finding).toBe("Weight differs by 150");
    expect(byTag.get(TAG_EACH)?.finding).toBe(FINDING_UNITS);
    expect(byTag.get(TAG_GONE)?.finding).toBe(FINDING_GONE);
    expect(byTag.get(TAG_MISS)?.finding).toBe(FINDING_MISSING);
    expect(byTag.get(TAG_LIC)?.finding).toBe(`${FINDING_SAME}; ${FINDING_LICENSE}`);
  });

  it("names each lot finding, and a voided lot is not weighed", () => {
    const batches: BatchInput[] = [
      { batchId: "same", hbn: "H-SAME", lot: "26001", state: "unloaded", harvestYear: 2026, voided: false },
      { batchId: "diff", hbn: "H-DIFF", lot: "26002", state: "drying", harvestYear: 2026, voided: false },
      { batchId: "nofloor", hbn: "H-NOFLOOR", lot: "26003", state: "drying", harvestYear: 2026, voided: false },
      { batchId: "nometrc", hbn: "H-NOMETRC", lot: "26004", state: "unloaded", harvestYear: 2026, voided: false },
      { batchId: "void", hbn: "H-VOID", lot: "26062", state: "drying", harvestYear: 2026, voided: true },
      { batchId: "old", hbn: "H-OLD", lot: "25001", state: "unloaded", harvestYear: 2025, voided: false },
      { batchId: "voidold", hbn: "H-VOLD", lot: "25002", state: "drying", harvestYear: 2025, voided: true },
      { batchId: "gone", hbn: "H-GONE", lot: "26005", state: "drying", harvestYear: 2026, voided: false },
    ];
    const spr: SprItemInput[] = [
      { batchId: "same", qty: 100, uom: "g", location: "BARN" },
      { batchId: "diff", qty: 1000, uom: "g", location: "ARL BARN" },
      { batchId: "nometrc", qty: 50, uom: "g", location: "CSA" },
      { batchId: "void", qty: 40, uom: "g", location: "Hang in Place" },
      { batchId: "void", qty: 60, uom: "g", location: "Hang in Place" },
      { batchId: "old", qty: 80, uom: "g", location: "BARN" },
      { batchId: "gone", qty: 70, uom: "g", location: "BARN" },
    ];
    const mirrorRows: MirrorInput[] = [
      mirror({ tag: "1A40503000311FB0000000B1", quantity: 100, item: "SPR - A", sourceHarvests: "H-SAME" }),
      mirror({ tag: "1A40503000311FB0000000B2", quantity: 2500, item: "SPR - B", sourceHarvests: "H-DIFF" }),
      mirror({ tag: "1A40503000311FB0000000B3", quantity: 10, item: "SPR - C", sourceHarvests: "H-NOFLOOR" }),
      mirror({ tag: "1A40503000311FB0000000B4", quantity: 5, item: "SPR - D", sourceHarvests: "H-VOID" }),
      mirror({ tag: "1A40503000311FB0000000B5", quantity: 5, item: "SPR - E", sourceHarvests: "H-VOLD" }),
      mirror({ tag: "1A40503000311FB0000000B6", quantity: 5, item: "SPR - F", sourceHarvests: "H-GONE", goneAt: "2026-10-01T00:00:00.000Z" }),
      mirror({ tag: "1A40503000311FB0000000B7", quantity: 5, item: "BUD - no", sourceHarvests: "H-NOMETRC" }),
    ];
    const model = buildFloorVsMetrc({
      items: [],
      mirror: mirrorRows,
      batches,
      spr,
      uploads,
      harvestYear: 2026,
      changedAt: AS_OF,
    });
    const byLot = new Map(model.lots.map((row) => [row.lot, row]));
    expect(byLot.get("26001")?.finding).toBe(FINDING_SAME);
    expect(byLot.get("26001")?.pending).toBe("");
    expect(byLot.get("26002")?.finding).toBe("Weight differs by 1,500");
    expect(byLot.get("26003")?.finding).toBe(FINDING_NO_FLOOR);
    expect(byLot.get("26003")?.floorQty).toBe("");
    expect(byLot.get("26004")?.finding).toBe(FINDING_NO_METRC);
    expect(byLot.get("26062")?.finding).toBe(FINDING_VOIDED);
    expect(byLot.get("26062")?.floorQty).toBe("100");
    expect(byLot.get("26062")?.finding).not.toContain("Weight differs");
    expect(byLot.get("26005")?.finding).toBe(FINDING_NO_METRC);
    expect(byLot.has("25001")).toBe(false);
    expect(byLot.get("25002")?.finding).toBe(FINDING_VOIDED);
    expect(model.lots.find((row) => row.finding === FINDING_UNITS)).toBeUndefined();
  });

  it("reads the mirror's newest changed_at in Eastern time", () => {
    expect(metrcAsOfText(AS_OF, "en")).toBe("METRC as of 2026-10-04 21:28");
    expect(metrcAsOfText(AS_OF, "es")).toBe("METRC al 2026-10-04 21:28");
    expect(metrcAsOfText(null, "en")).toBe("METRC as of");
  });

  it("names open upload kinds and skips cleared and deleted ones", () => {
    expect(openUploadKinds(uploads, "b1")).toBe("plants, wet_weights");
    expect(openUploadKinds(uploads, "b9")).toBe(NOTHING_PENDING);
    const model = modelFrom([item({ tag: TAG_DIFF, qty: 250 })], [mirror({ tag: TAG_DIFF, quantity: 100 })]);
    expect(model.packages[0].pending).toBe("plants, wet_weights");
    expect(model.packages[0].pending).not.toContain("package_adjust");
    expect(model.packages[0].pending).not.toContain("location_change");
  });

  it("hides Same under differences only, and the CSV holds the rows shown", () => {
    const model = modelFrom(
      [item({ tag: TAG_SAME, qty: 100 }), item({ tag: TAG_DIFF, qty: 250 }), item({ tag: TAG_LIC, qty: 100, license: "OTHER" })],
      [mirror({ tag: TAG_SAME }), mirror({ tag: TAG_DIFF, quantity: 100 }), mirror({ tag: TAG_LIC })]
    );
    const differences = shownFloorVsMetrc(model, { finding: "differences", itemKind: "", lot: "" });
    expect(differences.packages.map((row) => row.tag)).toEqual([TAG_DIFF, TAG_LIC]);
    expect(differences.packages.some((row) => row.finding === FINDING_SAME)).toBe(false);
    const all = shownFloorVsMetrc(model, { finding: "all", itemKind: "", lot: "" });
    expect(all.packages.map((row) => row.tag)).toContain(TAG_SAME);
    const lot = shownFloorVsMetrc(model, { finding: "all", itemKind: "", lot: "26027" });
    expect(lot.packages).toHaveLength(3);
    const otherLot = shownFloorVsMetrc(model, { finding: "all", itemKind: "", lot: "26099" });
    expect(otherLot.packages).toHaveLength(0);
    const wip = shownFloorVsMetrc(model, { finding: "differences", itemKind: "WIP", lot: "" });
    expect(wip.packages.map((row) => row.tag)).toEqual([TAG_DIFF, TAG_LIC]);

    const csv = floorVsMetrcCsv(differences, AS_OF);
    expect(csv.startsWith("METRC as of 2026-10-04 21:28\r\n")).toBe(true);
    expect(csv).toContain(TAG_DIFF);
    expect(csv).toContain("Weight differs by 150");
    expect(csv).toContain(TAG_LIC);
    expect(csv).not.toContain(TAG_SAME);
    const csvAll = floorVsMetrcCsv(all, AS_OF);
    expect(csvAll).toContain(TAG_SAME);
    expect(csvAll).toContain(FINDING_SAME);
  });

  it("renders the page in both locales, with the full tag on hover and the tables in a scroll box", () => {
    const model = modelFrom([item({ tag: TAG_DIFF, qty: 250 })], [mirror({ tag: TAG_DIFF, quantity: 100 })]);
    const shown = shownFloorVsMetrc(model, { finding: "differences", itemKind: "", lot: "" });
    const page = floorVsMetrcPage({
      changedAt: AS_OF,
      packages: shown.packages,
      lots: shown.lots,
      filter: { finding: "differences", itemKind: "", lot: "" },
      locale: "en",
    });
    expect(page).toContain("Floor vs METRC");
    expect(page).toContain("METRC as of 2026-10-04 21:28");
    expect(page).toContain('class="report-scroll"');
    expect(page).toContain(`title="${TAG_DIFF}"`);
    expect(page).toContain(TAG_DIFF.slice(-6));
    expect(page).toContain("Weight differs 1");
    expect(page).toContain('value="differences" selected');
    expect(t("es", "Floor vs METRC")).toBe("Piso vs METRC");
    const spanish = floorVsMetrcPage({
      changedAt: AS_OF,
      packages: shown.packages,
      lots: [],
      filter: { finding: "differences", itemKind: "", lot: "" },
      locale: "es",
    });
    expect(spanish).toContain("Piso vs METRC");
    expect(spanish).toContain(findingText("es", "Weight differs by 150"));
    expect(spanish).toContain("plants, wet_weights");
    expect(t("es", NOTHING_PENDING)).toBe("nada pendiente");
  });
});
