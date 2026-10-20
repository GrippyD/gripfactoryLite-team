/**
 * DD S3f: Trim Throughput (bizops.trim_throughput).
 * The stored rows are the console's per shift weighed pounds and the typed
 * trim hours. The wall divides them. A strain or dry method takes a share of
 * that shift day's hours equal to its share of the shift's pounds, so the
 * rate on a shift day stays the shift's own rate. Across days the box differs
 * from All by which shift days the selection ran on. It is not a per strain speed.
 */
import { CONFIG_KEYS, format2, GRAMS_PER_LB, inheritMarketStrain, NON_TRIM_SOURCE_SQL, parseNameList, round2, roundGrams } from "./config";
import { getConfigValue } from "./db";
import { dayOffset, farmDay, farmDayBounds, isCalendarDate, parseFarmDayStartHour } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { esc } from "./ui";

export const TRIM_THROUGHPUT_KPI = "bizops.trim_throughput";
export const TRIM_THROUGHPUT_VERSION = 1;
export const TRIM_METHODS = ["Silo", "Dry Room", "Hang in Place"] as const;
export type TrimMethod = (typeof TRIM_METHODS)[number];
export type TrimShift = "day" | "second";

export type TrimPeriod = "7" | "14" | "30" | "htd";

const PERIODS: readonly TrimPeriod[] = ["7", "14", "30", "htd"];

/**
 * Silo, Dry Room, or Hang in Place.
 * Hang in Place is kind hang (migration 0057 stored that room as space_type
 * dry_room) or a space_type of hang. A dry room that is not a hang is Dry Room.
 * A silo, including one whose type was left at the default, is Silo.
 */
export function trimDryMethod(spaceType: string | null | undefined, kind: string | null | undefined): string {
  const type = String(spaceType ?? "").trim().toLowerCase();
  const spaceKind = String(kind ?? "").trim().toLowerCase();
  if (type === "hang" || spaceKind === "hang") return "Hang in Place";
  if (type === "dry_room") return "Dry Room";
  if (type === "silo" || spaceKind === "silo") return "Silo";
  return "";
}

export function trimLbsDim(shift: TrimShift, strain: string, method: string): string {
  return `${shift}|${strain}|${method}`;
}

export function trimHoursDim(shift: TrimShift): string {
  return `hours|${shift}`;
}

export type TrimPackageGroup = {
  trimDate: string;
  createdAt: string;
  operator: string;
  marketStrain: string;
  strainName: string;
  spaceType: string;
  spaceKind: string;
  grams: number;
  n: number;
  newest: string;
};

export type TrimHourInput = { workDate: string; shift: string; hours: number; newest: string };

export type TrimDesired = {
  day: string;
  dim: string;
  value: number;
  n: number;
  newest: string;
};

function trimWorkDate(trimDate: string, createdAt: string, startHour: number): string {
  const typed = String(trimDate ?? "").trim();
  if (isCalendarDate(typed)) return typed;
  const at = String(createdAt ?? "").trim();
  if (!at) return "";
  const iso = at.length === 13 ? `${at}:00:00.000Z` : at;
  return farmDay(iso, startHour);
}

function shiftMap(dayNames: readonly string[], secondNames: readonly string[]): Map<string, TrimShift> {
  const map = new Map<string, TrimShift>();
  for (const name of dayNames) {
    const key = name.trim().toLowerCase();
    if (key) map.set(key, "day");
  }
  for (const name of secondNames) {
    const key = name.trim().toLowerCase();
    if (key) map.set(key, "second");
  }
  return map;
}

