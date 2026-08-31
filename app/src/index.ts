import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HttpError, textOrNull } from "./audit";
import {
  CONFIG_KEYS,
  LOT_STATUS,
  PIN_COOKIE_MAX_AGE_SECONDS,
  moveToKindsForFarm,
  sumGrams,
} from "./config";
import {
  ACCESS_EMAIL_HEADER,
  DEV_FALLBACK_EMAIL,
  resolveIdentity,
  safeNextPath,
  type Identity,
} from "./identity";
import {
  addDrySpace,
  addLotWeight,
  addPackageType,
  addPerson,
  addStrain,
  addTruck,
  deactivatePerson,
  editRecord,
  finishLot,
  runQueueControl,
  STATION_ACTIONS,
  voidRecord,
} from "./actions";
import {
  farmDisplayName,
  getConfigValue,
  getLot,
  listAdminRows,
  listChangeLog,
  listDrySpacesByKinds,
  listLookup,
  listLotsByStatus,
  listLotWeights,
  listPaneRows,
  listPeople,
  listQueueRows,
  listTable,
  getRow,
  type QueueRow,
} from "./db";
import {
  adminHomePage,
  dataQueuesPage,
  errorBody,
  homePage,
  intercoPage,
  layout,
  lotPage,
  pinPage,
  stationPage,
  type Flash,
  type StationLedgerCtx,
} from "./html";
import { asLocale, t, type Locale } from "./i18n";
import { adminPage, editPage, logPage, voidPage } from "./pages";
import {
  PIPELINE,
  TABLE_EXPORTS,
  queueByKey,
  queues,
  stationByKey,
  type LookupName,
  type QueueDef,
  type StationDef,
} from "./pipeline";
import { queueRowsToCsv, toCsv } from "./csv";

type AppEnv = { Bindings: Env; Variables: { actor: Identity } };
const app = new Hono<AppEnv>();

const LOCALE_COOKIE = "gf_locale";
const PIN_COOKIE = "gf_pin";
type AppContext = Context<AppEnv>;

// Owner ruling 2026-08-31: the actor is the Cloudflare Access login email.
// Access fronts all production traffic; without the header (local dev, smoke)
// requests act as the dev fallback identity.
app.use("*", async (c, next) => {
  const email = c.req.header(ACCESS_EMAIL_HEADER) ?? DEV_FALLBACK_EMAIL;
  c.set("actor", await resolveIdentity(c.env.DB, email));
  await next();
});

/** The injected actor for writes: never trusted from the form (owner ruling 2026-08-31). */
function actorForm(c: AppContext, form: FormData): FormData {
  form.set("person_id", c.get("actor").id);
  return form;
}

// Owner ruling 2026-08-31: Admin and Interco Logistics sit behind a PIN. The PIN
// lives in app_config; a correct entry holds on the device via cookie for a shift.
async function pinGate(c: AppContext, next: () => Promise<void>) {
  const pin = await getConfigValue(c.env.DB, CONFIG_KEYS.admin_pin);
  if (!pin || getCookie(c, PIN_COOKIE) === pin) return next();
  const s = await shell(c);
  const url = new URL(c.req.url);
  return html(c, s, "Enter PIN", pinPage(url.pathname + url.search, s.locale), 401);
}
app.use("/admin", pinGate);
app.use("/admin/*", pinGate);
app.use("/interco", pinGate);
// Owner ruling 2026-08-31: Fulfillment sits behind the same PIN as Admin and Interco.
app.use("/fulfillment", pinGate);
app.use("/fulfillment/*", pinGate);

app.post("/pin", async (c) => {
  const form = await c.req.formData();
  const next = safeNextPath(textOrNull(form.get("next")));
  const pin = await getConfigValue(c.env.DB, CONFIG_KEYS.admin_pin);
  const entered = textOrNull(form.get("pin"));
  if (!pin || entered !== pin) {
    const s = await shell(c);
    return html(c, s, "Enter PIN", pinPage(next, s.locale, true), 401);
  }
  setCookie(c, PIN_COOKIE, pin, {
    path: "/",
    maxAge: PIN_COOKIE_MAX_AGE_SECONDS,
    sameSite: "Lax",
    httpOnly: true,
  });
  return c.redirect(next, 303);
});

function flashFromQuery(url: URL, locale: Locale): Flash | undefined {
  const minted = url.searchParams.get("minted");
  if (minted) return { kind: "ok", text: t(locale, "HBN minted.") };
  const ok = url.searchParams.get("ok");
  if (ok) return { kind: "ok", text: t(locale, "Saved.") };
  const err = url.searchParams.get("err");
  if (err) return { kind: "err", text: err };
  return undefined;
}

