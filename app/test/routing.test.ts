import { describe, expect, it } from "vitest";
import {
  applyTransition,
  DRY_SPACE_KINDS,
  finishTransitionName,
  initialWipStatus,
  moveToKindsForFarm,
  nextTruckNumber,
  sumGrams,
  WIP_STATUS,
} from "../src/config";
import { assertLotHasWeights } from "../src/actions";
import { HttpError } from "../src/audit";
import { filterDrySpaces, NO_FINISHED_LOT_SQL, type DrySpaceOptionRow } from "../src/db";

describe("is_bud routing", () => {
  it("sends bud types to the cryo queue", () => {
    expect(initialWipStatus(1)).toBe(WIP_STATUS.cryo_queue);
  });

  it("leaves non-bud types in created", () => {
    expect(initialWipStatus(0)).toBe(WIP_STATUS.created);
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

describe("move to kinds by farm (owner ruling 2026-08-28)", () => {
  it("filters ARL to hang and truck", () => {
    expect(moveToKindsForFarm("ARL")).toEqual(["hang", "truck"]);
  });

  it("filters PNS to truck only", () => {
    expect(moveToKindsForFarm("PNS")).toEqual(["truck"]);
  });

  it("filters PNN to silo, truck, and hang", () => {
    expect(moveToKindsForFarm("PNN")).toEqual(["silo", "truck", "hang"]);
  });

  it("falls back to all kinds for an unknown farm", () => {
    expect(moveToKindsForFarm("XYZ")).toEqual([...DRY_SPACE_KINDS]);
    expect(DRY_SPACE_KINDS).toContain("truck");
  });
});

describe("dry space farm scoping (owner ruling 2026-08-28)", () => {
  // Fixture rows mirror the seed after 0007, in name order like the query.
  const rows: DrySpaceOptionRow[] = [
    { value: "ds6", label: "Arlington Dry Room", kind: "hang", farm_code: "ARL" },
    { value: "ds7", label: "Hang in Place", kind: "hang", farm_code: "PNN" },
    { value: "ds1", label: "Silo 1", kind: "silo", farm_code: null },
    { value: "ds8", label: "Truck 1", kind: "truck", farm_code: null },
  ];
  const labelsFor = (farm: string) =>
    filterDrySpaces(rows, moveToKindsForFarm(farm), farm).map((o) => o.label);

  it("ARL sees its dry room and shared trucks, not Hang in Place or silos", () => {
    expect(labelsFor("ARL")).toEqual(["Arlington Dry Room", "Truck 1"]);
  });

  it("PNN sees silos, trucks, and Hang in Place, not the Arlington Dry Room", () => {
    expect(labelsFor("PNN")).toEqual(["Hang in Place", "Silo 1", "Truck 1"]);
  });

  it("PNS sees shared trucks only", () => {
    expect(labelsFor("PNS")).toEqual(["Truck 1"]);
  });
});

describe("pane filter no_finished_lot (owner ruling 2026-08-28)", () => {
  it("hides a batch with a non-voided finished lot via NOT EXISTS over the three finished statuses", () => {
    expect(NO_FINISHED_LOT_SQL).toContain("NOT EXISTS");
    expect(NO_FINISHED_LOT_SQL).toContain("wet_weight_entries");
    expect(NO_FINISHED_LOT_SQL).toContain("w.harvest_batch_id = b.id");
    expect(NO_FINISHED_LOT_SQL).toContain("w.deleted_at IS NULL");
    expect(NO_FINISHED_LOT_SQL).toContain("'drying'");
    expect(NO_FINISHED_LOT_SQL).toContain("'in_transit'");
    expect(NO_FINISHED_LOT_SQL).toContain("'trimmed'");
  });

  it("keeps a batch with only a weighing lot visible for resume", () => {
    expect(NO_FINISHED_LOT_SQL).not.toContain("'weighing'");
  });
});

describe("lot total helper (owner ruling 2026-08-28)", () => {
  it("sums 2-decimal grams exactly", () => {
    expect(sumGrams([1000.06, 234.5])).toBe(1234.56);
    expect(sumGrams([0.1, 0.2])).toBe(0.3);
    expect(sumGrams([])).toBe(0);
  });
});

describe("truck numbering (owner ruling 2026-08-28)", () => {
  it("numbers the next truck one past the highest taken", () => {
    expect(nextTruckNumber([])).toBe(1);
    expect(nextTruckNumber(["Truck 1", "Truck 2"])).toBe(3);
    expect(nextTruckNumber(["Truck 9", "Silo 1", "Truck 12"])).toBe(13);
    expect(nextTruckNumber(["Truckasaurus"])).toBe(1);
  });
});
