/**
 * DD S3g: Testing Throughput on the Business Operations wall, beside BTR.
 * Tests/Day, COAs/Day and TAT are read from lab_samples, grouped by day.
 * A day counts only when that day has a sample or a COA. Pounds are not here.
 */

import { formatGrams } from "./config";
import { etDate } from "./farmday";
import { t, type Locale } from "./i18n";
import { esc } from "./ui";

export const TESTING_THROUGHPUT_KPI = "bizops.testing_throughput";

export const TEST_TYPE_ORDER = ["First-time", "Retest", "Internal QA"] as const;

export type TestingPeriod = "7" | "14" | "30" | "htd";

export type TestingDay = { day: string; type: string; n: number };

export type TestingTatDay = { day: string; type: string; n: number; sum: number };

export type TestingModel = {
  today: string;
  nowIso: string;
  lastLoadAt: string | null;
  intake: TestingDay[];
  coas: TestingDay[];
  tat: TestingTatDay[];
};

export type TestingSplit = {
  type: string;
  tests: number;
  testDays: number;
  coas: number;
  coaDays: number;
  tatSum: number;
  tatN: number;
};

export type TestingWindow = {
  tests: number;
  testDays: number;
  testsPerDay: number | null;
  coas: number;
  coaDays: number;
  coasPerDay: number | null;
  tatSum: number;
  tatN: number;
  tat: number | null;
  splits: TestingSplit[];
  empty: boolean;
};

export function canonicalTestType(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s.startsWith("first")) return "First-time";
  if (s.startsWith("retest") || s.startsWith("re-test")) return "Retest";
  if (s.includes("qa") || s.includes("internal")) return "Internal QA";
  const shown = String(raw ?? "").trim();
  return shown || "Other";
}

function dayOffset(day: string, delta: number): string {
  const ms = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return day;
  return new Date(ms + delta * 86400000).toISOString().slice(0, 10);
}

export function testingWindowDays(period: TestingPeriod, today: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return [];
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

function oneDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

function inWindow(day: string, days: ReadonlySet<string>): boolean {
  return days.has(day);
}

export function testingWindowOf(model: TestingModel, period: TestingPeriod): TestingWindow {
  const days = new Set(testingWindowDays(period, model.today));
  const types = new Set<string>();
  const splits = new Map<string, TestingSplit>();
  const split = (type: string): TestingSplit => {
    const key = canonicalTestType(type);
    types.add(key);
    let row = splits.get(key);
    if (!row) {
      row = { type: key, tests: 0, testDays: 0, coas: 0, coaDays: 0, tatSum: 0, tatN: 0 };
      splits.set(key, row);
    }
    return row;
  };
  const testDaySeen = new Map<string, Set<string>>();
  const coaDaySeen = new Map<string, Set<string>>();
  let tests = 0;
  const testDays = new Set<string>();
  for (const row of model.intake) {
    if (!inWindow(row.day, days) || !(row.n > 0)) continue;
    tests += row.n;
    testDays.add(row.day);
    const part = split(row.type);
    part.tests += row.n;
    const seen = testDaySeen.get(part.type) ?? new Set<string>();
    seen.add(row.day);
    testDaySeen.set(part.type, seen);
  }
  let coas = 0;
  const coaDays = new Set<string>();
  for (const row of model.coas) {
    if (!inWindow(row.day, days) || !(row.n > 0)) continue;
    coas += row.n;
    coaDays.add(row.day);
    const part = split(row.type);
    part.coas += row.n;
    const seen = coaDaySeen.get(part.type) ?? new Set<string>();
    seen.add(row.day);
    coaDaySeen.set(part.type, seen);
  }
  let tatSum = 0;
  let tatN = 0;
  for (const row of model.tat) {
    if (!inWindow(row.day, days) || !(row.n > 0)) continue;
    tatSum += row.sum;
    tatN += row.n;
    const part = split(row.type);
    part.tatSum += row.sum;
    part.tatN += row.n;
  }
  for (const [type, row] of splits) {
    row.testDays = testDaySeen.get(type)?.size ?? 0;
    row.coaDays = coaDaySeen.get(type)?.size ?? 0;
  }
  const ordered = [...TEST_TYPE_ORDER.filter((type) => splits.has(type)), ...[...splits.keys()].filter((type) => !TEST_TYPE_ORDER.includes(type as (typeof TEST_TYPE_ORDER)[number])).sort()];
  return {
    tests,
    testDays: testDays.size,
    testsPerDay: testDays.size > 0 ? oneDecimal(tests / testDays.size) : null,
    coas,
    coaDays: coaDays.size,
    coasPerDay: coaDays.size > 0 ? oneDecimal(coas / coaDays.size) : null,
    tatSum,
    tatN,
    tat: tatN > 0 ? oneDecimal(tatSum / tatN) : null,
    splits: ordered.map((type) => splits.get(type) as TestingSplit),
    empty: tests === 0 && coas === 0,
  };
}

export function loadIsStale(at: string | null, nowIso: string): boolean {
  if (!at) return true;
  const loaded = Date.parse(at);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(loaded) || !Number.isFinite(now)) return true;
  return now - loaded > 24 * 60 * 60 * 1000;
}

