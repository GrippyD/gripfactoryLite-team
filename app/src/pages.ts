import { DRY_SPACE_KINDS } from "./config";
import { EDITABLE_FIELDS, type EditFieldDef } from "./pipeline";
import { esc, personSelect } from "./html";
import type { LookupOption, PersonRow } from "./db";

export function adminPage(
  people: PersonRow[],
  personId: string,
  tables: {
    people: Record<string, unknown>[];
    farms: Record<string, unknown>[];
    strains: Record<string, unknown>[];
    dry_spaces: Record<string, unknown>[];
    package_types: Record<string, unknown>[];
  }
): string {
  const kindOpts = DRY_SPACE_KINDS.map((k) => `<option value="${k}">${k}</option>`).join("");
  // Blank scopes the space to no farm, meaning shared (owner ruling 2026-08-28).
  const farmOpts = [
    `<option value="">(shared)</option>`,
    ...tables.farms.map((f) => `<option value="${esc(f.code)}">${esc(f.code)}</option>`),
  ].join("");
  return `<h1>Lookups</h1>
    <p class="muted">People are entered here and live only in this site's database. Never commit names.</p>

    <h2>People</h2>
    ${adminTable("people", ["display_name", "is_active"], tables.people, true, personId)}
    <form class="stack" method="post" action="/admin/lookups/people">
      ${personSelect(people, personId, false)}
      <input type="hidden" name="action" value="add">
      <label class="field">Name <input type="text" name="display_name" required></label>
      <button type="submit">Add person</button>
    </form>

    <h2>Farms</h2>
    <p class="muted">Display names render on the wet weight header after the HBN. Edit to confirm or change them.</p>
    ${adminTable("farms", ["code", "display_name"], tables.farms, false, personId)}

    <h2>Strains</h2>
    ${adminTable("strains", ["name", "abbr", "hbn_code"], tables.strains, false, personId)}
    <form class="stack" method="post" action="/admin/lookups/strains">
      ${personSelect(people, personId)}
      <input type="hidden" name="action" value="add">
      <label class="field">Name <input type="text" name="name" required></label>
      <label class="field">Abbr <input type="text" name="abbr"></label>
      <label class="field">HBN code <input type="text" name="hbn_code" required></label>
      <button type="submit">Add strain</button>
    </form>

    <h2>Dry spaces</h2>
    ${adminTable("dry_spaces", ["name", "kind", "farm_code"], tables.dry_spaces, false, personId)}
    <form class="stack" method="post" action="/admin/lookups/dry_spaces">
      ${personSelect(people, personId)}
      <input type="hidden" name="action" value="add">
      <label class="field">Name <input type="text" name="name" required></label>
      <label class="field">Kind <select name="kind">${kindOpts}</select></label>
      <label class="field">Farm <select name="farm_code">${farmOpts}</select></label>
      <button type="submit">Add dry space</button>
    </form>

    <h2>Package types</h2>
    ${adminTable("package_types", ["code", "display_name", "is_bud"], tables.package_types, false, personId)}
    <form class="stack" method="post" action="/admin/lookups/package_types">
      ${personSelect(people, personId)}
      <input type="hidden" name="action" value="add">
      <label class="field">Code <input type="text" name="code" required></label>
      <label class="field">Display name <input type="text" name="display_name" required></label>
      <label class="field"><span><input type="checkbox" name="is_bud" value="1"> Is bud?</span></label>
      <button type="submit">Add package type</button>
    </form>`;
}

