/**
 * Future config-table candidates (canon L-4).
 * These values translate raw records into displayed text or routed status.
 * When a later box needs them editable in-app, lift each block into a lookup table.
 */

export const THEMES = ["grip", "c10"] as const;
export type ThemeName = (typeof THEMES)[number];

export const HARVEST_STATUS = {
  open: "open",
  complete: "complete",
} as const;

export const LOT_STATUS = {
  weighing: "weighing",
  drying: "drying",
  in_transit: "in_transit",
  trimmed: "trimmed",
} as const;

export const WIP_STATUS = {
  created: "created",
  cryo_queue: "cryo_queue",
  testing_queue: "testing_queue",
  released: "released",
} as const;

/** Release outcomes for the Testing Queue. Small editable list, currently code. */
export const TEST_OUTCOMES = ["passed", "failed", "other"] as const;
export type TestOutcome = (typeof TEST_OUTCOMES)[number];

export const DRY_SPACE_KINDS = ["silo", "hang", "truck"] as const;

/** Owner ruling 2026-08-28: which dry space kinds each farm may Move To.
 * PNN gains hang for its farm-scoped Hang in Place row.
 * Values-in-data candidate (canon L-4); unknown farms fall back to all kinds. */
export const MOVE_TO_KINDS_BY_FARM: Record<string, readonly string[]> = {
  ARL: ["hang", "truck"],
  PNS: ["truck"],
  PNN: ["silo", "truck", "hang"],
};

export function moveToKindsForFarm(farmCode: string): readonly string[] {
  return MOVE_TO_KINDS_BY_FARM[farmCode] ?? DRY_SPACE_KINDS;
}

export const SYSTEM_REASON = {
  create: "create",
  queue_control: "queue control",
  cryo_weight: "cryo weight entry",
  release: "release",
  finish_lot: "finish lot",
} as const;

/** Mint format: YYDDD-farm-grow_code-strain_code-manicure-silo-YY### */
export const HBN_MINT_FORMAT =
  "<YYDDD>-<farm>-<grow_code>-<strain_code>-<manicure>-<silo>-<YY###>";
export const HBN_BLANK_SILO = "NA";

/** is_bud routing: BUD types enter the Cryo Queue; all others stay created. */
export function initialWipStatus(isBud: number): string {
  return isBud === 1 ? WIP_STATUS.cryo_queue : WIP_STATUS.created;
}

export type TransitionName =
  | "harvest_complete"
  | "lot_finished_drying"
  | "lot_finished_in_transit"
  | "lot_trimmed"
  | "cryo_weighed"
  | "released";

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
  lot_trimmed: {
    entity: "wet_weight_entries",
    from: LOT_STATUS.drying,
    to: LOT_STATUS.trimmed,
  },
  cryo_weighed: {
    entity: "wip_packages",
    from: WIP_STATUS.cryo_queue,
    to: WIP_STATUS.testing_queue,
  },
  released: {
    entity: "wip_packages",
    from: WIP_STATUS.testing_queue,
    to: WIP_STATUS.released,
  },
};

export function applyTransition(name: TransitionName, currentStatus: string): string {
  const spec = STATUS_TRANSITIONS[name];
  if (currentStatus !== spec.from) {
    throw new Error(
      `Cannot apply ${name}: status is ${currentStatus}, expected ${spec.from}.`
    );
  }
  return spec.to;
}

/** Owner ruling 2026-08-28: Finish lot routes by the destination kind.
 * Trucks go in transit; every other kind dries. */
export function finishTransitionName(drySpaceKind: string): TransitionName {
  return drySpaceKind === "truck" ? "lot_finished_in_transit" : "lot_finished_drying";
}

export function roundGrams(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Sum gram values that are already rounded to 2 decimals; cents math avoids float drift. */
export function sumGrams(values: readonly number[]): number {
  let cents = 0;
  for (const value of values) cents += Math.round(value * 100);
  return cents / 100;
}

/** Trucks are dry_spaces rows named "Truck N"; the next number is 1 past the highest taken. */
export function nextTruckNumber(names: readonly string[]): number {
  let max = 0;
  for (const name of names) {
    const match = /^Truck (\d+)$/.exec(name.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

export function isTestOutcome(value: string): value is TestOutcome {
  return (TEST_OUTCOMES as readonly string[]).includes(value);
}
