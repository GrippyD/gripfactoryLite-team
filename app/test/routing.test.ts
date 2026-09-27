import { describe, expect, it } from "vitest";
import {
  applyTransition,
  demoteStep,
  DRY_SPACE_KINDS,
  finishTransitionName,
  formatGrams,
  GRAM_FIELDS,
  CRYO_TYPE_CATEGORIES_DEFAULT,
  initialWipStatus,
  parseCryoTypeCategories,
  moveToKindsForFarm,
  nextTruckNumber,
  parseExtractionCodes,
  plantSplitJitterPct,
  projectedDryYieldPct,
  shortLotId,
  travelerLotId,
  sumGrams,
  TRUCK_DRY_SPACE_ID,
  truckNumberFromPick,
  WIP_STATUS,
  LOT_STATUS,
  LANDING_FARM,
  LANDING_MOVE_TO_KINDS,
} from "../src/config";
import { assertLotHasDryWeights, assertLotHasWeights } from "../src/actions";
import { queues } from "../src/pipeline";
import { HttpError } from "../src/audit";
import {
  extractionBoundSql,
  filterDrySpaces,
  NO_FINISHED_LOT_SQL,
  PENDING_WET_UPLOADS_SQL,
  SHORT_LOT_ID_SQL,
  type DrySpaceOptionRow,
} from "../src/db";

// THE CRYO POOL BY TYPE (canon 0.30.119; owner, 2026-09-18: "lot ending 011
// contains x amount of bud, y amount of wpr, and z amount of shake"): the
// cryo-bound trim types come from app_config cryo_type_categories (BUD=BUD,
// SMALLS=WPR, SHAKE=SHA), not the is_bud flag; every other type stays created.
describe("the cryo routing list", () => {
  it("parses type=category pairs in his order, upper cased, a bare type reading as itself", () => {
    const map = parseCryoTypeCategories("BUD=BUD,SMALLS=WPR,SHAKE=SHA");
    expect([...map.entries()]).toEqual([["BUD", "BUD"], ["SMALLS", "WPR"], ["SHAKE", "SHA"]]);
    expect([...parseCryoTypeCategories(" bud , smalls=wpr, shake=sha, bud=X").entries()]).toEqual([["BUD", "BUD"], ["SMALLS", "WPR"], ["SHAKE", "SHA"]]);
    expect([...parseCryoTypeCategories(null).entries()]).toEqual(CRYO_TYPE_CATEGORIES_DEFAULT.map(([a, b]) => [a, b]));
    expect([...parseCryoTypeCategories("  ").entries()]).toEqual(CRYO_TYPE_CATEGORIES_DEFAULT.map(([a, b]) => [a, b]));
    expect([...parseCryoTypeCategories("BUD=BUD,PRE=PRE").keys()]).toEqual(["BUD", "PRE"]);
  });

  it("sends the listed types to the cryo queue and leaves the rest in created", () => {
    const map = parseCryoTypeCategories(null);
    expect(initialWipStatus("BUD", map)).toBe(WIP_STATUS.cryo_queue);
    expect(initialWipStatus("SMALLS", map)).toBe(WIP_STATUS.cryo_queue);
    expect(initialWipStatus("shake", map)).toBe(WIP_STATUS.cryo_queue);
    expect(initialWipStatus("TRIM", map)).toBe(WIP_STATUS.created);
    expect(initialWipStatus("BIO", map)).toBe(WIP_STATUS.created);
    expect(initialWipStatus("WASTE", map)).toBe(WIP_STATUS.created);
  });
});

describe("status transitions", () => {
  it("completes an open harvest batch", () => {
    expect(applyTransition("harvest_complete", "open")).toBe("complete");
  });

  it("marks a drying lot trimmed", () => {
    expect(applyTransition("lot_trimmed", "drying")).toBe("trimmed");
  });

  it("moves a cryo package into testing", () => {
    expect(applyTransition("cryo_weighed", "cryo_queue")).toBe("testing_queue");
  });

  it("releases a testing package", () => {
    expect(applyTransition("released", "testing_queue")).toBe("released");
  });

  it("rejects a transition from the wrong status", () => {
    expect(() => applyTransition("harvest_complete", "complete")).toThrow(/expected open/);
    expect(() => applyTransition("cryo_weighed", "created")).toThrow(/expected cryo_queue/);
    expect(() => applyTransition("released", "cryo_queue")).toThrow(/expected testing_queue/);
  });
});

describe("finish lot (owner ruling 2026-08-28)", () => {
  it("finishes a weighing lot to drying", () => {
    expect(applyTransition("lot_finished_drying", "weighing")).toBe("drying");
  });

  it("finishes a weighing lot to in_transit", () => {
    expect(applyTransition("lot_finished_in_transit", "weighing")).toBe("in_transit");
  });

  it("routes the finish by the destination kind: trucks in transit, the rest drying", () => {
    expect(finishTransitionName("truck")).toBe("lot_finished_in_transit");
    expect(finishTransitionName("silo")).toBe("lot_finished_drying");
    expect(finishTransitionName("hang")).toBe("lot_finished_drying");
  });

  it("rejects a finish from the wrong status", () => {
    expect(() => applyTransition("lot_finished_drying", "drying")).toThrow(/expected weighing/);
    expect(() => applyTransition("lot_finished_in_transit", "trimmed")).toThrow(
      /expected weighing/
    );
  });

  it("rejects finishing with zero non-voided weights as HTTP 400", () => {
    expect(() => assertLotHasWeights(0)).toThrow(HttpError);
    try {
      assertLotHasWeights(0);
    } catch (err) {
      expect((err as HttpError).status).toBe(400);
      expect((err as HttpError).message).toMatch(/at least one weight/);
    }
    expect(() => assertLotHasWeights(1)).not.toThrow();
  });

  it("keeps the trim transition on drying lots only", () => {
    expect(() => applyTransition("lot_trimmed", "weighing")).toThrow(/expected drying/);
    expect(() => applyTransition("lot_trimmed", "in_transit")).toThrow(/expected drying/);
  });
});

