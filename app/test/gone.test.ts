import { describe, expect, it } from "vitest";
import { SYSTEM_REASON, WIP_STATUS } from "../src/config";
import { localInventorySection } from "../src/html";
import { closeLedgerForGoneTags } from "../src/metrc";
import type { LocalInventoryListRow } from "../src/db";

/** A D1 stand-in: the two reads answer from the lists given; every statement
 * that reaches batch is kept with its SQL and binds for the pins. */
function fakeDb(items: Array<Record<string, unknown>>, packages: Array<Record<string, unknown>>) {
  const batched: Array<{ sql: string; args: unknown[] }> = [];
  function stmt(sql: string) {
    const args: unknown[] = [];
    const self = {
      bind(...next: unknown[]) {
        args.push(...next);
        return self;
      },
      async all() {
        if (sql.includes("FROM local_inventory_items i")) return { results: items };
        if (sql.includes("FROM wip_packages p")) return { results: packages };
        return { results: [] };
      },
      async first() {
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

describe("THE MIRROR CLOSES THE LEDGER (canon 0.30.128; owner: METRC is showing 0 and the ledger is full)", () => {
  it("closes each ledger item and each Testing Queue package the mirror marks gone, with the mount's reason, logged", async () => {
    const db = fakeDb(
      [
        { id: "item-1", metrc_tag: "1A4050300000000000000C01", qty: 88.25, location: "Cryo Room" },
        { id: "item-2", metrc_tag: "1A4050300000000000000C02", qty: 12, location: "Blast Freezer" },
      ],
      [{ id: "wip-1", package_code: "1A4050300000000000000C02", status: WIP_STATUS.testing_queue }]
    );
    const out = await closeLedgerForGoneTags(db as unknown as D1Database, "actor-1", "aaaabbbb-cccc-dddd-eeee-ffffffffffff", "2026-09-19T12:00:00.000Z");
    expect(out).toEqual({ items: 2, packages: 1 });
    const reason = `${SYSTEM_REASON.gone_in_metrc} (mount aaaabbbb)`;
    expect(reason).toBe("gone in METRC (mount aaaabbbb)");
    const sql = db.batched.map((b) => b.sql.replace(/\s+/g, " "));
    // Two item closes, each with its log; one package close with its log.
    const itemCloses = db.batched.filter((b) => b.sql.includes("UPDATE local_inventory_items SET deleted_at"));
    expect(itemCloses).toHaveLength(2);
    expect(itemCloses[0].args).toEqual(["2026-09-19T12:00:00.000Z", "actor-1", reason, "2026-09-19T12:00:00.000Z", "actor-1", "item-1"]);
    expect(itemCloses[0].sql).toContain("WHERE id = ? AND deleted_at IS NULL");
    const pkgCloses = db.batched.filter((b) => b.sql.includes("UPDATE wip_packages SET status = ?"));
    expect(pkgCloses).toHaveLength(1);
    expect(pkgCloses[0].args).toEqual([WIP_STATUS.gone, "2026-09-19T12:00:00.000Z", "actor-1", "wip-1", WIP_STATUS.testing_queue]);
    const logs = db.batched.filter((b) => b.sql.includes("INSERT INTO record_change_log"));
    expect(logs).toHaveLength(3);
    for (const log of logs) expect(log.args).toContain(reason);
    expect(logs[2].args).toContain(WIP_STATUS.gone);
    expect(sql.filter((x) => x.includes("record_change_log"))).toHaveLength(3);
  });

  it("writes nothing when the mirror marks nothing gone", async () => {
    const db = fakeDb([], []);
    const out = await closeLedgerForGoneTags(db as unknown as D1Database, "actor-1", "m", "2026-09-19T12:00:00.000Z");
    expect(out).toEqual({ items: 0, packages: 0 });
    expect(db.batched).toHaveLength(0);
  });

  it("the gone status stands beside the others and is not released", () => {
    expect(WIP_STATUS.gone).toBe("gone");
    expect(WIP_STATUS.gone).not.toBe(WIP_STATUS.released);
    expect(SYSTEM_REASON.gone_in_metrc).toBe("gone in METRC");
  });
});

describe("THE LEDGER FOLDS (canon 0.30.129; owner: make local inventory collapsable and loading default collapsed)", () => {
  const row = {
    id: "i1",
    item_kind: "WIP",
    package_code: "1A4050300000000000000C01",
    metrc_tag: "1A4050300000000000000C01",
    strain_name: "Goji",
    qty: 88.25,
    uom: "g",
    farm_code: "PNN",
    farm_name: "Penn North",
    location: "Cryo Room",
    location_label: "Cryo Room",
    created_at: "2026-09-08T00:00:00.000Z",
  } as unknown as LocalInventoryListRow;

  it("renders the ledger as a collapsible block, closed, its count in the summary", () => {
    const html = localInventorySection([row], "en");
    expect(html.startsWith('<details class="inv-section local-inventory" data-inv-section="local">')).toBe(true);
    expect(html).not.toContain('data-inv-section="local" open');
    expect(html).toContain('<summary>Local inventory <span class="tile-count" data-local-inventory-count>1</span></summary>');
    expect(html).toContain("<code>1A4050300000000000000C01</code>");
    expect(html.trimEnd().endsWith("</details>")).toBe(true);
    expect(html).not.toContain("<h2>");
  });

  it("stays a collapsed block when empty, counting zero, in Spanish too", () => {
    const html = localInventorySection([], "es");
    expect(html).toContain('<summary>Inventario local <span class="tile-count" data-local-inventory-count>0</span></summary>');
    expect(html).toContain("Aun no hay inventario local.");
    expect(html).not.toContain(" open>");
  });
});
