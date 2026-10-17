import { describe, expect, it } from "vitest";
import { CONFIG_KEYS, CRYO_CATEGORIES_DEFAULT, LOC_CRYO_ROOM, METRC_UPLOAD_KINDS, SCHEDULE_STAGES, STATUS_TRANSITIONS, WIP_SOURCE, WIP_STATUS, applyTransition, demoteStep, parseCryoCategories, parseCryoTypeCategories } from "../src/config";
import {
  CRYO_REFUSAL,
  NEW_PACKAGES_ROW1,
  NEW_PACKAGES_ROW2,
  NEW_PACKAGES_ROW3,
  NEW_PACKAGES_SHEET_NAME,
  allocateIngredients,
  cryoStationPage,
  newPackagesRows,
  newPackagesSheet,
  overIssuesPool,
  pasteurizationRunLabel,
  poolTotals,
  poolView,
} from "../src/cryo";
import { cryoRunIdentity, foldCryoPool, getCryoRun, listCryoRunInputs, listCryoRuns, listPendingNewPackagesUploads, listScheduleAvailable, listScheduleComplete, listScheduleWorking, newPackagesFilename, shakePackagesFilename, type CryoRunRow } from "../src/db";
import { refusalText } from "../src/i18n";
import { stationByKey } from "../src/pipeline";
import { schedulingPage } from "../src/scheduling";
import { buildXlsx, xlsxHasParts } from "../src/xlsx";
import { addCryoOutput, addShakeOutput, buildNewPackagesXlsx, buildShakeNewPackagesXlsx, finishCryoRun, markUploaded, unfinishCryoOutput, unfinishScheduleItem } from "../src/actions";
import { formOf, migratedDb, seedBatch, seedLot, seedMirror, seedPerson } from "./migrated";

/** THE CRYO RUN (canon 0.30.110). Owner rulings 2026-09-17, verbatim: "For
 * cryo, replicate the trim line surface in cryo production reporting.  Also,
 * in production scheduling for pasteurization collapse the lines to their HBN,
 * do not expose individual containers on the scheduled surface or on the input
 * list in the production reporting node." His picks at the forks: a line is a
 * new output container; the trim containers pool by product type and are
 * consumed; outputs go straight to the Testing queue; the name stays Cryo
 * Weight Entry; Location Name always prints Cryo Room; the T3 template
 * new_packages_autofill_template.t3.xlsx is the file.
 *
 * THE CRYO CATEGORIES (canon 0.30.112). Owner rulings 2026-09-17, verbatim: "in
 * cryo weight entry, add the product categories: 1. WPR 2. BUD 3. SHA"; "Cryo
 * weights should be listed beneath the entry surface (just like trim), the
 * plus line should ratify what's in the entry fields and reset the fields to
 * null.  Keep the running package total and how much is left in the parent at
 * the top (same as trim)"; "When a hard entered (under the entry surface) tag
 * number is scanned into the entry surface a warning (in the language selected
 * at the pill) warns the user of a duplicate tag and doesn't allow it to
 * proceed." */

const run: CryoRunRow = {
  id: "run-1",
  status: "scheduled",
  scheduled_at: "2026-09-17T12:00:00.000Z",
  completed_at: null,
  effective_date: "2026-09-17",
  harvest_batch_id: "hb1",
  hbn: "26260-PNN-GH-027-0-NA-26011",
  entry_date: "2026-09-17",
  farm_code: "PNN",
  strain_name: "Fruity Pebbles",
  containers: 3,
  in_grams: 22679,
  outputs: 1,
  out_grams: 22000,
};
// THE POOL BY CATEGORY (canon 0.30.121): one line per category, the trim types
// that read as it beside it (SMALLS is WPR, SHAKE is SHA, BUD is itself), what
// came in under those types and what went out under the category.
const pool = {
  lines: [
    { category_code: "BUD", type_codes: ["BUD"], in_grams: 22000, out_grams: 22000 },
    { category_code: "WPR", type_codes: ["SMALLS"], in_grams: 500, out_grams: 0 },
    { category_code: "SHA", type_codes: ["SHAKE"], in_grams: 179, out_grams: 0 },
  ],
};
const categories = ["WPR", "BUD", "SHA"];
const outputs = [
  {
    id: "o1",
    package_code: "1A40503000311FB000038864",
    package_type_code: "BUD",
    weight_grams: 22000,
    cryo_date: "2026-09-17",
    cryo_operator: "Austin",
    status: "testing_queue",
    created_at: "2026-09-17T12:30:00.000Z",
  },
];

describe("THE CRYO RUN: the statuses, the transition, the source", () => {
  it("a consumed trim container reads pasteurized, out of every queue; the transition and its demote step", () => {
    expect(WIP_STATUS.pasteurized).toBe("pasteurized");
    expect(STATUS_TRANSITIONS.cryo_consumed).toEqual({ entity: "wip_packages", from: "cryo_queue", to: "pasteurized" });
    expect(applyTransition("cryo_consumed", "cryo_queue")).toBe("pasteurized");
    expect(() => applyTransition("cryo_consumed", "testing_queue")).toThrow(/expected cryo_queue/);
    expect(demoteStep("wip_packages", "pasteurized")).toEqual({ to: "cryo_queue" });
    expect(WIP_SOURCE).toEqual({ trim: "trim", cryo: "cryo", metrc: "metrc" });
    expect(METRC_UPLOAD_KINDS.new_packages).toBe("new_packages");
    expect(LOC_CRYO_ROOM).toBe("Cryo Room");
  });

  it("THE CRYO CATEGORIES: the product categories are a value in data, in his order, WPR BUD SHA when blank", () => {
    expect(CONFIG_KEYS.cryo_product_categories).toBe("cryo_product_categories");
    expect(CRYO_CATEGORIES_DEFAULT).toEqual(["WPR", "BUD", "SHA"]);
    expect(parseCryoCategories(null)).toEqual(["WPR", "BUD", "SHA"]);
    expect(parseCryoCategories("  ")).toEqual(["WPR", "BUD", "SHA"]);
    expect(parseCryoCategories(" wpr, bud ,sha, bud")).toEqual(["WPR", "BUD", "SHA"]);
    expect(parseCryoCategories("BUD,SHA,PRE")).toEqual(["BUD", "SHA", "PRE"]);
  });

  it("the station keeps its name, drops the header form and the per-package widget", () => {
    const station = stationByKey("cryo_weight")!;
    expect(station.title).toBe("Cryo Weight Entry");
    expect(station.transition).toBeUndefined();
    expect(station.fields.map((f) => f.input)).toEqual(["effective_date", "text", "cryo_lines"]);
    expect(station.leftPane?.pickField).toBe("run_id");
  });
});

