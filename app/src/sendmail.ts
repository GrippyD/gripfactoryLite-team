/**
 * THE SEND EMAIL (canon 0.30.65; SalesHelper canon 4b, v0.8.0). Owner,
 * 2026-09-14, verbatim: "The email that sends the csv doesn't automatically
 * mount the csv file to the email.  You have to download it and add it
 * manually." His pick on the mail service fork: "Resend, your account".
 *
 * Why it happened: the SalesHelper form POSTs its finished order to /api/send
 * (its canon 4b contract: JSON {filename, csv, order}, header X-Grip-Key, any
 * 2xx means sent) and falls back to a pre-addressed mailto when the answer is
 * anything else. The old host had a Pages Function behind that path; this
 * Worker had none, so every Accept fell to the mailto and the rep attached the
 * CSV by hand. This module answers the contract: the gate key checked, the
 * body validated, the mail sent through Resend (the owner's account, the key a
 * Worker secret) with the Zoho CSV and the order JSON attached, the recipient
 * and the sender read from app_config (saleshelper_mail_to, default
 * logistics@gripcannabis.com; saleshelper_mail_from, a verified sender,
 * seeded by migration 0046 and editable in Admin, Lookups). Unconfigured
 * (no secret or no sender) answers 503 so the form's fallback stands; the
 * provider's refusal answers 502 with its words.
 */

import { HttpError } from "./audit";

/** SalesHelper canon 4b: the form's gate header value, visible in its page
 * source by design (drive-by abuse protection, not auth). Rotation is one
 * release on both sides. */
export const SH_SEND_GATE_KEY = "grip-c4aba3e1d0320e1acb5d5716";
/** SalesHelper canon 4b: where finished orders go. */
export const SH_MAIL_TO_DEFAULT = "logistics@gripcannabis.com";
/** SalesHelper canon 4b size law: each attachment under 2MB, failing loudly. */
export const SH_ATTACHMENT_CAP_BYTES = 2 * 1024 * 1024;
export const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type ShOrderLine = { label: string; qty: number; price: number; total: number; type?: string };
export type ShOrderRecord = {
  orderNo: string;
  customer: string;
  orderDate?: string;
  salesperson?: string;
  license?: string;
  originLicense?: string;
  subtotal?: number;
  lines?: ShOrderLine[];
};
export type ShSendBody = { filename: string; csv: string; order: ShOrderRecord };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** The POST body checked against the contract; HttpError 400 in words when it is not an order. */
export function parseSendBody(raw: unknown): ShSendBody {
  if (!raw || typeof raw !== "object") throw new HttpError(400, "Send body must be JSON with filename, csv and order.");
  const b = raw as Record<string, unknown>;
  const filename = str(b.filename).trim();
  const csv = str(b.csv);
  const order = b.order && typeof b.order === "object" ? (b.order as Record<string, unknown>) : null;
  if (!filename || !/^[\w.\- ]+\.csv$/i.test(filename)) throw new HttpError(400, "Send body needs a CSV filename.");
  if (!csv.trim()) throw new HttpError(400, "Send body needs the CSV text.");
  if (!order) throw new HttpError(400, "Send body needs the order record.");
  const orderNo = str(order.orderNo).trim();
  const customer = str(order.customer).trim();
  if (!orderNo) throw new HttpError(400, "The order record needs an orderNo.");
  if (!customer) throw new HttpError(400, "The order record needs a customer.");
  const lines = Array.isArray(order.lines)
    ? order.lines
        .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
        .map((l) => ({ label: str(l.label), qty: num(l.qty), price: num(l.price), total: num(l.total), type: str(l.type) || undefined }))
    : [];
  return {
    filename,
    csv,
    order: {
      orderNo,
      customer,
      orderDate: str(order.orderDate) || undefined,
      salesperson: str(order.salesperson) || undefined,
      license: str(order.license) || undefined,
      originLicense: str(order.originLicense) || undefined,
      subtotal: typeof order.subtotal === "number" ? order.subtotal : undefined,
      lines,
    },
  };
}

/** SalesHelper canon 4b: the exact subject format. */
export function sendMailSubject(order: Pick<ShOrderRecord, "orderNo" | "customer">): string {
  return `GRIP Sales Order ${order.orderNo} - ${order.customer}`;
}

