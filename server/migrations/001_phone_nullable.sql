-- Migration 001 — Make customers.phone optional
-- Run once in Supabase SQL Editor → SQL Editor → New query
-- ============================================================

-- 1. Drop the NOT NULL constraint so phone can be NULL for walk-in customers
ALTER TABLE customers
  ALTER COLUMN phone DROP NOT NULL;

-- 2. The UNIQUE index already allows multiple NULLs in PostgreSQL (each NULL
--    is considered distinct), so no change is needed there.

-- 3. Verify the result — should show is_nullable = 'YES' for phone
SELECT column_name, data_type, is_nullable, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'customers' AND column_name = 'phone';
