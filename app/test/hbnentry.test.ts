import { describe, expect, it } from "vitest";
import { createHarvestBatch, createWetWeight, editRecord, finishLot, lotLandingForBatch, manualHbn } from "../src/actions";
import { nowIso } from "../src/audit";
import { SILO_SEQUENCE_SIZE, siloSequenceNumber } from "../src/config";
import {
  farmTodayStartIso,
  listFieldHbns,
  listLookup,
  listPaneRows,
  listSiloSequence,
  nextSiloNumber,
  siloSpaceOfNumber,
  weighingSinceFlag,
} from "../src/db";
import { dayBefore, farmDay, FARM_DAY_START_HOUR_DEFAULT } from "../src/farmday";
import { feedDryMethodOf } from "../src/feeds";
import { fieldHarvestPage } from "../src/fieldharvest";
import { lotLandingLine, stationPage, weighingSinceWords, type StationLedgerCtx } from "../src/html";
import { editPage } from "../src/pages";
import { EDITABLE_FIELDS, queueByKey, stationByKey } from "../src/pipeline";
import { formOf, migratedDb, seedBatch, seedPerson, type MigratedDb } from "./migrated";

/** THE HBN ENTRY (canon 0.30.341). The owner, 2026-10-02, verbatim: "new wet
 * weights are classing everything as spears and hang in place.  Add the
 * bucked/spears toggle to the HBN entry, remove "move-to" altogether.  The HBN
 * being made defaults to the next silo in sequence for scheduling purposes, it
 * can be changed by drop down before the HBN is minted (Arlington dry room and
 * the blast freezer will count as silo 6 and 7 for our sequence)". His picks:
 * "Next silo with room" and "Bucked to the HBN's silo, Spear hangs". */

const SILO_1 = "a1000001-0001-4000-8000-000000000001";
const SILO_2 = "a1000001-0001-4000-8000-000000000002";
const ARL_ROOM = "a1000001-0001-4000-8000-000000000006";
const HANG = "a1000001-0001-4000-8000-000000000007";
const FREEZER = "a1000001-0000-4000-8000-0000000000bf";
const STRAIN = "98cf3164-344e-414a-9f1c-1526fde445ac";
const T0 = "2026-10-01T16:00:00.000Z";

function seedLiveLot(m: MigratedDb, id: string, batchId: string, spaceId: string, status: string, over: { created_at?: string; effective_date?: string; finished_at?: string | null } = {}): void {
  m.run(
    `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, material_form, status, effective_date, finished_at, created_at, updated_at)
     VALUES (?, ?, 100, ?, 'bucked', ?, ?, ?, ?, ?)`,
    id,
    batchId,
    spaceId,
    status,
    over.effective_date ?? "2026-10-01",
    over.finished_at ?? null,
    over.created_at ?? T0,
    T0
  );
}

function acquireForm(person: string, over: Record<string, string> = {}): FormData {
  return formOf({
    person_id: person,
    entry_date: "2026-10-02",
    farm_code: "PNN",
    grow_method_code: "GH",
    strain_id: STRAIN,
    planned_dryspc: "1",
    material_form: "bucked",
    ...over,
  });
}

