import { describe, expect, it } from "vitest";
import { isPrepackWpr, parseCryoTypeCategories, parsePrepackItems, parsePrepackUnits, prepackItemForUnit } from "../src/config";
import { newPackagesRows } from "../src/cryo";
import {
  addPrepackLine,
  buildPrepackFinishCsv,
  carryTake,
  defaultUnit,
  ellipsisSix,
  finishPrepack,
  lastSix,
  lineGrams,
  listPendingPrepackFiles,
  loadPrepackPane,
  prepackFinishCsv,
  prepackNewPackagesLines,
  prepackPage,
  type PrepackPane,
} from "../src/prepack";
import { adoptFromMetrc, schedulePackage, unscheduleItem } from "../src/actions";
import { listPrepackPanes } from "../src/db";
import { formOf, migratedDb, seedMirror, seedPerson } from "./migrated";

describe("the prepack feed and the line", () => {
  it("counts cryo WPR, including SMALLS mapped to WPR, and not BUD", () => {
    const map = parseCryoTypeCategories(null);
    expect(isPrepackWpr("WPR", map)).toBe(true);
    expect(isPrepackWpr("SMALLS", map)).toBe(true);
    expect(isPrepackWpr("BUD", map)).toBe(false);
    expect(isPrepackWpr("SHAKE", map)).toBe(false);
  });

  it("labels a package by the last six of its tag", () => {
    expect(lastSix("1A4050300000000000000A01")).toBe("000A01");
    expect(ellipsisSix("1A4050300000000000000A01")).toBe("...000A01");
    expect(lastSix("ABC")).toBe("ABC");
  });

  it("defaults the unit to the last one used, else 3.5", () => {
    const units = parsePrepackUnits("3.5,7,14,28");
    expect(defaultUnit(units, null)).toBe("3.5");
    expect(defaultUnit(units, 7)).toBe("7");
    expect(defaultUnit(parsePrepackUnits(""), null)).toBe("3.5");
  });

  it("rounds a line to whole grams and lets a carry cover the first grams", () => {
    expect(lineGrams(2, 3.5)).toBe(7);
    expect(lineGrams(1, 3.5)).toBe(4);
    expect(carryTake(6, 4)).toBe(4);
    expect(carryTake(6, 10)).toBe(6);
    expect(carryTake(0, 4)).toBe(0);
  });

  it("writes New Packages in Each with the parent ingredient in whole grams", () => {
    const items = parsePrepackItems("3.5=PREPACK 3.5;7=PREPACK 7;14=PREPACK 14;28=PREPACK 28");
    expect(prepackItemForUnit(items, "3.5")).toBe("PREPACK 3.5");
    expect(prepackItemForUnit(items, "9")).toBeNull();
    const rows = newPackagesRows(
      prepackNewPackagesLines([
        {
          tag: "1A4050300000000000000B01",
          bags: 2,
          grams: 7,
          unit: 3.5,
          work_date: "2026-09-21",
          parent_tag: "1A4050300000000000000A01",
          location: "Prepack Room",
          itemName: "PREPACK 3.5",
        },
      ])
    );
    expect(rows[0][0]).toMatchObject({ text: "1A4050300000000000000B01" });
    expect(rows[0][1]).toMatchObject({ text: "Prepack Room" });
    expect(rows[0][2]).toMatchObject({ text: "PREPACK 3.5" });
    expect(rows[0][3]).toMatchObject({ text: "no" });
    expect(rows[0][4]).toMatchObject({ number: 2 });
    expect(rows[0][5]).toMatchObject({ text: "Each" });
    expect(rows[0][21]).toMatchObject({ text: "1A4050300000000000000A01" });
    expect(rows[0][22]).toMatchObject({ number: 7 });
    expect(rows[0][23]).toMatchObject({ text: "Grams" });
  });

  it("writes the Finish file with the parent tag and the farm day", () => {
    expect(prepackFinishCsv("1A4050300000000000000A01", "2026-09-22")).toBe("Label,ActualDate\r\n1A4050300000000000000A01,2026-09-22\r\n");
  });

  it("asks before Finish Pack when grams remain, and offers the carry", () => {
    const pane: PrepackPane = {
      jobs: [
        {
          id: "job-1",
          status: "scheduled",
          harvest_batch_id: "hb",
          hbn: "26260-PNN-GH-001-0-NA-26001",
          strain_name: "Chem",
          package_id: "pkg",
          package_code: "1A4050300000000000000A01",
          metrc_tag: "1A4050300000000000000A01",
          qty: 6,
          location: "Cryo 1",
        },
      ],
      pick: {
        id: "job-1",
        status: "scheduled",
        harvest_batch_id: "hb",
        hbn: "26260-PNN-GH-001-0-NA-26001",
        strain_name: "Chem",
        package_id: "pkg",
        package_code: "1A4050300000000000000A01",
        metrc_tag: "1A4050300000000000000A01",
        qty: 6,
        location: "Cryo 1",
      },
      lines: [{ id: "line-1", unit_grams: 3.5, bags: 2, grams: 7, tag: "1A4050300000000000000B01", carried_grams: 0, work_date: "2026-09-21" }],
      units: ["3.5", "7", "14", "28"],
      selectedUnit: "3.5",
      carry: { id: "carry-1", remaining: 6, parent_tag: "1A4050300000000000000A09", finished_on: "2026-09-21" },
      ask: true,
      location: "Prepack Room",
    };
    const html = prepackPage(pane, "en", "2026-09-22T16:00:00.000Z");
    // THE PACKAGE READS IN FOUR LINES (canon 0.30.199): the job list and the
    // heading read the whole tag; the strain and grams, the HBN and the
    // location follow on their own lines.
    expect(html).toContain('<h2 class="pkg-tag">1A4050300000000000000A01</h2>');
    expect(html).toContain('<span class="pkg-tag">1A4050300000000000000A01</span>');
    expect(html).toContain('<span class="pkg-strain-grams">Chem - 6 g</span>');
    expect(html).toContain('<span class="pkg-hbn">26260-PNN-GH-001-0-NA-26001</span>');
    expect(html).toContain('<span class="pkg-location">Location: Cryo 1</span>');
    expect(html).not.toContain("<strong>...000A01</strong>");
    expect(html).toContain('data-prepack-unit');
    expect(html).toContain('value="3.5" selected');
    expect(html).toContain("6 g carried from ...000A09 (finished 2026-09-21). Use it first?");
    expect(html).toContain("6 g remain on ...000A01. Push it onto the next pack job?");
    expect(html).toContain('name="push" value="yes"');
    expect(html).toContain('name="push" value="no"');
    expect(html).toContain('data-prepack-size="3.5"');
    expect(html).toContain("Total lbs produced");
    const es = prepackPage(pane, "es", "2026-09-22T16:00:00.000Z");
    expect(es).toContain("Usarlo primero?");
    expect(es).toContain("Pasarlos al siguiente trabajo?");
  });
});

