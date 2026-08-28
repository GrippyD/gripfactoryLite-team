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
  | { name: string; label: string; input: "cryo_weights"; queue: string };

export type StationTransition = {
  action:
    | "create_harvest_batch"
    | "create_wet_weight"
    | "create_trim_packages"
    | "set_cryo_weight";
};

export type StationDef = {
  key: string;
  kind: "station";
  title: string;
  entity: string;
  fields: FieldDef[];
  transition: StationTransition;
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
    { name: "weight_grams", label: "Weight (g)", input: "number" },
    { name: "dry_space_id", label: "Dry Space", input: "lookup", lookup: "dry_spaces" },
    { name: "notes", label: "Notes", input: "textarea" },
    { name: "status", label: "Status", input: "text" },
  ],
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
    { name: "is_active", label: "Active?", input: "checkbox" },
  ],
  strains: [
    { name: "name", label: "Name", input: "text" },
    { name: "abbr", label: "Abbr", input: "text" },
    { name: "hbn_code", label: "HBN code", input: "text" },
  ],
  dry_spaces: [
    { name: "name", label: "Name", input: "text" },
    { name: "kind", label: "Kind", input: "text" },
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
 * Pipeline order is data. Reorder this array to reorder the home page.
 * Insert a new station by adding an entry and a matching action handler.
 * Do not edit existing entries to make room.
 */
export const PIPELINE: PipelineEntry[] = [
  {
    key: "acquire_hbn",
    kind: "station",
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
    title: "Wet Weight Entry",
    entity: "wet_weight_entries",
    fields: [
      {
        name: "harvest_batch_id",
        label: "HBN",
        input: "queue_pick",
        queue: "hbn_queue",
        required: true,
      },
      { name: "weight_grams", label: "Weight (g)", input: "number", required: true },
      {
        name: "dry_space_id",
        label: "Dry space",
        input: "lookup",
        lookup: "dry_spaces",
        required: true,
      },
      { name: "notes", label: "Notes", input: "textarea" },
    ],
    transition: { action: "create_wet_weight" },
  },
  {
    key: "dry_space_queue",
    kind: "queue",
    title: "Dry Space Queue",
    entity: "wet_weight_entries",
    predicate: { field: "status", value: "drying" },
    columns: [
      { field: "hbn", label: "HBN" },
      { field: "weight_grams", label: "Weight (g)" },
      { field: "dry_space_name", label: "Dry space" },
      { field: "notes", label: "Notes" },
      { field: "created_at", label: "Created" },
    ],
    optionFields: ["hbn", "dry_space_name", "weight_grams"],
    groupBy: "dry_space_name",
    rowControls: [{ key: "mark_trimmed", label: "Mark trimmed" }],
  },
  {
    key: "trim_packages",
    kind: "station",
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
