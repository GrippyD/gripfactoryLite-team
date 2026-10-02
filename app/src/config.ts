/**
 * Future config-table candidates (canon L-4).
 * These values translate raw records into displayed text or routed status.
 * When a later box needs them editable in-app, lift each block into a lookup table.
 */

export const THEMES = ["grip", "c10"] as const;
export type ThemeName = (typeof THEMES)[number];

/** Owner ruling 2026-09-01: the Cerberus look shipped as the default view with
 * an easy switch back to lite. The view is cookie borne chrome, orthogonal to
 * the THEME env above; storage identifiers and behavior never key on it.
 * Owner ruling 2026-09-01: a third view, co (Continuum), joins the pill; the
 * pill's first segment now reads Grip but its stored value stays cerberus so
 * existing cookies keep working. Owner ruling 2026-09-09 (canon 0.30.28): the
 * Continuum format is the loading default; see asView below. */
export const VIEWS = ["cerberus", "lite", "co"] as const;
export type ViewName = (typeof VIEWS)[number];

/** Normalize a cookie or form value to a ViewName. Owner ruling 2026-09-09
 * (canon 0.30.28, verbatim: "Make the continuum format loading default"): an
 * absent or unknown value is "co" now; it was "cerberus" under the 2026-09-01
 * ruling. A stored "cerberus" or "lite" pick keeps working as before. */
export function asView(value: unknown): ViewName {
  if (value === "lite") return "lite";
  if (value === "cerberus") return "cerberus";
  return "co";
}

/** The view a browser gets before it has picked one (canon 0.30.28). */
export const DEFAULT_VIEW: ViewName = "co";

/** Owner ruling 2026-09-01: a computer/phone device pill in the bar between
 * the EN/ES pill and the view pill. The device is cookie borne chrome like the
 * view: phone mode sets a body class and the stylesheets reflow (the ruling's
 * "anchors, stretching and zoom": layout reflows rather than pinch-zooming). */
export const DEVICES = ["computer", "phone"] as const;
export type DeviceName = (typeof DEVICES)[number];

/** Normalize a cookie or form value to a DeviceName; anything but "phone" is
 * "computer" (owner ruling 2026-09-01: computer is the default). */
export function asDevice(value: unknown): DeviceName {
  return value === "phone" ? "phone" : "computer";
}

export const HARVEST_STATUS = {
  open: "open",
  complete: "complete",
} as const;

/** THE HBN INHERITED (canon 0.30.196) and THE TWO BOOKS (canon 0.30.205): a
 * batch the app minted, one minted from METRC's harvest name, or one minted
 * from the Harvest Details tab. A METRC-born batch has no lot, no plants and
 * no wet weight here. A sheet-born batch is the farm's own harvest and stands
 * with no lot until its weights come. */
export const HARVEST_BORN = { app: "app", metrc: "metrc", sheet: "sheet" } as const;

/** The farm's own harvest on the named batch alias. Only a METRC-born batch stays out. */
export function farmHarvestSql(alias: string): string {
  return `${alias}.born_from <> '${HARVEST_BORN.metrc}'`;
}

export const LOT_STATUS = {
  weighing: "weighing",
  drying: "drying",
  in_transit: "in_transit",
  // Owner ruling 2026-08-31: Finish unload exits the Dry Space Queue into the
  // Unloaded Queue; Trim Packages picks from there.
  unloaded: "unloaded",
  trimmed: "trimmed",
  // THE BLAST FREEZER(S) (canon 0.30.106; owner, 2026-09-16: "Unload Dry
  // Space/Blast Freezer just removes the line, since the packages are already
  // denoted as "FFZ" in METRC"; his pick: closed as frozen, out of every
  // queue): a lot whose freezer line is removed is frozen, a terminal status no
  // queue reads; its package stays FFZ inventory in the ledger.
  frozen: "frozen",
} as const;

export const WIP_STATUS = {
  created: "created",
  cryo_queue: "cryo_queue",
  testing_queue: "testing_queue",
  released: "released",
  // THE CRYO RUN (canon 0.30.110; owner: "The containers made in trim are
  // archival but no longer relevant to the process once they've been added to
  // true METRC package IDs in cryo"): a trim container consumed by a finished
  // run; out of every queue, kept as the record.
  pasteurized: "pasteurized",
  // THE MIRROR CLOSES THE LEDGER (canon 0.30.128; owner, 2026-09-19: "How do
  // I empty my FFZ inventory.  I passed a METRC Mirror for the licenses that
  // material was in, now METRC is showing 0 and the ledger is full"): a
  // package whose METRC tag the mirror marks gone left the license in METRC
  // (sold, transferred, finished); it leaves every queue here as gone, kept as
  // the record. No test outcome: METRC's word, not a lab's.
  gone: "gone",
  // THE PREPACK (canon 0.30.188): Finish Pack closed the parent. Out of every
  // queue, kept as the record, beside pasteurized and gone.
  packed: "packed",
} as const;

/** THE CRYO RUN (canon 0.30.110): where a wip_packages row came from. A trim
 * container carries NULL or trim; a cryo output carries cryo and its run. */
export const WIP_SOURCE = { trim: "trim", cryo: "cryo", metrc: "metrc" } as const;

/** A package that drew its grams from a harvest lot. Cryo outputs and packages
 * adopted from METRC did not. */
export function drawsFromParentLot(source: unknown): boolean {
  return source !== WIP_SOURCE.cryo && source !== WIP_SOURCE.metrc;
}

/** Trim-picture and cryo-input SQL: null reads as trim; cryo and metrc stay out. */
export const NON_TRIM_SOURCE_SQL = `COALESCE(p.source, '${WIP_SOURCE.trim}') NOT IN ('${WIP_SOURCE.cryo}', '${WIP_SOURCE.metrc}')`;

/** Release outcomes for the Testing Queue. Small editable list, currently code. */
export const TEST_OUTCOMES = ["passed", "failed", "other"] as const;
export type TestOutcome = (typeof TEST_OUTCOMES)[number];

export const DRY_SPACE_KINDS = ["silo", "hang", "truck"] as const;

/** THE DRY SPACE TYPE (canon 0.30.106). Owner, 2026-09-16, verbatim: "Freezer,
 * Dry Room, or Silo? <<<<<<Toggle that decides the formatting and the shape
 * (freezers = blue with white fade to at slower intervals and cubic,
 * rectangular cuboid with silo coloring and animations, silo is obviously the
 * silos shapes and colors)". A value in data (dry_spaces.space_type, migration
 * 0057): the silo is the cone-topped cylinder in the silo colors, the dry room
 * the wire cuboid in the silo colors, the freezer the cube in the FFZ blue with
 * the slow fade to white, its running word Chilling Out and its own unload law. */
export const DRY_SPACE_TYPES = ["silo", "dry_room", "freezer"] as const;
export type DrySpaceType = (typeof DRY_SPACE_TYPES)[number];
export const DRY_SPACE_TYPE_LABELS: Record<DrySpaceType, string> = { silo: "Silo", dry_room: "Dry Room", freezer: "Freezer" };
export function drySpaceTypeOf(raw: string | null | undefined): DrySpaceType {
  return raw === "dry_room" || raw === "freezer" ? raw : "silo";
}

/** THE ROOM HOLDS MANY (canon 0.30.132). Owner, 2026-09-20, verbatim: "Dry rooms
 * and freezers must be able to contain multiple lots". The one-load law of
 * canon 0.30.19 ("occupied silos should not accept more product") binds a silo
 * alone; a dry room or a freezer takes lot after lot, each with its own load
 * row and clock, the tile summing them against the space's capacity. */
export function spaceHoldsOneLot(spaceType: string | null | undefined): boolean {
  return drySpaceTypeOf(spaceType) === "silo";
}

/** The capacity's unit (his list: ea, lb, g, sqft). A weight unit scales the
 * fill; the others read on the tile and the lookup alone. */
export const CAPACITY_UOMS = ["ea", "lb", "g", "sqft"] as const;
export type CapacityUom = (typeof CAPACITY_UOMS)[number];
export function capacityUomOf(raw: string | null | undefined): CapacityUom | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return (CAPACITY_UOMS as readonly string[]).includes(v) ? (v as CapacityUom) : null;
}

/** Owner ruling 2026-08-31: trucks never persist in the Move To catalog; they live
 * on the lot record (wet_weight_entries.truck_number). This single standing
 * sentinel dry_spaces row, seeded by migration 0009, backs the NOT NULL
 * dry_space_id for every truck lot and must never render, void, or edit. */
export const TRUCK_DRY_SPACE_ID = "a1000001-0000-4000-8000-000000000009";

/** Owner ruling 2026-08-31: a truck pick arrives from the Move To form encoded as
 * truck-<n>, 1 through 999 with no leading zero; the digits store on the lot as
 * truck_number and the sentinel TRUCK_DRY_SPACE_ID backs dry_space_id. */
export const TRUCK_PICK_RE = /^truck-([1-9][0-9]{0,2})$/;

/** The digits of an encoded truck pick, or null when the value is not one. */
export function truckNumberFromPick(value: string): string | null {
  const match = TRUCK_PICK_RE.exec(value);
  return match ? match[1] : null;
}

/** Owner ruling 2026-08-28: which dry space kinds each farm may Move To.
 * PNN gains hang for its farm-scoped Hang in Place row.
 * THE HARVEST CONSOLE (canon 0.30.73; his pick "Make it a real silo now"): ARL
 * gains silo for its Arlington Dry Room, a silo drawn as the wire box; the five
 * PNN silos carry farm PNN since migration 0049, so ARL never sees them.
 * Values-in-data candidate (canon L-4); unknown farms fall back to all kinds. */
/** THE BLANK SLATE (canon 0.30.108). Owner, 2026-09-17, verbatim: "Wet Weights:
 * assume everything that get's entered into wet weights is landing in PNN's
 * barn location.  We'll handle real life logistics in METRC for now". Every wet
 * lot's package is born in PNN's barn under PNN's grow license (his pick: 832
 * at birth), and Move To offers PNN's silos and rooms to every HBN whatever its
 * farm. Trucks leave the Move To list; the truck sentinel and the in_transit
 * status stay for the records that already carry them. */
export const LANDING_FARM = "PNN" as const;
export const LANDING_MOVE_TO_KINDS: readonly string[] = ["silo", "hang"];

/** Every farm's Move To is the landing site's (canon 0.30.108); the per-farm
 * map of 2026-08-28 (ARL silo/hang/truck, PNS truck, PNN silo/truck/hang)
 * retired with the trucks. */
