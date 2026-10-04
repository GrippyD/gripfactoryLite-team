import { describe, expect, it } from "vitest";
import { fieldWords, LABEL_FIELD_KEYS } from "../src/labeldata";
import { bindText } from "../src/labeldata";
import { t, tFill } from "../src/i18n";
import {
  evaluateFormula,
  formulaEngineSource,
  formulaTokens,
  insertFieldToken,
  type FormulaResult,
} from "../src/labelformula";

const TAG = "1A40503000311FB000000111";
const DATE = "2026-09-24";
const FILLS = { package_tag: TAG, harvest_date: DATE, packaged_date: DATE, item: "  Blue   Dream  ", strain: "Blue Dream" };

function ok(value: string): FormulaResult {
  return { value, error: "", errorKey: "", errorVars: {} };
}

function bad(key: string, vars: Record<string, string> = {}): FormulaResult {
  let error = key;
  for (const [name, value] of Object.entries(vars)) error = error.split("{" + name + "}").join(value);
  return { value: "#ERROR", error, errorKey: key, errorVars: vars };
}

const CASES: Array<{ raw: string; fills?: Record<string, string>; expect: FormulaResult }> = [
  { raw: `=LEFT("abcdef",4)`, expect: ok("abcd") },
  { raw: `=LEFT("abcdef")`, expect: ok("a") },
  { raw: `=LEFT("ab",10)`, expect: ok("ab") },
  { raw: `=LEFT("ab",0)`, expect: ok("") },
  { raw: `=LEFT("",4)`, expect: ok("") },
  { raw: `=RIGHT("abcdef",4)`, expect: ok("cdef") },
  { raw: `=RIGHT("abcdef")`, expect: ok("f") },
  { raw: `=RIGHT("ab",10)`, expect: ok("ab") },
  { raw: `=RIGHT("ab",0)`, expect: ok("") },
  { raw: `=RIGHT("",6)`, fills: { package_tag: "" }, expect: ok("") },
  { raw: `=RIGHT({package_tag},6)`, fills: { package_tag: "" }, expect: ok("") },
  { raw: `=RIGHT({package_tag},6)`, fills: {}, expect: ok("") },
  { raw: `=MID("abcdef",2,3)`, expect: ok("bcd") },
  { raw: `=MID("abcdef",1,2)`, expect: ok("ab") },
  { raw: `=MID("abcdef",5,10)`, expect: ok("ef") },
  { raw: `=MID("abcdef",8,2)`, expect: ok("") },
  { raw: `=MID("abcdef",1,0)`, expect: ok("") },
  { raw: `=LEN("abcd")`, expect: ok("4") },
  { raw: `=LEN("")`, expect: ok("0") },
  { raw: `=UPPER("Blue Dream")`, expect: ok("BLUE DREAM") },
  { raw: `=LOWER("Blue Dream")`, expect: ok("blue dream") },
  { raw: `=TRIM("  a   b  c  ")`, expect: ok("a b c") },
  { raw: `=TRIM("a  b  c")`, expect: ok("a b c") },
  { raw: `=SUBSTITUTE("a-a-a","a","b")`, expect: ok("b-b-b") },
  { raw: `=SUBSTITUTE("aaa","aa","b")`, expect: ok("ba") },
  { raw: `=CONCAT("Blue"," ","Dream")`, expect: ok("Blue Dream") },
  { raw: `=CONCAT("only")`, expect: ok("only") },
  { raw: `=IFBLANK("","none")`, expect: ok("none") },
  { raw: `=IFBLANK("22.4","none")`, expect: ok("22.4") },
  { raw: `=IFBLANK({thc_percent},"none")`, fills: { thc_percent: "" }, expect: ok("none") },
  { raw: `="A"&"B"&"C"`, expect: ok("ABC") },
  { raw: `=UPPER(LEFT("ab",1))&LOWER(RIGHT("CD",1))`, expect: ok("Ad") },
  { raw: `=LEFT("ab"&"cd",3)`, expect: ok("abc") },
  { raw: `="Say ""hi"""`, expect: ok('Say "hi"') },
  { raw: `=RIGHT({package_tag},6)`, fills: FILLS, expect: ok("000111") },
  { raw: `=right({package_tag},6)`, fills: FILLS, expect: ok("000111") },
  { raw: `=RIGHT([package_tag],6)`, fills: FILLS, expect: ok("000111") },
  { raw: `=RIGHT([Package tag],6)`, fills: FILLS, expect: ok("000111") },
  { raw: `=RIGHT([PACKAGE.TAG.ID],6)`, fills: FILLS, expect: ok("000111") },
  { raw: `=TEXT({harvest_date},"MM/DD/YY")`, fills: FILLS, expect: ok("09/24/26") },
  { raw: `=TEXT("2026-09-24","mm/dd/yy")`, expect: ok("09/24/26") },
  { raw: `=TEXT("2026-09-24","MMM D, YYYY")`, expect: ok("Sep 24, 2026") },
  { raw: `=TEXT("2026-09-04","M/D/YY")`, expect: ok("9/4/26") },
  { raw: `=TEXT("2026-09-24","MMMM")`, expect: ok("September") },
  { raw: `=TEXT("2026-01-02","YYYY YY MM M DD D")`, expect: ok("2026 26 01 1 02 2") },
  { raw: `=TEXT("2026-02-31","MM/DD/YY")`, expect: ok("2026-02-31") },
  { raw: `=TEXT("not a date","MM/DD/YY")`, expect: ok("not a date") },
  { raw: `=TEXT(1.5,"0")`, expect: ok("2") },
  { raw: `=TEXT(1.4,"0")`, expect: ok("1") },
  { raw: `=TEXT(1.25,"0.0")`, expect: ok("1.3") },
  { raw: `=TEXT(1.24,"0.0")`, expect: ok("1.2") },
  { raw: `=TEXT(1.2345,"0.000")`, expect: ok("1.235") },
  { raw: `=TEXT(1.2,"0.00")`, expect: ok("1.20") },
  { raw: `=TEXT(1234.4,"#,##0")`, expect: ok("1,234") },
  { raw: `=TEXT(1234.5,"#,##0")`, expect: ok("1,235") },
  { raw: `=TEXT(1000000,"#,##0")`, expect: ok("1,000,000") },
  { raw: `=TEXT(0,"#,##0")`, expect: ok("0") },
  { raw: `=TEXT("abc","0.00")`, expect: ok("abc") },
  { raw: `=TEXT("2026-09-24","0.00")`, expect: ok("2026-09-24") },
  { raw: `=TEXT("hello","hello")`, expect: ok("hello") },
  { raw: `=RIGHT(`, expect: bad("The formula could not be read.") },
  { raw: `=`, expect: bad("The formula could not be read.") },
  { raw: `=FOO(1)`, expect: bad("The formula names a function this label does not know: {name}.", { name: "FOO" }) },
  { raw: `=RIGHT({nope},6)`, expect: bad("The formula names a field this label does not know: {name}.", { name: "nope" }) },
  { raw: `=RIGHT([not a field],6)`, expect: bad("The formula names a field this label does not know: {name}.", { name: "not a field" }) },
  { raw: `=MID("abcdef")`, expect: bad("MID needs 3 arguments.") },
  { raw: `=LEN()`, expect: bad("LEN needs 1 argument.") },
  { raw: `=UPPER("a","b")`, expect: bad("UPPER needs 1 argument.") },
  { raw: `=LEFT("ab","x")`, expect: bad("LEFT needs a whole number of characters.") },
  { raw: `=RIGHT("ab",-1)`, expect: bad("RIGHT needs a whole number of characters.") },
  { raw: `=MID("ab",0,1)`, expect: bad("MID needs a start at 1 or more.") },
  { raw: `=CONCAT()`, expect: bad("CONCAT needs at least 1 argument.") },
  { raw: `="${"a".repeat(600)}"`, expect: ok("a".repeat(500)) },
];

