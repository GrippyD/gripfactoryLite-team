/**
 * THE METRC MIRROR pane on the Inventory node (canon 0.30.38): the drop form,
 * what the mirror holds per license, the three pictures against one another
 * (ledger, mirror, Zoho), a tag lookup with our own fields on the record, and
 * the mounts. Server-rendered like every node; PINned with /inventory.
 *
 * THE SLICED MOUNT (canon 0.30.42): the drop form's script sends the file in
 * rounds of METRC_SLICE_ROWS rows and writes a progress line; without the
 * script the form posts once as before.
 */

import { formatGrams, formatGramsWhole } from "./config";
import { t, type Locale } from "./i18n";
import {
  fieldAppliesTo,
  METRC_PACKAGE_COLUMNS,
  METRC_PLANT_COLUMNS,
  METRC_SLICE_ROWS,
  type InternalFieldDef,
  type InternalFieldValue,
  type MetrcCrossCheck,
  type MetrcLicenseLine,
  type MetrcMountRow,
  type MetrcRecord,
} from "./metrc";
import { esc } from "./ui";

export type MetrcPaneData = {
  lines: MetrcLicenseLine[];
  mounts: MetrcMountRow[];
  cross: MetrcCrossCheck;
  licenses: Array<{ value: string; label: string }>;
  defs: InternalFieldDef[];
  tag?: string;
  record?: MetrcRecord;
  values?: InternalFieldValue[];
  ok?: string;
  mounted?: {
    kind: string;
    added: number;
    updated: number;
    gone: number;
    closed?: number;
    closedPackages?: number;
    released?: number;
    releasedPassed?: number;
    releasedFailed?: number;
  };
};

/** The mirror's column names for a record, in METRC's own words. */
const PACKAGE_FIELD_ORDER: Array<[string, string]> = [
  ["license_value", "License"],
  ["source_harvests", METRC_PACKAGE_COLUMNS[1]],
  ["source_packages", METRC_PACKAGE_COLUMNS[2]],
  ["original_source_label", METRC_PACKAGE_COLUMNS[3]],
  ["source_processing_jobs", METRC_PACKAGE_COLUMNS[4]],
  ["location", METRC_PACKAGE_COLUMNS[5]],
  ["sublocation", METRC_PACKAGE_COLUMNS[6]],
  ["item", METRC_PACKAGE_COLUMNS[7]],
  ["category", METRC_PACKAGE_COLUMNS[8]],
  ["item_strain", METRC_PACKAGE_COLUMNS[9]],
  ["quantity", METRC_PACKAGE_COLUMNS[10]],
  ["uom", METRC_PACKAGE_COLUMNS[11]],
  ["production_batch", METRC_PACKAGE_COLUMNS[12]],
  ["source_production_batch", METRC_PACKAGE_COLUMNS[13]],
  ["lab_test_status", METRC_PACKAGE_COLUMNS[14]],
  ["finished_goods", METRC_PACKAGE_COLUMNS[15]],
  ["admin_hold", METRC_PACKAGE_COLUMNS[16]],
  ["admin_recall", METRC_PACKAGE_COLUMNS[17]],
  ["packaged_date", METRC_PACKAGE_COLUMNS[18]],
  ["received_date", METRC_PACKAGE_COLUMNS[19]],
  ["expiration_date", METRC_PACKAGE_COLUMNS[20]],
  ["lab_test_expiration", METRC_PACKAGE_COLUMNS[21]],
  ["changed_at", "Mirror changed"],
  ["gone_at", "Gone from METRC"],
];

const PLANT_FIELD_ORDER: Array<[string, string]> = [
  ["license_value", "License"],
  ["phase", "Phase"],
  ["strain", METRC_PLANT_COLUMNS[1]],
  ["location", METRC_PLANT_COLUMNS[2]],
  ["sublocation", METRC_PLANT_COLUMNS[3]],
  ["hold", METRC_PLANT_COLUMNS[4]],
  ["plant_batch", METRC_PLANT_COLUMNS[5]],
  ["plant_batch_type", METRC_PLANT_COLUMNS[6]],
  ["plant_batch_date", METRC_PLANT_COLUMNS[7]],
  ["phase_date", METRC_PLANT_COLUMNS[8]],
  ["harvested", METRC_PLANT_COLUMNS[9]],
  ["changed_at", "Mirror changed"],
  ["gone_at", "Gone from METRC"],
];

