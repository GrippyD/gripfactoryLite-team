/**
 * THE PREPACK (canon 0.30.188). Test-passed WPR is scheduled, then packed
 * here: a line per bag size, Finish Pack on the parent, the carry as the
 * app's own accounting. METRC sees this job's parent alone.
 */

import { HttpError, nowIso, requireReason, requireText, textOrNull } from "./audit";
import { csvCell } from "./csv";
import { newPackagesSheet, type NewPackagesLine } from "./cryo";
import { buildXlsx } from "./xlsx";
import {
  applyTransition,
  CONFIG_KEYS,
  ITEM_KIND_FG,
  PREPACK_LOCATION_DEFAULT,
  PREPACK_STATION_PATH,
  SCHEDULE_STATUS,
  SYSTEM_REASON,
  isMetrcTag,
  metrcFacingTag,
  metrcLocationName,
  formatGrams,
  metrcQuantity,
  parsePrepackItems,
  parsePrepackUnits,
  prepackItemForUnit,
  roundGrams,
} from "./config";
import { getConfigValue, insertLog, logsForInsert, requireActor } from "./db";
import { effectiveDateField, farmToday, resolveEffectiveDate } from "./effective";
import { formatLbs } from "./compliance";
import { t, type Locale } from "./i18n";
import { esc } from "./ui";

export function lastSix(value: string): string {
  const text = value.trim();
  return text.length <= 6 ? text : text.slice(-6);
}

export function ellipsisSix(value: string): string {
  return `...${lastSix(value)}`;
}

/** THE PACKAGE READS IN FOUR LINES (canon 0.30.199; owner, 2026-09-23: "whole
 * package ID, new-line market strain - weight, new-line, HBN, new-line,
 * "Location: "+[LOC]"): the one way a package is named on the Prepack
 * scheduling panes, From METRC and the station's job list. The HBN line takes
 * ready markup when the caller has more to say there (From METRC's known or
 * new from METRC); the Location line is left out when no location is known. */
export type PackageIdentity = {
  tag: string;
  strain: string | null | undefined;
  grams: number;
  hbn: string | null | undefined;
  location: string | null | undefined;
};

export function packageIdentityMarkup(id: PackageIdentity, locale: Locale, hbnMarkup?: string): string {
  const strain = String(id.strain ?? "").trim();
  const grams = `${formatGrams(id.grams)} g`;
  const hbnLine = hbnMarkup ?? (id.hbn ? esc(String(id.hbn)) : "");
  const location = String(id.location ?? "").trim();
  return `<span class="pkg-identity" data-pkg-identity>
      <span class="pkg-tag">${esc(id.tag)}</span>
      <span class="pkg-strain-grams">${esc(strain ? `${strain} - ${grams}` : grams)}</span>
      ${hbnLine ? `<span class="pkg-hbn">${hbnLine}</span>` : ""}
      ${location ? `<span class="pkg-location">${esc(t(locale, "Location"))}: ${esc(location)}</span>` : ""}
    </span>`;
}

/** Bags times the unit, whole grams, round half up. */
export function lineGrams(bags: number, unit: number): number {
  return roundGrams(bags * unit);
}

/** The carry feeds the line first, up to the line's grams. */
export function carryTake(remaining: number, grams: number): number {
  return Math.max(0, Math.min(remaining, grams));
}

export function defaultUnit(units: readonly string[], last: number | null): string {
  if (last != null) {
    const hit = units.find((unit) => Number(unit) === Number(last));
    if (hit) return hit;
  }
  return units[0] ?? "3.5";
}

type Parent = {
  id: string;
  package_code: string;
  metrc_tag: string | null;
  qty: number;
  location: string;
  farm_code: string | null;
  license_value: string | null;
  strain_id: string | null;
  harvest_batch_id: string;
  item_id: string;
};

type JobRow = {
  id: string;
  status: string;
  harvest_batch_id: string;
  hbn: string;
  strain_name: string;
  package_id: string;
  package_code: string;
  metrc_tag: string | null;
  qty: number;
  location: string | null;
};

export type PrepackLineRow = {
  id: string;
  unit_grams: number;
  bags: number;
  grams: number;
  tag: string;
  carried_grams: number;
  work_date: string;
};

