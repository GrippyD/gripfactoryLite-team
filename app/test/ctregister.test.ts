import { describe, expect, it } from "vitest";
import {
  CT_REGISTER_BASE,
  CT_REGISTER_CARDS,
  ctRegisterBase,
  ctRegisterWallPage,
  ctSparkSvg,
  ctValue,
  parseCtFeed,
  readCtRegister,
  type CtRead,
} from "../src/ctregister";
import { DIRECTOR_PATH, directorHomePage, loadDirectorHome } from "../src/director";
import { migratedDb } from "./migrated";

const NOW = "2026-10-28T15:00:00.000Z";
const TOKEN = "test-token-not-a-secret";

/** An invented feed in the register's shape: round numbers, invented partners, never the live sample. */
function feedDoc(over: { days?: string[]; drop?: string[] } = {}) {
  const days = over.days ?? ["2026-10-01", "2026-10-02", "2026-10-03"];
  const rows: unknown[] = [];
  for (const day of [...days].reverse()) {
    const last = day === days[days.length - 1];
    for (const card of CT_REGISTER_CARDS) {
      if (last && over.drop?.includes(card.kpi)) continue;
      const series = card.show.map((key, i) => ({ key, label: `${key} label`, value: 100 + i * 1000 }));
      if (card.kpi === "r02") {
        series[1] = { key: "first_pass", label: "First pass %", value: null, held: true } as never;
      }
      if (card.kpi === "r07") {
        series[0] = { key: "offered", label: "Offered ($)", value: 54321 };
      }
      if (card.kpi === "r01" && day === days[1]) series[1] = { key: "dli7_PNN", label: "PNN 7 day light", value: null, held: true } as never;
      rows.push({
        day,
        kpi: card.kpi,
        status: card.kpi === "r03" ? "action" : card.kpi === "r01" ? "watch" : card.kpi === "r05" ? "building" : "nominal",
        headline: card.kpi === "r04" ? "Leader <script>alert(1)</script> & co" : `${card.reg} headline for ${day}`,
        reasons: card.kpi === "r03" ? [{ level: "action", text: "The season projects under plan." }, "A plain string reason"] : [],
        series,
        unread: card.kpi === "r03" ? ["allocation sheet: latest read is 2026-09-30"] : [],
        rule_version: "kpi-1",
        computed_at: `${day}T11:00:00Z`,
      });
    }
  }
  rows.push({ day: "2026-10-03", kpi: "r99", status: "nominal", headline: "unknown kpi", series: [] });
  rows.push({ day: "Oct 3", kpi: "r01", status: "nominal", headline: "bad day", series: [] });
  return { ok: true, feed: "kpi-register", generated_at: NOW, days: days.length, rule_version: "kpi-1", rows, bad_json: [] };
}

function fakeFetch(answer: { status: number; body: unknown } | Error) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    if (answer instanceof Error) throw answer;
    return new Response(typeof answer.body === "string" ? answer.body : JSON.stringify(answer.body), { status: answer.status });
  };
  return { impl, calls };
}

