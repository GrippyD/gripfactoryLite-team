import { describe, expect, it } from "vitest";
import { pickTerpRecipe, retireTerpRecipe, saveTerpRecipe, scheduleHbn } from "../src/actions";
import { cryoStationPage } from "../src/cryo";
import { listTerpRecipes, type CryoPool } from "../src/db";
import { SCHEDULE_STAGES } from "../src/config";
import { terpRecipesPage } from "../src/terps";
import { formOf, migratedDb, seedBatch, seedLot, seedPerson } from "./migrated";

const T0 = "2026-09-30T16:00:00.000Z";

function saveForm(person: string, name: string, lines: Array<[string, string]>) {
  const form = formOf({ person_id: person, recipe_name: name });
  for (const [terp, percent] of lines) {
    form.append("terp_name", terp);
    form.append("percent", percent);
  }
  return form;
}

describe("TERP RECIPES (canon 0.30.321)", () => {
  it("saves a blend that totals 100, refuses a short sum and a duplicate active name, and retires with a reason", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    await expect(saveTerpRecipe(m.db, saveForm(person, "Smoke Blend", [["Limonene", "90"]]))).rejects.toMatchObject({
      message: "The percents must total 100.",
    });
    await expect(saveTerpRecipe(m.db, saveForm(person, "Smoke Blend", [["Limonene", "40.5"], ["Myrcene", "59.5"]]))).rejects.toMatchObject({
      message: "A percent must be a whole number from 1 to 100.",
    });
    const saved = await saveTerpRecipe(m.db, saveForm(person, "Smoke Blend", [["Limonene", "40"], ["Myrcene", "35"], ["Caryophyllene", "25"]]));
    expect(saved.redirect).toContain("ok=recipe_saved");
    await expect(saveTerpRecipe(m.db, saveForm(person, "smoke blend", [["Limonene", "100"]]))).rejects.toMatchObject({
      message: "That name is already an active recipe.",
    });
    const active = await listTerpRecipes(m.db, "active");
    expect(active).toHaveLength(1);
    expect(active[0]?.lines.map((line) => `${line.terp_name} ${line.percent}`)).toEqual(["Limonene 40", "Myrcene 35", "Caryophyllene 25"]);
    const id = active[0]?.id ?? "";
    await expect(retireTerpRecipe(m.db, formOf({ person_id: person, id }))).rejects.toMatchObject({ message: "Reason is required." });
    const retired = await retireTerpRecipe(m.db, formOf({ person_id: person, id, reason: "the blend changed" }));
    expect(retired.redirect).toContain("ok=recipe_retired");
    expect(await listTerpRecipes(m.db, "active")).toEqual([]);
    const gone = (await listTerpRecipes(m.db, "retired"))[0];
    expect(gone?.retire_reason).toBe("the blend changed");
    expect(gone?.lines).toHaveLength(3);
    const again = await saveTerpRecipe(m.db, saveForm(person, "Smoke Blend", [["Limonene", "100"]]));
    expect(again.redirect).toContain("ok=recipe_saved");
    expect((await listTerpRecipes(m.db, "active"))[0]?.id).not.toBe(id);
  });

  it("defaults the newest active recipe of the same market strain and does not carry the dose", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-a", hbn: "26244-PNN-GH-027-0-NA-26311", serial: 6311, farm: "PNN" });
    seedBatch(m, { id: "hb-b", hbn: "26244-PNN-GH-027-0-NA-26312", serial: 6312, farm: "PNN" });
    seedBatch(m, { id: "hb-c", hbn: "26244-PNN-GH-027-0-NA-26313", serial: 6313, farm: "PNN" });
    m.run(`UPDATE harvest_batches SET market_strain = 'Gelato Mint' WHERE id IN ('hb-a', 'hb-b')`);
    m.run(`UPDATE harvest_batches SET market_strain = ' gelato mint ' WHERE id = 'hb-c'`);
    await saveTerpRecipe(m.db, saveForm(person, "First", [["Limonene", "100"]]));
    await saveTerpRecipe(m.db, saveForm(person, "Second", [["Myrcene", "100"]]));
    const recipes = await listTerpRecipes(m.db, "active");
    const first = recipes.find((row) => row.name === "First");
    const second = recipes.find((row) => row.name === "Second");
    if (!first || !second) throw new Error("recipes missing");
    m.run(
      `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, terp_recipe_id, terp_dose_pct, created_at, updated_at)
       VALUES ('run-old', 'cryo', 'hb-a', 'complete', '2026-09-30T12:00:00.000Z', ?, 4.5, ?, ?)`,
      first.id,
      T0,
      T0
    );
    m.run(
      `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, terp_recipe_id, terp_dose_pct, created_at, updated_at)
       VALUES ('run-new', 'cryo', 'hb-a', 'scheduled', '2026-09-30T15:00:00.000Z', ?, 9, ?, ?)`,
      second.id,
      T0,
      T0
    );
    seedLot(m, "lot-b", "hb-b", "unloaded");
    m.run(
      `INSERT INTO wip_packages (id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at)
       VALUES ('pkg-b', 'lot-b', 'hb-b', 'BUD-B', 'BUD', 20, 'cryo_queue', 'trim', ?, ?)`,
      T0,
      T0
    );
    const passed = await scheduleHbn(m.db, SCHEDULE_STAGES.cryo, "hb-b", formOf({ person_id: person }));
    expect(passed.redirect).toContain("ok=scheduled");
    const born = m.get(`SELECT terp_recipe_id, terp_dose_pct FROM production_schedules WHERE harvest_batch_id = 'hb-b' AND deleted_at IS NULL`);
    expect(born?.terp_recipe_id).toBe(second.id);
    expect(born?.terp_dose_pct).toBeNull();
    await retireTerpRecipe(m.db, formOf({ person_id: person, id: second.id, reason: "retired blend" }));
    seedLot(m, "lot-c", "hb-c", "unloaded");
    m.run(
      `INSERT INTO wip_packages (id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at)
       VALUES ('pkg-c', 'lot-c', 'hb-c', 'BUD-C', 'BUD', 10, 'cryo_queue', 'trim', ?, ?)`,
      T0,
      T0
    );
    await scheduleHbn(m.db, SCHEDULE_STAGES.cryo, "hb-c", formOf({ person_id: person }));
    const later = m.get(`SELECT terp_recipe_id, terp_dose_pct FROM production_schedules WHERE harvest_batch_id = 'hb-c' AND deleted_at IS NULL`);
    expect(later?.terp_recipe_id).toBe(first.id);
    expect(later?.terp_dose_pct).toBeNull();
  });

  it("refuses a pick on a completed run and on a retired recipe", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-a", hbn: "26244-PNN-GH-027-0-NA-26321", serial: 6321, farm: "PNN" });
    await saveTerpRecipe(m.db, saveForm(person, "Live", [["Limonene", "100"]]));
    const recipe = (await listTerpRecipes(m.db, "active"))[0];
    if (!recipe) throw new Error("recipe missing");
    m.run(
      `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, created_at, updated_at)
       VALUES ('run-done', 'cryo', 'hb-a', 'complete', ?, ?, ?)`,
      T0,
      T0,
      T0
    );
    m.run(
      `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, created_at, updated_at)
       VALUES ('run-open', 'cryo', 'hb-a', 'scheduled', ?, ?, ?)`,
      T0,
      T0,
      T0
    );
    await expect(pickTerpRecipe(m.db, "run-done", formOf({ person_id: person, terp_recipe_id: recipe.id, terp_dose_pct: "2.5" }))).rejects.toMatchObject({
      message: "Unfinish the run first to change its recipe.",
    });
    const picked = await pickTerpRecipe(m.db, "run-open", formOf({ person_id: person, terp_recipe_id: recipe.id, terp_dose_pct: "2.50" }));
    expect(picked.redirect).toContain("ok=terp_saved");
    expect(m.get(`SELECT terp_recipe_id, terp_dose_pct FROM production_schedules WHERE id = 'run-open'`)).toEqual({
      terp_recipe_id: recipe.id,
      terp_dose_pct: 2.5,
    });
    await retireTerpRecipe(m.db, formOf({ person_id: person, id: recipe.id, reason: "done" }));
    await expect(pickTerpRecipe(m.db, "run-open", formOf({ person_id: person, terp_recipe_id: recipe.id }))).rejects.toMatchObject({
      message: "That recipe is not on the list.",
    });
  });

  it("renders the builder and the run header in Spanish", () => {
    const page = terpRecipesPage({
      recipes: [
        {
          id: "rec-1",
          name: "Smoke Blend",
          status: "active",
          retired_at: null,
          retire_reason: null,
          created_at: T0,
          lines: [
            { id: "l1", recipe_id: "rec-1", position: 1, terp_name: "Limonene", percent: 40 },
            { id: "l2", recipe_id: "rec-1", position: 2, terp_name: "Myrcene", percent: 60 },
          ],
        },
        {
          id: "rec-2",
          name: "Old Blend",
          status: "retired",
          retired_at: T0,
          retire_reason: "replaced",
          created_at: T0,
          lines: [{ id: "l3", recipe_id: "rec-2", position: 1, terp_name: "Pinene", percent: 100 }],
        },
      ],
      showRetired: true,
      locale: "es",
    });
    expect(page).toContain("Recetas de terpenos");
    expect(page).toContain("Nombre de la receta");
    expect(page).toContain("Nombre del terpeno");
    expect(page).toContain("Empezar de nuevo");
    expect(page).toContain("Esta mezcla esta completa, desea guardarla?");
    expect(page).toContain("Escriba un nombre de terpeno y un porcentaje.");
    expect(page).toContain("Ese porcentaje pasaria de 100.");
    expect(page).toContain("Mostrar retiradas");
    expect(page).toContain("data-terp-retired open");
    expect(page).toContain("Limonene 40%");
    expect(page).toContain("replaced");
    const station = cryoStationPage({
      runs: [],
      nowIso: T0,
      locale: "es",
      picked: {
        run: {
          id: "run-1",
          status: "scheduled",
          scheduled_at: T0,
          completed_at: null,
          effective_date: "2026-09-30",
          harvest_batch_id: "hb-a",
          hbn: "26244-PNN-GH-027-0-NA-26321",
          entry_date: "2026-09-30",
          farm_code: "PNN",
          strain_name: "Fruity",
          containers: 1,
          in_grams: 20,
          outputs: 0,
          out_grams: 0,
          terp_recipe_name: "Smoke Blend",
          terp_dose_pct: 2.5,
          terp_lines: "Limonene 40%, Myrcene 60%",
        },
        pool: { lines: [] } as CryoPool,
        outputs: [],
        categories: [],
      },
    });
    expect(station).toContain("Receta de terpenos: Smoke Blend (Limonene 40%, Myrcene 60%)");
    expect(station).toContain("Dosis: 2.50 %");
  });
});