export type PrepackCarry = {
  id: string;
  remaining: number;
  parent_tag: string;
  finished_on: string;
};

export type PrepackPane = {
  jobs: JobRow[];
  pick: JobRow | null;
  lines: PrepackLineRow[];
  units: string[];
  selectedUnit: string;
  carry: PrepackCarry | null;
  ask: boolean;
  location: string;
};

function personId(form: FormData): string | null {
  return textOrNull(form.get("person_id"));
}

function parentLabel(row: { metrc_tag: string | null; package_code: string }): string {
  return metrcFacingTag(row);
}

/** THE PACKAGE CARRIES ITS HBN (canon 0.30.196): a job reads its HBN from its package. */
async function loadJob(db: D1Database, id: string): Promise<JobRow | null> {
  return db
    .prepare(
      `SELECT ps.id, ps.status, p.harvest_batch_id, b.hbn, COALESCE(b.market_strain, st.name, '') AS strain_name,
              p.id AS package_id, p.package_code, li.metrc_tag, COALESCE(li.qty, 0) AS qty, li.location
       FROM production_schedules ps
       JOIN wip_packages p ON p.id = ps.wip_package_id AND p.deleted_at IS NULL
       JOIN harvest_batches b ON b.id = p.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN strains st ON st.id = b.strain_id
       LEFT JOIN local_inventory_items li ON li.id = (
         SELECT i.id FROM local_inventory_items i
         WHERE i.wip_package_id = p.id AND i.deleted_at IS NULL
         ORDER BY i.qty DESC, i.created_at ASC LIMIT 1
       )
       WHERE ps.id = ? AND ps.deleted_at IS NULL AND ps.stage = 'prepack'`
    )
    .bind(id)
    .first<JobRow>();
}

async function loadParentItem(db: D1Database, packageId: string): Promise<Parent | null> {
  return db
    .prepare(
      `SELECT p.id, p.package_code, li.metrc_tag, li.qty, li.location, li.farm_code, li.license_value,
              li.strain_id, COALESCE(p.harvest_batch_id, li.harvest_batch_id) AS harvest_batch_id, li.id AS item_id
       FROM wip_packages p
       JOIN local_inventory_items li ON li.wip_package_id = p.id AND li.deleted_at IS NULL
       WHERE p.id = ? AND p.deleted_at IS NULL
       ORDER BY li.qty DESC, li.created_at ASC LIMIT 1`
    )
    .bind(packageId)
    .first<Parent>();
}

async function openCarry(db: D1Database): Promise<PrepackCarry | null> {
  return db
    .prepare(
      `SELECT id, remaining, parent_tag, finished_on FROM prepack_carries
       WHERE deleted_at IS NULL AND status = 'open' AND remaining > 0
       ORDER BY created_at ASC LIMIT 1`
    )
    .first<PrepackCarry>();
}

async function lastUnit(db: D1Database): Promise<number | null> {
  const row = await db
    .prepare(`SELECT unit_grams FROM prepack_lines WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`)
    .first<{ unit_grams: number }>();
  return row ? Number(row.unit_grams) : null;
}