describe("unload transitions (owner ruling 2026-08-31)", () => {
  it("unloads a drying lot into the Unloaded Queue", () => {
    expect(applyTransition("lot_unloaded", "drying")).toBe("unloaded");
  });

  it("rejects an unload from any other status", () => {
    expect(() => applyTransition("lot_unloaded", "weighing")).toThrow(/expected drying/);
    expect(() => applyTransition("lot_unloaded", "in_transit")).toThrow(/expected drying/);
    expect(() => applyTransition("lot_unloaded", "unloaded")).toThrow(/expected drying/);
  });

  it("trims an unloaded lot through lot_trimmed_unloaded only", () => {
    expect(applyTransition("lot_trimmed_unloaded", "unloaded")).toBe("trimmed");
    expect(() => applyTransition("lot_trimmed_unloaded", "drying")).toThrow(/expected unloaded/);
    expect(() => applyTransition("lot_trimmed_unloaded", "weighing")).toThrow(/expected unloaded/);
  });

  it("keeps lot_trimmed as the Dry Space Queue's manual exit, drying only", () => {
    expect(applyTransition("lot_trimmed", "drying")).toBe("trimmed");
    expect(() => applyTransition("lot_trimmed", "unloaded")).toThrow(/expected drying/);
  });

  it("rejects finishing an unload with zero non-voided dry weights as HTTP 400", () => {
    expect(() => assertLotHasDryWeights(0)).toThrow(HttpError);
    try {
      assertLotHasDryWeights(0);
    } catch (err) {
      expect((err as HttpError).status).toBe(400);
      expect((err as HttpError).message).toMatch(/at least one dry weight/);
    }
    expect(() => assertLotHasDryWeights(1)).not.toThrow();
  });
});

describe("demote step (owner ruling 2026-09-02: [Demote] on the Data Queues)", () => {
  it("steps each status back along the inverted transition graph", () => {
    expect(demoteStep("harvest_batches", "complete")).toEqual({ to: "open" });
    expect(demoteStep("wet_weight_entries", "drying")).toEqual({ to: "weighing" });
    expect(demoteStep("wet_weight_entries", "in_transit")).toEqual({ to: "weighing" });
    expect(demoteStep("wet_weight_entries", "unloaded")).toEqual({ to: "drying" });
    expect(demoteStep("wip_packages", "testing_queue")).toEqual({ to: "cryo_queue" });
    expect(demoteStep("wip_packages", "released")).toEqual({ to: "testing_queue" });
  });

  it("gives birth statuses nothing to demote to", () => {
    expect(demoteStep("harvest_batches", "open")).toBeNull();
    expect(demoteStep("wet_weight_entries", "weighing")).toBeNull();
    expect(demoteStep("wip_packages", "created")).toBeNull();
    expect(demoteStep("wip_packages", "cryo_queue")).toBeNull();
  });

  it("surfaces trimmed's two sources for the history resolver", () => {
    const step = demoteStep("wet_weight_entries", "trimmed");
    expect(step && "candidates" in step && step.candidates.sort()).toEqual([
      "drying",
      "unloaded",
    ]);
  });

  it("declares the Demote control exactly on the queues whose status can step back", () => {
    for (const q of queues()) {
      const hasDemote = q.rowControls.some((c) => c.key === "demote");
      const step = demoteStep(q.entity, q.predicate.value);
      expect(hasDemote, `${q.key} demote control vs graph`).toBe(step !== null);
    }
  });
});

describe("short lot id (owner ruling 2026-09-01, alpha feedback)", () => {
  it("is always the last 5 of the HBN, tag or no tag", () => {
    expect(shortLotId("26244-ARL-GH-027-0-NA-26002", "1A4000000000000000A4B7C9")).toBe("26002");
    expect(shortLotId("26244-ARL-GH-027-0-NA-26002", null)).toBe("26002");
    expect(shortLotId("26244-ARL-GH-027-0-NA-26002", "")).toBe("26002");
  });

  it("keeps an HBN shorter than 5 characters whole", () => {
    expect(shortLotId("26002", null)).toBe("26002");
    expect(shortLotId("002", "B7C9")).toBe("002");
  });

  it("computes the same law in SQL against the b alias", () => {
    expect(SHORT_LOT_ID_SQL).toBe("substr(b.hbn, -5)");
  });
});

