import { TEST_OUTCOMES } from "./config";
import { t, type Locale } from "./i18n";
import type { FieldDef, PipelineEntry, QueueControlDef, QueueDef, StationDef } from "./pipeline";
import { themeStylesheet } from "./theme";
import type { LookupOption, PersonRow, QueueRow } from "./db";

export function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type Flash = { kind: "ok" | "err"; text: string };

export function layout(opts: {
  title: string;
  theme: string;
  /** The Cloudflare Access login email shown in the chrome (owner ruling 2026-08-31). */
  personEmail: string;
  flash?: Flash;
  minted?: string;
  body: string;
  locale?: Locale;
}): string {
  const theme = opts.theme === "c10" ? "c10" : "grip";
  const locale = opts.locale ?? "en";
  const flash = opts.flash
    ? `<div class="banner ${opts.flash.kind}">${esc(opts.flash.text)}</div>`
    : "";
  const minted = opts.minted
    ? `<div class="hbn-mint" id="minted-hbn">${esc(opts.minted)} <button type="button" id="copy-hbn">Copy</button></div>
       <script>
         document.getElementById("copy-hbn")?.addEventListener("click", function () {
           var t = ${JSON.stringify(opts.minted)};
           if (navigator.clipboard) navigator.clipboard.writeText(t);
         });
       </script>`
    : "";
  // Owner ruling 2026-08-28: a two-state EN/ES pill next to the person form on
  // every page; clicking a language posts /locale and returns to the same page.
  const localePill = `<form class="locale-pill" method="post" action="/locale">
      <button type="submit" name="locale" value="en" class="locale-opt${locale === "en" ? " active" : ""}" aria-pressed="${locale === "en"}">EN</button>
      <button type="submit" name="locale" value="es" class="locale-opt${locale === "es" ? " active" : ""}" aria-pressed="${locale === "es"}">ES</button>
    </form>`;
  return `<!DOCTYPE html>
<html lang="${locale}" data-theme="${theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(t(locale, opts.title))} · Gripfactory Lite</title>
  <style>${themeStylesheet()}</style>
</head>
<body>
  <header class="app-bar">
    <div class="brand">Gripfactory Lite</div>
    <nav>
      <a href="/">${esc(t(locale, "Home"))}</a>
      <a href="/admin">${esc(t(locale, "Admin"))}</a>
      <a href="/log">${esc(t(locale, "Log"))}</a>
    </nav>
    <div class="person-form muted" data-login-email>${esc(opts.personEmail)}</div>
    ${localePill}
  </header>
  <main>
    ${flash}
    ${minted}
    ${opts.body}
  </main>
</body>
</html>`;
}

/** A people picker. After the 2026-08-31 identity ruling the only caller is the
 * wet weight Lead field (name lead_person_id); audit actors come from the login. */
export function personSelect(
  people: PersonRow[],
  personId: string,
  required = true,
  label = "Person",
  name = "person_id"
): string {
  const opts = [
    `<option value="">Select person</option>`,
    ...people.map(
      (p) =>
        `<option value="${esc(p.id)}"${p.id === personId ? " selected" : ""}>${esc(p.display_name)}</option>`
    ),
  ].join("");
  return `<label class="field">${esc(label)}
    <select name="${esc(name)}"${required ? " required" : ""}>${opts}</select>
  </label>`;
}

