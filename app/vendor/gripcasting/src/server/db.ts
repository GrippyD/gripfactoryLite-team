/* Postgres through Hyperdrive with postgres.js. One client per request, closed when the response is done.
   numeric (money) and bigint (count) come back as strings from Postgres; parse them to numbers here so nothing
   downstream sums text. Dates are selected as ::text so no time zone ever shifts a close date. */
import postgres from "postgres";
import type { Env } from "./env";

type Types = { numeric: number; bigint: number };
export type Sql = postgres.Sql<Types>;
/** inside sql.begin(): same tagged-template calls, different type */
export type TxSql = postgres.TransactionSql<Types>;
/** a connection or a transaction, for helpers used in both */
export type Q = Sql | TxSql;
export const asSql = (q: Q) => q as Sql;

export function connect(env: Env): Sql {
  return postgres(env.HYPERDRIVE.connectionString, {
    max: 5,
    fetch_types: false,
    types: {
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  }) as unknown as Sql;
}

/** the optimistic-lock token: updated_at to the millisecond, as an ISO string (null = never saved) */
export const versionOf = (d: Date | null | undefined) => d ? new Date(d).toISOString() : null;
