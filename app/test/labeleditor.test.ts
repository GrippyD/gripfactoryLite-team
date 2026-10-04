import { describe, expect, it } from "vitest";
import { labelsMenuPage, labelsSoonPage } from "../src/labels";
import { code128Svg } from "../src/code128";
import { t } from "../src/i18n";
import { qrSvg } from "../src/qr";
import {
  PICTURE_MAX_BYTES,
  bringToFront,
  formulaSaveProblem,
  inchesToMm,
  labelEditorPage,
  labelLayoutPrintHtml,
  normalizeLayout,
  parseLabelInches,
  resolveData,
  sendToBack,
  stockToInches,
  wouldCycle,
} from "../src/labeleditor";

const sample = {
  v: 1 as const,
  objects: [
    {
      id: "t1",
      type: "text" as const,
      x: 0.5,
      y: 0.25,
      w: 2,
      h: 0.4,
      rotate: 15,
      text: "Hello",
      font: "Georgia",
      size: 18,
      bold: true,
      italic: true,
      align: "center" as const,
      attach: null,
    },
    {
      id: "m1",
      type: "memo" as const,
      x: 0.125,
      y: 1,
      w: 2,
      h: 1,
      rotate: 3,
      text: "Line one",
      memo: "alphanumeric" as const,
      font: "Courier New" as const,
      size: 11,
      bold: false,
      italic: false,
      align: "left" as const,
      attach: "t1",
    },
    {
      id: "b1",
      type: "barcode" as const,
      x: 0.5,
      y: 2,
      w: 2.5,
      h: 0.8,
      rotate: 90,
      data: "12345678",
      caption: true,
      attach: "t1",
    },
    {
      id: "q1",
      type: "qr" as const,
      x: 3,
      y: 0.5,
      w: 1,
      h: 1,
      rotate: 180,
      data: "QR",
      caption: false,
      attach: null,
    },
    {
      id: "p1",
      type: "picture" as const,
      x: 1,
      y: 3,
      w: 1.5,
      h: 1,
      rotate: 270,
      mime: "image/png" as const,
      filename: "mark.png",
      bytes: "cG5n",
    },
    {
      id: "s1",
      type: "shape" as const,
      shape: "triangle" as const,
      x: 0.5,
      y: 4,
      w: 1,
      h: 1,
      rotate: 33,
      stroke: 3,
      fill: "black" as const,
    },
    {
      id: "l1",
      type: "line" as const,
      x1: 0.5,
      y1: 5,
      x2: 3.25,
      y2: 5.5,
      thickness: 2.5,
      dashes: "dashed" as const,
    },
  ],
};

