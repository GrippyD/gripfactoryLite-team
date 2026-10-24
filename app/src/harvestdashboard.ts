/**
 * AD1: Harvest Dashboard, one Admin lookup for every value that changes /harvest.
 * New numbers and lists are edited here. Values already in data stay where they
 * are and are listed, with a link, under the pane they drive.
 */
import { HttpError } from "./audit";
import {
  CONFIG_KEYS,
  CRYO_TYPE_CATEGORIES_DEFAULT,
  ENVIRONMENT_PATH,
  FULFILLMENT_UNIT_GRAMS_DEFAULT,
  GATE_TYPE_CODES_DEFAULT,
  GATE_UNIT_GRAMS_DEFAULT,
  PASTEURIZATION_SHIFT_HOURS_DEFAULT,
  PREPACK_UNITS_DEFAULT,
  parseBtrTypeCodes,
  parseCryoTypeCategories,
  parseFulfillmentUnitGrams,
  parseGateTypeCodes,
  parseGateUnitGrams,
  parseNameList,
  parsePrepackUnits,
  parseTrimBogey,
  projectedDryYieldPct,
} from "./config";
import { cureSpaceCap, parseCureRooms } from "./cure";
import { getConfigMap } from "./db";
import { parseFarmDayStartHour } from "./farmday";
import {
  FG_SETTING_KEYS,
  fgSettingsFrom,
  normalizeHarvestSetting,
  type FgSettings,
} from "./fginventory";
import { t, type Locale } from "./i18n";
import { SILO_CAPACITY_WET_LBS_DEFAULT } from "./silo";
import { esc } from "./ui";

export const HARVEST_DASHBOARD_PATH = "/admin/lookups/harvest_dashboard";

export type HarvestField = {
  key: (typeof FG_SETTING_KEYS)[number];
  label: string;
  unit: string;
  help: string;
  refusal: string;
};

/** The settings migration 0104 seeds. Each save refuses anything but its shape. */
export const HARVEST_FIELDS: readonly HarvestField[] = [
  {
    key: CONFIG_KEYS.fg_cap_tri_lb,
    label: "Trim/Bio cap",
    unit: "lb",
    help: "Trim/Bio turns red at this many pounds and names the trucks.",
    refusal: "Trim/Bio cap must be a number above 0.",
  },
  {
    key: CONFIG_KEYS.fg_cap_sha_lb,
    label: "Shake cap",
    unit: "lb",
    help: "Shake turns red only above this many pounds.",
    refusal: "Shake cap must be a number above 0.",
  },
  {
    key: CONFIG_KEYS.fg_cap_distillate_l,
    label: "Distillate cap",
    unit: "L",
    help: "Distillate turns red only above this many liters.",
    refusal: "Distillate cap must be a number above 0.",
  },
  {
    key: CONFIG_KEYS.fg_cap_isolate_g,
    label: "Isolate cap",
    unit: "g",
    help: "Isolate turns red only above this many grams.",
    refusal: "Isolate cap must be a number above 0.",
  },
  {
    key: CONFIG_KEYS.fg_cap_infused_g,
    label: "Infused Bud cap",
    unit: "g",
    help: "Infused Bud turns red only above this many grams.",
    refusal: "Infused Bud cap must be a number above 0.",
  },
  {
    key: CONFIG_KEYS.fg_truck_lb,
    label: "Truck size",
    unit: "lb",
    help: "Pounds in one truck. Trim/Bio names how many of these fit when it is at the cap.",
    refusal: "Truck size must be a number above 0.",
  },
  {
    key: CONFIG_KEYS.fg_bud_thc_bands,
    label: "THC bands",
    unit: "percent",
    help: "The two inner edges and the top edge. Below the first is the first band. The top and up is the last. No THC stays its own band.",
    refusal: "THC bands must be three increasing numbers above 0.",
  },
  {
    key: CONFIG_KEYS.fg_not_finished,
    label: "Zoho prefixes that are not finished goods",
    unit: "codes",
    help: "Item prefixes and categories Zoho listings leave out of finished goods.",
    refusal: "Zoho prefixes must be a comma separated list of codes.",
  },
  {
    key: CONFIG_KEYS.fg_metrc_not_finished,
    label: "METRC prefixes that are not finished goods",
    unit: "codes",
    help: "Shake/Trim prefixes METRC leaves out of Trim/Bio and Shake.",
    refusal: "METRC prefixes must be a comma separated list of codes.",
  },
  {
    key: CONFIG_KEYS.fg_folded_prefixes,
    label: "Folded prefixes",
    unit: "pairs",
    help: "Prefixes folded into a standing category. MIX=BUD, NUG=BUD, MOB=PRE:70. PRE is Ounces and the number is grams each.",
    refusal: "Folded prefixes must read like MIX=BUD or MOB=PRE:70.",
  },
  {
    key: CONFIG_KEYS.fg_pre_each_grams,
    label: "Ounces each",
    unit: "g",
    help: "Grams in one ounce when the row does not carry a size. A folded prefix with its own size uses that size.",
    refusal: "Ounces each must be a number above 0.",
  },
];

