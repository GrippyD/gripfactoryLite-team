import { CAPACITY_UOMS, DRY_SPACE_KINDS, DRY_SPACE_TYPE_LABELS, DRY_SPACE_TYPES, drySpaceTypeOf, FLOOR_SITE_ORDER, SITE_LICENSES, MAX_TOTE_LBS_DEFAULT, TRIM_BOGEY_DEFAULT } from "./config";
import { etWallClock } from "./farmday";
import { LOOKUP_LANDING, LOOKUP_VALUE_SECTIONS } from "./lookups";
import { EDITABLE_FIELDS, type EditFieldDef } from "./pipeline";
import { esc, licenseChromeScript, licensePicker } from "./html";
import { licenseToneClass } from "./interco";
import { t, tFill, type Locale } from "./i18n";
import type { LookupOption } from "./db";

/** THE DRY SPACE TYPE (canon 0.30.106; owner: "Admin lookups: Dry spaces: 1.
 * Name 2. Capacity 3. Capacity UOM (ea, lb, g, sqft) 4. Freezer, Dry Room, or
 * Silo?"): his four columns first, then the standing kind and farm; the type
 * reads as his word (Silo, Dry Room, Freezer). */
const DRY_SPACE_COLUMNS = ["name", "capacity", "capacity_uom", "space_type", "kind", "farm_code"];
function drySpaceRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => ({ ...row, space_type: DRY_SPACE_TYPE_LABELS[drySpaceTypeOf(String(row.space_type ?? ""))] }));
}

/** Canon 0.30.40: the seven site license lines a location may be scoped to. */
const SITE_LICENSE_VALUES: readonly string[] = FLOOR_SITE_ORDER.flatMap((site) => [...SITE_LICENSES[site]]);

export function lookupsLandingPage(locale: Locale = "en"): string {
  const sections = LOOKUP_LANDING.map((section) => {
    const buttons = section.buttons
      .map(
        (b) => `<a class="tile" href="${esc(b.href)}" data-lookup-key="${esc(b.key)}" title="${esc(t(locale, b.description))}">
          <span class="tile-kind">${esc(t(locale, section.category))}</span>
          <span class="tile-title">${esc(t(locale, b.title))}</span>
        </a>`
      )
      .join("");
    return `<h2>${esc(t(locale, section.category))}</h2>
      <div class="tiles lookup-landing">${buttons}</div>`;
  }).join("");
  return `<h1 title="${esc(t(locale, "People are entered here and live only in this site's database. Never commit names."))}">${esc(t(locale, "Data Lookups"))}</h1>
    ${sections}`;
}

