import { describe, expect, it } from "vitest";
import { saveTrimBogey } from "../src/actions";
import { HttpError } from "../src/audit";
import { CONFIG_KEYS, TRIM_BOGEY_DEFAULT } from "../src/config";
import { loadHarvestConsole } from "../src/console";
import { getConfigValue } from "../src/db";
import { LOOKUP_LANDING } from "../src/lookups";
import { lookupsLandingPage, trimBogeyPage } from "../src/pages";
import { formOf, migratedDb, seedPerson } from "./migrated";

// THE TRIM BOGEY (canon 0.30.249; owner, 2026-09-26: "Add a Admin Lookup Field: [Trim Bogey] expressed as a
// percentage" and "Determines number of dark red squares and the order based on our scheme (ROYGBIVWB-Aqua)").
describe("THE TRIM BOGEY (canon 0.30.249)", () => {
  it("stands on the Lookups landing under Production Operations", () => {
    const production = LOOKUP_LANDING.find((section) => section.category === "Production Operations");
    const button = production?.buttons.find((b) => b.key === "trim_bogey");
    expect(button?.href).toBe("/admin/lookups/trim_bogey");
    expect(button?.lookupFieldName).toBe("Trim Bogey");
    const landing = lookupsLandingPage("en");
    expect(landing).toContain('href="/admin/lookups/trim_bogey" data-lookup-key="trim_bogey"');
    expect(lookupsLandingPage("es")).toContain("Meta de recorte");
  });

  it("the page shows the value, says when it is the default, and posts a percent with a reason", () => {
    const unset = trimBogeyPage(TRIM_BOGEY_DEFAULT, false, "en");
    expect(unset).toContain('<form class="stack" method="post" action="/admin/lookups/trim_bogey" data-trim-bogey>');
    expect(unset).toContain('name="trim_bogey_pct"');
    expect(unset).toContain('value="40" data-trim-bogey-value');
    expect(unset).toContain('name="reason" required');
    expect(unset).toContain("Not saved yet: the plume reads the default, 40%.");
    const saved = trimBogeyPage(35, true, "en", "saved");
    expect(saved).toContain('value="35" data-trim-bogey-value');
    expect(saved).not.toContain("data-trim-bogey-default");
    expect(saved).toContain("data-trim-bogey-flash");
    expect(trimBogeyPage(35, true, "es")).toContain("Meta de recorte (%)");
  });

  it("saves into app_config: inserted on the first save, updated after, each change logged, bad values refused", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    expect(await getConfigValue(m.db, CONFIG_KEYS.trim_bogey_pct)).toBeNull();
    const first = await saveTrimBogey(m.db, formOf({ person_id: person, trim_bogey_pct: "35", reason: "tighter goal" }));
    expect(first.redirect).toBe("/admin/lookups/trim_bogey?ok=saved");
    expect(await getConfigValue(m.db, CONFIG_KEYS.trim_bogey_pct)).toBe("35");
    expect(m.all(`SELECT field, new_value, reason FROM record_change_log WHERE record_table = 'app_config' AND record_id = 'trim_bogey_pct' AND field = 'value'`)).toEqual([
      { field: "value", new_value: "35", reason: "tighter goal" },
    ]);
    await saveTrimBogey(m.db, formOf({ person_id: person, trim_bogey_pct: "38%", reason: "back off a little" }));
    expect(await getConfigValue(m.db, CONFIG_KEYS.trim_bogey_pct)).toBe("38");
    const changes = m.all(
      `SELECT old_value, new_value, reason FROM record_change_log WHERE record_table = 'app_config' AND record_id = 'trim_bogey_pct' AND field = 'value' ORDER BY changed_at, rowid`
    );
    expect(changes[changes.length - 1]).toEqual({ old_value: "35", new_value: "38", reason: "back off a little" });
    // The same value again writes nothing.
    const before = m.all(`SELECT id FROM record_change_log WHERE record_table = 'app_config'`).length;
    await saveTrimBogey(m.db, formOf({ person_id: person, trim_bogey_pct: "38", reason: "same" }));
    expect(m.all(`SELECT id FROM record_change_log WHERE record_table = 'app_config'`).length).toBe(before);
    for (const bad of ["101", "-1", "12.5", "abc", ""]) {
      const err = await saveTrimBogey(m.db, formOf({ person_id: person, trim_bogey_pct: bad, reason: "try" })).catch((e) => e);
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).message).toBe("Trim Bogey is a whole percent from 0 to 100.");
    }
    const noReason = await saveTrimBogey(m.db, formOf({ person_id: person, trim_bogey_pct: "30", reason: "" })).catch((e) => e);
    expect((noReason as HttpError).message).toBe("Reason is required.");
    expect(await getConfigValue(m.db, CONFIG_KEYS.trim_bogey_pct)).toBe("38");
  });

  it("the Harvest Console reads the saved bogey, 40 until one is saved", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const at = "2026-09-26T16:00:00.000Z";
    expect((await loadHarvestConsole(m.db, at)).trim?.bogeyPct).toBe(40);
    await saveTrimBogey(m.db, formOf({ person_id: person, trim_bogey_pct: "35", reason: "tighter goal" }));
    expect((await loadHarvestConsole(m.db, at)).trim?.bogeyPct).toBe(35);
  });
});
