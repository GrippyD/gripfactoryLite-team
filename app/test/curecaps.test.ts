import { describe, expect, it } from "vitest";
import { saveLotCap } from "../src/actions";
import { HttpError } from "../src/audit";
import { CONFIG_KEYS, CSA_LOT_CAP_DEFAULT, CSB_LOT_CAP_DEFAULT, lotCapOf, parseLotCap } from "../src/config";
import { curePanes, cureShadeFill, type CureLot, type CurePanesData } from "../src/cure";
import { getConfigValue } from "../src/db";
import { LOOKUP_LANDING } from "../src/lookups";
import { lotCapPage } from "../src/pages";
import { formOf, migratedDb, seedPerson } from "./migrated";

const NOW = "2026-10-02T16:00:00.000Z";

function lot(id: string): CureLot {
  return { id, shortId: id, dryGrams: 0, liveGrams: null, inTime: null, moistureAt: null, moistureLatest: null };
}

function tile(n: number, locale: "en" | "es" = "en", cap = 36): string {
  const data: CurePanesData = {
    csa: Array.from({ length: n }, (_, i) => lot(`lot-${i}`)),
    csb: [],
    readings: { CSA: null, CSB: null },
    nowIso: NOW,
    caps: { CSA: cap, CSB: CSB_LOT_CAP_DEFAULT },
  };
  return curePanes(data, locale);
}

describe("THE CURE CAPS (canon 0.30.341)", () => {
  it("parses a whole number of lots and falls back when the read is not one", () => {
    expect(CSA_LOT_CAP_DEFAULT).toBe(36);
    expect(CSB_LOT_CAP_DEFAULT).toBe(8);
    expect(lotCapOf("36")).toBe(36);
    expect(lotCapOf("1")).toBe(1);
    expect(lotCapOf("999")).toBe(999);
    expect(lotCapOf("0")).toBeNull();
    expect(lotCapOf("1000")).toBeNull();
    expect(lotCapOf("12.5")).toBeNull();
    expect(lotCapOf("")).toBeNull();
    expect(parseLotCap("8", 36)).toBe(8);
    expect(parseLotCap("0", 36)).toBe(36);
    expect(parseLotCap("CSA,CSB", 36)).toBe(36);
    expect(parseLotCap(null, 8)).toBe(8);
  });

  it("fills the tile from the bottom as a bar to the percent full, and folds the lots under the fullness line", () => {
    const empty = tile(0);
    expect(empty.startsWith('<div class="inv-gauge cure-pane" data-cure-pane="CSA">')).toBe(true);
    expect(empty).toContain('class="cure-shade" style="height:0.0%" data-cure-shade data-cure-fill="0.0"');
    expect(empty).toContain('data-cure-count="0" data-cure-cap="36" data-cure-pct="0"');
    expect(empty).toContain(">0% full - 0 Lots</summary>");
    expect(empty).not.toContain("cure-over");
    const mid = tile(18);
    expect(cureShadeFill(18, 36)).toBe("50.0");
    expect(mid).toContain('class="cure-shade" style="height:50.0%" data-cure-shade data-cure-fill="50.0"');
    expect(mid).toContain('<details class="cure-lots" data-cure-lots>');
    expect(mid).toContain('title="18 of 36 lots, 50% full">50% full - 18 Lots</summary>');
    expect(mid.indexOf("data-cure-shade")).toBeLessThan(mid.indexOf("inv-gauge-name"));
    expect(mid.indexOf("inv-gauge-name")).toBeLessThan(mid.indexOf("data-cure-conditions"));
    expect(mid.indexOf("data-cure-conditions")).toBeLessThan(mid.indexOf("data-cure-lots"));
    const lotsAt = mid.indexOf("</summary>", mid.indexOf("data-cure-count"));
    expect(mid.indexOf('<details class="cure-row"')).toBeGreaterThan(lotsAt);
    expect(mid.lastIndexOf('<details class="cure-row"')).toBeLessThan(mid.lastIndexOf("</details>"));
    expect(tile(1)).toContain(">3% full - 1 Lot</summary>");
    const over = tile(40);
    expect(over).toContain('class="cure-shade" style="height:100.0%" data-cure-shade data-cure-fill="100.0"');
    expect(over).toContain('class="cure-count cure-over" data-cure-count="40" data-cure-cap="36" data-cure-pct="111"');
    expect(over).toContain(">111% full - 40 Lots</summary>");
    expect(tile(18, "es")).toContain(">50% lleno - 18 lotes</summary>");
  });

  it("stands on Harvest Operations and saves a cap under a reason into the change log", async () => {
    const harvest = LOOKUP_LANDING.find((section) => section.category === "Harvest Operations");
    const csa = harvest?.buttons.find((b) => b.key === "csa_lot_cap");
    const csb = harvest?.buttons.find((b) => b.key === "csb_lot_cap");
    expect(csa?.href).toBe("/admin/lookups/csa_lot_cap");
    expect(csa?.lookupFieldName).toBe("CSA Lot Cap");
    expect(csb?.href).toBe("/admin/lookups/csb_lot_cap");
    const page = lotCapPage("CSB", 8, true, "en");
    expect(page).toContain('action="/admin/lookups/csb_lot_cap" data-lot-cap="CSB"');
    expect(page).toContain('value="8" data-lot-cap-value');
    expect(page).toContain("The number of lots CSB holds; the tile on the Harvest Console fills green by lots over this cap.");
    expect(page).toContain('name="reason" required');
    expect(lotCapPage("CSB", 1, true, "en", "saved")).toContain("Lot cap saved.");
    expect(lotCapPage("CSA", 36, false, "es")).toContain("Tope de lotes CSA");
    expect(lotCapPage("CSA", 36, false, "es")).toContain("Aun sin guardar: el mosaico usa el valor por defecto, 36 lotes.");

    const m = await migratedDb();
    const person = seedPerson(m);
    expect(await getConfigValue(m.db, CONFIG_KEYS.csa_lot_cap)).toBe("36");
    expect(await getConfigValue(m.db, CONFIG_KEYS.csb_lot_cap)).toBe("8");
    const refused = await saveLotCap(m.db, formOf({ person_id: person, lot_cap: "0", reason: "try" }), CONFIG_KEYS.csb_lot_cap).catch((e) => e);
    expect(refused).toBeInstanceOf(HttpError);
    expect((refused as HttpError).message).toBe("Lot cap must be a whole number of lots, 1 to 999.");
    const noReason = await saveLotCap(m.db, formOf({ person_id: person, lot_cap: "4", reason: "" }), CONFIG_KEYS.csb_lot_cap).catch((e) => e);
    expect((noReason as HttpError).message).toBe("Reason is required.");
    const saved = await saveLotCap(m.db, formOf({ person_id: person, lot_cap: "1", reason: "one lot fills the room" }), CONFIG_KEYS.csb_lot_cap);
    expect(saved.redirect).toBe("/admin/lookups/csb_lot_cap?ok=saved");
    expect(await getConfigValue(m.db, CONFIG_KEYS.csb_lot_cap)).toBe("1");
    expect(
      m.all(
        `SELECT record_table, record_id, field, old_value, new_value, reason FROM record_change_log WHERE record_table = 'app_config' AND record_id = 'csb_lot_cap' AND field = 'value'`
      )
    ).toEqual([{ record_table: "app_config", record_id: "csb_lot_cap", field: "value", old_value: "8", new_value: "1", reason: "one lot fills the room" }]);
  });
});