describe("THE PREPACK SCHEDULER BY PACKAGE, THE HBN INHERITED (canon 0.30.196)", () => {
  const NEW = "46258-PNN-ID-062-0-NA-26007";
  const F41 = "1A4050300000000000000F41";
  const F42 = "1A4050300000000000000F42";

  it("an adopted package on a METRC-born batch with no lot stands in the feed, schedules alone, reads on the station, and pends its files under its HBN", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedMirror(m, { tag: F41, harvest: NEW });
    seedMirror(m, { tag: F42, harvest: NEW, grams: 100 });
    await adoptFromMetrc(m.db, formOf({ tag: F41, person_id: person }));
    await adoptFromMetrc(m.db, formOf({ tag: F42, person_id: person }));
    const panes = await listPrepackPanes(m.db);
    expect(panes.available).toEqual([]);
    expect(panes.working.map((row) => [row.tag, row.hbn, row.identity, row.strain_name, row.grams, row.location])).toEqual([
      [F42, NEW, F42, "Zebra Cake", 100, "Cryo 1"],
      [F41, NEW, F41, "Zebra Cake", 751, "Cryo 1"],
    ]);
    const a = panes.working.find((row) => row.tag === F41)!;
    const b = panes.working.find((row) => row.tag === F42)!;
    expect(m.get(`SELECT harvest_batch_id FROM production_schedules WHERE wip_package_id = ?`, a.itemId)).toEqual({ harvest_batch_id: String(m.get(`SELECT id FROM harvest_batches WHERE hbn = ?`, NEW)?.id) });
    await expect(schedulePackage(m.db, a.itemId, formOf({ person_id: person }))).rejects.toMatchObject({ message: "That package is already on the schedule." });
    await expect(schedulePackage(m.db, "no-such-package", formOf({ person_id: person }))).rejects.toMatchObject({ message: "That package is no longer available to schedule." });
    // << returns the sibling to Available as an app package. The adoption stays.
    const back = await unscheduleItem(m.db, "prepack", b.id, formOf({ person_id: person, q: "26007" }));
    expect(back.redirect).toBe("/production/scheduling/prepack?ok=unscheduled&q=26007");
    expect((await listPrepackPanes(m.db)).available.map((row) => row.tag)).toEqual([F42]);
    expect(m.get(`SELECT source, harvest_batch_id FROM wip_packages WHERE id = ?`, b.itemId)).toMatchObject({ source: "metrc" });
    // The station reads the job by the package's HBN; a line and Finish Pack pend both files under it.
    const job = a.id;
    const pane = await loadPrepackPane(m.db, job, false);
    expect(pane.pick).toMatchObject({ hbn: NEW, package_id: a.itemId, qty: 751 });
    await addPrepackLine(m.db, job, formOf({ person_id: person, unit_grams: "3.5", bags: "2", tag: "1A4050300000000000000B41" }));
    await finishPrepack(m.db, job, formOf({ person_id: person, push: "no" }));
    const files = await listPendingPrepackFiles(m.db);
    expect(files.map((file) => [file.kind, file.hbn, file.filename])).toEqual([
      ["new_packages", NEW, `new_packages_${NEW}_000F41.xlsx`],
      ["package_finish", NEW, `package_finish_${NEW}_000F41.csv`],
    ]);
    const finish = await buildPrepackFinishCsv(m.db, job);
    expect(finish.body).toContain(F41);
    expect(finish.harvest_batch_id).toBe(String(m.get(`SELECT id FROM harvest_batches WHERE hbn = ?`, NEW)?.id));
  });
});