export function adminPage(
  tables: {
    people: Record<string, unknown>[];
    farms: Record<string, unknown>[];
    strains: Record<string, unknown>[];
    dry_spaces: Record<string, unknown>[];
    package_types: Record<string, unknown>[];
    app_config: Record<string, unknown>[];
  },
  locale: Locale = "en"
): string {
  const kindOpts = DRY_SPACE_KINDS.map((k) => `<option value="${k}">${k}</option>`).join("");
  const spaceTypeOpts = DRY_SPACE_TYPES.map((v) => `<option value="${v}">${esc(DRY_SPACE_TYPE_LABELS[v])}</option>`).join("");
  const capacityUomOpts = [`<option value=""></option>`, ...CAPACITY_UOMS.map((u) => `<option value="${u}">${u}</option>`)].join("");
  // Blank scopes the space to no farm, meaning shared (owner ruling 2026-08-28).
  const farmOpts = [
    `<option value="">(shared)</option>`,
    ...tables.farms.map((f) => `<option value="${esc(f.code)}">${esc(f.code)}</option>`),
  ].join("");
  // Owner ruling 2026-09-01: "ratify 22 but place the home of the 22 in the
  // lookups section of Admin." The App config section lists the standing keys
  // (key, value, updated_at) with the reasoned Edit control only; adminTable's
  // editOnly comment says why there is no Void and no Add.
  const appConfigSection = `<h2>${esc(t(locale, "App config"))}</h2>
    <p class="muted">${esc(t(locale, "Standing configuration values. Edit with a reason; keys cannot be added or voided."))}</p>
    ${adminTable("app_config", ["key", "value", "updated_at"], tables.app_config, false, true)}`;
  return `<h1>${esc(t(locale, "Lookups"))}</h1>
    <p class="muted">People are entered here and live only in this site's database. Never commit names.</p>

    <h2>People</h2>
    <p class="muted">A person row auto-creates on first login; the email is the login identity. Edit to attach or fix an email. A phone login maps onto the person carrying the phone (ten US digits, or + country code and number); a phone no person carries is refused.</p>
    ${adminTable("people", ["display_name", "email", "phone", "is_active"], tables.people, true)}
    <form class="stack" method="post" action="/admin/lookups/people">
      <input type="hidden" name="action" value="add">
      <label class="field">Name <input type="text" name="display_name" required></label>
      <label class="field">Email <input type="text" name="email"></label>
      <label class="field">Phone (login) <input type="text" name="phone" inputmode="tel" autocomplete="off" placeholder="(269) 555-0100"></label>
      <button type="submit">Add person</button>
    </form>

    <h2>Farms</h2>
    <p class="muted">Display names render on the wet weight header after the HBN. Edit to confirm or change them.</p>
    ${adminTable("farms", ["code", "display_name"], tables.farms, false)}

    <h2>Strains</h2>
    ${adminTable("strains", ["name", "abbr", "hbn_code"], tables.strains, false)}
    <form class="stack" method="post" action="/admin/lookups/strains">
      <input type="hidden" name="action" value="add">
      <label class="field">Name <input type="text" name="name" required></label>
      <label class="field">Abbr <input type="text" name="abbr"></label>
      <label class="field">HBN code <input type="text" name="hbn_code" required></label>
      <button type="submit">Add strain</button>
    </form>

    <h2>Dry spaces</h2>
    ${adminTable("dry_spaces", DRY_SPACE_COLUMNS, drySpaceRows(tables.dry_spaces), false)}
    <form class="stack" method="post" action="/admin/lookups/dry_spaces">
      <input type="hidden" name="action" value="add">
      <label class="field">Name <input type="text" name="name" required></label>
      <label class="field">Capacity <input type="number" name="capacity" step="0.01" min="0"></label>
      <label class="field">Capacity UOM <select name="capacity_uom">${capacityUomOpts}</select></label>
      <label class="field">Freezer, Dry Room, Silo, or Cure Space? <select name="space_type">${spaceTypeOpts}</select></label>
      <label class="field">Kind <select name="kind">${kindOpts}</select></label>
      <label class="field">Farm <select name="farm_code">${farmOpts}</select></label>
      <button type="submit">Add dry space</button>
    </form>

    <h2>Package types</h2>
    ${adminTable("package_types", ["code", "display_name", "is_bud"], tables.package_types, false)}
    <form class="stack" method="post" action="/admin/lookups/package_types">
      <input type="hidden" name="action" value="add">
      <label class="field">Code <input type="text" name="code" required></label>
      <label class="field">Display name <input type="text" name="display_name" required></label>
      <label class="field"><span><input type="checkbox" name="is_bud" value="1"> Is bud?</span></label>
      <button type="submit">Add package type</button>
    </form>

    ${appConfigSection}`;
}

