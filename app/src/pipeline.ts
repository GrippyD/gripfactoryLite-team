import { CAPACITY_UOMS, DRY_SPACE_TYPE_LABELS, DRY_SPACE_TYPES, type TransitionName } from "./config";
import type { OpsIconName } from "./icons";

export type LookupName =
  | "farms"
  | "grow_methods"
  | "strains"
  | "dry_spaces"
  | "package_types"
  /** THE HBN THAT CAME BACK (canon 0.30.84): the lot pencil's HBN options. */
  | "harvest_batches"
  | "people"
  | "silo_number"
  | "inventory_location"
  | "field_location"
  | "license"
  | "item_kind"
  | "failure_mode"
  | "testing_lab"
  | "label_stock"
  | "label_printer"
  | "listing_category"
  | "sign_off_name";

export type FieldHelp = { en: string; es: string };

export type FieldDef =
  | {
      name: string;
      label: string;
      input: "date" | "text" | "time" | "textarea" | "number";
      required?: boolean;
      help: FieldHelp;
      pattern?: string;
      inputmode?: string;
      placeholder?: string;
    }
  | { name: string; label: string; input: "checkbox"; help: FieldHelp }
  | { name: string; label: string; input: "lookup"; lookup: LookupName; required?: boolean; help: FieldHelp }
  | {
      name: string;
      label: string;
      input: "queue_pick";
      queue: string;
      required?: boolean;
      help: FieldHelp;
    }
  | { name: string; label: string; input: "package_rows"; help: FieldHelp }
  /** THE CRYO RUN (canon 0.30.110): the trim-style line at Cryo Weight Entry,
   * tag, type and weight of a new container drawn from the run's pool; the
   * page renders it through cryo.ts, not the generic field renderer. */
  | { name: string; label: string; input: "cryo_lines"; help: FieldHelp }
  /** THE EFFECTIVE DATE PER STATION (owner ruling 2026-09-16, canon 0.30.94):
   * the station's own Effective Date, the source of its transaction date. It
   * defaults to today and needs the Admin PIN to set any other day. The posted
   * field is always named effective_date (with effective_pin beside it); the
   * station's action writes the resolved date to its own column. */
  | { name: "effective_date"; label: string; input: "effective_date"; help: FieldHelp }
  /** Move To (owner ruling 2026-08-28): a dry_spaces select filtered to the picked
   * batch's farm kinds (MOVE_TO_KINDS_BY_FARM), with an Add a truck control beside it. */
  | { name: string; label: string; input: "move_to"; required?: boolean; help: FieldHelp }
  /** A one-tap radio row (owner ruling 2026-09-07, canon 0.29.1: the spear/buck
   * toggle lives on the wet weight entry screen). The default renders checked. */
  | {
      name: string;
      label: string;
      input: "radio";
      options: Array<{ value: string; label: string }>;
      default?: string;
      help: FieldHelp;
    };

export function fieldHelpText(field: FieldDef): FieldHelp {
  return field.help;
}

export type StationTransition = {
  action:
    | "create_harvest_batch"
    | "create_wet_weight"
    | "create_trim_packages";
};

/** Where an entry renders: "home" tiles are the operator surface, "admin" lives under Admin, Data Queues. */
export type Surface = "home" | "admin";

/** Weights ledger law (owner rulings 2026-08-28 wet, 2026-08-31 dry): weights
 * collect on /station/<key>?lot=<id> as rows in ledger.table, and the lot's
 * totalField stays the live total of the non-voided rows. lotStatus is the only
 * lot status that accepts weights and serves the page. mode "direct" (Unload Dry
 * Space) has no header create form at all: the pane pick IS the lot and opens its
 * ledger page immediately. finishTransition names the finish's status flip; when
 * absent, the wet law routes the finish by the destination kind instead. */
export type LedgerDef = {
  table: "wet_weights" | "dry_weights";
  parentField: "wet_weight_entry_id";
  totalField: "weight_grams" | "dry_weight_grams";
  lotStatus: string;
  mode?: "direct";
  finishTransition?: TransitionName;
};

export type StationDef = {
  key: string;
  kind: "station";
  title: string;
  surface: Surface;
  entity: string;
  fields: FieldDef[];
  /** Absent on a direct ledger station (owner ruling 2026-08-31): no header create form, no create route. */
  transition?: StationTransition;
  /** The hand-typed Team Lead field's label (canon 0.30.67: the login is the
   * Supervisor, shown and never picked; the Team Lead is typed by hand). Set
   * only on the wet weight header. */
  personLabel?: string;
  /** Submit button label override; default "Save". */
  submitLabel?: string;
  /** Feeding queue shown as the station's left pane; the picked row id arrives as a hidden pickField input.
   * Owner ruling 2026-08-31: the two-pane theme is the station law for everything ("left pane:
   * available-in-queue, right pane: what's currently saved about that record and the ability to add
   * more to it"), so every station fed by a queue declares one. pickField names the field the form
   * posts for the pick; a station whose widget carries its own row inputs (cryo_weights posts
   * package_id per row) names that posted field and the widget renders the pick itself.
   * groupBy (a field on the queue rows' values) renders the pane as collapsible groups.
   * paneFilter no_finished_lot (owner ruling 2026-08-28) hides open batches that already have a finished lot (drying, in_transit, or trimmed, non-voided); a weighing (unfinished) lot keeps the batch visible for resume.
   * PRODUCTION SCHEDULING (canon 0.30.97): trim_scheduled and cryo_scheduled
   * narrow Trim Packages Entry and Cryo Weight Entry to items an employee has
   * scheduled; the Data Queues and /export CSVs stay unfiltered. */
  leftPane?: {
    queue: string;
    pickField: string;
    groupBy?: string;
    paneFilter?: "no_finished_lot" | "trim_scheduled" | "cryo_scheduled";
    /** Farm codes the pane and its queue pick list keep. Penn North Harvest is PNN. */
    farmCodes?: string[];
  };
  /** Weights ledger (owner ruling 2026-08-28): the station form is a header that starts a
   * lot in status weighing; weights collect on /station/<key>?lot=<id> as rows in ledger.table
   * and the lot's weight_grams stays the live total of the non-voided rows. */
  ledger?: LedgerDef;
};

export type QueueControlDef =
  | { key: "mark_complete"; label: string }
  | { key: "mark_trimmed"; label: string }
  | { key: "release"; label: string }
  // Owner ruling 2026-09-02: [Demote] kicks the record back one process.
  | { key: "demote"; label: string };

