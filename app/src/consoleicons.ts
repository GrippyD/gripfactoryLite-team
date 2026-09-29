/**
 * THE ICONS AS LINE ART (canon 0.30.282). Fifteen console pictures, one
 * stroke, the view's ink. Nothing in the served worker imports this module.
 * The panes that draw them come in later slices.
 */

export const CONSOLE_ICON_NAMES = [
  "rad",
  "cryo",
  "bulk-bud",
  "prepack",
  "shake",
  "waste",
  "total",
  "ready",
  "scheduled",
  "in-testing",
  "passed",
  "shipping",
  "submitted",
  "accepted",
  "siren",
] as const;

export type ConsoleIconName = (typeof CONSOLE_ICON_NAMES)[number];

export const CONSOLE_ICON_LABELS: Readonly<Record<ConsoleIconName, string>> = {
  rad: "Rad",
  cryo: "Cryo",
  "bulk-bud": "Bulk Bud",
  prepack: "Prepack",
  shake: "Shake",
  waste: "Waste",
  total: "Total",
  ready: "Ready for Testing",
  scheduled: "Scheduled for Testing",
  "in-testing": "In Testing",
  passed: "Passed Testing",
  shipping: "Shipping today",
  submitted: "Submitted",
  accepted: "Accepted",
  siren: "Siren",
};

/** One stroke weight for every icon's root. A detail line may use 2. */
export const CONSOLE_ICON_STROKE = 3;

/** The empty rectangle inside the shipping trailer, in that icon's user units. */
export const TRAILER_CARGO = { x: 60, y: 24, width: 84, height: 30 } as const;

