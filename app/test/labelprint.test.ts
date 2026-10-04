import { describe, expect, it } from "vitest";
import { emptyLayout, labelRunPrintHtml, normalizeLayout } from "../src/labeleditor";
import { valueFills, type LabelFacts, type MirrorPackage } from "../src/labeldata";
import { t } from "../src/i18n";
import {
  CONTAINER_MAX,
  LABELS_PER_MAX,
  PACKAGE_ID_REFUSAL,
  PER_REFUSAL,
  QTY_REFUSAL,
  ROLL_OVERFLOW,
  ROLL_PIN,
  UNKNOWN_WARNING,
  assertRollPin,
  containerIds,
  containerPreview,
  expandPages,
  logPrintRun,
  quickPrintHref,
  quickPrintPage,
  readCount,
  readPackageId,
  rollPackageId,
  runPageCount,
} from "../src/labelprint";

const GOOD = "1A40503000311FB000000123";
const ZEROES = "1A40503000311FB000000007";
const FULL = "1A4050300061761000099999";
const PROCESSOR = "1A4050300061761000001045";

function facts(tag: string, item: string, strain: string): LabelFacts {
  const pkg: MirrorPackage = {
    tag,
    license_value: null,
    source_harvests: null,
    source_packages: null,
    original_source_label: null,
    item,
    category: null,
    item_strain: strain,
    quantity: null,
    uom: null,
    packaged_date: null,
    production_batch: null,
    lab_test_status: null,
    location: null,
    gone_at: null,
  };
  return { packages: [pkg], locals: [], harvests: [], samples: [] };
}