export type QueueColumnDef = { field: string; label: string };

export type QueueDef = {
  key: string;
  kind: "queue";
  title: string;
  surface: Surface;
  entity: "harvest_batches" | "wet_weight_entries" | "wip_packages";
  predicate: { field: "status"; value: string };
  columns: QueueColumnDef[];
  optionFields: string[];
  /** Owner ruling 2026-09-04: prefix pane rows and pick options with a
   * sequence number (1. 2. 3.) so the floor reads a simple list. */
  sequenceRows?: boolean;
  /** Owner ruling 2026-09-08 (canon 0.30.9): from Trim Packages Entry forward
   * the lot reads last-6-of-tag / serial / market strain / grams with no
   * decimals; the field named here is the grams. */
  lotLabel?: { weightField: string };
  groupBy?: string;
  rowControls: QueueControlDef[];
};

export type PipelineEntry = StationDef | QueueDef;

export type EditFieldDef = {
  name: string;
  label: string;
  input: "text" | "date" | "time" | "textarea" | "number" | "checkbox" | "lookup";
  lookup?: LookupName;
  /** Lookups only: render a leading blank option; saving blank stores NULL. */
  optional?: boolean;
  /** THE ZONELESS ZERO (canon 0.30.104): a stored instant typed and shown as
   * farm time (YYYY-MM-DD HH:MM, Eastern), parsed server-side through
   * farmInstantFromInput; never stored as typed. */
  farmTime?: boolean;
  /** THE DRY SPACE TYPE (canon 0.30.106): a fixed list the field picks from (a
   * select); the server refuses anything else in words. */
  options?: readonly { value: string; label: string }[];
};

