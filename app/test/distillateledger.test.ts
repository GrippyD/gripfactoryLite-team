import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import {
  BOWHOUSE_ID,
  COUNTS_YEAR_SQL,
  DISTILLATE_ON_HAND_KEY,
  MOVEMENTS_YEAR_SQL,
  SEED_PROCESSORS,
  bowHouseYieldLitersPerPound,
  distillateEntryPage,
  formatLitersFromGrams,
  harvestYearFromItemName,
  ledgerGrams,
  litersToGrams,
  listActiveProcessors,
  loadDistillateDesk,
  loadDistillateOnHand,
  metrcDistillateLiters,
  processorsPage,
  rowsAsOf,
  saveDistillateEntry,
  saveProcessor,
  varianceOverOneLiter,
} from "../src/distillate";
import { reportPage } from "../src/html";
import { t } from "../src/i18n";
import { app } from "../src/index";
import { backLinkFor } from "../src/nav";
import { opsGroupByKey } from "../src/pipeline";
import { isReportKey, REPORT_CARDS } from "../src/reports";
import { formOf, migratedDb, seedBatch, seedMirror, seedPerson } from "./migrated";

const NAMES = ["BowHouse", "Mitten", "Sauce", "Cannalicious", "Oakcanna", "Golden Lion"];

function envOf(db: D1Database) {
  return {
    DB: db,
    THEME: "grip",
    GF_ALLOW_FIXTURE_NOW: "1",
    ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) },
  } as unknown as Env;
}