describe("THE SEQUENCE (canon 0.30.341)", () => {
  it("numbers the seven kind-silo spaces by the drying strip's order: Silo 1 to 5, the Arlington Dry Room 6, the Blast Freezer(s) 7", async () => {
    const m = await migratedDb();
    const sequence = await listSiloSequence(m.db);
    expect(SILO_SEQUENCE_SIZE).toBe(7);
    expect(sequence.map((space) => [space.number, space.name])).toEqual([
      [1, "Silo 1"],
      [2, "Silo 2"],
      [3, "Silo 3"],
      [4, "Silo 4"],
      [5, "Silo 5"],
      [6, "Arlington Dry Room"],
      [7, "Blast Freezer(s)"],
    ]);
    expect(siloSpaceOfNumber(sequence, "6")?.id).toBe(ARL_ROOM);
    expect(siloSpaceOfNumber(sequence, "7")?.id).toBe(FREEZER);
    expect(siloSpaceOfNumber(sequence, "NA")).toBeNull();
    expect(siloSpaceOfNumber(sequence, null)).toBeNull();
    expect(siloSpaceOfNumber(sequence, "8")).toBeNull();
    expect(siloSequenceNumber("07")).toBe(7);
    expect(siloSequenceNumber("0")).toBeNull();
    // A renamed space keeps its number by its place; an eighth space falls past the sequence.
    m.run(`UPDATE dry_spaces SET name = 'North Room' WHERE id = ?`, ARL_ROOM);
    m.run(
      `INSERT INTO dry_spaces (id, name, kind, farm_code, space_type, created_at, updated_at) VALUES ('zz-silo', 'Silo 9', 'silo', 'PNN', 'silo', ?, ?)`,
      T0,
      T0
    );
    const renamed = await listSiloSequence(m.db);
    expect(renamed.map((space) => space.name)).toEqual(["Silo 1", "Silo 2", "Silo 3", "Silo 4", "Silo 5", "Silo 9", "North Room"]);
  });

  it("the data feed reads a 6 or 7 segment as a silo dry, never a hang", () => {
    expect(feedDryMethodOf("26275-PNN-GH-027-0-06-26300")).toBe("silo");
    expect(feedDryMethodOf("26275-PNN-GH-027-0-07-26301")).toBe("silo");
    expect(feedDryMethodOf("26275-PNN-GH-027-0-NA-26302")).toBe("hang");
  });
});

describe("THE DEFAULT SILO (his pick, Next silo with room)", () => {
  it("picks 1 on an empty floor", async () => {
    const m = await migratedDb();
    expect(await nextSiloNumber(m.db)).toBe(1);
  });

  it("skips the silos filled by lots and the one an open HBN plans, and lands on 5", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-a", hbn: "26275-PNN-GH-027-0-01-26401", serial: 7401, farm: "PNN", silo: "1" });
    seedBatch(m, { id: "hb-b", hbn: "26275-PNN-GH-027-0-02-26402", serial: 7402, farm: "PNN", silo: "2" });
    seedBatch(m, { id: "hb-c", hbn: "26275-PNN-GH-027-0-03-26403", serial: 7403, farm: "PNN", silo: "3" });
    // Silos 1 to 3 hold lots (weighing, drying, loaded); their HBNs are complete, so the lots alone fill them.
    m.run(`UPDATE harvest_batches SET status = 'complete' WHERE id IN ('hb-a', 'hb-b', 'hb-c')`);
    seedLiveLot(m, "lot-1", "hb-a", SILO_1, "weighing");
    seedLiveLot(m, "lot-2", "hb-b", SILO_2, "drying", { finished_at: T0 });
    seedLiveLot(m, "lot-3", "hb-c", "a1000001-0001-4000-8000-000000000003", "drying", { finished_at: T0 });
    m.run(
      `INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, paused_seconds, created_at, updated_at) VALUES ('load-3', 'a1000001-0001-4000-8000-000000000003', 'lot-3', ?, 0, ?, ?)`,
      T0,
      T0,
      T0
    );
    // Silo 4 is planned by an open HBN with no lot yet.
    seedBatch(m, { id: "hb-d", hbn: "26275-PNN-GH-027-0-04-26404", serial: 7404, farm: "PNN", silo: "4" });
    expect(await nextSiloNumber(m.db)).toBe(5);
    // An unloaded lot has left its silo: Silo 2 frees once its lot is unloaded and its HBN complete.
    m.run(`UPDATE wet_weight_entries SET status = 'unloaded' WHERE id = 'lot-2'`);
    expect(await nextSiloNumber(m.db)).toBe(2);
  });

  it("round robins when all seven are busy: the number after the last HBN's, 7 wrapping to 1", async () => {
    const m = await migratedDb();
    for (let n = 1; n <= 7; n++) {
      seedBatch(m, { id: `hb-${n}`, hbn: `26275-PNN-GH-027-0-0${n}-2641${n}`, serial: 7410 + n, farm: "PNN", silo: String(n) });
      m.run(`UPDATE harvest_batches SET created_at = ? WHERE id = ?`, `2026-10-01T10:0${n}:00.000Z`, `hb-${n}`);
    }
    expect(await nextSiloNumber(m.db)).toBe(1);
    m.run(`UPDATE harvest_batches SET created_at = '2026-10-01T12:00:00.000Z' WHERE id = 'hb-3'`);
    expect(await nextSiloNumber(m.db)).toBe(4);
  });
});

