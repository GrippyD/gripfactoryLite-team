/* Load the business data that lives outside git into Postgres (schema gripcasting):
     src/const.json                 -> harvest 2026H, business units, GLs, budget, wages budget, seasonal pattern, default drivers
     data/db/model/drivers.json     -> revenue drivers
     data/db/actuals/current.json   -> the current close's actuals
     data/db/builds/*.json          -> BU forecast builds
   and the people who can sign in:
     npm run db:import -- --admin you@gripcannabis.com="Your Name" --director someone@gripcannabis.com="Name"

   Local by default (LOCAL_DATABASE_URL in .dev.vars). The live load is IT's: DATABASE_URL=... with --allow-remote.
   Re-running replaces the reference data, drivers, that close's actuals and the builds; users are upserted.
   The claude.ai export names people by claude.ai ids, not emails, so imported "last edited by" / "submitted by" are left blank. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import postgres from "postgres";
import type { Actuals, BuildDoc, Vol } from "../src/shared/types";
import { targetDatabase } from "./devvars";

const r2 = (x: number) => Math.round(x * 100) / 100;
const readJson = <T>(p: string): T | null => existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) as T : null;
const lastDay = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

interface Const { BUS: string[]; GLS: string[]; BUDGET: Record<string, Record<string, number>>; WAGES_BUDGET?: number; SEASON?: Record<string, number[]>; VOL_DEFAULT: Vol }
const C = readJson<Const>("src/const.json");
if (!C || !C.BUDGET || !Object.keys(C.BUDGET).length) { console.error("src/const.json with budget figures is required (get it from finance)."); process.exit(1); }

const people: { email: string; name: string; role: "admin" | "director" }[] = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i], role = a === "--admin" ? "admin" : a === "--director" ? "director" : null; if (!role) continue;
  const v = process.argv[++i] || "", [email, ...nm] = v.split("=");
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) { console.error(`Not an email: ${email}`); process.exit(1); }
  people.push({ email: email.toLowerCase(), name: nm.join("=").replace(/^"|"$/g, "") || email, role });
}

const url = targetDatabase();
const sql = postgres(url, { max: 1, onnotice: () => {} });
const by = "import";
try {
  await sql.begin(async t => {
    const [h] = await t<{ id: string }[]>`
      INSERT INTO gripcasting.harvests (code, starts_on, is_current, wages_budget, season, vol_default, created_by)
      VALUES ('2026H', '2026-04-01', true, ${C.WAGES_BUDGET ?? null}, ${t.json(C.SEASON || {})}, ${t.json(C.VOL_DEFAULT as never)}, ${by})
      ON CONFLICT (code) DO UPDATE SET is_current = true, wages_budget = EXCLUDED.wages_budget, season = EXCLUDED.season, vol_default = EXCLUDED.vol_default, updated_at = now()
      RETURNING id`;
    await t`UPDATE gripcasting.harvests SET is_current = false WHERE id <> ${h.id} AND is_current`;

    await t`DELETE FROM gripcasting.business_units WHERE harvest_id = ${h.id}`;
    await t`INSERT INTO gripcasting.business_units ${t(C.BUS.map((name, i) => ({ harvest_id: h.id, code: name.slice(0, 2), name, sort: i, created_by: by })))}`;
    await t`DELETE FROM gripcasting.gl_accounts WHERE harvest_id = ${h.id}`;
    await t`INSERT INTO gripcasting.gl_accounts ${t([...new Set(C.GLS)].map(name => ({ harvest_id: h.id, name, created_by: by })))}`;
    await t`DELETE FROM gripcasting.budget_lines WHERE harvest_id = ${h.id}`;
    const budget = Object.entries(C.BUDGET).flatMap(([gl, row]) => Object.entries(row).map(([bu, amount]) => ({ harvest_id: h.id, gl, bu, amount: r2(amount), created_by: by })));
    await t`INSERT INTO gripcasting.budget_lines ${t(budget)}`;
    console.log(`Reference: ${C.BUS.length} BUs, ${C.GLS.length} GLs, ${budget.length} budget cells (total ${r2(budget.reduce((s, b) => s + b.amount, 0)).toLocaleString("en-US")}).`);

    const d = readJson<{ data: { vol: Vol; gl?: object }; updatedAt?: string }>("data/db/model/drivers.json");
    if (d) {
      await t`
        INSERT INTO gripcasting.drivers (harvest_id, vol, gl, updated_at, created_by) VALUES (${h.id}, ${t.json(d.data.vol as never)}, ${t.json((d.data.gl || {}) as never)}, ${d.updatedAt || null}, ${by})
        ON CONFLICT (harvest_id) DO UPDATE SET vol = EXCLUDED.vol, gl = EXCLUDED.gl, updated_at = now()`;
      console.log("Drivers: loaded.");
    }

    const a = readJson<Actuals>("data/db/actuals/current.json");
    if (a) {
      await t`DELETE FROM gripcasting.actual_closes WHERE harvest_id = ${h.id} AND close_date = ${a.closeDate}`;
      await t`UPDATE gripcasting.actual_closes SET is_current = false WHERE harvest_id = ${h.id}`;
      const [c] = await t<{ id: string }[]>`
        INSERT INTO gripcasting.actual_closes (harvest_id, close_date, file_name, uploaded_at, is_current, created_by)
        VALUES (${h.id}, ${a.closeDate}, ${a.fileName}, ${a.uploadedAt}, true, ${by}) RETURNING id`;
      await t`INSERT INTO gripcasting.actual_lines ${t(a.rows.map(([entity, bu, gl, amount]) => ({ close_id: c.id, entity, bu, gl, amount: r2(amount), created_by: by })))}`;
      const m = Object.entries(a.monthly || {}).flatMap(([gl, mm]) => Object.entries(mm).map(([k, amount]) => ({ close_id: c.id, gl, month: k + "-01", amount: r2(amount), created_by: by })));
      if (m.length) await t`INSERT INTO gripcasting.actual_monthly ${t(m)}`;
      const total = r2(a.rows.reduce((s, r) => s + (+r[2].slice(0, 4) < 5000 ? 0 : r[3]), 0));
      await t`DELETE FROM gripcasting.upload_log WHERE harvest_id = ${h.id} AND close_date = ${a.closeDate} AND created_by = ${by}`;   // re-runs don't pile up history
      await t`INSERT INTO gripcasting.upload_log (harvest_id, close_date, file_name, total, transactions, created_at, created_by) VALUES (${h.id}, ${a.closeDate}, ${a.fileName}, ${total}, 0, ${a.uploadedAt}, ${by})`;
      console.log(`Actuals: ${a.closeDate}, ${a.rows.length} lines (no transactions in the export: upload the BU Summary to add them).`);
    }

    const dir = "data/db/builds";
    if (existsSync(dir)) for (const f of readdirSync(dir).filter(x => x.endsWith(".json"))) {
      const b = readJson<BuildDoc>(`${dir}/${f}`)!, code = b.bu.slice(0, 2);
      await t`DELETE FROM gripcasting.builds WHERE harvest_id = ${h.id} AND bu_code = ${code}`;
      const [row] = await t<{ id: string }[]>`
        INSERT INTO gripcasting.builds (harvest_id, bu_code, submitted_at, created_by, updated_at) VALUES (${h.id}, ${code}, ${b.submittedAt || null}, ${by}, now()) RETURNING id`;
      for (const [gl, ln] of Object.entries(b.lines || {})) {
        const [l] = await t<{ id: string }[]>`
          INSERT INTO gripcasting.build_lines (build_id, gl, status, reason, is_custom, edited_at, created_by)
          VALUES (${row.id}, ${gl}, ${ln.status || "notstarted"}, ${ln.reason || ""}, ${!!ln.custom}, ${ln.updatedAt || null}, ${by}) RETURNING id`;
        const items = (ln.items || []).map((it, i) => ({
          line_id: l.id, client_id: it.id, sort: i, description: it.desc || "", po: it.po || "", driver: it.drv || null,
          share: it.share ?? null, per_hour: it.per ?? null, qty: it.qty ?? null, unit: it.unit || "", unit_cost: it.cost ?? null,
          start_on: it.start || (it.month ? it.month + "-01" : null), end_on: it.end || (it.month ? lastDay(it.month) : null), created_by: by,
        }));
        if (items.length) await t`INSERT INTO gripcasting.build_items ${t(items)}`;
      }
      console.log(`Build ${b.bu}: ${Object.keys(b.lines || {}).length} lines.`);
    }

    for (const p of people) await t`
      INSERT INTO gripcasting.app_users (email, name, role, created_by) VALUES (${p.email}, ${p.name}, ${p.role}, ${by})
      ON CONFLICT ((lower(email))) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = true, updated_at = now()`;
    if (people.length) console.log(`Users: ${people.map(p => `${p.email} (${p.role})`).join(", ")}.`);
  });
  console.log(`Done: ${new URL(url).hostname}.`);
} catch (e) {
  console.error(`Import failed, nothing changed: ${(e as Error).message}`); process.exitCode = 1;
} finally { await sql.end(); }
