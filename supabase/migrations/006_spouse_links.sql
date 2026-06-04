-- Spouse account linking for combined IRS material participation hours
create table spouse_links (
  id             uuid primary key default gen_random_uuid(),
  requester_id   uuid not null references auth.users(id) on delete cascade,
  partner_email  text not null,
  partner_id     uuid references auth.users(id) on delete cascade,
  status         text not null default 'pending' check (status in ('pending', 'active')),
  created_at     timestamptz not null default now(),
  unique(requester_id)
);

alter table spouse_links enable row level security;

-- Both sides can view the link
create policy "Users can view own spouse links"
  on spouse_links for select using (
    auth.uid() = requester_id or auth.uid() = partner_id
  );

-- Requester can view pending links sent to their email
create policy "Users can view pending invites to them"
  on spouse_links for select using (
    status = 'pending'
    and partner_email = (select email from public.profiles where id = auth.uid())
  );

-- Any authenticated user can create a link
create policy "Users can create spouse links"
  on spouse_links for insert with check (auth.uid() = requester_id);

-- Partner can accept (update status + set partner_id)
create policy "Partner can accept invite"
  on spouse_links for update using (
    partner_email = (select email from public.profiles where id = auth.uid())
  );

-- Either side can delete (unlink)
create policy "Either side can unlink"
  on spouse_links for delete using (
    auth.uid() = requester_id or auth.uid() = partner_id
  );
