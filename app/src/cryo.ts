/**
 * THE CRYO RUN (canon 0.30.110). Owner rulings 2026-09-17, verbatim: "For
 * cryo, replicate the trim line surface in cryo production reporting.  Also,
 * in production scheduling for pasteurization collapse the lines to their HBN,
 * do not expose individual containers on the scheduled surface or on the input
 * list in the production reporting node." At the forks: "The containers created
 * in trim constitute a total weight by product type.  That's what's consumed.
 * The containers made in trim are archival but no longer relevant to the
 * process once they've been added to true METRC package IDs in cryo"; "They
 * scan a tag that attaches to the weight and that weight is consumed from the
 * sum of weight stored in the HBN.  The HBN continues to be important to the
 * background data for METRC, but we use only the package ID after cryo to
 * identify the material"; outputs go straight to the Testing queue; the name
 * stays Cryo Weight Entry; Location Name always prints Cryo Room; his T3
 * template new_packages_autofill_template.t3.xlsx is the New Packages file.
 *
 * THE CRYO CATEGORIES (canon 0.30.112). Owner rulings 2026-09-17, verbatim: "in
 * cryo weight entry, add the product categories: 1. WPR 2. BUD 3. SHA"; "Cryo
 * weights should be listed beneath the entry surface (just like trim), the
 * plus line should ratify what's in the entry fields and reset the fields to
 * null.  Keep the running package total and how much is left in the parent at
 * the top (same as trim)"; "When a hard entered (under the entry surface) tag
 * number is scanned into the entry surface a warning (in the language selected
 * at the pill) warns the user of a duplicate tag and doesn't allow it to
 * proceed." His pick: the New Packages file keeps Same Item yes. CRYO ONLY
 * (canon 0.30.114), verbatim: "The go/no-go package dupe check needs to be
 * removed from Trim, that's a cryo phenomenon.  A package is Id'd by its HBN
 * until the cryo step." The guard rides this page alone.
 *
 * THE CRYO POOL BY TYPE (canon 0.30.119). Owner, 2026-09-18, verbatim: "in Cryo
 * weight entry, the total shows "BUD" which is technically true, but this is
 * where the trim packages matter a tiny bit.  I need the totals on the top of
 * the page to be reflective of the package types therein.  So lot ending 011
 * contains x amount of bud, y amount of wpr, and z amount of shake.  I need
 * those totals broken down on screen as well and the "bud" total changed to
 * just "total"." The cryo-bound trim types are BUD, SMALLS and SHAKE (app_config
 * cryo_type_categories, migration 0060), each read at the top as its category
 * (BUD, WPR, SHA) with the trim type beside it; his picks: the existing SMALLS
 * and SHAKE containers move to the Cryo Queue only; category names with the
 * type beside.
 *
 * THE POOL BY CATEGORY (canon 0.30.121). Owner, 2026-09-18, of the pool table,
 * verbatim: "here is the surface that should show the available weight in each
 * category, so the TL in cryo knows they're not over-issuing one particular
 * product category." One row per category with In, Out and Remaining; the plus
 * guard asks against the picked category's remaining.
 *
 * Pure renderers and pure math: input in, HTML or rows out, so the tests pin
 * them without a database.
 */
import { LOC_CRYO_ROOM, OVERISSUE_TOLERANCE_GRAMS, formatGrams, isMetrcTag, metrcQuantity, roundGrams } from "./config";
import type { CryoOutputRow, CryoPool, CryoRunInputRow, CryoRunRow } from "./db";
import { effectiveDateField } from "./effective";
import { duplicateTagGuard, lockOnSubmitScript, localTimeScript } from "./html";
import { t, type Locale } from "./i18n";
import { terpRunHeader } from "./terps";
import { esc } from "./ui";
import type { XlsxCell, XlsxSheet } from "./xlsx";

export const CRYO_STATION_PATH = "/station/cryo_weight";

export const CRYO_REFUSAL = {
  noRun: "Unknown run.",
  finished: "That run is finished; its outputs stand.",
  notScheduled: "That run is not on the working schedule.",
  tag: "Scan or type the package tag.",
  tagShape: "The package tag must be 1A plus 22 hex characters.",
  tagTaken: "That package tag is already in use.",
  category: "Pick the product category.",
  categoryOutsideList: "That product category is not on the cryo list.",
  weight: "Weight must be a number of grams above zero.",
  operator: "Operator is required.",
  noOutputs: "Enter at least one package before finishing.",
  unscheduleWithOutputs: "A run with outputs cannot be unscheduled; finish it.",
  demoteFinished: "A finished run cannot be demoted; its outputs stand.",
} as const;

