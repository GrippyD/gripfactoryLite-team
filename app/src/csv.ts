import { metrcLocationName, metrcQuantity } from "./config";
import { FARM_DAY_START_HOUR_DEFAULT, farmDay } from "./farmday";

/** RFC 4180 reader. Returns rows of cells; the first row is headers when present.
 * SM1 (canon 0.30.554): each cell is sliced from the text rather than built one
 * character at a time. The rules are the old reader's exactly (a quote opens or
 * closes anywhere in a cell, "" inside quotes is one quote, a CR outside quotes
 * is dropped, a blank line is no row), and the memory is a small multiple of
 * the file: the char by char reader needed about 20 times it, 640 MB for a
 * 24 MB Zoho export, past the Worker's 128 MB (the live 1102 of 2026-10-27). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let parts: string[] = [];
  let seg = 0;
  let quoted = false;
  const n = src.length;
  let i = 0;
  const take = (end: number) => {
    if (end > seg) parts.push(src.slice(seg, end));
  };
  const cellDone = (): string => {
    const cell = parts.length === 0 ? "" : parts.length === 1 ? parts[0] : parts.join("");
    parts = [];
    return cell;
  };
  while (i < n) {
    const ch = src.charCodeAt(i);
    if (quoted) {
      if (ch === 34) {
        take(i);
        if (src.charCodeAt(i + 1) === 34) {
          parts.push('"');
          i += 2;
          seg = i;
          continue;
        }
        quoted = false;
        i += 1;
        seg = i;
        continue;
      }
      i += 1;
      continue;
    }
    if (ch === 34) {
      take(i);
      quoted = true;
      i += 1;
      seg = i;
      continue;
    }
    if (ch === 44) {
      take(i);
      row.push(cellDone());
      i += 1;
      seg = i;
      continue;
    }
    if (ch === 10) {
      take(i);
      row.push(cellDone());
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      i += 1;
      seg = i;
      continue;
    }
    if (ch === 13) {
      take(i);
      i += 1;
      seg = i;
      continue;
    }
    i += 1;
  }
  if (quoted) throw new Error("CSV quote was not closed.");
  take(n);
  const last = cellDone();
  if (last !== "" || row.length > 0) {
    row.push(last);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

export function csvObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const rec: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) rec[headers[c] ?? `col_${c}`] = rows[r][c] ?? "";
    out.push(rec);
  }
  return out;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function queueRowsToCsv(
  columns: Array<{ field: string; label: string }>,
  rows: Array<{ id: string; values: Record<string, string> }>
): string {
  const records = rows.map((row) => {
    const rec: Record<string, unknown> = { id: row.id };
    for (const col of columns) rec[col.field] = row.values[col.field] ?? "";
    return rec;
  });
  return toCsv(records);
}

/** Owner ruling 2026-08-31: [Pending Data Uploads] carries one METRC CSV format
 * per data type; this is the wet weights format's header, METRC's exactly,
 * no spaces. */
export const METRC_WET_WEIGHTS_HEADER =
  "Plant,Weight,UnitOfWeight,DryingLocation,DryingSublocation,HarvestName,PatientLicenseNumber,ActualDate";

/** Vendored Packages from Harvests header, byte for byte. */
export const METRC_PACKAGES_FROM_HARVESTS_HEADER =
  "Tag,Location,Sublocation,Item,UnitOfWeight,PatientLicenseNumber,Note,ProductionBatchNumber,IsTradeSample,IsDonation,ActualDate,IngredientHarvestName,IngredientWeight,IngredientUnitOfWeight";

/** Vendored Package Adjustments header, byte for byte. */
export const METRC_PACKAGE_ADJUSTMENTS_HEADER =
  "Label,Quantity,UnitOfMeasure,AdjustmentReason,ReasonNote,AdjustmentDate,EmployeeLicenseNumber";

export type PackageFromHarvestCsvRow = {
  tag: string;
  location: string;
  item: string;
  actualDate: string;
  harvestName: string;
  harvestWeight: number;
};

export function packagesFromHarvestsCsv(rows: PackageFromHarvestCsvRow[]): string {
  const lines = [METRC_PACKAGES_FROM_HARVESTS_HEADER];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.tag),
        csvCell(metrcLocationName(row.location)),
        "",
        csvCell(row.item),
        "Grams",
        "",
        "",
        "",
        "",
        "",
        csvCell(row.actualDate),
        csvCell(row.harvestName),
        metrcQuantity(Number(row.harvestWeight)).toFixed(2),
        "Grams",
      ].join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

