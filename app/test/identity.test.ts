import { describe, expect, it } from "vitest";
import {
  ACCESS_EMAIL_HEADER,
  DEV_FALLBACK_EMAIL,
  PHONE_LOGIN_DOMAIN_DEFAULT,
  PHONE_REFUSAL,
  displayNameFromEmail,
  normalizeEmail,
  normalizePhone,
  phoneFromIdentity,
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

  // THE PHONE LOGIN (canon 0.30.127; owner: "make the cloudflare login keyed
  // to a cell phone number instead of an email address").
  it("stores a phone as +E.164, the US country code assumed on ten digits", () => {
    expect(normalizePhone("(269) 555-0100")).toBe("+12695550100");
    expect(normalizePhone("269.555.0100")).toBe("+12695550100");
    expect(normalizePhone("+1 269 555 0100")).toBe("+12695550100");
    expect(normalizePhone("12695550100")).toBe("+12695550100");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("1234567890123456")).toBeNull();
  });

  it("reads the phone out of the identity provider's synthetic address, or a bare phone, and nothing out of an email", () => {
    expect(PHONE_LOGIN_DOMAIN_DEFAULT).toBe("phone.gripcannabis.com");
    expect(phoneFromIdentity("2695550100@phone.gripcannabis.com", PHONE_LOGIN_DOMAIN_DEFAULT)).toBe("+12695550100");
    expect(phoneFromIdentity("12695550100@Phone.GripCannabis.com", PHONE_LOGIN_DOMAIN_DEFAULT)).toBe("+12695550100");
    expect(phoneFromIdentity("+12695550100", PHONE_LOGIN_DOMAIN_DEFAULT)).toBe("+12695550100");
    expect(phoneFromIdentity("2695550100", PHONE_LOGIN_DOMAIN_DEFAULT)).toBe("+12695550100");
    expect(phoneFromIdentity("wallace@gripcannabis.com", PHONE_LOGIN_DOMAIN_DEFAULT)).toBeNull();
    expect(phoneFromIdentity("2695550100@gripcannabis.com", PHONE_LOGIN_DOMAIN_DEFAULT)).toBeNull();
    expect(phoneFromIdentity("notaphone@phone.gripcannabis.com", PHONE_LOGIN_DOMAIN_DEFAULT)).toBeNull();
    expect(phoneFromIdentity("dev@local", PHONE_LOGIN_DOMAIN_DEFAULT)).toBeNull();
    expect(phoneFromIdentity("2695550100@phone.example.com", "phone.example.com")).toBe("+12695550100");
    expect(phoneFromIdentity("2695550100@phone.gripcannabis.com", "")).toBeNull();
  });

  it("people rows carry the login phone in Lookups, and the refusals speak", () => {
    const phone = EDITABLE_FIELDS.people.find((f) => f.name === "phone");
    expect(phone).toEqual({ name: "phone", label: "Phone (login)", input: "text" });
    expect(PHONE_REFUSAL.shape).toBe("Phone must be ten digits (US) or a + country code and number.");
    expect(PHONE_REFUSAL.taken).toBe("That phone is already on another person.");
    expect(PHONE_REFUSAL.unmapped).toBe("This phone is not on the People list");
  });

  it("the lot's Team Lead is a reasoned text edit; the Supervisor is never a field (canon 0.30.67)", () => {
    const fields = EDITABLE_FIELDS.wet_weight_entries;
    expect(fields.find((f) => f.name === "team_lead")).toEqual({ name: "team_lead", label: "Team Lead", input: "text" });
    expect(fields.find((f) => f.name === "lead_person_id")).toBeUndefined();
    expect(fields.find((f) => /supervisor/i.test(f.name))).toBeUndefined();
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

  it("the wet weight header shows the login as Supervisor and takes the Team Lead by hand (canon 0.30.67)", () => {
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
    // THE SUPERVISOR AND THE TEAM LEAD (owner, 2026-09-14, verbatim: "Minted
    // HBNs are passing the Team Lead definition from the cloudflare login email
    // to the wet weight screen.  Let's make all "Supervisors" the email, the
    // team lead should be hand entered"): no picker preselected to the login.
    expect(html).not.toContain('name="lead_person_id"');
    expect(html).not.toContain('<option value="p1" selected>Pat</option>');
    expect(html).toContain('<p class="muted supervisor-line" data-supervisor>Supervisor: Pat</p>');
    expect(html).toContain('<input type="text" name="team_lead" required autocomplete="off" data-team-lead data-keep-operator>');
    expect(html).toContain("Team Lead is the harvest crew lead on this lot, typed by hand.");
    expect(html).not.toContain('name="person_id"');
  });
});
