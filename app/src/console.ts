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
 * SHAKE), so BTR counts BUD, SMALLS and SHAKE over all weight ran. The day's
 * packages are the trim room's entries dated that day (trim_date). The
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
 * Weight/DLH divides the wet grams weighed on the day under view (the farm's
 * day, Eastern time) by that day's hours.
 *
 * THE FARM DAY BEGINS AT SIX (canon 0.30.151): the console's today and the day
 * under view are farm days (the day rolls at app_config farm_day_start_hour,
 * Eastern), and the windows they draw run from start hour to start hour.
 *
 * THE CONSOLE DAY (canon 0.30.152). Owner, 2026-09-20, verbatim: "on the
 * dashboard, can we do a universal date override?  It defaults to "yesterday"
 * and I can change it to any other day?" BRIEF V17 moved that default to the
 * farm's today. One date control at the top of the console (?day=YYYY-MM-DD):
 * it defaults to today, takes any earlier day as a pick, and every per-day pane
 * follows it (the Cutting and Bucking hours, Weight/DLH, the whole Trimming
 * section), the hours typed landing on that day; the Plants figures stay the
 * season's and the drying strip stays live. The labels name the day beside the
 * pane titles.
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
 * cut its last package); the input lbs box was per shift, beside the DLH box
 * (trim_line_inputs, migration 0065). BRIEF V17 removed that box, the picture's
 * input line, the route and the flash; the table stays in data. The picture
 * replaces the waffle in each
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
  HARVEST_PREPACK_HOURS_PATH,
  HARVEST_PASTEURIZATION_HOURS_PATH,
  parsePrepackUnits,
  NON_TRIM_SOURCE_SQL,
  parseBtrTypeCodes,
  parseCryoTypeCategories,
  parseGateTypeCodes,
  parseGateUnitGrams,
  parseNameList,
  parseShiftWindow,
  parseTrimBogey,
  PASTEURIZATION_RUNNING_MINUTES,
  PASTEURIZATION_SHIFT_HOURS_DEFAULT,
  PASTEURIZATION_SHIFTS,
  roundGrams,
  shiftWindowHolds,
  SYSTEM_REASON,
  TEST_CONSOLE_SCHEDULED,
  TEST_OPEN_STATUSES,
  TRIM_SHIFT_HOURS_DEFAULT,
} from "./config";
import { HttpError, nowIso, textOrNull } from "./audit";
import { getConfigValue, insertLog, TRIM_SCHEDULED_SQL } from "./db";
import { formatClock, siloStrip } from "./drying";
import { fulfillmentSection, emptyFulfillment, type FulfillmentDay } from "./fulfillmentboard";
import { dayBefore, etClockMinutes, etDate, etDayBounds, FARM_DAY_START_HOUR_DEFAULT, FARM_TIME_ZONE, farmDay, farmDayBounds, isCalendarDate, parseFarmDayStartHour } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { type SiloLive, dryingTotalsMarkup, type DryingTotals } from "./silo";
import { outcomeOf } from "./intesting";
import { consoleIconSvg, type ConsoleIconName } from "./consoleicons";
import { loadRadRunning, type RadRunningView } from "./rad";
import { esc } from "./ui";

export const CONSOLE_FARMS = ["PNN", "ARL", "PNS"] as const;
export type ConsoleFarm = (typeof CONSOLE_FARMS)[number];
export const CONSOLE_TIME_ZONE = FARM_TIME_ZONE;
export { HARVEST_PATH, HARVEST_HOURS_PATH, HARVEST_TRIM_HOURS_PATH, HARVEST_PASTEURIZATION_HOURS_PATH };

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
  /** THE CONSOLE DAY: the day under view, the farm's today by default or a picked day before it.
   * Every per-day pane, window and hours box reads it. */
  day: string;
  /** True when the day under view is a picked day before today, not the default. */
  dayPicked: boolean;
  year: number;
  /** Live plants in the mirror (gone_at NULL) by the farm of the license. */
  remaining: FarmCount[];
  /** Plant counts on finished lots of the harvest year, by farm. */
  seasonHarvested: FarmCount[];
  /** Finished lots of the harvest year, for the per-plant averages. */
  seasonLots: ConsoleLot[];
  /** Wet grams weighed on the console day, by farm. */
  dayWet: FarmGrams[];
  /** The harvest year's wet grams, every tote weighed, weighing lots included, by farm. */
  yearWet?: FarmGrams[];
  /** Cutting and Bucking hours typed per farm for the day under view; null when none typed.
   * The Total pane reads harvestHoursAll when that row stands, else the sum of these. */
  hours: Record<ConsoleFarm, number | null>;
  /** THE HARVEST HOURS (canon 0.30.310): the one typed row, farm_code ALL, for the day under view. */
  harvestHoursAll?: number | null;
  /** Farm Plant Count for the harvest year: the constant denominator, null when none is saved. */
  plantCounts: Record<ConsoleFarm, number | null>;
  /** THE TRIMMING SECTION (canon 0.30.88): the console day's trim room, by shift; absent renders the section empty. */
  trim?: TrimInput;
  /** THE RIGHT NOW PANE (canon 0.30.310): today's farm day so far, every operator. Absent reads as nothing today. */
  trimLive?: TrimInput;
  /** The instant of the last package weighed at the trim node, any day. Null when none was ever weighed. */
  lastWeighedAt?: string | null;
  /** BRIEF V10, PASTEURIZATION ON THE CONSOLE (canon 0.30.334): the day picked's cryo outputs and finished runs by shift; absent renders the panes empty. */
  pasteurization?: PasteurizationInput;
  /** Today's farm day so far, every operator, with the open runs' remainders; absent reads as nothing today. */
  pasteurizationLive?: PasteurizationInput;
  /** The instant of the last cryo output ever entered, any day. Null when none was ever entered. */
  lastCryoOutputAt?: string | null;
  /** The Rad run in status running with its lot numbers; null (or absent) when the Rad is empty. */
  radRunning?: RadRunningView | null;
};

/* ------------------------------------------------------------ the trimming */

export type TrimShiftKey = "day" | "second";
/** His two shifts, in his words and order: "Day shift" and "Second Shift". */
export const TRIM_SHIFTS: readonly { key: TrimShiftKey; label: string; configKey: string }[] = [
  { key: "day", label: "Day shift", configKey: CONFIG_KEYS.trim_shift_day_operators },
  { key: "second", label: "Second Shift", configKey: CONFIG_KEYS.trim_shift_second_operators },
];

/** One trim room package dated the console day: its type, grams and the operator who typed it. */
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
  /** The day's non-voided packages from Trim Packages Entry (trim_date = the console day). */
  packages: TrimPackageRow[];
  /** The package type codes that count as BUD (app_config btr_type_codes). */
  budCodes: string[];
  /** The trim operators of each shift (app_config trim_shift_day_operators, trim_shift_second_operators). */
  operators: Record<TrimShiftKey, string[]>;
  /** The day's typed DLH per shift; null when none typed. */
  hours: Record<TrimShiftKey, number | null>;
  /** THE TRIM LINE PICTURE (canon 0.30.154): the BUD-set types whose product category is WPR
   * (app_config cryo_type_categories, SMALLS by default): his Prepack Bud. The rest of the set is Bulk Bud. */
  prepackCodes?: string[];
  /** Lots finished on the trim line within the day's window; their WIP left lands on Other. */
  finishedLots?: TrimFinishedLot[];
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
      running: a.running || (onDuty[shift.key] && queueLots > 0),
      onDuty: onDuty[shift.key],
      hours_window: windows[shift.key],
    };
  });
  return { shifts, unassignedGrams: roundGrams(unassignedGrams), unassignedOperators: [...unassigned].sort(), unassignedRunning };
}

/** THE RIGHT NOW PANE (canon 0.30.310): today's packages and finished lots, every
 * operator in one line. RUNNING is a package weighed in the last 30 minutes and
 * nothing else (canon 0.30.313; the doc: no weight for thirty minutes says DOWN);
 * the queue clause of canon 0.30.163 stays on the shift cards. */
export function liveTrimLine(input: TrimInput): TrimShiftFigures {
  const bud = new Set(input.budCodes.map((c) => c.trim().toUpperCase()));
  const prepack = new Set((input.prepackCodes ?? prepackCodesOf(parseCryoTypeCategories(null))).map((c) => c.trim().toUpperCase()));
  let packages = 0;
  let grams = 0;
  let bulk = 0;
  let prepackG = 0;
  let bio = 0;
  let trim = 0;
  let rest = 0;
  let wip = 0;
  let finished = 0;
  for (const p of input.packages) {
    const g = Number(p.weight_grams ?? 0);
    packages += 1;
    grams += g;
    const type = String(p.type_code ?? "").trim().toUpperCase();
    if (bud.has(type)) {
      if (prepack.has(type)) prepackG += g;
      else bulk += g;
    } else if (type === "BIO") bio += g;
    else if (type === "TRIM") trim += g;
    else rest += g;
  }
  for (const lot of input.finishedLots ?? []) {
    finished += 1;
    const left = Number(lot.dry_grams ?? 0) - Number(lot.recorded_grams ?? 0);
    if (left > 0) wip += left;
  }
  const clock = input.nowIso ? etClockMinutes(input.nowIso) : null;
  const windows: Record<TrimShiftKey, string> = {
    day: String(input.shiftHours?.day ?? "").trim() || TRIM_SHIFT_HOURS_DEFAULT.day,
    second: String(input.shiftHours?.second ?? "").trim() || TRIM_SHIFT_HOURS_DEFAULT.second,
  };
  const dutyDay = clock != null && shiftWindowHolds(parseShiftWindow(windows.day, TRIM_SHIFT_HOURS_DEFAULT.day), clock);
  const dutySecond = clock != null && shiftWindowHolds(parseShiftWindow(windows.second, TRIM_SHIFT_HOURS_DEFAULT.second), clock);
  const running = (input.recent ?? []).length > 0;
  const total = grams + wip;
  const duty: TrimShiftKey | null = dutyDay ? "day" : dutySecond ? "second" : null;
  return {
    key: duty ?? "day",
    label: duty === "second" ? "Second Shift" : duty === "day" ? "Day shift" : "",
    operators: [],
    packages,
    grams: roundGrams(grams),
    budGrams: roundGrams(bulk + prepackG),
    otherGrams: roundGrams(trim + bio + rest + wip),
    btr: total > 0 ? (bulk + prepackG) / total : null,
    hours: null,
    gramsPerDlh: null,
    bulkGrams: roundGrams(bulk),
    prepackGrams: roundGrams(prepackG),
    bioGrams: roundGrams(bio),
    trimGrams: roundGrams(trim),
    restGrams: roundGrams(rest),
    wipLeftGrams: roundGrams(wip),
    finishedLots: finished,
    totalGrams: roundGrams(total),
    running,
    onDuty: duty != null,
    hours_window: duty ? windows[duty] : "",
  };
}

