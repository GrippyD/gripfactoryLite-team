/**
 * FG1: FG inventory on the Harvest Console, right after Fulfillment.
 * Zoho listings that are live are sorted by the item name's first segment and
 * the Zoho category. TRI and SHA are METRC's live Shake/Trim packages.
 * Nothing here calls Zoho or METRC, and the ledger is not read.
 */
import { format2, formatGrams, GRAMS_PER_LB, round2 } from "./config";
import { etClockMinutes, etDate } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { esc } from "./ui";

/** WBP, WIP, WPR, Biomass and FFZ are never a category. */
export const FG_NOT_FINISHED = ["WBP", "WIP", "WPR", "Biomass", "FFZ"] as const;

/**
 * Folded into a standing category. No line of their own.
 * MIX and NUG are last year's bud. MOB is the 2025 max-out bag (70 g).
 */
export const FG_FOLDED_PREFIXES = [
  { prefix: "MIX", category: "bud" },
  { prefix: "NUG", category: "bud" },
  { prefix: "MOB", category: "pre", eachGrams: 70 },
] as const;

/** A PRE ounce when the row does not carry each_grams. */
export const FG_PRE_EACH_GRAMS = 28;

/**
 * FG3 caps, in each category's own unit (app pounds at 448 g, liters, grams).
 * TRI turns red at the cap. The others turn red only above it.
 */
export const FG_CAPS = {
  tri: 40000,
  sha: 5000,
  distillate: 2000,
  isolate: 68000,
  infused: 20000,
} as const;

/** One truck of trim, in app pounds. */
export const FG_TRUCK_LB = 8000;

const FG_CAP_KEYS = ["tri", "sha", "distillate", "isolate", "infused"] as const;
type FgCapKey = (typeof FG_CAP_KEYS)[number];

function isCap(key: FgCatKey): key is FgCapKey {
  return key === "tri" || key === "sha" || key === "distillate" || key === "isolate" || key === "infused";
}

/** Round half up. 6.5 trucks is 7. */
export function fgTruckCount(pounds: number): number {
  return Math.round(pounds / FG_TRUCK_LB);
}

/**
 * BUD bands on the listing's THC. 20.00 through 24.99 is 20 to 25.
 * 25.00 through 29.99 is 25 to 30. A missing THC is its own band.
 */
export function budThcBand(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "no THC";
  if (pct <= 19.99) return "19.99% or less";
  if (pct < 25) return "20 to 25%";
  if (pct < 30) return "25 to 30%";
  return "30% and up";
}

export const FG_LISTINGS_SQL = `SELECT item_name, category, market_uom, market_qty, qty_grams, each_grams, thc_pct, zoho_mounted_at
FROM listings
WHERE deleted_at IS NULL
  AND zoho_status = 'Active'
  AND (
    (market_qty IS NOT NULL AND market_qty > 0)
    OR (qty_grams IS NOT NULL AND qty_grams > 0)
  )`;

/**
 * Shake/Trim prefixes that are not finished goods: biomass (BIO, Biomass) and
 * the FG_NOT_FINISHED prefixes. They stay out of TRI and SHA entirely.
 */
export const FG_METRC_NOT_FINISHED = FG_NOT_FINISHED.filter((code) => code !== "Biomass").map((code) => code.toUpperCase());
const FG_METRC_NOT_FINISHED_SQL = FG_METRC_NOT_FINISHED.map((code) => `'${code}'`).join(", ");

/**
 * One grouped read of live Shake/Trim packages, every license.
 * SHA before the first " - " is SHAKE. Biomass and the not finished prefixes
 * stay out. Every other prefix is TRIM.
 * Grams as is (g, gram, grams), kilograms times 1000 (kg, kilogram,
 * kilograms), pounds times METRC's pound 453.59237 (lb, lbs, pound, pounds).
 * Any other unit is counted and left out of the grams.
 * Strain is item_strain when set, else the item name's second " - " field.
 * THC is the latest compliance sample on the tag, else the latest internal test.
 */
