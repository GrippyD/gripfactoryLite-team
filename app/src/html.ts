import {
  barnLocationForSite,
  drySpaceTypeOf,
  FLOOR_SITE_ORDER,
  formatGrams,
  formatGramsWhole,
  GRAM_FIELDS,
  ADMIN_METRC_API_PATH,
  ADMIN_METRC_EVAL_PATH,
  HARVEST_PATH,
  MODELS_PATH,
  MODEL_TOOLS,
  modelToolPath,
  isMetrcTag,
  isOverIssued,
  isSiteBarnLocation,
  lacksMetrcTag,
  licenseClassOf,
  LOC_CSB,
  lotTagLabel,
  OVERISSUE_TOLERANCE_GRAMS,
  shortLotId,
  SITE_LICENSES,
  sumGrams,
  TEST_OUTCOMES,
  DEFAULT_VIEW,
  type DeviceName,
  type FloorSite,
  type ViewName,
} from "./config";
import { formatLbs } from "./compliance";
import { effectiveDateField } from "./effective";
import { FARM_DAY_START_HOUR_DEFAULT } from "./farmday";
import { processorSideLocations } from "./ledger";
import type { MetrcFgInventory, MetrcFgKind } from "./metrc";
import { backCrumb, type BackLink } from "./nav";
import { salesHelperFitScript } from "./saleshelper";
import { siloLiveScript, siloTile, siloVisual, siloWaitingLines, siloWetLine, spaceShapeOf, SILO_CAPACITY_WET_LBS_DEFAULT, LB_GRAMS, type SiloLive } from "./silo";
import { reconcileDeltaLabel, reconcileGate, type ReconcileMode } from "./reconcile";
import { hbnWithSeq, wetWeightsFilename } from "./csv";
import { locationChangeFilename } from "./interco";
import type {
  CollapsibleGrams,
  DryingSpaceView,
  InventoryLotLine,
  InventoryPkgLine,
  InventorySheet,
  ParetoBar,
  RecallPrefill,
  RecallableBatch,
} from "./inventory";
import { t, tFill, type Locale } from "./i18n";
import type { PendingTestSampleRow } from "./testing";
import type { OpsIconName } from "./icons";
import { formatByteSize } from "./imports";
import {
  displayManifestNumber,
  emptyFloorWindows,
  farmCodeFromLicenseLabel,
  lanesFromSite,
  licenseOptionLabel,
  licenseToneClass,
  receivingLine,
  siteFarmCode,
  type FloorMaterialRow,
  type FloorSiteWindow,
  type IntercoSite,
  type RoadChip,
} from "./interco";
import type {
  FieldDef,
  OpsGroup,
  PipelineEntry,
  QueueControlDef,
  QueueDef,
  StationDef,
} from "./pipeline";
import { OPS_ICON_FILES, OPS_PHONE_ORDER, opsGroupByKey } from "./pipeline";
import { cerberusChrome, coMarkSvg, gripMarkSvg, themeStylesheet } from "./theme";
import type {
  ImportQueueRow,
  InboundTruckLot,
  MovementQueueRow,
  TrimPackageRow,
  IntercoMovementItemRow,
  IntercoMovementRow,
  IntercoReceiptRow,
  LocalInventoryListRow,
  LookupOption,
  PendingPackageUploadRow,
  PendingManifestUploadRow,
  PendingLocationChangeRow,
  PendingReceiveUploadRow,
  PendingSplitUploadRow,
  PendingNewPackagesRow,
  ChangedUploadRow,
  PendingUploadRow,
  PersonRow,
  QueueRow,
  TagGaps,
  UnloadSessionRow,
} from "./db";
import type { PendingLocationMoveRow } from "./locations";
import { LEDGER_LOCATION_PATH, reconcileNotesSection, type ReconcileNoteRow } from "./ledgerloc";
import type { ReportView } from "./reports";
import { REPORT_CARDS, bodyColumns, groupedRowsHtml, reportCellText } from "./reports";

export function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Vendored map icons: both variants in markup; each sheet shows one. */
export function opsIconImgs(icon: OpsIconName, eager = false): string {
  const file = OPS_ICON_FILES[icon];
  const loading = eager ? ` loading="eager"` : "";
  return `<span class="ops-icon-box">
      <img class="ops-icon ops-icon-on-dark" src="/icons/white/${esc(file)}.svg" width="54" height="54" alt="" aria-hidden="true"${loading}>
      <img class="ops-icon ops-icon-on-light" src="/icons/dark/${esc(file)}.svg" width="54" height="54" alt="" aria-hidden="true"${loading}>
    </span>`;
}

export function licensePicker(
  name: string,
  options: LookupOption[],
  current: string,
  opts: { required?: boolean; farmSelect?: string } = {}
): string {
  const optsHtml = options
    .map((o) => {
      const farm = o.farm_code || farmCodeFromLicenseLabel(o.label);
      const selected = current === o.value ? " selected" : "";
      return `<option value="${esc(o.value)}" data-tone="${esc(o.tone ?? "")}" data-label="${esc(o.label)}" data-farm="${esc(farm)}"${selected}>${esc(licenseOptionLabel(o.value, o.label))}</option>`;
    })
    .join("");
  const chosen = options.find((o) => o.value === current) ?? options[0];
  const tone = licenseToneClass(chosen?.tone);
  const chip = `<span class="tone-chip${tone ? ` ${tone}` : ""}" data-license-chip>${esc(chosen?.label ?? "")}</span>`;
  const farmAttr = opts.farmSelect ? ` data-farm-select="${esc(opts.farmSelect)}"` : "";
  return `<div class="license-picker" data-license-picker${farmAttr}>
      <select name="${esc(name)}" data-license-select${opts.required ? " required" : ""}>${optsHtml}</select>
      ${chip}
    </div>`;
}

export function licenseText(value: string, options: LookupOption[]): string {
  const hit = options.find((o) => o.value === value);
  const label = hit?.label ?? value;
  const cls = licenseToneClass(hit?.tone);
  return `<span class="${cls}">${esc(licenseOptionLabel(value, label))}</span>`;
}

export function licenseChromeScript(): string {
  return `<script>
(function () {
  function sync(sel) {
    var opt = sel.options[sel.selectedIndex];
    var wrap = sel.closest("[data-license-picker]");
    if (!wrap) return;
    var chip = wrap.querySelector("[data-license-chip]");
    if (chip && opt) {
      chip.textContent = opt.getAttribute("data-label") || "";
      var tone = opt.getAttribute("data-tone") || "";
      chip.className = "tone-chip" + (tone ? " tone-" + tone : "");
    }
    var farmName = wrap.getAttribute("data-farm-select");
    if (farmName && opt) {
      var farm = document.querySelector('select[name="' + farmName + '"]');
      var code = opt.getAttribute("data-farm") || "";
      if (farm && code) farm.value = code;
    }
  }
  document.querySelectorAll("[data-license-select]").forEach(function (sel) {
    sel.addEventListener("change", function () { sync(sel); });
    sync(sel);
  });
})();
</script>`;
}

/** Chrome glyphs for the device pill. Not the operations map set. */
export function deviceComputerGlyph(): string {
  return `<svg class="device-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></svg>`;
}

export function devicePhoneGlyph(): string {
  return `<svg class="device-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="20" rx="2"/><circle cx="12" cy="18.5" r="0.8" fill="currentColor" stroke="none"/></svg>`;
}

export function time24MaskScript(): string {
  return `<script>
(function () {
  function mask(raw) {
    var d = String(raw).replace(/\\D/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    return d.slice(0, 2) + ":" + d.slice(2);
  }
  document.querySelectorAll("[data-time24-mask]").forEach(function (el) {
    el.addEventListener("input", function () {
      var next = mask(el.value);
      if (el.value !== next) el.value = next;
    });
  });
})();
</script>`;
}

/** THE RAD START TIME (canon 0.30.330): the same digits-and-colon mask on the
 * 12-hour Start Time box ([data-time12-mask]); AM or PM ride a select beside it. */
export function time12MaskScript(): string {
  return `<script>
(function () {
  function mask(raw) {
    var d = String(raw).replace(/\\D/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    return d.slice(0, 2) + ":" + d.slice(2);
  }
  document.querySelectorAll("[data-time12-mask]").forEach(function (el) {
    el.addEventListener("input", function () {
      var next = mask(el.value);
      if (el.value !== next) el.value = next;
    });
  });
})();
</script>`;
}

/** Owner ruling 2026-08-31: add commas to all thousands. A gram field's value
 * formats through formatGrams at every HTML render; every other field renders
 * as stored. Form input values and CSV exports never come through here. */
function displayValue(field: string, values: Record<string, string>): string {
  const value = values[field] ?? "";
  return GRAM_FIELDS.has(field) ? formatGrams(value) : value;
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
  /** Owner ruling 2026-09-01: the chrome view. Canon 0.30.28: the Continuum
   * format (co) is the loading default; Cerberus was, until 2026-09-09. */
  view?: ViewName;
  /** Owner ruling 2026-09-01: the device mode; computer is the default. */
  device?: DeviceName;
  /** THE BACK LINK (canon 0.30.109): the menu above this page, rendered as the
   * crumb under the app bar; null or absent on Home. */
  back?: BackLink | null;
  /** THE FARM DAY BEGINS AT SIX (canon 0.30.151): the start hour in data, carried
   * on the body so every date-filling script reads the farm day, not midnight. */
  farmDayStart?: number;
}): string {
  const theme = opts.theme === "c10" ? "c10" : "grip";
  const locale = opts.locale ?? "en";
  const view = opts.view ?? DEFAULT_VIEW;
  const device = opts.device ?? "computer";
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
  // Owner ruling 2026-09-01: the view pill beside the EN/ES pill on every
  // page, mirroring the locale pill; clicking a view posts /view and returns
  // to the same page. Three segments now: the first segment's LABEL is Grip
  // (it was Cerberus) but its posted value stays cerberus so existing cookies
  // keep working; only the label changed. Lite stays. The CO segment's content
  // is the Continuum CO mark inline (currentColor, about 1em tall) with
  // aria-label Continuum; selecting it sets gf_view=co. The labels are proper
  // nouns, so both locales render alike through the dictionary.
  const viewPill = `<form class="locale-pill view-pill" method="post" action="/view">
      <button type="submit" name="view" value="cerberus" class="view-opt${view === "cerberus" ? " active" : ""}" aria-pressed="${view === "cerberus"}">${esc(t(locale, "Grip"))}</button>
      <button type="submit" name="view" value="lite" class="view-opt${view === "lite" ? " active" : ""}" aria-pressed="${view === "lite"}">${esc(t(locale, "Lite"))}</button>
      <button type="submit" name="view" value="co" class="view-opt view-opt-co${view === "co" ? " active" : ""}" aria-pressed="${view === "co"}">${coMarkSvg("co-pill-mark", t(locale, "Continuum"))}</button>
    </form>`;
  // Owner ruling 2026-09-04: Computer/Phone words become chrome glyphs.
  // aria-label and title keep the i18n words in both locales.
  const computerLabel = t(locale, "Computer");
  const phoneLabel = t(locale, "Phone");
  const devicePill = `<form class="locale-pill device-pill" method="post" action="/device">
      <button type="submit" name="device" value="computer" class="device-opt${device === "computer" ? " active" : ""}" aria-pressed="${device === "computer"}" aria-label="${esc(computerLabel)}" title="${esc(computerLabel)}">${deviceComputerGlyph()}<span class="device-word">${esc(computerLabel)}</span></button>
      <button type="submit" name="device" value="phone" class="device-opt${device === "phone" ? " active" : ""}" aria-pressed="${device === "phone"}" aria-label="${esc(phoneLabel)}" title="${esc(phoneLabel)}">${devicePhoneGlyph()}<span class="device-word">${esc(phoneLabel)}</span></button>
    </form>`;
  // Owner ruling 2026-09-01: the text brand is replaced in BOTH views by the
  // compact brand lockup: the GRIP hex mark at bar height, FACTORY as a
  // stamped-steel chip, and a small spray style "lite" overlapping the chip's
  // bottom right corner. currentColor rides the sheets' view-appropriate ink
  // (near-white on Cerberus, near-black on Lite). The owner's universal-bar
  // ruling supersedes Lite byte-preservation for the brand block only; the
  // old text brand retires in both views.
  const brand = `<div class="brand brand-lockup">${gripMarkSvg("brand-grip")}<span class="brand-factory">FACTORY</span><span class="brand-lite">lite</span></div>`;
  // Owner ruling 2026-09-01: the meta viewport stays width=device-width in
  // both device modes; phone mode reflows through the body class below rather
  // than pinch-zooming (the ruling's "anchors, stretching and zoom").
  return `<!DOCTYPE html>
<html lang="${locale}" data-theme="${theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(t(locale, opts.title))} · Gripfactory Lite</title>
  <style>${themeStylesheet(view)}</style>
</head>
<body${device === "phone" ? ` class="device-phone"` : ""} data-farm-day-start="${esc(String(opts.farmDayStart ?? FARM_DAY_START_HOUR_DEFAULT))}">
  <header class="app-bar">
    ${brand}
    <nav>
      <a href="/">${esc(t(locale, "Home"))}</a>
      <a href="/log">${esc(t(locale, "Log"))}</a>
    </nav>
    <div class="person-form muted" data-login-email>${esc(opts.personEmail)}</div>
    ${localePill}
    ${devicePill}
    ${viewPill}
    ${
      // THE BAR CARRIES REPORTS AND ADMIN (canon 0.30.201; owner, 2026-09-23,
      // verbatim: "make "reports" and "admin" always on top of the screen").
      // This reverses the 2026-09-02 lock of the Admin button to the bottom
      // right: the two ride at the end of the app bar on every page, in every
      // view, so the page below owns the whole screen. The PIN gate on /admin*
      // is untouched; the nav still carries Home and Log only.
      ""
    }${appBarActions(locale)}
  </header>
  <main>
    ${backCrumb(opts.back ?? null, locale)}
    ${flash}
    ${minted}
    ${opts.body}
  </main>
  ${
    // Owner dispatch 2026-09-02: the CO stylesheet landed, so the Cerberus
    // client chrome (scrawl, honeycomb, blooms) is Cerberus's alone; the
    // Continuum world is paper and amber with no boot sequence, and lite
    // stays chrome-free as before.
    view === "cerberus" ? cerberusChrome() : ""
  }
  ${keepOperatorScript()}
</body>
</html>`;
}

/** A people picker. After the 2026-08-31 identity ruling its one caller was the
 * wet weight Lead field (lead_person_id); canon 0.30.67 retired that picker (the
 * login is the Supervisor, the Team Lead is typed), so nothing renders it today.
 * Kept for a future picker; audit actors come from the login. */
export function personSelect(
  people: PersonRow[],
  personId: string,
  required = true,
  label = "Person",
  name = "person_id",
  locale: Locale = "en"
): string {
  const opts = [
    `<option value="">Select person</option>`,
    ...people.map(
      (p) =>
        `<option value="${esc(p.id)}"${p.id === personId ? " selected" : ""}>${esc(p.display_name)}</option>`
    ),
  ].join("");
  const helpKey = "Lead names the harvest crew lead. Admin\\Data Lookups\\People and System\\People";
  return `<label class="field" title="${esc(t(locale, helpKey))}">${esc(label)}
    <select name="${esc(name)}"${required ? " required" : ""}>${opts}</select>
  </label>`;
}

/** Owner ruling 2026-09-06 (canon 0.26.0, the hover help law): help text leaves
 * the screen everywhere; every field's REQUIRED help (the 0.17.0 law, paths
 * included) rides the field as a native title tooltip instead. */
function withFieldHelp(inner: string, field: FieldDef, locale: Locale): string {
  if (inner.includes("class=\"field-help\"") || inner.includes("class='field-help'")) return inner;
  const help = esc(t(locale, field.help.en));
  if (inner.includes('<label class="field"')) {
    return inner.replace('<label class="field"', `<label class="field" title="${help}"`);
  }
  if (inner.includes("<fieldset")) return inner.replace("<fieldset", `<fieldset title="${help}"`);
  return inner;
}

