/* Bindings and variables. Live: set by IT on the Cloudflare Pages project (Hyperdrive binding, Access team
   domain and audience). Local: .dev.vars (gitignored) plus the local Hyperdrive connection string. */
export interface Env {
  /** Hyperdrive binding (only its connection string is used) */
  HYPERDRIVE: { connectionString: string };
  /** "local" only in .dev.vars. Anything else, including unset, is treated as production. */
  ENVIRONMENT?: string;
  /** Cloudflare Access team domain, e.g. "grip.cloudflareaccess.com" */
  ACCESS_TEAM_DOMAIN?: string;
  /** Cloudflare Access application audience (AUD) tag */
  ACCESS_AUD?: string;
  /** local only: who you are when there is no Access in front (must exist in gripcasting.app_users) */
  DEV_USER_EMAIL?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