describe("ACQUIRE HBN and the Manual HBN (canon 0.30.341)", () => {
  it("requires the silo and the form, writes both, and mints the sixth segment from the number, 6 and 7 included", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    await expect(createHarvestBatch(m.db, acquireForm(person, { planned_dryspc: "" }))).rejects.toMatchObject({ status: 400, message: "Pick a silo." });
    await expect(createHarvestBatch(m.db, acquireForm(person, { planned_dryspc: "NA" }))).rejects.toMatchObject({ status: 400, message: "Pick a silo." });
    await expect(createHarvestBatch(m.db, acquireForm(person, { material_form: "" }))).rejects.toMatchObject({ status: 400, message: "Pick Spear or Bucked." });
    await expect(createHarvestBatch(m.db, acquireForm(person, { material_form: "silo" }))).rejects.toMatchObject({ status: 400, message: "Pick Spear or Bucked." });
    const six = await createHarvestBatch(m.db, acquireForm(person, { planned_dryspc: "6", material_form: "spear" }));
    expect(six.redirect).toContain("minted=26275-PNN-GH-001-0-06-");
    const seven = await createHarvestBatch(m.db, acquireForm(person, { planned_dryspc: "7" }));
    expect(seven.redirect).toContain("minted=26275-PNN-GH-001-0-07-");
    const rows = m.all(`SELECT planned_dryspc, material_form FROM harvest_batches WHERE deleted_at IS NULL ORDER BY lot_serial`);
    expect(rows).toEqual([
      { planned_dryspc: "6", material_form: "spear" },
      { planned_dryspc: "7", material_form: "bucked" },
    ]);
    // The pick list offers 1 to 7 with the sequence's words and no NA.
    const options = await listLookup(m.db, "silo_number");
    expect(options.map((o) => [o.value, o.label])).toEqual([
      ["1", "1"],
      ["2", "2"],
      ["3", "3"],
      ["4", "4"],
      ["5", "5"],
      ["6", "6 Arlington Dry Room"],
      ["7", "7 Blast Freezer(s)"],
    ]);
    expect(m.get(`SELECT deleted_at FROM lookup_values WHERE id = 'a2000001-0001-4000-8000-000000000006'`)?.deleted_at).toBeTruthy();
  });

  it("the Manual HBN takes the same two fields and keeps the typed HBN as typed", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const base = {
      person_id: person,
      hbn: "26275-PNN-GH-027-0-NA-26900",
      entry_date: "2026-10-02",
      farm_code: "PNN",
      grow_method_code: "GH",
      strain_id: STRAIN,
      reason: "the system failed",
    };
    await expect(manualHbn(m.db, formOf(base))).rejects.toMatchObject({ message: "Pick a silo." });
    await expect(manualHbn(m.db, formOf({ ...base, planned_dryspc: "2" }))).rejects.toMatchObject({ message: "Pick Spear or Bucked." });
    await manualHbn(m.db, formOf({ ...base, planned_dryspc: "2", material_form: "spear" }));
    expect(m.get(`SELECT hbn, lot_serial, is_test, planned_dryspc, material_form FROM harvest_batches WHERE hbn = '26275-PNN-GH-027-0-NA-26900'`)).toEqual({
      hbn: "26275-PNN-GH-027-0-NA-26900",
      lot_serial: 10,
      is_test: 0,
      planned_dryspc: "2",
      material_form: "spear",
    });
  });

  it("the Acquire form carries the radio (bucked checked) right above the required Silo, preselected to the passed number", () => {
    const acquire = stationByKey("acquire_hbn")!;
    const lookups = {
      farms: [],
      grow_methods: [],
      strains: [],
      license: [],
      silo_number: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "7", label: "7 Blast Freezer(s)" },
      ],
    };
    const html = stationPage(acquire, [], "", lookups, {}, {}, undefined, undefined, undefined, "en", undefined, undefined, {
      recallRows: [],
      prefill: { planned_dryspc: "2" },
    });
    expect(html).toContain('name="material_form" value="bucked" checked');
    expect(html).toContain('<option value="2" selected>2</option>');
    expect(html).toContain('<select name="planned_dryspc" required>');
    expect(html.indexOf('name="material_form"')).toBeLessThan(html.indexOf('name="planned_dryspc"'));
    expect(html).not.toContain('name="actual_dryspc"');
    expect(html).toContain("The next silo with room is picked for you");
    expect(html).toContain("Bucked lots are weighed into the silo as WIP.");
  });
});

