-- ============================================================
-- REMOVE COMMISSION / SPLIT FEATURE
-- Run in Supabase SQL Editor after previous migrations
-- ============================================================

-- Drop commission columns from merchants
alter table fm_merchants drop column if exists merchant_pct;

-- Drop commission range columns from events
alter table fm_events drop column if exists min_merchant_pct;
alter table fm_events drop column if exists max_merchant_pct;