export function lookupSectionPage(
  section: string,
  tables: {
    people: Record<string, unknown>[];
    farms: Record<string, unknown>[];
    grow_methods: Record<string, unknown>[];
    strains: Record<string, unknown>[];
    dry_spaces: Record<string, unknown>[];
    package_types: Record<string, unknown>[];
    app_config: Record<string, unknown>[];
  },
  lookupRows: Record<string, unknown>[],
  locale: Locale = "en"
): string {
  // THE BACK LINK (canon 0.30.109): the crumb under the app bar carries the way
  // back to Data Lookups; the sections repeat no link of their own.
  const back = "";
  const kindOpts = DRY_SPACE_KINDS.map((k) => `<option value="${k}">${k}</option>`).join("");
  const spaceTypeOpts = DRY_SPACE_TYPES.map((v) => `<option value="${v}">${esc(DRY_SPACE_TYPE_LABELS[v])}</option>`).join("");
  const capacityUomOpts = [`<option value=""></option>`, ...CAPACITY_UOMS.map((u) => `<option value="${u}">${u}</option>`)].join("");
  const farmOpts = [
    `<option value="">(shared)</option>`,
    ...tables.farms.map((f) => `<option value="${esc(f.code)}">${esc(f.code)}</option>`),
  ].join("");
  if (section === "people") {
    // THE PHONE LOGIN (canon 0.30.127): the phone column and box; the person's phone is the mapping a phone login lands on.
    return `${back}<h1 title="${esc(t(locale, "A person row auto-creates on first login; the email is the login identity. Edit to attach or fix an email. A phone login maps onto the person carrying the phone; a phone no person carries is refused."))}">${esc(t(locale, "People"))}</h1>
    ${adminTable("people", ["display_name", "email", "phone", "is_active"], tables.people, true)}
    <form class="stack" method="post" action="/admin/lookups/people">
      <input type="hidden" name="action" value="add">
      <label class="field">Name <input type="text" name="display_name" required></label>
      <label class="field">Email <input type="text" name="email"></label>
      <label class="field" title="${esc(t(locale, "Ten US digits, or + country code and number; stored as +E.164. A phone login maps onto this person."))}">${esc(t(locale, "Phone (login)"))} <input type="text" name="phone" inputmode="tel" autocomplete="off" placeholder="(269) 555-0100"></label>
      <button type="submit">Add person</button>
    </form>`;
  }
  if (section === "farms") {
    return `${back}<h1 title="${esc(t(locale, "Display names render on the wet weight header after the HBN. Edit to confirm or change them."))}">${esc(t(locale, "Farms"))}</h1>
    ${adminTable("farms", ["code", "display_name"], tables.farms, false)}`;
  }
  if (section === "grow_methods") {
    return `${back}<h1>${esc(t(locale, "Grow Methods"))}</h1>
    ${adminTable("grow_methods", ["code", "display_name", "hbn_code"], tables.grow_methods, false)}
    <form class="stack" method="post" action="/admin/lookups/grow_methods">
      <input type="hidden" name="action" value="add">
      <label class="field">Code <input type="text" name="code" required></label>
      <label class="field">Display name <input type="text" name="display_name" required></label>
      <label class="field">HBN code <input type="text" name="hbn_code" required></label>
      <button type="submit">Add grow method</button>
    </form>`;
  }
  if (section === "strains") {
    return `${back}<h1>${esc(t(locale, "Strains"))}</h1>
    ${adminTable("strains", ["name", "abbr", "hbn_code"], tables.strains, false)}
    <form class="stack" method="post" action="/admin/lookups/strains">
      <input type="hidden" name="action" value="add">
      <label class="field">Name <input type="text" name="name" required></label>
      <label class="field">Abbr <input type="text" name="abbr"></label>
      <label class="field">HBN code <input type="text" name="hbn_code" required></label>
      <button type="submit">Add strain</button>
    </form>`;
  }
  if (section === "dry_spaces") {
    return `${back}<h1>${esc(t(locale, "Dry Spaces"))}</h1>
    ${adminTable("dry_spaces", DRY_SPACE_COLUMNS, drySpaceRows(tables.dry_spaces), false)}
    <form class="stack" method="post" action="/admin/lookups/dry_spaces">
      <input type="hidden" name="action" value="add">
      <label class="field">Name <input type="text" name="name" required></label>
      <label class="field">Capacity <input type="number" name="capacity" step="0.01" min="0"></label>
      <label class="field">Capacity UOM <select name="capacity_uom">${capacityUomOpts}</select></label>
      <label class="field">Freezer, Dry Room, Silo, or Cure Space? <select name="space_type">${spaceTypeOpts}</select></label>
      <label class="field">Kind <select name="kind">${kindOpts}</select></label>
      <label class="field">Farm <select name="farm_code">${farmOpts}</select></label>
      <button type="submit">Add dry space</button>
    </form>`;
  }
  if (section === "package_types") {
    return `${back}<h1>${esc(t(locale, "Package Types"))}</h1>
    ${adminTable("package_types", ["code", "display_name", "is_bud"], tables.package_types, false)}
    <form class="stack" method="post" action="/admin/lookups/package_types">
      <input type="hidden" name="action" value="add">
      <label class="field">Code <input type="text" name="code" required></label>
      <label class="field">Display name <input type="text" name="display_name" required></label>
      <label class="field"><span><input type="checkbox" name="is_bud" value="1"> Is bud?</span></label>
      <button type="submit">Add package type</button>
    </form>`;
  }
  if (section === "app_config") {
    return `${back}<h1 title="${esc(t(locale, "Standing configuration values. Edit with a reason; keys cannot be added or voided."))}">${esc(t(locale, "App config"))}</h1>
    ${adminTable("app_config", ["key", "value", "updated_at"], tables.app_config, false, true)}`;
  }
  const valueSection = LOOKUP_VALUE_SECTIONS[section];
  if (valueSection) {
    const isLicense = valueSection.category === "license";
    // Canon 0.30.40: inventory AND field locations carry a farm and an optional
    // license scope (blank = every license at the farm).
    const isLocation = valueSection.category === "inventory_location" || valueSection.category === "field_location";
    // THE METRC MIRROR (canon 0.30.38): an internal field's Tone is what it
    // applies to (plants, packages, or blank for both).
    const isInternalField = valueSection.category === "internal_field";
    // Owner ruling 2026-09-06 (canon 0.27.0): locations carry a farm assignment.
    const columns = isLicense
      ? ["value", "label", "tone", "farm_code", "sort_order"]
      : isLocation
        ? ["value", "label", "farm_code", "license_value", "sort_order"]
        : isInternalField
          ? ["value", "label", "tone", "sort_order"]
          : ["value", "label", "sort_order"];
    const toneField = isLicense
      ? `<label class="field">${esc(t(locale, "Tone"))} <input type="text" name="tone" placeholder="blue yellow green"></label>`
      : isInternalField
        ? `<label class="field">${esc(t(locale, "Applies to"))} <input type="text" name="tone" placeholder="plants, packages, or blank for both" data-applies-to></label>`
        : "";
    const farmField = isLicense || isLocation
      ? `<label class="field">${esc(t(locale, "Farm"))} <select name="farm_code">${farmOpts}</select></label>`
      : "";
    const licenseField = isLocation
      ? `<label class="field">${esc(t(locale, "License (blank = every license at the farm)"))} <select name="license_value"><option value="">${esc(t(locale, "Every license at the farm"))}</option>${SITE_LICENSE_VALUES.map((lic) => `<option value="${esc(lic)}">${esc(lic)}</option>`).join("")}</select></label>`
      : "";
    // Hover help law (canon 0.26.0): the location convention rides the title.
    const conventionTitle = isLocation
      ? ` title="${esc(t(locale, "Barns are the inbox at every site. CSA is 832-side staging. CSB and unknown spots are processor under 694."))}"`
      : "";
    return `${back}<h1${conventionTitle}>${esc(t(locale, valueSection.title))}</h1>
    ${adminTable("lookup_values", columns, lookupRows, false, false, isLicense)}
    <form class="stack" method="post" action="/admin/lookups/${esc(section)}">
      <input type="hidden" name="action" value="add">
      <label class="field">Value <input type="text" name="value" required></label>
      <label class="field">Label <input type="text" name="label" required></label>
      ${toneField}
      ${farmField}
      ${licenseField}
      <button type="submit">Add value</button>
    </form>`;
  }
  return `${back}<h1>Lookups</h1><p class="muted">Unknown section.</p>`;
}

