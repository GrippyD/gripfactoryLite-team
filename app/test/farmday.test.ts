import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import { resolveLoadedAt } from "../src/actions";
import { consoleDayControl, consoleDayOf, consoleDayQuery, harvestConsolePage, loadHarvestConsole, saveHarvestHours, saveTrimHours, type HarvestConsoleInput } from "../src/console";
import { CONFIG_KEYS } from "../src/config";
import { effectiveDateField, farmDayStartHour, farmToday, resolveEffectiveDate } from "../src/effective";
import {
  dayAfter,
  FARM_DAY_START_HOUR_DEFAULT,
  farmDay,
  farmDayBounds,
  farmInstant,
  etDate,
  etHour,
  parseFarmDayStartHour,
} from "../src/farmday";
import { defaultTodayScript, layout } from "../src/html";

/** A D1 stand-in: app_config by key (the PIN and the start hour); every other read answers nothing. */
function fakeDb(config: Record<string, string> = { admin_pin: "21319", farm_day_start_hour: "6" }) {
  const seen: Array<{ sql: string; args: unknown[] }> = [];
  return {
    seen,
    prepare(sql: string) {
      const args: unknown[] = [];
      const self = {
        bind(...next: unknown[]) {
          args.push(...next);
          return self;
        },
        async first() {
          seen.push({ sql, args });
          if (sql.includes("FROM app_config")) {
            const value = config[String(args[0])];
            return value == null ? null : { value };
          }
          return null;
        },
        async all() {
          seen.push({ sql, args });
          return { results: [] };
        },
        async run() {
          return { success: true };
        },
      };
      return self;
    },
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      for (const s of stmts) await s.run();
    },
  };
}

function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

// 1:30 AM Eastern on the 21st (daylight time, UTC-4): second shift's last hour, farm day the 20th.
const SMALL_HOURS = "2026-09-21T05:30:00.000Z";
// 9:30 AM Eastern on the 21st: the day shift's morning, farm day the 21st.
const MORNING = "2026-09-21T13:30:00.000Z";

