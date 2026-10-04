/**
 * L3 QUICK PRINT (canon 0.30.386).
 * A package ID is 24 characters: 1A4, then 16 facility characters for the
 * license, then a 5 digit numeric tail. Roll adds n to that tail and keeps
 * the width, leading zeros included. A tail that would need another digit
 * is refused. Each container's labels fill through L2's resolvers.
 */

import { nowIso, refusal, textOrNull } from "./audit";
import { CONFIG_KEYS } from "./config";
import { getConfigValue, requireActor } from "./db";
import { t, tFill, type Locale } from "./i18n";
import {
  fieldWords,
  isFieldKey,
  loadLabelFacts,
  parseDataTable,
  listDataTables,
  valueFills,
  type DataTable,
  type LabelFacts,
} from "./labeldata";
import {
  emptyLayout,
  holdsData,
  labelRunPrintHtml,
  LayoutError,
  normalizeLayout,
  ownData,
  parseLabelInches,
  resolveData,
  type LabelLayout,
} from "./labeleditor";
import { esc } from "./ui";

export const ID_LENGTH = 24;
export const FACILITY_WIDTH = 16;
export const TAIL_WIDTH = 5;
export const CONTAINER_MAX = 500;
export const LABELS_PER_MAX = 50;
export const RUN_LIST = 20;

export const PACKAGE_ID_REFUSAL =
  "A package ID is 24 characters: 1A4, the license's facility characters, and a numeric tail.";
export const ROLL_OVERFLOW = "That package ID cannot roll that far. The numeric tail would pass its width.";
export const ROLL_PIN = "Changing Roll ID to Yes needs the Admin PIN.";
export const QTY_REFUSAL = "Container Qty is a whole number from 1 to 500.";
export const PER_REFUSAL = "Labels per container is a whole number from 1 to 50.";
export const TEMPLATE_REFUSAL = "Select a template.";
export const UNKNOWN_WARNING = "This package ID is not in the app. Its fields will print blank.";
export const RUN_PRINTS = "This run prints {n} labels.";

const PACKAGE_ID_RE = /^1A4[0-9A-F]{16}[0-9]{5}$/;

export type PackageId = { ok: true; id: string } | { ok: false; key: string };

/** Trim and upper-case. A short ID, a prefix other than 1A4, or a tail that is not 5 digits is refused. */
export function readPackageId(raw: string): PackageId {
  const id = String(raw ?? "").trim().toUpperCase();
  if (!PACKAGE_ID_RE.test(id)) return { ok: false, key: PACKAGE_ID_REFUSAL };
  return { ok: true, id };
}

/** Container n (from 0) keeps the facility characters and adds n to the numeric tail. */
export function rollPackageId(id: string, n: number): string {
  const tail = id.slice(-TAIL_WIDTH);
  const next = Number(tail) + n;
  if (!Number.isInteger(n) || n < 0 || String(Math.trunc(next)).length > TAIL_WIDTH) {
    throw refusal(400, { key: ROLL_OVERFLOW, vars: {} });
  }
  return id.slice(0, ID_LENGTH - TAIL_WIDTH) + String(next).padStart(TAIL_WIDTH, "0");
}

export function readCount(raw: string, max: number, key: string): number {
  const s = String(raw ?? "").trim();
  if (!/^\d+$/.test(s)) throw refusal(400, { key, vars: {} });
  const n = Number(s);
  if (n < 1 || n > max) throw refusal(400, { key, vars: {} });
  return n;
}

export function assertRollPin(roll: boolean, entered: string | null, stored: string | null): void {
  if (!roll) return;
  if (!stored || entered !== stored) throw refusal(403, { key: ROLL_PIN, vars: {} });
}

export function containerIds(first: string, roll: boolean, qty: number): string[] {
  const ids: string[] = [];
  for (let n = 0; n < qty; n++) ids.push(roll ? rollPackageId(first, n) : first);
  return ids;
}

export function runPageCount(containers: number, per: number): number {
  return containers * per;
}

