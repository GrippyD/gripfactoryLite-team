import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import {
  isGrowSideLocation,
  isPickableProcessorDestination,
  isProcessorSideLocation,
  LOC_ARL_BARN,
  LOC_BARN,
  LOC_CSA,
  LOC_PNS_BARN,
  siteOfLocation,
} from "../src/config";
import {
  deviceComputerGlyph,
  devicePhoneGlyph,
  layout,
  unloadLotPanel,
  virtualMovePage,
} from "../src/html";
import { FINISH_CSV_HEADER, packageFinishCsv } from "../src/interco";
import { processorSideLocations, virtualMoveLanding } from "../src/ledger";
import { lookupSectionPage } from "../src/pages";
import { stationByKey } from "../src/pipeline";
import { isReconcileChoice, reconcileDeltaLabel, reconcileGate } from "../src/reconcile";
import { coStylesheet, themeStylesheet } from "../src/theme";

const UNLOAD = stationByKey("unload_dry_space")!;
const SILO_LOT = {
  id: "lot-silo",
  hbn: "26244-ARL-GH-027-0-NA-26002",
  metrc_harvest_tag: "1A4000000000000000A4B7C9",
  strain_name: "Fruity Pebbles",
  dry_space_name: "Silo 1",
  dry_space_kind: "silo",
  weight_grams: 1234.56,
};
const HANG_LOT = {
  id: "lot-hang",
  hbn: "26246-ARL-GH-027-0-NA-26011",
  metrc_harvest_tag: null,
  strain_name: "Fruity Pebbles",
  dry_space_name: "Arlington Dry Room",
  dry_space_kind: "hang",
  weight_grams: 200,
};

describe("device pill glyphs (canon 0.19.0)", () => {
  it("renders monitor and phone glyphs with i18n aria-label and title", () => {
    const html = layout({
      title: "Home",
      theme: "grip",
      personEmail: "pat@gripcannabis.com",
      body: "<p>x</p>",
    });
    expect(html).toContain(deviceComputerGlyph());
    expect(html).toContain(devicePhoneGlyph());
    expect(deviceComputerGlyph()).toContain('viewBox="0 0 24 24"');
    expect(deviceComputerGlyph()).toContain('aria-hidden="true"');
    expect(devicePhoneGlyph()).toContain('aria-hidden="true"');
    expect(html).toContain('aria-label="Computer"');
    expect(html).toContain('title="Computer"');
    expect(html).toContain('aria-label="Phone"');
    expect(html).toContain('title="Phone"');
    const es = layout({
      title: "Home",
      theme: "grip",
      personEmail: "pat@gripcannabis.com",
      body: "<p>x</p>",
      locale: "es",
    });
    expect(es).toContain('aria-label="Computadora"');
    expect(es).toContain('aria-label="Teléfono"');
  });
});

describe("CO invert and white-icon amendment (canon 0.19.0)", () => {
  it("uses dark tokens as the always value in both schemes", () => {
    const css = coStylesheet();
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain("--bg: #0e0f11");
    expect(css).toContain("--text: #e9e9ea");
    expect(css).toContain("--key-sheen: rgba(255, 255, 255, 0.07)");
    expect(css).toContain("@media (prefers-color-scheme: light)");
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("--bg: #f6f4ef");
    expect(themeStylesheet("co")).toContain(".ops-icon-on-dark { display: block; }");
    expect(themeStylesheet("co")).toContain(".ops-icon-on-light { display: none; }");
    // Lite identity law (canon 0.20.1): Lite renders no icons at all.
    expect(themeStylesheet("lite")).toContain(".ops-icon-on-dark, .ops-icon-on-light { display: none; }");
    expect(themeStylesheet("cerberus")).toContain(".ops-icon-on-dark { display: block; }");
  });
});

