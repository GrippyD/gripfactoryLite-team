import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HttpError, nowIso, textOrNull } from "./audit";
import {
  CONFIG_KEYS,
  ITEM_KIND_FG,
  ITEM_KIND_WIP,
  LOT_STATUS,
  barnLocationForSite,
  HARVEST_HOURS_PATH,
  HARVEST_TRIM_HOURS_PATH,
  HARVEST_TRIM_INPUT_PATH,
  HARVEST_PREPACK_HOURS_PATH,
  PREPACK_STATION_PATH,
  HARVEST_PATH,
  INTERNAL_LOGISTICS_PATH,
  LOGISTICS_OPS_PATH,
  PROCESSING_PARTNERS_PATH,
  PRODUCTION_SCHEDULING_PATH,
  SCHEDULE_STAGE_TITLES,
  SCHEDULE_STAGES,
  DRY_SPACE_TYPES,
  type DrySpaceType,
  isKnownSiteLicense,
  materialAtNorth,
  METRC_UPLOAD_KINDS,
  PIN_COOKIE_MAX_AGE_SECONDS,
  asDevice,
  asView,
  LANDING_FARM,
  SCHEDULE_STATUS,
  moveToKindsForFarm,
  nextTruckNumber,
  plantSplitJitterPct,
  parseTrimBogey,
  trimBogeyOf,
  sumGrams,
  truckNumberFromPick,
  ADMIN_SHEET_SYNC_PATH,
  ENVIRONMENT_PATH,
  ADMIN_METRC_API_PATH,
  MODELS_PATH,
  MODELS_PIN_PATH,
  MODEL_TOOLS,
  modelToolPath,
} from "./config";
import { salesHelperCerberusSkin } from "./theme";
import {
  ACCESS_EMAIL_HEADER,
  DEV_FALLBACK_EMAIL,
  resolveIdentity,
  safeNextPath,
  type Identity,
} from "./identity";
import { SERVICE_IDENTITY, SERVICE_REFUSAL, isAccessFronted, isServiceRoute, loginEmailOf } from "./service";
import { farmDayStartHour, farmToday } from "./effective";
import {
  addDrySpace,
  addGrowMethod,
  addLookupValue,
  saveTrimBogey,
  saveFarmPlantCounts,
  addLotWeight,
  addPackageType,
  addPerson,
  addStrain,
  addTruck,
  buildManifestCsv,
  buildReceiveCsv,
  buildSplitCsv,
  markSplitUploaded,
  completeScheduleItem,
  unfinishScheduleItem,
  unfinishCryoContainer,
  unfinishCryoOutput,
  adoptFromMetrc,
  scheduleHbn,
  schedulePackage,
  unscheduleItem,
  manualHbn,
  loadSilo,
  scheduleLogisticsLot,
  unscheduleLogisticsLot,
  startSiloLoad,
  pauseSiloLoad,
  unloadTogether,
  locationChangeUploadCsv,
  deactivatePerson,
  clearAllUploads,
  editRecord,
  finishLot,
  markManifestUploaded,
  markReceiveManifestUploaded,
  acknowledgeChangedUpload,
  markUploaded,
  packageUploadCsv,
  queueImport,
  recallHarvestBatch,
  runQueueControl,
  savePlantTags,
  STATION_ACTIONS,
  voidLogisticsMove,
  voidCheckedQueueRows,
  voidCheckedMovements,
  markCheckedUploaded,
  ensureUnloadSession,
  updateUnloadSession,
  voidRecord,
  mountSalesOrders,
  startPick,
  savePick,
  completePick,
  addCryoOutput,
  finishCryoRun,
  buildNewPackagesXlsx,
} from "./actions";
import { cryoStationPage } from "./cryo";
import {
  complianceTestingPage,
  equipmentAssetPage,
  erpSoftwarePage,
  equipmentHomePage,
  equipmentPmDone,
  equipmentTicketClose,
  HARVEST_CONSOLE_LEGACY_APP_PATH,
  HARVEST_CONSOLE_PATH,
  skinHarvestConsole,
  equipmentTicketOpen,
  getEquipmentAsset,
  listAllSchedules,
  listAssetLogs,
  listAssetSchedules,
  listAssetTickets,
  listEquipmentAssets,
  vendorsEquipmentPage,
} from "./equipment";
import {
  addAuditNote,
  addListing,
  addPoLine,
  splitPackage,
  addSupplier,
  cancelPurchaseOrder,
  closePurchaseOrder,
  createPurchaseOrder,
  createSalesOrder,
  deactivateSupplier,
  finishAudit,
  issuePurchaseOrder,
  loadComplianceKpis,
  queueInstrumentImport,
  saveAuditHeader,
  saveExternalResult,
  saveLabelTemplate,
  savePoEval,
  startAudit,
  stepSalesOrder,
  toggleListing,
} from "./biz";
import { auditsPage, complianceMenuPage, testingPage, type AuditNoteRow, type AuditRow, type ExternalTestRow } from "./compliance";
import { labelPrintHtml, labelsPage, type LabelPackage, type LabelTemplateRow } from "./labels";
import { listingsWithMatch, marketplacePage, parseMarketplacePane, salesOrderPage, type ListingRow, type MarketplacePane, type SalesOrderRow } from "./marketplace";
import { listZohoMenuItems, listZohoMounts, mountZohoInventory } from "./zohoinv";
import { buildLiveSalesHelperMenu, decorateSalesHelperPage } from "./saleshelper";
import { parseSendBody, sendSalesOrderMail, SH_MAIL_TO_DEFAULT, SH_SEND_GATE_KEY, type ShSendBody } from "./sendmail";
import { dryingTotals, loadSiloVisuals, siloLiveEntry, spaceShapeOf, SILO_LIVE_PATH } from "./silo";
import {
  attachLoadChecks,
  fulfillLabSample,
  intervalPage,
  labSamplePage,
  LAB_SAMPLE_PATH,
  liveChecksOf,
  maintenanceLanding,
  maintenanceSpaces,
  MAINTENANCE_PATH,
  requestLabSample,
  returnLabSample,
  saveSiloCheckInterval,
  scheduleLabSample,
  troubleTicketsPage,
  TROUBLE_TICKETS_PATH,
  unscheduleLabSample,
} from "./labsample";
import {
  findMetrcRecord,
  isMountRound,
  listInternalFieldDefs,
  listInternalFieldValues,
  listMetrcMounts,
  metrcCrossCheck,
  metrcFgInventory,
  metrcLicenseLines,
  mountMetrcExport,
  mountMetrcRound,
  setInternalField,
} from "./metrc";
import { metrcPane } from "./metrcpane";
import { backLinkFor } from "./nav";
import {
  changeLocation,
  findPlant,
  licensesForChange,
  listDestinationOptions,
  listLedgerPackagesForLicense,
  listPendingLocationMoves,
  listPlantLocationsForLicense,
  listPlantsAt,
  listRecentLocationMoves,
  locationMoveCsv,
  markLocationMoveUploaded,
  parseFarm,
  parseLocationKind,
  resolvePackagePick,
} from "./locations";
import {
  LEDGER_LOCATION_EDIT_PATH,
  LEDGER_LOCATION_PATH,
  LEDGER_LOCATION_PURGE_PATH,
  acknowledgeReconcileNote,
  listReconcileItems,
  listReconcileLocations,
  listOpenReconcileNotes,
  purgeLocation,
  reconcileLocationPage,
  saveLocationEdits,
} from "./ledgerloc";
import { TRIM_WEIGHS_PATH, listTrimWeighs, parseTrimWeighsQuery, trimWeighsFeed } from "./feeds";
import { changeLocationPage } from "./locationpane";
import {
  newPurchaseOrderPage,
  purchaseOrderPage,
  purchaseOrderPrintHtml,
  purchasingListPage,
  purchasingReservedPage,
  suppliersPage,
  type ChangeLogRow,
  type PoLineRow,
  type PoListRow,
  type PoRecord,
  type SupplierRow,
} from "./purchasing";
import {
  countSessionWeights,
  farmDisplayName,
  getConfigValue,
  getInventoryItemForLot,
  getLot,
  getOpenUnloadSession,
  listAdminRows,
  getHarvestLoad,
  listChangedAfterUpload,
  listLoadPlantTags,
  listBatchTruckNumbers,
  listFarmDayTruckNumbers,
  listOpenFarmHbns,
  listChangeLog,
  listDrySpacesByKinds,
  listHarvestsByYear,
  listLocalInventory,
  listLookup,
  listLookupValueRows,
  listLotsByStatus,
  listLotTrimPackages,
  listLotWeights,
  listPaneRows,
  listPrepackPanes,
  listScheduleAvailable,
  listScheduleComplete,
  listScheduleWorking,
  listPendingPackageUploads,
  listPendingLocationChangeUploads,
  listBarnWetLots,
  listFinishedLogistics,
  listOpenLogisticsSchedules,
  listScheduledLotsForLoad,
  listDryingComplete,
  getSiloLoad,
  listPendingManifestUploads,
  listPendingReceiveUploads,
  listPendingSplitUploads,
  listTagGaps,
  listPendingUploads,
  listPeople,
  listProductMix,
  listInventoryByLocation,
  listMovementQueueRows,
  listQueueRows,
  listTable,
  listTatStatusLogs,
  listWetWeightUploadEntries,
  listWetWeightUploadReads,
  getRow,
  listImportQueue,
  listRecallableBatches,
  loadInventorySheet,
  sumLotPackageGrams,
  listAudits,
  listAuditNotes,
  listExternalTests,
  listFinishedExternalAudits,
  listInternalTestingReport,
  listLaborHours,
  listLabelTemplates,
  listLabelPackages,
  latestFinalizedPotency,
  listSuppliers,
  listPurchaseOrders,
  getPurchaseOrder,
  listPoLines,
  listChangeLogForRecord,
  listListings,
  inventoryItemsById,
  inventoryQtyByTag,
  listSalesOrders,
  listSoLines,
  listSplitChildren,
  listLookupValues,
  listSoMounts,
  listMountedOrdersWithLines,
  getMountedOrder,
  listMountedOrderLines,
  listCryoRuns,
  getCryoRun,
  getScheduleRow,
  listCryoCategories,
  listCryoRunPool,
  listCryoRunInputs,
  listCryoRunOutputs,
  listPendingNewPackagesUploads,
  type QueueRow,
} from "./db";
import { effectiveStatus, isIsoDate, mountSosPage, pickOrdersPage, pickSheetHtml } from "./fulfillment";
import {
  adminHomePage,
  dataQueuesPage,
  errorBody,
  fulfillmentMenuPage,
  homePage,
  importQueuePage,
  opsGroupPage,
  opsReservedPage,
  reportPage,
  reportsPage,
  inventoryPage,
  inventoryReservedPage,
  layout,
  lotPage,
  modelsPage,
  pendingUploadsPage,
  pinPage,
  salesHelperWrapperPage,
  stationPage,
  unloadLotPanel,
  wetLotPanel,
  type Flash,
  type PickBalanceCtx,
  type TrimCtx,
  type StationLedgerCtx,
} from "./html";
import { asLocale, refusalText, t, tFill, type Locale } from "./i18n";
import { asStoredBytes, attachmentFilename, importContentType, type ImportKind } from "./imports";
import { inventorySheetCsv, parseFgMenu, recallPrefillFromQuery } from "./inventory";
import { clockScript, homeMenuBlocks, loadSiloPage, siloStrip } from "./drying";
import {
  dryingCompleteSince,
  dryingSchedulingPage,
  internalLogisticsPage,
  logisticsLotView,
  processingPartnersPage,
  parseDryingStage,
  parseScheduleStage,
  prepackSchedulingPage,
  schedulingLanding,
  schedulingPage,
} from "./scheduling";
import { editPage, logPage, lookupSectionPage, lookupsLandingPage, manualHbnPage, plantCountPage, plantCountYear, trimBogeyPage, voidPage } from "./pages";
import { LOOKUP_VALUE_SECTIONS } from "./lookups";
import {
  aggregateTatDays,
  computeTatGroups,
  collapseInternalTesting,
  externalAuditsView,
  harvestsView,
  inventoryByLocationView,
  inventoryReportView,
  isReportKey,
  internalTestingView,
  laborHoursDefaultWindow,
  laborHoursView,
  productMixView,
  reportCsv,
  reportFileStamp,
  reportPdfHtml,
  reportXlsx,
  rfReportView,
  salesOrderReportRows,
  salesOrdersView,
  tatsView,
  TAT_LINES,
  TAT_METRICS,
  type ReportView,
  type TatLine,
  type TatMetricKey,
} from "./reports";
import {
  PIPELINE,
  TABLE_EXPORTS,
  opsGroupByKey,
  queueByKey,
  queues,
  reservedOpsMemberByKey,
  stationByKey,
  type LookupName,
  type QueueDef,
  type StationDef,
} from "./pipeline";
import { anyPlantCount, queueRowsToCsv, toCsv, wetWeightsCsv, wetWeightsCsvWithCounts, wetWeightsCsvWithTags, wetWeightsFilename } from "./csv";
import { harvestConsolePage, loadHarvestConsole, loadPrepackSection, loadTestingSection, saveHarvestHours, savePrepackHours, saveTrimHours, saveTrimInputLbs } from "./console";
import { fixtureHttpResponse, loadSheetSyncAdmin, runSheetSync, sheetSyncAdminPage, translateSheetMessage } from "./sheetsync";
import { loadMetrcAdmin, metrcApiPage, runMetrcSweep, testMetrcConnection } from "./metrcapi";
import { inTestingFixtureWorkbook, runInTestingSync } from "./intesting";
import { listMetrcAdoptions } from "./metrc";
import {
  addPrepackLine,
  buildPrepackFinishCsv,
  buildPrepackNewPackages,
  finishPrepack,
  listPendingPrepackFiles,
  loadPrepackPane,
  prepackPage,
  voidPrepackLine,
} from "./prepack";
import { curePanes, listCurePanes, SENSOR_PATH, storeSensorReadings } from "./cure";
import { environmentPage, loadEnvironmentPage, saveEnvironmentRange, saveSensorBinding, saveStaleMinutes, listEnvironmentFlags } from "./environment";
import { pullSensorPush, refreshSensorCatalog } from "./sensorpush";
import {
  buildTestSampleCsv,
  createTestManifest,
  listPendingTestSamples,
  loadTestingDesk,
  manifestPrintPage,
  manifestWorksheetCsv,
  markManifestSent,
  markRemediated,
  saveManifestNumber,
  saveTestResults,
  saveTestSample,
  saveTestingLab,
  scheduleRetest,
  scheduleTestOrder,
  testingDeskPage,
  testingLabsPage,
  listTestingLabs,
} from "./testing";

type AppEnv = { Bindings: Env; Variables: { actor: Identity } };
const app = new Hono<AppEnv>();

const LOCALE_COOKIE = "gf_locale";
// Owner ruling 2026-09-01: the chrome view cookie; absent means Cerberus.
const VIEW_COOKIE = "gf_view";
// Owner ruling 2026-09-01: the device pill's cookie; absent means computer.
const DEVICE_COOKIE = "gf_device";
const PIN_COOKIE = "gf_pin";
type AppContext = Context<AppEnv>;