describe("label editor layout", () => {
  it("round-trips every object type with its properties", () => {
    const layout = normalizeLayout(sample);
    const again = normalizeLayout(JSON.parse(JSON.stringify(layout)));
    expect(again).toEqual(layout);
    expect(layout.objects.map((obj) => obj.type)).toEqual(["text", "memo", "barcode", "qr", "picture", "shape", "line"]);
    const text = layout.objects[0];
    expect(text).toMatchObject({ font: "Georgia", size: 18, bold: true, italic: true, align: "center", rotate: 15 });
    const memo = layout.objects[1];
    expect(memo).toMatchObject({ memo: "alphanumeric", attach: "t1", font: "Courier New" });
    const code = layout.objects[2];
    expect(code).toMatchObject({ type: "barcode", rotate: 90, caption: true, attach: "t1" });
    const picture = layout.objects[4];
    expect(picture).toMatchObject({ type: "picture", mime: "image/png", rotate: 270, bytes: "cG5n" });
    const shape = layout.objects[5];
    expect(shape).toMatchObject({ shape: "triangle", fill: "black", stroke: 3, rotate: 33 });
    const line = layout.objects[6];
    expect(line).toMatchObject({ x1: 0.5, y1: 5, x2: 3.25, y2: 5.5, dashes: "dashed", thickness: 2.5 });
  });

  it("keeps millimeters equal to the inches", () => {
    expect(inchesToMm(4)).toBe(101.6);
    expect(inchesToMm(6)).toBe(152.4);
    expect(inchesToMm(2)).toBe(50.8);
    expect(inchesToMm(1)).toBe(25.4);
    expect(parseLabelInches("4.256")).toBe(4.26);
    expect(() => parseLabelInches("0.49")).toThrow(/0\.5 to 12/);
    expect(stockToInches("4x6", "4 x 6 in")).toEqual({ lengthIn: 4, widthIn: 6 });
    expect(stockToInches("2x1", "2 x 1 in")).toEqual({ lengthIn: 2, widthIn: 1 });
  });

  it("resolves attach through one hop and two, and refuses a cycle", () => {
    const objects = normalizeLayout({
      v: 1,
      objects: [
        { id: "c1", type: "text", x: 0, y: 0, w: 1, h: 0.4, rotate: 0, text: "from-c", font: "Arial", size: 12, bold: false, italic: false, align: "left", attach: null },
        { id: "b1", type: "barcode", x: 0, y: 1, w: 1, h: 0.5, rotate: 0, data: "999", caption: false, attach: "c1" },
        { id: "a1", type: "text", x: 0, y: 2, w: 1, h: 0.4, rotate: 0, text: "own", font: "Arial", size: 12, bold: false, italic: false, align: "left", attach: "b1" },
      ],
    }).objects;
    expect(resolveData(objects, "b1").text).toBe("from-c");
    expect(resolveData(objects, "a1").text).toBe("from-c");
    expect(wouldCycle(objects, "c1", "a1")).toBe(true);
    expect(wouldCycle(objects, "a1", "c1")).toBe(false);
    const cycled = objects.map((obj) => (obj.id === "c1" && obj.type === "text" ? { ...obj, attach: "a1" } : obj));
    expect(() => normalizeLayout({ v: 1, objects: cycled })).toThrow(/circle/);
  });

  it("refuses a picture over 1 MB", () => {
    const bytes = "A".repeat(Math.ceil((PICTURE_MAX_BYTES + 1) / 3) * 4);
    expect(() =>
      normalizeLayout({
        v: 1,
        objects: [
          { id: "p1", type: "picture", x: 0, y: 0, w: 1, h: 1, rotate: 0, mime: "image/jpeg", filename: "big.jpg", bytes },
        ],
      })
    ).toThrow(/1 MB/);
  });

  it("prints the page at the label size with every object in inches", () => {
    const layout = normalizeLayout(sample);
    const html = labelLayoutPrintHtml(layout, 4, 6, "smoke tag");
    expect(html).toContain("@page { size: 4in 6in; margin: 0; }");
    expect(html).toContain("left:0.5in;top:0.25in;width:2in;height:0.4in");
    expect(html).toContain("left:3in;top:0.5in;width:1in;height:1in");
    expect(html).toContain('x1="0.5" y1="5" x2="3.25" y2="5.5"');
    expect(html).toContain('class="code128"');
    expect(html).toContain('class="qrcode"');
    expect(html).toContain(">Hello<");
    expect(html).not.toContain("12345678");
  });

  it("shows the three menu buttons and drops the old view", () => {
    const menu = labelsMenuPage("en");
    expect(menu).toContain('data-labels="quick-print"');
    expect(menu).toContain('data-labels="editor"');
    expect(menu).toContain('data-labels="data"');
    expect(menu).not.toContain('name="package"');
    expect(menu).not.toContain('name="field"');
    expect(menu).not.toContain("Print preview");
    expect(menu).toContain('href="/compliance/labels/print"');
    expect(menu).not.toContain("/compliance/labels/quick-print");
    const es = labelsMenuPage("es");
    expect(es).toContain("Impresion rapida");
    expect(es).toContain("Editor de etiquetas");
    expect(es).toContain("Datos de etiqueta");
    expect(labelsSoonPage("es")).toContain("Viene en los siguientes cortes");
    const editor = labelEditorPage({
      locale: "en",
      templates: [],
      stocks: [{ value: "4x6", label: "4 x 6 in" }],
      loaded: null,
    });
    expect(editor).toContain("Connections");
    expect(editor).toContain("Source Data");
    expect(editor).toContain("Coming in the next slice");
    expect(editor).toContain('data-le-count="0"');
    expect(editor).not.toContain('name="package"');
  });
});

function box(type: "text" | "memo" | "barcode" | "qr", id: string, extra: Record<string, unknown>) {
  return {
    id,
    type,
    x: 0.25,
    y: 0.25,
    w: 1.5,
    h: 0.6,
    rotate: 0,
    attach: null,
    font: "Arial",
    size: 12,
    bold: false,
    italic: false,
    align: "left",
    text: "Hi",
    memo: "text",
    data: "12345678",
    caption: false,
    ...extra,
  };
}

