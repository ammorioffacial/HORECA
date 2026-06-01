const express = require('express');
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/sales — Employee only
// Creates or reuses a customer, then saves the invoice
router.post('/', verifyToken, requireRole('employee'), async (req, res) => {
  const { name, phone, address, type, items, invoice_image_url } = req.body;

  // Only name and at least one item are required — phone is optional
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'اسم الزبون مطلوب' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'يجب إضافة مادة واحدة على الأقل' });
  }

  // Normalise phone: treat empty string the same as absent → NULL
  const cleanPhone = (phone && phone.trim()) ? phone.trim() : null;

  // Validate each item — prices are DECIMAL so use parseFloat
  for (const item of items) {
    if (!item.name || item.price == null || item.qty == null) {
      return res.status(400).json({ error: 'كل مادة يجب أن تحتوي على اسم وسعر وكمية' });
    }
    const p = parseFloat(item.price);
    const q = parseInt(item.qty, 10);
    if (isNaN(p) || p <= 0) {
      return res.status(400).json({ error: `سعر المادة "${item.name}" غير صالح` });
    }
    if (isNaN(q) || q < 1) {
      return res.status(400).json({ error: `كمية المادة "${item.name}" غير صالحة` });
    }
  }

  // Compute total as DECIMAL — round to 2 decimal places to match NUMERIC(15,2)
  const total = Math.round(
    items.reduce((sum, item) => sum + parseFloat(item.price) * parseInt(item.qty, 10), 0)
    * 100
  ) / 100;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Look up existing customer by phone (only when a phone was provided).
    // If found: reuse their id — never overwrite stored data.
    // If not found, or no phone given: insert as a new customer.
    let customerId;
    const existing = cleanPhone
      ? await client.query('SELECT id FROM customers WHERE phone = $1', [cleanPhone])
      : { rows: [] };

    if (existing.rows.length > 0) {
      customerId = existing.rows[0].id;
    } else {
      const inserted = await client.query(
        `INSERT INTO customers (name, phone, address, type)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [name.trim(), cleanPhone, address?.trim() || null, type || null]
      );
      customerId = inserted.rows[0].id;
    }

    // Normalise items before storing — ensure numeric types, not raw strings
    const cleanItems = items.map(item => ({
      name:  item.name.trim(),
      price: Math.round(parseFloat(item.price) * 100) / 100,
      qty:   parseInt(item.qty, 10),
    }));

    const imageUrl = (invoice_image_url && typeof invoice_image_url === 'string') ? invoice_image_url.trim() : null;

    await client.query(
      `INSERT INTO invoices (customer_id, items_json, total_amount, invoice_image_url)
       VALUES ($1, $2, $3, $4)`,
      [customerId, JSON.stringify(cleanItems), total, imageUrl]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'تم حفظ الفاتورة بنجاح' });

  } catch (err) {
    await client.query('ROLLBACK');

    // Always log the real error server-side
    console.error('[sales POST] DB error:', err.message, err.detail || '', err.code || '');

    // Surface a meaningful message — include DB detail in development
    const detail = process.env.NODE_ENV !== 'production' ? ` — ${err.message}` : '';
    res.status(500).json({ error: `فشل في حفظ الفاتورة${detail}` });

  } finally {
    client.release();
  }
});

module.exports = router;
