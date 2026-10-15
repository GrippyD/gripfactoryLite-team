import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import { resolveLoadedAt } from "../src/actions";
import { consoleDayControl, consoleDayOf, consoleDayQuery, harvestConsolePage, loadHarvestConsole, saveHarvestHours, saveTrimHours, type HarvestConsoleInput } from "../src/console";
import { CONFIG_KEYS } from "../src/config";
import { effectiveDateField, farmDayStartHour, farmToday, resolveEffectiveDate } from "../src/effective";
import {
  dayAfter,
  dayOffset,
  FARM_DAY_START_HOUR_DEFAULT,
  farmDay,
  farmDayBounds,
  farmInstant,
  etDate,
  etHour,
  etInstant,
  harvestWeekNumber,
  isoWeekKey,
  isoWeekOf,
  monthStartOf,
  parseFarmDayStartHour,
  PERIOD_KINDS,
  periodEndOf,
  periodLabel,
  periodShift,
  periodStartFor,
  quarterStartOf,
  seasonStartOf,
  trimCountedDate,
  weekBoundsOf,
  weekStartOf,
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
          if (sql.includes("FROM app_config")) {
            const results = args
              .map((key) => {
                const value = config[String(key)];
                return value == null ? null : { key: String(key), value };
              })
              .filter((row) => row != null);
            return { results };
          }
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

describe("THE DAY FOLLOWS THE TEAM LEAD (canon 0.30.419)", () => {
  const lists = { day: ["Ada Day"], second: ["Nia Night"] };
  const at = (date: string, hhmm: string) => etInstant(date, hhmm);

  it("a second shift operator before noon lands on the evening's date; noon and after stay on that day", () => {
    expect(trimCountedDate(at("2026-10-06", "23:10"), "Nia Night", lists)).toEqual({ date: "2026-10-06", shift: "second" });
    expect(trimCountedDate(at("2026-10-07", "03:00"), "Nia Night", lists).date).toBe("2026-10-06");
    expect(trimCountedDate(at("2026-10-07", "05:59"), "Nia Night", lists).date).toBe("2026-10-06");
    expect(trimCountedDate(at("2026-10-07", "06:30"), "Nia Night", lists).date).toBe("2026-10-06");
    expect(trimCountedDate(at("2026-10-07", "12:30"), "Nia Night", lists)).toEqual({ date: "2026-10-07", shift: "second" });
  });

  it("a day shift operator takes the Eastern calendar date; neither list takes the farm day; case and spaces are ignored", () => {
    expect(trimCountedDate(at("2026-10-07", "19:00"), "Ada Day", lists)).toEqual({ date: "2026-10-07", shift: "day" });
    expect(trimCountedDate(at("2026-10-07", "05:30"), "Les", lists, 6)).toEqual({ date: "2026-10-06", shift: null });
    expect(trimCountedDate(at("2026-10-07", "10:00"), "Les", lists, 6)).toEqual({ date: "2026-10-07", shift: null });
    expect(trimCountedDate(at("2026-10-07", "06:30"), "  NIA   night ", lists).shift).toBe("second");
    expect(trimCountedDate(at("2026-10-07", "19:00"), "ada   day", lists).shift).toBe("day");
  });
});

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
    expect(db.seen.find((q) => q.sql.includes("work_date >= ? AND work_date <= ?"))?.args).toEqual(["2026-01-01", "2026-09-20"]);
    expect(db.seen.find((q) => q.sql.includes("FROM trim_line_inputs"))).toBeUndefined();
    expect(db.seen.find((q) => q.sql.includes("l.new_value = 'trimmed'"))?.args).toEqual(["2026-09-20T10:00:00.000Z", "2026-09-21T10:00:00.000Z"]);
    expect(db.seen.find((q) => q.sql.includes("p.created_at >= ?") && !q.sql.includes("trim_date") && !q.sql.includes("source = 'cryo'"))?.args).toEqual(["2026-09-21T05:00:00.000Z"]);
    expect(input.trim?.prepackCodes).toEqual(["SMALLS"]);
    // The queue count still rides the input for the drying totals. Trim does not read the shift hour windows (canon 0.30.419).
    expect(db.seen.find((q) => q.sql.includes("w.status = 'unloaded'") && q.sql.includes("COUNT(*) AS n"))).toBeTruthy();
    expect(input.trim?.nowIso).toBe(SMALL_HOURS);
    expect(input.trim?.queueLots).toBe(0);
    expect(db.seen.find((q) => q.sql.includes("FROM app_config") && q.args[0] === "trim_shift_day_hours")).toBeUndefined();
    expect(db.seen.find((q) => q.sql.includes("GROUP BY p.trim_operator"))).toBeTruthy();
    // A picked day drives every window and box.
    const picked = fakeDb({ farm_day_start_hour: "6" });
    const pickedInput = await loadHarvestConsole(picked as unknown as D1Database, MORNING, "2026-09-15");
    expect(pickedInput.today).toBe("2026-09-21");
    expect(pickedInput.day).toBe("2026-09-15");
    expect(pickedInput.dayPicked).toBe(true);
    expect(picked.seen.find((q) => q.sql.includes("FROM wet_weights x"))?.args).toEqual(["2026-09-15T10:00:00.000Z", "2026-09-16T10:00:00.000Z"]);
    expect(picked.seen.find((q) => q.sql.includes("FROM trim_labor_hours WHERE work_date = ?"))?.args).toEqual(["2026-09-15"]);
    expect(picked.seen.find((q) => q.sql.includes("work_date >= ? AND work_date <= ?"))?.args).toEqual(["2026-01-01", "2026-09-15"]);
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

describe("THE PERIODS (DD S1, dd_week_basis = iso): the ISO week of the farm day, months, quarters, seasons and harvest week n, the same under any TZ", () => {
  it("the Monday and the ISO week key: the year's last week spills into January, Sep 1 is W36 in 2026 and W35 in 2027", () => {
    expect(weekStartOf("2026-12-28")).toBe("2026-12-28");
    expect(weekStartOf("2027-01-03")).toBe("2026-12-28");
    expect(weekStartOf("2026-12-31")).toBe("2026-12-28");
    expect(isoWeekKey("2026-12-28")).toBe("2026-W53");
    expect(isoWeekKey("2027-01-03")).toBe("2026-W53");
    expect(isoWeekKey("2027-01-04")).toBe("2027-W01");
    expect(isoWeekOf("2027-01-01")).toEqual({ year: 2026, week: 53 });
    expect(weekStartOf("2026-09-01")).toBe("2026-08-31");
    expect(isoWeekKey("2026-09-01")).toBe("2026-W36");
    expect(weekStartOf("2027-09-01")).toBe("2027-08-30");
    expect(isoWeekKey("2027-09-01")).toBe("2027-W35");
    // A Sunday belongs to the week that began the Monday before it; a Monday is its own week start.
    expect(weekStartOf("2026-10-11")).toBe("2026-10-05");
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05");
    expect(isoWeekKey("2026-10-05")).toBe("2026-W41");
    // Not a date: the input comes back, the key is blank.
    expect(weekStartOf("nope")).toBe("nope");
    expect(isoWeekKey("2026-02-30")).toBe("");
    expect(dayOffset("2026-12-31", 1)).toBe("2027-01-01");
    expect(dayOffset("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("the week's bounds run start hour to start hour on the Mondays, Eastern, and a daylight edge keeps the 06:00 wall clock", () => {
    // 2026-11-02, the Monday after the fall back (standard time, UTC-5).
    expect(weekBoundsOf("2026-11-02", 6)).toEqual({ startIso: "2026-11-02T11:00:00.000Z", endIso: "2026-11-09T11:00:00.000Z" });
    expect(weekBoundsOf("2026-11-04", 6)).toEqual(weekBoundsOf("2026-11-02", 6));
    // 2026-03-09, the Monday after the spring forward (daylight time, UTC-4).
    expect(weekBoundsOf("2026-03-09", 6)).toEqual({ startIso: "2026-03-09T10:00:00.000Z", endIso: "2026-03-16T10:00:00.000Z" });
    // The weeks holding the edges are 169 and 167 hours long and still bound at 06:00 Eastern.
    expect(weekBoundsOf("2026-10-29", 6)).toEqual({ startIso: "2026-10-26T10:00:00.000Z", endIso: "2026-11-02T11:00:00.000Z" });
    expect(weekBoundsOf("2026-03-05", 6)).toEqual({ startIso: "2026-03-02T11:00:00.000Z", endIso: "2026-03-09T10:00:00.000Z" });
    // The default start hour is the ruling's six; zero is the midnight law.
    expect(weekBoundsOf("2026-10-07")).toEqual({ startIso: "2026-10-05T10:00:00.000Z", endIso: "2026-10-12T10:00:00.000Z" });
    expect(weekBoundsOf("2026-10-07", 0)).toEqual({ startIso: "2026-10-05T04:00:00.000Z", endIso: "2026-10-12T04:00:00.000Z" });
  });

  it("month, quarter and season starts; the season is the latest MM-DD on or before the day", () => {
    expect(monthStartOf("2026-10-15")).toBe("2026-10-01");
    expect(quarterStartOf("2026-10-15")).toBe("2026-10-01");
    expect(quarterStartOf("2026-12-31")).toBe("2026-10-01");
    expect(quarterStartOf("2026-02-01")).toBe("2026-01-01");
    expect(quarterStartOf("2026-06-30")).toBe("2026-04-01");
    expect(quarterStartOf("2026-07-01")).toBe("2026-07-01");
    expect(seasonStartOf("2026-09-15", "09-01")).toBe("2026-09-01");
    expect(seasonStartOf("2026-09-01", "09-01")).toBe("2026-09-01");
    expect(seasonStartOf("2026-08-15", "09-01")).toBe("2025-09-01");
    expect(seasonStartOf("2026-09-15", "9/1")).toBeNull();
    expect(seasonStartOf("2026-09-15", null)).toBeNull();
    expect(seasonStartOf("nope", "09-01")).toBeNull();
  });

  it("the period start per kind, the pinned season date first, then the row's MM-DD, then the calendar year", () => {
    expect(PERIOD_KINDS).toEqual(["day", "week", "month", "quarter", "season"]);
    expect(periodStartFor("day", "2026-10-07")).toBe("2026-10-07");
    expect(periodStartFor("week", "2026-10-07")).toBe("2026-10-05");
    expect(periodStartFor("month", "2026-10-07")).toBe("2026-10-01");
    expect(periodStartFor("quarter", "2026-11-07")).toBe("2026-10-01");
    expect(periodStartFor("season", "2026-10-07", { seasonStartDate: "2026-09-03", seasonStartMd: "09-01" })).toBe("2026-09-03");
    // A pinned date after the day is not the season yet.
    expect(periodStartFor("season", "2026-10-07", { seasonStartDate: "2026-10-20", seasonStartMd: "09-01" })).toBe("2026-09-01");
    expect(periodStartFor("season", "2026-10-07", { seasonStartMd: "09-01" })).toBe("2026-09-01");
    expect(periodStartFor("season", "2026-03-07", { seasonStartMd: "09-01" })).toBe("2025-09-01");
    expect(periodStartFor("season", "2026-10-07")).toBe("2026-01-01");
    expect(periodStartFor("season", "2026-10-07", { seasonStartDate: "" })).toBe("2026-01-01");
  });

  it("stepping periods: a week is seven days, a month a month, a quarter three, a season a year; the end is the next start", () => {
    expect(periodShift("day", "2026-10-05", -1)).toBe("2026-10-04");
    expect(periodShift("week", "2026-10-05", -6)).toBe("2026-08-24");
    expect(periodShift("week", "2026-12-28", 1)).toBe("2027-01-04");
    expect(periodShift("month", "2026-01-01", -1)).toBe("2025-12-01");
    expect(periodShift("month", "2026-12-01", 1)).toBe("2027-01-01");
    expect(periodShift("month", "2026-10-01", -8)).toBe("2026-02-01");
    expect(periodShift("quarter", "2026-01-01", 1)).toBe("2026-04-01");
    expect(periodShift("quarter", "2026-01-01", -1)).toBe("2025-10-01");
    expect(periodShift("season", "2026-09-01", -1)).toBe("2025-09-01");
    expect(periodShift("season", "2026-09-01", 0)).toBe("2026-09-01");
    expect(periodEndOf("week", "2026-10-05")).toBe("2026-10-12");
    expect(periodEndOf("month", "2026-02-01")).toBe("2026-03-01");
    expect(periodEndOf("quarter", "2026-10-01")).toBe("2027-01-01");
    expect(periodEndOf("season", "2026-09-01")).toBe("2027-09-01");
    expect(periodEndOf("day", "2026-12-31")).toBe("2027-01-01");
    expect(periodShift("week", "nope", 1)).toBe("nope");
  });

  it("labels: W41, Oct 5 to 11; W53 across the year end; Oct 2026; Q4 2026; Spanish with its own words", () => {
    expect(periodLabel("week", "2026-10-05", "en")).toBe("W41, Oct 5 to 11");
    expect(periodLabel("week", "2026-12-28", "en")).toBe("W53, Dec 28 to Jan 3");
    expect(periodLabel("week", "2026-08-31", "en")).toBe("W36, Aug 31 to Sep 6");
    expect(periodLabel("month", "2026-10-01", "en")).toBe("Oct 2026");
    expect(periodLabel("quarter", "2026-10-01", "en")).toBe("Q4 2026");
    expect(periodLabel("quarter", "2026-04-01", "en")).toBe("Q2 2026");
    expect(periodLabel("day", "2026-10-05", "en")).toBe("Oct 5, 2026");
    expect(periodLabel("season", "2026-09-01", "en")).toBe("Season from Sep 1, 2026");
    expect(periodLabel("week", "2026-10-05", "es")).toBe("S41, 5 a 11 oct");
    expect(periodLabel("week", "2026-12-28", "es")).toBe("S53, 28 dic a 3 ene");
    expect(periodLabel("month", "2026-10-01", "es")).toBe("oct 2026");
    expect(periodLabel("quarter", "2026-10-01", "es")).toBe("T4 2026");
    expect(periodLabel("day", "2026-10-05", "es")).toBe("5 oct 2026");
    expect(periodLabel("season", "2026-09-01", "es")).toBe("Temporada desde 1 sep 2026");
    expect(periodLabel("week", "nope", "en")).toBe("nope");
  });

  it("harvest week n counts from the ISO week holding the season start: Sep 15 is week 3 of a Sep 1 season; none without a start", () => {
    expect(harvestWeekNumber("2026-09-15", "2026-09-01")).toBe(3);
    expect(harvestWeekNumber("2026-09-01", "2026-09-01")).toBe(1);
    expect(harvestWeekNumber("2026-08-31", "2026-09-01")).toBe(1);
    expect(harvestWeekNumber("2026-09-07", "2026-09-01")).toBe(2);
    expect(harvestWeekNumber("2026-12-31", "2026-09-01")).toBe(18);
    expect(harvestWeekNumber("2026-08-30", "2026-09-01")).toBeNull();
    expect(harvestWeekNumber("2026-09-15", null)).toBeNull();
    expect(harvestWeekNumber("2026-09-15", "")).toBeNull();
    expect(harvestWeekNumber("2026-09-15", "nope")).toBeNull();
  });
});
