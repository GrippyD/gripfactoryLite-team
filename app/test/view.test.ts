import { describe, expect, it } from "vitest";
import { asDevice, asView, DEFAULT_VIEW, DEVICES, VIEWS } from "../src/config";
import { layout } from "../src/html";
import { t } from "../src/i18n";
import { cerberusStylesheet, coStylesheet, liteStylesheet, salesHelperCerberusSkin, themeStylesheet } from "../src/theme";

describe("view normalizer (owner ruling 2026-09-01; canon 0.30.28 makes co the default)", () => {
  it("defaults to co when the value is absent or garbage (owner, verbatim: \"Make the continuum format loading default\")", () => {
    expect(DEFAULT_VIEW).toBe("co");
    expect(asView(undefined)).toBe("co");
    expect(asView(null)).toBe("co");
    expect(asView("")).toBe("co");
    expect(asView("grip")).toBe("co");
    expect(asView("CERBERUS")).toBe("co");
    expect(asView("CO")).toBe("co");
    expect(asView(0)).toBe("co");
  });

  it("honors the three real values (owner ruling 2026-09-01: asView accepts co)", () => {
    expect(asView("cerberus")).toBe("cerberus");
    expect(asView("lite")).toBe("lite");
    expect(asView("co")).toBe("co");
    expect(VIEWS).toEqual(["cerberus", "lite", "co"]);
  });
});

describe("device normalizer (owner ruling 2026-09-01: the device pill)", () => {
  it("defaults to computer when the value is absent or garbage", () => {
    expect(asDevice(undefined)).toBe("computer");
    expect(asDevice(null)).toBe("computer");
    expect(asDevice("")).toBe("computer");
    expect(asDevice("tablet")).toBe("computer");
    expect(asDevice("PHONE")).toBe("computer");
    expect(asDevice(0)).toBe("computer");
  });

  it("honors the two real values", () => {
    expect(asDevice("computer")).toBe("computer");
    expect(asDevice("phone")).toBe("phone");
    expect(DEVICES).toEqual(["computer", "phone"]);
  });
});