async function shell(c: AppContext) {
  const people = await listPeople(c.env.DB, true);
  // The actor is absent only when the identity middleware itself threw (onError path).
  const actor = c.get("actor") as Identity | undefined;
  const locale = asLocale(getCookie(c, LOCALE_COOKIE));
  const url = new URL(c.req.url);
  return {
    theme: c.env.THEME === "c10" ? "c10" : "grip",
    people,
    personId: actor?.id ?? "",
    personEmail: actor?.email ?? "",
    locale,
    flash: flashFromQuery(url, locale),
    minted: url.searchParams.get("minted") ?? undefined,
  };
}

function html(
  c: AppContext,
  s: Awaited<ReturnType<typeof shell>>,
  title: string,
  body: string,
  status?: number
) {
  const page = layout({
    title,
    theme: s.theme,
    personEmail: s.personEmail,
    flash: s.flash,
    minted: s.minted,
    body,
    locale: s.locale,
  });
  return c.html(page, { status: (status ?? 200) as ContentfulStatusCode });
}

app.get("/", async (c) => {
  const s = await shell(c);
  return html(c, s, "Home", homePage(PIPELINE, s.locale));
});

// Owner ruling 2026-08-28: Interco Logistics is orange barreled; a stub page only.
app.get("/interco", async (c) => {
  const s = await shell(c);
  return html(c, s, "Interco Logistics", intercoPage(s.locale));
});

// Owner ruling 2026-08-31: Fulfillment lands on our hosted copy of the SalesHelper
// order-form node, vendored verbatim under public/saleshelper/. The form fetches
// menu.json relative to its own URL, so the page lives at /fulfillment/ and the
// bare path redirects to the trailing slash. The form posts orders to /api/send,
// which stays unrouted here; it falls back to download plus mailto by design.
app.get("/fulfillment", (c) => c.redirect("/fulfillment/", 302));

app.get("/fulfillment/", (c) =>
  salesHelperAsset(c, "/saleshelper/index.html", "text/html; charset=utf-8")
);

app.get("/fulfillment/menu.json", (c) =>
  salesHelperAsset(c, "/saleshelper/menu.json", "application/json; charset=utf-8")
);

app.get("/admin", async (c) => {
  const s = await shell(c);
  return html(c, s, "Admin", adminHomePage());
});

app.get("/admin/queues", async (c) => {
  const s = await shell(c);
  const sections = [];
  for (const q of queues()) {
    sections.push({ queue: q, rows: await listQueueRows(c.env.DB, q) });
  }
  return html(c, s, "Data Queues", dataQueuesPage(sections, s.locale));
});

// Owner ruling 2026-08-28: the EN/ES pill posts here and returns to the same page.
app.post("/locale", async (c) => {
  const form = await c.req.formData();
  const locale = asLocale(form.get("locale"));
  setCookie(c, LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "Lax",
  });
  let back = "/";
  const referer = c.req.header("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      back = u.pathname + u.search;
    } catch {
      back = "/";
    }
  }
  return c.redirect(back, 303);
});

app.get("/station/:key", async (c) => {
  const station = stationByKey(c.req.param("key"));
  if (!station) return c.notFound();
  const s = await shell(c);
  const lotId = station.ledger ? c.req.query("lot") : undefined;
  if (lotId) {
    const lot = await getLot(c.env.DB, lotId);
    if (!lot) return c.notFound();
    const weights = await listLotWeights(c.env.DB, lotId);
    const farmName = await farmDisplayName(c.env.DB, lot.farm_code ?? "");
    const total = sumGrams(weights.map((w) => Number(w.weight_grams)));
    return html(
      c,
      s,
      station.title,
      lotPage(station, lot, weights, farmName, total, s.locale)
    );
  }
  const lookups = await lookupsForStation(c.env.DB, station);
  const queueOptions = await queueOptionsForStation(c.env.DB, station);
  let pickId = "";
  let ledgerCtx: StationLedgerCtx | undefined;
  let paneRows: QueueRow[] | undefined;
  if (station.leftPane) {
    const paneQueue = queueByKey(station.leftPane.queue);
    // The pane and its pick validation share the filtered rows; a hidden batch cannot be picked.
    paneRows =
      station.leftPane.paneFilter && paneQueue
        ? await listPaneRows(c.env.DB, paneQueue, station.leftPane.paneFilter)
        : queueOptions[station.leftPane.queue] ?? [];
    const pick = c.req.query("pick") ?? "";
    const picked = pick ? paneRows.find((row) => row.id === pick) : undefined;
    if (picked) {
      pickId = picked.id;
      if (station.ledger) {
        const farmCode = picked.values.farm_code ?? "";
        ledgerCtx = {
          farmName: await farmDisplayName(c.env.DB, farmCode),
          moveToOptions: await listDrySpacesByKinds(c.env.DB, moveToKindsForFarm(farmCode), farmCode),
          resumeLots: await listLotsByStatus(c.env.DB, picked.id, LOT_STATUS.weighing),
        };
      }
    }
  }
  return html(
    c,
    s,
    station.title,
    stationPage(
      station,
      s.people,
      s.personId,
      lookups,
      queueOptions,
      queueMap(),
      pickId,
      ledgerCtx,
      paneRows,
      s.locale
    )
  );
});