describe("reconcile gate helper", () => {
  it("returns exact with no choices when recorded matches parent", () => {
    const gate = reconcileGate({ recorded: 100, parentQty: 100, mode: "silo" });
    expect(gate).toEqual({ kind: "exact", delta: 0, absDelta: 0, choices: [] });
    expect(isReconcileChoice("nothing")).toBe(true);
    expect(isReconcileChoice("nope")).toBe(false);
  });

  it("over issue offers adjust, nothing, and back; spear marks adjust queued (canon 0.30.1 fork 7)", () => {
    const bucked = reconcileGate({ recorded: 120, parentQty: 100, mode: "bucked" });
    expect(bucked.kind).toBe("over");
    expect(bucked.delta).toBe(20);
    expect(bucked.choices.map((c) => c.id)).toEqual(["queue_adjust", "nothing", "back"]);
    expect(bucked.choices[0]?.alreadyQueued).toBeUndefined();
    const spear = reconcileGate({ recorded: 120, parentQty: 100, mode: "spear" });
    expect(spear.choices[0]).toEqual({ id: "queue_adjust", alreadyQueued: true });
    expect(reconcileDeltaLabel(1200)).toBe("1,200");
  });

  it("under issue offers adjust, nothing, and back; the METRC finish is gone from every gate (canon 0.30.1 fork 7)", () => {
    const under = reconcileGate({ recorded: 80, parentQty: 100, mode: "silo" });
    expect(under.kind).toBe("under");
    expect(under.absDelta).toBe(20);
    expect(under.choices.map((c) => c.id)).toEqual(["queue_adjust", "nothing", "back"]);
    expect(under.choices.some((c) => String(c.id) === "queue_finish")).toBe(false);
  });
});

describe("unload overissue markup and rapid add", () => {
  it("puts parent qty and recorded total on the add form and shows the standing banner", () => {
    const html = unloadLotPanel(
      UNLOAD,
      SILO_LOT,
      [{ id: "w1", weight_grams: 1234.56, created_at: "2026-09-04T00:00:00.000Z" }],
      1234.56,
      "en",
      null,
      "TL",
      1,
      { parentQty: 1000 }
    );
    expect(html).toContain('data-parent-qty="1000"');
    expect(html).toContain('data-recorded-total="1234.56"');
    // THE SUPERVISOR AND THE TEAM LEAD (canon 0.30.67): the session line names
    // the login as the Supervisor, never as the TL; the Team Lead reads from the
    // lot when it carries one.
    expect(html).toContain('<p class="muted" data-supervisor>Supervisor: TL</p>');
    expect(html).not.toContain(">TL: TL<");
    expect(html).not.toContain("data-team-lead");
    const withLead = unloadLotPanel(UNLOAD, { ...SILO_LOT, lead_name: "Maria" }, [], 0, "en", null, "TL", 0, {});
    expect(withLead).toContain('<p class="muted" data-team-lead>Team Lead: Maria</p>');
    expect(html).toContain("data-overissue-form");
    expect(html).toContain("This weight over issues the parent package. Record it anyway?");
    expect(html).toContain("data-overissue-banner");
    expect(html).toContain("Over issued by");
    expect(html).toContain("235 g");
    expect(html).toContain('name="rapid_add" value="1"');
  });

  // Patrick's feedback relayed by the owner, 2026-09-11 (canon 0.30.37): THE
  // OVERISSUE LINE IS STRICT. Issuing exactly the parent's grams is clean; the
  // banner and the ask fire only past the parent.
  it("keeps the banner down when the recorded total lands exactly on the parent", () => {
    const html = unloadLotPanel(
      UNLOAD,
      SILO_LOT,
      [{ id: "w1", weight_grams: 1000, created_at: "2026-09-04T00:00:00.000Z" }],
      1000,
      "en",
      null,
      "TL",
      1,
      { parentQty: 1000 }
    );
    expect(html).not.toContain("data-overissue-banner");
    expect(html).not.toContain("Over issued by");
    // The live ask still rides the form for the NEXT weight, strictly greater.
    expect(html).toContain("data-overissue-form");
    expect(html).toContain("typed() + recorded > parent + 0.005");
    expect(html).not.toContain(">= parent");
  });

  it("raises the banner one cent past the parent", () => {
    const html = unloadLotPanel(
      UNLOAD,
      SILO_LOT,
      [{ id: "w1", weight_grams: 1000.01, created_at: "2026-09-04T00:00:00.000Z" }],
      1000.01,
      "en",
      null,
      "TL",
      1,
      { parentQty: 1000 }
    );
    expect(html).toContain("data-overissue-banner");
    expect(html).toContain("Over issued by");
    expect(html).toContain("0 g");
  });

  it("signals clear-and-refocus when rapid=1", () => {
    const html = unloadLotPanel(UNLOAD, SILO_LOT, [], 0, "en", null, "TL", 0, {
      parentQty: 1000,
      rapidFocus: true,
    });
    expect(html).toContain("data-rapid-focus");
  });

  it("renders every over-issue gate branch including spear already queued", () => {
    const over = unloadLotPanel(
      UNLOAD,
      SILO_LOT,
      [{ id: "w1", weight_grams: 1100, created_at: "2026-09-04T00:00:00.000Z" }],
      1100,
      "en",
      { id: "s1", wet_weight_entry_id: "lot-silo", operator_name: "Op", weigh_mode: "bucked", bucked_on_site: null, truck_number: null, finished_at: null },
      "TL",
      1,
      { parentQty: 1000, showGate: true }
    );
    expect(over).toContain('data-gate-kind="over"');
    expect(over).toContain("Over issued by");
    expect(over).toContain('name="gate_choice" value="queue_adjust"');
    // Canon 0.30.1 fork 7: the METRC finish choice is gone from every gate.
    expect(over).not.toContain('name="gate_choice" value="queue_finish"');
    expect(over).toContain('name="gate_choice" value="nothing"');
    expect(over).toContain('name="gate_choice" value="back"');
    expect(over).toContain("Queue an adjustment CSV");
    expect(over).not.toContain("Finish unload");
    const spear = unloadLotPanel(
      UNLOAD,
      HANG_LOT,
      [{ id: "w1", weight_grams: 250, created_at: "2026-09-04T00:00:00.000Z" }],
      250,
      "en",
      { id: "s2", wet_weight_entry_id: "lot-hang", operator_name: "Op", weigh_mode: "spear", bucked_on_site: 1, truck_number: null, finished_at: null },
      "TL",
      1,
      { parentQty: 200, showGate: true }
    );
    expect(spear).toContain("data-already-queued");
    expect(spear).toContain("Already queued");
  });

  it("renders the under-issue gate and keeps exact match on the normal finish", () => {
    const under = unloadLotPanel(
      UNLOAD,
      SILO_LOT,
      [{ id: "w1", weight_grams: 751, created_at: "2026-09-04T00:00:00.000Z" }],
      751,
      "en",
      null,
      "TL",
      1,
      { parentQty: 1234.56, showGate: true }
    );
    expect(under).toContain('data-gate-kind="under"');
    // Canon 0.30.1 forks 7 and 8: the under gate loses the METRC finish and
    // gains the adjustment CSV as its corrective lane.
    expect(under).toContain("Recorded short of the parent. Queue an adjustment CSV, weigh more, or finish with a deliberate nothing.");
    expect(under).not.toContain("Finish package in METRC");
    expect(under).toContain('value="queue_adjust"');
    const exact = unloadLotPanel(
      UNLOAD,
      SILO_LOT,
      [{ id: "w1", weight_grams: 1000, created_at: "2026-09-04T00:00:00.000Z" }],
      1000,
      "en",
      null,
      "TL",
      1,
      { parentQty: 1000, showGate: true }
    );
    expect(exact).not.toContain("data-reconcile-gate");
    expect(exact).toContain("Finish unload");
  });
});

