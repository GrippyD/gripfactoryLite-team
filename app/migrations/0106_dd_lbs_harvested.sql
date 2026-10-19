-- DD S3a: Lbs Harvested. The key stays bizops.lbs_processed.
-- The tile is wet pounds harvested, the console yearWet law, not the
-- trim, cryo and prepack buckets. Guarded on the old title and the old
-- ruling so a second apply changes nothing.

UPDATE dd_kpis
SET title_en = 'Lbs Harvested',
    title_es = 'Libras cosechadas',
    dims = 'farm',
    compute_key = 'wet_weights of own lots of the harvest year (the console yearWet law, src/console.ts yearWet) summed by the tote''s farm day; grams over 448; HTD is the harvest year''s sum',
    def_version = 2,
    open_question_en = NULL,
    open_question_es = NULL,
    config_key = NULL,
    updated_at = '2026-10-19T00:00:00.000Z'
WHERE kpi_key = 'bizops.lbs_processed'
  AND title_en = 'Lbs processed';

UPDATE dd_kpi_questions
SET status = 'ruled',
    ruling = 'wet_harvested',
    ruled_at = '2026-10-19T00:00:00.000Z',
    reason = 'owner 2026-10-19: Lbs processed means wet lbs harvested',
    updated_at = '2026-10-19T00:00:00.000Z'
WHERE question_key = 'processed_lbs'
  AND ruling = 'trim,cryo,prepack';
