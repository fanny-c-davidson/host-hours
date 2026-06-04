-- ============================================================
-- 004: Property Tags
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table public.properties
  add column if not exists tags text[] not null default '{}';