export type PackageAdjustCsvRow = {
  label: string;
  quantity: number;
  adjustmentDate: string;
};

export function packageAdjustmentsCsv(rows: PackageAdjustCsvRow[]): string {
  const lines = [METRC_PACKAGE_ADJUSTMENTS_HEADER];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.label),
        metrcQuantity(Number(row.quantity)).toFixed(2),
        "Grams",
        "Drying",
        "Moisture loss",
        csvCell(row.adjustmentDate),
        "",
      ].join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

/** One METRC row per non-voided wet_weights scale read on a finished lot. */
export type WetWeightsCsvRow = {
  weight_grams: number;
  /** The lot's destination display; a truck lot renders Truck <truck_number>. */
  dry_space_name: string | null;
  truck_number: string | null;
  /** Owner terms law 2026-08-31: the HBN is the METRC harvest name. */
  hbn: string;
  /** The lot's updated_at; kept for older callers. ActualDate prefers effective_date. */
  entry_updated_at: string;
  effective_date?: string | null;
  created_at?: string | null;
  /** THE PLANT COUNT (canon 0.30.62): the lot id and its typed plant count,
   * carried so the count split can pair each entry with its scale reads. */
  entry_id?: string;
  plant_count?: number | null;
};

/** ONE HARVEST FILE PER LOAD (canon 0.30.249): <HBN>(n).csv, a lone load included. */
export function wetWeightsFilename(hbn: string, seq = 1): string {
  return `${hbn}(${seq}).csv`;
}

/** The HBN with its load number, for the load's other files. */
export function hbnWithSeq(hbn: string, seq: number | null | undefined): string {
  return `${hbn}(${seq && seq > 0 ? seq : 1})`;
}

/** Owner ruling 2026-08-31: the Plant fill rule needs a stable seed per batch;
 * FNV-1a 32-bit over the batch id keys the PRNG, so repeated downloads of the
 * same batch replay the identical stream. */
function hashSeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Owner ruling 2026-08-31: the Plant fill rule's PRNG, a tiny mulberry32;
 * deterministic for a fixed seed, uniform in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Owner ruling 2026-08-31: the Plant fill rule's allocation law. Tags spread
 * across the batch's finished entries proportional to entry weight, largest
 * remainder so the counts sum exactly to tagCount (remainder ties break to the
 * earlier entry). When tagCount covers every entry that has weight, each such
 * entry gets at least one tag (taken from the largest holders); with fewer
 * tags than entries the smallest entries may get none. Zero-weight entries
 * get none; the degenerate all-zero batch falls back to round robin. */
export function allocateTagCounts(
  entryWeightsGrams: readonly number[],
  tagCount: number
): number[] {
  const cents = entryWeightsGrams.map((g) => Math.round(g * 100));
  const counts = new Array<number>(cents.length).fill(0);
  if (cents.length === 0 || tagCount <= 0) return counts;
  let totalCents = 0;
  for (const c of cents) totalCents += c;
  if (totalCents <= 0) {
    for (let i = 0; i < tagCount; i++) counts[i % cents.length] += 1;
    return counts;
  }
  const remainders = cents.map((c, i) => {
    const quota = (tagCount * c) / totalCents;
    counts[i] = Math.floor(quota);
    return { i, rem: quota - Math.floor(quota) };
  });
  remainders.sort((a, b) => b.rem - a.rem || a.i - b.i);
  let leftover = tagCount;
  for (const c of counts) leftover -= c;
  for (let k = 0; leftover > 0; k = (k + 1) % remainders.length) {
    counts[remainders[k].i] += 1;
    leftover -= 1;
  }
  const weighted = cents.map((c, i) => ({ c, i })).filter((e) => e.c > 0);
  if (tagCount >= weighted.length) {
    for (const e of weighted) {
      if (counts[e.i] > 0) continue;
      // Steal one from the entry holding the most tags (ties: earliest); the
      // donor keeps at least one, so pigeonhole always finds one here.
      let donor = -1;
      for (let j = 0; j < counts.length; j++) {
        if (counts[j] > 1 && (donor === -1 || counts[j] > counts[donor])) donor = j;
      }
      if (donor === -1) break;
      counts[donor] -= 1;
      counts[e.i] += 1;
    }
  }
  return counts;
}

