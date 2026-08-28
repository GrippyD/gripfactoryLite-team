import { TEST_OUTCOMES } from "./config";
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
  people: PersonRow[];
  personId: string;
  flash?: Flash;
  minted?: string;
  body: string;
}): string {
  const theme = opts.theme === "c10" ? "c10" : "grip";
  const personOptions = [
    `<option value="">Select person</option>`,
    ...opts.people.map(
      (p) =>
        `<option value="${esc(p.id)}"${p.id === opts.personId ? " selected" : ""}>${esc(p.display_name)}</option>`
    ),
  ].join("");
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
  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(opts.title)} · Gripfactory Lite</title>
  <style>${themeStylesheet()}</style>
</head>
<body>
  <header class="app-bar">
    <div class="brand">Gripfactory Lite</div>
    <nav>
      <a href="/">Home</a>
      <a href="/admin/lookups">Admin</a>
      <a href="/log">Log</a>
    </nav>
    <form class="person-form" method="post" action="/person">
      <label class="muted" for="gf_person">Person</label>
      <select id="gf_person" name="person_id" required>${personOptions}</select>
      <button type="submit" class="secondary">Remember</button>
    </form>
  </header>
  <main>
    ${flash}
    ${minted}
    ${opts.body}
  </main>
</body>
</html>`;
}

export function personSelect(people: PersonRow[], personId: string, required = true): string {
  const opts = [
    `<option value="">Select person</option>`,
    ...people.map(
      (p) =>
        `<option value="${esc(p.id)}"${p.id === personId ? " selected" : ""}>${esc(p.display_name)}</option>`
    ),
  ].join("");
  return `<label class="field">Person
    <select name="person_id"${required ? " required" : ""}>${opts}</select>
  </label>`;
}

export function renderField(
  field: FieldDef,
  lookups: Record<string, LookupOption[]>,
  queueOptions: Record<string, QueueRow[]>,
  queuesByKey: Record<string, QueueDef>
): string {
  if (field.input === "checkbox") {
    return `<label class="field"><span><input type="checkbox" name="${esc(field.name)}" value="1"> ${esc(field.label)}</span></label>`;
  }
  if (field.input === "lookup") {
    const options = lookups[field.lookup] ?? [];
    const opts = [
      `<option value=""></option>`,
      ...options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`),
    ].join("");
    return `<label class="field">${esc(field.label)}
      <select name="${esc(field.name)}"${field.required ? " required" : ""}>${opts}</select>
    </label>`;
  }
  if (field.input === "queue_pick") {
    const q = queuesByKey[field.queue];
    const rows = queueOptions[field.queue] ?? [];
    const opts = [
      `<option value=""></option>`,
      ...rows.map((row) => {
        const label = (q?.optionFields ?? ["id"])
          .map((f) => row.values[f])
          .filter(Boolean)
          .join(" / ");
        return `<option value="${esc(row.id)}">${esc(label || row.id)}</option>`;
      }),
    ].join("");
    return `<label class="field">${esc(field.label)}
      <select name="${esc(field.name)}"${field.required ? " required" : ""}>${opts}</select>
    </label>`;
  }
  if (field.input === "textarea") {
    return `<label class="field">${esc(field.label)}
      <textarea name="${esc(field.name)}"></textarea>
    </label>`;
  }
  if (field.input === "package_rows") {
    const types = lookups.package_types ?? [];
    const typeOpts = types
      .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
      .join("");
    return `<fieldset>
      <legend>${esc(field.label)}</legend>
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
      <legend>${esc(field.label)}</legend>
      <p class="muted">Enter a cryo weight for each package to move. Leave blank to skip.</p>
      <table class="data pkg-table">
        <thead><tr><th>Package</th><th>Cryo weight (g)</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </fieldset>`;
  }
  const type = field.input;
  const extra = type === "number" ? ` step="0.01" min="0"` : "";
  return `<label class="field">${esc(field.label)}
    <input type="${type}" name="${esc(field.name)}"${field.required ? " required" : ""}${extra}>
  </label>`;
}

