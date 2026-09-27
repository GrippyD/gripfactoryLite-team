/**
 * Interco Logistics helpers. Manifest emission is the T3+ Tools Licensed
 * Transfers upload (canon 0.17.1). Three header rows match the vendored blank
 * template byte for byte. MANIFEST_COLUMNS is the field-path row so a later
 * owner edit lands in one place.
 */

import {
  barnLocationForSite,
  FLOOR_SITE_ORDER,
  inheritedLotLicense,
  LICENSE_ARL_AU,
  LICENSE_AU_GROW,
  LICENSE_PNS_AU,
  LOC_IN_TRANSIT,
  metrcLocationName,
  shortLotId,
  SITE_LICENSES,
  siteOfLicense,
  treeLicenseForPackage,
  type FloorSite,
} from "./config";

export const MANIFEST_COLUMNS = [
  "destination.RecipientId",
  "destination.PlannedRoute",
  "destination.TransferTypeId",
  "destination.InvoiceNumber",
  "destination.PaymentTermDays",
  "destination.EstimatedDepartureDateTime",
  "destination.EstimatedArrivalDateTime",
  "destination.GrossWeight",
  "destination.GrossUnitOfWeightId",
  "transporter.TransporterId",
  "transporter.PhoneNumberForQuestions",
  "transporter.IsLayover",
  "transporterDetail.DriverId",
  "transporterDetail.DriverName",
  "transporterDetail.DriverOccupationalLicenseNumber",
  "transporterDetail.DriverLicenseNumber",
  "transporterDetail.DriverLayoverLeg",
  "transporterDetail.VehicleId",
  "transporterDetail.VehicleMake",
  "transporterDetail.VehicleModel",
  "transporterDetail.VehicleLicensePlateNumber",
  "transporterDetail.VehicleRegistrationNumber",
  "package.Id",
  "package.WholesalePrice",
  "package.GrossWeight",
  "package.GrossUnitOfWeightId",
] as const;

export type ManifestColumn = (typeof MANIFEST_COLUMNS)[number];

/** Three T3 header rows plus the trailing CRLF the blank template carries. */
export const T3_MANIFEST_HEADER =
  "destination in line.Destinations,destination in line.Destinations,destination in line.Destinations,destination in line.Destinations,destination in line.Destinations,destination in line.Destinations,destination in line.Destinations,destination in line.Destinations,destination in line.Destinations,transporter in destination.Transporters,transporter in destination.Transporters,transporter in destination.Transporters,transporterDetail in transporter.TransporterDetails,transporterDetail in transporter.TransporterDetails,transporterDetail in transporter.TransporterDetails,transporterDetail in transporter.TransporterDetails,transporterDetail in transporter.TransporterDetails,transporterDetail in transporter.TransporterDetails,transporterDetail in transporter.TransporterDetails,transporterDetail in transporter.TransporterDetails,transporterDetail in transporter.TransporterDetails,transporterDetail in transporter.TransporterDetails,package in destination.Packages,package in destination.Packages,package in destination.Packages,package in destination.Packages\r\n" +
  "destination.RecipientId,destination.PlannedRoute,destination.TransferTypeId,destination.InvoiceNumber,destination.PaymentTermDays,destination.EstimatedDepartureDateTime,destination.EstimatedArrivalDateTime,destination.GrossWeight,destination.GrossUnitOfWeightId,transporter.TransporterId,transporter.PhoneNumberForQuestions,transporter.IsLayover,transporterDetail.DriverId,transporterDetail.DriverName,transporterDetail.DriverOccupationalLicenseNumber,transporterDetail.DriverLicenseNumber,transporterDetail.DriverLayoverLeg,transporterDetail.VehicleId,transporterDetail.VehicleMake,transporterDetail.VehicleModel,transporterDetail.VehicleLicensePlateNumber,transporterDetail.VehicleRegistrationNumber,package.Id,package.WholesalePrice,package.GrossWeight,package.GrossUnitOfWeightId\r\n" +
  'License Number,Planned Route,Type,Destination Invoice Number,Payment Terms,Destination Estimated Departure Date Time,Destination Estimated Arrival Date Time,Destination Gross Weight,Destination Gross Weight,License Number,Phone No.,Layover,Driver Name,Driver\'s Name,Transporter Detail Driver Occupational License Number,Driver\'s Lic. No.,Layover Leg,"Vehicle Make, Model, Or License Plate",Vehicle Make,Vehicle Model,License Plate,Registration Number,Package,Package Wholesale Price,Gross Weight,Gross Weight\r\n';

