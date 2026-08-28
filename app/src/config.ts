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
  drying: "drying",
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

export const DRY_SPACE_KINDS = ["silo", "hang"] as const;

export const SYSTEM_REASON = {
  create: "create",
  queue_control: "queue control",
  cryo_weight: "cryo weight entry",
  release: "release",
} as const;

/** Mint format: YYDDD-farm-grow_code-strain_code-manicure-silo-YY */
export const HBN_MINT_FORMAT =
  "<YYDDD>-<farm>-<grow_code>-<strain_code>-<manicure>-<silo>-<YY>";
export const HBN_BLANK_SILO = "NA";

/** is_bud routing: BUD types enter the Cryo Queue; all others stay created. */
export function initialWipStatus(isBud: number): string {
  return isBud === 1 ? WIP_STATUS.cryo_queue : WIP_STATUS.created;
}

export type TransitionName =
  | "harvest_complete"
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

export function roundGrams(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isTestOutcome(value: string): value is TestOutcome {
  return (TEST_OUTCOMES as readonly string[]).includes(value);
}