app.post("/station/:key/add_truck", async (c) => {
  const station = stationByKey(c.req.param("key"));
  if (!station || !station.ledger) return c.notFound();
  const form = actorForm(c, await c.req.formData());
  const result = await addTruck(c.env.DB, station.key, form);
  return c.redirect(result.redirect, 303);
});

app.post("/station/:key/lot/:lotId/weights", async (c) => {
  const station = stationByKey(c.req.param("key"));
  if (!station || !station.ledger) return c.notFound();
  const form = actorForm(c, await c.req.formData());
  const result = await addLotWeight(c.env.DB, station.key, c.req.param("lotId"), form);
  return c.redirect(result.redirect, 303);
});

app.post("/station/:key/lot/:lotId/finish", async (c) => {
  const station = stationByKey(c.req.param("key"));
  if (!station || !station.ledger) return c.notFound();
  const form = actorForm(c, await c.req.formData());
  const result = await finishLot(c.env.DB, station.key, c.req.param("lotId"), form);
  return c.redirect(result.redirect, 303);
});

app.post("/station/:key", async (c) => {
  const station = stationByKey(c.req.param("key"));
  if (!station) return c.notFound();
  const action = STATION_ACTIONS[station.transition.action];
  if (!action) throw new HttpError(500, "Station action is not wired.");
  const form = actorForm(c, await c.req.formData());
  const result = await action(c.env.DB, form);
  return c.redirect(result.redirect, 303);
});

app.get("/queue/:key", (c) => {
  const queue = queueByKey(c.req.param("key"));
  if (!queue) return c.notFound();
  return c.redirect("/admin/queues", 302);
});

app.post("/queue/:key/control", async (c) => {
  const queue = queueByKey(c.req.param("key"));
  if (!queue) return c.notFound();
  const form = actorForm(c, await c.req.formData());
  const control = String(form.get("control") ?? "");
  const allowed = new Set(queue.rowControls.map((r) => r.key as string));
  if (!allowed.has(control)) {
    throw new HttpError(400, "That control is not on this queue.");
  }
  const result = await runQueueControl(c.env.DB, control, form);
  return c.redirect(result.redirect, 303);
});

app.get("/export/:name", async (c) => {
  const name = c.req.param("name");
  if (!name.endsWith(".csv")) return c.body("Not found", 404);
  const key = name.slice(0, -4);
  const queue = queueByKey(key);
  let csv: string;
  if (queue) {
    const rows = await listQueueRows(c.env.DB, queue);
    csv = queueRowsToCsv(queue.columns, rows);
  } else if ((TABLE_EXPORTS as readonly string[]).includes(key)) {
    csv = toCsv(await listTable(c.env.DB, key));
  } else {
    return c.body("Not found", 404);
  }
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${key}.csv"`,
    },
  });
});

app.get("/admin/lookups", async (c) => {
  const s = await shell(c);
  const tables = {
    people: await listAdminRows(c.env.DB, "people"),
    farms: await listAdminRows(c.env.DB, "farms"),
    strains: await listAdminRows(c.env.DB, "strains"),
    dry_spaces: await listAdminRows(c.env.DB, "dry_spaces"),
    package_types: await listAdminRows(c.env.DB, "package_types"),
  };
  return html(c, s, "Lookups", adminPage(tables));
});

