-- Lets "Other" carry the user's own words instead of being a dead end.
-- Additive only: existing rows keep null and read exactly as they do today.

alter table public.interactions
add column if not exists custom_label text;

alter table public.interactions
add column if not exists custom_icon text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'interactions_custom_label_length'
  ) then
    alter table public.interactions
    add constraint interactions_custom_label_length
    check (
      custom_label is null or
      char_length(trim(custom_label)) between 1 and 40
    );
  end if;

  -- Stores an icon name from the app's fixed set, not arbitrary text.
  if not exists (
    select 1 from pg_constraint where conname = 'interactions_custom_icon_length'
  ) then
    alter table public.interactions
    add constraint interactions_custom_icon_length
    check (custom_icon is null or char_length(custom_icon) between 1 and 32);
  end if;
end
$$;

create index if not exists interactions_custom_label_idx
on public.interactions(user_id, custom_label)
where custom_label is not null;