function adminTable(
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
  isPeople: boolean,
  // Owner ruling 2026-09-01: App config carries the Edit control only. Standing
  // config keys are code-known, so there is no Add; there is no Void because a
  // voided admin_pin would unlock the site and a voided yield breaks the sheet.
  editOnly = false,
  toneLicenses = false
): string {
  if (rows.length === 0) return `<p class="muted">None yet.</p>`;
  const head = `<tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}<th>Controls</th></tr>`;
  const body = rows
    .map((row) => {
      const id = String(row.id);
      const cells = columns
        .map((c) => {
          if (toneLicenses && (c === "label" || c === "value")) {
            const cls = licenseToneClass(row.tone as string | null);
            return `<td><span class="${cls}">${esc(row[c] ?? "")}</span></td>`;
          }
          return `<td>${esc(row[c] ?? "")}</td>`;
        })
        .join("");
      const voidLink = editOnly
        ? ""
        : `<a class="btn secondary" href="/record/${esc(table)}/${esc(id)}/void">Void</a>`;
      const deactivate = isPeople
        ? `<form method="post" action="/admin/lookups/people" class="row-actions">
             <input type="hidden" name="action" value="deactivate">
             <input type="hidden" name="id" value="${esc(id)}">
             <input type="text" name="reason" placeholder="reason" required>
             <button type="submit" class="danger">Deactivate</button>
           </form>`
        : "";
      return `<tr>${cells}<td class="row-actions">
        <a class="btn secondary" href="/record/${esc(table)}/${esc(id)}/edit">Edit</a>
        ${voidLink}
        ${deactivate}
      </td></tr>`;
    })
    .join("");
  const html = `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  if (table === "people" || table === "app_config") return `<div class="report-scroll">${html}</div>`;
  return html;
}

/** THE TRIM BOGEY (canon 0.30.249; owner, 2026-09-26: "Add a Admin Lookup
 * Field: [Trim Bogey] expressed as a percentage" and "Determines number of dark
 * red squares and the order based on our scheme (ROYGBIVWB-Aqua)"): one whole
 * percent, the plume's product line, saved under a reason. `stored` is false
 * while no hand has saved one and the plume reads the default. */
export function trimBogeyPage(value: number, stored: boolean, locale: Locale = "en", ok?: string): string {
  const flash = ok === "saved" ? `<p class="banner ok" data-trim-bogey-flash>${esc(t(locale, "Saved."))}</p>` : "";
  const unset = stored
    ? ""
    : `<p class="muted" data-trim-bogey-default>${esc(tFill(locale, "Not saved yet: the plume reads the default, {n}%.", { n: String(TRIM_BOGEY_DEFAULT) }))}</p>`;
  return `<h1>${esc(t(locale, "Trim Bogey"))}</h1>
    <p class="muted">${esc(
      t(
        locale,
        "The percent of the trim plume that is product: that many of its last squares, in the ROYGBIVWB-Aqua order, turn dark red when consumed."
      )
    )}</p>
    ${flash}${unset}
    <form class="stack" method="post" action="/admin/lookups/trim_bogey" data-trim-bogey>
      <label class="field">${esc(t(locale, "Trim Bogey (%)"))} <input type="text" name="trim_bogey_pct" inputmode="numeric" pattern="[0-9]{1,3}%?" required value="${esc(String(value))}" data-trim-bogey-value></label>
      <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
}