export const EDITABLE_FIELDS: Record<string, EditFieldDef[]> = {
  harvest_batches: [
    { name: "entry_date", label: "Date", input: "date" },
    { name: "farm_code", label: "Farm", input: "lookup", lookup: "farms" },
    { name: "grow_method_code", label: "Grow Method", input: "lookup", lookup: "grow_methods" },
    { name: "strain_id", label: "Strain", input: "lookup", lookup: "strains" },
    { name: "market_strain", label: "Market Strain (optional)", input: "text" },
    { name: "manicure", label: "Manicure?", input: "checkbox" },
    { name: "planned_dryspc", label: "Silo # (planned, optional)", input: "lookup", lookup: "silo_number" },
    { name: "start_time", label: "Start Time (planned, optional, 24h)", input: "text" },
    { name: "zone", label: "Zone (optional)", input: "text" },
    { name: "rows_text", label: "Rows (optional)", input: "text" },
    { name: "metrc_harvest_tag", label: "METRC Harvest Tag", input: "text" },
    { name: "status", label: "Status", input: "text" },
  ],
  wet_weight_entries: [
    // THE HBN THAT CAME BACK (canon 0.30.84; owner report 2026-09-15, his pick
    // "HBN pencil on the lot"): a lot weighed into the wrong HBN moves to the
    // right one with a reason, weights and all; editRecord refuses once the lot
    // has finished (its package and CSV already carry the HBN) and refuses a
    // complete HBN.
    { name: "harvest_batch_id", label: "HBN", input: "lookup", lookup: "harvest_batches" },
    { name: "weight_grams", label: "Total wet weight (g)", input: "number" },
    { name: "actual_dryspc", label: "Move To", input: "lookup", lookup: "dry_spaces" },
    // Owner ruling 2026-09-07 (canon 0.29.1): the lot's form, fixable with a
    // reasoned pencil like everything else. Values: spear or bucked.
    { name: "material_form", label: "Spear or Bucked", input: "text" },
    { name: "actual_start_time", label: "Actual Start Time (24h)", input: "text" },
    { name: "truck_number", label: "Truck #", input: "text" },
    { name: "notes", label: "Notes", input: "textarea" },
    // THE PLANT COUNT (canon 0.30.62): typed at Finish lot or Load Silo, fixable here with a reason; blank = not given.
    { name: "plant_count", label: "Number of plants", input: "number" },
    // THE SUPERVISOR AND THE TEAM LEAD (canon 0.30.67): the hand-typed crew lead, fixable with a reason.
    { name: "team_lead", label: "Team Lead", input: "text" },
    { name: "status", label: "Status", input: "text" },
  ],
  wet_weights: [
    { name: "weight_grams", label: "Weight (g)", input: "number" },
    { name: "harvest_batch_id", label: "HBN", input: "lookup", lookup: "harvest_batches" },
  ],
  // Owner ruling 2026-08-31: dry weights carry the same reasoned pencil as wet.
  dry_weights: [{ name: "weight_grams", label: "Weight (g)", input: "number" }],
  // Canon 0.30.6: the Load Silo pencil; the clock's zero and the notes.
  // Canon 0.30.9: the loaded time IS the clock's zero, so the pencil edits it.
  // THE ZONELESS ZERO (canon 0.30.104; owner, 2026-09-16: "Why wouldn't it
  // just match the system timezone?"): the pencil takes and shows the clock's
  // zero in farm time (Eastern, YYYY-MM-DD HH:MM) and the server stores the
  // instant; the old free-text ISO UTC box stored a zoneless value as typed.
  silo_loads: [
    { name: "loaded_at", label: "Loaded at (farm time, YYYY-MM-DD HH:MM, the clock's zero)", input: "text", farmTime: true },
    { name: "notes", label: "Notes", input: "textarea" },
  ],
  wip_packages: [
    // THE TAG LAW (canon 0.30.38, fork F5, Patrick: "if package code means tag
    // #, please use tag number instead of package code"): the code IS the tag.
    { name: "package_code", label: "Package tag", input: "text" },
    { name: "package_type_code", label: "Package type", input: "lookup", lookup: "package_types" },
    { name: "weight_grams", label: "Weight (g)", input: "number" },
    // Canon 0.30.9: the trim and cryo dates and operators are record fields.
    // Canon 0.30.21: the operators are hand entry (the sign-off names are the
    // PM system's alone).
    { name: "trim_date", label: "Trim date", input: "date" },
    { name: "trim_operator", label: "Trim operator", input: "text" },
    { name: "cryo_weight_grams", label: "Cryo weight (g)", input: "number" },
    { name: "cryo_date", label: "Cryo date", input: "date" },
    { name: "cryo_operator", label: "Cryo operator", input: "text" },
    { name: "status", label: "Status", input: "text" },
    { name: "test_outcome", label: "Test outcome", input: "text" },
  ],
  people: [
    { name: "display_name", label: "Name", input: "text" },
    // The login identity (owner ruling 2026-08-31); editable to attach or fix an email.
    { name: "email", label: "Email", input: "text" },
    // THE PHONE LOGIN (canon 0.30.127): the phone a phone login maps onto this
    // person; stored +E.164 (ten US digits or + country code and number).
    { name: "phone", label: "Phone (login)", input: "text" },
    { name: "is_active", label: "Active?", input: "checkbox" },
  ],
  farms: [{ name: "display_name", label: "Display name", input: "text" }],
  grow_methods: [
    { name: "display_name", label: "Display name", input: "text" },
    { name: "hbn_code", label: "HBN code", input: "text" },
  ],
  strains: [
    { name: "name", label: "Name", input: "text" },
    { name: "abbr", label: "Abbr", input: "text" },
    { name: "hbn_code", label: "HBN code", input: "text" },
  ],
  // THE DRY SPACE TYPE (canon 0.30.106; owner, 2026-09-16, verbatim: "Admin
  // lookups: Dry spaces: 1. Name 2. Capacity 3. Capacity UOM (ea, lb, g, sqft)
  // 4. Freezer, Dry Room, or Silo? <<<<<<Toggle that decides the formatting and
  // the shape"): his four, then the standing kind and farm.
  dry_spaces: [
    { name: "name", label: "Name", input: "text" },
    { name: "capacity", label: "Capacity", input: "number" },
    {
      name: "capacity_uom",
      label: "Capacity UOM",
      input: "text",
      optional: true,
      options: CAPACITY_UOMS.map((u) => ({ value: u, label: u })),
    },
    {
      name: "space_type",
      label: "Freezer, Dry Room, or Silo?",
      input: "text",
      options: DRY_SPACE_TYPES.map((v) => ({ value: v, label: DRY_SPACE_TYPE_LABELS[v] })),
    },
    { name: "kind", label: "Kind", input: "text" },
    // Blank means shared across farms (owner ruling 2026-08-28).
    { name: "farm_code", label: "Farm", input: "lookup", lookup: "farms", optional: true },
  ],
  package_types: [
    { name: "display_name", label: "Display name", input: "text" },
    { name: "is_bud", label: "Is bud?", input: "checkbox" },
  ],
  // Owner ruling 2026-09-01: standing config keys (the ratified yield, the
  // extraction codes, the PIN) edit their value with a reason on the record
  // path; the key itself never edits, and the table never voids.
  app_config: [{ name: "value", label: "Value", input: "text" }],
  lookup_values: [
    { name: "value", label: "Value", input: "text" },
    { name: "label", label: "Label", input: "text" },
    { name: "tone", label: "Tone", input: "text" },
    // Owner ruling 2026-09-06 (canon 0.27.0): locations carry a farm assignment.
    { name: "farm_code", label: "Farm", input: "text", optional: true },
  ],
  local_inventory_items: [
    { name: "qty", label: "Quantity", input: "number" },
    { name: "location", label: "Location", input: "text" },
    // THE TAG LAW (canon 0.30.38, fork F4 "Optional tag everywhere"): the
    // reasoned pencil is the universal capture point for a METRC package tag.
    { name: "metrc_tag", label: "METRC package tag", input: "text" },
  ],
  interco_movements: [
    { name: "origin_license", label: "Origin license", input: "lookup", lookup: "license" },
    { name: "destination_license", label: "Destination license", input: "lookup", lookup: "license" },
    { name: "origin_farm", label: "Origin farm", input: "lookup", lookup: "farms", optional: true },
    { name: "destination_farm", label: "Destination farm", input: "lookup", lookup: "farms", optional: true },
    { name: "truck_number", label: "Truck #", input: "text" },
    { name: "driver", label: "Driver name", input: "text" },
    { name: "planned_route", label: "Planned route", input: "text" },
    { name: "transfer_type", label: "Transfer type", input: "text" },
    { name: "invoice_number", label: "Invoice number", input: "text" },
    { name: "payment_term_days", label: "Payment term days", input: "text" },
    { name: "planned_departure", label: "Estimated departure", input: "text" },
    { name: "planned_arrival", label: "Estimated arrival", input: "text" },
    { name: "gross_weight", label: "Gross weight", input: "text" },
    { name: "gross_weight_uom", label: "Gross weight UOM", input: "text" },
    { name: "transporter_license", label: "Transporter license", input: "text" },
    { name: "transporter_phone", label: "Transporter phone", input: "text" },
    { name: "driver_occupational_license", label: "Driver occupational license", input: "text" },
    { name: "driver_license_number", label: "Driver license number", input: "text" },
    { name: "vehicle_make", label: "Vehicle make", input: "text" },
    { name: "vehicle_model", label: "Vehicle model", input: "text" },
    { name: "vehicle_plate", label: "Vehicle plate", input: "text" },
    { name: "metrc_manifest_number", label: "METRC manifest number", input: "text" },
  ],
  audits: [
    { name: "agency", label: "Agency", input: "text" },
    { name: "agency_contact", label: "Agency contact", input: "text" },
    { name: "grip_rep", label: "Grip Rep", input: "text" },
  ],
  audit_notes: [{ name: "body", label: "Note", input: "textarea" }],
  external_test_results: [
    { name: "license_number", label: "License Number", input: "text" },
    { name: "med_au", label: "Med/AU", input: "text" },
    { name: "strain", label: "Strain", input: "text" },
    { name: "item_name", label: "Item Name", input: "text" },
    { name: "source_metrc_tag", label: "Source Metrc Tag", input: "text" },
    { name: "batch_weight_grams", label: "Batch Weight", input: "number" },
    { name: "hbn", label: "HBN", input: "text" },
    { name: "sample_tag", label: "Sample Tag", input: "text" },
    { name: "required_test", label: "Required Test", input: "text" },
    { name: "net_weight_grams", label: "Net Weight", input: "number" },
    { name: "testing_facility", label: "Testing Facility", input: "text" },
    { name: "entered_testing", label: "Entered Testing", input: "text" },
    { name: "finished_testing", label: "Finished Testing", input: "text" },
    { name: "attempt", label: "Attempt", input: "number" },
    { name: "potency_result", label: "Potency Result", input: "number" },
    { name: "finalized_potency", label: "Finalized Potency", input: "number" },
    { name: "status", label: "Status", input: "text" },
    { name: "failure_mode", label: "Failure mode", input: "text" },
  ],
  label_templates: [
    { name: "name", label: "Name", input: "text" },
    { name: "width_mm", label: "Width mm", input: "number" },
    { name: "height_mm", label: "Height mm", input: "number" },
    { name: "fields_json", label: "Fields JSON", input: "textarea" },
  ],
  suppliers: [
    { name: "company_name", label: "Company", input: "text" },
    { name: "main_contact", label: "Main contact", input: "text" },
    { name: "phone", label: "Phone", input: "text" },
    { name: "notes", label: "Notes", input: "textarea" },
    { name: "status", label: "Status", input: "text" },
  ],
  purchase_orders: [
    { name: "name", label: "Name", input: "text" },
    { name: "po_class", label: "Class", input: "text" },
    { name: "project", label: "Project", input: "text" },
  ],
  purchase_order_lines: [
    { name: "item_code", label: "Item code", input: "text" },
    { name: "description", label: "Description", input: "text" },
    { name: "uom", label: "UOM", input: "text" },
    { name: "qty", label: "Qty", input: "number" },
    { name: "unit_price_cents", label: "Unit price cents", input: "number" },
  ],
  listings: [
    { name: "item_name", label: "Item", input: "text" },
    { name: "package_label", label: "Label", input: "text" },
    { name: "package_item_id", label: "Internal package", input: "text" },
    { name: "category", label: "Category", input: "text" },
    { name: "qty_grams", label: "Quantity grams", input: "number" },
    { name: "listed", label: "Listed", input: "checkbox" },
  ],
  sales_orders: [
    { name: "buyer", label: "Buyer", input: "text" },
    { name: "status", label: "Status", input: "text" },
  ],
};

