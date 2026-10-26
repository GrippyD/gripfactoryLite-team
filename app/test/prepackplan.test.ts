import { describe, expect, it } from "vitest";

async function readText(path: URL): Promise<string> {
  const fs = (await import("node:" + "fs")) as { readFileSync(file: URL, encoding: "utf8"): string };
  return fs.readFileSync(path, "utf8");
}
import { GRAMS_PER_LB } from "../src/config";
import { fgMountedLabel } from "../src/fginventory";
import { adminGroupPage } from "../src/html";
import { DICT } from "../src/i18n";
import { app } from "../src/index";
import { backLinkFor } from "../src/nav";
import {
  PREPACK_PLAN_XLSX_PATH,
  PREPACK_TARGETS_PATH,
  deletePrepackTarget,
  loadPrepackSurface,
  loadPrepackTargetsPage,
  planRows,
  poundsToGrams,
  prepackPlanSection,
  prepackPlanXlsx,
  prepackTargetsPage,
  savePrepackTarget,
  strainKey,
  trailingWindowStart,
  zohoPrepackOrders,
  zohoPrepackStock,
  type PlanInput,
  type PlanModel,
  type PlanPackage,
  type PrepackPlanView,
} from "../src/prepackplan";
import { reportFileStamp } from "../src/reports";
import { prepackSchedulingPage } from "../src/scheduling";
import { buildXlsx, readXlsxSheets, readZip } from "../src/xlsx";
import type { ScheduleItemRow } from "../src/db";
import { formOf, migratedDb, seedPerson } from "./migrated";

const DASH = /[\u2013\u2014]/;
const TODAY = "2026-10-24";
const STOCK_AT = "2026-10-23T16:00:00.000Z";
const ORDERS_AT = "2026-10-24T12:00:00.000Z";

const PAGE_KEYS = [
  "Plan",
  "Packed (not ordered)",
  "On Pack Schedule",
  "Need",
  "Net Need",
  "Ready to pack",
  "Short Product",
  "Net Short",
  "Export",
  "Net Need and Net Short count what is already on the pack schedule. The Plan picks follow Net Need.",
  "Totals",
  "Pounds",
  "Add a strain",
  "Prepack targets",
  "Zoho stock as of {time}",
  "Orders as of {time}",
  "No sales orders mounted yet",
  "Name a strain.",
  "Target must be pounds, zero or more, with at most two decimals.",
  "That target is not on the list.",
  "The target for this strain, in pounds. One pound is 448 g.",
  "A strain the plan does not list yet.",
  "No strains on the plan.",
  "Optional note",
];

const PLAN_HEADINGS = [
  "Strain",
  "Target",
  "Packed (not ordered)",
  "On Pack Schedule",
  "Need",
  "Net Need",
  "Ready to pack",
  "Short Product",
  "Net Short",
];

const EXPORT_HEADINGS = [...PLAN_HEADINGS, "On hand", "Open", "Pace (lb per month)", "Months"];

function baseInput(over: Partial<PlanInput> = {}): PlanInput {
  return {
    ordersMounted: true,
    windowMonths: 3,
    targets: [],
    onHand: [],
    open: [],
    shipped: [],
    scheduled: [],
    ready: [],
    packages: [],
    ...over,
  };
}

function rowOf(over: Partial<ScheduleItemRow> & Pick<ScheduleItemRow, "id">): ScheduleItemRow {
  return {
    itemId: over.id,
    harvest_batch_id: "hb",
    hbn: "26244-ARL-GH-027-0-NA-26011",
    farm_code: "ARL",
    strain_name: "Ribbon Citrus",
    entry_date: "2026-10-01",
    identity: over.id,
    grams: 80,
    location: "Cryo 1",
    tag: "1A4PC1000000000000000001",
    ...over,
  };
}

const T0 = "2026-10-20T12:00:00.000Z";

