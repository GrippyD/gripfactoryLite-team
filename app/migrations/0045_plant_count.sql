-- 0045: THE PLANT COUNT (canon 0.30.62). Owner ruling 2026-09-14, verbatim:
-- "When you click "finish lot" in wet weights, prompt for the number of plants.
-- Leave an option on the prompt to click "skip". If the user skips, you're
-- prompted again when you load a silo or a dry room in the load silo page. The
-- total divided by the number of plants with each record weight randomized but
-- totalling the correct total is what we need for the CSV that goes into METRC."
-- The count lives on the lot (NULL = not given yet); the Finish lot prompt, the
-- Load Silo prompt and the reasoned pencil write it; the METRC wet weights CSV
-- splits the lot's total across it (Plant blank) when no plant tags are pasted.
ALTER TABLE wet_weight_entries ADD COLUMN plant_count INTEGER;
