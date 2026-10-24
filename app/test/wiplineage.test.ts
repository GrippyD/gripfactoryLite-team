import { describe, expect, it } from "vitest";
import { reportsPage } from "../src/html";
import {
  familyLab,
  itemPrefix,
  lineageCards,
  lineageFilterOf,
  lineageFromMirror,
  lineagePounds,
  wipBranches,
  wipFamilies,
  wipLineageHtml,
  wipTotals,
  type LineagePackage,
  type MirrorLineagePackage,
  type MirrorLineageTransfer,
  type WipLineageModel,
} from "../src/wiplineage";
import { migratedDb, seedPerson } from "./migrated";
import { mountMetrcExport } from "../src/metrc";

function pkg(over: Partial<LineagePackage> & Pick<LineagePackage, "tag" | "item">): LineagePackage {
  return {
    status: "Active",
    source_harvest: "H-1",
    source_package: "",
    category: "Buds",
    strain: "Sample",
    quantity: 448,
    uom: "g",
    location: "Barn",
    lab_status: "NotSubmitted",
    packaged_date: "2026-10-01",
    destination: "",
    destination_license: "",
    manifest: "",
    shipped_date: "",
    transfer_type: "",
    ...over,
  };
}

const root = pkg({ tag: "W1", item: "WIP - Sample - PNN - I", quantity: 4480, packaged_date: "2026-09-01" });
const split = pkg({ tag: "W2", item: "WIP - Sample - PNN - I", source_package: "W1", quantity: 1000, packaged_date: "2026-09-15" });
const bud = pkg({ tag: "B1", item: "BUD - Sample - PNN - O", source_package: "W1", quantity: 896, lab_status: "TestPassed" });
const pre = pkg({
  tag: "P1",
  item: "PRE - Sample Roll - PNN - O",
  source_package: "W1",
  quantity: 10,
  uom: "ea",
  status: "Transferred",
  transfer_type: "Sale",
  destination: "Northwind Store",
  manifest: "M-2001",
  shipped_date: "2026-10-02",
  lab_status: "TestPassed",
});
const shake = pkg({ tag: "S1", item: "SHA - Sample - PNN - O", quantity: 448, lab_status: "TestFailed", packaged_date: "2026-10-03" });
const lab = pkg({
  tag: "L1",
  item: "BUD - Sample - PNN - O",
  quantity: 200,
  status: "Transferred",
  transfer_type: "Lab sample",
  destination: "Cedar Laboratory",
  manifest: "M-2002",
});
const rows = [root, split, bud, pre, shake, lab];

