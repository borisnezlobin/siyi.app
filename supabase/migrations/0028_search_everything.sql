-- Search everything the user has written, not just names.
--
-- Until now "search" meant `person-search.ts`: a typeahead that ranks people by
-- how their name matches, over the rows the client already had. It cannot find
-- the person whose name you have forgotten and whose note says "met at the
-- climbing gym", which is the search a person actually needs from a CRM about
-- people they met once.
--
-- The free text lives in six tables. This adds one GIN index per table and one
-- function that queries all six and returns a single ranked list.
--
-- `security invoker` is what makes this safe: the function runs as the caller,
-- so every row-level policy already on these tables applies unchanged and no
-- new access path is opened. The explicit `user_id = auth.uid()` filters below
-- are redundant with those policies on purpose — a search function is the last
-- place to rely on a single layer, and they let the planner cut the row set
-- before ranking rather than after.
--
-- Additive and safe to re-run. It creates indexes and one function, and alters
-- no existing table, column or policy.
--
-- Deliberately NOT indexed: `people.relationship_label` (0008) and
-- `interactions.custom_label` (0009). Both migrations are written but not yet
-- applied to production, and an index expression naming a column that does not
-- exist fails the whole migration. Fold them in once 0008 and 0009 have run.

-- A DDL request that cannot get its lock waits in the queue, and everything
-- behind it waits too. Ten seconds and an error beats a dashboard tab that
-- says "running" while the table it wants is quietly blocked.
set lock_timeout = '10s';

-- 'english' rather than the 'simple' of `people_user_search_idx` in 0001.
-- Simple does no stemming, so a note reading "she is moving to Boston" is not
-- found by "move". Names do not stem, which is why simple was the right choice
-- for a name index and the wrong one here.
--
-- Every expression below is repeated verbatim in `search_everything`. They have
-- to match exactly or the planner ignores the index and sequentially scans.

create index if not exists people_fulltext_idx on public.people using gin (
  to_tsvector(
    'english',
    coalesce(full_name, '') || ' ' ||
    coalesce(preferred_name, '') || ' ' ||
    coalesce(general_notes, '') || ' ' ||
    coalesce(major, '') || ' ' ||
    coalesce(dorm_or_residence, '') || ' ' ||
    coalesce(hometown, '') || ' ' ||
    coalesce(first_met_location, '') || ' ' ||
    coalesce(instagram_username, '') || ' ' ||
    coalesce(email, '')
  )
);

create index if not exists person_updates_fulltext_idx on public.person_updates using gin (
  to_tsvector(
    'english',
    -- Quoted because `text` is also a type name, and an unquoted one here reads
    -- as a column only by the parser's good grace. The column is what is meant.
    coalesce("text", '') || ' ' || coalesce(interaction_label, '')
  )
);

create index if not exists person_notes_fulltext_idx on public.person_notes using gin (
  to_tsvector('english', coalesce(heading, '') || ' ' || coalesce(body, ''))
);

create index if not exists interactions_fulltext_idx on public.interactions using gin (
  to_tsvector('english', coalesce(note, ''))
);

create index if not exists person_classes_fulltext_idx on public.person_classes using gin (
  to_tsvector(
    'english',
    coalesce(course_code, '') || ' ' ||
    coalesce(course_title, '') || ' ' ||
    coalesce(professor, '') || ' ' ||
    coalesce(term, '') || ' ' ||
    coalesce(location, '')
  )
);

create index if not exists reminders_fulltext_idx on public.reminders using gin (
  to_tsvector('english', coalesce("text", ''))
);