export type CryoPoolTotals = { totalIn: number; totalOut: number; totalRemaining: number };
export type CryoPoolView = { category_code: string; type_codes: string[]; in_grams: number; out_grams: number; remaining: number };

/** THE POOL BY CATEGORY (canon 0.30.121): each category's available weight is
 * its In (the trim types that read as it) minus its Out (the lines entered
 * under it); the totals sum the lines. */
export function poolView(pool: CryoPool): CryoPoolView[] {
  return pool.lines.map((l) => ({ ...l, remaining: roundGrams(l.in_grams - l.out_grams) }));
}

export function poolTotals(pool: CryoPool): CryoPoolTotals {
  const totalIn = roundGrams(pool.lines.reduce((n, l) => n + l.in_grams, 0));
  const totalOut = roundGrams(pool.lines.reduce((n, l) => n + l.out_grams, 0));
  return { totalIn, totalOut, totalRemaining: roundGrams(totalIn - totalOut) };
}

/** THE OVERISSUE LINE IS STRICT (canon 0.30.37): a line that takes more than
 * its category's remaining (canon 0.30.121), past half a cent of float noise,
 * over issues the pool; landing exactly on it does not. Flag, never block. */
export function overIssuesPool(remaining: number, grams: number): boolean {
  return grams > remaining + OVERISSUE_TOLERANCE_GRAMS;
}

export type CryoStationInput = {
  runs: CryoRunRow[];
  picked?: { run: CryoRunRow; pool: CryoPool; outputs: CryoOutputRow[]; categories: readonly string[]; inputs?: CryoRunInputRow[] } | null;
  nowIso: string;
  locale?: Locale;
  ok?: string;
  err?: string;
};

function runLabel(run: CryoRunRow, locale: Locale): string {
  const n = Number(run.containers);
  const word = t(locale, n === 1 ? "container" : "containers");
  return `${n} ${word} / ${formatGrams(run.in_grams)} g`;
}

function paneItem(run: CryoRunRow, picked: boolean, locale: Locale): string {
  const cls = picked ? "queue-pane-item selected" : "queue-pane-item";
  return `<li><a class="${cls}" href="${CRYO_STATION_PATH}?pick=${esc(run.id)}" data-cryo-run="${esc(run.id)}"><strong>${esc(run.hbn)}</strong> <span class="muted">${esc(
    runLabel(run, locale)
  )}</span></a></li>`;
}

/** THE POOL BY CATEGORY (canon 0.30.121; owner: "here is the surface that
 * should show the available weight in each category, so the TL in cryo knows
 * they're not over-issuing one particular product category"): one row per
 * category in the type list's order, the category named with its trim types
 * muted beside it where they differ (WPR SMALLS; SHA SHAKE), then In, Out and
 * Remaining; the Total row closes the table (the owner's "running package total
 * and how much is left in the parent at the top", his "bud" total read as just
 * "total"). Each row carries its remaining for the plus guard. */
function poolTable(pool: CryoPool, locale: Locale): string {
  const totals = poolTotals(pool);
  const view = poolView(pool);
  const rows =
    view.length === 0
      ? `<tr><td colspan="4" class="muted">${esc(t(locale, "No containers in the pool."))}</td></tr>`
      : view
          .map((l) => {
            const types = l.type_codes.filter((c) => c !== l.category_code);
            const label =
              types.length === 0
                ? esc(l.category_code)
                : `${esc(l.category_code)} <span class="muted pool-type-note">${esc(types.join(", "))}</span>`;
            return `<tr data-pool-category="${esc(l.category_code)}" data-pool-types="${esc(l.type_codes.join(","))}" data-pool-in="${esc(
              String(l.in_grams)
            )}" data-pool-out="${esc(String(l.out_grams))}" data-pool-remaining="${esc(String(l.remaining))}">
          <td>${label}</td>
          <td>${esc(formatGrams(l.in_grams))}</td>
          <td>${esc(formatGrams(l.out_grams))}</td>
          <td>${esc(formatGrams(l.remaining))}</td>
        </tr>`;
          })
          .join("");
  return `<table class="data cryo-pool" data-cryo-pool data-pool-total-in="${esc(String(totals.totalIn))}" data-pool-total-out="${esc(
    String(totals.totalOut)
  )}" data-pool-total-remaining="${esc(String(totals.totalRemaining))}">
      <thead><tr><th>${esc(t(locale, "Category"))}</th><th>${esc(t(locale, "In (g)"))}</th><th>${esc(t(locale, "Out (g)"))}</th><th>${esc(t(locale, "Remaining (g)"))}</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><th>${esc(t(locale, "Total"))}</th><th>${esc(formatGrams(totals.totalIn))}</th><th>${esc(formatGrams(totals.totalOut))}</th><th data-pool-remaining-cell>${esc(formatGrams(totals.totalRemaining))}</th></tr>
      </tfoot>
    </table>`;
}