describe("THE POOL BY CATEGORY: each category's available weight", () => {
  it("Remaining is In minus Out per category; the totals sum the lines", () => {
    expect(poolView(pool).map((l) => [l.category_code, l.remaining])).toEqual([["BUD", 0], ["WPR", 500], ["SHA", 179]]);
    const totals = poolTotals(pool);
    expect(totals.totalIn).toBe(22679);
    expect(totals.totalOut).toBe(22000);
    expect(totals.totalRemaining).toBe(679);
    expect(poolTotals({ lines: [] })).toEqual({ totalIn: 0, totalOut: 0, totalRemaining: 0 });
  });

  it("folds the run's inputs by type and outputs by category into one line per category, in the list's order", () => {
    const map = parseCryoTypeCategories("BUD=BUD,SMALLS=WPR,SHAKE=SHA");
    const folded = foldCryoPool(
      [
        { package_type_code: "SHAKE", grams: 8055 },
        { package_type_code: "SMALLS", grams: 140772 },
        { package_type_code: "BUD", grams: 194385 },
      ],
      [
        { category_code: "BUD", grams: 192457 },
        { category_code: "WPR", grams: 100.5 },
      ],
      map
    );
    expect(folded.lines).toEqual([
      { category_code: "BUD", type_codes: ["BUD"], in_grams: 194385, out_grams: 192457 },
      { category_code: "WPR", type_codes: ["SMALLS"], in_grams: 140772, out_grams: 101 },
      { category_code: "SHA", type_codes: ["SHAKE"], in_grams: 8055, out_grams: 0 },
    ]);
    expect(poolView(folded).map((l) => l.remaining)).toEqual([1928, 140671, 8055]);
    // Two types reading as one category share its line; a category entered
    // with no type behind it lists last with 0 in; a type off the list reads as itself.
    const two = foldCryoPool(
      [
        { package_type_code: "SMALLS", grams: 10 },
        { package_type_code: "POPCORN", grams: 5 },
        { package_type_code: "TRIM", grams: 1 },
      ],
      [{ category_code: "PRE", grams: 2 }],
      parseCryoTypeCategories("BUD=BUD,SMALLS=WPR,POPCORN=WPR,SHAKE=SHA")
    );
    expect(two.lines).toEqual([
      { category_code: "WPR", type_codes: ["SMALLS", "POPCORN"], in_grams: 15, out_grams: 0 },
      { category_code: "TRIM", type_codes: ["TRIM"], in_grams: 1, out_grams: 0 },
      { category_code: "PRE", type_codes: [], in_grams: 0, out_grams: 2 },
    ]);
  });

  it("THE OVERISSUE LINE IS STRICT: landing on the remaining is not an over issue, past half a cent is", () => {
    expect(overIssuesPool(679, 679)).toBe(false);
    expect(overIssuesPool(679, 679.004)).toBe(false);
    expect(overIssuesPool(679, 679.01)).toBe(true);
    expect(overIssuesPool(0, 0.01)).toBe(true);
  });

  it("the run's line on the scheduling panes reads the pool, never a container", () => {
    expect(cryoRunIdentity({ containers: 3, in_grams: 22679 })).toBe("3 containers / 22,679 g in");
    expect(cryoRunIdentity({ containers: 1, in_grams: 500, outputs: 2, out_grams: 480 })).toBe("1 container / 500 g in / 2 out, 480 g");
  });
});

describe("THE CRYO RUN: the Cryo Weight Entry page", () => {
  it("lists the runs by HBN in the pane, no containers, and prompts for a pick", () => {
    const html = cryoStationPage({ runs: [run], nowIso: "2026-09-17T12:00:00.000Z" });
    expect(html).toContain("<h1>Cryo Weight Entry</h1>");
    expect(html).toContain('<a class="queue-pane-item" href="/station/cryo_weight?pick=run-1" title="26260-PNN-GH-027-0-NA-26011" data-cryo-run="run-1"><strong>26011 - no code - 3 containers</strong> <span class="muted">22,679 g - 50.62 lb - Fruity Pebbles</span></a>');
    expect(html).toContain('Pasteurization runs <span class="tile-count">1</span>');
    expect(html).toContain('data-cryo-finished');
    expect(html).toContain('Finished <span class="tile-count">0</span>');
    expect(html).toContain("Pick a run from the pane.");
    expect(html).not.toContain("1A40503000311FB000038864");
    expect(html).not.toContain('name="package_id"');
  });

  it("with nothing scheduled it points at the Pasteurization station", () => {
    const html = cryoStationPage({ runs: [], nowIso: "2026-09-17T12:00:00.000Z" });
    expect(html).toContain("No runs scheduled.");
    expect(html).toContain('href="/production/scheduling/cryo"');
  });

  it("the picked run shows the pool, the trim-style line, the entered packages and Finish run", () => {
    const html = cryoStationPage({ runs: [run], picked: { run, pool, outputs, categories }, nowIso: "2026-09-17T12:00:00.000Z" });
    expect(html).toContain('<a class="queue-pane-item selected" href="/station/cryo_weight?pick=run-1"');
    expect(html).toContain('<h2 class="working-pick">26011 - no code - 3 containers</h2>');
    expect(html).toContain("22,679 g - 50.62 lb - Fruity Pebbles");
    expect(html).toContain("<p class=\"muted\">26260-PNN-GH-027-0-NA-26011</p>");
    // THE POOL BY CATEGORY (owner: "the available weight in each category, so
    // the TL in cryo knows they're not over-issuing one particular product
    // category"): one row per category with In, Out and Remaining, the Total
    // row beneath; each row carries its remaining for the plus guard.
    expect(html).toContain('<table class="data cryo-pool" data-cryo-pool data-pool-total-in="22679" data-pool-total-out="22000" data-pool-total-remaining="679">');
    expect(html).toContain("<th>Category</th><th>In (g)</th><th>Out (g)</th><th>Remaining (g)</th>");
    // The category reads with its trim types beside it where they differ (his
    // "x amount of bud, y amount of wpr, and z amount of shake"), one row per
    // category in the list's order.
    expect(html).toMatch(/<tr data-pool-category="BUD" data-pool-types="BUD" data-pool-in="22000" data-pool-out="22000" data-pool-remaining="0">\s*<td>BUD<\/td>\s*<td>22,000<\/td>\s*<td>22,000<\/td>\s*<td>0<\/td>/);
    expect(html).toMatch(/<tr data-pool-category="WPR" data-pool-types="SMALLS" data-pool-in="500" data-pool-out="0" data-pool-remaining="500">\s*<td>WPR <span class="muted pool-type-note">SMALLS<\/span><\/td>\s*<td>500<\/td>\s*<td>0<\/td>\s*<td>500<\/td>/);
    expect(html).toMatch(/<tr data-pool-category="SHA" data-pool-types="SHAKE" data-pool-in="179" data-pool-out="0" data-pool-remaining="179">\s*<td>SHA <span class="muted pool-type-note">SHAKE<\/span><\/td>\s*<td>179<\/td>\s*<td>0<\/td>\s*<td>179<\/td>/);
    expect(html.indexOf('data-pool-category="BUD"')).toBeLessThan(html.indexOf('data-pool-category="WPR"'));
    expect(html.indexOf('data-pool-category="WPR"')).toBeLessThan(html.indexOf('data-pool-category="SHA"'));
    expect(html).toContain('<tr><th>Total</th><th>22,679</th><th>22,000</th><th data-pool-remaining-cell>679</th></tr>');
    expect(html).not.toContain("data-out-category");
    // The line: tag, the product category (blank until picked, his order), weight, plus; the Effective Date and the operator above it.
    expect(html).toContain('action="/station/cryo_weight/run/run-1/add"');
    expect(html).toContain('<details class="effective-date" data-effective-date>');
    expect(html).toContain('name="cryo_operator" required autocomplete="off" data-keep-operator value="Austin"');
    expect(html).toContain(
      '<select name="package_type_code" id="cryo-plus-type" required data-cryo-category><option value=""></option><option value="WPR">WPR</option><option value="BUD">BUD</option><option value="SHA">SHA</option></select>'
    );
    expect(html).not.toContain('<option value="TRIM">');
    expect(html).toContain('name="weight_grams" step="0.01" min="0.01" required id="cryo-plus-weight"');
    expect(html).toContain('id="add-pkg" name="plus_one" value="1"');
    // The plus asks against the picked category's remaining, never the pool's whole.
    expect(html).toContain("This weight over issues the pool for its category. Record it anyway?");
    expect(html).toContain(`document.querySelector('[data-pool-category="' + category + '"]')`);
    expect(html).toContain('row.getAttribute("data-pool-remaining")');
    expect(html).not.toContain('pool.getAttribute("data-pool-total-remaining")');
    // THE DUPLICATE TAG: the warning line in the page's language, hidden until a
    // scanned tag matches an entered row, and the guard on the plus.
    expect(html).toContain('<p class="banner err" id="dup-tag-warning" role="alert" hidden data-dup-tag-warning>That tag is already entered beneath. Scan a different package.</p>');
    expect(html).toContain('document.querySelectorAll("[data-entered-tag]")');
    expect(html).toContain("if (check()) { e.preventDefault(); input.focus(); input.select(); }");
    // The entered packages beneath the entry surface, newest first, pencil and x behind the PIN.
    expect(html).toContain("Entered packages");
    expect(html.indexOf('action="/station/cryo_weight/run/run-1/add"')).toBeLessThan(html.indexOf("Entered packages"));
    expect(html).toContain('<tr data-package="o1" data-entered-tag="1A40503000311FB000038864">');
    expect(html).toContain("<th>Package tag</th><th>Category</th><th>Weight (g)</th>");
    expect(html).toContain("<code>1A40503000311FB000038864</code>");
    expect(html).toContain('href="/record/wip_packages/o1/edit"');
    expect(html).toContain('href="/record/wip_packages/o1/void"');
    // Finish run, armed because an output stands.
    expect(html).toContain('action="/station/cryo_weight/run/run-1/finish"');
    expect(html).toContain('<button type="submit" class="danger">Finish run</button>');
    expect(html).not.toContain("data-cryo-finish-blocked");
  });

  it("Finish run stays disabled until a package is entered", () => {
    const fresh = { lines: pool.lines.map((l) => ({ ...l, out_grams: 0 })) };
    const html = cryoStationPage({ runs: [run], picked: { run, pool: fresh, outputs: [], categories }, nowIso: "2026-09-17T12:00:00.000Z" });
    expect(html).toContain('data-cryo-finish-blocked>Enter at least one package before finishing.</p>');
    expect(html).toContain('data-pool-total-in="22679" data-pool-total-out="0" data-pool-total-remaining="22679"');
    expect(html).toContain('<button type="submit" class="danger" disabled>Finish run</button>');
    expect(html).toContain("No packages entered yet.");
  });

  it("a finished run opens read-only: no line, no Finish run, a pointer at the export home", () => {
    const done = { ...run, status: "complete", completed_at: "2026-09-17T13:00:00.000Z" };
    const html = cryoStationPage({ runs: [], picked: { run: done, pool, outputs, categories }, nowIso: "2026-09-17T13:00:00.000Z", ok: "finished" });
    expect(html).toContain("data-cryo-run-finished");
    expect(html).toContain('<a href="/admin/uploads">The New Packages file pends at the export home.</a>');
    expect(html).not.toContain('action="/station/cryo_weight/run/run-1/add"');
    expect(html).not.toContain('action="/station/cryo_weight/run/run-1/finish"');
    expect(html).toContain("Run finished. The trim containers are archival; the New Packages file pends at the export home.");
  });

  it("speaks Spanish", () => {
    const html = cryoStationPage({ runs: [run], picked: { run, pool, outputs: [], categories }, nowIso: "2026-09-17T12:00:00.000Z", locale: "es" });
    expect(html).toContain("Corridas de pasteurizacion");
    expect(html).toContain("26011 - sin codigo - 3 contenedores");
    expect(html).toContain("22,679 g - 50.62 lb - Fruity Pebbles");
    expect(html).toContain("<th>Categoria</th><th>Entrada (g)</th><th>Salida (g)</th><th>Restante (g)</th>");
    // THE DUPLICATE TAG warns "in the language selected at the pill".
    expect(html).toContain("data-dup-tag-warning>Esa etiqueta ya esta ingresada abajo. Escanee otro paquete.</p>");
    expect(html).toContain("Este peso sobregira el pool de su categoria. Registrarlo de todos modos?");
    expect(html).toContain("elija su categoria de producto");
    expect(html).toContain("Terminar corrida");
    expect(html).toContain("Ingrese al menos un paquete antes de terminar.");
  });

  it("the refusals are in words", () => {
    expect(CRYO_REFUSAL.tagShape).toBe("The package tag must be 1A plus 22 hex characters.");
    expect(CRYO_REFUSAL.category).toBe("Pick the product category.");
    expect(CRYO_REFUSAL.categoryOutsideList).toBe("That product category is not on the cryo list.");
    expect(CRYO_REFUSAL.noOutputs).toBe("Enter at least one package before finishing.");
    expect(CRYO_REFUSAL.unscheduleWithOutputs).toBe("A run with outputs cannot be unscheduled; finish it.");
    expect(CRYO_REFUSAL.demoteFinished).toBe("A finished run cannot be demoted; its outputs stand.");
  });
});

