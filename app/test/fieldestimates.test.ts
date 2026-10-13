import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import { GRAMS_PER_LB } from "../src/config";
import {
  ESTIMATE_FOR_SQL,
  ESTIMATES_AS_OF_SQL,
  FIELD_ESTIMATE_GRAMS_PER_LB,
  FIELD_ESTIMATE_LOG_REASON,
  FIELD_ESTIMATES_LIVE_INDEX,
  FIELD_ESTIMATES_LOOKUP_INDEX,
  FIELD_ESTIMATES_PATH,
  deleteFieldEstimate,
  estimateFor,
  estimatesAsOf,
  fieldEstimatesPage,
  loadFieldEstimatesPage,
  saveFieldEstimate,
  type FieldEstimatesPageModel,
} from "../src/fieldestimates";
import { adminGroupPage } from "../src/html";
import { DICT, refusalText, t } from "../src/i18n";
import { app } from "../src/index";
import { backLinkFor } from "../src/nav";
import { isReportKey, REPORT_KEYS } from "../src/reports";
import { formOf, migratedDb, seedPerson } from "./migrated";

const AFTER = "98cf3164-344e-414a-9f1c-1526fde445ac";
const ALIEN = "bb271969-e132-445b-b97b-51f676c8e225";

const PAGE_KEYS = [
  "Field estimates",
  "dry lb per plant (448 g)",
  "In force",
  "No field estimates yet.",
  "Dry pounds, hand entered. One pound is 448 g.",
  "An older date stands until a later date replaces it. Saving the same date replaces that row.",
  "The strain this estimate is for.",
  "The farm this estimate is for.",
  "An older date stands until this date.",
  "Hand entered dry pounds per plant at 448 g. The number is stored as typed.",
  "Memo, optional.",
  "Dry weight must be a positive number.",
  "Effective date is required.",
  "Effective date must be YYYY-MM-DD.",
  "Pick a live strain.",
  "Pick a live farm.",
  "That estimate is not on the list.",
];

function pageModel(): FieldEstimatesPageModel {
  return {
    today: "2026-10-12",
    strains: [{ id: AFTER, name: "After Party" }],
    farms: [{ code: "PNN", name: "PNN" }],
    rows: [
      {
        id: "later",
        strain_id: AFTER,
        strain_name: "After Party",
        farm_code: "PNN",
        effective_date: "2026-11-01",
        est_dry_weight: 9,
        reason: "later",
        in_force: false,
      },
      {
        id: "older",
        strain_id: AFTER,
        strain_name: "After Party",
        farm_code: "PNN",
        effective_date: "2026-09-01",
        est_dry_weight: 4,
        reason: null,
        in_force: true,
      },
    ],
  };
}