describe("traveler lot id (owner ruling 2026-08-31, parked for traveler printing)", () => {
  it("joins the HBN serial and the METRC tag tail with a slash", () => {
    expect(travelerLotId("26244-ARL-GH-027-0-NA-26002", "1A4000000000000000A4B7C9")).toBe(
      "26002/A4B7C9"
    );
  });

  it("renders just the serial when the tag is absent or blank after trimming", () => {
    expect(travelerLotId("26244-ARL-GH-027-0-NA-26002", null)).toBe("26002");
    expect(travelerLotId("26244-ARL-GH-027-0-NA-26002", "   ")).toBe("26002");
  });

  it("keeps a tag shorter than 6 characters whole", () => {
    expect(travelerLotId("26244-ARL-GH-027-0-NA-26002", "B7C9")).toBe("26002/B7C9");
  });
});

describe("move to kinds (owner ruling 2026-08-28; THE BLANK SLATE, canon 0.30.108)", () => {
  // Owner, 2026-09-17: "assume everything that get's entered into wet weights
  // is landing in PNN's barn location." Every farm's Move To is the landing
  // site's silos and rooms; the trucks left the list.
  it("offers every farm the landing site's silos and rooms, never a truck", () => {
    expect(moveToKindsForFarm("ARL")).toEqual(["silo", "hang"]);
    expect(moveToKindsForFarm("PNS")).toEqual(["silo", "hang"]);
    expect(moveToKindsForFarm("PNN")).toEqual(["silo", "hang"]);
    expect(moveToKindsForFarm("XYZ")).toEqual(["silo", "hang"]);
    expect(LANDING_FARM).toBe("PNN");
    expect(LANDING_MOVE_TO_KINDS).not.toContain("truck");
    // The truck kind itself survives for the records that carry it.
    expect(DRY_SPACE_KINDS).toContain("truck");
  });
});

describe("dry space farm scoping (owner ruling 2026-08-28)", () => {
  // Fixture rows mirror the seed after 0049, in name order like the query.
  // Owner ruling 2026-08-31: truck-kind rows never stand in the catalog; the
  // sentinel 'Truck' row backs truck lots but must never render as an option.
  // THE HARVEST CONSOLE (canon 0.30.73): the Arlington Dry Room is a silo at
  // ARL and the five PNN silos carry farm PNN, so ARL's new silo kind offers
  // ARL its own room and never PNN's silos.
  const rows: DrySpaceOptionRow[] = [
    { value: "ds6", label: "Arlington Dry Room", kind: "silo", farm_code: "ARL" },
    { value: "ds7", label: "Hang in Place", kind: "hang", farm_code: "PNN" },
    { value: "ds1", label: "Silo 1", kind: "silo", farm_code: "PNN" },
    { value: TRUCK_DRY_SPACE_ID, label: "Truck", kind: "truck", farm_code: null },
  ];
  const labelsFor = (farm: string) =>
    filterDrySpaces(rows, moveToKindsForFarm(farm), farm).map((o) => o.label);

  it("ARL sees its dry room only (a silo now), not Hang in Place, PNN's silos, or the truck sentinel", () => {
    expect(labelsFor("ARL")).toEqual(["Arlington Dry Room"]);
  });

  it("PNN sees silos and Hang in Place, not the Arlington Dry Room or the sentinel", () => {
    expect(labelsFor("PNN")).toEqual(["Hang in Place", "Silo 1"]);
  });

  it("PNS is truck-only, so it sees no standing options at all", () => {
    expect(labelsFor("PNS")).toEqual([]);
  });

  it("drops kind truck even when the farm law allows it", () => {
    expect(filterDrySpaces(rows, ["truck"], "ARL")).toEqual([]);
  });
});

describe("pane filter no_finished_lot (owner ruling 2026-08-28; THE HBN THAT CAME BACK, canon 0.30.84)", () => {
  it("hides a batch with a non-voided finished lot: finished is every status but weighing, unloaded included", () => {
    expect(NO_FINISHED_LOT_SQL).toContain("NOT EXISTS");
    expect(NO_FINISHED_LOT_SQL).toContain("wet_weight_entries");
    expect(NO_FINISHED_LOT_SQL).toContain("w.harvest_batch_id = b.id");
    expect(NO_FINISHED_LOT_SQL).toContain("w.deleted_at IS NULL");
    expect(NO_FINISHED_LOT_SQL).toContain("w.status <> 'weighing'");
    // The 2026-08-28 spelling (drying, in_transit, trimmed) predated the Unloaded
    // Queue and let an unloaded lot's HBN back into the pane.
    expect(NO_FINISHED_LOT_SQL).not.toContain("IN ('drying'");
    for (const status of Object.values(LOT_STATUS)) {
      if (status === LOT_STATUS.weighing) continue;
      // Every finished status is covered by the one inequality, none listed by hand.
      expect(NO_FINISHED_LOT_SQL).not.toContain(`'${status}'`);
    }
  });

  it("keeps a batch with a weighing lot visible for resume, even beside a finished lot", () => {
    expect(NO_FINISHED_LOT_SQL).toContain("OR EXISTS");
    expect(NO_FINISHED_LOT_SQL).toContain("w2.harvest_batch_id = b.id");
    expect(NO_FINISHED_LOT_SQL).toContain("w2.deleted_at IS NULL");
    expect(NO_FINISHED_LOT_SQL).toContain("w2.status = 'weighing'");
  });
});