export const MOVE_TO_KINDS_BY_FARM: Record<string, readonly string[]> = {
  ARL: LANDING_MOVE_TO_KINDS,
  PNS: LANDING_MOVE_TO_KINDS,
  PNN: LANDING_MOVE_TO_KINDS,
};

export function moveToKindsForFarm(farmCode: string): readonly string[] {
  void farmCode;
  return LANDING_MOVE_TO_KINDS;
}

export const SYSTEM_REASON = {
  create: "create",
  queue_control: "queue control",
  cryo_weight: "cryo weight entry",
  release: "release",
  finish_lot: "finish lot",
  // THE TWO HARVEST NODES (canon 0.30.317): a field load's start, send, reopen,
  // and a tote moved from one HBN to another.
  field_load_started: "field load started",
  field_load_sent: "field load sent",
  field_load_reopened: "field load reopened",
  field_load_received: "field load received",
  field_hbn_closed: "field hbn closed",
  field_tote_hbn: "field tote hbn",
  // TERP RECIPES (canon 0.30.321): the pick and the dose on a pasteurization run.
  terp_recipe_picked: "terp recipe picked",
  terp_dose_set: "terp dose set",
  // THE RAD (canon 0.30.327): the stamps, the grey, and the queue effect.
  rad_scheduled: "rad scheduled",
  rad_unscheduled: "rad unscheduled",
  rad_grey_set: "rad grey set",
  rad_started: "rad started",
  rad_unstarted: "rad unstarted",
  rad_completed: "rad completed",
  rad_reopened: "rad reopened",
  rad_run_complete: "rad run complete",
  // THE RAD START TIME (canon 0.30.330): the running run's actual start, typed.
  rad_start_time_set: "rad start time set",
  finish_unload: "finish unload",
  // THE BLAST FREEZER(S) (canon 0.30.106): the freezer line removed, the lot frozen; nothing moved.
  freezer_unload: "freezer line removed; the packages stand as FFZ in METRC",
  first_login: "first login",
  // Owner ruling 2026-08-31: [Pending Data Uploads]; marking a METRC file uploaded.
  upload_marked: "marked uploaded",
  // Owner ruling 2026-08-31: the Plant fill rule; saving tags replaces the
  // batch's whole set, so every void and insert in the replace carries this.
  tags_replaced: "plant tags replaced",
  // Acquire HBN recall (owner 2026-09-01): the reasoned soft-delete. Serials
  // are never reused (ADR-6); the voided serial stays a gap.
  recalled: "recalled",
  // Owner ruling 2026-09-02: [Demote] on the Data Queues; the reasoned step
  // back to the last process the record was at.
  demoted: "demoted",
  // Owner ruling 2026-09-02: Import Data queue insert.
  import_queued: "file queued",
  // Owner bug report 2026-09-06 (canon 0.28.4): the wet truck receive.
  truck_received: "truck received",
  // THE EFFECTIVE DATE (canon 0.30.92): a transactional record written on a day
  // other than today under the Admin PIN; the row marks the instant it set.
  effective_date: "effective date set under the Admin PIN",
  // THE PENDING QUEUE CLEAR (canon 0.30.96): a pending file disposed by Clear
  // all, marked cleared, never sent to METRC.
  upload_cleared: "cleared, not uploaded to METRC",
  // PRODUCTION SCHEDULING (canon 0.30.97): the schedule row's create, the
  // automatic or manual complete, the PIN-gated demote, and the working-pane
  // unschedule (a scheduling act, no typed reason).
  schedule: "schedule",
  schedule_complete: "schedule complete",
  schedule_demote: "schedule demote",
  // THE UNFINISH (canon 0.30.220): the PIN-gated step back from Complete.
  schedule_unfinish: "schedule unfinish",
  // THE TRUCK RECORD (canon 0.30.226): a tote moved onto the lot minted for its HBN at Finish lot.
  truck_split: "truck split",
  // THE JOINT UNLOAD (canon 0.30.226): one total dry shared pro rata by wet
  // grams over a space's open loads; the reason carries the space and the lots.
  joint_unload: "joint unload",
  // THE CRYO RUN (canon 0.30.110): an output container born from a run; the
  // run's inputs consumed at Finish run; the run finished.
  cryo_output: "cryo output entered",
  cryo_consumed: "consumed by the cryo run; the container is archival",
  cryo_run_finish: "cryo run finished",
  schedule_unscheduled: "unscheduled from the working pane",
  // Canon 0.17.0 local inventory ledger reasons.
  inv_minted: "inv_minted",
  inv_unload_adjust: "inv_unload_adjust",
  inv_bucked_split: "inv_bucked_split",
  inv_moved_out: "inv_moved_out",
  // Owner ruling 2026-09-06 (canon 0.26.0): the Logistics Moves data queue's
  // reasoned void; in-transit items return to the origin side.
  inv_move_voided: "inv_move_voided",
  inv_received: "inv_received",
  inv_rejected: "inv_rejected",
  inv_unreceived: "inv_unreceived",
  inv_virtual_move: "inv_virtual_move",
  // Canon 0.30.1 forks 2 and 3: the med equivalent transfer at Finish lot and
  // the truck manifest cut at Finish lot.
  equivalent_transfer: "equivalent transfer",
  truck_manifest: "truck manifest",
  // THE HARVEST CONSOLE (canon 0.30.73): the Cutting and Bucking hours typed on
  // the console, one number per farm per day.
  labor_hours: "labor hours typed",
  // THE TRIM LINE PICTURE (canon 0.30.154): the input pounds typed on the
  // console, the total pounds run through T-0 by one shift on one day.
  trim_input_lbs: "input lbs typed",
  // Canon 0.30.6: the Load Silo station.
  silo_load: "silo load",
  silo_start: "silo clock start",
  silo_pause: "silo clock pause",
  silo_resume: "silo clock resume",
  inv_split: "inv_split",
  trim_reconcile: "trim reconcile",
  // Canon 0.30.9: [Remove from queue] at Remaining 0 on Trim Packages Entry.
  trim_remove: "trim removed from queue at zero",
  instrument_parsed: "instrument parsed",
  // Canon 0.30.18: [Mount SOs] and [Pick Orders] (gripfactorish behavior).
  so_mount: "sales orders mounted",
  // Canon 0.30.36: the Zoho Inventory Items export mounted onto the marketplace.
  zoho_inventory_mount: "zoho inventory mounted",
  // Canon 0.30.38: THE TAG LAW (a METRC tag captured at a station) and THE
  // METRC MIRROR (an export mounted; internal field values set by hand).
  metrc_tag_captured: "metrc tag captured",
  metrc_mount: "metrc export mounted",
  // THE MIRROR CLOSES THE LEDGER (canon 0.30.128): the reason on a ledger item
  // or a queue package closed because METRC marks its tag gone; the mount id
  // rides behind it.
  gone_in_metrc: "gone in METRC",
  // THE FFZ INVENTORY (canon 0.30.225): a fresh frozen package the ledger lacked, landed at the Blast Freezer.
  ffz_from_mirror: "fresh frozen from the mirror",
  internal_field_set: "internal field set",
  // Canon 0.30.40: the Change Location setup.
  location_changed: "location changed",
  pick_start: "pick started",
  pick_save: "pick saved",
  pick_complete: "pick completed",
  // Canon 0.30.26: THE LEDGER FOLLOWS THE TRIM. A trim package cut mints its
  // ledger item and draws the grams off the lot's package; cryo, the pencil
  // and the x keep the two in step.
  inv_trim_cut: "inv_trim_cut",
  inv_trim_edit: "inv_trim_edit",
  inv_trim_void: "inv_trim_void",
  inv_cryo: "inv_cryo_weight",
  // THE VOIDED LOT LEAVES ITS SILO (canon 0.30.116). Owner, 2026-09-17: "Can
  // you remove this lot from the silo?  I think I stranded it by deleting its
  // record in data queue"; his pick "Take the load with it": voiding a lot
  // voids its open silo load and its ledger package under the same reason.
  lot_void_load: "the lot was voided; its load leaves the silo",
  lot_void_item: "the lot was voided; its package leaves the ledger",
  // THE RECONCILE LEDGER LOCATION (canon 0.30.135). Owner, 2026-09-20: "[Reconcile
  // Ledger Location] ... Purge (Reason, Admin PIN) ... Edit ... reflect all on the
  // changelog ... add something to the data queue that's more like a note that
  // can be acknowledged". The typed reason or note rides after the colon.
  reconcile_purge: "reconcile purge",
  reconcile_edit: "reconcile edit",
  reconcile_note: "reconcile note",
  reconcile_acknowledged: "reconcile note acknowledged",
  // THE SHEET SYNC (canon 0.30.162): hours written from the Labor tab.
  sheet_sync: "hours from the sheet (sync)",
  // THE TESTING DESK (canon 0.30.164), part 1. English storage strings.
  test_scheduled: "test scheduled",
  test_sampled: "test sampled",
  test_manifest: "test manifest",
  test_sent: "test sent",
  test_at_lab: "test at lab",
  test_result: "test result",
  test_retest: "test retest",
  test_remediated: "test remediated",
  test_lab: "testing lab",
  // THE TESTING DESK (canon 0.30.164), part 3. A mirror fill, actor null.
  metrc_mirror: "metrc mirror",
  // THE MIRROR RELEASES THE QUEUE (canon 0.30.193).
  metrc_release: "metrc mirror",
  metrc_adopt: "adopted from METRC",
  // THE IN TESTING SHEET (canon 0.30.187). A sheet landing, actor null.
  in_testing_sheet: "in testing sheet",
  // THE HARVEST DETAILS IMPORT (canon 0.30.205). A sheet landing, actor null.
  harvest_details: "harvest details (sync)",
  // THE TWO BOOKS (canon 0.30.203): the app's HBN string becomes METRC's text.
  hbn_follows_metrc: "HBN follows METRC (0.30.203)",
  // THE PREPACK (canon 0.30.188).
  prepack_line: "prepack line",
  prepack_void: "prepack line voided",
  prepack_finish: "prepack finish",
} as const;

/** Owner ruling 2026-08-31: [Pending Data Uploads] lists the CSVs awaiting
 * upload to METRC, one format per data type, starting with Wet Weights. The
 * kind names the format and keys metrc_uploads rows. Owner terms law: HBN =
 * the METRC harvest NAME, it follows every subsequent package; Lot = the YY###
 * serial (year + sequential order of the harvest); Package ID = METRC package,
 * all or part of a lot. */
