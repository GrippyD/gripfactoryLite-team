/**
 * THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69). Owner ruling,
 * 2026-09-14, verbatim:
 *
 *   "under silos in the reports and on the inventory and drying screen, add
 *   the wet weights on the bottom.
 *
 *   change all silo shapes from circles to cone-topped cylinders.  If it's
 *   being filled in the wet weight screen, indicate underneath that it's
 *   "filling" While the wet weights are being put in a silo, add a green
 *   filling color to the inside of the silo wireframe.  Each silo holds 15k
 *   lbs wet for scaling.  When it's filling, make it throb green, once the
 *   clock is started, change it to throbbing red, and replace the "filling"
 *   with "drying""
 *
 * and, asked which report: "Inventory by Location" then "Live inventory on
 * all screens, including the Inventory by Location report".
 *
 * One truth for every surface: loadSiloVisuals reads the silos, their open
 * loads (the clock), the lots still weighing into them (filling) and the
 * finished lots waiting in the barn for Load Silo (filled), and siloVisual
 * turns that into a state, a fill level against the capacity (app_config
 * silo_capacity_wet_lbs, 15,000 by default, canon L-4) and the wet grams.
 * siloSvg draws the cone-topped cylinder wireframe with the fill inside it;
 * siloTile wraps it with the name, the state word and the wet weight at the
 * bottom; siloLiveScript refreshes every tile from /silos/live.json so the
 * numbers stay live while the wet weight screen keeps adding.
 *
 * THE HARVEST CONSOLE (canon 0.30.73). Owner ruling, 2026-09-15, verbatim (the
 * Drying section): "our silos animation, a 3d wire rectangular one called
 * "Arlington dry room" go ahead and add this as another "silo" as well (cap is
 * 15000 wet lbs, same as silos), we're going to need to cross this bridge soon
 * anyways, and add our FFZ inventory in a blue wire cube, capacity in there is
 * 4800 lbs (deeper blue slower throbbing to white for "fullness") (no timer).
 * Keep the shapes proportional to what we have for the silos, those are
 * perfect." His pick: "Make it a real silo now". So a silo carries a shape
 * (data, migration 0049): the cylinder, or the box, a cuboid in oblique
 * projection drawn in the same 200 by 150 frame with the same body height
 * (42 to 134), the same fill law and the same live repaint; and the FFZ cube
 * stands beside the silos on the console with its own capacity
 * (app_config ffz_capacity_lbs, 4800), a blue fill that throbs slowly toward
 * white while it holds anything, and no clock.
 */

import {
  capacityUomOf,
  drySpaceTypeOf,
  formatGrams,
  LOC_BLAST_FREEZER,
  parseFfzItemKinds,
  GRAMS_PER_LB,
  projectedDryYieldPct,
  shortLotId,
  type DrySpaceType,
} from "./config";
import { formatLbs } from "./compliance";
import {
  getConfigValue,
  listFfzGrams,
  listOpenSiloLoads,
  listSiloLotGrams,
  listSilos,
  type SiloLoadRow,
  type SiloRow,
} from "./db";
import { CONFIG_KEYS } from "./config";
import { t, type Locale } from "./i18n";
import { esc } from "./ui";

export const SILO_CAPACITY_WET_LBS_DEFAULT = 15000;
export const FFZ_CAPACITY_LBS_DEFAULT = 4800;
/** Re-export of GRAMS_PER_LB (canon 0.30.164): 448 grams to the pound. */
export const LB_GRAMS = GRAMS_PER_LB;
export const SILO_LIVE_PATH = "/silos/live.json";
export const SILO_LIVE_REFRESH_MS = 30_000;
export { LOC_BLAST_FREEZER };

/** The scaling capacity in grams from the app_config value (pounds); the owner's 15,000 when blank or unreadable. */
export function siloCapacityGrams(raw: string | null | undefined): number {
  const lbs = Number(String(raw ?? "").replace(/,/g, "").trim());
  return (Number.isFinite(lbs) && lbs > 0 ? lbs : SILO_CAPACITY_WET_LBS_DEFAULT) * LB_GRAMS;
}

/** The FFZ cube's capacity in grams from its app_config value (pounds); the owner's 4,800 when blank or unreadable. */
export function ffzCapacityGrams(raw: string | null | undefined): number {
  const lbs = Number(String(raw ?? "").replace(/,/g, "").trim());
  return (Number.isFinite(lbs) && lbs > 0 ? lbs : FFZ_CAPACITY_LBS_DEFAULT) * LB_GRAMS;
}

/** A silo's drawn shape (dry_spaces.shape, migration 0049): the cylinder, the
 * box, or, THE DRY SPACE TYPE (canon 0.30.106), the cube of a freezer. */
export type SiloShape = "cylinder" | "box" | "cube";
export function siloShapeOf(raw: string | null | undefined): SiloShape {
  return raw === "box" ? "box" : raw === "cube" ? "cube" : "cylinder";
}

/** THE DRY SPACE TYPE (canon 0.30.106; owner, 2026-09-16: "Freezer, Dry Room,
 * or Silo? <<<<<<Toggle that decides the formatting and the shape"): the type
 * decides the shape (a freezer is the cube, a dry room the cuboid, a silo the
 * cone-topped cylinder); the stored shape only speaks for a row with no type. */
export type SpaceLike = { space_type?: string | null; shape?: string | null; capacity?: number | string | null; capacity_uom?: string | null };
export function spaceShapeOf(space: SpaceLike): SiloShape {
  if (space.space_type) {
    const type = drySpaceTypeOf(space.space_type);
    return type === "freezer" ? "cube" : type === "dry_room" ? "box" : "cylinder";
  }
  return siloShapeOf(space.shape);
}
export function spaceTypeOf(space: SpaceLike): DrySpaceType {
  if (space.space_type) return drySpaceTypeOf(space.space_type);
  return siloShapeOf(space.shape) === "box" ? "dry_room" : "silo";
}

/** A space's own scaling capacity in grams: its capacity when the unit is a
 * weight (lb or g; his "Change blast freezer capacity to 800lbs"), else the
 * standing silo capacity. ea and sqft read on the tile alone. */
