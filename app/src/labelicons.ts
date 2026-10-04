/**
 * L1 THE LABEL EDITOR (canon 0.30.386). One stroke, the view's accent
 * (currentColor), round joins. Drawn for this slice. Not emoji, not borrowed.
 */

export const LABEL_ICON_NAMES = [
  "open",
  "save",
  "new",
  "print",
  "connections",
  "text",
  "memo",
  "barcode",
  "qr",
  "picture",
  "shapes",
  "rect",
  "ellipse",
  "roundrect",
  "triangle",
  "line",
  "exit",
  "size",
] as const;

export type LabelIconName = (typeof LABEL_ICON_NAMES)[number];

const BODY: Record<LabelIconName, string> = {
  open: `<path d="M3 8.5 h7 l2 -2.5 h9 v12 H3 Z"/>`,
  save: `<path d="M6 3 h9 l3 3 v15 H6 Z"/><path d="M8 3 v6 h8 V3"/><path d="M8 15 h8"/>`,
  new: `<path d="M7 3 h7 l4 4 v14 H7 Z"/><path d="M14 3 v4 h4"/>`,
  print: `<path d="M7 8 V3 h10 v5"/><path d="M5 8 h14 v7 H5 Z"/><path d="M8 12 h8 v8 H8 Z"/>`,
  connections: `<path d="M9 4 v4"/><path d="M15 4 v4"/><path d="M7 8 h10 v6 H7 Z"/><path d="M12 14 v6"/>`,
  text: `<path d="M8 4 h8"/><path d="M12 4 v16"/><path d="M8 20 h8"/>`,
  memo: `<path d="M6 3 h8 l4 4 v14 H6 Z"/><path d="M14 3 v4 h4"/><path d="M8 11 h8"/><path d="M8 14 h8"/><path d="M8 17 h5"/>`,
  barcode: `<path d="M5 19 V7"/><path d="M8 19 V5"/><path d="M11 19 V8"/><path d="M14 19 V5"/><path d="M17 19 V9"/><path d="M19.5 19 V6"/>`,
  qr: `<path d="M4 4 h6 v6 H4 Z"/><path d="M6 6 h2 v2 H6 Z"/><path d="M14 4 h6 v6 h-6 Z"/><path d="M16 6 h2 v2 h-2 Z"/><path d="M4 14 h6 v6 H4 Z"/><path d="M6 16 h2 v2 H6 Z"/><path d="M14 14 h2"/><path d="M18 14 h2 v2"/><path d="M14 18 h2 v2 h4"/>`,
  picture: `<path d="M4 5 h16 v14 H4 Z"/><path d="M4 15.5 8.5 11 l3 2.5 3.5 -4 4.5 5"/><circle cx="8.5" cy="9" r="1.3"/>`,
  shapes: `<path d="M3.5 3.5 h7 v7 h-7 Z"/><circle cx="17.5" cy="7" r="3.4"/><path d="M5.2 14 h4.6 a2 2 0 0 1 2 2 v3 a2 2 0 0 1 -2 2 h-4.6 a2 2 0 0 1 -2 -2 v-3 a2 2 0 0 1 2 -2 Z"/><path d="M17.5 13.2 21.2 20.6 H13.8 Z"/>`,
  rect: `<path d="M4 4 h16 v16 H4 Z"/>`,
  ellipse: `<circle cx="12" cy="12" r="8"/>`,
  roundrect: `<path d="M7 4 h10 a3 3 0 0 1 3 3 v10 a3 3 0 0 1 -3 3 H7 a3 3 0 0 1 -3 -3 V7 a3 3 0 0 1 3 -3 Z"/>`,
  triangle: `<path d="M12 3.5 21 20.5 H3 Z"/>`,
  line: `<path d="M5 12 H19"/><circle cx="5" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>`,
  exit: `<path d="M8 3 h8 a1 1 0 0 1 1 1 v16 H8 Z"/><path d="M14.5 12 h0.1"/>`,
  size: `<path d="M4 7 h11 v11 H4 Z"/><path d="M13 4 h7 v7"/><path d="M20 4 12 12"/>`,
};

function escAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Inline SVG. The box around it sets 28px or 20px; the stroke stays one weight. */
export function labelIcon(name: LabelIconName, label = ""): string {
  const a11y = label === "" ? `aria-hidden="true"` : `role="img" aria-label="${escAttr(label)}"`;
  return `<svg class="le-icon" data-le-icon="${name}" viewBox="0 0 24 24" ${a11y} focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${BODY[name]}</svg>`;
}
