-- ================================================================
-- Horeca Spot — Data Integrity Check & Recovery Script
-- Run each section in Supabase SQL Editor (Dashboard → SQL Editor)
-- ================================================================

-- ── SECTION 1: Check for duplicate phone numbers ───────────────
-- If any phone appears more than once, those rows are duplicates.
SELECT phone, COUNT(*) AS occurrences, array_agg(id) AS customer_ids
FROM customers
GROUP BY phone
HAVING COUNT(*) > 1
ORDER BY occurrences DESC;

-- ── SECTION 2: Verify every invoice links to a real customer ───
-- Should return zero rows. Any row here is an orphaned invoice.
SELECT i.id AS invoice_id, i.customer_id, i.total_amount, i.date
FROM invoices i
LEFT JOIN customers c ON c.id = i.customer_id
WHERE c.id IS NULL;

-- ── SECTION 3: Customer activity summary ──────────────────────
-- Sanity-check: each customer's invoice count and total spend.
SELECT
  c.id,
  c.name,
  c.phone,
  COUNT(i.id)                      AS invoice_count,
  COALESCE(SUM(i.total_amount), 0) AS total_spent,
  MAX(i.date)                      AS last_invoice_date
FROM customers c
LEFT JOIN invoices i ON i.customer_id = c.id
GROUP BY c.id, c.name, c.phone
ORDER BY total_spent DESC;

-- ── SECTION 4: List all invoices with customer names ──────────
-- Useful for manually spotting mismatch (wrong name on invoice).
SELECT
  i.id         AS invoice_id,
  c.id         AS customer_id,
  c.name       AS customer_name,
  c.phone,
  i.total_amount,
  i.date,
  i.items_json
FROM invoices i
JOIN customers c ON c.id = i.customer_id
ORDER BY i.date DESC;

-- ── SECTION 5: Find customers with no invoices ────────────────
-- These may be ghost records created by the old buggy UPSERT.
SELECT id, name, phone, type, created_at
FROM customers
WHERE id NOT IN (SELECT DISTINCT customer_id FROM invoices)
ORDER BY created_at DESC;

-- ── SECTION 6 (RECOVERY): Delete ghost customers with no invoices
-- DANGER — only run this after manually reviewing Section 5 output.
-- Uncomment to execute:
/*
DELETE FROM customers
WHERE id NOT IN (SELECT DISTINCT customer_id FROM invoices);
*/

-- ── SECTION 7 (RECOVERY): If a customer's name was overwritten
-- Replace 12 with the actual customer id, and set the correct name.
-- Example:
/*
UPDATE customers
SET name    = 'الاسم الصحيح',
    address = 'العنوان الصحيح',
    type    = 'restaurant'
WHERE id = 12;
*/

-- ── SECTION 8: Confirm schema constraints are in place ────────
-- Verifies the UNIQUE constraint on phone still exists.
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'customers'
  AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_type;
