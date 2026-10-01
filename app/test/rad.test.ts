import { describe, expect, it } from "vitest";
import {
  completeRadRun,
  newRadRun,
  reopenRadRun,
  scheduleRadPackage,
  setRadRunGrey,
  setRadStartTime,
  startRadRun,
  unscheduleRadPackage,
  unstartRadRun,
} from "../src/actions";
import { applyTransition, demoteStep } from "../src/config";
import { loadTestingSection } from "../src/console";
import { etClock12, wallClock24From12 } from "../src/farmday";
import { listRadAvailable, loadRadBoard, radOperationPage, radSchedulePage, type RadRunView } from "../src/rad";
import { formOf, migratedDb, seedMirror, seedPerson } from "./migrated";

const T = "2026-09-30T16:00:00.000Z";
const PIN = "21319";

function tag(tail: string): string {
  return `1A4050300000000000A${tail}`;
}

function harvest(grow: string, serial: string): string {
  return `26273-PNN-${grow}-027-0-NA-${serial}`;
}

function seedRad(
  m: Awaited<ReturnType<typeof migratedDb>>,
  tail: string,
  item: string,
  status: string,
  grow = "GH",
  serial = tail,
  sourceHarvest: string | null = harvest(grow, serial)
): string {
  const code = tag(tail);
  seedMirror(m, {
    tag: code,
    harvest: sourceHarvest,
    item,
    strain: "Fruity Pebbles",
    grams: 100,
    status,
    license: "GR-C-001132",
  });
  return code;
}

