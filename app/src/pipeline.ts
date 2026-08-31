export type LookupName =
  | "farms"
  | "grow_methods"
  | "strains"
  | "dry_spaces"
  | "package_types"
  | "people";

export type FieldDef =
  | {
      name: string;
      label: string;
      input: "date" | "text" | "time" | "textarea" | "number";
      required?: boolean;
    }
  | { name: string; label: string; input: "checkbox" }
  | { name: string; label: string; input: "lookup"; lookup: LookupName; required?: boolean }
  | {
      name: string;
      label: string;
      input: "queue_pick";
      queue: string;
      required?: boolean;
    }
  | { name: string; label: string; input: "package_rows" }
  | { name: string; label: string; input: "cryo_weights"; queue: string }
  /** Move To (owner ruling 2026-08-28): a dry_spaces select filtered to the picked
   * batch's farm kinds (MOVE_TO_KINDS_BY_FARM), with an Add a truck control beside it. */
  | { name: string; label: string; input: "move_to"; required?: boolean };

export type StationTransition = {
  action:
    | "create_harvest_batch"
    | "create_wet_weight"
    | "create_trim_packages"
    | "set_cryo_weight";
};

/** Where an entry renders: "home" tiles are the operator surface, "admin" lives under Admin, Data Queues. */
export type Surface = "home" | "admin";

export type StationDef = {
  key: string;
  kind: "station";
  title: string;
  surface: Surface;
  entity: string;
  fields: FieldDef[];
  transition: StationTransition;
  /** Person picker label override; default "Person" (owner ruling 2026-08-28: wet weight says Lead). */
  personLabel?: string;
  /** Submit button label override; default "Save". */
  submitLabel?: string;
  /** Feeding queue shown as the station's left pane; the picked row id arrives as a hidden pickField input.
   * groupBy (a field on the queue rows' values) renders the pane as collapsible groups.
   * paneFilter no_finished_lot (owner ruling 2026-08-28) hides open batches that already have a finished lot (drying, in_transit, or trimmed, non-voided); a weighing (unfinished) lot keeps the batch visible for resume. */
  leftPane?: { queue: string; pickField: string; groupBy?: string; paneFilter?: "no_finished_lot" };
  /** Weights ledger (owner ruling 2026-08-28): the station form is a header that starts a
   * lot in status weighing; weights collect on /station/<key>?lot=<id> as rows in ledger.table
   * and the lot's weight_grams stays the live total of the non-voided rows. */
  ledger?: { table: "wet_weights"; parentField: "wet_weight_entry_id" };
};

export type QueueControlDef =
  | { key: "mark_complete"; label: string }
  | { key: "mark_trimmed"; label: string }
  | { key: "release"; label: string };

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
};

