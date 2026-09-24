import { describe, expect, it } from "vitest";
import { manifestCsv, T3_MANIFEST_HEADER, type T3ManifestHeader } from "../src/interco";
import {
  MANIFEST_HEADER_FIELDS,
  MANIFEST_REFUSAL,
  compareByLastSix,
  headerFromMovement,
  lastSix,
  lastSixNumber,
  manifestBuilderPage,
  manifestCsvPath,
  matchesLastSix,
  packageRow,
  parseFinishForm,
  receiveIntoList,
  sortByLastSix,
  type ManifestBuilderData,
  type MirrorPackage,
} from "../src/manifest";

const T = (n: string) => `1A4050300000000000${n}`; // 18 + 6 = 24 characters

const LICENSES = [
  { value: "AU-G-C-000832", label: "PNN AU Grow", farm_code: "PNN" },
  { value: "AU-P-000694", label: "PNN Processor", farm_code: "PNN" },
  { value: "AU-G-C-001509", label: "ARL AU Grow", farm_code: "ARL" },
];

function pkg(tag: string, extra: Partial<MirrorPackage> = {}): MirrorPackage {
  return { tag, item: "BUD - Goji - PNN - O", category: "Buds", quantity: 336, uom: "g", location: "Barn", ...extra };
}

function data(over: Partial<ManifestBuilderData> = {}): ManifestBuilderData {
  return {
    licenses: LICENSES,
    origin: null,
    dest: null,
    packages: [],
    manifested: new Map(),
    locationsByLicense: { "AU-P-000694": ["Trim Room 1", "Cryo 1"], "AU-G-C-000832": ["Barn", "24.2.A"] },
    prefillByDestination: {},
    finished: null,
    ...over,
  };
}

function form(entries: Array<[string, string]>): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

const HEADER_OK: Array<[string, string]> = [
  ["origin_license", "AU-P-000694"],
  ["destination_license", "AU-G-C-000832"],
  ["destination_location", "Barn"],
  ["planned_route", "North on 51\nEast on 94"],
  ["transfer_type", "Transfer"],
];

describe("THE MANIFEST BUILDER: the last six (owner: ordered numerically based on the last six digits)", () => {
  it("reads the last six of a tag, upper-cased, and their number when they are digits", () => {
    expect(lastSix("1a40503000311fb000052619")).toBe("052619");
    expect(lastSixNumber(T("052619"))).toBe(52619);
    expect(lastSixNumber(T("000E01"))).toBeNull();
    expect(lastSix("")).toBe("");
  });

  it("sorts numeric tails ascending, a non-numeric tail after them, ties by the whole tag", () => {
    const rows = [pkg(T("001001")), pkg(T("000012")), pkg(T("000E01")), pkg(T("000105")), pkg("1A4050300000000000999999"), pkg("1A4050300000000001000012")];
    const sorted = sortByLastSix(rows).map((r) => r.tag);
    expect(sorted).toEqual([
      T("000012"),
      "1A4050300000000001000012",
      T("000105"),
      T("001001"),
      "1A4050300000000000999999",
      T("000E01"),
    ]);
    expect(compareByLastSix(T("000012"), T("000012"))).toBe(0);
    expect(compareByLastSix(T("000E01"), T("000A01"))).toBeGreaterThan(0);
  });

  it("filters on the typed digits anywhere in the last six, and on the whole tag past six characters", () => {
    expect(matchesLastSix(T("052619"), "")).toBe(true);
    expect(matchesLastSix(T("052619"), "05")).toBe(true);
    expect(matchesLastSix(T("052619"), "2619")).toBe(true);
    expect(matchesLastSix(T("052619"), "052619")).toBe(true);
    expect(matchesLastSix(T("052619"), "052618")).toBe(false);
    expect(matchesLastSix(T("052619"), "1a405030")).toBe(true);
    expect(matchesLastSix(T("052619"), "1A99")).toBe(false);
    expect(matchesLastSix(T("000E01"), "e01")).toBe(true);
  });
});