export const METRC_UPLOAD_KINDS = {
  wet_weights: "wet_weights",
  package_from_harvest: "package_from_harvest",
  package_adjust: "package_adjust",
  receive_manifest: "receive_manifest",
  package_finish: "package_finish",
  package_split: "package_split",
  // Canon 0.30.6: the Load Silo location change, 832 Barn to 832 Silo n.
  location_change: "location_change",
  // Canon 0.30.40: the Change Location setup's moves, one file per Execute.
  location_move: "location_move",
  // THE CRYO RUN (canon 0.30.110): the New Packages file, one per finished run,
  // in the owner's T3 autofill template (new_packages_autofill_template.t3.xlsx).
  new_packages: "new_packages",
  // THE TESTING DESK (canon 0.30.164): the New Packages CSV for a test sample.
  test_sample: "test_sample",
} as const;
export type MetrcUploadKind = (typeof METRC_UPLOAD_KINDS)[keyof typeof METRC_UPLOAD_KINDS];

/** Owner ruling 2026-08-31: Admin and Interco Logistics sit behind a PIN.
 * The PIN itself is data in app_config (canon L-4), seeded by migration 0008. */
export const CONFIG_KEYS = {
  admin_pin: "admin_pin",
  // THE MODELS BUTTON (canon 0.30.86). Owner, 2026-09-15, verbatim: "New button
  // in Admin: [Models] - pin gated: 17853". A second PIN in data (canon L-4),
  // seeded 17853 by migration 0051, with its own gate and cookie.
  models_pin: "models_pin",
  // Owner ruling 2026-08-31: the Plant fill rule's jitter percent (canon L-4:
  // values live in data), seeded by migration 0012.
  plant_split_jitter_pct: "plant_split_jitter_pct",
  // Inventory node (2026-09-01): projected dry yield percent, a value in data
  // (canon L-4). Seed 22 is the Scribe's placeholder; the owner must ratify it.
  projected_dry_yield_pct: "projected_dry_yield_pct",
  // Owner ruling 2026-09-01: "Trim and BIO only." The extraction-bound package
  // type codes, a comma-separated list in data (canon L-4), seeded TRIM,BIO by
  // migration 0014; replaces the old is_bud = 0 mapping.
  extraction_type_codes: "extraction_type_codes",
  internal_audit_interval_days: "internal_audit_interval_days",
  // Owner ruling 2026-09-14 (canon 0.30.55, verbatim: "Set things up so that
  // the first number added today ends in 26010 (we're on the tenth lot this
  // year, we just haven't inputted the historical data yet"): the first lot
  // token (YY###) the mint may issue for that year, a value in data (canon
  // L-4), seeded 26010 by migration 0044. The mint takes the higher of the
  // ledger's next serial and this floor; other years are untouched.
  first_lot_token: "first_lot_token",
  // THE SEND EMAIL (canon 0.30.65; SalesHelper canon 4b, v0.8.0). Owner report
  // 2026-09-14, verbatim: "The email that sends the csv doesn't automatically
  // mount the csv file to the email.  You have to download it and add it
  // manually." The recipient of a finished SalesHelper order (default
  // logistics@gripcannabis.com; commas separate several) and the verified
  // sender the Worker mails from through Resend, values in data (canon L-4),
  // seeded by migration 0046; the API key itself is the Worker secret
  // RESEND_API_KEY, never a config row.
  saleshelper_mail_to: "saleshelper_mail_to",
  saleshelper_mail_from: "saleshelper_mail_from",
  // THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69). Owner, 2026-09-14,
  // verbatim: "Each silo holds 15k lbs wet for scaling." A value in data (canon
  // L-4), pounds, seeded 15000 by migration 0048; the fill inside every silo
  // wireframe scales against it.
  silo_capacity_wet_lbs: "silo_capacity_wet_lbs",
  // THE FFZ CUBE READS THE MIRROR (canon 0.30.75). Owner, 2026-09-15: "check
  // FFZ, we have inventory but the FFZ cube is empty" (his FG Inventory in
  // METRC pane read FFZ 129,259.00 g). The METRC item kinds (the Item name's
  // first segment, canon 0.30.43) that are fresh frozen, a comma list in data
  // (canon L-4), seeded FFZ by migration 0050.
  ffz_item_kinds: "ffz_item_kinds",
  // THE TRIMMING SECTION (canon 0.30.88). Owner, 2026-09-16: "BTR=(BUD+WPR+SHA)
  // /All weight ran that shift"; his pick "WPR means SMALLS", SHA is SHAKE. The
  // trim package type codes that count as BUD, a comma list in data (canon
  // L-4), seeded BUD,SMALLS,SHAKE by migration 0052.
  btr_type_codes: "btr_type_codes",
  // THE TRIM BOGEY (canon 0.30.249). Owner, 2026-09-26: "Add a Admin Lookup
  // Field: [Trim Bogey] expressed as a percentage" and "Determines number of
  // dark red squares and the order based on our scheme (ROYGBIVWB-Aqua)". A
  // whole percent 0 to 100 in data (canon L-4), written by Admin, Lookups,
  // Trim Bogey on its first save; TRIM_BOGEY_DEFAULT until then.
  trim_bogey_pct: "trim_bogey_pct",
  // THE FARM DAY BEGINS AT SIX (canon 0.30.151). Owner, 2026-09-20: "Second
  // shift ends the next day, how can I have the report date treat the start of
  // the shift a the date?"; his pick "6:00 AM". The Eastern hour at which the
  // farm's day begins, a value in data (canon L-4), seeded 6 by migration 0064;
  // an instant before it belongs to the day before.
  farm_day_start_hour: "farm_day_start_hour",
  // His pick "Olga = Days, Victor = Afternoons": the trim operators of each
  // shift, comma lists in data (canon L-4), seeded by migration 0052.
  trim_shift_day_operators: "trim_shift_day_operators",
  trim_shift_second_operators: "trim_shift_second_operators",
  // THE LINE RUNS ON THE CLOCK (canon 0.30.163). Owner, 2026-09-21: "Switch
  // trimming to "running" if it's currently the correct time and any lot is
  // present in the queue."; his hours, "6-6 and 6-6". Each shift's window,
  // Eastern, as HH:MM-HH:MM (a window may wrap midnight); values in data
  // (canon L-4) when the rows exist, the code's defaults otherwise (no
  // migration seeded them; add the rows in Admin, Lookups, app_config to change).
  trim_shift_day_hours: "trim_shift_day_hours",
  trim_shift_second_hours: "trim_shift_second_hours",
  // BRIEF V10, PASTEURIZATION ON THE CONSOLE (canon 0.30.334). His answer on the
  // shifts, verbatim: "Their own, new fields". The pasteurization operators of
  // each shift (comma lists, matched to the cryo operator typed on each output,
  // case-insensitive) and each shift's hours, Eastern, HH:MM-HH:MM; values in
  // data (canon L-4), seeded by migration 0086 (the lists blank until named in
  // Admin, Lookups, app_config; the windows 06:00-18:00 and 18:00-06:00).
  pasteurization_shift_day_operators: "pasteurization_shift_day_operators",
  pasteurization_shift_second_operators: "pasteurization_shift_second_operators",
  pasteurization_shift_day_hours: "pasteurization_shift_day_hours",
  pasteurization_shift_second_hours: "pasteurization_shift_second_hours",
  // THE CRYO CATEGORIES (canon 0.30.112). Owner, 2026-09-17, verbatim: "in cryo
  // weight entry, add the product categories: 1. WPR 2. BUD 3. SHA". The
  // product categories a cryo line may be entered under, a comma list in his
  // order, a value in data (canon L-4), seeded WPR,BUD,SHA by migration 0059.
  cryo_product_categories: "cryo_product_categories",
  // THE CRYO POOL BY TYPE (canon 0.30.119). Owner, 2026-09-18: "lot ending 011
  // contains x amount of bud, y amount of wpr, and z amount of shake.  I need
  // those totals broken down on screen". The trim package types that go to
  // cryo and the product category each reads as, type=category pairs in his
  // order, a value in data (canon L-4), seeded BUD=BUD,SMALLS=WPR,SHAKE=SHA by
  // migration 0060; the routing law for a trim container (the is_bud flag was).
  cryo_type_categories: "cryo_type_categories",
  // THE PHONE LOGIN (canon 0.30.127). Owner, 2026-09-18: "I'd like to make the
  // cloudflare login keyed to a cell phone number instead of an email address".
  // The domain of the synthetic address an external identity provider mints
  // from a phone (<digits>@<domain>), a value in data (canon L-4), seeded
  // phone.gripcannabis.com by migration 0062; the app maps that address onto
  // the person carrying the phone.
  phone_login_domain: "phone_login_domain",
  // THE CURE PANES (canon 0.30.164): the rooms a sensor may name, a comma
  // list in data, seeded CSA,CSB by migration 0067.
  cure_rooms: "cure_rooms",
  // THE ENVIRONMENT FLAGS (canon 0.30.246): a reading older than this many
  // minutes is stale. Seeded 60 by migration 0077.
  environment_stale_minutes: "environment_stale_minutes",
  // THE SHEET SYNC (canon 0.30.162): the Labor workbook's place, and the name
  // and web URL of the last read, values in data (canon L-4).
  sheet_drive_id: "sheet_drive_id",
  sheet_item_id: "sheet_item_id",
  sheet_labor_tab: "sheet_labor_tab",
  sheet_harvest_tab: "sheet_harvest_tab",
  sheet_last_name: "sheet_last_name",
  sheet_last_web_url: "sheet_last_web_url",
  // THE IN TESTING SHEET (canon 0.30.187): the workbook's place and its vocabularies.
  in_testing_drive_id: "in_testing_drive_id",
  in_testing_item_id: "in_testing_item_id",
  in_testing_tab: "in_testing_tab",
  in_testing_rnd_tab: "in_testing_rnd_tab",
  in_testing_lab_aliases: "in_testing_lab_aliases",
  in_testing_fail_types: "in_testing_fail_types",
  // THE PREPACK (canon 0.30.188): the unit list, the Item name per unit, the room.
  prepack_units: "prepack_units",
  prepack_items: "prepack_items",
  prepack_location: "prepack_location",
  // THE MIRROR RELEASES THE QUEUE (canon 0.30.193): METRC lab state to a test outcome.
  metrc_release_states: "metrc_release_states",
  // THE TESTING GATE (canon 0.30.293): the package types on the four panes,
  // and the grams of one each (PRE 28, MOB 70). Values in data (canon L-4),
  // seeded by migration 0079; editable in Admin, Lookups, app_config.
  gate_type_codes: "gate_type_codes",
  gate_unit_grams: "gate_unit_grams",
  // FULFILLMENT (canon 0.30.306): grams in one each for the rows METRC counts
  // as eaches. Seeded by migration 0081; editable in Admin, Lookups, app_config.
  fulfillment_unit_grams: "fulfillment_unit_grams",
} as const;

