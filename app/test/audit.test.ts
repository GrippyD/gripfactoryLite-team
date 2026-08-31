import { describe, expect, it } from "vitest";
import { backRedirect, HttpError, requireReason } from "../src/audit";

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

describe("void returns to its source (owner ruling 2026-08-31)", () => {
  it("returns to the passed back path with the ok flash", () => {
    expect(backRedirect("/admin/queues")).toBe("/admin/queues?ok=voided");
    expect(backRedirect("/station/wet_weight?lot=abc")).toBe(
      "/station/wet_weight?lot=abc&ok=voided"
    );
    expect(backRedirect("/admin/lookups")).toBe("/admin/lookups?ok=voided");
  });

  it("falls back to Data Queues on missing or off-site backs, never the homepage", () => {
    expect(backRedirect(null)).toBe("/admin/queues?ok=voided");
    expect(backRedirect("")).toBe("/admin/queues?ok=voided");
    expect(backRedirect("//evil.example")).toBe("/admin/queues?ok=voided");
    expect(backRedirect("https://evil.example")).toBe("/admin/queues?ok=voided");
  });
});
