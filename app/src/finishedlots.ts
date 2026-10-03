/**
 * FINISHED LOTS, FOUND (canon 0.30.373). The owner, 2026-10-03, verbatim: "Also,
 * we need to do something about the fact that the finished lots in each screen
 * have no retrieval method (or no easy one). Once they're finished, if they're
 * unfinished, all the tote weights are lost." His pick on the Scribe's question:
 * "See, fix and reopen (Recommended)".
 *
 * No tote was ever lost (canon 0.30.366): a finished lot's totes were simply on
 * no weigh screen. Each weigh screen now lists its farms' lots finished in the
 * farm's today or the 7 farm days before it; a lot opens on its own page with
 * every tote, live and voided; a live tote voids with a reason while the wet
 * weight is still open (the lot and its wet package drop by the tote's grams in
 * the same batch); and Reopen is the queue's Demote, the same code path, with
 * the lot landing where the floor weighs. Void and Reopen take the Admin PIN,
 * the PIN that fronts the Data Queues' Demote; the list and the lot page are
 * open to the floor. Listing changes no HBN list.
 */
import { runQueueControl } from "./actions";
import { HttpError, nowIso, requireReason, textOrNull } from "./audit";
import { formatLbs } from "./compliance";
import {
  barnLocationForSite,
  CONFIG_KEYS,
  ITEM_KIND_SPR,
  ITEM_KIND_WIP,
  LANDING_FARM,
  LOT_STATUS,
  formatGrams,
  farmHarvestSql,
  shortLotId,
  sumGrams,
} from "./config";
import { getConfigValue, insertLog, lotTotalRecomputeStmt, requireActor } from "./db";
import { dayBefore, etWallClock, farmDay, farmDayBounds } from "./farmday";
import { farmDayStartHour } from "./effective";
import { t, tFill, type Locale } from "./i18n";
import { ledgerByTable } from "./pipeline";
import { esc } from "./ui";

/** The two weigh screens and their farms: Penn North Harvest weighs PNN; the field node weighs ARL and PNS. */
export const FINISHED_LOT_SCREENS = {
  wet_weight: { key: "wet_weight", title: "Penn North Harvest", path: "/station/wet_weight", farms: ["PNN"] },
  field_harvest: { key: "field_harvest", title: "Penn South/Arlington Harvest", path: "/station/field_harvest", farms: ["ARL", "PNS"] },
} as const;

export type FinishedLotScreenKey = keyof typeof FINISHED_LOT_SCREENS;
export type FinishedLotScreen = (typeof FINISHED_LOT_SCREENS)[FinishedLotScreenKey];

export function finishedLotScreen(key: string): FinishedLotScreen | null {
  return key === "wet_weight" || key === "field_harvest" ? FINISHED_LOT_SCREENS[key] : null;
}

/** The farm days the list covers: the farm's today and the 7 before it. */
export const FINISHED_LOT_DAYS = 8;

/** A tote may void while the lot's wet package still holds the wet weight. */
export const TOTE_VOIDABLE_STATUSES: readonly string[] = [LOT_STATUS.weighing, LOT_STATUS.in_transit, LOT_STATUS.drying];

/** Reopen is the Demote's step back to weighing, offered where that step exists. */
export const LOT_REOPENABLE_STATUSES: readonly string[] = [LOT_STATUS.drying, LOT_STATUS.in_transit];

/** The window by finished_at: from the start of the farm day 7 days before today to the end of today (farmDayBounds). */
export function finishedLotWindow(today: string, startHour: number): { startIso: string; endIso: string; firstDay: string } {
  let first = today;
  for (let i = 1; i < FINISHED_LOT_DAYS; i++) first = dayBefore(first);
  return { startIso: farmDayBounds(first, startHour).startIso, endIso: farmDayBounds(today, startHour).endIso, firstDay: first };
}

const STATUS_WORDS: Record<string, string> = {
  weighing: "Weighing",
  drying: "Drying",
  in_transit: "In transit",
  unloaded: "Unloaded",
  trimmed: "Trimmed",
  frozen: "Frozen",
};

export function lotStatusWords(locale: Locale, status: string): string {
  return t(locale, STATUS_WORDS[status] ?? status);
}

export type FinishedLotRow = {
  id: string;
  status: string;
  finished_at: string;
  hbn: string;
  farm_code: string;
  strain_name: string;
  space_name: string;
  tote_count: number;
  tote_grams: number;
};

