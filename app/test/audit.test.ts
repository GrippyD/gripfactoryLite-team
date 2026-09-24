import { describe, expect, it } from "vitest";
import { backRedirect, HttpError, requireReason } from "../src/audit";
import { assertVoidableTable } from "../src/actions";

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

describe("void refusals (owner ruling 2026-09-01: app_config is standing configuration)", () => {
  it("refuses app_config outright with HTTP 400 and the standing-configuration message", () => {
    expect(() => assertVoidableTable("app_config")).toThrow(HttpError);
    try {
      assertVoidableTable("app_config");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
      expect((err as HttpError).message).toBe(
        "App config keys are standing configuration and cannot be voided."
      );
    }
  });

  it("keeps the change log refusal and lets record tables through", () => {
    expect(() => assertVoidableTable("record_change_log")).toThrow(/change log cannot be voided/);
    expect(() => assertVoidableTable("wip_packages")).not.toThrow();
    expect(() => assertVoidableTable("package_types")).not.toThrow();
  });
});