export const EDITABLE_FIELDS: Record<string, EditFieldDef[]> = {
  harvest_batches: [
    { name: "entry_date", label: "Date", input: "date" },
    { name: "farm_code", label: "Farm", input: "lookup", lookup: "farms" },
    { name: "grow_method_code", label: "Grow Method", input: "lookup", lookup: "grow_methods" },
    { name: "strain_id", label: "Strain", input: "lookup", lookup: "strains" },
    { name: "manicure", label: "Manicure?", input: "checkbox" },
    { name: "silo_number", label: "Silo #", input: "text" },
    { name: "start_time", label: "Start Time", input: "time" },
    { name: "zone", label: "Zone", input: "text" },
    { name: "rows_text", label: "Rows", input: "text" },
    { name: "metrc_harvest_tag", label: "METRC Harvest Tag", input: "text" },
    { name: "status", label: "Status", input: "text" },
  ],
  wet_weight_entries: [
    { name: "weight_grams", label: "Total wet weight (g)", input: "number" },
    { name: "dry_space_id", label: "Move To", input: "lookup", lookup: "dry_spaces" },
    { name: "truck_number", label: "Truck #", input: "text" },
    { name: "notes", label: "Notes", input: "textarea" },
    { name: "status", label: "Status", input: "text" },
  ],
  wet_weights: [{ name: "weight_grams", label: "Weight (g)", input: "number" }],
  wip_packages: [
    { name: "package_code", label: "Package code", input: "text" },
    { name: "package_type_code", label: "Package type", input: "lookup", lookup: "package_types" },
    { name: "weight_grams", label: "Weight (g)", input: "number" },
    { name: "cryo_weight_grams", label: "Cryo weight (g)", input: "number" },
    { name: "status", label: "Status", input: "text" },
    { name: "test_outcome", label: "Test outcome", input: "text" },
  ],
  people: [
    { name: "display_name", label: "Name", input: "text" },
    // The login identity (owner ruling 2026-08-31); editable to attach or fix an email.
    { name: "email", label: "Email", input: "text" },
    { name: "is_active", label: "Active?", input: "checkbox" },
  ],
  farms: [{ name: "display_name", label: "Display name", input: "text" }],
  strains: [
    { name: "name", label: "Name", input: "text" },
    { name: "abbr", label: "Abbr", input: "text" },
    { name: "hbn_code", label: "HBN code", input: "text" },
  ],
  dry_spaces: [
    { name: "name", label: "Name", input: "text" },
    { name: "kind", label: "Kind", input: "text" },
    // Blank means shared across farms (owner ruling 2026-08-28).
    { name: "farm_code", label: "Farm", input: "lookup", lookup: "farms", optional: true },
  ],
  package_types: [
    { name: "display_name", label: "Display name", input: "text" },
    { name: "is_bud", label: "Is bud?", input: "checkbox" },
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
      { name: "entry_date", label: "Date", input: "date", required: true },
      { name: "farm_code", label: "Farm", input: "lookup", lookup: "farms", required: true },
      {
        name: "grow_method_code",
        label: "Grow Method",
        input: "lookup",
        lookup: "grow_methods",
        required: true,
      },
      { name: "strain_id", label: "Strain", input: "lookup", lookup: "strains", required: true },
      { name: "manicure", label: "Manicure?", input: "checkbox" },
      { name: "silo_number", label: "Silo #", input: "text" },
      { name: "start_time", label: "Start Time", input: "time" },
      { name: "zone", label: "Zone", input: "text" },
      { name: "rows_text", label: "Rows", input: "text" },
      { name: "metrc_harvest_tag", label: "METRC Harvest Tag", input: "text" },
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
    optionFields: ["hbn", "strain_name"],
    rowControls: [{ key: "mark_complete", label: "Mark complete" }],
  },
  {
    key: "wet_weight",
    kind: "station",
    surface: "home",
    title: "Wet Weight Entry",
    entity: "wet_weight_entries",
    personLabel: "Lead",
    submitLabel: "Start lot",
    fields: [
      {
        name: "harvest_batch_id",
        label: "HBN",
        input: "queue_pick",
        queue: "hbn_queue",
        required: true,
      },
      { name: "dry_space_id", label: "Move To", input: "move_to", required: true },
      { name: "notes", label: "Notes", input: "text" },
    ],
    transition: { action: "create_wet_weight" },
    leftPane: {
      queue: "hbn_queue",
      pickField: "harvest_batch_id",
      groupBy: "farm_code",
      paneFilter: "no_finished_lot",
    },
    ledger: { table: "wet_weights", parentField: "wet_weight_entry_id" },
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
    rowControls: [{ key: "mark_trimmed", label: "Mark trimmed" }],
  },
  {
    key: "inbound_queue",
    kind: "queue",
    surface: "admin",
    title: "Inbound Queue",
    entity: "wet_weight_entries",
    predicate: { field: "status", value: "in_transit" },
    columns: [
      { field: "hbn", label: "HBN" },
      { field: "weight_grams", label: "Total (g)" },
      { field: "dry_space_name", label: "Truck" },
      { field: "notes", label: "Notes" },
      { field: "created_at", label: "Created" },
    ],
    optionFields: ["hbn", "dry_space_name", "weight_grams"],
    groupBy: "dry_space_name",
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
        queue: "dry_space_queue",
        required: true,
      },
      { name: "packages", label: "Packages", input: "package_rows" },
    ],
    transition: { action: "create_trim_packages" },
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
    fields: [
      {
        name: "cryo_packages",
        label: "Packages",
        input: "cryo_weights",
        queue: "cryo_queue",
      },
    ],
    transition: { action: "set_cryo_weight" },
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
      { field: "hbn", label: "HBN" },
      { field: "created_at", label: "Created" },
    ],
    optionFields: ["package_code", "hbn"],
    rowControls: [{ key: "release", label: "Release" }],
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