describe("L3 QUICK PRINT", () => {
  it("checks a package ID: good, short, wrong prefix, lower case typed", () => {
    expect(readPackageId(`  ${GOOD.toLowerCase()}  `)).toEqual({ ok: true, id: GOOD });
    expect(GOOD).toHaveLength(24);
    expect(readPackageId(GOOD.slice(0, 23))).toEqual({ ok: false, key: PACKAGE_ID_REFUSAL });
    expect(readPackageId(`1A5${GOOD.slice(3)}`)).toEqual({ ok: false, key: PACKAGE_ID_REFUSAL });
    expect(readPackageId("1A4050300000000000000E07")).toEqual({ ok: false, key: PACKAGE_ID_REFUSAL });
  });

  it("rolls the numeric tail and keeps leading zeros", () => {
    expect(rollPackageId(GOOD, 0)).toBe(GOOD);
    expect(rollPackageId(GOOD, 2)).toBe("1A40503000311FB000000125");
    expect(rollPackageId(ZEROES, 1)).toBe("1A40503000311FB000000008");
    expect(rollPackageId(PROCESSOR, 1)).toBe("1A4050300061761000001046");
    expect(() => rollPackageId(FULL, 1)).toThrow(ROLL_OVERFLOW);
    expect(containerIds(GOOD, false, 3)).toEqual([GOOD, GOOD, GOOD]);
    expect(containerIds(GOOD, true, 3)).toEqual([
      GOOD,
      "1A40503000311FB000000124",
      "1A40503000311FB000000125",
    ]);
  });

  it("refuses Roll ID Yes without the PIN", () => {
    expect(() => assertRollPin(true, null, "21319")).toThrow(ROLL_PIN);
    expect(() => assertRollPin(true, "00000", "21319")).toThrow(ROLL_PIN);
    expect(() => assertRollPin(true, "21319", null)).toThrow(ROLL_PIN);
    expect(() => assertRollPin(false, null, "21319")).not.toThrow();
    expect(() => assertRollPin(true, "21319", "21319")).not.toThrow();
  });

  it("bounds Container Qty and Labels per container", () => {
    expect(readCount("3", CONTAINER_MAX, QTY_REFUSAL)).toBe(3);
    expect(readCount("2", LABELS_PER_MAX, PER_REFUSAL)).toBe(2);
    expect(readCount(String(CONTAINER_MAX), CONTAINER_MAX, QTY_REFUSAL)).toBe(CONTAINER_MAX);
    expect(readCount(String(LABELS_PER_MAX), LABELS_PER_MAX, PER_REFUSAL)).toBe(LABELS_PER_MAX);
    expect(() => readCount("0", CONTAINER_MAX, QTY_REFUSAL)).toThrow(QTY_REFUSAL);
    expect(() => readCount("501", CONTAINER_MAX, QTY_REFUSAL)).toThrow(QTY_REFUSAL);
    expect(() => readCount("1.5", CONTAINER_MAX, QTY_REFUSAL)).toThrow(QTY_REFUSAL);
    expect(() => readCount("", LABELS_PER_MAX, PER_REFUSAL)).toThrow(PER_REFUSAL);
    expect(() => readCount("51", LABELS_PER_MAX, PER_REFUSAL)).toThrow(PER_REFUSAL);
  });

  it("counts one page per label and fills each rolled container from its own package", () => {
    const ids = containerIds(GOOD, true, 3);
    const per = 2;
    expect(runPageCount(ids.length, per)).toBe(6);
    const fills = new Map([
      [ids[0], valueFills(facts(ids[0], "Bud A", "Alpha"), ids[0], [])],
      [ids[1], valueFills(facts(ids[1], "Bud B", "Beta"), ids[1], [])],
      [ids[2], valueFills(facts(ids[2], "Bud C", "Gamma"), ids[2], [])],
    ]);
    const pages = expandPages(ids, per, fills);
    expect(pages).toHaveLength(6);
    expect(pages[0].item).toBe("Bud A");
    expect(pages[1].item).toBe("Bud A");
    expect(pages[2].strain).toBe("Beta");
    expect(pages[3].strain).toBe("Beta");
    expect(pages[4].item).toBe("Bud C");
    expect(pages[5].item).toBe("Bud C");
    const layout = normalizeLayout({
      v: 1,
      objects: [
        { id: "t1", type: "text", x: 0.2, y: 0.2, w: 2, h: 0.4, rotate: 0, text: "{item}", font: "Arial", size: 12, bold: false, italic: false, align: "left", attach: null },
      ],
    });
    const html = labelRunPrintHtml(layout, 4, 6, "smoke tag", "en", pages);
    expect(html).toContain("@page { size: 4in 6in; margin: 0; }");
    expect(html.match(/data-label-page="/g)).toHaveLength(6);
    expect(html).toContain(">Bud A<");
    expect(html).toContain(">Bud B<");
    expect(html).toContain(">Bud C<");
    expect(labelRunPrintHtml(emptyLayout(), 4, 6, "smoke tag", "en", pages)).toContain('data-label-pages="6"');
  });

  it("warns on an unknown ID and prints its looked-up fields blank", () => {
    const unknown = "1A40503000311FB000000999";
    const fills = valueFills(facts(unknown, "", ""), unknown, []);
    const row = containerPreview(unknown, false, { ...fills, item: "", strain: "" }, ["item", "harvest_date"], [], "en");
    expect(row.unknown).toBe(true);
    expect(row.item).toBe("");
    expect(row.strain).toBe("");
    expect(row.blanks).toContain("Item");
    expect(row.blanks).toContain("Harvest date");
    const html = labelRunPrintHtml(
      normalizeLayout({
        v: 1,
        objects: [
          { id: "t1", type: "text", x: 0.2, y: 0.2, w: 2, h: 0.4, rotate: 0, text: "{item}", font: "Arial", size: 12, bold: false, italic: false, align: "left", attach: null },
        ],
      }),
      2,
      1,
      "blank",
      "en",
      [fills]
    );
    expect(html).not.toContain(">{item}<");
    expect(html).not.toContain(">Bud<");
    expect(UNKNOWN_WARNING).toContain("print blank");
  });

  it("logs a run once", async () => {
    const runs: Array<{ sql: string; args: unknown[] }> = [];
    const db = {
      prepare(sql: string) {
        const args: unknown[] = [];
        return {
          bind(...next: unknown[]) {
            args.push(...next);
            return this;
          },
          async run() {
            runs.push({ sql, args });
            return { success: true };
          },
        };
      },
    };
    await logPrintRun(db as unknown as D1Database, {
      id: "run-1",
      templateId: "tpl-1",
      templateName: "smoke tag",
      firstId: GOOD,
      roll: true,
      containerQty: 3,
      labelsPer: 2,
      actorId: "person-1",
      printedAt: "2026-10-04T14:00:00.000Z",
      unknownIds: ["1A40503000311FB000000124", "1A40503000311FB000000125"],
    });
    expect(runs).toHaveLength(1);
    expect(runs[0].sql).toContain("INSERT INTO label_print_runs");
    expect(runs[0].args).toContain(GOOD);
    expect(runs[0].args).toContain(1);
    expect(runs[0].args).toContain('["1A40503000311FB000000124","1A40503000311FB000000125"]');
  });

  it("speaks the screen in Spanish and a reprint refills the form", () => {
    const href = quickPrintHref({
      templateId: "tpl-1",
      templateName: "smoke tag",
      packageId: GOOD,
      roll: "yes",
      containerQty: "3",
      labelsPer: "2",
    });
    expect(href).toContain(`package=${GOOD}`);
    expect(href).toContain("roll=yes");
    expect(href).toContain("containers=3");
    expect(href).toContain("per=2");
    const page = quickPrintPage(
      "es",
      [{ id: "tpl-1", name: "smoke tag" }],
      [
        {
          id: "run-1",
          template_id: "tpl-1",
          template_name: "smoke tag",
          first_id: GOOD,
          roll: 1,
          container_qty: 3,
          labels_per_container: 2,
          actor_name: "Smoke",
          printed_at: "2026-10-04T14:00:00.000Z",
          unknown_ids_json: "[]",
        },
      ],
      { templateId: "tpl-1", templateName: "smoke tag", packageId: GOOD, roll: "yes", containerQty: "3", labelsPer: "2" }
    );
    expect(page).toContain("Impresion rapida");
    expect(page).toContain("ID de paquete");
    expect(page).toContain("Rodar el ID al imprimir");
    expect(page).toContain("Cantidad de contenedores");
    expect(page).toContain("Etiquetas por contenedor");
    expect(page).toContain("Reimprimir");
    expect(page).toContain(`value="${GOOD}"`);
    expect(page).toContain('value="yes" selected');
    expect(t("es", PACKAGE_ID_REFUSAL)).toContain("24 caracteres");
    expect(t("es", ROLL_PIN)).toContain("PIN de Admin");
    expect(t("es", QTY_REFUSAL)).toContain("1 a 500");
    expect(t("es", PER_REFUSAL)).toContain("1 a 50");
    expect(t("es", ROLL_OVERFLOW)).toContain("cola numerica");
    expect(t("es", UNKNOWN_WARNING)).toContain("en blanco");
  });
});
