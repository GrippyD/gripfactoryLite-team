import { Ecc, QrCode } from "./vendor/qr-esm";

/** Encode text to a QR module matrix via the vendored Nayuki encoder. */
export function qrMatrix(text: string): boolean[][] {
  const qr = QrCode.encodeText(text, Ecc.MEDIUM);
  const n = qr.size;
  const rows: boolean[][] = [];
  for (let y = 0; y < n; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < n; x++) row.push(qr.getModule(x, y));
    rows.push(row);
  }
  return rows;
}

export function qrSvg(text: string, modulePx = 3): string {
  const matrix = qrMatrix(text);
  const n = matrix.length;
  const quiet = 4;
  const dim = (n + quiet * 2) * modulePx;
  const rects: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!matrix[y][x]) continue;
      const px = (x + quiet) * modulePx;
      const py = (y + quiet) * modulePx;
      rects.push(`<rect x="${px}" y="${py}" width="${modulePx}" height="${modulePx}"/>`);
    }
  }
  return `<svg class="qrcode" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" role="img" aria-label="QR">${rects.join("")}</svg>`;
}

export function qrVendorWired(): boolean {
  const matrix = qrMatrix("1A405010000000000000001");
  return matrix.length >= 21 && matrix[0].some((cell) => cell) && matrix.some((row) => row.includes(true));
}