export type T3ManifestHeader = {
  recipientId: string;
  plannedRoute: string;
  transferType: string;
  invoiceNumber: string;
  paymentTermDays: string;
  estimatedDeparture: string;
  estimatedArrival: string;
  grossWeight: string;
  grossWeightUom: string;
  transporterId: string;
  transporterPhone: string;
  driverName: string;
  driverOccupationalLicense: string;
  driverLicenseNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
};

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function destTransporterCells(header: T3ManifestHeader, includeTransporter: boolean): string[] {
  if (!includeTransporter) {
    return [
      header.recipientId,
      header.plannedRoute,
      header.transferType,
      header.invoiceNumber,
      header.paymentTermDays,
      header.estimatedDeparture,
      header.estimatedArrival,
      header.grossWeight,
      header.grossWeightUom,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ];
  }
  return [
    header.recipientId,
    header.plannedRoute,
    header.transferType,
    header.invoiceNumber,
    header.paymentTermDays,
    header.estimatedDeparture,
    header.estimatedArrival,
    header.grossWeight,
    header.grossWeightUom,
    header.transporterId,
    header.transporterPhone,
    "",
    "",
    header.driverName,
    header.driverOccupationalLicense,
    header.driverLicenseNumber,
    "",
    "",
    header.vehicleMake,
    header.vehicleModel,
    header.vehiclePlate,
    "",
  ];
}

/** A package row on the manifest: the METRC tag and, THE MANIFEST BUILDER
 * (canon 0.30.125, his pick "A price box per added package"), the wholesale
 * price typed beside it, blank when none was. */
export type ManifestPackage = { id: string; wholesalePrice?: string | null };

function packageCells(pkg: ManifestPackage): string[] {
  return [pkg.id, String(pkg.wholesalePrice ?? "").trim(), "", ""];
}

function asManifestPackage(p: string | ManifestPackage): ManifestPackage {
  return typeof p === "string" ? { id: p } : p;
}

/** T3 block layout: first data row carries dest/transporter plus package 1; later rows fill package columns only. */
export function manifestCsv(
  header: T3ManifestHeader,
  packageIds: ReadonlyArray<string | ManifestPackage>,
  opts: { includeTransporter?: boolean } = {}
): string {
  const includeTransporter = opts.includeTransporter !== false;
  const dest = destTransporterCells(header, includeTransporter);
  const packages = packageIds.map(asManifestPackage);
  const rows: string[] = [];
  if (packages.length === 0) {
    rows.push([...dest, ...packageCells({ id: "" })].map(csvCell).join(","));
  } else {
    rows.push([...dest, ...packageCells(packages[0])].map(csvCell).join(","));
    for (const pkg of packages.slice(1)) {
      rows.push([...Array(22).fill(""), ...packageCells(pkg)].map(csvCell).join(","));
    }
  }
  return T3_MANIFEST_HEADER + rows.join("\r\n") + "\r\n";
}

export function movementIdShort(id: string): string {
  return id.replaceAll("-", "").slice(0, 8);
}

export function manifestFilename(movementId: string, yyyymmdd: string): string {
  return `manifest_${movementIdShort(movementId)}_${yyyymmdd}.csv`;
}

export function yyyymmddFromIso(iso: string): string {
  return iso.slice(0, 10).replaceAll("-", "");
}

export const MOVEMENT_STATUS = {
  building: "building",
  completed: "completed",
  voided: "voided",
} as const;

export const MOVEMENT_KIND = {
  interco: "interco",
  virtual: "virtual",
} as const;

/** Owner ruling 2026-09-06 (canon 0.26.0): "logistics moves, like everything
 * else, needs a place in the data queue in Admin as well." The queue's void
 * guard, pure so the renderer and the action share one law: a movement with
 * any received item refuses the void until its receipts un-receive. */
export function movementVoidBlock(
  items: ReadonlyArray<{ received_at: string | null; deleted_at: string | null }>
): string | null {
  const received = items.some((i) => !i.deleted_at && i.received_at);
  return received ? "Un-receive its receipts first." : null;
}

/** Provisional METRC receive shape (Scribe-ruled). One constant so a later
 * T3 receive template is a one-line edit. */
export const RECEIVE_CSV_HEADER =
  "ManifestNumber,PackageTag,ReceivedQuantity,UnitOfWeight,ReceivedDate,ReceivingLicense";

export type ReceiveCsvRow = {
  manifestNumber: string;
  packageTag: string;
  receivedQuantity: string;
  unitOfWeight: string;
  receivedDate: string;
  receivingLicense: string;
};