export const FG_LEDGER_SQL = `WITH live AS (
  SELECT
    m.tag AS tag,
    m.quantity AS quantity,
    LOWER(TRIM(COALESCE(m.uom, ''))) AS uom,
    UPPER(TRIM(
      CASE
        WHEN instr(COALESCE(m.item, ''), ' - ') > 0 THEN substr(m.item, 1, instr(m.item, ' - ') - 1)
        ELSE COALESCE(m.item, '')
      END
    )) AS prefix,
    COALESCE(
      NULLIF(TRIM(COALESCE(m.item_strain, '')), ''),
      NULLIF(TRIM(
        CASE
          WHEN instr(COALESCE(m.item, ''), ' - ') = 0 THEN ''
          ELSE
            CASE
              WHEN instr(substr(m.item, instr(m.item, ' - ') + 3), ' - ') = 0
              THEN substr(m.item, instr(m.item, ' - ') + 3)
              ELSE substr(
                substr(m.item, instr(m.item, ' - ') + 3),
                1,
                instr(substr(m.item, instr(m.item, ' - ') + 3), ' - ') - 1
              )
            END
        END
      ), '')
    ) AS strain_name
  FROM metrc_packages m
  WHERE m.gone_at IS NULL
    AND m.category = 'Shake/Trim'
    AND m.quantity > 0
),
weighed AS (
  SELECT
    tag,
    CASE WHEN prefix = 'SHA' THEN 'SHAKE' ELSE 'TRIM' END AS type_code,
    COALESCE(strain_name, '') AS strain_name,
    CASE
      WHEN uom IN ('g', 'gram', 'grams') THEN quantity
      WHEN uom IN ('kg', 'kilogram', 'kilograms') THEN quantity * 1000
      WHEN uom IN ('lb', 'lbs', 'pound', 'pounds') THEN quantity * 453.59237
      ELSE NULL
    END AS grams
  FROM live
  WHERE prefix NOT IN (${FG_METRC_NOT_FINISHED_SQL})
),
rated AS (
  SELECT
    w.type_code AS type_code,
    w.strain_name AS strain_name,
    COALESCE(
      (SELECT c.thc_potency_pct
       FROM lab_compliance_samples c
       WHERE c.voided_at IS NULL
         AND c.thc_potency_pct IS NOT NULL
         AND UPPER(c.source_metrc_tag) = UPPER(w.tag)
       ORDER BY COALESCE(c.finished_testing_on, c.changed_at) DESC
       LIMIT 1),
      (SELECT t.thc_pct
       FROM lab_internal_tests t
       WHERE t.voided_at IS NULL
         AND t.thc_pct IS NOT NULL
         AND UPPER(t.metrc_tag) = UPPER(w.tag)
       ORDER BY COALESCE(t.tested_at, t.changed_at) DESC
       LIMIT 1)
    ) AS thc_pct,
    w.grams AS grams
  FROM weighed w
  WHERE w.grams IS NOT NULL
)
SELECT
  g.type_code AS type_code,
  g.strain_name AS strain_name,
  g.thc_pct AS thc_pct,
  g.grams AS grams,
  meta.other_units AS other_units,
  meta.mounted_at AS mounted_at
FROM (
  SELECT
    (SELECT COUNT(*) FROM weighed WHERE grams IS NULL) AS other_units,
    (SELECT MAX(created_at) FROM metrc_mounts WHERE kind = 'packages' AND deleted_at IS NULL) AS mounted_at
) meta
LEFT JOIN (
  SELECT type_code, strain_name, thc_pct, SUM(grams) AS grams
  FROM rated
  GROUP BY type_code, strain_name, thc_pct
) g ON 1 = 1`;

export type FgCatKey = "bud" | "tri" | "sha" | "pre" | "distillate" | "isolate" | "infused" | "preroll" | "vape";
export type FgUnit = "lb" | "L" | "g" | "each";

export type FgListing = {
  itemName: string;
  category: string;
  marketUom: string | null;
  marketQty: number | null;
  qtyGrams: number | null;
  eachGrams: number | null;
  thcPct: number | null;
  mountedAt: string | null;
};

export type FgLedgerRow = {
  typeCode: string;
  strain: string;
  thcPct: number | null;
  grams: number;
};

export type FgThcLine = { thc: string; amount: number };
export type FgGroup = { name: string; amount: number; lines: FgThcLine[] };
export type FgNamedLine = { name: string; amount: number };
export type FgSizeGroup = { size: string; amount: number; flavors: FgNamedLine[] };

export type FgCategory = {
  key: FgCatKey;
  label: string;
  unit: FgUnit;
  total: number;
  groups: FgGroup[];
  lines: FgNamedLine[];
  sizes: FgSizeGroup[];
};

export type FgInventoryModel = {
  mountedAt: string | null;
  notShown: number;
  categories: FgCategory[];
  /** Live Shake/Trim packages whose unit is not g, kg, or lb. */
  metrcOtherUnits?: number;
  /** Newest packages mirror mount, ISO. */
  metrcMountedAt?: string | null;
};