describe("WL2: WIP lineage rules", () => {
  it("keeps Transferred over Inactive over Active, and drops a gone package the current files do not name", () => {
    const mirror: MirrorLineagePackage[] = [
      { tag: "A1", source_harvests: "H-1", source_packages: null, item: "WIP - Sample - PNN - I", category: "Buds", item_strain: "Sample", quantity: 10, uom: "g", location: "Barn", lab_test_status: "NotSubmitted", packaged_date: "2026-09-01", inactive_state: null, gone_at: null },
      { tag: "F1", source_harvests: "H-1", source_packages: null, item: "BUD - Sample - PNN - O", category: "Buds", item_strain: "Sample", quantity: 20, uom: "g", location: "Barn", lab_test_status: "TestPassed", packaged_date: "2026-09-02", inactive_state: "Finished", gone_at: "2026-10-01T00:00:00.000Z" },
      { tag: "OLD", source_harvests: "H-9", source_packages: null, item: "BUD - Sample - PNN - O", category: "Buds", item_strain: "Sample", quantity: 5, uom: "g", location: "Barn", lab_test_status: null, packaged_date: null, inactive_state: null, gone_at: "2026-10-01T00:00:00.000Z" },
    ];
    const transfers: MirrorLineageTransfer[] = [
      { tag: "A1", manifest: "M-1", destination_facility: "Northwind Store", destination_license: "AU-R-000001", shipped_quantity: 10, uom: "g", lab_state: "TestPassed", received_date: "2026-10-01", source_harvests: "H-1", source_packages: null, item: "WIP - Sample - PNN - I", category: "Buds", item_strain: "Sample", transfer_type: "Sale" },
      { tag: "A1", manifest: "M-2", destination_facility: "Cedar Laboratory", destination_license: "AU-R-000002", shipped_quantity: 1, uom: "g", lab_state: "TestPassed", received_date: "2026-10-04", source_harvests: "H-1", source_packages: null, item: "WIP - Sample - PNN - I", category: "Buds", item_strain: "Sample", transfer_type: "Lab sample" },
    ];
    const out = lineageFromMirror(mirror, transfers);
    expect(out.map((row) => row.tag)).toEqual(["A1", "F1"]);
    expect(out[0]).toMatchObject({ status: "Transferred", manifest: "M-2", transfer_type: "Lab sample", destination: "Cedar Laboratory" });
    expect(out[1].status).toBe("Finished");
  });

  it("builds the family, the root, the split, the lab bar, and pounds at 448", () => {
    expect(itemPrefix("PRE - Sample Roll - PNN - O")).toBe("PRE");
    expect(lineagePounds(448)).toBe(1);
    expect(lineagePounds(224)).toBe(1);
    const families = wipFamilies(rows);
    expect(families).toHaveLength(1);
    expect(families[0]).toMatchObject({
      harvest: "H-1",
      root_tag: "W1",
      family_status: "Active",
      wip_n: 2,
      active_wip_n: 2,
      root_lb: 10,
      shipped_n: 1,
      shipped_lb: 0,
      shipped_ea: 10,
      buyers: 1,
      finished_active_n: 2,
    });
    const branches = wipBranches(rows, families);
    expect(branches.find((row) => row.type === "WIP")).toMatchObject({ n: 1, active_n: 1 });
    expect(branches.find((row) => row.type === "PRE")).toMatchObject({ n: 1, shipped_n: 1, active_n: 0 });
    const labs = familyLab(rows, families);
    expect(labs[0]).toMatchObject({ passed: 1, failed: 1, not_submitted: 1, pending: 0 });
    const totals = wipTotals(rows, families, branches, labs);
    expect(totals.families).toBe(1);
    expect(totals.active_wips).toBe(2);
    expect(totals.shipped_sale_n).toBe(1);
    expect(totals.shipped_sale_lb).toBe(0);
    expect(totals.failed_active_n).toBe(1);
    expect(totals.buyers).toBe(1);
    const transferredOnly = wipFamilies([pkg({ tag: "W9", item: "WIP - Sample - PNN - I", status: "Transferred", transfer_type: "Sale" })]);
    expect(transferredOnly).toEqual([]);
  });

  it("filters to inactive families and prints the data as of line", () => {
    const finished = pkg({ tag: "W3", item: "WIP - Sample - PNN - I", status: "Finished", source_harvest: "H-2", packaged_date: "2026-08-01" });
    const all = [...rows, finished];
    const families = wipFamilies(all);
    const labs = familyLab(all, families);
    const inactive = lineageCards(all, families, labs, lineageFilterOf(new URLSearchParams("status=inactive")));
    expect(inactive.map((card) => card.family.harvest)).toEqual(["H-2"]);
    const model: WipLineageModel = {
      license: "AU-P-000694",
      licenses: ["AU-P-000694"],
      packages: all,
      families,
      branches: wipBranches(all, families),
      labs,
      totals: wipTotals(all, families, wipBranches(all, families), labs),
      asOf: { active: "2026-10-20T12:00:00.000Z", inactive: "2026-10-20T12:01:00.000Z", transferred: null },
    };
    const html = wipLineageHtml(model, lineageFilterOf(new URLSearchParams()), "en");
    expect(html).toContain('data-wl-asof');
    expect(html).toContain("Data as of Active 2026-10-20 08:00, Inactive 2026-10-20 08:01, Transferred not mounted.");
    expect(html).toContain("wl-trio");
    expect(html).toContain('data-wl-family="H-1"');
    expect(html).toContain("Northwind Store");
    expect(html).not.toContain("<script");
    expect(reportsPage("en")).toContain('data-report-key="wip_lineage"');
    expect(reportsPage("es")).toContain("Linaje de paquetes WIP");
  });
});