// Owner ruling 2026-08-31: the actor is the Cloudflare Access login email.
// Access fronts all production traffic; without the header (local dev, smoke)
// requests act as the dev fallback identity.
// THE SERVICE ACTOR (canon 0.30.140): on the Access-fronted worker a request
// with no login email is a service token's; it reads the machine doors alone
// under the fixed service identity and everything else answers 403 in words.
app.use("*", async (c, next) => {
  const email = loginEmailOf(c.req.header(ACCESS_EMAIL_HEADER));
  if (email == null && isAccessFronted(c.env)) {
    if (!isServiceRoute(c.req.method, new URL(c.req.url).pathname)) {
      return c.json({ error: SERVICE_REFUSAL }, 403, { "cache-control": "no-store" });
    }
    c.set("actor", SERVICE_IDENTITY);
    await next();
    return;
  }
  c.set("actor", await resolveIdentity(c.env.DB, email ?? DEV_FALLBACK_EMAIL));
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
// THE HARVEST CONSOLE (canon 0.30.73): the Admin button's page sits behind the
// same PIN; /harvest-console (the vendored planting app) stays open as before.
app.use(HARVEST_PATH, pinGate);
app.use(`${HARVEST_PATH}/*`, pinGate);
app.use("/interco", pinGate);
app.use("/interco/*", pinGate);
app.use("/logistics", pinGate);
app.use("/logistics/*", pinGate);
app.use("/virtual-move", pinGate);
app.use("/virtual-move/*", pinGate);
// Owner ruling 2026-08-31: Fulfillment sits behind the same PIN as Admin and Interco.
app.use("/fulfillment", pinGate);
app.use("/fulfillment/*", pinGate);
// Owner ruling 2026-08-31: Inventory sits behind the same PIN; the route serves a
// reserved stub until Dennis's Inventory node vendors in.
app.use("/inventory", pinGate);
app.use("/inventory/*", pinGate);
app.use("/compliance", pinGate);
app.use("/compliance/*", pinGate);
// THE TESTING DESK (canon 0.30.164): the lab tech's station, same PIN as Admin.
app.use("/testing", pinGate);
app.use("/testing/*", pinGate);
app.use("/purchasing", pinGate);
app.use("/purchasing/*", pinGate);
app.use("/marketplace", pinGate);
app.use("/marketplace/*", pinGate);
// Owner ruling 2026-09-08 (canon 0.30.9, verbatim: "pencil and "x" PIN gated"):
// the trim package's reasoned edit and void sit behind the same PIN.
app.use("/record/wip_packages/*", pinGate);
// THE SEND EMAIL (canon 0.30.65): the SalesHelper form's /api/send is called
// from inside the PIN-gated frame, so the same cookie fronts it; a call
// without it gets the PIN page (401), which the form reads as not sent.
app.use("/api/*", pinGate);

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

// THE MODELS BUTTON (canon 0.30.86). Owner ruling 2026-09-15, verbatim: "New
// button in Admin: [Models] - pin gated: 17853". A second gate with its own PIN
// (app_config models_pin) and its own cookie: the Admin PIN does not open
// /models, and the Models PIN opens nothing else. The PIN page posts to
// /pin/models, outside the gated prefix, the way /pin sits outside /admin.
const MODELS_PIN_COOKIE = "gf_models_pin";
async function modelsPinGate(c: AppContext, next: () => Promise<void>) {
  const pin = await getConfigValue(c.env.DB, CONFIG_KEYS.models_pin);
  if (!pin || getCookie(c, MODELS_PIN_COOKIE) === pin) return next();
  const s = await shell(c);
  const url = new URL(c.req.url);
  return html(c, s, "Enter PIN", pinPage(url.pathname + url.search, s.locale, false, MODELS_PIN_PATH), 401);
}
app.use(MODELS_PATH, modelsPinGate);
app.use(`${MODELS_PATH}/*`, modelsPinGate);

app.post(MODELS_PIN_PATH, async (c) => {
  const form = await c.req.formData();
  const next = safeNextPath(textOrNull(form.get("next")), MODELS_PATH);
  const pin = await getConfigValue(c.env.DB, CONFIG_KEYS.models_pin);
  const entered = textOrNull(form.get("pin"));
  if (!pin || entered !== pin) {
    const s = await shell(c);
    return html(c, s, "Enter PIN", pinPage(next, s.locale, true, MODELS_PIN_PATH), 401);
  }
  setCookie(c, MODELS_PIN_COOKIE, pin, {
    path: MODELS_PATH,
    maxAge: PIN_COOKIE_MAX_AGE_SECONDS,
    sameSite: "Lax",
    httpOnly: true,
  });
  return c.redirect(next, 303);
});

// The Models page: a tile per model tool. Each tool is a vendored static app
// streamed from public/models/<slug>/ through the ASSETS binding (run_worker_first
// keeps the gate in front), served at /models/<slug>/ with the trailing slash so
// the app's relative fetches resolve beside it; the slash-less path redirects.
app.get(MODELS_PATH, async (c) => {
  const s = await shell(c);
  return html(c, s, "Models", modelsPage(s.locale));
});
for (const tool of MODEL_TOOLS) {
  const dir = modelToolPath(tool);
  app.get(dir.slice(0, -1), (c) => c.redirect(dir, 302));
  app.get(dir, (c) => vendoredHtml(c, `${dir}index.html`));
  for (const file of tool.files) {
    app.get(`${dir}${file}`, (c) => vendoredAsset(c, `${dir}${file}`));
  }
}

function flashFromQuery(url: URL, locale: Locale): Flash | undefined {
  const minted = url.searchParams.get("minted");
  if (minted) return { kind: "ok", text: t(locale, "HBN minted.") };
  // THE FOUR START TAPS (canon 0.30.89): a repeated Start lot landed on the lot already started.
  if (url.searchParams.get("repeat") === "1") {
    return { kind: "ok", text: t(locale, "That lot was already started a moment ago; you are on it. No second lot was made.") };
  }
  const ok = url.searchParams.get("ok");
  // Owner ruling 2026-08-31: marking a METRC file uploaded flashes its own line.
  if (ok === "upload_marked") return { kind: "ok", text: t(locale, "Marked uploaded.") };
  // THE PENDING QUEUE CLEAR (canon 0.30.96): the Clear all flash says it was a
  // clear, not a METRC upload.
  if (ok === "cleared") return { kind: "ok", text: t(locale, "Pending files cleared, not uploaded to METRC.") };
  if (ok === "voided") return { kind: "ok", text: tFill(locale, "Voided {n}.", { n: url.searchParams.get("n") ?? "0" }) };
  if (ok === "uploaded") return { kind: "ok", text: tFill(locale, "Marked {n} uploaded.", { n: url.searchParams.get("n") ?? "0" }) };
  // Owner ruling 2026-08-31: the Plant fill rule; saving tags flashes its own line.
  if (ok === "tags_saved") return { kind: "ok", text: t(locale, "Plant tags saved.") };
  if (ok === "recalled") return { kind: "ok", text: t(locale, "HBN recalled.") };
  // Owner ruling 2026-09-02: [Demote] flashes its own line.
  if (ok === "scheduled") {
    const n = url.searchParams.get("n") ?? "0";
    return { kind: "ok", text: `${t(locale, "Scheduled")} ${n}.` };
  }
  // >> ADOPTS AND SCHEDULES (canon 0.30.200): one >> adopted the package and put it on the schedule.
  if (ok === "adopted") {
    const n = url.searchParams.get("n") ?? "1";
    return { kind: "ok", text: tFill(locale, "Adopted and scheduled {n}.", { n }) };
  }
  if (ok === "unscheduled") return { kind: "ok", text: t(locale, "Unscheduled.") };
  // THE BLAST FREEZER(S) (canon 0.30.106): a freezer's unload removes the line and moves nothing.
  if (ok === "frozen") return { kind: "ok", text: t(locale, "Line removed. The packages stand as FFZ in METRC; nothing moved.") };
  if (ok === "completed") return { kind: "ok", text: t(locale, "Completed.") };
  // THE DRYING SCHEDULE (canon 0.30.226): a load from a surface's >>, and the joint unload.
  if (ok === "drying_loaded") return { kind: "ok", text: t(locale, "Loaded. The location change pends at the export home.") };
  if (ok === "unloaded_together") {
    return { kind: "ok", text: tFill(locale, "Unloaded together: {n} lots.", { n: url.searchParams.get("n") ?? "0" }) };
  }
  // THE MANIFEST BUILDER (canon 0.30.125; his pick "Download at once, and record").
  if (ok === "manifest") {
    return { kind: "ok", text: t(locale, "Manifest recorded. The T3 file is downloading; it also waits on Pending Data Uploads.") };
  }
  if (ok === "test_scheduled") return { kind: "ok", text: t(locale, "Test scheduled. Book the pickup in the lab portal.") };
  if (ok === "test_sampled") return { kind: "ok", text: t(locale, "Sample recorded.") };
  if (ok === "test_manifest") return { kind: "ok", text: t(locale, "Manifest recorded. The sample CSV waits on Pending Data Uploads.") };
  if (ok === "test_sent") return { kind: "ok", text: t(locale, "Manifest sent.") };
  if (ok === "test_at_lab") return { kind: "ok", text: t(locale, "Manifest number saved. The order is at the lab.") };
  if (ok === "test_passed") return { kind: "ok", text: t(locale, "Results recorded: passed.") };
  if (ok === "test_failed") return { kind: "ok", text: t(locale, "Results recorded: failed.") };
  if (ok === "test_retest") return { kind: "ok", text: t(locale, "Retest scheduled. Two separate new samples must pass consecutively.") };
  if (ok === "test_remediated") return { kind: "ok", text: t(locale, "Marked remediated. The next attempt is still required.") };
  if (ok === "demoted") return { kind: "ok", text: t(locale, "Record demoted.") };
  if (ok === "unfinished") {
    const hbn = url.searchParams.get("hbn");
    if (hbn) return { kind: "ok", text: tFill(locale, "Unfinished; the pasteurization run on {hbn} was unscheduled.", { hbn }) };
    return { kind: "ok", text: t(locale, "Unfinished.") };
  }
  if (ok === "run_unfinished") {
    return {
      kind: "ok",
      text: tFill(locale, "Run unfinished; {n} containers back in the Cryo Queue, {m} outputs voided.", {
        n: url.searchParams.get("n") ?? "0",
        m: url.searchParams.get("m") ?? "0",
      }),
    };
  }
  if (ok === "pack_unfinished") {
    return {
      kind: "ok",
      text: tFill(locale, "Pack unfinished; {tag} back to released with {g} g.", {
        tag: url.searchParams.get("tag") ?? "",
        g: url.searchParams.get("g") ?? "0",
      }),
    };
  }
  if (ok === "container_unfinished") {
    return {
      kind: "ok",
      text: tFill(locale, "Container unfinished; {tag} is back in the Cryo Queue with {g} g.", {
        tag: url.searchParams.get("tag") ?? "",
        g: url.searchParams.get("g") ?? "0",
      }),
    };
  }
  if (ok === "output_unfinished") {
    return {
      kind: "ok",
      text: tFill(locale, "Output unfinished; {tag} voided, {g} g back to the pool.", {
        tag: url.searchParams.get("tag") ?? "",
        g: url.searchParams.get("g") ?? "0",
      }),
    };
  }
  if (ok === "file_queued") return { kind: "ok", text: t(locale, "File queued.") };
  // Owner ruling 2026-09-08 (canon 0.30.9): [Remove from queue] at Remaining 0 flashes
  // its own line; when the lot was over, the adjustment CSV pends and the flash says so.
  if (ok === "removed") return { kind: "ok", text: t(locale, "Removed from the queue.") };
  if (ok === "removed_adjust") {
    return { kind: "ok", text: t(locale, "Removed from the queue. The adjustment CSV pends at the export home.") };
  }
  if (ok === "parsed") {
    const parsed = url.searchParams.get("parsed") ?? "0";
    const skipped = url.searchParams.get("skipped") ?? "0";
    return { kind: "ok", text: `${t(locale, "Parsed")} ${parsed}, ${t(locale, "skipped")} ${skipped}.` };
  }
  if (ok === "truck_split") {
    const truck = url.searchParams.get("truck") ?? "";
    const parts = (url.searchParams.get("parts") ?? "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const [serial, n, g] = part.split("|");
        return tFill(locale, "{serial} {n} totes {g} g", { serial: serial ?? "", n: n ?? "0", g: g ?? "0" });
      })
      .join("; ");
    const text = truck
      ? tFill(locale, "Finished Truck {truck}: {parts}.", { truck, parts })
      : tFill(locale, "Finished: {parts}.", { parts });
    return { kind: "ok", text };
  }
  if (ok) return { kind: "ok", text: t(locale, "Saved.") };
  const err = url.searchParams.get("err");
  if (err) return { kind: "err", text: err };
  return undefined;
}

async function shell(c: AppContext) {
  // THE FARM DAY BEGINS AT SIX (canon 0.30.151): the start hour in data rides every
  // page's body so the date-filling scripts read the farm day.
  const [people, farmDayStart] = await Promise.all([listPeople(c.env.DB, true), farmDayStartHour(c.env.DB)]);
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
    // Owner ruling 2026-09-01: the cookie holds the view pick. Canon 0.30.28:
    // an absent cookie is the Continuum format (co); Cerberus was the default
    // until 2026-09-09. Orthogonal to the THEME env above.
    view: asView(getCookie(c, VIEW_COOKIE)),
    // Owner ruling 2026-09-01: computer is the default device; phone mode
    // reflows the layout through a body class.
    device: asDevice(getCookie(c, DEVICE_COOKIE)),
    flash: flashFromQuery(url, locale),
    minted: url.searchParams.get("minted") ?? undefined,
    farmDayStart,
  };
}

function html(
  c: AppContext,
  s: Awaited<ReturnType<typeof shell>>,
  title: string,
  body: string,
  status?: number
) {
  // THE BACK LINK (canon 0.30.109): every shelled page but Home carries the
  // crumb to the menu above it; a record page goes back where it came from.
  const url = new URL(c.req.url);
  const page = layout({
    title,
    theme: s.theme,
    personEmail: s.personEmail,
    flash: s.flash,
    minted: s.minted,
    body,
    locale: s.locale,
    view: s.view,
    device: s.device,
    back: backLinkFor(url.pathname, { referer: c.req.header("referer"), origin: url.origin }),
    farmDayStart: s.farmDayStart,
  });
  // Owner incident 2026-09-01 (alpha): a stale cached page can misrepresent live
  // floor state; every HTML response is a live ops surface and never caches.
  return c.html(page, {
    status: (status ?? 200) as ContentfulStatusCode,
    headers: { "cache-control": "no-store" },
  });
}

app.get("/", async (c) => {
  const s = await shell(c);
  // Canon 0.30.28: the home page carries the Continuum crumb only in the co view.
  const now = nowIso();
  const lines = await homeMenuBlocks(c.env.DB, now, s.farmDayStart, s.locale);
  return html(c, s, "Home", homePage(PIPELINE, s.locale, s.view, lines) + clockScript());
});

// Owner standing word: /reports carries no PIN.
app.get("/reports", async (c) => {
  const s = await shell(c);
  return html(c, s, "Reports", reportsPage(s.locale));
});

app.get("/reports/:key", async (c) => {
  const key = c.req.param("key");
  if (!isReportKey(key)) return c.notFound();
  const url = new URL(c.req.url);
  if (key === "labor_hours") {
    const today = await farmToday(c.env.DB, nowIso());
    const window = laborHoursDefaultWindow(today);
    if (!url.searchParams.get("from")) url.searchParams.set("from", window.from);
    if (!url.searchParams.get("to")) url.searchParams.set("to", window.to);
  }
  const format = url.searchParams.get("format");
  const s = await shell(c);
  const view = await buildReportView(c.env.DB, key, url.searchParams);
  if (view.reserved) {
    return html(c, s, view.title, reportPage(view, reportFilterForm(key, url.searchParams, s.locale), reportQuery(url.searchParams), s.locale));
  }
  if (format === "csv") {
    return new Response(reportCsv(view), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${key}_${reportFileStamp()}.csv"`,
      },
    });
  }
  if (format === "xlsx") {
    return new Response(reportXlsx(view), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${key}_${reportFileStamp()}.xlsx"`,
      },
    });
  }
  if (format === "pdf") {
    const filters = url.searchParams.toString() || "none";
    return c.html(
      reportPdfHtml(view, filters, "Gripfactory Lite", nowIso(), s.locale),
      { headers: { "cache-control": "no-store" } }
    );
  }
  return html(c, s, view.title, reportPage(view, reportFilterForm(key, url.searchParams, s.locale), reportQuery(url.searchParams), s.locale));
});

// Owner ruling 2026-09-02: group subpages. No PIN on /ops itself; a tile that
// points at a gated route still hits that gate when tapped. Reserved groups
// and reserved members render the reserved-page pattern (the one the two
// fulfillment buttons wore until canon 0.30.18 built them).
app.get("/ops/:key", async (c) => {
  const key = c.req.param("key");
  const group = opsGroupByKey(key);
  const s = await shell(c);
  if (group) {
    if (group.reserved) {
      return html(
        c,
        s,
        group.label,
        opsReservedPage(group.label, group.futureFile ?? `src/${group.key}.ts`, "/", "Operations", s.locale)
      );
    }
    // Canon 0.30.6: the silo strip rides the Drying Operations menu too.
    const strip = group.key === "drying_ops" ? await siloStripFor(c) : "";
    return html(c, s, group.label, strip + opsGroupPage(group, s.locale));
  }
  const reserved = reservedOpsMemberByKey(key);
  if (reserved) {
    return html(
      c,
      s,
      reserved.member.title,
      opsReservedPage(
        reserved.member.title,
        reserved.member.futureFile ?? `src/${reserved.member.key}.ts`,
        `/ops/${reserved.group.key}`,
        reserved.group.label,
        s.locale
      )
    );
  }
  return c.notFound();
});

