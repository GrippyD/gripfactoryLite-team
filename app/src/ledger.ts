/**
 * Local inventory ledger helpers. Item kinds are lookup-backed data, never a
 * closed TypeScript enum. Qty and location changes always carry a reason.
 */

import {
  ITEM_KIND_SPR,
  ITEM_KIND_WIP,
  barnLocationForSite,
  growLicenseForFarm,
  LICENSE_AU_GROW,
  LICENSE_AU_PROCESSOR,
  LOC_BARN,
  LOC_CSB,
  LOC_IN_TRANSIT,
  isGrowSideLocation,
  isPickableProcessorDestination,
  isProcessorSideLocation,
  kindMintedOnFinish,
  itemKindSortKey,
  LANDING_FARM,
  roundGrams,
  shortLotId,
} from "./config";

export type LocalInventoryItem = {
  id: string;
  item_kind: string;
  package_code: string;
  harvest_batch_id: string | null;
  wet_weight_entry_id: string | null;
  wip_package_id: string | null;
  strain_id: string | null;
  qty: number;
  uom: string;
  farm_code: string;
  license_value: string;
  location: string;
  created_at: string;
  strain_name?: string | null;
  farm_name?: string | null;
  location_label?: string | null;
};

/** SQL CASE for the owner's list order: WIP, then SPR, then FG, then unknown. */
export function itemKindOrderSql(alias = ""): string {
  const col = alias ? `${alias}.item_kind` : "item_kind";
  return `CASE ${col} WHEN 'WIP' THEN 0 WHEN 'SPR' THEN 1 WHEN 'FG' THEN 2 ELSE 3 END`;
}

export const ITEM_KIND_ORDER_SQL = itemKindOrderSql();

export function sortInventoryItems<T extends { item_kind: string; created_at: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    const ka = itemKindSortKey(a.item_kind);
    const kb = itemKindSortKey(b.item_kind);
    if (ka !== kb) return ka - kb;
    return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
  });
}

export function mintKindForSpace(drySpaceKind: string): string | null {
  return kindMintedOnFinish(drySpaceKind);
}

export function buckedPackageCode(shortId: string): string {
  return `${shortId}-B`;
}

/** Owner ruling 2026-09-07 (canon 0.28.8): a truck can arrive already bucked in
 * the field, so the receive asks. Spear mints SPR, bucked mints WIP, the same
 * kind law the unload fork carries; anything else refuses. */
export function receiveMintKind(materialForm: string): string | null {
  if (materialForm === "spear") return ITEM_KIND_SPR;
  if (materialForm === "bucked") return ITEM_KIND_WIP;
  return null;
}

export function lotPackageCode(hbn: string, metrcHarvestTag: string | null | undefined): string {
  return shortLotId(hbn, metrcHarvestTag);
}

export type MintInput = {
  wetWeightEntryId: string;
  harvestBatchId: string;
  strainId: string | null;
  farmCode: string;
  spaceKind: string;
  spaceName: string;
  wetTotal: number;
  hbn: string;
  metrcHarvestTag: string | null;
  licenseValue?: string | null;
  /** Canon 0.29.1: spear or bucked, set at wet weigh-in; drives the birth kind. */
  materialForm?: string | null;
  /** THE TAG LAW (canon 0.30.38): the METRC package tag typed at Finish lot,
   * optional; normalized by the caller; null keeps the internal code alone. */
  metrcTag?: string | null;
};

export type MintPlan =
  | { action: "none" }
  | {
      action: "insert";
      /** Optional preset id so the caller can reference the newborn item (the
       * med hop and the truck manifest need it); minted fresh when absent. */
      id?: string;
      item_kind: string;
      package_code: string;
      metrc_tag: string | null;
      qty: number;
      uom: "g";
      farm_code: string;
      license_value: string;
      location: string;
      harvest_batch_id: string;
      wet_weight_entry_id: string;
      strain_id: string | null;
    }
  | { action: "update"; itemId: string; qty: number; metrc_tag?: string | null };

/** THE BIRTH LAW (owner rulings 2026-09-07, canon 0.30.1 forks 1 to 3, on the
 * seven-step spine): the harvest package is born at Finish lot for EVERY Move
 * To kind, trucks included, in the farm's BARN under the batch license (the
 * plant-tag license; med stays med at birth and the equivalent transfer hops
 * it in the same step). The kind is the lot's material form (canon 0.29.1:
 * spear SPR, bucked WIP); the old space-kind map retires from this plan.
 * Re-finish updates qty only. */
