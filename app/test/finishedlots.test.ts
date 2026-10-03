import { describe, expect, it } from "vitest";
import { addFieldLoadWeight, addLotWeight, editRecord, finishLot, sendFieldLoad, startFieldLoad, voidRecord } from "../src/actions";
import { listFieldHbns, listLotWeights } from "../src/db";
import {
  FINISHED_LOT_SCREENS,
  changeToteGrams,
  fieldLotsSoFar,
  fieldLotsSoFarBlock,
  finishedLotPage,
  finishedLotsSection,
  finishedLotWindow,
  getScreenLot,
  listFinishedLots,
  listLotTotes,
  reopenFinishedLot,
  voidFinishedTote,
} from "../src/finishedlots";
import { t } from "../src/i18n";
import { ledgerByTable, stationByKey } from "../src/pipeline";
import { formOf, migratedDb, seedBatch, seedPerson, type MigratedDb } from "./migrated";

const HANG = "a1000001-0001-4000-8000-000000000007";
// 2026-10-03 at noon Eastern: the farm day is 2026-10-03; the window opens at 06:00 Eastern on 2026-09-26 (10:00Z).
const NOW = "2026-10-03T16:00:00.000Z";

async function pinOf(m: MigratedDb): Promise<string> {
  return String(m.get(`SELECT value FROM app_config WHERE key = 'admin_pin'`)?.value ?? "");
}

function seedFinished(m: MigratedDb, id: string, batchId: string, status: string, finishedAt: string | null, grams = 0): void {
  m.run(
    `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, material_form, status, finished_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'spear', ?, ?, '2026-09-20T12:00:00.000Z', '2026-09-20T12:00:00.000Z')`,
    id,
    batchId,
    grams,
    HANG,
    status,
    finishedAt
  );
}

function seedTote(m: MigratedDb, id: string, lotId: string, grams: number, at: string, deletedAt: string | null = null): void {
  m.run(
    `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, deleted_at, deleted_by)
     VALUES (?, ?, ?, ?, 'person-1', ?, ?, ?)`,
    id,
    lotId,
    grams,
    at,
    at,
    deletedAt,
    deletedAt ? "person-1" : null
  );
}

function seedPackage(m: MigratedDb, id: string, lotId: string, batchId: string, qty: number, location = "Hang in Place"): void {
  m.run(
    `INSERT INTO local_inventory_items (id, item_kind, package_code, harvest_batch_id, wet_weight_entry_id, qty, uom, farm_code, license_value, location, created_at, updated_at)
     VALUES (?, 'SPR', ?, ?, ?, ?, 'g', 'PNN', 'AU-G-C-000832', ?, '2026-10-01T12:00:00.000Z', '2026-10-01T12:00:00.000Z')`,
    id,
    `PKG-${id}`,
    batchId,
    lotId,
    qty,
    location
  );
}

/** A field load to Penn North with totes on one HBN, sent with YES: the lot finishes and its wet package is minted. */
async function fieldFinished(m: MigratedDb, person: string, hbnId: string, grams: string[]): Promise<{ loadId: string; lotId: string }> {
  const started = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
  const loadId = new URL("http://local" + started.redirect).searchParams.get("load") ?? "";
  for (const g of grams) {
    await addFieldLoadWeight(m.db, loadId, formOf({ person_id: person, weight_grams: g, harvest_batch_id: hbnId }));
  }
  const yes = formOf({ person_id: person });
  yes.append("hbn", hbnId);
  await sendFieldLoad(m.db, loadId, yes);
  const lotId = String(m.get(`SELECT id FROM wet_weight_entries WHERE harvest_batch_id = ? AND deleted_at IS NULL`, hbnId)?.id);
  return { loadId, lotId };
}

