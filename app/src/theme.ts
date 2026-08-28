export function themeStylesheet(): string {
  return `/* =====================================================================
   THEME TOKEN SLOTS  --  GRIP (neutral slice 1; real skin later)
   --------------------------------------------------------------------- */
:root[data-theme="grip"] {
  --bg: #f3efe6;
  --panel: #fffdf8;
  --panel-2: #e8e2d4;
  --text: #1c1914;
  --text-dim: #5c564c;
  --line: #c9c0ae;
  --accent: #4f6b4a;
  --accent-text: #ffffff;
  --danger: #8b2e2e;
  --ok: #2f5d3a;
  --focus: #2b4c7e;
  --font: system-ui, -apple-system, "Segoe UI", sans-serif;
  --radius: 10px;
}

/* =====================================================================
   THEME TOKEN SLOTS  --  C10 (neutral slice 1; real skin later)
   --------------------------------------------------------------------- */
:root[data-theme="c10"] {
  --bg: #eef1f5;
  --panel: #ffffff;
  --panel-2: #dce3ec;
  --text: #16181c;
  --text-dim: #5a616b;
  --line: #b7c0cc;
  --accent: #3d5a80;
  --accent-text: #ffffff;
  --danger: #8b2e2e;
  --ok: #2f5d3a;
  --focus: #3d5a80;
  --font: system-ui, -apple-system, "Segoe UI", sans-serif;
  --radius: 10px;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  font-size: 1.2rem;
  line-height: 1.4;
}
a { color: var(--accent); }
header.app-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.2rem;
  background: var(--panel);
  border-bottom: 2px solid var(--line);
}
.brand { font-weight: 700; letter-spacing: 0.04em; }
nav a { margin-right: 0.9rem; font-weight: 600; }
main { max-width: 76rem; margin: 0 auto; padding: 1.2rem; }
h1 { font-size: 1.8rem; margin: 0 0 1rem; }
h2 { font-size: 1.3rem; margin: 1.4rem 0 0.6rem; }
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0.9rem;
}
.tile {
  display: block;
  background: var(--panel);
  border: 2px solid var(--line);
  border-radius: var(--radius);
  padding: 1rem 1.1rem;
  text-decoration: none;
  color: inherit;
  min-height: 6.5rem;
}
.tile:focus, .tile:hover { border-color: var(--accent); }
.tile-kind { font-size: 0.85rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
.tile-title { display: block; font-size: 1.35rem; font-weight: 700; margin: 0.25rem 0; }
.tile-count { font-size: 1.6rem; font-weight: 700; color: var(--accent); }
.banner {
  padding: 0.8rem 1rem;
  border-radius: var(--radius);
  margin-bottom: 1rem;
  border: 2px solid var(--line);
  background: var(--panel);
}
.banner.ok { border-color: var(--ok); }
.banner.err { border-color: var(--danger); color: var(--danger); }
.hbn-mint {
  font-size: 2.1rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  word-break: break-all;
  background: var(--panel);
  border: 3px solid var(--accent);
  padding: 0.8rem 1rem;
  border-radius: var(--radius);
  margin: 0.6rem 0 1rem;
}
form.stack, .stack { display: flex; flex-direction: column; gap: 0.85rem; max-width: 40rem; }
label.field { display: flex; flex-direction: column; gap: 0.3rem; font-weight: 600; }
input, select, textarea, button {
  font-family: inherit;
  font-size: 1.15rem;
  line-height: 1.3;
}
input[type="text"], input[type="date"], input[type="time"], input[type="number"], select, textarea {
  width: 100%;
  min-height: 2.8rem;
  padding: 0.45rem 0.65rem;
  border: 2px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
}
textarea { min-height: 5rem; }
input:focus, select:focus, textarea:focus, button:focus {
  outline: 3px solid var(--focus);
  outline-offset: 1px;
}
button, .btn {
  min-height: 2.8rem;
  padding: 0.45rem 1rem;
  border-radius: 8px;
  border: 2px solid var(--accent);
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
button.secondary, a.btn.secondary {
  background: var(--panel);
  color: var(--text);
  border-color: var(--line);
}
button.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.row-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
table.data {
  width: 100%;
  border-collapse: collapse;
  background: var(--panel);
  font-size: 1.05rem;
}
table.data th, table.data td {
  text-align: left;
  padding: 0.55rem 0.6rem;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
table.data th { background: var(--panel-2); }
.person-form { display: flex; gap: 0.4rem; align-items: center; }
.person-form select { min-width: 12rem; }
.muted { color: var(--text-dim); }
.pkg-table { max-width: none; width: 100%; }
.wide { max-width: none; }
`;
}
