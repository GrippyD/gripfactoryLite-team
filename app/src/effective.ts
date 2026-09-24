/**
 * THE EFFECTIVE DATE (canon 0.30.92). Owner rulings 2026-09-16, verbatim: "We
 * need to quickly add a date override in the load silo screen - PIN gated:
 * 21319" and, minutes later, ""Effective Date" = field on all transactional
 * records - always pin gated - defaults to today and rarely needs to be
 * touched."
 *
 * One field, one law. A transactional form carries Effective Date, a collapsed
 * block that reads today (the farm's day, Eastern) and needs no touch on an
 * ordinary day. Opened, it offers the date and an Admin PIN box: any day other
 * than today is honored only with the Admin PIN (app_config admin_pin) typed
 * beside it, and never a day ahead of today. The record's own instant then
 * falls on that day (Load Silo: the typed Start time on the Effective Date is
 * the loaded time). Every use of another day leaves a change-log row under the
 * effective_date reason, so the override is never silent. Load Silo is the
 * first record on the field; the others follow under the same law.
 *
 * THE FARM DAY BEGINS AT SIX (canon 0.30.151): "today" here is the farm day,
 * not the calendar day. The server reads app_config farm_day_start_hour and
 * resolves a blank or matching date to the farm day of the instant; the field
 * renders the farm day when it has the instant, and the client fills it from
 * the browser's clock and the start hour the page carries on its body
 * (data-farm-day-start), so a second-shift form at 1:30 AM reads yesterday's
 * date as "(today)" and posts it without a PIN.
 */
import { HttpError, textOrNull } from "./audit";
import { CONFIG_KEYS, SYSTEM_REASON } from "./config";
import { getConfigValue, insertLog } from "./db";
import { FARM_DAY_START_HOUR_DEFAULT, farmDay, isCalendarDate, parseFarmDayStartHour } from "./farmday";
import { t, type Locale } from "./i18n";
import { esc } from "./ui";

export const EFFECTIVE_DATE_FIELD = "effective_date";
export const EFFECTIVE_PIN_FIELD = "effective_pin";

export type EffectiveDate = {
  /** The day the record is effective, YYYY-MM-DD (the farm's day). */
  date: string;
  /** The farm's day today, YYYY-MM-DD. */
  today: string;
  /** True when the date is not today (the Admin PIN was checked). */
  overridden: boolean;
};

/** The collapsed field: the summary reads the default day; opened, the date
 * and the Admin PIN. `hint` is the record's own line (what the date drives).
 * `nowIso` renders today server-side (Load Silo, which has the instant); null
 * leaves the date blank for the client to fill (the registry stations, whose
 * synchronous field renderer has no instant), which reads the same on the
 * server since a blank Effective Date resolves to today. */
export function effectiveDateField(
  nowIso: string | null,
  locale: Locale,
  hint?: string,
  current?: string | null,
  startHour: number = FARM_DAY_START_HOUR_DEFAULT
): string {
  const today = nowIso ? farmDay(nowIso, startHour) : "";
  const auto = nowIso ? "" : " data-effective-auto";
  // A stored value (an unload session that already carries a backdated date)
  // renders as the value; the client still fills today as the default so the
  // summary reads "changed" when they differ.
  const shown = today || (current ?? "");
  const valueAttr = shown ? ` value="${esc(shown)}"` : "";
  const maxAttr = today ? ` max="${esc(today)}"` : "";
  const summaryToday = shown || "--";
  return `<details class="effective-date" data-effective-date>
        <summary>${esc(t(locale, "Effective Date"))}: <span data-effective-summary>${esc(summaryToday)}</span> <span class="muted" data-effective-state>(${esc(
    t(locale, "today")
  )})</span></summary>
        <label class="field">${esc(t(locale, "Effective Date"))} <input type="date" name="${EFFECTIVE_DATE_FIELD}"${valueAttr}${maxAttr} data-effective-input data-effective-default="${esc(
    today
  )}"${auto}></label>
        <label class="field">${esc(t(locale, "Admin PIN"))} <input type="password" name="${EFFECTIVE_PIN_FIELD}" inputmode="numeric" autocomplete="off" data-effective-pin></label>
        <p class="muted">${esc(t(locale, "Defaults to today and rarely needs to be touched. Any other day needs the Admin PIN."))}${hint ? ` ${esc(hint)}` : ""}</p>
      </details>${effectiveDateScript(locale)}`;
}