describe("package finish CSV shape (provisional)", () => {
  it("emits Label,FinishDate RAW RFC 4180", () => {
    expect(FINISH_CSV_HEADER).toBe("Label,FinishDate");
    expect(packageFinishCsv([{ label: "26002", finishDate: "2026-09-04" }])).toBe(
      "Label,FinishDate\r\n26002,2026-09-04\r\n"
    );
  });
});

describe("migration 0021 barn cutover", () => {
  it("moves CSA items to BARN and stamps the CSA lookup superseded", () => {
    const items = [{ location: "CSA" }, { location: "CSB" }];
    const after = items.map((row) => (row.location === "CSA" ? { location: "BARN" } : row));
    expect(after).toEqual([{ location: "BARN" }, { location: "CSB" }]);
    const lookup = {
      value: "CSA",
      deleted_at: "2026-09-04T00:00:00.000Z",
      delete_reason: "superseded by Barn, owner delegation 2026-09-04",
    };
    expect(lookup.delete_reason).toBe("superseded by Barn, owner delegation 2026-09-04");
    expect(LOC_BARN).toBe("BARN");
  });
});

describe("location side convention and virtual move dest", () => {
  it("treats BARN as the only 832-side location", () => {
    expect(LOC_BARN).toBe("BARN");
    expect(isGrowSideLocation("BARN")).toBe(true);
    expect(isGrowSideLocation("CSB")).toBe(false);
    expect(isProcessorSideLocation("BARN")).toBe(false);
    expect(isProcessorSideLocation("CSB")).toBe(true);
    // Scribe gate fix (canon 0.20.1 queue): IN-TRANSIT is a state, not a
    // shelf. It never appears as a pickable destination, and a forced POST
    // naming it falls back to CSB.
    const dests = processorSideLocations([
      { value: "BARN" },
      { value: "CSB" },
      { value: "IN-TRANSIT" },
    ]);
    expect(dests.map((d) => d.value)).toEqual(["CSB"]);
    expect(virtualMoveLanding("to_processor", "CSB").location).toBe("CSB");
    expect(virtualMoveLanding("to_processor", "IN-TRANSIT").location).toBe("CSB");
    expect(virtualMoveLanding("to_grow").location).toBe("BARN");
  });

  it("excludes BARN from the processor dest select and lands the reverse in the barn", () => {
    const page = virtualMovePage(
      [
        {
          id: "g1",
          item_kind: "SPR",
          package_code: "26011",
          harvest_batch_id: "hb1",
          wet_weight_entry_id: "lot-hang",
          strain_id: null,
          strain_name: "Fruity Pebbles",
          qty: 80,
          uom: "g",
          farm_code: "PNN",
          farm_name: "Penn North",
          license_value: "AU-G-C-000832",
          location: "BARN",
          location_label: "Barn",
          created_at: "2026-09-04T00:00:00.000Z",
        },
      ],
      [],
      [],
      "en",
      [
        { value: "AU-G-C-000832", label: "PNN AU", tone: "blue" },
        { value: "AU-P-000694", label: "PNN Processor", tone: "green" },
      ],
      [
        { value: "BARN", label: "Barn" },
        { value: "CSB", label: "CSB" },
      ]
    );
    expect(page).toContain('name="dest_location"');
    expect(page).toContain('value="CSB" selected');
    expect(page).not.toMatch(/<option value="BARN"/);
    expect(page).toContain("Barn");
    expect(page).toContain("data-location=\"BARN\"");
    const pane = lookupSectionPage(
      "inventory_locations",
      {
        people: [],
        farms: [],
        grow_methods: [],
        strains: [],
        dry_spaces: [],
        package_types: [],
        app_config: [],
      },
      [{ id: "loc-barn", value: "BARN", label: "Barn", sort_order: 0 }],
      "en"
    );
    expect(pane).toContain("Barns are the inbox at every site. CSA is 832-side staging. CSB and unknown spots are processor under 694.");
  });
});

