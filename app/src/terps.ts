/**
 * TERP RECIPES AND THE PASTEURIZATION SCHEDULE (canon 0.30.321). The lookup
 * builder, the schedule's pick, and the read-only line on Cryo Weight Entry.
 * The server judges a save whether or not the builder's script ran.
 */
import { PRODUCTION_SCHEDULING_PATH } from "./config";
import type { ScheduleItemRow, TerpRecipe } from "./db";
import { etWallClock } from "./farmday";
import { t, type Locale } from "./i18n";
import { esc } from "./ui";

export type TerpRecipeOption = { id: string; name: string };

export function formatTerpDose(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return Number(value).toFixed(2);
}

function lineText(name: string, percent: number): string {
  return `${name} ${percent}%`;
}

export function terpRecipesPage(input: { recipes: TerpRecipe[]; showRetired: boolean; locale?: Locale }): string {
  const locale = input.locale ?? "en";
  const active = input.recipes.filter((row) => row.status === "active");
  const retired = input.recipes.filter((row) => row.status === "retired");
  const plain = Array.from({ length: 8 }, () => {
    return `<div class="terp-plain-row">
      <input type="text" name="terp_name" autocomplete="off" aria-label="${esc(t(locale, "Terp Name"))}">
      <input type="text" name="percent" inputmode="numeric" autocomplete="off" aria-label="%">
    </div>`;
  }).join("");
  const activeList =
    active.length === 0
      ? `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`
      : `<ul class="terp-saved" data-terp-active>${active.map((row) => recipeArticle(row, locale, true)).join("")}</ul>`;
  const retiredList =
    retired.length === 0
      ? `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`
      : `<ul class="terp-saved" data-terp-retired-list>${retired.map((row) => recipeArticle(row, locale, false)).join("")}</ul>`;
  return `<h1>${esc(t(locale, "Terp Recipes"))}</h1>
    <form method="post" action="/admin/lookups/terp_recipes" class="stack terp-builder" data-terp-builder
      data-warn-empty="${esc(t(locale, "Type a terp name and a percent."))}"
      data-warn-over="${esc(t(locale, "That percent would pass 100."))}">
      <input type="hidden" name="action" value="save">
      <label class="field">${esc(t(locale, "Recipe Name"))} <input type="text" name="recipe_name" autocomplete="off"></label>
      <div class="terp-work" data-terp-work>
        <label class="field">${esc(t(locale, "Terp Name"))} <input type="text" data-terp-name autocomplete="off"></label>
        <label class="field">% <input type="text" data-terp-percent inputmode="numeric" value="100" autocomplete="off"></label>
        <button type="button" data-terp-plus aria-label="+">+</button>
        <button type="button" data-terp-clear>${esc(t(locale, "Start Over"))}</button>
      </div>
      <p class="field-warn" data-terp-warn hidden></p>
      <ul class="terp-lines" data-terp-lines></ul>
      <p class="muted" data-terp-total>0%</p>
      <div class="terp-complete" data-terp-complete hidden>
        <p>${esc(t(locale, "This Mix is complete, would you like to save?"))}</p>
        <button type="submit">${esc(t(locale, "Save"))}</button>
        <button type="button" data-terp-clear>${esc(t(locale, "Start Over"))}</button>
      </div>
      <div data-terp-plain>
        ${plain}
        <button type="submit">${esc(t(locale, "Save"))}</button>
      </div>
    </form>
    ${terpBuilderScript()}
    <section data-terp-list>
      <h2>${esc(t(locale, "Terp Recipes"))}</h2>
      ${activeList}
      <details class="terp-retired" data-terp-retired${input.showRetired ? " open" : ""}>
        <summary>${esc(t(locale, "Show retired"))}</summary>
        ${retiredList}
      </details>
    </section>`;
}