describe("cerberus view layout (owner ruling 2026-09-01)", () => {
  // Canon 0.30.28: the loading default moved to co, so these Cerberus pins name
  // their view; the default itself is pinned in the next test.
  const base = {
    title: "Home",
    theme: "grip",
    personEmail: "pat@gripcannabis.com",
    body: "<p>x</p>",
    view: "cerberus" as const,
  };

  it("defaults to the Continuum sheet when no view is given (canon 0.30.28, verbatim: \"Make the continuum format loading default\")", () => {
    const { view: _drop, ...noView } = base;
    const html = layout(noView);
    expect(html).toContain("--bg: #0e0f11");
    expect(html).toContain('"Palatino Linotype"');
    expect(html).toContain('name="view" value="co" class="view-opt view-opt-co active" aria-pressed="true"');
    expect(html).not.toContain("--gold:#f1c232");
    expect(html).not.toContain('id="boot-scrawl"');
  });

  it("emits the Cerberus tokens and the honeycomb background in the cerberus view", () => {
    const html = layout(base);
    expect(html).toContain("--gold:#f1c232");
    expect(html).toContain("#honeycomb");
    expect(html).toContain("buildHoneycomb");
    expect(html).toContain("hc-wave");
    expect(html).toContain("fonts.googleapis.com/css2?family=Inter");
    // The verbatim constants that define the feel.
    expect(html).toContain("R:26");
    expect(html).toContain("setTimeout(firePulse, 6000)");
    expect(html).toContain("setInterval(firePulse, 15000)");
    // Reduced motion gates ride along verbatim.
    expect(html).toContain("prefers-reduced-motion");
  });

  it("emits none of the Cerberus chrome in lite; lite keeps today's tokens", () => {
    const html = layout({ ...base, view: "lite" });
    expect(html).not.toContain("--gold:#f1c232");
    expect(html).not.toContain("#honeycomb");
    expect(html).not.toContain("buildHoneycomb");
    expect(html).not.toContain("boot-scrawl");
    expect(html).not.toContain("gf_boot_seen");
    expect(html).toContain("--bg: #f3efe6;");
    expect(html).toContain(':root[data-theme="c10"]');
  });

  it("keeps the THEME env plumbing on the html element in both views", () => {
    expect(layout(base)).toContain('data-theme="grip"');
    expect(layout({ ...base, theme: "c10" })).toContain('data-theme="c10"');
    expect(layout({ ...base, view: "lite", theme: "c10" })).toContain('data-theme="c10"');
  });

  it("renders the three-segment view pill with the active view marked, every view", () => {
    const cerb = layout(base);
    expect(cerb).toContain('action="/view"');
    expect(cerb).toContain('name="view" value="cerberus" class="view-opt active" aria-pressed="true"');
    expect(cerb).toContain('name="view" value="lite" class="view-opt" aria-pressed="false"');
    expect(cerb).toContain('name="view" value="co" class="view-opt view-opt-co" aria-pressed="false"');
    // Owner ruling 2026-09-01: the first segment's label is Grip now; the
    // posted cookie value stays cerberus so existing cookies keep working.
    expect(cerb).toContain(">Grip</button>");
    expect(cerb).not.toContain(">Cerberus</button>");
    expect(cerb).toContain(">Lite</button>");
    // The CO segment's content is the CO mark inline svg, about 1em tall,
    // named Continuum for assistive tech.
    expect(cerb).toContain('class="co-pill-mark"');
    expect(cerb).toContain('viewBox="0 0 412 280"');
    expect(cerb).toContain('aria-label="Continuum"');
    const lite = layout({ ...base, view: "lite" });
    expect(lite).toContain('name="view" value="lite" class="view-opt active" aria-pressed="true"');
    expect(lite).toContain('name="view" value="cerberus" class="view-opt" aria-pressed="false"');
    const co = layout({ ...base, view: "co" });
    expect(co).toContain('name="view" value="co" class="view-opt view-opt-co active" aria-pressed="true"');
    expect(co).toContain('name="view" value="cerberus" class="view-opt" aria-pressed="false"');
    // The locale pill still stands beside it in every view.
    expect(cerb).toContain('action="/locale"');
    expect(lite).toContain('action="/locale"');
    expect(co).toContain('action="/locale"');
  });

  it("labels the pill with proper nouns rendering the same in es", () => {
    expect(t("en", "Grip")).toBe("Grip");
    expect(t("es", "Grip")).toBe("Grip");
    expect(t("en", "Lite")).toBe("Lite");
    expect(t("es", "Lite")).toBe("Lite");
    expect(t("en", "Continuum")).toBe("Continuum");
    expect(t("es", "Continuum")).toBe("Continuum");
    const es = layout({ ...base, locale: "es" });
    expect(es).toContain(">Grip</button>");
    expect(es).toContain(">Lite</button>");
    expect(es).toContain('aria-label="Continuum"');
  });

  it("renders the co view on its own Continuum sheet (owner dispatch 2026-09-02: the CO stylesheet landed)", () => {
    const co = layout({ ...base, view: "co" });
    // Canon 0.19.0: Christine's dark tokens are the always look.
    expect(co).toContain("--bg: #0e0f11");
    expect(co).toContain("--primary: #c88a3c");
    expect(co).toContain('"Palatino Linotype"');
    // Paper-light tokens stay in the file for a future flip-back.
    expect(co).toContain("--bg: #f6f4ef");
    expect(co).toContain("--primary: #b3762b");
    // The Cerberus chrome is Cerberus's alone: no scrawl, no honeycomb, no gold.
    expect(co).not.toContain("--gold:#f1c232");
    expect(co).not.toContain("#honeycomb");
    expect(co).not.toContain("buildHoneycomb");
    expect(co).not.toContain('id="boot-scrawl"');
  });

  it("inverts Continuum to dark-always in both color schemes", () => {
    const css = coStylesheet();
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("@media (prefers-color-scheme: light)");
    expect(css).toContain("--primary: #c88a3c");
    expect(css).toContain("--bg: #0e0f11");
    expect(css).toContain("--key-sheen: rgba(255, 255, 255, 0.07)");
    // The env attribute carries grip/c10, never light/dark: tokens on bare :root.
    expect(css).not.toContain(':root[data-theme="dark"]');
    expect(css).not.toContain(':root[data-theme="grip"]');
    // The signature ground and language survive the translation.
    expect(css).toContain("repeating-linear-gradient(118deg");
    expect(css).toContain("--radius: 14px");
    expect(css).toContain("border-radius: 999px");
    expect(css).toContain(".working-pick");
  });

  it("carries the boot scrawl only in cerberus, with the session guard and the skip paths", () => {
    const cerb = layout(base);
    expect(cerb).toContain('id="boot-scrawl"');
    // Hidden markup: the content never gates behind the overlay.
    expect(cerb).toContain('<div id="boot-scrawl" hidden>');
    // Once per browser session, storage failure skips (try/catch).
    expect(cerb).toContain("gf_boot_seen");
    expect(cerb).toContain("sessionStorage.getItem('gf_boot_seen')");
    expect(cerb).toContain("catch(err){ seen=true; }");
    // Click anywhere skips immediately; reduced motion skips entirely.
    expect(cerb).toContain("el.addEventListener('click',finish)");
    expect(cerb).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    // The prompt's closing beat: overlay removed at 4980ms.
    expect(cerb).toContain("at(4980,finish)");
  });

  it("emits the verbatim scripts with no leaked template escapes", () => {
    const cerb = layout(base);
    expect(cerb).not.toContain("\\`");
    expect(cerb).not.toContain("\\${");
    expect(cerb).toContain("svg.setAttribute('viewBox',`0 0 ${W} ${H}`)");
  });

  it("enforces the Lite identity law (canon 0.20.1): no icons, no animations, no texture, flat buttons", () => {
    const lite = liteStylesheet();
    expect(lite).toContain("LITE IDENTITY LAW");
    expect(lite).toContain("transition: none !important; animation: none !important;");
    expect(lite).toContain(".ops-icon-box { display: none; }");
    expect(lite).toContain(".ops-icon-on-dark, .ops-icon-on-light { display: none; }");
    expect(lite).toContain(".device-word { display: inline; }");
    expect(lite).toContain("background-image: none !important;");
    // The glyph views keep their icons and hide the pill words.
    for (const sheet of [cerberusStylesheet(), coStylesheet()]) {
      expect(sheet).toContain(".ops-icon-on-dark { display: block; }");
      expect(sheet).toContain(".device-word { display: none; }");
      expect(sheet).not.toContain("LITE IDENTITY LAW");
    }
  });

  it("dispatches the stylesheet by view and defaults to co (canon 0.30.28)", () => {
    expect(themeStylesheet("lite")).toBe(liteStylesheet());
    expect(themeStylesheet("cerberus")).toBe(cerberusStylesheet());
    expect(themeStylesheet()).toBe(coStylesheet());
    // Owner dispatch 2026-09-02: the placeholder seam closed; co is its own sheet.
    expect(themeStylesheet("co")).toBe(coStylesheet());
    expect(coStylesheet()).not.toBe(cerberusStylesheet());
    expect(liteStylesheet()).not.toContain("--gold");
    expect(coStylesheet()).not.toContain("--gold");
    expect(cerberusStylesheet()).toContain("--gold:#f1c232");
  });

  // THE BAR CARRIES REPORTS AND ADMIN (canon 0.30.201; owner, 2026-09-23:
  // "make "reports" and "admin" always on top of the screen"): the 2026-09-02
  // lock to the bottom right is reversed. Admin rides at the end of the app
  // bar on every page, in every view; the nav still carries Home and Log only.
  it("carries the Admin link in the app bar in every view, nothing fixed at the bottom", () => {
    for (const view of ["cerberus", "lite", "co"] as const) {
      const html = layout({ ...base, view });
      expect(html).toContain('<a class="admin-link" href="/admin">Admin</a>');
      const header = html.slice(html.indexOf('<header class="app-bar">'), html.indexOf("</header>"));
      expect(header).toContain('class="bar-actions"');
      expect(header).toContain('<a class="admin-link" href="/admin">Admin</a>');
      // The nav carries Home and Log only; the bare nav Admin link is gone.
      expect(html).not.toContain('<a href="/admin">');
      expect(html).not.toContain("fab-cluster");
      expect(html).not.toContain('class="admin-fab"');
    }
    for (const sheet of [liteStylesheet(), cerberusStylesheet(), coStylesheet()]) {
      expect(sheet).toContain(".admin-link");
      expect(sheet).toContain(".bar-actions { display: flex; align-items: center; gap: 0.55rem; margin-left: auto; }");
      expect(sheet).not.toContain("position: fixed; right: 18px; bottom: 18px;");
      // Main keeps no clearance: nothing is pinned over the page any more.
      expect(sheet).not.toContain("main { padding-bottom: 6.5rem; }");
    }
  });

  // Reports sits immediately left of Admin in the bar, no PIN gate.
  it("renders the Reports link left of Admin in the bar in every view", () => {
    for (const view of ["cerberus", "lite", "co"] as const) {
      const html = layout({ ...base, view });
      expect(html).toContain('<a class="reports-link" href="/reports">Reports</a>');
      expect(html.indexOf('class="reports-link"')).toBeLessThan(html.indexOf('class="admin-link"'));
      expect(html.indexOf('class="reports-link"')).toBeLessThan(html.indexOf("</header>"));
    }
    const es = layout({ ...base, locale: "es" });
    expect(es).toContain('<a class="reports-link" href="/reports">Informes</a>');
    for (const sheet of [liteStylesheet(), cerberusStylesheet(), coStylesheet()]) {
      expect(sheet).toContain(".reports-link");
      expect(sheet).toContain(".bar-actions");
      expect(sheet).toContain("#d97706");
      expect(sheet).toContain(".ops-map");
      expect(sheet).toContain("body.device-phone .ops-map-desktop { display: none; }");
      expect(sheet).toContain("body.device-phone .ops-map-phone");
    }
    expect(liteStylesheet()).toContain("--ops-arrow: var(--accent)");
    expect(cerberusStylesheet()).toContain("--ops-arrow: var(--gold)");
    expect(coStylesheet()).toContain("--ops-arrow: var(--primary)");
  });

  it("carries the inventory sheet and recall pane rules in every view", () => {
    for (const sheet of [liteStylesheet(), cerberusStylesheet(), coStylesheet()]) {
      expect(sheet).toContain(".inv-gauge");
      expect(sheet).toContain(".inv-gauge-hang");
      expect(sheet).toContain(".inv-pareto");
      expect(sheet).toContain(".inv-fg-bar");
      // canon 0.30.49: the SalesHelper embed stops short of the right edge in every view.
      expect(sheet).toContain(".saleshelper-embed { width: calc(100vw - 1.25rem);");
      expect(sheet).toContain(".saleshelper-embed-pane .saleshelper-frame { min-height: 480px; height: calc(100vh - 12rem); }");
      expect(sheet).toContain("min-height: 480px; height: calc(100vh - 5.5rem);");
      expect(sheet).toContain(".recall-pane");
      expect(sheet).toContain(".acquire-split");
    }
  });
});