describe("THE FARM DAY BEGINS AT SIX (canon 0.30.151; owner: \"Second shift ends the next day, how can I have the report date treat the start of the shift a the date?\"; his pick 6:00 AM)", () => {
  it("reads the start hour from data, the ruling's 6 when the row is missing or off", () => {
    expect(FARM_DAY_START_HOUR_DEFAULT).toBe(6);
    expect(parseFarmDayStartHour("6")).toBe(6);
    expect(parseFarmDayStartHour("4")).toBe(4);
    expect(parseFarmDayStartHour("0")).toBe(0);
    expect(parseFarmDayStartHour("23")).toBe(23);
    expect(parseFarmDayStartHour("24")).toBe(6);
    expect(parseFarmDayStartHour("six")).toBe(6);
    expect(parseFarmDayStartHour(null)).toBe(6);
    expect(parseFarmDayStartHour("")).toBe(6);
    expect(CONFIG_KEYS.farm_day_start_hour).toBe("farm_day_start_hour");
  });

  it("the farm day: the Eastern calendar day, or the day before while the clock is short of the start hour", () => {
    expect(etHour(SMALL_HOURS)).toBe(1);
    expect(etHour(MORNING)).toBe(9);
    expect(etDate(SMALL_HOURS)).toBe("2026-09-21");
    expect(farmDay(SMALL_HOURS, 6)).toBe("2026-09-20");
    expect(farmDay(MORNING, 6)).toBe("2026-09-21");
    // 5:59 AM is still yesterday; 6:00 AM is today.
    expect(farmDay("2026-09-21T09:59:00.000Z", 6)).toBe("2026-09-20");
    expect(farmDay("2026-09-21T10:00:00.000Z", 6)).toBe("2026-09-21");
    // A start hour of 0 is the old midnight law.
    expect(farmDay(SMALL_HOURS, 0)).toBe("2026-09-21");
    // The default is the ruling.
    expect(farmDay(SMALL_HOURS)).toBe("2026-09-20");
    // Standard time (UTC-5): 1:30 AM Eastern on the 14th of January is 06:30Z.
    expect(farmDay("2026-01-14T06:30:00.000Z", 6)).toBe("2026-01-13");
    expect(dayAfter("2026-09-20")).toBe("2026-09-21");
    expect(dayAfter("2026-12-31")).toBe("2027-01-01");
  });

  it("bounds a farm day from start hour to start hour, Eastern, in UTC", () => {
    expect(farmDayBounds("2026-09-20", 6)).toEqual({ startIso: "2026-09-20T10:00:00.000Z", endIso: "2026-09-21T10:00:00.000Z" });
    expect(farmDayBounds("2026-01-13", 6)).toEqual({ startIso: "2026-01-13T11:00:00.000Z", endIso: "2026-01-14T11:00:00.000Z" });
    expect(farmDayBounds("2026-09-20", 0)).toEqual({ startIso: "2026-09-20T04:00:00.000Z", endIso: "2026-09-21T04:00:00.000Z" });
    // The small hours of the 21st fall inside the 20th's farm day.
    const b = farmDayBounds("2026-09-20", 6);
    expect(SMALL_HOURS >= b.startIso && SMALL_HOURS < b.endIso).toBe(true);
    expect(MORNING >= b.endIso).toBe(true);
  });

  it("a wall clock on a farm day: a time before the start hour is on the next calendar date", () => {
    expect(farmInstant("2026-09-20", "23:30", 6)).toBe("2026-09-21T03:30:00.000Z");
    expect(farmInstant("2026-09-20", "01:00", 6)).toBe("2026-09-21T05:00:00.000Z");
    expect(farmInstant("2026-09-20", "06:00", 6)).toBe("2026-09-20T10:00:00.000Z");
    expect(farmInstant("2026-09-20", "01:00", 0)).toBe("2026-09-20T05:00:00.000Z");
    expect(farmInstant("2026-09-20", "24:00", 6)).toBe("");
    expect(farmInstant("nope", "01:00", 6)).toBe("");
  });

  it("the Effective Date reads the farm day: at 1:30 AM a blank or yesterday's date is today, the calendar date is ahead", async () => {
    const db = fakeDb();
    expect(await farmDayStartHour(db as unknown as D1Database)).toBe(6);
    expect(await farmToday(db as unknown as D1Database, SMALL_HOURS)).toBe("2026-09-20");
    expect(await resolveEffectiveDate(db as unknown as D1Database, fd({}), SMALL_HOURS)).toEqual({ date: "2026-09-20", today: "2026-09-20", overridden: false });
    expect(await resolveEffectiveDate(db as unknown as D1Database, fd({ effective_date: "2026-09-20" }), SMALL_HOURS)).toEqual({
      date: "2026-09-20",
      today: "2026-09-20",
      overridden: false,
    });
    // The calendar's 21st is tomorrow to the farm at 1:30 AM: refused even with the PIN.
    await expect(resolveEffectiveDate(db as unknown as D1Database, fd({ effective_date: "2026-09-21", effective_pin: "21319" }), SMALL_HOURS)).rejects.toMatchObject({ status: 400 });
    // By 9:30 AM the 21st is today and the 20th needs the PIN again.
    expect(await resolveEffectiveDate(db as unknown as D1Database, fd({ effective_date: "2026-09-21" }), MORNING)).toEqual({ date: "2026-09-21", today: "2026-09-21", overridden: false });
    await expect(resolveEffectiveDate(db as unknown as D1Database, fd({ effective_date: "2026-09-20" }), MORNING)).rejects.toMatchObject({ status: 403 });
    // The start hour in data governs: at 0 the old midnight law stands.
    const midnight = fakeDb({ admin_pin: "21319", farm_day_start_hour: "0" });
    expect(await resolveEffectiveDate(midnight as unknown as D1Database, fd({}), SMALL_HOURS)).toEqual({ date: "2026-09-21", today: "2026-09-21", overridden: false });
  });

  it("the field renders the farm day as today with the instant, and the client script reads the start hour off the body", () => {
    const html = effectiveDateField(SMALL_HOURS, "en", undefined, undefined, 6);
    expect(html).toContain("Effective Date: <span data-effective-summary>2026-09-20</span>");
    expect(html).toMatch(/<input type="date" name="effective_date" value="2026-09-20" max="2026-09-20" data-effective-input data-effective-default="2026-09-20">/);
    expect(effectiveDateField(SMALL_HOURS, "en", undefined, undefined, 0)).toContain("<span data-effective-summary>2026-09-21</span>");
    expect(html).toContain('getAttribute("data-farm-day-start")');
    expect(html).toContain("d.getHours() < startHour) d.setDate(d.getDate() - 1)");
    expect(defaultTodayScript()).toContain('getAttribute("data-farm-day-start")');
    expect(defaultTodayScript()).toContain("d.getHours() < startHour) d.setDate(d.getDate() - 1)");
    expect(layout({ title: "x", theme: "grip", personEmail: "", body: "", farmDayStart: 6 })).toContain('<body data-farm-day-start="6">');
  });

  it("the loaded time: a Start time before the start hour is on the next calendar date of the Effective Date, and the instant must fall on the farm day", () => {
    // The owner backdates a load to the 20th at 1:00 AM (the shift's small hours): the instant is the 21st, 05:00Z.
    expect(resolveLoadedAt("01:00", null, MORNING, "2026-09-20", 6)).toBe("2026-09-21T05:00:00.000Z");
    // The browser's instant for that same wall clock agrees.
    expect(resolveLoadedAt("01:00", "2026-09-21T05:00:00.000Z", MORNING, "2026-09-20", 6)).toBe("2026-09-21T05:00:00.000Z");
    // 8:30 PM on the 20th stands as before.
    expect(resolveLoadedAt("20:30", null, MORNING, "2026-09-20", 6)).toBe("2026-09-21T00:30:00.000Z");
    // An instant on the 20th's small hours belongs to the 19th's farm day: off the Effective Date.
    expect(() => resolveLoadedAt("01:00", "2026-09-20T05:00:00.000Z", MORNING, "2026-09-20", 6)).toThrow(/does not fall on the Effective Date/);
    // Ahead of now still refuses.
    expect(() => resolveLoadedAt("15:00", null, MORNING, "2026-09-21", 6)).toThrow(HttpError);
  });
});

