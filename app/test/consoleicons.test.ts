import { describe, expect, it } from "vitest";
import {
  CONSOLE_ICON_LABELS,
  CONSOLE_ICON_NAMES,
  CONSOLE_ICON_STROKE,
  TRAILER_CARGO,
  consoleIconSvg,
  type ConsoleIconName,
} from "../src/consoleicons";

const WORDS: Partial<Record<ConsoleIconName, readonly string[]>> = {
  cryo: ["CRYO", "AMAPS", "UV"],
  ready: ["Pretest checks"],
  scheduled: ["Today"],
  passed: ["COA"],
  submitted: ["PLUG"],
};

const PAIRED = new Set(["svg", "g", "text", "tspan"]);

function utf8Bytes(value: string): number {
  let n = 0;
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) n += 1;
    else if (code < 0x800) n += 2;
    else if (code < 0x10000) n += 3;
    else n += 4;
  }
  return n;
}

function rootTag(svg: string): string {
  return svg.slice(0, svg.indexOf(">"));
}

function textsOf(svg: string): string[] {
  return [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
}

function assertBalanced(svg: string): void {
  const tags = [...svg.matchAll(/<(\/?)([A-Za-z]+)([^>]*)>/g)];
  const stack: string[] = [];
  for (const tag of tags) {
    const close = tag[1] === "/";
    const name = tag[2];
    const rest = tag[3];
    if (close) {
      expect(PAIRED.has(name), name).toBe(true);
      expect(stack.pop()).toBe(name);
    } else if (rest.trimEnd().endsWith("/")) {
      expect(PAIRED.has(name), name).toBe(false);
    } else {
      expect(PAIRED.has(name), name).toBe(true);
      stack.push(name);
    }
  }
  expect(stack).toEqual([]);
}

describe("THE ICONS AS LINE ART (canon 0.30.282)", () => {
  it("names the fifteen in the doc's order, each with a label", () => {
    expect(CONSOLE_ICON_NAMES).toEqual([
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
    ]);
    for (const name of CONSOLE_ICON_NAMES) {
      expect(CONSOLE_ICON_LABELS[name].length).toBeGreaterThan(0);
    }
  });

  it("draws every icon to the contract", () => {
    for (const name of CONSOLE_ICON_NAMES) {
      const svg = consoleIconSvg(name);
      const again = consoleIconSvg(name);
      expect(svg).toBe(again);
      expect(svg.startsWith("<svg ")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg.match(/<svg\b/g)).toHaveLength(1);
      expect(svg.match(/<\/svg>/g)).toHaveLength(1);
      const root = rootTag(svg);
      expect(root).toContain(`class="hc-icon hc-icon-${name}"`);
      expect(root).toContain(`data-hc-icon="${name}"`);
      expect(root).toContain(name === "shipping" ? `viewBox="0 0 160 100"` : `viewBox="0 0 100 100"`);
      expect(root).toContain(`role="img"`);
      expect(root).toContain(`aria-label="${CONSOLE_ICON_LABELS[name]}"`);
      expect(root).toContain(`focusable="false"`);
      expect(root).toContain(`stroke="currentColor"`);
      expect(root).toContain(`stroke-width="${CONSOLE_ICON_STROKE}"`);
      expect(root).not.toMatch(/\swidth=/);
      expect(root).not.toMatch(/\sheight=/);
      expect(svg).not.toMatch(/#[0-9A-Fa-f]/);
      expect(svg).not.toContain("rgb(");
      expect(svg).not.toContain("<style");
      expect(svg).not.toContain("<image");
      expect(svg).not.toContain("<foreignObject");
      expect(svg).not.toContain("<script");
      expect(svg).not.toContain(" id=");
      expect(svg).not.toContain("<defs");
      expect(svg).not.toContain("<use");
      expect(utf8Bytes(svg)).toBeLessThan(5000);
      assertBalanced(svg);
      const words = WORDS[name] ?? [];
      expect(textsOf(svg)).toEqual(words);
    }
  });

  it("puts the hooks on the parts the later slices style", () => {
    const rad = consoleIconSvg("rad");
    expect(rad.match(/data-icon-rad-body/g)).toHaveLength(1);
    const cryo = consoleIconSvg("cryo");
    expect(cryo.match(/data-icon-cryo-flow=/g)).toHaveLength(3);
    expect(cryo).toContain(`data-icon-cryo-flow="meter-cryo"`);
    expect(cryo).toContain(`data-icon-cryo-flow="meter-amaps"`);
    expect(cryo).toContain(`data-icon-cryo-flow="cryo-uv"`);
    const siren = consoleIconSvg("siren");
    expect(siren.match(/data-icon-siren-lamp/g)).toHaveLength(1);
    expect(siren).toContain('fill="currentColor"');
    const shipping = consoleIconSvg("shipping");
    expect(shipping.match(/data-icon-trailer-cargo/g)).toHaveLength(1);
    expect(shipping).toContain(
      `data-icon-trailer-cargo x="${TRAILER_CARGO.x}" y="${TRAILER_CARGO.y}" width="${TRAILER_CARGO.width}" height="${TRAILER_CARGO.height}"`
    );
    for (const name of CONSOLE_ICON_NAMES) {
      const svg = consoleIconSvg(name);
      if (name !== "rad") expect(svg).not.toContain("data-icon-rad-body");
      if (name !== "cryo") expect(svg).not.toContain("data-icon-cryo-flow");
      if (name !== "shipping") expect(svg).not.toContain("data-icon-trailer-cargo");
      if (name !== "siren") expect(svg).not.toContain("data-icon-siren-lamp");
    }
  });

  it("escapes a label, hides an empty one, and appends a class", () => {
    const marked = consoleIconSvg("rad", { label: `a "b" <c> & d` });
    expect(marked).toContain(`aria-label="a &quot;b&quot; &lt;c&gt; &amp; d"`);
    const bare = consoleIconSvg("shake", { label: "" });
    expect(bare).toContain(`aria-hidden="true"`);
    expect(rootTag(bare)).not.toContain("role=");
    expect(bare).not.toContain("aria-label");
    const pulsed = consoleIconSvg("total", { className: "pulse" });
    expect(rootTag(pulsed)).toContain(`class="hc-icon hc-icon-total pulse"`);
  });
});
