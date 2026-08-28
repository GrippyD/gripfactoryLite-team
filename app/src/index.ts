import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HttpError } from "./audit";
import {
  addDrySpace,
  addPackageType,
  addPerson,
  addStrain,
  deactivatePerson,
  editRecord,
  runQueueControl,
  STATION_ACTIONS,
  voidRecord,
} from "./actions";
import {
  countQueue,
  listAdminRows,
  listChangeLog,
  listLookup,
  listPeople,
  listQueueRows,
  listTable,
  getRow,
} from "./db";
import { errorBody, homePage, layout, queuePage, stationPage, type Flash } from "./html";
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

const app = new Hono<{ Bindings: Env }>();

const PERSON_COOKIE = "gf_person";
type AppContext = Context<{ Bindings: Env }>;

function rememberPerson(c: AppContext, personId: string): void {
  if (!personId) return;
  setCookie(c, PERSON_COOKIE, personId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "Lax",
  });
}

function flashFromQuery(url: URL): Flash | undefined {
  const minted = url.searchParams.get("minted");
  if (minted) return { kind: "ok", text: "HBN minted." };
  const ok = url.searchParams.get("ok");
  if (ok) return { kind: "ok", text: "Saved." };
  const err = url.searchParams.get("err");
  if (err) return { kind: "err", text: err };
  return undefined;
}

async function shell(c: AppContext) {
  const people = await listPeople(c.env.DB, true);
  const personId = getCookie(c, PERSON_COOKIE) ?? "";
  const url = new URL(c.req.url);
  return {
    theme: c.env.THEME === "c10" ? "c10" : "grip",
    people,
    personId,
    flash: flashFromQuery(url),
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
    people: s.people,
    personId: s.personId,
    flash: s.flash,
    minted: s.minted,
    body,
  });
  return c.html(page, { status: (status ?? 200) as ContentfulStatusCode });
}

app.get("/", async (c) => {
  const s = await shell(c);
  const counts: Record<string, number> = {};
  for (const q of queues()) {
    counts[q.key] = await countQueue(c.env.DB, q);
  }
  return html(c, s, "Home", homePage(PIPELINE, counts));
});

app.post("/person", async (c) => {
  const form = await c.req.formData();
  const personId = String(form.get("person_id") ?? "");
  rememberPerson(c, personId);
  return c.redirect("/", 303);
});

app.get("/station/:key", async (c) => {
  const station = stationByKey(c.req.param("key"));
  if (!station) return c.notFound();
  const s = await shell(c);
  const lookups = await lookupsForStation(c.env.DB, station);
  const queueOptions = await queueOptionsForStation(c.env.DB, station);
  return html(
    c,
    s,
    station.title,
    stationPage(station, s.people, s.personId, lookups, queueOptions, queueMap())
  );
});

app.post("/station/:key", async (c) => {
  const station = stationByKey(c.req.param("key"));
  if (!station) return c.notFound();
  const action = STATION_ACTIONS[station.transition.action];
  if (!action) throw new HttpError(500, "Station action is not wired.");
  const form = await c.req.formData();
  rememberPerson(c, String(form.get("person_id") ?? ""));
  const result = await action(c.env.DB, form);
  return c.redirect(result.redirect, 303);
});

app.get("/queue/:key", async (c) => {
  const queue = queueByKey(c.req.param("key"));
  if (!queue) return c.notFound();
  const s = await shell(c);
  const rows = await listQueueRows(c.env.DB, queue);
  return html(c, s, queue.title, queuePage(queue, rows, s.personId));
});

app.post("/queue/:key/control", async (c) => {
  const queue = queueByKey(c.req.param("key"));
  if (!queue) return c.notFound();
  const form = await c.req.formData();
  rememberPerson(c, String(form.get("person_id") ?? ""));
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
  const qPerson = c.req.query("person_id");
  if (qPerson) rememberPerson(c, qPerson);
  const s = await shell(c);
  const tables = {
    people: await listAdminRows(c.env.DB, "people"),
    strains: await listAdminRows(c.env.DB, "strains"),
    dry_spaces: await listAdminRows(c.env.DB, "dry_spaces"),
    package_types: await listAdminRows(c.env.DB, "package_types"),
  };
  return html(c, s, "Lookups", adminPage(s.people, s.personId || qPerson || "", tables));
});

app.post("/admin/lookups/:table", async (c) => {
  const table = c.req.param("table");
  const form = await c.req.formData();
  rememberPerson(c, String(form.get("person_id") ?? ""));
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
  return html(c, s, "Edit", editPage(table, id, row, s.people, s.personId, lookups));
});

app.post("/record/:table/:id/edit", async (c) => {
  const form = await c.req.formData();
  rememberPerson(c, String(form.get("person_id") ?? ""));
  const result = await editRecord(c.env.DB, c.req.param("table"), c.req.param("id"), form);
  return c.redirect(result.redirect, 303);
});

app.get("/record/:table/:id/void", async (c) => {
  const s = await shell(c);
  return html(c, s, "Void", voidPage(c.req.param("table"), c.req.param("id"), s.people, s.personId));
});

app.post("/record/:table/:id/void", async (c) => {
  const form = await c.req.formData();
  rememberPerson(c, String(form.get("person_id") ?? ""));
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
  const out: Record<string, Awaited<ReturnType<typeof listQueueRows>>> = {};
  for (const key of keys) {
    const q = queueByKey(key);
    if (q) out[key] = await listQueueRows(db, q);
  }
  return out;
}

export default app;
