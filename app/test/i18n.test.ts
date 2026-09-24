import { describe, expect, it } from "vitest";
import { asLocale, t } from "../src/i18n";
import { homePage, intercoMenuPage, layout, opsGroupPage, stationPage, type StationLedgerCtx } from "../src/html";
import { PIPELINE, opsGroupByKey, queueByKey, stationByKey, type QueueDef } from "../src/pipeline";
import type { PersonRow, QueueRow } from "../src/db";

describe("i18n dictionary (owner ruling 2026-08-28)", () => {
  it("returns Spanish strings for known keys", () => {
    expect(t("es", "Operations")).toBe("Operaciones");
    expect(t("es", "Reports")).toBe("Informes");
    expect(t("es", "Import Data")).toBe("Importar datos");
    expect(t("es", "Home")).toBe("Inicio");
    expect(t("es", "Start lot")).toBe("Iniciar lote");
    expect(t("es", "Add a truck")).toBe("Agregar camión");
    // Record-borne truck option labels (owner ruling 2026-08-31).
    expect(t("es", "Truck")).toBe("Camión");
    expect(t("en", "Truck")).toBe("Truck");
    expect(t("es", "Mark trimmed")).toBe("Marcar podado");
    expect(t("es", "Pick from the left to begin.")).toBe("Elija de la izquierda para comenzar.");
    expect(t("es", "HBN minted.")).toBe("HBN generado.");
    // Fulfillment tile (owner ruling 2026-08-31)
    expect(t("es", "Fulfillment")).toBe("Despacho");
    expect(t("en", "Fulfillment")).toBe("Fulfillment");
    // Inventory node (2026-09-01)
    expect(t("es", "Inventory")).toBe("Inventario");
    expect(t("es", "Change Locations")).toBe("Cambiar ubicaciones");
    expect(t("es", "WIP Inventory")).toBe("Inventario en proceso");
    expect(t("es", "recall HBN")).toBe("retirar HBN");
    expect(t("es", "Unsaved HBN data will be lost.")).toBe(
      "Se perderán los datos de HBN no guardados."
    );
    // Cryo picked-row table headers (owner ruling 2026-08-31: two-pane theme).
    expect(t("es", "Package")).toBe("Paquete");
    expect(t("es", "Cryo weight (g)")).toBe("Peso criogénico (g)");
    expect(t("en", "Package")).toBe("Package");
    expect(t("en", "Cryo weight (g)")).toBe("Cryo weight (g)");
  });

  it("returns English strings for locale en", () => {
    expect(t("en", "Home")).toBe("Home");
    expect(t("en", "Start lot")).toBe("Start lot");
  });

  it("falls back to English for unknown keys", () => {
    expect(t("es", "Some label without an entry")).toBe("Some label without an entry");
    expect(t("en", "Some label without an entry")).toBe("Some label without an entry");
  });

  it("normalizes cookie and form values to a locale", () => {
    expect(asLocale("es")).toBe("es");
    expect(asLocale("en")).toBe("en");
    expect(asLocale("fr")).toBe("en");
    expect(asLocale(undefined)).toBe("en");
  });
});

describe("locale pill and app bar (owner ruling 2026-08-28)", () => {
  const base = {
    title: "Home",
    theme: "grip",
    personEmail: "pat@gripcannabis.com",
    body: "<p>x</p>",
  };

  it("renders Inicio and the pill with ES active in es", () => {
    const html = layout({ ...base, locale: "es" });
    expect(html).toContain('<html lang="es"');
    expect(html).toContain('href="/">Inicio</a>');
    expect(html).toContain('action="/locale"');
    expect(html).toContain('value="es" class="locale-opt active"');
    expect(html).toContain('value="en" class="locale-opt"');
    // Owner ruling 2026-08-31: the chrome shows the login email, no person form.
    expect(html).toContain("pat@gripcannabis.com");
    expect(html).not.toContain('action="/person"');
  });

  it("renders Home and the pill with EN active in en", () => {
    const html = layout({ ...base, locale: "en" });
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('href="/">Home</a>');
    expect(html).toContain('value="en" class="locale-opt active"');
    expect(html).toContain('value="es" class="locale-opt"');
  });

  it("defaults to en when no locale is passed", () => {
    const html = layout(base);
    expect(html).toContain('value="en" class="locale-opt active"');
  });
});