export function planFinishMint(
  input: MintInput,
  existing: { id: string } | null
): MintPlan {
  const qty = roundGrams(input.wetTotal);
  const metrcTag = input.metrcTag ?? null;
  if (existing) {
    // A re-finish updates the grams; a tag typed this time lands too (the
    // earlier one stands when the box was left blank).
    return metrcTag
      ? { action: "update", itemId: existing.id, qty, metrc_tag: metrcTag }
      : { action: "update", itemId: existing.id, qty };
  }
  const kind = receiveMintKind(input.materialForm ?? "spear") ?? ITEM_KIND_SPR;
  // THE BLANK SLATE (canon 0.30.108; owner: "assume everything that get's
  // entered into wet weights is landing in PNN's barn location"; his pick: 832
  // at birth): every package is born in PNN's barn under PNN's grow license,
  // whatever the HBN's farm or license. The HBN's farm rides on farm_code for
  // the console's windows; the batch license is METRC's business until his
  // real manifest lands.
  void input.licenseValue;
  return {
    action: "insert",
    item_kind: kind,
    package_code: lotPackageCode(input.hbn, input.metrcHarvestTag),
    metrc_tag: metrcTag,
    qty,
    uom: "g",
    farm_code: input.farmCode,
    license_value: growLicenseForFarm(LANDING_FARM),
    location: barnLocationForSite(LANDING_FARM),
    harvest_batch_id: input.harvestBatchId,
    wet_weight_entry_id: input.wetWeightEntryId,
    strain_id: input.strainId,
  };
}

export type UnloadFinishMode = "spear" | "bucked" | "silo";

export type UnloadFinishPlan =
  | {
      mode: "silo";
      parentQty: number;
      location: typeof LOC_BARN;
      mintChild: false;
      pendKind: "package_adjust";
      delta: number;
    }
  | {
      mode: "bucked";
      parentQty: number;
      childQty: number;
      childPackageCode: string;
      childKind: typeof ITEM_KIND_WIP;
      mintChild: true;
      location: typeof LOC_BARN;
      pendKind: "package_from_harvest";
    }
  | {
      mode: "spear";
      parentQty: number;
      location: typeof LOC_BARN | "stage_interco";
      mintChild: false;
      pendKind: "package_adjust";
      delta: number;
      requireTruck: boolean;
    };

export function planUnloadFinish(input: {
  spaceKind: string;
  weighMode: string | null;
  buckedOnSite: "yes" | "no" | null;
  parentQty: number;
  dryTotal: number;
  shortId: string;
}): UnloadFinishPlan {
  const dry = roundGrams(input.dryTotal);
  const parent = roundGrams(input.parentQty);
  if (input.spaceKind === "silo") {
    return {
      mode: "silo",
      parentQty: dry,
      location: LOC_BARN,
      mintChild: false,
      pendKind: "package_adjust",
      delta: roundGrams(dry - parent),
    };
  }
  if (input.weighMode === "bucked") {
    return {
      mode: "bucked",
      parentQty: roundGrams(parent - dry),
      childQty: dry,
      childPackageCode: buckedPackageCode(input.shortId),
      childKind: ITEM_KIND_WIP,
      mintChild: true,
      location: LOC_BARN,
      pendKind: "package_from_harvest",
    };
  }
  const stage = input.buckedOnSite === "no";
  return {
    mode: "spear",
    parentQty: dry,
    location: stage ? "stage_interco" : LOC_BARN,
    mintChild: false,
    pendKind: "package_adjust",
    delta: roundGrams(dry - parent),
    requireTruck: stage,
  };
}

/** to_processor lands the picked processor-side location (CSB when omitted).
 * to_grow always lands BARN. */
export function virtualMoveLanding(
  direction: "to_processor" | "to_grow",
  destLocation?: string
): { license: string; location: string } {
  if (direction === "to_processor") {
    const dest = destLocation && isPickableProcessorDestination(destLocation) ? destLocation : LOC_CSB;
    return { license: LICENSE_AU_PROCESSOR, location: dest };
  }
  return { license: LICENSE_AU_GROW, location: LOC_BARN };
}

export function processorSideLocations<T extends { value: string }>(rows: T[]): T[] {
  return rows.filter((row) => isPickableProcessorDestination(row.value));
}

export { isGrowSideLocation, isProcessorSideLocation };

export function outboundEligible(item: {
  item_kind: string;
  location: string;
  onBuildingMovement: boolean;
}): boolean {
  if (item.onBuildingMovement) return false;
  if (item.location === LOC_IN_TRANSIT) return false;
  return item.item_kind === ITEM_KIND_SPR || item.item_kind === ITEM_KIND_WIP;
}

export { ITEM_KIND_SPR, ITEM_KIND_WIP, LICENSE_AU_GROW, LOC_BARN, LOC_CSB, LOC_IN_TRANSIT };