function recipeArticle(row: TerpRecipe, locale: Locale, canRetire: boolean): string {
  const lines = row.lines.map((line) => esc(lineText(line.terp_name, Number(line.percent)))).join(", ");
  const when = canRetire
    ? `<time datetime="${esc(row.created_at)}">${esc(etWallClock(row.created_at))}</time>`
    : `<time datetime="${esc(row.retired_at ?? "")}">${esc(etWallClock(row.retired_at ?? ""))}</time> ${esc(row.retire_reason ?? "")}`;
  const retire = canRetire
    ? `<form method="post" action="/admin/lookups/terp_recipes" class="terp-retire">
        <input type="hidden" name="action" value="retire">
        <input type="hidden" name="id" value="${esc(row.id)}">
        <input type="text" name="reason" required autocomplete="off" aria-label="${esc(t(locale, "Reason"))}">
        <button type="submit">${esc(t(locale, "Retire"))}</button>
      </form>`
    : "";
  return `<li data-terp-recipe="${esc(row.id)}" data-terp-status="${esc(row.status)}">
      <strong>${esc(row.name)}</strong>
      <span>${lines}</span>
      <span class="muted">${when}</span>
      ${retire}
    </li>`;
}

function terpBuilderScript(): string {
  return `<script>
(function () {
  var form = document.querySelector("[data-terp-builder]");
  if (!form) return;
  var plain = form.querySelector("[data-terp-plain]");
  if (plain) {
    plain.hidden = true;
    plain.querySelectorAll("input").forEach(function (input) { input.disabled = true; });
  }
  var nameBox = form.querySelector("[data-terp-name]");
  var pctBox = form.querySelector("[data-terp-percent]");
  var list = form.querySelector("[data-terp-lines]");
  var total = form.querySelector("[data-terp-total]");
  var warn = form.querySelector("[data-terp-warn]");
  var done = form.querySelector("[data-terp-complete]");
  var recipe = form.querySelector('[name="recipe_name"]');
  function rows() { return list ? Array.prototype.slice.call(list.querySelectorAll("[data-terp-line]")) : []; }
  function sum() {
    var n = 0;
    rows().forEach(function (li) { n += Number(li.getAttribute("data-percent") || "0"); });
    return n;
  }
  function paint() {
    var n = sum();
    var left = 100 - n;
    if (pctBox) pctBox.value = String(left < 0 ? 0 : left);
    if (total) total.textContent = String(n) + "%";
    if (done) done.hidden = n !== 100;
    if (warn) warn.hidden = true;
  }
  function showWarn(msg) {
    if (!warn) return;
    warn.textContent = msg;
    warn.hidden = false;
  }
  function addLine(terp, pct) {
    var li = document.createElement("li");
    li.setAttribute("data-terp-line", "");
    li.setAttribute("data-percent", String(pct));
    var label = document.createElement("span");
    label.textContent = terp + " " + pct + "%";
    var minus = document.createElement("button");
    minus.type = "button";
    minus.setAttribute("data-terp-minus", "");
    minus.setAttribute("aria-label", "-");
    minus.textContent = "-";
    var hiddenName = document.createElement("input");
    hiddenName.type = "hidden";
    hiddenName.name = "terp_name";
    hiddenName.value = terp;
    var hiddenPct = document.createElement("input");
    hiddenPct.type = "hidden";
    hiddenPct.name = "percent";
    hiddenPct.value = String(pct);
    li.appendChild(label);
    li.appendChild(minus);
    li.appendChild(hiddenName);
    li.appendChild(hiddenPct);
    list.appendChild(li);
  }
  form.addEventListener("click", function (e) {
    var target = e.target;
    if (!target || !target.getAttribute) return;
    if (target.hasAttribute("data-terp-plus")) {
      var terp = (nameBox && nameBox.value ? nameBox.value : "").trim();
      var raw = (pctBox && pctBox.value ? pctBox.value : "").trim();
      if (!terp || !raw) {
        showWarn(form.getAttribute("data-warn-empty") || "");
        return;
      }
      if (!/^\\d+$/.test(raw)) {
        showWarn(form.getAttribute("data-warn-empty") || "");
        return;
      }
      var pct = Number(raw);
      if (pct < 1 || sum() + pct > 100) {
        showWarn(form.getAttribute("data-warn-over") || "");
        return;
      }
      addLine(terp, pct);
      if (nameBox) nameBox.value = "";
      paint();
      return;
    }
    if (target.hasAttribute("data-terp-minus")) {
      var li = target.closest ? target.closest("[data-terp-line]") : null;
      if (li) li.remove();
      paint();
      return;
    }
    if (target.hasAttribute("data-terp-clear")) {
      e.preventDefault();
      rows().forEach(function (li) { li.remove(); });
      if (recipe) recipe.value = "";
      if (nameBox) nameBox.value = "";
      paint();
    }
  });
  paint();
})();
</script>`;
}