describe("FINISHED LOTS, FOUND (canon 0.30.373): the list", () => {
  it("the window is the farm's today and the 7 farm days before it, by farmDayBounds", () => {
    expect(finishedLotWindow("2026-10-03", 6)).toEqual({
      startIso: "2026-09-26T10:00:00.000Z",
      endIso: "2026-10-04T10:00:00.000Z",
      firstDay: "2026-09-26",
    });
  });

  it("lists only the screen's farms, only lots off weighing, inside the 8 farm days by finished_at, newest finish first", async () => {
    const m = await migratedDb();
    seedPerson(m);
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-27001", serial: 7001, farm: "PNN", form: "spear" });
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-27002", serial: 7002, farm: "ARL", form: "spear" });
    seedBatch(m, { id: "hb-pns", hbn: "26244-PNS-GH-027-0-NA-27003", serial: 7003, farm: "PNS", form: "spear" });
    seedBatch(m, { id: "hb-met", hbn: "26244-PNN-GH-027-0-NA-27004", serial: 7004, farm: "PNN", born: "metrc" });
    seedFinished(m, "pnn-edge", "hb-pnn", "drying", "2026-09-26T10:00:00.000Z");
    seedFinished(m, "pnn-before", "hb-pnn", "drying", "2026-09-26T09:59:00.000Z");
    seedFinished(m, "pnn-today", "hb-pnn", "trimmed", "2026-10-03T15:00:00.000Z");
    seedFinished(m, "pnn-mid", "hb-pnn", "in_transit", "2026-09-30T18:00:00.000Z");
    seedFinished(m, "pnn-weighing", "hb-pnn", "weighing", null);
    seedFinished(m, "pnn-tomorrow", "hb-pnn", "drying", "2026-10-04T10:00:00.000Z");
    seedFinished(m, "met-lot", "hb-met", "drying", "2026-10-02T12:00:00.000Z");
    seedFinished(m, "arl-lot", "hb-arl", "drying", "2026-10-01T12:00:00.000Z");
    seedFinished(m, "pns-lot", "hb-pns", "unloaded", "2026-10-02T12:00:00.000Z");
    seedTote(m, "t1", "pnn-today", 1000, "2026-10-03T14:00:00.000Z");
    seedTote(m, "t2", "pnn-today", 344, "2026-10-03T14:10:00.000Z");
    seedTote(m, "t3", "pnn-today", 99999, "2026-10-03T14:20:00.000Z", "2026-10-03T14:30:00.000Z");
    const pnn = await listFinishedLots(m.db, FINISHED_LOT_SCREENS.wet_weight, NOW);
    expect(pnn.map((row) => row.id)).toEqual(["pnn-today", "pnn-mid", "pnn-edge"]);
    expect(pnn[0]).toMatchObject({ tote_count: 2, tote_grams: 1344, status: "trimmed", space_name: "Hang in Place" });
    const field = await listFinishedLots(m.db, FINISHED_LOT_SCREENS.field_harvest, NOW);
    expect(field.map((row) => row.id)).toEqual(["pns-lot", "arl-lot"]);
    const html = finishedLotsSection("en", FINISHED_LOT_SCREENS.wet_weight, pnn);
    expect(html.startsWith('<details class="finished-lots" data-finished-lots="wet_weight">')).toBe(true);
    expect(html).not.toContain("<details class=\"finished-lots\" data-finished-lots=\"wet_weight\" open");
    expect(html).toContain('href="/station/wet_weight/finished/pnn-today">27001</a>');
    expect(html).toContain("<td>3.00 lb (1,344 g)</td>");
    expect(html).toContain('<time datetime="2026-10-03T15:00:00.000Z">2026-10-03 11:00</time>');
    expect(html).toContain("<td>Trimmed</td>");
    // The pane never prints the HBN (canon 0.22.0): the list shows its last five only.
    expect(html).not.toContain("26244-PNN-GH-027-0-NA-27001");
    const es = finishedLotsSection("es", FINISHED_LOT_SCREENS.wet_weight, pnn);
    expect(es).toContain("Lotes terminados");
    expect(es).toContain("<td>Podado</td>");
    expect(finishedLotsSection("en", FINISHED_LOT_SCREENS.field_harvest, [])).toContain("No lots finished in these 8 farm days.");
  });

  it("listing a finished lot does not put its HBN back on the field select", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-27011", serial: 7011, farm: "ARL", form: "spear" });
    seedBatch(m, { id: "hb-pns", hbn: "26244-PNS-GH-027-0-NA-27012", serial: 7012, farm: "PNS", form: "spear" });
    const { lotId } = await fieldFinished(m, person, "hb-arl", ["5", "7"]);
    const before = (await listFieldHbns(m.db)).map((row) => row.id);
    expect(before).toEqual(["hb-pns"]);
    const listed = await listFinishedLots(m.db, FINISHED_LOT_SCREENS.field_harvest);
    expect(listed.map((row) => row.id)).toEqual([lotId]);
    const totes = await listLotTotes(m.db, lotId);
    const lot = await getScreenLot(m.db, FINISHED_LOT_SCREENS.field_harvest, lotId);
    if (!lot) throw new Error("no lot");
    finishedLotPage("en", FINISHED_LOT_SCREENS.field_harvest, lot, totes);
    expect((await listFieldHbns(m.db)).map((row) => row.id)).toEqual(before);
    // The other screen does not see it.
    expect(await getScreenLot(m.db, FINISHED_LOT_SCREENS.wet_weight, lotId)).toBeNull();
  });
});

