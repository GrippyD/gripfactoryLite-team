/**
 * DD S2b: targets, the questions page, and CSV import.
 * A GET is one db.batch. A POST reads in one batch and writes in one batch
 * (import commits in batches of at most 50 statements). A save that changes
 * nothing writes nothing. dd_phasing stays unused; phasing lives on the target row.
 */
import { HttpError, refusal, requireReason, textOrNull } from "./audit";
import { parseCsv } from "./csv";
import { insertLog, logsForInsert, requireActor } from "./db";
import {
  DIRECTOR_IMPORT_PATH,
  DIRECTOR_QUESTIONS_PATH,
  ddAllowedDimKeys,
  directorKpiPath,
  directorQuestionRulePath,
  parsePhasing,
} from "./director";
import {
  DD_CONFIG_RULES,
  DD_PERIOD_KINDS,
  DD_QUESTIONS,
  ddNormalizeConfig,
  ddPeriodKindOf,
  ddSeasonStartDate,
  type DdCadence,
  type DdConfigKey,
  type DdUnit,
} from "./directorregistry";
import { isCalendarDate, periodShift, periodStartFor } from "./farmday";
import { assertImportUpload, importBasename } from "./imports";
import { t, tFill, type Locale } from "./i18n";
import { esc } from "./ui";

const WRITE_BATCH = 50;
const IMPORT_ROW_CAP = 5000;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;
const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");

type Row = Record<string, unknown>;

function personIdFrom(form: FormData): string | null {
  return textOrNull(form.get("person_id"));
}

function resultsOf(result: unknown): Row[] {
  const rows = (result as { results?: unknown } | undefined)?.results;
  return Array.isArray(rows) ? (rows as Row[]) : [];
}

function issue(key: string, vars: Record<string, string> = {}): DdImportIssue {
  return { key, vars };
}

function filled(item: DdImportIssue, locale: Locale): string {
  return tFill(locale, item.key, item.vars);
}

function throwIssue(item: DdImportIssue): never {
  throw refusal(400, item);
}

async function runChunks(db: D1Database, stmts: D1PreparedStatement[]): Promise<void> {
  for (let i = 0; i < stmts.length; i += WRITE_BATCH) {
    const slice = stmts.slice(i, i + WRITE_BATCH);
    if (slice.length > 0) await db.batch(slice);
  }
}

function plainNumber(raw: string): number | null {
  if (!PLAIN_NUMBER.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function requirePeriodKind(raw: string | null): string {
  const kind = raw ?? "";
  if (!(DD_PERIOD_KINDS as readonly string[]).includes(kind)) {
    throw new HttpError(400, "Period kind must be day, week, month, quarter, or season.");
  }
  return kind;
}

/* --------------------------------------------------------------- targets */

export async function saveDirectorTarget(
  db: D1Database,
  kpiKey: string,
  form: FormData,
  now: string = new Date().toISOString()
): Promise<{ redirect: string }> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const read = await db.batch([
    db.prepare(`SELECT kpi_key, dims FROM dd_kpis WHERE kpi_key = ? AND active = 1`).bind(kpiKey),
    db
      .prepare(`SELECT dim_key, period_kind, effective_from FROM dd_targets WHERE kpi_key = ? AND deleted_at IS NULL`)
      .bind(kpiKey),
  ]);
  const kpi = resultsOf(read[0])[0];
  if (!kpi) throw new HttpError(404, "Unknown KPI.");
  const dim = textOrNull(form.get("dim_key")) ?? "";
  if (!ddAllowedDimKeys({ dims: String(kpi.dims ?? "") }).includes(dim)) {
    throw new HttpError(400, "That dimension is not entered for this KPI.");
  }
  const periodKind = requirePeriodKind(textOrNull(form.get("period_kind")));
  const effective = textOrNull(form.get("effective_from")) ?? "";
  if (!isCalendarDate(effective)) throw new HttpError(400, "Effective from must be a date.");
  const targetRaw = textOrNull(form.get("target")) ?? "";
  const target = plainNumber(targetRaw);
  if (target == null) throw new HttpError(400, "Target must be a plain number.");
  const lowRaw = textOrNull(form.get("low"));
  const highRaw = textOrNull(form.get("high"));
  const low = lowRaw == null ? null : plainNumber(lowRaw);
  const high = highRaw == null ? null : plainNumber(highRaw);
  if (lowRaw != null && low == null) throw new HttpError(400, "Low must be a plain number or blank.");
  if (highRaw != null && high == null) throw new HttpError(400, "High must be a plain number or blank.");
  if (low != null && high != null && low > high) throw new HttpError(400, "Low must be at most high.");
  const phasing = parsePhasing(textOrNull(form.get("phasing")), periodKind);
  const note = textOrNull(form.get("note"));
  const clash = resultsOf(read[1]).some(
    (row) => String(row.dim_key ?? "") === dim && String(row.period_kind ?? "") === periodKind && String(row.effective_from ?? "") === effective
  );
  if (clash) throw new HttpError(400, "A live target already has this KPI, dimension, period kind, and effective date.");
  const id = crypto.randomUUID();
  const record: Record<string, unknown> = {
    kpi_key: kpiKey,
    dim_key: dim,
    period_kind: periodKind,
    effective_from: effective,
    target,
    low,
    high,
    phasing,
    note,
    created_at: now,
    created_by: actor.id,
    updated_at: now,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO dd_targets (
          id, kpi_key, dim_key, period_kind, effective_from, target, low, high, phasing, note,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, kpiKey, dim, periodKind, effective, target, low, high, phasing, note, now, actor.id, now, actor.id),
    ...logsForInsert(db, "dd_targets", id, record, actor.id, reason, now),
  ]);
  return { redirect: `${directorKpiPath(kpiKey)}?ok=target` };
}