export const TABLE_EXPORTS = [
  "harvest_batches",
  "wet_weight_entries",
  "wip_packages",
  "record_change_log",
] as const;

/**
 * Pipeline order is data. Reorder this array to reorder the pages.
 * Insert a new station by adding an entry and a matching action handler.
 * Do not edit existing entries to make room.
 * surface: "home" renders as an operator tile on the home page;
 * "admin" renders as an inline record table on Admin, Data Queues
 * (owner ruling 2026-08-27: queues are listed records, never buttons).
 */
export const PIPELINE: PipelineEntry[] = [
  {
    key: "acquire_hbn",
    kind: "station",
    surface: "home",
    title: "Acquire HBN",
    entity: "harvest_batches",
    fields: [
      {
        name: "entry_date",
        label: "Date",
        input: "date",
        required: true,
        help: {
          en: "Harvest calendar date. It mints the HBN date segment and is the start of the field-to-wet TAT.",
          es: "Fecha del calendario de cosecha. Acuna el segmento de fecha del HBN y es el inicio del TAT de campo a humedo.",
        },
      },
      {
        name: "farm_code",
        label: "Farm",
        input: "lookup",
        lookup: "farms",
        required: true,
        help: {
          en: "Holding farm on the batch, every lot, and minted inventory. Admin\\Data Lookups\\Harvest Operations\\Farms",
          es: "Granja titular del lote, de cada entrada y del inventario acuñado. Admin\\Data Lookups\\Harvest Operations\\Farms",
        },
      },
      {
        name: "license_value",
        label: "License",
        input: "lookup",
        lookup: "license",
        required: true,
        help: {
          en: "The license this HBN is minted into. Lots sit under it until they land a site on receipt. Admin\\Data Lookups\\Licenses",
          es: "La licencia en la que se acuna este HBN. Los lotes quedan bajo ella hasta que llegan a un sitio. Admin\\Data Lookups\\Licenses",
        },
      },
      {
        name: "grow_method_code",
        label: "Grow Method",
        input: "lookup",
        lookup: "grow_methods",
        required: true,
        help: {
          en: "Grow code that rides the HBN and TAT line grouping. Admin\\Data Lookups\\Harvest Operations\\Grow Methods",
          es: "Codigo de cultivo que viaja en el HBN y agrupa las lineas TAT. Admin\\Data Lookups\\Harvest Operations\\Grow Methods",
        },
      },
      {
        name: "strain_id",
        label: "Strain",
        input: "lookup",
        lookup: "strains",
        required: true,
        help: {
          en: "Strain on the HBN, lot panels, inventory, and reports. Admin\\Data Lookups\\Harvest Operations\\Strains",
          es: "Variedad en el HBN, los paneles de lote, el inventario y los informes. Admin\\Data Lookups\\Harvest Operations\\Strains",
        },
      },
      {
        name: "manicure",
        label: "Manicure?",
        input: "checkbox",
        help: {
          en: "Marks a manicure harvest. It rides the HBN token and does not change weights.",
          es: "Marca una cosecha de manicura. Viaja en el token HBN y no cambia los pesos.",
        },
      },
      {
        name: "market_strain",
        label: "Market Strain (optional)",
        input: "text",
        help: {
          en: "Sales name that overrides the product name on every package downstream. It never changes the HBN: the true cultivar stays for future you.",
          es: "Nombre comercial que reemplaza el nombre del producto en cada paquete posterior. Nunca cambia el HBN: el cultivar real queda para el futuro.",
        },
      },
      {
        name: "planned_dryspc",
        label: "Silo # (planned, optional)",
        input: "lookup",
        lookup: "silo_number",
        help: {
          en: "A planned field, not a data field. The actual space is chosen at Wet Weight, which is what ratifies the HBN. Admin\\Data Lookups\\Harvest Operations\\Silo #",
          es: "Un campo planeado, no un dato. El espacio real se elige en Peso Humedo, que es lo que ratifica el HBN. Admin\\Data Lookups\\Harvest Operations\\Silo #",
        },
      },
      {
        name: "start_time",
        label: "Start Time (planned, optional, 24h)",
        input: "text",
        pattern: "([01][0-9]|2[0-3]):[0-5][0-9]",
        inputmode: "numeric",
        placeholder: "HH:MM",
        help: {
          en: "A planned field, not a data field. The actual start is captured at Wet Weight. Stored and shown as HH:MM, never AM or PM.",
          es: "Un campo planeado, no un dato. El inicio real se captura en Peso Humedo. Se guarda y se muestra como HH:MM, nunca AM o PM.",
        },
      },
      {
        name: "zone",
        label: "Zone (optional)",
        input: "text",
        help: {
          en: "Field zone for the harvest crew. It does not mint or route the lot.",
          es: "Zona de campo para la cuadrilla. No acuna ni enruta el lote.",
        },
      },
      {
        name: "rows_text",
        label: "Rows (optional)",
        input: "text",
        help: {
          en: "Row notes for the harvest crew. It does not mint or route the lot.",
          es: "Notas de filas para la cuadrilla. No acuna ni enruta el lote.",
        },
      },
      {
        name: "metrc_harvest_tag",
        label: "METRC Harvest Tag",
        input: "text",
        help: {
          en: "METRC harvest tag. Traveler printing uses its tail; screens show the last 5 of the HBN.",
          es: "Etiqueta de cosecha METRC. La impresion del viajero usa su cola; las pantallas muestran los ultimos 5 del HBN.",
        },
      },
    ],
    transition: { action: "create_harvest_batch" },
  },
  {
    key: "hbn_queue",
    kind: "queue",
    surface: "admin",
    title: "HBN Queue",
    entity: "harvest_batches",
    predicate: { field: "status", value: "open" },
    columns: [
      { field: "hbn", label: "HBN" },
      { field: "entry_date", label: "Date" },
      { field: "farm_code", label: "Farm" },
      { field: "strain_name", label: "Strain" },
      { field: "created_at", label: "Created" },
    ],
    // Owner ruling 2026-09-04 (canon 0.22.0): the HBN cannot be the queue item
    // for wet weights. A sequence number then Farm/Strain/Date is all that is
    // needed; the HBN is inherited by both processes on the CSV.
    optionFields: ["farm_code", "strain_name", "entry_date"],
    sequenceRows: true,
    rowControls: [{ key: "mark_complete", label: "Mark complete" }],
  },
  {
    key: "wet_weight",
    kind: "station",
    surface: "home",
    title: "Penn North Harvest",
    entity: "wet_weight_entries",
    // THE SUPERVISOR AND THE TEAM LEAD (canon 0.30.67). Owner, 2026-09-14,
    // verbatim: "Minted HBNs are passing the Team Lead definition from the
    // cloudflare login email to the wet weight screen.  Let's make all
    // "Supervisors" the email, the team lead should be hand entered". The
    // header shows the login as Supervisor and takes the Team Lead by hand.
    personLabel: "Team Lead",
    submitLabel: "Start lot",
    fields: [
      {
        name: "harvest_batch_id",
        label: "HBN",
        input: "queue_pick",
        queue: "hbn_queue",
        required: true,
        help: {
          en: "Open harvest batch this lot belongs to. Finish lot mints inventory against that batch.",
          es: "Lote de cosecha abierto al que pertenece esta entrada. Terminar lote acuna inventario contra ese lote.",
        },
      },
      {
        name: "actual_dryspc",
        label: "Move To",
        input: "move_to",
        required: true,
        help: {
          en: "Actual dry space at PNN, where every lot lands. A hang room mints SPR; a silo or the freezer mints WIP, born in PNN's barn under its grow license. Admin\\Data Lookups\\Harvest Operations\\Dry Spaces",
          es: "Espacio de secado real en PNN, donde llega cada lote. Un cuarto de colgar acuna SPR; un silo o el congelador acuna WIP, nacido en el granero de PNN bajo su licencia de cultivo. Admin\\Data Lookups\\Harvest Operations\\Dry Spaces",
        },
      },
      {
        // Owner ruling 2026-09-07 (canon 0.29.1, verbatim): "we're just going
        // to move the spear/buck toggle to the wet weight entry screen." The
        // lot carries its form from weigh-in: the receive mints from it (spear
        // SPR, bucked WIP) and the unload derives its weigh mode from it. A
        // silo Move To overrides to bucked at create (the silo law).
        name: "material_form",
        label: "Spear or Bucked",
        input: "radio",
        options: [
          { value: "spear", label: "Spear" },
          { value: "bucked", label: "Bucked" },
        ],
        default: "spear",
        help: {
          en: "What this lot is at weigh-in. Spear is the common case and stays one tap. Drives the truck receive mint and the unload questions.",
          es: "Lo que es este lote al pesar. Lanza es el caso comun y queda en un toque. Define el acunado al recibir el camion y las preguntas al descargar.",
        },
      },
      {
        name: "truck_number",
        label: "Truck #",
        input: "text",
        help: {
          en: "Optional. The next number for this farm's lots today is filled in. Overtype it, or blank it for a lot that goes straight to its space.",
          es: "Opcional. Se llena el siguiente numero de los lotes de esta granja hoy. Cambielo, o dejelo en blanco para un lote que va directo a su espacio.",
        },
      },
      {
        name: "actual_start_time",
        label: "Actual Start Time (24h, optional)",
        input: "text",
        pattern: "([01][0-9]|2[0-3]):[0-5][0-9]",
        inputmode: "numeric",
        placeholder: "HH:MM",
        help: {
          en: "The actual harvest start, a data field captured here where the HBN ratifies. The Acquire start time is only the plan.",
          es: "El inicio real de la cosecha, un dato capturado aqui donde el HBN se ratifica. La hora en Acquire es solo el plan.",
        },
      },
      {
        name: "notes",
        label: "Notes",
        input: "text",
        help: {
          en: "Operator notes on the lot. They do not change weights or inventory.",
          es: "Notas del operador en el lote. No cambian pesos ni inventario.",
        },
      },
      // THE EFFECTIVE DATE PER STATION (owner ruling 2026-09-16, canon 0.30.94):
      // the lot's transaction date, today by default, the Admin PIN for any
      // other day; it writes to wet_weight_entries.effective_date.
      {
        name: "effective_date",
        label: "Effective Date",
        input: "effective_date",
        help: {
          en: "The lot's transaction date. Today by default; the Admin PIN sets another day.",
          es: "La fecha de transaccion del lote. Hoy por defecto; el PIN de Admin fija otro dia.",
        },
      },
    ],
    transition: { action: "create_wet_weight" },
    leftPane: {
      queue: "hbn_queue",
      pickField: "harvest_batch_id",
      groupBy: "farm_code",
      paneFilter: "no_finished_lot",
      farmCodes: ["PNN"],
    },
    ledger: {
      table: "wet_weights",
      parentField: "wet_weight_entry_id",
      totalField: "weight_grams",
      lotStatus: "weighing",
    },
  },
  {
    // THE TWO HARVEST NODES (canon 0.30.317). The page is fieldharvest.ts.
    // ARL and PNS batches, loads instead of the Penn North header.
    key: "field_harvest",
    kind: "station",
    surface: "home",
    title: "Penn South/Arlington Harvest",
    entity: "field_loads",
    fields: [],
  },
  {
    key: "dry_space_queue",
    kind: "queue",
    surface: "admin",
    title: "Dry Space Queue",
    entity: "wet_weight_entries",
    predicate: { field: "status", value: "drying" },
    columns: [
      { field: "hbn", label: "HBN" },
      { field: "weight_grams", label: "Bucked (g)" },
      { field: "wet_spear_weight_grams", label: "Spear (g)" },
      { field: "dry_space_name", label: "Dry space" },
      { field: "truck_number", label: "Truck" },
      { field: "notes", label: "Notes" },
      { field: "created_at", label: "Created" },
    ],
    optionFields: ["hbn", "dry_space_name", "weight_grams"],
    groupBy: "dry_space_name",
    rowControls: [
      { key: "mark_trimmed", label: "Mark trimmed" },
      // Owner ruling 2026-09-02: [Demote] kicks the record back one process.
      { key: "demote", label: "Demote" },
    ],
  },
  {
    // Owner ruling 2026-08-31: [Unload Dry Space]. Left pane: the Dry Space Queue;
    // the right pane works like wet weights, but these are dry weights. Direct
    // mode: picking a drying lot opens its dry ledger page immediately; the lot
    // already exists, so there is no header form and no Start lot. A mid-unload
    // lot stays drying (and in the pane for resume) until Finish unload moves it
    // to unloaded.
    key: "unload_dry_space",
    kind: "station",
    surface: "home",
    title: "Unload Dry Space",
    entity: "wet_weight_entries",
    fields: [],
    leftPane: {
      queue: "dry_space_queue",
      pickField: "wet_weight_entry_id",
      groupBy: "dry_space_name",
    },
    ledger: {
      table: "dry_weights",
      parentField: "wet_weight_entry_id",
      totalField: "dry_weight_grams",
      lotStatus: "drying",
      mode: "direct",
      finishTransition: "lot_unloaded",
    },
  },
  {
    // Owner ruling 2026-08-31: finishing an unload moves the lot out of the Dry
    // Space Queue into this queue, and Trim Packages picks from here. This queue
    // and all subsequent ones identify each lot by the short id (HBN serial plus
    // METRC tag tail) along with the strain and weight.
    key: "unloaded_queue",
    kind: "queue",
    surface: "admin",
    title: "Unloaded Queue",
    entity: "wet_weight_entries",
    predicate: { field: "status", value: "unloaded" },
    columns: [
      { field: "short_id", label: "Lot" },
      { field: "strain_name", label: "Strain" },
      { field: "dry_weight_grams", label: "Dry total (g)" },
      { field: "dry_space_name", label: "From" },
      { field: "notes", label: "Notes" },
      { field: "created_at", label: "Created" },
    ],
    optionFields: ["short_id", "strain_name", "dry_weight_grams"],
    // Owner ruling 2026-09-08 (canon 0.30.9): the Trim-forward lot label, his
    // picture "[Last 6 of Tag Number]/26001/TEST MOOKY/250,000".
    lotLabel: { weightField: "dry_weight_grams" },
    rowControls: [
      { key: "mark_trimmed", label: "Mark trimmed" },
      // Owner ruling 2026-09-02: [Demote] kicks the record back one process.
      { key: "demote", label: "Demote" },
    ],
  },
  {
    key: "inbound_queue",
    kind: "queue",
    surface: "admin",
    title: "Inbound Queue",
    entity: "wet_weight_entries",
    // Owner ruling 2026-08-31: trucks are record-borne, so the truck column and
    // grouping ride truck_label ('Truck <n> - <hbn>'; legacy rows keep their old
    // Truck N names). Per-HBN labels keep different HBNs' trucks apart.
    predicate: { field: "status", value: "in_transit" },
    columns: [
      { field: "hbn", label: "HBN" },
      { field: "weight_grams", label: "Total (g)" },
      { field: "truck_label", label: "Truck" },
      { field: "notes", label: "Notes" },
      { field: "created_at", label: "Created" },
    ],
    optionFields: ["hbn", "truck_label", "weight_grams"],
    groupBy: "truck_label",
    // Owner ruling 2026-09-02: [Demote] kicks the record back one process.
    rowControls: [{ key: "demote", label: "Demote" }],
  },
  {
    key: "weighing_queue",
    kind: "queue",
    surface: "admin",
    title: "Weighing Queue",
    entity: "wet_weight_entries",
    // Owner word 2026-09-06 ("confirm that we have the tools to remove them
    // from the app"), under the ratified 0.26.0 principle that every layer has
    // its Data Queues place: weighing lots were the one record class with no
    // surfaced reasoned Void anywhere. This queue closes the gap. Removal
    // order: void the lot first, then its batch; the floor lists a live lot
    // even when its batch is voided.
    predicate: { field: "status", value: "weighing" },
    columns: [
      { field: "hbn", label: "HBN" },
      { field: "weight_grams", label: "Total (g)" },
      { field: "notes", label: "Notes" },
      { field: "created_at", label: "Created" },
    ],
    optionFields: ["hbn", "weight_grams"],
    rowControls: [],
  },
  {
    key: "trim_packages",
    kind: "station",
    surface: "home",
    title: "Trim Packages Entry",
    entity: "wip_packages",
    fields: [
      {
        name: "wet_weight_entry_id",
        label: "Lot",
        input: "queue_pick",
        // Owner ruling 2026-08-31: trim picks from the Unloaded Queue, not the
        // Dry Space Queue; the map order is dry space, unload, trim.
        queue: "unloaded_queue",
        required: true,
        help: {
          en: "Unloaded lot this trim consumes. Packages draw down its dry total.",
          es: "Lote descargado que esta poda consume. Los paquetes rebajan su total seco.",
        },
      },
      // Owner ruling 2026-09-08 (canon 0.30.9): the date rides every package
      // saved below. THE EFFECTIVE DATE PER STATION (canon 0.30.94): that date
      // is now the station's Effective Date, today by default, the Admin PIN
      // for any other day; it writes to each package's trim_date.
      {
        name: "effective_date",
        label: "Effective Date",
        input: "effective_date",
        help: {
          en: "The trim date saved on each package entered. Today by default; the Admin PIN sets another day.",
          es: "La fecha de poda guardada en cada paquete. Hoy por defecto; el PIN de Admin fija otro dia.",
        },
      },
      // Owner ruling 2026-09-08 (canon 0.30.9 R7: "the hand entry of the
      // operator filling in the data"; canon 0.30.21 returns it to hand entry:
      // "The operator dropdowns don't need to have the maintenance crew on
      // every single one, that was just for the PM portion").
      {
        name: "trim_operator",
        label: "Operator",
        input: "text",
        required: true,
        help: {
          en: "The person doing the trim entry, typed, saved on each package.",
          es: "La persona que hace la entrada de poda, escrita a mano, guardada en cada paquete.",
        },
      },
      {
        name: "packages",
        label: "Packages",
        input: "package_rows",
        help: {
          en: "Each row is a trim package. Type comes from Admin\\Data Lookups\\Production Operations\\Package Types",
          es: "Cada fila es un paquete de poda. El tipo viene de Admin\\Data Lookups\\Production Operations\\Package Types",
        },
      },
    ],
    transition: { action: "create_trim_packages" },
    // Owner ruling 2026-08-31: the two-pane theme is the station law for
    // everything; trim's left pane is the Unloaded Queue it picks from (no
    // groupBy, the queue has none). The picked row's label (short id, strain,
    // dry total) heads the right pane as the saved-record side; the packages
    // form below is the add-more side.
    // PRODUCTION SCHEDULING (canon 0.30.97): the Unloaded Queue pane lists
    // only lots with a scheduled trim row; an unloaded lot nobody has
    // scheduled does not appear here. The Data Queues stay unfiltered.
    leftPane: { queue: "unloaded_queue", pickField: "wet_weight_entry_id", paneFilter: "trim_scheduled" },
  },
  {
    key: "cryo_queue",
    kind: "queue",
    surface: "admin",
    title: "Cryo Queue",
    entity: "wip_packages",
    predicate: { field: "status", value: "cryo_queue" },
    columns: [
      { field: "package_code", label: "Package" },
      { field: "package_type_code", label: "Type" },
      { field: "weight_grams", label: "Weight (g)" },
      // Owner ruling 2026-08-31: subsequent queues inherit the short lot id and
      // strain; managers keep the full HBN beside them.
      { field: "short_id", label: "Lot" },
      { field: "strain_name", label: "Strain" },
      { field: "hbn", label: "HBN" },
      { field: "created_at", label: "Created" },
    ],
    optionFields: ["package_code", "hbn", "weight_grams"],
    rowControls: [],
  },
  {
    key: "cryo_weight",
    kind: "station",
    surface: "home",
    title: "Cryo Weight Entry",
    entity: "wip_packages",
    // THE CRYO RUN (canon 0.30.110; owner: "For cryo, replicate the trim line
    // surface in cryo production reporting"): the page is rendered by cryo.ts
    // from these fields' words. The left pane lists the pasteurization runs,
    // one per HBN, never a container; the working pane shows the picked run's
    // pool by product type, the Effective Date, the Operator, the line (tag,
    // type, weight, plus), the entered packages and Finish run. Each line is a
    // new container born into the Testing queue. There is no header create
    // form: the lines post to /station/cryo_weight/run/<id>/add and Finish
    // run to /station/cryo_weight/run/<id>/finish.
    fields: [
      // Owner ruling 2026-09-08 (canon 0.30.9): the cryo date and the
      // hand-typed operator save on each package entered. THE EFFECTIVE DATE
      // PER STATION (canon 0.30.94): that date is the station's Effective
      // Date, today by default, the Admin PIN for any other day; it writes to
      // each package's cryo_date.
      {
        name: "effective_date",
        label: "Effective Date",
        input: "effective_date",
        help: {
          en: "The cryo date saved on each package entered. Today by default; the Admin PIN sets another day.",
          es: "La fecha de crio guardada en cada paquete ingresado. Hoy por defecto; el PIN de Admin fija otro dia.",
        },
      },
      {
        name: "cryo_operator",
        label: "Operator",
        input: "text",
        required: true,
        help: {
          en: "The person doing the cryo entry, typed, saved on each package.",
          es: "La persona que hace la entrada de crio, escrita a mano, guardada en cada paquete.",
        },
      },
      {
        name: "cryo_lines",
        label: "Packages",
        input: "cryo_lines",
        help: {
          en: "Each line is a new container: the scanned METRC package tag, its type from the run's pool, its weight. It is born into the Testing queue and feeds the TAT cryo-to-release span.",
          es: "Cada linea es un contenedor nuevo: la etiqueta METRC escaneada, su tipo del pool de la corrida, su peso. Nace en la cola de pruebas y alimenta el TAT de crio a liberacion.",
        },
      },
    ],
    // PRODUCTION SCHEDULING (canon 0.30.97) as THE CRYO RUN reshaped it: the
    // pane lists scheduled runs (paneFilter cryo_scheduled names the law); the
    // pick is the run.
    leftPane: { queue: "cryo_queue", pickField: "run_id", paneFilter: "cryo_scheduled" },
  },
  {
    key: "testing_queue",
    kind: "queue",
    surface: "admin",
    title: "Testing Queue",
    entity: "wip_packages",
    predicate: { field: "status", value: "testing_queue" },
    columns: [
      { field: "package_code", label: "Package" },
      { field: "package_type_code", label: "Type" },
      { field: "weight_grams", label: "Weight (g)" },
      { field: "cryo_weight_grams", label: "Cryo weight (g)" },
      // Owner ruling 2026-08-31: subsequent queues inherit the short lot id and
      // strain; managers keep the full HBN beside them.
      { field: "short_id", label: "Lot" },
      { field: "strain_name", label: "Strain" },
      { field: "hbn", label: "HBN" },
      { field: "created_at", label: "Created" },
      // THE MIRROR RELEASES THE QUEUE (canon 0.30.193): the live mirror state.
      { field: "lab_status_metrc", label: "Lab status (METRC)" },
    ],
    optionFields: ["package_code", "hbn"],
    rowControls: [
      { key: "release", label: "Release" },
      // Owner ruling 2026-09-02: [Demote] kicks the record back one process.
      { key: "demote", label: "Demote" },
    ],
  },
];

