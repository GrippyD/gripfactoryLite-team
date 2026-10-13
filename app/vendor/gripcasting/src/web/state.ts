/* What is on screen. Live data comes from the API; S.view swaps in a past submission (read only) while the live
   state waits in S.view.live. */
import type { Actuals, BuildDoc, Drivers, Me, Submission, Tx, Upload } from "../shared/types";
import type { ModelState } from "../shared/model";
import type { Preview } from "./parse";

export type Tab = "overview" | "revenue" | "build" | "txns" | "subs" | "actuals";
export interface LiveState { drivers: Drivers; actuals: Actuals | null; builds: Record<string, BuildDoc>; canWrite: boolean; isAdmin: boolean }
export interface SubState extends ModelState { sub: Submission }
export interface Detail { meta: { closeDate: string; fileName: string; from: string | null; to: string | null } | null; rows: Tx[]; error?: boolean }

export const S = {
  tab: "overview" as Tab,
  me: null as Me | null,
  users: {} as Record<string, string>,
  drivers: null as unknown as Drivers,
  driversVersion: null as string | null,
  actuals: null as Actuals | null,
  builds: {} as Record<string, BuildDoc>,
  uploads: [] as Upload[],
  preview: null as Preview | null,
  loadingActuals: false,
  canWrite: true,
  isAdmin: false,
  saving: "",
  buSort: "bu" as "bu" | "b" | "a" | "rem" | "landing" | "varc",
  buildBU: "all",
  focusG: null as string | null,
  open: {} as Record<string, boolean>,
  addGL: null as { sel: string; code?: string; name?: string } | null,
  confirmDel: null as string | null,
  /* transactions (QB Back Up) */
  detail: null as Detail | null,
  detailLoading: false,
  tx: { bu: "all", gl: "", month: "", q: "" },
  /* submissions */
  subs: [] as Submission[],
  subF: { close: "", bu: "all", kind: "all" },
  cmp: null as string | null,
  cmpState: null as SubState | null,
  confirmFinal: false,
  submitting: false,
  view: null as { sub: Submission; live: LiveState } | null,
};
export const modelState = (): ModelState => ({ drivers: S.drivers, actuals: S.actuals, builds: S.builds });

try {
  const t = localStorage.getItem("gripfc.tab"); if (t) S.tab = (t === "costs" || t === "bu") ? "overview" : t as Tab;
  const b = localStorage.getItem("gripfc.bu"); if (b) S.buildBU = b;
} catch { /* storage blocked: defaults */ }
