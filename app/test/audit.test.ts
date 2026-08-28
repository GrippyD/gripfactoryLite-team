import { describe, expect, it } from "vitest";
import { HttpError, requireReason } from "../src/audit";

describe("edit without reason", () => {
  it("rejects a missing reason with HTTP 400", () => {
    expect(() => requireReason("")).toThrow(HttpError);
    try {
      requireReason("");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
      expect((err as HttpError).message).toMatch(/Reason is required/);
    }
  });

  it("rejects whitespace-only reason", () => {
    expect(() => requireReason("   ")).toThrow(HttpError);
  });

  it("accepts a nonempty reason", () => {
    expect(requireReason("typo in zone")).toBe("typo in zone");
  });
});