describe("PENN NORTH HARVEST and the field node read the HBN (canon 0.30.341)", () => {
  it("a Bucked HBN's lot lands in its silo as bucked; a Spear HBN's lot hangs in Hang in Place; the posted fields are ignored", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-bucked", hbn: "26275-PNN-GH-027-0-02-26501", serial: 7501, farm: "PNN", silo: "2" });
    seedBatch(m, { id: "hb-spear", hbn: "26275-PNN-GH-027-0-03-26502", serial: 7502, farm: "PNN", silo: "3", form: "spear" });
    seedBatch(m, { id: "hb-none", hbn: "26275-PNN-GH-027-0-NA-26503", serial: 7503, farm: "PNN" });
    await createWetWeight(m.db, formOf({ person_id: person, team_lead: "Lead", harvest_batch_id: "hb-bucked", actual_dryspc: HANG, material_form: "spear" }));
    await createWetWeight(m.db, formOf({ person_id: person, team_lead: "Lead", harvest_batch_id: "hb-spear", actual_dryspc: SILO_1, material_form: "bucked" }));
    expect(m.get(`SELECT actual_dryspc, material_form FROM wet_weight_entries WHERE harvest_batch_id = 'hb-bucked'`)).toEqual({ actual_dryspc: SILO_2, material_form: "bucked" });
    expect(m.get(`SELECT actual_dryspc, material_form FROM wet_weight_entries WHERE harvest_batch_id = 'hb-spear'`)).toEqual({ actual_dryspc: HANG, material_form: "spear" });
    await expect(
      createWetWeight(m.db, formOf({ person_id: person, team_lead: "Lead", harvest_batch_id: "hb-none" }))
    ).rejects.toMatchObject({ status: 400, message: "This HBN has no silo. Set it on the HBN first." });
    expect(await lotLandingForBatch(m.db, { material_form: "bucked", planned_dryspc: "7" }, "PNN")).toEqual({ spaceId: FREEZER, materialForm: "bucked" });
    expect(await lotLandingForBatch(m.db, { material_form: "spear", planned_dryspc: null }, "ARL")).toEqual({ spaceId: ARL_ROOM, materialForm: "spear" });
  });

  it("the finish stamps finished_at and mints WIP for the bucked lot, SPR at Hang in Place for the spear lot", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-bucked", hbn: "26275-PNN-GH-027-0-02-26511", serial: 7511, farm: "PNN", silo: "2" });
    seedBatch(m, { id: "hb-spear", hbn: "26275-PNN-GH-027-0-03-26512", serial: 7512, farm: "PNN", silo: "3", form: "spear" });
    const station = stationByKey("wet_weight")!;
    for (const id of ["hb-bucked", "hb-spear"]) {
      const started = await createWetWeight(m.db, formOf({ person_id: person, team_lead: "Lead", harvest_batch_id: id }));
      const lotId = new URL("http://local" + started.redirect).searchParams.get("lot") ?? "";
      m.run(`INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES (?, ?, 250, ?, ?)`, `w-${id}`, lotId, T0, T0);
      m.run(`UPDATE wet_weight_entries SET weight_grams = 250 WHERE id = ?`, lotId);
      await finishLot(m.db, station, lotId, formOf({ person_id: person, plant_prompt: "skip" }));
      const lot = m.get(`SELECT status, finished_at FROM wet_weight_entries WHERE id = ?`, lotId);
      expect(lot?.status).toBe("drying");
      expect(String(lot?.finished_at ?? "")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    const items = m.all(`SELECT harvest_batch_id, item_kind, location FROM local_inventory_items WHERE deleted_at IS NULL ORDER BY harvest_batch_id`);
    expect(items).toEqual([
      { harvest_batch_id: "hb-bucked", item_kind: "WIP", location: "BARN" },
      { harvest_batch_id: "hb-spear", item_kind: "SPR", location: "Hang in Place" },
    ]);
  });

  it("the field select names each HBN's form and silo in its option text", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-arl", hbn: "26275-ARL-GH-027-0-01-26521", serial: 7521, farm: "ARL", silo: "1" });
    seedBatch(m, { id: "hb-pns", hbn: "26275-PNS-GH-027-0-06-26522", serial: 7522, farm: "PNS", silo: "6", form: "spear" });
    const options = await listFieldHbns(m.db);
    expect(options.map((row) => [row.id, row.form, row.silo]).sort()).toEqual([
      ["hb-arl", "bucked", "Silo 1"],
      ["hb-pns", "spear", "Arlington Dry Room"],
    ]);
    const html = fieldHarvestPage({
      locale: "en",
      destinations: [{ code: "PNN", display_name: "Penn North" }],
      openLoads: [],
      sentLoads: [],
      picked: {
        load: { id: "load-1", operator_name: "Hand", destination_farm_code: "PNN", destination_name: "Penn North", status: "open", started_at: T0, sent_at: null, effective_date: "2026-10-02" },
        totes: [],
        hbnOptions: options,
        carryId: null,
        finish: "",
        warnIds: [],
      },
    });
    expect(html).toContain("(26275-ARL-GH-027-0-01-26521) Bucked Silo 1</option>");
    expect(html).toContain("(26275-PNS-GH-027-0-06-26522) Spear Arlington Dry Room</option>");
  });
});