/** The screen's farms' lots off weighing, finished inside the window, newest finish first. */
export async function listFinishedLots(db: D1Database, screen: FinishedLotScreen, now: string = nowIso()): Promise<FinishedLotRow[]> {
  const startHour = await farmDayStartHour(db);
  const window = finishedLotWindow(farmDay(now, startHour), startHour);
  const farms = [...screen.farms];
  const result = await db
    .prepare(
      `SELECT w.id, w.status, w.finished_at, b.hbn, b.farm_code, COALESCE(s.name, '') AS strain_name, COALESCE(d.name, '') AS space_name,
              (SELECT COUNT(*) FROM wet_weights t WHERE t.wet_weight_entry_id = w.id AND t.deleted_at IS NULL) AS tote_count,
              (SELECT COALESCE(SUM(t.weight_grams), 0) FROM wet_weights t WHERE t.wet_weight_entry_id = w.id AND t.deleted_at IS NULL) AS tote_grams
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN strains s ON s.id = b.strain_id
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       WHERE w.deleted_at IS NULL AND w.status <> 'weighing' AND ${farmHarvestSql("b")}
         AND b.farm_code IN (${farms.map(() => "?").join(", ")})
         AND w.finished_at >= ? AND w.finished_at < ?
       ORDER BY w.finished_at DESC, w.id DESC`
    )
    .bind(...farms, window.startIso, window.endIso)
    .all<FinishedLotRow>();
  return result.results ?? [];
}

export type LotHead = {
  id: string;
  status: string;
  finished_at: string | null;
  harvest_batch_id: string;
  hbn: string;
  farm_code: string;
  strain_name: string;
  space_name: string;
  space_location: string;
  space_kind: string;
  weight_grams: number;
};

/** The lot when it stands on this screen's farms; null otherwise. */
export async function getScreenLot(db: D1Database, screen: FinishedLotScreen, lotId: string): Promise<LotHead | null> {
  const row = await db
    .prepare(
      `SELECT w.id, w.status, w.finished_at, w.harvest_batch_id, w.weight_grams, b.hbn, b.farm_code, COALESCE(s.name, '') AS strain_name,
              COALESCE(d.name, '') AS space_name, COALESCE(d.location_name, '') AS space_location, COALESCE(d.kind, '') AS space_kind
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN strains s ON s.id = b.strain_id
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       WHERE w.id = ? AND w.deleted_at IS NULL`
    )
    .bind(lotId)
    .first<LotHead>();
  if (!row || !(screen.farms as readonly string[]).includes(row.farm_code)) return null;
  return row;
}

export type LotTote = {
  id: string;
  weight_grams: number;
  created_at: string;
  deleted_at: string | null;
  field_load_id: string | null;
  weighed_by: string | null;
  voided_by: string | null;
  void_reason: string | null;
  load_operator: string | null;
  load_destination: string | null;
  load_started_at: string | null;
};

/** Every tote of the lot, live and voided, newest first; a voided tote carries its void's reason from the change log. */
export async function listLotTotes(db: D1Database, lotId: string): Promise<LotTote[]> {
  const result = await db
    .prepare(
      `SELECT t.id, t.weight_grams, t.created_at, t.deleted_at, t.field_load_id,
              COALESCE(NULLIF(p.display_name, ''), p.email) AS weighed_by,
              COALESCE(NULLIF(v.display_name, ''), v.email) AS voided_by,
              (SELECT g.reason FROM record_change_log g
               WHERE g.record_table = 'wet_weights' AND g.record_id = t.id AND g.field = 'deleted_at'
               ORDER BY g.changed_at DESC LIMIT 1) AS void_reason,
              l.operator_name AS load_operator, f.display_name AS load_destination, l.started_at AS load_started_at
       FROM wet_weights t
       LEFT JOIN people p ON p.id = t.created_by
       LEFT JOIN people v ON v.id = t.deleted_by
       LEFT JOIN field_loads l ON l.id = t.field_load_id
       LEFT JOIN farms f ON f.code = l.destination_farm_code
       WHERE t.wet_weight_entry_id = ?
       ORDER BY t.created_at DESC, t.id DESC`
    )
    .bind(lotId)
    .all<LotTote>();
  return result.results ?? [];
}

export function liveTotes(totes: readonly LotTote[]): LotTote[] {
  return totes.filter((tote) => !tote.deleted_at);
}

function lbWithGrams(grams: number): string {
  return `${formatLbs(grams)} lb (${formatGrams(grams)} g)`;
}