/** One fill map per printed page. Labels per container repeat that container's package. */
export function expandPages(
  ids: string[],
  per: number,
  fillsById: Map<string, Record<string, string>>
): Array<Record<string, string>> {
  const pages: Array<Record<string, string>> = [];
  for (const id of ids) {
    const fills = fillsById.get(id) ?? {};
    for (let i = 0; i < per; i++) pages.push(fills);
  }
  return pages;
}

export function layoutTokens(layout: LabelLayout): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const obj of layout.objects) {
    if (!holdsData(obj)) continue;
    const raw = obj.attach ? resolveData(layout.objects, obj.id).text : ownData(obj);
    for (const match of raw.matchAll(/\{([A-Za-z0-9_:-]+)\}/g)) {
      const token = match[1];
      if (seen.has(token)) continue;
      seen.add(token);
      found.push(token);
    }
  }
  return found;
}

export type ContainerPreview = {
  id: string;
  item: string;
  strain: string;
  unknown: boolean;
  blanks: string[];
};

function tokenLabel(token: string, tables: DataTable[], locale: Locale): string {
  if (isFieldKey(token)) return t(locale, fieldWords(token));
  const parts = token.split(":");
  if (parts[0] === "d" && parts.length === 3) {
    const table = tables.find((row) => row.id === parts[1]);
    const column = table?.columns.find((col) => col.key === parts[2]);
    if (column?.label) return column.label;
  }
  return token;
}

export function containerPreview(
  id: string,
  known: boolean,
  fills: Record<string, string>,
  tokens: string[],
  tables: DataTable[],
  locale: Locale
): ContainerPreview {
  const blanks: string[] = [];
  const seen = new Set<string>();
  const add = (label: string) => {
    if (!label || seen.has(label)) return;
    seen.add(label);
    blanks.push(label);
  };
  if (!fills.item) add(t(locale, "Item"));
  if (!fills.strain) add(t(locale, "Strain"));
  for (const token of tokens) {
    if (token === "item" || token === "strain") continue;
    if (!fills[token]) add(tokenLabel(token, tables, locale));
  }
  return { id, item: fills.item ?? "", strain: fills.strain ?? "", unknown: !known, blanks };
}

export type QuickPrintValues = {
  templateId: string;
  templateName: string;
  packageId: string;
  roll: "yes" | "no";
  containerQty: string;
  labelsPer: string;
};

export function emptyValues(): QuickPrintValues {
  return { templateId: "", templateName: "", packageId: "", roll: "no", containerQty: "1", labelsPer: "1" };
}

export function valuesFromQuery(q: { get(name: string): string | null }): QuickPrintValues {
  const roll = q.get("roll") === "yes" ? "yes" : "no";
  const containers = (q.get("containers") ?? "").trim();
  const per = (q.get("per") ?? "").trim();
  return {
    templateId: (q.get("template") ?? "").trim(),
    templateName: "",
    packageId: (q.get("package") ?? "").trim().toUpperCase(),
    roll,
    containerQty: containers || "1",
    labelsPer: per || "1",
  };
}

export function quickPrintHref(values: QuickPrintValues): string {
  const q = new URLSearchParams({
    template: values.templateId,
    package: values.packageId,
    roll: values.roll,
    containers: values.containerQty,
    per: values.labelsPer,
  });
  return `/compliance/labels/print?${q.toString()}`;
}

export type TemplateChoice = { id: string; name: string };

export type PrintRunView = {
  id: string;
  template_id: string;
  template_name: string;
  first_id: string;
  roll: number;
  container_qty: number;
  labels_per_container: number;
  actor_name: string;
  printed_at: string;
  unknown_ids_json: string;
};

const EMPTY_FACTS: LabelFacts = { packages: [], locals: [], harvests: [], samples: [] };

