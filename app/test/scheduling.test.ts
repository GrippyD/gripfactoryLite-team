import { describe, expect, it } from "vitest";
import { drawsFromParentLot, NON_TRIM_SOURCE_SQL, parseMetrcReleaseStates } from "../src/config";
import { harvestTokens, inheritedHarvest, type MetrcAdoptRow } from "../src/metrc";
import { SCHEDULE_STAGE_TITLES, SCHEDULE_STAGES } from "../src/config";
import type { ScheduleHbnGroup, ScheduleItemRow } from "../src/db";
import {
  parseScheduleStage,
  prepackSchedulingPage,
  SCHEDULE_REFUSAL,
  scheduleFilterHit,
  scheduleStatusWord,
  schedulingLanding,
  schedulingPage,
} from "../src/scheduling";
import { backLinkFor } from "../src/nav";
import { opsGroupPage } from "../src/html";
import { opsGroupByKey, stationByKey } from "../src/pipeline";

const NOW = "2026-09-16T19:00:00.000Z";

function item(over: Partial<ScheduleItemRow> & Pick<ScheduleItemRow, "id" | "identity">): ScheduleItemRow {
  return {
    itemId: over.itemId ?? over.id,
    harvest_batch_id: "hbn1",
    hbn: "26251-ARL-GH-027-0-NA-26011",
    farm_code: "ARL",
    strain_name: "Fruity Pebbles",
    entry_date: "2026-09-08",
    ...over,
  };
}

function group(items: ScheduleItemRow[], harvest_batch_id = "hbn1"): ScheduleHbnGroup {
  return {
    harvest_batch_id,
    hbn: items[0]?.hbn ?? "26251-ARL-GH-027-0-NA-26011",
    farm_code: items[0]?.farm_code ?? "ARL",
    strain_name: items[0]?.strain_name ?? "Fruity Pebbles",
    entry_date: items[0]?.entry_date ?? "2026-09-08",
    items,
  };
}

const empty = { available: [] as ScheduleHbnGroup[], working: [] as ScheduleHbnGroup[], complete: [] as ScheduleHbnGroup[] };

describe("parseScheduleStage and refusal wording (canon 0.30.97)", () => {
  it("accepts trim and cryo and rejects anything else", () => {
    expect(parseScheduleStage("trim")).toBe(SCHEDULE_STAGES.trim);
    expect(parseScheduleStage("cryo")).toBe(SCHEDULE_STAGES.cryo);
    expect(parseScheduleStage("pasteurization")).toBeNull();
    expect(parseScheduleStage("")).toBeNull();
    expect(parseScheduleStage(undefined)).toBeNull();
  });

  it("pins the one-row-per-item refusal and the empty-HBN wording", () => {
    expect(SCHEDULE_REFUSAL.alreadyScheduled).toBe("That item is already on the schedule.");
    expect(SCHEDULE_REFUSAL.nothingAvailable).toBe("Nothing available to schedule on this HBN.");
    expect(SCHEDULE_REFUSAL.demotePin).toBe("Unfinishing a completed item needs the Admin PIN.");
  });

  it("Status words: In queue on Trimming, Pasteurizing on Pasteurization", () => {
    expect(scheduleStatusWord("trim")).toBe("In queue");
    expect(scheduleStatusWord("cryo")).toBe("Pasteurizing");
    expect(scheduleStatusWord("prepack")).toBe("Scheduled");
  });
});

describe("the paneFilter union compiles on the entry stations (canon 0.30.97)", () => {
  it("trim_packages is trim_scheduled and cryo_weight is cryo_scheduled", () => {
    expect(stationByKey("trim_packages")!.leftPane?.paneFilter).toBe("trim_scheduled");
    expect(stationByKey("cryo_weight")!.leftPane?.paneFilter).toBe("cryo_scheduled");
  });
});