function lotPagePath(screen: FinishedLotScreen, lotId: string): string {
  return `${screen.path}/finished/${encodeURIComponent(lotId)}`;
}

/** The list below the weighing area, folded by default so the weighing area stays first. */
export function finishedLotsSection(locale: Locale, screen: FinishedLotScreen, rows: readonly FinishedLotRow[]): string {
  const body = rows.length
    ? `<div class="field-table"><table class="data" data-finished-lot-list><thead><tr>
        <th>${esc(t(locale, "HBN"))}</th>
        <th>${esc(t(locale, "Strain"))}</th>
        <th>${esc(t(locale, "Space"))}</th>
        <th>${esc(t(locale, "Finish time"))}</th>
        <th>${esc(t(locale, "Totes"))}</th>
        <th>${esc(t(locale, "Wet total"))}</th>
        <th>${esc(t(locale, "Status"))}</th>
      </tr></thead><tbody>${rows
        .map(
          (row) => `<tr data-finished-lot="${esc(row.id)}">
          <td><a href="${esc(lotPagePath(screen, row.id))}">${esc(shortLotId(row.hbn, null))}</a></td>
          <td>${esc(row.strain_name)}</td>
          <td>${esc(row.space_name)}</td>
          <td><time datetime="${esc(row.finished_at)}">${esc(etWallClock(row.finished_at))}</time></td>
          <td>${esc(String(Number(row.tote_count)))}</td>
          <td>${esc(lbWithGrams(Number(row.tote_grams)))}</td>
          <td>${esc(lotStatusWords(locale, row.status))}</td>
        </tr>`
        )
        .join("")}</tbody></table></div>`
    : `<p class="muted">${esc(t(locale, "No lots finished in these 8 farm days."))}</p>`;
  return `<details class="finished-lots" data-finished-lots="${esc(screen.key)}">
      <summary class="btn secondary">${esc(t(locale, "Finished lots"))} <span class="tile-count">${rows.length}</span></summary>
      <p class="muted">${esc(t(locale, "Today and the 7 farm days before it, newest finish first. Tap a lot to see every tote."))}</p>
      ${body}
    </details>`;
}

function pinInput(locale: Locale): string {
  return `<input type="password" name="pin" inputmode="numeric" autocomplete="off" placeholder="${esc(t(locale, "PIN"))}" aria-label="${esc(t(locale, "PIN"))}">`;
}

function loadWords(tote: LotTote): string {
  if (!tote.field_load_id) return "";
  return [tote.load_operator, tote.load_destination, tote.load_started_at ? etWallClock(tote.load_started_at) : ""].filter(Boolean).join(" / ");
}