describe("LD1 distillate ledger", () => {
  it("seeds the six processors in the migration", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const sql = fs.readFileSync(new URL("../migrations/0124_distillate_ledger.sql", import.meta.url), "utf8");
    expect(sql).toContain("2026-10-28T00:00:00.000Z");
    expect(sql).not.toMatch(/INSERT OR|AUTOINCREMENT|strftime/i);
    for (const name of NAMES) expect(sql).toContain(`'${name}'`);
    const m = await migratedDb();
    const rows = m.all(`SELECT id, name, active, deleted_at, created_at FROM processors ORDER BY name`);
    expect(rows.map((row) => row.name)).toEqual([...NAMES].sort((a, b) => a.localeCompare(b)));
    expect(rows.every((row) => row.active === 1 && row.deleted_at == null && row.created_at === "2026-10-28T00:00:00.000Z")).toBe(true);
    expect(m.get(`SELECT id FROM processors WHERE name = 'BowHouse'`)).toMatchObject({ id: BOWHOUSE_ID });
    expect(SEED_PROCESSORS).toHaveLength(6);
  });

  it("computes finished minus shipped plus adjust, drops a void, and honors the as-of date", () => {
    const rows = [
      { kind: "finished", grams: 10000, moved_on: "2026-10-01" },
      { kind: "shipped", grams: 2000, moved_on: "2026-10-02" },
      { kind: "adjust", grams: -500, moved_on: "2026-10-03" },
      { kind: "shipped", grams: 1000, moved_on: "2026-10-04", voided_at: "2026-10-05T00:00:00.000Z" },
    ];
    expect(ledgerGrams(rows)).toBe(7500);
    expect(ledgerGrams(rowsAsOf(rows, "2026-10-02"))).toBe(8000);
    expect(formatLitersFromGrams(7500)).toBe("7.50");
    expect(varianceOverOneLiter(9000, 7500)).toBe(true);
    expect(varianceOverOneLiter(8000, 7500)).toBe(false);
    expect(varianceOverOneLiter(8500, 7500)).toBe(false);
  });

  it("rounds liters to grams at 1,000 g per liter, half up", () => {
    expect(litersToGrams(10.5)).toBe(10500);
    expect(litersToGrams(1.234)).toBe(1234);
    expect(litersToGrams(1.2345)).toBe(1235);
    expect(litersToGrams(-0.5)).toBe(-500);
    expect(formatLitersFromGrams(1235)).toBe("1.24");
    expect(formatLitersFromGrams(-1500)).toBe("-1.50");
    expect(harvestYearFromItemName("2025 distillate")).toBe("2025");
    expect(harvestYearFromItemName("Bulk Distillate 2026")).toBe("2026");
    expect(harvestYearFromItemName("distillate")).toBeNull();
    expect(bowHouseYieldLitersPerPound()).toBeNull();
    expect(metrcDistillateLiters([{ quantity: 2500, uom: "g", item: "2026 Distillate" }])).toBe(2.5);
    expect(metrcDistillateLiters([{ quantity: 4, uom: "ea", item: "2026 Distillate" }])).toBeNull();
    expect(metrcDistillateLiters([{ quantity: 10, uom: "g", item: "Flower" }])).toBeNull();
  });

  it("refuses a zero movement, a future date, and a non-admin on the desk", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const base = {
      person_id: person,
      action: "movement",
      moved_on: "2026-10-01",
      harvest_year: "2026",
      processor: BOWHOUSE_ID,
      kind: "finished",
      liters: "1",
    };
    await expect(saveDistillateEntry(m.db, formOf({ ...base, liters: "0" }))).rejects.toMatchObject({
      message: "A movement needs liters above zero.",
    });
    await expect(saveDistillateEntry(m.db, formOf({ ...base, liters: "nope" }))).rejects.toMatchObject({
      message: "Liters must be a number.",
    });
    await expect(saveDistillateEntry(m.db, formOf({ ...base, moved_on: "2099-01-01" }))).rejects.toMatchObject({
      message: "That date is in the future.",
    });
    await expect(saveDistillateEntry(m.db, formOf({ ...base, harvest_year: "26" }))).rejects.toBeInstanceOf(HttpError);
    await expect(saveDistillateEntry(m.db, formOf({ ...base, kind: "adjust", liters: "-1", note: "" }))).rejects.toMatchObject({
      message: "An adjustment needs a note.",
    });
    const env = envOf(m.db);
    const locked = await app.request("/ops/distillate", {}, env);
    expect(locked.status).toBe(401);
    const posted = await app.request("/ops/distillate", { method: "POST", body: new URLSearchParams(base) }, env);
    expect(posted.status).toBe(401);
    expect(m.all(`SELECT id FROM distillate_movements`)).toHaveLength(0);
    const open = await app.request("/ops/distillate", { headers: { cookie: "gf_pin=21319" } }, env);
    expect(open.status).toBe(200);
    expect(await open.text()).toContain('data-processor-option="BowHouse"');
  });

  it("adds, renames, inactivates, and soft deletes a processor, and the picker leaves those out", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const added = await saveProcessor(m.db, formOf({ person_id: person, action: "add", name: "North Lab", reason: "open the door" }));
    expect(added.redirect).toContain("/admin/lookups/processors");
    const created = m.get(`SELECT id, name, active FROM processors WHERE name = 'North Lab'`);
    expect(created?.active).toBe(1);
    const id = String(created?.id);
    expect(m.all(`SELECT reason FROM record_change_log WHERE record_table = 'processors' AND record_id = ?`, id).some((row) => row.reason === "open the door")).toBe(true);
    await saveProcessor(m.db, formOf({ person_id: person, action: "rename", id, name: "North Works", reason: "rename reason" }));
    expect(m.get(`SELECT name FROM processors WHERE id = ?`, id)?.name).toBe("North Works");
    expect(m.get(`SELECT reason FROM record_change_log WHERE record_table = 'processors' AND record_id = ? AND field = 'name' AND new_value = 'North Works'`, id)?.reason).toBe("rename reason");
    await saveProcessor(m.db, formOf({ person_id: person, action: "active", id, active: "0", reason: "pause reason" }));
    expect(m.get(`SELECT active FROM processors WHERE id = ?`, id)?.active).toBe(0);
    expect((await listActiveProcessors(m.db)).some((row) => row.id === id)).toBe(false);
    await expect(saveDistillateEntry(m.db, formOf({
      person_id: person,
      action: "movement",
      moved_on: "2026-10-01",
      harvest_year: "2026",
      processor: id,
      kind: "finished",
      liters: "1",
    }))).rejects.toMatchObject({ message: "That processor is not active." });
    await saveProcessor(m.db, formOf({ person_id: person, action: "delete", id, reason: "close reason" }));
    expect(m.get(`SELECT deleted_at FROM processors WHERE id = ?`, id)?.deleted_at).toBeTruthy();
    expect(m.get(`SELECT reason FROM record_change_log WHERE record_table = 'processors' AND record_id = ? AND field = 'deleted_at'`, id)?.reason).toBe("close reason");
    expect(m.all(`SELECT id FROM processors WHERE name = 'North Works'`)).toHaveLength(1);
    const page = processorsPage(
      m.all(`SELECT id, name, active, created_at, updated_at, deleted_at FROM processors ORDER BY name`) as never,
      "en"
    );
    expect(page).toContain('data-bowhouse-yield=""');
    expect(page).toContain('data-processor="BowHouse"');
    expect(page).toContain('data-deleted="1"');
  });

  it("posts the ledger, binds the as-of date, flags a variance over one liter, and writes the void once", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const move = (fields: Record<string, string>) =>
      saveDistillateEntry(m.db, formOf({
        person_id: person,
        action: "movement",
        harvest_year: "2026",
        processor: BOWHOUSE_ID,
        ...fields,
      }));
    await move({ moved_on: "2026-10-01", kind: "finished", liters: "10.5", note: "made" });
    await move({ moved_on: "2026-10-01", kind: "shipped", liters: "2", note: "sold" });
    await saveDistillateEntry(m.db, formOf({
      person_id: person,
      action: "count",
      counted_on: "2026-10-01",
      harvest_year: "2026",
      processor: BOWHOUSE_ID,
      liters: "9",
      note: "shelf",
    }));
    expect(MOVEMENTS_YEAR_SQL).toContain("harvest_year = ?");
    expect(MOVEMENTS_YEAR_SQL).toContain("moved_on <= ?");
    expect(COUNTS_YEAR_SQL).toContain("counted_on <= ?");
    expect(MOVEMENTS_YEAR_SQL.includes("2026-10")).toBe(false);
    const first = await loadDistillateOnHand(m.db, new URLSearchParams({ year: "2026", as_of: "2026-10-28" }), "2026-10-28", "en");
    expect(first.view.belowTable).toContain('data-ledger-row="BowHouse"');
    expect(first.view.belowTable).toContain('data-ledger-liters="8.50"');
    expect(first.view.belowTable).toContain('data-variance-liters="0.50"');
    expect(first.view.belowTable).toContain('data-yield=""');
    expect(first.csv).toContain("Zoho liters");
    expect(first.csv).toContain("BowHouse");
    expect(first.csv).toContain("8.50");
    await move({ moved_on: "2026-10-15", kind: "finished", liters: "1", note: "later" });
    const early = await loadDistillateOnHand(m.db, new URLSearchParams({ year: "2026", as_of: "2026-10-01" }), "2026-10-28", "en");
    expect(early.view.belowTable).toContain('data-ledger-liters="8.50"');
    const later = await loadDistillateOnHand(m.db, new URLSearchParams({ year: "2026", as_of: "2026-10-28" }), "2026-10-28", "en");
    expect(later.view.belowTable).toContain('data-ledger-liters="9.50"');
    expect(later.view.belowTable).toContain('data-variance-liters="0.50"');
    const shipped = m.get(`SELECT id FROM distillate_movements WHERE kind = 'shipped' AND voided_at IS NULL`);
    await saveDistillateEntry(m.db, formOf({ person_id: person, action: "void", table: "movements", id: String(shipped?.id), reason: "wrong ship" }));
    const after = await loadDistillateOnHand(m.db, new URLSearchParams({ year: "2026", as_of: "2026-10-28" }), "2026-10-28", "en");
    expect(after.view.belowTable).toContain('data-ledger-liters="11.50"');
    expect(after.view.belowTable).toContain('data-variance-liters="-1.50"');
    expect(after.view.belowTable).toContain('data-flag="Over 1 L"');
    const logs = m.all(`SELECT field, reason FROM record_change_log WHERE record_table = 'distillate_movements' AND field = 'voided_at'`);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.reason).toBe("wrong ship");
    expect(m.get(`SELECT voided_at FROM distillate_movements WHERE id = ?`, String(shipped?.id))?.voided_at).toBeTruthy();
  });

  it("reads Zoho liters, flags a foreign UOM and a missing year, and shows METRC only when a package is there", async () => {
    const m = await migratedDb();
    const stamp = "2026-10-20T00:00:00.000Z";
    const listing = (id: string, name: string, uom: string, qty: number) => {
      m.run(
        `INSERT INTO listings (id, item_name, qty_grams, source, market_uom, market_qty, zoho_mounted_at, created_at, updated_at)
         VALUES (?, ?, 0, 'zoho', ?, ?, ?, ?, ?)`,
        id, name, uom, qty, stamp, stamp, stamp
      );
    };
    listing("z1", "2026 Distillate Bulk", "L", 12.5);
    listing("z2", "Mystery distillate", "L", 1);
    listing("z3", "2025 Distillate", "g", 4);
    const bare = await loadDistillateOnHand(m.db, new URLSearchParams({ as_of: "2026-10-28" }), "2026-10-28", "en");
    expect(bare.view.rows.some((row) => row.line === "2026 Distillate Bulk" && row.zoho_l === "12.50")).toBe(true);
    expect(bare.view.rows.some((row) => row.line === "Mystery distillate" && String(row.flag).includes("Year unknown"))).toBe(true);
    expect(bare.view.rows.some((row) => row.line === "2025 Distillate" && row.flag === "UOM is not L" && row.zoho_l === "")).toBe(true);
    expect(bare.view.footnote).toContain("compliance column is left out");
    expect(bare.view.belowTable).not.toContain("data-metrc-liters");
    seedMirror(m, { tag: "1A4000000000000000000001", item: "2026 Distillate", grams: 2500 });
    const withMetrc = await loadDistillateOnHand(m.db, new URLSearchParams({ as_of: "2026-10-28" }), "2026-10-28", "en");
    expect(withMetrc.view.belowTable).toContain('data-metrc-liters="2.50"');
    await saveDistillateEntry(m.db, formOf({
      person_id: seedPerson(m),
      action: "count",
      counted_on: "2026-10-01",
      harvest_year: "2026",
      liters: "20",
      note: "house",
    }));
    const house = await loadDistillateOnHand(m.db, new URLSearchParams({ year: "2026", as_of: "2026-10-28" }), "2026-10-28", "en");
    const zohoTotal = house.view.rows.find((row) => row.section === "Zoho" && row.line === "Year total");
    expect(zohoTotal?.zoho_l).toBe("12.50");
    expect(zohoTotal?.variance_l).toBe("7.50");
    expect(zohoTotal?.flag).toBe("Over 1 L");
  });

  it("stores a toll lot as the reference and speaks Spanish", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "batch-toll", hbn: "GreenCo-Toll-26111", serial: 26111 });
    m.run(`UPDATE harvest_batches SET customer = 'GreenCo' WHERE id = 'batch-toll'`);
    await saveDistillateEntry(m.db, formOf({
      person_id: person,
      action: "movement",
      moved_on: "2026-10-01",
      harvest_year: "2026",
      processor: BOWHOUSE_ID,
      kind: "finished",
      liters: "3",
      toll_lot: "batch-toll",
      note: "from the floor",
    }));
    expect(m.get(`SELECT ref FROM distillate_movements`)?.ref).toBe("toll lot GreenCo-Toll-26111");
    await expect(saveDistillateEntry(m.db, formOf({
      person_id: person,
      action: "movement",
      moved_on: "2026-10-01",
      harvest_year: "2026",
      processor: BOWHOUSE_ID,
      kind: "finished",
      liters: "1",
      toll_lot: "missing",
    }))).rejects.toMatchObject({ message: "Pick a toll lot." });
    const desk = await loadDistillateDesk(m.db, "2026-10-28");
    const es = distillateEntryPage(desk, "es");
    expect(es).toContain("Destilado");
    expect(es).toContain("de lote de cliente");
    expect(es).toContain("GreenCo-Toll-26111");
    expect(t("es", "Processors")).toBe("Procesadores");
    expect(t("es", "Distillate on hand")).toBe("Destilado en mano");
    expect(t("es", "Over 1 L")).toBe("Más de 1 L");
    const loaded = await loadDistillateOnHand(m.db, new URLSearchParams({ year: "2026", as_of: "2026-10-28" }), "2026-10-28", "es");
    const page = reportPage(loaded.view, loaded.filterHtml, "year=2026", "es");
    expect(page).toContain("Destilado en mano");
    expect(page).toContain("Litros de Zoho");
    expect(isReportKey(DISTILLATE_ON_HAND_KEY)).toBe(true);
    expect(REPORT_CARDS.some((card) => card.key === "distillate_on_hand" && card.title === "Distillate on hand")).toBe(true);
    expect(opsGroupByKey("production_ops")?.members.some((member) => member.href === "/ops/distillate")).toBe(true);
    expect(backLinkFor("/ops/distillate")).toEqual({ href: "/ops/production_ops", label: "Production Operations" });
    const env = envOf(m.db);
    const lookup = await app.request("/admin/lookups/processors", { headers: { cookie: "gf_pin=21319; gf_locale=es" } }, env);
    expect(lookup.status).toBe(200);
    const body = await lookup.text();
    expect(body).toContain("Procesadores");
    for (const name of NAMES) expect(body).toContain(name);
    const landing = await app.request("/admin/lookups", { headers: { cookie: "gf_pin=21319" } }, env);
    expect(await landing.text()).toContain('href="/admin/lookups/processors"');
  });
});
