import { describe, expect, it } from "vitest";
import { CONFIG_KEYS, CRYO_CATEGORIES_DEFAULT, LOC_CRYO_ROOM, METRC_UPLOAD_KINDS, STATUS_TRANSITIONS, WIP_SOURCE, WIP_STATUS, applyTransition, demoteStep, parseCryoCategories, parseCryoTypeCategories } from "../src/config";
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
  poolTotals,
  poolView,
} from "../src/cryo";
import { cryoRunIdentity, foldCryoPool, newPackagesFilename, type CryoRunRow } from "../src/db";
import { stationByKey } from "../src/pipeline";
import { schedulingPage } from "../src/scheduling";
import { buildXlsx, xlsxHasParts } from "../src/xlsx";
import { addCryoOutput } from "../src/actions";
import { formOf, migratedDb, seedBatch, seedLot, seedPerson } from "./migrated";

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
    expect(html).toContain('<a class="queue-pane-item" href="/station/cryo_weight?pick=run-1" data-cryo-run="run-1"><strong>26260-PNN-GH-027-0-NA-26011</strong> <span class="muted">3 containers / 22,679 g</span></a>');
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
    expect(html).toContain('<h2 class="working-pick">26260-PNN-GH-027-0-NA-26011</h2>');
    expect(html).toContain("PNN / Fruity Pebbles / 2026-09-17");
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
    expect(html).toContain("3 contenedores / 22,679 g");
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
    items: [{ id: "hb2", itemId: "hb2", harvest_batch_id: "hb2", hbn: "26261-ARL-GH-031-0-NA-26012", farm_code: "ARL", strain_name: "Rainbow Candies", entry_date: "2026-09-16", identity: cryoRunIdentity({ containers: 2, in_grams: 9000 }) }],
  };

  it("Available reads the HBN and its pool on one line with the >>, nothing to unfold and no container", () => {
    const html = schedulingPage("cryo", { available: [avail], working: [], complete: [] }, "en", "2026-09-17T12:00:00.000Z");
    expect(html).toContain('<div class="pane-group schedule-run" data-schedule-hbn="hb2">');
    expect(html).toContain('<span class="schedule-hbn-line">26261-ARL-GH-031-0-NA-26012 <span class="muted schedule-pool">2 containers / 9,000 g in</span></span>');
    expect(html).toContain('name="hbn_id" value="hb2"');
    expect(html).not.toContain("schedule-item-readonly");
    expect(html).not.toContain('<details class="pane-group" data-schedule-hbn="hb2">');
  });

  it("Scheduled reads the run's pool with Pasteurizing and the arrows; Complete carries Unfinish", () => {
    const html = schedulingPage("cryo", { available: [], working: [group("scheduled")], complete: [group("complete")] }, "en", "2026-09-17T12:00:00.000Z");
    expect(html).toContain('<span class="schedule-identity">3 containers / 22,679 g in / 1 out, 22,000 g</span>');
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
