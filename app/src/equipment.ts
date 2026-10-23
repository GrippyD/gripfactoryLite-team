/**
 * The Continuum 10 Vendors and Equipment remake plus the Preventive
 * Maintenance system (owner rulings 2026-09-07, canon 0.29.0).
 *
 * Both surfaces render STANDALONE in the C10 look: Christine Selden's paper
 * tokens (vendored source of truth at prompts/2026-08-17_continuum_styles.css;
 * the co sheet in theme.ts carries the dark variant), Palatino display, warm
 * paper ground with the diagonal pinstripe, amber and copper primary, hairline
 * borders, 14px radius cards, pill buttons. English-first by design: these
 * pages live outside the app shell (no locale session), noted in the session
 * report.
 *
 * The PM law (owner): keep it light to the level of hilarity; completions are
 * HAND SIGNED (a typed name, never a dropdown); schedules recur by interval;
 * the seeded history is openly fake and person-free (G-9).
 */

import { HttpError, nowIso, requireText, textOrNull } from "./audit";
import { insertLog, listLookupValues, requireActor, type LookupOption } from "./db";
import type { ActionOk } from "./actions";

/* ------------------------------------------------------------------ types */

export type EquipmentAssetRow = {
  id: string;
  serial: string;
  name: string;
  farm_code: string;
  notes: string | null;
  open_tickets: number;
  sale_status?: string | null;
  sale_condition?: string | null;
  asking_price_usd?: number | null;
  sale_note?: string | null;
};

export const ASSET_FOR_SALE_REASON = "asset for sale";
export const ASSETS_FOR_SALE_SQL = `SELECT COUNT(*) AS n FROM equipment_assets
     WHERE deleted_at IS NULL AND sale_status IN ('listed', 'under_offer')`;

export type EquipmentScheduleRow = {
  id: string;
  asset_id: string;
  task: string;
  interval_days: number;
  last_done: string | null;
};

export type EquipmentLogRow = {
  id: string;
  task: string;
  done_on: string;
  signed_by: string;
  notes: string | null;
};

export type EquipmentTicketRow = {
  id: string;
  title: string;
  status: string;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
};

/* ------------------------------------------------------- pure helpers */

/** Next due = last_done + interval_days, computed here (Postgres-portable SQL
 * law: no dialect date math in queries). NULL last_done means due now. */
