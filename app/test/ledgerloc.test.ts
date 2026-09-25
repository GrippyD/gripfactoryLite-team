import { describe, expect, it } from "vitest";
import { SYSTEM_REASON } from "../src/config";
import type { LocalInventoryListRow } from "../src/db";
import {
  RECONCILE_REFUSAL,
  acknowledgeReconcileNote,
  editFieldName,
  listDryingLocations,
  purgeLocation,
  reconcileLocationPage,
  reconcileNotesSection,
  saveLocationEdits,
  type DryingLocation,
  type ReconcileNoteRow,
} from "../src/ledgerloc";

// As the query orders them: silos, then dry rooms, then freezers, by name within each.
const SPACES = [
  { name: "Silo 1", kind: "silo", space_type: "silo", location_name: null, farm_code: "PNN" },
  { name: "Silo 4", kind: "silo", space_type: "silo", location_name: null, farm_code: "PNN" },
  { name: "Arlington Dry Room", kind: "silo", space_type: "dry_room", location_name: null, farm_code: "ARL" },
  { name: "Hang in Place", kind: "hang", space_type: "dry_room", location_name: null, farm_code: "PNN" },
  { name: "Blast Freezer(s)", kind: "silo", space_type: "freezer", location_name: "Blast Freezer", farm_code: "PNN" },
  { name: "Second Freezer", kind: "silo", space_type: "freezer", location_name: "Blast Freezer", farm_code: "PNN" },
];

function item(over: Partial<LocalInventoryListRow> = {}): LocalInventoryListRow {
  return {
    id: "item-1",
    item_kind: "WIP",
    package_code: "26016",
    metrc_tag: null,
    harvest_batch_id: "hb1",
    wet_weight_entry_id: "lot1",
    strain_id: "s1",
    strain_name: "Fruity Pebbles",
    qty: 1132,
    uom: "g",
    farm_code: "PNN",
    farm_name: "Penn North",
    license_value: "AU-G-C-000832",
    location: "Silo 4",
    location_label: "Silo 4",
    parent_item_id: null,
    created_at: "2026-09-20T10:00:00.000Z",
    hbn: "26260-PNN-GH-027-0-NA-26016",
    ...over,
  };
}

/** A D1 stand-in: dry spaces, the ledger at the picked location, the PIN, the
 * actor; every statement that reaches batch is kept for the pins. */
function fakeDb(input: { items?: LocalInventoryListRow[]; note?: Record<string, unknown> | null; pin?: string; cryoIds?: string[] }) {
  const batched: Array<{ sql: string; args: unknown[] }> = [];
  function stmt(sql: string) {
    const args: unknown[] = [];
    const self = {
      bind(...next: unknown[]) {
        args.push(...next);
        return self;
      },
      async all() {
        if (sql.includes("FROM dry_spaces")) return { results: SPACES };
        if (sql.includes("FROM local_inventory_items i")) {
          if (sql.includes("fp.cryo_weight_grams IS NOT NULL")) {
            return { results: (input.items ?? []).filter((i) => i.location === args[0] || (input.cryoIds ?? []).includes(i.id)) };
          }
          return { results: (input.items ?? []).filter((i) => i.location === args[0]) };
        }
        if (sql.includes("FROM reconcile_notes n")) return { results: [] };
        return { results: [] };
      },
      async first() {
        if (sql.includes("FROM people WHERE id = ?")) return { id: args[0], display_name: "Crew", is_active: 1 };
        if (sql.includes("FROM app_config")) return { value: input.pin ?? "21319" };
        if (sql.includes("FROM reconcile_notes n")) return input.note ?? null;
        return null;
      },
      async run() {
        return { success: true };
      },
      sql,
      args,
    };
    return self;
  }
  return {
    prepare: (sql: string) => stmt(sql),
    async batch(stmts: Array<{ sql: string; args: unknown[] }>) {
      for (const s of stmts) batched.push({ sql: s.sql, args: s.args });
      return stmts.map(() => ({ success: true }));
    },
    batched,
  };
}