describe("label ink, fill, and formulas on the page", () => {
  it("round-trips ink and fill, and an old layout reads black and none", () => {
    const old = normalizeLayout({
      v: 1,
      objects: [box("text", "t1", { text: "Hi" }), box("memo", "m1", { text: "Note" }), box("barcode", "b1", {}), box("qr", "q1", { data: "QR" })],
    });
    for (const obj of old.objects) {
      if (obj.type === "line" || obj.type === "picture" || obj.type === "shape") continue;
      expect(obj.ink).toBe("black");
      expect(obj.fill).toBe("none");
    }
    const painted = normalizeLayout({
      v: 1,
      objects: [
        box("text", "t1", { ink: "white", fill: "black" }),
        box("memo", "m1", { ink: "white", fill: "white" }),
        box("barcode", "b1", { ink: "white", fill: "black" }),
        box("qr", "q1", { data: "QR", ink: "black", fill: "white" }),
        { id: "s1", type: "shape", shape: "rect", x: 0, y: 1, w: 1, h: 1, rotate: 0, stroke: 2, fill: "white", ink: "white" },
      ],
    });
    const again = normalizeLayout(JSON.parse(JSON.stringify(painted)));
    expect(again).toEqual(painted);
    expect(again.objects[0]).toMatchObject({ ink: "white", fill: "black" });
    expect(again.objects[4]).toMatchObject({ type: "shape", fill: "white", ink: "white" });
  });

  it("refuses a broken formula by name, and white ink with no fill on a code", () => {
    const broken = normalizeLayout({ v: 1, objects: [box("text", "t1", { text: "=RIGHT({nope},6)" })] });
    const problem = formulaSaveProblem(broken);
    expect(problem?.key).toContain("text box");
    expect(problem?.vars.name).toBe("nope");
    expect(t("es", problem?.key ?? "")).toContain("caja de texto");
    const bare = normalizeLayout({ v: 1, objects: [box("barcode", "b1", { ink: "white", fill: "none" })] });
    expect(formulaSaveProblem(bare)?.key).toContain("needs a fill");
    expect(t("es", formulaSaveProblem(bare)?.key ?? "")).toContain("relleno");
    const filled = normalizeLayout({ v: 1, objects: [box("barcode", "b1", { ink: "white", fill: "black", data: "=RIGHT({package_tag},6)" })] });
    expect(formulaSaveProblem(filled)).toBeNull();
  });

  it("prints the fill, the ink, and exact colors, and encodes a formula result", () => {
    const tag = "1A40503000311FB000000111";
    const layout = normalizeLayout({
      v: 1,
      objects: [
        { id: "s1", type: "shape", shape: "rect", x: 0.2, y: 0.2, w: 3, h: 2, rotate: 0, stroke: 1, fill: "black", ink: "white" },
        box("text", "t1", { text: `=RIGHT({package_tag},6)`, ink: "white", fill: "black" }),
        box("barcode", "b1", { data: `=TEXT({packaged_date},"MM/DD/YY")`, caption: true, ink: "white", fill: "black" }),
        box("qr", "q1", { data: "own", attach: "t1", caption: true, ink: "white", fill: "black" }),
      ],
    });
    const html = labelLayoutPrintHtml(layout, 4, 6, "ink", "en", { package_tag: tag, packaged_date: "2026-09-24" });
    expect(html).toContain("print-color-adjust: exact");
    expect(html).toContain("background:#000");
    expect(html).toContain("color:#fff");
    expect(html).toContain(">000111<");
    expect(html).toContain(">09/24/26<");
    expect(html).not.toContain("=RIGHT");
    expect(html).not.toContain("=TEXT");
    const bars = code128Svg("09/24/26", 48, "#fff");
    const qr = qrSvg("000111", 3, "#fff");
    expect(html).toContain(bars);
    expect(html).toContain(qr);
    expect(bars).toContain('fill="#fff"');
    const width = Number(bars.match(/viewBox="0 0 (\d+)/)?.[1]);
    const xs = [...bars.matchAll(/<rect x="(\d+)"/g)].map((match) => Number(match[1]));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...[...bars.matchAll(/<rect x="(\d+)" y="0" width="(\d+)"/g)].map((match) => Number(match[1]) + Number(match[2])))).toBeLessThanOrEqual(width - 20);
    const qrDim = Number(qr.match(/viewBox="0 0 (\d+)/)?.[1]);
    const qrRects = [...qr.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)"/g)].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
      w: Number(match[3]),
    }));
    expect(Math.min(...qrRects.map((rect) => rect.x))).toBeGreaterThanOrEqual(12);
    expect(Math.min(...qrRects.map((rect) => rect.y))).toBeGreaterThanOrEqual(12);
    expect(Math.max(...qrRects.map((rect) => rect.x + rect.w))).toBeLessThanOrEqual(qrDim - 12);
    expect(Math.max(...qrRects.map((rect) => rect.y + rect.w))).toBeLessThanOrEqual(qrDim - 12);
  });

  it("brings an object to the front and sends it to the back, and the order saves", () => {
    const layout = normalizeLayout(sample);
    const front = bringToFront(layout.objects, "t1");
    expect(front[front.length - 1].id).toBe("t1");
    const saved = normalizeLayout({ v: 1, objects: front });
    expect(saved.objects[saved.objects.length - 1].id).toBe("t1");
    const back = sendToBack(saved.objects, "t1");
    expect(back[0].id).toBe("t1");
    expect(normalizeLayout({ v: 1, objects: back }).objects[0].id).toBe("t1");
  });

  it("shows a formula, its help, and an error on the editor", () => {
    const page = labelEditorPage({
      locale: "en",
      templates: [],
      stocks: [],
      loaded: {
        id: "bad",
        name: "Bad",
        length_in: 4,
        width_in: 6,
        layout_json: JSON.stringify({ v: 1, objects: [box("text", "t1", { text: "=RIGHT({nope},6)" })] }),
      },
    });
    expect(page).toContain("#ERROR");
    expect(page).toContain("=RIGHT({package_tag},6)");
    expect(page).toContain("function createFormulaEngine");
    expect(page).toContain("Bring to front");
    const es = labelEditorPage({ locale: "es", templates: [], stocks: [], loaded: null });
    expect(es).toContain("Tinta");
    expect(es).toContain("Traer al frente");
    expect(es).toContain("La formula nombra un campo");
  });
});
