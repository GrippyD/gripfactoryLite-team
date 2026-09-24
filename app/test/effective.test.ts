import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import { resolveLoadedAt } from "../src/actions";
import { EFFECTIVE_DATE_FIELD, EFFECTIVE_DATE_REASON, EFFECTIVE_PIN_FIELD, effectiveDateField, resolveEffectiveDate } from "../src/effective";
import { etDate, etInstant, etWallClock, farmInstantFromInput, isCalendarDate } from "../src/farmday";
import { SYSTEM_REASON } from "../src/config";
import { EDITABLE_FIELDS, stationByKey } from "../src/pipeline";
import { editPage } from "../src/pages";
import { renderField } from "../src/html";

/** THE EFFECTIVE DATE (canon 0.30.92). Owner rulings 2026-09-16, verbatim: "We
 * need to quickly add a date override in the load silo screen - PIN gated:
 * 21319" and ""Effective Date" = field on all transactional records - always
 * pin gated - defaults to today and rarely needs to be touched." */

// 9:30 AM Eastern on the 16th (daylight time, UTC-4).
const NOW = "2026-09-16T13:30:00.000Z";

function fakeDb(pin: string | null) {
  return {
    prepare(sql: string) {
      const self = {
        bind() {
          return self;
        },
        async first() {
          if (sql.includes("FROM app_config")) return pin == null ? null : { value: pin };
          return null;
        },
      };
      return self;
    },
  } as unknown as D1Database;
}

function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

