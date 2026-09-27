import { describe, expect, it } from "vitest";
import { formatRunClock } from "../src/drying";
import { listDryingComplete, type DryingCompleteRow } from "../src/db";
import { dryingRunAverage, dryingRunSeconds, dryingSchedulingPage } from "../src/scheduling";
import { migratedDb, seedBatch } from "./migrated";

// THE RUN (canon 0.30.248; owner, 2026-09-26: "is it possible to see on the "complete" pane in the silos screen to see
// how long they ran according to timestamps?"; his picks "Unload finished (Recommended)" and "Yes, add the average").
const SILO_1 = "a1000001-0001-4000-8000-000000000001";

function row(over: Partial<DryingCompleteRow> & Pick<DryingCompleteRow, "lot_id">): DryingCompleteRow {
  return {
    status: "unloaded",
    truck_number: null,
    weight_grams: 1000,
    dry_weight_grams: 250,
    space_id: "s1",
    space_name: "Silo 1",
    space_type: "silo",
    shape: null,
    hbn: "26268-PNN-GH-001-0-NA-26101",
    metrc_harvest_tag: null,
    farm_code: "PNN",
    strain_label: "Fruity Pebbles",
    package_code: null,
    finished_at: "2026-09-25T13:14:00.000Z",
    effective_date: "2026-09-25",
    ended_at: "2026-09-25T13:14:00.000Z",
    run_loaded_at: "2026-09-24T12:00:00.000Z",
    run_started_at: "2026-09-24T12:00:00.000Z",
    run_paused_at: null,
    run_paused_seconds: 0,
    run_ended_at: "2026-09-25T13:14:00.000Z",
    ...over,
  };
}

describe("THE RUN ON THE COMPLETE PANE (canon 0.30.248)", () => {
  it("reads days, hours and minutes", () => {
    expect(formatRunClock(0)).toBe("0d 00:00");
    expect(formatRunClock(89_040)).toBe("1d 00:44");
    expect(formatRunClock(59.9)).toBe("0d 00:00");
    expect(formatRunClock(-5)).toBe("0d 00:00");
  });

  it("the run is the loaded time to the unload's finish less the banked pauses, frozen when it ended paused", () => {
    // 25 h 14 m from loaded to the finish, 30 m banked: 24 h 44 m.
    expect(dryingRunSeconds(row({ lot_id: "a", run_paused_seconds: 1800 }))).toBe(89_040);
    // Ended while paused: the clock stood at the pause.
    expect(dryingRunSeconds(row({ lot_id: "b", run_paused_at: "2026-09-25T10:00:00.000Z" }))).toBe(79_200);
    // No ended load, or no readable time: no run.
    expect(dryingRunSeconds(row({ lot_id: "c", run_ended_at: null }))).toBeNull();
    expect(dryingRunSeconds(row({ lot_id: "d", run_loaded_at: "", run_started_at: null }))).toBeNull();
    expect(dryingRunAverage([row({ lot_id: "a", run_paused_seconds: 1800 }), row({ lot_id: "b", run_paused_at: "2026-09-25T10:00:00.000Z" }), row({ lot_id: "c", run_ended_at: null })])).toBe(84_120);
    expect(dryingRunAverage([row({ lot_id: "c", run_ended_at: null })])).toBeNull();
  });

  it("each Complete row reads its run and each space's heading its average", () => {
    const complete = [
      row({ lot_id: "a", run_paused_seconds: 1800 }),
      row({ lot_id: "b", run_paused_at: "2026-09-25T10:00:00.000Z", finished_at: "2026-09-25T12:00:00.000Z", ended_at: "2026-09-25T12:00:00.000Z", run_ended_at: "2026-09-25T12:00:00.000Z" }),
      row({ lot_id: "c", run_ended_at: null, run_loaded_at: null, run_started_at: null }),
      row({ lot_id: "r", space_id: "arl", space_name: "Arlington Dry Room", space_type: "dry_room" }),
    ];
    const page = dryingSchedulingPage({ stage: "silos", lots: [], live: [], complete, nowIso: "2026-09-26T16:00:00.000Z", farmDayStart: 6 });
    const pane = page.slice(page.indexOf('data-schedule-pane="complete"'));
    expect(pane).toContain('<span class="muted" data-run-seconds="89040">Ran 1d 00:44</span>');
    expect(pane).toContain('<span class="muted" data-run-seconds="79200">Ran 0d 22:00</span>');
    const lotC = pane.slice(pane.indexOf('data-drying-lot="c"'), pane.indexOf("</li>", pane.indexOf('data-drying-lot="c"')));
    expect(lotC).not.toContain("data-run-seconds");
    expect(pane).toContain('Silo 1 <span class="tile-count">3</span> <span class="muted" data-run-average="84120">average 0d 23:22</span></h3>');
    // The dry room is not a silo: it stands on the Dry Rooms surface, not here.
    expect(pane).not.toContain('data-drying-lot="r"');
    const es = dryingSchedulingPage({ stage: "silos", lots: [], live: [], complete, nowIso: "2026-09-26T16:00:00.000Z", farmDayStart: 6, locale: "es" });
    expect(es).toContain("Duró 1d 00:44");
    expect(es).toContain("promedio 0d 23:22");
    // A space with no readable run reads no average.
    const bare = dryingSchedulingPage({ stage: "silos", lots: [], live: [], complete: [row({ lot_id: "c", run_ended_at: null })], nowIso: "2026-09-26T16:00:00.000Z" });
    expect(bare).not.toContain("data-run-average");
  });

  it("listDryingComplete carries the latest ended load's clock", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-a", hbn: "26268-PNN-GH-001-0-NA-26111", serial: 511, farm: "PNN" });
    const now = Date.now();
    const at = (h: number) => new Date(now - h * 3_600_000).toISOString();
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, dry_weight_grams, actual_dryspc, status, created_at, updated_at)
       VALUES ('lot-a', 'hb-a', 1000, 250, ?, 'unloaded', ?, ?)`,
      SILO_1,
      at(30),
      at(2)
    );
    // An earlier load ended by a move, then the load that ran to the unload.
    m.run(
      `INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, started_at, paused_seconds, ended_at, created_at, updated_at)
       VALUES ('L0', ?, 'lot-a', ?, ?, 0, ?, ?, ?)`,
      SILO_1,
      at(30),
      at(30),
      at(29),
      at(30),
      at(29)
    );
    m.run(
      `INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, started_at, paused_seconds, ended_at, created_at, updated_at)
       VALUES ('L1', ?, 'lot-a', ?, ?, 600, ?, ?, ?)`,
      SILO_1,
      at(28),
      at(28),
      at(2),
      at(28),
      at(2)
    );
    m.run(
      `INSERT INTO unload_sessions (id, wet_weight_entry_id, weigh_mode, finished_at, effective_date, created_at, updated_at)
       VALUES ('us-a', 'lot-a', 'bucked', ?, ?, ?, ?)`,
      at(2),
      at(2).slice(0, 10),
      at(3),
      at(2)
    );
    const rows = await listDryingComplete(m.db, at(24 * 7));
    const lot = rows.find((r) => r.lot_id === "lot-a");
    expect(lot?.run_loaded_at).toBe(at(28));
    expect(lot?.run_ended_at).toBe(at(2));
    expect(Number(lot?.run_paused_seconds)).toBe(600);
    // 26 hours less the ten banked minutes.
    expect(dryingRunSeconds(lot as DryingCompleteRow)).toBe(26 * 3600 - 600);
  });
});