describe("FINISHED LOTS, FOUND (canon 0.30.373): the lot's page", () => {
  it("lists live and voided totes newest first, the voided struck through with when, who and why, the total the live sum", async () => {
    const m = await migratedDb();
    seedPerson(m);
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-27021", serial: 7021, farm: "PNN", form: "spear" });
    seedFinished(m, "lot-1", "hb-pnn", "drying", "2026-10-03T15:00:00.000Z", 1500);
    seedTote(m, "t1", "lot-1", 1000, "2026-10-03T14:00:00.000Z");
    seedTote(m, "t2", "lot-1", 500, "2026-10-03T14:10:00.000Z");
    seedTote(m, "t3", "lot-1", 112032, "2026-10-03T14:20:00.000Z", "2026-10-03T14:30:00.000Z");
    m.run(
      `INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
       VALUES ('log-1', 'wet_weights', 't3', 'deleted_at', NULL, '2026-10-03T14:30:00.000Z', 'person-1', 'a typo on the scale', '2026-10-03T14:30:00.000Z')`
    );
    const lot = await getScreenLot(m.db, FINISHED_LOT_SCREENS.wet_weight, "lot-1");
    if (!lot) throw new Error("no lot");
    const totes = await listLotTotes(m.db, "lot-1");
    expect(totes.map((row) => row.id)).toEqual(["t3", "t2", "t1"]);
    const html = finishedLotPage("en", FINISHED_LOT_SCREENS.wet_weight, lot, totes);
    expect(html).toContain("<dd data-lot-live-count>2</dd>");
    expect(html).toContain('data-lot-live-grams="1500">3.35 lb (1,500 g)</dd>');
    expect(html).toContain('<tr data-lot-tote="t3" data-tote-voided>');
    expect(html).toContain("<td><s>112,032</s></td>");
    expect(html).toContain("Voided 2026-10-03 10:30 by Smoke Hand: a typo on the scale");
    expect(html).not.toContain('action="/station/wet_weight/finished/totes/t3/void"');
    expect(html).toContain('action="/station/wet_weight/finished/totes/t2/void"');
    expect(html).toContain('action="/station/wet_weight/finished/lot-1/reopen"');
    expect(html).toContain('<td><time datetime="2026-10-03T14:00:00.000Z">2026-10-03 10:00</time></td>');
    const es = finishedLotPage("es", FINISHED_LOT_SCREENS.wet_weight, lot, totes);
    expect(es).toContain("Anulado 2026-10-03 10:30 por Smoke Hand: a typo on the scale");
    expect(es).toContain(t("es", "Void this tote"));
    expect(es).toContain("Reabrir");
    // A trimmed lot shows its totes and offers neither Void nor Reopen.
    m.run(`UPDATE wet_weight_entries SET status = 'trimmed' WHERE id = 'lot-1'`);
    const closed = await getScreenLot(m.db, FINISHED_LOT_SCREENS.wet_weight, "lot-1");
    if (!closed) throw new Error("no lot");
    const closedHtml = finishedLotPage("en", FINISHED_LOT_SCREENS.wet_weight, closed, totes);
    expect(closedHtml).not.toContain("/void");
    expect(closedHtml).not.toContain("/reopen");
    expect(closedHtml).toContain("The wet weight of this lot is closed (unloaded, trimmed or frozen). Ask the Scribe for a repair.");
  });
});