function listing(
  m: Awaited<ReturnType<typeof migratedDb>>,
  row: {
    id: string;
    name: string;
    category?: string;
    qty?: number;
    grams?: number;
    each?: number | null;
    sku?: string | null;
    status?: string;
    at?: string;
    deleted?: string | null;
  }
): void {
  m.run(
    `INSERT INTO listings (
       id, item_name, category, qty_grams, listed, source, sku, market_uom, market_qty, each_grams,
       zoho_status, zoho_mounted_at, created_at, updated_at, deleted_at
     ) VALUES (?, ?, ?, ?, 1, 'zoho', ?, 'ea', ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.name,
    row.category ?? "Flower",
    row.grams ?? 0,
    row.sku ?? null,
    row.qty ?? 0,
    row.each ?? null,
    row.status ?? "Active",
    row.at ?? STOCK_AT,
    T0,
    T0,
    row.deleted ?? null
  );
}

describe("PC1 plan rows", () => {
  it("nets free below zero, floors need and short, and leaves pace blank at zero", () => {
    const planned = planRows(
      baseInput({
        targets: [{ strain: "Ribbon Citrus", grams: 2 * GRAMS_PER_LB }],
        onHand: [{ strain: "Ribbon Citrus", grams: GRAMS_PER_LB }],
        open: [{ strain: "Ribbon Citrus", grams: 3 * GRAMS_PER_LB }],
        scheduled: [{ strain: "Ribbon Citrus", grams: GRAMS_PER_LB }],
        ready: [{ strain: "Ribbon Citrus", grams: GRAMS_PER_LB / 2 }],
        shipped: [],
      })
    );
    const row = planned.rows[0];
    expect(row.freeGrams).toBe(GRAMS_PER_LB - 3 * GRAMS_PER_LB);
    expect(row.freeGrams).toBeLessThan(0);
    // Target 2, free -2, scheduled 1: need = 2 - (-2) - 1 = 3. Ready is half a pound, so short is 2.5.
    expect(row.needGrams).toBe(3 * GRAMS_PER_LB);
    expect(row.shortGrams).toBe(2.5 * GRAMS_PER_LB);
    expect(row.paceGrams).toBeNull();
    expect(row.months).toBeNull();
    expect(planned.totals.paceGrams).toBeNull();
    expect(planned.totals.months).toBeNull();
  });

  it("shows a need from open orders when the target is blank, and pace months when something shipped", () => {
    const planned = planRows(
      baseInput({
        onHand: [{ strain: "Glass Mango", grams: 100 }],
        open: [{ strain: "Glass Mango", grams: 250 }],
        scheduled: [{ strain: "Glass Mango", grams: 0 }],
        ready: [{ strain: "Glass Mango", grams: 40 }],
        shipped: [{ strain: "Glass Mango", grams: 300 }],
      })
    );
    const row = planned.rows[0];
    expect(row.targetGrams).toBeNull();
    expect(row.freeGrams).toBe(-150);
    expect(row.needGrams).toBe(150);
    expect(row.shortGrams).toBe(110);
    expect(row.paceGrams).toBe(100);
    expect(row.months).toBeCloseTo(-1.5);
  });

  it("leaves open out of need when no sales orders are mounted", () => {
    const planned = planRows(
      baseInput({
        ordersMounted: false,
        onHand: [{ strain: "Glass Mango", grams: 100 }],
        open: [{ strain: "Glass Mango", grams: 250 }],
        shipped: [{ strain: "Glass Mango", grams: 300 }],
      })
    );
    const row = planned.rows[0];
    expect(row.openGrams).toBeNull();
    expect(row.freeGrams).toBe(100);
    expect(row.needGrams).toBe(0);
    expect(row.grossNeedGrams).toBe(-100);
    expect(row.paceGrams).toBeNull();
    const view: PrepackPlanView = { ...planned, ordersMounted: false, stockAsOf: STOCK_AT, ordersAsOf: null };
    const html = prepackPlanSection(view, "en");
    expect(html).toContain("No sales orders mounted yet");
    expect(html).not.toContain("data-plan-open");
    expect(html).not.toContain("Orders as of");
    const es = prepackPlanSection(view, "es");
    expect(es).toContain("Aún no hay pedidos de venta montados");
    expect(es).toContain("Empacado (sin pedido)");
    expect(es).not.toContain("En existencia");
    expect(DASH.test(html)).toBe(false);
  });

  it("joins case and spacing, keeps a one sided strain, and sorts by short, need, then name", () => {
    const planned = planRows(
      baseInput({
        targets: [
          { strain: "Ribbon  Citrus", grams: GRAMS_PER_LB },
          { strain: "velvet lantern", grams: 0 },
        ],
        onHand: [
          { strain: "ribbon citrus", grams: GRAMS_PER_LB },
          { strain: "Glass Mango", grams: 100 },
        ],
        open: [{ strain: "Glass Mango", grams: 250 }],
        ready: [{ strain: "Paper Orchard", grams: 10 }],
      })
    );
    expect(planned.rows.map((row) => row.strain)).toEqual(["Glass Mango", "Paper Orchard", "Ribbon Citrus", "velvet lantern"]);
    const ribbon = planned.rows.find((row) => row.key === "ribbon citrus");
    expect(ribbon).toMatchObject({ strain: "Ribbon Citrus", targetGrams: GRAMS_PER_LB, onHandGrams: GRAMS_PER_LB, needGrams: 0 });
    expect(planned.rows.filter((row) => row.key === "ribbon citrus")).toHaveLength(1);
    expect(planned.rows.find((row) => row.key === "paper orchard")?.targetGrams).toBeNull();
    expect(planned.totals.targetGrams).toBe(GRAMS_PER_LB);
    expect(planned.totals.needGrams).toBe(150);
    expect(planned.totals.shortGrams).toBe(150);
  });

  it("picks the oldest lots, whole packages only, and stops at the package that covers the need", () => {
    const packages: PlanPackage[] = [
      { id: "lot-a", strain: "Ribbon Citrus", grams: 40, entryDate: "2026-10-02", createdAt: "2026-10-01T00:00:00.000Z" },
      { id: "lot-b", strain: "Ribbon Citrus", grams: 30, entryDate: "2026-10-01", createdAt: "2026-10-05T00:00:00.000Z" },
      { id: "lot-c", strain: "Ribbon Citrus", grams: 80, entryDate: "2026-10-01", createdAt: "2026-10-03T00:00:00.000Z" },
    ];
    const cover = planRows(baseInput({ targets: [{ strain: "Ribbon Citrus", grams: 100 }], packages }));
    expect(cover.rows[0].needGrams).toBe(100);
    expect(cover.picks).toEqual(["lot-c", "lot-b"]);
    const one = planRows(baseInput({ targets: [{ strain: "Ribbon Citrus", grams: 50 }], packages }));
    expect(one.picks).toEqual(["lot-c"]);
    const none = planRows(baseInput({ targets: [{ strain: "Ribbon Citrus", grams: 0 }], packages }));
    expect(none.rows[0].needGrams).toBe(0);
    expect(none.picks).toEqual([]);
    const all = planRows(baseInput({ targets: [{ strain: "Ribbon Citrus", grams: 1000 }], packages }));
    expect(all.picks).toEqual(["lot-c", "lot-b", "lot-a"]);
  });

  it("the window start is N calendar months back, inclusive of today", () => {
    expect(trailingWindowStart(TODAY, 3)).toBe("2026-07-24");
    expect(trailingWindowStart("2026-03-31", 1)).toBe("2026-02-28");
    expect(poundsToGrams(2.5)).toBe(2.5 * GRAMS_PER_LB);
    expect(strainKey("  Ribbon   Citrus ")).toBe("ribbon citrus");
  });
});

describe("PC1 on the scheduler page", () => {
  it("renders the plan above the panes and marks only the picked available rows", () => {
    const packages: PlanPackage[] = [
      { id: "pkg-a", strain: "Ribbon Citrus", grams: 80, entryDate: "2026-10-01", createdAt: "2026-10-03T00:00:00.000Z" },
      { id: "pkg-b", strain: "Ribbon Citrus", grams: 80, entryDate: "2026-10-02", createdAt: "2026-10-01T00:00:00.000Z" },
    ];
    const planned = planRows(baseInput({ targets: [{ strain: "Ribbon Citrus", grams: 50 }], packages }));
    const panes = {
      available: [
        rowOf({ id: "pkg-a", tag: "1A4PC1000000000000000001" }),
        rowOf({ id: "pkg-b", tag: "1A4PC1000000000000000002", entry_date: "2026-10-02" }),
      ],
      working: [rowOf({ id: "sched-1", tag: "1A4PC1000000000000000003", status: "scheduled" })],
      complete: [rowOf({ id: "sched-0", tag: "1A4PC1000000000000000004", status: "complete", completed_at: T0 })],
    };
    const html = prepackSchedulingPage(panes, null, "en", "", {
      ...planned,
      ordersMounted: true,
      stockAsOf: STOCK_AT,
      ordersAsOf: ORDERS_AT,
    });
    expect(html.indexOf('data-fold="prepack-plan"')).toBeLessThan(html.indexOf("data-schedule-filter"));
    expect(html.indexOf("data-schedule-filter")).toBeLessThan(html.indexOf('data-schedule-pane="available"'));
    expect(html).toContain('class="report-scroll"');
    expect(html).toContain("data-prepack-plan");
    expect(html).toContain(`Zoho stock as of ${fgMountedLabel(STOCK_AT)}`);
    expect(html).toContain(`Orders as of ${fgMountedLabel(ORDERS_AT)}`);
    expect(html).toContain(`href="${PREPACK_TARGETS_PATH}"`);
    expect(html).toContain(`<a class="btn secondary" href="${PREPACK_PLAN_XLSX_PATH}">Export</a>`);
    expect(html).toContain('data-plan-pick');
    expect(html.match(/data-plan-pick/g)).toHaveLength(1);
    expect(html).toContain('data-plan-pick data-schedule-id="pkg-a"');
    expect(html).not.toContain('data-plan-pick data-schedule-id="pkg-b"');
    expect(html).toContain('data-plan-badge');
    expect(html).toContain('class="plan-short"');
    expect((html.match(/name="wip_package_id"/g) || []).length).toBe(2);
    expect(html).toContain('title="Unschedule"');
    expect(html).toContain('title="Prepack"');
    expect(html).toContain('placeholder="HBN or last six"');
    expect(DASH.test(html)).toBe(false);
    expect(DASH.test(prepackSchedulingPage(panes, null, "es", "", {
      ...planned,
      ordersMounted: false,
      stockAsOf: null,
      ordersAsOf: null,
    }))).toBe(false);
  });
});

function viewOf(planned: PlanModel, over: Partial<PrepackPlanView> = {}): PrepackPlanView {
  return { ...planned, ordersMounted: true, stockAsOf: STOCK_AT, ordersAsOf: ORDERS_AT, ...over };
}

function headLabels(html: string): string[] {
  const head = html.slice(html.indexOf("<thead>"), html.indexOf("</thead>"));
  return [...head.matchAll(/<th>([^<]*)<\/th>/g)].map((match) => match[1]);
}

async function sheetXmlOf(bytes: Uint8Array): Promise<string> {
  const entries = await readZip(bytes);
  const hit = entries.find((entry) => entry.name === "xl/worksheets/sheet1.xml");
  if (!hit) throw new Error("no sheet");
  return new TextDecoder().decode(hit.data);
}

const PINNED_SHEET = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="12" customWidth="1"/></cols>
  <sheetData>
    
    <row r="1"><c r="A1" t="inlineStr" s="1"><is><t>Lot</t></is></c><c r="B1" t="inlineStr" s="1"><is><t>Note</t></is></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>Oak</t></is></c><c r="B2" t="inlineStr"><is><t>none</t></is></c></row>
  </sheetData>
</worksheet>`;

describe("PC1b both needs and the plan table", () => {
  it("keeps his Need beside Net Need, and the totals keep a negative", () => {
    const covered = planRows(
      baseInput({
        targets: [{ strain: "Ribbon Citrus", grams: 200 }],
        onHand: [{ strain: "Ribbon Citrus", grams: 80 }],
        scheduled: [{ strain: "Ribbon Citrus", grams: 150 }],
        ready: [{ strain: "Ribbon Citrus", grams: 400 }],
        packages: [{ id: "pkg-a", strain: "Ribbon Citrus", grams: 500, entryDate: "2026-10-01", createdAt: T0 }],
      })
    ).rows[0];
    expect(covered).toMatchObject({ grossNeedGrams: 120, needGrams: 0, grossShortGrams: 0, shortGrams: 0 });
    const picked = planRows(
      baseInput({
        targets: [{ strain: "Ribbon Citrus", grams: 200 }],
        onHand: [{ strain: "Ribbon Citrus", grams: 80 }],
        scheduled: [{ strain: "Ribbon Citrus", grams: 150 }],
        packages: [{ id: "pkg-a", strain: "Ribbon Citrus", grams: 500, entryDate: "2026-10-01", createdAt: T0 }],
      })
    );
    expect(picked.rows[0].grossNeedGrams).toBe(120);
    expect(picked.rows[0].needGrams).toBe(0);
    expect(picked.picks).toEqual([]);

    const waiting = planRows(
      baseInput({
        targets: [{ strain: "Glass Mango", grams: 200 }],
        scheduled: [{ strain: "Glass Mango", grams: 175 }],
        ready: [{ strain: "Glass Mango", grams: 75 }],
      })
    ).rows[0];
    expect(waiting).toMatchObject({ grossNeedGrams: 200, needGrams: 25, grossShortGrams: 125, shortGrams: 0 });

    const over = planRows(
      baseInput({
        targets: [{ strain: "Paper Orchard", grams: 200 }],
        onHand: [{ strain: "Paper Orchard", grams: 450 }],
      })
    ).rows[0];
    expect(over).toMatchObject({ freeGrams: 450, grossNeedGrams: -250, needGrams: 0, grossShortGrams: 0, shortGrams: 0 });

    const blank = planRows(
      baseInput({
        onHand: [{ strain: "Glass Mango", grams: 80 }],
        scheduled: [{ strain: "Glass Mango", grams: 10 }],
      })
    ).rows[0];
    const zeroTarget = planRows(
      baseInput({
        targets: [{ strain: "Glass Mango", grams: 0 }],
        onHand: [{ strain: "Glass Mango", grams: 80 }],
        scheduled: [{ strain: "Glass Mango", grams: 10 }],
      })
    ).rows[0];
    expect(blank.targetGrams).toBeNull();
    expect(zeroTarget.targetGrams).toBe(0);
    expect(blank.grossNeedGrams).toBe(-80);
    expect(blank.grossNeedGrams).toBe(zeroTarget.grossNeedGrams);
    expect(blank.needGrams).toBe(0);
    expect(blank.needGrams).toBe(zeroTarget.needGrams);

    const summed = planRows(
      baseInput({
        targets: [
          { strain: "Amber Field", grams: 200 },
          { strain: "Zinc Bloom", grams: 200 },
        ],
        onHand: [
          { strain: "Amber Field", grams: 450 },
          { strain: "Zinc Bloom", grams: 80 },
        ],
        scheduled: [{ strain: "Zinc Bloom", grams: 150 }],
        ready: [{ strain: "Zinc Bloom", grams: 400 }],
      })
    );
    expect(summed.rows.map((row) => row.strain)).toEqual(["Amber Field", "Zinc Bloom"]);
    expect(summed.totals.grossNeedGrams).toBe(-130);
    expect(summed.totals.needGrams).toBe(0);
    expect(summed.totals.grossShortGrams).toBe(0);
    expect(summed.totals.shortGrams).toBe(0);
  });

  it("shows his nine headings, the note, the export, and the warn tone on both shorts", () => {
    const both = planRows(
      baseInput({
        targets: [{ strain: "Ribbon Citrus", grams: 200 }],
        ready: [{ strain: "Ribbon Citrus", grams: 50 }],
      })
    );
    const html = prepackPlanSection(viewOf(both), "en");
    expect(headLabels(html)).toEqual(PLAN_HEADINGS);
    expect(html).not.toContain("data-plan-on-hand");
    expect(html).not.toContain("data-plan-open");
    expect(html).not.toContain("data-plan-pace");
    expect(html).not.toContain("data-plan-months");
    for (const heading of ["On hand", "Open", "Pace", "Months", "Free"]) {
      expect(headLabels(html)).not.toContain(heading);
    }
    expect(html.indexOf("data-prepack-plan")).toBeLessThan(html.indexOf("data-plan-note"));
    expect(html).toContain("Net Need and Net Short count what is already on the pack schedule. The Plan picks follow Net Need.");
    expect(html).toContain(`<a class="btn secondary" href="${PREPACK_PLAN_XLSX_PATH}">Export</a>`);
    expect(html).toContain('data-plan-gross-short class="plan-short"');
    expect(html).toContain('data-plan-short class="plan-short"');
    expect(html).toMatch(/data-plan-target[\s\S]*data-plan-free[\s\S]*data-plan-scheduled[\s\S]*data-plan-gross-need[\s\S]*data-plan-need[\s\S]*data-plan-ready[\s\S]*data-plan-gross-short[\s\S]*data-plan-short/);
    const es = prepackPlanSection(viewOf(both), "es");
    expect(es).toContain("Exportar");
    expect(es).toContain("La necesidad neta y el faltante neto cuentan lo que ya está en el programa de empaque. Las selecciones del plan siguen la necesidad neta.");
    expect(DASH.test(html)).toBe(false);
    expect(DASH.test(es)).toBe(false);

    const onlyGross = prepackPlanSection(
      viewOf(
        planRows(
          baseInput({
            targets: [{ strain: "Glass Mango", grams: 200 }],
            scheduled: [{ strain: "Glass Mango", grams: 175 }],
            ready: [{ strain: "Glass Mango", grams: 75 }],
          })
        )
      ),
      "en"
    );
    expect(onlyGross).toContain('data-plan-gross-short class="plan-short"');
    expect(onlyGross).not.toContain('data-plan-short class="plan-short"');

    const signs = prepackPlanSection(
      viewOf(
        planRows(
          baseInput({
            targets: [
              { strain: "Glass Mango", grams: 200 },
              { strain: "Ribbon Citrus", grams: 200 },
            ],
            onHand: [{ strain: "Ribbon Citrus", grams: 450 }],
            open: [{ strain: "Glass Mango", grams: 80 }],
          })
        )
      ),
      "en"
    );
    expect(signs).toMatch(/data-plan-free data-grams="-80">-/);
    expect(signs).not.toMatch(/data-plan-free class="plan-short"/);
    expect(signs).toMatch(/data-plan-gross-need data-grams="-250">-/);
    expect(signs).not.toMatch(/data-plan-gross-need class="plan-short"/);

    const empty = prepackPlanSection(viewOf(planRows(baseInput())), "en");
    expect(empty).toContain("No strains on the plan.");
    expect(empty).toContain("data-plan-note");
    expect(empty).toContain(PREPACK_PLAN_XLSX_PATH);
    expect(empty).not.toContain("data-prepack-plan");
  });
});

describe("PC1b the plan export", () => {
  it("with autoFilter unset, a two row sheet matches the pinned XML", async () => {
    const bytes = buildXlsx({ headers: ["Lot", "Note"], rows: [[{ text: "Oak" }, { text: "none" }]] });
    expect(await sheetXmlOf(bytes)).toBe(PINNED_SHEET);
    const filtered = buildXlsx({ headers: ["Lot", "Note"], rows: [[{ text: "Oak" }, { text: "none" }]], autoFilter: 2 });
    expect(await sheetXmlOf(filtered)).toBe(PINNED_SHEET.replace("</sheetData>", '</sheetData>\n  <autoFilter ref="A1:B2"/>'));
  });

  it("reads months as a plain number on the export, and the filter stops at the strains (the gate)", async () => {
    const planned = planRows(
      baseInput({
        targets: [{ strain: "Velvet Lantern", grams: 448 }],
        onHand: [
          { strain: "Glass Mango", grams: 896 },
          { strain: "Paper Orchard", grams: 448 },
        ],
        shipped: [
          { strain: "Glass Mango", grams: 1344 },
          { strain: "Paper Orchard", grams: 1344 },
        ],
      })
    );
    expect(planned.rows.map((row) => row.strain)).toEqual(["Velvet Lantern", "Glass Mango", "Paper Orchard"]);
    expect(planned.rows[1].paceGrams).toBe(448);
    expect(planned.rows[1].months).toBe(2);
    expect(planned.rows[0].months).toBeNull();
    expect(planned.totals.months).toBeCloseTo(1.5);
    expect((planned.rows[1].months ?? 0) + (planned.rows[2].months ?? 0)).toBe(3);

    const bytes = prepackPlanXlsx(viewOf(planned));
    const grid = (await readXlsxSheets(bytes)).get("Prepack plan");
    expect(grid?.map((row) => row.row)).toEqual([0, 1, 2, 3, 5, 7, 8]);
    expect(grid?.[0].cells).toEqual(EXPORT_HEADINGS);
    expect(grid?.[1].cells[11]).toBeUndefined();
    expect(grid?.[1].cells[12]).toBeUndefined();
    expect(grid?.[2].cells).toEqual(["Glass Mango", null, 2, 0, -2, 0, 0, 0, 0, 2, 0, 1, 2]);
    expect(grid?.[3].cells[12]).toBe(1);
    expect(grid?.[4].cells[0]).toBe("Totals");
    expect(grid?.[4].cells[11]).toBe(2);
    expect(grid?.[4].cells[12]).toBe(1.5);
    expect(grid?.[5].cells).toEqual([`Zoho stock as of ${fgMountedLabel(STOCK_AT)}`]);
    expect(grid?.[6].cells).toEqual([`Orders as of ${fgMountedLabel(ORDERS_AT)}`]);
    const xml = await sheetXmlOf(bytes);
    expect(xml).toContain('<autoFilter ref="A1:M4"/>');
    expect(xml).not.toContain("A1:M5");
    expect(xml).toContain('<c r="M3" t="n"><v>2.00</v></c>');
    expect(xml).not.toContain('<c r="M3" t="n" s="3"');
    expect(xml).toContain('<c r="L3" t="n" s="3"><v>1</v></c>');
    expect(xml).toContain('<c r="M6" t="n"><v>1.50</v></c>');
    expect(xml).not.toContain("<v>3.00</v>");
    const text = grid?.map((row) => row.cells.join(" ")).join("\n") ?? "";
    expect(DASH.test(text)).toBe(false);
    expect(DASH.test(xml)).toBe(false);
  });

  it("GET /production/scheduling/prepack/plan.xlsx is the same workbook the page's plan builds", async () => {
    const m = await migratedDb();
    listing(m, { id: "pre-plain", name: "PRE - Ribbon Citrus", qty: 2, each: 448, at: STOCK_AT });
    const env = {
      DB: m.db,
      THEME: "grip",
      ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) },
    } as unknown as Env;
    const surface = await loadPrepackSurface(m.db, "2026-10-26T16:00:00.000Z");
    const res = await app.request(PREPACK_PLAN_XLSX_PATH, {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="prepack_plan_${reportFileStamp()}.xlsx"`);
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body[0]).toBe(0x50);
    expect(body[1]).toBe(0x4b);
    expect(Array.from(body)).toEqual(Array.from(prepackPlanXlsx(surface.plan)));
    const grid = (await readXlsxSheets(body)).get("Prepack plan");
    expect(grid?.[0].cells).toEqual(EXPORT_HEADINGS);
    expect(grid?.map((row) => row.row)).toEqual([0, 1, 3, 5, 6]);
    expect(grid?.[1].cells[0]).toBe("Ribbon Citrus");
    expect(grid?.[1].cells[10]).toBeUndefined();
    expect(grid?.[1].cells[12]).toBeUndefined();
    expect(grid?.[2].cells[0]).toBe("Totals");
    expect(grid?.[3].cells[0]).toBe(`Zoho stock as of ${fgMountedLabel(STOCK_AT)}`);
    expect(grid?.[4].cells[0]).toBe("No sales orders mounted yet");
    expect(await sheetXmlOf(body)).toContain('<autoFilter ref="A1:M2"/>');
  });
});

describe("PC1 Zoho seam", () => {
  it("counts PRE and MOB, uses fg_pre_each_grams, and leaves gone and inactive listings out", async () => {
    const m = await migratedDb();
    m.run(`UPDATE app_config SET value = '30' WHERE key = 'fg_pre_each_grams'`);
    listing(m, { id: "pre-plain", name: "PRE - Ribbon Citrus", qty: 10, at: "2026-10-23T15:00:00.000Z" });
    listing(m, { id: "mob", name: "MOB - Velvet Lantern", qty: 2, at: STOCK_AT });
    listing(m, { id: "pre-each", name: "PRE - Paper Orchard", qty: 4, each: 10, at: "2026-10-23T14:00:00.000Z" });
    listing(m, { id: "inactive", name: "PRE - Hidden Citrus", qty: 8, status: "Inactive", at: "2026-10-23T18:00:00.000Z" });
    listing(m, { id: "gone", name: "PRE - Gone Citrus", qty: 8, status: "Gone", at: "2026-10-23T19:00:00.000Z" });
    listing(m, { id: "dead", name: "PRE - Dead Citrus", qty: 8, status: "Active", at: "2026-10-23T20:00:00.000Z", deleted: T0 });
    listing(m, { id: "bud", name: "BUD - Glass Mango", category: "Bulk Flower", qty: 5, grams: 500, at: "2026-10-23T21:00:00.000Z" });
    const stock = await zohoPrepackStock(m.db);
    expect(stock.mountedAt).toBe(STOCK_AT);
    expect(stock.onHand).toEqual([
      { strain: "Paper Orchard", grams: 40 },
      { strain: "Ribbon Citrus", grams: 300 },
      { strain: "Velvet Lantern", grams: 140 },
    ]);
  });

  it("splits open from shipped, overlays pick status, and finds each grams by SKU, then name, then the rule", async () => {
    const m = await migratedDb();
    m.run(`UPDATE app_config SET value = '30' WHERE key = 'fg_pre_each_grams'`);
    expect(await zohoPrepackOrders(m.db, TODAY, 3)).toEqual({ mounted: false, mountedAt: null, open: [], shipped: [] });
    m.run(
      `INSERT INTO so_mounts (id, filename, row_count, order_count, created_at, updated_at)
       VALUES ('mount-1', 'orders.csv', 1, 1, ?, ?)`,
      ORDERS_AT,
      ORDERS_AT
    );
    listing(m, { id: "by-sku", name: "PRE - Other Name", sku: "PC1-SKU-RIBBON", each: 14, qty: 1 });
    listing(m, { id: "by-name", name: "PRE - Paper Orchard", sku: "PC1-SKU-OTHER", each: 21, qty: 1 });
    listing(m, { id: "by-old", name: "PRE - Nowhere", sku: "PC1-SKU-OLD", each: 99, qty: 0, status: "Inactive" });
    const order = (id: string, status: string, date: string, pick: string | null, deleted: string | null = null) =>
      m.run(
        `INSERT INTO mounted_sales_orders (
           id, so_number, order_date, internal_status, pick_status, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        id,
        date,
        status,
        pick,
        T0,
        T0,
        deleted
      );
    const line = (
      id: string,
      orderId: string,
      seq: number,
      name: string,
      sku: string | null,
      ordered: number,
      invoiced: number,
      category: string,
      deleted: string | null = null
    ) =>
      m.run(
        `INSERT INTO mounted_sales_order_lines (
           id, sales_order_id, seq, item_name, sku, readout_category, quantity_ordered, quantity_invoiced, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        orderId,
        seq,
        name,
        sku,
        category,
        ordered,
        invoiced,
        T0,
        T0,
        deleted
      );
    order("so-open", "approved", "2026-10-01", null);
    line("ln-sku", "so-open", 1, "PRE - Paper Orchard", "PC1-SKU-RIBBON", 10, 4, "PREPACK");
    line("ln-dead", "so-open", 2, "PRE - Paper Orchard", "PC1-SKU-RIBBON", 100, 0, "PREPACK", T0);
    line("ln-bud", "so-open", 3, "BUD - Glass Mango", null, 50, 0, "BUD");
    order("so-ship", "shipped", "2026-07-24", null);
    line("ln-name", "so-ship", 1, "PRE - Paper Orchard", null, 3, 3, "PREPACK");
    order("so-early", "shipped", "2026-07-23", null);
    line("ln-early", "so-early", 1, "PRE - Paper Orchard", null, 9, 9, "PREPACK");
    order("so-late", "shipped", "2026-10-25", null);
    line("ln-late", "so-late", 1, "PRE - Harbor Mint", null, 8, 8, "PREPACK");
    order("so-today", "shipped", TODAY, null);
    line("ln-rule", "so-today", 1, "PRE - Glass Mango", null, 1, 1, "PREPACK");
    order("so-pick", "shipped", "2026-10-01", "picking");
    line("ln-mob", "so-pick", 1, "MOB - Velvet Lantern", null, 5, 1, "PREPACK");
    line("ln-old", "so-pick", 2, "PRE - Nowhere", "PC1-SKU-OLD", 2, 0, "PREPACK");
    order("so-void", "approved", "2026-10-01", null, T0);
    line("ln-void", "so-void", 1, "PRE - Paper Orchard", null, 80, 0, "PREPACK");

    const orders = await zohoPrepackOrders(m.db, TODAY, 3);
    expect(orders.mounted).toBe(true);
    expect(orders.mountedAt).toBe(ORDERS_AT);
    expect(orders.open).toEqual([
      { strain: "Nowhere", grams: 198 },
      { strain: "Paper Orchard", grams: 84 },
      { strain: "Velvet Lantern", grams: 280 },
    ]);
    expect(orders.shipped).toEqual([
      { strain: "Glass Mango", grams: 30 },
      { strain: "Paper Orchard", grams: 63 },
    ]);
  });
});

describe("PC1 targets", () => {
  it("migration 0121 applies twice and keeps one live row per strain key", async () => {
    const { DatabaseSync } = (await import("node:" + "sqlite")) as {
      DatabaseSync: new (path: string) => { exec(sql: string): void; close(): void };
    };
    const sql = await readText(new URL("../migrations/0121_prepack_targets.sql", import.meta.url));
    const db = new DatabaseSync(":memory:");
    db.exec(sql);
    db.exec(sql);
    db.exec(
      `INSERT INTO prepack_targets (id, strain, strain_key, target_grams, created_at, updated_at)
       VALUES ('a', 'Ribbon Citrus', 'ribbon citrus', 448, 't', 't')`
    );
    expect(() =>
      db.exec(
        `INSERT INTO prepack_targets (id, strain, strain_key, target_grams, created_at, updated_at)
         VALUES ('b', 'ribbon citrus', 'ribbon citrus', 448, 't', 't')`
      )
    ).toThrow();
    expect(() =>
      db.exec(
        `INSERT INTO prepack_targets (id, strain, strain_key, target_grams, created_at, updated_at)
         VALUES ('c', 'Glass Mango', 'glass mango', -1, 't', 't')`
      )
    ).toThrow();
    db.close();
  });

  it("refuses a change without a reason, stores pounds as grams, soft deletes, and logs", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const save = (fields: Record<string, string>) => savePrepackTarget(m.db, formOf({ person_id: person, ...fields }));
    await expect(save({ strain: "Ribbon Citrus", pounds: "1.25" })).rejects.toThrow("Reason is required.");
    await expect(save({ strain: "Ribbon Citrus", pounds: "1.255", reason: "bad" })).rejects.toThrow(
      "Target must be pounds, zero or more, with at most two decimals."
    );
    await expect(save({ strain: "   ", pounds: "1", reason: "blank" })).rejects.toThrow("Name a strain.");
    expect(m.all(`SELECT id FROM prepack_targets`)).toHaveLength(0);

    const first = await save({ strain: "Ribbon Citrus", pounds: "1.25", reason: "opening", note: "first" });
    expect(first.redirect).toBe(`${PREPACK_TARGETS_PATH}?ok=saved`);
    const live = m.get(`SELECT id, strain, strain_key, target_grams, note FROM prepack_targets WHERE deleted_at IS NULL`) as {
      id: string;
      strain: string;
      strain_key: string;
      target_grams: number;
      note: string;
    };
    expect(live).toMatchObject({ strain: "Ribbon Citrus", strain_key: "ribbon citrus", target_grams: 560, note: "first" });

    await save({ strain: "ribbon  citrus", pounds: "2.50", reason: "revised" });
    const still = m.all(`SELECT id, strain, target_grams, note FROM prepack_targets WHERE deleted_at IS NULL`) as Array<{
      id: string;
      strain: string;
      target_grams: number;
      note: string | null;
    }>;
    expect(still).toEqual([{ id: live.id, strain: "ribbon citrus", target_grams: 1120, note: null }]);
    const logged = m.all(
      `SELECT field, old_value, new_value, reason FROM record_change_log
       WHERE record_table = 'prepack_targets' AND record_id = ? AND field = 'target_grams'`,
      live.id
    );
    expect(logged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ old_value: null, new_value: "560", reason: "opening" }),
        expect.objectContaining({ old_value: "560", new_value: "1120", reason: "revised" }),
      ])
    );

    await expect(deletePrepackTarget(m.db, live.id, formOf({ person_id: person }))).rejects.toThrow("Reason is required.");
    await deletePrepackTarget(m.db, live.id, formOf({ person_id: person, reason: "cleared" }));
    const gone = m.get(`SELECT deleted_at, deleted_by, delete_reason, target_grams FROM prepack_targets WHERE id = ?`, live.id) as {
      deleted_at: string;
      deleted_by: string;
      delete_reason: string;
      target_grams: number;
    };
    expect(gone.deleted_at).toBeTruthy();
    expect(gone.deleted_by).toBe(person);
    expect(gone.delete_reason).toBe("cleared");
    expect(gone.target_grams).toBe(1120);
    expect(m.all(`SELECT id FROM prepack_targets WHERE deleted_at IS NULL`)).toHaveLength(0);
    const cleared = m.get(
      `SELECT new_value, reason FROM record_change_log
       WHERE record_table = 'prepack_targets' AND record_id = ? AND field = 'target_grams' AND new_value IS NULL`,
      live.id
    ) as { reason: string };
    expect(cleared.reason).toBe("cleared");

    await save({ strain: "Ribbon Citrus", pounds: "1", reason: "again" });
    expect(m.all(`SELECT id FROM prepack_targets WHERE deleted_at IS NULL`)).toHaveLength(1);
    expect(m.all(`SELECT id FROM prepack_targets`)).toHaveLength(2);
  });

  it("answers 401 without the PIN and renders the strains the plan knows", async () => {
    const m = await migratedDb();
    listing(m, { id: "pre-plain", name: "PRE - Paper Orchard", qty: 2, each: 28 });
    const env = {
      DB: m.db,
      THEME: "grip",
      ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) },
    } as unknown as Env;
    const locked = await app.request(PREPACK_TARGETS_PATH, {}, env);
    expect(locked.status).toBe(401);
    expect(await locked.text()).toContain("Enter PIN");
    const refused = await app.request(
      PREPACK_TARGETS_PATH,
      { method: "POST", body: new URLSearchParams({ strain: "Paper Orchard", pounds: "1", reason: "no pin" }) },
      env
    );
    expect(refused.status).toBe(401);
    expect(m.all(`SELECT id FROM prepack_targets`)).toHaveLength(0);

    const pin = String((m.get(`SELECT value FROM app_config WHERE key = 'admin_pin' AND deleted_at IS NULL`) as { value: string }).value);
    const noReason = await app.request(
      PREPACK_TARGETS_PATH,
      {
        method: "POST",
        headers: { cookie: `gf_pin=${pin}` },
        body: new URLSearchParams({ strain: "Paper Orchard", pounds: "1" }),
      },
      env
    );
    expect(noReason.status).toBe(400);
    expect(await noReason.text()).toContain("Reason is required.");
    expect(m.all(`SELECT id FROM prepack_targets`)).toHaveLength(0);

    const saved = await app.request(
      PREPACK_TARGETS_PATH,
      {
        method: "POST",
        headers: { cookie: `gf_pin=${pin}` },
        body: new URLSearchParams({ strain: "Ribbon Citrus", pounds: "2.50", reason: "opening" }),
      },
      env
    );
    expect(saved.status).toBe(303);
    const page = await loadPrepackTargetsPage(m.db, "2026-10-24T16:00:00.000Z");
    expect(page.rows.map((row) => row.strain).sort()).toEqual(["Paper Orchard", "Ribbon Citrus"]);
    expect(page.rows.find((row) => row.key === "ribbon citrus")).toMatchObject({ pounds: "2.50", targetId: expect.any(String) });
    const html = prepackTargetsPage(page, "en");
    const tableAt = html.indexOf("<table");
    expect(html.slice(tableAt - 40, tableAt)).toContain('class="report-scroll"');
    expect(html).toContain('data-prepack-target-key="ribbon citrus"');
    expect(html).toContain('value="2.50"');
    expect(prepackTargetsPage(page, "es")).toContain("Metas de preempaque");
    expect(DASH.test(html)).toBe(false);
    expect(adminGroupPage("settings", "en")).toContain(`href="${PREPACK_TARGETS_PATH}"`);
    expect(backLinkFor(PREPACK_TARGETS_PATH)).toEqual({ href: "/admin/settings", label: "Admin Settings" });
    for (const key of PAGE_KEYS) {
      expect(DICT[key]?.en, key).toBe(key);
      expect(DICT[key]?.es.trim().length, key).toBeGreaterThan(0);
      expect(DASH.test(DICT[key]?.en ?? ""), key).toBe(false);
      expect(DASH.test(DICT[key]?.es ?? ""), key).toBe(false);
    }
  });

  it("keeps the Zoho reads inside the plan module", async () => {
    const root = new URL("../src/", import.meta.url);
    for (const name of ["scheduling.ts", "html.ts", "nav.ts", "theme.ts", "index.ts"]) {
      const text = await readText(new URL(name, root));
      expect(text, name).not.toContain("so_mounts");
      expect(text, name).not.toContain("mounted_sales_order");
      expect(text, name).not.toContain("FG_LISTINGS_SQL");
    }
    const plan = await readText(new URL("prepackplan.ts", root));
    expect(plan).toContain("zohoPrepackStock");
    expect(plan).toContain("zohoPrepackOrders");
    expect(DASH.test(plan)).toBe(false);
  });
});
