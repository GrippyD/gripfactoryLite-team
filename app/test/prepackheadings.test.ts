import { describe, expect, it } from "vitest";
import type { ScheduleItemRow } from "../src/db";
import { prepackSchedulingPage } from "../src/scheduling";

const HBN_IN = "26244-ARL-ID-001-0-NA-26001";
const HBN_OD_A = "26244-ARL-OD-002-0-NA-26002";
const HBN_OD_B = "26244-ARL-OD-003-0-NA-26003";
const HBN_GH = "26244-ARL-GH-004-0-NA-26004";
const HBN_NONE = "26244-ARL-NA-005-0-NA-26005";
const HBN_OTHER = "26244-ARL-LD-006-0-NA-26006";

function row(over: Partial<ScheduleItemRow> & Pick<ScheduleItemRow, "id" | "tag" | "hbn">): ScheduleItemRow {
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

function panes(available: ScheduleItemRow[]) {
  return { available, working: [] as ScheduleItemRow[], complete: [] as ScheduleItemRow[] };
}

const indoor = row({ id: "pkg-in", tag: "1A4050300000000000000A01", hbn: HBN_IN, grow_method: "Indoor" });
const outdoorA = row({ id: "pkg-od-a", tag: "1A4050300000000000000A02", hbn: HBN_OD_A, grow_method: "Outdoor" });
const outdoorB = row({ id: "pkg-od-b", tag: "1A4050300000000000000A03", hbn: HBN_OD_B, grow_method: "Outdoor" });
const greenhouse = row({ id: "pkg-gh", tag: "1A4050300000000000000A04", hbn: HBN_GH, grow_method: "Greenhouse" });
const unknown = row({ id: "pkg-none", tag: "1A4050300000000000000A05", hbn: HBN_NONE, grow_method: null });
const lightDep = row({ id: "pkg-ld", tag: "1A4050300000000000000A06", hbn: HBN_OTHER, grow_method: "Light Dep" });

function headingAt(html: string, name: string): number {
  return html.indexOf(`<h3>${name} <span class="tile-count" data-schedule-heading-count>`);
}

describe("THE PREPACK HEADINGS (canon 0.30.229)", () => {
  const available = [outdoorB, unknown, greenhouse, indoor, outdoorA, lightDep];

  it("groups Available under Indoor, Outdoor, Greenhouse, then other methods, with Unknown last", () => {
    const html = prepackSchedulingPage(panes(available), null, "en");
    const order = ["Indoor", "Outdoor", "Greenhouse", "Light Dep", "Unknown"].map((name) => headingAt(html, name));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain('<h3>Indoor <span class="tile-count" data-schedule-heading-count>1</span></h3>');
    expect(html).toContain('<h3>Outdoor <span class="tile-count" data-schedule-heading-count>2</span></h3>');
    expect(html).toContain('<h3>Greenhouse <span class="tile-count" data-schedule-heading-count>1</span></h3>');
    expect(html).toContain('<h3>Light Dep <span class="tile-count" data-schedule-heading-count>1</span></h3>');
    expect(html).toContain('<h3>Unknown <span class="tile-count" data-schedule-heading-count>1</span></h3>');
    expect(html).toContain('data-fold="grow:Indoor" open');
    expect(html).toContain('data-fold="grow:Outdoor" open');
    expect(html).toContain('data-fold="grow:Greenhouse" open');
    expect(html).toContain('data-fold="grow:Light Dep" open');
    expect(html).toContain('data-fold="grow:unknown" open');
    expect(html).toContain('class="queue-fold"');
    expect(html).toContain('var storeKey = "gf_fold:" + location.pathname');
    const outdoor = html.slice(headingAt(html, "Outdoor"), headingAt(html, "Greenhouse"));
    expect(outdoor.indexOf('data-schedule-id="pkg-od-b"')).toBeLessThan(outdoor.indexOf('data-schedule-id="pkg-od-a"'));
    expect(html).toContain('data-schedule-count="available">6<');
    const working = html.slice(html.indexOf('data-schedule-pane="working"'), html.indexOf('data-schedule-pane="complete"'));
    expect(working).not.toContain("queue-fold");
    expect(working).not.toContain("data-schedule-heading");
  });

  it("draws no heading for a method that has no packages", () => {
    const html = prepackSchedulingPage(panes([indoor, greenhouse]), null, "en");
    expect(html).not.toContain(">Outdoor <");
    expect(html).not.toContain("grow:Outdoor");
    expect(html).not.toContain(">Unknown <");
    expect(headingAt(html, "Indoor")).toBeLessThan(headingAt(html, "Greenhouse"));
  });

  it("hides a heading whose rows the filter hides, and keeps the others", () => {
    const html = prepackSchedulingPage(panes(available), null, "en", "26002");
    expect(html).toContain('data-schedule-heading hidden class="queue-fold" data-fold="grow:Indoor"');
    expect(html).toContain('<h3>Outdoor <span class="tile-count" data-schedule-heading-count>1</span></h3>');
    expect(html).toContain('data-schedule-heading class="queue-fold" data-fold="grow:Outdoor" open');
    expect(html).toContain('data-schedule-heading hidden class="queue-fold" data-fold="grow:Greenhouse"');
    expect(html).toContain('data-schedule-heading hidden class="queue-fold" data-fold="grow:unknown"');
    expect(html).toContain('data-schedule-count="available">1<');
    expect(html).toContain('data-schedule-tag="1A4050300000000000000A02" data-schedule-hbn="26244-ARL-OD-002-0-NA-26002">');
    expect(html).toContain('data-schedule-tag="1A4050300000000000000A03" data-schedule-hbn="26244-ARL-OD-003-0-NA-26003" hidden>');
    expect(html).toContain("[data-schedule-heading]");
    expect(html).toContain("data-schedule-heading-count");
  });

  it("keeps the >> button and the schedule attributes inside the heading", () => {
    const html = prepackSchedulingPage(panes([indoor]), null, "en");
    const block = html.slice(html.indexOf('data-fold="grow:Indoor"'), html.indexOf("data-schedule-empty"));
    expect(block).toContain(`data-schedule-id="pkg-in" data-schedule-tag="1A4050300000000000000A01" data-schedule-hbn="${HBN_IN}"`);
    expect(block).toContain('form="schedule-prepack" name="wip_package_id" value="pkg-in" class="shuttle-btn" title="Schedule prepack"');
    expect(block).toContain("&gt;&gt;");
  });

  it("says Unknown in Spanish", () => {
    const es = prepackSchedulingPage(panes([unknown]), null, "es");
    expect(es).toContain('<h3>Desconocido <span class="tile-count" data-schedule-heading-count>1</span></h3>');
    expect(es).toContain('data-fold="grow:unknown"');
  });
});