/** Which shift the clock is inside, or null in a gap. Day wins when both windows hold. */
export function trimDuty(input: TrimInput): TrimShiftKey | null {
  const clock = input.nowIso ? etClockMinutes(input.nowIso) : null;
  if (clock == null) return null;
  const dayWindow = String(input.shiftHours?.day ?? "").trim() || TRIM_SHIFT_HOURS_DEFAULT.day;
  const secondWindow = String(input.shiftHours?.second ?? "").trim() || TRIM_SHIFT_HOURS_DEFAULT.second;
  if (shiftWindowHolds(parseShiftWindow(dayWindow, TRIM_SHIFT_HOURS_DEFAULT.day), clock)) return "day";
  if (shiftWindowHolds(parseShiftWindow(secondWindow, TRIM_SHIFT_HOURS_DEFAULT.second), clock)) return "second";
  return null;
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

export function trimLinePicture(shift: TrimShiftFigures, locale: Locale = "en", opts?: { totalLabel?: string; flowId?: string }): string {
  const lb = (grams: number) => `${formatLbs(grams)} lb`;
  const g = (grams: number) => `${formatGrams(roundGrams(grams))} g`;
  const k = esc(opts?.flowId ?? shift.key);
  const totalWord = opts?.totalLabel ?? "Shift total";
  const down = `hc-flow-down-${k}`;
  const left = `hc-flow-left-${k}`;
  const up = `hc-flow-up-${k}`;
  const w = TRIM_LINE_BAR_WIDTH;
  // The rest of Other rides the TRIM circle (his correction): the TRIM stream, the WIP left, every other type.
  const trimGrams = roundGrams(shift.trimGrams + shift.restGrams + shift.wipLeftGrams);
  const total = `${lb(shift.totalGrams)} · ${g(shift.totalGrams)}`;
  const label = `${t(locale, totalWord)} ${total}`;
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
      <text class="hc-total-label" x="520" y="662">${esc(t(locale, totalWord))}</text>
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
  const label = empty ? t(locale, "no packages on the day") : `BTR ${fmtPct(btr)}`;
  const product = Number.isFinite(bogeyPct) ? Math.max(0, Math.min(BUD_CELLS.length, Math.round(bogeyPct))) : BUD_PRODUCT_CELLS;
  const cells = BUD_CELLS.map(([row, col, n]) => {
    const order = 101 - n;
    const state = empty ? "empty" : n <= lit ? "bud" : "consumed";
    const waste = state === "consumed" && n <= product ? " data-hc-bud-waste" : "";
    return `<rect class="hc-bud-cell hc-bud-${state}" data-hc-bud-order="${order}" data-hc-bud-n="${n}" x="${col * 10 + 1.2}" y="${row * 10 + 1.2}" width="7.6" height="7.6" rx="1.2"${waste}/>`;
  }).join("");
  return `<svg class="hc-bud" viewBox="0 0 ${BUD_COLS * 10} ${BUD_ROWS * 10}" role="img" aria-label="${esc(label)}" data-hc-bud data-hc-bud-consumed="${consumed}" data-hc-bud-product="${product}">${cells}</svg>`;
}

/** THE BTR BAR (canon 0.30.310): today's live BTR across the pane. The bogey is a tick.
 * Nothing run today is an empty outline. */
export function btrBar(btr: number | null, bogeyPct: number, locale: Locale = "en"): string {
  const bogey = Number.isFinite(bogeyPct) ? Math.max(0, Math.min(100, Math.round(bogeyPct))) : BUD_PRODUCT_CELLS;
  if (btr == null) {
    return `<div class="hc-btr-bar hc-btr-bar-empty" data-hc-btr-bar data-hc-btr-empty="1"><div class="hc-btr-track"></div><span class="hc-btr-read" data-hc-btr-bar-text>${esc(t(locale, "no packages today"))}</span></div>`;
  }
  const pct = Math.max(0, Math.min(1, btr));
  const width = (pct * 100).toFixed(1);
  return `<div class="hc-btr-bar" data-hc-btr-bar data-hc-btr="${esc(String(pct))}">
      <div class="hc-btr-track">
        <div class="hc-btr-fill" style="width:${width}%"></div>
        <div class="hc-btr-rest"></div>
        <span class="hc-btr-tick" data-hc-btr-tick style="left:${bogey}%"></span>
      </div>
      <span class="hc-btr-bogey" data-hc-btr-bogey style="left:${bogey}%">${esc(String(bogey))}%</span>
      <span class="hc-btr-read" data-hc-btr-bar-text>${esc(`BTR ${fmtPct(btr)}`)}</span>
    </div>`;
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
    // THE PLANTS FROM ADMIN'S TOTAL (canon 0.30.346). Owner, 2026-10-02, verbatim: "the plants
    // harvested should be the total plants defined in Admin minus what remains.  That should
    // drive the percentage complete as well." A farm with a typed total reads that total less
    // the mirror's remaining (never below zero); a farm with none keeps the lots' plant counts.
    const farmHarvestedNow = (farm: ConsoleFarm) => {
      const typed = input.plantCounts[farm];
      return typed == null ? farmHarvested(farm) : Math.max(0, typed - farmRemaining(farm));
    };
    const remaining = f == null ? CONSOLE_FARMS.reduce((n, farm) => n + farmRemaining(farm), 0) : farmRemaining(f);
    const harvested = f == null ? CONSOLE_FARMS.reduce((n, farm) => n + farmHarvestedNow(farm), 0) : farmHarvestedNow(f);
    const total = f == null ? CONSOLE_FARMS.reduce((n, farm) => n + farmTotal(farm), 0) : farmTotal(f);
    const pct = total > 0 ? harvested / total : null;
    const counted = input.seasonLots.filter((l) => (f == null || farmOf(l.farm) === f) && Number(l.plant_count ?? 0) >= 1);
    const plantsIn = (lots: ConsoleLot[]) => lots.reduce((n, l) => n + Number(l.plant_count ?? 0), 0);
    const wetPlants = plantsIn(counted);
    const wetPerPlant = wetPlants > 0 ? counted.reduce((n, l) => n + Number(l.wet_grams ?? 0), 0) / wetPlants : null;
    const dried = counted.filter((l) => l.dry_grams != null && Number(l.dry_grams) > 0);
    const dryPlants = plantsIn(dried);
    const dryPerPlant = dryPlants > 0 ? dried.reduce((n, l) => n + Number(l.dry_grams ?? 0), 0) / dryPlants : null;
    const wetDay = sumBy(input.dayWet, f, (r) => r.wet_grams, (r) => r.farm);
    const wetYear = sumBy(input.yearWet ?? [], f, (r) => r.wet_grams, (r) => r.farm);
    const metrics: ConsoleMetric[] = [
      { key: "remaining_total", label: "Plants Remaining/Total Plants", value: `${fmtCount(remaining)} / ${fmtCount(total)}` },
      { key: "harvested", label: "Plants Harvested", value: fmtCount(harvested) },
      { key: "pct", label: "% Complete", value: pct == null ? NA : fmtPct(pct) },
      { key: "wet_per_plant", label: "Wet Weight/plant AVG", ...(wetPerPlant == null ? { value: NA } : weightPair(wetPerPlant)) },
      { key: "dry_per_plant", label: "Dry Weight/plant AVG", ...(dryPerPlant == null ? { value: NA } : weightPair(dryPerPlant)) },
      { key: "weight_harvested", label: "Weight Harvested", ...weightPair(wetDay) },
    ];
    // THE YEAR PANE (canon 0.30.346, his words): "in its own pane within the farm pane", under
    // Weight Harvested on each farm, and on Total "beneath the lbs/DLH metric".
    const yearPane: ConsoleMetric = { key: "weight_harvested_year", label: "Harvest Year Total", ...weightPair(wetYear) };
    if (f != null) metrics.push(yearPane);
    if (f == null) {
      let hours: number | null;
      if (input.harvestHoursAll != null) hours = input.harvestHoursAll;
      else {
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
      const perDlh = hours != null && hours > 0 ? wetDay / hours : null;
      metrics.push(
        { key: "hours", label: "Harvest Hours", value: hours == null ? NA : String(hours) },
        {
          key: "weight_per_dlh",
          label: "Weight/DLH",
          ...(perDlh == null ? { value: hours == null ? t(locale, "type hours") : NA } : weightPair(perDlh, "/h")),
        },
        yearPane
      );
    }
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
  /** FULFILLMENT (canon 0.30.306). Omitted reads as a day with no cells. */
  fulfillment?: FulfillmentDay;
};

function hoursBox(input: HarvestConsoleInput, locale: Locale, value: number | null): string {
  return `<form method="post" action="${esc(HARVEST_HOURS_PATH)}" class="hc-hours" data-hc-hours="ALL">
              <input type="hidden" name="farm" value="ALL">
              <input type="hidden" name="work_date" value="${esc(input.day)}">
              <input type="hidden" name="day_picked" value="${input.dayPicked ? "1" : ""}">
              <input type="number" name="hours" min="0" step="0.25" inputmode="decimal" value="${value == null ? "" : esc(String(value))}" placeholder="${esc(
                t(locale, "hours")
              )}" aria-label="${esc(t(locale, "Harvest Hours"))}" data-hc-hours-input>
              <button type="submit" class="secondary">${esc(t(locale, "Save"))}</button>
            </form>`;
}

function farmBox(box: ConsoleBox, input: HarvestConsoleInput, locale: Locale): string {
  const pct = box.pct ?? 0;
  const metrics = box.metrics
    .map((m) => {
      const value =
        m.key === "hours" && box.farm === "Total"
          ? hoursBox(input, locale, m.value === "" ? null : Number(m.value))
          : `<span class="hc-value" data-hc="${esc(m.key)}">${esc(m.value)}</span>${m.sub ? `<span class="hc-sub muted">${esc(m.sub)}</span>` : ""}`;
      const dateNote =
        m.key === "hours" || m.key === "weight_per_dlh" || m.key === "weight_harvested"
          ? ` <span class="hc-date muted">${esc(input.day)}</span>`
          : m.key === "weight_harvested_year"
            ? ` <span class="hc-date muted">${esc(String(input.year))}</span>`
            : "";
      const cls = m.key === "weight_harvested_year" ? "hc-metric hc-year-pane" : "hc-metric";
      return `<div class="${cls}" data-hc-metric="${esc(m.key)}"><dt>${esc(t(locale, m.label))}${dateNote}</dt><dd>${value}</dd></div>`;
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
      // BRIEF V10 (canon 0.30.334): a fold remembered against the pasteurization stub (closed by
      // default) is forgotten once, so the built section opens on its first visit; the next toggle
      // writes the mark and the fold is remembered from then on.
      if (name === "pasteurization" && stored.pasteurization_built !== "1") return;
      if (stored[name] === "1") el.setAttribute("open", "");
      else if (stored[name] === "0") el.removeAttribute("open");
    });
  }
  function write() {
    var next = { pasteurization_built: "1" };
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

function trimHoursBox(shift: TrimShiftFigures, input: HarvestConsoleInput, locale: Locale): string {
  return `<form method="post" action="${esc(HARVEST_TRIM_HOURS_PATH)}" class="hc-hours" data-hc-trim-hours="${esc(shift.key)}">
              <input type="hidden" name="shift" value="${esc(shift.key)}">
              <input type="hidden" name="work_date" value="${esc(input.day)}">
              <input type="hidden" name="day_picked" value="${input.dayPicked ? "1" : ""}">
              <input type="number" name="hours" min="0" step="0.25" inputmode="decimal" value="${shift.hours == null ? "" : esc(String(shift.hours))}" placeholder="${esc(
                t(locale, "hours")
              )}" aria-label="${esc(`${t(locale, "DLH")} ${t(locale, shift.label)}`)}" data-hc-hours-input>
              <button type="submit" class="secondary">${esc(t(locale, "Save"))}</button>
            </form>`;
}

/** One shift's card: the bud waffle, then his lines (Other, Bulk Bud, Prepack Bud,
 * Total Bud, BTR, the weight ran, the DLH box, Lbs/DLH). */
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
      label: "Lbs Produced",
      value: lbs(shift.grams),
      sub: `${g(shift.grams)} · ${shift.packages} ${t(locale, "packages")}${
        shift.wipLeftGrams > 0 ? ` · ${t(locale, "shift total")} ${g(shift.totalGrams)}` : ""
      }`,
    },
    { key: "trim_dlh", label: "DLH", value: shift.hours == null ? NA : String(shift.hours), html: trimHoursBox(shift, input, locale) },
    { key: "trim_lbs_per_dlh", label: "Lbs/DLH", ...perDlh },
  ];
  const lines = metrics
    .map((m) => {
      const value = m.html ?? `<span class="hc-value" data-hc="${esc(m.key)}">${esc(m.value)}</span>${m.sub ? `<span class="hc-sub muted">${esc(m.sub)}</span>` : ""}`;
      return `<div class="hc-metric" data-hc-metric="${esc(m.key)}"><dt>${esc(t(locale, m.label))}</dt><dd>${value}</dd></div>`;
    })
    .join("");
  const operators = shift.operators.length ? shift.operators.join(", ") : t(locale, "no operators named");
  const running = shift.running ? `<span class="hc-running" data-hc-running>${esc(t(locale, "RUNNING"))}</span>` : "";
  const btrRead =
    shift.btr == null
      ? esc(t(locale, "no packages on the day"))
      : `<strong>${esc(fmtPct(shift.btr))}</strong> ${esc(t(locale, "BTR"))}`;
  return `<div class="hc-shift" data-hc-shift="${esc(shift.key)}" data-hc-shift-grams="${esc(String(shift.grams))}" data-hc-shift-running="${shift.running ? "1" : "0"}">
          <div class="hc-shift-head">
            <span class="hc-shift-name">${esc(t(locale, shift.label))}</span>
            <span class="hc-shift-ops muted" data-hc-shift-operators>${esc(operators)}</span>
            <span class="hc-date muted">${esc(input.day)}</span>
            ${running}
          </div>
          <div class="hc-shift-body hc-shift-stack">
            <div class="hc-visuals">
            <div class="hc-bud-col">
            ${budWaffle(shift.btr, locale, input.trim?.bogeyPct)}
            <div class="hc-btr-read" data-hc-btr-read>${btrRead}</div>
            <div class="hc-legend"><span class="hc-swatch hc-swatch-bud"></span>${esc(t(locale, "bud"))} <span class="hc-swatch hc-swatch-consumed"></span>${esc(t(locale, "byproduct"))} <span class="hc-swatch hc-swatch-waste"></span>${esc(t(locale, "waste"))}</div>
            </div>
            </div>
            <dl class="hc-metrics">${lines}</dl>
          </div>
        </div>`;
}