function unfinishPinForm(action: string, locale: Locale): string {
  const title = t(locale, "Unfinish");
  return `<form method="post" action="${esc(action)}" class="shuttle-form">
            <label class="field">${esc(t(locale, "Admin PIN"))} <input type="password" name="unfinish_pin" inputmode="numeric" autocomplete="off"></label>
            <button type="submit" class="shuttle-btn" title="${esc(title)}" aria-label="${esc(title)}">&lt;</button>
          </form>`;
}

function consumedList(runId: string, inputs: readonly CryoRunInputRow[], locale: Locale): string {
  if (inputs.length === 0) return "";
  const rows = inputs
    .map(
      (row) => `<li data-cryo-input="${esc(row.id)}" data-cryo-container="${esc(row.wip_package_id)}">
        <span>${esc(row.package_code ?? row.wip_package_id)}</span>
        <span class="muted">${esc(row.package_type_code)}</span>
        <span>${esc(formatGrams(row.weight_grams))} g</span>
        ${unfinishPinForm(`${CRYO_STATION_PATH}/run/${runId}/unfinish-container/${row.id}`, locale)}
      </li>`
    )
    .join("");
  return `<section data-cryo-consumed>
      <h3>${esc(t(locale, "Consumed containers"))} <span class="tile-count">${esc(String(inputs.length))}</span></h3>
      <ul>${rows}</ul>
    </section>`;
}

function outputsList(outputs: CryoOutputRow[], locale: Locale, finishedRunId?: string): string {
  const body =
    outputs.length === 0
      ? `<p class="muted">${esc(t(locale, "No packages entered yet."))}</p>`
      : `<table class="data trim-entered" data-cryo-outputs>
        <thead><tr><th>${esc(t(locale, "Package tag"))}</th><th>${esc(t(locale, "Category"))}</th><th>${esc(t(locale, "Weight (g)"))}</th><th>${esc(
          t(locale, "Date")
        )}</th><th>${esc(t(locale, "Operator"))}</th><th>${esc(t(locale, "Controls"))}</th></tr></thead>
        <tbody>${outputs
          .map(
            (r) => `<tr data-package="${esc(r.id)}" data-entered-tag="${esc(r.package_code.toUpperCase())}"${isMetrcTag(r.package_code) ? "" : ' data-tag-shape="off"'}>
          <td><code>${esc(r.package_code)}</code></td>
          <td>${esc(r.package_type_code)}</td>
          <td>${esc(formatGrams(r.weight_grams))}</td>
          <td>${esc(r.cryo_date ?? r.created_at.slice(0, 10))}</td>
          <td>${esc(r.cryo_operator ?? "")}</td>
          <td class="row-actions">
            <a class="btn secondary pencil" href="/record/wip_packages/${esc(r.id)}/edit" title="${esc(t(locale, "Edit with reason (PIN)"))}" aria-label="Edit package">&#9998;</a>
            ${
              finishedRunId
                ? unfinishPinForm(`${CRYO_STATION_PATH}/run/${finishedRunId}/unfinish-output/${r.id}`, locale)
                : `<a class="btn secondary" href="/record/wip_packages/${esc(r.id)}/void" title="${esc(t(locale, "Void with reason (PIN)"))}" aria-label="Void package">&times;</a>`
            }
          </td>
        </tr>`
          )
          .join("")}</tbody>
      </table>`;
  return `<section class="trim-entered-block">
      <h3>${esc(t(locale, "Entered packages"))} <span class="tile-count">${esc(String(outputs.length))}</span></h3>
      ${body}
    </section>`;
}

/** The trim-style line (owner: "the plus line should ratify what's in the entry
 * fields and reset the fields to null"): the plus posts the line and the page
 * comes back with the tag, the category and the weight blank; the Operator
 * stays filled from the last line. THE CRYO CATEGORIES (canon 0.30.112): the
 * category box lists the product categories in his order, blank until picked. */