function formOf(fields: Record<string, string>): FormData {
  const form = new FormData();
  form.set("person_id", "p1");
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

const LOCATIONS: DryingLocation[] = [
  { value: "Silo 1", label: "Silo 1", kind: "silo", space_type: "silo", farm_code: "PNN" },
  { value: "Silo 4", label: "Silo 4", kind: "silo", space_type: "silo", farm_code: "PNN" },
  { value: "Blast Freezer", label: "Blast Freezer(s) (Blast Freezer)", kind: "silo", space_type: "freezer", farm_code: "PNN" },
];

describe("THE RECONCILE LEDGER LOCATION (canon 0.30.135; owner: [Reconcile Ledger Location], farm inert, drying locations, Purge with reason and PIN, Edit with a note, all on the changelog, a note on the queue)", () => {
  it("lists the drying locations by the METRC location each stands over, freezers last, each once, the truck never", async () => {
    const db = fakeDb({});
    const locations = await listDryingLocations(db as unknown as D1Database);
    expect(locations.map((l) => l.value)).toEqual(["Silo 1", "Silo 4", "Arlington Dry Room", "Hang in Place", "Blast Freezer"]);
    expect(locations.find((l) => l.value === "Blast Freezer")!.label).toBe("Blast Freezer(s) (Blast Freezer)");
    const read = (db as unknown as { batched: unknown[] }).batched;
    expect(read).toHaveLength(0);
  });

  it("renders the inert farm, the location pick, the editable rows with a note, and the PIN-gated purge", () => {
    const page = reconcileLocationPage({
      farms: [
        { value: "ARL", label: "Arlington" },
        { value: "PNN", label: "Penn North" },
      ],
      locations: LOCATIONS,
      picked: "Silo 4",
      items: [item(), item({ id: "item-2", package_code: "26017", qty: 640, metrc_tag: "1A4060300003E5B000012345" })],
      openNotes: 2,
    });
    expect(page).toContain("<h1>Reconcile Ledger Location</h1>");
    expect(page).toContain('<select name="farm" disabled data-farm-inert>');
    expect(page).toContain('<option value="PNN" selected>Penn North</option>');
    expect(page).toContain("One farm while Interco Logistics is out of the chain.");
    expect(page).toContain('<option value="Silo 4" selected>Silo 4</option>');
    expect(page).toContain('<option value="Blast Freezer">Blast Freezer(s) (Blast Freezer)</option>');
    expect(page).toContain('data-reconcile-count>2</span>');
    expect(page).toContain("Live ledger packages: 2 · 1,772 g");
    expect(page).toContain(`<input type="text" name="${editFieldName("qty", "item-1")}" value="1132"`);
    expect(page).toContain(`<input type="text" name="${editFieldName("metrc_tag", "item-2")}" value="1A4060300003E5B000012345"`);
    expect(page).toContain(`<select name="${editFieldName("item_kind", "item-1")}"><option value="WIP" selected>WIP</option><option value="SPR">SPR</option><option value="FG">FG</option></select>`);
    expect(page).toContain(`<select name="${editFieldName("location", "item-1")}">`);
    expect(page).toContain('<input type="text" name="note" required');
    expect(page).toContain('action="/admin/reconcile-location/edit"');
    expect(page).toContain('action="/admin/reconcile-location/purge"');
    expect(page).toContain('name="admin_pin"');
    expect(page).toContain(">Purge 2</button>");
    expect(page).toContain('data-open-notes="2"');
    expect(page).toContain("2 reconciliation notes wait on Pending Data Uploads.");
    const empty = reconcileLocationPage({ farms: [], locations: LOCATIONS, picked: "Silo 1", items: [], openNotes: 0 });
    expect(empty).toContain("No live ledger packages at this location.");
    expect(empty).not.toContain("data-reconcile-purge-form");
    const none = reconcileLocationPage({ farms: [], locations: LOCATIONS, picked: null, items: [], openNotes: 0, locale: "es" });
    expect(none).toContain("Elija una ubicacion para ver lo que el libro tiene ahi.");
  });

  it("purges every live package at the location under the reason and the PIN, logs each, and writes one note", async () => {
    const db = fakeDb({ items: [item(), item({ id: "item-2", package_code: "26017", qty: 640.5 })] });
    const out = await purgeLocation(db as unknown as D1Database, formOf({ location: "Silo 4", reason: "counted empty on the floor", admin_pin: "21319" }));
    expect(out.redirect).toBe("/admin/reconcile-location?location=Silo%204&ok=purged&n=2");
    const voids = db.batched.filter((b) => b.sql.includes("UPDATE local_inventory_items SET deleted_at"));
    expect(voids).toHaveLength(2);
    expect(voids[0].args[2]).toBe("counted empty on the floor");
    expect(voids[0].args[5]).toBe("item-1");
    const logs = db.batched.filter((b) => b.sql.includes("INSERT INTO record_change_log") && b.args.includes("local_inventory_items"));
    expect(logs).toHaveLength(2);
    for (const log of logs) expect(log.args).toContain(`${SYSTEM_REASON.reconcile_purge}: counted empty on the floor`);
    const note = db.batched.find((b) => b.sql.includes("INSERT INTO reconcile_notes"));
    expect(note).toBeDefined();
    expect(note!.args[1]).toBe("purge");
    expect(note!.args[2]).toBe("PNN");
    expect(note!.args[3]).toBe("Silo 4");
    expect(note!.args[4]).toBe("counted empty on the floor");
    expect(note!.args[5]).toBe("2 packages voided, 1,773 g, at Silo 4");
    expect(JSON.parse(String(note!.args[6]))).toHaveLength(2);
  });

  it("refuses a purge without the PIN, without a reason, at an unknown location, and at an empty one, writing nothing", async () => {
    const full = fakeDb({ items: [item()] });
    await expect(purgeLocation(full as unknown as D1Database, formOf({ location: "Silo 4", reason: "x", admin_pin: "1" }))).rejects.toThrow(RECONCILE_REFUSAL.pin);
    await expect(purgeLocation(full as unknown as D1Database, formOf({ location: "Silo 4", reason: "", admin_pin: "21319" }))).rejects.toThrow(RECONCILE_REFUSAL.reason);
    await expect(purgeLocation(full as unknown as D1Database, formOf({ location: "BARN", reason: "x", admin_pin: "21319" }))).rejects.toThrow(RECONCILE_REFUSAL.location);
    await expect(purgeLocation(full as unknown as D1Database, formOf({ location: "Silo 1", reason: "x", admin_pin: "21319" }))).rejects.toThrow(RECONCILE_REFUSAL.nothing);
    expect(full.batched).toHaveLength(0);
  });

  it("saves each changed field as its own update and log line under the note, skips the unchanged, and writes one note", async () => {
    const db = fakeDb({ items: [item(), item({ id: "item-2", package_code: "26017", qty: 640 })] });
    const out = await saveLocationEdits(
      db as unknown as D1Database,
      formOf({
        location: "Silo 4",
        note: "recount after the spill",
        [editFieldName("qty", "item-1")]: "1,100".replace(",", ""),
        [editFieldName("metrc_tag", "item-1")]: "1a4060300003e5b000112233",
        [editFieldName("item_kind", "item-1")]: "WIP",
        [editFieldName("package_code", "item-2")]: "26017",
        [editFieldName("location", "item-2")]: "Blast Freezer",
      })
    );
    expect(out.redirect).toBe("/admin/reconcile-location?location=Silo%204&ok=edited&n=3");
    const updates = db.batched.filter((b) => b.sql.startsWith("UPDATE local_inventory_items SET"));
    // The fields walk in the form's order: kind, code, tag, grams, farm, location.
    expect(updates.map((u) => u.sql.match(/SET (\w+) = \?/)![1])).toEqual(["metrc_tag", "qty", "location"]);
    expect(updates[0].args[0]).toBe("1A4060300003E5B000112233");
    expect(updates[1].args[0]).toBe(1100);
    expect(updates[2].args[0]).toBe("Blast Freezer");
    expect(updates[2].args[3]).toBe("item-2");
    const logs = db.batched.filter((b) => b.sql.includes("INSERT INTO record_change_log") && b.args.includes("local_inventory_items"));
    expect(logs).toHaveLength(3);
    for (const log of logs) expect(log.args).toContain(`${SYSTEM_REASON.reconcile_edit}: recount after the spill`);
    expect(logs[1].args).toContain("1132");
    expect(logs[1].args).toContain("1100");
    const note = db.batched.find((b) => b.sql.includes("INSERT INTO reconcile_notes"));
    expect(note!.args[1]).toBe("edit");
    expect(note!.args[5]).toBe("3 fields on 2 packages edited at Silo 4");
    const detail = JSON.parse(String(note!.args[6])) as Array<{ field: string; old: string | null; new: string | null }>;
    expect(detail.map((d) => d.field)).toEqual(["metrc_tag", "qty", "location"]);
    expect(detail[0].old).toBeNull();
  });

  it("refuses a save that changes nothing, one without a note, a kind off the list, and a move off the drying floor", async () => {
    const db = fakeDb({ items: [item()] });
    await expect(saveLocationEdits(db as unknown as D1Database, formOf({ location: "Silo 4", note: "n", [editFieldName("qty", "item-1")]: "1132" }))).rejects.toThrow(RECONCILE_REFUSAL.unchanged);
    await expect(saveLocationEdits(db as unknown as D1Database, formOf({ location: "Silo 4", [editFieldName("qty", "item-1")]: "1" }))).rejects.toThrow(RECONCILE_REFUSAL.note);
    await expect(saveLocationEdits(db as unknown as D1Database, formOf({ location: "Silo 4", note: "n", [editFieldName("item_kind", "item-1")]: "WET" }))).rejects.toThrow(RECONCILE_REFUSAL.kind);
    await expect(saveLocationEdits(db as unknown as D1Database, formOf({ location: "Silo 4", note: "n", [editFieldName("location", "item-1")]: "BARN" }))).rejects.toThrow(RECONCILE_REFUSAL.moved);
    expect(db.batched).toHaveLength(0);
  });

  it("acknowledges a note once, logged, and renders the queue section with its control", async () => {
    const row: ReconcileNoteRow = {
      id: "note-1",
      kind: "purge",
      farm_code: "PNN",
      location: "Silo 6",
      note: "smoke: purge",
      summary: "1 package voided, 1,131.50 g, at Silo 6",
      detail: "[]",
      acknowledged_at: null,
      created_at: "2026-09-20T12:00:00.000Z",
      created_by_name: "crew@local",
    };
    const db = fakeDb({ note: row });
    const out = await acknowledgeReconcileNote(db as unknown as D1Database, "note-1", formOf({}));
    expect(out.redirect).toBe("/admin/uploads?ok=acknowledged");
    expect(db.batched.some((b) => b.sql.includes("UPDATE reconcile_notes SET acknowledged_at"))).toBe(true);
    expect(db.batched.find((b) => b.sql.includes("INSERT INTO record_change_log"))!.args).toContain(SYSTEM_REASON.reconcile_acknowledged);
    const twice = fakeDb({ note: { ...row, acknowledged_at: "2026-09-20T13:00:00.000Z" } });
    await acknowledgeReconcileNote(twice as unknown as D1Database, "note-1", formOf({}));
    expect(twice.batched).toHaveLength(0);
    const section = reconcileNotesSection([row]);
    expect(section).toContain('data-fold="reconcile_notes" open');
    expect(section).toContain("Reconciliation notes");
    expect(section).not.toContain('type="checkbox"');
    expect(section).toContain('data-reconcile-note="note-1" data-reconcile-kind="purge"');
    expect(section).toContain("<td>Purge</td>");
    expect(section).toContain('action="/admin/uploads/reconcile_note/note-1/acknowledge"');
    expect(section).toContain(">Acknowledge</button>");
    expect(reconcileNotesSection([])).toBe("");
    expect(reconcileNotesSection([row], "es")).toContain(">Reconocer</button>");
  });
});