app.post("/admin/lookups/:table", async (c) => {
  const table = c.req.param("table");
  const form = actorForm(c, await c.req.formData());
  const action = String(form.get("action") ?? "add");
  let result;
  if (table === "people" && action === "deactivate") result = await deactivatePerson(c.env.DB, form);
  else if (table === "people") result = await addPerson(c.env.DB, form);
  else if (table === "strains") result = await addStrain(c.env.DB, form);
  else if (table === "dry_spaces") result = await addDrySpace(c.env.DB, form);
  else if (table === "package_types") result = await addPackageType(c.env.DB, form);
  else throw new HttpError(404, "Unknown lookup.");
  return c.redirect(result.redirect, 303);
});

app.get("/log", async (c) => {
  const s = await shell(c);
  const rows = await listChangeLog(c.env.DB);
  return html(c, s, "Change log", logPage(rows));
});

app.get("/record/:table/:id/edit", async (c) => {
  const table = c.req.param("table");
  const id = c.req.param("id");
  const row = await getRow(c.env.DB, table, id);
  if (!row || row.deleted_at) return c.notFound();
  const s = await shell(c);
  const lookups = {
    farms: await listLookup(c.env.DB, "farms"),
    grow_methods: await listLookup(c.env.DB, "grow_methods"),
    strains: await listLookup(c.env.DB, "strains"),
    dry_spaces: await listLookup(c.env.DB, "dry_spaces"),
    package_types: await listLookup(c.env.DB, "package_types"),
  };
  return html(c, s, "Edit", editPage(table, id, row, lookups));
});

app.post("/record/:table/:id/edit", async (c) => {
  const form = actorForm(c, await c.req.formData());
  const result = await editRecord(c.env.DB, c.req.param("table"), c.req.param("id"), form);
  return c.redirect(result.redirect, 303);
});

app.get("/record/:table/:id/void", async (c) => {
  const s = await shell(c);
  // The referring page rides the form so the void can return there (owner ruling 2026-08-31).
  let back = "";
  const referer = c.req.header("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      back = u.pathname + u.search;
    } catch {
      back = "";
    }
  }
  return html(c, s, "Void", voidPage(c.req.param("table"), c.req.param("id"), back));
});

app.post("/record/:table/:id/void", async (c) => {
  const form = actorForm(c, await c.req.formData());
  const result = await voidRecord(c.env.DB, c.req.param("table"), c.req.param("id"), form);
  return c.redirect(result.redirect, 303);
});

app.onError(async (err, c) => {
  if (err instanceof HttpError) {
    const s = await shell(c);
    s.flash = { kind: "err", text: err.message };
    return html(c, s, "Error", errorBody(err.message), err.status);
  }
  console.error(err);
  const s = await shell(c);
  return html(c, s, "Error", errorBody("Server error."), 500);
});

app.notFound(async (c) => {
  const s = await shell(c);
  return html(c, s, "Not found", "<h1>Not found</h1>", 404);
});

// Owner ruling 2026-08-31: serve a vendored SalesHelper file through the ASSETS
// binding, never directly, so the PIN gate stays in front. cache-control no-store
// is data-age honesty: the form reads dataAsOf from menu.json and a cache must
// never hide staleness.
async function salesHelperAsset(c: AppContext, path: string, contentType: string) {
  const asset = await c.env.ASSETS.fetch(new Request(new URL(path, c.req.url)));
  if (!asset.ok) return c.notFound();
  return new Response(asset.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
}

function queueMap(): Record<string, QueueDef> {
  const map: Record<string, QueueDef> = {};
  for (const q of queues()) map[q.key] = q;
  return map;
}

async function lookupsForStation(
  db: D1Database,
  station: StationDef
): Promise<Record<string, Awaited<ReturnType<typeof listLookup>>>> {
  const names = new Set<LookupName>();
  for (const field of station.fields) {
    if (field.input === "lookup") names.add(field.lookup);
    if (field.input === "move_to") names.add("dry_spaces");
    if (field.input === "package_rows") names.add("package_types");
  }
  const out: Record<string, Awaited<ReturnType<typeof listLookup>>> = {};
  for (const name of names) out[name] = await listLookup(db, name);
  return out;
}

async function queueOptionsForStation(
  db: D1Database,
  station: StationDef
): Promise<Record<string, Awaited<ReturnType<typeof listQueueRows>>>> {
  const keys = new Set<string>();
  for (const field of station.fields) {
    if (field.input === "queue_pick" || field.input === "cryo_weights") keys.add(field.queue);
  }
  if (station.leftPane) keys.add(station.leftPane.queue);
  const out: Record<string, Awaited<ReturnType<typeof listQueueRows>>> = {};
  for (const key of keys) {
    const q = queueByKey(key);
    if (q) out[key] = await listQueueRows(db, q);
  }
  return out;
}

export default app;
