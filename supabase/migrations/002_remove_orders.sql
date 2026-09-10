-- ============================================================
-- 002 — REMOVE ORDERS SYSTEM
-- Drops the orders / order_items tables (ordering feature removed).
-- Menu, categories, reviews, gallery, settings and profiles are untouched.
-- ============================================================

-- Drop order_items first (it references orders)
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
