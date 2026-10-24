import { describe, expect, it } from "vitest";
import { testingPage, type ExternalTestRow } from "../src/compliance";
import { equipmentAssetPage, equipmentHomePage, type EquipmentAssetRow, type EquipmentScheduleRow } from "../src/equipment";
import { fieldEstimatesPage, type FieldEstimatesPageModel } from "../src/fieldestimates";
import { pendingUploadsPage, queueSection, reportPage } from "../src/html";
import { reconcileNotesSection } from "../src/ledgerloc";
import { metrcPane } from "../src/metrcpane";
import { logPage, lookupSectionPage } from "../src/pages";
import { queueByKey, type QueueDef } from "../src/pipeline";
import { postHarvestHtml, type PuzzlePage } from "../src/puzzles";
import type { ReportView } from "../src/reports";
import { testingDeskPage, type TestingDesk } from "../src/testing";
import { themeStylesheet } from "../src/theme";

const inScroller = (html: string, marker: string, cls = 'class="report-scroll"'): void => {
  const at = html.indexOf(marker);
  expect(at, marker).toBeGreaterThan(-1);
  expect(html.slice(Math.max(0, at - 90), at)).toContain(cls);
};

const asset: EquipmentAssetRow = {
  id: "eq1",
  serial: "PM-100",
  name: "Northwind mill",
  farm_code: "PNN",
  notes: null,
  open_tickets: 0,
};

const schedule: EquipmentScheduleRow = {
  id: "sch1",
  asset_id: "eq1",
  task: "Grease the bearings",
  interval_days: 7,
  last_done: null,
};

