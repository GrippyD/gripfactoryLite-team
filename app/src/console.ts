/**
 * THE HARVEST CONSOLE (canon 0.30.73). Owner ruling 2026-09-15, verbatim:
 *
 *   "Let's strike the dashboard.  Remove it from the report list.  In Admin,
 *    add a new button: [Harvest Console]
 *
 *    Collapsible Sections:
 *
 *    Plants: four small boxes naming the farms and a total box.  Shading
 *    reflects percent complete.
 *
 *    1. Plants Remaining/Total Plants
 *    2. Plants Harvested
 *    3. % Complete
 *    4. Wet Weight/plant AVG
 *    5. Dry Weight/plant AVG
 *    6. Cutting and Bucking Hours Yesterday [open numbox]
 *    7. Weight/DLH Yesterday
 *
 *    Drying: our silos animation, a 3d wire rectangular one called "Arlington
 *    dry room" go ahead and add this as another "silo" as well (cap is 15000
 *    wet lbs, same as silos), we're going to need to cross this bridge soon
 *    anyways, and add our FFZ inventory in a blue wire cube, capacity in there
 *    is 4800 lbs (deeper blue slower throbbing to white for "fullness") (no
 *    timer).  Keep the shapes proportional to what we have for the silos,
 *    those are perfect.
 *
 *    Trimming: stub
 *
 *    Pasteurization: stub
 *
 *    Testing: stub"
 *
 * THE TRIMMING SECTION (canon 0.30.88). Owner ruling 2026-09-16, verbatim:
 *
 *   "in the harvest console (not the continuum one) let's work on Trimming:
 *
 *    Day shift:
 *
 *    Lbs Produced Yesterday
 *    DLH Yesterday: [numbox]
 *    Lbs/DLH
 *    BTR (BTR=(BUD+WPR+SHA)/All weight ran that shift) shown as a percentage
 *    BUD = [BUD+WPR+SHA]
 *    OTHER = All other
 *
 *    Second Shift
 *    Same
 *
 *    Display them in a visual way (graphed or something, a pictograph of some
 *    kind maybe)"
 *
 * His picks (AskUserQuestion, 2026-09-16): the shifts are the operators, "Olga
 * = Days, Victor = Afternoons" (the trim operator typed on each package names
 * its shift; the lists live in app_config), and "WPR means SMALLS" (SHA is
 * SHAKE), so BTR counts BUD, SMALLS and SHAKE over all weight ran. Yesterday's
 * packages are the trim room's entries dated yesterday (trim_date). The
 * pictograph is a waffle of 100 cells, one per percent of the weight ran, the
 * BUD share filled from the bottom up, the numbers beside it.
 *
 * His picks (AskUserQuestion, 2026-09-15): the new page is [Harvest Console]
 * at /harvest and the vendored planting app's tile reads Harvest Console Lite;
 * the boxes are the three farms (PNN, ARL, PNS) and Total, four in all; the FFZ
 * cube reads "Any FFZ" (the Blast Freezer ledger grams plus every cryo'd
 * package wherever it sits); the Arlington Dry Room is a real silo now.
 *
 * The Plants laws carry over from the struck Harvest Dashboard (canon
 * 0.30.6x): plants remaining are the METRC mirror's live plants under each
 * farm's licenses; plants harvested add the plant counts typed on the farm's
 * finished lots this harvest year; % complete is harvested over the total; the
 * per-plant averages read the season's finished lots that carry a count. New
 * here: the Cutting and Bucking hours are typed on the console itself, one
 * number per farm per day (harvest_labor_hours, migration 0049), and
 * Weight/DLH Yesterday divides the wet grams weighed yesterday (the farm's
 * day, Eastern time) by yesterday's hours.
 *
 * THE FARM DAY BEGINS AT SIX (canon 0.30.151): the console's today and yesterday
 * are farm days (the day rolls at app_config farm_day_start_hour, Eastern), and
 * the windows they draw run from start hour to start hour.
 *
 * THE CONSOLE DAY (canon 0.30.152). Owner, 2026-09-20, verbatim: "on the
 * dashboard, can we do a universal date override?  It defaults to "yesterday"
 * and I can change it to any other day?" One date control at the top of the
 * console (?day=YYYY-MM-DD): it defaults to yesterday (the farm day before
 * today), takes any day up to today, and every yesterday pane follows it (the
 * Cutting and Bucking hours, Weight/DLH, the whole Trimming section), the hours
 * typed landing on that day; the Plants figures stay the season's and the
 * drying strip stays live. The labels name the day beside the pane titles.
 *
 * THE TRIM LINE PICTURE (canon 0.30.154). Owner, 2026-09-21, with his machine
 * picture (a circle TRIM above a box T-0, T-0 joined left to SORTER then to
 * MARVEL by thick flow bars, MARVEL fanning down to BIO, BUD and RETRIM),
 * verbatim: "This is what I want to use for the "visual" aspect of the trimming
 * panes on the harvest dashboard.  Follow our css for the lines and background
 * color.  The ruby colored elements are "flow" bars (like our barber/candy poles
 * in the harvest console for continuum) keep them that width but use the green
 * candy striping at move at the same cadence as the drying locations I would
 * like lines running from each endpoint that converge and show the shift total
 * [...] Trim + BIO + WIP (after a package is moved to finished on the trim line
 * and there's still WIP in it) = Other / Shake + BUD = Bulk Bud / WPR = Prepack
 * Bud / Total Bud = Bulk + Prepack / BTR = Total Bud/Total Dry weight of package
 * / Under that we can list the hours from the sheet for that same date / Ender
 * the hours we can take input lbs (total lbs ran through T-0) / Use the same
 * "RUNNING" flash you do on the silos while there's open lots running through
 * the time weight entry node". His picks (AskUserQuestion, 2026-09-21): the
 * endpoints carry the shift's grams (BIO the BIO stream, BUD the Total Bud, RETRIM
 * the rest of Other, converging on the shift total; the TRIM circle the typed
 * input pounds); RUNNING is a package weighed in the last 30 minutes; the BTR
 * denominator is the grams weighed that shift plus the WIP left in the lots it
 * finished (a lot finished under the adjustment gate with Recorded short of its
 * dry weight leaves that difference as WIP, landing on the shift whose operator
 * cut its last package); the input lbs box is per shift, beside the DLH box
 * (trim_line_inputs, migration 0065). The picture replaces the waffle in each
 * shift card; the flow bars carry the continuum tubes' green stripes and move
 * only while the line runs; Other also gathers MIX, KIEF, WASTE and any other
 * type so the converging total stays honest.
 *
 * THE BUD WAFFLE (canon 0.30.157, built 0.30.159). Owner, 2026-09-21, with
 * his drawing of 100 squares in a bud: BTR on each shift card is that bud,
 * one cell per percent, consumed grey in ROYGBIV order then the center last
 * (the drawing's colors fix the order, they never render), outlines when
 * nothing ran. The bud stands beside the machine picture, the BTR read and
 * a bud/consumed legend under it. THE DEEPER BUD (canon 0.30.160). Owner,
 * 2026-09-21, verbatim: "Hang on, I added gradients, I was looking at the
 * numerator, not the denominator when I answered your BTR question.  ROYGBIV,
 * then White, then black please.  We'll have BTRs as low as 15% I imagine":
 * his third drawing, ten bands of ten (red, orange, yellow, light green, blue,
 * indigo, violet, white, black, the dark green center last).
 *
 * THE PLUME (canon 0.30.207). Owner, 2026-09-23, with his fourth drawing, a
 * peacock plume of colored squares, verbatim: "There should be 102 squares.
 * Dark green is permanent (2 squares) everything else represents consumption
 * in ROYGBIVWB order (left-to-right, top-to-bottom).  Check my counts and
 * reapply to the trim section". The Scribe's count read 103 (an eleventh
 * orange on the stem); his pick: drop the stem's orange, so the stem reads
 * dark green, dark green, red, red. The bud is now the plume: the same 100
 * consumption cells in ten bands of ten (red, orange, yellow, green, blue,
 * indigo, violet, white, black, then the teal core as the center, last), on a
 * 16 by 13 lattice, plus two permanent stem cells that render in every state.
 */

import { formatLbs } from "./compliance";
import {
  CONFIG_KEYS,
  formatGrams,
  formatGramsWhole,
  HARVEST_HOURS_PATH,
  HARVEST_PATH,
  HARVEST_TRIM_HOURS_PATH,
  HARVEST_TRIM_INPUT_PATH,
  HARVEST_PREPACK_HOURS_PATH,
  parsePrepackUnits,
  NON_TRIM_SOURCE_SQL,
  parseBtrTypeCodes,
  parseCryoTypeCategories,
  parseGateTypeCodes,
  parseGateUnitGrams,
  parseNameList,
  parseShiftWindow,
  parseTrimBogey,
  roundGrams,
  shiftWindowHolds,
  SYSTEM_REASON,
  TEST_CONSOLE_SCHEDULED,
  TEST_OPEN_STATUSES,
  TRIM_SHIFT_HOURS_DEFAULT,
} from "./config";
import { HttpError, nowIso, textOrNull } from "./audit";
import { getConfigValue, insertLog, TRIM_SCHEDULED_SQL } from "./db";
import { siloStrip } from "./drying";
import { dryingTotalsMarkup, type DryingTotals } from "./silo";
import { dayBefore, etClockMinutes, etDate, etDayBounds, FARM_TIME_ZONE, farmDay, farmDayBounds, isCalendarDate, parseFarmDayStartHour } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { type SiloLive } from "./silo";
import { latestSheetSync, sheetSyncLineText, type SheetSyncView } from "./sheetsync";
import { outcomeOf } from "./intesting";
import { consoleIconSvg, type ConsoleIconName } from "./consoleicons";
import { esc } from "./ui";

export const CONSOLE_FARMS = ["PNN", "ARL", "PNS"] as const;
export type ConsoleFarm = (typeof CONSOLE_FARMS)[number];
export const CONSOLE_TIME_ZONE = FARM_TIME_ZONE;
export { HARVEST_PATH, HARVEST_HOURS_PATH, HARVEST_TRIM_HOURS_PATH, HARVEST_TRIM_INPUT_PATH };

/* --------------------------------------------------------------- the day */

// The Eastern day helpers moved to farmday.ts (a leaf) for THE EFFECTIVE DATE
// (canon 0.30.92); re-exported here so the console's readers keep their import.
export { etDate, dayBefore, etDayBounds };

/* ----------------------------------------------------------- the numbers */

export type FarmCount = { farm: string | null; plants: number };
export type FarmGrams = { farm: string | null; wet_grams: number };
export type ConsoleLot = { farm: string | null; wet_grams: number; dry_grams: number | null; plant_count: number | null };

export type HarvestConsoleInput = {
  /** The farm's day today (by the start hour in data), YYYY-MM-DD, and the harvest year. */
  today: string;
  /** THE CONSOLE DAY (canon 0.30.152): the day under view, yesterday by default or the picked day;
   * every "yesterday" pane, window and hours box reads it. */
  yesterday: string;
  /** True when the day under view is the picked one, not the default yesterday. */
  dayPicked: boolean;
  year: number;
  /** Live plants in the mirror (gone_at NULL) by the farm of the license. */
  remaining: FarmCount[];
  /** Plant counts on finished lots of the harvest year, by farm. */
  seasonHarvested: FarmCount[];
  /** Finished lots of the harvest year, for the per-plant averages. */
  seasonLots: ConsoleLot[];
  /** Wet grams weighed yesterday (the farm's day), by farm. */
  yesterdayWet: FarmGrams[];
  /** Yesterday's Cutting and Bucking hours typed per farm; null when none typed. */
  hours: Record<ConsoleFarm, number | null>;
  /** Farm Plant Count for the harvest year: the constant denominator, null when none is saved. */
  plantCounts: Record<ConsoleFarm, number | null>;
  /** THE TRIMMING SECTION (canon 0.30.88): yesterday's trim room, by shift; absent renders the section empty. */
  trim?: TrimInput;
  /** THE SHEET SYNC (canon 0.30.162): the last run of the sheet sync (ok, skipped or failed), null before any run;
   * the second line under the sheet hours reads it. */
  sheetSync?: SheetSyncView | null;
};

/* ------------------------------------------------------------ the trimming */

export type TrimShiftKey = "day" | "second";
/** His two shifts, in his words and order: "Day shift" and "Second Shift". */
export const TRIM_SHIFTS: readonly { key: TrimShiftKey; label: string; configKey: string }[] = [
  { key: "day", label: "Day shift", configKey: CONFIG_KEYS.trim_shift_day_operators },
  { key: "second", label: "Second Shift", configKey: CONFIG_KEYS.trim_shift_second_operators },
];

/** One trim room package dated yesterday: its type, grams and the operator who typed it. */
export type TrimPackageRow = { type_code: string | null; weight_grams: number; trim_operator: string | null };

/** THE TRIM LINE PICTURE (canon 0.30.154): a lot finished on the trim line
 * within the day's window (its status log to trimmed), with its dry weight, the
 * grams its trim containers recorded, and the operator who cut its last
 * package (the shift that finished it). The WIP left is dry less recorded when
 * that is above zero: the material still in the package after the finish. */
export type TrimFinishedLot = { lot_id: string; dry_grams: number | null; recorded_grams: number; last_operator: string | null };

/** A package weighed at the trim weight entry node lately: the operator who typed it (the shift it lights). */
export type TrimRecentRow = { trim_operator: string | null };

/** RUNNING (his pick, 2026-09-21): a package weighed in the last 30 minutes;
 * THE LINE RUNS ON THE CLOCK (canon 0.30.163; owner, 2026-09-21: "Switch trimming
 * to "running" if it's currently the correct time and any lot is present in the
 * queue."): the shift whose hours hold the Eastern clock also runs while a lot
 * stands in the Unloaded Queue for trim. */