/** The summary follows the picked day: "(today)" on the default, "(changed)"
 * on any other, so a touched field is never mistaken for the default. */
export function effectiveDateScript(locale: Locale): string {
  return `<script>
(function () {
  function pad(n) { return String(n).padStart(2, "0"); }
  document.querySelectorAll("[data-effective-date]").forEach(function (box) {
    var input = box.querySelector("[data-effective-input]");
    var summary = box.querySelector("[data-effective-summary]");
    var state = box.querySelector("[data-effective-state]");
    if (!input || !summary || !state) return;
    // A registry station renders no server today (its field renderer has no
    // instant); the client fills today, the max and the default so the summary
    // and the cap read right, and a blank still resolves to today on the server.
    if (input.hasAttribute("data-effective-auto")) {
      // THE FARM DAY BEGINS AT SIX (canon 0.30.151): before the start hour the
      // page's body carries, the farm's day is still yesterday's date.
      var d = new Date();
      var startHour = parseInt((document.body && document.body.getAttribute("data-farm-day-start")) || "${FARM_DAY_START_HOUR_DEFAULT}", 10);
      if (!isNaN(startHour) && d.getHours() < startHour) d.setDate(d.getDate() - 1);
      var today = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      if (!input.value) input.value = today;
      input.setAttribute("max", today);
      input.setAttribute("data-effective-default", today);
    }
    var dflt = input.getAttribute("data-effective-default") || "";
    function show() {
      var v = input.value || dflt;
      summary.textContent = v || "--";
      state.textContent = v === dflt ? ${JSON.stringify(`(${t(locale, "today")})`)} : ${JSON.stringify(`(${t(locale, "changed, Admin PIN")})`)};
    }
    input.addEventListener("input", show);
    input.addEventListener("change", show);
    show();
  });
})();
</script>`;
}

/** The posted Effective Date, checked. Absent or blank reads today. Another
 * day must be a real calendar day, not ahead of today, and carry the Admin PIN. */
export async function resolveEffectiveDate(db: D1Database, form: FormData, nowIso: string): Promise<EffectiveDate> {
  const today = farmDay(nowIso, await farmDayStartHour(db));
  const typed = textOrNull(form.get(EFFECTIVE_DATE_FIELD));
  if (!typed || typed === today) return { date: today, today, overridden: false };
  if (!isCalendarDate(typed)) throw new HttpError(400, "Effective Date must be YYYY-MM-DD.");
  if (typed > today) throw new HttpError(400, "The Effective Date cannot be ahead of today.");
  const pin = await getConfigValue(db, CONFIG_KEYS.admin_pin);
  const entered = textOrNull(form.get(EFFECTIVE_PIN_FIELD));
  if (!pin || entered !== pin) throw new HttpError(403, "Changing the Effective Date needs the Admin PIN.");
  return { date: typed, today, overridden: true };
}

/** The farm day's start hour from app_config (canon 0.30.151), the ruling's 6 when the row is missing. */
export async function farmDayStartHour(db: D1Database): Promise<number> {
  return parseFarmDayStartHour(await getConfigValue(db, CONFIG_KEYS.farm_day_start_hour));
}

/** The farm's day now, by the start hour in data. */
export async function farmToday(db: D1Database, nowIso: string): Promise<string> {
  return farmDay(nowIso, await farmDayStartHour(db));
}

/** The change-log reason on every write made under another Effective Date. */
export const EFFECTIVE_DATE_REASON = SYSTEM_REASON.effective_date;

/** The override marker: one row per record written under a non-today Effective
 * Date, so the PIN-authorized backdate is never silent. The station's own
 * create log already carries the date value; this row names the authorization. */
export function effectiveOverrideLog(
  db: D1Database,
  table: string,
  recordId: string,
  eff: EffectiveDate,
  actorId: string,
  ts: string
): D1PreparedStatement {
  return insertLog(db, {
    record_table: table,
    record_id: recordId,
    field: EFFECTIVE_DATE_FIELD,
    old_value: eff.today,
    new_value: eff.date,
    actor_person_id: actorId,
    reason: EFFECTIVE_DATE_REASON,
    changed_at: ts,
  });
}