/** The rows a refresh wants: pounds by shift, strain and dry method, and hours by shift. */
export function planTrimRows(input: {
  year: number;
  startHour: number;
  dayOperators: readonly string[];
  secondOperators: readonly string[];
  packages: readonly TrimPackageGroup[];
  hours: readonly TrimHourInput[];
}): TrimDesired[] {
  const year = input.year;
  const prefix = `${year}-`;
  const inYear = (day: string) => isCalendarDate(day) && day.startsWith(prefix);
  const shifts = shiftMap(input.dayOperators, input.secondOperators);
  type Bucket = { grams: number; n: number; newest: string };
  const pounds = new Map<string, Bucket>();
  for (const row of input.packages) {
    const day = trimWorkDate(row.trimDate, row.createdAt, input.startHour);
    if (!inYear(day)) continue;
    const shift = shifts.get(String(row.operator ?? "").trim().toLowerCase());
    if (!shift) continue;
    const grams = Number(row.grams ?? 0);
    const n = Number(row.n ?? 0);
    if (!(grams > 0) && !(n > 0)) continue;
    const strain = inheritMarketStrain(row.marketStrain, row.strainName) ?? "";
    const method = trimDryMethod(row.spaceType, row.spaceKind);
    const key = `${day}|${trimLbsDim(shift, strain, method)}`;
    const prev = pounds.get(key) ?? { grams: 0, n: 0, newest: "" };
    prev.grams += grams;
    prev.n += n;
    const newest = String(row.newest ?? "");
    if (newest > prev.newest) prev.newest = newest;
    pounds.set(key, prev);
  }
  const out: TrimDesired[] = [];
  for (const [key, bucket] of pounds) {
    const split = key.indexOf("|");
    const day = key.slice(0, split);
    const dim = key.slice(split + 1);
    if (!(bucket.grams > 0)) continue;
    out.push({ day, dim, value: bucket.grams / GRAMS_PER_LB, n: bucket.n, newest: bucket.newest });
  }
  const seenHours = new Set<string>();
  for (const row of input.hours) {
    const day = String(row.workDate ?? "").trim();
    if (!inYear(day)) continue;
    const shift = row.shift === "day" || row.shift === "second" ? row.shift : "";
    if (!shift) continue;
    const hours = Number(row.hours ?? 0);
    if (!(hours > 0)) continue;
    const dim = trimHoursDim(shift);
    const id = `${day}|${dim}`;
    if (seenHours.has(id)) continue;
    seenHours.add(id);
    out.push({ day, dim, value: hours, n: 0, newest: String(row.newest ?? "") });
  }
  return out;
}

/** The console's shift Lbs/DLH, two decimals: whole grams over the hours, then over 448. */
export function consoleShiftLbPerDlh(grams: number, hours: number): number | null {
  if (!(hours > 0)) return null;
  return round2(roundGrams(grams) / hours / GRAMS_PER_LB);
}

export type TrimStoredPoint = {
  day: string;
  shift: TrimShift;
  strain: string;
  method: string;
  lbs: number;
  packages: number;
};

export type TrimStoredHours = { day: string; shift: TrimShift; hours: number };

export type TrimThroughputModel = {
  today: string;
  points: TrimStoredPoint[];
  hours: TrimStoredHours[];
};

export function emptyTrim(today: string): TrimThroughputModel {
  return { today, points: [], hours: [] };
}

function parseLbsDim(dim: string): { shift: TrimShift; strain: string; method: string } | null {
  const shift: TrimShift | "" = dim.startsWith("day|") ? "day" : dim.startsWith("second|") ? "second" : "";
  if (!shift) return null;
  const rest = dim.slice(shift.length + 1);
  for (const method of TRIM_METHODS) {
    const suffix = `|${method}`;
    if (rest.endsWith(suffix)) return { shift, strain: rest.slice(0, -suffix.length), method };
  }
  if (rest.endsWith("|")) return { shift, strain: rest.slice(0, -1), method: "" };
  return { shift, strain: rest, method: "" };
}

export function trimModelFromRows(
  rows: readonly { period_start?: unknown; dim_key?: unknown; value?: unknown; n?: unknown }[],
  today: string
): TrimThroughputModel {
  const points: TrimStoredPoint[] = [];
  const hours: TrimStoredHours[] = [];
  for (const row of rows) {
    const day = String(row.period_start ?? "");
    if (!isCalendarDate(day)) continue;
    const dim = String(row.dim_key ?? "");
    const value = Number(row.value ?? 0);
    if (!(value > 0)) continue;
    if (dim.startsWith("hours|")) {
      const shift = dim.slice("hours|".length);
      if (shift === "day" || shift === "second") hours.push({ day, shift, hours: value });
      continue;
    }
    const parsed = parseLbsDim(dim);
    if (!parsed) continue;
    points.push({ day, shift: parsed.shift, strain: parsed.strain, method: parsed.method, lbs: value, packages: Number(row.n ?? 0) });
  }
  points.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.shift < b.shift ? -1 : 1));
  return { today, points, hours };
}

export function trimStrainOptions(model: TrimThroughputModel): string[] {
  const names = new Set<string>();
  for (const point of model.points) if (point.strain && point.lbs > 0) names.add(point.strain);
  return [...names].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
}

export function trimMethodOptions(model: TrimThroughputModel): string[] {
  const present = new Set<string>();
  for (const point of model.points) if (point.method && point.lbs > 0) present.add(point.method);
  return TRIM_METHODS.filter((method) => present.has(method));
}

export type TrimWindowBox = {
  lbs: number;
  hours: number;
  ratio: number | null;
  packages: number;
  shiftDays: number;
  missingDays: number;
};