export const TRIM_RUNNING_MINUTES = 30;

// THE PROGRESSION BUD (canon 0.30.273). Owner, 2026-09-27, verbatim: "change trim
// consumption graph to the attached shape/progression. ... each one represents a
// cumulative percent--so instead of "consumption" this reads more like progression,
// but either way, reverse the order for consumption". His drawing: 100 cells, 1 at
// the heart and 100 at the foot of the stem. Each entry is [row, column, drawn number].
// 19 rows by 13 columns. The stem (50, 82, 83, 100) counts like any cell.
export const BUD_ROWS = 19;
export const BUD_COLS = 13;
export const BUD_CELLS: ReadonlyArray<readonly [number, number, number]> = [
  [13, 6, 1], [12, 6, 2], [11, 6, 3], [12, 5, 4], [12, 7, 5], [11, 7, 6], [11, 5, 7], [10, 6, 8], [9, 6, 9], [10, 5, 10],
  [10, 7, 11], [12, 4, 12], [12, 8, 13], [13, 5, 14], [13, 7, 15], [14, 6, 16], [8, 6, 17], [9, 5, 18], [9, 7, 19], [11, 4, 20],
  [11, 8, 21], [10, 8, 22], [10, 4, 23], [7, 6, 24], [8, 5, 25], [8, 7, 26], [9, 4, 27], [9, 8, 28], [6, 6, 29], [13, 4, 30],
  [13, 8, 31], [12, 3, 32], [12, 9, 33], [11, 9, 34], [11, 3, 35], [10, 3, 36], [10, 9, 37], [7, 5, 38], [7, 7, 39], [5, 6, 40],
  [8, 4, 41], [8, 8, 42], [9, 3, 43], [9, 9, 44], [6, 5, 45], [6, 7, 46], [4, 6, 47], [7, 4, 48], [7, 8, 49], [15, 6, 50],
  [14, 5, 51], [14, 7, 52], [5, 5, 53], [5, 7, 54], [4, 5, 55], [4, 7, 56], [3, 6, 57], [6, 4, 58], [6, 8, 59], [5, 4, 60],
  [5, 8, 61], [8, 3, 62], [8, 9, 63], [7, 3, 64], [7, 9, 65], [2, 7, 66], [2, 5, 67], [4, 3, 68], [4, 9, 69], [3, 10, 70],
  [3, 2, 71], [7, 2, 72], [7, 10, 73], [6, 11, 74], [6, 1, 75], [5, 1, 76], [5, 11, 77], [6, 0, 78], [6, 12, 79], [10, 10, 80],
  [10, 2, 81], [16, 6, 82], [17, 6, 83], [10, 1, 84], [10, 11, 85], [9, 12, 86], [11, 12, 87], [9, 0, 88], [11, 0, 89], [2, 2, 90],
  [2, 10, 91], [1, 11, 92], [1, 1, 93], [1, 4, 94], [1, 8, 95], [0, 10, 96], [0, 7, 97], [0, 5, 98], [0, 2, 99], [18, 6, 100],
];

export type TrimInput = {
  /** Yesterday's non-voided packages from Trim Packages Entry (trim_date = yesterday). */
  packages: TrimPackageRow[];
  /** The package type codes that count as BUD (app_config btr_type_codes). */
  budCodes: string[];
  /** The trim operators of each shift (app_config trim_shift_day_operators, trim_shift_second_operators). */
  operators: Record<TrimShiftKey, string[]>;
  /** Yesterday's typed DLH per shift; null when none typed. */
  hours: Record<TrimShiftKey, number | null>;
  /** THE TRIM LINE PICTURE (canon 0.30.154): the BUD-set types whose product category is WPR
   * (app_config cryo_type_categories, SMALLS by default): his Prepack Bud. The rest of the set is Bulk Bud. */
  prepackCodes?: string[];
  /** Lots finished on the trim line within the day's window; their WIP left lands on Other. */
  finishedLots?: TrimFinishedLot[];
  /** The typed input pounds per shift (trim_line_inputs); null when none typed. */
  inputLbs?: Record<TrimShiftKey, number | null>;
  /** Packages weighed in the last TRIM_RUNNING_MINUTES, any day: the shifts they light. */
  recent?: TrimRecentRow[];
  /** THE LINE RUNS ON THE CLOCK (canon 0.30.163): lots standing in the Unloaded Queue for trim now. */
  queueLots?: number;
  /** THE DRYING TOTALS (canon 0.30.183): the dry grams those queued lots carry. */
  queueGrams?: number;
  /** The instant the figures are read at (the Eastern clock decides the shift on duty). */
  nowIso?: string;
  /** Each shift's hours, HH:MM-HH:MM Eastern (app_config trim_shift_day_hours, trim_shift_second_hours; the code's 6-6 and 6-6 otherwise). */
  shiftHours?: Partial<Record<TrimShiftKey, string | null>>;
  /** THE TRIM BOGEY (canon 0.30.249): the percent of the plume that is product (app_config trim_bogey_pct; 40 otherwise). */
  bogeyPct?: number;
};

export type TrimShiftFigures = {
  key: TrimShiftKey;
  label: string;
  operators: string[];
  packages: number;
  /** All weight ran that shift, grams (the packages weighed). */
  grams: number;
  /** His Total Bud = Bulk + Prepack (the BTR set: BUD, SHAKE, SMALLS as WPR), grams. */
  budGrams: number;
  /** His Other = TRIM + BIO + the WIP left in finished packages, plus any other type, grams. */
  otherGrams: number;
  /** BTR, 0..1: Total Bud over the shift total (weighed plus WIP left); null when nothing ran. */
  btr: number | null;
  hours: number | null;
  /** Grams per direct labor hour; null without hours. */
  gramsPerDlh: number | null;
  /** THE TRIM LINE PICTURE (canon 0.30.154): his Bulk Bud = SHAKE + BUD (the BTR set less the prepack types). */
  bulkGrams: number;
  /** His Prepack Bud = WPR (SMALLS). */
  prepackGrams: number;
  /** The BIO stream. */
  bioGrams: number;
  /** The TRIM stream. */
  trimGrams: number;
  /** Every other type (MIX, KIEF, WASTE, unknown), gathered into Other. */
  restGrams: number;
  /** The WIP left in the lots this shift finished (dry weight less recorded, above zero). */
  wipLeftGrams: number;
  /** How many lots this shift finished on the trim line within the day's window. */
  finishedLots: number;
  /** The shift total the endpoints converge on: grams weighed plus the WIP left. */
  totalGrams: number;
  /** The typed input pounds (total lbs run through T-0); null when none typed. */
  inputLbs: number | null;
  /** RUNNING: the clock is inside this shift's hours and a lot stands in the Unloaded Queue for trim,
   * or one of this shift's operators weighed a package in the last 30 minutes. */
  running: boolean;
  /** The Eastern clock is inside this shift's hours. */
  onDuty: boolean;
  /** This shift's hours as read (HH:MM-HH:MM). */
  hours_window: string;
};

export type TrimFigures = {
  shifts: TrimShiftFigures[];
  /** Grams by operators named on neither shift, so nothing disappears in silence. */
  unassignedGrams: number;
  unassignedOperators: string[];
  /** RUNNING by operators on neither shift: the line runs, no card can flash it. */
  unassignedRunning: boolean;
};

export function emptyTrimInput(): TrimInput {
  return { packages: [], budCodes: parseBtrTypeCodes(null), operators: { day: [], second: [] }, hours: { day: null, second: null } };
}

/** THE TRIM LINE PICTURE (canon 0.30.154): the prepack types from the cryo
 * category map (the types whose category is WPR), his SMALLS by default. */
export function prepackCodesOf(categories: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [type, cat] of categories) if (cat === "WPR") out.push(type);
  return out;
}

/** The figures, pure: each package lands on the shift its operator is named
 * on (case-insensitive), its grams on Total Bud when its type is in the BTR set
 * (Prepack when the type is a WPR type, Bulk otherwise), else on Other by
 * stream (TRIM, BIO, the rest); a finished lot's WIP left lands on Other for the
 * shift whose operator cut its last package; the shift total is the grams
 * weighed plus the WIP left; BTR is Total Bud over that total; Lbs/DLH divides
 * the grams weighed by the typed hours; RUNNING lights the shift whose operator
 * weighed a package lately. */
export function trimFigures(input: TrimInput): TrimFigures {
  const bud = new Set(input.budCodes.map((c) => c.trim().toUpperCase()));
  const prepack = new Set((input.prepackCodes ?? prepackCodesOf(parseCryoTypeCategories(null))).map((c) => c.trim().toUpperCase()));
  const shiftOf = new Map<string, TrimShiftKey>();
  for (const shift of TRIM_SHIFTS) {
    for (const name of input.operators[shift.key] ?? []) shiftOf.set(name.trim().toLowerCase(), shift.key);
  }
  const keyOf = (operator: string | null | undefined): TrimShiftKey | undefined => shiftOf.get(String(operator ?? "").trim().toLowerCase());
  type Acc = { packages: number; grams: number; bulk: number; prepack: number; bio: number; trim: number; rest: number; wip: number; finished: number; running: boolean };
  const fresh = (): Acc => ({ packages: 0, grams: 0, bulk: 0, prepack: 0, bio: 0, trim: 0, rest: 0, wip: 0, finished: 0, running: false });
  const acc: Record<TrimShiftKey, Acc> = { day: fresh(), second: fresh() };
  let unassignedGrams = 0;
  const unassigned = new Set<string>();
  for (const p of input.packages) {
    const grams = Number(p.weight_grams ?? 0);
    const operator = String(p.trim_operator ?? "").trim();
    const key = keyOf(operator);
    if (!key) {
      unassignedGrams += grams;
      if (operator) unassigned.add(operator);
      continue;
    }
    const a = acc[key];
    a.packages += 1;
    a.grams += grams;
    const type = String(p.type_code ?? "").trim().toUpperCase();
    if (bud.has(type)) {
      if (prepack.has(type)) a.prepack += grams;
      else a.bulk += grams;
    } else if (type === "BIO") a.bio += grams;
    else if (type === "TRIM") a.trim += grams;
    else a.rest += grams;
  }
  for (const lot of input.finishedLots ?? []) {
    const key = keyOf(lot.last_operator);
    if (!key) continue;
    const left = Number(lot.dry_grams ?? 0) - Number(lot.recorded_grams ?? 0);
    acc[key].finished += 1;
    if (left > 0) acc[key].wip += left;
  }
  let unassignedRunning = false;
  for (const r of input.recent ?? []) {
    const key = keyOf(r.trim_operator);
    if (key) acc[key].running = true;
    else unassignedRunning = true;
  }
  // THE LINE RUNS ON THE CLOCK: the shift on duty runs while the queue holds a lot.
  const clock = input.nowIso ? etClockMinutes(input.nowIso) : null;
  const queueLots = Number(input.queueLots ?? 0);
  const windows: Record<TrimShiftKey, string> = {
    day: String(input.shiftHours?.day ?? "").trim() || TRIM_SHIFT_HOURS_DEFAULT.day,
    second: String(input.shiftHours?.second ?? "").trim() || TRIM_SHIFT_HOURS_DEFAULT.second,
  };
  const onDuty: Record<TrimShiftKey, boolean> = {
    day: clock != null && shiftWindowHolds(parseShiftWindow(windows.day, TRIM_SHIFT_HOURS_DEFAULT.day), clock),
    second: clock != null && shiftWindowHolds(parseShiftWindow(windows.second, TRIM_SHIFT_HOURS_DEFAULT.second), clock),
  };
  const shifts = TRIM_SHIFTS.map((shift) => {
    const a = acc[shift.key];
    const grams = roundGrams(a.grams);
    const budGrams = roundGrams(a.bulk + a.prepack);
    const wipLeftGrams = roundGrams(a.wip);
    const otherGrams = roundGrams(a.trim + a.bio + a.rest + a.wip);
    const total = a.grams + a.wip;
    const hours = input.hours[shift.key] ?? null;
    return {
      key: shift.key,
      label: shift.label,
      operators: input.operators[shift.key] ?? [],
      packages: a.packages,
      grams,
      budGrams,
      otherGrams,
      btr: total > 0 ? (a.bulk + a.prepack) / total : null,
      hours,
      gramsPerDlh: hours != null && hours > 0 ? grams / hours : null,
      bulkGrams: roundGrams(a.bulk),
      prepackGrams: roundGrams(a.prepack),
      bioGrams: roundGrams(a.bio),
      trimGrams: roundGrams(a.trim),
      restGrams: roundGrams(a.rest),
      wipLeftGrams,
      finishedLots: a.finished,
      totalGrams: roundGrams(total),
      inputLbs: input.inputLbs?.[shift.key] ?? null,
      running: a.running || (onDuty[shift.key] && queueLots > 0),
      onDuty: onDuty[shift.key],
      hours_window: windows[shift.key],
    };
  });
  return { shifts, unassignedGrams: roundGrams(unassignedGrams), unassignedOperators: [...unassigned].sort(), unassignedRunning };
}

