import { describe, expect, it } from "vitest";
import {
  addFieldLoadWeight,
  changeFieldToteHbn,
  closeFieldHbn,
  FIELD_PICK_BOTH,
  readFieldFinishPicks,
  reopenFieldLoad,
  runQueueControl,
  scheduleLogisticsLot,
  sendFieldLoad,
  startFieldLoad,
  unscheduleLogisticsLot,
} from "../src/actions";
import { nowIso } from "../src/audit";
import { listBarnWetLots, listDryQueueLots, listFieldHbns, listInTransitFieldLoads, listMoreTrucksHbns, listOpenLogisticsSchedules } from "../src/db";
import { farmDay, FARM_DAY_START_HOUR_DEFAULT } from "../src/farmday";
import { fieldHarvestPage } from "../src/fieldharvest";
import { internalLogisticsPage, logisticsLotView } from "../src/scheduling";
import { formOf, migratedDb, seedBatch, seedPerson, type MigratedDb } from "./migrated";

const HANG = "a1000001-0001-4000-8000-000000000007";
const ROOM = "a1000001-0001-4000-8000-000000000006";
const T0 = "2026-09-30T16:00:00.000Z";

async function pinOf(m: MigratedDb): Promise<string> {
  return String(m.get(`SELECT value FROM app_config WHERE key = 'admin_pin'`)?.value ?? "");
}

