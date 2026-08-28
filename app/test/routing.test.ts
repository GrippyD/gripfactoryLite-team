import { describe, expect, it } from "vitest";
import { applyTransition, initialWipStatus, WIP_STATUS } from "../src/config";

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
