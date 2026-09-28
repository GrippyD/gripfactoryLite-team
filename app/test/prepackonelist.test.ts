import { describe, expect, it } from "vitest";
import type { ScheduleItemRow } from "../src/db";
import { adoptGrowMethod, type MetrcAdoptRow } from "../src/metrc";
import { prepackSchedulingPage } from "../src/scheduling";
import { themeStylesheet } from "../src/theme";

const METHODS = [
  { display_name: "Indoor", hbn_code: "ID" },
  { display_name: "Outdoor", hbn_code: "OD" },
  { display_name: "Greenhouse", hbn_code: "GH" },
];

const HBN_IN = "26244-ARL-ID-001-0-NA-26011";
const HBN_OD = "26244-ARL-OD-002-0-NA-26012";
const HBN_GH = "26244-ARL-GH-003-0-NA-26013";
const HBN_BAD = "not a harvest";

function appRow(over: Partial<ScheduleItemRow> & Pick<ScheduleItemRow, "id" | "tag" | "hbn" | "grow_method">): ScheduleItemRow {
  return {
    itemId: over.id,
    harvest_batch_id: over.id,
    farm_code: "ARL",
    strain_name: "Fruity Pebbles",
    entry_date: "2026-09-08",
    identity: String(over.tag),
    grams: 20,
    location: "Cryo 1",
    ...over,
  };
}

function stranger(over: Partial<MetrcAdoptRow> & Pick<MetrcAdoptRow, "tag" | "harvest" | "hbnId" | "growMethod">): MetrcAdoptRow {
  return {
    kind: "WPR",
    strain: "Chem",
    grams: 1500,
    location: "Trim Room",
    license: "AU-P-000694",
    packagedDate: "2026-09-15",
    ...over,
  };
}

function heading(html: string, name: string): string {
  const start = html.indexOf(`data-fold="grow:${name === "Unknown" ? "unknown" : name}"`);
  const next = html.indexOf("<details", start + 10);
  return html.slice(start, next < 0 ? undefined : next);
}