describe("device pill and phone mode (owner ruling 2026-09-01)", () => {
  const base = {
    title: "Home",
    theme: "grip",
    personEmail: "pat@gripcannabis.com",
    body: "<p>x</p>",
  };

  it("renders the computer/phone pill between the EN/ES pill and the view pill", () => {
    const html = layout(base);
    expect(html).toContain('class="locale-pill device-pill"');
    expect(html).toContain('action="/device"');
    expect(html).toContain('name="device" value="computer" class="device-opt active" aria-pressed="true"');
    expect(html).toContain('name="device" value="phone" class="device-opt" aria-pressed="false"');
    expect(html).toContain('aria-label="Computer"');
    expect(html).toContain('title="Computer"');
    expect(html).toContain('aria-label="Phone"');
    expect(html).toContain('title="Phone"');
    expect(html).toContain('class="device-glyph"');
    expect(html).not.toContain(">Computer</button>");
    expect(html).not.toContain(">Phone</button>");
    const locale = html.indexOf('action="/locale"');
    const device = html.indexOf('action="/device"');
    const view = html.indexOf('action="/view"');
    expect(locale).toBeGreaterThan(-1);
    expect(device).toBeGreaterThan(locale);
    expect(view).toBeGreaterThan(device);
  });

  it("labels the pill through t(): Computadora and Teléfono in es", () => {
    expect(t("en", "Computer")).toBe("Computer");
    expect(t("es", "Computer")).toBe("Computadora");
    expect(t("en", "Phone")).toBe("Phone");
    expect(t("es", "Phone")).toBe("Teléfono");
    const es = layout({ ...base, locale: "es" });
    expect(es).toContain('aria-label="Computadora"');
    expect(es).toContain('title="Computadora"');
    expect(es).toContain('aria-label="Teléfono"');
    expect(es).toContain('title="Teléfono"');
    expect(es).not.toContain(">Computadora</button>");
    expect(es).not.toContain(">Teléfono</button>");
  });

  it("sets the device-phone body class under phone only, in every view, and carries the farm day's start hour on the body", () => {
    // THE FARM DAY BEGINS AT SIX (canon 0.30.151): the body carries the start hour for the date-filling scripts; 6 when none is given.
    expect(layout(base)).toContain('<body data-farm-day-start="6">');
    expect(layout(base)).not.toContain("device-phone\"");
    expect(layout({ ...base, farmDayStart: 4 })).toContain('<body data-farm-day-start="4">');
    const phone = layout({ ...base, device: "phone" });
    expect(phone).toContain('<body class="device-phone" data-farm-day-start="6">');
    expect(phone).toContain('name="device" value="phone" class="device-opt active" aria-pressed="true"');
    expect(layout({ ...base, view: "lite", device: "phone" })).toContain(
      '<body class="device-phone" data-farm-day-start="6">'
    );
    expect(layout({ ...base, view: "co", device: "phone" })).toContain(
      '<body class="device-phone" data-farm-day-start="6">'
    );
  });

  it("keeps the meta viewport at width=device-width in both modes", () => {
    for (const device of ["computer", "phone"] as const) {
      expect(layout({ ...base, device })).toContain(
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
      );
    }
  });

  it("carries the device-phone reflow block in EVERY view stylesheet", () => {
    for (const sheet of [liteStylesheet(), cerberusStylesheet(), coStylesheet()]) {
      expect(sheet).toContain("body.device-phone");
      expect(sheet).toContain("body.device-phone .station-split { flex-direction: column; }");
      expect(sheet).toContain("body.device-phone .station-triple { flex-direction: column; }");
      expect(sheet).toContain(".station-triple { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; }");
      // THE PANES ANCHOR TO THE SIDES (canon 0.30.201): equal thirds from a zero
      // basis, and the three-pane page leaves the 76rem reading column.
      expect(sheet).toContain(".station-triple > * { flex: 1 1 0; min-width: 16rem; }");
      expect(sheet).toContain("main:has(.station-triple) { max-width: none; }");
      expect(sheet).toContain("main { max-width: 76rem; margin: 0 auto;");
      expect(sheet).toContain("@media (max-width: 480px) { .station-triple { flex-direction: column; } }");
      expect(sheet).toContain(".shuttle-btn {");
      expect(sheet).toContain("body.device-phone .tiles { grid-template-columns: 1fr; }");
      expect(sheet).toContain(
        "body.device-phone main button, body.device-phone main .btn { width: 100%; min-height: 3.4rem; }"
      );
      expect(sheet).toContain(
        "body.device-phone table.data { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }"
      );
    }
  });
});