export function tagleafLoadedText(at: string): string {
  const d = new Date(at);
  if (!Number.isFinite(d.getTime())) return at;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function foldHour(hour: string): string {
  const text = String(hour ?? "");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(text)) return etDate(`${text}:00:00.000Z`);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return etDate(text);
  return text.slice(0, 10);
}

export function testingModelFromRows(
  intakeRows: ReadonlyArray<{ day: string; test_type: string; n: number }>,
  coaRows: ReadonlyArray<{ hour: string; test_type: string; n: number; tat_sum: number; tat_n: number }>,
  lastRaw: string | null,
  today: string,
  nowIso: string
): TestingModel {
  const coaMap = new Map<string, TestingDay>();
  const tatMap = new Map<string, TestingTatDay>();
  for (const row of coaRows) {
    const day = foldHour(row.hour);
    const type = canonicalTestType(row.test_type);
    const key = `${day}\n${type}`;
    const coa = coaMap.get(key) ?? { day, type, n: 0 };
    coa.n += Number(row.n) || 0;
    coaMap.set(key, coa);
    const tatN = Number(row.tat_n) || 0;
    if (tatN > 0) {
      const tat = tatMap.get(key) ?? { day, type, n: 0, sum: 0 };
      tat.n += tatN;
      tat.sum += Number(row.tat_sum) || 0;
      tatMap.set(key, tat);
    }
  }
  let lastLoadAt: string | null = null;
  if (lastRaw) {
    try {
      const parsed = JSON.parse(lastRaw) as { at?: unknown };
      if (parsed && typeof parsed.at === "string") lastLoadAt = parsed.at;
    } catch {
      lastLoadAt = null;
    }
  }
  return {
    today,
    nowIso,
    lastLoadAt,
    intake: intakeRows.map((row) => ({ day: String(row.day), type: canonicalTestType(row.test_type), n: Number(row.n) || 0 })),
    coas: [...coaMap.values()],
    tat: [...tatMap.values()],
  };
}

export function testingIntakeStatement(db: D1Database, from: string, to: string): D1PreparedStatement {
  return db
    .prepare(
      `SELECT intake_date AS day, COALESCE(test_type, '') AS test_type, COUNT(*) AS n
       FROM lab_samples
       WHERE intake_date >= ? AND intake_date <= ?
       GROUP BY intake_date, test_type`
    )
    .bind(from, to);
}

export function testingCoaStatement(db: D1Database, fromIso: string, toIso: string): D1PreparedStatement {
  return db
    .prepare(
      `SELECT substr(coa_posted_at, 1, 13) AS hour, COALESCE(test_type, '') AS test_type,
              COUNT(*) AS n,
              SUM(CASE WHEN tat_days IS NULL THEN 0 ELSE tat_days END) AS tat_sum,
              SUM(CASE WHEN tat_days IS NULL THEN 0 ELSE 1 END) AS tat_n
       FROM lab_samples
       WHERE coa_posted_at IS NOT NULL AND coa_posted_at >= ? AND coa_posted_at < ?
       GROUP BY substr(coa_posted_at, 1, 13), test_type`
    )
    .bind(fromIso, toIso);
}

