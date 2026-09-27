/**
 * Admin Data Lookups landing. Category headings are also the Category segment
 * of the field help paths: Admin\Data Lookups\<Category>\<LookupFieldName>.
 */

export type LookupLandingSection = {
  category: string;
  buttons: Array<{
    key: string;
    title: string;
    href: string;
    description: string;
    lookupFieldName: string;
  }>;
};

export const LOOKUP_LANDING: LookupLandingSection[] = [
  {
    category: "Harvest Operations",
    buttons: [
      {
        key: "strains",
        title: "Strains",
        href: "/admin/lookups/strains",
        description: "Names and HBN codes that ride every harvest batch and lot.",
        lookupFieldName: "Strains",
      },
      {
        key: "grow_methods",
        title: "Grow Methods",
        href: "/admin/lookups/grow_methods",
        description: "GH, indoor, and outdoor codes that mint into the HBN.",
        lookupFieldName: "Grow Methods",
      },
      {
        key: "farms",
        title: "Farms",
        href: "/admin/lookups/farms",
        description: "Holding farms on batches, lots, and the inventory ledger.",
        lookupFieldName: "Farms",
      },
      {
        key: "dry_spaces",
        title: "Dry Spaces",
        href: "/admin/lookups/dry_spaces",
        description: "Hang rooms, silos, and the truck sentinel that route a wet lot.",
        lookupFieldName: "Dry Spaces",
      },
      {
        key: "silo_number",
        title: "Silo #",
        href: "/admin/lookups/silo_number",
        description: "Planned dry slot on Acquire HBN (1 through 5, or NA).",
        lookupFieldName: "Silo #",
      },
    ],
  },
  {
    category: "Production Operations",
    buttons: [
      {
        key: "package_types",
        title: "Package Types",
        href: "/admin/lookups/package_types",
        description: "Trim package types and the extraction-bound code list.",
        lookupFieldName: "Package Types",
      },
      {
        // THE TRIM BOGEY (canon 0.30.249): the trim plume's product line, one whole percent.
        key: "trim_bogey",
        title: "Trim Bogey",
        href: "/admin/lookups/trim_bogey",
        description: "The trim plume's product line, a percent: that many of its last squares, in ROYGBIVWB-Aqua order, turn dark red when consumed.",
        lookupFieldName: "Trim Bogey",
      },
    ],
  },
  {
    category: "Logistics",
    buttons: [
      {
        key: "inventory_locations",
        title: "Inventory Locations",
        href: "/admin/lookups/inventory_locations",
        description: "Barns are the inbox at every site. CSA is 832-side staging. CSB and unknown spots are processor under 694.",
        lookupFieldName: "Inventory Locations",
      },
      {
        // THE CHANGE LOCATION SETUP (canon 0.30.40): the rows, houses and barns
        // plants live in, per license as METRC names them.
        key: "field_locations",
        title: "Field Locations",
        href: "/admin/lookups/field_locations",
        description: "Where plants live: the rows, greenhouses and barns per license, as METRC names them. License blank means every license at the farm.",
        lookupFieldName: "Field Locations",
      },
      {
        key: "licenses",
        title: "Licenses",
        href: "/admin/lookups/licenses",
        description: "AU-Grow and AU-Processor labels on inventory and manifests.",
        lookupFieldName: "Licenses",
      },
    ],
  },
  {
    category: "People and System",
    buttons: [
      {
        key: "people",
        title: "People",
        href: "/admin/lookups/people",
        description: "Login identities, Lead picker names, and the TL on unload.",
        lookupFieldName: "People",
      },
      {
        // prepack_units, prepack_items, prepack_location (0.30.188) and metrc_release_states (0.30.193) are standing values.
        key: "app_config",
        title: "App config",
        href: "/admin/lookups/app_config",
        description: "Standing keys: PIN, yield, extraction codes, plant-split jitter, audit interval.",
        lookupFieldName: "App config",
      },
      {
        // Owner ruling 2026-09-08 (canon 0.30.12): every sign-off picks from
        // these names; Kieth leads on the RTUs.
        key: "sign_off_names",
        title: "Sign-off names",
        href: "/admin/lookups/sign_off_names",
        description: "The names every sign-off picks from: trim and cryo operators, the unload operator, PM and ticket signatures.",
        lookupFieldName: "Sign-off names",
      },
    ],
  },
  {
    category: "Business Operations",
    buttons: [
      {
        key: "failure_modes",
        title: "Failure modes",
        href: "/admin/lookups/failure_modes",
        description: "External test failure modes that feed the compliance pareto.",
        lookupFieldName: "Failure modes",
      },
      {
        key: "testing_labs",
        title: "Testing labs",
        href: "/admin/lookups/testing_labs",
        description: "The desk's labs. SC Labs, ACT Laboratories, Lab Link, and Viridis (closed).",
        lookupFieldName: "Testing labs",
      },
      {
        key: "label_stock",
        title: "Label stock",
        href: "/admin/lookups/label_stock",
        description: "Thermal stock sizes for the in-repo label maker.",
        lookupFieldName: "Label stock",
      },
      {
        key: "label_printers",
        title: "Label printers",
        href: "/admin/lookups/label_printers",
        description: "Browser-printed devices on the floor. Names only; no drivers.",
        lookupFieldName: "Label printers",
      },
    ],
  },
  {
    category: "Marketplace",
    buttons: [
      {
        key: "listing_categories",
        title: "Listing Categories",
        href: "/admin/lookups/listing_categories",
        description: "Categories on marketplace listings. The owner corrects this list.",
        lookupFieldName: "Listing Categories",
      },
    ],
  },
  {
    // THE METRC MIRROR (canon 0.30.38, fork F1 "Mirror + field registry"): our
    // own fields on the state's plants and packages, keyed by tag; a new field
    // is a row here, not a migration.
    category: "Inventory",
    buttons: [
      {
        key: "internal_fields",
        title: "Internal fields",
        href: "/admin/lookups/internal_fields",
        description: "Our own fields on METRC plants and packages, keyed by tag. Value is the field key, Label its name, Tone what it applies to: plants, packages, or blank for both.",
        lookupFieldName: "Internal fields",
      },
    ],
  },
];