describe("THE EFFECTIVE DATE (canon 0.30.92): the farm's clock", () => {
  it("resolves an Eastern wall clock on a day to its UTC instant, both offsets", () => {
    expect(etInstant("2026-09-15", "20:30")).toBe("2026-09-16T00:30:00.000Z");
    expect(etInstant("2026-09-16", "07:46")).toBe("2026-09-16T11:46:00.000Z");
    expect(etInstant("2026-01-14", "07:00")).toBe("2026-01-14T12:00:00.000Z");
    // The clock's own day reads back.
    expect(etDate(etInstant("2026-09-15", "23:59"))).toBe("2026-09-15");
    expect(etDate(etInstant("2026-09-15", "00:00"))).toBe("2026-09-15");
    // A bad shape is an empty string, never a guess.
    expect(etInstant("2026-09-15", "24:00")).toBe("");
    expect(etInstant("2026-09-31", "10:00")).toBe("");
    expect(etInstant("yesterday", "10:00")).toBe("");
  });

  it("knows a real calendar day", () => {
    expect(isCalendarDate("2026-09-16")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-9-16")).toBe(false);
    expect(isCalendarDate("2026-09-16T00:00:00Z")).toBe(false);
  });
});

describe("THE EFFECTIVE DATE (canon 0.30.92): the field", () => {
  it("renders collapsed, reading today, with the date capped at today and the Admin PIN box", () => {
    const html = effectiveDateField(NOW, "en", "Here the Start time falls on that day and is required with it.");
    expect(html).toContain('<details class="effective-date" data-effective-date>');
    expect(html).toContain("Effective Date: <span data-effective-summary>2026-09-16</span>");
    expect(html).toContain("(today)");
    expect(html).toMatch(/<input type="date" name="effective_date" value="2026-09-16" max="2026-09-16" data-effective-input data-effective-default="2026-09-16">/);
    expect(html).toMatch(/<input type="password" name="effective_pin" inputmode="numeric" autocomplete="off" data-effective-pin>/);
    expect(html).toContain("Defaults to today and rarely needs to be touched. Any other day needs the Admin PIN. Here the Start time falls on that day and is required with it.");
    // The summary follows a changed day.
    expect(html).toContain("(changed, Admin PIN)");
    expect(html).toContain("[data-effective-input]");
    // The field names are the law's, shared by every record that carries it.
    expect(EFFECTIVE_DATE_FIELD).toBe("effective_date");
    expect(EFFECTIVE_PIN_FIELD).toBe("effective_pin");
    expect(EFFECTIVE_DATE_REASON).toBe(SYSTEM_REASON.effective_date);
  });

  it("speaks Spanish", () => {
    const html = effectiveDateField(NOW, "es");
    expect(html).toContain("Fecha efectiva: <span data-effective-summary>2026-09-16</span>");
    expect(html).toContain("(hoy)");
    expect(html).toContain("PIN de Admin");
    expect(html).toContain("Por defecto es hoy y rara vez hay que tocarla.");
  });
});

describe("THE EFFECTIVE DATE (canon 0.30.92): the post", () => {
  it("reads today when absent, blank, or today itself, asking no PIN", async () => {
    const db = fakeDb("21319");
    expect(await resolveEffectiveDate(db, fd({}), NOW)).toEqual({ date: "2026-09-16", today: "2026-09-16", overridden: false });
    expect(await resolveEffectiveDate(db, fd({ effective_date: "" }), NOW)).toEqual({ date: "2026-09-16", today: "2026-09-16", overridden: false });
    expect(await resolveEffectiveDate(db, fd({ effective_date: "2026-09-16" }), NOW)).toEqual({ date: "2026-09-16", today: "2026-09-16", overridden: false });
    // Today is the farm's day: 11:30 PM Eastern on the 15th is 03:30Z on the 16th.
    expect(await resolveEffectiveDate(db, fd({ effective_date: "2026-09-15" }), "2026-09-16T03:30:00.000Z")).toEqual({
      date: "2026-09-15",
      today: "2026-09-15",
      overridden: false,
    });
  });

  it("honors another day only with the Admin PIN, never ahead of today", async () => {
    const db = fakeDb("21319");
    expect(await resolveEffectiveDate(db, fd({ effective_date: "2026-09-15", effective_pin: "21319" }), NOW)).toEqual({
      date: "2026-09-15",
      today: "2026-09-16",
      overridden: true,
    });
    // Any day back under the PIN.
    expect((await resolveEffectiveDate(db, fd({ effective_date: "2026-08-01", effective_pin: "21319" }), NOW)).date).toBe("2026-08-01");
    await expect(resolveEffectiveDate(db, fd({ effective_date: "2026-09-15" }), NOW)).rejects.toMatchObject({ status: 403 });
    await expect(resolveEffectiveDate(db, fd({ effective_date: "2026-09-15", effective_pin: "17853" }), NOW)).rejects.toMatchObject({ status: 403 });
    await expect(resolveEffectiveDate(db, fd({ effective_date: "2026-09-17", effective_pin: "21319" }), NOW)).rejects.toMatchObject({ status: 400 });
    await expect(resolveEffectiveDate(db, fd({ effective_date: "09/15/2026", effective_pin: "21319" }), NOW)).rejects.toMatchObject({ status: 400 });
    // No PIN configured: nothing opens the field (the site is not unlocked by a blank).
    await expect(resolveEffectiveDate(fakeDb(null), fd({ effective_date: "2026-09-15", effective_pin: "" }), NOW)).rejects.toBeInstanceOf(HttpError);
  });

  it("puts the Start time on the Effective Date, any day back, and refuses a mismatch", () => {
    // The browser's instant for 8:30 PM on the 15th agrees with the day.
    expect(resolveLoadedAt("20:30", "2026-09-16T00:30:00.000Z", NOW, "2026-09-15")).toBe("2026-09-16T00:30:00.000Z");
    // No script ran: the farm's clock resolves the typed time on the day.
    expect(resolveLoadedAt("20:30", null, NOW, "2026-09-15")).toBe("2026-09-16T00:30:00.000Z");
    expect(resolveLoadedAt("20:30", "", NOW, "2026-09-15")).toBe("2026-09-16T00:30:00.000Z");
    // The two-day floor is the crew's, not the owner's.
    expect(resolveLoadedAt("09:00", null, NOW, "2026-09-01")).toBe("2026-09-01T13:00:00.000Z");
    // Ahead of now still refuses (today's day, an afternoon time).
    expect(() => resolveLoadedAt("15:00", null, NOW, "2026-09-16")).toThrow(HttpError);
    // An instant off the day refuses in words.
    expect(() => resolveLoadedAt("20:30", "2026-09-15T00:30:00.000Z", NOW, "2026-09-15")).toThrow(/does not fall on the Effective Date/);
    expect(() => resolveLoadedAt("20:30", "not a date", NOW, "2026-09-15")).toThrow(HttpError);
    // Blank time under a day is the caller's refusal; the resolver alone loads now.
    expect(resolveLoadedAt(null, null, NOW, "2026-09-15")).toBe(NOW);
    // Without an Effective Date the old law stands: two days back is the floor.
    expect(() => resolveLoadedAt("09:00", "2026-09-01T13:00:00.000Z", NOW)).toThrow(/two days back/);
  });
});

describe("THE EFFECTIVE DATE PER STATION (canon 0.30.94): the registry", () => {
  const emptyLookups = {};
  const emptyQueues = {};
  const emptyByKey = {};

  it("each station carries one effective_date field (Trim, Cryo, Wet Weight)", () => {
    for (const key of ["trim_packages", "cryo_weight", "wet_weight"]) {
      const station = stationByKey(key);
      expect(station, key).toBeTruthy();
      const eff = station!.fields.filter((f) => f.input === "effective_date");
      expect(eff.length, key).toBe(1);
      expect(eff[0].name, key).toBe("effective_date");
      expect(eff[0].label, key).toBe("Effective Date");
    }
    // Trim and Cryo no longer carry the old plain date fields.
    for (const key of ["trim_packages", "cryo_weight"]) {
      const names = stationByKey(key)!.fields.map((f) => f.name);
      expect(names, key).not.toContain("trim_date");
      expect(names, key).not.toContain("cryo_date");
    }
  });

  it("renderField emits the client-defaulted Effective Date component for input:effective_date", () => {
    const field = stationByKey("trim_packages")!.fields.find((f) => f.input === "effective_date")!;
    const html = renderField(field as never, emptyLookups, emptyQueues, emptyByKey, "en");
    expect(html).toContain('<details class="effective-date" data-effective-date>');
    // No server today: the date is blank and marked for the client to fill.
    expect(html).toMatch(/<input type="date" name="effective_date" data-effective-input data-effective-default="" data-effective-auto>/);
    expect(html).toContain('name="effective_pin"');
    expect(html).toContain("The trim date saved on each package entered. Today by default; the Admin PIN sets another day.");
    // The client fills today, its max and its default.
    expect(html).toContain("data-effective-auto");
    expect(html).toContain('input.setAttribute("max", today)');
  });

  it("a stored value renders as the field's value (an unload session that was backdated)", () => {
    const html = effectiveDateField(null, "en", undefined, "2026-09-15");
    expect(html).toContain('value="2026-09-15"');
    expect(html).toContain("data-effective-auto");
    // Blank current renders no value (the plain registry case).
    const blank = effectiveDateField(null, "en");
    expect(blank).not.toMatch(/name="effective_date"[^>]*value=/);
  });
});

/** THE ZONELESS ZERO (canon 0.30.104). Owner, 2026-09-16, of Silo 4's clock four
 * hours long: "Is this a me thing or a system thing?" and "Why wouldn't it just
 * match the system timezone?" A pencil had stored "2026-09-15 01:00" as typed:
 * local in the browser, UTC in the Worker. */
describe("THE ZONELESS ZERO (canon 0.30.104): a typed time is farm time and lands as an instant", () => {
  it("a zoneless wall clock is Eastern, with a space or a T, seconds ignored", () => {
    expect(farmInstantFromInput("2026-09-15 01:00")).toBe("2026-09-15T05:00:00.000Z");
    expect(farmInstantFromInput("2026-09-15T01:00")).toBe("2026-09-15T05:00:00.000Z");
    expect(farmInstantFromInput("2026-09-15 01:00:37")).toBe("2026-09-15T05:00:00.000Z");
    expect(farmInstantFromInput("  2026-09-14 21:00 ")).toBe("2026-09-15T01:00:00.000Z");
    // Standard time in January: five hours.
    expect(farmInstantFromInput("2026-01-14 07:00")).toBe("2026-01-14T12:00:00.000Z");
  });

  it("an instant carrying its zone stands as it is", () => {
    expect(farmInstantFromInput("2026-09-15T05:00:00.000Z")).toBe("2026-09-15T05:00:00.000Z");
    expect(farmInstantFromInput("2026-09-15T01:00Z")).toBe("2026-09-15T01:00:00.000Z");
    expect(farmInstantFromInput("2026-09-15T01:00:00-04:00")).toBe("2026-09-15T05:00:00.000Z");
  });

  it("any other shape is null, never a guess", () => {
    expect(farmInstantFromInput("")).toBeNull();
    expect(farmInstantFromInput(null)).toBeNull();
    expect(farmInstantFromInput("yesterday morning")).toBeNull();
    expect(farmInstantFromInput("2026-09-15")).toBeNull();
    expect(farmInstantFromInput("2026-09-15 25:00")).toBeNull();
    expect(farmInstantFromInput("2026-09-31 10:00")).toBeNull();
    expect(farmInstantFromInput("09/15/2026 01:00")).toBeNull();
  });

  it("a stored instant reads back as the Eastern wall clock", () => {
    expect(etWallClock("2026-09-15T05:00:00.000Z")).toBe("2026-09-15 01:00");
    expect(etWallClock("2026-09-15T01:00:00.000Z")).toBe("2026-09-14 21:00");
    expect(etWallClock("2026-01-14T12:00:00.000Z")).toBe("2026-01-14 07:00");
    expect(etWallClock("not a time")).toBe("");
    // The round trip is the identity on a wall clock.
    expect(etWallClock(farmInstantFromInput("2026-09-15 01:00")!)).toBe("2026-09-15 01:00");
  });

  it("the silo load pencil is a farm-time field that shows the stored zero in Eastern and never asks for ISO UTC", () => {
    const field = EDITABLE_FIELDS.silo_loads.find((f) => f.name === "loaded_at")!;
    expect(field.farmTime).toBe(true);
    expect(field.label).toBe("Loaded at (farm time, YYYY-MM-DD HH:MM, the clock's zero)");
    const html = editPage("silo_loads", "load-1", { loaded_at: "2026-09-15T05:00:00.000Z", notes: null }, {});
    expect(html).toContain('name="loaded_at" value="2026-09-15 01:00" placeholder="YYYY-MM-DD HH:MM"');
    expect(html).not.toContain("ISO UTC");
    // A zoneless value already stored (the Silo 4 case) shows as the Eastern
    // wall clock of the instant the Worker is running the clock from (it reads
    // the zoneless text as UTC), so the pencil tells the truth about the zero
    // and the owner types the wall clock he meant.
    // (The Worker's zone is UTC, so there the box reads 2026-09-14 21:00; a
    // test machine in Eastern reads the zoneless text as its own wall clock, so
    // the pin is the shape, not the digits.)
    const stale = editPage("silo_loads", "load-1", { loaded_at: "2026-09-15 01:00", notes: null }, {});
    expect(stale).toMatch(/name="loaded_at" value="\d{4}-\d{2}-\d{2} \d{2}:\d{2}" placeholder="YYYY-MM-DD HH:MM"/);
  });
});
