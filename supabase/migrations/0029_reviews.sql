-- Testimonials for the public /reviews page.
--
-- Every row is written by a signed-in account, which is what makes the page
-- honest: the FTC's Consumer Reviews Rule turns on whether a review is what it
-- claims to be, and a table that anyone could POST into anonymously could not
-- support the claim that these come from real users.
--
-- Two things this schema deliberately does not have: a way to store a review
-- that was not written by the account it is attributed to, and a moderation
-- state that means "hidden because it was negative". `status` moves a review
-- from pending to published or rejected, and rejection is for spam, abuse and
-- things that identify a third party — never for a low rating. The check
-- constraint cannot enforce that; the review queue is where it has to hold.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(trim(body)) between 20 and 1200),
  -- What the reader sees. A first name and a class year, not the account's
  -- real display name, so writing a review never publishes more than intended.
  author_label text not null check (char_length(trim(author_label)) between 1 and 60),
  status text not null default 'pending'
    check (status in ('pending', 'published', 'rejected')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One review per account. Someone who wants to change theirs edits it, which
-- keeps the page from filling with the same person five times.
create unique index if not exists reviews_one_per_user_idx
  on public.reviews(user_id);

create index if not exists reviews_published_idx
  on public.reviews(status, published_at desc);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

-- Anyone, signed in or not, reads published reviews: this is a public page.
drop policy if exists "Published reviews are public" on public.reviews;
create policy "Published reviews are public"
on public.reviews for select
using (status = 'published');

drop policy if exists "Reviews are visible to their author" on public.reviews;
create policy "Reviews are visible to their author"
on public.reviews for select
using (auth.uid() = user_id);

drop policy if exists "Reviews can be written by their author" on public.reviews;
create policy "Reviews can be written by their author"
on public.reviews for insert
with check (auth.uid() = user_id and status = 'pending');

-- An author may rewrite their own review, but may not publish it. Moving a row
-- to 'published' is a service-role action taken in the review queue.
drop policy if exists "Reviews can be edited by their author" on public.reviews;
create policy "Reviews can be edited by their author"
on public.reviews for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Reviews can be withdrawn by their author" on public.reviews;
create policy "Reviews can be withdrawn by their author"
on public.reviews for delete
using (auth.uid() = user_id);