function numText(n: number | null): string {
  if (n == null) return "";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function countLine(n: number, days: number, what: string, dayWord: string, over: string): string {
  return `${formatGrams(n)} ${what} ${over} ${formatGrams(days)} ${dayWord}`;
}

function splitLine(row: TestingSplit, kind: "tests" | "coas" | "tat", locale: Locale): string {
  const over = t(locale, "over");
  const none = t(locale, "No data");
  if (kind === "tests") {
    const rate = row.testDays > 0 ? numText(oneDecimal(row.tests / row.testDays)) : none;
    return `${row.type} ${rate} (${formatGrams(row.tests)} ${over} ${formatGrams(row.testDays)})`;
  }
  if (kind === "coas") {
    const rate = row.coaDays > 0 ? numText(oneDecimal(row.coas / row.coaDays)) : none;
    return `${row.type} ${rate} (${formatGrams(row.coas)} ${over} ${formatGrams(row.coaDays)})`;
  }
  const rate = row.tatN > 0 ? `${numText(oneDecimal(row.tatSum / row.tatN))} ${t(locale, "days")}` : none;
  return `${row.type} ${rate} (${formatGrams(row.tatN)})`;
}

export function testingThroughputBody(model: TestingModel, locale: Locale): string {
  const view = testingWindowOf(model, "14");
  // Each box carries its split in data-dd-test-split; the one paragraph under the
  // boxes (data-dd-test-detail) shows it on hover, focus or tap.
  const box = (key: "tests" | "coas" | "tat", title: string, value: string, under: string, detail: string) =>
    `<div class="dd-test-box" data-dd-test-box="${key}" tabindex="0" data-dd-test-split="${esc(detail)}">
      <span class="dd-test-label">${esc(t(locale, title))}</span>
      <b class="dd-test-value">${esc(value)}</b>
      <span class="dd-test-under">${esc(under)}</span>
    </div>`;
  const testsValue = view.testsPerDay == null ? t(locale, "No data") : numText(view.testsPerDay);
  const coasValue = view.coasPerDay == null ? t(locale, "No data") : numText(view.coasPerDay);
  const tatValue = view.tat == null ? t(locale, "No data") : `${numText(view.tat)} ${t(locale, "days")}`;
  const testsUnder = view.testDays > 0 ? countLine(view.tests, view.testDays, t(locale, "tests"), t(locale, view.testDays === 1 ? "intake day" : "intake days"), t(locale, "over")) : "";
  const coasUnder = view.coaDays > 0 ? countLine(view.coas, view.coaDays, t(locale, "COAs"), t(locale, view.coaDays === 1 ? "COA day" : "COA days"), t(locale, "over")) : "";
  const tatUnder = view.tatN > 0 ? `${formatGrams(view.tatN)} ${t(locale, "completed")}` : "";
  const stale = loadIsStale(model.lastLoadAt, model.nowIso);
  const loaded = model.lastLoadAt
    ? `${t(locale, "TagLeaf last loaded")} ${tagleafLoadedText(model.lastLoadAt)}`
    : t(locale, "TagLeaf not loaded");
  const payload = JSON.stringify({
    today: model.today,
    intake: model.intake,
    coas: model.coas,
    tat: model.tat,
    words: {
      noData: t(locale, "No data"),
      days: t(locale, "days"),
      tests: t(locale, "tests"),
      intakeDay: t(locale, "intake day"),
      intakeDays: t(locale, "intake days"),
      coas: t(locale, "COAs"),
      coaDay: t(locale, "COA day"),
      coaDays: t(locale, "COA days"),
      completed: t(locale, "completed"),
      over: t(locale, "over"),
    },
  }).replaceAll("<", "\\u003c");
  return `<div class="dd-test" data-dd-test data-dd-test-empty="${view.empty ? "1" : "0"}">
    <label class="dd-test-period">${esc(t(locale, "Period"))}
      <select data-dd-test-period>
        <option value="7">${esc(t(locale, "7 days"))}</option>
        <option value="14" selected>${esc(t(locale, "14 days"))}</option>
        <option value="30">${esc(t(locale, "30 days"))}</option>
        <option value="htd">${esc(t(locale, "HTD"))}</option>
      </select>
    </label>
    <p class="dd-test-empty" data-dd-test-empty-line${view.empty ? "" : " hidden"}>${esc(t(locale, "No data"))}</p>
    <div class="dd-test-boxes"${view.empty ? " hidden" : ""}>
      ${box("tests", "AVG Tests/Day", testsValue, testsUnder, view.splits.map((row) => splitLine(row, "tests", locale)).join("; "))}
      ${box("coas", "AVG COAs/Day", coasValue, coasUnder, view.splits.map((row) => splitLine(row, "coas", locale)).join("; "))}
      ${box("tat", "AVG TAT", tatValue, tatUnder, view.splits.map((row) => splitLine(row, "tat", locale)).join("; "))}
    </div>
    <p class="dd-test-detail" data-dd-test-detail hidden></p>
    <p class="dd-test-load${stale ? " is-stale" : ""}" data-dd-test-load>${esc(loaded)}</p>
    <script type="application/json" data-dd-test-payload>${payload}</script>
  </div>
<script>
(function () {
  var root = document.querySelector("[data-dd-test]");
  if (!root) return;
  var payloadEl = root.querySelector("[data-dd-test-payload]");
  var period = root.querySelector("[data-dd-test-period]");
  var empty = root.querySelector("[data-dd-test-empty-line]");
  var boxes = root.querySelector(".dd-test-boxes");
  var detail = root.querySelector("p[data-dd-test-detail]");
  var data = {};
  try { data = JSON.parse(payloadEl ? payloadEl.textContent || "{}" : "{}"); } catch (e) { data = {}; }
  var today = String(data.today || "");
  function addDays(day, delta) {
    var ms = Date.parse(day + "T00:00:00.000Z");
    if (!isFinite(ms)) return day;
    return new Date(ms + delta * 86400000).toISOString().slice(0, 10);
  }
  function daysOf(kind) {
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
  function grouped(n) {
    var whole = String(Math.round(Math.abs(n)));
    whole = whole.replace(/\\B(?=(\\d{3})+$)/g, ",");
    return n < 0 ? "-" + whole : whole;
  }
  function one(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function render() {
    if (!period) return;
    var set = {};
    daysOf(period.value).forEach(function (day) { set[day] = true; });
    var tests = 0, testDays = {}, coas = 0, coaDays = {}, tatSum = 0, tatN = 0;
    var byType = {};
    function part(type) {
      var key = String(type || "Other");
      if (!byType[key]) byType[key] = { type: key, tests: 0, testDays: {}, coas: 0, coaDays: {}, tatSum: 0, tatN: 0 };
      return byType[key];
    }
    (data.intake || []).forEach(function (row) {
      if (!set[row.day] || !(row.n > 0)) return;
      tests += row.n;
      testDays[row.day] = true;
      var rowPart = part(row.type);
      rowPart.tests += row.n;
      rowPart.testDays[row.day] = true;
    });
    (data.coas || []).forEach(function (row) {
      if (!set[row.day] || !(row.n > 0)) return;
      coas += row.n;
      coaDays[row.day] = true;
      var rowPart = part(row.type);
      rowPart.coas += row.n;
      rowPart.coaDays[row.day] = true;
    });
    (data.tat || []).forEach(function (row) {
      if (!set[row.day] || !(row.n > 0)) return;
      tatSum += row.sum;
      tatN += row.n;
      var rowPart = part(row.type);
      rowPart.tatSum += row.sum;
      rowPart.tatN += row.n;
    });
    var w = data.words || {};
    var over = w.over || "over";
    var td = Object.keys(testDays).length;
    var cd = Object.keys(coaDays).length;
    var none = tests === 0 && coas === 0;
    if (empty) empty.hidden = !none;
    if (boxes) boxes.hidden = none;
    root.setAttribute("data-dd-test-empty", none ? "1" : "0");
    function splitText(kind) {
      var order = ["First-time", "Retest", "Internal QA"];
      var names = Object.keys(byType);
      names.sort(function (a, b) {
        var ia = order.indexOf(a);
        var ib = order.indexOf(b);
        if (ia < 0) ia = 99;
        if (ib < 0) ib = 99;
        if (ia !== ib) return ia - ib;
        return a < b ? -1 : a > b ? 1 : 0;
      });
      return names.map(function (name) {
        var row = byType[name];
        var tdn = Object.keys(row.testDays).length;
        var cdn = Object.keys(row.coaDays).length;
        if (kind === "tests") {
          var rate = tdn > 0 ? one(row.tests / tdn) : (w.noData || "No data");
          return row.type + " " + rate + " (" + grouped(row.tests) + " " + over + " " + grouped(tdn) + ")";
        }
        if (kind === "coas") {
          var rateC = cdn > 0 ? one(row.coas / cdn) : (w.noData || "No data");
          return row.type + " " + rateC + " (" + grouped(row.coas) + " " + over + " " + grouped(cdn) + ")";
        }
        var rateT = row.tatN > 0 ? one(row.tatSum / row.tatN) + " " + (w.days || "days") : (w.noData || "No data");
        return row.type + " " + rateT + " (" + grouped(row.tatN) + ")";
      }).join("; ");
    }
    function paint(key, value, under, detailText) {
      var box = root.querySelector('[data-dd-test-box="' + key + '"]');
      if (!box) return;
      var val = box.querySelector(".dd-test-value");
      var sub = box.querySelector(".dd-test-under");
      if (val) val.textContent = value;
      if (sub) sub.textContent = under;
      box.setAttribute("data-dd-test-split", detailText);
    }
    var testsUnder = td > 0 ? grouped(tests) + " " + (w.tests || "tests") + " " + over + " " + grouped(td) + " " + (td === 1 ? (w.intakeDay || "intake day") : (w.intakeDays || "intake days")) : "";
    var coasUnder = cd > 0 ? grouped(coas) + " " + (w.coas || "COAs") + " " + over + " " + grouped(cd) + " " + (cd === 1 ? (w.coaDay || "COA day") : (w.coaDays || "COA days")) : "";
    var tatUnder = tatN > 0 ? grouped(tatN) + " " + (w.completed || "completed") : "";
    paint("tests", td > 0 ? one(tests / td) : (w.noData || "No data"), testsUnder, splitText("tests"));
    paint("coas", cd > 0 ? one(coas / cd) : (w.noData || "No data"), coasUnder, splitText("coas"));
    paint("tat", tatN > 0 ? one(tatSum / tatN) + " " + (w.days || "days") : (w.noData || "No data"), tatUnder, splitText("tat"));
  }
  try {
    var saved = localStorage.getItem("dd.testing_throughput.period");
    if (period && saved && period.querySelector('option[value="' + saved + '"]')) period.value = saved;
  } catch (e) {}
  render();
  if (period) period.addEventListener("change", function () {
    try { localStorage.setItem("dd.testing_throughput.period", period.value); } catch (e) {}
    render();
    if (detail) { detail.textContent = ""; detail.hidden = true; }
  });
  function show(box) {
    if (!detail || !box) return;
    detail.textContent = box.getAttribute("data-dd-test-split") || "";
    detail.hidden = detail.textContent === "";
  }
  if (boxes) {
    boxes.addEventListener("mouseover", function (ev) {
      var box = ev.target && ev.target.closest ? ev.target.closest("[data-dd-test-box]") : null;
      show(box);
    });
    boxes.addEventListener("click", function (ev) {
      var box = ev.target && ev.target.closest ? ev.target.closest("[data-dd-test-box]") : null;
      show(box);
    });
    boxes.addEventListener("focusin", function (ev) {
      var box = ev.target && ev.target.closest ? ev.target.closest("[data-dd-test-box]") : null;
      show(box);
    });
  }
})();
</script>`;
}