describe("THE MANIFEST BUILDER: receive into (his pick Mirror only)", () => {
  it("drops blanks, dedupes, and sorts naturally", () => {
    expect(receiveIntoList(["Trim Room 10", "Trim Room 2", "", null, "Trim Room 2", " Cryo 1 "])).toEqual([
      "Cryo 1",
      "Trim Room 2",
      "Trim Room 10",
    ]);
  });
});

describe("THE MANIFEST BUILDER: the finish form", () => {
  it("refuses in words, in order", () => {
    expect(parseFinishForm(form([]))).toEqual({ ok: false, error: MANIFEST_REFUSAL.origin });
    expect(parseFinishForm(form([["origin_license", "A"]]))).toEqual({ ok: false, error: MANIFEST_REFUSAL.destination });
    expect(parseFinishForm(form([["origin_license", "A"], ["destination_license", "A"]]))).toEqual({
      ok: false,
      error: MANIFEST_REFUSAL.samePair,
    });
    expect(parseFinishForm(form(HEADER_OK))).toEqual({ ok: false, error: MANIFEST_REFUSAL.noPackages });
    expect(parseFinishForm(form([...HEADER_OK, ["tags", "not-a-tag"], ["prices", ""]]))).toEqual({
      ok: false,
      error: MANIFEST_REFUSAL.tagShape,
    });
    expect(
      parseFinishForm(form([...HEADER_OK, ["tags", T("000001")], ["prices", ""], ["tags", T("000001")], ["prices", ""]]))
    ).toEqual({ ok: false, error: MANIFEST_REFUSAL.duplicateTag });
    expect(parseFinishForm(form([...HEADER_OK, ["tags", T("000001")], ["prices", "twelve"]]))).toEqual({
      ok: false,
      error: MANIFEST_REFUSAL.price,
    });
  });

  it("reads the header, the receive-into pick, and the packages with their prices in order", () => {
    const parsed = parseFinishForm(
      form([
        ...HEADER_OK,
        ["tags", T("000105").toLowerCase()],
        ["prices", "1,672.50"],
        ["tags", T("000012")],
        ["prices", ""],
      ])
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.originLicense).toBe("AU-P-000694");
    expect(parsed.value.destinationLicense).toBe("AU-G-C-000832");
    expect(parsed.value.destinationLocation).toBe("Barn");
    expect(parsed.value.header.planned_route).toBe("North on 51\nEast on 94");
    // A CRLF submission (the browser's textarea) lands as LF.
    const crlf = parseFinishForm(form([...HEADER_OK.filter(([k]) => k !== "planned_route"), ["planned_route", "A\r\nB\r\n"], ["tags", T("000001")], ["prices", ""]]));
    expect(crlf.ok && crlf.value.header.planned_route).toBe("A\nB");
    expect(parsed.value.header.transfer_type).toBe("Transfer");
    expect(parsed.value.header.vehicle_plate).toBe("");
    expect(parsed.value.packages).toEqual([
      { tag: T("000105"), wholesalePrice: "1672.50" },
      { tag: T("000012"), wholesalePrice: null },
    ]);
  });

  it("names the header fields in the T3 template's order, each a movement column", () => {
    expect(MANIFEST_HEADER_FIELDS.map((f) => f.name)).toEqual([
      "planned_route",
      "transfer_type",
      "invoice_number",
      "payment_term_days",
      "planned_departure",
      "planned_arrival",
      "gross_weight",
      "gross_weight_uom",
      "transporter_license",
      "transporter_phone",
      "driver",
      "driver_occupational_license",
      "driver_license_number",
      "vehicle_make",
      "vehicle_model",
      "vehicle_plate",
    ]);
  });

  it("builds the T3 header from a movement row, the recipient being the destination", () => {
    const header = headerFromMovement({
      destination_license: "AU-G-C-000832",
      planned_route: "R",
      transfer_type: "Transfer",
      driver: "D",
      vehicle_plate: "P",
    });
    expect(header.recipientId).toBe("AU-G-C-000832");
    expect(header.plannedRoute).toBe("R");
    expect(header.driverName).toBe("D");
    expect(header.vehiclePlate).toBe("P");
    expect(header.invoiceNumber).toBe("");
  });
});