describe("THE CRYO RUN: the Pasteurization panes collapse to the HBN", () => {
  const item = (status: "scheduled" | "complete") => ({
    id: "run-1",
    itemId: "run-1",
    harvest_batch_id: "hb1",
    hbn: run.hbn,
    farm_code: "PNN",
    strain_name: "Fruity Pebbles",
    entry_date: "2026-09-17",
    identity: cryoRunIdentity({ containers: 3, in_grams: 22679, outputs: 1, out_grams: 22000 }),
    containers: 3,
    in_grams: 22679,
    out_count: 1,
    out_grams: 22000,
    package_codes: [{ code: "56802", unmatched: false }],
    status,
    scheduled_at: run.scheduled_at,
    completed_at: status === "complete" ? "2026-09-17T13:00:00.000Z" : null,
    workDone: "cryo weighed" as const,
  });
  const group = (status: "scheduled" | "complete") => ({ harvest_batch_id: "hb1", hbn: run.hbn, farm_code: "PNN", strain_name: "Fruity Pebbles", entry_date: "2026-09-17", items: [item(status)] });
  const avail = {
    harvest_batch_id: "hb2",
    hbn: "26261-ARL-GH-031-0-NA-26012",
    farm_code: "ARL",
    strain_name: "Rainbow Candies",
    entry_date: "2026-09-16",
    items: [{ id: "hb2", itemId: "hb2", harvest_batch_id: "hb2", hbn: "26261-ARL-GH-031-0-NA-26012", farm_code: "ARL", strain_name: "Rainbow Candies", entry_date: "2026-09-16", identity: cryoRunIdentity({ containers: 2, in_grams: 9000 }), containers: 2, in_grams: 9000, package_codes: [{ code: "56802", unmatched: false }] }],
  };

  it("Available reads the HBN and its pool on one line with the >>, nothing to unfold and no container", () => {
    const html = schedulingPage("cryo", { available: [avail], working: [], complete: [] }, "en", "2026-09-17T12:00:00.000Z");
    expect(html).toContain('<div class="pane-group schedule-run" data-schedule-hbn="hb2">');
    expect(html).toContain('title="26261-ARL-GH-031-0-NA-26012"');
    expect(html).toContain("26012 - 56802 - 2 containers");
    expect(html).toContain("9,000 g - 20.09 lb - Rainbow Candies");
    expect(html).toContain('name="hbn_id" value="hb2"');
    expect(html).not.toContain("schedule-item-readonly");
    expect(html).not.toContain('<details class="pane-group" data-schedule-hbn="hb2">');
  });

  it("Scheduled reads the run's pool with Pasteurizing and the arrows; Complete carries Unfinish", () => {
    const html = schedulingPage("cryo", { available: [], working: [group("scheduled")], complete: [group("complete")] }, "en", "2026-09-17T12:00:00.000Z");
    expect(html).toContain("26011 - 56802 - 3 containers");
    expect(html).toContain("22,679 g - 50.62 lb - Fruity Pebbles");
    expect(html).toContain("1 out, 22,000 g");
    expect(html).toContain('<span class="muted schedule-status">Pasteurizing</span>');
    expect(html).toContain('action="/production/scheduling/cryo/unschedule/run-1"');
    expect(html).toContain('action="/production/scheduling/cryo/complete/run-1"');
    expect(html).toContain('action="/production/scheduling/cryo/unfinish/run-1"');
    expect(html).toContain('name="unfinish_pin"');
    expect(html).not.toContain("/demote/");
    const trim = schedulingPage("trim", { available: [], working: [], complete: [group("complete")] }, "en", "2026-09-17T12:00:00.000Z");
    expect(trim).toContain('action="/production/scheduling/trim/unfinish/run-1"');
  });
});