/** THE TRIM LINE PICTURE (canon 0.30.154): his machine picture as the shift's
 * visual. A circle TRIM over the box T-0; T-0 joined left to SORTER and SORTER
 * to MARVEL by flow bars; MARVEL fanning down to BIO (the tilted square), BUD
 * and RETRIM by three more. The bars keep his width (44 of 1000) and carry the
 * continuum tubes' green candy stripes (7 px at 135 degrees), which move toward
 * the next machine at the drying locations' calm cadence (900 ms a tile) while
 * the line runs and stand still otherwise. The endpoints carry the shift's
 * grams (his pick): BIO the BIO stream, BUD the Total Bud with bulk and prepack
 * named under it, and the TRIM circle the rest of Other (the TRIM stream, the
 * WIP left in finished packages, every other type); T-0 the grams weighed, the
 * package count and the typed input pounds (the total run through it); RETRIM
 * carries no figure yet. THE CIRCLE IS FED BY T-0 (his correction, 2026-09-21,
 * verbatim: "The "trim circle" is being fed by the T-0, not feeding it.  The
 * "other" weight is "trim", not retrim.  I don't know how to handle retrim
 * yet"), so its bar flows up, out of T-0. Lines run from the three endpoints
 * (BIO, BUD, TRIM), meet under the picture, and hang the shift total (weighed
 * plus WIP left). Nodes take our panel and line colors through CSS (hc-node),
 * text our text color. */
export const TRIM_LINE_BAR_WIDTH = 44;
export const TRIM_LINE_FLOW_MS = 900;

function trimLineFlowPattern(id: string, axis: "x" | "y", to: number, running: boolean): string {
  const anim = running ? `<animate attributeName="${axis}" from="0" to="${to}" dur="${TRIM_LINE_FLOW_MS}ms" repeatCount="indefinite"/>` : "";
  // A 20 by 20 tile: two bands of the bright green on the dim green, running at
  // 135 degrees (x + y constant), 10 units apart, so each stripe is 7 wide.
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="20" height="20"><rect class="hc-flow-b" width="20" height="20"/><polygon class="hc-flow-a" points="0,0 10,0 0,10"/><polygon class="hc-flow-a" points="20,0 20,10 10,20 0,20"/>${anim}</pattern>`;
}

export function trimLinePicture(shift: TrimShiftFigures, locale: Locale = "en"): string {
  const lb = (grams: number) => `${formatLbs(grams)} lb`;
  const g = (grams: number) => `${formatGrams(roundGrams(grams))} g`;
  const k = esc(shift.key);
  const down = `hc-flow-down-${k}`;
  const left = `hc-flow-left-${k}`;
  const up = `hc-flow-up-${k}`;
  const w = TRIM_LINE_BAR_WIDTH;
  // The rest of Other rides the TRIM circle (his correction): the TRIM stream, the WIP left, every other type.
  const trimGrams = roundGrams(shift.trimGrams + shift.restGrams + shift.wipLeftGrams);
  const input = shift.inputLbs == null ? t(locale, "input lbs") : `${t(locale, "input")} ${shift.inputLbs.toFixed(2)} lb`;
  const total = `${lb(shift.totalGrams)} · ${g(shift.totalGrams)}`;
  const label = `${t(locale, "Shift total")} ${total}`;
  return `<svg class="hc-trimline" viewBox="0 0 1000 704" role="img" aria-label="${esc(label)}" data-hc-trimline data-hc-trimline-running="${shift.running ? "1" : "0"}" data-hc-trimline-total="${esc(String(shift.totalGrams))}">
      <defs>${trimLineFlowPattern(down, "y", 20, shift.running)}${trimLineFlowPattern(left, "x", -20, shift.running)}${trimLineFlowPattern(up, "y", -20, shift.running)}</defs>
      <g class="hc-flows" data-hc-flows>
        <rect class="hc-flow" data-hc-flow="t0-trim" x="${850 - w / 2}" y="144" width="${w}" height="78" fill="url(#${up})"/>
        <rect class="hc-flow" data-hc-flow="t0-sorter" x="646" y="${301 - w / 2}" width="78" height="${w}" fill="url(#${left})"/>
        <rect class="hc-flow" data-hc-flow="sorter-marvel" x="318" y="${301 - w / 2}" width="76" height="${w}" fill="url(#${left})"/>
        <rect class="hc-flow" data-hc-flow="marvel-bud" x="${262 - w / 2}" y="362" width="${w}" height="96" fill="url(#${down})"/>
        <rect class="hc-flow" data-hc-flow="marvel-bio" x="${195 - w / 2}" y="362" width="${w}" height="90" fill="url(#${down})" transform="rotate(30 195 362)"/>
        <rect class="hc-flow" data-hc-flow="marvel-retrim" x="${300 - w / 2}" y="362" width="${w}" height="112" fill="url(#${down})" transform="rotate(-50 300 362)"/>
      </g>
      <g class="hc-converge" data-hc-converge>
        <polyline points="118,548 118,612 990,612"/>
        <polyline points="262,578 262,612"/>
        <polyline points="912,82 990,82 990,612"/>
        <polyline points="520,612 520,634"/>
        <circle class="hc-converge-dot" cx="520" cy="612" r="6"/>
      </g>
      <g class="hc-nodes">
        <circle class="hc-node" data-hc-node="trim" cx="850" cy="82" r="62"/>
        <text class="hc-node-label" x="850" y="80">TRIM</text>
        <text class="hc-node-value" data-hc-node-value="trim" x="850" y="112">${esc(g(trimGrams))}</text>
        <rect class="hc-node" data-hc-node="t0" x="724" y="222" width="250" height="156"/>
        <text class="hc-node-label hc-node-label-big" x="849" y="272">T-0</text>
        <text class="hc-node-value" data-hc-node-value="t0" x="849" y="308">${esc(lb(shift.grams))}</text>
        <text class="hc-node-sub" x="849" y="334">${esc(`${g(shift.grams)} · ${shift.packages} ${t(locale, "packages")}`)}</text>
        <text class="hc-node-sub${shift.inputLbs == null ? " hc-node-muted" : ""}" data-hc-node-value="t0-input" x="849" y="362">${esc(input)}</text>
        <rect class="hc-node" data-hc-node="sorter" x="394" y="258" width="252" height="86"/>
        <text class="hc-node-label hc-node-label-big" x="520" y="316">SORTER</text>
        <rect class="hc-node" data-hc-node="marvel" x="162" y="220" width="156" height="142"/>
        <text class="hc-node-label hc-node-label-small" x="240" y="302">MARVEL</text>
        <g transform="rotate(-30 105 470)">
          <rect class="hc-node" data-hc-node="bio" x="55" y="420" width="100" height="100"/>
          <text class="hc-node-label" x="105" y="466">BIO</text>
          <text class="hc-node-value" data-hc-node-value="bio" x="105" y="496">${esc(g(shift.bioGrams))}</text>
        </g>
        <rect class="hc-node" data-hc-node="bud" x="200" y="458" width="124" height="120"/>
        <text class="hc-node-label" x="262" y="500">BUD</text>
        <text class="hc-node-value" data-hc-node-value="bud" x="262" y="530">${esc(g(shift.budGrams))}</text>
        <text class="hc-node-sub" x="262" y="556">${esc(`${t(locale, "bulk")} ${formatGrams(shift.bulkGrams)} · ${t(locale, "prepack")} ${formatGrams(shift.prepackGrams)}`)}</text>
        <rect class="hc-node" data-hc-node="retrim" x="372" y="422" width="300" height="56"/>
        <text class="hc-node-label" x="522" y="461">RETRIM</text>
      </g>
      <text class="hc-total-label" x="520" y="662">${esc(t(locale, "Shift total"))}</text>
      <text class="hc-total-value" data-hc-trimline-total-text x="520" y="692">${esc(total)}</text>
    </svg>`;
}

export type ConsoleMetric = { key: string; label: string; value: string; sub?: string };

export type ConsoleBox = {
  farm: ConsoleFarm | "Total";
  /** 0..1 of the plants harvested over the total; null when no plants are known. */
  pct: number | null;
  metrics: ConsoleMetric[];
};

function farmOf(value: string | null): ConsoleFarm | null {
  return (CONSOLE_FARMS as readonly string[]).includes(String(value ?? "")) ? (value as ConsoleFarm) : null;
}

function sumBy<T>(rows: readonly T[], farm: ConsoleFarm | null, pick: (r: T) => number, farmOfRow: (r: T) => string | null): number {
  let total = 0;
  for (const r of rows) {
    if (farm != null && farmOf(farmOfRow(r)) !== farm) continue;
    total += Number(pick(r) ?? 0);
  }
  return total;
}

const NA = "";
const fmtCount = (n: number): string => formatGramsWhole(n);
const fmtPct = (n: number): string => `${(n * 100).toFixed(1)}%`;

/** THE PRODUCT LINE (canon 0.30.243): the last forty cells of the order are the product; consuming one is waste. THE TRIM BOGEY (canon 0.30.249) moves the line from Admin; forty is its default. */
export const BUD_PRODUCT_CELLS = 40;

/** THE BUD WAFFLE (canon 0.30.157), drawn as THE PROGRESSION BUD (canon 0.30.273):
 * one cell per cumulative percent. Cell n is bud when n is at most round(btr * 100)
 * and consumed otherwise, which is the consumption order run from 100 down to 1:
 * the first round((1 - btr) * 100) cells of that order are consumed. Outlines when
 * nothing ran. THE PRODUCT LINE and THE TRIM BOGEY: the product is cells 1 to the
 * bogey, the heart, the last of the reversed order. A consumed cell among them
 * carries data-hc-bud-waste. BUD_PRODUCT_CELLS when no bogey is passed; 0 draws
 * no waste; 100 draws every consumed cell as waste. data-hc-bud-order is the
 * consumption position, 101 - n, and data-hc-bud-n is the drawn number. */
export function budWaffle(btr: number | null, locale: Locale = "en", bogeyPct: number = BUD_PRODUCT_CELLS): string {
  const empty = btr == null;
  const lit = empty ? 0 : Math.max(0, Math.min(BUD_CELLS.length, Math.round(btr * 100)));
  const consumed = empty ? 0 : BUD_CELLS.length - lit;
  const label = empty ? t(locale, "no packages yesterday") : `BTR ${fmtPct(btr)}`;
  const product = Number.isFinite(bogeyPct) ? Math.max(0, Math.min(BUD_CELLS.length, Math.round(bogeyPct))) : BUD_PRODUCT_CELLS;
  const cells = BUD_CELLS.map(([row, col, n]) => {
    const order = 101 - n;
    const state = empty ? "empty" : n <= lit ? "bud" : "consumed";
    const waste = state === "consumed" && n <= product ? " data-hc-bud-waste" : "";
    return `<rect class="hc-bud-cell hc-bud-${state}" data-hc-bud-order="${order}" data-hc-bud-n="${n}" x="${col * 10 + 1.2}" y="${row * 10 + 1.2}" width="7.6" height="7.6" rx="1.2"${waste}/>`;
  }).join("");
  return `<svg class="hc-bud" viewBox="0 0 ${BUD_COLS * 10} ${BUD_ROWS * 10}" role="img" aria-label="${esc(label)}" data-hc-bud data-hc-bud-consumed="${consumed}" data-hc-bud-product="${product}">${cells}</svg>`;
}

/** Pounds first, grams under (his numbers are pounds; the floor's are grams). */
function weightPair(grams: number, suffix = ""): { value: string; sub: string } {
  return { value: `${formatLbs(grams)} lb${suffix}`, sub: `${formatGrams(roundGrams(grams))} g${suffix}` };
}

/** The eight metrics for one farm (null is the Total column), pure; the values are display text in the locale. */
export function consoleBoxes(input: HarvestConsoleInput, locale: Locale = "en"): ConsoleBox[] {
  const columns: Array<ConsoleFarm | null> = [...CONSOLE_FARMS, null];
  return columns.map((f) => {
    const farmRemaining = (farm: ConsoleFarm) => sumBy(input.remaining, farm, (r) => r.plants, (r) => r.farm);
    const farmHarvested = (farm: ConsoleFarm) => sumBy(input.seasonHarvested, farm, (r) => r.plants, (r) => r.farm);
    const farmTotal = (farm: ConsoleFarm) => {
      const typed = input.plantCounts[farm];
      return typed == null ? farmRemaining(farm) + farmHarvested(farm) : typed;
    };
    const remaining = f == null ? CONSOLE_FARMS.reduce((n, farm) => n + farmRemaining(farm), 0) : farmRemaining(f);
    const harvested = f == null ? CONSOLE_FARMS.reduce((n, farm) => n + farmHarvested(farm), 0) : farmHarvested(f);
    const total = f == null ? CONSOLE_FARMS.reduce((n, farm) => n + farmTotal(farm), 0) : farmTotal(f);
    const pct = total > 0 ? harvested / total : null;
    const counted = input.seasonLots.filter((l) => (f == null || farmOf(l.farm) === f) && Number(l.plant_count ?? 0) >= 1);
    const plantsIn = (lots: ConsoleLot[]) => lots.reduce((n, l) => n + Number(l.plant_count ?? 0), 0);
    const wetPlants = plantsIn(counted);
    const wetPerPlant = wetPlants > 0 ? counted.reduce((n, l) => n + Number(l.wet_grams ?? 0), 0) / wetPlants : null;
    const dried = counted.filter((l) => l.dry_grams != null && Number(l.dry_grams) > 0);
    const dryPlants = plantsIn(dried);
    const dryPerPlant = dryPlants > 0 ? dried.reduce((n, l) => n + Number(l.dry_grams ?? 0), 0) / dryPlants : null;
    let hours: number | null;
    if (f != null) {
      hours = input.hours[f];
    } else {
      let sum = 0;
      let any = false;
      for (const farm of CONSOLE_FARMS) {
        const h = input.hours[farm];
        if (h != null) {
          sum += h;
          any = true;
        }
      }
      hours = any ? sum : null;
    }
    const wetYesterday = sumBy(input.yesterdayWet, f, (r) => r.wet_grams, (r) => r.farm);
    const perDlh = hours != null && hours > 0 ? wetYesterday / hours : null;
    const metrics: ConsoleMetric[] = [
      { key: "remaining_total", label: "Plants Remaining/Total Plants", value: `${fmtCount(remaining)} / ${fmtCount(total)}` },
      { key: "harvested", label: "Plants Harvested", value: fmtCount(harvested) },
      { key: "pct", label: "% Complete", value: pct == null ? NA : fmtPct(pct) },
      { key: "wet_per_plant", label: "Wet Weight/plant AVG", ...(wetPerPlant == null ? { value: NA } : weightPair(wetPerPlant)) },
      { key: "dry_per_plant", label: "Dry Weight/plant AVG", ...(dryPerPlant == null ? { value: NA } : weightPair(dryPerPlant)) },
      { key: "weight_harvested", label: "Weight Harvested", ...weightPair(wetYesterday) },
      { key: "hours", label: "Cutting and Bucking Hours Yesterday", value: hours == null ? NA : String(hours) },
      {
        key: "weight_per_dlh",
        label: "Weight/DLH Yesterday",
        ...(perDlh == null ? { value: hours == null ? t(locale, "type hours") : NA } : weightPair(perDlh, "/h")),
      },
    ];
    return { farm: f ?? "Total", pct, metrics };
  });
}

/* ------------------------------------------------------------- the page */

export type HarvestConsolePageInput = {
  input: HarvestConsoleInput;
  live: SiloLive[];
  nowIso: string;
  locale?: Locale;
  ok?: string;
  /** THE CURE PANES (canon 0.30.164): CSA and CSB as tiles in the drying row after the FFZ cube
   * (owner, 2026-09-22: "in line with drying spaces, in the void after FFZ Inventory set the same size"). */
  cureTiles?: string;
  envFlags?: Record<string, string[]>;
  /** THE DRYING TOTALS (canon 0.30.183): in dry spaces (loaded only, with the dry estimate), in cure spaces, dry queued; omitted draws no line. */
  dryingTotals?: DryingTotals;
  /** THE TESTING GATE (canon 0.30.293). Omitted reads as an empty gate. */
  testing?: TestingFigures;
  /** THE PREPACK (canon 0.30.188). Omitted reads as an empty day. */
  prepack?: PrepackConsole;
};

function hoursBox(farm: ConsoleFarm, input: HarvestConsoleInput, locale: Locale): string {
  const value = input.hours[farm];
  return `<form method="post" action="${esc(HARVEST_HOURS_PATH)}" class="hc-hours" data-hc-hours="${esc(farm)}">
              <input type="hidden" name="farm" value="${esc(farm)}">
              <input type="hidden" name="work_date" value="${esc(input.yesterday)}">
              <input type="hidden" name="day_picked" value="${input.dayPicked ? "1" : ""}">
              <input type="number" name="hours" min="0" step="0.25" inputmode="decimal" value="${value == null ? "" : esc(String(value))}" placeholder="${esc(
                t(locale, "hours")
              )}" aria-label="${esc(`${t(locale, "Cutting and Bucking Hours Yesterday")} ${farm}`)}" data-hc-hours-input>
              <button type="submit" class="secondary">${esc(t(locale, "Save"))}</button>
            </form>`;
}

function farmBox(box: ConsoleBox, input: HarvestConsoleInput, locale: Locale): string {
  const pct = box.pct ?? 0;
  const metrics = box.metrics
    .map((m) => {
      const value =
        m.key === "hours" && box.farm !== "Total"
          ? hoursBox(box.farm, input, locale)
          : `<span class="hc-value" data-hc="${esc(m.key)}">${esc(m.value)}</span>${m.sub ? `<span class="hc-sub muted">${esc(m.sub)}</span>` : ""}`;
      const dateNote = m.key === "hours" || m.key === "weight_per_dlh" || m.key === "weight_harvested" ? ` <span class="hc-date muted">${esc(input.yesterday)}</span>` : "";
      return `<div class="hc-metric" data-hc-metric="${esc(m.key)}"><dt>${esc(t(locale, m.label))}${dateNote}</dt><dd>${value}</dd></div>`;
    })
    .join("");
  return `<div class="hc-farm${box.farm === "Total" ? " hc-total" : ""}" data-hc-farm="${esc(box.farm)}" data-hc-pct="${Math.round(pct * 100)}">
          <div class="hc-shade" style="opacity:${(pct * 0.55).toFixed(3)}"></div>
          <div class="hc-farm-body">
            <div class="hc-farm-name">${esc(box.farm === "Total" ? t(locale, "Total") : box.farm)}</div>
            <dl class="hc-metrics">${metrics}</dl>
          </div>
        </div>`;
}

function hoursScript(): string {
  return `<script>
