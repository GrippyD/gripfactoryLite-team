import { describe, expect, it } from "vitest";
import { labelsMenuPage, labelsSoonPage } from "../src/labels";
import {
  PICTURE_MAX_BYTES,
  inchesToMm,
  labelEditorPage,
  labelLayoutPrintHtml,
  normalizeLayout,
  parseLabelInches,
  resolveData,
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