export function stationByKey(key: string): StationDef | undefined {
  return PIPELINE.find((e) => e.kind === "station" && e.key === key) as StationDef | undefined;
}

export function queueByKey(key: string): QueueDef | undefined {
  return PIPELINE.find((e) => e.kind === "queue" && e.key === key) as QueueDef | undefined;
}

export function queues(): QueueDef[] {
  return PIPELINE.filter((e): e is QueueDef => e.kind === "queue");
}

export function homeEntries(): PipelineEntry[] {
  return PIPELINE.filter((e) => e.surface === "home");
}

/** Operations map (owner ruling 2026-09-02). Groups and flow edges are data;
 * the home map and /ops/<key> pages render from this registry. Storage keys
 * stay English. */
export type OpsMember = {
  key: string;
  title: string;
  href: string;
  reserved?: boolean;
  futureFile?: string;
};

export type OpsGroup = {
  key: string;
  label: string;
  icon: OpsIconName;
  href: string;
  reserved?: boolean;
  futureFile?: string;
  members: OpsMember[];
};

export type OpsEdgeDir = "right" | "down" | "left";

export type OpsFlowEdge = {
  from: string;
  to: string;
  dir: OpsEdgeDir;
};

/** Vendored icon file stems (app/public/icons/{white,dark}/<stem>.svg). */
export const OPS_ICON_FILES: Record<OpsIconName, string> = {
  field: "harvest-field",
  truck: "interco-truck",
  silo: "drying-silo",
  factory: "production-factory",
  storefront: "marketplace",
  scales: "business-scale",
};