// THE LOAD AND THE LOT (canon 0.30.241): the manifest builder's renderers stay
// in manifest.ts. No route reaches them. Every path under /interco lands on
// the Logistics Operations group page.
app.get("/interco", (c) => c.redirect(LOGISTICS_OPS_PATH, 302));
app.get("/interco/*", (c) => c.redirect(LOGISTICS_OPS_PATH, 302));
app.post("/interco", (c) => c.redirect(LOGISTICS_OPS_PATH, 303));
app.post("/interco/*", (c) => c.redirect(LOGISTICS_OPS_PATH, 303));
app.get(INTERNAL_LOGISTICS_PATH, async (c) => {
  const s = await shell(c);
  const now = nowIso();
  const [parts, open, finished] = await Promise.all([
    listBarnWetLots(c.env.DB),
    listOpenLogisticsSchedules(c.env.DB),
    listFinishedLogistics(c.env.DB, dryingCompleteSince(now, s.farmDayStart)),
  ]);
  const covered = new Set(open.map((row) => row.harvest_batch_id));
  const byBatch = new Map<string, typeof parts>();
  for (const part of parts) {
    const batch = part.harvest_batch_id ?? "";
    if (!batch) continue;
    const group = byBatch.get(batch);
    if (group) group.push(part);
    else byBatch.set(batch, [part]);
  }
  const queue = [];
  const scheduled = [];
  for (const [batch, group] of byBatch) {
    const pass = open.find((row) => row.harvest_batch_id === batch);
    const view = logisticsLotView(group, pass?.id ?? null);
    if (!view) continue;
    if (covered.has(batch) && pass) scheduled.push(view);
    else queue.push(view);
  }
  for (const pass of open) {
    if (byBatch.has(pass.harvest_batch_id)) continue;
    scheduled.push({
      harvest_batch_id: pass.harvest_batch_id,
      hbn: pass.hbn,
      farm_code: pass.farm_code,
      strain_label: pass.strain_label,
      metrc_harvest_tag: pass.metrc_harvest_tag,
      package_code: null,
      trucks: [],
      partIds: [],
      weight_grams: 0,
      planned_silo_name: pass.planned_silo_name,
      oldest_finished_at: null,
      schedule_id: pass.id,
    });
  }
  scheduled.sort((a, b) => {
    const at = open.find((row) => row.id === a.schedule_id)?.scheduled_at ?? "";
    const bt = open.find((row) => row.id === b.schedule_id)?.scheduled_at ?? "";
    return at < bt ? -1 : at > bt ? 1 : 0;
  });
  return html(c, s, "Internal Logistics", internalLogisticsPage({ queue, scheduled, finished, nowIso: now, locale: s.locale }));
});
app.post(`${INTERNAL_LOGISTICS_PATH}/schedule`, async (c) => {
  const result = await scheduleLogisticsLot(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post(`${INTERNAL_LOGISTICS_PATH}/unschedule/:id`, async (c) => {
  const result = await unscheduleLogisticsLot(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.get(PROCESSING_PARTNERS_PATH, async (c) => {
  const s = await shell(c);
  return html(c, s, "Processing Partners", processingPartnersPage(s.locale));
});
// The T3 file under the interco gate, so the hand that finished it pulls it
// again without Admin's PIN; the export home keeps its own copy and the mark.

// Owner rulings 2026-09-07 (canon 0.29.0): the Continuum 10 Vendors and
// Equipment remake, C10 styled, plus the Preventive Maintenance system. Both
// standalone documents (no app shell), unPINned like /reports.
app.get("/vendors-equipment", (c) => c.html(vendorsEquipmentPage()));

// Owner ruling 2026-09-07 (same sitting): the ERP page remake; the Admin link
// is his stated backdoor.
app.get("/erp-software", (c) => c.html(erpSoftwarePage()));

// Owner ruling 2026-09-07 (canon 0.29.5): the Compliance Testing page, same
// pattern; the console it describes stays behind the PIN, the page does not.
app.get("/compliance-testing", (c) => c.html(complianceTestingPage()));

// Owner ruling 2026-09-09 (canon 0.30.27, verbatim: "I need this entire app
// hosted on a button in Admin with the dark (inverted) continuum theme and the
// "back to continuum" link (exactly the same format as the other pages)"), then
// the same day (canon 0.30.30, with two pictures of the live page: "Remove all
// of this, make the CSS match the inverted continuum" over the crumb, masthead
// and lede, and "Remove this" over the Tools pill): the page IS the vendored
// Harvest Console Lite, streamed from public/harvest-console/ with the inverted
// Continuum skin spliced in at serve time (the file on disk never changes). The
// 0.30.27 shell page is gone; its /app path redirects here. UnPINned like the
// three sibling Continuum pages ("no PIN", canon 0.30.28); the app makes no
// external requests and keeps its data in the visitor's browser.
app.get(HARVEST_CONSOLE_PATH, (c) =>
  vendoredHtml(c, "/harvest-console/harvest-console-lite.html", skinHarvestConsole)
);
app.get(HARVEST_CONSOLE_LEGACY_APP_PATH, (c) => c.redirect(HARVEST_CONSOLE_PATH, 302));

app.get("/equipment", async (c) => {
  const [assets, schedules] = await Promise.all([
    listEquipmentAssets(c.env.DB),
    listAllSchedules(c.env.DB),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return c.html(equipmentHomePage(assets, schedules, today, c.req.query("ok") ?? undefined));
});

app.get("/equipment/:id", async (c) => {
  const asset = await getEquipmentAsset(c.env.DB, c.req.param("id"));
  if (!asset) return c.notFound();
  const [schedules, logs, tickets] = await Promise.all([
    listAssetSchedules(c.env.DB, asset.id),
    listAssetLogs(c.env.DB, asset.id),
    listAssetTickets(c.env.DB, asset.id),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  // Canon 0.30.12: signatures pick from the sign-off names (Kieth first on RTUs).
  const signOffNames = await listLookup(c.env.DB, "sign_off_name");
  return c.html(
    equipmentAssetPage(asset, schedules, logs, tickets, today, c.req.query("ok") ?? undefined, signOffNames)
  );
});

app.post("/equipment/pm-done", async (c) => {
  const result = await equipmentPmDone(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/equipment/ticket", async (c) => {
  const result = await equipmentTicketOpen(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/equipment/ticket/:id/close", async (c) => {
  const result = await equipmentTicketClose(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/virtual-move", (c) => c.redirect("/interco", 302));
app.post("/virtual-move/to-processor", (c) => c.redirect("/interco", 303));
app.post("/virtual-move/to-grow", (c) => c.redirect("/interco", 303));
app.get("/virtual-move/:id/manifest", (c) => c.redirect("/admin/uploads", 302));

// Owner ruling 2026-09-01: GET /fulfillment (and /fulfillment/) is a themed
// MENU page in the normal chrome now: [SalesHelper] functional plus the two
// orange-barrelled reserved buttons. The hosted SalesHelper form (vendored
// verbatim under public/saleshelper/, owner ruling 2026-08-31) moved under
// /fulfillment/saleshelper/: a wrapper page in our chrome framing the raw
// form at /fulfillment/saleshelper/app. All of it rides the /fulfillment/*
// PIN gate above. The form posts orders to /api/send, which stays unrouted
// here; it falls back to download plus mailto by design.
const fulfillmentMenu = async (c: AppContext) => {
  const s = await shell(c);
  return html(c, s, "Fulfillment", fulfillmentMenuPage(s.locale));
};
app.get("/fulfillment", fulfillmentMenu);
app.get("/fulfillment/", fulfillmentMenu);

// Owner order 2026-09-08 (canon 0.30.18): [Mount SOs] and [Pick Orders] built
// on gripfactorish's behavior. The Zoho Sales Order export mounts here (the
// readouts: Sales Pipeline, SO Status Detail, open orders); the pick is the
// write side gripfactorish never had. Shipping Today is the browser's day when
// the page says so (?today=), the worker's UTC day otherwise.
function readoutToday(c: AppContext): string {
  const q = c.req.query("today");
  return isIsoDate(q) ? q : nowIso().slice(0, 10);
}

app.get("/fulfillment/mount-sos", async (c) => {
  const s = await shell(c);
  const [mounts, orders] = await Promise.all([listSoMounts(c.env.DB), listMountedOrdersWithLines(c.env.DB)]);
  return html(
    c,
    s,
    "Mount SOs",
    mountSosPage({
      mounts,
      orders,
      today: readoutToday(c),
      locale: s.locale,
      ok: c.req.query("ok") ?? undefined,
    })
  );
});

app.post("/fulfillment/mount-sos", async (c) => {
  const result = await mountSalesOrders(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/fulfillment/pick-orders", async (c) => {
  const s = await shell(c);
  const orders = await listMountedOrdersWithLines(c.env.DB);
  const orderId = c.req.query("order") ?? "";
  const picked = orderId ? orders.find((o) => o.id === orderId) ?? null : null;
  return html(
    c,
    s,
    "Pick Orders",
    pickOrdersPage({
      orders: orders.filter((o) => effectiveStatus(o) !== "shipped"),
      picked,
      locale: s.locale,
      ok: c.req.query("ok") ?? undefined,
    })
  );
});

app.post("/fulfillment/pick-orders/:id/start", async (c) => {
  const result = await startPick(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/fulfillment/pick-orders/:id/save", async (c) => {
  const result = await savePick(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/fulfillment/pick-orders/:id/complete", async (c) => {
  const result = await completePick(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

// The pick sheet: a standalone letter print document, one order.
app.get("/fulfillment/pick-orders/:id/print", async (c) => {
  const order = await getMountedOrder(c.env.DB, c.req.param("id"));
  if (!order) return c.notFound();
  const lines = await listMountedOrderLines(c.env.DB, order.id);
  const locale = asLocale(getCookie(c, LOCALE_COOKIE));
  return c.html(pickSheetHtml({ ...order, lines }, locale), { headers: { "cache-control": "no-store" } });
});

// Owner ruling 2026-09-01: the hosted SalesHelper wrapper, our chrome on top
// with the form filling the rest of the viewport in an iframe. The bare path
// redirects to the trailing slash so the tile link stays canonical.
app.get("/fulfillment/saleshelper", (c) => c.redirect("/fulfillment/saleshelper/", 302));
app.get("/fulfillment/saleshelper/", async (c) => {
  const s = await shell(c);
  return html(c, s, "SalesHelper", salesHelperWrapperPage(s.locale));
});

// Owner ruling 2026-09-01: the vendored form serves at /app exactly as
// /fulfillment/ used to (no trailing slash, so the form's relative fetch of
// menu.json resolves to /fulfillment/saleshelper/menu.json), with the
// serve-time Cerberus theme injection; see salesHelperApp below.
app.get("/fulfillment/saleshelper/app", (c) => salesHelperApp(c));

// THE SALESHELPER LIVE MENU (canon 0.30.47): menu.json is the vendored static
// re-lined from the newest Zoho mount; without a mount the static serves as it
// came. The old path keeps serving it too (owner ruling 2026-09-01).
app.get("/fulfillment/saleshelper/menu.json", (c) => salesHelperMenu(c));

// THE SEND EMAIL (canon 0.30.65; SalesHelper canon 4b, v0.8.0). Owner report
// 2026-09-14, verbatim: "The email that sends the csv doesn't automatically
// mount the csv file to the email.  You have to download it and add it
// manually." The SalesHelper form's contract: POST JSON {filename, csv, order}
// with X-Grip-Key; any 2xx means sent, anything else drops it to its mailto
// fallback. Resend from the owner's account (his pick); the recipient and
// sender live in app_config, the key is the Worker secret RESEND_API_KEY.
app.post("/api/send", async (c) => {
  if ((c.req.header("X-Grip-Key") ?? "") !== SH_SEND_GATE_KEY) return c.json({ ok: false, error: "Forbidden." }, 403);
  let body: ShSendBody;
  try {
    body = parseSendBody(await c.req.json().catch(() => null));
  } catch (err) {
    if (err instanceof HttpError) return c.json({ ok: false, error: err.message }, err.status as 400);
    return c.json({ ok: false, error: "Send body must be JSON." }, 400);
  }
  const to = (await getConfigValue(c.env.DB, CONFIG_KEYS.saleshelper_mail_to)) || SH_MAIL_TO_DEFAULT;
  const from = await getConfigValue(c.env.DB, CONFIG_KEYS.saleshelper_mail_from);
  const apiKey = (c.env as unknown as { RESEND_API_KEY?: string }).RESEND_API_KEY;
  try {
    const sent = await sendSalesOrderMail({ apiKey, from, to, body });
    return c.json({ ok: true, id: sent.id, to: sent.to, orderNo: body.order.orderNo });
  } catch (err) {
    if (err instanceof HttpError) return c.json({ ok: false, error: err.message }, err.status as 400);
    return c.json({ ok: false, error: "Mail failed." }, 502);
  }
});
app.get("/fulfillment/menu.json", (c) => salesHelperMenu(c));

app.get("/inventory", async (c) => {
  const s = await shell(c);
  // Owner ruling 2026-09-01: "Trim and BIO only." The extraction codes fetch
  // raw like the yield does; loadInventorySheet parses and binds them.
  // FG INVENTORY IN METRC (canon 0.30.43): the pane reads the mirror, not the
  // Zoho static (which still feeds the marketplace's item names).
  const sheet = await loadInventorySheet(
    c.env.DB,
    nowIso(),
    await getConfigValue(c.env.DB, CONFIG_KEYS.projected_dry_yield_pct),
    await getConfigValue(c.env.DB, CONFIG_KEYS.extraction_type_codes),
    await metrcFgInventory(c.env.DB)
  );
  const ledger = await listLocalInventory(c.env.DB);
  const { live: siloLive } = await loadSiloVisuals(c.env.DB);
  return html(c, s, "Inventory", inventoryPage(sheet, s.locale, ledger, siloLive));
});

// THE METRC MIRROR (canon 0.30.38): the drop lane and the mirror's pictures.
// /inventory* is PINned above; no new gate is declared.
app.get("/inventory/metrc", async (c) => {
  const s = await shell(c);
  const tag = (c.req.query("tag") ?? "").trim();
  const record = tag ? await findMetrcRecord(c.env.DB, tag) : null;
  const values = record ? await listInternalFieldValues(c.env.DB, tag) : [];
  const licenses = (await listLookup(c.env.DB, "license")).filter((l) => isKnownSiteLicense(l.value));
  const ok = c.req.query("ok") ?? undefined;
  const mounted =
    ok === "mounted"
      ? {
          kind: c.req.query("kind") ?? "",
          added: Number(c.req.query("added") ?? 0),
          updated: Number(c.req.query("updated") ?? 0),
          gone: Number(c.req.query("gone") ?? 0),
          // THE MIRROR CLOSES THE LEDGER (canon 0.30.128).
          closed: Number(c.req.query("closed") ?? 0) || 0,
          closedPackages: Number(c.req.query("closed_packages") ?? 0) || 0,
          released: Number(c.req.query("released") ?? 0) || 0,
          releasedPassed: Number(c.req.query("released_passed") ?? 0) || 0,
          releasedFailed: Number(c.req.query("released_failed") ?? 0) || 0,
          landed: Number(c.req.query("landed") ?? 0) || 0,
        }
      : undefined;
  return html(
    c,
    s,
    "METRC Mirror",
    metrcPane(
      {
        lines: await metrcLicenseLines(c.env.DB),
        mounts: await listMetrcMounts(c.env.DB),
        cross: await metrcCrossCheck(c.env.DB),
        licenses: licenses.map((l) => ({ value: l.value, label: l.label })),
        defs: await listInternalFieldDefs(c.env.DB),
        tag: tag || undefined,
        record,
        values,
        ok,
        mounted,
      },
      s.locale
    )
  );
});
app.post("/inventory/metrc/mount", async (c) => {
  const form = actorForm(c, await c.req.formData());
  // THE SLICED MOUNT (canon 0.30.42): the drop page's script sends the file in
  // rounds that carry slice; each round answers JSON, refusals included, so
  // the page can say what stopped. A plain post walks the file in one request.
  if (isMountRound(form)) {
    try {
      return c.json(await mountMetrcRound(c.env.DB, form));
    } catch (err) {
      if (err instanceof HttpError) return c.json({ ok: false, error: err.message }, err.status as 400);
      console.error(err);
      return c.json({ ok: false, error: "Server error." }, 500);
    }
  }
  const result = await mountMetrcExport(c.env.DB, form);
  return c.redirect(result.redirect, 303);
});
app.post("/inventory/metrc/field", async (c) => {
  const result = await setInternalField(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

// THE CHANGE LOCATION SETUP (canon 0.30.40): pick, then Execute; the METRC
// Location Change file pends on /admin/uploads. Under the /inventory* PIN.
app.get("/inventory/change-locations", async (c) => {
  const s = await shell(c);
  const kind = parseLocationKind(c.req.query("kind"));
  const farm = parseFarm(c.req.query("farm"));
  const licenseRaw = (c.req.query("license") ?? "").trim();
  const license = farm && licensesForChange(farm, kind).includes(licenseRaw) ? licenseRaw : "";
  const pick = (c.req.query("pick") ?? "").trim();
  const fromLocation = (c.req.query("from") ?? "").trim();
  const licenseOptions = await listLookup(c.env.DB, "license");
  const licenseLabels = new Map(licenseOptions.map((l) => [l.value, l.label]));
  const scoped = Boolean(farm && license);
  const destinations = scoped ? await listDestinationOptions(c.env.DB, kind, farm!, license) : [];
  const ledger = scoped && kind === "packages" ? await listLedgerPackagesForLicense(c.env.DB, license) : [];
  const found = scoped && kind === "packages" && pick ? await resolvePackagePick(c.env.DB, license, pick) : null;
  const plantLocations = scoped && kind === "plants" ? await listPlantLocationsForLicense(c.env.DB, license) : [];
  const plant = scoped && kind === "plants" && pick ? await findPlant(c.env.DB, license, pick) : null;
  const plants = scoped && kind === "plants" && !pick && fromLocation ? await listPlantsAt(c.env.DB, license, fromLocation) : [];
  const ok = c.req.query("ok") ?? undefined;
  const moved =
    ok === "moved"
      ? { n: Number(c.req.query("n") ?? 0), to: c.req.query("to") ?? "", group: c.req.query("group") ?? "" }
      : undefined;
  return html(
    c,
    s,
    "Change Locations",
    changeLocationPage(
      {
        kind,
        farm,
        license,
        licenseLabels,
        destinations,
        ledger,
        pick,
        found,
        plantLocations,
        fromLocation,
        plants,
        plant,
        recent: await listRecentLocationMoves(c.env.DB),
        today: nowIso().slice(0, 10),
        ok,
        moved,
      },
      s.locale
    )
  );
});
app.post("/inventory/change-locations", async (c) => {
  const result = await changeLocation(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.get("/inventory/zoho-upload", async (c) => {
  const s = await shell(c);
  return html(c, s, "Upload Inventory to Zoho", inventoryReservedPage("zoho-upload", s.locale));
});
app.get("/inventory/physical-audit", async (c) => {
  const s = await shell(c);
  return html(c, s, "Physical Inventory Audit", inventoryReservedPage("physical-audit", s.locale));
});
app.get("/inventory/location-audit", async (c) => {
  const s = await shell(c);
  return html(c, s, "Location Audit", inventoryReservedPage("location-audit", s.locale));
});

app.get("/admin", async (c) => {
  const s = await shell(c);
  return html(c, s, "Admin", adminHomePage(s.locale));
});

// THE SHEET SYNC (canon 0.30.162). The fixture workbook exists only when the
// default env is pointed at it. Production (MS_TENANT_ID set) never serves it.
app.get("/__sheet-fixture", async (c) => {
  if ((c.env.MS_TENANT_ID ?? "").trim() !== "" || !(c.env.SHEET_FIXTURE_URL ?? "").trim()) return c.notFound();
  if (c.req.query("book") === "in_testing") {
    return new Response(inTestingFixtureWorkbook(), {
      headers: { "content-type": "application/vnd.ms-excel.sheet.binary.macroEnabled.12", "cache-control": "no-store" },
    });
  }
  return fixtureHttpResponse(c.env.DB, c.env.SHEET_FIXTURE_URL ?? "", c.req.query("meta") === "1");
});

function sensorFixtureOpen(env: Env): boolean {
  return (env.SENSORPUSH_API_BASE ?? "").includes("__sensorpush");
}

app.post("/__sensorpush/oauth/authorize", async (c) => {
  if (!sensorFixtureOpen(c.env)) return c.notFound();
  return c.json({ authorization: "fixture-authorization" });
});
app.post("/__sensorpush/oauth/accesstoken", async (c) => {
  if (!sensorFixtureOpen(c.env)) return c.notFound();
  return c.json({ accesstoken: "fixture-access" });
});
app.post("/__sensorpush/devices/sensors", async (c) => {
  if (!sensorFixtureOpen(c.env)) return c.notFound();
  return c.json([{ id: "sp-silo3", name: "Silo 3 sensor", battery_voltage: 3.1, active: true }]);
});
app.post("/__sensorpush/samples", async (c) => {
  if (!sensorFixtureOpen(c.env)) return c.notFound();
  const body = (await c.req.json().catch(() => ({}))) as { startTime?: string };
  const start = Date.parse(String(body.startTime ?? ""));
  const hot = !Number.isFinite(start) || Date.now() - start > 10 * 60 * 1000;
  const observed = new Date(Date.now() + (hot ? 0 : 1000)).toISOString();
  return c.json({
    sensors: { "sp-silo3": [{ observed, temperature: hot ? 104.2 : 70, humidity: 40 }] },
    last_time: observed,
    truncated: false,
  });
});

app.get(ENVIRONMENT_PATH, async (c) => {
  const s = await shell(c);
  const page = await loadEnvironmentPage(c.env.DB);
  return html(c, s, "Environment", environmentPage(page, s.locale, c.req.query("ok") ?? null, c.req.query("n") ?? null));
});
app.post(`${ENVIRONMENT_PATH}/refresh`, async (c) => {
  const result = await refreshSensorCatalog(c.env);
  if (result.error) {
    const code = result.error.replace(/^HTTP /, "") || "0";
    return c.redirect(`${ENVIRONMENT_PATH}?ok=refused&n=${encodeURIComponent(code)}`, 303);
  }
  return c.redirect(`${ENVIRONMENT_PATH}?ok=saved`, 303);
});
app.post(`${ENVIRONMENT_PATH}/bind`, async (c) => {
  await saveSensorBinding(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(`${ENVIRONMENT_PATH}?ok=saved`, 303);
});
app.post(`${ENVIRONMENT_PATH}/range`, async (c) => {
  await saveEnvironmentRange(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(`${ENVIRONMENT_PATH}?ok=saved`, 303);
});
app.post(`${ENVIRONMENT_PATH}/stale`, async (c) => {
  await saveStaleMinutes(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(`${ENVIRONMENT_PATH}?ok=saved`, 303);
});

// The last ten runs, the sheet's name and web URL from the last metadata, and Run now.
app.get(ADMIN_SHEET_SYNC_PATH, async (c) => {
  const s = await shell(c);
  const data = await loadSheetSyncAdmin(c.env.DB);
  return html(c, s, "Sheet sync", sheetSyncAdminPage(data, s.locale, c.req.query("ok") ?? null));
});
app.post(`${ADMIN_SHEET_SYNC_PATH}/run`, async (c) => {
  await runSheetSync(c.env, "admin");
  return c.redirect(`${ADMIN_SHEET_SYNC_PATH}?ok=ran`, 303);
});

// THE TESTING DESK (canon 0.30.164), part 3. Keys are present or absent. The
// values never reach the page. Test connection calls GET /facilities/v2.
app.get(ADMIN_METRC_API_PATH, async (c) => {
  const s = await shell(c);
  const data = await loadMetrcAdmin(c.env);
  return html(c, s, "Metrc API", metrcApiPage(data, s.locale, c.req.query("ok") ?? null, Number(c.req.query("n") ?? "0")));
});
app.post(`${ADMIN_METRC_API_PATH}/test`, async (c) => {
  const result = await testMetrcConnection(c.env);
  const n = result.code === "connected" ? `&n=${result.n}` : "";
  return c.redirect(`${ADMIN_METRC_API_PATH}?ok=${result.code}${n}`, 303);
});

// THE HARVEST CONSOLE (canon 0.30.73). Owner ruling 2026-09-15, verbatim: "In
// Admin, add a new button: [Harvest Console]" with its collapsible sections:
// Plants (the three farms and Total, shaded by % complete), Drying (the silo
// strip with the Arlington Dry Room as the wire box and the FFZ cube), and the
// Trimming is built. Pasteurization stays a stub. Testing reads the season.
app.get(HARVEST_PATH, async (c) => {
  const s = await shell(c);
  const now = nowIso();
  // THE CONSOLE DAY (canon 0.30.152): ?day=YYYY-MM-DD picks the day the yesterday panes read.
  // THE TESTING GATE (canon 0.30.293): the four panes are live. The stats and the pie read the harvest year. ?thc= is ignored.
  const input = await loadHarvestConsole(c.env.DB, now, c.req.query("day") ?? null);
  const [silos, cure, testing, prepack] = await Promise.all([
    loadSiloVisuals(c.env.DB),
    listCurePanes(c.env.DB, now, s.locale),
    loadTestingSection(c.env.DB, input.year),
    loadPrepackSection(c.env.DB, input.yesterday),
  ]);
  const checkedLive = await attachLoadChecks(c.env.DB, silos.live, now);
  return html(
    c,
    s,
    "Harvest Console",
    harvestConsolePage({
      input,
      live: checkedLive,
      nowIso: now,
      locale: s.locale,
      ok: c.req.query("ok") ?? undefined,
      cureTiles: curePanes(cure, s.locale),
      envFlags: await listEnvironmentFlags(c.env.DB, now, s.locale),
      // THE DRYING TOTALS (canon 0.30.183): loaded in the silos and the dry rooms with the estimate
      // at the Admin percent, the cure panes' dry grams, the Unloaded Queue for trim.
      dryingTotals: dryingTotals({
        live: silos.live,
        cureLots: [...cure.csa, ...cure.csb],
        queue: { grams: input.trim?.queueGrams ?? 0, lots: input.trim?.queueLots ?? 0 },
        dryYieldPct: silos.dryYieldPct,
      }),
      testing,
      prepack,
    })
  );
});

// THE SILOS ONLY (canon 0.30.299). No PIN. The landing draws the silos alone:
// no dry room, no freezer, no cure tiles. The flags, the clock, the check
// script and the live script ride with the strip.
app.get(MAINTENANCE_PATH, async (c) => {
  const s = await shell(c);
  const now = nowIso();
  const [{ live }, flags] = await Promise.all([
    loadSiloVisuals(c.env.DB),
    listEnvironmentFlags(c.env.DB, now, s.locale),
  ]);
  const strip = siloStrip(await attachLoadChecks(c.env.DB, maintenanceSpaces(live), now), now, s.locale, "", flags);
  return html(c, s, "Maintenance", maintenanceLanding(strip, s.locale));
});
app.get(LAB_SAMPLE_PATH, async (c) => {
  const s = await shell(c);
  return html(c, s, "Lab Sample", await labSamplePage(c.env.DB, nowIso(), s.locale));
});
app.post(`${LAB_SAMPLE_PATH}/schedule`, async (c) => {
  const result = await scheduleLabSample(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post(`${LAB_SAMPLE_PATH}/request`, async (c) => {
  const result = await requestLabSample(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post(`${LAB_SAMPLE_PATH}/unschedule`, async (c) => {
  const result = await unscheduleLabSample(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post(`${LAB_SAMPLE_PATH}/fulfill`, async (c) => {
  const result = await fulfillLabSample(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post(`${LAB_SAMPLE_PATH}/return`, async (c) => {
  const result = await returnLabSample(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.get(TROUBLE_TICKETS_PATH, async (c) => {
  const s = await shell(c);
  return html(c, s, "Trouble Tickets", troubleTicketsPage(s.locale));
});

// The "[open numbox]": one farm's Cutting and Bucking hours for one day.
app.post(HARVEST_HOURS_PATH, async (c) => {
  const result = await saveHarvestHours(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

// THE TRIMMING SECTION (canon 0.30.88): "DLH Yesterday: [numbox]", one number
// per shift per day, behind the console's PIN like the farm hours.
app.post(HARVEST_PREPACK_HOURS_PATH, async (c) => {
  const result = await savePrepackHours(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post(HARVEST_TRIM_HOURS_PATH, async (c) => {
  const result = await saveTrimHours(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

// THE TRIM LINE PICTURE (canon 0.30.154): "input lbs (total lbs ran through
// T-0)", one number per shift per day, behind the console's PIN like the DLH.
app.post(HARVEST_TRIM_INPUT_PATH, async (c) => {
  const result = await saveTrimInputLbs(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/admin/queues", async (c) => {
  const s = await shell(c);
  const sections = [];
  for (const q of queues()) {
    sections.push({ queue: q, rows: await listQueueRows(c.env.DB, q) });
  }
  // Owner ruling 2026-09-06 (canon 0.26.0): logistics moves join the data queues.
  const movements = await listMovementQueueRows(c.env.DB);
  return html(c, s, "Data Queues", dataQueuesPage(sections, s.locale, movements));
});

app.post("/admin/queues/movement/void-checked", async (c) => {
  const result = await voidCheckedMovements(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/admin/queues/:key/void-checked", async (c) => {
  const result = await voidCheckedQueueRows(c.env.DB, c.req.param("key"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/admin/queues/movement/:id/void", async (c) => {
  const form = actorForm(c, await c.req.formData());
  const result = await voidLogisticsMove(c.env.DB, c.req.param("id"), form);
  return c.redirect(result.redirect, 303);
});

// Owner ruling 2026-08-31: [Pending Data Uploads], the CSVs awaiting upload to
// METRC, one format per data type, starting with Wet Weights. The /admin/*
// pinGate above already fronts all three routes; no new gate is declared.
app.get("/admin/uploads", async (c) => {
  const s = await shell(c);
  const rows = await listPendingUploads(c.env.DB);
  const changedRows = await listChangedAfterUpload(c.env.DB);
  const packageRows = await listPendingPackageUploads(c.env.DB);
  const receiveRows = await listPendingReceiveUploads(c.env.DB);
  const manifestRows = await listPendingManifestUploads(c.env.DB);
  const splitRows = await listPendingSplitUploads(c.env.DB);
  const locationRows = await listPendingLocationChangeUploads(c.env.DB);
  // THE TAG LAW (canon 0.30.38): mark the files that would print an internal
  // code where METRC wants the package tag.
  const tagGaps = await listTagGaps(c.env.DB);
  // THE CHANGE LOCATION SETUP (canon 0.30.40): one row per Execute.
  const moveRows = await listPendingLocationMoves(c.env.DB);
  // THE CRYO RUN (canon 0.30.110): the New Packages files, one per finished run.
  const newPackagesRows = await listPendingNewPackagesUploads(c.env.DB);
  // THE RECONCILE LEDGER LOCATION (canon 0.30.135): the notes that ride the
  // queue until a hand acknowledges them; no file behind them.
  const reconcileNotes = await listOpenReconcileNotes(c.env.DB);
  const testSampleRows = await listPendingTestSamples(c.env.DB);
  const prepackFiles = await listPendingPrepackFiles(c.env.DB);
  return html(
    c,
    s,
    "Pending Data Uploads",
    pendingUploadsPage(rows, s.locale, packageRows, receiveRows, manifestRows, splitRows, locationRows, tagGaps, moveRows, newPackagesRows, reconcileNotes, testSampleRows, prepackFiles, changedRows, c.req.query("ok") ?? undefined)
  );
});

// THE RECONCILE LEDGER LOCATION (canon 0.30.135). Owner, 2026-09-20: "add a new
// button to Admin: [Reconcile Ledger Location]". Behind the /admin PIN gate
// like its siblings; the Purge asks the typed Admin PIN again on the form.
app.get(LEDGER_LOCATION_PATH, async (c) => {
  const s = await shell(c);
  const picked = textOrNull(c.req.query("location"));
  const [farms, locations, notes] = await Promise.all([
    listLookup(c.env.DB, "farms"),
    listReconcileLocations(c.env.DB, s.locale),
    listOpenReconcileNotes(c.env.DB),
  ]);
  const known = picked && locations.some((l) => l.value === picked) ? picked : null;
  const items = known ? await listReconcileItems(c.env.DB, known) : [];
  return html(
    c,
    s,
    "Reconcile Ledger Location",
    reconcileLocationPage({
      farms,
      locations,
      picked: known,
      items,
      openNotes: notes.length,
      locale: s.locale,
      ok: c.req.query("ok") ?? undefined,
      n: c.req.query("n") ?? undefined,
    })
  );
});

app.post(LEDGER_LOCATION_PURGE_PATH, async (c) => {
  const result = await purgeLocation(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post(LEDGER_LOCATION_EDIT_PATH, async (c) => {
  const result = await saveLocationEdits(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

// THE TRIM WEIGHS FEED (canon 0.30.137; Corey's agent through the owner: "A
// machine route for the station data behind /station/trim_packages ... The
// poller reads every few minutes, stores each weigh by its row id"). Read-only
// JSON, no PIN (Cloudflare Access fronts it; his pick: a second service token,
// trimatron-poller, on the application), no-store. A bad query answers 400 in
// words as JSON.
app.get(TRIM_WEIGHS_PATH, async (c) => {
  try {
    const query = parseTrimWeighsQuery({
      since: c.req.query("since"),
      limit: c.req.query("limit"),
      live: c.req.query("live"),
      site: c.req.query("site"),
    });
    const page = await listTrimWeighs(c.env.DB, query);
    return c.json(trimWeighsFeed(page, query, nowIso()), 200, { "cache-control": "no-store" });
  } catch (err) {
    if (err instanceof HttpError) return c.json({ ok: false, error: err.message }, err.status as 400, { "cache-control": "no-store" });
    throw err;
  }
});

app.post("/admin/uploads/reconcile_note/:id/acknowledge", async (c) => {
  const result = await acknowledgeReconcileNote(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

// THE PENDING QUEUE CLEAR (canon 0.30.96). Owner: "CAN WE REMOVE ALL THE DOCS
// that are parked on pending data uploads?". His pick: cleared, not uploaded.
// One PIN-gated post (the whole /admin tree sits behind the Admin PIN) disposes
// every pending file with a cleared mark.
app.post("/admin/uploads/uploaded-checked", async (c) => {
  const result = await markCheckedUploaded(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/admin/uploads/clear-all", async (c) => {
  const result = await clearAllUploads(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

// ONE HARVEST FILE PER LOAD (canon 0.30.249): the path keys on the load. The
// attachment is <HBN>(n).csv. Rows are that load only. The seed is the batch
// and the load, so a re-download reproduces.
app.get("/admin/uploads/wet_weights/:file", async (c) => {
  const file = c.req.param("file");
  if (!file.endsWith(".csv")) return c.body("Not found", 404);
  const load = await getHarvestLoad(c.env.DB, file.slice(0, -4));
  if (!load || load.status === "weighing") return c.body("Not found", 404);
  const batch = await getRow(c.env.DB, "harvest_batches", load.harvest_batch_id);
  if (!batch || batch.deleted_at) return c.body("Not found", 404);
  const tags = await listLoadPlantTags(c.env.DB, load.id);
  const batchFarm = String(batch.farm_code ?? "");
  const barn = barnLocationForSite(
    batchFarm === "ARL" || batchFarm === "PNS" ? batchFarm : "PNN"
  );
  const seed = `${load.harvest_batch_id}:${load.id}`;
  let csvBody: string;
  const entries = await listWetWeightUploadEntries(c.env.DB, load.harvest_batch_id, load.id);
  if (tags.length > 0) {
    const jitterPct = plantSplitJitterPct(
      await getConfigValue(c.env.DB, CONFIG_KEYS.plant_split_jitter_pct)
    );
    csvBody = wetWeightsCsvWithTags(entries, tags, jitterPct, seed, barn);
  } else if (anyPlantCount(entries)) {
    const jitterPct = plantSplitJitterPct(
      await getConfigValue(c.env.DB, CONFIG_KEYS.plant_split_jitter_pct)
    );
    const reads = await listWetWeightUploadReads(c.env.DB, load.harvest_batch_id, load.id);
    csvBody = wetWeightsCsvWithCounts(entries, reads, jitterPct, seed, barn);
  } else {
    csvBody = wetWeightsCsv(await listWetWeightUploadReads(c.env.DB, load.harvest_batch_id, load.id), barn);
  }
  return new Response(csvBody, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${wetWeightsFilename(load.hbn, load.seq)}"`,
    },
  });
});

app.post("/admin/uploads/wet_weights/:batchId/acknowledge", async (c) => {
  const result = await acknowledgeChangedUpload(c.env.DB, c.req.param("batchId"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/admin/uploads/wet_weights/:batchId/uploaded", async (c) => {
  const form = actorForm(c, await c.req.formData());
  const result = await markUploaded(
    c.env.DB,
    METRC_UPLOAD_KINDS.wet_weights,
    c.req.param("batchId"),
    form
  );
  return c.redirect(result.redirect, 303);
});

// Owner ruling 2026-08-31: the Plant fill rule; the uploads page's tag form
// posts here. Save tags REPLACES the batch's set; an empty paste clears it.
app.get("/admin/uploads/:kind/:file", async (c) => {
  const kind = c.req.param("kind");
  const file = c.req.param("file");
  if (kind === "test_sample") {
    if (!file.endsWith(".csv")) return c.body("Not found", 404);
    const builtTest = await buildTestSampleCsv(c.env.DB, file.slice(0, -4));
    return new Response(builtTest.body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${builtTest.filename}"`,
      },
    });
  }
  // THE CRYO RUN (canon 0.30.110): the New Packages file, the owner's T3
  // autofill template as an .xlsx, one per finished run.
  if (kind === "new_packages") {
    if (!file.endsWith(".xlsx")) return c.body("Not found", 404);
    const scheduleId = file.slice(0, -5);
    const schedule = await getScheduleRow(c.env.DB, scheduleId);
    const builtNp = schedule?.stage === "prepack" ? await buildPrepackNewPackages(c.env.DB, scheduleId) : await buildNewPackagesXlsx(c.env.DB, scheduleId);
    return new Response(builtNp.bytes, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${builtNp.filename}"`,
      },
    });
  }
  if (kind === "manifest") {
    if (!file.endsWith(".csv")) return c.body("Not found", 404);
    const built = await buildManifestCsv(c.env.DB, file.slice(0, -4));
    return new Response(built.body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${built.filename}"`,
      },
    });
  }
  if (kind === "receive_manifest") {
    if (!file.endsWith(".csv")) return c.body("Not found", 404);
    const built = await buildReceiveCsv(c.env.DB, file.slice(0, -4));
    return new Response(built.body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${built.filename}"`,
      },
    });
  }
  if (kind === "package_split") {
    if (!file.endsWith(".csv")) return c.body("Not found", 404);
    const built = await buildSplitCsv(c.env.DB, file.slice(0, -4));
    return new Response(built.body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${built.filename}"`,
      },
    });
  }
  // Canon 0.30.40: a Change Location Execute's file (plants or packages).
  if (kind === "location_move") {
    if (!file.endsWith(".csv")) return c.body("Not found", 404);
    const builtMove = await locationMoveCsv(c.env.DB, file.slice(0, -4));
    return new Response(builtMove.body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${builtMove.filename}"`,
      },
    });
  }
  // Canon 0.30.6: the Load Silo location change file.
  if (kind === "location_change") {
    if (!file.endsWith(".csv")) return c.body("Not found", 404);
    const built = await locationChangeUploadCsv(c.env.DB, file.slice(0, -4));
    return new Response(built.body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${built.filename}"`,
      },
    });
  }
  // THE PREPACK (canon 0.30.188): the Finish file for a packed parent. The old
  // lot finish lane stays gone.
  if (kind === "package_finish") {
    if (!file.endsWith(".csv")) return c.body("Not found", 404);
    const builtFinish = await buildPrepackFinishCsv(c.env.DB, file.slice(0, -4));
    return new Response(builtFinish.body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${builtFinish.filename}"`,
      },
    });
  }
  if (kind !== "package_from_harvest" && kind !== "package_adjust") {
    return c.notFound();
  }
  if (!file.endsWith(".csv")) return c.body("Not found", 404);
  const sessionId = file.slice(0, -4);
  const built = await packageUploadCsv(c.env.DB, kind, sessionId);
  return new Response(built.body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${built.filename}"`,
    },
  });
});

app.post("/admin/uploads/:kind/:id/uploaded", async (c) => {
  const kind = c.req.param("kind");
  if (kind === "test_sample") {
    const builtTest = await buildTestSampleCsv(c.env.DB, c.req.param("id"));
    const resultTest = await markUploaded(
      c.env.DB,
      METRC_UPLOAD_KINDS.test_sample,
      builtTest.harvest_batch_id,
      actorForm(c, await c.req.formData()),
      c.req.param("id")
    );
    return c.redirect(resultTest.redirect, 303);
  }
  if (kind === "new_packages" || kind === "package_finish") {
    const job = await getScheduleRow(c.env.DB, c.req.param("id"));
    if (job?.stage === "prepack") {
      const marked = await markUploaded(
        c.env.DB,
        kind === "package_finish" ? METRC_UPLOAD_KINDS.package_finish : METRC_UPLOAD_KINDS.new_packages,
        job.harvest_batch_id,
        actorForm(c, await c.req.formData()),
        job.id
      );
      return c.redirect(marked.redirect, 303);
    }
    if (kind === "package_finish") return c.notFound();
    const run = await getCryoRun(c.env.DB, c.req.param("id"));
    if (!run) return c.notFound();
    const resultNp = await markUploaded(
      c.env.DB,
      METRC_UPLOAD_KINDS.new_packages,
      run.harvest_batch_id,
      actorForm(c, await c.req.formData()),
      run.id
    );
    return c.redirect(resultNp.redirect, 303);
  }
  if (kind === "manifest") {
    const result = await markManifestUploaded(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
    return c.redirect(result.redirect, 303);
  }
  if (kind === "receive_manifest") {
    const result = await markReceiveManifestUploaded(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
    return c.redirect(result.redirect, 303);
  }
  if (kind === "package_split") {
    const result = await markSplitUploaded(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
    return c.redirect(result.redirect, 303);
  }
  if (kind === "location_move") {
    const resultMove = await markLocationMoveUploaded(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
    return c.redirect(resultMove.redirect, 303);
  }
  if (kind === "location_change") {
    const builtLc = await locationChangeUploadCsv(c.env.DB, c.req.param("id"));
    const resultLc = await markUploaded(
      c.env.DB,
      METRC_UPLOAD_KINDS.location_change,
      builtLc.harvest_batch_id,
      actorForm(c, await c.req.formData()),
      c.req.param("id")
    );
    return c.redirect(resultLc.redirect, 303);
  }
  // Canon 0.30.1 fork 7: package_finish is gone from the app; its lane 404s.
  if (kind !== "package_from_harvest" && kind !== "package_adjust") {
    return c.notFound();
  }
  const built = await packageUploadCsv(c.env.DB, kind, c.req.param("id"));
  const kindKey =
    kind === "package_from_harvest"
      ? METRC_UPLOAD_KINDS.package_from_harvest
      : METRC_UPLOAD_KINDS.package_adjust;
  const result = await markUploaded(
    c.env.DB,
    kindKey,
    built.harvest_batch_id,
    actorForm(c, await c.req.formData()),
    c.req.param("id")
  );
  return c.redirect(result.redirect, 303);
});

app.post("/admin/uploads/wet_weights/:batchId/tags", async (c) => {
  const form = actorForm(c, await c.req.formData());
  const result = await savePlantTags(c.env.DB, c.req.param("batchId"), form);
  return c.redirect(result.redirect, 303);
});

// Owner ruling 2026-09-02: Import Data queue. PIN already fronts /admin/*.
app.get("/admin/imports", async (c) => {
  const s = await shell(c);
  const rows = await listImportQueue(c.env.DB);
  const seen = c.req.query("seen");
  const harvestFlash =
    c.req.query("ok") === "harvest_details" && c.req.query("hseen") != null
      ? t(
          s.locale,
          "Harvest Details: {hseen} seen, {hlanded} landed, {hchanged} changed, {hskipped} skipped; Labor: {lseen} seen, {llanded} landed."
        )
          .replaceAll("{hseen}", c.req.query("hseen") ?? "0")
          .replaceAll("{hlanded}", c.req.query("hlanded") ?? "0")
          .replaceAll("{hchanged}", c.req.query("hchanged") ?? "0")
          .replaceAll("{hskipped}", c.req.query("hskipped") ?? "0")
          .replaceAll("{lseen}", c.req.query("lseen") ?? "0")
          .replaceAll("{llanded}", c.req.query("llanded") ?? "0")
      : "";
  const harvestNote = c.req.query("message");
  const flash =
    harvestFlash
      ? `${harvestFlash}${harvestNote ? ` ${translateSheetMessage(harvestNote, s.locale)}` : ""}`
      : c.req.query("ok") === "in_testing" && seen != null
        ? t(s.locale, "In testing sheet: {seen} seen, {landed} landed, {changed} changed, {skipped} skipped.")
            .replace("{seen}", seen)
            .replace("{landed}", c.req.query("landed") ?? "0")
            .replace("{changed}", c.req.query("changed") ?? "0")
            .replace("{skipped}", c.req.query("skipped") ?? "0")
        : "";
  return html(c, s, "Import Data", importQueuePage(rows, s.locale, flash));
});

app.post("/admin/imports", async (c) => {
  const form = actorForm(c, await c.req.formData());
  const result = await queueImport(c.env.DB, form);
  return c.redirect(result.redirect, 303);
});

app.get("/admin/imports/:id/download", async (c) => {
  const row = await getRow(c.env.DB, "import_queue", c.req.param("id"));
  if (!row || row.deleted_at) return c.body("Not found", 404);
  const kind = row.kind === "xlsx" || row.kind === "csv" ? (row.kind as ImportKind) : null;
  if (!kind) return c.body("Not found", 404);
  const bytes = asStoredBytes(row.content);
  return new Response(bytes, {
    headers: {
      "content-type": importContentType(kind),
      "content-disposition": `attachment; filename="${attachmentFilename(String(row.filename))}"`,
    },
  });
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

// Owner ruling 2026-09-01: the view pill (Grip/Lite/CO) posts here and returns
// to the same page, the locale pill's mirror; the cookie holds for a year.
app.post("/view", async (c) => {
  const form = await c.req.formData();
  const view = asView(form.get("view"));
  setCookie(c, VIEW_COOKIE, view, {
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

// Owner ruling 2026-09-01: the computer/phone pill posts here and returns to
// the same page, mirroring /locale; the cookie holds for a year.
app.post("/device", async (c) => {
  const form = await c.req.formData();
  const device = asDevice(form.get("device"));
  setCookie(c, DEVICE_COOKIE, device, {
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

// Owner ruling 2026-09-01: /brand/:file serves the three brand assets from the
// ASSETS binding. No PIN (every logged-in page loads them, the PIN gate page
// included; Cloudflare Access still fronts all production traffic). Correct
// content types, cache-control public max-age 3600; anything else 404s.
const BRAND_FILES: Record<string, string> = {
  "grip.svg": "image/svg+xml",
  "co-mark.svg": "image/svg+xml",
  "factory-plate.png": "image/png",
};

app.get("/brand/:file", async (c) => {
  const file = c.req.param("file");
  const contentType = BRAND_FILES[file];
  if (!contentType) return c.body("Not found", 404);
  const asset = await c.env.ASSETS.fetch(new Request(new URL(`/brand/${file}`, c.req.url)));
  if (!asset.ok) return c.notFound();
  return new Response(asset.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    },
  });
});

const ICON_VARIANTS = new Set(["white", "dark"]);
const ICON_FILES: Record<string, string> = {
  "harvest-field.svg": "image/svg+xml",
  "harvest-field.png": "image/png",
  "interco-truck.svg": "image/svg+xml",
  "interco-truck.png": "image/png",
  "drying-silo.svg": "image/svg+xml",
  "drying-silo.png": "image/png",
  "production-factory.svg": "image/svg+xml",
  "production-factory.png": "image/png",
  "marketplace.svg": "image/svg+xml",
  "marketplace.png": "image/png",
  "business-scale.svg": "image/svg+xml",
  "business-scale.png": "image/png",
};

app.get("/icons/:variant/:file", async (c) => {
  const variant = c.req.param("variant");
  const file = c.req.param("file");
  const contentType = ICON_FILES[file];
  if (!ICON_VARIANTS.has(variant) || !contentType) return c.body("Not found", 404);
  const asset = await c.env.ASSETS.fetch(new Request(new URL(`/icons/${variant}/${file}`, c.req.url)));
  if (!asset.ok) return c.notFound();
  return new Response(asset.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    },
  });
});

// Owner ruling 2026-09-07 (canon 0.29.0): the Continuum pages' vendored
// screenshots. run_worker_first means assets serve only through routed
// handlers; pngs only, same shape as /icons.
app.get("/continuum/:file", async (c) => {
  const file = c.req.param("file");
  // Canon 0.30.14: vendor logos arrive as the owner supplies them, png or jpg.
  const m = /^[a-z0-9-]+\.(png|jpe?g)$/.exec(file);
  if (!m) return c.body("Not found", 404);
  const asset = await c.env.ASSETS.fetch(new Request(new URL(`/continuum/${file}`, c.req.url)));
  if (!asset.ok) return c.notFound();
  return new Response(asset.body, {
    headers: {
      "content-type": m[1] === "png" ? "image/png" : "image/jpeg",
      "cache-control": "public, max-age=3600",
    },
  });
});

/** Canon 0.30.6: the silo strip above every Drying Operations page including
 * the menu; canon 0.30.69: five cone-topped cylinders with their live fill. */
async function siloStripFor(c: AppContext): Promise<string> {
  const s = await shell(c);
  // THE CURE PANES ride the strip's row after the last space tile.
  const now = nowIso();
  const [{ live }, cure, flags] = await Promise.all([
    loadSiloVisuals(c.env.DB),
    listCurePanes(c.env.DB, now, s.locale),
    listEnvironmentFlags(c.env.DB, now, s.locale),
  ]);
  return siloStrip(await attachLoadChecks(c.env.DB, live, now), now, s.locale, curePanes(cure, s.locale), flags);
}

app.post(SENSOR_PATH, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "The body must be JSON." }, 400, { "cache-control": "no-store" });
  }
  try {
    const stored = await storeSensorReadings(c.env.DB, body, nowIso());
    return c.json({ ok: true, stored }, 200, { "cache-control": "no-store" });
  } catch (err) {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as ContentfulStatusCode, { "cache-control": "no-store" });
    throw err;
  }
});

/** THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69; owner: "Live inventory
 * on all screens"): the visuals every silo tile repaints itself from, every
 * thirty seconds while the page is in view. Read-only; the strip already shows
 * the same facts on ungated pages. */
app.get(SILO_LIVE_PATH, async (c) => {
  const s = await shell(c);
  const now = nowIso();
  const { live, capacityGrams } = await loadSiloVisuals(c.env.DB);
  const flags = await listEnvironmentFlags(c.env.DB, now, s.locale);
  const checked = await attachLoadChecks(c.env.DB, live, now);
  return c.json(
    {
      capacityGrams,
      at: now,
      silos: checked.map((l) =>
        siloLiveEntry(l.silo.id, l.silo.name, l.visual, s.locale, spaceShapeOf(l.silo), flags[l.silo.name] ?? [], l.emptySince, liveChecksOf(l.loadChecks))
      ),
    },
    200,
    { "cache-control": "no-store" }
  );
});

// Drying Operations: Load Silo (owner ruling 2026-09-08, canon 0.30.6). A crew
// station outside the field registry, so its routes sit ahead of /station/:key.
app.get("/station/load_silo", async (c) => {
  const s = await shell(c);
  // THE HARVEST CONSOLE (canon 0.30.73): the pane reads every farm's barn; the
  // silo select narrows to the picked lot's own site.
  const [barnLots, waiting, siloVisuals] = await Promise.all([
    listScheduledLotsForLoad(c.env.DB),
    listBarnWetLots(c.env.DB),
    loadSiloVisuals(c.env.DB),
  ]);
  const silos = siloVisuals.live.map((l) => l.silo);
  const loads = siloVisuals.live.flatMap((l) => l.loads);
  const pick = c.req.query("pick") ?? "";
  const loadId = c.req.query("load") ?? "";
  const pickedDirect = pick ? barnLots.find((l) => l.id === pick) ?? null : null;
  const pickedPart = !pickedDirect && pick ? waiting.find((part) => part.id === pick) : null;
  const picked = pickedDirect ?? (pickedPart ? barnLots.find((l) => l.harvest_batch_id && l.harvest_batch_id === pickedPart.harvest_batch_id) ?? null : null);
  const pickedParts = picked ? waiting.filter((part) => part.harvest_batch_id === picked.id) : [];
  const pickedLoad = loadId ? await getSiloLoad(c.env.DB, loadId) : null;
  // THE DRYING SCHEDULE (canon 0.30.226): a drying surface's >> carries its space type and the planned space.
  const kindRaw = c.req.query("kind") ?? "";
  const kind = (DRY_SPACE_TYPES as readonly string[]).includes(kindRaw) ? (kindRaw as DrySpaceType) : null;
  const now = nowIso();
  const flags = await listEnvironmentFlags(c.env.DB, now, s.locale);
  return html(
    c,
    s,
    "Load Silo",
    siloStrip(await attachLoadChecks(c.env.DB, siloVisuals.live, now), now, s.locale, "", flags) +
      loadSiloPage({
        barnLots,
        silos,
        loads,
        picked,
        pickedLoad,
        nowIso: now,
        farmDayStart: s.farmDayStart,
        locale: s.locale,
        ok: c.req.query("ok") ?? undefined,
        kind,
        space: kind ? (c.req.query("space") ?? null) : null,
        parts: pickedParts,
      })
  );
});

app.post("/station/load_silo/load", async (c) => {
  const result = await loadSilo(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/station/load_silo/:loadId/start", async (c) => {
  const result = await startSiloLoad(c.env.DB, c.req.param("loadId"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/station/load_silo/:loadId/pause", async (c) => {
  const result = await pauseSiloLoad(c.env.DB, c.req.param("loadId"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

// PRODUCTION SCHEDULING (canon 0.30.97): floor stations, no Admin PIN on the
// pages; the right-pane demote carries its own typed PIN.
app.get(PRODUCTION_SCHEDULING_PATH, async (c) => {
  const s = await shell(c);
  return html(c, s, "Production Scheduling", schedulingLanding(s.locale));
});

app.get(`${PRODUCTION_SCHEDULING_PATH}/:stage`, async (c) => {
  // THE DRYING SCHEDULE (canon 0.30.226): Silos, Dry Rooms and Freezers, views
  // over the waiting lots, the open loads and the unloads; the silo strip
  // rides above them as it does every Drying Operations page.
  const drying = parseDryingStage(c.req.param("stage"));
  if (drying) {
    const s = await shell(c);
    const now = nowIso();
    const [lots, visuals, complete, cure, flags] = await Promise.all([
      listScheduledLotsForLoad(c.env.DB),
      loadSiloVisuals(c.env.DB),
      listDryingComplete(c.env.DB, dryingCompleteSince(now, s.farmDayStart)),
      listCurePanes(c.env.DB, now, s.locale),
      listEnvironmentFlags(c.env.DB, now, s.locale),
    ]);
    return html(
      c,
      s,
      SCHEDULE_STAGE_TITLES[drying],
      siloStrip(await attachLoadChecks(c.env.DB, visuals.live, now), now, s.locale, curePanes(cure, s.locale), flags) +
        dryingSchedulingPage({
          stage: drying,
          lots,
          live: visuals.live,
          complete,
          nowIso: now,
          farmDayStart: s.farmDayStart,
          together: c.req.query("together") ?? null,
          locale: s.locale,
        })
    );
  }
  const stage = parseScheduleStage(c.req.param("stage"));
  if (!stage) return c.notFound();
  const s = await shell(c);
  // THE SCHEDULER BY PACKAGE (canon 0.30.196): the Prepack page lists packages, filtered by ?q=.
  if (stage === SCHEDULE_STAGES.prepack) {
    const [panes, adopt] = await Promise.all([listPrepackPanes(c.env.DB), listMetrcAdoptions(c.env.DB)]);
    return html(c, s, SCHEDULE_STAGE_TITLES[stage], prepackSchedulingPage(panes, adopt, s.locale, c.req.query("q") ?? ""));
  }
  const [available, working, complete] = await Promise.all([
    listScheduleAvailable(c.env.DB, stage),
    listScheduleWorking(c.env.DB, stage),
    listScheduleComplete(c.env.DB, stage),
  ]);
  return html(
    c,
    s,
    SCHEDULE_STAGE_TITLES[stage],
    schedulingPage(stage, { available, working, complete }, s.locale, nowIso(), c.req.query("ok") ?? undefined)
  );
});

app.post(`${PRODUCTION_SCHEDULING_PATH}/:stage/schedule`, async (c) => {
  const stage = parseScheduleStage(c.req.param("stage"));
  if (!stage) return c.notFound();
  const form = actorForm(c, await c.req.formData());
  if (stage === SCHEDULE_STAGES.prepack) {
    // >> ADOPTS AND SCHEDULES (canon 0.30.200): a From METRC row posts its tag;
    // an Available row posts its package.
    const tag = textOrNull(form.get("tag"));
    const result = tag
      ? await adoptFromMetrc(c.env.DB, form)
      : await schedulePackage(c.env.DB, String(form.get("wip_package_id") ?? ""), form);
    return c.redirect(result.redirect, 303);
  }
  const hbnId = String(form.get("hbn_id") ?? "");
  const result = await scheduleHbn(c.env.DB, stage, hbnId, form);
  return c.redirect(result.redirect, 303);
});

// THE JOINT UNLOAD (canon 0.30.226): Unload together on a drying surface's Working pane.
app.post(`${PRODUCTION_SCHEDULING_PATH}/:stage/unload_together/:spaceId`, async (c) => {
  const stage = parseDryingStage(c.req.param("stage"));
  if (!stage) return c.notFound();
  const result = await unloadTogether(c.env.DB, stage, c.req.param("spaceId"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post(`${PRODUCTION_SCHEDULING_PATH}/:stage/unschedule/:id`, async (c) => {
  const stage = parseScheduleStage(c.req.param("stage"));
  if (!stage) return c.notFound();
  const result = await unscheduleItem(
    c.env.DB,
    stage,
    c.req.param("id"),
    actorForm(c, await c.req.formData())
  );
  return c.redirect(result.redirect, 303);
});

app.post(`${PRODUCTION_SCHEDULING_PATH}/:stage/complete/:id`, async (c) => {
  const stage = parseScheduleStage(c.req.param("stage"));
  if (!stage) return c.notFound();
  const result = await completeScheduleItem(
    c.env.DB,
    stage,
    c.req.param("id"),
    actorForm(c, await c.req.formData())
  );
  return c.redirect(result.redirect, 303);
});

app.post(`${PRODUCTION_SCHEDULING_PATH}/:stage/unfinish/:id`, async (c) => {
  const stage = parseScheduleStage(c.req.param("stage"));
  if (!stage) return c.notFound();
  const result = await unfinishScheduleItem(
    c.env.DB,
    stage,
    c.req.param("id"),
    actorForm(c, await c.req.formData())
  );
  return c.redirect(result.redirect, 303);
});

// THE CRYO RUN (canon 0.30.110; owner: "For cryo, replicate the trim line
// surface in cryo production reporting" and "do not expose individual
// containers ... on the input list in the production reporting node"): Cryo
// Weight Entry lists the scheduled runs, one per HBN, and works the picked
// run's pool with the trim-style line; a finished run opens read-only.
app.get(PREPACK_STATION_PATH, async (c) => {
  const s = await shell(c);
  const pane = await loadPrepackPane(c.env.DB, c.req.query("pick") ?? null, c.req.query("ask") === "1");
  return html(c, s, "Prepack", prepackPage(pane, s.locale, nowIso(), c.req.query("ok") ?? undefined));
});

app.post(`${PREPACK_STATION_PATH}/:id/line`, async (c) => {
  const result = await addPrepackLine(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post(`${PREPACK_STATION_PATH}/line/:id/void`, async (c) => {
  const result = await voidPrepackLine(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post(`${PREPACK_STATION_PATH}/:id/finish`, async (c) => {
  const result = await finishPrepack(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/station/cryo_weight", async (c) => {
  const s = await shell(c);
  const [workingRuns, finishedRuns] = await Promise.all([
    listCryoRuns(c.env.DB, SCHEDULE_STATUS.scheduled),
    listCryoRuns(c.env.DB, SCHEDULE_STATUS.complete),
  ]);
  const runs = [...workingRuns, ...finishedRuns];
  const pick = c.req.query("pick") ?? "";
  let picked: Parameters<typeof cryoStationPage>[0]["picked"] = null;
  if (pick) {
    const run = await getCryoRun(c.env.DB, pick);
    if (!run) return c.notFound();
    picked = {
      run,
      pool: await listCryoRunPool(c.env.DB, pick),
      outputs: await listCryoRunOutputs(c.env.DB, pick),
      inputs: await listCryoRunInputs(c.env.DB, pick),
      categories: await listCryoCategories(c.env.DB),
    };
  }
  return html(
    c,
    s,
    "Cryo Weight Entry",
    cryoStationPage({ runs, picked, nowIso: nowIso(), locale: s.locale, ok: c.req.query("ok") ?? undefined, err: c.req.query("err") ?? undefined })
  );
});

app.post("/station/cryo_weight/run/:id/add", async (c) => {
  const form = actorForm(c, await c.req.formData());
  const result = await addCryoOutput(c.env.DB, c.req.param("id"), form);
  return c.redirect(result.redirect, 303);
});

app.post("/station/cryo_weight/run/:id/unfinish-container/:inputId", async (c) => {
  const form = actorForm(c, await c.req.formData());
  const result = await unfinishCryoContainer(c.env.DB, c.req.param("id"), c.req.param("inputId"), form);
  return c.redirect(result.redirect, 303);
});

app.post("/station/cryo_weight/run/:id/unfinish-output/:outputId", async (c) => {
  const form = actorForm(c, await c.req.formData());
  const result = await unfinishCryoOutput(c.env.DB, c.req.param("outputId"), form);
  return c.redirect(result.redirect, 303);
});

app.post("/station/cryo_weight/run/:id/finish", async (c) => {
  const form = actorForm(c, await c.req.formData());
  const result = await finishCryoRun(c.env.DB, c.req.param("id"), form);
  return c.redirect(result.redirect, 303);
});

app.get("/station/:key", async (c) => {
  const station = stationByKey(c.req.param("key"));
  if (!station) return c.notFound();
  const s = await shell(c);
  const lotId = station.ledger ? c.req.query("lot") : undefined;
  if (lotId && station.ledger) {
    const ledger = station.ledger;
    // Owner ruling 2026-08-31: "left pane: available-in-queue, right pane: what's
    // currently saved about that record and the ability to add more to it." On a
    // direct ledger station the pick page IS the record page, so ?lot= survives
    // only as a compatibility alias that redirects to ?pick= (the reverse of the
    // old direction); the pick path below owns the status guards.
    if (ledger.mode === "direct") {
      return c.redirect(`/station/${station.key}?pick=${encodeURIComponent(lotId)}`, 302);
    }
    const lot = await getLot(c.env.DB, lotId);
    if (!lot) return c.notFound();
    const weights = await listLotWeights(c.env.DB, ledger, lotId);
    const toteHbns =
      ledger.table === "wet_weights" && lot.farm_code && lot.harvest_batch_id
        ? await listOpenFarmHbns(c.env.DB, lot.farm_code, lot.harvest_batch_id)
        : [];
    const farmName = await farmDisplayName(c.env.DB, lot.farm_code ?? "");
    const total = sumGrams(weights.map((w) => Number(w.weight_grams)));
    // Owner ruling 2026-08-31: the two-pane theme is the station law for
    // everything ("left pane: available-in-queue, right pane: what's currently
    // saved about that record and the ability to add more to it"), so the wet
    // lot view renders its panel on the station page beside the same filtered
    // pane the header view shows. A weighing lot's batch stays in the pane by
    // the paneFilter law and renders picked with its group open; a lot whose
    // batch has left the pane still renders its panel with no row marked. The
    // URL stays ?lot=<lotId> because one batch can hold several lots, so the
    // lot id is the record key.
    if (station.leftPane) {
      const paneQueue = queueByKey(station.leftPane.queue);
      const lotPaneRows = !paneQueue
        ? []
        : station.leftPane.paneFilter
          ? await listPaneRows(c.env.DB, paneQueue, station.leftPane.paneFilter)
          : await listQueueRows(c.env.DB, paneQueue);
      const batchRow = lotPaneRows.find((row) => row.id === lot.harvest_batch_id);
      return html(
        c,
        s,
        station.title,
        stationPage(
          station,
          s.people,
          s.personId,
          {},
          {},
          queueMap(),
          batchRow?.id ?? "",
          undefined,
          lotPaneRows,
          s.locale,
          wetLotPanel(station, lot, weights, farmName, total, s.locale, toteHbns)
        )
      );
    }
    return html(
      c,
      s,
      station.title,
      lotPage(station, lot, weights, farmName, total, s.locale)
    );
  }
  const lookups = await lookupsForStation(c.env.DB, station);
  const queueOptions = await queueOptionsForStation(c.env.DB, station);
  const acquireCtx =
    station.key === "acquire_hbn"
      ? {
          recallRows: await listRecallableBatches(c.env.DB),
          prefill: recallPrefillFromQuery(new URL(c.req.url).searchParams),
        }
      : undefined;
  let pickId = "";
  let ledgerCtx: StationLedgerCtx | undefined;
  let paneRows: QueueRow[] | undefined;
  let ledgerPanel: string | undefined;
  let pickBalance: PickBalanceCtx | undefined;
  let trimCtx: TrimCtx | undefined;
  if (station.leftPane) {
    const paneQueue = queueByKey(station.leftPane.queue);
    // The pane and its pick validation share the filtered rows; a hidden batch cannot be picked.
    paneRows =
      station.leftPane.paneFilter && paneQueue
        ? await listPaneRows(c.env.DB, paneQueue, station.leftPane.paneFilter)
        : queueOptions[station.leftPane.queue] ?? [];
    const pick = c.req.query("pick") ?? "";
    if (pick && station.ledger?.mode === "direct") {
      // Owner ruling 2026-08-31: on a direct ledger station the pick IS the lot
      // and stays on the two-pane page; the right pane is the lot's saved dry
      // record plus its add controls. The page serves lots in the ledger's
      // status only (mid-unload lots stay drying until Finish unload, so they
      // resume here); an unknown or voided lot 404s and anything else bounces
      // back to the station.
      const ledger = station.ledger;
      const lot = await getLot(c.env.DB, pick);
      if (!lot) return c.notFound();
      if (lot.status !== ledger.lotStatus) {
        return c.redirect(
          `/station/${station.key}?err=${encodeURIComponent(t(s.locale, "That lot is not in the Dry Space Queue."))}`,
          302
        );
      }
      // The queue predicate matches the ledger status, so a guarded lot sits in
      // the pane rows; the find keeps the wet precedent of treating a missing
      // row as no pick (the landing state).
      const picked = paneRows.find((row) => row.id === pick);
      if (picked) {
        pickId = picked.id;
        const weights = await listLotWeights(c.env.DB, ledger, picked.id);
        const total = sumGrams(weights.map((w) => Number(w.weight_grams)));
        const ts = nowIso();
        const sessionHead = await ensureUnloadSession(c.env.DB, picked.id, s.personId, ts);
        const session = await getOpenUnloadSession(c.env.DB, picked.id);
        const sessionWeightCount = session ? await countSessionWeights(c.env.DB, session.id) : 0;
        void sessionHead;
        const parent = await getInventoryItemForLot(c.env.DB, picked.id);
        ledgerPanel = unloadLotPanel(
          station,
          lot,
          weights,
          total,
          s.locale,
          session,
          s.personEmail,
          sessionWeightCount,
          {
            parentQty: parent ? Number(parent.qty) : null,
            showGate: c.req.query("gate") === "1",
            rapidFocus: c.req.query("rapid") === "1",
            // Owner ruling 2026-09-07 (canon 0.29.1): the on-site question
            // survives only for spear material away from North. The panel
            // checks spear; this checks North (item location, else batch farm).
            askOnSite: !materialAtNorth(parent?.location ?? null, lot.farm_code),
          }
        );
      }
    } else {
      const picked = pick ? paneRows.find((row) => row.id === pick) : undefined;
      if (picked) {
        pickId = picked.id;
        if (station.ledger) {
          const farmCode = picked.values.farm_code ?? "";
          const kinds = moveToKindsForFarm(farmCode);
          // Owner ruling 2026-08-31: trucks are record-borne. Truck options derive
          // from this batch's own lots, plus the staged next number from ?truck=
          // when it exceeds the derived list; farms whose law disallows kind truck
          // get no truck options and no Add a truck control.
          let truckOptions: string[] | undefined;
          let stagedTruck: string | undefined;
          if (kinds.includes("truck")) {
            truckOptions = await listBatchTruckNumbers(c.env.DB, picked.id);
            const staged = c.req.query("truck") ?? "";
            // A valid staged number exceeds every derived one; anything else is a stale link.
            if (truckNumberFromPick(`truck-${staged}`) && Number(staged) >= nextTruckNumber(truckOptions)) {
              stagedTruck = staged;
            }
          }
          const resumeLots = await listLotsByStatus(c.env.DB, picked.id, LOT_STATUS.weighing);
          const todayTrucks = await listFarmDayTruckNumbers(c.env.DB, farmCode, await farmToday(c.env.DB, nowIso()));
          const suggestedTruck = String(nextTruckNumber(todayTrucks));
          // Owner ruling 2026-09-01 (alpha feedback): an in-progress lot must never
          // hide behind a blank header form, or a crew member fixing a weight can
          // re-enter the header and mint a duplicate lot. Exactly one weighing lot:
          // the pick lands ON the lot; the header form returns only through the
          // explicit Start another lot link (?new=1; a staged ?truck= also implies
          // the header form is wanted, so it never bounces).
          if (
            resumeLots.length === 1 &&
            c.req.query("new") == null &&
            c.req.query("truck") == null
          ) {
            return c.redirect(
              `/station/${station.key}?lot=${encodeURIComponent(resumeLots[0].id)}`,
              302
            );
          }
          ledgerCtx = {
            farmName: await farmDisplayName(c.env.DB, farmCode),
            // THE BLANK SLATE (canon 0.30.108): every HBN's Move To is the landing site's spaces.
            moveToOptions: await listDrySpacesByKinds(c.env.DB, kinds, LANDING_FARM),
            truckOptions,
            stagedTruck,
            resumeLots,
            newFormOpen: c.req.query("new") != null || c.req.query("truck") != null,
            suggestedTruck,
          };
        }
        // Owner ruling 2026-08-31: "The weights of the original package and
        // what's left after a record is created should be on the weight
        // recording pages." Trim records packages against a picked unloaded
        // lot, today's only pick-station over lots, so its picked view carries
        // Original (dry) / Recorded / Remaining above the packages form.
        if (station.key === "trim_packages") {
          const original = Number(picked.values.dry_weight_grams || 0);
          const recorded = await sumLotPackageGrams(c.env.DB, picked.id);
          pickBalance = {
            original,
            recorded,
            remaining: sumGrams([original, -recorded]),
          };
          // Canon 0.30.9: the entered packages ride beneath the working pane.
          trimCtx = { entered: await listLotTrimPackages(c.env.DB, picked.id) };
        }
      }
    }
  }
  // Canon 0.30.6: "silos are persistent above all Drying Operations pages".
  const dryingStrip = station.key === "unload_dry_space" ? await siloStripFor(c) : "";
  return html(
    c,
    s,
    station.title,
    dryingStrip +
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
        s.locale,
        ledgerPanel,
        pickBalance,
        acquireCtx,
        station.key === "trim_packages" && c.req.query("gate") === "1",
        trimCtx
      )
  );
});

app.post("/station/:key/add_truck", async (c) => {
  const station = stationByKey(c.req.param("key"));
  // Add a truck belongs to the header form; a direct ledger station has none.
  if (!station || !station.ledger || station.ledger.mode === "direct") return c.notFound();
  const form = actorForm(c, await c.req.formData());
  const result = await addTruck(c.env.DB, station.key, form);
  return c.redirect(result.redirect, 303);
});

app.post("/station/:key/lot/:lotId/weights", async (c) => {
  const station = stationByKey(c.req.param("key"));
  if (!station || !station.ledger) return c.notFound();
  const form = actorForm(c, await c.req.formData());
  const result = await addLotWeight(c.env.DB, station, c.req.param("lotId"), form);
  return c.redirect(result.redirect, 303);
});

app.post("/station/:key/lot/:lotId/session", async (c) => {
  const station = stationByKey(c.req.param("key"));
  if (!station || station.key !== "unload_dry_space") return c.notFound();
  const result = await updateUnloadSession(c.env.DB, c.req.param("lotId"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/station/:key/lot/:lotId/finish", async (c) => {
  const station = stationByKey(c.req.param("key"));
  if (!station || !station.ledger) return c.notFound();
  const form = actorForm(c, await c.req.formData());
  const result = await finishLot(c.env.DB, station, c.req.param("lotId"), form);
  return c.redirect(result.redirect, 303);
});

app.post("/station/acquire_hbn/recall", async (c) => {
  const form = actorForm(c, await c.req.formData());
  const result = await recallHarvestBatch(c.env.DB, form);
  return c.redirect(result.redirect, 303);
});

app.post("/station/:key", async (c) => {
  const station = stationByKey(c.req.param("key"));
  // Owner ruling 2026-08-31: a direct ledger station has no header create form,
  // so a station without a transition has no create route at all.
  if (!station || !station.transition) return c.notFound();
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
  const result = await runQueueControl(c.env.DB, control, form, queue.entity);
  return c.redirect(result.redirect, 303);
});

app.get("/export/:name", async (c) => {
  const name = c.req.param("name");
  if (!name.endsWith(".csv")) return c.body("Not found", 404);
  const key = name.slice(0, -4);
  const queue = queueByKey(key);
  let csv: string;
  if (key === "inventory") {
    const sheet = await loadInventorySheet(
      c.env.DB,
      nowIso(),
      await getConfigValue(c.env.DB, CONFIG_KEYS.projected_dry_yield_pct),
      await getConfigValue(c.env.DB, CONFIG_KEYS.extraction_type_codes),
      await metrcFgInventory(c.env.DB)
    );
    csv = inventorySheetCsv(sheet);
  } else if (queue) {
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

app.get("/testing", async (c) => {
  const s = await shell(c);
  const desk = await loadTestingDesk(c.env.DB);
  return html(c, s, "Testing desk", testingDeskPage(desk, s.locale));
});

app.post("/testing/schedule", async (c) => {
  const result = await scheduleTestOrder(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/testing/samples", async (c) => {
  const result = await saveTestSample(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/testing/results", async (c) => {
  const result = await saveTestResults(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/testing/manifests", async (c) => {
  const result = await createTestManifest(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/testing/manifests/:id/sent", async (c) => {
  const result = await markManifestSent(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/testing/manifests/:id/number", async (c) => {
  const result = await saveManifestNumber(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/testing/orders/:id/retest", async (c) => {
  const result = await scheduleRetest(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/testing/orders/:id/remediate", async (c) => {
  const result = await markRemediated(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/testing/manifests/:id/worksheet.csv", async (c) => {
  const built = await manifestWorksheetCsv(c.env.DB, c.req.param("id"));
  return new Response(built.body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${built.filename}"`,
    },
  });
});

app.get("/testing/manifests/:id", async (c) => {
  const s = await shell(c);
  const body = await manifestPrintPage(c.env.DB, c.req.param("id"), s.locale);
  return html(c, s, "Manifest", body);
});

app.get("/admin/lookups", async (c) => {
  const s = await shell(c);
  return html(c, s, "Lookups", lookupsLandingPage(s.locale));
});

// Fork 6 (canon 0.30.1): the Admin-buried manual HBN fallback; Acquire stays
// the default. PIN rides /admin* as everywhere.
app.get("/admin/manual-hbn", async (c) => {
  const s = await shell(c);
  const lookups = {
    farms: await listLookup(c.env.DB, "farms"),
    licenses: await listLookup(c.env.DB, "license"),
    grow_methods: await listLookup(c.env.DB, "grow_methods"),
    strains: await listLookup(c.env.DB, "strains"),
  };
  return html(c, s, "Manual HBN", manualHbnPage(lookups, s.locale, c.req.query("ok") || undefined));
});

app.post("/admin/manual-hbn", async (c) => {
  const result = await manualHbn(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/admin/lookups/:section", async (c) => {
  const section = c.req.param("section");
  const s = await shell(c);
  if (section === "testing_labs") {
    const labs = await listTestingLabs(c.env.DB);
    return html(c, s, "Testing labs", testingLabsPage(labs, s.locale));
  }
  // THE TRIM BOGEY (canon 0.30.249): one whole percent, the plume's product line.
  if (section === "trim_bogey") {
    const raw = await getConfigValue(c.env.DB, CONFIG_KEYS.trim_bogey_pct);
    return html(c, s, "Trim Bogey", trimBogeyPage(parseTrimBogey(raw), trimBogeyOf(raw) != null, s.locale, c.req.query("ok") || undefined));
  }
  if (section === "silo_check_intervals") {
    return html(c, s, "Internal Silo Testing Interval", await intervalPage(c.env.DB, s.locale));
  }
  if (section === "plant_count") {
    const today = await farmToday(c.env.DB, nowIso());
    const year = plantCountYear(c.req.query("year"), today);
    const farms = await c.env.DB.prepare(`SELECT code, display_name FROM farms WHERE deleted_at IS NULL ORDER BY code`).all<{ code: string; display_name: string }>();
    const counts = await c.env.DB
      .prepare(`SELECT farm_code, plant_count FROM farm_plant_counts WHERE harvest_year = ? AND deleted_at IS NULL`)
      .bind(Number(year))
      .all<{ farm_code: string; plant_count: number }>();
    const byFarm = new Map((counts.results ?? []).map((row) => [row.farm_code, Number(row.plant_count)]));
    const rows = (farms.results ?? []).map((farm) => ({ code: farm.code, name: farm.display_name, count: byFarm.has(farm.code) ? byFarm.get(farm.code)! : null }));
    return html(c, s, "Farm Plant Count", plantCountPage(year, rows, s.locale, c.req.query("ok") || undefined));
  }
  const tables = {
    people: await listAdminRows(c.env.DB, "people"),
    farms: await listAdminRows(c.env.DB, "farms"),
    grow_methods: await listAdminRows(c.env.DB, "grow_methods"),
    strains: await listAdminRows(c.env.DB, "strains"),
    dry_spaces: await listAdminRows(c.env.DB, "dry_spaces"),
    package_types: await listAdminRows(c.env.DB, "package_types"),
    app_config: await listAdminRows(c.env.DB, "app_config"),
  };
  const valueSection = LOOKUP_VALUE_SECTIONS[section];
  const lookupRows = valueSection ? await listLookupValueRows(c.env.DB, valueSection.category) : [];
  return html(c, s, "Lookups", lookupSectionPage(section, tables, lookupRows, s.locale));
});

app.post("/admin/lookups/:table", async (c) => {
  const table = c.req.param("table");
  const form = actorForm(c, await c.req.formData());
  const action = String(form.get("action") ?? "add");
  let result;
  if (table === "testing_labs") result = await saveTestingLab(c.env.DB, form);
  else if (table === "trim_bogey") result = await saveTrimBogey(c.env.DB, form);
  else if (table === "plant_count") result = await saveFarmPlantCounts(c.env.DB, form);
  else if (table === "silo_check_intervals") result = await saveSiloCheckInterval(c.env.DB, form);
  else if (table === "people" && action === "deactivate") result = await deactivatePerson(c.env.DB, form);
  else if (table === "people") result = await addPerson(c.env.DB, form);
  else if (table === "strains") result = await addStrain(c.env.DB, form);
  else if (table === "dry_spaces") result = await addDrySpace(c.env.DB, form);
  else if (table === "package_types") result = await addPackageType(c.env.DB, form);
  else if (table === "grow_methods") result = await addGrowMethod(c.env.DB, form);
  else if (LOOKUP_VALUE_SECTIONS[table]) {
    result = await addLookupValue(c.env.DB, LOOKUP_VALUE_SECTIONS[table].category, form);
  } else throw new HttpError(404, "Unknown lookup.");
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
    silo_number: await listLookup(c.env.DB, "silo_number"),
    license: await listLookup(c.env.DB, "license"),
    inventory_location: await listLookup(c.env.DB, "inventory_location"),
    sign_off_name: await listLookup(c.env.DB, "sign_off_name"),
    // THE HBN THAT CAME BACK (canon 0.30.84): the lot pencil's HBN options, read only for a lot.
    harvest_batches: table === "wet_weight_entries" || table === "wet_weights" ? await listLookup(c.env.DB, "harvest_batches") : [],
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
    const text = refusalText(s.locale, err);
    s.flash = { kind: "err", text };
    return html(c, s, "Error", errorBody(text), err.status);
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
async function loadFgMenu(c: AppContext) {
  try {
    const asset = await c.env.ASSETS.fetch(new Request(new URL("/saleshelper/menu.json", c.req.url)));
    if (!asset.ok) return null;
    return parseFgMenu(await asset.text());
  } catch {
    return null;
  }
}

/** Canon 0.30.27: a vendored single-file HTML app streamed from public/, the
 * file on disk untouched, no-store so a replaced file lands on the next load.
 * Canon 0.30.30: an optional serve-time decorator (the Harvest Console's
 * inverted Continuum skin) transforms the SERVED string only, the SalesHelper
 * skin's precedent; without one the bytes stream raw. */
async function vendoredHtml(
  c: AppContext,
  path: string,
  decorate: (html: string) => string = (html) => html
) {
  const asset = await c.env.ASSETS.fetch(new Request(new URL(path, c.req.url)));
  if (!asset.ok) return c.notFound();
  return new Response(decorate(await asset.text()), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** THE MODELS BUTTON (canon 0.30.86): a vendored app's data file streamed from
 * public/ through the ASSETS binding with its own content type, no-store so a
 * replaced file lands on the next load; the gate stays in front. */
async function vendoredAsset(c: AppContext, path: string) {
  const asset = await c.env.ASSETS.fetch(new Request(new URL(path, c.req.url)));
  if (!asset.ok) return c.notFound();
  const type = asset.headers.get("content-type") ?? "application/octet-stream";
  return new Response(asset.body, {
    headers: { "content-type": type, "cache-control": "no-store" },
  });
}

/** Owner ruling 2026-09-01: serve the vendored SalesHelper form with the
 * serve-time theme injection. Runtime decoration only: under cerberus (a stored
 * pick; an absent cookie is co since canon 0.30.28) one style block splices in before
 * the closing head tag of the SERVED string; lite streams the bytes raw, and
 * co does too now that it has its own look (owner dispatch 2026-09-02: the
 * vendored form's plain light styling sits naturally in the Continuum paper
 * world, and the Cerberus skin no longer represents the co view). The vendored
 * file never changes on disk (its sha256 stands) and the owner expects visual
 * touch-up. The splice uses a replacer callback so no dollar pattern in the
 * skin could ever expand. */
async function salesHelperApp(c: AppContext) {
  const asset = await c.env.ASSETS.fetch(
    new Request(new URL("/saleshelper/index.html", c.req.url))
  );
  if (!asset.ok) return c.notFound();
  const view = asView(getCookie(c, VIEW_COOKIE));
  let page = await asset.text();
  if (view === "cerberus") {
    page = page.replace("</head>", () => `${salesHelperCerberusSkin()}</head>`);
  }
  // THE SALESHELPER HEADER (canon 0.30.47, every view): the pill hidden, the
  // date rolled to the newest Zoho mount, the [Update] link beside it.
  const mounts = await listZohoMounts(c.env.DB, 1);
  page = decorateSalesHelperPage(page, mounts[0] ?? null);
  return new Response(page, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** THE SALESHELPER LIVE MENU (canon 0.30.47): the static base re-lined from
 * the newest Zoho mount's listed items; the static itself when no mount
 * exists or the base is not a canonical menu. */
async function salesHelperMenu(c: AppContext) {
  const asset = await c.env.ASSETS.fetch(new Request(new URL("/saleshelper/menu.json", c.req.url)));
  if (!asset.ok) return c.notFound();
  const base = await asset.text();
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  const mounts = await listZohoMounts(c.env.DB, 1);
  if (mounts.length === 0) return new Response(base, { headers });
  const items = await listZohoMenuItems(c.env.DB);
  const live = buildLiveSalesHelperMenu(base, items, mounts[0]);
  return new Response(live ? live.text : base, { headers: { ...headers, "x-gf-menu": live ? "zoho-mount" : "static" } });
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
    if (field.input === "queue_pick") keys.add(field.queue);
  }
  if (station.leftPane) keys.add(station.leftPane.queue);
  const out: Record<string, Awaited<ReturnType<typeof listQueueRows>>> = {};
  for (const key of keys) {
    const q = queueByKey(key);
    if (q) out[key] = await listQueueRows(db, q);
  }
  return out;
}

function reportQuery(params: URLSearchParams): string {
  const next = new URLSearchParams(params);
  next.delete("format");
  return next.toString();
}

function reportFilterForm(key: string, params: URLSearchParams, locale: Locale): string {
  // THE HARVEST CONSOLE (canon 0.30.73; owner: "Let's strike the dashboard.
  // Remove it from the report list."): the Harvest Dashboard's form is gone;
  // its laws live on the console at /harvest.
  if (key === "inventory") {
    return `<label class="field">${t(locale, "Kind")} <input type="text" name="item_kind" value="${escQuery(params.get("item_kind"))}"></label>
      <label class="field">${t(locale, "Farm")} <input type="text" name="farm" value="${escQuery(params.get("farm"))}"></label>
      <label class="field">${t(locale, "Location")} <input type="text" name="location" value="${escQuery(params.get("location"))}"></label>
      <label class="field">${t(locale, "Strain")} <input type="text" name="strain" value="${escQuery(params.get("strain"))}"></label>`;
  }
  if (key === "sales_orders") {
    return `<label class="field">${t(locale, "Period")} <input type="text" name="period" value="${escQuery(params.get("period"))}"></label>`;
  }
  if (key === "tats") {
    const metricOpts = TAT_METRICS.map(
      (m) =>
        `<option value="${m.key}"${params.get("metric") === m.key ? " selected" : ""}>${m.label}</option>`
    ).join("");
    const lineOpts = TAT_LINES.map(
      (l) => `<option value="${l}"${params.get("line") === l ? " selected" : ""}>${l}</option>`
    ).join("");
    return `<label class="field">${t(locale, "Metric")} <select name="metric">${metricOpts}</select></label>
      <label class="field">${t(locale, "Line")} <select name="line">${lineOpts}</select></label>
      <label class="field">${t(locale, "Year")} <input type="text" name="year" value="${escQuery(params.get("year"))}"></label>
      <label class="field">From <input type="date" name="from" value="${escQuery(params.get("from"))}"></label>
      <label class="field">To <input type="date" name="to" value="${escQuery(params.get("to"))}"></label>`;
  }
  if (key === "harvests") {
    return `<label class="field">${t(locale, "Farm")} <input type="text" name="farm" value="${escQuery(params.get("farm"))}"></label>`;
  }
  if (key === "product_mix") {
    const year = params.get("year") ?? String(new Date().getUTCFullYear());
    return `<label class="field">${t(locale, "Year")} <input type="text" name="year" value="${escQuery(year)}"></label>`;
  }
  if (key === "external_audits") {
    return `<label class="field">${t(locale, "Agency")} <input type="text" name="agency" value="${escQuery(params.get("agency"))}"></label>
      <label class="field">${t(locale, "From")} <input type="date" name="from" value="${escQuery(params.get("from"))}"></label>
      <label class="field">${t(locale, "To")} <input type="date" name="to" value="${escQuery(params.get("to"))}"></label>`;
  }
  if (key === "labor_hours") {
    return `<label class="field">${t(locale, "From")} <input type="date" name="from" value="${escQuery(params.get("from"))}"></label>
      <label class="field">${t(locale, "To")} <input type="date" name="to" value="${escQuery(params.get("to"))}"></label>`;
  }
  if (key === "internal_testing") {
    return `<label class="field">${t(locale, "Year")} <input type="text" name="year" value="${escQuery(params.get("year"))}"></label>
      <label class="field">${t(locale, "Strain")} <input type="text" name="strain" value="${escQuery(params.get("strain"))}"></label>`;
  }
  return "";
}

function escQuery(value: string | null): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function buildReportView(
  db: D1Database,
  key: string,
  params: URLSearchParams
): Promise<ReportView> {
  if (key === "inventory_by_location") {
    return inventoryByLocationView(await listInventoryByLocation(db));
  }
  if (key === "inventory") {
    const rows = await listLocalInventory(db, {
      item_kind: params.get("item_kind") || undefined,
      farm: params.get("farm") || undefined,
      location: params.get("location") || undefined,
      strain: params.get("strain") || undefined,
    });
    return inventoryReportView(rows, rows.some((r) => r.item_kind === "FG"));
  }
  if (key === "sales_orders") {
    const orders = await listSalesOrders(db);
    const withQty = [];
    for (const o of orders) {
      const lines = await listSoLines(db, String(o.id));
      const qty = lines.reduce((s, l) => s + Number(l.qty_grams ?? 0), 0);
      withQty.push({
        so_number: String(o.so_number),
        buyer: String(o.buyer),
        status: String(o.status),
        created_at: String(o.created_at),
        lines_label: o.lines_label == null ? "" : String(o.lines_label),
        qty_grams: qty,
      });
    }
    return salesOrdersView(salesOrderReportRows(withQty));
  }
  if (key === "external_audits") {
    const audits = await listFinishedExternalAudits(db, {
      agency: params.get("agency") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
    });
    const rows = [];
    for (const a of audits) {
      const notes = await listAuditNotes(db, String(a.id));
      rows.push({
        agency: a.agency == null ? null : String(a.agency),
        agency_contact: a.agency_contact == null ? null : String(a.agency_contact),
        grip_rep: a.grip_rep == null ? null : String(a.grip_rep),
        started_at: String(a.started_at),
        finished_at: a.finished_at == null ? null : String(a.finished_at),
        note_count: Number(a.note_count ?? notes.length),
        notes: notes.map((n) => String(n.body)).join(" | "),
      });
    }
    return externalAuditsView(rows);
  }
  if (key === "rf") return rfReportView();
  if (key === "labor_hours") {
    return laborHoursView(await listLaborHours(db, params.get("from") ?? "", params.get("to") ?? ""));
  }
  if (key === "internal_testing") {
    const raw = await listInternalTestingReport(db, {
      year: params.get("year") || undefined,
      strain: params.get("strain") || undefined,
    });
    return internalTestingView(
      collapseInternalTesting(
        raw.map((r) => ({
          hbn: r.hbn == null ? null : String(r.hbn),
          source: String(r.source),
          analyte: String(r.analyte),
          value: Number(r.value),
          tested_at: String(r.tested_at),
          created_at: String(r.created_at),
          entry_date: r.entry_date == null ? null : String(r.entry_date),
          strain_name: r.strain_name == null ? null : String(r.strain_name),
        }))
      )
    );
  }
  if (key === "tats") {
    const metric = (params.get("metric") ?? "field_to_wet") as TatMetricKey;
    const line = (TAT_LINES as readonly string[]).includes(params.get("line") ?? "")
      ? (params.get("line") as TatLine)
      : "farm";
    const year = params.get("year") ? Number(params.get("year")) : undefined;
    const logs = await listTatStatusLogs(db);
    const groups = computeTatGroups(logs, metric, line, {
      year,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    });
    return tatsView(aggregateTatDays(groups));
  }
  if (key === "harvests") {
    return harvestsView(await listHarvestsByYear(db, params.get("farm") || undefined));
  }
  const year = Number(params.get("year") ?? new Date().getUTCFullYear());
  return productMixView(await listProductMix(db, year), year);
}

app.get("/compliance", async (c) => {
  const s = await shell(c);
  return html(c, s, "Compliance Console", complianceMenuPage(await loadComplianceKpis(c.env.DB), s.locale));
});

app.get("/compliance/audits", async (c) => {
  const kind = c.req.query("kind") === "external" ? "external" : "internal";
  const auditId = c.req.query("audit") ?? "";
  const open = (await listAudits(c.env.DB, kind, false)) as AuditRow[];
  const finished = (await listAudits(c.env.DB, kind, true)) as AuditRow[];
  let picked = open.find((a) => a.id === auditId) ?? null;
  if (!picked && auditId) {
    const row = await getRow(c.env.DB, "audits", auditId);
    if (row && !row.deleted_at && !row.finished_at) picked = row as AuditRow;
  }
  const notes = picked ? ((await listAuditNotes(c.env.DB, picked.id)) as AuditNoteRow[]) : [];
  const s = await shell(c);
  return html(
    c,
    s,
    "Audits",
    auditsPage(kind, open, finished, picked, notes, c.get("actor").display_name, c.req.query("rapid") === "1", s.locale)
  );
});

app.post("/compliance/audits/start", async (c) => {
  const result = await startAudit(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/compliance/audits/:id/header", async (c) => {
  const result = await saveAuditHeader(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/compliance/audits/:id/notes", async (c) => {
  const result = await addAuditNote(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/compliance/audits/:id/finish", async (c) => {
  const result = await finishAudit(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/compliance/labels", async (c) => {
  const s = await shell(c);
  const templates = (await listLabelTemplates(c.env.DB)) as LabelTemplateRow[];
  const rawPkgs = await listLabelPackages(c.env.DB);
  const packages: LabelPackage[] = [];
  for (const row of rawPkgs) {
    const tag = String(row.tag ?? "");
    if (!tag) continue;
    packages.push({
      id: String(row.id),
      tag,
      item_or_strain: String(row.item_or_strain ?? ""),
      potency: await latestFinalizedPotency(c.env.DB, tag),
      net_weight_grams: row.net_weight_grams == null ? null : Number(row.net_weight_grams),
      packaged_date: String(row.packaged_date ?? "").slice(0, 10),
      license_number: String(row.license_number ?? ""),
      facility_name: String(row.facility_name ?? ""),
    });
  }
  return html(
    c,
    s,
    "Labels",
    labelsPage(
      templates,
      packages,
      await listLookupValues(c.env.DB, "label_stock"),
      await listLookupValues(c.env.DB, "label_printer"),
      s.locale
    )
  );
});

app.post("/compliance/labels/templates", async (c) => {
  const result = await saveLabelTemplate(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/compliance/labels/print", async (c) => {
  const templateId = c.req.query("template") ?? "";
  const packageId = c.req.query("package") ?? "";
  const template = await getRow(c.env.DB, "label_templates", templateId);
  if (!template || template.deleted_at) return c.notFound();
  const pkgs = await listLabelPackages(c.env.DB);
  const raw = pkgs.find((p) => String(p.id) === packageId);
  if (!raw) return c.notFound();
  const tag = String(raw.tag ?? "");
  const s = await shell(c);
  const htmlPage = labelPrintHtml(
    {
      id: String(template.id),
      name: String(template.name),
      width_mm: Number(template.width_mm),
      height_mm: Number(template.height_mm),
      fields_json: String(template.fields_json),
    },
    {
      id: String(raw.id),
      tag,
      item_or_strain: String(raw.item_or_strain ?? ""),
      potency: await latestFinalizedPotency(c.env.DB, tag),
      net_weight_grams: raw.net_weight_grams == null ? null : Number(raw.net_weight_grams),
      packaged_date: String(raw.packaged_date ?? "").slice(0, 10),
      license_number: String(raw.license_number ?? ""),
      facility_name: String(raw.facility_name ?? ""),
    },
    s.locale
  );
  return c.html(htmlPage, { headers: { "cache-control": "no-store" } });
});

app.get("/compliance/testing", async (c) => {
  const tab = c.req.query("tab") === "internal" ? "internal" : "external";
  const s = await shell(c);
  const rows = (await listExternalTests(c.env.DB, {
    facility: c.req.query("facility") || undefined,
    status: c.req.query("status") || undefined,
    year: c.req.query("year") || undefined,
  })) as ExternalTestRow[];
  const labs = await listLookupValues(c.env.DB, "testing_lab");
  const parseFlash =
    c.req.query("ok") === "parsed"
      ? `${t(s.locale, "Parsed")} ${c.req.query("parsed") ?? "0"}, ${t(s.locale, "skipped")} ${c.req.query("skipped") ?? "0"}.`
      : undefined;
  return html(
    c,
    s,
    "Compliance Testing",
    testingPage(
      tab,
      rows,
      labs,
      { facility: c.req.query("facility") ?? "", status: c.req.query("status") ?? "", year: c.req.query("year") ?? "" },
      s.locale,
      parseFlash
    )
  );
});

app.post("/compliance/testing/internal", async (c) => {
  const result = await queueInstrumentImport(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/compliance/testing/external", async (c) => {
  const result = await saveExternalResult(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/purchasing", async (c) => {
  const tabRaw = c.req.query("tab") ?? "all";
  const tab = tabRaw === "open" || tabRaw === "draft" || tabRaw === "closed" ? tabRaw : "all";
  const s = await shell(c);
  const rows = (await listPurchaseOrders(c.env.DB, tab)) as unknown as PoListRow[];
  return html(c, s, "Purchasing", purchasingListPage(tab, rows, s.locale));
});

app.get("/purchasing/new", async (c) => {
  const s = await shell(c);
  const suppliers = (await listSuppliers(c.env.DB)) as Array<{ id: string; company_name: string }>;
  const farms = await listLookup(c.env.DB, "farms");
  return html(c, s, "Create purchase order", newPurchaseOrderPage(suppliers, farms, s.locale));
});

app.post("/purchasing/new", async (c) => {
  const result = await createPurchaseOrder(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/purchasing/suppliers", async (c) => {
  const s = await shell(c);
  return html(c, s, "Suppliers", suppliersPage((await listSuppliers(c.env.DB)) as unknown as SupplierRow[], s.locale));
});

app.post("/purchasing/suppliers", async (c) => {
  const result = await addSupplier(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/purchasing/suppliers/:id/deactivate", async (c) => {
  const result = await deactivateSupplier(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/purchasing/requisitions", async (c) => {
  const s = await shell(c);
  return html(c, s, "Requisitions", purchasingReservedPage("Requisitions", s.locale));
});
app.get("/purchasing/deliveries", async (c) => {
  const s = await shell(c);
  return html(c, s, "Deliveries", purchasingReservedPage("Deliveries", s.locale));
});
app.get("/purchasing/invoices", async (c) => {
  const s = await shell(c);
  return html(c, s, "Invoices", purchasingReservedPage("Invoices", s.locale));
});

app.get("/purchasing/po/:id", async (c) => {
  const po = await getPurchaseOrder(c.env.DB, c.req.param("id"));
  if (!po) return c.notFound();
  const lines = (await listPoLines(c.env.DB, String(po.id))) as unknown as PoLineRow[];
  const activity = (await listChangeLogForRecord(c.env.DB, "purchase_orders", String(po.id))) as unknown as ChangeLogRow[];
  const s = await shell(c);
  return html(
    c,
    s,
    String(po.po_number),
    purchaseOrderPage(po as unknown as PoRecord, lines, activity, c.req.query("rapid") === "1", s.locale)
  );
});

app.get("/purchasing/po/:id/print", async (c) => {
  const po = await getPurchaseOrder(c.env.DB, c.req.param("id"));
  if (!po) return c.notFound();
  const lines = (await listPoLines(c.env.DB, String(po.id))) as unknown as PoLineRow[];
  const s = await shell(c);
  return c.html(purchaseOrderPrintHtml(po as unknown as PoRecord, lines, s.locale), {
    headers: { "cache-control": "no-store" },
  });
});

app.post("/purchasing/po/:id/lines", async (c) => {
  const result = await addPoLine(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post("/purchasing/po/:id/issue", async (c) => {
  const result = await issuePurchaseOrder(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post("/purchasing/po/:id/close", async (c) => {
  const result = await closePurchaseOrder(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post("/purchasing/po/:id/cancel", async (c) => {
  const result = await cancelPurchaseOrder(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post("/purchasing/po/:id/eval", async (c) => {
  const result = await savePoEval(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.get("/marketplace", async (c) => {
  const pane: MarketplacePane = parseMarketplacePane(c.req.query("pane"));
  const s = await shell(c);
  const qtyByTag = await inventoryQtyByTag(c.env.DB);
  const itemsById = await inventoryItemsById(c.env.DB);
  const listings = listingsWithMatch((await listListings(c.env.DB)) as unknown as ListingRow[], {
    qtyByTag,
    itemsById,
  });
  const orders = (await listSalesOrders(c.env.DB)) as unknown as SalesOrderRow[];
  const local = await listLocalInventory(c.env.DB);
  const itemOptions = local
    .filter((r) => r.item_kind === ITEM_KIND_FG || r.item_kind === ITEM_KIND_WIP)
    .map((r) => ({
      id: r.id,
      name: r.strain_name ?? r.package_code,
      qty: r.qty,
      kind: r.item_kind,
      parent_item_id: r.parent_item_id ?? null,
    }));
  const categories = (await listLookupValues(c.env.DB, "listing_category")).map((row) => ({
    value: row.value,
    label: row.label,
  }));
  const menu = await loadFgMenu(c);
  const menuNames = menu ? menu.types.flatMap((tp) => tp.items.map((it) => it.name)) : [];
  const splitId = c.req.query("split") ?? "";
  const splitItem = splitId ? local.find((r) => r.id === splitId) : undefined;
  const splitParent = splitItem
    ? {
        id: splitItem.id,
        name: splitItem.strain_name ?? splitItem.package_code,
        package_code: splitItem.package_code,
        qty: splitItem.qty,
      }
    : null;
  const splitChildren = splitParent ? await listSplitChildren(c.env.DB, splitParent.id) : [];
  // Canon 0.30.36: the Zoho pane's mounts and the mount flash.
  const zohoMounts = pane === "zoho" ? await listZohoMounts(c.env.DB) : [];
  const okQ = c.req.query("ok") ?? undefined;
  const mounted =
    okQ === "mounted"
      ? {
          added: Number(c.req.query("added") ?? 0) || 0,
          updated: Number(c.req.query("updated") ?? 0) || 0,
          unlisted: Number(c.req.query("unlisted") ?? 0) || 0,
        }
      : undefined;
  return html(
    c,
    s,
    "Marketplace",
    marketplacePage(pane, listings, orders, itemOptions, listings, menuNames, s.locale, {
      categories,
      splitParent,
      splitChildren,
      fromSplitChild: c.req.query("from_split_child") === "1",
      zohoMounts,
      ok: okQ,
      mounted,
    })
  );
});

// Canon 0.30.36 (owner, 2026-09-09: a place to "drop current Zoho inventory and
// it will update the offerings on the marketplace"): the Zoho Inventory Items
// export mounts here. Behind the marketplace PIN like the rest of the node.
app.post("/marketplace/zoho", async (c) => {
  const result = await mountZohoInventory(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

app.post("/marketplace/listings", async (c) => {
  const result = await addListing(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post("/marketplace/split", async (c) => {
  const result = await splitPackage(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post("/marketplace/listings/:id/listed", async (c) => {
  const result = await toggleListing(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.post("/marketplace/orders", async (c) => {
  const result = await createSalesOrder(c.env.DB, actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});
app.get("/marketplace/orders/:id", async (c) => {
  const row = await getRow(c.env.DB, "sales_orders", c.req.param("id"));
  if (!row || row.deleted_at) return c.notFound();
  const lines = await listSoLines(c.env.DB, String(row.id));
  const s = await shell(c);
  return html(
    c,
    s,
    String(row.so_number),
    salesOrderPage(
      {
        id: String(row.id),
        so_number: String(row.so_number),
        buyer: String(row.buyer),
        status: String(row.status),
        created_at: String(row.created_at),
        lines_label: "",
      },
      lines.map((l) => ({
        item_name: String(l.item_name ?? ""),
        package_tag: l.package_tag == null ? null : String(l.package_tag),
        package_label: l.package_label == null ? null : String(l.package_label),
        category: l.category == null ? null : String(l.category),
        qty_grams: Number(l.qty_grams),
      })),
      s.locale
    )
  );
});
app.post("/marketplace/orders/:id/status", async (c) => {
  const result = await stepSalesOrder(c.env.DB, c.req.param("id"), actorForm(c, await c.req.formData()));
  return c.redirect(result.redirect, 303);
});

// THE SHEET SYNC (canon 0.30.162): the cron is not a request. THE SERVICE ACTOR
// (canon 0.30.140) is untouched. The handler registers the run with waitUntil
// and awaits it, so a dev trigger's response means the run has finished.
function scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  const cron = String(event.cron ?? "");
  const run = cron.startsWith("*/5")
    ? pullSensorPush(env).then(() => undefined)
    : (async () => {
        await runSheetSync(env, "cron");
        await runMetrcSweep(env, "cron");
        await runInTestingSync(env, "cron");
      })();
  ctx.waitUntil(run);
  return run;
}

const worker = { fetch: app.fetch, scheduled };
export { app };
export default worker;
