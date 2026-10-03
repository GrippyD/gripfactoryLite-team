// THE LAB STATION (canon 0.30.362). The package page, inside the app shell.
// The private dark sheet is not carried: Grip, Lite, and Continuum style the
// station through the classes every view sheet styles (label.field, form.stack,
// table.data, button and .secondary, .banner, .muted, .card, .chip, .tile, the
// tab classes); the scoped block below is layout only. Every label, help line,
// refusal, toast and tile is an i18n key; help rides hover (canon 0.26.0).

import { LAB_CLIENT_JS, labClientScript } from "./labclient";
import { t, type Locale } from "./i18n";
import { esc } from "./ui";
import { FAIL_REASONS, LICENSES, LOCATIONS, REASONS, REQUIRED_TESTS, SAMPLE_TYPES, STATUS_LABELS } from "./labrules";

/** Refusal slugs (labrules.ts and lab.ts) and the English line the station shows. */
export const LAB_FRIENDLY: Record<string, string> = {
  "no-instrument-result": "type at least one instrument result",
  "tag-serial-needs-license": "pick a license to expand a 5 digit tag",
  "tag-serial-no-prefix-for-license": "this license has no tag prefix on file; type the full 24 character tag",
  "tag-shape": "a tag is 5 digits or the full 24 characters",
  moisture_pct: "moisture must be between 0.5 and 95 percent",
  water_activity: "water activity must be between 0.05 and 1",
  thc_pct: "THC must be between 0 and 100 percent",
  tested_at: "the tested time is unreadable or in the future",
  "tested_at-blank": "a dated reading cannot be blanked; type a time or leave it as it was",
  observed_at: "this device's clock is off; set it and save again",
  scheduled_at: "the scheduled time is unreadable or in the future",
  location: "pick a location",
  reason: "pick a reason",
  sample_type: "pick a sample type",
  license: "that license is not on the list",
  program: "that program is not one the lab uses",
  market: "that market is not on the list",
  "too-long": "a text field is longer than the record allows",
  "sample_tag-required": "a sample tag is needed before the sample leaves scheduled",
  "fail_reason-required": "a failed sample needs a fail reason",
  "finished-before-entered": "finished before it entered testing",
  source_metrc_tag: "the source package tag is required",
  net_weight_g: "net weight must be a number of grams",
  batch_weight_g: "batch weight must be a number of grams",
  thc_potency_pct: "THC potency must be between 0 and 100 percent",
  entered_testing_on: "the entered date is unreadable",
  finished_testing_on: "the finished date is unreadable",
  status: "that status is not one the lab uses",
  required_test: "pick the required test",
  "not-found": "that row no longer exists",
  voided: "that row was voided",
  "already-voided": "that row was already voided",
  stale: "someone else changed this row since you opened it; it has been reloaded",
  "nothing-to-change": "nothing changed",
  "client-header-required": "this page is out of date; reload it",
  method: "this page is out of date; reload it",
  "too-many-ids": "pick at most 90 samples at a time",
  "too-many-rows": "that file is too big for one import; the page splits it",
  "insert-refused-by-schema": "the server refused the row; it was logged",
  "server-error": "the server could not save it; it was logged",
  "db-not-bound": "the server is not ready; try again later",
  "bad-json": "the save was malformed; reload the page",
  "not-an-object": "the save was malformed; reload the page",
  id: "the save carries a bad id; reload the page",
  "bad-body": "the upload could not be read; try again",
  "bad-since": "the since mark is unreadable",
  "body-too-large": "that file is too large",
  "reason-required": "a void needs a reason",
  hour: "the hour must be 0 to 23",
  day: "the day is unreadable",
  ids: "pick at least one sample",
  header: "the file header does not match",
  empty: "That file has no rows.",
  test_id: "a row's Test ID is not a LightLab test id",
  date: "a row's date is unreadable",
  time: "a row's time is not HH:MM:SS with its offset",
  terpenes: "terpenes must be ND, Low, Medium or High",
  tag: "that tag is not a tag",
  quantity: "the quantity is not a number",
};

