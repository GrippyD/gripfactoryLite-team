/**
 * WG1, THE WORKSGIVING POLL (the owner, 2026-10-30). A public one page poll for the Worksgiving Potluck at
 * /special/worksgiving26: are you coming, what are you bringing, your email; then a review with the warning,
 * and Submit or Go back.
 *
 * His picks on the question tool, verbatim: "You build it here (Recommended)"; "Bypass Access for /special
 * (Recommended)"; "No caps, show live counts"; "Any email (Recommended)"; then "add a "Yes +1" option to the RSVP"
 * (Yes +1 counts two people). His addendums: the page lives at
 * /special/worksgiving26, a new directory that no navigation button leads to ("/special/ can only be reached
 * when I share a link to it"), and the plates, cups, utensils and napkins option is gone.
 *
 * - ONE SUBMISSION PER EMAIL is the database's (a unique index on the event and the normalized email, live rows
 *   only); the page's early word is a courtesy.
 * - No caps: each category shows how many have picked it so far.
 * - The page stands alone: no app chrome, no menu, no login. Under /special it is the only thing that answers;
 *   everything else there is a plain 404.
 * - The event's date, time note, place and contact live in potluck_events and are typed at
 *   /admin/special/worksgiving26 (behind the Admin PIN), so no name rides in a repo file. That page also holds
 *   the results, the CSV and Remove.
 */

import { HttpError } from "./audit";
import { insertLog } from "./db";
import { FARM_TIME_ZONE, etInstant, etWallClock, isCalendarDate } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { esc } from "./ui";

export const POTLUCK_EVENT_KEY = "worksgiving26";
export const POTLUCK_PATH = "/special/worksgiving26";
export const POTLUCK_ADMIN_PATH = "/admin/special/worksgiving26";
export const SPECIAL_PREFIX = "/special";

/** The categories, in the order the page lists them. The keys match the migration's CHECK (0126). */
export const POTLUCK_CATEGORIES = [
  { key: "main", label: "Main / protein" },
  { key: "hot_side", label: "Hot side" },
  { key: "cold_side", label: "Cold side / salad" },
  { key: "bread", label: "Bread / rolls" },
  { key: "dessert", label: "Dessert" },
  { key: "drinks", label: "Drinks" },
] as const;

export type PotluckCategoryKey = (typeof POTLUCK_CATEGORIES)[number]["key"];
export type PotluckAttending = "yes" | "yes_plus_one" | "no" | "maybe";
export const POTLUCK_ATTENDING: readonly PotluckAttending[] = ["yes", "yes_plus_one", "no", "maybe"];
const ATTENDING_WORDS: Readonly<Record<PotluckAttending, string>> = { yes: "Yes", yes_plus_one: "Yes +1", no: "No", maybe: "Maybe" };
/** People an answer brings: Yes one, Yes +1 two; Maybe and No none. */
export const ATTENDING_PEOPLE: Readonly<Record<PotluckAttending, number>> = { yes: 1, yes_plus_one: 2, no: 0, maybe: 0 };

/** The value the "What are you bringing?" radio carries for nothing. */
export const POTLUCK_NOTHING = "nothing";
export const POTLUCK_DISH_MIN = 2;
export const POTLUCK_DISH_MAX = 80;
export const POTLUCK_EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The visitor on /special: no login and no people row, never an author. */
export const PUBLIC_IDENTITY = { id: "public", display_name: "Public", email: "public@special" } as const;

export type PotluckEvent = {
  key: string;
  name: string;
  event_date: string;
  when_note: string;
  where_text: string;
  contact_text: string;
  closes_at: string;
};

/** What the form carries, as typed. */
export type PotluckDraft = { attending: string; category: string; dish: string; email: string };
export type PotluckAnswer = { attending: PotluckAttending; category: PotluckCategoryKey | null; dish: string | null; email: string };
export type PotluckField = "attending" | "category" | "dish" | "email";
export type PotluckCheck = { ok: true; value: PotluckAnswer } | { ok: false; field: PotluckField; message: string };

export const EMPTY_DRAFT: PotluckDraft = { attending: "", category: "", dish: "", email: "" };

/** Whether a path sits under /special at all. */
export function isSpecialPath(pathname: string): boolean {
  return pathname === SPECIAL_PREFIX || pathname.startsWith(`${SPECIAL_PREFIX}/`);
}

/** The only door under /special: the poll's page, read (GET, HEAD) or posted. */
export function isPublicSpecialRoute(method: string, pathname: string): boolean {
  const verb = String(method ?? "").toUpperCase();
  return pathname === POTLUCK_PATH && (verb === "GET" || verb === "HEAD" || verb === "POST");
}

