import { describe, expect, it } from "vitest";
import { LOC_BLAST_FREEZER, SYSTEM_REASON } from "../src/config";
import { closeLedgerForGoneTags, landFfzFromMirror } from "../src/metrc";
import { metrcPane } from "../src/metrcpane";
import { migratedDb, seedMirror, seedPerson } from "./migrated";

const T0 = "2026-09-24T18:00:00.000Z";
const MOUNT = "aaaabbbb-cccc-dddd-eeee-ffffffffffff";
const EIGHT = "aaaabbbb";
const FFZ_A = "1A4050300000000000000E11";
const FFZ_B = "1A4050300000000000000E12";
const WIP = "1A4050300000000000000E13";
const STRAIN = "a4000001-0001-4000-8000-000000000005";

const cross = {
  ledger_tagged: 0,
  ledger_in_metrc: 0,
  ledger_gone_in_metrc: 0,
  ledger_unknown_to_metrc: 0,
  ledger_untagged: 0,
  metrc_active: 0,
  metrc_unclaimed: 0,
  zoho_tagged: 0,
  zoho_in_metrc: 0,
  zoho_not_in_metrc: 0,
  samples: { ledger_unknown: [], zoho_not_in_metrc: [] },
};

describe("THE FFZ INVENTORY lands at the Blast Freezer (canon 0.30.225)", () => {
  it("lands two fresh frozen packages and skips a WIP package, with whole grams, the license site, the strain and the log", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedMirror(m, { tag: FFZ_A, item: "FFZ - Casa Blanca - PNN - O", strain: "Casa Blanca", grams: 1500.5, license: "AU-G-C-001509" });
    seedMirror(m, { tag: FFZ_B, item: "FFZ", strain: "No Such Strain", grams: 20, license: "NOT-A-LICENSE" });
    seedMirror(m, { tag: WIP, item: "WIP - Placeholder", strain: "Casa Blanca", grams: 40, license: "AU-G-C-001509" });
    const n = await landFfzFromMirror(m.db, person, MOUNT, T0);
    expect(n).toBe(2);
    const a = m.get(`SELECT item_kind, package_code, metrc_tag, qty, uom, farm_code, license_value, location, strain_id, harvest_batch_id, wip_package_id FROM local_inventory_items WHERE metrc_tag = ?`, FFZ_A);
    expect(a).toMatchObject({
      item_kind: "FG",
      package_code: FFZ_A,
      metrc_tag: FFZ_A,
      qty: 1501,
      uom: "g",
      farm_code: "ARL",
      license_value: "AU-G-C-001509",
      location: LOC_BLAST_FREEZER,
      strain_id: STRAIN,
      harvest_batch_id: null,
      wip_package_id: null,
    });
    expect(m.get(`SELECT farm_code, strain_id, qty, location FROM local_inventory_items WHERE metrc_tag = ?`, FFZ_B)).toMatchObject({
      farm_code: "PNN",
      strain_id: null,
      qty: 20,
      location: LOC_BLAST_FREEZER,
    });
    expect(m.get(`SELECT id FROM local_inventory_items WHERE metrc_tag = ?`, WIP)).toBeUndefined();
    const log = m.all(`SELECT reason FROM record_change_log WHERE record_table = 'local_inventory_items' AND new_value = ?`, FFZ_A);
    expect(log.some((row) => String(row.reason).includes(SYSTEM_REASON.ffz_from_mirror) && String(row.reason).includes(EIGHT))).toBe(true);
  });

  it("skips a tag a live item bears and a tag a closed item bears, and a second call lands nothing", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedMirror(m, { tag: FFZ_A, item: "FFZ - Casa Blanca", strain: "Casa Blanca", grams: 10, license: "AU-P-000694" });
    seedMirror(m, { tag: FFZ_B, item: "FFZ - Other", grams: 8, license: "AU-P-000694" });
    m.run(
      `INSERT INTO local_inventory_items (id, item_kind, package_code, metrc_tag, qty, uom, farm_code, license_value, location, created_at, updated_at)
       VALUES ('live-1', 'WIP', ?, ?, 4, 'g', 'PNN', 'AU-P-000694', 'Cryo Room', ?, ?)`,
      FFZ_A,
      FFZ_A,
      T0,
      T0
    );
    m.run(
      `INSERT INTO local_inventory_items (id, item_kind, package_code, metrc_tag, qty, uom, farm_code, license_value, location, created_at, updated_at, deleted_at, deleted_by, delete_reason)
       VALUES ('gone-1', 'FG', ?, ?, 8, 'g', 'PNN', 'AU-P-000694', 'Blast Freezer', ?, ?, ?, 'p', 'gone')`,
      FFZ_B,
      FFZ_B,
      T0,
      T0,
      T0
    );
    expect(await landFfzFromMirror(m.db, person, MOUNT, T0)).toBe(0);
    expect(m.all(`SELECT id FROM local_inventory_items WHERE metrc_tag IN (?, ?)`, FFZ_A, FFZ_B)).toHaveLength(2);
    seedMirror(m, { tag: "1A4050300000000000000E14", item: "FFZ - New", grams: 3, license: "AU-P-000694" });
    expect(await landFfzFromMirror(m.db, person, MOUNT, T0)).toBe(1);
    expect(await landFfzFromMirror(m.db, person, MOUNT, T0)).toBe(0);
  });

  it("a kind added to ffz_item_kinds lands on the next call; ounces and a blank quantity do not", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedMirror(m, { tag: FFZ_A, item: "FRESH - Casa Blanca", strain: "Casa Blanca", grams: 12, license: "AU-P-000694" });
    expect(await landFfzFromMirror(m.db, person, MOUNT, T0)).toBe(0);
    m.run(`UPDATE app_config SET value = 'FFZ,FRESH' WHERE key = 'ffz_item_kinds'`);
    expect(await landFfzFromMirror(m.db, person, MOUNT, T0)).toBe(1);
    m.run(
      `INSERT INTO metrc_packages (tag, license_value, item, item_strain, quantity, uom, location, mount_id, first_seen_at, changed_at)
       VALUES ('1A4050300000000000000E15', 'AU-P-000694', 'FFZ - Ounces', 'Casa Blanca', 2, 'oz', 'Blast Freezer', 'mount-1', ?, ?)`,
      T0,
      T0
    );
    m.run(
      `INSERT INTO metrc_packages (tag, license_value, item, quantity, uom, location, mount_id, first_seen_at, changed_at)
       VALUES ('1A4050300000000000000E16', 'AU-P-000694', 'FFZ - Blank', NULL, 'g', 'Blast Freezer', 'mount-1', ?, ?)`,
      T0,
      T0
    );
    expect(await landFfzFromMirror(m.db, person, MOUNT, T0)).toBe(0);
  });

  it("the mount flash counts the landed packages, and a later gone mount closes the item", async () => {
    const html = metrcPane(
      {
        lines: [],
        mounts: [],
        cross,
        licenses: [],
        defs: [],
        ok: "mounted",
        mounted: { kind: "packages", added: 2, updated: 0, gone: 0, landed: 2, released: 0, releasedPassed: 0, releasedFailed: 0 },
      },
      "en"
    );
    expect(html).toContain("2 fresh frozen packages landed at the Blast Freezer.");
    expect(html).toContain('data-metrc-landed="2"');
    const es = metrcPane(
      {
        lines: [],
        mounts: [],
        cross,
        licenses: [],
        defs: [],
        ok: "mounted",
        mounted: { kind: "packages", added: 1, updated: 0, gone: 0, landed: 1, released: 0 },
      },
      "es"
    );
    expect(es).toContain("1 paquetes congelados frescos aterrizaron en el Blast Freezer.");
    const quiet = metrcPane(
      {
        lines: [],
        mounts: [],
        cross,
        licenses: [],
        defs: [],
        ok: "mounted",
        mounted: { kind: "packages", added: 0, updated: 0, gone: 0, landed: 0, released: 0 },
      },
      "en"
    );
    expect(quiet).not.toContain("landed at the Blast Freezer");

    const m = await migratedDb();
    const person = seedPerson(m);
    seedMirror(m, { tag: FFZ_A, item: "FFZ - Casa Blanca", strain: "Casa Blanca", grams: 9, license: "AU-P-000694" });
    expect(await landFfzFromMirror(m.db, person, MOUNT, T0)).toBe(1);
    m.run(`UPDATE metrc_packages SET gone_at = ? WHERE tag = ?`, T0, FFZ_A);
    const closed = await closeLedgerForGoneTags(m.db, person, MOUNT, T0);
    expect(closed.items).toBe(1);
    expect(m.get(`SELECT deleted_at FROM local_inventory_items WHERE metrc_tag = ?`, FFZ_A)?.deleted_at).toBeTruthy();
    expect(await landFfzFromMirror(m.db, person, MOUNT, T0)).toBe(0);
  });
});