describe("Interco Logistics stub (owner ruling 2026-08-28)", () => {
  it("home carries the Interco node linking /interco", () => {
    const html = homePage(PIPELINE);
    expect(html).toContain('href="/interco"');
    expect(html).toContain("Interco Logistics");
    expect(html).toContain('data-ops-key="interco_logistics"');
    const interco = html.slice(
      html.indexOf('data-ops-key="interco_logistics"') - 40,
      html.indexOf('data-ops-key="interco_logistics"') + 80
    );
    expect(interco).not.toContain("ops-node-stub");
  });

  it("the Interco page is the four-window floor and the road", () => {
    const en = intercoMenuPage("en");
    expect(en).toContain('<h1 title="One origin license and location per manifest.">Interco Logistics</h1>');
    expect(en).toContain("Arlington");
    expect(en).toContain("Penn North");
    expect(en).toContain("PNS");
    expect(en).toContain("On the road");
    expect(en).toContain("Working pane");
    expect(en).toContain("Arrivals");
    expect(en).toContain('href="/interco/arrivals/pnn"');
    expect(en).not.toContain('href="/interco/send/pnn"');
    expect(en).not.toContain('href="/interco/ship-external"');
    expect(en).not.toContain('href="/interco/door"');
    expect(en).not.toContain("Create movement");
    expect(en).toContain("- EMPTY -");
    const es = intercoMenuPage("es");
    expect(es).toContain("Llegadas");
    expect(es).toContain("En el camino");
    expect(es).toContain("Panel de trabajo");
  });
});

describe("Fulfillment tile (owner ruling 2026-08-31)", () => {
  it("Production Operations titles the tile Fulfillment in en and Despacho in es", () => {
    const group = opsGroupByKey("production_ops")!;
    const en = opsGroupPage(group, "en");
    expect(en).toContain('href="/fulfillment"');
    expect(en).toContain("Fulfillment");
    const es = opsGroupPage(group, "es");
    expect(es).toContain('href="/fulfillment"');
    expect(es).toContain("Despacho");
  });
});

describe("brand slice i18n (owner rulings 2026-09-01)", () => {
  it("keeps the view pill labels proper nouns: Grip, Lite, Continuum", () => {
    expect(t("en", "Grip")).toBe("Grip");
    expect(t("es", "Grip")).toBe("Grip");
    expect(t("en", "Continuum")).toBe("Continuum");
    expect(t("es", "Continuum")).toBe("Continuum");
  });

  it("translates the device pill labels with the file's accent usage", () => {
    expect(t("en", "Computer")).toBe("Computer");
    expect(t("es", "Computer")).toBe("Computadora");
    expect(t("en", "Phone")).toBe("Phone");
    expect(t("es", "Phone")).toBe("Teléfono");
  });

  it("translates the fulfillment menu chrome; SalesHelper stays a proper noun", () => {
    expect(t("en", "SalesHelper")).toBe("SalesHelper");
    expect(t("es", "SalesHelper")).toBe("SalesHelper");
    expect(t("en", "Mount SOs")).toBe("Mount SOs");
    expect(t("es", "Mount SOs")).toBe("Montar SOs");
    expect(t("en", "Pick Orders")).toBe("Pick Orders");
    expect(t("es", "Pick Orders")).toBe("Preparar pedidos");
    expect(t("es", "Future interface: Zoho sales order CSVs mount here.")).toBe(
      "Interfaz futura: los CSV de órdenes de venta de Zoho se montan aquí."
    );
    expect(t("es", "Future interface: pick lists from mounted SOs.")).toBe(
      "Interfaz futura: listas de preparación de las SO montadas."
    );
  });
});