const BOOL_FIELDS = new Set(["hold", "harvested", "finished_goods", "admin_hold", "admin_recall"]);

function cell(key: string, value: unknown): string {
  if (value == null || value === "") return `<span class="muted">${esc("-")}</span>`;
  if (BOOL_FIELDS.has(key)) return Number(value) === 1 ? "Yes" : "No";
  if (key === "quantity") return esc(formatGrams(Number(value)));
  return esc(String(value));
}

function flash(data: MetrcPaneData, locale: Locale): string {
  if (data.ok === "mounted" && data.mounted) {
    const m = data.mounted;
    // THE MIRROR CLOSES THE LEDGER (canon 0.30.128): the closed rows ride the same line.
    const closedItems = Number(m.closed ?? 0);
    const closedPackages = Number(m.closedPackages ?? 0);
    const closedNote =
      closedItems > 0 || closedPackages > 0
        ? ` ${esc(String(closedItems))} ${esc(t(locale, closedItems === 1 ? "ledger item" : "ledger items"))} ${esc(t(locale, "and"))} ${esc(String(closedPackages))} ${esc(t(locale, closedPackages === 1 ? "queue package" : "queue packages"))} ${esc(t(locale, "closed as gone in METRC."))}`
        : "";
    const releasedNote =
      m.kind === "packages"
        ? ` ${esc(
            t(locale, "{n} released from the Testing Queue by METRC ({passed} passed, {failed} failed).")
              .replace("{n}", String(m.released ?? 0))
              .replace("{passed}", String(m.releasedPassed ?? 0))
              .replace("{failed}", String(m.releasedFailed ?? 0))
          )}`
        : "";
    return `<p class="banner ok" data-metrc-flash>${esc(t(locale, "Mounted"))}: ${esc(t(locale, m.kind === "plants" ? "plants" : "packages"))}, ${esc(String(m.added))} ${esc(t(locale, "added"))}, ${esc(String(m.updated))} ${esc(t(locale, "updated"))}, ${esc(String(m.gone))} ${esc(t(locale, "gone"))}.<span data-metrc-closed="${esc(String(closedItems))}" data-metrc-closed-packages="${esc(String(closedPackages))}">${closedNote}</span><span data-metrc-released="${esc(String(m.released ?? 0))}">${releasedNote}</span></p>`;
  }
  if (data.ok === "field") {
    return `<p class="banner ok" data-metrc-flash>${esc(t(locale, "Field saved."))}</p>`;
  }
  return "";
}

function dropForm(data: MetrcPaneData, locale: Locale): string {
  const licOpts = [
    `<option value="">${esc(t(locale, "From the file name"))}</option>`,
    ...data.licenses.map((l) => `<option value="${esc(l.value)}">${esc(l.label)} ${esc(l.value)}</option>`),
  ].join("");
  return `<section class="metrc-drop">
    <h2>${esc(t(locale, "Mount a METRC export"))}</h2>
    <p class="muted">${esc(
      t(
        locale,
        "Drop METRC's Plants (Flowering or Vegetative) or Packages (Active) export for one license, xlsx as METRC gives it or its CSV. The file name carries the license and the grid (MetrcMichigan<license><Plants or Packages><grid>); pick them below only when it does not. The export is the truth of METRC as of the drop: rows update in place and rows the file no longer carries are marked gone."
      )
    )}</p>
    <form method="post" action="/inventory/metrc/mount" enctype="multipart/form-data" class="stack" data-metrc-mount-form
      data-slice-size="${esc(String(METRC_SLICE_ROWS))}"
      data-text-start="${esc(t(locale, "Mounting: reading the file."))}"
      data-text-progress="${esc(t(locale, "Mounting: {done} of {total} rows so far."))}"
      data-text-done="${esc(t(locale, "Mounted. Loading the mirror."))}"
      data-text-fail="${esc(t(locale, "The mount stopped:"))}">
      <label class="field">${esc(t(locale, "METRC export (xlsx or csv)"))}
        <input type="file" name="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" required>
      </label>
      <label class="field">${esc(t(locale, "License"))}
        <select name="license_value">${licOpts}</select>
      </label>
      <label class="field">${esc(t(locale, "Plants phase"))}
        <select name="phase">
          <option value="">${esc(t(locale, "From the file name"))}</option>
          <option value="flowering">${esc(t(locale, "Flowering"))}</option>
          <option value="vegetative">${esc(t(locale, "Vegetative"))}</option>
        </select>
      </label>
      <button type="submit">${esc(t(locale, "Mount export"))}</button>
      <p class="muted" data-metrc-progress hidden></p>
    </form>
    <p class="muted">${esc(t(locale, "A big export mounts in rounds of {n} rows; the line under the button counts them."))
      .replace("{n}", esc(formatGramsWhole(METRC_SLICE_ROWS)))}</p>
    ${mountRoundsScript()}
  </section>`;
}

