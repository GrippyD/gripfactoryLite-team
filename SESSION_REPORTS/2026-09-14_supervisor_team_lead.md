# 2026-09-14 THE SUPERVISOR AND THE TEAM LEAD (canon 0.30.67)

Scribe-direct under G-2. Owner ruling 2026-09-14, arriving with the 0.30.66 version id, verbatim:

> "Minted HBNs are passing the Team Lead definition from the cloudflare login email to the wet weight screen.  Let's make all "Supervisors" the email, the team lead should be hand entered"

## What was happening

Since the 2026-08-31 identity ruling the wet weight header carried a **Lead** picker (`lead_person_id`) **preselected to the login person**, and the unload station's session line read **TL: <login>**. Both took the Cloudflare login for the crew lead. The login is the person at the screen, the Supervisor; the Team Lead is someone else, named by hand.

## The law

- **Supervisor = the login email, automatically, everywhere a person in charge shows.** The wet weight header carries a `Supervisor: <email>` line (never a picker); the lot panel and the Load Silo lot card carry a Supervisor row; the unload session line reads `Supervisor: <email>` where it read `TL:`. The value is the actor already recorded as `created_by`; a person row without an email (a Lookups-added name) falls back to its display name.
- **Team Lead = hand entered.** The header's picker becomes a required text box `team_lead` ("Team Lead is required." in words when blank); it stores on the lot (`wet_weight_entries.team_lead`, migration 0047) and is fixable with a reasoned pencil (EDITABLE_FIELDS). The lot panel, the Load Silo card and the unload session line show it. Older lots that used the picker still read their picked person (`COALESCE(team_lead, lead person)`); `lead_person_id` stays for them and is NULL on new lots.

## Files

- `migrations/0047_team_lead.sql`: `ALTER TABLE wet_weight_entries ADD COLUMN team_lead TEXT`.
- `src/pipeline.ts`: `personLabel: "Team Lead"` (the header's typed field); `EDITABLE_FIELDS.wet_weight_entries` gains `team_lead` (text).
- `src/html.ts`: `stationForm` renders the Supervisor line (`data-supervisor`, the login email, else the display name) and the `team_lead` input (required, hover help `TEAM_LEAD_HELP`); `wetLotPanel` shows Supervisor and Team Lead rows; `unloadLotPanel` takes `lot.lead_name` and prints `Supervisor: <actor>` plus `Team Lead: <name>`; `personSelect` kept, unused.
- `src/actions.ts` `createWetWeight`: `team_lead` required by hand, stored; `lead_person_id` written NULL.
- `src/db.ts`: `PersonRow.email` (listPeople selects it); `LotRow` and `BarnWetLotRow` carry `supervisor_name` (`COALESCE(c.email, c.display_name)` over `created_by`) and `lead_name` = `COALESCE(w.team_lead, p.display_name)` with the people join on `lead_person_id` alone (the creator no longer stands in for the lead).
- `src/drying.ts`: the Load Silo lot card shows Supervisor and Team Lead.
- `src/i18n.ts`: Supervisor, Team Lead (es Líder de equipo), the help sentence.
- Tests: identity (the header shows the login as Supervisor, no picker, the typed box; `team_lead` editable and no supervisor field), surface (personLabel Team Lead; the header render; the lot panel rows), gate (the unload session line), drying fixtures. Suite 25 files, **585 tests**.
- Smoke (pin **47**): the picked header names the login email as Supervisor and carries the `team_lead` box with no `lead_person_id`; a Start lot without a Team Lead answers 400 "Team Lead is required."; every Start lot posts `team_lead: "Smoke Lead"`; the lot page shows `Team Lead Smoke Lead` and `Supervisor smoke@gripcannabis.com`; the silo unload's session line names the Supervisor email and the lot's Team Lead, no `TL:`.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 25 files, 585 tests passed.
- From-zero smoke: "About to apply 47 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.
- Visual pass (static Grip render): the header (Supervisor line under the HBN, the Team Lead box first) and the lot panel (Supervisor and Team Lead rows between Material and Notes) reviewed.

## Deploy (his hands, with a migration)

From `app/`: probe, `npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote` (applies 0047), `npm run deploy:grip`.

## Sealed final check

```
src/pipeline.ts                         44110  ef3788f54907b24a
src/html.ts                            162707  8d4f47c5c6d006c6
src/actions.ts                         224437  60bb0ec8b4f23f96
src/db.ts                              113059  a4b2d24c0f730499
src/drying.ts                           15754  e300b9325da4a5cd
src/i18n.ts                            103743  52ee5d03db914073
migrations/0047_team_lead.sql             595  27a0d121178ff451
scripts/smoke.mjs                      327408  fab0e6ebefe682c1
test/surface.test.ts                    80088  de86ebff7fe77e28
test/identity.test.ts                    5120  eb2627236889d062
test/gate.test.ts                       27829  747d47621e2900a1
test/drying.test.ts                     11609  daa04ce065901706
tsc: 0 errors; vitest: 25 files, 585 tests passed
smoke: About to apply 47 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