/** The working row's pick. A retired recipe already on the run is named, and is not an option. */
export function terpScheduleControls(item: ScheduleItemRow, recipes: readonly TerpRecipeOption[], locale: Locale): string {
  const held = item.terp_recipe_id && !recipes.some((row) => row.id === item.terp_recipe_id);
  const options = [`<option value=""${item.terp_recipe_id && !held ? "" : " selected"}>${esc(t(locale, "No recipe"))}</option>`]
    .concat(
      recipes.map((row) => {
        const on = row.id === item.terp_recipe_id ? " selected" : "";
        return `<option value="${esc(row.id)}"${on}>${esc(row.name)}</option>`;
      })
    )
    .join("");
  const heldLine = held
    ? `<p class="muted" data-terp-held>${esc(t(locale, "Terp recipe"))}: ${esc(item.terp_recipe_name ?? "")}</p>`
    : "";
  const dose = formatTerpDose(item.terp_dose_pct);
  return `<div class="terp-pick-wrap" data-terp-pick>
      ${heldLine}
      <form method="post" action="${esc(PRODUCTION_SCHEDULING_PATH)}/cryo/terp/${esc(item.id)}" class="terp-pick">
        <label class="field">${esc(t(locale, "Terp recipe"))}
          <select name="terp_recipe_id" data-terp-recipe>${options}</select>
        </label>
        <label class="field">${esc(t(locale, "Dose"))}
          <input type="text" name="terp_dose_pct" data-terp-dose inputmode="decimal" value="${esc(dose)}" autocomplete="off">
        </label>
        <button type="submit">${esc(t(locale, "Save"))}</button>
      </form>
    </div>`;
}

/** The Complete pane's read-only line. */
export function terpCompleteLine(item: ScheduleItemRow, locale: Locale): string {
  if (!item.terp_recipe_id) return `<span class="muted" data-terp-done>${esc(t(locale, "No recipe"))}</span>`;
  const dose = formatTerpDose(item.terp_dose_pct);
  const doseText = dose ? ` <span data-terp-dose>${esc(t(locale, "Dose"))}: ${esc(dose)} %</span>` : "";
  return `<span class="muted" data-terp-done>${esc(t(locale, "Terp recipe"))}: ${esc(item.terp_recipe_name ?? "")}</span>${doseText}`;
}

/** Cryo Weight Entry's read-only header line. */
export function terpRunHeader(run: { terp_recipe_name?: string | null; terp_dose_pct?: number | null; terp_lines?: string | null }, locale: Locale): string {
  if (!run.terp_recipe_name) return `<p class="muted" data-terp-on-run>${esc(t(locale, "No recipe"))}</p>`;
  const lines = (run.terp_lines ?? "").trim();
  const body = lines ? `${run.terp_recipe_name} (${lines})` : run.terp_recipe_name;
  const dose = formatTerpDose(run.terp_dose_pct);
  const doseText = dose ? `<p class="muted" data-terp-dose>${esc(t(locale, "Dose"))}: ${esc(dose)} %</p>` : "";
  return `<p class="muted" data-terp-on-run>${esc(t(locale, "Terp recipe"))}: ${esc(body)}</p>${doseText}`;
}