describe("schedulingLanding (canon 0.30.97)", () => {
  it("renders Trimming, Pasteurization, then Prepack", () => {
    const html = schedulingLanding("en");
    expect(html).toContain("<h1>Production Scheduling</h1>");
    expect(html).toContain('href="/production/scheduling/trim"');
    expect(html).toContain('href="/production/scheduling/cryo"');
    expect(html).toContain('href="/production/scheduling/prepack"');
    expect(html).toContain("Trimming");
    expect(html).toContain("Pasteurization");
    expect(html).toContain("Prepack");
    expect(html.indexOf("Trimming")).toBeLessThan(html.indexOf("Pasteurization"));
    expect(html.indexOf("Pasteurization")).toBeLessThan(html.indexOf('href="/production/scheduling/prepack"'));
    // THE BACK LINK (canon 0.30.109): the crumb carries the way back to
    // Production Operations; the landing repeats no link of its own.
    expect(html).not.toContain('href="/ops/production_ops"');
    expect(backLinkFor("/production/scheduling")).toEqual({ href: "/ops/production_ops", label: "Production Operations" });
    expect(backLinkFor("/production/scheduling/cryo")).toEqual({ href: "/production/scheduling", label: "Production Scheduling" });
  });

  it("speaks Spanish", () => {
    const es = schedulingLanding("es");
    expect(es).toContain("Programacion de produccion");
    expect(es).toContain("Recorte");
    expect(es).toContain("Pasteurizacion");
  });
});

describe("THE DRYING SCHEDULE's landing tiles (canon 0.30.226)", () => {
  it("the Drying Operations landing gains Silos, Dry Rooms and Freezers after its stations; Load Silo stays first", () => {
    const drying = opsGroupByKey("drying_ops");
    if (!drying) throw new Error("drying_ops missing");
    expect(drying.members[0]).toMatchObject({ key: "load_silo", href: "/station/load_silo" });
    expect(drying.members.slice(-3)).toEqual([
      { key: "schedule_silos", title: "Silos", href: "/production/scheduling/silos" },
      { key: "schedule_dry_rooms", title: "Dry Rooms", href: "/production/scheduling/dry_rooms" },
      { key: "schedule_freezers", title: "Freezers", href: "/production/scheduling/freezers" },
    ]);
    const html = opsGroupPage(drying, "en");
    expect(html).toContain('<a class="tile" href="/production/scheduling/silos" data-pipeline-key="schedule_silos">');
    expect(html).toContain('<a class="tile" href="/production/scheduling/dry_rooms" data-pipeline-key="schedule_dry_rooms">');
    expect(html).toContain('<a class="tile" href="/production/scheduling/freezers" data-pipeline-key="schedule_freezers">');
    expect(html.indexOf('data-pipeline-key="unload_dry_space"')).toBeLessThan(html.indexOf('data-pipeline-key="schedule_silos"'));
    const es = opsGroupPage(drying, "es");
    expect(es).toContain("Cuartos de secado");
    expect(es).toContain("Congeladores");
    // The crumb of each surface goes back to Drying Operations, the query aside.
    for (const stage of ["silos", "dry_rooms", "freezers"] as const) {
      expect(SCHEDULE_STAGES[stage]).toBe(stage);
      expect(backLinkFor(`/production/scheduling/${stage}`)).toEqual({ href: "/ops/drying_ops", label: "Drying Operations" });
    }
    expect(backLinkFor("/production/scheduling/dry_rooms?together=x")).toEqual({ href: "/ops/drying_ops", label: "Drying Operations" });
    expect(SCHEDULE_STAGE_TITLES.silos).toBe("Silos");
    expect(SCHEDULE_STAGE_TITLES.dry_rooms).toBe("Dry Rooms");
    expect(SCHEDULE_STAGE_TITLES.freezers).toBe("Freezers");
    // The Production Scheduling landing keeps its three lines.
    const lines = schedulingLanding("en");
    expect(lines).not.toContain("/production/scheduling/silos");
    expect((lines.match(/class="tile"/g) || []).length).toBe(3);
  });
});

