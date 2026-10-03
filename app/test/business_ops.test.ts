import { describe, expect, it } from "vitest";
import {
  addAuditNote,
  addListing,
  addPoLine,
  addSupplier,
  closePurchaseOrder,
  createPurchaseOrder,
  createSalesOrder,
  finishAudit,
  issuePurchaseOrder,
  queueInstrumentImport,
  saveExternalResult,
  saveLabelTemplate,
  savePoEval,
  splitPackage,
  startAudit,
  stepSalesOrder,
} from "../src/biz";
import { SYSTEM_REASON } from "../src/config";
import { listPendingSplitUploads } from "../src/db";
import {
  CODE128_PATTERNS,
  CODE128_START_B,
  encodeCode128,
} from "../src/code128";
import {
  GRAMS_PER_LB,
  auditUpToDate,
  auditsPage,
  complianceMenuPage,
  formatLbs,
  ftqRate,
  gramsToLbs,
  lbsInTesting,
  paretoFromFailures,
  parseAqualabCsv,
  parseOrangePhotonicsCsv,
  testingPage,
} from "../src/compliance";
import { labelPrintHtml, serializeLabelFields } from "../src/labels";
import {
  listingMatches,
  listingsWithMatch,
  marketplacePage,
  mintSoNumber,
  parseMarketplacePane,
  salesHelperPaneHtml,
  splitChildCode,
  SPLIT_CSV_HEADER,
} from "../src/marketplace";
import { pendingUploadsPage } from "../src/html";
import { formatUsd, mintPoNumber, poLinesTotalCents, purchaseOrderPage } from "../src/purchasing";
import { qrVendorWired } from "../src/qr";
import {
  collapseInternalTesting,
  externalAuditsView,
  internalTestingView,
  reportCsv,
  reportPdfHtml,
  reportXlsx,
  rfReportView,
  salesOrderReportRows,
  salesOrdersView,
} from "../src/reports";
import { reportPage } from "../src/html";
import { app } from "../src/index";

type Row = Record<string, unknown>;

