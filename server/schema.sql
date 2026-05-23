-- ============================================================
-- Horeca Spot — Database Schema
-- Run this once in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Users table (employees and managers)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'manager')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table (one record per unique phone number)
-- phone is NULLABLE — customers without a phone are allowed.
-- PostgreSQL treats each NULL as distinct, so UNIQUE still works correctly
-- when multiple phone-less customers exist.
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20) UNIQUE,          -- nullable: NULL allowed, NULLs are not compared equal in UNIQUE
  address TEXT,
  type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table (many invoices per customer)
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  items_json JSONB NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
