/**
 * Operations map icons (owner ruling 2026-09-02). One hand: single stroke
 * weight, simple geometry, currentColor, viewBox, aria-hidden beside the
 * visible text labels. No emoji, no external images.
 */

const ICON_ATTR =
  'class="ops-icon-svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

function svg(body: string): string {
  return `<svg ${ICON_ATTR}>${body}</svg>`;
}

export const OPS_ICON_NAMES = [
  "field",
  "truck",
  "silo",
  "factory",
  "storefront",
  "scales",
] as const;

export type OpsIconName = (typeof OPS_ICON_NAMES)[number];

/** Owner strip 2026-09-02 (use these exact icons): sun over the horizon bar,
 * five furrow rays fanning from the bar's center. */
function fieldIcon(): string {
  return svg(
    `<circle cx="38" cy="13" r="6"/><path d="M10 27h44"/><path d="M29 27L8 50"/><path d="M29 27l-12 25"/><path d="M29 27l-2 26"/><path d="M29 27l9 25"/><path d="M29 27l20 23"/>`
  );
}

/** Owner strip 2026-09-02 (use these exact icons): plain box truck, cab
 * right with the slanted windshield, two wheels on the baseline. */
function truckIcon(): string {
  return svg(
    `<path d="M8 19h34v27H8z"/><path d="M42 27h9l7 8v11h-6"/><circle cx="21" cy="48" r="5"/><circle cx="44" cy="48" r="5"/><path d="M27 48h11"/>`
  );
}

/** Owner strip 2026-09-02 (use these exact icons): bell dome with the finial
 * knob, a ladder up the left face, the inner wall right, one wide base. */
function siloIcon(): string {
  return svg(
    `<path d="M32 6v4"/><path d="M20 52V26c0-14 24-14 24 0v26"/><path d="M40 26v26"/><path d="M27 24v28"/><path d="M27 32h13"/><path d="M27 41h13"/><path d="M12 52h40"/>`
  );
}

/** Owner strip 2026-09-02 (use these exact icons): sawtooth roof climbing
 * into the tall right tower, one small door, one baseline. */
function factoryIcon(): string {
  return svg(
    `<path d="M17 52V37l9-9v9l9-9v9l9-9"/><path d="M44 52V12h9v40"/><path d="M12 52h46"/><path d="M25 52v-9h8v9"/>`
  );
}

/** Owner strip 2026-09-02 (use these exact icons): the market stall: wide
 * top bar, wavy canopy hem meeting the right diagonal, walls, counter door. */
function storefrontIcon(): string {
  return svg(
    `<path d="M9 15h46"/><path d="M12 21c3 7 8 7 11 0s8 7 11 0 8 7 11 0l7-6"/><path d="M15 25v27"/><path d="M46 25v27"/><path d="M9 52h46"/><path d="M26 52V38h12v14"/>`
  );
}

/** Owner strip 2026-09-02 (use these exact icons): the balance scale: ring
 * finial, crossbar, hanging V strings to two bowls, trumpet foot. */
function scalesIcon(): string {
  return svg(
    `<circle cx="32" cy="9" r="3.5"/><path d="M32 13v29"/><path d="M15 19h34"/><path d="M15 19l-8 12"/><path d="M15 19l8 12"/><path d="M5 31c0 6 20 6 20 0"/><path d="M49 19l-8 12"/><path d="M49 19l8 12"/><path d="M39 31c0 6 20 6 20 0"/><path d="M32 42L22 52h20z"/><path d="M18 52h28"/>`
  );
}

const ICONS: Record<OpsIconName, () => string> = {
  field: fieldIcon,
  truck: truckIcon,
  silo: siloIcon,
  factory: factoryIcon,
  storefront: storefrontIcon,
  scales: scalesIcon,
};

export function opsIconSvg(name: OpsIconName): string {
  return ICONS[name]();
}