/** THE MAX TOTE WEIGHT (canon 0.30.350): pounds, saved under a reason; `stored` is false while the default stands. */
export function maxToteWeightPage(value: number, stored: boolean, locale: Locale = "en", ok?: string): string {
  const flash = ok === "saved" ? `<p class="banner ok" data-max-tote-flash>${esc(t(locale, "Saved."))}</p>` : "";
  const unset = stored
    ? ""
    : `<p class="muted" data-max-tote-default>${esc(tFill(locale, "Not saved yet: the stations refuse a weight above the default, {n} lb.", { n: String(MAX_TOTE_LBS_DEFAULT) }))}</p>`;
  return `<h1>${esc(t(locale, "Max Tote Weight"))}</h1>
    <p class="muted">${esc(t(locale, "The most one wet weight may be. Penn North Harvest and Penn South/Arlington Harvest refuse anything heavier before it is saved."))}</p>
    ${flash}${unset}
    <form class="stack" method="post" action="/admin/lookups/max_tote_lbs" data-max-tote>
      <label class="field">${esc(t(locale, "Max Tote Weight (lb)"))} <input type="text" name="max_tote_lbs" inputmode="decimal" pattern="[0-9]{1,3}([.][0-9]{1,2})?" required value="${esc(String(value))}" data-max-tote-value></label>
      <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
}

/** THE CURE CAPS (canon 0.30.341): one whole number of lots for CSA or CSB, saved under a reason. */
export function lotCapPage(room: "CSA" | "CSB", value: number, stored: boolean, locale: Locale = "en", ok?: string): string {
  const key = room === "CSA" ? "csa_lot_cap" : "csb_lot_cap";
  const title = room === "CSA" ? "CSA Lot Cap" : "CSB Lot Cap";
  const flash = ok === "saved" ? `<p class="banner ok" data-lot-cap-flash>${esc(t(locale, "Lot cap saved."))}</p>` : "";
  const unset = stored
    ? ""
    : `<p class="muted" data-lot-cap-default>${esc(tFill(locale, "Not saved yet: the tile reads the default, {n} lots.", { n: String(value) }))}</p>`;
  return `<h1>${esc(t(locale, title))}</h1>
    <p class="muted">${esc(tFill(locale, "The number of lots {room} holds; the tile on the Harvest Console fills green by lots over this cap.", { room }))}</p>
    ${flash}${unset}
    <form class="stack" method="post" action="/admin/lookups/${key}" data-lot-cap="${room}">
      <label class="field">${esc(t(locale, "Lot cap"))} <input type="text" name="lot_cap" inputmode="numeric" pattern="[0-9]{1,3}" required value="${esc(String(value))}" data-lot-cap-value></label>
      <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
}

