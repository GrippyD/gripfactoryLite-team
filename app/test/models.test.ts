import { describe, expect, it } from "vitest";
import { CONFIG_KEYS, MODELS_PATH, MODELS_PIN_PATH, MODEL_TOOLS, modelToolPath } from "../src/config";
import { adminHomePage, appBarActions, modelsPage, pinPage } from "../src/html";
import { safeNextPath } from "../src/identity";

/** THE MODELS BUTTON (canon 0.30.86). Owner ruling 2026-09-15, verbatim: "New
 * button in Admin: [Models] - pin gated: 17853" and, beneath it, "1. [Harvest
 * Menu Tool 2026]" with the tool's hosting zip. The seeded PIN, the served
 * bytes and their sha256 pins are the smoke's (scripts/smoke.mjs), which runs
 * the migration and streams the vendored files. */

describe("THE MODELS BUTTON (canon 0.30.86)", () => {
  it("the Models PIN is a value in data (app_config models_pin, migration 0051), a key beside admin_pin", () => {
    expect(CONFIG_KEYS.models_pin).toBe("models_pin");
    expect(CONFIG_KEYS.admin_pin).toBe("admin_pin");
  });

  it("the paths: /models for the page, /pin/models for the PIN post outside the gated prefix, a slashed folder per tool", () => {
    expect(MODELS_PATH).toBe("/models");
    expect(MODELS_PIN_PATH).toBe("/pin/models");
    expect(MODELS_PIN_PATH.startsWith(`${MODELS_PATH}/`)).toBe(false);
    for (const tool of MODEL_TOOLS) {
      expect(modelToolPath(tool)).toBe(`/models/${tool.slug}/`);
      expect(tool.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("his list: 1. [Harvest Menu Tool 2026], with the data.json its page fetches beside it", () => {
    expect(MODEL_TOOLS).toHaveLength(1);
    expect(MODEL_TOOLS[0]).toEqual({ slug: "harvest-menu-2026", title: "Harvest Menu Tool 2026", files: ["data.json"] });
  });

  it("the bar carries Models, then Harvest Console, and Admin no longer tiles them", () => {
    const bar = appBarActions("en");
    expect(bar.indexOf('href="/models"')).toBeLessThan(bar.indexOf('href="/harvest"'));
    expect(bar.indexOf('href="/harvest"')).toBeLessThan(bar.indexOf('href="/maintenance"'));
    expect(adminHomePage("en")).not.toContain('href="/models"');
    expect(adminHomePage("en")).not.toContain('href="/harvest"');
    expect(appBarActions("es")).toContain(">Modelos</a>");
  });

  it("the Models page is a tile per tool, each opening its slashed folder", () => {
    const html = modelsPage("en");
    expect(html).toContain("<h1>Models</h1>");
    expect(html).toContain('<a class="tile" href="/models/harvest-menu-2026/">');
    expect(html).toContain('<span class="tile-title">Harvest Menu Tool 2026</span>');
    expect(html).toContain('<span class="tile-kind">Model</span>');
    expect(modelsPage("es")).toContain("<h1>Modelos</h1>");
  });

  it("the PIN page posts to /pin by default and to /pin/models for the Models gate", () => {
    expect(pinPage("/admin")).toContain('action="/pin"');
    expect(pinPage("/admin")).not.toContain("/pin/models");
    const models = pinPage("/models", "en", true, MODELS_PIN_PATH);
    expect(models).toContain('action="/pin/models"');
    expect(models).toContain('name="next" value="/models"');
    expect(models).toContain("Wrong PIN.");
  });

  it("safeNextPath keeps a same-site next and falls back per gate", () => {
    expect(safeNextPath("/models/harvest-menu-2026/", "/models")).toBe("/models/harvest-menu-2026/");
    expect(safeNextPath("https://evil.example/", "/models")).toBe("/models");
    expect(safeNextPath("//evil.example/", "/models")).toBe("/models");
    expect(safeNextPath(null)).toBe("/admin");
  });
});