export type ConsoleIconOptions = {
  label?: string;
  className?: string;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function word(x: number, y: number, size: number, value: string): string {
  return `<text x="${x}" y="${y}" fill="currentColor" stroke="none" font-family="inherit" font-weight="800" font-size="${size}" text-anchor="middle">${value}</text>`;
}

function root(name: ConsoleIconName, body: string, wide: boolean, label: string, className?: string): string {
  const viewBox = wide ? "0 0 160 100" : "0 0 100 100";
  const extra = className ? ` ${esc(className)}` : "";
  const a11y = label === "" ? `aria-hidden="true"` : `role="img" aria-label="${esc(label)}"`;
  return `<svg class="hc-icon hc-icon-${name}${extra}" data-hc-icon="${name}" viewBox="${viewBox}" ${a11y} focusable="false" fill="none" stroke="currentColor" stroke-width="${CONSOLE_ICON_STROKE}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function rad(): string {
  return [
    `<path data-icon-rad-body d="M16 34 H60 V84 H16 Z M16 34 L30 18 H74 L60 34 M60 34 L74 18 V68 L60 84"/>`,
    `<path d="M30 18 V68 H74" stroke-dasharray="3 3" opacity="0.45" stroke-width="2"/>`,
    `<path d="M22 42 H44 V76 H22 Z"/>`,
    `<path d="M48 38 H58 V70 H48 Z"/>`,
    `<path d="M50 42 H56 V52 H50 Z" stroke-width="2"/>`,
    `<path d="M22 24 H36 L40 20 H26 Z" stroke-width="2"/>`,
    `<path d="M28 68 H48 V76 H28 Z"/>`,
  ].join("");
}

function cryo(): string {
  const bar = `fill="currentColor" fill-opacity="0.35" stroke="none"`;
  return [
    `<rect x="8" y="10" width="24" height="20"/>`,
    `<rect x="64" y="8" width="28" height="26"/>`,
    `<rect x="8" y="64" width="44" height="28"/>`,
    `<rect x="68" y="58" width="24" height="34"/>`,
    `<rect data-icon-cryo-flow="meter-cryo" x="32" y="16" width="32" height="8" ${bar}/>`,
    `<rect data-icon-cryo-flow="meter-amaps" x="16" y="30" width="8" height="34" ${bar}/>`,
    `<rect data-icon-cryo-flow="cryo-uv" x="74" y="34" width="8" height="24" ${bar}/>`,
    word(78, 25, 8, "CRYO"),
    word(30, 82, 8, "AMAPS"),
    word(80, 78, 8, "UV"),
  ].join("");
}

function bulkBud(): string {
  return [
    `<path d="M22 50 L16 82 H84 L78 50"/>`,
    `<path d="M22 50 L8 36 H36 L22 50"/>`,
    `<path d="M78 50 L92 36 H64 L78 50"/>`,
    `<path d="M22 50 H78"/>`,
    `<circle cx="40" cy="40" r="8"/>`,
    `<circle cx="54" cy="32" r="9"/>`,
    `<circle cx="68" cy="42" r="7"/>`,
    `<circle cx="48" cy="46" r="5" stroke-width="2"/>`,
  ].join("");
}

function prepack(): string {
  return [
    `<path d="M32 20 H68 C76 20 80 26 80 32 V78 C80 88 50 94 20 78 V32 C20 26 24 20 32 20"/>`,
    `<path d="M24 32 H76"/>`,
    `<path d="M34 42 H66 V70 H34 Z" stroke-width="2"/>`,
    `<circle cx="44" cy="52" r="4" stroke-width="2"/>`,
    `<circle cx="56" cy="58" r="5" stroke-width="2"/>`,
    `<circle cx="48" cy="62" r="3" stroke-width="2"/>`,
  ].join("");
}

function shake(): string {
  return [
    `<path d="M10 48 H56 C68 48 76 54 78 62 L74 72 H18 C10 72 8 60 10 48"/>`,
    `<path d="M56 48 L74 40"/>`,
    `<path d="M56 48 L74 56" stroke-width="2"/>`,
    `<circle cx="80" cy="58" r="4"/>`,
    `<circle cx="88" cy="66" r="5"/>`,
    `<circle cx="78" cy="70" r="3" stroke-width="2"/>`,
    `<circle cx="86" cy="74" r="2.5" stroke-width="2"/>`,
  ].join("");
}

function waste(): string {
  return [
    `<path d="M20 82 H58"/>`,
    `<path d="M16 88 H64"/>`,
    `<path d="M28 80 C32 64 26 58 34 44 C40 58 50 52 46 80"/>`,
    `<path d="M38 62 C42 52 40 48 44 42" stroke-width="2"/>`,
    `<path d="M50 26 L74 36 L66 52 L42 40 Z"/>`,
    `<path d="M42 34 C34 26 30 32 38 36"/>`,
    `<path d="M34 28 H46" stroke-width="2"/>`,
  ].join("");
}

function total(): string {
  return [
    `<path d="M14 74 H86"/>`,
    `<path d="M18 74 V84 H32 V74 M40 74 V84 H54 V74 M62 74 V84 H78 V74"/>`,
    `<path d="M20 74 V56 H80 V74"/>`,
    `<path d="M26 56 V36 H74 V56"/>`,
    `<path d="M20 65 H80" stroke-width="2"/>`,
    `<path d="M26 46 H74" stroke-width="2"/>`,
    `<path d="M50 36 V28 H58 V36" stroke-width="2"/>`,
  ].join("");
}

function ready(): string {
  return [
    `<path d="M30 14 H70"/>`,
    `<circle cx="36" cy="14" r="3"/>`,
    `<circle cx="48" cy="14" r="3"/>`,
    `<circle cx="60" cy="14" r="3"/>`,
    `<circle cx="70" cy="14" r="3"/>`,
    `<path d="M22 20 H78 V84 H22 Z"/>`,
    `<path d="M22 36 H70 C76 36 78 32 78 28" stroke-width="2"/>`,
    word(50, 32, 7, "Pretest checks"),
    `<rect x="28" y="44" width="10" height="10"/>`,
    `<path d="M30 49 L33 52 L37 45"/>`,
    `<path d="M42 49 H68" stroke-width="2"/>`,
    `<rect x="28" y="58" width="10" height="10"/>`,
    `<path d="M30 63 L33 66 L37 59"/>`,
    `<path d="M42 63 H68" stroke-width="2"/>`,
    `<rect x="28" y="72" width="10" height="10"/>`,
    `<path d="M30 77 L33 80 L37 73"/>`,
    `<path d="M42 77 H60" stroke-width="2"/>`,
    `<path d="M64 72 C72 74 78 80 78 84" stroke-width="2"/>`,
  ].join("");
}

function scheduled(): string {
  return [
    `<path d="M30 12 H70"/>`,
    `<circle cx="36" cy="12" r="3"/>`,
    `<circle cx="48" cy="12" r="3"/>`,
    `<circle cx="60" cy="12" r="3"/>`,
    `<circle cx="70" cy="12" r="3"/>`,
    `<path d="M22 18 H78 V84 H22 Z"/>`,
    `<path d="M22 34 H68 C74 34 78 30 78 26" stroke-width="2"/>`,
    word(42, 30, 10, "Today"),
    `<path d="M40 48 H60 L64 54 V74 H40 Z"/>`,
    `<path d="M44 66 H60" stroke-width="2"/>`,
    `<path d="M52 42 C54 38 58 40 56 44" stroke-width="2"/>`,
    `<path d="M66 72 C74 74 78 80 78 84" stroke-width="2"/>`,
  ].join("");
}

function inTesting(): string {
  return [
    `<path d="M8 82 C14 62 30 54 40 58"/>`,
    `<circle cx="30" cy="36" r="10"/>`,
    `<path d="M24 32 H36" stroke-width="2"/>`,
    `<path d="M48 82 H88 V74 H80 V42 H60 V74 H52 V82"/>`,
    `<path d="M62 42 L46 28 H38"/>`,
    `<circle cx="36" cy="26" r="4"/>`,
    `<path d="M58 54 H78" stroke-width="2"/>`,
    `<circle cx="84" cy="70" r="3" stroke-width="2"/>`,
  ].join("");
}

function passed(): string {
  return [
    `<path d="M18 46 V30 C18 26 24 26 24 30 V46"/>`,
    `<path d="M14 42 H30 V68 H14 Z"/>`,
    `<path d="M18 50 H26 M18 56 H26 M18 62 H26" stroke-width="2"/>`,
    `<path d="M30 52 H48"/>`,
    `<rect x="50" y="40" width="34" height="42"/>`,
    word(67, 66, 10, "COA"),
  ].join("");
}

function shipping(): string {
  const c = TRAILER_CARGO;
  return [
    `<path d="M8 58 H28 L36 40 H48 V64"/>`,
    `<path d="M16 46 H32 V58"/>`,
    `<path d="M12 58 H6 V52 H14" stroke-width="2"/>`,
    `<path d="M22 40 V32" stroke-width="2"/>`,
    `<circle cx="18" cy="70" r="8"/>`,
    `<circle cx="40" cy="70" r="8"/>`,
    `<path d="M54 20 H150 V58 H54 Z"/>`,
    `<rect data-icon-trailer-cargo x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" fill="none"/>`,
    `<path d="M70 58 V70" stroke-width="2"/>`,
    `<circle cx="108" cy="70" r="8"/>`,
    `<circle cx="132" cy="70" r="8"/>`,
    `<path d="M48 64 H54" stroke-width="2"/>`,
  ].join("");
}