/** The rounds: the same form re-sent with slice, slice_size and mount_id until
 * the Worker says done, then the mirror page with the flash. Plain script, no
 * framework; a browser without fetch or FormData keeps the plain post. */
function mountRoundsScript(): string {
  return `<script>(function(){
  var form = document.querySelector("[data-metrc-mount-form]");
  if (!form || !window.fetch || !window.FormData || !window.URLSearchParams) return;
  var line = form.querySelector("[data-metrc-progress]");
  var button = form.querySelector('button[type="submit"]');
  var size = Number(form.getAttribute("data-slice-size")) || 5000;
  function say(text) { line.textContent = text; line.hidden = false; }
  function fill(template, done, total) { return template.replace("{done}", Number(done).toLocaleString()).replace("{total}", Number(total).toLocaleString()); }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var slice = 0;
    var mountId = "";
    button.disabled = true;
    say(form.getAttribute("data-text-start"));
    function round() {
      var body = new FormData(form);
      body.set("slice", String(slice));
      body.set("slice_size", String(size));
      if (mountId) body.set("mount_id", mountId);
      fetch(form.getAttribute("action"), { method: "POST", body: body, credentials: "same-origin", headers: { "Accept": "application/json" } })
        .then(function (res) {
          return res.text().then(function (text) {
            var data = null;
            try { data = JSON.parse(text); } catch (e) { data = null; }
            if (!res.ok || !data || data.ok !== true) {
              throw new Error((data && data.error) || ("HTTP " + res.status));
            }
            return data;
          });
        })
        .then(function (data) {
          mountId = data.mount_id;
          if (data.done) {
            say(form.getAttribute("data-text-done"));
            window.location.assign(data.redirect);
            return;
          }
          say(fill(form.getAttribute("data-text-progress"), data.next, data.total));
          slice = data.next;
          round();
        })
        .catch(function (err) {
          say(form.getAttribute("data-text-fail") + " " + (err && err.message ? err.message : String(err)));
          button.disabled = false;
        });
    }
    round();
  });
})();</script>`;
}