/** The lot's own page: the live total and count at the top, then every tote. */
export function finishedLotPage(locale: Locale, screen: FinishedLotScreen, lot: LotHead, totes: readonly LotTote[]): string {
  const live = liveTotes(totes);
  const liveGrams = sumGrams(live.map((tote) => Number(tote.weight_grams)));
  const voidable = TOTE_VOIDABLE_STATUSES.includes(lot.status);
  const reopenable = LOT_REOPENABLE_STATUSES.includes(lot.status);
  const base = lotPagePath(screen, lot.id);
  const weighOn = `${screen.path}?lot=${encodeURIComponent(lot.id)}`;
  const head = `<dl class="lot-meta" data-lot-head="${esc(lot.id)}">
      <dt>${esc(t(locale, "HBN"))}</dt><dd>${esc(shortLotId(lot.hbn, null))}</dd>
      <dt>${esc(t(locale, "Strain"))}</dt><dd>${esc(lot.strain_name)}</dd>
      <dt>${esc(t(locale, "Space"))}</dt><dd>${esc(lot.space_name)}</dd>
      <dt>${esc(t(locale, "Status"))}</dt><dd data-lot-status="${esc(lot.status)}">${esc(lotStatusWords(locale, lot.status))}</dd>
      <dt>${esc(t(locale, "Finish time"))}</dt><dd>${lot.finished_at ? `<time datetime="${esc(lot.finished_at)}">${esc(etWallClock(lot.finished_at))}</time>` : ""}</dd>
      <dt>${esc(t(locale, "Totes"))}</dt><dd data-lot-live-count>${live.length}</dd>
      <dt>${esc(t(locale, "Wet total"))}</dt><dd data-lot-live-grams="${esc(String(liveGrams))}">${esc(lbWithGrams(liveGrams))}</dd>
    </dl>`;
  const reopen = reopenable
    ? `<form method="post" action="${esc(base)}/reopen" class="field-reopen" data-lot-reopen onsubmit="return confirm(this.getAttribute('data-confirm'))" data-confirm="${esc(
        t(locale, "Reopen puts this lot back to weighing with all its totes on the weigh screen. Continue?")
      )}">
        <p class="muted">${esc(t(locale, "Reopen puts this lot back to weighing with all its totes on the weigh screen; new totes add to it."))}</p>
        ${pinInput(locale)}
        <button type="submit">${esc(t(locale, "Reopen"))}</button>
      </form>`
    : lot.status === LOT_STATUS.weighing
      ? `<p data-lot-weighing><a class="btn" href="${esc(weighOn)}">${esc(t(locale, "This lot is weighing. Open it on the weigh screen."))}</a></p>`
      : `<p class="muted" data-lot-closed>${esc(t(locale, "The wet weight of this lot is closed (unloaded, trimmed or frozen). Ask the Scribe for a repair."))}</p>`;
  const rows = totes
    .map((tote, i) => {
      const grams = Number(tote.weight_grams);
      const n = totes.length - i;
      if (tote.deleted_at) {
        const said = tFill(locale, "Voided {when} by {who}: {reason}", {
          when: etWallClock(tote.deleted_at),
          who: tote.voided_by ?? "",
          reason: tote.void_reason ?? "",
        });
        return `<tr data-lot-tote="${esc(tote.id)}" data-tote-voided>
          <td class="weight-seq"><s>${n}</s></td>
          <td><s>${esc(etWallClock(tote.created_at))}</s></td>
          <td><s>${esc(formatGrams(grams))}</s></td>
          <td><s>${esc(formatLbs(grams))}</s></td>
          <td><s>${esc(loadWords(tote))}</s></td>
          <td><s>${esc(tote.weighed_by ?? "")}</s></td>
          <td class="muted">${esc(said)}</td>
        </tr>`;
      }
      const voidForm = voidable
        ? `<details class="tote-void"><summary class="btn secondary">${esc(t(locale, "Void"))}</summary>
            <form method="post" action="${esc(screen.path)}/finished/totes/${esc(tote.id)}/void" class="stack" data-tote-void>
              <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required autocomplete="off"></label>
              ${pinInput(locale)}
              <button type="submit">${esc(t(locale, "Void this tote"))}</button>
            </form>
          </details>`
        : "";
      return `<tr data-lot-tote="${esc(tote.id)}">
          <td class="weight-seq">${n}</td>
          <td><time datetime="${esc(tote.created_at)}">${esc(etWallClock(tote.created_at))}</time></td>
          <td>${esc(formatGrams(grams))}</td>
          <td>${esc(formatLbs(grams))}</td>
          <td>${esc(loadWords(tote))}</td>
          <td>${esc(tote.weighed_by ?? "")}</td>
          <td class="row-actions">${voidForm}</td>
        </tr>`;
    })
    .join("");
  const table = totes.length
    ? `<div class="field-table"><table class="data weights-numbered" data-lot-totes><thead><tr>
        <th class="weight-seq">#</th>
        <th>${esc(t(locale, "Time"))}</th>
        <th>${esc(t(locale, "Weight (g)"))}</th>
        <th>lb</th>
        <th>${esc(t(locale, "Field load"))}</th>
        <th>${esc(t(locale, "Weighed by"))}</th>
        <th>${esc(t(locale, "Controls"))}</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`
    : `<p class="muted">${esc(t(locale, "No weights yet."))}</p>`;
  return `<h1>${esc(t(locale, "Finished lot"))} ${esc(shortLotId(lot.hbn, null))}</h1>
    <p><a href="${esc(screen.path)}">${esc(tFill(locale, "Back to {screen}", { screen: t(locale, screen.title) }))}</a></p>
    <section class="working-pane" data-finished-lot-page="${esc(screen.key)}">
      ${head}
      ${reopen}
      ${table}
    </section>`;
}

/** THE FIELD NODE'S LOTS SO FAR: a weighing lot whose totes are not all on this load (a reopened lot, or one carried
 * across loads) shows every live tote where the operator weighs, counted and totaled, the new load's included. */
export type FieldLotSoFar = { lot: LotHead; totes: LotTote[] };