(function () {
  document.querySelectorAll("[data-hc-hours-input]").forEach(function (box) {
    box.addEventListener("change", function () { if (box.form && box.form.requestSubmit) box.form.requestSubmit(); });
  });
})();
</script>`;
}

/** THE FOLD REMEMBERED (canon 0.30.288): each area stays as this browser last left it. */
function foldScript(): string {
  return `<script>
(function () {
  var key = "gf_hc_fold";
  var stored = null;
  try { stored = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { stored = null; }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) stored = null;
  var sections = document.querySelectorAll("details.hc-section[data-hc-section]");
  if (stored) {
    sections.forEach(function (el) {
      var name = el.getAttribute("data-hc-section");
      if (!name || !Object.prototype.hasOwnProperty.call(stored, name)) return;
      if (stored[name] === "1") el.setAttribute("open", "");
      else if (stored[name] === "0") el.removeAttribute("open");
    });
  }
  function write() {
    var next = {};
    sections.forEach(function (el) {
      var name = el.getAttribute("data-hc-section");
      if (name) next[name] = el.open ? "1" : "0";
    });
    try { localStorage.setItem(key, JSON.stringify(next)); } catch (e) {}
  }
  sections.forEach(function (el) { el.addEventListener("toggle", write); });
})();
</script>`;
}

function stubSection(key: string, title: string, locale: Locale): string {
  return `<details class="hc-section hc-stub" data-hc-section="${esc(key)}">
      <summary>${esc(t(locale, title))}</summary>
      <p class="muted" data-hc-stub>${esc(t(locale, "Stub: this section waits on the owner's definition."))}</p>
    </details>`;
}

function trimHoursBox(shift: TrimShiftFigures, input: HarvestConsoleInput, locale: Locale): string {
  return `<form method="post" action="${esc(HARVEST_TRIM_HOURS_PATH)}" class="hc-hours" data-hc-trim-hours="${esc(shift.key)}">
              <input type="hidden" name="shift" value="${esc(shift.key)}">
              <input type="hidden" name="work_date" value="${esc(input.yesterday)}">
              <input type="hidden" name="day_picked" value="${input.dayPicked ? "1" : ""}">
              <input type="number" name="hours" min="0" step="0.25" inputmode="decimal" value="${shift.hours == null ? "" : esc(String(shift.hours))}" placeholder="${esc(
                t(locale, "hours")
              )}" aria-label="${esc(`${t(locale, "DLH Yesterday")} ${t(locale, shift.label)}`)}" data-hc-hours-input>
              <button type="submit" class="secondary">${esc(t(locale, "Save"))}</button>
            </form>`;
}

/** THE TRIM LINE PICTURE (canon 0.30.154): "input lbs (total lbs ran through
 * T-0)", one number per shift per day, under the hours, beside the DLH box. */
function trimInputBox(shift: TrimShiftFigures, input: HarvestConsoleInput, locale: Locale): string {
  return `<form method="post" action="${esc(HARVEST_TRIM_INPUT_PATH)}" class="hc-hours" data-hc-trim-input="${esc(shift.key)}">
              <input type="hidden" name="shift" value="${esc(shift.key)}">
              <input type="hidden" name="work_date" value="${esc(input.yesterday)}">
              <input type="hidden" name="day_picked" value="${input.dayPicked ? "1" : ""}">
              <input type="number" name="lbs" min="0" step="0.01" inputmode="decimal" value="${shift.inputLbs == null ? "" : esc(shift.inputLbs.toFixed(2))}" placeholder="${esc(
                t(locale, "lbs")
              )}" aria-label="${esc(`${t(locale, "Input lbs")} ${t(locale, shift.label)}`)}" data-hc-input-lbs>
              <button type="submit" class="secondary">${esc(t(locale, "Save"))}</button>
            </form>`;
}

/** "Under that we can list the hours from the sheet for that same date": the
 * day's Cutting and Bucking hours per farm (harvest_labor_hours, the sheet's
 * CUT/BCK # HRS by farm and date), PNN, ARL, PNS. */
function trimSheetHoursLine(input: HarvestConsoleInput, locale: Locale): string {
  const parts = CONSOLE_FARMS.map((farm) => {
    const hours = input.hours[farm];
    return `<span data-hc-sheet-hours="${esc(farm)}">${esc(farm)} ${hours == null ? `<span class="muted">${esc(t(locale, "none"))}</span>` : esc(String(hours))}</span>`;
  });
  // THE SHEET SYNC (canon 0.30.162): the second line says when the sheet was last read
  // (read from the sheet at, unchanged since, failed at, never read).
  const view = input.sheetSync ?? null;
  const status = view?.status ?? "never";
  return `<div class="hc-metric hc-sheet-hours" data-hc-metric="trim_sheet_hours" data-hc-sheet-sync="${esc(status)}"><dt>${esc(
    t(locale, "Cutting and bucking hours from the sheet")
  )} <span class="hc-date muted">${esc(input.yesterday)}</span></dt><dd>${parts.join(" · ")}</dd><dd class="hc-sheet-sync muted" data-hc-sheet-sync-line>${esc(
    sheetSyncLineText(view, locale)
  )}</dd></div>`;
}

/** One shift's card: the trim line picture beside the bud waffle, then his
 * lines (Other, Bulk Bud, Prepack Bud, Total Bud, BTR, the weight ran, the
 * DLH box, Lbs/DLH), the day's hours from the sheet, and the input lbs box
 * under them. */
function trimShiftCard(shift: TrimShiftFigures, input: HarvestConsoleInput, locale: Locale): string {
  const lbs = (grams: number) => `${formatLbs(grams)} lb`;
  const g = (grams: number) => `${formatGrams(roundGrams(grams))} g`;
  const perDlh =
    shift.gramsPerDlh == null
      ? { value: shift.hours == null ? t(locale, "type hours") : NA, sub: "" }
      : { value: `${formatLbs(shift.gramsPerDlh)} lb/h`, sub: `${formatGrams(roundGrams(shift.gramsPerDlh))} g/h` };
  const otherParts = [
    `TRIM ${formatGrams(shift.trimGrams)}`,
    `BIO ${formatGrams(shift.bioGrams)}`,
    `${t(locale, "WIP left")} ${formatGrams(shift.wipLeftGrams)}`,
    ...(shift.restGrams > 0 ? [`${t(locale, "other types")} ${formatGrams(shift.restGrams)}`] : []),
  ];
  const metrics: Array<ConsoleMetric & { html?: string }> = [
    { key: "trim_other", label: "Other", value: lbs(shift.otherGrams), sub: `${g(shift.otherGrams)} · ${otherParts.join(" + ")}` },
    { key: "trim_bulk", label: "Bulk Bud", value: lbs(shift.bulkGrams), sub: `${g(shift.bulkGrams)} · SHAKE + BUD` },
    { key: "trim_prepack", label: "Prepack Bud", value: lbs(shift.prepackGrams), sub: `${g(shift.prepackGrams)} · WPR` },
    { key: "trim_bud", label: "Total Bud", value: lbs(shift.budGrams), sub: `${g(shift.budGrams)} · ${t(locale, "Bulk + Prepack")}` },
    { key: "trim_btr", label: "BTR", value: shift.btr == null ? NA : fmtPct(shift.btr), sub: t(locale, "Total Bud / shift total (weighed + WIP left)") },
    {
      key: "trim_lbs",
      label: "Lbs Produced Yesterday",
      value: lbs(shift.grams),
      sub: `${g(shift.grams)} · ${shift.packages} ${t(locale, "packages")}${
        shift.wipLeftGrams > 0 ? ` · ${t(locale, "shift total")} ${g(shift.totalGrams)}` : ""
      }`,
    },
    { key: "trim_dlh", label: "DLH Yesterday", value: shift.hours == null ? NA : String(shift.hours), html: trimHoursBox(shift, input, locale) },
    { key: "trim_lbs_per_dlh", label: "Lbs/DLH", ...perDlh },
  ];
  const lines = metrics
    .map((m) => {
      const value = m.html ?? `<span class="hc-value" data-hc="${esc(m.key)}">${esc(m.value)}</span>${m.sub ? `<span class="hc-sub muted">${esc(m.sub)}</span>` : ""}`;
      return `<div class="hc-metric" data-hc-metric="${esc(m.key)}"><dt>${esc(t(locale, m.label))}</dt><dd>${value}</dd></div>`;
    })
    .join("");
  const inputLine = `<div class="hc-metric" data-hc-metric="trim_input"><dt>${esc(t(locale, "Input lbs"))} <span class="hc-date muted">${esc(
    t(locale, "total lbs run through T-0")
  )}</span></dt><dd>${trimInputBox(shift, input, locale)}</dd></div>`;
  const operators = shift.operators.length ? shift.operators.join(", ") : t(locale, "no operators named");
  const running = shift.running ? `<span class="hc-running" data-hc-running>${esc(t(locale, "RUNNING"))}</span>` : "";
  const btrRead =
    shift.btr == null
      ? esc(t(locale, "no packages yesterday"))
      : `<strong>${esc(fmtPct(shift.btr))}</strong> ${esc(t(locale, "BTR"))}`;
  return `<div class="hc-shift" data-hc-shift="${esc(shift.key)}" data-hc-shift-grams="${esc(String(shift.grams))}" data-hc-shift-running="${shift.running ? "1" : "0"}">
          <div class="hc-shift-head">
            <span class="hc-shift-name">${esc(t(locale, shift.label))}</span>
            <span class="hc-shift-ops muted" data-hc-shift-operators>${esc(operators)}</span>
            <span class="hc-date muted">${esc(input.yesterday)}</span>
            ${running}
          </div>
          <div class="hc-shift-body hc-shift-stack">
            <div class="hc-visuals">
            ${trimLinePicture(shift, locale)}
            <div class="hc-bud-col">
            ${budWaffle(shift.btr, locale, input.trim?.bogeyPct)}
            <div class="hc-btr-read" data-hc-btr-read>${btrRead}</div>
            <div class="hc-legend"><span class="hc-swatch hc-swatch-bud"></span>${esc(t(locale, "bud"))} <span class="hc-swatch hc-swatch-consumed"></span>${esc(t(locale, "byproduct"))} <span class="hc-swatch hc-swatch-waste"></span>${esc(t(locale, "waste"))}</div>
            </div>
            </div>
            <dl class="hc-metrics">${lines}${trimSheetHoursLine(input, locale)}${inputLine}</dl>
          </div>
        </div>`;
}

/** THE BLUE THROB law for the bars (canon 0.30.79): a reduced-motion setting
 * slows the stripes instead of stilling them, so the floor signal stands. */
function trimLineScript(): string {
  return `<script>(function(){try{if(!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))return;document.querySelectorAll(".hc-trimline animate").forEach(function(a){a.setAttribute("dur","${TRIM_LINE_FLOW_MS * 2}ms");});}catch(e){}})();</script>`;
}

/** THE TRIMMING SECTION (canon 0.30.88): the two shift cards, then the line
 * that names any grams by operators on neither shift. */
export function trimmingSection(input: HarvestConsoleInput, locale: Locale = "en", open = true): string {
  const figures = trimFigures(input.trim ?? emptyTrimInput());
  const cards = figures.shifts.map((shift) => trimShiftCard(shift, input, locale)).join("");
  const unassigned =
    figures.unassignedGrams > 0
      ? `<p class="muted hc-note" data-hc-trim-unassigned>${esc(
          `${formatGrams(figures.unassignedGrams)} g ${t(locale, "yesterday by operators on neither shift")}${
            figures.unassignedOperators.length ? `: ${figures.unassignedOperators.join(", ")}` : ""
          }. ${t(locale, "Name the shifts' operators in Admin, Lookups, app_config.")}`
        )}</p>`
      : "";
  const unassignedRunning = figures.unassignedRunning
    ? `<p class="muted hc-note" data-hc-trim-running-unassigned><span class="hc-running">${esc(t(locale, "RUNNING"))}</span> ${esc(
        t(locale, "a package was weighed in the last 30 minutes by an operator on neither shift.")
      )}</p>`
    : "";
  return `<details class="hc-section" data-hc-section="trimming"${open ? " open" : ""}>
      <summary>${esc(t(locale, "Trimming"))}</summary>
      <div class="hc-shifts">${cards}</div>
      ${unassigned}${unassignedRunning}
      ${trimLineScript()}
    </details>`;
}

/* ---------------------------------------------------- the testing section */

/** Live cryo outputs. THE RAD run (V9) is the second way to be pasteurized
 * and lands beside this query, in isPasteurizedTag. */
export const PASTEURIZED_CRYO_SQL = `SELECT UPPER(package_code) AS tag, UPPER(COALESCE(package_type_code, '')) AS type,
            cryo_weight_grams, weight_grams
     FROM wip_packages
     WHERE deleted_at IS NULL AND source = 'cryo' AND TRIM(COALESCE(package_code, '')) <> ''`;

/** A tag is pasteurized when a live cryo output carries it.
 * THE RAD run (V9) is the second way and lands in this function. */
export function isPasteurizedTag(tag: string | null | undefined, cryoTags: ReadonlySet<string>): boolean {
  const key = String(tag ?? "").trim().toUpperCase();
  return key.length > 0 && cryoTags.has(key);
}

/** The item's first token before " - ", upper-cased. */
export function gateItemType(item: string | null | undefined): string {
  const text = String(item ?? "").trim();
  const at = text.indexOf(" - ");
  return (at < 0 ? text : text.slice(0, at)).trim().toUpperCase();
}

/** Grams of one gate package. `g` is the quantity. `ea` is the quantity times
 * the type's unit grams. Anything else, or an each with no unit grams, counts
 * the package and adds no pounds. */
export function gatePackageGrams(
  uom: string | null | undefined,
  quantity: number | string | null | undefined,
  type: string,
  units: Readonly<Record<string, number>>
): number | null {
  const qty = Number(quantity);
  if (!Number.isFinite(qty)) return null;
  const unit = String(uom ?? "").trim().toLowerCase();
  if (unit === "g") return roundGrams(qty);
  if (unit === "ea") {
    const each = units[type];
    if (each == null || !Number.isFinite(each)) return null;
    return roundGrams(qty * each);
  }
  return null;
}

/** The sheet's hbn prefix names the harvest year. The entered date is the
 * fallback when the hbn does not start with two digits. */
export function sheetInSeason(row: { hbn: string | null; entered_testing: string | null }, year: number): boolean {
  const hbn = String(row.hbn ?? "").trim();
  const prefix = /^(\d{2})/.exec(hbn);
  if (prefix) return Number(prefix[1]) === year % 100;
  return String(row.entered_testing ?? "").trim().slice(0, 4) === String(year);
}

export type TestingGatePane = {
  gate: "ready" | "scheduled" | "in-testing" | "passed";
  grams: number;
  packages: number;
  unweighed: number;
};

export type TestingPieStrain = { label: string; count: number; grams: number; pct: string };
export type TestingPieSlice = {
  mode: string;
  count: number;
  grams: number;
  pct: string;
  color: number;
  dx: string;
  dy: string;
  d: string;
  strains: TestingPieStrain[];
};

export type TestingFigures = {
  panes: TestingGatePane[];
  fails: number;
  tests: number;
  /** Null when the season has no first-time tests. Passed over all, one decimal. */
  ftq: string | null;
  slices: TestingPieSlice[];
};

export type TestingMirrorRow = {
  tag: string;
  item: string | null;
  quantity: number | string | null;
  uom: string | null;
  lab_test_status: string | null;
  farm: string | null;
};

export type TestingCryoRow = {
  tag: string;
  type: string;
  cryo_weight_grams: number | string | null;
  weight_grams: number | string | null;
};

export type TestingOrderRow = {
  id: string;
  tag: string;
  status: string;
  batch_grams: number | string | null;
};

export type TestingSheetRow = {
  strain: string | null;
  hbn: string | null;
  entered_testing: string | null;
  status: string | null;
  failure_mode: string | null;
  batch_weight_grams: number | string | null;
  attempt: number | string | null;
};

const GATE_PANE_ORDER = ["ready", "scheduled", "in-testing", "passed"] as const;

function blankPanes(): TestingGatePane[] {
  return GATE_PANE_ORDER.map((gate) => ({ gate, grams: 0, packages: 0, unweighed: 0 }));
}

function paneOf(panes: TestingGatePane[], gate: TestingGatePane["gate"]): TestingGatePane {
  const found = panes.find((pane) => pane.gate === gate);
  if (!found) throw new Error(`missing gate pane ${gate}`);
  return found;
}

function addWeight(pane: TestingGatePane, grams: number | null): void {
  pane.packages += 1;
  if (grams == null) pane.unweighed += 1;
  else pane.grams += grams;
}

function oneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function fixed3(n: number): string {
  const snapped = Math.abs(n) < 5e-4 ? 0 : n;
  return snapped.toFixed(3);
}

function ringPoint(radius: number, angle: number): [number, number] {
  const x = Math.round((50 + radius * Math.sin(angle)) * 100) / 100;
  const y = Math.round((50 - radius * Math.cos(angle)) * 100) / 100;
  return [x, y];
}

/** A donut segment in a 100 by 100 frame. One mode is a full ring. */
export function testingPiePath(a0: number, a1: number): string {
  const sweep = a1 - a0;
  if (sweep >= Math.PI * 2 - 1e-4) return "M 50 8 A 42 42 0 1 1 49.99 8 Z M 50 24 A 26 26 0 1 0 50.01 24 Z";
  const large = sweep > Math.PI ? 1 : 0;
  const [ox0, oy0] = ringPoint(42, a0);
  const [ox1, oy1] = ringPoint(42, a1);
  const [ix1, iy1] = ringPoint(26, a1);
  const [ix0, iy0] = ringPoint(26, a0);
  return `M ${ox0} ${oy0} A 42 42 0 ${large} 1 ${ox1} ${oy1} L ${ix1} ${iy1} A 26 26 0 ${large} 0 ${ix0} ${iy0} Z`;
}

function strainLabel(sheet: string | null, market: string | null): string {
  const a = String(sheet ?? "").trim();
  const b = String(market ?? "").trim();
  if (a && b && a !== b) return `${a} / ${b}`;
  return a || b || "unnamed";
}

function sheetGrams(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? roundGrams(n) : 0;
}

const MOVED_LAB = new Set(["SubmittedForTesting", "TestPassed", "RetestPassed"]);
const SCHEDULED_STATUS = new Set<string>(TEST_CONSOLE_SCHEDULED);
const OPEN_STATUS = new Set<string>(TEST_OPEN_STATUSES);

/** The four panes, the season's first-time stats, and the failure pie.
 * The panes are live. The stats and the pie are the harvest year. */
export function buildTestingFigures(input: {
  year: number;
  gateTypes: readonly string[];
  unitGrams: Readonly<Record<string, number>>;
  mirror: TestingMirrorRow[];
  cryo: TestingCryoRow[];
  orders: TestingOrderRow[];
  sheet: TestingSheetRow[];
  marketByHbn: ReadonlyMap<string, string>;
}): TestingFigures {
  const types = new Set(input.gateTypes);
  const farms = new Set<string>(CONSOLE_FARMS);
  const panes = blankPanes();
  const ready = paneOf(panes, "ready");
  const scheduled = paneOf(panes, "scheduled");
  const inTesting = paneOf(panes, "in-testing");
  const passed = paneOf(panes, "passed");

  const cryoTags = new Set<string>();
  for (const row of input.cryo) {
    const tag = String(row.tag ?? "").trim().toUpperCase();
    if (tag) cryoTags.add(tag);
  }

  const liveTags = new Set<string>();
  const gateByTag = new Map<string, { status: string; grams: number | null }>();
  for (const row of input.mirror) {
    const tag = String(row.tag ?? "").trim().toUpperCase();
    if (!tag) continue;
    liveTags.add(tag);
    const type = gateItemType(row.item);
    const farm = String(row.farm ?? "").trim();
    if (!types.has(type) || !farms.has(farm)) continue;
    const status = String(row.lab_test_status ?? "").trim();
    const grams = gatePackageGrams(row.uom, row.quantity, type, input.unitGrams);
    gateByTag.set(tag, { status, grams });
    if (status === "SubmittedForTesting") addWeight(inTesting, grams);
    else if (status === "TestPassed" || status === "RetestPassed") addWeight(passed, grams);
  }

  const openTags = new Set<string>();
  for (const order of input.orders) {
    if (!OPEN_STATUS.has(order.status)) continue;
    const tag = String(order.tag ?? "").trim().toUpperCase();
    if (tag) openTags.add(tag);
  }

  for (const [tag, pkg] of gateByTag) {
    if (pkg.status !== "NotSubmitted") continue;
    if (!isPasteurizedTag(tag, cryoTags)) continue;
    if (openTags.has(tag)) continue;
    addWeight(ready, pkg.grams);
  }

  for (const row of input.cryo) {
    const tag = String(row.tag ?? "").trim().toUpperCase();
    const type = String(row.type ?? "").trim().toUpperCase();
    if (!tag || !types.has(type) || liveTags.has(tag) || openTags.has(tag)) continue;
    const raw = row.cryo_weight_grams != null && row.cryo_weight_grams !== "" ? Number(row.cryo_weight_grams) : Number(row.weight_grams);
    addWeight(ready, Number.isFinite(raw) ? roundGrams(raw) : null);
  }

  const seenScheduled = new Set<string>();
  for (const order of input.orders) {
    if (!SCHEDULED_STATUS.has(order.status)) continue;
    const tag = String(order.tag ?? "").trim().toUpperCase();
    const key = tag || order.id;
    if (seenScheduled.has(key)) continue;
    seenScheduled.add(key);
    if (tag && liveTags.has(tag) && !gateByTag.has(tag)) continue;
    if (tag && gateByTag.has(tag)) {
      const pkg = gateByTag.get(tag)!;
      if (MOVED_LAB.has(pkg.status)) continue;
      addWeight(scheduled, pkg.grams);
      continue;
    }
    const grams = Number(order.batch_grams);
    addWeight(scheduled, Number.isFinite(grams) ? roundGrams(grams) : null);
  }

  const first = input.sheet.filter((row) => {
    if (Number(row.attempt) !== 1) return false;
    const outcome = outcomeOf(row.status);
    if (outcome !== "passed" && outcome !== "failed") return false;
    return sheetInSeason(row, input.year);
  });
  const failed = first.filter((row) => outcomeOf(row.status) === "failed");
  const passedCount = first.length - failed.length;
  const modes = new Map<string, { count: number; grams: number; strains: Map<string, { count: number; grams: number }> }>();
  for (const row of failed) {
    const mode = String(row.failure_mode ?? "").trim() || "unnamed";
    const label = strainLabel(row.strain, input.marketByHbn.get(String(row.hbn ?? "").trim()) ?? null);
    const grams = sheetGrams(row.batch_weight_grams);
    const bucket = modes.get(mode) ?? { count: 0, grams: 0, strains: new Map() };
    bucket.count += 1;
    bucket.grams += grams;
    const strain = bucket.strains.get(label) ?? { count: 0, grams: 0 };
    strain.count += 1;
    strain.grams += grams;
    bucket.strains.set(label, strain);
    modes.set(mode, bucket);
  }
  const ordered = [...modes.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
  let angle = 0;
  const failCount = failed.length;
  const slices: TestingPieSlice[] = ordered.map(([mode, bucket], index) => {
    const sweep = failCount === 0 ? 0 : (bucket.count / failCount) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + sweep;
    angle = a1;
    const mid = (a0 + a1) / 2;
    const strains = [...bucket.strains.entries()]
      .map(([label, value]) => ({
        label,
        count: value.count,
        grams: value.grams,
        pct: oneDecimal(bucket.count === 0 ? 0 : (value.count / bucket.count) * 100),
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return {
      mode,
      count: bucket.count,
      grams: bucket.grams,
      pct: oneDecimal(failCount === 0 ? 0 : (bucket.count / failCount) * 100),
      color: (index % 8) + 1,
      dx: fixed3(6 * Math.sin(mid)),
      dy: fixed3(-6 * Math.cos(mid)),
      d: testingPiePath(a0, a1),
      strains,
    };
  });

  return {
    panes,
    fails: failed.length,
    tests: first.length,
    ftq: first.length === 0 ? null : oneDecimal((passedCount / first.length) * 100),
    slices,
  };
}

export function emptyTestingFigures(): TestingFigures {
  return buildTestingFigures({
    year: 0,
    gateTypes: [],
    unitGrams: {},
    mirror: [],
    cryo: [],
    orders: [],
    sheet: [],
    marketByHbn: new Map(),
  });
}

const GATE_DISPLAY: ReadonlyArray<{ gate: TestingGatePane["gate"]; key: string; icon: ConsoleIconName; label: string }> = [
  { gate: "ready", key: "ready", icon: "ready", label: "Ready for Testing" },
  { gate: "scheduled", key: "scheduled", icon: "scheduled", label: "Scheduled for Testing" },
  { gate: "in-testing", key: "in_testing", icon: "in-testing", label: "In Testing" },
  { gate: "passed", key: "passed", icon: "passed", label: "Passed Testing" },
];

function pieScript(): string {
  return `<script>