function entryForm(run: CryoRunRow, categories: readonly string[], outputs: CryoOutputRow[], locale: Locale): string {
  const categoryOpts = [`<option value=""></option>`, ...categories.map((code) => `<option value="${esc(code)}">${esc(code)}</option>`)].join("");
  const lastOperator = outputs[0]?.cryo_operator ?? "";
  const hint = t(locale, "The cryo date saved on each package entered. Today by default; the Admin PIN sets another day.");
  return `<form class="stack" method="post" action="${CRYO_STATION_PATH}/run/${esc(run.id)}/add" data-cryo-add data-lock-on-submit>
      ${effectiveDateField(null, locale, hint)}
      <label class="field">${esc(t(locale, "Operator"))}
        <input type="text" name="cryo_operator" required autocomplete="off" value="${esc(lastOperator)}">
      </label>
      <fieldset>
        <legend>${esc(t(locale, "Packages"))}</legend>
        <p class="muted">${esc(t(locale, "Scan the new package tag, pick its product category, type its weight, press the plus. Each line is a new container born into the Testing queue, drawn from the pool above."))}</p>
        <table class="data pkg-table" id="pkg-table">
          <thead><tr><th>${esc(t(locale, "Package tag"))}</th><th>${esc(t(locale, "Category"))}</th><th>${esc(t(locale, "Weight (g)"))}</th></tr></thead>
          <tbody id="pkg-rows">
            <tr>
              <td><input type="text" name="package_code" class="metrc-tag-input" placeholder="1A..." title="${esc(t(locale, "The METRC package tag: 1A plus 22 hex characters"))}" autocomplete="off" spellcheck="false" required data-metrc-tag></td>
              <td><select name="package_type_code" id="cryo-plus-type" required data-cryo-category>${categoryOpts}</select></td>
              <td><input type="number" name="weight_grams" step="0.01" min="0.01" required id="cryo-plus-weight"></td>
            </tr>
          </tbody>
        </table>
        ${duplicateTagGuard(locale)}
        <p><button type="submit" class="secondary" id="add-pkg" name="plus_one" value="1" title="${esc(t(locale, "Add the typed package to the list"))}">+</button></p>
        <script>
          (function () {
            var btn = document.getElementById("add-pkg");
            if (!btn) return;
            btn.addEventListener("click", function (e) {
              if (e.defaultPrevented) return;
              var category = (document.getElementById("cryo-plus-type") || {}).value || "";
              var w = parseFloat((document.getElementById("cryo-plus-weight") || {}).value || "");
              if (!category || !isFinite(w)) return;
              var row = document.querySelector('[data-pool-category="' + category + '"]');
              var remaining = row ? parseFloat(row.getAttribute("data-pool-remaining") || "") : 0;
              if (isFinite(remaining) && w > remaining + ${OVERISSUE_TOLERANCE_GRAMS}) {
                if (!confirm(${JSON.stringify(t(locale, "This weight over issues the pool for its category. Record it anyway?"))})) e.preventDefault();
              }
            });
          })();
        </script>
      </fieldset>
    </form>`;
}

function finishForm(run: CryoRunRow, outputs: CryoOutputRow[], locale: Locale): string {
  const none = outputs.length === 0;
  const confirmMsg = t(locale, "Finish the run? The trim containers become archival and the New Packages file pends at the export home.");
  return `<form method="post" action="${CRYO_STATION_PATH}/run/${esc(run.id)}/finish" class="stack cryo-finish" data-cryo-finish data-confirm="${esc(confirmMsg)}">
      ${none ? `<p class="muted" data-cryo-finish-blocked>${esc(t(locale, CRYO_REFUSAL.noOutputs))}</p>` : ""}
      <button type="submit" class="danger"${none ? " disabled" : ""}>${esc(t(locale, "Finish run"))}</button>
      <script>
        (function () {
          var form = document.querySelector("[data-cryo-finish]");
          if (!form) return;
          form.addEventListener("submit", function (e) {
            if (!confirm(form.getAttribute("data-confirm") || "")) e.preventDefault();
          });
        })();
      </script>
    </form>`;
}

function flashLine(ok: string | undefined, err: string | undefined, locale: Locale): string {
  if (err) return `<p class="banner err">${esc(err)}</p>`;
  if (ok === "plus") return `<p class="banner ok">${esc(t(locale, "Package entered."))}</p>`;
  if (ok === "finished") {
    return `<p class="banner ok">${esc(t(locale, "Run finished. The trim containers are archival; the New Packages file pends at the export home."))}</p>`;
  }
  if (ok === "container_unfinished" || ok === "output_unfinished") return "";
  return "";
}