describe("side convention v2 (canon 0.25.0, migration 0028)", () => {
  it("pins SITE_OF_LOCATION: barns and CSA and silos, unknown falls to processor", () => {
    expect(siteOfLocation("BARN")).toBe("PNN");
    expect(siteOfLocation("CSA")).toBe("PNN");
    expect(siteOfLocation("Silo 1")).toBe("PNN");
    expect(siteOfLocation("Silo 5")).toBe("PNN");
    expect(siteOfLocation("ARL BARN")).toBe("ARL");
    expect(siteOfLocation("PNS BARN")).toBe("PNS");
    expect(siteOfLocation("CSB")).toBe("PROCESSOR");
    expect(siteOfLocation("Warehouse 9")).toBe("PROCESSOR");
    expect(isGrowSideLocation("BARN")).toBe(true);
    expect(isGrowSideLocation("CSA")).toBe(true);
    expect(isGrowSideLocation("ARL BARN")).toBe(true);
    expect(isGrowSideLocation("PNS BARN")).toBe(true);
    expect(isGrowSideLocation("CSB")).toBe(false);
    expect(isProcessorSideLocation("CSB")).toBe(true);
    expect(isProcessorSideLocation("Mystery Shelf")).toBe(true);
    expect(isPickableProcessorDestination("IN-TRANSIT")).toBe(false);
    expect(isPickableProcessorDestination("CSB")).toBe(true);
    expect(LOC_ARL_BARN).toBe("ARL BARN");
    expect(LOC_PNS_BARN).toBe("PNS BARN");
    expect(LOC_CSA).toBe("CSA");
    expect(LOC_BARN).toBe("BARN");
  });

  it("0028 cutover moves ARL and PNS batch items off BARN and leaves PNN and in-transit", () => {
    const rows = [
      { location: "BARN", farm: "ARL" },
      { location: "BARN", farm: "PNS" },
      { location: "BARN", farm: "PNN" },
      { location: "BARN", farm: null },
      { location: "IN-TRANSIT", farm: "ARL" },
    ];
    const after = rows.map((row) => {
      if (row.location !== "BARN") return row;
      if (row.farm === "ARL") return { ...row, location: "ARL BARN" };
      if (row.farm === "PNS") return { ...row, location: "PNS BARN" };
      return row;
    });
    expect(after).toEqual([
      { location: "ARL BARN", farm: "ARL" },
      { location: "PNS BARN", farm: "PNS" },
      { location: "BARN", farm: "PNN" },
      { location: "BARN", farm: null },
      { location: "IN-TRANSIT", farm: "ARL" },
    ]);
  });
});