describe("pending uploads law (owner ruling 2026-08-31)", () => {
  it("pends a batch on non-voided lots whose status is not weighing", () => {
    expect(PENDING_WET_UPLOADS_SQL).toContain("w.deleted_at IS NULL");
    expect(PENDING_WET_UPLOADS_SQL).toContain("w.status <> 'weighing'");
    expect(PENDING_WET_UPLOADS_SQL).toContain("b.deleted_at IS NULL");
  });

  it("pends a finished load until its own mark, and a batch mark covers loads created before it", () => {
    expect(PENDING_WET_UPLOADS_SQL).toContain("u.ref_id = w.id");
    expect(PENDING_WET_UPLOADS_SQL).toContain("u.ref_id IS NULL AND w.created_at < u.uploaded_at");
    expect(PENDING_WET_UPLOADS_SQL).toContain("u.kind = 'wet_weights'");
    expect(PENDING_WET_UPLOADS_SQL).toContain("w.status <> 'weighing'");
    expect(PENDING_WET_UPLOADS_SQL).toContain("COALESCE(w.harvest_file_seq,");
    expect(PENDING_WET_UPLOADS_SQL).toContain("wseq.created_at < w.created_at");
    expect(PENDING_WET_UPLOADS_SQL).toContain("b.lot_serial");
  });
});

describe("lot total helper (owner ruling 2026-08-28)", () => {
  it("sums whole grams exactly", () => {
    expect(sumGrams([1000.06, 234.5])).toBe(1235);
    expect(sumGrams([0.1, 0.2])).toBe(0);
    expect(sumGrams([])).toBe(0);
  });
});

describe("gram display formatting (owner ruling 2026-09-21: whole grams, thousands grouped)", () => {
  it("groups thousands and drops decimals, round half up", () => {
    expect(formatGrams(1234.5)).toBe("1,235");
    expect(formatGrams(1734.56)).toBe("1,735");
    expect(formatGrams(12.5)).toBe("13");
    expect(formatGrams(0)).toBe("0");
    expect(formatGrams(999.994)).toBe("1,000");
    expect(formatGrams(1234.56)).toBe("1,235");
  });

  it("reads a million as 1,000,000, never a barcode", () => {
    expect(formatGrams(1000000)).toBe("1,000,000");
    expect(formatGrams(1234567.89)).toBe("1,234,568");
  });

  it("accepts the string values queue rows carry", () => {
    expect(formatGrams("1234.56")).toBe("1,235");
    expect(formatGrams("751")).toBe("751");
    expect(formatGrams("1000")).toBe("1,000");
  });

  it("passes blank and non-numeric input through as its existing render", () => {
    expect(formatGrams(null)).toBe("");
    expect(formatGrams(undefined)).toBe("");
    expect(formatGrams("")).toBe("");
    expect(formatGrams("   ")).toBe("");
    expect(formatGrams("abc")).toBe("abc");
    expect(formatGrams(NaN)).toBe("NaN");
  });

  it("groups negative numbers correctly", () => {
    expect(formatGrams(-1234.5)).toBe("-1,235");
    expect(formatGrams(-12.5)).toBe("-13");
    expect(formatGrams(-1000000)).toBe("-1,000,000");
  });

  it("names every gram field once, dry_weight_grams included", () => {
    expect([...GRAM_FIELDS].sort()).toEqual([
      "batch_weight_grams",
      "cryo_weight_grams",
      "dry_weight_grams",
      "net_weight_grams",
      "qty",
      "qty_grams",
      "weight_grams",
      "wet_spear_weight_grams",
    ]);
  });
});

describe("projected dry yield config (inventory node 2026-09-01)", () => {
  it("reads the stored percent and falls back to 22", () => {
    expect(projectedDryYieldPct("22")).toBe(22);
    expect(projectedDryYieldPct("30")).toBe(30);
    expect(projectedDryYieldPct(null)).toBe(22);
    expect(projectedDryYieldPct("nope")).toBe(22);
  });
});

describe("extraction type codes (owner ruling 2026-09-01: Trim and BIO only)", () => {
  it("parses the seeded list", () => {
    expect(parseExtractionCodes("TRIM,BIO")).toEqual(["TRIM", "BIO"]);
  });

  it("trims, drops blanks, and dedupes, first occurrence winning", () => {
    expect(parseExtractionCodes(" TRIM , BIO ,, TRIM ,")).toEqual(["TRIM", "BIO"]);
    expect(parseExtractionCodes("BIO,TRIM,BIO")).toEqual(["BIO", "TRIM"]);
  });

  it("falls back to TRIM,BIO on a missing or blank value", () => {
    expect(parseExtractionCodes(null)).toEqual(["TRIM", "BIO"]);
    expect(parseExtractionCodes("")).toEqual(["TRIM", "BIO"]);
    expect(parseExtractionCodes("   ")).toEqual(["TRIM", "BIO"]);
    // A list that parses to nothing is blank in effect and must not build an
    // empty IN () clause.
    expect(parseExtractionCodes(",, ,")).toEqual(["TRIM", "BIO"]);
  });

  it("accepts a different ruled list as-is", () => {
    expect(parseExtractionCodes("TRIM")).toEqual(["TRIM"]);
    expect(parseExtractionCodes("TRIM,BIO,SHAKE")).toEqual(["TRIM", "BIO", "SHAKE"]);
  });
});

