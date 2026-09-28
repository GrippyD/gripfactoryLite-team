import { describe, expect, it } from "vitest";
import { SYSTEM_REASON } from "../src/config";
import { saveHarvestHours, savePrepackHours, saveTrimHours, saveTrimInputLbs } from "../src/console";
import { listLaborHours } from "../src/db";
import { dayBefore } from "../src/farmday";
import { laborHoursDefaultWindow, laborHoursView } from "../src/reports";
import { formOf, migratedDb, seedPerson } from "./migrated";

const DAY = "2026-09-15";
const PRIOR = "2026-09-14";

describe("THE HOURS PROVED AND THE LABOR HOURS REPORT (canon 0.30.288)", () => {
  it("keeps one row per date and operation, updates in place, deletes on blank, and logs labor hours typed", async () => {
    const m = await migratedDb();
    seedPerson(m);
    expect(SYSTEM_REASON.labor_hours).toBe("labor hours typed");
    await saveHarvestHours(m.db, formOf({ farm: "PNN", work_date: DAY, hours: "8" }));
    await saveHarvestHours(m.db, formOf({ farm: "PNN", work_date: DAY, hours: "9" }));
    await saveHarvestHours(m.db, formOf({ farm: "ARL", work_date: PRIOR, hours: "4" }));
    const harvest = m.all(`SELECT farm_code, work_date, hours FROM harvest_labor_hours ORDER BY work_date, farm_code`);
    expect(harvest).toEqual([
      { farm_code: "ARL", work_date: PRIOR, hours: 4 },
      { farm_code: "PNN", work_date: DAY, hours: 9 },
    ]);
    await saveTrimHours(m.db, formOf({ shift: "day", work_date: DAY, hours: "6" }));
    await saveTrimHours(m.db, formOf({ shift: "day", work_date: DAY, hours: "6.5" }));
    expect(m.all(`SELECT work_date, shift, hours FROM trim_labor_hours`)).toEqual([{ work_date: DAY, shift: "day", hours: 6.5 }]);
    await saveTrimInputLbs(m.db, formOf({ shift: "day", work_date: DAY, lbs: "12.5" }));
    await saveTrimInputLbs(m.db, formOf({ shift: "day", work_date: DAY, lbs: "13" }));
    expect(m.all(`SELECT work_date, shift, lbs FROM trim_line_inputs`)).toEqual([{ work_date: DAY, shift: "day", lbs: 13 }]);
    await savePrepackHours(m.db, formOf({ work_date: DAY, hours: "2" }));
    await savePrepackHours(m.db, formOf({ work_date: DAY, hours: "2.25" }));
    expect(m.all(`SELECT work_date, hours FROM prepack_labor_hours`)).toEqual([{ work_date: DAY, hours: 2.25 }]);
    const reasons = m.all(`SELECT DISTINCT reason FROM record_change_log WHERE reason = ?`, SYSTEM_REASON.labor_hours);
    expect(reasons).toEqual([{ reason: "labor hours typed" }]);
    const tables = m.all(
      `SELECT record_table, COUNT(*) AS n FROM record_change_log WHERE reason = ? GROUP BY record_table ORDER BY record_table`,
      SYSTEM_REASON.labor_hours
    );
    expect(tables).toEqual([
      { record_table: "harvest_labor_hours", n: 3 },
      { record_table: "prepack_labor_hours", n: 2 },
      { record_table: "trim_labor_hours", n: 2 },
      { record_table: "trim_line_inputs", n: 2 },
    ]);
    await saveHarvestHours(m.db, formOf({ farm: "PNN", work_date: DAY, hours: "" }));
    await saveTrimHours(m.db, formOf({ shift: "day", work_date: DAY, hours: "" }));
    await saveTrimInputLbs(m.db, formOf({ shift: "day", work_date: DAY, lbs: "" }));
    await savePrepackHours(m.db, formOf({ work_date: DAY, hours: "" }));
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_labor_hours WHERE farm_code = 'PNN'`)).toEqual({ n: 0 });
    expect(m.get(`SELECT COUNT(*) AS n FROM trim_labor_hours`)).toEqual({ n: 0 });
    expect(m.get(`SELECT COUNT(*) AS n FROM trim_line_inputs`)).toEqual({ n: 0 });
    expect(m.get(`SELECT COUNT(*) AS n FROM prepack_labor_hours`)).toEqual({ n: 0 });
    const cleared = m.all(
      `SELECT record_table, new_value FROM record_change_log WHERE reason = ? AND new_value IS NULL ORDER BY record_table`,
      SYSTEM_REASON.labor_hours
    );
    expect(cleared.map((row) => row.record_table)).toEqual([
      "harvest_labor_hours",
      "prepack_labor_hours",
      "trim_labor_hours",
      "trim_line_inputs",
    ]);
  });

  it("lists newest date first, one row per saved value, and filters the window", async () => {
    const m = await migratedDb();
    await saveHarvestHours(m.db, formOf({ farm: "PNN", work_date: DAY, hours: "9" }));
    await saveHarvestHours(m.db, formOf({ farm: "ARL", work_date: PRIOR, hours: "4" }));
    await saveTrimHours(m.db, formOf({ shift: "day", work_date: DAY, hours: "6.5" }));
    await saveTrimInputLbs(m.db, formOf({ shift: "second", work_date: DAY, lbs: "13" }));
    await savePrepackHours(m.db, formOf({ work_date: DAY, hours: "2.25" }));
    const rows = await listLaborHours(m.db, PRIOR, DAY);
    expect(rows.map((row) => `${row.work_date}|${row.operation}|${row.value}|${row.unit}`)).toEqual([
      "2026-09-15|Cutting and bucking, PNN|9|h",
      "2026-09-15|Prepack hours|2.25|h",
      "2026-09-15|Trim DLH, day|6.5|h",
      "2026-09-15|Trim input lbs, second|13|lb",
      "2026-09-14|Cutting and bucking, ARL|4|h",
    ]);
    expect(rows.every((row) => typeof row.updated_at === "string" && row.updated_at.length > 0)).toBe(true);
    const view = laborHoursView(rows);
    expect(view.columns.map((c) => c.label)).toEqual(["Date", "Operation", "Value", "Unit", "Updated"]);
    expect(view.rows[0]?.operation).toBe("Cutting and bucking, PNN");
    expect(laborHoursView([]).empty).toBe("No hours in this window.");
    const onlyToday = await listLaborHours(m.db, DAY, DAY);
    expect(onlyToday.every((row) => row.work_date === DAY)).toBe(true);
    expect(onlyToday).toHaveLength(4);
    let from = DAY;
    for (let i = 0; i < 29; i++) from = dayBefore(from);
    expect(laborHoursDefaultWindow(DAY)).toEqual({ from, to: DAY });
    expect(laborHoursDefaultWindow(DAY).from).toBe("2026-08-17");
  });
});