export function renderField(
  field: FieldDef,
  lookups: Record<string, LookupOption[]>,
  queueOptions: Record<string, QueueRow[]>,
  queuesByKey: Record<string, QueueDef>,
  locale: Locale = "en"
): string {
  if (field.input === "checkbox") {
    return `<label class="field"><span><input type="checkbox" name="${esc(field.name)}" value="1"> ${esc(t(locale, field.label))}</span></label>`;
  }
  if (field.input === "lookup") {
    const options = lookups[field.lookup] ?? [];
    const opts = [
      `<option value=""></option>`,
      ...options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`),
    ].join("");
    return `<label class="field">${esc(t(locale, field.label))}
      <select name="${esc(field.name)}"${field.required ? " required" : ""}>${opts}</select>
    </label>`;
  }
  if (field.input === "queue_pick") {
    const q = queuesByKey[field.queue];
    const rows = queueOptions[field.queue] ?? [];
    const opts = [
      `<option value=""></option>`,
      ...rows.map(
        (row) => `<option value="${esc(row.id)}">${esc(queueRowLabel(q, row))}</option>`
      ),
    ].join("");
    return `<label class="field">${esc(t(locale, field.label))}
      <select name="${esc(field.name)}"${field.required ? " required" : ""}>${opts}</select>
    </label>`;
  }
  if (field.input === "textarea") {
    return `<label class="field">${esc(t(locale, field.label))}
      <textarea name="${esc(field.name)}"></textarea>
    </label>`;
  }
  if (field.input === "package_rows") {
    const types = lookups.package_types ?? [];
    const typeOpts = types
      .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
      .join("");
    return `<fieldset>
      <legend>${esc(t(locale, field.label))}</legend>
      <table class="data pkg-table" id="pkg-table">
        <thead><tr><th>Package code</th><th>Type</th><th>Weight (g)</th></tr></thead>
        <tbody id="pkg-rows">
          <tr>
            <td><input type="text" name="package_code" required></td>
            <td><select name="package_type_code" required>${typeOpts}</select></td>
            <td><input type="number" name="weight_grams" step="0.01" min="0" required></td>
          </tr>
        </tbody>
      </table>
      <p><button type="button" class="secondary" id="add-pkg">Add package</button></p>
      <script>
        document.getElementById("add-pkg")?.addEventListener("click", function () {
          var tbody = document.getElementById("pkg-rows");
          if (!tbody || !tbody.firstElementChild) return;
          var row = tbody.firstElementChild.cloneNode(true);
          row.querySelectorAll("input").forEach(function (el) { el.value = ""; });
          tbody.appendChild(row);
        });
      </script>
    </fieldset>`;
  }
  if (field.input === "move_to") {
    // Outside a ledger station's picked page this falls back to the plain dry_spaces list;
    // the ledger page renders the farm-filtered select with the Add a truck control instead.
    const options = lookups.dry_spaces ?? [];
    const opts = [
      `<option value=""></option>`,
      ...options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`),
    ].join("");
    return `<label class="field">${esc(t(locale, field.label))}
      <select name="${esc(field.name)}"${field.required ? " required" : ""}>${opts}</select>
    </label>`;
  }
  if (field.input === "cryo_weights") {
    const q = queuesByKey[field.queue];
    const rows = queueOptions[field.queue] ?? [];
    if (rows.length === 0) {
      return `<p class="muted">Cryo Queue is empty.</p>`;
    }
    const body = rows
      .map((row) => {
        const label = (q?.optionFields ?? ["package_code"])
          .map((f) => row.values[f])
          .filter(Boolean)
          .join(" / ");
        return `<tr>
          <td>${esc(label)}<input type="hidden" name="package_id" value="${esc(row.id)}"></td>
          <td><input type="number" name="cryo_weight_grams" step="0.01" min="0" placeholder="grams"></td>
        </tr>`;
      })
      .join("");
    return `<fieldset>
      <legend>${esc(t(locale, field.label))}</legend>
      <p class="muted">Enter a cryo weight for each package to move. Leave blank to skip.</p>
      <table class="data pkg-table">
        <thead><tr><th>Package</th><th>Cryo weight (g)</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </fieldset>`;
  }
  const type = field.input;
  const extra = type === "number" ? ` step="0.01" min="0"` : "";
  return `<label class="field">${esc(t(locale, field.label))}
    <input type="${type}" name="${esc(field.name)}"${field.required ? " required" : ""}${extra}>
  </label>`;
}

