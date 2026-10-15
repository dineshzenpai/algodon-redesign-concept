-- Migration: 202610150001_secure_order_intents.sql
-- Description: Enable Row-Level Security on public.order_intents and restrict access to service_role.

-- 1. Enable Row Level Security on public.order_intents.
-- This ensures all rows are protected against direct client-side queries by untrusted roles (anon, authenticated).
-- Note: We avoid FORCE ROW LEVEL SECURITY so that the security-definer function storefront_create_order
-- can reliably insert checkout intents without tripping table-owner RLS violations when no permissive policies exist.
alter table public.order_intents enable row level security;

-- 2. Revoke all direct permissions from untrusted client roles (public, anon, authenticated).
-- Ordinary client sessions cannot read customer PII, order contents, or modify order statuses.
revoke all on table public.order_intents from public, anon, authenticated;

-- 3. Explicitly grant data manipulation privileges to service_role.
-- The backend Express server connects using the service role key to manage orders and checkout.
grant select, insert, update, delete on table public.order_intents to service_role;

-- Verification instructions for local / disposable Supabase test instance:
-- ------------------------------------------------------------------------
-- Run the following as the 'anon' role (simulating browser client with publishable key):
--   SET ROLE anon;
--   SELECT * FROM public.order_intents;
--   --> Expected result: ERROR: permission denied for table order_intents (or empty set if default denied)
--
-- Run the following as the 'authenticated' role (simulating customer login):
--   SET ROLE authenticated;
--   SELECT * FROM public.order_intents;
--   --> Expected result: ERROR: permission denied for table order_intents
--
-- Run the following as the 'service_role' (simulating backend API):
--   SET ROLE service_role;
--   SELECT count(*) FROM public.order_intents;
--   --> Expected result: Returns exact row count successfully.
--   RESET ROLE;
