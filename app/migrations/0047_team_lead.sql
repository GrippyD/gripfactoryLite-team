-- 0047: THE SUPERVISOR AND THE TEAM LEAD (canon 0.30.67). Owner ruling 2026-09-14,
-- verbatim: "Minted HBNs are passing the Team Lead definition from the cloudflare
-- login email to the wet weight screen.  Let's make all "Supervisors" the email,
-- the team lead should be hand entered". The login is the Supervisor (created_by,
-- already on every row); the Team Lead is a name typed by hand at Start lot and
-- fixable with a reason. lead_person_id (0008) stays for the lots that used the
-- retired picker; new lots leave it NULL.
ALTER TABLE wet_weight_entries ADD COLUMN team_lead TEXT;