/** One login per person: lower case, outer spaces trimmed, nothing else (no dot or plus folding). */
export function normalizePotluckEmail(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function potluckCategoryLabel(key: string | null | undefined, locale: Locale): string {
  const cat = POTLUCK_CATEGORIES.find((c) => c.key === key);
  return cat ? t(locale, cat.label) : "";
}

export function draftFromForm(form: FormData): PotluckDraft {
  const read = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : "";
  };
  return { attending: read("attending"), category: read("category"), dish: read("dish"), email: read("email") };
}

/** The draft as the database takes it, or the first field that is off. A No drops what was picked to bring. */
export function checkPotluckDraft(d: PotluckDraft): PotluckCheck {
  const attending = d.attending.trim();
  if (!(POTLUCK_ATTENDING as readonly string[]).includes(attending)) {
    return { ok: false, field: "attending", message: "Pick Yes, Yes +1, No or Maybe." };
  }
  let category: PotluckCategoryKey | null = null;
  let dish: string | null = null;
  if (attending !== "no") {
    const bring = d.category.trim();
    if (!bring) return { ok: false, field: "category", message: "Pick what you're bringing, or Nothing this time." };
    if (bring !== POTLUCK_NOTHING) {
      const cat = POTLUCK_CATEGORIES.find((c) => c.key === bring);
      if (!cat) return { ok: false, field: "category", message: "Pick one of the listed categories." };
      const text = d.dish.replace(/\s+/g, " ").trim();
      if (!text) return { ok: false, field: "dish", message: "Name the dish." };
      // Characters, as the database's length() counts them.
      const chars = [...text].length;
      if (chars < POTLUCK_DISH_MIN || chars > POTLUCK_DISH_MAX) {
        return { ok: false, field: "dish", message: "Keep the dish between 2 and 80 characters." };
      }
      category = cat.key;
      dish = text;
    }
  }
  const email = normalizePotluckEmail(d.email);
  if (!email || email.length > POTLUCK_EMAIL_MAX || !EMAIL_RE.test(email)) {
    return { ok: false, field: "email", message: "Enter a valid email address." };
  }
  return { ok: true, value: { attending: attending as PotluckAttending, category, dish, email } };
}

export function isPotluckClosed(event: PotluckEvent, nowIso: string): boolean {
  const close = Date.parse(event.closes_at);
  const now = Date.parse(nowIso);
  return Number.isFinite(close) && Number.isFinite(now) && now >= close;
}

export async function loadPotluckEvent(db: D1Database, key: string = POTLUCK_EVENT_KEY): Promise<PotluckEvent | null> {
  return (
    (await db
      .prepare(
        `SELECT key, name, event_date, when_note, where_text, contact_text, closes_at FROM potluck_events WHERE key = ?`
      )
      .bind(key)
      .first<PotluckEvent>()) ?? null
  );
}

/** How many live answers picked each category (No answers carry none). */
export async function potluckCounts(db: D1Database, key: string = POTLUCK_EVENT_KEY): Promise<Record<string, number>> {
  const res = await db
    .prepare(
      `SELECT category, COUNT(*) AS n FROM potluck_responses
        WHERE event_key = ? AND deleted_at IS NULL AND category IS NOT NULL
        GROUP BY category`
    )
    .bind(key)
    .all<{ category: string; n: number }>();
  const out: Record<string, number> = {};
  for (const row of res.results ?? []) out[row.category] = Number(row.n);
  return out;
}