describe("THE HBN QUEUE (the floor lead's note)", () => {
  it("keeps an HBN whose lot finished this farm day whatever day it started, and drops one finished before the day began with no weighing lot", async () => {
    const m = await migratedDb();
    const day = await farmTodayStartIso(m.db);
    seedBatch(m, { id: "hb-morning", hbn: "26275-PNN-GH-027-0-01-26601", serial: 7601, farm: "PNN", silo: "1" });
    seedBatch(m, { id: "hb-monday", hbn: "26275-PNN-GH-027-0-02-26602", serial: 7602, farm: "PNN", silo: "2" });
    seedBatch(m, { id: "hb-still", hbn: "26275-PNN-GH-027-0-03-26603", serial: 7603, farm: "PNN", silo: "3" });
    // Started before 06:00 (effective_date yesterday), finished one second into today: it stays.
    const started = new Date(Date.parse(day.startIso) - 3 * 3600_000).toISOString();
    seedLiveLot(m, "lot-morning", "hb-morning", SILO_1, "drying", {
      created_at: started,
      effective_date: dayBefore(day.today),
      finished_at: new Date(Date.parse(day.startIso) + 1000).toISOString(),
    });
    // Finished one second before today began: it drops, although it started "today" by effective_date.
    seedLiveLot(m, "lot-monday", "hb-monday", SILO_2, "drying", {
      created_at: started,
      effective_date: day.today,
      finished_at: new Date(Date.parse(day.startIso) - 1000).toISOString(),
    });
    // A weighing lot keeps its HBN however old it is.
    seedLiveLot(m, "lot-still", "hb-still", "a1000001-0001-4000-8000-000000000003", "weighing", { created_at: "2026-09-28T14:00:00.000Z", effective_date: "2026-09-28" });
    const rows = await listPaneRows(m.db, queueByKey("hbn_queue")!, "no_finished_lot", ["PNN"]);
    const ids = rows.map((row) => row.id);
    expect(ids).toContain("hb-morning");
    expect(ids).toContain("hb-still");
    expect(ids).not.toContain("hb-monday");
    // The age flag: words on the row of the lot weighing since before yesterday, nothing on the rest.
    expect(rows.find((row) => row.id === "hb-still")?.values.weighing_since).toBe("2026-09-28");
    expect(rows.find((row) => row.id === "hb-morning")?.values.weighing_since).toBe("");
    const station = stationByKey("wet_weight")!;
    const html = stationPage(station, [], "", {}, { hbn_queue: rows }, { hbn_queue: queueByKey("hbn_queue")! }, undefined, undefined, rows, "en");
    expect(html).toContain(', weighing since 2026-09-28</span></a>');
    const es = stationPage(station, [], "", {}, { hbn_queue: rows }, { hbn_queue: queueByKey("hbn_queue")! }, undefined, undefined, rows, "es");
    expect(es).toContain(", pesando desde 2026-09-28");
    expect(weighingSinceWords({ id: "x", values: {} }, "en")).toBe("");
  });

  it("the flag reads the earlier of the lot's birth day and its backdated effective date, and only past yesterday", () => {
    const today = farmDay(nowIso(), FARM_DAY_START_HOUR_DEFAULT);
    const yesterday = dayBefore(today);
    expect(weighingSinceFlag(`${today}T15:00:00.000Z`, today, today, 6)).toBe("");
    expect(weighingSinceFlag(`${yesterday}T15:00:00.000Z`, yesterday, today, 6)).toBe("");
    expect(weighingSinceFlag(`${today}T15:00:00.000Z`, "2026-09-08", today, 6)).toBe("2026-09-08");
    expect(weighingSinceFlag("2026-09-28T15:00:00.000Z", null, today, 6)).toBe("2026-09-28");
    expect(weighingSinceFlag(null, null, today, 6)).toBe("");
  });
});

