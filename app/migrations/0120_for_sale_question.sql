-- RG1: the for sale tile loses its answered question.
-- Guarded: the update runs only while the English question is still the
-- 0105 seed text. A second apply changes nothing. updated_at is stamped.

UPDATE dd_kpis
SET open_question_en = NULL,
    open_question_es = NULL,
    updated_at = '2026-10-24T00:00:00.000Z'
WHERE kpi_key = 'farmops.assets_for_sale_count'
  AND open_question_en = 'The asset register of record (the app table or the accounting register) and which fields the app holds';
