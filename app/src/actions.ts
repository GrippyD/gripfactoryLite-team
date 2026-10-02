import {
  applyTransition,
  demoteStep,
  finishTransitionName,
  formatGrams,
  GRAM_FIELDS,
  HARVEST_BORN,
  HARVEST_STATUS,
  initialWipStatus,
  isTime24,
  isTestOutcome,
  ITEM_KIND_WIP,
  CONFIG_KEYS,
  deriveDestinationLocation,
  growLicenseForFarm,
  lotSerialFloor,
  inheritedLotLicense,
  isExternalLicense,
  isInternalCsaToCsb,
  LICENSE_AU_GROW,
  LICENSE_AU_PROCESSOR,
  LOC_BARN,
  LOC_CSB,
  LOC_IN_TRANSIT,
  barnLocationForSite,
  siloSiteOf,
  isProcessorSideLocation,
  licenseForSiteArrival,
  materialAtNorth,
  ORIGIN_PAIR_ERROR,
  siteOfLicense,
  treeLicenseForPackage,
  LOT_STATUS,
  START_LOT_REPEAT_WINDOW_SECONDS,
  metrcFacingTag,
  nextTruckNumber,
  normalizeMetrcTag,
  PRODUCTION_SCHEDULING_PATH,
  roundGrams,
  inheritMarketStrain,
  shortLotId,
  INTERNAL_LOGISTICS_PATH,
  INTERNAL_LOGISTICS_STAGE,
  FIELD_LOAD_STATUS,
  TERP_RECIPE_STATUS,
  SCHEDULE_STAGES,
  SCHEDULE_STATUS,
  sumGrams,
  SYSTEM_REASON,
  TRUCK_DRY_SPACE_ID,
  isMaterialForm,
  siloSequenceNumber,
  type MaterialForm,
  METRC_UPLOAD_KINDS,
  LANDING_FARM,
  LOC_CRYO_ROOM,
  WIP_SOURCE,
  drawsFromParentLot,
  WIP_STATUS,
  isMetrcTag,
  DRYING_STAGE_SPACE_TYPE,
  dryingReturnPath,
  dryingStagePath,
  type DryingStage,
  type MetrcUploadKind,
  type ScheduleStage,
  type TransitionName,
} from "./config";
import { CRYO_REFUSAL, CRYO_STATION_PATH, allocateIngredients, newPackagesSheet, type NewPackagesLine } from "./cryo";
import { buildXlsx } from "./xlsx";
import {
  MOVEMENT_KIND,
  MOVEMENT_STATUS,
  movementVoidBlock,
  MANIFEST_COLUMNS,
  displayManifestNumber,
  manifestCsv,
  manifestFilename,
  movementIdShort,
  packageFinishCsv,
  receiveCsv,
  receiveFilename,
  finishFilename,
  locationChangeCsv,
  locationChangeFilename,
  yyyymmddFromIso,
  destinationLicenseForLane,
  farmToSite,
  laneById,
  originLicenseForLane,
  parseIntercoSite,
  siteFarmCode,
  wetTruckDestSite,
  type IntercoSite,
  type T3ManifestHeader,
} from "./interco";
import { MANIFEST_PATH, MANIFEST_REFUSAL, manifestCsvPath, parseFinishForm, headerFromMovement } from "./manifest";
import { listMetrcAdoptions, listMetrcPackagesByTags } from "./metrc";
import {
  jointUnloadShares,
  lotPackageCode,
  planFinishMint,
  planUnloadFinish,
  receiveMintKind,
  virtualMoveLanding,
  buckedPackageCode,
  type MintPlan,
  type UnloadFinishPlan,
} from "./ledger";
import { isReconcileChoice, reconcileGate, type ReconcileGate } from "./reconcile";
import { packageAdjustmentsCsv, packagesFromHarvestsCsv, parseCsv } from "./csv";
import { packageSplitCsv, splitFilename } from "./marketplace";
import { recallPrefillFromBatch, recallRedirectPath, type RecallableBatch } from "./inventory";
import { hbnWithSeq, wetWeightsFilename } from "./csv";
import { backRedirect, HttpError, nowIso, parseGrams, parsePlantCount, refusal, requireReason, requireText, textOrNull } from "./audit";
import { EFFECTIVE_DATE_FIELD, EFFECTIVE_DATE_REASON, effectiveOverrideLog, farmDayStartHour, farmToday, resolveEffectiveDate } from "./effective";
import { FARM_DAY_START_HOUR_DEFAULT, farmDay, farmInstant, farmInstantFromInput, wallClock24From12 } from "./farmday";
import { capacityUomOf, drySpaceTypeOf, spaceHoldsOneLot, trimBogeyOf, DRY_SPACE_TYPES, CAPACITY_UOMS } from "./config";
import { assertHbnAvailable, formatLotToken, harvestYearFromEntryDate, hbnFromMetrcName, HbnCollisionError, mintHbn, nextLotSerial } from "./mint";
import { RAD_RUN_STATUS } from "./config";
import { newestRadGrey } from "./db";
import { isRadGrey, RAD_OPERATION_PATH, RAD_RUN_LIMIT, RAD_SCHEDULE_PATH, radAdoptSource, requireRadAvailable } from "./rad";
import {
  assertTable,
  countLotWeights,
  findOpenScheduleForLot,
  findPrepackAvailable,
  getScheduleRow,
  listAvailableScheduleItemsForHbn,
  listCryoFreeContainers,
  getCryoRun,
  listCryoRunInputs,
  listCryoRunOutputs,
  getCryoTypeCategories,
  listCryoCategories,
  listHbnHarvestPackages,
  listPendingNewPackagesUploads,
  newPackagesFilename,
  getConfigValue,
  getHarvestByHbn,
  getBuckedChildForLot,
  getInventoryItemForLot,
  getActiveBuildingMovement,
  listBarnWetLots,
  listLotParts,
  listOpenLogisticsSchedules,
  getMountedOrder,
  getMovement,
  getOpenSiloLoadForLot,
  getOpenSiloLoadForSilo,
  getOpenUnloadSession,
  getReceipt,
  HARVEST_FILE_SEQ_SQL,
  getHarvestLoad,
  getRow,
  getSiloLoad,
  insertLog,
  listBatchTruckNumbers,
  listOpenFarmHbns,
  listFieldHbns,
  listFieldDestinations,
  defaultTerpRecipeForBatch,
  fieldHoldingSpaceId,
  listSiloSequence,
  siloSpaceOfNumber,
  getFieldLoad,
  listFieldLoadTotes,
  listOpenSiloLoadsInSpace,
  listLookupValues,
  listManifestedTags,
  personIdByPhone,
  listMountedLinesAll,
  listMountedOrderLines,
  listMountedOrdersAll,
  listMovementItems,
  logsForInsert,
  listSplitChildren,
  lotTotalRecomputeStmt,
  lookupValueReferenced,
  requireActor,
  sumLotPackageGrams,
  listPendingUploads,
  listPendingPackageUploads,
  listPendingReceiveUploads,
  listPendingManifestUploads,
  listPendingSplitUploads,
  listPendingLocationChangeUploads,
  type MountedLineRow,
  type MountedOrderRow,
} from "./db";
import { listPendingLocationMoves, locationMoveCsv } from "./locations";
import { buildPrepackFinishCsv, buildPrepackNewPackages } from "./prepack";
import { buildTestSampleCsv, listPendingTestSamples } from "./testing";
import { isZohoSalesOrderExport, looksLikeZohoFilename, parseZohoSalesOrders, type ParsedLine, type ParsedOrder } from "./fulfillment";
import { assertImportUpload, importBasename, IMPORT_STATUS } from "./imports";
import { applyInTestingBytes, lotByHbn } from "./intesting";
import { landSheetWorkbook } from "./sheetsync";
import { EDITABLE_FIELDS, ledgerByTable, queues, type LedgerDef, type StationDef } from "./pipeline";
import { SCHEDULE_REFUSAL } from "./scheduling";
import { oneLoadPerLot } from "./drying";
import { normalizePhone, PHONE_REFUSAL } from "./identity";

export type ActionOk = { redirect: string };

function personIdFrom(form: FormData): string | null {
  return textOrNull(form.get("person_id"));
}

function checkbox01(form: FormData, name: string): number {
  const v = form.get(name);
  return v === "1" || v === "on" ? 1 : 0;
}

function optionalTime24(raw: string | File | null, label: string): string | null {
  const value = textOrNull(raw);
  if (!value) return null;
  if (!isTime24(value)) {
    throw new HttpError(400, `${label} must be HH:MM.`);
  }
  return value;
}

/** Owner ruling 2026-09-08 (canon 0.30.12, verbatim: "Replace all the hand
 * sign offs with the names "Kieth", "Les", or "Austin"."), scoped by canon
 * 0.30.21 ("that was just for the PM portion"): the Preventive Maintenance
 * signatures pick from the sign-off names in Admin lookups and refuse a value
 * off the list in words; every other operator field is hand entry. */
export async function requireSignOff(db: D1Database, raw: string | File | null, label: string): Promise<string> {
  const value = requireText(raw, label);
  const names = await listLookupValues(db, "sign_off_name");
  if (!names.some((n) => n.value === value)) {
    throw new HttpError(400, `${label} must be one of the sign-off names.`);
  }
  return value;
}

/** The optional form of requireSignOff: blank stays blank. */
export async function optionalSignOff(db: D1Database, raw: string | File | null, label: string): Promise<string | null> {
  if (!textOrNull(raw)) return null;
  return requireSignOff(db, raw, label);
}

function nextStatus(name: TransitionName, status: string): string {
  try {
    return applyTransition(name, status);
  } catch (err) {
    throw new HttpError(409, err instanceof Error ? err.message : "Invalid status transition.");
  }
}

export async function createHarvestBatch(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const entryDate = requireText(form.get("entry_date"), "Date");
  const farmCode = requireText(form.get("farm_code"), "Farm");
  const licenseRaw = textOrNull(form.get("license_value"));
  const licenseValue = licenseRaw || growLicenseForFarm(farmCode);
  const licenseRow = await db
    .prepare(
      `SELECT value, farm_code FROM lookup_values
       WHERE category = 'license' AND value = ? AND deleted_at IS NULL`
    )
    .bind(licenseValue)
    .first<{ value: string; farm_code: string | null }>();
  if (!licenseRow) throw new HttpError(400, "Unknown license.");
  // Gate fix 0.28.2 (builder amendment 4): HBNs mint only under farm-assigned
  // licenses (owner 0.28.1: "The license list should be in Admin lookups with
  // their farms, and they should be selected during HBN minting"). Unassigned
  // rows (the 0020 GR-C trio) stay pickable as destinations, never at Acquire.
  if (!licenseRow.farm_code) {
    throw new HttpError(400, "That license has no farm assignment. Assign it in Admin, Licenses.");
  }
  if (licenseRow.farm_code !== farmCode) {
    throw new HttpError(400, "That license is not on this farm.");
  }
  const growMethodCode = requireText(form.get("grow_method_code"), "Grow Method");
  const strainId = requireText(form.get("strain_id"), "Strain");
  // Owner ruling 2026-09-04 (canon 0.22.0): the market strain overrides the
  // product name downstream; it never determines the HBN.
  const typedMarketStrain = textOrNull(form.get("market_strain"));
  const manicure = checkbox01(form, "manicure") as 0 | 1;
  // THE HBN ENTRY (canon 0.30.341): the HBN decides a lot's form and its space,
  // so both are required at the mint; the sixth segment is the silo number.
  const siloNumber = requirePlannedSilo(form.get("planned_dryspc"));
  const materialForm = requireMaterialForm(form.get("material_form"));
  const startTime = optionalTime24(form.get("start_time"), "Start Time (24h)");
  const zone = textOrNull(form.get("zone"));
  const rowsText = textOrNull(form.get("rows_text"));
  const metrc = textOrNull(form.get("metrc_harvest_tag"));

  const grow = await db
    .prepare(`SELECT hbn_code FROM grow_methods WHERE code = ? AND deleted_at IS NULL`)
    .bind(growMethodCode)
    .first<{ hbn_code: string }>();
  if (!grow) throw new HttpError(400, "Unknown grow method.");
  const strain = await db
    .prepare(`SELECT hbn_code, name FROM strains WHERE id = ? AND deleted_at IS NULL`)
    .bind(strainId)
    .first<{ hbn_code: string; name: string }>();
  if (!strain) throw new HttpError(400, "Unknown strain.");
  // Owner ruling 2026-09-08 (canon 0.30.9, verbatim: "Null Market Strains
  // should automatically inherit the real strain"): a blank market strain is
  // the strain's own name, stored on the batch; 0036 backfilled the blanks.
  const marketStrain = inheritMarketStrain(typedMarketStrain, strain.name);

  const harvestYear = harvestYearFromEntryDate(entryDate);
  // Owner ruling 2026-09-14 (canon 0.30.55): the year's serial floor from
  // app_config first_lot_token (YY###; 26010 while the historical lots wait).
  const serialFloor = lotSerialFloor(await getConfigValue(db, CONFIG_KEYS.first_lot_token), harvestYear);
  const id = crypto.randomUUID();
  const ts = nowIso();
  const maxAttempts = 8;
  let hbn = "";
  let lotSerial = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Next serial is 1 + MAX for this harvest_year, including voided rows (no reuse),
    // never below the year's floor. Insert and log rows share one db.batch().
    // UNIQUE(harvest_year, lot_serial) plus retry stops two stations from keeping
    // the same serial.
    const maxRow = await db
      .prepare(`SELECT MAX(lot_serial) AS m FROM harvest_batches WHERE harvest_year = ?`)
      .bind(harvestYear)
      .first<{ m: number | null }>();
    lotSerial = nextLotSerial(maxRow?.m ?? null, serialFloor);
    hbn = mintHbn({
      entryDate,
      farmCode,
      growHbnCode: grow.hbn_code,
      strainHbnCode: strain.hbn_code,
      manicure,
      siloNumber,
      lotSerial,
    });
    try {
      assertHbnAvailable(await getHarvestByHbn(db, hbn), hbn);
    } catch (err) {
      if (err instanceof HbnCollisionError && attempt < maxAttempts - 1) continue;
      if (err instanceof HbnCollisionError) throw new HttpError(409, err.message);
      throw err;
    }

    const record = {
      id,
      entry_date: entryDate,
      farm_code: farmCode,
      grow_method_code: growMethodCode,
      strain_id: strainId,
      market_strain: marketStrain,
      manicure,
      planned_dryspc: siloNumber,
      material_form: materialForm,
      start_time: startTime,
      zone,
      rows_text: rowsText,
      metrc_harvest_tag: metrc,
      hbn,
      lot_serial: lotSerial,
      harvest_year: harvestYear,
      status: HARVEST_STATUS.open,
      license_value: licenseValue,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    const stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO harvest_batches (
          id, entry_date, farm_code, grow_method_code, strain_id, market_strain, manicure, planned_dryspc, material_form,
          start_time, zone, rows_text, metrc_harvest_tag, hbn, lot_serial, harvest_year, status, license_value,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(
          id,
          entryDate,
          farmCode,
          growMethodCode,
          strainId,
          marketStrain,
          manicure,
          siloNumber,
          materialForm,
          startTime,
          zone,
          rowsText,
          metrc,
          hbn,
          lotSerial,
          harvestYear,
          HARVEST_STATUS.open,
          licenseValue,
          ts,
          actor.id,
          ts,
          actor.id
        ),
      ...logsForInsert(db, "harvest_batches", id, record, actor.id, SYSTEM_REASON.create, ts),
    ];
    try {
      await db.batch(stmts);
      return { redirect: `/station/acquire_hbn?minted=${encodeURIComponent(hbn)}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("unique") && attempt < maxAttempts - 1) {
        continue;
      }
      if (message.toLowerCase().includes("unique")) {
        throw new HttpError(
          409,
          `HBN already exists: ${hbn}. The mint was not changed. Adjust the batch fields and try again.`
        );
      }
      throw err;
    }
  }
  throw new HttpError(409, `Could not allocate a lot serial for ${harvestYear}.`);
}

/** Start lot (owner ruling 2026-08-28): the header form creates the lot in status
 * weighing with a zero total; weights then collect on the lot page. */
export async function createWetWeight(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  // THE SUPERVISOR AND THE TEAM LEAD (canon 0.30.67). Owner, 2026-09-14,
  // verbatim: "Minted HBNs are passing the Team Lead definition from the
  // cloudflare login email to the wet weight screen.  Let's make all
  // "Supervisors" the email, the team lead should be hand entered". The actor
  // (the login) is the Supervisor and records itself as created_by; the Team
  // Lead is the name typed on the header, stored as team_lead. The 0008 picker
  // (lead_person_id) is retired: new lots leave it NULL.
  const teamLead = requireText(form.get("team_lead"), "Team Lead");
  const harvestBatchId = requireText(form.get("harvest_batch_id"), "HBN");
  // Owner addendum 2026-09-04 (canon 0.22.0): the ACTUAL start time is a data
  // field captured here, where the HBN ratifies. Optional; 24-hour law when set.
  const actualStartTime = optionalTime24(form.get("actual_start_time"), "Actual Start Time (24h)");
  const notes = textOrNull(form.get("notes"));
  const batch = await db
    .prepare(
      `SELECT id, status, born_from, farm_code, material_form, planned_dryspc FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(harvestBatchId)
    .first<{ id: string; status: string; born_from: string; farm_code: string | null; material_form: string | null; planned_dryspc: string | null }>();
  if (!batch) throw new HttpError(400, "Unknown harvest batch.");
  // THE HBN INHERITED (canon 0.30.196): a METRC-born batch carries lineage, never a lot.
  if (batch.status !== HARVEST_STATUS.open || batch.born_from === HARVEST_BORN.metrc) {
    throw new HttpError(400, "That batch is not in the HBN Queue.");
  }
  // THE TWO HARVEST NODES (canon 0.30.317): this station takes Penn North batches only.
  // A row with no farm (a test double) is left to the older checks.
  if (batch.farm_code && batch.farm_code !== "PNN") {
    throw new HttpError(400, "Penn North Harvest takes Penn North batches only.");
  }
  // THE TRUCK RECORD (canon 0.30.226): Truck # is free text on the header.
  // Blank is a lot that goes straight to its space.
  const truckNumber = textOrNull(form.get("truck_number"));
  // THE HBN ENTRY (canon 0.30.341; the owner: "remove "move-to" altogether";
  // his pick "Bucked to the HBN's silo, Spear hangs"): the HBN decides the
  // lot's form and its space. A Bucked HBN's lots weigh into its silo (the
  // sequence's space for planned_dryspc; an HBN with no numeric silo refuses
  // in words) and mint WIP; a Spear HBN's lots hang in Penn North's holding
  // space (Hang in Place) and mint SPR. A posted actual_dryspc or
  // material_form, from any older client, is ignored.
  const landing = await lotLandingForBatch(db, batch, LANDING_FARM);
  const drySpaceId = landing.spaceId;
  const materialForm = landing.materialForm;

  const id = crypto.randomUUID();
  const ts = nowIso();
  // THE FOUR START TAPS (canon 0.30.89; owner, 2026-09-16, a picture of four
  // weighing lots born six seconds apart on the PNS HBN: "What's happening?"):
  // repeated taps on Start lot minted a lot each. A header that repeats an
  // EMPTY weighing lot's (same HBN, Move To, truck, Team Lead) born within the
  // window lands on that lot; a lot already holding weight is never taken.
  const since = new Date(Date.parse(ts) - START_LOT_REPEAT_WINDOW_SECONDS * 1000).toISOString();
  const repeat = await db
    .prepare(
      `SELECT id FROM wet_weight_entries
       WHERE harvest_batch_id = ? AND status = ? AND deleted_at IS NULL AND weight_grams = 0
         AND actual_dryspc = ? AND COALESCE(truck_number, '') = ? AND LOWER(TRIM(COALESCE(team_lead, ''))) = ?
         AND created_at >= ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(harvestBatchId, LOT_STATUS.weighing, drySpaceId, truckNumber ?? "", teamLead.trim().toLowerCase(), since)
    .first<{ id: string }>();
  if (repeat) return { redirect: `/station/wet_weight?lot=${encodeURIComponent(repeat.id)}&repeat=1` };
  // THE EFFECTIVE DATE PER STATION (owner ruling 2026-09-16, canon 0.30.94):
  // the lot's transaction date, today by default (a Start lot tap needs no
  // touch), the Admin PIN for any other day. The audit created_at stays the
  // instant; effective_date carries the business day.
  const effective = await resolveEffectiveDate(db, form, ts);
  const record = {
    id,
    harvest_batch_id: harvestBatchId,
    weight_grams: 0,
    actual_dryspc: drySpaceId,
    actual_start_time: actualStartTime,
    truck_number: truckNumber,
    material_form: materialForm,
    team_lead: teamLead,
    notes,
    status: LOT_STATUS.weighing,
    effective_date: effective.date,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO wet_weight_entries (
          id, harvest_batch_id, weight_grams, wet_spear_weight_grams, actual_dryspc, actual_start_time, truck_number, material_form, lead_person_id, team_lead, notes, status, effective_date,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, harvestBatchId, 0, drySpaceId, actualStartTime, truckNumber, materialForm, teamLead, notes, LOT_STATUS.weighing, effective.date, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "wet_weight_entries", id, record, actor.id, SYSTEM_REASON.create, ts),
  ];
  if (effective.overridden) {
    stmts.push(effectiveOverrideLog(db, "wet_weight_entries", id, effective, actor.id, ts));
  }
  await db.batch(stmts);
  return { redirect: `/station/wet_weight?lot=${encodeURIComponent(id)}` };
}

/** Fork 6 (canon 0.30.1, owner verbatim: "a way to manually plug the HBN in
 * when the system fails--I'm not opposed, but bury it in Admin somewhere for
 * now.  I don't want that to be the default."): the Admin-buried fallback.
 * Takes a hand-typed HBN verbatim; the trailing YY### must parse so the serial
 * ledger stays whole; the farm-assigned license law holds exactly as at
 * Acquire; a reason is required and everything change-logs. */
export async function manualHbn(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const hbn = requireText(form.get("hbn"), "HBN").trim();
  const entryDate = requireText(form.get("entry_date"), "Date");
  const farmCode = requireText(form.get("farm_code"), "Farm");
  const licenseRaw = textOrNull(form.get("license_value"));
  const licenseValue = licenseRaw || growLicenseForFarm(farmCode);
  const licenseRow = await db
    .prepare(
      `SELECT value, farm_code FROM lookup_values
       WHERE category = 'license' AND value = ? AND deleted_at IS NULL`
    )
    .bind(licenseValue)
    .first<{ value: string; farm_code: string | null }>();
  if (!licenseRow) throw new HttpError(400, "Unknown license.");
  if (!licenseRow.farm_code) {
    throw new HttpError(400, "That license has no farm assignment. Assign it in Admin, Licenses.");
  }
  if (licenseRow.farm_code !== farmCode) {
    throw new HttpError(400, "That license is not on this farm.");
  }
  const growMethodCode = requireText(form.get("grow_method_code"), "Grow Method");
  const strainId = requireText(form.get("strain_id"), "Strain");
  const metrc = textOrNull(form.get("metrc_harvest_tag"));
  // THE HBN ENTRY (canon 0.30.341): the manual mint takes the same two fields as Acquire; the typed HBN stays as typed.
  const siloNumber = requirePlannedSilo(form.get("planned_dryspc"));
  const materialForm = requireMaterialForm(form.get("material_form"));
  const grow = await db
    .prepare(`SELECT hbn_code FROM grow_methods WHERE code = ? AND deleted_at IS NULL`)
    .bind(growMethodCode)
    .first<{ hbn_code: string }>();
  if (!grow) throw new HttpError(400, "Unknown grow method.");
  const strain = await db
    .prepare(`SELECT id, name FROM strains WHERE id = ? AND deleted_at IS NULL`)
    .bind(strainId)
    .first<{ id: string; name: string }>();
  if (!strain) throw new HttpError(400, "Unknown strain.");
  // Canon 0.30.9: the manual mint inherits the strain name as its market strain too.
  const marketStrain = inheritMarketStrain(null, strain.name);
  const tail = hbn.match(/-(\d{2})(\d{3})$/);
  if (!tail) {
    throw new HttpError(400, "The HBN must end in the YY### serial token so the serial ledger stays whole.");
  }
  const harvestYear = harvestYearFromEntryDate(entryDate);
  if (String(harvestYear).slice(-2) !== tail[1]) {
    throw new HttpError(400, "The HBN's year token does not match the entry date's year.");
  }
  const lotSerial = Number(tail[2]);
  assertHbnAvailable(await getHarvestByHbn(db, hbn), hbn);
  const serialTaken = await db
    .prepare(`SELECT id FROM harvest_batches WHERE harvest_year = ? AND lot_serial = ?`)
    .bind(harvestYear, lotSerial)
    .first<{ id: string }>();
  if (serialTaken) {
    throw new HttpError(409, `Serial ${tail[2]} is already minted for year ${tail[1]}.`);
  }
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    entry_date: entryDate,
    farm_code: farmCode,
    grow_method_code: growMethodCode,
    strain_id: strainId,
    market_strain: marketStrain,
    planned_dryspc: siloNumber,
    material_form: materialForm,
    metrc_harvest_tag: metrc,
    hbn,
    lot_serial: lotSerial,
    harvest_year: harvestYear,
    status: HARVEST_STATUS.open,
    license_value: licenseValue,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO harvest_batches (
          id, entry_date, farm_code, grow_method_code, strain_id, market_strain, manicure, planned_dryspc, material_form,
          start_time, zone, rows_text, metrc_harvest_tag, hbn, lot_serial, harvest_year, status, license_value,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(
        id,
        entryDate,
        farmCode,
        growMethodCode,
        strainId,
        marketStrain,
        siloNumber,
        materialForm,
        metrc,
        hbn,
        lotSerial,
        harvestYear,
        HARVEST_STATUS.open,
        licenseValue,
        ts,
        actor.id,
        ts,
        actor.id
      ),
    ...logsForInsert(db, "harvest_batches", id, record, actor.id, reason, ts),
  ]);
  return { redirect: `/admin/manual-hbn?ok=${encodeURIComponent(hbn)}` };
}

/** THE HBN ENTRY (canon 0.30.341): the Silo field of an HBN mint, a sequence number 1 to 7. */
function requirePlannedSilo(raw: unknown): string {
  const n = siloSequenceNumber(textOrNull(raw));
  if (n == null) throw new HttpError(400, "Pick a silo.");
  return String(n);
}

/** THE HBN ENTRY (canon 0.30.341): the Spear or Bucked radio of an HBN mint. */
function requireMaterialForm(raw: unknown): MaterialForm {
  const value = textOrNull(raw);
  if (!isMaterialForm(value)) throw new HttpError(400, "Pick Spear or Bucked.");
  return value;
}

/** THE DISPATCH RULE as THE HBN ENTRY reads it (canon 0.30.155, 0.30.341; his
 * pick "Bucked to the HBN's silo, Spear hangs"): where a lot of this HBN lands
 * and what it is. Bucked goes to the sequence's space for the HBN's planned
 * silo (an HBN with no numeric silo refuses in words); Spear goes to the
 * holding farm's hang space (Hang in Place at Penn North, the Arlington Dry
 * Room at Arlington) and the silo is for the schedule alone. */
export async function lotLandingForBatch(
  db: D1Database,
  batch: { material_form: string | null; planned_dryspc: string | null },
  holdingFarm: string
): Promise<{ spaceId: string; materialForm: MaterialForm }> {
  const materialForm: MaterialForm = batch.material_form === "spear" ? "spear" : "bucked";
  if (materialForm === "bucked") {
    const space = siloSpaceOfNumber(await listSiloSequence(db), batch.planned_dryspc);
    if (!space) throw new HttpError(400, "This HBN has no silo. Set it on the HBN first.");
    return { spaceId: space.id, materialForm };
  }
  const spaceId = await fieldHoldingSpaceId(db, holdingFarm);
  if (!spaceId) throw new HttpError(400, "That destination has no holding space.");
  return { spaceId, materialForm };
}

export function assertLotHasWeights(count: number): void {
  if (count < 1) {
    throw new HttpError(400, "Add at least one weight before finishing the lot.");
  }
}

/** Owner ruling 2026-08-31: Finish unload mirrors Finish lot; at least one
 * non-voided dry weight must exist. */
export function assertLotHasDryWeights(count: number): void {
  if (count < 1) {
    throw new HttpError(400, "Add at least one dry weight before finishing the unload.");
  }
}

/** The station's ledger def; the lot weight routes exist on ledger stations only. */
function requireLedger(station: StationDef): LedgerDef {
  if (!station.ledger) throw new HttpError(404, "Not a ledger station.");
  return station.ledger;
}

/** Add a weight to a lot in the ledger's working status (wet: weighing, dry:
 * drying, mid-unload lots included); the lot's total column recomputes in the
 * same batch (owner rulings 2026-08-28 wet, 2026-08-31 dry). */
export async function addLotWeight(
  db: D1Database,
  station: StationDef,
  lotId: string,
  form: FormData
): Promise<ActionOk> {
  const ledger = requireLedger(station);
  const actor = await requireActor(db, personIdFrom(form));
  const grams = parseGrams(form.get("weight_grams"), "Weight");
  const lot = await db
    .prepare(`SELECT id, status, harvest_batch_id FROM wet_weight_entries WHERE id = ? AND deleted_at IS NULL`)
    .bind(lotId)
    .first<{ id: string; status: string; harvest_batch_id: string }>();
  if (!lot) throw new HttpError(404, "Unknown lot.");
  if (lot.status !== ledger.lotStatus) {
    throw new HttpError(
      400,
      `That lot is not ${ledger.lotStatus}. Weights land on ${ledger.lotStatus} lots only.`
    );
  }
  const id = crypto.randomUUID();
  const ts = nowIso();
  let sessionId: string | null = null;
  if (ledger.table === "dry_weights") {
    const session = await ensureUnloadSession(db, lotId, actor.id, ts, form);
    sessionId = session.id;
  }
  let toteHbn: string | null = null;
  if (ledger.table === "wet_weights") {
    // Penn North Harvest lists PNN batches only, whatever farm the lot's header carries.
    const options = await listOpenFarmHbns(db, "PNN", lot.harvest_batch_id);
    const chosen = textOrNull(form.get("harvest_batch_id")) ?? lot.harvest_batch_id;
    if (!options.some((row) => row.id === chosen)) {
      throw new HttpError(400, "That HBN is not on this lot's list.");
    }
    toteHbn = chosen;
  }
  const record = {
    id,
    [ledger.parentField]: lotId,
    weight_grams: grams,
    ...(toteHbn ? { harvest_batch_id: toteHbn } : {}),
    ...(sessionId ? { session_id: sessionId } : {}),
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  const insertSql =
    ledger.table === "dry_weights"
      ? `INSERT INTO dry_weights (
          id, ${ledger.parentField}, weight_grams, session_id,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      : `INSERT INTO wet_weights (
          id, wet_weight_entry_id, weight_grams, harvest_batch_id,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`;
  const insert = sessionId
    ? db.prepare(insertSql).bind(id, lotId, grams, sessionId, ts, actor.id, ts, actor.id)
    : db.prepare(insertSql).bind(id, lotId, grams, toteHbn, ts, actor.id, ts, actor.id);
  await db.batch([
    insert,
    ...logsForInsert(db, ledger.table, id, record, actor.id, SYSTEM_REASON.create, ts),
    lotTotalRecomputeStmt(db, ledger, lotId, actor.id, ts),
  ]);
  // Owner ruling 2026-08-31: a direct ledger station's record page lives on
  // ?pick= (the pick IS the lot, on the two-pane page); wet lot pages keep ?lot=.
  const lotParam = ledger.mode === "direct" ? "pick" : "lot";
  const rapid = String(form.get("rapid_add") ?? "") === "1";
  const extra = rapid ? "&rapid=1" : "";
  return { redirect: `/station/${station.key}?${lotParam}=${encodeURIComponent(lotId)}&ok=weight${extra}` };
}

type FinishLotRow = {
  id: string;
  status: string;
  weight_grams: number;
  harvest_batch_id: string;
  material_form: string | null;
  truck_number: string | null;
  dry_space_kind: string | null;
  dry_space_name: string | null;
  farm_code: string | null;
  strain_id: string | null;
  hbn: string | null;
  metrc_harvest_tag: string | null;
  license_value: string | null;
};

async function nextHarvestFileSeq(db: D1Database, batchId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(MAX(harvest_file_seq), 0) AS n FROM wet_weight_entries WHERE harvest_batch_id = ?`)
    .bind(batchId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0) + 1;
}

/** THE TRUCK RECORD (canon 0.30.226): when a lot's totes name more than one HBN,
 * Finish lot keeps the header's totes and mints one lot per other HBN, then
 * finishes each with its own package. One HBN returns null and the caller
 * finishes as before. */
async function splitTruckIfNeeded(
  db: D1Database,
  station: StationDef,
  lot: FinishLotRow,
  actorId: string,
  form: FormData
): Promise<ActionOk | null> {
  const totes = await db
    .prepare(
      `SELECT id, weight_grams, harvest_batch_id FROM wet_weights
       WHERE wet_weight_entry_id = ? AND deleted_at IS NULL`
    )
    .bind(lot.id)
    .all<{ id: string; weight_grams: number; harvest_batch_id: string | null }>();
  const groups = new Map<string, { ids: string[]; grams: number }>();
  for (const tote of totes.results ?? []) {
    const hbnId = tote.harvest_batch_id || lot.harvest_batch_id;
    const cur = groups.get(hbnId) ?? { ids: [], grams: 0 };
    cur.ids.push(tote.id);
    cur.grams = roundGrams(cur.grams + Number(tote.weight_grams));
    groups.set(hbnId, cur);
  }
  if (groups.size < 2) return null;
  const header = await db
    .prepare(
      `SELECT actual_dryspc, actual_start_time, truck_number, material_form, lead_person_id, team_lead, notes, effective_date, harvest_file_seq
       FROM wet_weight_entries WHERE id = ?`
    )
    .bind(lot.id)
    .first<{
      actual_dryspc: string;
      actual_start_time: string | null;
      truck_number: string | null;
      material_form: string | null;
      lead_person_id: string | null;
      team_lead: string | null;
      notes: string | null;
      effective_date: string | null;
      harvest_file_seq: number | null;
    }>();
  if (!header) throw new HttpError(404, "Unknown lot.");
  const order = [lot.harvest_batch_id, ...[...groups.keys()].filter((id) => id !== lot.harvest_batch_id)];
  const batches = await db
    .prepare(
      `SELECT id, hbn, strain_id, metrc_harvest_tag, license_value, farm_code FROM harvest_batches WHERE id IN (${order.map(() => "?").join(", ")})`
    )
    .bind(...order)
    .all<{ id: string; hbn: string; strain_id: string | null; metrc_harvest_tag: string | null; license_value: string | null; farm_code: string | null }>();
  const byId = new Map((batches.results ?? []).map((row) => [row.id, row]));
  const next = nextStatus(finishTransitionName(lot.dry_space_kind ?? ""), lot.status);
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  const seqNext = new Map<string, number>();
  for (const hbnId of order) seqNext.set(hbnId, await nextHarvestFileSeq(db, hbnId));
  const parts: string[] = [];
  for (const hbnId of order) {
    const group = groups.get(hbnId);
    const batch = byId.get(hbnId);
    if (!group || !batch) throw new HttpError(400, "That HBN is not on this lot's list.");
    const isHeader = hbnId === lot.harvest_batch_id;
    const rowId = isHeader ? lot.id : crypto.randomUUID();
    const plantRaw = form.get(`plant_count[${hbnId}]`) ?? (isHeader ? form.get("plant_count") : null);
    const skipped = String(form.get("plant_prompt") ?? "") === "skip" && form.get(`plant_count[${hbnId}]`) == null;
    const plantCount = skipped ? null : parsePlantCount(plantRaw);
    const tagRaw = textOrNull(form.get(`metrc_tag[${hbnId}]`)) ?? (isHeader ? textOrNull(form.get("metrc_tag")) : null);
    const typedTag = normalizeMetrcTag(tagRaw);
    const heldSeq = isHeader && header.harvest_file_seq != null ? Number(header.harvest_file_seq) : null;
    const seq = heldSeq ?? seqNext.get(hbnId) ?? 1;
    if (heldSeq == null) seqNext.set(hbnId, seq + 1);
    if (!isHeader) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO wet_weight_entries (
              id, harvest_batch_id, weight_grams, wet_spear_weight_grams, actual_dryspc, actual_start_time, truck_number, material_form, lead_person_id, team_lead, notes, status, effective_date, plant_count, harvest_file_seq,
              created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
            ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
          )
          .bind(
            rowId,
            hbnId,
            group.grams,
            header.actual_dryspc,
            header.actual_start_time,
            header.truck_number,
            header.material_form ?? "spear",
            header.lead_person_id,
            header.team_lead,
            header.notes,
            next,
            header.effective_date,
            plantCount,
            seq,
            ts,
            actorId,
            ts,
            actorId
          )
      );
      for (const toteId of group.ids) {
        stmts.push(
          db.prepare(`UPDATE wet_weights SET wet_weight_entry_id = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(rowId, ts, actorId, toteId),
          insertLog(db, {
            record_table: "wet_weights",
            record_id: toteId,
            field: "wet_weight_entry_id",
            old_value: lot.id,
            new_value: rowId,
            actor_person_id: actorId,
            reason: SYSTEM_REASON.truck_split,
            changed_at: ts,
          })
        );
      }
    }
    stmts.push(
      db
        .prepare(
          `UPDATE wet_weight_entries SET status = ?, weight_grams = ?, plant_count = ?, harvest_file_seq = COALESCE(harvest_file_seq, ?), finished_at = COALESCE(finished_at, ?), updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(next, group.grams, plantCount, seq, ts, ts, actorId, rowId),
      insertLog(db, {
        record_table: "wet_weight_entries",
        record_id: rowId,
        field: "status",
        old_value: isHeader ? lot.status : null,
        new_value: next,
        actor_person_id: actorId,
        reason: SYSTEM_REASON.finish_lot,
        changed_at: ts,
      })
    );
    const plan = planFinishMint(
      {
        wetWeightEntryId: rowId,
        harvestBatchId: hbnId,
        strainId: batch.strain_id,
        farmCode: batch.farm_code ?? lot.farm_code ?? "",
        spaceKind: lot.dry_space_kind ?? "",
        spaceName: lot.dry_space_name ?? "",
        wetTotal: group.grams,
        hbn: batch.hbn,
        metrcHarvestTag: batch.metrc_harvest_tag,
        licenseValue: batch.license_value,
        materialForm: header.material_form,
        metrcTag: typedTag,
        truckNumber: header.truck_number,
      },
      null
    );
    if (plan.action === "insert") plan.id = crypto.randomUUID();
    stmts.push(...inventoryMintStmts(db, plan, actorId, ts));
    if (plan.action === "insert" && plan.id) {
      const spaceKind = lot.dry_space_kind ?? "";
      if (spaceKind !== "silo" && spaceKind !== "truck" && plan.location !== (lot.dry_space_name ?? "")) {
        stmts.push(
          db
            .prepare(`UPDATE local_inventory_items SET location = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
            .bind(lot.dry_space_name ?? "", ts, actorId, plan.id),
          insertLog(db, {
            record_table: "local_inventory_items",
            record_id: plan.id,
            field: "location",
            old_value: plan.location,
            new_value: lot.dry_space_name ?? "",
            actor_person_id: actorId,
            reason: SYSTEM_REASON.finish_lot,
            changed_at: ts,
          })
        );
      }
    }
    const serial = shortLotId(batch.hbn, null);
    parts.push(`${serial}|${group.ids.length}|${formatGrams(group.grams)}`);
  }
  if (station.key === "wet_weight") {
    stmts.push(...(await pennNorthPassStmts(db, order, actorId, ts)));
  }
  await db.batch(stmts);
  const truck = String(header.truck_number ?? "").trim();
  return {
    redirect: `/station/${station.key}?ok=truck_split&truck=${encodeURIComponent(truck)}&parts=${encodeURIComponent(parts.join(";"))}`,
  };
}

/** One weighing lot finished the way Finish lot finishes a single-HBN lot:
 * drying (or the ledger's own transition), the file sequence, the born package.
 * A blank plant count is the Skip. The caller batches the statements. */
async function singleLotFinishStmts(
  db: D1Database,
  lot: FinishLotRow,
  actorId: string,
  form: FormData,
  ts: string,
  finishTransition?: TransitionName
): Promise<D1PreparedStatement[]> {
  const next = nextStatus(finishTransition ?? finishTransitionName(lot.dry_space_kind ?? ""), lot.status);
  const skipped = String(form.get("plant_prompt") ?? "") === "skip";
  const plantCount = skipped ? null : parsePlantCount(form.get("plant_count"));
  const fileSeq = await nextHarvestFileSeq(db, lot.harvest_batch_id);
  // THE HBN ENTRY (canon 0.30.341): the finish stamps finished_at, the instant
  // the lot left weighing, which the HBN Queue reads against the farm's day.
  const stmts: D1PreparedStatement[] = [
    plantCount == null
      ? db
          .prepare(
            `UPDATE wet_weight_entries SET status = ?, harvest_file_seq = COALESCE(harvest_file_seq, ?), finished_at = COALESCE(finished_at, ?), updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(next, fileSeq, ts, ts, actorId, lot.id)
      : db
          .prepare(
            `UPDATE wet_weight_entries SET status = ?, plant_count = ?, harvest_file_seq = COALESCE(harvest_file_seq, ?), finished_at = COALESCE(finished_at, ?), updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(next, plantCount, fileSeq, ts, ts, actorId, lot.id),
    insertLog(db, {
      record_table: "wet_weight_entries",
      record_id: lot.id,
      field: "status",
      old_value: lot.status,
      new_value: next,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.finish_lot,
      changed_at: ts,
    }),
  ];
  if (plantCount != null) {
    stmts.push(
      insertLog(db, {
        record_table: "wet_weight_entries",
        record_id: lot.id,
        field: "plant_count",
        old_value: null,
        new_value: String(plantCount),
        actor_person_id: actorId,
        reason: SYSTEM_REASON.finish_lot,
        changed_at: ts,
      })
    );
  }
  const existingItem = await getInventoryItemForLot(db, lot.id);
  const typedTag = normalizeMetrcTag(textOrNull(form.get("metrc_tag")));
  const plan = planFinishMint(
    {
      wetWeightEntryId: lot.id,
      harvestBatchId: lot.harvest_batch_id,
      strainId: lot.strain_id,
      farmCode: lot.farm_code ?? "",
      spaceKind: lot.dry_space_kind ?? "",
      spaceName: lot.dry_space_name ?? "",
      wetTotal: Number(lot.weight_grams),
      hbn: lot.hbn ?? "",
      metrcHarvestTag: lot.metrc_harvest_tag,
      licenseValue: lot.license_value,
      materialForm: lot.material_form,
      metrcTag: typedTag,
      truckNumber: lot.truck_number,
    },
    existingItem
  );
  if (plan.action === "insert") plan.id = crypto.randomUUID();
  stmts.push(...inventoryMintStmts(db, plan, actorId, ts));
  if (plan.action === "insert" && plan.id) {
    const spaceKind = lot.dry_space_kind ?? "";
    if (spaceKind !== "silo" && spaceKind !== "truck" && plan.location !== (lot.dry_space_name ?? "")) {
      stmts.push(
        db
          .prepare(
            `UPDATE local_inventory_items SET location = ?, updated_at = ?, updated_by = ?
             WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(lot.dry_space_name ?? "", ts, actorId, plan.id),
        insertLog(db, {
          record_table: "local_inventory_items",
          record_id: plan.id,
          field: "location",
          old_value: plan.location,
          new_value: lot.dry_space_name ?? "",
          actor_person_id: actorId,
          reason: SYSTEM_REASON.finish_lot,
          changed_at: ts,
        })
      );
    }
  }
  return stmts;
}

/** The Internal Logistics pass scheduleLogisticsLot writes, in the finish's own
 * batch, reason finish lot. An HBN that already has an open pass is left alone. */
async function pennNorthPassStmts(
  db: D1Database,
  batchIds: string[],
  actorId: string,
  ts: string
): Promise<D1PreparedStatement[]> {
  const stmts: D1PreparedStatement[] = [];
  const seen = new Set<string>();
  for (const batchId of batchIds) {
    if (!batchId || seen.has(batchId)) continue;
    seen.add(batchId);
    const open = await db
      .prepare(
        `SELECT id FROM production_schedules
         WHERE harvest_batch_id = ? AND stage = ? AND status = ? AND deleted_at IS NULL`
      )
      .bind(batchId, INTERNAL_LOGISTICS_STAGE, SCHEDULE_STATUS.scheduled)
      .first<{ id: string }>();
    if (open) continue;
    const id = crypto.randomUUID();
    const record = {
      id,
      stage: INTERNAL_LOGISTICS_STAGE,
      harvest_batch_id: batchId,
      status: SCHEDULE_STATUS.scheduled,
      scheduled_at: ts,
      scheduled_by: actorId,
      created_at: ts,
      created_by: actorId,
      updated_at: ts,
      updated_by: actorId,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO production_schedules (
            id, stage, wet_weight_entry_id, wip_package_id, harvest_batch_id, status,
            effective_date, scheduled_at, scheduled_by, completed_at, completed_by,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
          ) VALUES (?, ?, NULL, NULL, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
        )
        .bind(id, INTERNAL_LOGISTICS_STAGE, batchId, SCHEDULE_STATUS.scheduled, ts, actorId, ts, actorId, ts, actorId),
      ...logsForInsert(db, "production_schedules", id, record, actorId, SYSTEM_REASON.finish_lot, ts)
    );
  }
  return stmts;
}

/** Finish the lot from its ledger. Wet routes by the destination kind: trucks go
 * in transit, everything else dries (owner ruling 2026-08-28). A ledger with its
 * own finishTransition applies that instead; the unload's moves drying to
 * unloaded (owner ruling 2026-08-31). */
export async function finishLot(
  db: D1Database,
  station: StationDef,
  lotId: string,
  form: FormData
): Promise<ActionOk> {
  const ledger = requireLedger(station);
  const actor = await requireActor(db, personIdFrom(form));
  if (ledger.table === "dry_weights") {
    return finishUnload(db, station, lotId, form);
  }
  const lot = await db
    .prepare(
      `SELECT w.id, w.status, w.weight_grams, w.harvest_batch_id, w.material_form, w.truck_number,
              d.kind AS dry_space_kind, d.name AS dry_space_name,
              b.farm_code, b.strain_id, b.hbn, b.metrc_harvest_tag, b.license_value
       FROM wet_weight_entries w
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       WHERE w.id = ? AND w.deleted_at IS NULL`
    )
    .bind(lotId)
    .first<{
      id: string;
      status: string;
      weight_grams: number;
      harvest_batch_id: string;
      material_form: string | null;
      truck_number: string | null;
      dry_space_kind: string | null;
      dry_space_name: string | null;
      farm_code: string | null;
      strain_id: string | null;
      hbn: string | null;
      metrc_harvest_tag: string | null;
      license_value: string | null;
    }>();
  if (!lot) throw new HttpError(404, "Unknown lot.");
  const count = await countLotWeights(db, ledger, lotId);
  assertLotHasWeights(count);
  const split = await splitTruckIfNeeded(db, station, lot, actor.id, form);
  if (split) return split;
  const ts = nowIso();
  const stmts = await singleLotFinishStmts(db, lot, actor.id, form, ts, ledger.finishTransition);
  if (station.key === "wet_weight") {
    stmts.push(...(await pennNorthPassStmts(db, [lot.harvest_batch_id], actor.id, ts)));
  }
  await db.batch(stmts);
  return {
    redirect: `/station/${station.key}?ok=finished`,
  };
}

function parseWholeGrams(raw: unknown): number {
  const s = textOrNull(raw);
  if (s == null) throw new HttpError(400, "Weight is required.");
  const cleaned = s.replace(/,/g, "");
  if (!/^\d+$/.test(cleaned)) throw new HttpError(400, "Weight must be a whole gram, zero or more.");
  return Number(cleaned);
}

async function requireAdminPin(db: D1Database, form: FormData, message: string): Promise<void> {
  const pin = await getConfigValue(db, CONFIG_KEYS.admin_pin);
  const entered = textOrNull(form.get("pin"));
  if (!pin || entered !== pin) throw new HttpError(403, message);
}

function checkedFieldHbns(form: FormData): string[] {
  const ids = [...form.getAll("hbn"), ...form.getAll("harvest_batch_id")]
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
  return [...new Set(ids)];
}

const FIELD_FINISH_LOT_SQL = `SELECT w.id, w.status, w.weight_grams, w.harvest_batch_id, w.material_form, w.truck_number,
              d.kind AS dry_space_kind, d.name AS dry_space_name,
              b.farm_code, b.strain_id, b.hbn, b.metrc_harvest_tag, b.license_value
       FROM wet_weight_entries w
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       WHERE w.id = ? AND w.deleted_at IS NULL`;

async function loadWeighingFinishLot(db: D1Database, hbnId: string): Promise<FinishLotRow | null> {
  const row = await db
    .prepare(
      `SELECT id FROM wet_weight_entries
       WHERE harvest_batch_id = ? AND status = ? AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(hbnId, LOT_STATUS.weighing)
    .first<{ id: string }>();
  if (!row) return null;
  return db.prepare(FIELD_FINISH_LOT_SQL).bind(row.id).first<FinishLotRow>();
}

async function ensureWeighingLotStmts(
  db: D1Database,
  hbnId: string,
  load: { operator_name: string | null; destination_farm_code: string; effective_date: string },
  actorId: string,
  ts: string
): Promise<{ lotId: string; stmts: D1PreparedStatement[]; priorGrams: number }> {
  const existing = await db
    .prepare(
      `SELECT id, weight_grams FROM wet_weight_entries
       WHERE harvest_batch_id = ? AND status = ? AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(hbnId, LOT_STATUS.weighing)
    .first<{ id: string; weight_grams: number }>();
  if (existing) return { lotId: existing.id, stmts: [], priorGrams: Number(existing.weight_grams) };
  // THE HBN ENTRY (canon 0.30.341): the HBN decides the tote's lot. Bucked
  // weighs into the HBN's silo (refuse the tote when the HBN has none); Spear
  // hangs in the destination's holding space as before.
  const batch = await db
    .prepare(`SELECT material_form, planned_dryspc FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`)
    .bind(hbnId)
    .first<{ material_form: string | null; planned_dryspc: string | null }>();
  if (!batch) throw new HttpError(400, "Unknown harvest batch.");
  const landing = await lotLandingForBatch(db, batch, load.destination_farm_code);
  const spaceId = landing.spaceId;
  const id = crypto.randomUUID();
  const operator = (load.operator_name ?? "").trim() || null;
  const record = {
    id,
    harvest_batch_id: hbnId,
    weight_grams: 0,
    actual_dryspc: spaceId,
    material_form: landing.materialForm,
    team_lead: operator,
    status: LOT_STATUS.weighing,
    effective_date: load.effective_date,
    created_at: ts,
    created_by: actorId,
    updated_at: ts,
    updated_by: actorId,
  };
  return {
    lotId: id,
    priorGrams: 0,
    stmts: [
      db
        .prepare(
          `INSERT INTO wet_weight_entries (
            id, harvest_batch_id, weight_grams, wet_spear_weight_grams, actual_dryspc, actual_start_time, truck_number, material_form, lead_person_id, team_lead, notes, status, effective_date,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, 0, NULL, ?, NULL, NULL, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(id, hbnId, spaceId, landing.materialForm, operator, LOT_STATUS.weighing, load.effective_date, ts, actorId, ts, actorId),
      ...logsForInsert(db, "wet_weight_entries", id, record, actorId, SYSTEM_REASON.create, ts),
    ],
  };
}

export async function startFieldLoad(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const destination = requireText(form.get("destination_farm_code"), "Destination");
  const destinations = await listFieldDestinations(db);
  if (!destinations.some((row) => row.code === destination)) {
    throw new HttpError(400, "That farm is not a destination.");
  }
  const operator = textOrNull(form.get("operator_name"));
  const ts = nowIso();
  const day = await farmToday(db, ts);
  const id = crypto.randomUUID();
  const record = {
    id,
    operator_name: operator,
    destination_farm_code: destination,
    status: FIELD_LOAD_STATUS.open,
    started_at: ts,
    effective_date: day,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO field_loads (
          id, operator_name, destination_farm_code, status, started_at, sent_at, effective_date,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, operator, destination, FIELD_LOAD_STATUS.open, ts, day, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "field_loads", id, record, actor.id, SYSTEM_REASON.field_load_started, ts),
  ]);
  return { redirect: `/station/field_harvest?load=${encodeURIComponent(id)}&ok=load_started` };
}

export async function addFieldLoadWeight(db: D1Database, loadId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const load = await getFieldLoad(db, loadId);
  if (!load) throw new HttpError(404, "Unknown load.");
  if (load.status !== FIELD_LOAD_STATUS.open) throw new HttpError(400, "That load is not open.");
  const grams = parseWholeGrams(form.get("weight_grams"));
  const hbnId = requireText(form.get("harvest_batch_id"), "HBN");
  const options = await listFieldHbns(db);
  if (!options.some((row) => row.id === hbnId)) throw new HttpError(400, "That HBN is not on this list.");
  const ts = nowIso();
  const ensured = await ensureWeighingLotStmts(db, hbnId, load, actor.id, ts);
  const id = crypto.randomUUID();
  const record = {
    id,
    wet_weight_entry_id: ensured.lotId,
    weight_grams: grams,
    harvest_batch_id: hbnId,
    field_load_id: loadId,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  const ledger = ledgerByTable("wet_weights");
  if (!ledger) throw new HttpError(500, "Server error.");
  await db.batch([
    ...ensured.stmts,
    db
      .prepare(
        `INSERT INTO wet_weights (
          id, wet_weight_entry_id, weight_grams, harvest_batch_id, field_load_id,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, ensured.lotId, grams, hbnId, loadId, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "wet_weights", id, record, actor.id, SYSTEM_REASON.create, ts),
    lotTotalRecomputeStmt(db, ledger, ensured.lotId, actor.id, ts),
  ]);
  return { redirect: `/station/field_harvest?load=${encodeURIComponent(loadId)}&carry=1&ok=field_weight` };
}

export async function sendFieldLoad(db: D1Database, loadId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const load = await getFieldLoad(db, loadId);
  if (!load) throw new HttpError(404, "Unknown load.");
  if (load.status !== FIELD_LOAD_STATUS.open) throw new HttpError(400, "That load is not open.");
  const totes = await listFieldLoadTotes(db, loadId);
  if (totes.length === 0) throw new HttpError(400, "This load has no weights to send.");
  const ledger = ledgerByTable("wet_weights");
  if (!ledger) throw new HttpError(500, "Server error.");
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const hbnId of checkedFieldHbns(form)) {
    if (!totes.some((tote) => tote.harvest_batch_id === hbnId)) {
      throw new HttpError(400, "That HBN is not on this load.");
    }
    const lot = await loadWeighingFinishLot(db, hbnId);
    if (!lot) throw new HttpError(400, "That HBN has no weighing lot.");
    assertLotHasWeights(await countLotWeights(db, ledger, lot.id));
    stmts.push(...(await singleLotFinishStmts(db, lot, actor.id, new FormData(), ts)));
    const prior = await db
      .prepare(`SELECT field_closed_at, field_closed_by FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`)
      .bind(hbnId)
      .first<{ field_closed_at: string | null; field_closed_by: string | null }>();
    stmts.push(
      db
        .prepare(
          `UPDATE harvest_batches SET field_closed_at = ?, field_closed_by = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, ts, actor.id, hbnId),
      insertLog(db, {
        record_table: "harvest_batches",
        record_id: hbnId,
        field: "field_closed_at",
        old_value: prior?.field_closed_at ?? null,
        new_value: ts,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.field_hbn_closed,
        changed_at: ts,
      }),
      insertLog(db, {
        record_table: "harvest_batches",
        record_id: hbnId,
        field: "field_closed_by",
        old_value: prior?.field_closed_by ?? null,
        new_value: actor.id,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.field_hbn_closed,
        changed_at: ts,
      })
    );
  }
  stmts.push(
    db
      .prepare(
        `UPDATE field_loads SET status = ?, sent_at = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(FIELD_LOAD_STATUS.in_transit, ts, ts, actor.id, loadId),
    insertLog(db, {
      record_table: "field_loads",
      record_id: loadId,
      field: "status",
      old_value: load.status,
      new_value: FIELD_LOAD_STATUS.in_transit,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.field_load_sent,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "field_loads",
      record_id: loadId,
      field: "sent_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.field_load_sent,
      changed_at: ts,
    })
  );
  await db.batch(stmts);
  return { redirect: "/station/field_harvest?ok=load_sent" };
}

export async function reopenFieldLoad(db: D1Database, loadId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  await requireAdminPin(db, form, "Reopening a load needs the Admin PIN.");
  const load = await getFieldLoad(db, loadId);
  if (!load) throw new HttpError(404, "Unknown load.");
  if (load.status !== FIELD_LOAD_STATUS.in_transit) throw new HttpError(400, "That load is not in transit.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE field_loads SET status = ?, sent_at = NULL, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(FIELD_LOAD_STATUS.open, ts, actor.id, loadId),
    insertLog(db, {
      record_table: "field_loads",
      record_id: loadId,
      field: "status",
      old_value: load.status,
      new_value: FIELD_LOAD_STATUS.open,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.field_load_reopened,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "field_loads",
      record_id: loadId,
      field: "sent_at",
      old_value: load.sent_at,
      new_value: null,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.field_load_reopened,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/station/field_harvest?load=${encodeURIComponent(loadId)}&ok=load_reopened` };
}

export async function changeFieldToteHbn(db: D1Database, toteId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  await requireAdminPin(db, form, "Changing an HBN needs the Admin PIN.");
  const tote = await db
    .prepare(
      `SELECT t.id, t.weight_grams, t.harvest_batch_id, t.field_load_id, t.wet_weight_entry_id,
              w.status AS lot_status, w.weight_grams AS lot_grams
       FROM wet_weights t
       JOIN wet_weight_entries w ON w.id = t.wet_weight_entry_id
       WHERE t.id = ? AND t.deleted_at IS NULL`
    )
    .bind(toteId)
    .first<{
      id: string;
      weight_grams: number;
      harvest_batch_id: string | null;
      field_load_id: string | null;
      wet_weight_entry_id: string;
      lot_status: string;
      lot_grams: number;
    }>();
  if (!tote) throw new HttpError(404, "Unknown weight.");
  if (tote.lot_status !== LOT_STATUS.weighing) {
    throw new HttpError(400, "Only a weighing lot's totes can change HBN; this lot has finished.");
  }
  const load = tote.field_load_id ? await getFieldLoad(db, tote.field_load_id) : null;
  if (!load || load.status !== FIELD_LOAD_STATUS.open) throw new HttpError(400, "That load is not open.");
  const nextId = requireText(form.get("harvest_batch_id"), "HBN");
  if (nextId === tote.harvest_batch_id) {
    return { redirect: `/station/field_harvest?load=${encodeURIComponent(load.id)}` };
  }
  const options = await listFieldHbns(db);
  if (!options.some((row) => row.id === nextId)) throw new HttpError(400, "That HBN is not on this list.");
  const ledger = ledgerByTable("wet_weights");
  if (!ledger) throw new HttpError(500, "Server error.");
  const ts = nowIso();
  const ensured = await ensureWeighingLotStmts(db, nextId, load, actor.id, ts);
  const grams = Number(tote.weight_grams);
  const oldGrams = Number(tote.lot_grams);
  await db.batch([
    ...ensured.stmts,
    db
      .prepare(
        `UPDATE wet_weights SET wet_weight_entry_id = ?, harvest_batch_id = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ensured.lotId, nextId, ts, actor.id, toteId),
    insertLog(db, {
      record_table: "wet_weights",
      record_id: toteId,
      field: "harvest_batch_id",
      old_value: tote.harvest_batch_id,
      new_value: nextId,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.field_tote_hbn,
      changed_at: ts,
    }),
    lotTotalRecomputeStmt(db, ledger, tote.wet_weight_entry_id, actor.id, ts),
    lotTotalRecomputeStmt(db, ledger, ensured.lotId, actor.id, ts),
    insertLog(db, {
      record_table: "wet_weight_entries",
      record_id: tote.wet_weight_entry_id,
      field: "weight_grams",
      old_value: String(oldGrams),
      new_value: String(oldGrams - grams),
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.field_tote_hbn,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "wet_weight_entries",
      record_id: ensured.lotId,
      field: "weight_grams",
      old_value: String(ensured.priorGrams),
      new_value: String(ensured.priorGrams + grams),
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.field_tote_hbn,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/station/field_harvest?load=${encodeURIComponent(load.id)}` };
}

type ArrivalLot = {
  id: string;
  status: string;
  weight_grams: number;
  harvest_batch_id: string;
  material_form: string | null;
  farm_code: string | null;
  strain_id: string | null;
  hbn: string | null;
  metrc_harvest_tag: string | null;
};

const ARRIVAL_LOT_SQL = `SELECT w.id, w.status, w.weight_grams, w.harvest_batch_id, w.material_form,
              b.farm_code, b.strain_id, b.hbn, b.metrc_harvest_tag
       FROM wet_weight_entries w
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       WHERE w.id = ? AND w.deleted_at IS NULL`;

/** THE TRUCK CARRIES ITS PAPER (owner bug report 2026-09-08, canon 0.30.9): the
 * lot side of an arrival, shared by the one-button receive and a manifest-pane
 * receipt so no path strands a truck row in transit. The lot lands drying with
 * its log; a pre-ledger lot (no born package) takes the fallback mint into the
 * destination barn under the arrival license, kind from the lot's form. */
function lotArrivalStmts(
  db: D1Database,
  lot: ArrivalLot,
  destFarm: "ARL" | "PNN" | "PNS",
  existingItem: { id: string } | null,
  actorId: string,
  ts: string,
  metrcTag: string | null = null
): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE wet_weight_entries SET status = ?, finished_at = COALESCE(finished_at, ?), updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(LOT_STATUS.drying, ts, ts, actorId, lot.id),
    insertLog(db, {
      record_table: "wet_weight_entries",
      record_id: lot.id,
      field: "status",
      old_value: lot.status,
      new_value: LOT_STATUS.drying,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.truck_received,
      changed_at: ts,
    }),
  ];
  if (!existingItem) {
    // Fallback for a lot born before the spine (canon 0.22.0 arrival
    // conversion): mint at receipt into the destination barn under the
    // arrival license, kind from the lot's form.
    const mintKind = receiveMintKind(lot.material_form ?? "spear");
    if (mintKind) {
      const plan: MintPlan = {
        action: "insert",
        item_kind: mintKind,
        package_code: lotPackageCode(lot.hbn ?? "", lot.metrc_harvest_tag),
        metrc_tag: metrcTag,
        qty: roundGrams(Number(lot.weight_grams)),
        uom: "g",
        farm_code: lot.farm_code ?? "",
        license_value: licenseForSiteArrival(destFarm),
        location: barnLocationForSite(destFarm),
        harvest_batch_id: lot.harvest_batch_id,
        wet_weight_entry_id: lot.id,
        strain_id: lot.strain_id,
      };
      stmts.push(...inventoryMintStmts(db, plan, actorId, ts));
    }
  }
  return stmts;
}

/** Owner bug report 2026-09-06 (canon 0.28.4) and his correction (canon 0.28.6,
 * verbatim: "no need for the landing space.  We will do a location change when
 * it lands.  The inbox is always barn, the only exception is CSA to CSB (a
 * manifest to the processor, received to CSB) at PNN."): receiving a wet truck
 * lot takes NO space pick. The lot lands drying (its space stays the truck
 * sentinel until the crew's location change), and THE MINT FIRES AT RECEIPT
 * into the destination BARN under the ARRIVAL license (canon 0.22.0: everything
 * on the truck lands the site barn and becomes the arrival license). Wet whole
 * material in the barn mints SPR, the same kind a hang finish mints; the later
 * Move To edit carries the item to its space (editRecord's sync). */
export async function receiveTruckLot(
  db: D1Database,
  site: IntercoSite,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const lotId = requireText(form.get("lot_id"), "Lot");
  const lot = await db.prepare(ARRIVAL_LOT_SQL).bind(lotId).first<ArrivalLot>();
  if (!lot) throw new HttpError(404, "Unknown lot.");
  // Owner ruling 2026-09-07 (canon 0.29.1): the receive stops asking. The lot
  // carries its form from wet weigh-in (0.28.8's spear SPR / bucked WIP map
  // unchanged, the input now lot-borne); 0032 backfilled every older lot.
  const mintKind = receiveMintKind(lot.material_form ?? "spear");
  if (!mintKind) throw new HttpError(400, "This lot has no Spear or Bucked set.");
  if (lot.status !== LOT_STATUS.in_transit) {
    throw new HttpError(400, "Only a truck lot on the road can be received.");
  }
  if (wetTruckDestSite(lot.farm_code) !== site) {
    throw new HttpError(400, "This truck is not headed to this site.");
  }
  const destFarm = siteFarmCode(site);
  const ts = nowIso();
  const existingItem = await getInventoryItemForLot(db, lot.id);
  // THE TAG LAW (canon 0.30.38, fork F4): the one-button receive may hand the
  // arriving package its METRC tag (the tag mints at receipt, his 2026-09-05
  // words); optional, logged, never refused. A pre-spine lot minting here
  // takes the tag at birth.
  const typedTag = normalizeMetrcTag(textOrNull(form.get("metrc_tag")));
  const stmts: D1PreparedStatement[] = lotArrivalStmts(db, lot, destFarm, existingItem, actor.id, ts, typedTag);
  const qty = roundGrams(Number(lot.weight_grams));
  const arrivalLicense = licenseForSiteArrival(destFarm);
  const arrivalBarn = barnLocationForSite(destFarm);
  if (existingItem && typedTag) {
    stmts.push(
      db
        .prepare(
          `UPDATE local_inventory_items SET metrc_tag = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(typedTag, ts, actor.id, existingItem.id),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: existingItem.id,
        field: "metrc_tag",
        old_value: null,
        new_value: typedTag,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.metrc_tag_captured,
        changed_at: ts,
      })
    );
  }
  if (existingItem) {
    // THE SPINE (canon 0.30.1): the package was born at Finish lot and rode
    // its manifest here. The receive is the manifest receive: the item lands
    // the destination barn under the arrival license (THE INBOX, canon
    // 0.28.6), each change logged.
    stmts.push(
      db
        .prepare(
          `UPDATE local_inventory_items SET qty = ?, location = ?, license_value = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(qty, arrivalBarn, arrivalLicense, ts, actor.id, existingItem.id),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: existingItem.id,
        field: "location",
        old_value: existingItem.location,
        new_value: arrivalBarn,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.truck_received,
        changed_at: ts,
      }),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: existingItem.id,
        field: "license_value",
        old_value: null,
        new_value: arrivalLicense,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.truck_received,
        changed_at: ts,
      })
    );
  }
  // THE TRUCK CARRIES ITS PAPER (canon 0.30.9): the one button closes the open
  // manifest row whichever way the lot rode, as its born package (the spine's
  // manifest cut at finish) or as a WET item (a floor manifest built on the
  // weighing lot), with a receipt.
  const openRow = await db
    .prepare(
      `SELECT mi.id, mi.movement_id FROM interco_movement_items mi
       JOIN interco_movements m ON m.id = mi.movement_id
       WHERE mi.local_inventory_item_id IN (?, ?) AND mi.received_at IS NULL
         AND mi.deleted_at IS NULL AND m.deleted_at IS NULL AND m.status = ?
       ORDER BY mi.created_at DESC LIMIT 1`
    )
    .bind(existingItem?.id ?? lot.id, lot.id, MOVEMENT_STATUS.completed)
    .first<{ id: string; movement_id: string }>();
  if (openRow) {
    const receiptId = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO interco_receipts (
            id, movement_id, note, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
        )
        .bind(receiptId, openRow.movement_id, "Wet truck received", ts, actor.id, ts, actor.id),
      db
        .prepare(
          `UPDATE interco_movement_items SET received_at = ?, received_by = ?, receipt_id = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, receiptId, ts, actor.id, openRow.id),
      insertLog(db, {
        record_table: "interco_movement_items",
        record_id: openRow.id,
        field: "received_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.truck_received,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: `/interco/arrivals/${site}?ok=received` };
}

/** Add a truck (owner ruling 2026-08-31): trucks never persist in the Move To
 * catalog, so this writes nothing. It stages the next number for the picked HBN
 * in the redirect only: 1 past the highest of that batch's own truck numbers and
 * the currently staged one. The truck becomes real when Start lot writes the
 * record; abandoning the page abandons the staged number by design. */
export async function addTruck(
  db: D1Database,
  stationKey: string,
  form: FormData
): Promise<ActionOk> {
  await requireActor(db, personIdFrom(form));
  const pick = requireText(form.get("pick"), "HBN");
  const staged = textOrNull(form.get("truck"));
  const taken = await listBatchTruckNumbers(db, pick);
  const next = nextTruckNumber(staged ? [...taken, staged] : taken);
  return { redirect: `/station/${stationKey}?pick=${encodeURIComponent(pick)}&truck=${next}` };
}

/* ---------------------------------------------- the ledger follows the trim */

/** THE LEDGER FOLLOWS THE TRIM (canon 0.30.26; owner, 2026-09-09, on his Local
 * Inventory picture: "This is incorrect.  I've trimmed and cryo'd this
 * material.  Right now it should be queued for testing but it doesn't look
 * like it ever moved from the reception even though we've crossed the door.").
 * Until now the WIP pipeline (wip_packages) and the local inventory ledger
 * (local_inventory_items) never spoke: the lot's harvest package sat at its
 * born weight while the trim cut packages beside it. Now a trim package cut
 * mints a ledger item of its own (kind WIP, the package's code and grams, the
 * lot's batch and strain, the parent's farm, license and location, linked by
 * wip_package_id) and draws the same grams off the lot's package; cryo sets
 * the child's grams to the cryo weight; the pencil and the x on a trim package
 * move the grams back and forth. Children carry no wet_weight_entry_id, so
 * every one-item-per-lot reading of the parent stays true. */
type LotLedgerParent = {
  id: string;
  qty: number;
  package_code: string;
  location: string;
  item_kind: string;
  farm_code: string;
  license_value: string;
  strain_id: string | null;
  harvest_batch_id: string | null;
};

async function lotLedgerParent(db: D1Database, lotId: string): Promise<LotLedgerParent | null> {
  return db
    .prepare(
      `SELECT id, qty, package_code, location, item_kind, farm_code, license_value, strain_id, harvest_batch_id
       FROM local_inventory_items
       WHERE wet_weight_entry_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`
    )
    .bind(lotId)
    .first<LotLedgerParent>();
}

type WipChildItem = { id: string; qty: number; location: string; farm_code: string; license_value: string };

async function wipChildItem(db: D1Database, wipPackageId: string): Promise<WipChildItem | null> {
  return db
    .prepare(
      `SELECT id, qty, location, farm_code, license_value FROM local_inventory_items
       WHERE wip_package_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`
    )
    .bind(wipPackageId)
    .first<WipChildItem>();
}

function trimChildMintStmts(
  db: D1Database,
  parent: LotLedgerParent,
  wip: { id: string; package_code: string; grams: number },
  actorId: string,
  ts: string
): D1PreparedStatement[] {
  const id = crypto.randomUUID();
  // THE TAG LAW (canon 0.30.38, fork F5): the code the trim room types IS the
  // METRC package tag; tag-shaped codes land as the child's metrc_tag.
  const metrcTag = normalizeMetrcTag(wip.package_code);
  const record = {
    id,
    item_kind: ITEM_KIND_WIP,
    package_code: wip.package_code,
    metrc_tag: metrcTag,
    harvest_batch_id: parent.harvest_batch_id,
    wip_package_id: wip.id,
    strain_id: parent.strain_id,
    qty: wip.grams,
    uom: "g",
    farm_code: parent.farm_code,
    license_value: parent.license_value,
    location: parent.location,
    created_at: ts,
    created_by: actorId,
  };
  return [
    db
      .prepare(
        `INSERT INTO local_inventory_items (
          id, item_kind, package_code, metrc_tag, harvest_batch_id, wet_weight_entry_id, wip_package_id,
          strain_id, qty, uom, farm_code, license_value, location,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'g', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(
        id,
        ITEM_KIND_WIP,
        wip.package_code,
        metrcTag,
        parent.harvest_batch_id,
        wip.id,
        parent.strain_id,
        wip.grams,
        parent.farm_code,
        parent.license_value,
        parent.location,
        ts,
        actorId,
        ts,
        actorId
      ),
    ...logsForInsert(db, "local_inventory_items", id, record, actorId, SYSTEM_REASON.inv_trim_cut, ts),
  ];
}

/** The parent gives up the grams the trim took; it never reads below zero
 * (an overage is papered by the adjustment lane, fork 7 of canon 0.30.1). */
function parentDrawStmts(
  db: D1Database,
  parent: LotLedgerParent,
  gramsOut: number,
  actorId: string,
  ts: string,
  reason: string
): D1PreparedStatement[] {
  const next = Math.max(0, roundGrams(Number(parent.qty) - gramsOut));
  return setItemQtyLocationStmts(db, parent, { qty: next }, actorId, ts, reason);
}

export async function createTrimPackages(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const lotId = requireText(form.get("wet_weight_entry_id"), "Lot");
  const lot = await db
    .prepare(
      `SELECT id, status, dry_weight_grams, harvest_batch_id FROM wet_weight_entries WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(lotId)
    .first<{ id: string; status: string; dry_weight_grams: number | null; harvest_batch_id: string }>();
  if (!lot) throw new HttpError(400, "Unknown lot.");
  // Owner ruling 2026-08-31: trim picks from the Unloaded Queue; the lot must
  // have finished its unload first.
  if (lot.status !== LOT_STATUS.unloaded) {
    throw new HttpError(400, "That lot is not in the Unloaded Queue.");
  }
  const rawCodes = form.getAll("package_code").map((v) => String(v).trim());
  const rawTypes = form.getAll("package_type_code").map((v) => String(v).trim());
  const rawWeights = form.getAll("weight_grams").map((v) => String(v).trim());
  if (rawCodes.length !== rawTypes.length || rawCodes.length !== rawWeights.length) {
    throw new HttpError(400, "Each package needs a tag, type, and weight.");
  }
  // Owner walk report 2026-09-04 (canon 0.22.0): the [+] idiom. A fully blank
  // entry row skips (the top line is blank by default); a partial row still
  // refuses. plus_one commits and returns to the picked lot with the boxes clear.
  const codes: string[] = [];
  const types: string[] = [];
  const weights: string[] = [];
  for (let i = 0; i < rawCodes.length; i++) {
    const blank = !rawCodes[i] && !rawWeights[i];
    if (blank) continue;
    codes.push(rawCodes[i]);
    types.push(rawTypes[i]);
    weights.push(rawWeights[i]);
  }
  const plusOne = String(form.get("plus_one") ?? "") === "1";
  const gateChoice = textOrNull(form.get("gate_choice"));
  // Owner ruling 2026-09-08 (canon 0.30.9, verbatim: "when I go over in trim
  // packages entry, I need to be prompted that I'm at 0 and the option
  // provided to remove it from queue."): [Remove from queue] at Remaining 0.
  if (gateChoice === "remove") {
    return applyTrimRemove(db, lot, actor.id);
  }
  if (isReconcileChoice(gateChoice)) {
    if (gateChoice === "back") {
      return { redirect: `/station/trim_packages?pick=${encodeURIComponent(lotId)}` };
    }
    return applyTrimReconcile(db, lot, gateChoice === "nothing" ? "nothing" : "queue_adjust", actor.id);
  }
  if (codes.length === 0) {
    if (plusOne) throw new HttpError(400, "Type a package before pressing the plus.");
    const recorded = await sumLotPackageGrams(db, lotId);
    const remaining = sumGrams([Number(lot.dry_weight_grams ?? 0), -recorded]);
    if (remaining > 0) {
      return { redirect: `/station/trim_packages?pick=${encodeURIComponent(lotId)}&gate=1` };
    }
    // At or past zero the picked page prompts REMAINING 0 with [Remove from queue].
    return { redirect: `/station/trim_packages?pick=${encodeURIComponent(lotId)}` };
  }

  const stmts: D1PreparedStatement[] = [];
  const ts = nowIso();
  // Owner ruling 2026-09-08 (canon 0.30.9): every package stores the trim date
  // and the hand-typed operator. THE EFFECTIVE DATE PER STATION (canon
  // 0.30.94): that date is the station's Effective Date, today by default, the
  // Admin PIN for any other day; it writes to each package's trim_date.
  const effective = await resolveEffectiveDate(db, form, ts);
  const trimDate = effective.date;
  // Canon 0.30.21 (owner: "The operator dropdowns don't need to have the
  // maintenance crew on every single one, that was just for the PM portion"):
  // the operator is hand entry again, as 0.30.9 R7 asked.
  const trimOperator = requireText(form.get("trim_operator"), "Operator");
  const cryoTypes = await getCryoTypeCategories(db);
  const cut: Array<{ id: string; package_code: string; grams: number }> = [];
  for (let i = 0; i < codes.length; i++) {
    if (!codes[i] || !types[i] || !weights[i]) {
      throw new HttpError(400, "Each package needs a tag, type, and weight.");
    }
    const pkgType = await db
      .prepare(
        `SELECT code, is_bud FROM package_types WHERE code = ? AND deleted_at IS NULL`
      )
      .bind(types[i])
      .first<{ code: string; is_bud: number }>();
    if (!pkgType) throw new HttpError(400, `Unknown package type: ${types[i]}`);
    const weight = roundGrams(Number(weights[i]));
    if (!Number.isFinite(weight) || weight < 0) {
      throw new HttpError(400, "Weight must be a number of grams, zero or greater.");
    }
    // THE CRYO POOL BY TYPE (canon 0.30.119): the cryo-bound types come from
    // app_config cryo_type_categories (BUD, SMALLS, SHAKE), not the is_bud flag.
    const status = initialWipStatus(pkgType.code, cryoTypes);
    const id = crypto.randomUUID();
    const record = {
      id,
      wet_weight_entry_id: lotId,
      harvest_batch_id: lot.harvest_batch_id,
      package_code: codes[i],
      package_type_code: types[i],
      weight_grams: weight,
      status,
      trim_date: trimDate,
      trim_operator: trimOperator,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO wip_packages (
            id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams,
            cryo_weight_grams, status, test_outcome, trim_date, trim_operator,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(id, lotId, lot.harvest_batch_id, codes[i], types[i], weight, status, trimDate, trimOperator, ts, actor.id, ts, actor.id)
    );
    stmts.push(...logsForInsert(db, "wip_packages", id, record, actor.id, SYSTEM_REASON.create, ts));
    if (effective.overridden) {
      stmts.push(effectiveOverrideLog(db, "wip_packages", id, effective, actor.id, ts));
    }
    cut.push({ id, package_code: codes[i], grams: weight });
  }
  // Canon 0.30.26: the ledger follows the trim. Each package cut becomes its
  // own ledger item beside the lot's package, which gives up the grams.
  const parent = await lotLedgerParent(db, lotId);
  if (parent) {
    for (const c of cut) stmts.push(...trimChildMintStmts(db, parent, c, actor.id, ts));
    const gramsOut = sumGrams(cut.map((c) => c.grams));
    stmts.push(...parentDrawStmts(db, parent, gramsOut, actor.id, ts, SYSTEM_REASON.inv_trim_cut));
  }
  await db.batch(stmts);
  // The plus lane lands back on the picked lot so the list grows in place and
  // the entry boxes come back blank.
  if (plusOne) return { redirect: `/station/trim_packages?pick=${encodeURIComponent(lotId)}&ok=plus` };
  const recorded = await sumLotPackageGrams(db, lotId);
  const remaining = sumGrams([Number(lot.dry_weight_grams ?? 0), -recorded]);
  // Canon 0.30.9: at or past zero the picked page itself prompts REMAINING 0
  // with [Remove from queue]; short of the parent the under gate still asks.
  if (remaining > 0) {
    return { redirect: `/station/trim_packages?pick=${encodeURIComponent(lotId)}&gate=1` };
  }
  return { redirect: `/station/trim_packages?pick=${encodeURIComponent(lotId)}&ok=trim` };
}

/** Owner ruling 2026-09-08 (canon 0.30.9): [Remove from queue] at Remaining 0.
 * The lot trims (leaves the Unloaded Queue). When Recorded passed Original,
 * the overage is papered the standing way (fork 7): the log carries the
 * queue_adjust choice so the adjustment CSV pends at the export home, and the
 * flash says so. Short of the parent the button is not offered; a stale post
 * refuses in words. */
async function applyTrimRemove(
  db: D1Database,
  lot: { id: string; status: string; dry_weight_grams: number | null },
  actorId: string
): Promise<ActionOk> {
  const recorded = await sumLotPackageGrams(db, lot.id);
  const remaining = sumGrams([Number(lot.dry_weight_grams ?? 0), -recorded]);
  if (remaining > 0) {
    throw new HttpError(400, "Recorded is short of the parent; remove from the queue at zero.");
  }
  const ts = nowIso();
  const next = nextStatus("lot_trimmed_unloaded", lot.status);
  const stmts: D1PreparedStatement[] = [
    insertLog(db, {
      record_table: "wet_weight_entries",
      record_id: lot.id,
      field: "trim_reconcile_choice",
      old_value: null,
      new_value: remaining < 0 ? "queue_adjust" : "remove",
      actor_person_id: actorId,
      reason: SYSTEM_REASON.trim_remove,
      changed_at: ts,
    }),
    db
      .prepare(
        `UPDATE wet_weight_entries SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(next, ts, actorId, lot.id),
    insertLog(db, {
      record_table: "wet_weight_entries",
      record_id: lot.id,
      field: "status",
      old_value: lot.status,
      new_value: next,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.trim_remove,
      changed_at: ts,
    }),
  ];
  stmts.push(...(await completeTrimScheduleForLot(db, lot.id, actorId, ts)));
  await db.batch(stmts);
  return { redirect: remaining < 0 ? "/station/trim_packages?ok=removed_adjust" : "/station/trim_packages?ok=removed" };
}

async function applyTrimReconcile(
  db: D1Database,
  lot: { id: string; status: string },
  // Canon 0.30.1 fork 7: queue_finish removed from every gate.
  choice: "queue_adjust" | "nothing",
  actorId: string
): Promise<ActionOk> {
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [
    insertLog(db, {
      record_table: "wet_weight_entries",
      record_id: lot.id,
      field: "trim_reconcile_choice",
      old_value: null,
      new_value: choice,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.trim_reconcile,
      changed_at: ts,
    }),
  ];
  // Canon 0.30.1 fork 7: with the METRC finish gone, the adjustment is the
  // gate's completing choice: the delta is papered, so the trim finishes (the
  // transition the old finish choice carried). A deliberate nothing still
  // leaves the lot in the pane for more weighing.
  if (choice === "queue_adjust") {
    const next = nextStatus("lot_trimmed_unloaded", lot.status);
    stmts.push(
      db
        .prepare(
          `UPDATE wet_weight_entries SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(next, ts, actorId, lot.id),
      insertLog(db, {
        record_table: "wet_weight_entries",
        record_id: lot.id,
        field: "status",
        old_value: lot.status,
        new_value: next,
        actor_person_id: actorId,
        reason: SYSTEM_REASON.trim_reconcile,
        changed_at: ts,
      })
    );
    stmts.push(...(await completeTrimScheduleForLot(db, lot.id, actorId, ts)));
  }
  await db.batch(stmts);
  // Canon 0.30.1 fork 8 (his words: "Yeah, that's smart"): queueing an
  // adjustment lands you at the export home where the file pends; a deliberate
  // nothing returns to the station.
  if (choice === "queue_adjust") {
    return { redirect: "/admin/uploads?ok=adjust_queued" };
  }
  return { redirect: "/station/trim_packages?ok=trim" };
}

/** PRODUCTION SCHEDULING (canon 0.30.97): when a lot leaves the Unloaded Queue
 * through lot_trimmed_unloaded, its scheduled trim row completes. Already
 * complete or absent rows are untouched. */
export async function completeTrimScheduleForLot(
  db: D1Database,
  lotId: string,
  actorId: string,
  ts: string
): Promise<D1PreparedStatement[]> {
  const row = await findOpenScheduleForLot(db, lotId);
  if (!row || row.status !== SCHEDULE_STATUS.scheduled) return [];
  return completeScheduleStmts(db, row.id, actorId, ts);
}

function completeScheduleStmts(
  db: D1Database,
  rowId: string,
  actorId: string,
  ts: string
): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `UPDATE production_schedules SET status = ?, completed_at = ?, completed_by = ?,
                updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(SCHEDULE_STATUS.complete, ts, actorId, ts, actorId, rowId),
    insertLog(db, {
      record_table: "production_schedules",
      record_id: rowId,
      field: "status",
      old_value: SCHEDULE_STATUS.scheduled,
      new_value: SCHEDULE_STATUS.complete,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.schedule_complete,
      changed_at: ts,
    }),
  ];
}

function scheduleRedirect(stage: ScheduleStage, ok: string, extra = ""): string {
  return `${PRODUCTION_SCHEDULING_PATH}/${stage}?ok=${ok}${extra}`;
}

export async function scheduleHbn(
  db: D1Database,
  stage: ScheduleStage,
  hbnId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  // THE SCHEDULER BY PACKAGE (canon 0.30.196): prepack schedules one package per >>.
  if (stage === SCHEDULE_STAGES.prepack) throw new HttpError(400, SCHEDULE_REFUSAL.prepackByPackage);
  const batchId = requireText(hbnId, "HBN");
  const items = await listAvailableScheduleItemsForHbn(db, stage, batchId);
  if (items.length === 0) throw new HttpError(400, SCHEDULE_REFUSAL.nothingAvailable);
  const ts = nowIso();
  const effective = await resolveEffectiveDate(db, form, ts);
  const stmts: D1PreparedStatement[] = [];
  // THE CRYO RUN (canon 0.30.110): >> on the Pasteurization station makes ONE
  // run for the HBN (an HBN-level schedule row) and takes its free cryo-queue
  // containers in as the run's inputs, typed and weighed as they stand. A
  // container trimmed later waits for another >> (his pick).
  if (stage === SCHEDULE_STAGES.cryo) {
    const containers = await listCryoFreeContainers(db, batchId);
    if (containers.length === 0) throw new HttpError(400, SCHEDULE_REFUSAL.nothingAvailable);
    const runId = crypto.randomUUID();
    const terpRecipeId = await defaultTerpRecipeForBatch(db, batchId);
    const record = {
      id: runId,
      stage,
      wet_weight_entry_id: null,
      wip_package_id: null,
      harvest_batch_id: batchId,
      status: SCHEDULE_STATUS.scheduled,
      effective_date: effective.date,
      scheduled_at: ts,
      scheduled_by: actor.id,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
      terp_recipe_id: terpRecipeId,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO production_schedules (
            id, stage, wet_weight_entry_id, wip_package_id, harvest_batch_id, status,
            effective_date, scheduled_at, scheduled_by, completed_at, completed_by,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason,
            terp_recipe_id, terp_dose_pct
          ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL)`
        )
        .bind(runId, stage, batchId, SCHEDULE_STATUS.scheduled, effective.date, ts, actor.id, ts, actor.id, ts, actor.id, terpRecipeId)
    );
    stmts.push(...logsForInsert(db, "production_schedules", runId, record, actor.id, SYSTEM_REASON.schedule, ts));
    if (effective.overridden) {
      stmts.push(effectiveOverrideLog(db, "production_schedules", runId, effective, actor.id, ts));
    }
    for (const c of containers) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO cryo_run_inputs (id, run_id, wip_package_id, package_type_code, weight_grams, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(crypto.randomUUID(), runId, c.id, c.package_type_code, roundGrams(Number(c.weight_grams)), ts)
      );
    }
    await db.batch(stmts);
    return { redirect: scheduleRedirect(stage, "scheduled", `&n=${containers.length}`) };
  }
  for (const item of items) {
    const existing = await findOpenScheduleForLot(db, item.itemId);
    if (existing) throw new HttpError(400, SCHEDULE_REFUSAL.alreadyScheduled);
    const id = crypto.randomUUID();
    // Trimming schedules the unloaded lot; the cryo branch returned above.
    const wetId: string | null = item.itemId;
    const pkgId: string | null = null;
    const record = {
      id,
      stage,
      wet_weight_entry_id: wetId,
      wip_package_id: pkgId,
      harvest_batch_id: item.harvest_batch_id,
      status: SCHEDULE_STATUS.scheduled,
      effective_date: effective.date,
      scheduled_at: ts,
      scheduled_by: actor.id,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO production_schedules (
            id, stage, wet_weight_entry_id, wip_package_id, harvest_batch_id, status,
            effective_date, scheduled_at, scheduled_by, completed_at, completed_by,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
        )
        .bind(
          id,
          stage,
          wetId,
          pkgId,
          item.harvest_batch_id,
          SCHEDULE_STATUS.scheduled,
          effective.date,
          ts,
          actor.id,
          ts,
          actor.id,
          ts,
          actor.id
        )
    );
    stmts.push(...logsForInsert(db, "production_schedules", id, record, actor.id, SYSTEM_REASON.schedule, ts));
    if (effective.overridden) {
      stmts.push(effectiveOverrideLog(db, "production_schedules", id, effective, actor.id, ts));
    }
  }
  await db.batch(stmts);
  return { redirect: scheduleRedirect(stage, "scheduled", `&n=${items.length}`) };
}

type TerpLineInput = { terp_name: string; percent: string };

function terpLinesFromForm(form: FormData): TerpLineInput[] {
  const names = form.getAll("terp_name").map((value) => String(value));
  const percents = form.getAll("percent").map((value) => String(value));
  const count = Math.max(names.length, percents.length);
  const lines: TerpLineInput[] = [];
  for (let i = 0; i < count; i++) {
    const terp_name = (names[i] ?? "").trim();
    const percent = (percents[i] ?? "").trim();
    if (!terp_name && !percent) continue;
    lines.push({ terp_name, percent });
  }
  return lines;
}

function parseTerpDose(raw: unknown): number | null {
  const s = textOrNull(raw);
  if (s == null) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new HttpError(400, "Dose must be a percent from 0 to 100, with at most two decimals.");
  }
  const n = Number(s);
  if (n < 0 || n > 100) throw new HttpError(400, "Dose must be a percent from 0 to 100, with at most two decimals.");
  return n;
}

/** TERP RECIPES (canon 0.30.321): one batch, the name unique among active recipes, the lines summing to 100. */
export async function saveTerpRecipe(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const name = requireText(form.get("recipe_name"), "Recipe Name");
  const taken = await db
    .prepare(
      `SELECT id FROM terp_recipes
       WHERE deleted_at IS NULL AND status = ? AND lower(trim(name)) = lower(trim(?))`
    )
    .bind(TERP_RECIPE_STATUS.active, name)
    .first<{ id: string }>();
  if (taken) throw new HttpError(400, "That name is already an active recipe.");
  const lines = terpLinesFromForm(form);
  if (lines.length === 0) throw new HttpError(400, "The percents must total 100.");
  let sum = 0;
  const parsed: Array<{ terp_name: string; percent: number }> = [];
  for (const line of lines) {
    if (!line.terp_name || !line.percent) throw new HttpError(400, "Type a terp name and a percent.");
    if (line.terp_name.length > 60) throw new HttpError(400, "A terp name must be 60 characters or fewer.");
    if (!/^\d+$/.test(line.percent)) throw new HttpError(400, "A percent must be a whole number from 1 to 100.");
    const percent = Number(line.percent);
    if (percent < 1 || percent > 100) throw new HttpError(400, "A percent must be a whole number from 1 to 100.");
    sum += percent;
    parsed.push({ terp_name: line.terp_name, percent });
  }
  if (sum !== 100) throw new HttpError(400, "The percents must total 100.");
  const ts = nowIso();
  const id = crypto.randomUUID();
  const record = {
    id,
    name,
    status: TERP_RECIPE_STATUS.active,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO terp_recipes (
          id, name, status, retired_at, retired_by, retire_reason,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, name, TERP_RECIPE_STATUS.active, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "terp_recipes", id, record, actor.id, SYSTEM_REASON.create, ts),
  ];
  parsed.forEach((line, index) => {
    const lineId = crypto.randomUUID();
    const lineRecord = {
      id: lineId,
      recipe_id: id,
      position: index + 1,
      terp_name: line.terp_name,
      percent: line.percent,
      created_at: ts,
      created_by: actor.id,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO terp_recipe_lines (id, recipe_id, position, terp_name, percent, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(lineId, id, index + 1, line.terp_name, line.percent, ts, actor.id),
      ...logsForInsert(db, "terp_recipe_lines", lineId, lineRecord, actor.id, SYSTEM_REASON.create, ts)
    );
  });
  await db.batch(stmts);
  return { redirect: "/admin/lookups/terp_recipes?ok=recipe_saved" };
}

/** Retire keeps the lines and every run that picked the recipe. A reason is required. */
export async function retireTerpRecipe(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const id = requireText(form.get("id"), "Recipe");
  const reason = requireReason(textOrNull(form.get("reason")));
  const row = await db
    .prepare(`SELECT id, status FROM terp_recipes WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<{ id: string; status: string }>();
  if (!row) throw new HttpError(404, "Unknown recipe.");
  if (row.status !== TERP_RECIPE_STATUS.active) throw new HttpError(400, "That recipe is already retired.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE terp_recipes SET status = ?, retired_at = ?, retired_by = ?, retire_reason = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(TERP_RECIPE_STATUS.retired, ts, actor.id, reason, ts, actor.id, id),
    insertLog(db, {
      record_table: "terp_recipes",
      record_id: id,
      field: "status",
      old_value: row.status,
      new_value: TERP_RECIPE_STATUS.retired,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "terp_recipes",
      record_id: id,
      field: "retired_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "terp_recipes",
      record_id: id,
      field: "retire_reason",
      old_value: null,
      new_value: reason,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
  return { redirect: "/admin/lookups/terp_recipes?retired=1&ok=recipe_retired" };
}

/** The pick and the dose, only while the run is scheduled. A blank recipe clears it. The dose never carries onto the next run. */
export async function pickTerpRecipe(db: D1Database, runId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const row = await db
    .prepare(
      `SELECT id, stage, status, terp_recipe_id, terp_dose_pct
       FROM production_schedules WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(runId)
    .first<{ id: string; stage: string; status: string; terp_recipe_id: string | null; terp_dose_pct: number | null }>();
  if (!row || row.stage !== SCHEDULE_STAGES.cryo) throw new HttpError(404, "Unknown run.");
  if (row.status !== SCHEDULE_STATUS.scheduled) throw new HttpError(400, "Unfinish the run first to change its recipe.");
  const recipeId = textOrNull(form.get("terp_recipe_id"));
  if (recipeId) {
    const recipe = await db
      .prepare(`SELECT id FROM terp_recipes WHERE id = ? AND deleted_at IS NULL AND status = ?`)
      .bind(recipeId, TERP_RECIPE_STATUS.active)
      .first<{ id: string }>();
    if (!recipe) throw new HttpError(400, "That recipe is not on the list.");
  }
  const dose = parseTerpDose(form.get("terp_dose_pct"));
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE production_schedules SET terp_recipe_id = ?, terp_dose_pct = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(recipeId, dose, ts, actor.id, runId),
  ];
  if ((row.terp_recipe_id ?? null) !== (recipeId ?? null)) {
    stmts.push(
      insertLog(db, {
        record_table: "production_schedules",
        record_id: runId,
        field: "terp_recipe_id",
        old_value: row.terp_recipe_id,
        new_value: recipeId,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.terp_recipe_picked,
        changed_at: ts,
      })
    );
  }
  const oldDose = row.terp_dose_pct == null ? null : Number(row.terp_dose_pct);
  if (oldDose !== dose) {
    stmts.push(
      insertLog(db, {
        record_table: "production_schedules",
        record_id: runId,
        field: "terp_dose_pct",
        old_value: oldDose == null ? null : String(oldDose),
        new_value: dose == null ? null : String(dose),
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.terp_dose_set,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: scheduleRedirect(SCHEDULE_STAGES.cryo, "terp_saved") };
}

/** THE FILTER (canon 0.30.196): the Prepack page's filter rides every post back. */
function prepackRedirect(ok: string, form: FormData, extra = ""): string {
  const q = textOrNull(form.get("q"));
  return `${scheduleRedirect(SCHEDULE_STAGES.prepack, ok, extra)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
}

/** THE SCHEDULER BY PACKAGE (canon 0.30.196; owner: "the scheduler should only
 * really be scheduling by the package ID (or the last six digits of it)"): >>
 * on one Available row writes one prepack schedule row for that package, under
 * the HBN the package carries. Its HBN siblings stay where they are. */
export async function schedulePackage(db: D1Database, packageId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const id = requireText(packageId, "Package");
  const existing = await db
    .prepare(`SELECT id FROM production_schedules WHERE wip_package_id = ? AND stage = ? AND deleted_at IS NULL`)
    .bind(id, SCHEDULE_STAGES.prepack)
    .first<{ id: string }>();
  if (existing) throw new HttpError(400, SCHEDULE_REFUSAL.packageScheduled);
  const pkg = await findPrepackAvailable(db, id);
  if (!pkg) throw new HttpError(400, SCHEDULE_REFUSAL.packageGone);
  const ts = nowIso();
  const effective = await resolveEffectiveDate(db, form, ts);
  const rowId = crypto.randomUUID();
  const record = {
    id: rowId,
    stage: SCHEDULE_STAGES.prepack,
    wet_weight_entry_id: null,
    wip_package_id: pkg.package_id,
    harvest_batch_id: pkg.harvest_batch_id,
    status: SCHEDULE_STATUS.scheduled,
    effective_date: effective.date,
    scheduled_at: ts,
    scheduled_by: actor.id,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO production_schedules (
          id, stage, wet_weight_entry_id, wip_package_id, harvest_batch_id, status,
          effective_date, scheduled_at, scheduled_by, completed_at, completed_by,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(rowId, SCHEDULE_STAGES.prepack, pkg.package_id, pkg.harvest_batch_id, SCHEDULE_STATUS.scheduled, effective.date, ts, actor.id, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "production_schedules", rowId, record, actor.id, SYSTEM_REASON.schedule, ts),
  ];
  if (effective.overridden) stmts.push(effectiveOverrideLog(db, "production_schedules", rowId, effective, actor.id, ts));
  await db.batch(stmts);
  return { redirect: prepackRedirect("scheduled", form, "&n=1") };
}

type AdoptBatch = { id: string; hbn: string; farm_code: string; strain_id: string };

/** THE HBN IS THE REAL STRAIN (canon 0.30.200): the live strain whose code is
 * the HBN's fourth segment. None, or more than one, refuses and inserts nothing.
 * Adoption never mints a strain and never matches one by METRC's name. */
async function realStrainForCode(db: D1Database, code: string, hbn: string): Promise<{ id: string; name: string }> {
  const found = await db
    .prepare(`SELECT id, name FROM strains WHERE deleted_at IS NULL AND hbn_code = ? ORDER BY name`)
    .bind(code)
    .all<{ id: string; name: string }>();
  const rows = found.results ?? [];
  if (rows.length === 0) {
    throw refusal(400, {
      key: "{hbn} cannot be adopted: no strain carries code {code}; add it in Admin, Lookups, Strains.",
      vars: { hbn, code },
    });
  }
  if (rows.length > 1) {
    throw refusal(400, {
      key: "{hbn} cannot be adopted: code {code} belongs to {strains}; fix the codes in Admin, Lookups, Strains.",
      vars: { hbn, code, strains: rows.map((row) => row.name).join(", ") },
    });
  }
  return rows[0];
}

/** THE HBN INHERITED (canon 0.30.196; his pick: "Mint the HBN from METRC"): the
 * harvest batch minted from METRC's harvest name exactly as METRC states it,
 * born from METRC, with no lot, no plants and no wet weight. Its strain is the
 * real strain of the HBN's fourth segment (canon 0.30.200) and its market
 * strain is METRC's strain name, the real strain's own name when METRC names
 * none. A name that is not a seven-part HBN, whose year and serial belong to
 * another batch, or whose code no single live strain carries, refuses in words
 * and nothing is minted. */
async function mintMetrcBatch(
  db: D1Database,
  harvest: string,
  source: { strain: string; license: string; packagedDate: string | null },
  actorId: string,
  ts: string
): Promise<{ batch: AdoptBatch; stmts: D1PreparedStatement[] }> {
  const reading = hbnFromMetrcName(harvest, source.packagedDate, await farmToday(db, ts));
  if (!reading.ok) throw refusal(400, reading.refusal);
  const mint = reading.mint;
  const sameName = await db.prepare(`SELECT id FROM harvest_batches WHERE upper(hbn) = ?`).bind(mint.hbn).first<{ id: string }>();
  if (sameName) throw refusal(400, { key: "{hbn} was voided in the app, so it cannot be minted again.", vars: { hbn: mint.hbn } });
  const serialTaken = await db
    .prepare(`SELECT hbn FROM harvest_batches WHERE harvest_year = ? AND lot_serial = ?`)
    .bind(mint.harvest_year, mint.lot_serial)
    .first<{ hbn: string }>();
  if (serialTaken) {
    throw refusal(409, {
      key: "{hbn} cannot be minted: lot {lot} already belongs to {other}.",
      vars: { hbn: mint.hbn, lot: formatLotToken(mint.harvest_year, mint.lot_serial), other: serialTaken.hbn },
    });
  }
  const strain = await realStrainForCode(db, mint.strain_code, mint.hbn);
  const grow = await db
    .prepare(`SELECT code FROM grow_methods WHERE upper(hbn_code) = ? AND deleted_at IS NULL LIMIT 1`)
    .bind(mint.grow_code.toUpperCase())
    .first<{ code: string }>();
  const id = crypto.randomUUID();
  const record = {
    id,
    entry_date: mint.entry_date,
    farm_code: mint.farm_code,
    grow_method_code: grow?.code ?? mint.grow_code,
    strain_id: strain.id,
    market_strain: inheritMarketStrain(source.strain, strain.name),
    manicure: mint.manicure,
    planned_dryspc: mint.planned_dryspc,
    hbn: mint.hbn,
    lot_serial: mint.lot_serial,
    harvest_year: mint.harvest_year,
    status: HARVEST_STATUS.open,
    license_value: source.license,
    born_from: HARVEST_BORN.metrc,
    created_at: ts,
    created_by: actorId,
    updated_at: ts,
    updated_by: actorId,
  };
  return {
    batch: { id, hbn: mint.hbn, farm_code: mint.farm_code, strain_id: strain.id },
    stmts: [
      db
        .prepare(
          `INSERT INTO harvest_batches (
            id, entry_date, farm_code, grow_method_code, strain_id, market_strain, manicure, planned_dryspc,
            start_time, zone, rows_text, metrc_harvest_tag, hbn, lot_serial, harvest_year, status, license_value, born_from,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(
          id,
          record.entry_date,
          record.farm_code,
          record.grow_method_code,
          record.strain_id,
          record.market_strain,
          record.manicure,
          record.planned_dryspc,
          record.hbn,
          record.lot_serial,
          record.harvest_year,
          record.status,
          record.license_value,
          record.born_from,
          ts,
          actorId,
          ts,
          actorId
        ),
      ...logsForInsert(db, "harvest_batches", id, record, actorId, SYSTEM_REASON.metrc_adopt, ts),
    ],
  };
}

/** THE HBN INHERITED (canon 0.30.196) and >> ADOPTS AND SCHEDULES (canon
 * 0.30.200; his pick: "Adopt and schedule in one >>"): the tag arrives on the
 * Available pane's schedule form. The package inherits the harvest METRC's
 * lineage names, a known batch as it stands or a batch minted here, and one
 * prepack schedule row is written with it. The ledger item carries the batch's
 * own strain. A refusal anywhere inserts nothing. << later unschedules the row;
 * the adoption stays. */
export async function adoptFromMetrc(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const tag = requireText(form.get("tag"), "Tag").toUpperCase();
  const pane = await listMetrcAdoptions(db);
  const row = pane.rows.find((item) => item.tag.toUpperCase() === tag);
  if (!row) throw new HttpError(400, "That package is not waiting to be adopted.");
  if (!row.harvest) throw new HttpError(400, "No harvest in METRC's lineage, so that package cannot be adopted.");
  const ts = nowIso();
  const effective = await resolveEffectiveDate(db, form, ts);
  const stmts: D1PreparedStatement[] = [];
  let batch: AdoptBatch;
  let lotId: string | null = null;
  if (row.hbnId) {
    const found = await db
      .prepare(`SELECT id, hbn, farm_code, strain_id FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`)
      .bind(row.hbnId)
      .first<AdoptBatch>();
    if (!found) throw new HttpError(400, "That package is not waiting to be adopted.");
    batch = found;
    lotId = (await lotByHbn(db)).get(found.hbn) ?? null;
  } else {
    const minted = await mintMetrcBatch(db, row.harvest, { strain: row.strain, license: row.license, packagedDate: row.packagedDate }, actor.id, ts);
    batch = minted.batch;
    stmts.push(...minted.stmts);
  }
  const id = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const scheduleId = crypto.randomUUID();
  const record = {
    id,
    wet_weight_entry_id: lotId,
    harvest_batch_id: batch.id,
    package_code: tag,
    package_type_code: row.kind,
    weight_grams: row.grams,
    cryo_weight_grams: row.grams,
    status: WIP_STATUS.released,
    test_outcome: "passed",
    source: WIP_SOURCE.metrc,
  };
  const schedule = {
    id: scheduleId,
    stage: SCHEDULE_STAGES.prepack,
    wet_weight_entry_id: null,
    wip_package_id: id,
    harvest_batch_id: batch.id,
    status: SCHEDULE_STATUS.scheduled,
    effective_date: effective.date,
    scheduled_at: ts,
    scheduled_by: actor.id,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  stmts.push(
    db
      .prepare(
        `INSERT INTO wip_packages (
          id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, cryo_weight_grams,
          status, test_outcome, source, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'passed', ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, lotId, batch.id, tag, row.kind, row.grams, row.grams, WIP_STATUS.released, WIP_SOURCE.metrc, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "wip_packages", id, record, actor.id, SYSTEM_REASON.metrc_adopt, ts),
    // Canon 0.30.26: a child ledger item carries no lot; the package does.
    // Canon 0.30.200: its strain is the batch's real strain, on both paths.
    db
      .prepare(
        `INSERT INTO local_inventory_items (
          id, item_kind, package_code, metrc_tag, harvest_batch_id, wet_weight_entry_id, wip_package_id,
          strain_id, qty, uom, farm_code, license_value, location,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'g', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(itemId, ITEM_KIND_WIP, tag, tag, batch.id, id, batch.strain_id, row.grams, batch.farm_code, row.license, row.location, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "local_inventory_items",
      itemId,
      { item_kind: ITEM_KIND_WIP, metrc_tag: tag, harvest_batch_id: batch.id, strain_id: batch.strain_id, qty: row.grams, location: row.location, license_value: row.license },
      actor.id,
      SYSTEM_REASON.metrc_adopt,
      ts
    ),
    db
      .prepare(
        `INSERT INTO production_schedules (
          id, stage, wet_weight_entry_id, wip_package_id, harvest_batch_id, status,
          effective_date, scheduled_at, scheduled_by, completed_at, completed_by,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(scheduleId, SCHEDULE_STAGES.prepack, id, batch.id, SCHEDULE_STATUS.scheduled, effective.date, ts, actor.id, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "production_schedules", scheduleId, schedule, actor.id, SYSTEM_REASON.schedule, ts)
  );
  if (effective.overridden) stmts.push(effectiveOverrideLog(db, "production_schedules", scheduleId, effective, actor.id, ts));
  try {
    await db.batch(stmts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("unique")) {
      throw refusal(409, { key: "{hbn} was minted by another adoption just now; adopt again.", vars: { hbn: batch.hbn } });
    }
    throw err;
  }
  return { redirect: prepackRedirect("adopted", form, "&n=1") };
}

export async function unscheduleItem(
  db: D1Database,
  stage: ScheduleStage,
  rowId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const row = await getScheduleRow(db, rowId);
  if (!row || row.stage !== stage) throw new HttpError(404, "Unknown schedule row.");
  if (row.status !== SCHEDULE_STATUS.scheduled) {
    throw new HttpError(400, SCHEDULE_REFUSAL.unscheduleComplete);
  }
  // THE CRYO RUN (canon 0.30.110): a run that already has outputs is material
  // in motion; finish it instead. An empty run unschedules and frees its
  // containers for another >>.
  if (stage === SCHEDULE_STAGES.cryo && (await listCryoRunOutputs(db, row.id)).length > 0) {
    throw new HttpError(400, CRYO_REFUSAL.unscheduleWithOutputs);
  }
  if (stage === SCHEDULE_STAGES.prepack) {
    const lines = await db
      .prepare(`SELECT COUNT(*) AS n FROM prepack_lines WHERE job_id = ? AND deleted_at IS NULL`)
      .bind(row.id)
      .first<{ n: number }>();
    if (Number(lines?.n ?? 0) > 0) throw new HttpError(400, "Void the lines before unscheduling.");
  }
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE production_schedules SET deleted_at = ?, deleted_by = ?, delete_reason = ?,
                updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, SYSTEM_REASON.schedule_unscheduled, ts, actor.id, row.id),
    insertLog(db, {
      record_table: "production_schedules",
      record_id: row.id,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.schedule_unscheduled,
      changed_at: ts,
    }),
  ]);
  return { redirect: stage === SCHEDULE_STAGES.prepack ? prepackRedirect("unscheduled", form) : scheduleRedirect(stage, "unscheduled") };
}

export async function completeScheduleItem(
  db: D1Database,
  stage: ScheduleStage,
  rowId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const row = await getScheduleRow(db, rowId);
  if (!row || row.stage !== stage) throw new HttpError(404, "Unknown schedule row.");
  if (row.status !== SCHEDULE_STATUS.scheduled) {
    throw new HttpError(400, "That item is not on the working schedule.");
  }
  // THE CRYO RUN (canon 0.30.110): the arrow on a run is Finish run itself:
  // it consumes the inputs, so it needs at least one output entered.
  if (stage === SCHEDULE_STAGES.cryo) {
    await finishCryoRun(db, row.id, form);
    return { redirect: scheduleRedirect(stage, "completed") };
  }
  if (stage === SCHEDULE_STAGES.prepack) {
    throw new HttpError(400, "Finish Pack on the Prepack station completes this job.");
  }
  const ts = nowIso();
  await db.batch(completeScheduleStmts(db, row.id, actor.id, ts));
  return { redirect: scheduleRedirect(stage, "completed") };
}

async function requireUnfinishPin(db: D1Database, form: FormData, actorId: string): Promise<string> {
  void actorId;
  const pin = await getConfigValue(db, CONFIG_KEYS.admin_pin);
  const entered = textOrNull(form.get("unfinish_pin")) ?? textOrNull(form.get("pin"));
  if (!pin || entered !== pin) throw new HttpError(403, SCHEDULE_REFUSAL.demotePin);
  return entered;
}

function reopenScheduleStmts(db: D1Database, rowId: string, actorId: string, ts: string): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `UPDATE production_schedules SET status = ?, completed_at = NULL, completed_by = NULL,
                updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(SCHEDULE_STATUS.scheduled, ts, actorId, rowId),
    insertLog(db, {
      record_table: "production_schedules",
      record_id: rowId,
      field: "status",
      old_value: SCHEDULE_STATUS.complete,
      new_value: SCHEDULE_STATUS.scheduled,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.schedule_unfinish,
      changed_at: ts,
    }),
  ];
}

function softDeleteScheduleStmts(db: D1Database, rowId: string, actorId: string, ts: string, reason: string): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `UPDATE production_schedules SET deleted_at = ?, deleted_by = ?, delete_reason = ?,
                updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actorId, reason, ts, actorId, rowId),
    insertLog(db, {
      record_table: "production_schedules",
      record_id: rowId,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actorId,
      reason,
      changed_at: ts,
    }),
  ];
}

type CryoOutputGuard = {
  id: string;
  package_code: string;
  status: string;
  weight_grams: number;
  cryo_run_id: string | null;
};

async function markedUpload(db: D1Database, kind: string, refId: string): Promise<{ filename: string } | null> {
  return db
    .prepare(
      `SELECT filename FROM metrc_uploads
       WHERE kind = ? AND ref_id = ? AND deleted_at IS NULL
       ORDER BY uploaded_at DESC LIMIT 1`
    )
    .bind(kind, refId)
    .first<{ filename: string }>();
}

async function outputSample(db: D1Database, tag: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT s.id FROM test_samples s
       JOIN test_orders o ON o.id = s.order_id
       WHERE s.deleted_at IS NULL AND o.deleted_at IS NULL
         AND UPPER(TRIM(o.source_package_tag)) = UPPER(TRIM(?))
       LIMIT 1`
    )
    .bind(tag)
    .first<{ id: string }>();
  return !!row;
}

async function markedTestSampleFile(db: D1Database, tag: string): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT u.filename FROM metrc_uploads u
       JOIN test_samples s ON s.manifest_id = u.ref_id AND s.deleted_at IS NULL
       JOIN test_orders o ON o.id = s.order_id AND o.deleted_at IS NULL
       WHERE u.kind = 'test_sample' AND u.deleted_at IS NULL
         AND UPPER(TRIM(o.source_package_tag)) = UPPER(TRIM(?))
       LIMIT 1`
    )
    .bind(tag)
    .first<{ filename: string }>();
  return row?.filename ?? null;
}

function refuseOutputWorked(tag: string, status: string, file: string | null, sampled: boolean): void {
  if (status !== WIP_STATUS.testing_queue) {
    throw refusal(400, { key: "The output {tag} is {status}.", vars: { tag, status } });
  }
  if (sampled) throw refusal(400, { key: "The output {tag} has a sample.", vars: { tag } });
  if (file) throw refusal(400, { key: "The output {tag} stands in the marked file {file}.", vars: { tag, file } });
}

async function assertOutputUntouched(
  db: D1Database,
  output: { package_code: string; status: string },
  runId: string | null
): Promise<void> {
  const sampled = await outputSample(db, output.package_code);
  const sampleFile = await markedTestSampleFile(db, output.package_code);
  refuseOutputWorked(output.package_code, output.status, sampleFile, sampled);
  if (runId) {
    const marked = await markedUpload(db, "new_packages", runId);
    if (marked) throw refusal(400, { key: "The New Packages file {file} is marked uploaded.", vars: { file: marked.filename } });
  }
}

function voidWipStmts(
  db: D1Database,
  pkgId: string,
  itemId: string | null,
  actorId: string,
  ts: string
): D1PreparedStatement[] {
  const reason = SYSTEM_REASON.schedule_unfinish;
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE wip_packages SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actorId, ts, actorId, pkgId),
    insertLog(db, {
      record_table: "wip_packages",
      record_id: pkgId,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actorId,
      reason,
      changed_at: ts,
    }),
  ];
  if (itemId) {
    stmts.push(
      db
        .prepare(
          `UPDATE local_inventory_items SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actorId, reason, ts, actorId, itemId),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: itemId,
        field: "deleted_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actorId,
        reason,
        changed_at: ts,
      })
    );
  }
  return stmts;
}

async function unconsumeStmts(
  db: D1Database,
  input: { wip_package_id: string; package_code: string | null; weight_grams: number; status: string | null },
  actorId: string,
  ts: string
): Promise<D1PreparedStatement[]> {
  const code = input.package_code ?? input.wip_package_id;
  if (input.status !== WIP_STATUS.pasteurized) {
    throw refusal(400, { key: "The container {code} is {status}.", vars: { code, status: input.status ?? "gone" } });
  }
  const child = await wipChildItem(db, input.wip_package_id);
  if (!child) throw refusal(400, { key: "The container {code}'s ledger item was voided.", vars: { code } });
  if (roundGrams(Number(child.qty)) !== 0) {
    throw refusal(400, {
      key: "The container {code}'s ledger item is at {g} g.",
      vars: { code, g: String(roundGrams(Number(child.qty))) },
    });
  }
  const next = nextStatus("cryo_unconsumed", input.status);
  return [
    db
      .prepare(`UPDATE wip_packages SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(next, ts, actorId, input.wip_package_id),
    insertLog(db, {
      record_table: "wip_packages",
      record_id: input.wip_package_id,
      field: "status",
      old_value: input.status,
      new_value: next,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.schedule_unfinish,
      changed_at: ts,
    }),
    ...setItemQtyLocationStmts(db, child, { qty: roundGrams(Number(input.weight_grams)) }, actorId, ts, SYSTEM_REASON.schedule_unfinish),
  ];
}

/** THE UNFINISH (canon 0.30.220). One PIN-gated step back from Complete.
 * Every downstream record is read first. A worked one refuses by name and
 * nothing is written. On success one batch carries every statement. */
export async function unfinishScheduleItem(
  db: D1Database,
  stage: ScheduleStage,
  rowId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const row = await getScheduleRow(db, rowId);
  if (!row || row.stage !== stage) throw new HttpError(404, "Unknown schedule row.");
  if (row.status !== SCHEDULE_STATUS.complete) throw new HttpError(400, "That item is not complete.");
  await requireUnfinishPin(db, form, actor.id);
  const ts = nowIso();
  if (stage === SCHEDULE_STAGES.trim) return unfinishTrim(db, row, actor.id, ts);
  if (stage === SCHEDULE_STAGES.cryo) return unfinishCryoRun(db, row.id, actor.id, ts, true);
  return unfinishPrepack(db, row, actor.id, ts, form);
}

async function unfinishTrim(
  db: D1Database,
  row: { id: string; harvest_batch_id: string },
  actorId: string,
  ts: string
): Promise<ActionOk> {
  const batch = await db
    .prepare(`SELECT hbn FROM harvest_batches WHERE id = ?`)
    .bind(row.harvest_batch_id)
    .first<{ hbn: string }>();
  const hbn = batch?.hbn ?? row.harvest_batch_id;
  const runs = await db
    .prepare(
      `SELECT id, status FROM production_schedules
       WHERE harvest_batch_id = ? AND stage = ? AND deleted_at IS NULL AND wip_package_id IS NULL`
    )
    .bind(row.harvest_batch_id, SCHEDULE_STAGES.cryo)
    .all<{ id: string; status: string }>();
  const stmts: D1PreparedStatement[] = [...reopenScheduleStmts(db, row.id, actorId, ts)];
  let unscheduled = false;
  for (const run of runs.results ?? []) {
    if (run.status === SCHEDULE_STATUS.complete) {
      throw refusal(400, { key: "The run on {hbn} is finished; unfinish it first.", vars: { hbn } });
    }
    const counted = await db
      .prepare(`SELECT COUNT(*) AS n FROM wip_packages WHERE cryo_run_id = ? AND deleted_at IS NULL`)
      .bind(run.id)
      .first<{ n: number }>();
    const n = Number(counted?.n ?? 0);
    if (n > 0) {
      throw refusal(400, {
        key: "The run on {hbn} has {n} outputs entered; void them or unfinish the run first.",
        vars: { hbn, n: String(n) },
      });
    }
    if (run.status === SCHEDULE_STATUS.scheduled) {
      stmts.push(...softDeleteScheduleStmts(db, run.id, actorId, ts, SYSTEM_REASON.schedule_unfinish));
      unscheduled = true;
    }
  }
  await db.batch(stmts);
  const extra = unscheduled ? `&hbn=${encodeURIComponent(hbn)}` : "";
  return { redirect: scheduleRedirect(SCHEDULE_STAGES.trim, "unfinished", extra) };
}

async function unfinishCryoRun(
  db: D1Database,
  runId: string,
  actorId: string,
  ts: string,
  fromSchedule: boolean
): Promise<ActionOk> {
  const run = await getCryoRun(db, runId);
  if (!run) throw new HttpError(404, CRYO_REFUSAL.noRun);
  if (run.status !== SCHEDULE_STATUS.complete) throw new HttpError(400, "That item is not complete.");
  const marked = await markedUpload(db, "new_packages", run.id);
  if (marked) throw refusal(400, { key: "The New Packages file {file} is marked uploaded.", vars: { file: marked.filename } });
  const outputs = await listCryoRunOutputs(db, run.id);
  for (const output of outputs) {
    await assertOutputUntouched(db, output, null);
  }
  const inputs = await listCryoRunInputs(db, run.id);
  const stmts: D1PreparedStatement[] = [];
  let containers = 0;
  for (const input of inputs) {
    if (input.status !== WIP_STATUS.pasteurized) continue;
    stmts.push(...(await unconsumeStmts(db, input, actorId, ts)));
    containers += 1;
  }
  for (const output of outputs) {
    const child = await wipChildItem(db, output.id);
    if (!child) throw refusal(400, { key: "The output {tag}'s ledger item was voided.", vars: { tag: output.package_code } });
    stmts.push(...voidWipStmts(db, output.id, child.id, actorId, ts));
  }
  stmts.push(...reopenScheduleStmts(db, run.id, actorId, ts));
  await db.batch(stmts);
  const extra = `&n=${containers}&m=${outputs.length}`;
  if (!fromSchedule) {
    return { redirect: `${CRYO_STATION_PATH}?pick=${encodeURIComponent(run.id)}&ok=run_unfinished${extra}` };
  }
  return { redirect: scheduleRedirect(SCHEDULE_STAGES.cryo, "run_unfinished", extra) };
}

export async function unfinishCryoContainer(db: D1Database, runId: string, inputId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  await requireUnfinishPin(db, form, actor.id);
  const run = await getCryoRun(db, runId);
  if (!run) throw new HttpError(404, CRYO_REFUSAL.noRun);
  if (run.status === SCHEDULE_STATUS.scheduled) {
    throw refusal(400, { key: "That run is still working; Unschedule frees its containers.", vars: {} });
  }
  if (run.status !== SCHEDULE_STATUS.complete) throw new HttpError(400, "That item is not complete.");
  const marked = await markedUpload(db, "new_packages", run.id);
  if (marked) throw refusal(400, { key: "The New Packages file {file} is marked uploaded.", vars: { file: marked.filename } });
  const input = (await listCryoRunInputs(db, run.id)).find((row) => row.id === inputId);
  if (!input) throw new HttpError(404, "Unknown container.");
  const ts = nowIso();
  const stmts = await unconsumeStmts(db, input, actor.id, ts);
  stmts.push(
    db.prepare(`DELETE FROM cryo_run_inputs WHERE id = ?`).bind(input.id),
    insertLog(db, {
      record_table: "cryo_run_inputs",
      record_id: input.id,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.schedule_unfinish,
      changed_at: ts,
    })
  );
  await db.batch(stmts);
  const tag = input.package_code ?? input.wip_package_id;
  const grams = roundGrams(Number(input.weight_grams));
  return {
    redirect: `${CRYO_STATION_PATH}?pick=${encodeURIComponent(run.id)}&ok=container_unfinished&tag=${encodeURIComponent(tag)}&g=${grams}`,
  };
}

export async function unfinishCryoOutput(
  db: D1Database,
  outputId: string,
  form: FormData,
  redirectTo?: string
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  await requireUnfinishPin(db, form, actor.id);
  const output = await db
    .prepare(
      `SELECT id, package_code, status, weight_grams, cryo_run_id, source
       FROM wip_packages WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(outputId)
    .first<CryoOutputGuard & { source: string | null }>();
  if (!output || output.source !== WIP_SOURCE.cryo) throw new HttpError(404, "Unknown output.");
  await assertOutputUntouched(db, output, output.cryo_run_id);
  const child = await wipChildItem(db, output.id);
  if (!child) throw refusal(400, { key: "The output {tag}'s ledger item was voided.", vars: { tag: output.package_code } });
  const ts = nowIso();
  await db.batch(voidWipStmts(db, output.id, child.id, actor.id, ts));
  const grams = roundGrams(Number(output.weight_grams));
  if (redirectTo) return { redirect: redirectTo };
  const runId = output.cryo_run_id ?? "";
  return {
    redirect: `${CRYO_STATION_PATH}?pick=${encodeURIComponent(runId)}&ok=output_unfinished&tag=${encodeURIComponent(output.package_code)}&g=${grams}`,
  };
}

async function unfinishPrepack(
  db: D1Database,
  row: { id: string; wip_package_id: string | null },
  actorId: string,
  ts: string,
  form: FormData
): Promise<ActionOk> {
  const pkgId = row.wip_package_id;
  if (!pkgId) throw new HttpError(404, "Unknown package.");
  const finishFile = await markedUpload(db, "package_finish", row.id);
  if (finishFile) throw refusal(400, { key: "The file {file} is marked uploaded.", vars: { file: finishFile.filename } });
  const newFile = await markedUpload(db, "new_packages", row.id);
  if (newFile) throw refusal(400, { key: "The file {file} is marked uploaded.", vars: { file: newFile.filename } });
  const pkg = await db
    .prepare(`SELECT id, status, package_code FROM wip_packages WHERE id = ? AND deleted_at IS NULL`)
    .bind(pkgId)
    .first<{ id: string; status: string; package_code: string }>();
  if (!pkg) throw new HttpError(404, "Unknown package.");
  if (pkg.status !== WIP_STATUS.packed) {
    throw refusal(400, { key: "The parent {tag} is {status}.", vars: { tag: pkg.package_code, status: pkg.status } });
  }
  const parent = await wipChildItem(db, pkg.id);
  if (!parent) throw refusal(400, { key: "The parent {tag}'s ledger item was voided.", vars: { tag: pkg.package_code } });
  const logged = await db
    .prepare(
      `SELECT old_value FROM record_change_log
       WHERE record_table = 'local_inventory_items' AND record_id = ? AND field = 'qty'
         AND reason LIKE 'prepack finish%'
       ORDER BY changed_at DESC, rowid DESC LIMIT 1`
    )
    .bind(parent.id)
    .first<{ old_value: string | null }>();
  if (logged?.old_value == null || logged.old_value === "") {
    throw refusal(400, { key: "The finish did not record the parent's grams.", vars: {} });
  }
  const grams = roundGrams(Number(logged.old_value));
  const carry = await db
    .prepare(
      `SELECT id, grams, remaining, status FROM prepack_carries
       WHERE from_job_id = ? AND deleted_at IS NULL`
    )
    .bind(row.id)
    .first<{ id: string; grams: number; remaining: number; status: string }>();
  const stmts: D1PreparedStatement[] = [
    ...reopenScheduleStmts(db, row.id, actorId, ts),
    db.prepare(`UPDATE wip_packages SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(WIP_STATUS.released, ts, actorId, pkg.id),
    insertLog(db, {
      record_table: "wip_packages",
      record_id: pkg.id,
      field: "status",
      old_value: pkg.status,
      new_value: WIP_STATUS.released,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.schedule_unfinish,
      changed_at: ts,
    }),
    ...setItemQtyLocationStmts(db, parent, { qty: grams }, actorId, ts, SYSTEM_REASON.schedule_unfinish),
  ];
  if (carry) {
    const untouched = carry.status === "open" && roundGrams(Number(carry.remaining)) === roundGrams(Number(carry.grams));
    if (!untouched) {
      const drawn = await db
        .prepare(
          `SELECT pk.package_code FROM prepack_lines l
           JOIN production_schedules ps ON ps.id = l.job_id
           JOIN wip_packages pk ON pk.id = ps.wip_package_id
           WHERE l.carry_id = ? AND l.deleted_at IS NULL
           LIMIT 1`
        )
        .bind(carry.id)
        .first<{ package_code: string }>();
      throw refusal(400, {
        key: "The carry of {g} g was drawn by {job}; unfinish that job first.",
        vars: { g: String(roundGrams(Number(carry.grams))), job: drawn?.package_code ?? "another job" },
      });
    }
    stmts.push(
      db
        .prepare(`UPDATE prepack_carries SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
        .bind(ts, actorId, ts, actorId, carry.id),
      insertLog(db, {
        record_table: "prepack_carries",
        record_id: carry.id,
        field: "deleted_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actorId,
        reason: SYSTEM_REASON.schedule_unfinish,
        changed_at: ts,
      })
    );
  }
  try {
    nextStatus("prepack_unpacked", pkg.status);
  } catch (err) {
    throw err;
  }
  await db.batch(stmts);
  const tag = parent ? (await db.prepare(`SELECT metrc_tag FROM local_inventory_items WHERE id = ?`).bind(parent.id).first<{ metrc_tag: string | null }>()) : null;
  const shown = tag?.metrc_tag || pkg.package_code;
  return { redirect: prepackRedirect("pack_unfinished", form, `&tag=${encodeURIComponent(shown)}&g=${grams}`) };
}

/* ------------------------------------------------------------ THE CRYO RUN */

async function requireScheduledCryoRun(db: D1Database, runId: string) {
  const run = await getCryoRun(db, runId);
  if (!run) throw new HttpError(404, CRYO_REFUSAL.noRun);
  if (run.status === SCHEDULE_STATUS.complete) throw new HttpError(400, CRYO_REFUSAL.finished);
  if (run.status !== SCHEDULE_STATUS.scheduled) throw new HttpError(400, CRYO_REFUSAL.notScheduled);
  return run;
}

/** THE CRYO RUN (canon 0.30.110; owner: "They scan a tag that attaches to the
 * weight and that weight is consumed from the sum of weight stored in the
 * HBN"): one line at Cryo Weight Entry is a new container. The tag is a true
 * METRC package ID (1A plus 22 hex, refused otherwise: this IS the METRC
 * package), the type one of the run's pool, the weight its grams. It is born
 * straight into the Testing queue (his pick) with the weight as its cryo
 * weight, the Effective Date as its cryo date and the typed operator; its
 * ledger row stands at Cryo Room under the processor license, beside the
 * harvest package it draws on in METRC. THE OVERISSUE LINE IS STRICT: a line
 * past the pool is flagged on the page, never refused here. */
export async function addCryoOutput(db: D1Database, runId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const run = await requireScheduledCryoRun(db, runId);
  const rawTag = String(form.get("package_code") ?? "").trim();
  if (!rawTag) throw new HttpError(400, CRYO_REFUSAL.tag);
  const tag = normalizeMetrcTag(rawTag);
  if (!tag || !isMetrcTag(tag)) throw new HttpError(400, CRYO_REFUSAL.tagShape);
  // THE CRYO CATEGORIES (canon 0.30.112; owner: "in cryo weight entry, add the
  // product categories: 1. WPR 2. BUD 3. SHA"): the line is entered under a
  // product category from the app_config list, stored as the package's type
  // code; it draws from the pool as a whole, so no pool-type check remains.
  const typeCode = String(form.get("package_type_code") ?? "").trim().toUpperCase();
  if (!typeCode) throw new HttpError(400, CRYO_REFUSAL.category);
  const categories = await listCryoCategories(db);
  if (!categories.includes(typeCode)) throw new HttpError(400, CRYO_REFUSAL.categoryOutsideList);
  const grams = roundGrams(Number(String(form.get("weight_grams") ?? "").trim()));
  if (!Number.isFinite(grams) || grams <= 0) throw new HttpError(400, CRYO_REFUSAL.weight);
  const operator = String(form.get("cryo_operator") ?? "").trim();
  if (!operator) throw new HttpError(400, CRYO_REFUSAL.operator);
  const taken = await db
    .prepare(
      `SELECT id FROM wip_packages WHERE deleted_at IS NULL AND UPPER(package_code) = ?
       UNION ALL
       SELECT id FROM local_inventory_items WHERE deleted_at IS NULL AND metrc_tag = ?`
    )
    .bind(tag, tag)
    .first<{ id: string }>();
  if (taken) throw new HttpError(400, CRYO_REFUSAL.tagTaken);
  const ts = nowIso();
  const effective = await resolveEffectiveDate(db, form, ts);
  const inputs = await listCryoRunInputs(db, runId);
  const lotId = inputs.find((i) => i.wet_weight_entry_id)?.wet_weight_entry_id ?? null;
  if (!lotId) throw new HttpError(400, "The run has no containers to draw on.");
  const batch = await db
    .prepare(`SELECT strain_id FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`)
    .bind(run.harvest_batch_id)
    .first<{ strain_id: string | null }>();
  const id = crypto.randomUUID();
  const record = {
    id,
    wet_weight_entry_id: lotId,
    harvest_batch_id: run.harvest_batch_id,
    package_code: tag,
    package_type_code: typeCode,
    weight_grams: grams,
    cryo_weight_grams: grams,
    status: WIP_STATUS.testing_queue,
    cryo_date: effective.date,
    cryo_operator: operator,
    cryo_run_id: runId,
    source: WIP_SOURCE.cryo,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO wip_packages (
          id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams,
          cryo_weight_grams, status, test_outcome, trim_date, trim_operator, cryo_date, cryo_operator,
          cryo_run_id, source,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, lotId, run.harvest_batch_id, tag, typeCode, grams, grams, WIP_STATUS.testing_queue, effective.date, operator, runId, WIP_SOURCE.cryo, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "wip_packages", id, record, actor.id, SYSTEM_REASON.cryo_output, ts),
  ];
  if (effective.overridden) stmts.push(effectiveOverrideLog(db, "wip_packages", id, effective, actor.id, ts));
  const itemId = crypto.randomUUID();
  const item = {
    id: itemId,
    item_kind: ITEM_KIND_WIP,
    package_code: tag,
    metrc_tag: tag,
    harvest_batch_id: run.harvest_batch_id,
    wip_package_id: id,
    strain_id: batch?.strain_id ?? null,
    qty: grams,
    uom: "g",
    farm_code: LANDING_FARM,
    license_value: LICENSE_AU_PROCESSOR,
    location: LOC_CRYO_ROOM,
    created_at: ts,
    created_by: actor.id,
  };
  stmts.push(
    db
      .prepare(
        `INSERT INTO local_inventory_items (
          id, item_kind, package_code, metrc_tag, harvest_batch_id, wet_weight_entry_id, wip_package_id,
          strain_id, qty, uom, farm_code, license_value, location,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'g', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(itemId, ITEM_KIND_WIP, tag, tag, run.harvest_batch_id, id, batch?.strain_id ?? null, grams, LANDING_FARM, LICENSE_AU_PROCESSOR, LOC_CRYO_ROOM, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "local_inventory_items", itemId, item, actor.id, SYSTEM_REASON.cryo_output, ts)
  );
  await db.batch(stmts);
  return { redirect: `${CRYO_STATION_PATH}?pick=${encodeURIComponent(runId)}&ok=plus` };
}

/** THE CRYO RUN (canon 0.30.110; owner: "The containers made in trim are
 * archival but no longer relevant to the process once they've been added to
 * true METRC package IDs in cryo"): Finish run consumes the trim containers
 * the run took in (cryo_queue to pasteurized, their ledger grams to zero with
 * the reason) and completes the run; the outputs already stand in Testing. It
 * needs at least one output, or the material would vanish into nothing. */
export async function finishCryoRun(db: D1Database, runId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const run = await requireScheduledCryoRun(db, runId);
  const outputs = await listCryoRunOutputs(db, runId);
  if (outputs.length === 0) throw new HttpError(400, CRYO_REFUSAL.noOutputs);
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const input of await listCryoRunInputs(db, runId)) {
    if (input.status !== WIP_STATUS.cryo_queue) continue;
    const next = nextStatus("cryo_consumed", input.status);
    stmts.push(
      db
        .prepare(`UPDATE wip_packages SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
        .bind(next, ts, actor.id, input.wip_package_id),
      insertLog(db, {
        record_table: "wip_packages",
        record_id: input.wip_package_id,
        field: "status",
        old_value: input.status,
        new_value: next,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.cryo_consumed,
        changed_at: ts,
      })
    );
    const child = await wipChildItem(db, input.wip_package_id);
    if (child) stmts.push(...setItemQtyLocationStmts(db, child, { qty: 0 }, actor.id, ts, SYSTEM_REASON.cryo_consumed));
  }
  stmts.push(...completeScheduleStmts(db, run.id, actor.id, ts));
  await db.batch(stmts);
  return { redirect: `${CRYO_STATION_PATH}?pick=${encodeURIComponent(runId)}&ok=finished` };
}

/** The New Packages file for a run, in the owner's T3 autofill template: one
 * line per output (Tag Number the scanned tag, Location Name Cryo Room, Same
 * Item yes, Quantity in Grams, Actual Date the line's cryo date) and, as the
 * ingredient, the HBN's harvest package tag with the output's weight, each
 * lot's package carrying the grams its containers put into the run (owner:
 * "The HBN continues to be important to the background data for METRC"). */
export async function buildNewPackagesXlsx(
  db: D1Database,
  runId: string
): Promise<{ bytes: Uint8Array; filename: string; harvest_batch_id: string }> {
  const run = await getCryoRun(db, runId);
  if (!run) throw new HttpError(404, CRYO_REFUSAL.noRun);
  const outputs = [...(await listCryoRunOutputs(db, runId))].reverse();
  const inputs = await listCryoRunInputs(db, runId);
  const packages = await listHbnHarvestPackages(db, run.harvest_batch_id);
  const sources = packages.map((pkg) => ({
    label: metrcFacingTag({ metrc_tag: pkg.metrc_tag, package_code: pkg.package_code }),
    capacity: sumGrams(inputs.filter((i) => i.wet_weight_entry_id === pkg.wet_weight_entry_id).map((i) => Number(i.weight_grams))),
  }));
  const allocation = allocateIngredients(
    outputs.map((o) => ({ id: o.id, grams: Number(o.weight_grams) })),
    sources
  );
  const lines: NewPackagesLine[] = outputs.map((o) => ({
    tag: o.package_code,
    quantity: Number(o.weight_grams),
    actualDate: o.cryo_date ?? o.created_at.slice(0, 10),
    ingredients: allocation.get(o.id) ?? [],
  }));
  return { bytes: buildXlsx(newPackagesSheet(lines)), filename: newPackagesFilename(run.hbn), harvest_batch_id: run.harvest_batch_id };
}

export async function runQueueControl(
  db: D1Database,
  control: string,
  form: FormData,
  // Owner ruling 2026-09-02: [Demote] is queue-generic, so the route passes the
  // queue's entity; the named controls above it stay self-contained.
  queueEntity?: string
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const id = requireText(form.get("id"), "Record");
  const ts = nowIso();
  if (control === "mark_complete") {
    const row = await db
      .prepare(`SELECT id, status FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`)
      .bind(id)
      .first<{ id: string; status: string }>();
    if (!row) throw new HttpError(404, "Unknown batch.");
    const next = nextStatus("harvest_complete", row.status);
    await db.batch([
      db
        .prepare(
          `UPDATE harvest_batches SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(next, ts, actor.id, id),
      insertLog(db, {
        record_table: "harvest_batches",
        record_id: id,
        field: "status",
        old_value: row.status,
        new_value: next,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.queue_control,
        changed_at: ts,
      }),
    ]);
    return { redirect: "/queue/hbn_queue?ok=complete" };
  }
  if (control === "mark_trimmed") {
    const row = await db
      .prepare(`SELECT id, status FROM wet_weight_entries WHERE id = ? AND deleted_at IS NULL`)
      .bind(id)
      .first<{ id: string; status: string }>();
    if (!row) throw new HttpError(404, "Unknown lot.");
    // Owner ruling 2026-08-31: the Dry Space Queue keeps its manual exit (drying
    // to trimmed); the Unloaded Queue's control trims through lot_trimmed_unloaded.
    const name: TransitionName =
      row.status === LOT_STATUS.unloaded ? "lot_trimmed_unloaded" : "lot_trimmed";
    const next = nextStatus(name, row.status);
    const stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `UPDATE wet_weight_entries SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(next, ts, actor.id, id),
      insertLog(db, {
        record_table: "wet_weight_entries",
        record_id: id,
        field: "status",
        old_value: row.status,
        new_value: next,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.queue_control,
        changed_at: ts,
      }),
    ];
    if (name === "lot_trimmed_unloaded") {
      stmts.push(...(await completeTrimScheduleForLot(db, id, actor.id, ts)));
    }
    await db.batch(stmts);
    return {
      redirect:
        name === "lot_trimmed_unloaded"
          ? "/queue/unloaded_queue?ok=trimmed"
          : "/queue/dry_space_queue?ok=trimmed",
    };
  }
  if (control === "release") {
    const outcome = requireText(form.get("outcome"), "Outcome");
    if (!isTestOutcome(outcome)) throw new HttpError(400, "Unknown outcome.");
    const note = textOrNull(form.get("note"));
    const reason = note ? `${SYSTEM_REASON.release}: ${outcome}; note: ${note}` : `${SYSTEM_REASON.release}: ${outcome}`;
    const row = await db
      .prepare(
        `SELECT id, status, test_outcome FROM wip_packages WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(id)
      .first<{ id: string; status: string; test_outcome: string | null }>();
    if (!row) throw new HttpError(404, "Unknown package.");
    const next = nextStatus("released", row.status);
    await db.batch([
      db
        .prepare(
          `UPDATE wip_packages SET status = ?, test_outcome = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(next, outcome, ts, actor.id, id),
      insertLog(db, {
        record_table: "wip_packages",
        record_id: id,
        field: "status",
        old_value: row.status,
        new_value: next,
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
      insertLog(db, {
        record_table: "wip_packages",
        record_id: id,
        field: "test_outcome",
        old_value: row.test_outcome,
        new_value: outcome,
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
    ]);
    return { redirect: "/queue/testing_queue?ok=released" };
  }
  // Owner ruling 2026-09-02, verbatim: "Add a [Demote] button on the data
  // queues menu for each record. Clicking it prompts the user with a warning
  // and kicks the record back down to the last process it was at." The step is
  // the transition graph inverted (demoteStep); the client confirm carries the
  // warning; the step itself logs reasoned like every state change. trimmed's
  // two possible sources resolve from the record's own status history (its
  // demote rows excluded so repeated demotes walk down, never bounce),
  // defaulting to unloaded, the standard flow since 2026-08-31.
  if (control === "demote") {
    const entity = queueEntity ?? "";
    if (!DEMOTABLE_ENTITIES.has(entity)) {
      throw new HttpError(400, "Demote is not available on this queue.");
    }
    // THE UNFINISH (canon 0.30.220): a cryo-born output never came from the Cryo Queue.
    // Demote on the Testing Queue voids it, PIN-gated, the same act as on its run.
    if (entity === "wip_packages") {
      const born = await db
        .prepare(`SELECT source, package_code, weight_grams FROM wip_packages WHERE id = ? AND deleted_at IS NULL`)
        .bind(id)
        .first<{ source: string | null; package_code: string; weight_grams: number }>();
      if (born?.source === WIP_SOURCE.cryo) {
        const grams = roundGrams(Number(born.weight_grams));
        return unfinishCryoOutput(
          db,
          id,
          form,
          `/admin/queues?ok=output_unfinished&tag=${encodeURIComponent(born.package_code)}&g=${grams}`
        );
      }
    }
    const row = await db
      .prepare(`SELECT id, status FROM ${entity} WHERE id = ? AND deleted_at IS NULL`)
      .bind(id)
      .first<{ id: string; status: string }>();
    if (!row) throw new HttpError(404, "Unknown record.");
    const step = demoteStep(entity, row.status);
    if (!step) {
      throw new HttpError(400, "This record is at its first process; there is nothing to demote to.");
    }
    let target: string;
    if ("to" in step) {
      target = step.to;
    } else {
      const hist = await db
        .prepare(
          `SELECT old_value FROM record_change_log
           WHERE record_table = ? AND record_id = ? AND field = 'status'
             AND new_value = ? AND reason != ?
           ORDER BY changed_at DESC, rowid DESC LIMIT 1`
        )
        .bind(entity, id, row.status, SYSTEM_REASON.demoted)
        .first<{ old_value: string | null }>();
      target =
        hist?.old_value && step.candidates.includes(hist.old_value)
          ? hist.old_value
          : LOT_STATUS.unloaded;
    }
    const stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `UPDATE ${entity} SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(target, ts, actor.id, id),
      insertLog(db, {
        record_table: entity,
        record_id: id,
        field: "status",
        old_value: row.status,
        new_value: target,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.demoted,
        changed_at: ts,
      }),
    ];
    // THE IN-TRANSIT RULE (canon 0.30.320): drying back to weighing clears the
    // Finish Load YES close, so the HBN returns to the field select.
    // THE HBN ENTRY (canon 0.30.341): back on weighing the lot has no finish, so finished_at clears.
    if (entity === "wet_weight_entries" && target === LOT_STATUS.weighing) {
      stmts.push(
        db.prepare(`UPDATE wet_weight_entries SET finished_at = NULL WHERE id = ? AND deleted_at IS NULL`).bind(id)
      );
      const lot = await db
        .prepare(`SELECT harvest_batch_id FROM wet_weight_entries WHERE id = ? AND deleted_at IS NULL`)
        .bind(id)
        .first<{ harvest_batch_id: string }>();
      const batch = lot
        ? await db
            .prepare(
              `SELECT field_closed_at, field_closed_by FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`
            )
            .bind(lot.harvest_batch_id)
            .first<{ field_closed_at: string | null; field_closed_by: string | null }>()
        : null;
      if (lot && batch?.field_closed_at) {
        stmts.push(
          db
            .prepare(
              `UPDATE harvest_batches SET field_closed_at = NULL, field_closed_by = NULL, updated_at = ?, updated_by = ?
               WHERE id = ? AND deleted_at IS NULL`
            )
            .bind(ts, actor.id, lot.harvest_batch_id),
          insertLog(db, {
            record_table: "harvest_batches",
            record_id: lot.harvest_batch_id,
            field: "field_closed_at",
            old_value: batch.field_closed_at,
            new_value: null,
            actor_person_id: actor.id,
            reason: SYSTEM_REASON.demoted,
            changed_at: ts,
          }),
          insertLog(db, {
            record_table: "harvest_batches",
            record_id: lot.harvest_batch_id,
            field: "field_closed_by",
            old_value: batch.field_closed_by,
            new_value: null,
            actor_person_id: actor.id,
            reason: SYSTEM_REASON.demoted,
            changed_at: ts,
          })
        );
      }
    }
    await db.batch(stmts);
    return { redirect: "/admin/queues?ok=demoted" };
  }
  throw new HttpError(400, `Unknown control: ${control}`);
}

/** The tables [Demote] may touch; the entity name is interpolated into SQL, so
 * it passes through this allowlist first (the queue defs supply it). */
const DEMOTABLE_ENTITIES = new Set(["harvest_batches", "wet_weight_entries", "wip_packages"]);

/** Owner ruling 2026-08-31: [Pending Data Uploads]. Marking a file uploaded
 * records "this batch's file of this kind was marked uploaded at T" as a
 * metrc_uploads row; the pending law compares finished-lot activity against the
 * latest such row, so a later reasoned edit re-pends the file on purpose. The
 * filename stores as <HBN>.csv, the name the download serves. */
export async function markUploaded(
  db: D1Database,
  kind: MetrcUploadKind,
  batchId: string,
  form: FormData,
  refId: string | null = null
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  if (kind === "wet_weights") {
    const ts = nowIso();
    await db.batch(await planUploadMark(db, "wet_weights", batchId, actor.id, ts));
    return { redirect: "/admin/uploads?ok=upload_marked" };
  }
  // Owner bug report 2026-09-08 (canon 0.30.5): a mark is history keeping, so
  // it tolerates a batch voided between the page render and the click; the
  // pending list itself never shows voided rows (one predicate both sides).
  const batch = await db
    .prepare(`SELECT id, hbn FROM harvest_batches WHERE id = ?`)
    .bind(batchId)
    .first<{ id: string; hbn: string }>();
  if (!batch) throw new HttpError(404, "Unknown batch.");
  const id = crypto.randomUUID();
  const ts = nowIso();
  const seqRow = refId
    ? await db
        .prepare(
          `SELECT ${HARVEST_FILE_SEQ_SQL} AS seq FROM wet_weight_entries w
           WHERE w.id = ?
              OR w.id = (SELECT wet_weight_entry_id FROM unload_sessions WHERE id = ?)
              OR w.id = (SELECT wet_weight_entry_id FROM silo_loads WHERE id = ?)
           LIMIT 1`
        )
        .bind(refId, refId, refId)
        .first<{ seq: number | null }>()
    : null;
  const named = seqRow ? hbnWithSeq(batch.hbn, seqRow.seq) : batch.hbn;
  const filename =
    kind === "package_from_harvest"
        ? `packages_from_harvests_${named}.csv`
        : kind === "receive_manifest"
          ? `receive_manifest_${batch.hbn}.csv`
        : kind === "package_finish"
          ? `package_finish_${batch.hbn}.csv`
        : kind === "location_change" && refId
          ? (await locationChangeUploadCsv(db, refId)).filename
        : kind === "location_change"
          ? `location_change_${named}.csv`
        : kind === "new_packages"
          ? newPackagesFilename(batch.hbn)
        : kind === "test_sample"
          ? `test_sample_${batch.hbn}.csv`
        : `package_adjustments_${named}.csv`;
  const record = {
    id,
    kind,
    harvest_batch_id: batchId,
    filename,
    uploaded_at: ts,
    ref_id: refId,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO metrc_uploads (
          id, kind, harvest_batch_id, filename, uploaded_at, ref_id,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, kind, batchId, filename, ts, refId, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "metrc_uploads", id, record, actor.id, SYSTEM_REASON.upload_marked, ts),
  ]);
  return { redirect: "/admin/uploads?ok=upload_marked" };
}

function uploadMarkStmts(
  db: D1Database,
  actorId: string,
  ts: string,
  row: {
    kind: string;
    batchId: string;
    filename: string;
    refId: string | null;
    fileWetGrams?: number | null;
    filePlantCount?: number | null;
  }
): D1PreparedStatement[] {
  const id = crypto.randomUUID();
  const record = {
    id,
    kind: row.kind,
    harvest_batch_id: row.batchId,
    filename: row.filename,
    uploaded_at: ts,
    ref_id: row.refId,
    file_wet_grams: row.fileWetGrams ?? null,
    file_plant_count: row.filePlantCount ?? null,
    created_at: ts,
    created_by: actorId,
    updated_at: ts,
    updated_by: actorId,
  };
  return [
    db
      .prepare(
        `INSERT INTO metrc_uploads (
          id, kind, harvest_batch_id, filename, uploaded_at, ref_id, file_wet_grams, file_plant_count,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(
        id,
        row.kind,
        row.batchId,
        row.filename,
        ts,
        row.refId,
        row.fileWetGrams ?? null,
        row.filePlantCount ?? null,
        ts,
        actorId,
        ts,
        actorId
      ),
    ...logsForInsert(db, "metrc_uploads", id, record, actorId, SYSTEM_REASON.upload_marked, ts),
  ];
}

/** The same resolution POST /admin/uploads/:kind/:id/uploaded uses, as statements, not a write. */
async function planUploadMark(db: D1Database, kind: string, id: string, actorId: string, ts: string): Promise<D1PreparedStatement[]> {
  const actorForm = new FormData();
  actorForm.set("person_id", actorId);
  if (kind === "test_sample") {
    const built = await buildTestSampleCsv(db, id);
    return uploadMarkStmts(db, actorId, ts, { kind: METRC_UPLOAD_KINDS.test_sample, batchId: built.harvest_batch_id, filename: built.filename, refId: id });
  }
  if (kind === "new_packages" || kind === "package_finish") {
    const job = await getScheduleRow(db, id);
    if (job?.stage === "prepack") {
      const built = kind === "package_finish" ? await buildPrepackFinishCsv(db, id) : await buildPrepackNewPackages(db, id);
      return uploadMarkStmts(db, actorId, ts, {
        kind: kind === "package_finish" ? METRC_UPLOAD_KINDS.package_finish : METRC_UPLOAD_KINDS.new_packages,
        batchId: built.harvest_batch_id,
        filename: built.filename,
        refId: id,
      });
    }
    if (kind === "package_finish") throw new HttpError(404, "Unknown file.");
    const run = await getCryoRun(db, id);
    if (!run) throw new HttpError(404, "Unknown file.");
    const built = await buildNewPackagesXlsx(db, id);
    return uploadMarkStmts(db, actorId, ts, { kind: METRC_UPLOAD_KINDS.new_packages, batchId: run.harvest_batch_id, filename: built.filename, refId: id });
  }
  if (kind === "manifest") {
    const built = await buildManifestCsv(db, id);
    const batchRow = await db
      .prepare(
        `SELECT i.harvest_batch_id FROM interco_movement_items mi
         JOIN local_inventory_items i ON i.id = mi.local_inventory_item_id
         WHERE mi.movement_id = ? AND mi.deleted_at IS NULL AND i.harvest_batch_id IS NOT NULL
         LIMIT 1`
      )
      .bind(id)
      .first<{ harvest_batch_id: string }>();
    return uploadMarkStmts(db, actorId, ts, { kind: "manifest", batchId: batchRow?.harvest_batch_id ?? id, filename: built.filename, refId: id });
  }
  if (kind === "receive_manifest") {
    const file = await buildReceiveCsv(db, id);
    return uploadMarkStmts(db, actorId, ts, { kind: "receive_manifest", batchId: file.harvest_batch_id, filename: file.filename, refId: id });
  }
  if (kind === "package_split") {
    const parent = await getRow(db, "local_inventory_items", id);
    if (!parent || parent.deleted_at) throw new HttpError(404, "Unknown inventory item.");
    const { filename } = await buildSplitCsv(db, id);
    const harvestBatchId = parent.harvest_batch_id == null ? id : String(parent.harvest_batch_id);
    return uploadMarkStmts(db, actorId, ts, { kind: "package_split", batchId: harvestBatchId, filename, refId: id });
  }
  if (kind === "location_move") {
    const built = await locationMoveCsv(db, id);
    return uploadMarkStmts(db, actorId, ts, { kind: "location_move", batchId: id, filename: built.filename, refId: id });
  }
  if (kind === "location_change") {
    const built = await locationChangeUploadCsv(db, id);
    return uploadMarkStmts(db, actorId, ts, { kind: METRC_UPLOAD_KINDS.location_change, batchId: built.harvest_batch_id, filename: built.filename, refId: id });
  }
  if (kind === "wet_weights") {
    const load = await getHarvestLoad(db, id);
    if (!load) throw new HttpError(404, "Unknown load.");
    return uploadMarkStmts(db, actorId, ts, {
      kind: METRC_UPLOAD_KINDS.wet_weights,
      batchId: load.harvest_batch_id,
      filename: wetWeightsFilename(load.hbn, load.seq),
      refId: load.id,
      fileWetGrams: load.weight_grams,
      filePlantCount: load.plant_count,
    });
  }
  if (kind !== "package_from_harvest" && kind !== "package_adjust") throw new HttpError(404, "Unknown file.");
  const built = await packageUploadCsv(db, kind, id);
  return uploadMarkStmts(db, actorId, ts, {
    kind: kind === "package_from_harvest" ? METRC_UPLOAD_KINDS.package_from_harvest : METRC_UPLOAD_KINDS.package_adjust,
    batchId: built.harvest_batch_id,
    filename: built.filename,
    refId: id,
  });
}

/** THE CHECK-ALL (canon 0.30.212): mark the checked files uploaded. Same resolution as each row's own post. Never cleared. */
export async function markCheckedUploaded(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const items = checkedIds(form, "item");
  if (items.length === 0) throw refusal(400, { key: "Nothing checked.", vars: {} });
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const item of items) {
    const cut = item.indexOf(":");
    const kind = cut < 0 ? "" : item.slice(0, cut);
    const id = cut < 0 ? "" : item.slice(cut + 1);
    if (!kind || !id) throw refusal(400, { key: "{row} was not marked uploaded: {why}", vars: { row: item, why: "Unknown file." } });
    try {
      stmts.push(...(await planUploadMark(db, kind, id, actor.id, ts)));
    } catch (err) {
      const words = err instanceof HttpError ? err.message : "Unknown file.";
      throw refusal(err instanceof HttpError ? err.status : 400, { key: "{row} was not marked uploaded: {why}", vars: { row: item, why: words } });
    }
  }
  const size = 80;
  for (let i = 0; i < stmts.length; i += size) await db.batch(stmts.slice(i, i + size));
  return { redirect: `/admin/uploads?ok=uploaded&n=${items.length}` };
}

/** THE PENDING QUEUE CLEAR (owner ruling 2026-09-16, canon 0.30.96, verbatim:
 * "CAN WE REMOVE ALL THE DOCS that are parked on pending data uploads?"). His
 * pick (AskUserQuestion): cleared, NOT uploaded to METRC, and a reusable
 * button. Every pending file across the export home's seven lists gets a
 * metrc_uploads row marked cleared = 1, which disposes it from the pending
 * queue exactly as an upload mark would (the pending predicates read any
 * metrc_uploads row of the file's kind and ref), but the row and its change-log
 * reason say it was cleared, never sent. No CSV is built (the bounded Worker
 * room, canon 0.30.42): a cleared row needs only the file's kind, its batch and
 * its ref, which the pending lists already carry. A time-based kind (wet
 * weights, splits) re-pends on new activity as ever; an existence kind stays
 * cleared until the row is voided, the same as a real upload mark. */
export async function clearAllUploads(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const ts = nowIso();
  type ClearItem = { kind: string; batch: string; ref: string | null; name: string };
  const items: ClearItem[] = [];
  for (const r of await listPendingUploads(db)) items.push({ kind: METRC_UPLOAD_KINDS.wet_weights, batch: r.harvest_batch_id, ref: r.id, name: wetWeightsFilename(r.hbn, r.seq) });
  for (const r of await listPendingPackageUploads(db)) items.push({ kind: r.kind, batch: r.harvest_batch_id, ref: r.id, name: r.hbn });
  for (const r of await listPendingReceiveUploads(db)) items.push({ kind: METRC_UPLOAD_KINDS.receive_manifest, batch: r.harvest_batch_id, ref: r.id, name: r.harvest_batch_id });
  for (const r of await listPendingManifestUploads(db)) items.push({ kind: "manifest", batch: r.id, ref: r.id, name: r.metrc_manifest_number ?? r.id });
  for (const r of await listPendingSplitUploads(db)) items.push({ kind: METRC_UPLOAD_KINDS.package_split, batch: r.harvest_batch_id, ref: r.id, name: r.parent_code });
  for (const r of await listPendingLocationChangeUploads(db)) items.push({ kind: METRC_UPLOAD_KINDS.location_change, batch: r.harvest_batch_id, ref: r.id, name: r.hbn ?? r.id });
  for (const r of await listPendingLocationMoves(db)) items.push({ kind: METRC_UPLOAD_KINDS.location_move, batch: r.group_id, ref: r.group_id, name: r.to_location });
  // THE CRYO RUN (canon 0.30.110): the New Packages files clear with the rest.
  for (const r of await listPendingNewPackagesUploads(db)) items.push({ kind: METRC_UPLOAD_KINDS.new_packages, batch: r.harvest_batch_id, ref: r.id, name: r.hbn });
  for (const r of await listPendingTestSamples(db)) items.push({ kind: METRC_UPLOAD_KINDS.test_sample, batch: r.harvest_batch_id, ref: r.id, name: r.hbn });
  if (items.length === 0) return { redirect: "/admin/uploads?ok=cleared&n=0" };
  const stmts: D1PreparedStatement[] = [];
  for (const it of items) {
    const id = crypto.randomUUID();
    const filename = `cleared_${it.kind}_${String(it.name ?? it.ref ?? it.batch).replace(/[^A-Za-z0-9._-]+/g, "_")}.csv`;
    const record = {
      id,
      kind: it.kind,
      harvest_batch_id: it.batch,
      filename,
      uploaded_at: ts,
      ref_id: it.ref,
      cleared: 1,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO metrc_uploads (
            id, kind, harvest_batch_id, filename, uploaded_at, ref_id, cleared,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(id, it.kind, it.batch, filename, ts, it.ref, ts, actor.id, ts, actor.id),
      ...logsForInsert(db, "metrc_uploads", id, record, actor.id, SYSTEM_REASON.upload_cleared, ts)
    );
  }
  await db.batch(stmts);
  return { redirect: `/admin/uploads?ok=cleared&n=${items.length}` };
}

/** Owner ruling 2026-08-31: the Plant fill rule; one pasted tag per line.
 * Lines trim, blanks drop, and duplicates dedupe case-sensitive as pasted,
 * first occurrence winning the order. */
export function parsePlantTags(raw: unknown): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const tag = line.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/** Owner ruling 2026-08-31: the Plant fill rule; saving tags REPLACES the
 * batch's whole set: the current non-voided tags soft-delete and the pasted
 * set inserts, all in one db.batch with audit logs (dedupe is enforced here,
 * the table's index is plain). An empty paste clears the set, returning the
 * file to one row per scale read. */
export async function savePlantTags(
  db: D1Database,
  loadId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const load = await getHarvestLoad(db, loadId);
  if (!load) throw new HttpError(404, "Unknown load.");
  const marked = await db
    .prepare(
      `SELECT 1 AS n FROM metrc_uploads WHERE ref_id = ? AND kind = 'wet_weights' AND deleted_at IS NULL LIMIT 1`
    )
    .bind(loadId)
    .first<{ n: number }>();
  if (marked) throw new HttpError(400, "That file is marked uploaded. Its tags are closed.");
  const tags = parsePlantTags(form.get("plant_tags"));
  const held = await db
    .prepare(
      `SELECT t.tag, b.hbn, ${HARVEST_FILE_SEQ_SQL} AS seq
       FROM harvest_plant_tags t
       JOIN wet_weight_entries w ON w.id = t.wet_weight_entry_id AND w.deleted_at IS NULL
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       WHERE t.deleted_at IS NULL AND t.wet_weight_entry_id <> ?`
    )
    .bind(loadId)
    .all<{ tag: string; hbn: string; seq: number | null }>();
  const byTag = new Map((held.results ?? []).map((row) => [row.tag, row]));
  for (const tag of tags) {
    const other = byTag.get(tag);
    if (other) {
      throw new HttpError(400, `That tag is already on ${wetWeightsFilename(other.hbn, Number(other.seq))}.`);
    }
  }
  const batchId = load.harvest_batch_id;
  const loose = await db
    .prepare(
      `SELECT id, tag FROM harvest_plant_tags
       WHERE harvest_batch_id = ? AND deleted_at IS NULL AND wet_weight_entry_id IS NULL
       ORDER BY created_at, id`
    )
    .bind(batchId)
    .all<{ id: string; tag: string }>();
  const looseByTag = new Map<string, string[]>();
  for (const row of loose.results ?? []) {
    const ids = looseByTag.get(row.tag) ?? [];
    ids.push(row.id);
    looseByTag.set(row.tag, ids);
  }
  const existing = await db
    .prepare(
      `SELECT id FROM harvest_plant_tags WHERE wet_weight_entry_id = ? AND deleted_at IS NULL`
    )
    .bind(loadId)
    .all<{ id: string }>();
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const row of existing.results ?? []) {
    stmts.push(
      db
        .prepare(
          `UPDATE harvest_plant_tags SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, ts, actor.id, row.id),
      insertLog(db, {
        record_table: "harvest_plant_tags",
        record_id: row.id,
        field: "deleted_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.tags_replaced,
        changed_at: ts,
      })
    );
  }
  for (const tag of tags) {
    const claimed = looseByTag.get(tag) ?? [];
    if (claimed.length > 0) {
      const [keep, ...rest] = claimed;
      stmts.push(
        db
          .prepare(
            `UPDATE harvest_plant_tags SET wet_weight_entry_id = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(loadId, ts, actor.id, keep),
        insertLog(db, {
          record_table: "harvest_plant_tags",
          record_id: keep,
          field: "wet_weight_entry_id",
          old_value: null,
          new_value: loadId,
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.tags_replaced,
          changed_at: ts,
        })
      );
      for (const extra of rest) {
        stmts.push(
          db
            .prepare(
              `UPDATE harvest_plant_tags SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
            )
            .bind(ts, actor.id, ts, actor.id, extra),
          insertLog(db, {
            record_table: "harvest_plant_tags",
            record_id: extra,
            field: "deleted_at",
            old_value: null,
            new_value: ts,
            actor_person_id: actor.id,
            reason: SYSTEM_REASON.tags_replaced,
            changed_at: ts,
          })
        );
      }
      continue;
    }
    const id = crypto.randomUUID();
    const record = {
      id,
      harvest_batch_id: batchId,
      tag,
      wet_weight_entry_id: loadId,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO harvest_plant_tags (
            id, harvest_batch_id, tag, wet_weight_entry_id,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(id, batchId, tag, loadId, ts, actor.id, ts, actor.id),
      ...logsForInsert(db, "harvest_plant_tags", id, record, actor.id, SYSTEM_REASON.tags_replaced, ts)
    );
  }
  if (stmts.length > 0) await db.batch(stmts);
  return { redirect: "/admin/uploads?ok=tags_saved" };
}

/** A load changed after its file was marked. The new row is the baseline; no file is cut. */
export async function acknowledgeChangedUpload(db: D1Database, loadId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const load = await getHarvestLoad(db, loadId);
  if (!load) throw new HttpError(404, "Unknown load.");
  const ts = nowIso();
  const stmts = uploadMarkStmts(db, actor.id, ts, {
    kind: METRC_UPLOAD_KINDS.wet_weights,
    batchId: load.harvest_batch_id,
    filename: wetWeightsFilename(load.hbn, load.seq),
    refId: load.id,
    fileWetGrams: load.weight_grams,
    filePlantCount: load.plant_count,
  });
  stmts.push(
    insertLog(db, {
      record_table: "wet_weight_entries",
      record_id: loadId,
      field: "harvest_file_ack",
      old_value: null,
      new_value: `${load.weight_grams}|${load.plant_count ?? ""}`,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    })
  );
  await db.batch(stmts);
  return { redirect: "/admin/uploads?ok=change_acknowledged" };
}

/** Owner ruling 2026-09-01: recall a minted HBN that still has no weights.
 * Soft-deletes the batch with reason recalled (audited). Serials are never
 * reused (ADR-6); saving the restored form mints a NEW HBN. FLAGGED FOR THE
 * OWNER: this is the Scribe's reading of the mint law. */
export async function recallHarvestBatch(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const id = requireText(form.get("id"), "Record");
  const row = await db
    .prepare(
      `SELECT id, hbn, entry_date, farm_code, grow_method_code, strain_id, manicure,
              planned_dryspc, material_form, start_time, zone, rows_text, metrc_harvest_tag, status, born_from
       FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first<RecallableBatch & { status: string; born_from: string }>();
  if (!row) throw new HttpError(404, "Unknown batch.");
  if (row.status !== HARVEST_STATUS.open || row.born_from === HARVEST_BORN.metrc) {
    throw new HttpError(400, "That batch is not in the HBN Queue.");
  }
  const weights = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM wet_weight_entries
       WHERE harvest_batch_id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first<{ n: number }>();
  if (Number(weights?.n ?? 0) > 0) {
    throw new HttpError(400, "That HBN already has weights and cannot be recalled.");
  }
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE harvest_batches SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, ts, actor.id, id),
    insertLog(db, {
      record_table: "harvest_batches",
      record_id: id,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.recalled,
      changed_at: ts,
    }),
  ]);
  return { redirect: recallRedirectPath(recallPrefillFromBatch(row)) };
}

export const STATION_ACTIONS: Record<
  string,
  (db: D1Database, form: FormData) => Promise<ActionOk>
> = {
  create_harvest_batch: createHarvestBatch,
  create_wet_weight: createWetWeight,
  create_trim_packages: createTrimPackages,
};

// Owner ruling 2026-08-31: GRAM_FIELDS moved to config.ts, one list shared with
// the display formatter; the reasoned edit keeps parsing and normalizing by it.
const BOOL_FIELDS = new Set(["manicure", "is_bud", "is_active"]);

function tablePk(table: string): string {
  // Owner ruling 2026-09-01: app_config is keyed by its config key, riding the
  // same code-keyed record path as the code tables.
  if (table === "app_config") return "key";
  return table === "package_types" || table === "farms" || table === "grow_methods"
    ? "code"
    : "id";
}

/** Tables the reasoned void refuses outright. The change log is the audit
 * record itself. Owner ruling 2026-09-01: app_config keys are standing
 * configuration, code-known and never added or voided in-app; a voided
 * admin_pin would unlock the site and a voided yield breaks the sheet. */
export function assertVoidableTable(table: string): void {
  if (table === "record_change_log") {
    throw new HttpError(400, "The change log cannot be voided.");
  }
  if (table === "app_config") {
    throw new HttpError(400, "App config keys are standing configuration and cannot be voided.");
  }
}

export async function editRecord(
  db: D1Database,
  table: string,
  id: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  assertTable(table);
  // Owner ruling 2026-08-31: the sentinel backs every truck lot's dry_space_id;
  // renaming or rekinding it would corrupt the record-borne truck law.
  if (table === "dry_spaces" && id === TRUCK_DRY_SPACE_ID) {
    throw new HttpError(400, "Truck is standing plumbing for truck lots and cannot be edited.");
  }
  const fields = EDITABLE_FIELDS[table];
  if (!fields) throw new HttpError(400, "This table is not editable.");
  // Owner ruling 2026-09-01: app_config values are standing configuration and
  // the column is NOT NULL; a blanked admin_pin would unlock the site, so a
  // blank edit refuses instead of writing NULL.
  if (table === "app_config" && textOrNull(form.get("value")) == null) {
    throw new HttpError(400, "Value is required.");
  }
  if (table === "harvest_batches") {
    optionalTime24(form.get("start_time"), "Start Time (24h)");
  }
  const pk = tablePk(table);
  const existing = await getRow(db, table, id);
  if (!existing || existing.deleted_at) throw new HttpError(404, "Record not found.");

  const sets: string[] = [];
  const values: unknown[] = [];
  const logs: D1PreparedStatement[] = [];
  const ts = nowIso();

  for (const field of fields) {
    let next: unknown;
    if (field.input === "checkbox") {
      next = checkbox01(form, field.name);
    } else if (GRAM_FIELDS.has(field.name)) {
      // The canon 0.30.9 boundary law applies to gram fields too (canon 0.30.84):
      // a gram field ABSENT from the posted form is UNCHANGED, never NULL (the
      // lot's weight_grams is NOT NULL and a partial post used to fail on it); a
      // present blank still clears where the column allows it.
      if (!form.has(field.name)) continue;
      const raw = textOrNull(form.get(field.name));
      next = raw == null ? null : parseGrams(form.get(field.name), field.label);
    } else if (table === "people" && field.name === "phone") {
      // THE PHONE LOGIN (canon 0.30.127): absent means unchanged (older forms);
      // a present blank clears; a value lands as +E.164 or is refused in words,
      // and a number another person carries is refused.
      if (!form.has(field.name)) continue;
      next = await phoneForPerson(db, form.get(field.name), id);
    } else if (table === "wet_weight_entries" && field.name === "plant_count") {
      // THE PLANT COUNT (canon 0.30.62): absent means unchanged (older forms);
      // a present blank clears to not given; a value is a whole number of one
      // or more.
      if (!form.has(field.name)) continue;
      next = parsePlantCount(form.get(field.name), field.label);
    } else if (table === "wet_weights" && field.name === "harvest_batch_id") {
      if (!form.has(field.name)) continue;
      const raw = textOrNull(form.get(field.name));
      if (raw == null) throw new HttpError(400, "Pick an HBN.");
      const parent = await db
        .prepare(
          `SELECT w.status, w.harvest_batch_id, b.farm_code
           FROM wet_weights t
           JOIN wet_weight_entries w ON w.id = t.wet_weight_entry_id
           JOIN harvest_batches b ON b.id = w.harvest_batch_id
           WHERE t.id = ? AND t.deleted_at IS NULL`
        )
        .bind(id)
        .first<{ status: string; harvest_batch_id: string; farm_code: string }>();
      if (!parent) throw new HttpError(404, "Record not found.");
      if (parent.status !== LOT_STATUS.weighing) {
        throw new HttpError(400, "Only a weighing lot's totes can change HBN; this lot has finished.");
      }
      const options = await listOpenFarmHbns(db, parent.farm_code, parent.harvest_batch_id);
      if (!options.some((row) => row.id === raw)) throw new HttpError(400, "That HBN is not on this lot's list.");
      next = raw;
    } else if (table === "wet_weight_entries" && field.name === "harvest_batch_id") {
      // THE HBN THAT CAME BACK (canon 0.30.84; his pick "HBN pencil on the lot"):
      // absent means unchanged (older forms); a present value must name an open
      // batch, and only a weighing lot may move, since Finish lot mints the born
      // package and pends the CSV against the HBN the lot had.
      if (!form.has(field.name)) continue;
      const raw = textOrNull(form.get(field.name));
      if (raw == null) throw new HttpError(400, "Pick an HBN.");
      if (raw !== String(existing.harvest_batch_id ?? "")) {
        if (existing.status !== LOT_STATUS.weighing) {
          throw new HttpError(400, "Only a weighing lot can move to another HBN; this lot has finished against its HBN.");
        }
        const target = await db
          .prepare(`SELECT status, born_from FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`)
          .bind(raw)
          .first<{ status: string; born_from: string }>();
        if (!target) throw new HttpError(404, "Unknown HBN.");
        if (target.status !== HARVEST_STATUS.open) throw new HttpError(400, "Pick an open HBN.");
        if (target.born_from === HARVEST_BORN.metrc) throw new HttpError(400, "That HBN was minted from METRC and takes no lot.");
      }
      if (raw !== String(existing.harvest_batch_id ?? "") && existing.harvest_file_seq != null) {
        const moved = await nextHarvestFileSeq(db, raw);
        sets.push("harvest_file_seq = ?");
        values.push(moved);
        logs.push(
          insertLog(db, {
            record_table: table,
            record_id: id,
            field: "harvest_file_seq",
            old_value: String(existing.harvest_file_seq),
            new_value: String(moved),
            actor_person_id: actor.id,
            reason,
            changed_at: ts,
          })
        );
      }
      next = raw;
    } else if (field.options) {
      // THE DRY SPACE TYPE (canon 0.30.106): a field with fixed options takes one
      // of them, in words; absent means unchanged; a blank clears only where the
      // field is optional. The type also sets the drawn shape it decides.
      if (!form.has(field.name)) continue;
      const raw = textOrNull(form.get(field.name));
      if (raw == null) {
        if (!field.optional) throw new HttpError(400, `${field.label} is required.`);
        next = null;
      } else {
        const hit = field.options.find((o) => o.value === raw);
        if (!hit) throw new HttpError(400, `${field.label} must be one of ${field.options.map((o) => o.label).join(", ")}.`);
        next = hit.value;
      }
      if (table === "dry_spaces" && field.name === "space_type" && next) {
        const shape = next === "freezer" ? "cube" : next === "dry_room" ? "box" : "cylinder";
        if (String(existing.shape ?? "") !== shape) {
          sets.push("shape = ?");
          values.push(shape);
          logs.push(
            insertLog(db, {
              record_table: table,
              record_id: id,
              field: "shape",
              old_value: existing.shape == null ? null : String(existing.shape),
              new_value: shape,
              actor_person_id: actor.id,
              reason,
              changed_at: ts,
            })
          );
        }
      }
    } else if (table === "dry_spaces" && field.name === "capacity") {
      if (!form.has(field.name)) continue;
      next = parseCapacity(form.get(field.name));
    } else if (field.farmTime) {
      // THE ZONELESS ZERO (canon 0.30.104; owner, 2026-09-16, of Silo 4's clock
      // four hours long: "Is this a me thing or a system thing?"): the clock's
      // zero is typed in farm time (Eastern, YYYY-MM-DD HH:MM) and lands as the
      // UTC instant; an instant carrying its zone is taken as it stands; any
      // other shape, a blank, or a time ahead of now refuses in words. Nothing
      // zoneless is ever stored again.
      if (!form.has(field.name)) continue;
      const raw = textOrNull(form.get(field.name));
      const short = field.label.replace(/\s*\(.*$/, "");
      if (raw == null) throw new HttpError(400, `${short} is required.`);
      const iso = farmInstantFromInput(raw);
      if (!iso) throw new HttpError(400, `${short} must be a farm-time date and time, YYYY-MM-DD HH:MM.`);
      if (Date.parse(iso) > Date.parse(ts) + 10 * 60 * 1000) throw new HttpError(400, `${short} is ahead of now.`);
      next = iso;
    } else if ((table === "wet_weight_entries" || table === "harvest_batches") && field.name === "material_form") {
      // Owner ruling 2026-09-07 (canon 0.29.1): the column is NOT NULL and
      // drives the receive mint, so a blank or absent field means UNCHANGED
      // (older floor forms predate the column and must keep editing across the
      // deploy boundary); a present value must be spear or bucked, in words.
      // THE HBN ENTRY (canon 0.30.341): the HBN's own form reads the same law.
      const raw = textOrNull(form.get(field.name));
      if (raw == null) continue;
      if (raw !== "spear" && raw !== "bucked") {
        throw new HttpError(400, "Pick Spear or Bucked.");
      }
      next = raw;
    } else {
      // Canon 0.30.9 boundary law, generalized from 0.29.1: a field ABSENT from
      // the posted form (an older form predating a column, the trim and cryo
      // dates and operators of 0036 first among them) means UNCHANGED; a
      // present blank still clears. Checkboxes keep their absent-is-off rule
      // above.
      if (!form.has(field.name)) continue;
      next = textOrNull(form.get(field.name));
    }
    const prev = existing[field.name];
    const prevNorm = normalize(prev, field.name);
    const nextNorm = normalize(next, field.name);
    if (prevNorm === nextNorm) continue;
    sets.push(`${field.name} = ?`);
    values.push(next);
    logs.push(
      insertLog(db, {
        record_table: table,
        record_id: id,
        field: field.name,
        old_value: prev == null ? null : String(prev),
        new_value: next == null ? null : String(next),
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      })
    );
  }
  if (sets.length === 0) throw new HttpError(400, "No fields changed.");
  sets.push("updated_at = ?", "updated_by = ?");
  values.push(ts, actor.id, id);
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE ${pk} = ? AND deleted_at IS NULL`)
      .bind(...values),
    ...logs,
  ];
  if (table === "wet_weight_entries" && sets.some((x) => x.startsWith("harvest_batch_id"))) {
    const nextHbn = textOrNull(form.get("harvest_batch_id"));
    const oldHbn = existing.harvest_batch_id == null ? null : String(existing.harvest_batch_id);
    if (nextHbn && oldHbn && nextHbn !== oldHbn) {
      const totes = await db
        .prepare(
          `SELECT id, harvest_batch_id FROM wet_weights
           WHERE wet_weight_entry_id = ? AND deleted_at IS NULL
             AND (harvest_batch_id IS NULL OR harvest_batch_id = ?)`
        )
        .bind(id, oldHbn)
        .all<{ id: string; harvest_batch_id: string | null }>();
      for (const tote of totes.results ?? []) {
        stmts.push(
          db.prepare(`UPDATE wet_weights SET harvest_batch_id = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(nextHbn, ts, actor.id, tote.id),
          insertLog(db, {
            record_table: "wet_weights",
            record_id: tote.id,
            field: "harvest_batch_id",
            old_value: tote.harvest_batch_id,
            new_value: nextHbn,
            actor_person_id: actor.id,
            reason,
            changed_at: ts,
          })
        );
      }
    }
  }
  const ledger = ledgerByTable(table);
  if (ledger) {
    // The parent lot's total column is the live total of its non-voided ledger
    // rows (owner rulings 2026-08-28 wet, 2026-08-31 dry).
    stmts.push(lotTotalRecomputeStmt(db, ledger, String(existing[ledger.parentField]), actor.id, ts));
  }
  // Owner ruling 2026-09-06 (canon 0.28.6): "We will do a location change when
  // it lands." The lot's space IS its minted item's location (the finish-mint
  // invariant), so a Move To edit carries the live ledger item along, same
  // reason, one stroke. Without this the floor would show the item at the barn
  // while the lot dries somewhere else.
  if (table === "wet_weight_entries" && sets.some((x) => x.startsWith("actual_dryspc"))) {
    const nextSpaceId = textOrNull(form.get("actual_dryspc"));
    if (nextSpaceId) {
      const space = await db
        .prepare(`SELECT name FROM dry_spaces WHERE id = ? AND deleted_at IS NULL`)
        .bind(nextSpaceId)
        .first<{ name: string }>();
      const item = await getInventoryItemForLot(db, id);
      if (space && item && item.location !== space.name) {
        stmts.push(
          db
            .prepare(
              `UPDATE local_inventory_items SET location = ?, updated_at = ?, updated_by = ?
               WHERE id = ? AND deleted_at IS NULL`
            )
            .bind(space.name, ts, actor.id, item.id),
          insertLog(db, {
            record_table: "local_inventory_items",
            record_id: item.id,
            field: "location",
            old_value: item.location ?? null,
            new_value: space.name,
            actor_person_id: actor.id,
            reason,
            changed_at: ts,
          })
        );
      }
    }
  }
  // Canon 0.30.26: the ledger follows the trim. A pencil on a trim package's
  // weight moves the difference between the lot's package and the child; a
  // cryo weight edit sets the child's grams (blank returns them to the trim
  // weight).
  if (table === "wip_packages") {
    const weightChanged = sets.some((x) => x.startsWith("weight_grams"));
    const cryoChanged = sets.some((x) => x.startsWith("cryo_weight_grams"));
    if (weightChanged || cryoChanged) {
      const oldWeight = roundGrams(Number(existing.weight_grams ?? 0));
      const newWeight = weightChanged ? roundGrams(Number(form.get("weight_grams"))) : oldWeight;
      const cryoRaw = cryoChanged ? textOrNull(form.get("cryo_weight_grams")) : existing.cryo_weight_grams;
      const cryo = cryoRaw == null || cryoRaw === "" ? null : roundGrams(Number(cryoRaw));
      const child = await wipChildItem(db, id);
      if (child) {
        const childQty = cryo != null ? cryo : newWeight;
        stmts.push(...setItemQtyLocationStmts(db, child, { qty: childQty }, actor.id, ts, SYSTEM_REASON.inv_trim_edit));
      }
      // THE CRYO RUN (canon 0.30.110): an output drew on the run's pool, not the
      // harvest package, so its weight edit moves nothing there.
      if (weightChanged && existing.wet_weight_entry_id && drawsFromParentLot(existing.source)) {
        const parent = await lotLedgerParent(db, String(existing.wet_weight_entry_id));
        if (parent) stmts.push(...parentDrawStmts(db, parent, newWeight - oldWeight, actor.id, ts, SYSTEM_REASON.inv_trim_edit));
      }
    }
    // THE TAG LAW (canon 0.30.38, fork F5: the trim room's code IS the METRC
    // package tag): a pencil on the code carries the child's code and tag along.
    if (sets.some((x) => x.startsWith("package_code"))) {
      const nextCode = String(textOrNull(form.get("package_code")) ?? "");
      const child = await wipChildItem(db, id);
      if (child && nextCode) {
        const nextTag = normalizeMetrcTag(nextCode);
        stmts.push(
          db
            .prepare(
              `UPDATE local_inventory_items SET package_code = ?, metrc_tag = ?, updated_at = ?, updated_by = ?
               WHERE id = ? AND deleted_at IS NULL`
            )
            .bind(nextCode, nextTag, ts, actor.id, child.id),
          insertLog(db, {
            record_table: "local_inventory_items",
            record_id: child.id,
            field: "package_code",
            old_value: String(existing.package_code ?? ""),
            new_value: nextCode,
            actor_person_id: actor.id,
            reason,
            changed_at: ts,
          }),
          insertLog(db, {
            record_table: "local_inventory_items",
            record_id: child.id,
            field: "metrc_tag",
            old_value: null,
            new_value: nextTag,
            actor_person_id: actor.id,
            reason,
            changed_at: ts,
          })
        );
      }
    }
  }
  await db.batch(stmts);
  const back = textOrNull(form.get("back"));
  if (back && back.startsWith("/") && !back.startsWith("//")) {
    return { redirect: back + (back.includes("?") ? "&" : "?") + "ok=saved" };
  }
  return { redirect: `/record/${table}/${id}/edit?ok=saved` };
}

function normalize(value: unknown, field: string): string {
  if (value == null || value === "") return "";
  if (BOOL_FIELDS.has(field)) return Number(value) === 1 ? "1" : "0";
  if (GRAM_FIELDS.has(field)) return String(roundGrams(Number(value)));
  return String(value);
}

async function planVoidRecord(
  db: D1Database,
  table: string,
  id: string,
  form: FormData
): Promise<D1PreparedStatement[]> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  assertTable(table);
  assertVoidableTable(table);
  // Owner ruling 2026-08-31: the sentinel backs every truck lot's dry_space_id.
  if (table === "dry_spaces" && id === TRUCK_DRY_SPACE_ID) {
    throw new HttpError(400, "Truck is standing plumbing for truck lots and cannot be voided.");
  }
  const pk = tablePk(table);
  const existing = await getRow(db, table, id);
  if (!existing) throw new HttpError(404, "Record not found.");
  if (existing.deleted_at) throw new HttpError(400, "Record is already voided.");
  const ts = nowIso();
  if (table === "lookup_values") {
    const value = String(existing.value ?? "");
    const category = String(existing.category ?? "");
    if (value === LOC_IN_TRANSIT) {
      throw new HttpError(400, "IN-TRANSIT cannot be voided.");
    }
    if (await lookupValueReferenced(db, category, value)) {
      throw new HttpError(400, "That lookup value is still referenced and cannot be voided.");
    }
  }
  const withReason = new Set([
    "import_queue",
    "local_inventory_items",
    "interco_movements",
    "interco_receipts",
    "audits",
    "audit_notes",
    "internal_test_results",
    "external_test_results",
    "label_templates",
    "suppliers",
    "purchase_orders",
    "purchase_order_lines",
    "listings",
    "sales_orders",
    "sales_order_lines",
  ]);
  const voidStmt = withReason.has(table)
    ? db
        .prepare(
          `UPDATE ${table} SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ? WHERE ${pk} = ?`
        )
        .bind(ts, actor.id, reason, ts, actor.id, id)
    : db
        .prepare(
          `UPDATE ${table} SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE ${pk} = ?`
        )
        .bind(ts, actor.id, ts, actor.id, id);
  const stmts: D1PreparedStatement[] = [
    voidStmt,
    insertLog(db, {
      record_table: table,
      record_id: id,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ];
  const ledger = ledgerByTable(table);
  if (ledger) {
    // A voided weight leaves its ledger's total; recompute rides the same batch
    // (owner rulings 2026-08-28 wet, 2026-08-31 dry).
    stmts.push(lotTotalRecomputeStmt(db, ledger, String(existing[ledger.parentField]), actor.id, ts));
  }
  // Canon 0.30.26: the ledger follows the trim. Voiding a trim package voids
  // its ledger item and returns the trim grams to the lot's package.
  if (table === "wip_packages") {
    const child = await wipChildItem(db, id);
    if (child) {
      stmts.push(
        db
          .prepare(
            `UPDATE local_inventory_items SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
             WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(ts, actor.id, reason, ts, actor.id, child.id),
        insertLog(db, {
          record_table: "local_inventory_items",
          record_id: child.id,
          field: "deleted_at",
          old_value: null,
          new_value: ts,
          actor_person_id: actor.id,
          reason: `${SYSTEM_REASON.inv_trim_void}: ${reason}`,
          changed_at: ts,
        })
      );
    }
    // THE CRYO RUN (canon 0.30.110): a cryo output drew nothing from the
    // harvest package (its grams came out of the run's pool), so voiding one
    // returns nothing to it; only a trim container's grams go back.
    if (existing.wet_weight_entry_id && drawsFromParentLot(existing.source)) {
      const parent = await lotLedgerParent(db, String(existing.wet_weight_entry_id));
      const grams = roundGrams(Number(existing.weight_grams ?? 0));
      if (parent && grams > 0) {
        stmts.push(...parentDrawStmts(db, parent, -grams, actor.id, ts, SYSTEM_REASON.inv_trim_void));
      }
    }
  }
  // THE VOIDED LOT LEAVES ITS SILO (canon 0.30.116). Owner, 2026-09-17: "Can
  // you remove this lot from the silo?  I think I stranded it by deleting its
  // record in data queue"; his pick "Take the load with it". Voiding a lot in
  // Data Queues used to void the lot row alone: its open silo load kept the
  // silo occupied with no lot to unload, and its born package stayed on the
  // ledger. Now the lot's open loads and its live ledger items go with it,
  // each with the same reason and a log row, so the silo empties in the same
  // act and nothing of the lot stays live. Ended loads stand as history.
  if (table === "wet_weight_entries") {
    const loads = await db
      .prepare(`SELECT id FROM silo_loads WHERE wet_weight_entry_id = ? AND deleted_at IS NULL AND ended_at IS NULL`)
      .bind(id)
      .all<{ id: string }>();
    for (const load of loads.results ?? []) {
      stmts.push(
        db
          .prepare(
            `UPDATE silo_loads SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
             WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(ts, actor.id, reason, ts, actor.id, load.id),
        insertLog(db, {
          record_table: "silo_loads",
          record_id: load.id,
          field: "deleted_at",
          old_value: null,
          new_value: ts,
          actor_person_id: actor.id,
          reason: `${SYSTEM_REASON.lot_void_load}: ${reason}`,
          changed_at: ts,
        })
      );
    }
    const items = await db
      .prepare(`SELECT id FROM local_inventory_items WHERE wet_weight_entry_id = ? AND deleted_at IS NULL`)
      .bind(id)
      .all<{ id: string }>();
    for (const item of items.results ?? []) {
      stmts.push(
        db
          .prepare(
            `UPDATE local_inventory_items SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
             WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(ts, actor.id, reason, ts, actor.id, item.id),
        insertLog(db, {
          record_table: "local_inventory_items",
          record_id: item.id,
          field: "deleted_at",
          old_value: null,
          new_value: ts,
          actor_person_id: actor.id,
          reason: `${SYSTEM_REASON.lot_void_item}: ${reason}`,
          changed_at: ts,
        })
      );
    }
  }
  return stmts;
}

export async function voidRecord(
  db: D1Database,
  table: string,
  id: string,
  form: FormData
): Promise<ActionOk> {
  const stmts = await planVoidRecord(db, table, id, form);
  await db.batch(stmts);
  // Owner ruling 2026-08-31: a void returns to the page it started from,
  // falling back to Data Queues, never the homepage.
  return { redirect: backRedirect(form.get("back")) };
}

/** THE PHONE LOGIN (canon 0.30.127): a typed phone lands as +E.164 or is
 * refused in words; a blank clears; a number another person carries is refused. */
async function phoneForPerson(db: D1Database, raw: ReturnType<FormData["get"]>, personId: string | null): Promise<string | null> {
  const text = textOrNull(raw);
  if (text == null) return null;
  const phone = normalizePhone(text);
  if (!phone) throw new HttpError(400, PHONE_REFUSAL.shape);
  const holder = await personIdByPhone(db, phone);
  if (holder && holder !== personId) throw new HttpError(400, PHONE_REFUSAL.taken);
  return phone;
}

export async function addPerson(db: D1Database, form: FormData): Promise<ActionOk> {
  const name = requireText(form.get("display_name"), "Name");
  // Optional pre-attached login email (owner ruling 2026-08-31); first login also self-creates.
  const email = textOrNull(form.get("email"))?.toLowerCase() ?? null;
  // THE PHONE LOGIN (canon 0.30.127): the optional phone a phone login maps onto.
  const phone = await phoneForPerson(db, form.get("phone"), null);
  const ts = nowIso();
  const id = crypto.randomUUID();
  const actorId = textOrNull(form.get("person_id"));
  const actor = actorId ? await requireActor(db, actorId) : null;
  const createdBy = actor?.id ?? id;
  await db.batch([
    db
      .prepare(
        `INSERT INTO people (
          id, display_name, email, phone, is_active, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, name, email, phone, ts, createdBy, ts, createdBy),
    ...logsForInsert(
      db,
      "people",
      id,
      { id, display_name: name, email, phone, is_active: 1, created_at: ts, created_by: createdBy },
      createdBy,
      SYSTEM_REASON.create,
      ts
    ),
  ]);
  // The new row id rides the redirect for tooling (smoke reads it); no picker consumes it.
  return { redirect: `/admin/lookups/people?ok=person&person_id=${encodeURIComponent(id)}` };
}

export async function deactivatePerson(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const id = requireText(form.get("id"), "Person");
  const row = await db
    .prepare(`SELECT id, is_active FROM people WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<{ id: string; is_active: number }>();
  if (!row) throw new HttpError(404, "Unknown person.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE people SET is_active = 0, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, id),
    insertLog(db, {
      record_table: "people",
      record_id: id,
      field: "is_active",
      old_value: String(row.is_active),
      new_value: "0",
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
  return { redirect: "/admin/lookups/people?ok=deactivated" };
}

export async function addStrain(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const name = requireText(form.get("name"), "Name");
  const abbr = textOrNull(form.get("abbr"));
  const hbnCode = requireText(form.get("hbn_code"), "HBN code");
  const id = crypto.randomUUID();
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO strains (
          id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, name, abbr, hbnCode, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "strains",
      id,
      { id, name, abbr, hbn_code: hbnCode, created_at: ts, created_by: actor.id },
      actor.id,
      SYSTEM_REASON.create,
      ts
    ),
  ]);
  return { redirect: "/admin/lookups/strains?ok=strain" };
}

/** THE DRY SPACE TYPE (canon 0.30.106): the type must be one of his three words. */
export function parseDrySpaceType(raw: unknown): string {
  const v = String(raw ?? "").trim();
  if (!(DRY_SPACE_TYPES as readonly string[]).includes(v)) throw new HttpError(400, "Pick Silo, Dry Room or Freezer.");
  return v;
}

/** The capacity: blank is none; otherwise a number above zero. */
export function parseCapacity(raw: unknown): number | null {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, "Capacity must be a number above zero, or blank.");
  return Math.round(n * 100) / 100;
}

/** The capacity's unit: blank is none; otherwise ea, lb, g or sqft. */
export function parseCapacityUom(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const uom = capacityUomOf(text);
  if (!uom) throw new HttpError(400, `Capacity UOM must be one of ${CAPACITY_UOMS.join(", ")}.`);
  return uom;
}

export async function addDrySpace(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const name = requireText(form.get("name"), "Name");
  const kind = requireText(form.get("kind"), "Kind");
  // Blank means shared across farms (owner ruling 2026-08-28).
  const farmCode = textOrNull(form.get("farm_code"));
  // THE DRY SPACE TYPE (canon 0.30.106; owner: "Admin lookups: Dry spaces: 1.
  // Name 2. Capacity 3. Capacity UOM (ea, lb, g, sqft) 4. Freezer, Dry Room, or
  // Silo?"): the type (silo when the older form sends none), the capacity and
  // its unit ride the row; a capacity needs its unit and a unit its capacity.
  const spaceType = form.has("space_type") ? parseDrySpaceType(form.get("space_type")) : "silo";
  const capacity = parseCapacity(form.get("capacity"));
  const capacityUom = parseCapacityUom(form.get("capacity_uom"));
  if ((capacity == null) !== (capacityUom == null)) throw new HttpError(400, "Capacity and its UOM go together.");
  const shape = spaceType === "freezer" ? "cube" : spaceType === "dry_room" ? "box" : "cylinder";
  const id = crypto.randomUUID();
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO dry_spaces (
          id, name, kind, farm_code, shape, space_type, capacity, capacity_uom,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, name, kind, farmCode, shape, spaceType, capacity, capacityUom, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "dry_spaces",
      id,
      {
        id,
        name,
        kind,
        farm_code: farmCode,
        shape,
        space_type: spaceType,
        capacity,
        capacity_uom: capacityUom,
        created_at: ts,
        created_by: actor.id,
      },
      actor.id,
      SYSTEM_REASON.create,
      ts
    ),
  ]);
  return { redirect: "/admin/lookups/dry_spaces?ok=space" };
}

export async function addPackageType(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const code = requireText(form.get("code"), "Code");
  const displayName = requireText(form.get("display_name"), "Display name");
  const isBud = checkbox01(form, "is_bud");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO package_types (
          code, display_name, is_bud, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(code, displayName, isBud, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "package_types",
      code,
      { code, display_name: displayName, is_bud: isBud, created_at: ts, created_by: actor.id },
      actor.id,
      SYSTEM_REASON.create,
      ts
    ),
  ]);
  return { redirect: "/admin/lookups/package_types?ok=type" };
}

/** Owner ruling 2026-09-02: queue a csv or xlsx as raw bytes. No parsing. */
export async function queueImport(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new HttpError(400, "A file is required.");
  }
  const filename = importBasename(file.name);
  if (!filename) {
    throw new HttpError(400, "A file is required.");
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const kind = assertImportUpload(filename, buf.byteLength);
  if (kind === "xlsb") {
    let counts;
    try {
      counts = await applyInTestingBytes(db, buf, "admin");
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : "The workbook could not be read.");
    }
    const q = new URLSearchParams({
      ok: "in_testing",
      seen: String(counts.rows_seen),
      landed: String(counts.rows_landed),
      changed: String(counts.rows_changed),
      skipped: String(counts.rows_skipped),
    });
    if (counts.message) q.set("message", counts.message.slice(0, 180));
    return { redirect: `/admin/imports?${q.toString()}` };
  }
  if (kind === "xlsm") {
    const row = await landSheetWorkbook(db, buf, "upload");
    if (row.status === "failed") throw new HttpError(400, row.message ?? "The workbook could not be read.");
    const q = new URLSearchParams({
      ok: "harvest_details",
      hseen: String(row.harvest_rows_seen ?? 0),
      hlanded: String(row.harvest_rows_landed ?? 0),
      hchanged: String(row.harvest_rows_changed ?? 0),
      hskipped: String(row.harvest_rows_skipped ?? 0),
      lseen: String(row.rows_seen ?? 0),
      llanded: String(row.rows_landed ?? 0),
    });
    if (row.message) q.set("message", row.message.slice(0, 500));
    return { redirect: `/admin/imports?${q.toString()}` };
  }
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    filename,
    kind,
    byte_size: buf.byteLength,
    status: IMPORT_STATUS.queued,
    created_at: ts,
    created_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO import_queue (
          id, filename, kind, byte_size, content, status, notes,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, filename, kind, buf.byteLength, buf, IMPORT_STATUS.queued, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "import_queue", id, record, actor.id, SYSTEM_REASON.import_queued, ts),
  ]);
  return { redirect: "/admin/imports?ok=file_queued" };
}

function inventoryMintStmts(
  db: D1Database,
  plan: ReturnType<typeof planFinishMint>,
  actorId: string,
  ts: string
): D1PreparedStatement[] {
  if (plan.action === "none") return [];
  if (plan.action === "update") {
    const stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `UPDATE local_inventory_items SET qty = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(plan.qty, ts, actorId, plan.itemId),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: plan.itemId,
        field: "qty",
        old_value: null,
        new_value: String(plan.qty),
        actor_person_id: actorId,
        reason: SYSTEM_REASON.inv_minted,
        changed_at: ts,
      }),
    ];
    // THE TAG LAW (canon 0.30.38): a tag typed on a re-finish lands with a log.
    if (plan.metrc_tag) {
      stmts.push(
        db
          .prepare(
            `UPDATE local_inventory_items SET metrc_tag = ?, updated_at = ?, updated_by = ?
             WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(plan.metrc_tag, ts, actorId, plan.itemId),
        insertLog(db, {
          record_table: "local_inventory_items",
          record_id: plan.itemId,
          field: "metrc_tag",
          old_value: null,
          new_value: plan.metrc_tag,
          actor_person_id: actorId,
          reason: SYSTEM_REASON.metrc_tag_captured,
          changed_at: ts,
        })
      );
    }
    return stmts;
  }
  // Canon 0.30.1: a caller may preset the id so the same batch can reference
  // the newborn item (the med equivalent transfer, the truck manifest).
  const id = plan.id ?? crypto.randomUUID();
  const record = {
    id,
    item_kind: plan.item_kind,
    package_code: plan.package_code,
    metrc_tag: plan.metrc_tag,
    harvest_batch_id: plan.harvest_batch_id,
    wet_weight_entry_id: plan.wet_weight_entry_id,
    strain_id: plan.strain_id,
    qty: plan.qty,
    uom: plan.uom,
    farm_code: plan.farm_code,
    license_value: plan.license_value,
    location: plan.location,
    created_at: ts,
    created_by: actorId,
    updated_at: ts,
    updated_by: actorId,
  };
  return [
    db
      .prepare(
        `INSERT INTO local_inventory_items (
          id, item_kind, package_code, metrc_tag, harvest_batch_id, wet_weight_entry_id, wip_package_id,
          strain_id, qty, uom, farm_code, license_value, location,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(
        id,
        plan.item_kind,
        plan.package_code,
        plan.metrc_tag,
        plan.harvest_batch_id,
        plan.wet_weight_entry_id,
        plan.strain_id,
        plan.qty,
        plan.uom,
        plan.farm_code,
        plan.license_value,
        plan.location,
        ts,
        actorId,
        ts,
        actorId
      ),
    ...logsForInsert(db, "local_inventory_items", id, record, actorId, SYSTEM_REASON.inv_minted, ts),
  ];
}

function setItemQtyLocationStmts(
  db: D1Database,
  item: { id: string; qty: number; location: string; farm_code?: string; license_value?: string },
  next: { qty?: number; location?: string; farm_code?: string; license_value?: string },
  actorId: string,
  ts: string,
  reason: string
): D1PreparedStatement[] {
  const sets: string[] = [];
  const values: unknown[] = [];
  const logs: D1PreparedStatement[] = [];
  if (next.qty != null && roundGrams(next.qty) !== roundGrams(item.qty)) {
    sets.push("qty = ?");
    values.push(roundGrams(next.qty));
    logs.push(
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: item.id,
        field: "qty",
        old_value: String(item.qty),
        new_value: String(roundGrams(next.qty)),
        actor_person_id: actorId,
        reason,
        changed_at: ts,
      })
    );
  }
  if (next.location != null && next.location !== item.location) {
    sets.push("location = ?");
    values.push(next.location);
    logs.push(
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: item.id,
        field: "location",
        old_value: item.location,
        new_value: next.location,
        actor_person_id: actorId,
        reason,
        changed_at: ts,
      })
    );
  }
  if (next.farm_code != null && next.farm_code !== item.farm_code) {
    sets.push("farm_code = ?");
    values.push(next.farm_code);
    logs.push(
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: item.id,
        field: "farm_code",
        old_value: item.farm_code ?? null,
        new_value: next.farm_code,
        actor_person_id: actorId,
        reason,
        changed_at: ts,
      })
    );
  }
  if (next.license_value != null && next.license_value !== item.license_value) {
    sets.push("license_value = ?");
    values.push(next.license_value);
    logs.push(
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: item.id,
        field: "license_value",
        old_value: item.license_value ?? null,
        new_value: next.license_value,
        actor_person_id: actorId,
        reason,
        changed_at: ts,
      })
    );
  }
  if (sets.length === 0) return [];
  sets.push("updated_at = ?", "updated_by = ?");
  values.push(ts, actorId, item.id);
  return [
    db
      .prepare(
        `UPDATE local_inventory_items SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(...values),
    ...logs,
  ];
}

export async function ensureUnloadSession(
  db: D1Database,
  lotId: string,
  actorId: string,
  ts: string,
  form?: FormData
): Promise<{ id: string; weigh_mode: string | null; operator_name: string | null }> {
  const open = await getOpenUnloadSession(db, lotId);
  // THE EFFECTIVE DATE PER STATION (owner ruling 2026-09-16, canon 0.30.94):
  // the unload's transaction date, today by default, the Admin PIN for any
  // other day. Only a form that carries an effective_date value touches it, so
  // a weight-add (its form has none) never clobbers a session's set date; the
  // audit created_at stays the instant.
  const typedEffective = form ? textOrNull(form.get(EFFECTIVE_DATE_FIELD)) : null;
  const effective = typedEffective ? await resolveEffectiveDate(db, form!, ts) : null;
  // Owner ruling 2026-09-07 (canon 0.29.1): the session no longer takes a
  // weigh mode from any form; the mode is the lot's material form and the
  // finish writes it onto the session for the downstream CSV reads. The
  // 2026-09-05 radio-lock law (canon 0.24.1) retires with the radios.
  if (open) {
    // Canon 0.30.21: the operator is hand entry (the sign-off names are the PM's alone).
    const operator = form ? textOrNull(form.get("operator_name")) : null;
    if (operator && operator !== open.operator_name) {
      await db
        .prepare(
          `UPDATE unload_sessions SET operator_name = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(operator, ts, actorId, open.id)
        .run();
    }
    if (effective && effective.date !== (open.effective_date ?? null)) {
      const stmts: D1PreparedStatement[] = [
        db
          .prepare(
            `UPDATE unload_sessions SET effective_date = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(effective.date, ts, actorId, open.id),
        insertLog(db, {
          record_table: "unload_sessions",
          record_id: open.id,
          field: "effective_date",
          old_value: open.effective_date ?? null,
          new_value: effective.date,
          actor_person_id: actorId,
          reason: effective.overridden ? EFFECTIVE_DATE_REASON : SYSTEM_REASON.create,
          changed_at: ts,
        }),
      ];
      await db.batch(stmts);
    }
    return {
      id: open.id,
      weigh_mode: open.weigh_mode,
      operator_name: operator ?? open.operator_name,
    };
  }
  const id = crypto.randomUUID();
  const operator = form ? textOrNull(form.get("operator_name")) : null;
  const mode = null;
  const effectiveDate = effective ? effective.date : await farmToday(db, ts);
  const record = {
    id,
    wet_weight_entry_id: lotId,
    operator_name: operator,
    weigh_mode: mode,
    effective_date: effectiveDate,
    created_at: ts,
    created_by: actorId,
    updated_at: ts,
    updated_by: actorId,
  };
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO unload_sessions (
          id, wet_weight_entry_id, operator_name, weigh_mode, bucked_on_site, truck_number, finished_at, effective_date,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, lotId, operator, mode, effectiveDate, ts, actorId, ts, actorId),
    ...logsForInsert(db, "unload_sessions", id, record, actorId, SYSTEM_REASON.create, ts),
  ];
  if (effective?.overridden) {
    stmts.push(effectiveOverrideLog(db, "unload_sessions", id, effective, actorId, ts));
  }
  await db.batch(stmts);
  return { id, weigh_mode: mode, operator_name: operator };
}

export async function updateUnloadSession(
  db: D1Database,
  lotId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const ts = nowIso();
  await ensureUnloadSession(db, lotId, actor.id, ts, form);
  return { redirect: `/station/unload_dry_space?pick=${encodeURIComponent(lotId)}` };
}

/** The lot as the unload finish reads it: its totals, the space it dried in
 * (actual_dryspc, which Load Silo sets) and the batch's farm, strain, HBN and
 * license. */
type UnloadLotRow = {
  id: string;
  status: string;
  weight_grams: number;
  dry_weight_grams: number | null;
  harvest_batch_id: string;
  material_form: string | null;
  dry_space_kind: string | null;
  dry_space_name: string | null;
  dry_space_farm: string | null;
  dry_space_type: string | null;
  farm_code: string | null;
  strain_id: string | null;
  hbn: string | null;
  metrc_harvest_tag: string | null;
  license_value: string | null;
};

async function readUnloadLot(db: D1Database, lotId: string): Promise<UnloadLotRow | null> {
  return db
    .prepare(
      `SELECT w.id, w.status, w.weight_grams, w.dry_weight_grams, w.harvest_batch_id, w.material_form,
              d.kind AS dry_space_kind, d.name AS dry_space_name, d.farm_code AS dry_space_farm, d.space_type AS dry_space_type,
              b.farm_code, b.strain_id, b.hbn, b.metrc_harvest_tag, b.license_value
       FROM wet_weight_entries w
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       WHERE w.id = ? AND w.deleted_at IS NULL`
    )
    .bind(lotId)
    .first<UnloadLotRow>();
}

type UnloadParent = Awaited<ReturnType<typeof getInventoryItemForLot>>;

type UnloadFinishResolved = {
  spaceKind: string;
  homeBarn: string;
  weighMode: "bucked" | "spear";
  buckedOnSite: "yes" | "no" | null;
  truckNumber: string | null;
  plan: UnloadFinishPlan;
  gate: ReconcileGate;
};

/** One lot's unload finish read from its dry total: the home barn, the weigh
 * mode, the on-site answer and truck, the plan and the reconcile gate, with
 * the refusals the finish has always raised. THE JOINT UNLOAD (canon
 * 0.30.226) reads each lot's share through this same function. */
function resolveUnloadFinish(
  lot: UnloadLotRow,
  parent: UnloadParent,
  answers: { buckedOnSite: unknown; truckNumber: unknown },
  dryTotal: number
): UnloadFinishResolved {
  const spaceKind = lot.dry_space_kind ?? "";
  // THE HARVEST CONSOLE (canon 0.30.73): the unloaded material returns to the
  // barn of the site the dry space stands at (PNN's BARN for the five silos
  // and the PNN rooms, ARL BARN for the Arlington Dry Room); a truck lot, whose
  // sentinel has no farm, unloads at North as before.
  const homeBarn = spaceKind === "truck" ? LOC_BARN : barnLocationForSite(siloSiteOf(lot.dry_space_farm));
  // Owner ruling 2026-09-07 (canon 0.29.1): the weigh mode is the lot's form,
  // set at wet weigh-in; the radios are gone from this station. A silo still
  // forces bucked (the silo law).
  const weighMode = spaceKind === "silo" || lot.material_form === "bucked" ? "bucked" : "spear";
  // "Dry weight can keep the 'on site' question only for Spears that aren't at
  // North." Where the material sits comes from the minted item's location, else
  // the batch farm (materialAtNorth). At North the question dies: the site IS
  // the answer, yes implied, and the movement no-path never opens there.
  const atNorth = materialAtNorth(parent?.location ?? null, lot.farm_code);
  const buckedOnSiteRaw = textOrNull(answers.buckedOnSite);
  const buckedOnSite =
    weighMode === "spear"
      ? atNorth
        ? "yes"
        : buckedOnSiteRaw === "yes" || buckedOnSiteRaw === "1"
          ? "yes"
          : buckedOnSiteRaw === "no" || buckedOnSiteRaw === "0"
            ? "no"
            : null
      : null;
  if (weighMode === "spear" && !atNorth && !buckedOnSite) {
    throw new HttpError(400, "Will these be bucked on site?");
  }
  const truckNumber =
    buckedOnSite === "no" ? requireText(answers.truckNumber, "Truck #") : textOrNull(answers.truckNumber);
  const plan = planUnloadFinish({
    spaceKind,
    weighMode,
    buckedOnSite,
    parentQty: Number(parent?.qty ?? 0),
    dryTotal,
    shortId: shortLotId(lot.hbn ?? "", lot.metrc_harvest_tag),
  });
  if (plan.mode === "spear" && plan.requireTruck && !truckNumber) {
    throw new HttpError(400, "Truck # is required when product will not be bucked on site.");
  }
  const parentQty = Number(parent?.qty ?? 0);
  const gate = reconcileGate({ recorded: dryTotal, parentQty, mode: plan.mode });
  return { spaceKind, homeBarn, weighMode, buckedOnSite, truckNumber, plan, gate };
}

/** One lot's unload finish statements (moved whole out of finishUnload for
 * the joint unload, canon 0.30.226): the open loads end, the lot goes drying
 * to unloaded, the session finishes with its reconcile choice, and the
 * package takes the plan. `reason` names the finish on the status and
 * reconcile rows; the package rows keep their own reasons (the adjustment
 * file reads inv_unload_adjust by name). */
function unloadFinishStmts(
  db: D1Database,
  input: {
    lot: UnloadLotRow;
    parent: UnloadParent;
    sessionId: string;
    resolved: UnloadFinishResolved;
    gateChoice: string | null;
    actorId: string;
    ts: string;
    reason: string;
  }
): D1PreparedStatement[] {
  const { lot, parent, gateChoice, ts } = input;
  const { spaceKind, homeBarn, weighMode, buckedOnSite, truckNumber, plan, gate } = input.resolved;
  const lotId = lot.id;
  const actor = { id: input.actorId };
  const session = { id: input.sessionId };
  const next = nextStatus("lot_unloaded", lot.status);
  const stmts: D1PreparedStatement[] = [
    // Canon 0.30.6: the unload finish ends the lot's open silo loads, so the
    // silo circle clears its clock.
    db
      .prepare(
        `UPDATE silo_loads SET ended_at = ?, updated_at = ?, updated_by = ?
         WHERE wet_weight_entry_id = ? AND ended_at IS NULL AND deleted_at IS NULL`
      )
      .bind(ts, ts, actor.id, lotId),
    db
      .prepare(
        `UPDATE wet_weight_entries SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(next, ts, actor.id, lotId),
    insertLog(db, {
      record_table: "wet_weight_entries",
      record_id: lotId,
      field: "status",
      old_value: lot.status,
      new_value: next,
      actor_person_id: actor.id,
      reason: input.reason,
      changed_at: ts,
    }),
    db
      .prepare(
        `UPDATE unload_sessions SET finished_at = ?, bucked_on_site = ?, truck_number = ?,
                weigh_mode = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(
        ts,
        buckedOnSite === "yes" ? 1 : buckedOnSite === "no" ? 0 : null,
        truckNumber,
        spaceKind === "silo" ? "bucked" : weighMode,
        ts,
        actor.id,
        session.id
      ),
    insertLog(db, {
      record_table: "unload_sessions",
      record_id: session.id,
      field: "reconcile_choice",
      old_value: null,
      new_value: gate.kind === "exact" ? "exact" : gateChoice,
      actor_person_id: actor.id,
      reason: input.reason,
      changed_at: ts,
    }),
  ];
  if (parent && plan.mode === "bucked") {
    stmts.push(
      ...setItemQtyLocationStmts(
        db,
        parent,
        { qty: plan.parentQty, location: homeBarn },
        actor.id,
        ts,
        SYSTEM_REASON.inv_bucked_split
      )
    );
    const childId = crypto.randomUUID();
    const child = {
      id: childId,
      item_kind: ITEM_KIND_WIP,
      package_code: plan.childPackageCode,
      harvest_batch_id: lot.harvest_batch_id,
      wet_weight_entry_id: lot.id,
      strain_id: lot.strain_id,
      qty: plan.childQty,
      uom: "g",
      farm_code: lot.farm_code ?? "",
      // THE INHERITANCE LAW (canon 0.28.1, gate fix 0.28.2): the bucked child
      // carries the batch license like the finish mint does; 832 was hardcoded.
      license_value: inheritedLotLicense(lot.license_value, lot.farm_code),
      location: homeBarn,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO local_inventory_items (
            id, item_kind, package_code, harvest_batch_id, wet_weight_entry_id, wip_package_id,
            strain_id, qty, uom, farm_code, license_value, location,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
          ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
        )
        .bind(
          childId,
          child.item_kind,
          child.package_code,
          child.harvest_batch_id,
          child.wet_weight_entry_id,
          child.strain_id,
          child.qty,
          child.uom,
          child.farm_code,
          child.license_value,
          child.location,
          ts,
          actor.id,
          ts,
          actor.id
        ),
      ...logsForInsert(db, "local_inventory_items", childId, child, actor.id, SYSTEM_REASON.inv_bucked_split, ts)
    );
  } else if (parent) {
    const location = plan.mode === "silo" || (plan.mode === "spear" && !plan.requireTruck) ? homeBarn : parent.location;
    stmts.push(
      ...setItemQtyLocationStmts(
        db,
        parent,
        { qty: plan.parentQty, location },
        actor.id,
        ts,
        SYSTEM_REASON.inv_unload_adjust
      )
    );
    if (plan.mode === "spear" && plan.requireTruck && truckNumber) {
      const movementId = crypto.randomUUID();
      const itemRowId = crypto.randomUUID();
      const movement = {
        id: movementId,
        movement_kind: MOVEMENT_KIND.interco,
        origin_farm: lot.farm_code,
        destination_farm: null,
        origin_license: LICENSE_AU_GROW,
        destination_license: "",
        truck_number: truckNumber,
        status: MOVEMENT_STATUS.building,
        origin_location: location,
        created_at: ts,
        created_by: actor.id,
        updated_at: ts,
        updated_by: actor.id,
      };
      stmts.push(
        db
          .prepare(
            `INSERT INTO interco_movements (
              id, movement_kind, origin_farm, destination_farm, origin_license, destination_license,
              truck_number, driver, status, origin_location,
              exported_at, completed_at, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
            ) VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
          )
          .bind(
            movementId,
            MOVEMENT_KIND.interco,
            lot.farm_code,
            LICENSE_AU_GROW,
            "",
            truckNumber,
            MOVEMENT_STATUS.building,
            // Gate fix 0.28.2 (builder amendment 3): the origin pair is whole;
            // the staged item's location is the movement's origin_location.
            location,
            ts,
            actor.id,
            ts,
            actor.id
          ),
        ...logsForInsert(db, "interco_movements", movementId, movement, actor.id, SYSTEM_REASON.inv_moved_out, ts),
        db
          .prepare(
            `INSERT INTO interco_movement_items (
              id, movement_id, local_inventory_item_id, qty, uom,
              created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
          )
          .bind(itemRowId, movementId, parent.id, parent.qty, "g", ts, actor.id, ts, actor.id)
      );
    }
  }
  return stmts;
}

export async function finishUnload(
  db: D1Database,
  station: { key: string; ledger?: { table: string; lotStatus: string } },
  lotId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const lot = await readUnloadLot(db, lotId);
  if (!lot) throw new HttpError(404, "Unknown lot.");
  // THE BLAST FREEZER(S) (canon 0.30.106; owner, 2026-09-16, verbatim: "Unload
  // Dry Space/Blast Freezer just removes the line, since the packages are
  // already denoted as "FFZ" in METRC, the inventory lines are identical and
  // moving the BF inventory to the FFZ inventory would just duplicate it"; his
  // pick: the lot closes as frozen, out of every queue). A freezer's unload
  // takes no dry weight, moves nothing and pends no file: the open loads end
  // (the line leaves the tile), the lot goes drying to frozen, and its package
  // stays where it is in the ledger, FFZ inventory the cube already counts.
  if (drySpaceTypeOf(lot.dry_space_type) === "freezer") {
    const ts = nowIso();
    const session = await ensureUnloadSession(db, lotId, actor.id, ts, form);
    const next = nextStatus("lot_frozen", lot.status);
    await db.batch([
      db
        .prepare(
          `UPDATE silo_loads SET ended_at = ?, updated_at = ?, updated_by = ?
           WHERE wet_weight_entry_id = ? AND ended_at IS NULL AND deleted_at IS NULL`
        )
        .bind(ts, ts, actor.id, lotId),
      db
        .prepare(`UPDATE wet_weight_entries SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
        .bind(next, ts, actor.id, lotId),
      insertLog(db, {
        record_table: "wet_weight_entries",
        record_id: lotId,
        field: "status",
        old_value: lot.status,
        new_value: next,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.freezer_unload,
        changed_at: ts,
      }),
      // The session the page opened is voided, never finished: a finished
      // session pends the package file, and the freezer pends nothing.
      db
        .prepare(
          `UPDATE unload_sessions SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, ts, actor.id, session.id),
      insertLog(db, {
        record_table: "unload_sessions",
        record_id: session.id,
        field: "deleted_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.freezer_unload,
        changed_at: ts,
      }),
    ]);
    return { redirect: `/station/${station.key}?ok=frozen` };
  }
  const count = await countLotWeights(db, {
    table: "dry_weights",
    parentField: "wet_weight_entry_id",
    totalField: "dry_weight_grams",
    lotStatus: "drying",
  }, lotId);
  assertLotHasDryWeights(count);
  const ts = nowIso();
  const session = await ensureUnloadSession(db, lotId, actor.id, ts, form);
  const parent = await getInventoryItemForLot(db, lotId);
  const dryTotal = Number(lot.dry_weight_grams ?? 0);
  const resolved = resolveUnloadFinish(
    lot,
    parent,
    { buckedOnSite: form.get("bucked_on_site"), truckNumber: form.get("truck_number") },
    dryTotal
  );
  const { spaceKind, weighMode, buckedOnSite, truckNumber, gate } = resolved;
  const gateChoice = textOrNull(form.get("gate_choice"));
  if (gate.kind !== "exact") {
    if (gateChoice === "back") {
      return { redirect: `/station/${station.key}?pick=${encodeURIComponent(lotId)}` };
    }
    if (!isReconcileChoice(gateChoice)) {
      await db
        .prepare(
          `UPDATE unload_sessions SET bucked_on_site = ?, truck_number = ?,
                  weigh_mode = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(
          buckedOnSite === "yes" ? 1 : buckedOnSite === "no" ? 0 : null,
          truckNumber,
          spaceKind === "silo" ? "bucked" : weighMode,
          ts,
          actor.id,
          session.id
        )
        .run();
      return { redirect: `/station/${station.key}?pick=${encodeURIComponent(lotId)}&gate=1` };
    }
  }
  await db.batch(
    unloadFinishStmts(db, {
      lot,
      parent,
      sessionId: session.id,
      resolved,
      gateChoice,
      actorId: actor.id,
      ts,
      reason: SYSTEM_REASON.finish_unload,
    })
  );
  // Canon 0.30.1 fork 8: a queued adjustment lands at the export home where
  // its file pends; every other finish returns to the station.
  if (gateChoice === "queue_adjust") {
    return { redirect: "/admin/uploads?ok=adjust_queued" };
  }
  return { redirect: `/station/${station.key}?ok=unloaded` };
}

/** True when a joint unload's share rows already stand under these load ids
 * (each share row takes its load's id as its key). */
async function jointUnloadAlreadyWritten(db: D1Database, loadIds: readonly string[]): Promise<boolean> {
  if (loadIds.length === 0 || loadIds.length > 50) return false;
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM dry_weights WHERE id IN (${loadIds.map(() => "?").join(", ")})`)
    .bind(...loadIds)
    .first<{ n: number }>();
  return Number(row?.n ?? 0) > 0;
}

/** The dry ledger the joint unload writes and recomputes, as finishUnload counts it. */
const DRY_UNLOAD_LEDGER: LedgerDef = {
  table: "dry_weights",
  parentField: "wet_weight_entry_id",
  totalField: "dry_weight_grams",
  lotStatus: LOT_STATUS.drying,
};

/** THE JOINT UNLOAD, DRY PRO RATA (canon 0.30.226; his pick "Every entry, dry
 * pro rata"): a space whose open loads hold two or more lots, unloaded as a
 * whole from the drying schedule's Working pane. One total dry and the
 * unload's questions once (the operator, the effective day, the gate's
 * choice); each lot's share (jointUnloadShares: pro rata by wet grams in whole
 * grams, the remainder on the last lot loaded) becomes that lot's single
 * dry_weights row, then each lot's unload finish runs as finishUnload runs it
 * (the same plan, the same choice, the same file pends), all in one batch.
 * Every row the joint unload names takes one reason naming the space and its
 * lots; the package rows keep the reasons the adjustment file reads. A
 * freezer's line is removed with nothing weighed, so a freezer has no joint
 * unload. A queued adjustment lands at the export home, as finishUnload's
 * does (canon 0.30.1 fork 8). */
export async function unloadTogether(db: D1Database, stage: DryingStage, spaceId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const space = await db
    .prepare(`SELECT id, name, kind, space_type FROM dry_spaces WHERE id = ? AND deleted_at IS NULL`)
    .bind(spaceId)
    .first<{ id: string; name: string; kind: string; space_type: string | null }>();
  if (!space || space.kind !== "silo") throw new HttpError(404, "Unknown dry space.");
  const type = drySpaceTypeOf(space.space_type);
  if (type !== DRYING_STAGE_SPACE_TYPE[stage]) {
    throw refusal(400, { key: "{space} is not on this surface.", vars: { space: space.name } });
  }
  if (type === "freezer") {
    throw new HttpError(
      400,
      "A freezer's lines are removed one lot at a time on Unload Dry Space; nothing is weighed, so a freezer has no joint unload."
    );
  }
  const loads = await listOpenSiloLoadsInSpace(db, space.id);
  const posted = String(form.get("load_ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .sort();
  if (await jointUnloadAlreadyWritten(db, posted)) {
    throw refusal(409, { key: "{space} was already unloaded together; nothing was unloaded twice.", vars: { space: space.name } });
  }
  // One share per lot: a lot holding two open loads here counts once, and its
  // finish ends every one of them.
  const lots = oneLoadPerLot(loads);
  if (lots.length < 2) {
    throw refusal(400, {
      key: "Unload together needs two or more loaded lots; {space} holds {n}. Unload the lot on Unload Dry Space.",
      vars: { space: space.name, n: String(lots.length) },
    });
  }
  // The group the form showed must be the group now.
  const current = loads.map((load) => load.id).sort();
  if (posted.join(",") !== current.join(",")) {
    throw refusal(409, {
      key: "The loads in {space} changed since the form opened. Open Unload together again.",
      vars: { space: space.name },
    });
  }
  const total = parseGrams(form.get("total_dry_grams"), "Total dry grams");
  if (total <= 0) throw new HttpError(400, "Total dry grams must be more than zero.");
  const typedChoice = textOrNull(form.get("gate_choice"));
  if (typedChoice && typedChoice !== "queue_adjust" && typedChoice !== "nothing") {
    throw new HttpError(400, "Pick Queue an adjustment CSV or Nothing, just finish.");
  }
  const ts = nowIso();
  // A day other than today and its Admin PIN refuse before anything is written.
  await resolveEffectiveDate(db, form, ts);
  const shares = jointUnloadShares(
    total,
    lots.map((load) => Number(load.weight_grams ?? 0))
  );
  if (shares.length !== lots.length) {
    throw refusal(400, { key: "The loads in {space} carry no wet grams to share the dry total by.", vars: { space: space.name } });
  }
  if (shares.some((share) => share < 0)) {
    throw new HttpError(400, "That total is too small to share across these lots in whole grams.");
  }
  const parts: Array<{
    loadId: string;
    lot: UnloadLotRow;
    parent: UnloadParent;
    resolved: UnloadFinishResolved;
    share: number;
    short: string;
  }> = [];
  for (let i = 0; i < lots.length; i++) {
    const lot = await readUnloadLot(db, lots[i].wet_weight_entry_id);
    if (!lot) throw new HttpError(404, "Unknown lot.");
    const short = shortLotId(lot.hbn ?? "", lot.metrc_harvest_tag);
    if (lot.status !== LOT_STATUS.drying) {
      throw refusal(409, { key: "Lot {lot} is not drying, so it cannot be unloaded.", vars: { lot: short } });
    }
    // The finish reads the lot's own space (its Move To, which Load Silo set);
    // a lot moved by the pencil after loading unloads on Unload Dry Space.
    const home = await db
      .prepare(`SELECT actual_dryspc FROM wet_weight_entries WHERE id = ? AND deleted_at IS NULL`)
      .bind(lot.id)
      .first<{ actual_dryspc: string | null }>();
    if (home?.actual_dryspc !== space.id) {
      throw refusal(400, {
        key: "Lot {lot} no longer stands in {space} (its space changed after loading); unload it on Unload Dry Space.",
        vars: { lot: short, space: space.name },
      });
    }
    if (drySpaceTypeOf(lot.dry_space_type) === "freezer") {
      throw refusal(400, { key: "Lot {lot} stands in a freezer; remove its line on Unload Dry Space.", vars: { lot: short } });
    }
    if ((await countLotWeights(db, DRY_UNLOAD_LEDGER, lot.id)) > 0) {
      throw refusal(400, {
        key: "Lot {lot} already has dry weights on Unload Dry Space. Finish it there, or void them, before unloading together.",
        vars: { lot: short },
      });
    }
    const parent = await getInventoryItemForLot(db, lot.id);
    const resolved = resolveUnloadFinish(
      lot,
      parent,
      { buckedOnSite: form.get("bucked_on_site"), truckNumber: form.get("truck_number") },
      shares[i]
    );
    if (resolved.gate.kind !== "exact" && !typedChoice) {
      throw new HttpError(400, "Pick what to do about the difference: Queue an adjustment CSV, or Nothing, just finish.");
    }
    parts.push({ loadId: lots[i].id, lot, parent, resolved, share: shares[i], short });
  }
  const reason = `${SYSTEM_REASON.joint_unload}: ${space.name} (${parts.map((part) => part.short).join(", ")})`;
  const stmts: D1PreparedStatement[] = [];
  for (const part of parts) {
    const session = await ensureUnloadSession(db, part.lot.id, actor.id, ts, form);
    // The share's row takes its load's id: a repeated post of the same group
    // (a double tap) collides on the key and its whole batch rolls back.
    const id = part.loadId;
    const record = {
      id,
      wet_weight_entry_id: part.lot.id,
      weight_grams: part.share,
      session_id: session.id,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO dry_weights (
            id, wet_weight_entry_id, weight_grams, session_id,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, (
            SELECT w.id FROM wet_weight_entries w
            WHERE w.id = ? AND w.status = ? AND w.deleted_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM dry_weights d WHERE d.wet_weight_entry_id = w.id AND d.deleted_at IS NULL)
          ), ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(id, part.lot.id, LOT_STATUS.drying, part.share, session.id, ts, actor.id, ts, actor.id),
      ...logsForInsert(db, "dry_weights", id, record, actor.id, reason, ts),
      lotTotalRecomputeStmt(db, DRY_UNLOAD_LEDGER, part.lot.id, actor.id, ts),
      ...unloadFinishStmts(db, {
        lot: part.lot,
        parent: part.parent,
        sessionId: session.id,
        resolved: part.resolved,
        gateChoice: part.resolved.gate.kind === "exact" ? null : typedChoice,
        actorId: actor.id,
        ts,
        reason,
      })
    );
  }
  try {
    await db.batch(stmts);
  } catch (err) {
    // The batch rolled back whole. A share row already under its key is the
    // same group unloaded by another post; a lot weighed or finished on Unload
    // Dry Space meanwhile refuses in words; anything else is a real error.
    if (await jointUnloadAlreadyWritten(db, parts.map((part) => part.loadId))) {
      throw refusal(409, { key: "{space} was already unloaded together; nothing was unloaded twice.", vars: { space: space.name } });
    }
    for (const part of parts) {
      const now = await readUnloadLot(db, part.lot.id);
      if (!now || now.status !== LOT_STATUS.drying || (await countLotWeights(db, DRY_UNLOAD_LEDGER, part.lot.id)) > 0) {
        throw refusal(409, {
          key: "Lot {lot} changed on Unload Dry Space while the joint unload ran; no lot was unloaded. Open Unload together again.",
          vars: { lot: part.short },
        });
      }
    }
    throw err;
  }
  // Canon 0.30.1 fork 8: a queued adjustment lands at the export home where
  // its files pend; every other joint unload returns to the surface.
  if (typedChoice === "queue_adjust" && parts.some((part) => part.resolved.gate.kind !== "exact")) {
    return { redirect: "/admin/uploads?ok=adjust_queued" };
  }
  return { redirect: `${dryingStagePath(stage)}?ok=unloaded_together&n=${parts.length}` };
}

export async function addGrowMethod(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const code = requireText(form.get("code"), "Code");
  const displayName = requireText(form.get("display_name"), "Display name");
  const hbnCode = requireText(form.get("hbn_code"), "HBN code");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO grow_methods (
          code, display_name, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(code, displayName, hbnCode, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "grow_methods",
      code,
      { code, display_name: displayName, hbn_code: hbnCode, created_at: ts, created_by: actor.id },
      actor.id,
      SYSTEM_REASON.create,
      ts
    ),
  ]);
  return { redirect: "/admin/lookups/grow_methods?ok=grow" };
}

/** THE TRIM BOGEY (canon 0.30.249; owner, 2026-09-26: "Add a Admin Lookup
 * Field: [Trim Bogey] expressed as a percentage"). Admin, Lookups, Trim Bogey
 * saves one whole percent 0 to 100 into app_config trim_bogey_pct under the
 * typed reason: the row is inserted on the first save (the plume reads
 * TRIM_BOGEY_DEFAULT until then) and updated after, every change logged. */
export async function saveTrimBogey(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const value = trimBogeyOf(form.get("trim_bogey_pct"));
  if (value == null) throw refusal(400, { key: "Trim Bogey is a whole percent from 0 to 100.", vars: {} });
  const reason = requireReason(textOrNull(form.get("reason")));
  const key = CONFIG_KEYS.trim_bogey_pct;
  const text = String(value);
  const ts = nowIso();
  const existing = await db
    .prepare(`SELECT value, deleted_at FROM app_config WHERE key = ?`)
    .bind(key)
    .first<{ value: string; deleted_at: string | null }>();
  const done = { redirect: "/admin/lookups/trim_bogey?ok=saved" };
  if (existing && existing.deleted_at == null) {
    if (existing.value === text) return done;
    await db.batch([
      db
        .prepare(`UPDATE app_config SET value = ?, updated_at = ?, updated_by = ? WHERE key = ? AND deleted_at IS NULL`)
        .bind(text, ts, actor.id, key),
      insertLog(db, {
        record_table: "app_config",
        record_id: key,
        field: "value",
        old_value: existing.value,
        new_value: text,
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
    ]);
    return done;
  }
  if (existing) {
    // A voided row keeps its key: it comes back with the new value, logged.
    await db.batch([
      db
        .prepare(`UPDATE app_config SET value = ?, deleted_at = NULL, deleted_by = NULL, updated_at = ?, updated_by = ? WHERE key = ?`)
        .bind(text, ts, actor.id, key),
      insertLog(db, {
        record_table: "app_config",
        record_id: key,
        field: "deleted_at",
        old_value: existing.deleted_at,
        new_value: null,
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
      insertLog(db, {
        record_table: "app_config",
        record_id: key,
        field: "value",
        old_value: existing.value,
        new_value: text,
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
    ]);
    return done;
  }
  const record = { key, value: text, created_at: ts, created_by: actor.id, updated_at: ts, updated_by: actor.id };
  await db.batch([
    db
      .prepare(
        `INSERT INTO app_config (key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(key, text, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "app_config", key, record, actor.id, reason, ts),
  ]);
  return done;
}

/** THE FARM PLANT COUNT (canon 0.30.288): one whole number per farm per harvest year. */
export async function saveFarmPlantCounts(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const yearText = textOrNull(form.get("harvest_year")) ?? "";
  if (!/^\d{4}$/.test(yearText)) throw new HttpError(400, "Harvest year must be a four-digit year.");
  const year = Number(yearText);
  const farms = await db.prepare(`SELECT code FROM farms WHERE deleted_at IS NULL ORDER BY code`).all<{ code: string }>();
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const farm of farms.results ?? []) {
    const raw = textOrNull(form.get(`count_${farm.code}`));
    let next: number | null = null;
    if (raw != null) {
      if (!/^\d+$/.test(raw)) throw new HttpError(400, "Plant count must be a whole number, zero or more.");
      next = Number(raw);
    }
    const existing = await db
      .prepare(`SELECT id, plant_count FROM farm_plant_counts WHERE farm_code = ? AND harvest_year = ? AND deleted_at IS NULL`)
      .bind(farm.code, year)
      .first<{ id: string; plant_count: number }>();
    if (next == null) {
      if (!existing) continue;
      stmts.push(
        db
          .prepare(
            `UPDATE farm_plant_counts SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ? WHERE id = ?`
          )
          .bind(ts, actor.id, reason, ts, actor.id, existing.id),
        insertLog(db, {
          record_table: "farm_plant_counts",
          record_id: existing.id,
          field: "plant_count",
          old_value: String(existing.plant_count),
          new_value: null,
          actor_person_id: actor.id,
          reason,
          changed_at: ts,
        })
      );
      continue;
    }
    if (existing) {
      if (Number(existing.plant_count) === next) continue;
      stmts.push(
        db.prepare(`UPDATE farm_plant_counts SET plant_count = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(next, ts, actor.id, existing.id),
        insertLog(db, {
          record_table: "farm_plant_counts",
          record_id: existing.id,
          field: "plant_count",
          old_value: String(existing.plant_count),
          new_value: String(next),
          actor_person_id: actor.id,
          reason,
          changed_at: ts,
        })
      );
      continue;
    }
    const id = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO farm_plant_counts (
             id, farm_code, harvest_year, plant_count, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
        )
        .bind(id, farm.code, year, next, ts, actor.id, ts, actor.id),
      insertLog(db, {
        record_table: "farm_plant_counts",
        record_id: id,
        field: "plant_count",
        old_value: null,
        new_value: String(next),
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      })
    );
  }
  if (stmts.length) await db.batch(stmts);
  return { redirect: `/admin/lookups/plant_count?year=${yearText}&ok=saved` };
}

export async function addLookupValue(db: D1Database, category: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const value = requireText(form.get("value"), "Value");
  const label = requireText(form.get("label"), "Label");
  const tone = textOrNull(form.get("tone"));
  // Owner ruling 2026-09-06 (canon 0.27.0): locations carry a farm assignment.
  const farmCode = textOrNull(form.get("farm_code"));
  // Canon 0.30.40: a location may be scoped to one license; blank means every
  // license at its farm.
  const licenseValue = textOrNull(form.get("license_value"));
  const existing = await db
    .prepare(
      `SELECT id FROM lookup_values WHERE category = ? AND value = ? AND deleted_at IS NULL`
    )
    .bind(category, value)
    .first();
  if (existing) throw new HttpError(400, "That value already exists in this lookup.");
  const max = await db
    .prepare(
      `SELECT MAX(sort_order) AS m FROM lookup_values WHERE category = ? AND deleted_at IS NULL`
    )
    .bind(category)
    .first<{ m: number | null }>();
  const sortOrder = Number(max?.m ?? 0) + 1;
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    category,
    value,
    label,
    tone,
    farm_code: farmCode,
    license_value: licenseValue,
    sort_order: sortOrder,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO lookup_values (
          id, category, value, label, tone, farm_code, license_value, sort_order,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, category, value, label, tone, farmCode, licenseValue, sortOrder, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "lookup_values", id, record, actor.id, SYSTEM_REASON.create, ts),
  ]);
  const section =
    category === "silo_number"
      ? "silo_number"
      : category === "inventory_location"
        ? "inventory_locations"
        : category === "field_location"
          ? "field_locations"
          : category === "internal_field"
            ? "internal_fields"
            : category === "sign_off_name"
              ? "sign_off_names"
              : category === "listing_category"
                ? "listing_categories"
                : "licenses";
  return { redirect: `/admin/lookups/${section}?ok=lookup` };
}

function movementHeaderFromForm(form: FormData) {
  return {
    originLicense: requireText(form.get("origin_license"), "Origin license"),
    destinationLicense: requireText(form.get("destination_license"), "Destination license"),
    originFarm: textOrNull(form.get("origin_farm")),
    destinationFarm: textOrNull(form.get("destination_farm")),
    truckNumber: textOrNull(form.get("truck_number")),
    driver: textOrNull(form.get("driver")),
    plannedRoute: textOrNull(form.get("planned_route")),
    transferType: textOrNull(form.get("transfer_type")),
    invoiceNumber: textOrNull(form.get("invoice_number")),
    paymentTermDays: textOrNull(form.get("payment_term_days")),
    plannedDeparture: textOrNull(form.get("planned_departure")),
    plannedArrival: textOrNull(form.get("planned_arrival")),
    grossWeight: textOrNull(form.get("gross_weight")),
    grossWeightUom: textOrNull(form.get("gross_weight_uom")),
    transporterLicense: textOrNull(form.get("transporter_license")),
    transporterPhone: textOrNull(form.get("transporter_phone")),
    driverOccupational: textOrNull(form.get("driver_occupational_license")),
    driverLicenseNumber: textOrNull(form.get("driver_license_number")),
    vehicleMake: textOrNull(form.get("vehicle_make")),
    vehicleModel: textOrNull(form.get("vehicle_model")),
    vehiclePlate: textOrNull(form.get("vehicle_plate")),
    metrcManifestNumber: textOrNull(form.get("metrc_manifest_number")),
  };
}

function movementSurfaceRedirect(form: FormData, movementId: string): string {
  const surface = textOrNull(form.get("surface"));
  if (surface === "send" || surface === "floor") {
    return `/interco?movement=${encodeURIComponent(movementId)}`;
  }
  return `/interco/ship-external?movement=${encodeURIComponent(movementId)}`;
}

function arrivalsRedirect(destinationFarm: string | null | undefined, movementId: string, extra = ""): string {
  const site = farmToSite(destinationFarm);
  const suffix = extra ? `&${extra}` : "";
  return `/interco/arrivals/${site}?movement=${encodeURIComponent(movementId)}${suffix}`;
}

export async function createIntercoMovement(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const itemIds = form.getAll("item_id").map((v) => String(v)).filter(Boolean);
  const header = movementHeaderFromForm(form);
  const originLicense = header.originLicense;
  const destinationLicense = header.destinationLicense;
  const originFarm = header.originFarm;
  const destinationFarm = header.destinationFarm;
  const truckNumber = header.truckNumber;
  const driver = header.driver;
  const plannedRoute = header.plannedRoute;
  const transferType = header.transferType;
  const invoiceNumber = header.invoiceNumber;
  const paymentTermDays = header.paymentTermDays;
  const plannedDeparture = header.plannedDeparture;
  const plannedArrival = header.plannedArrival;
  const grossWeight = header.grossWeight;
  const grossWeightUom = header.grossWeightUom;
  const transporterLicense = header.transporterLicense;
  const transporterPhone = header.transporterPhone;
  const driverOccupational = header.driverOccupational;
  const driverLicenseNumber = header.driverLicenseNumber;
  const vehicleMake = header.vehicleMake;
  const vehicleModel = header.vehicleModel;
  const vehiclePlate = header.vehiclePlate;
  const metrcManifestNumber = header.metrcManifestNumber;
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    movement_kind: MOVEMENT_KIND.interco,
    origin_farm: originFarm,
    destination_farm: destinationFarm,
    origin_license: originLicense,
    destination_license: destinationLicense,
    truck_number: truckNumber,
    driver,
    planned_route: plannedRoute,
    transfer_type: transferType,
    invoice_number: invoiceNumber,
    payment_term_days: paymentTermDays,
    planned_departure: plannedDeparture,
    planned_arrival: plannedArrival,
    gross_weight: grossWeight,
    gross_weight_uom: grossWeightUom,
    transporter_license: transporterLicense,
    transporter_phone: transporterPhone,
    driver_occupational_license: driverOccupational,
    driver_license_number: driverLicenseNumber,
    vehicle_make: vehicleMake,
    vehicle_model: vehicleModel,
    vehicle_plate: vehiclePlate,
    metrc_manifest_number: metrcManifestNumber,
    status: MOVEMENT_STATUS.building,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO interco_movements (
          id, movement_kind, origin_farm, destination_farm, origin_license, destination_license,
          truck_number, driver, planned_route, transfer_type, invoice_number, payment_term_days,
          planned_departure, planned_arrival, gross_weight, gross_weight_uom,
          transporter_license, transporter_phone, driver_occupational_license, driver_license_number,
          vehicle_make, vehicle_model, vehicle_plate, metrc_manifest_number, status,
          exported_at, completed_at, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason,
          origin_location, destination_location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`
      )
      .bind(
        id,
        MOVEMENT_KIND.interco,
        originFarm,
        destinationFarm,
        originLicense,
        destinationLicense,
        truckNumber,
        driver,
        plannedRoute,
        transferType,
        invoiceNumber,
        paymentTermDays,
        plannedDeparture,
        plannedArrival,
        grossWeight,
        grossWeightUom,
        transporterLicense,
        transporterPhone,
        driverOccupational,
        driverLicenseNumber,
        vehicleMake,
        vehicleModel,
        vehiclePlate,
        metrcManifestNumber,
        MOVEMENT_STATUS.building,
        ts,
        actor.id,
        ts,
        actor.id,
        textOrNull(form.get("origin_location")),
        textOrNull(form.get("destination_location"))
      ),
    ...logsForInsert(db, "interco_movements", id, record, actor.id, SYSTEM_REASON.create, ts),
  ];
  for (const itemId of itemIds) {
    const item = await db
      .prepare(
        `SELECT id, qty, uom, location FROM local_inventory_items WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(itemId)
      .first<{ id: string; qty: number; uom: string; location: string }>();
    if (!item) throw new HttpError(400, "Unknown inventory item.");
    if (item.location === LOC_IN_TRANSIT) {
      throw new HttpError(400, "Items in transit cannot join a building movement.");
    }
    const rowId = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO interco_movement_items (
            id, movement_id, local_inventory_item_id, qty, uom,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(rowId, id, item.id, item.qty, item.uom, ts, actor.id, ts, actor.id)
    );
  }
  await db.batch(stmts);
  return { redirect: movementSurfaceRedirect(form, id) };
}

export async function removeMovementItem(
  db: D1Database,
  movementId: string,
  itemRowId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const movement = await getMovement(db, movementId);
  if (!movement || movement.status !== MOVEMENT_STATUS.building) {
    throw new HttpError(400, "Only a building movement can drop items.");
  }
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE interco_movement_items SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND movement_id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, ts, actor.id, itemRowId, movementId),
    insertLog(db, {
      record_table: "interco_movement_items",
      record_id: itemRowId,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: requireReason(textOrNull(form.get("reason")) ?? "removed from movement"),
      changed_at: ts,
    }),
  ]);
  return { redirect: movementSurfaceRedirect(form, movementId) };
}

function isWetMovementItem(item: { is_wet_lot?: number; package_code?: string }): boolean {
  return Number(item.is_wet_lot) === 1 || !item.package_code;
}

async function appendManifestItem(
  db: D1Database,
  stmts: D1PreparedStatement[],
  movementId: string,
  itemId: string,
  qty: number,
  uom: string,
  actorId: string,
  ts: string
): Promise<void> {
  const rowId = crypto.randomUUID();
  stmts.push(
    db
      .prepare(
        `INSERT INTO interco_movement_items (
          id, movement_id, local_inventory_item_id, qty, uom,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(rowId, movementId, itemId, qty, uom, ts, actorId, ts, actorId),
    ...logsForInsert(
      db,
      "interco_movement_items",
      rowId,
      { id: rowId, movement_id: movementId, local_inventory_item_id: itemId, qty },
      actorId,
      SYSTEM_REASON.create,
      ts
    )
  );
}

export async function addToManifest(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const originLicense = requireText(form.get("origin_license"), "Origin license");
  const originLocation = requireText(form.get("origin_location"), "Origin location");
  const itemId = textOrNull(form.get("item_id"));
  const wetLotId = textOrNull(form.get("wet_lot_id"));
  if (!itemId && !wetLotId) throw new HttpError(400, "Pick material.");
  const addMode = textOrNull(form.get("add_mode")) ?? "new";
  const ts = nowIso();

  let qty = 0;
  let uom = "g";
  let storedId = "";
  if (itemId) {
    const item = await db
      .prepare(
        `SELECT id, qty, uom, location, license_value FROM local_inventory_items
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(itemId)
      .first<{ id: string; qty: number; uom: string; location: string; license_value: string }>();
    if (!item) throw new HttpError(400, "Unknown inventory item.");
    if (item.location === LOC_IN_TRANSIT) {
      throw new HttpError(400, "Items in transit cannot join a building movement.");
    }
    const treeLic = treeLicenseForPackage(item.license_value, item.location);
    if (treeLic !== originLicense || item.location !== originLocation) {
      throw new HttpError(400, ORIGIN_PAIR_ERROR);
    }
    qty = Number(item.qty);
    uom = item.uom;
    storedId = item.id;
  } else {
    const lot = await db
      .prepare(
        `SELECT w.id, w.status, w.weight_grams, b.farm_code, b.license_value
         FROM wet_weight_entries w
         LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
         WHERE w.id = ? AND w.deleted_at IS NULL`
      )
      .bind(wetLotId)
      .first<{
        id: string;
        status: string;
        weight_grams: number;
        farm_code: string | null;
        license_value: string | null;
      }>();
    if (!lot) throw new HttpError(400, "Unknown lot.");
    if (lot.status !== LOT_STATUS.weighing) {
      throw new HttpError(400, "That lot is not at a site.");
    }
    const treeLic = inheritedLotLicense(lot.license_value, lot.farm_code);
    const site = siteOfLicense(treeLic) ?? "PNN";
    const lotLoc = barnLocationForSite(site);
    if (treeLic !== originLicense || lotLoc !== originLocation) {
      throw new HttpError(400, ORIGIN_PAIR_ERROR);
    }
    qty = Number(lot.weight_grams);
    storedId = lot.id;
  }

  let movementId: string | null = null;
  if (addMode === "existing") {
    const active = await getActiveBuildingMovement(db);
    if (active) movementId = active.id;
  }

  if (movementId) {
    const movement = await getMovement(db, movementId);
    if (!movement || movement.status !== MOVEMENT_STATUS.building) {
      throw new HttpError(400, "Only a building movement can take packages.");
    }
    const lockedLic = movement.origin_license;
    const lockedLoc = movement.origin_location ?? "";
    if (lockedLic !== originLicense || lockedLoc !== originLocation) {
      throw new HttpError(400, ORIGIN_PAIR_ERROR);
    }
    const stmts: D1PreparedStatement[] = [];
    await appendManifestItem(db, stmts, movementId, storedId, qty, uom, actor.id, ts);
    await db.batch(stmts);
    return { redirect: "/interco" };
  }

  const id = crypto.randomUUID();
  const originSite = siteOfLicense(originLicense);
  const originFarm = originSite;
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO interco_movements (
          id, movement_kind, origin_farm, destination_farm, origin_license, destination_license,
          truck_number, driver, planned_route, transfer_type, invoice_number, payment_term_days,
          planned_departure, planned_arrival, gross_weight, gross_weight_uom,
          transporter_license, transporter_phone, driver_occupational_license, driver_license_number,
          vehicle_make, vehicle_model, vehicle_plate, metrc_manifest_number, status,
          exported_at, completed_at, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason,
          origin_location, destination_location
        ) VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`
      )
      .bind(
        id,
        MOVEMENT_KIND.interco,
        originFarm,
        originLicense,
        "",
        MOVEMENT_STATUS.building,
        ts,
        actor.id,
        ts,
        actor.id,
        originLocation,
        ""
      ),
    ...logsForInsert(
      db,
      "interco_movements",
      id,
      {
        id,
        movement_kind: MOVEMENT_KIND.interco,
        origin_farm: originFarm,
        origin_license: originLicense,
        destination_license: "",
        status: MOVEMENT_STATUS.building,
        origin_location: originLocation,
        created_at: ts,
        created_by: actor.id,
      },
      actor.id,
      SYSTEM_REASON.create,
      ts
    ),
  ];
  await appendManifestItem(db, stmts, id, storedId, qty, uom, actor.id, ts);
  await db.batch(stmts);
  return { redirect: "/interco" };
}

export async function setManifestDestination(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const movementId = requireText(form.get("movement_id"), "Movement");
  const destLicense = requireText(form.get("destination_license"), "Destination license");
  const movement = await getMovement(db, movementId);
  if (!movement || movement.status !== MOVEMENT_STATUS.building) {
    throw new HttpError(400, "Only a building movement can be edited.");
  }
  if (isExternalLicense(destLicense) && movement.origin_license !== LICENSE_AU_PROCESSOR) {
    throw new HttpError(400, "External destinations ship from the processor license only.");
  }
  const destLoc = deriveDestinationLocation(
    movement.origin_license,
    movement.origin_location ?? "",
    destLicense
  );
  const destSite = siteOfLicense(destLicense);
  const destFarm = destSite;
  const ts = nowIso();
  const header = {
    destination_license: destLicense,
    destination_location: destLoc,
    destination_farm: destFarm,
    metrc_manifest_number: textOrNull(form.get("metrc_manifest_number")),
    truck_number: textOrNull(form.get("truck_number")),
    planned_route: textOrNull(form.get("planned_route")),
    transfer_type: textOrNull(form.get("transfer_type")),
    invoice_number: textOrNull(form.get("invoice_number")),
    payment_term_days: textOrNull(form.get("payment_term_days")),
    planned_departure: textOrNull(form.get("planned_departure")),
    planned_arrival: textOrNull(form.get("planned_arrival")),
    gross_weight: textOrNull(form.get("gross_weight")),
    gross_weight_uom: textOrNull(form.get("gross_weight_uom")),
    transporter_license: textOrNull(form.get("transporter_license")),
    transporter_phone: textOrNull(form.get("transporter_phone")),
    driver: textOrNull(form.get("driver")),
    driver_occupational_license: textOrNull(form.get("driver_occupational_license")),
    driver_license_number: textOrNull(form.get("driver_license_number")),
    vehicle_make: textOrNull(form.get("vehicle_make")),
    vehicle_model: textOrNull(form.get("vehicle_model")),
    vehicle_plate: textOrNull(form.get("vehicle_plate")),
  };
  await db.batch([
    db
      .prepare(
        `UPDATE interco_movements
         SET destination_license = ?, destination_location = ?, destination_farm = ?,
             metrc_manifest_number = ?, truck_number = ?, planned_route = ?, transfer_type = ?,
             invoice_number = ?, payment_term_days = ?, planned_departure = ?, planned_arrival = ?,
             gross_weight = ?, gross_weight_uom = ?, transporter_license = ?, transporter_phone = ?,
             driver = ?, driver_occupational_license = ?, driver_license_number = ?,
             vehicle_make = ?, vehicle_model = ?, vehicle_plate = ?,
             updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(
        header.destination_license,
        header.destination_location,
        header.destination_farm,
        header.metrc_manifest_number,
        header.truck_number,
        header.planned_route,
        header.transfer_type,
        header.invoice_number,
        header.payment_term_days,
        header.planned_departure,
        header.planned_arrival,
        header.gross_weight,
        header.gross_weight_uom,
        header.transporter_license,
        header.transporter_phone,
        header.driver,
        header.driver_occupational_license,
        header.driver_license_number,
        header.vehicle_make,
        header.vehicle_model,
        header.vehicle_plate,
        ts,
        actor.id,
        movementId
      ),
    insertLog(db, {
      record_table: "interco_movements",
      record_id: movementId,
      field: "destination_license",
      old_value: movement.destination_license,
      new_value: destLicense,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.create,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "interco_movements",
      record_id: movementId,
      field: "destination_location",
      old_value: movement.destination_location ?? null,
      new_value: destLoc,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.create,
      changed_at: ts,
    }),
  ]);
  return { redirect: "/interco" };
}

async function finishInternalDoor(
  db: D1Database,
  movementId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const movement = await getMovement(db, movementId);
  if (!movement) throw new HttpError(404, "Unknown movement.");
  const items = await listMovementItems(db, movementId);
  if (items.length === 0) throw new HttpError(400, "Finishing with zero packages is refused.");
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE interco_movements
         SET movement_kind = ?, status = ?, completed_at = ?, exported_at = ?,
             destination_license = ?, destination_location = ?,
             updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(
        MOVEMENT_KIND.virtual,
        MOVEMENT_STATUS.completed,
        ts,
        ts,
        LICENSE_AU_PROCESSOR,
        LOC_CSB,
        ts,
        actor.id,
        movementId
      ),
    insertLog(db, {
      record_table: "interco_movements",
      record_id: movementId,
      field: "status",
      old_value: movement.status,
      new_value: MOVEMENT_STATUS.completed,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.inv_virtual_move,
      changed_at: ts,
    }),
  ];
  for (const item of items) {
    if (isWetMovementItem(item)) continue;
    stmts.push(
      db
        .prepare(
          `UPDATE local_inventory_items SET license_value = ?, location = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(LICENSE_AU_PROCESSOR, LOC_CSB, ts, actor.id, item.local_inventory_item_id),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: item.local_inventory_item_id,
        field: "location",
        old_value: item.location,
        new_value: LOC_CSB,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.inv_virtual_move,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: "/interco?ok=moved" };
}

export async function finishManifest(db: D1Database, form: FormData): Promise<ActionOk> {
  const movementId = requireText(form.get("movement_id"), "Movement");
  const movement = await getMovement(db, movementId);
  if (!movement || movement.status !== MOVEMENT_STATUS.building) {
    throw new HttpError(400, "Only a building movement can complete.");
  }
  const destLicense = String(movement.destination_license ?? "").trim();
  if (!destLicense) throw new HttpError(400, "Pick a destination license.");
  if (isExternalLicense(destLicense) && movement.origin_license !== LICENSE_AU_PROCESSOR) {
    throw new HttpError(400, "External destinations ship from the processor license only.");
  }
  if (isInternalCsaToCsb(movement.origin_license, movement.origin_location ?? "", destLicense)) {
    return finishInternalDoor(db, movementId, form);
  }
  form.set("surface", "floor");
  return finishOutboundShipment(db, movementId, form);
}

export async function saveOutboundHeader(db: D1Database, form: FormData): Promise<ActionOk> {
  const existingId = textOrNull(form.get("movement_id"));
  if (!existingId) return createIntercoMovement(db, form);
  const actor = await requireActor(db, personIdFrom(form));
  const movement = await getMovement(db, existingId);
  if (!movement || movement.status !== MOVEMENT_STATUS.building) {
    throw new HttpError(400, "Only a building movement can be edited.");
  }
  const header = movementHeaderFromForm(form);
  const ts = nowIso();
  const next: Record<string, string | null> = {
    origin_farm: header.originFarm,
    destination_farm: header.destinationFarm,
    origin_license: header.originLicense,
    destination_license: header.destinationLicense,
    truck_number: header.truckNumber,
    driver: header.driver,
    planned_route: header.plannedRoute,
    transfer_type: header.transferType,
    invoice_number: header.invoiceNumber,
    payment_term_days: header.paymentTermDays,
    planned_departure: header.plannedDeparture,
    planned_arrival: header.plannedArrival,
    gross_weight: header.grossWeight,
    gross_weight_uom: header.grossWeightUom,
    transporter_license: header.transporterLicense,
    transporter_phone: header.transporterPhone,
    driver_occupational_license: header.driverOccupational,
    driver_license_number: header.driverLicenseNumber,
    vehicle_make: header.vehicleMake,
    vehicle_model: header.vehicleModel,
    vehicle_plate: header.vehiclePlate,
    metrc_manifest_number: header.metrcManifestNumber,
  };
  const logs = Object.entries(next)
    .filter(([field, value]) => String((movement as Record<string, unknown>)[field] ?? "") !== String(value ?? ""))
    .map(([field, value]) =>
      insertLog(db, {
        record_table: "interco_movements",
        record_id: existingId,
        field,
        old_value: String((movement as Record<string, unknown>)[field] ?? "") || null,
        new_value: value,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.create,
        changed_at: ts,
      })
    );
  await db.batch([
    db
      .prepare(
        `UPDATE interco_movements SET
          origin_farm = ?, destination_farm = ?, origin_license = ?, destination_license = ?,
          truck_number = ?, driver = ?, planned_route = ?, transfer_type = ?, invoice_number = ?,
          payment_term_days = ?, planned_departure = ?, planned_arrival = ?,
          gross_weight = ?, gross_weight_uom = ?, transporter_license = ?, transporter_phone = ?,
          driver_occupational_license = ?, driver_license_number = ?,
          vehicle_make = ?, vehicle_model = ?, vehicle_plate = ?, metrc_manifest_number = ?,
          updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(
        header.originFarm,
        header.destinationFarm,
        header.originLicense,
        header.destinationLicense,
        header.truckNumber,
        header.driver,
        header.plannedRoute,
        header.transferType,
        header.invoiceNumber,
        header.paymentTermDays,
        header.plannedDeparture,
        header.plannedArrival,
        header.grossWeight,
        header.grossWeightUom,
        header.transporterLicense,
        header.transporterPhone,
        header.driverOccupational,
        header.driverLicenseNumber,
        header.vehicleMake,
        header.vehicleModel,
        header.vehiclePlate,
        header.metrcManifestNumber,
        ts,
        actor.id,
        existingId
      ),
    ...logs,
  ]);
  return { redirect: movementSurfaceRedirect(form, existingId) };
}

export async function addDrySpaceToMovement(db: D1Database, form: FormData): Promise<ActionOk> {
  const spaceName = requireText(form.get("space_name"), "Dry space");
  let movementId = textOrNull(form.get("movement_id"));
  if (!movementId) {
    const created = await createIntercoMovement(db, form);
    const url = new URL(created.redirect, "https://local");
    movementId = url.searchParams.get("movement");
    if (!movementId) throw new HttpError(500, "Movement was not created.");
  }
  const actor = await requireActor(db, personIdFrom(form));
  const movement = await getMovement(db, movementId);
  if (!movement || movement.status !== MOVEMENT_STATUS.building) {
    throw new HttpError(400, "Only a building movement can take packages.");
  }
  const residents = await db
    .prepare(
      `SELECT i.id, i.qty, i.uom, i.location FROM local_inventory_items i
       WHERE i.deleted_at IS NULL AND i.item_kind IN ('SPR', 'WIP') AND i.location = ?
         AND NOT EXISTS (
           SELECT 1 FROM interco_movement_items mi
           JOIN interco_movements m ON m.id = mi.movement_id
           WHERE mi.local_inventory_item_id = i.id
             AND mi.deleted_at IS NULL AND m.deleted_at IS NULL AND m.status = 'building'
         )`
    )
    .bind(spaceName)
    .all<{ id: string; qty: number; uom: string; location: string }>();
  const items = residents.results ?? [];
  if (items.length === 0) throw new HttpError(400, "That dry space has nothing to ship.");
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const item of items) {
    if (item.location === LOC_IN_TRANSIT) continue;
    const rowId = crypto.randomUUID();
    const record = {
      id: rowId,
      movement_id: movementId,
      local_inventory_item_id: item.id,
      qty: item.qty,
      uom: item.uom,
      created_at: ts,
      created_by: actor.id,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO interco_movement_items (
            id, movement_id, local_inventory_item_id, qty, uom,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(rowId, movementId, item.id, item.qty, item.uom, ts, actor.id, ts, actor.id),
      ...logsForInsert(db, "interco_movement_items", rowId, record, actor.id, SYSTEM_REASON.create, ts)
    );
  }
  if (stmts.length === 0) throw new HttpError(400, "That dry space has nothing to ship.");
  await db.batch(stmts);
  return { redirect: movementSurfaceRedirect(form, movementId) };
}

export async function addItemsToMovement(db: D1Database, form: FormData): Promise<ActionOk> {
  const itemIds = form.getAll("item_id").map((v) => String(v)).filter(Boolean);
  if (itemIds.length === 0) throw new HttpError(400, "Pick at least one package.");
  let movementId = textOrNull(form.get("movement_id"));
  if (!movementId) {
    const created = await createIntercoMovement(db, form);
    const url = new URL(created.redirect, "https://local");
    movementId = url.searchParams.get("movement");
    if (!movementId) throw new HttpError(500, "Movement was not created.");
    return { redirect: movementSurfaceRedirect(form, movementId) };
  }
  const actor = await requireActor(db, personIdFrom(form));
  const movement = await getMovement(db, movementId);
  if (!movement || movement.status !== MOVEMENT_STATUS.building) {
    throw new HttpError(400, "Only a building movement can take packages.");
  }
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const itemId of itemIds) {
    const item = await db
      .prepare(
        `SELECT id, qty, uom, location FROM local_inventory_items WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(itemId)
      .first<{ id: string; qty: number; uom: string; location: string }>();
    if (!item) throw new HttpError(400, "Unknown inventory item.");
    if (item.location === LOC_IN_TRANSIT) {
      throw new HttpError(400, "Items in transit cannot join a building movement.");
    }
    if (!isProcessorSideLocation(item.location)) {
      throw new HttpError(400, "Ship external picks Building 23 only.");
    }
    const rowId = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO interco_movement_items (
            id, movement_id, local_inventory_item_id, qty, uom,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(rowId, movementId, item.id, item.qty, item.uom, ts, actor.id, ts, actor.id),
      ...logsForInsert(
        db,
        "interco_movement_items",
        rowId,
        { id: rowId, movement_id: movementId, local_inventory_item_id: item.id, qty: item.qty },
        actor.id,
        SYSTEM_REASON.create,
        ts
      )
    );
  }
  await db.batch(stmts);
  return { redirect: movementSurfaceRedirect(form, movementId) };
}

export async function finishSiteSend(db: D1Database, siteRaw: string, form: FormData): Promise<ActionOk> {
  const site = parseIntercoSite(siteRaw);
  if (!site) throw new HttpError(404, "Unknown site.");
  const lane = laneById(textOrNull(form.get("lane")));
  if (!lane || lane.from !== siteFarmCode(site)) {
    throw new HttpError(400, "Pick a lane from this site.");
  }
  const itemIds = form.getAll("item_id").map((v) => String(v)).filter(Boolean);
  if (itemIds.length === 0) throw new HttpError(400, "Pick at least one barn package.");
  const barn = barnLocationForSite(siteFarmCode(site));
  for (const itemId of itemIds) {
    const item = await getRow(db, "local_inventory_items", itemId);
    if (!item || item.deleted_at) throw new HttpError(400, "Unknown inventory item.");
    if (String(item.location) !== barn) {
      throw new HttpError(400, "Send picks from the barn only.");
    }
  }
  form.set("origin_license", originLicenseForLane(lane));
  form.set("destination_license", destinationLicenseForLane(lane));
  form.set("origin_farm", lane.from);
  form.set("destination_farm", lane.to);
  form.set("surface", "send");
  form.set("site", site);
  const created = await createIntercoMovement(db, form);
  const movementId = new URL(created.redirect, "https://local").searchParams.get("movement");
  if (!movementId) throw new HttpError(500, "Send did not mint a movement.");
  const actor = await requireActor(db, personIdFrom(form));
  const ts = nowIso();
  const wetIds = form.getAll("wet_lot_id").map((v) => String(v)).filter(Boolean);
  const truck = textOrNull(form.get("truck_number"));
  for (const lotId of wetIds) {
    const lot = await db
      .prepare(
        `SELECT id, status, farm_code, truck_number FROM wet_weight_entries WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(lotId)
      .first<{ id: string; status: string; farm_code: string | null; truck_number: string | null }>();
    if (!lot) throw new HttpError(400, "Unknown lot.");
    if (lot.farm_code !== siteFarmCode(site)) {
      throw new HttpError(400, "That lot is not at this site.");
    }
    if (lot.status === LOT_STATUS.in_transit) continue;
    await db.batch([
      db
        .prepare(
          `UPDATE wet_weight_entries SET status = ?, truck_number = COALESCE(?, truck_number), updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(LOT_STATUS.in_transit, truck, ts, actor.id, lot.id),
      insertLog(db, {
        record_table: "wet_weight_entries",
        record_id: lot.id,
        field: "status",
        old_value: lot.status,
        new_value: LOT_STATUS.in_transit,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.inv_moved_out,
        changed_at: ts,
      }),
    ]);
  }
  return finishOutboundShipment(db, movementId, form);
}

export async function finishOutboundShipment(
  db: D1Database,
  movementId: string,
  form: FormData
): Promise<ActionOk> {
  const items = await listMovementItems(db, movementId);
  if (items.length === 0) throw new HttpError(400, "Finishing with zero packages is refused.");
  const actor = await requireActor(db, personIdFrom(form));
  await stampMovementExported(db, movementId, actor.id);
  const completed = await completeMovement(db, movementId, form);
  void completed;
  const surface = textOrNull(form.get("surface"));
  if (surface === "send" || surface === "floor") {
    return { redirect: `/interco?ok=sent&movement=${encodeURIComponent(movementId)}` };
  }
  return { redirect: `/interco/ship-external/${encodeURIComponent(movementId)}/done` };
}

export async function stampMovementExported(
  db: D1Database,
  movementId: string,
  actorId: string
): Promise<void> {
  const ts = nowIso();
  const movement = await getMovement(db, movementId);
  if (!movement) throw new HttpError(404, "Unknown movement.");
  await db.batch([
    db
      .prepare(
        `UPDATE interco_movements SET exported_at = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, ts, actorId, movementId),
    insertLog(db, {
      record_table: "interco_movements",
      record_id: movementId,
      field: "exported_at",
      old_value: movement.exported_at,
      new_value: ts,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.create,
      changed_at: ts,
    }),
  ]);
}

export async function completeMovement(
  db: D1Database,
  movementId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const movement = await getMovement(db, movementId);
  if (!movement) throw new HttpError(404, "Unknown movement.");
  if (movement.status !== MOVEMENT_STATUS.building) {
    throw new HttpError(400, "Only a building movement can complete.");
  }
  const items = await listMovementItems(db, movementId);
  if (items.length === 0) throw new HttpError(400, "Finishing with zero packages is refused.");
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE interco_movements SET status = ?, completed_at = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(MOVEMENT_STATUS.completed, ts, ts, actor.id, movementId),
    insertLog(db, {
      record_table: "interco_movements",
      record_id: movementId,
      field: "status",
      old_value: movement.status,
      new_value: MOVEMENT_STATUS.completed,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.inv_moved_out,
      changed_at: ts,
    }),
  ];
  for (const item of items) {
    if (isWetMovementItem(item)) {
      stmts.push(
        db
          .prepare(
            `UPDATE wet_weight_entries SET status = ?, updated_at = ?, updated_by = ?
             WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(LOT_STATUS.in_transit, ts, actor.id, item.local_inventory_item_id),
        insertLog(db, {
          record_table: "wet_weight_entries",
          record_id: item.local_inventory_item_id,
          field: "status",
          old_value: LOT_STATUS.weighing,
          new_value: LOT_STATUS.in_transit,
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.inv_moved_out,
          changed_at: ts,
        })
      );
      continue;
    }
    stmts.push(
      ...setItemQtyLocationStmts(
        db,
        { id: item.local_inventory_item_id, qty: Number(item.qty), location: item.location },
        { location: LOC_IN_TRANSIT },
        actor.id,
        ts,
        SYSTEM_REASON.inv_moved_out
      )
    );
  }
  await db.batch(stmts);
  const surface = textOrNull(form.get("surface"));
  if (surface === "send" || surface === "floor") {
    return { redirect: `/interco?ok=sent&movement=${encodeURIComponent(movementId)}` };
  }
  return { redirect: `/interco/ship-external/${encodeURIComponent(movementId)}/done` };
}

export async function receiveMovementItems(
  db: D1Database,
  movementId: string,
  itemRowIds: string[],
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const movement = await getMovement(db, movementId);
  if (!movement || movement.status !== MOVEMENT_STATUS.completed) {
    throw new HttpError(400, "Only a completed movement can receive.");
  }
  const items = await listMovementItems(db, movementId);
  const wanted = new Set(itemRowIds);
  const open = items.filter((i) => !i.received_at && !i.rejected_at && !i.receipt_id && wanted.has(i.id));
  if (open.length === 0) throw new HttpError(400, "No open items to receive.");
  const overrideRaw = textOrNull(form.get("received_qty"));
  // THE TAG LAW (canon 0.30.38, fork F4): a single-item receive may hand the
  // package its METRC tag; wet items have no ledger row yet (the receipt mints
  // it), so the tag waits for the pencil there.
  const typedTag = open.length === 1 ? normalizeMetrcTag(textOrNull(form.get("metrc_tag"))) : null;
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const item of open) {
    const qty = overrideRaw && open.length === 1 ? parseGrams(overrideRaw, "Weight to receive") : Number(item.qty);
    if (typedTag && !isWetMovementItem(item)) {
      stmts.push(
        db
          .prepare(
            `UPDATE local_inventory_items SET metrc_tag = ?, updated_at = ?, updated_by = ?
             WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(typedTag, ts, actor.id, item.local_inventory_item_id),
        insertLog(db, {
          record_table: "local_inventory_items",
          record_id: item.local_inventory_item_id,
          field: "metrc_tag",
          old_value: item.metrc_tag ?? null,
          new_value: typedTag,
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.metrc_tag_captured,
          changed_at: ts,
        })
      );
    }
    stmts.push(
      db
        .prepare(
          `UPDATE interco_movement_items SET received_at = ?, received_by = ?, received_qty = ?,
                  updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, qty, ts, actor.id, item.id),
      insertLog(db, {
        record_table: "interco_movement_items",
        record_id: item.id,
        field: "received_qty",
        old_value: null,
        new_value: String(qty),
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.inv_received,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: arrivalsRedirect(movement.destination_farm, movementId, "ok=received") };
}

export async function finishReceipt(db: D1Database, movementId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const movement = await getMovement(db, movementId);
  if (!movement || movement.status !== MOVEMENT_STATUS.completed) {
    throw new HttpError(400, "Only a completed movement can finish a receipt.");
  }
  const items = await listMovementItems(db, movementId);
  const received = items.filter((i) => i.received_at && !i.receipt_id && !i.rejected_at);
  if (received.length === 0) throw new HttpError(400, "Finish Receipt needs at least one received item.");
  const destSite = farmToSite(movement.destination_farm);
  const destFarm = destSite === "arl" ? "ARL" : destSite === "pns" ? "PNS" : "PNN";
  // Canon 0.30.26: the receipt lands where the manifest said (THE INBOX LAW:
  // the destination site's barn, or CSB at 694 for the door), under the
  // manifest's destination license; the site barn and arrival license are the
  // fallback for a manifest with no destination written.
  const destLoc =
    (movement.destination_location ?? "").trim() ||
    deriveDestinationLocation(movement.origin_license, movement.origin_location ?? "", movement.destination_license ?? "") ||
    barnLocationForSite(destFarm);
  const destLicense = (movement.destination_license ?? "").trim() || licenseForSiteArrival(destFarm);
  const receiptId = crypto.randomUUID();
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO interco_receipts (
          id, movement_id, note, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(receiptId, movementId, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "interco_receipts",
      receiptId,
      { id: receiptId, movement_id: movementId, created_at: ts, created_by: actor.id },
      actor.id,
      SYSTEM_REASON.inv_received,
      ts
    ),
  ];
  const arrivedLots = new Set<string>();
  for (const item of received) {
    const wet = isWetMovementItem(item);
    stmts.push(
      db
        .prepare(
          `UPDATE interco_movement_items SET receipt_id = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(receiptId, ts, actor.id, item.id),
      insertLog(db, {
        record_table: "interco_movement_items",
        record_id: item.id,
        field: "receipt_id",
        old_value: null,
        new_value: receiptId,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.inv_received,
        changed_at: ts,
      })
    );
    if (!wet) {
      const nextQty = item.received_qty != null ? Number(item.received_qty) : Number(item.qty);
      stmts.push(
        ...setItemQtyLocationStmts(
          db,
          {
            id: item.local_inventory_item_id,
            qty: Number(item.qty),
            location: item.location,
            farm_code: item.farm_code,
          },
          {
            location: destLoc,
            farm_code: destFarm,
            license_value: destLicense,
            qty: nextQty,
          },
          actor.id,
          ts,
          SYSTEM_REASON.inv_received
        )
      );
    }
    // THE TRUCK CARRIES ITS PAPER (canon 0.30.9): a receipt on a manifest that
    // carries a truck lot (WET item or born package) is the truck's arrival
    // too. Before this the pane moved the package and left the lot in transit,
    // a stranded truck row; a WET item never even took the receipt id, so its
    // manifest rode the road forever.
    const lotId = item.lot_id ?? (wet ? item.local_inventory_item_id : null);
    if (lotId && !arrivedLots.has(lotId)) {
      const lot = await db.prepare(ARRIVAL_LOT_SQL).bind(lotId).first<ArrivalLot>();
      if (lot && lot.status === LOT_STATUS.in_transit) {
        arrivedLots.add(lotId);
        const existing = wet ? null : { id: item.local_inventory_item_id };
        stmts.push(...lotArrivalStmts(db, lot, destFarm, existing, actor.id, ts));
      }
    }
  }
  await db.batch(stmts);
  // Canon 0.30.25: the finished manifest has left the arrivals list, so the
  // redirect drops it from the URL too; nothing stays selected.
  return { redirect: `/interco/arrivals/${farmToSite(movement.destination_farm)}?ok=receipt` };
}

export async function rejectMovementItems(
  db: D1Database,
  movementId: string,
  itemRowIds: string[],
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const movement = await getMovement(db, movementId);
  if (!movement || movement.status !== MOVEMENT_STATUS.completed) {
    throw new HttpError(400, "Only a completed movement can reject.");
  }
  const items = await listMovementItems(db, movementId);
  const wanted = new Set(itemRowIds);
  const open = items.filter((i) => !i.received_at && !i.rejected_at && wanted.has(i.id));
  if (open.length === 0) throw new HttpError(400, "No open items to reject.");
  const ts = nowIso();
  const origin = movement.origin_farm ?? "";
  const stmts: D1PreparedStatement[] = [];
  for (const item of open) {
    stmts.push(
      db
        .prepare(
          `UPDATE interco_movement_items SET rejected_at = ?, rejected_by = ?, reject_reason = ?,
                  updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, reason, ts, actor.id, item.id),
      ...setItemQtyLocationStmts(
        db,
        { id: item.local_inventory_item_id, qty: Number(item.qty), location: item.location },
        { location: origin },
        actor.id,
        ts,
        SYSTEM_REASON.inv_rejected
      )
    );
  }
  await db.batch(stmts);
  return { redirect: arrivalsRedirect(movement.destination_farm, movementId, "ok=rejected") };
}

export async function voidReceipt(db: D1Database, receiptId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const receipt = await getReceipt(db, receiptId);
  if (!receipt) throw new HttpError(404, "Unknown receipt.");
  const items = await db
    .prepare(
      `SELECT mi.id, mi.local_inventory_item_id, mi.qty, i.location
       FROM interco_movement_items mi
       JOIN local_inventory_items i ON i.id = mi.local_inventory_item_id
       WHERE mi.receipt_id = ? AND mi.deleted_at IS NULL`
    )
    .bind(receiptId)
    .all<{ id: string; local_inventory_item_id: string; qty: number; location: string }>();
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE interco_receipts SET deleted_at = ?, deleted_by = ?, delete_reason = ?,
                updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, reason, ts, actor.id, receiptId),
    insertLog(db, {
      record_table: "interco_receipts",
      record_id: receiptId,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ];
  for (const item of items.results ?? []) {
    stmts.push(
      db
        .prepare(
          `UPDATE interco_movement_items SET received_at = NULL, received_by = NULL, receipt_id = NULL,
                  received_qty = NULL, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, item.id),
      ...setItemQtyLocationStmts(
        db,
        { id: item.local_inventory_item_id, qty: Number(item.qty), location: item.location },
        { location: LOC_IN_TRANSIT },
        actor.id,
        ts,
        SYSTEM_REASON.inv_unreceived
      )
    );
  }
  await db.batch(stmts);
  return { redirect: arrivalsRedirect(receipt.destination_farm, receipt.movement_id, "ok=voided") };
}

/** Owner ruling 2026-09-06 (canon 0.26.0): "logistics moves, like everything
 * else, needs a place in the data queue in Admin as well." The queue's reasoned
 * void: refused while any item stands received (un-receive first); a building
 * movement simply dies (nothing flipped yet); a completed movement's items
 * return from IN-TRANSIT to the origin side (the origin farm's barn on an
 * interco move, CSB on an external one, per the barn pick basis law); the
 * movement and its item rows soft-delete with the reason, which also drops any
 * unmarked manifest off the one export home (its query filters deleted rows). */
async function planVoidLogisticsMove(db: D1Database, movementId: string, form: FormData): Promise<D1PreparedStatement[]> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const movement = await getMovement(db, movementId);
  if (!movement) throw new HttpError(404, "Unknown movement.");
  const items = await listMovementItems(db, movementId);
  const block = movementVoidBlock(items.map((i) => ({ received_at: i.received_at, deleted_at: null })));
  if (block) throw new HttpError(400, block);
  const ts = nowIso();
  const returnLocation =
    movement.movement_kind === MOVEMENT_KIND.interco && movement.origin_farm
      ? barnLocationForSite(movement.origin_farm as "ARL" | "PNN" | "PNS")
      : LOC_CSB;
  const stmts: D1PreparedStatement[] = [];
  for (const item of items) {
    if (item.location === LOC_IN_TRANSIT) {
      stmts.push(
        ...setItemQtyLocationStmts(
          db,
          { id: item.local_inventory_item_id, qty: Number(item.qty), location: item.location },
          { location: returnLocation },
          actor.id,
          ts,
          SYSTEM_REASON.inv_move_voided
        )
      );
    }
    stmts.push(
      db
        .prepare(
          `UPDATE interco_movement_items SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, ts, actor.id, item.id)
    );
  }
  stmts.push(
    db
      .prepare(
        `UPDATE interco_movements SET status = ?, deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(MOVEMENT_STATUS.voided, ts, actor.id, reason, ts, actor.id, movementId),
    insertLog(db, {
      record_table: "interco_movements",
      record_id: movementId,
      field: "voided",
      old_value: movement.status,
      new_value: MOVEMENT_STATUS.voided,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    })
  );
  return stmts;
}

export async function voidLogisticsMove(db: D1Database, movementId: string, form: FormData): Promise<ActionOk> {
  await db.batch(await planVoidLogisticsMove(db, movementId, form));
  return { redirect: "/admin/queues" };
}

function checkedIds(form: FormData, name: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of form.getAll(name)) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** THE CHECK-ALL (canon 0.30.212): one reason voids every checked row of one queue. Every id is checked before anything is written. */
export async function voidCheckedQueueRows(db: D1Database, queueKey: string, form: FormData): Promise<ActionOk> {
  const queue = queues().find((item) => item.key === queueKey);
  if (!queue) throw new HttpError(404, "Unknown queue.");
  const ids = checkedIds(form, "id");
  if (ids.length === 0) throw refusal(400, { key: "Nothing checked.", vars: {} });
  const reason = requireReason(textOrNull(form.get("reason")));
  const actor = await requireActor(db, personIdFrom(form));
  const one = new FormData();
  one.set("person_id", actor.id);
  one.set("reason", reason);
  one.set("back", "/admin/queues");
  const stmts: D1PreparedStatement[] = [];
  for (const id of ids) {
    try {
      stmts.push(...(await planVoidRecord(db, queue.entity, id, one)));
    } catch (err) {
      const words = err instanceof HttpError ? err.message : "That row cannot be voided.";
      throw refusal(err instanceof HttpError ? err.status : 400, { key: "{row} was not voided: {why}", vars: { row: id, why: words } });
    }
  }
  const size = 80;
  for (let i = 0; i < stmts.length; i += size) await db.batch(stmts.slice(i, i + size));
  return { redirect: `/admin/queues?ok=voided&n=${ids.length}` };
}

/** THE CHECK-ALL (canon 0.30.212): Logistics Moves, same void path, one reason, nothing written if one row refuses. */
export async function voidCheckedMovements(db: D1Database, form: FormData): Promise<ActionOk> {
  const ids = checkedIds(form, "id");
  if (ids.length === 0) throw refusal(400, { key: "Nothing checked.", vars: {} });
  const reason = requireReason(textOrNull(form.get("reason")));
  const actor = await requireActor(db, personIdFrom(form));
  const one = new FormData();
  one.set("person_id", actor.id);
  one.set("reason", reason);
  const stmts: D1PreparedStatement[] = [];
  for (const id of ids) {
    try {
      stmts.push(...(await planVoidLogisticsMove(db, id, one)));
    } catch (err) {
      const words = err instanceof HttpError ? err.message : "That row cannot be voided.";
      throw refusal(err instanceof HttpError ? err.status : 400, { key: "{row} was not voided: {why}", vars: { row: id, why: words } });
    }
  }
  const size = 80;
  for (let i = 0; i < stmts.length; i += size) await db.batch(stmts.slice(i, i + size));
  return { redirect: `/admin/queues?ok=voided&n=${ids.length}` };
}

export async function unreceiveItem(db: D1Database, itemRowId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const item = await db
    .prepare(
      `SELECT mi.id, mi.movement_id, mi.local_inventory_item_id, mi.qty, i.location
       FROM interco_movement_items mi
       JOIN local_inventory_items i ON i.id = mi.local_inventory_item_id
       WHERE mi.id = ? AND mi.deleted_at IS NULL`
    )
    .bind(itemRowId)
    .first<{ id: string; movement_id: string; local_inventory_item_id: string; qty: number; location: string }>();
  if (!item) throw new HttpError(404, "Unknown movement item.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE interco_movement_items SET received_at = NULL, received_by = NULL, receipt_id = NULL,
                received_qty = NULL, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, item.id),
    insertLog(db, {
      record_table: "interco_movement_items",
      record_id: item.id,
      field: "received_at",
      old_value: "received",
      new_value: null,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "interco_movement_items",
      record_id: item.id,
      field: "received_qty",
      old_value: "received",
      new_value: null,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
    ...setItemQtyLocationStmts(
      db,
      { id: item.local_inventory_item_id, qty: Number(item.qty), location: item.location },
      { location: LOC_IN_TRANSIT },
      actor.id,
      ts,
      SYSTEM_REASON.inv_unreceived
    ),
  ]);
  const movement = await getMovement(db, item.movement_id);
  return { redirect: arrivalsRedirect(movement?.destination_farm, item.movement_id, "ok=unreceived") };
}

export async function virtualMoveItems(
  db: D1Database,
  direction: "to_processor" | "to_grow",
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const itemIds = form.getAll("item_id").map((v) => String(v)).filter(Boolean);
  if (itemIds.length === 0) throw new HttpError(400, "Select at least one inventory item.");
  const destRaw = textOrNull(form.get("dest_location"));
  if (direction === "to_processor") {
    if (!destRaw || !isProcessorSideLocation(destRaw)) {
      throw new HttpError(400, "Pick a processor location.");
    }
  }
  const landing = virtualMoveLanding(direction, destRaw ?? undefined);
  const originLicense = direction === "to_processor" ? LICENSE_AU_GROW : LICENSE_AU_PROCESSOR;
  const destinationLicense = landing.license;
  const id = crypto.randomUUID();
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO interco_movements (
          id, movement_kind, origin_farm, destination_farm, origin_license, destination_license,
          truck_number, driver, status,
          exported_at, completed_at, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, NULL, NULL, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(
        id,
        MOVEMENT_KIND.virtual,
        originLicense,
        destinationLicense,
        MOVEMENT_STATUS.completed,
        ts,
        ts,
        actor.id,
        ts,
        actor.id
      ),
    ...logsForInsert(
      db,
      "interco_movements",
      id,
      {
        id,
        movement_kind: MOVEMENT_KIND.virtual,
        origin_license: originLicense,
        destination_license: destinationLicense,
        status: MOVEMENT_STATUS.completed,
        created_at: ts,
        created_by: actor.id,
      },
      actor.id,
      SYSTEM_REASON.inv_virtual_move,
      ts
    ),
  ];
  for (const itemId of itemIds) {
    const item = await db
      .prepare(
        `SELECT id, qty, uom, location, license_value FROM local_inventory_items
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(itemId)
      .first<{ id: string; qty: number; uom: string; location: string; license_value: string }>();
    if (!item) throw new HttpError(400, "Unknown inventory item.");
    const rowId = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO interco_movement_items (
            id, movement_id, local_inventory_item_id, qty, uom,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(rowId, id, item.id, item.qty, item.uom, ts, actor.id, ts, actor.id),
      db
        .prepare(
          `UPDATE local_inventory_items SET license_value = ?, location = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(landing.license, landing.location, ts, actor.id, item.id),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: item.id,
        field: "license_value",
        old_value: item.license_value,
        new_value: landing.license,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.inv_virtual_move,
        changed_at: ts,
      }),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: item.id,
        field: "location",
        old_value: item.location,
        new_value: landing.location,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.inv_virtual_move,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: `/interco?ok=moved` };
}

/** THE MANIFEST BUILDER (canon 0.30.125). Owner, 2026-09-18: the three-pane
 * surface's [finish]; his pick "Download at once, and record". One
 * interco_movements row, finished as it lands (status completed, the T3 header
 * as typed, the receive-into pick as destination_location, the farms from the
 * license list), one item per package with the METRC tag and the price typed
 * beside it (local_inventory_item_id empty: the package is the mirror's, no
 * ledger item behind it). The manifest CSV pends on Pending Data Uploads as
 * every completed movement's does, and the redirect opens the page with the
 * file already downloading. Refusals in words: an unknown license, the same
 * license twice, a tag off the origin's mirror rows, a tag already riding a
 * finished manifest (his pick "Dim, no >>"), a price that is not a number. */
export async function finishManifestBuild(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const parsed = parseFinishForm(form);
  if (!parsed.ok) throw new HttpError(400, parsed.error);
  const input = parsed.value;
  const licenses = await listLookupValues(db, "license");
  const origin = licenses.find((o) => o.value === input.originLicense);
  if (!origin) throw new HttpError(400, MANIFEST_REFUSAL.originUnknown);
  const destination = licenses.find((o) => o.value === input.destinationLicense);
  if (!destination) throw new HttpError(400, MANIFEST_REFUSAL.destinationUnknown);
  const tags = input.packages.map((p) => p.tag);
  const mirror = await listMetrcPackagesByTags(db, tags);
  for (const tag of tags) {
    const row = mirror.get(tag);
    if (!row || String(row.license_value ?? "") !== input.originLicense || row.gone_at != null) {
      throw new HttpError(400, `${MANIFEST_REFUSAL.notInMirror} (${tag.slice(-6)})`);
    }
  }
  const manifested = await listManifestedTags(db, input.originLicense);
  for (const tag of tags) {
    const riding = manifested.get(tag);
    if (riding) throw new HttpError(400, `${MANIFEST_REFUSAL.alreadyManifested} (${tag.slice(-6)}, ${movementIdShort(riding)})`);
  }
  const id = crypto.randomUUID();
  const ts = nowIso();
  const h = input.header;
  const blank = (v: string) => (v.trim() === "" ? null : v.trim());
  const record: Record<string, unknown> = {
    id,
    movement_kind: MOVEMENT_KIND.interco,
    origin_farm: origin.farm_code ?? null,
    destination_farm: destination.farm_code ?? null,
    origin_license: input.originLicense,
    destination_license: input.destinationLicense,
    driver: blank(h.driver),
    planned_route: blank(h.planned_route),
    transfer_type: blank(h.transfer_type),
    invoice_number: blank(h.invoice_number),
    payment_term_days: blank(h.payment_term_days),
    planned_departure: blank(h.planned_departure),
    planned_arrival: blank(h.planned_arrival),
    gross_weight: blank(h.gross_weight),
    gross_weight_uom: blank(h.gross_weight_uom),
    transporter_license: blank(h.transporter_license),
    transporter_phone: blank(h.transporter_phone),
    driver_occupational_license: blank(h.driver_occupational_license),
    driver_license_number: blank(h.driver_license_number),
    vehicle_make: blank(h.vehicle_make),
    vehicle_model: blank(h.vehicle_model),
    vehicle_plate: blank(h.vehicle_plate),
    status: MOVEMENT_STATUS.completed,
    completed_at: ts,
    destination_location: input.destinationLocation,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO interco_movements (
          id, movement_kind, origin_farm, destination_farm, origin_license, destination_license,
          truck_number, driver, planned_route, transfer_type, invoice_number, payment_term_days,
          planned_departure, planned_arrival, gross_weight, gross_weight_uom,
          transporter_license, transporter_phone, driver_occupational_license, driver_license_number,
          vehicle_make, vehicle_model, vehicle_plate, metrc_manifest_number, status,
          exported_at, completed_at, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason,
          origin_location, destination_location
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?)`
      )
      .bind(
        id,
        MOVEMENT_KIND.interco,
        record.origin_farm,
        record.destination_farm,
        input.originLicense,
        input.destinationLicense,
        record.driver,
        record.planned_route,
        record.transfer_type,
        record.invoice_number,
        record.payment_term_days,
        record.planned_departure,
        record.planned_arrival,
        record.gross_weight,
        record.gross_weight_uom,
        record.transporter_license,
        record.transporter_phone,
        record.driver_occupational_license,
        record.driver_license_number,
        record.vehicle_make,
        record.vehicle_model,
        record.vehicle_plate,
        MOVEMENT_STATUS.completed,
        ts,
        ts,
        actor.id,
        ts,
        actor.id,
        input.destinationLocation
      ),
    ...logsForInsert(db, "interco_movements", id, record, actor.id, SYSTEM_REASON.create, ts),
  ];
  for (const pkg of input.packages) {
    const row = mirror.get(pkg.tag)!;
    const qty = row.quantity == null ? 0 : Number(row.quantity);
    const uom = String(row.uom ?? "").trim() || "ea";
    const rowId = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO interco_movement_items (
            id, movement_id, local_inventory_item_id, qty, uom, metrc_tag, wholesale_price,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(rowId, id, qty, uom, pkg.tag, pkg.wholesalePrice, ts, actor.id, ts, actor.id),
      insertLog(db, {
        record_table: "interco_movement_items",
        record_id: rowId,
        field: "metrc_tag",
        old_value: null,
        new_value: pkg.tag,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.create,
        changed_at: ts,
      })
    );
    if (pkg.wholesalePrice) {
      stmts.push(
        insertLog(db, {
          record_table: "interco_movement_items",
          record_id: rowId,
          field: "wholesale_price",
          old_value: null,
          new_value: pkg.wholesalePrice,
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.create,
          changed_at: ts,
        })
      );
    }
  }
  await db.batch(stmts);
  return {
    redirect: `${MANIFEST_PATH}?ok=manifest&movement=${encodeURIComponent(id)}&n=${input.packages.length}&origin=${encodeURIComponent(input.originLicense)}`,
  };
}

/** The T3 file's own path under the interco gate (the export home's copy sits
 * behind Admin's), so the TL who finished the manifest can pull it again. */
export function manifestDownloadPath(movementId: string): string {
  return manifestCsvPath(movementId);
}

export async function buildManifestCsv(db: D1Database, movementId: string): Promise<{
  body: string;
  filename: string;
}> {
  const movement = await getMovement(db, movementId);
  if (!movement) throw new HttpError(404, "Unknown movement.");
  const items = await listMovementItems(db, movementId);
  const header: T3ManifestHeader = headerFromMovement(movement);
  // THE TAG LAW (canon 0.30.38; Patrick: "Manifest CSV export uses HBN where
  // package tag belongs."): the package's METRC tag when the ledger holds one,
  // the internal code otherwise, so the missing tag stays visible. THE
  // MANIFEST BUILDER (canon 0.30.125): the wholesale price typed beside a
  // package prints in its T3 column.
  const packages = items.map((item) => ({ id: metrcFacingTag(item), wholesalePrice: item.wholesale_price ?? null }));
  return {
    body: manifestCsv(header, packages, { includeTransporter: movement.movement_kind !== "virtual" }),
    filename: manifestFilename(movement.id, yyyymmddFromIso(movement.created_at)),
  };
}

export async function buildReceiveCsv(db: D1Database, receiptId: string): Promise<{
  body: string;
  filename: string;
  harvest_batch_id: string;
}> {
  const receipt = await getReceipt(db, receiptId);
  if (!receipt) throw new HttpError(404, "Unknown receipt.");
  const movement = await getMovement(db, receipt.movement_id);
  if (!movement) throw new HttpError(404, "Unknown movement.");
  const items = (await listMovementItems(db, movement.id)).filter((i) => i.receipt_id === receipt.id);
  const manifestNumber = displayManifestNumber(movement.id, movement.metrc_manifest_number);
  const receivedDate = receipt.created_at.slice(0, 10);
  const body = receiveCsv(
    items.map((item) => ({
      manifestNumber,
      packageTag: metrcFacingTag(item),
      receivedQuantity: String(item.received_qty ?? item.qty),
      unitOfWeight: item.uom,
      receivedDate,
      receivingLicense: movement.destination_license,
    }))
  );
  return {
    body,
    filename: receiveFilename(receipt.id, yyyymmddFromIso(receipt.created_at)),
    harvest_batch_id: items.find((i) => i.harvest_batch_id)?.harvest_batch_id ?? receipt.id,
  };
}

/** One-export-home law (owner, canon 0.22.0): marking a movement's manifest
 * uploaded stamps metrc_uploads (kind manifest, ref_id = the movement), which
 * clears it from the one home at /admin/uploads. */
export async function markManifestUploaded(
  db: D1Database,
  movementId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const built = await buildManifestCsv(db, movementId);
  const batchRow = await db
    .prepare(
      `SELECT i.harvest_batch_id FROM interco_movement_items mi
       JOIN local_inventory_items i ON i.id = mi.local_inventory_item_id
       WHERE mi.movement_id = ? AND mi.deleted_at IS NULL AND i.harvest_batch_id IS NOT NULL
       LIMIT 1`
    )
    .bind(movementId)
    .first<{ harvest_batch_id: string }>();
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    kind: "manifest",
    harvest_batch_id: batchRow?.harvest_batch_id ?? movementId,
    filename: built.filename,
    uploaded_at: ts,
    ref_id: movementId,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO metrc_uploads (
          id, kind, harvest_batch_id, filename, uploaded_at, ref_id,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, record.kind, record.harvest_batch_id, record.filename, ts, movementId, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "metrc_uploads", id, record, actor.id, SYSTEM_REASON.upload_marked, ts),
  ]);
  return { redirect: "/admin/uploads?ok=manifest" };
}

export async function markReceiveManifestUploaded(
  db: D1Database,
  receiptId: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const file = await buildReceiveCsv(db, receiptId);
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    kind: "receive_manifest",
    harvest_batch_id: file.harvest_batch_id,
    filename: file.filename,
    uploaded_at: ts,
    ref_id: receiptId,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO metrc_uploads (
          id, kind, harvest_batch_id, filename, uploaded_at, ref_id,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, "receive_manifest", file.harvest_batch_id, file.filename, ts, receiptId, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "metrc_uploads", id, record, actor.id, SYSTEM_REASON.upload_marked, ts),
  ]);
  return { redirect: "/admin/uploads?ok=upload_marked" };
}

/* --------------------------------------------------- Drying Operations: Load Silo (canon 0.30.6) */

/** The loaded instant (owner ruling 2026-09-08, canon 0.30.9, verbatim: "The
 * "LOADED" time is when the clock should start"). The typed HH:MM is a wall
 * clock on the crew's day, so the browser resolves it to an instant
 * (loaded_at_iso) before the post; the server checks the shape and refuses a
 * time ahead of now beyond a small grace. A blank time, or a post with no
 * resolved instant (no script ran), loads now. */
export function resolveLoadedAt(
  startTime: string | null,
  loadedAtIso: string | null,
  nowIsoValue: string,
  effectiveDate: string | null = null,
  startHour: number = FARM_DAY_START_HOUR_DEFAULT
): string {
  if (!startTime) return nowIsoValue;
  const now = Date.parse(nowIsoValue);
  // THE EFFECTIVE DATE (canon 0.30.92): under the Admin PIN the typed Start
  // time falls on the Effective Date, any day back (the two-day floor is the
  // crew's, not the owner's). The browser's instant is taken when it agrees
  // with that day; without one (no script ran) the farm's clock resolves it.
  if (effectiveDate) {
    // THE FARM DAY BEGINS AT SIX (canon 0.30.151): a Start time before the start
    // hour is on the next calendar date; the instant must fall on the farm day.
    const iso = loadedAtIso || farmInstant(effectiveDate, startTime, startHour);
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) throw new HttpError(400, "Start time must be HH:MM.");
    if (ms > now + 10 * 60 * 1000) throw new HttpError(400, "Start time is ahead of now.");
    if (farmDay(new Date(ms).toISOString(), startHour) !== effectiveDate) {
      throw new HttpError(400, "The Start time does not fall on the Effective Date.");
    }
    return new Date(ms).toISOString();
  }
  if (!loadedAtIso) return nowIsoValue;
  const ms = Date.parse(loadedAtIso);
  if (!Number.isFinite(ms)) throw new HttpError(400, "Start time must be HH:MM.");
  if (ms > now + 10 * 60 * 1000) throw new HttpError(400, "Start time is ahead of now.");
  if (ms < now - 2 * 24 * 60 * 60 * 1000) throw new HttpError(400, "Start time is more than two days back.");
  return new Date(ms).toISOString();
}

/** Owner ruling 2026-09-08 (verbatim: "CSV is 832 Barn - 832 Silo n with all
 * the important bits and pieces"): loading a silo is the spine's step 7 as a
 * deliberate act. The lot's born package moves from the PNN barn to the silo
 * (logged), the lot's actual space becomes that silo (logged), a silo_loads
 * row opens, and the location-change CSV pends at the export home until
 * marked uploaded. Canon 0.30.9: THE LOADED TIME IS THE CLOCK'S ZERO; the
 * typed Start time is the loaded time (blank = now) and started_at mirrors it. */
/** Loads an in-transit field load may leave once this pass is written.
 * A tote still on a weighing lot we are not finishing holds the load.
 * Every HBN on the load needs a live pass at or after the send. The pass
 * being written covers batchId. A later return does not un-receive. */
async function receivePassedFieldLoadStmts(
  db: D1Database,
  batchId: string,
  finishingLotIds: ReadonlySet<string>,
  actorId: string,
  ts: string
): Promise<D1PreparedStatement[]> {
  const loads = await db
    .prepare(
      `SELECT DISTINCT l.id, l.status, l.sent_at
       FROM field_loads l
       JOIN wet_weights t ON t.field_load_id = l.id AND t.deleted_at IS NULL
       JOIN wet_weight_entries w ON w.id = t.wet_weight_entry_id AND w.deleted_at IS NULL
       WHERE l.deleted_at IS NULL AND l.status = ? AND w.harvest_batch_id = ?`
    )
    .bind(FIELD_LOAD_STATUS.in_transit, batchId)
    .all<{ id: string; status: string; sent_at: string | null }>();
  const stmts: D1PreparedStatement[] = [];
  for (const load of loads.results ?? []) {
    const sentAt = load.sent_at ?? "";
    if (!sentAt) continue;
    const totes = await db
      .prepare(
        `SELECT t.harvest_batch_id, w.id AS lot_id, w.status AS lot_status
         FROM wet_weights t
         JOIN wet_weight_entries w ON w.id = t.wet_weight_entry_id AND w.deleted_at IS NULL
         WHERE t.field_load_id = ? AND t.deleted_at IS NULL`
      )
      .bind(load.id)
      .all<{ harvest_batch_id: string; lot_id: string; lot_status: string }>();
    const rows = totes.results ?? [];
    if (rows.some((row) => row.lot_status === LOT_STATUS.weighing && !finishingLotIds.has(row.lot_id))) continue;
    const hbns = [...new Set(rows.map((row) => row.harvest_batch_id))];
    let covered = true;
    for (const hbnId of hbns) {
      const byThisPass = hbnId === batchId && sentAt <= ts;
      if (byThisPass) continue;
      const pass = await db
        .prepare(
          `SELECT id FROM production_schedules
           WHERE harvest_batch_id = ? AND stage = ? AND status IN (?, ?) AND deleted_at IS NULL
             AND scheduled_at >= ?
           LIMIT 1`
        )
        .bind(hbnId, INTERNAL_LOGISTICS_STAGE, SCHEDULE_STATUS.scheduled, SCHEDULE_STATUS.complete, sentAt)
        .first<{ id: string }>();
      if (!pass) {
        covered = false;
        break;
      }
    }
    if (!covered) continue;
    stmts.push(
      db
        .prepare(
          `UPDATE field_loads SET status = ?, received_at = ?, received_by = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL AND status = ?`
        )
        .bind(FIELD_LOAD_STATUS.received, ts, actorId, ts, actorId, load.id, FIELD_LOAD_STATUS.in_transit),
      insertLog(db, {
        record_table: "field_loads",
        record_id: load.id,
        field: "status",
        old_value: load.status,
        new_value: FIELD_LOAD_STATUS.received,
        actor_person_id: actorId,
        reason: SYSTEM_REASON.field_load_received,
        changed_at: ts,
      }),
      insertLog(db, {
        record_table: "field_loads",
        record_id: load.id,
        field: "received_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actorId,
        reason: SYSTEM_REASON.field_load_received,
        changed_at: ts,
      }),
      insertLog(db, {
        record_table: "field_loads",
        record_id: load.id,
        field: "received_by",
        old_value: null,
        new_value: actorId,
        actor_person_id: actorId,
        reason: SYSTEM_REASON.field_load_received,
        changed_at: ts,
      })
    );
  }
  return stmts;
}

/** THE LOAD AND THE LOT (canon 0.30.241): >> on the Dry Queue. One schedule row
 * per pass, entry and package null. A later part rides with an open pass.
 * THE IN-TRANSIT RULE (canon 0.30.320): a weighing part is finished first,
 * the plant count skipped, then the pass is written, then a sent load whose
 * HBNs are all passed leaves the in-transit list. */
export async function scheduleLogisticsLot(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const batchId = requireText(form.get("harvest_batch_id"), "Lot");
  const parts = await listLotParts(db, batchId);
  if (parts.length === 0) throw new HttpError(400, "That lot is not on the Dry Queue.");
  const open = (await listOpenLogisticsSchedules(db)).find((row) => row.harvest_batch_id === batchId);
  if (open) throw new HttpError(400, "That lot is already scheduled.");
  const ts = nowIso();
  const weighing = parts.filter((part) => part.status === LOT_STATUS.weighing);
  const ledger = ledgerByTable("wet_weights");
  if (!ledger) throw new HttpError(500, "Server error.");
  const skip = new FormData();
  skip.set("plant_prompt", "skip");
  const stmts: D1PreparedStatement[] = [];
  for (const part of weighing) {
    const lot = await db.prepare(FIELD_FINISH_LOT_SQL).bind(part.id).first<FinishLotRow>();
    if (!lot) throw new HttpError(400, "That HBN has no weighing lot.");
    assertLotHasWeights(await countLotWeights(db, ledger, lot.id));
    stmts.push(...(await singleLotFinishStmts(db, lot, actor.id, skip, ts)));
  }
  const id = crypto.randomUUID();
  const record = {
    id,
    stage: INTERNAL_LOGISTICS_STAGE,
    harvest_batch_id: batchId,
    status: SCHEDULE_STATUS.scheduled,
    scheduled_at: ts,
    scheduled_by: actor.id,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  stmts.push(
    db
      .prepare(
        `INSERT INTO production_schedules (
          id, stage, wet_weight_entry_id, wip_package_id, harvest_batch_id, status,
          effective_date, scheduled_at, scheduled_by, completed_at, completed_by,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, NULL, NULL, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, INTERNAL_LOGISTICS_STAGE, batchId, SCHEDULE_STATUS.scheduled, ts, actor.id, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "production_schedules", id, record, actor.id, SYSTEM_REASON.schedule, ts),
    ...(await receivePassedFieldLoadStmts(db, batchId, new Set(weighing.map((part) => part.id)), actor.id, ts))
  );
  await db.batch(stmts);
  return { redirect: `${INTERNAL_LOGISTICS_PATH}?ok=passed` };
}

/** << voids the pass while none of the lot is loaded. */
export async function unscheduleLogisticsLot(db: D1Database, rowId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const row = await getScheduleRow(db, rowId);
  if (!row || row.stage !== INTERNAL_LOGISTICS_STAGE) throw new HttpError(404, "Unknown schedule row.");
  if (row.status !== SCHEDULE_STATUS.scheduled) throw new HttpError(400, SCHEDULE_REFUSAL.unscheduleComplete);
  // An open pass covers only parts that are still waiting. Loading completes the
  // pass, so an earlier load of this HBN (still drying) does not block <<.
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE production_schedules SET deleted_at = ?, deleted_by = ?, delete_reason = ?,
                updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, SYSTEM_REASON.schedule_unscheduled, ts, actor.id, row.id),
    insertLog(db, {
      record_table: "production_schedules",
      record_id: row.id,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.schedule_unscheduled,
      changed_at: ts,
    }),
  ]);
  return { redirect: `${INTERNAL_LOGISTICS_PATH}?ok=returned` };
}

export async function loadSilo(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const lotId = requireText(form.get("lot_id") || form.get("harvest_batch_id"), "Lot");
  const siloId = requireText(form.get("dry_space_id"), "Silo");
  const startTime = optionalTime24(form.get("start_time"), "Start time (24h)");
  const loadedAtIso = textOrNull(form.get("loaded_at_iso"));
  // THE FINISHED LOT IS ELIGIBLE (canon 0.30.130; owner, 2026-09-19: "sever its
  // hold on where ledger inventory lands" and "regardless of what farm the HBN
  // indicates, assume it's elligible for dry space loading as soon as the
  // "finish lot" routine runs"): the lot is one Finish lot has run on and no
  // open load holds; the 0.30.73 gates (its package live in a barn, the silo at
  // that barn's site) are repealed. Its born package moves from wherever it
  // sits; a lot whose package was voided is named in words, since the load
  // would move nothing and pend no paper.
  const waiting = await listBarnWetLots(db);
  const byBatch = waiting.filter((part) => part.harvest_batch_id === lotId);
  const entry = waiting.find((part) => part.id === lotId);
  const parts = byBatch.length > 0 ? byBatch : entry?.harvest_batch_id ? waiting.filter((part) => part.harvest_batch_id === entry.harvest_batch_id) : entry ? [entry] : [];
  if (parts.length === 0) throw new HttpError(400, "That lot is not waiting for a dry space: Finish lot has not run on it, or a load already holds it.");
  const batchId = parts[0].harvest_batch_id || lotId;
  const schedule = (await listOpenLogisticsSchedules(db)).find((row) => row.harvest_batch_id === batchId);
  if (!schedule) throw new HttpError(400, "That lot is not scheduled for a dry space. Pass it from the Dry Queue first.");
  const missing = parts.find((part) => !part.item_id);
  if (missing) {
    throw new HttpError(
      400,
      `Lot ${shortLotId(missing.hbn ?? "", missing.metrc_harvest_tag)} has no live package in the ledger to move (voided or closed); restore it or repair the lot before loading.`
    );
  }
  const silo = await db
    .prepare(`SELECT id, name, kind, farm_code, location_name, space_type FROM dry_spaces WHERE id = ? AND deleted_at IS NULL`)
    .bind(siloId)
    .first<{ id: string; name: string; kind: string; farm_code: string | null; location_name: string | null; space_type: string | null }>();
  if (!silo || silo.kind !== "silo") throw new HttpError(400, "Pick a silo.");
  // THE BLAST FREEZER(S) (canon 0.30.106; his pick: the tile alone is renamed):
  // the born package moves to the METRC location the space stands over
  // (location_name, migration 0057), the space's own name when it has none.
  const siloLocation = (silo.location_name ?? "").trim() || silo.name;
  for (const part of parts) {
    const open = await getOpenSiloLoadForLot(db, part.id);
    if (open) throw new HttpError(400, "That lot is already loaded in a silo.");
  }
  // Owner ruling 2026-09-08 (canon 0.30.19, verbatim: "occupied silos should
  // not accept more product"): one load per silo until its unload finish ends
  // it. The form offers only empty silos; a stale or hand-built post refuses.
  // THE ROOM HOLDS MANY (canon 0.30.132; owner, 2026-09-20: "Dry rooms and
  // freezers must be able to contain multiple lots"): the law binds a silo
  // alone; a dry room or a freezer takes the next lot beside the ones it holds.
  if (spaceHoldsOneLot(silo.space_type)) {
    const occupant = await getOpenSiloLoadForSilo(db, silo.id);
    if (occupant) {
      throw new HttpError(
        400,
        `${silo.name} is occupied by lot ${shortLotId(occupant.hbn ?? "", occupant.metrc_harvest_tag)}. Unload it first.`
      );
    }
  }
  const ts = nowIso();
  // THE EFFECTIVE DATE (canon 0.30.92; owner: "a date override in the load silo
  // screen - PIN gated: 21319"): another day than today needs the Admin PIN
  // and a typed Start time; the loaded time then falls on that day.
  const effective = await resolveEffectiveDate(db, form, ts);
  if (effective.overridden && !startTime) {
    throw new HttpError(400, "Type the Start time with an Effective Date other than today.");
  }
  const loadedAt = resolveLoadedAt(startTime, loadedAtIso, ts, effective.overridden ? effective.date : null, await farmDayStartHour(db));
  const startedAt = loadedAt;
  // THE PLANT COUNT (owner ruling 2026-09-14, canon 0.30.62): a lot that skipped
  // the count at Finish lot is asked again here; a typed count lands on the lot
  // with its log line, a blank skips again (the pencil stays open either way).
  const stmts: D1PreparedStatement[] = [];
  let id = "";
  for (const part of parts) {
    const keyed = form.get(`plant_count[${part.id}]`);
    const plantCount = parsePlantCount(keyed != null && String(keyed) !== "" ? keyed : parts.length === 1 ? form.get("plant_count") : null);
    const partLocation = part.barn_location ?? "";
    id = crypto.randomUUID();
    const record = {
      id,
      dry_space_id: silo.id,
      wet_weight_entry_id: part.id,
      loaded_at: loadedAt,
      started_at: startedAt,
      paused_at: null,
      paused_seconds: 0,
      ended_at: null,
      notes: null,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO silo_loads (
          id, dry_space_id, wet_weight_entry_id, loaded_at, started_at, paused_at, paused_seconds, ended_at, notes,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, NULL, 0, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
        )
        .bind(id, silo.id, part.id, loadedAt, startedAt, ts, actor.id, ts, actor.id),
      ...logsForInsert(db, "silo_loads", id, record, actor.id, SYSTEM_REASON.silo_load, ts)
    );
    if (partLocation !== siloLocation && part.item_id) {
      stmts.push(
        db
          .prepare(
            `UPDATE local_inventory_items SET location = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(siloLocation, ts, actor.id, part.item_id),
        insertLog(db, {
          record_table: "local_inventory_items",
          record_id: part.item_id,
          field: "location",
          old_value: partLocation,
          new_value: siloLocation,
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.silo_load,
          changed_at: ts,
        })
      );
    }
    if (part.status === LOT_STATUS.in_transit) {
      stmts.push(
        db
          .prepare(`UPDATE wet_weight_entries SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
          .bind(LOT_STATUS.drying, ts, actor.id, part.id),
        insertLog(db, {
          record_table: "wet_weight_entries",
          record_id: part.id,
          field: "status",
          old_value: LOT_STATUS.in_transit,
          new_value: LOT_STATUS.drying,
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.silo_load,
          changed_at: ts,
        })
      );
    }
    if (part.actual_dryspc !== silo.id) {
      stmts.push(
        db
          .prepare(
            `UPDATE wet_weight_entries SET actual_dryspc = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(silo.id, ts, actor.id, part.id),
        insertLog(db, {
          record_table: "wet_weight_entries",
          record_id: part.id,
          field: "actual_dryspc",
          old_value: part.actual_dryspc,
          new_value: silo.id,
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.silo_load,
          changed_at: ts,
        })
      );
    }
    if (plantCount != null && plantCount !== (part.plant_count ?? null)) {
      stmts.push(
        db
          .prepare(
            `UPDATE wet_weight_entries SET plant_count = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(plantCount, ts, actor.id, part.id),
        insertLog(db, {
          record_table: "wet_weight_entries",
          record_id: part.id,
          field: "plant_count",
          old_value: part.plant_count == null ? null : String(part.plant_count),
          new_value: String(plantCount),
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.silo_load,
          changed_at: ts,
        })
      );
    }
    if (effective.overridden) {
      stmts.push(
        insertLog(db, {
          record_table: "silo_loads",
          record_id: id,
          field: "loaded_at",
          old_value: effective.today,
          new_value: loadedAt,
          actor_person_id: actor.id,
          reason: EFFECTIVE_DATE_REASON,
          changed_at: ts,
        })
      );
    }
  }
  stmts.push(
    db
      .prepare(
        `UPDATE production_schedules SET status = ?, completed_at = ?, completed_by = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(SCHEDULE_STATUS.complete, ts, actor.id, ts, actor.id, schedule.id),
    insertLog(db, {
      record_table: "production_schedules",
      record_id: schedule.id,
      field: "status",
      old_value: SCHEDULE_STATUS.scheduled,
      new_value: SCHEDULE_STATUS.complete,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.silo_load,
      changed_at: ts,
    })
  );
  await db.batch(stmts);
  // THE DRYING SCHEDULE (canon 0.30.226): a load opened by a drying surface's >> returns there.
  const back = dryingReturnPath(form.get("next"));
  if (back) return { redirect: `${back}?ok=drying_loaded` };
  return { redirect: `/station/load_silo?load=${encodeURIComponent(id)}&ok=loaded` };
}

/** Start: greyed from the load (canon 0.30.9: the clock starts at the loaded
 * time, so a load is started the moment it exists). A post on a load from
 * before that law records the loaded time as its start; a second post is a
 * no-op by law, never a reset. */
export async function startSiloLoad(db: D1Database, loadId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const load = await getSiloLoad(db, loadId);
  if (!load || load.ended_at) throw new HttpError(404, "Unknown silo load.");
  if (!load.started_at) {
    const ts = nowIso();
    await db.batch([
      db
        .prepare(`UPDATE silo_loads SET started_at = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
        .bind(load.loaded_at, ts, actor.id, loadId),
      insertLog(db, {
        record_table: "silo_loads",
        record_id: loadId,
        field: "started_at",
        old_value: null,
        new_value: load.loaded_at,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.silo_start,
        changed_at: ts,
      }),
    ]);
  }
  // THE DRYING SCHEDULE (canon 0.30.226): Start on a drying surface's Working pane returns there.
  return { redirect: dryingReturnPath(form.get("next")) ?? `/station/load_silo?load=${encodeURIComponent(loadId)}` };
}

/** Pause toggles: a running clock pauses (paused_at set); a paused clock
 * resumes, banking the pause into paused_seconds. Both logged. */
export async function pauseSiloLoad(db: D1Database, loadId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const load = await getSiloLoad(db, loadId);
  if (!load || load.ended_at) throw new HttpError(404, "Unknown silo load.");
  const ts = nowIso();
  if (load.paused_at) {
    const banked = Math.max(0, Math.floor((Date.parse(ts) - Date.parse(load.paused_at)) / 1000));
    const total = Number(load.paused_seconds ?? 0) + banked;
    await db.batch([
      db
        .prepare(
          `UPDATE silo_loads SET paused_at = NULL, paused_seconds = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(total, ts, actor.id, loadId),
      insertLog(db, {
        record_table: "silo_loads",
        record_id: loadId,
        field: "paused_seconds",
        old_value: String(load.paused_seconds ?? 0),
        new_value: String(total),
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.silo_resume,
        changed_at: ts,
      }),
    ]);
  } else {
    await db.batch([
      db
        .prepare(`UPDATE silo_loads SET paused_at = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
        .bind(ts, ts, actor.id, loadId),
      insertLog(db, {
        record_table: "silo_loads",
        record_id: loadId,
        field: "paused_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.silo_pause,
        changed_at: ts,
      }),
    ]);
  }
  // THE DRYING SCHEDULE (canon 0.30.226): Pause and Resume on a drying surface's Working pane return there.
  return { redirect: dryingReturnPath(form.get("next")) ?? `/station/load_silo?load=${encodeURIComponent(loadId)}` };
}

/** The location-change file for one load (canon 0.30.6): the package label,
 * the silo, the loaded date. THE BLAST FREEZER(S) (canon 0.30.106): the file
 * prints the METRC location the space stands over (location_name), the
 * space's name when it has none, so METRC reads Blast Freezer, never the
 * tile's word. */
export async function locationChangeUploadCsv(
  db: D1Database,
  loadId: string
): Promise<{ body: string; filename: string; harvest_batch_id: string }> {
  const row = await db
    .prepare(
      `SELECT l.id, l.loaded_at, COALESCE(NULLIF(TRIM(d.location_name), ''), d.name) AS silo_name, w.harvest_batch_id, ${HARVEST_FILE_SEQ_SQL} AS harvest_file_seq, b.hbn, b.metrc_harvest_tag,
              li.package_code, li.metrc_tag
       FROM silo_loads l
       JOIN wet_weight_entries w ON w.id = l.wet_weight_entry_id
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN dry_spaces d ON d.id = l.dry_space_id
       LEFT JOIN local_inventory_items li ON li.wet_weight_entry_id = w.id AND li.deleted_at IS NULL
       WHERE l.id = ? AND l.deleted_at IS NULL`
    )
    .bind(loadId)
    .first<{
      id: string;
      loaded_at: string;
      silo_name: string | null;
      harvest_batch_id: string;
      harvest_file_seq: number | null;
      hbn: string;
      metrc_harvest_tag: string | null;
      package_code: string | null;
      metrc_tag: string | null;
    }>();
  if (!row) throw new HttpError(404, "Unknown silo load.");
  const date = row.loaded_at.slice(0, 10);
  return {
    body: locationChangeCsv([
      {
        label: metrcFacingTag({
          metrc_tag: row.metrc_tag,
          package_code: row.package_code ?? shortLotId(row.hbn, row.metrc_harvest_tag),
        }),
        location: row.silo_name ?? "",
        moveDate: date,
      },
    ]),
    filename: locationChangeFilename(row.hbn, row.silo_name ?? "silo", date.replaceAll("-", ""), row.harvest_file_seq),
    harvest_batch_id: row.harvest_batch_id,
  };
}

export async function packageUploadCsv(
  db: D1Database,
  kind: string,
  sessionId: string
): Promise<{ body: string; filename: string; harvest_batch_id: string }> {
  const session = await db
    .prepare(
      `SELECT s.id, s.weigh_mode, s.finished_at, w.id AS lot_id, w.dry_weight_grams, w.harvest_batch_id, ${HARVEST_FILE_SEQ_SQL} AS harvest_file_seq,
              b.hbn, b.metrc_harvest_tag, s2.name AS strain_name, d.kind AS space_kind, d.name AS space_name
       FROM unload_sessions s
       JOIN wet_weight_entries w ON w.id = s.wet_weight_entry_id
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s2 ON s2.id = b.strain_id
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       WHERE s.id = ? AND s.deleted_at IS NULL`
    )
    .bind(sessionId)
    .first<{
      id: string;
      weigh_mode: string | null;
      finished_at: string | null;
      lot_id: string;
      dry_weight_grams: number | null;
      harvest_batch_id: string;
      harvest_file_seq: number | null;
      hbn: string;
      metrc_harvest_tag: string | null;
      strain_name: string | null;
      space_kind: string | null;
      space_name: string | null;
    }>();
  if (!session || !session.finished_at) {
    return packageUploadCsvForLot(db, kind, sessionId);
  }
  const item = await getInventoryItemForLot(db, session.lot_id);
  const date = session.finished_at.slice(0, 10);
  const dry = Number(session.dry_weight_grams ?? 0);
  // THE TAG LAW (canon 0.30.38): every label prints the METRC tag when the
  // ledger holds one, the internal code otherwise.
  const parentLabel = metrcFacingTag({
    metrc_tag: item?.metrc_tag ?? null,
    package_code: item?.package_code ?? shortLotId(session.hbn, session.metrc_harvest_tag),
  });
  if (kind === "package_finish") {
    return {
      body: packageFinishCsv([
        {
          label: parentLabel,
          finishDate: date,
        },
      ]),
      filename: finishFilename(session.id, yyyymmddFromIso(session.finished_at)),
      harvest_batch_id: session.harvest_batch_id,
    };
  }
  if (kind === "package_from_harvest") {
    // The bucked child (-B) is the package METRC creates from the harvest; its
    // tag is the child's once the crew has typed it (the pencil or a receive).
    const child = await getBuckedChildForLot(db, session.lot_id);
    const tag = metrcFacingTag({
      metrc_tag: child?.metrc_tag ?? null,
      package_code: child?.package_code ?? buckedPackageCode(shortLotId(session.hbn, session.metrc_harvest_tag)),
    });
    return {
      body: packagesFromHarvestsCsv([
        {
          tag,
          location: "Barn",
          item: session.strain_name ?? "",
          actualDate: date,
          harvestName: session.hbn,
          harvestWeight: dry,
        },
      ]),
      filename: `packages_from_harvests_${hbnWithSeq(session.hbn, session.harvest_file_seq)}.csv`,
      harvest_batch_id: session.harvest_batch_id,
    };
  }
  const parent = item;
  const deltaLog = parent
    ? await db
        .prepare(
          `SELECT old_value, new_value FROM record_change_log
           WHERE record_table = 'local_inventory_items' AND record_id = ? AND field = 'qty'
             AND reason = ?
           ORDER BY changed_at DESC LIMIT 1`
        )
        .bind(parent.id, SYSTEM_REASON.inv_unload_adjust)
        .first<{ old_value: string | null; new_value: string | null }>()
    : null;
  const qty = deltaLog
    ? roundGrams(Number(deltaLog.new_value ?? 0) - Number(deltaLog.old_value ?? 0))
    : dry;
  return {
    body: packageAdjustmentsCsv([
      {
        label: parentLabel,
        quantity: qty,
        adjustmentDate: date,
      },
    ]),
    filename: `package_adjustments_${hbnWithSeq(session.hbn, session.harvest_file_seq)}.csv`,
    harvest_batch_id: session.harvest_batch_id,
  };
}

async function packageUploadCsvForLot(
  db: D1Database,
  kind: string,
  lotId: string
): Promise<{ body: string; filename: string; harvest_batch_id: string }> {
  const lot = await db
    .prepare(
      `SELECT w.id, w.dry_weight_grams, w.harvest_batch_id, ${HARVEST_FILE_SEQ_SQL} AS harvest_file_seq, w.updated_at, b.hbn, b.metrc_harvest_tag
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       WHERE w.id = ? AND w.deleted_at IS NULL`
    )
    .bind(lotId)
    .first<{
      id: string;
      dry_weight_grams: number | null;
      harvest_batch_id: string;
      harvest_file_seq: number | null;
      updated_at: string;
      hbn: string;
      metrc_harvest_tag: string | null;
    }>();
  if (!lot) throw new HttpError(404, "Unknown session.");
  const item = await getInventoryItemForLot(db, lot.id);
  const date = lot.updated_at.slice(0, 10);
  const recorded = await sumLotPackageGrams(db, lot.id);
  const original = Number(lot.dry_weight_grams ?? 0);
  const label = metrcFacingTag({
    metrc_tag: item?.metrc_tag ?? null,
    package_code: item?.package_code ?? shortLotId(lot.hbn, lot.metrc_harvest_tag),
  });
  if (kind === "package_finish") {
    return {
      body: packageFinishCsv([{ label, finishDate: date }]),
      filename: `package_finish_${lot.hbn}.csv`,
      harvest_batch_id: lot.harvest_batch_id,
    };
  }
  return {
    body: packageAdjustmentsCsv([
      {
        label,
        quantity: roundGrams(recorded - original),
        adjustmentDate: date,
      },
    ]),
      filename: `package_adjustments_${hbnWithSeq(lot.hbn, lot.harvest_file_seq)}.csv`,
    harvest_batch_id: lot.harvest_batch_id,
  };
}

export async function markSplitUploaded(db: D1Database, parentId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const parent = await getRow(db, "local_inventory_items", parentId);
  if (!parent || parent.deleted_at) throw new HttpError(404, "Unknown inventory item.");
  const { filename } = await buildSplitCsv(db, parentId);
  const id = crypto.randomUUID();
  const ts = nowIso();
  const harvestBatchId = parent.harvest_batch_id == null ? parentId : String(parent.harvest_batch_id);
  const record = {
    id,
    kind: "package_split",
    harvest_batch_id: harvestBatchId,
    filename,
    uploaded_at: ts,
    ref_id: parentId,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO metrc_uploads (
          id, kind, harvest_batch_id, filename, uploaded_at, ref_id,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, "package_split", harvestBatchId, filename, ts, parentId, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "metrc_uploads", id, record, actor.id, SYSTEM_REASON.upload_marked, ts),
  ]);
  return { redirect: "/admin/uploads?ok=upload_marked" };
}

export async function buildSplitCsv(
  db: D1Database,
  parentId: string
): Promise<{ body: string; filename: string; harvest_batch_id: string }> {
  const parent = await getRow(db, "local_inventory_items", parentId);
  if (!parent || parent.deleted_at) throw new HttpError(404, "Unknown inventory item.");
  const children = await listSplitChildren(db, parentId);
  const parentLabel = metrcFacingTag({
    metrc_tag: parent.metrc_tag == null ? null : String(parent.metrc_tag),
    package_code: String(parent.package_code),
  });
  const rows = children.map((c) => ({
    parentLabel,
    childLabel: metrcFacingTag(c),
    quantity: Number(c.qty),
    date: c.created_at.slice(0, 10),
  }));
  return {
    body: packageSplitCsv(rows),
    filename: splitFilename(String(parent.package_code)),
    harvest_batch_id: parent.harvest_batch_id == null ? parentId : String(parent.harvest_batch_id),
  };
}

/* ----------------------------------------------------- fulfillment: mount */

/** D1 batches in chunks: a mount can run to hundreds of statements. Each chunk
 * is its own transaction; the mount is idempotent, so a chunk that fails is
 * healed by mounting the same file again. */
async function batchChunked(db: D1Database, stmts: D1PreparedStatement[], size = 50): Promise<void> {
  for (let i = 0; i < stmts.length; i += size) {
    await db.batch(stmts.slice(i, i + size));
  }
}

function uploadBasename(name: string): string {
  return String(name ?? "").split(/[\\/]/).pop()?.trim() ?? "";
}

type OrderZohoFields = Omit<ParsedOrder, "lines">;
const ORDER_ZOHO_FIELDS: Array<keyof OrderZohoFields> = [
  "zoho_so_id",
  "customer_name",
  "customer_id",
  "order_date",
  "expected_ship",
  "zoho_status",
  "internal_status",
  "sales_person",
  "customer_license",
  "destination_license",
  "origin_license",
  "delivery_method",
  "location_name",
];
const LINE_ZOHO_FIELDS: Array<keyof ParsedLine> = [
  "item_name",
  "sku",
  "product_sub",
  "readout_category",
  "quantity_ordered",
  "quantity_invoiced",
  "quantity_packed",
  "unit",
  "item_price",
  "location_code",
  "line_location_name",
];

function sameValue(a: unknown, b: unknown): boolean {
  const na = a == null || a === "" ? null : a;
  const nb = b == null || b === "" ? null : b;
  if (na == null && nb == null) return true;
  if (na == null || nb == null) return false;
  if (typeof na === "number" || typeof nb === "number") return Number(na) === Number(nb);
  return String(na) === String(nb);
}

/** Owner order 2026-09-08 (canon 0.30.18: "Look in the original gripfactory
 * repo for how pic prders and Mount SOs should behave" ... "here is the
 * iteration that should contain it"; then "did you build this?"). The Zoho
 * Sales Order export mounts the way gripfactorish read it (file kind by name
 * or by the Product Sub / Status (Internal) columns; crif and processing
 * ignored; one order per SalesOrder Number), made durable: an order upserts by
 * so_number, keeping our pick marks; lines match by seq inside the order and
 * keep picked_qty, short_flag and pick_note; a line the newer export dropped
 * soft-deletes; an order absent from a later export keeps its last state
 * (nothing here deletes an order). Nothing writes back to Zoho. */
export async function mountSalesOrders(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "A file is required.");
  const filename = uploadBasename(file.name);
  if (!filename) throw new HttpError(400, "A file is required.");
  const text = await file.text();
  const rows = parseCsv(text);
  const headers = rows[0] ?? [];
  if (!isZohoSalesOrderExport(headers) && !looksLikeZohoFilename(filename)) {
    throw new HttpError(
      400,
      "That is not a Zoho Sales Order export: no Product Sub or Status (Internal) column, and the filename does not say sales order."
    );
  }
  const records: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const rec: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) rec[headers[c].trim()] = rows[r][c] ?? "";
    if (Object.values(rec).some((v) => v.trim() !== "")) records.push(rec);
  }
  const parsed = parseZohoSalesOrders(records);
  if (parsed.orders.length === 0) {
    throw new HttpError(400, "No sales order lines found in that file.");
  }
  const ts = nowIso();
  const mountId = crypto.randomUUID();
  const [existingOrders, existingLines] = await Promise.all([listMountedOrdersAll(db), listMountedLinesAll(db)]);
  const byNumber = new Map(existingOrders.map((o) => [o.so_number, o]));
  const linesByOrder = new Map<string, Array<MountedLineRow & { deleted_at: string | null }>>();
  for (const line of existingLines) {
    const list = linesByOrder.get(line.sales_order_id);
    if (list) list.push(line);
    else linesByOrder.set(line.sales_order_id, [line]);
  }
  const stmts: D1PreparedStatement[] = [];
  const reason = SYSTEM_REASON.so_mount;
  const log = (table: string, id: string, field: string, oldValue: unknown, newValue: unknown) =>
    insertLog(db, {
      record_table: table,
      record_id: id,
      field,
      old_value: oldValue == null || oldValue === "" ? null : String(oldValue),
      new_value: newValue == null || newValue === "" ? null : String(newValue),
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    });

  for (const order of parsed.orders) {
    const existing = byNumber.get(order.so_number);
    let orderId: string;
    if (!existing) {
      orderId = crypto.randomUUID();
      stmts.push(
        db
          .prepare(
            `INSERT INTO mounted_sales_orders (
              id, so_number, zoho_so_id, customer_name, customer_id, order_date, expected_ship,
              zoho_status, internal_status, sales_person, customer_license, destination_license, origin_license,
              delivery_method, location_name, pick_status, picked_by, picked_at, fulfilled_by, fulfilled_at, pick_notes,
              first_mount_id, last_mount_id,
              created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
          )
          .bind(
            orderId,
            order.so_number,
            order.zoho_so_id || null,
            order.customer_name || null,
            order.customer_id || null,
            order.order_date,
            order.expected_ship,
            order.zoho_status || null,
            order.internal_status || null,
            order.sales_person || null,
            order.customer_license || null,
            order.destination_license || null,
            order.origin_license || null,
            order.delivery_method || null,
            order.location_name || null,
            mountId,
            mountId,
            ts,
            actor.id,
            ts,
            actor.id
          ),
        ...logsForInsert(
          db,
          "mounted_sales_orders",
          orderId,
          {
            so_number: order.so_number,
            customer_name: order.customer_name,
            expected_ship: order.expected_ship,
            zoho_status: order.zoho_status,
            internal_status: order.internal_status,
            lines: order.lines.length,
            last_mount_id: mountId,
          },
          actor.id,
          reason,
          ts
        )
      );
    } else {
      orderId = existing.id;
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const f of ORDER_ZOHO_FIELDS) {
        const next = order[f] === "" ? null : order[f];
        if (sameValue(existing[f], next)) continue;
        sets.push(`${f} = ?`);
        values.push(next);
        stmts.push(log("mounted_sales_orders", orderId, f, existing[f], next));
      }
      if (existing.deleted_at) {
        sets.push("deleted_at = NULL", "deleted_by = NULL", "delete_reason = NULL");
        stmts.push(log("mounted_sales_orders", orderId, "deleted_at", existing.deleted_at, null));
      }
      sets.push("last_mount_id = ?", "updated_at = ?", "updated_by = ?");
      values.push(mountId, ts, actor.id, orderId);
      stmts.push(db.prepare(`UPDATE mounted_sales_orders SET ${sets.join(", ")} WHERE id = ?`).bind(...values));
    }

    const current = linesByOrder.get(orderId) ?? [];
    const bySeq = new Map(current.map((l) => [Number(l.seq), l]));
    const seen = new Set<number>();
    const liveBefore = current.filter((l) => !l.deleted_at).length;
    let liveAfter = 0;
    for (const line of order.lines) {
      seen.add(line.seq);
      liveAfter += 1;
      const have = bySeq.get(line.seq);
      if (!have) {
        stmts.push(
          db
            .prepare(
              `INSERT INTO mounted_sales_order_lines (
                id, sales_order_id, seq, item_name, sku, product_sub, readout_category,
                quantity_ordered, quantity_invoiced, quantity_packed, unit, item_price, location_code, line_location_name,
                picked_qty, short_flag, pick_note,
                created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
            )
            .bind(
              crypto.randomUUID(),
              orderId,
              line.seq,
              line.item_name || null,
              line.sku || null,
              line.product_sub || null,
              line.readout_category,
              line.quantity_ordered,
              line.quantity_invoiced,
              line.quantity_packed,
              line.unit || null,
              line.item_price,
              line.location_code || null,
              line.line_location_name || null,
              ts,
              actor.id,
              ts,
              actor.id
            )
        );
        continue;
      }
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const f of LINE_ZOHO_FIELDS) {
        const next = line[f] === "" ? null : line[f];
        if (sameValue(have[f], next)) continue;
        sets.push(`${f} = ?`);
        values.push(next);
        // Quantity and location changes matter to the pick; the rest is Zoho's
        // spelling drift and rides the row without a log line each.
        if (f === "quantity_ordered" || f === "location_code" || f === "item_name") {
          stmts.push(log("mounted_sales_order_lines", have.id, f, have[f], next));
        }
      }
      if (have.deleted_at) sets.push("deleted_at = NULL", "deleted_by = NULL", "delete_reason = NULL");
      if (sets.length === 0) continue;
      sets.push("updated_at = ?", "updated_by = ?");
      values.push(ts, actor.id, have.id);
      stmts.push(db.prepare(`UPDATE mounted_sales_order_lines SET ${sets.join(", ")} WHERE id = ?`).bind(...values));
    }
    for (const stale of current) {
      if (seen.has(Number(stale.seq)) || stale.deleted_at) continue;
      stmts.push(
        db
          .prepare(
            `UPDATE mounted_sales_order_lines SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
             WHERE id = ?`
          )
          .bind(ts, actor.id, "dropped by re-mount", ts, actor.id, stale.id)
      );
    }
    if (existing && liveBefore !== liveAfter) {
      stmts.push(log("mounted_sales_orders", orderId, "lines", liveBefore, liveAfter));
    }
  }

  stmts.unshift(
    db
      .prepare(
        `INSERT INTO so_mounts (
          id, filename, row_count, order_count, ignored_count,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(mountId, filename, parsed.counted, parsed.orders.length, parsed.ignored, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "so_mounts",
      mountId,
      { filename, row_count: parsed.counted, order_count: parsed.orders.length, ignored_count: parsed.ignored },
      actor.id,
      reason,
      ts
    )
  );
  await batchChunked(db, stmts);
  return { redirect: "/fulfillment/mount-sos?ok=mounted" };
}

/* ------------------------------------------------------ fulfillment: pick */

async function requireMountedOrder(db: D1Database, orderId: string): Promise<MountedOrderRow> {
  const order = await getMountedOrder(db, orderId);
  if (!order) throw new HttpError(404, "Unknown sales order.");
  return order;
}

/** Start the pick: the picker signs by hand entry (canon 0.30.21), the order
 * goes to picking here. Zoho's own status column is never written. */
export async function startPick(db: D1Database, orderId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const order = await requireMountedOrder(db, orderId);
  if (order.pick_status) throw new HttpError(400, "That pick has already started.");
  // Canon 0.30.21: the picker signs by hand entry; the sign-off names are the PM's alone.
  const signer = requireText(form.get("signed_by"), "Picked by");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE mounted_sales_orders SET pick_status = 'picking', picked_by = ?, picked_at = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(signer, ts, ts, actor.id, orderId),
    insertLog(db, {
      record_table: "mounted_sales_orders",
      record_id: orderId,
      field: "pick_status",
      old_value: null,
      new_value: "picking",
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.pick_start,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "mounted_sales_orders",
      record_id: orderId,
      field: "picked_by",
      old_value: null,
      new_value: signer,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.pick_start,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/fulfillment/pick-orders?order=${encodeURIComponent(orderId)}&ok=picking` };
}

/** Save the pick's marks. The reasoned-edit boundary law (canon 0.30.10): a
 * line whose picked_ field is absent from the post is unchanged; a posted line
 * takes its picked quantity (blank clears), its short flag (the checkbox is
 * absent when unchecked, so presence of picked_ is the row's witness) and its
 * note. Nothing here blocks: a short line is a flag. */
export async function savePick(db: D1Database, orderId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const order = await requireMountedOrder(db, orderId);
  if (order.pick_status !== "picking") throw new HttpError(400, "Start the pick first.");
  const lines = await listMountedOrderLines(db, orderId);
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const line of lines) {
    const pickedField = `picked_${line.id}`;
    if (!form.has(pickedField)) continue;
    const pickedRaw = textOrNull(form.get(pickedField));
    let picked: number | null = null;
    if (pickedRaw != null) {
      const n = Number(pickedRaw.replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        throw new HttpError(400, `Picked quantity for ${line.item_name ?? line.sku ?? "a line"} must be a number.`);
      }
      picked = Math.round(n * 100) / 100;
    }
    const short = form.has(`short_${line.id}`) ? 1 : 0;
    const note = textOrNull(form.get(`note_${line.id}`));
    const sets: string[] = [];
    const values: unknown[] = [];
    if (!sameValue(line.picked_qty, picked)) {
      sets.push("picked_qty = ?");
      values.push(picked);
      stmts.push(
        insertLog(db, {
          record_table: "mounted_sales_order_lines",
          record_id: line.id,
          field: "picked_qty",
          old_value: line.picked_qty == null ? null : String(line.picked_qty),
          new_value: picked == null ? null : String(picked),
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.pick_save,
          changed_at: ts,
        })
      );
    }
    if (Number(line.short_flag) !== short) {
      sets.push("short_flag = ?");
      values.push(short);
      stmts.push(
        insertLog(db, {
          record_table: "mounted_sales_order_lines",
          record_id: line.id,
          field: "short_flag",
          old_value: String(line.short_flag),
          new_value: String(short),
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.pick_save,
          changed_at: ts,
        })
      );
    }
    if (!sameValue(line.pick_note, note)) {
      sets.push("pick_note = ?");
      values.push(note);
      stmts.push(
        insertLog(db, {
          record_table: "mounted_sales_order_lines",
          record_id: line.id,
          field: "pick_note",
          old_value: line.pick_note,
          new_value: note,
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.pick_save,
          changed_at: ts,
        })
      );
    }
    if (sets.length === 0) continue;
    sets.push("updated_at = ?", "updated_by = ?");
    values.push(ts, actor.id, line.id);
    stmts.push(db.prepare(`UPDATE mounted_sales_order_lines SET ${sets.join(", ")} WHERE id = ?`).bind(...values));
  }
  if (stmts.length > 0) {
    stmts.push(
      db.prepare(`UPDATE mounted_sales_orders SET updated_at = ?, updated_by = ? WHERE id = ?`).bind(ts, actor.id, orderId)
    );
    await batchChunked(db, stmts);
  }
  return { redirect: `/fulfillment/pick-orders?order=${encodeURIComponent(orderId)}&ok=saved` };
}

/** Complete the pick: the fulfiller signs; the order is fulfilled HERE (Zoho
 * keeps its own status until a lane back to it exists). A line picked under
 * its ordered quantity is flagged short, never blocked (the overissue law's
 * mirror); a line never marked stays as the paper shows it. */
export async function completePick(db: D1Database, orderId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const order = await requireMountedOrder(db, orderId);
  if (order.pick_status !== "picking") throw new HttpError(400, "Start the pick first.");
  const signer = requireText(form.get("signed_by"), "Fulfilled by");
  const lines = await listMountedOrderLines(db, orderId);
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const line of lines) {
    if (line.picked_qty == null || Number(line.short_flag) === 1) continue;
    if (Number(line.picked_qty) < Number(line.quantity_ordered)) {
      stmts.push(
        db
          .prepare(`UPDATE mounted_sales_order_lines SET short_flag = 1, updated_at = ?, updated_by = ? WHERE id = ?`)
          .bind(ts, actor.id, line.id),
        insertLog(db, {
          record_table: "mounted_sales_order_lines",
          record_id: line.id,
          field: "short_flag",
          old_value: "0",
          new_value: "1",
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.pick_complete,
          changed_at: ts,
        })
      );
    }
  }
  stmts.push(
    db
      .prepare(
        `UPDATE mounted_sales_orders SET pick_status = 'fulfilled', fulfilled_by = ?, fulfilled_at = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(signer, ts, ts, actor.id, orderId),
    insertLog(db, {
      record_table: "mounted_sales_orders",
      record_id: orderId,
      field: "pick_status",
      old_value: "picking",
      new_value: "fulfilled",
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.pick_complete,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "mounted_sales_orders",
      record_id: orderId,
      field: "fulfilled_by",
      old_value: null,
      new_value: signer,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.pick_complete,
      changed_at: ts,
    })
  );
  await batchChunked(db, stmts);
  return { redirect: `/fulfillment/pick-orders?order=${encodeURIComponent(orderId)}&ok=fulfilled` };
}

type RadPendingBatch = { id: string; hbn: string; farm_code: string; strain_id: string };

/** A METRC package the app has never minted, born into the testing queue the
 * way adoptFromMetrc mints a stranger, with no prepack schedule row. */
async function radAdoptStatements(
  db: D1Database,
  actorId: string,
  ts: string,
  source: {
    tag: string;
    type: string;
    grams: number;
    harvest: string;
    hbnId: string | null;
    strainName: string;
    license: string;
    location: string | null;
    packagedDate: string | null;
  },
  pending: Map<string, RadPendingBatch>
): Promise<D1PreparedStatement[]> {
  const stmts: D1PreparedStatement[] = [];
  const key = source.harvest.trim().toUpperCase();
  let batch: RadPendingBatch;
  const queued = pending.get(key);
  if (source.hbnId) {
    const found = await db
      .prepare(`SELECT id, hbn, farm_code, strain_id FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`)
      .bind(source.hbnId)
      .first<RadPendingBatch>();
    if (!found) throw new HttpError(400, "That package is not available.");
    batch = found;
  } else if (queued) {
    batch = queued;
  } else {
    const minted = await mintMetrcBatch(
      db,
      source.harvest,
      { strain: source.strainName, license: source.license, packagedDate: source.packagedDate },
      actorId,
      ts
    );
    batch = minted.batch;
    pending.set(key, batch);
    pending.set(batch.hbn.trim().toUpperCase(), batch);
    stmts.push(...minted.stmts);
  }
  const lotId = (await lotByHbn(db)).get(batch.hbn) ?? null;
  const id = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const record = {
    id,
    wet_weight_entry_id: lotId,
    harvest_batch_id: batch.id,
    package_code: source.tag,
    package_type_code: source.type,
    weight_grams: source.grams,
    status: WIP_STATUS.testing_queue,
    source: WIP_SOURCE.metrc,
  };
  stmts.push(
    db
      .prepare(
        `INSERT INTO wip_packages (
          id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, cryo_weight_grams,
          status, test_outcome, source, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, lotId, batch.id, source.tag, source.type, source.grams, WIP_STATUS.testing_queue, WIP_SOURCE.metrc, ts, actorId, ts, actorId),
    ...logsForInsert(db, "wip_packages", id, record, actorId, SYSTEM_REASON.rad_run_complete, ts),
    db
      .prepare(
        `INSERT INTO local_inventory_items (
          id, item_kind, package_code, metrc_tag, harvest_batch_id, wet_weight_entry_id, wip_package_id,
          strain_id, qty, uom, farm_code, license_value, location,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'g', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(itemId, ITEM_KIND_WIP, source.tag, source.tag, batch.id, id, batch.strain_id, source.grams, batch.farm_code, source.license, source.location, ts, actorId, ts, actorId),
    ...logsForInsert(
      db,
      "local_inventory_items",
      itemId,
      { item_kind: ITEM_KIND_WIP, metrc_tag: source.tag, harvest_batch_id: batch.id, strain_id: batch.strain_id, qty: source.grams, location: source.location, license_value: source.license },
      actorId,
      SYSTEM_REASON.rad_run_complete,
      ts
    )
  );
  return stmts;
}

function radScheduleRedirect(ok: string, form: FormData): string {
  const q = textOrNull(form.get("q"));
  const params = new URLSearchParams({ ok });
  if (q) params.set("q", q);
  return `${RAD_SCHEDULE_PATH}?${params.toString()}`;
}

function radOperationRedirect(ok: string): string {
  return `${RAD_OPERATION_PATH}?ok=${encodeURIComponent(ok)}`;
}

async function radRunRow(db: D1Database, id: string): Promise<{ id: string; status: string; grey: number } | null> {
  return db
    .prepare(`SELECT id, status, grey FROM rad_runs WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<{ id: string; status: string; grey: number }>();
}

async function radPackageCount(db: D1Database, runId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM rad_run_packages WHERE run_id = ? AND deleted_at IS NULL`)
    .bind(runId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

async function nextRadPosition(db: D1Database, runId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(MAX(position), 0) AS n FROM rad_run_packages WHERE run_id = ? AND deleted_at IS NULL`)
    .bind(runId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0) + 1;
}

function radRunInsert(db: D1Database, id: string, grey: number, actorId: string, ts: string): D1PreparedStatement[] {
  const record = {
    id,
    status: RAD_RUN_STATUS.scheduled,
    grey,
    scheduled_at: ts,
    scheduled_by: actorId,
    created_at: ts,
    created_by: actorId,
    updated_at: ts,
    updated_by: actorId,
  };
  return [
    db
      .prepare(
        `INSERT INTO rad_runs (
          id, status, grey, scheduled_at, scheduled_by, started_at, started_by, completed_at, completed_by,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, RAD_RUN_STATUS.scheduled, grey, ts, actorId, ts, actorId, ts, actorId),
    ...logsForInsert(db, "rad_runs", id, record, actorId, SYSTEM_REASON.rad_scheduled, ts),
  ];
}

function radPackageInsert(
  db: D1Database,
  runId: string,
  source: { tag: string; type: string; grams: number | null; lab: string },
  position: number,
  actorId: string,
  ts: string
): D1PreparedStatement[] {
  const id = crypto.randomUUID();
  const record = {
    id,
    run_id: runId,
    tag: source.tag,
    item_type: source.type,
    grams: source.grams,
    lab_test_status: source.lab,
    position,
    created_at: ts,
    created_by: actorId,
  };
  return [
    db
      .prepare(
        `INSERT INTO rad_run_packages (
          id, run_id, tag, item_type, grams, lab_test_status, position, created_at, created_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, runId, source.tag, source.type, source.grams, source.lab, position, ts, actorId),
    ...logsForInsert(db, "rad_run_packages", id, record, actorId, SYSTEM_REASON.rad_scheduled, ts),
  ];
}

async function defaultRadGrey(db: D1Database): Promise<number> {
  const grey = await newestRadGrey(db);
  return grey != null && isRadGrey(grey) ? grey : 100;
}

/** >> puts the package on the newest scheduled run with room. When no
 * scheduled run exists, a new run is born. When every scheduled run is full,
 * the eleventh is refused. */
export async function scheduleRadPackage(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const source = await requireRadAvailable(db, requireText(form.get("tag"), "Tag"));
  const open = await db
    .prepare(
      `SELECT r.id,
              (SELECT COUNT(*) FROM rad_run_packages p WHERE p.run_id = r.id AND p.deleted_at IS NULL) AS n
       FROM rad_runs r
       WHERE r.deleted_at IS NULL AND r.status = ?
       ORDER BY r.scheduled_at DESC, r.id DESC`
    )
    .bind(RAD_RUN_STATUS.scheduled)
    .all<{ id: string; n: number }>();
  const runs = open.results ?? [];
  const room = runs.find((run) => Number(run.n) < RAD_RUN_LIMIT);
  if (!room && runs.length > 0) throw new HttpError(400, "That run is full; start a new run.");
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  let runId = room?.id ?? "";
  if (!room) {
    runId = crypto.randomUUID();
    stmts.push(...radRunInsert(db, runId, await defaultRadGrey(db), actor.id, ts));
  }
  const position = room ? await nextRadPosition(db, runId) : 1;
  stmts.push(...radPackageInsert(db, runId, source, position, actor.id, ts));
  await db.batch(stmts);
  return { redirect: radScheduleRedirect("scheduled", form) };
}

export async function newRadRun(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const ts = nowIso();
  const id = crypto.randomUUID();
  await db.batch(radRunInsert(db, id, await defaultRadGrey(db), actor.id, ts));
  return { redirect: radScheduleRedirect("new", form) };
}

export async function setRadRunGrey(db: D1Database, runId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const run = await radRunRow(db, runId);
  if (!run) throw new HttpError(404, "Unknown run.");
  if (run.status !== RAD_RUN_STATUS.scheduled) throw new HttpError(400, "That run is not scheduled.");
  const raw = textOrNull(form.get("grey"));
  const grey = raw && /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!isRadGrey(grey)) throw new HttpError(400, "Grey is a whole Gray from 100 to 3000 by 100.");
  if (Number(run.grey) !== grey) {
    const ts = nowIso();
    await db.batch([
      db.prepare(`UPDATE rad_runs SET grey = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`).bind(grey, ts, actor.id, run.id),
      insertLog(db, {
        record_table: "rad_runs",
        record_id: run.id,
        field: "grey",
        old_value: String(run.grey),
        new_value: String(grey),
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.rad_grey_set,
        changed_at: ts,
      }),
    ]);
  }
  return { redirect: radScheduleRedirect("grey", form) };
}

export async function unscheduleRadPackage(db: D1Database, runId: string, packageId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const run = await radRunRow(db, runId);
  if (!run) throw new HttpError(404, "Unknown run.");
  if (run.status !== RAD_RUN_STATUS.scheduled) throw new HttpError(400, "That run is not scheduled.");
  const pkg = await db
    .prepare(`SELECT id FROM rad_run_packages WHERE id = ? AND run_id = ? AND deleted_at IS NULL`)
    .bind(packageId, runId)
    .first<{ id: string }>();
  if (!pkg) throw new HttpError(400, "That package is not on this run.");
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(`UPDATE rad_run_packages SET deleted_at = ?, deleted_by = ?, delete_reason = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(ts, actor.id, SYSTEM_REASON.rad_unscheduled, pkg.id),
    insertLog(db, {
      record_table: "rad_run_packages",
      record_id: pkg.id,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.rad_unscheduled,
      changed_at: ts,
    }),
  ];
  if ((await radPackageCount(db, runId)) <= 1) {
    stmts.push(
      db
        .prepare(
          `UPDATE rad_runs SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, SYSTEM_REASON.rad_unscheduled, ts, actor.id, run.id),
      insertLog(db, {
        record_table: "rad_runs",
        record_id: run.id,
        field: "deleted_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.rad_unscheduled,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: radScheduleRedirect("removed", form) };
}

export async function removeRadRun(db: D1Database, runId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const run = await radRunRow(db, runId);
  if (!run) throw new HttpError(404, "Unknown run.");
  if (run.status !== RAD_RUN_STATUS.scheduled) throw new HttpError(400, "That run is not scheduled.");
  if ((await radPackageCount(db, runId)) > 0) throw new HttpError(400, "That run still has packages.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE rad_runs SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, SYSTEM_REASON.rad_unscheduled, ts, actor.id, run.id),
    insertLog(db, {
      record_table: "rad_runs",
      record_id: run.id,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.rad_unscheduled,
      changed_at: ts,
    }),
  ]);
  return { redirect: radScheduleRedirect("removed", form) };
}

export async function startRadRun(db: D1Database, runId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const run = await radRunRow(db, runId);
  if (!run) throw new HttpError(404, "Unknown run.");
  if (run.status !== RAD_RUN_STATUS.scheduled) throw new HttpError(400, "That run is not scheduled.");
  if ((await radPackageCount(db, runId)) < 1) throw new HttpError(400, "A run needs a package before it starts.");
  const other = await db
    .prepare(`SELECT id FROM rad_runs WHERE deleted_at IS NULL AND status = ? AND id <> ?`)
    .bind(RAD_RUN_STATUS.running, run.id)
    .first<{ id: string }>();
  if (other) throw new HttpError(400, "The Rad is running another run.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(`UPDATE rad_runs SET status = ?, started_at = ?, started_by = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(RAD_RUN_STATUS.running, ts, actor.id, ts, actor.id, run.id),
    insertLog(db, {
      record_table: "rad_runs",
      record_id: run.id,
      field: "status",
      old_value: run.status,
      new_value: RAD_RUN_STATUS.running,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.rad_started,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "rad_runs",
      record_id: run.id,
      field: "started_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.rad_started,
      changed_at: ts,
    }),
  ]);
  return { redirect: radOperationRedirect("started") };
}

export async function unstartRadRun(db: D1Database, runId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const run = await radRunRow(db, runId);
  if (!run) throw new HttpError(404, "Unknown run.");
  if (run.status !== RAD_RUN_STATUS.running) throw new HttpError(400, "That run is not running.");
  const current = await db.prepare(`SELECT started_at FROM rad_runs WHERE id = ?`).bind(run.id).first<{ started_at: string | null }>();
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE rad_runs SET status = ?, started_at = NULL, started_by = NULL, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(RAD_RUN_STATUS.scheduled, ts, actor.id, run.id),
    insertLog(db, {
      record_table: "rad_runs",
      record_id: run.id,
      field: "status",
      old_value: run.status,
      new_value: RAD_RUN_STATUS.scheduled,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.rad_unstarted,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "rad_runs",
      record_id: run.id,
      field: "started_at",
      old_value: current?.started_at ?? null,
      new_value: null,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.rad_unstarted,
      changed_at: ts,
    }),
  ]);
  return { redirect: radOperationRedirect("unstarted") };
}

/** THE RAD START TIME (canon 0.30.330): the running run's actual start, which
 * the Start press only approximated, typed on the 12-hour clock in farm time
 * and resolved on the server on the farm day the run started (THE ZONELESS
 * ZERO; a time before the start hour falls on the next calendar date, the
 * silo's own rule). Ahead of now beyond ten minutes is refused, the silo's
 * grace; started_by stays the hand that pressed Start; an unchanged instant
 * writes nothing and still answers the flash. */
export async function setRadStartTime(db: D1Database, runId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const run = await radRunRow(db, runId);
  if (!run) throw new HttpError(404, "Unknown run.");
  if (run.status !== RAD_RUN_STATUS.running) throw new HttpError(400, "That run is not running.");
  const hhmm = wallClock24From12(textOrNull(form.get("start_time")) ?? "", textOrNull(form.get("meridiem")) ?? "");
  if (!hhmm) throw new HttpError(400, "Start time must be HH:MM.");
  const current = await db.prepare(`SELECT started_at FROM rad_runs WHERE id = ?`).bind(run.id).first<{ started_at: string | null }>();
  const ts = nowIso();
  const startHour = await farmDayStartHour(db);
  const instant = farmInstant(farmDay(current?.started_at || ts, startHour), hhmm, startHour);
  if (!instant) throw new HttpError(400, "Start time must be HH:MM.");
  if (Date.parse(instant) > Date.parse(ts) + 10 * 60 * 1000) throw new HttpError(400, "Start time is ahead of now.");
  if (instant === current?.started_at) return { redirect: radOperationRedirect("start_time") };
  await db.batch([
    db
      .prepare(`UPDATE rad_runs SET started_at = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(instant, ts, actor.id, run.id),
    insertLog(db, {
      record_table: "rad_runs",
      record_id: run.id,
      field: "started_at",
      old_value: current?.started_at ?? null,
      new_value: instant,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.rad_start_time_set,
      changed_at: ts,
    }),
  ]);
  return { redirect: radOperationRedirect("start_time") };
}

export async function completeRadRun(db: D1Database, runId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const run = await radRunRow(db, runId);
  if (!run) throw new HttpError(404, "Unknown run.");
  if (run.status !== RAD_RUN_STATUS.running) throw new HttpError(400, "That run is not running.");
  const packages = await db
    .prepare(`SELECT tag FROM rad_run_packages WHERE run_id = ? AND deleted_at IS NULL ORDER BY position`)
    .bind(run.id)
    .all<{ tag: string }>();
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  const pending = new Map<string, RadPendingBatch>();
  for (const pkg of packages.results ?? []) {
    const tag = pkg.tag.toUpperCase();
    const wips = await db
      .prepare(`SELECT id, status FROM wip_packages WHERE deleted_at IS NULL AND UPPER(package_code) = ?`)
      .bind(tag)
      .all<{ id: string; status: string }>();
    const rows = wips.results ?? [];
    if (rows.length === 0) {
      const source = await radAdoptSource(db, tag);
      if (!source) throw new HttpError(400, "That package is not available.");
      if (source.grams == null) throw new HttpError(400, "That package has no gram weight.");
      stmts.push(
        ...(await radAdoptStatements(
          db,
          actor.id,
          ts,
          {
            tag: source.tag,
            type: source.type,
            grams: source.grams,
            harvest: source.harvest,
            hbnId: source.hbnId,
            strainName: source.strainName,
            license: source.license,
            location: source.location,
            packagedDate: source.packagedDate,
          },
          pending
        ))
      );
      continue;
    }
    for (const wip of rows) {
      if (wip.status === WIP_STATUS.testing_queue) continue;
      let next: string;
      try {
        next = applyTransition("rad_complete", wip.status);
      } catch (err) {
        throw new HttpError(409, err instanceof Error ? err.message : "Invalid status transition.");
      }
      stmts.push(
        db
          .prepare(`UPDATE wip_packages SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
          .bind(next, ts, actor.id, wip.id),
        insertLog(db, {
          record_table: "wip_packages",
          record_id: wip.id,
          field: "status",
          old_value: wip.status,
          new_value: next,
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.rad_run_complete,
          changed_at: ts,
        })
      );
    }
  }
  stmts.push(
    db
      .prepare(
        `UPDATE rad_runs SET status = ?, completed_at = ?, completed_by = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(RAD_RUN_STATUS.complete, ts, actor.id, ts, actor.id, run.id),
    insertLog(db, {
      record_table: "rad_runs",
      record_id: run.id,
      field: "status",
      old_value: run.status,
      new_value: RAD_RUN_STATUS.complete,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.rad_completed,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "rad_runs",
      record_id: run.id,
      field: "completed_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.rad_completed,
      changed_at: ts,
    })
  );
  await db.batch(stmts);
  return { redirect: radOperationRedirect("completed") };
}

async function requireRadReopenPin(db: D1Database, form: FormData): Promise<void> {
  const pin = await getConfigValue(db, CONFIG_KEYS.admin_pin);
  const entered = textOrNull(form.get("unfinish_pin")) ?? textOrNull(form.get("pin"));
  if (!pin || entered !== pin) throw new HttpError(403, SCHEDULE_REFUSAL.demotePin);
}

export async function reopenRadRun(db: D1Database, runId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  await requireRadReopenPin(db, form);
  const run = await radRunRow(db, runId);
  if (!run) throw new HttpError(404, "Unknown run.");
  if (run.status !== RAD_RUN_STATUS.complete) throw new HttpError(400, "That run is not complete.");
  const current = await db.prepare(`SELECT completed_at FROM rad_runs WHERE id = ?`).bind(run.id).first<{ completed_at: string | null }>();
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE rad_runs SET status = ?, completed_at = NULL, completed_by = NULL, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(RAD_RUN_STATUS.running, ts, actor.id, run.id),
    insertLog(db, {
      record_table: "rad_runs",
      record_id: run.id,
      field: "status",
      old_value: run.status,
      new_value: RAD_RUN_STATUS.running,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.rad_reopened,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "rad_runs",
      record_id: run.id,
      field: "completed_at",
      old_value: current?.completed_at ?? null,
      new_value: null,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.rad_reopened,
      changed_at: ts,
    }),
  ]);
  return { redirect: radOperationRedirect("reopened") };
}

export { MANIFEST_COLUMNS, buckedPackageCode };