/** Owner ruling 2026-09-14 (canon 0.30.55): the serial floor for one harvest
 * year, read from the first_lot_token value (YY###). Returns the serial part
 * when the token's YY is that year's, else null (a blank, malformed or
 * other-year value leaves the ledger alone). */
export function lotSerialFloor(value: string | null, harvestYear: number): number | null {
  if (value == null) return null;
  const m = /^(\d{2})(\d{3})$/.exec(value.trim());
  if (!m) return null;
  if (m[1] !== String(harvestYear % 100).padStart(2, "0")) return null;
  const serial = Number(m[2]);
  return serial >= 1 ? serial : null;
}

/** Owner ruling 2026-08-31: the Plant split jitter percent as stored in
 * app_config; a missing, blank, or malformed value falls back to 10. */
export function plantSplitJitterPct(value: string | null): number {
  if (value == null || value.trim() === "") return 10;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}

/** Inventory node (2026-09-01): the projected dry yield percent as stored in
 * app_config. A missing, blank, or malformed value falls back to 22, the seed
 * the owner ratified (owner ruling 2026-09-01: "ratify 22 but place the home
 * of the 22 in the lookups section of Admin"). */
export function projectedDryYieldPct(value: string | null): number {
  if (value == null || value.trim() === "") return 22;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 22;
}

/** Owner ruling 2026-09-01: "Trim and BIO only." The extraction-bound package
 * type codes as stored in app_config: comma split, trimmed, blanks dropped,
 * deduped first occurrence winning. A missing or blank value (a list that
 * parses to nothing included) falls back to the ruled TRIM,BIO. */
export function parseExtractionCodes(raw: string | null): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const part of String(raw ?? "").split(",")) {
    const code = part.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes.length > 0 ? codes : ["TRIM", "BIO"];
}

/** THE FFZ CUBE READS THE MIRROR (canon 0.30.75): the METRC item kinds that
 * are fresh frozen, from the app_config comma list, uppercased and deduped;
 * FFZ alone when the value is blank or unreadable. */
export function parseFfzItemKinds(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  const kinds: string[] = [];
  for (const part of String(raw ?? "").split(",")) {
    const kind = part.trim().toUpperCase();
    if (!kind || seen.has(kind)) continue;
    seen.add(kind);
    kinds.push(kind);
  }
  return kinds.length > 0 ? kinds : ["FFZ"];
}

/** SalesHelper type codes (read-only law). TRI is in the convention even when
 * a given menu.json snapshot has none. */
export const FG_TYPE_CODES = [
  "PRE",
  "BUD",
  "MIX",
  "SHA",
  "MOB",
  "NUG",
  "TRI",
  "WBP",
  "VAPE",
  "IPR",
] as const;
export type FgTypeCode = (typeof FG_TYPE_CODES)[number];

export function isFgTypeCode(value: string): value is FgTypeCode {
  return (FG_TYPE_CODES as readonly string[]).includes(value);
}

/** How long one PIN unlock holds on a device: one long floor shift. */
export const PIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

/** THE FOUR START TAPS (canon 0.30.89). Owner, 2026-09-16, with a picture of
 * four weighing lots born six seconds apart on one HBN: "What's happening?".
 * A Start lot whose header repeats an EMPTY weighing lot's (same HBN, Move To,
 * truck, Team Lead) born within this window lands on that lot instead of
 * minting another; a lot that already holds weight is never taken for a tap. */
export const START_LOT_REPEAT_WINDOW_SECONDS = 60;

/** Mint format: YYDDD-farm-grow_code-strain_code-manicure-silo-YY### */
export const HBN_MINT_FORMAT =
  "<YYDDD>-<farm>-<grow_code>-<strain_code>-<manicure>-<silo>-<YY###>";
export const HBN_BLANK_SILO = "NA";

/** THE HBN ENTRY (canon 0.30.341). The owner, 2026-10-02: "The HBN being made
 * defaults to the next silo in sequence for scheduling purposes ... (Arlington
 * dry room and the blast freezer will count as silo 6 and 7 for our
 * sequence)". The sequence is the first seven kind-silo spaces in the drying
 * strip's order (listSilos), numbered 1 to 7 by position; the HBN's sixth
 * segment is that number. */
export const SILO_SEQUENCE_SIZE = 7;

/** The two words of an HBN's or a lot's material form (canon 0.29.1, 0.30.341). */
export const MATERIAL_FORMS = ["spear", "bucked"] as const;
export type MaterialForm = (typeof MATERIAL_FORMS)[number];

export function isMaterialForm(value: unknown): value is MaterialForm {
  return value === "spear" || value === "bucked";
}

/** A planned silo value as a sequence number (1 to SILO_SEQUENCE_SIZE), else null (blank, NA, or out of range). */
export function siloSequenceNumber(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  if (!/^[0-9]{1,2}$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= SILO_SEQUENCE_SIZE ? n : null;
}

/** Owner ruling 2026-08-31: the single lot identifier law. Travelers carry the
 * last 5 digits of the HBN (the YY### serial) plus the last 6 of the METRC
 * harvest tag, rendered like 26002/A4B7C9; a blank tag renders just the serial.
 * The Unloaded Queue and all subsequent queues in the process identify each lot
 * by this pair, inherited along with the strain and weight. */
export function shortLotId(hbn: string, metrcHarvestTag: string | null | undefined): string {
  // Owner ruling 2026-09-01 (alpha feedback): "run away serialization on the lot
  // code, should always be the last 5 of the HBN." Screens show the serial alone;
  // the serial-plus-tag pair lives on in travelerLotId for the parked traveler print.
  void metrcHarvestTag;
  return hbn.slice(-5);
}

/** The traveler identifier pair (owner ruling 2026-08-31): last 5 of the HBN,
 * then '/' and the tag's last 6 when the tag is non-blank. Reserved for the
 * parked traveler printing; screens use shortLotId (the serial alone). */
export function travelerLotId(hbn: string, metrcHarvestTag: string | null | undefined): string {
  const serial = hbn.slice(-5);
  const tag = metrcHarvestTag ?? "";
  return tag.trim() === "" ? serial : `${serial}/${tag.slice(-6)}`;
}

/** Owner ruling 2026-09-08 (canon 0.30.9, verbatim: "Null Market Strains
 * should automatically inherit the real strain"): a blank market strain is the
 * strain's own name, stored on the batch at the mint. */
export function inheritMarketStrain(typed: string | null | undefined, strainName: string | null | undefined): string | null {
  const t = (typed ?? "").trim();
  if (t) return t;
  const n = (strainName ?? "").trim();
  return n || null;
}

/** THE 448 POUND (owner, 2026-09-21, canon 0.30.164): one pound is 448 grams
 * everywhere in the house (16 ounces at 28 grams). Silo, room, and FFZ
 * capacities typed in pounds convert through this constant. */
export const GRAMS_PER_LB = 448;

/** A METRC-facing gram quantity (canon 0.30.164, law 4): two decimals, the
 * precision METRC files and the mirror already carry, unit "Grams". Not the
 * house whole gram, and not GRAMS_PER_LB. Where METRC demands pounds, convert
 * at 453.59237 (METRC's own factor), never at GRAMS_PER_LB. */
export function metrcQuantity(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.sign(value) * Math.round(Math.abs(value) * 100) / 100;
}

/** Two decimals, half up, for figures that are not gram weights: pounds,
 * days, percents, instrument readings. */
export function round2(value: number): number {
  return metrcQuantity(value);
}

/** Thousands separators and two decimals. Pounds and other non-gram figures. */
export function format2(value: number | string | null | undefined): string {
  if (value == null) return "";
  const raw = String(value);
  if (raw.trim() === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const fixed = Math.abs(n).toFixed(2);
  const grouped = fixed.replace(/\B(?=(\d{3})+\.)/g, ",");
  return n < 0 ? `-${grouped}` : grouped;
}

/** Whole grams, round half up (away from zero). */
function wholeGrams(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n));
}

/** Owner ruling 2026-09-08 (canon 0.30.9, verbatim: "the market strain should
 * be what's listed from Trim Packages entry forward (The picture should say
 * "[Last 6 of Tag Number]/26001/TEST MOOKY/250,000(drop the decimals)."):
 * the lot label from Trim forward. A blank tag drops its token; the app's
 * spaced slash separates. */
export function lotTagLabel(input: {
  metrc_harvest_tag: string | null | undefined;
  short_id: string;
  strain: string | null | undefined;
  grams: number | string | null | undefined;
}): string {
  const tag = (input.metrc_harvest_tag ?? "").trim();
  const last6 = tag.length > 6 ? tag.slice(-6) : tag;
  const parts = [last6, input.short_id, (input.strain ?? "").trim(), formatGramsWhole(input.grams)];
  return parts.filter((p) => p !== "").join(" / ");
}

/** THE CRYO POOL BY TYPE (canon 0.30.119): the trim types that go to cryo and
 * the product category each reads as, parsed from the app_config value
 * "BUD=BUD,SMALLS=WPR,SHAKE=SHA" (type=category pairs, comma separated, upper
 * cased, the first spelling of a type winning, a pair with no category reading
 * as itself); his BUD, SMALLS as WPR and SHAKE as SHA when the value is blank. */
export const CRYO_TYPE_CATEGORIES_DEFAULT: ReadonlyArray<readonly [string, string]> = [
  ["BUD", "BUD"],
  ["SMALLS", "WPR"],
  ["SHAKE", "SHA"],
];
/** THE PREPACK (canon 0.30.188): a cryo output whose type is WPR, or a type the
 * category list maps to WPR (SMALLS by default). */
export function isPrepackWpr(typeCode: string, categories: ReadonlyMap<string, string>): boolean {
  const code = String(typeCode ?? "").trim().toUpperCase();
  if (code === "WPR") return true;
  return categories.get(code) === "WPR";
}

/** The unit list as typed (3.5 stays 3.5). Blank or unreadable reads the seed. */
export function parsePrepackUnits(raw: string | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of String(raw ?? "").split(",")) {
    const text = part.trim();
    const n = Number(text);
    if (!text || !Number.isFinite(n) || n <= 0) continue;
    const key = String(n);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out.length > 0 ? out : [...PREPACK_UNITS_DEFAULT];
}

/** unit=Item name pairs. The key is the unit's number, so 3.5 and 3.50 match. */
export function parsePrepackItems(raw: string | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of String(raw ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at < 1) continue;
    const unit = part.slice(0, at).trim();
    const name = part.slice(at + 1).trim();
    const n = Number(unit);
    if (!unit || !name || !Number.isFinite(n)) continue;
    const key = String(n);
    if (!out.has(key)) out.set(key, name);
  }
  return out;
}

