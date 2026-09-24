-- 0058: THE CRYO RUN (canon 0.30.110). Owner rulings 2026-09-17, verbatim:
-- "For cryo, replicate the trim line surface in cryo production reporting.
-- Also, in production scheduling for pasteurization collapse the lines to
-- their HBN, do not expose individual containers on the scheduled surface or
-- on the input list in the production reporting node." and, at the forks:
-- "The containers created in trim constitute a total weight by product type.
-- That's what's consumed.  The containers made in trim are archival but no
-- longer relevant to the process once they've been added to true METRC
-- package IDs in cryo" and "They scan a tag that attaches to the weight and
-- that weight is consumed from the sum of weight stored in the HBN.  The HBN
-- continues to be important to the background data for METRC, but we use only
-- the package ID after cryo to identify the material".
--
-- A pasteurization schedule row is the RUN: one production_schedules row per
-- HBN (stage cryo, wip_package_id NULL, wet_weight_entry_id NULL). The trim
-- containers it took in are its inputs, captured at >> with their type and
-- weight; they pool by product type. Each line entered at Cryo Weight Entry is
-- a new container (a wip_packages row with source 'cryo' and cryo_run_id the
-- run) born into the Testing queue. Finish run consumes the inputs (status
-- pasteurized). Postgres-portable, append-only.
CREATE TABLE cryo_run_inputs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  wip_package_id TEXT NOT NULL,
  package_type_code TEXT NOT NULL,
  weight_grams NUMERIC NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX cryo_run_inputs_run ON cryo_run_inputs (run_id);
CREATE INDEX cryo_run_inputs_package ON cryo_run_inputs (wip_package_id);

-- The output containers point at their run; source tells a trim container
-- (NULL or 'trim') from a cryo output ('cryo').
ALTER TABLE wip_packages ADD COLUMN cryo_run_id TEXT;
ALTER TABLE wip_packages ADD COLUMN source TEXT;

-- The rows scheduled per container under canon 0.30.97 fold into one run per
-- HBN and status, their containers becoming the run's inputs; the per-container
-- rows retire with the reason. Ids are deterministic text so the fold is
-- portable and re-runnable by hand if ever needed.
INSERT INTO production_schedules (
  id, stage, wet_weight_entry_id, wip_package_id, harvest_batch_id, status,
  effective_date, scheduled_at, scheduled_by, completed_at, completed_by,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
)
SELECT 'run-' || ps.harvest_batch_id || '-' || ps.status, 'cryo', NULL, NULL, ps.harvest_batch_id, ps.status,
       MIN(ps.effective_date), MIN(ps.scheduled_at), MIN(ps.scheduled_by), MAX(ps.completed_at), MAX(ps.completed_by),
       MIN(ps.created_at), MIN(ps.created_by), MAX(ps.updated_at), MAX(ps.updated_by), NULL, NULL, NULL
FROM production_schedules ps
WHERE ps.stage = 'cryo' AND ps.wip_package_id IS NOT NULL AND ps.deleted_at IS NULL
GROUP BY ps.harvest_batch_id, ps.status;

INSERT INTO cryo_run_inputs (id, run_id, wip_package_id, package_type_code, weight_grams, created_at)
SELECT 'in-' || ps.id, 'run-' || ps.harvest_batch_id || '-' || ps.status, ps.wip_package_id,
       p.package_type_code, p.weight_grams, ps.created_at
FROM production_schedules ps
JOIN wip_packages p ON p.id = ps.wip_package_id
WHERE ps.stage = 'cryo' AND ps.wip_package_id IS NOT NULL AND ps.deleted_at IS NULL;

UPDATE production_schedules
SET deleted_at = '2026-09-17T00:00:00.000Z', deleted_by = NULL,
    delete_reason = 'folded into the HBN run (canon 0.30.110)',
    updated_at = '2026-09-17T00:00:00.000Z'
WHERE stage = 'cryo' AND wip_package_id IS NOT NULL AND deleted_at IS NULL;