/** The Cryo Weight Entry page: the runs in the left pane, one per HBN, no
 * containers; the picked run's pool by type, the trim-style line entry, the
 * entered packages and Finish run in the working pane. */
export function cryoStationPage(input: CryoStationInput): string {
  const locale = input.locale ?? "en";
  const heading = `<h1>${esc(t(locale, "Cryo Weight Entry"))}</h1>`;
  const pickedId = input.picked?.run.id ?? "";
  const paneBody =
    input.runs.length === 0
      ? `<p class="muted">${esc(t(locale, "No runs scheduled."))} <a href="/production/scheduling/cryo">${esc(
          t(locale, "Schedule an HBN for pasteurization first.")
        )}</a></p>`
      : `<ul>${input.runs.map((run) => paneItem(run, run.id === pickedId, locale)).join("")}</ul>`;
  const aside = `<aside class="queue-pane" data-cryo-runs>
      <h2>${esc(t(locale, "Pasteurization runs"))} <span class="tile-count">${input.runs.length}</span></h2>
      ${paneBody}
    </aside>`;
  let working: string;
  if (!input.picked) {
    working = `<p class="muted">${esc(t(locale, "Pick a run from the pane."))}</p>`;
  } else {
    const { run, pool, outputs, categories } = input.picked;
    const finished = run.status === "complete";
    const inputs = input.picked.inputs ?? [];
    const meta = [run.farm_code, run.strain_name ?? "", run.entry_date].filter(Boolean).join(" / ");
    const state = finished
      ? `<p class="muted" data-cryo-run-finished>${esc(t(locale, "Finished"))} ${
          run.completed_at ? `<time datetime="${esc(run.completed_at)}" data-local>${esc(run.completed_at)}</time>` : ""
        }. <a href="/admin/uploads">${esc(t(locale, "The New Packages file pends at the export home."))}</a></p>`
      : "";
    working = `<h2 class="working-pick">${esc(run.hbn)}</h2>
      <p class="muted">${esc(meta)}</p>
      ${terpRunHeader(run, locale)}
      ${state}
      ${poolTable(pool, locale)}
      ${finished ? consumedList(run.id, inputs, locale) : ""}
      ${finished ? "" : entryForm(run, categories, outputs, locale)}
      ${outputsList(outputs, locale, finished ? run.id : undefined)}
      ${finished ? "" : finishForm(run, outputs, locale)}`;
  }
  return `${heading}
    ${flashLine(input.ok, input.err, locale)}
    <div class="station-split">
      ${aside}
      <div class="working-pane" data-cryo-working>
        ${working}
      </div>
    </div>
    ${lockOnSubmitScript()}${localTimeScript()}`;
}

/* ------------------------------------------------ the New Packages file */

/** The owner's T3 autofill template, byte for byte: three header rows (the
 * repeater, the field path, the label), one data row per output line; a
 * second ingredient of the same line rides a row of its own with the line
 * columns blank. */
export const NEW_PACKAGES_ROW1: readonly string[] = [
  ...Array.from({ length: 21 }, () => "line in repeaterLines"),
  ...Array.from({ length: 5 }, () => "ingredient in line.Ingredients"),
];
export const NEW_PACKAGES_ROW2: readonly string[] = [
  "line.TagId", "line.LocationId", "line.ItemId", "line.UseSameItem", "line.Quantity", "line.UnitOfMeasureId", "line.Note",
  "line.ActualDate", "line.ExpirationDate", "line.SellByDate", "line.UseByDate", "line.IsTradeSample", "line.IsProductionBatch",
  "line.ProductionBatchNumber", "line.RemediateProduct", "line.RemediationMethodId", "line.RemediationDate", "line.RemediationSteps",
  "line.IsDonation", "templateIngredients.Quantity", "templateIngredients.UnitOfMeasureId", "ingredient.PackageId", "ingredient.Quantity",
  "ingredient.UnitOfMeasureId", "ingredient.FinishPackage", "ingredient.FinishDate",
];
export const NEW_PACKAGES_ROW3: readonly string[] = [
  "Tag Number", "Location Name", "Item Name", "Same Item", "Quantity", "Unit Of Measure", "Note", "Actual Date", "Expiration Date",
  "Sell By Date", "Use By Date", "Trade Sample", "Production Batch", "Production Batch Number", "Remediate Product", "Method",
  "Remediation Date", "Remediation Steps", "Donation", "Template Ingredients Quantity", "Template Ingredients Unit Of Measure",
  "Package Number", "Ingredient Quantity", "Ingredient Unit Of Measure", "Finish Package", "Ingredient Finish Date",
];
export const NEW_PACKAGES_SHEET_NAME = "new_packages_autofill_template.";
const COLS = 26;
const COL = { tag: 0, location: 1, sameItem: 3, quantity: 4, uom: 5, actualDate: 7, ingPackage: 21, ingQuantity: 22, ingUom: 23 } as const;