const usd = (v: number): string => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The plain-text body: the order's head, its lines (capped), the subtotal, what is attached. */
export function sendMailText(order: ShOrderRecord, filename: string): string {
  const cap = 40;
  const out: string[] = [
    `Sales order ${order.orderNo}`,
    `Customer: ${order.customer}${order.license ? ` (${order.license})` : ""}`,
    `Salesperson: ${order.salesperson ?? ""}`,
    `Date: ${order.orderDate ?? ""}`,
    `Origin license: ${order.originLicense ?? ""}`,
    "",
  ];
  const lines = order.lines ?? [];
  for (const l of lines.slice(0, cap)) out.push(`${l.label} - ${l.qty} @ ${usd(l.price)} = ${usd(l.total)}`);
  if (lines.length > cap) out.push(`...and ${lines.length - cap} more lines (see the CSV)`);
  out.push("", `Subtotal: ${usd(order.subtotal ?? lines.reduce((s, l) => s + l.total, 0))}`, "");
  out.push(`Attached: ${filename} (the Zoho Inventory import file) and order_${order.orderNo}.json (the order record).`);
  out.push("", "Sent by the GRIP SalesHelper order form through Gripfactory Lite.");
  return out.join("\n");
}

/** UTF-8 text as base64, chunked so a long CSV never overflows the call stack. */
export function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}

export type ResendPayload = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  attachments: { filename: string; content: string }[];
};

/** The Resend request body: both attachments, base64, each under the size law. */
export function buildResendPayload(input: { from: string; to: string; body: ShSendBody }): ResendPayload {
  const { from, to, body } = input;
  const orderJson = JSON.stringify(body.order, null, 2);
  const csvBytes = new TextEncoder().encode(body.csv).length;
  const jsonBytes = new TextEncoder().encode(orderJson).length;
  if (csvBytes > SH_ATTACHMENT_CAP_BYTES) throw new HttpError(413, `The CSV is ${csvBytes} bytes; the attachment cap is ${SH_ATTACHMENT_CAP_BYTES}.`);
  if (jsonBytes > SH_ATTACHMENT_CAP_BYTES) throw new HttpError(413, `The order record is ${jsonBytes} bytes; the attachment cap is ${SH_ATTACHMENT_CAP_BYTES}.`);
  const recipients = to
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (!recipients.length) throw new HttpError(503, "Mail is not configured: saleshelper_mail_to is blank.");
  return {
    from,
    to: recipients,
    subject: sendMailSubject(body.order),
    text: sendMailText(body.order, body.filename),
    attachments: [
      { filename: body.filename, content: base64Utf8(body.csv) },
      { filename: `order_${body.order.orderNo}.json`, content: base64Utf8(orderJson) },
    ],
  };
}

export type SendMailInput = {
  apiKey: string | undefined | null;
  from: string | null;
  to: string | null;
  body: ShSendBody;
  fetchImpl?: typeof fetch;
};

export type SendMailResult = { id: string | null; to: string[] };

/** Sends through Resend. 503 while unconfigured (the form keeps its fallback),
 * 502 with the provider's words when it refuses, the provider's message id
 * when it accepts. */
export async function sendSalesOrderMail(input: SendMailInput): Promise<SendMailResult> {
  const apiKey = (input.apiKey ?? "").trim();
  const from = (input.from ?? "").trim();
  if (!apiKey) throw new HttpError(503, "Mail is not configured: the RESEND_API_KEY secret is not set on the Worker.");
  if (!from) throw new HttpError(503, "Mail is not configured: saleshelper_mail_from is blank (set a verified sender in Admin, Lookups, app_config).");
  const payload = buildResendPayload({ from, to: input.to || SH_MAIL_TO_DEFAULT, body: input.body });
  const doFetch = input.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new HttpError(502, `Mail provider unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const words = (await res.text().catch(() => "")).slice(0, 300);
    throw new HttpError(502, `Mail provider refused (${res.status}): ${words || "no detail"}`);
  }
  let id: string | null = null;
  try {
    const data = (await res.json()) as { id?: unknown };
    id = typeof data.id === "string" ? data.id : null;
  } catch {
    id = null;
  }
  return { id, to: payload.to };
}
