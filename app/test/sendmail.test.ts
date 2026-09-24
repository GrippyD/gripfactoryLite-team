import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import {
  base64Utf8,
  buildResendPayload,
  parseSendBody,
  RESEND_ENDPOINT,
  sendMailSubject,
  sendMailText,
  sendSalesOrderMail,
  SH_ATTACHMENT_CAP_BYTES,
  SH_MAIL_TO_DEFAULT,
  SH_SEND_GATE_KEY,
} from "../src/sendmail";

const ORDER = {
  orderNo: "SH-20260914-AB12",
  createdAt: "2026-09-14T20:00:00.000Z",
  orderDate: "2026-09-14",
  customer: "Michigan Green Life",
  license: "AU-R-000123",
  salesperson: "Nolan Reager",
  originLicense: "AU-R-001239",
  lines: [
    { lineKey: "BUD|cherry pop|O|20", label: "BUD · Cherry Pop · Outdoor · 20%", type: "BUD", qty: 40.3656, price: 180, total: 7265.81, allocations: [] },
    { lineKey: "BUD|gelato 41|O|23", label: "BUD · Gelato 41 · Outdoor · 23%", type: "BUD", qty: 19.853, price: 180, total: 3573.54, allocations: [] },
  ],
  subtotal: 10839.35,
  app: { canonVersion: "0.8.0", menuBuiltAt: "2026-09-14T15:51:51.064Z" },
};
const CSV = "SalesOrder Number,Order Date,Customer Name\r\nSH-20260914-AB12,2026-09-14,Michigan Green Life\r\n";
const BODY = { filename: "ZohoSO_SH-20260914-AB12.csv", csv: CSV, order: ORDER };

const decode = (b64: string): string => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