export async function voidDirectorTarget(
  db: D1Database,
  id: string,
  form: FormData,
  now: string = new Date().toISOString()
): Promise<{ redirect: string }> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const row = resultsOf(
    (
      await db.batch([db.prepare(`SELECT id, kpi_key, deleted_at FROM dd_targets WHERE id = ?`).bind(id)])
    )[0]
  )[0];
  if (!row) throw new HttpError(404, "Unknown target.");
  if (row.deleted_at != null) throw new HttpError(400, "That target is already voided.");
  await db.batch([
    db
      .prepare(`UPDATE dd_targets SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(now, actor.id, now, actor.id, id),
    insertLog(db, {
      record_table: "dd_targets",
      record_id: id,
      field: "deleted_at",
      old_value: null,
      new_value: now,
      actor_person_id: actor.id,
      reason,
      changed_at: now,
    }),
  ]);
  return { redirect: `${directorKpiPath(String(row.kpi_key))}?ok=voided` };
}

/* -------------------------------------------------------------- questions */

type QuestionRow = {
  id: string;
  question_key: string;
  kpi_keys: string;
  config_key: string | null;
  question_en: string;
  question_es: string;
  position_a: string;
  position_b: string;
  recommendation: string;
  default_value: string;
  status: string;
  ruling: string | null;
  ruled_at: string | null;
  reason: string | null;
};

export type DirectorQuestionsModel = {
  questions: QuestionRow[];
  config: Map<string, string>;
  titles: Map<string, { title_en: string; title_es: string }>;
};

function questionFrom(row: Row): QuestionRow {
  return {
    id: String(row.id ?? ""),
    question_key: String(row.question_key ?? ""),
    kpi_keys: String(row.kpi_keys ?? ""),
    config_key: row.config_key == null || String(row.config_key) === "" ? null : String(row.config_key),
    question_en: String(row.question_en ?? ""),
    question_es: String(row.question_es ?? ""),
    position_a: String(row.position_a ?? ""),
    position_b: String(row.position_b ?? ""),
    recommendation: String(row.recommendation ?? ""),
    default_value: String(row.default_value ?? ""),
    status: String(row.status ?? ""),
    ruling: row.ruling == null ? null : String(row.ruling),
    ruled_at: row.ruled_at == null ? null : String(row.ruled_at),
    reason: row.reason == null ? null : String(row.reason),
  };
}

const QUESTION_CONFIG_KEYS = [...new Set(DD_QUESTIONS.map((row) => row.config_key).filter((key): key is DdConfigKey => key != null))];

/** The questions page: one batch (the rows, their config values, the registry titles they name). */
export async function loadDirectorQuestions(db: D1Database): Promise<DirectorQuestionsModel> {
  const marks = QUESTION_CONFIG_KEYS.map(() => "?").join(", ");
  const results = await db.batch([
    db.prepare(
      `SELECT id, question_key, kpi_keys, config_key, question_en, question_es, position_a, position_b, recommendation, default_value, status, ruling, ruled_at, reason
       FROM dd_kpi_questions`
    ),
    db.prepare(`SELECT key, value FROM app_config WHERE deleted_at IS NULL AND key IN (${marks})`).bind(...QUESTION_CONFIG_KEYS),
    db.prepare(`SELECT kpi_key, title_en, title_es FROM dd_kpis WHERE active = 1`),
  ]);
  const byKey = new Map(resultsOf(results[0]).map((row) => [String(row.question_key), questionFrom(row)]));
  const questions: QuestionRow[] = [];
  for (const row of DD_QUESTIONS) {
    const found = byKey.get(row.question_key);
    if (found) questions.push(found);
  }
  for (const [key, row] of byKey) {
    if (!questions.some((item) => item.question_key === key)) questions.push(row);
  }
  const config = new Map<string, string>();
  for (const row of resultsOf(results[1])) config.set(String(row.key), String(row.value ?? ""));
  const titles = new Map<string, { title_en: string; title_es: string }>();
  for (const row of resultsOf(results[2])) {
    titles.set(String(row.kpi_key), { title_en: String(row.title_en ?? ""), title_es: String(row.title_es ?? "") });
  }
  return { questions, config, titles };
}

function statusKey(status: string): string {
  if (status === "ruled") return "Question ruled";
  if (status === "parked") return "Question parked";
  return "Question open";
}

function currentConfig(row: QuestionRow, config: Map<string, string>): string {
  if (row.config_key && config.has(row.config_key)) return config.get(row.config_key) ?? "";
  return row.default_value;
}

export function directorQuestionsPage(model: DirectorQuestionsModel, locale: Locale = "en", ok: string | null = null, focus: string | null = null): string {
  const banner =
    ok === "ruled"
      ? `<p class="banner ok" data-dd-notice="ruled">${esc(t(locale, "Ruling saved."))}</p>`
      : ok === "nochange"
        ? `<p class="banner ok" data-dd-notice="nochange">${esc(t(locale, "Nothing changed, nothing written."))}</p>`
        : "";
  const cards = model.questions
    .map((row) => {
      const question = locale === "es" && row.question_es.trim() !== "" ? row.question_es : row.question_en;
      const current = currentConfig(row, model.config);
      const rule = row.config_key ? DD_CONFIG_RULES[row.config_key] : undefined;
      const valueControl =
        rule && rule.kind === "enum"
          ? `<select name="value">${rule.values
              .map((value) => `<option value="${esc(value)}"${value === current ? " selected" : ""}>${esc(value)}</option>`)
              .join("")}</select>`
          : `<input type="text" name="value" value="${esc(current)}" autocomplete="off" required>`;
      const titles = row.kpi_keys
        .split(",")
        .map((key) => key.trim())
        .filter((key) => key !== "")
        .map((key) => {
          const title = model.titles.get(key);
          if (!title) return key;
          return locale === "es" && title.title_es.trim() !== "" ? title.title_es : title.title_en;
        });
      const ruled =
        row.status === "ruled" || row.ruled_at
          ? `<p>${esc(t(locale, "Ruled at"))}: ${esc(row.ruled_at ?? "")}. ${esc(t(locale, "Reason"))}: ${esc(row.reason ?? "")}</p>`
          : "";
      const focused = focus && row.kpi_keys.split(",").map((key) => key.trim()).includes(focus) ? "1" : "0";
      return `<article class="dd-question-card" data-dd-question="${esc(row.question_key)}" data-dd-status="${esc(row.status)}" data-dd-current="${esc(current)}" data-dd-focus="${focused}">
        <h2>${esc(question)}</h2>
        <p><b>${esc(t(locale, "Position A"))}.</b> ${esc(row.position_a)}</p>
        <p><b>${esc(t(locale, "Position B"))}.</b> ${esc(row.position_b)}</p>
        <p><b>${esc(t(locale, "Recommendation"))}.</b> ${esc(row.recommendation)}</p>
        <p>${esc(t(locale, "Default"))}: ${esc(row.default_value)}</p>
        <p>${esc(t(locale, "Current value"))}: ${esc(current)}</p>
        <p>${esc(t(locale, "Status"))}: ${esc(t(locale, statusKey(row.status)))}</p>
        ${ruled}
        <p>${esc(t(locale, "Affected KPIs"))}: ${esc(titles.join(", "))}</p>
        <form method="post" action="${esc(directorQuestionRulePath(row.question_key))}">
          <label class="field">${esc(t(locale, "Value"))}
            ${valueControl}
          </label>
          <label class="field">${esc(t(locale, "Reason"))}
            <input type="text" name="reason" required autocomplete="off">
          </label>
          <button type="submit">${esc(t(locale, "Rule"))}</button>
        </form>
      </article>`;
    })
    .join("");
  return `<div class="dd-question-list">
    ${banner}
    <h1>${esc(t(locale, "Questions"))}</h1>
    <p class="muted">${esc(t(locale, "A ruling writes the config value, bumps each named KPI, and restates open periods."))}</p>
    ${cards}
  </div>`;
}

type AffectedKpi = { kpi_key: string; cadence: DdCadence; def_version: number; season_start_md: string | null };

export async function ruleDirectorQuestion(
  db: D1Database,
  questionKey: string,
  form: FormData,
  farmToday: string,
  now: string = new Date().toISOString()
): Promise<{ redirect: string }> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const posted = String(form.get("value") ?? "");
  const read = await db.batch([
    db
      .prepare(
        `SELECT q.id, q.question_key, q.kpi_keys, q.config_key, q.ruling, q.default_value,
            c.key AS config_row_key, c.value AS config_value, c.deleted_at AS config_deleted
         FROM dd_kpi_questions q
         LEFT JOIN app_config c ON c.key = q.config_key
         WHERE q.question_key = ?`
      )
      .bind(questionKey),
    db
      .prepare(
        `SELECT k.kpi_key, k.cadence, k.def_version, k.season_start_md
         FROM dd_kpis k
         JOIN dd_kpi_questions q ON q.question_key = ?
           AND instr(',' || q.kpi_keys || ',', ',' || k.kpi_key || ',') > 0
         WHERE k.active = 1`
      )
      .bind(questionKey),
    db
      .prepare(
        `SELECT v.id, v.kpi_key, v.period_kind, v.period_start
         FROM dd_kpi_values v
         JOIN dd_kpis k ON k.kpi_key = v.kpi_key AND k.active = 1
         JOIN dd_kpi_questions q ON q.question_key = ?
           AND instr(',' || q.kpi_keys || ',', ',' || k.kpi_key || ',') > 0
         WHERE v.superseded_at IS NULL AND v.source != 'hand'`
      )
      .bind(questionKey),
    db.prepare(`SELECT value FROM app_config WHERE key = 'dd_season_start_date' AND deleted_at IS NULL`),
  ]);
  const question = resultsOf(read[0])[0];
  if (!question) throw new HttpError(404, "Unknown question.");
  const configKey = question.config_key == null ? "" : String(question.config_key);
  if (configKey === "") throw new HttpError(400, "This question has no config key.");
  const rule = DD_CONFIG_RULES[configKey];
  if (!rule) throw new HttpError(400, "This config key has no rule.");
  const checked = ddNormalizeConfig(rule, posted);
  if ("key" in checked) throw refusal(400, checked);
  const normalized = checked.value;
  const live = question.config_row_key != null && question.config_deleted == null ? String(question.config_value ?? "") : null;
  const shown = live ?? String(question.default_value ?? "");
  if (normalized === shown) return { redirect: `${DIRECTOR_QUESTIONS_PATH}?ok=nochange` };
  const kpis: AffectedKpi[] = resultsOf(read[1]).map((row) => ({
    kpi_key: String(row.kpi_key),
    cadence: String(row.cadence) as DdCadence,
    def_version: Number(row.def_version ?? 1),
    season_start_md: row.season_start_md == null ? null : String(row.season_start_md),
  }));
  const seasonStartDate = ddSeasonStartDate(resultsOf(read[3])[0]?.value == null ? null : String(resultsOf(read[3])[0]?.value));
  const openIds: string[] = [];
  const byKey = new Map(kpis.map((row) => [row.kpi_key, row]));
  for (const value of resultsOf(read[2])) {
    const kpi = byKey.get(String(value.kpi_key));
    if (!kpi) continue;
    const kind = ddPeriodKindOf(kpi.cadence);
    if (String(value.period_kind) !== kind) continue;
    const current = periodStartFor(kind, farmToday, { seasonStartDate, seasonStartMd: kpi.season_start_md });
    const prev = periodShift(kind, current, -1);
    if (String(value.period_start) >= prev) openIds.push(String(value.id));
  }
  const stmts: D1PreparedStatement[] = [];
  const kpiKeys = String(question.kpi_keys ?? "");
  if (question.config_row_key != null && question.config_deleted == null) {
    stmts.push(
      db.prepare(`UPDATE app_config SET value = ?, updated_at = ?, updated_by = ? WHERE key = ? AND deleted_at IS NULL`).bind(normalized, now, actor.id, configKey),
      insertLog(db, {
        record_table: "app_config",
        record_id: configKey,
        field: "value",
        old_value: String(question.config_value ?? ""),
        new_value: normalized,
        actor_person_id: actor.id,
        reason,
        changed_at: now,
      })
    );
  } else if (question.config_row_key != null) {
    stmts.push(
      db
        .prepare(`UPDATE app_config SET value = ?, deleted_at = NULL, deleted_by = NULL, updated_at = ?, updated_by = ? WHERE key = ?`)
        .bind(normalized, now, actor.id, configKey),
      insertLog(db, {
        record_table: "app_config",
        record_id: configKey,
        field: "deleted_at",
        old_value: question.config_deleted == null ? null : String(question.config_deleted),
        new_value: null,
        actor_person_id: actor.id,
        reason,
        changed_at: now,
      }),
      insertLog(db, {
        record_table: "app_config",
        record_id: configKey,
        field: "value",
        old_value: String(question.config_value ?? ""),
        new_value: normalized,
        actor_person_id: actor.id,
        reason,
        changed_at: now,
      })
    );
  } else {
    const record = { key: configKey, value: normalized, created_at: now, created_by: actor.id, updated_at: now, updated_by: actor.id };
    stmts.push(
      db
        .prepare(
          `INSERT INTO app_config (key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
           VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(configKey, normalized, now, actor.id, now, actor.id),
      ...logsForInsert(db, "app_config", configKey, record, actor.id, reason, now)
    );
  }
  stmts.push(
    db
      .prepare(
        `UPDATE dd_kpi_questions
         SET status = 'ruled', ruling = ?, ruled_by = ?, ruled_at = ?, reason = ?, updated_at = ?
         WHERE question_key = ?`
      )
      .bind(normalized, actor.id, now, reason, now, questionKey),
    insertLog(db, {
      record_table: "dd_kpi_questions",
      record_id: String(question.id),
      field: "ruling",
      old_value: question.ruling == null ? null : String(question.ruling),
      new_value: normalized,
      actor_person_id: actor.id,
      reason,
      changed_at: now,
    }),
    db
      .prepare(`UPDATE dd_kpis SET def_version = def_version + 1, updated_at = ? WHERE active = 1 AND instr(',' || ? || ',', ',' || kpi_key || ',') > 0`)
      .bind(now, kpiKeys)
  );
  for (const kpi of kpis) {
    stmts.push(
      insertLog(db, {
        record_table: "dd_kpis",
        record_id: kpi.kpi_key,
        field: "def_version",
        old_value: String(kpi.def_version),
        new_value: String(kpi.def_version + 1),
        actor_person_id: actor.id,
        reason,
        changed_at: now,
      })
    );
  }
  for (const id of openIds) {
    stmts.push(
      db.prepare(`UPDATE dd_kpi_values SET superseded_at = ? WHERE id = ? AND superseded_at IS NULL AND source != 'hand'`).bind(now, id),
      insertLog(db, {
        record_table: "dd_kpi_values",
        record_id: id,
        field: "superseded_at",
        old_value: null,
        new_value: now,
        actor_person_id: actor.id,
        reason,
        changed_at: now,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: `${DIRECTOR_QUESTIONS_PATH}?ok=ruled` };
}

/* ----------------------------------------------------------------- import */

export type DdImportKind = "values" | "targets";

export type DdImportIssue = { key: string; vars: Record<string, string> };

export type DdImportPreview = {
  kind: DdImportKind;
  fileError: DdImportIssue | null;
  rows: Array<{ line: number; parsed: string; error: DdImportIssue | null }>;
  ok: number;
  errors: number;
};

type ImportKpi = {
  kpi_key: string;
  title_en: string;
  unit: DdUnit;
  cadence: DdCadence;
  dims: string;
  source_kind: string;
  def_version: number;
  season_start_md: string | null;
};

type HandRow = { id: string; value: number | null; value_text: string | null };

export type DdImportContext = {
  kpis: Map<string, ImportKpi>;
  seasonStartDate: string | null;
  liveTargets: Set<string>;
  hands: Map<string, HandRow>;
};

const VALUE_REQUIRED = ["kpi_key", "period_kind", "period_start", "dim_key"];
const TARGET_REQUIRED = ["kpi_key", "dim_key", "period_kind", "effective_from", "target", "low", "high", "phasing", "note"];

function importKind(raw: string | null | undefined): DdImportKind {
  if (raw === "values" || raw === "targets") return raw;
  throw new HttpError(400, "Import kind must be values or targets.");
}

export async function loadDirectorImportContext(db: D1Database): Promise<DdImportContext> {
  const results = await db.batch([
    db.prepare(
      `SELECT kpi_key, title_en, unit, cadence, dims, source_kind, def_version, season_start_md FROM dd_kpis WHERE active = 1`
    ),
    db.prepare(`SELECT value FROM app_config WHERE key = 'dd_season_start_date' AND deleted_at IS NULL`),
    db.prepare(`SELECT kpi_key, dim_key, period_kind, effective_from FROM dd_targets WHERE deleted_at IS NULL`),
    db.prepare(
      `SELECT id, kpi_key, period_kind, period_start, dim_key, value, value_text
       FROM dd_kpi_values WHERE superseded_at IS NULL AND source = 'hand'`
    ),
  ]);
  const kpis = new Map<string, ImportKpi>();
  for (const row of resultsOf(results[0])) {
    kpis.set(String(row.kpi_key), {
      kpi_key: String(row.kpi_key),
      title_en: String(row.title_en ?? ""),
      unit: String(row.unit ?? "") as DdUnit,
      cadence: String(row.cadence ?? "") as DdCadence,
      dims: String(row.dims ?? ""),
      source_kind: String(row.source_kind ?? ""),
      def_version: Number(row.def_version ?? 1),
      season_start_md: row.season_start_md == null ? null : String(row.season_start_md),
    });
  }
  const liveTargets = new Set(
    resultsOf(results[2]).map((row) => `${row.kpi_key}|${row.dim_key ?? ""}|${row.period_kind}|${row.effective_from}`)
  );
  const hands = new Map<string, HandRow>();
  for (const row of resultsOf(results[3])) {
    const value = row.value == null ? null : Number(row.value);
    hands.set(`${row.kpi_key}|${row.period_kind}|${row.period_start}|${row.dim_key ?? ""}`, {
      id: String(row.id),
      value: value != null && Number.isFinite(value) ? value : null,
      value_text: row.value_text == null ? null : String(row.value_text),
    });
  }
  return {
    kpis,
    seasonStartDate: ddSeasonStartDate(resultsOf(results[1])[0]?.value == null ? null : String(resultsOf(results[1])[0]?.value)),
    liveTargets,
    hands,
  };
}

function headerIndex(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, index) => map.set(header.trim().toLowerCase(), index));
  return map;
}

function cell(cols: Map<string, number>, raw: string[], name: string): string {
  const at = cols.get(name);
  if (at == null) return "";
  return (raw[at] ?? "").trim();
}

function valueError(kpi: ImportKpi, raw: string): DdImportIssue | null {
  if (kpi.unit === "text") return null;
  if (!PLAIN_NUMBER.test(raw)) return issue("{title} must be a plain number.", { title: kpi.title_en });
  const n = Number(raw);
  if (!Number.isFinite(n)) return issue("{title} must be a plain number.", { title: kpi.title_en });
  if (kpi.unit === "pct" && (n < 0 || n > 100)) return issue("{title} must be a percent from 0 to 100.", { title: kpi.title_en });
  if (kpi.unit === "count" && !Number.isInteger(n)) return issue("{title} must be a whole number.", { title: kpi.title_en });
  return null;
}

export function inspectDdImport(kind: DdImportKind, text: string, ctx: DdImportContext): DdImportPreview {
  const table = parseCsv(text);
  const empty: DdImportPreview = { kind, fileError: null, rows: [], ok: 0, errors: 0 };
  if (table.length === 0) return { ...empty, fileError: issue("The CSV needs a header row.") };
  const headers = table[0].map((header) => header.trim().toLowerCase());
  if (kind === "values" && headers.includes("note")) {
    return { ...empty, fileError: issue("A values CSV cannot carry a note column.") };
  }
  const required = kind === "values" ? VALUE_REQUIRED : TARGET_REQUIRED;
  for (const name of required) {
    if (!headers.includes(name)) return { ...empty, fileError: issue("The CSV is missing a column: {name}.", { name }) };
  }
  if (kind === "values" && !headers.includes("value") && !headers.includes("value_text")) {
    return { ...empty, fileError: issue("The CSV is missing a column: {name}.", { name: "value" }) };
  }
  const data = table.slice(1);
  if (data.length > IMPORT_ROW_CAP) return { ...empty, fileError: issue("This CSV has more than 5,000 rows.") };
  const cols = headerIndex(table[0]);
  const seen = new Set<string>();
  const rows: DdImportPreview["rows"] = [];
  for (let i = 0; i < data.length; i += 1) {
    const raw = data[i];
    const line = i + 2;
    const parsed = raw.map((item) => item.trim()).join(" | ");
    const fail = (error: DdImportIssue) => rows.push({ line, parsed, error });
    if (raw.some((item) => DASH.test(item))) {
      fail(issue("A dash character is not allowed."));
      continue;
    }
    const kpiKey = cell(cols, raw, "kpi_key");
    const kpi = ctx.kpis.get(kpiKey);
    if (!kpi) {
      fail(issue("Unknown KPI."));
      continue;
    }
    const dim = cell(cols, raw, "dim_key");
    const periodKind = cell(cols, raw, "period_kind");
    const ownKind = ddPeriodKindOf(kpi.cadence);
    if (periodKind !== ownKind) {
      fail(issue("Period kind must be {kind} for this KPI.", { kind: ownKind }));
      continue;
    }
    if (!ddAllowedDimKeys(kpi).includes(dim)) {
      fail(issue("That dimension is not entered for this KPI."));
      continue;
    }
    if (kind === "values") {
      if (kpi.source_kind !== "hand" && kpi.source_kind !== "mixed") {
        fail(issue("This KPI is not a hand entry."));
        continue;
      }
      const start = cell(cols, raw, "period_start");
      const expected = periodStartFor(ownKind, start, { seasonStartDate: ctx.seasonStartDate, seasonStartMd: kpi.season_start_md });
      if (!isCalendarDate(start) || expected !== start) {
        fail(issue("Period start is not the start of that period."));
        continue;
      }
      const asOf = cols.has("source_as_of") ? cell(cols, raw, "source_as_of") : "";
      if (asOf !== "" && !isCalendarDate(asOf)) {
        fail(issue("As of must be a date."));
        continue;
      }
      if (kpi.unit === "text") {
        if (!cols.has("value_text") || cell(cols, raw, "value_text") === "") {
          fail(issue("Value is required."));
          continue;
        }
      } else {
        const rawValue = cell(cols, raw, "value");
        if (rawValue === "") {
          fail(issue("Value is required."));
          continue;
        }
        const bad = valueError(kpi, rawValue);
        if (bad) {
          fail(bad);
          continue;
        }
      }
      const key = `${kpiKey}|${periodKind}|${start}|${dim}`;
      if (seen.has(key)) {
        fail(issue("This row repeats an earlier row."));
        continue;
      }
      seen.add(key);
      rows.push({ line, parsed, error: null });
      continue;
    }
    const effective = cell(cols, raw, "effective_from");
    if (!isCalendarDate(effective)) {
      fail(issue("Effective from must be a date."));
      continue;
    }
    const targetRaw = cell(cols, raw, "target");
    if (plainNumber(targetRaw) == null) {
      fail(issue("Target must be a plain number."));
      continue;
    }
    const lowRaw = cell(cols, raw, "low");
    const highRaw = cell(cols, raw, "high");
    const low = lowRaw === "" ? null : plainNumber(lowRaw);
    const high = highRaw === "" ? null : plainNumber(highRaw);
    if (lowRaw !== "" && low == null) {
      fail(issue("Low must be a plain number or blank."));
      continue;
    }
    if (highRaw !== "" && high == null) {
      fail(issue("High must be a plain number or blank."));
      continue;
    }
    if (low != null && high != null && low > high) {
      fail(issue("Low must be at most high."));
      continue;
    }
    try {
      parsePhasing(cell(cols, raw, "phasing"), periodKind);
    } catch (err) {
      fail(issue(err instanceof HttpError ? err.message : "Phasing weights must sum to 1 or to 100."));
      continue;
    }
    const key = `${kpiKey}|${dim}|${periodKind}|${effective}`;
    if (seen.has(key)) {
      fail(issue("This row repeats an earlier row."));
      continue;
    }
    if (ctx.liveTargets.has(key)) {
      fail(issue("A live target already has this effective date."));
      continue;
    }
    seen.add(key);
    rows.push({ line, parsed, error: null });
  }
  const errors = rows.filter((row) => row.error).length;
  return { kind, fileError: null, rows, ok: rows.length - errors, errors };
}

function importForm(kind: DdImportKind, locale: Locale): string {
  const title = kind === "values" ? t(locale, "Values") : t(locale, "Targets");
  return `<form class="dd-import-form" method="post" action="${esc(DIRECTOR_IMPORT_PATH)}/preview?kind=${kind}" enctype="multipart/form-data" data-dd-import-form="${kind}">
    <h2>${esc(title)}</h2>
    <label class="field">${esc(t(locale, "Paste CSV"))}
      <textarea name="csv" rows="6" spellcheck="false"></textarea>
    </label>
    <label class="field">${esc(t(locale, "CSV file"))}
      <input type="file" name="file" accept=".csv,text/csv">
    </label>
    <label class="field">${esc(t(locale, "Reason"))}
      <input type="text" name="reason" required autocomplete="off">
    </label>
    <button type="submit">${esc(t(locale, "Preview"))}</button>
  </form>`;
}

export function directorImportPage(locale: Locale = "en", ok: string | null = null, imported = "", skipped = ""): string {
  const banner =
    ok === "imported"
      ? `<p class="banner ok" data-dd-notice="imported">${esc(tFill(locale, "Imported {n} rows. Skipped {skipped}.", { n: /^\d+$/.test(imported) ? imported : "0", skipped: /^\d+$/.test(skipped) ? skipped : "0" }))}</p>`
      : "";
  return `<div class="dd-import" data-dd-import-page>
    ${banner}
    <h1>${esc(t(locale, "Import"))}</h1>
    <p class="muted">${esc(t(locale, "Paste values or targets. Preview checks every row before anything is written."))}</p>
    ${importForm("values", locale)}
    ${importForm("targets", locale)}
  </div>`;
}

export function directorImportPreviewPage(preview: DdImportPreview, locale: Locale, csv: string, reason: string): string {
  const file = preview.fileError ? `<p class="banner err" data-dd-import-file-error>${esc(filled(preview.fileError, locale))}</p>` : "";
  const body = preview.rows
    .map(
      (row) => `<tr data-dd-import-row="${row.line}" data-dd-import-ok="${row.error ? "0" : "1"}">
        <td data-label="${esc(t(locale, "Row"))}">${row.line}</td>
        <td data-label="${esc(t(locale, "Parsed cells"))}">${esc(row.parsed)}</td>
        <td data-label="${esc(t(locale, "Error"))}">${esc(row.error ? filled(row.error, locale) : "")}</td>
      </tr>`
    )
    .join("");
  const clean = preview.fileError == null && preview.errors === 0 && preview.rows.length > 0;
  const commit = clean
    ? `<form method="post" action="${esc(DIRECTOR_IMPORT_PATH)}/commit?kind=${preview.kind}">
        <textarea name="csv" hidden>${esc(csv)}</textarea>
        <input type="hidden" name="reason" value="${esc(reason)}">
        <p>${esc(t(locale, "No errors. Commit writes the rows."))}</p>
        <button type="submit">${esc(t(locale, "Commit"))}</button>
      </form>`
    : "";
  return `<div class="dd-import" data-dd-import-preview="${esc(preview.kind)}" data-dd-import-ok-count="${preview.ok}" data-dd-import-error-count="${preview.errors}">
    <h1>${esc(t(locale, "Preview"))}</h1>
    <p><a href="${esc(DIRECTOR_IMPORT_PATH)}">${esc(t(locale, "Import"))}</a></p>
    ${file}
    <p data-dd-import-counts>${esc(t(locale, "Rows ok"))}: ${preview.ok}. ${esc(t(locale, "Rows with errors"))}: ${preview.errors}.</p>
    <div class="dd-preview">
      <div class="dd-preview-scroll">
        <table class="dd-preview-table">
          <thead><tr><th>${esc(t(locale, "Row"))}</th><th>${esc(t(locale, "Parsed cells"))}</th><th>${esc(t(locale, "Error"))}</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
    ${commit}
  </div>`;
}

export async function csvTextFromForm(form: FormData): Promise<string> {
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    const filename = importBasename(file.name);
    if (!filename) throw new HttpError(400, "A file is required.");
    const buf = new Uint8Array(await file.arrayBuffer());
    const kind = assertImportUpload(filename, buf.byteLength);
    if (kind !== "csv") throw new HttpError(400, "Drop a csv file.");
    return new TextDecoder().decode(buf);
  }
  const pasted = form.get("csv");
  if (typeof pasted === "string" && pasted.trim() !== "") return pasted;
  throw new HttpError(400, "Paste a CSV or choose a file.");
}

export async function previewDirectorImport(db: D1Database, kindRaw: string | null, form: FormData): Promise<{ preview: DdImportPreview; csv: string; reason: string }> {
  const kind = importKind(kindRaw);
  const reason = requireReason(textOrNull(form.get("reason")));
  const csv = await csvTextFromForm(form);
  const ctx = await loadDirectorImportContext(db);
  return { preview: inspectDdImport(kind, csv, ctx), csv, reason };
}

type ValueWrite = {
  kpi: ImportKpi;
  periodKind: string;
  periodStart: string;
  dim: string;
  value: number | null;
  valueText: string | null;
  sourceAsOf: string | null;
  hand: HandRow | null;
};

function handsEqual(hand: HandRow, value: number | null, valueText: string | null): boolean {
  if (valueText != null) return (hand.value_text ?? "") === valueText && hand.value == null;
  if (hand.value == null || value == null) return false;
  return Math.abs(hand.value - value) < 1e-9;
}

export async function commitDirectorImport(
  db: D1Database,
  kindRaw: string | null,
  form: FormData,
  now: string = new Date().toISOString()
): Promise<{ redirect: string }> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const kind = importKind(kindRaw);
  const csv = await csvTextFromForm(form);
  const ctx = await loadDirectorImportContext(db);
  const preview = inspectDdImport(kind, csv, ctx);
  if (preview.fileError) throwIssue(preview.fileError);
  if (preview.errors > 0) throwIssue(issue("This CSV has {n} errors. Nothing was written.", { n: String(preview.errors) }));
  const table = parseCsv(csv);
  const cols = headerIndex(table[0] ?? []);
  const stmts: D1PreparedStatement[] = [];
  let written = 0;
  let skipped = 0;
  if (kind === "values") {
    const writes: ValueWrite[] = [];
    for (const raw of table.slice(1)) {
      const kpi = ctx.kpis.get(cell(cols, raw, "kpi_key")) as ImportKpi;
      const dim = cell(cols, raw, "dim_key");
      const periodKind = cell(cols, raw, "period_kind");
      const periodStart = cell(cols, raw, "period_start");
      const asOf = cols.has("source_as_of") ? cell(cols, raw, "source_as_of") : "";
      const valueText = kpi.unit === "text" ? cell(cols, raw, "value_text") : null;
      const value = kpi.unit === "text" ? null : Number(cell(cols, raw, "value"));
      const hand = ctx.hands.get(`${kpi.kpi_key}|${periodKind}|${periodStart}|${dim}`) ?? null;
      if (hand && handsEqual(hand, value, valueText)) {
        skipped += 1;
        continue;
      }
      writes.push({ kpi, periodKind, periodStart, dim, value, valueText, sourceAsOf: asOf === "" ? null : asOf, hand });
    }
    for (const row of writes) {
      const id = crypto.randomUUID();
      if (row.hand) {
        stmts.push(
          db.prepare(`UPDATE dd_kpi_values SET superseded_at = ? WHERE id = ? AND source = 'hand' AND superseded_at IS NULL`).bind(now, row.hand.id)
        );
      }
      stmts.push(
        db
          .prepare(
            `INSERT INTO dd_kpi_values (
              id, kpi_key, period_kind, period_start, dim_key, value, value_text, goal, n, source, source_as_of, computed_at, def_version, superseded_at, entered_by, reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'hand', ?, ?, ?, NULL, ?, ?, ?)`
          )
          .bind(
            id,
            row.kpi.kpi_key,
            row.periodKind,
            row.periodStart,
            row.dim,
            row.value,
            row.valueText,
            row.sourceAsOf,
            now,
            row.kpi.def_version,
            actor.id,
            reason,
            now
          )
      );
      const oldValue = row.hand ? (row.hand.value_text != null && row.hand.value_text !== "" ? row.hand.value_text : row.hand.value == null ? null : String(row.hand.value)) : null;
      const newValue = row.valueText != null && row.valueText !== "" ? row.valueText : row.value == null ? null : String(row.value);
      stmts.push(
        insertLog(db, {
          record_table: "dd_kpi_values",
          record_id: id,
          field: "value",
          old_value: oldValue,
          new_value: newValue,
          actor_person_id: actor.id,
          reason,
          changed_at: now,
        })
      );
      written += 1;
    }
  } else {
    for (const raw of table.slice(1)) {
      const kpi = ctx.kpis.get(cell(cols, raw, "kpi_key")) as ImportKpi;
      const dim = cell(cols, raw, "dim_key");
      const periodKind = cell(cols, raw, "period_kind");
      const effective = cell(cols, raw, "effective_from");
      const target = Number(cell(cols, raw, "target"));
      const lowRaw = cell(cols, raw, "low");
      const highRaw = cell(cols, raw, "high");
      const low = lowRaw === "" ? null : Number(lowRaw);
      const high = highRaw === "" ? null : Number(highRaw);
      const phasing = parsePhasing(cell(cols, raw, "phasing"), periodKind);
      const note = cell(cols, raw, "note");
      const id = crypto.randomUUID();
      const record: Record<string, unknown> = {
        kpi_key: kpi.kpi_key,
        dim_key: dim,
        period_kind: periodKind,
        effective_from: effective,
        target,
        low,
        high,
        phasing,
        note: note === "" ? null : note,
        created_at: now,
        created_by: actor.id,
        updated_at: now,
        updated_by: actor.id,
      };
      stmts.push(
        db
          .prepare(
            `INSERT INTO dd_targets (
              id, kpi_key, dim_key, period_kind, effective_from, target, low, high, phasing, note,
              created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
          )
          .bind(id, kpi.kpi_key, dim, periodKind, effective, target, low, high, phasing, note === "" ? null : note, now, actor.id, now, actor.id),
        ...logsForInsert(db, "dd_targets", id, record, actor.id, reason, now)
      );
      written += 1;
    }
  }
  await runChunks(db, stmts);
  return { redirect: `${DIRECTOR_IMPORT_PATH}?ok=imported&n=${written}&skipped=${skipped}` };
}