export const LOOKUP_VALUE_SECTIONS: Record<string, { category: string; title: string }> = {
  silo_number: { category: "silo_number", title: "Silo #" },
  inventory_locations: { category: "inventory_location", title: "Inventory Locations" },
  licenses: { category: "license", title: "Licenses" },
  failure_modes: { category: "failure_mode", title: "Failure modes" },
  testing_labs: { category: "testing_lab", title: "Testing labs" },
  label_stock: { category: "label_stock", title: "Label stock" },
  label_printers: { category: "label_printer", title: "Label printers" },
  listing_categories: { category: "listing_category", title: "Listing Categories" },
  sign_off_names: { category: "sign_off_name", title: "Sign-off names" },
  internal_fields: { category: "internal_field", title: "Internal fields" },
  field_locations: { category: "field_location", title: "Field Locations" },
};

export function lookupHelpPath(category: string, fieldName: string): string {
  return `Admin\\Data Lookups\\${category}\\${fieldName}`;
}

export function lookupLandingButton(key: string) {
  for (const section of LOOKUP_LANDING) {
    const hit = section.buttons.find((b) => b.key === key);
    if (hit) return { section, button: hit };
  }
  return undefined;
}

/** True when help copy ends with the owner's Admin\\Data Lookups path. */
export function helpHasLookupPath(help: string, category: string, fieldName: string): boolean {
  return help.includes(lookupHelpPath(category, fieldName));
}

/** Registry field name -> landing Category and LookupFieldName for help-path tests. */
export const LOOKUP_BACKED_FIELDS: Record<string, { category: string; fieldName: string }> = {
  farm_code: { category: "Harvest Operations", fieldName: "Farms" },
  grow_method_code: { category: "Harvest Operations", fieldName: "Grow Methods" },
  strain_id: { category: "Harvest Operations", fieldName: "Strains" },
  planned_dryspc: { category: "Harvest Operations", fieldName: "Silo #" },
  actual_dryspc: { category: "Harvest Operations", fieldName: "Dry Spaces" },
  packages: { category: "Production Operations", fieldName: "Package Types" },
};