describe("THE PENCILS and the landing line (canon 0.30.341)", () => {
  it("the HBN pencil shows a NULL silo blank, keeps an NA as its own option, and offers the Spear or Bucked radio; the lot pencil says Dry space", () => {
    const hbnFields = EDITABLE_FIELDS.harvest_batches;
    expect(hbnFields.find((f) => f.name === "planned_dryspc")).toMatchObject({ label: "Silo", input: "lookup", lookup: "silo_number", optional: false });
    expect(hbnFields.find((f) => f.name === "material_form")).toMatchObject({ input: "radio" });
    const lotFields = EDITABLE_FIELDS.wet_weight_entries;
    expect(lotFields.find((f) => f.name === "actual_dryspc")?.label).toBe("Dry space");
    expect(lotFields.find((f) => f.name === "material_form")).toMatchObject({ input: "radio" });
    const lookups = { silo_number: [{ value: "1", label: "1" }, { value: "2", label: "2" }] };
    const blank = editPage("harvest_batches", "hb1", { planned_dryspc: null, material_form: "bucked" }, lookups, "");
    expect(blank).toContain('<select name="planned_dryspc"><option value="" selected></option><option value="1">1</option>');
    expect(blank).toContain('<input type="radio" name="material_form" value="bucked" checked> Bucked');
    const na = editPage("harvest_batches", "hb1", { planned_dryspc: "NA", material_form: "spear" }, lookups, "");
    expect(na).toContain('<select name="planned_dryspc"><option value="NA" selected>NA</option><option value="1">1</option>');
    expect(na).toContain('<input type="radio" name="material_form" value="spear" checked> Spear');
    const two = editPage("harvest_batches", "hb1", { planned_dryspc: "2", material_form: "bucked" }, lookups, "");
    expect(two).toContain('<select name="planned_dryspc"><option value="1">1</option><option value="2" selected>2</option></select>');
  });

  it("the HBN pencil sets the silo and the form with a reason and never re-mints the HBN string; a garbage form refuses", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-na", hbn: "26274-PNS-OD-006-0-NA-26082", serial: 7082, farm: "PNS" });
    await editRecord(m.db, "harvest_batches", "hb-na", formOf({ person_id: person, planned_dryspc: "1", material_form: "spear", reason: "needs to be moved to Silo 1" }));
    expect(m.get(`SELECT hbn, planned_dryspc, material_form FROM harvest_batches WHERE id = 'hb-na'`)).toEqual({
      hbn: "26274-PNS-OD-006-0-NA-26082",
      planned_dryspc: "1",
      material_form: "spear",
    });
    await expect(
      editRecord(m.db, "harvest_batches", "hb-na", formOf({ person_id: person, material_form: "silo", reason: "garbage" }))
    ).rejects.toMatchObject({ status: 400, message: "Spear or Bucked must be one of Spear, Bucked." });
    expect(m.all(`SELECT field, new_value FROM record_change_log WHERE record_id = 'hb-na' ORDER BY field`)).toEqual([
      { field: "material_form", new_value: "spear" },
      { field: "planned_dryspc", new_value: "1" },
    ]);
  });

  it("the landing line reads the HBN's form and space, with the link to the HBN's pencil", () => {
    expect(lotLandingLine({ form: "bucked", spaceName: "Silo 3", hbnId: "hb1" }, "wet_weight", "hb1", "en")).toBe(
      '<p class="lot-landing" data-lot-landing="bucked" data-lot-landing-space="Silo 3">Bucked: lands in Silo 3 as WIP <a class="muted" href="/record/harvest_batches/hb1/edit?back=%2Fstation%2Fwet_weight%3Fpick%3Dhb1%26new%3D1">change on the HBN</a></p>'
    );
    expect(lotLandingLine({ form: "spear", spaceName: "Hang in Place", hbnId: "hb1" }, "wet_weight", "hb1", "es")).toContain("Lanza: cuelga en Hang in Place como SPR");
    expect(lotLandingLine({ form: "bucked", spaceName: null, hbnId: "hb1" }, "wet_weight", "hb1", "en")).toContain("Bucked: This HBN has no silo. Set it on the HBN first.");
    const ctx: StationLedgerCtx = { farmName: "Penn North", landing: { form: "bucked", spaceName: "Silo 3", hbnId: "hb1" }, resumeLots: [] };
    const rows = [{ id: "hb1", values: { hbn: "26275-PNN-GH-027-0-03-26001", strain_name: "Fruity", farm_code: "PNN", entry_date: "2026-10-02" } }];
    const html = stationPage(stationByKey("wet_weight")!, [], "", {}, { hbn_queue: rows }, { hbn_queue: queueByKey("hbn_queue")! }, "hb1", ctx);
    expect(html).not.toContain('name="actual_dryspc"');
    expect(html).not.toContain('name="material_form"');
    expect(html).toContain('<input type="hidden" name="harvest_batch_id" value="hb1"><p class="lot-landing"');
  });
});