/** POST HARVEST PUZZLES (canon 0.30.351): dollars per pound, saved under a reason. */
export function phpPricePage(which: "Bud" | "Trim", value: number, stored: boolean, locale: Locale = "en", ok?: string): string {
  const key = which === "Bud" ? "php_bud_price_per_lb" : "php_trim_price_per_lb";
  const title = which === "Bud" ? "Bud $/lb" : "Trim $/lb";
  const fallback = which === "Bud" ? "150" : "30";
  const flash = ok === "saved" ? `<p class="banner ok" data-php-price-flash>${esc(t(locale, "Saved."))}</p>` : "";
  const unset = stored
    ? ""
    : `<p class="muted" data-php-price-default>${esc(tFill(locale, "Not saved yet: the report reads {n}.", { n: fallback }))}</p>`;
  return `<h1>${esc(t(locale, title))}</h1>
    <p class="muted">${esc(t(locale, "Dollars per pound on Post Harvest Puzzles."))}</p>
    ${flash}${unset}
    <form class="stack" method="post" action="/admin/lookups/${key}" data-php-price="${which}">
      <label class="field">${esc(t(locale, title))} <input type="text" name="price" inputmode="decimal" required value="${esc(String(value))}" data-php-price-value></label>
      <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
}

/** THE TESTING OVERRIDE (canon 0.30.341): one .xlsb drop. The sheet becomes the picture. */
export function testingOverridePage(input: {
  locale?: Locale;
  last: { time: string; trigger: string; seen: number; landed: number; changed: number; skipped: number } | null;
  flash?: string;
  skips?: string;
}): string {
  const locale = input.locale ?? "en";
  const flash = input.flash ? `<p class="banner ok" data-testing-override-flash>${esc(input.flash)}</p>` : "";
  const skips = input.skips ? `<p data-testing-override-skips>${esc(tFill(locale, "Skipped: {reasons}", { reasons: input.skips }))}</p>` : "";
  const last = input.last
    ? tFill(locale, "Last run: {time}, {trigger}, {seen} seen, {landed} landed, {changed} changed, {skipped} skipped.", {
        time: input.last.time,
        trigger: t(locale, input.last.trigger),
        seen: String(input.last.seen),
        landed: String(input.last.landed),
        changed: String(input.last.changed),
        skipped: String(input.last.skipped),
      })
    : t(locale, "Last run: never");
  return `<h1>${esc(t(locale, "Testing Override"))}</h1>
    ${flash}${skips}
    <p class="muted">${esc(t(locale, "The consoles read the lab station. This drop still lands the workbook into its table."))}</p>
    <p data-testing-override-last>${esc(last)}</p>
    <div data-testing-override>
      <form class="stack" method="post" action="/admin/testing-override" enctype="multipart/form-data">
        <label class="field">${esc(t(locale, "Drop the In Testing workbook (.xlsb) here, or pick it"))} <input type="file" name="file" accept=".xlsb" required data-testing-override-file></label>
        <button type="submit">${esc(t(locale, "Override testing from this sheet"))}</button>
      </form>
    </div>
    <p><a href="/harvest#testing">${esc(t(locale, "Testing on the Harvest Console"))}</a> · <a href="/compliance">${esc(t(locale, "Compliance Console"))}</a></p>
    <script>
(function () {
  var pane = document.querySelector("[data-testing-override]");
  if (!pane) return;
  var form = pane.querySelector("form");
  var input = pane.querySelector("input[type=file]");
  ["dragenter", "dragover"].forEach(function (name) {
    pane.addEventListener(name, function (ev) { ev.preventDefault(); });
  });
  pane.addEventListener("drop", function (ev) {
    ev.preventDefault();
    var file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (!file || !input || !form) return;
    var transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    form.submit();
  });
})();
    </script>`;
}

/** The harvest year the page opens on: the asked four digits, else the farm day's year. */
export function plantCountYear(asked: string | null | undefined, today: string): string {
  const text = String(asked ?? "").trim();
  return /^\d{4}$/.test(text) ? text : today.slice(0, 4);
}

/** THE FARM PLANT COUNT (canon 0.30.288): one whole number per farm per harvest year. */
export function plantCountPage(
  year: string,
  farms: Array<{ code: string; name: string; count: number | null }>,
  locale: Locale = "en",
  ok?: string
): string {
  const flash = ok === "saved" ? `<p class="banner ok" data-plant-count-flash>${esc(t(locale, "Saved."))}</p>` : "";
  const fields = farms
    .map(
      (farm) =>
        `<label class="field" data-plant-count-farm="${esc(farm.code)}">${esc(farm.name)} (${esc(farm.code)}) <input type="text" name="count_${esc(farm.code)}" inputmode="numeric" value="${farm.count == null ? "" : esc(String(farm.count))}"></label>`
    )
    .join("");
  return `<h1>${esc(t(locale, "Farm Plant Count"))}</h1>
    <p class="muted">${esc(t(locale, "One number per farm per harvest year: the denominator of Plants Remaining/Total on the console, never overridden by METRC."))}</p>
    ${flash}
    <form class="stack" method="post" action="/admin/lookups/plant_count" data-plant-count>
      <label class="field">${esc(t(locale, "Harvest year"))} <input type="text" name="harvest_year" inputmode="numeric" required value="${esc(year)}" data-plant-count-year></label>
      ${fields}
      <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
}