describe("extraction pool law (owner ruling 2026-09-01: Trim and BIO only)", () => {
  it("keys created packages on the configured codes with bound placeholders", () => {
    const sql = extractionBoundSql(2);
    expect(sql).toContain("p.deleted_at IS NULL");
    expect(sql).toContain("p.status = 'created'");
    expect(sql).toContain("p.package_type_code IN (?, ?)");
    expect(extractionBoundSql(1)).toContain("IN (?)");
    expect(extractionBoundSql(3)).toContain("IN (?, ?, ?)");
  });

  it("never interpolates the codes and no longer keys on is_bud", () => {
    const sql = extractionBoundSql(2);
    expect(sql).not.toContain("is_bud");
    expect(sql).not.toContain("TRIM");
    expect(sql).not.toContain("BIO");
  });
});

describe("plant split jitter config (owner ruling 2026-08-31: the Plant fill rule)", () => {
  it("reads the stored percent", () => {
    expect(plantSplitJitterPct("10")).toBe(10);
    expect(plantSplitJitterPct("25")).toBe(25);
    expect(plantSplitJitterPct("0")).toBe(0);
    expect(plantSplitJitterPct("7.5")).toBe(7.5);
  });

  it("falls back to 10 on a missing, blank, or malformed value", () => {
    expect(plantSplitJitterPct(null)).toBe(10);
    expect(plantSplitJitterPct("")).toBe(10);
    expect(plantSplitJitterPct("   ")).toBe(10);
    expect(plantSplitJitterPct("abc")).toBe(10);
    expect(plantSplitJitterPct("-5")).toBe(10);
  });
});

describe("truck numbering (owner ruling 2026-08-31)", () => {
  it("starts a batch with no trucks at 1", () => {
    expect(nextTruckNumber([])).toBe(1);
  });

  it("numbers the next truck one past the highest taken on the batch", () => {
    expect(nextTruckNumber(["1", "2"])).toBe(3);
    expect(nextTruckNumber([1, 2])).toBe(3);
  });

  it("counts past gaps, never back into them", () => {
    expect(nextTruckNumber(["1", "3"])).toBe(4);
  });

  it("lets a staged number beat the derived list", () => {
    expect(nextTruckNumber(["1", "2", "5"])).toBe(6);
  });

  it("ignores values that are not positive integers", () => {
    expect(nextTruckNumber(["", "abc", "0", "-2", "1.5"])).toBe(1);
  });
});

describe("truck pick encoding (owner ruling 2026-08-31)", () => {
  it("accepts truck-1 through truck-999 and returns the digits", () => {
    expect(truckNumberFromPick("truck-1")).toBe("1");
    expect(truckNumberFromPick("truck-42")).toBe("42");
    expect(truckNumberFromPick("truck-999")).toBe("999");
  });

  it("rejects truck-0, truck-, truck-1000, leading zeros, and stray text", () => {
    expect(truckNumberFromPick("truck-0")).toBeNull();
    expect(truckNumberFromPick("truck-")).toBeNull();
    expect(truckNumberFromPick("truck-1000")).toBeNull();
    expect(truckNumberFromPick("truck-01")).toBeNull();
    expect(truckNumberFromPick("truck-1x")).toBeNull();
    expect(truckNumberFromPick("xtruck-1")).toBeNull();
  });

  it("rejects the bare sentinel id and real dry space ids", () => {
    expect(truckNumberFromPick(TRUCK_DRY_SPACE_ID)).toBeNull();
    expect(truckNumberFromPick("a1000001-0001-4000-8000-000000000001")).toBeNull();
  });
});

