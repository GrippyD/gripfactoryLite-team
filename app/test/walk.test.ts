import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import {
  addDrySpaceToMovement,
  finishOutboundShipment,
  finishReceipt,
  finishSiteSend,
  receiveMovementItems,
  unreceiveItem,
} from "../src/actions";
import { LICENSE_AU_GROW, LICENSE_AU_PROCESSOR, LICENSE_PNS_AU } from "../src/config";
import {
  intercoMenuPage,
  intercoOutboundPage,
  intercoReceivingPage,
  intercoSendPage,
  movementsQueueSection,
  renderField,
  stationPage,
  unloadLotPanel,
  virtualMovePage,
} from "../src/html";
import {
  movementVoidBlock,
  RECEIVE_CSV_HEADER,
  displayManifestNumber,
  farmCodeFromLicenseLabel,
  licenseOptionLabel,
  licenseToneClass,
  receiveCsv,
  receivingLine,
} from "../src/interco";
import { lookupSectionPage } from "../src/pages";
import { stationByKey } from "../src/pipeline";
import { themeStylesheet } from "../src/theme";
import { app } from "../src/index";
import type { LookupOption } from "../src/db";

const SEVEN: LookupOption[] = [
  { value: "AU-G-C-000832", label: "PNN AU", tone: "blue" },
  { value: "GR-C-001132", label: "PNN Med", tone: "yellow" },
  { value: "AU-P-000694", label: "PNN Processor", tone: "green" },
  { value: "AU-G-C-001397", label: "PNS AU", tone: "blue" },
  { value: "GR-C-001405", label: "PNS Med", tone: "yellow" },
  { value: "AU-G-C-001509", label: "ARL AU", tone: "blue" },
  { value: "GR-C-002600", label: "ARL Med", tone: "yellow" },
];

const FARMS: LookupOption[] = [
  { value: "PNN", label: "Penn North" },
  { value: "PNS", label: "Penn South" },
  { value: "ARL", label: "Arlington" },
];

function emptyTables() {
  return {
    people: [],
    farms: [],
    grow_methods: [],
    strains: [],
    dry_spaces: [],
    package_types: [],
    app_config: [],
  };
}

function pinEnv(db: ReturnType<typeof makePinDb>): Env {
  return {
    DB: db as unknown as D1Database,
    THEME: "grip",
    ASSETS: { fetch: () => Promise.resolve(new Response("ok", { status: 200 })) } as unknown as Env["ASSETS"],
  };
}

