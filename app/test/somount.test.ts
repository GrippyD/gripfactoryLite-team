import { describe, expect, it } from "vitest";
import { SO_GONE_HOLD_MIN, SO_GONE_REASON, mountSalesOrders, mountSalesOrdersRound } from "../src/actions";
import { listMountedOrdersWithLines, listSoMounts } from "../src/db";
import { SO_ROUND_ROWS, SO_SPLIT_JS, mountSosPage } from "../src/fulfillment";
import { zohoPrepackOrders } from "../src/prepackplan";
import { formOf, migratedDb, seedPerson, type MigratedDb } from "./migrated";

/* SM1, THE WHOLE EXPORT MOUNT (canon 0.30.554). Invented orders, buyers and
 * items throughout; never a row of a real export. */

type Split = { rounds: string[]; orders: number; rows: number };
const soSplit = new Function(`${SO_SPLIT_JS}\nreturn soSplit;`)() as (text: string, cap: number) => Split;

const HEAD = [
  "SalesOrder Number",
  "SalesOrder ID",
  "Order Date",
  "Expected Shipment Date",
  "Status",
  "Customer Name",
  "Item Name",
  "SKU",
  "QuantityOrdered",
  "QuantityInvoiced",
  "QuantityPacked",
  "Usage unit",
  "Item Price",
  "Item.CF.Product Sub",
  "Item.CF.Location Code",
  "CF.Status (Internal)",
  "Notes",
];

type Line = {
  so: string;
  date: string;
  item: string;
  qty?: number;
  inv?: number;
  status?: string;
  internal?: string;
  sub?: string;
  notes?: string;
  id?: string;
};