export function receiveCsv(rows: readonly ReceiveCsvRow[]): string {
  const body = rows.map((row) =>
    [
      row.manifestNumber,
      row.packageTag,
      row.receivedQuantity,
      row.unitOfWeight,
      row.receivedDate,
      row.receivingLicense,
    ]
      .map(csvCell)
      .join(",")
  );
  return RECEIVE_CSV_HEADER + "\r\n" + (body.length ? body.join("\r\n") + "\r\n" : "");
}

export function receiveFilename(receiptId: string, yyyymmdd: string): string {
  return `receive_manifest_${movementIdShort(receiptId)}_${yyyymmdd}.csv`;
}

/** Provisional METRC package-finish shape. No T3 finish template exists yet.
 * One constant so a later owner template is a one-line edit. */
export const FINISH_CSV_HEADER = "Label,FinishDate";

export type FinishCsvRow = {
  label: string;
  finishDate: string;
};

export function packageFinishCsv(rows: readonly FinishCsvRow[]): string {
  const body = rows.map((row) => [row.label, row.finishDate].map(csvCell).join(","));
  return FINISH_CSV_HEADER + "\r\n" + (body.length ? body.join("\r\n") + "\r\n" : "");
}

export function finishFilename(sessionId: string, yyyymmdd: string): string {
  return `package_finish_${movementIdShort(sessionId)}_${yyyymmdd}.csv`;
}

/** Canon 0.30.6: the Load Silo location change, "832 Barn - 832 Silo n with
 * all the important bits and pieces". PROVISIONAL header in the METRC package
 * location-change shape (Label, Location, Sublocation, MoveDate): the owner
 * owes the real template with the T3 set; the shape swaps in one edit. The
 * origin (Barn) is not a METRC column; the destination is the silo. */
export const LOCATION_CHANGE_CSV_HEADER = "Label,Location,Sublocation,MoveDate";

export type LocationChangeCsvRow = {
  label: string;
  location: string;
  moveDate: string;
};

export function locationChangeCsv(rows: readonly LocationChangeCsvRow[]): string {
  // THE LOCATION WITHOUT THE FARM (canon 0.30.82): METRC gets the location without our site prefix.
  const body = rows.map((row) => [row.label, metrcLocationName(row.location), "", row.moveDate].map(csvCell).join(","));
  return LOCATION_CHANGE_CSV_HEADER + "\r\n" + (body.length ? body.join("\r\n") + "\r\n" : "");
}

export function locationChangeFilename(hbn: string, siloName: string, yyyymmdd: string, seq: number | null = 1): string {
  const silo = siloName.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const n = seq && seq > 0 ? seq : 1;
  return `location_change_${hbn}(${n})_${silo}_${yyyymmdd}.csv`;
}

/** Prefer the TL-typed METRC/T3 number; otherwise the movement id short. */
export function displayManifestNumber(
  movementId: string,
  metrcManifestNumber?: string | null
): string {
  const typed = (metrcManifestNumber ?? "").trim();
  return typed || movementIdShort(movementId);
}

export function farmCodeFromLicenseLabel(label: string): string {
  const prefix = label.trim().split(/\s+/)[0] ?? "";
  if (prefix === "PNN" || prefix === "PNS" || prefix === "ARL") return prefix;
  return "";
}

export function licenseOptionLabel(value: string, label: string): string {
  return `${value} - ${label}`;
}

export function licenseToneClass(tone: string | null | undefined): string {
  if (tone === "blue" || tone === "yellow" || tone === "green") return `tone-${tone}`;
  return "";
}

export function receivingLine(input: {
  originFarm: string | null | undefined;
  manifestNumber: string;
  truckNumber: string | null | undefined;
  weight: string;
}): string {
  return `${input.originFarm ?? ""} - ${input.manifestNumber} - ${input.truckNumber ?? ""} - ${input.weight}`;
}

export const INTERCO_SITES = ["arl", "pnn", "pns"] as const;
export type IntercoSite = (typeof INTERCO_SITES)[number];

export function parseIntercoSite(raw: string | undefined | null): IntercoSite | null {
  const v = String(raw ?? "").toLowerCase();
  return (INTERCO_SITES as readonly string[]).includes(v) ? (v as IntercoSite) : null;
}

export function siteFarmCode(site: IntercoSite): "ARL" | "PNN" | "PNS" {
  if (site === "arl") return "ARL";
  if (site === "pns") return "PNS";
  return "PNN";
}