export type TrimWindow = {
  shared: boolean;
  hasOutput: boolean;
  day: TrimWindowBox;
  night: TrimWindowBox;
  weighted: TrimWindowBox;
};

function emptyBox(): TrimWindowBox {
  return { lbs: 0, hours: 0, ratio: null, packages: 0, shiftDays: 0, missingDays: 0 };
}

function windowDays(period: TrimPeriod, today: string): string[] {
  if (!isCalendarDate(today)) return [];
  const n = period === "7" ? 7 : period === "30" ? 30 : 14;
  const start = period === "htd" ? `${today.slice(0, 4)}-01-01` : dayOffset(today, 1 - n);
  const first = start > today ? today : start;
  const out: string[] = [];
  let day = first;
  for (let i = 0; i < 400 && day <= today; i += 1) {
    out.push(day);
    const next = dayOffset(day, 1);
    if (next === day) break;
    day = next;
  }
  return out;
}

function boxForShift(model: TrimThroughputModel, days: readonly string[], shift: TrimShift, strain: string, method: string, shared: boolean): TrimWindowBox {
  const box = emptyBox();
  for (const day of days) {
    let allLbs = 0;
    let selLbs = 0;
    let selPackages = 0;
    for (const point of model.points) {
      if (point.day !== day || point.shift !== shift) continue;
      allLbs += point.lbs;
      const strainOk = strain === "" || point.strain === strain;
      const methodOk = method === "" || point.method === method;
      if (strainOk && methodOk) {
        selLbs += point.lbs;
        selPackages += point.packages;
      }
    }
    if (!(selLbs > 0)) continue;
    const hoursRow = model.hours.find((row) => row.day === day && row.shift === shift);
    const hours = hoursRow && hoursRow.hours > 0 ? hoursRow.hours : 0;
    if (!(hours > 0) || !(allLbs > 0)) {
      box.missingDays += 1;
      continue;
    }
    box.lbs += selLbs;
    box.hours += shared ? hours * (selLbs / allLbs) : hours;
    box.packages += selPackages;
    box.shiftDays += 1;
  }
  box.ratio = box.hours > 0 && box.lbs > 0 ? round2(box.lbs / box.hours) : null;
  return box;
}

/** Days, nights, and both shifts' pounds over both shifts' hours. A missing hour drops that shift day's pounds. */
export function trimWindow(model: TrimThroughputModel, period: TrimPeriod, strain: string, method: string): TrimWindow {
  const days = windowDays(period, model.today);
  const shared = strain !== "" || method !== "";
  const day = boxForShift(model, days, "day", strain, method, shared);
  const night = boxForShift(model, days, "second", strain, method, shared);
  const lbs = day.lbs + night.lbs;
  const hours = day.hours + night.hours;
  const weighted: TrimWindowBox = {
    lbs,
    hours,
    ratio: hours > 0 && lbs > 0 ? round2(lbs / hours) : null,
    packages: day.packages + night.packages,
    shiftDays: day.shiftDays + night.shiftDays,
    missingDays: day.missingDays + night.missingDays,
  };
  let hasOutput = false;
  const daySet = new Set(days);
  for (const point of model.points) {
    if (!daySet.has(point.day) || !(point.lbs > 0)) continue;
    if (strain !== "" && point.strain !== strain) continue;
    if (method !== "" && point.method !== method) continue;
    hasOutput = true;
    break;
  }
  return { shared, hasOutput, day, night, weighted };
}

function missingLine(n: number, locale: Locale): string {
  if (n <= 0) return "";
  if (n === 1) return t(locale, "1 shift day without hours");
  return tFill(locale, "{n} shift days without hours", { n: String(n) });
}

function countLine(n: number, one: string, many: string, locale: Locale): string {
  if (n === 1) return t(locale, one);
  return tFill(locale, many, { n: String(n) });
}

type BoxWords = {
  formula: string;
  sharedFormula: string;
};

function detailFor(box: TrimWindowBox, words: BoxWords, shared: boolean, locale: Locale): string {
  const formula = shared ? words.sharedFormula : words.formula;
  const over = tFill(locale, "{lb} lb over {h} h", { lb: format2(box.lbs), h: format2(box.hours) });
  const packages = countLine(box.packages, "1 package", "{n} packages", locale);
  const days = countLine(box.shiftDays, "1 shift day", "{n} shift days", locale);
  const missing = missingLine(box.missingDays, locale);
  return [formula, over, packages, days, missing].filter((part) => part !== "").join(" ");
}

