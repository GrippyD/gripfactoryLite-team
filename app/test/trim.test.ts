import { describe, expect, it } from "vitest";
import { cryoStationPage } from "../src/cryo";
import {
  formatGramsWhole,
  inheritMarketStrain,
  isOverIssued,
  lotTagLabel,
  OVERISSUE_TOLERANCE_GRAMS,
} from "../src/config";
import { defaultSignerFor, equipmentAssetPage, signerSelect } from "../src/equipment";
import { stationPage } from "../src/html";
import { LOOKUP_LANDING, LOOKUP_VALUE_SECTIONS } from "../src/lookups";
import { EDITABLE_FIELDS, queueByKey, stationByKey, type QueueDef } from "../src/pipeline";
import type { PersonRow, QueueRow, TrimPackageRow } from "../src/db";

// Owner rulings 2026-09-08 (canon 0.30.9), verbatim in the CANON row:
// R4 "Null Market Strains should automatically inherit the real strain, the
//    market strain should be what's listed from Trim Packages entry forward
//    (The picture should say "[Last 6 of Tag Number]/26001/TEST MOOKY/250,000
//    (drop the decimals)."
// R5 "Trim packages entry should show the entered packages below the working
//    pane, ordered by latest to oldest, pencil and "x" PIN gated"
// R7 "Cryo and Trim need the dates saved to each record, along with the hand
//    entry of the operator filling in the data"

describe("the Trim-forward lot label and the market strain (canon 0.30.9, R4)", () => {
  it("reads last-6-of-tag / serial / market strain / whole grams", () => {
    expect(
      lotTagLabel({
        metrc_harvest_tag: "1A4060300003E5B000012345",
        short_id: "26001",
        strain: "TEST MOOKY",
        grams: 250000,
      })
    ).toBe("012345 / 26001 / TEST MOOKY / 250,000");
  });

  it("drops a blank tag's token and rounds to the gram", () => {
    expect(lotTagLabel({ metrc_harvest_tag: null, short_id: "26001", strain: "Gelato", grams: "1234.56" })).toBe(
      "26001 / Gelato / 1,235"
    );
    expect(lotTagLabel({ metrc_harvest_tag: "  ", short_id: "26002", strain: null, grams: 0 })).toBe("26002 / 0");
    // A short tag rides whole.
    expect(lotTagLabel({ metrc_harvest_tag: "ABC", short_id: "26003", strain: "Zuava", grams: 99.4 })).toBe(
      "ABC / 26003 / Zuava / 99"
    );
  });

  it("formats whole grams with thousands and no decimals", () => {
    expect(formatGramsWhole(250000)).toBe("250,000");
    expect(formatGramsWhole("1000000.00")).toBe("1,000,000");
    expect(formatGramsWhole(999.5)).toBe("1,000");
    expect(formatGramsWhole(-1500.2)).toBe("-1,500");
    expect(formatGramsWhole(null)).toBe("");
    expect(formatGramsWhole("abc")).toBe("abc");
  });

  it("a blank market strain inherits the strain name; a typed one stands", () => {
    expect(inheritMarketStrain(null, "Bermuda Triangle")).toBe("Bermuda Triangle");
    expect(inheritMarketStrain("  ", "Bermuda Triangle")).toBe("Bermuda Triangle");
    expect(inheritMarketStrain("TEST MOOKY", "Bermuda Triangle")).toBe("TEST MOOKY");
    expect(inheritMarketStrain(null, null)).toBeNull();
  });

  it("the Unloaded Queue declares the label, the Cryo and Testing queues do not", () => {
    expect(queueByKey("unloaded_queue")!.lotLabel).toEqual({ weightField: "dry_weight_grams" });
    expect(queueByKey("cryo_queue")!.lotLabel).toBeUndefined();
    expect(queueByKey("dry_space_queue")!.lotLabel).toBeUndefined();
  });
});