describe("THE MANIFEST BUILDER: the T3 file (his pick a price box per added package)", () => {
  const header: T3ManifestHeader = {
    recipientId: "AU-G-C-000832",
    plannedRoute: "North on 51",
    transferType: "Transfer",
    invoiceNumber: "",
    paymentTermDays: "",
    estimatedDeparture: "9/18/2026",
    estimatedArrival: "9/18/2026",
    grossWeight: "",
    grossWeightUom: "",
    transporterId: "",
    transporterPhone: "",
    driverName: "",
    driverOccupationalLicense: "",
    driverLicenseNumber: "",
    vehicleMake: "",
    vehicleModel: "",
    vehiclePlate: "",
  };

  it("prints the price in package.WholesalePrice and leaves it blank when none was typed", () => {
    const csv = manifestCsv(header, [
      { id: T("000105"), wholesalePrice: "672" },
      { id: T("000012"), wholesalePrice: null },
    ]);
    const lines = csv.split("\r\n");
    expect(csv.startsWith(T3_MANIFEST_HEADER)).toBe(true);
    expect(lines[3].split(",").slice(22)).toEqual([T("000105"), "672", "", ""]);
    expect(lines[4]).toBe(`${",".repeat(22)}${T("000012")},,,`);
  });

  it("still takes bare tags (the older callers)", () => {
    const csv = manifestCsv(header, [T("000001")]);
    expect(csv.split("\r\n")[3].split(",").slice(22)).toEqual([T("000001"), "", "", ""]);
  });
});