describe("unload dry space i18n (owner ruling 2026-08-31)", () => {
  it("translates the unload chrome", () => {
    expect(t("es", "Unload Dry Space")).toBe("Descargar espacio de secado");
    expect(t("es", "Unloaded Queue")).toBe("Cola de descargados");
    expect(t("es", "Finish unload")).toBe("Terminar descarga");
    expect(t("es", "Dry total")).toBe("Total seco");
    expect(t("es", "Dry weights")).toBe("Pesos secos");
    expect(t("es", "From")).toBe("De");
    expect(t("es", "That lot is not in the Dry Space Queue.")).toBe(
      "Ese lote no está en la cola de espacios de secado."
    );
    // Owner ruling 2026-08-31: the two-pane prompt when nothing is picked.
    expect(t("es", "Pick a lot from the pane.")).toBe("Elija un lote del panel.");
    expect(t("en", "Pick a lot from the pane.")).toBe("Pick a lot from the pane.");
    expect(t("en", "Unload Dry Space")).toBe("Unload Dry Space");
    expect(t("en", "Finish unload")).toBe("Finish unload");
    expect(t("en", "This weight over issues the parent package. Record it anyway?")).toBe(
      "This weight over issues the parent package. Record it anyway?"
    );
    expect(t("es", "This weight over issues the parent package. Record it anyway?")).toBe(
      "Este peso sobregira el paquete padre. Registrarlo de todos modos?"
    );
    expect(t("es", "Nothing, just finish")).toBe("Nada, solo terminar");
    expect(t("es", "Back to weighing")).toBe("Volver a pesar");
    expect(t("es", "Package finish")).toBe("Cierre de paquete");
  });

  it("orders Unload Dry Space on Drying Operations, between harvest wet weight and production trim", () => {
    for (const locale of ["en", "es"] as const) {
      const harvest = opsGroupPage(opsGroupByKey("harvest_ops")!, locale);
      const drying = opsGroupPage(opsGroupByKey("drying_ops")!, locale);
      const production = opsGroupPage(opsGroupByKey("production_ops")!, locale);
      expect(harvest.indexOf('data-pipeline-key="wet_weight"')).toBeGreaterThan(-1);
      expect(drying.indexOf('data-pipeline-key="unload_dry_space"')).toBeGreaterThan(-1);
      expect(production.indexOf('data-pipeline-key="trim_packages"')).toBeGreaterThan(-1);
    }
    expect(opsGroupPage(opsGroupByKey("drying_ops")!, "en")).toContain("Unload Dry Space");
    expect(opsGroupPage(opsGroupByKey("drying_ops")!, "es")).toContain("Descargar espacio de secado");
  });
});