export function harvestField(key: string | null | undefined): HarvestField | undefined {
  return HARVEST_FIELDS.find((field) => field.key === key);
}

type LinkRow = {
  pane: string;
  label: string;
  unit: string;
  help: string;
  href: string;
  value: string;
};

function pairsOf(record: Record<string, number>): string {
  return Object.entries(record)
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
}

function namesOrNone(raw: string | undefined): string {
  const names = parseNameList(raw ?? null);
  return names.length > 0 ? names.join(", ") : "(none)";
}

function effectiveEditable(settings: FgSettings, key: string): string {
  if (key === CONFIG_KEYS.fg_cap_tri_lb) return String(settings.caps.tri);
  if (key === CONFIG_KEYS.fg_cap_sha_lb) return String(settings.caps.sha);
  if (key === CONFIG_KEYS.fg_cap_distillate_l) return String(settings.caps.distillate);
  if (key === CONFIG_KEYS.fg_cap_isolate_g) return String(settings.caps.isolate);
  if (key === CONFIG_KEYS.fg_cap_infused_g) return String(settings.caps.infused);
  if (key === CONFIG_KEYS.fg_truck_lb) return String(settings.truckLb);
  if (key === CONFIG_KEYS.fg_bud_thc_bands) return settings.bands.join(",");
  if (key === CONFIG_KEYS.fg_not_finished) return settings.notFinished.join(",");
  if (key === CONFIG_KEYS.fg_metrc_not_finished) return settings.metrcNotFinished.join(",");
  if (key === CONFIG_KEYS.fg_folded_prefixes) {
    return settings.folds
      .map((fold) => `${fold.prefix}=${fold.category === "bud" ? "BUD" : "PRE"}${fold.eachGrams != null ? `:${fold.eachGrams}` : ""}`)
      .join(",");
  }
  if (key === CONFIG_KEYS.fg_pre_each_grams) return String(settings.preEachGrams);
  return "";
}

export type HarvestDashboardPage = {
  fields: Array<HarvestField & { value: string; fallback: boolean }>;
  links: LinkRow[];
};

const LINK_KEYS = [
  CONFIG_KEYS.farm_day_start_hour,
  CONFIG_KEYS.btr_type_codes,
  CONFIG_KEYS.trim_shift_day_operators,
  CONFIG_KEYS.trim_shift_second_operators,
  CONFIG_KEYS.cryo_type_categories,
  CONFIG_KEYS.trim_bogey_pct,
  CONFIG_KEYS.pasteurization_shift_day_operators,
  CONFIG_KEYS.pasteurization_shift_second_operators,
  CONFIG_KEYS.pasteurization_shift_day_hours,
  CONFIG_KEYS.pasteurization_shift_second_hours,
  CONFIG_KEYS.silo_capacity_wet_lbs,
  CONFIG_KEYS.projected_dry_yield_pct,
  CONFIG_KEYS.environment_stale_minutes,
  CONFIG_KEYS.cure_rooms,
  CONFIG_KEYS.gate_type_codes,
  CONFIG_KEYS.gate_unit_grams,
  CONFIG_KEYS.prepack_units,
  CONFIG_KEYS.fulfillment_unit_grams,
];