describe("THE RAD SCHEDULE AND RAD OPERATION (canon 0.30.327)", () => {
  it("sorts state, type, grow type, then the last five, and the filter rides", async () => {
    const m = await migratedDb();
    seedRad(m, "00020", "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "ID", "26820");
    seedRad(m, "00003", "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "26803");
    seedRad(m, "00050", "WPR - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "26850");
    seedRad(m, "00008", "SHA - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "26808");
    seedRad(m, "00015", "WPR - Fruity Pebbles - PNN - O", "TestFailed", "GH", "26815");
    seedRad(m, "00001", "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "26801", null);
    seedRad(m, "00002", "BUD - Fruity Pebbles - PNN - O", "TestPassed", "GH", "26802");
    seedRad(m, "00004", "MIX - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "26804");
    const tags = (await listRadAvailable(m.db)).map((row) => row.tag);
    expect(tags).toEqual([tag("00020"), tag("00003"), tag("00050"), tag("00008"), tag("00015")]);
    const board = await loadRadBoard(m.db, "00003");
    const html = radSchedulePage(board, "es", "");
    expect(html).toContain("Programa del Rad");
    expect(html).toContain("Disponibles");
    expect(html).toContain("Programados");
    expect(html).toContain("Listos");
    expect(html).toContain("Nueva corrida");
    expect(html).toContain(`data-rad-tag="${tag("00003")}"`);
    const hiddenRow = html.slice(html.indexOf(`data-rad-tag="${tag("00020")}"`) - 80, html.indexOf(">", html.indexOf(`data-rad-tag="${tag("00020")}"`)));
    const shownRow = html.slice(html.indexOf(`data-rad-tag="${tag("00003")}"`) - 80, html.indexOf(">", html.indexOf(`data-rad-tag="${tag("00003")}"`)));
    expect(hiddenRow).toContain(" hidden");
    expect(shownRow).not.toContain(" hidden");
    const operation = radOperationPage({ ...board, running: [], scheduled: [], done: [] }, "es");
    expect(operation).toContain("Operacion del Rad");
    expect(operation).toContain("En el Rad");
  });

  it("a completed package leaves Available until its lab state moves, and a reopened run lists it again", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const done = seedRad(m, "40001", "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "27301");
    const other = seedRad(m, "40002", "WPR - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "27302");
    await scheduleRadPackage(m.db, formOf({ person_id: person, tag: done }));
    const run = (await loadRadBoard(m.db)).scheduled[0];
    if (!run) throw new Error("no run");
    await startRadRun(m.db, run.id, formOf({ person_id: person }));
    await completeRadRun(m.db, run.id, formOf({ person_id: person }));
    expect((await listRadAvailable(m.db)).map((row) => row.tag)).toEqual([other]);
    await expect(scheduleRadPackage(m.db, formOf({ person_id: person, tag: done }))).rejects.toMatchObject({
      message: "That package is not available.",
    });
    m.run(`UPDATE metrc_packages SET lab_test_status = 'TestFailed' WHERE tag = ?`, done);
    expect((await listRadAvailable(m.db)).map((row) => row.tag)).toEqual([other, done]);
    m.run(`UPDATE metrc_packages SET lab_test_status = 'NotSubmitted' WHERE tag = ?`, done);
    expect((await listRadAvailable(m.db)).map((row) => row.tag)).toEqual([other]);
    await reopenRadRun(m.db, run.id, formOf({ person_id: person, unfinish_pin: PIN }));
    expect((await listRadAvailable(m.db)).map((row) => row.tag)).toEqual([other]);
    await completeRadRun(m.db, run.id, formOf({ person_id: person }));
    expect((await listRadAvailable(m.db)).map((row) => row.tag)).toEqual([other]);
  });

  it("fills the newest open run to ten, refuses the eleventh, and carries the grey", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const codes: string[] = [];
    for (let i = 1; i <= 11; i++) {
      const tail = String(10000 + i);
      codes.push(seedRad(m, tail, "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", String(27000 + i)));
    }
    const first = await scheduleRadPackage(m.db, formOf({ person_id: person, tag: codes[0] }));
    expect(first.redirect).toContain("ok=scheduled");
    let board = await loadRadBoard(m.db);
    expect(board.scheduled).toHaveLength(1);
    expect(board.scheduled[0]?.grey).toBe(100);
    const runA = board.scheduled[0]?.id ?? "";
    for (let i = 1; i < 10; i++) {
      await scheduleRadPackage(m.db, formOf({ person_id: person, tag: codes[i] }));
    }
    await expect(scheduleRadPackage(m.db, formOf({ person_id: person, tag: codes[10] }))).rejects.toMatchObject({
      message: "That run is full; start a new run.",
    });
    await setRadRunGrey(m.db, runA, formOf({ person_id: person, grey: "1500" }));
    const greyPage = radSchedulePage(await loadRadBoard(m.db), "es");
    expect(greyPage).toContain("Gy");
    expect(greyPage).toContain("value=\"1500\" selected");
    await newRadRun(m.db, formOf({ person_id: person }));
    board = await loadRadBoard(m.db);
    const runB = board.scheduled.find((run) => run.id !== runA);
    expect(runB?.grey).toBe(1500);
    expect(runB?.packages).toHaveLength(0);
    await scheduleRadPackage(m.db, formOf({ person_id: person, tag: codes[10] }));
    board = await loadRadBoard(m.db);
    const landed = board.scheduled.find((run) => run.packages.some((pkg) => pkg.tag === codes[10]));
    expect(landed?.id).toBe(runB?.id);
    const full = board.scheduled.find((run) => run.id === runA);
    const gone = full?.packages[0];
    if (!gone) throw new Error("the first run lost its packages");
    await unscheduleRadPackage(m.db, runA, gone.id, formOf({ person_id: person }));
    board = await loadRadBoard(m.db);
    const after = board.scheduled.find((run) => run.id === runA);
    expect(after?.packages.some((pkg) => pkg.id === gone.id)).toBe(false);
    await expect(setRadRunGrey(m.db, runA, formOf({ person_id: person, grey: "150" }))).rejects.toMatchObject({
      message: "Grey is a whole Gray from 100 to 3000 by 100.",
    });
  });

  it("refuses an empty start and a second start, then unstarts", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const one = seedRad(m, "20011", "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "27111");
    const two = seedRad(m, "20012", "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "27112");
    await newRadRun(m.db, formOf({ person_id: person }));
    const empty = (await loadRadBoard(m.db)).scheduled[0];
    if (!empty) throw new Error("no empty run");
    await expect(startRadRun(m.db, empty.id, formOf({ person_id: person }))).rejects.toMatchObject({
      message: "A run needs a package before it starts.",
    });
    await scheduleRadPackage(m.db, formOf({ person_id: person, tag: one }));
    await newRadRun(m.db, formOf({ person_id: person }));
    await scheduleRadPackage(m.db, formOf({ person_id: person, tag: two }));
    const board = await loadRadBoard(m.db);
    const withPackages = board.scheduled.filter((run) => run.packages.length > 0);
    expect(withPackages).toHaveLength(2);
    const first = withPackages[0];
    const second = withPackages[1];
    if (!first || !second) throw new Error("no run");
    await startRadRun(m.db, first.id, formOf({ person_id: person }));
    await expect(startRadRun(m.db, second.id, formOf({ person_id: person }))).rejects.toMatchObject({
      message: "The Rad is running another run.",
    });
    const running = await loadRadBoard(m.db);
    const live = running.running[0];
    if (!live) throw new Error("not running");
    const html = radOperationPage(running, "en");
    expect(html).toContain("data-clock");
    expect(html).toContain('data-state="running"');
    expect(html).toContain("data-started=");
    expect(html).toMatch(/\d+d \d{2}:\d{2}:\d{2}/);
    await unstartRadRun(m.db, live.id, formOf({ person_id: person }));
    const back = await loadRadBoard(m.db);
    expect(back.running).toHaveLength(0);
    expect(back.scheduled.some((run) => run.id === live.id)).toBe(true);
  });

  it("returns a released row, adopts a stranger, leaves a queued row, and Reopen lifts the mark", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const released = seedRad(m, "30001", "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "27201");
    const queued = seedRad(m, "30002", "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "27202");
    const stranger = seedRad(m, "30003", "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "27203");
    const failed = seedRad(m, "30004", "WPR - Fruity Pebbles - PNN - O", "TestFailed", "GH", "27204");
    m.run(
      `INSERT INTO wip_packages (id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at)
       VALUES ('wip-rel', ?, 'BUD', 100, 'released', 'trim', ?, ?)`,
      released,
      T,
      T
    );
    m.run(
      `INSERT INTO wip_packages (id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at)
       VALUES ('wip-q', ?, 'BUD', 100, 'testing_queue', 'trim', ?, ?)`,
      queued,
      T,
      T
    );
    for (const code of [released, queued, stranger, failed]) {
      await scheduleRadPackage(m.db, formOf({ person_id: person, tag: code }));
    }
    const run = (await loadRadBoard(m.db)).scheduled[0];
    if (!run) throw new Error("no run");
    await startRadRun(m.db, run.id, formOf({ person_id: person }));
    const done = await completeRadRun(m.db, run.id, formOf({ person_id: person }));
    expect(done.redirect).toContain("ok=completed");
    expect(m.get(`SELECT status FROM wip_packages WHERE id = 'wip-rel'`)?.status).toBe("testing_queue");
    expect(m.get(`SELECT status FROM wip_packages WHERE id = 'wip-q'`)?.status).toBe("testing_queue");
    expect(m.all(`SELECT id FROM wip_packages WHERE UPPER(package_code) = ?`, queued)).toHaveLength(1);
    const born = m.get(`SELECT status, source, cryo_weight_grams FROM wip_packages WHERE UPPER(package_code) = ?`, stranger);
    expect(born?.status).toBe("testing_queue");
    expect(born?.source).toBe("metrc");
    expect(born?.cryo_weight_grams).toBeNull();
    expect(m.get(`SELECT hbn FROM harvest_batches WHERE hbn = ?`, harvest("GH", "27203"))?.hbn).toBe(harvest("GH", "27203"));
    expect(m.all(`SELECT id FROM production_schedules WHERE wip_package_id IN (SELECT id FROM wip_packages WHERE UPPER(package_code) = ?)`, stranger)).toHaveLength(0);
    const reason = m.get(
      `SELECT reason FROM record_change_log WHERE record_table = 'wip_packages' AND record_id = 'wip-rel' AND field = 'status'`
    );
    expect(reason?.reason).toBe("rad run complete");
    const readyBefore = (await loadTestingSection(m.db, 2026)).panes.find((pane) => pane.gate === "ready");
    expect(readyBefore?.packages).toBe(3);
    const board = await loadRadBoard(m.db);
    expect(board.done.some((row) => row.id === run.id)).toBe(true);
    expect(radSchedulePage(board, "en").includes("ready for testing")).toBe(true);
    await expect(reopenRadRun(m.db, run.id, formOf({ person_id: person, unfinish_pin: "00000" }))).rejects.toMatchObject({ status: 403 });
    await reopenRadRun(m.db, run.id, formOf({ person_id: person, unfinish_pin: PIN }));
    expect(m.get(`SELECT status FROM wip_packages WHERE id = 'wip-rel'`)?.status).toBe("testing_queue");
    expect(m.get(`SELECT status FROM rad_runs WHERE id = ?`, run.id)?.status).toBe("running");
    const readyAfter = (await loadTestingSection(m.db, 2026)).panes.find((pane) => pane.gate === "ready");
    expect(readyAfter?.packages).toBe(0);
    expect(applyTransition("rad_complete", "released")).toBe("testing_queue");
    expect(applyTransition("rad_complete", "pasteurized")).toBe("testing_queue");
    expect(demoteStep("wip_packages", "testing_queue")).toEqual({ to: "cryo_queue" });
  });

  it("THE RAD START TIME (canon 0.30.330): the 12-hour clock resolves to the farm's 24-hour wall clock, and the prefill reads it back", () => {
    expect(wallClock24From12("12:00", "AM")).toBe("00:00");
    expect(wallClock24From12("12:30", "PM")).toBe("12:30");
    expect(wallClock24From12("01:05", "PM")).toBe("13:05");
    expect(wallClock24From12("11:59", "PM")).toBe("23:59");
    expect(wallClock24From12("07:05", " am ")).toBe("07:05");
    expect(wallClock24From12("13:00", "PM")).toBe("");
    expect(wallClock24From12("7:05", "AM")).toBe("");
    expect(wallClock24From12("12:60", "AM")).toBe("");
    expect(wallClock24From12("09:00", "")).toBe("");
    expect(etClock12("2026-09-30T06:35:00.000Z")).toEqual({ hhmm: "02:35", meridiem: "AM" });
    expect(etClock12("2026-09-30T16:00:00.000Z")).toEqual({ hhmm: "12:00", meridiem: "PM" });
    expect(etClock12("2026-09-30T04:05:00.000Z")).toEqual({ hhmm: "12:05", meridiem: "AM" });
    expect(etClock12("2026-10-01T03:59:00.000Z")).toEqual({ hhmm: "11:59", meridiem: "PM" });
    expect(etClock12("nope")).toEqual({ hhmm: "", meridiem: "AM" });
  });

  it("sets a running run's start on its farm day, logs the old and new instants, keeps started_by, and refuses what it must", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const other = seedPerson(m, "person-2");
    const one = seedRad(m, "50001", "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "27501");
    await scheduleRadPackage(m.db, formOf({ person_id: person, tag: one }));
    const run = (await loadRadBoard(m.db)).scheduled[0];
    if (!run) throw new Error("no run");
    await expect(setRadStartTime(m.db, run.id, formOf({ person_id: person, start_time: "10:30", meridiem: "AM" }))).rejects.toMatchObject({
      status: 400,
      message: "That run is not running.",
    });
    await startRadRun(m.db, run.id, formOf({ person_id: person }));
    const T0 = "2026-09-20T16:00:00.000Z";
    m.run(`UPDATE rad_runs SET started_at = ? WHERE id = ?`, T0, run.id);
    const saved = await setRadStartTime(m.db, run.id, formOf({ person_id: other, start_time: "10:30", meridiem: "AM" }));
    expect(saved.redirect).toContain("ok=start_time");
    expect(m.get(`SELECT started_at, started_by, updated_by FROM rad_runs WHERE id = ?`, run.id)).toMatchObject({
      started_at: "2026-09-20T14:30:00.000Z",
      started_by: person,
      updated_by: other,
    });
    expect(
      m.all(
        `SELECT old_value, new_value, actor_person_id FROM record_change_log
         WHERE record_table = 'rad_runs' AND record_id = ? AND field = 'started_at' AND reason = 'rad start time set'`,
        run.id
      )
    ).toEqual([{ old_value: T0, new_value: "2026-09-20T14:30:00.000Z", actor_person_id: other }]);
    // A time before the start hour falls on the next calendar date of the run's farm day.
    await setRadStartTime(m.db, run.id, formOf({ person_id: person, start_time: "01:15", meridiem: "AM" }));
    expect(m.get(`SELECT started_at FROM rad_runs WHERE id = ?`, run.id)?.started_at).toBe("2026-09-21T05:15:00.000Z");
    await setRadStartTime(m.db, run.id, formOf({ person_id: person, start_time: "12:00", meridiem: "AM" }));
    expect(m.get(`SELECT started_at FROM rad_runs WHERE id = ?`, run.id)?.started_at).toBe("2026-09-21T04:00:00.000Z");
    // The same time again writes nothing and still answers the flash.
    const again = await setRadStartTime(m.db, run.id, formOf({ person_id: person, start_time: "12:00", meridiem: "AM" }));
    expect(again.redirect).toContain("ok=start_time");
    expect(m.all(`SELECT id FROM record_change_log WHERE record_table = 'rad_runs' AND record_id = ? AND reason = 'rad start time set'`, run.id)).toHaveLength(3);
    for (const bad of [
      { start_time: "13:00", meridiem: "PM" },
      { start_time: "7:05", meridiem: "AM" },
      { start_time: "12:60", meridiem: "AM" },
      { start_time: "09:00", meridiem: "" },
    ]) {
      await expect(setRadStartTime(m.db, run.id, formOf({ person_id: person, ...bad }))).rejects.toMatchObject({
        status: 400,
        message: "Start time must be HH:MM.",
      });
    }
    await expect(setRadStartTime(m.db, "nope", formOf({ person_id: person, start_time: "09:00", meridiem: "AM" }))).rejects.toMatchObject({
      status: 404,
      message: "Unknown run.",
    });
    // Ahead of now beyond ten minutes: a run whose farm day is still to come.
    m.run(`UPDATE rad_runs SET started_at = ? WHERE id = ?`, "2030-01-01T17:00:00.000Z", run.id);
    await expect(setRadStartTime(m.db, run.id, formOf({ person_id: person, start_time: "01:00", meridiem: "PM" }))).rejects.toMatchObject({
      status: 400,
      message: "Start time is ahead of now.",
    });
    expect(m.get(`SELECT started_at FROM rad_runs WHERE id = ?`, run.id)?.started_at).toBe("2030-01-01T17:00:00.000Z");
  });

  it("the running card carries the Start Time box after the clock, prefilled in farm time; the other cards carry none", () => {
    const pkg = { id: "p1", tag: tag("60001"), type: "BUD", position: 1, grams: 100, lab: "NotSubmitted", strain: "Fruity Pebbles", quantityLabel: "100 g" };
    const live: RadRunView = { id: "run-live", status: "running", grey: 100, scheduledAt: T, startedAt: "2026-09-30T06:35:00.000Z", completedAt: null, packages: [pkg] };
    const queued: RadRunView = { id: "run-next", status: "scheduled", grey: 100, scheduledAt: T, startedAt: null, completedAt: null, packages: [pkg] };
    const finished: RadRunView = {
      id: "run-done",
      status: "complete",
      grey: 100,
      scheduledAt: T,
      startedAt: "2026-09-30T17:59:00.000Z",
      completedAt: "2026-09-30T19:00:00.000Z",
      packages: [pkg],
    };
    const html = radOperationPage({ q: "", available: [], running: [live], scheduled: [queued], done: [finished] }, "en", "start_time");
    const at = html.indexOf("data-rad-start-line");
    expect(at).toBeGreaterThan(-1);
    const line = html.slice(at, html.indexOf("</div>", at));
    expect(line.indexOf("data-clock")).toBeGreaterThan(-1);
    expect(line.indexOf("data-clock")).toBeLessThan(line.indexOf("data-rad-start-time"));
    expect(line).toContain('action="/compliance/rad_operation/run/run-live/start_time"');
    expect(line).toContain("Start Time");
    expect(line).toContain('name="start_time" value="02:35"');
    expect(line).toContain('pattern="(0[1-9]|1[0-2]):[0-5][0-9]"');
    expect(line).toContain("data-time12-mask");
    expect(line).toContain('<option value="AM" selected>AM</option>');
    expect(line).toContain('<option value="PM">PM</option>');
    expect(html.split("data-rad-start-time").length - 1).toBe(1);
    expect(html.split('querySelectorAll("[data-time12-mask]")').length - 1).toBe(1);
    expect(html).toContain("Start time saved.");
    const evening: RadRunView = { ...live, startedAt: "2026-09-30T17:59:00.000Z" };
    const es = radOperationPage({ q: "", available: [], running: [evening], scheduled: [], done: [] }, "es", "start_time");
    const esAt = es.indexOf("data-rad-start-line");
    const esLine = es.slice(esAt, es.indexOf("</div>", esAt));
    expect(esLine).toContain(">Hora de inicio</label>");
    expect(es).toContain("Hora de inicio guardada.");
    expect(es).toContain('name="start_time" value="01:59"');
    expect(es).toContain('<option value="PM" selected>PM</option>');
  });
});
