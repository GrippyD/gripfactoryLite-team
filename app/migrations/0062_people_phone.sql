-- THE PHONE LOGIN (canon 0.30.127). Owner, 2026-09-18, verbatim: "I'd like to
-- make the cloudflare login keyed to a cell phone number instead of an email
-- address" and "Start on an external IdP plus a small people-mapping slice
-- while I deploy the last change."
--
-- Cloudflare Access hands the app one identity string
-- (Cf-Access-Authenticated-User-Email). A phone login arrives through an
-- external identity provider (Auth0 passwordless SMS) as a synthetic address,
-- <digits>@<phone login domain>, and the app maps it onto a person by the phone
-- on the People row. The phone is the mapping: a phone with no person is
-- refused in words; nothing auto-creates on a phone (the email law keeps its
-- first-login row). The domain is a value in data (canon L-4), editable in
-- Admin, Lookups, app_config. INSERT OR IGNORE: a row already set by hand stands.

ALTER TABLE people ADD COLUMN phone TEXT;

CREATE UNIQUE INDEX idx_people_phone ON people(phone) WHERE phone IS NOT NULL;

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('phone_login_domain', 'phone.gripcannabis.com', '2026-09-18T00:00:00.000Z', NULL, '2026-09-18T00:00:00.000Z', NULL, NULL, NULL);