export function prepackItemForUnit(items: ReadonlyMap<string, string>, unit: string): string | null {
  return items.get(String(Number(unit))) ?? null;
}

/** state=outcome pairs. The outcome must be a Testing Queue outcome. Match is
 * case-insensitive. A state that is not listed does not release. */
export function parseMetrcReleaseStates(raw: string | null | undefined): Map<string, TestOutcome> {
  const out = new Map<string, TestOutcome>();
  for (const part of String(raw ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at < 1) continue;
    const state = part.slice(0, at).trim().toLowerCase();
    const outcome = part.slice(at + 1).trim();
    if (!state || !isTestOutcome(outcome) || out.has(state)) continue;
    out.set(state, outcome);
  }
  return out;
}

export function parseCryoTypeCategories(raw: string | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of String(raw ?? "").split(",")) {
    const [typeRaw, catRaw] = part.split("=");
    const type = (typeRaw ?? "").trim().toUpperCase();
    if (!type || map.has(type)) continue;
    const cat = (catRaw ?? "").trim().toUpperCase();
    map.set(type, cat || type);
  }
  return map.size > 0 ? map : new Map(CRYO_TYPE_CATEGORIES_DEFAULT);
}

/** The routing law for a trim container (canon 0.30.119): a type on the cryo
 * list enters the Cryo Queue; every other type stays created (the extraction
 * pool reads TRIM and BIO from its own list; WASTE is waste). Before this the
 * package type's is_bud flag routed, which sent BUD alone. */
export function initialWipStatus(typeCode: string, cryoTypes: ReadonlyMap<string, string>): string {
  return cryoTypes.has(String(typeCode).trim().toUpperCase()) ? WIP_STATUS.cryo_queue : WIP_STATUS.created;
}

export type TransitionName =
  | "harvest_complete"
  | "lot_finished_drying"
  | "lot_finished_in_transit"
  | "lot_unloaded"
  | "lot_frozen"
  | "lot_trimmed"
  | "lot_trimmed_unloaded"
  | "cryo_weighed"
  | "cryo_consumed"
  | "cryo_unconsumed"
  | "released"
  | "prepack_packed"
  | "prepack_unpacked"
  | "rad_complete";

export const STATUS_TRANSITIONS: Record<
  TransitionName,
  { entity: string; from: string; to: string }
> = {
  harvest_complete: {
    entity: "harvest_batches",
    from: HARVEST_STATUS.open,
    to: HARVEST_STATUS.complete,
  },
  lot_finished_drying: {
    entity: "wet_weight_entries",
    from: LOT_STATUS.weighing,
    to: LOT_STATUS.drying,
  },
  lot_finished_in_transit: {
    entity: "wet_weight_entries",
    from: LOT_STATUS.weighing,
    to: LOT_STATUS.in_transit,
  },
  // Owner ruling 2026-08-31: Finish unload moves a drying lot into the Unloaded Queue.
  lot_unloaded: {
    entity: "wet_weight_entries",
    from: LOT_STATUS.drying,
    to: LOT_STATUS.unloaded,
  },
  // THE BLAST FREEZER(S) (canon 0.30.106): the freezer's unload closes the lot
  // as frozen, out of every queue; its package stays FFZ inventory.
  lot_frozen: {
    entity: "wet_weight_entries",
    from: LOT_STATUS.drying,
    to: LOT_STATUS.frozen,
  },
  lot_trimmed: {
    entity: "wet_weight_entries",
    from: LOT_STATUS.drying,
    to: LOT_STATUS.trimmed,
  },
  // Owner ruling 2026-08-31: the Unloaded Queue's exit; lot_trimmed above stays
  // as the Dry Space Queue's manual exit.
  lot_trimmed_unloaded: {
    entity: "wet_weight_entries",
    from: LOT_STATUS.unloaded,
    to: LOT_STATUS.trimmed,
  },
  cryo_weighed: {
    entity: "wip_packages",
    from: WIP_STATUS.cryo_queue,
    to: WIP_STATUS.testing_queue,
  },
  // THE CRYO RUN (canon 0.30.110): Finish run consumes the trim containers it
  // took in; the material lives on as the run's outputs, born in Testing.
  cryo_consumed: {
    entity: "wip_packages",
    from: WIP_STATUS.cryo_queue,
    to: WIP_STATUS.pasteurized,
  },
  // THE UNFINISH (canon 0.30.220): a consumed container returns to the Cryo Queue.
  cryo_unconsumed: {
    entity: "wip_packages",
    from: WIP_STATUS.pasteurized,
    to: WIP_STATUS.cryo_queue,
  },
  released: {
    entity: "wip_packages",
    from: WIP_STATUS.testing_queue,
    to: WIP_STATUS.released,
  },
  // THE PREPACK (canon 0.30.188): Finish Pack closes a released parent.
  prepack_packed: {
    entity: "wip_packages",
    from: WIP_STATUS.released,
    to: WIP_STATUS.packed,
  },
  // THE UNFINISH (canon 0.30.220): a finished pack's parent returns to released.
  prepack_unpacked: {
    entity: "wip_packages",
    from: WIP_STATUS.packed,
    to: WIP_STATUS.released,
  },
  // THE RAD (canon 0.30.327): completion returns a package to the testing
  // queue. applyTransition also accepts pasteurized. Demote ignores this edge
  // so the Testing Queue's step back stays the cryo queue.
  rad_complete: {
    entity: "wip_packages",
    from: WIP_STATUS.released,
    to: WIP_STATUS.testing_queue,
  },
};

/** Reverse steps, plus rad_complete. demoteStep ignores them so a birth status
 * stays a birth status and the Testing Queue still steps back to the cryo queue. */
const UNFINISH_TRANSITIONS = new Set<TransitionName>(["cryo_unconsumed", "prepack_unpacked", "rad_complete"]);

const RAD_COMPLETE_FROM = new Set<string>([WIP_STATUS.released, WIP_STATUS.pasteurized]);

export function applyTransition(name: TransitionName, currentStatus: string): string {
  const spec = STATUS_TRANSITIONS[name];
  const ok = name === "rad_complete" ? RAD_COMPLETE_FROM.has(currentStatus) : currentStatus === spec.from;
  if (!ok) {
    const expected = name === "rad_complete" ? "released or pasteurized" : spec.from;
    throw new Error(`Cannot apply ${name}: status is ${currentStatus}, expected ${expected}.`);
  }
  return spec.to;
}

/** Owner ruling 2026-09-02, verbatim: "Add a [Demote] button on the data
 * queues menu for each record. Clicking it prompts the user with a warning and
 * kicks the record back down to the last process it was at." The step back is
 * the transition graph above inverted, derived so new transitions stay
 * covered. A status with no inbound transition is a birth status (open,
 * weighing, created, cryo_queue): nothing to demote to, so its queues carry no
 * button. trimmed alone has two inbound edges (the Dry Space Queue's manual
 * exit and the Unloaded Queue's trim), so the caller resolves its target from
 * the record's own status history, defaulting to unloaded, the standard flow
 * since 2026-08-31. */
export function demoteStep(
  entity: string,
  status: string
): { to: string } | { candidates: string[] } | null {
  const froms = (Object.entries(STATUS_TRANSITIONS) as Array<[TransitionName, (typeof STATUS_TRANSITIONS)[TransitionName]]>)
    .filter(([name, s]) => !UNFINISH_TRANSITIONS.has(name) && s.entity === entity && s.to === status)
    .map(([, s]) => s.from);
  const unique = [...new Set(froms)];
  if (unique.length === 0) return null;
  if (unique.length === 1) return { to: unique[0] };
  return { candidates: unique };
}

/** Owner ruling 2026-08-28: Finish lot routes by the destination kind.
 * Trucks go in transit; every other kind dries. */
export function finishTransitionName(drySpaceKind: string): TransitionName {
  return drySpaceKind === "truck" ? "lot_finished_in_transit" : "lot_finished_drying";
}

/** THE WHOLE GRAM, STORED (owner, 2026-09-21, canon 0.30.164): a gram that
 * enters through a form, a CSV import, a feed, or an action is a whole gram,
 * round half up. Values already stored keep their decimals; they display
 * through formatGrams. METRC quantities use metrcQuantity, not this. */
export function roundGrams(value: number): number {
  if (!Number.isFinite(value)) return value;
  return wholeGrams(value);
}

/** Sum of whole grams, exact integer addition (canon 0.30.164). */
export function sumGrams(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += roundGrams(value);
  return total;
}

/** THE OVERISSUE LINE IS STRICT (Patrick's feedback relayed by the owner,
 * 2026-09-11, canon 0.30.37: "if you enter all your entries = all the source
 * package weight ... you get a pop up warning that you have entered more weight
 * than is in wip"). Issuing exactly the parent's grams is the clean case; only
 * MORE than the parent, past half a cent of float noise, is an over issue. The
 * same line rules the trim [+], the marketplace split [+], the weights pane
 * banner and its ask. Flag, never block, as before. */
export const OVERISSUE_TOLERANCE_GRAMS = 0.005;

export function isOverIssued(issuedGrams: number, parentGrams: number): boolean {
  return issuedGrams > parentGrams + OVERISSUE_TOLERANCE_GRAMS;
}

/* ------------------------------------------------------------ THE TAG LAW */

/** A METRC package or plant tag: 1A plus 22 hex characters (the owner, canon
 * 0.30.36: "Zoho should show a SKU, that's usually the METRC package ID"). */
export const METRC_TAG_RE = /^1A[0-9A-F]{22}$/i;

/** THE TAG LAW (owner, canon 0.30.38, his pick on fork F4: "Optional tag
 * everywhere"): every ledger package MAY carry the METRC package tag the state
 * knows it by; it is optional at every capture point (Finish lot, the arrival
 * receive, cryo, the trim room where the typed code IS the tag, and the
 * reasoned pencil on any package). Flag, never block: a value that is not
 * tag-shaped is kept as typed and marked, never refused. */
export function isMetrcTag(value: string | null | undefined): boolean {
  return METRC_TAG_RE.test(String(value ?? "").trim());
}

/** Normalize a typed tag: trimmed, upper-cased when tag-shaped, null when blank. */
export function normalizeMetrcTag(value: string | null | undefined): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  return isMetrcTag(s) ? s.toUpperCase() : s;
}

/** What a METRC-facing file prints for a package: its METRC tag when the
 * ledger holds one, else the internal code (the lot serial, the -B child, the
 * trim room's code), so nothing goes blank and the missing tag is visible. */
