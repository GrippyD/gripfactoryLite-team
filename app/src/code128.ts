/**
 * Code 128 SVG encoder (sets B and C, checksum, quiet zones).
 * Primary 1D symbology for METRC package tags (1A4050...).
 */

const PATTERNS: readonly string[] = [
  "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
  "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
  "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
  "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
  "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
  "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
  "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
  "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
  "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
  "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
  "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
  "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
  "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
  "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
  "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
  "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
  "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
  "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
  "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
  "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
  "11010011100", "11000111010",
];

const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP_BITS = "1100011101011";
const QUIET = "0000000000";

export type Code128Encoding = {
  codes: number[];
  checksum: number;
  bits: string;
  pattern: string;
};

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function digitRun(text: string, from: number): number {
  let n = 0;
  for (let i = from; i < text.length && isDigit(text[i]); i++) n += 1;
  return n;
}

function codeBValue(ch: string): number {
  const n = ch.charCodeAt(0) - 32;
  if (n < 0 || n > 94) {
    throw new Error(`Code 128 cannot encode ${JSON.stringify(ch)}.`);
  }
  return n;
}

/** Encode text as Code 128 using set B, switching to C for digit pairs. */
export function encodeCode128(text: string): Code128Encoding {
  if (text.length === 0) throw new Error("Code 128 needs text.");
  const codes: number[] = [];
  let i = 0;
  let set: "B" | "C";
  const allDigits = [...text].every(isDigit);
  if (allDigits && text.length % 2 === 0) {
    codes.push(START_C);
    set = "C";
  } else {
    codes.push(START_B);
    set = "B";
  }
  while (i < text.length) {
    if (set === "C") {
      if (i + 1 < text.length && isDigit(text[i]) && isDigit(text[i + 1])) {
        codes.push(Number(text.slice(i, i + 2)));
        i += 2;
        continue;
      }
      codes.push(CODE_B);
      set = "B";
      continue;
    }
    const run = digitRun(text, i);
    if (run >= 4 && run % 2 === 0) {
      codes.push(CODE_C);
      set = "C";
      continue;
    }
    codes.push(codeBValue(text[i]));
    i += 1;
  }
  let weighted = codes[0];
  for (let p = 1; p < codes.length; p++) weighted += codes[p] * p;
  const checksum = weighted % 103;
  const withCheck = [...codes, checksum];
  const body = withCheck.map((c) => {
    const pat = PATTERNS[c];
    if (!pat) throw new Error(`Code 128 missing pattern ${c}.`);
    return pat;
  }).join("");
  const bits = QUIET + body + STOP_BITS + QUIET;
  return { codes: withCheck, checksum, bits, pattern: body + STOP_BITS };
}

export function code128Svg(text: string, height = 48, color = "#000"): string {
  const { bits } = encodeCode128(text);
  const module = 2;
  const width = bits.length * module;
  const bars: string[] = [];
  let x = 0;
  let run = 0;
  let on = bits[0] === "1";
  for (let i = 0; i <= bits.length; i++) {
    const bit = bits[i];
    if (bit === (on ? "1" : "0") && i < bits.length) {
      run += 1;
      continue;
    }
    if (on && run > 0) {
      bars.push(`<rect x="${x}" y="0" width="${run * module}" height="${height}" fill="${color}"/>`);
    }
    x += run * module;
    run = 1;
    on = bit === "1";
  }
  return `<svg class="code128" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Code 128">${bars.join("")}</svg>`;
}

export const CODE128_START_B = START_B;
export const CODE128_PATTERNS = PATTERNS;