describe("universal bar brand lockup (owner ruling 2026-09-01)", () => {
  const base = {
    title: "Home",
    theme: "grip",
    personEmail: "pat@gripcannabis.com",
    body: "<p>x</p>",
  };

  it("renders the lockup in BOTH views: grip mark, FACTORY chip, spray lite", () => {
    for (const view of ["cerberus", "lite", "co"] as const) {
      const html = layout({ ...base, view });
      expect(html).toContain('class="brand brand-lockup"');
      expect(html).toContain('class="brand-grip"');
      expect(html).toContain('viewBox="0 0 1782 1798"');
      expect(html).toContain('<span class="brand-factory">FACTORY</span>');
      expect(html).toContain('<span class="brand-lite">lite</span>');
    }
  });

  it("retires the old text brand in both views (the universal-bar ruling supersedes Lite byte-preservation for the brand block only)", () => {
    for (const view of ["cerberus", "lite"] as const) {
      const html = layout({ ...base, view });
      expect(html).not.toContain('<div class="brand">Gripfactory');
      expect(html).not.toContain("Gripfactory <b>Lite</b>");
      // The page title keeps the name; only the bar brand block changed.
      expect(html).toContain("· Gripfactory Lite</title>");
    }
  });

  it("styles the lockup in both sheets: near-white ink on Cerberus, near-black on Lite", () => {
    const cerb = cerberusStylesheet();
    expect(cerb).toContain(".brand-lockup");
    expect(cerb).toContain(".brand-factory");
    expect(cerb).toContain(".brand-lite");
    expect(cerb).toContain(".co-pill-mark { height: 1em; width: auto; display: block; }");
    const lite = liteStylesheet();
    expect(lite).toContain(".brand-lockup");
    expect(lite).toContain(".brand-factory");
    expect(lite).toContain(".brand-lite");
    expect(lite).toContain(".co-pill-mark { height: 1em; width: auto; display: block; }");
    expect(lite).toContain("color: #1c1914");
  });
});

