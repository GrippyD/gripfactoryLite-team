/**
 * METRC reconciliation gate (canon 0.19.0). Delta in, gate choices out.
 * Unload Finish uses this now; the trim rework's Finish Parent picks it up
 * later (same helper, same choice ids). Overissue is FLAG, never block.
 */

import { formatGrams, roundGrams } from "./config";

export type ReconcileMode = "spear" | "bucked" | "silo";

export type ReconcileChoiceId = "queue_adjust" | "queue_finish" | "nothing" | "back";

export type ReconcileChoice = {
  id: ReconcileChoiceId;
  /** Spear moisture adjust is already the automatic Package Adjustments CSV. */
  alreadyQueued?: boolean;
};

export type ReconcileKind = "over" | "under" | "exact";

export type ReconcileGate = {
  kind: ReconcileKind;
  /** recorded minus parent qty (positive = over issue). RAW grams. */
  delta: number;
  absDelta: number;
  choices: ReconcileChoice[];
};

/** Build the gate from a recorded total and the parent package qty. */
export function reconcileGate(input: {
  recorded: number;
  parentQty: number;
  mode: ReconcileMode;
}): ReconcileGate {
  const recorded = roundGrams(input.recorded);
  const parentQty = roundGrams(input.parentQty);
  const delta = roundGrams(recorded - parentQty);
  if (delta === 0) {
    return { kind: "exact", delta: 0, absDelta: 0, choices: [] };
  }
  // Owner ruling 2026-09-07 (canon 0.30.1 fork 7, verbatim: "Remove from the
  // app for now, we'll rethink this one.  It's a significant thing to do in
  // METRC which is why he's calling it out.  It's not something that should be
  // done casually which is what the tool implies."): the Finish-package-in-
  // METRC choice is GONE from every gate. The adjustment CSV is the corrective
  // lane on both sides of the delta.
  if (delta > 0) {
    const adjust: ReconcileChoice =
      input.mode === "spear"
        ? { id: "queue_adjust", alreadyQueued: true }
        : { id: "queue_adjust" };
    return {
      kind: "over",
      delta,
      absDelta: delta,
      choices: [adjust, { id: "nothing" }, { id: "back" }],
    };
  }
  return {
    kind: "under",
    delta,
    absDelta: roundGrams(-delta),
    choices: [{ id: "queue_adjust" }, { id: "nothing" }, { id: "back" }],
  };
}

export function isReconcileChoice(value: string | null | undefined): value is ReconcileChoiceId {
  return value === "queue_adjust" || value === "nothing" || value === "back";
}

/** Display grams for a gate headline (comma-grouped). */
export function reconcileDeltaLabel(absDelta: number): string {
  return formatGrams(absDelta);
}
