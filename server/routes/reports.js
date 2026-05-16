const express = require('express');
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/reports/sales
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 * Returns: daily totals + per-invoice rows for the period
 */
router.get('/sales', verifyToken, requireRole('manager'), async (req, res) => {
  const { from, to } = req.query;

  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (from) { conditions.push(`i.date >= $${idx++}`); params.push(from); }
  if (to)   { conditions.push(`i.date <= $${idx++}`); params.push(to + ' 23:59:59'); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    // Summary stats for the period
    const summaryResult = await pool.query(`
      SELECT
        COUNT(i.id)                      AS total_invoices,
        COALESCE(SUM(i.total_amount), 0) AS total_sales,
        COALESCE(AVG(i.total_amount), 0) AS avg_invoice,
        COUNT(DISTINCT i.customer_id)    AS unique_customers
      FROM invoices i ${where}
    `, params);

    // Per-invoice rows with customer info
    const invoicesResult = await pool.query(`
      SELECT
        i.id, i.total_amount, i.date, i.items_json,
        c.id   AS customer_id,
        c.name AS customer_name,
        c.phone,
        c.type AS customer_type
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      ${where}
      ORDER BY i.date DESC
    `, params);

    // Daily aggregates for chart
    const dailyResult = await pool.query(`
      SELECT
        TO_CHAR(i.date, 'YYYY-MM-DD') AS day,
        COALESCE(SUM(i.total_amount), 0) AS sales,
        COUNT(i.id) AS count
      FROM invoices i ${where}
      GROUP BY TO_CHAR(i.date, 'YYYY-MM-DD')
      ORDER BY day
    `, params);

    res.json({
      summary:  summaryResult.rows[0],
      invoices: invoicesResult.rows,
      daily:    dailyResult.rows
    });
  } catch (err) {
    console.error('Reports/sales error:', err);
    res.status(500).json({ error: 'فشل في تحميل تقرير المبيعات' });
  }
});

/**
 * GET /api/reports/customers
 * Returns all customers with aggregated stats, filterable by date range
 */
router.get('/customers', verifyToken, requireRole('manager'), async (req, res) => {
  const { from, to } = req.query;

  const havingConds = [];
  const params      = [];
  let   idx         = 1;

  if (from) { havingConds.push(`MAX(i.date) >= $${idx++}`); params.push(from); }
  if (to)   { havingConds.push(`MAX(i.date) <= $${idx++}`); params.push(to + ' 23:59:59'); }
  const having = havingConds.length ? 'HAVING ' + havingConds.join(' AND ') : '';

  try {
    const result = await pool.query(`
      SELECT
        c.id, c.name, c.phone, c.address, c.type, c.created_at,
        MAX(i.date)                                      AS last_transaction,
        COALESCE(SUM(i.total_amount), 0)                AS total_spent,
        COUNT(DISTINCT DATE(i.date AT TIME ZONE 'UTC')) AS visit_count,
        COUNT(i.id)                                      AS invoice_count
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id
      GROUP BY c.id, c.name, c.phone, c.address, c.type, c.created_at
      ${having}
      ORDER BY total_spent DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Reports/customers error:', err);
    res.status(500).json({ error: 'فشل في تحميل تقرير العملاء' });
  }
});

module.exports = router;