describe("THE CRYO RUN: the New Packages file in the owner's T3 template", () => {
  it("the three header rows are the template's, byte for byte, 26 columns", () => {
    expect(NEW_PACKAGES_ROW1).toHaveLength(26);
    expect(NEW_PACKAGES_ROW2).toHaveLength(26);
    expect(NEW_PACKAGES_ROW3).toHaveLength(26);
    expect(NEW_PACKAGES_ROW1[0]).toBe("line in repeaterLines");
    expect(NEW_PACKAGES_ROW1[20]).toBe("line in repeaterLines");
    expect(NEW_PACKAGES_ROW1[21]).toBe("ingredient in line.Ingredients");
    expect(NEW_PACKAGES_ROW2.slice(0, 8)).toEqual([
      "line.TagId", "line.LocationId", "line.ItemId", "line.UseSameItem", "line.Quantity", "line.UnitOfMeasureId", "line.Note", "line.ActualDate",
    ]);
    expect(NEW_PACKAGES_ROW2.slice(21)).toEqual(["ingredient.PackageId", "ingredient.Quantity", "ingredient.UnitOfMeasureId", "ingredient.FinishPackage", "ingredient.FinishDate"]);
    expect(NEW_PACKAGES_ROW3[0]).toBe("Tag Number");
    expect(NEW_PACKAGES_ROW3[1]).toBe("Location Name");
    expect(NEW_PACKAGES_ROW3[3]).toBe("Same Item");
    expect(NEW_PACKAGES_ROW3[21]).toBe("Package Number");
    expect(NEW_PACKAGES_ROW3[22]).toBe("Ingredient Quantity");
    expect(NEW_PACKAGES_SHEET_NAME).toBe("new_packages_autofill_template.");
  });

  it("one row per output, as his example row: the tag, Cryo Room, Same Item yes, grams, the date, the ingredient", () => {
    const rows = newPackagesRows([
      { tag: "1A40503000311FB000038864", quantity: 22679, actualDate: "2026-09-17", ingredients: [{ packageLabel: "1A40503000311FB000056808", quantity: 22679 }] },
    ]);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toHaveLength(26);
    expect(row[0]).toEqual({ text: "1A40503000311FB000038864" });
    expect(row[1]).toEqual({ text: "Cryo Room" });
    expect(row[2]).toEqual({});
    expect(row[3]).toEqual({ text: "yes" });
    expect(row[4]).toEqual({ number: 22679 });
    expect(row[5]).toEqual({ text: "Grams" });
    expect(row[7]).toEqual({ text: "2026-09-17" });
    expect(row[21]).toEqual({ text: "1A40503000311FB000056808" });
    expect(row[22]).toEqual({ number: 22679 });
    expect(row[23]).toEqual({ text: "Grams" });
    expect(row[24]).toEqual({});
    expect(row[25]).toEqual({});
  });

  it("a second ingredient rides a row of its own with the line columns blank", () => {
    const rows = newPackagesRows([
      {
        tag: "1A40503000311FB000038864",
        quantity: 800,
        actualDate: "2026-09-17",
        ingredients: [
          { packageLabel: "1A4050300000000000000A01", quantity: 500 },
          { packageLabel: "1A4050300000000000000A02", quantity: 300 },
        ],
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toEqual({ text: "1A40503000311FB000038864" });
    expect(rows[0][21]).toEqual({ text: "1A4050300000000000000A01" });
    expect(rows[0][22]).toEqual({ number: 500 });
    expect(rows[1][0]).toEqual({});
    expect(rows[1][4]).toEqual({});
    expect(rows[1][21]).toEqual({ text: "1A4050300000000000000A02" });
    expect(rows[1][22]).toEqual({ number: 300 });
  });

  it("outputs draw from the HBN's harvest packages in lot order; an over issue folds into the last one", () => {
    const one = allocateIngredients([{ id: "a", grams: 60 }, { id: "b", grams: 30 }], [{ label: "P1", capacity: 100 }]);
    expect(one.get("a")).toEqual([{ packageLabel: "P1", quantity: 60 }]);
    expect(one.get("b")).toEqual([{ packageLabel: "P1", quantity: 30 }]);
    const two = allocateIngredients([{ id: "a", grams: 80 }, { id: "b", grams: 20 }], [{ label: "P1", capacity: 50 }, { label: "P2", capacity: 50 }]);
    expect(two.get("a")).toEqual([{ packageLabel: "P1", quantity: 50 }, { packageLabel: "P2", quantity: 30 }]);
    expect(two.get("b")).toEqual([{ packageLabel: "P2", quantity: 20 }]);
    const over = allocateIngredients([{ id: "a", grams: 120 }], [{ label: "P1", capacity: 100 }]);
    expect(over.get("a")).toEqual([{ packageLabel: "P1", quantity: 120 }]);
    const none = allocateIngredients([{ id: "a", grams: 10 }], []);
    expect(none.get("a")).toEqual([{ packageLabel: "", quantity: 10 }]);
  });

  it("builds a real .xlsx named for the template with plain numbers and the three header rows", () => {
    const sheet = newPackagesSheet([
      { tag: "1A40503000311FB000038864", quantity: 22679, actualDate: "2026-09-17", ingredients: [{ packageLabel: "1A40503000311FB000056808", quantity: 22679 }] },
    ]);
    expect(sheet.sheetName).toBe(NEW_PACKAGES_SHEET_NAME);
    expect(sheet.plainNumbers).toBe(true);
    expect(sheet.headers).toEqual([...NEW_PACKAGES_ROW1]);
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.rows[0][0]).toEqual({ text: "line.TagId" });
    expect(sheet.rows[1][0]).toEqual({ text: "Tag Number" });
    const bytes = buildXlsx(sheet);
    expect(xlsxHasParts(bytes)).toBe(true);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('<sheet name="new_packages_autofill_template." sheetId="1"');
    expect(text).toContain("<v>22679</v>");
    expect(text).not.toContain("<v>22679.00</v>");
    expect(text).toContain("<t>Cryo Room</t>");
    // A blank template cell is no cell at all, not an empty string.
    expect(text).not.toContain("<t></t>");
    expect(newPackagesFilename("26260-PNN-GH-027-0-NA-26011")).toBe("new_packages_26260-PNN-GH-027-0-NA-26011.xlsx");
  });
});

describe("THE PACKAGE CARRIES ITS HBN (canon 0.30.196)", () => {
  const T0 = "2026-09-22T12:00:00.000Z";

  it("a cryo output carries its run's HBN", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-1", hbn: "26244-ARL-GH-027-0-NA-26011", serial: 11 });
    seedLot(m, "lot-1", "hb-1");
    m.run(
      `INSERT INTO wip_packages (id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at)
       VALUES ('c1', 'lot-1', 'hb-1', 'SMALLS-1', 'SMALLS', 55, 'cryo_queue', 'trim', ?, ?)`,
      T0,
      T0
    );
    m.run(
      `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, created_at, updated_at)
       VALUES ('run-1', 'cryo', 'hb-1', 'scheduled', ?, ?, ?)`,
      T0,
      T0,
      T0
    );
    m.run(`INSERT INTO cryo_run_inputs (id, run_id, wip_package_id, package_type_code, weight_grams, created_at) VALUES ('in-1', 'run-1', 'c1', 'SMALLS', 55, ?)`, T0);
    await addCryoOutput(m.db, "run-1", formOf({ package_code: "1A4050300000000000000C01", package_type_code: "WPR", weight_grams: "20", cryo_operator: "Austin", person_id: person }));
    expect(m.get(`SELECT harvest_batch_id, wet_weight_entry_id, source, status FROM wip_packages WHERE package_code = '1A4050300000000000000C01'`)).toEqual({
      harvest_batch_id: "hb-1",
      wet_weight_entry_id: "lot-1",
      source: "cryo",
      status: "testing_queue",
    });
  });

  it("0073 fills every package's HBN from its lot, frees the lot, and marks the old batches app-born", async () => {
    const m = await migratedDb({ until: "0073" });
    m.run(
      `INSERT INTO harvest_batches (id, entry_date, farm_code, grow_method_code, strain_id, manicure, hbn, lot_serial, harvest_year, status, created_at, updated_at)
       VALUES ('hb-old', '2026-09-08', 'ARL', 'GH', '98cf3164-344e-414a-9f1c-1526fde445ac', 0, '26251-ARL-GH-001-0-NA-26011', 11, 2026, 'open', ?, ?)`,
      T0,
      T0
    );
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, created_at, updated_at) VALUES ('lot-old', 'hb-old', 900, 'dry-1', 'trimmed', ?, ?)`,
      T0,
      T0
    );
    m.run(
      `INSERT INTO wip_packages (id, wet_weight_entry_id, package_code, package_type_code, weight_grams, status, trim_date, source, created_at, updated_at)
       VALUES ('pkg-old', 'lot-old', 'BUD-1', 'BUD', 120, 'created', '2026-09-20', 'trim', ?, ?)`,
      T0,
      T0
    );
    await m.applyRest();
    expect(m.get(`SELECT harvest_batch_id, wet_weight_entry_id, trim_date, source, weight_grams FROM wip_packages WHERE id = 'pkg-old'`)).toEqual({
      harvest_batch_id: "hb-old",
      wet_weight_entry_id: "lot-old",
      trim_date: "2026-09-20",
      source: "trim",
      weight_grams: 120,
    });
    expect(m.get(`SELECT born_from FROM harvest_batches WHERE id = 'hb-old'`)).toEqual({ born_from: "app" });
    m.run(
      `INSERT INTO wip_packages (id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, status, created_at, updated_at)
       VALUES ('pkg-free', NULL, 'hb-old', 'WPR-1', 'WPR', 10, 'released', ?, ?)`,
      T0,
      T0
    );
    const indexes = m.all(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'wip_packages' ORDER BY name`).map((row) => row.name);
    expect(indexes).toEqual(["sqlite_autoindex_wip_packages_1", "wip_packages_created_at", "wip_packages_harvest_batch", "wip_packages_status"]);
  });
});