/** THE BLUE THROB law for the bars (canon 0.30.79): a reduced-motion setting
 * slows the stripes instead of stilling them, so the floor signal stands. */
function trimLineScript(): string {
  return `<script>(function(){try{if(!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))return;document.querySelectorAll(".hc-trimline animate").forEach(function(a){a.setAttribute("dur","${TRIM_LINE_FLOW_MS * 2}ms");});}catch(e){}})();</script>`;
}

function trimTotalsLine(figures: TrimFigures, locale: Locale): string {
  const grams = figures.shifts.reduce((n, shift) => n + shift.grams, 0) + figures.unassignedGrams;
  const typed = figures.shifts.map((shift) => shift.hours).filter((h): h is number => h != null);
  const hours = typed.length === 0 ? null : typed.reduce((n, h) => n + h, 0);
  const per = hours != null && hours > 0 ? grams / hours : null;
  const lbs = weightPair(grams);
  const cell = (key: string, label: string, value: string, sub = "") =>
    `<div class="hc-trim-total" data-hc-trim-total="${esc(key)}"><div class="hc-gate-name">${esc(t(locale, label))}</div><span class="hc-value">${esc(value)}</span>${sub ? `<span class="hc-sub muted">${esc(sub)}</span>` : ""}</div>`;
  // THE WEIGHTED BTR (canon 0.30.335). Owner, 2026-10-01, verbatim: "on my
  // totals under the trimmer, to the right of Lbs/DLH for both shifts, I'd like
  // the weighted BTR across both shifts as well". Both shifts' Total Bud over
  // both shifts' totals (weighed plus WIP left), so each shift counts by the
  // weight it ran, not as an average of the two percents; operators on neither
  // shift stay out of it, as they stay off the cards.
  const budGrams = figures.shifts.reduce((n, shift) => n + shift.budGrams, 0);
  const shiftGrams = figures.shifts.reduce((n, shift) => n + shift.totalGrams, 0);
  const btr = shiftGrams > 0 ? budGrams / shiftGrams : null;
  return `<div class="hc-trim-totals" data-hc-trim-totals>
      ${cell("lbs", "Total Lbs", lbs.value, lbs.sub)}
      ${cell("hours", "Total Hours", hours == null ? t(locale, "type hours") : String(hours))}
      ${cell("per", "Lbs/DLH", per == null ? (hours == null ? t(locale, "type hours") : NA) : `${formatLbs(per)} lb/h`, per == null ? "" : `${formatGrams(roundGrams(per))} g/h`)}
      ${cell("btr", "Weighted BTR", btr == null ? t(locale, "no packages on the day") : fmtPct(btr), btr == null ? "" : t(locale, "both shifts, Total Bud over the shift totals"))}
    </div>`;
}

function trimRightNow(input: HarvestConsoleInput, locale: Locale): string {
  const liveInput = input.trimLive ?? emptyTrimInput();
  const line = liveTrimLine(liveInput);
  const duty = trimDuty(liveInput);
  const dutyText = duty == null ? t(locale, "no shift on duty") : t(locale, duty === "day" ? "Day shift" : "Second Shift");
  const bogey = liveInput.bogeyPct ?? input.trim?.bogeyPct ?? BUD_PRODUCT_CELLS;
  const nowMs = Date.parse(liveInput.nowIso ?? input.trim?.nowIso ?? "");
  const weighedMs = input.lastWeighedAt ? Date.parse(input.lastWeighedAt) : NaN;
  let status: string;
  if (line.running) {
    status = `<span class="hc-running" data-hc-running>${esc(t(locale, "RUNNING"))}</span>`;
  } else if (Number.isFinite(weighedMs)) {
    const seconds = Number.isFinite(nowMs) ? Math.max(0, Math.floor((nowMs - weighedMs) / 1000)) : 0;
    status = `<span class="hc-trim-down" data-hc-trim-down>${esc(t(locale, "DOWN"))}</span> <span class="silo-clock" data-clock data-state="running" data-started="${weighedMs}" data-paused-at="" data-paused-seconds="0">${esc(formatClock(seconds))}</span>`;
  } else {
    status = `<span class="hc-trim-down" data-hc-trim-down>${esc(t(locale, "DOWN"))}</span>`;
  }
  return `<div class="hc-trim-rightnow" data-hc-trim-rightnow>
      <div class="hc-shift-head">
        <span class="hc-shift-name">${esc(t(locale, "Right now"))}</span>
        <span class="hc-date muted">${esc(input.today)}</span>
        <span class="muted" data-hc-trim-duty>${esc(dutyText)}</span>
        ${status}
      </div>
      ${trimLinePicture(line, locale, { totalLabel: "Line total", flowId: "now" })}
      ${btrBar(line.btr, bogey, locale)}
    </div>`;
}

