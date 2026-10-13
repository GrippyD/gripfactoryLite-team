-- destined: interim
-- GRIPCasting: 2026H rolling cost forecast and revenue driver model.
-- Drafted in a session, applied by IT (Supabase) or by the developer to their own local Postgres. Never from a session.
--
-- Conventions (shared-docs reference/conventions): schema gripcasting, uuid ids, timestamptz, numeric(12,2) money,
-- jsonb, created_at/updated_at on every table, created_by from the edge identity, no RLS (Worker -> Hyperdrive),
-- optimistic locking on updated_at.
--
-- Deliberate exceptions for IT to confirm:
--   * unit rates (build item unit cost, labor rate) are numeric(12,4): costs like $0.045 per tag need more than cents.
--     Line and document totals stay numeric(12,2).
--   * natural keys (GL name, BU name/code) are text within a harvest, matching the QuickBooks exports, instead of uuid FKs.

CREATE SCHEMA IF NOT EXISTS gripcasting;

-- People who can use the app. Identity comes from Cloudflare Access (email); role is the real access control.
CREATE TABLE gripcasting.app_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  name        text NOT NULL,
  role        text NOT NULL CHECK (role IN ('admin', 'director')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  created_by  text
);
CREATE UNIQUE INDEX app_users_email_key ON gripcasting.app_users (lower(email));

-- One row per harvest year (2026H = Apr 2026 - Mar 2027) with its model settings.
CREATE TABLE gripcasting.harvests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  starts_on     date NOT NULL,
  is_current    boolean NOT NULL DEFAULT false,
  wages_budget  numeric(12,2),                    -- restated wages + payroll tax (Total W2), all in 12 SG&A
  season        jsonb NOT NULL DEFAULT '{}',       -- GL -> prior-year monthly pattern Apr..Mar
  vol_default   jsonb NOT NULL,                    -- default revenue drivers and prices
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz,
  created_by    text
);
CREATE UNIQUE INDEX harvests_one_current ON gripcasting.harvests (is_current) WHERE is_current;

CREATE TABLE gripcasting.business_units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id  uuid NOT NULL REFERENCES gripcasting.harvests(id) ON DELETE CASCADE,
  code        text NOT NULL,                       -- "01"
  name        text NOT NULL,                       -- "01 Outdoor Grow"
  sort        smallint NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  created_by  text,
  UNIQUE (harvest_id, code)
);

CREATE TABLE gripcasting.gl_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id  uuid NOT NULL REFERENCES gripcasting.harvests(id) ON DELETE CASCADE,
  name        text NOT NULL,                       -- "5120 · Nutrients", as QuickBooks names it
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  created_by  text,
  UNIQUE (harvest_id, name)
);

-- 2026H Budget Final, GL x BU.
CREATE TABLE gripcasting.budget_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id  uuid NOT NULL REFERENCES gripcasting.harvests(id) ON DELETE CASCADE,
  gl          text NOT NULL,
  bu          text NOT NULL,
  amount      numeric(12,2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  created_by  text,
  UNIQUE (harvest_id, gl, bu)
);

-- Revenue drivers set by finance. One row per harvest; edits lock on updated_at.
CREATE TABLE gripcasting.drivers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id  uuid NOT NULL UNIQUE REFERENCES gripcasting.harvests(id) ON DELETE CASCADE,
  vol         jsonb NOT NULL,
  gl          jsonb NOT NULL DEFAULT '{}',
  updated_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  created_by  text
);

-- Monthly actuals from the BU Summary workbook. One row per close; is_current marks the one the forecast uses.
-- Earlier closes are kept so a past submission recalculates on the actuals it was made on.
CREATE TABLE gripcasting.actual_closes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id   uuid NOT NULL REFERENCES gripcasting.harvests(id) ON DELETE CASCADE,
  close_date   date NOT NULL,
  file_name    text NOT NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  is_current   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz,
  created_by   text,
  UNIQUE (harvest_id, close_date)
);
CREATE UNIQUE INDEX actual_closes_one_current ON gripcasting.actual_closes (harvest_id) WHERE is_current;

-- PNN BU / PNS BU / SMI BU tabs: entity x BU x GL, harvest to date.
CREATE TABLE gripcasting.actual_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  close_id    uuid NOT NULL REFERENCES gripcasting.actual_closes(id) ON DELETE CASCADE,
  entity      text NOT NULL,
  bu          text NOT NULL,
  gl          text NOT NULL,
  amount      numeric(12,2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  created_by  text
);
CREATE INDEX actual_lines_close ON gripcasting.actual_lines (close_id);