export function homePage(pipeline: PipelineEntry[], locale: Locale = "en"): string {
  const tiles = pipeline
    .filter((entry) => entry.surface === "home")
    .map(
      (entry) => `<a class="tile" href="/station/${esc(entry.key)}" data-pipeline-key="${esc(entry.key)}">
        <span class="tile-kind">${esc(t(locale, "Station"))}</span>
        <span class="tile-title">${esc(t(locale, entry.title))}</span>
      </a>`
    )
    .join("");
  const adminTile = `<a class="tile" href="/admin" data-pipeline-key="admin">
        <span class="tile-kind">${esc(t(locale, "Admin"))}</span>
        <span class="tile-title">${esc(t(locale, "Admin"))}</span>
      </a>`;
  // Owner ruling 2026-08-28: Interco Logistics is orange barreled; a muted stub tile after Admin.
  const intercoTile = `<a class="tile tile-stub" href="/interco" data-pipeline-key="interco">
        <span class="tile-kind">${esc(t(locale, "Admin"))}</span>
        <span class="tile-title">Interco Logistics</span>
      </a>`;
  // Owner ruling 2026-08-31: Fulfillment is PIN gated like Admin and Interco and
  // lands on the hosted SalesHelper order-form node at /fulfillment.
  const fulfillmentTile = `<a class="tile" href="/fulfillment" data-pipeline-key="fulfillment">
        <span class="tile-kind">${esc(t(locale, "Admin"))}</span>
        <span class="tile-title">${esc(t(locale, "Fulfillment"))}</span>
      </a>`;
  return `<h1>${esc(t(locale, "Harvest queue spine"))}</h1>
    <div class="tiles">${tiles}${adminTile}${intercoTile}${fulfillmentTile}</div>`;
}

/** The Interco Logistics stub (owner ruling 2026-08-28): orange barreled, no function yet. */
export function intercoPage(locale: Locale = "en"): string {
  return `<h1>Interco Logistics</h1>
    <p class="muted">${esc(t(locale, "Orange barreled. Not built yet."))}</p>`;
}

export function adminHomePage(): string {
  const buttons = [
    { href: "/admin/queues", kind: "Admin", title: "Data Queues" },
    { href: "/admin/lookups", kind: "Admin", title: "Lookups" },
    { href: "/log", kind: "Admin", title: "Change log" },
  ]
    .map(
      (b) => `<a class="tile" href="${b.href}">
        <span class="tile-kind">${b.kind}</span>
        <span class="tile-title">${b.title}</span>
      </a>`
    )
    .join("");
  return `<h1>Admin</h1>
    <div class="tiles">${buttons}</div>`;
}

function queueRowLabel(queue: QueueDef | undefined, row: QueueRow): string {
  const label = (queue?.optionFields ?? ["id"])
    .map((f) => row.values[f])
    .filter(Boolean)
    .join(" / ");
  return label || row.id;
}

function stationForm(
  station: StationDef,
  people: PersonRow[],
  personId: string,
  fields: string,
  locale: Locale
): string {
  // Owner ruling 2026-08-31: the actor is the login email, so stations carry no
  // Person picker. A station with personLabel (wet weight's Lead) keeps a picker
  // that stores on the record as lead_person_id, preselected to the login person.
  const lead = station.personLabel
    ? personSelect(people, personId, true, t(locale, station.personLabel), "lead_person_id")
    : "";
  return `<form class="stack" method="post" action="/station/${esc(station.key)}">
      ${lead}
      ${fields}
      <button type="submit">${esc(t(locale, station.submitLabel ?? "Save"))}</button>
    </form>`;
}

/** Context the ledger station's picked page needs beyond the queue rows. */
export type StationLedgerCtx = {
  farmName: string;
  moveToOptions: LookupOption[];
  resumeLots: Array<{ id: string; created_at: string; weight_grams: number }>;
};

const ADD_TRUCK_FORM_ID = "add-truck-form";