describe("PH1 sideways scrollers", () => {
  it("the three views wrap lot meta and long harvest values", () => {
    for (const view of ["lite", "co", "cerberus"] as const) {
      const css = themeStylesheet(view);
      expect(css).toContain("grid-template-columns: fit-content(45%) minmax(0, 1fr)");
      expect(css).toContain(".lot-meta dt");
      expect(css).toContain(".lot-meta dd");
      expect(css).toContain("overflow-wrap: break-word");
      expect(css).toContain(".hd-break { overflow-wrap: anywhere; }");
      expect(css).toContain("min-width: 0; overflow-x: auto; -webkit-overflow-scrolling: touch;");
    }
  });

  it("equipment tables sit in the equipment scroller", () => {
    const home = equipmentHomePage([asset], [schedule], "2026-10-24");
    expect(home).toContain(".eq-scroll { display: block; width: 100%; max-width: 100%; min-width: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }");
    inScroller(home, '<table class="eq">', 'class="eq-scroll"');
    const detail = equipmentAssetPage(asset, [schedule], [], [], "2026-10-24");
    inScroller(detail, '<table class="eq">', 'class="eq-scroll"');
    expect(detail).toContain("Grease the bearings");
  });

  it("the log, people, and app config tables sit in the scroller", () => {
    const log = logPage([{ changed_at: "2026-10-24T16:00:00.000Z", record_table: "lab_internal_tests", record_id: "lt_sideways0001", field: "notes", old_value: null, new_value: "checked", actor_person_id: "p1", reason: "lab station" }]);
    inScroller(log, '<table class="data wide">');
    const tables = {
      people: [{ id: "p1", display_name: "Bench Hand", email: "bench@example.test", phone: "", is_active: 1 }],
      farms: [],
      grow_methods: [],
      strains: [],
      dry_spaces: [],
      package_types: [],
      app_config: [{ id: "cryo_type_categories", key: "cryo_type_categories", value: "BUD=BUD,SMALLS=WPR,SHAKE=SHA", updated_at: "2026-10-24T00:00:00.000Z" }],
    };
    inScroller(lookupSectionPage("people", tables, []), '<table class="data">');
    inScroller(lookupSectionPage("app_config", tables, []), '<table class="data">');
    expect(lookupSectionPage("farms", { ...tables, farms: [{ id: "PNN", code: "PNN", display_name: "Penn North" }] }, [])).not.toContain('class="report-scroll"');
  });

  it("the testing desk, compliance external table, and METRC license lines sit in the scroller", () => {
    const desk: TestingDesk = {
      ready: [
        {
          lot_id: "lot1",
          dry_grams: 448,
          harvest_batch_id: "hb1",
          hbn: "00000-PNN-GH-001-0-NA-26991",
          farm_code: "PNN",
          license_value: "AU-G-C-900001",
          strain_name: "Sample Alpha",
          package_code: null,
          metrc_tag: null,
          metrc_harvest_tag: null,
        },
      ],
      orders: [],
      manifests: [],
      labs: [],
    };
    inScroller(testingDeskPage(desk, "en"), '<table class="data">');
    const row: ExternalTestRow = {
      id: "cs1",
      license_number: "AU-G-C-900001",
      med_au: "AU",
      strain: "Sample Alpha",
      item_name: "Sample Bud",
      source_metrc_tag: "1A4000000000000000000001",
      batch_weight_grams: 448,
      hbn: "26991",
      sample_tag: "1A4000000000000000000002",
      required_test: "Full Compliance",
      net_weight_grams: 114,
      testing_facility: "Harbor Testing",
      entered_testing: "2026-10-01",
      finished_testing: null,
      attempt: 1,
      potency_result: null,
      finalized_potency: null,
      status: "in_testing",
      failure_mode: null,
    };
    inScroller(testingPage("external", [row], { facility: "", status: "", year: "" }), '<table class="data">');
    const pane = metrcPane(
      {
        lines: [
          {
            license_value: "AU-G-C-900001",
            plants_flowering: 1,
            plants_vegetative: 0,
            plants_other: 0,
            packages: 2,
            package_grams: 448,
            package_eaches: 0,
            newest_mount: "2026-10-24T16:00:00.000Z",
          },
        ],
        mounts: [],
        cross: {
          ledger_tagged: 1,
          ledger_in_metrc: 1,
          ledger_gone_in_metrc: 0,
          ledger_unknown_to_metrc: 0,
          ledger_untagged: 0,
          metrc_active: 2,
          metrc_unclaimed: 1,
          zoho_tagged: 0,
          zoho_in_metrc: 0,
          zoho_not_in_metrc: 0,
          samples: { ledger_unknown: [], zoho_not_in_metrc: [] },
        },
        licenses: [],
        defs: [],
      },
      "en"
    );
    inScroller(pane, '<table class="data metrc-lines"');
    expect(pane).toContain('class="lot-meta"');
  });

  it("queues, uploads, puzzles, field estimates, and the two wide reports sit in the scroller", () => {
    const queue = queueByKey("hbn_queue") as QueueDef;
    const queues = queueSection(queue, [{ id: "q1", values: { hbn: "26991", customer: "", is_test: "0" } }], "en");
    inScroller(queues, '<table class="data">');
    const uploads = pendingUploadsPage(
      [
        {
          id: "load1",
          harvest_batch_id: "hb1",
          hbn: "00000-PNN-GH-001-0-NA-26991",
          seq: 1,
          lot: "26991",
          load_label: "Load 1",
          wet_total_grams: 448,
          plant_count: 1,
          newest_activity: "2026-10-24T16:00:00.000Z",
          tag_count: 0,
          unassigned: 0,
          tags_locked: true,
        },
      ],
      "en",
      [],
      [],
      [],
      [],
      [],
      { movements: new Set(), batches: new Set(), parents: new Set() },
      [],
      [
        {
          id: "run1",
          harvest_batch_id: "hb1",
          hbn: "00000-PNN-GH-001-0-NA-26991",
          outputs: 1,
          out_grams: 448,
          newest_activity: "2026-10-24T16:00:00.000Z",
          filename: "new-packages-26991.xlsx",
          kind: "new_packages",
        },
      ],
      [
        {
          id: "note1",
          kind: "edit",
          farm_code: "PNN",
          location: "Vault",
          note: "counted again",
          summary: "grams",
          detail: null,
          acknowledged_at: null,
          created_at: "2026-10-24T16:00:00.000Z",
          created_by_name: "Bench Hand",
        },
      ]
    );
    inScroller(uploads, '<table class="data"><thead>');
    inScroller(uploads, '<table class="data" data-new-packages-table');
    inScroller(reconcileNotesSection([
      {
        id: "note1",
        kind: "edit",
        farm_code: "PNN",
        location: "Vault",
        note: "counted again",
        summary: "grams",
        detail: null,
        acknowledged_at: null,
        created_at: "2026-10-24T16:00:00.000Z",
        created_by_name: "Bench Hand",
      },
    ]), '<table class="data" data-reconcile-notes');
    const puzzle: PuzzlePage = {
      year: 2026,
      farm: "All",
      years: [2026],
      source: "live",
      rows: [],
      totals: { plants: 0, wetLbs: 0, dryLbs: 0, wetPp: null, dryPp: null, allocation: 0, withNew: 0 },
      newStrains: [],
      budPrice: 150,
      trimPrice: 30,
      best: { dryPp: new Set(), btr: new Set(), dollarPp: new Set(), thc: new Set() },
      worstTym: new Set(),
    };
    inScroller(postHarvestHtml(puzzle, "en"), '<table class="data" data-php-table');
    const estimates: FieldEstimatesPageModel = {
      today: "2026-10-24",
      strains: [{ id: "st1", name: "Sample Alpha" }],
      farms: [{ code: "PNN", name: "Penn North" }],
      rows: [
        {
          id: "fe1",
          strain_id: "st1",
          strain_name: "Sample Alpha",
          farm_code: "PNN",
          effective_date: "2026-10-01",
          est_dry_weight: 1.5,
          reason: "hand entered",
          in_force: true,
        },
      ],
    };
    inScroller(fieldEstimatesPage(estimates, "en"), "<table data-field-estimates");
    const history: ReportView = {
      key: "environment_history",
      title: "Environment history",
      columns: [
        { key: "room", label: "Room" },
        { key: "hour", label: "Hour" },
      ],
      rows: [{ room: "Dry 1", hour: "2026-10-24 01:00" }],
      empty: "No readings in that range.",
    };
    inScroller(reportPage(history, "", ""), '<table class="data">');
    const reconcile: ReportView = { ...history, key: "harvest_reconciliation", title: "Harvest weight reconciliation" };
    inScroller(reportPage(reconcile, "", ""), '<table class="data">');
  });

  it("every table in the uploads folds sits in the scroller (the gate's 820 sweep)", () => {
    const at = "2026-10-24T16:00:00.000Z";
    const uploads = pendingUploadsPage(
      [],
      "en",
      [{ id: "pk1", kind: "wet", harvest_batch_id: "hb1", hbn: "00000-PNN-GH-001-0-NA-26991", lot: "26991", seq: 1, newest_activity: at }],
      [{ id: "rc1", movement_id: "mv1", filename: "receive-mv1.csv", newest_activity: at, harvest_batch_id: "hb1" }],
      [{ id: "mf1", movement_kind: "transfer", origin_license: "AU-P-000001", destination_license: "AU-P-000002", metrc_manifest_number: null, newest_activity: at, filename: "manifest-mf1.csv" }],
      [{ id: "sp1", parent_code: "WPR-0001", harvest_batch_id: "hb1", filename: "split-sp1.csv", newest_activity: at }],
      [{ id: "lc1", harvest_batch_id: "hb1", hbn: "00000-PNN-GH-001-0-NA-26991", lot: "26991", silo_name: "Silo 9", file_location: "Silo 9", seq: 1, newest_activity: at }],
      { movements: new Set(), batches: new Set(), parents: new Set() },
      [],
      [],
      [],
      [{ id: "ts1", manifest_date: "2026-10-24", lab_name: "Sample Lab", license_value: "AU-P-000001", hbn: "00000-PNN-GH-001-0-NA-26991", harvest_batch_id: "hb1", samples: 2, untagged: 0, filename: "test-samples-ts1.csv" }],
      [{ id: "pp1", hbn: "00000-PNN-GH-001-0-NA-26991", kind: "new_packages", filename: "prepack-pp1.xlsx", newest_activity: at }],
      [{ id: "ch1", hbn: "00000-PNN-GH-001-0-NA-26991", seq: 1, marked_at: at, then_grams: 448, now_grams: 896, then_count: 1, now_count: 2 }]
    );
    const tables = [...uploads.matchAll(/<table\b/g)].map((m) => m.index ?? 0);
    expect(tables.length).toBeGreaterThanOrEqual(8);
    for (const index of tables) expect(uploads.slice(Math.max(0, index - 40), index)).toContain('<div class="report-scroll">');
  });
});