describe("Trim Packages Entry: the entered list and the record fields (canon 0.30.9, R5 and R7)", () => {
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const station = () => stationByKey("trim_packages")!;
  const queuesByKey: Record<string, QueueDef> = { unloaded_queue: queueByKey("unloaded_queue")! };
  const rows: QueueRow[] = [
    {
      id: "lot1",
      values: {
        short_id: "26001",
        strain_name: "TEST MOOKY",
        dry_weight_grams: "250000",
        metrc_harvest_tag: "1A4060300003E5B000012345",
      },
    },
  ];
  const lookups = { package_types: [{ value: "BUD", label: "Bud" }] };
  const entered: TrimPackageRow[] = [
    {
      id: "pk-new",
      package_code: "BUD-2",
      package_type_code: "BUD",
      weight_grams: 1500.5,
      status: "cryo_queue",
      trim_date: "2026-09-08",
      trim_operator: "Dana",
      created_at: "2026-09-08T15:00:00.000Z",
    },
    {
      id: "pk-old",
      package_code: "BUD-1",
      package_type_code: "BUD",
      weight_grams: 1000,
      status: "cryo_queue",
      trim_date: null,
      trim_operator: null,
      created_at: "2026-09-08T14:00:00.000Z",
    },
  ];
  const page = (trimCtx?: { entered: TrimPackageRow[] }, pick: { id?: string } = { id: "lot1" }) =>
    stationPage(
      station(),
      people,
      "p1",
      lookups,
      { unloaded_queue: rows },
      queuesByKey,
      pick.id,
      undefined,
      rows,
      "en",
      undefined,
      { original: 250000, recorded: 2500.5, remaining: 247499.5 },
      undefined,
      false,
      trimCtx
    );

  it("lists the entered packages beneath the form, newest first, with the PIN-gated pencil and x", () => {
    const html = page({ entered });
    expect(html).toContain("Entered packages");
    expect(html).toContain('<table class="data trim-entered" data-trim-entered>');
    const newer = html.indexOf('data-package="pk-new"');
    const older = html.indexOf('data-package="pk-old"');
    expect(newer).toBeGreaterThan(-1);
    expect(older).toBeGreaterThan(newer);
    // Beneath the working pane's form.
    expect(html.indexOf('id="pkg-rows"')).toBeLessThan(newer);
    expect(html).toContain('href="/record/wip_packages/pk-new/edit"');
    expect(html).toContain('href="/record/wip_packages/pk-new/void"');
    expect(html).toContain("Edit with reason (PIN)");
    expect(html).toContain("Void with reason (PIN)");
    // Date and operator columns; a pre-law row shows its created day and no operator.
    expect(html).toContain("<td>2026-09-08</td>\n          <td>Dana</td>");
    expect(html).toContain("<td>2026-09-08</td>\n          <td></td>");
    expect(html).toContain("<td>1,501</td>");
  });

  it("says so when nothing is entered yet, and renders no list without a pick", () => {
    expect(page({ entered: [] })).toContain("No packages entered yet.");
    expect(page(undefined)).not.toContain("Entered packages");
    expect(page({ entered }, {})).not.toContain("Entered packages");
  });

  it("heads the pick with the Trim-forward label", () => {
    expect(page({ entered })).toContain('<h2 class="working-pick">012345 / 26001 / TEST MOOKY / 250,000</h2>');
  });

  // Patrick's feedback relayed by the owner, 2026-09-11 (canon 0.30.37): a trim
  // weight that lands exactly on Remaining is not an over issue; the [+] asks
  // only past it (THE OVERISSUE LINE IS STRICT, half a cent of float noise).
  it("the trim [+] guard asks only strictly past Remaining", () => {
    const html = page({ entered });
    expect(html).toContain('data-balance-remaining="247499.5"');
    expect(html).toContain("w > remaining + 0.005");
    expect(html).not.toContain("w >= remaining");
    expect(isOverIssued(247499.5, 247499.5)).toBe(false);
    expect(isOverIssued(1000, 1000)).toBe(false);
    expect(isOverIssued(1000.004, 1000)).toBe(false);
    expect(isOverIssued(1000.01, 1000)).toBe(true);
    expect(OVERISSUE_TOLERANCE_GRAMS).toBe(0.005);
  });

  it("SHAKE rides the trim type list once seeded (migration 0040)", () => {
    const withShake = stationPage(
      station(),
      people,
      "p1",
      { package_types: [{ value: "BUD", label: "BUD" }, { value: "SHAKE", label: "SHAKE" }] },
      { unloaded_queue: rows },
      queuesByKey,
      "lot1",
      undefined,
      rows,
      "en",
      undefined,
      { original: 250000, recorded: 0, remaining: 250000 },
      undefined,
      false,
      { entered: [] }
    );
    expect(withShake).toContain('<option value="SHAKE">SHAKE</option>');
  });

  it("the Cryo station carries the Effective Date (today by default, PIN-gated) and the operator above its line (THE CRYO RUN, canon 0.30.110)", () => {
    const run = {
      id: "run-1",
      status: "scheduled",
      scheduled_at: "2026-09-17T12:00:00.000Z",
      completed_at: null,
      effective_date: "2026-09-17",
      harvest_batch_id: "hb1",
      hbn: "26260-PNN-GH-027-0-NA-26011",
      entry_date: "2026-09-17",
      farm_code: "PNN",
      strain_name: "Fruity Pebbles",
      containers: 2,
      in_grams: 150,
      outputs: 0,
      out_grams: 0,
    };
    const cryo = cryoStationPage({
      runs: [run],
      picked: { run, pool: { lines: [{ category_code: "BUD", type_codes: ["BUD"], in_grams: 150, out_grams: 0 }] }, outputs: [], categories: ["WPR", "BUD", "SHA"] },
      nowIso: "2026-09-17T12:00:00.000Z",
    });
    // THE EFFECTIVE DATE PER STATION (canon 0.30.94): the station's date is the
    // Effective Date component (client-defaulted to today, the Admin PIN box
    // beside it), and it posts effective_date, not cryo_date.
    expect(cryo).toContain('<details class="effective-date" data-effective-date>');
    expect(cryo).toMatch(/<input type="date" name="effective_date" data-effective-input data-effective-default="" data-effective-auto>/);
    expect(cryo).toContain('name="effective_pin"');
    expect(cryo).toContain("The cryo date saved on each package entered. Today by default; the Admin PIN sets another day.");
    expect(cryo).toContain('name="cryo_operator"');
  });

  it("the trim package pencil edits the trim and cryo dates and operators", () => {
    expect(EDITABLE_FIELDS.wip_packages.map((f) => f.name)).toEqual([
      "package_code",
      "package_type_code",
      "weight_grams",
      "trim_date",
      "trim_operator",
      "cryo_weight_grams",
      "cryo_date",
      "cryo_operator",
      "status",
      "test_outcome",
    ]);
  });
});