describe("pending data uploads i18n (owner ruling 2026-08-31)", () => {
  it("translates the uploads chrome en and es", () => {
    expect(t("en", "Pending Data Uploads")).toBe("Pending Data Uploads");
    expect(t("es", "Pending Data Uploads")).toBe("Cargas de datos pendientes");
    expect(t("en", "Wet Weights")).toBe("Wet Weights");
    expect(t("es", "Wet Weights")).toBe("Pesos húmedos");
    expect(t("es", "Type")).toBe("Tipo");
    expect(t("es", "File")).toBe("Archivo");
    expect(t("es", "Finished entries")).toBe("Entradas terminadas");
    expect(t("es", "Wet total (g)")).toBe("Total húmedo (g)");
    expect(t("es", "Last activity")).toBe("Última actividad");
    expect(t("es", "Download")).toBe("Descargar");
    expect(t("en", "Mark uploaded")).toBe("Mark uploaded");
    expect(t("es", "Mark uploaded")).toBe("Marcar cargado");
    expect(t("en", "Marked uploaded.")).toBe("Marked uploaded.");
    expect(t("es", "Marked uploaded.")).toBe("Marcado como cargado.");
    expect(t("en", "Nothing pending.")).toBe("Nothing pending.");
    expect(t("es", "Nothing pending.")).toBe("Nada pendiente.");
    expect(t("en", "Plant column is blank pending the owner's fill rule.")).toBe(
      "Plant column is blank pending the owner's fill rule."
    );
    expect(t("es", "Plant column is blank pending the owner's fill rule.")).toBe(
      "La columna Plant queda en blanco en espera de la regla de llenado del propietario."
    );
  });

  it("translates the plant tag chrome (owner ruling 2026-08-31: the Plant fill rule)", () => {
    expect(t("en", "Plant tags")).toBe("Plant tags");
    expect(t("es", "Plant tags")).toBe("Etiquetas de plantas");
    expect(t("en", "Save tags")).toBe("Save tags");
    expect(t("es", "Save tags")).toBe("Guardar etiquetas");
    expect(t("en", "Plant tags saved.")).toBe("Plant tags saved.");
    expect(t("es", "Plant tags saved.")).toBe("Etiquetas de plantas guardadas.");
  });
});

describe("inventory node i18n (builder prompt 2026-09-01)", () => {
  it("translates the sheet chrome and the recall warning", () => {
    expect(t("en", "Change Locations")).toBe("Change Locations");
    expect(t("es", "Upload Inventory to Zoho")).toBe("Cargar inventario a Zoho");
    expect(t("es", "Physical Inventory Audit")).toBe("Auditoría física de inventario");
    expect(t("es", "Location Audit")).toBe("Auditoría de ubicaciones");
    expect(t("es", "Reserved. Awaiting the owner's talk-through.")).toBe(
      "Reservado. En espera de la conversación con el propietario."
    );
    expect(t("es", "Drying")).toBe("Secado");
    expect(t("es", "In Production")).toBe("En producción");
    expect(t("es", "In Testing")).toBe("En pruebas");
    expect(t("es", "empty")).toBe("vacío");
    expect(t("es", "OWNER MAPPING NEEDED")).toBe("FALTA EL MAPEO DEL PROPIETARIO");
    expect(t("es", "lab capture awaits the owner")).toBe(
      "el registro del laboratorio espera al propietario"
    );
    expect(t("es", "Zoho data unavailable")).toBe("Datos de Zoho no disponibles");
    expect(t("en", "Weightless HBNs")).toBe("Weightless HBNs");
    expect(t("es", "HBN recalled.")).toBe("HBN retirado.");
    expect(t("es", "CSV export of this sheet")).toBe("Exportar CSV de esta hoja");
  });
});

describe("app config i18n (owner ruling 2026-09-01: the yield's home)", () => {
  it("translates the App config chrome en and es", () => {
    expect(t("en", "App config")).toBe("App config");
    expect(t("es", "App config")).toBe("Configuración de la aplicación");
    expect(
      t("en", "Standing configuration values. Edit with a reason; keys cannot be added or voided.")
    ).toBe("Standing configuration values. Edit with a reason; keys cannot be added or voided.");
    expect(
      t("es", "Standing configuration values. Edit with a reason; keys cannot be added or voided.")
    ).toBe(
      "Valores de configuración permanentes. Edite con un motivo; las claves no se pueden agregar ni anular."
    );
  });

  it("points the yield note at Admin, Lookups in both locales", () => {
    expect(t("en", "of wet, editable in Admin, Lookups")).toBe(
      "of wet, editable in Admin, Lookups"
    );
    expect(t("es", "of wet, editable in Admin, Lookups")).toBe(
      "del húmedo, editable en Admin, Lookups"
    );
  });
});

