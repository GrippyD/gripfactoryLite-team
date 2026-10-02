import { describe, expect, it } from "vitest";
import { assertToteWeight, saveMaxToteLbs } from "../src/actions";
import { CONFIG_KEYS, MAX_TOTE_LBS_DEFAULT, maxToteLbsOf, parseMaxToteLbs } from "../src/config";
import { getConfigValue } from "../src/db";
import { LOOKUP_LANDING } from "../src/lookups";
import { maxToteWeightPage } from "../src/pages";
import { formOf, migratedDb, seedPerson } from "./migrated";

// THE MAX TOTE WEIGHT (canon 0.30.350; owner, 2026-10-02, verbatim: "Can we add that to an Admin lookup?  Seed
// 50lbs", after a 64,668,712 g tote went onto a field load).
describe("THE MAX TOTE WEIGHT (canon 0.30.350)", () => {
  it("parses pounds 1 to 500 and falls back to 50", () => {
    expect(MAX_TOTE_LBS_DEFAULT).toBe(50);
    expect(maxToteLbsOf("50")).toBe(50);
    expect(maxToteLbsOf("37.5 lb")).toBe(37.5);
    expect(maxToteLbsOf("0")).toBeNull();
    expect(maxToteLbsOf("501")).toBeNull();
    expect(maxToteLbsOf("fifty")).toBeNull();
    expect(parseMaxToteLbs(null)).toBe(50);
    expect(parseMaxToteLbs("CSA,CSB")).toBe(50);
  });

  it("stands on the Lookups landing beside the Trim Bogey, and the page posts pounds with a reason", () => {
    const button = LOOKUP_LANDING.flatMap((s) => s.buttons).find((b) => b.key === "max_tote_lbs");
    expect(button?.href).toBe("/admin/lookups/max_tote_lbs");
    const unset = maxToteWeightPage(50, false, "en");
    expect(unset).toContain('action="/admin/lookups/max_tote_lbs" data-max-tote');
    expect(unset).toContain('value="50" data-max-tote-value');
    expect(unset).toContain("Not saved yet: the stations refuse a weight above the default, 50 lb.");
    expect(maxToteWeightPage(40, true, "es")).toContain("Peso maximo por caja (lb)");
  });

  it("refuses a weight above the limit at the app's 448 g pound, saves a new limit under a reason, and logs it", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    await expect(assertToteWeight(m.db, 22400)).resolves.toBeUndefined();
    await expect(assertToteWeight(m.db, 22401)).rejects.toMatchObject({ status: 400 });
    await expect(assertToteWeight(m.db, 64668712)).rejects.toThrow("64,668,712 g is over the Max Tote Weight (50 lb, 22,400 g).");
    await expect(saveMaxToteLbs(m.db, formOf({ person_id: person, max_tote_lbs: "0", reason: "test" }))).rejects.toMatchObject({ status: 400 });
    const saved = await saveMaxToteLbs(m.db, formOf({ person_id: person, max_tote_lbs: "30", reason: "lighter totes" }));
    expect(saved.redirect).toBe("/admin/lookups/max_tote_lbs?ok=saved");
    expect(await getConfigValue(m.db, CONFIG_KEYS.max_tote_lbs)).toBe("30");
    await expect(assertToteWeight(m.db, 13441)).rejects.toMatchObject({ status: 400 });
    await expect(assertToteWeight(m.db, 13440)).resolves.toBeUndefined();
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_table = 'app_config' AND record_id = 'max_tote_lbs'`)?.n).toBeGreaterThan(0);
  });
});