export function metrcFacingTag(
  item: { metrc_tag?: string | null; package_code: string }
): string {
  const tag = String(item.metrc_tag ?? "").trim();
  return tag || item.package_code;
}

/** True when the file would print an internal code where METRC wants a tag. */
export function lacksMetrcTag(item: { metrc_tag?: string | null }): boolean {
  return !isMetrcTag(item.metrc_tag);
}

/** THE WHOLE GRAM, SHOWN (owner, 2026-09-21, canon 0.30.164, and the 2026-08-31
 * thousands-separator ruling): every gram figure a person sees is a whole
 * number, round half up, thousands grouped. Pounds, percents, hours, and
 * money do not come through here. Blank or non-numeric input keeps its
 * existing render (gram cells render blank as ""). */
export function formatGrams(value: number | string | null | undefined): string {
  if (value == null) return "";
  const raw = String(value);
  if (raw.trim() === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const whole = String(wholeGrams(Math.abs(n)));
  const grouped = whole.replace(/\B(?=(\d{3})+$)/g, ",");
  return n < 0 ? `-${grouped}` : grouped;
}

/** Same as formatGrams (canon 0.30.164). Kept so existing call sites stay. */
export function formatGramsWhole(value: number | string | null | undefined): string {
  return formatGrams(value);
}

/** Owner ruling 2026-08-31: the gram-quantity field names, one list shared by
 * the display formatter (every HTML render of these formats through
 * formatGrams) and the reasoned edit's gram parsing and normalizing. */
export const GRAM_FIELDS = new Set([
  "weight_grams",
  "cryo_weight_grams",
  "wet_spear_weight_grams",
  "dry_weight_grams",
  "qty",
  "qty_grams",
  "batch_weight_grams",
  "net_weight_grams",
]);

/** License lookup values (labels render from lookup_values; Virtual Move pins these values). */
export const LICENSE_AU_GROW = "AU-G-C-000832";
export const LICENSE_AU_PROCESSOR = "AU-P-000694";
export const LICENSE_ARL_AU = "AU-G-C-001509";
export const LICENSE_PNS_AU = "AU-G-C-001397";
/** THE GR-C TRIO (owner fork 5, 2026-09-07, canon 0.30.1: "do it"): the real
 * Med lines, ratified on Patrick's GR-C-001405 naming matching the 0020 trio.
 * The placeholders retired in migration 0034. */
export const LICENSE_ARL_MED = "GR-C-002600";
export const LICENSE_PNS_MED = "GR-C-001405";
export const LICENSE_PNN_MED = "GR-C-001132";

export type LicenseClass = "au" | "med";
export type FloorSite = "ARL" | "PNS" | "PNN";

/** Known AU values to au; 1132 and the two placeholders to med; unknown default au. */
export const LICENSE_CLASS: Record<string, LicenseClass> = {
  [LICENSE_AU_GROW]: "au",
  [LICENSE_AU_PROCESSOR]: "au",
  [LICENSE_ARL_AU]: "au",
  [LICENSE_PNS_AU]: "au",
  [LICENSE_ARL_MED]: "med",
  [LICENSE_PNS_MED]: "med",
  [LICENSE_PNN_MED]: "med",
};

export function licenseClassOf(value: string): LicenseClass {
  return LICENSE_CLASS[value] ?? "au";
}

/** Site license lines in render order (canon 0.28.0). */
export const SITE_LICENSES: Record<FloorSite, readonly string[]> = {
  ARL: [LICENSE_ARL_AU, LICENSE_ARL_MED],
  PNS: [LICENSE_PNS_AU, LICENSE_PNS_MED],
  PNN: [LICENSE_AU_GROW, LICENSE_AU_PROCESSOR, LICENSE_PNN_MED],
};

export const FLOOR_SITE_ORDER: readonly FloorSite[] = ["ARL", "PNS", "PNN"];

export function licensesForSite(site: FloorSite): readonly string[] {
  return SITE_LICENSES[site];
}

export function siteOfLicense(value: string): FloorSite | null {
  for (const site of FLOOR_SITE_ORDER) {
    if (SITE_LICENSES[site].includes(value)) return site;
  }
  return null;
}

export function isKnownSiteLicense(value: string): boolean {
  return siteOfLicense(value) !== null;
}

export function isExternalLicense(value: string): boolean {
  return siteOfLicense(value) === null;
}

export function growLicenseForFarm(farmCode: string): string {
  if (farmCode === "ARL") return LICENSE_ARL_AU;
  if (farmCode === "PNS") return LICENSE_PNS_AU;
  return LICENSE_AU_GROW;
}

/** THE INHERITANCE LAW (canon 0.28.1): pre-ledger material sits under the batch
 * license. Gate fix 0.28.2: a batch license that is not a site line (a legacy or
 * edited value) falls back to the farm's AU grow line so no lot can ever be
 * invisible on the floor; the stored value stays on the record untouched. */
export function inheritedLotLicense(
  batchLicense: string | null | undefined,
  farmCode: string | null | undefined
): string {
  const lic = String(batchLicense ?? "").trim();
  if (lic && isKnownSiteLicense(lic)) return lic;
  return growLicenseForFarm(farmCode ?? "");
}

/** Package tree line: a known site license wins; else the location's home license. */
export function treeLicenseForPackage(licenseValue: string, location: string): string {
  if (isKnownSiteLicense(licenseValue)) return licenseValue;
  const site = siteOfLocation(location);
  if (site === "PROCESSOR") return LICENSE_AU_PROCESSOR;
  if (site === "ARL") return LICENSE_ARL_AU;
  if (site === "PNS") return LICENSE_PNS_AU;
  return LICENSE_AU_GROW;
}

export function isSiteBarnLocation(location: string): boolean {
  return location === LOC_BARN || location === LOC_ARL_BARN || location === LOC_PNS_BARN;
}

/** THE INBOX LAW: dest is the dest site's barn, except the door: 832 to 694
 * lands CSB. Canon 0.30.26 (owner, 2026-09-09: "it doesn't look like it ever
 * moved from the reception even though we've crossed the door", after his
 * 0.30.19 word "We dropped all dry spaces in favor of barn"): the door is the
 * 832 side to the processor from ANY 832-side spot (BARN, CSA, a silo), not
 * CSA alone; METRC sees one word, barn, so the door cannot hang on CSA. */
export function isInternalCsaToCsb(
  originLicense: string,
  originLocation: string,
  destinationLicense: string
): boolean {
  if (originLicense !== LICENSE_AU_GROW || destinationLicense !== LICENSE_AU_PROCESSOR) return false;
  const loc = String(originLocation ?? "").trim();
  return loc === "" || SITE_OF_LOCATION[loc] === "PNN";
}

export function deriveDestinationLocation(
  originLicense: string,
  originLocation: string,
  destinationLicense: string
): string {
  if (isInternalCsaToCsb(originLicense, originLocation, destinationLicense)) return LOC_CSB;
  const destSite = siteOfLicense(destinationLicense);
  if (destSite) return barnLocationForSite(destSite);
  return "";
}

export const ORIGIN_PAIR_ERROR = "One origin license and location per manifest.";

/** Barns are the universal inbox and outbox (canon 0.23.0). BARN is PNN Building 24. */
export const LOC_BARN = "BARN";
export const LOC_CSA = "CSA";
export const LOC_CSB = "CSB";
export const LOC_IN_TRANSIT = "IN-TRANSIT";
/** THE LOCATION WITHOUT THE FARM (canon 0.30.82). Owner, 2026-09-15, verbatim:
 * "CSVs shouldn't contain the farm name in the locations. "PNN\barn" is just
 * my shorthand for "barn" at one of the PNN licenses. Adding the farm prefix
 * confuses METRC". The app's barn names carry their site (BARN, ARL BARN, PNS
 * BARN) to tell the sites apart on our screens and reports; METRC knows the
 * barn at each license as its own location, so every CSV that leaves for METRC
 * drops a leading farm code. "ARL BARN" reads BARN; "Silo 3" and "Blast
 * Freezer" pass through untouched. */
export function metrcLocationName(location: string | null | undefined): string {
  const s = String(location ?? "").trim();
  const m = /^(ARL|PNN|PNS)\s+(.+)$/i.exec(s);
  return m ? m[2].trim() : s;
}

/** PRODUCTION SCHEDULING (canon 0.30.97): the Production Operations module
 * whose two shuttle stations (Trimming, Pasteurization) expose material to
 * Trim Packages Entry and Cryo Weight Entry. */
export const PRODUCTION_SCHEDULING_PATH = "/production/scheduling";
/** THE SHEET SYNC (canon 0.30.162): the Admin page of the Labor tab reads. */
export const ADMIN_SHEET_SYNC_PATH = "/admin/sheet-sync";
export const ENVIRONMENT_PATH = "/admin/environment";
export const ENV_ROLES = ["room", "bed", "plenum", "exhaust"] as const;
export type EnvRole = (typeof ENV_ROLES)[number];
/** THE TESTING DESK (canon 0.30.164), part 3: the Admin page of the Metrc mirror. */
export const ADMIN_METRC_API_PATH = "/admin/metrc-api";

/** THE TESTING DESK (canon 0.30.164): the lab tech's station, behind the Admin PIN. */
export const TESTING_PATH = "/testing";
export const TEST_PANELS = ["full_compliance", "potency", "rnd"] as const;
export type TestPanel = (typeof TEST_PANELS)[number];
export const TEST_PANEL_LABELS: Record<TestPanel, string> = {
  full_compliance: "Full compliance",
  potency: "Potency",
  rnd: "R and D",
};
export const TEST_TYPES = [
  "potency",
  "foreign_matter",
  "microbials",
  "heavy_metals",
  "chemical_residue",
  "water_activity",
  "mycotoxins",
  "terpenes",
  "other",
] as const;
export type TestType = (typeof TEST_TYPES)[number];
export const TEST_TYPE_LABELS: Record<TestType, string> = {
  potency: "Potency",
  foreign_matter: "Foreign matter",
  microbials: "Microbials",
  heavy_metals: "Heavy metals",
  chemical_residue: "Chemical residue",
  water_activity: "Water activity",
  mycotoxins: "Mycotoxins",
  terpenes: "Terpenes",
  other: "Other",
};
/** Open means in progress, before a result decision. A failed, passed,
 * remediated, or cancelled order does not block a new one. */
export const TEST_OPEN_STATUSES = [
  "scheduled",
  "sampled",
  "in_transit",
  "at_lab",
  "results_in",
  "retest_scheduled",
] as const;
/** The console's "lots scheduled": in motion toward a result. A retest that is
 * only retest_scheduled is not in this list; it is not waiting either, once
 * the later order exists. */
export const TEST_CONSOLE_SCHEDULED = ["scheduled", "sampled", "in_transit", "at_lab"] as const;
export const DEFAULT_LAB_TEST_BATCH = "Raw Plant Material";
export const SAMPLE_FLOOR_GRAMS = 14;
export const IN_TESTING_LOCATION = "In Testing";
export const TESTING_TRANSFER_TYPE = "Testing Transfer (to SCF)";
export const SCHEDULE_STAGES = {
  trim: "trim",
  cryo: "cryo",
  prepack: "prepack",
  // THE DRYING SCHEDULE (canon 0.30.226; Patrick's "scheduling the silos and
  // dry spaces the way we do the lines", his pick "Three surfaces by space
  // kind"): views over the lots, the loads and the spaces, no schedule rows.
  silos: "silos",
  dry_rooms: "dry_rooms",
  freezers: "freezers",
} as const;
export type ScheduleStage = (typeof SCHEDULE_STAGES)[keyof typeof SCHEDULE_STAGES];
export type DryingStage = typeof SCHEDULE_STAGES.silos | typeof SCHEDULE_STAGES.dry_rooms | typeof SCHEDULE_STAGES.freezers;
/** The line stages, the ones that write production_schedules rows. */
export type LineStage = Exclude<ScheduleStage, DryingStage>;
export const SCHEDULE_STAGE_TITLES: Record<ScheduleStage, string> = {
  trim: "Trimming",
  cryo: "Pasteurization",
  prepack: "Prepack",
  silos: "Silos",
  dry_rooms: "Dry Rooms",
  freezers: "Freezers",
};
/** THE DRYING SCHEDULE (canon 0.30.226): each surface is one space type. */
export const DRYING_STAGE_SPACE_TYPE: Record<DryingStage, DrySpaceType> = {
  silos: "silo",
  dry_rooms: "dry_room",
  freezers: "freezer",
};
export const DRYING_STAGES: readonly DryingStage[] = [SCHEDULE_STAGES.silos, SCHEDULE_STAGES.dry_rooms, SCHEDULE_STAGES.freezers];
export function dryingStageOfType(type: DrySpaceType): DryingStage {
  return DRYING_STAGES.find((stage) => DRYING_STAGE_SPACE_TYPE[stage] === type) ?? SCHEDULE_STAGES.silos;
}
export function dryingStagePath(stage: DryingStage): string {
  return `${PRODUCTION_SCHEDULING_PATH}/${stage}`;
}
/** Where Load Silo, Start and Pause return when a drying surface opened them:
 * one of the three surface paths exactly, anything else is no return. */
export function dryingReturnPath(raw: unknown): string | null {
  const typed = String(raw ?? "").trim();
  return DRYING_STAGES.map(dryingStagePath).find((path) => path === typed) ?? null;
}
/** The Complete pane's window: today and the six farm days before it. */
export const DRYING_COMPLETE_DAYS = 7;
export const SCHEDULE_STATUS = { scheduled: "scheduled", complete: "complete" } as const;

/** THE RAD (canon 0.30.327): a run waits, runs, or is complete. */
export const RAD_RUN_STATUS = { scheduled: "scheduled", running: "running", complete: "complete" } as const;

/** THE LOAD AND THE LOT (canon 0.30.241): a pass of an HBN onto Load Silo.
 * One production_schedules row, entry and package null. Not a line stage. */
export const INTERNAL_LOGISTICS_STAGE = "internal_logistics";

/** THE TWO HARVEST NODES (canon 0.30.317): a field load is open while the crew
 * adds totes, then in transit once Finish Load sends it. THE IN-TRANSIT RULE
 * (canon 0.30.320): received once the scheduler's pass has taken every HBN on
 * it. A received load stays received. */
export const FIELD_LOAD_STATUS = { open: "open", in_transit: "in_transit", received: "received" } as const;

/** TERP RECIPES (canon 0.30.321): active until retired. A retired recipe is never edited. */
export const TERP_RECIPE_STATUS = { active: "active", retired: "retired" } as const;
export const FIELD_HARVEST_PATH = "/station/field_harvest";
export const LOGISTICS_OPS_PATH = "/ops/interco_logistics";
export const INTERNAL_LOGISTICS_PATH = "/logistics/internal";
export const PROCESSING_PARTNERS_PATH = "/logistics/partners";

/** THE HARVEST CONSOLE (canon 0.30.73): the Admin button's page, PIN-gated like
 * Admin; /harvest-console stays the vendored Harvest Console Lite. */
export const HARVEST_PATH = "/harvest";

/** THE MODELS BUTTON (canon 0.30.86). Owner, 2026-09-15, verbatim: "New button
 * in Admin: [Models] - pin gated: 17853" and, beneath it, "1. [Harvest Menu Tool
 * 2026]" with the tool's hosting zip. /models is the Admin button's page, a
 * tile per model tool, behind the Models PIN (app_config models_pin, its own
 * cookie; the Admin PIN does not open it). Each tool is a vendored static app
 * streamed from public/models/<slug>/ untouched, served at /models/<slug>/ with
 * the trailing slash so its relative fetches (data.json) resolve beside it. */
export const MODELS_PATH = "/models";
/** The Models PIN posts here, outside the gated prefix, like /pin for Admin. */
export const MODELS_PIN_PATH = "/pin/models";
export type ModelTool = {
  /** The path segment under /models and the folder under public/models. */
  slug: string;
  /** The tile's words, his: "[Harvest Menu Tool 2026]". */
  title: string;
  /** The vendored files beside index.html that the app fetches relatively. */
  files: readonly string[];
};
export const MODEL_TOOLS: readonly ModelTool[] = [
  { slug: "harvest-menu-2026", title: "Harvest Menu Tool 2026", files: ["data.json"] },
];
export function modelToolPath(tool: ModelTool): string {
  return `${MODELS_PATH}/${tool.slug}/`;
}
export const HARVEST_HOURS_PATH = "/harvest/hours";
/** THE TRIMMING SECTION (canon 0.30.88): "DLH Yesterday: [numbox]" posts here, one number per shift per day. */
export const HARVEST_TRIM_HOURS_PATH = "/harvest/trim-hours";
/** BRIEF V10 (canon 0.30.334): the pasteurization shift panes' "Total Hours [Save]" posts here, one number per shift per day. */
export const HARVEST_PASTEURIZATION_HOURS_PATH = "/harvest/pasteurization-hours";
/** THE PREPACK (canon 0.30.188): one DLH box a day. */
export const HARVEST_PREPACK_HOURS_PATH = "/harvest/prepack-hours";
export const PREPACK_STATION_PATH = "/station/prepack";
export const PREPACK_UNITS_DEFAULT = ["3.5", "7", "14", "28"] as const;
export const PREPACK_LOCATION_DEFAULT = "Prepack Room";

/** THE LINE RUNS ON THE CLOCK (canon 0.30.163): his hours, "6-6 and 6-6": the
 * Day shift 6:00 AM to 6:00 PM Eastern, the Second shift 6:00 PM to 6:00 AM. */
export const TRIM_SHIFT_HOURS_DEFAULT: Readonly<Record<"day" | "second", string>> = { day: "06:00-18:00", second: "18:00-06:00" };

/** BRIEF V10 (canon 0.30.334): the pasteurization shifts keep windows of their
 * own (app_config pasteurization_shift_day_hours and _second_hours, seeded by
 * migration 0086 to the same hours as trim's); the code's fallback when a row
 * is missing or off. */
export const PASTEURIZATION_SHIFT_HOURS_DEFAULT: Readonly<Record<"day" | "second", string>> = { day: "06:00-18:00", second: "18:00-06:00" };

/** BRIEF V10 (canon 0.30.334): the two pasteurization shifts, named as the trim
 * shifts are ("Day shift", "Second Shift"), each bound to its own operator list. */
export const PASTEURIZATION_SHIFTS: readonly { key: "day" | "second"; label: string; configKey: string }[] = [
  { key: "day", label: "Day shift", configKey: CONFIG_KEYS.pasteurization_shift_day_operators },
  { key: "second", label: "Second Shift", configKey: CONFIG_KEYS.pasteurization_shift_second_operators },
];

/** BRIEF V10 (canon 0.30.334), his thirty: the cryo line RUNS while an output
 * was entered in the last 30 minutes by any operator; otherwise DOWN with the
 * timer from the last output ever entered. */
export const PASTEURIZATION_RUNNING_MINUTES = 30;

export type ShiftWindow = { startMinutes: number; endMinutes: number };

/** "HH:MM-HH:MM" to minutes since midnight; a malformed value reads as the given default. */
export function parseShiftWindow(raw: string | null | undefined, fallback: string): ShiftWindow {
  const parse = (text: string): ShiftWindow | null => {
    const m = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(text);
    if (!m) return null;
    const [sh, sm, eh, em] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    if (sh > 24 || eh > 24 || sm > 59 || em > 59) return null;
    return { startMinutes: (sh * 60 + sm) % 1440, endMinutes: (eh * 60 + em) % 1440 };
  };
  return parse(String(raw ?? "")) ?? parse(fallback) ?? { startMinutes: 0, endMinutes: 0 };
}

/** Whether a wall clock (minutes since midnight) falls inside the window; the
 * start is inside, the end is not; a window whose end is at or before its
 * start wraps midnight; equal start and end is the whole day. */
export function shiftWindowHolds(window: ShiftWindow, clockMinutes: number): boolean {
  const { startMinutes: a, endMinutes: b } = window;
  if (a === b) return true;
  if (a < b) return clockMinutes >= a && clockMinutes < b;
  return clockMinutes >= a || clockMinutes < b;
}

/** THE TRIMMING SECTION (canon 0.30.88): the package type codes that count as
 * BUD in the BTR, from the app_config comma list, uppercased and deduped;
 * his BUD, SMALLS (his WPR) and SHAKE (his SHA) when the value is blank. */
export function parseBtrTypeCodes(raw: string | null | undefined): string[] {
  const codes = parseUpperList(raw);
  return codes.length > 0 ? codes : ["BUD", "SMALLS", "SHAKE"];
}

/** THE TESTING GATE (canon 0.30.293): the package types that stand on the four
 * panes. Blank falls back to BUD, WPR, PRE, MOB. WBP and WIP are not in it. */
export const GATE_TYPE_CODES_DEFAULT = ["BUD", "WPR", "PRE", "MOB"] as const;
export function parseGateTypeCodes(raw: string | null | undefined): string[] {
  const codes = parseUpperList(raw);
  return codes.length > 0 ? codes : [...GATE_TYPE_CODES_DEFAULT];
}

/** Grams in one each, by package type. Blank falls back to PRE 28, MOB 70.
 * A pair whose number is not a positive amount is dropped; if nothing valid
 * remains, the default stands. */
export const GATE_UNIT_GRAMS_DEFAULT: Readonly<Record<string, number>> = { PRE: 28, MOB: 70 };
export function parseGateUnitGrams(raw: string | null | undefined): Record<string, number> {
  const text = String(raw ?? "").trim();
  if (!text) return { ...GATE_UNIT_GRAMS_DEFAULT };
  const out: Record<string, number> = {};
  for (const part of text.split(",")) {
    const at = part.indexOf("=");
    if (at < 1) continue;
    const code = part.slice(0, at).trim().toUpperCase();
    const gramsText = part.slice(at + 1).trim();
    if (!code || !/^\d+(\.\d+)?$/.test(gramsText)) continue;
    const grams = Number(gramsText);
    if (!Number.isFinite(grams) || grams <= 0) continue;
    if (out[code] == null) out[code] = grams;
  }
  return Object.keys(out).length > 0 ? out : { ...GATE_UNIT_GRAMS_DEFAULT };
}

/** Grams in one each for the fulfillment rows METRC counts as eaches.
 * Blank falls back to prepack 28, mobs 70, prerolls 1, vapes 1. A pair whose
 * number is not a positive amount is dropped; if nothing valid remains, the
 * default stands. */
export const FULFILLMENT_UNIT_GRAMS_DEFAULT: Readonly<Record<string, number>> = {
  prepack: 28,
  mobs: 70,
  prerolls: 1,
  vapes: 1,
};
export function parseFulfillmentUnitGrams(raw: string | null | undefined): Record<string, number> {
  const text = String(raw ?? "").trim();
  if (!text) return { ...FULFILLMENT_UNIT_GRAMS_DEFAULT };
  const out: Record<string, number> = {};
  for (const part of text.split(",")) {
    const at = part.indexOf("=");
    if (at < 1) continue;
    const key = part.slice(0, at).trim().toLowerCase();
    const gramsText = part.slice(at + 1).trim();
    if (!key || !/^\d+(\.\d+)?$/.test(gramsText)) continue;
    const grams = Number(gramsText);
    if (!Number.isFinite(grams) || grams <= 0) continue;
    if (out[key] == null) out[key] = grams;
  }
  return Object.keys(out).length > 0 ? out : { ...FULFILLMENT_UNIT_GRAMS_DEFAULT };
}

/** THE TRIM BOGEY (canon 0.30.249): the product line of 0.30.243, 40 percent,
 * until a hand saves another. */
export const TRIM_BOGEY_DEFAULT = 40;

/** A typed Trim Bogey: a whole percent 0 to 100 (a trailing % is tolerated);
 * null for anything else, so the form refuses it in words. */
export function trimBogeyOf(raw: unknown): number | null {
  const text = String(raw ?? "").trim().replace(/%$/, "").trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const n = Number(text);
  return n >= 0 && n <= 100 ? n : null;
}

/** The stored Trim Bogey; the default when the row is missing or unreadable. */
export function parseTrimBogey(raw: string | null | undefined): number {
  return trimBogeyOf(raw) ?? TRIM_BOGEY_DEFAULT;
}

/** THE CRYO CATEGORIES (canon 0.30.112): the product categories a cryo line
 * may be entered under, from the app_config comma list in the owner's order,
 * uppercased and deduped; his WPR, BUD, SHA when the value is blank. */
export const CRYO_CATEGORIES_DEFAULT: readonly string[] = ["WPR", "BUD", "SHA"];
export function parseCryoCategories(raw: string | null | undefined): string[] {
  const codes = parseUpperList(raw);
  return codes.length > 0 ? codes : [...CRYO_CATEGORIES_DEFAULT];
}

/** A comma list of names as typed (trimmed, deduped case-insensitively, the
 * first spelling kept), for the shift operators; empty when blank. */
export function parseNameList(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of String(raw ?? "").split(",")) {
    const name = part.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function parseUpperList(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const part of String(raw ?? "").split(",")) {
    const code = part.trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

/** THE HARVEST CONSOLE (canon 0.30.73): the fresh frozen (FFZ) cube counts the
 * ledger grams at this location and every cryo'd package wherever it sits. */
export const LOC_BLAST_FREEZER = "Blast Freezer";
/** THE CRYO RUN (canon 0.30.110; owner: "Always print Cryo Room"): the METRC
 * location every cryo output is born at and the New Packages file prints. */
export const LOC_CRYO_ROOM = "Cryo Room";
export const LOC_ARL_BARN = "ARL BARN";
export const LOC_PNS_BARN = "PNS BARN";

export type SiteCode = "PNN" | "ARL" | "PNS" | "PROCESSOR";

/** Silo dry-space names ride the 832 side (canon 0.24.2: silos are inherently from PNN). */
export const PNN_SILO_LOCATIONS = ["Silo 1", "Silo 2", "Silo 3", "Silo 4", "Silo 5"] as const;

/** Side convention v2 (canon 0.25.0): data in code, not schema.
 * BARN, CSA, and the silo dry spaces are PNN 832-side.
 * ARL BARN is ARL (AU-G-C-001509 side).
 * PNS BARN is PNS (AU-G-C-001397 side).
 * CSB and every unknown location default PROCESSOR side under 694. */
export const SITE_OF_LOCATION: Record<string, SiteCode> = {
  [LOC_BARN]: "PNN",
  [LOC_CSA]: "PNN",
  // Canon 0.30.40: the Blast Freezer is PNN at every license (his list).
  [LOC_BLAST_FREEZER]: "PNN",
  [LOC_ARL_BARN]: "ARL",
  [LOC_PNS_BARN]: "PNS",
  [LOC_CSB]: "PROCESSOR",
  "Silo 1": "PNN",
  "Silo 2": "PNN",
  "Silo 3": "PNN",
  "Silo 4": "PNN",
  "Silo 5": "PNN",
};

export function siteOfLocation(value: string): SiteCode {
  return SITE_OF_LOCATION[value] ?? "PROCESSOR";
}

/** THE HARVEST CONSOLE (canon 0.30.73): the site a dry space stands at, from
 * its farm_code: ARL or PNS when it says so, PNN otherwise (the five silos, the
 * PNN rooms, a blank). */
export function siloSiteOf(farmCode: string | null | undefined): "ARL" | "PNN" | "PNS" {
  return farmCode === "ARL" || farmCode === "PNS" ? farmCode : "PNN";
}

export function barnLocationForSite(site: "ARL" | "PNN" | "PNS"): string {
  if (site === "ARL") return LOC_ARL_BARN;
  if (site === "PNS") return LOC_PNS_BARN;
  return LOC_BARN;
}

export function licenseForSiteArrival(site: "ARL" | "PNN" | "PNS"): string {
  if (site === "ARL") return LICENSE_ARL_AU;
  if (site === "PNS") return LICENSE_PNS_AU;
  return LICENSE_AU_GROW;
}

export function farmFromSiteCode(site: SiteCode): "ARL" | "PNN" | "PNS" | null {
  if (site === "ARL" || site === "PNN" || site === "PNS") return site;
  return null;
}

export function isGrowSideLocation(value: string): boolean {
  const site = siteOfLocation(value);
  return site === "PNN" || site === "ARL" || site === "PNS";
}

/** Owner ruling 2026-09-07 (canon 0.29.1): "Dry weight can keep the 'on site'
 * question only for Spears that aren't at North." Where the material sits: the
 * minted item's location wins when it resolves to a grow site (a truck-received
 * lot lives at its destination, not its batch farm); an unresolvable location
 * (a plain hang room name) falls back to the batch farm. North bucks on site;
 * the question dies there. */
export function materialAtNorth(itemLocation: string | null, batchFarm: string | null): boolean {
  if (itemLocation) {
    const site = siteOfLocation(itemLocation);
    if (site === "PNN") return true;
    if (site === "ARL" || site === "PNS") return false;
  }
  return batchFarm === "PNN";
}

export function isProcessorSideLocation(value: string): boolean {
  return siteOfLocation(value) === "PROCESSOR";
}

/** Scribe gate fix (canon 0.20.1 queue): IN-TRANSIT is a state, not a shelf.
 * Unknown locations fall to PROCESSOR (694). IN-TRANSIT is never pickable. */
export function isPickableProcessorDestination(value: string): boolean {
  return isProcessorSideLocation(value) && value !== LOC_IN_TRANSIT;
}

/** Item kinds are lookup-backed data, never a closed TypeScript enum. */
export const ITEM_KIND_SPR = "SPR";
export const ITEM_KIND_WIP = "WIP";
export const ITEM_KIND_FG = "FG";

/** Report-only pseudo-kind (owner ruling 2026-09-06, canon 0.27.2): pre-ledger
 * wet-lot material on the Inventory by Location report. Never stored in
 * local_inventory_items and never part of ITEM_KIND_ORDER. */
export const ITEM_KIND_WET = "WET";
/** Canon 0.30.69: the Inventory by Location report's bottom row under a silo, its wet weight. */
export const ITEM_KIND_WET_TOTAL = "Wet total";

/** Inventory list and report order: WIP, then SPR, then FG, then anything else. */
export const ITEM_KIND_ORDER = [ITEM_KIND_WIP, ITEM_KIND_SPR, ITEM_KIND_FG] as const;

export function itemKindSortKey(kind: string): number {
  const i = (ITEM_KIND_ORDER as readonly string[]).indexOf(kind);
  return i === -1 ? ITEM_KIND_ORDER.length : i;
}

export const TIME24_PATTERN = "([01][0-9]|2[0-3]):[0-5][0-9]";
export const TIME24_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function isTime24(value: string): boolean {
  return TIME24_RE.test(value);
}

export function kindMintedOnFinish(drySpaceKind: string): string | null {
  if (drySpaceKind === "hang") return ITEM_KIND_SPR;
  if (drySpaceKind === "silo") return ITEM_KIND_WIP;
  return null;
}

/** Owner ruling 2026-08-31: trucks are record-borne and numbered per HBN. Takes the
 * truck numbers already on one batch's lots (plus any staged number) and returns
 * 1 past the highest; values that are not positive integers are ignored. */
export function nextTruckNumber(taken: ReadonlyArray<string | number>): number {
  let max = 0;
  for (const value of taken) {
    const n = Number(value);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}

export function isTestOutcome(value: string): value is TestOutcome {
  return (TEST_OUTCOMES as readonly string[]).includes(value);
}