export function nextDueFrom(lastDone: string | null, intervalDays: number): string {
  if (!lastDone) return "now";
  const d = new Date(`${lastDone}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + intervalDays);
  return d.toISOString().slice(0, 10);
}

export function isOverdue(nextDue: string, todayIso: string): boolean {
  return nextDue === "now" || nextDue < todayIso;
}

/** The receive line's dry humor, earned only by the truly late. */
export function dueLabel(nextDue: string, todayIso: string): string {
  if (isOverdue(nextDue, todayIso)) return "OVERDUE. It remembers.";
  return nextDue;
}

/* --------------------------------------------------------------- queries */

export async function listEquipmentAssets(db: D1Database): Promise<EquipmentAssetRow[]> {
  const result = await db
    .prepare(
      `SELECT a.id, a.serial, a.name, a.farm_code, a.notes, a.sale_status, a.sale_condition, a.asking_price_usd, a.sale_note,
              (SELECT COUNT(*) FROM equipment_tickets tk
                WHERE tk.asset_id = a.id AND tk.deleted_at IS NULL AND tk.status = 'open') AS open_tickets
       FROM equipment_assets a
       WHERE a.deleted_at IS NULL
       ORDER BY a.serial`
    )
    .all<EquipmentAssetRow>();
  return result.results ?? [];
}

export async function listAllSchedules(db: D1Database): Promise<EquipmentScheduleRow[]> {
  const result = await db
    .prepare(
      `SELECT id, asset_id, task, interval_days, last_done
       FROM equipment_pm_schedules WHERE deleted_at IS NULL ORDER BY task`
    )
    .all<EquipmentScheduleRow>();
  return result.results ?? [];
}

export async function getEquipmentAsset(db: D1Database, id: string): Promise<EquipmentAssetRow | null> {
  return db
    .prepare(
      `SELECT a.id, a.serial, a.name, a.farm_code, a.notes, a.sale_status, a.sale_condition, a.asking_price_usd, a.sale_note,
              (SELECT COUNT(*) FROM equipment_tickets tk
                WHERE tk.asset_id = a.id AND tk.deleted_at IS NULL AND tk.status = 'open') AS open_tickets
       FROM equipment_assets a
       WHERE a.id = ? AND a.deleted_at IS NULL`
    )
    .bind(id)
    .first<EquipmentAssetRow>();
}

export async function listAssetSchedules(db: D1Database, assetId: string): Promise<EquipmentScheduleRow[]> {
  const result = await db
    .prepare(
      `SELECT id, asset_id, task, interval_days, last_done
       FROM equipment_pm_schedules WHERE asset_id = ? AND deleted_at IS NULL ORDER BY task`
    )
    .bind(assetId)
    .all<EquipmentScheduleRow>();
  return result.results ?? [];
}

export async function listAssetLogs(db: D1Database, assetId: string): Promise<EquipmentLogRow[]> {
  const result = await db
    .prepare(
      `SELECT id, task, done_on, signed_by, notes
       FROM equipment_pm_logs WHERE asset_id = ? AND deleted_at IS NULL
       ORDER BY done_on DESC, created_at DESC LIMIT 60`
    )
    .bind(assetId)
    .all<EquipmentLogRow>();
  return result.results ?? [];
}

export async function listAssetTickets(db: D1Database, assetId: string): Promise<EquipmentTicketRow[]> {
  const result = await db
    .prepare(
      `SELECT id, title, status, closed_by, closed_at, created_at
       FROM equipment_tickets WHERE asset_id = ? AND deleted_at IS NULL
       ORDER BY status DESC, created_at DESC`
    )
    .bind(assetId)
    .all<EquipmentTicketRow>();
  return result.results ?? [];
}

export type OpenTicketRow = {
  id: string;
  asset_id: string;
  asset_name: string;
  title: string;
  created_at: string;
};

export async function listOpenTickets(db: D1Database): Promise<OpenTicketRow[]> {
  const result = await db
    .prepare(
      `SELECT t.id, t.asset_id, a.name AS asset_name, t.title, t.created_at
       FROM equipment_tickets t
       JOIN equipment_assets a ON a.id = t.asset_id
       WHERE t.deleted_at IS NULL AND a.deleted_at IS NULL AND t.status = 'open'
       ORDER BY t.created_at, t.id`
    )
    .all<OpenTicketRow>();
  return result.results ?? [];
}

export async function countAssetsForSale(db: D1Database): Promise<number> {
  const row = await db.prepare(ASSETS_FOR_SALE_SQL).first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/* --------------------------------------------------------------- actions */

function personIdFrom(form: FormData): string | null {
  return textOrNull(form.get("person_id"));
}

/** Owner ruling 2026-09-08 (canon 0.30.12, verbatim: "Replace all the hand
 * sign offs with the names "Kieth", "Les", or "Austin".  Kieth will almost
 * always be the one managing RTUs"): a signature is one of the sign-off
 * names in Admin lookups (the 0.29.0 typed-name law retires); anything else
 * refuses in words. */
async function requireSignature(db: D1Database, raw: string | File | null): Promise<string> {
  const value = requireText(raw, "Signed by");
  const names = await listLookupValues(db, "sign_off_name");
  if (!names.some((n) => n.value === value)) {
    throw new HttpError(400, "Signed by must be one of the sign-off names.");
  }
  return value;
}

/** RTU assets default their signature to Kieth (his words: "Kieth will almost
 * always be the one managing RTUs"); everything else starts blank. */
export function defaultSignerFor(assetName: string, names: LookupOption[]): string {
  if (!/^RTU\b/i.test(assetName.trim())) return "";
  const kieth = names.find((n) => n.value.toLowerCase() === "kieth");
  return kieth?.value ?? "";
}

export function signerSelect(names: LookupOption[], selected: string): string {
  const opts = [
    `<option value=""${selected ? "" : " selected"}>Signed by</option>`,
    ...names.map((n) => `<option value="${esc(n.value)}"${n.value === selected ? " selected" : ""}>${esc(n.label)}</option>`),
  ].join("");
  return `<select name="signed_by" required>${opts}</select>`;
}

export async function equipmentPmDone(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const scheduleId = requireText(form.get("schedule_id"), "Schedule");
  const signedBy = await requireSignature(db, form.get("signed_by"));
  const notes = textOrNull(form.get("notes"));
  const schedule = await db
    .prepare(
      `SELECT id, asset_id, task, interval_days, last_done
       FROM equipment_pm_schedules WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(scheduleId)
    .first<EquipmentScheduleRow>();
  if (!schedule) throw new HttpError(404, "Unknown PM schedule.");
  const ts = nowIso();
  const today = ts.slice(0, 10);
  await db.batch([
    db
      .prepare(
        `INSERT INTO equipment_pm_logs (
          id, asset_id, task, done_on, signed_by, notes,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(crypto.randomUUID(), schedule.asset_id, schedule.task, today, signedBy, notes, ts, actor.id, ts, actor.id),
    db
      .prepare(
        `UPDATE equipment_pm_schedules SET last_done = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(today, ts, actor.id, scheduleId),
    insertLog(db, {
      record_table: "equipment_pm_schedules",
      record_id: scheduleId,
      field: "last_done",
      old_value: schedule.last_done,
      new_value: today,
      actor_person_id: actor.id,
      reason: `PM hand signed: ${signedBy}`,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/equipment/${schedule.asset_id}?ok=signed` };
}

export async function equipmentTicketOpen(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const assetId = requireText(form.get("asset_id"), "Asset");
  const title = requireText(form.get("title"), "What is wrong");
  const signedBy = await requireSignature(db, form.get("signed_by"));
  const ts = nowIso();
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO equipment_tickets (
          id, asset_id, title, status, opened_by, closed_by, closed_at,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, 'open', ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, assetId, title, signedBy, ts, actor.id, ts, actor.id),
    insertLog(db, {
      record_table: "equipment_tickets",
      record_id: id,
      field: "status",
      old_value: null,
      new_value: "open",
      actor_person_id: actor.id,
      reason: `ticket opened, hand signed: ${signedBy}`,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/equipment/${assetId}?ok=ticket` };
}

export async function equipmentTicketClose(db: D1Database, ticketId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const signedBy = await requireSignature(db, form.get("signed_by"));
  const ticket = await db
    .prepare(
      `SELECT id, asset_id, status FROM equipment_tickets WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(ticketId)
    .first<{ id: string; asset_id: string; status: string }>();
  if (!ticket) throw new HttpError(404, "Unknown ticket.");
  if (ticket.status !== "open") throw new HttpError(400, "That ticket is already closed.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE equipment_tickets SET status = 'closed', closed_by = ?, closed_at = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(signedBy, ts, ts, actor.id, ticketId),
    insertLog(db, {
      record_table: "equipment_tickets",
      record_id: ticketId,
      field: "status",
      old_value: "open",
      new_value: "closed",
      actor_person_id: actor.id,
      reason: `ticket closed, hand signed: ${signedBy}`,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/equipment/${ticket.asset_id}?ok=closed` };
}

const SALE_STATUSES = ["listed", "under_offer", "sold"] as const;

function saleStatusOf(raw: unknown): string | null {
  const text = textOrNull(raw);
  if (!text) return null;
  if ((SALE_STATUSES as readonly string[]).includes(text)) return text;
  throw new HttpError(400, "Sale status must be not for sale, listed, under offer, or sold.");
}

function saleMoney(raw: unknown): number | null {
  const text = textOrNull(raw);
  if (!text) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new HttpError(400, "Asking price must be a number of dollars.");
  return Math.round(Number(text) * 100) / 100;
}

function sameSaleMoney(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.round(a * 100) === Math.round(b * 100);
}

/** One save for the For sale block. The log reason is always "asset for sale". */
export async function saveEquipmentForSale(db: D1Database, assetId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const asset = await getEquipmentAsset(db, assetId);
  if (!asset) throw new HttpError(404, "Unknown asset.");
  const status = saleStatusOf(form.get("sale_status"));
  const condition = textOrNull(form.get("sale_condition"));
  if (condition && condition.length > 80) throw new HttpError(400, "Condition must be 80 characters or fewer.");
  const price = saleMoney(form.get("asking_price_usd"));
  const note = textOrNull(form.get("sale_note"));
  if (note && note.length > 240) throw new HttpError(400, "Note must be 240 characters or fewer.");
  const ts = nowIso();
  const oldStatus = asset.sale_status ?? null;
  const oldCondition = asset.sale_condition ?? null;
  const oldPrice = asset.asking_price_usd == null ? null : Number(asset.asking_price_usd);
  const oldNote = asset.sale_note ?? null;
  const logs: D1PreparedStatement[] = [];
  const change = (field: string, oldValue: string | null, newValue: string | null) => {
    if (oldValue === newValue) return;
    logs.push(
      insertLog(db, {
        record_table: "equipment_assets",
        record_id: asset.id,
        field,
        old_value: oldValue,
        new_value: newValue,
        actor_person_id: actor.id,
        reason: ASSET_FOR_SALE_REASON,
        changed_at: ts,
      })
    );
  };
  change("sale_status", oldStatus, status);
  change("sale_condition", oldCondition, condition);
  if (!sameSaleMoney(oldPrice, price)) change("asking_price_usd", oldPrice == null ? null : String(oldPrice), price == null ? null : String(price));
  change("sale_note", oldNote, note);
  if (logs.length === 0) return { redirect: `/equipment/${asset.id}?ok=sale` };
  await db.batch([
    db
      .prepare(
        `UPDATE equipment_assets
         SET sale_status = ?, sale_condition = ?, asking_price_usd = ?, sale_note = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(status, condition, price, note, ts, actor.id, asset.id),
    ...logs,
  ]);
  return { redirect: `/equipment/${asset.id}?ok=sale` };
}

/* ---------------------------------------------------------- C10 shell */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const esc = escapeHtml;

/** The C10 shell's tokens. Owner ruling 2026-09-08 (canon 0.30.12, verbatim:
 * "invert the colors on all the continuum pages"): Christine's paper-light
 * palette flips to its dark twin, ink ground and paper text, the amber kept
 * as the accent and brightened for contrast. The in-app co view (theme.ts)
 * keeps the paper tokens; this standalone shell is where the Continuum pages
 * and the PM system live. */
export const C10_INVERTED_TOKENS = `:root {
  --bg: #14120e; --surface: #1e1b16; --surface-2: #27231c;
  --text: #f1ede4; --muted: #a79f8f;
  --primary: #d19a4e; --primary-strong: #e5b673;
  --primary-soft: rgba(209, 154, 78, 0.16);
  --alert: #e0785c; --alert-soft: rgba(224, 120, 92, 0.18);
  --ok: #7fb894; --ok-soft: rgba(127, 184, 148, 0.18);
  --border: rgba(241, 237, 228, 0.14); --radius: 14px;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 16px 32px -20px rgba(0, 0, 0, 0.85);
  --font-display: "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
  --font-body: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif;
}`;

function c10Shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${esc(title)}</title>
<style>
${C10_INVERTED_TOKENS}
* { box-sizing: border-box; }
body {
  margin: 0; color: var(--text); font-family: var(--font-body); font-size: 16px;
  background: var(--bg);
  background-image: repeating-linear-gradient(115deg, rgba(209,154,78,0.06) 0 1px, transparent 1px 84px);
  min-height: 100vh;
}
.wrap { max-width: 1080px; margin: 0 auto; padding: 2.2rem 1.4rem 4rem; }
.crumb { color: var(--muted); text-decoration: none; font-size: 0.95rem; }
.crumb:hover { color: var(--primary-strong); }
.masthead { display: flex; align-items: center; gap: 1.1rem; margin: 1.4rem 0 0.4rem; }
.badge {
  width: 58px; height: 58px; border-radius: 50%; background: var(--primary);
  color: var(--bg); font-family: var(--font-display); font-size: 1.5rem;
  display: flex; align-items: center; justify-content: center; flex: none;
}
h1 { font-family: var(--font-display); font-weight: 600; font-size: 2.5rem; margin: 0; letter-spacing: 0.2px; }
h2 { font-family: var(--font-display); font-weight: 600; font-size: 1.5rem; margin: 2.4rem 0 0.7rem; }
h3 { font-family: var(--font-display); font-weight: 600; font-size: 1.12rem; margin: 0 0 0.35rem; color: var(--primary-strong); }
.owner { color: var(--muted); margin: 0.25rem 0 0; }
.owner b { color: var(--text); }
.rule { border: 0; border-top: 1px solid var(--border); margin: 1.6rem 0; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.2rem 1.4rem; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.card p { margin: 0.4rem 0 0; line-height: 1.55; }
.kicker { text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.72rem; color: var(--muted); margin: 0 0 0.2rem; }
.lede { color: var(--muted); max-width: 62ch; line-height: 1.6; margin: 0.4rem 0 1.2rem; }
.pill {
  display: inline-flex; align-items: center; gap: 0.6rem; background: var(--surface);
  border: 1px solid var(--border); border-radius: 999px; box-shadow: var(--shadow);
  padding: 0.65rem 1.15rem; text-decoration: none; color: var(--primary-strong); font-weight: 600;
}
.pill:hover { border-color: var(--primary); }
.pill .tag { background: var(--primary-soft); color: var(--primary-strong); border-radius: 999px; padding: 0.15rem 0.6rem; font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; }
table.eq { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); }
table.eq th { text-align: left; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); padding: 0.7rem 0.9rem; border-bottom: 1px solid var(--border); background: var(--surface-2); }
table.eq td { padding: 0.6rem 0.9rem; border-bottom: 1px solid var(--border); font-size: 0.95rem; }
table.eq tr:last-child td { border-bottom: 0; }
table.eq a { color: var(--primary-strong); text-decoration: none; font-weight: 600; }
table.eq a:hover { text-decoration: underline; }
.chip { display: inline-block; border-radius: 999px; padding: 0.12rem 0.6rem; font-size: 0.78rem; font-weight: 600; }
.chip.ok { background: var(--ok-soft); color: var(--ok); }
.chip.due { background: var(--alert-soft); color: var(--alert); }
.chip.zero { background: var(--surface-2); color: var(--muted); }
.shots { display: flex; gap: 0.9rem; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0.4rem 0.1rem 0.9rem; }
.shots img { width: min(640px, 86vw); flex: none; scroll-snap-align: start; border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
.shots-hint { color: var(--muted); font-size: 0.8rem; margin-top: 0; }
form.inline { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin: 0.6rem 0 0; }
form.inline input[type=text], form.inline select { border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.6rem; font: inherit; background: var(--surface); color: var(--text); min-width: 14rem; }
form.inline button { border: 1px solid var(--primary); background: var(--primary); color: var(--bg); border-radius: 999px; padding: 0.45rem 1.05rem; font: inherit; font-weight: 600; cursor: pointer; }
form.inline button:hover { background: var(--primary-strong); border-color: var(--primary-strong); }
form.inline.sale input[type=text], form.inline.sale select { min-width: 0; flex: 1 1 8rem; max-width: 100%; }
.muted { color: var(--muted); }
.ok-flash { background: var(--ok-soft); color: var(--ok); border-radius: 8px; padding: 0.5rem 0.8rem; display: inline-block; margin: 0.8rem 0 0; }
.vendor-logo-slot { min-height: 60px; display: flex; align-items: center; margin: 0 0 0.7rem; }
.vendor-logo { max-height: 140px; max-width: 280px; width: auto; height: auto; object-fit: contain; border-radius: 10px; display: block; }
.vendor-wordmark { font-family: var(--font-display); font-weight: 600; font-size: 1.45rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text); }
@media (max-width: 860px) { .cards { grid-template-columns: 1fr; } h1 { font-size: 1.9rem; } }
</style>
</head>
<body>
<div class="wrap">
${body}
</div>
</body>
</html>`;
}

/* ------------------------------------------------- the Continuum page */

/** Owner ruling 2026-09-08 (canon 0.30.12, verbatim: "Remove the headings in
 * the vendor blurbs on the continuum pages that say the names and replace with
 * Logos"): each card leads with the vendor's logo, vendored at
 * public/continuum/logo-<key>.png exactly as the owner supplied it. Until a
 * logo lands the card shows a plain typographic wordmark, never a heading;
 * dropping the file and setting `logo` here is the whole change. */
const PARTNERS: Array<{ key: string; name: string; logo?: string; what: string; forUs: string }> = [
  {
    key: "athena",
    name: "Athena",
    what: "Standardized cultivation nutrients and the crop-steering discipline around them: published feed charts, target numbers, and a data-first method instead of folklore.",
    forUs: "One feed language across all three farms. Our irrigation and climate calls run on their targets and our sensor data, so a good run is repeatable on purpose, not by luck.",
  },
  {
    key: "vist",
    name: "VIST",
    logo: "/continuum/logo-vist.png",
    what: "Clean-cannabis technology: decontamination and pasteurization systems built for flower, with treatment records at the lot level.",
    forUs: "The cryopasteurization step at Penn North protects test pass rates without cooking the flower. Every treated lot carries its run data, which is exactly the kind of paper trail our system loves.",
  },
  {
    key: "twister",
    name: "Twister",
    logo: "/continuum/logo-twister.jpg",
    what: "Post-harvest machinery: the T-Zero and T2 trimmer lines and the Marvel grading system, plus the service network behind them.",
    forUs: "The trim floor's backbone. Throughput numbers off these machines feed our production planning, and their service partnership keeps blades turning through harvest peaks.",
  },
  {
    key: "t1-logistics",
    name: "T1 Logistics",
    // Canon 0.30.22 (owner, with the file: "For T1"): the T1 Transport mark,
    // vendored exactly as supplied.
    logo: "/continuum/logo-t1-logistics.png",
    what: "Licensed secure cannabis transport: manifested runs, sealed loads, and chain-of-custody discipline between licensed facilities.",
    forUs: "The physical leg of every manifest our system cuts. Their pickup and delivery confirmations close the loop our data opens, farm to farm and farm to market.",
  },
];

export function vendorsEquipmentPage(): string {
  const partnerCards = PARTNERS.map(
    (p) => `<div class="card" data-vendor="${esc(p.key)}">
      <div class="vendor-logo-slot">${
        p.logo
          ? `<img class="vendor-logo" src="${esc(p.logo)}" alt="${esc(p.name)} logo" loading="lazy">`
          : `<span class="vendor-wordmark" data-wordmark>${esc(p.name)}</span>`
      }</div>
      <p class="kicker">What they do</p>
      <p>${esc(p.what)}</p>
      <p class="kicker" style="margin-top:0.8rem">What they do for us</p>
      <p>${esc(p.forUs)}</p>
    </div>`
  ).join("");
  const shots = [1, 2, 3]
    .map((n) => `<img src="/continuum/pm-${n}.png" alt="Preventive Maintenance system, screen ${n}" loading="lazy">`)
    .join("");
  const body = `
  <a class="crumb" href="https://gripcontinuum.gripcannabis.com/#/">&#8592; Back to the Continuum 10</a>
  <div class="masthead">
    <div class="badge">3</div>
    <div>
      <h1>Vendors &amp; Equipment</h1>
      <p class="owner">Owner: <b>Dennis</b></p>
    </div>
  </div>
  <hr class="rule">

  <h2>Strategic Partners</h2>
  <p class="lede">The thread through all four: data and technology as the driving point of success. We pick partners whose machines and methods produce numbers, and we run the operation on those numbers.</p>
  <div class="cards">${partnerCards}</div>

  <h2>Equipment Management</h2>
  <p class="lede">Equipment that gets maintained on a schedule earns its keep; equipment that waits for a breakdown picks the worst week of harvest to take it. Regular preventive maintenance is a strategic position: uptime through the peaks, machines that hold their resale value, and a maintenance history that turns arguments into lookups. Ours is tracked in the Preventive Maintenance system below: every asset has a serial, a recurring schedule, and a signed record of the work.</p>
  <div class="shots">${shots}</div>
  <p class="shots-hint">Slide sideways for more of the system.</p>
  <p><a class="pill" href="/equipment">Open the Preventive Maintenance system <span>&#8594;</span></a></p>

  <h2>Tools</h2>
  <p><a class="pill" href="/equipment">Preventive Maintenance <span class="tag">Live</span> <span>&#8594;</span></a></p>`;
  return c10Shell("Vendors & Equipment", body);
}

/* --------------------------------------------------- the ERP page */

/** Owner ruling 2026-09-07 (canon 0.29.0, second page in the same sitting):
 * the Continuum ERP page remake at /erp-software. The ERP P&L simulator stays
 * on the Continuum site and keeps its Tools link; our sections ride above it.
 * The Admin link is the owner's stated backdoor and will not stay. */
export function erpSoftwarePage(): string {
  const gfShots = [1, 2, 3, 4]
    .map((n) => `<img src="/continuum/gf-${n}.png" alt="GripFactory, screen ${n}" loading="lazy">`)
    .join("");
  const body = `
  <a class="crumb" href="https://gripcontinuum.gripcannabis.com/#/">&#8592; Back to the Continuum 10</a>
  <div class="masthead">
    <div class="badge" style="font-size:0.95rem; letter-spacing:0.06em;">ERP</div>
    <div>
      <h1>ERP</h1>
      <p class="owner">Owner: <b>Dennis</b></p>
    </div>
  </div>
  <hr class="rule">

  <h2>What is an ERP?</h2>
  <p class="lede" style="max-width:70ch">An ERP is supposed to be the one system a business runs on: inventory, production, logistics, purchasing, and the paperwork, all speaking the same language. In the cannabis industry the term gets stretched thin. Most of what is sold as a cannabis ERP is a wrapper around the regulatory software, or, at best, a second system you run in parallel with the regulatory suite, entering everything twice and reconciling the difference on your own time.</p>
  <div class="cards">
    <div class="card">
      <h3>We made both</h3>
      <p>Our operational system and our regulatory operation are one thing. We operate METRC from our own inventory system: the crew works the floor in one place, and the regulatory files fall out of that work, ready to upload, from a single export home. One entry. No parallel system to reconcile.</p>
    </div>
    <div class="card">
      <h3>Tailor-made for the process</h3>
      <p>We also believe tools should be shaped to the process, not the other way around. Our screens are our floors: the barns, the silos, the trucks, the trim room. When the process changes, the tool changes the same week, because we build it.</p>
    </div>
  </div>

  <h2>GripFactory</h2>
  <p class="lede" style="max-width:70ch">GripFactory is our in-house operations system: a lightweight ERP built for our three farms and the way we actually run them. It carries the whole path from harvest to sale: HBN intake, wet weighing, drying and unload, trim and packaging, a live inventory ledger with locations, interco logistics with manifests built on a working floor of the three sites, receiving, compliance exports, purchasing, and a marketplace node.</p>
  <div class="shots">${gfShots}</div>
  <p class="shots-hint">Slide sideways for more of the system.</p>
  <p class="lede" style="max-width:70ch">The thread through all of it is the data. Every weight is a record, every edit and void carries a reason into a change log, every manifest and METRC file is generated from the same ledger the crew works in, and the reports agree with the floor because they read the same tables. That is the difference between software that watches the operation and software that runs it.</p>
  <p><a class="pill" href="https://gripfactory-lite-grip.gflite.workers.dev">Goto GripFactory <span>&#8594;</span></a></p>

  <h2>Tools</h2>
  <p><a class="pill" href="https://gripcontinuum.gripcannabis.com/#/erp-software">ERP P&amp;L Simulator <span class="tag">Continuum</span> <span>&#8594;</span></a></p>`;
  return c10Shell("ERP", body);
}

/* --------------------------------------------------- the Compliance Testing page */

/** Owner ruling 2026-09-07 (canon 0.29.5, verbatim: "ok, now following the same
 * thing, do something for compliance testing.  Add it to the Admin screen.  use
 * real screenshots"): the third Continuum page, same C10 paper shell, describing
 * the REAL Compliance Console that already runs in the app (/compliance: KPIs,
 * external state-lab results, the Orange Photonics and Aqualab instrument
 * drops, audits, label printing). The slider shots are real screens of the
 * walked system, vendored at public/continuum/ct-1..4.png; the owner may
 * replace any by dropping a same-named png. English-first by design: the page
 * lives outside the app shell, like its two siblings. */
export function complianceTestingPage(): string {
  const ctShots = [1, 2, 3, 4]
    .map((n) => `<img src="/continuum/ct-${n}.png" alt="Compliance Console, screen ${n}" loading="lazy">`)
    .join("");
  const body = `
  <a class="crumb" href="https://gripcontinuum.gripcannabis.com/#/">&#8592; Back to the Continuum 10</a>
  <div class="masthead">
    <div class="badge" style="font-size:0.95rem; letter-spacing:0.06em;">CT</div>
    <div>
      <h1>Compliance Testing</h1>
      <p class="owner">Owner: <b>Dennis</b></p>
    </div>
  </div>
  <hr class="rule">

  <h2>The test is the gate</h2>
  <p class="lede" style="max-width:70ch">Nothing we grow reaches a shelf without a state-mandated lab test riding through METRC. An operation that treats testing as paperwork finds out about a failure weeks late, with the batch already boxed and the money already spent. An operation that treats testing as data sees the failure coming, knows which failure modes keep coming back, and knows exactly how many pounds are sitting on the lab's bench instead of in the market. We built for the second kind.</p>
  <div class="cards">
    <div class="card">
      <h3>External: the state lab</h3>
      <p>Every sample rides its tag through the pipeline: facility, required test, entered and finished dates, attempt number, pass or fail, and the failure mode when it fails. First-time-quality reads attempt one only, so retests never flatter the number. The Pareto of failure modes names where the process bleeds, and Lbs in testing prices the wait: that is inventory on a bench, not on a truck.</p>
    </div>
    <div class="card">
      <h3>Internal: we test first</h3>
      <p>We do not wait for the lab to tell us what we grew. Potency runs from our Orange Photonics unit and water activity runs from the Aqualab drop straight into the system as instrument CSVs, parsed on arrival, no retyping. The internal testing report lines our numbers up beside the lab's, so a surprise gets caught in the barn before it costs a sample tag and three weeks.</p>
    </div>
  </div>

  <h2>The Compliance Console</h2>
  <p class="lede" style="max-width:70ch">The console runs inside GripFactory, on the same ledger the crew works: KPI tiles for pounds in testing, first-time-quality, the failure-mode Pareto, and internal audit cadence; the external results table with its reasoned pencil on every row; the instrument drop lanes; internal and external audits with running notes; and 4x6 label printing with barcodes, sized for the stock in the printer. Every result lands with a reason in the change log, because a compliance number nobody can trace is just a rumor with a decimal point.</p>
  <div class="shots">${ctShots}</div>
  <p class="shots-hint">Slide sideways for more of the system.</p>
  <p><a class="pill" href="/compliance">Open the Compliance Console <span>&#8594;</span></a></p>

  <h2>Tools</h2>
  <p><a class="pill" href="/compliance">Compliance Console <span class="tag">Live</span> <span>&#8594;</span></a></p>`;
  return c10Shell("Compliance Testing", body);
}

/* --------------------------------------------------- the Harvest Console node */

/** The Harvest Console node's one URL (canon 0.30.30). The vendored app itself
 * serves here, re-skinned at serve time; the 0.30.27 shell page around it is
 * gone. The old /harvest-console/app path redirects here. */
export const HARVEST_CONSOLE_PATH = "/harvest-console";
export const HARVEST_CONSOLE_LEGACY_APP_PATH = "/harvest-console/app";

/** Owner ruling 2026-09-09 (canon 0.30.30, verbatim, with two pictures of the
 * live page: "Remove all of this, make the CSS match the inverted continuum"
 * over the crumb, masthead, rule and lede, then "Remove this" over the Tools
 * pill): the page IS the app, and the app wears the inverted Continuum. The
 * vendored file never changes on disk (vendored-pair law; its sha256 stands);
 * this style block splices in before its closing head tag at serve time, the
 * SalesHelper skin's precedent. It fills the app's own theme token slots (its
 * :root is declared the re-skin seam: "Nothing else in this file needs to
 * change to re-skin the app") with C10_INVERTED_TOKENS above, slot for slot
 * along the app's own CONTINUUM10-THEME mapping: bg, surface, surface-2,
 * primary, primary-strong, text, muted, border, alert, alert-soft, primary-soft,
 * shadow; the three derived slots (panel-3, text-dim, line) derive from the
 * inverted values the same way the originals derived from Christine's. The
 * operational status colors the app keeps as its own (amber, danger, ok, the
 * year palette) stay untouched, exactly as its mapping doc keeps them. The
 * body gains the shell's diagonal rule so the two grounds read as one. */
export const HARVEST_CONSOLE_INVERTED_SKIN = `<style id="gf-c10-inverted-skin">
:root {
  --bg: #14120e;
  --panel: #1e1b16;
  --panel-2: #27231c;
  --panel-3: #312c24;
  --accent: #d19a4e;
  --accent-2: #e5b673;
  --accent-3: #e5b673;
  --text: #f1ede4;
  --text-dim: #ccc6ba;
  --text-mute: #a79f8f;
  --line: #3b3833;
  --alert: #e0785c;
  --alert-soft: rgba(224, 120, 92, 0.18);
  --accent-soft: rgba(209, 154, 78, 0.16);
  --radius: 14px;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 16px 32px -20px rgba(0, 0, 0, 0.85);
}
body {
  background-color: var(--bg);
  background-image: repeating-linear-gradient(115deg, rgba(209,154,78,0.06) 0 1px, transparent 1px 84px);
}
.gf-continuum-crumb { color: var(--text-mute); text-decoration: none; font: 600 12px/1 var(--font); letter-spacing: 0.04em; white-space: nowrap; padding-left: 14px; border-left: 1px solid var(--line); }
.gf-continuum-crumb:hover { color: var(--accent-2); }
</style>
`;

/** Owner ruling 2026-09-09 (canon 0.30.32, verbatim: "Add "back to continuum"
 * link to the harvest console lite screen"): the same crumb the Continuum pages
 * carry, spliced into the app's own header bar at serve time, right of its
 * brand block and left of the spacer that pushes the zoom and language pills
 * to the far side. Same words, same arrow, same destination as its siblings. */
export const HARVEST_CONSOLE_CRUMB = `<a id="gf-continuum-crumb" class="gf-continuum-crumb" href="https://gripcontinuum.gripcannabis.com/#/">&#8592; Back to the Continuum 10</a>
  `;

/** Decorate the served document, once each: the inverted skin before the
 * closing head tag, the Continuum crumb before the first spacer inside the
 * app's header bar. Plain string slicing, so no dollar pattern in the skin,
 * the crumb or the document could ever expand. A document without a head tag
 * streams unchanged; one without the header bar takes the skin alone. */
export function skinHarvestConsole(html: string): string {
  const at = html.indexOf("</head>");
  if (at === -1) return html;
  let out = html.slice(0, at) + HARVEST_CONSOLE_INVERTED_SKIN + html.slice(at);
  const header = out.indexOf('<header id="lt-chrome">');
  if (header !== -1) {
    const headerEnd = out.indexOf("</header>", header);
    const spacer = out.indexOf('<div class="spacer"></div>', header);
    if (spacer !== -1 && headerEnd !== -1 && spacer < headerEnd) {
      out = out.slice(0, spacer) + HARVEST_CONSOLE_CRUMB + out.slice(spacer);
    }
  }
  return out;
}

/* --------------------------------------------------- the PM system UI */

export function equipmentHomePage(
  assets: EquipmentAssetRow[],
  schedules: EquipmentScheduleRow[],
  todayIso: string,
  ok?: string
): string {
  const nextByAsset = new Map<string, string>();
  for (const s of schedules) {
    const due = nextDueFrom(s.last_done, s.interval_days);
    const cur = nextByAsset.get(s.asset_id);
    if (!cur || due === "now" || (cur !== "now" && due < cur)) nextByAsset.set(s.asset_id, due);
  }
  const rows = assets
    .map((a) => {
      const due = nextByAsset.get(a.id) ?? "";
      const overdue = due !== "" && isOverdue(due, todayIso);
      const dueCell = due === "" ? `<span class="muted">no schedule</span>` : overdue ? `<span class="chip due" title="It has been counting the days.">${esc(dueLabel(due, todayIso))}</span>` : esc(due);
      const tickets = a.open_tickets > 0 ? `<span class="chip due">${a.open_tickets} open</span>` : `<span class="chip zero">0</span>`;
      const sale = saleListWord(a.sale_status);
      return `<tr>
        <td>${esc(a.serial)}</td>
        <td><a href="/equipment/${esc(a.id)}">${esc(a.name)}</a>${sale}</td>
        <td>${esc(a.farm_code)}</td>
        <td>${tickets}</td>
        <td>${dueCell}</td>
      </tr>`;
    })
    .join("");
  const body = `
  <a class="crumb" href="/vendors-equipment">&#8592; Vendors &amp; Equipment</a>
  <div class="masthead">
    <div class="badge" title="Preventive, as in before it screams.">PM</div>
    <div>
      <h1>Preventive Maintenance</h1>
      <p class="owner">Grease it before it screams. Sign it so we believe you.</p>
    </div>
  </div>
  ${ok === "signed" ? `<p class="ok-flash">Signed. The machine says thank you.</p>` : ""}
  <hr class="rule">
  <table class="eq">
    <thead><tr><th>Serial</th><th>Asset</th><th>Farm</th><th>Open tickets</th><th>Next PM</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="muted" style="margin-top:0.9rem">Every completion is hand signed with a typed name. No dropdowns. A dropdown never turned a wrench.</p>`;
  return c10Shell("Preventive Maintenance", body);
}

function saleListWord(status: string | null | undefined): string {
  if (status === "listed") return ` <span class="chip ok" data-eq-sale="listed">listed</span>`;
  if (status === "under_offer") return ` <span class="chip due" data-eq-sale="under_offer">under offer</span>`;
  if (status === "sold") return ` <span class="chip zero" data-eq-sale="sold">sold</span>`;
  return "";
}

function saleOptions(selected: string | null | undefined): string {
  const current = selected ?? "";
  const options: Array<[string, string]> = [
    ["", "not for sale"],
    ["listed", "listed"],
    ["under_offer", "under offer"],
    ["sold", "sold"],
  ];
  return options
    .map(([value, label]) => `<option value="${esc(value)}"${current === value ? " selected" : ""}>${esc(label)}</option>`)
    .join("");
}

function forSaleBlock(asset: EquipmentAssetRow): string {
  const price = asset.asking_price_usd == null ? "" : String(asset.asking_price_usd);
  return `<h2>For sale</h2>
  <form class="inline sale" method="post" action="/equipment/${esc(asset.id)}/for-sale" data-eq-sale-form>
    <select name="sale_status" aria-label="Sale status">${saleOptions(asset.sale_status)}</select>
    <input type="text" name="sale_condition" maxlength="80" placeholder="Condition" value="${esc(asset.sale_condition ?? "")}">
    <input type="text" name="asking_price_usd" inputmode="decimal" placeholder="Asking price USD" value="${esc(price)}">
    <input type="text" name="sale_note" maxlength="240" placeholder="Note" value="${esc(asset.sale_note ?? "")}">
    <button type="submit">Save</button>
  </form>`;
}

export function equipmentAssetPage(
  asset: EquipmentAssetRow,
  schedules: EquipmentScheduleRow[],
  logs: EquipmentLogRow[],
  tickets: EquipmentTicketRow[],
  todayIso: string,
  ok?: string,
  signOffNames: LookupOption[] = []
): string {
  // Canon 0.30.12: every signature picks from the sign-off names; RTUs start on Kieth.
  const signer = signerSelect(signOffNames, defaultSignerFor(asset.name, signOffNames));
  const schedRows = schedules
    .map((s) => {
      const due = nextDueFrom(s.last_done, s.interval_days);
      const overdue = isOverdue(due, todayIso);
      return `<tr>
        <td>${esc(s.task)}</td>
        <td>every ${s.interval_days} days</td>
        <td>${s.last_done ? esc(s.last_done) : `<span class="muted">never, apparently</span>`}</td>
        <td>${overdue ? `<span class="chip due">${esc(dueLabel(due, todayIso))}</span>` : esc(due)}</td>
        <td>
          <form class="inline" method="post" action="/equipment/pm-done">
            <input type="hidden" name="schedule_id" value="${esc(s.id)}">
            ${signer}
            <input type="text" name="notes" placeholder="Notes (optional)">
            <button type="submit">PM done</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const logRows = logs
    .map(
      (l) => `<tr><td>${esc(l.done_on)}</td><td>${esc(l.task)}</td><td>${esc(l.signed_by)}</td><td>${esc(l.notes ?? "")}</td></tr>`
    )
    .join("");
  const ticketRows = tickets
    .map((tk) => {
      const state =
        tk.status === "open"
          ? `<form class="inline" method="post" action="/equipment/ticket/${esc(tk.id)}/close">
              ${signer}
              <button type="submit">Close</button>
            </form>`
          : `<span class="chip ok">closed</span> <span class="muted">${esc(tk.closed_by ?? "")}</span>`;
      return `<tr><td>${esc(tk.title)}</td><td>${tk.status === "open" ? `<span class="chip due">open</span>` : `<span class="chip ok">closed</span>`}</td><td>${state}</td></tr>`;
    })
    .join("");
  const okFlash =
    ok === "signed"
      ? `<p class="ok-flash">Signed. The machine says thank you.</p>`
      : ok === "ticket"
        ? `<p class="ok-flash">Ticket opened. It has been acknowledged, which is half the battle.</p>`
        : ok === "closed"
          ? `<p class="ok-flash">Ticket closed. Somewhere, a wrench rests.</p>`
          : ok === "sale"
            ? `<p class="ok-flash">Saved.</p>`
            : "";
  const body = `
  <a class="crumb" href="/equipment">&#8592; Preventive Maintenance</a>
  <div class="masthead">
    <div class="badge">${esc(asset.farm_code)}</div>
    <div>
      <h1>${esc(asset.name)}</h1>
      <p class="owner">Serial: <b>${esc(asset.serial)}</b> &#183; Farm: <b>${esc(asset.farm_code)}</b></p>
    </div>
  </div>
  ${okFlash}
  <hr class="rule">
  ${forSaleBlock(asset)}

  <h2>Recurring PM</h2>
  <table class="eq">
    <thead><tr><th>Task</th><th>Interval</th><th>Last done</th><th>Next due</th><th>Sign it off</th></tr></thead>
    <tbody>${schedRows}</tbody>
  </table>

  <h2>Tickets</h2>
  <table class="eq">
    <thead><tr><th>What is wrong</th><th>Status</th><th></th></tr></thead>
    <tbody>${ticketRows || `<tr><td colspan="3" class="muted">Nothing is wrong. Officially.</td></tr>`}</tbody>
  </table>
  <form class="inline" method="post" action="/equipment/ticket">
    <input type="hidden" name="asset_id" value="${esc(asset.id)}">
    <input type="text" name="title" placeholder="What is wrong" required>
    ${signer}
    <button type="submit">Open ticket</button>
  </form>

  <h2>PM history</h2>
  <table class="eq">
    <thead><tr><th>Date</th><th>Task</th><th>Signed by</th><th>Notes</th></tr></thead>
    <tbody>${logRows || `<tr><td colspan="4" class="muted">No history. The machine is either new or very private.</td></tr>`}</tbody>
  </table>`;
  return c10Shell(`${asset.serial} ${asset.name}`, body);
}
