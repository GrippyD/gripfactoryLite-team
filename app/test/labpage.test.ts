import { describe, expect, it } from "vitest";
import { DICT } from "../src/i18n";
import { LAB_CLIENT_JS, labClientScript } from "../src/labclient";
import { LAB_FIELD_NAMES, LAB_FRIENDLY, jsonForScript, labClientKeys, labStationBody } from "../src/labpage";
import { FACILITIES, FAIL_REASONS, REQUIRED_TESTS } from "../src/labrules";

// THE LAB STATION (canon 0.30.362): the station page, its words, and its client.

type Fs = { readFileSync(path: URL, encoding: "utf8"): string };
async function source(name: string): Promise<string> {
  const fs = (await import("node:" + "fs")) as Fs;
  return fs.readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
}

const WORDS_OPEN = '<script type="application/json" id="lab-words">';
function wordsBlock(html: string): string {
  const at = html.indexOf(WORDS_OPEN);
  expect(at).toBeGreaterThan(-1);
  const from = at + WORDS_OPEN.length;
  return html.slice(from, html.indexOf("</script>", from));
}

function clientLiteralKeys(): string[] {
  const keys = new Set<string>();
  for (const m of LAB_CLIENT_JS.matchAll(/\btrf?\("([^"]*)"/g)) keys.add(m[1] as string);
  return [...keys];
}

describe("the lab station page", () => {
  it("renders in EN and ES with the station's root marker", () => {
    const en = labStationBody("en", "Bench Tester");
    const es = labStationBody("es", "Bench Tester");
    for (const html of [en, es]) {
      expect(html.startsWith('<div id="lab-station" data-lab-station>')).toBe(true);
      expect(html).toContain('id="bench-form"');
      expect(html).toContain('id="cs-form"');
      expect(html).toContain('id="op-import"');
      expect(html).toContain('id="sch-table"');
      expect(html).toContain('id="sum-tiles"');
    }
    expect(en).toContain(">Refresh<");
    expect(en).toContain(">Lab tests<");
    expect(es).toContain("Pruebas de laboratorio");
    expect(es).toContain("Cumplimiento");
    expect(es).toContain("Actualizar");
    expect(es).not.toContain(">Refresh<");
    expect(es).not.toContain(">Clear<");
    expect(JSON.parse(wordsBlock(es)).locale).toBe("es");
    expect(JSON.parse(wordsBlock(en)).locale).toBe("en");
  });

  it("has a DICT entry with Spanish for every key the page and the client use", async () => {
    const page = await source("labpage.ts");
    const pageKeys = [...page.matchAll(/\be\(locale, "([^"]*)"\)/g)].map((m) => m[1] as string);
    expect(pageKeys.length).toBeGreaterThan(80);
    const literal = clientLiteralKeys();
    expect(literal.length).toBeGreaterThan(60);
    const all = new Set([...pageKeys, ...literal, ...labClientKeys(), ...Object.values(LAB_FRIENDLY), ...Object.values(LAB_FIELD_NAMES)]);
    const missing = [...all].filter((k) => !DICT[k] || typeof DICT[k]?.es !== "string" || DICT[k]?.es.trim() === "");
    expect(missing).toEqual([]);
    // The words block carries every client key, and nothing the client does not use.
    const words = JSON.parse(wordsBlock(labStationBody("es", null))) as { tr: Record<string, string> };
    for (const k of literal) expect(Object.prototype.hasOwnProperty.call(words.tr, k)).toBe(true);
    expect(Object.keys(words.tr).sort()).toEqual([...labClientKeys()].sort());
    expect(words.tr["Not ready"]).toBe("No listo");
  });

  it("sends the required tests and fail reasons in Spanish, and the sample rows show them through tr()", () => {
    const missing = [...REQUIRED_TESTS, ...FAIL_REASONS].filter((k) => !DICT[k] || typeof DICT[k]?.es !== "string" || DICT[k]?.es.trim() === "");
    expect(missing).toEqual([]);
    const keys = new Set(labClientKeys());
    for (const k of [...REQUIRED_TESTS, ...FAIL_REASONS]) expect(keys.has(k)).toBe(true);
    // Facility names are proper names and are not translated.
    for (const k of FACILITIES) expect(keys.has(k)).toBe(false);
    const words = JSON.parse(wordsBlock(labStationBody("es", null))) as { tr: Record<string, string> };
    expect(words.tr["Retest (Coliforms)"]).toBe("Reprueba (coliformes)");
    expect(words.tr["Heavy Metals"]).toBe("Metales pesados");
    expect(LAB_CLIENT_JS).toContain("esc(tr(x.required_test))");
    expect(LAB_CLIENT_JS).toContain("esc(tr(x.fail_reason))");
  });

  it("shows a person's name, never a person id or the typed: prefix, under By and Operator", () => {
    const shown = "esc(x.operator_name || (x.operator || \"\").replace(/^typed:/, \"\"))";
    expect(LAB_CLIENT_JS.split(shown).length - 1).toBe(2);
    expect(LAB_CLIENT_JS).not.toContain("esc(x.operator)");
  });

  it("refuses a correction with a time and no date instead of moving it to today", () => {
    expect(LAB_CLIENT_JS).toContain(
      'if (benchEditing && !bfNow.tested_on.value.trim() && bfNow.tested_time.value.trim()) { say(st, "err", tr("Type the date tested too; a correction never moves a reading to today.")); return; }'
    );
    expect(DICT["Type the date tested too; a correction never moves a reading to today."]?.es).toBe(
      "Escriba tambien la fecha de prueba; una correccion nunca mueve una lectura a hoy."
    );
  });

  it("shows the load-failure line on the schedule tab", () => {
    const at = LAB_CLIENT_JS.indexOf("async function loadSchedule()");
    const fn = LAB_CLIENT_JS.slice(at, LAB_CLIENT_JS.indexOf("function editCell", at));
    expect(fn).toContain("esc(loadFail(r))");
    expect(fn).not.toContain("if (!r.ok) return;");
  });

  it("names every refusal slug labrules.ts and lab.ts return", async () => {
    const slugs = new Set<string>();
    const prefixes = new Set<string>();
    for (const name of ["labrules.ts", "lab.ts"]) {
      const src = await source(name);
      for (const m of src.matchAll(/error: "([^"]+)"/g)) {
        const s = m[1] as string;
        if (s.endsWith(":")) prefixes.add(s.slice(0, -1));
        else slugs.add(s);
      }
      for (const m of src.matchAll(/\bbad\(([^,)]*)/g)) for (const lit of (m[1] as string).matchAll(/"([^"]+)"/g)) slugs.add(lit[1] as string);
    }
    expect(slugs.size).toBeGreaterThan(40);
    expect([...slugs].filter((s) => !LAB_FRIENDLY[s])).toEqual([]);
    expect([...prefixes].filter((p) => !LAB_FIELD_NAMES[p])).toEqual([]);
    expect(prefixes.has("source_metrc_tag")).toBe(true);
    expect(prefixes.has("sample_tag")).toBe(true);
  });

  it("ships a client script that parses outside any DOM and is safe inside a script tag", () => {
    expect(() => new Function(LAB_CLIENT_JS)).not.toThrow();
    const tag = labClientScript();
    expect(tag.startsWith("<script>")).toBe(true);
    expect(tag.endsWith("</script>")).toBe(true);
    expect(LAB_CLIENT_JS.toLowerCase()).not.toContain("</script");
    expect(LAB_CLIENT_JS).not.toContain("<!--");
    // The typed name rides the layout's kept box only; no second storage key.
    expect(LAB_CLIENT_JS).not.toContain("lab.operator");
    expect(LAB_CLIENT_JS).toContain('"x-lab-operator": operatorHeader()');
  });

  it("emits a words block with no raw '<' and no raw line separators", () => {
    const block = wordsBlock(labStationBody("es", "x<y"));
    expect(block).not.toContain("<");
    expect(() => JSON.parse(block)).not.toThrow();
    const hard = jsonForScript({ a: "</script><!-- \u2028 \u2029" });
    expect(hard).not.toContain("<");
    expect(hard).not.toContain("\u2028");
    expect(hard).not.toContain("\u2029");
    expect(JSON.parse(hard)).toEqual({ a: "</script><!-- \u2028 \u2029" });
  });

  it("has no Orange Photonics or Aqualab drop form", () => {
    for (const html of [labStationBody("en", null), labStationBody("es", "Smoke Hand")]) {
      expect(html).not.toContain('action="/compliance/testing/internal"');
      expect(html).not.toContain('value="orange_photonics"');
      expect(html).not.toContain('value="aqualab"');
      expect(html).not.toContain("Drop CSV of");
      expect(html).not.toContain("<form method=");
    }
  });

  it("shows the name box only when no one is signed in, kept by the layout's script", () => {
    const anon = labStationBody("en", null);
    expect(anon).toContain('<input type="text" id="lab-operator" name="lab_operator" autocomplete="off" data-keep-operator>');
    expect(anon).not.toContain("gf_operator:");
    expect(anon).not.toContain("Signed in:");
    const named = labStationBody("en", "Smoke <Hand>");
    expect(named).not.toContain('id="lab-operator"');
    expect(named).not.toContain("data-keep-operator>");
    expect(named).toContain("Signed in: Smoke &lt;Hand&gt;");
    expect(named).not.toContain("gf_operator:");
  });

  it("speaks the view sheets' vocabulary: typed inputs, no datetime-local, hover help", () => {
    const html = labStationBody("en", null);
    const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
    expect(inputs.length).toBeGreaterThan(20);
    expect(inputs.filter((i) => !/\btype="(text|date|time|number|file|checkbox)"/.test(i))).toEqual([]);
    expect(html).not.toContain("datetime-local");
    expect(html).toContain('name="tested_on"');
    expect(html).toContain('name="tested_time"');
    expect(html).not.toContain('class="hint"');
    expect(html).not.toContain('class="primary"');
    expect(html).toContain('class="tab-bar lab-nav"');
    expect(html).toContain('role="tabpanel" aria-labelledby="lab-tab-bench"');
    expect(html).toContain('aria-controls="tab-summary"');
    expect(html).toContain('title="At least one instrument result is required.');
    expect(LAB_CLIENT_JS).toContain('inp.type = "text"');
  });

  it("takes decimal grams, sends them whole (round half up), and shows whole grams", () => {
    const html = labStationBody("en", null);
    for (const name of ["batch_weight_g", "net_weight_g"]) {
      const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
      expect(input).toContain('step="any"');
      expect(input).toContain('min="0"');
      expect(input).toContain('inputmode="decimal"');
      expect(input).not.toContain('step="1"');
    }
    const inLine = LAB_CLIENT_JS.split("\n").find((l) => l.trim().startsWith("const gramsIn = ")) ?? "";
    const gramsIn = new Function(`${inLine} return gramsIn;`)() as (s: string) => string | null;
    expect(gramsIn("114.5")).toBe("115");
    expect(gramsIn("114.4")).toBe("114");
    expect(gramsIn("0.5")).toBe("1");
    expect(gramsIn("448")).toBe("448");
    expect(gramsIn("")).toBe(null);
    // Out of the grams range or not a number: sent as typed so the server refuses it.
    expect(gramsIn("-0.4")).toBe("-0.4");
    expect(gramsIn("1000000.4")).toBe("1000000.4");
    expect(gramsIn("abc")).toBe("abc");
    expect(LAB_CLIENT_JS).toContain('batch_weight_g: gramsIn(g("batch_weight_g"))');
    expect(LAB_CLIENT_JS).toContain('net_weight_g: gramsIn(g("net_weight_g"))');
    const line = LAB_CLIENT_JS.split("\n").find((l) => l.trim().startsWith("const fmtGrams = ")) ?? "";
    const fmtGrams = new Function(`${line} return fmtGrams;`)() as (v: unknown) => string;
    expect(fmtGrams(114.5)).toBe("115");
    expect(fmtGrams(1234.4)).toBe("1,234");
    expect(fmtGrams(1234567)).toBe("1,234,567");
    expect(fmtGrams(null)).toBe("");
    expect(fmtGrams(-2.5)).toBe("-3");
    // The Metrc autofill fills batch weight from the grams figure only, never from an 'ea' count.
    expect(LAB_CLIENT_JS).toContain("p.quantity_g != null");
    expect(LAB_CLIENT_JS).not.toContain("cf.batch_weight_g.value = p.quantity;");
  });

  it("keeps the package's outbox, slices and ceilings", () => {
    expect(LAB_CLIENT_JS).toContain('OUTBOX_KEY = "lab.outbox.v1"');
    expect(LAB_CLIENT_JS).toContain("const IMPORT_SLICE = 900;");
    expect(LAB_CLIENT_JS).toContain("ids.length > 90");
    expect(LAB_CLIENT_JS).toContain("body.observed_at = new Date().toISOString()");
    expect(LAB_CLIENT_JS).toContain("outbox.save(outbox.list().filter((x) => !sent.has(x.key)))");
    expect(LAB_CLIENT_JS).toContain("if (b === null)");
  });

  it("BRIEF V25 law 1a: switches Passed and Failed off for a Retest required test, keeps a stored one, and says why in EN and ES", () => {
    expect(LAB_CLIENT_JS).toContain('cf.required_test.addEventListener("change", csStatusChoices)');
    expect(LAB_CLIENT_JS).toContain("OPT.retest_test_statuses");
    expect(LAB_CLIENT_JS).toContain('cf.required_test.value.trim().toLowerCase().startsWith("retest")');
    expect(LAB_CLIENT_JS).toMatch(/o\.disabled = retest && !o\.dataset\.stored && !allowed\.includes\(o\.value\)/);
    // Run on boot, on a reset, and when a stored sample opens.
    expect(LAB_CLIENT_JS.match(/csStatusChoices\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    const words = DICT[LAB_FRIENDLY["status-retest"] as string];
    expect(words?.es).toMatch(/Reprueba aprobada o Reprueba fallida/);
    const help = "A Retest required test takes Retest passed or Retest failed; Passed and Failed are first tests.";
    expect(labStationBody("en", "Smoke Hand")).toContain(`title="${help}"`);
    expect(labStationBody("es", "Smoke Hand")).toContain(`title="${DICT[help]?.es}"`);
  });
});
