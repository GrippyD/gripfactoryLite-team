import { describe, expect, it } from "vitest";
import { t } from "../src/i18n";
import { labelLayoutPrintHtml, normalizeLayout } from "../src/labeleditor";
import {
  anchorTargets,
  dragJoint,
  fractionOf,
  handlePoints,
  labelGeomSource,
  moveSnap,
  objectJoints,
  pageOf,
  resizeByPointer,
  resizeSnapped,
  shapeSvg,
  trianglePts,
  vertexSnap,
} from "../src/labelgeom";

function close(a: number, b: number) {
  expect(a).toBeCloseTo(b, 6);
}

function own(box: { x: number; y: number; w: number; h: number; rotate: number }, fx: number, fy: number): [number, number] {
  const c = Math.cos((box.rotate * Math.PI) / 180);
  const s = Math.sin((box.rotate * Math.PI) / 180);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = (fx - 0.5) * box.w;
  const dy = (fy - 0.5) * box.h;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

describe("shape geometry touches its box", () => {
  const ink = { stroke: 2, fill: "none" as const, ink: "black" as const };

  it("draws a rectangle, a rounded rectangle, and an ellipse to the box", () => {
    const rect = shapeSvg({ ...ink, shape: "rect" });
    expect(rect).toContain('x="0"');
    expect(rect).toContain('y="0"');
    expect(rect).toContain('width="100"');
    expect(rect).toContain('height="100"');
    expect(rect).not.toContain('width="96"');
    expect(rect).toContain('overflow="hidden"');
    const round = shapeSvg({ ...ink, shape: "roundrect" });
    expect(round).toContain('x="0"');
    expect(round).toContain('width="100"');
    expect(round).toContain('height="100"');
    expect(round).toContain('rx="14"');
    const ellipse = shapeSvg({ ...ink, shape: "ellipse" });
    expect(ellipse).toContain('cx="50"');
    expect(ellipse).toContain('cy="50"');
    expect(ellipse).toContain('rx="50"');
    expect(ellipse).toContain('ry="50"');
  });

  it("draws a new triangle on the box and an old triangle as today's points", () => {
    const fresh = shapeSvg({ ...ink, shape: "triangle", pts: [[0.5, 0], [1, 1], [0, 1]] });
    expect(fresh).toContain('points="50,0 100,100 0,100"');
    const old = shapeSvg({ ...ink, shape: "triangle" });
    expect(old).toContain('points="50,4 96,96 4,96"');
    expect(trianglePts({})).toEqual([
      [0.5, 0.04],
      [0.96, 0.96],
      [0.04, 0.96],
    ]);
  });
});

describe("eight handles", () => {
  it("sits on the corners and side midpoints at 0, 30, and 90 degrees", () => {
    const flat = { x: 1, y: 2, w: 4, h: 2, rotate: 0 };
    const at0 = Object.fromEntries(handlePoints(flat).map((p) => [p.handle, p]));
    expect(at0.nw).toMatchObject({ x: 1, y: 2 });
    expect(at0.n).toMatchObject({ x: 3, y: 2 });
    expect(at0.ne).toMatchObject({ x: 5, y: 2 });
    expect(at0.e).toMatchObject({ x: 5, y: 3 });
    expect(at0.se).toMatchObject({ x: 5, y: 4 });
    expect(at0.s).toMatchObject({ x: 3, y: 4 });
    expect(at0.sw).toMatchObject({ x: 1, y: 4 });
    expect(at0.w).toMatchObject({ x: 1, y: 3 });

    const turned = { x: 0, y: 0, w: 2, h: 2, rotate: 90 };
    const at90 = Object.fromEntries(handlePoints(turned).map((p) => [p.handle, p]));
    close(at90.nw.x, 2); close(at90.nw.y, 0);
    close(at90.n.x, 2); close(at90.n.y, 1);
    close(at90.ne.x, 2); close(at90.ne.y, 2);
    close(at90.e.x, 1); close(at90.e.y, 2);
    close(at90.se.x, 0); close(at90.se.y, 2);
    close(at90.s.x, 0); close(at90.s.y, 1);
    close(at90.sw.x, 0); close(at90.sw.y, 0);
    close(at90.w.x, 1); close(at90.w.y, 0);

    const tilt = { x: 0.5, y: 1, w: 2, h: 1, rotate: 30 };
    const at30 = Object.fromEntries(handlePoints(tilt).map((p) => [p.handle, p]));
    for (const [handle, fx, fy] of [
      ["nw", 0, 0],
      ["n", 0.5, 0],
      ["ne", 1, 0],
      ["e", 1, 0.5],
      ["se", 1, 1],
      ["s", 0.5, 1],
      ["sw", 0, 1],
      ["w", 0, 0.5],
    ] as const) {
      const expected = own(tilt, fx, fy);
      close(at30[handle].x, expected[0]);
      close(at30[handle].y, expected[1]);
    }
    close(at30.n.x, (at30.nw.x + at30.ne.x) / 2);
    close(at30.n.y, (at30.nw.y + at30.ne.y) / 2);
    close(at30.e.x, (at30.ne.x + at30.se.x) / 2);
    close(at30.e.y, (at30.ne.y + at30.se.y) / 2);
  });

  it("holds the opposite corner on a corner drag and the opposite side on a side drag", () => {
    const src = { x: 1, y: 2, w: 3, h: 1, rotate: 0 };
    const se = resizeByPointer(src, "se", 0.5, 0.25);
    expect(se).toMatchObject({ x: 1, y: 2, w: 3.5, h: 1.25, rotate: 0 });
    const west = resizeByPointer(src, "w", -0.5, 0.4);
    close(west.x, 0.5);
    close(west.y, 2);
    close(west.w, 3.5);
    close(west.h, 1);
    const north = resizeByPointer(src, "n", 0.3, -0.25);
    close(north.x, 1);
    close(north.h, 1.25);
    close(north.y, 1.75);
    close(north.w, 3);

    for (const rotate of [30, 90]) {
      const turned = { x: 0.25, y: 0.5, w: 2, h: 1.5, rotate };
      for (const handle of ["nw", "ne", "se", "sw"] as const) {
        const next = resizeByPointer(turned, handle, 0.35, -0.2);
        const opp = { nw: [1, 1], ne: [0, 1], se: [0, 0], sw: [1, 0] }[handle];
        const before = own(turned, opp[0], opp[1]);
        const after = own(next, opp[0], opp[1]);
        close(after[0], before[0]);
        close(after[1], before[1]);
        expect(Math.hypot(next.w - turned.w, next.h - turned.h)).toBeGreaterThan(0.05);
      }
      const side = resizeByPointer(turned, "e", 0.4, 0.15);
      close(own(side, 0, 0)[0], own(turned, 0, 0)[0]);
      close(own(side, 0, 0)[1], own(turned, 0, 0)[1]);
      close(own(side, 0, 1)[0], own(turned, 0, 1)[0]);
      close(own(side, 0, 1)[1], own(turned, 0, 1)[1]);
      close(side.h, turned.h);
      const top = resizeByPointer(turned, "n", 0.2, -0.3);
      close(own(top, 0, 1)[0], own(turned, 0, 1)[0]);
      close(own(top, 0, 1)[1], own(turned, 0, 1)[1]);
      close(own(top, 1, 1)[0], own(turned, 1, 1)[0]);
      close(own(top, 1, 1)[1], own(turned, 1, 1)[1]);
      close(top.w, turned.w);
    }

    const tiny = resizeByPointer({ x: 0, y: 0, w: 1, h: 1, rotate: 0 }, "se", -5, -5);
    expect(tiny.w).toBe(0.125);
    expect(tiny.h).toBe(0.125);
    close(tiny.x, 0);
    close(tiny.y, 0);
  });
});

describe("triangle joints", () => {
  it("moves one joint, round-trips pts, scales them on resize, and reads an old triangle as today's", () => {
    const layout = normalizeLayout({
      v: 1,
      objects: [
        {
          id: "s1",
          type: "shape",
          shape: "triangle",
          x: 1,
          y: 1,
          w: 2,
          h: 1,
          rotate: 0,
          stroke: 2,
          fill: "none",
          pts: [[0.2, 0.3], [0.8, 0.9], [0.1, 1]],
        },
      ],
    });
    const again = normalizeLayout(JSON.parse(JSON.stringify(layout)));
    expect(again).toEqual(layout);
    const shape = again.objects[0];
    expect(shape).toMatchObject({ pts: [[0.2, 0.3], [0.8, 0.9], [0.1, 1]] });

    const old = normalizeLayout({
      v: 1,
      objects: [{ id: "old", type: "shape", shape: "triangle", x: 0, y: 0, w: 1, h: 1, rotate: 0, stroke: 2, fill: "none" }],
    });
    const oldShape = old.objects[0];
    expect(oldShape.type === "shape" && oldShape.pts).toBeFalsy();
    expect(shapeSvg(oldShape.type === "shape" ? oldShape : { shape: "triangle" })).toContain('points="50,4 96,96 4,96"');

    const box = { x: 1, y: 1, w: 2, h: 1, rotate: 0 };
    const pts: [number, number][] = [[0.5, 0], [1, 1], [0, 1]];
    const target = pageOf(box, 0.25, 0.4);
    const moved = fractionOf(box, target[0], target[1]);
    expect(moved[0]).toBeCloseTo(0.25, 6);
    expect(moved[1]).toBeCloseTo(0.4, 6);
    const kept: [number, number][] = [[moved[0], moved[1]], pts[1], pts[2]];
    expect(kept[1]).toEqual(pts[1]);
    expect(kept[2]).toEqual(pts[2]);

    const grown = resizeByPointer({ ...box, rotate: 0 }, "se", 2, 0);
    close(grown.w, 4);
    close(grown.x, 1);
    const before = pageOf(box, 0.5, 0);
    const after = pageOf({ ...grown, rotate: 0 }, 0.5, 0);
    close(after[0] - grown.x, (before[0] - box.x) * 2);
    close(after[1], before[1]);
  });
});

describe("soft snap", () => {
  const tol = 0.1;

  it("levels a joint to a neighbor and squares a corner within tolerance, not past it", () => {
    const prev: [number, number] = [0, 0];
    const next: [number, number] = [2, 0];
    const level = vertexSnap(prev, next, 0.05, 1, tol);
    close(level.x, 0);
    close(level.y, 1);
    expect(level.guide?.kind).toBe("axis");

    const past = vertexSnap(prev, next, 0.2, 1, tol);
    close(past.x, 0.2);
    close(past.y, 1);
    expect(past.guide).toBeNull();

    const square = vertexSnap(prev, next, 1, 1.05, tol);
    close(square.x, 1);
    close(square.y, 1);
    expect(square.guide?.kind).toBe("ninety");

    const pastSquare = vertexSnap(prev, next, 1, 1.2, tol);
    expect(pastSquare.guide).toBeNull();

    const axisFirst = vertexSnap(prev, next, 0.05, 1.05, tol);
    close(axisFirst.x, 0);
    expect(axisFirst.guide?.kind).toBe("axis");
  });

  it("locks both axes, aligns one, wins over the grid, and Alt turns it off", () => {
    const joints = (x: number, y: number): [number, number][] => [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
    ];
    const both = moveSnap(0.1, 0.4, joints(0.1, 0.4), [[0.1, 0.42]], tol, false, false);
    close(both.x, 0.1);
    close(both.y, 0.42);
    expect(both.guides?.[0].kind).toBe("lock");

    const one = moveSnap(0.1, 0.4, joints(0.1, 0.4), [[0.1, 5]], tol, false, false);
    close(one.x, 0.1);
    close(one.y, 0.4);
    expect(one.guides?.map((g) => g.kind)).toEqual(["vline"]);

    const grid = moveSnap(0.1, 0.4, joints(0.1, 0.4), [[9, 9]], tol, false, false);
    close(grid.x, 0.125);
    close(grid.y, 0.375);
    expect(grid.guides).toBeNull();

    const alt = moveSnap(0.1, 0.4, joints(0.1, 0.4), [[0.1, 0.42]], tol, true, false);
    close(alt.x, 0.1);
    close(alt.y, 0.4);
    expect(alt.guides).toBeNull();

    const shiftStillLocks = moveSnap(0.1, 0.4, joints(0.1, 0.4), [[0.1, 0.42]], tol, false, true);
    close(shiftStillLocks.y, 0.42);
    expect(shiftStillLocks.guides?.[0].kind).toBe("lock");
  });

  it("snaps a dragged joint onto another object's corner, ahead of the grid", () => {
    const rect = { id: "r", type: "shape", shape: "rect", x: 1, y: 1, w: 1, h: 1, rotate: 0 };
    const tri = { id: "t", type: "shape", shape: "triangle", x: 2.5, y: 1.5, w: 1, h: 1, rotate: 0, pts: [[0.5, 0], [1, 1], [0, 1]] as [number, number][] };
    const others = anchorTargets([rect, tri], "t", 4, 6);
    const near = dragJoint(2.04, 1.03, pageOf(tri, 1, 1), pageOf(tri, 0, 1), others, 0.1, false, false);
    const corner = objectJoints(rect)[1];
    expect(Math.hypot(near.x - corner[0], near.y - corner[1])).toBeLessThan(0.02);
    expect(near.guides?.[0].kind).toBe("lock");
    const frac = fractionOf(tri, near.x, near.y);
    expect(frac[0]).toBeCloseTo(-0.5, 5);
    expect(frac[1]).toBeCloseTo(-0.5, 5);
  });

  it("snaps a handle onto a joint and still holds the opposite corner", () => {
    const src = { x: 0, y: 0, w: 1, h: 1, rotate: 0 };
    const snapped = resizeSnapped(src, "se", 0.2, 0.05, [[1.2, 1]], 0.1, false, false);
    close(snapped.box.x, 0);
    close(snapped.box.y, 0);
    close(snapped.box.w, 1.2);
    close(snapped.box.h, 1);
    expect(snapped.guides?.some((g) => g.kind === "lock")).toBe(true);
    const plain = resizeSnapped(src, "se", 0.1, 0.1, [], 0.05, false, false);
    close(plain.box.w, 1.125);
    close(plain.box.h, 1.125);
    close(plain.box.x, 0);
    const alt = resizeSnapped(src, "se", 0.1, 0.1, [[1.2, 1.2]], 0.2, true, false);
    close(alt.box.w, 1.1);
    close(alt.box.h, 1.1);
    expect(alt.guides).toBeNull();
    const side = resizeSnapped(src, "e", 0.08, 0.4, [[1.1, 2]], 0.1, false, false);
    close(side.box.w, 1.1);
    close(side.box.h, 1);
    close(side.box.x, 0);
    close(side.box.y, 0);
    expect(side.guides?.[0].kind).toBe("axis");
  });
});

describe("the client runs the same geometry", () => {
  it("matches a resize and a neighbor snap", () => {
    const client = new Function(`return ${labelGeomSource()}`)() as {
      resizeByPointer: typeof resizeByPointer;
      vertexSnap: typeof vertexSnap;
    };
    const src = { x: 1, y: 2, w: 3, h: 1, rotate: 30 };
    expect(client.resizeByPointer(src, "se", 0.4, -0.2)).toEqual(resizeByPointer(src, "se", 0.4, -0.2));
    expect(client.vertexSnap([0, 0], [2, 0], 1, 1.05, 0.1)).toEqual(vertexSnap([0, 0], [2, 0], 1, 1.05, 0.1));
    expect(labelGeomSource()).toContain("function createLabelGeom");
  });
});

describe("print uses the same geometry", () => {
  it("prints an old triangle inset and a new one on the box", () => {
    const layout = normalizeLayout({
      v: 1,
      objects: [
        { id: "r", type: "shape", shape: "rect", x: 0.5, y: 1, w: 1, h: 1, rotate: 0, stroke: 2, fill: "none" },
        { id: "old", type: "shape", shape: "triangle", x: 0.5, y: 2, w: 1, h: 1, rotate: 0, stroke: 2, fill: "none" },
        { id: "nw", type: "shape", shape: "triangle", x: 2, y: 2, w: 1, h: 1, rotate: 0, stroke: 2, fill: "none", pts: [[0.5, 0], [1, 1], [0, 1]] },
      ],
    });
    const html = labelLayoutPrintHtml(layout, 4, 6, "anchor");
    expect(html).toContain('x="0" y="0" width="100" height="100"');
    expect(html).not.toContain('width="96"');
    expect(html).toContain('points="50,4 96,96 4,96"');
    expect(html).toContain('points="50,0 100,100 0,100"');
    expect(t("es", "Resize")).toBe("Cambiar tamano");
    expect(t("es", "Joint")).toBe("Nudo");
    expect(t("en", "Resize")).toBe("Resize");
  });
});