describe("CT1, THE C&T WALL IS THE REGISTER (canon 0.30.558)", () => {
  it("reads the feed's shape and drops rows of an unknown KPI or day", () => {
    const feed = parseCtFeed(feedDoc());
    expect(feed).not.toBeNull();
    expect(feed?.rows).toHaveLength(21);
    const r03 = feed?.rows.find((r) => r.kpi === "r03" && r.day === "2026-10-03");
    expect(r03?.status).toBe("action");
    expect(r03?.reasons).toEqual([
      { level: "action", text: "The season projects under plan." },
      { level: "", text: "A plain string reason" },
    ]);
    const held = feed?.rows.find((r) => r.kpi === "r02")?.series.find((p) => p.key === "first_pass");
    expect(held).toEqual({ key: "first_pass", label: "First pass %", value: null, held: true });
    expect(parseCtFeed({ ok: false, error: "nope" })).toBeNull();
    expect(parseCtFeed({ ok: true })).toBeNull();
    expect(parseCtFeed("not json")).toBeNull();
    expect(parseCtFeed({ ok: true, rows: [{ day: "2026-10-01", kpi: "r01", status: "purple", headline: 7 }] })?.rows[0]).toMatchObject({ status: "building", headline: "" });
  });

  it("sends the token to Field Ops alone, never follows a redirect, and never returns the token", async () => {
    expect(ctRegisterBase({})).toBe(CT_REGISTER_BASE);
    expect(ctRegisterBase({ KPI_FEED_BASE: "http://127.0.0.1:8899/" })).toBe("http://127.0.0.1:8899");
    expect(ctRegisterBase({ KPI_FEED_BASE: "http://localhost" })).toBe("http://localhost");
    expect(ctRegisterBase({ KPI_FEED_BASE: "https://elsewhere.example.com" })).toBe(CT_REGISTER_BASE);
    expect(ctRegisterBase({ KPI_FEED_BASE: "http://127.0.0.1.example.com" })).toBe(CT_REGISTER_BASE);

    const none = fakeFetch({ status: 200, body: feedDoc() });
    expect(await readCtRegister({}, none.impl, NOW)).toEqual({ kind: "no_token", readAt: NOW });
    expect(none.calls).toHaveLength(0);

    const ok = fakeFetch({ status: 200, body: feedDoc() });
    const read = await readCtRegister({ KPI_FEED_TOKEN: TOKEN }, ok.impl, NOW);
    expect(read.kind).toBe("ok");
    expect(ok.calls).toHaveLength(1);
    expect(ok.calls[0]?.url).toBe(`${CT_REGISTER_BASE}/api/kpi/feed?days=30`);
    expect(ok.calls[0]?.init?.redirect).toBe("manual");
    expect((ok.calls[0]?.init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.stringify(read)).not.toContain(TOKEN);

    const answers: Array<[{ status: number; body: unknown } | Error, Partial<CtRead>]> = [
      [{ status: 401, body: { ok: false, error: "missing or wrong token" } }, { kind: "refused", status: 401, error: "missing or wrong token" }],
      [{ status: 503, body: { ok: false, error: "the token is not set up yet" } }, { kind: "refused", status: 503, error: "the token is not set up yet" }],
      [{ status: 302, body: "" }, { kind: "refused", status: 302, error: "" }],
      [{ status: 200, body: "<html>not the feed</html>" }, { kind: "bad_feed" }],
      [{ status: 200, body: { ok: true, nothing: [] } }, { kind: "bad_feed" }],
      [new TypeError("network down"), { kind: "unreachable" }],
      [Object.assign(new Error("aborted"), { name: "AbortError" }), { kind: "timeout" }],
    ];
    for (const [answer, want] of answers) {
      const f = fakeFetch(answer);
      const got = await readCtRegister({ KPI_FEED_TOKEN: TOKEN }, f.impl, NOW);
      expect(got).toMatchObject(want);
      expect(JSON.stringify(got)).not.toContain(TOKEN);
    }
  });

  it("prints a recorded number as the board editions do: held, n/a, dollars, separators, one decimal", () => {
    expect(ctValue({ key: "first_pass", label: "First pass %", value: null, held: true }, "en")).toBe("held");
    expect(ctValue({ key: "first_pass", label: "First pass %", value: null, held: true }, "es")).toBe("retenido");
    expect(ctValue({ key: "pins7", label: "Pins", value: null, held: false }, "en")).toBe("n/a");
    expect(ctValue({ key: "pins7", label: "Pins", value: null, held: false }, "es")).toBe("n/d");
    expect(ctValue(undefined, "en")).toBe("n/a");
    expect(ctValue({ key: "offered", label: "Offered", value: 123456, held: false }, "en")).toBe("$123,456");
    expect(ctValue({ key: "spend", label: "Spend ($)", value: 950, held: false }, "en")).toBe("$950");
    expect(ctValue({ key: "proj_dry", label: "Projected dry lb", value: 416127.4, held: false }, "en")).toBe("416,127");
    expect(ctValue({ key: "pct_plan", label: "% of plan", value: 69.44, held: false }, "en")).toBe("69.4");
    expect(ctValue({ key: "pct_plan", label: "% of plan", value: 0, held: false }, "en")).toBe("0");
  });

  it("draws one number across the days and breaks the line at a held or missing day", () => {
    const svg = ctSparkSvg([1, 2, null, 3]);
    expect(svg.match(/<polyline /g)).toHaveLength(1);
    expect(svg.match(/<circle /g)).toHaveLength(1);
    expect(svg).toContain('data-ct-spark-points="3"');
    expect(ctSparkSvg([null, null])).toBe("");
    expect(ctSparkSvg([5, 5, 5])).toContain('points="0.0,16.0 60.0,16.0 120.0,16.0"');
  });

  it("renders the seven cards as recorded, escaped, in the register's order, in EN and ES", () => {
    const feed = parseCtFeed(feedDoc({ drop: ["r06"] }));
    if (!feed) throw new Error("no feed");
    const read: CtRead = { kind: "ok", feed, readAt: NOW };
    const en = ctRegisterWallPage(read, "en");
    expect(en).toContain('data-dd-wall="culttech"');
    expect(en).toContain('data-ct-register="ok"');
    expect(en).toContain('data-ct-days="3"');
    expect(en).toContain('data-ct-latest="2026-10-03"');
    expect([...en.matchAll(/data-ct-kpi="(r0\d)"/g)].map((m) => m[1])).toEqual(["r01", "r02", "r03", "r04", "r05", "r06", "r07"]);
    expect([...en.matchAll(/data-ct-status="([a-z]+)"/g)].map((m) => m[1])).toEqual(["watch", "nominal", "action", "nominal", "building", "missing", "nominal"]);
    expect(en).toContain("CT-R03 headline for 2026-10-03");
    expect(en).toContain("Leader &lt;script&gt;alert(1)&lt;/script&gt; &amp; co");
    expect(en).not.toContain("<script>alert(1)</script>");
    expect(en).toContain("Not read that morning: allocation sheet: latest read is 2026-09-30");
    expect(en).toContain('<dt>First pass %</dt><dd data-ct-key="first_pass">held</dd>');
    expect(en).toContain('<dt>Offered ($)</dt><dd data-ct-key="offered">$54,321</dd>');
    expect(en).toContain("No row recorded for 2026-10-03.");
    expect(en).toContain("<summary>2 notes</summary>");
    expect(en).toContain("dli7_PNN label, 2026-10-01 to 2026-10-03");
    // r01's line: the held middle day breaks it into two lone days.
    const r01 = en.slice(en.indexOf('data-ct-kpi="r01"'), en.indexOf('data-ct-kpi="r02"'));
    expect(r01.match(/<circle /g)).toHaveLength(2);
    expect(r01).not.toContain("<polyline ");
    expect(en).toContain("Recorded 2026-10-03. Rules kpi-1. Read live");
    expect(en).not.toMatch(/[\u2013\u2014]/);
    const es = ctRegisterWallPage(read, "es");
    expect(es).toContain(">Cultivo y tecnologia<");
    expect(es).toContain(">Vigilar<");
    expect(es).toContain(">Actuar<");
    expect(es).toContain(">Aun no en vivo<");
    expect(es).toContain(">Sin registro<");
    expect(es).toContain('<dd data-ct-key="first_pass">retenido</dd>');
    expect(es).toContain("No leido esa manana: allocation sheet");
    expect(es).toContain("<summary>2 notas</summary>");
    expect(es).toContain("Leido en vivo");
    expect(es).toContain("Salud de las plantas");
  });

  it("says each refusal in words and shows no card", () => {
    const pages: Array<[CtRead, string]> = [
      [{ kind: "no_token", readAt: NOW }, "The C&amp;T register&#39;s token is not set on this worker yet."],
      [{ kind: "refused", status: 401, error: "missing <b>or</b> wrong token", readAt: NOW }, "Field Ops refused the read (401): missing &lt;b&gt;or&lt;/b&gt; wrong token"],
      [{ kind: "refused", status: 503, error: "", readAt: NOW }, "Field Ops refused the read (503)<"],
      [{ kind: "timeout", readAt: NOW }, "Field Ops did not answer within 10 seconds."],
      [{ kind: "unreachable", readAt: NOW }, "Field Ops could not be reached."],
      [{ kind: "bad_feed", readAt: NOW }, "Field Ops answered, but not with the register&#39;s feed."],
    ];
    for (const [read, words] of pages) {
      const page = ctRegisterWallPage(read, "en");
      expect(page, read.kind).toContain(`data-ct-refusal="${read.kind}"`);
      expect(page.replaceAll("'", "&#39;"), read.kind).toContain(words);
      expect(page).not.toContain("data-ct-kpi=");
    }
    expect(ctRegisterWallPage({ kind: "no_token", readAt: NOW }, "es")).toContain("El token del registro de C&amp;T aun no esta configurado en este worker.");
  });

  it("the home's C&T card is the register's, with no counts and no check-in; the other four cards stand", async () => {
    const m = await migratedDb();
    const model = await loadDirectorHome(m.db, "2026-10-28", NOW);
    const en = directorHomePage(model, "en");
    const at = en.indexOf('data-dd-dept="culttech"');
    const card = en.slice(en.lastIndexOf("<a ", at), en.indexOf("</a>", at));
    expect(card).toContain('data-dd-tiles="7"');
    expect(card).toContain("data-dd-register");
    expect(card).toContain(`href="${DIRECTOR_PATH}/culttech"`);
    expect(card).toContain("<b>7</b> KPIs from the C&amp;T register");
    expect(card).toContain("Read live from Field Ops on the wall");
    expect(card).not.toContain("data-dd-count=");
    expect(en).not.toContain('data-dd-checkin="culttech"');
    for (const dept of ["bizops", "farmops", "sales", "finance"]) expect(en).toContain(`data-dd-checkin="${dept}"`);
    expect(en.match(/data-dd-dept="/g)).toHaveLength(5);
    expect(en).toContain("The Cultivation and Technology card is the exception: its wall reads the C&amp;T register live.");
    const es = directorHomePage(model, "es");
    expect(es).toContain("KPI del registro de C&amp;T");
    expect(es).toContain("La tarjeta de Cultivo y tecnologia es la excepcion: su muro lee el registro de C&amp;T en vivo.");
  });
});