/** Fork 6 (canon 0.30.1): the Admin-buried manual HBN fallback. Owner verbatim:
 * "bury it in Admin somewhere for now.  I don't want that to be the default."
 * Acquire stays the default; this hand-types the whole HBN when the system
 * fails, under the same farm-assigned license law, reasoned into the log. */
export function manualHbnPage(
  lookups: {
    farms: LookupOption[];
    licenses: LookupOption[];
    grow_methods: LookupOption[];
    strains: LookupOption[];
    /** THE HBN ENTRY (canon 0.30.341): the Silo pick list and the next silo with room, preselected. */
    silo_number?: LookupOption[];
    next_silo?: string;
  },
  locale: Locale = "en",
  okHbn?: string
): string {
  const opts = (rows: LookupOption[], selected = "") =>
    [`<option value=""></option>`, ...rows.map((o) => `<option value="${esc(o.value)}"${o.value === selected ? " selected" : ""}>${esc(o.label)}</option>`)].join("");
  const farmLicenses = lookups.licenses.filter((o) => o.farm_code);
  // THE HBN ENTRY (canon 0.30.341): the same two fields as Acquire, Bucked and the next silo with room by default.
  const formRadio = `<fieldset class="field field-radio"><legend>${esc(t(locale, "Spear or Bucked"))}</legend><span class="choice-row"><label><input type="radio" name="material_form" value="spear"> ${esc(
    t(locale, "Spear")
  )}</label> <label><input type="radio" name="material_form" value="bucked" checked> ${esc(t(locale, "Bucked"))}</label></span></fieldset>`;
  const siloSelect = `<label class="field">${esc(t(locale, "Silo"))} <select name="planned_dryspc" required>${opts(lookups.silo_number ?? [], lookups.next_silo ?? "")}</select></label>`;
  const flash = okHbn
    ? `<p class="banner ok">${esc(t(locale, "Minted"))}: ${esc(okHbn)}. ${esc(t(locale, "It sits in the HBN Queue like any other."))}</p>`
    : "";
  return `<h1>${esc(t(locale, "Manual HBN"))}</h1>
    <p class="muted">${esc(
      t(
        locale,
        "The fallback for when the system fails. Acquire is the default; this takes the whole HBN as typed, checks the serial ledger, and demands a reason."
      )
    )}</p>
    ${flash}
    <form class="stack" method="post" action="/admin/manual-hbn">
      <label class="field">${esc(t(locale, "HBN"))} <input type="text" name="hbn" required placeholder="26244-ARL-GH-027-0-05-26001"></label>
      <label class="field"><span><input type="checkbox" name="is_test" value="1"> ${esc(t(locale, "Test HBN (holds no place in line)"))}</span></label>
      <label class="field">${esc(t(locale, "Customer (toll lot)"))} <input type="text" name="customer" value=""></label>
      <label class="field">${esc(t(locale, "METRC Harvest Tag"))} <input type="text" name="metrc_harvest_tag"></label>
      <label class="field">${esc(t(locale, "Date"))} <input type="date" name="entry_date" required></label>
      <label class="field">${esc(t(locale, "Farm"))} <select name="farm_code" required>${opts(lookups.farms)}</select></label>
      <label class="field">${esc(t(locale, "License"))} ${licensePicker("license_value", farmLicenses, "", { required: true })}</label>
      <label class="field">${esc(t(locale, "Grow Method"))} <select name="grow_method_code" required>${opts(lookups.grow_methods)}</select></label>
      <label class="field">${esc(t(locale, "Strain"))} <select name="strain_id" required>${opts(lookups.strains)}</select></label>
      ${formRadio}
      ${siloSelect}
      <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required placeholder="${esc(t(locale, "why the system failed"))}"></label>
      <button type="submit">${esc(t(locale, "Mint manual HBN"))}</button>
    </form>
    ${licenseChromeScript()}`;
}