/** Owner ruling 2026-08-31: the Plant fill rule, verbatim: "We use randbetween
 * in excel right now where the weight per plant is nominally the same, but the
 * data looks organic. The total of each randbetween value must combine to the
 * actual total wet grams weighed." The split law, all math in cents:
 * allocateTagCounts hands each entry its tag count; within an entry each tag
 * draws a whole-cent weight uniformly from the band around the equal base
 * (entry total / count), plus or minus jitterPct percent, floored at one cent
 * (0.01); then single cents nudge round robin inside the band until the group
 * sums EXACTLY to the entry's total, so the grand total is exactly the wet
 * total. Pathological tiny totals (an entry holding fewer cents than tags, or
 * a band the total cannot reach) fall out of the band: the exact-sum law wins
 * and the second pass adjusts regardless, floored at zero, so some tags may
 * render 0.00. Deterministic: the PRNG seeds from seedKey (the batch id) and
 * is consumed in entry-then-tag order. Returns one grams array per entry,
 * parallel to entryWeightsGrams; the flat length is tagCount. */
export function splitPlantWeights(
  entryWeightsGrams: readonly number[],
  tagCount: number,
  jitterPct: number,
  seedKey: string
): number[][] {
  const counts = allocateTagCounts(entryWeightsGrams, tagCount);
  const rand = mulberry32(hashSeed(seedKey));
  const j = Number.isFinite(jitterPct) && jitterPct >= 0 ? jitterPct : 10;
  return entryWeightsGrams.map((grams, idx) => {
    const k = counts[idx];
    if (k === 0) return [];
    const totalCents = Math.round(grams * 100);
    const base = totalCents / k;
    const lo = Math.max(1, Math.ceil(base * (1 - j / 100)));
    const hi = Math.max(lo, Math.floor(base * (1 + j / 100)));
    const weights: number[] = [];
    for (let i = 0; i < k; i++) {
      weights.push(lo + Math.floor(rand() * (hi - lo + 1)));
    }
    let residual = totalCents;
    for (const w of weights) residual -= w;
    // First pass: nudge single cents round robin inside the band.
    while (residual !== 0) {
      let moved = false;
      for (let i = 0; i < k && residual !== 0; i++) {
        if (residual > 0 && weights[i] < hi) {
          weights[i] += 1;
          residual -= 1;
          moved = true;
        } else if (residual < 0 && weights[i] > lo) {
          weights[i] -= 1;
          residual += 1;
          moved = true;
        }
      }
      if (!moved) break;
    }
    // Second pass, pathological tiny totals only: the band cannot hold the
    // exact total, and the exact-sum law wins over the band and the 0.01
    // floor, so adjust regardless (never below zero).
    while (residual !== 0) {
      let moved = false;
      for (let i = 0; i < k && residual !== 0; i++) {
        if (residual > 0) {
          weights[i] += 1;
          residual -= 1;
          moved = true;
        } else if (weights[i] > 0) {
          weights[i] -= 1;
          residual += 1;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return weights.map((c) => c / 100);
  });
}

/** ActualDate is the load's effective date, else the farm day of its created_at. */
export function wetActualDate(row: WetWeightsCsvRow, startHour = FARM_DAY_START_HOUR_DEFAULT): string {
  const effective = String(row.effective_date ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(effective)) return effective.slice(0, 10);
  const created = String(row.created_at ?? row.entry_updated_at ?? "");
  return created ? farmDay(created, startHour) : "";
}

export function wetWeightsCsv(rows: WetWeightsCsvRow[], barnLocation?: string): string {
  const lines = [METRC_WET_WEIGHTS_HEADER];
  for (const row of rows) {
    // Owner ruling 2026-08-31: Plant stays EMPTY, one row per scale read, until
    // the owner rules how to fill it (no plant tags exist in our data yet);
    // DryingSublocation is ALWAYS empty ("We use null sublocations");
    // PatientLicenseNumber stays empty too.
    // Owner ruling 2026-09-07 (canon 0.30.1, spine step 3): the harvest lives
    // in BARN at the plant-tag license; the silo or truck is a later move.
    // The physical space stays the fallback when no barn is passed.
    const dryingLocation =
      barnLocation ?? (row.truck_number ? `Truck ${row.truck_number}` : row.dry_space_name ?? "");
    // Owner ruling 2026-08-31: ActualDate is the lot's finish date, provisionally
    // the date part of its updated_at until a dedicated finish timestamp exists.
    const actualDate = wetActualDate(row);
    lines.push(
      [
        "",
        metrcQuantity(Number(row.weight_grams)).toFixed(2),
        "Grams",
        csvCell(metrcLocationName(dryingLocation)),
        "",
        csvCell(row.hbn),
        "",
        csvCell(actualDate),
      ].join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

/** Owner ruling 2026-08-31: the Plant fill rule. With plant tags saved on the
 * batch the file carries ONE ROW PER TAG instead of per scale read: the tags
 * spread across the finished entries (one WetWeightsCsvRow per entry, its
 * weight_grams the entry's wet total) by splitPlantWeights, and each tag row
 * rides its entry's DryingLocation and ActualDate exactly as the read rows do,
 * the HBN as the HarvestName, sublocation and patient empty, Grams. Weights
 * stay RAW 2-decimal, never comma grouped; the grand total is exactly the wet
 * total by the split law. */
/** THE PLANT COUNT (owner ruling 2026-09-14, canon 0.30.62, verbatim: "The total
 * divided by the number of plants with each record weight randomized but
 * totalling the correct total is what we need for the CSV that goes into
 * METRC"): with no plant tags pasted, a lot that carries a plant count writes
 * one row per plant, Plant EMPTY (the tags are filled in later), its wet total
 * split across the count by the same seeded jitter law as the tag split (exact
 * total kept, the lot id in the seed so re-downloads reproduce the file); a lot
 * without a count keeps its scale reads, one row each, as before. Entries and
 * reads pair by entry_id. */
export function wetWeightsCsvWithCounts(
  entries: WetWeightsCsvRow[],
  reads: WetWeightsCsvRow[],
  jitterPct: number,
  seedKey: string,
  barnLocation?: string
): string {
  const lines = [METRC_WET_WEIGHTS_HEADER];
  const rowFor = (entry: WetWeightsCsvRow, grams: number): string => {
    const dryingLocation =
      barnLocation ?? (entry.truck_number ? `Truck ${entry.truck_number}` : entry.dry_space_name ?? "");
    const actualDate = wetActualDate(entry);
    return ["", grams.toFixed(2), "Grams", csvCell(metrcLocationName(dryingLocation)), "", csvCell(entry.hbn), "", csvCell(actualDate)].join(",");
  };
  for (const entry of entries) {
    const count = Number(entry.plant_count ?? 0);
    if (Number.isInteger(count) && count >= 1) {
      const [split] = splitPlantWeights([metrcQuantity(Number(entry.weight_grams))], count, jitterPct, `${seedKey}:${entry.entry_id ?? ""}`);
      for (const grams of split) lines.push(rowFor(entry, grams));
    } else {
      for (const read of reads) {
        if (read.entry_id !== entry.entry_id) continue;
        lines.push(rowFor(read, metrcQuantity(Number(read.weight_grams))));
      }
    }
  }
  return lines.join("\r\n") + "\r\n";
}

/** True when any finished lot of the batch carries a plant count (the count
 * split applies; pasted tags still win over it). */
export function anyPlantCount(entries: readonly WetWeightsCsvRow[]): boolean {
  return entries.some((e) => Number.isInteger(Number(e.plant_count ?? 0)) && Number(e.plant_count ?? 0) >= 1);
}

export function wetWeightsCsvWithTags(
  entries: WetWeightsCsvRow[],
  tags: readonly string[],
  jitterPct: number,
  seedKey: string,
  barnLocation?: string
): string {
  const splits = splitPlantWeights(
    entries.map((entry) => metrcQuantity(Number(entry.weight_grams))),
    tags.length,
    jitterPct,
    seedKey
  );
  const lines = [METRC_WET_WEIGHTS_HEADER];
  let next = 0;
  entries.forEach((entry, i) => {
    // Canon 0.30.1 spine step 3: the harvest lives in BARN at the plant-tag
    // license; the physical space stays the fallback when no barn is passed.
    const dryingLocation =
      barnLocation ?? (entry.truck_number ? `Truck ${entry.truck_number}` : entry.dry_space_name ?? "");
    const actualDate = wetActualDate(entry);
    for (const grams of splits[i]) {
      lines.push(
        [
          csvCell(tags[next]),
          grams.toFixed(2),
          "Grams",
          csvCell(metrcLocationName(dryingLocation)),
          "",
          csvCell(entry.hbn),
          "",
          csvCell(actualDate),
        ].join(",")
      );
      next += 1;
    }
  });
  return lines.join("\r\n") + "\r\n";
}
