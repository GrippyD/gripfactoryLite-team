-- 0033: Patrick's strain table lands (intake 2026-09-07, vendored verbatim at
-- prompts/2026-09-07_patrick_strain_codes.md; owner fork 4, verbatim: "Don't
-- care, auto-resolve -- make sure these lists are exposed and functional in
-- the admin lookups"). THE RESOLUTION (canon 0.30.1): standing law keeps
-- Gelato 41 at 071 and Blue Andeez at 078 (slice 1.1, sealed); Banana Berry
-- Wine, new in the paste at a colliding 078, takes 096, the next free code;
-- the misspelled seed name Elecetric Grape Diesel is renamed Electric Grape
-- Diesel (codes drive HBNs, names are display); Sherb Cream Cake keeps 069
-- (lists expand, never silently shrink); both Chrome Domes are distinct
-- strains. Existing HBNs are frozen history and never recompute.

UPDATE strains SET name = 'Electric Grape Diesel', updated_at = '2026-09-07T00:00:00.000Z'
 WHERE name = 'Elecetric Grape Diesel' AND deleted_at IS NULL;

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000001', 'R&D', 'RD', '070', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'R&D' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000002', 'Banana Berry Wine', 'BBW', '096', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Banana Berry Wine' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000003', 'Bold Coast Berries', 'BCB', '079', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Bold Coast Berries' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000004', 'Bold Coast Pine OG', 'BCP', '080', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Bold Coast Pine OG' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000005', 'Casa Blanca', 'CB', '081', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Casa Blanca' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000006', 'Chrome Dome', 'CHD', '082', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Chrome Dome' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000007', 'Downeast Diesel', 'DD', '083', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Downeast Diesel' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000008', 'Downeast Widow', 'DW', '084', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Downeast Widow' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000009', 'GG4', 'GG4', '085', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'GG4' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000010', 'Hawaiian Zombie OG', 'HZO', '086', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Hawaiian Zombie OG' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000011', 'Headband', 'HB', '087', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Headband' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000012', 'Island Time', 'IT', '088', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Island Time' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000013', 'Mainely Mango', 'MM', '089', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Mainely Mango' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000014', 'Pine State Funk OG', 'PSF', '090', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Pine State Funk OG' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000015', 'Pinyatti', 'PIN', '091', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Pinyatti' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000016', 'Sour Sally', 'SSA', '092', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Sour Sally' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000017', 'Sour Susie', 'SSU', '093', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Sour Susie' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000018', 'Wild Mango Creamsicle', 'WMC', '094', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Wild Mango Creamsicle' AND deleted_at IS NULL);

INSERT INTO strains (id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'a4000001-0001-4000-8000-000000000019', 'Zuava', 'ZU', '095', '2026-09-07T00:00:00.000Z', NULL, '2026-09-07T00:00:00.000Z', NULL, NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM strains WHERE name = 'Zuava' AND deleted_at IS NULL);