describe("label formulas", () => {
  const client = new Function(`return ${formulaEngineSource()}`)() as {
    evaluateFormula: typeof evaluateFormula;
    formulaTokens: typeof formulaTokens;
    insertFieldToken: typeof insertFieldToken;
  };

  it("runs one table through the module and the client copy", () => {
    expect(formulaEngineSource()).toContain("function createFormulaEngine");
    expect(formulaEngineSource()).not.toContain("[native code]");
    for (const row of CASES) {
      const fills = row.fills ?? {};
      expect(evaluateFormula(row.raw, fills), row.raw).toEqual(row.expect);
      expect(client.evaluateFormula(row.raw, fills), "client " + row.raw).toEqual(row.expect);
    }
  });

  it("never throws", () => {
    expect(() => evaluateFormula("=((((", {})).not.toThrow();
    expect(() => client.evaluateFormula(null as unknown as string, null as unknown as Record<string, string>)).not.toThrow();
    expect(evaluateFormula("=((((", {}).value).toBe("#ERROR");
  });

  it("reads every catalog field by key, by its words, and leaves custom data blank when unresolved", () => {
    for (const key of LABEL_FIELD_KEYS) {
      expect(evaluateFormula(`={${key}}`, { [key]: "V" }).value).toBe("V");
      expect(evaluateFormula(`=[${fieldWords(key)}]`, { [key]: "V" }).value).toBe("V");
    }
    expect(evaluateFormula("={d:notes:c1}", {}).value).toBe("");
    expect(evaluateFormula("={d:notes:c1}", { "d:notes:c1": "Room 4" }).value).toBe("Room 4");
  });

  it("lists formula fields in brace and bracket spellings and skips text", () => {
    expect(formulaTokens('=RIGHT([PACKAGE.TAG.ID],6)&TEXT({harvest_date},"MM/DD/YY")&{d:notes:c1}')).toEqual([
      "package_tag",
      "harvest_date",
      "d:notes:c1",
    ]);
    expect(formulaTokens('="[PACKAGE.TAG.ID]"')).toEqual([]);
    expect(formulaTokens("{package_tag}")).toEqual([]);
    expect(client.formulaTokens("=LEFT([Package tag],1)")).toEqual(["package_tag"]);
  });

  it("inserts a field at the cursor inside a formula and appends otherwise", () => {
    expect(insertFieldToken("=RIGHT(,6)", "{package_tag}", 7, 7)).toBe("=RIGHT({package_tag},6)");
    expect(insertFieldToken("Hello", "{strain}", null, null)).toBe("Hello {strain}");
    expect(client.insertFieldToken("=LEFT(,1)", "{item}", 6, 6)).toBe("=LEFT({item},1)");
  });

  it("binds text without an equals sign exactly as before", () => {
    expect(bindText("Hello {package_tag}", { package_tag: TAG })).toBe(`Hello ${TAG}`);
    expect(bindText("{package_tag} {missing}", { package_tag: TAG })).toBe(`${TAG} {missing}`);
    expect(bindText("=RIGHT({package_tag},6)", { package_tag: TAG })).toBe("000111");
    expect(bindText("=RIGHT({nope},6)", {})).toBe("#ERROR");
    expect(bindText("=RIGHT({package_tag},6)", { package_tag: "" })).toBe("");
  });

  it("translates every formula error", () => {
    const kinds = ["text box", "memo", "barcode", "QR"];
    for (const row of CASES) {
      if (!row.expect.errorKey) continue;
      expect(t("es", row.expect.errorKey)).not.toBe(row.expect.errorKey);
      for (const kind of kinds) {
        const key = `The ${kind} holds a formula that cannot be saved. ${row.expect.errorKey}`;
        const es = tFill("es", key, row.expect.errorVars);
        expect(es, key).not.toBe(key);
        expect(es).not.toContain("could not be read");
        expect(es).not.toContain("does not know");
        expect(es).not.toContain("needs");
      }
    }
  });
});