function makeBizDb() {
  const person = {
    id: "p-dev",
    display_name: "dev",
    email: "dev@local",
    is_active: 1,
    deleted_at: null as string | null,
  };
  const people = [person];
  const config: Record<string, string> = {
    admin_pin: "21319",
    internal_audit_interval_days: "30",
  };
  const tables: Record<string, Row[]> = {
    audits: [],
    audit_notes: [],
    external_test_results: [],
    internal_test_results: [],
    import_queue: [],
    label_templates: [],
    suppliers: [],
    purchase_orders: [],
    purchase_order_lines: [],
    listings: [],
    sales_orders: [],
    sales_order_lines: [],
    local_inventory_items: [],
    record_change_log: [],
    lookup_values: [
      { category: "label_stock", value: "4x6", label: "4 x 6 in", deleted_at: null, sort_order: 1 },
      { category: "testing_lab", value: "SC Labs", label: "SC Labs (SC-000035 / AU-SC-000129)", deleted_at: null, sort_order: 1 },
      { category: "listing_category", value: "Flower", label: "Flower", deleted_at: null, sort_order: 1 },
    ],
    metrc_uploads: [],
    farms: [{ code: "PNN", display_name: "Penn North", deleted_at: null }],
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
    const row = (tables[table] ?? []).find((r) => r.id === id || r.code === id || r.key === id);
    if (!row) return;
    sets.forEach((col, i) => {
      row[col] = args[i];
    });
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
    if (q.startsWith("insert into")) {
      insert(sql, args);
      return { success: true };
    }
    if (q.startsWith("update ")) {
      updateById(sql, args);
      return { success: true };
    }
    if (q.includes("from farms") && q.includes("as value")) {
      return tables.farms
        .filter((f) => !f.deleted_at)
        .map((f) => ({ value: f.code, label: f.display_name }));
    }
    if (q.includes("from lookup_values") && q.includes("category = ?")) {
      return (tables.lookup_values ?? []).filter((r) => r.category === args[0] && !r.deleted_at);
    }
    if (q.includes("from audits") && q.includes("finished_at from audits")) {
      const rows = tables.audits
        .filter((a) => !a.deleted_at && a.kind === "internal" && a.finished_at)
        .sort((a, b) => String(b.finished_at).localeCompare(String(a.finished_at)));
      return rows[0] ? { finished_at: rows[0].finished_at } : null;
    }
    if (q.includes("from audits a") || (q.includes("from audits") && q.includes("kind = ?"))) {
      const kind = String(args[0] ?? "");
      const wantFinished = q.includes("finished_at is not null");
      return tables.audits
        .filter((a) => !a.deleted_at && (!kind || a.kind === kind) && (wantFinished ? Boolean(a.finished_at) : !a.finished_at))
        .map((a) => ({
          ...a,
          note_count: tables.audit_notes.filter((n) => n.audit_id === a.id && !n.deleted_at).length,
        }));
    }
    if (q.includes("select * from audits where id")) {
      return tables.audits.find((a) => a.id === args[0]) ?? null;
    }
    if (q.includes("from audit_notes")) {
      return tables.audit_notes.filter((n) => n.audit_id === args[0] && !n.deleted_at);
    }
    if (q.includes("from external_test_results") && q.includes("max(attempt)")) {
      const rows = tables.external_test_results.filter((r) => !r.deleted_at && r.sample_tag === args[0]);
      const m = rows.reduce((max, r) => Math.max(max, Number(r.attempt ?? 0)), 0);
      return { m: m || null };
    }
    if (q.includes("from external_test_results") && q.includes("finalized_potency")) {
      const rows = tables.external_test_results
        .filter((r) => !r.deleted_at && (r.source_metrc_tag === args[0] || r.sample_tag === args[0]) && r.finalized_potency != null)
        .sort((a, b) => Number(b.attempt ?? 0) - Number(a.attempt ?? 0));
      return rows[0] ?? null;
    }
    if (q.includes("from external_test_results")) {
      return tables.external_test_results.filter((r) => !r.deleted_at);
    }
    if (q.includes("from internal_test_results")) {
      return tables.internal_test_results.filter((r) => !r.deleted_at);
    }
    if (q.includes("from import_queue")) {
      return tables.import_queue.filter((r) => !r.deleted_at);
    }
    if (q.includes("from label_templates")) {
      if (q.includes("where id")) return tables.label_templates.find((r) => r.id === args[0]) ?? null;
      return tables.label_templates.filter((r) => !r.deleted_at);
    }
    if (q.includes("from suppliers")) {
      return tables.suppliers
        .filter((s) => !s.deleted_at)
        .map((s) => ({
          ...s,
          po_count: tables.purchase_orders.filter((p) => p.supplier_id === s.id && !p.deleted_at).length,
        }));
    }
    if (q.includes("from purchase_orders p") || q.includes("from purchase_orders")) {
      if (q.includes("where p.id") || q.includes("where id")) {
        const id = args[0];
        const p = tables.purchase_orders.find((r) => r.id === id && !r.deleted_at);
        if (!p) return null;
        const supplier = tables.suppliers.find((s) => s.id === p.supplier_id);
        return { ...p, supplier_name: supplier?.company_name ?? null, created_by_name: person.display_name };
      }
      if (q.includes("po_number like")) {
        return tables.purchase_orders.filter((p) => String(p.po_number).startsWith(String(args[0]).replace("%", "")));
      }
      return tables.purchase_orders
        .filter((p) => !p.deleted_at)
        .map((p) => ({
          ...p,
          supplier_name: tables.suppliers.find((s) => s.id === p.supplier_id)?.company_name ?? null,
          total_cents: tables.purchase_order_lines
            .filter((l) => l.purchase_order_id === p.id && !l.deleted_at)
            .reduce((s, l) => s + Number(l.qty) * Number(l.unit_price_cents), 0),
        }));
    }
    if (q.includes("from purchase_order_lines")) {
      return tables.purchase_order_lines.filter((l) => l.purchase_order_id === args[0] && !l.deleted_at);
    }
    if (q.includes("from listings")) {
      if (q.includes("where id")) return tables.listings.find((r) => r.id === args[0]) ?? null;
      return tables.listings.filter((r) => !r.deleted_at);
    }
    if (q.includes("from sales_orders")) {
      if (q.includes("so_number like")) {
        return tables.sales_orders.filter((o) => String(o.so_number).startsWith(String(args[0]).replace("%", "")));
      }
      if (q.includes("where id")) return tables.sales_orders.find((r) => r.id === args[0]) ?? null;
      return tables.sales_orders
        .filter((o) => !o.deleted_at)
        .map((o) => ({
          ...o,
          lines_label: tables.sales_order_lines
            .filter((l) => l.sales_order_id === o.id && !l.deleted_at)
            .map((l) => {
              const listing = tables.listings.find((x) => x.id === l.listing_id);
              return `${listing?.item_name ?? ""} ${l.qty_grams}`;
            })
            .join("; "),
        }));
    }
    if (q.includes("from sales_order_lines")) {
      return tables.sales_order_lines
        .filter((l) => l.sales_order_id === args[0] && !l.deleted_at)
        .map((l) => {
          const listing = tables.listings.find((x) => x.id === l.listing_id);
          return {
            ...l,
            item_name: listing?.item_name ?? "",
            package_tag: listing?.package_tag ?? null,
            package_label: listing?.package_label ?? null,
            category: listing?.category ?? null,
          };
        });
    }
    if (q.includes("from local_inventory_items")) {
      if (q.includes("p.id = c.parent_item_id")) {
        const parents = new Map<string, { id: string; parent_code: string; harvest_batch_id: string; newest_activity: string }>();
        for (const child of tables.local_inventory_items.filter((r) => r.parent_item_id && !r.deleted_at)) {
          const parent = tables.local_inventory_items.find((r) => r.id === child.parent_item_id && !r.deleted_at);
          if (!parent) continue;
          const lastUpload =
            (tables.metrc_uploads ?? [])
              .filter((u) => u.ref_id === parent.id && u.kind === "package_split" && !u.deleted_at)
              .map((u) => String(u.uploaded_at ?? ""))
              .sort()
              .pop() ?? "";
          const newest = String(child.created_at ?? "");
          if (newest > lastUpload) {
            parents.set(String(parent.id), {
              id: String(parent.id),
              parent_code: String(parent.package_code),
              harvest_batch_id: String(parent.harvest_batch_id ?? parent.id),
              newest_activity: newest,
            });
          }
        }
        return [...parents.values()];
      }
      if (q.includes("parent_item_id = ?")) {
        return tables.local_inventory_items.filter((r) => r.parent_item_id === args[0] && !r.deleted_at);
      }
      if (q.includes("sum(qty)")) {
        return tables.local_inventory_items
          .filter((r) => !r.deleted_at)
          .map((r) => ({ package_code: r.package_code, qty: r.qty }));
      }
      if (q.includes("select id, qty, deleted_at")) {
        return tables.local_inventory_items.map((r) => ({ id: r.id, qty: r.qty, deleted_at: r.deleted_at }));
      }
      return tables.local_inventory_items.filter((r) => !r.deleted_at);
    }
    if (q.includes("from metrc_uploads")) {
      return (tables.metrc_uploads ?? []).filter((u) => !u.deleted_at);
    }
    if (q.includes("from record_change_log")) {
      return tables.record_change_log.filter((l) => l.record_table === args[0] && l.record_id === args[1]);
    }
    if (q.includes("select * from")) {
      const m = sql.match(/select \* from (\w+) where id = \?/i);
      if (m) return (tables[m[1]] ?? []).find((r) => r.id === args[0]) ?? null;
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

function env(db: ReturnType<typeof makeBizDb>): Env {
  return {
    DB: db as unknown as D1Database,
    THEME: "grip",
    ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) } as unknown as Env["ASSETS"],
  };
}

function fd(fields: Record<string, string | string[]>): FormData {
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

describe("compliance KPIs", () => {
  it("converts grams to lbs at 448 with two decimals and comma grouping", () => {
    expect(GRAMS_PER_LB).toBe(448);
    expect(gramsToLbs(448)).toBe(1);
    expect(gramsToLbs(50)).toBe(0.11);
    expect(formatLbs(1234.56)).toBe("2.76");
    expect(formatLbs(448000)).toBe("1,000.00");
    const live = lbsInTesting([{ net_weight_grams: 448 }], [999]);
    expect(live.source).toBe("external");
    expect(live.grams).toBe(448);
    expect(live.lbs).toBe(1);
    const fallback = lbsInTesting([], [448, 448]);
    expect(fallback.source).toBe("queue");
    expect(fallback.lbs).toBe(2);
  });

  it("builds a pareto from comma-split failure modes, largest first", () => {
    const rows = paretoFromFailures(["Coliforms, Heavy Metals", "Coliforms", "Pesticides"]);
    expect(rows[0]?.mode).toBe("Coliforms");
    expect(rows[0]?.pct).toBe(50);
    expect(rows.map((r) => r.pct).reduce((s, n) => s + n, 0)).toBe(100);
  });

  it("FTQ uses only attempt 1 and ignores later passes", () => {
    const ftq = ftqRate([
      { sample_tag: "A", attempt: 1, status: "Passed" },
      { sample_tag: "B", attempt: 1, status: "Failed" },
      { sample_tag: "B", attempt: 2, status: "Passed" },
      { sample_tag: "C", attempt: 2, status: "Passed" },
    ]);
    expect(ftq.n).toBe(2);
    expect(ftq.passed).toBe(1);
    expect(ftq.rate).toBe(50);
  });

  it("flips the internal-audit interval", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    const fresh = auditUpToDate("2026-09-01T12:00:00.000Z", 30, now);
    expect(fresh.upToDate).toBe(true);
    const stale = auditUpToDate("2026-07-01T12:00:00.000Z", 30, now);
    expect(stale.upToDate).toBe(false);
    expect(stale.daysSince).toBeGreaterThan(30);
    expect(auditUpToDate(null, 30, now).upToDate).toBe(false);
  });

  it("renders the four KPI tiles", () => {
    const html = complianceMenuPage({
      lbs: { grams: 448, lbs: 1, source: "external" },
      pareto: [{ mode: "Coliforms", count: 1, pct: 100 }],
      ftq: { rate: 50, passed: 1, n: 2 },
      audit: { upToDate: false, daysSince: 40, newestFinishedAt: "2026-07-26T00:00:00.000Z" },
    });
    expect(html).toContain("data-kpi=\"lbs\"");
    expect(html).toContain("1.00");
    expect(html).toContain("Coliforms");
    expect(html).toContain("50.0%");
    expect(html).toContain("n=2");
    expect(html).toContain("kpi-no");
    expect(html).toContain("40");
  });
});

describe("audit notes and finish", () => {
  it("adds a note, renders pencil and x, finishes into the finished table", async () => {
    const db = makeBizDb();
    const started = await startAudit(db as unknown as D1Database, fd({ kind: "external", agency: "CRA", grip_rep: "dev" }));
    const auditId = started.redirect.split("audit=")[1];
    expect(auditId).toBeTruthy();
    const added = await addAuditNote(db as unknown as D1Database, auditId, fd({ body: "ride along one", rapid_add: "1" }));
    expect(added.redirect).toContain("rapid=1");
    const note = db.tables.audit_notes[0];
    expect(note?.body).toBe("ride along one");
    const open = db.tables.audits[0];
    const html = auditsPage(
      "external",
      [{ id: String(open.id), kind: "external", agency: "CRA", agency_contact: null, grip_rep: "dev", started_at: "t", finished_at: null, note_count: 1 }],
      [],
      { id: String(open.id), kind: "external", agency: "CRA", agency_contact: null, grip_rep: "dev", started_at: "t", finished_at: null },
      [{ id: String(note.id), audit_id: auditId, body: "ride along one", created_at: "t" }],
      "dev",
      true,
      "en"
    );
    expect(html).toContain("Ride along notes");
    expect(html).toContain(`/record/audit_notes/${String(note.id)}/edit`);
    expect(html).toContain(`/record/audit_notes/${String(note.id)}/void`);
    expect(html).toContain("Finish");
    expect(html).toContain("data-rapid-focus");
    await finishAudit(db as unknown as D1Database, auditId, fd({}));
    expect(db.tables.audits[0]?.finished_at).toBeTruthy();
    const finishedHtml = auditsPage(
      "external",
      [],
      [{ id: auditId, kind: "external", agency: "CRA", agency_contact: null, grip_rep: "dev", started_at: "t", finished_at: "done", note_count: 1 }],
      null,
      [],
      "dev",
      false,
      "en"
    );
    expect(finishedHtml).toContain("CRA");
    expect(finishedHtml).toContain("<td>1</td>");
  });
});

describe("labels, Code 128, and QR", () => {
  it("encodes HI with Start B and checksum 20", () => {
    const enc = encodeCode128("HI");
    expect(enc.codes[0]).toBe(CODE128_START_B);
    expect(enc.codes).toEqual([104, 40, 41, 20]);
    expect(enc.checksum).toBe(20);
    expect(enc.bits.startsWith("0000000000")).toBe(true);
    expect(enc.bits.endsWith("0000000000")).toBe(true);
    expect(CODE128_PATTERNS[104]).toBeTruthy();
  });

  it("encodes a METRC 1A tag and keeps a valid checksum", () => {
    const tag = "1A405010000000000000001";
    const enc = encodeCode128(tag);
    let weighted = enc.codes[0];
    for (let i = 1; i < enc.codes.length - 1; i++) weighted += enc.codes[i] * i;
    expect(enc.checksum).toBe(weighted % 103);
    expect(enc.codes[enc.codes.length - 1]).toBe(enc.checksum);
  });

  it("wires the vendored QR encoder", () => {
    expect(qrVendorWired()).toBe(true);
  });

  it("saves a template and prints at stock mm with a barcode svg", async () => {
    const db = makeBizDb();
    const form = fd({ name: "4x6 floor", stock: "4x6", barcode_mode: "1d" });
    form.append("field", "package_tag");
    form.append("field", "tag_barcode");
    const saved = await saveLabelTemplate(db as unknown as D1Database, form);
    expect(saved.redirect).toContain("/compliance/labels");
    const tpl = db.tables.label_templates[0];
    expect(tpl?.width_mm).toBe(101.6);
    expect(tpl?.height_mm).toBe(152.4);
    const print = labelPrintHtml(
      {
        id: String(tpl.id),
        name: String(tpl.name),
        width_mm: Number(tpl.width_mm),
        height_mm: Number(tpl.height_mm),
        fields_json: String(tpl.fields_json),
      },
      {
        id: "pkg1",
        tag: "1A405010000000000000001",
        item_or_strain: "Gelato",
        potency: "22.1",
        net_weight_grams: 448,
        packaged_date: "2026-09-04",
        license_number: "AU-P-000694",
        facility_name: "PNN",
      }
    );
    expect(print).toContain("@page { size: 101.6mm 152.4mm; margin: 0; }");
    expect(print).toContain("<svg");
    expect(print).toContain("class=\"code128\"");
    expect(serializeLabelFields({ fields: ["package_tag"], barcode_mode: "1d" })).toContain("package_tag");
  });
});

describe("instrument CSV parsers", () => {
  it("parses OP by aliases, skips empty keys, and refuses a file with no key", () => {
    const hit = parseOrangePhotonicsCsv("Sample,Date,THC,CBD\n1A1,2026-09-01,22.5,0.4\n,2026-09-01,1,1\n");
    expect(hit.error).toBeUndefined();
    expect(hit.parsed).toBe(1);
    expect(hit.skipped).toBe(1);
    expect(hit.rows).toHaveLength(2);
    expect(hit.rows[0]?.analyte).toBe("THC");
    const miss = parseOrangePhotonicsCsv("foo,bar\n1,2\n");
    expect(miss.error).toContain("Looked for:");
    expect(miss.error).toContain("tag");
  });

  it("parses Aqualab water activity and reports skips", () => {
    const hit = parseAqualabCsv("Package,Test Date,aW\nHBN1,2026-09-01,0.55\n,2026-09-01,0.6\n");
    expect(hit.parsed).toBe(1);
    expect(hit.skipped).toBe(1);
    expect(hit.rows[0]?.analyte).toBe("water_activity");
    expect(hit.rows[0]?.hbn).toBe("HBN1");
  });

  it("writes import_queue then internal rows", async () => {
    const db = makeBizDb();
    const form = fd({ source: "orange_photonics" });
    form.set("file", new File([new TextEncoder().encode("tag,date,THC\n1A9,2026-09-01,18.2\n")], "op.csv", { type: "text/csv" }));
    const result = await queueInstrumentImport(db as unknown as D1Database, form);
    expect(result.redirect).toContain("ok=parsed");
    expect(result.redirect).toContain("parsed=1");
    expect(db.tables.import_queue).toHaveLength(1);
    expect(db.tables.import_queue[0]?.notes).toBe("orange_photonics");
    expect(db.tables.internal_test_results).toHaveLength(1);
    expect(db.tables.internal_test_results[0]?.analyte).toBe("THC");
  });
});

describe("external results, FTQ, and purchasing", () => {
  it("assigns later attempts and keeps FTQ on attempt 1", async () => {
    const db = makeBizDb();
    await saveExternalResult(
      db as unknown as D1Database,
      fd({ sample_tag: "S1", attempt: "1", status: "Failed", failure_mode: "Coliforms", reason: "lab entry" })
    );
    await saveExternalResult(
      db as unknown as D1Database,
      fd({ sample_tag: "S1", attempt: "1", status: "Passed", reason: "retest" })
    );
    expect(db.tables.external_test_results.map((r) => r.attempt)).toEqual([1, 2]);
    const ftq = ftqRate(
      db.tables.external_test_results.map((r) => ({
        sample_tag: String(r.sample_tag),
        attempt: Number(r.attempt),
        status: r.status == null ? null : String(r.status),
      }))
    );
    expect(ftq.rate).toBe(0);
    const external = testingPage("external", [], { facility: "", status: "", year: "" });
    expect(external).not.toContain("Add external result");
    expect(external).not.toContain('action="/compliance/testing/external"');
    expect(external).toContain("data-lab-station-pointer");
  });

  it("mints PO-farm-yy-seq, totals cents, and walks draft to closed with eval", async () => {
    expect(mintPoNumber("PNN", 2026, 1)).toBe("PO-PNN-26-001");
    expect(formatUsd(123456)).toBe("$1,234.56");
    const db = makeBizDb();
    await addSupplier(db as unknown as D1Database, fd({ company_name: "Acme Supply", main_contact: "Pat" }));
    const supplierId = String(db.tables.suppliers[0]?.id);
    const created = await createPurchaseOrder(
      db as unknown as D1Database,
      fd({ name: "Harvest gear", supplier_id: supplierId, farm: "PNN", po_class: "23H" })
    );
    const poId = created.redirect.split("/").pop() ?? "";
    expect(String(db.tables.purchase_orders[0]?.po_number)).toMatch(/^PO-PNN-\d{2}-001$/);
    await addPoLine(db as unknown as D1Database, poId, fd({ description: "gloves", qty: "2", unit_price: "3.50" }));
    expect(poLinesTotalCents([{ id: "1", item_code: null, description: "gloves", uom: "each", qty: 2, unit_price_cents: 350 }])).toBe(700);
    await issuePurchaseOrder(db as unknown as D1Database, poId, fd({}));
    expect(db.tables.purchase_orders[0]?.status).toBe("open");
    await closePurchaseOrder(db as unknown as D1Database, poId, fd({ reason: "received" }));
    expect(db.tables.purchase_orders[0]?.status).toBe("closed");
    await savePoEval(db as unknown as D1Database, poId, fd({ eval_quality: "8", eval_documents: "7", eval_timing: "9", reason: "rubric" }));
    expect(db.tables.purchase_orders[0]?.eval_quality).toBe(8);
    const page = purchaseOrderPage(
      {
        id: poId,
        po_number: "PO-PNN-26-001",
        name: "Harvest gear",
        po_class: "23H",
        project: null,
        supplier_id: supplierId,
        supplier_name: "Acme Supply",
        status: "closed",
        issued_at: "t",
        closed_at: "t",
        created_at: "t",
        created_by_name: "dev",
        eval_quality: 8,
        eval_documents: 7,
        eval_timing: 9,
        eval_notes: null,
      },
      [{ id: "l1", item_code: null, description: "gloves", uom: "each", qty: 2, unit_price_cents: 350 }],
      [],
      false
    );
    expect(page).toContain("Supplier evaluation");
    expect(page).toContain("$7.00");
    expect(db.tables.suppliers[0]?.company_name).toBe("Acme Supply");
  });
});

describe("marketplace and reports", () => {
  it("reconciles listings both ways and walks an order to fulfilled", async () => {
    const tagInv = { qtyByTag: new Map([["1A1", 1000]]), itemsById: new Map<string, { qty: number; deleted: boolean }>() };
    expect(listingMatches({ package_tag: "1A1", qty_grams: 500 }, tagInv)).toBe(true);
    expect(listingMatches({ package_tag: "1A1", qty_grams: 1500 }, tagInv)).toBe(false);
    expect(listingMatches({ package_tag: "MISSING", qty_grams: 1 }, tagInv)).toBe(false);
    const linkInv = {
      qtyByTag: new Map<string, number>(),
      itemsById: new Map([
        ["inv1", { qty: 1000, deleted: false }],
        ["gone", { qty: 1000, deleted: true }],
      ]),
    };
    expect(listingMatches({ package_item_id: "inv1", qty_grams: 500 }, linkInv)).toBe(true);
    expect(listingMatches({ package_item_id: "inv1", qty_grams: 1500 }, linkInv)).toBe(false);
    expect(listingMatches({ package_item_id: "gone", qty_grams: 1 }, linkInv)).toBe(false);
    expect(listingMatches({ package_item_id: "missing", qty_grams: 1 }, linkInv)).toBe(false);
    const views = listingsWithMatch(
      [
        { id: "a", item_name: "Gelato", package_tag: "1A1", qty_grams: 500, listed: 1 },
        { id: "b", item_name: "Cake", package_tag: "1A9", qty_grams: 100, listed: 1 },
      ],
      tagInv
    );
    expect(views[0]?.matching).toBe(true);
    expect(views[1]?.matching).toBe(false);
    const html = marketplacePage(
      "listings",
      views,
      [],
      [{ id: "inv1", name: "Gelato", qty: 1000, kind: "FG" }],
      views,
      ["Gelato"],
      "en",
      { categories: [{ value: "Flower", label: "Flower" }] }
    );
    expect(html).toContain("Not matching");
    expect(html).toContain("data-match=\"no\"");
    expect(html).toContain("phone-table");
    expect(html).toContain('name="qty_grams"');
    expect(html).toContain('name="package_label"');
    expect(html).toContain('name="package_item_id"');
    expect(html).toContain('name="category"');
    expect(html).not.toContain('name="qty_lbs"');
    expect(html).not.toContain('name="package_tag"');
    expect(html).toContain("1.12");
    expect(html).toContain("500 g");
    expect(html).toContain("Internal package");
    expect(html).toContain("Admin\\Data Lookups\\Marketplace\\Listing Categories");
    expect(GRAMS_PER_LB).toBe(448);
    expect(formatLbs(GRAMS_PER_LB)).toBe("1.00");
    // THE SALESHELPER TAB (canon 0.30.45): the fourth tab, after Orders; its
    // pane frames the vendored form at the Fulfillment wrapper's path, with
    // the tab bar kept above it; an unknown pane falls back to Listings.
    expect(html).toContain('<a class="tab-link" href="/marketplace?pane=saleshelper" data-tab="saleshelper">SalesHelper</a>');
    expect(html.indexOf('data-tab="orders"')).toBeLessThan(html.indexOf('data-tab="saleshelper"'));
    expect(html).not.toContain("data-marketplace-saleshelper");
    const shHtml = marketplacePage("saleshelper", views, [], [], views, [], "en", {});
    expect(shHtml).toContain('<a class="tab-link tab-on" href="/marketplace?pane=saleshelper" data-tab="saleshelper" aria-current="page">SalesHelper</a>');
    expect(shHtml).toContain('<div class="saleshelper-embed saleshelper-embed-pane" data-marketplace-saleshelper>');
    expect(shHtml).toContain('<iframe class="saleshelper-frame" src="/fulfillment/saleshelper/app" title="SalesHelper"></iframe>');
    expect(shHtml).not.toContain("No listings yet.");
    expect(shHtml).not.toContain("New order");
    // THE SALESHELPER PANE SCROLLBARS (canon 0.30.49): the frame is fitted to
    // the viewport left under the tabs, floor 480px, so the page need not scroll.
    expect(shHtml).toContain('document.querySelector("[data-marketplace-saleshelper] iframe")');
    expect(shHtml).toContain("var below = Math.max(0, doc.scrollHeight - (rect.bottom + scrollY))");
    expect(shHtml).toContain("window.innerHeight - top - below");
    expect(shHtml).toContain('Math.max(480, Math.floor(room)) + "px"');
    expect(shHtml).toContain('window.addEventListener("resize", fit)');
    expect(salesHelperPaneHtml("es")).toContain('title="SalesHelper"');
    expect(parseMarketplacePane("saleshelper")).toBe("saleshelper");
    expect(parseMarketplacePane("zoho")).toBe("zoho");
    expect(parseMarketplacePane("orders")).toBe("orders");
    expect(parseMarketplacePane("nothing")).toBe("listings");
    expect(parseMarketplacePane(undefined)).toBe("listings");
    // Patrick 2026-09-11 (canon 0.30.37): the split [+] guard shares THE
    // OVERISSUE LINE IS STRICT with the trim room; exactly the parent is clean.
    const splitHtml = marketplacePage(
      "listings",
      views,
      [],
      [{ id: "inv1", name: "Gelato", qty: 1000, kind: "FG" }],
      views,
      ["Gelato"],
      "en",
      {
        categories: [{ value: "Flower", label: "Flower" }],
        splitParent: { id: "inv1", name: "Gelato", package_code: "1A1", qty: 1000 },
        splitChildren: [],
      }
    );
    expect(splitHtml).toContain('data-balance-remaining="1000"');
    expect(splitHtml).toContain("w > remaining + 0.005");
    expect(splitHtml).not.toContain("w >= remaining");

    const db = makeBizDb();
    db.tables.local_inventory_items.push({
      id: "inv1",
      package_code: "1A1",
      item_kind: "FG",
      strain_name: "Gelato",
      qty: 1000,
      deleted_at: null,
    });
    await addListing(
      db as unknown as D1Database,
      fd({ item_name: "Gelato", package_item_id: "inv1", package_label: "Gelato bag", category: "Flower", qty_grams: "500" })
    );
    expect(db.tables.listings[0]?.package_tag).toBeNull();
    expect(db.tables.listings[0]?.package_label).toBe("Gelato bag");
    expect(db.tables.listings[0]?.category).toBe("Flower");
    const listingId = String(db.tables.listings[0]?.id);
    const so = await createSalesOrder(db as unknown as D1Database, fd({ buyer: "Leaf buyer", listing_id: listingId, qty_grams: "1" }));
    expect(mintSoNumber(2026, 1)).toBe("SO-26-001");
    const soId = so.redirect.split("/").pop() ?? "";
    await stepSalesOrder(db as unknown as D1Database, soId, fd({ status: "confirmed", reason: "ok" }));
    await stepSalesOrder(db as unknown as D1Database, soId, fd({ status: "fulfilled", reason: "shipped" }));
    expect(db.tables.sales_orders[0]?.status).toBe("fulfilled");
    expect(db.tables.local_inventory_items[0]?.qty).toBe(1000);
  });

  it("splits an FG parent, decrements qty, pends package_split, and logs inv_split", async () => {
    expect(splitChildCode("1A1", 1)).toBe("1A1-S1");
    expect(SPLIT_CSV_HEADER).toBe("ParentLabel,ChildLabel,Quantity,UnitOfWeight,Date");
    const db = makeBizDb();
    db.tables.local_inventory_items.push({
      id: "parent-1",
      item_kind: "FG",
      package_code: "1A1",
      harvest_batch_id: null,
      wet_weight_entry_id: null,
      wip_package_id: null,
      strain_id: null,
      qty: 1000,
      uom: "g",
      farm_code: "PNN",
      license_value: "AU-G-C-000832",
      location: "BARN",
      parent_item_id: null,
      deleted_at: null,
    });
    const result = await splitPackage(
      db as unknown as D1Database,
      fd({ parent_item_id: "parent-1", child_qty_grams: "250" })
    );
    expect(result.redirect).toContain("split=parent-1");
    const child = db.tables.local_inventory_items.find((r) => r.parent_item_id === "parent-1");
    expect(child?.package_code).toBe("1A1-S1");
    expect(Number(child?.qty)).toBe(250);
    expect(Number(db.tables.local_inventory_items[0]?.qty)).toBe(750);
    expect(db.tables.record_change_log.some((l) => l.reason === SYSTEM_REASON.inv_split)).toBe(true);
    const pending = await listPendingSplitUploads(db as unknown as D1Database);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe("parent-1");
    const uploads = pendingUploadsPage([], "en", [], [], [], pending);
    expect(uploads).toContain("Splits");
    expect(uploads).toContain("Package split");
    expect(uploads).toContain("/admin/uploads/package_split/parent-1.csv");
  });

  it("Sales Order Status reads orders and the two live reports carry format lanes", () => {
    const soView = salesOrdersView(
      salesOrderReportRows([
        {
          so_number: "SO-26-001",
          buyer: "Leaf buyer",
          status: "fulfilled",
          created_at: "2026-09-01T00:00:00.000Z",
          lines_label: "Gelato 33",
          qty_grams: 448,
        },
      ], new Date("2026-09-04T00:00:00.000Z"))
    );
    expect(soView.rows[0]?.so_number).toBe("SO-26-001");
    expect(soView.rows[0]?.aged_days).toBe(3);
    expect(reportCsv(soView)).toContain("SO-26-001");
    const audits = externalAuditsView([
      {
        agency: "CRA",
        agency_contact: "Lee",
        grip_rep: "dev",
        started_at: "2026-09-01",
        finished_at: "2026-09-02",
        note_count: 1,
        notes: "ride along one",
      },
    ]);
    expect(reportCsv(audits)).toContain("CRA");
    expect(reportXlsx(audits).byteLength).toBeGreaterThan(20);
    expect(reportPdfHtml(audits, "", "Grip", "stamp")).toContain("ride along one");
    const internal = internalTestingView(
      collapseInternalTesting([
        {
          hbn: "HBN1",
          source: "aqualab",
          analyte: "water_activity",
          value: 0.55,
          tested_at: "2026-09-02",
          created_at: "2026-09-02",
          entry_date: "2026-08-01",
        },
        {
          hbn: "HBN1",
          source: "orange_photonics",
          analyte: "THC",
          value: 22.5,
          tested_at: "2026-09-03",
          created_at: "2026-09-03",
          entry_date: "2026-08-01",
        },
      ])
    );
    expect(internal.rows[0]).toMatchObject({ hbn: "HBN1", harvest_date: "2026-08-01", aw: "0.55", potency: "22.5" });
    expect(reportCsv(internal)).toContain("HBN1");
    const rf = rfReportView();
    expect(rf.reserved).toBe(true);
    const rfPage = reportPage(rf, "", "", "en");
    expect(rfPage).toContain("RF report: reserved");
    expect(rfPage).not.toContain("format-bar");
    expect(rfPage).not.toContain("format=csv");
  });
});

describe("PIN gates for the new nodes", () => {
  it("gates compliance, purchasing, and marketplace and leaves reports open", async () => {
    const db = makeBizDb();
    const locked = await app.request("/compliance", {}, env(db));
    expect(locked.status).toBe(401);
    expect(await locked.text()).toContain("Enter PIN");
    expect((await app.request("/purchasing", {}, env(db))).status).toBe(401);
    expect((await app.request("/marketplace", {}, env(db))).status).toBe(401);
    const headers = { cookie: "gf_pin=21319" };
    const open = await app.request("/compliance", { headers }, env(db));
    expect(open.status).toBe(200);
    expect(await open.text()).toContain("Lbs in testing");
    expect((await app.request("/purchasing", { headers }, env(db))).status).toBe(200);
    expect((await app.request("/marketplace", { headers }, env(db))).status).toBe(200);
    const reports = await app.request("/reports", {}, env(db));
    expect(reports.status).toBe(200);
    expect(await reports.text()).not.toContain("Enter PIN");
    const rf = await app.request("/reports/rf?format=csv", {}, env(db));
    expect(rf.status).toBe(200);
    expect(rf.headers.get("content-type") ?? "").toContain("text/html");
    expect(await rf.text()).toContain("RF report: reserved");
  });
});