const DAY_WORDS = {
  formula: "Day shift pounds over day shift hours.",
  sharedFormula: "Day shift pounds over hours shared by the selection's share of that shift's pounds.",
};
const NIGHT_WORDS = {
  formula: "Night shift pounds over night shift hours.",
  sharedFormula: "Night shift pounds over hours shared by the selection's share of that shift's pounds.",
};
const WEIGHTED_WORDS = {
  formula: "Both shifts' pounds over both shifts' hours.",
  sharedFormula: "Both shifts' pounds over hours shared by the selection's share of each shift's pounds.",
};

function boxHtml(key: string, label: string, box: TrimWindowBox, words: BoxWords, shared: boolean, locale: Locale): string {
  const detail = detailFor(box, words, shared, locale);
  const figure = box.ratio == null ? t(locale, "No data") : format2(box.ratio);
  const unit = box.ratio == null ? "" : `<span class="dd-tp-unit">${esc(t(locale, "lb/DLH"))}</span>`;
  const sub = box.shiftDays > 0 ? tFill(locale, "{lb} lb, {h} h", { lb: format2(box.lbs), h: format2(box.hours) }) : "";
  const notes = [shared && box.shiftDays > 0 ? t(locale, "hours shared by lbs") : "", missingLine(box.missingDays, locale)].filter((part) => part !== "");
  return `<div class="dd-tp-box" data-dd-tp-box="${esc(key)}" data-dd-tp-detail="${esc(detail)}">
      <span class="dd-tp-label">${esc(t(locale, label))}</span>
      <button type="button" class="dd-tp-value" data-dd-tp-hit>
        <span data-dd-tp-ratio>${esc(figure)}</span>${unit}
      </button>
      <p class="dd-tp-sub" data-dd-tp-sub>${esc(sub)}</p>
      <p class="dd-tp-note" data-dd-tp-note>${esc(notes.join(" "))}</p>
    </div>`;
}

