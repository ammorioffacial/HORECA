const express = require('express');
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats
router.get('/stats', verifyToken, requireRole('manager'), async (req, res) => {
  try {
    const statsResult = await pool.query(`
      SELECT
        COUNT(DISTINCT c.id)               AS total_customers,
        COUNT(i.id)                        AS total_invoices,
        COALESCE(SUM(i.total_amount), 0)   AS total_sales,
        COALESCE(AVG(i.total_amount), 0)   AS avg_invoice
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id
    `);

    const categoryResult = await pool.query(`
      SELECT COALESCE(type,'غير محدد') AS category, COUNT(*) AS count
      FROM customers GROUP BY type ORDER BY count DESC
    `);

    const topCustomersResult = await pool.query(`
      SELECT c.id, c.name, c.type,
        COALESCE(SUM(i.total_amount),0) AS total_spent,
        COUNT(i.id)                      AS invoice_count
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id
      GROUP BY c.id, c.name, c.type
      ORDER BY total_spent DESC LIMIT 5
    `);

    // Monthly sales — last 6 full months
    const monthlyResult = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS month,
        COALESCE(SUM(total_amount), 0)                AS sales
      FROM invoices
      WHERE date >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY month
    `);

    // Current-month daily sales breakdown
    const dailyResult = await pool.query(`
      SELECT
        TO_CHAR(date, 'DD') AS day,
        COALESCE(SUM(total_amount), 0) AS sales
      FROM invoices
      WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', NOW())
      GROUP BY TO_CHAR(date, 'DD')
      ORDER BY day
    `);

    // 5 most recent invoices with customer name
    const recentResult = await pool.query(`
      SELECT i.id, i.total_amount, i.date, i.items_json,
             c.id AS customer_id, c.name AS customer_name, c.type AS customer_type
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      ORDER BY i.date DESC LIMIT 5
    `);

    res.json({
      stats:        statsResult.rows[0],
      categories:   categoryResult.rows,
      topCustomers: topCustomersResult.rows,
      monthlySales: monthlyResult.rows,
      dailySales:   dailyResult.rows,
      recentInvoices: recentResult.rows
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'فشل في تحميل البيانات' });
  }
});

module.exports = router;