(function () {
  var root = document.querySelector("[data-hc-pie]");
  if (!root) return;
  var open = null;
  function apply(mode) {
    open = mode;
    root.querySelectorAll("[data-hc-pie-seg]").forEach(function (seg) {
      var on = mode && seg.getAttribute("data-hc-pie-mode") === mode;
      if (on) seg.setAttribute("transform", "translate(" + seg.getAttribute("data-hc-pie-dx") + " " + seg.getAttribute("data-hc-pie-dy") + ")");
      else seg.removeAttribute("transform");
    });
    root.querySelectorAll("[data-hc-pie-strains]").forEach(function (list) {
      if (mode && list.getAttribute("data-hc-pie-strains") === mode) list.removeAttribute("hidden");
      else list.setAttribute("hidden", "");
    });
    root.querySelectorAll("[data-hc-pie-pick]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", mode && btn.getAttribute("data-hc-pie-pick") === mode ? "true" : "false");
    });
  }
  root.addEventListener("click", function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest("[data-hc-pie-mode], [data-hc-pie-pick]") : null;
    if (!el || !root.contains(el)) return;
    var mode = el.getAttribute("data-hc-pie-mode") || el.getAttribute("data-hc-pie-pick");
    if (!mode) return;
    apply(open === mode ? null : mode);
  });
})();
</script>`;
}

function modeText(mode: string, locale: Locale): string {
  return mode === "unnamed" ? t(locale, "unnamed") : mode;
}

/** THE TESTING GATE (canon 0.30.293). Four panes, live. The stats and the pie
 * are the harvest year. The console day does not change them. */
export function testingSection(figures: TestingFigures, opts: { locale?: Locale; year: number }): string {
  const locale = opts.locale ?? "en";
  const byGate = new Map(figures.panes.map((pane) => [pane.gate, pane]));
  const gates = GATE_DISPLAY.map((spec) => {
    const pane = byGate.get(spec.gate) ?? { gate: spec.gate, grams: 0, packages: 0, unweighed: 0 };
    const weight = weightPair(pane.grams);
    const word = pane.packages === 1 ? t(locale, "package") : t(locale, "packages");
    const unweighed =
      pane.unweighed > 0
        ? `<span class="hc-sub muted" data-hc="${esc(spec.key)}_unweighed">${esc(tFill(locale, "{n} packages without a unit weight", { n: String(pane.unweighed) }))}</span>`
        : "";
    return `<div class="hc-gate-pane" data-hc-gate="${esc(spec.gate)}">
        <div class="hc-gate-name">${esc(t(locale, spec.label))}</div>
        ${consoleIconSvg(spec.icon, { label: t(locale, spec.label) })}
        <span class="hc-value" data-hc="${esc(spec.key)}_lb">${esc(weight.value)}</span>
        <span class="hc-sub muted" data-hc="${esc(spec.key)}_g">${esc(weight.sub)}</span>
        <span class="hc-gate-count"><span data-hc="${esc(spec.key)}_packages">${esc(String(pane.packages))}</span> ${esc(word)}</span>
        ${unweighed}
      </div>`;
  }).join("");
  const season = `<span class="hc-sub muted" data-hc-season>${esc(t(locale, "this season"))}</span>`;
  const stat = (key: string, label: string, value: string, extra = "") =>
    `<div class="hc-stat" data-hc-stat="${esc(key)}"><div class="hc-gate-name">${esc(t(locale, label))}</div><span class="hc-value" data-hc="${esc(key)}">${esc(value)}</span>${season}${extra}</div>`;
  const rateExtra = `<span class="hc-sub muted" data-hc="ftq_n">${esc(tFill(locale, "{n} first-time tests", { n: String(figures.tests) }))}</span>`;
  const sheetEmpty =
    figures.tests === 0 ? `<p class="muted hc-note" data-hc-sheet-empty>${esc(t(locale, "No first-time tests on the sheet this season."))}</p>` : "";
  const paths = figures.slices
    .map(
      (slice) =>
        `<path class="hc-pie-seg hc-pie-${slice.color}" fill="currentColor" fill-rule="evenodd" data-hc-pie-seg data-hc-pie-mode="${esc(slice.mode)}" data-hc-pie-dx="${esc(slice.dx)}" data-hc-pie-dy="${esc(slice.dy)}" d="${esc(slice.d)}"/>`
    )
    .join("");
  const legend = figures.slices
    .map(
      (slice) => `<li><button type="button" class="hc-pie-pick" data-hc-pie-pick="${esc(slice.mode)}" aria-pressed="false"><span class="hc-pie-swatch hc-pie-${slice.color}"></span><span>${esc(modeText(slice.mode, locale))}</span><span data-hc-pie-count>${esc(String(slice.count))}</span><span data-hc-pie-pct>${esc(slice.pct)}%</span></button></li>`
    )
    .join("");
  const lists = figures.slices
    .map((slice) => {
      const items = slice.strains
        .map((strain) => {
          const name = strain.label === "unnamed" ? t(locale, "unnamed") : strain.label;
          return `<li data-hc-pie-strain="${esc(strain.label)}">${esc(name)} <span data-hc-pie-strain-pct>${esc(strain.pct)}%</span> <span class="hc-sub muted" data-hc-pie-strain-g>${esc(formatGrams(strain.grams))} g</span></li>`;
        })
        .join("");
      return `<div class="hc-pie-strains" data-hc-pie-strains="${esc(slice.mode)}" hidden><ul>${items}</ul></div>`;
    })
    .join("");
  const pie =
    figures.slices.length === 0
      ? `<p class="muted hc-note" data-hc-pie-empty>${esc(t(locale, "No failed first-time tests on the sheet this season."))}</p>`
      : `<div class="hc-pie-block" data-hc-pie>
          <svg class="hc-pie" viewBox="0 0 100 100" role="img" aria-label="${esc(t(locale, "Failure Mode Analysis"))}">${paths}</svg>
          <div class="hc-pie-side">
            <ul class="hc-pie-legend">${legend}</ul>
            ${lists}
          </div>
        </div>`;
  const year = tFill(locale, "Harvest year {year}", { year: String(opts.year) });
  return `<details class="hc-section" data-hc-section="testing" data-hc-testing-year="${esc(String(opts.year))}" open>
      <summary>${esc(t(locale, "Testing"))} <span class="muted hc-year">${esc(year)}</span></summary>
      <div class="hc-gate" data-hc-inventory-gate>${gates}</div>
      <h3>${esc(t(locale, "Quality Stats"))}</h3>
      <div class="hc-stats">
        ${stat("first_fails", "First Time Fails", String(figures.fails))}
        ${stat("first_tests", "First Time Tests", String(figures.tests))}
        ${stat("ftq", "FTQ Rate", figures.ftq == null ? "NA" : `${figures.ftq}%`, rateExtra)}
      </div>
      ${sheetEmpty}
      <h3>${esc(t(locale, "Failure Mode Analysis"))}</h3>
      ${pie}
      ${pieScript()}
    </details>`;
}

/** The console sections. Plants, Trimming, Testing and Prepack start open. Drying and the pasteurization stub start closed. */
/** THE CONSOLE DAY (canon 0.30.152): the date control, yesterday by default, any day up to today. */
export function consoleDayControl(input: HarvestConsoleInput, locale: Locale): string {
  const yesterday = dayBefore(input.today);
  const viewingToday = input.yesterday === input.today;
  const state = viewingToday
    ? t(locale, "today so far; the panes below read today up to now")
    : input.dayPicked
      ? t(locale, "picked; the panes below read this day")
      : t(locale, "yesterday, the default");
  return `<form class="hc-day" method="get" action="${HARVEST_PATH}" data-hc-day>
      <label class="field">${esc(t(locale, "Day"))}
        <input type="date" name="day" value="${esc(input.yesterday)}" max="${esc(input.today)}" data-hc-day-input onchange="this.form.submit()">
      </label>
      <span class="muted" data-hc-day-state>${esc(state)}</span>
      ${viewingToday ? "" : `<a class="secondary" href="${HARVEST_PATH}?day=${esc(input.today)}" data-hc-day-today>${esc(t(locale, "Today so far"))}</a>`}
      ${input.dayPicked ? `<a class="secondary" href="${HARVEST_PATH}" data-hc-day-reset>${esc(t(locale, "Back to yesterday"))}</a>` : ""}
      <noscript><button type="submit" class="secondary">${esc(t(locale, "Show"))}</button></noscript>
      <span class="muted">${esc(t(locale, "Yesterday is"))} ${esc(yesterday)}; ${esc(t(locale, "the hours you type land on the day shown."))}</span>
    </form>`;
}

/** The query that keeps the picked day through a redirect; empty on the default. */
export function consoleDayQuery(input: { yesterday: string; dayPicked: boolean }): string {
  return input.dayPicked ? `&day=${encodeURIComponent(input.yesterday)}` : "";
}

export type PrepackConsole = {
  units: Array<{ unit: string; bags: number; grams: number }>;
  grams: number;
  jobs: number;
  hours: number | null;
};

export function emptyPrepack(day: string): PrepackConsole {
  void day;
  return { units: parsePrepackUnits(null).map((unit) => ({ unit, bags: 0, grams: 0 })), grams: 0, jobs: 0, hours: null };
}

function prepackSection(figures: PrepackConsole, input: HarvestConsoleInput, locale: Locale): string {
  const rows = figures.units
    .map(
      (row) => `<li data-prepack-unit="${esc(row.unit)}">${esc(row.unit)} <span data-prepack-bags>${esc(String(row.bags))}</span> <span data-prepack-lb>${esc(formatLbs(row.grams))} lb</span></li>`
    )
    .join("");
  const per = figures.hours != null && figures.hours > 0 ? `${formatLbs(figures.grams / figures.hours)}` : t(locale, "type the hours");
  const hoursValue = figures.hours == null ? "" : esc(String(figures.hours));
  return `<details class="hc-section" data-hc-section="prepack" open>
      <summary>${esc(t(locale, "Prepack"))}</summary>
      <ul data-prepack-sizes>${rows}</ul>
      <p data-prepack-lbs>${esc(t(locale, "Lbs produced"))}: <span data-hc="prepack_lbs">${esc(formatLbs(figures.grams))}</span></p>
      <p data-prepack-jobs>${esc(t(locale, "Jobs finished"))}: <span data-hc="prepack_jobs">${esc(String(figures.jobs))}</span></p>
      <form method="post" action="${esc(HARVEST_PREPACK_HOURS_PATH)}" class="hc-hours" data-hc-prepack-hours>
        <input type="hidden" name="work_date" value="${esc(input.yesterday)}">
        <input type="hidden" name="day_picked" value="${input.dayPicked ? "1" : ""}">
        <label class="field">${esc(t(locale, "DLH Yesterday"))}
          <input type="number" name="hours" min="0" step="0.25" inputmode="decimal" value="${hoursValue}" placeholder="${esc(t(locale, "hours"))}" data-hc-prepack-hours-input>
        </label>
        <button type="submit" class="secondary">${esc(t(locale, "Save"))}</button>
      </form>
      <p data-prepack-dlh>${esc(t(locale, "Lbs/DLH"))}: <span data-hc="prepack_lbs_per_dlh">${esc(per)}</span></p>
      <p class="muted hc-note">${esc(t(locale, "Bags and pounds are the prepack lines saved on this day. Jobs finished are the packs finished this day. DLH is typed here, one number for the day. The sheet does not replace this box."))}</p>
    </details>`;
}

export async function loadPrepackSection(db: D1Database, day: string): Promise<PrepackConsole> {
  const startHour = parseFarmDayStartHour(await getConfigValue(db, CONFIG_KEYS.farm_day_start_hour));
  const units = parsePrepackUnits(await getConfigValue(db, CONFIG_KEYS.prepack_units));
  const bounds = farmDayBounds(day, startHour);
  const [lines, jobs, hours] = await Promise.all([
    db
      .prepare(`SELECT unit_grams, bags, grams FROM prepack_lines WHERE deleted_at IS NULL AND work_date = ?`)
      .bind(day)
      .all<{ unit_grams: number; bags: number; grams: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM production_schedules
         WHERE deleted_at IS NULL AND stage = 'prepack' AND status = 'complete'
           AND completed_at >= ? AND completed_at < ?`
      )
      .bind(bounds.startIso, bounds.endIso)
      .first<{ n: number }>(),
    db.prepare(`SELECT hours FROM prepack_labor_hours WHERE work_date = ?`).bind(day).first<{ hours: number }>(),
  ]);
  const grouped = units.map((unit) => {
    const rows = (lines.results ?? []).filter((line) => Number(line.unit_grams) === Number(unit));
    return {
      unit,
      bags: rows.reduce((n, line) => n + Number(line.bags), 0),
      grams: rows.reduce((n, line) => n + Number(line.grams), 0),
    };
  });
  return {
    units: grouped,
    grams: grouped.reduce((n, row) => n + row.grams, 0),
    jobs: Number(jobs?.n ?? 0),
    hours: hours ? Number(hours.hours) : null,
  };
}