export async function loadPrepackPane(db: D1Database, pickId: string | null, ask: boolean): Promise<PrepackPane> {
  const units = parsePrepackUnits(await getConfigValue(db, CONFIG_KEYS.prepack_units));
  const location = (await getConfigValue(db, CONFIG_KEYS.prepack_location))?.trim() || PREPACK_LOCATION_DEFAULT;
  const jobsResult = await db
    .prepare(
      `SELECT ps.id, ps.status, p.harvest_batch_id, b.hbn, COALESCE(b.market_strain, st.name, '') AS strain_name,
              p.id AS package_id, p.package_code, li.metrc_tag, COALESCE(li.qty, 0) AS qty, li.location
       FROM production_schedules ps
       JOIN wip_packages p ON p.id = ps.wip_package_id AND p.deleted_at IS NULL
       JOIN harvest_batches b ON b.id = p.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN strains st ON st.id = b.strain_id
       LEFT JOIN local_inventory_items li ON li.id = (
         SELECT i.id FROM local_inventory_items i
         WHERE i.wip_package_id = p.id AND i.deleted_at IS NULL
         ORDER BY i.qty DESC, i.created_at ASC LIMIT 1
       )
       WHERE ps.deleted_at IS NULL AND ps.stage = 'prepack' AND ps.status = 'scheduled'
       ORDER BY ps.scheduled_at ASC`
    )
    .all<JobRow>();
  const jobs = jobsResult.results ?? [];
  const found = pickId ? jobs.find((job) => job.id === pickId) ?? (await loadJob(db, pickId)) : null;
  const pick = found && found.status === "scheduled" ? found : null;
  const linesResult = pick
    ? await db
        .prepare(
          `SELECT id, unit_grams, bags, grams, tag, carried_grams, work_date
           FROM prepack_lines WHERE job_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`
        )
        .bind(pick.id)
        .all<PrepackLineRow>()
    : { results: [] as PrepackLineRow[] };
  return {
    jobs,
    pick,
    lines: linesResult.results ?? [],
    units,
    selectedUnit: defaultUnit(units, await lastUnit(db)),
    carry: await openCarry(db),
    ask: ask && !!pick && Number(pick.qty) > 0,
    location,
  };
}

function jobLink(job: JobRow, selected: boolean, locale: Locale): string {
  const label = parentLabel(job);
  return `<a class="queue-pane-item${selected ? " selected" : ""}" href="${PREPACK_STATION_PATH}?pick=${esc(job.id)}" data-prepack-job="${esc(job.id)}">
      ${packageIdentityMarkup({ tag: label, strain: job.strain_name, grams: Number(job.qty), hbn: job.hbn, location: job.location }, locale)}
    </a>`;
}

function byUnit(lines: readonly PrepackLineRow[], units: readonly string[]): Array<{ unit: string; bags: number; grams: number }> {
  return units.map((unit) => {
    const rows = lines.filter((line) => Number(line.unit_grams) === Number(unit));
    return {
      unit,
      bags: rows.reduce((n, line) => n + Number(line.bags), 0),
      grams: rows.reduce((n, line) => n + Number(line.grams), 0),
    };
  });
}

