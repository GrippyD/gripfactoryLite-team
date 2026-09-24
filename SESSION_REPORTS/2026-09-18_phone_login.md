# 2026-09-18 The Phone Login (canon 0.30.127)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.123 (worker d469fd3d, migrations 0001-0060) with THE MANIFEST BUILDER (0.30.125, migration 0061) deploying at his hands. Owner rulings 2026-09-18, verbatim:

"One more thing: let's have a security discussion.  I have varying degrees of email access on the team and the users are regularly needing my management team to sign in for them.  I'd like to make the cloudflare login keyed to a cell phone number instead of an email address.  I'd like to extend the code request window longer as well, maybe a week."

and, after the security facts (canon 0.30.124):

"Start on an external IdP plus a small people-mapping slice while I deploy the last change.  When you're complete, I'll need either a code block to help me pilot or at minimum a list of instructions on how to do it.  I'll work on the cloudflare dashboard change after I give you the updated hash"

Migration 0062 (people.phone with a unique index; app_config phone_login_domain seeded phone.gripcannabis.com). From-zero pin becomes 62; next free migration 0063. Nothing outside the app is built here; the runbook below is his hands on Auth0, Twilio and the Zero Trust dashboard.

## The law, as built (the people-mapping slice)

1. ONE IDENTITY STRING STILL. Cloudflare Access hands the app Cf-Access-Authenticated-User-Email as before. A phone login arrives from the external identity provider as a synthetic address, <digits>@<phone login domain> (the domain is app_config phone_login_domain, seeded phone.gripcannabis.com, editable in Admin, Lookups, app_config); a bare phone with no @ (Access handing the phone claim itself) reads the same way. An ordinary email is untouched: the first-login row still auto-creates.
2. THE PHONE IS THE MAPPING. The People row carries a phone (+E.164: ten US digits read as +1 plus the digits; a + country code and number stand as typed, digits only). A phone login lands on the active person carrying that phone and acts as that person (the chrome shows the person's email when the row has one, the phone otherwise). A phone no person carries is refused in words, never auto-created: "This phone is not on the People list: +12695550100. Ask an admin to put it on the person in Lookups." A deactivated person's phone is refused as an email would be.
3. THE PHONE IN LOOKUPS. Admin, Lookups, People shows the phone column; Add person takes a Phone (login) box beside Email; the pencil edits it with a reason (a present blank clears it). A phone that is not ten digits or a + number refuses in words ("Phone must be ten digits (US) or a + country code and number."); a number another person carries refuses ("That phone is already on another person."); the unique index backs it.

## What changed

- `migrations/0062_people_phone.sql`: people.phone; idx_people_phone (unique, non-null); app_config phone_login_domain.
- `src/identity.ts`: PHONE_LOGIN_DOMAIN_DEFAULT, normalizePhone, phoneFromIdentity, PHONE_REFUSAL; resolveIdentity maps a phone identity onto the person by phone (refusals in words) before the email law runs.
- `src/config.ts`: CONFIG_KEYS.phone_login_domain.
- `src/pipeline.ts`: EDITABLE_FIELDS.people gains Phone (login).
- `src/actions.ts`: phoneForPerson (normalize, refuse, uniqueness); addPerson writes the phone; editRecord's phone branch.
- `src/db.ts`: the People admin rows carry the phone; personIdByPhone.
- `src/pages.ts`: the People table's phone column, the Phone (login) box, the help words.
- Tests: `test/identity.test.ts` (normalizePhone; phoneFromIdentity on the synthetic address, a bare phone, an email, the wrong domain, a blank domain; the editable field; the refusal words).
- `scripts/smoke.mjs`: pin 62; the phone-login cluster (an unmapped phone refused in words and creating no row; a short phone refused; a person added with (269) 555-0100 storing +12695550100; a second person on the number refused; the mapped phone and the bare phone acting as the person, one row still; a bad edit refused, a reasoned edit moving the number and the log carrying it; the old number refused, the new one mapping; a deactivated person's phone refused; app_config carrying phone_login_domain).

## The runbook (his hands): the external identity provider

The shape: Auth0 (free tenant) runs passwordless SMS through Twilio and hands Cloudflare Access an ID token whose email claim is <digits>@phone.gripcannabis.com; Access treats that as the login identity, its policy admits the domain, and the app maps the digits onto the People row. Managers keep the email one-time PIN; both login methods sit on the same Access login page.

### A. Twilio (the SMS pipe)

1. twilio.com, a pay-as-you-go account. Buy a number with SMS. US carriers require application-to-person registration: a toll-free number verified for messaging is the quickest route (days); a regular long code needs 10DLC brand and campaign registration. Note the Account SID, the Auth Token and the number (or a Messaging Service SID).

### B. Auth0 (the identity provider)

1. auth0.com, a free tenant (US region). The tenant domain reads <tenant>.us.auth0.com.
2. Branding, Phone Provider: turn the Phone Message Provider on, pick Twilio, enter the Account SID, the Auth Token and the From number (or the Messaging Service SID). Save.
3. Authentication, Passwordless, SMS: turn it on. Settings: the message template ("Your Gripfactory code is @@password@@"), OTP Length 6, OTP Expiry as wanted (the default is 180 seconds; this is the code's life, not the login's), and Disable Sign Ups ON, so only a phone he has created may ever receive a code. Save. On the Applications tab of the same screen, enable the application from step 4 once it exists.
4. Applications, Create Application: name "Cloudflare Access", type Regular Web Application. Settings: Allowed Callback URLs = https://<team>.cloudflareaccess.com/cdn-cgi/access/callback (the team name is the Zero Trust team domain). Save. Note the Domain, Client ID and Client Secret. Connections tab: only sms on; Database and Google off.
5. Actions, Library, Create Action, Build from scratch: name "Phone identity for Access", trigger Login / Post Login. Paste the code below, Deploy, then Actions, Triggers, post-login: drag the action into the flow, Apply.
6. User Management, Users, Create User: Connection sms, Phone Number in +E.164 (+12695550100), one per person. The same number goes on the person's People row in the app (step D).

The Action, verbatim:

```javascript
/**
 * Gripfactory: a phone login carries a synthetic email so Cloudflare Access
 * and the app behind it can key the person by phone. The app reads the digits
 * before the @ and maps them onto the People row carrying that phone.
 */
exports.onExecutePostLogin = async (event, api) => {
  const digits = String(event.user.phone_number || "").replace(/\D/g, "");
  if (!digits) return;
  const email = digits + "@phone.gripcannabis.com";
  api.idToken.setCustomClaim("email", email);
  api.idToken.setCustomClaim("email_verified", true);
};
```

If Auth0 refuses the plain email claim name when the action deploys or runs, use a namespaced claim instead: replace the two setCustomClaim lines with `api.idToken.setCustomClaim("https://gripcannabis.com/login_email", email);` and, in step C.1, set the Email claim field to `https://gripcannabis.com/login_email`.

### C. Cloudflare Zero Trust (the door)

1. Settings, Authentication, Login methods, Add new, OpenID Connect. Name "Phone (Auth0)". App ID = the Auth0 Client ID; Client secret = the Auth0 Client Secret; Auth URL = https://<tenant>.us.auth0.com/authorize; Token URL = https://<tenant>.us.auth0.com/oauth/token; Certificate URL = https://<tenant>.us.auth0.com/.well-known/jwks.json; Scopes openid, email, profile; Email claim left as email (or the namespaced name from the fallback). Save, then Test: the test sends a code to the phone and should end on a page naming <digits>@phone.gripcannabis.com.
2. Access, Applications, the gripfactory application, Policies: on the Allow policy add an Include rule, Emails ending in @phone.gripcannabis.com, beside the existing rule for the company email. The policy is the allow list on Cloudflare's side; the People row is the allow list on the app's side.
3. The same application, the login methods setting (Authentication): both One-time PIN and Phone (Auth0) enabled (accept all available identity providers, or pick both). The login page then offers the email code and the phone button.
4. THE WEEK: the application's Session Duration to 1 week (or 1 month), and Settings, Authentication, Global session duration to the same or longer; the global one wins when it lapses. This applies to both login methods.

### D. The app (his hands after the deploy)

1. Deploy this slice with the migration (the three-step block below).
2. Admin, Lookups, People: for each crew member, Edit, Phone (login), the cell number as written, a reason; or Add person with the name and the phone. Ten US digits store as +1 plus the digits.
3. Pilot with his own phone first: the Auth0 user with his cell, the same number on his People row, a private window on the app URL, Phone (Auth0) on the Access page, the code, and the app opens as him. Then one crew phone.

### What can go wrong, in words

- The Access test ends on an error naming the email claim: the action did not run or the claim name differs; check the trigger flow and the Email claim field.
- The app answers "This phone is not on the People list: +1...": the number on the People row differs from the one Auth0 sent; the refusal names the phone the app read.
- A code never arrives: the Twilio number is not yet registered for US application-to-person messaging, or the phone is not created in Auth0 (Disable Sign Ups refuses unknown phones silently at the provider).

## Scribe assumptions (his word owed if wrong)

- A phone no person carries is refused, never auto-created (the People row is the allow list); the email law keeps its first-login row.
- Ten digits read as a US number; other lengths need the + country code.
- The synthetic domain phone.gripcannabis.com (a value in data); Auth0 as the provider (Okta or Entra would wire the same way through generic OIDC).
- The chrome shows the phone when the person has no email.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 35 files, 716 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9035): `About to apply 62 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Dash audit: 0 on every file below.

## Deploy (his hands, with the migration; after the builder's deploy or as one run)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        35 files, 716 tests passed
TZ=America/New_York npx vitest run    35 files, 716 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9035 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 62 migration(s); SMOKE PASS

migrations/0062_people_phone.sql       1257  67f3e74a25e4f1f4
src/identity.ts                        6635  cb0e95d76659aa27
src/config.ts                         51385  9053fe3487d92733
src/pipeline.ts                       49390  d3f12e2f03cecdb3
src/db.ts                            156346  cce7b5dd6cff238f
src/pages.ts                          25159  da8da4976f66374c
src/actions.ts                       264833  5819cb059ce057b8
test/identity.test.ts                  7683  1a38e123cbdf513e
scripts/smoke.mjs                    449788  8d817274f0a77d87
dash audit: 0 on every file above
```