-- One row per matching record, across all six kinds.
--
-- `person_ids` is an array because the thing a result is about is not always
-- one person: an update and a reminder each reach their people through a join
-- table, and both can name several. A person result is about itself, so it
-- carries its own id — that way a caller can group every kind by person
-- without a special case.
--
-- `websearch_to_tsquery` rather than `plainto_tsquery` so that quoted phrases
-- and `-excluded` words work the way anyone who has used a search box expects.
-- It also cannot raise on malformed input, which `to_tsquery` can — this takes
-- a raw string typed by a user, so that matters more than the extra operators.
create or replace function public.search_everything(
  search_query text,
  result_limit integer default 40
)
returns table (
  kind text,
  record_id uuid,
  person_ids uuid[],
  title text,
  snippet text,
  occurred_at timestamptz,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      websearch_to_tsquery('english', coalesce(search_query, '')) as tsq,
      -- A blank box is not a search for everything, it is not a search at all.
      -- websearch_to_tsquery('') yields an empty tsquery that matches nothing,
      -- but being explicit keeps six index scans from being planned for it.
      length(trim(coalesce(search_query, ''))) > 0 as asked
  )
  select * from (
    select
      'person'::text as kind,
      p.id as record_id,
      array[p.id] as person_ids,
      p.full_name as title,
      p.general_notes as snippet,
      p.first_met_at as occurred_at,
      ts_rank(
        to_tsvector(
          'english',
          coalesce(p.full_name, '') || ' ' ||
          coalesce(p.preferred_name, '') || ' ' ||
          coalesce(p.general_notes, '') || ' ' ||
          coalesce(p.major, '') || ' ' ||
          coalesce(p.dorm_or_residence, '') || ' ' ||
          coalesce(p.hometown, '') || ' ' ||
          coalesce(p.first_met_location, '') || ' ' ||
          coalesce(p.instagram_username, '') || ' ' ||
          coalesce(p.email, '')
        ),
        q.tsq
      ) as rank
    from public.people p, q
    where q.asked
      and p.user_id = auth.uid()
      and to_tsvector(
        'english',
        coalesce(p.full_name, '') || ' ' ||
        coalesce(p.preferred_name, '') || ' ' ||
        coalesce(p.general_notes, '') || ' ' ||
        coalesce(p.major, '') || ' ' ||
        coalesce(p.dorm_or_residence, '') || ' ' ||
        coalesce(p.hometown, '') || ' ' ||
        coalesce(p.first_met_location, '') || ' ' ||
        coalesce(p.instagram_username, '') || ' ' ||
        coalesce(p.email, '')
      ) @@ q.tsq

    union all

    select
      'update'::text,
      u.id,
      coalesce(
        (
          select array_agg(pup.person_id)
            from public.person_update_people pup
           where pup.update_id = u.id
        ),
        array[]::uuid[]
      ),
      u.interaction_label,
      u.text,
      u.recorded_at,
      ts_rank(
        to_tsvector(
          'english',
          coalesce(u.text, '') || ' ' || coalesce(u.interaction_label, '')
        ),
        q.tsq
      )
    from public.person_updates u, q
    where q.asked
      and u.user_id = auth.uid()
      and to_tsvector(
        'english',
        coalesce(u.text, '') || ' ' || coalesce(u.interaction_label, '')
      ) @@ q.tsq

    union all

    select
      'note'::text,
      n.id,
      array[n.person_id],
      n.heading,
      n.body,
      n.updated_at,
      ts_rank(
        to_tsvector('english', coalesce(n.heading, '') || ' ' || coalesce(n.body, '')),
        q.tsq
      )
    from public.person_notes n, q
    where q.asked
      and n.user_id = auth.uid()
      and to_tsvector(
        'english',
        coalesce(n.heading, '') || ' ' || coalesce(n.body, '')
      ) @@ q.tsq

    union all

    -- `create_person_update` copies an update's text into the interaction it
    -- writes (0005), so an update and its interaction both match the same
    -- words. The interaction is filtered out here rather than deduplicated by
    -- the caller: the update is the record the user wrote and the one whose
    -- screen they want, and the interaction is its shadow.
    select
      'interaction'::text,
      i.id,
      array[i.person_id],
      null::text,
      i.note,
      i.occurred_at,
      ts_rank(to_tsvector('english', coalesce(i.note, '')), q.tsq)
    from public.interactions i, q
    where q.asked
      and i.user_id = auth.uid()
      and i.source_update_id is null
      and to_tsvector('english', coalesce(i.note, '')) @@ q.tsq

    union all

    select
      'class'::text,
      c.id,
      array[c.person_id],
      c.course_code,
      concat_ws(' · ', nullif(c.course_title, ''), nullif(c.professor, ''), nullif(c.term, '')),
      c.created_at,
      ts_rank(
        to_tsvector(
          'english',
          coalesce(c.course_code, '') || ' ' ||
          coalesce(c.course_title, '') || ' ' ||
          coalesce(c.professor, '') || ' ' ||
          coalesce(c.term, '') || ' ' ||
          coalesce(c.location, '')
        ),
        q.tsq
      )
    from public.person_classes c, q
    where q.asked
      and c.user_id = auth.uid()
      and to_tsvector(
        'english',
        coalesce(c.course_code, '') || ' ' ||
        coalesce(c.course_title, '') || ' ' ||
        coalesce(c.professor, '') || ' ' ||
        coalesce(c.term, '') || ' ' ||
        coalesce(c.location, '')
      ) @@ q.tsq

    union all

    select
      'reminder'::text,
      r.id,
      coalesce(
        (
          select array_agg(rp.person_id)
            from public.reminder_people rp
           where rp.reminder_id = r.id
        ),
        array[]::uuid[]
      ),
      null::text,
      r.text,
      r.due_at,
      ts_rank(to_tsvector('english', coalesce(r.text, '')), q.tsq)
    from public.reminders r, q
    where q.asked
      and r.user_id = auth.uid()
      and to_tsvector('english', coalesce(r.text, '')) @@ q.tsq
  ) results
  -- Rank first, then the more recent of two equally good matches. Without the
  -- second key the order of equal ranks is whatever the union produced, which
  -- makes the list shuffle between identical searches.
  -- Qualified with the subquery alias because `returns table (...)` puts `rank`
  -- and `occurred_at` in scope as output parameters too, and an unqualified
  -- reference to either is ambiguous between the two.
  order by results.rank desc, results.occurred_at desc nulls last
  limit least(coalesce(result_limit, 40), 200);
$$;

revoke all on function public.search_everything(text, integer) from public;
grant execute on function public.search_everything(text, integer) to authenticated;
