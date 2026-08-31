import { describe, expect, it } from "vitest";
import {
  ACCESS_EMAIL_HEADER,
  DEV_FALLBACK_EMAIL,
  displayNameFromEmail,
  normalizeEmail,
  safeNextPath,
} from "../src/identity";
import { pinPage, stationPage, type StationLedgerCtx } from "../src/html";
import { EDITABLE_FIELDS, queueByKey, stationByKey, type QueueDef } from "../src/pipeline";
import type { PersonRow, QueueRow } from "../src/db";

describe("identity from the Access login email (owner ruling 2026-08-31)", () => {
  it("names the Access header and the dev fallback", () => {
    expect(ACCESS_EMAIL_HEADER).toBe("Cf-Access-Authenticated-User-Email");
    expect(DEV_FALLBACK_EMAIL).toBe("dev@local");
  });

  it("normalizes emails for the unique lookup", () => {
    expect(normalizeEmail("  Wallace@GripCannabis.com ")).toBe("wallace@gripcannabis.com");
    expect(normalizeEmail("")).toBe("");
  });

  it("derives a first-login display name from the local part", () => {
    expect(displayNameFromEmail("wallace@gripcannabis.com")).toBe("wallace");
    expect(displayNameFromEmail("dev@local")).toBe("dev");
    expect(displayNameFromEmail("@odd")).toBe("@odd");
  });

  it("people rows carry an editable email in Lookups", () => {
    const names = EDITABLE_FIELDS.people.map((f) => f.name);
    expect(names).toContain("email");
  });
});

describe("PIN gate page (owner ruling 2026-08-31)", () => {
  it("renders the form with the hidden next and no PIN value", () => {
    const html = pinPage("/admin/queues", "en");
    expect(html).toContain("Enter PIN");
    expect(html).toContain('action="/pin"');
    expect(html).toContain('<input type="hidden" name="next" value="/admin/queues">');
    expect(html).toContain('type="password" name="pin"');
    expect(html).not.toContain("21319");
    expect(html).not.toContain("Wrong PIN.");
  });

  it("shows the error banner on a wrong PIN, in both languages", () => {
    expect(pinPage("/admin", "en", true)).toContain("Wrong PIN.");
    expect(pinPage("/admin", "es", true)).toContain("PIN incorrecto.");
    expect(pinPage("/admin", "es")).toContain("Ingrese el PIN");
  });

  it("keeps unlock redirects on this site", () => {
    expect(safeNextPath("/admin/queues?x=1")).toBe("/admin/queues?x=1");
    expect(safeNextPath("/interco")).toBe("/interco");
    // Fulfillment sits behind the same gate (owner ruling 2026-08-31).
    expect(safeNextPath("/fulfillment/")).toBe("/fulfillment/");
    expect(safeNextPath("//evil.example")).toBe("/admin");
    expect(safeNextPath("https://evil.example")).toBe("/admin");
    expect(safeNextPath("")).toBe("/admin");
    expect(safeNextPath(null)).toBe("/admin");
  });
});

describe("station forms after the identity ruling (owner ruling 2026-08-31)", () => {
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const rows: QueueRow[] = [
    {
      id: "hb1",
      values: { hbn: "26244-ARL-GH-027-0-NA-26001", strain_name: "Fruity Pebbles", farm_code: "ARL" },
    },
  ];
  const queuesByKey: Record<string, QueueDef> = { hbn_queue: queueByKey("hbn_queue")! };
  const ledgerCtx: StationLedgerCtx = {
    farmName: "Arlington",
    moveToOptions: [{ value: "ds6", label: "Arlington Dry Room" }],
    resumeLots: [],
  };

  it("a station without personLabel renders no person picker", () => {
    const html = stationPage(stationByKey("acquire_hbn")!, people, "p1", {}, {}, queuesByKey);
    expect(html).not.toContain('name="person_id"');
    expect(html).not.toContain('name="lead_person_id"');
    expect(html).toContain("<form");
  });

  it("the wet weight Lead picker posts lead_person_id preselected to the login person", () => {
    const html = stationPage(
      stationByKey("wet_weight")!,
      people,
      "p1",
      {},
      { hbn_queue: rows },
      queuesByKey,
      "hb1",
      ledgerCtx
    );
    expect(html).toContain('<select name="lead_person_id" required>');
    expect(html).toContain('<option value="p1" selected>Pat</option>');
    expect(html).not.toContain('name="person_id"');
  });
});