export function prepackPage(pane: PrepackPane, locale: Locale, now: string, ok?: string): string {
  const left = pane.jobs.length
    ? pane.jobs.map((job) => jobLink(job, pane.pick?.id === job.id, locale)).join("")
    : `<p class="muted">${esc(t(locale, "No scheduled prepack."))}</p>`;
  const flash = ok === "line" ? `<p class="banner ok" data-prepack-flash>${esc(t(locale, "Line saved."))}</p>` : ok === "finished" ? `<p class="banner ok" data-prepack-flash>${esc(t(locale, "Pack finished."))}</p>` : "";
  let middle = `<p class="muted">${esc(t(locale, "Pick a scheduled prepack."))}</p>`;
  let right = "";
  if (pane.pick && pane.pick.status === "scheduled") {
    const label = parentLabel(pane.pick);
    const options = pane.units
      .map((unit) => `<option value="${esc(unit)}"${unit === pane.selectedUnit ? " selected" : ""}>${esc(unit)}</option>`)
      .join("");
    const carry = pane.carry
      ? `<p class="banner" data-prepack-carry="${esc(pane.carry.id)}">${esc(
          t(locale, "{grams} g carried from {tag} (finished {date}). Use it first?")
            .replace("{grams}", formatGrams(pane.carry.remaining))
            .replace("{tag}", ellipsisSix(pane.carry.parent_tag))
            .replace("{date}", pane.carry.finished_on)
        )}
          <button type="button" data-prepack-use-carry="${esc(pane.carry.id)}">${esc(t(locale, "Use it"))}</button>
          <button type="button" data-prepack-skip-carry>${esc(t(locale, "Not now"))}</button>
        </p>`
      : "";
    const ask = pane.ask
      ? `<form method="post" action="${PREPACK_STATION_PATH}/${esc(pane.pick.id)}/finish" data-prepack-ask>
          <p>${esc(
            t(locale, "{grams} g remain on {tag}. Push it onto the next pack job?")
              .replace("{grams}", formatGrams(pane.pick.qty))
              .replace("{tag}", ellipsisSix(label))
          )}</p>
          <button type="submit" name="push" value="yes">${esc(t(locale, "Yes"))}</button>
          <button type="submit" name="push" value="no">${esc(t(locale, "No"))}</button>
        </form>`
      : `<form method="post" action="${PREPACK_STATION_PATH}/${esc(pane.pick.id)}/finish">
          <button type="submit" data-prepack-finish>${esc(t(locale, "Finish Pack"))}</button>
        </form>`;
    const voids = pane.lines
      .map(
        (line) => `<li data-prepack-line="${esc(line.id)}">${esc(String(line.unit_grams))} g x ${esc(String(line.bags))} ${esc(line.tag)}
          <form method="post" action="${PREPACK_STATION_PATH}/line/${esc(line.id)}/void">
            <input type="text" name="reason" required placeholder="${esc(t(locale, "Reason"))}">
            <button type="submit">${esc(t(locale, "Void"))}</button>
          </form>
        </li>`
      )
      .join("");
    middle = `<h2 class="pkg-tag">${esc(label)}</h2>
      ${carry}
      <form class="stack" method="post" action="${PREPACK_STATION_PATH}/${esc(pane.pick.id)}/line" data-prepack-line-form>
        <input type="hidden" name="carry_id" value="" data-prepack-carry-id>
        <label class="field">${esc(t(locale, "Target Weight/Unit"))}
          <select name="unit_grams" required data-prepack-unit>${options}</select>
        </label>
        <label class="field">${esc(t(locale, "Bags Produced"))}
          <input type="number" name="bags" min="1" step="1" required>
        </label>
        <label class="field">${esc(t(locale, "Tag Number"))}
          <input type="text" name="tag" required autocomplete="off">
        </label>
        ${effectiveDateField(now, locale)}
        <button type="submit">${esc(t(locale, "Add line"))}</button>
      </form>
      <ul>${voids}</ul>
      ${ask}
      <script>
        (function () {
          var use = document.querySelector("[data-prepack-use-carry]");
          var skip = document.querySelector("[data-prepack-skip-carry]");
          var hold = document.querySelector("[data-prepack-carry-id]");
          var banner = document.querySelector("[data-prepack-carry]");
          if (use && hold) use.addEventListener("click", function () { hold.value = use.getAttribute("data-prepack-use-carry") || ""; });
          if (skip && banner && hold) skip.addEventListener("click", function () { banner.hidden = true; hold.value = ""; });
        })();
      </script>`;
    const groups = byUnit(pane.lines, pane.units);
    const rows = groups
      .map(
        (group) => `<tr data-prepack-size="${esc(group.unit)}"><td>${esc(group.unit)}</td><td>${esc(String(group.bags))}</td><td>${esc(formatLbs(group.grams))}</td><td>${esc(formatGrams(group.grams))}</td></tr>`
      )
      .join("");
    const total = pane.lines.reduce((n, line) => n + Number(line.grams), 0);
    right = `<table class="data" data-prepack-sizes>
        <thead><tr><th>${esc(t(locale, "Bag type"))}</th><th>${esc(t(locale, "Bags"))}</th><th>${esc(t(locale, "Lbs"))}</th><th>${esc(t(locale, "Grams"))}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p data-prepack-total>${esc(t(locale, "Total lbs produced"))}: ${esc(formatLbs(total))}</p>
      <p data-prepack-remaining>${esc(t(locale, "Grams remaining"))}: ${esc(formatGrams(pane.pick.qty))}</p>`;
  }
  return `<h1>${esc(t(locale, "Prepack"))}</h1>
    ${flash}
    <div class="station-triple" data-prepack>
      <aside class="queue-pane" data-prepack-pane="scheduled">${left}</aside>
      <section data-prepack-pane="line">${middle}</section>
      <aside data-prepack-pane="totals">${right}</aside>
    </div>`;
}