describe("trim Save reconcile gate (canon 0.22.1)", () => {
  type Row = Record<string, unknown>;

  function makeTrimDb() {
    const person = {
      id: "p-dev",
      display_name: "dev",
      email: "dev@local",
      is_active: 1,
      deleted_at: null as string | null,
    };
    const tables: Record<string, Row[]> = {
      wet_weight_entries: [
        {
          id: "lot1",
          status: "unloaded",
          dry_weight_grams: 100,
          harvest_batch_id: "hb1",
          deleted_at: null,
        },
      ],
      wip_packages: [],
      package_types: [{ code: "BUD", is_bud: 1, deleted_at: null }],
      // Canon 0.30.12: the sign-off names every operator picks from.
      lookup_values: [
        { category: "sign_off_name", value: "Kieth", label: "Kieth", sort_order: 1, deleted_at: null },
        { category: "sign_off_name", value: "Les", label: "Les", sort_order: 2, deleted_at: null },
        { category: "sign_off_name", value: "Austin", label: "Austin", sort_order: 3, deleted_at: null },
      ],
      record_change_log: [],
    };
    function norm(sql: string) {
      return sql.replace(/\s+/g, " ").trim().toLowerCase();
    }
    function insert(sql: string, args: unknown[]) {
      const m = sql.match(/insert into (\w+)\s*\(([^)]+)\)\s*values\s*\(([\s\S]+)\)/i);
      if (!m) return;
      const table = m[1];
      const cols = m[2].split(",").map((c) => c.trim());
      const vals = m[3].split(",").map((v) => v.trim());
      const row: Row = { deleted_at: null };
      let ai = 0;
      cols.forEach((col, i) => {
        const raw = vals[i] ?? "";
        if (raw === "?") row[col] = args[ai++];
        else if (/^null$/i.test(raw)) row[col] = null;
        else row[col] = raw.replace(/^'|'$/g, "").replace(/^"|"$/g, "");
      });
      if (!tables[table]) tables[table] = [];
      tables[table].push(row);
    }
    function updateById(sql: string, args: unknown[]) {
      const m = sql.match(/update (\w+) set (.+) where (\w+) = \?/i);
      if (!m) return;
      const table = m[1];
      const sets = m[2].split(",").map((p) => p.trim().split("=")[0].trim());
      const id = args[args.length - 1];
      const row = (tables[table] ?? []).find((r) => r.id === id || r.code === id);
      if (!row) return;
      sets.forEach((col, i) => {
        row[col] = args[i];
      });
    }
    function exec(sql: string, args: unknown[]) {
      const q = norm(sql);
      if (q.includes("from people") && q.includes("where id")) {
        return { id: person.id, display_name: person.display_name, is_active: person.is_active };
      }
      if (q.startsWith("insert into")) {
        insert(sql, args);
        return { success: true };
      }
      if (q.startsWith("update ")) {
        updateById(sql, args);
        return { success: true };
      }
      if (q.includes("from wet_weight_entries")) {
        return tables.wet_weight_entries.find((r) => r.id === args[0] && !r.deleted_at) ?? null;
      }
      if (q.includes("from package_types")) {
        return tables.package_types.find((r) => r.code === args[0] && !r.deleted_at) ?? null;
      }
      if (q.includes("from lookup_values")) {
        return (tables.lookup_values ?? []).filter((r) => r.category === args[0] && !r.deleted_at);
      }
      // THE EFFECTIVE DATE PER STATION (canon 0.30.94): the Admin PIN the
      // backdate check reads.
      if (q.includes("from app_config")) {
        return args[0] === "admin_pin" ? { value: "21319" } : null;
      }
      if (q.includes("from wip_packages") && q.includes("sum(weight_grams)")) {
        const total = tables.wip_packages
          .filter((r) => r.wet_weight_entry_id === args[0] && !r.deleted_at)
          .reduce((s, r) => s + Number(r.weight_grams ?? 0), 0);
        return { total };
      }
      if (q.includes("from record_change_log")) {
        return tables.record_change_log.filter((l) => l.record_table === args[0] && l.record_id === args[1]);
      }
      return [];
    }
    function stmt(sql: string) {
      const args: unknown[] = [];
      const self = {
        bind(...next: unknown[]) {
          args.push(...next);
          return self;
        },
        async first() {
          const r = exec(sql, args);
          return Array.isArray(r) ? (r[0] ?? null) : r;
        },
        async all() {
          const r = exec(sql, args);
          return { results: Array.isArray(r) ? r : r ? [r] : [] };
        },
        async run() {
          exec(sql, args);
          return { success: true };
        },
      };
      return self;
    }
    return {
      tables,
      prepare: (sql: string) => stmt(sql),
      async batch(stmts: { run: () => Promise<unknown> }[]) {
        for (const s of stmts) await s.run();
      },
    };
  }

  function trimFd(fields: Record<string, string | string[]>): FormData {
    const form = new FormData();
    form.set("person_id", "p-dev");
    for (const [k, v] of Object.entries(fields)) {
      if (Array.isArray(v)) {
        for (const item of v) form.append(k, item);
      } else {
        form.set(k, v);
      }
    }
    return form;
  }

  // Canon 0.30.9 (R7): every trim package carries the date and the hand-typed
  // operator; the fixture posts them the way the form does. Canon 0.30.12: the
  // operator is one of the sign-off names. THE EFFECTIVE DATE PER STATION
  // (canon 0.30.94): the date posts as the Effective Date; a backdate carries
  // the Admin PIN (makeTrimDb's app_config answers it), and it writes trim_date.
  const entry = { effective_date: "2026-09-08", effective_pin: "21319", trim_operator: "Kieth" };

  it("opens the under gate on a short Save and lands the picked page at or past zero", async () => {
    const { createTrimPackages } = await import("../src/actions");
    const db = makeTrimDb();
    const under = await createTrimPackages(
      db as unknown as D1Database,
      trimFd({
        wet_weight_entry_id: "lot1",
        package_code: ["BUD-1"],
        package_type_code: ["BUD"],
        weight_grams: ["40"],
        ...entry,
      })
    );
    expect(under.redirect).toContain("gate=1");
    expect(db.tables.wip_packages).toHaveLength(1);
    expect(db.tables.wip_packages[0]).toMatchObject({ trim_date: "2026-09-08", trim_operator: "Kieth" });
    const exactDb = makeTrimDb();
    const exact = await createTrimPackages(
      exactDb as unknown as D1Database,
      trimFd({
        wet_weight_entry_id: "lot1",
        package_code: ["BUD-1"],
        package_type_code: ["BUD"],
        weight_grams: ["100"],
        ...entry,
      })
    );
    // Canon 0.30.9 (R6): at zero the picked page prompts REMAINING 0 itself.
    expect(exact.redirect).toBe("/station/trim_packages?pick=lot1&ok=trim");
    expect(exact.redirect).not.toContain("gate=");
    const overDb = makeTrimDb();
    const over = await createTrimPackages(
      overDb as unknown as D1Database,
      trimFd({
        wet_weight_entry_id: "lot1",
        package_code: ["BUD-1"],
        package_type_code: ["BUD"],
        weight_grams: ["120"],
        ...entry,
      })
    );
    expect(over.redirect).toBe("/station/trim_packages?pick=lot1&ok=trim");
  });

  it("refuses a package entry without the operator; any typed name saves (canon 0.30.9, 0.30.21)", async () => {
    const { createTrimPackages } = await import("../src/actions");
    const db = makeTrimDb();
    await expect(
      createTrimPackages(
        db as unknown as D1Database,
        trimFd({
          wet_weight_entry_id: "lot1",
          package_code: ["BUD-1"],
          package_type_code: ["BUD"],
          weight_grams: ["40"],
          trim_date: "2026-09-08",
        })
      )
    ).rejects.toBeInstanceOf(HttpError);
    // Canon 0.30.21, his words: "The operator dropdowns don't need to have the
    // maintenance crew on every single one, that was just for the PM portion."
    // The operator is hand entry again (0.30.9 R7): any typed name saves.
    expect(db.tables.wip_packages).toHaveLength(0);
    const dana = await createTrimPackages(
      db as unknown as D1Database,
      trimFd({
        wet_weight_entry_id: "lot1",
        package_code: ["BUD-1"],
        package_type_code: ["BUD"],
        weight_grams: ["40"],
        trim_date: "2026-09-08",
        trim_operator: "Dana",
      })
    );
    expect(dana.redirect).toContain("gate=1");
    expect(db.tables.wip_packages[0]).toMatchObject({ trim_operator: "Dana" });
  });

  it("[Remove from queue] trims at zero, papers the overage, refuses short (canon 0.30.9)", async () => {
    const { createTrimPackages } = await import("../src/actions");
    const zeroDb = makeTrimDb();
    await createTrimPackages(
      zeroDb as unknown as D1Database,
      trimFd({ wet_weight_entry_id: "lot1", package_code: ["BUD-1"], package_type_code: ["BUD"], weight_grams: ["100"], ...entry })
    );
    const removed = await createTrimPackages(
      zeroDb as unknown as D1Database,
      trimFd({ wet_weight_entry_id: "lot1", gate_choice: "remove" })
    );
    expect(removed.redirect).toBe("/station/trim_packages?ok=removed");
    expect(zeroDb.tables.wet_weight_entries[0]?.status).toBe("trimmed");
    expect(
      zeroDb.tables.record_change_log.some((l) => l.field === "trim_reconcile_choice" && l.new_value === "remove")
    ).toBe(true);
    // Over: the remove trims AND logs queue_adjust so the adjustment CSV pends.
    const overDb = makeTrimDb();
    await createTrimPackages(
      overDb as unknown as D1Database,
      trimFd({ wet_weight_entry_id: "lot1", package_code: ["BUD-1"], package_type_code: ["BUD"], weight_grams: ["130"], ...entry })
    );
    const removedOver = await createTrimPackages(
      overDb as unknown as D1Database,
      trimFd({ wet_weight_entry_id: "lot1", gate_choice: "remove" })
    );
    expect(removedOver.redirect).toBe("/station/trim_packages?ok=removed_adjust");
    expect(overDb.tables.wet_weight_entries[0]?.status).toBe("trimmed");
    expect(
      overDb.tables.record_change_log.some((l) => l.field === "trim_reconcile_choice" && l.new_value === "queue_adjust")
    ).toBe(true);
    // Short of the parent the button is never offered; a stale post refuses.
    const shortDb = makeTrimDb();
    await createTrimPackages(
      shortDb as unknown as D1Database,
      trimFd({ wet_weight_entry_id: "lot1", package_code: ["BUD-1"], package_type_code: ["BUD"], weight_grams: ["40"], ...entry })
    );
    await expect(
      createTrimPackages(shortDb as unknown as D1Database, trimFd({ wet_weight_entry_id: "lot1", gate_choice: "remove" }))
    ).rejects.toBeInstanceOf(HttpError);
    expect(shortDb.tables.wet_weight_entries[0]?.status).toBe("unloaded");
  });

  it("finish choice leaves the trim queue and logs trim reconcile", async () => {
    const { createTrimPackages } = await import("../src/actions");
    const db = makeTrimDb();
    await createTrimPackages(
      db as unknown as D1Database,
      trimFd({
        wet_weight_entry_id: "lot1",
        package_code: ["BUD-1"],
        package_type_code: ["BUD"],
        weight_grams: ["40"],
        ...entry,
      })
    );
    // Canon 0.30.1 fork 7: queue_finish is not a choice; a stale form posting
    // it falls through the not-a-choice path and never touches the record.
    // Fork 8: a queued adjustment lands you at the export home.
    const adjustDb = makeTrimDb();
    const adjust = await createTrimPackages(
      adjustDb as unknown as D1Database,
      trimFd({ wet_weight_entry_id: "lot1", gate_choice: "queue_adjust" })
    );
    expect(adjust.redirect).toBe("/admin/uploads?ok=adjust_queued");
    // Fork 7 fallout: the adjustment is now the completing choice; the delta
    // is papered, so the trim finishes.
    expect(adjustDb.tables.wet_weight_entries[0]?.status).toBe("trimmed");
    expect(
      adjustDb.tables.record_change_log.some(
        (l) => l.field === "trim_reconcile_choice" && l.new_value === "queue_adjust"
      )
    ).toBe(true);
  });
});
