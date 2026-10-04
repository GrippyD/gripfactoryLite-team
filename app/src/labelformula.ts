/**
 * L4 LABEL FORMULAS (canon 0.30.396).
 * A data object's content that starts with = is a formula over L2's fields.
 * One engine serves print, the editor's server render, and the editor's
 * client preview (the client runs this function's own source).
 */

export type FormulaResult = {
  value: string;
  error: string;
  errorKey: string;
  errorVars: Record<string, string>;
};

export function createFormulaEngine() {
  const CATALOG: Array<[string, string]> = [
    ["package_tag", "Package tag"],
    ["item", "Item"],
    ["category", "Category"],
    ["strain", "Strain"],
    ["net_weight", "Net weight"],
    ["packaged_date", "Packaged date"],
    ["license", "License"],
    ["facility_name", "Facility name"],
    ["harvest_name", "Harvest name"],
    ["harvest_date", "Harvest date"],
    ["hbn", "HBN"],
    ["hbn_last_five", "HBN last five"],
    ["thc_percent", "THC percent"],
    ["test_date", "Test date"],
    ["lab", "Lab"],
    ["lab_test_status", "Lab test status"],
    ["production_batch", "Production batch"],
    ["location", "Location"],
  ];
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DATE_TOKENS = ["YYYY", "YY", "MMMM", "MMM", "MM", "M", "DD", "D"];
  const FN: Record<string, 1> = {
    LEFT: 1, RIGHT: 1, MID: 1, LEN: 1, UPPER: 1, LOWER: 1, TRIM: 1,
    SUBSTITUTE: 1, CONCAT: 1, IFBLANK: 1, TEXT: 1,
  };
  const PARSE = "The formula could not be read.";
  const BAD_FN = "The formula names a function this label does not know: {name}.";
  const BAD_FIELD = "The formula names a field this label does not know: {name}.";

  function fill(key: string, vars: Record<string, string>): string {
    let out = key;
    for (const name of Object.keys(vars)) out = out.split("{" + name + "}").join(vars[name]);
    return out;
  }

  function wordsOf(raw: string): string[] {
    return String(raw).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 0);
  }

  function sameWords(a: string[], b: string[]): boolean {
    if (a.length === 0 || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function evaluate(raw: string, fills: Record<string, string>, bucket: string[] | null): FormulaResult {
    const src = String(raw ?? "");
    if (!src.startsWith("=")) return { value: src, error: "", errorKey: "", errorVars: {} };
    let pos = 1;
    const fault = { on: false, key: "", vars: {} as Record<string, string> };

    function broken(key: string, vars?: Record<string, string>): string {
      if (!fault.on) {
        fault.on = true;
        fault.key = key;
        fault.vars = vars ?? {};
      }
      return "";
    }

    function skip(): void {
      while (pos < src.length) {
        const ch = src.charAt(pos);
        if (ch !== " " && ch !== "\n" && ch !== "\r" && ch !== "\t") break;
        pos += 1;
      }
    }

    function peek(): string {
      return pos < src.length ? src.charAt(pos) : "";
    }

    function fieldValue(key: string): string {
      if (bucket) bucket.push(key);
      if (fills && Object.prototype.hasOwnProperty.call(fills, key)) return String(fills[key] ?? "");
      return "";
    }

    function lookupBrace(inner: string): string {
      const text = inner.trim();
      const lower = text.toLowerCase();
      for (const pair of CATALOG) {
        if (lower === pair[0]) return fieldValue(pair[0]);
      }
      if (/^d:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(text)) return fieldValue(text);
      return broken(BAD_FIELD, { name: text });
    }

    function lookupBracket(inner: string): string {
      const text = inner.trim();
      if (!text) return broken(BAD_FIELD, { name: text });
      const lower = text.toLowerCase();
      for (const pair of CATALOG) {
        if (lower === pair[0]) return fieldValue(pair[0]);
      }
      const want = wordsOf(text);
      const core = want.length > 1 && want[want.length - 1] === "id" ? want.slice(0, -1) : want;
      let match = "";
      for (const pair of CATALOG) {
        const keyWords = wordsOf(pair[0]);
        const labelWords = wordsOf(pair[1]);
        if (sameWords(want, keyWords) || sameWords(want, labelWords) || sameWords(core, keyWords) || sameWords(core, labelWords)) {
          if (match && match !== pair[0]) return broken(BAD_FIELD, { name: text });
          match = pair[0];
        }
      }
      if (!match) return broken(BAD_FIELD, { name: text });
      return fieldValue(match);
    }

    function parseString(): string {
      pos += 1;
      let out = "";
      while (pos < src.length) {
        const ch = src.charAt(pos);
        pos += 1;
        if (ch === '"') {
          if (src.charAt(pos) === '"') {
            out += '"';
            pos += 1;
            continue;
          }
          return out;
        }
        out += ch;
      }
      return broken(PARSE);
    }

    function parseNumber(): string | null {
      const start = pos;
      let body = "";
      if (src.charAt(pos) === "-" && (src.charAt(pos + 1) === "." || (src.charAt(pos + 1) >= "0" && src.charAt(pos + 1) <= "9"))) {
        body = "-";
        pos += 1;
      }
      let sawDigit = false;
      while (src.charAt(pos) >= "0" && src.charAt(pos) <= "9") {
        body += src.charAt(pos);
        pos += 1;
        sawDigit = true;
      }
      if (src.charAt(pos) === ".") {
        body += ".";
        pos += 1;
        while (src.charAt(pos) >= "0" && src.charAt(pos) <= "9") {
          body += src.charAt(pos);
          pos += 1;
          sawDigit = true;
        }
      }
      if (!sawDigit || body === "-" || body === "." || body === "-.") {
        pos = start;
        return null;
      }
      const n = Number(body);
      if (!Number.isFinite(n)) {
        pos = start;
        return null;
      }
      return String(n);
    }

    function whole(raw: string, key: string): number {
      const s = String(raw).trim();
      if (!/^-?\d+(\.\d+)?$/.test(s)) {
        broken(key);
        return 0;
      }
      const n = Number(s);
      if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
        broken(key);
        return 0;
      }
      return n;
    }

    function pad(n: number): string {
      return n < 10 ? "0" + n : String(n);
    }

    function roundHalfUp(n: number, places: number): number {
      const sign = n < 0 ? -1 : 1;
      const factor = 10 ** places;
      const rounded = Math.floor(Math.abs(n) * factor + 0.5 + 1e-8);
      return (sign * rounded) / factor;
    }

    function fixed(n: number, places: number): string {
      const sign = n < 0 ? "-" : "";
      return sign + Math.abs(n).toFixed(places);
    }

    function thousands(n: number): string {
      const sign = n < 0 ? "-" : "";
      const digits = String(Math.abs(Math.trunc(n)));
      return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function parseDate(value: string): { y: number; m: number; d: number } | null {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!match) return null;
      const y = Number(match[1]);
      const m = Number(match[2]);
      const d = Number(match[3]);
      if (m < 1 || m > 12 || d < 1 || d > 31) return null;
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
      return { y, m, d };
    }

    function dateTokenAt(format: string, index: number): string {
      const rest = format.slice(index).toUpperCase();
      for (const token of DATE_TOKENS) {
        if (rest.startsWith(token)) return token;
      }
      return "";
    }

    function hasDateToken(format: string): boolean {
      for (let i = 0; i < format.length; i++) if (dateTokenAt(format, i)) return true;
      return false;
    }

    function renderDate(date: { y: number; m: number; d: number }, format: string): string {
      let out = "";
      let i = 0;
      while (i < format.length) {
        const token = dateTokenAt(format, i);
        if (!token) {
          out += format.charAt(i);
          i += 1;
          continue;
        }
        if (token === "YYYY") out += String(date.y);
        else if (token === "YY") out += pad(date.y % 100);
        else if (token === "MMMM") out += MONTHS[date.m - 1];
        else if (token === "MMM") out += MON[date.m - 1];
        else if (token === "MM") out += pad(date.m);
        else if (token === "M") out += String(date.m);
        else if (token === "DD") out += pad(date.d);
        else out += String(date.d);
        i += token.length;
      }
      return out;
    }

    function isNumber(value: string): boolean {
      return /^-?\d+(\.\d+)?$/.test(value.trim());
    }

    function formatText(value: string, format: string): string {
      const fmt = format.trim();
      if (fmt === "0" || fmt === "0.0" || fmt === "0.00" || fmt === "0.000" || fmt === "#,##0") {
        if (!isNumber(value)) return value;
        const n = Number(value.trim());
        if (fmt === "#,##0") return thousands(roundHalfUp(n, 0));
        const places = fmt === "0" ? 0 : fmt.length - 2;
        return fixed(roundHalfUp(n, places), places);
      }
      if (!hasDateToken(fmt)) return value;
      const date = parseDate(value.trim());
      if (!date) return value;
      return renderDate(date, fmt);
    }

    function dispatch(name: string, args: string[]): string {
      const fn = name.toUpperCase();
      if (!FN[fn]) return broken(BAD_FN, { name: fn });
      if (fn === "LEFT" || fn === "RIGHT") {
        if (args.length < 1 || args.length > 2) return broken(fn + " needs 1 or 2 arguments.");
        const text = String(args[0]);
        const n = args.length === 2 ? whole(args[1], fn + " needs a whole number of characters.") : 1;
        if (fault.on) return "";
        if (n === 0 || text === "") return "";
        if (n >= text.length) return text;
        return fn === "LEFT" ? text.slice(0, n) : text.slice(text.length - n);
      }
      if (fn === "MID") {
        if (args.length !== 3) return broken("MID needs 3 arguments.");
        const text = String(args[0]);
        const start = whole(args[1], "MID needs a start at 1 or more.");
        if (fault.on) return "";
        if (start < 1) return broken("MID needs a start at 1 or more.");
        const n = whole(args[2], "MID needs a whole number of characters.");
        if (fault.on) return "";
        if (n === 0 || start > text.length) return "";
        return text.slice(start - 1, start - 1 + n);
      }
      if (fn === "LEN") {
        if (args.length !== 1) return broken("LEN needs 1 argument.");
        return String(String(args[0]).length);
      }
      if (fn === "UPPER" || fn === "LOWER") {
        if (args.length !== 1) return broken(fn + " needs 1 argument.");
        const text = String(args[0]);
        return fn === "UPPER" ? text.toUpperCase() : text.toLowerCase();
      }
      if (fn === "TRIM") {
        if (args.length !== 1) return broken("TRIM needs 1 argument.");
        return String(args[0]).replace(/^[ ]+|[ ]+$/g, "").replace(/ {2,}/g, " ");
      }
      if (fn === "SUBSTITUTE") {
        if (args.length !== 3) return broken("SUBSTITUTE needs 3 arguments.");
        const text = String(args[0]);
        const old = String(args[1]);
        const next = String(args[2]);
        if (old === "") return text;
        return text.split(old).join(next);
      }
      if (fn === "CONCAT") {
        if (args.length < 1) return broken("CONCAT needs at least 1 argument.");
        let out = "";
        for (const arg of args) out += String(arg);
        return out;
      }
      if (fn === "IFBLANK") {
        if (args.length !== 2) return broken("IFBLANK needs 2 arguments.");
        return String(args[0]) === "" ? String(args[1]) : String(args[0]);
      }
      if (args.length !== 2) return broken("TEXT needs 2 arguments.");
      return formatText(String(args[0]), String(args[1]));
    }

    function parseCall(name: string): string {
      pos += 1;
      const args: string[] = [];
      skip();
      if (peek() === ")") {
        pos += 1;
        return dispatch(name, args);
      }
      while (!fault.on) {
        args.push(parseExpr());
        if (fault.on) return "";
        skip();
        if (peek() === ",") {
          pos += 1;
          continue;
        }
        if (peek() === ")") {
          pos += 1;
          return dispatch(name, args);
        }
        return broken(PARSE);
      }
      return "";
    }

    function parseTerm(): string {
      if (fault.on) return "";
      skip();
      const ch = peek();
      if (ch === '"') return parseString();
      if (ch === "{") {
        const end = src.indexOf("}", pos + 1);
        if (end < 0) return broken(PARSE);
        const inner = src.slice(pos + 1, end);
        pos = end + 1;
        return lookupBrace(inner);
      }
      if (ch === "[") {
        const end = src.indexOf("]", pos + 1);
        if (end < 0) return broken(PARSE);
        const inner = src.slice(pos + 1, end);
        pos = end + 1;
        return lookupBracket(inner);
      }
      if ((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z")) {
        const start = pos;
        pos += 1;
        while (pos < src.length) {
          const next = src.charAt(pos);
          const word = (next >= "A" && next <= "Z") || (next >= "a" && next <= "z") || (next >= "0" && next <= "9");
          if (!word) break;
          pos += 1;
        }
        const name = src.slice(start, pos);
        skip();
        if (peek() !== "(") return broken(PARSE);
        return parseCall(name);
      }
      const num = parseNumber();
      if (num == null) return broken(PARSE);
      return num;
    }

    function parseExpr(): string {
      let left = parseTerm();
      if (fault.on) return "";
      while (true) {
        skip();
        if (peek() !== "&") break;
        pos += 1;
        const right = parseTerm();
        if (fault.on) return "";
        left += right;
      }
      return left;
    }

    try {
      const value = parseExpr();
      if (fault.on) return { value: "#ERROR", error: fill(fault.key, fault.vars), errorKey: fault.key, errorVars: fault.vars };
      skip();
      if (pos < src.length) return { value: "#ERROR", error: PARSE, errorKey: PARSE, errorVars: {} };
      return { value: value.length > 500 ? value.slice(0, 500) : value, error: "", errorKey: "", errorVars: {} };
    } catch {
      return { value: "#ERROR", error: PARSE, errorKey: PARSE, errorVars: {} };
    }
  }

  function insertFieldToken(content: string, token: string, start: number | null, end: number | null): string {
    const text = String(content ?? "");
    const piece = String(token ?? "");
    if (text.charAt(0) === "=") {
      const a = start == null || Number.isNaN(Number(start)) ? text.length : Math.max(0, Math.min(text.length, Math.floor(Number(start))));
      const b = end == null || Number.isNaN(Number(end)) ? a : Math.max(a, Math.min(text.length, Math.floor(Number(end))));
      return text.slice(0, a) + piece + text.slice(b);
    }
    return (text + " " + piece).trim();
  }

  return {
    evaluateFormula(raw: string, fills: Record<string, string>): FormulaResult {
      try {
        return evaluate(raw, fills ?? {}, null);
      } catch {
        return { value: "#ERROR", error: PARSE, errorKey: PARSE, errorVars: {} };
      }
    },
    formulaTokens(raw: string): string[] {
      const bucket: string[] = [];
      try {
        evaluate(raw, {}, bucket);
      } catch {
        return bucket;
      }
      return bucket;
    },
    insertFieldToken,
  };
}

let cached: ReturnType<typeof createFormulaEngine> | null = null;

function engine(): ReturnType<typeof createFormulaEngine> {
  if (!cached) cached = createFormulaEngine();
  return cached;
}

export function evaluateFormula(raw: string, fills: Record<string, string>): FormulaResult {
  try {
    return engine().evaluateFormula(raw, fills);
  } catch {
    return { value: "#ERROR", error: "The formula could not be read.", errorKey: "The formula could not be read.", errorVars: {} };
  }
}

export function formulaTokens(raw: string): string[] {
  return engine().formulaTokens(raw);
}

export function insertFieldToken(content: string, token: string, start: number | null, end: number | null): string {
  return engine().insertFieldToken(content, token, start, end);
}

/**
 * The editor's client preview runs this source, not a second copy.
 * The worker's bundle names inner functions with __name, which lives
 * outside the function, so the client defines that helper around the
 * same source.
 */
export function formulaEngineSource(): string {
  return `(function () {
  function __name(target, value) {
    try { Object.defineProperty(target, "name", { value: value, configurable: true }); } catch (err) {}
    return target;
  }
  return (${createFormulaEngine.toString()})();
})()`;
}