export function homePage(pipeline: PipelineEntry[], counts: Record<string, number>): string {
  const tiles = pipeline
    .map((entry) => {
      if (entry.kind === "queue") {
        const n = counts[entry.key] ?? 0;
        return `<a class="tile" href="/queue/${esc(entry.key)}" data-pipeline-key="${esc(entry.key)}" data-count="${n}">
          <span class="tile-kind">Queue</span>
          <span class="tile-title">${esc(entry.title)}</span>
          <span class="tile-count">${n}</span>
        </a>`;
      }
      return `<a class="tile" href="/station/${esc(entry.key)}" data-pipeline-key="${esc(entry.key)}">
        <span class="tile-kind">Station</span>
        <span class="tile-title">${esc(entry.title)}</span>
      </a>`;
    })
    .join("");
  return `<h1>Harvest queue spine</h1>
    <div class="tiles">${tiles}</div>`;
}

export function stationPage(
  station: StationDef,
  people: PersonRow[],
  personId: string,
  lookups: Record<string, LookupOption[]>,
  queueOptions: Record<string, QueueRow[]>,
  queuesByKey: Record<string, QueueDef>
): string {
  const fields = station.fields
    .map((f) => renderField(f, lookups, queueOptions, queuesByKey))
    .join("\n");
  return `<h1>${esc(station.title)}</h1>
    <form class="stack" method="post" action="/station/${esc(station.key)}">
      ${personSelect(people, personId)}
      ${fields}
      <button type="submit">Save</button>
    </form>`;
}

function controlForm(
  queue: QueueDef,
  control: QueueControlDef,
  rowId: string,
  personId: string
): string {
  if (control.key === "release") {
    const outcomes = TEST_OUTCOMES.map((o) => `<option value="${o}">${o}</option>`).join("");
    return `<form method="post" action="/queue/${esc(queue.key)}/control" class="row-actions">
      <input type="hidden" name="person_id" value="${esc(personId)}">
      <input type="hidden" name="id" value="${esc(rowId)}">
      <input type="hidden" name="control" value="release">
      <select name="outcome" required>${outcomes}</select>
      <input type="text" name="note" placeholder="note (optional)">
      <button type="submit">${esc(control.label)}</button>
    </form>`;
  }
  return `<form method="post" action="/queue/${esc(queue.key)}/control">
    <input type="hidden" name="person_id" value="${esc(personId)}">
    <input type="hidden" name="id" value="${esc(rowId)}">
    <input type="hidden" name="control" value="${esc(control.key)}">
    <button type="submit">${esc(control.label)}</button>
  </form>`;
}

export function queuePage(
  queue: QueueDef,
  rows: QueueRow[],
  personId: string
): string {
  const exportLink = `<p><a href="/export/${esc(queue.key)}.csv">CSV export</a></p>`;
  if (rows.length === 0) {
    return `<h1>${esc(queue.title)}</h1>${exportLink}<p class="muted">No rows.</p>`;
  }
  const groups = groupRows(rows, queue.groupBy);
  const sections = groups
    .map(([name, groupRows]) => {
      const heading = queue.groupBy ? `<h2>${esc(name)}</h2>` : "";
      const head = `<tr>${queue.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th>Controls</th></tr>`;
      const body = groupRows
        .map((row) => {
          const cells = queue.columns
            .map((c) => `<td>${esc(row.values[c.field] ?? "")}</td>`)
            .join("");
          const controls = [
            ...queue.rowControls.map((ctl) => controlForm(queue, ctl, row.id, personId)),
            `<a class="btn secondary" href="/record/${esc(queue.entity)}/${esc(row.id)}/edit">Edit</a>`,
            `<a class="btn secondary" href="/record/${esc(queue.entity)}/${esc(row.id)}/void">Void</a>`,
          ].join(" ");
          return `<tr>${cells}<td class="row-actions">${controls}</td></tr>`;
        })
        .join("");
      return `${heading}<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    })
    .join("");
  return `<h1>${esc(queue.title)}</h1>${exportLink}${sections}`;
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