-- QB Back Up totals by GL and month, for run rates.
CREATE TABLE gripcasting.actual_monthly (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  close_id    uuid NOT NULL REFERENCES gripcasting.actual_closes(id) ON DELETE CASCADE,
  gl          text NOT NULL,
  month       date NOT NULL,                       -- first day of the month
  amount      numeric(12,2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  created_by  text,
  UNIQUE (close_id, gl, month)
);

-- QB Back Up transactions, harvest to date. Split (card holder names) and Balance are not kept.
CREATE TABLE gripcasting.transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  close_id    uuid NOT NULL REFERENCES gripcasting.actual_closes(id) ON DELETE CASCADE,
  txn_date    date NOT NULL,
  txn_type    text NOT NULL DEFAULT '',
  num         text NOT NULL DEFAULT '',
  vendor      text NOT NULL DEFAULT '',
  memo        text NOT NULL DEFAULT '',
  gl          text NOT NULL,
  bu_code     text,                                -- null = the Name column doesn't name a BU
  entity      text NOT NULL DEFAULT '',
  amount      numeric(12,2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  created_by  text
);
CREATE INDEX transactions_close ON gripcasting.transactions (close_id, bu_code, gl);

-- Upload history (the Actuals tab list), kept even when a close is reloaded.
CREATE TABLE gripcasting.upload_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id    uuid NOT NULL REFERENCES gripcasting.harvests(id) ON DELETE CASCADE,
  close_date    date NOT NULL,
  file_name     text NOT NULL,
  total         numeric(12,2) NOT NULL,
  transactions  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz,
  created_by    text
);

-- A BU's forecast build. Edits lock on updated_at for the whole BU.
CREATE TABLE gripcasting.builds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id    uuid NOT NULL REFERENCES gripcasting.harvests(id) ON DELETE CASCADE,
  bu_code       text NOT NULL,
  submitted_at  timestamptz,
  submitted_by  text,
  updated_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz,
  created_by    text,
  UNIQUE (harvest_id, bu_code)
);

CREATE TABLE gripcasting.build_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id    uuid NOT NULL REFERENCES gripcasting.builds(id) ON DELETE CASCADE,
  gl          text NOT NULL,
  status      text NOT NULL CHECK (status IN ('notstarted', 'inprogress', 'fixed', 'closed')),
  reason      text NOT NULL DEFAULT '',
  is_custom   boolean NOT NULL DEFAULT false,      -- GL line added by the BU, not in its budget
  edited_at   timestamptz,                         -- last change to this line's content (shown as "last edited")
  edited_by   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  created_by  text,
  UNIQUE (build_id, gl)
);

CREATE TABLE gripcasting.build_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id      uuid NOT NULL REFERENCES gripcasting.build_lines(id) ON DELETE CASCADE,
  client_id    text NOT NULL,                      -- id the browser uses while editing
  sort         smallint NOT NULL,
  description  text NOT NULL DEFAULT '',
  po           text NOT NULL DEFAULT '',
  driver       text CHECK (driver IN ('wet', 'dry', 'bud', 'trim', 'prepack', 'plants')),
  share        numeric(9,6),                       -- driven items: share of the volume
  per_hour     numeric(12,4),                      -- driven items: volume handled per labor hour
  qty          numeric(14,4),
  unit         text NOT NULL DEFAULT '',
  unit_cost    numeric(12,4),
  start_on     date,
  end_on       date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz,
  created_by   text
);
CREATE INDEX build_items_line ON gripcasting.build_items (line_id);

-- Forecast submissions: directors submit their BU, finance submits the final. Immutable once made.
-- snapshot = drivers + every BU build as they stood (a frozen document, hence jsonb).
CREATE TABLE gripcasting.submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id    uuid NOT NULL REFERENCES gripcasting.harvests(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('bu', 'final')),
  bu_code       text,
  close_date    date,
  budget        numeric(12,2) NOT NULL,
  actual        numeric(12,2) NOT NULL,
  remaining     numeric(12,2) NOT NULL,
  landing       numeric(12,2) NOT NULL,
  variance      numeric(12,2) NOT NULL,
  revenue       numeric(12,2),
  ebitda        numeric(12,2),
  bu_subs       jsonb,                             -- final: BU code -> submission id included
  snapshot      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz,
  created_by    text NOT NULL,                     -- who submitted (edge identity)
  CHECK ((kind = 'bu') = (bu_code IS NOT NULL))
);
CREATE INDEX submissions_harvest ON gripcasting.submissions (harvest_id, created_at DESC);

-- Access boundary (no RLS in the Worker -> Hyperdrive model): the Hyperdrive role gets this schema only.
-- IT: replace <app_role> with the role Hyperdrive connects as, then uncomment.
-- GRANT USAGE ON SCHEMA gripcasting TO <app_role>;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA gripcasting TO <app_role>;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA gripcasting GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO <app_role>;
