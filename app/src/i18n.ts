/**
 * Owner ruling 2026-08-28: a universal EN/ES pill on every page.
 * Storage identifiers stay English everywhere; only display strings translate.
 * Keys are the English display strings, so an untranslated string falls back
 * to English silently. Do not translate user-entered data.
 */
export type Locale = "en" | "es";

/** Normalize a cookie or form value to a Locale; anything but "es" is "en". */
export function asLocale(value: unknown): Locale {
  return value === "es" ? "es" : "en";
}

export const DICT: Record<string, { en: string; es: string }> = {
  // App bar
  "Home": { en: "Home", es: "Inicio" },
  "Admin": { en: "Admin", es: "Admin" },
  "Log": { en: "Log", es: "Registro" },
  "Person": { en: "Person", es: "Persona" },
  "Remember": { en: "Remember", es: "Recordar" },
  // Home
  "Harvest queue spine": { en: "Harvest queue spine", es: "Eje de colas de cosecha" },
  "Station": { en: "Station", es: "Estación" },
  // Station titles
  "Acquire HBN": { en: "Acquire HBN", es: "Adquirir HBN" },
  "Wet Weight Entry": { en: "Wet Weight Entry", es: "Entrada de peso húmedo" },
  "Trim Packages Entry": { en: "Trim Packages Entry", es: "Entrada de paquetes de poda" },
  "Cryo Weight Entry": { en: "Cryo Weight Entry", es: "Entrada de peso criogénico" },
  // Queue titles
  "HBN Queue": { en: "HBN Queue", es: "Cola de HBN" },
  "Dry Space Queue": { en: "Dry Space Queue", es: "Cola de espacios de secado" },
  "Inbound Queue": { en: "Inbound Queue", es: "Cola de entrada" },
  "Cryo Queue": { en: "Cryo Queue", es: "Cola criogénica" },
  "Testing Queue": { en: "Testing Queue", es: "Cola de pruebas" },
  // Station field labels (registry render path; the English label is the key)
  "Date": { en: "Date", es: "Fecha" },
  "Farm": { en: "Farm", es: "Granja" },
  "Grow Method": { en: "Grow Method", es: "Método de cultivo" },
  "Strain": { en: "Strain", es: "Variedad" },
  "Manicure?": { en: "Manicure?", es: "¿Manicura?" },
  "Start Time": { en: "Start Time", es: "Hora de inicio" },
  "Zone": { en: "Zone", es: "Zona" },
  "Rows": { en: "Rows", es: "Filas" },
  "METRC Harvest Tag": { en: "METRC Harvest Tag", es: "Etiqueta de cosecha METRC" },
  "Move To": { en: "Move To", es: "Mover a" },
  "Notes": { en: "Notes", es: "Notas" },
  "Lot": { en: "Lot", es: "Lote" },
  "Packages": { en: "Packages", es: "Paquetes" },
  // Station operator surfaces
  "Lead": { en: "Lead", es: "Líder" },
  "Save": { en: "Save", es: "Guardar" },
  "Start lot": { en: "Start lot", es: "Iniciar lote" },
  "Add a weight": { en: "Add a weight", es: "Agregar peso" },
  "Finish lot": { en: "Finish lot", es: "Terminar lote" },
  "Weights": { en: "Weights", es: "Pesos" },
  "Total": { en: "Total", es: "Total" },
  "Add a truck": { en: "Add a truck", es: "Agregar camión" },
  "Pick from the left to begin.": {
    en: "Pick from the left to begin.",
    es: "Elija de la izquierda para comenzar.",
  },
  "No rows waiting.": { en: "No rows waiting.", es: "Sin filas en espera." },
  "Lots in progress": { en: "Lots in progress", es: "Lotes en curso" },
  // Queue pane and Data Queues chrome
  "CSV export": { en: "CSV export", es: "Exportar CSV" },
  "No rows.": { en: "No rows.", es: "Sin filas." },
  "Mark complete": { en: "Mark complete", es: "Marcar completo" },
  "Mark trimmed": { en: "Mark trimmed", es: "Marcar podado" },
  "Release": { en: "Release", es: "Liberar" },
  "Edit": { en: "Edit", es: "Editar" },
  "Void": { en: "Void", es: "Anular" },
  "Controls": { en: "Controls", es: "Controles" },
  // Flashes
  "Saved.": { en: "Saved.", es: "Guardado." },
  "HBN minted.": { en: "HBN minted.", es: "HBN generado." },
  // Interco Logistics stub (owner ruling 2026-08-28)
  "Orange barreled. Not built yet.": {
    en: "Orange barreled. Not built yet.",
    es: "Con barriles naranjas. Aún no construido.",
  },
};

/** Look a display string up by its English key; unknown keys render as-is. */
export function t(locale: Locale, key: string): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[locale] ?? entry.en;
}