describe("WL2 gate: her takeaway, the branch counts, the package table, the hide chip", () => {
  const finishedBud = pkg({ tag: "B2", item: "BUD - Sample - PNN - O", source_package: "W1", status: "Finished", lab_status: "TestPassed" });
  const all = [...rows, finishedBud];
  const families = wipFamilies(all);
  const branches = wipBranches(all, families);
  const labs = familyLab(all, families);
  const model: WipLineageModel = {
    license: "AU-P-000694",
    licenses: ["AU-P-000694"],
    packages: all,
    families,
    branches,
    labs,
    totals: wipTotals(all, families, branches, labs),
    asOf: { active: "2026-10-20T12:00:00.000Z", inactive: null, transferred: null },
  };

  it("prints the takeaway with active and inactive WIPs and the traced count", () => {
    const html = wipLineageHtml(model, lineageFilterOf(new URLSearchParams()), "en");
    expect(html).toContain(
      '<b data-wl-take="families">1</b> harvests have a WIP package (<b data-wl-take="active">2</b> active WIPs, <b data-wl-take="inactive">0</b> inactive). <b data-wl-take="traced">2</b> of the <b data-wl-take="total">2</b> active BUD, PRE and SHA packages trace back to one of them. <b data-wl-take="failed">1</b> families have active packages that failed lab testing. <b data-wl-take="shipped">1</b> BUD, PRE and SHA packages have shipped for sale.'
    );
    expect(html).not.toMatch(/[\u2013\u2014]/);
  });

  it("gives each branch her counts and a table in her columns", () => {
    const html = wipLineageHtml(model, lineageFilterOf(new URLSearchParams()), "en");
    const bud = html.slice(html.indexOf('data-wl-branch="BUD"'), html.indexOf("</details>", html.indexOf('data-wl-branch="BUD"')));
    expect(bud).toContain('<span class="wl-pill">BUD</span> <span class="wl-branch-stat">3 packages</span> <span class="wl-branch-stat">1 active</span> <span class="wl-branch-stat">1 shipped</span> <span class="wl-branch-stat">896 g on hand</span>');
    for (const head of ["Package tag", "Status", "Quantity", "Made from", "Location", "Lab status", "Packaged", "Shipment", "Sent to", "Manifest", "Received"]) expect(bud).toContain(`<th${head === "Quantity" ? ' class="num"' : ""}>${head}</th>`);
    expect(bud).toContain("Cedar Laboratory");
    expect(bud).toContain('<span class="wl-ship-tag is-lab">Lab sample</span>');
    expect(bud.indexOf('data-wl-tag="B1"')).toBeLessThan(bud.indexOf('data-wl-tag="L1"'));
    expect(bud.indexOf('data-wl-tag="L1"')).toBeLessThan(bud.indexOf('data-wl-tag="B2"'));
    const sha = html.slice(html.indexOf('data-wl-branch="SHA"'), html.indexOf("</details>", html.indexOf('data-wl-branch="SHA"')));
    expect(sha).toContain('<span class="wl-branch-stat is-failed">1 failed</span>');
    expect(sha).not.toContain("<th>Sent to</th>");
  });

  it("hides finished and discontinued rows under the hide chip, keeping the branch counts whole", () => {
    const html = wipLineageHtml(model, lineageFilterOf(new URLSearchParams("hide=1")), "en");
    expect(html).toContain("Hide finished and discontinued");
    const bud = html.slice(html.indexOf('data-wl-branch="BUD"'), html.indexOf("</details>", html.indexOf('data-wl-branch="BUD"')));
    expect(bud).toContain("3 packages");
    expect(bud).toContain('data-wl-tag="B1"');
    expect(bud).not.toContain('data-wl-tag="B2"');
  });

  it("speaks Spanish on the lineage and leaves the lab pages' Not submitted alone", async () => {
    const { t } = await import("../src/i18n");
    expect(t("es", "Not submitted")).toBe("No enviada");
    const html = wipLineageHtml(model, lineageFilterOf(new URLSearchParams()), "es");
    expect(html).toContain("<b>1</b> no enviados");
    expect(html).toContain("Mostrando 1 familia WIP");
    expect(html).toContain("Ocultar terminados y descontinuados");
    expect(html).toContain("Ordenar");
    expect(html).toContain("cosechas tienen un paquete WIP");
  });
});

describe("WL2: the page reads the mirror", () => {
  it("mounts invented rows and shows the family", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const activeHead = "Tag,Source Harvest(s),Source Package(s),Item,Category,Item Strain,Quantity,Unit Of Measure,Location,Lab Test Status,Packaged Date";
    const active = `${activeHead}
W1,H-1,,WIP - Sample - PNN - I,Buds,Sample,4480,g,Barn,NotSubmitted,2026-09-01
B1,H-1,W1,BUD - Sample - PNN - O,Buds,Sample,896,g,Barn,TestPassed,2026-10-01
`;
    const form = new FormData();
    form.set("person_id", person);
    form.set("file", new File([new TextEncoder().encode(active)], "MetrcMichiganAUP000694PackagesActive_wl.csv", { type: "text/csv" }));
    await mountMetrcExport(m.db, form);
    const { loadWipLineage } = await import("../src/wiplineage");
    const model = await loadWipLineage(m.db, "AU-P-000694");
    expect(model.asOf.active).toBeTruthy();
    expect(model.families[0]).toMatchObject({ harvest: "H-1", root_tag: "W1", root_lb: 10 });
    expect(model.packages.find((row) => row.tag === "B1")?.status).toBe("Active");
  });
});