function editConfig(key: string): string {
  return `/record/app_config/${key}/edit`;
}

/** The values /harvest already reads, plus the new FG settings, for the one Admin page. */
export async function loadHarvestDashboard(db: D1Database): Promise<HarvestDashboardPage> {
  const [config, plants, estimates, licenses, intervals, cells, bindings, csa, csb] = await Promise.all([
    getConfigMap(db, [...FG_SETTING_KEYS, ...LINK_KEYS]),
    db
      .prepare(`SELECT harvest_year, farm_code, plant_count FROM farm_plant_counts WHERE deleted_at IS NULL ORDER BY harvest_year DESC, farm_code`)
      .all<{ harvest_year: number; farm_code: string; plant_count: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM field_estimates WHERE deleted_at IS NULL`).first<{ n: number }>(),
    db
      .prepare(`SELECT value FROM lookup_values WHERE deleted_at IS NULL AND category = 'license' ORDER BY sort_order, value`)
      .all<{ value: string }>(),
    db
      .prepare(
        `SELECT category, value FROM lookup_values
         WHERE deleted_at IS NULL AND category IN ('silo_check_interval_aw', 'silo_check_interval_mc')
         ORDER BY sort_order, value`
      )
      .all<{ category: string; value: string }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM fulfillment_overrides WHERE deleted_at IS NULL`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM sensor_bindings WHERE deleted_at IS NULL`).first<{ n: number }>(),
    cureSpaceCap(db, "CSA"),
    cureSpaceCap(db, "CSB"),
  ]);
  const settings = fgSettingsFrom(config);
  const fields = HARVEST_FIELDS.map((field) => {
    const value = effectiveEditable(settings, field.key);
    const stored = config.get(field.key);
    const parsed = stored == null || stored.trim() === "" ? null : normalizeHarvestSetting(field.key, stored);
    return { ...field, value, fallback: parsed == null };
  });
  const staleRaw = config.get(CONFIG_KEYS.environment_stale_minutes);
  const staleNum = Number(String(staleRaw ?? "").trim());
  const stale = Number.isFinite(staleNum) && staleNum > 0 ? String(staleNum) : "60";
  const siloRaw = config.get(CONFIG_KEYS.silo_capacity_wet_lbs);
  const siloNum = Number(String(siloRaw ?? "").replace(/,/g, "").trim());
  const silo = Number.isFinite(siloNum) && siloNum > 0 ? String(siloNum) : String(SILO_CAPACITY_WET_LBS_DEFAULT);
  const cryo = [...parseCryoTypeCategories(config.get(CONFIG_KEYS.cryo_type_categories)).entries()].map(([type, category]) => `${type}=${category}`).join(",");
  const cryoFallback = CRYO_TYPE_CATEGORIES_DEFAULT.map(([type, category]) => `${type}=${category}`).join(",");
  const hours = (key: string, fallback: string) => {
    const raw = String(config.get(key) ?? "").trim();
    return raw || fallback;
  };
  const interval = (category: string) => {
    const values = (intervals.results ?? []).filter((row) => row.category === category).map((row) => String(row.value));
    return values.length > 0 ? values.join(", ") : "(none)";
  };
  const licenseValues = (licenses.results ?? []).map((row) => String(row.value)).filter((value) => value.trim() !== "");
  const plantRows = plants.results ?? [];
  const plantYear = plantRows.length > 0 ? Number(plantRows[0].harvest_year) : null;
  const plantText =
    plantYear == null
      ? "(none)"
      : plantRows
          .filter((row) => Number(row.harvest_year) === plantYear)
          .map((row) => `${row.farm_code} ${row.plant_count}`)
          .join(", ");
  const links: LinkRow[] = [
    {
      pane: "Console day",
      label: "Farm day start hour",
      unit: "hour",
      help: "The Eastern hour the farm's day begins. Every pane on the Harvest Console reads this day.",
      href: editConfig(CONFIG_KEYS.farm_day_start_hour),
      value: String(parseFarmDayStartHour(config.get(CONFIG_KEYS.farm_day_start_hour) ?? null)),
    },
    {
      pane: "Plants",
      label: "Farm plant count",
      unit: "plants",
      help: "One number per farm for the latest saved harvest year. Plants Remaining and Total divide by it.",
      href: "/admin/lookups/plant_count",
      value: plantYear == null ? "(none)" : `${plantYear}: ${plantText}`,
    },
    {
      pane: "Plants",
      label: "Licenses",
      unit: "codes",
      help: "The license lookup names the farm of a live METRC plant, on Plants, Strain performance, and Testing.",
      href: "/admin/lookups/licenses",
      value: licenseValues.length > 0 ? licenseValues.join(", ") : "(none)",
    },
    {
      pane: "Strain performance",
      label: "BTR type codes",
      unit: "codes",
      help: "Package types that count as bud in strain performance BTR, the same list Trimming reads.",
      href: editConfig(CONFIG_KEYS.btr_type_codes),
      value: parseBtrTypeCodes(config.get(CONFIG_KEYS.btr_type_codes) ?? null).join(","),
    },
    {
      pane: "Strain performance",
      label: "Field estimates",
      unit: "rows",
      help: "Dry pounds per plant, by strain and farm, that Strain performance reads.",
      href: "/admin/field_estimates",
      value: String(Number(estimates?.n ?? 0)),
    },
    {
      pane: "Drying",
      label: "Silo capacity",
      unit: "lb",
      help: "Wet pounds a silo holds. The fill of every silo scales against it.",
      href: editConfig(CONFIG_KEYS.silo_capacity_wet_lbs),
      value: silo,
    },
    {
      pane: "Drying",
      label: "Projected dry yield",
      unit: "percent",
      help: "The dry-down percent on the drying totals.",
      href: editConfig(CONFIG_KEYS.projected_dry_yield_pct),
      value: String(projectedDryYieldPct(config.get(CONFIG_KEYS.projected_dry_yield_pct) ?? null)),
    },
    {
      pane: "Drying",
      label: "Stale minutes",
      unit: "minutes",
      help: "A sensor reading older than this is stale on the drying tiles.",
      href: editConfig(CONFIG_KEYS.environment_stale_minutes),
      value: stale,
    },
    {
      pane: "Drying",
      label: "Cure rooms",
      unit: "rooms",
      help: "Rooms a door reading can name, including the cure panes.",
      href: editConfig(CONFIG_KEYS.cure_rooms),
      value: parseCureRooms(config.get(CONFIG_KEYS.cure_rooms) ?? null).join(","),
    },
    {
      pane: "Drying",
      label: "CSA lot cap",
      unit: "lots",
      help: "The number of lots CSA holds. The tile fills by lots over this cap.",
      href: "/admin/lookups/csa_lot_cap",
      value: String(csa.value),
    },
    {
      pane: "Drying",
      label: "CSB lot cap",
      unit: "lots",
      help: "The number of lots CSB holds. The tile fills by lots over this cap.",
      href: "/admin/lookups/csb_lot_cap",
      value: String(csb.value),
    },
    {
      pane: "Drying",
      label: "Silo aW intervals",
      unit: "hours",
      help: "Hours between water activity checks on a silo load.",
      href: "/admin/lookups/silo_check_intervals",
      value: interval("silo_check_interval_aw"),
    },
    {
      pane: "Drying",
      label: "Silo MC intervals",
      unit: "hours",
      help: "Hours between moisture checks on a silo load.",
      href: "/admin/lookups/silo_check_intervals",
      value: interval("silo_check_interval_mc"),
    },
    {
      pane: "Drying",
      label: "Environment bindings",
      unit: "bindings",
      help: "Bound sensors and their ranges. A reading outside its range flags the drying tile.",
      href: ENVIRONMENT_PATH,
      value: String(Number(bindings?.n ?? 0)),
    },
    {
      pane: "Trimming",
      label: "BTR type codes",
      unit: "codes",
      help: "Package types that count as bud in the trim BTR.",
      href: editConfig(CONFIG_KEYS.btr_type_codes),
      value: parseBtrTypeCodes(config.get(CONFIG_KEYS.btr_type_codes) ?? null).join(","),
    },
    {
      pane: "Trimming",
      label: "Day shift operators",
      unit: "names",
      help: "Operators whose trim packages count on the day shift.",
      href: editConfig(CONFIG_KEYS.trim_shift_day_operators),
      value: namesOrNone(config.get(CONFIG_KEYS.trim_shift_day_operators)),
    },
    {
      pane: "Trimming",
      label: "Second shift operators",
      unit: "names",
      help: "Operators whose trim packages count on the second shift.",
      href: editConfig(CONFIG_KEYS.trim_shift_second_operators),
      value: namesOrNone(config.get(CONFIG_KEYS.trim_shift_second_operators)),
    },
    {
      pane: "Trimming",
      label: "Cryo type categories",
      unit: "pairs",
      help: "Which trim types read as prepack bud. The rest of the BTR set is bulk bud.",
      href: editConfig(CONFIG_KEYS.cryo_type_categories),
      value: cryo || cryoFallback,
    },
    {
      pane: "Trimming",
      label: "Trim bogey",
      unit: "percent",
      help: "The percent of the trim plume that is product.",
      href: "/admin/lookups/trim_bogey",
      value: String(parseTrimBogey(config.get(CONFIG_KEYS.trim_bogey_pct) ?? null)),
    },
    {
      pane: "Pasteurization",
      label: "Pasteurization day operators",
      unit: "names",
      help: "Operators whose cryo outputs count on the pasteurization day shift.",
      href: editConfig(CONFIG_KEYS.pasteurization_shift_day_operators),
      value: namesOrNone(config.get(CONFIG_KEYS.pasteurization_shift_day_operators)),
    },
    {
      pane: "Pasteurization",
      label: "Pasteurization second operators",
      unit: "names",
      help: "Operators whose cryo outputs count on the pasteurization second shift.",
      href: editConfig(CONFIG_KEYS.pasteurization_shift_second_operators),
      value: namesOrNone(config.get(CONFIG_KEYS.pasteurization_shift_second_operators)),
    },
    {
      pane: "Pasteurization",
      label: "Pasteurization day hours",
      unit: "window",
      help: "The pasteurization day shift's hours, Eastern, HH:MM-HH:MM.",
      href: editConfig(CONFIG_KEYS.pasteurization_shift_day_hours),
      value: hours(CONFIG_KEYS.pasteurization_shift_day_hours, PASTEURIZATION_SHIFT_HOURS_DEFAULT.day),
    },
    {
      pane: "Pasteurization",
      label: "Pasteurization second hours",
      unit: "window",
      help: "The pasteurization second shift's hours, Eastern, HH:MM-HH:MM.",
      href: editConfig(CONFIG_KEYS.pasteurization_shift_second_hours),
      value: hours(CONFIG_KEYS.pasteurization_shift_second_hours, PASTEURIZATION_SHIFT_HOURS_DEFAULT.second),
    },
    {
      pane: "Testing",
      label: "Gate type codes",
      unit: "codes",
      help: "Package types on the four testing panes.",
      href: editConfig(CONFIG_KEYS.gate_type_codes),
      value: parseGateTypeCodes(config.get(CONFIG_KEYS.gate_type_codes) ?? null).join(",") || GATE_TYPE_CODES_DEFAULT.join(","),
    },
    {
      pane: "Testing",
      label: "Gate unit grams",
      unit: "grams",
      help: "Grams in one each on the testing panes.",
      href: editConfig(CONFIG_KEYS.gate_unit_grams),
      value: pairsOf(parseGateUnitGrams(config.get(CONFIG_KEYS.gate_unit_grams) ?? null)) || pairsOf({ ...GATE_UNIT_GRAMS_DEFAULT }),
    },
    {
      pane: "Testing",
      label: "Licenses",
      unit: "codes",
      help: "The testing mirror joins this lookup to name a package's farm.",
      href: "/admin/lookups/licenses",
      value: licenseValues.length > 0 ? licenseValues.join(", ") : "(none)",
    },
    {
      pane: "Prepack",
      label: "Prepack units",
      unit: "grams",
      help: "The unit sizes the prepack pane lists.",
      href: editConfig(CONFIG_KEYS.prepack_units),
      value: parsePrepackUnits(config.get(CONFIG_KEYS.prepack_units) ?? null).join(", ") || PREPACK_UNITS_DEFAULT.join(", "),
    },
    {
      pane: "Fulfillment",
      label: "Fulfillment unit grams",
      unit: "grams",
      help: "Grams in one each for the fulfillment rows METRC counts as eaches.",
      href: editConfig(CONFIG_KEYS.fulfillment_unit_grams),
      value: pairsOf(parseFulfillmentUnitGrams(config.get(CONFIG_KEYS.fulfillment_unit_grams) ?? null)) || pairsOf({ ...FULFILLMENT_UNIT_GRAMS_DEFAULT }),
    },
    {
      pane: "Fulfillment",
      label: "Fulfillment override",
      unit: "cells",
      help: "The Fulfillment pane reads one day's cells from this grid.",
      href: "/admin/lookups/fulfillment_override",
      value: String(Number(cells?.n ?? 0)),
    },
  ];
  return { fields, links };
}

function fieldForm(field: HarvestField & { value: string; fallback: boolean }, locale: Locale): string {
  const note = field.fallback ? `<p class="muted" data-hd-fallback="${esc(field.key)}">${esc(t(locale, "Using the fallback."))}</p>` : "";
  return `<form class="stack" method="post" action="${HARVEST_DASHBOARD_PATH}" data-hd-form="${esc(field.key)}">
      <input type="hidden" name="key" value="${esc(field.key)}">
      <p data-hd-key="${esc(field.key)}" data-hd-value="${esc(field.value)}" data-hd-unit="${esc(field.unit)}">
        <label class="field">${esc(t(locale, field.label))}
          <input type="text" name="value" value="${esc(field.value)}" autocomplete="off" data-hd-input="${esc(field.key)}">
        </label>
        <span class="muted">${esc(t(locale, field.unit))}</span>
      </p>
      <p class="muted">${esc(t(locale, field.help))}</p>
      ${note}
      <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
}

function linkRow(row: LinkRow, locale: Locale): string {
  return `<p data-hd-link="${esc(row.label)}" data-hd-value="${esc(row.value)}" data-hd-unit="${esc(row.unit)}">
      <strong>${esc(t(locale, row.label))}</strong>
      <span class="hd-break">${esc(row.value)}</span>
      <span class="muted">${esc(t(locale, row.unit))}</span>
      <a href="${esc(row.href)}">${esc(t(locale, "Edit"))}</a>
    </p>
    <p class="muted">${esc(t(locale, row.help))}</p>`;
}

export function harvestDashboardPage(page: HarvestDashboardPage, locale: Locale = "en", ok?: string): string {
  const flash = ok === "saved" ? `<p class="banner ok" data-hd-flash>${esc(t(locale, "Saved."))}</p>` : "";
  const panes: string[] = [];
  let current = "";
  for (const row of page.links) {
    if (row.pane !== current) {
      if (current) panes.push("</section>");
      current = row.pane;
      panes.push(`<section data-hd-pane="${esc(row.pane)}"><h2>${esc(t(locale, row.pane))}</h2>`);
    }
    panes.push(linkRow(row, locale));
  }
  if (current) panes.push("</section>");
  const fg = page.fields.map((field) => fieldForm(field, locale)).join("");
  return `<h1>${esc(t(locale, "Harvest Dashboard"))}</h1>
    ${flash}
    <p class="muted">${esc(t(locale, "The values that change what the Harvest Console shows. A number has to be a number above 0. A list is comma separated codes. THC bands have to stay increasing."))}</p>
    ${panes.join("")}
    <section data-hd-pane="FG inventory">
      <h2>${esc(t(locale, "FG inventory"))}</h2>
      ${fg}
    </section>`;
}

/** Refuses a value this page does not know, before any write. */
export function harvestSettingText(key: string | null, raw: unknown): string {
  const field = harvestField(key);
  if (!field) throw new HttpError(404, "Unknown setting.");
  const text = normalizeHarvestSetting(field.key, raw);
  if (text == null) throw new HttpError(400, field.refusal);
  return text;
}