/** THE TRIMMING SECTION (canon 0.30.310): Right now, then the two shift cards for the day picked, then the day's totals. */
export function trimmingSection(input: HarvestConsoleInput, locale: Locale = "en", open = true): string {
  const figures = trimFigures(input.trim ?? emptyTrimInput());
  const cards = figures.shifts.map((shift) => trimShiftCard(shift, input, locale)).join("");
  const unassigned =
    figures.unassignedGrams > 0
      ? `<p class="muted hc-note" data-hc-trim-unassigned>${esc(
          `${formatGrams(figures.unassignedGrams)} g ${t(locale, "on the day by operators on neither shift")}${
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
      ${trimRightNow(input, locale)}
      <div class="hc-shifts">${cards}</div>
      ${trimTotalsLine(figures, locale)}
      ${unassigned}${unassignedRunning}
      ${trimLineScript()}
    </details>`;
}

/* ------------------------------------------------------ the pasteurization */

/**
 * BRIEF V10, PASTEURIZATION ON THE CONSOLE (canon 0.30.334, re-based 0.30.335).
 * The owner's doc, its Pasteurization section, as the brief quotes it: a Right
 * now pane with a Rad half ("What is running in the Rad Source according to the
 * Rad Source Schedule", the wireframe cube icon throbbing green like a loading
 * silo while it runs, an inert green outline when empty, "Underneath Lot
 * numbers and a timer", the grey setting, how long it has been in there) and a
 * Cryo half ("What is running in the Cryo room according to the package count",
 * his picture of the metering box, CRYO, AMAPS and UV joined in burgundy that
 * "should show movement if the shift has weight on it. If it doesn't or hasn't
 * for thirty minutes, it should say "DOWN" and show that timer"; UV the SHA
 * since 6AM, Cryo the BUD and WPR plus Waste, AMAPS the BUD and WPR; the list
 * BUD, WPR, SHA, WASTE, TOTAL in lbs since 6AM), then two shift panes "like trim
 * (no equipment)" for the day picked: Bulk Bud, Prepack, Shake, Waste, Total,
 * Total Hours with Save, Lbs/DLH. His answers: the shifts use "Their own, new
 * fields"; "Bulk Bud = BUD, Prepack = WPR, Shake = SHA"; the waste is "Inputs
 * minus outputs at Finish run" (his pick, 2026-10-01): a run's waste is what
 * went in less what came out, counted on the day and shift the run is finished;
 * runs left open show no waste, and the pane says how many hold unentered
 * weight. The metering box has no name ("a complicated funnel/conveyor belt
 * referee"), so it carries no label and no number. THE FARM DAY BEGINS AT SIX
 * (canon 0.30.151): "since 6AM" is the farm day's start hour in data.
 */

export type PasteurizationShiftKey = TrimShiftKey;

/** One cryo output on the day: the category it was entered under (its package type code), its grams, the operator who typed it, and the instant it was entered. */
export type PasteurizationOutputRow = { type_code: string | null; weight_grams: number; cryo_operator: string | null; created_at?: string | null };

/** A cryo run finished within the window: the grams its inputs carried, the grams its live outputs carry, the operator of its last output (the shift its waste lands on), and the instant it finished. */
export type CryoFinishedRun = { run_id: string; in_grams: number; out_grams: number; last_operator: string | null; completed_at?: string | null };

/** A scheduled cryo run still open: once its first output is entered, its inputs above its outputs
 * is weight not yet entered out. A run with no output yet is queued, not held (his word at the V10
 * gate, canon 0.30.338: started runs only). */
export type CryoOpenRun = { run_id: string; in_grams: number; out_grams: number };

/** An output entered in the last PASTEURIZATION_RUNNING_MINUTES, any day: the operator who typed it (the shift it lights) and the instant. */
export type CryoRecentRow = { cryo_operator: string | null; created_at?: string | null };

export type PasteurizationInput = {
  /** The day's live cryo outputs (cryo_date = the day, or created within its bounds when the date is null). */
  outputs: PasteurizationOutputRow[];
  /** The cryo runs completed within the day's bounds (completed_at): his waste law. */
  finishedRuns: CryoFinishedRun[];
  /** The scheduled runs still open, for the Right now pane's muted line; never counted as waste. */
  openRuns?: CryoOpenRun[];
  /** The outputs entered lately, any day. */
  recent?: CryoRecentRow[];
  /** The trim type to category map (app_config cryo_type_categories): a type the list maps to WPR is Prepack. */
  typeCategories?: Map<string, string>;
  /** The operators of each shift (app_config pasteurization_shift_day_operators, pasteurization_shift_second_operators). */
  operators: Record<PasteurizationShiftKey, string[]>;
  /** The typed Total Hours per shift; null when none typed. */
  hours: Record<PasteurizationShiftKey, number | null>;
  /** The instant the figures are read at (the Eastern clock decides the shift on duty). */
  nowIso?: string;
  /** Each shift's hours, HH:MM-HH:MM Eastern (app_config pasteurization_shift_day_hours, pasteurization_shift_second_hours). */
  shiftHours?: Partial<Record<PasteurizationShiftKey, string | null>>;
  /** The farm day's start hour in data (6), the doc's "since 6AM". */
  startHour?: number;
};

export function emptyPasteurizationInput(): PasteurizationInput {
  return { outputs: [], finishedRuns: [], operators: { day: [], second: [] }, hours: { day: null, second: null } };
}

/** Inputs less outputs, above zero: a finished run's waste (his pick), or an
 * open run's weight not yet entered out. A run whose outputs exceed its inputs
 * reads 0 (two such runs stand on the floor). */
export function cryoRunLeft(run: { in_grams: number | string | null; out_grams: number | string | null }): number {
  const left = Number(run.in_grams ?? 0) - Number(run.out_grams ?? 0);
  return left > 0 ? left : 0;
}

type PastAcc = { packages: number; bud: number; prepack: number; shake: number; other: number; waste: number; finished: number; running: boolean };

function freshPast(): PastAcc {
  return { packages: 0, bud: 0, prepack: 0, shake: 0, other: 0, waste: 0, finished: 0, running: false };
}

/** The category an output reads as: its own code, or the category the type list maps it to (SMALLS reads as WPR). */
function cryoCategoryOf(type: string | null | undefined, categories: ReadonlyMap<string, string>): string {
  const key = String(type ?? "").trim().toUpperCase();
  return String(categories.get(key) ?? key).trim().toUpperCase();
}

function addCryoOutput(acc: PastAcc, category: string, grams: number): void {
  acc.packages += 1;
  if (category === "BUD") acc.bud += grams;
  else if (category === "WPR") acc.prepack += grams;
  else if (category === "SHA") acc.shake += grams;
  else acc.other += grams;
}

function pasteurizationWindows(input: PasteurizationInput): Record<PasteurizationShiftKey, string> {
  return {
    day: String(input.shiftHours?.day ?? "").trim() || PASTEURIZATION_SHIFT_HOURS_DEFAULT.day,
    second: String(input.shiftHours?.second ?? "").trim() || PASTEURIZATION_SHIFT_HOURS_DEFAULT.second,
  };
}

/** Which pasteurization shift the clock is inside, by the shifts' own windows, or null in a gap. Day wins when both hold. */
export function pasteurizationDuty(input: PasteurizationInput): PasteurizationShiftKey | null {
  const clock = input.nowIso ? etClockMinutes(input.nowIso) : null;
  if (clock == null) return null;
  const windows = pasteurizationWindows(input);
  if (shiftWindowHolds(parseShiftWindow(windows.day, PASTEURIZATION_SHIFT_HOURS_DEFAULT.day), clock)) return "day";
  if (shiftWindowHolds(parseShiftWindow(windows.second, PASTEURIZATION_SHIFT_HOURS_DEFAULT.second), clock)) return "second";
  return null;
}

export type PasteurizationShiftFigures = {
  key: PasteurizationShiftKey;
  label: string;
  operators: string[];
  /** The outputs entered on the day by this shift's operators. */
  packages: number;
  /** His Bulk Bud = BUD, grams. */
  budGrams: number;
  /** His Prepack = WPR, and any type the category list maps to WPR, grams. */
  prepackGrams: number;
  /** His Shake = SHA, grams. */
  shakeGrams: number;
  /** His Waste: inputs less outputs of the runs this shift finished on the day, grams. */
  wasteGrams: number;
  /** Outputs under a category off the three, grams: counted among the packages, not in the four. */
  otherGrams: number;
  /** His Total = the four summed (Bulk Bud, Prepack, Shake, Waste), grams. */
  totalGrams: number;
  /** How many runs this shift finished on the day. */
  finishedRuns: number;
  hours: number | null;
  /** Grams per direct labor hour, Total over the typed hours; null without hours. */
  gramsPerDlh: number | null;
  /** RUNNING: one of this shift's operators entered an output in the last 30 minutes. */
  running: boolean;
  /** The Eastern clock is inside this shift's hours. */
  onDuty: boolean;
  /** This shift's hours as read (HH:MM-HH:MM). */
  hours_window: string;
};

export type PasteurizationFigures = {
  shifts: PasteurizationShiftFigures[];
  /** Grams no list and no clock could place (no instant, or an instant outside both windows). */
  unassignedGrams: number;
  unassignedOperators: string[];
  /** RUNNING by a recent row with no listed operator and no instant: the line runs, no card can flash it. */
  unassignedRunning: boolean;
  /** Grams counted by the clock (an unlisted operator whose entry instant falls in a shift window) and those operators, sorted. */
  clockGrams: number;
  clockOperators: string[];
};

/** The shift whose window holds an Eastern clock, Day first when both hold. Blank or unparseable stays unset. */
function pasteurizationClockShift(input: PasteurizationInput, instant: string | null | undefined): PasteurizationShiftKey | undefined {
  const raw = String(instant ?? "").trim();
  if (!raw || !Number.isFinite(Date.parse(raw))) return undefined;
  const minutes = etClockMinutes(raw);
  const windows = pasteurizationWindows(input);
  if (shiftWindowHolds(parseShiftWindow(windows.day, PASTEURIZATION_SHIFT_HOURS_DEFAULT.day), minutes)) return "day";
  if (shiftWindowHolds(parseShiftWindow(windows.second, PASTEURIZATION_SHIFT_HOURS_DEFAULT.second), minutes)) return "second";
  return undefined;
}

/** The shift panes' figures for the day picked, pure: each output lands on the
 * shift whose list names its operator (case-insensitive, trimmed), and when no
 * list names the operator, on the shift whose window holds the Eastern clock of
 * its entry instant (a named operator wins over the clock). A finished run's
 * waste follows the same two steps from its last operator and its finish instant.
 * A row with no instant and no listed operator stays unassigned. Total is the
 * four summed; Lbs/DLH divides Total by the typed hours; RUNNING lights the
 * shift the same way, and a recent row with no instant lights the unassigned note. */
export function pasteurizationFigures(input: PasteurizationInput): PasteurizationFigures {
  const categories = input.typeCategories ?? parseCryoTypeCategories(null);
  const shiftOf = new Map<string, PasteurizationShiftKey>();
  for (const shift of PASTEURIZATION_SHIFTS) {
    for (const name of input.operators[shift.key] ?? []) shiftOf.set(name.trim().toLowerCase(), shift.key);
  }
  const keyOf = (operator: string | null | undefined): PasteurizationShiftKey | undefined => shiftOf.get(String(operator ?? "").trim().toLowerCase());
  const acc: Record<PasteurizationShiftKey, PastAcc> = { day: freshPast(), second: freshPast() };
  let unassignedGrams = 0;
  const unassigned = new Set<string>();
  let clockGrams = 0;
  const clockOperators = new Set<string>();
  const place = (operator: string, instant: string | null | undefined): { key: PasteurizationShiftKey | undefined; byClock: boolean } => {
    const listed = keyOf(operator);
    if (listed) return { key: listed, byClock: false };
    const byClock = pasteurizationClockShift(input, instant);
    if (byClock) return { key: byClock, byClock: true };
    return { key: undefined, byClock: false };
  };
  for (const o of input.outputs) {
    const grams = Number(o.weight_grams ?? 0);
    const operator = String(o.cryo_operator ?? "").trim();
    const placed = place(operator, o.created_at);
    if (!placed.key) {
      unassignedGrams += grams;
      if (operator) unassigned.add(operator);
      continue;
    }
    addCryoOutput(acc[placed.key], cryoCategoryOf(o.type_code, categories), grams);
    if (placed.byClock) {
      clockGrams += grams;
      if (operator) clockOperators.add(operator);
    }
  }
  for (const run of input.finishedRuns) {
    const waste = cryoRunLeft(run);
    const operator = String(run.last_operator ?? "").trim();
    const placed = place(operator, run.completed_at);
    if (!placed.key) {
      unassignedGrams += waste;
      if (operator && waste > 0) unassigned.add(operator);
      continue;
    }
    acc[placed.key].finished += 1;
    acc[placed.key].waste += waste;
    if (placed.byClock) {
      clockGrams += waste;
      if (operator && waste > 0) clockOperators.add(operator);
    }
  }
  let unassignedRunning = false;
  for (const r of input.recent ?? []) {
    const operator = String(r.cryo_operator ?? "").trim();
    const listed = keyOf(operator);
    if (listed) {
      acc[listed].running = true;
      continue;
    }
    const byClock = pasteurizationClockShift(input, r.created_at);
    if (byClock) {
      acc[byClock].running = true;
      continue;
    }
    if (!String(r.created_at ?? "").trim()) unassignedRunning = true;
  }
  const clock = input.nowIso ? etClockMinutes(input.nowIso) : null;
  const windows = pasteurizationWindows(input);
  const shifts = PASTEURIZATION_SHIFTS.map((shift) => {
    const a = acc[shift.key];
    const totalGrams = roundGrams(a.bud + a.prepack + a.shake + a.waste);
    const hours = input.hours[shift.key] ?? null;
    return {
      key: shift.key,
      label: shift.label,
      operators: input.operators[shift.key] ?? [],
      packages: a.packages,
      budGrams: roundGrams(a.bud),
      prepackGrams: roundGrams(a.prepack),
      shakeGrams: roundGrams(a.shake),
      wasteGrams: roundGrams(a.waste),
      otherGrams: roundGrams(a.other),
      totalGrams,
      finishedRuns: a.finished,
      hours,
      gramsPerDlh: hours != null && hours > 0 ? totalGrams / hours : null,
      running: a.running,
      onDuty: clock != null && shiftWindowHolds(parseShiftWindow(windows[shift.key], PASTEURIZATION_SHIFT_HOURS_DEFAULT[shift.key]), clock),
      hours_window: windows[shift.key],
    };
  });
  return {
    shifts,
    unassignedGrams: roundGrams(unassignedGrams),
    unassignedOperators: [...unassigned].sort(),
    unassignedRunning,
    clockGrams: roundGrams(clockGrams),
    clockOperators: [...clockOperators].sort(),
  };
}

export type PasteurizationLive = {
  /** The outputs entered since the day began, every operator. */
  packages: number;
  budGrams: number;
  prepackGrams: number;
  shakeGrams: number;
  /** The runs finished since the day began, inputs less outputs. */
  wasteGrams: number;
  otherGrams: number;
  /** BUD + WPR + SHA + WASTE. */
  totalGrams: number;
  /** His CRYO = BUD + WPR + WASTE. */
  cryoGrams: number;
  /** His AMAPS = BUD + WPR. */
  amapsGrams: number;
  /** His UV = SHA. */
  uvGrams: number;
  finishedRuns: number;
  /** The started scheduled runs (an output entered) holding inputs above their outputs, and those
   * remainders summed; a run not started is not counted (canon 0.30.338). */
  openRuns: number;
  openGrams: number;
  /** RUNNING: an output entered in the last 30 minutes by any operator, and nothing else. */
  running: boolean;
  /** The shift on the clock by the pasteurization windows, or null in a gap. */
  duty: PasteurizationShiftKey | null;
  hours_window: string;
};

/** THE RIGHT NOW PANE's cryo half, pure: today's outputs and finished runs,
 * every operator in one line (shift and date agnostic); RUNNING is an output
 * entered in the last 30 minutes and nothing else; the open runs' remainders
 * are shown as a line and never counted as waste, the started runs only (his
 * word at the V10 gate, canon 0.30.338: a run with no output yet is queued). */
export function livePasteurization(input: PasteurizationInput): PasteurizationLive {
  const categories = input.typeCategories ?? parseCryoTypeCategories(null);
  const a = freshPast();
  for (const o of input.outputs) addCryoOutput(a, cryoCategoryOf(o.type_code, categories), Number(o.weight_grams ?? 0));
  for (const run of input.finishedRuns) {
    a.finished += 1;
    a.waste += cryoRunLeft(run);
  }
  let openRuns = 0;
  let openGrams = 0;
  for (const run of input.openRuns ?? []) {
    if (!(Number(run.out_grams ?? 0) > 0)) continue;
    const left = cryoRunLeft(run);
    if (left <= 0) continue;
    openRuns += 1;
    openGrams += left;
  }
  const duty = pasteurizationDuty(input);
  const windows = pasteurizationWindows(input);
  return {
    packages: a.packages,
    budGrams: roundGrams(a.bud),
    prepackGrams: roundGrams(a.prepack),
    shakeGrams: roundGrams(a.shake),
    wasteGrams: roundGrams(a.waste),
    otherGrams: roundGrams(a.other),
    totalGrams: roundGrams(a.bud + a.prepack + a.shake + a.waste),
    cryoGrams: roundGrams(a.bud + a.prepack + a.waste),
    amapsGrams: roundGrams(a.bud + a.prepack),
    uvGrams: roundGrams(a.shake),
    finishedRuns: a.finished,
    openRuns,
    openGrams: roundGrams(openGrams),
    running: (input.recent ?? []).length > 0,
    duty,
    hours_window: duty ? windows[duty] : "",
  };
}

/** His cryo picture, drawn large in the trim line picture's manner: the metering
 * box top left with no label and no number (his answer: it has no name), CRYO
 * top right, AMAPS bottom left, UV bottom right; three flow bars of the trim
 * line's width joining CRYO to the box, the box down to AMAPS and CRYO down to
 * UV, in burgundy candy stripes (the plume's deep red and a darker band) that
 * move toward the next machine at the trim line's cadence while the line runs
 * and stand still otherwise. CRYO carries BUD + WPR + WASTE since the day began
 * with the day's package count under it, AMAPS BUD + WPR, UV SHA; pounds first,
 * grams under. */
export const CRYO_LINE_FLOW_MS = TRIM_LINE_FLOW_MS;

function cryoLineFlowPattern(id: string, axis: "x" | "y", to: number, running: boolean): string {
  const anim = running ? `<animate attributeName="${axis}" from="0" to="${to}" dur="${CRYO_LINE_FLOW_MS}ms" repeatCount="indefinite"/>` : "";
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="20" height="20"><rect class="hc-cryo-flow-b" width="20" height="20"/><polygon class="hc-cryo-flow-a" points="0,0 10,0 0,10"/><polygon class="hc-cryo-flow-a" points="20,0 20,10 10,20 0,20"/>${anim}</pattern>`;
}

export function cryoLinePicture(live: PasteurizationLive, locale: Locale = "en"): string {
  const lb = (grams: number) => `${formatLbs(grams)} lb`;
  const g = (grams: number) => `${formatGrams(roundGrams(grams))} g`;
  const w = TRIM_LINE_BAR_WIDTH;
  const left = "hc-cryo-flow-left";
  const down = "hc-cryo-flow-down";
  const packages = `${live.packages} ${t(locale, live.packages === 1 ? "package" : "packages")}`;
  const label = `${t(locale, "Cryo")} ${lb(live.cryoGrams)}`;
  return `<svg class="hc-cryoline" viewBox="0 0 1000 600" role="img" aria-label="${esc(label)}" data-hc-cryoline data-hc-cryoline-running="${live.running ? "1" : "0"}" data-hc-cryoline-cryo="${esc(String(live.cryoGrams))}">
      <defs>${cryoLineFlowPattern(left, "x", -20, live.running)}${cryoLineFlowPattern(down, "y", 20, live.running)}</defs>
      <g class="hc-flows" data-hc-flows>
        <rect class="hc-flow" data-hc-flow="cryo-meter" x="300" y="${145 - w / 2}" width="300" height="${w}" fill="url(#${left})"/>
        <rect class="hc-flow" data-hc-flow="meter-amaps" x="${190 - w / 2}" y="220" width="${w}" height="180" fill="url(#${down})"/>
        <rect class="hc-flow" data-hc-flow="cryo-uv" x="${770 - w / 2}" y="250" width="${w}" height="150" fill="url(#${down})"/>
      </g>
      <g class="hc-nodes">
        <rect class="hc-node" data-hc-node="meter" x="80" y="70" width="220" height="150"/>
        <rect class="hc-node" data-hc-node="cryo" x="600" y="40" width="340" height="210"/>
        <text class="hc-node-label" x="770" y="112">CRYO</text>
        <text class="hc-node-value" data-hc-node-value="cryo" x="770" y="156">${esc(lb(live.cryoGrams))}</text>
        <text class="hc-node-sub" x="770" y="190">${esc(`${g(live.cryoGrams)} · ${packages}`)}</text>
        <rect class="hc-node" data-hc-node="amaps" x="40" y="400" width="340" height="170"/>
        <text class="hc-node-label" x="210" y="462">AMAPS</text>
        <text class="hc-node-value" data-hc-node-value="amaps" x="210" y="506">${esc(lb(live.amapsGrams))}</text>
        <text class="hc-node-sub" x="210" y="540">${esc(g(live.amapsGrams))}</text>
        <rect class="hc-node" data-hc-node="uv" x="620" y="400" width="300" height="170"/>
        <text class="hc-node-label" x="770" y="462">UV</text>
        <text class="hc-node-value" data-hc-node-value="uv" x="770" y="506">${esc(lb(live.uvGrams))}</text>
        <text class="hc-node-sub" x="770" y="540">${esc(g(live.uvGrams))}</text>
      </g>
    </svg>`;
}

/** The Rad half: the running run alone (scheduled runs stay on the Rad
 * Schedule page). Running: the icon's strokes throb green like a loading silo
 * and under it the lot numbers, the package count, the grey and the timer from
 * started_at (V9.2's Start Time edits move it; the page's clock script ticks
 * it). Empty: the icon inert in the running green and the words Rad empty. */
function radNowPane(run: RadRunningView | null, nowIso: string | undefined, locale: Locale): string {
  const name = `<div class="hc-gate-name">${esc(t(locale, "Rad"))}</div>`;
  if (!run) {
    return `<div class="hc-past-half hc-past-rad" data-hc-rad data-hc-rad-state="empty">
          ${name}
          ${consoleIconSvg("rad", { label: t(locale, "Rad empty") })}
          <span class="muted" data-hc-rad-empty>${esc(t(locale, "Rad empty"))}</span>
        </div>`;
  }
  const startedMs = run.startedAt ? Date.parse(run.startedAt) : NaN;
  const nowMs = Date.parse(nowIso ?? "");
  const seconds = Number.isFinite(startedMs) && Number.isFinite(nowMs) ? Math.max(0, Math.floor((nowMs - startedMs) / 1000)) : 0;
  const count = run.packages.length;
  return `<div class="hc-past-half hc-past-rad" data-hc-rad data-hc-rad-state="running" data-hc-rad-run="${esc(run.id)}">
          ${name}
          ${consoleIconSvg("rad", { label: `${t(locale, "Rad")} ${t(locale, "RUNNING")}`, className: "hc-rad-throb" })}
          <div class="hc-rad-lots" data-hc-rad-lots>${esc(run.lots.join(", "))}</div>
          <span class="hc-sub" data-hc-rad-count>${esc(`${count} ${t(locale, count === 1 ? "package" : "packages")}`)}</span>
          <span class="hc-sub" data-hc-rad-grey>${esc(`${t(locale, "Grey (Gy)")} ${run.grey}`)}</span>
          <span class="silo-clock" data-clock data-state="running" data-started="${Number.isFinite(startedMs) ? startedMs : 0}" data-paused-at="" data-paused-seconds="0">${esc(formatClock(seconds))}</span>
        </div>`;
}

/** The Cryo half: the picture, and beside it the list BUD, WPR, SHA, WASTE,
 * TOTAL in lbs and grams since the day began, then the open runs' muted line. */
function cryoNowPane(live: PasteurizationLive, since: string, locale: Locale): string {
  const lb = (grams: number) => `${formatLbs(grams)} lb`;
  const g = (grams: number) => `${formatGrams(roundGrams(grams))} g`;
  const line = (key: string, label: string, grams: number) =>
    `<div class="hc-cryo-line" data-hc-cryo-line="${esc(key)}"><dt>${esc(label)}</dt><dd><span class="hc-value" data-hc="past_now_${esc(key.toLowerCase())}_lb">${esc(lb(grams))}</span><span class="hc-sub muted" data-hc="past_now_${esc(key.toLowerCase())}_g">${esc(g(grams))}</span></dd></div>`;
  const open =
    live.openRuns > 0
      ? `<p class="muted hc-note" data-hc-cryo-open data-hc-cryo-open-runs="${live.openRuns}" data-hc-cryo-open-grams="${esc(String(live.openGrams))}">${esc(
          tFill(locale, live.openRuns === 1 ? "{n} open run holds {lbs} lb not yet entered out" : "{n} open runs hold {lbs} lb not yet entered out", {
            n: String(live.openRuns),
            lbs: formatLbs(live.openGrams),
          })
        )}</p>`
      : "";
  return `<div class="hc-past-half hc-past-cryo" data-hc-cryo>
          ${cryoLinePicture(live, locale)}
          <div class="hc-cryo-side">
            <div class="hc-gate-name">${esc(t(locale, "Cryo"))} <span class="hc-date muted" data-hc-cryo-since="${esc(since)}">${esc(tFill(locale, "since {time}", { time: since }))}</span></div>
            <dl class="hc-cryo-list" data-hc-cryo-list>
              ${line("BUD", t(locale, "BUD"), live.budGrams)}
              ${line("WPR", "WPR", live.prepackGrams)}
              ${line("SHA", "SHA", live.shakeGrams)}
              ${line("WASTE", t(locale, "WASTE"), live.wasteGrams)}
              ${line("TOTAL", t(locale, "TOTAL"), live.totalGrams)}
            </dl>
            ${open}
          </div>
        </div>`;
}

/** THE RIGHT NOW PANE of the Pasteurization section: today's farm day, shift
 * and date agnostic, the head of the trim pane (the words Right now, today's
 * date, the pasteurization shift on the clock by its own windows, RUNNING or
 * DOWN with the timer from the last output ever entered), then the Rad half
 * and the Cryo half side by side (stacked on the phone). */
function pasteurizationRightNow(input: HarvestConsoleInput, locale: Locale): string {
  const liveInput = input.pasteurizationLive ?? emptyPasteurizationInput();
  const live = livePasteurization(liveInput);
  const dutyText = live.duty == null ? t(locale, "no shift on duty") : t(locale, live.duty === "day" ? "Day shift" : "Second Shift");
  const nowMs = Date.parse(liveInput.nowIso ?? "");
  const enteredMs = input.lastCryoOutputAt ? Date.parse(input.lastCryoOutputAt) : NaN;
  let status: string;
  if (live.running) {
    status = `<span class="hc-running" data-hc-running>${esc(t(locale, "RUNNING"))}</span>`;
  } else if (Number.isFinite(enteredMs)) {
    const seconds = Number.isFinite(nowMs) ? Math.max(0, Math.floor((nowMs - enteredMs) / 1000)) : 0;
    status = `<span class="hc-trim-down" data-hc-past-down>${esc(t(locale, "DOWN"))}</span> <span class="silo-clock" data-clock data-state="running" data-started="${enteredMs}" data-paused-at="" data-paused-seconds="0">${esc(formatClock(seconds))}</span>`;
  } else {
    status = `<span class="hc-trim-down" data-hc-past-down>${esc(t(locale, "DOWN"))}</span>`;
  }
  const startHour = liveInput.startHour ?? FARM_DAY_START_HOUR_DEFAULT;
  const since = `${String(Math.max(0, Math.min(23, startHour))).padStart(2, "0")}:00`;
  return `<div class="hc-past-rightnow" data-hc-past-rightnow data-hc-past-running="${live.running ? "1" : "0"}">
      <div class="hc-shift-head">
        <span class="hc-shift-name">${esc(t(locale, "Right now"))}</span>
        <span class="hc-date muted">${esc(input.today)}</span>
        <span class="muted" data-hc-past-duty>${esc(dutyText)}</span>
        ${status}
      </div>
      <div class="hc-past-halves">
        ${radNowPane(input.radRunning ?? null, liveInput.nowIso, locale)}
        ${cryoNowPane(live, since, locale)}
      </div>
    </div>`;
}

/** The five figures of a shift pane, in the doc's order, each the icon with the figure centered under it as the Testing gate panes do. */
const PASTEURIZATION_FIGURES: ReadonlyArray<{ key: string; icon: ConsoleIconName; label: string; pick: (shift: PasteurizationShiftFigures) => number }> = [
  { key: "bulk", icon: "bulk-bud", label: "Bulk Bud", pick: (shift) => shift.budGrams },
  { key: "prepack", icon: "prepack", label: "Prepack", pick: (shift) => shift.prepackGrams },
  { key: "shake", icon: "shake", label: "Shake", pick: (shift) => shift.shakeGrams },
  { key: "waste", icon: "waste", label: "Waste", pick: (shift) => shift.wasteGrams },
  { key: "total", icon: "total", label: "Total", pick: (shift) => shift.totalGrams },
];

function pasteurizationHoursBox(shift: PasteurizationShiftFigures, input: HarvestConsoleInput, locale: Locale): string {
  return `<form method="post" action="${esc(HARVEST_PASTEURIZATION_HOURS_PATH)}" class="hc-hours" data-hc-past-hours="${esc(shift.key)}">
              <input type="hidden" name="shift" value="${esc(shift.key)}">
              <input type="hidden" name="work_date" value="${esc(input.day)}">
              <input type="hidden" name="day_picked" value="${input.dayPicked ? "1" : ""}">
              <input type="number" name="hours" min="0" step="0.25" inputmode="decimal" value="${shift.hours == null ? "" : esc(String(shift.hours))}" placeholder="${esc(
                t(locale, "hours")
              )}" aria-label="${esc(`${t(locale, "Total Hours")} ${t(locale, shift.label)}`)}" data-hc-hours-input>
              <button type="submit" class="secondary">${esc(t(locale, "Save"))}</button>
            </form>`;
}

/** One shift's pane, like trim's card with no equipment and no bud: the head,
 * the five figures in a row, then Total Hours with its box and Lbs/DLH. */
function pasteurizationShiftCard(shift: PasteurizationShiftFigures, input: HarvestConsoleInput, locale: Locale): string {
  const figures = PASTEURIZATION_FIGURES.map((spec) => {
    const weight = weightPair(spec.pick(shift));
    return `<div class="hc-gate-pane hc-past-figure" data-hc-past-figure="${esc(spec.key)}">
            <div class="hc-gate-name">${esc(t(locale, spec.label))}</div>
            ${consoleIconSvg(spec.icon, { label: t(locale, spec.label) })}
            <span class="hc-value" data-hc="past_${esc(spec.key)}_lb">${esc(weight.value)}</span>
            <span class="hc-sub muted" data-hc="past_${esc(spec.key)}_g">${esc(weight.sub)}</span>
          </div>`;
  }).join("");
  const perDlh =
    shift.gramsPerDlh == null
      ? { value: shift.hours == null ? t(locale, "type hours") : NA, sub: "" }
      : { value: `${formatLbs(shift.gramsPerDlh)} lb/h`, sub: `${formatGrams(roundGrams(shift.gramsPerDlh))} g/h` };
  const operators = shift.operators.length ? shift.operators.join(", ") : t(locale, "no operators named");
  const running = shift.running ? `<span class="hc-running" data-hc-running>${esc(t(locale, "RUNNING"))}</span>` : "";
  return `<div class="hc-shift hc-past-shift" data-hc-past-shift="${esc(shift.key)}" data-hc-past-shift-grams="${esc(String(shift.totalGrams))}" data-hc-past-shift-running="${shift.running ? "1" : "0"}">
          <div class="hc-shift-head">
            <span class="hc-shift-name">${esc(t(locale, shift.label))}</span>
            <span class="hc-shift-ops muted" data-hc-past-operators>${esc(operators)}</span>
            <span class="hc-date muted">${esc(input.day)}</span>
            ${running}
          </div>
          <div class="hc-gate hc-past-figures" data-hc-past-figures>${figures}</div>
          <dl class="hc-metrics">
            <div class="hc-metric" data-hc-metric="past_hours"><dt>${esc(t(locale, "Total Hours"))}</dt><dd>${pasteurizationHoursBox(shift, input, locale)}</dd></div>
            <div class="hc-metric" data-hc-metric="past_lbs_per_dlh"><dt>${esc(t(locale, "Lbs/DLH"))}</dt><dd><span class="hc-value" data-hc="past_lbs_per_dlh">${esc(perDlh.value)}</span>${
              perDlh.sub ? `<span class="hc-sub muted">${esc(perDlh.sub)}</span>` : ""
            }</dd></div>
          </dl>
        </div>`;
}

/** THE BLUE THROB law for the cryo flows (canon 0.30.79): a reduced-motion setting slows the stripes instead of stilling them. */
function pasteurizationLineScript(): string {
  return `<script>(function(){try{if(!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))return;document.querySelectorAll(".hc-cryoline animate").forEach(function(a){a.setAttribute("dur","${CRYO_LINE_FLOW_MS * 2}ms");});}catch(e){}})();</script>`;
}

/** THE PASTEURIZATION SECTION (BRIEF V10, canon 0.30.334): Right now, then the
 * two shift panes for the day picked, then the notes. Open on a first visit;
 * the fold script remembers it after (canon 0.30.288). */
export function pasteurizationSection(input: HarvestConsoleInput, locale: Locale = "en", open = true): string {
  const figures = pasteurizationFigures(input.pasteurization ?? emptyPasteurizationInput());
  const cards = figures.shifts.map((shift) => pasteurizationShiftCard(shift, input, locale)).join("");
  const clock =
    figures.clockGrams > 0
      ? `<p class="muted hc-note" data-hc-past-clock>${esc(
          `${formatGrams(figures.clockGrams)} g ${t(locale, "on the day by operators on neither list, counted by the clock")}${
            figures.clockOperators.length ? `: ${figures.clockOperators.join(", ")}` : ""
          }. ${t(locale, "Name the shifts' operators in Admin, Lookups, app_config.")}`
        )}</p>`
      : "";
  const unassigned =
    figures.unassignedGrams > 0
      ? `<p class="muted hc-note" data-hc-past-unassigned>${esc(
          `${formatGrams(figures.unassignedGrams)} g ${t(locale, "on the day by operators on neither shift")}${
            figures.unassignedOperators.length ? `: ${figures.unassignedOperators.join(", ")}` : ""
          }. ${t(locale, "Name the shifts' operators in Admin, Lookups, app_config.")}`
        )}</p>`
      : "";
  const unassignedRunning = figures.unassignedRunning
    ? `<p class="muted hc-note" data-hc-past-running-unassigned><span class="hc-running">${esc(t(locale, "RUNNING"))}</span> ${esc(
        t(locale, "an output was entered in the last 30 minutes by an operator on neither shift.")
      )}</p>`
    : "";
  return `<details class="hc-section" data-hc-section="pasteurization"${open ? " open" : ""}>
      <summary>${esc(t(locale, "Pasteurization"))}</summary>
      ${pasteurizationRightNow(input, locale)}
      <div class="hc-shifts">${cards}</div>
      ${clock}${unassigned}${unassignedRunning}
      ${pasteurizationLineScript()}
    </details>`;
}

/** The day's live cryo outputs, dated by the typed cryo date (a row without one by its entry instant), the trim queries' shape. */
const PASTEURIZATION_OUTPUTS_SQL = `SELECT p.package_type_code AS type_code, p.weight_grams, p.cryo_operator, p.created_at
         FROM wip_packages p
         WHERE p.deleted_at IS NULL AND p.source = 'cryo'
           AND (p.cryo_date = ? OR (p.cryo_date IS NULL AND p.created_at >= ? AND p.created_at < ?))`;

/** A cryo run (an HBN-level production_schedules row, canon 0.30.110) with the grams its inputs carried, the grams its live outputs carry, and the operator of its last output. */
const CRYO_RUN_SUMS_SQL = `SELECT ps.id AS run_id, ps.completed_at,
                (SELECT COALESCE(SUM(i.weight_grams), 0) FROM cryo_run_inputs i WHERE i.run_id = ps.id) AS in_grams,
                (SELECT COALESCE(SUM(o.weight_grams), 0) FROM wip_packages o WHERE o.cryo_run_id = ps.id AND o.deleted_at IS NULL) AS out_grams,
                (SELECT o2.cryo_operator FROM wip_packages o2
                  WHERE o2.cryo_run_id = ps.id AND o2.deleted_at IS NULL
                  ORDER BY o2.created_at DESC, o2.id DESC LIMIT 1) AS last_operator
         FROM production_schedules ps
         WHERE ps.deleted_at IS NULL AND ps.stage = 'cryo' AND ps.wip_package_id IS NULL`;

/** His pick: the runs Finish run closed within the window. */
const CRYO_RUNS_FINISHED_SQL = `${CRYO_RUN_SUMS_SQL} AND ps.status = 'complete' AND ps.completed_at >= ? AND ps.completed_at < ?`;

/** The scheduled runs still open; the code keeps the started ones (an output entered) whose inputs stand above their outputs. */
const CRYO_RUNS_OPEN_SQL = `${CRYO_RUN_SUMS_SQL} AND ps.status = 'scheduled'`;

/* ---------------------------------------------------- the testing section */

/** Live cryo outputs. THE RAD run (V9) is the second way to be pasteurized
 * and lands beside this query, in isPasteurizedTag. */
export const PASTEURIZED_CRYO_SQL = `SELECT UPPER(package_code) AS tag, UPPER(COALESCE(package_type_code, '')) AS type,
            cryo_weight_grams, weight_grams
     FROM wip_packages
     WHERE deleted_at IS NULL AND source = 'cryo' AND TRIM(COALESCE(package_code, '')) <> ''`;

/** Tags on a completed Rad run. Reopen lifts the mark by leaving status complete. */
export const PASTEURIZED_RAD_SQL = `SELECT UPPER(p.tag) AS tag
     FROM rad_run_packages p
     JOIN rad_runs r ON r.id = p.run_id
     WHERE p.deleted_at IS NULL AND r.deleted_at IS NULL AND r.status = 'complete'`;

/** A tag is pasteurized when a live cryo output carries it, or a completed
 * Rad run does (canon 0.30.327). A reopened run is not complete, so its tags leave. */
export function isPasteurizedTag(
  tag: string | null | undefined,
  cryoTags: ReadonlySet<string>,
  radTags?: ReadonlySet<string>
): boolean {
  const key = String(tag ?? "").trim().toUpperCase();
  return key.length > 0 && (cryoTags.has(key) || (radTags != null && radTags.has(key)));
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

/** THE TESTING OVERRIDE (canon 0.30.341). The lot token names the harvest year:
 * the HBN's seventh segment (YY###, so 26001 is 2026), else the first segment's
 * two leading digits, else the Entered Testing year. None of the three, the row
 * is out of the season. */
export function sheetInSeason(row: { hbn: string | null; entered_testing: string | null }, year: number): boolean {
  const yy = year % 100;
  const parts = String(row.hbn ?? "").trim().split("-");
  const seventh = /^(\d{2})/.exec(parts.length >= 7 ? parts[6].trim() : "");
  if (seventh) return Number(seventh[1]) === yy;
  const first = /^(\d{2})/.exec((parts[0] ?? "").trim());
  if (first && (parts[0] ?? "").trim()) return Number(first[1]) === yy;
  const entered = /^(\d{4})/.exec(String(row.entered_testing ?? "").trim());
  if (entered) return Number(entered[1]) === year;
  return false;
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
  /** Tags on completed Rad runs. Absent reads as none. */
  rad?: ReadonlyArray<{ tag: string | null }>;
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
  const radTags = new Set<string>();
  for (const row of input.rad ?? []) {
    const tag = String(row.tag ?? "").trim().toUpperCase();
    if (tag) radTags.add(tag);
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
    if (!isPasteurizedTag(tag, cryoTags, radTags)) continue;
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
  return `<details class="hc-section" id="testing" data-hc-section="testing" data-hc-testing-year="${esc(String(opts.year))}" open>
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

/** The console sections. Plants, Trimming, Pasteurization, Testing, Prepack and Fulfillment start open. Drying starts closed. */
/** THE CONSOLE DAY: the date control, today by default, any day up to today. */
export function consoleDayControl(input: HarvestConsoleInput, locale: Locale): string {
  const state = input.dayPicked
    ? t(locale, "picked; the panes below read this day")
    : t(locale, "today so far; the panes below read today up to now");
  return `<form class="hc-day" method="get" action="${HARVEST_PATH}" data-hc-day>
      <label class="field">${esc(t(locale, "Day"))}
        <input type="date" name="day" value="${esc(input.day)}" max="${esc(input.today)}" data-hc-day-input onchange="this.form.submit()">
      </label>
      <span class="muted" data-hc-day-state>${esc(state)}</span>
      ${input.dayPicked ? `<a class="secondary" href="${HARVEST_PATH}" data-hc-day-reset>${esc(t(locale, "Back to today"))}</a>` : ""}
      <noscript><button type="submit" class="secondary">${esc(t(locale, "Show"))}</button></noscript>
      <span class="muted">${esc(t(locale, "Today is"))} ${esc(input.today)}; ${esc(t(locale, "the hours you type land on the day shown."))}</span>
    </form>`;
}

/** The query that keeps the picked day through a redirect; empty on the default. */
export function consoleDayQuery(input: { day: string; dayPicked: boolean }): string {
  return input.dayPicked ? `&day=${encodeURIComponent(input.day)}` : "";
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
        <input type="hidden" name="work_date" value="${esc(input.day)}">
        <input type="hidden" name="day_picked" value="${input.dayPicked ? "1" : ""}">
        <label class="field">${esc(t(locale, "DLH"))}
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
    page.ok === "hours" || page.ok === "trim_hours" || page.ok === "pasteurization_hours" || page.ok === "prepack_hours"
      ? `<p class="banner ok" data-hc-flash>${esc(t(locale, "Hours saved."))}</p>`
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
    ${pasteurizationSection(page.input, locale)}
    ${testingSection(page.testing ?? emptyTestingFigures(), {
      locale,
      year: page.input.year,
    })}
    ${prepackSection(page.prepack ?? emptyPrepack(page.input.day), page.input, locale)}
    ${fulfillmentSection(page.fulfillment ?? emptyFulfillment(), locale)}
    ${hoursScript()}${foldScript()}`;
}

/* ------------------------------------------------------------ the loaders */

/** The console's inputs from the floor. Every query is Postgres-portable SQL. */
/** THE CONSOLE DAY: the day the console reads. A blank, invalid, future or
 * equal-to-today pick reads today. Any real day before today is a pick. */
export function consoleDayOf(picked: string | null | undefined, today: string): { day: string; dayPicked: boolean } {
  const value = String(picked ?? "").trim();
  if (!value || !isCalendarDate(value) || value > today || value === today) return { day: today, dayPicked: false };
  return { day: value, dayPicked: true };
}

const OPEN_SQL = TEST_OPEN_STATUSES.map((status) => `'${status}'`).join(",");

/** THE TESTING GATE (canon 0.30.293). The four panes read the live mirror and
 * the desk's open orders. The stats and the pie read the season's first-time
 * rows on the In Testing sheet. The console's picked day is not an input. */
export async function loadTestingSection(db: D1Database, year: number): Promise<TestingFigures> {
  const rndRaw = await getConfigValue(db, CONFIG_KEYS.in_testing_rnd_tab);
  const rndLike = `${(rndRaw ?? "").trim() || "R&D"}|%`;
  const [typesRaw, unitsRaw, mirror, cryo, rad, orders, sheet, batches] = await Promise.all([
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
    db.prepare(PASTEURIZED_RAD_SQL).all<{ tag: string }>(),
    db
      .prepare(
        `SELECT id, UPPER(COALESCE(source_package_tag, '')) AS tag, status, batch_grams
         FROM test_orders
         WHERE deleted_at IS NULL AND status IN (${OPEN_SQL})`
      )
      .all<{ id: string; tag: string; status: string; batch_grams: number | null }>(),
    db
      .prepare(
        `SELECT e.strain, e.hbn, e.entered_testing, e.status, e.failure_mode, e.batch_weight_grams, e.attempt
         FROM external_test_results e
         WHERE e.deleted_at IS NULL AND e.attempt = 1
           AND (e.source <> 'sheet' OR e.on_sheet = 1)
           AND NOT EXISTS (
             SELECT 1 FROM test_orders o
             WHERE o.deleted_at IS NULL AND o.sheet_key = e.sheet_key AND o.panel = 'rnd'
           )
           AND (e.sheet_key IS NULL OR e.sheet_key NOT LIKE ?)`
      )
      .bind(rndLike)
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
    rad: rad.results ?? [],
    orders: orders.results ?? [],
    sheet: sheet.results ?? [],
    marketByHbn,
  });
}

export async function loadHarvestConsole(db: D1Database, atIso: string, pickedDay: string | null = null): Promise<HarvestConsoleInput> {
  // THE FARM DAY BEGINS AT SIX (canon 0.30.151): today and the day under view are farm days.
  const startHour = parseFarmDayStartHour(await getConfigValue(db, CONFIG_KEYS.farm_day_start_hour));
  const today = farmDay(atIso, startHour);
  const { day, dayPicked } = consoleDayOf(pickedDay, today);
  const year = Number(today.slice(0, 4));
  const bounds = farmDayBounds(day, startHour);
  const todayBounds = farmDayBounds(today, startHour);
  // THE TRIM LINE PICTURE (canon 0.30.154): RUNNING is a package weighed in the last 30 minutes.
  const recentSince = new Date(Date.parse(atIso) - TRIM_RUNNING_MINUTES * 60_000).toISOString();
  // BRIEF V10 (canon 0.30.334), his thirty: the cryo line RUNS on an output entered in the last 30 minutes.
  const cryoRecentSince = new Date(Date.parse(atIso) - PASTEURIZATION_RUNNING_MINUTES * 60_000).toISOString();
  const [
    remaining,
    seasonHarvested,
    seasonLots,
    dayWet,
    yearWet,
    hoursRows,
    trimPackages,
    trimHoursRows,
    btrRaw,
    dayOpsRaw,
    secondOpsRaw,
    finishedRows,
    recentRows,
    typeCatsRaw,
    queueRow,
    dayHoursRaw,
    secondHoursRaw,
    bogeyRaw,
    plantCountRows,
    livePackages,
    liveFinished,
    lastWeighed,
    pastOutputs,
    pastLiveOutputs,
    pastFinished,
    pastLiveFinished,
    pastOpenRuns,
    pastRecent,
    lastCryoOutput,
    pastDayOpsRaw,
    pastSecondOpsRaw,
    pastDayHoursRaw,
    pastSecondHoursRaw,
    pastHoursRows,
    radRunning,
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
      .prepare(
        `SELECT b.farm_code AS farm, COALESCE(SUM(x.weight_grams), 0) AS wet_grams
         FROM wet_weights x
         JOIN wet_weight_entries w ON w.id = x.wet_weight_entry_id AND w.deleted_at IS NULL
         JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
         WHERE x.deleted_at IS NULL AND b.harvest_year = ?
         GROUP BY b.farm_code`
      )
      .bind(year)
      .all<FarmGrams>(),
    db
      .prepare(`SELECT farm_code, hours FROM harvest_labor_hours WHERE work_date = ?`)
      .bind(day)
      .all<{ farm_code: string; hours: number }>(),
    // THE TRIMMING SECTION (canon 0.30.88): the console day's trim room packages,
    // dated by the typed trim date (a row without one by its entry instant).
    db
      .prepare(
        `SELECT p.package_type_code AS type_code, p.weight_grams, p.trim_operator
         FROM wip_packages p
         WHERE p.deleted_at IS NULL AND ${NON_TRIM_SOURCE_SQL}
           AND (p.trim_date = ? OR (p.trim_date IS NULL AND p.created_at >= ? AND p.created_at < ?))`
      )
      .bind(day, bounds.startIso, bounds.endIso)
      .all<TrimPackageRow>(),
    db.prepare(`SELECT shift, hours FROM trim_labor_hours WHERE work_date = ?`).bind(day).all<{ shift: string; hours: number }>(),
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
    // THE TRIM BOGEY (canon 0.30.249): the plume's product line, Admin, Lookups.
    getConfigValue(db, CONFIG_KEYS.trim_bogey_pct),
    db
      .prepare(`SELECT farm_code, plant_count FROM farm_plant_counts WHERE harvest_year = ? AND deleted_at IS NULL`)
      .bind(year)
      .all<{ farm_code: string; plant_count: number }>(),
    db
      .prepare(
        `SELECT p.package_type_code AS type_code, p.weight_grams, p.trim_operator
         FROM wip_packages p
         WHERE p.deleted_at IS NULL AND ${NON_TRIM_SOURCE_SQL}
           AND (p.trim_date = ? OR (p.trim_date IS NULL AND p.created_at >= ? AND p.created_at < ?))`
      )
      .bind(today, todayBounds.startIso, atIso)
      .all<TrimPackageRow>(),
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
      .bind(todayBounds.startIso, atIso)
      .all<TrimFinishedLot>(),
    db
      .prepare(`SELECT MAX(p.created_at) AS weighed_at FROM wip_packages p WHERE p.deleted_at IS NULL AND ${NON_TRIM_SOURCE_SQL}`)
      .first<{ weighed_at: string | null }>(),
    // BRIEF V10, PASTEURIZATION ON THE CONSOLE (canon 0.30.334): the day's cryo
    // outputs and today's, the runs Finish run closed in each window (his pick:
    // waste is inputs less outputs, counted when the run is finished), the open
    // runs' remainders, the outputs entered lately, the last output ever entered,
    // the shifts' own operators and windows, the typed hours, and the run in the Rad.
    db.prepare(PASTEURIZATION_OUTPUTS_SQL).bind(day, bounds.startIso, bounds.endIso).all<PasteurizationOutputRow>(),
    db.prepare(PASTEURIZATION_OUTPUTS_SQL).bind(today, todayBounds.startIso, atIso).all<PasteurizationOutputRow>(),
    db.prepare(CRYO_RUNS_FINISHED_SQL).bind(bounds.startIso, bounds.endIso).all<CryoFinishedRun>(),
    db.prepare(CRYO_RUNS_FINISHED_SQL).bind(todayBounds.startIso, atIso).all<CryoFinishedRun>(),
    db.prepare(CRYO_RUNS_OPEN_SQL).all<CryoOpenRun>(),
    db
      .prepare(`SELECT p.cryo_operator, p.created_at FROM wip_packages p WHERE p.deleted_at IS NULL AND p.source = 'cryo' AND p.created_at >= ?`)
      .bind(cryoRecentSince)
      .all<CryoRecentRow>(),
    db
      .prepare(`SELECT MAX(p.created_at) AS entered_at FROM wip_packages p WHERE p.deleted_at IS NULL AND p.source = 'cryo'`)
      .first<{ entered_at: string | null }>(),
    getConfigValue(db, CONFIG_KEYS.pasteurization_shift_day_operators),
    getConfigValue(db, CONFIG_KEYS.pasteurization_shift_second_operators),
    getConfigValue(db, CONFIG_KEYS.pasteurization_shift_day_hours),
    getConfigValue(db, CONFIG_KEYS.pasteurization_shift_second_hours),
    db.prepare(`SELECT shift, hours FROM pasteurization_labor_hours WHERE work_date = ?`).bind(day).all<{ shift: string; hours: number }>(),
    loadRadRunning(db),
  ]);
  const trimHours: Record<TrimShiftKey, number | null> = { day: null, second: null };
  for (const row of trimHoursRows.results ?? []) {
    if (row.shift === "day" || row.shift === "second") trimHours[row.shift] = Number(row.hours);
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
    recent: (recentRows.results ?? []).map((r) => ({ trim_operator: r.trim_operator })),
    queueLots: Number(queueRow?.n ?? 0),
    queueGrams: Number(queueRow?.grams ?? 0),
    nowIso: atIso,
    shiftHours: { day: dayHoursRaw, second: secondHoursRaw },
    bogeyPct: parseTrimBogey(bogeyRaw),
  };
  const trimLive: TrimInput = {
    packages: (livePackages.results ?? []).map((r) => ({
      type_code: r.type_code,
      weight_grams: Number(r.weight_grams ?? 0),
      trim_operator: r.trim_operator,
    })),
    budCodes: trim.budCodes,
    operators: trim.operators,
    hours: { day: null, second: null },
    prepackCodes: trim.prepackCodes,
    finishedLots: (liveFinished.results ?? []).map((r) => ({
      lot_id: r.lot_id,
      dry_grams: r.dry_grams == null ? null : Number(r.dry_grams),
      recorded_grams: Number(r.recorded_grams ?? 0),
      last_operator: r.last_operator,
    })),
    recent: trim.recent,
    queueLots: trim.queueLots,
    queueGrams: trim.queueGrams,
    nowIso: atIso,
    shiftHours: trim.shiftHours,
    bogeyPct: trim.bogeyPct,
  };
  const hours = {} as Record<ConsoleFarm, number | null>;
  for (const farm of CONSOLE_FARMS) hours[farm] = null;
  let harvestHoursAll: number | null = null;
  for (const row of hoursRows.results ?? []) {
    if (row.farm_code === "ALL") harvestHoursAll = Number(row.hours);
    else {
      const farm = farmOf(row.farm_code);
      if (farm) hours[farm] = Number(row.hours);
    }
  }
  const plantCounts = {} as Record<ConsoleFarm, number | null>;
  for (const farm of CONSOLE_FARMS) plantCounts[farm] = null;
  for (const row of plantCountRows.results ?? []) {
    const farm = farmOf(row.farm_code);
    if (farm) plantCounts[farm] = Number(row.plant_count);
  }
  // BRIEF V10 (canon 0.30.334): the pasteurization inputs, the day picked and today so far.
  const pastHours: Record<PasteurizationShiftKey, number | null> = { day: null, second: null };
  for (const row of pastHoursRows.results ?? []) {
    if (row.shift === "day" || row.shift === "second") pastHours[row.shift] = Number(row.hours);
  }
  const pastOutputRows = (rows: { results?: PasteurizationOutputRow[] }): PasteurizationOutputRow[] =>
    (rows.results ?? []).map((r) => ({ type_code: r.type_code, weight_grams: Number(r.weight_grams ?? 0), cryo_operator: r.cryo_operator, created_at: r.created_at ?? null }));
  const pastRunRows = (rows: { results?: CryoFinishedRun[] }): CryoFinishedRun[] =>
    (rows.results ?? []).map((r) => ({
      run_id: r.run_id,
      in_grams: Number(r.in_grams ?? 0),
      out_grams: Number(r.out_grams ?? 0),
      last_operator: r.last_operator,
      completed_at: r.completed_at ?? null,
    }));
  const pasteurization: PasteurizationInput = {
    outputs: pastOutputRows(pastOutputs),
    finishedRuns: pastRunRows(pastFinished),
    recent: (pastRecent.results ?? []).map((r) => ({ cryo_operator: r.cryo_operator, created_at: r.created_at ?? null })),
    typeCategories: parseCryoTypeCategories(typeCatsRaw),
    operators: { day: parseNameList(pastDayOpsRaw), second: parseNameList(pastSecondOpsRaw) },
    hours: pastHours,
    nowIso: atIso,
    shiftHours: { day: pastDayHoursRaw, second: pastSecondHoursRaw },
    startHour,
  };
  const pasteurizationLive: PasteurizationInput = {
    outputs: pastOutputRows(pastLiveOutputs),
    finishedRuns: pastRunRows(pastLiveFinished),
    openRuns: (pastOpenRuns.results ?? []).map((r) => ({ run_id: r.run_id, in_grams: Number(r.in_grams ?? 0), out_grams: Number(r.out_grams ?? 0) })),
    recent: pasteurization.recent,
    typeCategories: pasteurization.typeCategories,
    operators: pasteurization.operators,
    hours: { day: null, second: null },
    nowIso: atIso,
    shiftHours: pasteurization.shiftHours,
    startHour,
  };
  return {
    today,
    day,
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
    dayWet: (dayWet.results ?? []).map((r) => ({ farm: r.farm, wet_grams: Number(r.wet_grams ?? 0) })),
    yearWet: (yearWet.results ?? []).map((r) => ({ farm: r.farm, wet_grams: Number(r.wet_grams ?? 0) })),
    hours,
    harvestHoursAll,
    plantCounts,
    trim,
    trimLive,
    lastWeighedAt: lastWeighed?.weighed_at ?? null,
    pasteurization,
    pasteurizationLive,
    lastCryoOutputAt: lastCryoOutput?.entered_at ?? null,
    radRunning,
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
  const rawFarm = textOrNull(form.get("farm"));
  const farm = rawFarm === "ALL" ? "ALL" : farmOf(rawFarm);
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

/** BRIEF V10 (canon 0.30.334): save (or clear) one pasteurization shift's Total
 * Hours for one day, as the trim DLH is saved; the change lands in
 * record_change_log under pasteurization_labor_hours. */
export async function savePasteurizationHours(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actorId = textOrNull(form.get("person_id"));
  const shiftRaw = textOrNull(form.get("shift"));
  const shift = PASTEURIZATION_SHIFTS.find((s) => s.key === shiftRaw)?.key;
  if (!shift) throw new HttpError(400, "Pick a shift.");
  const workDate = textOrNull(form.get("work_date")) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !Number.isFinite(Date.parse(`${workDate}T00:00:00.000Z`))) {
    throw new HttpError(400, "Work date must be YYYY-MM-DD.");
  }
  const hours = parseHours(textOrNull(form.get("hours")));
  const ts = nowIso();
  const existing = await db
    .prepare(`SELECT id, hours FROM pasteurization_labor_hours WHERE work_date = ? AND shift = ?`)
    .bind(workDate, shift)
    .first<{ id: string; hours: number }>();
  const log = (id: string, oldValue: string | null, newValue: string | null) =>
    insertLog(db, {
      record_table: "pasteurization_labor_hours",
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
      stmts.push(db.prepare(`DELETE FROM pasteurization_labor_hours WHERE id = ?`).bind(existing.id), log(existing.id, String(existing.hours), null));
    }
  } else if (existing) {
    if (Number(existing.hours) !== hours) {
      stmts.push(
        db.prepare(`UPDATE pasteurization_labor_hours SET hours = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(hours, ts, actorId, existing.id),
        log(existing.id, String(existing.hours), String(hours))
      );
    }
  } else {
    const id = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO pasteurization_labor_hours (id, work_date, shift, hours, created_at, created_by, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, workDate, shift, hours, ts, actorId, ts, actorId),
      log(id, null, String(hours))
    );
  }
  if (stmts.length) await db.batch(stmts);
  return { redirect: `${HARVEST_PATH}?ok=pasteurization_hours${textOrNull(form.get("day_picked")) ? `&day=${encodeURIComponent(workDate)}` : ""}` };
}