export async function potluckEmailTaken(db: D1Database, email: string, key: string = POTLUCK_EVENT_KEY): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS hit FROM potluck_responses WHERE event_key = ? AND email = ? AND deleted_at IS NULL`)
    .bind(key, email)
    .first<{ hit: number }>();
  return row != null;
}

export type PotluckSave = "saved" | "duplicate" | "closed";

/** One insert; the unique index is the gate for a second answer from the same email. */
export async function savePotluckResponse(db: D1Database, event: PotluckEvent, answer: PotluckAnswer, nowIso: string): Promise<PotluckSave> {
  if (isPotluckClosed(event, nowIso)) return "closed";
  try {
    await db
      .prepare(
        `INSERT INTO potluck_responses (id, event_key, email, attending, category, dish, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'potluck_form', ?, 'potluck_form')`
      )
      .bind(crypto.randomUUID(), event.key, answer.email, answer.attending, answer.category, answer.dish, nowIso, nowIso)
      .run();
    return "saved";
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(String((err as Error)?.message ?? err))) return "duplicate";
    throw err;
  }
}

/* ------------------------------------------------------------------------------------------------
 * The public page
 * ---------------------------------------------------------------------------------------------- */

export type PotluckView =
  | { screen: "form"; draft: PotluckDraft; error?: { field: PotluckField; message: string }; banner?: string }
  | { screen: "review"; answer: PotluckAnswer }
  | { screen: "done"; answer: PotluckAnswer | null }
  | { screen: "closed" }
  | { screen: "missing" }
  | { screen: "error" };

function contactOf(event: PotluckEvent | null, locale: Locale): string {
  const typed = (event?.contact_text ?? "").trim();
  return typed || t(locale, "the Ops office");
}

/** "Friday, November 20, 2026" or "viernes, 20 de noviembre de 2026". */
export function potluckDateWords(date: string, locale: Locale): string {
  if (!isCalendarDate(date)) return "";
  const ms = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), 12);
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(ms))
    .replace(/[\u202f\u00a0]/g, " ");
}

/** The close as the floor reads it, in farm time: "Tuesday, November 17 at 5:00 PM". The date and the time are
 * formatted apart and joined in words, so every runtime reads the same; the narrow spaces some print are plain. */
export function potluckCloseWords(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const tag = locale === "es" ? "es-US" : "en-US";
  const plain = (text: string) => text.replace(/[\u202f\u00a0]/g, " ");
  const date = plain(new Intl.DateTimeFormat(tag, { weekday: "long", month: "long", day: "numeric", timeZone: FARM_TIME_ZONE }).format(d));
  const time = plain(new Intl.DateTimeFormat(tag, { hour: "numeric", minute: "2-digit", timeZone: FARM_TIME_ZONE }).format(d));
  return tFill(locale, "{date} at {time}", { date, time });
}

function bringingWords(answer: PotluckAnswer, locale: Locale): string {
  if (answer.attending === "no") return t(locale, "nothing, not coming");
  if (!answer.category || !answer.dish) return t(locale, "nothing, just eating");
  return `${answer.dish} (${potluckCategoryLabel(answer.category, locale)})`;
}

function answerLines(answer: PotluckAnswer, locale: Locale): string {
  const line = (term: string, value: string, key: string) =>
    `<div class="wg-line" data-wg-line="${key}"><dt>${esc(t(locale, term))}</dt><dd>${esc(value)}</dd></div>`;
  return `<dl class="wg-lines">
      ${line("Coming", t(locale, ATTENDING_WORDS[answer.attending]), "attending")}
      ${line("Bringing", bringingWords(answer, locale), "bringing")}
      ${line("Email", answer.email, "email")}
    </dl>`;
}

function hiddenAnswer(answer: PotluckAnswer): string {
  const field = (name: string, value: string) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
  return [
    field("attending", answer.attending),
    field("category", answer.attending === "no" ? "" : answer.category ?? POTLUCK_NOTHING),
    field("dish", answer.dish ?? ""),
    field("email", answer.email),
  ].join("");
}

function errorFor(view: Extract<PotluckView, { screen: "form" }>, field: PotluckField, locale: Locale): string {
  if (view.error?.field !== field) return "";
  return `<p class="wg-err" role="alert" data-wg-error="${field}">${esc(t(locale, view.error.message))}</p>`;
}

function formScreen(view: Extract<PotluckView, { screen: "form" }>, counts: Record<string, number>, locale: Locale): string {
  const d = view.draft;
  const attending = POTLUCK_ATTENDING.map(
    (value) => `<label class="wg-opt"><input type="radio" name="attending" value="${value}"${d.attending === value ? " checked" : ""} required>
          <span>${esc(t(locale, ATTENDING_WORDS[value]))}</span></label>`
  ).join("");
  const countWords = (n: number) => (n > 0 ? tFill(locale, "{n} so far", { n: String(n) }) : t(locale, "none yet"));
  const bring = POTLUCK_CATEGORIES.map(
    (cat) => `<label class="wg-opt"><input type="radio" name="category" value="${cat.key}"${d.category === cat.key ? " checked" : ""}>
          <span>${esc(t(locale, cat.label))} <span class="wg-count" data-wg-count="${cat.key}">(${esc(countWords(counts[cat.key] ?? 0))})</span></span></label>`
  ).join("");
  const nothing = `<label class="wg-opt"><input type="radio" name="category" value="${POTLUCK_NOTHING}"${d.category === POTLUCK_NOTHING ? " checked" : ""}>
          <span>${esc(t(locale, "Nothing this time, just eating"))}</span></label>`;
  const banner = view.banner ? `<p class="wg-banner" role="alert" data-wg-banner>${esc(view.banner)}</p>` : "";
  return `${banner}
    <form method="post" action="${POTLUCK_PATH}" class="wg-form" data-wg-screen="form">
      <input type="hidden" name="action" value="review">
      <div class="wg-hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
      <fieldset class="wg-q" data-wg-q="attending">
        <legend>${esc(t(locale, "Are you coming?"))}</legend>
        <div class="wg-opts wg-opts-row">${attending}</div>
        ${errorFor(view, "attending", locale)}
      </fieldset>
      <fieldset class="wg-q" data-wg-q="bring">
        <legend>${esc(t(locale, "What are you bringing?"))}</legend>
        <div class="wg-opts">${bring}${nothing}</div>
        ${errorFor(view, "category", locale)}
        <div class="wg-dish" data-wg-dish>
          <label for="wg-dish">${esc(t(locale, "What's the dish?"))}</label>
          <input id="wg-dish" type="text" name="dish" maxlength="${POTLUCK_DISH_MAX}" autocomplete="off" placeholder="${esc(t(locale, "e.g., green bean casserole"))}" value="${esc(d.dish)}">
          ${errorFor(view, "dish", locale)}
        </div>
      </fieldset>
      <div class="wg-q" data-wg-q="email">
        <label class="wg-legend" for="wg-email">${esc(t(locale, "Your email"))}</label>
        <input id="wg-email" type="email" name="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="${POTLUCK_EMAIL_MAX}" required value="${esc(d.email)}">
        <p class="wg-help">${esc(t(locale, "One submission per email."))}</p>
        ${errorFor(view, "email", locale)}
      </div>
      <button type="submit" class="wg-btn">${esc(t(locale, "Review"))}</button>
    </form>`;
}

function reviewScreen(answer: PotluckAnswer, contact: string, locale: Locale): string {
  return `<section class="wg-review" data-wg-screen="review">
      <h2>${esc(t(locale, "Check it before you send."))}</h2>
      ${answerLines(answer, locale)}
      <p class="wg-warn" data-wg-warn>${esc(tFill(locale, "One submission per email. Once you submit you can't change it from this page. Contact {contact} to fix anything.", { contact }))}</p>
      <div class="wg-actions">
        <form method="post" action="${POTLUCK_PATH}" class="wg-back">
          <input type="hidden" name="action" value="back">${hiddenAnswer(answer)}
          <button type="submit" class="wg-btn wg-btn-ghost" formnovalidate>${esc(t(locale, "Go back"))}</button>
        </form>
        <form method="post" action="${POTLUCK_PATH}" class="wg-send">
          <input type="hidden" name="action" value="submit">${hiddenAnswer(answer)}
          <button type="submit" class="wg-btn" data-wg-send data-wg-sending="${esc(t(locale, "Sending..."))}">${esc(t(locale, "Submit"))}</button>
        </form>
      </div>
    </section>`;
}

function doneScreen(answer: PotluckAnswer | null, contact: string, locale: Locale): string {
  return `<section class="wg-done" data-wg-screen="done">
      <h2>${esc(t(locale, "You're on the list."))}</h2>
      ${answer ? answerLines(answer, locale) : ""}
      <p class="wg-help">${esc(tFill(locale, "Need a change? Contact {contact}.", { contact }))}</p>
    </section>`;
}

const PAGE_STYLE = `
:root { --bg:#f3efe6; --panel:#fffdf8; --panel-2:#e8e2d4; --text:#1c1914; --text-dim:#5c564c; --line:#c9c0ae;
  --accent:#4f6b4a; --accent-text:#ffffff; --danger:#8b2e2e; --warn:#a15c07; --focus:#2b4c7e;
  --font: system-ui, -apple-system, "Segoe UI", sans-serif; --radius:10px; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: var(--font); background: var(--bg); color: var(--text); font-size: 1.1rem; line-height: 1.45; }