const baseInput: HarvestConsoleInput = {
  today: "2026-09-21",
  day: "2026-09-21",
  dayPicked: false,
  year: 2026,
  remaining: [],
  seasonHarvested: [],
  seasonLots: [],
  dayWet: [],
  hours: { PNN: null, ARL: null, PNS: null },
  plantCounts: { PNN: null, ARL: null, PNS: null },
};

describe("THE CONSOLE DAY (canon 0.30.152; owner: \"on the dashboard, can we do a universal date override?  It defaults to \\\"yesterday\\\" and I can change it to any other day?\")", () => {
  it("the day under view: today by default; any real day before today when picked; a blank, bad, future or today pick reads today", () => {
    expect(consoleDayOf(null, "2026-09-21")).toEqual({ day: "2026-09-21", dayPicked: false });
    expect(consoleDayOf("", "2026-09-21")).toEqual({ day: "2026-09-21", dayPicked: false });
    expect(consoleDayOf("2026-09-20", "2026-09-21")).toEqual({ day: "2026-09-20", dayPicked: true });
    expect(consoleDayOf("2026-09-18", "2026-09-21")).toEqual({ day: "2026-09-18", dayPicked: true });
    expect(consoleDayOf("2026-09-21", "2026-09-21")).toEqual({ day: "2026-09-21", dayPicked: false });
    expect(consoleDayOf("2026-09-22", "2026-09-21")).toEqual({ day: "2026-09-21", dayPicked: false });
    expect(consoleDayOf("09/18/2026", "2026-09-21")).toEqual({ day: "2026-09-21", dayPicked: false });
    expect(consoleDayQuery({ day: "2026-09-18", dayPicked: true })).toBe("&day=2026-09-18");
    expect(consoleDayQuery({ day: "2026-09-21", dayPicked: false })).toBe("");
  });

  it("the loader reads the farm day for today, bounds the window from six to six, and takes the picked day", async () => {
    const db = fakeDb({ farm_day_start_hour: "6" });
    const input = await loadHarvestConsole(db as unknown as D1Database, SMALL_HOURS);
    // 1:30 AM on the 21st: the farm's today is the 20th, and the console reads it.
    expect(input.today).toBe("2026-09-20");
    expect(input.day).toBe("2026-09-20");
    expect(input.dayPicked).toBe(false);
    const wet = db.seen.find((q) => q.sql.includes("FROM wet_weights x") && q.sql.includes("x.created_at"));
    expect(wet?.args).toEqual(["2026-09-20T10:00:00.000Z", "2026-09-21T10:00:00.000Z"]);
    const yearWet = db.seen.find((q) => q.sql.includes("FROM wet_weights x") && q.sql.includes("b.harvest_year"));
    expect(yearWet?.args).toEqual([2026]);
    const trim = db.seen.find((q) => q.sql.includes("p.trim_date = ?"));
    expect(trim?.args).toEqual(["2026-09-20", "2026-09-20T10:00:00.000Z", "2026-09-21T10:00:00.000Z"]);
    const hours = db.seen.find((q) => q.sql.includes("FROM harvest_labor_hours WHERE work_date = ?"));
    expect(hours?.args).toEqual(["2026-09-20"]);
    expect(db.seen.find((q) => q.sql.includes("FROM trim_line_inputs"))).toBeUndefined();
    expect(db.seen.find((q) => q.sql.includes("l.new_value = 'trimmed'"))?.args).toEqual(["2026-09-20T10:00:00.000Z", "2026-09-21T10:00:00.000Z"]);
    expect(db.seen.find((q) => q.sql.includes("p.created_at >= ?") && !q.sql.includes("trim_date") && !q.sql.includes("source = 'cryo'"))?.args).toEqual(["2026-09-21T05:00:00.000Z"]);
    expect(input.trim?.prepackCodes).toEqual(["SMALLS"]);
    // THE LINE RUNS ON THE CLOCK (canon 0.30.163): the queue count, the instant and the hours ride the input.
    expect(db.seen.find((q) => q.sql.includes("w.status = 'unloaded'") && q.sql.includes("COUNT(*) AS n"))).toBeTruthy();
    expect(input.trim?.nowIso).toBe(SMALL_HOURS);
    expect(input.trim?.queueLots).toBe(0);
    expect(db.seen.find((q) => q.sql.includes("FROM app_config") && q.args[0] === "trim_shift_day_hours")).toBeTruthy();
    // A picked day drives every window and box.
    const picked = fakeDb({ farm_day_start_hour: "6" });
    const pickedInput = await loadHarvestConsole(picked as unknown as D1Database, MORNING, "2026-09-15");
    expect(pickedInput.today).toBe("2026-09-21");
    expect(pickedInput.day).toBe("2026-09-15");
    expect(pickedInput.dayPicked).toBe(true);
    expect(picked.seen.find((q) => q.sql.includes("FROM wet_weights x"))?.args).toEqual(["2026-09-15T10:00:00.000Z", "2026-09-16T10:00:00.000Z"]);
    expect(picked.seen.find((q) => q.sql.includes("FROM trim_labor_hours WHERE work_date = ?"))?.args).toEqual(["2026-09-15"]);
  });

  it("the control: a date box under the title, today by default, capped at today, the picked state named, a way back", () => {
    const dflt = consoleDayControl(baseInput, "en");
    expect(dflt).toContain('<form class="hc-day" method="get" action="/harvest" data-hc-day>');
    expect(dflt).toContain('<input type="date" name="day" value="2026-09-21" max="2026-09-21" data-hc-day-input onchange="this.form.submit()">');
    expect(dflt).toContain("today so far; the panes below read today up to now");
    expect(dflt).not.toContain("data-hc-day-reset");
    expect(dflt).toContain("Today is 2026-09-21; the hours you type land on the day shown.");
    const picked = consoleDayControl({ ...baseInput, day: "2026-09-15", dayPicked: true }, "en");
    expect(picked).toContain('value="2026-09-15" max="2026-09-21"');
    expect(picked).toContain("picked; the panes below read this day");
    expect(picked).toContain('<a class="secondary" href="/harvest" data-hc-day-reset>Back to today</a>');
    expect(consoleDayControl(baseInput, "es")).toContain("hoy hasta ahora; los paneles de abajo leen hoy hasta este momento");
    expect(consoleDayControl({ ...baseInput, day: "2026-09-15", dayPicked: true }, "es")).toContain("Volver a hoy");
  });

  it("the page carries the control and the hours forms carry the picked day home", () => {
    const html = harvestConsolePage({ input: { ...baseInput, day: "2026-09-15", dayPicked: true }, live: [], nowIso: MORNING });
    expect(html).toContain("data-hc-day");
    expect(html).toContain('<input type="hidden" name="work_date" value="2026-09-15">');
    expect(html).toContain('<input type="hidden" name="day_picked" value="1">');
    expect(html.match(/<span class="hc-date muted">2026-09-15<\/span>/g)?.length ?? 0).toBeGreaterThan(0);
    const dflt = harvestConsolePage({ input: baseInput, live: [], nowIso: MORNING });
    expect(dflt).toContain('<input type="hidden" name="day_picked" value="">');
  });

  it("saving hours on a picked day returns to that day; on the default, to the console as before", async () => {
    const db = fakeDb();
    const picked = await saveHarvestHours(db as unknown as D1Database, fd({ person_id: "p1", farm: "PNN", work_date: "2026-09-15", hours: "8", day_picked: "1" }));
    expect(picked.redirect).toBe("/harvest?ok=hours&day=2026-09-15");
    const dflt = await saveHarvestHours(db as unknown as D1Database, fd({ person_id: "p1", farm: "PNN", work_date: "2026-09-20", hours: "8", day_picked: "" }));
    expect(dflt.redirect).toBe("/harvest?ok=hours");
    const trim = await saveTrimHours(db as unknown as D1Database, fd({ person_id: "p1", shift: "day", work_date: "2026-09-15", hours: "6", day_picked: "1" }));
    expect(trim.redirect).toBe("/harvest?ok=trim_hours&day=2026-09-15");
  });
});