export async function fieldLotsSoFar(
  db: D1Database,
  lotIds: readonly string[],
  loadId: string | null
): Promise<FieldLotSoFar[]> {
  const screen = FINISHED_LOT_SCREENS.field_harvest;
  const out: FieldLotSoFar[] = [];
  for (const lotId of [...new Set(lotIds)]) {
    const lot = await getScreenLot(db, screen, lotId);
    if (!lot || lot.status !== LOT_STATUS.weighing) continue;
    const totes = liveTotes(await listLotTotes(db, lotId));
    if (loadId && totes.every((tote) => tote.field_load_id === loadId)) continue;
    out.push({ lot, totes });
  }
  return out;
}

export function fieldLotsSoFarBlock(locale: Locale, lots: readonly FieldLotSoFar[], loadId: string | null): string {
  return lots
    .map(({ lot, totes }) => {
      const grams = sumGrams(totes.map((tote) => Number(tote.weight_grams)));
      const head = tFill(locale, "{hbn}: all {n} totes on this lot, {total}", {
        hbn: shortLotId(lot.hbn, null),
        n: String(totes.length),
        total: lbWithGrams(grams),
      });
      const rows = totes
        .map((tote, i) => {
          const here = loadId != null && tote.field_load_id === loadId;
          return `<tr data-lot-tote="${esc(tote.id)}">
            <td class="weight-seq">${totes.length - i}</td>
            <td><time datetime="${esc(tote.created_at)}">${esc(etWallClock(tote.created_at))}</time></td>
            <td>${esc(formatGrams(tote.weight_grams))}</td>
            <td>${esc(here ? t(locale, "This load") : loadWords(tote))}</td>
          </tr>`;
        })
        .join("");
      return `<details class="field-lot-so-far" data-lot-so-far="${esc(lot.id)}" data-lot-so-far-count="${totes.length}" data-lot-so-far-grams="${esc(String(grams))}" open>
          <summary>${esc(head)}</summary>
          ${loadId ? "" : `<p class="muted">${esc(t(locale, "Pick or start a load, then weigh this HBN; new totes add to this lot."))}</p>`}
          <div class="field-table"><table class="data weights-numbered"><thead><tr>
            <th class="weight-seq">#</th>
            <th>${esc(t(locale, "Time"))}</th>
            <th>${esc(t(locale, "Weight"))}</th>
            <th>${esc(t(locale, "Field load"))}</th>
          </tr></thead><tbody>${rows}</tbody></table></div>
        </details>`;
    })
    .join("");
}

async function requireLotPin(db: D1Database, form: FormData, message: string): Promise<void> {
  const pin = await getConfigValue(db, CONFIG_KEYS.admin_pin);
  const entered = textOrNull(form.get("pin"));
  if (!pin || entered !== pin) throw new HttpError(403, message);
}

const WET_CLOSED = "The wet weight of this lot is closed (unloaded, trimmed or frozen). Ask the Scribe for a repair.";
const PACKAGE_HAS_CHILDREN = "The lot's wet package has packages made from it, so its wet weight is closed. Ask the Scribe for a repair.";
const PACKAGE_LEFT = "The lot's wet package has left its space, so its wet weight is closed. Ask the Scribe for a repair.";
const PACKAGE_MANY = "The lot has more than one wet package. Ask the Scribe for a repair.";
const PACKAGE_BELOW_ZERO = "The lot's wet package holds less than this tote. Ask the Scribe for a repair.";

type WetPackage = { id: string; qty: number; item_kind: string; location: string };

/** VOID A TOTE: soft (deleted_at, deleted_by), logged with the reason, and in the same batch the lot's weight_grams and
 * its minted wet package (SPR or WIP) drop by the tote's grams. Open while the lot weighs, rides or dries. */