.wg-main { max-width: 36rem; margin: 0 auto; padding: 1rem 1rem 3rem; }
.wg-lang { display: flex; justify-content: flex-end; gap: 1rem; margin: 0 0 0.5rem; font-size: 0.95rem; }
.wg-lang a { color: var(--accent); }
.wg-lang a[aria-current] { color: var(--text); font-weight: 700; text-decoration: none; }
.wg-head h1 { margin: 0 0 0.25rem; font-size: 1.7rem; line-height: 1.2; }
.wg-head p { margin: 0.15rem 0; color: var(--text-dim); }
.wg-form, .wg-review, .wg-done, .wg-closed { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; margin-top: 1rem; }
.wg-q { border: 0; margin: 0 0 1.25rem; padding: 0; min-width: 0; }
.wg-q legend, .wg-legend { display: block; font-weight: 700; font-size: 1.15rem; margin: 0 0 0.5rem; padding: 0; }
.wg-opts { display: grid; gap: 0.5rem; }
.wg-opts-row { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.wg-opt { display: flex; align-items: center; gap: 0.6rem; min-height: 3rem; padding: 0.55rem 0.75rem; border: 1px solid var(--line);
  border-radius: var(--radius); background: var(--bg); cursor: pointer; overflow-wrap: anywhere; }
.wg-opt input { width: 1.35rem; height: 1.35rem; margin: 0; flex: none; accent-color: var(--accent); }
.wg-opt:has(input:checked) { border-color: var(--accent); background: var(--panel-2); }
.wg-count { color: var(--text-dim); font-size: 0.95rem; white-space: nowrap; }
.wg-dish { margin-top: 0.75rem; }
.wg-dish label { display: block; font-weight: 600; margin-bottom: 0.35rem; }
input[type="text"], input[type="email"] { width: 100%; font: inherit; padding: 0.7rem 0.75rem; border: 1px solid var(--line);
  border-radius: var(--radius); background: #ffffff; color: var(--text); min-height: 3rem; }
input:focus-visible, button:focus-visible, a:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.wg-help { margin: 0.35rem 0 0; color: var(--text-dim); font-size: 0.95rem; }
.wg-err { margin: 0.4rem 0 0; color: var(--danger); font-weight: 600; }
.wg-banner { margin: 1rem 0 0; padding: 0.75rem 1rem; border-radius: var(--radius); background: #f7e9e4; border: 1px solid var(--danger); color: var(--danger); font-weight: 600; }
.wg-warn { margin: 1rem 0; padding: 0.75rem 1rem; border-radius: var(--radius); background: #fbf1df; border: 1px solid var(--warn); color: #5a3404; }
.wg-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 3rem; padding: 0.6rem 1.4rem; font: inherit; font-weight: 700;
  color: var(--accent-text); background: var(--accent); border: 1px solid var(--accent); border-radius: var(--radius); cursor: pointer; }
.wg-btn[disabled] { opacity: 0.7; cursor: progress; }
.wg-btn-ghost { color: var(--accent); background: transparent; }
.wg-form > .wg-btn { width: 100%; }
.wg-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.wg-actions form { flex: 1 1 10rem; margin: 0; }
.wg-actions .wg-btn { width: 100%; }
.wg-lines { margin: 0.75rem 0; display: grid; gap: 0.35rem; }
.wg-line { display: grid; grid-template-columns: 6.5rem minmax(0, 1fr); gap: 0.5rem; }
.wg-line dt { color: var(--text-dim); }
.wg-line dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.wg-review h2, .wg-done h2, .wg-closed h2 { margin: 0 0 0.5rem; font-size: 1.3rem; }
.wg-hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
[hidden] { display: none !important; }
@media (max-width: 560px) { .wg-opts-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 420px) { .wg-line { grid-template-columns: 1fr; gap: 0; } .wg-line dd { margin-bottom: 0.35rem; } }
`;

const PAGE_SCRIPT = `(function () {
  var f = document.querySelector("form.wg-form");
  if (f) {
    var bring = f.querySelector('[data-wg-q="bring"]');
    var dish = f.querySelector("[data-wg-dish]");
    var sync = function () {
      var a = f.querySelector('input[name="attending"]:checked');
      var no = !!(a && a.value === "no");
      if (bring) bring.hidden = no;
      var c = f.querySelector('input[name="category"]:checked');
      if (dish) dish.hidden = no || !c || c.value === "nothing";
    };
    f.addEventListener("change", sync);
    sync();
  }
  var send = document.querySelector("[data-wg-send]");
  if (send && send.form) {
    send.form.addEventListener("submit", function () {
      send.disabled = true;
      send.textContent = send.getAttribute("data-wg-sending") || send.textContent;
    });
  }
})();`;

/** The whole public document: no app chrome, no menu, never indexed. */
export function potluckPage(event: PotluckEvent | null, counts: Record<string, number>, view: PotluckView, locale: Locale, nowIso: string): string {
  const contact = contactOf(event, locale);
  const name = event?.name || t(locale, "Worksgiving Potluck");
  let body: string;
  switch (view.screen) {
    case "form":
      body = formScreen(view, counts, locale);
      break;
    case "review":
      body = reviewScreen(view.answer, contact, locale);
      break;
    case "done":
      body = doneScreen(view.answer, contact, locale);
      break;
    case "closed":
      body = `<section class="wg-closed" data-wg-screen="closed"><h2>${esc(
        tFill(locale, "Sign-ups closed {when}.", { when: potluckCloseWords(event?.closes_at ?? "", locale) })
      )}</h2><p class="wg-help">${esc(tFill(locale, "Contact {contact}.", { contact }))}</p></section>`;
      break;
    case "missing":
      body = `<section class="wg-closed" data-wg-screen="missing"><h2>${esc(t(locale, "This poll is not open."))}</h2></section>`;
      break;
    default:
      body = `<section class="wg-closed" data-wg-screen="error"><h2>${esc(
        t(locale, "Didn't get a reply. Try again. If it says this email already submitted, you're in.")
      )}</h2></section>`;
  }
  const when = event ? [potluckDateWords(event.event_date, locale), event.when_note.trim()].filter(Boolean).join(", ") : "";
  const where = (event?.where_text ?? "").trim();
  const open = event && !isPotluckClosed(event, nowIso) && view.screen === "form";
  const closes = open ? `<p class="wg-closes">${esc(tFill(locale, "Sign-ups close {when}.", { when: potluckCloseWords(event.closes_at, locale) }))}</p>` : "";
  const lang = (code: Locale, word: string) =>
    `<a href="${POTLUCK_PATH}?lang=${code}" lang="${code}"${code === locale ? ' aria-current="true"' : ""}>${word}</a>`;
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(name)}</title>
<style>${PAGE_STYLE}</style>
</head>
<body class="wg" data-wg-event="${esc(event?.key ?? "")}">
<main class="wg-main">
  <nav class="wg-lang" aria-label="${esc(t(locale, "Language"))}">${lang("en", "English")}${lang("es", "Espa&ntilde;ol")}</nav>
  <header class="wg-head">
    <h1>${esc(name)}</h1>
    ${when ? `<p class="wg-when">${esc(when)}</p>` : ""}
    ${where ? `<p class="wg-where">${esc(where)}</p>` : ""}
    ${closes}
  </header>
  ${body}
</main>
<script>${PAGE_SCRIPT}</script>
</body>
</html>`;
}

/* ------------------------------------------------------------------------------------------------
 * Behind the Admin PIN: the results, the CSV, the event's words, Remove
 * ---------------------------------------------------------------------------------------------- */

export type PotluckRow = {
  id: string;
  email: string;
  attending: PotluckAttending;
  category: string | null;
  dish: string | null;
  created_at: string;
};

export type PotluckAdminModel = { event: PotluckEvent | null; rows: PotluckRow[]; nowIso: string };

export async function loadPotluckAdmin(db: D1Database, nowIso: string, key: string = POTLUCK_EVENT_KEY): Promise<PotluckAdminModel> {
  const event = await loadPotluckEvent(db, key);
  const res = await db
    .prepare(
      `SELECT id, email, attending, category, dish, created_at FROM potluck_responses
        WHERE event_key = ? AND deleted_at IS NULL ORDER BY created_at, email`
    )
    .bind(key)
    .all<PotluckRow>();
  return { event, rows: res.results ?? [], nowIso };
}

const CSV_HEADER = ["email", "attending", "category", "dish", "submitted_at"] as const;
const ATTENDING_CSV: Readonly<Record<PotluckAttending, string>> = { yes: "yes", yes_plus_one: "yes +1", no: "no", maybe: "maybe" };

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** email, attending, category, dish, submitted_at (farm time). */
export function potluckCsv(rows: readonly PotluckRow[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [row.email, ATTENDING_CSV[row.attending] ?? row.attending, potluckCategoryLabel(row.category, "en"), row.dish ?? "", etWallClock(row.created_at)].map(csvCell).join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

export function potluckAdminPage(model: PotluckAdminModel, locale: Locale, origin: string): string {
  const { event, rows } = model;
  if (!event) return `<h1>${esc(t(locale, "Worksgiving Potluck"))}</h1><p class="muted">${esc(t(locale, "This poll is not open."))}</p>`;
  const tally = { yes: 0, yes_plus_one: 0, maybe: 0, no: 0 } as Record<PotluckAttending, number>;
  for (const row of rows) tally[row.attending] = (tally[row.attending] ?? 0) + 1;
  const people = rows.reduce((n, row) => n + (ATTENDING_PEOPLE[row.attending] ?? 0), 0);
  const tile = (key: string, label: string, n: number) =>
    `<div class="wg-tile" data-wg-tally="${key}"><b>${n}</b><span>${esc(label)}</span></div>`;
  const tiles = `<div class="wg-tiles">
      ${tile("people", t(locale, "People coming"), people)}${tile("yes", t(locale, "Yes"), tally.yes)}${tile("yes_plus_one", t(locale, "Yes +1"), tally.yes_plus_one)}${tile("maybe", t(locale, "Maybe"), tally.maybe)}${tile("no", t(locale, "No"), tally.no)}${tile("total", t(locale, "Responses"), rows.length)}
    </div>
    <p class="muted">${esc(t(locale, "People coming counts one for each Yes and two for each Yes +1; Maybe is not counted."))}</p>`;
  const byCat = POTLUCK_CATEGORIES.map((cat) => {
    const hits = rows.filter((r) => r.category === cat.key);
    const dishes = hits.length ? hits.map((r) => `${esc(r.dish ?? "")} <span class="muted">(${esc(r.email)})</span>`).join("<br>") : `<span class="muted">${esc(t(locale, "none yet"))}</span>`;
    return `<tr data-wg-cat="${cat.key}"><th scope="row">${esc(t(locale, cat.label))}</th><td class="num">${hits.length}</td><td>${dishes}</td></tr>`;
  }).join("");
  const eating = rows.filter((r) => r.attending !== "no" && !r.category);
  const eatingRow = `<tr data-wg-cat="nothing"><th scope="row">${esc(t(locale, "Just eating"))}</th><td class="num">${eating.length}</td><td>${
    eating.length ? eating.map((r) => esc(r.email)).join("<br>") : `<span class="muted">${esc(t(locale, "none yet"))}</span>`
  }</td></tr>`;
  const list = rows.length
    ? rows
        .map(
          (r) => `<tr data-wg-row="${esc(r.id)}">
          <td>${esc(etWallClock(r.created_at))}</td>
          <td class="wg-email">${esc(r.email)}</td>
          <td>${esc(t(locale, ATTENDING_WORDS[r.attending] ?? r.attending))}</td>
          <td>${esc(potluckCategoryLabel(r.category, locale) || (r.attending === "no" ? "" : t(locale, "Just eating")))}</td>
          <td>${esc(r.dish ?? "")}</td>
          <td><form method="post" action="${POTLUCK_ADMIN_PATH}/remove" onsubmit="return confirm(this.getAttribute('data-ask'))" data-ask="${esc(t(locale, "Remove this answer? That email can then answer again."))}">
            <input type="hidden" name="id" value="${esc(r.id)}"><button type="submit" class="secondary">${esc(t(locale, "Remove"))}</button></form></td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="muted">${esc(t(locale, "No answers yet."))}</td></tr>`;
  const closed = isPotluckClosed(event, model.nowIso);
  const close = { date: etWallClock(event.closes_at).slice(0, 10), time: etWallClock(event.closes_at).slice(11, 16) };
  const link = `${origin}${POTLUCK_PATH}`;
  return `<div class="wg-admin" data-wg-admin data-wg-open="${closed ? "0" : "1"}">
    <h1>${esc(event.name)}</h1>
    <p class="muted">${esc(t(locale, "The poll's link. Nothing in the app leads there; it opens for whoever has the link."))} <a href="${esc(link)}" data-wg-link>${esc(link)}</a></p>
    <p class="muted" data-wg-status>${esc(
      tFill(locale, closed ? "Sign-ups closed {when}." : "Sign-ups close {when}.", { when: potluckCloseWords(event.closes_at, locale) })
    )}</p>
    ${tiles}
    <h2>${esc(t(locale, "What's coming"))}</h2>
    <div class="wg-scroll"><table class="wg-table" data-wg-board>
      <thead><tr><th>${esc(t(locale, "Category"))}</th><th class="num">${esc(t(locale, "Count"))}</th><th>${esc(t(locale, "Dishes"))}</th></tr></thead>
      <tbody>${byCat}${eatingRow}</tbody>
    </table></div>
    <h2>${esc(t(locale, "Answers"))}</h2>
    <p><a href="${POTLUCK_ADMIN_PATH}.csv" data-wg-csv>${esc(t(locale, "Download CSV"))}</a></p>
    <div class="wg-scroll"><table class="wg-table" data-wg-list>
      <thead><tr><th>${esc(t(locale, "Answered"))}</th><th>${esc(t(locale, "Email"))}</th><th>${esc(t(locale, "Coming"))}</th><th>${esc(t(locale, "Bringing"))}</th><th>${esc(t(locale, "Dish"))}</th><th></th></tr></thead>
      <tbody>${list}</tbody>
    </table></div>
    <h2>${esc(t(locale, "The event"))}</h2>
    <p class="muted">${esc(t(locale, "What the poll's page shows at its top. Leave Contact blank to show the Ops office."))}</p>
    <form method="post" action="${POTLUCK_ADMIN_PATH}/event" class="wg-event" data-wg-event-form>
      <label>${esc(t(locale, "Event date"))} <input type="date" name="event_date" required value="${esc(event.event_date)}"></label>
      <label>${esc(t(locale, "Time and note"))} <input type="text" name="when_note" maxlength="120" value="${esc(event.when_note)}" placeholder="${esc(t(locale, "e.g., 4:00 PM, after your shift"))}"></label>
      <label>${esc(t(locale, "Where"))} <input type="text" name="where_text" maxlength="160" value="${esc(event.where_text)}"></label>
      <label>${esc(t(locale, "Contact"))} <input type="text" name="contact_text" maxlength="80" value="${esc(event.contact_text)}" placeholder="${esc(t(locale, "the Ops office"))}"></label>
      <label>${esc(t(locale, "Sign-ups close (date)"))} <input type="date" name="close_date" required value="${esc(close.date)}"></label>
      <label>${esc(t(locale, "Sign-ups close (time, farm time)"))} <input type="time" name="close_time" required value="${esc(close.time)}"></label>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>
  </div>`;
}

const POTLUCK_EVENT_REASON = "WG1 the Worksgiving poll: the event's words at Admin";
const POTLUCK_REMOVE_REASON = "WG1 the Worksgiving poll: an answer removed at Admin, so the email can answer again";

/** The event's words as typed at Admin; each changed field logged. */
export async function updatePotluckEvent(db: D1Database, form: FormData, actorId: string, nowIso: string, key: string = POTLUCK_EVENT_KEY): Promise<void> {
  const event = await loadPotluckEvent(db, key);
  if (!event) throw new HttpError(404, "This poll is not open.");
  const read = (name: string, max: number) => {
    const v = form.get(name);
    return (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, max);
  };
  const eventDate = read("event_date", 10);
  if (!isCalendarDate(eventDate)) throw new HttpError(400, "Event date must be YYYY-MM-DD.");
  const closesAt = etInstant(read("close_date", 10), read("close_time", 5));
  if (!closesAt) throw new HttpError(400, "Sign-ups close needs a date and a time.");
  const next: Record<string, string> = {
    event_date: eventDate,
    when_note: read("when_note", 120),
    where_text: read("where_text", 160),
    contact_text: read("contact_text", 80),
    closes_at: closesAt,
  };
  const changed = Object.keys(next).filter((k) => (event as unknown as Record<string, string>)[k] !== next[k]);
  if (changed.length === 0) return;
  await db.batch([
    db
      .prepare(
        `UPDATE potluck_events SET event_date = ?, when_note = ?, where_text = ?, contact_text = ?, closes_at = ?, updated_at = ?, updated_by = ? WHERE key = ?`
      )
      .bind(next.event_date, next.when_note, next.where_text, next.contact_text, next.closes_at, nowIso, actorId, key),
    ...changed.map((field) =>
      insertLog(db, {
        record_table: "potluck_events",
        record_id: key,
        field,
        old_value: (event as unknown as Record<string, string>)[field] ?? null,
        new_value: next[field] ?? null,
        actor_person_id: actorId,
        reason: POTLUCK_EVENT_REASON,
        changed_at: nowIso,
      })
    ),
  ]);
}

/** Remove one answer (a soft delete, logged), so that email can answer again. */
export async function removePotluckResponse(db: D1Database, id: string, actorId: string, nowIso: string, key: string = POTLUCK_EVENT_KEY): Promise<void> {
  const row = await db
    .prepare(`SELECT id FROM potluck_responses WHERE id = ? AND event_key = ? AND deleted_at IS NULL`)
    .bind(id, key)
    .first<{ id: string }>();
  if (!row) throw new HttpError(404, "That answer is not on the list.");
  await db.batch([
    db
      .prepare(`UPDATE potluck_responses SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(nowIso, actorId, nowIso, actorId, id),
    insertLog(db, {
      record_table: "potluck_responses",
      record_id: id,
      field: "deleted_at",
      old_value: null,
      new_value: nowIso,
      actor_person_id: actorId,
      reason: POTLUCK_REMOVE_REASON,
      changed_at: nowIso,
    }),
  ]);
}