function linesTable(data: MetrcPaneData, locale: Locale): string {
  if (data.lines.length === 0) {
    return `<p class="muted" data-metrc-empty>${esc(t(locale, "No METRC export mounted yet."))}</p>`;
  }
  const rows = data.lines
    .map(
      (l) => `<tr data-metrc-license="${esc(l.license_value)}">
        <td><code>${esc(l.license_value)}</code></td>
        <td>${esc(formatGramsWhole(l.plants_flowering))}</td>
        <td>${esc(formatGramsWhole(l.plants_vegetative))}</td>
        <td>${esc(formatGramsWhole(l.packages))}</td>
        <td>${esc(formatGrams(l.package_grams))}</td>
        <td>${esc(formatGramsWhole(l.package_eaches))}</td>
        <td>${esc(l.newest_mount ?? "")}</td>
      </tr>`
    )
    .join("");
  return `<table class="data metrc-lines" data-metrc-lines>
    <thead><tr>
      <th>${esc(t(locale, "License"))}</th>
      <th>${esc(t(locale, "Plants flowering"))}</th>
      <th>${esc(t(locale, "Plants vegetative"))}</th>
      <th>${esc(t(locale, "Packages"))}</th>
      <th>${esc(t(locale, "Grams"))}</th>
      <th>${esc(t(locale, "Eaches"))}</th>
      <th>${esc(t(locale, "Newest mount"))}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function crossCheck(data: MetrcPaneData, locale: Locale): string {
  const c = data.cross;
  const sample = (tags: string[]) =>
    tags.length ? `<p class="muted">${tags.map((x) => `<code>${esc(x)}</code>`).join(" ")}</p>` : "";
  return `<section class="metrc-cross" data-metrc-crosscheck>
    <h2>${esc(t(locale, "Three pictures"))}</h2>
    <dl class="lot-meta">
      <dt>${esc(t(locale, "Ledger packages with a METRC tag"))}</dt>
      <dd data-cross="ledger_tagged">${esc(String(c.ledger_tagged))} (${esc(String(c.ledger_in_metrc))} ${esc(t(locale, "in METRC"))}, ${esc(String(c.ledger_gone_in_metrc))} ${esc(t(locale, "gone in METRC"))}, ${esc(String(c.ledger_unknown_to_metrc))} ${esc(t(locale, "unknown to METRC"))})</dd>
      <dt>${esc(t(locale, "Ledger packages without a METRC tag"))}</dt>
      <dd data-cross="ledger_untagged">${esc(String(c.ledger_untagged))}</dd>
      <dt>${esc(t(locale, "METRC active packages"))}</dt>
      <dd data-cross="metrc_active">${esc(String(c.metrc_active))} (${esc(String(c.metrc_unclaimed))} ${esc(t(locale, "not claimed by the ledger"))})</dd>
      <dt>${esc(t(locale, "Zoho offerings with a METRC SKU"))}</dt>
      <dd data-cross="zoho_tagged">${esc(String(c.zoho_tagged))} (${esc(String(c.zoho_in_metrc))} ${esc(t(locale, "in METRC"))}, ${esc(String(c.zoho_not_in_metrc))} ${esc(t(locale, "not in METRC"))})</dd>
    </dl>
    ${sample(c.samples.ledger_unknown)}
    ${sample(c.samples.zoho_not_in_metrc)}
  </section>`;
}

function tagLookup(data: MetrcPaneData, locale: Locale): string {
  const form = `<form method="get" action="/inventory/metrc" class="row-actions" data-metrc-tag-form>
      <input type="text" name="tag" value="${esc(data.tag ?? "")}" placeholder="1A..." autocomplete="off" spellcheck="false" class="metrc-tag-input">
      <button type="submit" class="secondary">${esc(t(locale, "Look up"))}</button>
    </form>`;
  if (!data.tag) return `<section class="metrc-lookup"><h2>${esc(t(locale, "Look up a tag"))}</h2>${form}</section>`;
  if (!data.record) {
    return `<section class="metrc-lookup"><h2>${esc(t(locale, "Look up a tag"))}</h2>${form}
      <p class="muted" data-metrc-unknown>${esc(t(locale, "The mirror does not know that tag."))}</p></section>`;
  }
  const rec = data.record;
  const order = rec.kind === "package" ? PACKAGE_FIELD_ORDER : PLANT_FIELD_ORDER;
  const dl = order
    .map(([key, label]) => `<dt>${esc(t(locale, label))}</dt><dd data-metrc-field="${esc(key)}">${cell(key, rec.row[key])}</dd>`)
    .join("");
  const values = new Map((data.values ?? []).map((v) => [v.field_key, v]));
  const defs = data.defs.filter((d) => fieldAppliesTo(d, rec.kind));
  const fieldRows = defs
    .map((d) => {
      const current = values.get(d.key);
      return `<tr data-internal-field="${esc(d.key)}">
        <td>${esc(d.label)}</td>
        <td>${current?.value ? esc(current.value) : `<span class="muted">${esc("-")}</span>`}</td>
        <td>
          <form method="post" action="/inventory/metrc/field" class="row-actions">
            <input type="hidden" name="tag" value="${esc(String(rec.row.tag))}">
            <input type="hidden" name="field_key" value="${esc(d.key)}">
            <input type="text" name="value" value="${esc(current?.value ?? "")}" placeholder="${esc(d.label)}">
            <input type="text" name="reason" placeholder="${esc(t(locale, "reason"))}" required>
            <button type="submit" class="secondary">${esc(t(locale, "Save"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const fields =
    defs.length === 0
      ? `<p class="muted">${esc(t(locale, "No internal fields registered for this kind. Add them in Admin, Data Lookups, Internal fields."))}</p>`
      : `<table class="data internal-fields" data-internal-fields>
        <thead><tr><th>${esc(t(locale, "Field"))}</th><th>${esc(t(locale, "Value"))}</th><th>${esc(t(locale, "Set"))}</th></tr></thead>
        <tbody>${fieldRows}</tbody>
      </table>`;
  return `<section class="metrc-lookup" data-metrc-record="${esc(rec.kind)}">
    <h2>${esc(t(locale, "Look up a tag"))}</h2>
    ${form}
    <h3><code>${esc(String(rec.row.tag))}</code> <span class="muted">${esc(t(locale, rec.kind === "package" ? "METRC package" : "METRC plant"))}</span></h3>
    <dl class="lot-meta">${dl}</dl>
    <h3>${esc(t(locale, "Our fields"))}</h3>
    ${fields}
  </section>`;
}

/** A mount whose rounds have not all landed (or never did) says so beside
 * its counts: its summary still reads mounting with the rows done so far. */
export function mountRowsDone(m: Pick<MetrcMountRow, "summary">): number | null {
  try {
    const parsed = JSON.parse(m.summary || "{}") as { mounting?: unknown; rows_done?: unknown };
    if (parsed && parsed.mounting === true) return Number(parsed.rows_done ?? 0);
  } catch {
    return null;
  }
  return null;
}

function unfinishedNote(m: MetrcMountRow, locale: Locale): string {
  const done = mountRowsDone(m);
  if (done == null) return "";
  return ` <span class="muted" data-metrc-unfinished>${esc(
    t(locale, "unfinished, {done} of {total} rows").replace("{done}", formatGramsWhole(done)).replace("{total}", formatGramsWhole(m.rows_total))
  )}</span>`;
}

function mountsTable(data: MetrcPaneData, locale: Locale): string {
  if (data.mounts.length === 0) return "";
  const rows = data.mounts
    .map(
      (m) => `<tr data-metrc-mount="${esc(m.id)}">
        <td>${esc(m.created_at)}</td>
        <td>${esc(t(locale, m.kind === "plants" ? "plants" : "packages"))}${m.phase ? ` / ${esc(t(locale, m.phase === "flowering" ? "Flowering" : m.phase === "vegetative" ? "Vegetative" : m.phase))}` : ""}</td>
        <td><code>${esc(m.license_value)}</code></td>
        <td>${esc(m.filename)} <span class="muted">${esc(m.file_format)}</span></td>
        <td>${esc(formatGramsWhole(m.rows_total))}</td>
        <td>${esc(String(m.rows_added))} / ${esc(String(m.rows_updated))} / ${esc(String(m.rows_unchanged))} / ${esc(String(m.rows_gone))}${unfinishedNote(m, locale)}</td>
      </tr>`
    )
    .join("");
  return `<section class="metrc-mounts">
    <h2>${esc(t(locale, "Mounts"))}</h2>
    <table class="data" data-metrc-mounts>
      <thead><tr>
        <th>${esc(t(locale, "When"))}</th>
        <th>${esc(t(locale, "Kind"))}</th>
        <th>${esc(t(locale, "License"))}</th>
        <th>${esc(t(locale, "File"))}</th>
        <th>${esc(t(locale, "Rows"))}</th>
        <th>${esc(t(locale, "Added / updated / unchanged / gone"))}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

export function metrcPane(data: MetrcPaneData, locale: Locale): string {
  return `<p class="crumb"><a href="/inventory">${esc(t(locale, "Inventory"))}</a></p>
    <h1 title="${esc(t(locale, "The state's plants and packages by tag, exactly as METRC states them, with our own fields beside."))}">${esc(t(locale, "METRC Mirror"))}</h1>
    ${flash(data, locale)}
    <section class="metrc-holdings">
      <h2>${esc(t(locale, "What the mirror holds"))}</h2>
      ${linesTable(data, locale)}
    </section>
    ${crossCheck(data, locale)}
    ${tagLookup(data, locale)}
    ${dropForm(data, locale)}
    ${mountsTable(data, locale)}`;
}