const CAT_ORDER: Array<{ key: FgCatKey; label: string; unit: FgUnit }> = [
  { key: "bud", label: "Bud", unit: "lb" },
  { key: "tri", label: "Trim/Bio", unit: "lb" },
  { key: "sha", label: "Shake", unit: "lb" },
  { key: "pre", label: "Ounces", unit: "lb" },
  { key: "distillate", label: "Distillate", unit: "L" },
  { key: "isolate", label: "Isolate", unit: "g" },
  { key: "infused", label: "Infused Bud", unit: "g" },
  { key: "preroll", label: "Prerolls", unit: "each" },
  { key: "vape", label: "Vapes", unit: "each" },
];

const NOT_FINISHED = new Set(FG_NOT_FINISHED.map((name) => name.toUpperCase()));
const SIZE_RE = /^(\d+(?:\.\d+)?)g$/i;

type NamedBag = Map<string, { name: string; amount: number }>;
type ThcBag = Map<string, number>;
type StrainBag = Map<string, { name: string; grams: number; parts: ThcBag }>;

function cmp(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left < right) return -1;
  if (left > right) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function finite(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Eastern wall clock of the newest Zoho mount, YYYY-MM-DD HH:MM. */
export function fgMountedLabel(iso: string | null | undefined): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "";
  const date = etDate(iso);
  const mins = etClockMinutes(iso);
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

export function itemPrefix(name: string): string {
  return (name.split(" - ")[0] ?? "").trim();
}

export function itemStrain(name: string): string {
  const parts = name.split(" - ").map((part) => part.trim()).filter(Boolean);
  return parts[1] ?? "";
}

/** The name before the word Distillate. Spelling is matched case blind by the caller. */
export function distillateMaker(name: string): string {
  const match = /^(.*?)\s*distillate\b/i.exec(name.trim());
  const raw = (match ? match[1] : name).replace(/[\s-]+$/g, "").trim();
  return raw || name.trim();
}

/** The name before the word THCA or Isolate (HZ Holdings THCA - 77.38% is HZ Holdings). */
export function isolateMaker(name: string): string {
  const match = /^(.*?)\s*\b(thca|isolate)\b/i.exec(name.trim());
  const raw = (match ? match[1] : name).replace(/[\s-]+$/g, "").trim();
  return raw || name.trim();
}

/** Hardware type is the size segment (1g, 2g). Flavor is the name that remains. */
export function vapeSizeAndFlavor(name: string): { size: string; flavor: string } {
  const parts = name.split(" - ").map((part) => part.trim()).filter(Boolean);
  let size = "";
  const rest: string[] = [];
  for (const part of parts) {
    const compact = part.replace(/\s+/g, "");
    if (!size && SIZE_RE.test(compact)) size = compact.toLowerCase();
    else rest.push(part);
  }
  const flavorParts = rest.filter((part, index) => !(index === 0 && /vape|cart/i.test(part) && rest.length > 1));
  return { size, flavor: flavorParts.join(" - ") };
}

export function prerollFlavor(name: string): string {
  const parts = name.split(" - ").map((part) => part.trim()).filter(Boolean);
  const body = parts.length > 1 ? parts.slice(1) : parts;
  const kept = body.filter((part) => !SIZE_RE.test(part.replace(/\s+/g, "")));
  return (kept.length > 0 ? kept : body).join(" - ").trim();
}

function isNotFinished(prefix: string, category: string): boolean {
  return NOT_FINISHED.has(prefix.trim().toUpperCase()) || NOT_FINISHED.has(category.trim().toUpperCase());
}

function isLiters(uom: string | null): boolean {
  const u = (uom ?? "").trim().toLowerCase();
  return u === "l" || u === "liter" || u === "liters" || u === "litre" || u === "litres";
}

function foldedOf(prefix: string): (typeof FG_FOLDED_PREFIXES)[number] | undefined {
  return FG_FOLDED_PREFIXES.find((row) => row.prefix === prefix);
}

function prepackEach(prefix: string, stored: number | null): number {
  if (stored != null && stored > 0) return stored;
  const folded = foldedOf(prefix);
  if (folded && "eachGrams" in folded && folded.eachGrams > 0) return folded.eachGrams;
  return FG_PRE_EACH_GRAMS;
}

export function classifyListing(row: FgListing): FgCatKey | null {
  const prefix = itemPrefix(row.itemName).toUpperCase();
  const category = (row.category ?? "").trim().toLowerCase();
  if (isNotFinished(prefix, row.category ?? "")) return null;
  if (category === "concentrate" && isLiters(row.marketUom) && /distillate/i.test(row.itemName)) return "distillate";
  if (category === "concentrate" && !isLiters(row.marketUom) && /\b(thca|isolate)\b/i.test(row.itemName)) return "isolate";
  const folded = foldedOf(prefix);
  if (prefix === "BUD" || folded?.category === "bud") return "bud";
  if (prefix === "PRE" || folded?.category === "pre") return "pre";
  if (prefix === "IPR" || category === "infused pre-rolls") return "preroll";
  if (category === "vape/cart") return "vape";
  if (category === "infused flower") return "infused";
  return null;
}

function thcKey(pct: number | null): string {
  const n = finite(pct);
  if (n == null) return "";
  return format2(round2(n));
}

function addNamed(bag: NamedBag, name: string, amount: number): void {
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();
  const have = bag.get(key);
  if (!have) bag.set(key, { name: trimmed, amount });
  else have.amount += amount;
}

function addStrain(bag: StrainBag, strain: string, pct: number | null, grams: number): void {
  const trimmed = strain.trim();
  const key = trimmed.toLowerCase();
  let row = bag.get(key);
  if (!row) {
    row = { name: trimmed, grams: 0, parts: new Map() };
    bag.set(key, row);
  }
  row.grams += grams;
  const thc = thcKey(pct);
  row.parts.set(thc, (row.parts.get(thc) ?? 0) + grams);
}

function pounds(grams: number): number {
  return grams / GRAMS_PER_LB;
}

function namedLines(bag: NamedBag): FgNamedLine[] {
  return [...bag.values()]
    .map((row) => ({ name: row.name, amount: row.amount }))
    .sort((a, b) => cmp(a.name, b.name));
}

function strainGroups(bag: StrainBag): FgGroup[] {
  return [...bag.values()]
    .map((row) => ({
      name: row.name,
      amount: pounds(row.grams),
      lines: [...row.parts.entries()]
        .map(([thc, grams]) => ({ thc, amount: pounds(grams) }))
        .sort((a, b) => {
          if (!a.thc) return 1;
          if (!b.thc) return -1;
          return Number(a.thc) - Number(b.thc);
        }),
    }))
    .sort((a, b) => {
      if (!a.name) return 1;
      if (!b.name) return -1;
      return cmp(a.name, b.name);
    });
}

function emptyCategory(spec: (typeof CAT_ORDER)[number]): FgCategory {
  return { key: spec.key, label: spec.label, unit: spec.unit, total: 0, groups: [], lines: [], sizes: [] };
}

export function buildFgInventory(listings: readonly FgListing[], ledger: readonly FgLedgerRow[]): FgInventoryModel {
  const strains: Record<"bud" | "tri" | "sha" | "pre", StrainBag> = {
    bud: new Map(),
    tri: new Map(),
    sha: new Map(),
    pre: new Map(),
  };
  const grams: Record<"bud" | "tri" | "sha" | "pre", number> = { bud: 0, tri: 0, sha: 0, pre: 0 };
  const makers: NamedBag = new Map();
  const isolateMakers: NamedBag = new Map();
  let isolateGrams = 0;
  let liters = 0;
  const products: NamedBag = new Map();
  let infusedGrams = 0;
  const flavors: NamedBag = new Map();
  let prerollCount = 0;
  const sizes = new Map<string, { amount: number; flavors: NamedBag }>();
  let vapeCount = 0;
  let notShown = 0;
  let mountedAt: string | null = null;

  const rows = [...listings].sort((a, b) => cmp(a.itemName, b.itemName));
  for (const row of rows) {
    if (row.mountedAt && (!mountedAt || row.mountedAt > mountedAt)) mountedAt = row.mountedAt;
    const kind = classifyListing(row);
    if (!kind) {
      notShown += 1;
      continue;
    }
    if (kind === "bud") {
      const g = finite(row.qtyGrams);
      const weight = g != null && g > 0 ? g : 0;
      grams.bud += weight;
      addStrain(strains.bud, itemStrain(row.itemName), row.thcPct, weight);
    } else if (kind === "pre") {
      const count = finite(row.marketQty) ?? 0;
      const weight = count > 0 ? count * prepackEach(itemPrefix(row.itemName).toUpperCase(), finite(row.eachGrams)) : 0;
      grams.pre += weight;
      addStrain(strains.pre, itemStrain(row.itemName), row.thcPct, weight);
    } else if (kind === "distillate") {
      const qty = finite(row.marketQty) ?? 0;
      if (qty > 0) {
        liters += qty;
        addNamed(makers, distillateMaker(row.itemName), qty);
      }
    } else if (kind === "isolate") {
      const stored = finite(row.qtyGrams);
      const uom = (row.marketUom ?? "").trim().toLowerCase();
      const qty = finite(row.marketQty);
      const weight = stored != null && stored > 0 ? stored : qty != null && qty > 0 && (uom === "g" || uom === "grams" || uom === "gram") ? qty : 0;
      if (weight > 0) {
        isolateGrams += weight;
        addNamed(isolateMakers, isolateMaker(row.itemName), weight);
      }
    } else if (kind === "infused") {
      const count = finite(row.marketQty) ?? 0;
      const each = finite(row.eachGrams) ?? 0;
      const weight = count > 0 && each > 0 ? count * each : 0;
      infusedGrams += weight;
      addNamed(products, row.itemName.trim(), weight);
    } else if (kind === "preroll") {
      const count = finite(row.marketQty) ?? 0;
      if (count > 0) {
        prerollCount += count;
        addNamed(flavors, prerollFlavor(row.itemName), count);
      }
    } else if (kind === "vape") {
      const count = finite(row.marketQty) ?? 0;
      if (count > 0) {
        vapeCount += count;
        const parts = vapeSizeAndFlavor(row.itemName);
        const size = parts.size || "";
        let bag = sizes.get(size);
        if (!bag) {
          bag = { amount: 0, flavors: new Map() };
          sizes.set(size, bag);
        }
        bag.amount += count;
        addNamed(bag.flavors, parts.flavor, count);
      }
    }
  }

  for (const row of ledger) {
    const code = row.typeCode.trim().toUpperCase();
    const key = code === "TRIM" ? "tri" : code === "SHAKE" ? "sha" : null;
    if (!key) continue;
    const weight = finite(row.grams) ?? 0;
    if (!(weight > 0)) continue;
    grams[key] += weight;
    addStrain(strains[key], row.strain, row.thcPct, weight);
  }

  const categories = CAT_ORDER.map((spec) => {
    const cat = emptyCategory(spec);
    if (spec.key === "bud" || spec.key === "tri" || spec.key === "sha" || spec.key === "pre") {
      cat.total = pounds(grams[spec.key]);
      cat.groups = strainGroups(strains[spec.key]);
    } else if (spec.key === "distillate") {
      cat.total = liters;
      cat.lines = namedLines(makers);
    } else if (spec.key === "isolate") {
      cat.total = isolateGrams;
      cat.lines = namedLines(isolateMakers);
    } else if (spec.key === "infused") {
      cat.total = infusedGrams;
      cat.lines = namedLines(products);
    } else if (spec.key === "preroll") {
      cat.total = prerollCount;
      cat.lines = namedLines(flavors);
    } else {
      cat.total = vapeCount;
      cat.sizes = [...sizes.entries()]
        .map(([size, bag]) => ({ size, amount: bag.amount, flavors: namedLines(bag.flavors) }))
        .sort((a, b) => {
          const ar = sizeRank(a.size);
          const br = sizeRank(b.size);
          if (ar !== br) return ar - br;
          return cmp(a.size, b.size);
        });
    }
    return cat;
  });

  return { mountedAt, notShown, categories };
}

function sizeRank(size: string): number {
  const match = SIZE_RE.exec(size);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function formatCount(amount: number): string {
  const rounded = round2(amount);
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) {
    const whole = String(Math.abs(Math.round(rounded)));
    const grouped = whole.replace(/\B(?=(\d{3})+$)/g, ",");
    return rounded < 0 ? `-${grouped}` : grouped;
  }
  return format2(rounded);
}

export function fgAmountText(unit: FgUnit, amount: number, locale: Locale): string {
  if (unit === "lb") return `${format2(round2(amount))} lb`;
  if (unit === "L") return `${format2(round2(amount))} L`;
  if (unit === "g") return `${formatGrams(amount)} g`;
  return `${formatCount(amount)} ${t(locale, "each")}`;
}

export function fgTotalAttr(unit: FgUnit, amount: number): string {
  if (unit === "g") return formatGrams(amount);
  if (unit === "each") return formatCount(amount);
  return format2(round2(amount));
}

function lineList(rows: Array<{ attr: string; value: string; text: string; amount: string }>): string {
  if (rows.length === 0) return "";
  const items = rows
    .map((row) => `<li ${row.attr}="${esc(row.value)}">${esc(row.text)} <span class="muted">${esc(row.amount)}</span></li>`)
    .join("");
  return `<ul class="hc-fg-lines">${items}</ul>`;
}

function categoryBody(cat: FgCategory, locale: Locale): string {
  if (cat.groups.length > 0) {
    return cat.groups
      .map((group) => {
        const name = group.name || t(locale, "no strain");
        const lines = group.lines.map((line) => ({
          attr: "data-fg-thc",
          value: line.thc || "none",
          text: line.thc ? `${line.thc}%` : t(locale, "no THC"),
          amount: fgAmountText(cat.unit, line.amount, locale),
        }));
        return `<details class="hc-fg" data-fg-strain="${esc(group.name || "none")}">
      <summary>${esc(name)} <span class="muted">${esc(fgAmountText(cat.unit, group.amount, locale))}</span></summary>
      ${lineList(lines)}
    </details>`;
      })
      .join("");
  }
  if (cat.sizes.length > 0) {
    return cat.sizes
      .map((size) => {
        const label = size.size || t(locale, "no size");
        const lines = size.flavors.map((flavor) => ({
          attr: "data-fg-flavor",
          value: flavor.name || "none",
          text: flavor.name || t(locale, "no strain"),
          amount: fgAmountText("each", flavor.amount, locale),
        }));
        return `<details class="hc-fg" data-fg-size="${esc(size.size || "none")}">
      <summary>${esc(label)} <span class="muted">${esc(fgAmountText("each", size.amount, locale))}</span></summary>
      ${lineList(lines)}
    </details>`;
      })
      .join("");
  }
  const attr = cat.key === "distillate" || cat.key === "isolate" ? "data-fg-maker" : cat.key === "infused" ? "data-fg-product" : "data-fg-flavor";
  return lineList(
    cat.lines.map((line) => ({
      attr,
      value: line.name || "none",
      text: line.name || t(locale, "no strain"),
      amount: fgAmountText(cat.unit, line.amount, locale),
    }))
  );
}

const BUD_BANDS = ["19.99% or less", "20 to 25%", "25 to 30%", "30% and up", "no THC"] as const;
const BUD_TONE: Record<string, string> = {
  "19.99% or less": "b1",
  "20 to 25%": "b2",
  "25 to 30%": "b3",
  "30% and up": "b4",
  "no THC": "none",
};

type BarSeg = {
  name: string;
  text: string;
  title: string;
  share: string;
  width: string;
  tone: string;
  over: boolean;
};

function shareAttr(share: number): string {
  return (Math.round(share * 10000) / 10000).toFixed(4);
}

/** Mix widths sum to 100. The last segment absorbs the rounding. */
function mixWidths(shares: number[]): string[] {
  const units = shares.map((share) => Math.max(0, Math.round(share * 10000)));
  let drift = 10000 - units.reduce((sum, n) => sum + n, 0);
  for (let i = units.length - 1; i >= 0 && drift !== 0; i -= 1) {
    const have = units[i] ?? 0;
    const next = have + drift;
    if (next < 0) {
      drift = next;
      units[i] = 0;
    } else {
      units[i] = next;
      drift = 0;
    }
  }
  return units.map((n) => (n / 100).toFixed(2));
}

function flavorWord(locale: Locale, count: number): string {
  return t(locale, count === 1 ? "flavor" : "flavors");
}

function fgTotalLine(cat: FgCategory, locale: Locale): string {
  const total = fgAmountText(cat.unit, cat.total, locale);
  if (!isCap(cat.key)) return total;
  return `${total} ${t(locale, "of")} ${formatCount(FG_CAPS[cat.key])} ${cat.unit}`;
}

function fgOver(cat: FgCategory): boolean {
  if (!isCap(cat.key)) return false;
  const cap = FG_CAPS[cat.key];
  return cat.key === "tri" ? cat.total >= cap : cat.total > cap;
}

function segOf(name: string, text: string, amount: string, share: number, width: string, tone: string, over: boolean): BarSeg {
  return { name, text, title: `${text}: ${amount}`, share: shareAttr(share), width, tone, over };
}

function fgSegments(cat: FgCategory, locale: Locale, label: string): BarSeg[] {
  if (!(cat.total > 0)) return [];
  if (isCap(cat.key)) {
    const cap = FG_CAPS[cat.key];
    const visual = Math.min(1, cat.total / cap);
    const amount = fgAmountText(cat.unit, cat.total, locale);
    return [segOf(cat.label, label, amount, visual, (visual * 100).toFixed(2), "b3", fgOver(cat))];
  }
  const rows: Array<{ name: string; text: string; title?: string; amount: number; tone: string }> = [];
  if (cat.key === "bud") {
    const sums = new Map<string, number>();
    for (const group of cat.groups) {
      for (const line of group.lines) {
        const band = budThcBand(line.thc ? Number(line.thc) : null);
        sums.set(band, (sums.get(band) ?? 0) + line.amount);
      }
    }
    for (const band of BUD_BANDS) {
      const amount = sums.get(band) ?? 0;
      if (amount > 0) rows.push({ name: band, text: t(locale, band), amount, tone: BUD_TONE[band] ?? "b1" });
    }
  } else if (cat.key === "pre") {
    cat.groups.filter((group) => group.amount > 0).forEach((group, index) => {
      const name = group.name || "none";
      rows.push({ name, text: group.name || t(locale, "no strain"), amount: group.amount, tone: `c${(index % 8) + 1}` });
    });
  } else if (cat.key === "vape") {
    cat.sizes.filter((size) => size.amount > 0).forEach((size, index) => {
      const name = size.size || "none";
      const textName = size.size || t(locale, "no size");
      const flavors = size.flavors.length;
      const word = flavorWord(locale, flavors);
      const text = `${textName}: ${formatCount(size.amount)}, ${flavors} ${word}`;
      const title = `${textName}: ${fgAmountText("each", size.amount, locale)}, ${flavors} ${word}`;
      rows.push({ name, text, title, amount: size.amount, tone: `c${(index % 8) + 1}` });
    });
  } else if (cat.key === "preroll") {
    cat.lines.filter((line) => line.amount > 0).forEach((line, index) => {
      const name = line.name || "none";
      const textName = line.name || t(locale, "no strain");
      const text = `${textName}: ${formatCount(line.amount)}`;
      const title = `${textName}: ${fgAmountText("each", line.amount, locale)}`;
      rows.push({ name, text, title, amount: line.amount, tone: `c${(index % 8) + 1}` });
    });
  }
  if (rows.length === 0) return [];
  const widths = mixWidths(rows.map((row) => row.amount / cat.total));
  return rows.map((row, index) => {
    const amount = fgAmountText(cat.unit, row.amount, locale);
    const share = row.amount / cat.total;
    const width = widths[index] ?? "0.00";
    if (row.title) {
      return { name: row.name, text: row.text, title: row.title, share: shareAttr(share), width, tone: row.tone, over: false };
    }
    return segOf(row.name, row.text, amount, share, width, row.tone, false);
  });
}

function fgIcon(key: FgCatKey): string {
  const mask = `url(/icons/fg/fg-${key}.svg) center / contain no-repeat`;
  return `<span class="hc-fg-icon" aria-hidden="true" style="background:currentColor;-webkit-mask:${mask};mask:${mask}"></span>`;
}

function fgBarHtml(cat: FgCategory, locale: Locale, label: string, totalLine: string): string {
  const over = fgOver(cat);
  let trucks: number | null = null;
  let note = "";
  if (over && cat.key === "tri") {
    trucks = fgTruckCount(cat.total);
    note = `${trucks} ${t(locale, "trucks")}`;
  } else if (over) {
    note = fgAmountText(cat.unit, cat.total, locale);
  }
  const segs = fgSegments(cat, locale, label);
  const described = segs.map((seg) => seg.title).join(", ");
  const aria = described ? `${label}: ${described}${note ? `, ${note}` : ""}` : `${label}: ${totalLine}`;
  const parts = segs
    .map((seg) => {
      const overAttr = seg.over ? ` data-fg-over="1"` : "";
      return `<span class="hc-fg-seg" data-fg-tone="${esc(seg.tone)}" data-fg-seg="${esc(seg.name)}" data-fg-share="${esc(seg.share)}" title="${esc(seg.title)}" style="width:${seg.width}%"${overAttr}>${esc(seg.text)}</span>`;
    })
    .join("");
  const noteHtml = note
    ? `<span class="hc-fg-note"${trucks != null ? ` data-fg-trucks="${trucks}"` : ""}>${esc(note)}</span>`
    : "";
  return `<span class="hc-fg-bar" role="img" aria-label="${esc(aria)}" data-fg-bar="${esc(cat.key)}"><span class="hc-fg-track">${parts}</span>${noteHtml}</span>`;
}

function fgCategoryHtml(cat: FgCategory, locale: Locale): string {
  const label = t(locale, cat.label);
  const totalLine = fgTotalLine(cat, locale);
  return `<details class="hc-fg hc-fg-cat" data-fg-cat="${esc(cat.key)}" data-fg-total="${esc(fgTotalAttr(cat.unit, cat.total))}">
      <summary><span class="hc-fg-row">${fgIcon(cat.key)}<span class="hc-fg-label"><span class="hc-fg-name">${esc(label)}</span><span class="muted hc-fg-total">${esc(totalLine)}</span></span>${fgBarHtml(cat, locale, label, totalLine)}</span></summary>
      ${categoryBody(cat, locale)}
    </details>`;
}

export function emptyFgInventory(): FgInventoryModel {
  return buildFgInventory([], []);
}

export function fgInventorySection(model: FgInventoryModel, locale: Locale = "en"): string {
  const when = fgMountedLabel(model.mountedAt);
  const asOf = when
    ? ` <span class="muted hc-year" data-fg-as-of="${esc(when)}">${esc(`${t(locale, "Zoho as of")} ${when}`)}</span>`
    : "";
  const block = (cat: FgCategory): string => fgCategoryHtml(cat, locale);
  const headKeys = new Set<FgCatKey>(["bud", "tri", "sha"]);
  const head = model.categories.filter((cat) => headKeys.has(cat.key)).map(block).join("");
  const tail = model.categories.filter((cat) => !headKeys.has(cat.key)).map(block).join("");
  const otherN = model.metrcOtherUnits ?? 0;
  const other =
    otherN > 0
      ? `<p class="muted" data-fg-other-units="${esc(String(otherN))}">${esc(
          tFill(locale, "{n} METRC packages in other units not shown", { n: String(otherN) })
        )}</p>`
      : "";
  const hidden = `<p class="muted" data-fg-not-shown="${esc(String(model.notShown))}">${esc(
    tFill(locale, "Not shown: {n} Zoho items", { n: String(model.notShown) })
  )}</p>`;
  return `<details class="hc-section" data-hc-section="fg_inventory">
      <summary>${esc(t(locale, "FG inventory"))}${asOf}</summary>
      ${head}
      ${tail}
      ${hidden}
      ${other}
    </details>`;
}

type ListingSql = {
  item_name: string;
  category: string | null;
  market_uom: string | null;
  market_qty: number | null;
  qty_grams: number | null;
  each_grams: number | null;
  thc_pct: number | null;
  zoho_mounted_at: string | null;
};

type LedgerSql = {
  type_code: string | null;
  strain_name: string | null;
  thc_pct: number | null;
  grams: number | null;
  other_units: number | null;
  mounted_at: string | null;
};

export async function loadFgInventory(db: D1Database): Promise<FgInventoryModel> {
  const [listed, ledger] = await Promise.all([
    db.prepare(FG_LISTINGS_SQL).all<ListingSql>(),
    db.prepare(FG_LEDGER_SQL).all<LedgerSql>(),
  ]);
  const listings = (listed.results ?? []).map((row) => ({
    itemName: String(row.item_name ?? ""),
    category: String(row.category ?? ""),
    marketUom: row.market_uom == null ? null : String(row.market_uom),
    marketQty: finite(row.market_qty),
    qtyGrams: finite(row.qty_grams),
    eachGrams: finite(row.each_grams),
    thcPct: finite(row.thc_pct),
    mountedAt: row.zoho_mounted_at == null ? null : String(row.zoho_mounted_at),
  }));
  const raw = ledger.results ?? [];
  const rows = raw
    .filter((row) => row.type_code)
    .map((row) => ({
      typeCode: String(row.type_code ?? ""),
      strain: String(row.strain_name ?? ""),
      thcPct: finite(row.thc_pct),
      grams: finite(row.grams) ?? 0,
    }));
  return {
    ...buildFgInventory(listings, rows),
    metrcOtherUnits: raw.length ? Number(raw[0].other_units ?? 0) : 0,
    metrcMountedAt: raw[0]?.mounted_at ? String(raw[0].mounted_at) : null,
  };
}
