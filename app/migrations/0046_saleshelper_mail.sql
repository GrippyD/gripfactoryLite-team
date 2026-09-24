-- 0046: THE SEND EMAIL (canon 0.30.65; SalesHelper canon 4b, v0.8.0). Owner report
-- 2026-09-14, verbatim: "The email that sends the csv doesn't automatically mount
-- the csv file to the email.  You have to download it and add it manually." His
-- pick: Resend, his own account. The Worker answers the SalesHelper form's
-- POST /api/send and mails logistics with the Zoho CSV and the order JSON
-- attached. Values in data (canon L-4): the recipient (commas separate several)
-- and the verified sender; the API key is the Worker secret RESEND_API_KEY.
-- Editable in Admin, Lookups, app_config. The sender ships blank on purpose:
-- until the owner verifies a gripcannabis.com sender in Resend and fills it,
-- /api/send answers 503 and the form keeps its email-client fallback.
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('saleshelper_mail_to', 'logistics@gripcannabis.com', '2026-09-14T00:00:00.000Z', NULL, '2026-09-14T00:00:00.000Z', NULL, NULL, NULL),
  ('saleshelper_mail_from', '', '2026-09-14T00:00:00.000Z', NULL, '2026-09-14T00:00:00.000Z', NULL, NULL, NULL);
