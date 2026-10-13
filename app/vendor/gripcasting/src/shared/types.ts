/* Shapes shared by the browser app and the API. They match the claude.ai documents the app started with,
   so the data/db/ export imports without reshaping. Money crosses the wire as numbers (dollars, 2 dp);
   Postgres holds it as numeric(12,2). */

export interface Vol {
  plants: number; wetPerPlant: number; dryDown: number; ffWet: number; shrink: number; btr: number;
  prepackPct: number; prepackPrice: number; bulkPrice: number;
  lbsPerLiter: number; carts: number; gPerCart: number; cartPrice: number; literPrice: number;
  resinYield: number; resinSplit: number; resinPrice: number;
  premLbs: number; premPrice: number; premOn: boolean;
  ghLbs: number; ghPrice: number; ghOn: boolean;
  iprUnits: number; iprPrice: number; iprOn: boolean;
  ibLbs: number; ibPrice: number; ibOn: boolean;
  tps: number; tpsOn: boolean;
}
export type VolNumKey = { [K in keyof Vol]: Vol[K] extends number ? K : never }[keyof Vol];
export type VolToggleKey = { [K in keyof Vol]: Vol[K] extends boolean ? K : never }[keyof Vol];

export type DriverType = "plant" | "drylb" | "budlb" | "cart" | "none";
export type Basis = "runrate" | "budget" | "seasonal";
export interface GLDriver { type: DriverType; rate: number; basis: Basis }
export interface Drivers { vol: Vol; gl: Record<string, GLDriver> }

/** [entity, business unit, GL, amount] */
export type ActualRow = [string, string, string, number];
export interface Actuals {
  closeDate: string; fileName: string; uploadedAt: string;
  rows: ActualRow[];
  /** GL → "YYYY-MM" → amount, from the QB Back Up tab */
  monthly: Record<string, Record<string, number>>;
}

export type VolBase = "wet" | "dry" | "bud" | "trim" | "prepack" | "plants";
export interface BuildItem {
  id: string; desc?: string; po?: string;
  /** driven items: volume × share ÷ per-hour rate = hours */
  drv?: VolBase; share?: number; per?: number;
  qty?: number; unit?: string; cost?: number;
  start?: string; end?: string;
  /** legacy: a single "YYYY-MM" month, replaced by start/end */
  month?: string;
}
export type LineStatus = "notstarted" | "inprogress" | "fixed" | "closed";
export interface BuildLine {
  status: LineStatus; items: BuildItem[]; reason?: string; custom?: boolean;
  /** stamped by the server from the edge identity, never by the client */
  updatedAt?: string; updatedBy?: string;
}
export interface BuildDoc {
  bu: string; lines: Record<string, BuildLine>;
  submittedAt?: string | null; submittedBy?: string | null;
  /** optimistic-lock token: the row's updated_at as loaded (null = never saved) */
  version?: string | null;
}

/** QB Back Up transaction: [date, type, num, vendor, memo, GL, entity, amount] */
export type TxRow = [string, string, string, string, string, string, string, number];
/** bu = BU code, or "none" when the Name column doesn't name a BU */
export interface Tx { bu: string; r: TxRow }

export interface Totals { b: number; a: number; rem: number; landing: number; varc: number; revenue?: number; ebitda?: number }
export interface Submission {
  id: string; kind: "bu" | "final"; code: string | null; bu: string; closeDate: string | null;
  submittedAt: string; submittedBy: string | null; totals: Totals;
  /** final only: BU code → the BU submission it includes */
  buSubs?: Record<string, string>;
}
export interface Snapshot { drivers: Drivers; builds: Record<string, BuildDoc> }

export interface Upload { closeDate: string; fileName: string; uploadedAt: string; total: number; transactions: number }

export type Role = "admin" | "director";
export interface Me { email: string; name: string; role: Role }
export interface UserName { email: string; name: string }

/** reference data for a harvest: from the 2026H Budget Final, held in Postgres, served to signed-in users only */
export interface Reference {
  harvest: string;
  bus: string[];
  gls: string[];
  /** GL → BU → amount */
  budget: Record<string, Record<string, number>>;
  /** restated wages + payroll tax budget (all in 12 SG&A) */
  wagesBudget: number | null;
  /** GL → prior-year monthly pattern, Apr..Mar */
  season: Record<string, number[]>;
  volDefault: Vol;
}

export interface StatePayload {
  drivers: (Drivers & { version: string | null }) | null;
  actuals: Actuals | null;
  builds: Record<string, BuildDoc>;
  uploads: Upload[];
  submissions: Submission[];
  users: UserName[];
}

/** POST /api/actuals */
export interface ActualsUpload extends Omit<Actuals, "uploadedAt"> { transactions: Tx[] }
/** POST /api/submissions. The server snapshots the saved drivers and builds and computes the totals itself,
    so a submission is exactly what was saved, stamped with the edge identity. */
export interface SubmissionIn { kind: "bu" | "final"; code: string | null }