export async function savePrepackHours(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actorId = textOrNull(form.get("person_id"));
  const workDate = textOrNull(form.get("work_date")) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !Number.isFinite(Date.parse(`${workDate}T00:00:00.000Z`))) {
    throw new HttpError(400, "Work date must be YYYY-MM-DD.");
  }
  const hours = parseHours(textOrNull(form.get("hours")));
  const ts = nowIso();
  const existing = await db.prepare(`SELECT id, hours FROM prepack_labor_hours WHERE work_date = ?`).bind(workDate).first<{ id: string; hours: number }>();
  const log = (id: string, oldValue: string | null, newValue: string | null) =>
    insertLog(db, {
      record_table: "prepack_labor_hours",
      record_id: id,
      field: "hours",
      old_value: oldValue,
      new_value: newValue,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.labor_hours,
      changed_at: ts,
    });
  const stmts: D1PreparedStatement[] = [];
  if (hours == null) {
    if (existing) stmts.push(db.prepare(`DELETE FROM prepack_labor_hours WHERE id = ?`).bind(existing.id), log(existing.id, String(existing.hours), null));
  } else if (existing) {
    if (Number(existing.hours) !== hours) {
      stmts.push(
        db.prepare(`UPDATE prepack_labor_hours SET hours = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(hours, ts, actorId, existing.id),
        log(existing.id, String(existing.hours), String(hours))
      );
    }
  } else {
    const id = crypto.randomUUID();
    stmts.push(
      db.prepare(`INSERT INTO prepack_labor_hours (id, work_date, hours, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, workDate, hours, ts, actorId, ts, actorId),
      log(id, null, String(hours))
    );
  }
  if (stmts.length) await db.batch(stmts);
  return { redirect: `${HARVEST_PATH}?ok=prepack_hours${textOrNull(form.get("day_picked")) ? `&day=${encodeURIComponent(workDate)}` : ""}` };
}

export function harvestConsolePage(page: HarvestConsolePageInput): string {
  const locale = page.locale ?? "en";
  const boxes = consoleBoxes(page.input, locale);
  const flash =
    page.ok === "hours" || page.ok === "trim_hours" || page.ok === "prepack_hours"
      ? `<p class="banner ok" data-hc-flash>${esc(t(locale, "Hours saved."))}</p>`
      : page.ok === "trim_input"
        ? `<p class="banner ok" data-hc-flash>${esc(t(locale, "Input lbs saved."))}</p>`
        : "";
  return `<h1>${esc(t(locale, "Harvest Console"))}</h1>
    ${flash}
    ${consoleDayControl(page.input, locale)}
    <details class="hc-section" data-hc-section="plants" open>
      <summary>${esc(t(locale, "Plants"))} <span class="muted hc-year">${esc(t(locale, "Harvest year"))} ${esc(String(page.input.year))}</span></summary>
      <div class="hc-farms">${boxes.map((b) => farmBox(b, page.input, locale)).join("")}</div>
    </details>
    <details class="hc-section" data-hc-section="drying">
      <summary>${esc(t(locale, "Drying"))}</summary>
      ${siloStrip(page.live, page.nowIso, locale, page.cureTiles ?? "", page.envFlags ?? {})}
      ${page.dryingTotals ? dryingTotalsMarkup(page.dryingTotals, locale) : ""}
    </details>
    ${trimmingSection(page.input, locale)}
    ${stubSection("pasteurization", "Pasteurization", locale)}
    ${testingSection(page.testing ?? emptyTestingFigures(), {
      locale,
      year: page.input.year,
    })}
    ${prepackSection(page.prepack ?? emptyPrepack(page.input.yesterday), page.input, locale)}
    ${hoursScript()}${foldScript()}`;
}

/* ------------------------------------------------------------ the loaders */

/** The console's inputs from the floor. Every query is Postgres-portable SQL. */
/** THE CONSOLE DAY (canon 0.30.152): the day the console reads. A picked day
 * must be a real calendar day no later than today; anything else reads yesterday. */
export function consoleDayOf(picked: string | null | undefined, today: string): { day: string; dayPicked: boolean } {
  const yesterday = dayBefore(today);
  const value = String(picked ?? "").trim();
  if (!value || !isCalendarDate(value) || value > today || value === yesterday) return { day: yesterday, dayPicked: false };
  return { day: value, dayPicked: true };
}

const OPEN_SQL = TEST_OPEN_STATUSES.map((status) => `'${status}'`).join(",");

/** THE TESTING GATE (canon 0.30.293). The four panes read the live mirror and
 * the desk's open orders. The stats and the pie read the season's first-time
 * rows on the In Testing sheet. The console's picked day is not an input. */
export async function loadTestingSection(db: D1Database, year: number): Promise<TestingFigures> {
  const [typesRaw, unitsRaw, mirror, cryo, orders, sheet, batches] = await Promise.all([
    getConfigValue(db, CONFIG_KEYS.gate_type_codes),
    getConfigValue(db, CONFIG_KEYS.gate_unit_grams),
    db
      .prepare(
        `SELECT UPPER(m.tag) AS tag, m.item, m.quantity, m.uom, m.lab_test_status, lv.farm_code AS farm
         FROM metrc_packages m
         LEFT JOIN lookup_values lv
           ON lv.category = 'license' AND lv.value = m.license_value AND lv.deleted_at IS NULL
         WHERE m.gone_at IS NULL`
      )
      .all<{ tag: string; item: string | null; quantity: number | null; uom: string | null; lab_test_status: string | null; farm: string | null }>(),
    db
      .prepare(PASTEURIZED_CRYO_SQL)
      .all<{ tag: string; type: string; cryo_weight_grams: number | null; weight_grams: number | null }>(),
    db
      .prepare(
        `SELECT id, UPPER(COALESCE(source_package_tag, '')) AS tag, status, batch_grams
         FROM test_orders
         WHERE deleted_at IS NULL AND status IN (${OPEN_SQL})`
      )
      .all<{ id: string; tag: string; status: string; batch_grams: number | null }>(),
    db
      .prepare(
        `SELECT strain, hbn, entered_testing, status, failure_mode, batch_weight_grams, attempt
         FROM external_test_results
         WHERE deleted_at IS NULL AND attempt = 1`
      )
      .all<{
        strain: string | null;
        hbn: string | null;
        entered_testing: string | null;
        status: string | null;
        failure_mode: string | null;
        batch_weight_grams: number | null;
        attempt: number | null;
      }>(),
    db
      .prepare(
        `SELECT hbn, market_strain FROM harvest_batches
         WHERE deleted_at IS NULL AND hbn IS NOT NULL AND TRIM(hbn) <> ''`
      )
      .all<{ hbn: string; market_strain: string | null }>(),
  ]);
  const marketByHbn = new Map<string, string>();
  for (const row of batches.results ?? []) {
    const hbn = String(row.hbn ?? "").trim();
    const market = String(row.market_strain ?? "").trim();
    if (!hbn || !market || marketByHbn.has(hbn)) continue;
    marketByHbn.set(hbn, market);
  }
  return buildTestingFigures({
    year,
    gateTypes: parseGateTypeCodes(typesRaw),
    unitGrams: parseGateUnitGrams(unitsRaw),
    mirror: mirror.results ?? [],
    cryo: cryo.results ?? [],
    orders: orders.results ?? [],
    sheet: sheet.results ?? [],
    marketByHbn,
  });
}

export async function loadHarvestConsole(db: D1Database, atIso: string, pickedDay: string | null = null): Promise<HarvestConsoleInput> {
  // THE FARM DAY BEGINS AT SIX (canon 0.30.151): today and yesterday are farm days.
  const startHour = parseFarmDayStartHour(await getConfigValue(db, CONFIG_KEYS.farm_day_start_hour));
  const today = farmDay(atIso, startHour);
  const { day: yesterday, dayPicked } = consoleDayOf(pickedDay, today);
  const year = Number(today.slice(0, 4));
  const bounds = farmDayBounds(yesterday, startHour);
  // THE TRIM LINE PICTURE (canon 0.30.154): RUNNING is a package weighed in the last 30 minutes.
  const recentSince = new Date(Date.parse(atIso) - TRIM_RUNNING_MINUTES * 60_000).toISOString();
  const [
    remaining,
    seasonHarvested,
    seasonLots,
    yesterdayWet,
    hoursRows,
    trimPackages,
    trimHoursRows,
    btrRaw,
    dayOpsRaw,
    secondOpsRaw,
    finishedRows,
    inputRows,
    recentRows,
    typeCatsRaw,
    queueRow,
    dayHoursRaw,
    secondHoursRaw,
    syncView,
    bogeyRaw,
    plantCountRows,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT lv.farm_code AS farm, COUNT(*) AS plants
         FROM metrc_plants p
         LEFT JOIN lookup_values lv ON lv.category = 'license' AND lv.value = p.license_value AND lv.deleted_at IS NULL
         WHERE p.gone_at IS NULL
         GROUP BY lv.farm_code`
      )
      .all<FarmCount>(),
    db
      .prepare(
        `SELECT b.farm_code AS farm, SUM(w.plant_count) AS plants
         FROM wet_weight_entries w
         JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
         WHERE w.deleted_at IS NULL AND w.status <> 'weighing' AND w.plant_count IS NOT NULL AND b.harvest_year = ?
         GROUP BY b.farm_code`
      )
      .bind(year)
      .all<FarmCount>(),
    db
      .prepare(
        `SELECT b.farm_code AS farm, w.weight_grams AS wet_grams, w.dry_weight_grams AS dry_grams, w.plant_count
         FROM wet_weight_entries w
         JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
         WHERE w.deleted_at IS NULL AND w.status <> 'weighing' AND b.harvest_year = ?`
      )
      .bind(year)
      .all<ConsoleLot>(),
    db
      .prepare(
        `SELECT b.farm_code AS farm, COALESCE(SUM(x.weight_grams), 0) AS wet_grams
         FROM wet_weights x
         JOIN wet_weight_entries w ON w.id = x.wet_weight_entry_id AND w.deleted_at IS NULL
         JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
         WHERE x.deleted_at IS NULL AND x.created_at >= ? AND x.created_at < ?
         GROUP BY b.farm_code`
      )
      .bind(bounds.startIso, bounds.endIso)
      .all<FarmGrams>(),
    db
      .prepare(`SELECT farm_code, hours FROM harvest_labor_hours WHERE work_date = ?`)
      .bind(yesterday)
      .all<{ farm_code: string; hours: number }>(),
    // THE TRIMMING SECTION (canon 0.30.88): yesterday's trim room packages,
    // dated by the typed trim date (a row without one by its entry instant).
    db
      .prepare(
        `SELECT p.package_type_code AS type_code, p.weight_grams, p.trim_operator
         FROM wip_packages p
         WHERE p.deleted_at IS NULL AND ${NON_TRIM_SOURCE_SQL}
           AND (p.trim_date = ? OR (p.trim_date IS NULL AND p.created_at >= ? AND p.created_at < ?))`
      )
      .bind(yesterday, bounds.startIso, bounds.endIso)
      .all<TrimPackageRow>(),
    db.prepare(`SELECT shift, hours FROM trim_labor_hours WHERE work_date = ?`).bind(yesterday).all<{ shift: string; hours: number }>(),
    getConfigValue(db, CONFIG_KEYS.btr_type_codes),
    getConfigValue(db, CONFIG_KEYS.trim_shift_day_operators),
    getConfigValue(db, CONFIG_KEYS.trim_shift_second_operators),
    // THE TRIM LINE PICTURE (canon 0.30.154): the lots finished on the trim line
    // within the day's window (their status log to trimmed), with the dry
    // weight, the grams their trim containers recorded, and the operator who
    // cut the last one; the WIP left (dry less recorded, above zero) is Other.
    db
      .prepare(
        `SELECT w.id AS lot_id, w.dry_weight_grams AS dry_grams,
                (SELECT COALESCE(SUM(p.weight_grams), 0) FROM wip_packages p
                  WHERE p.wet_weight_entry_id = w.id AND p.deleted_at IS NULL AND ${NON_TRIM_SOURCE_SQL}) AS recorded_grams,
                (SELECT p2.trim_operator FROM wip_packages p2
                  WHERE p2.wet_weight_entry_id = w.id AND p2.deleted_at IS NULL AND ${NON_TRIM_SOURCE_SQL.replaceAll("p.source", "p2.source").replaceAll("p.deleted_at", "p2.deleted_at")}
                  ORDER BY p2.created_at DESC LIMIT 1) AS last_operator
         FROM wet_weight_entries w
         WHERE w.deleted_at IS NULL AND w.status = 'trimmed'
           AND EXISTS (
             SELECT 1 FROM record_change_log l
             WHERE l.record_table = 'wet_weight_entries' AND l.record_id = w.id AND l.field = 'status' AND l.new_value = 'trimmed'
               AND l.changed_at >= ? AND l.changed_at < ?
           )`
      )
      .bind(bounds.startIso, bounds.endIso)
      .all<TrimFinishedLot>(),
    db.prepare(`SELECT shift, lbs FROM trim_line_inputs WHERE work_date = ?`).bind(yesterday).all<{ shift: string; lbs: number }>(),
    db
      .prepare(
        `SELECT p.trim_operator FROM wip_packages p
         WHERE p.deleted_at IS NULL AND ${NON_TRIM_SOURCE_SQL} AND p.created_at >= ?`
      )
      .bind(recentSince)
      .all<TrimRecentRow>(),
    getConfigValue(db, CONFIG_KEYS.cryo_type_categories),
    // THE LINE RUNS ON THE CLOCK (canon 0.30.163): the lots standing in the Unloaded
    // Queue for trim right now (the pane Trim Packages Entry picks from).
    db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(w.dry_weight_grams), 0) AS grams FROM wet_weight_entries w WHERE w.deleted_at IS NULL AND w.status = 'unloaded' ${TRIM_SCHEDULED_SQL}`
      )
      .first<{ n: number | null; grams: number | null }>(),
    getConfigValue(db, CONFIG_KEYS.trim_shift_day_hours),
    getConfigValue(db, CONFIG_KEYS.trim_shift_second_hours),
    // THE SHEET SYNC (canon 0.30.162): the last run, for the line under the sheet hours.
    latestSheetSync(db),
    // THE TRIM BOGEY (canon 0.30.249): the plume's product line, Admin, Lookups.
    getConfigValue(db, CONFIG_KEYS.trim_bogey_pct),
    db
      .prepare(`SELECT farm_code, plant_count FROM farm_plant_counts WHERE harvest_year = ? AND deleted_at IS NULL`)
      .bind(year)
      .all<{ farm_code: string; plant_count: number }>(),
  ]);
  const trimHours: Record<TrimShiftKey, number | null> = { day: null, second: null };
  for (const row of trimHoursRows.results ?? []) {
    if (row.shift === "day" || row.shift === "second") trimHours[row.shift] = Number(row.hours);
  }
  const inputLbs: Record<TrimShiftKey, number | null> = { day: null, second: null };
  for (const row of inputRows.results ?? []) {
    if (row.shift === "day" || row.shift === "second") inputLbs[row.shift] = Number(row.lbs);
  }
  const trim: TrimInput = {
    packages: (trimPackages.results ?? []).map((r) => ({
      type_code: r.type_code,
      weight_grams: Number(r.weight_grams ?? 0),
      trim_operator: r.trim_operator,
    })),
    budCodes: parseBtrTypeCodes(btrRaw),
    operators: { day: parseNameList(dayOpsRaw), second: parseNameList(secondOpsRaw) },
    hours: trimHours,
    prepackCodes: prepackCodesOf(parseCryoTypeCategories(typeCatsRaw)),
    finishedLots: (finishedRows.results ?? []).map((r) => ({
      lot_id: r.lot_id,
      dry_grams: r.dry_grams == null ? null : Number(r.dry_grams),
      recorded_grams: Number(r.recorded_grams ?? 0),
      last_operator: r.last_operator,
    })),
    inputLbs,
    recent: (recentRows.results ?? []).map((r) => ({ trim_operator: r.trim_operator })),
    queueLots: Number(queueRow?.n ?? 0),
    queueGrams: Number(queueRow?.grams ?? 0),
    nowIso: atIso,
    shiftHours: { day: dayHoursRaw, second: secondHoursRaw },
    bogeyPct: parseTrimBogey(bogeyRaw),
  };
  const hours = {} as Record<ConsoleFarm, number | null>;
  for (const farm of CONSOLE_FARMS) hours[farm] = null;
  for (const row of hoursRows.results ?? []) {
    const farm = farmOf(row.farm_code);
    if (farm) hours[farm] = Number(row.hours);
  }
  const plantCounts = {} as Record<ConsoleFarm, number | null>;
  for (const farm of CONSOLE_FARMS) plantCounts[farm] = null;
  for (const row of plantCountRows.results ?? []) {
    const farm = farmOf(row.farm_code);
    if (farm) plantCounts[farm] = Number(row.plant_count);
  }
  return {
    today,
    yesterday,
    dayPicked,
    year,
    remaining: (remaining.results ?? []).map((r) => ({ farm: r.farm, plants: Number(r.plants ?? 0) })),
    seasonHarvested: (seasonHarvested.results ?? []).map((r) => ({ farm: r.farm, plants: Number(r.plants ?? 0) })),
    seasonLots: (seasonLots.results ?? []).map((r) => ({
      farm: r.farm,
      wet_grams: Number(r.wet_grams ?? 0),
      dry_grams: r.dry_grams == null ? null : Number(r.dry_grams),
      plant_count: r.plant_count == null ? null : Number(r.plant_count),
    })),
    yesterdayWet: (yesterdayWet.results ?? []).map((r) => ({ farm: r.farm, wet_grams: Number(r.wet_grams ?? 0) })),
    hours,
    plantCounts,
    trim,
    sheetSync: syncView,
  };
}