export const OPS_GROUPS: OpsGroup[] = [
  {
    key: "harvest_ops",
    label: "Harvest Operations",
    icon: "field",
    href: "/ops/harvest_ops",
    members: [
      { key: "acquire_hbn", title: "Acquire HBN", href: "/station/acquire_hbn" },
      { key: "wet_weight", title: "Penn North Harvest", href: "/station/wet_weight" },
      { key: "field_harvest", title: "Penn South/Arlington Harvest", href: "/station/field_harvest" },
    ],
  },
  {
    key: "interco_logistics",
    label: "Logistics Operations",
    icon: "truck",
    href: "/ops/interco_logistics",
    members: [
      { key: "internal_logistics", title: "Internal Logistics", href: "/logistics/internal" },
      { key: "processing_partners", title: "Processing Partners", href: "/logistics/partners" },
    ],
  },
  {
    key: "drying_ops",
    label: "Drying Operations",
    icon: "silo",
    href: "/ops/drying_ops",
    members: [
      // Owner ruling 2026-09-08 (canon 0.30.6): "Drying Operations add [load silo]".
      { key: "load_silo", title: "Load Silo", href: "/station/load_silo" },
      { key: "unload_dry_space", title: "Unload Dry Space", href: "/station/unload_dry_space" },
      {
        key: "virtual_move_processor",
        title: "Virtual move to processor",
        href: "/virtual-move",
      },
      // THE DRYING SCHEDULE (canon 0.30.226; his pick "Three surfaces by space
      // kind"): the schedule surfaces live under Production Scheduling's path;
      // Load Silo and Unload Dry Space stay the acts' forms.
      { key: "schedule_silos", title: "Silos", href: "/production/scheduling/silos" },
      { key: "schedule_dry_rooms", title: "Dry Rooms", href: "/production/scheduling/dry_rooms" },
      { key: "schedule_freezers", title: "Freezers", href: "/production/scheduling/freezers" },
    ],
  },
  {
    key: "production_ops",
    label: "Production Operations",
    icon: "factory",
    href: "/ops/production_ops",
    members: [
      // PRODUCTION SCHEDULING (canon 0.30.97): scheduling stands first; it
      // feeds Trim Packages Entry and Cryo Weight Entry.
      { key: "production_scheduling", title: "Production Scheduling", href: "/production/scheduling" },
      { key: "trim_packages", title: "Trim Packages Entry", href: "/station/trim_packages" },
      { key: "cryo_weight", title: "Cryo Weight Entry", href: "/station/cryo_weight" },
      // THE PREPACK (canon 0.30.188): after Cryo Weight Entry. The page is prepack.ts.
      { key: "prepack", title: "Prepack", href: "/station/prepack" },
      { key: "fulfillment", title: "Fulfillment", href: "/fulfillment" },
      { key: "inventory", title: "Inventory", href: "/inventory" },
    ],
  },
  {
    key: "marketplace",
    label: "Marketplace",
    icon: "storefront",
    href: "/marketplace",
    members: [{ key: "marketplace", title: "Marketplace", href: "/marketplace" }],
  },
  {
    key: "business_ops",
    label: "Business Operations",
    icon: "scales",
    href: "/ops/business_ops",
    members: [
      {
        key: "compliance_console",
        title: "Compliance Console",
        href: "/compliance",
      },
      {
        key: "purchasing",
        title: "Purchasing",
        href: "/purchasing",
      },
    ],
  },
];