describe("Penn South/Arlington Harvest (canon 0.30.317)", () => {
  it("mints the weighing lot at the first tote and lands the next tote on it", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    // THE HBN ENTRY (canon 0.30.341): a Spear HBN's totes hang in the destination's holding space, as before.
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-26201", serial: 6201, farm: "ARL", form: "spear" });
    const started = await startFieldLoad(
      m.db,
      formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" })
    );
    const loadId = new URL("http://local" + started.redirect).searchParams.get("load");
    if (!loadId) throw new Error("no load id");
    await addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "0", harvest_batch_id: "hb-arl" }));
    await addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "12", harvest_batch_id: "hb-arl" }));
    const lots = m.all(
      `SELECT material_form, team_lead, truck_number, actual_dryspc, status, weight_grams FROM wet_weight_entries WHERE deleted_at IS NULL`
    );
    expect(lots).toEqual([
      {
        material_form: "spear",
        team_lead: "Field Hand",
        truck_number: null,
        actual_dryspc: HANG,
        status: "weighing",
        weight_grams: 12,
      },
    ]);
    const totes = m.all(`SELECT field_load_id, harvest_batch_id FROM wet_weights WHERE deleted_at IS NULL`);
    expect(totes).toHaveLength(2);
    expect(totes.every((row) => row.field_load_id === loadId && row.harvest_batch_id === "hb-arl")).toBe(true);
  });

  it("an Arlington destination holds the lot in the Arlington Dry Room", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-26202", serial: 6202, farm: "ARL", form: "spear" });
    const started = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "ARL" }));
    const loadId = new URL("http://local" + started.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "4", harvest_batch_id: "hb-arl" }));
    expect(m.get(`SELECT actual_dryspc, team_lead FROM wet_weight_entries`)?.actual_dryspc).toBe(ROOM);
    // The operator is mandatory now (canon 0.30.346), so the lot takes it as its team lead.
    expect(m.get(`SELECT team_lead FROM wet_weight_entries`)?.team_lead).toBe("Field Hand");
  });

  it("the entry select is null on load and carries the last pick after +", () => {
    const options = [
      { id: "hb-a", hbn: "26244-ARL-GH-027-0-NA-26211", label: "ARL / Fruity / 2026-09-30" },
      { id: "hb-b", hbn: "26244-PNS-GH-027-0-NA-26212", label: "PNS / Fruity / 2026-09-30" },
    ];
    const load = {
      id: "load-1",
      operator_name: "Field Hand",
      destination_farm_code: "PNN",
      destination_name: "Penn North",
      status: "open",
      started_at: T0,
      sent_at: null,
      effective_date: "2026-09-30",
    };
    const cold = fieldHarvestPage({
      locale: "en",
      destinations: [{ code: "PNN", display_name: "Penn North" }],
      openLoads: [load],
      sentLoads: [],
      picked: { load, totes: [], hbnOptions: options, carryId: null, finish: "", warnIds: [] },
    });
    expect(cold).toContain('<option value="" selected></option>');
    expect(cold).not.toContain('value="hb-a" selected');
    const carried = fieldHarvestPage({
      locale: "en",
      destinations: [],
      openLoads: [],
      sentLoads: [],
      picked: { load, totes: [], hbnOptions: options, carryId: "hb-b", finish: "", warnIds: [] },
    });
    expect(carried).toContain('value="hb-b" selected');
    expect(carried).not.toContain('value="" selected');
    // THE HBN KEPT (canon 0.30.346): the tablet's pick survives "+" (the swap keeps it) and a reload (localStorage per load).
    expect(carried).toContain('var hbnKey = "gf_field_hbn:"');
    expect(carried).toContain("var kept = sel.value;");
    expect(carried).toContain('s.addEventListener("change", keep);');
    // The operator box on a new load is mandatory and kept on this tablet.
    const fresh = fieldHarvestPage({ locale: "en", destinations: [{ code: "PNN", display_name: "Penn North" }], openLoads: [], sentLoads: [], picked: null });
    expect(fresh).toContain('name="operator_name" required autocomplete="off" data-keep-operator');
  });

  it("THE PLUS KEEPS THE CURSOR (canon 0.30.334): the Weight box takes the cursor and the + posts in the background", () => {
    const load = {
      id: "load-1",
      operator_name: "Field Hand",
      destination_farm_code: "PNN",
      destination_name: "Penn North",
      status: "open",
      started_at: T0,
      sent_at: null,
      effective_date: "2026-09-30",
    };
    const options = [{ id: "hb-a", hbn: "26244-ARL-GH-027-0-NA-26001", label: "ARL / A / 2026-09-30" }];
    const page = (locale: "en" | "es") =>
      fieldHarvestPage({
        locale,
        destinations: [],
        openLoads: [load],
        sentLoads: [],
        picked: { load, totes: [], hbnOptions: options, carryId: "hb-a", finish: "", warnIds: [] },
      });
    const html = page("en");
    const start = html.indexOf("<form method=\"post\" action=\"/station/field_harvest/load/load-1/weights\"");
    expect(start).toBeGreaterThan(-1);
    const entry = html.slice(start, html.indexOf("</form>", start) + "</form>".length);
    expect(entry).toContain('<input type="number" name="weight_grams" min="0" step="1" inputmode="numeric" required autofocus data-field-weight>');
    expect(entry).toContain('<button type="submit" aria-label="+" data-field-plus>+</button>');
    expect(entry).toContain('data-field-status data-no-answer="No answer from the server. Check the list before you add it again." role="status" aria-live="polite" hidden></p>');
    expect(entry).toContain('querySelector("form[data-field-entry]")');
    expect(entry).toContain('fetch(form.action, { method: "POST", body: data, credentials: "same-origin" })');
    expect(entry).toContain('if (e.key !== "+") return;');
    expect(html.split("var canPost = ").length - 1).toBe(1);
    expect(html.split("autofocus").length - 1).toBe(1);
    const script = entry.slice(entry.indexOf("<script>"), entry.indexOf("</script>"));
    expect(script).not.toContain("data-field-tote=");
    expect(script).not.toContain("data-finish-load");
    expect(script).not.toContain("`");
    const es = page("es");
    expect(es).toContain('data-no-answer="Sin respuesta del servidor. Revise la lista antes de agregarlo otra vez."');
    const cold = fieldHarvestPage({ locale: "en", destinations: [], openLoads: [], sentLoads: [], picked: null });
    expect(cold).not.toContain("data-field-weight");
    expect(cold).not.toContain("autofocus");
  });

  it("Finish Load NO sends the load and leaves the HBN open; YES finishes without a pass", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-26221", serial: 6221, farm: "ARL", form: "spear" });
    seedBatch(m, { id: "hb-pns", hbn: "26244-PNS-GH-027-0-NA-26222", serial: 6222, farm: "PNS", form: "spear" });
    const first = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const load1 = new URL("http://local" + first.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, load1, formOf({ person_id: person, weight_grams: "10", harvest_batch_id: "hb-arl" }));
    await addFieldLoadWeight(m.db, load1, formOf({ person_id: person, weight_grams: "11", harvest_batch_id: "hb-arl" }));
    await addFieldLoadWeight(m.db, load1, formOf({ person_id: person, weight_grams: "7", harvest_batch_id: "hb-pns" }));
    await sendFieldLoad(m.db, load1, formOf({ person_id: person }));
    expect(m.get(`SELECT status FROM field_loads WHERE id = ?`, load1)?.status).toBe("in_transit");
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl'`)?.status).toBe("weighing");
    expect(m.all(`SELECT id FROM production_schedules WHERE deleted_at IS NULL`)).toHaveLength(0);
    const second = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const load2 = new URL("http://local" + second.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, load2, formOf({ person_id: person, weight_grams: "3", harvest_batch_id: "hb-arl" }));
    const yes = formOf({ person_id: person });
    yes.append("hbn", "hb-arl");
    await sendFieldLoad(m.db, load2, yes);
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl'`)?.status).toBe("drying");
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE harvest_batch_id = 'hb-pns'`)?.status).toBe("weighing");
    expect(m.get(`SELECT plant_count FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl'`)?.plant_count).toBeNull();
    expect(m.all(`SELECT id FROM production_schedules WHERE stage = 'internal_logistics' AND deleted_at IS NULL`)).toHaveLength(0);
    expect(m.get(`SELECT status FROM field_loads WHERE id = ?`, load2)?.status).toBe("in_transit");
    expect(m.get(`SELECT field_closed_at FROM harvest_batches WHERE id = 'hb-arl'`)?.field_closed_at).toBeTruthy();
    expect(m.get(`SELECT field_closed_by FROM harvest_batches WHERE id = 'hb-arl'`)?.field_closed_by).toBe(person);
    expect(m.get(`SELECT field_closed_at FROM harvest_batches WHERE id = 'hb-pns'`)?.field_closed_at).toBeNull();
    expect(m.all(`SELECT reason FROM record_change_log WHERE record_id = 'hb-arl' AND field = 'field_closed_at'`).map((row) => row.reason)).toEqual([
      "field hbn closed",
    ]);
  });

  it("reopen returns the load and leaves a finished HBN finished", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const pin = await pinOf(m);
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-26231", serial: 6231, farm: "ARL", form: "spear" });
    const started = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "ARL" }));
    const loadId = new URL("http://local" + started.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "8", harvest_batch_id: "hb-arl" }));
    const yes = formOf({ person_id: person });
    yes.append("hbn", "hb-arl");
    await sendFieldLoad(m.db, loadId, yes);
    await expect(reopenFieldLoad(m.db, loadId, formOf({ person_id: person, pin: "00000" }))).rejects.toMatchObject({ status: 403 });
    await reopenFieldLoad(m.db, loadId, formOf({ person_id: person, pin }));
    expect(m.get(`SELECT status, sent_at FROM field_loads WHERE id = ?`, loadId)).toEqual({ status: "open", sent_at: null });
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl'`)?.status).toBe("drying");
    expect((await listFieldHbns(m.db)).map((row) => row.id)).not.toContain("hb-arl");
    await expect(
      addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "1", harvest_batch_id: "hb-arl" }))
    ).rejects.toMatchObject({ message: "That HBN is not on this list." });
    expect(m.all(`SELECT id FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl' AND deleted_at IS NULL`)).toHaveLength(1);
  });

  it("an HBN change moves the tote and recomputes both totals", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const pin = await pinOf(m);
    seedBatch(m, { id: "hb-a", hbn: "26244-PNS-GH-027-0-NA-26241", serial: 6241, farm: "PNS", form: "spear" });
    seedBatch(m, { id: "hb-b", hbn: "26244-PNS-GH-027-0-NA-26242", serial: 6242, farm: "PNS", form: "spear" });
    const started = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const loadId = new URL("http://local" + started.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "9", harvest_batch_id: "hb-a" }));
    await addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "5", harvest_batch_id: "hb-b" }));
    const tote = String(m.get(`SELECT id FROM wet_weights WHERE harvest_batch_id = 'hb-a'`)?.id);
    await expect(
      changeFieldToteHbn(m.db, tote, formOf({ person_id: person, harvest_batch_id: "hb-b", pin: "nope" }))
    ).rejects.toMatchObject({ status: 403 });
    await changeFieldToteHbn(m.db, tote, formOf({ person_id: person, harvest_batch_id: "hb-b", pin }));
    expect(m.get(`SELECT harvest_batch_id, wet_weight_entry_id FROM wet_weights WHERE id = ?`, tote)?.harvest_batch_id).toBe("hb-b");
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE harvest_batch_id = 'hb-a'`)?.weight_grams).toBe(0);
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE harvest_batch_id = 'hb-b'`)?.weight_grams).toBe(14);
    const toteLogs = m.all(`SELECT record_table FROM record_change_log WHERE reason = 'field tote hbn'`);
    expect(toteLogs.filter((row) => row.record_table === "wet_weights")).toHaveLength(1);
    expect(toteLogs.filter((row) => row.record_table === "wet_weight_entries")).toHaveLength(2);
  });

  it("refuses a missing destination, a fractional gram, a closed load, an empty send, and a foreign HBN", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-26251", serial: 6251, farm: "PNN", form: "spear" });
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-26252", serial: 6252, farm: "ARL", form: "spear" });
    // THE OPERATOR KEPT (canon 0.30.346): the operator is mandatory on the load.
    await expect(startFieldLoad(m.db, formOf({ person_id: person, destination_farm_code: "PNN" }))).rejects.toMatchObject({ status: 400 });
    await expect(startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand" }))).rejects.toMatchObject({
      message: "Destination is required.",
    });
    await expect(startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNS" }))).rejects.toMatchObject({
      message: "That farm is not a destination.",
    });
    const started = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const loadId = new URL("http://local" + started.redirect).searchParams.get("load") ?? "";
    await expect(
      addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "1.5", harvest_batch_id: "hb-arl" }))
    ).rejects.toMatchObject({ message: "Weight must be a whole gram, zero or more." });
    await expect(
      addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "4", harvest_batch_id: "hb-pnn" }))
    ).rejects.toMatchObject({ message: "That HBN is not on this list." });
    await expect(sendFieldLoad(m.db, loadId, formOf({ person_id: person }))).rejects.toMatchObject({
      message: "This load has no weights to send.",
    });
    await addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "4", harvest_batch_id: "hb-arl" }));
    await sendFieldLoad(m.db, loadId, formOf({ person_id: person }));
    await expect(
      addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "1", harvest_batch_id: "hb-arl" }))
    ).rejects.toMatchObject({ message: "That load is not open." });
  });

  it("the field select lists an ARL or PNS batch until field_closed_at is set, and only while its newest finish is within the farm day", async () => {
    const m = await migratedDb();
    const today = farmDay(nowIso(), FARM_DAY_START_HOUR_DEFAULT);
    seedBatch(m, { id: "hb-open", hbn: "26244-ARL-GH-027-0-NA-26261", serial: 6261, farm: "ARL" });
    seedBatch(m, { id: "hb-stale", hbn: "26244-PNS-GH-027-0-NA-26262", serial: 6262, farm: "PNS" });
    seedBatch(m, { id: "hb-today", hbn: "26244-PNS-GH-027-0-NA-26265", serial: 6265, farm: "PNS" });
    seedBatch(m, { id: "hb-weighing", hbn: "26244-ARL-GH-027-0-NA-26266", serial: 6266, farm: "ARL" });
    seedBatch(m, { id: "hb-closed", hbn: "26244-ARL-GH-027-0-NA-26264", serial: 6264, farm: "ARL" });
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-26263", serial: 6263, farm: "PNN" });
    // a lot finished on an earlier day (the truck flow's or a pass's): the HBN is off the select
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, effective_date, created_at, updated_at)
       VALUES ('lot-stale', 'hb-stale', 10, ?, 'unloaded', '2026-09-01', ?, ?)`,
      ROOM,
      T0,
      T0
    );
    // a lot finished today (a pass earlier today): the HBN stays for the day's later loads.
    // THE HBN ENTRY (canon 0.30.341): the finish's instant, finished_at, is what the rule reads now.
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, effective_date, finished_at, created_at, updated_at)
       VALUES ('lot-today', 'hb-today', 11, ?, 'drying', ?, ?, ?, ?)`,
      ROOM,
      today,
      nowIso(),
      T0,
      T0
    );
    // a lot finished on an earlier day beside a weighing lot: the weighing lot keeps the HBN listed
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, effective_date, created_at, updated_at)
       VALUES ('lot-old-part', 'hb-weighing', 9, ?, 'unloaded', '2026-09-01', ?, ?)`,
      ROOM,
      T0,
      T0
    );
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, effective_date, created_at, updated_at)
       VALUES ('lot-new-part', 'hb-weighing', 3, ?, 'weighing', ?, ?, ?)`,
      ROOM,
      today,
      T0,
      T0
    );
    // closed by YES: off the select whatever its lots
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, effective_date, created_at, updated_at)
       VALUES ('lot-closed', 'hb-closed', 12, ?, 'weighing', ?, ?, ?)`,
      ROOM,
      today,
      T0,
      T0
    );
    m.run(`UPDATE harvest_batches SET field_closed_at = ?, field_closed_by = 'person-1' WHERE id = 'hb-closed'`, T0);
    const ids = (await listFieldHbns(m.db)).map((row) => row.id);
    expect(ids).toContain("hb-open");
    expect(ids).toContain("hb-today");
    expect(ids).toContain("hb-weighing");
    expect(ids).not.toContain("hb-stale");
    expect(ids).not.toContain("hb-closed");
    expect(ids).not.toContain("hb-pnn");
  });

  it("a sent load exposes each HBN and a second load merges under the weighing lot", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-26271", serial: 6271, farm: "ARL", form: "spear" });
    seedBatch(m, { id: "hb-pns", hbn: "26244-PNS-GH-027-0-NA-26272", serial: 6272, farm: "PNS", form: "spear" });
    const started = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const load1 = new URL("http://local" + started.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, load1, formOf({ person_id: person, weight_grams: "100", harvest_batch_id: "hb-arl" }));
    await addFieldLoadWeight(m.db, load1, formOf({ person_id: person, weight_grams: "40", harvest_batch_id: "hb-arl" }));
    await addFieldLoadWeight(m.db, load1, formOf({ person_id: person, weight_grams: "15", harvest_batch_id: "hb-pns" }));
    expect(await listDryQueueLots(m.db)).toEqual([]);
    expect(await listBarnWetLots(m.db)).toEqual([]);
    await sendFieldLoad(m.db, load1, formOf({ person_id: person }));
    const sentAt = String(m.get(`SELECT sent_at FROM field_loads WHERE id = ?`, load1)?.sent_at);
    const exposed = await listDryQueueLots(m.db);
    expect(exposed.map((row) => row.harvest_batch_id).sort()).toEqual(["hb-arl", "hb-pns"]);
    expect(await listBarnWetLots(m.db)).toEqual([]);
    const arl = exposed.find((row) => row.harvest_batch_id === "hb-arl");
    expect(arl?.status).toBe("weighing");
    expect(arl?.truck_number).toBeNull();
    expect(arl?.in_transit_loads).toBe(1);
    expect(arl?.finished_at).toBe(sentAt);
    expect(arl?.weight_grams).toBe(140);
    const view = logisticsLotView(exposed.filter((row) => row.harvest_batch_id === "hb-arl"));
    const page = internalLogisticsPage({ queue: view ? [view] : [], scheduled: [], finished: [], nowIso: sentAt });
    expect(page).toContain("data-logistics-in-transit");
    expect(page).toContain("in transit, 1 load");
    m.run(`UPDATE field_loads SET sent_at = '2026-09-01T12:00:00.000Z' WHERE id = ?`, load1);
    expect((await listInTransitFieldLoads(m.db)).map((row) => row.id)).toContain(load1);
    m.run(`UPDATE field_loads SET sent_at = ? WHERE id = ?`, sentAt, load1);
    const second = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const load2 = new URL("http://local" + second.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, load2, formOf({ person_id: person, weight_grams: "6", harvest_batch_id: "hb-arl" }));
    await sendFieldLoad(m.db, load2, formOf({ person_id: person }));
    const merged = (await listDryQueueLots(m.db)).filter((row) => row.harvest_batch_id === "hb-arl");
    expect(merged).toHaveLength(1);
    expect(merged[0]?.weight_grams).toBe(146);
    expect(merged[0]?.in_transit_loads).toBe(2);
    expect(merged[0]?.finished_at).toBe(sentAt);
    expect(m.all(`SELECT id FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl' AND deleted_at IS NULL`)).toHaveLength(1);
    const mergedView = logisticsLotView(merged);
    const mergedPage = internalLogisticsPage({ queue: mergedView ? [mergedView] : [], scheduled: [], finished: [], nowIso: sentAt });
    expect(mergedPage).toContain("in transit, 2 loads");
    expect(mergedPage).toContain('data-wet-grams="146"');
  });

  it("the pass finishes the weighing lot and receives a load only when every HBN on it is passed", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-26281", serial: 6281, farm: "ARL", form: "spear" });
    seedBatch(m, { id: "hb-pns", hbn: "26244-PNS-GH-027-0-NA-26282", serial: 6282, farm: "PNS", form: "spear" });
    const first = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const load1 = new URL("http://local" + first.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, load1, formOf({ person_id: person, weight_grams: "100", harvest_batch_id: "hb-arl" }));
    await addFieldLoadWeight(m.db, load1, formOf({ person_id: person, weight_grams: "15", harvest_batch_id: "hb-pns" }));
    await sendFieldLoad(m.db, load1, formOf({ person_id: person }));
    const second = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const load2 = new URL("http://local" + second.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, load2, formOf({ person_id: person, weight_grams: "6", harvest_batch_id: "hb-arl" }));
    await sendFieldLoad(m.db, load2, formOf({ person_id: person }));
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-arl" }));
    const arlLot = m.get(`SELECT id, status, plant_count, harvest_file_seq FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl'`);
    expect(arlLot?.status).toBe("drying");
    expect(arlLot?.plant_count).toBeNull();
    expect(arlLot?.harvest_file_seq).toBe(1);
    expect(m.get(`SELECT package_code FROM local_inventory_items WHERE wet_weight_entry_id = ? AND deleted_at IS NULL`, String(arlLot?.id))?.package_code).toBe(
      "26281"
    );
    expect(m.get(`SELECT field_closed_at FROM harvest_batches WHERE id = 'hb-arl'`)?.field_closed_at).toBeNull();
    expect(m.get(`SELECT status FROM field_loads WHERE id = ?`, load2)?.status).toBe("received");
    expect(m.get(`SELECT received_by FROM field_loads WHERE id = ?`, load2)?.received_by).toBe(person);
    expect(m.get(`SELECT status FROM field_loads WHERE id = ?`, load1)?.status).toBe("in_transit");
    expect((await listInTransitFieldLoads(m.db)).map((row) => row.id)).toEqual([load1]);
    expect(m.all(`SELECT reason FROM record_change_log WHERE record_id = ? AND field = 'status'`, load2).map((row) => row.reason)).toContain(
      "field load received"
    );
    const pass = (await listOpenLogisticsSchedules(m.db)).find((row) => row.harvest_batch_id === "hb-arl");
    expect(pass).toBeTruthy();
    await unscheduleLogisticsLot(m.db, String(pass?.id), formOf({ person_id: person }));
    expect(m.get(`SELECT status FROM field_loads WHERE id = ?`, load2)?.status).toBe("received");
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl'`)?.status).toBe("drying");
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-arl" }));
    expect(m.get(`SELECT status FROM field_loads WHERE id = ?`, load1)?.status).toBe("in_transit");
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-pns" }));
    expect(m.get(`SELECT status, plant_count FROM wet_weight_entries WHERE harvest_batch_id = 'hb-pns'`)).toMatchObject({
      status: "drying",
      plant_count: null,
    });
    expect(m.get(`SELECT status FROM field_loads WHERE id = ?`, load1)?.status).toBe("received");
    expect(await listInTransitFieldLoads(m.db)).toEqual([]);
    expect((await listFieldHbns(m.db)).map((row) => row.id).sort()).toEqual(["hb-arl", "hb-pns"]);
    const third = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const load3 = new URL("http://local" + third.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, load3, formOf({ person_id: person, weight_grams: "4", harvest_batch_id: "hb-arl" }));
    const lots = m.all(`SELECT id, status FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl' AND deleted_at IS NULL`);
    expect(lots.filter((row) => row.status === "weighing")).toHaveLength(1);
    expect(lots.filter((row) => row.status === "drying")).toHaveLength(1);
    expect(String(lots.find((row) => row.status === "weighing")?.id)).not.toBe(String(arlLot?.id));
  });

  it("YES closes the HBN and the Demote of its lot reopens the select", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-26291", serial: 6291, farm: "ARL", form: "spear" });
    seedBatch(m, { id: "hb-pns", hbn: "26244-PNS-GH-027-0-NA-26292", serial: 6292, farm: "PNS", form: "spear" });
    const started = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const loadId = new URL("http://local" + started.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "9", harvest_batch_id: "hb-arl" }));
    await addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: "3", harvest_batch_id: "hb-pns" }));
    const yes = formOf({ person_id: person });
    yes.append("hbn", "hb-arl");
    await sendFieldLoad(m.db, loadId, yes);
    expect(m.get(`SELECT status FROM field_loads WHERE id = ?`, loadId)?.status).toBe("in_transit");
    expect((await listFieldHbns(m.db)).map((row) => row.id)).toEqual(["hb-pns"]);
    const again = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const load2 = new URL("http://local" + again.redirect).searchParams.get("load") ?? "";
    await expect(
      addFieldLoadWeight(m.db, load2, formOf({ person_id: person, weight_grams: "1", harvest_batch_id: "hb-arl" }))
    ).rejects.toMatchObject({ message: "That HBN is not on this list." });
    const lotId = String(m.get(`SELECT id FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl'`)?.id);
    await runQueueControl(m.db, "demote", formOf({ person_id: person, id: lotId, control: "demote" }), "wet_weight_entries");
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE id = ?`, lotId)?.status).toBe("weighing");
    expect(m.get(`SELECT field_closed_at, field_closed_by FROM harvest_batches WHERE id = 'hb-arl'`)).toEqual({
      field_closed_at: null,
      field_closed_by: null,
    });
    expect(m.all(`SELECT field FROM record_change_log WHERE record_id = 'hb-arl' AND reason = 'demoted'`).map((row) => row.field).sort()).toEqual([
      "field_closed_at",
      "field_closed_by",
    ]);
    expect((await listFieldHbns(m.db)).map((row) => row.id)).toContain("hb-arl");
    await addFieldLoadWeight(m.db, load2, formOf({ person_id: person, weight_grams: "2", harvest_batch_id: "hb-arl" }));
    expect(m.all(`SELECT id FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl' AND deleted_at IS NULL`)).toHaveLength(1);
  });

  it("a pass on a Penn North HBN does not close it or expose a weighing lot", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-26301", serial: 6301, farm: "PNN" });
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, material_form, status, actual_dryspc, created_at, updated_at)
       VALUES ('lot-dry', 'hb-pnn', 20, 'spear', 'drying', ?, ?, ?)`,
      HANG,
      T0,
      T0
    );
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, material_form, status, actual_dryspc, created_at, updated_at)
       VALUES ('lot-wet', 'hb-pnn', 5, 'spear', 'weighing', ?, ?, ?)`,
      HANG,
      T0,
      T0
    );
    m.run(
      `INSERT INTO field_loads (
         id, destination_farm_code, status, started_at, sent_at, effective_date, created_at, updated_at
       ) VALUES ('load-pnn', 'PNN', 'in_transit', ?, ?, '2026-09-30', ?, ?)`,
      T0,
      T0,
      T0,
      T0
    );
    m.run(
      `INSERT INTO wet_weights (
         id, wet_weight_entry_id, weight_grams, harvest_batch_id, field_load_id, created_at, updated_at
       ) VALUES ('tote-pnn', 'lot-wet', 5, 'hb-pnn', 'load-pnn', ?, ?)`,
      T0,
      T0
    );
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-pnn" }));
    expect(m.get(`SELECT field_closed_at FROM harvest_batches WHERE id = 'hb-pnn'`)?.field_closed_at).toBeNull();
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE id = 'lot-wet'`)?.status).toBe("weighing");
    expect(m.get(`SELECT status FROM field_loads WHERE id = 'load-pnn'`)?.status).toBe("in_transit");
    const dry = (await listDryQueueLots(m.db)).map((row) => row.id);
    const barn = (await listBarnWetLots(m.db)).map((row) => row.id);
    expect(dry).toContain("lot-dry");
    expect(dry).not.toContain("lot-wet");
    expect(barn).toEqual(dry);
  });

  it("renders the two warnings in the page locale", () => {
    const load = {
      id: "load-1",
      operator_name: "Field Hand",
      destination_farm_code: "PNN",
      destination_name: "Penn North",
      status: "open",
      started_at: T0,
      sent_at: null,
      effective_date: "2026-09-30",
    };
    const tote = {
      id: "t1",
      weight_grams: 10,
      created_at: T0,
      harvest_batch_id: "hb",
      hbn: "26244-ARL-GH-027-0-NA-26001",
      lot_id: "lot",
      lot_grams: 10,
      lot_status: "weighing",
    };
    const es = fieldHarvestPage({
      locale: "es",
      destinations: [{ code: "ARL", display_name: "Arlington" }, { code: "PNN", display_name: "Penn North" }],
      openLoads: [],
      sentLoads: [],
      picked: {
        load,
        totes: [tote],
        hbnOptions: [{ id: "hb", hbn: tote.hbn, label: "ARL / Fruity / 2026-09-30" }],
        carryId: null,
        finish: "ask",
        warnIds: [],
      },
    });
    expect(es).toContain("Cosecha Penn South/Arlington");
    // THE FINISH LOAD IN REACH (canon 0.30.335): under the entry row, above the totes; its script after them, once.
    const entryEnd = es.indexOf("</form>", es.indexOf("data-field-entry"));
    const blockAt = es.indexOf('<details class="field-finish"');
    const firstTote = es.indexOf("data-field-tote=");
    const finishJs = es.indexOf('document.querySelector("[data-finish-yes]")');
    expect(entryEnd).toBeGreaterThan(-1);
    expect(blockAt).toBeGreaterThan(entryEnd);
    expect(firstTote).toBeGreaterThan(blockAt);
    expect(finishJs).toBeGreaterThan(es.lastIndexOf("data-field-tote="));
    expect(es.split('document.querySelector("[data-finish-yes]")').length - 1).toBe(1);
    expect(es).toContain('block.addEventListener("toggle"');
    expect(es).toContain('<details class="field-finish" data-finish-load open>');
    expect(es).toContain('<summary class="btn" data-finish-open>Terminar carga</summary>');
    // MT1 (canon 0.30.556): each HBN on the truck is a fieldset of three radios, Not finished checked.
    expect(es).toContain('<fieldset class="field-finish-item" data-finish-hbn="hb">');
    expect(es).toContain('<input type="radio" name="pick_hb" value="" data-hbn-label="26244-ARL-GH-027-0-NA-26001" checked> Sin terminar');
    expect(es).toContain('<input type="radio" name="pick_hb" value="more" data-hbn-label="26244-ARL-GH-027-0-NA-26001"> Vienen mas camiones');
    expect(es).toContain('<input type="radio" name="pick_hb" value="last" data-hbn-label="26244-ARL-GH-027-0-NA-26001"> Ultimo camion');
    expect(es).toContain(
      'data-confirm-more="La parte de los HBN: {list} en este camion se terminara y su archivo de cosecha quedara pendiente. El HBN sigue en la lista para el proximo camion."'
    );
    expect(es).not.toContain('type="checkbox" name="hbn"');
    expect(es).toContain('<select name="harvest_batch_id" aria-label="HBN">');
    expect(es).toContain('<span class="field-tote-pin"><input type="password" name="pin"');
    expect(es).toContain("Desea terminar algun HBN de esta carga?");
    expect(es).toContain(
      "Esta seguro de terminar de agregar pesos a los HBN: {list}? Una vez terminados, no podra agregar mas peso sin la aprobacion del administrador."
    );
    expect(es).toContain(">SI<");
    expect(es).toContain(">NO<");
    const warn = fieldHarvestPage({
      locale: "es",
      destinations: [],
      openLoads: [],
      sentLoads: [],
      picked: {
        load,
        totes: [tote],
        hbnOptions: [{ id: "hb", hbn: tote.hbn, label: "ARL / Fruity / 2026-09-30" }],
        carryId: null,
        finish: "warn",
        warnIds: ["hb"],
      },
    });
    expect(warn).toContain(
      "Esta seguro de terminar de agregar pesos a los HBN: 26244-ARL-GH-027-0-NA-26001? Una vez terminados, no podra agregar mas peso sin la aprobacion del administrador."
    );
    expect(warn).toContain("Volver");
    expect(warn).toContain("Confirmar");
    expect(warn).toContain("Cargas enviadas");
  });
});

describe("MT1, More trucks coming (canon 0.30.556)", () => {
  async function newLoad(m: MigratedDb, person: string): Promise<string> {
    const started = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    return new URL("http://local" + started.redirect).searchParams.get("load") ?? "";
  }

  it("More trucks coming finishes the truck's part and keeps the HBN listed; the next truck opens part 2; Last truck closes it", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    // A silo batch filled by two trucks, Bucked on Silo 1 as the 2026-10-26 Penn South run was, and the next silo's HBN.
    seedBatch(m, { id: "hb-s1", hbn: "26299-PNS-OD-044-0-01-26701", serial: 6701, farm: "PNS", silo: "1" });
    seedBatch(m, { id: "hb-s2", hbn: "26299-PNS-OD-074-0-02-26702", serial: 6702, farm: "PNS", silo: "2" });
    const truck1 = await newLoad(m, person);
    await addFieldLoadWeight(m.db, truck1, formOf({ person_id: person, weight_grams: "7000", harvest_batch_id: "hb-s1" }));
    await addFieldLoadWeight(m.db, truck1, formOf({ person_id: person, weight_grams: "6500", harvest_batch_id: "hb-s1" }));
    const more = formOf({ person_id: person });
    more.append("hbn_more", "hb-s1");
    await sendFieldLoad(m.db, truck1, more);
    const part1 = m.get(`SELECT id, status, weight_grams, harvest_file_seq, finished_at FROM wet_weight_entries WHERE harvest_batch_id = 'hb-s1'`);
    expect(part1?.status).toBe("drying");
    expect(part1?.weight_grams).toBe(13500);
    expect(part1?.harvest_file_seq).toBe(1);
    expect(part1?.finished_at).toBeTruthy();
    const marked = m.get(`SELECT field_closed_at, field_more_trucks_at, field_more_trucks_by FROM harvest_batches WHERE id = 'hb-s1'`);
    expect(marked?.field_closed_at).toBeNull();
    expect(marked?.field_more_trucks_at).toBeTruthy();
    expect(marked?.field_more_trucks_by).toBe(person);
    expect(
      m.all(`SELECT field, reason FROM record_change_log WHERE record_id = 'hb-s1' ORDER BY field`).map((row) => `${row.field} ${row.reason}`)
    ).toEqual(["field_more_trucks_at field more trucks coming", "field_more_trucks_by field more trucks coming"]);
    const listed = (await listFieldHbns(m.db)).find((row) => row.id === "hb-s1");
    expect(listed?.moreTrucks).toBe(true);
    expect((await listFieldHbns(m.db)).find((row) => row.id === "hb-s2")?.moreTrucks).toBe(false);

    // Truck 2 carries the rest of Silo 1 and the start of Silo 2.
    const truck2 = await newLoad(m, person);
    await addFieldLoadWeight(m.db, truck2, formOf({ person_id: person, weight_grams: "6000", harvest_batch_id: "hb-s1" }));
    await addFieldLoadWeight(m.db, truck2, formOf({ person_id: person, weight_grams: "6800", harvest_batch_id: "hb-s2" }));
    expect(m.all(`SELECT id FROM wet_weight_entries WHERE harvest_batch_id = 'hb-s1' AND deleted_at IS NULL`)).toHaveLength(2);
    const picks = formOf({ person_id: person });
    picks.append("pick_hb-s1", "last");
    picks.append("pick_hb-s2", "more");
    await sendFieldLoad(m.db, truck2, picks);
    const parts = m.all(
      `SELECT status, weight_grams, harvest_file_seq FROM wet_weight_entries WHERE harvest_batch_id = 'hb-s1' ORDER BY harvest_file_seq`
    );
    expect(parts).toEqual([
      { status: "drying", weight_grams: 13500, harvest_file_seq: 1 },
      { status: "drying", weight_grams: 6000, harvest_file_seq: 2 },
    ]);
    const closed = m.get(
      `SELECT field_closed_at, field_closed_by, field_more_trucks_at, field_more_trucks_by FROM harvest_batches WHERE id = 'hb-s1'`
    );
    expect(closed?.field_closed_at).toBeTruthy();
    expect(closed?.field_closed_by).toBe(person);
    expect(closed?.field_more_trucks_at).toBeNull();
    expect(closed?.field_more_trucks_by).toBeNull();
    expect(
      m
        .all(`SELECT field, new_value, reason FROM record_change_log WHERE record_id = 'hb-s1' AND reason = 'field hbn closed' ORDER BY field`)
        .map((row) => `${row.field} ${row.new_value === null ? "null" : "set"}`)
    ).toEqual(["field_closed_at set", "field_closed_by set", "field_more_trucks_at null", "field_more_trucks_by null"]);
    const ids = (await listFieldHbns(m.db)).map((row) => row.id);
    expect(ids).not.toContain("hb-s1");
    expect(ids).toContain("hb-s2");
    expect(m.get(`SELECT field_more_trucks_at FROM harvest_batches WHERE id = 'hb-s2'`)?.field_more_trucks_at).toBeTruthy();
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE harvest_batch_id = 'hb-s2'`)?.status).toBe("drying");
    expect((await listMoreTrucksHbns(m.db)).map((row) => [row.id, row.parts, row.grams, row.weighing])).toEqual([["hb-s2", 1, 6800, false]]);
  });

  it("the mark keeps the HBN on the select past the farm day; a second More trucks coming keeps the first mark", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-x", hbn: "26244-PNS-GH-027-0-NA-26711", serial: 6711, farm: "PNS", form: "spear" });
    // A part finished three days ago, before the farm's today: the farm-day rule alone drops the HBN.
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, effective_date, finished_at, harvest_file_seq, created_at, updated_at)
       VALUES ('lot-x1', 'hb-x', 10, ?, 'drying', '2026-09-27', ?, 1, ?, ?)`,
      HANG,
      T0,
      T0,
      T0
    );
    expect((await listFieldHbns(m.db)).map((row) => row.id)).not.toContain("hb-x");
    m.run(`UPDATE harvest_batches SET field_more_trucks_at = ?, field_more_trucks_by = ? WHERE id = 'hb-x'`, T0, person);
    expect((await listFieldHbns(m.db)).map((row) => row.id)).toContain("hb-x");
    // The next truck: its first tote opens part 2; More trucks coming again leaves the mark as it was.
    const truck = await newLoad(m, person);
    await addFieldLoadWeight(m.db, truck, formOf({ person_id: person, weight_grams: "5", harvest_batch_id: "hb-x" }));
    const again = formOf({ person_id: person });
    again.append("hbn_more", "hb-x");
    await sendFieldLoad(m.db, truck, again);
    expect(m.get(`SELECT field_more_trucks_at FROM harvest_batches WHERE id = 'hb-x'`)?.field_more_trucks_at).toBe(T0);
    expect(m.all(`SELECT id FROM record_change_log WHERE record_id = 'hb-x' AND field LIKE 'field_more_trucks%'`)).toHaveLength(0);
    expect(m.all(`SELECT harvest_file_seq FROM wet_weight_entries WHERE harvest_batch_id = 'hb-x' ORDER BY harvest_file_seq`).map((row) => row.harvest_file_seq)).toEqual([1, 2]);
    expect((await listFieldHbns(m.db)).map((row) => row.id)).toContain("hb-x");
  });

  it("refuses one HBN in both lists and a pick off the load, in words; the old YES and NO stand", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-a", hbn: "26244-ARL-GH-027-0-NA-26721", serial: 6721, farm: "ARL", form: "spear" });
    seedBatch(m, { id: "hb-b", hbn: "26244-PNS-GH-027-0-NA-26722", serial: 6722, farm: "PNS", form: "spear" });
    const truck = await newLoad(m, person);
    await addFieldLoadWeight(m.db, truck, formOf({ person_id: person, weight_grams: "4", harvest_batch_id: "hb-a" }));
    const both = formOf({ person_id: person });
    both.append("hbn", "hb-a");
    both.append("hbn_more", "hb-a");
    await expect(sendFieldLoad(m.db, truck, both)).rejects.toMatchObject({ message: FIELD_PICK_BOTH });
    const radios = formOf({ person_id: person });
    radios.append("hbn_more", "hb-a");
    radios.append("pick_hb-a", "last");
    await expect(sendFieldLoad(m.db, truck, radios)).rejects.toMatchObject({ message: FIELD_PICK_BOTH });
    const off = formOf({ person_id: person });
    off.append("pick_hb-b", "more");
    await expect(sendFieldLoad(m.db, truck, off)).rejects.toMatchObject({ message: "That HBN is not on this load." });
    expect(m.get(`SELECT status FROM field_loads WHERE id = ?`, truck)?.status).toBe("open");
    const notYet = formOf({ person_id: person });
    notYet.append("pick_hb-a", "");
    await sendFieldLoad(m.db, truck, notYet);
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE harvest_batch_id = 'hb-a'`)?.status).toBe("weighing");
    expect(m.get(`SELECT field_more_trucks_at, field_closed_at FROM harvest_batches WHERE id = 'hb-a'`)).toEqual({
      field_more_trucks_at: null,
      field_closed_at: null,
    });
    expect(readFieldFinishPicks(new URLSearchParams("hbn=a&pick_b=more&pick_c=last&pick_d=&hbn_more=e"))).toEqual({
      last: ["a", "c"],
      more: ["e", "b"],
      both: [],
    });
  });

  it("the Admin close: the PIN, a part still weighing, then the close with its four logs", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const pin = await pinOf(m);
    seedBatch(m, { id: "hb-c", hbn: "26244-PNS-GH-027-0-NA-26731", serial: 6731, farm: "PNS", form: "spear" });
    const truck = await newLoad(m, person);
    await addFieldLoadWeight(m.db, truck, formOf({ person_id: person, weight_grams: "8", harvest_batch_id: "hb-c" }));
    const more = formOf({ person_id: person });
    more.append("hbn_more", "hb-c");
    await sendFieldLoad(m.db, truck, more);
    await expect(closeFieldHbn(m.db, "hb-c", formOf({ person_id: person, pin: "0" }))).rejects.toMatchObject({
      status: 403,
      message: "Closing an HBN needs the Admin PIN.",
    });
    // The next truck has started weighing it: that truck finishes it, not the close.
    const next = await newLoad(m, person);
    await addFieldLoadWeight(m.db, next, formOf({ person_id: person, weight_grams: "3", harvest_batch_id: "hb-c" }));
    await expect(closeFieldHbn(m.db, "hb-c", formOf({ person_id: person, pin }))).rejects.toMatchObject({
      message: "That HBN is weighing on an open load. Finish that load with Last truck instead.",
    });
    expect((await listMoreTrucksHbns(m.db)).map((row) => [row.id, row.weighing])).toEqual([["hb-c", true]]);
    // The floor voids that tote (it was weighed under the wrong HBN): the empty part no longer holds the close.
    m.run(`UPDATE wet_weights SET deleted_at = ?, deleted_by = ? WHERE field_load_id = ?`, T0, person, next);
    expect((await listMoreTrucksHbns(m.db)).map((row) => [row.id, row.weighing])).toEqual([["hb-c", false]]);
    const done = await closeFieldHbn(m.db, "hb-c", formOf({ person_id: person, pin }));
    expect(done.redirect).toBe("/station/field_harvest?ok=hbn_closed");
    const row = m.get(`SELECT field_closed_at, field_closed_by, field_more_trucks_at FROM harvest_batches WHERE id = 'hb-c'`);
    expect(row?.field_closed_at).toBeTruthy();
    expect(row?.field_closed_by).toBe(person);
    expect(row?.field_more_trucks_at).toBeNull();
    expect(
      m.all(`SELECT field FROM record_change_log WHERE record_id = 'hb-c' AND reason = 'field hbn closed, no more trucks' ORDER BY field`).map((r) => r.field)
    ).toEqual(["field_closed_at", "field_closed_by", "field_more_trucks_at", "field_more_trucks_by"]);
    expect((await listFieldHbns(m.db)).map((r) => r.id)).not.toContain("hb-c");
    expect(await listMoreTrucksHbns(m.db)).toEqual([]);
    await expect(closeFieldHbn(m.db, "hb-c", formOf({ person_id: person, pin }))).rejects.toMatchObject({
      message: "That HBN is not waiting on more trucks.",
    });
  });

  it("the page: the select's mark, the warn's two sentences with their hidden fields, and the waiting list with its close", () => {
    const load = {
      id: "load-1",
      operator_name: "Field Hand",
      destination_farm_code: "PNN",
      destination_name: "Penn North",
      status: "open",
      started_at: T0,
      sent_at: null,
      effective_date: "2026-09-30",
    };
    const tote = (hb: string, hbn: string) => ({
      id: `t-${hb}`,
      weight_grams: 10,
      created_at: T0,
      harvest_batch_id: hb,
      hbn,
      lot_id: `lot-${hb}`,
      lot_grams: 10,
      lot_status: "weighing",
    });
    const options = [
      { id: "hb-1", hbn: "26299-PNS-OD-044-0-01-26741", label: "PNS / Fruity / 2026-10-26", form: "bucked" as const, silo: "Silo 1", moreTrucks: true },
      { id: "hb-2", hbn: "26299-PNS-OD-074-0-02-26742", label: "PNS / Fruity / 2026-10-26", form: "bucked" as const, silo: "Silo 2", moreTrucks: false },
    ];
    const page = fieldHarvestPage({
      locale: "en",
      destinations: [],
      openLoads: [],
      sentLoads: [],
      picked: {
        load,
        totes: [tote("hb-1", options[0].hbn), tote("hb-2", options[1].hbn)],
        hbnOptions: options,
        carryId: "hb-1",
        finish: "warn",
        warnIds: ["hb-1"],
        moreIds: ["hb-2"],
      },
    });
    expect(page).toContain(">PNS / Fruity / 2026-10-26 (26299-PNS-OD-044-0-01-26741) Bucked Silo 1, more trucks coming</option>");
    expect(page).toContain(">PNS / Fruity / 2026-10-26 (26299-PNS-OD-074-0-02-26742) Bucked Silo 2</option>");
    expect(page).toContain(
      "<p data-finish-warn-more>This truck's part of HBN(s): 26299-PNS-OD-074-0-02-26742 will be finished and its harvest file will pend. The HBN stays on the list for the next truck.</p>"
    );
    expect(page).toContain("<p data-finish-warn-last>Are you sure you want to finish adding weights to HBN(s): 26299-PNS-OD-044-0-01-26741?");
    expect(page).toContain('<input type="hidden" name="hbn" value="hb-1"><input type="hidden" name="hbn_more" value="hb-2">');
    expect(page).toContain('name="pick_hb-1" value="last" data-hbn-label="26299-PNS-OD-044-0-01-26741" checked>');
    expect(page).toContain('name="pick_hb-2" value="more" data-hbn-label="26299-PNS-OD-074-0-02-26742" checked>');
    expect(page).not.toContain("data-more-trucks");
    const home = fieldHarvestPage({
      locale: "es",
      destinations: [{ code: "PNN", display_name: "Penn North" }],
      openLoads: [],
      sentLoads: [],
      picked: null,
      moreTrucks: [
        { id: "hb-2", hbn: options[1].hbn, label: "PNS / Fruity / 2026-10-26", more_trucks_at: T0, parts: 1, grams: 6800, weighing: false },
        { id: "hb-3", hbn: "26299-PNS-OD-074-0-03-26743", label: "PNS / Fruity / 2026-10-26", more_trucks_at: T0, parts: 2, grams: 13600, weighing: true },
      ],
    });
    expect(home).toContain('<section class="field-more" data-more-trucks>');
    expect(home).toContain("HBN en espera de mas camiones <span class=\"tile-count\">2</span>");
    expect(home).toContain("1 parte terminada, 6,800 g. Marcado");
    expect(home).toContain("2 partes terminadas, 13,600 g. Marcado");
    expect(home).toContain('action="/station/field_harvest/hbn/hb-2/close" class="field-more-close"');
    expect(home).not.toContain('action="/station/field_harvest/hbn/hb-3/close"');
    expect(home).toContain("Pesando ahora en una carga abierta.");
    expect(home).toContain(">Cerrar HBN</button>");
    expect(fieldHarvestPage({ locale: "en", destinations: [], openLoads: [], sentLoads: [], picked: null, moreTrucks: [] })).not.toContain("data-more-trucks");
  });
});