/* -------------------------------------------------------------- the hours */

/** The typed hours: a number of hours, zero or more, quarter hours welcome; blank clears the day. */
export function parseHours(raw: string | null): number | null {
  const text = (raw ?? "").trim().replace(/,/g, "");
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 24 * 500) throw new HttpError(400, "Hours must be a number of hours, zero or more.");
  return Math.round(n * 100) / 100;
}

/** Save (or clear) one farm's Cutting and Bucking hours for one day; the change
 * lands in record_change_log under harvest_labor_hours. */
export async function saveHarvestHours(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actorId = textOrNull(form.get("person_id"));
  const farm = farmOf(textOrNull(form.get("farm")));
  if (!farm) throw new HttpError(400, "Pick a farm.");
  const workDate = textOrNull(form.get("work_date")) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !Number.isFinite(Date.parse(`${workDate}T00:00:00.000Z`))) {
    throw new HttpError(400, "Work date must be YYYY-MM-DD.");
  }
  const hours = parseHours(textOrNull(form.get("hours")));
  const ts = nowIso();
  const existing = await db
    .prepare(`SELECT id, hours FROM harvest_labor_hours WHERE farm_code = ? AND work_date = ?`)
    .bind(farm, workDate)
    .first<{ id: string; hours: number }>();
  const stmts: D1PreparedStatement[] = [];
  if (hours == null) {
    if (existing) {
      stmts.push(
        db.prepare(`DELETE FROM harvest_labor_hours WHERE id = ?`).bind(existing.id),
        insertLog(db, {
          record_table: "harvest_labor_hours",
          record_id: existing.id,
          field: "hours",
          old_value: String(existing.hours),
          new_value: null,
          actor_person_id: actorId,
          reason: SYSTEM_REASON.labor_hours,
          changed_at: ts,
        })
      );
    }
  } else if (existing) {
    if (Number(existing.hours) !== hours) {
      stmts.push(
        db
          .prepare(`UPDATE harvest_labor_hours SET hours = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
          .bind(hours, ts, actorId, existing.id),
        insertLog(db, {
          record_table: "harvest_labor_hours",
          record_id: existing.id,
          field: "hours",
          old_value: String(existing.hours),
          new_value: String(hours),
          actor_person_id: actorId,
          reason: SYSTEM_REASON.labor_hours,
          changed_at: ts,
        })
      );
    }
  } else {
    const id = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO harvest_labor_hours (id, farm_code, work_date, hours, created_at, created_by, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, farm, workDate, hours, ts, actorId, ts, actorId),
      insertLog(db, {
        record_table: "harvest_labor_hours",
        record_id: id,
        field: "hours",
        old_value: null,
        new_value: String(hours),
        actor_person_id: actorId,
        reason: SYSTEM_REASON.labor_hours,
        changed_at: ts,
      })
    );
  }
  if (stmts.length) await db.batch(stmts);
  return { redirect: `${HARVEST_PATH}?ok=hours${textOrNull(form.get("day_picked")) ? `&day=${encodeURIComponent(workDate)}` : ""}` };
}

/** THE TRIMMING SECTION (canon 0.30.88): save (or clear) one shift's DLH for
 * one day; the change lands in record_change_log under trim_labor_hours. */
export async function saveTrimHours(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actorId = textOrNull(form.get("person_id"));
  const shiftRaw = textOrNull(form.get("shift"));
  const shift = TRIM_SHIFTS.find((s) => s.key === shiftRaw)?.key;
  if (!shift) throw new HttpError(400, "Pick a shift.");
  const workDate = textOrNull(form.get("work_date")) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !Number.isFinite(Date.parse(`${workDate}T00:00:00.000Z`))) {
    throw new HttpError(400, "Work date must be YYYY-MM-DD.");
  }
  const hours = parseHours(textOrNull(form.get("hours")));
  const ts = nowIso();
  const existing = await db
    .prepare(`SELECT id, hours FROM trim_labor_hours WHERE work_date = ? AND shift = ?`)
    .bind(workDate, shift)
    .first<{ id: string; hours: number }>();
  const log = (id: string, oldValue: string | null, newValue: string | null) =>
    insertLog(db, {
      record_table: "trim_labor_hours",
      record_id: id,
      field: "hours",
      old_value: oldValue,
      new_value: newValue,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.labor_hours,
      changed_at: ts,
    });
  const stmts: D1PreparedStatement[] = [];
  if (hours == null) {
    if (existing) {
      stmts.push(db.prepare(`DELETE FROM trim_labor_hours WHERE id = ?`).bind(existing.id), log(existing.id, String(existing.hours), null));
    }
  } else if (existing) {
    if (Number(existing.hours) !== hours) {
      stmts.push(
        db.prepare(`UPDATE trim_labor_hours SET hours = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(hours, ts, actorId, existing.id),
        log(existing.id, String(existing.hours), String(hours))
      );
    }
  } else {
    const id = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO trim_labor_hours (id, work_date, shift, hours, created_at, created_by, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, workDate, shift, hours, ts, actorId, ts, actorId),
      log(id, null, String(hours))
    );
  }
  if (stmts.length) await db.batch(stmts);
  return { redirect: `${HARVEST_PATH}?ok=trim_hours${textOrNull(form.get("day_picked")) ? `&day=${encodeURIComponent(workDate)}` : ""}` };
}