describe("inbound trucks on receiving (owner bug report 2026-09-04, canon 0.22.0)", () => {
  it("lists in-transit truck lots headed Truck N with the simple form, linking to the lot", async () => {
    const { intercoReceivingPage } = await import("../src/html");
    const html = intercoReceivingPage("en", {
      movements: [],
      truckLots: [
        {
          id: "lot-t1",
          truck_number: "1",
          weight_grams: 12345.67,
          farm_code: "ARL",
          entry_date: "2026-09-04",
          strain_name: "After Party",
          hbn: "26247-ARL-GH-099-0-NA-26009",
        },
      ],
      receipts: [],
      movementItems: {},
      licenses: [],
    });
    expect(html).toContain("Inbound trucks");
    expect(html).toContain("<strong>Truck 1</strong> - ARL/After Party/2026-09-04 - 12,346 g");
    expect(html).toContain('href="/station/wet_weight?lot=lot-t1"');
  });

  it("the C10 vendors page carries the partners, the slider, and the PM link (canon 0.29.0)", async () => {
    const { vendorsEquipmentPage } = await import("../src/equipment");
    const html = vendorsEquipmentPage();
    for (const p of ["Athena", "VIST", "Twister", "T1 Logistics"]) {
      expect(html).toContain(p);
    }
    expect(html).toContain("Strategic Partners");
    expect(html).toContain('class="shots"');
    expect(html).toContain('href="/equipment"');
    expect(html).not.toContain("Equipment ROI");
    // Owner ruling 2026-09-08 (canon 0.30.12): no name headings on the vendor
    // blurbs; the logo leads (VIST's file is vendored), a plain wordmark holds
    // the slot until the other logos land.
    for (const p of ["Athena", "VIST", "Twister", "T1 Logistics"]) {
      expect(html).not.toContain(`<h3>${p}</h3>`);
    }
    expect(html).toContain('<img class="vendor-logo" src="/continuum/logo-vist.png" alt="VIST logo"');
    // Canon 0.30.14: the Twister logo landed (a jpg, vendored as supplied).
    expect(html).toContain('<img class="vendor-logo" src="/continuum/logo-twister.jpg" alt="Twister logo"');
    // Canon 0.30.22: the T1 mark landed ("For T1"); Athena's wordmark is the last one holding.
    expect(html).toContain('<img class="vendor-logo" src="/continuum/logo-t1-logistics.png" alt="T1 Logistics logo"');
    expect((html.match(/data-wordmark/g) || []).length).toBe(1);
    // C10 formatting: Palatino display and, since 0.30.12, the inverted ink ground.
    expect(html).toContain("Palatino");
    expect(html).toContain("--bg: #14120e");
    expect(html).toContain("--text: #f1ede4");
    expect(html).not.toContain("#f6f4ef");
    expect(html).toContain('<meta name="color-scheme" content="dark">');
  });

  it("the C10 compliance testing page carries the lanes, the slider, and the console links (canon 0.29.5)", async () => {
    const { complianceTestingPage } = await import("../src/equipment");
    const html = complianceTestingPage();
    expect(html).toContain("Compliance Testing");
    expect(html).toContain("The test is the gate");
    expect(html).toContain("External: the state lab");
    expect(html).toContain("Internal: we test first");
    expect(html).toContain("Orange Photonics");
    expect(html).toContain("Aqualab");
    expect(html).toContain('class="shots"');
    expect(html).toContain("/continuum/ct-1.png");
    expect(html).toContain("/continuum/ct-4.png");
    expect(html).toContain('href="/compliance"');
    expect(html).toContain("Open the Compliance Console");
    // C10 formatting: Palatino display and, since 0.30.12, the inverted ink ground.
    expect(html).toContain("Palatino");
    expect(html).toContain("--bg: #14120e");
    expect(html).not.toContain("#f6f4ef");
  });

  it("Admin carries the four Continuum tiles (canon 0.29.0 + 0.29.5 + 0.30.27) and the Harvest Console button (canon 0.30.73)", async () => {
    const { adminHomePage } = await import("../src/html");
    const html = adminHomePage("en");
    expect(html).toContain('href="/vendors-equipment"');
    expect(html).toContain('href="/erp-software"');
    expect(html).toContain('href="/compliance-testing"');
    // Canon 0.30.27: "I need this entire app hosted on a button in Admin".
    // Canon 0.30.73 (his pick "New page, old tile renamed"): the vendored
    // planting app keeps its own name, Harvest Console Lite.
    expect(html).toContain('href="/harvest-console"');
    expect(html).toContain('<span class="tile-kind">Continuum</span>\n        <span class="tile-title">Harvest Console Lite</span>');
    // Canon 0.30.73: "In Admin, add a new button: [Harvest Console]".
    expect(html).toContain('<a class="tile" href="/harvest">');
    expect(html).toContain('<span class="tile-kind">Harvest</span>\n        <span class="tile-title">Harvest Console</span>');
    expect(html.indexOf('href="/harvest"')).toBeLessThan(html.indexOf('href="/vendors-equipment"'));
    expect(adminHomePage("es")).toContain("Harvest Console Lite");
  });

  it("the Harvest Console node is the app alone, wearing the inverted Continuum (canon 0.30.30)", async () => {
    const equipment = await import("../src/equipment");
    const { HARVEST_CONSOLE_PATH, HARVEST_CONSOLE_LEGACY_APP_PATH, HARVEST_CONSOLE_INVERTED_SKIN, skinHarvestConsole, C10_INVERTED_TOKENS } = equipment;
    // Owner rulings 2026-09-09 with his pictures: "Remove all of this, make the
    // CSS match the inverted continuum" (crumb, masthead, rule, lede) and
    // "Remove this" (the Tools pill). No shell page function survives.
    expect((equipment as Record<string, unknown>).harvestConsolePage).toBeUndefined();
    expect(HARVEST_CONSOLE_PATH).toBe("/harvest-console");
    expect(HARVEST_CONSOLE_LEGACY_APP_PATH).toBe("/harvest-console/app");
    // The skin fills the app's own token slots with the inverted shell's values,
    // slot for slot along the app's CONTINUUM10-THEME mapping.
    const pairs: Array<[string, string]> = [
      ["--panel: #1e1b16", "--surface: #1e1b16"],
      ["--panel-2: #27231c", "--surface-2: #27231c"],
      ["--accent: #d19a4e", "--primary: #d19a4e"],
      ["--accent-2: #e5b673", "--primary-strong: #e5b673"],
      ["--accent-3: #e5b673", "--primary-strong: #e5b673"],
      ["--text: #f1ede4", "--text: #f1ede4"],
      ["--text-mute: #a79f8f", "--muted: #a79f8f"],
      ["--alert: #e0785c", "--alert: #e0785c"],
      ["--alert-soft: rgba(224, 120, 92, 0.18)", "--alert-soft: rgba(224, 120, 92, 0.18)"],
      ["--accent-soft: rgba(209, 154, 78, 0.16)", "--primary-soft: rgba(209, 154, 78, 0.16)"],
      ["--shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 16px 32px -20px rgba(0, 0, 0, 0.85)", "--shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 16px 32px -20px rgba(0, 0, 0, 0.85)"],
    ];
    expect(HARVEST_CONSOLE_INVERTED_SKIN).toContain("--bg: #14120e");
    expect(C10_INVERTED_TOKENS).toContain("--bg: #14120e");
    for (const [slot, token] of pairs) {
      expect(HARVEST_CONSOLE_INVERTED_SKIN).toContain(slot);
      expect(C10_INVERTED_TOKENS).toContain(token);
    }
    // The shell's diagonal rule on the app's body, so the grounds read as one.
    expect(HARVEST_CONSOLE_INVERTED_SKIN).toContain("repeating-linear-gradient(115deg, rgba(209,154,78,0.06) 0 1px, transparent 1px 84px)");
    // The app's operational status colors stay its own (its mapping doc keeps
    // amber, danger and ok as status, not brand); the skin never touches them.
    for (const kept of ["--amber", "--danger", "--ok", "--y-2023", "--font"]) {
      expect(HARVEST_CONSOLE_INVERTED_SKIN).not.toContain(`${kept}:`);
    }
    expect(HARVEST_CONSOLE_INVERTED_SKIN.startsWith('<style id="gf-c10-inverted-skin">')).toBe(true);
    // The splice: once, before the closing head tag, everything else byte-identical.
    const doc = "<!doctype html><html><head><title>Harvest Console Lite v0.11</title><style>:root{--bg:#0e0f11}</style></head><body>$& $1 ${x}</body></html>";
    const skinned = skinHarvestConsole(doc);
    const at = doc.indexOf("</head>");
    expect(skinned).toBe(doc.slice(0, at) + HARVEST_CONSOLE_INVERTED_SKIN + doc.slice(at));
    expect((skinned.match(/gf-c10-inverted-skin/g) || []).length).toBe(1);
    expect(skinned).toContain("$& $1 ${x}");
    // A document with no head streams unchanged.
    expect(skinHarvestConsole("<p>bare</p>")).toBe("<p>bare</p>");
  });

  it("the Harvest Console screen carries the Back to the Continuum 10 crumb in its own header bar (canon 0.30.32)", async () => {
    // Owner ruling 2026-09-09, verbatim: "Add "back to continuum" link to the
    // harvest console lite screen". Spliced at serve time beside the app's
    // brand, before the spacer; the vendored file itself never changes.
    const { HARVEST_CONSOLE_CRUMB, HARVEST_CONSOLE_INVERTED_SKIN, skinHarvestConsole, complianceTestingPage } = await import("../src/equipment");
    const { CONTINUUM_HOME_URL } = await import("../src/html");
    expect(HARVEST_CONSOLE_CRUMB).toContain(`href="${CONTINUUM_HOME_URL}">&#8592; Back to the Continuum 10</a>`);
    // Same words, arrow and destination as the sibling pages' crumb.
    expect(complianceTestingPage()).toContain(`href="${CONTINUUM_HOME_URL}">&#8592; Back to the Continuum 10</a>`);
    expect(HARVEST_CONSOLE_INVERTED_SKIN).toContain(".gf-continuum-crumb {");
    const header = '<header id="lt-chrome">\n  <div class="brand"><span class="grp">Harvest Console Lite</span></div>\n  <div class="spacer"></div>\n  <div id="zoomPill" class="pill"></div>\n</header>';
    const doc = `<!doctype html><html><head><title>Harvest Console Lite v0.11</title></head><body>${header}<main><div class="spacer"></div></main></body></html>`;
    const out = skinHarvestConsole(doc);
    // Once, inside the header, right before its spacer; the main's own spacer untouched.
    expect((out.match(/id="gf-continuum-crumb"/g) || []).length).toBe(1);
    const crumbAt = out.indexOf('<a id="gf-continuum-crumb"');
    expect(crumbAt).toBeGreaterThan(out.indexOf('<div class="brand">'));
    expect(crumbAt).toBeLessThan(out.indexOf('<div class="spacer"></div>'));
    expect(crumbAt).toBeLessThan(out.indexOf("</header>"));
    expect(out.slice(crumbAt).startsWith(HARVEST_CONSOLE_CRUMB + '<div class="spacer"></div>')).toBe(true);
    // Lift the two splices out and the document is the original, byte for byte.
    expect(out.replace(HARVEST_CONSOLE_INVERTED_SKIN, "").replace(HARVEST_CONSOLE_CRUMB, "")).toBe(doc);
    // No header bar, no crumb; the skin still lands.
    const bare = "<html><head></head><body><div class=\"spacer\"></div></body></html>";
    expect(skinHarvestConsole(bare)).not.toContain('id="gf-continuum-crumb"');
    expect(skinHarvestConsole(bare)).toContain("gf-c10-inverted-skin");
  });

  it("the PM home lists assets with serials and hand-signed law (canon 0.29.0)", async () => {
    const { equipmentHomePage, nextDueFrom, dueLabel } = await import("../src/equipment");
    expect(nextDueFrom("2026-09-01", 30)).toBe("2026-10-01");
    expect(nextDueFrom(null, 30)).toBe("now");
    expect(dueLabel("2026-08-01", "2026-09-07")).toBe("OVERDUE. It remembers.");
    expect(dueLabel("2026-10-01", "2026-09-07")).toBe("2026-10-01");
    const html = equipmentHomePage(
      [
        { id: "a1", serial: "GF-EQ-0001", name: "T-Zero", farm_code: "PNN", notes: null, open_tickets: 1 },
        { id: "a2", serial: "GF-EQ-0008", name: "Gator 1", farm_code: "PNN", notes: null, open_tickets: 0 },
      ],
      [
        { id: "s1", asset_id: "a1", task: "Tune up and blade inspection", interval_days: 30, last_done: "2026-06-01" },
        { id: "s2", asset_id: "a2", task: "Oil, filters, and grease", interval_days: 90, last_done: "2026-09-01" },
      ],
      "2026-09-07"
    );
    expect(html).toContain("GF-EQ-0001");
    expect(html).toContain("1 open");
    expect(html).toContain("OVERDUE. It remembers.");
    expect(html).toContain("2026-11-30");
  });

  it("a truck line carries the one-button receive, no space pick (canon 0.28.4 + 0.28.6)", async () => {
    const { intercoReceivingPage } = await import("../src/html");
    const html = intercoReceivingPage("en", {
      movements: [],
      truckLots: [
        {
          id: "lot-r1",
          truck_number: "1",
          weight_grams: 500,
          farm_code: "ARL",
          entry_date: "2026-09-01",
          strain_name: "Fruity Pebbles",
          hbn: null,
          material_form: "spear",
        },
        {
          id: "lot-r2",
          truck_number: "2",
          weight_grams: 300,
          farm_code: "ARL",
          entry_date: "2026-09-01",
          strain_name: "Fruity Pebbles",
          hbn: null,
          material_form: "bucked",
        },
      ],
      receipts: [],
      movementItems: {},
      licenses: [],
      site: "pnn",
    });
    expect(html).toContain('action="/interco/arrivals/pnn/receive-truck"');
    expect(html).toContain('name="lot_id" value="lot-r1"');
    expect(html).toContain(">Receive</button>");
    // The inbox is always barn: no space select rides the receive.
    expect(html).not.toContain('name="dry_space_id"');
    // Owner ruling 2026-09-07 (canon 0.29.1): the receive stops asking; the
    // toggle lives on the wet weight entry screen and the line shows the lot's
    // form beside the one button.
    expect(html).not.toContain('name="material_form"');
    expect(html).toContain('data-material-form>Spear</span>');
    expect(html).toContain('data-material-form>Bucked</span>');
    // The lot link stays for inspection; the form is the action.
    expect(html).toContain('href="/station/wet_weight?lot=lot-r1"');
  });

  it("shows the honest empty state when no trucks ride (canon 0.27.6: one EMPTY line)", async () => {
    const { intercoReceivingPage } = await import("../src/html");
    const html = intercoReceivingPage("en", {
      movements: [],
      truckLots: [],
      receipts: [],
      movementItems: {},
      licenses: [],
    });
    expect(html).toContain("- EMPTY -");
    expect(html).not.toContain("No trucks on the road.");
  });
});