export function farmToSite(farm: string | null | undefined): IntercoSite {
  const v = String(farm ?? "").toUpperCase();
  if (v === "ARL") return "arl";
  if (v === "PNS") return "pns";
  return "pnn";
}

export type IntercoLaneId = "arl-pnn" | "pns-pnn" | "pns-arl" | "pnn-arl";

export type IntercoLane = {
  id: IntercoLaneId;
  from: "ARL" | "PNN" | "PNS";
  to: "ARL" | "PNN" | "PNS";
  purpose: string;
  arrivalLine: string;
};

/** Lanes FROM a site per the owner map. No license picker: the lane knows. */
export const INTERCO_LANES: readonly IntercoLane[] = [
  {
    id: "arl-pnn",
    from: "ARL",
    to: "PNN",
    purpose: "Mostly ships north.",
    arrivalLine: "Lands the PNN barn and becomes 832 on arrival, regardless.",
  },
  {
    id: "pns-pnn",
    from: "PNS",
    to: "PNN",
    purpose: "Ships north from the PNS barn.",
    arrivalLine: "Lands the PNN barn and becomes 832 on arrival, regardless.",
  },
  {
    id: "pns-arl",
    from: "PNS",
    to: "ARL",
    purpose: "Wet comes back to hang.",
    arrivalLine: "Lands the ARL barn and becomes ARL AU on arrival.",
  },
  {
    id: "pnn-arl",
    from: "PNN",
    to: "ARL",
    purpose: "Wet comes back to hang.",
    arrivalLine: "Lands the ARL barn and becomes ARL AU on arrival.",
  },
];

export function lanesFromSite(site: IntercoSite): IntercoLane[] {
  const farm = siteFarmCode(site);
  return INTERCO_LANES.filter((lane) => lane.from === farm);
}

export function laneById(id: string | null | undefined): IntercoLane | null {
  return INTERCO_LANES.find((lane) => lane.id === id) ?? null;
}

export function originLicenseForLane(lane: IntercoLane): string {
  if (lane.from === "ARL") return LICENSE_ARL_AU;
  if (lane.from === "PNS") return LICENSE_PNS_AU;
  return LICENSE_AU_GROW;
}

export function destinationLicenseForLane(lane: IntercoLane): string {
  if (lane.to === "ARL") return LICENSE_ARL_AU;
  if (lane.to === "PNS") return LICENSE_PNS_AU;
  return LICENSE_AU_GROW;
}

/** Wet trucks without a dest field: ARL/PNS origin heads PNN; PNN origin heads ARL (hang). */
export function wetTruckDestSite(originFarm: string | null | undefined): IntercoSite {
  const farm = String(originFarm ?? "").toUpperCase();
  if (farm === "PNN") return "arl";
  return "pnn";
}

export type RoadChip = {
  kind: "truck" | "movement";
  label: string;
  destSite: IntercoSite;
  href: string;
};

export type RoadTruckIn = {
  id: string;
  truck_number: string | null;
  weight_grams: number;
  farm_code: string | null;
  strain_name: string | null;
  manifest_id?: string | null;
  metrc_manifest_number?: string | null;
};

export type RoadMovementIn = {
  id: string;
  origin_farm: string | null;
  destination_farm: string | null;
  metrc_manifest_number: string | null;
};

export type RoadItemIn = {
  package_code: string;
  hbn?: string | null;
  strain_name: string | null;
  qty: number;
};

/** THE TRUCK CARRIES ITS PAPER (owner bug report 2026-09-08, canon 0.30.9,
 * "589af120 is an orphan"): the ON THE ROAD chips. A truck row names its
 * manifest ("Truck 1 - ARL / Strain - 1,500.00 g - Manifest 589af120"); a
 * manifest chip names its contents (one package: code / strain / grams; more:
 * the count and the total), never a bare id. Manifests riding a truck lot are
 * already excluded upstream (listInboundMovements), so nothing lists twice. */