export function logPage(rows: Record<string, unknown>[]): string {
  const exportLink = `<p><a href="/export/record_change_log.csv">CSV export</a></p>`;
  if (rows.length === 0) return `<h1>Change log</h1>${exportLink}<p class="muted">No events yet.</p>`;
  const head =
    "<tr><th>When</th><th>Table</th><th>Record</th><th>Field</th><th>Old</th><th>New</th><th>Actor</th><th>Reason</th></tr>";
  // Owner ruling 2026-08-31: comma grouping is display only and the change log
  // is an audit surface; old/new values render exactly as stored, never through
  // formatGrams, so a logged gram value reads byte for byte as it was written.
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
    <div class="report-scroll"><table class="data wide"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

export function editPage(
  table: string,
  id: string,
  row: Record<string, unknown>,
  lookups: Record<string, LookupOption[]>,
  back = ""
): string {
  const fields = EDITABLE_FIELDS[table];
  if (!fields) {
    return `<h1>Edit</h1><p class="muted">This table is not editable.</p>`;
  }
  const inputs = fields.map((f) => editInput(f, row, lookups)).join("\n");
  const licenseScript = fields.some((f) => f.lookup === "license") ? licenseChromeScript() : "";
  const backInput =
    back.startsWith("/") && !back.startsWith("//") ? `<input type="hidden" name="back" value="${esc(back)}">` : "";
  return `<h1>Edit ${esc(table)}</h1>
    <form class="stack" method="post" action="/record/${esc(table)}/${esc(id)}/edit">
      ${backInput}
      ${inputs}
      <label class="field">Reason <input type="text" name="reason" required></label>
      <button type="submit">Save</button>
    </form>
    ${licenseScript}`;
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
    if (field.lookup === "license") {
      return `<label class="field">${esc(field.label)}${licensePicker(field.name, options, String(current ?? ""), { required: !field.optional })}</label>`;
    }
    // THE HBN ENTRY (canon 0.30.341): a NULL value shows as a blank option and a
    // value the list no longer offers (an HBN's NA) stays as its own option, so
    // a plain Save never writes the first option by accident.
    const cur = String(current ?? "");
    const known = options.some((o) => o.value === cur);
    const opts = [
      field.optional || cur === "" ? `<option value=""${cur === "" ? " selected" : ""}></option>` : "",
      cur !== "" && !known ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : "",
      ...options.map((o) => {
        const sel = cur === o.value ? " selected" : "";
        return `<option value="${esc(o.value)}"${sel}>${esc(o.label)}</option>`;
      }),
    ].join("");
    return `<label class="field">${esc(field.label)}<select name="${esc(field.name)}">${opts}</select></label>`;
  }
  // THE HBN ENTRY (canon 0.30.341): Spear or Bucked is a one-tap radio on both pencils, the current value checked.
  if (field.input === "radio" && field.options) {
    const cur = String(current ?? "");
    const row = field.options
      .map((o) => `<label><input type="radio" name="${esc(field.name)}" value="${esc(o.value)}"${cur === o.value ? " checked" : ""}> ${esc(o.label)}</label>`)
      .join(" ");
    return `<fieldset class="field field-radio"><legend>${esc(field.label)}</legend><span class="choice-row">${row}</span></fieldset>`;
  }
  if (field.input === "textarea") {
    return `<label class="field">${esc(field.label)}<textarea name="${esc(field.name)}">${esc(current ?? "")}</textarea></label>`;
  }
  // THE DRY SPACE TYPE (canon 0.30.106): a fixed list renders as a select; an
  // optional one leads with a blank that clears.
  if (field.options) {
    const opts = [
      field.optional ? `<option value=""></option>` : "",
      ...field.options.map((o) => {
        const sel = String(current ?? "") === o.value ? " selected" : "";
        return `<option value="${esc(o.value)}"${sel}>${esc(o.label)}</option>`;
      }),
    ].join("");
    return `<label class="field">${esc(field.label)}<select name="${esc(field.name)}">${opts}</select></label>`;
  }
  // THE ZONELESS ZERO (canon 0.30.104): a farm-time field shows the stored
  // instant as the Eastern wall clock it was, and takes the same shape back.
  if (field.farmTime) {
    const shown = etWallClock(String(current ?? "")) || String(current ?? "");
    return `<label class="field">${esc(field.label)}<input type="text" name="${esc(field.name)}" value="${esc(
      shown
    )}" placeholder="YYYY-MM-DD HH:MM" autocomplete="off" data-farm-time></label>`;
  }
  // Owner ruling 2026-08-31: comma grouping is display only; an input's value
  // stays the raw stored number so it round-trips through parseGrams.
  const extra = field.input === "number" ? ` step="0.01"` : "";
  return `<label class="field">${esc(field.label)}<input type="${field.input}" name="${esc(field.name)}" value="${esc(current ?? "")}"${extra}></label>`;
}

export function voidPage(table: string, id: string, back = ""): string {
  // back = the referring page's path; the void returns there (owner ruling 2026-08-31).
  return `<h1>Void record</h1>
    <p>Soft-delete this ${esc(table)} row. It stays in the database with deleted_at set.</p>
    <form class="stack" method="post" action="/record/${esc(table)}/${esc(id)}/void">
      <input type="hidden" name="back" value="${esc(back)}">
      <label class="field">Reason <input type="text" name="reason" required></label>
      <button type="submit" class="danger">Void</button>
    </form>`;
}