function makePinDb() {
  const person = {
    id: "p-dev",
    display_name: "dev",
    email: "dev@local",
    is_active: 1,
    deleted_at: null as string | null,
  };
  const people = [person];
  const config: Record<string, string> = { admin_pin: "21319" };
  function norm(sql: string) {
    return sql.replace(/\s+/g, " ").trim().toLowerCase();
  }
  function exec(sql: string, args: unknown[]) {
    const q = norm(sql);
    if (q.includes("from people") && q.includes("lower(email)")) {
      const email = String(args[0] ?? "");
      return people.find((p) => p.email === email && !p.deleted_at) ?? null;
    }
    if (q.includes("from people") && q.includes("where id")) {
      const id = String(args[0] ?? "");
      const hit = people.find((p) => p.id === id && !p.deleted_at);
      return hit ? { id: hit.id, display_name: hit.display_name, is_active: hit.is_active } : null;
    }
    if (q.includes("from people") && q.includes("is_active = 1")) {
      return people
        .filter((p) => p.is_active === 1 && !p.deleted_at)
        .map((p) => ({ id: p.id, display_name: p.display_name, is_active: p.is_active }));
    }
    if (q.includes("from app_config") && q.includes("where key")) {
      const value = config[String(args[0])];
      return value != null ? { value } : null;
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
    prepare: (sql: string) => stmt(sql),
    async batch(stmts: { run: () => Promise<unknown> }[]) {
      for (const s of stmts) await s.run();
    },
  };
}

type InvRow = {
  id: string;
  package_code: string;
  item_kind: string;
  strain_name: string | null;
  qty: number;
  uom: string;
  location: string;
  farm_code: string;
  license_value: string;
  harvest_batch_id: string | null;
  deleted_at: string | null;
};

type MoveRow = {
  id: string;
  movement_kind: string;
  origin_farm: string | null;
  destination_farm: string | null;
  origin_license: string;
  destination_license: string;
  truck_number: string | null;
  driver: string | null;
  planned_route: string | null;
  transfer_type: string | null;
  invoice_number: string | null;
  payment_term_days: string | null;
  planned_departure: string | null;
  planned_arrival: string | null;
  gross_weight: string | null;
  gross_weight_uom: string | null;
  transporter_license: string | null;
  transporter_phone: string | null;
  driver_occupational_license: string | null;
  driver_license_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  metrc_manifest_number: string | null;
  status: string;
  exported_at: string | null;
  completed_at: string | null;
  created_at: string;
  deleted_at: string | null;
};

type MoveItemRow = {
  id: string;
  movement_id: string;
  local_inventory_item_id: string;
  qty: number;
  uom: string;
  received_qty: number | null;
  received_at: string | null;
  received_by: string | null;
  receipt_id: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  reject_reason: string | null;
  deleted_at: string | null;
};

function makeIntercoDb() {
  const people = [
    { id: "p1", display_name: "TL", email: "tl@local", is_active: 1, deleted_at: null as string | null },
  ];
  const inventory: InvRow[] = [
    {
      id: "inv-ship",
      package_code: "SHIP1",
      item_kind: "WIP",
      strain_name: "Gelato",
      qty: 80,
      uom: "g",
      location: "Silo 2",
      farm_code: "ARL",
      license_value: LICENSE_AU_GROW,
      harvest_batch_id: "hb1",
      deleted_at: null,
    },
    {
      id: "inv-taken",
      package_code: "TAKEN1",
      item_kind: "WIP",
      strain_name: "Gelato",
      qty: 10,
      uom: "g",
      location: "Silo 2",
      farm_code: "ARL",
      license_value: LICENSE_AU_GROW,
      harvest_batch_id: "hb1",
      deleted_at: null,
    },
    {
      id: "inv-pns",
      package_code: "PNS1",
      item_kind: "WIP",
      strain_name: "Gelato",
      qty: 40,
      uom: "g",
      location: "PNS BARN",
      farm_code: "PNS",
      license_value: LICENSE_PNS_AU,
      harvest_batch_id: "hb-pns",
      deleted_at: null,
    },
  ];
  const movements: MoveRow[] = [];
  const items: MoveItemRow[] = [
    {
      id: "mi-taken",
      movement_id: "move-other",
      local_inventory_item_id: "inv-taken",
      qty: 10,
      uom: "g",
      received_qty: null,
      received_at: null,
      received_by: null,
      receipt_id: null,
      rejected_at: null,
      rejected_by: null,
      reject_reason: null,
      deleted_at: null,
    },
  ];
  movements.push({
    id: "move-other",
    movement_kind: "interco",
    origin_farm: "ARL",
    destination_farm: "PNN",
    origin_license: LICENSE_AU_GROW,
    destination_license: LICENSE_AU_PROCESSOR,
    truck_number: null,
    driver: null,
    planned_route: null,
    transfer_type: null,
    invoice_number: null,
    payment_term_days: null,
    planned_departure: null,
    planned_arrival: null,
    gross_weight: null,
    gross_weight_uom: null,
    transporter_license: null,
    transporter_phone: null,
    driver_occupational_license: null,
    driver_license_number: null,
    vehicle_make: null,
    vehicle_model: null,
    vehicle_plate: null,
    metrc_manifest_number: null,
    status: "building",
    exported_at: null,
    completed_at: null,
    created_at: "2026-09-04T00:00:00.000Z",
    deleted_at: null,
  });
  const receipts: { id: string; movement_id: string; created_at: string; deleted_at: string | null }[] = [];
  const logs: Record<string, unknown>[] = [];
  const uploads: { kind: string; ref_id: string | null; deleted_at: string | null }[] = [];

  function norm(sql: string) {
    return sql.replace(/\s+/g, " ").trim().toLowerCase();
  }

  function movementPublic(m: MoveRow) {
    return { ...m };
  }

  function itemJoined(mi: MoveItemRow) {
    const inv = inventory.find((i) => i.id === mi.local_inventory_item_id);
    return {
      ...mi,
      package_code: inv?.package_code ?? "",
      item_kind: inv?.item_kind ?? "",
      strain_name: inv?.strain_name ?? null,
      location: inv?.location ?? "",
      farm_code: inv?.farm_code ?? "",
      harvest_batch_id: inv?.harvest_batch_id ?? null,
    };
  }

  function exec(sql: string, args: unknown[]) {
    const q = norm(sql);
    if (q.includes("from people") && q.includes("where id")) {
      const hit = people.find((p) => p.id === args[0] && !p.deleted_at);
      return hit ? { id: hit.id, display_name: hit.display_name, is_active: hit.is_active } : null;
    }
    if (q.startsWith("insert into interco_movements")) {
      const row: MoveRow = {
        id: String(args[0]),
        movement_kind: String(args[1]),
        origin_farm: (args[2] as string) ?? null,
        destination_farm: (args[3] as string) ?? null,
        origin_license: String(args[4]),
        destination_license: String(args[5]),
        truck_number: (args[6] as string) ?? null,
        driver: (args[7] as string) ?? null,
        planned_route: (args[8] as string) ?? null,
        transfer_type: (args[9] as string) ?? null,
        invoice_number: (args[10] as string) ?? null,
        payment_term_days: (args[11] as string) ?? null,
        planned_departure: (args[12] as string) ?? null,
        planned_arrival: (args[13] as string) ?? null,
        gross_weight: (args[14] as string) ?? null,
        gross_weight_uom: (args[15] as string) ?? null,
        transporter_license: (args[16] as string) ?? null,
        transporter_phone: (args[17] as string) ?? null,
        driver_occupational_license: (args[18] as string) ?? null,
        driver_license_number: (args[19] as string) ?? null,
        vehicle_make: (args[20] as string) ?? null,
        vehicle_model: (args[21] as string) ?? null,
        vehicle_plate: (args[22] as string) ?? null,
        metrc_manifest_number: (args[23] as string) ?? null,
        status: String(args[24]),
        exported_at: null,
        completed_at: null,
        created_at: String(args[25]),
        deleted_at: null,
      };
      movements.push(row);
      return { success: true };
    }
    if (q.startsWith("insert into interco_movement_items")) {
      items.push({
        id: String(args[0]),
        movement_id: String(args[1]),
        local_inventory_item_id: String(args[2]),
        qty: Number(args[3]),
        uom: String(args[4]),
        received_qty: null,
        received_at: null,
        received_by: null,
        receipt_id: null,
        rejected_at: null,
        rejected_by: null,
        reject_reason: null,
        deleted_at: null,
      });
      return { success: true };
    }
    if (q.startsWith("insert into interco_receipts")) {
      receipts.push({
        id: String(args[0]),
        movement_id: String(args[1]),
        created_at: String(args[2]),
        deleted_at: null,
      });
      return { success: true };
    }
    if (q.startsWith("insert into record_change_log")) {
      logs.push({
        field: args[3],
        old_value: args[4],
        new_value: args[5],
        reason: args[7],
        record_id: args[2],
      });
      return { success: true };
    }
    if (q.startsWith("insert into metrc_uploads")) {
      uploads.push({ kind: String(args[1]), ref_id: (args[5] as string) ?? null, deleted_at: null });
      return { success: true };
    }
    if (q.includes("from interco_movements") && q.includes("where id")) {
      const hit = movements.find((m) => m.id === args[0] && !m.deleted_at);
      return hit ? movementPublic(hit) : null;
    }
    if (q.includes("from interco_movement_items mi") && q.includes("where mi.id")) {
      const hit = items.find((i) => i.id === args[0] && !i.deleted_at);
      if (!hit) return null;
      const inv = inventory.find((i) => i.id === hit.local_inventory_item_id);
      return {
        id: hit.id,
        movement_id: hit.movement_id,
        local_inventory_item_id: hit.local_inventory_item_id,
        qty: hit.qty,
        location: inv?.location ?? "",
      };
    }
    if (q.includes("from interco_movement_items mi") && q.includes("join local_inventory_items")) {
      const mid = String(args[0]);
      return items.filter((i) => i.movement_id === mid && !i.deleted_at).map(itemJoined);
    }
    if (q.includes("from local_inventory_items i") && q.includes("item_kind in") && q.includes("i.location =")) {
      const space = String(args[0]);
      return inventory
        .filter((i) => !i.deleted_at && (i.item_kind === "SPR" || i.item_kind === "WIP") && i.location === space)
        .filter((i) => {
          const onBuilding = items.some((mi) => {
            if (mi.local_inventory_item_id !== i.id || mi.deleted_at) return false;
            const m = movements.find((mv) => mv.id === mi.movement_id && !mv.deleted_at);
            return m?.status === "building";
          });
          return !onBuilding;
        })
        .map((i) => ({ id: i.id, qty: i.qty, uom: i.uom, location: i.location }));
    }
    if (q.includes("from local_inventory_items") && q.includes("where id")) {
      const hit = inventory.find((i) => i.id === args[0] && !i.deleted_at);
      return hit
        ? {
            id: hit.id,
            qty: hit.qty,
            uom: hit.uom,
            location: hit.location,
            farm_code: hit.farm_code,
            deleted_at: hit.deleted_at,
          }
        : null;
    }
    if (q.includes("from interco_movement_items mi") && q.includes("join local_inventory_items i on i.id = mi.local_inventory_item_id") && q.includes("where mi.id")) {
      const hit = items.find((i) => i.id === args[0] && !i.deleted_at);
      if (!hit) return null;
      const inv = inventory.find((i) => i.id === hit.local_inventory_item_id);
      return {
        id: hit.id,
        movement_id: hit.movement_id,
        local_inventory_item_id: hit.local_inventory_item_id,
        qty: hit.qty,
        location: inv?.location ?? "",
      };
    }
    if (q.startsWith("update interco_movements")) {
      const id = String(args[args.length - 1]);
      const row = movements.find((m) => m.id === id);
      if (!row) return { success: true };
      if (q.includes("exported_at")) {
        row.exported_at = String(args[0]);
        return { success: true };
      }
      if (q.includes("status = ?") && q.includes("completed_at")) {
        row.status = String(args[0]);
        row.completed_at = String(args[1]);
        return { success: true };
      }
      if (q.includes("metrc_manifest_number")) {
        row.origin_farm = (args[0] as string) ?? null;
        row.destination_farm = (args[1] as string) ?? null;
        row.origin_license = String(args[2]);
        row.destination_license = String(args[3]);
        row.truck_number = (args[4] as string) ?? null;
        row.driver = (args[5] as string) ?? null;
        row.planned_route = (args[6] as string) ?? null;
        row.transfer_type = (args[7] as string) ?? null;
        row.invoice_number = (args[8] as string) ?? null;
        row.payment_term_days = (args[9] as string) ?? null;
        row.planned_departure = (args[10] as string) ?? null;
        row.planned_arrival = (args[11] as string) ?? null;
        row.gross_weight = (args[12] as string) ?? null;
        row.gross_weight_uom = (args[13] as string) ?? null;
        row.transporter_license = (args[14] as string) ?? null;
        row.transporter_phone = (args[15] as string) ?? null;
        row.driver_occupational_license = (args[16] as string) ?? null;
        row.driver_license_number = (args[17] as string) ?? null;
        row.vehicle_make = (args[18] as string) ?? null;
        row.vehicle_model = (args[19] as string) ?? null;
        row.vehicle_plate = (args[20] as string) ?? null;
        row.metrc_manifest_number = (args[21] as string) ?? null;
        return { success: true };
      }
      return { success: true };
    }
    if (q.startsWith("update interco_movement_items")) {
      const id = String(args[args.length - 1]);
      const row = items.find((i) => i.id === id);
      if (!row) return { success: true };
      if (q.includes("received_qty = null")) {
        row.received_at = null;
        row.received_by = null;
        row.receipt_id = null;
        row.received_qty = null;
        return { success: true };
      }
      if (q.includes("received_qty")) {
        row.received_at = String(args[0]);
        row.received_by = String(args[1]);
        row.received_qty = Number(args[2]);
        return { success: true };
      }
      if (q.includes("receipt_id")) {
        row.receipt_id = String(args[0]);
        return { success: true };
      }
      return { success: true };
    }
    if (q.startsWith("update local_inventory_items")) {
      const id = String(args[args.length - 1]);
      const row = inventory.find((i) => i.id === id);
      if (!row) return { success: true };
      let i = 0;
      if (q.includes("qty = ?")) row.qty = Number(args[i++]);
      if (q.includes("location = ?")) row.location = String(args[i++]);
      if (q.includes("farm_code = ?")) row.farm_code = String(args[i++]);
      if (q.includes("license_value = ?")) row.license_value = String(args[i++]);
      return { success: true };
    }
    throw new Error(`unhandled sql: ${sql}`);
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
    inventory,
    movements,
    items,
    receipts,
    logs,
    uploads,
    prepare: (sql: string) => stmt(sql),
    async batch(stmts: { run: () => Promise<unknown> }[]) {
      for (const s of stmts) await s.run();
    },
  };
}

function actorForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  form.set("person_id", "p1");
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

const UNLOAD_STATION = stationByKey("unload_dry_space")!;
const HANG_LOT = {
  id: "lot-hang",
  hbn: "26246-ARL-GH-027-0-NA-26011",
  metrc_harvest_tag: null,
  strain_name: "Fruity Pebbles",
  dry_space_name: "Arlington Dry Room",
  dry_space_kind: "hang",
  weight_grams: 200,
};

describe("walk slice markup", () => {
  it("Acquire start time carries the time24 mask hook", () => {
    const acquire = stationByKey("acquire_hbn")!;
    const html = stationPage(acquire, [], "", { farms: [], grow_methods: [], strains: [], silo_number: [] }, {}, {}, undefined, undefined, undefined, "en");
    expect(html).toContain('name="start_time"');
    expect(html).toContain("data-time24-mask");
    expect(html).toContain('id="start_time"');
    expect(html).toContain("data-time24-mask");
    expect(html).toMatch(/replace\(/);
  });

  it("Acquire HBN carries the Spear/Bucked toggle, bucked checked; the wet header carries none (canon 0.29.1, 0.30.341)", () => {
    const wet = stationByKey("wet_weight")!;
    expect(wet.fields.find((f) => f.name === "material_form")).toBeUndefined();
    const acquire = stationByKey("acquire_hbn")!;
    const field = acquire.fields.find((f) => f.name === "material_form");
    expect(field).toBeDefined();
    expect(field!.input).toBe("radio");
    const html = renderField(field!, {}, {}, {}, "en");
    expect(html).toContain('name="material_form" value="bucked" checked');
    expect(html).toContain('name="material_form" value="spear"');
    expect(html).not.toContain('value="spear" checked');
    expect(html).toContain("Spear or Bucked");
  });

  it("the unload carries no weigh radios; the Material line derives from the lot (owner ruling 2026-09-07, canon 0.29.1)", () => {
    const html = unloadLotPanel(UNLOAD_STATION, HANG_LOT, [], 0, "en", null, "TL", 0, { askOnSite: true });
    expect(html).not.toContain('name="weigh_mode"');
    expect(html).not.toContain('id="weigh_mode_spear"');
    expect(html).toContain("data-material-form");
    expect(html).toContain("Material: Spear");
    const bucked = unloadLotPanel(
      UNLOAD_STATION,
      { ...HANG_LOT, material_form: "bucked" },
      [],
      0,
      "en",
      null,
      "TL",
      0,
      { askOnSite: true }
    );
    expect(bucked).toContain("Material: Bucked");
    // The 0.24.1 radio-lock law retired with the radios: nothing disables and
    // no mode-carry script rides the page.
    const weights = [{ id: "w1", weight_grams: 250000, created_at: "2026-09-05T20:07:07.746Z" }];
    const withWeights = unloadLotPanel(
      UNLOAD_STATION,
      HANG_LOT,
      weights,
      250000,
      "en",
      { id: "s1", wet_weight_entry_id: "lot-hang", operator_name: "Op", weigh_mode: "spear", bucked_on_site: null, truck_number: null, finished_at: null },
      "TL",
      1,
      { askOnSite: true }
    );
    expect(withWeights).not.toContain(" disabled");
    expect(withWeights).not.toContain('form[action$="/weights"], form[action$="/finish"]');
    expect(withWeights).not.toContain('name="weigh_mode"');
  });

  it("bucked-on-site asks only for spear material away from North (owner ruling 2026-09-07, canon 0.29.1)", () => {
    const spearAway = unloadLotPanel(UNLOAD_STATION, HANG_LOT, [], 0, "en", null, "TL", 0, { askOnSite: true });
    expect(spearAway).toContain("data-bucked-on-site");
    expect(spearAway).not.toMatch(/data-bucked-on-site hidden/);
    expect(spearAway).toContain("Will these be bucked on site?");
    const spearAtNorth = unloadLotPanel(UNLOAD_STATION, HANG_LOT, [], 0, "en", null, "TL", 0, { askOnSite: false });
    expect(spearAtNorth).not.toContain("data-bucked-on-site");
    expect(spearAtNorth).not.toContain("Will these be bucked on site?");
    const bucked = unloadLotPanel(
      UNLOAD_STATION,
      { ...HANG_LOT, material_form: "bucked" },
      [],
      0,
      "en",
      null,
      "TL",
      0,
      { askOnSite: true }
    );
    expect(bucked).not.toContain("data-bucked-on-site");
    expect(bucked).not.toContain("Will these be bucked on site?");
  });

  it("license options render value - label with tones, Virtual Move pins values", () => {
    expect(LICENSE_AU_GROW).toBe("AU-G-C-000832");
    expect(LICENSE_AU_PROCESSOR).toBe("AU-P-000694");
    const out = intercoOutboundPage("en", {
      items: [],
      licenses: SEVEN,
      farms: FARMS,
      building: [],
      finished: [],
    });
    for (const row of SEVEN) {
      expect(out).toContain(`${row.value} - ${row.label}`);
      expect(out).toContain(`data-tone="${row.tone}"`);
    }
    expect(out).toContain("tone-chip");
    expect(out).toContain("data-license-picker");
    const vm = virtualMovePage(
      [],
      [],
      [],
      "en",
      SEVEN,
      [
        { value: "BARN", label: "Barn" },
        { value: "CSB", label: "CSB" },
        { value: "IN-TRANSIT", label: "In transit" },
      ]
    );
    expect(vm).toContain("AU-G-C-000832 - PNN AU");
    expect(vm).toContain("AU-P-000694 - PNN Processor");
    expect(vm).toContain("tone-blue");
    expect(vm).toContain("tone-green");
    expect(vm).not.toContain("AU-Grow");
    expect(vm).toContain('name="dest_location"');
    expect(vm).toContain('value="CSB" selected');
    expect(vm).not.toContain('value="BARN"');
    expect(vm).toContain("Building 23");
    expect(vm).toContain("They always land in the barn.");
    const lookup = lookupSectionPage(
      "licenses",
      emptyTables(),
      SEVEN.map((o, i) => ({
        id: `lic-${i}`,
        value: o.value,
        label: o.label,
        tone: o.tone,
        sort_order: i + 1,
      })),
      "en"
    );
    expect(lookup).toContain("tone");
    expect(lookup).toContain("PNN AU");
    expect(lookup).toContain("name=\"tone\"");
    expect(lookup).toContain("farm_code");
    expect(lookup).toContain('name="farm_code"');
  });

  it("Interco menu and outbound/receiving panes carry the walk hooks", () => {
    const menu = intercoMenuPage("en");
    expect(menu).toContain('href="/interco/arrivals/pnn"');
    expect(menu).toContain("Arlington");
    expect(menu).toContain("Penn North");
    expect(menu).toContain("Working pane");
    expect(menu).toContain("On the road");
    expect(menu).not.toContain('href="/interco/ship-external"');
    expect(menu).not.toContain('href="/interco/send/pns"');
    expect(menu).not.toContain("Finish Outbound Shipment");
    const send = intercoSendPage("en", "pns", [], [], null, 1);
    expect(send).not.toContain("Dry spaces");
    expect(send).not.toContain("data-license-picker");
    expect(send).not.toContain('name="origin_license"');
    expect(send).toContain("No license picker. The lane knows.");
    expect(send).toContain("pns-pnn");
    expect(send).toContain("Lands the PNN barn and becomes 832 on arrival, regardless.");
    const out = intercoOutboundPage("en", {
      items: [
        {
          id: "inv-ship",
          item_kind: "WIP",
          package_code: "SHIP1",
          harvest_batch_id: "hb1",
          wet_weight_entry_id: null,
          strain_id: null,
          strain_name: "Gelato",
          qty: 80,
          uom: "g",
          farm_code: "ARL",
          farm_name: "Arlington",
          license_value: LICENSE_AU_PROCESSOR,
          location: "CSB",
          location_label: "CSB",
          created_at: "2026-09-04T00:00:00.000Z",
        },
        {
          id: "inv-taken",
          item_kind: "WIP",
          package_code: "TAKEN1",
          harvest_batch_id: "hb1",
          wet_weight_entry_id: null,
          strain_id: null,
          strain_name: "Gelato",
          qty: 10,
          uom: "g",
          farm_code: "ARL",
          farm_name: "Arlington",
          license_value: LICENSE_AU_PROCESSOR,
          location: "CSB",
          location_label: "CSB",
          created_at: "2026-09-04T00:00:00.000Z",
        },
      ],
      licenses: SEVEN,
      farms: FARMS,
      building: [
        {
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          movement_kind: "interco",
          origin_farm: "ARL",
          destination_farm: "PNN",
          origin_license: LICENSE_AU_GROW,
          destination_license: LICENSE_AU_PROCESSOR,
          truck_number: "77",
          driver: null,
          planned_route: null,
          transfer_type: null,
          invoice_number: null,
          payment_term_days: null,
          planned_departure: null,
          planned_arrival: null,
          gross_weight: null,
          gross_weight_uom: null,
          transporter_license: null,
          transporter_phone: null,
          driver_occupational_license: null,
          driver_license_number: null,
          vehicle_make: null,
          vehicle_model: null,
          vehicle_plate: null,
          metrc_manifest_number: null,
          status: "building",
          exported_at: null,
          completed_at: null,
          created_at: "2026-09-04T00:00:00.000Z",
        },
      ],
      finished: [],
    });
    expect(out).toContain("CSB");
    expect(out).toContain("/interco/ship-external/add");
    expect(out).not.toContain("Dry spaces");
    expect(out).toContain("SHIP1");
    expect(out).toContain("TAKEN1");
    expect(out).not.toContain("Finish Outbound Shipment");
    expect(out).toContain("Recall");
    expect(out).toContain('name="movement" value="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"');
    const recvArgs: Parameters<typeof intercoReceivingPage>[1] = {
      movements: [
        {
          id: "mov1",
          movement_kind: "interco",
          origin_farm: "ARL",
          destination_farm: "PNN",
          origin_license: LICENSE_AU_GROW,
          destination_license: LICENSE_AU_PROCESSOR,
          truck_number: "77",
          driver: null,
          planned_route: null,
          transfer_type: null,
          invoice_number: null,
          payment_term_days: null,
          planned_departure: null,
          planned_arrival: null,
          gross_weight: "30",
          gross_weight_uom: "Pounds",
          transporter_license: null,
          transporter_phone: null,
          driver_occupational_license: null,
          driver_license_number: null,
          vehicle_make: null,
          vehicle_model: null,
          vehicle_plate: null,
          metrc_manifest_number: "M-1",
          status: "completed",
          exported_at: "t",
          completed_at: "t",
          created_at: "t",
        },
      ],
      receipts: [],
      movementItems: {
        mov1: [
          {
            id: "mi1",
            movement_id: "mov1",
            local_inventory_item_id: "inv-ship",
            qty: 80,
            uom: "g",
            received_qty: null,
            received_at: null,
            received_by: null,
            receipt_id: null,
            rejected_at: null,
            rejected_by: null,
            reject_reason: null,
            package_code: "SHIP1",
            item_kind: "WIP",
            strain_name: "Gelato",
            location: "IN-TRANSIT",
            farm_code: "ARL",
            harvest_batch_id: "hb1",
          },
        ],
      },
      licenses: SEVEN,
      open: {
        movement: {
          id: "mov1",
          movement_kind: "interco",
          origin_farm: "ARL",
          destination_farm: "PNN",
          origin_license: LICENSE_AU_GROW,
          destination_license: LICENSE_AU_PROCESSOR,
          truck_number: "77",
          driver: null,
          planned_route: null,
          transfer_type: null,
          invoice_number: null,
          payment_term_days: null,
          planned_departure: null,
          planned_arrival: null,
          gross_weight: "30",
          gross_weight_uom: "Pounds",
          transporter_license: null,
          transporter_phone: null,
          driver_occupational_license: null,
          driver_license_number: null,
          vehicle_make: null,
          vehicle_model: null,
          vehicle_plate: null,
          metrc_manifest_number: "M-1",
          status: "completed",
          exported_at: "t",
          completed_at: "t",
          created_at: "t",
        },
        items: [
          {
            id: "mi1",
            movement_id: "mov1",
            local_inventory_item_id: "inv-ship",
            qty: 80,
            uom: "g",
            received_qty: null,
            received_at: null,
            received_by: null,
            receipt_id: null,
            rejected_at: null,
            rejected_by: null,
            reject_reason: null,
            package_code: "SHIP1",
            item_kind: "WIP",
            strain_name: "Gelato",
            location: "IN-TRANSIT",
            farm_code: "ARL",
            harvest_batch_id: "hb1",
          },
        ],
      },
    };
    const recv = intercoReceivingPage("en", recvArgs);
    expect(recv).toContain("ARL - M-1 - 77 - 30");
    expect(recv).toContain("receive-reveal");
    expect(recv).toContain('name="received_qty" value="80"');
    // Canon 0.30.25 ("if there's nothing selected, so should the buttons"):
    // each button renders only while it has work. Nothing received yet:
    // Receive all, no Finish Receipt.
    expect(recv).toContain("Receive all");
    expect(recv).not.toContain("Finish Receipt");
    const openItems = recvArgs.open!.items;
    const received = intercoReceivingPage("en", {
      ...recvArgs,
      open: { ...recvArgs.open!, items: openItems.map((i) => ({ ...i, received_at: "t", received_qty: 80 })) },
    });
    expect(received).toContain("Finish Receipt");
    expect(received).not.toContain("Receive all");
    const receipted = intercoReceivingPage("en", {
      ...recvArgs,
      open: { ...recvArgs.open!, items: openItems.map((i) => ({ ...i, received_at: "t", received_qty: 80, receipt_id: "r1" })) },
    });
    expect(receipted).not.toContain("Finish Receipt");
    expect(receipted).not.toContain("Receive all");
    const nothing = intercoReceivingPage("en", { ...recvArgs, open: undefined });
    expect(nothing).toContain("Pick a manifest.");
    expect(nothing).not.toContain("Finish Receipt");
    expect(nothing).not.toContain("Receive all");
  });

  it("all three sheets style icon variants, radios, and tones", () => {
    const lite = themeStylesheet("lite");
    const co = themeStylesheet("co");
    const cerb = themeStylesheet("cerberus");
    for (const sheet of [lite, co, cerb]) {
      expect(sheet).toContain(".ops-icon-on-dark");
      expect(sheet).toContain(".ops-icon-on-light");
      expect(sheet).toContain('input[type="radio"]');
      expect(sheet).toContain("appearance: auto");
      expect(sheet).toContain(".tone-blue");
      expect(sheet).toContain(".tone-yellow");
      expect(sheet).toContain(".tone-green");
      expect(sheet).toContain(".lic-au");
      expect(sheet).toContain(".lic-med");
      expect(sheet).toContain(".lic-dim");
    }
    expect(lite).toContain("border: 2px solid #1d4ed8");
    // Lite identity law (canon 0.20.1): Lite renders no icons at all.
    expect(lite).toContain(".ops-icon-on-dark, .ops-icon-on-light { display: none; }");
    expect(lite).toContain(".ops-icon-box { display: none; }");
    expect(cerb).toContain("color: #7eb6ff");
    expect(cerb).toContain(".ops-icon-on-dark { display: block; }");
    expect(co).toContain("prefers-color-scheme: dark");
    expect(co).toContain(".ops-icon-on-dark { display: block; }");
    expect(co).toContain(".ops-icon-on-light { display: none; }");
    expect(co).toContain("color: #7eb6ff");
  });
});

describe("walk slice helpers", () => {
  it("prefers the typed manifest number and formats the receiving line", () => {
    expect(displayManifestNumber("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", null)).toBe("aaaaaaaa");
    expect(displayManifestNumber("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "  M-9  ")).toBe("M-9");
    expect(receivingLine({ originFarm: "ARL", manifestNumber: "M-1", truckNumber: "77", weight: "1,200.00" })).toBe(
      "ARL - M-1 - 77 - 1,200.00"
    );
    expect(licenseOptionLabel("AU-G-C-000832", "PNN AU")).toBe("AU-G-C-000832 - PNN AU");
    expect(licenseToneClass("blue")).toBe("tone-blue");
    expect(farmCodeFromLicenseLabel("PNN AU")).toBe("PNN");
    expect(farmCodeFromLicenseLabel("PNS Med")).toBe("PNS");
    expect(farmCodeFromLicenseLabel("ARL AU")).toBe("ARL");
    const csv = receiveCsv([
      {
        manifestNumber: "M-1",
        packageTag: "SHIP1",
        receivedQuantity: "55.25",
        unitOfWeight: "g",
        receivedDate: "2026-09-04",
        receivingLicense: LICENSE_AU_PROCESSOR,
      },
    ]);
    expect(csv.startsWith(RECEIVE_CSV_HEADER)).toBe(true);
    expect(csv).toContain("55.25");
    expect(csv).toContain("SHIP1");
  });
});

describe("walk slice HTTP redirects", () => {
  it("THE LOAD AND THE LOT (canon 0.30.241): every old Interco url lands on Logistics Operations, and the manifest page is not served", async () => {
    const db = makePinDb();
    const headers = { cookie: "gf_pin=21319" };
    for (const path of [
      "/interco",
      "/interco/outbound",
      "/interco/receiving",
      "/interco/arrivals/pnn",
      "/interco/send/pns",
      "/interco/door",
      "/interco/receipt/abc",
      "/interco?tab=inbound",
    ]) {
      const res = await app.request(path, { headers }, pinEnv(db));
      expect(res.status, path).toBe(302);
      expect(res.headers.get("location") ?? "", path).toBe("/ops/interco_logistics");
    }
    for (const path of ["/interco/manifest/add", "/interco/create", "/interco/receive", "/interco/arrivals/pnn/receive-truck", "/interco/manifest/finish"]) {
      const res = await app.request(path, { method: "POST", headers, body: new URLSearchParams({ x: "1" }) }, pinEnv(db));
      expect(res.status, path).toBe(303);
      expect(res.headers.get("location") ?? "", path).toBe("/ops/interco_logistics");
    }
    const virtual = await app.request("/virtual-move", { headers }, pinEnv(db));
    expect(virtual.status).toBe(302);
    expect(virtual.headers.get("location") ?? "").toMatch(/\/interco$/);
    const menu = await app.request("/ops/interco_logistics", { headers }, pinEnv(db));
    expect(menu.status).toBe(200);
    const menuHtml = await menu.text();
    expect(menuHtml).toContain("Logistics Operations");
    expect(menuHtml).toContain('href="/logistics/internal"');
    expect(menuHtml).toContain("Internal Logistics");
    expect(menuHtml).toContain('href="/logistics/partners"');
    expect(menuHtml).toContain("Processing Partners");
    expect(menuHtml).not.toContain("data-manifest-builder");
    const partners = await app.request("/logistics/partners", { headers }, pinEnv(db));
    expect(partners.status).toBe(200);
    expect(await partners.text()).toContain("- EMPTY -");
    const csv = await app.request("/interco/manifest/nope/csv", { headers }, pinEnv(db));
    expect(csv.status).toBe(302);
    expect(csv.headers.get("location")).toBe("/ops/interco_logistics");
  });
});

describe("walk slice outbound and receiving actions", () => {
  it("stages every free resident item, excludes on-movement items, finishes to IN-TRANSIT", async () => {
    const db = makeIntercoDb();
    const added = await addDrySpaceToMovement(
      db as unknown as D1Database,
      actorForm({
        space_name: "Silo 2",
        origin_license: LICENSE_AU_GROW,
        destination_license: LICENSE_AU_PROCESSOR,
        origin_farm: "ARL",
        destination_farm: "PNN",
      })
    );
    const movementId = new URL(added.redirect, "https://local").searchParams.get("movement");
    expect(movementId).toBeTruthy();
    const staged = db.items.filter((i) => i.movement_id === movementId);
    expect(staged.map((i) => i.local_inventory_item_id)).toEqual(["inv-ship"]);
    const finished = await finishOutboundShipment(db as unknown as D1Database, movementId!, actorForm({}));
    expect(finished.redirect).toContain(`/interco/ship-external/${movementId}/done`);
    const move = db.movements.find((m) => m.id === movementId);
    expect(move?.status).toBe("completed");
    expect(move?.exported_at).toBeTruthy();
    expect(db.inventory.find((i) => i.id === "inv-ship")?.location).toBe("IN-TRANSIT");
    await expect(finishOutboundShipment(db as unknown as D1Database, "no-items", actorForm({}))).rejects.toBeInstanceOf(
      HttpError
    );
    const empty = makeIntercoDb();
    const headerOnly = await addDrySpaceToMovement(
      empty as unknown as D1Database,
      actorForm({
        space_name: "Empty Room",
        origin_license: LICENSE_AU_GROW,
        destination_license: LICENSE_AU_PROCESSOR,
      })
    ).catch((err: unknown) => err);
    expect(headerOnly).toBeInstanceOf(HttpError);
  });

  it("refuses Finish Outbound with zero packages", async () => {
    const db = makeIntercoDb();
    db.movements.push({
      ...db.movements[0],
      id: "empty-move",
      status: "building",
    });
    try {
      await finishOutboundShipment(db as unknown as D1Database, "empty-move", actorForm({}));
      throw new Error("expected 400");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
    }
  });

  it("writes received_qty on override, Finish Receipt lands where the manifest said (CSB at 694, the inbox law), un-receive clears it", async () => {
    const db = makeIntercoDb();
    const added = await addDrySpaceToMovement(
      db as unknown as D1Database,
      actorForm({
        space_name: "Silo 2",
        origin_license: LICENSE_AU_GROW,
        destination_license: LICENSE_AU_PROCESSOR,
        origin_farm: "ARL",
        destination_farm: "PNN",
      })
    );
    const movementId = new URL(added.redirect, "https://local").searchParams.get("movement")!;
    await finishOutboundShipment(db as unknown as D1Database, movementId, actorForm({}));
    const row = db.items.find((i) => i.movement_id === movementId)!;
    await receiveMovementItems(db as unknown as D1Database, movementId, [row.id], actorForm({ received_qty: "55.25" }));
    expect(row.received_qty).toBe(55);
    const receipt = await finishReceipt(db as unknown as D1Database, movementId, actorForm({}));
    expect(receipt.redirect).toContain("/interco/arrivals/pnn");
    const inv = db.inventory.find((i) => i.id === "inv-ship")!;
    expect(inv.farm_code).toBe("PNN");
    // Canon 0.30.26: an 832 to 694 manifest is the door; its receipt lands CSB
    // under the processor license, not the site barn under 832.
    expect(inv.location).toBe("CSB");
    expect(inv.license_value).toBe(LICENSE_AU_PROCESSOR);
    expect(inv.qty).toBe(55);
    expect(row.receipt_id).toBeTruthy();
    await unreceiveItem(db as unknown as D1Database, row.id, actorForm({ reason: "walk un-receive" }));
    expect(row.received_qty).toBeNull();
    expect(row.receipt_id).toBeNull();
    expect(inv.location).toBe("IN-TRANSIT");
  });

  it("finishSiteSend derives licenses from the lane and lands IN-TRANSIT", async () => {
    const db = makeIntercoDb();
    const form = actorForm({
      lane: "pns-pnn",
      truck_number: "3",
    });
    form.append("item_id", "inv-pns");
    const sent = await finishSiteSend(db as unknown as D1Database, "pns", form);
    expect(sent.redirect).toContain("/interco?ok=sent");
    const move = db.movements.find((m) => m.origin_farm === "PNS" && m.destination_farm === "PNN");
    expect(move?.origin_license).toBe(LICENSE_PNS_AU);
    expect(move?.destination_license).toBe(LICENSE_AU_GROW);
    expect(move?.status).toBe("completed");
    expect(db.inventory.find((i) => i.id === "inv-pns")?.location).toBe("IN-TRANSIT");
  });
});

describe("logistics moves data queue (canon 0.26.0, owner ruling 2026-09-06)", () => {
  const baseRow = {
    id: "move-q1",
    created_at: "2026-09-06T01:00:00.000Z",
    movement_kind: "interco",
    origin_farm: "PNS",
    destination_farm: "PNN",
    origin_license: "AU-G-C-001397",
    destination_license: "AU-G-C-000832",
    truck_number: "2",
    status: "completed",
    item_count: 2,
    received_count: 0,
  };

  it("movementVoidBlock refuses only while an item stands received", () => {
    expect(movementVoidBlock([{ received_at: null, deleted_at: null }])).toBeNull();
    expect(movementVoidBlock([{ received_at: "2026-09-06T01:05:00.000Z", deleted_at: null }])).toBe(
      "Un-receive its receipts first."
    );
    expect(
      movementVoidBlock([{ received_at: "2026-09-06T01:05:00.000Z", deleted_at: "2026-09-06T01:06:00.000Z" }])
    ).toBeNull();
  });

  it("the queue section offers the reasoned void and refuses received movements", () => {
    const open = movementsQueueSection([baseRow], "en");
    expect(open).toContain("Logistics Moves");
    expect(open).toContain('action="/admin/queues/movement/move-q1/void"');
    expect(open).toContain('name="reason"');
    const received = movementsQueueSection([{ ...baseRow, received_count: 1 }], "en");
    expect(received).toContain("Un-receive its receipts first.");
    expect(received).not.toContain('action="/admin/queues/movement/move-q1/void"');
    const empty = movementsQueueSection([], "en");
    expect(empty).toContain("No logistics moves.");
  });
});