export async function voidFinishedTote(
  db: D1Database,
  screenKey: string,
  toteId: string,
  form: FormData
): Promise<{ redirect: string }> {
  const screen = finishedLotScreen(screenKey);
  if (!screen) throw new HttpError(404, "Unknown screen.");
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  await requireLotPin(db, form, "Voiding a tote needs the Admin PIN.");
  const reason = requireReason(textOrNull(form.get("reason")));
  const tote = await db
    .prepare(`SELECT id, wet_weight_entry_id, weight_grams, deleted_at FROM wet_weights WHERE id = ?`)
    .bind(toteId)
    .first<{ id: string; wet_weight_entry_id: string; weight_grams: number; deleted_at: string | null }>();
  if (!tote) throw new HttpError(404, "Unknown tote.");
  if (tote.deleted_at) throw new HttpError(400, "That tote is already voided.");
  const lot = await getScreenLot(db, screen, tote.wet_weight_entry_id);
  if (!lot) throw new HttpError(404, "That lot is not on this screen.");
  if (!TOTE_VOIDABLE_STATUSES.includes(lot.status)) throw new HttpError(400, WET_CLOSED);
  const grams = Number(tote.weight_grams);
  const packages = await db
    .prepare(
      `SELECT id, qty, item_kind, location FROM local_inventory_items
       WHERE wet_weight_entry_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`
    )
    .bind(lot.id)
    .all<WetPackage>();
  const pkgs = packages.results ?? [];
  if (pkgs.length > 1) throw new HttpError(400, PACKAGE_MANY);
  const pkg = pkgs[0] ?? null;
  if (pkg) {
    if (pkg.item_kind !== ITEM_KIND_SPR && pkg.item_kind !== ITEM_KIND_WIP) throw new HttpError(400, WET_CLOSED);
    const child = await db
      .prepare(`SELECT 1 AS one FROM local_inventory_items WHERE parent_item_id = ? AND deleted_at IS NULL LIMIT 1`)
      .bind(pkg.id)
      .first<{ one: number }>();
    if (child) throw new HttpError(400, PACKAGE_HAS_CHILDREN);
    // Its space: the barn it was born in, the lot's own space (a hang or a room), or the silo's METRC location.
    const spaces = [barnLocationForSite(LANDING_FARM), lot.space_name, lot.space_location].filter((value) => value !== "");
    if (!spaces.includes(pkg.location)) throw new HttpError(400, PACKAGE_LEFT);
    if (Number(pkg.qty) < grams) throw new HttpError(400, PACKAGE_BELOW_ZERO);
  }
  const ledger = ledgerByTable("wet_weights");
  if (!ledger) throw new HttpError(500, "The wet ledger is not wired.");
  const ts = nowIso();
  const liveBefore = await db
    .prepare(`SELECT COALESCE(SUM(weight_grams), 0) AS g FROM wet_weights WHERE wet_weight_entry_id = ? AND deleted_at IS NULL`)
    .bind(lot.id)
    .first<{ g: number }>();
  const lotAfter = sumGrams([Number(liveBefore?.g ?? 0), -grams]);
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(`UPDATE wet_weights SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(ts, actor.id, ts, actor.id, tote.id),
    insertLog(db, {
      record_table: "wet_weights",
      record_id: tote.id,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
    lotTotalRecomputeStmt(db, ledger, lot.id, actor.id, ts),
    insertLog(db, {
      record_table: "wet_weight_entries",
      record_id: lot.id,
      field: "weight_grams",
      old_value: String(lot.weight_grams),
      new_value: String(lotAfter),
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ];
  if (pkg) {
    const qtyAfter = sumGrams([Number(pkg.qty), -grams]);
    stmts.push(
      db
        .prepare(`UPDATE local_inventory_items SET qty = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
        .bind(qtyAfter, ts, actor.id, pkg.id),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: pkg.id,
        field: "qty",
        old_value: String(pkg.qty),
        new_value: String(qtyAfter),
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: `${lotPagePath(screen, lot.id)}?ok=tote_voided` };
}

/** REOPEN: the queue's Demote on a drying or in-transit lot, the same code path (status back to weighing, the finish
 * stamp and the field close cleared, logged); the lot lands on its weigh screen with all its totes. */
export async function reopenFinishedLot(
  db: D1Database,
  screenKey: string,
  lotId: string,
  form: FormData
): Promise<{ redirect: string }> {
  const screen = finishedLotScreen(screenKey);
  if (!screen) throw new HttpError(404, "Unknown screen.");
  const personId = textOrNull(form.get("person_id"));
  await requireActor(db, personId);
  await requireLotPin(db, form, "Reopening a lot needs the Admin PIN.");
  const lot = await getScreenLot(db, screen, lotId);
  if (!lot) throw new HttpError(404, "That lot is not on this screen.");
  if (!LOT_REOPENABLE_STATUSES.includes(lot.status)) {
    throw new HttpError(400, "Only a drying or in-transit lot can be reopened. Ask the Scribe for a repair.");
  }
  const demote = new FormData();
  demote.set("person_id", personId ?? "");
  demote.set("id", lot.id);
  demote.set("control", "demote");
  await runQueueControl(db, "demote", demote, "wet_weight_entries");
  return { redirect: `${screen.path}?lot=${encodeURIComponent(lot.id)}&ok=lot_reopened` };
}