describe("THE FFZ CUBE READS THE MIRROR (canon 0.30.75): the fresh frozen item kinds are data", async () => {
  const { parseFfzItemKinds } = await import("../src/config");
  it("parses the app_config comma list, uppercased and deduped, FFZ when blank", () => {
    expect(parseFfzItemKinds("FFZ")).toEqual(["FFZ"]);
    expect(parseFfzItemKinds(" ffz , Fresh Frozen,FFZ ")).toEqual(["FFZ", "FRESH FROZEN"]);
    expect(parseFfzItemKinds("")).toEqual(["FFZ"]);
    expect(parseFfzItemKinds(null)).toEqual(["FFZ"]);
    expect(parseFfzItemKinds(" , ")).toEqual(["FFZ"]);
  });
});

describe("THE LOCATION WITHOUT THE FARM (canon 0.30.82; owner: CSVs shouldn't contain the farm name in the locations)", async () => {
  const { metrcLocationName, LOC_ARL_BARN, LOC_PNS_BARN, LOC_BARN } = await import("../src/config");
  const { locationChangeCsv } = await import("../src/interco");
  const { plantLocationChangeCsv } = await import("../src/locations");
  it("drops a leading farm code from a location bound for METRC and leaves every other name alone", () => {
    expect(metrcLocationName(LOC_ARL_BARN)).toBe("BARN");
    expect(metrcLocationName(LOC_PNS_BARN)).toBe("BARN");
    expect(metrcLocationName(LOC_BARN)).toBe("BARN");
    expect(metrcLocationName("PNN BARN")).toBe("BARN");
    expect(metrcLocationName("pnn barn")).toBe("barn");
    expect(metrcLocationName("Silo 3")).toBe("Silo 3");
    expect(metrcLocationName("Arlington Dry Room")).toBe("Arlington Dry Room");
    expect(metrcLocationName("Blast Freezer")).toBe("Blast Freezer");
    expect(metrcLocationName("CSB")).toBe("CSB");
    expect(metrcLocationName("PNN")).toBe("PNN");
    expect(metrcLocationName("")).toBe("");
    expect(metrcLocationName(null)).toBe("");
  });
  it("the location-change files carry the METRC name", () => {
    expect(locationChangeCsv([{ label: "1A4050300000000000000E02", location: "ARL BARN", moveDate: "2026-09-15" }])).toContain("1A4050300000000000000E02,BARN,,2026-09-15");
    expect(locationChangeCsv([{ label: "X", location: "Silo 4", moveDate: "2026-09-15" }])).toContain("X,Silo 4,,2026-09-15");
    expect(plantLocationChangeCsv([{ tag: "1A4050000000000000000101", location: "PNS BARN", changeDate: "2026-09-15" }])).toContain("1A4050000000000000000101,BARN,,2026-09-15");
  });
});
