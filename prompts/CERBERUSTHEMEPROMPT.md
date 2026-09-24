# CERBERUS THEME — comprehensive look-and-feel prompt

**What this is.** A self-contained prompt for reproducing the *look* of the GRIP/Plato "cerberus"
apps — the dark steel-and-gold surface, the honeycomb background with traveling electrical pulses,
and the opening scrawl (PLATO datapad boot → glitch → brand logo → CRT close → arrival blooms).
**No app backbone included or required** — this is pure theme. Everything marked VERBATIM is
copied from the working build (`reference/gripfactorish.html` v0.3.5, itself ported verbatim from
`v5_manual/pages/theme.css` + `boot.js`); paste those blocks as-is. Prose sections explain intent
so an implementing agent makes the right call where it must adapt.

**The mood in one line:** an industrial machine interface from a serious factory — matte black
steel, one confident gold, hairline structure everywhere, electricity alive in the walls. Never
neon, never glassmorphism, never rounded-bubbly. Restraint is the aesthetic; the gold earns its
moments.

---

## 1. Canonical tokens — paste VERBATIM into `:root`

```css
:root{
  --bg:#0c0c0e; --panel:#15161a; --panel-2:#1c1e24; --line:#2a2d35; --border:var(--line); --line-2:#3a3e48;
  --ink:#f4f4f5; --ink-dim:#b6b8c0; --ink-mute:#7a7d88; --gold:#f1c232; --gold-dim:#b4901f; --accent-gold:var(--gold);
  --panel-alt:#181a20; --chassis-steel:#3a3d42; --chassis-steel-2:#2a2c30; --chassis-bezel:#1c1e22;
  --danger:#e05757; --ok:#54b774;
}
:root{
  --bg2:#101116; --panel2:var(--panel-2);
  --ruby:var(--danger); --ruby-dim:#7a2230; --teal:var(--ok);
  --radius:10px;
  --hex-wave-sweep-ms:800ms;
  --font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
}
```