function moveToField(
  field: { name: string; label: string; required?: boolean },
  options: LookupOption[],
  locale: Locale
): string {
  const opts = [
    `<option value=""></option>`,
    ...options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`),
  ].join("");
  return `<label class="field">${esc(t(locale, field.label))}
      <span class="move-to-row">
        <select name="${esc(field.name)}"${field.required ? " required" : ""}>${opts}</select>
        <button type="submit" class="secondary" form="${ADD_TRUCK_FORM_ID}">${esc(t(locale, "Add a truck"))}</button>
      </span>
    </label>`;
}

export function stationPage(
  station: StationDef,
  people: PersonRow[],
  personId: string,
  lookups: Record<string, LookupOption[]>,
  queueOptions: Record<string, QueueRow[]>,
  queuesByKey: Record<string, QueueDef>,
  pickId?: string,
  ledgerCtx?: StationLedgerCtx,
  // Pane-only filtered rows (leftPane paneFilter); queueOptions stays the unfiltered queue.
  paneRows?: QueueRow[],
  locale: Locale = "en"
): string {
  const heading = `<h1>${esc(t(locale, station.title))}</h1>`;
  if (!station.leftPane) {
    const fields = station.fields
      .map((f) => renderField(f, lookups, queueOptions, queuesByKey, locale))
      .join("\n");
    return `${heading}
    ${stationForm(station, people, personId, fields, locale)}`;
  }
  const pane = station.leftPane;
  const queue = queuesByKey[pane.queue];
  const rows = paneRows ?? queueOptions[pane.queue] ?? [];
  const picked = pickId ? rows.find((row) => row.id === pickId) : undefined;
  const paneItems = (list: QueueRow[]) =>
    list
      .map((row) => {
        const cls = row.id === picked?.id ? "queue-pane-item selected" : "queue-pane-item";
        return `<li><a class="${cls}" href="/station/${esc(station.key)}?pick=${esc(row.id)}">${esc(queueRowLabel(queue, row))}</a></li>`;
      })
      .join("");
  let paneBody: string;
  if (rows.length === 0) {
    paneBody = `<p class="muted">${esc(t(locale, "No rows waiting."))}</p>`;
  } else if (pane.groupBy) {
    // Owner ruling 2026-08-28: groups collapse by default; the picked row's group stays open.
    paneBody = groupRows(rows, pane.groupBy)
      .map(([name, groupRows]) => {
        const open = groupRows.some((row) => row.id === picked?.id) ? " open" : "";
        return `<details class="pane-group"${open}><summary>${esc(name)} <span class="tile-count">${groupRows.length}</span></summary><ul>${paneItems(groupRows)}</ul></details>`;
      })
      .join("");
  } else {
    paneBody = `<ul>${paneItems(rows)}</ul>`;
  }
  const aside = `<aside class="queue-pane">
      <h2>${esc(t(locale, queue?.title ?? pane.queue))} <span class="tile-count">${rows.length}</span></h2>
      ${paneBody}
    </aside>`;
  if (!picked) {
    return `${heading}
    <div class="station-split">
      ${aside}
      <div class="working-pane"><p class="muted">${esc(t(locale, "Pick from the left to begin."))}</p></div>
    </div>`;
  }
  const isLedger = Boolean(station.ledger && ledgerCtx);
  const fields = station.fields
    .map((f) => {
      if (f.name === pane.pickField) {
        return `<input type="hidden" name="${esc(pane.pickField)}" value="${esc(picked.id)}">`;
      }
      if (f.input === "move_to" && isLedger) return moveToField(f, ledgerCtx!.moveToOptions, locale);
      return renderField(f, lookups, queueOptions, queuesByKey, locale);
    })
    .join("\n");
  // Owner ruling 2026-08-28: the ledger header is the HBN, a plain spaced hyphen,
  // then the farm's display name spelled out.
  const pickHeading = isLedger
    ? `${picked.values.hbn ?? picked.id} - ${ledgerCtx!.farmName}`
    : queueRowLabel(queue, picked);
  const resumeLots = isLedger ? ledgerCtx!.resumeLots : [];
  const resume =
    resumeLots.length > 0
      ? `<div class="resume-lots">
        <h3>${esc(t(locale, "Lots in progress"))}</h3>
        <ul>${resumeLots
          .map(
            (lot) =>
              `<li><a href="/station/${esc(station.key)}?lot=${esc(lot.id)}">${esc(lot.created_at)} (total ${esc(Number(lot.weight_grams).toFixed(2))} g)</a></li>`
          )
          .join("")}</ul>
      </div>`
      : "";
  // The Add a truck button inside the station form submits this sibling form (form attribute);
  // forms cannot nest.
  const addTruckForm = isLedger
    ? `<form id="${ADD_TRUCK_FORM_ID}" method="post" action="/station/${esc(station.key)}/add_truck">
        <input type="hidden" name="pick" value="${esc(picked.id)}">
      </form>`
    : "";
  return `${heading}
    <div class="station-split">
      ${aside}
      <div class="working-pane">
        <h2 class="working-pick">${esc(pickHeading)}</h2>
        ${resume}
        ${stationForm(station, people, personId, fields, locale)}
        ${addTruckForm}
      </div>
    </div>`;
}

/** The lot page (owner ruling 2026-08-28): read-only header, the Weights pane,
 * and the running total outside the pane at the bottom. */
export function lotPage(
  station: StationDef,
  lot: {
    id: string;
    hbn: string | null;
    notes: string | null;
    dry_space_name: string | null;
    lead_name: string | null;
  },
  weights: Array<{ id: string; weight_grams: number; created_at: string }>,
  farmName: string,
  total: number,
  locale: Locale = "en"
): string {
  const rows = weights
    .map(
      (w) => `<tr>
        <td>${esc(w.weight_grams)}</td>
        <td>${esc(w.created_at)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="/record/wet_weights/${esc(w.id)}/edit" title="Edit" aria-label="Edit weight">&#9998;</a>
          <a class="btn secondary" href="/record/wet_weights/${esc(w.id)}/void" title="Void" aria-label="Void weight">&times;</a>
        </td>
      </tr>`
    )
    .join("");
  const list =
    weights.length > 0
      ? `<table class="data"><thead><tr><th>Weight (g)</th><th>Added</th><th>${esc(t(locale, "Controls"))}</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p class="muted">No weights yet.</p>`;
  return `<h1>${esc(t(locale, station.title))}</h1>
    <h2 class="working-pick">${esc(lot.hbn ?? "")} - ${esc(farmName)}</h2>
    <dl class="lot-meta">
      <dt>${esc(t(locale, "Move To"))}</dt><dd>${esc(lot.dry_space_name ?? "")}</dd>
      <dt>${esc(t(locale, "Lead"))}</dt><dd>${esc(lot.lead_name ?? "")}</dd>
      <dt>${esc(t(locale, "Notes"))}</dt><dd>${esc(lot.notes ?? "")}</dd>
    </dl>
    <section class="weights-pane">
      <h3>${esc(t(locale, "Weights"))}</h3>
      <div class="weights-controls">
        <form method="post" action="/station/${esc(station.key)}/lot/${esc(lot.id)}/weights" class="row-actions">
          <input type="number" name="weight_grams" step="0.01" min="0" placeholder="grams" required autofocus>
          <button type="submit">${esc(t(locale, "Add a weight"))}</button>
        </form>
        <form method="post" action="/station/${esc(station.key)}/lot/${esc(lot.id)}/finish" class="row-actions">
          <button type="submit" class="secondary">${esc(t(locale, "Finish lot"))}</button>
        </form>
      </div>
      ${list}
    </section>
    <p class="lot-total">${esc(t(locale, "Total"))}: <strong>${esc(total.toFixed(2))}</strong> g</p>`;
}

function controlForm(
  queue: QueueDef,
  control: QueueControlDef,
  rowId: string,
  locale: Locale
): string {
  if (control.key === "release") {
    const outcomes = TEST_OUTCOMES.map((o) => `<option value="${o}">${o}</option>`).join("");
    return `<form method="post" action="/queue/${esc(queue.key)}/control" class="row-actions">
      <input type="hidden" name="id" value="${esc(rowId)}">
      <input type="hidden" name="control" value="release">
      <select name="outcome" required>${outcomes}</select>
      <input type="text" name="note" placeholder="note (optional)">
      <button type="submit">${esc(t(locale, control.label))}</button>
    </form>`;
  }
  return `<form method="post" action="/queue/${esc(queue.key)}/control">
    <input type="hidden" name="id" value="${esc(rowId)}">
    <input type="hidden" name="control" value="${esc(control.key)}">
    <button type="submit">${esc(t(locale, control.label))}</button>
  </form>`;
}

export function queueSection(
  queue: QueueDef,
  rows: QueueRow[],
  locale: Locale = "en"
): string {
  const heading = `<h2 data-pipeline-key="${esc(queue.key)}" data-count="${rows.length}">${esc(t(locale, queue.title))} <span class="tile-count">${rows.length}</span></h2>`;
  const exportLink = `<p><a href="/export/${esc(queue.key)}.csv">${esc(t(locale, "CSV export"))}</a></p>`;
  if (rows.length === 0) {
    return `<section>${heading}${exportLink}<p class="muted">${esc(t(locale, "No rows."))}</p></section>`;
  }
  const groups = groupRows(rows, queue.groupBy);
  const sections = groups
    .map(([name, groupRows]) => {
      const groupHeading = queue.groupBy ? `<h3>${esc(name)}</h3>` : "";
      const head = `<tr>${queue.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th>${esc(t(locale, "Controls"))}</th></tr>`;
      const body = groupRows
        .map((row) => {
          const cells = queue.columns
            .map((c) => `<td>${esc(row.values[c.field] ?? "")}</td>`)
            .join("");
          const controls = [
            ...queue.rowControls.map((ctl) => controlForm(queue, ctl, row.id, locale)),
            `<a class="btn secondary" href="/record/${esc(queue.entity)}/${esc(row.id)}/edit">${esc(t(locale, "Edit"))}</a>`,
            `<a class="btn secondary" href="/record/${esc(queue.entity)}/${esc(row.id)}/void">${esc(t(locale, "Void"))}</a>`,
          ].join(" ");
          return `<tr>${cells}<td class="row-actions">${controls}</td></tr>`;
        })
        .join("");
      return `${groupHeading}<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    })
    .join("");
  return `<section>${heading}${exportLink}${sections}</section>`;
}

export function dataQueuesPage(
  sections: Array<{ queue: QueueDef; rows: QueueRow[] }>,
  locale: Locale = "en"
): string {
  const body = sections.map((s) => queueSection(s.queue, s.rows, locale)).join("\n");
  return `<h1>Data Queues</h1>${body}`;
}

/** The PIN gate page (owner ruling 2026-08-31): Admin and Interco Logistics open
 * only after the PIN; one unlock holds on the device for a shift via cookie. */
export function pinPage(next: string, locale: Locale = "en", wrong = false): string {
  const error = wrong ? `<div class="banner err">${esc(t(locale, "Wrong PIN."))}</div>` : "";
  return `<h1>${esc(t(locale, "Enter PIN"))}</h1>
    ${error}
    <form class="stack" method="post" action="/pin">
      <input type="hidden" name="next" value="${esc(next)}">
      <label class="field">${esc(t(locale, "PIN"))}
        <input type="password" name="pin" inputmode="numeric" autocomplete="off" required autofocus>
      </label>
      <button type="submit">${esc(t(locale, "Unlock"))}</button>
    </form>`;
}

function groupRows(rows: QueueRow[], groupBy?: string): Array<[string, QueueRow[]]> {
  if (!groupBy) return [["", rows]];
  const map = new Map<string, QueueRow[]>();
  for (const row of rows) {
    const key = row.values[groupBy] || "(none)";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()];
}

export function errorBody(message: string): string {
  return `<h1>Could not save</h1><div class="banner err">${esc(message)}</div><p><a href="javascript:history.back()">Back</a></p>`;
}