function qpScript(): string {
  return `(function () {
  var root = document.querySelector("[data-quick-print], [data-qp-modal]");
  if (!root) root = document;
  var input = root.querySelector("[data-qp-filter]");
  var list = root.querySelector("[data-qp-list]");
  var idInput = root.querySelector("[name=template_id]");
  function apply() {
    if (!input || !list) return;
    var q = input.value.trim().toLowerCase();
    list.querySelectorAll("[data-qp-name]").forEach(function (btn) {
      var name = (btn.getAttribute("data-qp-name") || "").toLowerCase();
      var hide = q !== "" && name.indexOf(q) < 0;
      var li = btn.closest("li");
      if (li) li.hidden = hide;
    });
  }
  if (input) input.addEventListener("input", function () {
    var typed = input.value.trim().toLowerCase();
    var match = "";
    if (list) list.querySelectorAll("[data-qp-name]").forEach(function (btn) {
      if ((btn.getAttribute("data-qp-name") || "").toLowerCase() === typed) match = btn.getAttribute("data-qp-id") || "";
    });
    if (idInput) idInput.value = match;
    apply();
  });
  if (list) list.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-qp-id]");
    if (!btn) return;
    if (input) input.value = btn.getAttribute("data-qp-name") || "";
    if (idInput) idInput.value = btn.getAttribute("data-qp-id") || "";
    apply();
  });
  var pkg = root.querySelector("[data-qp-package]");
  if (pkg) pkg.addEventListener("input", function () {
    var next = pkg.value.toUpperCase();
    if (pkg.value !== next) pkg.value = next;
  });
  var roll = root.querySelector("[data-qp-roll]");
  var pin = root.querySelector("[data-qp-pin]");
  function syncPin() {
    if (!roll || !pin) return;
    pin.hidden = roll.value !== "yes";
  }
  if (roll) roll.addEventListener("change", syncPin);
  syncPin();
  apply();
})();`;
}

export function quickPrintForm(
  locale: Locale,
  templates: TemplateChoice[],
  values: QuickPrintValues,
  opts?: { modal?: boolean }
): string {
  const picked = templates.find((row) => row.id === values.templateId) ?? null;
  const shownName = picked?.name || values.templateName;
  const options =
    templates.length === 0
      ? `<li><span class="muted">${esc(t(locale, "No templates yet."))}</span></li>`
      : templates
          .map((row) => {
            const on = row.id === values.templateId ? ' aria-selected="true"' : "";
            return `<li><button type="button" data-qp-id="${esc(row.id)}" data-qp-name="${esc(row.name)}"${on}>${esc(row.name)}</button></li>`;
          })
          .join("");
  const pinHidden = values.roll === "yes" ? "" : " hidden";
  const cancel = opts?.modal
    ? `<button type="button" data-le-close="print">${esc(t(locale, "Cancel"))}</button>`
    : "";
  return `<form class="stack qp-form" method="post" action="/compliance/labels/print" data-qp-form>
    <label>${esc(t(locale, "Template"))}
      <input type="text" data-qp-filter role="combobox" aria-autocomplete="list" aria-controls="qp-templates" autocomplete="off" value="${esc(shownName)}">
    </label>
    <ul id="qp-templates" class="qp-templates" data-qp-list role="listbox">${options}</ul>
    <input type="hidden" name="template_id" value="${esc(picked?.id ?? "")}">
    <label>${esc(t(locale, "Package ID"))}
      <input type="text" name="package_id" data-qp-package maxlength="24" autocomplete="off" spellcheck="false" value="${esc(values.packageId)}" required>
    </label>
    <label>${esc(t(locale, "Roll ID with print"))}
      <select name="roll" data-qp-roll>
        <option value="no"${values.roll === "yes" ? "" : " selected"}>${esc(t(locale, "No"))}</option>
        <option value="yes"${values.roll === "yes" ? " selected" : ""}>${esc(t(locale, "Yes"))}</option>
      </select>
    </label>
    <div data-qp-pin${pinHidden}>
      <label>${esc(t(locale, "Admin PIN"))}
        <input type="password" name="pin" inputmode="numeric" autocomplete="off">
      </label>
    </div>
    <label>${esc(t(locale, "Container Qty"))}
      <input name="container_qty" type="number" min="1" max="${CONTAINER_MAX}" step="1" value="${esc(values.containerQty)}" required>
    </label>
    <label>${esc(t(locale, "Labels per container"))}
      <input name="labels_per" type="number" min="1" max="${LABELS_PER_MAX}" step="1" value="${esc(values.labelsPer)}" required>
    </label>
    <button type="submit" name="step" value="preview">${esc(t(locale, "Preview"))}</button>
    ${cancel}
  </form>
  <script>${qpScript()}</script>`;
}

