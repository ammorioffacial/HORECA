// Run with: node server/seed.js
// Seeds one employee (emp / 123) and one manager (admin / 123)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
  const users = [
    { username: 'emp',   password: '123', role: 'employee' },
    { username: 'admin', password: '123', role: 'manager'  },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2, role = $3`,
      [u.username, hash, u.role]
    );
    console.log(`✓ Upserted user: ${u.username} (${u.role})`);
  }

  console.log('\nSeed complete. You can now log in with:');
  console.log('  Employee — username: emp   password: 123');
  console.log('  Manager  — username: admin password: 123');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