/** The words for the first half of a combined slug (field:slug or field:value).
 * The second half reads through LAB_FRIENDLY when it is a slug, else as itself. */
export const LAB_FIELD_NAMES: Record<string, string> = {
  source_metrc_tag: "source package tag",
  sample_tag: "sample tag",
  analyte: "a result that is not ND or a percent from 0 to 100",
  location: "not a location on the list",
};

/** The LightLab material classes (labrules.ts opMaterialClass) the Results filter offers. */
const OP_CLASSES = ["Flower", "Kief", "Trim", "Biomass", "Shake"];

/** Every key the client looks up: its literal tr("...") and trf("...") keys, and
 * the pick-list words it shows through tr() (option labels and stored values). */
export function labClientKeys(): string[] {
  const keys = new Set<string>();
  for (const m of LAB_CLIENT_JS.matchAll(/\btrf?\("([^"]*)"/g)) keys.add(m[1] as string);
  for (const k of LOCATIONS) keys.add(k);
  for (const k of REASONS) keys.add(k);
  for (const k of SAMPLE_TYPES) keys.add(k);
  for (const k of OP_CLASSES) keys.add(k);
  for (const k of REQUIRED_TESTS) keys.add(k);
  for (const k of FAIL_REASONS) keys.add(k);
  for (const l of LICENSES) keys.add(l.label);
  for (const k of Object.values(STATUS_LABELS)) keys.add(k);
  return [...keys];
}

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/** JSON for a script data block: every '<' and the two JavaScript line
 * separators escaped (manifest.ts's pattern, hardened). */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(LINE_SEPARATOR, "\\u2028")
    .replaceAll(PARAGRAPH_SEPARATOR, "\\u2029");
}

function translated(locale: Locale, map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [slug, en] of Object.entries(map)) out[slug] = t(locale, en);
  return out;
}

/** The station's words in the page's locale, only the keys the client uses. */
export function labWordsJson(locale: Locale): string {
  const tr: Record<string, string> = {};
  for (const key of labClientKeys()) tr[key] = t(locale, key);
  return jsonForScript({ locale, tr, friendly: translated(locale, LAB_FRIENDLY), fields: translated(locale, LAB_FIELD_NAMES) });
}

function e(locale: Locale, key: string): string {
  return esc(t(locale, key));
}

/** The station. signedInName is the signed-in person's display name; with none,
 * the page shows the name box the layout's keepOperatorScript keeps. */