describe("FE1 field estimates", () => {
  it("keeps an older date until a later date, replaces the same date, and falls back when that row is removed", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const save = (fields: Record<string, string>) =>
      saveFieldEstimate(m.db, formOf({ person_id: person, strain_id: AFTER, farm_code: "PNN", ...fields }));

    await save({ effective_date: "2026-09-01", est_dry_weight: "10", reason: "opening" });
    const older = await estimateFor(m.db, AFTER, "PNN", "2026-09-15");
    expect(older).toMatchObject({ effective_date: "2026-09-01", est_dry_weight: 10, reason: "opening" });
    expect(await estimateFor(m.db, AFTER, "PNN", "2026-08-01")).toBeNull();

    await save({ effective_date: "2026-10-01", est_dry_weight: "12", reason: "october" });
    expect(await estimateFor(m.db, AFTER, "PNN", "2026-09-15")).toMatchObject({ est_dry_weight: 10, effective_date: "2026-09-01" });
    expect(await estimateFor(m.db, AFTER, "PNN", "2026-10-01")).toMatchObject({ est_dry_weight: 12, effective_date: "2026-10-01" });
    expect(await estimateFor(m.db, AFTER, "PNN", "2026-10-12")).toMatchObject({ est_dry_weight: 12 });
    const still = m.get(`SELECT id, est_dry_weight FROM field_estimates WHERE effective_date = '2026-09-01' AND deleted_at IS NULL`) as {
      id: string;
      est_dry_weight: number;
    };
    expect(still.est_dry_weight).toBe(10);

    await save({ strain_id: AFTER, farm_code: "PNS", effective_date: "2026-09-01", est_dry_weight: "7" });
    const mid = await estimatesAsOf(m.db, "2026-09-15");
    expect(mid.map((row) => [row.farm_code, row.est_dry_weight])).toEqual([
      ["PNN", 10],
      ["PNS", 7],
    ]);
    expect(await estimatesAsOf(m.db, "2026-10-12")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ farm_code: "PNN", est_dry_weight: 12, effective_date: "2026-10-01" }),
        expect.objectContaining({ farm_code: "PNS", est_dry_weight: 7 }),
      ])
    );

    const replaced = await save({ effective_date: "2026-10-01", est_dry_weight: "15", reason: "revised" });
    expect(replaced.redirect).toBe(`${FIELD_ESTIMATES_PATH}?ok=saved`);
    const live = m.all(
      `SELECT id, est_dry_weight, reason FROM field_estimates WHERE farm_code = 'PNN' AND effective_date = '2026-10-01' AND deleted_at IS NULL`
    );
    expect(live).toEqual([{ id: expect.any(String), est_dry_weight: 15, reason: "revised" }]);
    expect(live[0].id).not.toBe(still.id);
    const octoberId = String(live[0].id);
    const weightLog = m.all(
      `SELECT old_value, new_value, reason FROM record_change_log
       WHERE record_table = 'field_estimates' AND record_id = ? AND field = 'est_dry_weight'
       ORDER BY rowid`,
      octoberId
    );
    expect(weightLog.map((row) => [row.old_value, row.new_value, row.reason])).toEqual([
      [null, "12", "october"],
      ["12", "15", "revised"],
    ]);
    const untouched = m.get(`SELECT est_dry_weight FROM field_estimates WHERE id = ?`, still.id) as { est_dry_weight: number };
    expect(untouched.est_dry_weight).toBe(10);

    await save({ effective_date: "2026-10-01", est_dry_weight: "15", reason: "revised" });
    expect(
      m.all(`SELECT new_value FROM record_change_log WHERE record_id = ? AND field = 'est_dry_weight'`, octoberId)
    ).toHaveLength(2);

    await deleteFieldEstimate(m.db, octoberId, formOf({ person_id: person, reason: "no longer used" }));
    const gone = m.get(`SELECT deleted_at FROM field_estimates WHERE id = ?`, octoberId) as { deleted_at: string };
    expect(gone.deleted_at).toBeTruthy();
    expect(await estimateFor(m.db, AFTER, "PNN", "2026-10-12")).toMatchObject({ id: still.id, est_dry_weight: 10, effective_date: "2026-09-01" });
    const deleteLog = m.get(
      `SELECT field, old_value, new_value, reason FROM record_change_log
       WHERE record_table = 'field_estimates' AND record_id = ? AND new_value IS NULL`,
      octoberId
    );
    expect(deleteLog).toMatchObject({ field: "est_dry_weight", old_value: "15", new_value: null, reason: "no longer used" });

    await save({ effective_date: "2026-10-01", est_dry_weight: "16", reason: "again" });
    const revived = await estimateFor(m.db, AFTER, "PNN", "2026-10-12");
    expect(revived).toMatchObject({ est_dry_weight: 16, effective_date: "2026-10-01" });
    expect(revived?.id).not.toBe(octoberId);
    expect(m.all(`SELECT id FROM field_estimates WHERE farm_code = 'PNN' AND effective_date = '2026-10-01' AND deleted_at IS NULL`)).toHaveLength(1);

    const page = await loadFieldEstimatesPage(m.db, "2026-10-12T15:00:00.000Z");
    expect(page.today).toBe("2026-10-12");
    const pnn = page.rows.filter((row) => row.strain_id === AFTER && row.farm_code === "PNN");
    expect(pnn.map((row) => [row.effective_date, row.in_force])).toEqual([
      ["2026-10-01", true],
      ["2026-09-01", false],
    ]);
    expect(pnn[0].strain_name).toBe("After Party");
    const early = await loadFieldEstimatesPage(m.db, "2026-10-12T09:30:00.000Z");
    expect(early.today).toBe("2026-10-11");
    expect(early.rows.find((row) => row.farm_code === "PNN" && row.effective_date === "2026-10-01")?.in_force).toBe(true);

    expect(await estimateFor(m.db, ALIEN, "PNN", "2026-10-12")).toBeNull();
    expect((await estimatesAsOf(m.db, "2026-08-01")).filter((row) => row.strain_id === AFTER)).toEqual([]);
  });

  it("stores a positive dry pound as typed, keeps a blank memo, and refuses a bad date, weight, strain, or farm", async () => {
    expect(FIELD_ESTIMATE_GRAMS_PER_LB).toBe(GRAMS_PER_LB);
    expect(GRAMS_PER_LB).toBe(448);
    const m = await migratedDb();
    const person = seedPerson(m);
    const save = (fields: Record<string, string>) =>
      saveFieldEstimate(
        m.db,
        formOf({ person_id: person, strain_id: AFTER, farm_code: "PNN", effective_date: "2026-10-01", est_dry_weight: "2.5", ...fields })
      );

    await save({ reason: "  kept memo  " });
    const row = m.get(`SELECT est_dry_weight, reason FROM field_estimates WHERE deleted_at IS NULL`) as {
      est_dry_weight: number;
      reason: string;
    };
    expect(row.est_dry_weight).toBe(2.5);
    expect(row.est_dry_weight).not.toBe(2.5 * GRAMS_PER_LB);
    expect(row.reason).toBe("kept memo");

    await saveFieldEstimate(
      m.db,
      formOf({ person_id: person, strain_id: ALIEN, farm_code: "ARL", effective_date: "2026-10-02", est_dry_weight: "3" })
    );
    const blank = m.get(`SELECT reason FROM field_estimates WHERE strain_id = ? AND deleted_at IS NULL`, ALIEN) as { reason: string | null };
    expect(blank.reason).toBeNull();
    const blankLog = m.get(
      `SELECT reason FROM record_change_log WHERE record_table = 'field_estimates' AND field = 'est_dry_weight' AND new_value = '3'`
    ) as { reason: string };
    expect(blankLog.reason).toBe(FIELD_ESTIMATE_LOG_REASON);

    const refused = async (fields: Record<string, string>, message: string) => {
      await expect(save(fields)).rejects.toThrow(message);
      await expect(save(fields)).rejects.toBeInstanceOf(HttpError);
    };
    await refused({ est_dry_weight: "" }, "Dry weight must be a positive number.");
    await refused({ est_dry_weight: "0" }, "Dry weight must be a positive number.");
    await refused({ est_dry_weight: "-1" }, "Dry weight must be a positive number.");
    await refused({ est_dry_weight: "1,000" }, "Dry weight must be a positive number.");
    await refused({ est_dry_weight: "abc" }, "Dry weight must be a positive number.");
    await refused({ effective_date: "" }, "Effective date is required.");
    await refused({ effective_date: "2026-02-31" }, "Effective date must be YYYY-MM-DD.");
    await refused({ strain_id: "missing" }, "Pick a live strain.");
    await refused({ farm_code: "ZZZ" }, "Pick a live farm.");
    m.run(`UPDATE strains SET deleted_at = '2026-10-01T00:00:00.000Z' WHERE id = ?`, ALIEN);
    await expect(
      saveFieldEstimate(m.db, formOf({ person_id: person, strain_id: ALIEN, farm_code: "PNN", effective_date: "2026-10-03", est_dry_weight: "1" }))
    ).rejects.toThrow("Pick a live strain.");
    m.run(`UPDATE farms SET deleted_at = '2026-10-01T00:00:00.000Z' WHERE code = 'ARL'`);
    await expect(
      saveFieldEstimate(m.db, formOf({ person_id: person, strain_id: AFTER, farm_code: "ARL", effective_date: "2026-10-03", est_dry_weight: "1" }))
    ).rejects.toThrow("Pick a live farm.");
    expect(m.all(`SELECT id FROM field_estimates WHERE deleted_at IS NULL`)).toHaveLength(2);

    const err = await save({ est_dry_weight: "0" }).catch((error: unknown) => error);
    expect(err).toBeInstanceOf(HttpError);
    expect(refusalText("es", err as HttpError)).toBe("El peso seco debe ser un numero positivo.");
    expect(refusalText("en", err as HttpError)).toBe("Dry weight must be a positive number.");

    await expect(deleteFieldEstimate(m.db, "missing", formOf({ person_id: person, reason: "gone" }))).rejects.toThrow(
      "That estimate is not on the list."
    );
    const liveId = String((m.get(`SELECT id FROM field_estimates WHERE strain_id = ? AND deleted_at IS NULL`, AFTER) as { id: string }).id);
    await expect(deleteFieldEstimate(m.db, liveId, formOf({ person_id: person }))).rejects.toThrow("Reason is required.");
    expect(m.get(`SELECT deleted_at FROM field_estimates WHERE id = ?`, liveId)).toMatchObject({ deleted_at: null });
  });

  it("defaults the form to the date it is given, translates both languages, and keeps the weight label", () => {
    for (const key of PAGE_KEYS) {
      expect(DICT[key]?.en).toBe(key);
      expect(DICT[key]?.es.length).toBeGreaterThan(0);
    }
    expect(t("en", "dry lb per plant (448 g)")).toBe("dry lb per plant (448 g)");
    expect(t("es", "dry lb per plant (448 g)")).toBe("dry lb per plant (448 g)");
    for (const key of PAGE_KEYS) {
      if (key === "dry lb per plant (448 g)") continue;
      expect(t("es", key)).not.toBe(key);
    }

    const model = pageModel();
    const html = fieldEstimatesPage(model, "en");
    expect(html).toContain(`action="${FIELD_ESTIMATES_PATH}"`);
    expect(html).toContain('name="effective_date" required value="2026-10-12"');
    expect(html).toContain("dry lb per plant (448 g)");
    expect(html).toContain("Hand entered dry pounds per plant at 448 g. The number is stored as typed.");
    expect(html).toContain('data-effective="2026-09-01" data-in-force="1"');
    expect(html).toContain('data-effective="2026-11-01" data-in-force="0"');
    expect(html).toContain(">In force<");
    expect(html).toContain("After Party");
    expect(html).toContain(`action="${FIELD_ESTIMATES_PATH}/older/delete"`);
    const empty = fieldEstimatesPage({ ...model, rows: [] }, "en");
    expect(empty).toContain("No field estimates yet.");
    expect(empty).toContain('value="2026-10-12"');

    const es = fieldEstimatesPage(model, "es");
    expect(es).toContain("Estimaciones de campo");
    expect(es).toContain("dry lb per plant (448 g)");
    expect(es).toContain("En vigor");
    expect(es).toContain("El numero se guarda tal cual.");
    expect(es).toContain("Libras secas, escritas a mano. Una libra es 448 g.");
    expect(es).not.toContain("Dry pounds, hand entered.");
    expect(es).not.toContain(">Field estimates<");
    expect(adminGroupPage("settings", "en")).toContain('href="/admin/field_estimates"');
    expect(adminGroupPage("settings", "es")).toContain("Estimaciones de campo");
    expect(backLinkFor("/admin/field_estimates")).toEqual({ href: "/admin/settings", label: "Admin Settings" });
    const settings = adminGroupPage("settings", "en");
    const hrefs = [...settings.matchAll(/href="([^"]+)"/g)].map((hit) => hit[1]);
    expect(hrefs[0]).toBe("/admin/lookups");
    expect(hrefs[1]).toBe("/admin/field_estimates");
  });

  it("gates the page, defaults the date to the farm's today, and does not add a report", async () => {
    expect(REPORT_KEYS).toHaveLength(16);
    expect(isReportKey("field_estimates")).toBe(false);
    expect(REPORT_KEYS).not.toContain("field_estimates");

    const m = await migratedDb();
    const env = {
      DB: m.db,
      THEME: "grip",
      GF_ALLOW_FIXTURE_NOW: "1",
      ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) },
    } as unknown as Env;
    const locked = await app.request("/admin/field_estimates", {}, env);
    expect(locked.status).toBe(401);
    expect(await locked.text()).toContain("Enter PIN");
    const refused = await app.request(
      "/admin/field_estimates",
      {
        method: "POST",
        body: new URLSearchParams({
          strain_id: AFTER,
          farm_code: "PNN",
          effective_date: "2026-10-12",
          est_dry_weight: "1",
        }),
      },
      env
    );
    expect(refused.status).toBe(401);
    expect(m.all(`SELECT id FROM field_estimates`)).toHaveLength(0);

    const open = await app.request(
      "/admin/field_estimates",
      { headers: { cookie: "gf_pin=21319", "x-gf-now": "2026-10-12T15:00:00.000Z" } },
      env
    );
    expect(open.status).toBe(200);
    const body = await open.text();
    expect(body).toContain('name="effective_date" required value="2026-10-12"');
    expect(body).toContain("dry lb per plant (448 g)");
    expect(body).toContain("Field estimates");

    const early = await app.request(
      "/admin/field_estimates",
      { headers: { cookie: "gf_pin=21319", "x-gf-now": "2026-10-12T09:30:00.000Z" } },
      env
    );
    expect(early.status).toBe(200);
    expect(await early.text()).toContain('name="effective_date" required value="2026-10-11"');

    const spanish = await app.request(
      "/admin/field_estimates",
      { headers: { cookie: "gf_pin=21319; gf_locale=es", "x-gf-now": "2026-10-12T15:00:00.000Z" } },
      env
    );
    const spanishBody = await spanish.text();
    expect(spanish.status).toBe(200);
    expect(spanishBody).toContain("Estimaciones de campo");
    expect(spanishBody).toContain("dry lb per plant (448 g)");

    const bad = await app.request(
      "/admin/field_estimates",
      {
        method: "POST",
        headers: { cookie: "gf_pin=21319" },
        body: new URLSearchParams({
          strain_id: AFTER,
          farm_code: "PNN",
          effective_date: "2026-10-12",
          est_dry_weight: "0",
        }),
      },
      env
    );
    expect(bad.status).toBe(400);
    expect(await bad.text()).toContain("Dry weight must be a positive number.");
    expect(m.all(`SELECT id FROM field_estimates`)).toHaveLength(0);
  });

  it("searches the live index for the resolution read", async () => {
    const m = await migratedDb();
    const indexes = m.all(
      `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'field_estimates' AND name IN (?, ?) ORDER BY name`,
      FIELD_ESTIMATES_LIVE_INDEX,
      FIELD_ESTIMATES_LOOKUP_INDEX
    );
    expect(indexes.map((row) => row.name)).toEqual([FIELD_ESTIMATES_LIVE_INDEX, FIELD_ESTIMATES_LOOKUP_INDEX]);
    const live = String(indexes[0].sql);
    expect(live).toContain("UNIQUE");
    expect(live).toContain("strain_id");
    expect(live).toContain("farm_code");
    expect(live).toContain("effective_date");
    expect(live).toContain("deleted_at IS NULL");
    expect(String(indexes[1].sql)).toContain("strain_id, farm_code, effective_date");
    expect(String(indexes[1].sql)).not.toContain("UNIQUE");

    const plan = m.all(`EXPLAIN QUERY PLAN ${ESTIMATE_FOR_SQL}`, AFTER, "PNN", "2026-10-12");
    const detail = plan.map((row) => String(row.detail)).join("\n");
    expect(detail).toContain("SEARCH");
    expect(detail).toMatch(/field_estimates_live|field_estimates_lookup/);
    expect(detail).not.toContain("SCAN");

    const asOf = m.all(`EXPLAIN QUERY PLAN ${ESTIMATES_AS_OF_SQL}`, "2026-10-12", "2026-10-12");
    const asOfDetail = asOf.map((row) => String(row.detail)).join("\n");
    expect(asOfDetail).toContain("SEARCH");
    expect(asOfDetail).toMatch(/field_estimates_live|field_estimates_lookup/);
  });
});
