import { describe, expect, it } from "vitest";
import { app } from "../src/index";
import {
  POTLUCK_ADMIN_PATH,
  POTLUCK_CATEGORIES,
  POTLUCK_PATH,
  checkPotluckDraft,
  isPublicSpecialRoute,
  isSpecialPath,
  normalizePotluckEmail,
  potluckCloseWords,
  potluckCsv,
  potluckDateWords,
} from "../src/potluck";
import { migratedDb, type MigratedDb } from "./migrated";

const OPEN = "2026-11-01T15:00:00.000Z";
const CLOSED = "2026-11-17T22:00:00.000Z";

function envOf(m: MigratedDb, fronted = false): Env {
  return {
    DB: m.db,
    THEME: "grip",
    GF_ALLOW_FIXTURE_NOW: "1",
    ...(fronted ? { ACCESS_FRONTED: "1" } : {}),
    ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) },
  } as unknown as Env;
}

function post(env: Env, fields: Record<string, string>, opts: { now?: string; cookie?: string; path?: string } = {}) {
  return app.request(
    opts.path ?? POTLUCK_PATH,
    {
      method: "POST",
      body: new URLSearchParams(fields),
      headers: { "x-gf-now": opts.now ?? OPEN, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    },
    env
  );
}

const ANSWER = { attending: "yes", category: "hot_side", dish: "Green bean casserole", email: "  Pat@Example.COM " };

describe("WG1, the Worksgiving poll", () => {
  it("0125 lays the two tables, the seed, one live answer per email and the pairs the page promises", async () => {
    const m = await migratedDb();
    const ev = m.get(`SELECT * FROM potluck_events WHERE key = 'worksgiving26'`);
    expect(ev).toMatchObject({ name: "Worksgiving Potluck", event_date: "2026-11-20", where_text: "", contact_text: "", closes_at: CLOSED });
    const ins = (id: string, email: string, attending: string, category: string | null, dish: string | null, deleted: string | null = null) =>
      m.run(
        `INSERT INTO potluck_responses (id, event_key, email, attending, category, dish, created_at, updated_at, deleted_at)
         VALUES (?, 'worksgiving26', ?, ?, ?, ?, ?, ?, ?)`,
        id, email, attending, category, dish, OPEN, OPEN, deleted
      );
    ins("a", "a@x.com", "yes", "main", "chili");
    expect(() => ins("b", "a@x.com", "maybe", null, null)).toThrow(/UNIQUE/);
    m.run(`UPDATE potluck_responses SET deleted_at = ? WHERE id = 'a'`, OPEN);
    ins("c", "a@x.com", "maybe", null, null);
    expect(() => ins("d", "B@x.com", "yes", null, null)).toThrow(/CHECK/);
    expect(() => ins("e", "e@x.com", "no", "main", "x y")).toThrow(/CHECK/);
    expect(() => ins("f", "f@x.com", "yes", "main", null)).toThrow(/CHECK/);
    expect(() => ins("g", "g@x.com", "yes", "supplies", "napkins")).toThrow(/CHECK/);
    expect(() => ins("h", "h@x.com", "sure", null, null)).toThrow(/CHECK/);
    ins("j", "j@x.com", "yes_plus_one", "bread", "rolls");
    expect(() => ins("l", "l@x.com", "yes+1", null, null)).toThrow(/CHECK/);
    expect(() => ins("i", "i@x.com", "yes", "dessert", "p")).toThrow(/CHECK/);
    for (const cat of POTLUCK_CATEGORIES) ins(`k-${cat.key}`, `${cat.key}@x.com`, "yes", cat.key, "a dish");
    expect(POTLUCK_CATEGORIES.map((c) => c.key)).toEqual(["main", "hot_side", "cold_side", "bread", "dessert", "drinks"]);
  });

  it("checks a draft: a No drops what was picked, the dish pairs its category, the email is lower case and trimmed", () => {
    expect(checkPotluckDraft(ANSWER)).toEqual({ ok: true, value: { attending: "yes", category: "hot_side", dish: "Green bean casserole", email: "pat@example.com" } });
    expect(checkPotluckDraft({ ...ANSWER, attending: "no" })).toEqual({ ok: true, value: { attending: "no", category: null, dish: null, email: "pat@example.com" } });
    expect(checkPotluckDraft({ ...ANSWER, attending: "yes_plus_one" })).toMatchObject({ ok: true, value: { attending: "yes_plus_one", category: "hot_side" } });
    expect(checkPotluckDraft({ ...ANSWER, attending: "yes+1" })).toMatchObject({ ok: false, field: "attending", message: "Pick Yes, Yes +1, No or Maybe." });
    expect(checkPotluckDraft({ ...ANSWER, category: "nothing", dish: "ignored" })).toEqual({ ok: true, value: { attending: "yes", category: null, dish: null, email: "pat@example.com" } });
    expect(checkPotluckDraft({ ...ANSWER, attending: "" })).toMatchObject({ ok: false, field: "attending" });
    expect(checkPotluckDraft({ ...ANSWER, category: "" })).toMatchObject({ ok: false, field: "category" });
    expect(checkPotluckDraft({ ...ANSWER, category: "supplies" })).toMatchObject({ ok: false, field: "category", message: "Pick one of the listed categories." });
    expect(checkPotluckDraft({ ...ANSWER, dish: "  " })).toMatchObject({ ok: false, field: "dish", message: "Name the dish." });
    expect(checkPotluckDraft({ ...ANSWER, dish: "x" })).toMatchObject({ ok: false, field: "dish" });
    expect(checkPotluckDraft({ ...ANSWER, dish: "y".repeat(81) })).toMatchObject({ ok: false, field: "dish" });
    expect(checkPotluckDraft({ ...ANSWER, email: "not an email" })).toMatchObject({ ok: false, field: "email" });
    expect(normalizePotluckEmail("  First.Last+tag@Grip.com ")).toBe("first.last+tag@grip.com");
  });

  it("only the poll's page answers under /special, without a login; the results stay behind Access", async () => {
    expect(isSpecialPath("/special")).toBe(true);
    expect(isSpecialPath("/specials")).toBe(false);
    expect(isPublicSpecialRoute("POST", POTLUCK_PATH)).toBe(true);
    expect(isPublicSpecialRoute("DELETE", POTLUCK_PATH)).toBe(false);
    const m = await migratedDb();
    const env = envOf(m, true);
    const people = m.all(`SELECT id FROM people`).length;
    const page = await app.request(POTLUCK_PATH, { headers: { "x-gf-now": OPEN } }, env);
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(page.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const body = await page.text();
    expect(body).toContain("<h1>Worksgiving Potluck</h1>");
    expect(body).toContain("Friday, November 20, 2026, after your shift");
    expect(body).toContain("Are you coming?");
    expect([...body.matchAll(/name="attending" value="([a-z_]+)"/g)].map((hit) => hit[1])).toEqual(["yes", "yes_plus_one", "no", "maybe"]);
    expect(body).toContain("<span>Yes +1</span>");
    expect(body).toContain('data-wg-count="hot_side">(none yet)');
    expect(body).toContain("Nothing this time, just eating");
    expect(body).not.toMatch(/utensils|napkins/i);
    expect(body).not.toContain('href="/admin');
    expect(body).not.toContain("Harvest Console");
    expect(body).not.toMatch(/[\u2013\u2014]/);
    for (const path of ["/special", "/special/", "/special/worksgiving25", `${POTLUCK_PATH}/results`]) {
      const res = await app.request(path, {}, env);
      expect(res.status, path).toBe(404);
      expect(await res.text()).toBe("Not found");
    }
    const slash = await app.request(`${POTLUCK_PATH}/`, {}, env);
    expect(slash.status).toBe(301);
    expect(slash.headers.get("location")).toBe(POTLUCK_PATH);
    const results = await app.request(POTLUCK_ADMIN_PATH, {}, env);
    expect(results.status).toBe(403);
    expect(m.all(`SELECT id FROM people`)).toHaveLength(people);
  });

  it("form, review, back, submit; one answer per email; a No brings nothing; the counts follow", async () => {
    const m = await migratedDb();
    const env = envOf(m, true);
    const review = await post(env, { action: "review", ...ANSWER });
    expect(review.status).toBe(200);
    const reviewBody = await review.text();
    expect(reviewBody).toContain("Check it before you send.");
    expect(reviewBody).toContain("Green bean casserole (Hot side)");
    expect(reviewBody).toContain("pat@example.com");
    expect(reviewBody).toContain("One submission per email. Once you submit you can't change it from this page. Contact the Ops office to fix anything.");
    expect(reviewBody).toContain('<input type="hidden" name="action" value="submit">');
    expect(m.all(`SELECT id FROM potluck_responses`)).toHaveLength(0);

    const back = await post(env, { action: "back", attending: "yes", category: "hot_side", dish: "Green bean casserole", email: "pat@example.com" });
    const backBody = await back.text();
    expect(back.status).toBe(200);
    expect(backBody).toContain('value="yes" checked');
    expect(backBody).toContain('value="hot_side" checked');
    expect(backBody).toContain('value="Green bean casserole"');
    expect(backBody).toContain('value="pat@example.com"');

    const done = await post(env, { action: "submit", attending: "yes", category: "hot_side", dish: "Green bean casserole", email: "pat@example.com" });
    expect(done.status).toBe(201);
    expect(await done.text()).toContain("You're on the list.");
    expect(m.all(`SELECT email, attending, category, dish, created_by FROM potluck_responses`)).toEqual([
      { email: "pat@example.com", attending: "yes", category: "hot_side", dish: "Green bean casserole", created_by: "potluck_form" },
    ]);

    const again = await post(env, { action: "review", attending: "maybe", category: "dessert", dish: "pie", email: " PAT@example.com" });
    expect(again.status).toBe(409);
    expect(await again.text()).toContain("This email already submitted. Need a change? Contact the Ops office.");
    const twice = await post(env, { action: "submit", attending: "maybe", category: "dessert", dish: "pie", email: "pat@example.com" });
    expect(twice.status).toBe(409);
    expect(m.all(`SELECT id FROM potluck_responses`)).toHaveLength(1);

    const no = await post(env, { action: "submit", attending: "no", category: "main", dish: "chili", email: "c@x.com" });
    expect(no.status).toBe(201);
    expect(m.get(`SELECT category, dish FROM potluck_responses WHERE email = 'c@x.com'`)).toEqual({ category: null, dish: null });

    const noDish = await post(env, { action: "review", attending: "yes", category: "main", dish: "", email: "e@x.com" });
    expect(noDish.status).toBe(400);
    expect(await noDish.text()).toContain('data-wg-error="dish">Name the dish.');
    const unknown = await post(env, { action: "submit", attending: "yes", category: "laser", dish: "beam", email: "f@x.com" });
    expect(unknown.status).toBe(400);
    const badEmail = await post(env, { action: "submit", attending: "yes", category: "nothing", dish: "", email: "nobody" });
    expect(badEmail.status).toBe(400);
    expect(await badEmail.text()).toContain('data-wg-error="email">Enter a valid email address.');

    const trap = await post(env, { action: "submit", ...ANSWER, email: "bot@x.com", website: "http://spam" });
    expect(trap.status).toBe(200);
    expect(await trap.text()).toContain("You're on the list.");
    expect(m.all(`SELECT id FROM potluck_responses`)).toHaveLength(2);

    const page = await (await app.request(POTLUCK_PATH, { headers: { "x-gf-now": OPEN } }, env)).text();
    expect(page).toContain('data-wg-count="hot_side">(1 so far)');
    expect(page).toContain('data-wg-count="main">(none yet)');
  });

  it("closes at its time: the page says so and a late answer is refused", async () => {
    const m = await migratedDb();
    const env = envOf(m, true);
    const open = await (await app.request(POTLUCK_PATH, { headers: { "x-gf-now": "2026-11-17T21:59:00.000Z" } }, env)).text();
    expect(open).toContain("Sign-ups close Tuesday, November 17 at 5:00 PM.");
    const shut = await app.request(POTLUCK_PATH, { headers: { "x-gf-now": CLOSED } }, env);
    const shutBody = await shut.text();
    expect(shut.status).toBe(200);
    expect(shutBody).toContain('data-wg-screen="closed"');
    expect(shutBody).toContain("Sign-ups closed Tuesday, November 17 at 5:00 PM.");
    expect(shutBody).not.toContain("<form");
    const late = await post(env, { action: "submit", ...ANSWER }, { now: CLOSED });
    expect(late.status).toBe(410);
    expect(m.all(`SELECT id FROM potluck_responses`)).toHaveLength(0);
  });

  it("speaks Spanish on the cookie or ?lang=es, and the switch sets the cookie", async () => {
    const m = await migratedDb();
    const env = envOf(m, true);
    const es = await app.request(`${POTLUCK_PATH}?lang=es`, { headers: { "x-gf-now": OPEN } }, env);
    expect(es.headers.get("set-cookie")).toContain("gf_locale=es");
    const body = await es.text();
    expect(body).toContain('<html lang="es">');
    expect(body).toContain("¿Vienes?");
    expect(body).toContain("¿Qué vas a traer?");
    expect(body).toContain("Guarnición caliente");
    expect(body).toContain("viernes, 20 de noviembre de 2026");
    const review = await post(env, { action: "review", ...ANSWER }, { cookie: "gf_locale=es" });
    const reviewBody = await review.text();
    expect(reviewBody).toContain("Revísalo antes de enviar.");
    expect(reviewBody).toContain("Para corregir algo, contacta a la oficina de Operaciones.");
    expect(potluckDateWords("2026-11-20", "en")).toBe("Friday, November 20, 2026");
    expect(potluckCloseWords(CLOSED, "en")).toBe("Tuesday, November 17 at 5:00 PM");
  });

  it("the results behind the Admin PIN: tallies, the board, the CSV, the event's words and Remove, each logged", async () => {
    const m = await migratedDb();
    const env = envOf(m);
    await post(env, { action: "submit", ...ANSWER });
    await post(env, { action: "submit", attending: "maybe", category: "nothing", dish: "", email: "b@x.com" });
    await post(env, { action: "submit", attending: "no", category: "", dish: "", email: "c@x.com" });
    const plusOne = await post(env, { action: "submit", attending: "yes_plus_one", category: "bread", dish: "Dinner rolls", email: "d@x.com" });
    expect(plusOne.status).toBe(201);
    expect(await plusOne.text()).toContain("<dd>Yes +1</dd>");
    const locked = await app.request(POTLUCK_ADMIN_PATH, {}, env);
    expect(locked.status).toBe(401);
    const pin = { cookie: "gf_pin=21319", "x-gf-now": OPEN };
    const page = await (await app.request(POTLUCK_ADMIN_PATH, { headers: pin }, env)).text();
    expect(page).toContain('data-wg-tally="people"><b>3</b>');
    expect(page).toContain('data-wg-tally="yes"><b>1</b>');
    expect(page).toContain('data-wg-tally="yes_plus_one"><b>1</b>');
    expect(page).toContain('data-wg-tally="maybe"><b>1</b>');
    expect(page).toContain('data-wg-tally="no"><b>1</b>');
    expect(page).toContain('data-wg-tally="total"><b>4</b>');
    expect(page).toContain(`http://localhost${POTLUCK_PATH}`);
    expect(page).toContain("Green bean casserole <span class=\"muted\">(pat@example.com)</span>");
    expect(page).toContain('data-wg-cat="nothing"><th scope="row">Just eating</th><td class="num">1</td>');

    const csv = await app.request(`${POTLUCK_ADMIN_PATH}.csv`, { headers: pin }, env);
    expect(csv.headers.get("content-disposition")).toContain("worksgiving26.csv");
    const lines = (await csv.text()).trim().split("\r\n");
    expect(lines[0]).toBe("email,attending,category,dish,submitted_at");
    expect(lines).toHaveLength(5);
    // 2026-11-01 15:00Z is 10:00 farm time: daylight saving ended at 2:00 that morning.
    expect(lines.slice(1)).toEqual([
      "b@x.com,maybe,,,2026-11-01 10:00",
      "c@x.com,no,,,2026-11-01 10:00",
      "d@x.com,yes +1,Bread / rolls,Dinner rolls,2026-11-01 10:00",
      "pat@example.com,yes,Hot side,Green bean casserole,2026-11-01 10:00",
    ]);

    const saved = await app.request(
      `${POTLUCK_ADMIN_PATH}/event`,
      {
        method: "POST",
        headers: pin,
        body: new URLSearchParams({ event_date: "2026-11-20", when_note: "4:00 PM, after your shift", where_text: "The house on the hill", contact_text: "", close_date: "2026-11-18", close_time: "17:00" }),
      },
      env
    );
    expect(saved.status).toBe(303);
    expect(m.get(`SELECT when_note, where_text, closes_at FROM potluck_events`)).toEqual({ when_note: "4:00 PM, after your shift", where_text: "The house on the hill", closes_at: "2026-11-18T22:00:00.000Z" });
    expect(m.all(`SELECT field FROM record_change_log WHERE record_table = 'potluck_events' ORDER BY field`).map((r) => r.field)).toEqual(["closes_at", "when_note", "where_text"]);
    const shown = await (await app.request(POTLUCK_PATH, { headers: { "x-gf-now": OPEN } }, env)).text();
    expect(shown).toContain("Friday, November 20, 2026, 4:00 PM, after your shift");
    expect(shown).toContain('<p class="wg-where">The house on the hill</p>');

    const id = String(m.get(`SELECT id FROM potluck_responses WHERE email = 'pat@example.com'`)?.id);
    const removed = await app.request(`${POTLUCK_ADMIN_PATH}/remove`, { method: "POST", headers: pin, body: new URLSearchParams({ id }) }, env);
    expect(removed.status).toBe(303);
    expect(m.get(`SELECT deleted_at FROM potluck_responses WHERE id = ?`, id)?.deleted_at).toBe(OPEN);
    expect(m.all(`SELECT id FROM record_change_log WHERE record_table = 'potluck_responses' AND record_id = ?`, id)).toHaveLength(1);
    const back = await post(env, { action: "submit", attending: "yes", category: "dessert", dish: "Pumpkin pie", email: "pat@example.com" });
    expect(back.status).toBe(201);
    expect(m.all(`SELECT id FROM potluck_responses WHERE email = 'pat@example.com' AND deleted_at IS NULL`)).toHaveLength(1);
    const gone = await app.request(`${POTLUCK_ADMIN_PATH}/remove`, { method: "POST", headers: pin, body: new URLSearchParams({ id }) }, env);
    expect(gone.status).toBe(404);
    expect(potluckCsv([])).toBe("email,attending,category,dish,submitted_at\r\n");
  });
});