export function labStationBody(locale: Locale, signedInName: string | null): string {
  const who = signedInName
    ? `<span class="muted" id="who">${e(locale, "Signed in")}: ${esc(signedInName)}</span>`
    : `<label class="field">${e(locale, "Your name")} <input type="text" id="lab-operator" name="lab_operator" autocomplete="off" data-keep-operator></label>
  <span class="muted" id="who">${e(locale, "No operator name")}</span>`;
  return `<div id="lab-station" data-lab-station>
<style>
#lab-station .lab-head { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; align-items: baseline; }
#lab-station .lab-nav { margin: 0.5rem 0 1rem; }
#lab-station [hidden] { display: none !important; }
#lab-station form.stack { max-width: none; }
#lab-station .lab-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.7rem 0.8rem; }
#lab-station .lab-grid .lab-wide { grid-column: 1 / -1; }
#lab-station .lab-preview { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 400; min-height: 1.2em; overflow-wrap: anywhere; }
#lab-station .lab-row { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin-top: 0.75rem; }
#lab-station .lab-row select, #lab-station .lab-row input[type="text"], #lab-station .lab-row input[type="date"], #lab-station .lab-row input[type="file"] { width: auto; max-width: 100%; }
#lab-station label.lab-inline { flex-direction: row; align-items: center; gap: 0.4rem; }
#lab-station input[type="checkbox"] { width: auto; }
#lab-station .tbl { overflow: auto; max-height: 60vh; }
#lab-station td.num, #lab-station th.num { text-align: right; font-variant-numeric: tabular-nums; }
#lab-station .chip.warn { border-style: dashed; }
#lab-station .lab-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.7rem; }
#lab-station .lab-tiles .tile { min-height: 0; }
#lab-station .sched td { cursor: pointer; min-width: 3.2rem; }
#lab-station .sched td.now { outline: 2px solid currentColor; outline-offset: -2px; }
#lab-station .sched td input[type="text"] { min-width: 5rem; }
body.device-phone #lab-station .lab-nav button, body.device-phone #lab-station table button { width: auto; min-height: 2.8rem; }
</style>
<header class="lab-head">
  <h2>${e(locale, "Lab tests")}</h2>
  <span class="muted" id="clock"></span>
  ${who}
</header>
<nav class="tab-bar lab-nav" role="tablist" id="tabs" aria-label="${e(locale, "Lab tests")}">
  <button type="button" role="tab" class="tab-link tab-on" id="lab-tab-bench" aria-controls="tab-bench" aria-selected="true" data-tab="bench">${e(locale, "Bench")}</button>
  <button type="button" role="tab" class="tab-link secondary" id="lab-tab-compliance" aria-controls="tab-compliance" aria-selected="false" data-tab="compliance">${e(locale, "Compliance")}</button>
  <button type="button" role="tab" class="tab-link secondary" id="lab-tab-rnd" aria-controls="tab-rnd" aria-selected="false" data-tab="rnd">${e(locale, "R&D")}</button>
  <button type="button" role="tab" class="tab-link secondary" id="lab-tab-op" aria-controls="tab-op" aria-selected="false" data-tab="op">${e(locale, "Photonics")}</button>
  <button type="button" role="tab" class="tab-link secondary" id="lab-tab-schedule" aria-controls="tab-schedule" aria-selected="false" data-tab="schedule">${e(locale, "Schedule")}</button>
  <button type="button" role="tab" class="tab-link secondary" id="lab-tab-summary" aria-controls="tab-summary" aria-selected="false" data-tab="summary">${e(locale, "Summary")}</button>
</nav>
<div class="banner warn" id="outbox" role="status" aria-live="polite" hidden></div>
<section id="tab-bench" role="tabpanel" aria-labelledby="lab-tab-bench">
  <div class="card">
    <h2 id="bench-title">${e(locale, "New bench reading")}</h2>
    <form id="bench-form" class="stack" autocomplete="off" title="${e(locale, "At least one instrument result is required. The time is stamped when you save unless you type one.")}">
      <div class="lab-grid">
        <label class="field">${e(locale, "Location")} <select name="location" required></select></label>
        <label class="field">${e(locale, "Reason")} <select name="reason" required></select></label>
        <label class="field">${e(locale, "License (sets the tag prefix)")} <select name="license"></select></label>
        <label class="field">${e(locale, "Metrc tag (last 5 digits, or the full tag)")} <input type="text" name="metrc_tag" inputmode="numeric" placeholder="56801"><span class="lab-preview" id="tag-preview"></span></label>
        <label class="field">${e(locale, "Sample type")} <select name="sample_type" required></select></label>
        <label class="field">${e(locale, "OHAUS moisture %")} <input type="number" name="moisture_pct" step="0.01" min="0.5" max="95" inputmode="decimal" placeholder="12.4"></label>
        <label class="field">${e(locale, "Aqualab water activity")} <input type="number" name="water_activity" step="0.0001" min="0.05" max="1" inputmode="decimal" placeholder="0.5500"></label>
        <label class="field">${e(locale, "Orange Photonics THC %")} <input type="number" name="thc_pct" step="0.01" min="0" max="100" inputmode="decimal" placeholder="21.3"></label>
        <label class="field">${e(locale, "Date tested (blank means now)")} <input type="date" name="tested_on"></label>
        <label class="field">${e(locale, "Time tested")} <input type="time" name="tested_time"></label>
        <label class="field lab-wide">${e(locale, "Notes")} <textarea name="notes"></textarea></label>
      </div>
      <div class="lab-row">
        <button type="submit" id="bench-save">${e(locale, "Save reading")}</button>
        <button type="button" class="secondary" id="bench-reset">${e(locale, "Clear")}</button>
      </div>
      <div class="banner" id="bench-status" role="status" aria-live="polite" hidden></div>
    </form>
  </div>
  <div class="card">
    <h2>${e(locale, "Recent readings")}</h2>
    <div class="lab-row">
      <select id="bench-f-location" aria-label="${e(locale, "All locations")}"><option value="">${e(locale, "All locations")}</option></select>
      <input type="text" id="bench-f-tag" placeholder="${e(locale, "Tag ends with")}" aria-label="${e(locale, "Tag ends with")}" inputmode="numeric">
      <label class="field lab-inline"><input type="checkbox" id="bench-f-attn"> ${e(locale, "Needs attention only")}</label>
      <button type="button" class="secondary" id="bench-refresh">${e(locale, "Refresh")}</button>
    </div>
    <div class="tbl"><table class="data" id="bench-table"><thead><tr><th>${e(locale, "Tested")}</th><th>${e(locale, "Location")}</th><th>${e(locale, "Reason")}</th><th>${e(locale, "Tag")}</th><th>${e(locale, "Type")}</th><th class="num">${e(locale, "MC %")}</th><th class="num">${e(locale, "aw")}</th><th class="num">${e(locale, "THC %")}</th><th>${e(locale, "Notes")}</th><th>${e(locale, "By")}</th><th></th></tr></thead><tbody></tbody></table></div>
    <p class="muted">${e(locale, "Tap a row to correct it. A reading is never deleted: voiding keeps it with a reason.")}</p>
  </div>
</section>
<section id="tab-compliance" role="tabpanel" aria-labelledby="lab-tab-compliance" hidden>
  <div class="card">
    <h2 id="cs-title">${e(locale, "New compliance sample")}</h2>
    <form id="cs-form" class="stack" autocomplete="off">
      <div class="lab-grid">
        <label class="field">${e(locale, "Program")} <select name="program"><option value="compliance">${e(locale, "Compliance")}</option><option value="rnd">${e(locale, "R&D")}</option></select></label>
        <label class="field">${e(locale, "License")} <select name="license" required></select></label>
        <label class="field">${e(locale, "Market")} <select name="market"><option value="">${e(locale, "From license")}</option><option value="AU">AU</option><option value="Med">Med</option></select></label>
        <label class="field" title="${e(locale, "Typing a source tag fills strain, item, batch weight, and harvest batch from the Metrc package list when it knows the tag.")}">${e(locale, "Source package tag")} <input type="text" name="source_metrc_tag" placeholder="${e(locale, "Metrc tag (last 5 digits, or the full tag)")}" required><span class="lab-preview" id="cs-src-preview"></span></label>
        <label class="field">${e(locale, "Strain")} <input type="text" name="strain"></label>
        <label class="field">${e(locale, "Item name")} <input type="text" name="item_name"></label>
        <label class="field">${e(locale, "Batch weight (g)")} <input type="number" name="batch_weight_g" step="any" min="0" inputmode="decimal"><span class="muted" id="cs-batch-unit"></span></label>
        <label class="field">${e(locale, "Harvest batch")} <input type="text" name="harvest_batch"></label>
        <label class="field">${e(locale, "Sample tag")} <input type="text" name="sample_tag" placeholder="${e(locale, "blank until cut")}"><span class="lab-preview" id="cs-smp-preview"></span></label>
        <label class="field">${e(locale, "Required test")} <select name="required_test" required></select></label>
        <label class="field">${e(locale, "Net weight (g)")} <input type="number" name="net_weight_g" step="any" min="0" inputmode="decimal" placeholder="114"></label>
        <label class="field">${e(locale, "Testing facility")} <select name="testing_facility"><option value="">${e(locale, "Not sent yet")}</option></select></label>
        <label class="field">${e(locale, "Entered testing")} <input type="date" name="entered_testing_on"></label>
        <label class="field">${e(locale, "Finished testing")} <input type="date" name="finished_testing_on"></label>
        <label class="field">${e(locale, "THC potency %")} <input type="number" name="thc_potency_pct" step="0.0001" inputmode="decimal"></label>
        <label class="field">${e(locale, "Status")} <select name="status"></select></label>
        <label class="field">${e(locale, "Fail reason")} <select name="fail_reason"><option value="">${e(locale, "None")}</option></select></label>
        <label class="field lab-wide">${e(locale, "Notes")} <textarea name="notes"></textarea></label>
      </div>
      <div class="lab-row">
        <button type="submit" id="cs-save">${e(locale, "Save sample")}</button>
        <button type="button" class="secondary" id="cs-reset">${e(locale, "Clear")}</button>
      </div>
      <div class="banner" id="cs-status" role="status" aria-live="polite" hidden></div>
    </form>
  </div>
  <div class="card">
    <h2>${e(locale, "Samples")}</h2>
    <div class="lab-row">
      <select id="cs-f-status" aria-label="${e(locale, "Every status")}"><option value="">${e(locale, "Every status")}</option><option value="scheduled">${e(locale, "Scheduled")}</option><option value="not_submitted,in_testing">${e(locale, "Out at the lab")}</option><option value="passed,retest_passed">${e(locale, "Passed")}</option><option value="failed,retest_failed">${e(locale, "Failed")}</option></select>
      <input type="text" id="cs-f-tag" placeholder="${e(locale, "Tag ends with")}" aria-label="${e(locale, "Tag ends with")}">
      <button type="button" class="secondary" id="cs-refresh">${e(locale, "Refresh")}</button>
      <button type="button" class="secondary" id="cs-autofill">${e(locale, "Metrc autofill CSV for selected")}</button>
    </div>
    <div class="tbl"><table class="data" id="cs-table"><thead><tr><th></th><th>${e(locale, "Source")}</th><th>${e(locale, "Strain")}</th><th>${e(locale, "Item")}</th><th>${e(locale, "Harvest batch")}</th><th>${e(locale, "Sample")}</th><th>${e(locale, "Test")}</th><th class="num">${e(locale, "Net g")}</th><th>${e(locale, "Lab")}</th><th>${e(locale, "Entered")}</th><th>${e(locale, "Finished")}</th><th class="num">${e(locale, "Days")}</th><th class="num">${e(locale, "THC %")}</th><th>${e(locale, "Status")}</th><th>${e(locale, "Ready")}</th><th></th></tr></thead><tbody></tbody></table></div>
    <p class="muted">${e(locale, "Ready means the newest After Cryo water activity on the source package is at or under 0.60. Tap a row to update it as it moves through the lab.")}</p>
  </div>
</section>
<section id="tab-rnd" role="tabpanel" aria-labelledby="lab-tab-rnd" hidden>
  <div class="card">
    <h2>${e(locale, "R&D samples")}</h2>
    <p class="muted">${e(locale, "Same record as a compliance sample, filed under the R&D program. Tap a row to update it.")}</p>
    <div class="lab-row">
      <select id="rnd-f-status" aria-label="${e(locale, "Every status")}"><option value="">${e(locale, "Every status")}</option><option value="not_submitted,in_testing">${e(locale, "Out at the lab")}</option><option value="passed,retest_passed">${e(locale, "Passed")}</option><option value="failed,retest_failed">${e(locale, "Failed")}</option></select>
      <button type="button" class="secondary" id="rnd-refresh">${e(locale, "Refresh")}</button>
      <button type="button" class="secondary" id="rnd-new">${e(locale, "New R&D sample")}</button>
    </div>
    <div class="tbl"><table class="data" id="rnd-table"><thead><tr><th>${e(locale, "Source")}</th><th>${e(locale, "Strain")}</th><th>${e(locale, "Item")}</th><th>${e(locale, "Harvest batch")}</th><th>${e(locale, "Sample")}</th><th>${e(locale, "Test")}</th><th class="num">${e(locale, "Net g")}</th><th>${e(locale, "Lab")}</th><th>${e(locale, "Entered")}</th><th>${e(locale, "Finished")}</th><th class="num">${e(locale, "Days")}</th><th class="num">${e(locale, "THC %")}</th><th>${e(locale, "Status")}</th><th>${e(locale, "Notes")}</th><th></th></tr></thead><tbody></tbody></table></div>
  </div>
</section>
<section id="tab-op" role="tabpanel" aria-labelledby="lab-tab-op" hidden>
  <div class="card">
    <h2>${e(locale, "Import a LightLab export")}</h2>
    <div class="lab-row">
      <input type="file" id="op-file" accept=".csv,text/csv" aria-label="${e(locale, "Import a LightLab export")}" title="${e(locale, "Export the CSV from the Orange Photonics software and drop it here. Rows are keyed on the instrument's Test ID, so importing an overlapping export adds only what is new.")}">
      <button type="button" id="op-import" disabled>${e(locale, "Import")}</button>
    </div>
    <div class="banner" id="op-status" role="status" aria-live="polite" hidden></div>
  </div>
  <div class="card">
    <h2>${e(locale, "Results")}</h2>
    <div class="lab-row">
      <select id="op-f-class" aria-label="${e(locale, "Every class")}"><option value="">${e(locale, "Every class")}</option><option value="Flower">${e(locale, "Flower")}</option><option value="Kief">${e(locale, "Kief")}</option><option value="Trim">${e(locale, "Trim")}</option><option value="Biomass">${e(locale, "Biomass")}</option><option value="Shake">${e(locale, "Shake")}</option></select>
      <button type="button" class="secondary" id="op-refresh">${e(locale, "Refresh")}</button>
    </div>
    <div class="tbl"><table class="data" id="op-table"><thead><tr><th>${e(locale, "Tested")}</th><th>${e(locale, "Sample ID")}</th><th>${e(locale, "Class")}</th><th>${e(locale, "Cultivar")}</th><th class="num">THC-A</th><th class="num">d9</th><th class="num">${e(locale, "Total THC")}</th><th class="num">${e(locale, "Total CBD")}</th><th class="num">${e(locale, "Total")}</th><th>${e(locale, "Terpenes")}</th><th>${e(locale, "Confidence")}</th><th>${e(locale, "Operator")}</th></tr></thead><tbody></tbody></table></div>
  </div>
</section>
<section id="tab-schedule" role="tabpanel" aria-labelledby="lab-tab-schedule" hidden>
  <div class="card">
    <h2>${e(locale, "Sampling schedule")}</h2>
    <p class="muted">${e(locale, "Which silos to pull each hour. Tap a cell, type the silos (Silo 3/Silo 5), press Enter. Empty clears it.")}</p>
    <div class="lab-row">
      <label class="field lab-inline">${e(locale, "From")} <input type="date" id="sch-from"></label>
      <button type="button" class="secondary" id="sch-refresh">${e(locale, "Refresh")}</button>
    </div>
    <div class="sched"><table class="data" id="sch-table"><thead></thead><tbody></tbody></table></div>
  </div>
</section>
<section id="tab-summary" role="tabpanel" aria-labelledby="lab-tab-summary" hidden>
  <div class="card">
    <h2>${e(locale, "Right now")}</h2>
    <div class="lab-tiles" id="sum-tiles"></div>
    <details><summary>${e(locale, "Bench readings, last 7 days by location")}</summary><div class="tbl"><table class="data" id="sum-bench"><thead><tr><th>${e(locale, "Location")}</th><th class="num">${e(locale, "Readings")}</th><th class="num">${e(locale, "MC")}</th><th class="num">${e(locale, "aw")}</th><th class="num">${e(locale, "THC")}</th></tr></thead><tbody></tbody></table></div></details>
    <details><summary>${e(locale, "Orange Photonics, last 7 days by class")}</summary><div class="tbl"><table class="data" id="sum-op"><thead><tr><th>${e(locale, "Class")}</th><th class="num">${e(locale, "Tests")}</th><th class="num">${e(locale, "Avg total THC")}</th><th class="num">${e(locale, "Max total THC")}</th></tr></thead><tbody></tbody></table></div></details>
  </div>
</section>
<script type="application/json" id="lab-words">${labWordsJson(locale)}</script>
${labClientScript()}
</div>`;
}
