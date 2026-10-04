/**
 * L5 ANCHORS (canon 0.30.402).
 * The label's boxes, handles, joints, and soft snap. The behavior follows the
 * Harvest Console farm editor (eight handles on the box, polygon joints as
 * fractions, a neighbor snap, a joint lock) in this app's inches and rotation.
 * One engine serves print, the editor's server render, and the editor's client
 * (the client runs this function's own source).
 */

export type Pt = [number, number];

export type Guide =
  | { kind: "lock"; x: number; y: number }
  | { kind: "vline"; x: number; y1: number; y2: number }
  | { kind: "hline"; y: number; x1: number; x2: number }
  | { kind: "axis"; lines: number[][] }
  | { kind: "ninety"; lines: number[][] };

export function createLabelGeom() {
  const MIN = 0.125;
  const LEGACY_TRIANGLE: Pt[] = [
    [0.5, 0.04],
    [0.96, 0.96],
    [0.04, 0.96],
  ];
  const NEW_TRIANGLE: Pt[] = [
    [0.5, 0],
    [1, 1],
    [0, 1],
  ];
  const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const LOCAL: Record<string, Pt> = {
    nw: [0, 0],
    n: [0.5, 0],
    ne: [1, 0],
    e: [1, 0.5],
    se: [1, 1],
    s: [0.5, 1],
    sw: [0, 1],
    w: [0, 0.5],
  };
  const OPP: Record<string, string> = {
    nw: "se",
    n: "s",
    ne: "sw",
    e: "w",
    se: "nw",
    s: "n",
    sw: "ne",
    w: "e",
  };
  const COINCIDE = 0.01;

  function rad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  function fine(n: number): number {
    return Math.round(n * 1000) / 1000;
  }

  function snap8(n: number): number {
    return Math.round(n * 8) / 8;
  }

  function fmt(n: number): string {
    const r = Math.round(n * 1000) / 1000;
    return String(Object.is(r, -0) ? 0 : r);
  }

  function copyPts(pts: Pt[]): Pt[] {
    return pts.map((p) => [p[0], p[1]]);
  }

  function pageOf(box: { x: number; y: number; w: number; h: number; rotate: number }, fx: number, fy: number): Pt {
    const c = Math.cos(rad(box.rotate || 0));
    const s = Math.sin(rad(box.rotate || 0));
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const dx = (fx - 0.5) * box.w;
    const dy = (fy - 0.5) * box.h;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  }

  function fractionOf(box: { x: number; y: number; w: number; h: number; rotate: number }, pageX: number, pageY: number): Pt {
    const c = Math.cos(rad(box.rotate || 0));
    const s = Math.sin(rad(box.rotate || 0));
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const dx = pageX - cx;
    const dy = pageY - cy;
    const lx = dx * c + dy * s;
    const ly = -dx * s + dy * c;
    const fx = box.w === 0 ? 0.5 : lx / box.w + 0.5;
    const fy = box.h === 0 ? 0.5 : ly / box.h + 0.5;
    return [fx, fy];
  }

  function trianglePts(obj: { pts?: Pt[] | null }): Pt[] {
    const raw = obj && obj.pts;
    if (raw && raw.length === 3) {
      const out: Pt[] = [];
      for (let i = 0; i < 3; i++) {
        const x = Number(raw[i][0]);
        const y = Number(raw[i][1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return copyPts(LEGACY_TRIANGLE);
        out.push([x, y]);
      }
      return out;
    }
    return copyPts(LEGACY_TRIANGLE);
  }

  function objectJoints(obj: {
    type?: string;
    shape?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    rotate?: number;
    pts?: Pt[];
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }): Pt[] {
    if (obj.type === "line") return [[Number(obj.x1), Number(obj.y1)], [Number(obj.x2), Number(obj.y2)]];
    const box = {
      x: Number(obj.x),
      y: Number(obj.y),
      w: Number(obj.w),
      h: Number(obj.h),
      rotate: Number(obj.rotate) || 0,
    };
    if (obj.type === "shape" && obj.shape === "triangle") {
      return trianglePts(obj).map((p) => pageOf(box, p[0], p[1]));
    }
    return [pageOf(box, 0, 0), pageOf(box, 1, 0), pageOf(box, 1, 1), pageOf(box, 0, 1)];
  }

  function labelCorners(lengthIn: number, widthIn: number): Pt[] {
    return [
      [0, 0],
      [lengthIn, 0],
      [lengthIn, widthIn],
      [0, widthIn],
    ];
  }

  function anchorTargets(
    objects: Array<{ id?: string; type?: string; shape?: string; pts?: Pt[] }>,
    skipId: string,
    lengthIn: number,
    widthIn: number
  ): Pt[] {
    const pts: Pt[] = [];
    for (const obj of objects) {
      if (obj.id === skipId) continue;
      for (const p of objectJoints(obj)) pts.push(p);
    }
    for (const p of labelCorners(lengthIn, widthIn)) pts.push(p);
    return pts;
  }

  function handlePoints(box: { x: number; y: number; w: number; h: number; rotate: number }): Array<{ handle: string; x: number; y: number }> {
    return HANDLES.map((handle) => {
      const f = LOCAL[handle];
      const p = pageOf(box, f[0], f[1]);
      return { handle, x: p[0], y: p[1] };
    });
  }

  function cursorFor(handle: string, deg: number): string {
    const cursors = ["ns-resize", "nesw-resize", "ew-resize", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize", "nwse-resize"];
    const base: Record<string, number> = { n: 0, ne: 1, e: 2, se: 3, s: 4, sw: 5, w: 6, nw: 7 };
    const steps = Math.round(((((deg % 360) + 360) % 360) / 45)) % 8;
    return cursors[(base[handle] + steps) % 8];
  }

  function shapeSvg(obj: { shape?: string; stroke?: number; fill?: string; ink?: string; pts?: Pt[] }): string {
    const fill = obj.fill === "black" ? "#000" : obj.fill === "white" ? "#fff" : "none";
    const strokeColor = obj.ink === "white" ? "#fff" : "#000";
    const width = Number(obj.stroke);
    const stroke = `stroke="${strokeColor}" stroke-width="${Number.isFinite(width) ? width : 2}" vector-effect="non-scaling-stroke" fill="${fill}"`;
    let body = `<rect x="0" y="0" width="100" height="100" ${stroke}/>`;
    if (obj.shape === "ellipse") body = `<ellipse cx="50" cy="50" rx="50" ry="50" ${stroke}/>`;
    else if (obj.shape === "roundrect") body = `<rect x="0" y="0" width="100" height="100" rx="14" ${stroke}/>`;
    else if (obj.shape === "triangle") {
      const points = trianglePts(obj)
        .map((p) => `${fmt(p[0] * 100)},${fmt(p[1] * 100)}`)
        .join(" ");
      body = `<polygon points="${points}" ${stroke}/>`;
    }
    return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none" overflow="hidden" style="overflow:hidden">${body}</svg>`;
  }

  function boxFromHeld(held: Pt, hfx: number, hfy: number, w: number, h: number, rotate: number) {
    const c = Math.cos(rad(rotate));
    const s = Math.sin(rad(rotate));
    const dx = (hfx - 0.5) * w;
    const dy = (hfy - 0.5) * h;
    const cx = held[0] - (dx * c - dy * s);
    const cy = held[1] - (dx * s + dy * c);
    return { x: cx - w / 2, y: cy - h / 2, w, h, rotate };
  }

  function boxBetween(
    src: { w: number; h: number; rotate: number },
    handle: string,
    held: Pt,
    target: Pt
  ) {
    const moving = LOCAL[handle];
    const heldF = LOCAL[OPP[handle]];
    const c = Math.cos(rad(src.rotate || 0));
    const s = Math.sin(rad(src.rotate || 0));
    const vx = target[0] - held[0];
    const vy = target[1] - held[1];
    const lx = vx * c + vy * s;
    const ly = -vx * s + vy * c;
    const dfx = moving[0] - heldF[0];
    const dfy = moving[1] - heldF[1];
    let w = src.w;
    let h = src.h;
    if (dfx !== 0) w = lx / dfx;
    if (dfy !== 0) h = ly / dfy;
    if (!(w >= MIN)) w = MIN;
    if (!(h >= MIN)) h = MIN;
    return boxFromHeld(held, heldF[0], heldF[1], w, h, src.rotate || 0);
  }

  function resizeByPointer(
    src: { x: number; y: number; w: number; h: number; rotate: number },
    handle: string,
    pageDx: number,
    pageDy: number
  ) {
    const moving = LOCAL[handle];
    const heldF = LOCAL[OPP[handle]];
    const held = pageOf(src, heldF[0], heldF[1]);
    const from = pageOf(src, moving[0], moving[1]);
    return boxBetween(src, handle, held, [from[0] + pageDx, from[1] + pageDy]);
  }

  function movingCorners(box: { x: number; y: number; w: number; h: number; rotate: number }, handle: string): Pt[] {
    const corners: Pt[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const out: Pt[] = [];
    for (const corner of corners) {
      const fx = corner[0];
      const fy = corner[1];
      let moves = false;
      if (handle === "n" || handle === "s") moves = handle === "n" ? fy === 0 : fy === 1;
      else if (handle === "e" || handle === "w") moves = handle === "e" ? fx === 1 : fx === 0;
      else {
        const opp = LOCAL[OPP[handle]];
        moves = !(fx === opp[0] && fy === opp[1]);
      }
      if (moves) out.push(pageOf(box, fx, fy));
    }
    return out;
  }

  function jointLock(mine: Pt[], others: Pt[], tol: number): { dx: number; dy: number; guides: Guide[] } | null {
    let bx: { a: number; d: number; tx: number; ty: number; mx: number; my: number } | null = null;
    let by: { a: number; d: number; tx: number; ty: number; mx: number; my: number } | null = null;
    for (const tv of others) {
      for (const mv of mine) {
        const adx = Math.abs(tv[0] - mv[0]);
        const ady = Math.abs(tv[1] - mv[1]);
        if (adx <= tol && (!bx || adx < bx.a)) bx = { a: adx, d: tv[0] - mv[0], tx: tv[0], ty: tv[1], mx: mv[0], my: mv[1] };
        if (ady <= tol && (!by || ady < by.a)) by = { a: ady, d: tv[1] - mv[1], tx: tv[0], ty: tv[1], mx: mv[0], my: mv[1] };
      }
    }
    if (!bx && !by) return null;
    const dx = bx ? bx.d : 0;
    const dy = by ? by.d : 0;
    const pad = tol * (12 / 9);
    let lockPt: Pt | null = null;
    if (bx && by) {
      for (const tv of others) {
        if (lockPt) break;
        for (const mv of mine) {
          if (Math.abs(tv[0] - (mv[0] + dx)) < COINCIDE && Math.abs(tv[1] - (mv[1] + dy)) < COINCIDE) {
            lockPt = [tv[0], tv[1]];
            break;
          }
        }
      }
    }
    const guides: Guide[] = [];
    if (lockPt) guides.push({ kind: "lock", x: lockPt[0], y: lockPt[1] });
    else {
      if (bx) {
        const myY = bx.my + dy;
        guides.push({ kind: "vline", x: bx.tx, y1: Math.min(bx.ty, myY) - pad, y2: Math.max(bx.ty, myY) + pad });
      }
      if (by) {
        const myX = by.mx + dx;
        guides.push({ kind: "hline", y: by.ty, x1: Math.min(by.tx, myX) - pad, x2: Math.max(by.tx, myX) + pad });
      }
    }
    return { dx, dy, guides };
  }

  function vertexSnap(prev: Pt, next: Pt, sx: number, sy: number, tol: number): { x: number; y: number; guide: Guide | null } {
    let x = sx;
    let y = sy;
    const cx = Math.abs(prev[0] - sx) <= Math.abs(next[0] - sx) ? prev[0] : next[0];
    const cy = Math.abs(prev[1] - sy) <= Math.abs(next[1] - sy) ? prev[1] : next[1];
    const ax = Math.abs(cx - sx) <= tol;
    const ay = Math.abs(cy - sy) <= tol;
    if (ax) x = cx;
    if (ay) y = cy;
    if (ax || ay) {
      const lines: number[][] = [];
      if (ax) {
        const na = Math.abs(prev[0] - x) < COINCIDE ? prev : next;
        lines.push([x, y, na[0], na[1]]);
      }
      if (ay) {
        const nb = Math.abs(prev[1] - y) < COINCIDE ? prev : next;
        lines.push([x, y, nb[0], nb[1]]);
      }
      return { x, y, guide: { kind: "axis", lines } };
    }
    const mx = (prev[0] + next[0]) / 2;
    const my = (prev[1] + next[1]) / 2;
    const r = Math.hypot(prev[0] - next[0], prev[1] - next[1]) / 2;
    const d = Math.hypot(sx - mx, sy - my);
    // The farm editor skips a degenerate diameter (r > 1 in its pixel world).
    // A label is in inches, so the same guard is a short side, 0.05 inch.
    if (r > 0.05 && d > 0.001 && Math.abs(d - r) <= tol) {
      x = mx + ((sx - mx) * r) / d;
      y = my + ((sy - my) * r) / d;
      return {
        x,
        y,
        guide: {
          kind: "ninety",
          lines: [
            [x, y, prev[0], prev[1]],
            [x, y, next[0], next[1]],
          ],
        },
      };
    }
    return { x: sx, y: sy, guide: null };
  }

  function moveSnap(
    rawX: number,
    rawY: number,
    joints: Pt[],
    others: Pt[],
    tol: number,
    alt: boolean,
    shift: boolean
  ): { x: number; y: number; guides: Guide[] | null } {
    if (alt) return { x: fine(rawX), y: fine(rawY), guides: null };
    const lock = jointLock(joints, others, tol);
    if (lock) return { x: rawX + lock.dx, y: rawY + lock.dy, guides: lock.guides };
    if (shift) return { x: fine(rawX), y: fine(rawY), guides: null };
    return { x: snap8(rawX), y: snap8(rawY), guides: null };
  }

  function dragJoint(
    pageX: number,
    pageY: number,
    prev: Pt | null,
    next: Pt | null,
    others: Pt[],
    tol: number,
    alt: boolean,
    shift: boolean
  ): { x: number; y: number; guides: Guide[] | null } {
    if (alt) return { x: fine(pageX), y: fine(pageY), guides: null };
    const lock = jointLock([[pageX, pageY]], others, tol);
    if (lock) return { x: pageX + lock.dx, y: pageY + lock.dy, guides: lock.guides };
    if (prev && next) {
      const snapped = vertexSnap(prev, next, pageX, pageY, tol);
      if (snapped.guide) return { x: snapped.x, y: snapped.y, guides: [snapped.guide] };
    }
    if (shift) return { x: fine(pageX), y: fine(pageY), guides: null };
    return { x: snap8(pageX), y: snap8(pageY), guides: null };
  }

  function resizeSnapped(
    src: { x: number; y: number; w: number; h: number; rotate: number },
    handle: string,
    pageDx: number,
    pageDy: number,
    others: Pt[],
    tol: number,
    alt: boolean,
    shift: boolean
  ): { box: { x: number; y: number; w: number; h: number; rotate: number }; guides: Guide[] | null } {
    const raw = resizeByPointer(src, handle, pageDx, pageDy);
    if (alt) return { box: raw, guides: null };
    const moving = LOCAL[handle];
    const heldF = LOCAL[OPP[handle]];
    const held = pageOf(src, heldF[0], heldF[1]);
    const from = pageOf(src, moving[0], moving[1]);
    const candidate = raw;
    const corner = handle.length === 2;
    if (corner) {
      const lock = jointLock(movingCorners(candidate, handle), others, tol);
      if (lock) {
        const box = boxBetween(src, handle, held, [from[0] + pageDx + lock.dx, from[1] + pageDy + lock.dy]);
        return { box, guides: lock.guides };
      }
    } else {
      const c = Math.cos(rad(src.rotate || 0));
      const s = Math.sin(rad(src.rotate || 0));
      const axis: Pt = handle === "e" || handle === "w" ? [c, s] : [-s, c];
      const mine = movingCorners(candidate, handle);
      let best: { a: number; d: number; tv: Pt; mv: Pt } | null = null;
      for (const tv of others) {
        for (const mv of mine) {
          const d = (tv[0] - mv[0]) * axis[0] + (tv[1] - mv[1]) * axis[1];
          const ad = Math.abs(d);
          if (ad <= tol && (!best || ad < best.a)) best = { a: ad, d, tv, mv };
        }
      }
      if (best) {
        const box = boxBetween(src, handle, held, [from[0] + pageDx + best.d * axis[0], from[1] + pageDy + best.d * axis[1]]);
        let lockPt: Pt | null = null;
        for (const tv of others) {
          if (lockPt) break;
          for (const mv of movingCorners(box, handle)) {
            if (Math.hypot(tv[0] - mv[0], tv[1] - mv[1]) < COINCIDE) {
              lockPt = [tv[0], tv[1]];
              break;
            }
          }
        }
        const guides: Guide[] = [];
        if (lockPt) guides.push({ kind: "lock", x: lockPt[0], y: lockPt[1] });
        else {
          const end: Pt = [best.mv[0] + best.d * axis[0], best.mv[1] + best.d * axis[1]];
          guides.push({ kind: "axis", lines: [[best.tv[0], best.tv[1], end[0], end[1]]] });
        }
        return { box, guides };
      }
    }
    if (shift) return { box: raw, guides: null };
    const dfx = moving[0] - heldF[0];
    const dfy = moving[1] - heldF[1];
    let w = dfx !== 0 ? snap8(raw.w) : raw.w;
    let h = dfy !== 0 ? snap8(raw.h) : raw.h;
    if (w < MIN) w = MIN;
    if (h < MIN) h = MIN;
    return { box: boxFromHeld(held, heldF[0], heldF[1], w, h, src.rotate || 0), guides: null };
  }

  return {
    MIN,
    LEGACY_TRIANGLE,
    NEW_TRIANGLE,
    HANDLES,
    pageOf,
    fractionOf,
    trianglePts,
    objectJoints,
    labelCorners,
    anchorTargets,
    handlePoints,
    cursorFor,
    shapeSvg,
    resizeByPointer,
    resizeSnapped,
    jointLock,
    vertexSnap,
    moveSnap,
    dragJoint,
    snap8,
    movingCorners,
  };
}

const engine = createLabelGeom();

export const LEGACY_TRIANGLE = engine.LEGACY_TRIANGLE;
export const NEW_TRIANGLE = engine.NEW_TRIANGLE;
export const pageOf = engine.pageOf;
export const fractionOf = engine.fractionOf;
export const trianglePts = engine.trianglePts;
export const objectJoints = engine.objectJoints;
export const labelCorners = engine.labelCorners;
export const anchorTargets = engine.anchorTargets;
export const handlePoints = engine.handlePoints;
export const shapeSvg = engine.shapeSvg;
export const resizeByPointer = engine.resizeByPointer;
export const resizeSnapped = engine.resizeSnapped;
export const jointLock = engine.jointLock;
export const vertexSnap = engine.vertexSnap;
export const moveSnap = engine.moveSnap;
export const dragJoint = engine.dragJoint;

/**
 * The editor's client runs this source, not a second copy.
 * The worker's bundle names inner functions with __name, which lives
 * outside the function, so the client defines that helper around the
 * same source.
 */
export function labelGeomSource(): string {
  return `(function () {
  function __name(target, value) {
    try { Object.defineProperty(target, "name", { value: value, configurable: true }); } catch (err) {}
    return target;
  }
  return (${createLabelGeom.toString()})();
})()`;
}