function quote(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function exportOf(lines: Line[]): string {
  const rows = lines.map((l) => [
    l.so,
    l.id ?? l.so.replace(/\D/g, ""),
    l.date,
    l.date,
    l.status ?? "confirmed",
    "Invented Buyer",
    l.item,
    "",
    String(l.qty ?? 10),
    String(l.inv ?? 0),
    "0",
    "lb",
    "10.00",
    l.sub ?? "Bulk Flower",
    "P1.1.A",
    l.internal ?? "approved",
    l.notes ?? "",
  ]);
  return [HEAD, ...rows].map((r) => r.map(quote).join(",")).join("\r\n") + "\r\n";
}

async function mountOnce(m: MigratedDb, person: string, text: string): Promise<void> {
  const form = formOf({ person_id: person });
  form.set("file", new File([text], "Sales_Order.csv", { type: "text/csv" }));
  await mountSalesOrders(m.db, form);
}

/** The page's own rounds: its splitter, then each round in order. */
async function mountInRounds(m: MigratedDb, person: string, text: string, cap = 3) {
  const split = soSplit(text, cap);
  let mountId = "";
  let last: Awaited<ReturnType<typeof mountSalesOrdersRound>> | null = null;
  for (let k = 0; k < split.rounds.length; k++) {
    const fields: Record<string, string> = { person_id: person, round: String(k), rounds: String(split.rounds.length) };
    if (mountId) fields.mount_id = mountId;
    const form = formOf(fields);
    form.set("file", new File([split.rounds[k]], "Sales_Order.csv", { type: "text/csv" }));
    last = await mountSalesOrdersRound(m.db, form);
    mountId = last.mount_id;
  }
  return { last: last!, rounds: split.rounds.length };
}

function roundForm(person: string, text: string, fields: Record<string, string>): FormData {
  const form = formOf({ person_id: person, ...fields });
  form.set("file", new File([text], "Sales_Order.csv", { type: "text/csv" }));
  return form;
}

function stateOf(m: MigratedDb) {
  return {
    orders: m.all(
      `SELECT so_number, order_date, zoho_status, internal_status, customer_name, deleted_at IS NOT NULL AS gone
       FROM mounted_sales_orders ORDER BY so_number`
    ),
    lines: m.all(
      `SELECT o.so_number, l.seq, l.item_name, l.quantity_ordered, l.quantity_invoiced, l.readout_category, l.deleted_at IS NOT NULL AS gone
       FROM mounted_sales_order_lines l JOIN mounted_sales_orders o ON o.id = l.sales_order_id ORDER BY o.so_number, l.seq`
    ),
    mount: m.get(`SELECT row_count, order_count, ignored_count, completed_at IS NOT NULL AS whole FROM so_mounts ORDER BY created_at DESC LIMIT 1`),
  };
}

/* Six orders with their rows interleaved, a CRIF fee, and a note holding a
 * comma and a line break inside quotes. */
const INTERLEAVED: Line[] = [
  { so: "SO-01", date: "2026-03-01", item: "Test Strain A Bulk Flower", qty: 10 },
  { so: "SO-02", date: "2026-03-02", item: "Test Strain B Bulk Flower", qty: 20 },
  { so: "SO-01", date: "2026-03-01", item: "Test Strain A Trim", qty: 5, sub: "Trim" },
  { so: "SO-03", date: "2026-03-03", item: "CRIF", qty: 1, sub: "CRIF Fee" },
  { so: "SO-03", date: "2026-03-03", item: "Test Strain C Bulk Flower", qty: 7 },
  { so: "SO-02", date: "2026-03-02", item: "Test Strain B Trim", qty: 3, sub: "Trim" },
  { so: "SO-04", date: "2026-03-04", item: "Test Strain D Bulk Flower", qty: 4, notes: "Two pallets, one\nwith the \"short\" bag" },
  { so: "SO-05", date: "2026-03-05", item: "Test Strain E Bulk Flower", qty: 1 },
  { so: "SO-05", date: "2026-03-05", item: "Test Strain E Trim", qty: 2, sub: "Trim" },
  { so: "SO-05", date: "2026-03-05", item: "Test Strain E Prepack", qty: 3, sub: "Prepack Ounces" },
  { so: "SO-06", date: "2026-03-06", item: "Test Strain F Bulk Flower", qty: 9 },
];

describe("SM1: the page's splitter", () => {
  it("keeps whole orders in file order, the header on every round, and the cap", () => {
    const text = exportOf(INTERLEAVED);
    const split = soSplit(text, 3);
    expect(split.rows).toBe(11);
    expect(split.orders).toBe(6);
    const header = text.slice(0, text.indexOf("\r\n"));
    const seen: string[] = [];
    for (const round of split.rounds) {
      // The header record keeps its CR; the mount's reader drops it.
      expect(round.startsWith(header + "\r\n")).toBe(true);
      const sos = new Set<string>();
      const body = round.slice(header.length + 2);
      for (const so of body.match(/^SO-\d\d/gm) ?? []) sos.add(so);
      for (const so of sos) {
        expect(seen).not.toContain(so);
        seen.push(so);
      }
      // No round passes the cap unless one order alone does.
      const records = (body.match(/^SO-\d\d/gm) ?? []).length;
      expect(records <= 3 || sos.size === 1).toBe(true);
    }
    expect(seen).toEqual(["SO-01", "SO-02", "SO-03", "SO-04", "SO-05", "SO-06"]);
    // SO-01's two rows ride together, first row first.
    const first = split.rounds[0];
    expect(first.indexOf("Test Strain A Bulk Flower")).toBeLessThan(first.indexOf("Test Strain A Trim"));
    // The quoted line break stays inside its record.
    expect(split.rounds.some((r) => r.includes('"Two pallets, one\nwith the ""short"" bag"'))).toBe(true);
  });

  it("puts an order bigger than the cap in a round of its own", () => {
    const big: Line[] = [
      { so: "SO-10", date: "2026-01-01", item: "Test Strain G Bulk Flower" },
      ...Array.from({ length: 5 }, (_, i) => ({ so: "SO-11", date: "2026-01-02", item: `Test Strain H Line ${i}` })),
      { so: "SO-12", date: "2026-01-03", item: "Test Strain J Bulk Flower" },
    ];
    const split = soSplit(exportOf(big), 3);
    expect(split.rounds).toHaveLength(3);
    expect((split.rounds[1].match(/^SO-11/gm) ?? []).length).toBe(5);
  });

  it("reads the order key the way the mount does: the number, then the ID, and keyless rows together", () => {
    const rows: Line[] = [
      { so: "", id: "77", date: "2026-02-01", item: "Test Strain K One" },
      { so: "SO-21", date: "2026-02-02", item: "Test Strain L One" },
      { so: "", id: "77", date: "2026-02-01", item: "Test Strain K Two" },
      { so: "", id: "", date: "2026-02-03", item: "Test Strain M One" },
      { so: "SO-21", date: "2026-02-02", item: "Test Strain L Two" },
      { so: "", id: "", date: "2026-02-03", item: "Test Strain M Two" },
    ];
    const split = soSplit("﻿" + exportOf(rows), 2);
    const roundOf = (item: string) => split.rounds.findIndex((r) => r.includes(item));
    expect(roundOf("Test Strain K One")).toBe(roundOf("Test Strain K Two"));
    expect(roundOf("Test Strain L One")).toBe(roundOf("Test Strain L Two"));
    expect(roundOf("Test Strain M One")).toBe(roundOf("Test Strain M Two"));
    expect(split.orders).toBe(3);
    expect(split.rounds[0].charCodeAt(0)).not.toBe(0xfeff);
  });

  it("rounds a header alone to nothing, and the page carries the splitter and its cap", () => {
    expect(soSplit(HEAD.join(",") + "\r\n", 3).rounds).toEqual([]);
    expect(soSplit("", 3).rounds).toEqual([]);
    const html = mountSosPage({ mounts: [], orders: [], today: "2026-10-27" });
    expect(html).toContain(`data-round-rows="${SO_ROUND_ROWS}"`);
    expect(html).toContain("function soSplit(text, cap)");
    expect(html).toContain("data-so-progress");
  });
});

describe("SM1: the whole export mount", () => {
  it("lands the same orders and lines in rounds as in one request", async () => {
    const text = exportOf(INTERLEAVED);
    const one = await migratedDb();
    await mountOnce(one, seedPerson(one), text);
    const many = await migratedDb();
    const { last, rounds } = await mountInRounds(many, seedPerson(many), text, 3);
    expect(rounds).toBe(5);
    expect(last.done).toBe(true);
    expect(stateOf(many)).toEqual(stateOf(one));
    expect(stateOf(many).mount).toEqual({ row_count: 10, order_count: 6, ignored_count: 1, whole: 1 });
    const mount = many.get(`SELECT rounds_total, rounds_done FROM so_mounts`);
    expect(mount).toEqual({ rounds_total: 5, rounds_done: 5 });
  });

  it("refuses a round without its mount, out of order, after the close, or outside its count", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const split = soSplit(exportOf(INTERLEAVED), 4);
    expect(split.rounds.length).toBe(3);
    await expect(mountSalesOrdersRound(m.db, roundForm(person, split.rounds[1], { round: "1", rounds: "3" }))).rejects.toThrow(
      "A round after the first must name its mount."
    );
    const first = await mountSalesOrdersRound(m.db, roundForm(person, split.rounds[0], { round: "0", rounds: "3" }));
    expect(first.done).toBe(false);
    await expect(
      mountSalesOrdersRound(m.db, roundForm(person, split.rounds[2], { round: "2", rounds: "3", mount_id: first.mount_id }))
    ).rejects.toThrow("Round 3 came out of order: the mount expects round 2.");
    await expect(
      mountSalesOrdersRound(m.db, roundForm(person, split.rounds[1], { round: "1", rounds: "4", mount_id: first.mount_id }))
    ).rejects.toThrow("The round count changed in the middle of the mount.");
    await expect(mountSalesOrdersRound(m.db, roundForm(person, split.rounds[0], { round: "3", rounds: "3" }))).rejects.toThrow(
      "The round must fall inside its mount."
    );
    await expect(mountSalesOrdersRound(m.db, roundForm(person, split.rounds[0], { round: "x", rounds: "3" }))).rejects.toThrow(
      "The round must be a whole number."
    );
    await mountSalesOrdersRound(m.db, roundForm(person, split.rounds[1], { round: "1", rounds: "3", mount_id: first.mount_id }));
    const done = await mountSalesOrdersRound(m.db, roundForm(person, split.rounds[2], { round: "2", rounds: "3", mount_id: first.mount_id }));
    expect(done.done).toBe(true);
    await expect(
      mountSalesOrdersRound(m.db, roundForm(person, split.rounds[2], { round: "2", rounds: "3", mount_id: first.mount_id }))
    ).rejects.toThrow("That mount has already landed.");
    await expect(mountSalesOrdersRound(m.db, roundForm(person, HEAD.join(",") + "\r\n", { round: "0", rounds: "1" }))).rejects.toThrow(
      "No sales order lines found in that file."
    );
  });

  it("takes a year-old invoice change on the next whole mount", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const before: Line[] = [
      { so: "SO-31", date: "2025-10-01", item: "Test Strain N Bulk Flower", qty: 10, inv: 5, status: "invoiced", internal: "shipped" },
      { so: "SO-32", date: "2026-10-01", item: "Test Strain P Bulk Flower", qty: 4 },
    ];
    await mountInRounds(m, person, exportOf(before), 1);
    const after: Line[] = [{ ...before[0], qty: 9, inv: 8 }, before[1]];
    await mountInRounds(m, person, exportOf(after), 1);
    expect(m.get(`SELECT quantity_ordered, quantity_invoiced FROM mounted_sales_order_lines WHERE item_name = 'Test Strain N Bulk Flower'`)).toEqual({
      quantity_ordered: 9,
      quantity_invoiced: 8,
    });
    const logged = m.get(
      `SELECT old_value, new_value FROM record_change_log WHERE record_table = 'mounted_sales_order_lines' AND field = 'quantity_ordered'`
    );
    expect(logged).toEqual({ old_value: "10", new_value: "9" });
  });

  it("THE GONE RULE: an order dated inside the export that the export lacks leaves with its lines; one outside stays", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const all: Line[] = [
      { so: "SO-41", date: "2025-11-25", item: "Test Strain Q Bulk Flower" },
      { so: "SO-42", date: "2025-12-01", item: "Test Strain R Bulk Flower" },
      { so: "SO-43", date: "2026-05-01", item: "Test Strain S Bulk Flower" },
      { so: "SO-43", date: "2026-05-01", item: "Test Strain S Trim", sub: "Trim" },
      { so: "SO-44", date: "2026-10-20", item: "Test Strain T Bulk Flower" },
    ];
    await mountInRounds(m, person, exportOf(all), 2);
    const later = all.filter((l) => l.so === "SO-42" || l.so === "SO-44");
    const { last } = await mountInRounds(m, person, exportOf(later), 2);
    expect(last.gone).toBe(1);
    expect(last.held).toBe(0);
    const gone = m.get(`SELECT id, deleted_at IS NOT NULL AS gone, delete_reason FROM mounted_sales_orders WHERE so_number = 'SO-43'`) as {
      id: string;
      gone: number;
      delete_reason: string;
    };
    expect(gone.gone).toBe(1);
    expect(gone.delete_reason).toBe(SO_GONE_REASON);
    expect(m.get(`SELECT COUNT(*) AS n FROM mounted_sales_order_lines WHERE sales_order_id = ? AND deleted_at IS NULL`, gone.id)).toEqual({ n: 0 });
    expect(m.get(`SELECT deleted_at IS NOT NULL AS gone FROM mounted_sales_orders WHERE so_number = 'SO-41'`)).toEqual({ gone: 0 });
    const logs = m.all(`SELECT field, new_value FROM record_change_log WHERE record_id = ? AND field IN ('deleted_at', 'delete_reason') ORDER BY field`, gone.id);
    expect(logs.map((l) => l.field)).toEqual(["delete_reason", "deleted_at"]);
    expect(m.get(`SELECT gone_count, gone_held FROM so_mounts ORDER BY created_at DESC LIMIT 1`)).toEqual({ gone_count: 1, gone_held: 0 });
    const html = mountSosPage({ mounts: await listSoMounts(m.db), orders: await listMountedOrdersWithLines(m.db), today: "2026-10-27" });
    expect(html).toContain("Gone from Zoho with this mount: 1.");
    expect(html).not.toContain('data-so="SO-43"');

    // The order comes back when an export carries it again, lines and all.
    await mountInRounds(m, person, exportOf(all), 2);
    expect(m.get(`SELECT deleted_at IS NOT NULL AS gone FROM mounted_sales_orders WHERE so_number = 'SO-43'`)).toEqual({ gone: 0 });
    expect(m.get(`SELECT COUNT(*) AS n FROM mounted_sales_order_lines WHERE sales_order_id = ? AND deleted_at IS NULL`, gone.id)).toEqual({ n: 2 });
  });

  it("THE GONE GUARD: a filtered export removes nothing and says so", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const days: Line[] = Array.from({ length: 30 }, (_, i) => ({
      so: `SO-5${String(i).padStart(2, "0")}`,
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      item: `Test Strain U Lot ${i}`,
    }));
    await mountOnce(m, person, exportOf(days));
    const filtered = [days[0], days[7], days[14], days[21], days[29]];
    const { last } = await mountInRounds(m, person, exportOf(filtered), 2);
    expect(last.gone).toBe(0);
    expect(last.held).toBe(25);
    expect(25).toBeGreaterThan(SO_GONE_HOLD_MIN);
    expect(m.get(`SELECT COUNT(*) AS n FROM mounted_sales_orders WHERE deleted_at IS NULL`)).toEqual({ n: 30 });
    const html = mountSosPage({ mounts: await listSoMounts(m.db), orders: await listMountedOrdersWithLines(m.db), today: "2026-10-27" });
    expect(html).toContain("Missing from this export but dated inside it: 25. Nothing was removed");
  });

  it("a mount whose rounds stopped says so and does not move the plan's orders stamp", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    await mountOnce(m, person, exportOf(INTERLEAVED));
    m.run(`UPDATE so_mounts SET created_at = '2026-10-01T00:00:00.000Z'`);
    const split = soSplit(exportOf(INTERLEAVED), 6);
    expect(split.rounds.length).toBe(2);
    await mountSalesOrdersRound(m.db, roundForm(person, split.rounds[0], { round: "0", rounds: "2" }));
    const orders = await zohoPrepackOrders(m.db, "2026-10-27", 3);
    expect(orders.mountedAt).toBe("2026-10-01T00:00:00.000Z");
    const html = mountSosPage({ mounts: await listSoMounts(m.db), orders: await listMountedOrdersWithLines(m.db), today: "2026-10-27" });
    expect(html).toContain("data-mount-stopped");
    expect(html).toContain("stopped after round 1 of 2. Mount the file again; what landed stays.");
    expect(html).toContain("10 lines, 6 orders, 1 ignored (CRIF, processing)");
  });
});
