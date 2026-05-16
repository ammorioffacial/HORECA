const express = require('express');
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/sales — Employee only
// Creates or reuses a customer, then saves the invoice
router.post('/', verifyToken, requireRole('employee'), async (req, res) => {
  const { name, phone, address, type, items } = req.body;

  if (!name || !phone || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'الاسم والهاتف والمواد مطلوبة' });
  }

  for (const item of items) {
    if (!item.name || item.price == null || item.qty == null) {
      return res.status(400).json({ error: 'كل مادة يجب أن تحتوي على اسم وسعر وكمية' });
    }
    if (isNaN(Number(item.price)) || isNaN(Number(item.qty))) {
      return res.status(400).json({ error: 'السعر والكمية يجب أن يكونا أرقاماً' });
    }
  }

  const total = items.reduce((sum, item) => {
    return sum + (Number(item.price) * Number(item.qty));
  }, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Look up existing customer by phone first.
    // If found: use their existing id — never overwrite their stored data.
    // If not found: insert as a new customer.
    let customerId;
    const existing = await client.query(
      'SELECT id FROM customers WHERE phone = $1',
      [phone.trim()]
    );

    if (existing.rows.length > 0) {
      // Returning customer — preserve all existing fields, just get the id.
      customerId = existing.rows[0].id;
    } else {
      // New customer — insert once.
      const inserted = await client.query(
        `INSERT INTO customers (name, phone, address, type)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [name.trim(), phone.trim(), address?.trim() || null, type || null]
      );
      customerId = inserted.rows[0].id;
    }

    // Insert invoice
    await client.query(
      `INSERT INTO invoices (customer_id, items_json, total_amount)
       VALUES ($1, $2, $3)`,
      [customerId, JSON.stringify(items), total]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'تم حفظ الفاتورة بنجاح' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Sales error:', err);
    res.status(500).json({ error: 'فشل في حفظ الفاتورة، يرجى المحاولة مرة أخرى' });
  } finally {
    client.release();
  }
});

module.exports = router;