describe("THE SEND EMAIL (canon 0.30.65; SalesHelper canon 4b): the form's contract answered", () => {
  it("pins the SalesHelper's gate key and recipient", () => {
    expect(SH_SEND_GATE_KEY).toBe("grip-c4aba3e1d0320e1acb5d5716");
    expect(SH_MAIL_TO_DEFAULT).toBe("logistics@gripcannabis.com");
    expect(RESEND_ENDPOINT).toBe("https://api.resend.com/emails");
    expect(SH_ATTACHMENT_CAP_BYTES).toBe(2 * 1024 * 1024);
  });

  it("reads the POST body and refuses what is not an order, in words", () => {
    const parsed = parseSendBody(BODY);
    expect(parsed.filename).toBe("ZohoSO_SH-20260914-AB12.csv");
    expect(parsed.order).toMatchObject({ orderNo: "SH-20260914-AB12", customer: "Michigan Green Life", salesperson: "Nolan Reager", subtotal: 10839.35 });
    expect(parsed.order.lines).toHaveLength(2);
    expect(parsed.order.lines![0]).toEqual({ label: "BUD · Cherry Pop · Outdoor · 20%", qty: 40.3656, price: 180, total: 7265.81, type: "BUD" });
    const bad = (raw: unknown, words: string) => {
      try {
        parseSendBody(raw);
        throw new Error("expected a refusal");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(400);
        expect((err as HttpError).message).toContain(words);
      }
    };
    bad(null, "must be JSON");
    bad({ csv: CSV, order: ORDER }, "CSV filename");
    bad({ filename: "../evil.txt", csv: CSV, order: ORDER }, "CSV filename");
    bad({ filename: "x.csv", order: ORDER }, "CSV text");
    bad({ filename: "x.csv", csv: CSV }, "order record");
    bad({ filename: "x.csv", csv: CSV, order: { customer: "A" } }, "orderNo");
    bad({ filename: "x.csv", csv: CSV, order: { orderNo: "SH-1" } }, "customer");
  });

  it("writes the exact subject and a plain-text body naming both attachments", () => {
    expect(sendMailSubject(ORDER)).toBe("GRIP Sales Order SH-20260914-AB12 - Michigan Green Life");
    const text = sendMailText(parseSendBody(BODY).order, BODY.filename);
    expect(text).toContain("Sales order SH-20260914-AB12");
    expect(text).toContain("Customer: Michigan Green Life (AU-R-000123)");
    expect(text).toContain("BUD · Cherry Pop · Outdoor · 20% - 40.3656 @ $180.00 = $7,265.81");
    expect(text).toContain("Subtotal: $10,839.35");
    expect(text).toContain("Attached: ZohoSO_SH-20260914-AB12.csv (the Zoho Inventory import file) and order_SH-20260914-AB12.json (the order record).");
    expect(text).not.toMatch(/[\u2014\u2013]/);
  });

  it("builds the Resend payload with both attachments base64, the recipients split", () => {
    const payload = buildResendPayload({ from: "SalesHelper <orders@gripcannabis.com>", to: "logistics@gripcannabis.com, sales@gripcannabis.com", body: parseSendBody(BODY) });
    expect(payload.from).toBe("SalesHelper <orders@gripcannabis.com>");
    expect(payload.to).toEqual(["logistics@gripcannabis.com", "sales@gripcannabis.com"]);
    expect(payload.subject).toBe("GRIP Sales Order SH-20260914-AB12 - Michigan Green Life");
    expect(payload.attachments.map((a) => a.filename)).toEqual(["ZohoSO_SH-20260914-AB12.csv", "order_SH-20260914-AB12.json"]);
    expect(decode(payload.attachments[0].content)).toBe(CSV);
    const record = JSON.parse(decode(payload.attachments[1].content)) as { orderNo: string; lines: unknown[] };
    expect(record.orderNo).toBe("SH-20260914-AB12");
    expect(record.lines).toHaveLength(2);
    // The size law fails loudly.
    const huge = { ...BODY, csv: "x".repeat(SH_ATTACHMENT_CAP_BYTES + 1) };
    expect(() => buildResendPayload({ from: "a@b.c", to: "d@e.f", body: parseSendBody(huge) })).toThrow(/attachment cap/);
    expect(() => buildResendPayload({ from: "a@b.c", to: " , ", body: parseSendBody(BODY) })).toThrow(/saleshelper_mail_to is blank/);
    // UTF-8 survives the base64 round trip, long strings too.
    const long = "Gelato 41 · Outdoor ✕ ".repeat(20000);
    expect(decode(base64Utf8(long))).toBe(long);
  });

  it("answers 503 while unconfigured, 502 when the provider refuses, the id when it accepts", async () => {
    const body = parseSendBody(BODY);
    await expect(sendSalesOrderMail({ apiKey: undefined, from: "a@b.c", to: null, body })).rejects.toMatchObject({ status: 503, message: expect.stringContaining("RESEND_API_KEY") });
    await expect(sendSalesOrderMail({ apiKey: "re_test", from: "", to: null, body })).rejects.toMatchObject({ status: 503, message: expect.stringContaining("saleshelper_mail_from") });
    const calls: { url: string; init: RequestInit }[] = [];
    const accept: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const sent = await sendSalesOrderMail({ apiKey: "re_test_key", from: "SalesHelper <orders@gripcannabis.com>", to: null, body, fetchImpl: accept });
    expect(sent).toEqual({ id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794", to: ["logistics@gripcannabis.com"] });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(RESEND_ENDPOINT);
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    const posted = JSON.parse(String(calls[0].init.body)) as { to: string[]; subject: string; attachments: unknown[] };
    expect(posted.to).toEqual(["logistics@gripcannabis.com"]);
    expect(posted.subject).toBe("GRIP Sales Order SH-20260914-AB12 - Michigan Green Life");
    expect(posted.attachments).toHaveLength(2);
    const refuse: typeof fetch = async () => new Response(JSON.stringify({ message: "Domain is not verified" }), { status: 403 });
    await expect(sendSalesOrderMail({ apiKey: "re_test_key", from: "a@b.c", to: null, body, fetchImpl: refuse })).rejects.toMatchObject({ status: 502, message: expect.stringContaining("Domain is not verified") });
    const down: typeof fetch = async () => {
      throw new Error("connect ECONNREFUSED");
    };
    await expect(sendSalesOrderMail({ apiKey: "re_test_key", from: "a@b.c", to: null, body, fetchImpl: down })).rejects.toMatchObject({ status: 502, message: expect.stringContaining("unreachable") });
  });
});