export function renderField(
  field: FieldDef,
  lookups: Record<string, LookupOption[]>,
  queueOptions: Record<string, QueueRow[]>,
  queuesByKey: Record<string, QueueDef>,
  locale: Locale = "en",
  // Owner ruling 2026-08-31: the station's pane pick, when one is on the page.
  // Its one consumer, the cryo_weights widget, retired with THE CRYO RUN
  // (canon 0.30.110); the parameter stays for the callers' shape.
  picked?: QueueRow,
  values?: Record<string, string>
): string {
  void picked;
  if (field.input === "checkbox") {
    const checked = values?.[field.name] === "1" ? " checked" : "";
    return withFieldHelp(
      `<label class="field"><span><input type="checkbox" name="${esc(field.name)}" value="1"${checked}> ${esc(t(locale, field.label))}</span></label>`,
      field,
      locale
    );
  }
  if (field.input === "radio") {
    // Owner ruling 2026-09-07 (canon 0.29.1): the spear/buck toggle lives on
    // the wet weight entry screen; the default renders checked, one tap.
    const current = values?.[field.name] ?? field.default ?? field.options[0]?.value ?? "";
    const row = field.options
      .map(
        (o) =>
          `<label><input type="radio" name="${esc(field.name)}" value="${esc(o.value)}"${
            current === o.value ? " checked" : ""
          }> ${esc(t(locale, o.label))}</label>`
      )
      .join(" ");
    return withFieldHelp(
      `<fieldset class="field field-radio"><legend>${esc(t(locale, field.label))}</legend>
      <span class="choice-row">${row}</span>
    </fieldset>`,
      field,
      locale
    );
  }
  if (field.input === "lookup") {
    const options = [...(lookups[field.lookup] ?? [])];
    const current = values?.[field.name] ?? "";
    if (current && !options.some((o) => o.value === current)) {
      options.push({ value: current, label: current });
    }
    if (field.lookup === "license") {
      // Gate fix 0.28.2 (builder amendment 4): station minting offers only
      // farm-assigned licenses (owner 0.28.1). Destination pickers elsewhere
      // keep the full list.
      const mintable = options.filter((o) => o.farm_code);
      return withFieldHelp(
        `<label class="field">${esc(t(locale, field.label))}
      ${licensePicker(field.name, mintable, current, { required: field.required })}
    </label>`,
        field,
        locale
      );
    }
    const opts = [
      `<option value=""></option>`,
      ...options.map((o) => {
        const sel = current === o.value ? " selected" : "";
        return `<option value="${esc(o.value)}"${sel}>${esc(o.label)}</option>`;
      }),
    ].join("");
    return withFieldHelp(
      `<label class="field">${esc(t(locale, field.label))}
      <select name="${esc(field.name)}"${field.required ? " required" : ""}>${opts}</select>
    </label>`,
      field,
      locale
    );
  }
  if (field.input === "queue_pick") {
    const q = queuesByKey[field.queue];
    const rows = queueOptions[field.queue] ?? [];
    const opts = [
      `<option value=""></option>`,
      ...rows.map(
        (row, i) => `<option value="${esc(row.id)}">${esc(queueRowLabel(q, row, i))}</option>`
      ),
    ].join("");
    return withFieldHelp(
      `<label class="field">${esc(t(locale, field.label))}
      <select name="${esc(field.name)}"${field.required ? " required" : ""}>${opts}</select>
    </label>`,
      field,
      locale
    );
  }
  if (field.input === "textarea") {
    return withFieldHelp(
      `<label class="field">${esc(t(locale, field.label))}
      <textarea name="${esc(field.name)}"></textarea>
    </label>`,
      field,
      locale
    );
  }
  if (field.input === "package_rows") {
    const types = lookups.package_types ?? [];
    const typeOpts = types
      .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
      .join("");
    // Owner walk report 2026-09-04 (canon 0.22.0): the trim exchange takes the
    // [+] rapid-add idiom. One blank entry line; the plus commits the typed
    // package to the list beneath (server round trip clears the boxes); Save
    // stays. The live overissue guard warns when the typed weight crosses the
    // parent's Remaining (data-balance-remaining above); flag, never block.
    // Patrick 2026-09-11 (canon 0.30.37): a weight that lands EXACTLY on the
    // remaining grams is not an over issue; only more than the remaining (past
    // half a cent of float noise) asks. THE OVERISSUE LINE IS STRICT everywhere.
    // THE TAG LAW (canon 0.30.38, fork F5, Patrick's #3): the code the trim
    // room types IS the METRC package tag, so the column says so; a shape that
    // is not 1A plus 22 hex is kept as typed and marked, never refused.
    return withFieldHelp(`<fieldset>
      <legend>${esc(t(locale, field.label))}</legend>
      <table class="data pkg-table" id="pkg-table">
        <thead><tr><th>${esc(t(locale, "Package tag"))}</th><th>Type</th><th>Weight (g)</th></tr></thead>
        <tbody id="pkg-rows">
          <tr>
            <td><input type="text" name="package_code" class="metrc-tag-input" placeholder="1A..." title="${esc(t(locale, "The METRC package tag: 1A plus 22 hex characters"))}" autocomplete="off" spellcheck="false" data-metrc-tag></td>
            <td><select name="package_type_code">${typeOpts}</select></td>
            <td><input type="number" name="weight_grams" step="0.01" min="0" id="trim-plus-weight"></td>
          </tr>
        </tbody>
      </table>
      <p><button type="submit" class="secondary" id="add-pkg" name="plus_one" value="1" title="${esc(t(locale, "Add the typed package to the list"))}">+</button></p>
      <script>
        (function () {
          var btn = document.getElementById("add-pkg");
          if (!btn) return;
          btn.addEventListener("click", function (e) {
            var meta = document.querySelector("[data-balance-remaining]");
            var w = parseFloat((document.getElementById("trim-plus-weight") || {}).value || "");
            if (!meta || !isFinite(w)) return;
            var remaining = parseFloat(meta.getAttribute("data-balance-remaining") || "");
            if (isFinite(remaining) && w > remaining + ${OVERISSUE_TOLERANCE_GRAMS}) {
              if (!confirm(${JSON.stringify(t(locale, "This weight over issues the parent package. Record it anyway?"))})) e.preventDefault();
            }
          });
        })();
      </script>
    </fieldset>`, field, locale);
  }
  if (field.input === "move_to") {
    // Outside a ledger station's picked page this falls back to the plain dry_spaces list;
    // the ledger page renders the farm-filtered select with the Add a truck control instead.
    const options = lookups.dry_spaces ?? [];
    const opts = [
      `<option value=""></option>`,
      ...options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`),
    ].join("");
    return withFieldHelp(
      `<label class="field">${esc(t(locale, field.label))}
      <select name="${esc(field.name)}"${field.required ? " required" : ""}>${opts}</select>
    </label>`,
      field,
      locale
    );
  }
  // THE CRYO RUN (canon 0.30.110): the cryo line renders through cryo.ts on
  // its own page; the generic renderer draws nothing for it.
  if (field.input === "cryo_lines") return "";
  // THE EFFECTIVE DATE PER STATION (canon 0.30.94): the station's Effective
  // Date field renders through effective.ts, its own collapsed block with the
  // Admin PIN, not a plain input. The field renderer has no instant, so the
  // date renders blank and the client fills today (a blank resolves to today).
  if (field.input === "effective_date") {
    return effectiveDateField(null, locale, t(locale, field.help.en));
  }
  const type = field.input;
  const extra = type === "number" ? ` step="0.01" min="0"` : "";
  const pattern = "pattern" in field && field.pattern ? ` pattern="${esc(field.pattern)}"` : "";
  const inputmode = "inputmode" in field && field.inputmode ? ` inputmode="${esc(field.inputmode)}"` : "";
  const placeholder = "placeholder" in field && field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : "";
  const current = values?.[field.name] ?? "";
  // Owner addendum 2026-09-04 (canon 0.22.0): the actual start time at Wet
  // Weight gets the same colon-adding mask as the planned one at Acquire.
  const isTime24 = field.name === "start_time" || field.name === "actual_start_time";
  const mask = isTime24 ? ` data-time24-mask id="${esc(field.name)}"` : "";
  const maskScript = isTime24 ? time24MaskScript() : "";
  // Owner ruling 2026-09-08 (canon 0.30.9): the trim and cryo dates default to
  // the crew's own today (the browser's date; the server's UTC day if no
  // script ran and the field posts blank).
  const defaultsToday = type === "date" && (field.name === "trim_date" || field.name === "cryo_date");
  const todayAttr = defaultsToday ? " data-default-today" : "";
  const todayScript = defaultsToday ? defaultTodayScript() : "";
  // THE OPERATOR KEPT (canon 0.30.346): the trim operator box keeps this tablet's last name.
  const keepOp = field.name === "trim_operator" ? ` autocomplete="off" data-keep-operator` : "";
  return withFieldHelp(
    `<label class="field">${esc(t(locale, field.label))}
    <input type="${type}" name="${esc(field.name)}" value="${esc(current)}"${field.required ? " required" : ""}${extra}${pattern}${inputmode}${placeholder}${mask}${todayAttr}${keepOp}>
  </label>${maskScript}${todayScript}`,
    field,
    locale
  );
}

/** Fills an empty [data-default-today] date input with the browser's farm day
 * (THE FARM DAY BEGINS AT SIX, canon 0.30.151: before the start hour the body
 * carries, the day is still yesterday's date). */
export function defaultTodayScript(): string {
  return `<script>
(function () {
  function pad(n) { return String(n).padStart(2, "0"); }
  var d = new Date();
  var startHour = parseInt((document.body && document.body.getAttribute("data-farm-day-start")) || "${FARM_DAY_START_HOUR_DEFAULT}", 10);
  if (!isNaN(startHour) && d.getHours() < startHour) d.setDate(d.getDate() - 1);
  var today = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  document.querySelectorAll("input[data-default-today]").forEach(function (el) {
    if (!el.value) el.value = today;
  });
})();
</script>`;
}

function opsNode(group: OpsGroup, locale: Locale, lines = ""): string {
  const stub = group.reserved ? " ops-node-stub" : "";
  // THE MENU LINES (canon 0.30.241): Harvest, Logistics and Drying carry a
  // line under the label. The other three stay icon and name until named.
  const under = lines ? `<span class="ops-menu-lines" data-ops-lines="${esc(group.key)}">${lines}</span>` : "";
  return `<a class="ops-node${stub}" href="${esc(group.href)}" data-ops-key="${esc(group.key)}">
      ${opsIconImgs(group.icon, true)}
      <span class="ops-label">${esc(t(locale, group.label))}</span>
      ${under}
    </a>`;
}

function opsArrow(dir: "right" | "down" | "left"): string {
  return `<span class="ops-arrow ops-arrow-${dir}" aria-hidden="true"></span>`;
}

/** Home is the operations map (owner ruling 2026-09-02). The old tile grid
 * left home; group nodes navigate to /ops/<key> except Interco, whose page
 * is the operation. The pipeline argument is accepted so older call sites
 * keep compiling; the map reads OPS_GROUPS. */
/** Owner ruling 2026-09-09 (canon 0.30.28, verbatim: "add a return to
 * continuum link at the top of the homepage only present when in continuum
 * format on the format pill"): the same crumb the Continuum pages carry, at the
 * top of the home page, rendered only while the view pill stands on CO. */
export const CONTINUUM_HOME_URL = "https://gripcontinuum.gripcannabis.com/#/";
export function continuumCrumb(locale: Locale = "en"): string {
  return `<a class="continuum-crumb" href="${CONTINUUM_HOME_URL}">&#8592; ${esc(t(locale, "Back to the Continuum 10"))}</a>`;
}

export function homePage(
  _pipeline?: PipelineEntry[] | string,
  locale: Locale = "en",
  view: ViewName = DEFAULT_VIEW,
  lines: Partial<Record<string, string>> = {}
): string {
  if (typeof _pipeline === "string") {
    locale = _pipeline as Locale;
  }
  const byKey = (key: string) => {
    const group = opsGroupByKey(key);
    if (!group) throw new Error(`ops group missing: ${key}`);
    return opsNode(group, locale, lines[key] ?? "");
  };
  const desktop = `<div class="ops-map ops-map-desktop">
      <div class="ops-row ops-row-1">
        ${byKey("harvest_ops")}
        ${opsArrow("right")}
        ${byKey("interco_logistics")}
        ${opsArrow("right")}
        ${byKey("drying_ops")}
      </div>
      <div class="ops-row ops-row-down">${opsArrow("down")}</div>
      <div class="ops-row ops-row-2">
        ${
          // Owner rulings: the down arrow drops from Drying (column 5) onto
          // Production Operations, so Production holds column 5; and (evening
          // 2026-09-02) "swap marketplace and business ops and add the arrow in
          // between": the flow runs Production to Business Operations to
          // Marketplace, right to left, the island retired.
          ""
        }${byKey("marketplace")}
        ${opsArrow("left")}
        ${byKey("business_ops")}
        ${opsArrow("left")}
        ${byKey("production_ops")}
      </div>
    </div>`;
  const phoneNodes = OPS_PHONE_ORDER.map((key, i) => {
    const node = byKey(key);
    const arrow = i < OPS_PHONE_ORDER.length - 1 ? opsArrow("down") : "";
    return `${node}${arrow}`;
  }).join("");
  const phone = `<div class="ops-map ops-map-phone">${phoneNodes}</div>`;
  // Canon 0.30.28: the crumb leads the home page in the Continuum format only.
  const crumb = view === "co" ? `${continuumCrumb(locale)}\n    ` : "";
  return `${crumb}<h1>${esc(t(locale, "Operations"))}</h1>
    ${desktop}
    ${phone}`;
}

/** Group subpage: the old home tile grid, one group at a time. */
export function opsGroupPage(group: OpsGroup, locale: Locale = "en"): string {
  const tiles = group.members
    .map((member) => {
      const stub = member.reserved ? " tile-stub" : "";
      const kind = member.reserved
        ? t(locale, "Reserved")
        : member.href.startsWith("/station/")
          ? t(locale, "Station")
          : t(locale, "Page");
      return `<a class="tile${stub}" href="${esc(member.href)}" data-pipeline-key="${esc(member.key)}">
        <span class="tile-kind">${esc(kind)}</span>
        <span class="tile-title">${esc(t(locale, member.title))}</span>
      </a>`;
    })
    .join("");
  // THE BACK LINK (canon 0.30.109): the crumb under the app bar carries the way
  // back to the operations map; the group page repeats no link of its own.
  return `<h1 class="ops-group-heading">${opsIconImgs(group.icon, true)} ${esc(t(locale, group.label))}</h1>
    <div class="tiles">${tiles}</div>`;
}

export function opsReservedPage(
  title: string,
  futureFile: string,
  backHref: string,
  backLabel: string,
  locale: Locale = "en"
): string {
  return `<h1>${esc(t(locale, title))}</h1>
    <p class="muted">${esc(t(locale, "Reserved. Awaiting the owner's talk-through."))}</p>
    <p class="muted">${esc(t(locale, "Future interface:"))} ${esc(futureFile)}</p>
    <p><a href="${esc(backHref)}">${esc(t(locale, backLabel))}</a></p>`;
}

export function reportsPage(locale: Locale = "en"): string {
  const cards = REPORT_CARDS.map(
    (card) => `<a class="tile" href="/reports/${esc(card.key)}" data-report-key="${esc(card.key)}">
        <span class="tile-kind">${esc(t(locale, "Report"))}</span>
        <span class="tile-title">${esc(t(locale, card.title))}</span>
        <span class="muted">${esc(t(locale, card.blurb))}</span>
      </a>`
  ).join("");
  return `<h1>${esc(t(locale, "Reports"))}</h1>
    <div class="tiles report-cards">${cards}</div>`;
}

export function reportPage(
  view: ReportView,
  filterHtml: string,
  query: string,
  locale: Locale = "en"
): string {
  const q = query ? `${query}&` : "";
  const formats = view.reserved
    ? ""
    : [
        ["csv", "CSV (standard)"],
        ["xlsx", "XLSX (pretty)"],
        ["pdf", "PDF (pretty)"],
      ]
        .map(
          ([fmt, label]) =>
            `<a class="btn secondary" href="/reports/${esc(view.key)}?${q}format=${fmt}">${esc(t(locale, label))}</a>`
        )
        .join(" ");
  // Canon 0.30.23: a view with groupBy heads each run of rows with the group
  // value (the site the material sits at) and drops that column from the cells.
  const pageView =
    view.key === "line_packages"
      ? { ...view, rows: view.rows.filter((row) => row._total !== 1 && row._total !== "1") }
      : view.key === "dry_weight_by_strain"
        ? // DRY WEIGHT BY STRAIN (canon 0.30.427): the lot numbers fold under the row; the exports keep the column.
          { ...view, columns: view.columns.filter((c) => c.key !== "lot_ids") }
        : view;
  const visibleCols = bodyColumns(pageView);
  const head = visibleCols.map((c) => `<th>${esc(t(locale, c.label))}</th>`).join("");
  const body =
    pageView.rows.length === 0
      ? `<tr><td colspan="${visibleCols.length}">${esc(t(locale, pageView.empty ?? "No rows."))}</td></tr>`
      : groupedRowsHtml(
          pageView,
          (c, row) => {
            const raw = row[c.key];
            return `<td>${esc(reportCellText(c, raw as string | number | null | undefined))}</td>`;
          },
          (row, colspan) =>
            row._fold && row.lot_ids
              ? `<tr class="report-detail"><td colspan="${colspan}"><details class="report-fold"><summary>${esc(String(row._fold))}</summary><span class="report-fold-body">${esc(String(row.lot_ids))}</span></details></td></tr>`
              : row._detail
                ? `<tr class="report-detail"><td colspan="${colspan}">${esc(String(row._detail))}</td></tr>`
                : ""
        );
  const footnote = view.footnote ? `<p class="muted">${esc(view.footnote)}</p>` : "";
  const below = view.belowTable ?? "";
  const filterBlock = view.reserved
    ? ""
    : `<form class="stack report-filters" method="get" action="/reports/${esc(view.key)}">
      ${filterHtml}
      <button type="submit">${esc(t(locale, "Apply filters"))}</button>
    </form>
    <p class="format-bar">${formats}</p>`;
  const heading = view.heading ? `<p class="report-window">${esc(view.heading)}</p>` : "";
  return `<h1>${esc(t(locale, view.title))}</h1>
    ${heading}
    ${filterBlock}
    <table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    ${below}
    ${footnote}`;
}

export type IntercoRoadChip = RoadChip;

export type IntercoFloorData = {
  sites: FloorSiteWindow[];
  licenses: LookupOption[];
  road: IntercoRoadChip[];
  active?: { movement: IntercoMovementRow; items: IntercoMovementItemRow[] };
  destLocation: string;
  destIsExternal: boolean;
  ok?: string;
};

function floorSiteTitle(locale: Locale, site: FloorSite): string {
  if (site === "ARL") return t(locale, "Arlington");
  if (site === "PNS") return t(locale, "PNS");
  return t(locale, "Penn North");
}

function arrivalsSitePath(site: FloorSite): string {
  if (site === "ARL") return "/interco/arrivals/arl";
  if (site === "PNS") return "/interco/arrivals/pns";
  return "/interco/arrivals/pnn";
}

function addToManifestForms(
  locale: Locale,
  item: FloorMaterialRow,
  hasActive: boolean
): string {
  const idField =
    item.kind === "lot"
      ? `<input type="hidden" name="wet_lot_id" value="${esc(item.id)}">`
      : `<input type="hidden" name="item_id" value="${esc(item.id)}">`;
  const pair = `<input type="hidden" name="origin_license" value="${esc(item.originLicense)}">
        <input type="hidden" name="origin_location" value="${esc(item.originLocation)}">
        ${idField}`;
  const addNew = `<form method="post" action="/interco/manifest/add">
        <input type="hidden" name="add_mode" value="new">
        ${pair}
        <button type="submit" title="${esc(t(locale, "One origin license and location per manifest."))}">${esc(t(locale, "Add to new manifest"))}</button>
      </form>`;
  const addExist = hasActive
    ? `<form method="post" action="/interco/manifest/add">
        <input type="hidden" name="add_mode" value="existing">
        ${pair}
        <button type="submit" title="${esc(t(locale, "One origin license and location per manifest."))}">${esc(t(locale, "Add to existing manifest"))}</button>
      </form>`
    : "";
  return `<span class="row-actions">${addNew}${addExist}</span>`;
}

/** One numbered list per license line. Empty containers read the one EMPTY key. */
function licenseMaterialList(
  locale: Locale,
  items: FloorMaterialRow[],
  hasActive: boolean
): string {
  if (items.length === 0) {
    return `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`;
  }
  let n = 0;
  const rows = items.map((item) => {
    const truck =
      item.kind === "lot" && item.truckNumber
        ? `${esc(t(locale, "Truck"))} ${esc(item.truckNumber)} - `
        : "";
    const locTag = isSiteBarnLocation(item.location) ? "" : ` <span class="muted">${esc(item.location)}</span>`;
    const sub = `<span class="pkg-sub">${esc(t(locale, "Weight (g)"))} ${esc(formatGrams(item.weightGrams))}, ${esc(t(locale, "Lot"))} ${esc(item.lotToken)}, ${esc(t(locale, "Market Strain"))} ${esc(item.marketStrain)}</span>`;
    return `<li>${esc(String(++n))}. ${truck}${esc(item.title)}${locTag}${sub}${addToManifestForms(locale, item, hasActive)}</li>`;
  });
  return `<ul class="floor-rows">${rows.join("")}</ul>`;
}

function renderSiteWindow(
  locale: Locale,
  window: FloorSiteWindow,
  licenses: LookupOption[],
  originLicense: string | null,
  hasActive: boolean
): string {
  const focused = Boolean(originLicense);
  const lines = window.licenses
    .map((line) => {
      const isOrigin = originLicense === line.license;
      const open = !focused || isOrigin;
      const dim = focused && !isOrigin ? " lic-dim" : "";
      const cls = licenseClassOf(line.license) === "med" ? "lic-med" : "lic-au";
      const hit = licenses.find((o) => o.value === line.license);
      const label = hit ? licenseOptionLabel(line.license, hit.label) : line.license;
      return `<details class="floor-lic${dim}"${open ? " open" : ""}>
        <summary class="${cls}">${esc(label)}</summary>
        ${licenseMaterialList(locale, line.items, hasActive)}
      </details>`;
    })
    .join("");
  return `<section class="card site-window">
    <details class="floor-site" open>
      <summary><strong>${esc(floorSiteTitle(locale, window.site))}</strong></summary>
      ${lines}
    </details>
    <p><a class="btn" href="${esc(arrivalsSitePath(window.site))}">${esc(t(locale, "Arrivals"))}</a></p>
  </section>`;
}

function manifestT3Fields(locale: Locale, movement: IntercoMovementRow): string {
  const headerVal = (name: keyof IntercoMovementRow) => String(movement[name] ?? "");
  return `<label class="field">${esc(t(locale, "METRC manifest number"))}<input type="text" name="metrc_manifest_number" value="${esc(headerVal("metrc_manifest_number"))}"></label>
      <label class="field">${esc(t(locale, "Truck #"))}<input type="text" name="truck_number" value="${esc(headerVal("truck_number"))}"></label>
      <label class="field">${esc(t(locale, "Planned route"))}<textarea name="planned_route" rows="3">${esc(headerVal("planned_route"))}</textarea></label>
      <label class="field">${esc(t(locale, "Transfer type"))}<input type="text" name="transfer_type" value="${esc(headerVal("transfer_type"))}"></label>
      <label class="field">${esc(t(locale, "Invoice number"))}<input type="text" name="invoice_number" value="${esc(headerVal("invoice_number"))}"></label>
      <label class="field">${esc(t(locale, "Payment term days"))}<input type="text" name="payment_term_days" value="${esc(headerVal("payment_term_days"))}"></label>
      <label class="field">${esc(t(locale, "Estimated departure"))}<input type="text" name="planned_departure" value="${esc(headerVal("planned_departure"))}"></label>
      <label class="field">${esc(t(locale, "Estimated arrival"))}<input type="text" name="planned_arrival" value="${esc(headerVal("planned_arrival"))}"></label>
      <label class="field">${esc(t(locale, "Gross weight"))}<input type="text" name="gross_weight" value="${esc(headerVal("gross_weight"))}"></label>
      <label class="field">${esc(t(locale, "Gross weight UOM"))}<input type="text" name="gross_weight_uom" value="${esc(headerVal("gross_weight_uom"))}"></label>
      <label class="field">${esc(t(locale, "Transporter license"))}<input type="text" name="transporter_license" value="${esc(headerVal("transporter_license"))}"></label>
      <label class="field">${esc(t(locale, "Transporter phone"))}<input type="text" name="transporter_phone" value="${esc(headerVal("transporter_phone"))}"></label>
      <label class="field">${esc(t(locale, "Driver name"))}<input type="text" name="driver" value="${esc(headerVal("driver"))}"></label>
      <label class="field">${esc(t(locale, "Driver occupational license"))}<input type="text" name="driver_occupational_license" value="${esc(headerVal("driver_occupational_license"))}"></label>
      <label class="field">${esc(t(locale, "Driver license number"))}<input type="text" name="driver_license_number" value="${esc(headerVal("driver_license_number"))}"></label>
      <label class="field">${esc(t(locale, "Vehicle make"))}<input type="text" name="vehicle_make" value="${esc(headerVal("vehicle_make"))}"></label>
      <label class="field">${esc(t(locale, "Vehicle model"))}<input type="text" name="vehicle_model" value="${esc(headerVal("vehicle_model"))}"></label>
      <label class="field">${esc(t(locale, "Vehicle plate"))}<input type="text" name="vehicle_plate" value="${esc(headerVal("vehicle_plate"))}"></label>`;
}

function renderWorkingPane(
  locale: Locale,
  data: IntercoFloorData
): string {
  const active = data.active;
  if (!active) {
    return `<section class="card work-window">
      <h2>${esc(t(locale, "Working pane"))}</h2>
      <p class="muted">${esc(t(locale, "- EMPTY -"))}</p>
    </section>`;
  }
  const movement = active.movement;
  const destOpts = data.licenses
    .map((o) => {
      const sel = movement.destination_license === o.value ? " selected" : "";
      return `<option value="${esc(o.value)}"${sel}>${esc(licenseOptionLabel(o.value, o.label))}</option>`;
    })
    .join("");
  const destLoc = data.destLocation
    ? `<p class="muted">${esc(t(locale, "Destination location"))}: ${esc(data.destLocation)}</p>`
    : `<p class="muted">${esc(t(locale, "Destination location"))}</p>`;
  const items =
    active.items.length === 0
      ? `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`
      : `<ul class="floor-rows">${active.items
          .map((item, i) => {
            const title = item.package_code || item.strain_name || item.local_inventory_item_id;
            return `<li>${esc(String(i + 1))}. ${esc(title)}
              <span class="pkg-sub">${esc(t(locale, "Weight (g)"))} ${esc(formatGrams(item.qty))}, ${esc(t(locale, "Lot"))} ${esc(shortLotId(item.hbn ?? "", null))}, ${esc(t(locale, "Market Strain"))} ${esc(item.strain_name ?? "")}</span>
              <form method="post" action="/interco/movement/${esc(movement.id)}/remove">
                <input type="hidden" name="item_row_id" value="${esc(item.id)}">
                <input type="hidden" name="surface" value="floor">
                <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
                <button type="submit" class="secondary">${esc(t(locale, "Remove"))}</button>
              </form>
            </li>`;
          })
          .join("")}</ul>`;
  const total = active.items.reduce((n, item) => n + Number(item.qty), 0);
  const t3 = data.destIsExternal ? manifestT3Fields(locale, movement) : "";
  return `<section class="card work-window">
    <h2>${esc(t(locale, "Manifest"))}</h2>
    <p>${esc(t(locale, "Origin"))}: ${esc(movement.origin_license)} / ${esc(movement.origin_location ?? "")}${
      movement.truck_number ? ` / ${esc(t(locale, "Truck"))} ${esc(movement.truck_number)}` : ""
    }</p>
    <form class="stack" method="post" action="/interco/manifest/dest">
      <input type="hidden" name="movement_id" value="${esc(movement.id)}">
      <label class="field">${esc(t(locale, "Destination"))}
        <select name="destination_license" required>
          <option value=""></option>
          ${destOpts}
        </select>
      </label>
      ${destLoc}
      ${t3}
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>
    ${items}
    <p>${esc(t(locale, "Total"))}: ${esc(formatGrams(total))} g</p>
    <form method="post" action="/interco/manifest/finish">
      <input type="hidden" name="movement_id" value="${esc(movement.id)}">
      <button type="submit">${esc(t(locale, "Finish manifest"))}</button>
    </form>
  </section>`;
}

export function intercoFloorPage(locale: Locale, data: IntercoFloorData): string {
  const flash =
    data.ok === "sent" || data.ok === "moved"
      ? `<p class="ok">${esc(t(locale, "Saved."))}</p>`
      : "";
  const originLicense = data.active?.movement.origin_license ?? null;
  const hasActive = Boolean(data.active);
  const bySite = new Map(data.sites.map((s) => [s.site, s]));
  const windows = FLOOR_SITE_ORDER.map((site) => {
    const block =
      bySite.get(site) ??
      ({ site, licenses: SITE_LICENSES[site].map((license) => ({ license, items: [] })) } as FloorSiteWindow);
    return renderSiteWindow(locale, block, data.licenses, originLicense, hasActive);
  }).join("");
  const road =
    data.road.length === 0
      ? `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`
      : `<ul class="floor-rows">${data.road
          .map(
            (chip) =>
              `<li>${esc(chip.label)} <a href="${esc(chip.href)}">${esc(t(locale, "Receive at"))} ${esc(chip.destSite.toUpperCase())}</a></li>`
          )
          .join("")}</ul>`;
  return `<h1 title="${esc(t(locale, "One origin license and location per manifest."))}">${esc(t(locale, "Interco Logistics"))}</h1>
    ${flash}
    <div class="interco-floor">${windows}${renderWorkingPane(locale, data)}</div>
    <section class="card interco-road">
      <h2>${esc(t(locale, "On the road"))}</h2>
      ${road}
    </section>
    <p class="muted">${esc(t(locale, "CSVs live in Admin, Pending Data Uploads."))}</p>`;
}

/** THE BLANK SLATE (canon 0.30.108; owner, 2026-09-17, verbatim: "Make the
 * entire menu surface blank."): the Interco Logistics page is its title and
 * the standing empty word. The floor renderers below stay in the file as the
 * record of what stood here; no route reaches them. */
export function intercoBlankPage(locale: Locale = "en"): string {
  return `<h1>${esc(t(locale, "Interco Logistics"))}</h1>
    <p class="muted" data-blank-slate>${esc(t(locale, "- EMPTY -"))}</p>`;
}

export function intercoMenuPage(locale: Locale = "en", data?: IntercoFloorData): string {
  return intercoFloorPage(
    locale,
    data ?? {
      sites: emptyFloorWindows(),
      licenses: [],
      road: [],
      destLocation: "",
      destIsExternal: false,
    }
  );
}

export function intercoSendPage(
  locale: Locale,
  site: IntercoSite,
  barnItems: LocalInventoryListRow[],
  wetLots: InboundTruckLot[],
  last: IntercoMovementRow | null,
  nextTruck: number
): string {
  const farm = siteFarmCode(site);
  const barn = barnLocationForSite(farm);
  const lanes = lanesFromSite(site);
  const laneCards = lanes
    .map(
      (lane, i) => `<label class="lane-card">
        <input type="radio" name="lane" value="${esc(lane.id)}" ${i === 0 ? "checked" : ""}>
        <strong>${esc(t(locale, "Lane"))} ${esc(lane.id)}</strong>
        <span>${esc(t(locale, lane.purpose))}</span>
        <span class="hint">${esc(t(locale, lane.arrivalLine))}</span>
      </label>`
    )
    .join("");
  const itemRows = barnItems
    .map(
      (item, i) =>
        `<label class="queue-pane-item"><input type="checkbox" name="item_id" value="${esc(item.id)}"> ${esc(String(i + 1))}. ${esc(item.package_code)} ${esc(item.item_kind)} ${esc(formatGrams(item.qty))} ${esc(item.uom)}</label>`
    )
    .join("");
  const wetRows = wetLots
    .map((lot, i) => {
      const simple = [lot.farm_code, lot.strain_name, lot.entry_date].filter(Boolean).join(" / ");
      const truck = lot.truck_number ? `${esc(t(locale, "Truck"))} ${esc(lot.truck_number)} - ` : "";
      return `<label class="queue-pane-item"><input type="checkbox" name="wet_lot_id" value="${esc(lot.id)}"> ${esc(String(i + 1))}. ${truck}${esc(simple)} <span class="muted">${esc(formatGrams(lot.weight_grams))} g</span></label>`;
    })
    .join("");
  const headerVal = (name: keyof IntercoMovementRow) => (last ? String(last[name] ?? "") : "");
  return `<h1 title="${esc(t(locale, "Picked from the barn only."))} ${esc(barn)}. ${esc(t(locale, "No license picker. The lane knows."))}">${esc(t(locale, "Send material"))} ${esc(site.toUpperCase())}</h1>
    <p><a href="/interco">${esc(t(locale, "Interco Logistics"))}</a></p>
    <form method="post" action="/interco/send/${esc(site)}" class="station-split">
      <aside class="queue-pane">
        <h2>${esc(t(locale, "Barn"))}</h2>
        ${itemRows || `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`}
        <h3>${esc(t(locale, "Wet lots"))}</h3>
        ${wetRows || `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`}
      </aside>
      <div class="working-pane">
        <h2>${esc(t(locale, "WHERE TO"))}</h2>
        <fieldset>
          <legend>${esc(t(locale, "Lane"))}</legend>
          ${laneCards}
        </fieldset>
        <label class="field">${esc(t(locale, "Truck #"))}<input type="text" name="truck_number" value="${esc(String(nextTruck))}"></label>
        <details>
          <summary>${esc(t(locale, "T3 header details"))}</summary>
          <label class="field">${esc(t(locale, "METRC manifest number"))}<input type="text" name="metrc_manifest_number" value="${esc(headerVal("metrc_manifest_number"))}"></label>
          <label class="field">${esc(t(locale, "Planned route"))}<textarea name="planned_route" rows="3">${esc(headerVal("planned_route"))}</textarea></label>
          <label class="field">${esc(t(locale, "Transfer type"))}<input type="text" name="transfer_type" value="${esc(headerVal("transfer_type"))}"></label>
          <label class="field">${esc(t(locale, "Invoice number"))}<input type="text" name="invoice_number" value="${esc(headerVal("invoice_number"))}"></label>
          <label class="field">${esc(t(locale, "Payment term days"))}<input type="text" name="payment_term_days" value="${esc(headerVal("payment_term_days"))}"></label>
          <label class="field">${esc(t(locale, "Estimated departure"))}<input type="text" name="planned_departure" value="${esc(headerVal("planned_departure"))}"></label>
          <label class="field">${esc(t(locale, "Estimated arrival"))}<input type="text" name="planned_arrival" value="${esc(headerVal("planned_arrival"))}"></label>
          <label class="field">${esc(t(locale, "Gross weight"))}<input type="text" name="gross_weight" value="${esc(headerVal("gross_weight"))}"></label>
          <label class="field">${esc(t(locale, "Gross weight UOM"))}<input type="text" name="gross_weight_uom" value="${esc(headerVal("gross_weight_uom"))}"></label>
          <label class="field">${esc(t(locale, "Transporter license"))}<input type="text" name="transporter_license" value="${esc(headerVal("transporter_license"))}"></label>
          <label class="field">${esc(t(locale, "Transporter phone"))}<input type="text" name="transporter_phone" value="${esc(headerVal("transporter_phone"))}"></label>
          <label class="field">${esc(t(locale, "Driver name"))}<input type="text" name="driver" value="${esc(headerVal("driver"))}"></label>
          <label class="field">${esc(t(locale, "Driver occupational license"))}<input type="text" name="driver_occupational_license" value="${esc(headerVal("driver_occupational_license"))}"></label>
          <label class="field">${esc(t(locale, "Driver license number"))}<input type="text" name="driver_license_number" value="${esc(headerVal("driver_license_number"))}"></label>
          <label class="field">${esc(t(locale, "Vehicle make"))}<input type="text" name="vehicle_make" value="${esc(headerVal("vehicle_make"))}"></label>
          <label class="field">${esc(t(locale, "Vehicle model"))}<input type="text" name="vehicle_model" value="${esc(headerVal("vehicle_model"))}"></label>
          <label class="field">${esc(t(locale, "Vehicle plate"))}<input type="text" name="vehicle_plate" value="${esc(headerVal("vehicle_plate"))}"></label>
        </details>
        <button type="submit">${esc(t(locale, "Finish Outbound Shipment"))}</button>
      </div>
    </form>`;
}

export function intercoOutboundPage(
  locale: Locale,
  data: {
    items: LocalInventoryListRow[];
    licenses: LookupOption[];
    farms: LookupOption[];
    building: IntercoMovementRow[];
    finished: IntercoMovementRow[];
    open?: { movement: IntercoMovementRow; items: IntercoMovementItemRow[] };
  }
): string {
  const movement = data.open?.movement;
  const groups = new Map<string, LocalInventoryListRow[]>();
  for (const item of data.items) {
    const key = item.location || "";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const left = [...groups.entries()]
    .map(([loc, rows]) => {
      const heading = rows[0]?.location_label ?? loc;
      const grams = rows.reduce((n, i) => n + Number(i.qty), 0);
      const boxes = rows
        .map(
          (i) => `<label class="queue-pane-item">
          <input type="checkbox" name="item_id" value="${esc(i.id)}" form="outbound-header">
          ${esc(i.package_code)} ${esc(i.item_kind)} ${esc(i.strain_name ?? "")}
          ${esc(formatGrams(i.qty))} ${esc(i.uom)}
        </label>`
        )
        .join("");
      return `<div class="pane-group" data-location="${esc(loc)}">
        <h3>${esc(heading)} ${esc(String(rows.length))} / ${esc(formatGrams(grams))} g</h3>
        ${boxes}
        <button type="submit" class="secondary" form="outbound-header" formaction="/interco/ship-external/add">${esc(t(locale, "Add"))}</button>
      </div>`;
    })
    .join("");
  const originFarmOpts = data.farms
    .map((o) => `<option value="${esc(o.value)}"${movement?.origin_farm === o.value ? " selected" : ""}>${esc(o.label)}</option>`)
    .join("");
  const destFarmOpts = data.farms
    .map((o) => `<option value="${esc(o.value)}"${movement?.destination_farm === o.value ? " selected" : ""}>${esc(o.label)}</option>`)
    .join("");
  const headerVal = (name: keyof IntercoMovementRow) =>
    movement ? String(movement[name] ?? "") : "";
  const packages = (data.open?.items ?? [])
    .map(
      (i) => `<tr>
        <td>${esc(i.package_code)}</td>
        <td>${esc(i.item_kind)}</td>
        <td>${esc(i.strain_name ?? "")}</td>
        <td>${esc(formatGrams(i.qty))}</td>
        <td>${esc(i.location)}</td>
        <td>
          <form method="post" action="/interco/movement/${esc(movement!.id)}/remove">
            <input type="hidden" name="item_row_id" value="${esc(i.id)}">
            <input type="hidden" name="reason" value="removed from movement">
            <button type="submit" class="secondary">${esc(t(locale, "Remove"))}</button>
          </form>
        </td>
      </tr>`
    )
    .join("");
  const finish =
    movement
      ? `<button type="submit" form="outbound-header" formaction="/interco/ship-external/${esc(movement.id)}/finish">${esc(t(locale, "Finish Outbound Shipment"))}</button>`
      : "";
  const building = data.building
    .map((m) => {
      const num = displayManifestNumber(m.id, m.metrc_manifest_number);
      return `<li class="recall-row">
        <span>${esc(num)}</span>
        <form class="recall-hbn" method="get" action="/interco/ship-external">
          <input type="hidden" name="movement" value="${esc(m.id)}">
          <button type="submit" class="recall-btn" title="${esc(t(locale, "Recall"))}" aria-label="${esc(t(locale, "Recall"))}">&#8617;</button>
        </form>
      </li>`;
    })
    .join("");
  const finished = data.finished
    .map((m) => {
      const num = displayManifestNumber(m.id, m.metrc_manifest_number);
      // One-export-home law (owner, canon 0.22.0): no downloads here.
      return `<li class="item-muted">${esc(num)}
        <span class="muted">${esc(t(locale, "CSV in Admin, Pending Data Uploads"))}</span>
      </li>`;
    })
    .join("");
  return `<h1 title="${esc(t(locale, "All external destinations ship from here"))}">${esc(t(locale, "Ship external"))}</h1>
    <p><a href="/interco">${esc(t(locale, "Interco Logistics"))}</a></p>
    <div class="station-split station-split-3">
      <aside class="queue-pane">
        <h2>${esc(t(locale, "Building 23"))}</h2>
        ${left || `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`}
      </aside>
      <div class="working-pane">
        <form id="outbound-header" class="stack outbound-work" method="post" action="/interco/ship-external/save">
          ${movement ? `<input type="hidden" name="movement_id" value="${esc(movement.id)}">` : ""}
          <label class="field">${esc(t(locale, "Origin license"))}${licensePicker("origin_license", data.licenses, movement?.origin_license ?? "", { required: true, farmSelect: "origin_farm" })}</label>
          <label class="field">${esc(t(locale, "Destination license"))}${licensePicker("destination_license", data.licenses, movement?.destination_license ?? "", { required: true, farmSelect: "destination_farm" })}</label>
          <label class="field">${esc(t(locale, "Origin farm"))}<select name="origin_farm"><option value=""></option>${originFarmOpts}</select></label>
          <label class="field">${esc(t(locale, "Destination farm"))}<select name="destination_farm"><option value=""></option>${destFarmOpts}</select></label>
          <label class="field">${esc(t(locale, "METRC manifest number"))}<input type="text" name="metrc_manifest_number" value="${esc(headerVal("metrc_manifest_number"))}"></label>
          <label class="field">${esc(t(locale, "Truck #"))}<input type="text" name="truck_number" value="${esc(headerVal("truck_number"))}"></label>
          <label class="field">${esc(t(locale, "Planned route"))}<textarea name="planned_route" rows="3">${esc(headerVal("planned_route"))}</textarea></label>
          <label class="field">${esc(t(locale, "Transfer type"))}<input type="text" name="transfer_type" value="${esc(headerVal("transfer_type"))}"></label>
          <label class="field">${esc(t(locale, "Invoice number"))}<input type="text" name="invoice_number" value="${esc(headerVal("invoice_number"))}"></label>
          <label class="field">${esc(t(locale, "Payment term days"))}<input type="text" name="payment_term_days" value="${esc(headerVal("payment_term_days"))}"></label>
          <label class="field">${esc(t(locale, "Estimated departure"))}<input type="text" name="planned_departure" value="${esc(headerVal("planned_departure"))}"></label>
          <label class="field">${esc(t(locale, "Estimated arrival"))}<input type="text" name="planned_arrival" value="${esc(headerVal("planned_arrival"))}"></label>
          <label class="field">${esc(t(locale, "Gross weight"))}<input type="text" name="gross_weight" value="${esc(headerVal("gross_weight"))}"></label>
          <label class="field">${esc(t(locale, "Gross weight UOM"))}<input type="text" name="gross_weight_uom" value="${esc(headerVal("gross_weight_uom"))}"></label>
          <label class="field">${esc(t(locale, "Transporter license"))}<input type="text" name="transporter_license" value="${esc(headerVal("transporter_license"))}"></label>
          <label class="field">${esc(t(locale, "Transporter phone"))}<input type="text" name="transporter_phone" value="${esc(headerVal("transporter_phone"))}"></label>
          <label class="field">${esc(t(locale, "Driver name"))}<input type="text" name="driver" value="${esc(headerVal("driver"))}"></label>
          <label class="field">${esc(t(locale, "Driver occupational license"))}<input type="text" name="driver_occupational_license" value="${esc(headerVal("driver_occupational_license"))}"></label>
          <label class="field">${esc(t(locale, "Driver license number"))}<input type="text" name="driver_license_number" value="${esc(headerVal("driver_license_number"))}"></label>
          <label class="field">${esc(t(locale, "Vehicle make"))}<input type="text" name="vehicle_make" value="${esc(headerVal("vehicle_make"))}"></label>
          <label class="field">${esc(t(locale, "Vehicle model"))}<input type="text" name="vehicle_model" value="${esc(headerVal("vehicle_model"))}"></label>
          <label class="field">${esc(t(locale, "Vehicle plate"))}<input type="text" name="vehicle_plate" value="${esc(headerVal("vehicle_plate"))}"></label>
          <button type="submit">${esc(t(locale, "Save header"))}</button>
        </form>
        <h3>${esc(t(locale, "Added packages"))}</h3>
        <table class="data"><thead><tr><th>${esc(t(locale, "Package"))}</th><th>${esc(t(locale, "Kind"))}</th><th>${esc(t(locale, "Strain"))}</th><th>${esc(t(locale, "Qty"))}</th><th>${esc(t(locale, "Source space"))}</th><th></th></tr></thead>
          <tbody>${packages || `<tr><td colspan="6">${esc(t(locale, "- EMPTY -"))}</td></tr>`}</tbody>
        </table>
        <p class="row-actions">${finish}</p>
      </div>
      <aside class="queue-pane recall-pane">
        <h2>${esc(t(locale, "Manifest numbers"))}</h2>
        <h3>${esc(t(locale, "Building"))}</h3>
        ${building ? `<ul>${building}</ul>` : `<p class="muted">${esc(t(locale, "None yet."))}</p>`}
        <h3>${esc(t(locale, "Finished"))}</h3>
        ${finished ? `<ul class="item-muted">${finished}</ul>` : `<p class="muted">${esc(t(locale, "None yet."))}</p>`}
      </aside>
    </div>
    ${licenseChromeScript()}`;
}

export function intercoOutboundDonePage(
  movement: IntercoMovementRow,
  locale: Locale
): string {
  const num = displayManifestNumber(movement.id, movement.metrc_manifest_number);
  return `<h1>${esc(t(locale, "Outbound shipment finished"))}</h1>
    <p>${esc(t(locale, "Manifest number"))}: ${esc(num)}</p>
    <p class="muted">${esc(t(locale, "The manifest CSV is queued in Admin, Pending Data Uploads. Exports into METRC live in that one spot."))}</p>
    <p class="row-actions">
      <a class="btn secondary" href="/interco/ship-external">${esc(t(locale, "Back to outbound"))}</a>
    </p>`;
}

export function intercoReceivingPage(
  locale: Locale,
  data: {
    movements: IntercoMovementRow[];
    /** Owner bug report 2026-09-04 (canon 0.22.0): in-transit intra-farm wet
     * truck lots ARE inbound to the crew; each line heads with Truck N. */
    truckLots?: Array<{
      id: string;
      truck_number: string | null;
      weight_grams: number;
      farm_code: string | null;
      entry_date: string | null;
      strain_name: string | null;
      hbn: string | null;
      /** Owner ruling 2026-09-07 (canon 0.29.1): the line shows the lot's form. */
      material_form?: string | null;
      /** Canon 0.30.9: the open manifest riding the lot, named on the line. */
      manifest_id?: string | null;
      metrc_manifest_number?: string | null;
    }>;
    receipts: IntercoReceiptRow[];
    movementItems: Record<string, IntercoMovementItemRow[]>;
    licenses: LookupOption[];
    open?: { movement: IntercoMovementRow; items: IntercoMovementItemRow[] };
    revealItemId?: string;
    listPath?: string;
    site?: IntercoSite;
    arrivalBanner?: string;
  }
): string {
  const listPath = data.listPath ?? "/interco/receiving";
  const left = data.movements
    .map((m) => {
      const items = data.movementItems[m.id] ?? [];
      const weight =
        (m.gross_weight ?? "").trim() ||
        formatGrams(items.reduce((n, i) => n + Number(i.qty), 0));
      const line = receivingLine({
        originFarm: m.origin_farm,
        manifestNumber: displayManifestNumber(m.id, m.metrc_manifest_number),
        truckNumber: m.truck_number,
        weight,
      });
      const selected = data.open?.movement.id === m.id ? " selected" : "";
      return `<a class="queue-pane-item${selected}" href="${esc(listPath)}?movement=${esc(m.id)}">${esc(line)}</a>`;
    })
    .join("");
  const open = data.open;
  let working = `<p class="muted">${esc(t(locale, "Pick a manifest."))}</p>`;
  if (open) {
    const rows = open.items
      .map((i) => {
        const handled = Boolean(i.received_at || i.rejected_at || i.receipt_id);
        const revealId = `receive-reveal-${i.id}`;
        const openReveal = data.revealItemId === i.id || false;
        const receive = handled
          ? i.received_at
            ? `<span class="muted">${esc(t(locale, "Received"))} ${esc(i.received_qty != null ? formatGrams(i.received_qty) : "")}</span>`
            : `<span class="muted">${esc(t(locale, "Rejected"))}</span>`
          : `<button type="button" data-receive-open="${esc(revealId)}">${esc(t(locale, "Receive"))}</button>
              <div id="${esc(revealId)}" class="receive-reveal"${openReveal ? "" : " hidden"}>
                <form method="post" action="/interco/receive" class="row-actions">
                  <input type="hidden" name="movement_id" value="${esc(open.movement.id)}">
                  <input type="hidden" name="item_row_id" value="${esc(i.id)}">
                  <label class="field">${esc(t(locale, "Weight to receive"))}
                    <input type="text" name="received_qty" value="${esc(String(i.qty))}" inputmode="decimal">
                  </label>
                  ${
                    // THE TAG LAW (canon 0.30.38, fork F4): the receive may hand
                    // the package its METRC tag (the 832 tag mints at the
                    // virtual receipt, his 2026-09-05 words); a tagged package
                    // shows its tag instead of the box.
                    i.is_wet_lot
                      ? ""
                      : isMetrcTag(i.metrc_tag)
                        ? `<span class="muted metrc-tag-shown">${esc(String(i.metrc_tag))}</span>`
                        : `<label class="field">${esc(t(locale, "METRC package tag"))} ${metrcTagInput(locale)}</label>`
                  }
                  <button type="submit">${esc(t(locale, "Confirm receive"))}</button>
                </form>
              </div>
              <form method="post" action="/interco/reject" class="row-actions">
                <input type="hidden" name="movement_id" value="${esc(open.movement.id)}">
                <input type="hidden" name="item_row_id" value="${esc(i.id)}">
                <input type="text" name="reason" placeholder="${esc(t(locale, "Reason"))}" required>
                <button type="submit" class="danger">${esc(t(locale, "Reject"))}</button>
              </form>`;
        return `<tr>
          <td>${esc(i.package_code)}</td>
          <td>${esc(i.item_kind)}</td>
          <td>${esc(i.strain_name ?? "")}</td>
          <td>${esc(formatGrams(i.qty))}</td>
          <td class="row-actions">${receive}</td>
        </tr>`;
      })
      .join("");
    working = `<h2>${esc(t(locale, "Manifest number"))} ${esc(displayManifestNumber(open.movement.id, open.movement.metrc_manifest_number))}</h2>
      <p>${licenseText(open.movement.origin_license, data.licenses)} / ${licenseText(open.movement.destination_license, data.licenses)}</p>
      <table class="data"><thead><tr><th>${esc(t(locale, "Package"))}</th><th>${esc(t(locale, "Kind"))}</th><th>${esc(t(locale, "Strain"))}</th><th>${esc(t(locale, "Qty"))}</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table>
      <p class="row-actions">
        ${
          // Canon 0.30.25: [Receive all] only while an item is still open;
          // [Finish Receipt] only while a received item awaits its receipt.
          open.items.some((i) => !(i.received_at || i.rejected_at || i.receipt_id))
            ? `<form method="post" action="/interco/receive">
          <input type="hidden" name="movement_id" value="${esc(open.movement.id)}">
          <input type="hidden" name="all" value="1">
          <button type="submit">${esc(t(locale, "Receive all"))}</button>
        </form>`
            : ""
        }
        ${
          open.items.some((i) => i.received_at && !i.receipt_id && !i.rejected_at)
            ? `<form method="post" action="/interco/receipt/finish">
          <input type="hidden" name="movement_id" value="${esc(open.movement.id)}">
          <button type="submit">${esc(t(locale, "Finish Receipt"))}</button>
        </form>`
            : ""
        }
      </p>
      <script>
      (function () {
        document.querySelectorAll("[data-receive-open]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var box = document.getElementById(btn.getAttribute("data-receive-open"));
            if (!box) return;
            if (box.hasAttribute("hidden")) box.removeAttribute("hidden");
            else box.setAttribute("hidden", "");
          });
        });
      })();
      </script>`;
  }
  const receipts = data.receipts
    .map(
      (r) => `<tr>
        <td>${esc(r.id.replaceAll("-", "").slice(0, 8))}</td>
        <td>${esc(r.origin_farm ?? "")} / ${esc(r.destination_farm ?? "")}</td>
        <td>${esc(r.item_count)}</td>
        <td>${esc(r.received_by_name ?? "")}</td>
        <td>${esc(r.created_at)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="/interco/receipt/${esc(r.id)}">${esc(t(locale, "View receipt"))}</a>
          <form method="post" action="/interco/receipt/${esc(r.id)}/void" onsubmit="return confirm('${esc(t(locale, "VOID this receipt and un-receive all items?"))}')">
            <input type="text" name="reason" placeholder="${esc(t(locale, "Reason"))}" required>
            <button type="submit" class="danger">${esc(t(locale, "VOID"))}</button>
          </form>
        </td>
      </tr>`
    )
    .join("");
  const heading = data.site
    ? `${t(locale, "Arrivals")} ${data.site.toUpperCase()}`
    : t(locale, "Receiving");
  const bannerTitle = data.arrivalBanner ? ` title="${esc(data.arrivalBanner)}"` : "";
  return `<h1${bannerTitle}>${esc(heading)}</h1>
    <p><a href="/interco">${esc(t(locale, "Interco Logistics"))}</a></p>
    <div class="station-split">
      <aside class="queue-pane">
        <h2>${esc(t(locale, "Inbound trucks"))}</h2>
        ${
          (data.truckLots ?? []).length
            ? `<ul class="ledger-list">${(data.truckLots ?? [])
                .map((tl) => {
                  const tlForm = t(locale, tl.material_form === "bucked" ? "Bucked" : "Spear");
                  // THE TRUCK CARRIES ITS PAPER (canon 0.30.9): the line names
                  // the manifest riding the lot; the manifest lists nowhere else.
                  const paper = tl.manifest_id
                    ? ` - ${esc(t(locale, "Manifest"))} <span data-riding-manifest>${esc(displayManifestNumber(tl.manifest_id, tl.metrc_manifest_number ?? null))}</span>`
                    : "";
                  const line = `<a class="queue-pane-item" href="/station/wet_weight?lot=${esc(tl.id)}"><strong>${esc(t(locale, "Truck"))} ${esc(tl.truck_number ?? "?")}</strong> - ${esc([tl.farm_code, tl.strain_name, tl.entry_date].filter(Boolean).join("/"))} - ${esc(formatGrams(tl.weight_grams))} g${paper}</a>`;
                  // Owner bug report 2026-09-06 (canon 0.28.4) and correction
                  // (0.28.6): one button, no space pick; THE INBOX IS ALWAYS
                  // BARN and the crew does a location change when it lands.
                  // Owner ruling 2026-09-07 (canon 0.29.1): the receive stops
                  // asking Spear or Bucked; the lot carries its form from wet
                  // weigh-in and the line shows it beside the one button.
                  const receive = data.site
                    ? `<form method="post" action="/interco/arrivals/${esc(data.site)}/receive-truck" class="receive-truck" title="${esc(t(locale, "Everything on this truck lands the site barn and becomes the arrival license."))}">
                          <input type="hidden" name="lot_id" value="${esc(tl.id)}">
                          <span class="muted" data-material-form>${esc(tlForm)}</span>
                          ${metrcTagInput(locale)}
                          <button type="submit">${esc(t(locale, "Receive"))}</button>
                        </form>`
                    : "";
                  return `<li>${line} ${receive}</li>`;
                })
                .join("")}</ul>`
            : `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`
        }
        <h2>${esc(t(locale, "Inbound"))}</h2>
        ${left || `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`}
      </aside>
      <div class="working-pane">
        ${working}
        <h2>${esc(t(locale, "Receipts"))}</h2>
        <table class="data"><thead><tr><th>Id</th><th>From / To</th><th>Items</th><th>By</th><th>When</th><th></th></tr></thead><tbody>${receipts}</tbody></table>
      </div>
    </div>`;
}

export function receiptPage(
  receipt: IntercoReceiptRow,
  movement: IntercoMovementRow,
  items: IntercoMovementItemRow[],
  locale: Locale,
  licenses: LookupOption[] = []
): string {
  const rows = items
    .map(
      (i) => `<tr>
        <td>${esc(i.package_code)}</td>
        <td>${esc(i.item_kind)}</td>
        <td>${esc(formatGrams(i.qty))}</td>
        <td>
          <form method="post" action="/interco/item/${esc(i.id)}/unreceive" onsubmit="return confirm('${esc(t(locale, "Un-receive this item back to in transit?"))}')">
            <input type="text" name="reason" placeholder="${esc(t(locale, "Reason"))}" required>
            <button type="submit" class="danger">${esc(t(locale, "Un-receive"))}</button>
          </form>
        </td>
      </tr>`
    )
    .join("");
  return `<h1>${esc(t(locale, "Receipt"))} ${esc(receipt.id.replaceAll("-", "").slice(0, 8))}</h1>
    <p><a href="/interco/arrivals/pnn">${esc(t(locale, "Arrivals"))}</a></p>
    <dl class="lot-meta">
      <dt>${esc(t(locale, "Origin farm"))}</dt><dd>${esc(movement.origin_farm ?? "")}</dd>
      <dt>${esc(t(locale, "Destination farm"))}</dt><dd>${esc(movement.destination_farm ?? "")}</dd>
      <dt>${esc(t(locale, "Manifest number"))}</dt><dd>${esc(displayManifestNumber(movement.id, movement.metrc_manifest_number))}</dd>
      <dt>${esc(t(locale, "Origin license"))}</dt><dd>${licenseText(movement.origin_license, licenses)}</dd>
      <dt>${esc(t(locale, "Destination license"))}</dt><dd>${licenseText(movement.destination_license, licenses)}</dd>
      <dt>${esc(t(locale, "Received by"))}</dt><dd>${esc(receipt.received_by_name ?? "")}</dd>
      <dt>${esc(t(locale, "When"))}</dt><dd>${esc(receipt.created_at)}</dd>
    </dl>
    <table class="data"><thead><tr><th>Package</th><th>Kind</th><th>Qty</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function virtualMovePage(
  growItems: LocalInventoryListRow[],
  processorItems: LocalInventoryListRow[],
  log: IntercoMovementRow[],
  locale: Locale,
  licenses: LookupOption[] = [],
  locations: LookupOption[] = []
): string {
  const grouped = (items: LocalInventoryListRow[], formId: string) => {
    if (items.length === 0) return `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`;
    const groups = new Map<string, LocalInventoryListRow[]>();
    for (const item of items) {
      const key = item.location || "";
      const rows = groups.get(key) ?? [];
      rows.push(item);
      groups.set(key, rows);
    }
    return [...groups.entries()]
      .map(([loc, rows]) => {
        const heading = rows[0]?.location_label ?? loc;
        const boxes = rows
          .map(
            (i) => `<label class="queue-pane-item">
          <input type="checkbox" name="item_id" value="${esc(i.id)}" form="${esc(formId)}">
          ${esc(i.package_code)} ${esc(i.item_kind)} ${esc(i.strain_name ?? "")}
          ${esc(formatGrams(i.qty))} ${esc(i.uom)}
        </label>`
          )
          .join("");
        return `<div class="pane-group" data-location="${esc(loc)}"><h3>${esc(heading)}</h3>${boxes}</div>`;
      })
      .join("");
  };
  const dests = processorSideLocations(locations).slice().sort((a, b) => {
    if (a.value === LOC_CSB) return -1;
    if (b.value === LOC_CSB) return 1;
    return 0;
  });
  const destOpts = dests
    .map(
      (o, i) =>
        `<option value="${esc(o.value)}"${i === 0 ? " selected" : ""}>${esc(o.label)}</option>`
    )
    .join("");
  const toProcConfirm = esc(
    t(locale, "items from the grow license to the processor license across Building 23.")
  );
  const toGrowConfirm = esc(
    t(locale, "items from the processor license to the grow license. They always land in the barn.")
  );
  const moves = log
    .map(
      (m) => `<tr>
        <td>${esc(m.created_at)}</td>
        <td>${licenseText(m.origin_license, licenses)}</td>
        <td>${licenseText(m.destination_license, licenses)}</td>
        <td><span class="muted">${esc(t(locale, "CSV in Admin, Pending Data Uploads"))}</span></td>
      </tr>`
    )
    .join("");
  return `<h1 title="${esc(t(locale, "CSA to CSB fires at trim readiness."))}">${esc(t(locale, "Cross the door"))}</h1>
    <p><a href="/interco">${esc(t(locale, "Interco Logistics"))}</a></p>
    <div class="station-split">
      <aside class="queue-pane">
        <h2>${esc(t(locale, "832 side"))} ${licenseText("AU-G-C-000832", licenses)}</h2>
        ${grouped(growItems, "move-to-processor")}
        <form id="move-to-processor" method="post" action="/interco/door/in" onsubmit="var n=document.querySelectorAll('input[name=item_id][form=move-to-processor]:checked').length; return confirm('Move ' + n + ' ${toProcConfirm}')">
          <label class="field">${esc(t(locale, "INTO BUILDING 23"))}
            <select name="dest_location" required>${destOpts}</select>
          </label>
          <button type="submit" title="${esc(t(locale, "Crossing becomes 694, a separate business."))}">${esc(t(locale, "Finish move"))}</button>
        </form>
      </aside>
      <div class="working-pane">
        <h2>${esc(t(locale, "Building 23"))} ${licenseText("AU-P-000694", licenses)}</h2>
        ${grouped(processorItems, "move-to-grow")}
        <form id="move-to-grow" method="post" action="/interco/door/out" onsubmit="var n=document.querySelectorAll('input[name=item_id][form=move-to-grow]:checked').length; return confirm('Move ' + n + ' ${toGrowConfirm}')">
          <button type="submit" title="${esc(t(locale, "Back out always lands the Barn."))}">${esc(t(locale, "Finish move"))}</button>
        </form>
      </div>
    </div>
    <h2>${esc(t(locale, "Virtual moves"))}</h2>
    <table class="data"><thead><tr><th>When</th><th>From</th><th>To</th><th></th></tr></thead><tbody>${moves}</tbody></table>
    ${licenseChromeScript()}`;
}

// THE CHANGE LOCATION SETUP (canon 0.30.40) built the first of the four
// reserved pages; three stay reserved.
export type InventoryReservedKind =
  | "zoho-upload"
  | "physical-audit"
  | "location-audit";

const INVENTORY_RESERVED: Record<
  InventoryReservedKind,
  { title: string; csv: string }
> = {
  "zoho-upload": {
    title: "Upload Inventory to Zoho",
    csv: "Future interface: a Zoho items/adjustments CSV.",
  },
  "physical-audit": {
    title: "Physical Inventory Audit",
    csv: "Future interface: a reconciliation report.",
  },
  "location-audit": {
    title: "Location Audit",
    csv: "Future interface: a reconciliation report.",
  },
};

/** The reserved button pages. Each is its own future box; no invented workflow. */
export function inventoryReservedPage(kind: InventoryReservedKind, locale: Locale = "en"): string {
  const page = INVENTORY_RESERVED[kind];
  return `<h1>${esc(t(locale, page.title))}</h1>
    <p class="muted">${esc(t(locale, "Reserved. Awaiting the owner's talk-through."))}</p>
    <p class="muted">${esc(t(locale, page.csv))}</p>`;
}

/** Owner ruling 2026-09-01: /fulfillment is a themed MENU page in the normal
 * chrome. Three buttons in the admin-button style: [SalesHelper], linking the
 * hosted form's wrapper; [Mount SOs] and [Pick Orders], built 2026-09-08
 * (canon 0.30.18) on gripfactorish's behavior, so the orange barrels come off.
 * All of it sits under the existing /fulfillment/* PIN gate. */
export function fulfillmentMenuPage(locale: Locale = "en"): string {
  const kind = `<span class="tile-kind">${esc(t(locale, "Fulfillment"))}</span>`;
  return `<h1>${esc(t(locale, "Fulfillment"))}</h1>
    <div class="tiles">
      <a class="tile" href="/fulfillment/saleshelper/" data-fulfillment-key="saleshelper">
        ${kind}
        <span class="tile-title">${esc(t(locale, "SalesHelper"))}</span>
      </a>
      <a class="tile" href="/fulfillment/mount-sos" data-fulfillment-key="mount-sos">
        ${kind}
        <span class="tile-title">${esc(t(locale, "Mount SOs"))}</span>
      </a>
      <a class="tile" href="/fulfillment/pick-orders" data-fulfillment-key="pick-orders">
        ${kind}
        <span class="tile-title">${esc(t(locale, "Pick Orders"))}</span>
      </a>
    </div>`;
}

/** Owner ruling 2026-09-01: the hosted SalesHelper wrapper. A page in our
 * chrome (the universal bar on top) with the order form filling the rest of
 * the viewport in an iframe. The iframe's src is /fulfillment/saleshelper/app,
 * the no-trailing-slash serve of the vendored form, so the form's relative
 * fetch of menu.json resolves to /fulfillment/saleshelper/menu.json. The
 * region styles flush full-bleed with a min-height calc to fill under the bar
 * (.saleshelper-embed / .saleshelper-frame in both view sheets). */
export function salesHelperWrapperPage(locale: Locale = "en"): string {
  // Canon 0.30.49: the frame fitted to the viewport, the same as the
  // Marketplace's SalesHelper pane, so the page's own scrollbar steps aside.
  return `<div class="saleshelper-embed" data-saleshelper-wrapper>
      <iframe class="saleshelper-frame" src="/fulfillment/saleshelper/app" title="${esc(t(locale, "SalesHelper"))}"></iframe>
    </div>
    ${salesHelperFitScript("[data-saleshelper-wrapper] iframe")}`;
}

function gramsCell(grams: number, rowKey: string): string {
  return `<span class="inv-grams" data-inv-row="${esc(rowKey)}" data-grams="${esc((Math.round(grams * 100) / 100).toFixed(2))}">${esc(formatGrams(grams))}</span>`;
}

function lotLinesTable(lines: InventoryLotLine[], locale: Locale): string {
  if (lines.length === 0) return `<p class="muted">${esc(t(locale, "No rows."))}</p>`;
  const body = lines
    .map(
      (line) => `<tr>
        <td>${esc(line.short_id)}</td>
        <td>${esc(line.strain_name)}</td>
        <td>${esc(line.space_name)}</td>
        <td>${esc(formatGrams(line.grams))}</td>
      </tr>`
    )
    .join("");
  return `<table class="data"><thead><tr><th>${esc(t(locale, "Lot"))}</th><th>${esc(t(locale, "Strain"))}</th><th>${esc(t(locale, "From"))}</th><th>g</th></tr></thead><tbody>${body}</tbody></table>`;
}

function pkgLinesTable(lines: InventoryPkgLine[], locale: Locale): string {
  if (lines.length === 0) return `<p class="muted">${esc(t(locale, "No rows."))}</p>`;
  const body = lines
    .map(
      (line) => `<tr>
        <td>${esc(line.package_code)}</td>
        <td>${esc(line.short_id)}</td>
        <td>${esc(line.strain_name)}</td>
        <td>${esc(formatGrams(line.grams))}</td>
      </tr>`
    )
    .join("");
  return `<table class="data"><thead><tr><th>${esc(t(locale, "Package"))}</th><th>${esc(t(locale, "Lot"))}</th><th>${esc(t(locale, "Strain"))}</th><th>g</th></tr></thead><tbody>${body}</tbody></table>`;
}

function collapsibleTotal(
  title: string,
  block: CollapsibleGrams,
  locale: Locale
): string {
  // Owner ruling 2026-09-01: the extraction mapping is ruled ("Trim and BIO
  // only"), so no row carries a PROVISIONAL note any more; only the awaiting
  // pasteurized row keeps its muted line.
  const note = block.awaiting
    ? `<p class="muted">${esc(t(locale, "OWNER MAPPING NEEDED"))}. ${esc(t(locale, "awaiting pipeline stage"))}</p>`
    : "";
  if (block.awaiting) {
    return `<details class="inv-total" data-inv-block="${esc(block.key)}">
      <summary>${esc(t(locale, title))}</summary>
      ${note}
    </details>`;
  }
  const lots = block.lotLines.length > 0 ? lotLinesTable(block.lotLines, locale) : "";
  const pkgs = block.pkgLines.length > 0 ? pkgLinesTable(block.pkgLines, locale) : "";
  const empty = !lots && !pkgs ? `<p class="muted">${esc(t(locale, "No rows."))}</p>` : "";
  const groups =
    lots && pkgs
      ? `<h3>${esc(t(locale, "Unloaded lots"))}</h3>${lots}<h3>${esc(t(locale, "Live packages"))}</h3>${pkgs}`
      : `${lots}${pkgs}${empty}`;
  return `<details class="inv-total" data-inv-block="${esc(block.key)}">
      <summary>${esc(t(locale, title))}: ${gramsCell(block.grams, block.key)} g</summary>
      ${note}
      ${groups}
    </details>`;
}

/** THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69): a silo draws as the
 * cone-topped cylinder with its live fill and state (siloTile), the drying lots
 * with their projected dry grams inside it and the wet weight at the bottom; a
 * hang room keeps its rounded card with the same wet line under its lots. The
 * live visuals come from the route; without them (a bare render) a silo reads
 * its planned lots as filled material. */
function dryingGauges(spaces: DryingSpaceView[], locale: Locale, siloLive: SiloLive[] = []): string {
  const tiles = spaces
    .map((space) => {
      const lots = space.lots
        .map(
          (lot) => `<div class="inv-lot">
            <div class="inv-lot-id">${esc(t(locale, "Lot"))} ${esc(lot.short_id)}</div>
            <div class="inv-lot-time">${esc(lot.elapsed)}</div>
            <div class="inv-lot-proj">${esc(formatGrams(lot.projected_grams))} g</div>
          </div>`
        )
        .join("");
      const wetGrams = space.lots.reduce((s, lot) => s + Number(lot.wet_grams ?? 0), 0);
      if (space.kind === "silo") {
        const live = siloLive.find((l) => l.silo.id === space.id);
        const visual =
          live?.visual ??
          siloVisual({
            fillingGrams: 0,
            fillingLots: 0,
            awaitingGrams: wetGrams,
            loadedGrams: 0,
            clock: null,
            capacityGrams: SILO_CAPACITY_WET_LBS_DEFAULT * LB_GRAMS,
          });
        // THE LOADING SILO (canon 0.30.81): the lots waiting in the barn for this silo ride the inventory tile too.
        return siloTile({
          id: space.id,
          name: space.name,
          visual,
          body: lots + siloWaitingLines(live?.waiting ?? [], locale),
          locale,
          extraClass: "inv-gauge-silo",
          shape: live ? spaceShapeOf(live.silo) : undefined,
          emptySince: live?.emptySince ?? null,
        });
      }
      const shape = space.kind === "hang" ? "inv-gauge inv-gauge-hang" : "inv-gauge";
      const body = space.lots.length === 0 ? `<div class="muted">${esc(t(locale, "empty"))}</div>` : lots;
      return `<div class="${shape}" data-space="${esc(space.id)}">
          <div class="inv-gauge-name">${esc(space.name)}</div>
          ${body}
          ${siloWetLine(wetGrams, locale)}
        </div>`;
    })
    .join("");
  return `<div class="inv-gauges">${tiles}</div>${siloLiveScript()}`;
}

function paretoBlock(bars: ParetoBar[], failRatePct: number | null, locale: Locale): string {
  const rate =
    failRatePct == null
      ? ""
      : `<p>${esc(t(locale, "First Time Fail Rate"))}: <strong>${esc(failRatePct)}</strong>%</p>`;
  const chart =
    bars.length === 0
      ? `<p class="muted">${esc(t(locale, "No rows."))}</p>`
      : `<div class="inv-pareto" data-inv-pareto>${bars
          .map((bar) => {
            const h = Math.max(4, Math.round(bar.pct));
            return `<div class="inv-pareto-col">
              <div class="inv-pareto-bar" style="height:${h}%" title="${esc(bar.label)} ${esc(bar.count)}"></div>
              <div class="inv-pareto-label">${esc(bar.outcome)}</div>
              <div class="muted">${esc(bar.count)}</div>
            </div>`;
          })
          .join("")}</div>`;
  return `<div class="inv-pareto-wrap">
      <h3>${esc(t(locale, "First Time Fail Rate"))}</h3>
      <p class="muted">${esc(t(locale, "lab capture awaits the owner"))}</p>
      ${rate}
      ${chart}
    </div>`;
}

/** FG INVENTORY IN METRC (canon 0.30.43). Owner, with a screenshot of the
 * Zoho-fed pane: "Change this pane to "FG INVENTORY IN METRC" It should
 * reflect the inventories correctly here"; his pick: by item kind. The bars
 * read the mirror's active packages, every license together, grams and eaches
 * scaled apart; a kind opens to its items. */
function fgKindBars(kinds: MetrcFgKind[], heading: string, unitWord: string, locale: Locale): string {
  if (kinds.length === 0) return "";
  const max = Math.max(0, ...kinds.map((k) => k.quantity));
  const bars = kinds
    .map((k) => {
      const width = max > 0 ? Math.max(2, Math.round((k.quantity / max) * 100)) : 2;
      const qty = k.uom === "ea" ? formatGramsWhole(k.quantity) : formatGrams(k.quantity);
      const itemRows = k.items
        .map(
          (it) => `<tr>
            <td>${esc(it.item)}</td>
            <td>${esc(it.category ?? "")}</td>
            <td>${esc(formatGramsWhole(it.packages))}</td>
            <td>${esc(k.uom === "ea" ? formatGramsWhole(it.quantity) : formatGrams(it.quantity))} ${esc(k.uom)}${
              it.not_passed > 0 ? ` <span class="muted">(${esc(formatGramsWhole(it.not_passed))} ${esc(t(locale, "not test-passed"))})</span>` : ""
            }</td>
          </tr>`
        )
        .join("");
      const note = [
        `${formatGramsWhole(k.packages)} ${t(locale, k.packages === 1 ? "package" : "packages")}`,
        k.categories.join(", "),
        k.not_passed > 0 ? `${formatGramsWhole(k.not_passed)} ${t(locale, "not test-passed")}` : "",
      ]
        .filter((part) => part !== "")
        .join("; ");
      return `<details class="inv-fg-type" data-fg-type="${esc(k.kind)}" data-fg-uom="${esc(k.uom)}">
          <summary>
            <span class="inv-fg-code">${esc(k.kind)}</span>
            <span class="inv-fg-track"><span class="inv-fg-bar" style="width:${width}%"></span></span>
            <span class="inv-fg-stock">${esc(qty)} <span class="muted inv-fg-unit">${esc(k.uom)}</span></span>
          </summary>
          <p class="muted inv-fg-note">${esc(note)}</p>
          <table class="data"><thead><tr>
            <th>${esc(t(locale, "Item"))}</th>
            <th>${esc(t(locale, "Category"))}</th>
            <th>${esc(t(locale, "Packages"))}</th>
            <th>${esc(t(locale, "Quantity"))}</th>
          </tr></thead><tbody>${itemRows}</tbody></table>
        </details>`;
    })
    .join("");
  return `<h3 class="inv-fg-heading">${esc(t(locale, heading))} <span class="muted">${esc(t(locale, unitWord))}</span></h3>
    <div class="inv-fg-bars">${bars}</div>`;
}

function fgSection(fg: MetrcFgInventory | null, locale: Locale): string {
  if (!fg) {
    return `<p class="muted" data-inv-fg="missing">${esc(t(locale, "No METRC packages export mounted yet."))} <a href="/inventory/metrc">${esc(
      t(locale, "Drop the Packages export on the METRC Mirror.")
    )}</a></p>`;
  }
  const licenseLines = fg.licenses
    .map(
      (l) =>
        `<span data-inv-fg-license="${esc(l.license_value)}"><code>${esc(l.license_value)}</code> ${esc(formatGramsWhole(l.packages))} ${esc(
          t(locale, l.packages === 1 ? "package" : "packages")
        )}${l.newest_mount ? `, ${esc(t(locale, "mounted"))} ${esc(l.newest_mount)}` : ""}</span>`
    )
    .join("; ");
  const age = `<p class="muted" data-inv-fg-age>${esc(t(locale, "From the METRC mirror"))}: ${esc(formatGramsWhole(fg.packages))} ${esc(
    t(locale, "active packages")
  )}. ${esc(t(locale, "Newest packages mount"))} ${esc(fg.newest_mount ?? t(locale, "none"))}. ${licenseLines}</p>
    <p class="muted">${esc(
      t(locale, "What the state holds, by the first word of METRC's Item name, every license together; grams and eaches scaled apart. A newer Packages export dropped on the METRC Mirror refreshes it.")
    )}</p>`;
  const empty =
    fg.grams.length === 0 && fg.eaches.length === 0 && fg.other.length === 0
      ? `<p class="muted" data-inv-fg="empty">${esc(t(locale, "The mirror holds no active packages."))}</p>`
      : "";
  return `${age}
    ${empty}
    ${fgKindBars(fg.grams, "By weight", "grams", locale)}
    ${fgKindBars(fg.eaches, "By count", "eaches", locale)}
    ${fgKindBars(fg.other, "Other units", "as METRC states them", locale)}`;
}

/** Inventory sheet (builder prompt 2026-09-01). One GET, server-rendered.
 * Defaults: every WIP block collapsed; FG expanded. THE LEDGER FOLDS (canon
 * 0.30.129; owner, 2026-09-19, verbatim: "on the inventory page, make "local
 * inventory" collapsable and make the loading defaul collapsed"): the Local
 * inventory section is a collapsible block like the WIP blocks, closed when the
 * page loads, its summary carrying the item count. */
export function localInventorySection(items: LocalInventoryListRow[], locale: Locale): string {
  const summary = `<summary>${esc(t(locale, "Local inventory"))} <span class="tile-count" data-local-inventory-count>${esc(String(items.length))}</span></summary>`;
  if (items.length === 0) {
    return `<details class="inv-section local-inventory" data-inv-section="local">
      ${summary}
      <p class="muted">${esc(t(locale, "No local inventory items yet."))}</p>
    </details>`;
  }
  // THE TAG LAW (canon 0.30.38): the METRC tag beside the internal code; a
  // package without one says so, and the pencil is where it lands.
  const rows = items
    .map(
      (i) => `<tr${lacksMetrcTag(i) ? ' data-tag-missing="1"' : ""}>
        <td>${esc(i.item_kind)}</td>
        <td>${esc(i.package_code)}</td>
        <td>${
          lacksMetrcTag(i)
            ? `<span class="muted tag-missing">${esc(i.metrc_tag ? `${i.metrc_tag} ?` : t(locale, "no METRC tag yet"))}</span>`
            : `<code>${esc(String(i.metrc_tag))}</code>`
        }</td>
        <td>${esc(i.strain_name ?? "")}</td>
        <td>${esc(formatGrams(i.qty))} ${esc(i.uom)}</td>
        <td>${esc(i.farm_name ?? i.farm_code)}</td>
        <td>${esc(i.location_label ?? i.location)}</td>
        <td>${esc(i.created_at)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="/record/local_inventory_items/${esc(i.id)}/edit" title="Edit" aria-label="Edit">&#9998;</a>
          <a class="btn secondary" href="/record/local_inventory_items/${esc(i.id)}/void" title="Void" aria-label="Void">&times;</a>
        </td>
      </tr>`
    )
    .join("");
  return `<details class="inv-section local-inventory" data-inv-section="local">
    ${summary}
    <table class="data">
      <thead><tr>
        <th>${esc(t(locale, "Kind"))}</th>
        <th>${esc(t(locale, "Package code"))}</th>
        <th>${esc(t(locale, "METRC tag"))}</th>
        <th>${esc(t(locale, "Strain"))}</th>
        <th>${esc(t(locale, "Qty"))}</th>
        <th>${esc(t(locale, "Farm"))}</th>
        <th>${esc(t(locale, "Location"))}</th>
        <th>${esc(t(locale, "Since"))}</th>
        <th>${esc(t(locale, "Controls"))}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </details>`;
}

export function inventoryPage(
  sheet: InventorySheet,
  locale: Locale = "en",
  ledger: LocalInventoryListRow[] = [],
  // THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69): the silos' live state from the route.
  siloLive: SiloLive[] = []
): string {
  const buttons = [
    { href: "/inventory/change-locations", title: "Change Locations" },
    { href: "/inventory/zoho-upload", title: "Upload Inventory to Zoho" },
    { href: "/inventory/physical-audit", title: "Physical Inventory Audit" },
    { href: "/inventory/location-audit", title: "Location Audit" },
    // THE METRC MIRROR (canon 0.30.38): the state's plants and packages by tag.
    { href: "/inventory/metrc", title: "METRC Mirror" },
  ]
    .map(
      (b) => `<a class="tile" href="${b.href}">
        <span class="tile-kind">${esc(t(locale, "Admin"))}</span>
        <span class="tile-title">${esc(t(locale, b.title))}</span>
      </a>`
    )
    .join("");
  const yieldNote = `<p class="muted">(${esc(sheet.yieldPct)}% ${esc(t(locale, "of wet, editable in Admin, Lookups"))})</p>
    <p class="muted">${esc(t(locale, "Time since start uses the lot's last update (status-flip approximation)."))}</p>`;
  return `<h1>${esc(t(locale, "Inventory"))}</h1>
    ${localInventorySection(ledger, locale)}
    <div class="tiles inv-actions">${buttons}</div>
    <details class="inv-section" data-inv-section="wip">
      <summary>${esc(t(locale, "WIP Inventory"))}</summary>
      <details class="inv-section" data-inv-section="drying">
        <summary>${esc(t(locale, "Drying"))}</summary>
        ${yieldNote}
        ${dryingGauges(sheet.dryingSpaces, locale, siloLive)}
        ${collapsibleTotal("Total Wet Weight drying", sheet.wetDrying, locale)}
        ${collapsibleTotal("Total Projected Dry Weight", sheet.projectedDrying, locale)}
      </details>
      <details class="inv-section" data-inv-section="production">
        <summary>${esc(t(locale, "In Production"))}</summary>
        ${collapsibleTotal("Waiting to be Trimmed total weight", sheet.waitingTrim, locale)}
        ${collapsibleTotal("Waiting to be pasteurized total weight", sheet.waitingPasteurize, locale)}
        ${collapsibleTotal("Waiting to be shipped for extraction total weight", sheet.waitingExtraction, locale)}
        ${collapsibleTotal("Total Dry weight in inventory", sheet.totalDry, locale)}
      </details>
      <details class="inv-section" data-inv-section="testing">
        <summary>${esc(t(locale, "In Testing"))}</summary>
        ${collapsibleTotal("Total representative weight scheduled for testing", sheet.scheduledTesting, locale)}
        ${collapsibleTotal("Total representative weight in testing", sheet.inTesting, locale)}
        ${paretoBlock(sheet.pareto, sheet.failRatePct, locale)}
      </details>
    </details>
    <details class="inv-section" data-inv-section="fg" open>
      <summary>${esc(t(locale, "FG Inventory in METRC"))}</summary>
      ${fgSection(sheet.fg, locale)}
    </details>
    <p><a href="/export/inventory.csv">${esc(t(locale, "CSV export of this sheet"))}</a></p>`;
}

/** ADMIN CLEANUP (canon 0.30.418): the bar, Models then Harvest Console, then the three that were already there. */
export function appBarActions(locale: Locale = "en"): string {
  const links = [
    { href: MODELS_PATH, cls: "models-link", title: "Models" },
    { href: HARVEST_PATH, cls: "harvest-link", title: "Harvest Console" },
    { href: "/maintenance", cls: "maintenance-link", title: "Maintenance" },
    { href: "/reports", cls: "reports-link", title: "Reports" },
    { href: "/admin", cls: "admin-link", title: "Admin" },
  ];
  return `<div class="bar-actions">${links
    .map((link) => `<a class="${link.cls}" href="${esc(link.href)}">${esc(t(locale, link.title))}</a>`)
    .join("")}</div>`;
}

export type AdminGroupMember = { href: string; kind: string; title: string };

export type AdminGroup = { key: string; href: string; title: string; members: AdminGroupMember[] };

/** The three Admin buttons and the tiles each one opens. Member URLs stay as they are. */
export const ADMIN_GROUPS: AdminGroup[] = [
  {
    key: "data-connections",
    href: "/admin/data-connections",
    title: "Data Connections",
    members: [
      { href: "/admin/queues", kind: "Admin", title: "Data Queues" },
      { href: "/admin/uploads", kind: "Admin", title: "Pending Data Uploads" },
      { href: "/admin/imports", kind: "Admin", title: "Import Data" },
      { href: ADMIN_METRC_API_PATH, kind: "Admin", title: "Metrc API" },
      { href: ADMIN_METRC_EVAL_PATH, kind: "Admin", title: "Metrc evaluation" },
    ],
  },
  {
    key: "settings",
    href: "/admin/settings",
    title: "Admin Settings",
    members: [
      { href: "/admin/lookups", kind: "Admin", title: "Lookups" },
      { href: "/admin/field_estimates", kind: "Admin", title: "Field estimates" },
      { href: "/log", kind: "Admin", title: "Change log" },
      { href: "/admin/manual-hbn", kind: "Fallback", title: "Manual HBN" },
      { href: LEDGER_LOCATION_PATH, kind: "Admin", title: "Reconcile Ledger Location" },
    ],
  },
  {
    key: "continuum10",
    href: "/admin/continuum10",
    title: "Continuum10",
    members: [
      { href: "/vendors-equipment", kind: "Continuum", title: "Vendors & Equipment" },
      { href: "/erp-software", kind: "Continuum", title: "ERP" },
      { href: "/compliance-testing", kind: "Continuum", title: "Compliance Testing" },
      { href: "/harvest-console", kind: "Continuum", title: "Harvest Console Lite" },
    ],
  },
  // DD S1: the Director Dashboard button; its home renders the five walls itself
  // (directorHomePage), so adminGroupPage("director") is never served. The
  // members name the walls, in the walls' order, for their own tiles' titles.
  {
    key: "director",
    href: "/admin/director",
    title: "Director Dashboard",
    members: [
      { href: "/admin/director/bizops", kind: "Director", title: "Business Operations" },
      { href: "/admin/director/farmops", kind: "Director", title: "Farming Operations" },
      { href: "/admin/director/culttech", kind: "Director", title: "Cultivation and Technology" },
      { href: "/admin/director/sales", kind: "Director", title: "Sales and Marketing" },
      { href: "/admin/director/finance", kind: "Director", title: "Accounting and Finance" },
    ],
  },
];

function adminTiles(members: AdminGroupMember[], locale: Locale): string {
  return members
    .map(
      (b) => `<a class="tile" href="${b.href}">
        <span class="tile-kind">${esc(b.kind)}</span>
        <span class="tile-title">${esc(t(locale, b.title))}</span>
      </a>`
    )
    .join("");
}

export function adminHomePage(locale: Locale = "en"): string {
  const buttons = ADMIN_GROUPS.map(
    (group) => `<a class="tile" href="${group.href}" data-admin-group="${group.key}">
        <span class="tile-kind">${esc(t(locale, "Admin"))}</span>
        <span class="tile-title">${esc(t(locale, group.title))}</span>
      </a>`
  ).join("");
  return `<h1>Admin</h1>
    <div class="tiles">${buttons}</div>`;
}

export function adminGroupPage(key: string, locale: Locale = "en"): string {
  const group = ADMIN_GROUPS.find((item) => item.key === key);
  if (!group) return "";
  return `<h1>${esc(t(locale, group.title))}</h1>
    <div class="tiles">${adminTiles(group.members, locale)}</div>`;
}

/** THE MODELS BUTTON (canon 0.30.86): the Models page, a tile per model tool
 * from the MODEL_TOOLS registry (his list: "1. [Harvest Menu Tool 2026]"),
 * each opening its vendored app at /models/<slug>/. */
export function modelsPage(locale: Locale = "en"): string {
  const tiles = MODEL_TOOLS.map(
    (tool) => `<a class="tile" href="${esc(modelToolPath(tool))}">
        <span class="tile-kind">${esc(t(locale, "Model"))}</span>
        <span class="tile-title">${esc(tool.title)}</span>
      </a>`
  ).join("");
  return `<h1>${esc(t(locale, "Models"))}</h1>
    <div class="tiles">${tiles}</div>`;
}

/** Owner ruling 2026-08-31: [Pending Data Uploads], a new Admin surface: the
 * CSVs awaiting upload to METRC, one format per data type, starting with Wet
 * Weights. A batch's file goes pending when the TL clicks Finish lot and leaves
 * on Mark uploaded; a later reasoned edit re-pends it on purpose. Owner ruling
 * 2026-08-31: the Plant fill rule; each pending row shows its tag count and
 * carries the paste form (one tag per line, Save tags REPLACES the set, an
 * empty paste clears it), and the muted Plant note now stands only while at
 * least one pending batch still has zero tags. */
export function pendingUploadsPage(
  rows: PendingUploadRow[],
  locale: Locale = "en",
  packageRows: PendingPackageUploadRow[] = [],
  receiveRows: PendingReceiveUploadRow[] = [],
  manifestRows: PendingManifestUploadRow[] = [],
  splitRows: PendingSplitUploadRow[] = [],
  locationRows: PendingLocationChangeRow[] = [],
  tagGaps: TagGaps = { movements: new Set(), batches: new Set(), parents: new Set() },
  moveRows: PendingLocationMoveRow[] = [],
  // THE CRYO RUN (canon 0.30.110): the New Packages files, one per finished run.
  newPackagesRows: PendingNewPackagesRow[] = [],
  // THE RECONCILE LEDGER LOCATION (canon 0.30.135): the notes awaiting a hand.
  reconcileNotes: ReconcileNoteRow[] = [],
  // THE TESTING DESK (canon 0.30.164): the New Packages CSV for a test manifest.
  testSampleRows: PendingTestSampleRow[] = [],
  prepackFiles: Array<{ id: string; hbn: string; kind: "new_packages" | "package_finish"; filename: string; newest_activity: string }> = [],
  changedRows: ChangedUploadRow[] = [],
  ok?: string
): string {
  const heading = `<h1>${esc(t(locale, "Pending Data Uploads"))}</h1>`;
  const ackFlash =
    ok === "acknowledged" || ok === "change_acknowledged"
      ? `<p class="banner ok" data-ack-flash>${esc(t(locale, "Acknowledged."))}</p>`
      : "";
  const notesSection = reconcileNotesSection(reconcileNotes, locale);
  const note = rows.some((row) => row.tag_count === 0)
    ? `<p class="muted">${esc(t(locale, "Plant column is blank pending the owner's fill rule."))}</p>`
    : "";
  // THE TAG LAW (canon 0.30.38): a file that would print an internal code where
  // METRC wants the package tag says so here, beside the file, before the
  // crew downloads it. The pencil on the package (or the station box) fills it.
  const tagGap = (missing: boolean) =>
    missing
      ? ` <span class="muted tag-missing" data-tag-missing title="${esc(t(locale, "The file prints the internal code where METRC wants the package tag; add the tag on the package (the pencil or the station box)."))}">${esc(t(locale, "no METRC tag yet"))}</span>`
      : "";
  const pendingTotal =
    rows.length +
    packageRows.length +
    receiveRows.length +
    manifestRows.length +
    splitRows.length +
    locationRows.length +
    moveRows.length +
    newPackagesRows.length +
    testSampleRows.length;
  if (pendingTotal === 0 && changedRows.length === 0) {
    // The notes stand on their own: no file to clear, only a hand to acknowledge.
    return `${heading}
    ${ackFlash}
    ${notesSection || `<p class="muted">${esc(t(locale, "Nothing pending."))}</p>`}`;
  }
  // THE PENDING QUEUE CLEAR (owner ruling 2026-09-16, canon 0.30.96, verbatim:
  // "CAN WE REMOVE ALL THE DOCS that are parked on pending data uploads?"). His
  // pick: cleared, NOT uploaded to METRC. A reveal guards the bulk button from a
  // stray click; the wording says plainly it is a clear, never a send.
  const clearAll = `<details class="clear-all" data-clear-all>
      <summary>${esc(t(locale, "Clear all pending"))} (${esc(String(pendingTotal))})</summary>
      <p class="muted">${esc(t(locale, "This clears every pending file below. It records them as cleared, not uploaded to METRC. New activity re-pends the time-based files."))}</p>
      <form method="post" action="/admin/uploads/clear-all">
        <button type="submit" class="danger">${esc(t(locale, "Clear all pending"))} (${esc(String(pendingTotal))})</button>
      </form>
    </details>`;
  // One-export-home law (owner, canon 0.22.0): manifests download and mark
  // uploaded HERE and nowhere else.
  const manForm = "up-manifests";
  const manHead = `<tr>${checkHead(manForm, locale)}<th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "From / To"))}</th><th>${esc(t(locale, "Last activity"))}</th><th>${esc(t(locale, "Controls"))}</th></tr>`;
  const manBody = manifestRows
    .map((row) => {
      const href = `/admin/uploads/manifest/${esc(row.id)}.csv`;
      const kindWord = row.movement_kind === "virtual" ? t(locale, "Virtual manifest") : t(locale, "Manifest");
      return `<tr>
        ${checkCell(manForm, "item", `manifest:${row.id}`)}
        <td>${esc(kindWord)}</td>
        <td><a href="${href}">${esc(row.metrc_manifest_number ?? row.filename)}</a>${tagGap(tagGaps.movements.has(row.id))}</td>
        <td>${esc(row.origin_license ?? "")} / ${esc(row.destination_license ?? "")}</td>
        <td>${esc(row.newest_activity)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="${href}">${esc(t(locale, "Download"))}</a>
          <form method="post" action="/admin/uploads/manifest/${esc(row.id)}/uploaded">
            <button type="submit">${esc(t(locale, "Mark uploaded"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const manifestsSection =
    manifestRows.length === 0
      ? ""
      : queueFold("manifests", `<h2 data-count="${manifestRows.length}">${esc(t(locale, "Manifests"))} <span class="tile-count">${manifestRows.length}</span></h2>`, `${uploadBatchBar(manForm, locale)}<table class="data"><thead>${manHead}</thead><tbody>${manBody}</tbody></table>`);
  const changedBody = changedRows
    .map((row) => {
      const file = wetWeightsFilename(row.hbn, row.seq);
      const grams = `${formatGrams(row.then_grams)} -> ${formatGrams(row.now_grams)} (${formatGrams(row.now_grams - row.then_grams)})`;
      const count = `${row.then_count ?? ""} -> ${row.now_count ?? ""}`;
      return `<tr data-changed-upload="${esc(row.id)}">
        <td>${esc(file)}</td>
        <td>${esc(row.marked_at)}</td>
        <td>${esc(grams)}</td>
        <td>${esc(count)}</td>
        <td>
          <form method="post" action="/admin/uploads/wet_weights/${esc(row.id)}/acknowledge" class="stack">
            <input type="text" name="reason" required>
            <button type="submit">${esc(t(locale, "Acknowledge"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const changedSection =
    changedRows.length === 0
      ? ""
      : `<section data-changed-after-upload><h2>${esc(t(locale, "Changed after upload"))}</h2><table class="data"><thead><tr><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "Marked"))}</th><th>${esc(t(locale, "Grams"))}</th><th>${esc(t(locale, "Plant count"))}</th><th></th></tr></thead><tbody>${changedBody}</tbody></table></section>`;
  const wetForm = "up-wet_weights";
  const head = `<tr>${checkHead(wetForm, locale)}<th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "Lot"))}</th><th>${esc(t(locale, "Load"))}</th><th>${esc(t(locale, "Wet total (g)"))}</th><th>${esc(t(locale, "Plant count"))}</th><th>${esc(t(locale, "Last activity"))}</th><th>${esc(t(locale, "Plant tags"))}</th><th>${esc(t(locale, "Controls"))}</th></tr>`;
  const body = rows
    .map((row) => {
      const href = `/admin/uploads/wet_weights/${esc(row.id)}.csv`;
      const unassigned = row.unassigned > 0 ? ` <span class="muted" data-unassigned>${esc(row.unassigned)} ${esc(t(locale, "unassigned"))}</span>` : "";
      const tags = row.tags_locked
        ? `<span class="muted">${esc(t(locale, "Plant tags"))}: ${esc(row.tag_count)}</span>${unassigned}`
        : `<span class="muted">${esc(t(locale, "Plant tags"))}: ${esc(row.tag_count)}</span>${unassigned}
          <form method="post" action="/admin/uploads/wet_weights/${esc(row.id)}/tags" class="stack">
            <textarea name="plant_tags" rows="3"></textarea>
            <button type="submit" class="secondary">${esc(t(locale, "Save tags"))}</button>
          </form>`;
      return `<tr>
        ${checkCell(wetForm, "item", `wet_weights:${row.id}`)}
        <td>${esc(t(locale, "Wet Weights"))}</td>
        <td><a href="${href}">${esc(wetWeightsFilename(row.hbn, row.seq))}</a></td>
        <td>${esc(row.lot)}</td>
        <td>${esc(row.load_label)}</td>
        <td>${esc(formatGrams(row.wet_total_grams))}</td>
        <td>${esc(row.plant_count ?? "")}</td>
        <td>${esc(row.newest_activity)}</td>
        <td>
          ${tags}
        </td>
        <td class="row-actions">
          <a class="btn secondary" href="${href}">${esc(t(locale, "Download"))}</a>
          <form method="post" action="/admin/uploads/wet_weights/${esc(row.id)}/uploaded">
            <button type="submit">${esc(t(locale, "Mark uploaded"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const pkgForm = "up-package_files";
  const pkgHead = `<tr>${checkHead(pkgForm, locale)}<th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "Lot"))}</th><th>${esc(t(locale, "Last activity"))}</th><th>${esc(t(locale, "Controls"))}</th></tr>`;
  const pkgBody = packageRows
    .map((row) => {
      const kindLabel =
        row.kind === "package_from_harvest"
          ? "Packages from Harvests"
          : row.kind === "package_finish"
            ? "Package finish"
            : "Package Adjustments";
      const href = `/admin/uploads/${esc(row.kind)}/${esc(row.id)}.csv`;
      return `<tr>
        ${checkCell(pkgForm, "item", `${row.kind}:${row.id}`)}
        <td>${esc(t(locale, kindLabel))}</td>
        <td><a href="${href}">${esc(row.kind === "package_from_harvest" ? `packages_from_harvests_${hbnWithSeq(row.hbn, row.seq)}.csv` : `package_adjustments_${hbnWithSeq(row.hbn, row.seq)}.csv`)}</a>${tagGap(tagGaps.batches.has(row.harvest_batch_id))}</td>
        <td>${esc(row.lot)}</td>
        <td>${esc(row.newest_activity)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="${href}">${esc(t(locale, "Download"))}</a>
          <form method="post" action="/admin/uploads/${esc(row.kind)}/${esc(row.id)}/uploaded">
            <button type="submit">${esc(t(locale, "Mark uploaded"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const wetTable =
    rows.length === 0
      ? ""
      : queueFold("wet_weights", `<h2 data-count="${rows.length}">${esc(t(locale, "Wet Weights"))} <span class="tile-count">${rows.length}</span></h2>`, `${uploadBatchBar(wetForm, locale)}<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`);
  const pkgTable =
    packageRows.length === 0
      ? ""
      : queueFold("package_files", `<h2 data-count="${packageRows.length}">${esc(t(locale, "Package files"))} <span class="tile-count">${packageRows.length}</span></h2>`, `${uploadBatchBar(pkgForm, locale)}<table class="data"><thead>${pkgHead}</thead><tbody>${pkgBody}</tbody></table>`);
  const recForm = "up-receive_manifest";
  const recHead = `<tr>${checkHead(recForm, locale)}<th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "Last activity"))}</th><th>${esc(t(locale, "Controls"))}</th></tr>`;
  const recBody = receiveRows
    .map((row) => {
      const href = `/admin/uploads/receive_manifest/${esc(row.id)}.csv`;
      return `<tr>
        ${checkCell(recForm, "item", `receive_manifest:${row.id}`)}
        <td>${esc(t(locale, "Receive manifest"))}</td>
        <td><a href="${href}">${esc(row.filename)}</a>${tagGap(tagGaps.movements.has(row.movement_id))}</td>
        <td>${esc(row.newest_activity)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="${href}">${esc(t(locale, "Download"))}</a>
          <form method="post" action="/admin/uploads/receive_manifest/${esc(row.id)}/uploaded">
            <button type="submit">${esc(t(locale, "Mark uploaded"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const recTable =
    receiveRows.length === 0
      ? ""
      : queueFold("receive_manifest", `<h2 data-count="${receiveRows.length}">${esc(t(locale, "Receive manifest"))} <span class="tile-count">${receiveRows.length}</span></h2>`, `${uploadBatchBar(recForm, locale)}<table class="data"><thead>${recHead}</thead><tbody>${recBody}</tbody></table>`);
  const splitForm = "up-package_split";
  const splitHead = `<tr>${checkHead(splitForm, locale)}<th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "Last activity"))}</th><th>${esc(t(locale, "Controls"))}</th></tr>`;
  const splitBody = splitRows
    .map((row) => {
      const href = `/admin/uploads/package_split/${esc(row.id)}.csv`;
      return `<tr>
        ${checkCell(splitForm, "item", `package_split:${row.id}`)}
        <td>${esc(t(locale, "Package split"))}</td>
        <td><a href="${href}">${esc(row.filename)}</a>${tagGap(tagGaps.parents.has(row.id))}</td>
        <td>${esc(row.newest_activity)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="${href}">${esc(t(locale, "Download"))}</a>
          <form method="post" action="/admin/uploads/package_split/${esc(row.id)}/uploaded">
            <button type="submit">${esc(t(locale, "Mark uploaded"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const splitTable =
    splitRows.length === 0
      ? ""
      : queueFold("package_split", `<h2 data-count="${splitRows.length}">${esc(t(locale, "Splits"))} <span class="tile-count">${splitRows.length}</span></h2>`, `${uploadBatchBar(splitForm, locale)}<table class="data"><thead>${splitHead}</thead><tbody>${splitBody}</tbody></table>`);
  // Canon 0.30.6: the Load Silo location changes, 832 Barn to 832 Silo n.
  const locForm = "up-location_change";
  const locHead = `<tr>${checkHead(locForm, locale)}<th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "Lot"))}</th><th>${esc(t(locale, "Silo"))}</th><th>${esc(t(locale, "Last activity"))}</th><th>${esc(t(locale, "Controls"))}</th></tr>`;
  const locBody = locationRows
    .map((row) => {
      const href = `/admin/uploads/location_change/${esc(row.id)}.csv`;
      return `<tr>
        ${checkCell(locForm, "item", `location_change:${row.id}`)}
        <td>${esc(t(locale, "Location change"))}</td>
        <td><a href="${href}">${esc(locationChangeFilename(row.hbn ?? "", row.file_location || row.silo_name || "silo", String(row.newest_activity).slice(0, 10).replaceAll("-", ""), row.seq))}</a>${tagGap(tagGaps.batches.has(row.harvest_batch_id))}</td>
        <td>${esc(row.lot)}</td>
        <td>${esc(row.silo_name ?? "")}</td>
        <td>${esc(row.newest_activity)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="${href}">${esc(t(locale, "Download"))}</a>
          <form method="post" action="/admin/uploads/location_change/${esc(row.id)}/uploaded">
            <button type="submit">${esc(t(locale, "Mark uploaded"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  // THE CHANGE LOCATION SETUP (canon 0.30.40): one row per Execute, plants or
  // packages, in the same Location changes section; a group whose labels are
  // internal codes says so (THE TAG LAW).
  const moveForm = "up-location_moves";
  const moveBody = moveRows
    .map((m) => {
      const href = `/admin/uploads/location_move/${esc(m.group_id)}.csv`;
      return `<tr data-location-move="${esc(m.group_id)}">
        ${checkCell(moveForm, "item", `location_move:${m.group_id}`)}
        <td>${esc(t(locale, m.kind === "plants" ? "Plant location change" : "Package location change"))}</td>
        <td><a href="${href}">${esc(m.license_value)} ${esc(m.move_date)}</a>${tagGap(m.untagged > 0)}</td>
        <td>${esc(String(m.moved))} ${esc(t(locale, m.kind === "plants" ? (m.moved === 1 ? "plant" : "plants") : m.moved === 1 ? "package" : "packages"))}</td>
        <td>${esc(m.from_summary || "-")} &#8594; ${esc(m.to_location)}</td>
        <td>${esc(m.newest_activity)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="${href}">${esc(t(locale, "Download"))}</a>
          <form method="post" action="/admin/uploads/location_move/${esc(m.group_id)}/uploaded">
            <button type="submit">${esc(t(locale, "Mark uploaded"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const moveHead = `<tr>${checkHead(moveForm, locale)}<th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "Moved"))}</th><th>${esc(t(locale, "From / To"))}</th><th>${esc(t(locale, "Last activity"))}</th><th>${esc(t(locale, "Controls"))}</th></tr>`;
  const moveTable =
    moveRows.length === 0
      ? ""
      : queueFold("location_moves", `<h2 data-count="${moveRows.length}">${esc(t(locale, "Location moves"))} <span class="tile-count">${moveRows.length}</span></h2>`, `${uploadBatchBar(moveForm, locale)}<table class="data" data-location-moves><thead>${moveHead}</thead><tbody>${moveBody}</tbody></table>`);
  const locTable =
    locationRows.length === 0
      ? ""
      : queueFold("location_change", `<h2 data-count="${locationRows.length}">${esc(t(locale, "Location changes"))} <span class="tile-count">${locationRows.length}</span></h2>`, `${uploadBatchBar(locForm, locale)}<table class="data"><thead>${locHead}</thead><tbody>${locBody}</tbody></table>`);
  // THE CRYO RUN (canon 0.30.110): one New Packages file per finished run, in
  // the owner's T3 autofill template; the outputs are true METRC tags by law,
  // so no tag gap can mark these rows.
  const npForm = "up-new_packages";
  const npHead = `<tr>${checkHead(npForm, locale)}<th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "HBN"))}</th><th>${esc(t(locale, "Packages"))}</th><th>${esc(t(locale, "Last activity"))}</th><th>${esc(t(locale, "Controls"))}</th></tr>`;
  const npBody = newPackagesRows
    .map((row) => {
      const href = `/admin/uploads/new_packages/${esc(row.id)}.xlsx`;
      return `<tr data-new-packages="${esc(row.id)}">
        ${checkCell(npForm, "item", `new_packages:${row.id}`)}
        <td>${esc(t(locale, "New Packages"))}</td>
        <td><a href="${href}">${esc(row.filename)}</a></td>
        <td>${esc(row.hbn)}</td>
        <td>${esc(String(row.outputs))} / ${esc(formatGrams(row.out_grams))} g</td>
        <td>${esc(row.newest_activity)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="${href}">${esc(t(locale, "Download"))}</a>
          <form method="post" action="/admin/uploads/new_packages/${esc(row.id)}/uploaded">
            <button type="submit">${esc(t(locale, "Mark uploaded"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const npTable =
    newPackagesRows.length === 0
      ? ""
      : queueFold("new_packages", `<h2 data-count="${newPackagesRows.length}">${esc(t(locale, "New Packages"))} <span class="tile-count">${newPackagesRows.length}</span></h2>`, `${uploadBatchBar(npForm, locale)}<table class="data" data-new-packages-table><thead>${npHead}</thead><tbody>${npBody}</tbody></table>`);
  const testForm = "up-test_sample";
  const testHead = `<tr>${checkHead(testForm, locale)}<th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "HBN"))}</th><th>${esc(t(locale, "Lab"))}</th><th>${esc(t(locale, "Samples"))}</th><th>${esc(t(locale, "Controls"))}</th></tr>`;
  const testBody = testSampleRows
    .map((row) => {
      const href = `/admin/uploads/test_sample/${esc(row.id)}.csv`;
      return `<tr data-test-sample="${esc(row.id)}">
        ${checkCell(testForm, "item", `test_sample:${row.id}`)}
        <td>${esc(t(locale, "Test samples"))}</td>
        <td><a href="${href}">${esc(row.filename)}</a>${tagGap(row.untagged > 0)}</td>
        <td>${esc(row.hbn)}</td>
        <td>${esc(row.lab_name)} · ${esc(row.license_value)}</td>
        <td>${esc(String(row.samples))}</td>
        <td class="row-actions">
          <a class="btn secondary" href="${href}">${esc(t(locale, "Download"))}</a>
          <form method="post" action="/admin/uploads/test_sample/${esc(row.id)}/uploaded">
            <button type="submit">${esc(t(locale, "Mark uploaded"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const testTable =
    testSampleRows.length === 0
      ? ""
      : queueFold("test_sample", `<h2 data-count="${testSampleRows.length}">${esc(t(locale, "Test samples"))} <span class="tile-count">${testSampleRows.length}</span></h2>`, `${uploadBatchBar(testForm, locale)}<table class="data" data-test-samples><thead>${testHead}</thead><tbody>${testBody}</tbody></table>`);
  const prepackForm = "up-prepack";
  const prepackBody = prepackFiles
    .map((row) => {
      const ext = row.kind === "new_packages" ? "xlsx" : "csv";
      const href = `/admin/uploads/${esc(row.kind)}/${esc(row.id)}.${ext}`;
      const label = row.kind === "new_packages" ? "New Packages" : "Package finish";
      return `<tr data-prepack-upload="${esc(row.kind)}" data-prepack-job="${esc(row.id)}">
        ${checkCell(prepackForm, "item", `${row.kind}:${row.id}`)}
        <td>${esc(t(locale, label))}</td>
        <td><a href="${href}">${esc(row.filename)}</a></td>
        <td>${esc(row.hbn)}</td>
        <td>${esc(row.newest_activity)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="${href}">${esc(t(locale, "Download"))}</a>
          <form method="post" action="/admin/uploads/${esc(row.kind)}/${esc(row.id)}/uploaded">
            <button type="submit">${esc(t(locale, "Mark uploaded"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const prepackTable =
    prepackFiles.length === 0
      ? ""
      : queueFold("prepack", `<h2 data-count="${prepackFiles.length}">${esc(t(locale, "Prepack"))} <span class="tile-count">${prepackFiles.length}</span></h2>`, `${uploadBatchBar(prepackForm, locale)}<table class="data" data-prepack-uploads><thead><tr>${checkHead(prepackForm, locale)}<th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "HBN"))}</th><th>${esc(t(locale, "Last activity"))}</th><th>${esc(t(locale, "Controls"))}</th></tr></thead><tbody>${prepackBody}</tbody></table>`);
  return `${heading}
    ${ackFlash}
    ${clearAll}
    ${note}
    ${changedSection}
    ${wetTable}
    ${pkgTable}
    ${recTable}
    ${manifestsSection}
    ${splitTable}
    ${locTable}
    ${moveTable}
    ${npTable}
    ${testTable}
    ${prepackTable}
    ${notesSection}
    ${QUEUE_FOLD_SCRIPT}`;
}

/** Owner ruling 2026-09-02: Admin [Import Data]. Queue the raw file; a parser
 * hangs later. No Edit. Void is reasoned through /record. */
export function importQueuePage(rows: ImportQueueRow[], locale: Locale = "en", flash = ""): string {
  const heading = `<h1>${esc(t(locale, "Import Data"))}</h1>`;
  const banner = flash ? `<p class="banner ok" data-in-testing-flash>${esc(flash)}</p>` : "";
  const form = `<form class="stack" method="post" action="/admin/imports" enctype="multipart/form-data">
      <label class="field">${esc(t(locale, "File"))}
        <input type="file" name="file" accept=".csv,.xlsx,.xlsb,.xlsm" required>
      </label>
      <button type="submit">${esc(t(locale, "Queue file"))}</button>
    </form>`;
  if (rows.length === 0) {
    return `${heading}
    ${banner}
    ${form}
    <p class="muted">${esc(t(locale, "Nothing queued."))}</p>`;
  }
  const head = `<tr><th>${esc(t(locale, "File"))}</th><th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "Size"))}</th><th>${esc(t(locale, "Status"))}</th><th>${esc(t(locale, "Uploaded by"))}</th><th>${esc(t(locale, "Uploaded at"))}</th><th>${esc(t(locale, "Controls"))}</th></tr>`;
  const body = rows
    .map((row) => {
      return `<tr>
        <td>${esc(row.filename)}</td>
        <td>${esc(row.kind)}</td>
        <td>${esc(formatByteSize(row.byte_size))}</td>
        <td>${esc(t(locale, row.status))}</td>
        <td>${esc(row.uploaded_by)}</td>
        <td>${esc(row.created_at)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="/admin/imports/${esc(row.id)}/download">${esc(t(locale, "Download"))}</a>
          <a class="btn secondary" href="/record/import_queue/${esc(row.id)}/void">${esc(t(locale, "Void"))}</a>
        </td>
      </tr>`;
    })
    .join("");
  return `${heading}
    ${banner}
    ${form}
    <table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function queueRowLabel(queue: QueueDef | undefined, row: QueueRow, index?: number): string {
  // Owner ruling 2026-09-08 (canon 0.30.9): from Trim Packages Entry forward the
  // lot reads last-6-of-tag / serial / market strain / grams with no decimals.
  if (queue?.lotLabel) {
    return lotTagLabel({
      metrc_harvest_tag: row.values.metrc_harvest_tag,
      short_id: row.values.short_id ?? row.id,
      strain: row.values.strain_name,
      grams: row.values[queue.lotLabel.weightField],
    });
  }
  const label = (queue?.optionFields ?? ["id"])
    .map((f) => displayValue(f, row.values))
    .filter(Boolean)
    .join(" / ");
  // Owner ruling 2026-09-04 (canon 0.22.0): sequence-numbered queues read
  // "1. Farm/Strain/Date" so the floor never parses an HBN token in a list.
  const seq = queue?.sequenceRows && index !== undefined ? `${index + 1}. ` : "";
  return seq + (label || row.id);
}

/** THE HBN ENTRY (canon 0.30.341): the queue row's age flag, ", weighing since
 * 2026-09-28", on a row whose weighing lot is older than yesterday's farm day
 * (listPaneRows fills values.weighing_since with that day, else blank). */
export function weighingSinceWords(row: QueueRow, locale: Locale): string {
  const since = row.values.weighing_since ?? "";
  if (!since) return "";
  return `<span class="muted" data-weighing-since="${esc(since)}">, ${esc(t(locale, "weighing since"))} ${esc(since)}</span>`;
}

/** THE HBN ENTRY (canon 0.30.341): "Bucked: lands in Silo 3 as WIP" or "Spear:
 * hangs in Hang in Place as SPR", with a muted "change on the HBN" link to the
 * HBN's Admin pencil; a Bucked HBN with no silo reads the refusal Start lot
 * would give. */
export function lotLandingLine(landing: LotLandingCtx, stationKey: string, pickId: string, locale: Locale): string {
  const back = `/station/${stationKey}?pick=${pickId}&new=1`;
  const href = `/record/harvest_batches/${esc(landing.hbnId)}/edit?back=${esc(encodeURIComponent(back))}`;
  const words =
    landing.form === "spear"
      ? `${t(locale, "Spear")}: ${tFill(locale, "hangs in {space} as SPR", { space: landing.spaceName ?? "" })}`
      : landing.spaceName
        ? `${t(locale, "Bucked")}: ${tFill(locale, "lands in {space} as WIP", { space: landing.spaceName })}`
        : `${t(locale, "Bucked")}: ${t(locale, "This HBN has no silo. Set it on the HBN first.")}`;
  return `<p class="lot-landing" data-lot-landing="${esc(landing.form)}" data-lot-landing-space="${esc(landing.spaceName ?? "")}">${esc(words)} <a class="muted" href="${href}">${esc(
    t(locale, "change on the HBN")
  )}</a></p>`;
}

/** Canon 0.30.67: the Team Lead field's hover help (the 0.26.0 help law). */
export const TEAM_LEAD_HELP = "Team Lead is the harvest crew lead on this lot, typed by hand. The Supervisor is the login and records itself.";

function stationForm(
  station: StationDef,
  people: PersonRow[],
  personId: string,
  fields: string,
  locale: Locale,
  formId?: string,
  hideSubmit = false
): string {
  // Owner ruling 2026-08-31: the actor is the login email, so stations carry no
  // Person picker. THE SUPERVISOR AND THE TEAM LEAD (canon 0.30.67; owner,
  // 2026-09-14, verbatim: "Minted HBNs are passing the Team Lead definition from
  // the cloudflare login email to the wet weight screen.  Let's make all
  // "Supervisors" the email, the team lead should be hand entered"): a station
  // with personLabel (the wet weight header) shows the login as the Supervisor,
  // a line and never a picker, and takes the Team Lead as a hand-typed name
  // that stores on the lot as team_lead. The old lead_person_id picker retired.
  // "make all Supervisors the email": the login email itself, the display name only for a row without one.
  const me = people.find((p) => p.id === personId);
  const supervisor = me?.email || me?.display_name || "";
  const lead = station.personLabel
    ? `<p class="muted supervisor-line" data-supervisor>${esc(t(locale, "Supervisor"))}: ${esc(supervisor)}</p>
      <label class="field" title="${esc(t(locale, TEAM_LEAD_HELP))}">${esc(t(locale, station.personLabel))}
        <input type="text" name="team_lead" required autocomplete="off" data-team-lead data-keep-operator>
      </label>`
    : "";
  const idAttr = formId ? ` id="${esc(formId)}"` : "";
  // THE FOUR START TAPS (canon 0.30.89): the header form locks its button on
  // the first tap (lockOnSubmitScript), so a second tap cannot post again.
  return `<form class="stack" method="post" action="/station/${esc(station.key)}"${idAttr} data-lock-on-submit>
      ${lead}
      ${fields}
      ${hideSubmit ? "" : `<button type="submit">${esc(t(locale, station.submitLabel ?? "Save"))}</button>`}
    </form>`;
}

/** THE FOUR START TAPS (canon 0.30.89): a form marked data-lock-on-submit
 * disables its submit button the moment it posts, so repeated taps while the
 * first post is in flight send nothing more; the server's repeat guard stands
 * behind it for the no-script case. */
/** THE DUPLICATE TAG (canon 0.30.112). Owner, 2026-09-17, verbatim: "When a
 * hard entered (under the entry surface) tag number is scanned into the entry
 * surface a warning (in the language selected at the pill) warns the user of a
 * duplicate tag and doesn't allow it to proceed." The warning line, in the
 * page's language, and the guard: the tag box is read against every entered
 * row's data-entered-tag as it is typed or scanned (case folded); a match shows
 * the warning and the plus (a scanner's Enter clicks the same button) does not
 * post. The server's own refusal stays behind it.
 *
 * CRYO ONLY (canon 0.30.114). Owner, 2026-09-17, verbatim: "The go/no-go
 * package dupe check needs to be removed from Trim, that's a cryo phenomenon.
 * A package is Id'd by its HBN until the cryo step." and "leave it how it was,
 * that's what I mean.  It didn't need anything". The trim line renders as it
 * did before 0.30.112: no guard, no data-entered-tag on its rows. */
export function duplicateTagGuard(locale: Locale): string {
  return `<p class="banner err" id="dup-tag-warning" role="alert" hidden data-dup-tag-warning>${esc(
    t(locale, "That tag is already entered beneath. Scan a different package.")
  )}</p>
        <script>
          (function () {
            function wire() {
              var btn = document.getElementById("add-pkg");
              var input = document.querySelector("#pkg-rows input[data-metrc-tag]");
              var warn = document.getElementById("dup-tag-warning");
              if (!btn || !input || btn.getAttribute("data-dup-guard") === "1") return;
              btn.setAttribute("data-dup-guard", "1");
              function norm(s) { return String(s || "").trim().toUpperCase(); }
              function isDuplicate() {
                var v = norm(input.value);
                if (v === "") return false;
                var rows = document.querySelectorAll("[data-entered-tag]");
                for (var i = 0; i < rows.length; i++) {
                  if (norm(rows[i].getAttribute("data-entered-tag")) === v) return true;
                }
                return false;
              }
              function check() {
                var dup = isDuplicate();
                if (warn) warn.hidden = !dup;
                input.setAttribute("aria-invalid", dup ? "true" : "false");
                return dup;
              }
              input.addEventListener("input", check);
              // Capture phase: this runs before the over-issue confirm bound
              // on the same button, which stands down when the default is prevented.
              btn.addEventListener("click", function (e) {
                if (check()) { e.preventDefault(); input.focus(); input.select(); }
              }, true);
            }
            // The plus button follows this script in the page, so wire once the
            // document has parsed (or now, if it already has).
            if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
            else wire();
          })();
        </script>`;
}

export function lockOnSubmitScript(): string {
  return `<script>
(function () {
  document.querySelectorAll("form[data-lock-on-submit]:not([data-lock-wired])").forEach(function (f) {
    f.setAttribute("data-lock-wired", "1");
    f.addEventListener("submit", function () {
      f.querySelectorAll('button[type="submit"]').forEach(function (b) { b.disabled = true; b.setAttribute("data-locked", "1"); });
    });
  });
})();
</script>`;
}

/** Renders every time[data-local] in the viewer's local clock (YYYY-MM-DD HH:MM), once. */
export function localTimeScript(): string {
  return `<script>
(function () {
  function pad(n) { return String(n).padStart(2, "0"); }
  document.querySelectorAll("time[data-local]:not([data-local-done])").forEach(function (el) {
    var ms = Date.parse(el.getAttribute("datetime") || "");
    if (!isFinite(ms)) return;
    var d = new Date(ms);
    el.textContent = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    el.setAttribute("data-local-done", "1");
  });
})();
</script>`;
}

/** Acquire HBN recall pane (owner ruling 2026-09-01). */
export type AcquireCtx = {
  recallRows: RecallableBatch[];
  prefill: RecallPrefill;
};

function acquireRecallPane(rows: RecallableBatch[], locale: Locale): string {
  const body =
    rows.length === 0
      ? `<p class="muted">${esc(t(locale, "No weightless HBNs."))}</p>`
      : `<ul>${rows
          .map(
            (row) => `<li class="recall-row">
          <span class="recall-hbn-label">${esc(row.hbn)}</span>
          <form class="recall-hbn" method="post" action="/station/acquire_hbn/recall">
            <input type="hidden" name="id" value="${esc(row.id)}">
            <button type="submit" class="recall-btn" title="${esc(t(locale, "recall HBN"))}" aria-label="${esc(t(locale, "recall HBN"))}">&#8617;</button>
          </form>
        </li>`
          )
          .join("")}</ul>`;
  return `<aside class="queue-pane recall-pane">
      <h2>${esc(t(locale, "Weightless HBNs"))} <span class="tile-count">${rows.length}</span></h2>
      ${body}
    </aside>`;
}

function acquireConfirmScript(locale: Locale): string {
  const message = t(locale, "Unsaved HBN data will be lost.");
  return `<script>
(function () {
  var form = document.getElementById("acquire-hbn-form");
  var msg = ${JSON.stringify(message)};
  function dirty() {
    if (!form) return false;
    var fields = form.querySelectorAll("input, select, textarea");
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (el.type === "hidden" || el.type === "submit") continue;
      if (el.type === "checkbox") { if (el.checked) return true; continue; }
      if (String(el.value || "").trim() !== "") return true;
    }
    return false;
  }
  document.querySelectorAll("form.recall-hbn").forEach(function (recall) {
    recall.addEventListener("submit", function (e) {
      if (dirty() && !confirm(msg)) e.preventDefault();
    });
  });
  function growFor(farm) {
    if (farm === "ARL") return "AU-G-C-001509";
    if (farm === "PNS") return "AU-G-C-001397";
    return "AU-G-C-000832";
  }
  function filterLicenses() {
    if (!form) return;
    var farmSel = form.querySelector('[name="farm_code"]');
    var licSel = form.querySelector('[name="license_value"]');
    if (!farmSel || !licSel) return;
    var farm = farmSel.value || "";
    var grow = growFor(farm);
    for (var i = 0; i < licSel.options.length; i++) {
      var opt = licSel.options[i];
      var f = opt.getAttribute("data-farm") || "";
      opt.hidden = Boolean(farm && f && f !== farm);
    }
    var cur = licSel.options[licSel.selectedIndex];
    if (!licSel.value || (cur && cur.hidden)) licSel.value = grow;
    if (licSel.dispatchEvent) licSel.dispatchEvent(new Event("change"));
  }
  if (form) {
    var farmSel = form.querySelector('[name="farm_code"]');
    if (farmSel) farmSel.addEventListener("change", filterLicenses);
    filterLicenses();
  }
})();
</script>`;
}

/** Owner ruling 2026-08-31: "The weights of the original package and what's
 * left after a record is created should be on the weight recording pages."
 * The balance a pick-station's picked view shows above its form: trim's
 * Original (dry) is the picked lot's dry total, Recorded the sum of its
 * non-voided packages, Remaining the difference. A rule of thumb only; it can
 * go negative and renders as-is. */
export type PickBalanceCtx = {
  original: number;
  recorded: number;
  remaining: number;
};

export type TrimCtx = {
  entered: TrimPackageRow[];
};

/** Owner ruling 2026-09-08 (canon 0.30.9, verbatim: "when I go over in trim
 * packages entry, I need to be prompted that I'm at 0 and the option provided
 * to remove it from queue."): the REMAINING 0 prompt with [Remove from queue].
 * Over names the overage and says the adjustment CSV will pend (fork 7's
 * corrective lane, papered on the remove). */
function trimRemainingZeroPrompt(stationKey: string, lotId: string, balance: PickBalanceCtx, locale: Locale): string {
  if (balance.remaining > 0) return "";
  const over = balance.remaining < 0;
  const overLine = over
    ? ` ${esc(t(locale, "Over by"))} ${esc(reconcileDeltaLabel(Math.abs(balance.remaining)))} g. ${esc(
        t(locale, "Removing it pends the adjustment CSV at the export home.")
      )}`
    : "";
  return `<section class="reconcile-gate remaining-zero" data-remaining-zero data-over="${over ? "1" : "0"}">
      <h3>${esc(t(locale, "Remaining 0."))}${overLine}</h3>
      <div class="row-actions">
        <form method="post" action="/station/${esc(stationKey)}">
          <input type="hidden" name="wet_weight_entry_id" value="${esc(lotId)}">
          <input type="hidden" name="gate_choice" value="remove">
          <button type="submit">${esc(t(locale, "Remove from queue"))}</button>
        </form>
      </div>
    </section>`;
}

/** Owner ruling 2026-09-08 (canon 0.30.9, verbatim: "Trim packages entry
 * should show the entered packages below the working pane, ordered by latest
 * to oldest, pencil and "x" PIN gated"): the list, newest first; the pencil
 * and the x lead to the reasoned record edit and void, which sit behind the
 * PIN (the /record/wip_packages gate). */
function trimEnteredList(rows: TrimPackageRow[], locale: Locale): string {
  const body =
    rows.length === 0
      ? `<p class="muted">${esc(t(locale, "No packages entered yet."))}</p>`
      : `<table class="data trim-entered" data-trim-entered>
        <thead><tr><th>${esc(t(locale, "Package tag"))}</th><th>${esc(t(locale, "Type"))}</th><th>${esc(t(locale, "Weight (g)"))}</th><th>${esc(
          t(locale, "Date")
        )}</th><th>${esc(t(locale, "Operator"))}</th><th>${esc(t(locale, "Controls"))}</th></tr></thead>
        <tbody>${rows
          .map(
            (r) => `<tr data-package="${esc(r.id)}"${isMetrcTag(r.package_code) ? "" : ' data-tag-shape="off"'}>
          <td>${esc(r.package_code)}${isMetrcTag(r.package_code) ? "" : ` <span class="muted tag-shape-note" title="${esc(t(locale, "Not a METRC tag shape (1A plus 22 hex); kept as typed"))}">?</span>`}</td>
          <td>${esc(r.package_type_code)}</td>
          <td>${esc(formatGrams(r.weight_grams))}</td>
          <td>${esc(r.trim_date ?? r.created_at.slice(0, 10))}</td>
          <td>${esc(r.trim_operator ?? "")}</td>
          <td class="row-actions">
            <a class="btn secondary pencil" href="/record/wip_packages/${esc(r.id)}/edit" title="${esc(t(locale, "Edit with reason (PIN)"))}" aria-label="Edit package">&#9998;</a>
            <a class="btn secondary" href="/record/wip_packages/${esc(r.id)}/void" title="${esc(t(locale, "Void with reason (PIN)"))}" aria-label="Void package">&times;</a>
          </td>
        </tr>`
          )
          .join("")}</tbody>
      </table>`;
  return `<section class="trim-entered-block">
      <h3>${esc(t(locale, "Entered packages"))} <span class="tile-count">${esc(String(rows.length))}</span></h3>
      ${body}
    </section>`;
}

function trimReconcileGate(
  stationKey: string,
  lotId: string,
  balance: PickBalanceCtx,
  locale: Locale
): string {
  const gate = reconcileGate({
    recorded: balance.recorded,
    parentQty: balance.original,
    mode: "bucked",
  });
  if (gate.kind === "exact") return "";
  // Canon 0.30.1 fork 7: the Finish-package-in-METRC choice is gone from
  // every gate; the adjustment CSV is the corrective lane.
  const choiceLabel = (id: string) => {
    if (id === "queue_adjust") return t(locale, "Queue an adjustment CSV");
    if (id === "nothing") return t(locale, "Nothing, just finish");
    return t(locale, "Back to weighing");
  };
  return `<section class="reconcile-gate" data-reconcile-gate data-gate-kind="${esc(gate.kind)}">
      <h3>${
        gate.kind === "over"
          ? `${esc(t(locale, "Over issued by"))} ${esc(reconcileDeltaLabel(gate.absDelta))} g. ${esc(t(locale, "METRC needs this addressed now."))}`
          : esc(t(locale, "Recorded short of the parent. Queue an adjustment CSV, weigh more, or finish with a deliberate nothing."))
      }</h3>
      <div class="row-actions">
        ${gate.choices
          .map(
            (choice) => `<form method="post" action="/station/${esc(stationKey)}">
          <input type="hidden" name="wet_weight_entry_id" value="${esc(lotId)}">
          <input type="hidden" name="gate_choice" value="${esc(choice.id)}">
          <button type="submit">${esc(choiceLabel(choice.id))}</button>
        </form>`
          )
          .join("")}
      </div>
    </section>`;
}

/** THE HBN ENTRY (canon 0.30.341): where the picked HBN's next lot lands, read
 * off the HBN (its form and its sequence silo), rendered as one read-only line
 * under the HBN with a link to the HBN's pencil. spaceName null on a Bucked HBN
 * with no numeric silo. */
export type LotLandingCtx = {
  form: "spear" | "bucked";
  spaceName: string | null;
  hbnId: string;
};

/** Context the ledger station's picked page needs beyond the queue rows. */
export type StationLedgerCtx = {
  farmName: string;
  /** The Move To select's options; the wet header carries no Move To since canon 0.30.341 (kept for the renderer). */
  moveToOptions?: LookupOption[];
  landing?: LotLandingCtx;
  /** Owner ruling 2026-08-31: record-borne truck numbers derived from this batch's
   * own lots. Absent when the farm law disallows kind truck (no truck options and
   * no Add a truck control); an empty array means allowed but none yet. */
  truckOptions?: string[];
  /** The next number staged by Add a truck (?truck=<n>), rendered preselected. */
  stagedTruck?: string;
  resumeLots: Array<{ id: string; created_at: string; weight_grams: number; truck_number?: string | null; dry_space_name?: string | null; team_lead?: string | null; hbn?: string | null }>;
  /** Owner ruling 2026-09-01 (alpha): with lots in progress the header form
   * collapses behind Start another lot; ?new=1 (or a staged truck) opens it. */
  newFormOpen?: boolean;
  /** THE TRUCK RECORD (canon 0.30.226): the next Truck # for this farm's lots today. */
  suggestedTruck?: string;
};

const ADD_TRUCK_FORM_ID = "add-truck-form";

function moveToField(
  field: Extract<FieldDef, { input: "move_to" }>,
  ctx: StationLedgerCtx,
  locale: Locale
): string {
  // Owner ruling 2026-08-31: standing rows keep their real dry_spaces ids; each
  // derived truck renders as the encoded truck-<n>, labeled per locale, and the
  // staged next number preselects. Trucks never persist in the catalog.
  const truckOption = (n: string, selected: boolean) =>
    `<option value="truck-${esc(n)}"${selected ? " selected" : ""}>${esc(`${t(locale, "Truck")} ${n}`)}</option>`;
  const opts = [
    `<option value=""></option>`,
    ...(ctx.moveToOptions ?? []).map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`),
    ...(ctx.truckOptions ?? []).map((n) => truckOption(n, false)),
    ...(ctx.stagedTruck ? [truckOption(ctx.stagedTruck, true)] : []),
  ].join("");
  const addTruck = ctx.truckOptions
    ? `<button type="submit" class="secondary" form="${ADD_TRUCK_FORM_ID}">${esc(t(locale, "Add a truck"))}</button>`
    : "";
  return withFieldHelp(
    `<label class="field">${esc(t(locale, field.label))}
      <span class="move-to-row">
        <select name="${esc(field.name)}"${field.required ? " required" : ""}>${opts}</select>
        ${addTruck}
      </span>
    </label>`,
    field,
    locale
  );
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
  locale: Locale = "en",
  // Owner ruling 2026-08-31: on a direct ledger station the picked page stays on
  // the two-pane theme ("left pane: available-in-queue, right pane: what's
  // currently saved about that record and the ability to add more to it"); the
  // caller renders the record panel and passes it here as the right pane.
  ledgerPanel?: string,
  // Owner ruling 2026-08-31: the pick-station balance (trim's Original (dry) /
  // Recorded / Remaining), rendered above the form when the route passes one.
  pickBalance?: PickBalanceCtx,
  // Owner ruling 2026-09-01: Acquire HBN keeps its plain mint form (ADR-8's
  // standing exception) and gains a RIGHT pane of weightless open batches.
  acquireCtx?: AcquireCtx,
  showGate = false,
  // Owner rulings 2026-09-08 (canon 0.30.9): the trim pick's entered packages
  // (newest first, pencil and x behind the PIN) beneath the working pane.
  trimCtx?: TrimCtx
): string {
  const heading = `<h1>${esc(t(locale, station.title))}</h1>`;
  if (!station.leftPane) {
    const prefill = acquireCtx?.prefill ?? {};
    const fields = station.fields
      .map((f) => renderField(f, lookups, queueOptions, queuesByKey, locale, undefined, prefill))
      .join("\n");
    const form = stationForm(
      station,
      people,
      personId,
      fields,
      locale,
      station.key === "acquire_hbn" ? "acquire-hbn-form" : undefined
    );
    if (station.key !== "acquire_hbn") {
      return `${heading}
    ${form}`;
    }
    return `${heading}
    <div class="station-split acquire-split">
      <div class="working-pane">
        ${form}
      </div>
      ${acquireRecallPane(acquireCtx?.recallRows ?? [], locale)}
    </div>
    ${acquireConfirmScript(locale)}`;
  }
  const pane = station.leftPane;
  const queue = queuesByKey[pane.queue];
  const rows = paneRows ?? queueOptions[pane.queue] ?? [];
  const picked = pickId ? rows.find((row) => row.id === pickId) : undefined;
  const paneItems = (list: QueueRow[]) =>
    list
      .map((row, i) => {
        const cls = row.id === picked?.id ? "queue-pane-item selected" : "queue-pane-item";
        return `<li><a class="${cls}" href="/station/${esc(station.key)}?pick=${esc(row.id)}">${esc(queueRowLabel(queue, row, i))}${weighingSinceWords(row, locale)}</a></li>`;
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
  const direct = station.ledger?.mode === "direct";
  // Owner ruling 2026-08-31: the two-pane theme is the station law for
  // everything ("left pane: available-in-queue, right pane: what's currently
  // saved about that record and the ability to add more to it"). A provided
  // record panel renders as the right pane on every ledger station, whether or
  // not the record's row still sits in the filtered pane: a wet lot whose batch
  // has left the pane keeps its panel with no row marked.
  if (ledgerPanel) {
    return `${heading}
    <div class="station-split">
      ${aside}
      <div class="working-pane">
        ${ledgerPanel}
      </div>
    </div>`;
  }
  // Owner ruling 2026-08-31: a direct ledger station prompts for a lot from the
  // pane and renders only a provided record panel, never a header create form;
  // every other pane station keeps the wet prompt byte for byte. (THE CRYO RUN,
  // canon 0.30.110, retired the cryo bulk form with the per-package widget.)
  if (direct || !picked) {
    const promptKey = direct ? "Pick a lot from the pane." : "Pick from the left to begin.";
    return `${heading}
    <div class="station-split">
      ${aside}
      <div class="working-pane"><p class="muted">${esc(t(locale, promptKey))}</p></div>
    </div>`;
  }
  const isLedger = Boolean(station.ledger && ledgerCtx);
  const fields = station.fields
    .map((f) => {
      if (picked && f.name === pane.pickField) {
        // THE HBN ENTRY (canon 0.30.341): the landing line sits right under the HBN.
        const landing = isLedger && ledgerCtx?.landing ? lotLandingLine(ledgerCtx.landing, station.key, picked.id, locale) : "";
        return `<input type="hidden" name="${esc(pane.pickField)}" value="${esc(picked.id)}">${landing}`;
      }
      if (f.input === "move_to" && isLedger) return moveToField(f, ledgerCtx!, locale);
      const values = ledgerCtx?.suggestedTruck ? { truck_number: ledgerCtx.suggestedTruck } : undefined;
      return renderField(f, lookups, queueOptions, queuesByKey, locale, picked, values);
    })
    .join("\n");
  // Owner ruling 2026-08-28: the ledger header is the HBN, a plain spaced hyphen,
  // then the farm's display name spelled out. A non-ledger pick heads with the
  // picked row's queue label, the saved-record side (owner ruling 2026-08-31);
  // the bulk cryo form carries no pick heading at all.
  // Owner ruling 2026-09-04 (canon 0.22.0): the picked heading takes the same
  // simple Farm/Strain/Date form as the pane; the full HBN rides muted beneath.
  const pickHeading = picked
    ? `<h2 class="working-pick">${esc(queueRowLabel(queue, picked))}</h2>${
        isLedger && picked.values.hbn ? `<p class="muted">${esc(String(picked.values.hbn))}</p>` : ""
      }`
    : "";
  // Owner ruling 2026-08-31: "The weights of the original package and what's
  // left after a record is created should be on the weight recording pages."
  // A passed balance renders above the form as a compact meta list.
  // Canon 0.30.9: at or past zero the REMAINING 0 prompt (with [Remove from
  // queue]) replaces the old over-issue banner and the over gate.
  const balance = pickBalance
    ? `<dl class="lot-meta" data-balance-remaining="${esc(String(pickBalance.remaining))}">
        <dt>${esc(t(locale, "Original (dry)"))}</dt><dd>${esc(formatGrams(pickBalance.original))} g</dd>
        <dt>${esc(t(locale, "Recorded"))}</dt><dd>${esc(formatGrams(pickBalance.recorded))} g</dd>
        <dt>${esc(t(locale, "Remaining"))}</dt><dd>${esc(formatGrams(pickBalance.remaining))} g</dd>
      </dl>${trimRemainingZeroPrompt(station.key, pickId ?? "", pickBalance, locale)}`
    : "";
  const resumeLots = isLedger ? ledgerCtx!.resumeLots : [];
  // THE FOUR START TAPS (canon 0.30.89; owner, 2026-09-16: "What's happening?"
  // over four lots labeled by their UTC instants): each lot reads its start in
  // the viewer's local time, its Move To (a record-borne truck by number), its
  // Team Lead and its total, so two lots born seconds apart tell apart.
  const resume =
    resumeLots.length > 0
      ? `<div class="resume-lots">
        <h3>${esc(t(locale, "Lots in progress"))}</h3>
        <ul>${resumeLots
          .map((lot) => {
            const moveTo = lot.truck_number
              ? `${t(locale, "Truck")} ${lot.truck_number}${lot.hbn ? ` - ${lot.hbn}` : ""}`
              : lot.dry_space_name ?? "";
            const who = [moveTo, lot.team_lead ?? ""].filter(Boolean).map((x) => ` · ${esc(x)}`).join("");
            return `<li><a href="/station/${esc(station.key)}?lot=${esc(lot.id)}"><time datetime="${esc(lot.created_at)}" data-local>${esc(lot.created_at)}</time>${who} (total ${esc(formatGrams(lot.weight_grams))} g)</a></li>`;
          })
          .join("")}</ul>
      </div>${localTimeScript()}`
      : "";
  // The Add a truck button inside the station form submits this sibling form (form attribute);
  // forms cannot nest. It carries the staged number so the next click increments it
  // (owner ruling 2026-08-31: staging writes nothing until Start lot).
  const addTruckForm =
    picked && isLedger && ledgerCtx!.truckOptions
      ? `<form id="${ADD_TRUCK_FORM_ID}" method="post" action="/station/${esc(station.key)}/add_truck">
        <input type="hidden" name="pick" value="${esc(picked.id)}">${
          ledgerCtx!.stagedTruck
            ? `\n        <input type="hidden" name="truck" value="${esc(ledgerCtx!.stagedTruck)}">`
            : ""
        }
      </form>`
      : "";
  // Owner ruling 2026-09-01 (alpha feedback): when lots are in progress the
  // resume panel leads and the header form collapses behind Start another lot,
  // so fixing a weight can never invite a duplicate header entry. The redirect
  // in the route already handles the single-lot case; this renders 2+ lots and
  // the explicit ?new=1 form.
  const trimGate =
    showGate && pickBalance && pickBalance.remaining > 0
      ? trimReconcileGate(station.key, pickId ?? "", pickBalance, locale)
      : "";
  const headerForm = `${stationForm(station, people, personId, fields, locale, undefined, Boolean(trimGate))}
        ${addTruckForm}${lockOnSubmitScript()}`;
  const formBlock =
    resumeLots.length > 0 && !(isLedger && ledgerCtx!.newFormOpen)
      ? `<details class="start-another">
        <summary>${esc(t(locale, "Start another lot"))}</summary>
        ${headerForm}
      </details>`
      : headerForm;
  const entered = picked && trimCtx ? trimEnteredList(trimCtx.entered, locale) : "";
  return `${heading}
    <div class="station-split">
      ${aside}
      <div class="working-pane">
        ${pickHeading}
        ${trimGate}
        ${resume}
        ${balance}
        ${formBlock}
        ${entered}
      </div>
    </div>`;
}

/** The weights ledger pane shared by the wet lot page and the dry record panel:
 * the add form, the finish, the reasoned pencil and void per row, and the
 * running total outside the pane at the bottom (owner rulings 2026-08-28 wet,
 * 2026-08-31 dry). The record links ride the station's ledger table. */
function weightsSection(
  station: StationDef,
  lotId: string,
  weights: Array<{ id: string; weight_grams: number; created_at: string; harvest_batch_id?: string | null; hbn?: string | null }>,
  total: number,
  labels: { pane: string; finish: string; total: string },
  locale: Locale,
  finishExtra = "",
  opts: {
    parentQty?: number | null;
    rapidFocus?: boolean;
    hideFinish?: boolean;
    /** Owner ruling 2026-09-14 (canon 0.30.58, verbatim: "Put a number starting
     * at one and going to infinity for every weight in wet weight entry, add to
     * the top of the list like before (the TLs will ask how many totes before I
     * start the silo)"): a leading # column counting the lot's live weights from
     * one, oldest first, so the newest row at the top reads the tote count. */
    numbered?: boolean;
    /** THE PLANT COUNT (owner ruling 2026-09-14, canon 0.30.62): Finish lot
     * first asks how many plants the lot holds, with Skip; the answer or the
     * skip rides the same finish post (plant_count, plant_prompt). */
    plantPrompt?: boolean;
    hbnSelect?: string;
    headerHbnId?: string;
    finishBlocks?: string;
  } = {}
): string {
  const table = station.ledger?.table ?? "wet_weights";
  const numbered = opts.numbered === true;
  const count = weights.length;
  const rows = weights
    .map(
      (w, i) => `<tr${numbered ? ` data-weight-seq="${count - i}"` : ""}>
        ${numbered ? `<td class="weight-seq">${count - i}</td>` : ""}<td>${esc(formatGrams(w.weight_grams))}${
          w.hbn && w.harvest_batch_id && w.harvest_batch_id !== opts.headerHbnId
            ? ` <span class="muted" title="${esc(w.hbn)}">${esc(shortLotId(w.hbn, null))}</span>`
            : ""
        }</td>
        <td>${esc(w.created_at)}</td>
        <td class="row-actions">
          <a class="btn secondary" href="/record/${esc(table)}/${esc(w.id)}/edit" title="Edit" aria-label="Edit weight">&#9998;</a>
          <a class="btn secondary" href="/record/${esc(table)}/${esc(w.id)}/void" title="Void" aria-label="Void weight">&times;</a>
        </td>
      </tr>`
    )
    .join("");
  const seqHead = numbered ? `<th class="weight-seq" title="${esc(t(locale, "Totes so far, counted from the first weight"))}">#</th>` : "";
  const list =
    weights.length > 0
      ? `<table class="data${numbered ? " weights-numbered" : ""}"><thead><tr>${seqHead}<th>Weight (g)</th><th>Added</th><th>${esc(t(locale, "Controls"))}</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p class="muted">No weights yet.</p>`;
  const parentQty = opts.parentQty;
  const watchOverissue = parentQty != null && Number.isFinite(parentQty);
  const overAmount = watchOverissue ? total - Number(parentQty) : 0;
  // Patrick 2026-09-11 (canon 0.30.37): the recorded total landing exactly on
  // the parent is the clean case, not an over issue; the banner and the ask
  // fire only past the parent (THE OVERISSUE LINE IS STRICT).
  const standingBanner =
    watchOverissue && isOverIssued(total, Number(parentQty))
      ? `<p class="banner overissue-banner" data-overissue-banner>${esc(t(locale, "Over issued by"))} ${esc(formatGrams(overAmount))} g. ${esc(t(locale, "METRC needs this addressed now."))}</p>`
      : "";
  const confirmMsg = t(locale, "This weight over issues the parent package. Record it anyway?");
  const addAttrs = watchOverissue
    ? ` data-overissue-form data-parent-qty="${esc(Number(parentQty))}" data-recorded-total="${esc(total)}" data-overissue-confirm="${esc(confirmMsg)}"`
    : "";
  const rapidBtn =
    station.ledger?.table === "dry_weights"
      ? `<button type="submit" class="secondary rapid-add" name="rapid_add" value="1" aria-label="${esc(t(locale, "Add and continue"))}" title="${esc(t(locale, "Add and continue"))}">+</button>`
      : "";
  const focusAttr = opts.rapidFocus ? " data-rapid-focus" : "";
  const overissueLine = watchOverissue
    ? `<p class="muted" data-overissue-line hidden>${esc(t(locale, "This weight over issues the parent package. Record it anyway?"))}</p>`
    : "";
  const overissueScript = watchOverissue
    ? `<script>
(function () {
  var form = document.querySelector("[data-overissue-form]");
  if (!form) return;
  var parent = Number(form.getAttribute("data-parent-qty") || "0");
  var recorded = Number(form.getAttribute("data-recorded-total") || "0");
  var msg = form.getAttribute("data-overissue-confirm") || "";
  var line = form.querySelector("[data-overissue-line]");
  function typed() {
    var input = form.querySelector('input[name="weight_grams"]');
    return Number(input && input.value ? input.value : 0);
  }
  function wouldOver() { return typed() + recorded > parent + ${OVERISSUE_TOLERANCE_GRAMS}; }
  function sync() {
    if (!line) return;
    if (wouldOver()) line.removeAttribute("hidden");
    else line.setAttribute("hidden", "");
  }
  form.addEventListener("input", sync);
  form.addEventListener("submit", function (e) {
    if (wouldOver() && !confirm(msg)) e.preventDefault();
  });
  sync();
})();
</script>`
    : "";
  const rapidScript = opts.rapidFocus
    ? `<script>
(function () {
  var input = document.querySelector("[data-rapid-focus]");
  if (input && input.focus) input.focus();
})();
</script>`
    : "";
  const finishForm = opts.hideFinish
    ? ""
    : opts.plantPrompt
      ? `<form method="post" action="/station/${esc(station.key)}/lot/${esc(lotId)}/finish" class="row-actions finish-with-plants" data-plant-prompt-form>
          ${finishExtra}
          <button type="submit" class="secondary" data-plant-prompt-open>${esc(t(locale, labels.finish))}</button>
          <div class="plant-prompt" data-plant-prompt hidden>
            ${
              opts.finishBlocks ??
              `<label class="field">${esc(t(locale, "How many plants in this load?"))} <input type="text" name="plant_count" inputmode="numeric" pattern="[0-9,]*" placeholder="${esc(t(locale, "plants"))}" data-plant-count-input></label>`
            }
            <div class="row-actions">
              <button type="submit" name="plant_prompt" value="count">${esc(t(locale, labels.finish))}</button>
              <button type="submit" name="plant_prompt" value="skip" class="secondary" data-plant-skip>${esc(t(locale, "Skip"))}</button>
            </div>
            <p class="muted">${esc(t(locale, "Skip asks again at Load Silo; the METRC file splits the total across the plants."))}</p>
          </div>
        </form>${plantPromptScript()}`
      : `<form method="post" action="/station/${esc(station.key)}/lot/${esc(lotId)}/finish" class="row-actions">
          ${finishExtra}
          <button type="submit" class="secondary">${esc(t(locale, labels.finish))}</button>
        </form>`;
  return `<section class="weights-pane">
      <h3>${esc(t(locale, labels.pane))}</h3>
      ${standingBanner}
      <div class="weights-controls">
        <form method="post" action="/station/${esc(station.key)}/lot/${esc(lotId)}/weights" class="row-actions"${addAttrs}>
          ${opts.hbnSelect ?? ""}
          <input type="number" name="weight_grams" step="0.01" min="0" placeholder="grams" required autofocus${focusAttr}>
          <button type="submit">${esc(t(locale, "Add a weight"))}</button>
          ${rapidBtn}
          ${overissueLine}
        </form>
        ${finishForm}
      </div>
      ${list}
    </section>
    <p class="lot-total">${esc(t(locale, labels.total))}: <strong>${esc(formatGrams(total))}</strong> g</p>
    ${overissueScript}${rapidScript}`;
}

/** THE PLANT COUNT prompt (canon 0.30.62): the first Finish lot click reveals
 * the question instead of posting; the two buttons inside post the count or
 * the skip. Without script the first button posts straight through, which the
 * action reads as a skip (the Load Silo page asks again). */
function plantPromptScript(): string {
  return `<script>
(function () {
  var form = document.querySelector("[data-plant-prompt-form]");
  if (!form) return;
  var open = form.querySelector("[data-plant-prompt-open]");
  var prompt = form.querySelector("[data-plant-prompt]");
  var input = form.querySelector("[data-plant-count-input]");
  if (!open || !prompt) return;
  open.addEventListener("click", function (e) {
    e.preventDefault();
    prompt.hidden = false;
    open.hidden = true;
    if (input && input.focus) input.focus();
  });
})();
</script>`;
}

/** The wet lot record panel (owner ruling 2026-08-31: the two-pane theme is the
 * station law for everything, "left pane: available-in-queue, right pane: what's
 * currently saved about that record and the ability to add more to it"): the
 * right pane of the wet station's lot view, embedded by stationPage as its
 * ledgerPanel. Keeps the HBN - farm heading, the read-only lot text, the Weights
 * pane with Add a weight and the reasoned pencil and void, Finish lot, and the
 * running total outside the pane at the bottom (owner ruling 2026-08-28). */
export function wetLotPanel(
  station: StationDef,
  lot: {
    id: string;
    hbn: string | null;
    harvest_batch_id?: string | null;
    farm_code?: string | null;
    strain_name?: string | null;
    entry_date?: string | null;
    notes: string | null;
    dry_space_name: string | null;
    truck_number: string | null;
    material_form?: string | null;
    lead_name: string | null;
    /** Canon 0.30.67: the login that started the lot, the Supervisor. */
    supervisor_name?: string | null;
    plant_count?: number | null;
  },
  weights: Array<{ id: string; weight_grams: number; created_at: string; harvest_batch_id?: string | null; hbn?: string | null }>,
  farmName: string,
  total: number,
  locale: Locale = "en",
  hbnOptions: Array<{ id: string; hbn: string; label: string }> = []
): string {
  // Owner ruling 2026-08-31: a record-borne truck lot labels its destination
  // Truck <n> from its own truck_number, never from the bare sentinel row's name.
  const moveTo = lot.dry_space_name ?? "";
  const truckLine = lot.truck_number
    ? `<dt>${esc(t(locale, "Truck #"))}</dt><dd data-truck-number>${esc(
        lot.hbn ? `${t(locale, "Truck")} ${lot.truck_number} - ${lot.hbn}` : `${t(locale, "Truck")} ${lot.truck_number}`
      )}</dd>`
    : "";
  const headerId = lot.harvest_batch_id ?? "";
  const newest = weights[0];
  const selectedId = newest?.harvest_batch_id || headerId;
  const hbnSelect =
    hbnOptions.length > 0
      ? `<label class="field">${esc(t(locale, "HBN"))}<select name="harvest_batch_id" data-tote-hbn>${hbnOptions
          .map((row) => `<option value="${esc(row.id)}"${row.id === selectedId ? " selected" : ""}>${esc(row.label)} (${esc(row.hbn)})</option>`)
          .join("")}</select></label>`
      : "";
  const groups = new Map<string, { hbn: string; n: number; grams: number }>();
  for (const w of weights) {
    const id = w.harvest_batch_id || headerId;
    const hbn = w.hbn || lot.hbn || id;
    const cur = groups.get(id) ?? { hbn, n: 0, grams: 0 };
    cur.n += 1;
    cur.grams += Number(w.weight_grams);
    groups.set(id, cur);
  }
  const hbnMeta =
    groups.size > 1
      ? `<dt>${esc(t(locale, "HBNs on this lot"))}</dt><dd data-lot-hbns>${[...groups.values()]
          .map((g) => `${esc(shortLotId(g.hbn, null))} ${g.n} ${esc(t(locale, "totes"))} ${esc(formatGrams(g.grams))} g`)
          .join(" · ")}</dd>`
      : "";
  const finishBlocks =
    groups.size > 1
      ? [...groups.entries()]
          .map(([id, g]) => {
            const serial = shortLotId(g.hbn, null);
            return `<p data-finish-hbn="${esc(id)}"><strong>${esc(serial)}</strong></p>
            <label class="field">${esc(t(locale, "How many plants in this lot?"))} <input type="text" name="plant_count[${esc(id)}]" inputmode="numeric" pattern="[0-9,]*" placeholder="${esc(t(locale, "plants"))}" data-plant-count-input></label>
            ${metrcTagInput(locale, `metrc_tag[${id}]`)}`;
          })
          .join("")
      : "";
  // Owner report 2026-09-01 (duplicate-lot guard): from an in-progress lot, the
  // one deliberate path back to a blank Start-lot header is this link. It carries
  // new=1 so the pick route's single-lot redirect does not bounce it straight
  // back here.
  const startAnother = lot.harvest_batch_id
    ? `<p class="start-another-link"><a class="secondary" href="/station/${esc(station.key)}?pick=${esc(lot.harvest_batch_id)}&amp;new=1">${esc(t(locale, "Start another lot"))}</a></p>`
    : "";
  return `<h2 class="working-pick">${esc([lot.farm_code, lot.strain_name, lot.entry_date].filter(Boolean).join(" / ") || farmName)}</h2>
    <p class="muted">${esc(lot.hbn ?? "")}</p>
    <dl class="lot-meta">
      <dt>${esc(t(locale, "Move To"))}</dt><dd>${esc(moveTo)}</dd>
      ${truckLine}
      ${hbnMeta}
      <dt>${esc(t(locale, "Material"))}</dt><dd>${esc(t(locale, lot.material_form === "bucked" ? "Bucked" : "Spear"))}</dd>
      <dt>${esc(t(locale, "Supervisor"))}</dt><dd data-supervisor>${esc(lot.supervisor_name ?? "")}</dd>
      <dt>${esc(t(locale, "Team Lead"))}</dt><dd data-team-lead>${esc(lot.lead_name ?? "")}</dd>
      <dt>${esc(t(locale, "Notes"))}</dt><dd>${esc(lot.notes ?? "")}</dd>
      <dt>${esc(t(locale, "Running total"))}</dt><dd class="lot-running-total" data-lot-running-total><strong>${esc(formatGrams(total))}</strong> g · <strong>${esc(formatLbs(total))}</strong> lb</dd>
      ${lot.plant_count != null ? `<dt>${esc(t(locale, "Plants"))}</dt><dd data-plant-count>${esc(String(lot.plant_count))}</dd>` : ""}
    </dl>
    ${weightsSection(station, lot.id, weights, total, { pane: "Weights", finish: "Finish load", total: "Total" }, locale, finishBlocks ? "" : metrcTagInput(locale), {
      numbered: true,
      plantPrompt: true,
      hbnSelect,
      headerHbnId: headerId,
      finishBlocks: finishBlocks || undefined,
    })}
    ${startAnother}`;
}

/** THE TAG LAW (canon 0.30.38, fork F4 "Optional tag everywhere"): the optional
 * METRC package tag box beside a station's finish or receive control. 1A plus
 * 22 hex when the crew has it; blank keeps the internal code; any other shape
 * is kept as typed and marked on /admin/uploads, never refused. */
export function metrcTagInput(locale: Locale, name = "metrc_tag", value = ""): string {
  return `<input type="text" name="${esc(name)}" class="metrc-tag-input" value="${esc(value)}" placeholder="${esc(t(locale, "METRC package tag (optional)"))}" title="${esc(t(locale, "1A plus 22 hex characters; blank keeps the internal code"))}" autocomplete="off" spellcheck="false" data-metrc-tag>`;
}

/** The lot page (owner ruling 2026-08-28): the wet lot panel under the station
 * heading. Kept as a thin standalone wrapper for tests and any ledger station
 * without a pane; the wet station route renders the panel inside stationPage on
 * the two-pane layout instead (owner ruling 2026-08-31). */
export function lotPage(
  station: StationDef,
  lot: Parameters<typeof wetLotPanel>[1],
  weights: Array<{ id: string; weight_grams: number; created_at: string }>,
  farmName: string,
  total: number,
  locale: Locale = "en"
): string {
  return `<h1>${esc(t(locale, station.title))}</h1>
    ${wetLotPanel(station, lot, weights, farmName, total, locale)}`;
}

/** The unload record panel (owner ruling 2026-08-31: "left pane:
 * available-in-queue, right pane: what's currently saved about that record and
 * the ability to add more to it"): the right pane of the two-pane station page,
 * embedded by stationPage as its ledgerPanel. The floor refers to a lot by the
 * short id (HBN serial plus METRC tag tail) and the strain; the full HBN sits
 * muted below for the audit trail. Dry weights carry the same reasoned pencil
 * and void controls as wet, with the Dry total outside the weights pane. */
export function unloadLotPanel(
  station: StationDef,
  lot: {
    id: string;
    hbn: string | null;
    metrc_harvest_tag: string | null;
    strain_name: string | null;
    dry_space_name: string | null;
    dry_space_kind?: string | null;
    /** THE DRY SPACE TYPE (canon 0.30.106): a freezer lot's unload only removes the line. */
    dry_space_type?: string | null;
    /** Owner ruling 2026-09-07 (canon 0.29.1): spear or bucked, set at wet
     * weigh-in; this station derives its mode from it. */
    material_form?: string | null;
    /** Owner ruling 2026-08-31: the lot's wet total, the Original (wet) line. */
    weight_grams: number;
    /** Canon 0.30.67: the lot's hand-typed Team Lead, shown under the Supervisor line. */
    lead_name?: string | null;
  },
  weights: Array<{ id: string; weight_grams: number; created_at: string }>,
  total: number,
  locale: Locale = "en",
  session?: UnloadSessionRow | null,
  actorName = "",
  sessionWeightCount = 0,
  extras: {
    parentQty?: number | null;
    showGate?: boolean;
    rapidFocus?: boolean;
    /** Owner ruling 2026-09-07 (canon 0.29.1): "Dry weight can keep the 'on
     * site' question only for Spears that aren't at North." The route computes
     * it (materialAtNorth over the minted item's location, else the batch
     * farm); the panel renders the question exactly when asked. */
    askOnSite?: boolean;
  } = {}
): string {
  // Owner ruling 2026-08-31: "The weights of the original package and what's
  // left after a record is created should be on the weight recording pages."
  // Original (wet) is the lot's wet total; Remaining subtracts the non-voided
  // dry rows already recorded (the passed total), live per render. A rule of
  // thumb only (drying loses weight), so it can go negative and renders as-is.
  const remaining = sumGrams([Number(lot.weight_grams), -total]);
  // THE BLAST FREEZER(S) (canon 0.30.106; owner, verbatim: "Unload Dry
  // Space/Blast Freezer just removes the line, since the packages are already
  // denoted as "FFZ" in METRC, the inventory lines are identical and moving
  // the BF inventory to the FFZ inventory would just duplicate it"): a freezer
  // lot takes no dry weight here; one control removes the line and closes the
  // lot as frozen, its package staying FFZ inventory where it is.
  if (drySpaceTypeOf(lot.dry_space_type) === "freezer") {
    return `<h2 class="working-pick">${esc(shortLotId(lot.hbn ?? "", lot.metrc_harvest_tag))} - ${esc(lot.strain_name ?? "")}</h2>
    <p class="muted">${esc(lot.hbn ?? "")}</p>
    <dl class="lot-meta">
      <dt>${esc(t(locale, "From"))}</dt><dd>${esc(lot.dry_space_name ?? "")}</dd>
      <dt>${esc(t(locale, "Original (wet)"))}</dt><dd>${esc(formatGrams(lot.weight_grams))} g</dd>
    </dl>
    <section class="freezer-unload" data-freezer-unload>
      <p>${esc(
        t(
          locale,
          "This lot stands in a freezer. Its packages already read FFZ in METRC, so unloading only removes the line: nothing moves and no dry weight is taken."
        )
      )}</p>
      <form method="post" action="/station/${esc(station.key)}/lot/${esc(lot.id)}/finish">
        <button type="submit">${esc(t(locale, "Remove the line"))}</button>
      </form>
    </section>`;
  }
  const silo = lot.dry_space_kind === "silo";
  // Owner ruling 2026-09-07 (canon 0.29.1): the spear/buck toggle moved to the
  // wet weight entry screen. This station derives its mode from the lot (a
  // silo still forces bucked) and shows it as a plain line; the radios, their
  // 0.24.1 lock law, and the mode-carry script all retire with the toggle.
  const materialForm = silo || lot.material_form === "bucked" ? "bucked" : "spear";
  void sessionWeightCount;
  const modeLine = `<p class="muted" data-material-form>${esc(t(locale, "Material"))}: ${esc(
    t(locale, materialForm === "bucked" ? "Bucked" : "Spear")
  )}</p>`;
  const sessionHeader = `<form id="unload-session" class="stack session-header" method="post" action="/station/${esc(station.key)}/lot/${esc(lot.id)}/session">
      <label class="field">${esc(t(locale, "Operator"))}
        <input type="text" name="operator_name" required autocomplete="off" data-keep-operator value="${esc(session?.operator_name ?? "")}">
      </label>
      <p class="muted" data-supervisor>${esc(t(locale, "Supervisor"))}: ${esc(actorName)}</p>
      ${lot.lead_name ? `<p class="muted" data-team-lead>${esc(t(locale, "Team Lead"))}: ${esc(lot.lead_name)}</p>` : ""}
      ${modeLine}
      ${effectiveDateField(null, locale, t(locale, "The unload's transaction date. Today by default; the Admin PIN sets another day."), session?.effective_date ?? null)}
      <button type="submit" class="secondary">${esc(t(locale, "Save session"))}</button>
    </form>`;
  const finishExtra =
    materialForm === "spear" && extras.askOnSite
      ? `<div id="bucked-on-site-block" data-bucked-on-site>
          <p>${esc(t(locale, "Will these be bucked on site?"))}</p>
          <span class="choice-row">
            <input type="radio" id="bucked_on_site_yes" name="bucked_on_site" value="yes">
            <label for="bucked_on_site_yes">${esc(t(locale, "Yes"))}</label>
            <input type="radio" id="bucked_on_site_no" name="bucked_on_site" value="no">
            <label for="bucked_on_site_no">${esc(t(locale, "No"))}</label>
          </span>
          <label class="field">${esc(t(locale, "Truck #"))}
            <input type="text" name="truck_number" placeholder="${esc(t(locale, "Required if no"))}">
          </label>
        </div>`
      : "";
  const parentQty = extras.parentQty;
  const mode: ReconcileMode = silo ? "silo" : materialForm === "bucked" ? "bucked" : "spear";
  const gate =
    extras.showGate && parentQty != null
      ? reconcileGate({ recorded: total, parentQty: Number(parentQty), mode })
      : null;
  const showGate = Boolean(gate && gate.kind !== "exact");
  // The gate reposts carry the session's stored on-site answer and truck; the
  // weigh mode is lot-borne now (canon 0.29.1) so no hidden mode rides along.
  const gateHidden = `${
    session?.bucked_on_site === 1
      ? `<input type="hidden" name="bucked_on_site" value="yes">`
      : session?.bucked_on_site === 0
        ? `<input type="hidden" name="bucked_on_site" value="no">`
        : ""
  }${
    session?.truck_number
      ? `<input type="hidden" name="truck_number" value="${esc(session.truck_number)}">`
      : ""
  }`;
  const choiceLabel = (id: string, alreadyQueued?: boolean) => {
    if (id === "queue_adjust") {
      const base = t(locale, "Queue an adjustment CSV");
      return alreadyQueued ? `${base} (${t(locale, "Already queued")})` : base;
    }
    if (id === "nothing") return t(locale, "Nothing, just finish");
    return t(locale, "Back to weighing");
  };
  const gateBlock =
    showGate && gate
      ? `<section class="reconcile-gate" data-reconcile-gate data-gate-kind="${esc(gate.kind)}">
      <h3>${
        gate.kind === "over"
          ? `${esc(t(locale, "Over issued by"))} ${esc(reconcileDeltaLabel(gate.absDelta))} g. ${esc(t(locale, "METRC needs this addressed now."))}`
          : esc(t(locale, "Recorded short of the parent. Queue an adjustment CSV, weigh more, or finish with a deliberate nothing."))
      }</h3>
      <div class="row-actions">
        ${gate.choices
          .map(
            (choice) => `<form method="post" action="/station/${esc(station.key)}/lot/${esc(lot.id)}/finish">
          ${gateHidden}
          <input type="hidden" name="gate_choice" value="${esc(choice.id)}">
          <button type="submit"${choice.alreadyQueued ? ' class="secondary" data-already-queued' : ""}>${esc(choiceLabel(choice.id, choice.alreadyQueued))}</button>
        </form>`
          )
          .join("")}
      </div>
    </section>`
      : "";
  return `<h2 class="working-pick">${esc(shortLotId(lot.hbn ?? "", lot.metrc_harvest_tag))} - ${esc(lot.strain_name ?? "")}</h2>
    <p class="muted">${esc(lot.hbn ?? "")}</p>
    <dl class="lot-meta">
      <dt>${esc(t(locale, "From"))}</dt><dd>${esc(lot.dry_space_name ?? "")}</dd>
      <dt>${esc(t(locale, "Original (wet)"))}</dt><dd>${esc(formatGrams(lot.weight_grams))} g</dd>
      <dt>${esc(t(locale, "Remaining"))}</dt><dd>${esc(formatGrams(remaining))} g</dd>
    </dl>
    ${sessionHeader}
    ${gateBlock}
    ${weightsSection(
      station,
      lot.id,
      weights,
      total,
      { pane: "Dry weights", finish: "Finish unload", total: "Dry total" },
      locale,
      finishExtra,
      { parentQty, rapidFocus: extras.rapidFocus, hideFinish: showGate }
    )}`;
}

function controlForm(
  queue: QueueDef,
  control: QueueControlDef,
  row: QueueRow,
  locale: Locale
): string {
  const rowId = row.id;
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
  // Owner ruling 2026-09-02: [Demote] prompts a warning before it kicks the
  // record back down to the last process it was at.
  if (control.key === "demote") {
    const cryoBorn = queue.key === "testing_queue" && row.values.source === "cryo";
    const warning = esc(
      t(
        locale,
        cryoBorn
          ? "Unfinish voids this output and returns its grams to the pool. Continue?"
          : "Demote kicks this record back to the last process it was at. Continue?"
      )
    );
    const pin = cryoBorn
      ? `<label class="field">${esc(t(locale, "Admin PIN"))} <input type="password" name="unfinish_pin" inputmode="numeric" autocomplete="off"></label>`
      : "";
    return `<form method="post" action="/queue/${esc(queue.key)}/control" onsubmit="return confirm('${warning}')">
    <input type="hidden" name="id" value="${esc(rowId)}">
    <input type="hidden" name="control" value="demote">
    ${pin}
    <button type="submit" class="secondary">${esc(t(locale, control.label))}</button>
  </form>`;
  }
  return `<form method="post" action="/queue/${esc(queue.key)}/control">
    <input type="hidden" name="id" value="${esc(rowId)}">
    <input type="hidden" name="control" value="${esc(control.key)}">
    <button type="submit">${esc(t(locale, control.label))}</button>
  </form>`;
}

export const QUEUE_FOLD_SCRIPT = `<script>
(function () {
  var storeKey = "gf_fold:" + location.pathname;
  var folded = [];
  try { folded = JSON.parse(localStorage.getItem(storeKey) || "[]"); } catch (e) { folded = []; }
  if (!Array.isArray(folded)) folded = [];
  document.querySelectorAll("details.queue-fold").forEach(function (fold) {
    var key = fold.getAttribute("data-fold");
    if (key && folded.indexOf(key) >= 0) fold.removeAttribute("open");
    fold.addEventListener("toggle", function () {
      var closed = [];
      document.querySelectorAll("details.queue-fold").forEach(function (item) {
        if (!item.open) {
          var itemKey = item.getAttribute("data-fold");
          if (itemKey) closed.push(itemKey);
        }
      });
      try { localStorage.setItem(storeKey, JSON.stringify(closed)); } catch (e) {}
    });
  });
  function boxesOf(formId) {
    return Array.prototype.filter.call(document.querySelectorAll('input[type="checkbox"][data-batch-box="' + formId + '"]'), function (box) {
      return !box.disabled;
    });
  }
  function paint(formId) {
    var boxes = boxesOf(formId);
    var n = boxes.filter(function (box) { return box.checked; }).length;
    document.querySelectorAll('[data-check-all="' + formId + '"]').forEach(function (all) {
      all.checked = n > 0 && n === boxes.length;
      all.indeterminate = n > 0 && n < boxes.length;
    });
    var button = document.querySelector('[data-batch-form="' + formId + '"] [data-batch-button]');
    if (!button) return;
    var label = button.getAttribute("data-batch-label") || "";
    button.textContent = label + " (" + n + ")";
    button.disabled = n === 0;
  }
  document.querySelectorAll("[data-check-all]").forEach(function (all) {
    all.addEventListener("change", function () {
      var formId = all.getAttribute("data-check-all");
      boxesOf(formId).forEach(function (box) { box.checked = all.checked; });
      paint(formId);
    });
  });
  document.querySelectorAll("[data-batch-box]").forEach(function (box) {
    box.addEventListener("change", function () { paint(box.getAttribute("data-batch-box")); });
  });
})();
</script>`;

export function queueFold(key: string, summary: string, body: string): string {
  return `<details class="queue-fold" data-fold="${esc(key)}" open><summary>${summary}</summary>${body}</details>`;
}

function voidBatchBar(formId: string, action: string, locale: Locale): string {
  return `<form id="${esc(formId)}" class="batch-bar" method="post" action="${esc(action)}" data-batch-form="${esc(formId)}">
      <label class="field">${esc(t(locale, "Reason"))}
        <input type="text" name="reason" placeholder="${esc(t(locale, "reason"))}" required>
      </label>
      <button type="submit" data-batch-button data-batch-label="${esc(t(locale, "Void checked"))}" disabled>${esc(t(locale, "Void checked"))} (0)</button>
    </form>`;
}

function uploadBatchBar(formId: string, locale: Locale): string {
  return `<form id="${esc(formId)}" class="batch-bar" method="post" action="/admin/uploads/uploaded-checked" data-batch-form="${esc(formId)}">
      <button type="submit" data-batch-button data-batch-label="${esc(t(locale, "Mark checked uploaded"))}" disabled>${esc(t(locale, "Mark checked uploaded"))} (0)</button>
    </form>`;
}

function checkCell(formId: string, name: string, value: string, disabled = false): string {
  return `<td class="check-cell"><input type="checkbox" name="${esc(name)}" value="${esc(value)}" form="${esc(formId)}" data-batch-box="${esc(formId)}"${disabled ? " disabled" : ""}></td>`;
}

function checkHead(formId: string, locale: Locale): string {
  return `<th class="check-cell"><input type="checkbox" data-check-all="${esc(formId)}" aria-label="${esc(t(locale, "Check all"))}" title="${esc(t(locale, "Check all"))}"></th>`;
}

export function queueSection(
  queue: QueueDef,
  rows: QueueRow[],
  locale: Locale = "en"
): string {
  const heading = `<h2 data-pipeline-key="${esc(queue.key)}" data-count="${rows.length}">${esc(t(locale, queue.title))} <span class="tile-count">${rows.length}</span></h2>`;
  const exportLink = `<p><a href="/export/${esc(queue.key)}.csv">${esc(t(locale, "CSV export"))}</a></p>`;
  if (rows.length === 0) {
    return `<section>${queueFold(queue.key, heading, `${exportLink}<p class="muted">${esc(t(locale, "No rows."))}</p>`)}</section>`;
  }
  const formId = `qf-${queue.key}`;
  const groups = groupRows(rows, queue.groupBy);
  const sections = groups
    .map(([name, groupRows]) => {
      const groupHeading = queue.groupBy ? `<h3>${esc(name)}</h3>` : "";
      const head = `<tr>${checkHead(formId, locale)}${queue.columns
        .map((c) => `<th>${esc(c.field === "lab_status_metrc" ? t(locale, c.label) : c.label)}</th>`)
        .join("")}<th>${esc(t(locale, "Controls"))}</th></tr>`;
      const body = groupRows
        .map((row) => {
          const cells = queue.columns
            .map((c) => {
              const raw = displayValue(c.field, row.values);
              const customer = c.field === "hbn" ? String(row.values.customer ?? "").trim() : "";
              const testMark = c.field === "hbn" && row.values.is_test === "1";
              const tollMark = c.field === "hbn" && !testMark && customer !== "";
              const shown =
                c.field === "lab_status_metrc"
                  ? t(locale, raw || "not in METRC")
                  : testMark
                    ? `${raw} ${t(locale, "Test")}`
                    : tollMark
                      ? `${raw} ${customer}`
                      : raw;
              const tollAttr = tollMark ? ` data-hbn-customer="${esc(customer)}"` : "";
              return `<td${c.field === "lab_status_metrc" ? ' data-lab-status-metrc' : ""}${testMark ? ' data-hbn-test="1"' : ""}${tollAttr}>${esc(shown)}</td>`;
            })
            .join("");
          const controls = [
            ...queue.rowControls.map((ctl) => controlForm(queue, ctl, row, locale)),
            `<a class="btn secondary" href="/record/${esc(queue.entity)}/${esc(row.id)}/edit">${esc(t(locale, "Edit"))}</a>`,
            `<a class="btn secondary" href="/record/${esc(queue.entity)}/${esc(row.id)}/void">${esc(t(locale, "Void"))}</a>`,
          ].join(" ");
          return `<tr>${checkCell(formId, "id", row.id)}${cells}<td class="row-actions">${controls}</td></tr>`;
        })
        .join("");
      return `${groupHeading}<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    })
    .join("");
  return `<section>${queueFold(queue.key, heading, `${exportLink}${voidBatchBar(formId, `/admin/queues/${queue.key}/void-checked`, locale)}${sections}`)}</section>`;
}

/** Owner ruling 2026-09-06 (canon 0.26.0): "logistics moves, like everything
 * else, needs a place in the data queue in Admin as well." One section, every
 * non-deleted movement, the reasoned void where the guard allows it. */
export function movementsQueueSection(rows: MovementQueueRow[], locale: Locale = "en"): string {
  const heading = `<h2 data-pipeline-key="logistics_moves" data-count="${rows.length}">${esc(t(locale, "Logistics Moves"))} <span class="tile-count">${rows.length}</span></h2>`;
  const formId = "qf-logistics_moves";
  const body =
    rows.length === 0
      ? `<p class="muted">${esc(t(locale, "No logistics moves."))}</p>`
      : `${voidBatchBar(formId, "/admin/queues/movement/void-checked", locale)}<table class="data"><thead><tr>
          ${checkHead(formId, locale)}<th>${esc(t(locale, "When"))}</th><th>${esc(t(locale, "Kind"))}</th><th>${esc(t(locale, "From"))}</th><th>${esc(t(locale, "To"))}</th><th>${esc(t(locale, "Truck"))}</th><th>${esc(t(locale, "Status"))}</th><th>${esc(t(locale, "Items"))}</th><th>${esc(t(locale, "Controls"))}</th>
        </tr></thead><tbody>${rows
          .map((row) => {
            const blocked = row.received_count > 0;
            const control = blocked
              ? `<span class="muted">${esc(t(locale, "Un-receive its receipts first."))}</span>`
              : `<form method="post" action="/admin/queues/movement/${esc(row.id)}/void" class="row-actions">
                  <input type="text" name="reason" placeholder="${esc(t(locale, "reason"))}" required>
                  <button type="submit" class="danger">${esc(t(locale, "Void"))}</button>
                </form>`;
            return `<tr data-movement-id="${esc(row.id)}">
              ${checkCell(formId, "id", row.id, blocked)}
              <td>${esc(row.created_at)}</td>
              <td>${esc(row.movement_kind)}</td>
              <td>${esc(row.origin_farm ?? row.origin_license)}</td>
              <td>${esc(row.destination_farm ?? row.destination_license)}</td>
              <td>${esc(row.truck_number ?? "")}</td>
              <td>${esc(row.status)}${row.received_count > 0 ? ` <span class="muted">(${esc(String(row.received_count))}/${esc(String(row.item_count))} ${esc(t(locale, "received"))})</span>` : ""}</td>
              <td>${esc(String(row.item_count))}</td>
              <td>${control}</td>
            </tr>`;
          })
          .join("")}</tbody></table>`;
  return `<section class="queue-block" data-queue="logistics_moves">
    ${queueFold("logistics_moves", heading, body)}
  </section>`;
}

export function dataQueuesPage(
  sections: Array<{ queue: QueueDef; rows: QueueRow[] }>,
  locale: Locale = "en",
  movements: MovementQueueRow[] = []
): string {
  const body = sections.map((s) => queueSection(s.queue, s.rows, locale)).join("\n");
  return `<h1>Data Queues</h1>${body}\n${movementsQueueSection(movements, locale)}${QUEUE_FOLD_SCRIPT}`;
}

/** The PIN gate page (owner ruling 2026-08-31): Admin and Interco Logistics open
 * only after the PIN; one unlock holds on the device for a shift via cookie. */
export function pinPage(next: string, locale: Locale = "en", wrong = false, action = "/pin"): string {
  // THE MODELS BUTTON (canon 0.30.86): the same page fronts the Models PIN,
  // posting to its own path (/pin/models) instead of Admin's /pin.
  const error = wrong ? `<div class="banner err">${esc(t(locale, "Wrong PIN."))}</div>` : "";
  return `<h1>${esc(t(locale, "Enter PIN"))}</h1>
    ${error}
    <form class="stack" method="post" action="${esc(action)}">
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

/** THE OPERATOR KEPT (canon 0.30.346). Owner, 2026-10-02, verbatim: "Make all free text operator fields in weight
 * entry nodes to mandatory.  They don't nullify on refresh or onLoad but they can be changed." Every operator box on
 * the weigh nodes carries data-keep-operator; this tablet keeps the last name typed in it (per box name, in
 * localStorage), fills an empty box with it on every load, and saves it as it changes. Storage may be off; then the
 * box simply starts blank, as before. */
export function keepOperatorScript(): string {
  return `<script>(function(){try{var boxes=document.querySelectorAll("input[data-keep-operator]");boxes.forEach(function(b){var k="gf_operator:"+b.name;try{var v=localStorage.getItem(k);if(v&&!b.value)b.value=v;}catch(e){}var save=function(){try{if(b.value.trim())localStorage.setItem(k,b.value.trim());}catch(e){}};b.addEventListener("change",save);b.addEventListener("input",save);});}catch(e){}})();</script>`;
}