/** The four flow edges. business_ops is the support island and carries none. */
export const OPS_FLOW_EDGES: OpsFlowEdge[] = [
  { from: "harvest_ops", to: "interco_logistics", dir: "right" },
  { from: "interco_logistics", to: "drying_ops", dir: "right" },
  { from: "drying_ops", to: "production_ops", dir: "down" },
  // Owner ruling 2026-09-02 (evening): "swap marketplace and business ops and
  // add the arrow in between." Business Operations joins the flow between
  // Production and Marketplace; the island is retired.
  { from: "production_ops", to: "business_ops", dir: "left" },
  { from: "business_ops", to: "marketplace", dir: "left" },
];

/** Phone device mode: one vertical chain in this order, every arrow down. */
export const OPS_PHONE_ORDER = [
  "harvest_ops",
  "interco_logistics",
  "drying_ops",
  "production_ops",
  "business_ops",
  "marketplace",
] as const;

/** Home-surface stations and pages of today that the map must cover once. */
export const HOME_SURFACE_KEYS = [
  "acquire_hbn",
  "wet_weight",
  "field_harvest",
  "unload_dry_space",
  "trim_packages",
  "cryo_weight",
  "internal_logistics",
  "processing_partners",
  "fulfillment",
  "inventory",
  "virtual_move_processor",
] as const;

export function opsGroupByKey(key: string): OpsGroup | undefined {
  return OPS_GROUPS.find((g) => g.key === key);
}

export function reservedOpsMemberByKey(key: string): { group: OpsGroup; member: OpsMember } | undefined {
  for (const group of OPS_GROUPS) {
    const member = group.members.find((m) => m.key === key && m.reserved);
    if (member) return { group, member };
  }
  return undefined;
}

export function opsMemberKeys(): string[] {
  return OPS_GROUPS.flatMap((g) => g.members.map((m) => m.key));
}

/** The ledger def owning a ledger table, from the registry; undefined for any
 * other table. The reasoned pencil and void use it to recompute the parent lot's
 * total column (owner rulings 2026-08-28 wet, 2026-08-31 dry). */
export function ledgerByTable(table: string): LedgerDef | undefined {
  const station = PIPELINE.find(
    (e): e is StationDef => e.kind === "station" && e.ledger?.table === table
  );
  return station?.ledger;
}
