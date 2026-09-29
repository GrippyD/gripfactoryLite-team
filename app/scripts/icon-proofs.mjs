/**
 * THE ICONS AS LINE ART (canon 0.30.282). Writes the proof sheet for his eye.
 * Run from app/: node --experimental-strip-types scripts/icon-proofs.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONSOLE_ICON_LABELS, CONSOLE_ICON_NAMES, TRAILER_CARGO, consoleIconSvg } from "../src/consoleicons.ts";

const DATE = "2026-09-29";
const BRANCH = "GFLiteOpsDashboard";
const here = dirname(fileURLToPath(import.meta.url));
const modulePath = resolve(here, "../src/consoleicons.ts");
const moduleBytes = readFileSync(modulePath);
const moduleSha = createHash("sha256").update(moduleBytes).digest("hex");
const outPath = resolve(here, "../../SESSION_REPORTS/2026-09-29_icon_proofs.html");

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(name) {
  const svg = consoleIconSvg(name);
  const bytes = Buffer.byteLength(svg);
  const slots = [28, 64, 160]
    .map((h) => `<span class="slot s${h}">${svg}</span>`)
    .join("");
  return `<div class="row"><div class="meta"><span class="key">${esc(name)}</span><span class="label">${esc(CONSOLE_ICON_LABELS[name])}</span><span class="bytes">${bytes} bytes</span></div>${slots}</div>`;
}

function shippingPreview() {
  const { x, y, width, height } = TRAILER_CARGO;
  const band = height / 3;
  const rects = [0, 1, 2]
    .map((i) => {
      const top = Math.round((y + i * band) * 100) / 100;
      const h = Math.round(band * 100) / 100;
      return `<rect x="${x}" y="${top}" width="${width}" height="${h}" fill="currentColor" stroke="none"/>`;
    })
    .join("");
  return consoleIconSvg("shipping").replace("</svg>", `<g data-proof-cargo>${rects}</g></svg>`);
}

const views = [
  { id: "lite", title: "Lite", ground: "#f3efe6", panel: "#fffdf8", ink: "#1c1914", line: "#c9c0ae" },
  { id: "co", title: "Continuum", ground: "#0e0f11", panel: "#16171b", ink: "#e9e9ea", line: "#2a2b30" },
  { id: "cerberus", title: "Cerberus", ground: "#0c0c0e", panel: "#141418", ink: "#f4f4f5", line: "#2a2d35" },
];

const panels = views
  .map(
    (view) => `<section class="view" style="background:${view.ground};color:${view.ink}">
<h2 style="border-color:${view.line}">${view.title}</h2>
<div class="panel" style="background:${view.panel};border-color:${view.line}">
${CONSOLE_ICON_NAMES.map(row).join("\n")}
</div>
</section>`
  )
  .join("\n");

const hooks = `<section class="view hooks" style="background:#0c0c0e;color:#f4f4f5">
<h2 style="border-color:#2a2d35">The hooks</h2>
<div class="panel" style="background:#141418;border-color:#2a2d35">
<div class="row"><div class="meta"><span class="key">rad</span><span class="label">body in silo green</span></div><span class="slot s160">${consoleIconSvg("rad")}</span></div>
<div class="row"><div class="meta"><span class="key">cryo</span><span class="label">bars in waste red</span></div><span class="slot s160">${consoleIconSvg("cryo")}</span></div>
<div class="row"><div class="meta"><span class="key">shipping</span><span class="label">three bands in the trailer</span></div><span class="slot s160">${shippingPreview()}</span></div>
<div class="row"><div class="meta"><span class="key">siren</span><span class="label">lamp in waste red</span></div><span class="slot s160">${consoleIconSvg("siren")}</span></div>
</div>
</section>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Icon proofs ${DATE}</title>
<style>
body { margin: 0; font-family: Georgia, "Times New Roman", serif; }
h1, h2, p, .meta { font-family: "Segoe UI", sans-serif; }
h1 { font-size: 1.4rem; margin: 0 0 0.3rem; }
.banner { padding: 1.2rem 1.4rem 0.4rem; color: #1c1914; background: #f3efe6; }
.banner p { margin: 0.2rem 0 0.8rem; }
.view { padding: 1rem 1.2rem 1.4rem; }
h2 { margin: 0 0 0.8rem; font-size: 1rem; letter-spacing: 0.04em; text-transform: uppercase; border-bottom: 1px solid; padding-bottom: 0.3rem; }
.panel { border: 1px solid; padding: 0.6rem 0.8rem; }
.row { display: flex; align-items: center; gap: 1rem; padding: 0.45rem 0; border-bottom: 1px solid rgba(128,128,128,0.25); }
.meta { width: 14rem; flex: 0 0 14rem; }
.key { display: block; font-weight: 700; }
.label, .bytes { display: block; font-size: 0.85rem; opacity: 0.8; }
.hc-icon { width: auto; display: block; }
.s28 .hc-icon { height: 28px; }
.s64 .hc-icon { height: 64px; }
.s160 .hc-icon { height: 160px; }
.hooks [data-icon-rad-body] { stroke: #2e9e4f; }
.hooks [data-icon-cryo-flow] { fill: #7c1b1b; fill-opacity: 1; }
.hooks [data-proof-cargo] rect:nth-child(1) { fill: #4f6b4a; }
.hooks [data-proof-cargo] rect:nth-child(2) { fill: #2e9e4f; }
.hooks [data-proof-cargo] rect:nth-child(3) { fill: #2f6fd6; }
.hooks [data-icon-siren-lamp] { fill: #7c1b1b; }
</style>
</head>
<body>
<header class="banner">
<h1>Icon proofs</h1>
<p>${DATE}. Branch ${BRANCH}. Module ${moduleBytes.length} bytes. sha256 ${moduleSha}.</p>
</header>
${panels}
${hooks}
</body>
</html>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(outPath);
console.log(moduleBytes.length, moduleSha);
