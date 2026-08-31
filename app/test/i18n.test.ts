import { describe, expect, it } from "vitest";
import { asLocale, t } from "../src/i18n";
import { homePage, intercoPage, layout, stationPage, type StationLedgerCtx } from "../src/html";
import { PIPELINE, queueByKey, stationByKey, type QueueDef } from "../src/pipeline";
import type { PersonRow, QueueRow } from "../src/db";

describe("i18n dictionary (owner ruling 2026-08-28)", () => {
  it("returns Spanish strings for known keys", () => {
    expect(t("es", "Home")).toBe("Inicio");
    expect(t("es", "Start lot")).toBe("Iniciar lote");
    expect(t("es", "Add a truck")).toBe("Agregar camión");
    expect(t("es", "Mark trimmed")).toBe("Marcar podado");
    expect(t("es", "Pick from the left to begin.")).toBe("Elija de la izquierda para comenzar.");
    expect(t("es", "HBN minted.")).toBe("HBN generado.");
  });

  it("returns English strings for locale en", () => {
    expect(t("en", "Home")).toBe("Home");
    expect(t("en", "Start lot")).toBe("Start lot");
  });

  it("falls back to English for unknown keys", () => {
    expect(t("es", "Some label without an entry")).toBe("Some label without an entry");
    expect(t("en", "Some label without an entry")).toBe("Some label without an entry");
  });

  it("normalizes cookie and form values to a locale", () => {
    expect(asLocale("es")).toBe("es");
    expect(asLocale("en")).toBe("en");
    expect(asLocale("fr")).toBe("en");
    expect(asLocale(undefined)).toBe("en");
  });
});

describe("locale pill and app bar (owner ruling 2026-08-28)", () => {
  const base = {
    title: "Home",
    theme: "grip",
    people: [] as PersonRow[],
    personId: "",
    body: "<p>x</p>",
  };

  it("renders Inicio and the pill with ES active in es", () => {
    const html = layout({ ...base, locale: "es" });
    expect(html).toContain('<html lang="es"');
    expect(html).toContain('href="/">Inicio</a>');
    expect(html).toContain('action="/locale"');
    expect(html).toContain('value="es" class="locale-opt active"');
    expect(html).toContain('value="en" class="locale-opt"');
    expect(html).toContain("Recordar");
  });

  it("renders Home and the pill with EN active in en", () => {
    const html = layout({ ...base, locale: "en" });
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('href="/">Home</a>');
    expect(html).toContain('value="en" class="locale-opt active"');
    expect(html).toContain('value="es" class="locale-opt"');
  });

  it("defaults to en when no locale is passed", () => {
    const html = layout(base);
    expect(html).toContain('value="en" class="locale-opt active"');
  });
});

describe("Interco Logistics stub (owner ruling 2026-08-28)", () => {
  it("home carries the muted Interco tile after Admin, linking /interco", () => {
    const html = homePage(PIPELINE);
    expect(html).toContain('href="/interco"');
    expect(html).toContain("Interco Logistics");
    expect(html).toContain("tile-stub");
    expect(html.indexOf('href="/admin"')).toBeLessThan(html.indexOf('href="/interco"'));
  });

  it("the stub page renders the orange barreled line", () => {
    const en = intercoPage("en");
    expect(en).toContain("<h1>Interco Logistics</h1>");
    expect(en).toContain("Orange barreled. Not built yet.");
    const es = intercoPage("es");
    expect(es).toContain("<h1>Interco Logistics</h1>");
    expect(es).toContain("Con barriles naranjas. Aún no construido.");
  });
});

describe("station page in Spanish (owner ruling 2026-08-28)", () => {
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const rows: QueueRow[] = [
    {
      id: "hb1",
      values: { hbn: "26244-ARL-GH-027-0-NA-26001", strain_name: "Fruity Pebbles", farm_code: "ARL" },
    },
  ];
  const queuesByKey: Record<string, QueueDef> = { hbn_queue: queueByKey("hbn_queue")! };
  const ledgerCtx: StationLedgerCtx = {
    farmName: "Arlington",
    moveToOptions: [{ value: "ds6", label: "Arlington Dry Room" }],
    resumeLots: [],
  };

  it("renders Iniciar lote and translated chrome on a picked wet weight page", () => {
    const html = stationPage(
      stationByKey("wet_weight")!,
      people,
      "p1",
      {},
      { hbn_queue: rows },
      queuesByKey,
      "hb1",
      ledgerCtx,
      undefined,
      "es"
    );
    expect(html).toContain("Iniciar lote");
    expect(html).toContain("Entrada de peso húmedo");
    expect(html).toContain("Mover a");
    expect(html).toContain("Agregar camión");
    expect(html).toContain("Líder");
    expect(html).toContain("Cola de HBN");
    // User-entered data never translates.
    expect(html).toContain("26244-ARL-GH-027-0-NA-26001 - Arlington</h2>");
  });

  it("prompts in Spanish when nothing is picked", () => {
    const html = stationPage(
      stationByKey("wet_weight")!,
      people,
      "p1",
      {},
      { hbn_queue: rows },
      queuesByKey,
      undefined,
      undefined,
      undefined,
      "es"
    );
    expect(html).toContain("Elija de la izquierda para comenzar.");
  });
});