describe("FINISHED LOTS, FOUND (canon 0.30.373): Void a tote", () => {
  it("voids soft, logs the reason, and drops the lot and its wet package by the tote's grams in one batch", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-27031", serial: 7031, farm: "ARL", form: "spear" });
    const { lotId } = await fieldFinished(m, person, "hb-arl", ["100", "20000", "30"]);
    expect(m.get(`SELECT status, weight_grams FROM wet_weight_entries WHERE id = ?`, lotId)).toEqual({ status: "drying", weight_grams: 20130 });
    const pkg = m.get(`SELECT id, qty, item_kind FROM local_inventory_items WHERE wet_weight_entry_id = ? AND deleted_at IS NULL`, lotId);
    expect(pkg).toMatchObject({ qty: 20130, item_kind: "SPR" });
    const tote = String(m.get(`SELECT id FROM wet_weights WHERE wet_weight_entry_id = ? AND weight_grams = 20000`, lotId)?.id);
    const pin = await pinOf(m);
    await expect(voidFinishedTote(m.db, "field_harvest", tote, formOf({ person_id: person, reason: "typo", pin: "00000" }))).rejects.toMatchObject({
      status: 403,
      message: "Voiding a tote needs the Admin PIN.",
    });
    await expect(voidFinishedTote(m.db, "field_harvest", tote, formOf({ person_id: person, reason: " ", pin }))).rejects.toMatchObject({
      message: "Reason is required.",
    });
    await expect(voidFinishedTote(m.db, "wet_weight", tote, formOf({ person_id: person, reason: "typo", pin }))).rejects.toMatchObject({
      message: "That lot is not on this screen.",
    });
    const done = await voidFinishedTote(m.db, "field_harvest", tote, formOf({ person_id: person, reason: "a typo on the scale", pin }));
    expect(done.redirect).toBe(`/station/field_harvest/finished/${lotId}?ok=tote_voided`);
    const voided = m.get(`SELECT deleted_at, deleted_by, weight_grams FROM wet_weights WHERE id = ?`, tote);
    expect(voided?.deleted_at).toBeTruthy();
    expect(voided).toMatchObject({ deleted_by: person, weight_grams: 20000 });
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = ?`, lotId)?.weight_grams).toBe(130);
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = ?`, String(pkg?.id))?.qty).toBe(130);
    const logs = m.all(`SELECT record_table, field, old_value, new_value, reason FROM record_change_log WHERE reason = 'a typo on the scale' ORDER BY record_table`);
    expect(logs.map((row) => [row.record_table, row.field, row.old_value, row.new_value])).toEqual([
      ["local_inventory_items", "qty", "20130", "130"],
      ["wet_weight_entries", "weight_grams", "20130", "130"],
      ["wet_weights", "deleted_at", null, voided?.deleted_at],
    ]);
    await expect(voidFinishedTote(m.db, "field_harvest", tote, formOf({ person_id: person, reason: "again", pin }))).rejects.toMatchObject({
      message: "That tote is already voided.",
    });
    const lot = await getScreenLot(m.db, FINISHED_LOT_SCREENS.field_harvest, lotId);
    if (!lot) throw new Error("no lot");
    const page = finishedLotPage("en", FINISHED_LOT_SCREENS.field_harvest, lot, await listLotTotes(m.db, lotId));
    expect(page).toContain("<dd data-lot-live-count>2</dd>");
    expect(page).toContain(": a typo on the scale");
    expect(page).toContain("Field Hand / Penn North / ");
  });

  it("refuses once the lot is unloaded, trimmed or frozen, and when the package has children or has left its space", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const pin = await pinOf(m);
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-27041", serial: 7041, farm: "PNN", form: "spear" });
    seedFinished(m, "lot-1", "hb-pnn", "drying", "2026-10-03T15:00:00.000Z", 1500);
    seedTote(m, "t1", "lot-1", 1000, "2026-10-03T14:00:00.000Z");
    seedTote(m, "t2", "lot-1", 500, "2026-10-03T14:10:00.000Z");
    seedPackage(m, "pkg-1", "lot-1", "hb-pnn", 1500);
    const tryVoid = () => voidFinishedTote(m.db, "wet_weight", "t2", formOf({ person_id: person, reason: "typo", pin }));
    for (const status of ["unloaded", "trimmed", "frozen"]) {
      m.run(`UPDATE wet_weight_entries SET status = ? WHERE id = 'lot-1'`, status);
      await expect(tryVoid()).rejects.toMatchObject({
        status: 400,
        message: "The wet weight of this lot is closed (unloaded, trimmed or frozen). Ask the Scribe for a repair.",
      });
    }
    m.run(`UPDATE wet_weight_entries SET status = 'drying' WHERE id = 'lot-1'`);
    m.run(
      `INSERT INTO local_inventory_items (id, item_kind, package_code, wet_weight_entry_id, qty, uom, farm_code, license_value, location, parent_item_id, created_at, updated_at)
       VALUES ('pkg-child', 'WIP', 'PKG-CHILD', NULL, 10, 'g', 'PNN', 'AU-G-C-000832', 'Hang in Place', 'pkg-1', '2026-10-02T12:00:00.000Z', '2026-10-02T12:00:00.000Z')`
    );
    await expect(tryVoid()).rejects.toMatchObject({
      message: "The lot's wet package has packages made from it, so its wet weight is closed. Ask the Scribe for a repair.",
    });
    m.run(`UPDATE local_inventory_items SET deleted_at = '2026-10-02T13:00:00.000Z' WHERE id = 'pkg-child'`);
    m.run(`UPDATE local_inventory_items SET location = 'CSA' WHERE id = 'pkg-1'`);
    await expect(tryVoid()).rejects.toMatchObject({
      message: "The lot's wet package has left its space, so its wet weight is closed. Ask the Scribe for a repair.",
    });
    m.run(`UPDATE local_inventory_items SET location = 'BARN' WHERE id = 'pkg-1'`);
    // Nothing moved on any refusal.
    expect(m.get(`SELECT deleted_at FROM wet_weights WHERE id = 't2'`)?.deleted_at).toBeNull();
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(1500);
    // Weighing with no package yet: the lot alone drops.
    m.run(`UPDATE wet_weight_entries SET status = 'weighing', finished_at = NULL WHERE id = 'lot-1'`);
    m.run(`UPDATE local_inventory_items SET deleted_at = '2026-10-02T13:00:00.000Z' WHERE id = 'pkg-1'`);
    await tryVoid();
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = 'lot-1'`)?.weight_grams).toBe(1000);
  });
});

describe("FINISHED LOTS, FOUND (canon 0.30.373): Reopen", () => {
  it("on the field node: the Demote's effect, every earlier tote on the weigh screen, a new tote on the same lot", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const pin = await pinOf(m);
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-27051", serial: 7051, farm: "ARL", form: "spear" });
    const { loadId, lotId } = await fieldFinished(m, person, "hb-arl", ["11", "22", "33"]);
    expect(m.get(`SELECT field_closed_at FROM harvest_batches WHERE id = 'hb-arl'`)?.field_closed_at).toBeTruthy();
    await expect(reopenFinishedLot(m.db, "field_harvest", lotId, formOf({ person_id: person }))).rejects.toMatchObject({
      status: 403,
      message: "Reopening a lot needs the Admin PIN.",
    });
    const done = await reopenFinishedLot(m.db, "field_harvest", lotId, formOf({ person_id: person, pin }));
    expect(done.redirect).toBe(`/station/field_harvest?lot=${lotId}&ok=lot_reopened`);
    expect(m.get(`SELECT status, finished_at FROM wet_weight_entries WHERE id = ?`, lotId)).toEqual({ status: "weighing", finished_at: null });
    expect(m.get(`SELECT field_closed_at, field_closed_by FROM harvest_batches WHERE id = 'hb-arl'`)).toEqual({ field_closed_at: null, field_closed_by: null });
    expect(m.get(`SELECT old_value, new_value FROM record_change_log WHERE record_id = ? AND field = 'status' AND reason = 'demoted'`, lotId)).toEqual({
      old_value: "drying",
      new_value: "weighing",
    });
    expect((await listFieldHbns(m.db)).map((row) => row.id)).toContain("hb-arl");
    // Landing with no load: every earlier tote, counted and totaled.
    const landing = await fieldLotsSoFar(m.db, [lotId], null);
    expect(landing.map((row) => row.totes.length)).toEqual([3]);
    const landingHtml = fieldLotsSoFarBlock("en", landing, null);
    expect(landingHtml).toContain(`data-lot-so-far="${lotId}" data-lot-so-far-count="3" data-lot-so-far-grams="66"`);
    expect(landingHtml).toContain("51: all 3 totes on this lot, 0.15 lb (66 g)");
    // A lot whose totes all ride the load in hand needs no block: the load's own table lists them.
    expect(await fieldLotsSoFar(m.db, [lotId], loadId)).toHaveLength(0);
    // A new load: the new tote lands on the same lot and the block counts it with the earlier three.
    const again = await startFieldLoad(m.db, formOf({ person_id: person, operator_name: "Field Hand", destination_farm_code: "PNN" }));
    const load2 = new URL("http://local" + again.redirect).searchParams.get("load") ?? "";
    await addFieldLoadWeight(m.db, load2, formOf({ person_id: person, weight_grams: "44", harvest_batch_id: "hb-arl" }));
    expect(m.all(`SELECT id FROM wet_weight_entries WHERE harvest_batch_id = 'hb-arl' AND deleted_at IS NULL`)).toEqual([{ id: lotId }]);
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = ?`, lotId)?.weight_grams).toBe(110);
    const onLoad = await fieldLotsSoFar(m.db, [lotId], load2);
    const onLoadHtml = fieldLotsSoFarBlock("en", onLoad, load2);
    expect(onLoadHtml).toContain('data-lot-so-far-count="4" data-lot-so-far-grams="110"');
    expect(onLoadHtml).toContain("<td>This load</td>");
    expect(onLoadHtml.split("data-lot-tote=").length - 1).toBe(4);
    expect(fieldLotsSoFarBlock("es", onLoad, load2)).toContain("51: los 4 totes de este lote");
  });

  it("on Penn North Harvest: the lot opens on its ?lot= view with all its live totes and the next tote adds to it", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const pin = await pinOf(m);
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-27061", serial: 7061, farm: "PNN", form: "spear" });
    seedFinished(m, "lot-1", "hb-pnn", "in_transit", "2026-10-03T15:00:00.000Z", 1500);
    seedTote(m, "t1", "lot-1", 1000, "2026-10-03T14:00:00.000Z");
    seedTote(m, "t2", "lot-1", 500, "2026-10-03T14:10:00.000Z");
    seedPackage(m, "pkg-1", "lot-1", "hb-pnn", 1500);
    const done = await reopenFinishedLot(m.db, "wet_weight", "lot-1", formOf({ person_id: person, pin }));
    expect(done.redirect).toBe("/station/wet_weight?lot=lot-1&ok=lot_reopened");
    expect(m.get(`SELECT status, finished_at FROM wet_weight_entries WHERE id = 'lot-1'`)).toEqual({ status: "weighing", finished_at: null });
    // The Demote leaves the minted package alone; the next finish sets its qty to the lot's total.
    expect(m.get(`SELECT qty, deleted_at FROM local_inventory_items WHERE id = 'pkg-1'`)).toEqual({ qty: 1500, deleted_at: null });
    const station = stationByKey("wet_weight");
    const ledger = ledgerByTable("wet_weights");
    if (!station || !ledger) throw new Error("no station");
    expect((await listLotWeights(m.db, ledger, "lot-1")).map((row) => row.id).sort()).toEqual(["t1", "t2"]);
    await addLotWeight(m.db, station, "lot-1", formOf({ person_id: person, weight_grams: "250" }));
    expect((await listLotWeights(m.db, ledger, "lot-1"))).toHaveLength(3);
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = 'lot-1'`)?.weight_grams).toBe(1750);
    // Reopen is refused off drying and in transit.
    for (const status of ["weighing", "unloaded", "trimmed", "frozen"]) {
      m.run(`UPDATE wet_weight_entries SET status = ? WHERE id = 'lot-1'`, status);
      await expect(reopenFinishedLot(m.db, "wet_weight", "lot-1", formOf({ person_id: person, pin }))).rejects.toMatchObject({
        status: 400,
        message: "Only a drying or in-transit lot can be reopened. Ask the Scribe for a repair.",
      });
    }
  });
});

describe("THE OLD TOTE CONTROLS FOLLOW VOID'S LAW (canon 0.30.375)", () => {
  const closed = "The wet weight of this lot is closed (unloaded, trimmed or frozen). Ask the Scribe for a repair.";

  function logsFor(m: MigratedDb, reason: string): Array<Record<string, unknown>> {
    return m.all(
      `SELECT record_table, record_id, field, old_value, new_value, reason FROM record_change_log WHERE reason = ? ORDER BY record_table, field`,
      reason
    );
  }

  it("a drying lot's record void and record edit move the lot and its package by the grams, in one batch, with the reason", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const pin = await pinOf(m);
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-27071", serial: 7071, farm: "PNN", form: "spear" });
    seedFinished(m, "lot-1", "hb-pnn", "drying", "2026-10-03T15:00:00.000Z", 1500);
    seedTote(m, "t1", "lot-1", 1000, "2026-10-03T14:00:00.000Z");
    seedTote(m, "t2", "lot-1", 500, "2026-10-03T14:10:00.000Z");
    seedPackage(m, "pkg-1", "lot-1", "hb-pnn", 1500);
    await voidRecord(m.db, "wet_weights", "t2", formOf({ person_id: person, reason: "record void" }));
    expect(m.get(`SELECT deleted_at FROM wet_weights WHERE id = 't2'`)?.deleted_at).toBeTruthy();
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = 'lot-1'`)?.weight_grams).toBe(1000);
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(1000);
    expect(logsFor(m, "record void").map((row) => [row.record_table, row.field, row.old_value, row.new_value])).toEqual([
      ["local_inventory_items", "qty", "1500", "1000"],
      ["wet_weight_entries", "weight_grams", "1500", "1000"],
      ["wet_weights", "deleted_at", null, m.get(`SELECT deleted_at FROM wet_weights WHERE id = 't2'`)?.deleted_at],
    ]);
    await editRecord(m.db, "wet_weights", "t1", formOf({ person_id: person, reason: "record edit", weight_grams: "700" }));
    expect(m.get(`SELECT weight_grams FROM wet_weights WHERE id = 't1'`)?.weight_grams).toBe(700);
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = 'lot-1'`)?.weight_grams).toBe(700);
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(700);
    expect(logsFor(m, "record edit").map((row) => [row.record_table, row.field, row.old_value, row.new_value])).toEqual([
      ["local_inventory_items", "qty", "1000", "700"],
      ["wet_weight_entries", "weight_grams", "1000", "700"],
      ["wet_weights", "weight_grams", "1000", "700"],
    ]);
    // A higher weight moves the lot and the package up by the same grams.
    await editRecord(m.db, "wet_weights", "t1", formOf({ person_id: person, reason: "record raise", weight_grams: "900" }));
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = 'lot-1'`)?.weight_grams).toBe(900);
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(900);
    // The record layer offers no restore. The one function still undoes a void, and the package comes back up.
    await changeToteGrams(m.db, "t2", { op: "restore" }, person, "record restore", "2026-10-03T18:00:00.000Z");
    expect(m.get(`SELECT deleted_at FROM wet_weights WHERE id = 't2'`)?.deleted_at).toBeNull();
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = 'lot-1'`)?.weight_grams).toBe(1400);
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(1400);
    // V26's Void on a drying lot still drops both.
    await voidFinishedTote(m.db, "wet_weight", "t2", formOf({ person_id: person, reason: "screen void", pin }));
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = 'lot-1'`)?.weight_grams).toBe(900);
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(900);
  });

  it("a reopened weighing lot's package is untouched by a void, an edit or the screen Void, and the next finish sets it to the live total", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const pin = await pinOf(m);
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-27081", serial: 7081, farm: "PNN", form: "spear" });
    seedFinished(m, "lot-1", "hb-pnn", "drying", "2026-10-03T15:00:00.000Z", 1500);
    seedTote(m, "t1", "lot-1", 1000, "2026-10-03T14:00:00.000Z");
    seedTote(m, "t2", "lot-1", 500, "2026-10-03T14:10:00.000Z");
    seedPackage(m, "pkg-1", "lot-1", "hb-pnn", 1500);
    await reopenFinishedLot(m.db, "wet_weight", "lot-1", formOf({ person_id: person, pin }));
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE id = 'lot-1'`)?.status).toBe("weighing");
    await voidRecord(m.db, "wet_weights", "t2", formOf({ person_id: person, reason: "weighing void" }));
    await editRecord(m.db, "wet_weights", "t1", formOf({ person_id: person, reason: "weighing edit", weight_grams: "800" }));
    await voidFinishedTote(m.db, "wet_weight", "t1", formOf({ person_id: person, reason: "weighing screen", pin }));
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = 'lot-1'`)?.weight_grams).toBe(0);
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(1500);
    expect(m.all(`SELECT 1 AS n FROM record_change_log WHERE reason IN ('weighing void', 'weighing edit', 'weighing screen') AND record_table = 'local_inventory_items'`)).toEqual([]);
    const station = stationByKey("wet_weight");
    if (!station) throw new Error("no station");
    await addLotWeight(m.db, station, "lot-1", formOf({ person_id: person, weight_grams: "250" }));
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(1500);
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = 'lot-1'`)?.weight_grams).toBe(250);
    await finishLot(m.db, station, "lot-1", formOf({ person_id: person, plant_prompt: "skip" }));
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(250);
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE id = 'lot-1'`)?.status).not.toBe("weighing");
  });

  it("refuses unloaded, trimmed and frozen on every route, and V26's package refusals hold on the record routes", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const pin = await pinOf(m);
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-27091", serial: 7091, farm: "PNN", form: "spear" });
    seedFinished(m, "lot-1", "hb-pnn", "drying", "2026-10-03T15:00:00.000Z", 1500);
    seedTote(m, "t1", "lot-1", 1000, "2026-10-03T14:00:00.000Z");
    seedTote(m, "t2", "lot-1", 500, "2026-10-03T14:10:00.000Z");
    seedPackage(m, "pkg-1", "lot-1", "hb-pnn", 1500);
    const untouched = () => {
      expect(m.get(`SELECT deleted_at FROM wet_weights WHERE id = 't2'`)?.deleted_at).toBeNull();
      expect(m.get(`SELECT weight_grams FROM wet_weights WHERE id = 't1'`)?.weight_grams).toBe(1000);
      expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = 'lot-1'`)?.weight_grams).toBe(1500);
      expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(1500);
    };
    for (const status of ["unloaded", "trimmed", "frozen"]) {
      m.run(`UPDATE wet_weight_entries SET status = ? WHERE id = 'lot-1'`, status);
      await expect(voidRecord(m.db, "wet_weights", "t2", formOf({ person_id: person, reason: "no" }))).rejects.toMatchObject({ message: closed });
      await expect(editRecord(m.db, "wet_weights", "t1", formOf({ person_id: person, reason: "no", weight_grams: "100" }))).rejects.toMatchObject({
        message: closed,
      });
      await expect(voidFinishedTote(m.db, "wet_weight", "t2", formOf({ person_id: person, reason: "no", pin }))).rejects.toMatchObject({
        message: closed,
      });
      await expect(changeToteGrams(m.db, "t2", { op: "restore" }, person, "no", "2026-10-03T18:00:00.000Z")).rejects.toMatchObject({ message: closed });
      untouched();
    }
    m.run(`UPDATE wet_weight_entries SET status = 'drying' WHERE id = 'lot-1'`);
    m.run(
      `INSERT INTO local_inventory_items (id, item_kind, package_code, qty, uom, farm_code, license_value, location, parent_item_id, created_at, updated_at)
       VALUES ('pkg-child', 'WIP', 'PKG-CHILD', 10, 'g', 'PNN', 'AU-G-C-000832', 'Hang in Place', 'pkg-1', '2026-10-02T12:00:00.000Z', '2026-10-02T12:00:00.000Z')`
    );
    await expect(voidRecord(m.db, "wet_weights", "t2", formOf({ person_id: person, reason: "child" }))).rejects.toMatchObject({
      message: "The lot's wet package has packages made from it, so its wet weight is closed. Ask the Scribe for a repair.",
    });
    await expect(editRecord(m.db, "wet_weights", "t1", formOf({ person_id: person, reason: "child", weight_grams: "900" }))).rejects.toMatchObject({
      message: "The lot's wet package has packages made from it, so its wet weight is closed. Ask the Scribe for a repair.",
    });
    m.run(`UPDATE local_inventory_items SET deleted_at = '2026-10-02T13:00:00.000Z' WHERE id = 'pkg-child'`);
    m.run(`UPDATE local_inventory_items SET location = 'CSA' WHERE id = 'pkg-1'`);
    await expect(editRecord(m.db, "wet_weights", "t1", formOf({ person_id: person, reason: "left", weight_grams: "900" }))).rejects.toMatchObject({
      message: "The lot's wet package has left its space, so its wet weight is closed. Ask the Scribe for a repair.",
    });
    m.run(`UPDATE local_inventory_items SET location = 'Hang in Place' WHERE id = 'pkg-1'`);
    m.run(
      `INSERT INTO local_inventory_items (id, item_kind, package_code, wet_weight_entry_id, qty, uom, farm_code, license_value, location, created_at, updated_at)
       VALUES ('pkg-2', 'SPR', 'PKG-2', 'lot-1', 10, 'g', 'PNN', 'AU-G-C-000832', 'Hang in Place', '2026-10-02T12:00:00.000Z', '2026-10-02T12:00:00.000Z')`
    );
    await expect(voidRecord(m.db, "wet_weights", "t2", formOf({ person_id: person, reason: "many" }))).rejects.toMatchObject({
      message: "The lot has more than one wet package. Ask the Scribe for a repair.",
    });
    m.run(`UPDATE local_inventory_items SET deleted_at = '2026-10-02T13:00:00.000Z' WHERE id = 'pkg-2'`);
    untouched();
    m.run(`UPDATE local_inventory_items SET qty = 100 WHERE id = 'pkg-1'`);
    await expect(voidRecord(m.db, "wet_weights", "t2", formOf({ person_id: person, reason: "short" }))).rejects.toMatchObject({
      message: "The lot's wet package holds less than this tote. Ask the Scribe for a repair.",
    });
    await expect(editRecord(m.db, "wet_weights", "t1", formOf({ person_id: person, reason: "short", weight_grams: "100" }))).rejects.toMatchObject({
      message: "The lot's wet package holds less than this tote. Ask the Scribe for a repair.",
    });
    expect(m.get(`SELECT deleted_at FROM wet_weights WHERE id = 't2'`)?.deleted_at).toBeNull();
    expect(m.get(`SELECT weight_grams FROM wet_weights WHERE id = 't1'`)?.weight_grams).toBe(1000);
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(100);
  });

  it("an edit that does not change grams leaves the package and the lot total alone", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-a", hbn: "26244-PNN-GH-027-0-NA-27101", serial: 7101, farm: "PNN", form: "spear" });
    seedBatch(m, { id: "hb-b", hbn: "26244-PNN-GH-027-0-NA-27102", serial: 7102, farm: "PNN", form: "spear" });
    seedFinished(m, "lot-1", "hb-a", "weighing", null, 1000);
    seedTote(m, "t1", "lot-1", 1000, "2026-10-03T14:00:00.000Z");
    m.run(`UPDATE wet_weights SET harvest_batch_id = 'hb-a' WHERE id = 't1'`);
    seedPackage(m, "pkg-1", "lot-1", "hb-a", 1000);
    await editRecord(
      m.db,
      "wet_weights",
      "t1",
      formOf({ person_id: person, reason: "header only", harvest_batch_id: "hb-b", weight_grams: "1000" })
    );
    expect(m.get(`SELECT harvest_batch_id, weight_grams FROM wet_weights WHERE id = 't1'`)).toEqual({ harvest_batch_id: "hb-b", weight_grams: 1000 });
    expect(m.get(`SELECT weight_grams FROM wet_weight_entries WHERE id = 'lot-1'`)?.weight_grams).toBe(1000);
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'pkg-1'`)?.qty).toBe(1000);
    expect(m.all(`SELECT 1 AS n FROM record_change_log WHERE reason = 'header only' AND field = 'qty'`)).toEqual([]);
    expect(m.all(`SELECT 1 AS n FROM record_change_log WHERE reason = 'header only' AND field = 'weight_grams'`)).toEqual([]);
  });
});
