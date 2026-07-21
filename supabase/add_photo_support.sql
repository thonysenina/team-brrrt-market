-- ============================================================
-- PHOTO SUPPORT MIGRATION
-- Run this in Supabase SQL Editor AFTER the original schema.sql
-- ============================================================

-- 1. Add photo_url column to fm_items
alter table fm_items add column if not exists photo_url text;

-- 2. Create storage bucket for item photos
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

-- 3. Storage policy — allow all operations via anon key
create policy "allow_all_item_photos"
on storage.objects for all
using (bucket_id = 'item-photos')
with check (bucket_id = 'item-photos');