function submitted(): string {
  return [
    `<path d="M28 36 C22 30 18 42 22 56 C24 70 34 80 46 74"/>`,
    `<path d="M32 44 C28 48 28 58 32 62" stroke-width="2"/>`,
    `<path d="M36 52 C34 56 34 62 38 64" stroke-width="2"/>`,
    `<rect x="36" y="14" width="30" height="56" rx="4"/>`,
    `<path d="M46 18 H56" stroke-width="2"/>`,
    word(51, 34, 8, "PLUG"),
    `<circle cx="51" cy="46" r="7"/>`,
    `<circle cx="51" cy="44" r="2.5" stroke-width="2"/>`,
    `<path d="M46 50 Q51 47 56 50" stroke-width="2"/>`,
    `<path d="M66 32 C74 38 78 54 70 70"/>`,
  ].join("");
}

function siren(): string {
  return [
    `<path d="M28 78 H72 L66 90 H34 Z"/>`,
    `<path d="M50 78 V56"/>`,
    `<path data-icon-siren-lamp d="M36 56 H64 L58 40 H42 Z" fill="currentColor"/>`,
    `<path d="M32 34 L18 20"/>`,
    `<path d="M50 30 V14"/>`,
    `<path d="M68 34 L82 20"/>`,
  ].join("");
}

function accepted(): string {
  return [
    `<path d="M6 40 H38 C48 40 52 48 46 56"/>`,
    `<path d="M94 36 H60 C50 36 46 46 54 56"/>`,
    `<path d="M28 70 C40 56 62 56 74 72"/>`,
    `<path d="M34 64 H58"/>`,
    `<path d="M32 70 H62"/>`,
    `<path d="M34 76 H56"/>`,
    `<path d="M40 60 V54 M48 58 V52 M56 60 V54" stroke-width="2"/>`,
  ].join("");
}

const BODIES: Record<ConsoleIconName, () => string> = {
  rad,
  cryo,
  "bulk-bud": bulkBud,
  prepack,
  shake,
  waste,
  total,
  ready,
  scheduled,
  "in-testing": inTesting,
  passed,
  shipping,
  submitted,
  accepted,
  siren,
};

export function consoleIconSvg(name: ConsoleIconName, options?: ConsoleIconOptions): string {
  const label = options?.label === undefined ? CONSOLE_ICON_LABELS[name] : options.label;
  return root(name, BODIES[name](), name === "shipping", label, options?.className);
}
