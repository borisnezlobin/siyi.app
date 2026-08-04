update storage.buckets
set public = false
where id = 'avatars';

update public.people
set profile_photo_url = regexp_replace(
  profile_photo_url,
  '^https?://[^/]+/storage/v1/object/public/avatars/',
  ''
)
where profile_photo_url ~ '^https?://[^/]+/storage/v1/object/public/avatars/';

update public.user_profiles
set avatar_url = regexp_replace(
  avatar_url,
  '^https?://[^/]+/storage/v1/object/public/avatars/',
  ''
)
where avatar_url ~ '^https?://[^/]+/storage/v1/object/public/avatars/';

drop policy if exists "Avatar images are publicly readable"
on storage.objects;

create policy "Users can read avatars in their folder"
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars' and
  (storage.foldername(name))[1] = auth.uid()::text
);