describe("boot scrawl brand frames (owner ruling 2026-09-01, a brand slice)", () => {
  // The scrawl is Cerberus's alone; since canon 0.30.28 that view is a pick, not the default.
  const base = {
    title: "Home",
    theme: "grip",
    personEmail: "pat@gripcannabis.com",
    body: "<p>x</p>",
    view: "cerberus" as const,
  };

  it("opens on the Continuum lockup: CO mark inline beside CONTINUUM, white", () => {
    const html = layout(base);
    expect(html).toContain('class="boot-mark boot-mark-plato boot-mark-continuum"');
    expect(html).toContain('class="boot-co-mark"');
    expect(html).toContain('<span class="boot-continuum-word">CONTINUUM</span>');
    // The wordmark PLATO is gone from the scrawl (the chassis head follows).
    expect(html).not.toContain(">PLATO</span>");
    const css = cerberusStylesheet();
    expect(css).toContain("#boot-scrawl .boot-mark-continuum");
    expect(css).toContain("color: #ffffff");
  });

  it("reveals the brand frame: GRIP mark over the FACTORY plate photo with the spray lite", () => {
    const html = layout(base);
    expect(html).toContain('class="boot-mark boot-mark-grip boot-brand-frame"');
    expect(html).toContain('class="boot-grip-mark"');
    expect(html).toContain('<img class="boot-plate" src="/brand/factory-plate.png" alt="FACTORY">');
    expect(html).toContain('<span class="boot-spray-lite">lite</span>');
    // The old typographic reveal is gone.
    expect(html).not.toContain("GRIPFACTORY <b>LITE</b>");
  });

  it("builds the spray look from a tight pass plus a wide overspray pass in the theme gold, rotated", () => {
    const css = cerberusStylesheet();
    const spray = css.slice(css.indexOf(".boot-spray-lite"));
    expect(spray).toContain("rotate(-15deg)");
    expect(spray).toContain("color: var(--gold)");
    expect(spray).toContain("0 0 1px rgba(241,194,50,0.95)");
    expect(spray).toContain("0 0 26px rgba(241,194,50,0.3)");
    expect(spray).toContain("mask-image");
  });

  it("completes the 2906ms swap: a hidden slot mark is display none, never merely covered", () => {
    // Regression (owner ruling 2026-09-01, brand slice fix): the marks' own
    // display:flex rules used to defeat the UA's [hidden] display none, so the
    // Continuum lockup stayed rendered beside the reveal after the swap.
    const css = cerberusStylesheet();
    expect(css).toContain("#boot-scrawl .boot-slot [hidden] { display: none !important; }");
  });

  it("stacks the reveal: GRIP mark leading large, the plate at 64% of the screen, the spray overhang given room", () => {
    const css = cerberusStylesheet();
    expect(css).toContain("#boot-scrawl .boot-grip-mark { height: 58px;");
    expect(css).toContain("#boot-scrawl .boot-plate-wrap { position: relative; display: block; width: 64%; }");
    expect(css).toContain("#boot-scrawl .boot-plate { display: block; width: 100%; height: auto; }");
    expect(css).toContain("padding-bottom: 20px;");
  });

  it("keeps the scrawl's existing timeline and swap classes", () => {
    const html = layout(base);
    expect(html).toContain("at(300,function(){ el.classList.add('boot-hold'); });");
    expect(html).toContain("at(2600,function(){ el.classList.add('boot-glitch'); });");
    expect(html).toContain("at(2906,function(){");
    expect(html).toContain("at(4980,finish)");
    expect(html).toContain(".boot-mark-plato");
    expect(html).toContain(".boot-mark-grip");
  });
});

describe("saleshelper cerberus skin (owner ruling 2026-09-01: runtime decoration only)", () => {
  it("carries the marker id and maps the form's tokens toward Cerberus", () => {
    const skin = salesHelperCerberusSkin();
    expect(skin).toContain('id="gf-cerberus-skin"');
    expect(skin).toContain("--bg:#0c0c0e");
    expect(skin).toContain("--card:#15161a");
    expect(skin).toContain("--ink:#f4f4f5");
    expect(skin).toContain("--accent:#f1c232");
    expect(skin).toContain("color-scheme:dark");
    // Conservative selectors only: token remap plus the four top-level
    // hardcoded-light surfaces.
    expect(skin).toContain("header{");
    expect(skin).toContain("input,select{");
    expect(skin).toContain("#proposal{");
  });
});