Usage rules (the discipline that makes it read "cerberus"):
- Gold (`--gold` #f1c232) is the ONLY accent. It marks: active states, key numbers, the wave/pulse,
  brand emphasis. Its dim form (`--gold-dim`) for secondary emphasis. Danger/ok exist but are rare.
- Surfaces stack: `--bg` page → `--panel` cards → `--panel-2/--panel-alt` insets. Separation comes
  from 1px `--line` hairlines, never heavy shadows (shadows are reserved for the boot chassis).
- Text: `--ink` primary, `--ink-dim` labels, `--ink-mute` fine print. Gold text on dark; when text
  sits ON gold, use near-black `#1a1500`.

## 2. Typography

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
body{ background:var(--bg); color:var(--ink); font-family:var(--font); font-weight:400;
  letter-spacing:.01em; -webkit-font-smoothing:antialiased; }
h1,h2,h3,.eyebrow,.hd{ text-transform:uppercase; letter-spacing:.08em; }
.mono{ font-variant-numeric:tabular-nums; font-feature-settings:"tnum"; }
```

Headings are ALL-CAPS, letter-spaced (.08–.18em by importance) — machine-label typography, small
sizes (12–14px), weight over size. Numbers always tabular. Body copy normal-case.

## 3. Background system — honeycomb + hex-wave + electric pulses

Three layers on a fixed full-viewport SVG behind everything (`z-index:-1`):
**(a)** a faint hexagon tessellation (the wall), **(b)** a gold "hex-wave" sweep that washes across
the grid on page/screen loads, **(c)** "electricity to ground" — a glowing amber orb that
periodically climbs the grid from a random bottom vertex to the top edge, refracting the grid
through a magnifying lens as it travels.

### 3a. CSS — VERBATIM

```css
#honeycomb{ position:fixed; inset:0; width:100%; height:100%; z-index:-1; pointer-events:none; display:block; }
#honeycomb .hc-base{ fill:none; stroke:rgba(255,255,255,0.055); stroke-width:1; }
#honeycomb .hc-wave{ fill:none; stroke:var(--gold); stroke-width:1.1; opacity:0; }
#honeycomb.hc-wave-on .hc-wave{
  opacity:0.55;
  -webkit-mask-image:linear-gradient(105deg, transparent 42%, #000 50%, transparent 58%);
          mask-image:linear-gradient(105deg, transparent 42%, #000 50%, transparent 58%);
  -webkit-mask-size:260% 100%; mask-size:260% 100%;
  animation:hc-wave-sweep var(--hex-wave-sweep-ms,800ms) ease forwards;
}
@keyframes hc-wave-sweep{
  from{ -webkit-mask-position:165% 0; mask-position:165% 0; }
  to  { -webkit-mask-position:-165% 0; mask-position:-165% 0; }
}
.hc-pulse{ fill:none; stroke:var(--gold); stroke-width:2; stroke-linecap:round; stroke-linejoin:round;
  filter:drop-shadow(0 0 4px var(--gold)) drop-shadow(0 0 10px rgba(241,194,50,0.7)); }
.hc-lens-line{ fill:none; stroke:rgba(235,216,150,0.24); stroke-width:1; }
.hc-bulge-core{ fill:#e9d57f; opacity:0.7; filter:drop-shadow(0 0 4px rgba(241,194,50,0.5)) drop-shadow(0 0 9px rgba(241,194,50,0.38)); }
#app{ position:relative; z-index:1; }
@media (prefers-reduced-motion: reduce){ #honeycomb.hc-wave-on .hc-wave{ animation:none; opacity:0; } }
```

Key intent: the base grid is *barely there* (5.5% white). The wave is a one-shot diagonal light
sweep (a masked copy of the same grid in gold), fired on arrival and on every screen change — the
building acknowledging you. The pulse is not a drawn line: it's an invisible path followed by a
**lens** — a spindle-shaped clip window showing a 1.6× magnified copy of the grid (so the lattice
appears to bulge/refract) with a small amber orb (#e9d57f, r=2.6) at its center.

### 3b. JavaScript — VERBATIM (geometry, pathfinding, lens animation)

```js
const SVGNS='http://www.w3.org/2000/svg';
const HC = { R:26, svg:null, verts:null, bottoms:[], w:0, h:0, d:'', lensSeq:0 };
function reducedMotion(){ return typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }

function buildHoneycomb(){
  let svg=document.getElementById('honeycomb');
  if(!svg){ svg=document.createElementNS(SVGNS,'svg'); svg.id='honeycomb'; svg.setAttribute('aria-hidden','true'); document.body.appendChild(svg); }
  while(svg.firstChild) svg.removeChild(svg.firstChild);
  const W=HC.w=window.innerWidth, H=HC.h=window.innerHeight, R=HC.R;
  svg.setAttribute('width',W); svg.setAttribute('height',H); svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const hexW=Math.sqrt(3)*R, vSpace=1.5*R;
  const verts=new Map(); const edges=new Set();
  const vkey=(x,y)=>Math.round(x)+'_'+Math.round(y);
  function vert(x,y){ const k=vkey(x,y); let v=verts.get(k); if(!v){ v={key:k,x,y,nbrs:new Map()}; verts.set(k,v); } return v; }
  function addEdge(ax,ay,bx,by){ const a=vert(ax,ay), b=vert(bx,by);
    const ek=a.key<b.key?a.key+'|'+b.key:b.key+'|'+a.key; if(edges.has(ek)) return; edges.add(ek);
    const w=Math.hypot(a.x-b.x,a.y-b.y); a.nbrs.set(b.key,w); b.nbrs.set(a.key,w); }
  const cols=Math.ceil(W/hexW)+2, rows=Math.ceil(H/vSpace)+2;
  for(let row=-1; row<rows; row++) for(let col=-1; col<cols; col++){
    const cx=col*hexW + (Math.abs(row%2)?hexW/2:0), cy=row*vSpace;
    const p=[]; for(let k=0;k<6;k++){ const a=Math.PI/180*(60*k-90); p.push([cx+R*Math.cos(a), cy+R*Math.sin(a)]); }
    for(let k=0;k<6;k++){ const q=p[(k+1)%6]; addEdge(p[k][0],p[k][1],q[0],q[1]); }
  }
  let d=''; edges.forEach(ek=>{ const [k1,k2]=ek.split('|'); const a=verts.get(k1), b=verts.get(k2);
    d+=`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`; });
  const base=document.createElementNS(SVGNS,'path'); base.setAttribute('class','hc-base'); base.setAttribute('d',d); svg.appendChild(base);
  const wave=document.createElementNS(SVGNS,'path'); wave.setAttribute('class','hc-wave'); wave.setAttribute('d',d); svg.appendChild(wave);
  HC.svg=svg; HC.verts=verts; HC.d=d;
  HC.bottoms=[...verts.values()].filter(v=>v.y>=H-R*1.2);
}

// Most-vertical climb: from origin, always step to the upward neighbor with the smallest
// horizontal change (prefers the hex's vertical edges), tie-broken toward the origin's x.
function mostVerticalPath(startKey){
  const V=HC.verts, R=HC.R;
  let cur=V.get(startKey); const startX=cur.x;
  const out=[[cur.x,cur.y]]; const seen=new Set([startKey]); let guard=0;
  while(cur.y>R*1.2 && guard++<4000){
    let best=null;
    cur.nbrs.forEach((w,nk)=>{ const n=V.get(nk);
      if(n.y < cur.y-0.1 && !seen.has(nk)){
        if(!best){ best=n; return; }
        const da=Math.abs(n.x-cur.x), db=Math.abs(best.x-cur.x);
        if(da<db-0.1 || (Math.abs(da-db)<0.1 && Math.abs(n.x-startX)<Math.abs(best.x-startX))) best=n;
      }});
    if(!best) break;
    seen.add(best.key); out.push([best.x,best.y]); cur=best;
  }
  return out; // origin (bottom) → top
}

function firePulse(){
  if(!HC.verts || !HC.bottoms.length || reducedMotion()) return;
  const start=HC.bottoms[Math.floor(Math.random()*HC.bottoms.length)];
  let pts=mostVerticalPath(start.key);
  if(!pts || pts.length<2) return;
  const d='M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join('L');
  const path=document.createElementNS(SVGNS,'path'); path.setAttribute('d',d);
  path.style.fill='none'; path.style.stroke='none';
  HC.svg.appendChild(path);
  const L=path.getTotalLength();
  const lid='hclens'+(++HC.lensSeq);
  const clip=document.createElementNS(SVGNS,'clipPath'); clip.setAttribute('id',lid); clip.setAttribute('clipPathUnits','userSpaceOnUse');
  const clipShape=document.createElementNS(SVGNS,'path'); clip.appendChild(clipShape); HC.svg.appendChild(clip);
  const lensG=document.createElementNS(SVGNS,'g'); lensG.setAttribute('clip-path',`url(#${lid})`);
  const lensLine=document.createElementNS(SVGNS,'path'); lensLine.setAttribute('class','hc-lens-line'); lensLine.setAttribute('d',HC.d);
  lensG.appendChild(lensLine); HC.svg.appendChild(lensG);
  const core=document.createElementNS(SVGNS,'circle'); core.setAttribute('class','hc-bulge-core'); core.setAttribute('r','2.6'); HC.svg.appendChild(core);
  const A=18, B=6.5, MAG=1.6;   // aperture half-length / half-width; lens magnification
  function spindleD(px,py,tx,ty){
    const nx=-ty, ny=tx;
    const fx=px+tx*A, fy=py+ty*A, rx=px-tx*A, ry=py-ty*A;
    const c1x=px+nx*2*B, c1y=py+ny*2*B, c2x=px-nx*2*B, c2y=py-ny*2*B;
    return `M${fx.toFixed(1)} ${fy.toFixed(1)}Q${c1x.toFixed(1)} ${c1y.toFixed(1)} ${rx.toFixed(1)} ${ry.toFixed(1)}`
         + `Q${c2x.toFixed(1)} ${c2y.toFixed(1)} ${fx.toFixed(1)} ${fy.toFixed(1)}Z`;
  }
  const dur=Math.min(950, Math.max(475, L*0.525)), t0=performance.now();
  (function step(t){
    const k=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-k,2); // ease-out
    const s=L*e;
    const p=path.getPointAtLength(s);
    const pa=path.getPointAtLength(Math.max(0,s-2)), pb=path.getPointAtLength(Math.min(L,s+2));
    let dx=pb.x-pa.x, dy=pb.y-pa.y, m=Math.hypot(dx,dy)||1; dx/=m; dy/=m;
    clipShape.setAttribute('d', spindleD(p.x,p.y,dx,dy));
    lensLine.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${MAG}) translate(${(-p.x).toFixed(1)} ${(-p.y).toFixed(1)})`);
    core.setAttribute('cx',p.x); core.setAttribute('cy',p.y);
    if(k<1) requestAnimationFrame(step);
    else { lensG.style.transition=core.style.transition='opacity .3s ease';
      requestAnimationFrame(()=>{ lensG.style.opacity='0'; core.style.opacity='0'; });
      setTimeout(()=>{ path.remove(); clip.remove(); lensG.remove(); core.remove(); }, 360); }
  })(t0);
}

function hcWave(){
  const svg=HC.svg; if(!svg || reducedMotion()) return;
  svg.classList.remove('hc-wave-on'); void svg.getBoundingClientRect(); // restart animation
  svg.classList.add('hc-wave-on');
  setTimeout(()=>svg.classList.remove('hc-wave-on'), 1100);
}

(function initHoneycomb(){
  buildHoneycomb();
  let rt; window.addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(buildHoneycomb,250); });
  setTimeout(firePulse, 6000);        // first pulse shortly after load
  setInterval(firePulse, 15000);      // steady cadence: every 15s
  (function randomPulse(){ const delay=10000+Math.random()*50000;   // second, independent emitter
    setTimeout(()=>{ firePulse(); randomPulse(); }, delay); })();
})();
```

Numbers that define the feel (don't tune casually): hex radius `R=26`px pointy-top; pulse cadence =
fixed 15s emitter + an independent random 10–60s emitter (two sources so it never feels metronomic;
first pulse at 6s); pulse duration clamped 475–950ms scaling with path length (~2× "natural" speed,
ease-out — fast launch, soft arrival at the top edge — "electricity to ground" runs bottom→top).
Call `hcWave()` on every screen/page change, not just load. (A Dijkstra shortest-to-top variant
also exists in the source; the shipped pulse uses the most-vertical climb above — it hugs the
hexes' vertical edges and reads more like electricity.)

## 4. The opening scrawl — PLATO datapad boot splash

Five phases, ≈4.98s: **boot-in** (dark overlay, steel chassis rises, gold CRT screen showing the
PLATO mark) → **hold** 2.3s (scanlines drifting) → **glitch** 0.68s (screen tears/RGB-splits; at
~45% through, the on-screen image swaps PLATO → YOUR brand graphic) → **reveal hold** 1.15s →
**CRT close** (screen collapses to a scanline, blinks out, chassis fades). Then the app fades in
and the arrival blooms fire (§5).

The chassis is a hand-held industrial datapad: steel gradient body with corner screws, a header
reading `PLATO` over `Digital Alchemy` in letter-spaced caps, a gold-lit bezeled screen, and an
8-key keypad strip with a version tag (`PL-v1g-fix1`).

**The complete verbatim CSS + JS recipe for this splash — timings, glitch keyframes, DOM builder,
image-swap and reduced-motion path, plus a video-variant option — lives in
`docs/PLATO_STINGER_SPEC.md` in this repo. Use it as-is; it is the same build this file describes.**
Cumulative timeline for reference: 0ms boot-in → 300ms hold → 2600ms glitch starts → 2906ms image
swap → 3280ms glitch ends → 4430ms collapse → 4630 scanline → 4730 off → 4830 chassis-out → 4980
overlay removed. Customization points: the render-to graphic (one `img.src`), the brand/subtitle
strings, the keypad tag. Timing knobs: `PLATO_DWELL_MS` (1800+500), `GLITCH_MS` (680), swap
fraction 0.45, `GRIP_DWELL_MS` (1150).

Asset rules (hard-won): the canonical PLATO mark is the **pixel-art bust PNG** — never the old
abstract SVG (explicitly forbidden in source comments). On image-load error the Plato mark hides
(no fallback); a missing brand logo falls back to a minimal inline SVG mark. Both screen images
share one fixed 168px `object-fit:contain` slot so the chassis never resizes on swap.

## 5. Arrival — app fade-in + logo blooms + wave

After the splash removes itself: the app fades in (`#app{opacity:0; transition:opacity .5s ease}` →
`.show{opacity:1}`), and 260ms later three things fire together: a hex **bloom** off the left brand
logo sweeping LEFT off-screen, a bloom off the right brand logo sweeping RIGHT, and one `hcWave()`.

```css
.logo-bloom { position: fixed; inset: 0; z-index: 60; pointer-events: none; color: var(--accent-gold); overflow: visible; }
.logo-bloom polygon {
  fill: none; stroke: currentColor; stroke-width: 2;
  transform-box: fill-box; transform-origin: center; will-change: transform, opacity;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent-gold) 55%, transparent));
}
@keyframes logo-bloom-sweep-left {
  0%   { transform: translateX(0) scale(1.05); opacity: var(--op, 0.85); }
  100% { transform: translateX(calc(-1 * var(--sweep, 300px))) scale(1.9); opacity: 0; }
}
@keyframes logo-bloom-sweep-right {
  0%   { transform: translateX(0) scale(1.05); opacity: var(--op, 0.85); }
  100% { transform: translateX(var(--sweep, 600px)) scale(1.9); opacity: 0; }
}
.logo-bloom-kick { animation: logo-bloom-kick 320ms ease-out; }
@keyframes logo-bloom-kick { 0%,100% { transform: scale(1); } 45% { transform: scale(1.07); } }
@media (prefers-reduced-motion: reduce) { .logo-bloom { display: none !important; } .logo-bloom-kick { animation: none; } }
```

```js
function hexPolyPoints(cx,cy,r){
  const p=[]; for(let k=0;k<6;k++){ const a=Math.PI/180*(60*k-90);
    p.push((cx+r*Math.cos(a)).toFixed(1)+','+(cy+r*Math.sin(a)).toFixed(1)); }
  return p.join(' ');
}
function playLogoBloom(el, dir){
  if(!el || (typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const rect=el.getBoundingClientRect(); if(rect.width<=0) return;
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  const r=Math.max(rect.width,rect.height)/1.7320508*0.95;
  const sweep = dir==='left' ? (cx+rect.width) : (window.innerWidth - cx + rect.width);
  const svg=document.createElementNS(SVGNS,'svg');
  svg.setAttribute('class','logo-bloom');
  svg.setAttribute('width',window.innerWidth); svg.setAttribute('height',window.innerHeight);
  svg.setAttribute('viewBox',`0 0 ${window.innerWidth} ${window.innerHeight}`);
  svg.setAttribute('aria-hidden','true');
  [{d:0,op:0.85,ms:620},{d:100,op:0.6,ms:720},{d:200,op:0.45,ms:820}].forEach(ring=>{
    const poly=document.createElementNS(SVGNS,'polygon');
    poly.setAttribute('points',hexPolyPoints(cx,cy,r));
    poly.style.setProperty('--sweep', sweep+'px');
    poly.style.setProperty('--op', String(ring.op));
    poly.style.opacity=String(ring.op);
    poly.style.animation=`logo-bloom-sweep-${dir} ${ring.ms}ms cubic-bezier(0.16,0.84,0.44,1) ${ring.d}ms forwards`;
    svg.appendChild(poly);
  });
  document.body.appendChild(svg);
  el.classList.add('logo-bloom-kick');
  setTimeout(()=>{ svg.remove(); el.classList.remove('logo-bloom-kick'); }, 1100);
}
// arrival wiring (fires 260ms after the splash overlay is removed):
// playLogoBloom(leftLogoEl,'left'); playLogoBloom(rightLogoEl,'right'); hcWave();
```

Three staggered hex rings (delays 0/100/200ms, opacities .85/.6/.45) expand ~1.9× while sweeping
to the screen edge; the logo itself does a 320ms 1.07× "kick".

## 6. Chrome (minimal, for context)

Sticky banner: `linear-gradient(180deg,#15161a,#101116)`, 1px `--line` bottom border, brand row =
30px logo marks + 14px/700 letter-spaced title with the key word in gold (`.brand-title b`).
Segmented controls: hairline-bordered pill; the active segment is solid gold with near-black text
(`background:var(--gold); color:#1a1500; font-weight:700`). Panels: `--panel` on `--bg`, 10px
radius, hairline borders. Collapsibles use a rotating `▶` chevron. Zero-value table cells render
`·` in `--ink-mute` rather than "0".

## 7. Integration checklist for the implementing agent

1. Tokens + typography (§1–2) into `:root`/`body`. Nothing else colors anything gold by accident.
2. Honeycomb (§3): CSS + JS verbatim; it self-mounts (`initHoneycomb`), rebuilds on resize
   (250ms debounce), and needs only `body` + a `z-index:1` app container above it.
3. Splash (§4): follow `docs/PLATO_STINGER_SPEC.md` verbatim; swap the render-to graphic and brand
   strings for the target app; keep the 168px fixed slot.
4. Arrival (§5): app fade-in, two blooms, one `hcWave()`, 260ms after splash removal.
5. Fire `hcWave()` on every subsequent screen/route change.
6. Reduced motion: every effect above already gates on `prefers-reduced-motion` — keep those gates
   when adapting (splash falls back to a plain fade; grid stays static; blooms/pulses skip).
7. Vanilla-JS reference; for React/TS ports keep the constants and keyframes byte-identical
   (a proven TS port of the splash exists at `web/src/ui/stinger.{ts,css}`).

**Provenance:** tokens verbatim from `v5_manual/pages/theme.css` (lines 1–30); splash ported from
`v5_manual` `boot.js` / theme.css 770–985; blooms are the v5 hex-shield-bloom retargeted to logos;
honeycomb + lens-pulse are the gripfactorish evolution of the v5 hex texture. Per ADR-026 the
shared design-system kit is deferred to the PLATO era — until then this document and the two files
it cites are the theme's source of truth. Do not invent new aesthetics on top; carry this one.