describe("PS1: pasteurization runs read by lot, and Add Shake", () => {
  const PIN = "21319";
  const WHEN = "2026-10-17T12:00:00.000Z";
  const LATER = "2026-10-17T13:00:00.000Z";
  const BUD_TAG = "1A4050300000000000000C11";
  const SHAKE_TAG = "1A4050300000000000000C21";
  const SHAKE_TAG_2 = "1A4050300000000000000C22";
  const HARVEST_TAG = "1A4050300000000000000A91";

  function must(found: Record<string, unknown> | undefined, label: string): Record<string, unknown> {
    if (!found) throw new Error(label);
    return found;
  }

  it("pasteurizationRunLabel: trim codes, one container, pounds at 448, no strain, no dash characters", () => {
    const lot = { hbn: "26260-PNN-GH-027-0-NA-26011", containers: 36, in_grams: 180085, strain_name: "Gelato 41" };
    const one = pasteurizationRunLabel(lot, [{ code: "56802", unmatched: false }]);
    expect(one.line1).toBe("26011 - 56802 - 36 containers");
    expect(one.line2).toBe("180,085 g - 401.98 lb - Gelato 41");
    const two = pasteurizationRunLabel(lot, [
      { code: "56834", unmatched: false },
      { code: "56802", unmatched: false },
      { code: "56802", unmatched: false },
    ]);
    expect(two.line1).toBe("26011 - 56802, 56834 - 36 containers");
    const marked = pasteurizationRunLabel(
      { hbn: "26260-PNN-GH-027-0-NA-26055", containers: 38, in_grams: 180085, strain_name: "Gelato 41" },
      [
        { code: "56834", unmatched: false },
        { code: "56833", unmatched: true },
      ]
    );
    expect(marked.line1).toBe('26055 - <span title="Not a METRC package from this harvest">56833?</span>, 56834 - 38 containers');
    const plain = pasteurizationRunLabel(lot, [{ code: "56802", unmatched: false }]);
    expect(plain.line1).toBe("26011 - 56802 - 36 containers");
    expect(plain.line1).not.toContain("?");
    const legacy = pasteurizationRunLabel(lot, [{ code: "1A4050300000000000004F2A1", unmatched: false }]);
    expect(legacy.line1).toBe("26011 - no code - 36 containers");
    const none = pasteurizationRunLabel({ hbn: "26260-PNN-GH-027-0-NA-26072", containers: 1, in_grams: 448, strain_name: "  " }, []);
    expect(none.line1).toBe("26072 - no code - 1 container");
    expect(none.line2).toBe("448 g - 1.00 lb - no strain");
    const es = pasteurizationRunLabel({ hbn: "26260-PNN-GH-027-0-NA-26072", containers: 1, in_grams: 448, strain_name: null }, [], "es");
    expect(es.line1).toBe("26072 - sin codigo - 1 contenedor");
    expect(es.line2).toBe("448 g - 1.00 lb - sin variedad");
    const esMarked = pasteurizationRunLabel(
      { hbn: "26260-PNN-GH-027-0-NA-26055", containers: 1, in_grams: 448, strain_name: "Gelato 41" },
      [{ code: "56833", unmatched: true }],
      "es"
    );
    expect(esMarked.line1).toContain('title="No es un paquete METRC de esta cosecha"');
    expect(esMarked.line1).toContain("56833?");
    const text = `${one.line1} ${one.line2} ${two.line1} ${marked.line1} ${none.line1} ${none.line2} ${es.line1} ${esMarked.line1}`;
    expect(text).not.toMatch(/\u2013|\u2014/);
    expect(one.line1).toContain(" - ");
  });

  it("the left pane orders working runs by lot serial and parks finished runs under Finished", () => {
    const base = { ...run, containers: 1, in_grams: 448, strain_name: "Gelato 41", package_codes: [] as { code: string; unmatched: boolean }[] };
    const low = { ...base, id: "low", hbn: "26244-ARL-GH-027-0-NA-26005", lot_serial: 5, scheduled_at: LATER };
    const later = { ...base, id: "later", hbn: low.hbn, lot_serial: 5, scheduled_at: "2026-10-17T14:00:00.000Z" };
    const high = { ...base, id: "high", hbn: "26244-ARL-GH-027-0-NA-26020", lot_serial: 20, scheduled_at: WHEN };
    const done = { ...base, id: "done", status: "complete", completed_at: LATER, lot_serial: 1, hbn: "26244-ARL-GH-027-0-NA-26001" };
    const doneOld = { ...base, id: "done-old", status: "complete", completed_at: WHEN, lot_serial: 99, hbn: "26244-ARL-GH-027-0-NA-26099" };
    const html = cryoStationPage({ runs: [high, doneOld, low, done, later], nowIso: LATER });
    const working = html.slice(html.indexOf("data-cryo-runs"), html.indexOf("data-cryo-finished"));
    expect(working.indexOf('data-cryo-run="low"')).toBeGreaterThan(-1);
    expect(working.indexOf('data-cryo-run="low"')).toBeLessThan(working.indexOf('data-cryo-run="later"'));
    expect(working.indexOf('data-cryo-run="later"')).toBeLessThan(working.indexOf('data-cryo-run="high"'));
    expect(working).not.toContain('data-cryo-run="done"');
    expect(working).not.toContain('data-cryo-run="done-old"');
    expect(html).toContain('Pasteurization runs <span class="tile-count">3</span>');
    const finished = html.slice(html.indexOf("data-cryo-finished"));
    expect(finished).toContain('Finished <span class="tile-count">2</span>');
    expect(finished.indexOf('data-cryo-run="done"')).toBeLessThan(finished.indexOf('data-cryo-run="done-old"'));
    expect(finished).toContain("26001 - no code - 1 container");
    const picked = cryoStationPage({
      runs: [done],
      picked: {
        run: done,
        pool,
        outputs,
        categories,
        inputs: [
          {
            id: "in-1",
            wip_package_id: "c1",
            package_type_code: "BUD",
            weight_grams: 448,
            wet_weight_entry_id: "lot-1",
            package_code: "56802",
            status: "pasteurized",
          },
        ],
      },
      nowIso: LATER,
      shakeOpen: true,
    });
    expect(picked).toContain('<h2 class="working-pick">26001 - no code - 1 container</h2>');
    expect(picked.indexOf("data-cryo-pool")).toBeLessThan(picked.indexOf("data-cryo-add-shake"));
    expect(picked.indexOf("data-cryo-add-shake")).toBeLessThan(picked.indexOf("data-cryo-consumed"));
    expect(picked.indexOf("data-cryo-consumed")).toBeLessThan(picked.indexOf("Entered packages"));
    expect(picked).toContain('data-cryo-add-shake open');
    expect(picked).toContain('action="/station/cryo_weight/run/done/add-shake"');
    expect(picked).toContain('data-pool-category="SHA"');
    expect(picked).toContain("This weight over issues the pool for its category. Record it anyway?");
    expect(picked).not.toContain('action="/station/cryo_weight/run/done/add"');
    expect(picked).not.toContain("reopened");
  });

  async function finishedFloor(m: Awaited<ReturnType<typeof migratedDb>>, batch = { id: "hb-1", hbn: "26244-ARL-GH-027-0-NA-26072", serial: 72 }) {
    const person = seedPerson(m);
    seedBatch(m, batch);
    m.run(`UPDATE harvest_batches SET market_strain = 'Gelato 41' WHERE id = ?`, batch.id);
    seedLot(m, "lot-1", batch.id);
    m.run(
      `INSERT INTO wip_packages (id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at)
       VALUES ('c1', 'lot-1', ?, 'BUD-1', 'BUD', 100, 'cryo_queue', 'trim', ?, ?)`,
      batch.id,
      WHEN,
      WHEN
    );
    m.run(
      `INSERT INTO local_inventory_items (id, item_kind, package_code, metrc_tag, harvest_batch_id, wet_weight_entry_id, qty, uom, farm_code, license_value, location, created_at, updated_at)
       VALUES ('hp-1', 'WIP', 'HARVEST-1', ?, ?, 'lot-1', 100, 'g', 'ARL', 'AU-G-C-000832', 'Cryo Room', ?, ?)`,
      HARVEST_TAG,
      batch.id,
      WHEN,
      WHEN
    );
    m.run(
      `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, created_at, updated_at)
       VALUES ('run-1', 'cryo', ?, 'scheduled', ?, ?, ?)`,
      batch.id,
      WHEN,
      WHEN,
      WHEN
    );
    m.run(
      `INSERT INTO cryo_run_inputs (id, run_id, wip_package_id, package_type_code, weight_grams, created_at) VALUES ('in-1', 'run-1', 'c1', 'BUD', 100, ?)`,
      WHEN
    );
    await addCryoOutput(m.db, "run-1", formOf({ package_code: BUD_TAG, package_type_code: "BUD", weight_grams: "40", cryo_operator: "Austin", person_id: person }));
    await finishCryoRun(m.db, "run-1", formOf({ person_id: person }));
    m.run(
      `INSERT INTO metrc_uploads (id, kind, harvest_batch_id, filename, uploaded_at, ref_id, created_at, updated_at)
       VALUES ('up-run', 'new_packages', ?, 'new_packages_run.xlsx', ?, 'run-1', ?, ?)`,
      batch.id,
      WHEN,
      WHEN,
      WHEN
    );
    return person;
  }

  it("Add Shake writes one SHA output, leaves the run finished, and pends its own file", async () => {
    const m = await migratedDb();
    const person = await finishedFloor(m);
    const before = m.get(`SELECT status, completed_at FROM production_schedules WHERE id = 'run-1'`);
    const first = await addShakeOutput(m.db, "run-1", formOf({ package_code: SHAKE_TAG, weight_grams: "30", cryo_operator: "Austin", person_id: person }));
    expect(first.redirect).toContain("ok=shake");
    // PS1 gate fix: the flag reads the run's total remaining (100 in, 40 out, 60 left), so 30 g of shake is not an over issue.
    expect(first.redirect).not.toContain("over=1");
    const shake = must(m.get(`SELECT id, package_type_code, cryo_run_id, status, weight_grams FROM wip_packages WHERE package_code = ? AND deleted_at IS NULL`, SHAKE_TAG) as Record<string, unknown> | undefined, "shake");
    expect(shake).toMatchObject({ package_type_code: "SHA", cryo_run_id: "run-1", status: "testing_queue", weight_grams: 30 });
    expect(m.get(`SELECT status, completed_at FROM production_schedules WHERE id = 'run-1'`)).toEqual(before);
    expect(m.get(`SELECT reason FROM record_change_log WHERE record_table = 'wip_packages' AND record_id = ? AND field = 'status'`, String(shake.id))).toEqual({
      reason: "cryo output entered",
    });
    const pending = await listPendingNewPackagesUploads(m.db);
    expect(pending.filter((row) => row.kind === "new_packages")).toEqual([]);
    expect(pending.filter((row) => row.kind === "new_packages_shake").map((row) => row.id)).toEqual([String(shake.id)]);
    expect(pending[0].filename).toBe(shakePackagesFilename("26244-ARL-GH-027-0-NA-26072", SHAKE_TAG));
    expect(m.get(`SELECT COUNT(*) AS n FROM metrc_uploads WHERE kind = 'new_packages' AND ref_id = 'run-1' AND deleted_at IS NULL`)).toEqual({ n: 1 });
    const runFile = await buildNewPackagesXlsx(m.db, "run-1");
    expect(new TextDecoder().decode(runFile.bytes)).not.toContain(SHAKE_TAG);
    await addShakeOutput(m.db, "run-1", formOf({ package_code: SHAKE_TAG_2, weight_grams: "10", cryo_operator: "Austin", person_id: person }));
    const again = await listPendingNewPackagesUploads(m.db);
    expect(again.filter((row) => row.kind === "new_packages_shake")).toHaveLength(2);
    // 60 left less 30 and 10 leaves 20; 21 g more flags (flag, never block).
    const over = await addShakeOutput(m.db, "run-1", formOf({ package_code: "1A4050300000000000000C23", weight_grams: "21", cryo_operator: "Austin", person_id: person }));
    expect(over.redirect).toContain("over=1");
    expect(m.get(`SELECT COUNT(*) AS n FROM metrc_uploads WHERE kind = 'new_packages' AND ref_id = 'run-1' AND deleted_at IS NULL`)).toEqual({ n: 1 });
  });

  it("Add Shake refuses a bad tag, a used tag, a weight, a missing operator, and a working run", async () => {
    const m = await migratedDb();
    const person = await finishedFloor(m);
    const shake = (fields: Record<string, string>) => addShakeOutput(m.db, "run-1", formOf({ person_id: person, cryo_operator: "Austin", weight_grams: "5", package_code: SHAKE_TAG, ...fields }));
    await expect(shake({ package_code: "tote 9" })).rejects.toThrow(CRYO_REFUSAL.tagShape);
    await expect(shake({ package_code: BUD_TAG })).rejects.toThrow(CRYO_REFUSAL.tagTaken);
    await expect(shake({ weight_grams: "0" })).rejects.toThrow(CRYO_REFUSAL.weight);
    await expect(shake({ cryo_operator: "" })).rejects.toThrow(CRYO_REFUSAL.operator);
    const open = await migratedDb();
    const hand = seedPerson(open);
    seedBatch(open, { id: "hb-1", hbn: "26244-ARL-GH-027-0-NA-26072", serial: 72 });
    seedLot(open, "lot-1", "hb-1");
    open.run(
      `INSERT INTO wip_packages (id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at)
       VALUES ('c1', 'lot-1', 'hb-1', 'BUD-1', 'BUD', 100, 'cryo_queue', 'trim', ?, ?)`,
      WHEN,
      WHEN
    );
    open.run(
      `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, created_at, updated_at)
       VALUES ('run-1', 'cryo', 'hb-1', 'scheduled', ?, ?, ?)`,
      WHEN,
      WHEN,
      WHEN
    );
    open.run(`INSERT INTO cryo_run_inputs (id, run_id, wip_package_id, package_type_code, weight_grams, created_at) VALUES ('in-1', 'run-1', 'c1', 'BUD', 100, ?)`, WHEN);
    await expect(addShakeOutput(open.db, "run-1", formOf({ package_code: SHAKE_TAG, weight_grams: "5", cryo_operator: "Austin", person_id: hand }))).rejects.toThrow(
      CRYO_REFUSAL.shakeWhileWorking
    );
    expect(open.get(`SELECT status FROM production_schedules WHERE id = 'run-1'`)).toEqual({ status: "scheduled" });
    for (const message of [CRYO_REFUSAL.tagShape, CRYO_REFUSAL.tagTaken, CRYO_REFUSAL.weight, CRYO_REFUSAL.operator, CRYO_REFUSAL.shakeWhileWorking]) {
      expect(refusalText("en", { message })).toBe(message);
      expect(refusalText("es", { message })).not.toBe(message);
    }
    expect(refusalText("es", { message: CRYO_REFUSAL.shakeWhileWorking })).toBe(
      "Agregar picadillo es para una corrida terminada; use la linea de mas mientras esta trabajando."
    );
  });

  it("removing a pending shake file drops it; an uploaded shake file refuses", async () => {
    const m = await migratedDb();
    const person = await finishedFloor(m);
    await addShakeOutput(m.db, "run-1", formOf({ package_code: SHAKE_TAG, weight_grams: "30", cryo_operator: "Austin", person_id: person }));
    const shake = must(m.get(`SELECT id FROM wip_packages WHERE package_code = ? AND deleted_at IS NULL`, SHAKE_TAG) as Record<string, unknown> | undefined, "shake");
    await unfinishCryoOutput(m.db, String(shake.id), formOf({ person_id: person, unfinish_pin: PIN }));
    const pending = await listPendingNewPackagesUploads(m.db);
    expect(pending.some((row) => row.id === String(shake.id))).toBe(false);
    expect(must(m.get(`SELECT deleted_at FROM wip_packages WHERE id = ?`, String(shake.id)) as Record<string, unknown> | undefined, "voided").deleted_at).toBeTruthy();
    await addShakeOutput(m.db, "run-1", formOf({ package_code: SHAKE_TAG_2, weight_grams: "10", cryo_operator: "Austin", person_id: person }));
    const second = must(m.get(`SELECT id FROM wip_packages WHERE package_code = ? AND deleted_at IS NULL`, SHAKE_TAG_2) as Record<string, unknown> | undefined, "second");
    await markUploaded(m.db, METRC_UPLOAD_KINDS.new_packages_shake, "hb-1", formOf({ person_id: person }), String(second.id));
    expect((await listPendingNewPackagesUploads(m.db)).some((row) => row.id === String(second.id))).toBe(false);
    const kept = must(m.get(`SELECT id, filename FROM metrc_uploads WHERE kind = 'new_packages_shake' AND ref_id = ? AND deleted_at IS NULL`, String(second.id)) as Record<string, unknown> | undefined, "mark");
    expect(String(kept.filename)).toContain("_shake_");
    await expect(unfinishCryoOutput(m.db, String(second.id), formOf({ person_id: person, unfinish_pin: PIN }))).rejects.toThrow(/marked uploaded/);
    expect(m.get(`SELECT deleted_at FROM wip_packages WHERE id = ?`, String(second.id))).toEqual({ deleted_at: null });
  });

  it("PS1 gate fix: unfinishing a run refuses while one of its shake files is marked uploaded", async () => {
    const m = await migratedDb();
    const person = await finishedFloor(m);
    // The run's own file not yet uploaded, so only the shake file can stop the unfinish.
    m.run(`DELETE FROM metrc_uploads WHERE id = 'up-run'`);
    await addShakeOutput(m.db, "run-1", formOf({ package_code: SHAKE_TAG, weight_grams: "30", cryo_operator: "Austin", person_id: person }));
    const shake = must(m.get(`SELECT id FROM wip_packages WHERE package_code = ? AND deleted_at IS NULL`, SHAKE_TAG) as Record<string, unknown> | undefined, "shake");
    await markUploaded(m.db, METRC_UPLOAD_KINDS.new_packages_shake, "hb-1", formOf({ person_id: person }), String(shake.id));
    await expect(unfinishScheduleItem(m.db, SCHEDULE_STAGES.cryo, "run-1", formOf({ person_id: person, unfinish_pin: PIN }))).rejects.toThrow(/shake file .* is marked uploaded/);
    expect(m.get(`SELECT status FROM production_schedules WHERE id = 'run-1'`)).toEqual({ status: "complete" });
    expect(m.get(`SELECT deleted_at FROM wip_packages WHERE id = ?`, String(shake.id))).toEqual({ deleted_at: null });
  });

  it("the shake file is one T3 line with the tag, the grams, and the harvest ingredients", async () => {
    const m = await migratedDb();
    const person = await finishedFloor(m);
    await addShakeOutput(m.db, "run-1", formOf({ package_code: SHAKE_TAG, weight_grams: "30", cryo_operator: "Austin", person_id: person }));
    const shake = must(m.get(`SELECT id FROM wip_packages WHERE package_code = ?`, SHAKE_TAG) as Record<string, unknown> | undefined, "shake");
    const built = await buildShakeNewPackagesXlsx(m.db, String(shake.id));
    expect(built.filename).toBe(`new_packages_26244-ARL-GH-027-0-NA-26072_shake_${SHAKE_TAG.slice(-5)}.xlsx`);
    const text = new TextDecoder().decode(built.bytes);
    expect(text).toContain("new_packages_autofill_template.");
    expect(text).toContain(`<t>${SHAKE_TAG}</t>`);
    expect(text).toContain("<t>Cryo Room</t>");
    expect(text).toContain("<t>yes</t>");
    expect(text).toContain("<v>30</v>");
    expect(text).toContain(`<t>${HARVEST_TAG}</t>`);
    expect(text.split(`<t>${SHAKE_TAG}</t>`)).toHaveLength(2);
  });

  it("scheduling columns render the label, sort by lot serial, and keep their controls", async () => {
    const m = await migratedDb();
    const plant = async (id: string, hbn: string, serial: number, grams: number, scheduled: string, status: "scheduled" | "complete") => {
      const tag = `1A405030000000000${String(serial).padStart(2, "0")}4F2A1`;
      seedBatch(m, { id, hbn, serial });
      m.run(`UPDATE harvest_batches SET market_strain = 'Gelato 41' WHERE id = ?`, id);
      seedLot(m, `lot-${id}`, id);
      m.run(
        `INSERT INTO wip_packages (id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'BUD', ?, ?, 'trim', ?, ?)`,
        `pkg-${id}`,
        `lot-${id}`,
        id,
        String(50000 + serial),
        grams,
        status === "complete" ? "pasteurized" : "cryo_queue",
        WHEN,
        WHEN
      );
      if (status === "scheduled" || status === "complete") {
        m.run(
          `INSERT INTO local_inventory_items (id, item_kind, package_code, metrc_tag, harvest_batch_id, wet_weight_entry_id, qty, uom, farm_code, license_value, location, created_at, updated_at)
           VALUES (?, 'WIP', ?, ?, ?, ?, 100, 'g', 'ARL', 'AU-G-C-000832', 'Cryo Room', ?, ?)`,
          `hp-${id}`,
          `H-${id}`,
          tag,
          id,
          `lot-${id}`,
          WHEN,
          WHEN
        );
      }
      if (status === "complete" || scheduled) {
        m.run(
          `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, completed_at, created_at, updated_at)
           VALUES (?, 'cryo', ?, ?, ?, ?, ?, ?)`,
          `run-${id}`,
          id,
          status,
          scheduled,
          status === "complete" ? LATER : null,
          WHEN,
          WHEN
        );
        m.run(
          `INSERT INTO cryo_run_inputs (id, run_id, wip_package_id, package_type_code, weight_grams, created_at) VALUES (?, ?, ?, 'BUD', ?, ?)`,
          `in-${id}`,
          `run-${id}`,
          `pkg-${id}`,
          grams,
          WHEN
        );
      }
    };
    await plant("hb-high", "26244-ARL-GH-027-0-NA-26020", 20, 896, WHEN, "scheduled");
    await plant("hb-low", "26244-ARL-GH-027-0-NA-26005", 5, 448, LATER, "scheduled");
    await plant("hb-free-high", "26244-ARL-GH-027-0-NA-26040", 40, 448, "", "scheduled");
    await plant("hb-free-low", "26244-ARL-GH-027-0-NA-26003", 3, 448, "", "scheduled");
    await plant("hb-done", "26244-ARL-GH-027-0-NA-26011", 11, 448, WHEN, "complete");
    const available = await listScheduleAvailable(m.db, SCHEDULE_STAGES.cryo);
    const working = await listScheduleWorking(m.db, SCHEDULE_STAGES.cryo);
    const complete = await listScheduleComplete(m.db, SCHEDULE_STAGES.cryo);
    expect(available.map((group) => group.hbn)).toEqual(["26244-ARL-GH-027-0-NA-26003", "26244-ARL-GH-027-0-NA-26040"]);
    expect(working.map((group) => group.hbn)).toEqual(["26244-ARL-GH-027-0-NA-26005", "26244-ARL-GH-027-0-NA-26020"]);
    expect(complete.map((group) => group.hbn)).toEqual(["26244-ARL-GH-027-0-NA-26011"]);
    const html = schedulingPage(SCHEDULE_STAGES.cryo, { available, working, complete }, "en", LATER);
    expect(html.indexOf("26003 - 50003 - 1 container")).toBeLessThan(html.indexOf("26040 - 50040 - 1 container"));
    expect(html.indexOf("26005 - 50005 - 1 container")).toBeLessThan(html.indexOf("26020 - 50020 - 1 container"));
    expect(html).toContain("26011 - 50011 - 1 container");
    expect(html).not.toContain("4F2A1");
    expect(html).not.toContain("50003?");
    expect(html).toContain("448 g - 1.00 lb - Gelato 41");
    expect(html).toContain("896 g - 2.00 lb - Gelato 41");
    expect(html).toContain('title="26244-ARL-GH-027-0-NA-26005"');
    expect(html).toContain("0 out, 0 g");
    expect(html).toContain("data-terp-pick");
    expect(html).toContain('name="terp_dose_pct"');
    expect(html).toContain('action="/production/scheduling/cryo/unschedule/run-hb-low"');
    expect(html).toContain('action="/production/scheduling/cryo/complete/run-hb-low"');
    expect(html).toContain('name="unfinish_pin"');
    expect(html).toContain('name="effective_date"');
    expect(html).toContain('name="hbn_id" value="hb-free-low"');
  });

  it("the cryo station and the scheduling page read trim codes and check them against the mirror", async () => {
    const m = await migratedDb();
    const harvestTag = "1A4050300000000000009ZZZ1";
    const plant = (
      id: string,
      serial: number,
      opts: { codes: string[]; status?: "scheduled" | "complete" | "available"; scheduled?: string }
    ) => {
      const hbn = `26260-PNN-GH-027-0-NA-${serial}`;
      seedBatch(m, { id, hbn, serial });
      m.run(`UPDATE harvest_batches SET market_strain = 'Gelato 41' WHERE id = ?`, id);
      seedLot(m, `lot-${id}`, id);
      m.run(
        `INSERT INTO local_inventory_items (id, item_kind, package_code, metrc_tag, harvest_batch_id, wet_weight_entry_id, qty, uom, farm_code, license_value, location, created_at, updated_at)
         VALUES (?, 'WIP', ?, ?, ?, ?, 100, 'g', 'PNN', 'AU-G-C-000832', 'Cryo Room', ?, ?)`,
        `hp-${id}`,
        `H-${id}`,
        harvestTag,
        id,
        `lot-${id}`,
        WHEN,
        WHEN
      );
      opts.codes.forEach((code, index) => {
        const queued = opts.status === "available" || opts.status === undefined;
        m.run(
          `INSERT INTO wip_packages (id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'BUD', 448, ?, 'trim', ?, ?)`,
          `pkg-${id}-${index}`,
          `lot-${id}`,
          id,
          code,
          queued ? "cryo_queue" : opts.status === "complete" ? "pasteurized" : "cryo_queue",
          WHEN,
          WHEN
        );
      });
      if (opts.status === "scheduled" || opts.status === "complete") {
        m.run(
          `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, completed_at, created_at, updated_at)
           VALUES (?, 'cryo', ?, ?, ?, ?, ?, ?)`,
          `run-${id}`,
          id,
          opts.status,
          opts.scheduled ?? WHEN,
          opts.status === "complete" ? LATER : null,
          WHEN,
          WHEN
        );
        opts.codes.forEach((_, index) => {
          m.run(
            `INSERT INTO cryo_run_inputs (id, run_id, wip_package_id, package_type_code, weight_grams, created_at) VALUES (?, ?, ?, 'BUD', 448, ?)`,
            `in-${id}-${index}`,
            `run-${id}`,
            `pkg-${id}-${index}`,
            WHEN
          );
        });
      }
      return hbn;
    };
    const matchHbn = plant("hb-match", 26011, { codes: ["56802"], status: "scheduled" });
    const twoHbn = plant("hb-two", 26055, { codes: ["56834", "56833"], status: "complete" });
    plant("hb-plain", 26010, { codes: ["56010"], status: "scheduled", scheduled: LATER });
    plant("hb-none", 26072, { codes: ["BUD-1", "56801`"], status: "scheduled", scheduled: LATER });
    const availHbn = plant("hb-avail", 26099, { codes: ["56099"], status: "available" });
    const notWipHbn = plant("hb-bud", 26053, { codes: ["56101"], status: "available" });
    const sprHbn = plant("hb-spr", 26027, { codes: ["58008"], status: "available" });
    seedMirror(m, { tag: "1A40503000311FB000056802", harvest: matchHbn, item: "WIP - Bud" });
    seedMirror(m, { tag: "1A40503000311FB000056834", harvest: twoHbn, item: "WIP - Trim" });
    seedMirror(m, { tag: "1A40503000311FB000011111", harvest: twoHbn, item: "Flower" });
    seedMirror(m, { tag: "1A40503000311FB000056101", harvest: notWipHbn, item: "Bud" });
    seedMirror(m, { tag: "1A40503000311FB000058008", harvest: sprHbn, item: "SPR - Permanent Marker - ARL - G" });
    seedMirror(m, { tag: "1A40503000311FB000099999", harvest: "26260-PNN-GH-027-0-NA-99999", item: "WIP - Other" });

    const working = await listCryoRuns(m.db, "scheduled", "lot");
    const finished = await listCryoRuns(m.db, "complete", "finished");
    const picked = await getCryoRun(m.db, "run-hb-two");
    expect(picked).toBeTruthy();
    const inputs = await listCryoRunInputs(m.db, "run-hb-two");
    const station = cryoStationPage({
      runs: [...working, ...finished],
      picked: { run: picked!, pool, outputs, categories, inputs },
      nowIso: LATER,
    });
    expect(station).toContain("26011 - 56802 - 1 container");
    expect(station).toContain('26055 - <span title="Not a METRC package from this harvest">56833?</span>, 56834 - 2 containers');
    expect(station).toContain("26010 - 56010 - 1 container");
    expect(station).not.toContain("56010?");
    expect(station).toContain("26072 - no code - 2 containers");
    expect(station).not.toContain("56801");
    expect(station).not.toContain("9ZZZ1");
    expect(station).not.toContain(harvestTag);
    const poolAt = station.indexOf("data-cryo-pool");
    const shakeAt = station.indexOf("data-cryo-add-shake");
    const consumedAt = station.indexOf("data-cryo-consumed");
    expect(poolAt).toBeGreaterThan(-1);
    expect(poolAt).toBeLessThan(shakeAt);
    expect(shakeAt).toBeLessThan(consumedAt);

    const available = await listScheduleAvailable(m.db, SCHEDULE_STAGES.cryo);
    const scheduleWorking = await listScheduleWorking(m.db, SCHEDULE_STAGES.cryo);
    const scheduleComplete = await listScheduleComplete(m.db, SCHEDULE_STAGES.cryo);
    const schedule = schedulingPage(SCHEDULE_STAGES.cryo, { available, working: scheduleWorking, complete: scheduleComplete }, "en", LATER);
    expect(schedule).toContain("26011 - 56802 - 1 container");
    expect(schedule).toContain('26055 - <span title="Not a METRC package from this harvest">56833?</span>, 56834 - 2 containers');
    expect(schedule).toContain("26010 - 56010 - 1 container");
    expect(schedule).not.toContain("56010?");
    expect(schedule).toContain("26072 - no code - 2 containers");
    expect(schedule).toContain("26099 - 56099 - 1 container");
    expect(schedule).not.toContain("56099?");
    expect(schedule).toContain('26053 - <span title="Not a METRC package from this harvest">56101?</span> - 1 container');
    expect(schedule).not.toContain("9ZZZ1");
    // PS2 gate fix: an SPR harvest package (ARL's kind) matches as a WIP one does.
    expect(schedule).toContain("26027 - 58008 - 1 container");
    expect(schedule).not.toContain("58008?");
    expect(available.map((group) => group.hbn)).toEqual([sprHbn, notWipHbn, availHbn]);
  });
});