function adminTable(
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
  isPeople: boolean,
  personId: string
): string {
  if (rows.length === 0) return `<p class="muted">None yet.</p>`;
  const head = `<tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}<th>Controls</th></tr>`;
  const body = rows
    .map((row) => {
      const id = String(row.id);
      const cells = columns.map((c) => `<td>${esc(row[c] ?? "")}</td>`).join("");
      const deactivate = isPeople
        ? `<form method="post" action="/admin/lookups/people" class="row-actions">
             <input type="hidden" name="action" value="deactivate">
             <input type="hidden" name="person_id" value="${esc(personId)}">
             <input type="hidden" name="id" value="${esc(id)}">
             <input type="text" name="reason" placeholder="reason" required>
             <button type="submit" class="danger">Deactivate</button>
           </form>`
        : "";
      return `<tr>${cells}<td class="row-actions">
        <a class="btn secondary" href="/record/${esc(table)}/${esc(id)}/edit">Edit</a>
        <a class="btn secondary" href="/record/${esc(table)}/${esc(id)}/void">Void</a>
        ${deactivate}
      </td></tr>`;
    })
    .join("");
  return `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export function logPage(rows: Record<string, unknown>[]): string {
  const exportLink = `<p><a href="/export/record_change_log.csv">CSV export</a></p>`;
  if (rows.length === 0) return `<h1>Change log</h1>${exportLink}<p class="muted">No events yet.</p>`;
  const head =
    "<tr><th>When</th><th>Table</th><th>Record</th><th>Field</th><th>Old</th><th>New</th><th>Actor</th><th>Reason</th></tr>";
  const body = rows
    .map(
      (r) => `<tr>
        <td>${esc(r.changed_at)}</td>
        <td>${esc(r.record_table)}</td>
        <td>${esc(r.record_id)}</td>
        <td>${esc(r.field)}</td>
        <td>${esc(r.old_value)}</td>
        <td>${esc(r.new_value)}</td>
        <td>${esc(r.actor_name ?? r.actor_person_id)}</td>
        <td>${esc(r.reason)}</td>
      </tr>`
    )
    .join("");
  return `<h1>Change log</h1>${exportLink}
    <table class="data wide"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export function editPage(
  table: string,
  id: string,
  row: Record<string, unknown>,
  people: PersonRow[],
  personId: string,
  lookups: Record<string, LookupOption[]>
): string {
  const fields = EDITABLE_FIELDS[table];
  if (!fields) {
    return `<h1>Edit</h1><p class="muted">This table is not editable.</p>`;
  }
  const inputs = fields.map((f) => editInput(f, row, lookups)).join("\n");
  return `<h1>Edit ${esc(table)}</h1>
    <form class="stack" method="post" action="/record/${esc(table)}/${esc(id)}/edit">
      ${personSelect(people, personId)}
      ${inputs}
      <label class="field">Reason <input type="text" name="reason" required></label>
      <button type="submit">Save</button>
    </form>`;
}

function editInput(
  field: EditFieldDef,
  row: Record<string, unknown>,
  lookups: Record<string, LookupOption[]>
): string {
  const current = row[field.name];
  if (field.input === "checkbox") {
    const checked = current === 1 || current === "1" ? " checked" : "";
    return `<label class="field"><span><input type="checkbox" name="${esc(field.name)}" value="1"${checked}> ${esc(field.label)}</span></label>`;
  }
  if (field.input === "lookup" && field.lookup) {
    const options = lookups[field.lookup] ?? [];
    const opts = [
      field.optional ? `<option value=""></option>` : "",
      ...options.map((o) => {
        const sel = String(current ?? "") === o.value ? " selected" : "";
        return `<option value="${esc(o.value)}"${sel}>${esc(o.label)}</option>`;
      }),
    ].join("");
    return `<label class="field">${esc(field.label)}<select name="${esc(field.name)}">${opts}</select></label>`;
  }
  if (field.input === "textarea") {
    return `<label class="field">${esc(field.label)}<textarea name="${esc(field.name)}">${esc(current ?? "")}</textarea></label>`;
  }
  const extra = field.input === "number" ? ` step="0.01"` : "";
  return `<label class="field">${esc(field.label)}<input type="${field.input}" name="${esc(field.name)}" value="${esc(current ?? "")}"${extra}></label>`;
}

export function voidPage(
  table: string,
  id: string,
  people: PersonRow[],
  personId: string
): string {
  return `<h1>Void record</h1>
    <p>Soft-delete this ${esc(table)} row. It stays in the database with deleted_at set.</p>
    <form class="stack" method="post" action="/record/${esc(table)}/${esc(id)}/void">
      ${personSelect(people, personId)}
      <label class="field">Reason <input type="text" name="reason" required></label>
      <button type="submit" class="danger">Void</button>
    </form>`;
}