function qtyUpdate(
  db: D1Database,
  item: { item_id: string; qty: number },
  next: number,
  actorId: string,
  ts: string,
  reason: string
): D1PreparedStatement[] {
  const qty = roundGrams(next);
  if (qty === roundGrams(item.qty)) return [];
  return [
    db.prepare(`UPDATE local_inventory_items SET qty = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(qty, ts, actorId, item.item_id),
    insertLog(db, {
      record_table: "local_inventory_items",
      record_id: item.item_id,
      field: "qty",
      old_value: String(item.qty),
      new_value: String(qty),
      actor_person_id: actorId,
      reason,
      changed_at: ts,
    }),
  ];
}

async function tagTaken(db: D1Database, tag: string): Promise<boolean> {
  const upper = tag.toUpperCase();
  const item = await db
    .prepare(
      `SELECT id FROM local_inventory_items
       WHERE deleted_at IS NULL AND (upper(metrc_tag) = ? OR upper(package_code) = ?) LIMIT 1`
    )
    .bind(upper, upper)
    .first<{ id: string }>();
  if (item) return true;
  const line = await db
    .prepare(`SELECT id FROM prepack_lines WHERE deleted_at IS NULL AND upper(tag) = ? LIMIT 1`)
    .bind(upper)
    .first<{ id: string }>();
  return !!line;
}

export async function addPrepackLine(db: D1Database, jobId: string, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, personId(form));
  const job = await loadJob(db, jobId);
  if (!job || job.status !== "scheduled") throw new HttpError(404, "Unknown prepack job.");
  const units = parsePrepackUnits(await getConfigValue(db, CONFIG_KEYS.prepack_units));
  const unitText = requireText(form.get("unit_grams"), "Target Weight/Unit");
  if (!units.some((unit) => Number(unit) === Number(unitText))) throw new HttpError(400, "Pick a target weight from the list.");
  const bags = Number(requireText(form.get("bags"), "Bags Produced"));
  if (!Number.isInteger(bags) || bags < 1) throw new HttpError(400, "Bags Produced must be a whole number above zero.");
  const tag = requireText(form.get("tag"), "Tag Number").toUpperCase();
  if (!isMetrcTag(tag)) throw new HttpError(400, "The package tag must be 1A plus 22 hex characters.");
  if (await tagTaken(db, tag)) throw new HttpError(400, "That package tag is already in use.");
  const grams = lineGrams(bags, Number(unitText));
  const parent = await loadParentItem(db, job.package_id);
  if (!parent) throw new HttpError(400, "The parent has no ledger item.");
  const ts = nowIso();
  const effective = await resolveEffectiveDate(db, form, ts);
  let carried = 0;
  let carryId: string | null = null;
  let carryRemaining = 0;
  const postedCarry = textOrNull(form.get("carry_id"));
  if (postedCarry) {
    const carry = await db
      .prepare(`SELECT id, remaining, status FROM prepack_carries WHERE id = ? AND deleted_at IS NULL`)
      .bind(postedCarry)
      .first<{ id: string; remaining: number; status: string }>();
    if (!carry || carry.status !== "open") throw new HttpError(400, "That carry is not open.");
    carried = carryTake(Number(carry.remaining), grams);
    carryId = carry.id;
    carryRemaining = Number(carry.remaining);
  }
  const debit = grams - carried;
  if (roundGrams(parent.qty) < debit) throw new HttpError(400, "The parent does not have that many grams.");
  const location = (await getConfigValue(db, CONFIG_KEYS.prepack_location))?.trim() || PREPACK_LOCATION_DEFAULT;
  const lineId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO prepack_lines (
          id, job_id, parent_package_id, unit_grams, bags, grams, tag, carried_grams, carry_id, work_date, ledger_item_id,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(lineId, job.id, job.package_id, Number(unitText), bags, grams, tag, carried, carryId, effective.date, itemId, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "prepack_lines",
      lineId,
      { unit_grams: Number(unitText), bags, grams, tag, carried_grams: carried, work_date: effective.date },
      actor.id,
      SYSTEM_REASON.prepack_line,
      ts
    ),
    ...qtyUpdate(db, parent, roundGrams(parent.qty) - debit, actor.id, ts, SYSTEM_REASON.prepack_line),
    db
      .prepare(
        `INSERT INTO local_inventory_items (
          id, item_kind, package_code, metrc_tag, harvest_batch_id, wet_weight_entry_id, wip_package_id,
          strain_id, qty, uom, farm_code, license_value, location,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, 'g', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(itemId, ITEM_KIND_FG, tag, tag, parent.harvest_batch_id, parent.strain_id, grams, parent.farm_code, parent.license_value, location, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "local_inventory_items",
      itemId,
      { item_kind: ITEM_KIND_FG, metrc_tag: tag, qty: grams, location },
      actor.id,
      SYSTEM_REASON.prepack_line,
      ts
    ),
  ];
  if (carryId) {
    const left = Math.max(0, roundGrams(carryRemaining - carried));
    const status = left <= 0 ? "used" : "open";
    stmts.push(
      db.prepare(`UPDATE prepack_carries SET remaining = ?, status = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(left, status, ts, actor.id, carryId)
    );
  }
  await db.batch(stmts);
  return { redirect: `${PREPACK_STATION_PATH}?pick=${encodeURIComponent(job.id)}&ok=line` };
}

export async function voidPrepackLine(db: D1Database, lineId: string, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, personId(form));
  const reasonRaw = form.get("reason");
  const reason = requireReason(typeof reasonRaw === "string" ? reasonRaw : null);
  const line = await db
    .prepare(
      `SELECT id, job_id, parent_package_id, grams, carried_grams, carry_id, ledger_item_id
       FROM prepack_lines WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(lineId)
    .first<{ id: string; job_id: string; parent_package_id: string; grams: number; carried_grams: number; carry_id: string | null; ledger_item_id: string | null }>();
  if (!line) throw new HttpError(404, "Unknown prepack line.");
  const parent = await loadParentItem(db, line.parent_package_id);
  const ts = nowIso();
  const restore = Number(line.grams) - Number(line.carried_grams);
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(`UPDATE prepack_lines SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
      .bind(ts, actor.id, reason, ts, actor.id, line.id),
    insertLog(db, {
      record_table: "prepack_lines",
      record_id: line.id,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.prepack_void,
      changed_at: ts,
    }),
  ];
  if (parent) stmts.push(...qtyUpdate(db, parent, roundGrams(parent.qty) + restore, actor.id, ts, SYSTEM_REASON.prepack_void));
  if (line.ledger_item_id) {
    stmts.push(
      db.prepare(`UPDATE local_inventory_items SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`).bind(ts, actor.id, reason, ts, line.ledger_item_id)
    );
  }
  if (line.carry_id && Number(line.carried_grams) > 0) {
    stmts.push(
      db
        .prepare(
          `UPDATE prepack_carries SET remaining = remaining + ?, status = 'open', updated_at = ?, updated_by = ? WHERE id = ?`
        )
        .bind(Number(line.carried_grams), ts, actor.id, line.carry_id)
    );
  }
  await db.batch(stmts);
  return { redirect: `${PREPACK_STATION_PATH}?pick=${encodeURIComponent(line.job_id)}&ok=voided` };
}

export async function finishPrepack(db: D1Database, jobId: string, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, personId(form));
  const job = await loadJob(db, jobId);
  if (!job || job.status !== "scheduled") throw new HttpError(404, "Unknown prepack job.");
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM prepack_lines WHERE job_id = ? AND deleted_at IS NULL`).bind(job.id).first<{ n: number }>();
  if (Number(count?.n ?? 0) < 1) throw new HttpError(400, "Enter a line before Finish Pack.");
  const parent = await loadParentItem(db, job.package_id);
  if (!parent) throw new HttpError(400, "The parent has no ledger item.");
  const remainder = roundGrams(parent.qty);
  const push = textOrNull(form.get("push"));
  if (remainder > 0 && push !== "yes" && push !== "no") {
    return { redirect: `${PREPACK_STATION_PATH}?pick=${encodeURIComponent(job.id)}&ask=1` };
  }
  const items = parsePrepackItems(await getConfigValue(db, CONFIG_KEYS.prepack_items));
  const lines = await db
    .prepare(`SELECT unit_grams FROM prepack_lines WHERE job_id = ? AND deleted_at IS NULL`)
    .bind(job.id)
    .all<{ unit_grams: number }>();
  for (const line of lines.results ?? []) {
    if (!prepackItemForUnit(items, String(line.unit_grams))) {
      throw new HttpError(400, "That unit has no Item name. Set it in Admin, Lookups, app_config.");
    }
  }
  const ts = nowIso();
  const day = (await resolveEffectiveDate(db, form, ts)).date;
  const reason = remainder === 0 ? SYSTEM_REASON.prepack_finish : push === "yes" ? `prepack finish, ${remainder} g carried` : `prepack finish, ${remainder} g left`;
  const pkg = await db.prepare(`SELECT id, status FROM wip_packages WHERE id = ? AND deleted_at IS NULL`).bind(job.package_id).first<{ id: string; status: string }>();
  if (!pkg) throw new HttpError(404, "Unknown package.");
  let next: string;
  try {
    next = applyTransition("prepack_packed", pkg.status);
  } catch (err) {
    throw new HttpError(409, err instanceof Error ? err.message : "Invalid status transition.");
  }
  const stmts: D1PreparedStatement[] = [...qtyUpdate(db, parent, 0, actor.id, ts, reason)];
  if (push === "yes" && remainder > 0) {
    const carryId = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO prepack_carries (
            id, from_job_id, from_package_id, parent_tag, grams, remaining, status, finished_on,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(carryId, job.id, job.package_id, parentLabel(parent), remainder, remainder, day, ts, actor.id, ts, actor.id)
    );
  }
  stmts.push(
    db.prepare(`UPDATE wip_packages SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(next, ts, actor.id, pkg.id),
    insertLog(db, {
      record_table: "wip_packages",
      record_id: pkg.id,
      field: "status",
      old_value: pkg.status,
      new_value: next,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
    db
      .prepare(
        `UPDATE production_schedules SET status = ?, completed_at = ?, completed_by = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(SCHEDULE_STATUS.complete, ts, actor.id, ts, actor.id, job.id),
    insertLog(db, {
      record_table: "production_schedules",
      record_id: job.id,
      field: "status",
      old_value: SCHEDULE_STATUS.scheduled,
      new_value: SCHEDULE_STATUS.complete,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.schedule_complete,
      changed_at: ts,
    })
  );
  await db.batch(stmts);
  return { redirect: `${PREPACK_STATION_PATH}?ok=finished` };
}

export type PrepackFileLine = {
  tag: string;
  bags: number;
  grams: number;
  unit: number;
  work_date: string;
  parent_tag: string;
  location: string;
  itemName: string;
};

export function prepackNewPackagesLines(lines: readonly PrepackFileLine[]): NewPackagesLine[] {
  return lines.map((line) => ({
    tag: line.tag,
    quantity: line.bags,
    actualDate: line.work_date,
    location: metrcLocationName(line.location),
    itemName: line.itemName,
    sameItem: "no",
    unitOfMeasure: "Each",
    ingredients: [{ packageLabel: line.parent_tag, quantity: metrcQuantity(line.grams) }],
  }));
}

export function prepackFinishCsv(tag: string, actualDate: string): string {
  return `Label,ActualDate\r\n${csvCell(tag)},${csvCell(actualDate)}\r\n`;
}

async function fileLines(db: D1Database, jobId: string): Promise<{ hbn: string; parent: string; lines: PrepackFileLine[] } | null> {
  const job = await loadJob(db, jobId);
  if (!job) return null;
  const parent = await loadParentItem(db, job.package_id);
  const parentTag = parent ? parentLabel(parent) : parentLabel(job);
  const location = (await getConfigValue(db, CONFIG_KEYS.prepack_location))?.trim() || PREPACK_LOCATION_DEFAULT;
  const items = parsePrepackItems(await getConfigValue(db, CONFIG_KEYS.prepack_items));
  const rows = await db
    .prepare(`SELECT tag, bags, grams, unit_grams, work_date FROM prepack_lines WHERE job_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`)
    .bind(jobId)
    .all<{ tag: string; bags: number; grams: number; unit_grams: number; work_date: string }>();
  const lines: PrepackFileLine[] = [];
  for (const row of rows.results ?? []) {
    const itemName = prepackItemForUnit(items, String(row.unit_grams));
    if (!itemName) throw new HttpError(400, "That unit has no Item name. Set it in Admin, Lookups, app_config.");
    lines.push({
      tag: row.tag,
      bags: Number(row.bags),
      grams: Number(row.grams),
      unit: Number(row.unit_grams),
      work_date: row.work_date,
      parent_tag: parentTag,
      location,
      itemName,
    });
  }
  return { hbn: job.hbn, parent: parentTag, lines };
}

function fileStamp(hbn: string, parent: string): string {
  const safe = String(hbn).replace(/[^A-Za-z0-9._-]+/g, "_");
  return `${safe}_${lastSix(parent)}`;
}

export async function buildPrepackNewPackages(db: D1Database, jobId: string): Promise<{ bytes: Uint8Array; filename: string; harvest_batch_id: string }> {
  const built = await fileLines(db, jobId);
  if (!built) throw new HttpError(404, "Unknown prepack job.");
  const job = await loadJob(db, jobId);
  return {
    bytes: buildXlsx(newPackagesSheet(prepackNewPackagesLines(built.lines))),
    filename: `new_packages_${fileStamp(built.hbn, built.parent)}.xlsx`,
    harvest_batch_id: job?.harvest_batch_id ?? "",
  };
}

export async function buildPrepackFinishCsv(db: D1Database, jobId: string): Promise<{ body: string; filename: string; harvest_batch_id: string }> {
  const job = await loadJob(db, jobId);
  if (!job || job.status !== "complete") throw new HttpError(404, "Unknown prepack job.");
  const parent = await loadParentItem(db, job.package_id);
  const tag = parent ? parentLabel(parent) : parentLabel(job);
  const done = await db.prepare(`SELECT completed_at FROM production_schedules WHERE id = ?`).bind(jobId).first<{ completed_at: string | null }>();
  const day = done?.completed_at ? await farmToday(db, done.completed_at) : "";
  return {
    body: prepackFinishCsv(tag, day),
    filename: `package_finish_${fileStamp(job.hbn, tag)}.csv`,
    harvest_batch_id: job.harvest_batch_id,
  };
}

export type PendingPrepackFile = {
  id: string;
  hbn: string;
  kind: "new_packages" | "package_finish";
  filename: string;
  newest_activity: string;
};

export async function listPendingPrepackFiles(db: D1Database): Promise<PendingPrepackFile[]> {
  const result = await db
    .prepare(
      `SELECT ps.id, b.hbn, COALESCE(ps.completed_at, ps.updated_at) AS newest_activity,
              (SELECT li.metrc_tag FROM local_inventory_items li WHERE li.wip_package_id = ps.wip_package_id AND li.deleted_at IS NULL ORDER BY li.created_at ASC LIMIT 1) AS metrc_tag,
              pk.package_code,
              EXISTS (SELECT 1 FROM metrc_uploads u WHERE u.ref_id = ps.id AND u.kind = 'new_packages' AND u.deleted_at IS NULL) AS has_new,
              EXISTS (SELECT 1 FROM metrc_uploads u WHERE u.ref_id = ps.id AND u.kind = 'package_finish' AND u.deleted_at IS NULL) AS has_finish
       FROM production_schedules ps
       JOIN wip_packages pk ON pk.id = ps.wip_package_id
       JOIN harvest_batches b ON b.id = pk.harvest_batch_id AND b.deleted_at IS NULL
       WHERE ps.deleted_at IS NULL AND ps.stage = 'prepack' AND ps.status = 'complete'
         AND EXISTS (SELECT 1 FROM prepack_lines l WHERE l.job_id = ps.id AND l.deleted_at IS NULL)
       ORDER BY newest_activity DESC`
    )
    .all<{ id: string; hbn: string; newest_activity: string; metrc_tag: string | null; package_code: string; has_new: number; has_finish: number }>();
  const out: PendingPrepackFile[] = [];
  for (const row of result.results ?? []) {
    const stamp = fileStamp(row.hbn, metrcFacingTag({ metrc_tag: row.metrc_tag, package_code: row.package_code }));
    if (!row.has_new) out.push({ id: row.id, hbn: row.hbn, kind: "new_packages", filename: `new_packages_${stamp}.xlsx`, newest_activity: row.newest_activity });
    if (!row.has_finish) out.push({ id: row.id, hbn: row.hbn, kind: "package_finish", filename: `package_finish_${stamp}.csv`, newest_activity: row.newest_activity });
  }
  return out;
}