export type NewPackagesIngredient = { packageLabel: string; quantity: number };
export type NewPackagesLine = {
  tag: string;
  quantity: number;
  actualDate: string;
  ingredients: NewPackagesIngredient[];
  location?: string;
  itemName?: string;
  sameItem?: string;
  unitOfMeasure?: string;
};

/** Each output draws its whole weight from the HBN's harvest packages in lot
 * order (owner: "that weight is consumed from the sum of weight stored in the
 * HBN"); a package's share is the trimmed grams its lot put into the run, so
 * an output that straddles two lots lists two ingredients. When the shares run
 * out (an over issue), the last package carries the rest. */
export function allocateIngredients(
  outputs: ReadonlyArray<{ id: string; grams: number }>,
  sources: ReadonlyArray<{ label: string; capacity: number }>
): Map<string, NewPackagesIngredient[]> {
  const out = new Map<string, NewPackagesIngredient[]>();
  const left = sources.map((s) => ({ label: s.label, left: metrcQuantity(s.capacity) }));
  let cursor = 0;
  for (const o of outputs) {
    let need = metrcQuantity(o.grams);
    const parts: NewPackagesIngredient[] = [];
    while (need > OVERISSUE_TOLERANCE_GRAMS && cursor < left.length) {
      const src = left[cursor];
      const take = metrcQuantity(Math.min(need, src.left));
      if (take > OVERISSUE_TOLERANCE_GRAMS) {
        parts.push({ packageLabel: src.label, quantity: take });
        src.left = metrcQuantity(src.left - take);
        need = metrcQuantity(need - take);
      }
      if (src.left <= OVERISSUE_TOLERANCE_GRAMS && cursor < left.length - 1) cursor += 1;
      else if (src.left <= OVERISSUE_TOLERANCE_GRAMS) break;
    }
    if (need > OVERISSUE_TOLERANCE_GRAMS) {
      const label = left.length ? left[left.length - 1].label : "";
      const last = parts.length && parts[parts.length - 1].packageLabel === label ? parts[parts.length - 1] : null;
      if (last) last.quantity = metrcQuantity(last.quantity + need);
      else parts.push({ packageLabel: label, quantity: need });
    }
    out.set(o.id, parts);
  }
  return out;
}

function blankRow(): XlsxCell[] {
  return Array.from({ length: COLS }, () => ({}) as XlsxCell);
}

export function newPackagesRows(lines: readonly NewPackagesLine[]): XlsxCell[][] {
  const rows: XlsxCell[][] = [];
  for (const line of lines) {
    const ingredients = line.ingredients.length ? line.ingredients : [{ packageLabel: "", quantity: line.quantity }];
    ingredients.forEach((ing, i) => {
      const row = blankRow();
      if (i === 0) {
        row[COL.tag] = { text: line.tag };
        row[COL.location] = { text: line.location ?? LOC_CRYO_ROOM };
        if (line.itemName) row[2] = { text: line.itemName };
        row[COL.sameItem] = { text: line.sameItem ?? "yes" };
        row[COL.quantity] = { number: metrcQuantity(line.quantity) };
        row[COL.uom] = { text: line.unitOfMeasure ?? "Grams" };
        row[COL.actualDate] = { text: line.actualDate };
      }
      row[COL.ingPackage] = { text: ing.packageLabel };
      row[COL.ingQuantity] = { number: metrcQuantity(ing.quantity) };
      row[COL.ingUom] = { text: "Grams" };
      rows.push(row);
    });
  }
  return rows;
}

export function newPackagesSheet(lines: readonly NewPackagesLine[]): XlsxSheet {
  return {
    headers: [...NEW_PACKAGES_ROW1],
    rows: [NEW_PACKAGES_ROW2.map((text) => ({ text })), NEW_PACKAGES_ROW3.map((text) => ({ text })), ...newPackagesRows(lines)],
    colWidths: Array.from({ length: COLS }, () => 24),
    sheetName: NEW_PACKAGES_SHEET_NAME,
    plainNumbers: true,
  };
}