// Owner ruling 2026-09-08 (canon 0.30.12), verbatim: "Replace all the hand sign
// offs with the names "Kieth", "Les", or "Austin".  Kieth will almost always be
// the one managing RTUs", scoped by canon 0.30.21, verbatim: "The operator
// dropdowns don't need to have the maintenance crew on every single one, that
// was just for the PM portion".
describe("the sign-off names (canon 0.30.12, scoped to the PM by 0.30.21)", () => {
  const names = [
    { value: "Kieth", label: "Kieth" },
    { value: "Les", label: "Les" },
    { value: "Austin", label: "Austin" },
  ];

  it("the trim and cryo operators and the pencil are hand entry again; the names live on in Admin for the PM", () => {
    const trim = stationByKey("trim_packages")!.fields.find((f) => f.name === "trim_operator")!;
    expect(trim).toMatchObject({ input: "text", required: true });
    expect(trim).not.toHaveProperty("lookup");
    const cryo = stationByKey("cryo_weight")!.fields.find((f) => f.name === "cryo_operator")!;
    expect(cryo).toMatchObject({ input: "text", required: true });
    expect(EDITABLE_FIELDS.wip_packages.find((f) => f.name === "trim_operator")).toMatchObject({ input: "text" });
    expect(EDITABLE_FIELDS.wip_packages.find((f) => f.name === "cryo_operator")).toMatchObject({ input: "text" });
    expect(LOOKUP_VALUE_SECTIONS.sign_off_names).toEqual({ category: "sign_off_name", title: "Sign-off names" });
    expect(LOOKUP_LANDING.find((s) => s.category === "People and System")!.buttons.map((b) => b.key)).toContain("sign_off_names");
  });

  it("renders the Trim operator as a typed field, not a select of the maintenance crew", () => {
    const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
    const rows: QueueRow[] = [{ id: "lot1", values: { short_id: "26001", strain_name: "Zuava", dry_weight_grams: "100", metrc_harvest_tag: "" } }];
    const html = stationPage(
      stationByKey("trim_packages")!,
      people,
      "p1",
      { package_types: [{ value: "BUD", label: "Bud" }], sign_off_name: names },
      { unloaded_queue: rows },
      { unloaded_queue: queueByKey("unloaded_queue")! },
      "lot1",
      undefined,
      rows
    );
    expect(html).toMatch(/<input type="text" name="trim_operator"[^>]*required/);
    expect(html).not.toMatch(/<select name="trim_operator"/);
    expect(html).not.toContain('<option value="Kieth">Kieth</option>');
  });

  it("the PM page signs with the names and starts an RTU on Kieth", () => {
    expect(defaultSignerFor("RTU 7", names)).toBe("Kieth");
    expect(defaultSignerFor("rtu 20", names)).toBe("Kieth");
    expect(defaultSignerFor("Big Blue", names)).toBe("");
    expect(defaultSignerFor("RTU 7", [])).toBe("");
    expect(signerSelect(names, "Kieth")).toBe(
      '<select name="signed_by" required><option value="">Signed by</option><option value="Kieth" selected>Kieth</option><option value="Les">Les</option><option value="Austin">Austin</option></select>'
    );
    expect(signerSelect(names, "")).toContain('<option value="" selected>Signed by</option>');
    const asset = { id: "a1", serial: "GF-EQ-0030", name: "RTU 1", farm_code: "PNN" } as unknown as Parameters<typeof equipmentAssetPage>[0];
    const page = equipmentAssetPage(
      asset,
      [{ id: "s1", asset_id: "a1", task: "Filters", interval_days: 30, last_done: null } as unknown as Parameters<typeof equipmentAssetPage>[1][number]],
      [],
      [{ id: "t1", asset_id: "a1", title: "Rattle", status: "open", opened_by: "Les", closed_by: null } as unknown as Parameters<typeof equipmentAssetPage>[3][number]],
      "2026-09-08",
      undefined,
      names
    );
    expect((page.match(/<select name="signed_by" required>/g) || []).length).toBe(3);
    expect(page).not.toContain("Hand signed by");
    expect(page).toContain('<option value="Kieth" selected>Kieth</option>');
    expect(page).toContain("<th>Signed by</th>");
    const other = equipmentAssetPage(
      { ...asset, name: "Big Blue" } as unknown as Parameters<typeof equipmentAssetPage>[0],
      [],
      [],
      [],
      "2026-09-08",
      undefined,
      names
    );
    expect(other).toContain('<option value="" selected>Signed by</option>');
    expect(other).not.toContain('<option value="Kieth" selected>');
  });
});