describe("THE PREPACK AVAILABLE PANE READS ONE LIST (canon 0.30.238)", () => {
  const indoor = appRow({ id: "pkg-in", tag: "1A4050300000000000000A01", hbn: HBN_IN, grow_method: "Indoor" });
  const outdoor = appRow({ id: "pkg-od", tag: "1A4050300000000000000A02", hbn: HBN_OD, grow_method: "Outdoor" });
  const knownOutdoor = stranger({ tag: "1A4050300000000000000B01", harvest: HBN_OD, hbnId: "hb-od", growMethod: "Outdoor" });
  const indoorStranger = stranger({ tag: "1A4050300000000000000B02", harvest: HBN_IN, hbnId: null, growMethod: "Indoor" });
  const greenhouseOnly = stranger({ tag: "1A4050300000000000000B03", harvest: HBN_GH, hbnId: null, growMethod: "Greenhouse" });
  const noHarvest = stranger({ tag: "1A4050300000000000000B04", harvest: null, hbnId: null, growMethod: null });
  const refused = stranger({ tag: "1A4050300000000000000B05", harvest: HBN_BAD, hbnId: null, growMethod: null });

  it("files strangers under the grow headings after the app rows", () => {
    const html = prepackSchedulingPage(
      { available: [outdoor, indoor], working: [], complete: [] },
      { rows: [greenhouseOnly, knownOutdoor, refused, noHarvest, indoorStranger] },
      "en"
    );
    expect(html).not.toContain("data-schedule-adopt");
    expect(html).not.toContain("From METRC");
    expect(html).not.toContain(">known<");
    expect(html).not.toContain("new from METRC");
    const indoorBlock = heading(html, "Indoor");
    expect(indoorBlock.indexOf('data-schedule-id="pkg-in"')).toBeLessThan(indoorBlock.indexOf('data-adopt-tag="1A4050300000000000000B02"'));
    expect(indoorBlock).toContain('<h3>Indoor <span class="tile-count" data-schedule-heading-count>2</span></h3>');
    expect(indoorBlock).toContain(`<span class="pkg-hbn">${HBN_IN}</span>`);
    expect(indoorBlock).toContain('name="tag" value="1A4050300000000000000B02"');
    expect(indoorBlock).toContain('form="schedule-prepack"');
    expect(indoorBlock).toContain('title="Adopt and schedule"');
    const outdoorBlock = heading(html, "Outdoor");
    expect(outdoorBlock.indexOf('data-schedule-id="pkg-od"')).toBeLessThan(outdoorBlock.indexOf('data-adopt-tag="1A4050300000000000000B01"'));
    expect(outdoorBlock).toContain('<h3>Outdoor <span class="tile-count" data-schedule-heading-count>2</span></h3>');
    const greenhouseBlock = heading(html, "Greenhouse");
    expect(greenhouseBlock).toContain('data-adopt-tag="1A4050300000000000000B03"');
    expect(greenhouseBlock).toContain('<h3>Greenhouse <span class="tile-count" data-schedule-heading-count>1</span></h3>');
    const unknownBlock = heading(html, "Unknown");
    expect(unknownBlock).toContain('data-adopt-tag="1A4050300000000000000B04"');
    expect(unknownBlock).toContain('data-adopt-tag="1A4050300000000000000B05"');
    expect(unknownBlock).toContain("no harvest in METRC's lineage");
    const bare = unknownBlock.slice(unknownBlock.indexOf('data-adopt-tag="1A4050300000000000000B04"'), unknownBlock.indexOf('data-adopt-tag="1A4050300000000000000B05"'));
    expect(bare).not.toContain("<button");
    expect(html).toContain('data-schedule-count="available">7<');
  });

  it("the filter hides a stranger by its last six and hides a heading when every row is hidden", () => {
    const html = prepackSchedulingPage(
      { available: [indoor], working: [], complete: [] },
      { rows: [indoorStranger, greenhouseOnly] },
      "en",
      "000B03"
    );
    expect(html).toContain('data-schedule-heading hidden class="queue-fold" data-fold="grow:Indoor"');
    expect(html).toContain('data-adopt-tag="1A4050300000000000000B02" data-schedule-tag="1A4050300000000000000B02" data-schedule-hbn="' + HBN_IN + '" hidden>');
    expect(html).toContain('<h3>Greenhouse <span class="tile-count" data-schedule-heading-count>1</span></h3>');
    expect(html).toContain('data-schedule-count="available">1<');
  });

  it("reads the grow method from the batch, else from the HBN code", () => {
    const batch = new Map<string, string | null>([["hb-od", "Outdoor"]]);
    expect(adoptGrowMethod({ harvest: HBN_IN, hbnId: "hb-od" }, batch, METHODS)).toBe("Outdoor");
    expect(adoptGrowMethod({ harvest: HBN_IN, hbnId: null }, new Map(), METHODS)).toBe("Indoor");
    expect(adoptGrowMethod({ harvest: HBN_OD, hbnId: null }, new Map(), METHODS)).toBe("Outdoor");
    expect(adoptGrowMethod({ harvest: HBN_GH, hbnId: null }, new Map(), METHODS)).toBe("Greenhouse");
    expect(adoptGrowMethod({ harvest: null, hbnId: null }, new Map(), METHODS)).toBeNull();
    expect(adoptGrowMethod({ harvest: HBN_BAD, hbnId: null }, new Map(), METHODS)).toBeNull();
    expect(adoptGrowMethod({ harvest: "26244-ARL-XX-009-0-NA-26019", hbnId: null }, new Map(), METHODS)).toBeNull();
  });

  it("the fold summary keeps an h3 on the marker's line in every sheet", () => {
    for (const view of ["lite", "co", "cerberus"] as const) {
      expect(themeStylesheet(view)).toContain(".queue-fold > summary h2, .queue-fold > summary h3 { display: inline; }");
    }
  });
});
