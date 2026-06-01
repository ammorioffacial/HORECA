const express = require('express');
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers — Manager only
// Supports: ?search=name&type=restaurant&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', verifyToken, requireRole('manager'), async (req, res) => {
  const { search, type, from, to } = req.query;

  let conditions = [];
  let params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(c.name ILIKE $${idx} OR c.phone ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (type) {
    conditions.push(`c.type = $${idx}`);
    params.push(type);
    idx++;
  }
  if (from) {
    conditions.push(`MAX(i.date) >= $${idx}`);
    params.push(from);
    idx++;
  }
  if (to) {
    conditions.push(`MAX(i.date) <= $${idx}`);
    params.push(to + ' 23:59:59');
    idx++;
  }

  // Date filters apply to the HAVING clause (on aggregates)
  const havingFilters = [];
  const whereFilters = [];
  conditions.forEach(c => {
    if (c.includes('MAX(')) havingFilters.push(c);
    else whereFilters.push(c);
  });

  const whereClause  = whereFilters.length  ? `WHERE ${whereFilters.join(' AND ')}`  : '';
  const havingClause = havingFilters.length ? `HAVING ${havingFilters.join(' AND ')}` : '';

  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.address,
        c.type,
        c.created_at,
        MAX(i.date)                                          AS last_transaction,
        COALESCE(SUM(i.total_amount), 0)                    AS total_spent,
        COUNT(DISTINCT DATE(i.date AT TIME ZONE 'UTC'))     AS visit_count,
        COUNT(i.id)                                          AS invoice_count
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id
      ${whereClause}
      GROUP BY c.id, c.name, c.phone, c.address, c.type, c.created_at
      ${havingClause}
      ORDER BY last_transaction DESC NULLS LAST
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Customers list error:', err);
    res.status(500).json({ error: 'فشل في تحميل قائمة العملاء' });
  }
});

// GET /api/customers/:id — Manager only
router.get('/:id', verifyToken, requireRole('manager'), async (req, res) => {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ error: 'معرف العميل غير صالح' });

  try {
    // Customer summary
    const customerResult = await pool.query(`
      SELECT
        c.id, c.name, c.phone, c.address, c.type, c.created_at,
        MAX(i.date)                                          AS last_transaction,
        COALESCE(SUM(i.total_amount), 0)                    AS total_spent,
        COUNT(DISTINCT DATE(i.date AT TIME ZONE 'UTC'))     AS visit_count,
        COUNT(i.id)                                          AS invoice_count
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.phone, c.address, c.type, c.created_at
    `, [id]);

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }

    // Full invoice history
    const invoicesResult = await pool.query(`
      SELECT id, items_json, total_amount, date, invoice_image_url
      FROM invoices
      WHERE customer_id = $1
      ORDER BY date DESC
    `, [id]);

    res.json({
      customer: customerResult.rows[0],
      invoices: invoicesResult.rows
    });
  } catch (err) {
    console.error('Customer detail error:', err);
    res.status(500).json({ error: 'فشل في تحميل بيانات العميل' });
  }
});

module.exports = router;
