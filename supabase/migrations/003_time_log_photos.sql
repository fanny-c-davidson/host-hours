-- ============================================================
-- 003: Time Log Photos — storage bucket + metadata table
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. Create the storage bucket for receipts/photos
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- 2. Storage policies — users can manage files in their own folder
create policy "Users can upload receipts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view own receipts"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own receipts"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Metadata table linking photos to time logs
create table if not exists public.time_log_photos (
  id          uuid primary key default gen_random_uuid(),
  time_log_id uuid not null references public.time_logs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  content_type text,
  file_size    int,
  created_at   timestamptz not null default now()
);

alter table public.time_log_photos enable row level security;

create policy "Users can insert own photos"
  on public.time_log_photos for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can view own photos"
  on public.time_log_photos for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own photos"
  on public.time_log_photos for delete
  to authenticated
  using (user_id = auth.uid());