describe("balance display i18n (owner ruling 2026-08-31: balance displays)", () => {
  it("translates the Original / Recorded / Remaining labels", () => {
    expect(t("en", "Original (wet)")).toBe("Original (wet)");
    expect(t("es", "Original (wet)")).toBe("Original (húmedo)");
    expect(t("en", "Original (dry)")).toBe("Original (dry)");
    expect(t("es", "Original (dry)")).toBe("Original (seco)");
    expect(t("en", "Recorded")).toBe("Recorded");
    expect(t("es", "Recorded")).toBe("Registrado");
    expect(t("en", "Remaining")).toBe("Remaining");
    expect(t("es", "Remaining")).toBe("Restante");
  });
});

describe("marketplace rework i18n (canon 0.22.0 cut at 0.24.0)", () => {
  it("translates listing, split, and uploads strings", () => {
    expect(t("en", "Label")).toBe("Label");
    expect(t("es", "Label")).toBe("Rotulo");
    expect(t("en", "Category")).toBe("Category");
    expect(t("es", "Category")).toBe("Categoria");
    expect(t("en", "Quantity grams")).toBe("Quantity grams");
    expect(t("es", "Quantity grams")).toBe("Cantidad gramos");
    expect(t("en", "Split package")).toBe("Split package");
    expect(t("es", "Split package")).toBe("Dividir paquete");
    expect(t("en", "Internal package")).toBe("Internal package");
    expect(t("es", "Internal package")).toBe("Paquete interno");
    expect(t("en", "Splits")).toBe("Splits");
    expect(t("es", "Splits")).toBe("Divisiones");
    expect(t("en", "Listing Categories")).toBe("Listing Categories");
    expect(t("es", "Listing Categories")).toBe("Categorias de listado");
    expect(t("en", "Category for the listing. Admin\\Data Lookups\\Marketplace\\Listing Categories")).toContain(
      "Admin\\Data Lookups\\Marketplace\\Listing Categories"
    );
  });
});

describe("station page in Spanish (owner ruling 2026-08-28)", () => {
  const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
  const rows: QueueRow[] = [
    {
      id: "hb1",
      values: { hbn: "26244-ARL-GH-027-0-NA-26001", strain_name: "Fruity Pebbles", farm_code: "ARL", entry_date: "2026-09-01" },
    },
  ];
  const queuesByKey: Record<string, QueueDef> = { hbn_queue: queueByKey("hbn_queue")! };
  // Owner ruling 2026-08-31: trucks are record-borne; the batch's numbers arrive
  // as truckOptions and label through the Truck dictionary key.
  const ledgerCtx: StationLedgerCtx = {
    farmName: "Arlington",
    moveToOptions: [{ value: "ds6", label: "Arlington Dry Room" }],
    truckOptions: ["1"],
    resumeLots: [],
  };

  it("renders Iniciar lote and translated chrome on a picked wet weight page", () => {
    const html = stationPage(
      stationByKey("wet_weight")!,
      people,
      "p1",
      {},
      { hbn_queue: rows },
      queuesByKey,
      "hb1",
      ledgerCtx,
      undefined,
      "es"
    );
    expect(html).toContain("Iniciar lote");
    expect(html).toContain("Entrada de peso húmedo");
    expect(html).toContain("Mover a");
    expect(html).toContain("Agregar camión");
    expect(html).toContain('<option value="truck-1">Camión 1</option>');
    expect(html).toContain("Líder");
    expect(html).toContain("Cola de HBN");
    // User-entered data never translates.
    expect(html).toContain("ARL / Fruity Pebbles / 2026-09-01</h2>");
  });

  it("prompts in Spanish when nothing is picked", () => {
    const html = stationPage(
      stationByKey("wet_weight")!,
      people,
      "p1",
      {},
      { hbn_queue: rows },
      queuesByKey,
      undefined,
      undefined,
      undefined,
      "es"
    );
    expect(html).toContain("Elija de la izquierda para comenzar.");
  });
});