describe("schedulingPage (canon 0.30.97)", () => {
  it("three panes, each EMPTY when nothing is on them", () => {
    const html = schedulingPage("trim", empty, "en", NOW);
    expect(html).toContain('class="station-triple"');
    expect(html).toContain('data-schedule-pane="available"');
    expect(html).toContain('data-schedule-pane="working"');
    expect(html).toContain('data-schedule-pane="complete"');
    expect((html.match(/- EMPTY -/g) || []).length).toBe(3);
  });

  it("collapsed HBN with its count and the >> control with its title; item rows have no links", () => {
    const html = schedulingPage(
      "trim",
      {
        available: [
          group([
            item({ id: "lot-a", identity: "26011 / Fruity Pebbles / 751.00 g / 26011" }),
            item({ id: "lot-b", identity: "26012 / Fruity Pebbles / 200.00 g / 26012" }),
          ]),
        ],
        working: [],
        complete: [],
      },
      "en",
      NOW
    );
    expect(html).toContain('<details class="pane-group" data-schedule-hbn="hbn1">');
    expect(html).not.toContain("<details class=\"pane-group\" open");
    // THE HBN ON THE SCHEDULING PANES (canon 0.30.102): the group heads with
    // the full HBN alone; the farm / strain / date label is gone.
    expect(html).toContain('<span class="schedule-hbn-line">26251-ARL-GH-027-0-NA-26011 <span class="tile-count">2</span></span>');
    expect(html).not.toContain("ARL / Fruity Pebbles / 2026-09-08");
    expect(html).toContain('<span class="tile-count">2</span>');
    expect(html).toContain('class="shuttle-btn"');
    expect(html).toContain('title="Schedule trim"');
    expect(html).toContain("&gt;&gt;");
    expect(html).toContain('name="hbn_id" value="hbn1"');
    expect(html).toContain('class="schedule-item-readonly"');
    expect(html).toContain("26011 / Fruity Pebbles / 751.00 g / 26011");
    expect(html).not.toMatch(/schedule-item-readonly"><a /);
    expect(html).not.toContain('href="/station/');
    expect(html).toContain('name="effective_date"');
    expect(html).toContain('name="effective_pin"');
  });

  it("working pane Status words per stage, with < and >", () => {
    const working = [
      group([
        item({
          id: "sched-1",
          identity: "26011 / Fruity Pebbles / 751.00 g / 26011",
          status: "scheduled",
        }),
      ]),
    ];
    const trim = schedulingPage("trim", { available: [], working, complete: [] }, "en", NOW);
    // Canon 0.30.102: the HBN heads the working group too.
    expect(trim).toContain('<h3 class="schedule-hbn-label">26251-ARL-GH-027-0-NA-26011</h3>');
    expect(trim).toContain('<span class="muted schedule-status">In queue</span>');
    expect(trim).toContain('action="/production/scheduling/trim/unschedule/sched-1"');
    expect(trim).toContain('action="/production/scheduling/trim/complete/sched-1"');
    expect(trim).toContain('title="Unschedule"');
    expect(trim).toContain("&lt;");
    expect(trim).toContain("&gt;");
    const cryo = schedulingPage("cryo", { available: [], working, complete: [] }, "en", NOW);
    expect(cryo).toContain('<span class="muted schedule-status">Pasteurizing</span>');
  });

  it("right pane PIN box on the demote form, with the local instant", () => {
    const html = schedulingPage(
      "trim",
      {
        available: [],
        working: [],
        complete: [
          group([
            item({
              id: "sched-done",
              identity: "26011 / Fruity Pebbles / 751.00 g / 26011",
              status: "complete",
              completed_at: NOW,
            }),
          ]),
        ],
      },
      "en",
      NOW
    );
    expect(html).toContain(`<time datetime="${NOW}" data-local>${NOW}</time>`);
    // Canon 0.30.102: the HBN heads the complete group too.
    expect(html).toContain('<h3 class="schedule-hbn-label">26251-ARL-GH-027-0-NA-26011</h3>');
    expect(html).toContain('name="unfinish_pin"');
    expect(html).toContain('action="/production/scheduling/trim/unfinish/sched-done"');
    expect(html).toContain('title="Unfinish"');
    expect(html).toContain("time[data-local]");
  });

  it("a demoted item whose work is done carries the muted trimmed line", () => {
    const html = schedulingPage(
      "trim",
      {
        available: [],
        working: [
          group([
            item({
              id: "sched-1",
              identity: "26011 / Fruity Pebbles / 751.00 g / 26011",
              status: "scheduled",
              workDone: "trimmed",
            }),
          ]),
        ],
        complete: [],
      },
      "en",
      NOW
    );
    expect(html).toContain('<span class="muted">trimmed</span>');
  });

  it("ES speaks on the station", () => {
    const html = schedulingPage(
      "trim",
      {
        available: [group([item({ id: "lot-a", identity: "26011" })])],
        working: [],
        complete: [],
      },
      "es",
      NOW
    );
    expect(html).toContain("<h1>Recorte</h1>");
    expect(html).toContain("Disponible");
    expect(html).toContain("Programado");
    expect(html).toContain("Completado");
    expect(html).toContain('title="Programar poda"');
    expect(html).toContain("- VACIO -");
    const cryo = schedulingPage("cryo", empty, "es", NOW);
    expect(cryo).toContain("<h1>Pasteurizacion</h1>");
  });

  it("Pasteurization >> title is Schedule pasteurization", () => {
    const html = schedulingPage(
      "cryo",
      {
        available: [group([item({ id: "pk1", identity: "BUD-1 / BUD / 100.00 g" })])],
        working: [],
        complete: [],
      },
      "en",
      NOW
    );
    expect(html).toContain("<h1>Pasteurization</h1>");
    expect(html).toContain('title="Schedule pasteurization"');
  });
});

describe("adopt from METRC (canon 0.30.193, the HBN inherited 0.30.196)", () => {
  const known = new Map([
    ["26260-PNN-GH-001-0-NA-26001", "hb-1"],
    ["26261-PNN-GH-002-0-NA-26002", "hb-2"],
  ]);

  it("inherits the source harvest, the first one the app knows, else one hop, and stops", () => {
    expect(harvestTokens("26260-PNN-GH-001-0-NA-26001, other")).toEqual(["26260-PNN-GH-001-0-NA-26001", "other"]);
    expect(inheritedHarvest({ sourceHarvests: "26260-pnn-gh-001-0-na-26001", sourcePackages: null }, new Map(), known)).toEqual({ harvest: "26260-PNN-GH-001-0-NA-26001", hbnId: "hb-1" });
    expect(inheritedHarvest({ sourceHarvests: "46258-PNN-ID-062-0-NA-26007; 26261-PNN-GH-002-0-NA-26002", sourcePackages: null }, new Map(), known)).toEqual({ harvest: "26261-PNN-GH-002-0-NA-26002", hbnId: "hb-2" });
    expect(inheritedHarvest({ sourceHarvests: "46258-PNN-ID-062-0-NA-26007", sourcePackages: null }, new Map(), known)).toEqual({ harvest: "46258-PNN-ID-062-0-NA-26007", hbnId: null });
    const byTag = new Map([["1A4050300000000000000D09", { sourceHarvests: "26261-PNN-GH-002-0-NA-26002" }]]);
    expect(inheritedHarvest({ sourceHarvests: null, sourcePackages: "1A4050300000000000000D09" }, byTag, known)).toEqual({ harvest: "26261-PNN-GH-002-0-NA-26002", hbnId: "hb-2" });
    const twoHops = new Map([["1A4050300000000000000D08", { sourceHarvests: null, sourcePackages: "1A4050300000000000000D09" }]]);
    expect(inheritedHarvest({ sourceHarvests: null, sourcePackages: "1A4050300000000000000D08" }, twoHops, known)).toBeNull();
    expect(inheritedHarvest({ sourceHarvests: null, sourcePackages: null }, new Map(), known)).toBeNull();
  });

  const adoptRow = (over: Partial<MetrcAdoptRow>): MetrcAdoptRow => ({
    tag: "1A4050300000000000000D01",
    kind: "WPR",
    strain: "Chem",
    grams: 1500,
    location: "Trim Room",
    license: "AU-P-000694",
    harvest: "26260-PNN-GH-001-0-NA-26001",
    hbnId: "hb-1",
    packagedDate: "2026-09-15",
    ...over,
  });

  it("From METRC reads the HBN each row will inherit, known or new, with no select; Adopt posts the tag alone", () => {
    const html = prepackSchedulingPage({ available: [], working: [], complete: [] }, {
      rows: [
        adoptRow({}),
        adoptRow({ tag: "1A4050300000000000000D02", harvest: "46258-PNN-ID-062-0-NA-26007", hbnId: null }),
        adoptRow({ tag: "1A4050300000000000000D03", harvest: null, hbnId: null }),
      ],
    }, "en");
    expect(html).toContain("data-schedule-adopt");
    expect(html).toContain("From METRC");
    expect(html).not.toContain("<select");
    expect(html).not.toContain('name="hbn_id"');
    expect(html).toContain('data-adopt-hbn="26260-PNN-GH-001-0-NA-26001" data-adopt-known="1">26260-PNN-GH-001-0-NA-26001 <strong>known</strong>');
    expect(html).toContain('data-adopt-hbn="46258-PNN-ID-062-0-NA-26007" data-adopt-known="0">46258-PNN-ID-062-0-NA-26007 <strong>new from METRC</strong>');
    expect(html).toContain("no harvest in METRC's lineage");
    // THE PACKAGE READS IN FOUR LINES (canon 0.30.199): the whole tag, the
    // strain and grams, the HBN it will inherit, the location; the license is
    // no longer on the row.
    expect(html).toContain('<span class="pkg-tag">1A4050300000000000000D01</span>');
    expect(html).toContain('<span class="pkg-strain-grams">Chem - 1,500 g</span>');
    expect(html).toContain('<span class="pkg-location">Location: Trim Room</span>');
    expect(html).not.toContain("...000D01");
    expect(html).not.toContain("AU-P-000694");
    const noHarvestRow = html.slice(html.indexOf('data-adopt-tag="1A4050300000000000000D03"'));
    expect(noHarvestRow.slice(0, noHarvestRow.indexOf("</li>"))).toContain('<span class="pkg-hbn"><span class="muted schedule-inherit" data-adopt-hbn="">no harvest in METRC\'s lineage</span></span>');
    expect(noHarvestRow.slice(0, noHarvestRow.indexOf("</li>"))).not.toContain("<button");
    expect(html).not.toContain("schedule-adopt-row");
    expect(html).not.toContain(">Adopt</button>");
    expect((html.match(/name="tag"/g) || []).length).toBe(2);
    expect(html).toContain('form="schedule-prepack" name="tag" value="1A4050300000000000000D01" class="shuttle-btn" title="Adopt and schedule"');
    const es = prepackSchedulingPage({ available: [], working: [], complete: [] }, { rows: [adoptRow({ harvest: "46258-PNN-ID-062-0-NA-26007", hbnId: null }), adoptRow({ tag: "1A4050300000000000000D04" }), adoptRow({ tag: "1A4050300000000000000D05", harvest: null, hbnId: null })] }, "es");
    expect(es).toContain("Desde METRC");
    expect(es).toContain("nuevo desde METRC");
    expect(es).toContain("conocido");
    expect(es).toContain("sin cosecha en el linaje de METRC");
    expect(es).toContain('title="Adoptar y programar"');
    const none = prepackSchedulingPage({ available: [], working: [], complete: [] }, { rows: [] }, "es");
    expect(none).toContain("Nada para adoptar.");
  });

  it("filters by the HBN or the last six, ignoring case; a scanned tag matches whole", () => {
    const hbn = "26244-ARL-GH-027-0-NA-26011";
    const tag = "1A4050300000000000000A01";
    expect(scheduleFilterHit("", hbn, tag)).toBe(true);
    expect(scheduleFilterHit("26011", hbn, tag)).toBe(true);
    expect(scheduleFilterHit("arl-gh", hbn, tag)).toBe(true);
    expect(scheduleFilterHit("000a01", hbn, tag)).toBe(true);
    expect(scheduleFilterHit("a01", hbn, tag)).toBe(true);
    expect(scheduleFilterHit("4050", hbn, tag)).toBe(false);
    expect(scheduleFilterHit(tag.toLowerCase(), hbn, tag)).toBe(true);
    expect(scheduleFilterHit("26012", hbn, tag)).toBe(false);
    expect(scheduleFilterHit("x", null, null)).toBe(false);
  });

  it("keeps an adopted package out of trim, the cryo inputs, and the parent-lot draw", () => {
    expect(parseMetrcReleaseStates("TestPassed=passed;NotSubmitted=nope").get("testpassed")).toBe("passed");
    expect(parseMetrcReleaseStates("TestPassed=passed;NotSubmitted=nope").has("notsubmitted")).toBe(false);
    expect(drawsFromParentLot("metrc")).toBe(false);
    expect(drawsFromParentLot("cryo")).toBe(false);
    expect(drawsFromParentLot(null)).toBe(true);
    expect(NON_TRIM_SOURCE_SQL).toContain("NOT IN ('cryo', 'metrc')");
  });
});

describe("THE SCHEDULER BY PACKAGE (canon 0.30.196)", () => {
  const HBN_A = "26244-ARL-GH-027-0-NA-26011";
  const HBN_B = "46258-PNN-ID-062-0-NA-26007";
  const row = (over: Partial<ScheduleItemRow> & Pick<ScheduleItemRow, "id" | "tag" | "hbn">): ScheduleItemRow => ({
    itemId: over.id,
    harvest_batch_id: "hb",
    farm_code: "ARL",
    strain_name: "Fruity Pebbles",
    entry_date: "2026-09-08",
    identity: String(over.tag),
    grams: 20,
    location: "Cryo 1",
    ...over,
  });
  const panes = {
    available: [
      row({ id: "pkg-a1", tag: "1A4050300000000000000A01", hbn: HBN_A }),
      row({ id: "pkg-a2", tag: "1A4050300000000000000A02", hbn: HBN_A }),
      row({ id: "pkg-b1", tag: "1A4050300000000000000B01", hbn: HBN_B }),
    ],
    working: [row({ id: "sched-1", tag: "1A4050300000000000000C11", hbn: HBN_A, status: "scheduled" })],
    complete: [row({ id: "sched-0", tag: "1A4050300000000000000C10", hbn: HBN_A, status: "complete", completed_at: NOW })],
  };

  it("lists packages on all three panes in four lines (the whole tag, the strain and grams, the HBN, the location), with >> each, << and >", () => {
    const html = prepackSchedulingPage(panes, null, "en");
    expect(html).not.toContain('<details class="pane-group"');
    expect(html).not.toContain("schedule-hbn-label");
    expect(html).not.toContain('name="hbn_id"');
    expect(html).toContain(`data-schedule-id="pkg-a1" data-schedule-tag="1A4050300000000000000A01" data-schedule-hbn="${HBN_A}"`);
    // THE PACKAGE READS IN FOUR LINES (canon 0.30.199).
    expect(html).toContain('<span class="pkg-tag">1A4050300000000000000A01</span>');
    expect(html).toContain('<span class="pkg-strain-grams">Fruity Pebbles - 20 g</span>');
    expect(html).toContain(`<span class="pkg-hbn">${HBN_A}</span>`);
    expect(html).toContain('<span class="pkg-location">Location: Cryo 1</span>');
    expect(html).not.toContain("000A01 / Fruity Pebbles");
    expect(html).not.toContain("schedule-hbn-muted");
    expect(prepackSchedulingPage(panes, null, "es")).toContain('<span class="pkg-location">Ubicacion: Cryo 1</span>');
    expect((html.match(/name="wip_package_id"/g) || []).length).toBe(3);
    expect(html).toContain('form="schedule-prepack" name="wip_package_id" value="pkg-b1" class="shuttle-btn" title="Schedule prepack"');
    expect(html).toContain('action="/production/scheduling/prepack/schedule"');
    expect(html).toContain('data-schedule-count="available">3<');
    expect(html).toContain('action="/production/scheduling/prepack/unschedule/sched-1"');
    expect(html).toContain('title="Unschedule" aria-label="Unschedule">&lt;&lt;</button>');
    expect(html).toContain('href="/station/prepack?pick=sched-1" title="Prepack" aria-label="Prepack">&gt;</a>');
    expect(html).toContain(`<time datetime="${NOW}" data-local>${NOW}</time>`);
    expect(html).toContain('name="unfinish_pin"');
    expect(html).toContain('action="/production/scheduling/prepack/unfinish/sched-0"');
    expect(html).toContain('title="Unfinish"');
    expect(html).toContain('name="effective_date"');
  });

  it("the filter box sits on top; ?q= hides what does not match on every pane and counts what shows", () => {
    const html = prepackSchedulingPage(panes, { rows: [] }, "en", "26007");
    expect(html).toContain('<form method="get" action="/production/scheduling/prepack" class="schedule-filter" data-schedule-filter-form>');
    expect(html).toContain('name="q" value="26007" placeholder="HBN or last six" autocomplete="off" data-schedule-filter');
    expect(html.indexOf("data-schedule-filter")).toBeLessThan(html.indexOf('data-schedule-pane="available"'));
    expect(html).toContain('data-schedule-tag="1A4050300000000000000B01" data-schedule-hbn="46258-PNN-ID-062-0-NA-26007">');
    expect(html).toContain('data-schedule-tag="1A4050300000000000000A01" data-schedule-hbn="26244-ARL-GH-027-0-NA-26011" hidden>');
    expect(html).toContain('data-schedule-count="available">1<');
    expect(html).toContain('data-schedule-count="working">0<');
    const working = html.slice(html.indexOf('data-schedule-list="working"'), html.indexOf('data-schedule-pane="complete"'));
    expect(working).toContain('<p class="muted" data-schedule-empty>- EMPTY -</p>');
    expect((html.match(/<input type="hidden" name="q" value="26007" data-schedule-q>/g) || []).length).toBeGreaterThanOrEqual(2);
    const bySix = prepackSchedulingPage(panes, null, "en", "a02");
    expect(bySix).toContain('data-schedule-count="available">1<');
    expect(bySix).toContain('data-schedule-tag="1A4050300000000000000A02" data-schedule-hbn="26244-ARL-GH-027-0-NA-26011">');
    expect(bySix).toContain("data-schedule-filter");
    expect(bySix).toContain('document.querySelectorAll("[data-schedule-list]")');
    expect(bySix).toContain("history.replaceState");
  });

  it("speaks Spanish on the filter and the empty line", () => {
    const es = prepackSchedulingPage({ available: [], working: [], complete: [] }, null, "es");
    expect(es).toContain("Filtrar");
    expect(es).toContain('placeholder="HBN o ultimos seis"');
    expect((es.match(/- VACIO -/g) || []).length).toBe(3);
    expect(es).toContain("<h1>Preempacado</h1>");
  });

  it("refuses in words a package no longer available or already scheduled, and the HBN-wide >>", () => {
    expect(SCHEDULE_REFUSAL.packageGone).toBe("That package is no longer available to schedule.");
    expect(SCHEDULE_REFUSAL.packageScheduled).toBe("That package is already on the schedule.");
    expect(SCHEDULE_REFUSAL.prepackByPackage).toBe("Prepack schedules one package at a time, with the >> on its row.");
  });
});