describe("THE MANIFEST BUILDER: the page", () => {
  it("before the origin pick: every license offered, both lists - EMPTY -, the destination list whole", () => {
    const html = manifestBuilderPage("en", data());
    expect(html).toContain("data-manifest-builder");
    expect(html).toContain('data-pane="origin"');
    expect(html).toContain('data-pane="destination"');
    expect(html).toContain('data-pane="manifest"');
    expect(html).toContain('<input type="hidden" name="origin_license" value="">');
    expect(html).toContain('<option value="AU-P-000694">AU-P-000694 - PNN Processor</option>');
    expect(html).toContain('<p class="muted" data-origin-empty>- EMPTY -</p>');
    expect(html).toContain('<p class="muted" data-manifest-empty>- EMPTY -</p>');
    expect(html).toContain('<p class="muted" data-receive-empty>- EMPTY -</p>');
    expect(html).not.toContain('placeholder="######" data-last-six');
    expect(html).toContain('data-finish>Finish</button>');
    expect(html).toContain('<a class="btn secondary" href="/interco" data-cancel>Cancel</a>');
    // The three blank-slate-era words stay gone.
    for (const word of ["Working pane", "On the road", "Create movement", "Receive at"]) expect(html).not.toContain(word);
  });

  it("after the origin pick: the rows sorted by last six, the filter on top, the dim rows without >>", () => {
    const manifested = new Map([[T("000105"), "aaaabbbb-cccc-dddd-eeee-ffffffffffff"]]);
    const html = manifestBuilderPage(
      "en",
      data({ origin: "AU-P-000694", packages: [pkg(T("001001")), pkg(T("000105")), pkg(T("000012"), { location: "Cryo 1", quantity: 1234, uom: "ea" })], manifested })
    );
    expect(html).toContain('<input type="hidden" name="origin_license" value="AU-P-000694">');
    expect(html).toContain('<option value="AU-P-000694" selected>');
    // The destination list leaves the origin out.
    const destPane = html.slice(html.indexOf('data-pane="destination"'), html.indexOf('data-pane="manifest"'));
    expect(destPane).not.toContain('value="AU-P-000694"');
    expect(destPane).toContain('value="AU-G-C-000832"');
    expect(html).toContain('placeholder="######" data-last-six');
    expect(html).toContain('data-origin-count data-total="3">3 packages</p>');
    const first = html.indexOf(`data-tag="${T("000012")}"`);
    const second = html.indexOf(`data-tag="${T("000105")}"`);
    const third = html.indexOf(`data-tag="${T("001001")}"`);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
    // A live row: both shuttles, the manifest-only boxes disabled until moved.
    const row = packageRow("en", pkg(T("000012"), { location: "Cryo 1", quantity: 1234, uom: "ea" }), null);
    expect(row).toContain('data-add aria-label="Add to manifest"');
    expect(row).toContain('data-remove aria-label="Put back in the origin list"');
    expect(row).toContain(`<input type="hidden" name="tags" value="${T("000012")}" disabled>`);
    expect(row).toContain('name="prices" inputmode="decimal" autocomplete="off" placeholder="0.00" disabled>');
    expect(row).toContain('<b class="tag-six">000012</b>');
    expect(row).toContain("BUD - Goji - PNN - O · 1234 ea · Cryo 1");
    // The dim row: no shuttle, the manifest named.
    const dim = packageRow("en", pkg(T("000105")), "aaaabbbb-cccc-dddd-eeee-ffffffffffff");
    expect(dim).toContain('class="pkg-row pkg-dim"');
    expect(dim).toContain('data-manifested="aaaabbbb"');
    expect(dim).not.toContain("data-add");
    expect(dim).not.toContain('name="tags"');
    expect(dim).toContain("on manifest aaaabbbb");
    // Grams format as grams.
    expect(packageRow("en", pkg(T("000001"), { quantity: 1234.5, uom: "g" }), null)).toContain("1,235 g");
  });

  it("carries the receive-into map and the header prefills as the page's own JSON", () => {
    const html = manifestBuilderPage(
      "en",
      data({ origin: "AU-P-000694", packages: [pkg(T("000001"))], prefillByDestination: { "AU-G-C-000832": { planned_route: "North on 51", driver: "D" } } })
    );
    const json = html.match(/<script type="application\/json" id="manifest-data">([\s\S]*?)<\/script>/)?.[1] ?? "";
    const payload = JSON.parse(json);
    expect(payload.locations["AU-G-C-000832"]).toEqual(["Barn", "24.2.A"]);
    expect(payload.prefill["AU-G-C-000832"]).toEqual({ planned_route: "North on 51", driver: "D" });
    // Every header field is a form field of its column name.
    for (const f of MANIFEST_HEADER_FIELDS) expect(html).toContain(`name="${f.name}"`);
    expect(html).toContain('<textarea name="planned_route" rows="3" data-header-field>');
  });

  it("after finish: the banner names the manifest and the file, and the page starts the download", () => {
    const html = manifestBuilderPage("en", data({ origin: "AU-P-000694", finished: { movementId: "aaaabbbb-cccc-dddd-eeee-ffffffffffff", count: 2 } }));
    expect(html).toContain('data-manifest-finished="aaaabbbb-cccc-dddd-eeee-ffffffffffff"');
    expect(html).toContain("<b>aaaabbbb</b>: 2 packages.");
    expect(html).toContain(`href="${manifestCsvPath("aaaabbbb-cccc-dddd-eeee-ffffffffffff")}" data-manifest-download>Download the T3 file</a>`);
    expect(html).toContain("It also waits on Pending Data Uploads until marked uploaded.");
    expect(html).toContain(`window.location.href = "/interco/manifest/aaaabbbb-cccc-dddd-eeee-ffffffffffff/csv";`);
    expect(manifestBuilderPage("en", data())).not.toContain("window.location.href = \"/interco/manifest/");
  });

  it("speaks Spanish at the pill", () => {
    const html = manifestBuilderPage("es", data({ origin: "AU-P-000694", packages: [pkg(T("000001"))] }));
    expect(html).toContain("<h2>Licencia de origen</h2>");
    expect(html).toContain("<h2>Licencia de destino</h2>");
    expect(html).toContain("Recibir en");
    expect(html).toContain("Ultimos seis");
    expect(html).toContain("Destinatario");
    expect(html).toContain("Precio mayorista");
    expect(html).toContain("- VACIO -");
    expect(html).toContain('data-finish>Terminar</button>');
    expect(html).toContain('data-cancel>Cancelar</a>');
    expect(html).toContain("Agregue al menos un paquete con >> antes de terminar.");
  });
});