function option(value: string, label: string, selected: boolean): string {
  return `<option value="${esc(value)}"${selected ? " selected" : ""}>${esc(label)}</option>`;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const TRIM_SCRIPT = `<script>
(function () {
  var root = document.currentScript && document.currentScript.parentElement;
  if (!root) return;
  var dataNode = root.querySelector("[data-dd-tp-json]");
  var period = root.querySelector("[data-dd-tp-period]");
  var strain = root.querySelector("[data-dd-tp-strain]");
  var method = root.querySelector("[data-dd-tp-method]");
  var empty = root.querySelector("[data-dd-tp-empty]");
  var boxes = root.querySelector("[data-dd-tp-boxes]");
  var detail = root.querySelector("[data-dd-tp-detail]");
  if (!dataNode || !period || !strain || !method || !boxes) return;
  var data = {};
  try { data = JSON.parse(dataNode.textContent || "{}"); } catch (e) { data = {}; }
  var words = data.words || {};
  var points = data.points || [];
  var hours = data.hours || [];
  var today = data.today || "";
  function hasOption(select, value) {
    for (var i = 0; i < select.options.length; i++) if (select.options[i].value === value) return true;
    return false;
  }
  function fill(template, vars) {
    var text = template || "";
    for (var key in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, key)) text = text.split("{" + key + "}").join(vars[key]);
    }
    return text;
  }
  function addDays(day, n) {
    var ms = Date.parse(day + "T00:00:00.000Z") + n * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  function windowDays(kind) {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(today)) return [];
    var n = kind === "7" ? 7 : kind === "30" ? 30 : 14;
    var start = kind === "htd" ? today.slice(0, 4) + "-01-01" : addDays(today, 1 - n);
    if (start > today) start = today;
    var out = [];
    var day = start;
    for (var i = 0; i < 400 && day <= today; i++) {
      out.push(day);
      day = addDays(day, 1);
    }
    return out;
  }
  function money(n) {
    var sign = n < 0 ? "-" : "";
    var rounded = Math.round(Math.abs(n) * 100) / 100;
    var text = rounded.toFixed(2);
    var parts = text.split(".");
    parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");
    return sign + parts.join(".");
  }
  function ratioOf(lbs, h) {
    if (!(h > 0) || !(lbs > 0)) return null;
    return Math.round((lbs / h) * 100) / 100;
  }
  function shiftBox(days, shift, strainValue, methodValue, shared) {
    var lbs = 0;
    var h = 0;
    var packages = 0;
    var shiftDays = 0;
    var missingDays = 0;
    for (var d = 0; d < days.length; d++) {
      var day = days[d];
      var allLbs = 0;
      var selLbs = 0;
      var selPackages = 0;
      for (var i = 0; i < points.length; i++) {
        var point = points[i];
        if (point.day !== day || point.shift !== shift) continue;
        allLbs += point.lbs;
        if ((strainValue === "" || point.strain === strainValue) && (methodValue === "" || point.method === methodValue)) {
          selLbs += point.lbs;
          selPackages += point.packages;
        }
      }
      if (!(selLbs > 0)) continue;
      var hoursValue = 0;
      for (var k = 0; k < hours.length; k++) {
        if (hours[k].day === day && hours[k].shift === shift && hours[k].hours > 0) hoursValue = hours[k].hours;
      }
      if (!(hoursValue > 0) || !(allLbs > 0)) {
        missingDays += 1;
        continue;
      }
      lbs += selLbs;
      h += shared ? hoursValue * (selLbs / allLbs) : hoursValue;
      packages += selPackages;
      shiftDays += 1;
    }
    return { lbs: lbs, hours: h, ratio: ratioOf(lbs, h), packages: packages, shiftDays: shiftDays, missingDays: missingDays };
  }
  function countText(n, one, many) {
    if (n === 1) return one || "";
    return fill(many, { n: String(n) });
  }
  function missingText(n) {
    if (n <= 0) return "";
    if (n === 1) return words.missingOne || "";
    return fill(words.missingMany, { n: String(n) });
  }
  function detailText(box, formula) {
    var parts = [formula, fill(words.over, { lb: money(box.lbs), h: money(box.hours) })];
    parts.push(countText(box.packages, words.packagesOne, words.packagesMany));
    parts.push(countText(box.shiftDays, words.daysOne, words.daysMany));
    var missing = missingText(box.missingDays);
    if (missing) parts.push(missing);
    return parts.filter(function (part) { return part; }).join(" ");
  }
  function paint(node, box, formula, shared) {
    if (!node) return;
    var ratio = node.querySelector("[data-dd-tp-ratio]");
    var unit = node.querySelector(".dd-tp-unit");
    var sub = node.querySelector("[data-dd-tp-sub]");
    var note = node.querySelector("[data-dd-tp-note]");
    var figure = box.ratio == null ? (words.noData || "") : money(box.ratio);
    if (ratio) ratio.textContent = figure;
    if (unit) unit.hidden = box.ratio == null;
    if (sub) sub.textContent = box.shiftDays > 0 ? fill(words.sub, { lb: money(box.lbs), h: money(box.hours) }) : "";
    var notes = [];
    if (shared && box.shiftDays > 0 && words.sharedNote) notes.push(words.sharedNote);
    var missing = missingText(box.missingDays);
    if (missing) notes.push(missing);
    if (note) note.textContent = notes.join(" ");
    node.setAttribute("data-dd-tp-detail", detailText(box, formula));
  }
  function render() {
    var kind = period.value === "7" || period.value === "30" || period.value === "htd" ? period.value : "14";
    var strainValue = strain.value || "";
    var methodValue = method.value || "";
    var shared = strainValue !== "" || methodValue !== "";
    var days = windowDays(kind);
    var day = shiftBox(days, "day", strainValue, methodValue, shared);
    var night = shiftBox(days, "second", strainValue, methodValue, shared);
    var weighted = {
      lbs: day.lbs + night.lbs,
      hours: day.hours + night.hours,
      packages: day.packages + night.packages,
      shiftDays: day.shiftDays + night.shiftDays,
      missingDays: day.missingDays + night.missingDays
    };
    weighted.ratio = ratioOf(weighted.lbs, weighted.hours);
    var hasOutput = false;
    var daySet = {};
    for (var d = 0; d < days.length; d++) daySet[days[d]] = true;
    for (var i = 0; i < points.length; i++) {
      var point = points[i];
      if (!daySet[point.day] || !(point.lbs > 0)) continue;
      if (strainValue !== "" && point.strain !== strainValue) continue;
      if (methodValue !== "" && point.method !== methodValue) continue;
      hasOutput = true;
      break;
    }
    if (empty) empty.hidden = hasOutput;
    boxes.hidden = !hasOutput;
    if (!hasOutput) return;
    paint(root.querySelector('[data-dd-tp-box="day"]'), day, shared ? words.dayShared : words.dayFormula, shared);
    paint(root.querySelector('[data-dd-tp-box="second"]'), night, shared ? words.nightShared : words.nightFormula, shared);
    paint(root.querySelector('[data-dd-tp-box="weighted"]'), weighted, shared ? words.weightedShared : words.weightedFormula, shared);
  }
  try {
    var savedPeriod = localStorage.getItem("dd.trim_throughput.period");
    var savedStrain = localStorage.getItem("dd.trim_throughput.strain");
    var savedMethod = localStorage.getItem("dd.trim_throughput.method");
    if (savedPeriod && hasOption(period, savedPeriod)) period.value = savedPeriod;
    if (savedStrain != null && hasOption(strain, savedStrain)) strain.value = savedStrain;
    if (savedMethod != null && hasOption(method, savedMethod)) method.value = savedMethod;
  } catch (e) {}
  render();
  function remember(select, key) {
    select.addEventListener("change", function () {
      try { localStorage.setItem(key, select.value); } catch (e) {}
      render();
    });
  }
  remember(period, "dd.trim_throughput.period");
  remember(strain, "dd.trim_throughput.strain");
  remember(method, "dd.trim_throughput.method");
  var pinned = false;
  function show(box) {
    if (!detail || !box) return;
    detail.textContent = box.getAttribute("data-dd-tp-detail") || "";
    detail.hidden = detail.textContent === "";
  }
  boxes.addEventListener("mouseover", function (ev) {
    var box = ev.target && ev.target.closest ? ev.target.closest("[data-dd-tp-box]") : null;
    if (!pinned) show(box);
  });
  boxes.addEventListener("mouseout", function (ev) {
    if (pinned || !detail) return;
    var next = ev.relatedTarget;
    if (next && boxes.contains(next)) return;
    detail.hidden = true;
  });
  boxes.addEventListener("click", function (ev) {
    var box = ev.target && ev.target.closest ? ev.target.closest("[data-dd-tp-box]") : null;
    if (!box) return;
    pinned = !pinned;
    if (pinned) show(box);
    else if (detail) detail.hidden = true;
  });
  boxes.addEventListener("focusin", function (ev) {
    var box = ev.target && ev.target.closest ? ev.target.closest("[data-dd-tp-box]") : null;
    show(box);
  });
})();
</script>`;

export function trimThroughputBody(model: TrimThroughputModel, locale: Locale): string {
  const view = trimWindow(model, "14", "", "");
  const strains = trimStrainOptions(model);
  const methods = trimMethodOptions(model);
  const periodOptions = PERIODS.map((period) => option(period, period === "htd" ? "HTD" : period === "7" ? "7 days" : period === "30" ? "30 days" : "14 days", period === "14")).join("");
  const strainOptions = [option("", t(locale, "All"), true)].concat(strains.map((name) => option(name, name, false))).join("");
  const methodOptions = [option("", t(locale, "All"), true)].concat(methods.map((name) => option(name, t(locale, name), false))).join("");
  const boxes = view.hasOutput
    ? `${boxHtml("day", "Trim TP Days", view.day, DAY_WORDS, view.shared, locale)}
      ${boxHtml("second", "Trim TP Nights", view.night, NIGHT_WORDS, view.shared, locale)}
      ${boxHtml("weighted", "Weighted TP", view.weighted, WEIGHTED_WORDS, view.shared, locale)}`
    : `${boxHtml("day", "Trim TP Days", emptyBox(), DAY_WORDS, false, locale)}
      ${boxHtml("second", "Trim TP Nights", emptyBox(), NIGHT_WORDS, false, locale)}
      ${boxHtml("weighted", "Weighted TP", emptyBox(), WEIGHTED_WORDS, false, locale)}`;
  const words = {
    noData: t(locale, "No data"),
    sharedNote: t(locale, "hours shared by lbs"),
    missingOne: t(locale, "1 shift day without hours"),
    missingMany: t(locale, "{n} shift days without hours"),
    dayFormula: t(locale, DAY_WORDS.formula),
    dayShared: t(locale, DAY_WORDS.sharedFormula),
    nightFormula: t(locale, NIGHT_WORDS.formula),
    nightShared: t(locale, NIGHT_WORDS.sharedFormula),
    weightedFormula: t(locale, WEIGHTED_WORDS.formula),
    weightedShared: t(locale, WEIGHTED_WORDS.sharedFormula),
    over: t(locale, "{lb} lb over {h} h"),
    sub: t(locale, "{lb} lb, {h} h"),
    packagesOne: t(locale, "1 package"),
    packagesMany: t(locale, "{n} packages"),
    daysOne: t(locale, "1 shift day"),
    daysMany: t(locale, "{n} shift days"),
  };
  const payload = {
    today: model.today,
    points: model.points.map((point) => ({
      day: point.day,
      shift: point.shift,
      strain: point.strain,
      method: point.method,
      lbs: point.lbs,
      packages: point.packages,
    })),
    hours: model.hours,
    words,
  };
  return `<div class="dd-tp" data-dd-tp>
      <div class="dd-tp-picks">
        <label>${esc(t(locale, "Period"))}
          <select data-dd-tp-period aria-label="${esc(t(locale, "Period"))}">${periodOptions}</select>
        </label>
        <label>${esc(t(locale, "Strain"))}
          <select data-dd-tp-strain aria-label="${esc(t(locale, "Strain"))}">${strainOptions}</select>
        </label>
        <label>${esc(t(locale, "Dry Method"))}
          <select data-dd-tp-method aria-label="${esc(t(locale, "Dry Method"))}">${methodOptions}</select>
        </label>
      </div>
      <p class="dd-tp-empty" data-dd-tp-empty${view.hasOutput ? " hidden" : ""}>${esc(t(locale, "No data"))}</p>
      <div class="dd-tp-boxes" data-dd-tp-boxes${view.hasOutput ? "" : " hidden"}>${boxes}</div>
      <p class="dd-tp-detail" data-dd-tp-detail hidden></p>
      <script type="application/json" data-dd-tp-json>${safeJson(payload)}</script>
      ${TRIM_SCRIPT}
    </div>`;
}

export const TRIM_PACKAGE_SQL = `SELECT
       CASE WHEN p.trim_date IS NOT NULL AND length(trim(p.trim_date)) = 10 THEN trim(p.trim_date) ELSE '' END AS trim_date,
       substr(p.created_at, 1, 13) AS hour_key,
       COALESCE(p.trim_operator, '') AS operator_name,
       COALESCE(b.market_strain, '') AS market_strain,
       COALESCE(s.name, '') AS strain_name,
       COALESCE(d.space_type, '') AS space_type,
       COALESCE(d.kind, '') AS space_kind,
       COALESCE(SUM(p.weight_grams), 0) AS grams,
       COUNT(*) AS n,
       MAX(p.created_at) AS newest
     FROM wip_packages p
     LEFT JOIN wet_weight_entries w ON w.id = p.wet_weight_entry_id
     LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
     LEFT JOIN strains s ON s.id = b.strain_id
     LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
     WHERE p.deleted_at IS NULL AND ${NON_TRIM_SOURCE_SQL}
       AND (
         (p.trim_date >= ? AND p.trim_date <= ?)
         OR (p.trim_date IS NULL AND p.created_at >= ? AND p.created_at < ?)
       )
     GROUP BY
       CASE WHEN p.trim_date IS NOT NULL AND length(trim(p.trim_date)) = 10 THEN trim(p.trim_date) ELSE '' END,
       substr(p.created_at, 1, 13),
       COALESCE(p.trim_operator, ''),
       COALESCE(b.market_strain, ''),
       COALESCE(s.name, ''),
       COALESCE(d.space_type, ''),
       COALESCE(d.kind, '')`;

export const TRIM_HOURS_SQL = `SELECT work_date, shift, hours, updated_at AS newest
     FROM trim_labor_hours
     WHERE work_date >= ? AND work_date <= ?`;

export const TRIM_SERIES_SQL = `SELECT period_start, dim_key, value, n
     FROM dd_kpi_values
     WHERE kpi_key = '${TRIM_THROUGHPUT_KPI}' AND period_kind = 'day' AND source = 'app' AND superseded_at IS NULL
       AND period_start >= ? AND period_start <= ?`;

export function trimSeriesStatement(db: D1Database, yearStart: string, yearEnd: string): D1PreparedStatement {
  return db.prepare(TRIM_SERIES_SQL).bind(yearStart, yearEnd);
}

export type TrimThroughputRefresh = { written: number; year: number; grams: number };

const TRIM_LIVE_SQL = `SELECT id, period_start, dim_key, value, n, source_as_of
     FROM dd_kpi_values
     WHERE kpi_key = '${TRIM_THROUGHPUT_KPI}' AND period_kind = 'day' AND source = 'app' AND superseded_at IS NULL
       AND period_start >= ? AND period_start <= ?`;

function cents(value: number): number {
  return Math.round(value * 100);
}

/**
 * Rewrite the harvest year's live rows. An unchanged value and package count
 * is left alone. A day that drops to zero is restated as 0. At most 8 binds
 * on an insert and 2 on a supersede.
 */
export async function refreshTrimThroughput(db: D1Database, nowIso: string): Promise<TrimThroughputRefresh> {
  const startHour = parseFarmDayStartHour(await getConfigValue(db, CONFIG_KEYS.farm_day_start_hour));
  const today = farmDay(nowIso, startHour);
  const year = Number(today.slice(0, 4));
  if (!Number.isFinite(year)) return { written: 0, year: 0, grams: 0 };
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const bounds = { start: farmDayBounds(start, startHour).startIso, end: farmDayBounds(end, startHour).endIso };
  const [dayOpsRaw, secondOpsRaw, packageRows, hourRows, liveRows] = await Promise.all([
    getConfigValue(db, CONFIG_KEYS.trim_shift_day_operators),
    getConfigValue(db, CONFIG_KEYS.trim_shift_second_operators),
    db.prepare(TRIM_PACKAGE_SQL).bind(start, end, bounds.start, bounds.end).all<Record<string, unknown>>(),
    db.prepare(TRIM_HOURS_SQL).bind(start, end).all<Record<string, unknown>>(),
    db.prepare(TRIM_LIVE_SQL).bind(start, end).all<Record<string, unknown>>(),
  ]);
  const desired = planTrimRows({
    year,
    startHour,
    dayOperators: parseNameList(dayOpsRaw),
    secondOperators: parseNameList(secondOpsRaw),
    packages: (packageRows.results ?? []).map((row) => ({
      trimDate: String(row.trim_date ?? ""),
      createdAt: String(row.hour_key ?? ""),
      operator: String(row.operator_name ?? ""),
      marketStrain: String(row.market_strain ?? ""),
      strainName: String(row.strain_name ?? ""),
      spaceType: String(row.space_type ?? ""),
      spaceKind: String(row.space_kind ?? ""),
      grams: Number(row.grams ?? 0),
      n: Number(row.n ?? 0),
      newest: String(row.newest ?? ""),
    })),
    hours: (hourRows.results ?? []).map((row) => ({
      workDate: String(row.work_date ?? ""),
      shift: String(row.shift ?? ""),
      hours: Number(row.hours ?? 0),
      newest: String(row.newest ?? ""),
    })),
  });
  const wanted = new Map<string, TrimDesired>();
  let grams = 0;
  for (const row of desired) {
    wanted.set(`${row.day}|${row.dim}`, row);
    if (!row.dim.startsWith("hours|")) grams += row.value * GRAMS_PER_LB;
  }
  type Live = { id: string; day: string; dim: string; value: number; n: number; source_as_of: string | null };
  const live: Live[] = (liveRows.results ?? []).map((row) => ({
    id: String(row.id),
    day: String(row.period_start),
    dim: String(row.dim_key ?? ""),
    value: Number(row.value ?? 0),
    n: Number(row.n ?? 0),
    source_as_of: row.source_as_of == null ? null : String(row.source_as_of),
  }));
  type Write = { supersede: string | null; day: string; dim: string; value: number; n: number; newest: string };
  const writes: Write[] = [];
  for (const row of live) {
    const next = wanted.get(`${row.day}|${row.dim}`);
    if (next) {
      wanted.delete(`${row.day}|${row.dim}`);
      if (cents(row.value) === cents(next.value) && row.n === next.n) continue;
      writes.push({ supersede: row.id, day: next.day, dim: next.dim, value: next.value, n: next.n, newest: next.newest || nowIso });
      continue;
    }
    if (cents(row.value) === 0 && row.n === 0) continue;
    writes.push({ supersede: row.id, day: row.day, dim: row.dim, value: 0, n: 0, newest: row.source_as_of || nowIso });
  }
  for (const next of wanted.values()) {
    writes.push({ supersede: null, day: next.day, dim: next.dim, value: next.value, n: next.n, newest: next.newest || nowIso });
  }
  const stmts: D1PreparedStatement[] = [];
  for (const write of writes) {
    if (write.supersede) {
      stmts.push(db.prepare(`UPDATE dd_kpi_values SET superseded_at = ? WHERE id = ? AND superseded_at IS NULL`).bind(nowIso, write.supersede));
    }
    stmts.push(
      db
        .prepare(
          `INSERT INTO dd_kpi_values (
             id, kpi_key, period_kind, period_start, dim_key, value, n, source, source_as_of, computed_at, def_version, created_at
           ) VALUES (?, '${TRIM_THROUGHPUT_KPI}', 'day', ?, ?, ?, ?, 'app', ?, ?, ${TRIM_THROUGHPUT_VERSION}, ?)`
        )
        .bind(crypto.randomUUID(), write.day, write.dim, write.value, write.n, write.newest, nowIso, nowIso)
    );
  }
  for (let i = 0; i < stmts.length; i += 40) {
    await db.batch(stmts.slice(i, i + 40));
  }
  return { written: writes.length, year, grams };
}
