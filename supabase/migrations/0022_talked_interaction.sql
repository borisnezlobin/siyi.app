-- "Talked" as a real kind of interaction.
--
-- It was the most common thing that happens and the only way to record it was
-- "other" with the word typed in by hand. Updates have defaulted to the label
-- "Talked" since 0005, so rows carrying it already exist and have been reading
-- back as "other" ever since.
--
-- Postgres will not let a new enum value be used in the transaction that adds
-- it, so this migration adds the value and nothing else.

alter type public.interaction_type add value if not exists 'talked';