function whenPrinted(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

function unknownCount(raw: string): number {
  try {
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

export function quickPrintPage(
  locale: Locale,
  templates: TemplateChoice[],
  runs: PrintRunView[],
  values: QuickPrintValues
): string {
  const named = { ...values };
  if (!named.templateName) named.templateName = templates.find((row) => row.id === named.templateId)?.name ?? "";
  const body =
    runs.length === 0
      ? `<p class="muted">${esc(t(locale, "No runs yet."))}</p>`
      : `<table class="data"><thead><tr>
          <th>${esc(t(locale, "Printed"))}</th>
          <th>${esc(t(locale, "Template"))}</th>
          <th>${esc(t(locale, "Package ID"))}</th>
          <th>${esc(t(locale, "Roll"))}</th>
          <th>${esc(t(locale, "Containers"))}</th>
          <th>${esc(t(locale, "Labels per container"))}</th>
          <th>${esc(t(locale, "Unknown"))}</th>
          <th>${esc(t(locale, "Saved by"))}</th>
          <th></th>
        </tr></thead><tbody>${runs
          .map((run) => {
            const href = quickPrintHref({
              templateId: run.template_id,
              templateName: run.template_name,
              packageId: run.first_id,
              roll: run.roll ? "yes" : "no",
              containerQty: String(run.container_qty),
              labelsPer: String(run.labels_per_container),
            });
            return `<tr data-qp-run="${esc(run.id)}">
              <td>${esc(whenPrinted(run.printed_at))}</td>
              <td>${esc(run.template_name)}</td>
              <td><code>${esc(run.first_id)}</code></td>
              <td>${esc(t(locale, run.roll ? "Yes" : "No"))}</td>
              <td>${esc(String(run.container_qty))}</td>
              <td>${esc(String(run.labels_per_container))}</td>
              <td>${esc(String(unknownCount(run.unknown_ids_json)))}</td>
              <td>${esc(run.actor_name || t(locale, "Unknown"))}</td>
              <td><a data-qp-reprint href="${esc(href)}">${esc(t(locale, "Reprint"))}</a></td>
            </tr>`;
          })
          .join("")}</tbody></table>`;
  return `<h1>${esc(t(locale, "Quick Print"))}</h1>
    <section data-quick-print>
      ${quickPrintForm(locale, templates, named)}
      <h2>${esc(t(locale, "Recent runs"))}</h2>
      ${body}
    </section>`;
}

export function quickPrintPreviewHtml(
  locale: Locale,
  values: QuickPrintValues,
  rows: ContainerPreview[],
  pages: number,
  pin: string
): string {
  const body = rows
    .map((row) => {
      const notes: string[] = [];
      if (row.unknown) notes.push(t(locale, UNKNOWN_WARNING));
      if (row.blanks.length) notes.push(`${t(locale, "Blank fields")}: ${row.blanks.join(", ")}`);
      return `<tr data-qp-container="${esc(row.id)}"${row.unknown ? ' data-qp-unknown="1"' : ""}>
        <td><code>${esc(row.id)}</code></td>
        <td>${esc(row.item)}</td>
        <td>${esc(row.strain)}</td>
        <td>${esc(notes.join(" "))}</td>
      </tr>`;
    })
    .join("");
  const pinField = values.roll === "yes" ? `<input type="hidden" name="pin" value="${esc(pin)}">` : "";
  return `<h1>${esc(t(locale, "Quick Print"))}</h1>
    <section data-qp-preview>
      <p>${esc(tFill(locale, RUN_PRINTS, { n: String(pages) }))}</p>
      <table class="data"><thead><tr>
        <th>${esc(t(locale, "Package ID"))}</th>
        <th>${esc(t(locale, "Item"))}</th>
        <th>${esc(t(locale, "Strain"))}</th>
        <th>${esc(t(locale, "Blank fields"))}</th>
      </tr></thead><tbody>${body}</tbody></table>
      <form class="stack" method="post" action="/compliance/labels/print">
        <input type="hidden" name="template_id" value="${esc(values.templateId)}">
        <input type="hidden" name="package_id" value="${esc(values.packageId)}">
        <input type="hidden" name="roll" value="${esc(values.roll)}">
        <input type="hidden" name="container_qty" value="${esc(values.containerQty)}">
        <input type="hidden" name="labels_per" value="${esc(values.labelsPer)}">
        ${pinField}
        <button type="submit" name="step" value="print">${esc(t(locale, "Print"))}</button>
        <a href="${esc(quickPrintHref(values))}">${esc(t(locale, "Back"))}</a>
      </form>
    </section>`;
}

async function idsIn(db: D1Database, sql: string, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += 80) {
    const slice = ids.slice(i, i + 80);
    const q = sql.replace("/*ids*/", slice.map(() => "?").join(", "));
    const rows = await db
      .prepare(q)
      .bind(...slice)
      .all<{ tag: string }>();
    for (const row of rows.results ?? []) found.add(String(row.tag ?? "").trim().toUpperCase());
  }
  return found;
}

export async function knownPackageIds(db: D1Database, ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Set();
  const mirror = await idsIn(db, `SELECT tag FROM metrc_packages WHERE tag IN (/*ids*/)`, unique);
  const local = await idsIn(
    db,
    `SELECT metrc_tag AS tag FROM local_inventory_items WHERE deleted_at IS NULL AND metrc_tag IN (/*ids*/)`,
    unique
  );
  return new Set([...mirror, ...local]);
}

export type PrintRunInsert = {
  id: string;
  templateId: string;
  templateName: string;
  firstId: string;
  roll: boolean;
  containerQty: number;
  labelsPer: number;
  actorId: string;
  printedAt: string;
  unknownIds: string[];
};

/** One insert. A run is one row, not one row per label. */
export async function logPrintRun(db: D1Database, row: PrintRunInsert): Promise<void> {
  await db
    .prepare(
      `INSERT INTO label_print_runs (
        id, template_id, template_name, first_id, roll, container_qty, labels_per_container,
        actor_person_id, printed_at, unknown_ids_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      row.id,
      row.templateId,
      row.templateName,
      row.firstId,
      row.roll ? 1 : 0,
      row.containerQty,
      row.labelsPer,
      row.actorId,
      row.printedAt,
      JSON.stringify(row.unknownIds)
    )
    .run();
}

export async function listPrintRuns(db: D1Database): Promise<PrintRunView[]> {
  const found = await db
    .prepare(
      `SELECT r.id, r.template_id, r.template_name, r.first_id, r.roll, r.container_qty, r.labels_per_container,
              r.printed_at, r.unknown_ids_json, COALESCE(p.display_name, '') AS actor_name
       FROM label_print_runs r
       LEFT JOIN people p ON p.id = r.actor_person_id
       ORDER BY r.printed_at DESC, r.id DESC
       LIMIT ${RUN_LIST}`
    )
    .all<PrintRunView>();
  return found.results ?? [];
}

type PreparedRun = {
  values: QuickPrintValues;
  templateName: string;
  lengthIn: number;
  widthIn: number;
  layout: LabelLayout;
  ids: string[];
  tables: DataTable[];
  tokens: string[];
  fillsById: Map<string, Record<string, string>>;
  known: Set<string>;
  pin: string;
  locale: Locale;
};

async function prepareRun(db: D1Database, form: FormData, templates: Array<Record<string, unknown>>, locale: Locale): Promise<PreparedRun> {
  const choices: TemplateChoice[] = templates.map((row) => ({ id: String(row.id ?? ""), name: String(row.name ?? "") }));
  const templateId = textOrNull(form.get("template_id")) ?? "";
  const templateName = textOrNull(form.get("template_name")) ?? "";
  const picked =
    choices.find((row) => row.id === templateId) ??
    choices.find((row) => row.name.toLowerCase() === templateName.trim().toLowerCase()) ??
    null;
  if (!picked) throw refusal(400, { key: TEMPLATE_REFUSAL, vars: {} });
  const source = templates.find((row) => String(row.id ?? "") === picked.id) ?? null;
  if (!source) throw refusal(400, { key: TEMPLATE_REFUSAL, vars: {} });
  const read = readPackageId(String(form.get("package_id") ?? ""));
  if (!read.ok) throw refusal(400, { key: read.key, vars: {} });
  const roll = String(form.get("roll") ?? "no").trim().toLowerCase() === "yes";
  const stored = await getConfigValue(db, CONFIG_KEYS.admin_pin);
  const pin = textOrNull(form.get("pin")) ?? "";
  assertRollPin(roll, pin, stored);
  const qty = readCount(String(form.get("container_qty") ?? ""), CONTAINER_MAX, QTY_REFUSAL);
  const per = readCount(String(form.get("labels_per") ?? ""), LABELS_PER_MAX, PER_REFUSAL);
  let layout: LabelLayout = emptyLayout();
  try {
    if (source.layout_json) layout = normalizeLayout(JSON.parse(String(source.layout_json)));
  } catch (err) {
    if (err instanceof LayoutError) throw refusal(400, { key: err.message, vars: {} });
    throw refusal(400, { key: "The label could not be read.", vars: {} });
  }
  let lengthIn: number;
  let widthIn: number;
  try {
    lengthIn = parseLabelInches(source.length_in);
    widthIn = parseLabelInches(source.width_in);
  } catch (err) {
    if (err instanceof LayoutError) throw refusal(400, { key: err.message, vars: {} });
    throw err;
  }
  const ids = containerIds(read.id, roll, qty);
  const known = await knownPackageIds(db, ids);
  const tables = (await listDataTables(db)).map((row) => parseDataTable(row));
  const fillsById = new Map<string, Record<string, string>>();
  for (const id of [...new Set(ids)]) {
    const facts = known.has(id) ? await loadLabelFacts(db, id) : EMPTY_FACTS;
    fillsById.set(id, valueFills(facts, id, tables));
  }
  return {
    values: {
      templateId: picked.id,
      templateName: picked.name,
      packageId: read.id,
      roll: roll ? "yes" : "no",
      containerQty: String(qty),
      labelsPer: String(per),
    },
    templateName: picked.name,
    lengthIn,
    widthIn,
    layout,
    ids,
    tables,
    tokens: layoutTokens(layout),
    fillsById,
    known,
    pin,
    locale,
  };
}

export type QuickPrintResult = { kind: "preview"; html: string } | { kind: "print"; html: string };

export async function submitQuickPrint(
  db: D1Database,
  form: FormData,
  templates: Array<Record<string, unknown>>,
  locale: Locale
): Promise<QuickPrintResult> {
  const run = await prepareRun(db, form, templates, locale);
  const rows = run.ids.map((id) =>
    containerPreview(id, run.known.has(id), run.fillsById.get(id) ?? {}, run.tokens, run.tables, locale)
  );
  const pages = expandPages(run.ids, Number(run.values.labelsPer), run.fillsById);
  if (String(form.get("step") ?? "preview") !== "print") {
    return { kind: "preview", html: quickPrintPreviewHtml(locale, run.values, rows, pages.length, run.pin) };
  }
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const unknownIds = [...new Set(rows.filter((row) => row.unknown).map((row) => row.id))];
  await logPrintRun(db, {
    id: crypto.randomUUID(),
    templateId: run.values.templateId,
    templateName: run.templateName,
    firstId: run.values.packageId,
    roll: run.values.roll === "yes",
    containerQty: Number(run.values.containerQty),
    labelsPer: Number(run.values.labelsPer),
    actorId: actor.id,
    printedAt: nowIso(),
    unknownIds,
  });
  return {
    kind: "print",
    html: labelRunPrintHtml(run.layout, run.lengthIn, run.widthIn, run.templateName, locale, pages),
  };
}

export function choicesOf(templates: Array<Record<string, unknown>>): TemplateChoice[] {
  return templates.map((row) => ({ id: String(row.id ?? ""), name: String(row.name ?? "") }));
}