export function roadChips(
  trucks: RoadTruckIn[],
  movements: RoadMovementIn[],
  itemsByMovement: Record<string, RoadItemIn[]>,
  words: { truck: string; manifest: string; packages: string },
  formatGramsFn: (n: number) => string
): RoadChip[] {
  const truckChips: RoadChip[] = trucks.map((lot) => {
    const dest = wetTruckDestSite(lot.farm_code);
    const head = lot.truck_number ? `${words.truck} ${lot.truck_number} - ` : "";
    const body = `${[lot.farm_code, lot.strain_name].filter(Boolean).join(" / ")} - ${formatGramsFn(Number(lot.weight_grams))} g`;
    const paper = lot.manifest_id
      ? ` - ${words.manifest} ${displayManifestNumber(lot.manifest_id, lot.metrc_manifest_number)}`
      : "";
    return { kind: "truck", label: `${head}${body}${paper}`, destSite: dest, href: `/interco/arrivals/${dest}` };
  });
  const movementChips: RoadChip[] = movements.map((m) => {
    const dest = farmToSite(m.destination_farm);
    const items = itemsByMovement[m.id] ?? [];
    const route = [m.origin_farm, m.destination_farm].filter(Boolean).join(" - ") || words.manifest;
    let contents = "";
    if (items.length === 1) {
      const it = items[0];
      contents = ` - ${[it.package_code || shortLotId(it.hbn ?? "", null), it.strain_name].filter(Boolean).join(" / ")} - ${formatGramsFn(Number(it.qty))} g`;
    } else if (items.length > 1) {
      const total = items.reduce((n, it) => n + Number(it.qty), 0);
      contents = ` - ${items.length} ${words.packages} - ${formatGramsFn(total)} g`;
    }
    return {
      kind: "movement",
      label: `${route} - ${displayManifestNumber(m.id, m.metrc_manifest_number)}${contents}`,
      destSite: dest,
      href: `/interco/arrivals/${dest}?movement=${encodeURIComponent(m.id)}`,
    };
  });
  return [...truckChips, ...movementChips];
}

export type FloorPackageIn = {
  id: string;
  package_code: string;
  qty: number;
  license_value: string;
  location: string;
  strain_name: string | null;
  hbn: string | null;
};

export type FloorLotIn = {
  id: string;
  truck_number: string | null;
  weight_grams: number;
  farm_code: string | null;
  entry_date: string | null;
  strain_name: string | null;
  hbn: string | null;
  license_value?: string | null;
};

export type FloorMaterialRow = {
  kind: "package" | "lot";
  id: string;
  title: string;
  weightGrams: number;
  lotToken: string;
  marketStrain: string;
  location: string;
  originLicense: string;
  originLocation: string;
  truckNumber?: string | null;
};

export type FloorLicenseLine = {
  license: string;
  items: FloorMaterialRow[];
};

export type FloorSiteWindow = {
  site: FloorSite;
  licenses: FloorLicenseLine[];
};

export function emptyFloorWindows(): FloorSiteWindow[] {
  return FLOOR_SITE_ORDER.map((site) => ({
    site,
    licenses: SITE_LICENSES[site].map((license) => ({ license, items: [] })),
  }));
}

/** One list per license line. Packages and wet lots share the line. */
export function buildFloorWindows(packages: FloorPackageIn[], lots: FloorLotIn[]): FloorSiteWindow[] {
  const buckets = new Map<string, FloorMaterialRow[]>();
  for (const site of FLOOR_SITE_ORDER) {
    for (const lic of SITE_LICENSES[site]) buckets.set(lic, []);
  }
  for (const p of packages) {
    if (p.location === LOC_IN_TRANSIT) continue;
    const license = treeLicenseForPackage(p.license_value, p.location);
    const list = buckets.get(license);
    if (!list) continue;
    list.push({
      kind: "package",
      id: p.id,
      title: p.package_code,
      weightGrams: Number(p.qty),
      lotToken: shortLotId(p.hbn ?? "", null),
      marketStrain: p.strain_name ?? "",
      location: p.location,
      originLicense: license,
      originLocation: p.location,
    });
  }
  for (const lot of lots) {
    const license = inheritedLotLicense(lot.license_value, lot.farm_code);
    const site = siteOfLicense(license) ?? "PNN";
    const originLocation = barnLocationForSite(site);
    const list = buckets.get(license);
    if (!list) continue;
    const simple = [lot.farm_code, lot.strain_name, lot.entry_date].filter(Boolean).join(" / ");
    list.push({
      kind: "lot",
      id: lot.id,
      title: simple,
      weightGrams: Number(lot.weight_grams),
      lotToken: shortLotId(lot.hbn ?? "", null),
      marketStrain: lot.strain_name ?? "",
      location: originLocation,
      originLicense: license,
      originLocation,
      truckNumber: lot.truck_number,
    });
  }
  return FLOOR_SITE_ORDER.map((site) => ({
    site,
    licenses: SITE_LICENSES[site].map((license) => ({
      license,
      items: buckets.get(license) ?? [],
    })),
  }));
}