export function spaceCapacityGrams(space: SpaceLike, defaultGrams: number): number {
  const uom = capacityUomOf(space.capacity_uom);
  const n = Number(String(space.capacity ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return defaultGrams;
  if (uom === "lb") return n * LB_GRAMS;
  if (uom === "g") return n;
  return defaultGrams;
}

/** "800 lb", the capacity in words for the tile and the lookup; blank without one. */
export function spaceCapacityLabel(space: SpaceLike): string {
  const uom = capacityUomOf(space.capacity_uom);
  const n = Number(String(space.capacity ?? "").replace(/,/g, "").trim());
  if (!uom || !Number.isFinite(n) || n <= 0) return "";
  const shown = Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${shown} ${uom}`;
}

export type SiloClock = "running" | "paused" | "not_started";
/** THE LOADING SILO (canon 0.30.81): the barn-waiting state is his word, loading (0.30.69 had called it filled). */
export type SiloState = "empty" | "filling" | "loading" | "loaded" | "drying" | "paused" | "unloading";
export type SiloFillColor = "green" | "red" | "blue";

/** THE UNLOADING SILO (canon 0.30.77): the projected dry yield, percent of wet, the owner's 22 by default (app_config projected_dry_yield_pct). */
export const PROJECTED_DRY_YIELD_PCT_DEFAULT = 22;

export type SiloVisualInput = {
  /** Grams weighed so far by lots still weighing into this silo (the wet weight screen). */
  fillingGrams: number;
  /** How many lots are weighing into it (a lot with no weight yet still fills). */
  fillingLots: number;
  /** Grams of finished lots assigned to this silo, waiting in the barn for Load Silo (loading). */
  awaitingGrams: number;
  /** How many such lots wait (canon 0.30.81: a lot with no grams yet still reads loading). */
  awaitingLots?: number;
  /** Grams of the open loads in the silo and the clock they run under; null when no load. */
  loadedGrams: number;
  clock: SiloClock | null;
  capacityGrams: number;
  /** THE UNLOADING SILO (canon 0.30.77): dry grams weighed out so far at Unload Dry
   * Space for the loaded lots (their unload dry space fields); 0 or absent when none. */
  unloadedDryGrams?: number;
  /** The projected dry yield, percent of wet, that scales the fill's fall; 22 when absent. */
  dryYieldPct?: number;
  /** THE DRY SPACE TYPE (canon 0.30.106): a freezer's running word is Chilling
   * Out and its fill is the FFZ blue fading slowly to white. */
  freezer?: boolean;
};

export type SiloVisual = {
  state: SiloState;
  /** The i18n key of the word under the silo. */
  label: string;
  /** THE DRY SPACE TYPE (canon 0.30.106): true on a freezer; the tile and the fill read it. */
  freezer: boolean;
  wetGrams: number;
  /** 0..1 of the capacity, the fill's height inside the wireframe. */
  level: number;
  throb: SiloFillColor | null;
  /** The fill's color family; null draws the wireframe alone. */
  fill: SiloFillColor | null;
  /** THE UNLOADING SILO (canon 0.30.77): the dry grams out so far and the share of the expected dry they make; both 0 outside unloading. */
  unloadedDryGrams: number;
  unloadedShare: number;
  /** The expected dry grams of the load (loaded wet times the yield); 0 outside unloading. */
  expectedDryGrams: number;
};

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** THE UNLOADING SILO (canon 0.30.77), the cap change: the fill falls with the
 * dry grams weighed out, scaled against the expected dry (loaded wet times the
 * projected yield); empty when the expected dry is all out. */
export function unloadingLevel(loadedGrams: number, unloadedDryGrams: number, dryYieldPct: number, capacityGrams: number): { level: number; share: number; expectedDryGrams: number } {
  const expectedDryGrams = Math.round(loadedGrams * (Math.max(0, dryYieldPct) / 100) * 100) / 100;
  const share = expectedDryGrams > 0 ? clamp01(unloadedDryGrams / expectedDryGrams) : unloadedDryGrams > 0 ? 1 : 0;
  const remaining = loadedGrams * (1 - share);
  return { level: clamp01(capacityGrams > 0 ? remaining / capacityGrams : 0), share, expectedDryGrams };
}

/** The law in one place: a load (the clock) wins over filling, filling over a
 * finished lot waiting for its load, and an untouched silo is empty.
 * THE UNLOADING SILO (canon 0.30.77; owner, 2026-09-15, verbatim: "All silos:
 * if there is weight in the lot's unload dry space fields, "unloading", throb
 * blue, show cap changes"): a loaded lot with dry grams weighed out reads
 * unloading over its clock, throbs blue, and its fill falls with the dry out. */
export function siloVisual(i: SiloVisualInput): SiloVisual {
  const level = (g: number) => clamp01(i.capacityGrams > 0 ? g / i.capacityGrams : 0);
  const freezer = Boolean(i.freezer);
  const none = { unloadedDryGrams: 0, unloadedShare: 0, expectedDryGrams: 0, freezer };
  if (i.clock) {
    const wetGrams = i.loadedGrams;
    const dryOut = Number(i.unloadedDryGrams ?? 0);
    if (dryOut > 0) {
      const u = unloadingLevel(wetGrams, dryOut, i.dryYieldPct ?? PROJECTED_DRY_YIELD_PCT_DEFAULT, i.capacityGrams);
      return {
        state: "unloading",
        label: "unloading",
        freezer,
        wetGrams,
        level: u.level,
        throb: "blue",
        fill: "blue",
        unloadedDryGrams: dryOut,
        unloadedShare: u.share,
        expectedDryGrams: u.expectedDryGrams,
      };
    }
    // THE BLAST FREEZER(S) (canon 0.30.106; owner: "Change status "Drying" to
    // "Chilling Out""): a freezer's running clock reads Chilling Out.
    if (i.clock === "running") {
      return { state: "drying", label: freezer ? "chilling out" : "drying", wetGrams, level: level(wetGrams), throb: "red", fill: "red", ...none };
    }
    if (i.clock === "paused") return { state: "paused", label: "paused", wetGrams, level: level(wetGrams), throb: null, fill: "red", ...none };
    return { state: "loaded", label: "loaded", wetGrams, level: level(wetGrams), throb: null, fill: "red", ...none };
  }
  if (i.fillingLots > 0 || i.fillingGrams > 0) {
    return { state: "filling", label: "filling", wetGrams: i.fillingGrams, level: level(i.fillingGrams), throb: "green", fill: "green", ...none };
  }
  if (i.awaitingGrams > 0 || (i.awaitingLots ?? 0) > 0) {
    return { state: "loading", label: "loading", wetGrams: i.awaitingGrams, level: level(i.awaitingGrams), throb: null, fill: "green", ...none };
  }
  return { state: "empty", label: "empty", wetGrams: 0, level: 0, throb: null, fill: null, ...none };
}

/** The geometry of the wireframe: the cone roof over a cylinder, in a 200 by 150
 * box. THE WIDE SILO (canon 0.30.71; owner, 2026-09-14, verbatim: "make the
 * silos and their contents twice as wide without changing their height"): the
 * 0.30.69 box was 100 wide with the body from 20 to 80; every x doubled, every
 * y kept, so the fill (the contents) widens with the body and nothing grows
 * taller. rimRy is the ellipse's half height; the half width is (right - left) / 2. */
export const SILO_GEOMETRY = { width: 200, height: 150, bodyTop: 42, bodyBottom: 134, left: 40, right: 160, apexY: 8, rimRy: 8 } as const;

/** The wire box (the Arlington Dry Room, canon 0.30.73): a cuboid in oblique
 * projection in the same 200 by 150 frame, its front face the silo body's
 * height (42 to 134) and nearly its width, the depth climbing up and to the
 * right by dx, dy. The fill law is the cylinder's: the front face fills from
 * the bottom by level, the side face with it, and the liquid's top face rides
 * the fill line. */
export const BOX_GEOMETRY = { width: 200, height: 150, left: 34, right: 146, top: 42, bottom: 134, dx: 32, dy: 18 } as const;

/** The FFZ cube (canon 0.30.73): a cube of the silo body's height in the same frame, the same depth as the box. */
export const CUBE_GEOMETRY = { width: 200, height: 150, left: 46, right: 138, top: 42, bottom: 134, dx: 32, dy: 18 } as const;

export type BoxGeometry = typeof BOX_GEOMETRY | typeof CUBE_GEOMETRY;

export function siloFillClass(v: Pick<SiloVisual, "fill" | "throb"> & { freezer?: boolean }): string {
  // THE DRY SPACE TYPE (canon 0.30.106): a freezer holding anything fills in the
  // FFZ blue and fades slowly to white, whatever its state; empty draws the wire alone.
  if (v.freezer) return v.fill ? "silo-fill ffz-fill ffz-throb" : "silo-fill";
  const parts = ["silo-fill"];
  if (v.fill === "green") parts.push("silo-fill-green");
  if (v.fill === "red") parts.push("silo-fill-red");
  if (v.fill === "blue") parts.push("silo-fill-blue");
  if (v.throb) parts.push("silo-throb");
  return parts.join(" ");
}

/** The fill rectangle's top and height for a level, in the wireframe's box
 * (every shape keeps the body from 42 to 134, so one law serves them all). */
export function siloFillBox(level: number): { y: number; height: number } {
  const g = SILO_GEOMETRY;
  const bodyH = g.bodyBottom - g.bodyTop;
  const height = Math.round(bodyH * clamp01(level) * 100) / 100;
  return { y: Math.round((g.bodyBottom - height) * 100) / 100, height };
}

/** The skew that lays a rectangle onto the box's right face: y falls by dy across dx. */
export function boxSkewDegrees(g: BoxGeometry): number {
  return Math.round((Math.atan(g.dy / g.dx) * 180) / Math.PI * 10000) / 10000;
}

/** The liquid's top face at a fill line y: a parallelogram from the front edge back into the depth. */
export function boxTopPoints(g: BoxGeometry, y: number): string {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return `${g.left},${r2(y)} ${g.right},${r2(y)} ${g.right + g.dx},${r2(y - g.dy)} ${g.left + g.dx},${r2(y - g.dy)}`;
}

/** The cuboid: the fill on the front face, the side face (skewed) and the
 * liquid's top, then the wire over them; the hidden back edges dashed. */
export function boxSvg(input: {
  geometry: BoxGeometry;
  level: number;
  fillClass: string;
  shapeClass: string;
  state: string;
  ariaLabel: string;
}): string {
  const g = input.geometry;
  const box = siloFillBox(input.level);
  const skew = boxSkewDegrees(g);
  const w = g.right - g.left;
  return `<svg class="silo-shape ${esc(input.shapeClass)}" data-silo-shape data-silo-state="${esc(input.state)}" viewBox="0 0 ${g.width} ${g.height}" role="img" aria-label="${esc(
    input.ariaLabel
  )}" focusable="false">
    <rect class="${esc(input.fillClass)}" data-silo-fill x="${g.left}" y="${box.y}" width="${w}" height="${box.height}"/>
    <g transform="translate(${g.right} 0) skewY(-${skew})"><rect class="${esc(input.fillClass)} silo-fill-side" data-silo-fill-side x="0" y="${box.y}" width="${g.dx}" height="${box.height}"/></g>
    <polygon class="${esc(input.fillClass)} silo-fill-top" data-silo-fill-top data-box="${g.left} ${g.right} ${g.dx} ${g.dy}" points="${boxTopPoints(g, box.y)}"/>
    <path class="silo-wire silo-wire-hidden" d="M${g.left + g.dx} ${g.top - g.dy} V${g.bottom - g.dy} H${g.right + g.dx} M${g.left} ${g.bottom} L${g.left + g.dx} ${g.bottom - g.dy}"/>
    <path class="silo-wire" d="M${g.left} ${g.top} H${g.right} V${g.bottom} H${g.left} Z"/>
    <path class="silo-wire" d="M${g.left} ${g.top} L${g.left + g.dx} ${g.top - g.dy} H${g.right + g.dx} L${g.right} ${g.top}"/>
    <path class="silo-wire" d="M${g.right + g.dx} ${g.top - g.dy} V${g.bottom - g.dy} L${g.right} ${g.bottom}"/>
  </svg>`;
}

/** The cone-topped cylinder: the fill clipped to the body, the wireframe over it; or the wire box for a box-shaped silo. */
export function siloSvg(v: SiloVisual, siloId: string, locale: Locale = "en", shape: SiloShape = "cylinder"): string {
  const pct = Math.round(v.level * 100);
  const ariaLabel = `${t(locale, v.label)}, ${pct}%`;
  if (shape === "box") {
    return boxSvg({ geometry: BOX_GEOMETRY, level: v.level, fillClass: siloFillClass(v), shapeClass: "silo-shape-box", state: v.state, ariaLabel });
  }
  if (shape === "cube") {
    return boxSvg({ geometry: CUBE_GEOMETRY, level: v.level, fillClass: siloFillClass(v), shapeClass: "silo-shape-cube", state: v.state, ariaLabel });
  }
  const g = SILO_GEOMETRY;
  const clipId = `silo-clip-${siloId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const box = siloFillBox(v.level);
  const rx = (g.right - g.left) / 2;
  const cx = (g.left + g.right) / 2;
  const body = `M${g.left} ${g.bodyTop} H${g.right} V${g.bodyBottom} A${rx} ${g.rimRy} 0 0 1 ${g.left} ${g.bodyBottom} Z`;
  return `<svg class="silo-shape" data-silo-shape data-silo-state="${esc(v.state)}" viewBox="0 0 ${g.width} ${g.height}" role="img" aria-label="${esc(
    ariaLabel
  )}" focusable="false">
    <defs><clipPath id="${esc(clipId)}"><path d="${body}"/></clipPath></defs>
    <g clip-path="url(#${esc(clipId)})"><rect class="${esc(siloFillClass(v))}" data-silo-fill x="${g.left}" y="${box.y}" width="${g.right - g.left}" height="${box.height}"/></g>
    <path class="silo-wire" d="M${g.left} ${g.bodyTop} L${cx} ${g.apexY} L${g.right} ${g.bodyTop}"/>
    <ellipse class="silo-wire" cx="${cx}" cy="${g.bodyTop}" rx="${rx}" ry="${g.rimRy}"/>
    <path class="silo-wire" d="M${g.left} ${g.bodyTop} V${g.bodyBottom} A${rx} ${g.rimRy} 0 0 0 ${g.right} ${g.bodyBottom} V${g.bodyTop}"/>
  </svg>`;
}

/** THE UNLOADING SILO (canon 0.30.77): "Dry out 1,234.00 lb · 42% of expected",
 * the cap change in words under the state word; hidden (kept in the markup for
 * the live repaint) outside unloading. */
export function siloUnloadLine(v: Pick<SiloVisual, "state" | "unloadedDryGrams" | "unloadedShare">, locale: Locale = "en"): string {
  const hidden = v.state === "unloading" ? "" : " hidden";
  return `<div class="silo-unload"${hidden} data-silo-unload>${esc(t(locale, "Dry out"))} <strong data-silo-unload-lb>${esc(formatLbs(v.unloadedDryGrams))}</strong> lb · <strong data-silo-unload-pct>${Math.round(
    v.unloadedShare * 100
  )}%</strong> ${esc(t(locale, "of expected"))}</div>`;
}

/** "Wet 27.22 lb · 12,345.00 g", the line at the bottom of every tile. */
export function siloWetLine(wetGrams: number, locale: Locale = "en"): string {
  return `<div class="silo-wet" data-silo-wet>${esc(t(locale, "Wet"))} <strong data-silo-wet-lb>${esc(formatLbs(wetGrams))}</strong> lb · <strong data-silo-wet-g>${esc(
    formatGrams(wetGrams)
  )}</strong> g</div>`;
}

/** A silo tile for any surface: the name, the shape, the state word, the caller's body (lots, clocks), the wet weight at the bottom. */
export function siloTile(input: {
  id: string;
  name: string;
  visual: SiloVisual;
  body: string;
  locale?: Locale;
  extraClass?: string;
  /** Canon 0.30.73: the silo's drawn shape; the cylinder when absent. */
  shape?: SiloShape | string | null;
}): string {
  const locale = input.locale ?? "en";
  const v = input.visual;
  const shape = siloShapeOf(input.shape);
  if (v.freezer) {
    // THE BLAST FREEZER(S) (canon 0.30.106; owner: "Merge the blast freezer
    // formatting to the FFZ inventory one"; his pick: the status and the percent
    // on one line, the lot and its clock muted beneath, the wet weight at the
    // bottom, the fill in the FFZ blue). The tile carries the FFZ chrome.
    return `<div class="inv-gauge silo-gauge ffz-gauge freezer-gauge${input.extraClass ? ` ${esc(input.extraClass)}` : ""}" data-silo="${esc(
      input.id
    )}" data-silo-state="${esc(v.state)}" data-silo-shape-kind="${shape}" data-space-type="freezer">
          <div class="inv-gauge-name">${esc(input.name)}</div>
          ${siloSvg(v, input.id, locale, shape)}
          <div class="silo-state ffz-state freezer-state"><span data-silo-label>${esc(t(locale, v.label))}</span> · <span data-silo-pct>${esc(
      siloPctLabel(v, locale)
    )}</span></div>
          ${siloUnloadLine(v, locale)}
          <div class="muted ffz-source freezer-lines">${input.body}</div>
          ${siloWetLine(v.wetGrams, locale)}
        </div>`;
  }
  return `<div class="inv-gauge silo-gauge${input.extraClass ? ` ${esc(input.extraClass)}` : ""}" data-silo="${esc(input.id)}" data-silo-state="${esc(v.state)}" data-silo-shape-kind="${shape}">
          <div class="inv-gauge-name">${esc(input.name)}</div>
          ${siloSvg(v, input.id, locale, shape)}
          <div class="silo-state silo-state-${esc(v.state)}" data-silo-label>${esc(t(locale, v.label))}</div>
          ${siloUnloadLine(v, locale)}
          ${input.body}
          ${siloWetLine(v.wetGrams, locale)}
        </div>`;
}

/** "94% full", the FFZ-style fullness of a freezer's fill against its own capacity. */
export function siloPctLabel(v: Pick<SiloVisual, "level">, locale: Locale = "en"): string {
  return `${Math.round(clamp01(v.level) * 100)}% ${t(locale, "full")}`;
}

/** What /silos/live.json answers: one entry per silo, everything a tile shows. */
export type SiloLiveEntry = {
  id: string;
  name: string;
  state: SiloState;
  label: string;
  wetGrams: number;
  wetLb: string;
  wetG: string;
  level: number;
  fill: SiloFillColor | null;
  throb: SiloFillColor | null;
  shape: SiloShape;
  /** THE UNLOADING SILO (canon 0.30.77): the dry out so far, in pounds, and its share of the expected dry as a whole percent. */
  unloadedDryGrams: number;
  unloadLb: string;
  unloadPct: number;
  /** THE DRY SPACE TYPE (canon 0.30.106): the fill's classes as the server draws them, the fullness word, and the type. */
  fillClass: string;
  pctLabel: string;
  spaceType: DrySpaceType;
};

export function siloLiveEntry(id: string, name: string, v: SiloVisual, locale: Locale = "en", shape: SiloShape | string | null = "cylinder"): SiloLiveEntry {
  return {
    id,
    name,
    state: v.state,
    label: t(locale, v.label),
    wetGrams: v.wetGrams,
    wetLb: formatLbs(v.wetGrams),
    wetG: formatGrams(v.wetGrams),
    level: v.level,
    fill: v.fill,
    throb: v.throb,
    shape: siloShapeOf(shape),
    unloadedDryGrams: v.unloadedDryGrams,
    unloadLb: formatLbs(v.unloadedDryGrams),
    unloadPct: Math.round(v.unloadedShare * 100),
    fillClass: siloFillClass(v),
    pctLabel: siloPctLabel(v, locale),
    spaceType: v.freezer ? "freezer" : siloShapeOf(shape) === "box" ? "dry_room" : "silo",
  };
}

/* ------------------------------------------------------------- the FFZ cube */

/** The fresh frozen cube (canon 0.30.73): grams against its capacity, no clock.
 * THE FFZ CUBE READS THE MIRROR (canon 0.30.75): the grams are the METRC
 * mirror's FFZ packages plus the ledger's frozen material the mirror does not
 * claim; the two shares ride along so the tile can say where it read. */
export type FfzVisual = {
  grams: number;
  /** 0..1 of the capacity, the fill's height inside the cube. */
  level: number;
  /** The whole percent for the word under the cube ("42% full"). */
  pct: number;
  /** True while it holds anything: the blue fill throbs slowly toward white. */
  holding: boolean;
  /** The METRC mirror's share of the grams (active FFZ-kind packages). */
  mirrorGrams: number;
  /** The local ledger's share (frozen material the mirror does not count). */
  ledgerGrams: number;
  /** How many mirror packages stand behind mirrorGrams. */
  mirrorPackages: number;
};

export function ffzVisual(grams: number, capacityGrams: number, shares?: { mirrorGrams: number; ledgerGrams: number; mirrorPackages: number }): FfzVisual {
  const g = Number.isFinite(grams) && grams > 0 ? grams : 0;
  const level = clamp01(capacityGrams > 0 ? g / capacityGrams : 0);
  return {
    grams: g,
    level,
    pct: Math.round(level * 100),
    holding: g > 0,
    mirrorGrams: shares?.mirrorGrams ?? 0,
    ledgerGrams: shares?.ledgerGrams ?? g,
    mirrorPackages: shares?.mirrorPackages ?? 0,
  };
}

export function ffzFillClass(v: Pick<FfzVisual, "holding">): string {
  return v.holding ? "silo-fill ffz-fill ffz-throb" : "silo-fill";
}

export function ffzCubeSvg(v: FfzVisual, locale: Locale = "en"): string {
  return boxSvg({
    geometry: CUBE_GEOMETRY,
    level: v.level,
    fillClass: ffzFillClass(v),
    shapeClass: "silo-shape-cube",
    state: v.holding ? "holding" : "empty",
    ariaLabel: `${t(locale, "FFZ inventory")}, ${v.pct}%`,
  });
}

/** "42% full", the word under the cube (his "fullness"). */
export function ffzFullLabel(v: FfzVisual, locale: Locale = "en"): string {
  return `${v.pct}% ${t(locale, "full")}`;
}

/** "METRC 285.00 lb in 3 packages · ledger 0.00 lb", the source line under the cube (canon 0.30.75). */
export function ffzSourceLine(v: FfzVisual, locale: Locale = "en"): string {
  return `<div class="muted ffz-source" data-ffz-source>${esc(t(locale, "METRC"))} <span data-ffz-mirror-lb>${esc(formatLbs(v.mirrorGrams))}</span> lb ${esc(
    t(locale, "in")
  )} <span data-ffz-mirror-packages>${esc(String(v.mirrorPackages))}</span> ${esc(t(locale, v.mirrorPackages === 1 ? "package" : "packages"))} · ${esc(
    t(locale, "ledger")
  )} <span data-ffz-ledger-lb>${esc(formatLbs(v.ledgerGrams))}</span> lb</div>`;
}

/** The FFZ tile beside the silos: the name, the cube, the fullness, where the grams were read, the frozen weight at the bottom. */
export function ffzTile(v: FfzVisual, locale: Locale = "en"): string {
  return `<div class="inv-gauge silo-gauge ffz-gauge" data-ffz data-ffz-state="${v.holding ? "holding" : "empty"}">
          <div class="inv-gauge-name">${esc(t(locale, "FFZ inventory"))}</div>
          ${ffzCubeSvg(v, locale)}
          <div class="silo-state ffz-state" data-ffz-pct>${esc(ffzFullLabel(v, locale))}</div>
          ${ffzSourceLine(v, locale)}
          <div class="silo-wet" data-silo-wet>${esc(t(locale, "FFZ"))} <strong data-silo-wet-lb>${esc(formatLbs(v.grams))}</strong> lb · <strong data-silo-wet-g>${esc(
            formatGrams(v.grams)
          )}</strong> g</div>
        </div>`;
}

export type FfzLiveEntry = {
  grams: number;
  level: number;
  pct: number;
  holding: boolean;
  label: string;
  wetLb: string;
  wetG: string;
  mirrorGrams: number;
  mirrorLb: string;
  mirrorPackages: number;
  ledgerGrams: number;
  ledgerLb: string;
};

export function ffzLiveEntry(v: FfzVisual, locale: Locale = "en"): FfzLiveEntry {
  return {
    grams: v.grams,
    level: v.level,
    pct: v.pct,
    holding: v.holding,
    label: ffzFullLabel(v, locale),
    wetLb: formatLbs(v.grams),
    wetG: formatGrams(v.grams),
    mirrorGrams: v.mirrorGrams,
    mirrorLb: formatLbs(v.mirrorGrams),
    mirrorPackages: v.mirrorPackages,
    ledgerGrams: v.ledgerGrams,
    ledgerLb: formatLbs(v.ledgerGrams),
  };
}

/** The cube's inputs, read once per request: "Any FFZ" (his pick), THE FFZ
 * CUBE READS THE MIRROR (canon 0.30.75): the METRC mirror's active packages
 * of the fresh frozen kinds (app_config ffz_item_kinds) plus the ledger's
 * frozen material the mirror does not claim (listFfzGrams), against
 * app_config ffz_capacity_lbs. */
export async function loadFfzVisual(db: D1Database): Promise<{ visual: FfzVisual; capacityGrams: number; kinds: string[] }> {
  const [capRaw, kindsRaw] = await Promise.all([getConfigValue(db, CONFIG_KEYS.ffz_capacity_lbs), getConfigValue(db, CONFIG_KEYS.ffz_item_kinds)]);
  const kinds = parseFfzItemKinds(kindsRaw);
  const read = await listFfzGrams(db, kinds);
  const capacityGrams = ffzCapacityGrams(capRaw);
  return { visual: ffzVisual(read.grams, capacityGrams, read), capacityGrams, kinds };
}

/** Keeps every silo tile live: refetches the visuals and repaints the fill, the
 * state word and the wet weight without a page load. Runs only where tiles are. */
export function siloLiveScript(): string {
  return `<script>
(function () {
  if (!document.querySelector("[data-silo]") && !document.querySelector("[data-ffz]")) return;
  var BODY_TOP = ${SILO_GEOMETRY.bodyTop}, BODY_BOTTOM = ${SILO_GEOMETRY.bodyBottom};
  function paintFill(tile, level, cls) {
    var h = Math.round((BODY_BOTTOM - BODY_TOP) * Math.min(1, Math.max(0, level)) * 100) / 100;
    var y = Math.round((BODY_BOTTOM - h) * 100) / 100;
    var fill = tile.querySelector("[data-silo-fill]");
    if (fill) { fill.setAttribute("y", String(y)); fill.setAttribute("height", String(h)); fill.setAttribute("class", cls); }
    var side = tile.querySelector("[data-silo-fill-side]");
    if (side) { side.setAttribute("y", String(y)); side.setAttribute("height", String(h)); side.setAttribute("class", cls + " silo-fill-side"); }
    var top = tile.querySelector("[data-silo-fill-top]");
    if (top) {
      var b = (top.getAttribute("data-box") || "").split(" ").map(Number);
      if (b.length === 4) {
        var r2 = function (n) { return Math.round(n * 100) / 100; };
        top.setAttribute("points", b[0] + "," + r2(y) + " " + b[1] + "," + r2(y) + " " + (b[1] + b[2]) + "," + r2(y - b[3]) + " " + (b[0] + b[2]) + "," + r2(y - b[3]));
      }
      top.setAttribute("class", cls + " silo-fill-top");
    }
  }
  function paintWet(tile, lb, g) {
    var lbEl = tile.querySelector("[data-silo-wet-lb]");
    var gEl = tile.querySelector("[data-silo-wet-g]");
    if (lbEl) lbEl.textContent = lb;
    if (gEl) gEl.textContent = g;
  }
  function paint(entry) {
    document.querySelectorAll('[data-silo="' + entry.id + '"]').forEach(function (tile) {
      tile.setAttribute("data-silo-state", entry.state);
      var shape = tile.querySelector("[data-silo-shape]");
      if (shape) shape.setAttribute("data-silo-state", entry.state);
      var cls = "silo-fill";
      if (entry.fill === "green") cls += " silo-fill-green";
      if (entry.fill === "red") cls += " silo-fill-red";
      if (entry.fill === "blue") cls += " silo-fill-blue";
      if (entry.throb) cls += " silo-throb";
      if (entry.fillClass) cls = entry.fillClass;
      paintFill(tile, entry.level, cls);
      var freezer = tile.getAttribute("data-space-type") === "freezer";
      var label = tile.querySelector("[data-silo-label]");
      if (label) { label.textContent = entry.label; if (!freezer) label.className = "silo-state silo-state-" + entry.state; }
      var pct = tile.querySelector("[data-silo-pct]");
      if (pct && entry.pctLabel != null) pct.textContent = entry.pctLabel;
      var unload = tile.querySelector("[data-silo-unload]");
      if (unload) {
        unload.hidden = entry.state !== "unloading";
        var uLb = unload.querySelector("[data-silo-unload-lb]");
        var uPct = unload.querySelector("[data-silo-unload-pct]");
        if (uLb && entry.unloadLb != null) uLb.textContent = entry.unloadLb;
        if (uPct && entry.unloadPct != null) uPct.textContent = entry.unloadPct + "%";
      }
      paintWet(tile, entry.wetLb, entry.wetG);
    });
  }
  function paintFfz(ffz) {
    document.querySelectorAll("[data-ffz]").forEach(function (tile) {
      var state = ffz.holding ? "holding" : "empty";
      tile.setAttribute("data-ffz-state", state);
      var shape = tile.querySelector("[data-silo-shape]");
      if (shape) shape.setAttribute("data-silo-state", state);
      paintFill(tile, ffz.level, ffz.holding ? "silo-fill ffz-fill ffz-throb" : "silo-fill");
      var pct = tile.querySelector("[data-ffz-pct]");
      if (pct) pct.textContent = ffz.label;
      var mLb = tile.querySelector("[data-ffz-mirror-lb]");
      var mN = tile.querySelector("[data-ffz-mirror-packages]");
      var lLb = tile.querySelector("[data-ffz-ledger-lb]");
      if (mLb && ffz.mirrorLb != null) mLb.textContent = ffz.mirrorLb;
      if (mN && ffz.mirrorPackages != null) mN.textContent = String(ffz.mirrorPackages);
      if (lLb && ffz.ledgerLb != null) lLb.textContent = ffz.ledgerLb;
      paintWet(tile, ffz.wetLb, ffz.wetG);
    });
  }
  function refresh() {
    if (document.visibilityState === "hidden") return;
    fetch(${JSON.stringify(SILO_LIVE_PATH)}, { cache: "no-store", credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (Array.isArray(data.silos)) data.silos.forEach(paint);
        if (data.ffz) paintFfz(data.ffz);
      })
      .catch(function () {});
  }
  setInterval(refresh, ${SILO_LIVE_REFRESH_MS});
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") refresh(); });
})();
</script>`;
}

/** The clock a load runs under, as drying.ts reads it (the loaded time is the
 * clock's zero, canon 0.30.9): not_started without a readable time, paused
 * while paused_at is set, running otherwise. Kept here so this module never
 * imports the page renderers. */
export function siloClockOf(load: { loaded_at: string; started_at?: string | null; paused_at: string | null }): SiloClock {
  const zero = Date.parse(load.loaded_at);
  const fallback = load.started_at ? Date.parse(load.started_at) : NaN;
  if (!Number.isFinite(zero) && !Number.isFinite(fallback)) return "not_started";
  return load.paused_at ? "paused" : "running";
}

/** THE LOADING SILO (canon 0.30.81): a finished lot waiting in the barn for this silo, named on the tile with a link to Load Silo. */
export type SiloWaitingLot = {
  lot_id: string;
  hbn: string;
  metrc_harvest_tag: string | null;
  weight_grams: number;
  planned: boolean;
  /** THE STRAIN ON THE LOT LINE (canon 0.30.183): the market strain, else the strain's name; null when the HBN names none. */
  strain_label?: string | null;
};

export type SiloLive = { silo: SiloRow; visual: SiloVisual; loads: SiloLoadRow[]; waiting: SiloWaitingLot[] };

/** Pure assembly: silos, their open loads, and the weighing / awaiting grams per silo.
 * THE UNLOADING SILO (canon 0.30.77): the loads' dry grams weighed out so far
 * (dry_weight_grams on the loaded lot) and the projected yield ride in. */
export function assembleSiloVisuals(
  silos: readonly SiloRow[],
  loads: readonly SiloLoadRow[],
  lotGrams: readonly {
    dry_space_id: string;
    status: string;
    weight_grams: number;
    lots: number;
    lot_id?: string | null;
    hbn?: string | null;
    metrc_harvest_tag?: string | null;
    planned?: number | null;
    strain_label?: string | null;
  }[],
  capacityGrams: number,
  dryYieldPct: number = PROJECTED_DRY_YIELD_PCT_DEFAULT
): SiloLive[] {
  return silos.map((silo) => {
    const mine = loads.filter((l) => l.dry_space_id === silo.id);
    const filling = lotGrams.filter((r) => r.dry_space_id === silo.id && r.status === "weighing");
    const awaiting = lotGrams.filter((r) => r.dry_space_id === silo.id && r.status === "drying");
    // THE LOADING SILO (canon 0.30.81): the waiting lots by name, for the tile.
    const waiting: SiloWaitingLot[] = awaiting
      .filter((r) => r.lot_id)
      .map((r) => ({
        lot_id: String(r.lot_id),
        hbn: String(r.hbn ?? ""),
        metrc_harvest_tag: r.metrc_harvest_tag ?? null,
        weight_grams: Number(r.weight_grams ?? 0),
        planned: Number(r.planned ?? 0) === 1,
        // THE STRAIN ON THE LOT LINE (canon 0.30.183): carried only when the HBN names one.
        ...(r.strain_label ? { strain_label: r.strain_label } : {}),
      }));
    // A running clock wins over a paused one, a paused over an unstarted, when a silo somehow holds two loads.
    const clock: SiloClock | null = mine.length
      ? mine.map(siloClockOf).reduce<SiloClock>((best, c) => (c === "running" || best === "not_started" ? c : best), "not_started")
      : null;
    // THE DRY SPACE TYPE (canon 0.30.106): the space's own capacity scales its
    // fill (the Blast Freezer(s) at 800 lb); a space without one takes the
    // standing silo capacity. A freezer reads Chilling Out and fills FFZ blue.
    const visual = siloVisual({
      fillingGrams: filling.reduce((s, r) => s + Number(r.weight_grams ?? 0), 0),
      fillingLots: filling.reduce((s, r) => s + Number(r.lots ?? 0), 0),
      awaitingGrams: awaiting.reduce((s, r) => s + Number(r.weight_grams ?? 0), 0),
      awaitingLots: awaiting.reduce((s, r) => s + Number(r.lots ?? 0), 0),
      loadedGrams: mine.reduce((s, l) => s + Number(l.weight_grams ?? 0), 0),
      clock,
      capacityGrams: spaceCapacityGrams(silo, capacityGrams),
      unloadedDryGrams: mine.reduce((s, l) => s + Number(l.dry_weight_grams ?? 0), 0),
      dryYieldPct,
      freezer: spaceTypeOf(silo) === "freezer",
    });
    return { silo, visual, loads: mine, waiting };
  });
}

/** THE STRAIN ON THE LOT LINE (canon 0.30.183). Owner, 2026-09-22, verbatim: "Under the lots in
 * the dry spaces, show the market strain (or the actual strain if the market strain is null--should
 * already be the rule)". The label is the market strain, else the strain's name (THE FEED NAMES THE
 * REAL STRAIN, 0.30.149); a lot whose HBN names neither carries no line. */
export function lotStrainLine(label: string | null | undefined): string {
  const text = (label ?? "").trim();
  return text ? `<div class="inv-lot-strain muted" data-lot-strain>${esc(text)}</div>` : "";
}

/** THE DRYING TOTALS (canon 0.30.183). Owner, 2026-09-22, verbatim: "Under the dry spaces on the
 * harvest console (harvest), Total in Dry Spaces, Total in Cure Spaces, Total Dry Queued" and, on the
 * question tool, "Loaded in dry rooms and silos only - also add a dry weight estimate based on an
 * Admin lookup (default to 21%)". In dry spaces: the wet grams of the open loads in the silos and the
 * dry rooms (the freezer's chilling material and the lots still waiting to load stay out), with the
 * dry estimate at the Admin percent (app_config projected_dry_yield_pct, the tiles' own expected
 * yield). In cure spaces: the dry grams on CSA and CSB. Dry queued: the Unloaded Queue for trim
 * (unloaded lots with a live trim schedule, the queue the trimming clocks read). */
export type DryingTotals = {
  loadedGrams: number;
  loadedLots: number;
  /** loadedGrams times the percent, whole grams. */
  estimateGrams: number;
  dryYieldPct: number;
  cureGrams: number;
  cureLots: number;
  queuedGrams: number;
  queuedLots: number;
};

export function dryingTotals(input: {
  live: readonly SiloLive[];
  cureLots: readonly { dryGrams: number }[];
  queue: { grams: number; lots: number };
  dryYieldPct: number;
}): DryingTotals {
  let loadedGrams = 0;
  let loadedLots = 0;
  for (const { silo, loads } of input.live) {
    if (spaceTypeOf(silo) === "freezer") continue;
    for (const load of loads) {
      loadedGrams += Number(load.weight_grams ?? 0);
      loadedLots += 1;
    }
  }
  const pct = Number.isFinite(input.dryYieldPct) && input.dryYieldPct >= 0 ? input.dryYieldPct : PROJECTED_DRY_YIELD_PCT_DEFAULT;
  return {
    loadedGrams,
    loadedLots,
    estimateGrams: Math.round((loadedGrams * pct) / 100),
    dryYieldPct: pct,
    cureGrams: input.cureLots.reduce((sum, lot) => sum + Number(lot.dryGrams ?? 0), 0),
    cureLots: input.cureLots.length,
    queuedGrams: Number(input.queue.grams ?? 0),
    queuedLots: Number(input.queue.lots ?? 0),
  };
}

/** The three totals as one line under the dry space tiles: each a label, the pounds and the grams,
 * the lot count, and under the first the dry estimate at its percent. */
export function dryingTotalsMarkup(totals: DryingTotals, locale: Locale = "en"): string {
  const figure = (grams: number) => `<strong>${esc(formatLbs(grams))}</strong> lb · <strong>${esc(formatGrams(Math.round(grams)))}</strong> g`;
  const lots = (n: number) => esc(t(locale, n === 1 ? "{n} lot" : "{n} lots").replace("{n}", formatGrams(n)));
  const estimate = t(locale, "est. dry {lb} lb at {pct}%")
    .replace("{lb}", formatLbs(totals.estimateGrams))
    .replace("{pct}", formatGrams(totals.dryYieldPct));
  return `<div class="drying-totals" data-hc-drying-totals>
      <div class="drying-total" data-hc-total="dry-spaces">
        <div class="drying-total-label">${esc(t(locale, "Total in Dry Spaces"))}</div>
        <div class="drying-total-value">${figure(totals.loadedGrams)}</div>
        <div class="drying-total-sub muted">${lots(totals.loadedLots)} · <span data-hc-dry-estimate>${esc(estimate)}</span></div>
      </div>
      <div class="drying-total" data-hc-total="cure-spaces">
        <div class="drying-total-label">${esc(t(locale, "Total in Cure Spaces"))}</div>
        <div class="drying-total-value">${figure(totals.cureGrams)}</div>
        <div class="drying-total-sub muted">${lots(totals.cureLots)}</div>
      </div>
      <div class="drying-total" data-hc-total="dry-queued">
        <div class="drying-total-label">${esc(t(locale, "Total Dry Queued"))}</div>
        <div class="drying-total-value">${figure(totals.queuedGrams)}</div>
        <div class="drying-total-sub muted">${lots(totals.queuedLots)}</div>
      </div>
    </div>`;
}

/** THE LOADING SILO (canon 0.30.81): the lines a loading tile carries under its
 * word, one per finished lot waiting for its load, each a link to Load Silo
 * with that lot picked; a lot assigned by the HBN's planned silo says so. THE
 * FINISHED LOT IS ELIGIBLE (canon 0.30.130): the line no longer names the barn,
 * since the package may sit anywhere and the pane no longer asks. */
export function siloWaitingLines(waiting: readonly SiloWaitingLot[], locale: Locale = "en"): string {
  return waiting
    .map(
      (w) => `<div class="inv-lot silo-waiting" data-waiting="${esc(w.lot_id)}">
            <div class="inv-lot-id"><a href="/station/load_silo?pick=${esc(w.lot_id)}">${esc(t(locale, "Lot"))} ${esc(shortLotId(w.hbn, w.metrc_harvest_tag))}</a></div>
            ${lotStrainLine(w.strain_label)}
            <div class="inv-lot-time muted">${esc(t(locale, w.planned ? "waiting to load, planned here" : "waiting to load"))}</div>
          </div>`
    )
    .join("");
}

/** Everything the silo surfaces draw, read once per request. */
export async function loadSiloVisuals(db: D1Database): Promise<{ live: SiloLive[]; capacityGrams: number; dryYieldPct: number }> {
  const [silos, loads, lotGrams, capRaw, yieldRaw] = await Promise.all([
    listSilos(db),
    listOpenSiloLoads(db),
    listSiloLotGrams(db),
    getConfigValue(db, CONFIG_KEYS.silo_capacity_wet_lbs),
    getConfigValue(db, CONFIG_KEYS.projected_dry_yield_pct),
  ]);
  const capacityGrams = siloCapacityGrams(capRaw);
  const dryYieldPct = projectedDryYieldPct(yieldRaw);
  return { live: assembleSiloVisuals(silos, loads, lotGrams, capacityGrams, dryYieldPct), capacityGrams, dryYieldPct };
}
