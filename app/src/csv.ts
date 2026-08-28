export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function queueRowsToCsv(
  columns: Array<{ field: string; label: string }>,
  rows: Array<{ id: string; values: Record<string, string> }>
): string {
  const records = rows.map((row) => {
    const rec: Record<string, unknown> = { id: row.id };
    for (const col of columns) rec[col.field] = row.values[col.field] ?? "";
    return rec;
  });
  return toCsv(records);
}