/** THE TRIM LINE PICTURE (canon 0.30.154): the typed input pounds, zero or
 * more, two decimals; blank clears the shift's number. */
export function parseInputLbs(raw: string | null): number | null {
  const text = (raw ?? "").trim().replace(/,/g, "");
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new HttpError(400, "Input lbs must be a number of pounds, zero or more.");
  return Math.round(n * 100) / 100;
}

/** Save (or clear) one shift's input lbs for one day (total lbs run through
 * T-0); the change lands in record_change_log under trim_line_inputs. */
export async function saveTrimInputLbs(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actorId = textOrNull(form.get("person_id"));
  const shiftRaw = textOrNull(form.get("shift"));
  const shift = TRIM_SHIFTS.find((s) => s.key === shiftRaw)?.key;
  if (!shift) throw new HttpError(400, "Pick a shift.");
  const workDate = textOrNull(form.get("work_date")) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !Number.isFinite(Date.parse(`${workDate}T00:00:00.000Z`))) {
    throw new HttpError(400, "Work date must be YYYY-MM-DD.");
  }
  const lbs = parseInputLbs(textOrNull(form.get("lbs")));
  const ts = nowIso();
  const existing = await db
    .prepare(`SELECT id, lbs FROM trim_line_inputs WHERE work_date = ? AND shift = ?`)
    .bind(workDate, shift)
    .first<{ id: string; lbs: number }>();
  const log = (id: string, oldValue: string | null, newValue: string | null) =>
    insertLog(db, {
      record_table: "trim_line_inputs",
      record_id: id,
      field: "lbs",
      old_value: oldValue,
      new_value: newValue,
      actor_person_id: actorId,
      reason: SYSTEM_REASON.labor_hours,
      changed_at: ts,
    });
  const stmts: D1PreparedStatement[] = [];
  if (lbs == null) {
    if (existing) {
      stmts.push(db.prepare(`DELETE FROM trim_line_inputs WHERE id = ?`).bind(existing.id), log(existing.id, String(existing.lbs), null));
    }
  } else if (existing) {
    if (Number(existing.lbs) !== lbs) {
      stmts.push(
        db.prepare(`UPDATE trim_line_inputs SET lbs = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(lbs, ts, actorId, existing.id),
        log(existing.id, String(existing.lbs), String(lbs))
      );
    }
  } else {
    const id = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO trim_line_inputs (id, work_date, shift, lbs, created_at, created_by, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, workDate, shift, lbs, ts, actorId, ts, actorId),
      log(id, null, String(lbs))
    );
  }
  if (stmts.length) await db.batch(stmts);
  return { redirect: `${HARVEST_PATH}?ok=trim_input${textOrNull(form.get("day_picked")) ? `&day=${encodeURIComponent(workDate)}` : ""}` };
}
